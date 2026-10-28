// Testy prepinace Resend / Amazon SES. Fetch je vzdy podvrzeny.
// Sit jen pri nacteni aws4fetch ve vetvi ses.
// Spusteni z akademie/_supabase/functions:
//   npx --no-install deno test -A _shared/mail-provider.test.ts

import { assert, assertEquals } from "jsr:@std/assert@1";
import { mailKlic, mailProvider, posliMail, sestavMime, type MailPayload } from "./mail-provider.ts";

const ENV_KLICE = [
  "MAIL_PROVIDER",
  "RESEND_API_KEY",
  "AWS_SES_ACCESS_KEY_ID",
  "AWS_SES_SECRET_ACCESS_KEY",
  "AWS_SES_REGION",
  "SES_CONFIGURATION_SET",
] as const;

async function sEnv(
  nastaveni: Partial<Record<(typeof ENV_KLICE)[number], string>>,
  fn: () => Promise<void>,
) {
  const puv = ENV_KLICE.map((k) => [k, Deno.env.get(k)] as const);
  try {
    for (const k of ENV_KLICE) {
      const v = nastaveni[k];
      if (v === undefined) Deno.env.delete(k);
      else Deno.env.set(k, v);
    }
    await fn();
  } finally {
    for (const [k, v] of puv) {
      if (v === undefined) Deno.env.delete(k);
      else Deno.env.set(k, v);
    }
  }
}

type Zaznam = { input: Parameters<typeof fetch>[0]; init?: RequestInit };

function podvrh(odpoved: Response | Error): { fetch: typeof fetch; volani: Zaznam[] } {
  const volani: Zaznam[] = [];
  const f: typeof fetch = (input, init) => {
    volani.push({ input, init });
    if (odpoved instanceof Error) return Promise.reject(odpoved);
    return Promise.resolve(odpoved.clone());
  };
  return { fetch: f, volani };
}

function jsonOdpoved(status: number, telo: unknown): Response {
  return new Response(JSON.stringify(telo), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function dekodujBase64(b64: string): string {
  const bin = atob(b64.replace(/\s+/g, ""));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

function dekoduj2047(s: string): string {
  const spojene = s.replace(/(\?=)[ \t\r\n]+(?==\?)/g, "$1");
  return spojene.replace(/=[?]UTF-8[?]B[?]([A-Za-z0-9+/]+={0,2})[?]=/gi, (_m, b64: string) => {
    return dekodujBase64(b64);
  });
}

function mapaHlavicek(blok: string): Record<string, string> {
  const out: Record<string, string> = {};
  let klic = "";
  for (const line of blok.split("\r\n")) {
    if (!line) continue;
    if (/^[ \t]/.test(line) && klic) {
      out[klic] += line;
      continue;
    }
    const m = /^([^:]+): ?(.*)$/.exec(line);
    if (!m) continue;
    klic = m[1].toLowerCase();
    out[klic] = m[2];
  }
  return out;
}

function teloZpravy(mime: string): { hlavicky: Record<string, string>; telo: string } {
  const idx = mime.indexOf("\r\n\r\n");
  if (idx < 0) return { hlavicky: mapaHlavicek(mime), telo: "" };
  return { hlavicky: mapaHlavicek(mime.slice(0, idx)), telo: mime.slice(idx + 4) };
}

function rozdelMultipart(contentType: string, telo: string): { hlavicky: Record<string, string>; telo: string }[] {
  const m = /boundary="([^"]+)"/.exec(contentType);
  if (!m) throw new Error("chybi boundary: " + contentType);
  const b = m[1];
  const kusy = telo.split("--" + b);
  const vys: { hlavicky: Record<string, string>; telo: string }[] = [];
  for (let i = 1; i < kusy.length; i++) {
    let kus = kusy[i];
    if (kus.startsWith("--")) break;
    if (kus.startsWith("\r\n")) kus = kus.slice(2);
    if (kus.endsWith("\r\n")) kus = kus.slice(0, -2);
    const p = kus.indexOf("\r\n\r\n");
    if (p < 0) continue;
    vys.push({ hlavicky: mapaHlavicek(kus.slice(0, p)), telo: kus.slice(p + 4) });
  }
  return vys;
}

function zadnyRadekPres(mime: string) {
  const bez = mime.replace(/\r\n/g, "");
  assert(!bez.includes("\n") && !bez.includes("\r"), "konce radku nejsou jen CRLF");
  for (const line of mime.split("\r\n")) {
    assert(line.length <= 998, "radek " + line.length + ": " + line.slice(0, 60));
  }
}

const ZAKLAD: MailPayload = {
  from: "Martin <martin@martinbarna.cz>",
  to: ["a@b.cz"],
  subject: "Ahoj",
  html: "<p>X</p>",
};

Deno.test("resend: URL, metoda, hlavicky, telo, id a signal", async () => {
  const payload: MailPayload = {
    from: "Martin <martin@martinbarna.cz>",
    to: ["a@b.cz", "b@c.cz"],
    subject: "Ahoj",
    html: "<p>X</p>",
    text: "X",
    reply_to: undefined,
    headers: { "X-Test": "1" },
  };
  const ac = new AbortController();
  const mock = podvrh(jsonOdpoved(200, { id: "re_abc123" }));
  await sEnv({ RESEND_API_KEY: "env-klic" }, async () => {
    assertEquals(mailProvider(), "resend");
    const r = await posliMail(payload, { fetch: mock.fetch, signal: ac.signal });
    assertEquals(r, { ok: true, status: 200, providerId: "re_abc123" });
  });
  assertEquals(mock.volani.length, 1);
  const v = mock.volani[0];
  assertEquals(v.input, "https://api.resend.com/emails");
  assertEquals(v.init?.method, "POST");
  assertEquals(v.init?.headers, {
    Authorization: "Bearer env-klic",
    "Content-Type": "application/json",
  });
  assertEquals(v.init?.body, JSON.stringify(payload));
  assertEquals(v.init?.signal, ac.signal);
});

Deno.test("resend: 429 ma tvar resend_429:, telo oriznute na 180", async () => {
  const telo = "y".repeat(240);
  const mock = podvrh(new Response(telo, { status: 429 }));
  await sEnv({ RESEND_API_KEY: "k" }, async () => {
    const r = await posliMail(ZAKLAD, { fetch: mock.fetch, resendKey: "k" });
    assertEquals(r.ok, false);
    assertEquals(r.status, 429);
    assertEquals(r.providerId, "");
    assertEquals(r.chyba, "resend_429:" + telo.slice(0, 180));
  });
});

Deno.test("resend: pad fetch je status 0 a sit:, bez vyjimky", async () => {
  const mock = podvrh(new Error("ECONNRESET"));
  await sEnv({ RESEND_API_KEY: "k" }, async () => {
    const r = await posliMail(ZAKLAD, { fetch: mock.fetch, resendKey: "k" });
    assertEquals(r.ok, false);
    assertEquals(r.status, 0);
    assertEquals(r.providerId, "");
    assert(r.chyba?.startsWith("sit:"));
    assert(r.chyba?.includes("ECONNRESET"));
  });
});

Deno.test("resend: prazdny klic nevola fetch, resendKey prebiji env", async () => {
  const mock = podvrh(jsonOdpoved(200, { id: "re_z_volby" }));
  await sEnv({ RESEND_API_KEY: "z-env" }, async () => {
    const bez = await posliMail(ZAKLAD, { fetch: mock.fetch, resendKey: "" });
    assertEquals(bez, { ok: false, status: 0, providerId: "", chyba: "missing_RESEND_API_KEY" });
    assertEquals(mock.volani.length, 0);

    const r = await posliMail(ZAKLAD, { fetch: mock.fetch, resendKey: "z-volby" });
    assertEquals(r.providerId, "re_z_volby");
  });
  const headers = mock.volani[0].init?.headers as Record<string, string>;
  assertEquals(headers.Authorization, "Bearer z-volby");
});

Deno.test("resend: chybejici env klic taky nevola fetch", async () => {
  const mock = podvrh(jsonOdpoved(200, { id: "x" }));
  await sEnv({}, async () => {
    const r = await posliMail(ZAKLAD, { fetch: mock.fetch });
    assertEquals(r.chyba, "missing_RESEND_API_KEY");
    assertEquals(mock.volani.length, 0);
  });
});

Deno.test("resend: necitelne telo je ok a prazdne providerId", async () => {
  const mock = podvrh(new Response("ne-json", { status: 200 }));
  await sEnv({ RESEND_API_KEY: "k" }, async () => {
    const r = await posliMail(ZAKLAD, { fetch: mock.fetch, resendKey: "k" });
    assertEquals(r, { ok: true, status: 200, providerId: "" });
  });
});

const SES_ENV = {
  MAIL_PROVIDER: "ses",
  AWS_SES_ACCESS_KEY_ID: "AKIATEST",
  AWS_SES_SECRET_ACCESS_KEY: "secret-test",
  AWS_SES_REGION: "eu-central-1",
};

Deno.test("ses: podpis, region, konfigurace, hole adresy, MIME bez Bcc", async () => {
  const ac = new AbortController();
  const mock = podvrh(jsonOdpoved(200, { MessageId: "0100018f-ses" }));
  const payload: MailPayload = {
    from: "Martin Barna <martin@martinbarna.cz>",
    to: "Jana Novakova <jana@klient.cz>",
    cc: ["Asistent <a@asistent.cz>"],
    bcc: "Kopie <kopie@martinbarna.cz>",
    reply_to: "Odpoved <reply@martinbarna.cz>",
    subject: "Tvuj plan",
    text: "Ahoj",
    html: "<p>Ahoj</p>",
    headers: {
      "List-Unsubscribe": "<https://martinbarna.cz/odhlas>",
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  };
  await sEnv(SES_ENV, async () => {
    const r = await posliMail(payload, { fetch: mock.fetch, signal: ac.signal });
    assertEquals(r, { ok: true, status: 200, providerId: "0100018f-ses" });
  });
  assertEquals(mock.volani.length, 1);
  const v = mock.volani[0];
  const req = v.input as Request;
  assert(req instanceof Request);
  assertEquals(req.url, "https://email.eu-central-1.amazonaws.com/v2/email/outbound-emails");
  assertEquals(req.method, "POST");
  assert(req.headers.get("authorization")?.startsWith("AWS4-HMAC-SHA256"));
  assertEquals(v.init?.signal, ac.signal);

  const json = JSON.parse(await req.text());
  assertEquals(json.ConfigurationSetName, "mb-mailing");
  assertEquals(json.FromEmailAddress, undefined);
  assertEquals(json.Destination, {
    ToAddresses: ["jana@klient.cz"],
    CcAddresses: ["a@asistent.cz"],
    BccAddresses: ["kopie@martinbarna.cz"],
  });
  const mime = dekodujBase64(json.Content.Raw.Data);
  assert(mime.includes("From:"));
  assert(mime.includes("Martin Barna <martin@martinbarna.cz>"));
  assert(mime.includes("To:"));
  assert(mime.includes("jana@klient.cz"));
  assert(mime.includes("Subject:"));
  assert(mime.includes("Tvuj plan"));
  assert(mime.includes("List-Unsubscribe: <https://martinbarna.cz/odhlas>"));
  assert(mime.includes("List-Unsubscribe-Post: List-Unsubscribe=One-Click"));
  const hlavicky = mime.slice(0, mime.indexOf("\r\n\r\n"));
  for (const line of hlavicky.split("\r\n")) {
    assert(!/^Bcc:/i.test(line), line);
  }
  zadnyRadekPres(mime);
});

Deno.test("ses: SES_CONFIGURATION_SET prebije vychozi mb-mailing", async () => {
  const mock = podvrh(jsonOdpoved(200, { MessageId: "mid-2" }));
  await sEnv({ ...SES_ENV, SES_CONFIGURATION_SET: "muj-set" }, async () => {
    const r = await posliMail(ZAKLAD, { fetch: mock.fetch });
    assertEquals(r.providerId, "mid-2");
  });
  const req = mock.volani[0].input as Request;
  const json = JSON.parse(await req.text());
  assertEquals(json.ConfigurationSetName, "muj-set");
});

Deno.test("ses: chybejici klic nevola fetch", async () => {
  const mock = podvrh(jsonOdpoved(200, { MessageId: "x" }));
  await sEnv({ MAIL_PROVIDER: "ses", AWS_SES_REGION: "eu-central-1" }, async () => {
    const r = await posliMail(ZAKLAD, { fetch: mock.fetch });
    assertEquals(r.chyba, "missing_AWS_SES_ACCESS_KEY_ID");
  });
  await sEnv({
    MAIL_PROVIDER: "ses",
    AWS_SES_ACCESS_KEY_ID: "AKIATEST",
    AWS_SES_REGION: "eu-central-1",
  }, async () => {
    const r = await posliMail(ZAKLAD, { fetch: mock.fetch });
    assertEquals(r.chyba, "missing_AWS_SES_SECRET_ACCESS_KEY");
  });
  await sEnv({
    MAIL_PROVIDER: "ses",
    AWS_SES_ACCESS_KEY_ID: "AKIATEST",
    AWS_SES_SECRET_ACCESS_KEY: "secret-test",
  }, async () => {
    const r = await posliMail(ZAKLAD, { fetch: mock.fetch });
    assertEquals(r.chyba, "missing_AWS_SES_REGION");
  });
  assertEquals(mock.volani.length, 0);
});

Deno.test("ses: 400 ma tvar ses_400:", async () => {
  const mock = podvrh(new Response("Bad Request", { status: 400 }));
  await sEnv(SES_ENV, async () => {
    const r = await posliMail(ZAKLAD, { fetch: mock.fetch });
    assertEquals(r.ok, false);
    assertEquals(r.status, 400);
    assertEquals(r.providerId, "");
    assertEquals(r.chyba, "ses_400:Bad Request");
  });
});

Deno.test("MIME: cesky subject se po dekodovani encoded-word vrati presne", () => {
  const predmet = "Tvůj plán je připravený, ďáblíku 💪";
  const mime = sestavMime({
    from: "a@b.cz",
    to: "b@c.cz",
    subject: predmet,
    text: "x",
  });
  const hlav = teloZpravy(mime).hlavicky;
  assertEquals(dekoduj2047(hlav.subject), predmet);
  for (const m of mime.matchAll(/=\?UTF-8\?B\?[A-Za-z0-9+/=]*\?=/g)) {
    assert(m[0].length <= 75, m[0]);
  }
  zadnyRadekPres(mime);
});

Deno.test("MIME: html + text je multipart/alternative a casti se dekoduji zpet", () => {
  const text = "Ahoj,\nřádek dva";
  const html = "<p>Ahoj, řádek dva</p>";
  const mime = sestavMime({
    from: "a@b.cz",
    to: "b@c.cz",
    subject: "S",
    text,
    html,
  });
  const z = teloZpravy(mime);
  assert(z.hlavicky["content-type"].includes("multipart/alternative"));
  const casti = rozdelMultipart(z.hlavicky["content-type"], z.telo);
  assertEquals(casti.length, 2);
  assert(casti[0].hlavicky["content-type"].includes("text/plain"));
  assert(casti[0].hlavicky["content-type"].includes("charset=UTF-8"));
  assertEquals(casti[0].hlavicky["content-transfer-encoding"], "base64");
  assert(casti[1].hlavicky["content-type"].includes("text/html"));
  assertEquals(dekodujBase64(casti[0].telo), text);
  assertEquals(dekodujBase64(casti[1].telo), html);
  zadnyRadekPres(mime);
});

Deno.test("MIME: priloha je multipart/mixed s filename", () => {
  const obsah = btoa("ahoj-priloha");
  const mime = sestavMime({
    from: "a@b.cz",
    to: "b@c.cz",
    subject: "S",
    html: "<p>telo</p>",
    attachments: [{ filename: "plan.pdf", content: "  " + obsah + "\n" }],
  });
  const z = teloZpravy(mime);
  assert(z.hlavicky["content-type"].includes("multipart/mixed"));
  const casti = rozdelMultipart(z.hlavicky["content-type"], z.telo);
  assertEquals(casti.length, 2);
  assert(casti[1].hlavicky["content-type"].includes("application/pdf"));
  assert(casti[1].hlavicky["content-type"].includes('name="plan.pdf"'));
  assert(casti[1].hlavicky["content-disposition"].includes('filename="plan.pdf"'));
  assertEquals(casti[1].telo.replace(/\s+/g, ""), obsah);
  zadnyRadekPres(mime);
});

Deno.test("MIME: header injection se nestane samostatnou hlavickou Bcc", () => {
  const mime = sestavMime({
    from: "a@b.cz",
    to: "b@c.cz",
    subject: "S",
    text: "telo",
    headers: {
      "X-Test": "x\r\nBcc: zly@x.cz",
      "Bcc": "zly@x.cz",
    },
  });
  const hlavicky = mime.slice(0, mime.indexOf("\r\n\r\n"));
  for (const line of hlavicky.split("\r\n")) {
    assert(!/^Bcc:/i.test(line), line);
  }
  assert(hlavicky.includes("X-Test: xBcc: zly@x.cz"));
  zadnyRadekPres(mime);
});

Deno.test("MIME: zadny radek delsi nez 998, ani u dlouheho subjectu", () => {
  const predmet = ("Tvůj plán je připravený, ďáblíku 💪 ").repeat(40).trim();
  const mime = sestavMime({
    from: "a@b.cz",
    to: "b@c.cz",
    subject: predmet,
    text: "x".repeat(4000),
    html: "<p>" + "ř".repeat(4000) + "</p>",
    headers: { "X-Dlouha": "slovo ".repeat(400) },
    attachments: [{ filename: "poznamky.txt", content: btoa("y".repeat(500)) }],
  });
  zadnyRadekPres(mime);
  assertEquals(dekoduj2047(teloZpravy(mime).hlavicky.subject), predmet);
});

Deno.test("MIME: display name s diakritikou je encoded-word, adresa ne", () => {
  const mime = sestavMime({
    from: "Martin Bárna <martin@martinbarna.cz>",
    to: 'Barna, Martin <klient@x.cz>',
    subject: "Ahoj",
    text: "x",
  });
  assert(!mime.includes("Bárna"));
  assert(mime.includes("<martin@martinbarna.cz>"));
  const hlav = teloZpravy(mime).hlavicky;
  assert(dekoduj2047(hlav.from).includes("Martin Bárna"));
  assert(dekoduj2047(hlav.from).includes("<martin@martinbarna.cz>"));
  assert(hlav.to.includes('"Barna, Martin"'));
  assert(hlav.to.includes("<klient@x.cz>"));
  zadnyRadekPres(mime);
});

Deno.test("MIME: prazdne telo je text/plain", () => {
  const mime = sestavMime({ from: "a@b.cz", to: "b@c.cz", subject: "S" });
  const z = teloZpravy(mime);
  assert(z.hlavicky["content-type"].includes("text/plain"));
  assertEquals(dekodujBase64(z.telo), "");
});

Deno.test("neznamy MAIL_PROVIDER nevola fetch a nelze tise prehodit", async () => {
  const mock = podvrh(jsonOdpoved(200, { id: "x" }));
  const hlasky: string[] = [];
  const puvodni = console.error;
  console.error = (...a: unknown[]) => {
    hlasky.push(a.map(String).join(" "));
  };
  try {
    await sEnv({ MAIL_PROVIDER: "holub", RESEND_API_KEY: "k" }, async () => {
      assertEquals(mailProvider(), "holub");
      const r = await posliMail(ZAKLAD, { fetch: mock.fetch, resendKey: "k" });
      assertEquals(r, { ok: false, status: 0, providerId: "", chyba: "neznamy_MAIL_PROVIDER:holub" });
    });
  } finally {
    console.error = puvodni;
  }
  assertEquals(mock.volani.length, 0);
  assert(hlasky.some((h) => h.includes("holub")));
});

Deno.test("MAIL_PROVIDER SES s mezerou a velkymi pismeny je ses", async () => {
  const mock = podvrh(jsonOdpoved(200, { MessageId: "mid-ses" }));
  await sEnv({ ...SES_ENV, MAIL_PROVIDER: "SES " }, async () => {
    assertEquals(mailProvider(), "ses");
    const r = await posliMail(ZAKLAD, { fetch: mock.fetch });
    assertEquals(r.providerId, "mid-ses");
  });
  const req = mock.volani[0].input as Request;
  assert(req.url.includes("amazonaws.com"));
});

// 27. 10. 2026: `mailKlic()` nahrazuje `Deno.env.get("RESEND_API_KEY")` u vsech kontrol
// „mail je nastaveny". U Resendu musi vratit presne klic (chovani jako dnes), u SES
// neprazdnou znacku jen pri vsech trech klicich AWS, jinak prazdno.
Deno.test("mailKlic: resend vraci RESEND_API_KEY beze zmeny, prazdny zustava prazdny", async () => {
  await sEnv({ RESEND_API_KEY: "re_klic" }, async () => assertEquals(mailKlic(), "re_klic"));
  await sEnv({ MAIL_PROVIDER: "resend", RESEND_API_KEY: "re_klic" }, async () => assertEquals(mailKlic(), "re_klic"));
  await sEnv({}, async () => assertEquals(mailKlic(), ""));
});

Deno.test("mailKlic: ses nepotrebuje klic Resendu, chce vsechny tri klice AWS", async () => {
  await sEnv({ ...SES_ENV }, async () => assertEquals(mailKlic(), "ses"));
  await sEnv({ ...SES_ENV, AWS_SES_REGION: " " }, async () => assertEquals(mailKlic(), ""));
  await sEnv({ MAIL_PROVIDER: "ses", RESEND_API_KEY: "re_klic" }, async () => assertEquals(mailKlic(), ""));
  await sEnv({ MAIL_PROVIDER: "holub", RESEND_API_KEY: "re_klic" }, async () => assertEquals(mailKlic(), ""));
});
