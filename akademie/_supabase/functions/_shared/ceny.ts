// ============================================================================
// CENY PRO MAILOVÉ ŠABLONY: jedno místo, odkud je renderery berou (23. 9. 2026)
// ============================================================================
// PROČ: v `email_templates` stálo kolem 110 cen natvrdo číslem (249, 499, 8 900,
// 990, 2 990...). Změna ceníku maily neopravila a nikde to nekřiklo; jedinou
// pojistkou byl ruční checklist `tvujcoach-cenik-zmena-checklist`. Martin 23. 9.:
// „mělo to být ošetřeno, že se ceny mají načítat z webu, ale jinak prosím vyřešit."
//
// ODKUD SE CO BERE (a proč právě odtud):
//   1. Ceny APPKY (Basic, VIP, měsíc i rok) z `pricing_plans` v DB appky, tedy ze
//      STEJNÉHO místa, odkud je za běhu bere prodejní stránka `/tvuj-coach/`
//      i ceník v appce. Kopie do Academy by byla přesně ta druhá pravda, která se
//      tiše rozejde: Martin změní ceník v adminu appky a maily by lhaly dál.
//   2. Ceny produktů ACADEMY (videokurz, Academy, konzultace, balíček, doplatky)
//      z `app_config` v Academy DB, klíče `cena_*`. Tyhle produkty žádnou tabulku
//      cen nemají: pravda je cena za platebním odkazem ve Stripu a web ji má
//      opsanou v HTML. `app_config` je tedy JEDINÉ místo, které mail čte; kdo mění
//      cenu ve Stripu, mění i tenhle řádek (checklist ceníku).
//
// ⛔ CHYBA ČTENÍ NENÍ CENA (CLAUDE.md pravidlo 13). Když se cena nenačte, v `hodnoty`
//    prostě CHYBÍ a do `chyby` přibude důvod. Žádný záložní údaj, žádná stará
//    konstanta: mail, který cenu potřebuje, se NEPOŠLE a počká na další běh.
//    Rozhoduje o tom volající přes `chybejiciCeny()`; tenhle modul nic neposílá
//    kromě alertu Martinovi.
//
// FORMÁT: „8 900" (obyčejná mezera po tisících, stejně jako `kc()` na `/tvuj-coach/`
//    a jako šablony), BEZ „Kč". Šablona píše `{{cena_academy}} Kč`, stejně jako
//    léta píše `{{course_price}} Kč`.
// ============================================================================

import { ctiSOpakovanim } from "./secret-guard.ts";
import { odesliPresResend } from "./resend-odeslat.ts";

// deno-lint-ignore no-explicit-any
type Admin = any;

/** REST ceníku appky. Tentýž dotaz (aktivní plány) dělá prodejní stránka `/tvuj-coach/`. */
export const APP_CENIK_URL =
  "https://kfkmghvhqwqtsalqjmrp.supabase.co/rest/v1/pricing_plans?select=tier,interval,price_czk,segment&active=eq.true";
/**
 * VEŘEJNÝ anon klíč appky, tentýž, který nese `tvuj-coach/index.html` v prohlížeči.
 * Není to tajemství (RLS politika `plans_select` pouští aktivní plány i nepřihlášeným).
 * ⚠️ Až se klíč appky otočí, dotaz vrátí 401: maily s cenou appky se zastaví
 *    a přijde alert. Je to hlasité selhání, ne tiché, proto je tu natvrdo.
 */
export const APP_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtma21naHZocXdxdHNhbHFqbXJwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4ODA2NjQsImV4cCI6MjA5NTQ1NjY2NH0.8meIfIw51xCttJQa2WHMuX7ArbuCh4kK7t-ZWG7JSQA";
const TIMEOUT_CENIKU_MS = 5000;

/** Proměnná šablony -> řádek `pricing_plans`. ⛔ Tier `ai_basic` JE VIP, ne Basic. */
export const Z_CENIKU_APPKY: Record<string, { tier: string; interval: string }> = {
  cena_basic_mesic: { tier: "basic", interval: "month" },
  cena_basic_rok: { tier: "basic", interval: "year" },
  cena_vip_mesic: { tier: "ai_basic", interval: "month" },
  cena_vip_rok: { tier: "ai_basic", interval: "year" },
};

/**
 * Proměnná šablony = klíč v Academy `app_config` (1:1, ať se to nedá splést).
 * Hodnota v `app_config` je celé číslo v Kč bez mezer, např. `8900`.
 */
export const Z_APP_CONFIG = [
  "cena_videokurz",            // videokurz výživy (Stripe odkaz ...ks0h)
  "cena_academy",              // Barna Academy doživotně
  "cena_academy_mesic",        // Barna Academy měsíční členství
  "cena_academy_upgrade",      // doživotní Academy pro majitele videokurzu (odkaz 7 410)
  "cena_academy_po_odectu",    // doživotní Academy pro měsíčního člena po 3 platbách (odkaz 5 930)
  "cena_konzultace",           // konzultace (s videokurzem v ceně)
  "cena_konzultace_sleva",     // konzultace pro majitele videokurzu
  "cena_balicek",              // balíček 40 receptů a 48 odpovědí
  "cena_doplatek_videokurz",   // doplatek z balíčku na videokurz
] as const;

/**
 * Odvozené proměnné. Počítají se z načtených cen, v DB nikde nejsou.
 *  - `course_price`: historický název ceny videokurzu, stojí ve 147 šablonách.
 *  - `cena_academy_3_mesice`: kolik měsíční člen zaplatil za tři měsíce (věta
 *    „za tu dobu tě stála ..."), tedy 3 × měsíční cena.
 *  - `discount_price`, `discount2_price`: sleva na videokurz, počítá je renderer
 *    přes `slevyVideokurzu()`, protože procenta slev žijí u něj.
 */
export const ODVOZENE = ["course_price", "cena_academy_3_mesice", "discount_price", "discount2_price"] as const;

/** Všechny proměnné, které nesou cenu. Chybějící z nich = mail počká, nechybí text. */
export const CENOVE_PROMENNE: readonly string[] = [
  ...Object.keys(Z_CENIKU_APPKY),
  ...Z_APP_CONFIG,
  ...ODVOZENE,
];

/** 8900 -> "8 900", 249 -> "249". Obyčejná mezera, jako `kc()` na `/tvuj-coach/`. */
export function formatujCenu(n: number): string {
  const s = String(Math.round(n));
  let out = "";
  for (let i = 0; i < s.length; i++) {
    if (i > 0 && (s.length - i) % 3 === 0) out += " ";
    out += s[i];
  }
  return out;
}

/** Kladné konečné číslo, jinak null. „0", prázdno i nesmysl NEJSOU cena. */
function platnaCena(v: unknown): number | null {
  const n = typeof v === "number" ? v : Number(String(v ?? "").trim().replace(/\s/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}

export type Ceny = {
  /** Proměnná -> hodnota pro šablonu („8 900"). Obsahuje JEN to, co se opravdu načetlo. */
  hodnoty: Record<string, string>;
  /** Proměnná -> číslo (pro dopočty, např. slevu na videokurz). */
  cisla: Record<string, number>;
  /** Proč něco chybí. Prázdné pole = všechny ceny jsou načtené. */
  chyby: string[];
};

type Radek = Record<string, unknown>;

/**
 * ČISTÁ funkce (bez sítě, testuje se v `ceny.test.ts`). Dostane výsledky obou
 * čtení tak, jak dopadla, a složí z nich ceny. Co se nenačetlo, CHYBÍ.
 */
export function sestavCeny(
  config: { data: Radek[] | null; error: unknown },
  cenik: { data: Radek[] | null; error: unknown },
): Ceny {
  const hodnoty: Record<string, string> = {};
  const cisla: Record<string, number> = {};
  const chyby: string[] = [];
  const zapis = (k: string, n: number) => { cisla[k] = n; hodnoty[k] = formatujCenu(n); };

  // 1) app_config (Academy)
  if (config.error || !Array.isArray(config.data)) {
    chyby.push("app_config neprecten: " + popis(config.error));
  } else {
    const mapa = new Map(config.data.map((r) => [String(r.key ?? ""), r.value]));
    for (const k of Z_APP_CONFIG) {
      if (!mapa.has(k)) { chyby.push("app_config." + k + " chybi"); continue; }
      const n = platnaCena(mapa.get(k));
      if (n === null) { chyby.push("app_config." + k + " neni platna cena: " + String(mapa.get(k)).slice(0, 20)); continue; }
      zapis(k, n);
    }
  }

  // 2) pricing_plans (appka). Jen řádky bez segmentu: segmentová cena je nabídka
  //    pro vybranou skupinu, ne ceník. Dva obecné aktivní řádky na tentýž plán = nevím,
  //    který platí, a to je chyba, ne „vezmi první" (web bere první, mail nesmí hádat).
  if (cenik.error || !Array.isArray(cenik.data)) {
    chyby.push("pricing_plans neprecten: " + popis(cenik.error));
  } else {
    for (const [k, { tier, interval }] of Object.entries(Z_CENIKU_APPKY)) {
      const shoda = cenik.data.filter((r) => r.tier === tier && r.interval === interval && (r.segment ?? null) === null);
      if (shoda.length !== 1) { chyby.push("pricing_plans " + tier + "/" + interval + ": " + shoda.length + " aktivnich radku"); continue; }
      const n = platnaCena(shoda[0].price_czk);
      if (n === null) { chyby.push("pricing_plans " + tier + "/" + interval + " neni platna cena"); continue; }
      zapis(k, n);
    }
  }

  // 3) Odvozené. Jen z toho, co se opravdu načetlo.
  if (cisla.cena_videokurz) zapis("course_price", cisla.cena_videokurz);
  if (cisla.cena_academy_mesic) zapis("cena_academy_3_mesice", 3 * cisla.cena_academy_mesic);
  return { hodnoty, cisla, chyby };
}

/** Sleva na videokurz v procentech -> hodnoty pro šablonu. Bez ceny kurzu prázdné. */
export function slevyVideokurzu(ceny: Ceny, procenta: Record<string, number>): Record<string, string> {
  const vk = ceny.cisla.cena_videokurz;
  if (!vk) return {};
  const out: Record<string, string> = {};
  for (const [k, pct] of Object.entries(procenta)) out[k] = formatujCenu(Math.round(vk * (1 - pct / 100)));
  return out;
}

function popis(e: unknown): string {
  if (e && typeof e === "object" && "message" in e) return String((e as { message: unknown }).message).slice(0, 120);
  return String(e ?? "prazdna odpoved").slice(0, 120);
}

/**
 * Načte ceny z obou míst. Každé čtení má opakování (brána Supabase shazuje asi
 * 1,35 % požadavků) a ceník appky navíc tvrdý timeout, ať visící dotaz nesežere běh.
 * Nikdy nehází: selhání se vrací v `chyby`.
 */
export async function nactiCeny(admin: Admin, fetchFn: typeof fetch = fetch): Promise<Ceny> {
  const [config, cenik] = await Promise.all([
    ctiSOpakovanim<{ data: Radek[] | null; error: unknown }>(
      () => admin.from("app_config").select("key,value").in("key", [...Z_APP_CONFIG]),
      2,
    ),
    ctiSOpakovanim<{ data: Radek[] | null; error: unknown }>(async () => {
      const r = await fetchFn(APP_CENIK_URL, {
        headers: { apikey: APP_ANON_KEY, Authorization: "Bearer " + APP_ANON_KEY },
        signal: AbortSignal.timeout(TIMEOUT_CENIKU_MS),
      });
      if (!r.ok) return { data: null, error: new Error("HTTP " + r.status) };
      return { data: (await r.json()) as Radek[], error: null };
    }, 2),
  ]);
  return sestavCeny(config, cenik);
}

/** Všechny `{{promenne}}` v šabloně (předmět, preheader, bloky). */
export function promenneVSablone(tpl: { subject?: unknown; preheader?: unknown; blocks?: unknown }): string[] {
  const text = String(tpl.subject ?? "") + " " + String(tpl.preheader ?? "") + " " + JSON.stringify(tpl.blocks ?? []);
  const out = new Set<string>();
  for (const m of text.matchAll(/\{\{([^{}]*)\}\}/g)) out.add(m[1]);
  return [...out];
}

/** Cenové proměnné, které šablona používá a které se NENAČETLY. Neprázdné = neposílat. */
export function chybejiciCeny(
  tpl: { subject?: unknown; preheader?: unknown; blocks?: unknown },
  vars: Record<string, string>,
): string[] {
  return promenneVSablone(tpl).filter((k) => CENOVE_PROMENNE.includes(k) && !(k in vars));
}

/** Všechny proměnné šablony, pro které renderer nemá hodnotu (cenové i neznámé). */
export function chybejiciPromenne(
  tpl: { subject?: unknown; preheader?: unknown; blocks?: unknown },
  vars: Record<string, string>,
): string[] {
  return promenneVSablone(tpl).filter((k) => !(k in vars));
}

export const ALERT_CENY_ODSTUP_MS = 6 * 3600 * 1000;

/**
 * Alert Martinovi, že mail s cenou (nebo s neznámou proměnnou) NEODEŠEL.
 * Nejvýš jeden za 6 h na `klic` (funkce + druh problému): cron `drip-send` jede
 * každou hodinu a výpadek ceníku by jinak nasypal alert do každého běhu.
 * Značka odstupu je řádek `email_events` typu `alert_ceny` (bez `provider_id`,
 * takže ho `resend-webhook` ani denní strop nevidí; jistič čte jen `error`).
 * ⛔ Když se značka nedá přečíst, alert se POŠLE: radši dva alerty než žádný.
 * ⛔ Nejde přes `sendIfAllowed`: brána chrání adresu zákazníka, ne Martinovu.
 */
export async function alertCeny(admin: Admin, resendKey: string, klic: string, predmet: string, text: string): Promise<boolean> {
  try {
    const od = new Date(Date.now() - ALERT_CENY_ODSTUP_MS).toISOString();
    const { data, error } = await admin.from("email_events").select("id")
      .eq("type", "alert_ceny").eq("detail->>klic", klic).gte("created_at", od).limit(1);
    if (!error && Array.isArray(data) && data.length > 0) return false;
  } catch { /* nevím => posílám */ }
  let to = "fitness.barna@gmail.com";
  try {
    const { data } = await admin.from("app_config").select("value").eq("key", "admin_emails").maybeSingle();
    const prvni = String(data?.value || "").split(",").map((s: string) => s.trim()).filter(Boolean)[0];
    if (prvni) to = prvni;
  } catch { /* zůstává výchozí adresa */ }
  const r = await odesliPresResend(resendKey, {
    from: "Martin Barna <news@martinbarna.cz>",
    to: [to],
    subject: predmet,
    html: `<pre style="font-family:inherit;white-space:pre-wrap">${text.split("&").join("&amp;").split("<").join("&lt;")}</pre>`,
  });
  const { error: zapErr } = await admin.from("email_events").insert({
    lead_id: null, step: 0, type: "alert_ceny",
    detail: { klic, odeslano: r.ok, status: r.status, predmet: predmet.slice(0, 120) },
  });
  if (zapErr) console.error("[ceny] zapis alert_ceny selhal: " + zapErr.message);
  if (!r.ok) console.error("[ceny] ALERT MARTINOVI NEODESEL: " + klic + " " + (r.chyba ?? ""));
  return r.ok;
}
