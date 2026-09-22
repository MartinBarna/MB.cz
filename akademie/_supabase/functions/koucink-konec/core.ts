// =============================================================================
// JÁDRO AUTOMATU „konec koučinku": kdo se zabere, v jakém pořadí se co udělá
// a co se stane, když kterýkoli krok selže.
//
// PROČ VLASTNÍ SOUBOR (revize R1, nález S11): celá orchestrace žila uvnitř
// `Deno.serve()`, takže ji test nemohl naimportovat bez nastartování serveru.
// Testovatelné byly jen čisté pomocné funkce, a právě proto revize našla tři
// smyčky, které testy nemohly vidět: ztracené rozloučení po 4xx z Resendu,
// zaseknutou rezervaci a chybějící strop pokusů. Tady se všechny tři dají
// projet bez sítě a bez databáze.
//
// ⛔ ŽÁDNÉ `Deno`, ŽÁDNÝ `fetch`, ŽÁDNÝ supabase klient. Všechno chodí přes
//    `BehDeps`. Kdo sem přidá přímé volání ven, zavře tím dveře testu.
// =============================================================================

import type { UkonceniVysledek } from "../_shared/koucink-konec.ts";

/** Stavy razítka. Popis a důvody jsou v `koucink-konec-2026-09-22.sql`. */
export type StavRazitka =
  | "rezervovano"
  | "hotovo"
  | "opakovat"
  | "opakovat_mail"
  | "chyba_nejiste"
  | "vzdano";

/** Stavy, ze kterých si běh smí člověka vzít. */
export const STAVY_K_PREVZETI: StavRazitka[] = ["opakovat", "opakovat_mail"];
/** Stavy, které znamenají „hotovo, nesahat". */
export const STAVY_UZAVRENE: StavRazitka[] = ["hotovo", "chyba_nejiste", "vzdano"];

/**
 * Kolikrát se automat o jednoho člověka pokusí, než to vzdá.
 * ⛔ Strop musí být, jinak trvale špatný kupón znamená donekonečna opakovaný
 *    pokus a u promo kódu i nové a nové kódy ve Stripu (nález S4).
 */
export const MAX_POKUSU = 5;

// ⛔ Ochranná lhůta rezervace žije v `_shared`, protože ji potřebuje i ruční
//    odchod z admina (`client_offboard`). Dvě kopie téhle konstanty by znamenaly,
//    že zámek tlačítka a zámek cronu se rozejdou a oba by prošly naráz.
export { ZASEKNUTO_PO_MS } from "../_shared/koucink-konec.ts";
import { ZASEKNUTO_PO_MS } from "../_shared/koucink-konec.ts";

export type RazitkoRadek = {
  email: string;
  stav: string;
  promo_code: string | null;
  pokusy?: number | null;
  updated_at?: string | null;
  duvod?: string | null;
  /** `true` = odeslání se prokázalo. `false` i `null` = rozloučení chybí. */
  sent_ok?: boolean | null;
};

export type Zabrano = {
  stav: "ok";
  /** Ze kterého stavu se člověk převzal. Prázdno = nový řádek. */
  predchozi: "" | "opakovat" | "opakovat_mail" | "zaseknute";
  /** Kód už jednou vylosovaný a uložený. Nový se losovat NESMÍ. */
  promo: string;
  pokusy: number;
  /**
   * Prokázalo se u tohohle razítka odeslání?
   * ⛔ `true` JEN když mail opravdu odešel. `false` i `null` znamenají
   *    „rozloučení chybí" a rozhodují o tom, jestli se má doposlat (nález V1).
   */
  sentOk: boolean | null;
};

export type ZaberVysledek =
  | Zabrano
  | { stav: "obsazeno"; duvod: string }
  | { stav: "vzdano"; pokusy: number }
  | { stav: "chyba"; detail: string };

export type BranaRozhodnuti = {
  action: "send" | "skip";
  reason: string;
  /** Neprůhledný objekt pro `logMailSkip`. Jádro se do něj nedívá. */
  decision: unknown;
};

export type OdeslaniVysledek = { ok: boolean; status: number; chyba?: string };

export type PromoVysledekJadro =
  | { ok: true; kod: string }
  | { ok: false; chyba: string };

export type BehDeps = {
  /** Aktuální čas v ms. Parametrem, ať je běh deterministický. */
  ted: () => number;
  /** Vloží nový řádek razítka. `23505` = řádek už existuje. */
  vlozRazitko: (email: string) => Promise<{ ok: boolean; kod: string; detail: string }>;
  /** Přečte řádek razítka (nebo null). */
  ctiRazitko: (email: string) => Promise<{ radek: RazitkoRadek | null; chyba: string }>;
  /**
   * Přepne razítko na `rezervovano`, ale JEN když má pořád očekávaný stav.
   * Vrací počet SKUTEČNĚ změněných řádků: 1 = vyhrál jsem závod, 0 = nevyhrál.
   *
   * ⛔⛔ `zaseknute` MUSÍ PŘIDAT PODMÍNKU NA STÁŘÍ (revize R3, nález V1).
   *    Přechod `rezervovano` → `rezervovano` totiž svou vlastní podmínku splní
   *    POŘÁD: druhý volající ji po commitu prvního splní znovu a oba by
   *    pokračovali k odeslání. U `opakovat` → `rezervovano` se to stát nemůže,
   *    protože zápis podmínku poruší. Tady ji poruší jen čas, takže se do
   *    TÉHOŽ UPDATE přidává `updated_at < now() - 30 min`.
   */
  prevezmi: (
    email: string,
    zeStavu: string,
    pokusy: number,
    jenZaseknute: boolean,
  ) => Promise<{ pocet: number; chyba: string }>;
  /** Zapíše libovolná pole razítka. */
  nastavRazitko: (email: string, pole: Record<string, unknown>) => Promise<boolean>;
  maAcademy: (email: string) => Promise<boolean>;
  brana: (email: string, trida: "client_operational" | "marketing", path: string) => Promise<BranaRozhodnuti>;
  logSkip: (decision: unknown) => Promise<void>;
  /**
   * Vylosuje text promo kódu. ⛔ SAMOSTATNÝ KROK, protože kód se musí ULOŽIT
   *    DŘÍV, než se o něm dozví Stripe (nález V2): pád mezi voláním Stripu
   *    a zápisem řádku jinak znamená kód, o kterém nevíme, a další běh založí
   *    další.
   */
  vylosujKod: () => string;
  /**
   * Zajistí, že kód s tímhle textem ve Stripu existuje a je AKTIVNÍ.
   * Idempotentní: opakování se stejným textem kód nezdvojí.
   */
  zalozPromo: (email: string, kod: string) => Promise<PromoVysledekJadro>;
  /** Chybový kód, který znamená „text je obsazený archivovaným kódem". */
  kodNeaktivni: string;
  ukonciPristup: (email: string) => Promise<UkonceniVysledek>;
  posliMail: (
    email: string,
    opts: { maAcademy: boolean; promoKod: string; includeSales: boolean },
  ) => Promise<OdeslaniVysledek>;
  alert: (predmet: string, text: string, klic?: string) => Promise<void>;
  /**
   * Živý stav koučinkového nároku. Slouží k tomu, aby se ROZDĚLANÁ PRÁCE
   * neprovedla na člověku, který se mezitím stal klientem znovu.
   * `active: null` znamená „nepodařilo se přečíst", ne „nemá".
   */
  stavNaroku: (email: string) => Promise<{ active: boolean | null; expiresAt: string | null }>;
  /** Je vůbec nastavený kupón? Bez něj se nabídka VIP nedá poslat. */
  maKupon: boolean;
  /** Ochranná lhůta v dnech. Potřeba k ověření, že rozdělaná práce pořád platí. */
  graceDny: number;
};

/**
 * Platí rozdělaná práce ještě? Volá se JEN u řádků převzatých z minula.
 *
 * ⛔⛔ PROČ TO EXISTUJE (revize R1, nález S8): razítko se maže při nové pozvánce
 *    (`client_invite`), ale ten delete může selhat, a dřív se to jen zalogovalo.
 *    Zůstalé razítko `opakovat` by pak druhý den zavřelo NOVÝ nárok vráceného
 *    klienta, a `opakovat_mail` by mu poslalo rozloučení uprostřed spolupráce.
 *    Spoléhat na úspěšné smazání je slabší pojistka než se zeptat na živý stav.
 * ⛔ Chyba čtení NENÍ odpověď: vrací se `nevim` a člověk se nechá na další běh.
 */
export type RozhodnutiOPrevzatem =
  /** Nárok se nepodařilo přečíst. Nesahat na nic, nechat na další běh. */
  | "nevim"
  /** Je zase klient. Rozdělaná práce se ZAHODÍ, ne dokončí. */
  | "znovu_klient"
  /** Přístup je zavřený a rozloučení NIKDY neodešlo. Poslat POUZE mail. */
  | "dokonci_mail"
  /** Přístup je zavřený a rozloučení už prokazatelně proběhlo. Jen uzavřít. */
  | "uzavri_bez_mailu"
  /**
   * Přístup je zavřený a o mailu se ví jen to, že se o něj někdo pokusil.
   * ⛔ NEPOSÍLAT: mohl odejít. Rozhodne člověk (Martin 17. 9.: „raději nikdy
   *    mail navíc"). Razítko jde na `chyba_nejiste` a jde alert.
   */
  | "nejiste_rozhodne_clovek"
  /** Běžná cesta: zavřít přístup a poslat rozloučení. */
  | "zavri";

/**
 * Co se má stát s člověkem, kterého běh převzal z minula?
 *
 * ⛔⛔ PROČ TO NENÍ JEN „platí / neplatí" (revize R2, nález V1): u převzaté
 *    ZASEKNUTÉ rezervace i u řádku, kterému `narok_neprecten` přepsal stav, je
 *    nárok vypnutý a rozloučení CHYBÍ. Předchozí verze to obojí uzavřela jako
 *    `zavren_jinde`, tedy bez mailu a bez alertu. Přitom „zavřel to admin, a ten
 *    mail poslal sám" a „zavřel to automat a mail nedošel" jsou dvě různé věci.
 *    Rozlišuje je `sentOk`: odeslání se prokázalo jen tehdy, když je `true`.
 *
 * ⛔ Chyba čtení NENÍ odpověď: vrací se `nevim`.
 * ⚠️ Ruční odchod z admina po sobě nechává razítko `hotovo`, a ten se do téhle
 *    funkce nikdy nedostane (`zaber` uzavřené stavy nepřebírá). Neaktivní nárok
 *    u PŘEVZATÉHO řádku proto znamená práci automatu, ne admina.
 */
export function rozhodniOPrevzatem(
  narok: { active: boolean | null; expiresAt: string | null },
  opts: { predchozi: "opakovat" | "opakovat_mail" | "zaseknute"; sentOk: boolean | null; tedMs: number; graceDny: number },
): RozhodnutiOPrevzatem {
  if (narok.active === null) return "nevim";
  // Nárok je zase aktivní: člověk se vrátil, ať už byla rozdělaná jakákoli práce.
  if (narok.active) {
    if (opts.predchozi === "opakovat_mail") return "znovu_klient";
    // Aktivní nárok bez konce nebo s koncem v budoucnu = nové období.
    if (!narok.expiresAt) return "znovu_klient";
    const konec = Date.parse(String(narok.expiresAt));
    if (!Number.isFinite(konec)) return "znovu_klient";
    const mez = opts.tedMs - Math.max(0, opts.graceDny) * 86400000;
    return konec <= mez ? "zavri" : "znovu_klient";
  }
  // ⛔ `opakovat_mail` JE VÝSLOVNÉ „mail jistě neodešel" (Resend 4xx, chybějící
  //    klíč). Ten stav rozhoduje sám a `sentOk` ho nepřebíjí; jinak by se
  //    `sent_ok: false`, který k němu patří, přečetl jako nejistota a rozloučení
  //    by se nedoposlalo nikdy.
  if (opts.predchozi === "opakovat_mail") return "dokonci_mail";

  // Nárok je vypnutý. Rozhodují TŘI stavy `sentOk`, ne dva (revize R3, nález S4).
  // ⛔ `true`  = odeslání se prokázalo   => není co dělat
  // ⛔ `null`  = nikdy se neposílalo     => doposlat
  // ⛔ `false` = někdo se pokusil a výsledek se neprokázal => NEPOSÍLAT
  //    Do R3 se `false` slévalo s `null` do „doposlat". Jenže `false` píše i
  //    větev 5xx a `sit:`, kde mail MOHL odejít: kdyby se ten zápis nepovedl
  //    (nebo proces umřel), další běh by poslal DRUHÝ mail. To je přesně to,
  //    co Martinovo „raději nikdy mail navíc" zakazuje.
  // ⚠️ Stav `opakovat_mail` sem nespadá: ten sám o sobě znamená JISTÉ neodeslání
  //    (Resend 4xx, chybějící klíč) a řeší se výš.
  if (opts.sentOk === true) return "uzavri_bez_mailu";
  if (opts.sentOk === false) return "nejiste_rozhodne_clovek";
  return "dokonci_mail";
}

/**
 * Kdo z razítek patří do fronty běhu.
 *
 * ⛔⛔ TOHLE JE ČISTÁ FUNKCE SCHVÁLNĚ (revize R2, nálezy V1 a V2). Dokud tenhle
 *    výběr žil uvnitř `Deno.serve()`, nešel otestovat, a přesně v něm byly DVĚ
 *    mrtvé pojistky z R1: fronta brala jen `opakovat` a `opakovat_mail` s
 *    `pokusy < 5`, takže `zaber` se pro opuštěnou `rezervovano` ani pro řádek nad
 *    stropem NIKDY nezavolal. Mutace, které vypínaly pravidla uvnitř `zaber`,
 *    zůstávaly zelené, protože testy volaly `zaber` napřímo a frontu neviděly.
 *
 * ⛔ Filtruje se JEN to, co je opravdu uzavřené. O všem ostatním rozhoduje
 *    `zaber`, tedy jedno místo, které jde otestovat.
 * ⛔ Řádek nad stropem do fronty PATŘÍ: `zaber` ho přepne na `vzdano` a pošle
 *    alert. Kdyby ho fronta vyhodila, `vzdano` by se nezapsalo nikdy.
 */
export function razitkaDoFronty(
  razitka: RazitkoRadek[],
  opts: { tedMs: number },
): { emaily: string[]; nadStropem: number; zaseknutych: number } {
  const emaily: string[] = [];
  let nadStropem = 0, zaseknutych = 0;
  for (const r of razitka) {
    const email = String(r?.email ?? "").trim().toLowerCase();
    if (!email) continue;
    const stav = String(r.stav ?? "");
    if (STAVY_UZAVRENE.includes(stav as StavRazitka)) continue;
    if (Number(r.pokusy ?? 0) >= MAX_POKUSU) nadStropem++;
    if (stav === "opakovat" || stav === "opakovat_mail") { emaily.push(email); continue; }
    if (stav === "rezervovano" && jeZaseknute(r, opts.tedMs)) { zaseknutych++; emaily.push(email); continue; }
  }
  return { emaily, nadStropem, zaseknutych };
}

/**
 * Zabere si člověka, nebo řekne proč ne.
 *
 * Pořadí kontrol je závazné:
 *  1. nový řádek (nejčastější cesta, jeden insert)
 *  2. uzavřené stavy => nesahat
 *  3. vyčerpaný strop pokusů => `vzdano` a alert
 *  4. `opakovat` / `opakovat_mail` => převzít
 *  5. `rezervovano` starší než 30 minut => opuštěná rezervace, převzít a alertovat
 *  6. cokoli jiného => obsazeno
 *
 * ⛔ Závod mezi souběžnými běhy rozhoduje `prevezmi` s podmínkou na PŮVODNÍ stav
 *    a s počtem změněných řádků, ne čtení. Kdo prohraje, neodesílá.
 */
export async function zaber(email: string, deps: BehDeps): Promise<ZaberVysledek> {
  const vloz = await deps.vlozRazitko(email);
  if (vloz.ok) return { stav: "ok", predchozi: "", promo: "", pokusy: 1, sentOk: null };
  if (vloz.kod !== "23505") return { stav: "chyba", detail: vloz.detail };

  const { radek, chyba } = await deps.ctiRazitko(email);
  if (chyba) return { stav: "chyba", detail: chyba };
  // ⛔ Prázdno po `23505` znamená, že řádek mezitím někdo smazal (nová pozvánka).
  //    Není to „nemá razítko, tak ho zaberu": příští běh začne čistě.
  if (!radek) return { stav: "obsazeno", duvod: "razitko_zmizelo" };

  const stav = String(radek.stav ?? "");
  const pokusy = Number(radek.pokusy ?? 0);
  if (STAVY_UZAVRENE.includes(stav as StavRazitka)) return { stav: "obsazeno", duvod: stav };

  if (pokusy >= MAX_POKUSU) {
    await deps.nastavRazitko(email, {
      stav: "vzdano",
      duvod: "strop_pokusu:" + pokusy,
      updated_at: new Date(deps.ted()).toISOString(),
    });
    await deps.alert(
      "🔴 Konec koučinku: vzdávám to po " + pokusy + " pokusech",
      "Klient: " + email + "\nPoslední důvod: " + String(radek.duvod ?? "") +
        "\n\nAutomat se o tohohle člověka pokoušel " + pokusy + "krát a pokaždé to selhalo.\n" +
        "Dál to zkoušet nebude, aby ve Stripu nevznikaly další nepoužité kódy.\n" +
        "Ukonči ho ručně v adminu, nebo smaž jeho řádek z `koucink_konec_sent`.",
      email,
    );
    return { stav: "vzdano", pokusy };
  }

  const zaseknute = stav === "rezervovano" && jeZaseknute(radek, deps.ted());
  if (!STAVY_K_PREVZETI.includes(stav as StavRazitka) && !zaseknute) {
    return { stav: "obsazeno", duvod: stav };
  }

  // ⛔⛔ ALERT JDE PŘED ZÁMKEM (revize R3, nález S3). Opuštěná rezervace je fakt
  //    o stavu databáze, ne odměna za vyhraný závod. Kdyby se hlásila až po
  //    úspěšném převzetí a to by z jakéhokoli důvodu neprocházelo, řádek by
  //    visel dál a NIKDO by se to nedozvěděl. Strop alertů na běh drží šum.
  if (zaseknute) {
    await deps.alert(
      "⚠️ Konec koučinku: opuštěná rezervace",
      "Klient: " + email + "\nRazítko viselo v `rezervovano` déle než 30 minut.\n\n" +
        "Nejspíš předchozí běh zabil timeout cronu (120 s) nebo strop běhu.\n" +
        "Stav klienta může být rozpracovaný: zkontroluj `entitlements` a `tvujcoach_grants`.\n" +
        "Automat se ji teď pokusí převzít a dokončit.",
      email,
    );
  }

  const p = await deps.prevezmi(email, stav, pokusy + 1, zaseknute);
  if (p.chyba) return { stav: "chyba", detail: p.chyba };
  if (p.pocet !== 1) return { stav: "obsazeno", duvod: "zavod:" + stav };
  return {
    stav: "ok",
    predchozi: zaseknute ? "zaseknute" : (stav as "opakovat" | "opakovat_mail"),
    promo: String(radek.promo_code ?? ""),
    pokusy: pokusy + 1,
    // ⛔ Jen `true` znamená „rozloučení už odešlo". `null` i `false` se čtou jako
    //    „chybí" (nález V1): u zaseknuté rezervace je to jediné, podle čeho jde
    //    poznat, jestli se má mail doposlat.
    sentOk: radek.sent_ok === true ? true : (radek.sent_ok === false ? false : null),
  };
}

/** Visí rezervace déle, než je zdrávo? */
export function jeZaseknute(radek: RazitkoRadek, tedMs: number): boolean {
  const t = Date.parse(String(radek.updated_at ?? ""));
  if (!Number.isFinite(t)) return true; // neznámý čas u `rezervovano` je sám o sobě podezřelý
  return tedMs - t > ZASEKNUTO_PO_MS;
}

export type VysledekJednoho = {
  email: string;
  /** Co se s tím člověkem stalo. */
  vysledek:
    | "hotovo"
    | "hotovo_bez_mailu"
    | "opakovat"
    | "opakovat_mail"
    | "chyba_nejiste"
    | "preskoceno";
  duvod: string;
};

/**
 * Zpracuje jednoho člověka, kterého už máme zabraného.
 *
 * ⛔⛔ POŘADÍ JE ZÁVAZNÉ a každý krok má svůj návrat:
 *   1. brána (podle ní se pozná, jestli je potřeba promo kód)
 *   2. promo kód  selže => `opakovat`, NIC se nezavřelo
 *   3. appka      selže => `opakovat`, nárok zůstává aktivní
 *   4. nárok      selže => `opakovat`
 *   5. mail       jisté neodeslání => `opakovat_mail` (přístup UŽ je zavřený)
 *                 nejistota        => `chyba_nejiste`, rozhodne člověk
 *
 * ⛔ `predchozi === "opakovat_mail"` PŘESKAKUJE KROKY 2 AŽ 4. Přístup je zavřený
 *    už z minula a `ukonciPristup` by vrátil `uz_ukoncen`, což se dřív četlo jako
 *    „zavřel to někdo jinde" a mail se přeskočil navždy (nález V1).
 */
export async function zpracujJednoho(
  email: string,
  zabrano: { predchozi: "" | "opakovat" | "opakovat_mail" | "zaseknute"; promo: string; pokusy?: number; sentOk?: boolean | null },
  deps: BehDeps,
): Promise<VysledekJednoho> {
  const ted = () => new Date(deps.ted()).toISOString();
  // ⛔ JEDINÝ ZDROJ PRAVDY JE `rozhodniOPrevzatem` (revize R2). Dřív se `jenMail`
  //    odvozoval i tady z `predchozi`, takže ta hodnota existovala dvakrát a jedna
  //    z kopií byla mrtvá: mutace, která ji vypnula, testy nezčervenala. U nového
  //    člověka (`predchozi === ""`) se rozhodnutí nevolá a zůstává `false`.
  let jenMail = false;

  // --- 0) PLATÍ ROZDĚLANÁ PRÁCE JEŠTĚ? (jen u řádků z minula) ---------------
  if (zabrano.predchozi !== "") {
    const narok = await deps.stavNaroku(email);
    const rozhodnuti = rozhodniOPrevzatem(narok, {
      predchozi: zabrano.predchozi,
      sentOk: zabrano.sentOk ?? null,
      tedMs: deps.ted(),
      graceDny: deps.graceDny,
    });
    if (rozhodnuti === "nevim") {
      // ⛔⛔ PŘEDCHOZÍ STAV SE ZACHOVÁ (revize R2, nález V3). Do R2 se sem psalo
      //    natvrdo `opakovat`, čímž se z `opakovat_mail` stalo obyčejné opakování:
      //    další běh pak sáhl na nárok, dostal „už je ukončený" a rozloučení
      //    zahodil. Chyba ČTENÍ nesmí měnit stav práce.
      const navrat = zabrano.predchozi === "opakovat_mail" ? "opakovat_mail" : "opakovat";
      await deps.nastavRazitko(email, { stav: navrat, duvod: "narok_neprecten", updated_at: ted() });
      await deps.alert(
        "⚠️ Konec koučinku: nárok se nepodařilo přečíst",
        "Klient: " + email + "\nRozdělaná práce: " + zabrano.predchozi +
          "\n\nAutomat NIC neudělal a stav nechal beze změny. Když se to opakuje,\n" +
          "je to porucha čtení `entitlements`, ne stav toho klienta.",
        email,
      );
      return { email, vysledek: navrat === "opakovat_mail" ? "opakovat_mail" : "opakovat", duvod: "narok_neprecten" };
    }
    if (rozhodnuti === "uzavri_bez_mailu") {
      // Přístup je zavřený a rozloučení už prokazatelně odešlo. Není co dělat.
      await deps.nastavRazitko(email, {
        stav: "hotovo",
        duvod: "uz_odeslano",
        sent_ok: true,
        updated_at: ted(),
      });
      return { email, vysledek: "preskoceno", duvod: "uz_odeslano" };
    }
    if (rozhodnuti === "nejiste_rozhodne_clovek") {
      // ⛔ Přístup je zavřený, mail MOHL odejít a nikdo to neprokázal. Automat to
      //    neopakuje; uzavře razítko na `chyba_nejiste` a rozhodne člověk.
      await deps.nastavRazitko(email, {
        stav: "chyba_nejiste",
        duvod: "nejiste_z_minula",
        updated_at: ted(),
      });
      await deps.alert(
        "⚠️ Konec koučinku: rozdělané odeslání skončilo v nejistotě",
        "Klient: " + email + "\n\nPřístup je zavřený, ale nevíme, jestli mu rozloučení došlo.\n" +
          "Automat ho NEZOPAKUJE (mail navíc je horší než mail chybějící).\n\n" +
          "Zkontroluj Resend a rozhodni: v kartě klienta je tlačítko Ukončit koučink,\n" +
          "které u tohohle stavu POŠLE JEN MAIL (zeptá se tě na potvrzení).",
        email,
      );
      return { email, vysledek: "chyba_nejiste", duvod: "nejiste_z_minula" };
    }
    if (rozhodnuti === "dokonci_mail") {
      // ⛔⛔ TOHLE JE OPRAVA V1: přístup je zavřený, rozloučení CHYBÍ. Dřív to
      //    skončilo jako `zavren_jinde` (bez mailu a bez alertu), takže převzatá
      //    zaseknutá rezervace člověka umlčela navždy.
      jenMail = true;
    }
    if (rozhodnuti === "znovu_klient") {
      // ⛔ Rozdělaná práce se ZAHODÍ, ne dokončí. Ten člověk je zase klient.
      await deps.nastavRazitko(email, {
        stav: "hotovo",
        duvod: "znovu_klient:rozdelana_prace_zahozena",
        sent_ok: false,
        updated_at: ted(),
      });
      await deps.alert(
        "⚠️ Konec koučinku: rozdělaná práce patřila klientovi, který se vrátil",
        "Klient: " + email + "\n\nV `koucink_konec_sent` na něm zůstalo razítko z minulého konce,\n" +
          "ale nárok je zase aktivní. Automat proto NIC neudělal a razítko uzavřel.\n" +
          "Nejspíš se nepovedlo smazat razítko při nové pozvánce; zkontroluj to.",
        email,
      );
      return { email, vysledek: "preskoceno", duvod: "znovu_klient" };
    }
  }

  const maAcademy = await deps.maAcademy(email);

  const confirm = await deps.brana(email, "client_operational", "koucink-konec.confirm");
  const sales = await deps.brana(email, "marketing", "koucink-konec.sales");
  const posleMail = confirm.action === "send";
  const chceSales = posleMail && sales.action === "send" && !maAcademy;

  // --- 2) PROMO KÓD ---------------------------------------------------------
  let promo = zabrano.promo;
  if (chceSales) {
    // ⛔ BEZ KUPÓNU SE NIC NEZAVÍRÁ (nález S5). Dřív se to dostalo až do Stripu,
    //    ten vrátil `chybi_coupon_id`, razítko šlo na `opakovat` a s každým dnem
    //    ubyl jeden pokus ze stropu. Ptát se Stripu na něco, co víme dopředu,
    //    nemá smysl.
    if (!deps.maKupon) {
      // ⛔⛔ TENHLE POKUS SE NEPOČÍTÁ (revize R2, nález V2). Kupón je Martinova
      //    konfigurace, ne porucha klienta: kdyby se odečítal ze stropu pěti
      //    pokusů, po pěti dnech by člověk skončil ve `vzdano` a automat by ho
      //    po doplnění kupónu už nikdy nevzal. Pokusy se proto vrací zpět.
      await deps.nastavRazitko(email, {
        stav: "opakovat",
        duvod: "bez_kuponu",
        pokusy: Math.max(0, (zabrano.pokusy ?? 1) - 1),
        updated_at: ted(),
      });
      // ⛔ Alert KAŽDÝ BĚH, ne jednou týdně: bez kupónu se nikomu nic nezavírá
      //    a ticho by vypadalo jako „nikdo neskončil".
      await deps.alert(
        "⚠️ Konec koučinku: kupón na roční VIP není nastavený",
        "Klient ceka: " + email + "\n\n" +
          "`app_config.koucink_vip_coupon_id` je prázdné, takže promo kód nemá z čeho\n" +
          "vzniknout. Automat proto NIKOHO nezavírá: rozloučení bez funkčního kódu by\n" +
          "slíbilo slevu, kterou pokladna nezná.\n\n" +
          "Založ kupón ve Stripu (20 %, duration once, jen roční VIP) a jeho id vlož do\n" +
          "`app_config.koucink_vip_coupon_id`. Pak to automat dokončí sám.",
        "bez_kuponu",
      );
      return { email, vysledek: "opakovat", duvod: "bez_kuponu" };
    }
    if (!promo) {
      // ⛔⛔ KÓD SE VYLOSUJE A ULOŽÍ DŘÍV, NEŽ SE O NĚM DOZVÍ STRIPE (nález V2).
      //    Opačné pořadí znamenalo, že pád sítě mezi voláním Stripu a zápisem
      //    řádku nechal ve Stripu kód, o kterém nevíme, a další pokus založil
      //    další. Takhle je opakování idempotentní: `zalozPromo` se stejným
      //    textem kód nezdvojí.
      // ⛔ Návrat zápisu se ČTE. Když se kód neuloží, Stripe se nevolá vůbec.
      const kod = deps.vylosujKod();
      const ulozeno = await deps.nastavRazitko(email, {
        promo_code: kod,
        duvod: "promo_pending",
        updated_at: ted(),
      });
      if (!ulozeno) {
        await deps.alert(
          "🔴 Konec koučinku: promo kód se nepodařilo uložit",
          "Klient: " + email + "\n\nZápis do `koucink_konec_sent` selhal, takže jsem Stripe\n" +
            "vůbec nevolal. NIC se nezavřelo a mail NEODESEL.\n" +
            "Bez uloženého kódu by další pokus založil ve Stripu další nepoužitou slevu.",
          email,
        );
        return { email, vysledek: "opakovat", duvod: "promo_neulozen" };
      }
      promo = kod;
    }
    let p = await deps.zalozPromo(email, promo);
    // ⛔ ARCHIVOVANÝ KÓD SE NEDÁ OŽIVIT a Stripe nedovolí založit aktivní kód
    //    s týmž textem (revize R3, nález S6). Stává se to, když Martin vymění
    //    kupón: „if the underlying coupon for a promotion code becomes invalid,
    //    all of its promotion codes become permanently inactive."
    //    ⇒ Vylosuje se NOVÝ text, uloží se a zkusí se to ještě JEDNOU. Víc pokusů
    //      nemá smysl: druhá kolize je při 31^6 kombinacích porucha, ne náhoda.
    if (!p.ok && p.chyba === deps.kodNeaktivni) {
      const novy = deps.vylosujKod();
      const ulozenoNovy = await deps.nastavRazitko(email, {
        promo_code: novy,
        duvod: "promo_pending:nahrada_archivovaneho",
        updated_at: ted(),
      });
      if (!ulozenoNovy) {
        await deps.alert(
          "🔴 Konec koučinku: náhradní promo kód se nepodařilo uložit",
          "Klient: " + email + "\n\nPůvodní kód je ve Stripu archivovaný a nový se nepodařilo\n" +
            "zapsat, takže jsem Stripe nevolal. NIC se nezavřelo a mail NEODESEL.",
          email,
        );
        return { email, vysledek: "opakovat", duvod: "promo_neulozen" };
      }
      promo = novy;
      p = await deps.zalozPromo(email, novy);
    }
    if (!p.ok) {
      await deps.nastavRazitko(email, { stav: "opakovat", duvod: "promo:" + p.chyba, updated_at: ted() });
      await deps.alert(
        "🔴 Konec koučinku: promo kód se nepodařilo založit",
        "Klient: " + email + "\nChyba Stripu: " + p.chyba +
          "\n\nStav: NIC se nezavřelo a mail NEODESEL. Nárok i appka běží dál.\n" +
          "Co zkontrolovat:\n" +
          " 1. app_config.koucink_vip_coupon_id ukazuje na existující kupón ve Stripu,\n" +
          " 2. secret STRIPE_RESTRICTED_PROMO_KEY má právo ZÁPISU na Promotion codes.\n" +
          "Další běh to zkusí znovu sám.",
        email,
      );
      return { email, vysledek: "opakovat", duvod: "promo:" + p.chyba };
    }
    promo = p.kod;
  }

  // --- 3) + 4) APPKA A NÁROK ------------------------------------------------
  if (!jenMail) {
    const u = await deps.ukonciPristup(email);
    if (u.stav === "appka_selhala" || u.stav === "narok_selhal") {
      await deps.nastavRazitko(email, {
        stav: "opakovat",
        duvod: u.stav + ":" + (u.detail ?? u.tvujcoach),
        updated_at: ted(),
      });
      await deps.alert(
        "🔴 Konec koučinku: " + (u.stav === "appka_selhala" ? "appka neodpověděla" : "nárok se nevypnul"),
        "Klient: " + email + "\nMost do appky: " + u.tvujcoach + "\nDetail: " + (u.detail ?? "") +
          "\n\nStav: mail NEODESEL." +
          (u.stav === "appka_selhala"
            ? "\nNárok ZŮSTAVA AKTIVNI, schválně: zavřít koučink a nechat appku běžet by byla tichá polovina.\n"
            : "\nAppka už zásah dostala, nárok se ale nevypnul. Zkontroluj ho v adminu.\n") +
          "Další běh to zkusí znovu sám.",
        email,
      );
      return { email, vysledek: "opakovat", duvod: u.stav };
    }
    if (u.stav === "neni_klient" || u.stav === "uz_ukoncen") {
      // Někdo ho zavřel mezitím ručně v adminu, a ten mail poslal sám.
      // ⚠️ Tahle větev je bezpečná JEN proto, že sem `opakovat_mail` nedojde:
      //    po neodeslaném mailu se přístup zavírat nezkouší podruhé.
      await deps.nastavRazitko(email, {
        stav: "hotovo",
        duvod: "zavren_jinde:" + u.stav,
        sent_at: ted(),
        sent_ok: false,
        updated_at: ted(),
      });
      return { email, vysledek: "preskoceno", duvod: u.stav };
    }
  }

  // --- 5) MAIL --------------------------------------------------------------
  if (!posleMail) {
    await deps.logSkip(confirm.decision);
    await deps.nastavRazitko(email, {
      stav: "hotovo",
      duvod: "mail_preskocen:" + confirm.reason,
      ma_academy: maAcademy,
      sent_at: ted(),
      sent_ok: false,
      updated_at: ted(),
    });
    return { email, vysledek: "hotovo_bez_mailu", duvod: "mail_preskocen:" + confirm.reason };
  }
  if (sales.action === "skip") await deps.logSkip(sales.decision);

  const r = await deps.posliMail(email, { maAcademy, promoKod: promo, includeSales: sales.action === "send" });
  if (r.ok) {
    // ⛔⛔ NÁVRAT ZÁPISU SE ČTE (revize R3, nález S4). Když se `hotovo` neuloží,
    //    v tabulce zůstane `rezervovano`, další běh ho po půl hodině převezme
    //    jako zaseknutý a mail by odešel PODRUHÉ. Tohle je jediné místo, kde se
    //    o tom dá dozvědět, protože Resend už zásilku přijal.
    const ulozeno = await deps.nastavRazitko(email, {
      stav: "hotovo",
      duvod: "odeslano",
      ma_academy: maAcademy,
      sent_at: ted(),
      sent_ok: true,
      updated_at: ted(),
    });
    if (!ulozeno) {
      await deps.alert(
        "🔴 Konec koučinku: mail ODEŠEL, ale razítko se neuložilo",
        "Klient: " + email + "\n\nRozloučení Resend přijal, ale zápis do `koucink_konec_sent`\n" +
          "selhal. Řádek zůstal rozpracovaný a další běh by ho mohl vzít znovu.\n\n" +
          "⛔ Nastav mu ručně `stav='hotovo'`, `sent_ok=true`, ať mu mail nepřijde podruhé.",
        email,
      );
    }
    return { email, vysledek: "hotovo", duvod: "odeslano" };
  }

  // ⛔⛔ ROZHODUJE, JESTLI TĚLO MAILU MOHLO DOJÍT NA RESEND.
  const teloMohloDojit = r.status >= 500 || String(r.chyba ?? "").startsWith("sit:");
  if (teloMohloDojit) {
    // ⛔⛔ I TENHLE ZÁPIS SE OVĚŘUJE (revize R3, nález S4). Když se neuloží,
    //    zůstane `rezervovano` se starým `sent_ok`, a to je přesně stav, ze
    //    kterého by se po půl hodině stal „doposlat". Proto se `sent_ok: false`
    //    zapisuje i tehdy, když stav selže, a při selhání jde alert navíc.
    const ulozeno = await deps.nastavRazitko(email, {
      stav: "chyba_nejiste",
      duvod: "resend:" + (r.chyba ?? r.status),
      ma_academy: maAcademy,
      sent_at: ted(),
      sent_ok: false,
      updated_at: ted(),
    });
    if (!ulozeno) {
      await deps.alert(
        "🔴 Konec koučinku: nejisté odeslání se nepodařilo zapsat",
        "Klient: " + email + "\n\nMail MOHL odejít a zápis stavu selhal, takže v tabulce\n" +
          "zůstalo rozpracované razítko.\n\n" +
          "⛔ Nastav mu ručně `stav='chyba_nejiste'` a `sent_ok=false`, jinak se mu\n" +
          "automat může pokusit poslat rozloučení znovu.",
        email,
      );
    }
    await deps.alert(
      "⚠️ Konec koučinku: NEVÍM, jestli rozlučkový mail odešel",
      "Klient: " + email + "\nStav Resendu: " + r.status + "\nChyba: " + (r.chyba ?? "") +
        "\n\nPřístup je zavřený. Mail MOHL odejít, proto ho automat NEZOPAKUJE.\n" +
        "Zkontroluj schránku (Resend, logy) a rozhodni se sám. Když má jít znovu,\n" +
        "smaž jeho řádek z `koucink_konec_sent` nebo mu pošli rozloučení z admina.",
      email,
    );
    return { email, vysledek: "chyba_nejiste", duvod: "resend:" + r.status };
  }

  // ⛔⛔ JISTÉ NEODESLÁNÍ PO ZAVŘENÉM PŘÍSTUPU (nález V1). Tohle NENÍ `opakovat`:
  //    příští běh nesmí znovu sahat na nárok, jinak vrátí `uz_ukoncen` a mail
  //    přeskočí navždy. A alert jde HNED, protože člověk už přístup nemá.
  await deps.nastavRazitko(email, {
    stav: "opakovat_mail",
    duvod: "resend:" + (r.chyba ?? r.status),
    ma_academy: maAcademy,
    promo_code: promo || null,
    sent_ok: false,
    updated_at: ted(),
  });
  await deps.alert(
    "🔴 Konec koučinku: přístup zavřený, rozloučení NEODESLO",
    "Klient: " + email + "\nStav Resendu: " + r.status + "\nChyba: " + (r.chyba ?? "") +
      "\n\nPřístup do appky i klientské sekce je UŽ ZAVŘENÝ, ale mail jistě neodešel.\n" +
      "Automat ho zkusí poslat znovu při dalším běhu a na nárok už nesáhne.\n" +
      "Když to spěchá, pošli rozloučení z admina (druhé kliknutí na Ukončit koučink\n" +
      "u tohohle klienta pošle POUZE mail).",
    email,
  );
  return { email, vysledek: "opakovat_mail", duvod: "resend:" + r.status };
}
