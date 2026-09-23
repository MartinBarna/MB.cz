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

/**
 * Stav PRÁCE: co má automat dělat dál. Popis je v `koucink-konec-2026-09-22.sql`.
 *
 * ⛔⛔ O MAILU NEŘÍKÁ NIC (revize R4). Do R4 tu byly i `opakovat_mail`
 *    a `chyba_nejiste`, tedy stavy mailu vydávané za stavy práce. Spolu
 *    s booleanem `sent_ok` to znamenalo, že tatáž hodnota `false` jednou
 *    znamenala „jistě neodešlo, pošli znovu" a podruhé „mohl odejít, neposílej",
 *    a rozlišoval je stav práce. Jakmile ten z jakéhokoli důvodu zmizel (pád
 *    běhu, selhaný zápis), význam se tiše převrátil. Mail má proto vlastní
 *    sloupec a tenhle výčet je zase jen o práci.
 */
export type StavRazitka = "rezervovano" | "opakovat" | "hotovo" | "vzdano";

/** Stavy, ze kterých si běh smí člověka vzít. */
export const STAVY_K_PREVZETI: StavRazitka[] = ["opakovat"];
/** Stavy, které znamenají „hotovo, nesahat". */
export const STAVY_UZAVRENE: StavRazitka[] = ["hotovo", "vzdano"];

// ⛔ Stav MAILU a jeho čtení žijí v `_shared/koucink-konec.ts`, protože stejné
//    pořadí zápisů používá i ruční odchod z admina. Dvě definice téhož výčtu by se
//    rozešly přesně v té hodnotě, na které záleží.
export { mailStavZRadku, type MailStav } from "../_shared/koucink-konec.ts";
import { type MailStav, mailStavZRadku, odesliSRazitkem } from "../_shared/koucink-konec.ts";

/** Mail se smí (znovu) poslat jen z těchhle stavů. */
export const MAIL_STAVY_K_ODESLANI: MailStav[] = ["neposlano", "odmitnuto"];

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
  /** Zdroj pravdy o rozloučení. Prázdno se čte jako `neposlano`. */
  mail_stav?: string | null;
};

export type Zabrano = {
  stav: "ok";
  /** Ze kterého stavu se člověk převzal. Prázdno = nový řádek. */
  predchozi: "" | "opakovat" | "zaseknute";
  /** Kód už jednou vylosovaný a uložený. Nový se losovat NESMÍ. */
  promo: string;
  pokusy: number;
  /** Co se stalo s rozloučením. Podle TOHOHLE se rozhoduje, ne podle `predchozi`. */
  mailStav: MailStav;
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

export type OdeslaniVysledek = {
  ok: boolean;
  status: number;
  chyba?: string;
  /**
   * ID zásilky u Resendu. ⛔ Bez něj se `odeslano` NEZAPISUJE (revize R5, N6):
   *    Resend sice mohl vrátit 200, ale bez id to nejde doložit ani spárovat
   *    s bouncem, takže se to bere jako nejistota a rozhodne člověk.
   */
  providerId?: string;
};

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
  /**
   * Zapíše libovolná pole razítka. Vrací `false`, když zápis selhal.
   * ⛔ Návrat se ČTE všude, kde na zápisu stojí, že se něco neudělá podruhé.
   */
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
   *    mail navíc"). Práce se uzavře (`hotovo`), mail dostane `nejiste`, jde alert.
   */
  | "nejiste_rozhodne_clovek"
  /** Běžná cesta: zavřít přístup a poslat rozloučení. */
  | "zavri"
  /**
   * Totéž jako `zavri`, ale v řádku visel stav mailu z MINULÉHO pokusu
   * (`posilam`, `nejiste`, `odmitnuto`, `odeslano`), přestože přístup pořád běží.
   * ⛔ Ten stav se zahodí (`neposlano`) a jde alert: patří k jinému konci.
   */
  | "zavri_zahod_mail";

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
  opts: { mailStav: MailStav; tedMs: number; graceDny: number },
): RozhodnutiOPrevzatem {
  if (narok.active === null) return "nevim";

  // ⛔⛔ NEJDŘÍV SE PTÁ, JESTLI PŘÍSTUP BĚŽÍ, TEPRVE PAK NA MAIL (revize R5, nález V1).
  //    Do R5 se `nejiste` a `posilam` vyhodnotily jako „rozhodne člověk" dřív,
  //    než se kód podíval na nárok. U člověka, kterému přístup pořád běží, to
  //    znamenalo zapsat `hotovo` a přístup NEZAVŘÍT, a alert Martinovi slíbil,
  //    že tlačítko „pošle jen mail". Poslalo by rozloučení aktivnímu klientovi.
  //
  //    Stav mailu totiž popisuje KONKRÉTNÍ pokus o rozloučení, a ten má smysl
  //    jen tehdy, když přístup už je zavřený. Tok je vždycky: zavřít přístup,
  //    PAK `posilam`, PAK Resend. Běžící nárok s `posilam` nebo `nejiste` proto
  //    znamená, že ten pokus patří k MINULÉMU konci (člověk se mezitím vrátil)
  //    nebo že se přístup nikdy nezavřel. V obou případech je starý stav mailu
  //    k ničemu a rozhoduje nárok.
  if (narok.active) {
    // Aktivní nárok bez konce nebo s koncem v budoucnu = nové období.
    if (!narok.expiresAt) return "znovu_klient";
    const konec = Date.parse(String(narok.expiresAt));
    if (!Number.isFinite(konec)) return "znovu_klient";
    const mez = opts.tedMs - Math.max(0, opts.graceDny) * 86400000;
    if (konec > mez) return "znovu_klient";
    // Nárok běží a jeho období skončilo. Starý stav mailu se ZAHODÍ a jde se
    // plnou cestou; pokud v něm něco bylo, jde o tom alert (`zavri_zahod_mail`).
    return opts.mailStav === "neposlano" ? "zavri" : "zavri_zahod_mail";
  }

  // ⛔⛔ PŘÍSTUP JE ZAVŘENÝ. Odsud rozhoduje JEN `mailStav`, ne to, odkud řádek
  //    přišel (revize R4). Do R4 se stejná informace četla ze stavu práce
  //    (`opakovat_mail`) i z booleanu `sent_ok`, a když stav práce zmizel, význam
  //    `false` se tiše převrátil z „jistě neodešlo" na „mohl odejít".
  if (opts.mailStav === "odeslano") return "uzavri_bez_mailu";
  // Mail MOHL odejít. ⛔ Automat nesahá, rozhoduje člověk.
  // ⚠️ `posilam` se sem dostane jen po ochranné lhůtě: někdo začal posílat
  //    a výsledek se nikdy nezapsal. Je to tatáž nejistota z jiného směru.
  if (opts.mailStav === "nejiste" || opts.mailStav === "posilam") return "nejiste_rozhodne_clovek";
  // Zbývá `neposlano` a `odmitnuto`: mail jistě neodešel, poslat se smí.
  return "dokonci_mail";
}

/**
 * Kdo z razítek patří do fronty běhu.
 *
 * ⛔⛔ TOHLE JE ČISTÁ FUNKCE SCHVÁLNĚ (revize R2, nálezy V1 a V2). Dokud tenhle
 *    výběr žil uvnitř `Deno.serve()`, nešel otestovat, a přesně v něm byly DVĚ
 *    mrtvé pojistky z R1: fronta brala jen rozdělané stavy s `pokusy < 5`,
 *    takže `zaber` se pro opuštěnou `rezervovano` ani pro řádek nad
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
    if (stav === "opakovat") { emaily.push(email); continue; }
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
 *  4. `opakovat` => převzít
 *  5. `rezervovano` starší než 30 minut => opuštěná rezervace, převzít a alertovat
 *  6. cokoli jiného => obsazeno
 *
 * ⛔ Závod mezi souběžnými běhy rozhoduje `prevezmi` s podmínkou na PŮVODNÍ stav
 *    a s počtem změněných řádků, ne čtení. Kdo prohraje, neodesílá.
 */
export async function zaber(email: string, deps: BehDeps): Promise<ZaberVysledek> {
  const vloz = await deps.vlozRazitko(email);
  if (vloz.ok) return { stav: "ok", predchozi: "", promo: "", pokusy: 1, mailStav: "neposlano" };
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
    predchozi: zaseknute ? "zaseknute" : "opakovat",
    promo: String(radek.promo_code ?? ""),
    pokusy: pokusy + 1,
    // ⛔ Stav mailu je VLASTNÍ sloupec, ne odvozenina ze stavu práce (revize R4).
    //    Právě proto se `zaber` nemusí ptát, odkud řádek přišel: o tom, jestli
    //    rozloučení chybí, rozhoduje jediná hodnota, která to říká přímo.
    mailStav: mailStavZRadku(radek.mail_stav),
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
    /** Přístup zavřený, mail JISTĚ neodešel. Další běh pošle jen mail. */
    | "odmitnuto"
    /** Mail mohl odejít. Automat nesahá, rozhoduje člověk. */
    | "nejiste"
    | "preskoceno";
  duvod: string;
};

/**
 * Zpracuje jednoho člověka, kterého už máme zabraného.
 *
 * ⛔⛔ POŘADÍ JE ZÁVAZNÉ a každý krok má svůj návrat:
 *   0. rozhodnutí o rozdělané práci (jen u řádků z minula, podle `mail_stav`)
 *   1. brána (podle ní se pozná, jestli je potřeba promo kód)
 *   2. promo kód  selže => `opakovat`, NIC se nezavřelo
 *                 (při DOPOSLÁNÍ ale mail odejde bez nabídky VIP, viz níž)
 *   3. appka      selže => `opakovat`, nárok zůstává aktivní
 *   4. nárok      selže => `opakovat`
 *   5. `posilam`  selže => Resend se NEVOLÁ
 *   6. mail       jisté neodeslání => `mail_stav = odmitnuto` (smí se poslat znovu)
 *                 nejistota        => `mail_stav = nejiste`, rozhodne člověk
 *                 úspěch           => `mail_stav = odeslano`
 *
 * ⛔ Rozhodnutí `dokonci_mail` PŘESKAKUJE KROKY 3 a 4. Přístup je zavřený už
 *    z minula a `ukonciPristup` by vrátil `uz_ukoncen`, což se dřív četlo jako
 *    „zavřel to někdo jinde" a mail se přeskočil navždy (nález V1 z R1).
 */
export async function zpracujJednoho(
  email: string,
  zabrano: { predchozi: "" | "opakovat" | "zaseknute"; promo: string; pokusy?: number; mailStav?: MailStav },
  deps: BehDeps,
): Promise<VysledekJednoho> {
  const ted = () => new Date(deps.ted()).toISOString();
  /** Pole, která se zapisují u KAŽDÉ změny mailového stavu. `sent_ok` je odvozenina. */
  const mail = (stav: MailStav, extra: Record<string, unknown> = {}) => ({
    mail_stav: stav,
    sent_ok: stav === "odeslano",
    updated_at: ted(),
    ...extra,
  });
  let jenMail = false;

  // --- 0) PLATÍ ROZDĚLANÁ PRÁCE JEŠTĚ? (jen u řádků z minula) ---------------
  if (zabrano.predchozi !== "") {
    const narok = await deps.stavNaroku(email);
    const rozhodnuti = rozhodniOPrevzatem(narok, {
      mailStav: zabrano.mailStav ?? "neposlano",
      tedMs: deps.ted(),
      graceDny: deps.graceDny,
    });
    if (rozhodnuti === "nevim") {
      // ⛔⛔ CHYBA ČTENÍ NESMÍ MĚNIT STAV PRÁCE ANI MAILU (revize R2, nález V3).
      //    Od R4 je to snadné: stav mailu je vlastní sloupec a tady se na něj
      //    prostě nesahá. Dřív se přepisoval stav práce, který stav mailu nesl,
      //    a tím se rozloučení tiše ztrácelo.
      await deps.nastavRazitko(email, { stav: "opakovat", duvod: "narok_neprecten", updated_at: ted() });
      await deps.alert(
        "⚠️ Konec koučinku: nárok se nepodařilo přečíst",
        "Klient: " + email + "\nStav mailu: " + (zabrano.mailStav ?? "neposlano") +
          "\n\nAutomat NIC neudělal a stav mailu nechal beze změny. Když se to opakuje,\n" +
          "je to porucha čtení `entitlements`, ne stav toho klienta.",
        email,
      );
      return { email, vysledek: "opakovat", duvod: "narok_neprecten" };
    }
    if (rozhodnuti === "uzavri_bez_mailu") {
      // Přístup je zavřený a rozloučení už prokazatelně odešlo. Není co dělat.
      await deps.nastavRazitko(email, { stav: "hotovo", duvod: "uz_odeslano", updated_at: ted() });
      return { email, vysledek: "preskoceno", duvod: "uz_odeslano" };
    }
    if (rozhodnuti === "nejiste_rozhodne_clovek") {
      // ⛔ Mail MOHL odejít a nikdo to neprokázal. Automat neposílá.
      // ⚠️ Sem spadá i řádek, který uvízl v `posilam`: běh začal posílat a výsledek
      //    se nikdy nezapsal. Je to táž nejistota, jen z jiného směru.
      await deps.nastavRazitko(email, mail("nejiste", { stav: "hotovo", duvod: "nejiste_z_minula" }));
      await deps.alert(
        "⚠️ Konec koučinku: rozdělané odeslání skončilo v nejistotě",
        "Klient: " + email + "\n\nPřístup je zavřený, ale nevíme, jestli mu rozloučení došlo.\n" +
          "Automat ho NEZOPAKUJE (mail navíc je horší než mail chybějící).\n\n" +
          "Zkontroluj Resend a rozhodni: v kartě klienta je tlačítko Ukončit koučink,\n" +
          "které u tohohle stavu POŠLE JEN MAIL a zeptá se tě na potvrzení.",
        email,
      );
      return { email, vysledek: "nejiste", duvod: "nejiste_z_minula" };
    }
    if (rozhodnuti === "zavri_zahod_mail") {
      // ⛔ Stav mailu z minulého pokusu se ZAHODÍ a jde se plnou cestou. Přístup
      //    pořád běží, takže žádné rozloučení k TOMUHLE konci ještě neodešlo.
      const zahozeno = zabrano.mailStav ?? "neposlano";
      const ok = await deps.nastavRazitko(email, mail("neposlano", { duvod: "rozdelana_prace_zahozena:" + zahozeno }));
      if (!ok) {
        await deps.alert(
          "🔴 Konec koučinku: starý stav mailu se nepodařilo zahodit",
          "Klient: " + email + "\nStarý stav mailu: " + zahozeno +
            "\n\nNárok pořád běží, takže jsem NIC nezavřel a nic neposlal. Zkusím to příště.",
          email,
        );
        return { email, vysledek: "opakovat", duvod: "zahozeni_neulozeno" };
      }
      await deps.alert(
        "⚠️ Konec koučinku: rozdělaná práce zahozena",
        "Klient: " + email + "\nStarý stav mailu: " + zahozeno +
          "\n\nPřístup mu pořád běží, a přitom v evidenci visel stav rozloučení z dřívějška.\n" +
          "Ten patří k jinému konci, takže jsem ho zahodil a jdu plnou cestou:\n" +
          "zavřu přístup a pošlu rozloučení.",
        email,
      );
    }
    if (rozhodnuti === "dokonci_mail") {
      // ⛔⛔ Přístup je zavřený, rozloučení CHYBÍ (`neposlano` nebo `odmitnuto`).
      //    Pošle se POUZE mail; `ukonciPristup` by vrátil „už je ukončený" a mail
      //    by se přeskočil navždy (nález V1 z R1).
      jenMail = true;
    }
    if (rozhodnuti === "znovu_klient") {
      // ⛔ Rozdělaná práce se ZAHODÍ, ne dokončí. Ten člověk je zase klient.
      await deps.nastavRazitko(email, {
        stav: "hotovo",
        duvod: "znovu_klient:rozdelana_prace_zahozena",
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
  let chceSales = posleMail && sales.action === "send" && !maAcademy;

  // --- 2) PROMO KÓD ---------------------------------------------------------
  // ⛔⛔ PŘI DOPOSLÁNÍ SE PROMO NIKDY NESMÍ STÁT SLEPOU ULIČKOU (revize R4).
  //    Do R4 se i u `dokonci_mail` chodilo do Stripu, a jeho pád (nebo chybějící
  //    kupón) zapsal `opakovat`, čímž se ztratil příznak „jistě neodešlo".
  //    Další běh pak mail nikdy neposlal. Přístup je přitom už zavřený, takže
  //    blokovat rozloučení kvůli slevě je ta horší ze dvou špatností.
  //    ⇒ Když kód v řádku UŽ JE, Stripe se neptáme vůbec. Když není a nejde
  //      získat, mail odejde BEZ nabídky VIP, tedy jako u ručního odchodu
  //      bez kupónu, a jde alert.
  let promo = zabrano.promo;
  if (chceSales && promo && jenMail) {
    // Uložený kód z minula. Nic dalšího není potřeba.
  } else if (chceSales) {
    const bezVipBloku = async (duvod: string, predmet: string, telo: string): Promise<boolean> => {
      // Vrací `true`, když se má pokračovat bez nabídky VIP; `false`, když se má
      // celý postup odložit (nový člověk, u kterého se ještě nic nezavřelo).
      await deps.alert(predmet, telo, jenMail ? email : "bez_kuponu");
      if (jenMail) {
        chceSales = false;
        promo = "";
        return true;
      }
      await deps.nastavRazitko(email, {
        stav: "opakovat",
        duvod,
        // ⛔ Tenhle pokus se nepočítá (revize R2, nález V2): kupón je Martinova
        //    konfigurace, ne porucha klienta.
        pokusy: Math.max(0, (zabrano.pokusy ?? 1) - 1),
        updated_at: ted(),
      });
      return false;
    };

    if (!deps.maKupon) {
      const pokracovat = await bezVipBloku(
        "bez_kuponu",
        "⚠️ Konec koučinku: kupón na roční VIP není nastavený",
        "Klient ceka: " + email + "\n\n" +
          "`app_config.koucink_vip_coupon_id` je prázdné, takže promo kód nemá z čeho\n" +
          "vzniknout. U člověka, kterému se teprve zavírá přístup, automat počká.\n" +
          "U člověka, který přístup už nemá, rozloučení odejde BEZ nabídky VIP:\n" +
          "chybějící mail je horší než chybějící sleva.\n\n" +
          "Založ kupón ve Stripu (20 %, duration once, jen roční VIP) a jeho id vlož do\n" +
          "`app_config.koucink_vip_coupon_id`.",
      );
      if (!pokracovat) return { email, vysledek: "opakovat", duvod: "bez_kuponu" };
    } else {
      if (!promo) {
        // ⛔⛔ KÓD SE VYLOSUJE A ULOŽÍ DŘÍV, NEŽ SE O NĚM DOZVÍ STRIPE (nález V2).
        //    Opačné pořadí znamenalo, že pád sítě mezi voláním Stripu a zápisem
        //    řádku nechal ve Stripu kód, o kterém nevíme, a další pokus založil
        //    další. Takhle je opakování idempotentní.
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
      //    s týmž textem (revize R3, nález S6). Vylosuje se NOVÝ text a zkusí se
      //    to ještě JEDNOU; druhá kolize je při 31^6 kombinacích porucha.
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
        const pokracovat = await bezVipBloku(
          "promo:" + p.chyba,
          "🔴 Konec koučinku: promo kód se nepodařilo založit",
          "Klient: " + email + "\nChyba Stripu: " + p.chyba +
            "\n\nU člověka, kterému se teprve zavírá přístup, se NIC nezavřelo a mail\n" +
            "NEODESEL; automat to zkusí znovu. U člověka, který přístup už nemá,\n" +
            "rozloučení odejde BEZ nabídky VIP: chybějící mail je horší než sleva.\n\n" +
            "Co zkontrolovat:\n" +
            " 1. app_config.koucink_vip_coupon_id ukazuje na existující kupón ve Stripu,\n" +
            " 2. secret STRIPE_RESTRICTED_PROMO_KEY má právo ZÁPISU na Promotion codes.",
        );
        if (!pokracovat) return { email, vysledek: "opakovat", duvod: "promo:" + p.chyba };
      } else {
        promo = p.kod;
      }
    }
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
      // ⚠️ Bezpečné JEN proto, že sem `dokonci_mail` nedojde: tam se přístup
      //    zavírat nezkouší podruhé.
      await deps.nastavRazitko(email, { stav: "hotovo", duvod: "zavren_jinde:" + u.stav, updated_at: ted() });
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
      updated_at: ted(),
    });
    return { email, vysledek: "hotovo_bez_mailu", duvod: "mail_preskocen:" + confirm.reason };
  }
  if (sales.action === "skip") await deps.logSkip(sales.decision);

  // ⛔⛔ ODESLÁNÍ JDE PŘES `odesliSRazitkem`, TÉŽ FUNKCE JAKO RUČNÍ ODCHOD
  //    (revize R5, nález V2). Pořadí `posilam` → Resend → výsledek a čtení
  //    každého zápisu tak existuje jen jednou; cron ho měl a admin ne, a právě
  //    tím vznikal druhý mail.
  const o = await odesliSRazitkem({
    zapis: (pole) => deps.nastavRazitko(email, pole),
    posli: () => deps.posliMail(email, { maAcademy, promoKod: promo, includeSales: chceSales && sales.action === "send" }),
    tedIso: ted,
    spolecne: { ma_academy: maAcademy, promo_code: promo || null },
    duvod: "odeslano",
  });

  if (o.vysledek === "posilam_neulozeno") {
    await deps.alert(
      "🔴 Konec koučinku: nešlo zapsat, že začínám posílat",
      "Klient: " + email + "\n\nResend jsem proto NEVOLAL. Bez toho zápisu by se při selhání\n" +
        "dalšího kroku nedalo poznat, jestli mail odešel, a riskovali bychom druhý.\n" +
        "Automat to zkusí znovu při dalším běhu.",
      email,
    );
    return { email, vysledek: "opakovat", duvod: "posilam_neulozeno" };
  }

  // ⛔ Věta pro případ, že se nepovedl zápis VÝSLEDKU. Řádek zůstal v `posilam`
  //    a po ochranné lhůtě se přečte jako `nejiste`: druhý mail z toho nebude,
  //    ale mail, který Resend JISTĚ odmítl, se pak sám neopakuje.
  const neulozeno = o.vysledekUlozen ? "" :
    "\n⚠️ Zápis výsledku SELHAL: řádek zůstal v `posilam` a po půl hodině se přečte jako\n" +
    "nejistý. Druhý mail z toho nevznikne, ale automat ho ani sám nezopakuje.\n";

  if (o.vysledek === "odeslano") {
    if (!o.vysledekUlozen) {
      await deps.alert(
        "⚠️ Konec koučinku: mail ODEŠEL, ale razítko se neuložilo",
        "Klient: " + email + "\n\nRozloučení Resend přijal, zápis do `koucink_konec_sent` ne.\n" +
          "Řádek zůstal v `posilam` a automat ho po půl hodině uzavře jako `nejiste`,\n" +
          "takže druhý mail nehrozí. Chybí jen evidence.\n\n" +
          "Můžeš mu ručně nastavit `mail_stav='odeslano'`, `stav='hotovo'`.",
        email,
      );
    }
    return { email, vysledek: "hotovo", duvod: "odeslano" };
  }

  if (o.vysledek === "bez_id") {
    // ⛔ `odeslano` jen s `provider_id` (N6 z R5): bez něj to nejde doložit.
    await deps.alert(
      "⚠️ Konec koučinku: Resend přijal mail, ale nevrátil jeho id",
      "Klient: " + email + "\n\nZásilka nejspíš odešla, ale bez id ji nejde doložit ani spárovat\n" +
        "s bouncem. Automat ji proto vede jako NEJISTOU a neopakuje ji.\n" +
        "Zkontroluj ji v Resendu podle adresy a času." + neulozeno,
      email,
    );
    return { email, vysledek: "nejiste", duvod: "resend_200_bez_id" };
  }

  if (o.vysledek === "nejiste") {
    await deps.alert(
      "⚠️ Konec koučinku: NEVÍM, jestli rozlučkový mail odešel",
      "Klient: " + email + "\nStav Resendu: " + o.status + "\nChyba: " + (o.chyba ?? "") +
        "\n\nPřístup je zavřený. Mail MOHL odejít, proto ho automat NEZOPAKUJE.\n" +
        (o.vysledekUlozen
          ? "V evidenci je `mail_stav='nejiste'`.\n"
          : "⚠️ Zápis stavu navíc selhal, takže řádek zůstal v `posilam`; po půl hodině\nse přečte jako `nejiste`, což vyjde nastejno.\n") +
        "Zkontroluj Resend a rozhodni sám. Když má jít znovu, pošli rozloučení\n" +
        "z admina: u tohohle stavu tlačítko pošle POUZE mail a zeptá se na potvrzení.",
      email,
    );
    return { email, vysledek: "nejiste", duvod: "resend:" + o.status };
  }

  // ⛔⛔ JISTÉ NEODESLÁNÍ (Resend 4xx, chybějící klíč). Mail se smí poslat znovu,
  //    ale na nárok se už nesahá: přístup je zavřený z tohohle běhu.
  // ⛔ NÁVRAT ZÁPISU SE ČTE (revize R5, nález S3). Když se `odmitnuto` neuloží,
  //    alert NESMÍ slibovat opakování, které nepřijde.
  await deps.alert(
    "🔴 Konec koučinku: přístup zavřený, rozloučení NEODESLO",
    "Klient: " + email + "\nStav Resendu: " + o.status + "\nChyba: " + (o.chyba ?? "") +
      "\n\nPřístup do appky i klientské sekce je UŽ ZAVŘENÝ, ale mail jistě neodešel.\n" +
      (o.vysledekUlozen
        ? "Automat ho zkusí poslat znovu při dalším běhu a na nárok už nesáhne.\n" +
          "Když to spěchá, pošli rozloučení z admina (tlačítko Ukončit koučink u tohohle\n" +
          "klienta pošle POUZE mail)."
        : "⚠️ Zápis stavu navíc SELHAL: řádek zůstal v `posilam` a po půl hodině se přečte\n" +
          "jako nejistý. Automat ho proto SÁM NEZOPAKUJE. Pošli rozloučení z admina\n" +
          "(zeptá se tě na potvrzení), nebo nastav `mail_stav='odmitnuto'` ručně."),
    email,
  );
  return { email, vysledek: "odmitnuto", duvod: "resend:" + o.status };
}
