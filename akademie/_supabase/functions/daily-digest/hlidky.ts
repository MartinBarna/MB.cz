// Ranni prehled: denni hlidka presunuta z drahe Claude rutiny do deterministickeho
// mailu (3. 9. 2026). Cisla pocita kod, zadne odhady, zadne volani AI.
// Ciste funkce bez site/env, testovatelne primo (viz hlidky.test.ts).

export type HlidkaVysledek = { radek: string; alertText: string | null };

// ===== Hlidka: cisla potravin/receptu nezamrzla ========================
// Zdroj: app_config.pocet_cisel_mereno_v (Academy, uhmrpfsdcujbhbtumqye), zapisuje ho
// cron cisla-sync-6h (kazdych 6 h). Anomalie = chybi, je necitelne, nebo stari > 26 h
// (6h cyklus + rezerva na jedno vynechane kolo, at kratky vypadek nezpusobi falesny poplach).
export function hlidkaCisla(merenoV: string | undefined, nowMs: number): HlidkaVysledek {
  if (!merenoV) {
    return {
      radek: "Čísla potravin/receptů: chybí záznam o přeměření",
      alertText: "Čísla potravin/receptů se nikdy nepřeměřila (app_config.pocet_cisel_mereno_v chybí). " +
        "Cron cisla-sync možná nikdy neproběhl nebo měřicí skript o výsledku nezapisuje.",
    };
  }
  const t = Date.parse(merenoV);
  if (isNaN(t)) {
    return {
      radek: "Čísla potravin/receptů: neplatný záznam o přeměření",
      alertText: "app_config.pocet_cisel_mereno_v má hodnotu, kterou nejde přečíst jako datum: \"" + merenoV + "\".",
    };
  }
  const hod = Math.round((nowMs - t) / 3600000);
  if (hod > 26) {
    return {
      radek: "Čísla potravin/receptů: přeměřeno před " + hod + " h",
      alertText: "⚠️ Čísla potravin/receptů se nepřeměřila " + hod + " h (cron cisla-sync stojí).",
    };
  }
  return { radek: "Čísla potravin/receptů: přeměřeno před " + hod + " h, OK", alertText: null };
}

// ===== Hlidka: nedelni pripominka klientum koucinku probehla ===============
// Zdroj: app_config.client_remind_hlidka, zapisuje ho SQL funkce
// `public.client_remind_hlidka()` (cron `client-remind-hlidka`, nedele 04:00 UTC,
// migrace `client-remind-hlidka-2026-09-17.sql`).
//
// PROC TAHLE HLIDKA EXISTUJE: tri crony (19, 47, 48) volaji `client-remind` v nedeli
// 01:00 az 02:00 UTC a jejich odpoved konci v `net._http_response`, kam se nikdo nediva.
// `cron.job_run_details` hlasi `succeeded` i kdyz funkce vrati 500. 14. 9. 2026 to takhle
// tise spadlo a prislo se na to, az se ozval klient.
//
// ⛔ FORMAT HODNOTY: `<STAV> <ISO cas> :: <text>`, kde STAV je `OK` nebo `POPLACH`.
//    Sklada ho ta SQL funkce. Kdo zmeni format tam, musi sahnout i sem.
// ⚠️ HLIDKA SE HLIDA NA CERSTVOST. Bezi tydne, prah je 8 dni (tyden + rezerva na
//    jeden vynechany beh). Starsi zaznam znamena, ze umrel cron hlidky, ne rozesilka.
export const CLIENT_REMIND_HLIDKA_PRAH_H = 8 * 24;

export function hlidkaClientRemind(hodnota: string | undefined, nowMs: number): HlidkaVysledek {
  if (!hodnota) {
    return {
      radek: "Nedělní připomínka klientům: hlídka zatím nikdy nezapsala výsledek",
      alertText: "⚠️ Hlídka nedělní připomínky klientům (client_remind_hlidka) nikdy nic nezapsala. " +
        "Nejspíš není nasazený cron `client-remind-hlidka` (neděle 04:00 UTC) nebo SQL funkce. " +
        "Do té doby nikdo nehlídá, jestli klienti výzvu k reportu opravdu dostali.",
    };
  }
  // Rozpad na STAV, cas a text. Nectitelna hodnota je anomalie sama o sobe: hlidka,
  // ktere nerozumim, nehlida nic.
  const m = /^(OK|POPLACH)\s+(\S+)\s+::\s+([\s\S]*)$/.exec(hodnota.trim());
  if (!m) {
    return {
      radek: "Nedělní připomínka klientům: nečitelný záznam hlídky",
      alertText: "⚠️ app_config.client_remind_hlidka má hodnotu, které nerozumím: \"" +
        hodnota.slice(0, 120) + "\". Formát má být `OK|POPLACH <ISO čas> :: <text>`.",
    };
  }
  const [, stav, cas, text] = m;
  const t = Date.parse(cas);
  const stariH = isNaN(t) ? null : Math.round((nowMs - t) / 3600000);
  const stariText = stariH === null ? "neznámé stáří" : "před " + stariH + " h";

  if (stav === "POPLACH") {
    return {
      radek: "Nedělní připomínka klientům: ⛔ POPLACH (" + stariText + ")",
      alertText: "⛔ Nedělní připomínka klientům koučinku: " + text,
    };
  }
  if (stariH === null) {
    return {
      radek: "Nedělní připomínka klientům: OK, ale čas hlídky nejde přečíst",
      alertText: "⚠️ app_config.client_remind_hlidka má nečitelný čas: \"" + cas + "\".",
    };
  }
  if (stariH > CLIENT_REMIND_HLIDKA_PRAH_H) {
    return {
      radek: "Nedělní připomínka klientům: hlídka mlčí " + stariH + " h",
      alertText: "⚠️ Hlídka nedělní připomínky klientům neproběhla " + stariH + " h " +
        "(běhá v neděli 04:00 UTC). Zkontroluj cron `client-remind-hlidka`. " +
        "Poslední známý stav: " + text,
    };
  }
  return { radek: "Nedělní připomínka klientům: OK (" + stariText + "), " + text, alertText: null };
}
