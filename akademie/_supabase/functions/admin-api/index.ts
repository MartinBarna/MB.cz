// Barna Academy admin-api (CRM/mailing dashboard backend). Manual JWT + admin allowlist auth.
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const low = (s: unknown) => String(s ?? "").trim().toLowerCase();

// ---- GA4 Data API (service account) --------------------------------------
// Podepiseme JWT privatnim klicem service accountu -> vymenime za access token -> runReport.
// deno-lint-ignore-file no-explicit-any
function b64urlBytes(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64urlStr(str: string): string {
  return btoa(unescape(encodeURIComponent(str))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
async function gaAccessToken(sa: any): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const tokenUri = String(sa.token_uri || "https://oauth2.googleapis.com/token");
  const header = b64urlStr(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64urlStr(JSON.stringify({
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/analytics.readonly",
    aud: tokenUri,
    iat: now,
    exp: now + 3600,
  }));
  const unsigned = header + "." + claim;
  const pemBody = String(sa.private_key || "").replace(/-----[A-Z ]+-----/g, "").replace(/\s+/g, "");
  const der = Uint8Array.from(atob(pemBody), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey(
    "pkcs8", der.buffer, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"],
  );
  const sig = new Uint8Array(await crypto.subtle.sign({ name: "RSASSA-PKCS1-v1_5" }, key, new TextEncoder().encode(unsigned)));
  const jwt = unsigned + "." + b64urlBytes(sig);
  const resp = await fetch(tokenUri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwt }),
  });
  const d = await resp.json().catch(() => ({}));
  return String(d.access_token || "");
}
async function gaBatch(token: string, property: string, requests: any[]): Promise<any[]> {
  const resp = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${property}:batchRunReports`,
    {
      method: "POST",
      headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
      body: JSON.stringify({ requests }),
    },
  );
  const d = await resp.json().catch(() => ({}));
  return Array.isArray(d.reports) ? d.reports : [];
}
function gaAgg(report: any): number[] {
  const mv = report?.rows?.[0]?.metricValues ?? [];
  return mv.map((m: any) => Number(m.value) || 0);
}
function gaKV(report: any): { k: string; v: number }[] {
  return (report?.rows ?? []).map((r: any) => ({
    k: String(r.dimensionValues?.[0]?.value ?? ""),
    v: Number(r.metricValues?.[0]?.value) || 0,
  }));
}
function gaPages(report: any): { path: string; views: number }[] {
  return (report?.rows ?? []).map((r: any) => ({
    path: String(r.dimensionValues?.[0]?.value ?? ""),
    views: Number(r.metricValues?.[0]?.value) || 0,
  }));
}

// ---- DRIP render (stejna logika jako drip-send: subject + blocks -> html/text) ----
const NL = String.fromCharCode(10);
const DQ = String.fromCharCode(34);
const SITE = "https://martinbarna.cz";
const COURSE_URL = "https://form.simpleshop.cz/3Vbl/buy/";
const FREE_LESSONS_URL = "https://www.martinbarna.cz/videokurz#zdarma";
const COURSE_PRICE = 800;
const DISCOUNT_CODE = "ZACNI15";
const DISCOUNT_PCT = 15;
const DISCOUNT2_CODE = "JESTE20";
const DISCOUNT2_PCT = 20;

type Seg = "zeny" | "muzi" | "other";
const isFem = (seg: Seg) => seg === "zeny";
const normSeg = (s: unknown): Seg => (s === "zeny" || s === "muzi" ? s : "other");
const escd = (s: string) => s.split("&").join("&amp;").split("<").join("&lt;").split(">").join("&gt;").split(DQ).join("&quot;");

function gender(s: string, seg: Seg): string {
  let out = "", i = 0;
  while (true) {
    const a = s.indexOf("[[", i);
    if (a < 0) { out += s.slice(i); break; }
    out += s.slice(i, a);
    const sep = s.indexOf("||", a + 2);
    const end = sep < 0 ? -1 : s.indexOf("]]", sep + 2);
    // neuzavreny token: nech ho v textu (hasToken ho nahlasi), zadna nekonecna smycka
    if (sep < 0 || end < 0) { out += s.slice(a); break; }
    out += isFem(seg) ? s.slice(a + 2, sep) : s.slice(sep + 2, end);
    i = end + 2;
  }
  return out.split("[a]").join(isFem(seg) ? "a" : "");
}
function mergeVars(s: string, vars: Record<string, string>): string {
  let out = "", i = 0;
  while (true) {
    const a = s.indexOf("{{", i);
    if (a < 0) { out += s.slice(i); break; }
    out += s.slice(i, a);
    const end = s.indexOf("}}", a + 2);
    if (end < 0) { out += s.slice(a); break; } // neuzavreny token -> hasToken
    const key = s.slice(a + 2, end);
    out += key in vars ? vars[key] : "{{" + key + "}}";
    i = end + 2;
  }
  return out;
}
const fill = (s: string, seg: Seg, v: Record<string, string>) => mergeVars(gender(s, seg), v);
const hasToken = (s: string) => s.includes("{{") || s.includes("[[") || s.includes("]]") || s.includes("[a]");

function inlineToText(s: string): string {
  s = s.split("<br>").join(NL).split("<br/>").join(NL).split("<br />").join(NL);
  while (true) {
    const a = s.indexOf("<a ");
    if (a < 0) break;
    const h = s.indexOf("href=", a);
    let href = "";
    if (h >= 0) { const q = s[h + 5]; const st = h + 6; href = s.slice(st, s.indexOf(q, st)); }
    const gt = s.indexOf(">", a);
    const endA = s.indexOf("</a>", gt);
    s = s.slice(0, a) + s.slice(gt + 1, endA) + (href ? " (" + href + ")" : "") + s.slice(endA + 4);
  }
  let out = "", inTag = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === "<") inTag = true; else if (ch === ">") inTag = false; else if (!inTag) out += ch;
  }
  return out.split("&amp;").join("&").split("&lt;").join("<").split("&gt;").join(">").split("&quot;").join(DQ);
}

type Block = { t: "p"; html: string } | { t: "bullets"; items: string[] } | { t: "btn"; text: string; href: string } | { t: "ps"; html: string };

function renderHtml(blocks: Block[], seg: Seg, v: Record<string, string>): string {
  return blocks.map((b) => {
    if (b.t === "p") return `<p style='margin:0 0 14px'>${fill(b.html, seg, v)}</p>`;
    if (b.t === "ps") return `<p style='margin:16px 0 0;color:#666;font-style:italic'>${fill(b.html, seg, v)}</p>`;
    if (b.t === "bullets")
      return `<ul style='margin:0 0 14px;padding-left:20px'>` +
        b.items.map((li) => `<li style='margin:0 0 7px'>${fill(li, seg, v)}</li>`).join("") + `</ul>`;
    return `<p style='margin:4px 0 18px'><a href='${fill(b.href, seg, v)}' style='display:inline-block;background:#ff7a00;color:#161616;text-decoration:none;padding:13px 24px;border-radius:50px;font-weight:700'>${escd(fill(b.text, seg, v))}</a></p>`;
  }).join(NL);
}
function renderText(blocks: Block[], seg: Seg, v: Record<string, string>): string {
  return blocks.map((b) => {
    if (b.t === "bullets") return b.items.map((li) => "- " + inlineToText(fill(li, seg, v))).join(NL);
    if (b.t === "btn") return fill(b.text, seg, v) + ": " + fill(b.href, seg, v);
    return inlineToText(fill(b.html, seg, v));
  }).join(NL + NL);
}
function wrapHtml(preheader: string, bodyHtml: string, footerHtml: string): string {
  return `<!doctype html><html lang='cs'><head><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'></head>` +
    `<body style='margin:0;background:#f4f4f5;padding:16px'>` +
    `<span style='display:none!important;opacity:0;color:transparent;height:0;width:0;overflow:hidden'>${escd(preheader)}</span>` +
    `<div style='font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;font-size:16px;line-height:1.55;color:#222;max-width:560px;margin:0 auto;background:#fff;border-radius:14px;padding:28px'>` +
    bodyHtml +
    `<hr style='border:none;border-top:1px solid #eee;margin:22px 0 14px'>` +
    `<div style='font-size:12px;line-height:1.5;color:#999'>${footerHtml}</div></div></body></html>`;
}
// ===== 5. pad (vokativ) — kanonicka verze, drz v synci s drip-send =====
const VOK_EXC: Record<string, string> = {
  "jan": "Jene", "pavel": "Pavle", "karel": "Karle", "havel": "Havle", "pavol": "Pavle",
  "zdenek": "Zdenku", "zdeněk": "Zdeňku", "zbynek": "Zbynku", "zbyněk": "Zbyňku",
  "josef": "Josefe", "luboš": "Luboši", "lubos": "Luboši", "bartoloměj": "Bartoloměji",
  "vavřinec": "Vavřinče", "vavrinec": "Vavrinče", "němec": "Němče",
};
const MALE_NAMES = new Set<string>([
  "martin","david","tomáš","tomas","lukáš","lukas","petr","jakub","ondřej","ondrej","marek","michal","michael",
  "filip","vojtěch","vojtech","patrik","patrick","radek","roman","adam","matěj","matej","štěpán","stepan","vít","vit",
  "václav","vaclav","jaroslav","miroslav","stanislav","ladislav","bohuslav","bronislav","rostislav","přemysl","premysl",
  "bohumil","kamil","emil","dalibor","otakar","richard","robert","norbert","albert","rudolf","adolf","oldřich","oldrich",
  "bedřich","bedrich","jindřich","jindrich","vladimír","vladimir","dušan","dusan","milan","alois","ivan","igor","marcel",
  "daniel","gabriel","samuel","dominik","erik","viktor","hynek","čeněk","cenek","kristián","kristian","sebastián","sebastian",
  "maxmilián","maximilián","maximilian","kryštof","krystof","tobiáš","tobias","matyáš","matyas","mikuláš","mikulas","šimon","simon",
  "damián","damian","fabián","fabian","julián","julian","benedikt","arnošt","arnost","evžen","evzen","augustin","antonín","antonin",
  "valentýn","valentyn","radim","vilém","vilem","radovan","miloslav","svatopluk","vratislav","zbyšek","zbysek","aleš","ales",
  "denis","dennis","nikolas","kevin","leon","vlastimil","radomír","radomir","lumír","lumir","ctibor","branislav","jáchym","jachym",
  "kašpar","kaspar","melichar","řehoř","rehor","florián","florian","teodor","theodor","nikolaj","boris",
  "radoslav","miloš","milos","bořek","borek","vladan","hubert","herbert","gustav","ferdinand","leopold","konrád","konrad",
  "arnold","zikmund","matouš","matous","kilián","kilian","mojmír","mojmir",
]);
const FEMALE_NAMES = new Set<string>([
  "ester","dagmar","miriam","karin","karyn","nikol","ingrid","rút","rut","judit","edit","ráchel","rachel",
  "dolores","doris","agnes","mercedes","karmen","carmen","sarah","deborah","abigail","gwen","lilian","vivien",
  "kristin","kristýn","katrin","madlen","jennifer","žaneta",
]);
const VOK_VOWELS = "aeiouyáéěíóúůý";
const isMaleName = (low: string) => (low in VOK_EXC) || MALE_NAMES.has(low);
function vokativ(fn: string, seg: string): string {
  if (!fn) return fn;
  const low = fn.toLowerCase();
  const last = low.slice(-1);
  if (last === "a") return fn.slice(0, -1) + "o";
  if (VOK_VOWELS.includes(last)) return fn;
  if (FEMALE_NAMES.has(low)) return fn;
  if (seg === "zeny" && !isMaleName(low)) return fn;
  if (low in VOK_EXC) return VOK_EXC[low];
  if (low.endsWith("ek")) return fn.slice(0, -2) + "ku";
  if (low.endsWith("ch") || "kgh".includes(last)) return fn + "u";
  if ("szxj".includes(last) || "šžčř".includes(last)) return fn + "i";
  if (low.endsWith("el")) return fn + "i";
  if (last === "r") {
    return VOK_VOWELS.includes(low.slice(-2, -1)) ? fn + "e" : fn.slice(0, -1) + "ře";
  }
  if ("bdflmnptvw".includes(last)) return fn + "e";
  return fn;
}
function buildVars(name: string, seg: Seg, unsub: string, email = "vzorek@example.cz"): Record<string, string> {
  // STEJNA sada tokenu jako drip-send/index.ts buildVars — kdyz tam pribude token, doplnit i sem!
  const parts = (name || "").trim().split(" ").filter((x) => x.length > 0);
  const t = parts[0] || "";
  const fn = vokativ(t ? t.charAt(0).toUpperCase() + t.slice(1) : "", seg);
  const dprice = Math.round(COURSE_PRICE * (1 - DISCOUNT_PCT / 100));
  const d2price = Math.round(COURSE_PRICE * (1 - DISCOUNT2_PCT / 100));
  return {
    first_name: fn, fn_space: fn ? " " + fn : "", fn_suffix: fn ? ", " + fn : "", fn_prefix: fn ? fn + ", " : "",
    lead_magnet_url: seg === "muzi" ? SITE + "/download/forma-zpet-muzi.pdf" : SITE + "/download/makro-plan-zeny.pdf",
    plan_page_url: seg === "muzi" ? SITE + "/forma-zpet" : SITE + "/makro-plan",
    course_url: COURSE_URL, free_lessons_url: FREE_LESSONS_URL,
    course_price: String(COURSE_PRICE), discount_pct: String(DISCOUNT_PCT),
    discount_price: String(dprice), discount_code: DISCOUNT_CODE,
    discount2_pct: String(DISCOUNT2_PCT), discount2_price: String(d2price), discount2_code: DISCOUNT2_CODE,
    email: email, email_url: encodeURIComponent(email),
    unsubscribe_url: unsub,
  };
}
function renderEmailPreview(tpl: { subject: string; preheader: string; blocks: Block[] }, seg: Seg, v: Record<string, string>, footer: { html: string; text: string }) {
  const subject = fill(tpl.subject, seg, v);
  const html = wrapHtml(fill(tpl.preheader, seg, v), renderHtml(tpl.blocks, seg, v), fill(footer.html, seg, v));
  const sep = NL + NL + "----------------------------------------" + NL;
  const text = renderText(tpl.blocks, seg, v) + sep + fill(footer.text, seg, v);
  if (hasToken(subject) || hasToken(html) || hasToken(text)) throw new Error("unresolved_token");
  return { subject, html, text };
}
function extractAttachments(html: string): { name: string; url: string }[] {
  const out: { name: string; url: string }[] = [];
  const seen = new Set<string>();
  let i = 0;
  while (true) {
    const a = html.indexOf("<a ", i);
    if (a < 0) break;
    const gt = html.indexOf(">", a);
    const endA = html.indexOf("</a>", gt);
    if (gt < 0 || endA < 0) break;
    const tag = html.slice(a, gt);
    const m = tag.match(/href=(['"])(.*?)\1/);
    const href = m ? m[2] : "";
    const text = html.slice(gt + 1, endA).replace(/<[^>]+>/g, "").trim();
    if (href && /(\.pdf($|\?)|\/download\/)/i.test(href) && !seen.has(href)) {
      seen.add(href);
      out.push({ name: text || href.split("/").pop() || href, url: href });
    }
    i = endA + 4;
  }
  return out;
}

// auth.admin.listUsers je strankovane — jedna stranka (1000) by nad 1000 uctu tise orezavala data
async function listAllUsers(admin: ReturnType<typeof createClient>) {
  const users: { id: string; email?: string; last_sign_in_at?: string }[] = [];
  for (let page = 1; page <= 10; page++) {
    const { data } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    const batch = data?.users ?? [];
    users.push(...batch as typeof users);
    if (batch.length < 1000) break;
  }
  return users;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method" }, 405);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

  const authHeader = req.headers.get("Authorization") || "";
  const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
  const { data: ures } = await userClient.auth.getUser();
  const me = low(ures?.user?.email);
  const cfg = await admin.from("app_config").select("value").eq("key", "admin_emails").maybeSingle();
  const adminList = String(cfg.data?.value || "fitness.barna@gmail.com").split(",").map((s) => low(s)).filter(Boolean);
  if (!me || !adminList.includes(me)) return json({ error: "forbidden" }, 403);

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const action = String(body.action || "");

  try {
    if (action === "overview" || action === "stats") {
      const [cc, lds, ents, evs, allUsers] = await Promise.all([
        admin.from("customer_contacts").select("email,name,tags,status,audience,onboarding_sent_at"),
        admin.from("leads").select("id,email,name,segment,source,track,step,status,next_send_at"),
        admin.from("entitlements").select("email,product,active"),
        admin.from("email_events").select("lead_id,type,created_at").not("lead_id", "is", null),
        listAllUsers(admin),
      ]);
      const leadById = new Map<string, string>();
      const map = new Map<string, Record<string, unknown>>();
      const get = (email: string) => {
        const k = low(email);
        if (!map.has(k)) map.set(k, { email: k, name: "", tags: [], segment: "", sources: [], has_academy: false, has_videokurz: false, registered: false, last_sign_in: null, sent_count: 0, last_sent_at: null, opened_count: 0, lead_track: null, lead_step: null, lead_status: null, contact_status: null, onboarding_sent_at: null });
        return map.get(k)!;
      };
      for (const c of cc.data ?? []) {
        const r = get(c.email); r.name = r.name || c.name || ""; r.tags = c.tags || []; r.contact_status = c.status; r.onboarding_sent_at = c.onboarding_sent_at;
        (r.sources as string[]).push("contact");
      }
      for (const l of lds.data ?? []) {
        leadById.set(String(l.id), low(l.email));
        const r = get(l.email); r.name = r.name || l.name || ""; r.segment = l.segment || r.segment; r.lead_track = l.track; r.lead_step = l.step; r.lead_status = l.status;
        (r.sources as string[]).push("lead:" + (l.source || "?"));
      }
      for (const e of ents.data ?? []) {
        const r = get(e.email);
        if (e.product === "academy" && e.active) r.has_academy = true;
        if (e.product === "videokurz" && e.active) r.has_videokurz = true;
      }
      for (const u of allUsers) {
        const k = low(u.email); if (!k) continue;
        const r = get(k); r.registered = true; r.last_sign_in = u.last_sign_in_at ?? null;
      }
      for (const ev of evs.data ?? []) {
        const email = leadById.get(String(ev.lead_id)); if (!email) continue;
        const r = get(email);
        if (ev.type === "sent") { r.sent_count = (r.sent_count as number) + 1; if (!r.last_sent_at || ev.created_at > (r.last_sent_at as string)) r.last_sent_at = ev.created_at; }
        if (ev.type === "open") r.opened_count = (r.opened_count as number) + 1;
      }
      const rows = [...map.values()].sort((a, b) => String((b.last_sent_at as string) || "").localeCompare(String((a.last_sent_at as string) || "")));
      if (action === "stats") {
        return json({
          ok: true,
          contacts: rows.length,
          academy: rows.filter((r) => r.has_academy).length,
          videokurz: rows.filter((r) => r.has_videokurz).length,
          registered: rows.filter((r) => r.registered).length,
          coaching: rows.filter((r) => (r.tags as string[]).some((t) => String(t).indexOf("coaching") === 0)).length,
          sent_total: rows.reduce((n, r) => n + (r.sent_count as number), 0),
        });
      }
      return json({ ok: true, rows });
    }

    if (action === "contact") {
      const email = low(body.email);
      if (!email) return json({ error: "no_email" }, 400);
      const [cc, lds, ents] = await Promise.all([
        admin.from("customer_contacts").select("*").eq("email", email).maybeSingle(),
        admin.from("leads").select("id,email,name,segment,source,track,step,status,next_send_at,created_at").eq("email", email),
        admin.from("entitlements").select("product,active,source,granted_at").eq("email", email),
      ]);
      const leadIds = (lds.data ?? []).map((l) => l.id);
      let timeline: unknown[] = [];
      if (leadIds.length) {
        const ev = await admin.from("email_events").select("type,step,provider_id,detail,created_at").in("lead_id", leadIds).order("created_at", { ascending: false }).limit(200);
        timeline = ev.data ?? [];
      }
      let usage: unknown[] = [];
      try { const u = await admin.from("usage_events").select("path,dwell_ms,created_at").eq("email", email).order("created_at", { ascending: false }).limit(100); usage = u.data ?? []; } catch { /* phase 2 */ }
      return json({ ok: true, contact: cc.data, leads: lds.data, entitlements: ents.data, timeline, usage });
    }

    if (action === "set_access") {
      const email = low(body.email); const product = String(body.product); const active = !!body.active;
      if (!email || !["academy", "videokurz"].includes(product)) return json({ error: "bad_args" }, 400);
      const { error } = await admin.from("entitlements").upsert({ email, product, active, source: "admin-panel", granted_at: new Date().toISOString() }, { onConflict: "email,product" });
      if (error) return json({ error: error.message }, 500);
      // Academy pristup zrcadli i appku Tvuj Coach: grant kdyz active, revoke kdyz odebiras. Best-effort + log.
      if (product === "academy") {
        try {
          const { data: gs } = await admin.from("app_config").select("value").eq("key", "academy_grant_secret").maybeSingle();
          const gsec = gs?.value ? String(gs.value) : "";
          const act = active ? "grant" : "revoke";
          let gres = "no-secret";
          if (gsec) {
            const r = await fetch("https://kfkmghvhqwqtsalqjmrp.functions.supabase.co/academy-grant", {
              method: "POST", headers: { "Content-Type": "application/json", "x-academy-secret": gsec },
              body: JSON.stringify({ email, action: act, tier: "diamond", source: "admin-panel" }),
            }).catch(() => null);
            // deno-lint-ignore no-explicit-any
            if (r && r.ok) { const jj: any = await r.json().catch(() => ({})); gres = String(jj.result || "ok"); }
            else gres = r ? "http-" + r.status : "fetch-fail";
          }
          await admin.from("tvujcoach_grants").insert({ email, action: act, result: gres, source: "admin-panel" });
        } catch { /* best-effort */ }
      }
      return json({ ok: true });
    }

    // Prehled udeleni pristupu do appky Tvuj Coach (kdo/kdy/vysledek) — pro admin sekci.
    if (action === "tvujcoach_grants") {
      const { data, error } = await admin.from("tvujcoach_grants").select("email,action,result,source,created_at").order("created_at", { ascending: false }).limit(200);
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true, grants: data ?? [] });
    }

    if (action === "set_tag") {
      const email = low(body.email); const tag = String(body.tag || "").trim(); const op = String(body.op || "add");
      if (!email || !tag) return json({ error: "bad_args" }, 400);
      const cur = await admin.from("customer_contacts").select("tags").eq("email", email).maybeSingle();
      let tags: string[] = (cur.data?.tags as string[]) || [];
      if (op === "add" && !tags.includes(tag)) tags.push(tag);
      if (op === "remove") tags = tags.filter((t) => t !== tag);
      const up = await admin.from("customer_contacts").upsert({ email, tags, updated_at: new Date().toISOString() }, { onConflict: "email" });
      if (up.error) return json({ error: up.error.message }, 500);
      return json({ ok: true, tags });
    }

    if (action === "unsubscribe") {
      const email = low(body.email);
      if (!email) return json({ error: "no_email" }, 400);
      await admin.from("leads").update({ status: "unsubscribed", next_send_at: null, updated_at: new Date().toISOString() }).eq("email", email);
      return json({ ok: true });
    }

    if (action === "lead_update") {
      // Ovlivneni mailingu z adminu: pauza / pokracovat (i re-subscribe) / preradit do jine sekvence.
      const email = low(body.email); const op = String(body.op || "");
      if (!email) return json({ error: "no_email" }, 400);
      const { data: lead } = await admin.from("leads").select("id,email,track,step,status,next_send_at").eq("email", email).maybeSingle();
      if (!lead) return json({ error: "no_lead" }, 404);
      const nowIso = new Date().toISOString();
      if (op === "pause") {
        if (lead.status !== "active") return json({ error: "not_active", status: lead.status }, 400);
        // next_send_at zustava — resume pak vi, ze sekvence jeste nedobehla
        const { error } = await admin.from("leads").update({ status: "paused", updated_at: nowIso }).eq("id", lead.id);
        if (error) return json({ error: error.message }, 500);
        return json({ ok: true, status: "paused" });
      }
      if (op === "resume") {
        // pokracuje krokem, na kterem lead skoncil; posle nejblizsi hodinovy cron.
        // Funguje i jako re-subscribe (unsubscribed/purchased) — POUZIVAT JEN na vyslovnou zadost cloveka!
        if (lead.status === "active") return json({ error: "already_active" }, 400);
        // bounced adresa je nedorucitelna — obnoveni by skodilo reputaci domeny
        if (lead.status === "bounced") return json({ error: "bounced_address" }, 400);
        const next = lead.next_send_at ? nowIso : null; // null = sekvence uz dobehla, jen zapne stav
        const { error } = await admin.from("leads").update({ status: "active", next_send_at: next, updated_at: nowIso }).eq("id", lead.id);
        if (error) return json({ error: error.message }, 500);
        return json({ ok: true, status: "active", next_send_at: next });
      }
      if (op === "retrack") {
        // preradi do jine sekvence od kroku 0; dedupe drip-sendu je per-track, takze projde cela.
        const track = String(body.track || "");
        const { data: tpl } = await admin.from("email_templates").select("track").eq("track", track).eq("step", 0).maybeSingle();
        if (!tpl) return json({ error: "unknown_track" }, 400);
        const { error } = await admin.from("leads").update({ track, step: 0, status: "active", next_send_at: nowIso, updated_at: nowIso }).eq("id", lead.id);
        if (error) return json({ error: error.message }, 500);
        return json({ ok: true, track, step: 0 });
      }
      return json({ error: "bad_op" }, 400);
    }

    if (action === "tracks") {
      // seznam sekvenci pro dropdowny v adminu (z email_templates = zdroj pravdy)
      const { data } = await admin.from("email_templates").select("track,step");
      const m = new Map<string, number>();
      for (const t of data ?? []) m.set(String(t.track), Math.max(m.get(String(t.track)) ?? 0, Number(t.step) + 1));
      const rows = [...m.entries()].map(([track, steps]) => ({ track, steps })).sort((a, b) => a.track.localeCompare(b.track));
      return json({ ok: true, rows });
    }

    if (action === "ga_stats") {
      // GA4 Data API pres service account. Kdyz chybi secret -> {ok:false} (frontend ukaze stav nastaveni).
      try {
        const saRaw = Deno.env.get("GA_SA_JSON") || "";
        const property = (Deno.env.get("GA_PROPERTY_ID") || "").replace(/[^0-9]/g, "");
        if (!saRaw || !property) return json({ ok: false });
        let sa: any;
        try { sa = JSON.parse(saRaw); } catch { return json({ ok: false }); }

        const days = Math.min(365, Math.max(1, parseInt(String(body.range ?? "28d"), 10) || 28));
        const dateRanges = [{ startDate: `${days}daysAgo`, endDate: "today" }];

        const token = await gaAccessToken(sa);
        if (!token) return json({ ok: false });

        const reqAgg = { dateRanges, metrics: ["totalUsers", "sessions", "screenPageViews", "newUsers", "bounceRate", "averageSessionDuration"].map((name) => ({ name })) };
        const reqPages = { dateRanges, dimensions: [{ name: "pagePath" }], metrics: [{ name: "screenPageViews" }], orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }], limit: 10 };
        const reqDevices = { dateRanges, dimensions: [{ name: "deviceCategory" }], metrics: [{ name: "sessions" }], orderBys: [{ metric: { metricName: "sessions" }, desc: true }] };
        const reqGender = { dateRanges, dimensions: [{ name: "userGender" }], metrics: [{ name: "totalUsers" }] };
        const reqAge = { dateRanges, dimensions: [{ name: "userAgeBracket" }], metrics: [{ name: "totalUsers" }] };
        const reqCountry = { dateRanges, dimensions: [{ name: "country" }], metrics: [{ name: "totalUsers" }], orderBys: [{ metric: { metricName: "totalUsers" }, desc: true }], limit: 10 };
        const reqSources = { dateRanges, dimensions: [{ name: "sessionDefaultChannelGroup" }], metrics: [{ name: "sessions" }], orderBys: [{ metric: { metricName: "sessions" }, desc: true }] };

        // batchRunReports = max 5 reportu na davku -> 5 + 2
        const [b1, b2] = await Promise.all([
          gaBatch(token, property, [reqAgg, reqPages, reqDevices, reqGender, reqAge]),
          gaBatch(token, property, [reqCountry, reqSources]),
        ]);
        const a = gaAgg(b1[0]);
        const data = {
          users: a[0] ?? 0,
          sessions: a[1] ?? 0,
          pageviews: a[2] ?? 0,
          new_users: a[3] ?? 0,
          bounce_rate: a[4] ?? 0, // GA4 bounceRate je pomer 0..1
          avg_engagement_sec: Math.round(a[5] ?? 0), // averageSessionDuration v sekundach
          pages: gaPages(b1[1]),
          devices: gaKV(b1[2]),
          gender: gaKV(b1[3]),
          age: gaKV(b1[4]),
          countries: gaKV(b2[0]),
          sources: gaKV(b2[1]),
        };
        return json({ ok: true, data });
      } catch {
        return json({ ok: false });
      }
    }

    if (action === "email_log") {
      const limit = Math.min(2000, Math.max(1, Number(body.limit) || 1000));
      const offset = Math.max(0, Number(body.offset) || 0);
      const q = low(body.q);
      const fTrack = body.track ? String(body.track) : "";
      const fType = body.type ? String(body.type) : "";
      const fetchN = q ? 2000 : limit;
      const startAt = q ? 0 : offset;
      let evq = admin.from("email_events")
        .select("lead_id,step,type,provider_id,detail,created_at")
        .order("created_at", { ascending: false });
      if (fType) evq = evq.eq("type", fType);
      if (fTrack) evq = evq.eq("detail->>track", fTrack);
      const { data: evs } = await evq.range(startAt, startAt + fetchN - 1);
      const events = evs ?? [];
      const leadIds = [...new Set(events.map((e) => e.lead_id).filter(Boolean))] as string[];
      const leadMap = new Map<string, { email: string; name: string }>();
      if (leadIds.length) {
        const { data: lds } = await admin.from("leads").select("id,email,name").in("id", leadIds);
        for (const l of lds ?? []) leadMap.set(l.id as string, { email: low(l.email), name: String(l.name || "") });
      }
      const { data: tpls } = await admin.from("email_templates").select("track,step,subject");
      const subjMap = new Map<string, string>();
      for (const t of tpls ?? []) subjMap.set(String(t.track) + ":" + t.step, String(t.subject ?? ""));
      let rows = events.map((e) => {
        const det = (e.detail && typeof e.detail === "object") ? (e.detail as Record<string, unknown>) : {};
        const track = String(det.track ?? "");
        const lead = e.lead_id ? leadMap.get(e.lead_id as string) : null;
        return {
          email: lead?.email ?? (det.email ? low(det.email) : ""),
          name: lead?.name ?? "",
          track,
          step: e.step,
          type: e.type,
          created_at: e.created_at,
          provider_id: e.provider_id ?? "",
          subject: subjMap.get(track + ":" + e.step) ?? "",
        };
      });
      if (q) {
        rows = rows.filter((r) =>
          r.email.includes(q) || r.name.toLowerCase().includes(q) ||
          r.track.toLowerCase().includes(q) || String(r.subject).toLowerCase().includes(q) ||
          String(r.type).toLowerCase().includes(q)
        ).slice(offset, offset + limit);
      }
      return json({ ok: true, rows });
    }

    if (action === "email_preview") {
      const track = String(body.track || "");
      const step = Number(body.step ?? 0);
      const emailArg = low(body.email);
      if (!track) return json({ error: "no_track" }, 400);
      const { data: tplRow } = await admin.from("email_templates")
        .select("subject,preheader,blocks,key").eq("track", track).eq("step", step).maybeSingle();
      if (!tplRow) return json({ ok: false, error: "no_template:" + track + ":" + step });
      const { data: fRows } = await admin.from("app_config").select("key,value").in("key", ["footer_html", "footer_text"]);
      const fMap = Object.fromEntries((fRows ?? []).map((r: { key: string; value: string }) => [r.key, r.value]));
      const footer = { html: fMap.footer_html ?? "", text: fMap.footer_text ?? "" };
      // s emailem: jmeno + segment + unsubscribe daneho leadu; jinak genericky vzorek
      let seg: Seg = "zeny", name = "Jana", unsub = SUPABASE_URL + "/functions/v1/unsubscribe?token=preview-sample";
      if (emailArg) {
        const { data: lead } = await admin.from("leads").select("name,segment,unsubscribe_token").eq("email", emailArg).maybeSingle();
        if (lead) { name = String(lead.name || ""); seg = normSeg(lead.segment); unsub = SUPABASE_URL + "/functions/v1/unsubscribe?token=" + lead.unsubscribe_token; }
      }
      try {
        const v = buildVars(name, seg, unsub);
        const tpl = { subject: String(tplRow.subject ?? ""), preheader: String(tplRow.preheader ?? ""), blocks: (tplRow.blocks as Block[]) ?? [] };
        const m = renderEmailPreview(tpl, seg, v, footer);
        const attachments = extractAttachments(m.html);
        return json({ ok: true, subject: m.subject, html: m.html, text: m.text, attachments });
      } catch (e) {
        return json({ ok: false, error: String(e).slice(0, 200) });
      }
    }

    if (action === "email_summary") {
      // per-track: sent / error / test (z email_events) + pending (aktivni leady s next_send_at v minulosti)
      const nowI = new Date().toISOString();
      const { data: evs } = await admin.from("email_events").select("type,detail");
      const agg = new Map<string, { track: string; sent: number; error: number; test: number; pending: number }>();
      const bump = (track: string, k: "sent" | "error" | "test" | "pending") => {
        if (!agg.has(track)) agg.set(track, { track, sent: 0, error: 0, test: 0, pending: 0 });
        agg.get(track)![k]++;
      };
      for (const e of evs ?? []) {
        const det = (e.detail && typeof e.detail === "object") ? (e.detail as Record<string, unknown>) : {};
        const track = String(det.track ?? "");
        if (e.type === "sent") bump(track, "sent");
        else if (e.type === "error") bump(track, "error");
        else if (e.type === "test") bump(track, "test");
      }
      const { data: pend } = await admin.from("leads").select("track")
        .eq("status", "active").not("next_send_at", "is", null).lt("next_send_at", nowI);
      for (const l of pend ?? []) bump(String(l.track ?? ""), "pending");
      return json({ ok: true, rows: [...agg.values()].sort((a, b) => a.track.localeCompare(b.track)) });
    }

    if (action === "email_scheduled") {
      // nadchazejici odeslani z leads.next_send_at (aktivni, setrideno od nejblizsiho)
      // + filtr dle e-mailu/sekvence a strankovani (offset/limit, vraci total)
      const limit = Math.min(200, Math.max(1, Number(body.limit) || 100));
      const offset = Math.max(0, Number(body.offset) || 0);
      const q = low(body.q);
      const fTrack = body.track ? String(body.track) : "";
      const nowI = new Date().toISOString();
      let lq = admin.from("leads")
        .select("email,name,track,step,next_send_at", { count: "exact" })
        .eq("status", "active").not("next_send_at", "is", null);
      if (q) lq = lq.ilike("email", "%" + q.replace(/[%_*\\]/g, (m) => "\\" + m) + "%");
      if (fTrack) lq = lq.eq("track", fTrack);
      const { data: lds, count } = await lq.order("next_send_at", { ascending: true }).range(offset, offset + limit - 1);
      const { data: tpls } = await admin.from("email_templates").select("track,step,subject");
      const subjMap = new Map<string, string>();
      for (const t of tpls ?? []) subjMap.set(String(t.track) + ":" + t.step, String(t.subject ?? ""));
      const rows = (lds ?? []).map((l) => ({
        email: low(l.email),
        name: String(l.name || ""),
        track: l.track,
        step: l.step,
        next_send_at: l.next_send_at,
        subject: subjMap.get(String(l.track) + ":" + l.step) ?? "",
        overdue: String(l.next_send_at) < nowI,
      }));
      return json({ ok: true, rows, total: count ?? rows.length, offset, limit });
    }

    if (action === "templates_list") {
      // vsechny sablony pro mapu sekvenci (bez blocks — ty tahne template_get)
      const { data } = await admin.from("email_templates").select("track,step,key,subject,preheader,wait_days,updated_at");
      const rows = (data ?? []).map((t) => ({
        track: String(t.track), step: Number(t.step), key: String(t.key ?? ""),
        subject: String(t.subject ?? ""), preheader: String(t.preheader ?? ""),
        wait_days: t.wait_days == null ? null : Number(t.wait_days),
        updated_at: t.updated_at,
      }));
      rows.sort((a, b) => a.track === b.track ? a.step - b.step : a.track.localeCompare(b.track));
      // pocty leadu na tracku pres SQL group-by (zadny 1000-row strop PostgREST)
      const { data: lcounts } = await admin.rpc("admin_leads_by_track");
      const onTrack: Record<string, { active: number; other: number }> = {};
      for (const l of (lcounts ?? []) as { track: string; status: string; n: number }[]) {
        const k = String(l.track ?? "");
        if (!onTrack[k]) onTrack[k] = { active: 0, other: 0 };
        if (l.status === "active") onTrack[k].active += Number(l.n); else onTrack[k].other += Number(l.n);
      }
      return json({ ok: true, rows, leads_on_track: onTrack });
    }

    if (action === "template_get") {
      const track = String(body.track || ""); const step = Number(body.step ?? 0);
      const { data } = await admin.from("email_templates").select("track,step,key,subject,preheader,blocks,wait_days,updated_at").eq("track", track).eq("step", step).maybeSingle();
      if (!data) return json({ error: "not_found" }, 404);
      return json({ ok: true, tpl: data });
    }

    if (action === "template_save") {
      // Ulozeni sablony z editoru — MENI ZIVE MAILY. Pred zapisem validace bloku
      // + zkusebni render pro oba rody (nevyreseny token by mail zablokoval a lead zaparkoval).
      const track = String(body.track || ""); const step = Number(body.step ?? 0);
      const subject = String(body.subject || "").trim();
      const preheader = String(body.preheader || "").trim();
      const wdRaw = body.wait_days;
      const wait_days = (wdRaw === null || wdRaw === "" || wdRaw === undefined) ? null : Number(wdRaw);
      const blocks = body.blocks;
      if (!track || !subject || !Array.isArray(blocks) || !blocks.length) return json({ error: "bad_args" }, 400);
      if (wait_days !== null && (!Number.isFinite(wait_days) || wait_days < 0 || wait_days > 365)) return json({ error: "bad_wait_days" }, 400);
      for (const b of blocks as Record<string, unknown>[]) {
        const t = String(b.t ?? "");
        if (t === "p" || t === "ps") { if (typeof b.html !== "string" || !(b.html as string).trim()) return json({ error: "bad_block_html" }, 400); }
        else if (t === "bullets") { if (!Array.isArray(b.items) || !(b.items as unknown[]).length || (b.items as unknown[]).some((x) => typeof x !== "string" || !(x as string).trim())) return json({ error: "bad_block_bullets" }, 400); }
        else if (t === "btn") { if (typeof b.text !== "string" || !(b.text as string).trim() || typeof b.href !== "string" || !(b.href as string).trim()) return json({ error: "bad_block_btn" }, 400); }
        else return json({ error: "bad_block_type:" + t }, 400);
      }
      const { data: exists } = await admin.from("email_templates").select("track").eq("track", track).eq("step", step).maybeSingle();
      if (!exists) return json({ error: "not_found" }, 404);
      const { data: fRows } = await admin.from("app_config").select("key,value").in("key", ["footer_html", "footer_text"]);
      const fMap = Object.fromEntries((fRows ?? []).map((r: { key: string; value: string }) => [r.key, r.value]));
      const footer = { html: fMap.footer_html ?? "", text: fMap.footer_text ?? "" };
      try {
        for (const seg of ["zeny", "muzi"] as Seg[]) {
          const v = buildVars(seg === "zeny" ? "Jana" : "Martin", seg, SUPABASE_URL + "/functions/v1/unsubscribe?token=sample");
          renderEmailPreview({ subject, preheader, blocks: blocks as Block[] }, seg, v, footer);
        }
      } catch (e) { return json({ error: "render_failed", detail: String(e).slice(0, 200) }, 400); }
      const up = await admin.from("email_templates").update({ subject, preheader, blocks, wait_days, updated_at: new Date().toISOString() }).eq("track", track).eq("step", step);
      if (up.error) return json({ error: up.error.message }, 500);
      return json({ ok: true });
    }

    if (action === "template_preview") {
      // nahled NEULOZENE verze z editoru (nic nezapisuje)
      const seg = normSeg(body.segment);
      const blocks = Array.isArray(body.blocks) ? (body.blocks as Block[]) : [];
      const { data: fRows } = await admin.from("app_config").select("key,value").in("key", ["footer_html", "footer_text"]);
      const fMap = Object.fromEntries((fRows ?? []).map((r: { key: string; value: string }) => [r.key, r.value]));
      const footer = { html: fMap.footer_html ?? "", text: fMap.footer_text ?? "" };
      try {
        const v = buildVars(seg === "muzi" ? "Martin" : "Jana", seg, SUPABASE_URL + "/functions/v1/unsubscribe?token=sample");
        const m = renderEmailPreview({ subject: String(body.subject || ""), preheader: String(body.preheader || ""), blocks }, seg, v, footer);
        return json({ ok: true, subject: m.subject, html: m.html, text: m.text });
      } catch (e) { return json({ ok: false, error: String(e).slice(0, 200) }); }
    }

    if (action === "referrals_overview") {
      const [refs, codes, pays] = await Promise.all([
        admin.from("referrals").select("id,code,buyer_email,product,amount,order_id,source,status,reward_type,reward_amount,created_at,confirmed_at").order("created_at", { ascending: false }).limit(300),
        admin.from("referral_codes").select("code,owner_email,active"),
        admin.from("referral_payouts").select("id,owner_email,amount_czk,note,created_at").order("created_at", { ascending: false }).limit(200),
      ]);
      const ownerByCode = new Map<string, string>((codes.data ?? []).map((c) => [String(c.code), low(c.owner_email)]));
      const rows = (refs.data ?? []).map((r) => ({ ...r, owner_email: ownerByCode.get(String(r.code)) ?? "" }));
      // salda z DB view referral_balances (plna agregace — zadne limity, zadna dvoji vyplata)
      const { data: balRows } = await admin.from("referral_balances").select("owner_email,confirmed,pending,paid");
      const balances = (balRows ?? [])
        .map((b) => ({ owner_email: low(b.owner_email), confirmed: Number(b.confirmed) || 0, pending: Number(b.pending) || 0, paid: Number(b.paid) || 0, balance: (Number(b.confirmed) || 0) - (Number(b.paid) || 0) }))
        .filter((b) => b.confirmed || b.pending || b.paid);
      balances.sort((a, b) => b.balance - a.balance);
      return json({ ok: true, referrals: rows, payouts: pays.data ?? [], balances });
    }

    if (action === "referral_set_status") {
      // schvaleni (confirmed) / zamitnuti (void) referralu — hlavne pro source='self_report'
      const id = Number(body.id); const status = String(body.status || "");
      if (!id || !["confirmed", "void"].includes(status)) return json({ error: "bad_args" }, 400);
      const patch: Record<string, unknown> = { status, confirmed_at: status === "confirmed" ? new Date().toISOString() : null };
      const { data: upd, error } = await admin.from("referrals").update(patch).eq("id", id).select("id");
      if (error) return json({ error: error.message }, 500);
      if (!upd || !upd.length) return json({ error: "not_found" }, 404);
      return json({ ok: true });
    }

    if (action === "referral_payout_add") {
      // evidence vyplaty (kredit/cash) — snizi saldo partnera
      const owner = low(body.owner_email); const amount = Math.round(Number(body.amount_czk)); const note = String(body.note || "").slice(0, 300);
      if (!owner || !Number.isFinite(amount) || amount < 1) return json({ error: "bad_args" }, 400);
      // vyplata jen realnemu partnerovi (preklep by vytvoril fantomove saldo)
      const { data: ownerRow } = await admin.from("referral_codes").select("code").ilike("owner_email", owner).limit(1);
      if (!ownerRow || !ownerRow.length) return json({ error: "unknown_owner" }, 400);
      const { error } = await admin.from("referral_payouts").insert({ owner_email: owner, amount_czk: amount, note, created_by: me });
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true });
    }

    if (action === "checkins_overview") {
      // check-iny primo v adminu: souhrn per klient agreguje SQL funkce
      // admin_checkins_overview() — zadny 1000-row strop PostgREST, trendy vzdy aktualni
      const [chk, cred] = await Promise.all([
        admin.rpc("admin_checkins_overview"),
        admin.from("discount_credits").select("email,credit_czk,checkins_n,milestone_2cm"),
      ]);
      const credBy = new Map<string, Record<string, unknown>>((cred.data ?? []).map((c) => [low(c.email), c]));
      const rows = ((chk.data ?? []) as Record<string, unknown>[]).map((r) => ({
        email: low(r.email), n: Number(r.n) || 0, last: r.last, last_note: String(r.last_note ?? ""),
        weight_from: r.weight_from == null ? null : Number(r.weight_from),
        weight_to: r.weight_to == null ? null : Number(r.weight_to),
        waist_from: r.waist_from == null ? null : Number(r.waist_from),
        waist_to: r.waist_to == null ? null : Number(r.waist_to),
        adherence_avg: r.adherence_avg == null ? null : Number(r.adherence_avg),
        credit: credBy.get(low(r.email)) ?? null,
      }));
      rows.sort((a, b) => String(b.last || "").localeCompare(String(a.last || "")));
      return json({ ok: true, rows });
    }

    if (action === "progress_overview") {
      // Progres clenu: videokurz (lesson_id 'vk-*', 182 lekci) vs Academy (ostatni lesson_id).
      // Vraci jen cleny s pristupem nebo aspon 1 splnenou lekci.
      // Pocet Academy lekci se pocita zive: placene lekce v lesson_content ('m*') + 6 free ukazek.
      const VK_TOTAL = 182;
      const [ulist2, prg, ents, lcCount] = await Promise.all([
        listAllUsers(admin),
        admin.from("progress").select("user_id,lesson_id,completed_at").eq("completed", true),
        admin.from("entitlements").select("email,product").eq("active", true),
        admin.from("lesson_content").select("lesson_id", { count: "exact", head: true }).like("lesson_id", "m%"),
      ]);
      const AC_TOTAL = (lcCount.count ?? 235) + 6;
      const entSet = new Set((ents.data ?? []).map((e) => low(e.email) + ":" + e.product));
      const byUser = new Map<string, { vk: number; ac: number; last: string | null }>();
      for (const p of prg.data ?? []) {
        const u = String(p.user_id);
        if (!byUser.has(u)) byUser.set(u, { vk: 0, ac: 0, last: null });
        const r = byUser.get(u)!;
        if (String(p.lesson_id).indexOf("vk-") === 0) r.vk++; else r.ac++;
        const t = String(p.completed_at ?? "");
        if (t && (!r.last || t > r.last)) r.last = t;
      }
      const rows: Record<string, unknown>[] = [];
      for (const u of ulist2) {
        const email = low(u.email); if (!email) continue;
        const pr = byUser.get(String(u.id)) || { vk: 0, ac: 0, last: null };
        const hasAc = entSet.has(email + ":academy");
        const hasVk = hasAc || entSet.has(email + ":videokurz");
        if (!hasVk && !hasAc && pr.vk === 0 && pr.ac === 0) continue;
        rows.push({
          email, vk_done: pr.vk, ac_done: pr.ac, has_videokurz: hasVk, has_academy: hasAc,
          last_activity: pr.last, last_sign_in: (u as { last_sign_in_at?: string }).last_sign_in_at ?? null,
        });
      }
      rows.sort((a, b) => String((b.last_activity as string) || "").localeCompare(String((a.last_activity as string) || "")));
      return json({ ok: true, vk_total: VK_TOTAL, ac_total: AC_TOTAL, rows });
    }

    if (action === "contact_messages") {
      // Historické webové formuláře rozdělené na relevantní vs potenciální spam.
      const limit = Math.min(Number(body.limit) || 300, 1000);
      const { data, error } = await admin
        .from("contact_messages")
        .select("id,name,email,message,spam,spam_reason,origin,created_at")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) return json({ error: error.message }, 500);
      const rows = (data ?? []) as Record<string, unknown>[];
      return json({
        ok: true,
        relevant: rows.filter((r) => !r.spam),
        spam: rows.filter((r) => r.spam),
        total: rows.length,
      });
    }

    if (action === "qr_stats") {
      // Leady z letáků/QR: seskupené podle meta->>'utm_source'. (Skeny/pageviews řeší GA4.)
      const { data, error } = await admin.from("leads").select("meta,created_at");
      if (error) return json({ error: error.message }, 500);
      const bySrc = new Map<string, { source: string; medium: string | null; leads: number; last: string | null }>();
      for (const l of (data ?? []) as { meta: unknown; created_at: string }[]) {
        const meta = (l.meta && typeof l.meta === "object") ? l.meta as Record<string, unknown> : {};
        const s = String(meta.utm_source ?? "").trim();
        if (!s) continue;
        if (!bySrc.has(s)) bySrc.set(s, { source: s, medium: meta.utm_medium ? String(meta.utm_medium) : null, leads: 0, last: null });
        const r = bySrc.get(s)!;
        r.leads++;
        const t = String(l.created_at ?? "");
        if (t && (!r.last || t > r.last)) r.last = t;
      }
      const rows = [...bySrc.values()].sort((a, b) => b.leads - a.leads);
      return json({ ok: true, rows, total: rows.reduce((n, r) => n + r.leads, 0) });
    }

    return json({ error: "unknown_action" }, 400);
  } catch (e) {
    return json({ error: "server", detail: String(e).slice(0, 300) }, 500);
  }
});
