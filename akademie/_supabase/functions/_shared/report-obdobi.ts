// =============================================================================
// OBDOBÍ REPORTU KLIENTA KOUČINKU (5. 10. 2026, Martin: „od reportu po report, ať to bere samo")
//
// JEDNO místo, kde se počítá, za jaké dny report je, a kdy má přijít další.
// Používají ho: `client-report` (akce `obdobi` pro formulář a kontrola při uložení),
// `client-remind` (kdy poslat výzvu), `admin-api` (karta klienta, koncept, sync)
// a `admin-api/tc-report-sync.ts` (které týdny appky k webovému reportu patří).
// ⛔ Žádná kopie v prohlížeči: formulář se na období ptá serveru (akce `obdobi`).
// ⛔ Bez Deno API a bez sítě, ať jde testovat (`report-obdobi.test.ts`).
//
// PRAVIDLO (analýza `_Claude-dokumenty/2026-10-05_reporty-obdobi/ANALYZA-A-NAVRH.md`, 3.1):
//   T(d) = pondělí ISO týdne dne d − 3 dny (report poslaný ne až st patří k týdnu, který
//          v neděli skončil; čt až so k týdnu, který právě běží).
//   konec období = neděle týdne T(dnes), ale nejdál dnešek.
//   začátek      = den po posledním dni, který pokryl předchozí report klienta.
//                  Bez předchozího reportu pondělí T(dnes), tedy jeden týden.
//   strop        = nejvýš 4 týdny zpátky (pondělí T(dnes) − 21 dní).
//   Když předchozí report pokryl všechno až do konce, je to OPRAVA: znovu jeho období.
//
// ⭐ PROČ „den po posledním pokrytém dni" a ne „pondělí po týdnu předchozího reportu"
//    (jak to stálo v analýze): Martin 5. 10. doplnil, že pozdní report nesmí ztratit dny
//    ani se překrýt. Report poslaný ve čtvrtek až sobotu končí dneškem; kdyby další report
//    začínal až pondělím po tom týdnu, zbytek týdne by nepokryl nikdo, a kdyby se bral
//    jako oprava téhož týdne, překryl by se. Pro všechny reporty poslané neděle až středa
//    (a pro všechny staré bez uloženého období) vychází obě pravidla úplně stejně.
// ⛔ Řádky z appky (`tvuj-coach`, `app`) období nikdy neposouvají: jedno vážení v appce
//    by jinak zkrátilo období klientce, která jídlo píše v Kalorických tabulkách.
// =============================================================================

/** Strop období ve dnech (4 týdny). */
export const STROP_DNI = 28;
/** Zkratky dnů od pondělí, jako je má formulář klienta. */
export const DNY_TYDNE = ["Po", "Út", "St", "Čt", "Pá", "So", "Ne"];

const APP_ZDROJE = new Set(["tvuj-coach", "app"]);
const RE_DATUM = /^\d{4}-\d{2}-\d{2}$/;
const DEN_MS = 86400000;

/** Skutečné kalendářní datum ve tvaru YYYY-MM-DD. 31. února ani „2026-9-5" neprojde. */
export function jeDatum(v: unknown): v is string {
  if (typeof v !== "string" || !RE_DATUM.test(v)) return false;
  const [y, m, d] = v.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

// Poledne UTC: přičítání celých dní pak nikdy nepřeskočí den (UTC nemá změnu času).
function poledne(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d, 12);
}

export function pridejDny(iso: string, n: number): string {
  return new Date(poledne(iso) + n * DEN_MS).toISOString().slice(0, 10);
}

/** Kolik dní je od `od` do `do_` (záporné, když `do_` je dřív). */
export function rozdilDni(od: string, do_: string): number {
  return Math.round((poledne(do_) - poledne(od)) / DEN_MS);
}

/** 0 = pondělí … 6 = neděle. */
export function denTydne(iso: string): number {
  return (new Date(poledne(iso)).getUTCDay() + 6) % 7;
}

/** Pondělí ISO týdne, do kterého datum spadá. */
export function pondeli(iso: string): string {
  return pridejDny(iso, -denTydne(iso));
}

/** Týden, ke kterému report patří: pondělí týdne dne o 3 dny dřív. */
export function tydenReportu(iso: string): string {
  return pondeli(pridejDny(iso, -3));
}

/** Dnešní datum v Europe/Prague (report poslaný po půlnoci nesmí dostat včerejší datum z UTC). */
export function dnesPraha(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Prague" }).format(now);
}

const mensi = (a: string, b: string) => (a < b ? a : b);

export function jeAppZdroj(source: unknown): boolean {
  return APP_ZDROJE.has(String(source ?? "").trim().toLowerCase());
}

export type RadekReportu = {
  report_date?: unknown;
  source?: unknown;
  obdobi_od?: unknown;
  obdobi_do?: unknown;
};

export type Obdobi = { od: string; do: string; dni: number };

/**
 * Období jednoho řádku `client_reports`. Uložené (`obdobi_od`, `obdobi_do`), když je
 * platné, jinak odvozené pro starý řádek: jeden týden Po až Ne podle pravidla −3 dny.
 * null = řádek nemá čitelné datum reportu.
 */
export function obdobiRadku(r: RadekReportu): Obdobi | null {
  const od = String(r.obdobi_od ?? "").slice(0, 10);
  const d = String(r.obdobi_do ?? "").slice(0, 10);
  if (jeDatum(od) && jeDatum(d) && od <= d && rozdilDni(od, d) < STROP_DNI) {
    return { od, do: d, dni: rozdilDni(od, d) + 1 };
  }
  const rd = String(r.report_date ?? "").slice(0, 10);
  if (!jeDatum(rd)) return null;
  const t = tydenReportu(rd);
  // ⛔ [revize R1, nález N1] Konec nejdál den odeslání, stejně jako u období z pravidla. Řádek
  //    bez období poslaný ve čtvrtek až sobotu by jinak „pokryl" i dny do neděle, které ještě
  //    nenastaly, a nejbližší další report by vyšel jako oprava téhož týdne. U reportů poslaných
  //    v neděli až středu (a u všech dosavadních řádků z pondělí) se nic nemění.
  const konec = mensi(pridejDny(t, 6), rd);
  return { od: t, do: konec, dni: rozdilDni(t, konec) + 1 };
}

export type VysledekObdobi = Obdobi & {
  /** Klient zatím žádný report (mimo appku) neposlal, období je jeden týden. */
  prvni: boolean;
  /** Předchozí report už pokryl všechno do konce: tenhle je oprava téhož období. */
  oprava: boolean;
  /** Mezera byla delší než strop, bere se jen posledních 28 dní. */
  zkraceno: boolean;
};

/** Poslední report, který pokrývá dny před dneškem (mimo appku), a jeho období. */
function posledniPokryty(dnes: string, reporty: RadekReportu[]): { obd: Obdobi; rd: string } | null {
  let posl: { obd: Obdobi; rd: string } | null = null;
  for (const r of reporty ?? []) {
    if (jeAppZdroj(r.source)) continue;
    const rd = String(r.report_date ?? "").slice(0, 10);
    // Dnešní řádek se právě přepisuje (druhé odeslání v tentýž den je update),
    // řádek z budoucnosti je anomálie. Ani jeden období neposouvá.
    if (!jeDatum(rd) || rd >= dnes) continue;
    const obd = obdobiRadku(r);
    if (!obd) continue;
    if (!posl || obd.do > posl.obd.do || (obd.do === posl.obd.do && rd > posl.rd)) posl = { obd, rd };
  }
  return posl;
}

/**
 * Období reportu odeslaného dnes (`dnes` = datum v Europe/Prague).
 * `reporty` = všechny řádky klienta, klidně i z appky (ty se přeskočí).
 */
export function obdobiReportu(dnes: string, reporty: RadekReportu[]): VysledekObdobi {
  const t = tydenReportu(dnes);
  const konec = mensi(pridejDny(t, 6), dnes);
  const nejdrive = pridejDny(t, -21);
  const posl = posledniPokryty(dnes, reporty);
  if (!posl) {
    return { od: t, do: konec, dni: rozdilDni(t, konec) + 1, prvni: true, oprava: false, zkraceno: false };
  }
  if (posl.obd.do >= konec) {
    // Nic nového k pokrytí (druhé odeslání za týž týden): znovu období posledního reportu.
    let od = posl.obd.od < nejdrive ? nejdrive : posl.obd.od;
    const d = mensi(posl.obd.do, konec);
    if (od > d) od = d;
    return { od, do: d, dni: rozdilDni(od, d) + 1, prvni: false, oprava: true, zkraceno: od !== posl.obd.od };
  }
  let od = pridejDny(posl.obd.do, 1);
  let zkraceno = false;
  if (od < nejdrive) {
    od = nejdrive;
    zkraceno = true;
  }
  return { od, do: konec, dni: rozdilDni(od, konec) + 1, prvni: false, oprava: false, zkraceno };
}

/** Pondělí všech týdnů, kterých se období dotýká (i částečně). */
export function tydnyObdobi(od: string, do_: string): string[] {
  const out: string[] = [];
  if (!jeDatum(od) || !jeDatum(do_) || od > do_) return out;
  for (let m = pondeli(od); m <= do_; m = pridejDny(m, 7)) out.push(m);
  return out;
}

/** Období jsou celé týdny Po až Ne (jen taková jde spárovat s týdenními daty z appky). */
export function jeCeleTydny(o: { od: string; do: string }): boolean {
  return jeDatum(o.od) && jeDatum(o.do) && o.od <= o.do && denTydne(o.od) === 0 && denTydne(o.do) === 6;
}

/** První den, který řádek pokrývá: u appky pondělí jejího týdne, jinak začátek období řádku. */
export function zacatekPokryti(r: RadekReportu): string | null {
  if (jeAppZdroj(r.source)) {
    const rd = String(r.report_date ?? "").slice(0, 10);
    return jeDatum(rd) ? pondeli(rd) : null;
  }
  return obdobiRadku(r)?.od ?? null;
}

/**
 * Začíná starší řádek uvnitř období reportu `obd`? Takový řádek NENÍ „minulý report":
 * typicky týden z appky, který sync založil dřív, než klient poslal report za víc týdnů
 * (revize Groka 5. 10. 2026, nález 1), nebo verze téhož období, kterou report opravuje.
 * Srovnání s ním by porovnávalo report s kusem sebe sama (tempo, šipky „minule").
 * `obd` null (report bez uloženého období) = nic se nevylučuje, jako dřív.
 */
export function jeUvnitrObdobi(r: RadekReportu, obd: { od: string; do: string } | null): boolean {
  if (!obd || !jeDatum(obd.od) || !jeDatum(obd.do)) return false;
  const z = zacatekPokryti(r);
  return !!z && z >= obd.od && z <= obd.do;
}

/**
 * Nejstarší verze téhož období, kterou report opravuje (řádek mimo appku, který začíná uvnitř
 * období), nebo null. Řádek mimo appku uvnitř období jinak vzniknout nemůže: nový report začíná
 * až dnem po posledním pokrytém dni (revize Groka R2, nález 1).
 * K čemu: tempo opravy se počítá od data PŮVODNÍ verze. Oprava ve středu se stejnou váhou jako
 * v neděli by jinak dělila týdenní změnu 1,43 týdne a engine by mohl navrhnout řez kalorií.
 * ⚠️ Předpoklad: oprava nese váhu změřenou k původní verzi (oprava překlepu). Kdo se ve středu
 *    převáží znovu, tomu se tempo nadsadí nejvýš o 3/7.
 */
export function opravovanaVerze<T extends RadekReportu>(radky: T[], obd: { od: string; do: string } | null): T | null {
  let nej: T | null = null;
  for (const r of radky ?? []) {
    if (jeAppZdroj(r.source) || !jeUvnitrObdobi(r, obd)) continue;
    const rd = String(r.report_date ?? "").slice(0, 10);
    if (!jeDatum(rd)) continue;
    if (!nej || rd < String(nej.report_date ?? "").slice(0, 10)) nej = r;
  }
  return nej;
}

/**
 * Období, které poslal formulář. Kontroluje se TVAR, ne shoda s výpočtem serveru
 * (tu řeší volající, protože při neshodě se ukládá období, ke kterému patří čísla).
 * null = neplatné (nečitelné datum, obrácené pořadí, víc než 28 dní, dny v budoucnu).
 */
export function overObdobiKlienta(v: unknown, dnes: string): Obdobi | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const od = (v as Record<string, unknown>).od, d = (v as Record<string, unknown>).do;
  if (!jeDatum(od) || !jeDatum(d) || od > d) return null;
  const dni = rozdilDni(od, d) + 1;
  if (dni > STROP_DNI) return null;
  if (d > dnes) return null;
  return { od, do: d, dni };
}

/**
 * Denní rozpis z formuláře k danému období. Nový tvar: seznam jen vyplněných dnů
 * s `datum` uvnitř období, bez opakování. Starý tvar (7 slotů s `den`, bez data)
 * patří jen k reportu BEZ období. Prázdný nebo chybějící rozpis je v pořádku.
 */
export function overRozpisKObdobi(dny: unknown, o: Obdobi | null): boolean {
  if (dny == null) return true;
  if (!Array.isArray(dny)) return false;
  if (dny.length > STROP_DNI) return false;
  const videno = new Set<string>();
  for (const x of dny) {
    if (x == null) {
      if (o) return false;          // sloty s mezerami má jen starý sedmidenní tvar
      continue;
    }
    if (typeof x !== "object" || Array.isArray(x)) return false;
    const datum = (x as Record<string, unknown>).datum;
    if (!o) {
      if (datum !== undefined) return false;   // datum bez období nemá k čemu sedět
      continue;
    }
    if (!jeDatum(datum) || datum < o.od || datum > o.do || videno.has(datum)) return false;
    videno.add(datum);
  }
  return true;
}

/**
 * ⛔ [5. 10. 2026, revize R1, nález S1] REPORT BEZ OBDOBÍ NESMÍ BÝT PRO MARTINA TICHÝ.
 * Přijde, když formulář období nenačetl (náhradní režim) nebo klient poslal report ze staré
 * stránky. Uloží se jako jeden týden podle pravidla −3 dny (`obdobiRadku`). Když podle historie
 * měl pokrýt jiné dny (typicky víc týdnů), Martin dostane větu, které dny nepokrývá žádný report
 * a které se překrývají s předchozím. Období se NEDOPOČÍTÁVÁ ze serveru: čísla, která klient
 * v náhradním režimu vyplnil, jsou za týden.
 * null = není co hlásit (týdenní klient, první report, oprava téhož týdne).
 */
export function vetaBezObdobi(dnes: string, historie: RadekReportu[] | null): string | null {
  const jakoTyden = obdobiRadku({ report_date: dnes });
  if (!jakoTyden) return null;
  const ulozeno = "uložený je jako " + popisObdobi(jakoTyden.od, jakoTyden.do) + " (" + slovoDni(jakoTyden.dni) + ")";
  if (!historie) {
    return "⚠️ Report přišel bez období (formulář ho nenačetl, nebo klient poslal report ze staré stránky) " +
      "a historie reportů se nenačetla, takže nevím, jestli mezi minulým a tímhle reportem nezůstaly dny bez reportu; " + ulozeno + ".";
  }
  const ocek = obdobiReportu(dnes, historie);
  if (ocek.od === jakoTyden.od && ocek.do === jakoTyden.do) return null;
  const casti: string[] = [];
  if (ocek.od < jakoTyden.od) {
    casti.push("Dny " + popisObdobi(ocek.od, pridejDny(jakoTyden.od, -1)) + " nepokrývá žádný report.");
  } else if (ocek.od > jakoTyden.od) {
    casti.push("Dny " + popisObdobi(jakoTyden.od, pridejDny(ocek.od, -1)) + " už pokryl předchozí report, týden se s ním překrývá.");
  }
  return "⚠️ Report přišel bez období (formulář ho nenačetl, nebo klient poslal report ze staré stránky). " +
    "Podle historie měl pokrýt " + popisObdobi(ocek.od, ocek.do) + " (" + slovoDni(ocek.dni) + "), " + ulozeno + ". " +
    (casti.length ? casti.join(" ") + " " : "") +
    "Čísla stravy jsou nejspíš jen za posledních 7 dní.";
}

// ---------- česky pro lidi (mail, karta klienta) ----------

/** „5. 10." nebo „5. 10. 2026". */
export function datumCesky(iso: string, sRokem = true): string {
  const [y, m, d] = iso.split("-").map(Number);
  return d + ". " + m + "." + (sRokem ? " " + y : "");
}

/** „5. 10. až 25. 10. 2026", přes rok „28. 12. 2026 až 3. 1. 2027", jeden den „9. 10. 2026". */
export function popisObdobi(od: string, do_: string): string {
  if (od === do_) return datumCesky(od);
  return datumCesky(od, od.slice(0, 4) !== do_.slice(0, 4)) + " až " + datumCesky(do_);
}

/** „1 den", „3 dny", „21 dní". */
export function slovoDni(n: number): string {
  return n + (n === 1 ? " den" : n >= 2 && n <= 4 ? " dny" : " dní");
}

// =============================================================================
// FÁZE 2: KADENCE A DALŠÍ REPORT (Martin 5. 10. 2026, rozhodnutí 2)
// Kadence (report každý 1, 2 nebo 3 týden) řídí jen PŘIPOMÍNKY a hlídání, ne období:
// období se počítá vždy od reportu po report (výš). Martin ji nastavuje v kartě klienta
// (`entitlements.report_kadence`), ručně může posunout i další report
// (`entitlements.dalsi_report`, „nejdřív", typicky kvůli dovolené).
// =============================================================================

export type Kadence = 1 | 2 | 3;

/** Kadence klienta: sloupec, když je platný; jinak starý seznam `client_remind_14d` (2), jinak 1. */
export function kadenceKlienta(sloupec: unknown, vSeznamu14d = false): Kadence {
  const n = Number(sloupec);
  if (sloupec != null && sloupec !== "" && (n === 1 || n === 2 || n === 3)) return n as Kadence;
  return vSeznamu14d ? 2 : 1;
}

/** Poslední den, který klient pokryl reportem (mimo appku), nebo null, když report neposlal. */
export function posledniPokrytyDen(reporty: RadekReportu[], dnes: string): string | null {
  // `dnes + 1` schválně: tady se ptáme i na report poslaný dnes (nic se nepřepisuje).
  const posl = posledniPokryty(pridejDny(dnes, 1), reporty);
  return posl ? posl.obd.do : null;
}

/** Neděle týdne posledního pokrytého dne + kadence v týdnech. */
export function dalsiReportPodleKadence(posledniDen: string | null, kadence: Kadence): string | null {
  if (!posledniDen || !jeDatum(posledniDen)) return null;
  return pridejDny(pondeli(posledniDen), 6 + 7 * kadence);
}

export type DalsiReport = {
  /** Kdy má přijít další report (neděle), nebo null, když klient ještě žádný neposlal a nic není zadané. */
  datum: string | null;
  podleKadence: string | null;
  rucne: string | null;
  /** Ruční datum termín posunulo za výpočet podle kadence. */
  posunuto: boolean;
};

/**
 * Další report. Ruční datum je „NEJDŘÍV": termín jen posouvá dál, nikdy ho nestáhne
 * dřív než kadence. Díky tomu se samo „spotřebuje": jakmile klient pošle report
 * a výpočet podle kadence ho přeroste, přestane platit, a nikdo ho nemusí mazat.
 * (Hana pošle report 25. 10. ⇒ podle kadence 8. 11., ruční 25. 10. už nic nemění.
 *  Pošle-li dřív, třeba 18. 10., vyjde 1. 11. a ne další výzva za týden.)
 */
export function dalsiReport(posledniDen: string | null, kadence: Kadence, rucne: unknown): DalsiReport {
  const podleKadence = dalsiReportPodleKadence(posledniDen, kadence);
  const r = typeof rucne === "string" && jeDatum(rucne.slice(0, 10)) ? rucne.slice(0, 10) : null;
  if (r && (!podleKadence || r > podleKadence)) return { datum: r, podleKadence, rucne: r, posunuto: true };
  return { datum: podleKadence, podleKadence, rucne: r, posunuto: false };
}

/**
 * Patří nedělní výzva k reportu na tenhle běh? Report „za týden do neděle" se posílá
 * od neděle do středy, takže výzva jde v neděli, kdy do termínu zbývají nejvýš 3 dny.
 * Bez termínu (klient ještě nereportoval a nic není zadané) rozhodují stará pravidla.
 */
export function vyzvaNaRade(dnes: string, dalsi: string | null): boolean {
  if (!dalsi || !jeDatum(dalsi)) return true;
  return rozdilDni(dnes, dalsi) <= 3;
}

/** Neděle, kdy k termínu `dalsi` odejde výzva (první neděle, pro kterou `vyzvaNaRade` platí). Pro kartu klienta. */
export function nedeleVyzvy(dalsi: string | null): string | null {
  if (!dalsi || !jeDatum(dalsi)) return null;
  const start = pridejDny(dalsi, -3);
  return pridejDny(start, 6 - denTydne(start));
}
