// Testy ses-events: ověření SNS podpisu, topicu, dedupu, párování a zmrazení leadů.
// Používá reálný testovací RSA klíč + cert z fixtures (self-signed, jen pro testy).
// Spuštění: npx --no-install deno test -A --no-check akademie/_supabase/functions/ses-events/

import { handleSns, buildStringToSign, isValidSnsCertHost, __certCacheForTests } from "./core.ts";

const KOREN = new URL("./", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const FIX = KOREN + "__tests__/fixtures/";
const certPem = Deno.readTextFileSync(FIX + "cert.pem");
const keyPem = Deno.readTextFileSync(FIX + "key.pem");

function stripPem(pem: string): string {
  return pem.replace(/-----BEGIN (PRIVATE KEY|CERTIFICATE)-----|-----END (PRIVATE KEY|CERTIFICATE)-----/g, "").replace(/\s+/g, "");
}

async function importPkcs8ForSign(pem: string, hash: "SHA-1" | "SHA-256" = "SHA-256"): Promise<CryptoKey> {
  const der = Uint8Array.from(atob(stripPem(pem)), (c) => c.charCodeAt(0));
  return await crypto.subtle.importKey(
    "pkcs8",
    der,
    { name: "RSASSA-PKCS1-v1_5", hash },
    false,
    ["sign"],
  );
}

async function signStringToSign(s: string, key: CryptoKey): Promise<string> {
  const sig = await crypto.subtle.sign({ name: "RSASSA-PKCS1-v1_5" }, key, new TextEncoder().encode(s));
  let bin = "";
  for (const b of new Uint8Array(sig)) bin += String.fromCharCode(b);
  return btoa(bin);
}

let chyb = 0;
const check = (j: string, ok: boolean, d = "") => {
  if (ok) console.log("  ok   " + j);
  else { chyb++; console.log("  PADA " + j + (d ? "  -> " + d : "")); }
};

type Radek = Record<string, unknown>;
function fakeAdmin(selze = false, selzeLookup = false) {
  const zapsane: Radek[] = [];
  let leadUpdate: any = null;
  let rpcCalled: any = null;

  function hasCond(conds: any[], f: string, val?: unknown) {
    return conds.some((c: any) => c.f === f && (val == null || String(c.v) === String(val)));
  }

  function matchEq(r: Radek, field: string, val: unknown): boolean {
    if (field.includes("->>")) {
      const key = field.split("->>")[1].replace(/"/g, "");
      const d = (r.detail ?? {}) as Record<string, unknown>;
      return String(d[key] ?? "") === String(val);
    }
    if (field === "provider_id") return String((r as any).provider_id ?? "") === String(val);
    if (field === "type") return String((r as any).type ?? "") === String(val);
    return true;
  }

  function runMaybe(conds: any[], t: string) {
    if (selze) return Promise.resolve({ error: { message: "boom" }, data: null });
    if (t === "leads") {
      if (selzeLookup) return Promise.resolve({ error: { message: "lookup boom" }, data: null });
      return Promise.resolve({ data: { id: "lead-123" }, error: null });
    }
    if (t === "email_events" && hasCond(conds, "provider_id")) {
      return Promise.resolve({ data: { lead_id: "lead-123", step: 2, type: "sent", detail: { email: "klient@example.com", via: "drip-send" } }, error: null });
    }
    if (t === "email_events" && hasCond(conds, "type", "alert_nesparovano")) {
      return Promise.resolve({ data: null, error: null });
    }
    return Promise.resolve({ data: null, error: null });
  }

  function runDedupArray(conds: any[]) {
    if (selze) return Promise.resolve({ data: [], error: null });
    const out: Radek[] = [];
    for (const r of zapsane) {
      if (conds.every((c: any) => c.kind === "eq" ? matchEq(r, c.f, c.v) : true)) {
        out.push(r); break;
      }
    }
    if (!out.length && zapsane.length) out.push(zapsane[0]);
    return Promise.resolve({ data: out, error: null });
  }

  // Vrací query objekt, který:
  // - podporuje .maybeSingle() pro orig trace dotazy (vrací {data: row | null})
  // - při awaitu (bez .maybeSingle) vrací {data: [...] } pro dedup dotazy
  function makeQuery(t: string) {
    const conds: any[] = [];
    const q: any = {
      eq(f: string, v: unknown) { conds.push({ kind: "eq", f, v }); return q; },
      in(f: string, _arr: unknown[]) { conds.push({ kind: "in", f, v: _arr }); return q; },
      gte(_f: string, _v: unknown) { return q; },
      limit(_n: number) {
        // Vždy vrát objekt s .maybeSingle + současně promise, která resolve na {data: pole}
        const base = {
          maybeSingle() { return runMaybe(conds, t); },
        };
        const p = (async () => {
          if (t === "email_events") {
            if (selze) return { data: [] };
            // Pro dedup: vracíme první zapsaný (testy spoléhají na to, že po prvním insertu je dup)
            if (hasCond(conds, "provider_id") || hasCond(conds, "detail->>sns_message_id") || hasCond(conds, "type", "delivered")) {
              return { data: zapsane.length ? [zapsane[0]] : [] };
            }
          }
          return { data: [] };
        })();
        // Zkopíruj .maybeSingle na promise-like objekt
        (p as any).maybeSingle = base.maybeSingle;
        return p;
      },
    };
    return q;
  }

  return {
    zapsane,
    get leadUpdate() { return leadUpdate; },
    get rpcCalled() { return rpcCalled; },
    from(t: string) {
      return {
        select(_s: string) {
          return makeQuery(t);
        },
        insert(r: Radek) {
          zapsane.push(r);
          return Promise.resolve(selze ? { error: { message: "boom" } } : { error: null });
        },
        update(u: any) {
          leadUpdate = u;
          return { eq(_id: string, _val: string) { return Promise.resolve({ error: null }); } };
        },
      };
    },
    rpc(name: string, args: any) {
      rpcCalled = { name, args };
      return Promise.resolve({ error: null });
    },
  };
}

const puvodniFetch = globalThis.fetch;

function podvrhniFetchForCert(certBody: string, calls: string[]) {
  globalThis.fetch = (async (u: string | URL | Request, _i?: RequestInit) => {
    const url = String(u);
    calls.push(url);
    if (url.includes(".pem") || url.includes("SigningCert")) {
      return new Response(certBody, { status: 200, headers: { "content-type": "application/x-pem-file" } });
    }
    if (url.includes("SubscribeURL")) {
      return new Response("OK", { status: 200 });
    }
    return new Response("{}", { status: 200 });
  }) as typeof fetch;
}

function resetFetch() {
  globalThis.fetch = puvodniFetch;
}

async function makeSignedMsg(typ: string, inner: any, opts: { old?: boolean; topic?: string; sigVer?: "1" | "2"; badSig?: boolean } = {}) {
  const now = new Date();
  if (opts.old) now.setHours(now.getHours() - 2);
  const ts = now.toISOString();
  const topic = opts.topic || "arn:aws:sns:eu-central-1:123:mb-mailing";
  const msgId = "sns-msg-" + Math.random().toString(36).slice(2);
  const ver = opts.sigVer || "2";
  const base: any = {
    Type: typ,
    MessageId: msgId,
    TopicArn: topic,
    Timestamp: ts,
    SignatureVersion: ver,
    SigningCertURL: "https://sns.eu-central-1.amazonaws.com/SimpleNotificationService-123" + ver + ".pem",
    Signature: "",
    Message: typ === "Notification" ? JSON.stringify(inner) : undefined,
    SubscribeURL: typ === "SubscriptionConfirmation" ? "https://sns.eu-central-1.amazonaws.com/?Action=ConfirmSubscription&TopicArn=" + encodeURIComponent(topic) + "&Token=tok123" : undefined,
    Token: typ.includes("Confirmation") ? "tok123" : undefined,
  };
  if (typ === "Notification" && !base.Message) base.Message = JSON.stringify(inner);
  // Subject jen když je
  if (inner && inner.Subject) base.Subject = inner.Subject;

  const s2s = buildStringToSign(base);
  // Musí podepsat stejným hashem, jaký verze vyžaduje (core: 1=SHA-1, 2=SHA-256)
  const hash = ver === "1" ? "SHA-1" : "SHA-256";
  const key = await importPkcs8ForSign(keyPem, hash);
  const goodSig = await signStringToSign(s2s, key);
  base.Signature = opts.badSig ? "BAD" + goodSig : goodSig;
  return { body: JSON.stringify(base), msgId, s2s };
}

function clearCertCache() {
  // @ts-ignore test only
  if (__certCacheForTests && typeof __certCacheForTests.clear === "function") __certCacheForTests.clear();
}

{
  // 1) chybějící SES_SNS_TOPIC_ARN
  const admin = fakeAdmin();
  const res = await handleSns("POST", "{}", { admin, fetch: fetch, now: () => new Date(), env: (_k) => "" });
  check("1 missing SES_SNS_TOPIC_ARN = 503", res.status === 503 && res.body.error === "not_configured");
}

{
  // 2) cizí topic = 403
  const admin = fakeAdmin();
  const res = await handleSns("POST", JSON.stringify({ TopicArn: "arn:evil:topic" }), {
    admin, fetch: fetch, now: () => new Date(), env: (k) => k === "SES_SNS_TOPIC_ARN" ? "arn:aws:sns:eu-central-1:123:mb-mailing" : "",
  });
  check("2 foreign topic = 403", res.status === 403 && res.body.error === "forbidden_topic");
}

{
  // 3) špatný podpis = 401
  const admin = fakeAdmin();
  const { body } = await makeSignedMsg("Notification", { eventType: "Delivery", mail: { messageId: "m1" } }, { badSig: true });
  const res = await handleSns("POST", body, {
    admin, fetch: fetch, now: () => new Date(), env: (k) => k === "SES_SNS_TOPIC_ARN" ? "arn:aws:sns:eu-central-1:123:mb-mailing" : "",
  });
  check("3 bad signature = 401", res.status === 401 && res.body.error === "bad_signature");
}

{
  // 4) cert URL mimo amazonaws: fetch se nevolá
  const admin = fakeAdmin();
  const calls: string[] = [];
  globalThis.fetch = ((u: any) => { calls.push(String(u)); return Promise.resolve(new Response("")); }) as any;
  const badUrls = [
    "https://sns.evil.com/x.pem",
    "https://sns.us-east-1.amazonaws.com.evil.com/x.pem",
    "http://sns.eu-central-1.amazonaws.com/x.pem",
  ];
  for (const bad of badUrls) {
    const msg = { Type: "Notification", TopicArn: "arn:aws:sns:eu-central-1:123:mb-mailing", SigningCertURL: bad, SignatureVersion: "2", Signature: "x", Timestamp: new Date().toISOString() };
    const res = await handleSns("POST", JSON.stringify(msg), {
      admin, fetch: globalThis.fetch, now: () => new Date(), env: (k) => k === "SES_SNS_TOPIC_ARN" ? "arn:aws:sns:eu-central-1:123:mb-mailing" : "",
    });
    check(`4 cert URL outside (${bad.split("/")[2]}) = 401`, res.status === 401);
  }
  check("4 fetch not called for bad cert urls", calls.length === 0);
  resetFetch();
}

{
  // 5) SignatureVersion 1 i 2 projde (podepíšeme oba)
  {
    clearCertCache();
    const admin = fakeAdmin();
    const { body } = await makeSignedMsg("Notification", { eventType: "Delivery", mail: { messageId: "m1" } }, { sigVer: "1" });
    const calls: string[] = [];
    podvrhniFetchForCert(certPem, calls);
    const res = await handleSns("POST", body, {
      admin, fetch: globalThis.fetch, now: () => new Date(), env: (k) => k === "SES_SNS_TOPIC_ARN" ? "arn:aws:sns:eu-central-1:123:mb-mailing" : "",
    });
    check("5 SignatureVersion 1 passes", res.status === 200 && res.body.type === "delivered");
    resetFetch();
  }
  {
    clearCertCache();
    const admin = fakeAdmin();
    const { body } = await makeSignedMsg("Notification", { eventType: "Delivery", mail: { messageId: "m2" } }, { sigVer: "2" });
    const calls: string[] = [];
    podvrhniFetchForCert(certPem, calls);
    const res = await handleSns("POST", body, {
      admin, fetch: globalThis.fetch, now: () => new Date(), env: (k) => k === "SES_SNS_TOPIC_ARN" ? "arn:aws:sns:eu-central-1:123:mb-mailing" : "",
    });
    check("5 SignatureVersion 2 passes", res.status === 200 && res.body.type === "delivered");
    resetFetch();
  }
}

{
  // 6) stará zpráva (>1h) = 401
  const admin = fakeAdmin();
  const { body } = await makeSignedMsg("Notification", { eventType: "Delivery", mail: { messageId: "old" } }, { old: true });
  const calls: string[] = [];
  podvrhniFetchForCert(certPem, calls);
  const res = await handleSns("POST", body, {
    admin, fetch: globalThis.fetch, now: () => new Date(), env: (k) => k === "SES_SNS_TOPIC_ARN" ? "arn:aws:sns:eu-central-1:123:mb-mailing" : "",
  });
  check("6 old message (>1h) = 401", res.status === 401 && res.body.error === "replay");
  resetFetch();
}

{
  // 7) SubscriptionConfirmation zavolá GET na SubscribeURL
  const admin = fakeAdmin();
  const calls: string[] = [];
  podvrhniFetchForCert(certPem, calls);
  const subBody = JSON.stringify({
    Type: "SubscriptionConfirmation",
    TopicArn: "arn:aws:sns:eu-central-1:123:mb-mailing",
    SubscribeURL: "https://sns.eu-central-1.amazonaws.com/?Action=ConfirmSubscription&TopicArn=arn%3Aaws%3Asns%3Aeu-central-1%3A123%3Amb-mailing&Token=tok123",
    Timestamp: new Date().toISOString(),
    SignatureVersion: "2",
    SigningCertURL: "https://sns.eu-central-1.amazonaws.com/SimpleNotificationService-123.pem",
    Signature: "",
    Token: "tok123",
  });
  // Podepíšeme
  const baseForSign = JSON.parse(subBody);
  const s2s = buildStringToSign(baseForSign);
  const key = await importPkcs8ForSign(keyPem);
  baseForSign.Signature = await signStringToSign(s2s, key);
  const res = await handleSns("POST", JSON.stringify(baseForSign), {
    admin, fetch: globalThis.fetch, now: () => new Date(), env: (k) => k === "SES_SNS_TOPIC_ARN" ? "arn:aws:sns:eu-central-1:123:mb-mailing" : "",
  });
  check("7 SubscriptionConfirmation returns 200", res.status === 200);
  // SubscribeURL byl v calls
  const calledSub = calls.some((c) => c.includes("ConfirmSubscription"));
  check("7 GET on SubscribeURL was called", calledSub);
  resetFetch();
}

{
  // 8) Permanent bounce spárovaný přes provider_id zmrazí lead
  const admin = fakeAdmin();
  const { body } = await makeSignedMsg("Notification", {
    eventType: "Bounce",
    mail: { messageId: "mid-perm" },
    bounce: { bounceType: "Permanent", bounceSubType: "General", bouncedRecipients: [{ emailAddress: "klient@example.com" }] },
  });
  const calls: string[] = [];
  podvrhniFetchForCert(certPem, calls);
  const res = await handleSns("POST", body, {
    admin, fetch: globalThis.fetch, now: () => new Date(), env: (k) => k === "SES_SNS_TOPIC_ARN" ? "arn:aws:sns:eu-central-1:123:mb-mailing" : "",
  });
  check("8 Permanent bounce status 200", res.status === 200);
  check("8 lead updated to bounced", !!admin.leadUpdate && admin.leadUpdate.status === "bounced");
  resetFetch();
}

{
  // 9) Transient bounce lead nezmrazí
  const admin = fakeAdmin();
  const { body } = await makeSignedMsg("Notification", {
    eventType: "Bounce",
    mail: { messageId: "mid-trans" },
    bounce: { bounceType: "Transient", bounceSubType: "MailboxFull", bouncedRecipients: [{ emailAddress: "klient@example.com" }] },
  });
  const calls: string[] = [];
  podvrhniFetchForCert(certPem, calls);
  const res = await handleSns("POST", body, {
    admin, fetch: globalThis.fetch, now: () => new Date(), env: (k) => k === "SES_SNS_TOPIC_ARN" ? "arn:aws:sns:eu-central-1:123:mb-mailing" : "",
  });
  check("9 Transient bounce 200, no freeze", res.status === 200 && !admin.leadUpdate);
  // Detail má prechodny: true
  const ev = admin.zapsane.find((r: any) => r.type === "bounce");
  check("9 transient written with prechodny:true", ev && (ev.detail as any).prechodny === true);
  resetFetch();
}

{
  // 10) Complaint volá odhlas_a_odstran
  const admin = fakeAdmin();
  const { body } = await makeSignedMsg("Notification", {
    eventType: "Complaint",
    mail: { messageId: "mid-comp" },
    complaint: { complainedRecipients: [{ emailAddress: "klient@example.com" }] },
  });
  const calls: string[] = [];
  podvrhniFetchForCert(certPem, calls);
  const res = await handleSns("POST", body, {
    admin, fetch: globalThis.fetch, now: () => new Date(), env: (k) => k === "SES_SNS_TOPIC_ARN" ? "arn:aws:sns:eu-central-1:123:mb-mailing" : "",
  });
  check("10 Complaint 200", res.status === 200);
  check("10 odhlas_a_odstran called", admin.rpcCalled && admin.rpcCalled.name === "odhlas_a_odstran");
  resetFetch();
}

{
  // 11) bounce s adresou, která nesedí se stopou (BCC kopie) nezmrazí a dá adresa_nesedi
  const admin = fakeAdmin();
  const { body } = await makeSignedMsg("Notification", {
    eventType: "Bounce",
    mail: { messageId: "mid-bcc" },
    bounce: { bounceType: "Permanent", bounceSubType: "General", bouncedRecipients: [{ emailAddress: "martin@martinbarna.cz" }] },
  });
  const calls: string[] = [];
  podvrhniFetchForCert(certPem, calls);
  const res = await handleSns("POST", body, {
    admin, fetch: globalThis.fetch, now: () => new Date(), env: (k) => k === "SES_SNS_TOPIC_ARN" ? "arn:aws:sns:eu-central-1:123:mb-mailing" : "",
  });
  check("11 BCC bounce 200, no freeze", res.status === 200 && !admin.leadUpdate);
  const ev = admin.zapsane.find((r: any) => r.type === "bounce");
  check("11 sparovano_podle=adresa_nesedi", ev && (ev.detail as any).sparovano_podle === "adresa_nesedi");
  resetFetch();
}

{
  // 12) Martinova adresa (přes jeMartinovaAdresa)
  const admin = fakeAdmin();
  const { body } = await makeSignedMsg("Notification", {
    eventType: "Bounce",
    mail: { messageId: "mid-martin" },
    bounce: { bounceType: "Permanent", bounceSubType: "General", bouncedRecipients: [{ emailAddress: "fitness.barna+test@gmail.com" }] },
  });
  const calls: string[] = [];
  podvrhniFetchForCert(certPem, calls);
  const res = await handleSns("POST", body, {
    admin, fetch: globalThis.fetch, now: () => new Date(), env: (k) => k === "SES_SNS_TOPIC_ARN" ? "arn:aws:sns:eu-central-1:123:mb-mailing" : "",
  });
  check("12 Martin address bounce 200, no lead freeze", res.status === 200 && !admin.leadUpdate);
  resetFetch();
}

{
  // 13) nespárovaný Permanent bounce zapíše alert_nesparovano
  // Jednoduchý admin, který pro email_events vrací null orig (nesparovano) a zapisuje.
  const zapsane: any[] = [];
  const admin2: any = {
    zapsane,
    from(t: string) {
      if (t === "email_events") {
        return {
          select() {
            return {
              eq() { return this; },
              in() { return this; },
              gte() { return this; },
              limit() {
                return {
                  maybeSingle() { return Promise.resolve({ data: null, error: null }); },
                };
              },
            };
          },
          insert(r: any) {
            zapsane.push(r);
            return Promise.resolve({ error: null });
          },
        };
      }
      if (t === "leads") {
        return {
          select() {
            return {
              eq() { return this; },
              limit() {
                return { maybeSingle() { return Promise.resolve({ data: null, error: null }); } };
              },
            };
          },
        };
      }
      return { insert() { return Promise.resolve({ error: null }); } };
    },
  };
  const { body } = await makeSignedMsg("Notification", {
    eventType: "Bounce",
    mail: { messageId: "mid-unmatched" },
    bounce: { bounceType: "Permanent", bounceSubType: "General", bouncedRecipients: [{ emailAddress: "neznamy@evil.com" }] },
  });
  const calls: string[] = [];
  podvrhniFetchForCert(certPem, calls);
  const res = await handleSns("POST", body, {
    admin: admin2, fetch: globalThis.fetch, now: () => new Date(), env: (k) => k === "SES_SNS_TOPIC_ARN" ? "arn:aws:sns:eu-central-1:123:mb-mailing" : "",
  });
  check("13 unmatched Permanent writes alert_nesparovano", zapsane.some((r: any) => r.type === "alert_nesparovano"));
  resetFetch();
}

{
  // 14) Delivery dedup přes provider_id
  const admin = fakeAdmin();
  const { body } = await makeSignedMsg("Notification", { eventType: "Delivery", mail: { messageId: "mid-del" } });
  const calls: string[] = [];
  podvrhniFetchForCert(certPem, calls);
  const res = await handleSns("POST", body, {
    admin, fetch: globalThis.fetch, now: () => new Date(), env: (k) => k === "SES_SNS_TOPIC_ARN" ? "arn:aws:sns:eu-central-1:123:mb-mailing" : "",
  });
  check("14 delivered first ok", res.status === 200);
  // Druhý pokus = dedup
  const res2 = await handleSns("POST", body, {
    admin, fetch: globalThis.fetch, now: () => new Date(), env: (k) => k === "SES_SNS_TOPIC_ARN" ? "arn:aws:sns:eu-central-1:123:mb-mailing" : "",
  });
  check("14 second delivered = dedup 200", res2.status === 200 && res2.body.dedup === true);
  resetFetch();
}

{
  // 15) SNS retry stejného MessageId = dedup (přes sns_message_id)
  const admin = fakeAdmin();
  const { body } = await makeSignedMsg("Notification", {
    eventType: "Bounce",
    mail: { messageId: "mid-retry" },
    bounce: { bounceType: "Permanent", bounceSubType: "General", bouncedRecipients: [{ emailAddress: "klient@example.com" }] },
  });
  const calls: string[] = [];
  podvrhniFetchForCert(certPem, calls);
  const res = await handleSns("POST", body, {
    admin, fetch: globalThis.fetch, now: () => new Date(), env: (k) => k === "SES_SNS_TOPIC_ARN" ? "arn:aws:sns:eu-central-1:123:mb-mailing" : "",
  });
  check("15 first retry write", res.status === 200);
  // Stejný SNS MessageId znovu (tělo obsahuje stejný MessageId nahoře)
  const res2 = await handleSns("POST", body, {
    admin, fetch: globalThis.fetch, now: () => new Date(), env: (k) => k === "SES_SNS_TOPIC_ARN" ? "arn:aws:sns:eu-central-1:123:mb-mailing" : "",
  });
  check("15 SNS retry same MessageId = dedup", res2.status === 200 && res2.body.dedup === true);
  resetFetch();
}

{
  // 16) chyba čtení stopy u bounce = 500, u delivery = 200
  const admin = fakeAdmin(true); // selze při čtení orig
  const { body: b1 } = await makeSignedMsg("Notification", {
    eventType: "Bounce",
    mail: { messageId: "mid-err-b" },
    bounce: { bounceType: "Permanent", bounceSubType: "General", bouncedRecipients: [{ emailAddress: "klient@example.com" }] },
  });
  const calls: string[] = [];
  podvrhniFetchForCert(certPem, calls);
  const resB = await handleSns("POST", b1, {
    admin, fetch: globalThis.fetch, now: () => new Date(), env: (k) => k === "SES_SNS_TOPIC_ARN" ? "arn:aws:sns:eu-central-1:123:mb-mailing" : "",
  });
  check("16 bounce with trace read error = 500", resB.status === 500);

  const adminD = fakeAdmin(true);
  const { body: b2 } = await makeSignedMsg("Notification", { eventType: "Delivery", mail: { messageId: "mid-err-d" } });
  const resD = await handleSns("POST", b2, {
    admin: adminD, fetch: globalThis.fetch, now: () => new Date(), env: (k) => k === "SES_SNS_TOPIC_ARN" ? "arn:aws:sns:eu-central-1:123:mb-mailing" : "",
  });
  check("16 delivery with trace read error = 200 (not fail-closed)", resD.status === 200);
  resetFetch();
}

{
  // 17) [27. 10. 2026, revize] chybejici Timestamp = 401, i kdyz je podpis platny.
  //     Puvodni verze kontrolu stari pri chybejicim Timestamp preskocila.
  const admin = fakeAdmin();
  const { body } = await makeSignedMsg("Notification", {
    eventType: "Bounce",
    mail: { messageId: "mid-bez-ts" },
    bounce: { bounceType: "Permanent", bouncedRecipients: [{ emailAddress: "klient@example.com" }] },
  });
  const m = JSON.parse(body);
  delete m.Timestamp;
  m.Signature = await signStringToSign(buildStringToSign(m), await importPkcs8ForSign(keyPem, "SHA-256"));
  const calls: string[] = [];
  podvrhniFetchForCert(certPem, calls);
  const res = await handleSns("POST", JSON.stringify(m), {
    admin, fetch: globalThis.fetch, now: () => new Date(), env: (k) => k === "SES_SNS_TOPIC_ARN" ? "arn:aws:sns:eu-central-1:123:mb-mailing" : "",
  });
  check("17 chybejici Timestamp = 401", res.status === 401 && res.body.error === "replay", JSON.stringify(res));
  resetFetch();
}

console.log(chyb === 0 ? "\nVSE ZELENE" : `\nPADLO ${chyb} kontrol`);
if (chyb > 0) Deno.exit(1);
