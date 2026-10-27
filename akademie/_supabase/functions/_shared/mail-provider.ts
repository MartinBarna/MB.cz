// ============================================================================
// JEDNO MISTO, KTERE POSLE MAIL (Resend nebo Amazon SES v2)
// ============================================================================
// PROC: kazda edge funkce dnes sklada fetch na api.resend.com sama. Prepinac
// `MAIL_PROVIDER` ma zit tady, aby se volajici prepisovali na jednu funkci
// `posliMail` a tvar chyby `resend_429:` (cte ho jistic v DB) zustal.
//
// Soubor se kopiruje bajt po bajtu do appky, kde ho `tsc` preklada do CommonJS
// (`moduleResolution: node`). Proto zadny staticky import z URL: `aws4fetch`
// se cte dynamicky az ve vetvi ses. Env se cte pri kazdem volani, testy ho meni.

export type MailPriloha = { filename: string; content: string /* base64 */ };

export type MailPayload = {
  from: string;
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  reply_to?: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  headers?: Record<string, string>;
  attachments?: MailPriloha[];
  // Volajici posilaji i undefined, treba `reply_to: x || undefined`.
  [k: string]: unknown;
};

export type MailOdpoved = {
  ok: boolean;
  status: number;
  providerId: string;
  chyba?: string;
};

export type MailVolby = {
  resendKey?: string;
  fetch?: typeof fetch;
  signal?: AbortSignal;
};

// Retezec v konstante, ne jako literal v `import()`: tsc by ho jinak resil jako modul.
const AWS4FETCH_URL = "https://esm.sh/aws4fetch@1.0.20";

const ZAKAZANE_HLAVICKY = new Set([
  "from",
  "to",
  "cc",
  "bcc",
  "subject",
  "date",
  "mime-version",
  "content-type",
  "content-transfer-encoding",
]);

// RFC 2047: cely encoded-word vcetne obalu smi mit nejvyse 75 znaku.
// `=?UTF-8?B?` + `?=` je 12 znaku, base64 po 45 bajtech ma 60 znaku (celkem 72).
const MAX_BAJTU_V_ENCODED_WORD = 45;

type AwsKlient = {
  sign: (
    input: string,
    init: { method: string; headers: Record<string, string>; body: string },
  ) => Promise<Request>;
};

type AwsKlientTrida = new (opts: {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  service: string;
}) => AwsKlient;

function envGet(k: string): string {
  try {
    const g = globalThis as any;
    return g.Deno?.env?.get(k) ?? g.process?.env?.[k] ?? "";
  } catch {
    // Deno bez --allow-env hodi. Prazdno znamena "klic chybi", ne pad cele davky.
    return "";
  }
}

/** Trim + lowercase. Prazdne (nebo jen mezery) = vychozi Resend, stejne jako dnes. */
export function mailProvider(): "resend" | "ses" | string {
  const v = envGet("MAIL_PROVIDER").trim().toLowerCase();
  return v || "resend";
}

/**
 * Hodnota, kterou volajici drzi v `RESEND_KEY` a podle ktere rozhoduji „mail je nastaveny"
 * (`if (!RESEND_KEY) ...`, 45 mist v obou repech). Diky tomu ty kontroly plati dal beze zmeny.
 * - `resend`: `RESEND_API_KEY` beze zmeny, tedy chovani jako dnes.
 * - `ses`: neprazdna znacka `"ses"`, kdyz jsou nastavene vsechny tri klice AWS, jinak `""`.
 *   Klic Resendu pri SES potreba neni; `posliMail` ve vetvi ses `resendKey` ignoruje.
 * - neznamy provider: `""`, aby volajici hlasil chybejici konfiguraci, ne tichy uspech.
 */
export function mailKlic(): string {
  const provider = mailProvider();
  if (provider === "resend") return envGet("RESEND_API_KEY");
  if (provider !== "ses") return "";
  const klice = ["AWS_SES_ACCESS_KEY_ID", "AWS_SES_SECRET_ACCESS_KEY", "AWS_SES_REGION"];
  return klice.every((k) => envGet(k).trim() !== "") ? "ses" : "";
}

/**
 * Posle mail. Nikdy nehazi: pad site vraci `status: 0` a `chyba` zacinajici `sit:`,
 * aby smycka cronu dojela (13. 9. pad fetch shodil cely beh `splatky-guard`).
 */
export async function posliMail(payload: MailPayload, volby?: MailVolby): Promise<MailOdpoved> {
  try {
    const provider = mailProvider();
    if (provider === "resend") return await posliResend(payload, volby);
    if (provider === "ses") return await posliSes(payload, volby);
    console.error("[mail-provider] neznamy MAIL_PROVIDER: " + provider);
    return { ok: false, status: 0, providerId: "", chyba: "neznamy_MAIL_PROVIDER:" + provider };
  } catch (e) {
    return sitChyba(e);
  }
}

/** Sestavi RFC 5322 zpravu (CRLF). Bcc do ni nepatri, jinak by ji videl kazdy prijemce. */
export function sestavMime(payload: MailPayload): string {
  const hlavicky = sestavHlavicky(payload);
  const telo = sestavTelo(payload, hlavicky);
  return hlavicky + "\r\n" + telo;
}

function sitChyba(e: unknown): MailOdpoved {
  return { ok: false, status: 0, providerId: "", chyba: "sit:" + String(e).slice(0, 180) };
}

function posliResend(payload: MailPayload, volby?: MailVolby): Promise<MailOdpoved> {
  // Prazdny retezec je predany klic, ne "vem ho z env". Volajici tim schvalne tisi odeslani.
  const key = volby && volby.resendKey !== undefined ? volby.resendKey : envGet("RESEND_API_KEY");
  if (!key) return Promise.resolve({ ok: false, status: 0, providerId: "", chyba: "missing_RESEND_API_KEY" });
  const f = volby?.fetch ?? fetch;
  return (async () => {
    try {
      // Telo je payload beze zmeny. Zadny spolecny "uklid" undefined poli:
      // JSON.stringify je stejny jako u dnesnich primeho fetch.
      const res = await f("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: volby?.signal,
      });
      return await ctiOdpoved(res, "resend_", "id");
    } catch (e) {
      return sitChyba(e);
    }
  })();
}

async function posliSes(payload: MailPayload, volby?: MailVolby): Promise<MailOdpoved> {
  const accessKeyId = envGet("AWS_SES_ACCESS_KEY_ID").trim();
  if (!accessKeyId) return { ok: false, status: 0, providerId: "", chyba: "missing_AWS_SES_ACCESS_KEY_ID" };
  const secretAccessKey = envGet("AWS_SES_SECRET_ACCESS_KEY").trim();
  if (!secretAccessKey) return { ok: false, status: 0, providerId: "", chyba: "missing_AWS_SES_SECRET_ACCESS_KEY" };
  const region = envGet("AWS_SES_REGION").trim();
  if (!region) return { ok: false, status: 0, providerId: "", chyba: "missing_AWS_SES_REGION" };
  const configurationSet = envGet("SES_CONFIGURATION_SET").trim() || "mb-mailing";

  const destination: Record<string, string[]> = {};
  const to = holeAdresy(payload.to);
  const cc = holeAdresy(payload.cc);
  const bcc = holeAdresy(payload.bcc);
  if (to.length) destination.ToAddresses = to;
  if (cc.length) destination.CcAddresses = cc;
  if (bcc.length) destination.BccAddresses = bcc;

  const mime = sestavMime(payload);
  const body = JSON.stringify({
    Destination: destination,
    Content: { Raw: { Data: naBase64(new TextEncoder().encode(mime)) } },
    ConfigurationSetName: configurationSet,
  });
  const url = "https://email." + region + ".amazonaws.com/v2/email/outbound-emails";

  try {
    const { AwsClient } = await import(AWS4FETCH_URL) as { AwsClient: AwsKlientTrida };
    const aws = new AwsClient({ accessKeyId, secretAccessKey, region, service: "ses" });
    const req = await aws.sign(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
    const f = volby?.fetch ?? fetch;
    const res = await f(req, { signal: volby?.signal });
    return await ctiOdpoved(res, "ses_", "MessageId");
  } catch (e) {
    return sitChyba(e);
  }
}

async function ctiOdpoved(res: Response, prefix: string, idKlic: "id" | "MessageId"): Promise<MailOdpoved> {
  if (!res.ok) {
    const telo = await res.text().catch(() => "");
    // Tvar `resend_429:` neni kosmetika. Jistic `followups_circuit_breaker` hleda presne ten prefix.
    return {
      ok: false,
      status: res.status,
      providerId: "",
      chyba: prefix + res.status + ":" + telo.slice(0, 180),
    };
  }
  let providerId = "";
  try {
    const j = await res.json();
    const v = j && typeof j === "object" ? (j as Record<string, unknown>)[idKlic] : undefined;
    providerId = v == null ? "" : String(v);
  } catch {
    // Telo neslo precist, ale provider zasilku uz prijal. Prazdne id = bounce se nesparuje.
  }
  return { ok: true, status: res.status, providerId };
}

function jakoPole(v: unknown): string[] {
  if (v == null) return [];
  const arr = Array.isArray(v) ? v : [v];
  const out: string[] = [];
  for (const x of arr) {
    if (x == null) continue;
    const s = String(x).replace(/[\r\n]/g, "").trim();
    if (s) out.push(s);
  }
  return out;
}

function holaAdresa(raw: string): string {
  const m = raw.match(/<([^<>]+)>/);
  return (m ? m[1] : raw).trim();
}

function holeAdresy(v: unknown): string[] {
  return jakoPole(v).map(holaAdresa).filter((a) => a !== "");
}

function seznamAdres(v: unknown): string {
  return jakoPole(v).map(formatAdresu).join(", ");
}

function formatAdresu(raw: string): string {
  const m = raw.match(/^(.*)<([^<>]*)>$/);
  if (!m) return raw.trim();
  let jmeno = (m[1] ?? "").trim();
  const adresa = (m[2] ?? "").trim();
  if (jmeno.length >= 2 && jmeno.startsWith('"') && jmeno.endsWith('"')) {
    jmeno = jmeno.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, "\\");
  }
  if (!jmeno) return adresa;
  // Adresu samotnou nekodujeme, jen zobrazene jmeno.
  return kodujZobrazeni(jmeno) + " <" + adresa + ">";
}

function kodujZobrazeni(jmeno: string): string {
  const ciste = jmeno.replace(/[\r\n]+/g, " ").trim();
  if (!ciste) return '""';
  if (/[^\x00-\x7F]/.test(ciste)) return encode2047(ciste);
  if (jeFrazeAtomu(ciste)) return ciste;
  return '"' + escapujUvozovky(ciste) + '"';
}

function jeFrazeAtomu(s: string): boolean {
  const atomy = s.split(" ");
  if (!atomy.length) return false;
  for (const a of atomy) {
    if (!/^[A-Za-z0-9!#$%&'*+\-/=?^_`{|}~]+$/.test(a)) return false;
  }
  return true;
}

function escapujUvozovky(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function utf8Delka(ch: string): number {
  const cp = ch.codePointAt(0) ?? 0;
  if (cp <= 0x7f) return 1;
  if (cp <= 0x7ff) return 2;
  if (cp <= 0xffff) return 3;
  return 4;
}

function encode2047(text: string): string {
  const slova: string[] = [];
  let kus = "";
  let bajtu = 0;
  for (const ch of text) {
    const n = utf8Delka(ch);
    // Vic bajtovy znak nesmi prestat uprostred encoded-word, jinak dekoder slozi odpad.
    if (kus && bajtu + n > MAX_BAJTU_V_ENCODED_WORD) {
      slova.push(encodedWord(kus));
      kus = ch;
      bajtu = n;
    } else {
      kus += ch;
      bajtu += n;
    }
  }
  if (kus) slova.push(encodedWord(kus));
  if (!slova.length) slova.push(encodedWord(""));
  return slova.join("\r\n ");
}

function encodedWord(s: string): string {
  return "=?UTF-8?B?" + naBase64(new TextEncoder().encode(s)) + "?=";
}

function zakodujSubject(subject: string): string {
  const cisty = subject.replace(/[\r\n]+/g, " ");
  if (/[^\x00-\x7F]/.test(cisty)) return encode2047(cisty);
  return cisty;
}

function rfc2822(d: Date): string {
  const dny = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const mesice = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const pad = (n: number) => (n < 10 ? "0" : "") + n;
  return dny[d.getUTCDay()] + ", " + pad(d.getUTCDate()) + " " + mesice[d.getUTCMonth()] + " " +
    d.getUTCFullYear() + " " + pad(d.getUTCHours()) + ":" + pad(d.getUTCMinutes()) + ":" +
    pad(d.getUTCSeconds()) + " +0000";
}

function sestavHlavicky(payload: MailPayload): string {
  const radky: string[] = [];
  radky.push(spojHlavicku("From", seznamAdres(payload.from)));
  radky.push(spojHlavicku("To", seznamAdres(payload.to)));
  if (jakoPole(payload.cc).length) radky.push(spojHlavicku("Cc", seznamAdres(payload.cc)));
  if (jakoPole(payload.reply_to).length) radky.push(spojHlavicku("Reply-To", seznamAdres(payload.reply_to)));
  radky.push(spojHlavicku("Subject", zakodujSubject(String(payload.subject ?? ""))));
  radky.push(spojHlavicku("Date", rfc2822(new Date())));
  radky.push("MIME-Version: 1.0");
  for (const r of vlastniHlavicky(payload.headers)) radky.push(r);
  return radky.join("\r\n");
}

function vlastniHlavicky(headers: MailPayload["headers"]): string[] {
  if (!headers || typeof headers !== "object") return [];
  const radky: string[] = [];
  for (const [name0, value0] of Object.entries(headers)) {
    const nazev = String(name0).replace(/[\r\n]/g, "");
    if (!nazev || ZAKAZANE_HLAVICKY.has(nazev.toLowerCase())) continue;
    let hodnota = String(value0 ?? "").replace(/[\r\n]/g, "");
    if (hodnota === "") continue;
    if (/[^\x00-\x7F]/.test(hodnota)) hodnota = encode2047(hodnota);
    radky.push(spojHlavicku(nazev, hodnota));
  }
  return radky;
}

/**
 * Sklada hlavicku tak, aby zadny radek nepresah 998 znaku (RFC 5322).
 * Zalomeni pred existujici mezerou se da rozbalit zpet na puvodni text.
 * Encoded-word uz je zalomeny (`CRLF` + mezera), tak se jen pripoji nazev.
 */
function spojHlavicku(nazev: string, hodnota: string): string {
  const prefix = nazev + ": ";
  if (hodnota.includes("\r\n")) {
    const kusy = hodnota.split("\r\n");
    const lines = [prefix + (kusy[0] ?? "")];
    for (let i = 1; i < kusy.length; i++) {
      const k = kusy[i] ?? "";
      lines.push(/^[ \t]/.test(k) ? k : " " + k);
    }
    return lines.join("\r\n");
  }
  if (prefix.length + hodnota.length <= 998) return prefix + hodnota;

  const lines: string[] = [];
  let zbytek = hodnota;
  let prvni = true;
  for (let pojistka = 0; pojistka < 10000 && (zbytek.length > 0 || prvni); pojistka++) {
    if (!prvni && !/^[ \t]/.test(zbytek)) zbytek = " " + zbytek;
    const zac = prvni ? prefix : "";
    const mistnost = 998 - zac.length;
    if (zbytek.length <= mistnost) {
      lines.push(zac + zbytek);
      break;
    }
    let rez = -1;
    const hraniceOkna = Math.min(mistnost, zbytek.length);
    for (let i = hraniceOkna; i >= 1; i--) {
      const ch = zbytek[i];
      if (i < zbytek.length && (ch === " " || ch === "\t")) {
        rez = i;
        break;
      }
    }
    if (rez <= 0) rez = Math.max(1, Math.min(mistnost, zbytek.length));
    lines.push(zac + zbytek.slice(0, rez));
    zbytek = zbytek.slice(rez);
    prvni = false;
  }
  return lines.join("\r\n");
}

function sestavTelo(payload: MailPayload, hlavicky: string): string {
  const maHtml = payload.html != null;
  const maText = payload.text != null;
  let vnitrni: string;
  if (maHtml && maText) vnitrni = alternativa(String(payload.text), String(payload.html), hlavicky);
  else if (maHtml) vnitrni = jednaCast("text/html", String(payload.html));
  else vnitrni = jednaCast("text/plain", maText ? String(payload.text) : "");

  const prilohy = (Array.isArray(payload.attachments) ? payload.attachments : []).filter((p) => {
    return !!p && String(p.filename ?? "").replace(/[\r\n]/g, "").trim() !== "";
  });
  if (!prilohy.length) return vnitrni;
  return mixed(vnitrni, prilohy, hlavicky);
}

function jednaCast(typ: string, obsah: string): string {
  const telo = zalom76(naBase64(new TextEncoder().encode(obsah)));
  return "Content-Type: " + typ + "; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n" + telo;
}

function alternativa(text: string, html: string, navic: string): string {
  const p1 = jednaCast("text/plain", text);
  const p2 = jednaCast("text/html", html);
  const b = hranice(p1 + "\n" + p2 + "\n" + navic);
  return [
    'Content-Type: multipart/alternative; boundary="' + b + '"',
    "",
    "--" + b,
    p1,
    "--" + b,
    p2,
    "--" + b + "--",
    "",
  ].join("\r\n");
}

function mixed(vnitrni: string, prilohy: MailPriloha[], navic: string): string {
  const casti = prilohy.map(prilohaCast);
  const b = hranice(vnitrni + "\n" + casti.join("\n") + "\n" + navic);
  const radky = ['Content-Type: multipart/mixed; boundary="' + b + '"', ""];
  radky.push("--" + b, vnitrni);
  for (const c of casti) radky.push("--" + b, c);
  radky.push("--" + b + "--", "");
  return radky.join("\r\n");
}

function prilohaCast(p: MailPriloha): string {
  const nazev = String(p.filename ?? "").replace(/[\r\n]/g, "");
  const typ = typPrilohy(nazev);
  const prenos = zalom76(String(p.content ?? "").replace(/\s+/g, ""));
  const neAscii = /[^\x00-\x7F]/.test(nazev);
  const typHodnota = neAscii
    ? typ + "; name*=UTF-8''" + rfc2231(nazev)
    : typ + '; name="' + escapujUvozovky(nazev) + '"';
  const dispHodnota = neAscii
    ? "attachment; filename*=UTF-8''" + rfc2231(nazev)
    : 'attachment; filename="' + escapujUvozovky(nazev) + '"';
  return [
    spojHlavicku("Content-Type", typHodnota),
    spojHlavicku("Content-Disposition", dispHodnota),
    "Content-Transfer-Encoding: base64",
    "",
    prenos,
  ].join("\r\n");
}

function typPrilohy(nazev: string): string {
  const m = nazev.toLowerCase().match(/\.([a-z0-9]+)$/);
  switch (m?.[1]) {
    case "pdf":
      return "application/pdf";
    case "png":
      return "image/png";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "gif":
      return "image/gif";
    case "txt":
      return "text/plain";
    case "csv":
      return "text/csv";
    case "html":
      return "text/html";
    case "ics":
      return "text/calendar";
    case "zip":
      return "application/zip";
    default:
      return "application/octet-stream";
  }
}

function rfc2231(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let out = "";
  for (const b of bytes) {
    const ch = String.fromCharCode(b);
    if (/[A-Za-z0-9!#$&+\-.^_`|~]/.test(ch)) out += ch;
    else out += "%" + b.toString(16).toUpperCase().padStart(2, "0");
  }
  return out;
}

function hranice(haystack: string): string {
  for (let i = 0; i < 5; i++) {
    const b = "mb_" + crypto.randomUUID().replace(/-/g, "");
    if (!haystack.includes(b)) return b;
  }
  const nahodne = new Uint8Array(16);
  crypto.getRandomValues(nahodne);
  let hex = "mb_";
  for (const n of nahodne) hex += n.toString(16).padStart(2, "0");
  if (!haystack.includes(hex)) return hex;
  return hex + "z";
}

function zalom76(b64: string): string {
  const ciste = b64.replace(/\s+/g, "");
  if (!ciste) return "";
  const radky: string[] = [];
  for (let i = 0; i < ciste.length; i += 76) radky.push(ciste.slice(i, i + 76));
  return radky.join("\r\n");
}

function naBase64(bytes: Uint8Array): string {
  const kusy: string[] = [];
  const krok = 8192;
  for (let i = 0; i < bytes.length; i += krok) {
    const konec = Math.min(i + krok, bytes.length);
    let bin = "";
    for (let j = i; j < konec; j++) bin += String.fromCharCode(bytes[j]);
    kusy.push(bin);
  }
  return btoa(kusy.join(""));
}
