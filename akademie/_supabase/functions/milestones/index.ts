// Barna Academy — milestones: milnikove maily za progres ve videokurzu.
// 50 = prekrocena polovina (>=91 z 182 lekci), 100 = dokonceno (182/182).
// Idempotence pres tabulku milestone_sent (email, product, milestone).
// Auth: x-drip-secret == app_config drip_invoke_secret. Cron se zapoji az po schvaleni.
// TEST rezim: POST {test_email, milestone: 50|100, name} -> [TEST] mail, nic se nezapisuje.
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const FROM = "Martin Barna <news@martinbarna.cz>";
const VK_TOTAL = 182;
const HALF = Math.ceil(VK_TOTAL / 2);
const MAX_PER_RUN = 20; // pojistka pod denni limit Resendu

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { "Content-Type": "application/json" } });
const low = (s: unknown) => String(s ?? "").trim().toLowerCase();

// --- mini render (kompatibilni s email_templates blocks; gender pro cleny = 'other') ---
type Block = { t: "p"; html: string } | { t: "bullets"; items: string[] } | { t: "btn"; text: string; href: string } | { t: "ps"; html: string };
function gender(s: string): string {
  // clenove nemaji segment -> muzsky rod ([[zena||muz]] -> muz, [a] -> '')
  let out = "", i = 0;
  while (true) {
    const a = s.indexOf("[[", i);
    if (a < 0) { out += s.slice(i); break; }
    out += s.slice(i, a);
    const sep = s.indexOf("||", a + 2);
    const end = s.indexOf("]]", sep + 2);
    out += s.slice(sep + 2, end);
    i = end + 2;
  }
  return out.split("[a]").join("");
}
function merge(s: string, v: Record<string, string>): string {
  let out = "", i = 0;
  while (true) {
    const a = s.indexOf("{{", i);
    if (a < 0) { out += s.slice(i); break; }
    out += s.slice(i, a);
    const end = s.indexOf("}}", a + 2);
    const key = s.slice(a + 2, end);
    out += key in v ? v[key] : "{{" + key + "}}";
    i = end + 2;
  }
  return out;
}
const fill = (s: string, v: Record<string, string>) => merge(gender(s), v);
function renderBlocks(blocks: Block[], v: Record<string, string>): string {
  return blocks.map((b) => {
    if (b.t === "p") return `<p style='margin:0 0 14px'>${fill(b.html, v)}</p>`;
    if (b.t === "ps") return `<p style='margin:16px 0 0;color:#666;font-style:italic'>${fill(b.html, v)}</p>`;
    if (b.t === "bullets")
      return `<ul style='margin:0 0 14px;padding-left:20px'>` + b.items.map((li) => `<li style='margin:0 0 9px'>${fill(li, v)}</li>`).join("") + `</ul>`;
    return `<p style='margin:4px 0 18px'><a href='${fill(b.href, v)}' style='display:inline-block;background:#ff7a00;color:#161616;text-decoration:none;padding:13px 24px;border-radius:50px;font-weight:700'>${fill(b.text, v)}</a></p>`;
  }).join("\n");
}
function wrap(preheader: string, body: string): string {
  const foot = "Martin Barna — online výživový kouč · IČO 76383032 · <a href='https://martinbarna.cz' style='color:#999'>martinbarna.cz</a><br>Tento e-mail ti přišel jako členovi videokurzu (gratulace k tvému pokroku — není to newsletter).";
  return `<!doctype html><html lang='cs'><head><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'></head>` +
    `<body style='margin:0;background:#f4f4f5;padding:16px'>` +
    `<span style='display:none!important;opacity:0;color:transparent;height:0;width:0;overflow:hidden'>${preheader}</span>` +
    `<div style='font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;font-size:16px;line-height:1.55;color:#222;max-width:560px;margin:0 auto;background:#fff;border-radius:14px;padding:28px'>` +
    body + `<hr style='border:none;border-top:1px solid #eee;margin:22px 0 14px'><div style='font-size:12px;line-height:1.5;color:#999'>${foot}</div></div></body></html>`;
}
function vars(name: string): Record<string, string> {
  const t = (name || "").trim().split(" ")[0] || "";
  const fn = t ? t.charAt(0).toUpperCase() + t.slice(1) : "";
  return { first_name: fn, fn_space: fn ? " " + fn : "", fn_suffix: fn ? ", " + fn : "", fn_prefix: fn ? fn + ", " : "" };
}
async function send(to: string, subject: string, html: string) {
  if (!RESEND_KEY) throw new Error("missing_RESEND_API_KEY");
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: "Bearer " + RESEND_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM, to: [to], subject, html, reply_to: "martin@martinbarna.cz" }),
  });
  if (!r.ok) throw new Error("resend_" + r.status);
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method" }, 405);
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

  const { data: sec } = await admin.from("app_config").select("value").eq("key", "drip_invoke_secret").maybeSingle();
  if (!sec?.value || (req.headers.get("x-drip-secret") || "") !== sec.value) return json({ error: "unauthorized" }, 401);

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  const getTpl = async (step: number) => {
    const { data } = await admin.from("email_templates").select("subject,preheader,blocks")
      .eq("track", "milestone-videokurz").eq("step", step).maybeSingle();
    return data as { subject: string; preheader: string; blocks: Block[] } | null;
  };

  // TEST: posli nahled Martinovi, nic nezapisuj
  if (typeof body.test_email === "string" && body.test_email.includes("@")) {
    const ms = Number(body.milestone) === 100 ? 100 : 50;
    const tpl = await getTpl(ms);
    if (!tpl) return json({ error: "no_template" }, 400);
    const v = vars(String(body.name ?? ""));
    await send(String(body.test_email), "[TEST] " + fill(tpl.subject, v), wrap(fill(tpl.preheader, v), renderBlocks(tpl.blocks, v)));
    return json({ ok: true, mode: "test", milestone: ms });
  }

  // LIVE: spocitej progres vsech clenu videokurzu a posli nove dosazene milniky
  const [ulist, prg, ents, sent] = await Promise.all([
    admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    admin.from("progress").select("user_id,lesson_id").eq("completed", true).like("lesson_id", "vk-%"),
    admin.from("entitlements").select("email,product").eq("active", true).in("product", ["videokurz", "academy"]),
    admin.from("milestone_sent").select("email,milestone").eq("product", "videokurz"),
  ]);
  const members = new Set((ents.data ?? []).map((e) => low(e.email)));
  const already = new Set((sent.data ?? []).map((s) => low(s.email) + ":" + s.milestone));
  const cnt = new Map<string, number>();
  for (const p of prg.data ?? []) cnt.set(String(p.user_id), (cnt.get(String(p.user_id)) ?? 0) + 1);

  const tpl50 = await getTpl(50), tpl100 = await getTpl(100);
  if (!tpl50 || !tpl100) return json({ error: "no_templates" }, 500);

  let sends = 0, marked = 0;
  const results: Record<string, unknown>[] = [];
  for (const u of ulist.data?.users ?? []) {
    if (sends >= MAX_PER_RUN) break;
    const email = low(u.email);
    if (!email || !members.has(email)) continue;
    const done = cnt.get(String(u.id)) ?? 0;
    const name = String((u.user_metadata as Record<string, unknown>)?.full_name ?? "");
    const v = vars(name);
    try {
      if (done >= VK_TOTAL && !already.has(email + ":100")) {
        await send(email, fill(tpl100.subject, v), wrap(fill(tpl100.preheader, v), renderBlocks(tpl100.blocks, v)));
        await admin.from("milestone_sent").insert({ email, product: "videokurz", milestone: 100 });
        // 50 uz neposilat nikdy (prekonano) — zapis bez mailu
        if (!already.has(email + ":50")) { await admin.from("milestone_sent").insert({ email, product: "videokurz", milestone: 50 }); marked++; }
        sends++; results.push({ email, milestone: 100, done });
      } else if (done >= HALF && !already.has(email + ":50")) {
        await send(email, fill(tpl50.subject, v), wrap(fill(tpl50.preheader, v), renderBlocks(tpl50.blocks, v)));
        await admin.from("milestone_sent").insert({ email, product: "videokurz", milestone: 50 });
        sends++; results.push({ email, milestone: 50, done });
      }
    } catch (e) {
      results.push({ email, error: String(e).slice(0, 100) });
    }
  }
  return json({ ok: true, sends, marked_skipped: marked, results });
});
