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
    const end = s.indexOf("]]", sep + 2);
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
function buildVars(name: string, seg: Seg, unsub: string): Record<string, string> {
  const parts = (name || "").trim().split(" ").filter((x) => x.length > 0);
  const t = parts[0] || "";
  const fn = t ? t.charAt(0).toUpperCase() + t.slice(1) : "";
  const dprice = Math.round(COURSE_PRICE * (1 - DISCOUNT_PCT / 100));
  return {
    first_name: fn, fn_space: fn ? " " + fn : "", fn_suffix: fn ? ", " + fn : "", fn_prefix: fn ? fn + ", " : "",
    lead_magnet_url: seg === "muzi" ? SITE + "/download/forma-zpet-muzi.pdf" : SITE + "/download/makro-plan-zeny.pdf",
    plan_page_url: seg === "muzi" ? SITE + "/forma-zpet" : SITE + "/makro-plan",
    course_url: COURSE_URL, free_lessons_url: FREE_LESSONS_URL,
    course_price: String(COURSE_PRICE), discount_pct: String(DISCOUNT_PCT),
    discount_price: String(dprice), discount_code: DISCOUNT_CODE, unsubscribe_url: unsub,
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
      const [cc, lds, ents, evs, ulist] = await Promise.all([
        admin.from("customer_contacts").select("email,name,tags,status,audience,onboarding_sent_at"),
        admin.from("leads").select("id,email,name,segment,source,track,step,status,next_send_at"),
        admin.from("entitlements").select("email,product,active"),
        admin.from("email_events").select("lead_id,type,created_at").not("lead_id", "is", null),
        admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
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
      for (const u of ulist.data?.users ?? []) {
        const k = low(u.email); if (!k) continue;
        const r = get(k); r.registered = true; r.last_sign_in = (u as { last_sign_in_at?: string }).last_sign_in_at ?? null;
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
      return json({ ok: true });
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
      const limit = Math.min(1000, Math.max(1, Number(body.limit) || 200));
      const nowI = new Date().toISOString();
      const { data: lds } = await admin.from("leads")
        .select("email,name,track,step,next_send_at")
        .eq("status", "active").not("next_send_at", "is", null)
        .order("next_send_at", { ascending: true }).limit(limit);
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
      return json({ ok: true, rows });
    }

    if (action === "progress_overview") {
      // Progres clenu: videokurz (lesson_id 'vk-*', 182 lekci) vs Academy (ostatni lesson_id).
      // Vraci jen cleny s pristupem nebo aspon 1 splnenou lekci.
      const VK_TOTAL = 182, AC_TOTAL = 224;
      const [ulist, prg, ents] = await Promise.all([
        admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
        admin.from("progress").select("user_id,lesson_id,completed_at").eq("completed", true),
        admin.from("entitlements").select("email,product").eq("active", true),
      ]);
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
      for (const u of ulist.data?.users ?? []) {
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

    return json({ error: "unknown_action" }, 400);
  } catch (e) {
    return json({ error: "server", detail: String(e).slice(0, 300) }, 500);
  }
});
