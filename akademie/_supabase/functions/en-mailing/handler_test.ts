// Test celých handlerů en-mailing a en-unsubscribe BEZ sítě a BEZ databáze:
// Deno.serve se zachytí, fetch na Supabase jde do paměťové napodobeniny PostgRESTu,
// fetch na Resend do počítadla. Ověřuje pořadí razítko -> Resend, vypínač, test řádky, odhlášení.
// Spuštění (z této složky): deno test --no-lock --allow-env handler_test.ts
import { assert, assertEquals } from "jsr:@std/assert@1";
import { deriveUnsubKey, unsubToken } from "./logic.ts";
// Statický import připraví graf modulů supabase-js (dynamický import níž by jinak selhal na npm závislostech).
import "jsr:@supabase/supabase-js@2";

const SUPA = "https://mock.supabase.test";
const SVC = "service-role-key-for-tests-0123456789";
Deno.env.set("SUPABASE_URL", SUPA);
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", SVC);
Deno.env.set("EN_MAILING_SECRET", "cron-secret-0123456789");
Deno.env.set("RESEND_API_KEY", "re_test_key");
Deno.env.delete("EN_UNSUB_SECRET");

type Row = Record<string, unknown>;
const db: Record<string, Row[]> = {};
const events: string[] = [];
let resendFail = false;
let failConfigRead = false;
const conflictEmails = new Set<string>();
const resendCalls: { to: string; subject: string; headers: Record<string, string>; reply_to: string; text: string }[] = [];
let nextId = 1;

function reset() {
  db.en_mailing_config = [{ id: true, enabled: false }];
  db.en_leads = [];
  db.en_mail_log = [];
  db.en_unsubscribes = [];
  events.length = 0;
  resendCalls.length = 0;
  resendFail = false;
  failConfigRead = false;
  conflictEmails.clear();
}

const resp = (status: number, body?: unknown, headers: Record<string, string> = {}) =>
  new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...headers } });

function eqFilters(u: URL): [string, string][] {
  const out: [string, string][] = [];
  for (const [k, v] of u.searchParams) if (v.startsWith("eq.")) out.push([k, v.slice(3)]);
  return out;
}
const matches = (r: Row, f: [string, string][]) => f.every(([k, v]) => String(r[k]) === v);

async function mockPostgrest(req: Request): Promise<Response> {
  const u = new URL(req.url);
  const table = u.pathname.replace("/rest/v1/", "");
  const rows = db[table];
  if (!rows) return resp(404, { code: "42P01", message: "no table " + table });
  const single = (req.headers.get("Accept") ?? "").includes("vnd.pgrst.object");
  const f = eqFilters(u);
  if (req.method === "GET") {
    if (table === "en_mailing_config" && failConfigRead) return resp(503, { code: "PGRST000", message: "down" });
    const out = rows.filter((r) => matches(r, f));
    if (single) return out.length === 1 ? resp(200, out[0]) : resp(406, { code: "PGRST116", message: "rows " + out.length });
    return resp(200, out);
  }
  if (req.method === "POST") {
    const body = await req.json();
    const list: Row[] = Array.isArray(body) ? body : [body];
    const created: Row[] = [];
    for (const b of list) {
      if (table === "en_mail_log") {
        events.push(`stamp:${b.lead_email}:${b.step}`);
        if (conflictEmails.has(String(b.lead_email)) || rows.some((r) => r.lead_email === b.lead_email && r.step === b.step)) {
          return resp(409, { code: "23505", message: "duplicate key value violates unique constraint" });
        }
        const r = { id: nextId++, sent_at: new Date().toISOString(), ...b };
        rows.push(r);
        created.push(r);
      } else if (table === "en_unsubscribes") {
        if (!rows.some((r) => r.email === b.email)) { rows.push({ ...b }); created.push(b); }
      }
    }
    if (single) return resp(201, created[0]);
    return resp(201, created);
  }
  if (req.method === "PATCH") {
    const body = await req.json();
    for (const r of rows.filter((r) => matches(r, f))) Object.assign(r, body);
    return resp(204);
  }
  return resp(405, {});
}

const realFetch = globalThis.fetch;
globalThis.fetch = async (input: Request | URL | string, init?: RequestInit) => {
  const req = new Request(input, init);
  if (req.url.startsWith(SUPA + "/rest/v1/")) return mockPostgrest(req);
  if (req.url === "https://api.resend.com/emails") {
    const b = await req.json();
    events.push(`resend:${b.to[0]}`);
    resendCalls.push({ to: b.to[0], subject: b.subject, headers: b.headers, reply_to: b.reply_to, text: b.text });
    if (resendFail) return resp(500, { message: "boom" });
    return resp(200, { id: "re_" + resendCalls.length });
  }
  throw new Error("unexpected fetch " + req.url);
};
void realFetch;

// Zachycení Deno.serve při importu obou funkcí.
let captured: ((r: Request) => Promise<Response>) | null = null;
// deno-lint-ignore no-explicit-any
(Deno as any).serve = (h: (r: Request) => Promise<Response>) => { captured = h; return { finished: Promise.resolve(), shutdown() {} }; };
await import("./index.ts");
const mailing = captured!;
captured = null;
await import("../en-unsubscribe/index.ts");
const unsub = captured!;

const call = (body: unknown = {}, secret = "cron-secret-0123456789", method = "POST") =>
  mailing(new Request("https://fn.test/en-mailing", {
    method,
    headers: { "x-cron-secret": secret, "Content-Type": "application/json" },
    body: method === "POST" ? JSON.stringify(body) : undefined,
  }));

const now = () => new Date().toISOString();
function seedLeads() {
  db.en_leads.push(
    { id: "11111111-0000-0000-0000-000000000001", created_at: now(), kind: "kit", first_name: "Anna", email: "anna@example.com", consent: true, calc: { kcal: 2000, protein_g: 150 } },
    { id: "11111111-0000-0000-0000-000000000002", created_at: now(), kind: "workout", first_name: "TEST-CLAUDE", email: "smoke@example.com", consent: true, calc: null },
    { id: "11111111-0000-0000-0000-000000000003", created_at: now(), kind: "application", first_name: "Pat", email: "pat@example.com", consent: true, calc: null },
    { id: "11111111-0000-0000-0000-000000000004", created_at: now(), kind: "calculator", first_name: "Gone", email: "gone@example.com", consent: true, calc: null },
  );
  db.en_unsubscribes.push({ email: "gone@example.com" });
}

Deno.test("metoda a secret: GET 405, špatný secret 401, nic se nečte", async () => {
  reset();
  assertEquals((await call({}, "x", "GET")).status, 405);
  assertEquals((await call({}, "spatny-secret-0123456789")).status, 401);
  assertEquals(resendCalls.length, 0);
});

Deno.test("vypnuto: jen náhled, žádné razítko, žádný mail, test řádek v náhledu je", async () => {
  reset(); seedLeads();
  const r = await call({});
  const j = await r.json();
  assertEquals(r.status, 200);
  assertEquals(j.mode, "dry");
  assertEquals(j.enabled, false);
  assertEquals(j.items.map((i: Row) => i.lead_id).sort(), ["11111111-0000-0000-0000-000000000001", "11111111-0000-0000-0000-000000000002"]);
  assertEquals(j.skipped, { no_series_lead: 1, unsubscribed: 1 });
  assert(!JSON.stringify(j).includes("anna@example.com"), "náhled nesmí nést celý e-mail");
  assertEquals(db.en_mail_log.length, 0);
  assertEquals(resendCalls.length, 0);
});

Deno.test("chyba čtení vypínače = 500 a nic", async () => {
  reset(); seedLeads(); db.en_mailing_config[0].enabled = true; failConfigRead = true;
  assertEquals((await call({})).status, 500);
  assertEquals(resendCalls.length, 0);
  assertEquals(db.en_mail_log.length, 0);
});

Deno.test("zapnuto: razítko PŘED Resendem, jen skutečný lead, odhlašovací hlavičky, druhý běh nic", async () => {
  reset(); seedLeads(); db.en_mailing_config[0].enabled = true;
  const j = await (await call({})).json();
  assertEquals(j.mode, "live");
  assertEquals(j.sent, 1);
  assertEquals(j.skipped.test_live, 1);
  assertEquals(events, ["stamp:anna@example.com:1", "resend:anna@example.com"]);
  assertEquals(db.en_mail_log.length, 1);
  assertEquals(db.en_mail_log[0].status, "sent");
  assertEquals(db.en_mail_log[0].provider_id, "re_1");
  const c = resendCalls[0];
  assertEquals(c.reply_to, "martin@martinbarna.cz");
  assertEquals(c.headers["List-Unsubscribe-Post"], "List-Unsubscribe=One-Click");
  assert(c.headers["List-Unsubscribe"].startsWith("<" + SUPA + "/functions/v1/en-unsubscribe?e=anna%40example.com&t="));
  assert(c.text.includes("2,000 kcal a day"));
  assert(c.text.includes("https://martinbarna.cz/en/unsubscribe/?e=anna%40example.com&t="));
  // hned další běh: krok 2 ještě není na řadě, nic neodejde
  const j2 = await (await call({})).json();
  assertEquals(j2.sent, 0);
  assertEquals(resendCalls.length, 1);
});

Deno.test("dry_run při zapnutém vypínači: nic se neposílá", async () => {
  reset(); seedLeads(); db.en_mailing_config[0].enabled = true;
  const j = await (await call({ dry_run: true })).json();
  assertEquals(j.mode, "dry");
  assertEquals(resendCalls.length, 0);
  assertEquals(db.en_mail_log.length, 0);
});

Deno.test("souběžný běh (23505): mail se NEPOŠLE", async () => {
  reset(); seedLeads(); db.en_mailing_config[0].enabled = true; conflictEmails.add("anna@example.com");
  const j = await (await call({})).json();
  assertEquals(j.conflicts, 1);
  assertEquals(j.sent, 0);
  assertEquals(resendCalls.length, 0);
});

Deno.test("Resend selže: status failed, žádné opakování ve stejném ani dalším běhu", async () => {
  reset(); seedLeads(); db.en_mailing_config[0].enabled = true; resendFail = true;
  const j = await (await call({})).json();
  assertEquals(j.failed, 1);
  assertEquals(db.en_mail_log[0].status, "failed");
  assertEquals(resendCalls.length, 1);
  resendFail = false;
  await call({});
  assertEquals(resendCalls.length, 1);
  assertEquals(db.en_mail_log.length, 1);
});

Deno.test("test_step: jen na fitness.barna@gmail.com, nic se nezapisuje, i při vypnutém vypínači", async () => {
  reset(); seedLeads();
  const r = await call({ test_step: 1, test_no_calc: true });
  assertEquals(r.status, 200);
  assertEquals(resendCalls.length, 1);
  assertEquals(resendCalls[0].to, "fitness.barna@gmail.com");
  assert(resendCalls[0].subject.startsWith("[TEST] "));
  assertEquals(db.en_mail_log.length, 0);
  assertEquals((await call({ test_step: 9 })).status, 400);
});

Deno.test("en-unsubscribe: GET jen přesměruje, POST se špatným tokenem 400, správný zapíše jednou", async () => {
  reset();
  const key = await deriveUnsubKey(SVC);
  const t = await unsubToken("anna@example.com", key);
  const g = await unsub(new Request(`https://fn.test/en-unsubscribe?e=anna%40example.com&t=${t}`));
  assertEquals(g.status, 302);
  assertEquals(g.headers.get("Location"), `https://martinbarna.cz/en/unsubscribe/?e=anna%40example.com&t=${t}`);
  assertEquals(db.en_unsubscribes.length, 0);
  const bad = await unsub(new Request(`https://fn.test/en-unsubscribe?e=eve%40example.com&t=${t}`, { method: "POST" }));
  assertEquals(bad.status, 400);
  assertEquals(db.en_unsubscribes.length, 0);
  const ok = await unsub(new Request(`https://fn.test/en-unsubscribe?e=Anna%40Example.com&t=${t}`, { method: "POST", body: "List-Unsubscribe=One-Click" }));
  assertEquals(ok.status, 200);
  assertEquals((await ok.json()).ok, true);
  const again = await unsub(new Request(`https://fn.test/en-unsubscribe?e=anna%40example.com&t=${t}`, { method: "POST" }));
  assertEquals(again.status, 200);
  assertEquals(db.en_unsubscribes.map((r) => r.email), ["anna@example.com"]);
});

Deno.test("po odhlášení přes odkaz už další mail neodejde", async () => {
  reset(); seedLeads(); db.en_mailing_config[0].enabled = true;
  const key = await deriveUnsubKey(SVC);
  const t = await unsubToken("anna@example.com", key);
  await unsub(new Request(`https://fn.test/en-unsubscribe?e=anna%40example.com&t=${t}`, { method: "POST" }));
  const j = await (await call({})).json();
  assertEquals(j.sent, 0);
  assertEquals(j.skipped.unsubscribed, 2);
  assertEquals(resendCalls.length, 0);
});
