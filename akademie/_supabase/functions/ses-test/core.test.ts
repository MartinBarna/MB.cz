// Testy ses-test: allowlist, stopa type=test, odeslání jen přes SES.
// Fetch je podvržený. Síť jen při prvním importu aws4fetch ve větvi SES.
// Spuštění: deno test -A --no-check akademie/_supabase/functions/ses-test/core.test.ts

import { assert, assertEquals } from "jsr:@std/assert@1";
import { handleSesTest, predmetTestu, SES_TEST_PRIJEMCI, type SesTestDeps, type StopaTestu } from "./core.ts";

const ENV = [
  "MAIL_PROVIDER",
  "RESEND_API_KEY",
  "AWS_SES_ACCESS_KEY_ID",
  "AWS_SES_SECRET_ACCESS_KEY",
  "AWS_SES_REGION",
  "SES_CONFIGURATION_SET",
] as const;

async function sEnv(
  nastaveni: Partial<Record<(typeof ENV)[number], string>>,
  fn: () => Promise<void>,
) {
  const puv = ENV.map((k) => [k, Deno.env.get(k)] as const);
  try {
    for (const k of ENV) {
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

const SES_KLICE = {
  AWS_SES_ACCESS_KEY_ID: "AKIATEST",
  AWS_SES_SECRET_ACCESS_KEY: "secret-test",
  AWS_SES_REGION: "eu-central-1",
};

function mockFetch(status: number, body: unknown) {
  const volani: string[] = [];
  const tela: string[] = [];
  const fetchImpl: typeof fetch = async (input) => {
    const req = input instanceof Request ? input : new Request(String(input));
    volani.push(req.url);
    tela.push(await req.text());
    return new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    });
  };
  return { fetchImpl, volani, tela };
}

function deps(opts: {
  email?: string | null;
  admini?: string[];
  fetchImpl?: typeof fetch;
  zapis?: (r: StopaTestu) => Promise<{ ok: boolean }>;
  stopy?: StopaTestu[];
}): SesTestDeps {
  const stopy = opts.stopy ?? [];
  return {
    emailAdmina: async () => (opts.email === undefined ? "fitness.barna@gmail.com" : opts.email),
    adminEmaily: async () => opts.admini ?? ["fitness.barna@gmail.com"],
    zapisStopu: opts.zapis ?? (async (r) => {
      stopy.push(r);
      return { ok: true };
    }),
    fetchImpl: opts.fetchImpl,
  };
}

function pozadavek(method: string, body?: unknown, auth = "Bearer jwt-admina"): Request {
  const init: RequestInit = { method, headers: {} };
  if (auth) (init.headers as Record<string, string>).Authorization = auth;
  if (body !== undefined) init.body = JSON.stringify(body);
  return new Request("https://example.test/ses-test", init);
}

function dekodujBase64(s: string): string {
  const bin = atob(s.replace(/\s+/g, ""));
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

Deno.test("allowlist je presne ctyri adresy", () => {
  assertEquals([...SES_TEST_PRIJEMCI], [
    "success@simulator.amazonses.com",
    "bounce@simulator.amazonses.com",
    "complaint@simulator.amazonses.com",
    "fitness.barna+tester@gmail.com",
  ]);
});

Deno.test("predmet vzdy zacina TEST", () => {
  assertEquals(predmetTestu(undefined), "TEST SES");
  assertEquals(predmetTestu("SES simulator"), "TEST SES simulator");
  assertEquals(predmetTestu("TEST uz hotovo"), "TEST uz hotovo");
  assert(!predmetTestu("a\r\nBcc: zly@x.cz").includes("\n"));
});

Deno.test("bez admin tokenu a cizí e-mail je 403 a nic se neposila", async () => {
  const mock = mockFetch(200, { MessageId: "nemelo-by" });
  const stopy: StopaTestu[] = [];
  const bez = await handleSesTest(pozadavek("POST", { to: SES_TEST_PRIJEMCI[0] }, ""), deps({
    email: null,
    fetchImpl: mock.fetchImpl,
    stopy,
  }));
  assertEquals(bez.status, 403);
  const cizi = await handleSesTest(pozadavek("POST", { to: SES_TEST_PRIJEMCI[0] }), deps({
    email: "nekdo@example.com",
    fetchImpl: mock.fetchImpl,
    stopy,
  }));
  assertEquals(cizi.status, 403);
  assertEquals(mock.volani.length, 0);
  assertEquals(stopy.length, 0);
});

Deno.test("GET neni POST", async () => {
  const mock = mockFetch(200, { MessageId: "x" });
  const res = await handleSesTest(pozadavek("GET"), deps({ fetchImpl: mock.fetchImpl }));
  assertEquals(res.status, 405);
  assertEquals(mock.volani.length, 0);
});

Deno.test("prijemce mimo allowlist je 403, vcetne plus varianty a dvou adres", async () => {
  const mock = mockFetch(200, { MessageId: "x" });
  const stopy: StopaTestu[] = [];
  const d = deps({ fetchImpl: mock.fetchImpl, stopy });
  for (const to of ["jiny@example.com", "fitness.barna+jiny@gmail.com", "success@simulator.amazonses.com,bounce@simulator.amazonses.com", ""]) {
    const res = await handleSesTest(pozadavek("POST", { to }), d);
    assertEquals(res.status, 403, to);
  }
  const dva = await handleSesTest(pozadavek("POST", { to: [SES_TEST_PRIJEMCI[0], SES_TEST_PRIJEMCI[1]] }), d);
  assertEquals(dva.status, 403);
  assertEquals(mock.volani.length, 0);
  assertEquals(stopy.length, 0);
});

Deno.test("allowlist odesle pres SES, zapise stopu a neresi Resend", async () => {
  const mock = mockFetch(200, { MessageId: "0100018f-ses-test" });
  const stopy: StopaTestu[] = [];
  await sEnv({ MAIL_PROVIDER: "resend", RESEND_API_KEY: "klic-test", ...SES_KLICE }, async () => {
    for (const to of SES_TEST_PRIJEMCI) {
      const teloTo = to === "success@simulator.amazonses.com" ? "Success@simulator.amazonses.com" : to;
      const res = await handleSesTest(
        pozadavek("POST", { to: teloTo, subject: "simulator" }),
        deps({ fetchImpl: mock.fetchImpl, stopy }),
      );
      const body = await res.json();
      assertEquals(res.status, 200, JSON.stringify(body));
      assertEquals(body.provider_id, "0100018f-ses-test");
      assertEquals(body.to, to);
      assert(String(body.subject).startsWith("TEST"), body.subject);
    }
    assertEquals(Deno.env.get("MAIL_PROVIDER"), "resend");
  });
  assertEquals(stopy.length, SES_TEST_PRIJEMCI.length);
  for (const s of stopy) {
    assertEquals(s.type, "test");
    assertEquals(s.provider_id, "0100018f-ses-test");
    assertEquals(s.lead_id, null);
    assertEquals(s.detail.test, true);
    assertEquals(s.detail.via, "ses-test");
    assert(SES_TEST_PRIJEMCI.includes(s.detail.email as typeof SES_TEST_PRIJEMCI[number]));
  }
  assert(mock.volani.length === SES_TEST_PRIJEMCI.length);
  for (const url of mock.volani) {
    assert(url.includes("amazonaws.com"), url);
    assert(!url.includes("api.resend.com"), url);
    assert(url.includes("/v2/email/outbound-emails"), url);
  }
  const mime = dekodujBase64(JSON.parse(mock.tela[0]).Content.Raw.Data);
  assert(mime.includes("Subject: TEST "));
});

Deno.test("prazdny MAIL_PROVIDER taky neni Resend", async () => {
  const mock = mockFetch(200, { MessageId: "mid-prazdny" });
  const stopy: StopaTestu[] = [];
  await sEnv({ RESEND_API_KEY: "klic-test", ...SES_KLICE }, async () => {
    assertEquals(Deno.env.get("MAIL_PROVIDER"), undefined);
    const res = await handleSesTest(
      pozadavek("POST", { to: "bounce@simulator.amazonses.com" }),
      deps({ fetchImpl: mock.fetchImpl, stopy }),
    );
    assertEquals(res.status, 200);
    assertEquals(Deno.env.get("MAIL_PROVIDER"), undefined);
  });
  assertEquals(mock.volani.length, 1);
  assert(mock.volani[0].includes("amazonaws.com"));
  assert(!mock.volani[0].includes("resend"));
  assertEquals(stopy[0].type, "test");
  assertEquals(stopy[0].detail.test, true);
});

Deno.test("neuspech SES stopu nezapisuje", async () => {
  const mock = mockFetch(400, { message: "rejected" });
  const stopy: StopaTestu[] = [];
  await sEnv({ MAIL_PROVIDER: "resend", RESEND_API_KEY: "klic-test", ...SES_KLICE }, async () => {
    const res = await handleSesTest(
      pozadavek("POST", { to: "complaint@simulator.amazonses.com" }),
      deps({ fetchImpl: mock.fetchImpl, stopy }),
    );
    assertEquals(res.status, 502);
    assertEquals(Deno.env.get("MAIL_PROVIDER"), "resend");
  });
  assertEquals(stopy.length, 0);
  assert(mock.volani.length === 1);
  assert(!mock.volani[0].includes("api.resend.com"));
});

Deno.test("zdroj ses-test nevola api.resend.com", async () => {
  const koren = new URL("./", import.meta.url);
  const core = await Deno.readTextFile(new URL("./core.ts", koren));
  const index = await Deno.readTextFile(new URL("./index.ts", koren));
  assert(!core.includes("api.resend.com"));
  assert(!index.includes("api.resend.com"));
  assert(core.includes("posliMail"));
  assert(core.includes('Deno.env.set("MAIL_PROVIDER", "ses")'));
});
