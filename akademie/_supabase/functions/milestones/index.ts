// Barna Academy — milestones: milnikove maily za progres ve videokurzu.
// 50 = prekrocena polovina (>=91 z 182 lekci), 100 = dokonceno (182/182).
// Idempotence pres tabulku milestone_sent (email, product, milestone).
// [2026-07-16] respektuje leads.status unsubscribed/bounced, prida unsubscribe odkaz+hlavicky
// (vk-complete ma prodejni blok -> odhlaseni musi jit primo z mailu) a listUsers strankuje.
// Auth: x-drip-secret == app_config drip_invoke_secret. Cron se zapoji az po schvaleni.
// TEST rezim: POST {test_email, milestone: 50|100, name} -> [TEST] mail, nic se nezapisuje.
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const FROM = "Martin Barna <news@martinbarna.cz>";
const unsubLink = (token: string) => SUPABASE_URL + "/functions/v1/unsubscribe?token=" + encodeURIComponent(token);
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
    if (b.t === "ps") return `<p class='mb-ps' style='margin:16px 0 0;color:#A09AAD;font-style:italic'>${fill(b.html, v)}</p>`;
    if (b.t === "bullets")
      return `<ul style='margin:0 0 14px;padding-left:20px'>` + b.items.map((li) => `<li style='margin:0 0 9px'>${fill(li, v)}</li>`).join("") + `</ul>`;
    return `<p style='margin:4px 0 18px'><a class='mb-btn' href='${fill(b.href, v)}' style='display:inline-block;background:#EBB12C;color:#1A1222;text-decoration:none;padding:13px 24px;border-radius:50px;font-weight:700'>${fill(b.text, v)}</a></p>`;
  }).join("\n");
}
function wrap(preheader: string, body: string, unsubUrl = ""): string {
  // unsubscribe paticka: vk-complete obsahuje i prodejni blok (Academy/referral/appka),
  // takze odhlaseni musi byt primo v mailu, ne jen "neni to newsletter"
  const unsubLine = unsubUrl
    ? `<br>Nechceš už ode mě e-maily? <a class='mb-mut' href='${unsubUrl}' style='color:#8F8A99'>Odhlásit se</a>.`
    : "";
  const foot = "Martin Barna, online výživový kouč · IČO 76383032 · <a class='mb-mut' href='https://martinbarna.cz' style='color:#999'>martinbarna.cz</a><br>Tento e-mail ti přišel jako členovi videokurzu (gratulace k tvému pokroku, není to newsletter)." + unsubLine;
  // DARK-MODE FIX (drz 1:1 s drip-send): color-scheme 'light dark' + zamky barev pres tridy .mb-*.
  // Gmail app v dark rezimu invertoval kartu na svetlou a zlatou #EBB12C barvil dohneda;
  // [data-ogsc]/[data-ogsb] = Outlook aplikace, @media prefers-color-scheme = Apple Mail.
  return `<!doctype html><html lang='cs'><head><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'><meta name='color-scheme' content='light dark'><meta name='supported-color-schemes' content='light dark'>` +
    `<style>` +
    `:root{color-scheme:light dark;supported-color-schemes:light dark}` +
    `@media (prefers-color-scheme: dark){` +
    `.mb-bg{background:#0C0B10!important}` +
    `.mb-card{background:#181520!important}` +
    `.mb-body{color:#F0EADF!important}` +
    `.mb-brand{color:#EBB12C!important;border-left-color:#EBB12C!important}` +
    `.mb-btn{background:#EBB12C!important;color:#1A1222!important}` +
    `.mb-mut{color:#8F8A99!important}` +
    `.mb-ps{color:#A09AAD!important}` +
    `.mb-link{color:#F6CD63!important}` +
    `}` +
    `[data-ogsc] .mb-bg,[data-ogsb] .mb-bg{background:#0C0B10!important}` +
    `[data-ogsc] .mb-card,[data-ogsb] .mb-card{background:#181520!important}` +
    `[data-ogsc] .mb-body,[data-ogsb] .mb-body{color:#F0EADF!important}` +
    `[data-ogsc] .mb-brand,[data-ogsb] .mb-brand{color:#EBB12C!important;border-left-color:#EBB12C!important}` +
    `[data-ogsc] .mb-btn,[data-ogsb] .mb-btn{background:#EBB12C!important;color:#1A1222!important}` +
    `[data-ogsc] .mb-mut,[data-ogsb] .mb-mut{color:#8F8A99!important}` +
    `[data-ogsc] .mb-ps,[data-ogsb] .mb-ps{color:#A09AAD!important}` +
    `[data-ogsc] .mb-link,[data-ogsb] .mb-link{color:#F6CD63!important}` +
    `</style></head>` +
    `<body class='mb-bg' style='margin:0;background:#0C0B10;padding:16px'>` +
    `<span style='display:none!important;opacity:0;color:transparent;height:0;width:0;overflow:hidden'>${preheader}</span>` +
    `<div class='mb-card mb-body' style='font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;font-size:16px;line-height:1.55;color:#F0EADF;max-width:560px;margin:0 auto;background:#181520;border:1px solid #262232;border-radius:14px;padding:28px'>` +
    `<div class='mb-brand' style='border-left:3px solid #EBB12C;padding-left:10px;font-weight:800;font-size:13px;letter-spacing:.2em;text-transform:uppercase;color:#EBB12C;margin:0 0 20px'>Martin Barna</div>` +
    body + `<hr style='border:none;border-top:1px solid #262232;margin:22px 0 14px'><div class='mb-mut' style='font-size:12px;line-height:1.5;color:#8F8A99'>${foot}</div></div></body></html>`;
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
function vars(name: string): Record<string, string> {
  const t = (name || "").trim().split(" ")[0] || "";
  const fn = vokativ(t ? t.charAt(0).toUpperCase() + t.slice(1) : "", "");
  return { first_name: fn, fn_space: fn ? " " + fn : "", fn_suffix: fn ? ", " + fn : "", fn_prefix: fn ? fn + ", " : "" };
}
async function send(to: string, subject: string, html: string, unsubUrl = "") {
  if (!RESEND_KEY) throw new Error("missing_RESEND_API_KEY");
  // RFC 8058 List-Unsubscribe hlavicky (kdyz mame token) — stejne jako drip-send
  const headers = unsubUrl
    ? { "List-Unsubscribe": "<" + unsubUrl + ">", "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" }
    : undefined;
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: "Bearer " + RESEND_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM, to: [to], subject, html, reply_to: "martin@martinbarna.cz", headers }),
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
  const [prg, ents, sent] = await Promise.all([
    admin.from("progress").select("user_id,lesson_id").eq("completed", true).like("lesson_id", "vk-%"),
    // Expirace: milniky chodi jen platnym clenum (NULL = dozivotni). Viz `mb-academy-pricing-mise`.
    admin.from("entitlements").select("email,product").eq("active", true)
      .or("expires_at.is.null,expires_at.gt." + new Date().toISOString())
      .in("product", ["videokurz", "academy"]),
    admin.from("milestone_sent").select("email,milestone").eq("product", "videokurz"),
  ]);
  // auth uzivatele pres VSECHNY stranky (jen page 1 = tichy vypadek clenu nad 1000)
  type AuthUser = { id: string; email?: string; user_metadata?: Record<string, unknown> };
  const users: AuthUser[] = [];
  for (let page = 1; page <= 50; page++) {
    const { data: ud, error: uerr } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    const batch = (ud?.users ?? []) as AuthUser[];
    users.push(...batch);
    if (uerr || batch.length < 1000) break;
  }
  // leads = zdroj odhlaseni/bounce + unsubscribe tokenu (strankovane po 1000)
  const leadInfo = new Map<string, { status: string; token: string }>();
  for (let from = 0; ; from += 1000) {
    const { data: lrows, error: lerr } = await admin.from("leads")
      .select("email,status,unsubscribe_token").order("id").range(from, from + 999);
    for (const l of lrows ?? []) leadInfo.set(low(l.email), { status: String(l.status ?? ""), token: String(l.unsubscribe_token ?? "") });
    if (lerr || (lrows ?? []).length < 1000) break;
  }
  const members = new Set((ents.data ?? []).map((e) => low(e.email)));
  const already = new Set((sent.data ?? []).map((s) => low(s.email) + ":" + s.milestone));
  const cnt = new Map<string, number>();
  for (const p of prg.data ?? []) cnt.set(String(p.user_id), (cnt.get(String(p.user_id)) ?? 0) + 1);

  const tpl50 = await getTpl(50), tpl100 = await getTpl(100);
  if (!tpl50 || !tpl100) return json({ error: "no_templates" }, 500);

  let sends = 0, marked = 0;
  const results: Record<string, unknown>[] = [];
  for (const u of users) {
    if (sends >= MAX_PER_RUN) break;
    const email = low(u.email);
    if (!email || !members.has(email)) continue;
    // respektuj odhlaseni/bounce z drip enginu (vk-complete obsahuje prodejni blok)
    const li = leadInfo.get(email);
    if (li && (li.status === "unsubscribed" || li.status === "bounced")) continue;
    const unsub = li?.token ? unsubLink(li.token) : "";
    const done = cnt.get(String(u.id)) ?? 0;
    const name = String((u.user_metadata as Record<string, unknown>)?.full_name ?? "");
    const v = vars(name);
    try {
      if (done >= VK_TOTAL && !already.has(email + ":100")) {
        await send(email, fill(tpl100.subject, v), wrap(fill(tpl100.preheader, v), renderBlocks(tpl100.blocks, v), unsub), unsub);
        await admin.from("milestone_sent").insert({ email, product: "videokurz", milestone: 100 });
        // 50 uz neposilat nikdy (prekonano) — zapis bez mailu
        if (!already.has(email + ":50")) { await admin.from("milestone_sent").insert({ email, product: "videokurz", milestone: 50 }); marked++; }
        sends++; results.push({ email, milestone: 100, done });
      } else if (done >= HALF && !already.has(email + ":50")) {
        await send(email, fill(tpl50.subject, v), wrap(fill(tpl50.preheader, v), renderBlocks(tpl50.blocks, v), unsub), unsub);
        await admin.from("milestone_sent").insert({ email, product: "videokurz", milestone: 50 });
        sends++; results.push({ email, milestone: 50, done });
      }
    } catch (e) {
      results.push({ email, error: String(e).slice(0, 100) });
    }
  }
  return json({ ok: true, sends, marked_skipped: marked, results });
});
