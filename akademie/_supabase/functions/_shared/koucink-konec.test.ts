// Spuštění: npx --yes deno@2 run akademie/_supabase/functions/_shared/koucink-konec.test.ts
// (lokálně bez sítě: "C:/Users/fitne/.supabase/deno.exe" run …)
//
// Čisté funkce automatu „konec koučinku". Databáze ani Stripe se tu nevolají:
// `ukonciPristup` a `vytvorPromoKod` mají vedlejší účinky a testují se během
// nanečisto proti živé funkci (viz BUILD, sekce smoke).
import {
  konecDoPole,
  MAX_DNU_KONEC_DOPREDU,
  MAX_DNU_KONEC_DOZADU,
  overKonecKoucinku,
  PROMO_ABECEDA,
  PROMO_PLATNOST_DNI,
  promoForm,
  promoPlatnostDo,
  vyberKeUkonceni,
  vygenerujPromoKod,
  jeNejisteOdeslani,
  type MailStav,
  odesliSRazitkem,
  rozhodniRucniOdchod,
  zajistiPromoKod,
  CHYBA_KOD_NEAKTIVNI,
} from "./koucink-konec.ts";

let selhalo = 0;
function check(nazev: string, podminka: boolean, detail = ""): void {
  if (podminka) console.log("  ok   " + nazev);
  else { selhalo++; console.log("  FAIL " + nazev + (detail ? "  [" + detail + "]" : "")); }
}

const DEN = 86400000;
const TED = Date.parse("2026-09-22T10:00:00Z");

// -----------------------------------------------------------------------------
console.log("\n== overKonecKoucinku ==");
check("prázdno je legitimní odpověď, ne chyba",
  JSON.stringify(overKonecKoucinku("", TED)) === JSON.stringify({ ok: true, konec: null }));
check("platné datum se uloží jako KONEC DNE",
  JSON.stringify(overKonecKoucinku("2026-10-15", TED)) ===
    JSON.stringify({ ok: true, konec: "2026-10-15T23:59:59.000Z" }));
// ⛔ KONTRAST: půlnoc na začátku dne by klienta prohlásila za skončeného celý den,
//    který má ještě zaplacený.
check("není to půlnoc na začátku dne",
  !String((overKonecKoucinku("2026-10-15", TED) as { konec: string }).konec).includes("T00:00:00"));
check("31. února neprojde",
  overKonecKoucinku("2026-02-31", TED).ok === false);
check("špatný tvar neprojde",
  overKonecKoucinku("15. 10. 2026", TED).ok === false);
check("rok 2029 je moc daleko",
  overKonecKoucinku("2029-01-01", TED).ok === false);
check("těsně pod stropem dopředu projde",
  overKonecKoucinku(new Date(TED + (MAX_DNU_KONEC_DOPREDU - 2) * DEN).toISOString().slice(0, 10), TED).ok === true);
check("příliš staré neprojde",
  overKonecKoucinku(new Date(TED - (MAX_DNU_KONEC_DOZADU + 5) * DEN).toISOString().slice(0, 10), TED).ok === false);
check("konecDoPole vrátí den z uloženého okamžiku",
  konecDoPole("2026-10-15T23:59:59.000Z") === "2026-10-15");
check("konecDoPole z prázdna vrátí prázdno", konecDoPole(null) === "" && konecDoPole("") === "");

// -----------------------------------------------------------------------------
console.log("\n== vyberKeUkonceni (výběr má KONTRAST, ne jen happy path) ==");
const GRACE = 7;
const radky = [
  { email: "PoKonci@x.cz", active: true, expires_at: new Date(TED - 10 * DEN).toISOString() },
  { email: "vcera@x.cz", active: true, expires_at: new Date(TED - 1 * DEN).toISOString() },
  { email: "bezdata@x.cz", active: true, expires_at: null },
  { email: "neaktivni@x.cz", active: false, expires_at: new Date(TED - 30 * DEN).toISOString() },
  { email: "budoucnost@x.cz", active: true, expires_at: new Date(TED + 30 * DEN).toISOString() },
  { email: "optout@x.cz", active: true, expires_at: new Date(TED - 30 * DEN).toISOString() },
  { email: "uzposlano@x.cz", active: true, expires_at: new Date(TED - 30 * DEN).toISOString() },
  { email: "rozbitedatum@x.cz", active: true, expires_at: "vcera vecer" },
];
const v = vyberKeUkonceni(radky, {
  tedMs: TED, graceDny: GRACE,
  optout: ["OptOut@x.cz"],
  jizOrazitkovane: ["uzposlano@x.cz"],
});
const vybrane = v.kUkonceni.map((r) => r.email);
check("3 dny po konci s grací 7 NEVYBRAT", !vybrane.includes("vcera@x.cz"));
check("10 dní po konci s grací 7 VYBRAT", vybrane.includes("pokonci@x.cz"));
check("e-mail se normalizuje na malá písmena", vybrane.includes("pokonci@x.cz") && !vybrane.includes("PoKonci@x.cz"));
check("neaktivní nárok NEVYBRAT", !vybrane.includes("neaktivni@x.cz"));
check("konec v budoucnu NEVYBRAT", !vybrane.includes("budoucnost@x.cz"));
check("optout NEVYBRAT (a porovnává se bez ohledu na velikost písmen)", !vybrane.includes("optout@x.cz"));
check("už orazítkovaný NEVYBRAT", !vybrane.includes("uzposlano@x.cz"));
// ⛔⛔ TOHLE JE TA PODSTATNÁ: nárok bez data konce se nezavírá NIKDY.
//    Změřeno 22. 9. 2026: takových je dnes 20 z 20.
check("nárok BEZ data konce NEVYBRAT", !vybrane.includes("bezdata@x.cz"));
check("nečitelné datum se bere jako BEZ data", !vybrane.includes("rozbitedatum@x.cz"));
check("vybrán přesně jeden", v.kUkonceni.length === 1, JSON.stringify(vybrane));
check("počítadla hlásí, proč se nikdo další nevybral",
  v.bezData === 2 && v.vGraci === 1 && v.predKoncem === 1 && v.vOptout === 1,
  `bezData=${v.bezData} vGraci=${v.vGraci} predKoncem=${v.predKoncem} vOptout=${v.vOptout}`);
// ⛔⛔ DVĚ RŮZNÉ SITUACE, DVĚ RŮZNÁ ČÍSLA (revize R1, nález N12). Do revize padal
//    do `vGraci` i člověk, kterému koučink v klidu běží, takže běh nanečisto hlásil
//    „v ochranné lhůtě" o někom, kdo v ní vůbec není. Číslo, které měří něco jiného,
//    než tvrdí jeho popisek, je horší než žádné.
check("`vGraci` je JEN po konci, ne před ním", v.vGraci === 1);
check("`predKoncem` je běžící období", v.predKoncem === 1);
{
  // Kontrast: bez jediného běžícího období musí `predKoncem` být nula.
  const jenPoKonci = vyberKeUkonceni(
    [{ email: "a@x.cz", active: true, expires_at: new Date(TED - 2 * DEN).toISOString() }],
    { tedMs: TED, graceDny: 7 },
  );
  check("samé skončené: predKoncem = 0", jenPoKonci.predKoncem === 0 && jenPoKonci.vGraci === 1,
    `vGraci=${jenPoKonci.vGraci} predKoncem=${jenPoKonci.predKoncem}`);
  const jenBezici = vyberKeUkonceni(
    [{ email: "a@x.cz", active: true, expires_at: new Date(TED + 40 * DEN).toISOString() }],
    { tedMs: TED, graceDny: 7 },
  );
  check("samé běžící: vGraci = 0", jenBezici.vGraci === 0 && jenBezici.predKoncem === 1,
    `vGraci=${jenBezici.vGraci} predKoncem=${jenBezici.predKoncem}`);
}

// Grace jako páka: s grací 0 spadne dovnitř i včerejší konec.
const v0 = vyberKeUkonceni(radky, { tedMs: TED, graceDny: 0 });
check("grace 0 vezme i včerejší konec", v0.kUkonceni.map((r) => r.email).includes("vcera@x.cz"));
const v99 = vyberKeUkonceni(radky, { tedMs: TED, graceDny: 99 });
check("grace 99 nevezme nikoho", v99.kUkonceni.length === 0);
check("záporná grace se chová jako nula",
  vyberKeUkonceni(radky, { tedMs: TED, graceDny: -5 }).kUkonceni.length === v0.kUkonceni.length);
check("prázdný seznam nevyhodí výjimku", vyberKeUkonceni([], { tedMs: TED, graceDny: 7 }).kUkonceni.length === 0);

// -----------------------------------------------------------------------------
console.log("\n== promo kód ==");
const kod = vygenerujPromoKod((n) => new Uint8Array(new Array(n).fill(0)));
check("tvar VIP- + 6 znaků", /^VIP-[A-Z0-9]{6}$/.test(kod), kod);
check("deterministický generátor je deterministický",
  vygenerujPromoKod((n) => new Uint8Array(new Array(n).fill(0))) === kod);
check("abeceda nemá znaky, co se pletou",
  !PROMO_ABECEDA.includes("0") && !PROMO_ABECEDA.includes("O") &&
  !PROMO_ABECEDA.includes("1") && !PROMO_ABECEDA.includes("I") && !PROMO_ABECEDA.includes("L"));
check("modulo nikdy nespadne mimo abecedu",
  vygenerujPromoKod((n) => new Uint8Array(new Array(n).fill(255))).length === 4 + 6);
const platnost = promoPlatnostDo(TED);
check("platnost je 14 dní a v sekundách",
  platnost === Math.floor((TED + PROMO_PLATNOST_DNI * DEN) / 1000) && String(platnost).length === 10);

const form = promoForm({ couponId: "coupon_X", kod: "VIP-ABCDEF", expiresAt: platnost, email: "a@b.cz" });
check("form: kupón a kód",
  form["promotion[coupon]"] === "coupon_X" && form["promotion[type]"] === "coupon" && form.code === "VIP-ABCDEF");
// ⛔⛔ TVAR PRO STRIPE (24. 9. 2026). Stripe API 2025-09-30.clover odstranil
//    top-level `coupon` z PromotionCode#create; účet jede novější verzí, takže
//    `coupon=` vracel 400 `parameter_unknown` a promo kód nevznikl. Test hlídá
//    PŘESNOU sadu klíčů: nový klíč navíc (nebo návrat `coupon`) musí projít revizí.
check("form: tvar pro Stripe (přesná sada klíčů, žádné top-level `coupon`)",
  JSON.stringify(Object.keys(form).sort()) === JSON.stringify([
    "code", "expires_at", "max_redemptions", "metadata[duvod]", "metadata[email]",
    "promotion[coupon]", "promotion[type]",
  ]) && !("coupon" in form),
  JSON.stringify(Object.keys(form).sort()));
// ⛔ KONTRAST: bez `max_redemptions` by přeposlaný kód platil komukoli.
check("form: jen jedno uplatnění", form.max_redemptions === "1");
check("form: platnost se posílá", form.expires_at === String(platnost));
check("form: stopa proč kód vznikl", form["metadata[duvod]"] === "koucink-konec");
// ⛔ `customer` by odkazoval na zákazníka v PROJEKTU APPKY, Academy jeho id nezná.
check("form: žádné `customer`", !("customer" in form));
// ⛔ Procento slevy je v kupónu, ne tady. Dvě místa s jedním číslem se rozejdou.
check("form: žádné procento slevy",
  !Object.values(form).some((x) => String(x).includes("20")) || form.expires_at.includes("20"));


// -----------------------------------------------------------------------------
console.log("\n== rozhodniRucniOdchod: tabulka nárok × stav práce × stav mailu (revize R5) ==");
{
  // ⛔⛔ KAŽDÝ ŘÁDEK TABULKY JE TADY, bez výjimek. Do R5 se u tlačítka rozhodovalo
  //    jen podle stavu mailu, a u klienta s běžícím přístupem tlačítko poslalo
  //    „jen mail" a přístup nechalo otevřený.
  type Radek = [string, boolean, boolean, string, MailStav, boolean, boolean, boolean, string];
  // popis, narokExistuje, narokAktivni, stav, mailStav, rezervaceCerstva, tiche, potvrzeno, očekávaná akce
  const T: Radek[] = [
    ["není nárok", false, false, "", "neposlano", false, false, false, "neni_klient"],
    ["čerstvá rezervace", true, true, "rezervovano", "neposlano", true, false, false, "automat_pracuje"],
    ["čerstvá rezervace, nárok vypnutý", true, false, "rezervovano", "posilam", true, false, true, "automat_pracuje"],

    // --- NÁROK BĚŽÍ: vždycky plná cesta, bez ohledu na stav mailu ---
    ["běží, bez razítka", true, true, "", "neposlano", false, false, false, "plny_pruchod"],
    ["běží, neposlano", true, true, "opakovat", "neposlano", false, false, false, "plny_pruchod"],
    ["běží, odmitnuto (z jiného konce)", true, true, "opakovat", "odmitnuto", false, false, false, "plny_pruchod+zahod"],
    ["běží, posilam (z jiného konce)", true, true, "rezervovano", "posilam", false, false, false, "plny_pruchod+zahod"],
    ["běží, nejiste (z jiného konce)", true, true, "hotovo", "nejiste", false, false, false, "plny_pruchod+zahod"],
    ["běží, odeslano (z jiného konce)", true, true, "hotovo", "odeslano", false, false, false, "plny_pruchod+zahod"],
    ["běží, nejiste, tiše", true, true, "hotovo", "nejiste", false, true, false, "plny_pruchod+zahod"],

    // --- NÁROK ZAVŘENÝ: rozhoduje stav mailu ---
    ["zavřeno, odeslano", true, false, "hotovo", "odeslano", false, false, false, "uz_ukoncen"],
    // ⚠️ `odeslano` u rozdělané práce: cron po pádu píše `opakovat` a stav mailu
    //    nechává. I tady rozhoduje mail, ne stav práce (mutace M69 v R5).
    ["zavřeno, odeslano, práce opakovat", true, false, "opakovat", "odeslano", false, false, false, "uz_ukoncen"],
    ["zavřeno, odeslano, opuštěná rezervace", true, false, "rezervovano", "odeslano", false, false, false, "uz_ukoncen"],
    ["zavřeno, bez razítka", true, false, "", "neposlano", false, false, false, "uz_ukoncen"],
    ["zavřeno, hotovo + neposlano (vědomě)", true, false, "hotovo", "neposlano", false, false, false, "uz_ukoncen"],
    ["zavřeno, vzdano + neposlano", true, false, "vzdano", "neposlano", false, false, false, "uz_ukoncen"],
    ["zavřeno, opakovat + neposlano (mail chybí)", true, false, "opakovat", "neposlano", false, false, false, "jen_mail"],
    ["zavřeno, opuštěná rezervace + neposlano", true, false, "rezervovano", "neposlano", false, false, false, "jen_mail"],
    ["zavřeno, odmitnuto", true, false, "opakovat", "odmitnuto", false, false, false, "jen_mail"],
    ["zavřeno, odmitnuto, tiše", true, false, "opakovat", "odmitnuto", false, true, false, "uz_ukoncen"],
    ["zavřeno, nejiste bez potvrzení", true, false, "hotovo", "nejiste", false, false, false, "potrebuje_potvrzeni"],
    ["zavřeno, nejiste s potvrzením", true, false, "hotovo", "nejiste", false, false, true, "jen_mail"],
    ["zavřeno, posilam bez potvrzení", true, false, "rezervovano", "posilam", false, false, false, "potrebuje_potvrzeni"],
    ["zavřeno, posilam s potvrzením", true, false, "rezervovano", "posilam", false, false, true, "jen_mail"],
    ["zavřeno, nejiste, tiše", true, false, "hotovo", "nejiste", false, true, false, "uz_ukoncen"],
  ];
  for (const [popis, ex, ak, stav, ms, cerstva, tiche, potvrzeno, cekam] of T) {
    const r = rozhodniRucniOdchod({
      narokExistuje: ex, narokAktivni: ak, stav, mailStav: ms, rezervaceCerstva: cerstva, tiche, potvrzeno,
    });
    const dostal = r.akce === "plny_pruchod" ? (r.zahodMail ? "plny_pruchod+zahod" : "plny_pruchod") : r.akce;
    check("ruční: " + popis + " = " + cekam, dostal === cekam, dostal);
  }
}

// -----------------------------------------------------------------------------
console.log("\n== odesliSRazitkem: jediné pořadí pro cron i admin (revize R5) ==");
{
  const TED_ISO = () => "2026-09-23T10:00:00.000Z";
  // Falešný zápis: zapisuje do pole a umí selhat od N-tého pokusu.
  const mk = (selzeOd = 0) => {
    const zapisy: Record<string, unknown>[] = [];
    let posli = 0;
    return {
      zapisy,
      pocetPoslani: () => posli,
      zapis: (pole: Record<string, unknown>) => {
        zapisy.push(pole);
        return Promise.resolve(!(selzeOd && zapisy.length >= selzeOd));
      },
      posliS: (r: { ok: boolean; status: number; chyba?: string; providerId?: string }) => () => {
        posli++;
        return Promise.resolve(r);
      },
    };
  };

  {
    // ⛔⛔ JÁDRO: když se nepovede zapsat `posilam`, Resend se NEVOLÁ.
    const m = mk(1);
    const o = await odesliSRazitkem({ zapis: m.zapis, posli: m.posliS({ ok: true, status: 200, providerId: "x" }), tedIso: TED_ISO, duvod: "t" });
    check("posilam neuložen: Resend se NEVOLÁ", m.pocetPoslani() === 0 && o.vysledek === "posilam_neulozeno");
  }
  {
    const m = mk();
    const o = await odesliSRazitkem({ zapis: m.zapis, posli: m.posliS({ ok: true, status: 200, providerId: "re_1" }), tedIso: TED_ISO, duvod: "t" });
    check("pořadí: nejdřív `posilam`, pak výsledek", m.zapisy[0].mail_stav === "posilam" && m.zapisy[1].mail_stav === "odeslano");
    check("úspěch s id: `odeslano` a `provider_id`", o.vysledek === "odeslano" && m.zapisy[1].provider_id === "re_1");
    check("úspěch: `sent_ok` je odvozenina", m.zapisy[1].sent_ok === true && m.zapisy[0].sent_ok === false);
    check("úspěch: práce `hotovo`", m.zapisy[1].stav === "hotovo");
    check("`posilam` maže id z minulého pokusu", m.zapisy[0].provider_id === null);
  }
  {
    // ⛔ N6 z R5: 200 bez id se nesmí zapsat jako doložené odeslání.
    const m = mk();
    const o = await odesliSRazitkem({ zapis: m.zapis, posli: m.posliS({ ok: true, status: 200, providerId: "" }), tedIso: TED_ISO, duvod: "t" });
    check("200 bez id = `bez_id`, zapsáno `nejiste`", o.vysledek === "bez_id" && m.zapisy[1].mail_stav === "nejiste");
  }
  {
    const m = mk();
    const o = await odesliSRazitkem({ zapis: m.zapis, posli: m.posliS({ ok: false, status: 503, chyba: "resend_503:" }), tedIso: TED_ISO, duvod: "t" });
    check("5xx = `nejiste`, práce `hotovo`", o.vysledek === "nejiste" && m.zapisy[1].mail_stav === "nejiste" && m.zapisy[1].stav === "hotovo");
  }
  {
    const m = mk();
    const o = await odesliSRazitkem({ zapis: m.zapis, posli: m.posliS({ ok: false, status: 0, chyba: "sit:timeout" }), tedIso: TED_ISO, duvod: "t" });
    check("pád sítě = `nejiste`", o.vysledek === "nejiste");
  }
  {
    const m = mk();
    const o = await odesliSRazitkem({ zapis: m.zapis, posli: m.posliS({ ok: false, status: 422, chyba: "resend_422:x" }), tedIso: TED_ISO, duvod: "t" });
    check("4xx = `odmitnuto`, práce `opakovat`", o.vysledek === "odmitnuto" && m.zapisy[1].mail_stav === "odmitnuto" && m.zapisy[1].stav === "opakovat");
  }
  {
    const m = mk();
    const o = await odesliSRazitkem({ zapis: m.zapis, posli: m.posliS({ ok: false, status: 0, chyba: "missing_RESEND_API_KEY" }), tedIso: TED_ISO, duvod: "t" });
    check("chybějící klíč = `odmitnuto` (jisté neodeslání)", o.vysledek === "odmitnuto");
  }
  {
    // ⛔⛔ NÁVRAT ZÁPISU VÝSLEDKU SE ČTE VŽDY (V2 z R5), i u 4xx.
    for (const r of [
      { ok: true, status: 200, providerId: "x" },
      { ok: false, status: 503, chyba: "resend_503:" },
      { ok: false, status: 422, chyba: "resend_422:" },
    ]) {
      const m = mk(2);
      const o = await odesliSRazitkem({ zapis: m.zapis, posli: m.posliS(r), tedIso: TED_ISO, duvod: "t" });
      check("výsledek neuložen je vidět (status " + r.status + ")", o.vysledekUlozen === false && m.pocetPoslani() === 1);
    }
  }
  {
    const m = mk();
    await odesliSRazitkem({
      zapis: m.zapis, posli: m.posliS({ ok: true, status: 200, providerId: "x" }), tedIso: TED_ISO, duvod: "t",
      spolecne: { ma_academy: true, promo_code: "VIP-X" },
    });
    check("společná pole jdou do obou zápisů",
      m.zapisy.every((z) => z.ma_academy === true && z.promo_code === "VIP-X"));
  }
  check("jeNejisteOdeslani: 5xx ano, sit ano, 4xx ne, klíč ne",
    jeNejisteOdeslani({ status: 500 }) && jeNejisteOdeslani({ status: 0, chyba: "sit:x" }) &&
      !jeNejisteOdeslani({ status: 422 }) && !jeNejisteOdeslani({ status: 0, chyba: "missing_RESEND_API_KEY" }));
}

// -----------------------------------------------------------------------------
console.log("\n== zajistiPromoKod: odpovědi Stripu nanečisto (revize R5, nález S4) ==");
{
  // Falešný fetch: vrací odpovědi v pořadí a zapisuje, na co se kód ptal.
  // Stripe se tu NEVOLÁ; síť nahrazuje fronta připravených odpovědí.
  const puvodniFetch = globalThis.fetch;
  const scenar = async (odpovedi: (Response | "pad")[]) => {
    const dotazy: string[] = [];
    const tela: string[] = [];
    globalThis.fetch = ((u: string | URL | Request, i?: RequestInit) => {
      dotazy.push((i?.method ?? "GET") + " " + String(u));
      tela.push(String(i?.body ?? ""));
      const o = odpovedi.shift();
      if (!o || o === "pad") return Promise.reject(new Error("sit"));
      return Promise.resolve(o);
    }) as typeof fetch;
    try {
      const r = await zajistiPromoKod("sk_test_x", { couponId: "cpn", email: "a@b.cz", kod: "VIP-ABC", tedMs: 0 });
      return { r, dotazy, tela };
    } finally {
      globalThis.fetch = puvodniFetch;
    }
  };
  const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status });
  const PRAZDNO = () => json({ data: [] });
  const EXISTUJE = () => json({ error: { message: "An active promotion code with `code: VIP-ABC` already exists." } }, 400);

  {
    // ⛔⛔ S4: prázdný druhý GET po `already exists` = text obsadil neaktivní kód.
    const { r, dotazy } = await scenar([PRAZDNO(), EXISTUJE(), PRAZDNO()]);
    check("already exists + prázdný druhý GET = `kod_neaktivni`",
      !r.ok && r.chyba === CHYBA_KOD_NEAKTIVNI, JSON.stringify(r));
    check("GET se ptá jen na aktivní kódy", dotazy[0].startsWith("GET ") && dotazy[0].includes("active=true"), dotazy[0]);
    check("po `already exists` přijde přesně jeden druhý GET", dotazy.length === 3, dotazy.join(" | "));
  }
  {
    // Druhý GET selhal: nevíme nic, nový text se NElosuje.
    const { r } = await scenar([PRAZDNO(), EXISTUJE(), json({}, 500)]);
    check("already exists + nepřečtený druhý GET = obecná chyba, ne `kod_neaktivni`",
      !r.ok && r.chyba === "stripe_kod_existuje_ale_neprecten", JSON.stringify(r));
  }
  {
    const { r } = await scenar([PRAZDNO(), EXISTUJE(), json({ data: [{ id: "promo_1", active: true }] })]);
    check("already exists + druhý GET najde aktivní = úspěch", r.ok && r.id === "promo_1", JSON.stringify(r));
  }
  {
    const { r, dotazy } = await scenar([json({ data: [{ id: "promo_2", active: true }] })]);
    check("existující aktivní kód: žádný POST", r.ok && r.id === "promo_2" && dotazy.length === 1, dotazy.join(" | "));
  }
  {
    const { r, dotazy, tela } = await scenar([PRAZDNO(), json({ id: "promo_3" })]);
    check("nový kód: POST a id", r.ok && r.id === "promo_3" && dotazy[1].startsWith("POST "), JSON.stringify(r));
    // ⛔⛔ Co SKUTEČNĚ odejde do Stripu (ne jen co vrací `promoForm`): kupón
    //    v `promotion[...]`, žádné top-level `coupon=` (24. 9. 2026, 400 parameter_unknown).
    const telo = new URLSearchParams(tela[1] ?? "");
    check("POST tělo: promotion[type]=coupon a promotion[coupon]=id kupónu, bez `coupon`",
      telo.get("promotion[type]") === "coupon" && telo.get("promotion[coupon]") === "cpn" &&
        !telo.has("coupon") && telo.get("code") === "VIP-ABC",
      tela[1] ?? "");
  }
  {
    const { r } = await scenar([PRAZDNO(), "pad"]);
    check("pád sítě u POST = chyba `sit:`", !r.ok && String(r.chyba).startsWith("sit:"), JSON.stringify(r));
  }
}

console.log(selhalo === 0 ? "\nVSE ZELENE\n" : `\n${selhalo} SELHANI\n`);
if (selhalo > 0) throw new Error(String(selhalo) + " selhani");
