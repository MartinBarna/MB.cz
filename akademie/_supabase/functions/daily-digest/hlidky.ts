// Ranni prehled: 2 denni hlidky presunute z drahych Claude rutin do deterministickeho
// mailu (3. 9. 2026). Cisla pocita kod, zadne odhady, zadne volani AI.
// Ciste funkce bez site/env, testovatelne primo (viz hlidky.test.ts).

export type HlidkaVysledek = { radek: string; alertText: string | null };

// ===== Hlidka 1: cisla potravin/receptu nezamrzla =====================
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

// ===== Hlidka 2: prihlaseni appky =======================================
// Zdroj: appka (kfkmghvhqwqtsalqjmrp) auth.audit_log_entries, sloupce payload->>'action',
// payload->>'error' (pripadne 'msg'), created_at.
// ⛔ OVĚŘENO 3. 9. 2026: tabulka v appce existuje a je čitelná ze service role, ale má
// TRVALE 0 řádků (i po reálných přihlášeních potvrzených přes auth.users.last_sign_in_at).
// GoTrue v tomto projektu si audit log posilá jen do Logs Exploreru (auth_logs, ClickHouse),
// ne do teto Postgres tabulky. Cteni pres Management API by fungovalo, ale vyzaduje PAT,
// ktery se do zive edge funkce zakladat nema (zadani 3. 9. 2026).
// ⇒ Funkce je napsana napred pro pripad, ze appka log zacne plnit (schema je z GoTrue
// dokumentace, NEOVERENO na realnem radku, protoze zadny neexistuje), ale dnes vzdy
// vrati "auditni log appky je prazdny" rádek bez pokusu o analyzu.
export type AuditRadek = { action: string | null; error: string | null; email: string | null; created_at: string };

// Prefix e-mailu zkraceny na 3 znaky + domena, nikdy cela adresa (zadani).
export function zkratEmail(email: string): string {
  const at = email.indexOf("@");
  if (at < 0) return email.slice(0, 3) + "…";
  return email.slice(0, Math.min(3, at)) + "…@" + email.slice(at + 1);
}

export function hlidkaPrihlaseni(radky: AuditRadek[], avg7d: number | null): HlidkaVysledek {
  if (radky.length === 0) {
    return {
      radek: "Přihlášení appky: auditní log appky je prázdný (auth.audit_log_entries nemá žádná data v tomto projektu, GoTrue je nezapisuje)",
      alertText: null,
    };
  }
  const chyby = radky.filter((r) => !!r.error);
  const poEmailu = new Map<string, number>();
  for (const r of chyby) {
    const e = (r.email ?? "?").toLowerCase();
    poEmailu.set(e, (poEmailu.get(e) ?? 0) + 1);
  }
  const opakovani = [...poEmailu.entries()].filter(([, n]) => n >= 5);
  const novyTypChyby = [...new Set(chyby.map((r) => r.error ?? "?"))]
    .filter((e) => !["otp_expired", "invalid_credentials", "invalid_grant"].includes(e));
  const nadPrumerem = avg7d !== null && avg7d > 0 && chyby.length > avg7d * 3;

  const radek = "Přihlášení appky: " + chyby.length + " chyb / " + radky.length + " událostí za 24 h";
  const potize: string[] = [];
  if (opakovani.length) {
    potize.push(opakovani.map(([e, n]) => zkratEmail(e) + " (" + n + "×)").join(", ") + " opakovaně neuspělo");
  }
  if (novyTypChyby.length) {
    potize.push("nový typ chyby: " + novyTypChyby.join(", "));
  }
  if (nadPrumerem) {
    potize.push(chyby.length + " chyb je přes 3× nad 7denním průměrem (" + avg7d!.toFixed(1) + ")");
  }
  if (potize.length === 0) return { radek: radek + ", OK", alertText: null };
  return { radek, alertText: "⚠️ Přihlášení appky: " + potize.join("; ") + "." };
}
