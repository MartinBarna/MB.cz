// ses-events: příjem SNS notifikací z Amazon SES (Bounce, Complaint, Delivery).
// Párují se do email_events a mění stav leads PŘESNĚ jako resend-webhook.
// Nasazení: --no-verify-jwt (volá se z SNS bez Supabase JWT).
//
// Fail closed na topic ARN (env SES_SNS_TOPIC_ARN) a na ověření podpisu.
// Martinovy adresy: chování stejné jako přes stopu v resend-webhook (používá jeMartinovaAdresa).

import { odesliPresResend, jeMartinovaAdresa } from "../_shared/resend-odeslat.ts";
import { mailKlic } from "../_shared/mail-provider.ts";

// deno-lint-ignore no-explicit-any
type Admin = any;

export type Deps = {
  admin: Admin;
  fetch: typeof fetch;
  now: () => Date;
  env: (key: string) => string;
};

export type HandleResult = {
  status: number;
  body: Record<string, unknown>;
};

const json = (b: unknown, status = 200): HandleResult => ({ status, body: b as Record<string, unknown> });

// In-memory cache certu podle URL (životnost instance funkce).
// Klíč = URL + hash, protože stejný cert může být podepsán SHA-1 i SHA-256.
const certCache = new Map<string, CryptoKey>();

function isValidSnsCertHost(urlStr: string): boolean {
  try {
    const u = new URL(urlStr);
    return /^sns\.[a-z0-9-]+\.amazonaws\.com$/.test(u.hostname) && u.pathname.endsWith(".pem");
  } catch {
    return false;
  }
}

function isValidSnsHost(urlStr: string): boolean {
  try {
    const u = new URL(urlStr);
    return /^sns\.[a-z0-9-]+\.amazonaws\.com$/.test(u.hostname);
  } catch {
    return false;
  }
}

function pemToDer(pem: string): Uint8Array {
  const b64 = pem.replace(/-----BEGIN CERTIFICATE-----|-----END CERTIFICATE-----/g, "").replace(/\s+/g, "");
  const bin = atob(b64);
  const ab = new ArrayBuffer(bin.length);
  const der = new Uint8Array(ab);
  for (let i = 0; i < bin.length; i++) der[i] = bin.charCodeAt(i);
  return der;
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const ab = new ArrayBuffer(bin.length);
  const out = new Uint8Array(ab);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function extractSpki(der: Uint8Array): Uint8Array | null {
  let p = 0;
  const getByte = () => der[p++];
  const peek = () => der[p];
  const readLength = (): number => {
    let l = getByte();
    if ((l & 0x80) === 0) return l;
    const num = l & 0x7f;
    l = 0;
    for (let i = 0; i < num; i++) l = (l << 8) | getByte();
    return l;
  };
  const skip = (n: number) => { p += n; };
  try {
    if (getByte() !== 0x30) return null; // Certificate
    readLength();
    if (getByte() !== 0x30) return null; // TBSCertificate
    readLength();
    // optional [0] version
    if (peek() === 0xa0) {
      getByte();
      const vl = readLength();
      skip(vl);
    }
    // serial INTEGER
    if (peek() !== 0x02) return null;
    getByte();
    skip(readLength());
    // signatureAlgorithm
    if (peek() !== 0x30) return null;
    getByte();
    skip(readLength());
    // issuer
    if (peek() !== 0x30) return null;
    getByte();
    skip(readLength());
    // validity
    if (peek() !== 0x30) return null;
    getByte();
    skip(readLength());
    // subject
    if (peek() !== 0x30) return null;
    getByte();
    skip(readLength());
    // subjectPublicKeyInfo
    if (peek() !== 0x30) return null;
    const spkiStart = p;
    getByte();
    const spkiLen = readLength();
    const spkiEnd = p + spkiLen;
    if (spkiEnd > der.length) return null;
    return der.slice(spkiStart, spkiEnd);
  } catch {
    return null;
  }
}

async function verifySnsSignature(
  stringToSign: string,
  signatureB64: string,
  certUrl: string,
  sigVer: string,
  f: typeof fetch,
): Promise<boolean> {
  const hashName: "SHA-1" | "SHA-256" = sigVer === "1" ? "SHA-1" : "SHA-256";
  const cacheKey = certUrl + "|" + hashName;
  let key = certCache.get(cacheKey);
  if (!key) {
    const resp = await f(certUrl);
    if (!resp.ok) return false;
    const pem = await resp.text();
    const der = pemToDer(pem);
    const spki = extractSpki(der);
    if (!spki) return false;
    key = await crypto.subtle.importKey(
      "spki",
      spki as unknown as BufferSource,
      { name: "RSASSA-PKCS1-v1_5", hash: hashName },
      false,
      ["verify"],
    );
    certCache.set(cacheKey, key);
  }
  try {
    const sigBytes = base64ToBytes(signatureB64) as unknown as BufferSource;
    const dataBytes = new TextEncoder().encode(stringToSign) as unknown as BufferSource;
    return await crypto.subtle.verify(
      { name: "RSASSA-PKCS1-v1_5", hash: hashName },
      key,
      sigBytes,
      dataBytes,
    );
  } catch {
    return false;
  }
}

function buildStringToSign(msg: any): string {
  const typ = String(msg?.Type || "");
  const order = typ === "Notification"
    ? ["Message", "MessageId", "Subject", "Timestamp", "TopicArn", "Type"]
    : ["Message", "MessageId", "SubscribeURL", "Timestamp", "Token", "TopicArn", "Type"];
  let s = "";
  for (const k of order) {
    const v = (msg as any)?.[k];
    if (v != null) {
      if (k === "Subject" && (v === "" || v == null)) continue;
      s += k + "\n" + String(v) + "\n";
    }
  }
  return s;
}

// TENTO SEZNAM MUSÍ BÝT PŘESNĚ SHODNÝ S resend-webhook/index.ts
// (včetně pořadí). Kontroluje to T1 v _shared/resend-odeslat.test.ts (čte oba zdrojáky).
const TYPY_ODESLANI = [
  "sent",
  "test",
  "px_odeslano",
  "odeslano",
  "konzultace_znovu_doruceno",
  "balicek_znovu_doruceno",
];

async function alertNesparovano(
  admin: Admin,
  typ: string,
  providerId: string,
  adresa: string,
  via: string,
  bounceTyp: string,
  duvod: string,
  doruceno: string[],
  melaBcc: boolean,
  deps: Deps,
): Promise<void> {
  const hodinaZpet = new Date(deps.now().getTime() - 3600_000).toISOString();
  let uzSlo = false;
  let chybaPojistky: any = null;
  try {
    const { data: nedavno, error } = await admin.from("email_events").select("id")
      .eq("type", "alert_nesparovano").gte("created_at", hodinaZpet).limit(1);
    chybaPojistky = error;
    uzSlo = chybaPojistky ? true : !!(nedavno && nedavno.length);
  } catch (e) {
    chybaPojistky = e;
    uzSlo = true;
  }
  if (chybaPojistky) {
    console.error("[ses-events] cteni hodinove pojistky selhalo: " + (chybaPojistky.message || chybaPojistky));
  }
  const { error } = await admin.from("email_events").insert({
    lead_id: null,
    step: 0,
    type: "alert_nesparovano",
    detail: {
      via: "ses-events",
      udalost: typ,
      provider_id: providerId,
      email: adresa || null,
      zdrojova_funkce: via || null,
      bounce_typ: bounceTyp || null,
      duvod,
      doruceno_na: doruceno.length ? doruceno : null,
      mela_bcc: melaBcc,
      alert_odeslan: !uzSlo,
      pojistka_necitelna: !!chybaPojistky,
    },
  });
  if (error) console.error("[ses-events] zapis alert_nesparovano selhal: " + error.message);
  if (uzSlo) return;

  // `mailKlic()`: u SES klic Resendu potreba neni (viz `_shared/mail-provider.ts`).
  const resendKey = mailKlic();
  if (!resendKey) return;

  let komu = "fitness.barna@gmail.com";
  try {
    const { data } = await admin.from("app_config").select("value").eq("key", "admin_emails").maybeSingle();
    const raw = String(data?.value || "");
    const parts = raw.split(/[,;\s\n]+/).map((x) => x.trim()).filter((x) => x.includes("@"));
    if (parts[0]) komu = parts[0];
  } catch {
    /* fallback */
  }

  const popis = typ === "bounce" ? "odmítnutý mail (bounce)" : "stížnost na spam";
  const vysvetleni = duvod === "adresa_nesedi"
    ? "Odrazila se <b>jiná adresa, než na kterou mail mířil</b>. Nejspíš skrytá kopie "
      + "(BCC), takže se schválně nic nezmrazilo: příjemce mail nejspíš dostal v pořádku."
    : "Nepodařilo se ho přiřadit k žádnému kontaktu, takže se sám od sebe nic nezastavilo.";
  const coSTim = duvod === "adresa_nesedi"
    ? "Zkontroluj schránku, na kterou ti chodí kopie. Klientův lead se nechal být."
    : "Najdi tu adresu v adminu a zastav jí maily ručně. Dokud to nikdo neudělá, "
      + "chodí jí všechno dál a kazí to doručitelnost ostatním.";
  await odesliPresResend(resendKey, {
    from: "Martin Barna <news@martinbarna.cz>",
    to: [komu],
    subject: "🔴 SES: " + popis + ", který se nepodařilo přiřadit",
    html: `<div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;font-size:15px;line-height:1.55;color:#222;max-width:560px">`
      + `<p>Přišel <b>${popis}</b>. ${vysvetleni}</p>`
      + `<table cellpadding="5" style="border-collapse:collapse;font-size:14px">`
      + `<tr><td style="color:#666">SES MessageId</td><td><code>${providerId}</code></td></tr>`
      + `<tr><td style="color:#666">Adresa ze stopy</td><td>${adresa || "(žádná)"}</td></tr>`
      + `<tr><td style="color:#666">Odrazilo se na</td><td>${doruceno.length ? doruceno.join(", ") : "(payload adresu neposlal)"}</td></tr>`
      + `<tr><td style="color:#666">Skrytá kopie</td><td>${melaBcc ? "ANO, zásilka měla BCC (mohla se odrazit kopie, ne příjemce)" : "ne"}</td></tr>`
      + `<tr><td style="color:#666">Odesílající funkce</td><td>${via || "(neznámá)"}</td></tr>`
      + `<tr><td style="color:#666">Typ bounce</td><td>${bounceTyp || "(nepřišel)"}</td></tr>`
      + `</table>`
      + `<p><b>Co s tím:</b> ${coSTim}</p>`
      + `<p style="font-size:13px;color:#666">Další takový alert přijde nejdřív za hodinu, `
      + `ať se z toho nestane lavina. Všechny případy jsou v <code>email_events</code> `
      + `pod typem <code>alert_nesparovano</code>.</p></div>`,
  });
}

export async function handleSns(method: string, rawBody: string, deps: Deps): Promise<HandleResult> {
  if (method !== "POST") return json({ error: "method" }, 405);

  let msg: any;
  try {
    msg = JSON.parse(rawBody);
  } catch {
    return json({ error: "bad_json" }, 400);
  }

  const envTopic = (deps.env("SES_SNS_TOPIC_ARN") || "").trim();
  if (!envTopic) return json({ error: "not_configured" }, 503);

  const allowed = envTopic.split(",").map((s) => s.trim()).filter(Boolean);
  const topicArn = String(msg?.TopicArn || "");
  if (!allowed.includes(topicArn)) return json({ error: "forbidden_topic" }, 403);

  // Ověření podpisu PŘED vším ostatním (i před subscribe).
  const sigVer = String(msg?.SignatureVersion || "");
  if (sigVer !== "1" && sigVer !== "2") return json({ error: "bad_signature_version" }, 401);

  const certUrl = String(msg?.SigningCertURL || "");
  if (!certUrl.startsWith("https://") || !isValidSnsCertHost(certUrl)) {
    return json({ error: "bad_cert_url" }, 401);
  }

  const stringToSign = buildStringToSign(msg);
  const sigB64 = String(msg?.Signature || "");
  let verified = false;
  try {
    verified = await verifySnsSignature(stringToSign, sigB64, certUrl, sigVer, deps.fetch);
  } catch (e) {
    console.error("[ses-events] verify error: " + (e as Error).message);
  }
  if (!verified) return json({ error: "bad_signature" }, 401);

  // Replay ochrana: starší než 1 hodina.
  // ⛔ Chybejici nebo necitelny `Timestamp` = odmitnout (fail closed), ne preskocit kontrolu.
  const ts = Date.parse(String(msg?.Timestamp || ""));
  if (!Number.isFinite(ts)) return json({ error: "replay" }, 401);
  if (Math.abs((deps.now().getTime() - ts) / 1000) > 3600) return json({ error: "replay" }, 401);

  const typ = String(msg?.Type || "");
  if (typ === "SubscriptionConfirmation") {
    const url = String(msg?.SubscribeURL || "");
    if (url.startsWith("https://") && isValidSnsHost(url)) {
      try {
        await deps.fetch(url);
      } catch (e) {
        console.error("[ses-events] subscribe GET failed: " + (e as Error).message);
      }
    }
    return json({ ok: true });
  }
  if (typ === "UnsubscribeConfirmation") {
    console.log("[ses-events] UnsubscribeConfirmation received (logged only)");
    return json({ ok: true });
  }
  if (typ !== "Notification") {
    return json({ ok: true, ignored: typ });
  }

  // Notification: Message je JSON řetězec.
  let inner: any = {};
  try {
    inner = JSON.parse(String(msg?.Message || "{}"));
  } catch {
    return json({ ok: true, ignored: "bad_inner_json" });
  }

  const eventType = String(inner?.eventType ?? inner?.notificationType ?? "");
  let t = "";
  if (eventType === "Delivery") t = "delivered";
  else if (eventType === "Bounce") t = "bounce";
  else if (eventType === "Complaint") t = "complaint";
  else return json({ ok: true, ignored: eventType || "unknown" });

  const providerId = String(inner?.mail?.messageId || "");
  if (!providerId) return json({ ok: true, ignored: "no_message_id" });

  const snsMessageId = String(msg?.MessageId || "");

  // Dedup na SNS retry: stejný type + detail.sns_message_id
  // ⛔ supabase-js chybu NEHAZI, vraci ji v `error`. Chyba dotazu neni „duplicita nenalezena":
  //    u bounce/complaint 500 (SNS zopakuje), u delivered se pokracuje.
  if (snsMessageId) {
    let chybaDedup: unknown = null;
    try {
      const { data: dups, error } = await deps.admin.from("email_events")
        .select("id").eq("type", t).eq("detail->>sns_message_id", snsMessageId).limit(1);
      if (error) chybaDedup = error;
      else if (dups && dups.length) return json({ ok: true, dedup: true });
    } catch (e) {
      chybaDedup = e;
    }
    if (chybaDedup) {
      console.error("[ses-events] dedup sns_message_id failed: " + String((chybaDedup as Error)?.message ?? chybaDedup));
      if (t === "bounce" || t === "complaint") return json({ error: "dedup_failed", retry: true }, 500);
    }
  }

  // Párování PŘESNĚ jako v resend-webhook.
  const { data: orig, error: chybaOrig } = await deps.admin.from("email_events")
    .select("lead_id,step,type,detail").eq("provider_id", providerId)
    .in("type", TYPY_ODESLANI).limit(1).maybeSingle();

  const rozhodujeOZmrazeni = t === "bounce" || t === "complaint";
  if (chybaOrig) {
    console.error("[ses-events] cteni puvodniho odeslani selhalo: " + chybaOrig.message);
    if (rozhodujeOZmrazeni) return json({ error: "orig_read_failed", retry: true }, 500);
  }

  const detailStopy = (orig?.detail && typeof orig.detail === "object")
    ? (orig.detail as Record<string, unknown>) : {};
  const isTest = orig?.type === "test" || detailStopy.test === true;

  // Adresy z payloadu (Bounce/Complaint/Delivery).
  let adresyRaw: unknown[] = [];
  if (t === "bounce") adresyRaw = (inner?.bounce?.bouncedRecipients || []) as unknown[];
  else if (t === "complaint") adresyRaw = (inner?.complaint?.complainedRecipients || []) as unknown[];
  else if (t === "delivered") adresyRaw = (inner?.delivery?.recipients || []) as unknown[];
  let adresyZPayloadu = adresyRaw.map((x: any) => {
    const s = String((x && x.emailAddress) ? x.emailAddress : x ?? "").trim();
    const m = s.match(/<([^<>]+)>/);
    return (m ? m[1] : s).toLowerCase();
  }).filter((a) => a.length > 0);

  let lead_id = (!isTest && orig?.lead_id) ? String(orig.lead_id) : null;
  let sparovanoPodle = lead_id ? "provider_id" : "nesparovano";
  const adresaZeStopy = String(detailStopy.email ?? "").trim().toLowerCase();
  const adresaSedi = adresyZPayloadu.length === 0 || !adresaZeStopy || adresyZPayloadu.includes(adresaZeStopy);

  if (!lead_id && !isTest && adresaZeStopy && adresaSedi) {
    const { data: l, error: chybaLeada } = await deps.admin.from("leads")
      .select("id").eq("email", adresaZeStopy).limit(1).maybeSingle();
    if (chybaLeada) {
      console.error("[ses-events] dohledani leada podle adresy selhalo: " + chybaLeada.message);
      if (rozhodujeOZmrazeni) return json({ error: "lead_lookup_failed", retry: true }, 500);
    }
    if (l?.id) { lead_id = String(l.id); sparovanoPodle = "email"; }
  } else if (!adresaSedi) {
    sparovanoPodle = "adresa_nesedi";
  }
  if (lead_id && sparovanoPodle === "provider_id" && !adresaSedi) {
    lead_id = null;
    sparovanoPodle = "adresa_nesedi";
  }

  // Výjimka pro Martinovy adresy (stejně jako resend-webhook respektuje přes stopu).
  // ⛔ JEN kdyz se odrazily VYHRADNE Martinovy adresy. Kdyz je v seznamu i klient,
  //    klientuv bounce se zpracuje normalne (jinak by mrtva adresa dostavala dal).
  const jeMartinBounce = adresyZPayloadu.length > 0 && adresyZPayloadu.every((a) => jeMartinovaAdresa(a));
  if (jeMartinBounce) {
    lead_id = null;
    if (sparovanoPodle === "provider_id") sparovanoPodle = "adresa_nesedi";
  }

  const step = orig?.step == null ? null : Number(orig.step);
  const baseDetail = detailStopy;

  let bounceTyp = "";
  let bounceSub = "";
  let prechodnyBounce = false;
  if (t === "bounce") {
    bounceTyp = String(inner?.bounce?.bounceType || "");
    bounceSub = String(inner?.bounce?.bounceSubType || "");
    // Pouze Permanent zmrazuje. Transient i Undetermined = prechodny:true, lead se nechá být.
    prechodnyBounce = bounceTyp !== "Permanent";
  }

  const detail: Record<string, unknown> = {
    ...baseDetail,
    via: "ses-events",
    of: isTest ? "test" : "sent",
    sparovano_podle: sparovanoPodle,
    ...(chybaOrig ? { cteni_stopy_selhalo: String(chybaOrig.message).slice(0, 120) } : {}),
    ...(baseDetail.bcc === true ? { mela_bcc: true } : {}),
    ...(adresyZPayloadu.length ? { doruceno_na: adresyZPayloadu } : {}),
    ...(snsMessageId ? { sns_message_id: snsMessageId } : {}),
  };
  if (t === "bounce") {
    detail.bounce_typ = bounceTyp;
    detail.bounce_sub = bounceSub;
    detail.prechodny = prechodnyBounce;
  }

  // Další dedup pro delivered přes provider_id (jako v resend-webhook).
  if (t === "delivered") {
    try {
      const { data: dup } = await deps.admin.from("email_events").select("id")
        .eq("type", t).eq("provider_id", providerId).limit(1);
      if (dup && dup.length) return json({ ok: true, dedup: true });
    } catch {
      // Pro delivered 500 neděláme (jako v resend).
    }
  }

  // Zápis události.
  const { error: insErr } = await deps.admin.from("email_events").insert({
    lead_id,
    step: step ?? 0,
    type: t,
    provider_id: providerId || null,
    detail,
  });
  if (insErr) {
    console.error("[ses-events] insert event failed: " + insErr.message);
  }

  // Zmrazení leadu: jen Permanent bounce a complaint (při sparovaném lead_id).
  if ((t === "bounce" || t === "complaint") && lead_id && !prechodnyBounce) {
    await deps.admin.from("leads").update({
      status: t === "bounce" ? "bounced" : "unsubscribed",
      next_send_at: null,
      updated_at: deps.now().toISOString(),
      ...(t === "complaint" ? { unsubscribed_at: deps.now().toISOString() } : {}),
    }).eq("id", lead_id);

    if (t === "complaint") {
      const { error: rpcErr } = await deps.admin.rpc("odhlas_a_odstran", {
        p_lead_id: lead_id,
        p_zdroj: "spam-complaint",
      });
      if (rpcErr) console.error("[ses-events] odhlas_a_odstran failed: " + rpcErr.message);
    }
  }

  // Alert pro nespárované (Permanent) bounce/complaint. Martinovy adresy přeskočí.
  if ((t === "bounce" || t === "complaint") && !lead_id && !isTest && !prechodnyBounce && !jeMartinBounce) {
    await alertNesparovano(
      deps.admin, t, providerId, adresaZeStopy, String(baseDetail.via ?? ""),
      bounceTyp, sparovanoPodle, adresyZPayloadu, baseDetail.bcc === true, deps,
    );
  }

  return json({ ok: true, type: t, sparovano_podle: sparovanoPodle });
}

// Pro testy (pouze):
export { buildStringToSign, isValidSnsCertHost, certCache as __certCacheForTests };
