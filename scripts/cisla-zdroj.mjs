#!/usr/bin/env node
/**
 * Spolecny zdroj verejnych cisel pro dva skripty:
 *   - scripts/kontrola-cisla-stari.mjs  (hlidka stari, kap. 5a navrhu)
 *   - scripts/sync-cisla-web.mjs        (prepis cisel do HTML a llms.txt, kap. 4b)
 *
 * Jedno misto schvalne: URL projektu, jmeno env promenne a parsovani cisel se
 * mezi hlidkou a prepisovacem NESMI rozejit. Kdyby se rozesly, hlidka by hlidala
 * jinou hodnotu, nez jakou prepisovac zapisuje na web.
 *
 * DVE CESTY KE STEJNYM CISLUM, poradi je zamerne:
 *
 *   1. HLAVNI: RPC `cisla_pro_web()` ANONYMNIM klicem (nasazena 25. 8. 2026).
 *      Je to `security definer` funkce s grantem pro `anon`, ktera vraci JEN TRI
 *      hodnoty: pocet_potravin, pocet_receptu, pocet_cisel_mereno_v. Nic jineho
 *      z `app_config` nevyda. Diky tomu muze skript bezet i v GitHub Action bez
 *      jedineho secretu.
 *      ⚠️ RPC NEVRACI `pocet_potravin_raw`, takze na teto ceste odpada krizova
 *      kontrola "zaokrouhlene sedi na surove" v sync-cisla-web.mjs. Hlavni
 *      pojistka (hodnota musi byt zaokrouhlena dolu na 10 000) plati dal.
 *
 *   2. ZALOHA: cteni `app_config` service-role klicem z prostredi. Pouzije se,
 *      jen kdyz RPC selze (vypnuta, prejmenovana, sit).
 *
 * ⛔ NEPREKROCITELNE: ANONYMNI KLIC NA TABULKU `app_config` NEFUNGUJE A NESMI SE
 *    ZPROVOZNIT. Zmereno 25. 8. 2026 na zive Academy DB (uhmrpfsdcujbhbtumqye):
 *      - tabulka `app_config` ma RLS zapnute a NULA policy,
 *      - anonymni GET pres PostgREST proto vraci HTTP 200 a PRAZDNE POLE, ne chybu.
 *    Ta prazdnota NENI zavada k obejiti. V teze tabulce lezi klic
 *    `cisla_sync_secret`, kterym se autorizuje edge funkce `cisla-sync`.
 *    Kdo tam prida policy "anon smi cist", vystavi ten secret internetu.
 *    Prave proto vznikla RPC z bodu 1: pusti ven tri cisla, ne celou tabulku.
 *
 * POZOR: service-role klic Academy NENI tyz jako klic appky.
 *    `export-curated-foods.mjs` cte appku (kfkmghvhqwqtsalqjmrp) pres
 *    SUPABASE_SERVICE_ROLE_KEY; tady jde o Academy, proto vlastni jmeno promenne.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const URL_ACADEMY = "https://uhmrpfsdcujbhbtumqye.supabase.co";

/** Klice, ktere umi vratit RPC `cisla_pro_web()` (bez `*_raw`, viz hlavicka). */
export const KLICE_Z_RPC = ["pocet_potravin", "pocet_receptu", "pocet_cisel_mereno_v"];

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
    "Chybi service-role klic Academy pro ZALOZNI cestu. Nastav " + ENV_JMENA[0] + "=...\n" +
      "  (Hlavni cesta je RPC cisla_pro_web anonymne, ta klic nepotrebuje.)\n" +
      "  Anonymni klic na TABULKU app_config NESTACI: ma RLS bez policy, anon dostane\n" +
      "  prazdne pole. A policy pro anon se pridavat NESMI, v tabulce lezi\n" +
      "  cisla_sync_secret.\n" +
      "  Klic appky (SUPABASE_SERVICE_ROLE_KEY) tu taky nefunguje, tohle je Academy.",
  );
}

/**
 * Verejny (anon/publishable) klic Academy se NEKOPIRUJE sem, cte se z
 * `assets/ba-config.js`, tedy z tehoz souboru, ktery ho podava prohlizecum.
 * Duvod: az se klic jednou otoci, nesmi zustat druha, tise zastarala kopie.
 * Prebit se da promennou ACADEMY_ANON_KEY (na testy a na cizi prostredi).
 */
export function anonKlic(env = process.env, korenRepa = null) {
  const zEnv = (env.ACADEMY_ANON_KEY ?? "").trim();
  if (zEnv) return zEnv;
  const koren = korenRepa ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const soubor = path.join(koren, "assets", "ba-config.js");
  const zdroj = fs.readFileSync(soubor, "utf8");
  const m = zdroj.match(/anonKey\s*:\s*["']([^"']+)["']/);
  if (!m) throw new Error("V " + soubor + " jsem nenasel `anonKey`.");
  return m[1];
}

/**
 * HLAVNI CESTA: tri verejna cisla z RPC `cisla_pro_web()` anonymnim klicem.
 * Vraci mapu {key: value} ve stejnem tvaru jako `stahniAppConfig`, aby na tom
 * volajici nemusel nic menit.
 */
export async function stahniRpcCisla({ env = process.env, fetchFn = fetch, korenRepa = null } = {}) {
  const klic = anonKlic(env, korenRepa);
  const res = await fetchFn(URL_ACADEMY + "/rest/v1/rpc/cisla_pro_web", {
    method: "POST",
    headers: {
      apikey: klic,
      Authorization: "Bearer " + klic,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: "{}",
  });
  if (!res.ok) {
    throw new Error("cisla_pro_web: HTTP " + res.status + " " + (await res.text()).slice(0, 200));
  }
  const data = await res.json();
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("cisla_pro_web: cekam JSON objekt, prislo " + JSON.stringify(data).slice(0, 120));
  }
  const m = {};
  for (const k of KLICE_Z_RPC) if (data[k] != null) m[k] = String(data[k]);
  if (!m.pocet_potravin || !m.pocet_receptu) {
    throw new Error("cisla_pro_web: v odpovedi chybi pocet_potravin nebo pocet_receptu");
  }
  return m;
}

/**
 * Cisla pro skripty: nejdriv RPC anonymne, teprve pri jejim selhani service-role.
 * Kdyz selzou obe cesty, vyjimka nese OBA duvody. Bez toho by clovek videl jen
 * "chybi service-role klic" a hledal by secret, ktery uz nikde potreba neni.
 */
export async function nactiCisla({ env = process.env, fetchFn = fetch, korenRepa = null } = {}) {
  try {
    return await stahniRpcCisla({ env, fetchFn, korenRepa });
  } catch (chybaRpc) {
    try {
      return await stahniAppConfig({ env, fetchFn });
    } catch (chybaKlic) {
      throw new Error(
        "Nepodarilo se precist verejna cisla ani jednou cestou.\n" +
          "  1) RPC cisla_pro_web (anonymne): " + String(chybaRpc.message ?? chybaRpc) + "\n" +
          "  2) app_config (service-role):    " + String(chybaKlic.message ?? chybaKlic),
      );
    }
  }
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
