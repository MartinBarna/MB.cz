// =============================================================================
// Interní upozornění Martinovi na NOVÝ lead z lead-capture (29. 10. 2026).
//
// Proč vlastní soubor: `index.ts` volá `Deno.serve()` hned při importu, test
// by nastartoval server. Tady je čisté rozhodování a sestavení mailu. Odeslání
// je závislost (`posli`), ať test nevolá síť a ať odeslání zůstane v `posliMail`.
//
// ⛔ VÝCHOZÍ STAV JE VYPNUTO. Chybějící env i chybějící klíč v `app_config`
//    znamenají „neposílat". Zapnutí je až po výslovném GO (viz SQL vedle
//    `akademie/_supabase/lead-alert-2026-10-29.sql`, tenhle PR ho nespouští).
//
// Přepínač, v tomhle pořadí:
//   1. env `LEAD_ALERT` (neprázdné vyhrává): ano / 1 / true / on = zapnuto,
//      cokoliv jiného = vypnuto (kill switch bez zásahu do DB).
//   2. `app_config.lead_alert` se stejnými hodnotami.
//   3. nic z toho = vypnuto.
//
// Strop: `app_config.lead_alert_strop` (celé číslo 1 až 40), jinak 10.
// Do stropu jeden mail na lead. Další lead téhož pražského dne je jednorázový
// souhrn. Všechny další ten den jsou ticho. Ranní `daily-digest` je souhrn
// za včerejšek, tenhle kód ho nenahrazuje a do DB kvůli tomu nic nezapisuje.
//
// ⛔ Tohle NENÍ zákaznický mail. Příjemce je natvrdo interní adresa, ne lead.
//    `mailing-guard` se nevolá (stejně jako u `daily-digest` a alertů v
//    `intake-capture`): brána odhlášení řeší maily lidem, ne provozní alert
//    Martinovi. Odeslání jde jen přes `posliMail`. `MAIL_PROVIDER` se nemění.
//
// ⛔ Selhání čehokoli tady nesmí shodit uložení leadu. `ohlasNovyLead` nehází.
//    Volající ho nesmí `await`ovat v requestu: po insertu už je lead v DB
//    a výjimka v okolním `try` by formuláři vrátila 500.
// =============================================================================

export const ENV_PREPINAC = "LEAD_ALERT";
export const KLIC_PREPINAC = "lead_alert";
export const KLIC_STROP = "lead_alert_strop";
export const VYCHOZI_STROP = 10;
export const ALERT_TO = "fitness.barna@gmail.com";
export const FROM_ALERT = "Martin Barna <news@martinbarna.cz>";

const ZAPNUTO = new Set(["ano", "1", "true", "on"]);

export type Konfig = { prepniac: string | null; strop: string | null };

export type Zavislosti = {
  env: (klic: string) => string | undefined;
  prectiKonfig: () => Promise<Konfig>;
  spocitejOd: (iso: string) => Promise<number>;
  posli: (m: { subject: string; html: string; text: string }) => Promise<{ ok: boolean; status: number }>;
  ted?: Date;
};

export type LeadVstup = {
  email: string;
  name: string;
  source: string;
  track: string;
  duplicate?: boolean;
};

export type Rozhodnuti =
  | { poslat: false; duvod: "duplicita" | "test" | "vypnuto" | "pocet" | "strop" }
  | { poslat: true; druh: "jeden" | "souhrn" };

export function jeAno(raw: string | null | undefined): boolean {
  return ZAPNUTO.has(String(raw ?? "").trim().toLowerCase());
}

/** Neprázdný env vyhrává nad app_config. Prázdné nebo chybějící = čti DB, a když ani tam nic není, vypnuto. */
export function jeZapnuto(env: string | undefined, prepniac: string | null | undefined): boolean {
  if (env !== undefined && env.trim() !== "") return jeAno(env);
  return jeAno(prepniac);
}

export function stropZHodnoty(raw: string | null | undefined): number {
  const n = Number(String(raw ?? "").trim());
  if (!Number.isInteger(n) || n < 1 || n > 40) return VYCHOZI_STROP;
  return n;
}

/**
 * Testovací lead se nehlásí.
 *  - jméno obsahuje samostatné slovo TEST (TEST, TEST-CLAUDE, „A TEST"),
 *  - místní část e-mailu obsahuje `+tester` (jana+tester@…).
 * „Tester" jako jméno a „contest@" se schválně nechytají: to nejsou naše testy.
 */
export function jeTestovaciLead(email: string, name: string): boolean {
  const e = String(email ?? "").trim().toLowerCase();
  const at = e.lastIndexOf("@");
  const local = at >= 0 ? e.slice(0, at) : e;
  if (local.includes("+tester")) return true;
  return /\btest\b/i.test(String(name ?? "").trim());
}

/** Posun Prahy proti UTC v minutách pro daný okamžik (zima 60, léto 120). */
export function prazskyPosunMinut(utcMs: number): number {
  const f = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Prague",
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const p: Record<string, string> = {};
  for (const x of f.formatToParts(new Date(utcMs))) p[x.type] = x.value;
  const jakoUtc = Date.UTC(
    Number(p.year),
    Number(p.month) - 1,
    Number(p.day),
    Number(p.hour) % 24,
    Number(p.minute),
    Number(p.second),
  );
  return Math.round((jakoUtc - utcMs) / 60000);
}

/** Půlnoc aktuálního pražského dne jako ISO v UTC. */
export function pulnocPrahaIso(ted: Date): string {
  const den = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Prague" }).format(ted);
  const [y, m, d] = den.split("-").map(Number);
  let utc = Date.UTC(y, m - 1, d, 0, 0, 0);
  for (let i = 0; i < 3; i++) {
    utc = Date.UTC(y, m - 1, d, 0, 0, 0) - prazskyPosunMinut(utc) * 60000;
  }
  return new Date(utc).toISOString();
}

export function casPraha(ted: Date): string {
  return new Intl.DateTimeFormat("cs-CZ", {
    timeZone: "Europe/Prague",
    day: "numeric",
    month: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(ted);
}

export function rozhodni(o: {
  duplicate: boolean;
  email: string;
  name: string;
  zapnuto: boolean;
  pocetDnes: number | null;
  strop: number;
}): Rozhodnuti {
  if (o.duplicate) return { poslat: false, duvod: "duplicita" };
  if (jeTestovaciLead(o.email, o.name)) return { poslat: false, duvod: "test" };
  if (!o.zapnuto) return { poslat: false, duvod: "vypnuto" };
  if (o.pocetDnes === null || !Number.isFinite(o.pocetDnes)) return { poslat: false, duvod: "pocet" };
  if (o.pocetDnes > o.strop + 1) return { poslat: false, duvod: "strop" };
  if (o.pocetDnes === o.strop + 1) return { poslat: true, druh: "souhrn" };
  return { poslat: true, druh: "jeden" };
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

/** Jeden řádek bez řídicích znaků, ať se do předmětu nedostane zalomení. */
export function jednoradek(s: string, max: number): string {
  return String(s ?? "").replace(/[\u0000-\u001F\u007F]+/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}

export function sestavMail(v: {
  druh: "jeden" | "souhrn";
  source: string;
  track: string;
  email: string;
  kdy: Date;
  pocetDnes: number;
  strop: number;
}): { subject: string; html: string; text: string } {
  const zdroj = jednoradek(v.source, 60) || "neuvedeno";
  const trat = jednoradek(v.track, 60) || "neuvedeno";
  const email = jednoradek(v.email, 320);
  const cas = casPraha(v.kdy);
  const ez = esc(zdroj);
  const et = esc(trat);
  const ee = esc(email);
  const ec = esc(cas);
  if (v.druh === "souhrn") {
    const subject = `Nové leady: dnes ${v.pocetDnes}, jednotlivě končím`.slice(0, 120);
    const text = [
      `Od půlnoci (Praha) je nových leadů ${v.pocetDnes}.`,
      `Strop jednotlivého upozornění je ${v.strop}. Další dnes už neposílám, souhrn je v ranním přehledu.`,
      `Poslední: zdroj ${zdroj}, trať ${trat}, e-mail ${email}, čas ${cas}.`,
    ].join("\n");
    const html =
      `<p><b>Nové leady, strop na dnes</b></p>` +
      `<p>Od půlnoci (Praha) je nových leadů ${v.pocetDnes}. Strop jednotlivého upozornění je ${v.strop}. ` +
      `Další dnes už neposílám, ať jich nejsou desítky. Souhrn je v ranním přehledu.</p>` +
      `<p>Poslední lead:<br>Zdroj: ${ez}<br>Trať: ${et}<br>E-mail: ${ee}<br>Čas: ${ec}</p>`;
    return { subject, html, text };
  }
  const subject = `Nový lead: ${zdroj}`.slice(0, 120);
  const text = `Nový lead\nZdroj: ${zdroj}\nTrať: ${trat}\nE-mail: ${email}\nČas (Praha): ${cas}`;
  const html =
    `<p><b>Nový lead</b></p>` +
    `<p>Zdroj: ${ez}<br>Trať: ${et}<br>E-mail: ${ee}<br>Čas (Praha): ${ec}</p>`;
  return { subject, html, text };
}

/**
 * Nikdy nehází. Vypnuto a testovací lead nečtou počet a nevolají poštu.
 * Chyba počtu (nedá se poznat, jestli už je den plný) mail neodešle:
 * lepší jeden zmeškaný alert než desítky mailů, když dotaz mlčí.
 */
export async function ohlasNovyLead(
  deps: Zavislosti,
  lead: LeadVstup,
): Promise<{ posilano: boolean; duvod: string }> {
  try {
    if (lead.duplicate) return { posilano: false, duvod: "duplicita" };
    if (jeTestovaciLead(lead.email, lead.name)) return { posilano: false, duvod: "test" };

    const env = deps.env(ENV_PREPINAC);
    const envRozhoduje = env !== undefined && env.trim() !== "";
    if (envRozhoduje && !jeAno(env)) return { posilano: false, duvod: "vypnuto" };

    let konfig: Konfig = { prepniac: null, strop: null };
    try {
      konfig = await deps.prectiKonfig();
    } catch (e) {
      console.error("lead-alert: config", String(e).slice(0, 180));
      if (!envRozhoduje) return { posilano: false, duvod: "config" };
    }
    if (!jeZapnuto(env, konfig.prepniac)) return { posilano: false, duvod: "vypnuto" };

    const strop = stropZHodnoty(konfig.strop);
    const ted = deps.ted ?? new Date();
    let pocet: number | null = null;
    try {
      pocet = await deps.spocitejOd(pulnocPrahaIso(ted));
    } catch (e) {
      console.error("lead-alert: pocet", String(e).slice(0, 180));
      return { posilano: false, duvod: "pocet" };
    }

    const r = rozhodni({
      duplicate: false,
      email: lead.email,
      name: lead.name,
      zapnuto: true,
      pocetDnes: pocet,
      strop,
    });
    if (!r.poslat) return { posilano: false, duvod: r.duvod };

    const mail = sestavMail({
      druh: r.druh,
      source: lead.source,
      track: lead.track,
      email: lead.email,
      kdy: ted,
      pocetDnes: pocet,
      strop,
    });
    const vys = await deps.posli(mail);
    if (!vys.ok) {
      console.error("lead-alert: mail status", vys.status);
      return { posilano: false, duvod: "mail_" + vys.status };
    }
    return { posilano: true, duvod: r.druh };
  } catch (e) {
    console.error("lead-alert:", String(e).slice(0, 180));
    return { posilano: false, duvod: "vyjimka" };
  }
}
