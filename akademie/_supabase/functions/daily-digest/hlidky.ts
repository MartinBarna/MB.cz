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
