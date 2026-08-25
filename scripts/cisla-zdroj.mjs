#!/usr/bin/env node
/**
 * Spolecny zdroj verejnych cisel pro dva skripty:
 *   - scripts/kontrola-cisla-stari.mjs  (hlidka stari, kap. 5a navrhu)
 *   - scripts/sync-cisla-web.mjs        (tydenni prepis cisel do HTML, kap. 4b)
 *
 * Jedno misto schvalne: URL projektu, jmeno env promenne a parsovani cisel se
 * mezi hlidkou a prepisovacem NESMI rozejit. Kdyby se rozesly, hlidka by hlidala
 * jinou hodnotu, nez jakou prepisovac zapisuje na web.
 *
 * NEPREKROCITELNE: ANONYMNI KLIC NA `app_config` NEFUNGUJE A NESMI SE ZPROVOZNIT.
 *    Zmereno 25. 8. 2026 na zive Academy DB (uhmrpfsdcujbhbtumqye):
 *      - tabulka `app_config` ma RLS zapnute a NULA policy,
 *      - anonymni GET pres PostgREST proto vraci HTTP 200 a PRAZDNE POLE, ne chybu.
 *    Ta prazdnota NENI zavada k obejiti. V teze tabulce lezi klic
 *    `cisla_sync_secret`, kterym se autorizuje edge funkce `cisla-sync`.
 *    Kdo tam prida policy "anon smi cist", vystavi ten secret internetu.
 *    => Cteni jede VYHRADNE service-role klicem z prostredi, nikdy z gitu.
 *
 * POZOR: service-role klic Academy NENI tyz jako klic appky.
 *    `export-curated-foods.mjs` cte appku (kfkmghvhqwqtsalqjmrp) pres
 *    SUPABASE_SERVICE_ROLE_KEY; tady jde o Academy, proto vlastni jmeno promenne.
 */

export const URL_ACADEMY = "https://uhmrpfsdcujbhbtumqye.supabase.co";

/** Klice, ktere plni edge funkce `cisla-sync` (Academy cron, 4x denne). */
export const KLICE_CISEL = [
  "pocet_potravin",        // ZOBRAZOVANA hodnota, uz zaokrouhlena dolu: "50 000"
  "pocet_receptu",         // presne cislo: "148"
  "pocet_cisel_mereno_v",  // ISO timestamp MERENI v appce (ne cas syncu, viz hlidka)
  "pocet_potravin_raw",    // surove cislo pro sanity brany: "59 024"
  "pocet_receptu_raw",
];

const ENV_JMENA = ["ACADEMY_SERVICE_ROLE_KEY", "SUPABASE_SERVICE_ROLE_KEY_ACADEMY"];

export function klicZEnv(env = process.env) {
  for (const jmeno of ENV_JMENA) {
    const v = (env[jmeno] ?? "").trim();
    if (v) return v;
  }
  throw new Error(
    "Chybi service-role klic Academy. Nastav " + ENV_JMENA[0] + "=...\n" +
      "  Anonymni klic tu NESTACI: app_config ma RLS bez policy, anon dostane\n" +
      "  prazdne pole. A policy pro anon se pridavat NESMI, v tabulce lezi\n" +
      "  cisla_sync_secret.\n" +
      "  Klic appky (SUPABASE_SERVICE_ROLE_KEY) tu taky nefunguje, tohle je Academy.",
  );
}

/** Prevede PostgREST odpoved [{key,value}] na mapu {key: value}. */
export function mapaZRadku(radky) {
  if (!Array.isArray(radky)) throw new Error("app_config: cekam pole {key,value}");
  const m = {};
  for (const r of radky) {
    if (!r || typeof r.key !== "string") continue;
    m[r.key] = r.value == null ? "" : String(r.value);
  }
  return m;
}

/**
 * Stahne klice z Academy `app_config`. Vraci mapu {key: value}.
 * Chybejici klic v mape proste neni, kontrolu na nej dela volajici.
 */
export async function stahniAppConfig(
  { klice = KLICE_CISEL, env = process.env, fetchFn = fetch } = {},
) {
  const klic = klicZEnv(env);
  const url = URL_ACADEMY + "/rest/v1/app_config?select=key,value&key=in.(" +
    klice.join(",") + ")";
  const res = await fetchFn(url, {
    headers: { apikey: klic, Authorization: "Bearer " + klic, Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error("app_config: HTTP " + res.status + " " + (await res.text()).slice(0, 200));
  }
  return mapaZRadku(await res.json());
}

/** Stejna semantika jako `parseVerejneCislo` v cisla-sync/format.ts: "50 000" -> 50000. */
export function parseCislo(s) {
  const t = String(s ?? "").replace(/\s/g, "").replace(/,/g, "");
  if (!t) return NaN;
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
}

export function zaokrouhliDolu(n, krok) {
  if (!Number.isFinite(n) || !Number.isFinite(krok) || krok <= 0) return NaN;
  return Math.floor(n / krok) * krok;
}

/**
 * Oddelovac tisicu je VZDY obycejna mezera, nikdy carka a nikdy nedelitelna mezera.
 * Tyz tvar, jaky do app_config zapisuje cisla-sync (format.ts), aby se prepis
 * webu a text v mailu neodlisily.
 */
export function formatujMezerou(n) {
  if (!Number.isFinite(n)) return "";
  return n.toLocaleString("en-US").replace(/,/g, " ");
}
