// Test celeho handleru milestones BEZ site a BEZ databaze (31. 10. 2026).
// Deno.serve se zachyti, fetch na Supabase jde do pametove napodobeniny PostgRESTu a GoTrue,
// fetch na Resend do pocitadla. Overuje jednotnou branu odhlaseni (`_shared/mailing-guard.ts`)
// a cteni pres TICHY strop PostgRESTu (max_rows): useknuty obraz by poslal gratulaci znovu,
// podhodnotil postup nebo vynechal odhlasovaci odkaz.
// Spusteni (z teto slozky): deno test --no-lock --allow-env handler_test.ts
// Bezi i v CI (.github/workflows/ci.yml, krok `deno test` nad celou slozkou functions).
import { assert, assertEquals } from "jsr:@std/assert@1";
// Staticky import pripravi graf modulu supabase-js (dynamicky import niz by jinak selhal na npm zavislostech).
import "jsr:@supabase/supabase-js@2";

const SUPA = "https://mock.supabase.test";
const SECRET = "drip-secret-for-tests-0123456789";
Deno.env.set("SUPABASE_URL", SUPA);
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "service-role-key-for-tests-0123456789");
Deno.env.set("RESEND_API_KEY", "re_test_key");
Deno.env.delete("MAIL_PROVIDER");
Deno.env.delete("MAIL_TRACK_SECRET");

type Row = Record<string, unknown>;
const db: Record<string, Row[]> = {};
let users: Row[] = [];
// PostgREST max_rows: TICHY strop radku na jeden dotaz (Supabase vychozi 1000), .limit() ho neprebije.
let serverMaxRows = 1000;
// GoTrue: kolik uzivatelu pusti na jednu stranku nejvys (strop serveru, i kdyz se chce vic).
let serverMaxUsers = 1000;
const failTables = new Set<string>();
// Selze jen pokracovaci stranka (offset > 0) dane tabulky.
let failPageTable: string | null = null;
const resendCalls: { to: string; subject: string; headers: Record<string, string> | undefined }[] = [];

function reset() {
  db.app_config = [{ key: "drip_invoke_secret", value: SECRET }];
  db.email_templates = [30, 50, 100].map((step) => ({
    track: "milestone-videokurz", step, key: "ms-" + step,
    subject: "Milnik " + step + "{{fn_suffix}}", preheader: "Gratulace", blocks: [{ t: "p", html: "Mas za sebou " + step + " %." }],
  }));
  for (const t of ["progress", "entitlements", "milestone_sent", "leads", "odhlaseni_trvale", "mail_skip_log", "email_events"]) db[t] = [];
  users = [];
  serverMaxRows = 1000;
  serverMaxUsers = 1000;
  failTables.clear();
  failPageTable = null;
  resendCalls.length = 0;
}

// ⛔ Sanitizer casovacu vypnuty ZAMERNE: kazdy `createClient` v handleru spusti setInterval
//    z @supabase/auth-js (_startAutoRefresh), ktery test neuklidi. Asserty to neovlivni;
//    CI kvuli temuz pousti en-mailing/handler_test.ts s preloadem bez sanitizeru.
const test = (name: string, fn: () => Promise<void>) =>
  Deno.test({ name, fn, sanitizeOps: false, sanitizeResources: false });

const resp = (status: number, body?: unknown, headers: Record<string, string> = {}) =>
  new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...headers } });

// Porovnani jako v Postgresu: cisla ciselne, text po znacich (u ASCII totez co kolace C).
const cmp = (a: unknown, b: unknown) =>
  typeof a === "number" ? a - Number(b) : String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0;
const escRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** LIKE/ILIKE vzor -> RegExp. `\` escapuje dalsi znak, `%` = cokoli, `_` = jeden znak. */
function likeRe(vzor: string, ci: boolean): RegExp {
  let re = "";
  for (let i = 0; i < vzor.length; i++) {
    const c = vzor[i];
    if (c === "\\" && i + 1 < vzor.length) re += escRe(vzor[++i]);
    else if (c === "%" || c === "*") re += ".*";
    else if (c === "_") re += ".";
    else re += escRe(c);
  }
  return new RegExp("^" + re + "$", ci ? "i" : "");
}
/** Jedna podminka `op.hodnota` nad hodnotou sloupce (jen operatory, ktere funkce pouziva). */
function plati(v: unknown, cond: string): boolean {
  const tecka = cond.indexOf(".");
  const op = cond.slice(0, tecka), val = cond.slice(tecka + 1);
  if (op === "eq") return String(v) === val;
  if (op === "gt") return v !== null && v !== undefined && cmp(v, val) > 0;
  if (op === "is") return val === "null" ? v === null || v === undefined : String(v) === val;
  if (op === "like") return likeRe(val, false).test(String(v ?? ""));
  if (op === "ilike") return likeRe(val, true).test(String(v ?? ""));
  if (op === "in") return val.replace(/^\(|\)$/g, "").split(",").map((x) => x.replace(/^"|"$/g, "")).includes(String(v));
  throw new Error("mock: neznamy operator " + cond);
}
const VYHRAZENE = new Set(["select", "order", "limit", "offset", "or", "on_conflict", "columns"]);
function vyhovuje(r: Row, u: URL): boolean {
  for (const [k, v] of u.searchParams) {
    if (VYHRAZENE.has(k)) continue;
    if (!plati(r[k], v)) return false;
  }
  const or = u.searchParams.get("or");
  if (or) {
    const casti = or.replace(/^\(|\)$/g, "").split(",");
    if (!casti.some((c) => { const t = c.indexOf("."); return plati(r[c.slice(0, t)], c.slice(t + 1)); })) return false;
  }
  return true;
}

async function mockPostgrest(req: Request): Promise<Response> {
  const u = new URL(req.url);
  const table = u.pathname.replace("/rest/v1/", "");
  const rows = db[table];
  if (!rows) return resp(404, { code: "42P01", message: "no table " + table });
  if (req.method === "GET") {
    // 500, ne 503: na 503 by postgrest-js sam opakoval a test by jen cekal.
    if (failTables.has(table)) return resp(500, { code: "XX000", message: "down" });
    if (table === failPageTable && Number(u.searchParams.get("offset") ?? 0) > 0) return resp(500, { code: "XX000", message: "down" });
    let out = rows.filter((r) => vyhovuje(r, u));
    const order = u.searchParams.get("order");
    if (order) {
      const klice = order.split(",").map((o) => o.split("."));
      out = [...out].sort((a, b) => {
        for (const [col, dir] of klice) {
          const c = cmp(a[col], b[col]);
          if (c) return dir === "desc" ? -c : c;
        }
        return 0;
      });
    }
    const offset = Number(u.searchParams.get("offset") ?? 0);
    const limit = u.searchParams.has("limit") ? Number(u.searchParams.get("limit")) : Infinity;
    out = out.slice(offset, offset + Math.min(limit, serverMaxRows));
    if ((req.headers.get("Accept") ?? "").includes("vnd.pgrst.object")) {
      return out.length === 1 ? resp(200, out[0]) : resp(406, { code: "PGRST116", message: "rows " + out.length });
    }
    return resp(200, out);
  }
  if (req.method === "POST") {
    const body = await req.json();
    for (const b of (Array.isArray(body) ? body : [body]) as Row[]) {
      if (table === "milestone_sent" && rows.some((r) => r.email === b.email && r.product === b.product && r.milestone === b.milestone)) {
        return resp(409, { code: "23505", message: "duplicate key value violates unique constraint \"milestone_sent_pkey\"" });
      }
      rows.push({ ...b });
    }
    return resp(201, null);
  }
  return resp(405, {});
}

globalThis.fetch = async (input: Request | URL | string, init?: RequestInit) => {
  const req = new Request(input, init);
  if (req.url.startsWith(SUPA + "/rest/v1/")) return mockPostgrest(req);
  if (req.url.startsWith(SUPA + "/auth/v1/admin/users")) {
    // Jako GoTrue: offset = (page - 1) * per_page, za posledni strankou prazdny seznam.
    const q = new URL(req.url).searchParams;
    const page = Number(q.get("page") || 1), per = Math.min(Number(q.get("per_page") || 50), serverMaxUsers);
    return resp(200, { users: users.slice((page - 1) * per, page * per) });
  }
  // Cenik appky (`_shared/ceny.ts`): sablony testu zadnou cenu nemaji, staci prazdny cenik.
  if (req.url.startsWith("https://kfkmghvhqwqtsalqjmrp.supabase.co/rest/v1/pricing_plans")) return resp(200, []);
  if (req.url === "https://api.resend.com/emails") {
    const b = await req.json();
    resendCalls.push({ to: b.to[0], subject: b.subject, headers: b.headers });
    return resp(200, { id: "re_" + resendCalls.length });
  }
  throw new Error("unexpected fetch " + req.url);
};

let captured: ((r: Request) => Promise<Response>) | null = null;
// deno-lint-ignore no-explicit-any
(Deno as any).serve = (h: (r: Request) => Promise<Response>) => { captured = h; return { finished: Promise.resolve(), shutdown() {} }; };
await import("./index.ts");
const handler = captured!;

const call = async () => {
  const r = await handler(new Request("https://fn.test/milestones", {
    method: "POST",
    headers: { "x-drip-secret": SECRET, "Content-Type": "application/json" },
    body: "{}",
  }));
  return { status: r.status, j: await r.json() };
};

/** Clen s platnym videokurzem, leadem a `hotovo` dokoncenymi lekcemi videokurzu. */
function clen(email: string, uid: string, hotovo: number, lead: { id?: string; status?: string; token?: string } = {}) {
  users.push({ id: uid, email, user_metadata: { full_name: "Jana Testova" } });
  db.entitlements.push({ email, product: "videokurz", active: true, expires_at: null });
  if (lead.status !== undefined || lead.id || lead.token) {
    db.leads.push({ id: lead.id ?? "f0000000-0000-0000-0000-000000000001", email, status: lead.status ?? "active", unsubscribe_token: lead.token ?? "11111111-2222-3333-4444-555555555555" });
  }
  for (let i = 1; i <= hotovo; i++) db.progress.push({ user_id: uid, lesson_id: "vk-" + String(i).padStart(3, "0"), completed: true });
}
const JANA = "jana@example.com";
const JANA_ID = "a0000000-0000-0000-0000-000000000001";

test("clen nad 30 %: gratulace odejde s odhlasovacim odkazem a milnik se zapise", async () => {
  reset();
  clen(JANA, JANA_ID, 60, { status: "active", token: "11111111-2222-3333-4444-555555555555" });
  const { status, j } = await call();
  assertEquals(status, 200);
  assertEquals(j.sends, 1);
  assertEquals(resendCalls.map((c) => c.to), [JANA]);
  assert(resendCalls[0].subject.startsWith("Milnik 30"));
  assertEquals(resendCalls[0].headers?.["List-Unsubscribe"], "<" + SUPA + "/functions/v1/unsubscribe?token=11111111-2222-3333-4444-555555555555>");
  assertEquals(db.milestone_sent.map((r) => r.milestone), [30]);
  assertEquals(db.mail_skip_log.length, 0);
});

test("trvale odhlaseny (odhlaseni_trvale) s aktivnim leadem: nic neodejde, skip je v mail_skip_log jen jednou", async () => {
  reset();
  clen(JANA, JANA_ID, 60, { status: "active" });
  db.odhlaseni_trvale.push({ email: "Jana@Example.com" }); // velikost pismen nevadi
  const { status, j } = await call();
  assertEquals(status, 200);
  assertEquals(j.sends, 0);
  assertEquals(resendCalls.length, 0);
  assertEquals(db.mail_skip_log.map((r) => [r.fn, r.mail_class, r.reason]), [["milestones", "marketing", "hard_unsubscribe"]]);
  // V odpovedi neni e-mail odhlaseneho. Milnik je vyrizeny bez mailu, jako prekonany nizsi milnik.
  assertEquals(j.results, [{ milestone: 30, skip: "hard_unsubscribe" }]);
  assertEquals(db.milestone_sent.map((r) => r.milestone), [30]);
  assertEquals(j.marked_skipped, 1);
  // Dalsi denni beh uz tohoto cloveka nevyhodnocuje ani neloguje znovu.
  const druhy = await call();
  assertEquals(druhy.j.results, []);
  assertEquals(resendCalls.length, 0);
  assertEquals(db.mail_skip_log.length, 1);
});

test("trvale odhlaseny bez leadu: taky nic", async () => {
  reset();
  clen(JANA, JANA_ID, 100);
  db.odhlaseni_trvale.push({ email: JANA });
  const { j } = await call();
  assertEquals(j.sends, 0);
  assertEquals(resendCalls.length, 0);
  assertEquals(db.mail_skip_log.map((r) => r.reason), ["hard_unsubscribe"]);
  // 100 lekci = 50 %: vyrizene jsou 30 i 50, at se k cloveku smycka uz nevraci.
  assertEquals(db.milestone_sent.map((r) => r.milestone).sort(), [30, 50]);
});

test("clen bez leada: bez odkazu na odhlaseni gratulace neodejde a nic se nezapisuje", async () => {
  reset();
  clen(JANA, JANA_ID, 60); // zadny radek v leads = neni token na odhlaseni
  const { status, j } = await call();
  assertEquals(status, 200);
  assertEquals(j.sends, 0);
  assertEquals(resendCalls.length, 0);
  assertEquals(j.results, [{ milestone: 30, skip: "bez_odhlaseni" }]);
  assertEquals(db.milestone_sent.length, 0); // az lead vznikne, gratulace prijde
  assertEquals(db.mail_skip_log.length, 0);
});

test("stav odhlaseni nejde precist: nic neodejde (fail-closed) a dalsi beh to zkusi znovu", async () => {
  reset();
  clen(JANA, JANA_ID, 60, { status: "active" });
  failTables.add("odhlaseni_trvale");
  const { j } = await call();
  assertEquals(j.sends, 0);
  assertEquals(resendCalls.length, 0);
  assertEquals(db.mail_skip_log.map((r) => r.reason), ["suppression_load_failed"]);
  assertEquals(db.milestone_sent.length, 0);
  failTables.clear();
  const druhy = await call();
  assertEquals(druhy.j.sends, 1);
  assertEquals(resendCalls.map((c) => c.to), [JANA]);
});

// --- Tichy strop PostgRESTu. Stary kod cetl progress, entitlements a milestone_sent JEDNIM
//     dotazem (server vrati jen prvnich max_rows radku, bez chyby) a leads smyckou, ktera
//     koncila na strance kratsi nez 1000, tedy pri mensim stropu uz po prvni strance. ---

test("tichy strop: postup pres strop se nacte cely a gratulace odejde", async () => {
  reset(); serverMaxRows = 50;
  clen(JANA, JANA_ID, 60, { status: "active" });
  const { j } = await call();
  assertEquals(j.sends, 1); // useknuty postup by byl 50 < 55 a gratulace by neprisla
  assertEquals(resendCalls.map((c) => c.to), [JANA]);
});

test("tichy strop: zapis milniku za stropem se nacte a gratulace se NEOPAKUJE", async () => {
  reset(); serverMaxRows = 60;
  clen(JANA, JANA_ID, 60, { status: "active" });
  // 61 cizich zapisu PRED jana@ (podle e-mailu i podle poradi vlozeni), jana@ az za stropem.
  for (let i = 0; i < 61; i++) db.milestone_sent.push({ email: "a" + String(i).padStart(2, "0") + "@example.com", product: "videokurz", milestone: 30 });
  db.milestone_sent.push({ email: JANA, product: "videokurz", milestone: 30 });
  const { j } = await call();
  assertEquals(j.sends, 0);
  assertEquals(resendCalls.length, 0);
  assertEquals(j.results, []);
});

test("tichy strop: lead za stropem se nacte (odkaz na odhlaseni v mailu, odhlaseny lead tichy skip)", async () => {
  reset(); serverMaxRows = 60;
  for (let i = 0; i < 60; i++) {
    db.leads.push({ id: "e0000000-0000-0000-0000-0000000000" + String(i).padStart(2, "0"), email: "cizi" + i + "@example.com", status: "active", unsubscribe_token: "00000000-0000-0000-0000-000000000000" });
  }
  // jana@ ma lead az za prvnimi 60 radky
  clen(JANA, JANA_ID, 60, { id: "f0000000-0000-0000-0000-000000000001", status: "active", token: "99999999-2222-3333-4444-555555555555" });
  const { j } = await call();
  assertEquals(j.sends, 1);
  // Bez celeho `leads` by gratulace (s prodejnim blokem) odesla BEZ odkazu na odhlaseni.
  assertEquals(resendCalls[0].headers?.["List-Unsubscribe"], "<" + SUPA + "/functions/v1/unsubscribe?token=99999999-2222-3333-4444-555555555555>");

  // Odhlaseny lead za stropem: tichy skip uz z `leads.status` (brana se ani nepta, nic se neloguje).
  reset(); serverMaxRows = 60;
  for (let i = 0; i < 60; i++) {
    db.leads.push({ id: "e0000000-0000-0000-0000-0000000000" + String(i).padStart(2, "0"), email: "cizi" + i + "@example.com", status: "active", unsubscribe_token: "00000000-0000-0000-0000-000000000000" });
  }
  clen(JANA, JANA_ID, 60, { id: "f0000000-0000-0000-0000-000000000001", status: "unsubscribed" });
  const druhy = await call();
  assertEquals(druhy.j.sends, 0);
  assertEquals(resendCalls.length, 0);
  assertEquals(db.mail_skip_log.length, 0);
});

test("chyba az na druhe strance = 500 a nic neodejde", async () => {
  reset(); serverMaxRows = 50;
  clen(JANA, JANA_ID, 60, { status: "active" });
  failPageTable = "progress";
  const { status, j } = await call();
  assertEquals(status, 500);
  assertEquals(j.kde, "progress");
  assertEquals(resendCalls.length, 0);
  assertEquals(db.milestone_sent.length, 0);
});

// --- Posun stranek: radek nebo uzivatel, ktery prijde dvakrat, nesmi poslat mail navic. ---

test("tentyz radek postupu dvakrat (posun offsetu) neprida lekci: 54 lekci zustane pod 30 %", async () => {
  reset();
  clen(JANA, JANA_ID, 54, { status: "active" });
  db.progress.push({ user_id: JANA_ID, lesson_id: "vk-001", completed: true }); // duplicita na hranici stranky
  const { j } = await call();
  assertEquals(j.sends, 0); // radek po radku by to bylo 55 = 30 % a gratulace by odesla o lekci driv
  assertEquals(resendCalls.length, 0);
});

test("uzivatele po strankach: server pusti mene, nez se chce, a clen za prvni strankou mail dostane jednou", async () => {
  reset(); serverMaxUsers = 1;
  users.push({ id: "b0000000-0000-0000-0000-000000000009", email: "cizi@example.com", user_metadata: {} });
  clen(JANA, JANA_ID, 60, { status: "active" });
  users.push({ ...users[1] }); // tentyz uzivatel znovu (posun stranky pri soubezne registraci)
  const { status, j } = await call();
  assertEquals(status, 200);
  // Stary kod skoncil po prvni strance, protoze byla kratsi nez 1000, a jana@ by mail nedostala.
  assertEquals(resendCalls.map((c) => c.to), [JANA]);
  assertEquals(j.sends, 1);
  assertEquals(db.milestone_sent.map((r) => r.milestone), [30]);
});
