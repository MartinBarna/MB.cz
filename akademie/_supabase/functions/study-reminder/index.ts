// Barna Academy — study-reminder: týdenní „vrať se ke studiu" nudge (gamifikace D).
// Cílí ČLENY Academy, kteří něco nastudovali, ale posledních 7–35 dní byli neaktivní
// (rozjeli se a zasekli) — jemné pobídnutí zpět. NE nováčky (0 progresu) ani dávno studené.
//
// DVOJITÁ POJISTKA VYPNUTÍ (postaveno „vypnuté", zapne Martin až vyřeší Resend):
//   1) Auth: hlavička x-drip-secret == app_config.drip_invoke_secret (jinak 401).
//   2) Master flag: app_config.study_reminder_enabled musí být 'true'. Když chybí/false,
//      funkce se korektně vrátí { disabled:true } a NIC nepošle. Cron se zapojí až potom.
//   + MAX_PER_RUN strop pod denní limit Resendu. Idempotence: study_reminder_sent (email, week_key).
//
// TEST režim (obchází flag, nic nezapisuje): POST { test_email, name } -> jeden [TEST] mail.
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const FROM = "Martin Barna <news@martinbarna.cz>";
const SITE = "https://www.martinbarna.cz";
const MAX_PER_RUN = 20;          // pojistka pod denní limit Resendu
const MIN_DAYS = 7;              // neaktivní aspoň týden
const MAX_DAYS = 35;             // ale ne déle než ~5 týdnů (pak je to studený lead)

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { "Content-Type": "application/json" } });
const low = (s: unknown) => String(s ?? "").trim().toLowerCase();
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"]/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[m] as string));

// monotonní index týdne (láme v pondělí) — shodný s frontendem (studium/index.html)
function weekKey(t: number): string { return String(Math.floor((t / 86400000 + 3) / 7)); }

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
  if (seg !== "muzi" && !isMaleName(low)) return fn;
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
function emailHtml(name: string, unsub: string): string {
  const _t = (name || "").trim().split(" ")[0] || "";
  const _fn = vokativ(_t ? _t.charAt(0).toUpperCase() + _t.slice(1) : "", "");
  const hi = _fn ? "Ahoj " + esc(_fn) : "Ahoj";
  return `<!doctype html><html><body style="margin:0;background:#0f0d0b;font-family:Poppins,Segoe UI,Arial,sans-serif;color:#e9e2d8">
<div style="max-width:560px;margin:0 auto;padding:28px 22px">
  <div style="font-weight:800;color:#fff;font-size:20px;margin-bottom:18px">Barna Academy</div>
  <div style="background:linear-gradient(180deg,#1a1613,#121010);border:1px solid rgba(255,255,255,.08);border-radius:18px;padding:26px 24px">
    <div style="font-size:15px;color:#a89e94;letter-spacing:2px;font-weight:700">🔥 NEZTRAŤ SÉRII</div>
    <h1 style="color:#fff;font-size:22px;margin:8px 0 12px">${hi}, tento týden ses ještě neučil</h1>
    <p style="font-size:15px;line-height:1.6;color:#cfc7bc;margin:0 0 16px">Rozjel ses skvěle — a přesně teď se láme, jestli z toho bude zvyk. Stačí <b style="color:#fff">jedna lekce</b> a týdenní cíl máš rozjetý zpátky. Deset minut, a jsi zase o krok blíž k tomu být lepší trenér.</p>
    <a href="${SITE}/akademie/studium/" style="display:inline-block;background:linear-gradient(145deg,#ffb64d,#ff7a00);color:#160d04;font-weight:800;text-decoration:none;padding:14px 26px;border-radius:50px;font-size:15px">▶ Pokračovat ve studiu</a>
    <p style="font-size:13px;line-height:1.6;color:#8a8073;margin:20px 0 0">Drž se, i malý krok se počítá. Be Effective. 💪<br>— Martin</p>
  </div>
  <p style="font-size:11px;color:#6a6058;text-align:center;margin:16px 0 0">Barna Academy · martinbarna.cz &nbsp;·&nbsp; <a href="${unsub}" style="color:#8a8073">Odhlásit připomínky</a></p>
</div></body></html>`;
}

async function send(to: string, subject: string, html: string) {
  if (!RESEND_KEY) throw new Error("no_resend_key");
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: "Bearer " + RESEND_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM, to: [to], subject, html }),
  });
  if (!r.ok) throw new Error("resend_" + r.status);
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method" }, 405);
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

  // --- auth ---
  const { data: sec } = await admin.from("app_config").select("value").eq("key", "drip_invoke_secret").maybeSingle();
  const secret = sec?.value ?? "";
  if (!secret || req.headers.get("x-drip-secret") !== secret) return json({ error: "unauthorized" }, 401);

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* prázdné tělo OK */ }

  // --- TEST režim: jeden [TEST] mail, nic se nezapisuje, obchází master flag ---
  if (body.test_email) {
    const name = String(body.name ?? "");
    const testUnsub = SUPABASE_URL + "/functions/v1/unsubscribe?token=test-no-op";
    await send(String(body.test_email), "[TEST] Tento týden ses ještě neučil 🔥", emailHtml(name, testUnsub));
    return json({ ok: true, mode: "test" });
  }

  // --- master přepínač (postaveno vypnuté) ---
  const { data: en } = await admin.from("app_config").select("value").eq("key", "study_reminder_enabled").maybeSingle();
  if (String(en?.value ?? "").toLowerCase() !== "true") return json({ ok: true, disabled: true, hint: "Zapni: app_config.study_reminder_enabled='true' + týdenní cron." });

  const now = Date.now();
  const thisWeek = weekKey(now);

  // --- data: členové Academy, jejich progres (completed_at), už odeslané tento týden ---
  const [ulist, ents, prg, sent, leads] = await Promise.all([
    admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    admin.from("entitlements").select("email,product").eq("active", true).eq("product", "academy"),
    admin.from("progress").select("user_id,completed_at").eq("completed", true).not("lesson_id", "like", "vk-%"),
    admin.from("study_reminder_sent").select("email").eq("week_key", thisWeek),
    admin.from("leads").select("email,unsubscribe_token"),
  ]);
  const members = new Set((ents.data ?? []).map((e) => low(e.email)));
  const alreadySent = new Set((sent.data ?? []).map((s) => low(s.email)));
  // token pro 1-klik odhlášení (kupující mají lead řádek se stejným mechanismem jako ostatní maily)
  const tokenByEmail = new Map<string, string>();
  for (const l of leads.data ?? []) { if (l.email && l.unsubscribe_token) tokenByEmail.set(low(l.email), String(l.unsubscribe_token)); }

  // poslední aktivita na uživatele (z completed_at)
  const last = new Map<string, number>();
  for (const p of prg.data ?? []) {
    if (!p.completed_at) continue;
    const t = Date.parse(String(p.completed_at));
    if (isNaN(t)) continue;
    const id = String(p.user_id);
    if (t > (last.get(id) ?? 0)) last.set(id, t);
  }

  let sends = 0; const results: Record<string, unknown>[] = [];
  for (const u of ulist.data?.users ?? []) {
    if (sends >= MAX_PER_RUN) break;
    const email = low(u.email);
    if (!email || !members.has(email) || alreadySent.has(email)) continue;
    const lt = last.get(String(u.id));
    if (!lt) continue;                                   // nikdy nezačal → nenudžeme
    const days = (now - lt) / 86400000;
    if (days < MIN_DAYS || days > MAX_DAYS) continue;    // aktivní tento týden, nebo studený → přeskoč
    const name = String((u.user_metadata as Record<string, unknown>)?.full_name ?? "");
    const tok = tokenByEmail.get(email);
    const unsub = tok ? SUPABASE_URL + "/functions/v1/unsubscribe?token=" + encodeURIComponent(tok) : SITE + "/akademie/moje/";
    try {
      await send(email, "Tento týden ses ještě neučil 🔥", emailHtml(name, unsub));
      await admin.from("study_reminder_sent").insert({ email, week_key: thisWeek });
      sends++; results.push({ email, days: Math.round(days) });
    } catch (e) {
      results.push({ email, error: String(e).slice(0, 100) });
    }
  }
  return json({ ok: true, sends, results });
});
