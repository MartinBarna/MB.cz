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

/**
 * Jak dlouho se čeká, než se rezervace bere jako opuštěná.
 * ⛔ Když edge funkci zabije timeout cronu, `catch` v kódu se neprovede a řádek
 *    zůstane v `rezervovano` navždy (nález V2). Třicet minut je pohodlně nad
 *    stropem jednoho běhu a pohodlně pod denní periodou cronu.
 */
export const ZASEKNUTO_PO_MS = 30 * 60 * 1000;

export type RazitkoRadek = {
  email: string;
  stav: string;
  promo_code: string | null;
  pokusy?: number | null;
  updated_at?: string | null;
  duvod?: string | null;
};

export type ZaberVysledek =
  | {
    stav: "ok";
    /** Ze kterého stavu se člověk převzal. Prázdno = nový řádek. */
    predchozi: "" | "opakovat" | "opakovat_mail" | "zaseknute";
    /** Kód už jednou založený ve Stripu. Nový se zakládat NESMÍ. */
    promo: string;
    pokusy: number;
  }
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
   * Vrací počet změněných řádků: 1 = vyhrál jsem závod, 0 = nevyhrál.
   */
  prevezmi: (email: string, zeStavu: string, pokusy: number) => Promise<{ pocet: number; chyba: string }>;
  /** Zapíše libovolná pole razítka. */
  nastavRazitko: (email: string, pole: Record<string, unknown>) => Promise<boolean>;
  maAcademy: (email: string) => Promise<boolean>;
  brana: (email: string, trida: "client_operational" | "marketing", path: string) => Promise<BranaRozhodnuti>;
  logSkip: (decision: unknown) => Promise<void>;
  /** Založí promo kód ve Stripu. Volá se JEN když razítko žádný nenese. */
  zalozPromo: (email: string) => Promise<PromoVysledekJadro>;
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
export function platiJeste(
  narok: { active: boolean | null; expiresAt: string | null },
  opts: { jenMail: boolean; tedMs: number; graceDny: number },
): "plati" | "nevim" | "znovu_klient" | "zavren_jinde" {
  if (narok.active === null) return "nevim";
  if (opts.jenMail) {
    // Chybí jen rozloučení. Když je nárok zase aktivní, je z něj znovu klient
    // a rozloučení by přišlo uprostřed spolupráce.
    return narok.active ? "znovu_klient" : "plati";
  }
  // Přístup se teprve má zavřít. Neaktivní nárok = zavřel ho někdo jiný.
  if (!narok.active) return "zavren_jinde";
  // Aktivní nárok bez konce nebo s koncem v budoucnu = nové období.
  if (!narok.expiresAt) return "znovu_klient";
  const konec = Date.parse(String(narok.expiresAt));
  if (!Number.isFinite(konec)) return "znovu_klient";
  const mez = opts.tedMs - Math.max(0, opts.graceDny) * 86400000;
  return konec <= mez ? "plati" : "znovu_klient";
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
  if (vloz.ok) return { stav: "ok", predchozi: "", promo: "", pokusy: 1 };
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

  const p = await deps.prevezmi(email, stav, pokusy + 1);
  if (p.chyba) return { stav: "chyba", detail: p.chyba };
  if (p.pocet !== 1) return { stav: "obsazeno", duvod: "zavod:" + stav };

  if (zaseknute) {
    await deps.alert(
      "⚠️ Konec koučinku: opuštěná rezervace, beru ji znovu",
      "Klient: " + email + "\nRazítko viselo v `rezervovano` déle než 30 minut.\n\n" +
        "Nejspíš předchozí běh zabil timeout cronu (120 s) nebo strop běhu.\n" +
        "Stav klienta může být rozpracovaný: zkontroluj `entitlements` a `tvujcoach_grants`.\n" +
        "Automat teď postup zkusí znovu od začátku.",
      email,
    );
  }
  return {
    stav: "ok",
    predchozi: zaseknute ? "zaseknute" : (stav as "opakovat" | "opakovat_mail"),
    promo: String(radek.promo_code ?? ""),
    pokusy: pokusy + 1,
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
  zabrano: { predchozi: "" | "opakovat" | "opakovat_mail" | "zaseknute"; promo: string },
  deps: BehDeps,
): Promise<VysledekJednoho> {
  const ted = () => new Date(deps.ted()).toISOString();
  const jenMail = zabrano.predchozi === "opakovat_mail";

  // --- 0) PLATÍ ROZDĚLANÁ PRÁCE JEŠTĚ? (jen u řádků z minula) ---------------
  if (zabrano.predchozi !== "") {
    const narok = await deps.stavNaroku(email);
    const platnost = platiJeste(narok, { jenMail, tedMs: deps.ted(), graceDny: deps.graceDny });
    if (platnost === "nevim") {
      await deps.nastavRazitko(email, { stav: "opakovat", duvod: "narok_neprecten", updated_at: ted() });
      return { email, vysledek: "opakovat", duvod: "narok_neprecten" };
    }
    if (platnost === "znovu_klient") {
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
    if (platnost === "zavren_jinde") {
      await deps.nastavRazitko(email, {
        stav: "hotovo",
        duvod: "zavren_jinde:rucne",
        sent_ok: false,
        updated_at: ted(),
      });
      return { email, vysledek: "preskoceno", duvod: "zavren_jinde" };
    }
  }

  const maAcademy = await deps.maAcademy(email);

  const confirm = await deps.brana(email, "client_operational", "koucink-konec.confirm");
  const sales = await deps.brana(email, "marketing", "koucink-konec.sales");
  const posleMail = confirm.action === "send";
  const chceSales = posleMail && sales.action === "send" && !maAcademy;

  // --- 2) PROMO KÓD ---------------------------------------------------------
  let promo = zabrano.promo;
  if (chceSales && !promo) {
    // ⛔ BEZ KUPÓNU SE NIC NEZAVÍRÁ (nález S5). Dřív se to dostalo až do Stripu,
    //    ten vrátil `chybi_coupon_id`, razítko šlo na `opakovat` a s každým dnem
    //    ubyl jeden pokus ze stropu. Ptát se Stripu na něco, co víme dopředu,
    //    nemá smysl.
    if (!deps.maKupon) {
      await deps.nastavRazitko(email, { stav: "opakovat", duvod: "bez_kuponu", updated_at: ted() });
      return { email, vysledek: "opakovat", duvod: "bez_kuponu" };
    }
    const p = await deps.zalozPromo(email);
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
    // ⛔ Kód se ukládá HNED a příští pokus ho POUŽIJE, nezakládá nový.
    await deps.nastavRazitko(email, { promo_code: promo, updated_at: ted() });
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
    await deps.nastavRazitko(email, {
      stav: "hotovo",
      duvod: "odeslano",
      ma_academy: maAcademy,
      sent_at: ted(),
      sent_ok: true,
      updated_at: ted(),
    });
    return { email, vysledek: "hotovo", duvod: "odeslano" };
  }

  // ⛔⛔ ROZHODUJE, JESTLI TĚLO MAILU MOHLO DOJÍT NA RESEND.
  const teloMohloDojit = r.status >= 500 || String(r.chyba ?? "").startsWith("sit:");
  if (teloMohloDojit) {
    await deps.nastavRazitko(email, {
      stav: "chyba_nejiste",
      duvod: "resend:" + (r.chyba ?? r.status),
      ma_academy: maAcademy,
      sent_at: ted(),
      sent_ok: false,
      updated_at: ted(),
    });
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
