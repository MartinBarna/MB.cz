// client-report — backend klientské sekce koučinku (spec: _zdroje/klientska-sekce-plan.md).
// POST {action:'report'|'intake', data:{...}} + Authorization: Bearer <JWT klienta>.
// Brána: entitlement 'coaching'. Uloží do client_reports/client_intake a pošle
// dark-gold HTML mail Martinovi + kopii klientovi (Resend).
// Deploy: supabase functions deploy client-report --no-verify-jwt
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const FROM = "Martin Barna <news@martinbarna.cz>";
const COACH = "martin@martinbarna.cz";
const NL = String.fromCharCode(10);

const ALLOWED = ["https://martinbarna.cz", "https://www.martinbarna.cz"];
function cors(req: Request) {
  const o = req.headers.get("Origin") ?? "";
  return {
    "Access-Control-Allow-Origin": ALLOWED.includes(o) ? o : ALLOWED[0],
    "Access-Control-Allow-Headers": "authorization, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}
const json = (b: unknown, c: Record<string, string>, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...c, "Content-Type": "application/json" } });

const esc = (s: unknown) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const num = (v: unknown): number | null => {
  if (v == null || String(v).trim() === "") return null; // Number("") === 0 — prázdno není nula
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 10) / 10 : null; // 0 je validní hodnota (kroky, fitko)
};
const czk = (n: number | null) => n == null ? "—" : String(n).replace(".", ",");

// ---------- mail obal (1:1 s drip stylem) ----------
// DARK-MODE FIX (drz 1:1 s drip-send): color-scheme 'light dark' + zamky barev pres tridy .mb-*.
// Gmail app v dark rezimu invertoval kartu na svetlou a zlatou #EBB12C barvil dohneda;
// [data-ogsc]/[data-ogsb] = Outlook aplikace, @media prefers-color-scheme = Apple Mail.
// client-report ma navic vnitrni boxy a barevne delty -> vlastni tridy (mb-w, mb-sect, mb-box...).
function wrap(kicker: string, body: string, footer: string): string {
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
    `.mb-w{color:#ffffff!important}` +
    `.mb-sect{color:#F6CD63!important}` +
    `.mb-good{color:#4fc07a!important}` +
    `.mb-warn{color:#e0a04f!important}` +
    `.mb-gold{color:#EBB12C!important}` +
    `.mb-box{background:#211d2b!important}` +
    `.mb-doff{color:#3a3450!important}` +
    `.mb-b9{color:#B9B3C4!important}` +
    `}` +
    `[data-ogsc] .mb-bg,[data-ogsb] .mb-bg{background:#0C0B10!important}` +
    `[data-ogsc] .mb-card,[data-ogsb] .mb-card{background:#181520!important}` +
    `[data-ogsc] .mb-body,[data-ogsb] .mb-body{color:#F0EADF!important}` +
    `[data-ogsc] .mb-brand,[data-ogsb] .mb-brand{color:#EBB12C!important;border-left-color:#EBB12C!important}` +
    `[data-ogsc] .mb-btn,[data-ogsb] .mb-btn{background:#EBB12C!important;color:#1A1222!important}` +
    `[data-ogsc] .mb-mut,[data-ogsb] .mb-mut{color:#8F8A99!important}` +
    `[data-ogsc] .mb-ps,[data-ogsb] .mb-ps{color:#A09AAD!important}` +
    `[data-ogsc] .mb-link,[data-ogsb] .mb-link{color:#F6CD63!important}` +
    `[data-ogsc] .mb-w,[data-ogsb] .mb-w{color:#ffffff!important}` +
    `[data-ogsc] .mb-sect,[data-ogsb] .mb-sect{color:#F6CD63!important}` +
    `[data-ogsc] .mb-good,[data-ogsb] .mb-good{color:#4fc07a!important}` +
    `[data-ogsc] .mb-warn,[data-ogsb] .mb-warn{color:#e0a04f!important}` +
    `[data-ogsc] .mb-gold,[data-ogsb] .mb-gold{color:#EBB12C!important}` +
    `[data-ogsc] .mb-box,[data-ogsb] .mb-box{background:#211d2b!important}` +
    `[data-ogsc] .mb-doff,[data-ogsb] .mb-doff{color:#3a3450!important}` +
    `[data-ogsc] .mb-b9,[data-ogsb] .mb-b9{color:#B9B3C4!important}` +
    `</style></head>` +
    `<body class='mb-bg' style='margin:0;padding:0;background:#0C0B10'>` +
    `<table role='presentation' class='mb-bg' width='100%' cellpadding='0' cellspacing='0' border='0' bgcolor='#0C0B10' style='background:#0C0B10'><tr><td align='center' style='padding:16px'>` +
    `<table role='presentation' class='mb-card' width='560' cellpadding='0' cellspacing='0' border='0' bgcolor='#181520' style='width:100%;max-width:560px;background:#181520;border-radius:2px;border:1px solid #262232'><tr><td class='mb-body' style='padding:28px;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;font-size:16px;line-height:1.55;color:#F0EADF'>` +
    `<div class='mb-brand' style='border-left:3px solid #EBB12C;padding-left:10px;font-weight:800;font-size:13px;letter-spacing:.2em;text-transform:uppercase;color:#EBB12C;margin:0 0 20px'>${kicker}</div>` +
    body +
    `<hr style='border:none;border-top:1px solid #262232;margin:22px 0 14px'>` +
    `<div class='mb-mut' style='font-size:12px;line-height:1.5;color:#8F8A99'>${footer}</div>` +
    `</td></tr></table></td></tr></table></body></html>`;
}
const sect = (t: string) =>
  `<div class='mb-sect' style='font-weight:800;color:#F6CD63;font-size:13px;letter-spacing:.14em;text-transform:uppercase;margin:18px 0 8px'>${t}</div>`;
function delta(cur: number | null, prev: number | null, downGood = true): string {
  if (cur == null || prev == null) return "";
  const d = Math.round((cur - prev) * 10) / 10;
  if (d === 0) return ` <span class='mb-mut' style='color:#8F8A99;font-size:13px'>→ 0,0</span>`;
  const good = downGood ? d < 0 : d > 0;
  const col = good ? "#4fc07a" : "#e0a04f";
  const arrow = d < 0 ? "▼" : "▲";
  return ` <span class='${good ? "mb-good" : "mb-warn"}' style='color:${col};font-size:13px;font-weight:700'>${arrow} ${d > 0 ? "+" : "−"}${czk(Math.abs(d))}</span>`;
}
function dots(v: number | null): string {
  if (!v) return "<span class='mb-mut' style='color:#8F8A99'>—</span>";
  let s = "";
  for (let i = 1; i <= 5; i++) s += `<span class='${i <= v ? "mb-gold" : "mb-doff"}' style='color:${i <= v ? "#EBB12C" : "#3a3450"};font-weight:800'>●</span>`;
  return `<span style='letter-spacing:3px'>${s}</span>`;
}

// pořadí = týdenní priorita (Martin: hruď, pas, boky, zadek, stehna zaberou celé tělo), zbytek volitelný
const MIRY: [string, string][] = [
  ["prsa", "Hruď"], ["pas", "Pas"], ["boky", "Boky"], ["zadek", "Zadek"],
  ["p_stehno", "P stehno"], ["l_stehno", "L stehno"],
  ["p_lytko", "P lýtko"], ["l_lytko", "L lýtko"], ["p_paze", "P paže"], ["l_paze", "L paže"], ["krk", "Krk"], ["pupik", "Pupík"],
];

// ---------- report mail ----------
// deno-lint-ignore no-explicit-any
function reportMail(name: string, r: any, prev: any | null, first: any | null, weekNo: number): string {
  const d = new Date(r.report_date + "T12:00:00");
  const dateTxt = `${d.getDate()}. ${d.getMonth() + 1}. ${d.getFullYear()}`;
  let b = `<p class='mb-w' style='margin:0 0 4px;font-size:20px;font-weight:800;color:#fff'>${esc(name)}</p>` +
    `<p class='mb-mut' style='margin:0 0 18px;color:#8F8A99;font-size:14px'>Report k ${dateTxt}${weekNo > 0 ? ` · ${weekNo}. report spolupráce` : ""}</p>`;

  // váha
  const w = num(r.weight), pw = prev ? num(prev.weight) : null, fw = first ? num(first.weight) : null;
  b += `<table role='presentation' class='mb-box' width='100%' cellpadding='0' cellspacing='0' style='background:#211d2b;border:1px solid #2e2940;border-radius:10px;margin:0 0 6px'><tr><td style='padding:16px 20px'>` +
    `<div class='mb-gold' style='font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#EBB12C;font-weight:700'>Váha</div>` +
    `<div class='mb-w' style='font-size:34px;font-weight:800;color:#fff;line-height:1.2'>${czk(w)} kg${delta(w, pw)}</div>` +
    (pw != null || fw != null
      ? `<div class='mb-mut' style='font-size:13px;color:#8F8A99'>${pw != null ? `minule ${czk(pw)} kg` : ""}${pw != null && fw != null ? " · " : ""}${fw != null && w != null ? `start ${czk(fw)} kg · celkem <span class='${w - fw <= 0 ? "mb-good" : "mb-warn"}' style='color:${w - fw <= 0 ? "#4fc07a" : "#e0a04f"};font-weight:700'>${w - fw > 0 ? "+" : w - fw < 0 ? "−" : ""}${czk(Math.round(Math.abs(w - fw) * 10) / 10)} kg</span>` : ""}</div>`
      : "") +
    `</td></tr></table>`;

  // míry
  const m = r.measurements || {}, pm = (prev && prev.measurements) || {};
  const rows = MIRY.filter(([k]) => num(m[k]) != null);
  if (rows.length) {
    b += sect("Míry (cm)") + `<table role='presentation' width='100%' cellpadding='0' cellspacing='0' style='border-collapse:collapse;font-size:14px'>` +
      `<tr class='mb-mut' style='color:#8F8A99;font-size:12px;text-transform:uppercase'><td style='padding:6px 8px;border-bottom:1px solid #262232'>Místo</td><td align='right' style='padding:6px 8px;border-bottom:1px solid #262232'>Teď</td><td align='right' style='padding:6px 8px;border-bottom:1px solid #262232'>Minule</td><td align='right' style='padding:6px 8px;border-bottom:1px solid #262232'>Změna</td></tr>`;
    for (const [k, label] of rows) {
      const cur = num(m[k]), pr = num(pm[k]);
      b += `<tr><td class='mb-body' style='padding:7px 8px;border-bottom:1px solid #211d2b;color:#F0EADF'>${label}</td>` +
        `<td class='mb-w' align='right' style='padding:7px 8px;border-bottom:1px solid #211d2b;color:#fff;font-weight:700'>${czk(cur)}</td>` +
        `<td class='mb-mut' align='right' style='padding:7px 8px;border-bottom:1px solid #211d2b;color:#8F8A99'>${czk(pr)}</td>` +
        `<td align='right' style='padding:7px 8px;border-bottom:1px solid #211d2b'>${delta(cur, pr) || "<span class='mb-mut' style='color:#8F8A99'>—</span>"}</td></tr>`;
    }
    b += `</table>`;
  } else {
    b += sect("Míry (cm)") + `<p class='mb-mut' style='margin:0;font-size:13px;color:#8F8A99'>Tento týden neměřeno.</p>`;
  }

  // strava (nutrition === null → klient tenhle týden nezapisoval, čísla si nevymýšlel)
  if (r.nutrition == null) {
    b += sect("Strava") + `<p class='mb-mut' style='margin:0;font-size:13px;color:#8F8A99'>Tenhle týden strava nezapsána, klient nezapisoval.</p>`;
  } else {
    const n = r.nutrition || {};
    b += sect(`Strava: týdenní průměr${n.dny_zapsano != null ? ` (zapsáno ${esc(n.dny_zapsano)}/7 dní)` : ""}`) +
      `<table role='presentation' width='100%' cellpadding='0' cellspacing='0' style='border-collapse:separate;border-spacing:6px 0;table-layout:fixed'><tr>` +
      [["kcal", "kcal"], ["protein", "bílkoviny (g)"], ["carbs", "sacharidy (g)"], ["fat", "tuky (g)"], ["fiber", "vláknina (g)"]]
        .map(([k, l]) => `<td class='mb-box' align='center' style='background:#211d2b;border:1px solid #2e2940;border-radius:8px;padding:10px 4px'><div class='mb-w' style='font-size:18px;font-weight:800;color:#fff'>${czk(num(n[k]))}</div><div class='mb-mut' style='font-size:11px;color:#8F8A99'>${l}</div></td>`).join("") +
      `</tr></table>`;

    // volitelný denní rozpis (jako záložky týdnů v Excelu)
    // deno-lint-ignore no-explicit-any
    const dny = (Array.isArray(n.dny) ? n.dny : []).filter((x: any) => x);
    if (dny.length) {
      b += `<table role='presentation' width='100%' cellpadding='0' cellspacing='0' style='border-collapse:collapse;font-size:13px;margin-top:10px'>` +
        `<tr class='mb-mut' style='color:#8F8A99;font-size:11px;text-transform:uppercase'><td style='padding:5px 8px;border-bottom:1px solid #262232'>Den</td>` +
        ["kcal", "B", "S", "T", "Vl"].map((h) => `<td align='right' style='padding:5px 8px;border-bottom:1px solid #262232'>${h}</td>`).join("") + `</tr>` +
        // deno-lint-ignore no-explicit-any
        dny.map((d: any) =>
          `<tr><td class='mb-mut' style='padding:5px 8px;border-bottom:1px solid #211d2b;color:#8F8A99'>${esc(d.den ?? "")}</td>` +
          [d.kcal, d.p, d.c, d.f, d.fib].map((v) => `<td class='mb-body' align='right' style='padding:5px 8px;border-bottom:1px solid #211d2b;color:#F0EADF'>${czk(num(v))}</td>`).join("") + `</tr>`).join("");
      b += `</table>`;
    }
  }

  // aktivity
  const a = r.activity || {};
  const prevAct = (prev && prev.activity) || {};
  b += sect("Aktivity") + `<table role='presentation' width='100%' cellpadding='0' cellspacing='0' class='mb-body' style='font-size:14px;color:#F0EADF'>` +
    `<tr><td style='padding:4px 0'>🚶 Kroky (Ø/den)</td><td class='mb-w' align='right' style='font-weight:700;color:#fff'>${czk(num(a.kroky))}${delta(num(a.kroky), num(prevAct.kroky), false)}</td></tr>` +
    `<tr><td style='padding:4px 0'>🏋️ Fitko</td><td class='mb-w' align='right' style='font-weight:700;color:#fff'>${a.fitko != null && a.fitko !== "" ? esc(a.fitko) + "×" : "—"}</td></tr>` +
    `<tr><td style='padding:4px 0'>⏱️ Sport celkem (min/týden)</td><td class='mb-w' align='right' style='font-weight:700;color:#fff'>${num(a.sport_min) != null ? czk(num(a.sport_min)) : "—"}${delta(num(a.sport_min), num(prevAct.sport_min), false)}</td></tr>` +
    `<tr><td style='padding:4px 0'>🏃 Kardio</td><td class='mb-w' align='right' style='font-weight:700;color:#fff'>${esc(a.kardio || "—")}</td></tr>` +
    `<tr><td style='padding:4px 0'>⚽ Další</td><td class='mb-w' align='right' style='font-weight:700;color:#fff'>${esc(a.dalsi || "—")}</td></tr></table>`;

  // plán z minulého reportu vs. realita — jen když si ho klient minule nastavil
  const prevPlan = prevAct.plan_next;
  if (prevPlan && (num(prevPlan.kroky) != null || num(prevPlan.sport_min) != null)) {
    const planOk = (planV: number | null, realV: number | null) =>
      planV == null || realV == null ? "" : (realV >= planV ? " ✓" : ` (plán ${czk(planV)})`);
    b += `<p class='mb-mut' style='margin:8px 0 0;font-size:13px;color:#8F8A99'>Plán z minulého reportu: ` +
      `${czk(num(prevPlan.kroky))} kroků · ${czk(num(prevPlan.sport_min))} min sportu. ` +
      `Realita: ${czk(num(a.kroky))} kroků${planOk(num(prevPlan.kroky), num(a.kroky))} · ` +
      `${czk(num(a.sport_min))} min${planOk(num(prevPlan.sport_min), num(a.sport_min))}.</p>`;
  }

  // plán na příští týden
  const pn = a.plan_next || {};
  if (num(pn.kroky) != null || num(pn.sport_min) != null) {
    b += sect("Plán na příští týden") +
      `<p class='mb-body' style='margin:0;font-size:14px;color:#F0EADF'>🚶 <strong>${czk(num(pn.kroky))}</strong> kroků denně · ⏱️ <strong>${czk(num(pn.sport_min))}</strong> min sportu za týden` +
      `${pn.stejne ? ` <span class='mb-mut' style='color:#8F8A99'>(stejně jako tento týden)</span>` : ""}</p>`;
  }

  // škály
  const s = r.scales || {};
  b += sect("Pocity (1–5)") + `<table role='presentation' width='100%' cellpadding='0' cellspacing='0' class='mb-body' style='font-size:14px;color:#F0EADF'>` +
    `<tr><td style='padding:4px 0;width:44%'>Únava</td><td>${dots(s.unava)}</td><td class='mb-mut' align='right' style='color:#8F8A99'>${s.unava || "—"}/5</td></tr>` +
    `<tr><td style='padding:4px 0'>Hlad</td><td>${dots(s.hlad)}</td><td class='mb-mut' align='right' style='color:#8F8A99'>${s.hlad || "—"}/5</td></tr>` +
    `<tr><td style='padding:4px 0'>Síla</td><td>${dots(s.sila)}</td><td class='mb-mut' align='right' style='color:#8F8A99'>${s.sila || "—"}/5</td></tr>` +
    `<tr><td style='padding:4px 0'>Spánek</td><td>${dots(s.spanek_kvalita)}</td><td class='mb-mut' align='right' style='color:#8F8A99'>${s.spanek_h ? czk(num(s.spanek_h)) + " h · " : ""}${s.spanek_kvalita || "—"}/5</td></tr>` +
    `<tr><td style='padding:4px 0'>Dodržení plánu</td><td>${dots(s.dodrzeni)}</td><td class='mb-mut' align='right' style='color:#8F8A99'>${s.dodrzeni || "—"}/5</td></tr></table>`;

  // slovně
  const t = r.notes || {};
  if (t.povedlo || t.drhlo || t.otazky || t.dalsi) {
    b += sect("Slovní zhodnocení");
    if (t.povedlo) b += `<p style='margin:0 0 8px;font-size:14px'><span class='mb-good' style='color:#4fc07a;font-weight:700'>✓ Povedlo se:</span> ${esc(t.povedlo)}</p>`;
    if (t.drhlo) b += `<p style='margin:0 0 8px;font-size:14px'><span class='mb-warn' style='color:#e0a04f;font-weight:700'>✗ Drhlo:</span> ${esc(t.drhlo)}</p>`;
    if (t.otazky) b += `<p style='margin:0 0 8px;font-size:14px'><span class='mb-gold' style='color:#EBB12C;font-weight:700'>? Otázka:</span> ${esc(t.otazky)}</p>`;
    if (t.dalsi) b += `<p style='margin:0 0 8px;font-size:14px'><span class='mb-b9' style='color:#B9B3C4;font-weight:700'>💬 Navíc:</span> ${esc(t.dalsi)}</p>`;
  }

  // fotky
  const nPhotos = Array.isArray(r.photos) ? r.photos.length : 0;
  if (nPhotos) b += sect("Fotky") + `<p class='mb-body' style='margin:0;font-size:14px;color:#F0EADF'>📷 Přiloženo <strong>${nPhotos}×</strong>, najdeš je u klienta v adminu (a klient ve své sekci).</p>`;

  b += `<p style='margin:20px 0 4px'><a class='mb-btn' href='https://martinbarna.cz/akademie/klient/' style='display:inline-block;background:#EBB12C;color:#1A1222;text-decoration:none;padding:13px 26px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;font-size:15px'>Otevřít grafy v klientské sekci</a></p>`;
  return b;
}

// deno-lint-ignore no-explicit-any
function intakeMail(name: string, d: any): string {
  const S = (t: string, obj: Record<string, string>) => {
    const rows = Object.entries(obj).filter(([, v]) => v);
    if (!rows.length) return "";
    return sect(t) + rows.map(([k, v]) => `<p style='margin:0 0 7px;font-size:14px'><span class='mb-mut' style='color:#8F8A99'>${k}:</span> <span class='mb-body' style='color:#F0EADF'>${esc(v)}</span></p>`).join("");
  };
  let b = `<p class='mb-w' style='margin:0 0 4px;font-size:20px;font-weight:800;color:#fff'>${esc(name)}</p>` +
    `<p class='mb-mut' style='margin:0 0 12px;color:#8F8A99;font-size:14px'>Vstupní dotazník nového klienta</p>`;
  b += S("Osobní", { "Věk": d.vek, "Výška": d.vyska ? d.vyska + " cm" : "", "Váha": d.vaha ? d.vaha + " kg" : "", "Telefon": d.telefon });
  b += S("Cíl a proč", { "Cíl": d.cil, "Proč (motivace)": d.proc, "Do kdy / událost": d.termin });
  b += S("Historie", { "Diety v minulosti": d.diety, "Sport dřív a teď": d.sport });
  b += S("Zdraví (jen pro Martina: neradíme, jen sběr)", { "Omezení / diagnózy": d.zdravi, "Léky / doplňky": d.leky, "Alergie": d.alergie });
  b += S("Jídlo", { "Co nejí / nesnáší": d.neji, "Kolik jídel denně": d.jidel_denne, "Kdo vaří / jak se stravuje": d.vareni });
  b += S("Trénink", { "Kde může cvičit": d.kde_cvici, "Kolik dní v týdnu": d.dny_treninku, "Vybavení": d.vybaveni });
  b += S("Režim", { "Práce / směny": d.prace, "Úroveň aktivity": d.aktivita, "Kroky/den (odhad)": d.kroky, "Spánek (h)": d.spanek });
  b += S("Výchozí míry (cm)", Object.fromEntries(MIRY.map(([k, l]) => [l, d["mira_" + k] || ""])));
  if (Array.isArray(d.fotky) && d.fotky.length) b += sect("Výchozí fotky") + `<p style='margin:0 0 7px;font-size:14px;color:#F0EADF'>📷 Přiloženo <strong>${d.fotky.length}×</strong>, najdeš je u klienta v adminu.</p>`;
  if (d.poznamka) b += S("Poznámka", { "Vzkaz": d.poznamka });
  return b;
}

// Martin chce kopii všech mailů, co chodí klientům (jako u mailingu) → BCC na jeho gmail.
const BCC_COACH = "fitness.barna@gmail.com";
async function send(to: string, subject: string, html: string, bccCoach = false) {
  if (!RESEND_KEY) return { status: 0 };
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM, to: [to], subject, html, reply_to: COACH, ...(bccCoach ? { bcc: [BCC_COACH] } : {}) }),
  });
  return { status: r.status };
}

Deno.serve(async (req: Request) => {
  const C = cors(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: C });
  if (req.method !== "POST") return json({ error: "method" }, C, 405);

  // 1) auth: JWT klienta -> email + entitlement coaching
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer /, "");
  if (!token) return json({ error: "auth" }, C, 401);
  const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } });
  const { data: udata } = await userClient.auth.getUser(token);
  const email = (udata?.user?.email ?? "").toLowerCase();
  if (!email) return json({ error: "auth" }, C, 401);
  const { data: ent } = await userClient.rpc("has_entitlement", { p_product: "coaching" });
  if (ent !== true) return json({ error: "no_coaching" }, C, 403);

  let body: { action?: string; name?: string; data?: Record<string, unknown> };
  try { body = await req.json(); } catch { return json({ error: "bad_json" }, C, 400); }
  const action = String(body.action ?? "");
  const data = (body.data ?? {}) as Record<string, unknown>;
  const name = String(body.name ?? "").slice(0, 120) || email;

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

  // Blok „co teď udělat" JEN do Martinovy kopie mailu (klient dostává totéž `html` bez něj).
  // Smysl: Martin po reportu nemá lovit, kde se co nastavuje. Odkaz otevře rovnou detail
  // toho klienta v adminu (#klient=<email>) a text řekne, co konkrétně přenastavit.
  type Cile = { kcal: number | null; protein: number | null; kroky: number | null; sport_min: number | null; treninky: number | null } | null;
  function coachTodo(mail: string, r: Record<string, unknown>, tg: Cile): string {
    const odkaz = `https://martinbarna.cz/akademie/admin/#klient=${encodeURIComponent(mail)}`;
    const n = (r.nutrition ?? {}) as Record<string, unknown>;
    const a = (r.activity ?? {}) as Record<string, unknown>;
    const radky: string[] = [];
    if (!tg) {
      radky.push(`<span class='mb-warn' style='color:#e0a04f'>Tenhle klient zatím nemá zadání.</span> Bez něj nevidí ve své sekci, co má dodržet, a nepočítají se mu odchylky. Nastav mu kalorie, bílkoviny, kroky, minuty sportu a počet tréninků.`);
    } else {
      // Porovnání TOHOTO reportu proti zadání. Chybějící hodnota nebo chybějící cíl = řádek se
      // nevypíše, nikdy nedopočítávat (viz stejné pravidlo v klientské sekci).
      // ⚠️ Barva MUSÍ sedět 1:1 s klientskou sekcí (funkce delta()), jinak totéž číslo svítí
      // na webu oranžově a v mailu zeleně. U bílkovin, kroků a tréninků je „nad cíl" dobře.
      // U KALORIÍ ne: hubnoucí klient, co snědl 2200 místo 1800, není splněno, proto pásmo ±5 %.
      const porovnej = (label: string, cil: number | null, real: number | null, jednotka: string, vyssiJeLepsi: boolean) => {
        if (cil == null || real == null) return;
        const d = Math.round(real - cil);
        if (d === 0) return;
        const dobre = vyssiJeLepsi ? d > 0 : Math.abs(d) <= Math.max(1, Math.round(cil * 0.05));
        const barva = dobre ? "mb-good" : "mb-warn";
        radky.push(`${label}: <b>${czk(real)} ${jednotka}</b>, cíl ${cil} <span class='${barva}' style='color:${dobre ? "#4fc07a" : "#e0a04f"}'>(${d > 0 ? "+" : "−"}${Math.abs(d)})</span>`);
      };
      porovnej("Kalorie", tg.kcal, num(n.kcal), "kcal", false);
      porovnej("Bílkoviny", tg.protein, num(n.protein), "g", true);
      porovnej("Kroky", tg.kroky, num(a.kroky), "", true);
      porovnej("Sport", tg.sport_min, num(a.sport_min), "min", true);
      porovnej("Tréninky", tg.treninky, num(a.fitko), "×", true);
      if (!radky.length) radky.push(`<span class='mb-good' style='color:#4fc07a'>Sedí na zadání ve všech sledovaných číslech.</span> Když necháváš plán beze změny, stačí klientovi napsat vzkaz do zadání, ať ví, že to tak má být.`);
    }
    return `<div class='mb-sect' style='font-weight:800;color:#F6CD63;font-size:13px;letter-spacing:.14em;text-transform:uppercase;margin:0 0 8px'>➡️ Co teď udělat</div>` +
      `<table role='presentation' class='mb-box' width='100%' cellpadding='0' cellspacing='0' style='background:#211d2b;border:1px solid #2e2940;border-radius:10px;margin:0 0 18px'><tr><td style='padding:16px 20px'>` +
      radky.map((t) => `<p class='mb-body' style='margin:0 0 8px;font-size:14px;line-height:1.5'>${t}</p>`).join("") +
      `<p style='margin:12px 0 4px'><a class='mb-btn' href='${odkaz}' style='display:inline-block;background:#EBB12C;color:#1A1222;text-decoration:none;padding:12px 22px;font-weight:700;font-size:14px;border-radius:6px'>Upravit zadání klienta</a></p>` +
      `<p class='mb-mut' style='margin:6px 0 0;font-size:12px;color:#8F8A99'>Odkaz otevře admin rovnou na detailu tohoto klienta, zadání je hned nahoře pod jeho e-mailem. Co tam uložíš, uvidí klient ve své sekci.</p>` +
      `</td></tr></table>`;
  }

  if (action === "report") {
    // Cíl NEJDŘÍV, protože se ukládá jako SNÍMEK do reportu. Kdyby se odchylka počítala proti
    // aktuálnímu cíli, zvýšení kalorií z 1800 na 2200 by zpětně obarvilo celou historii na
    // „−400", i když klient tehdy plnil přesně. Snímek to zavírá: minulost se už nikdy nemění.
    const { data: tgRow } = await admin.from("client_targets")
      .select("kcal,protein,kroky,sport_min,treninky").eq("email", email).maybeSingle();
    const row = {
      email,
      // datum v Europe/Prague — report odeslaný po půlnoci CZ nesmí dostat včerejší (UTC) datum
      report_date: new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Prague" }).format(new Date()),
      weight: num(data.weight),
      measurements: data.measurements ?? {},
      nutrition: data.nutrition === null ? null : (data.nutrition ?? {}), // null = klient stravu nezapisoval
      activity: data.activity ?? {},
      scales: data.scales ?? {},
      notes: data.notes ?? {},
      photos: Array.isArray(data.photos) ? data.photos.slice(0, 12).map((p: unknown) => String(p).slice(0, 300)) : [],
      // null = v tu chvíli klient žádné zadání neměl; klientská sekce pak u toho reportu
      // odchylku vůbec nezobrazí (viz client-targets.sql).
      targets: tgRow ?? null,
      source: "web",
    };
    // předchozí + první report pro šipky (bez dnešního — re-submit v tentýž den je update)
    const { data: histAll } = await admin.from("client_reports").select("weight,measurements,activity,report_date")
      .eq("email", email).order("report_date", { ascending: true });
    const hist = (histAll ?? []).filter((h) => h.report_date < row.report_date);
    const prev = hist.length ? hist[hist.length - 1] : null;
    const first = hist.length ? hist[0] : null;
    const { error } = await admin.from("client_reports").upsert(row, { onConflict: "email,report_date" });
    if (error) return json({ error: "db", detail: error.message }, C, 500);

    const weekNo = hist.length + 1;
    const html = reportMail(name, row, prev, first, weekNo);
    const subj = `📊 Týdenní report: ${name}`;
    const coachMail = wrap("Martin Barna · týdenní report klienta", coachTodo(email, row, tgRow ?? null) + html, `Report od ${esc(email)} · klientská sekce martinbarna.cz`);
    const clientMail = wrap("Martin Barna · týdenní report", html, "Kopie reportu pro tvůj přehled. Stejnou dostal Martin a ozve se s úpravou plánu. Martin Barna · martinbarna.cz");
    const s1 = await send(COACH, subj, coachMail);
    const s2 = await send(email, "Tvůj týdenní report ✓ (kopie)", clientMail, true);
    return json({ ok: true, mail_coach: s1.status, mail_client: s2.status }, C);
  }

  if (action === "intake") {
    const { error } = await admin.from("client_intake").insert({ email, data });
    if (error) return json({ error: "db", detail: error.message }, C, 500);
    const html = intakeMail(name, data as Record<string, string>);
    // ⭐ Odkaz rovnou do karty klienta v adminu, kde nová sekce Onboarding spočítá tři
    // varianty cílů z tohohle dotazníku. Stejný tvar odkazu jako u týdenního reportu výš.
    // ⚠️ Jen do MARTINOVY kopie, klientovi se posílá tělo bez něj.
    const adminOdkaz = `https://martinbarna.cz/akademie/admin/#klient=${encodeURIComponent(email)}`;
    const todo = `<p class='mb-body' style='margin:0 0 14px;padding:10px 12px;background:#241f2e;border-left:3px solid #EBB12C;font-size:14px;color:#F0EADF'>` +
      `Nový vstupní dotazník. <a href='${adminOdkaz}' style='color:#EBB12C'>Otevři kartu klienta v adminu</a>, ` +
      `sekce Onboarding z něj spočítá varianty cílů a připraví koncept uvítacího mailu.</p>`;
    const coachMail = wrap("Martin Barna · vstupní dotazník", todo + html, `Dotazník od ${esc(email)} · klientská sekce martinbarna.cz`);
    const clientMail = wrap("Martin Barna · vstupní dotazník", html +
      `<p class='mb-ps' style='margin:16px 0 0;color:#A09AAD;font-style:italic;font-size:14px'>Díky! Do 48 hodin ti nastavím plán na míru a ozvu se. Be Effective! Martin</p>`,
      "Kopie dotazníku pro tvůj přehled. Martin Barna · martinbarna.cz");
    const s1 = await send(COACH, `📝 Vstupní dotazník: ${name}`, coachMail);
    const s2 = await send(email, "Tvůj vstupní dotazník ✓ (kopie)", clientMail, true);
    return json({ ok: true, mail_coach: s1.status, mail_client: s2.status }, C);
  }

  if (action === "reference") {
    // Klient souhlasí s použitím svého pokroku jako reference → mail Martinovi + záznam do poznámek.
    const text = String(data.text ?? "").trim();
    if (!text) return json({ error: "no_text" }, C, 400);
    const { data: reps } = await admin.from("client_reports").select("report_date,weight")
      .eq("email", email).order("report_date", { ascending: true });
    const first = reps && reps.length ? reps[0] : null, last = reps && reps.length ? reps[reps.length - 1] : null;
    const fw = first ? num(first.weight) : null, lw = last ? num(last.weight) : null;
    const pokrok = (fw != null && lw != null)
      ? `${czk(fw)} kg → ${czk(lw)} kg (${lw - fw > 0 ? "+" : lw - fw < 0 ? "−" : ""}${czk(Math.round(Math.abs(lw - fw) * 10) / 10)} kg za ${reps!.length} reportů, ${first!.report_date} – ${last!.report_date})`
      : `${reps?.length ?? 0} reportů`;
    const html = `<p class='mb-w' style='margin:0 0 4px;font-size:20px;font-weight:800;color:#fff'>${esc(name)}</p>` +
      `<p class='mb-mut' style='margin:0 0 14px;color:#8F8A99;font-size:14px'>souhlasí s použitím jako reference (jméno + slova + čísla)</p>` +
      sect("Jeho/její slova") + `<p class='mb-body' style='margin:0 0 12px;font-size:15px;color:#F0EADF'>„${esc(text)}“</p>` +
      sect("Pokrok z reportů") + `<p class='mb-body' style='margin:0 0 12px;font-size:14px;color:#F0EADF'>${pokrok}</p>` +
      `<p class='mb-ps' style='margin:16px 0 0;color:#A09AAD;font-size:13px'>Kontakt: ${esc(email)}. Ozvi se, poděkuj a klidně popros o fotku před/po.</p>`;
    const s1 = await send(COACH, `🌟 Souhlas s referencí: ${name}`, wrap("Martin Barna · reference", html, "Souhlas přišel z klientské sekce martinbarna.cz"));
    try { await admin.from("client_notes").insert({ email, note: "🌟 SOUHLAS S REFERENCÍ: „" + text.slice(0, 500) + "“ (" + pokrok + ")" }); } catch { /* best-effort */ }
    return json({ ok: true, mail_coach: s1.status }, C);
  }

  return json({ error: "unknown_action" }, C, 400);
});
