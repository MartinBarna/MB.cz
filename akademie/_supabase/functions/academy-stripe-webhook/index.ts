// ============================================================
// Barna Academy — Stripe webhook pro OBĚ varianty členství.
//
// ⚠️ 29. 7. 2026 se sem přidala DOŽIVOTNÍ varianta 8 900 Kč. Do té doby tady stálo
// „doživotní jde dál přes SimpleShop", a to už NEPLATÍ. SimpleShop dál obsluhuje
// jen videokurz a doběh starých objednávek; produkt `Xgl8g` se schválně nemaže.
//   • měsíční 990 Kč  = `mode=subscription`, expirace období + 5 dní, BEZ appky
//   • doživotní 8 900 = `mode=payment`, expirace NULL, S appkou Tvůj Coach na rok
// Ta dvě čísla se nesmí splést, viz whitelisty odkazů níž.
//
// ⛔ NEVOLÁ `academy-grant` appky Tvůj Coach. Měsíční členství appku V CENĚ NEMÁ
//    (rozhodnutí 2 mise `mb-academy-pricing-mise`). Roční VIP appky zůstává
//    exkluzivní výhodou doživotní varianty, je to hlavní důvod k upgradu.
//    Kdo sem TC grant přidá, zabije ten důvod a rozdá appku zadarmo.
//
// ⛔ NEENROLLUJE do `onboarding-nakup-academy`. Ta trať je psaná pro doživotní
//    nákup a její step 0 slibuje appku Tvůj Coach jako dárek včetně přihlašovacího
//    tlačítka. Měsíčnímu členovi by tedy hned po zaplacení přišel slib, který
//    neplatí, a tlačítko, které ho nikam nepustí. Proto vlastní trať.
//
// Deploy: --no-verify-jwt (autentizace je Stripe podpisem, ne JWT).
// Env: STRIPE_WEBHOOK_SECRET (whsec_...), SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// ============================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const STRIPE_WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "";
// ⭐ TESTOVACI REZIM (7. 8. 2026). Stripe sandbox podepisuje JINYM tajemstvim nez ostry
// ucet. Bez tohohle by kazda testovaci platba skoncila na `bad-signature`, a cely nakupni
// retez by se dal vyzkouset jedine naostro, Martinovymi penezi. Presne to se 6. a 7. 8.
// stalo trikrat za den a vady nasel az on. Test mod NENI komfort, je to podminka toho,
// aby se sem vubec smelo sahat.
// ⛔ NENI TO PREPINAC. Obe tajemstvi plati SOUCASNE. Kdyby se prepinalo, znamenalo by to,
//    ze po dobu testovani neposloucham ostre platby platicich zakazniku.
// ⚠️ Prazdna promenna = test mod nenastaven a funkce se chova presne jako driv.
const STRIPE_WEBHOOK_SECRET_TEST = Deno.env.get("STRIPE_WEBHOOK_SECRET_TEST") ?? "";
const RESEND_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const ALERT_FALLBACK = "fitness.barna@gmail.com";

// ⚠️ RESTRICTED klíč, NE plný secret. Práva jen Subscriptions:Write (+Read, co si
// k tomu Stripe vyžádá). Schválně se nejmenuje STRIPE_SECRET_KEY jako v appce, aby
// si nikdo nemyslel, že tu leží plný klíč a že si přes něj může sáhnout na platby.
// Slouží k JEDINÉ věci: zrušit předplatné při refundu. Bez něj by se za měsíc
// strhlo znovu, i když jsme přístup odebrali.
const STRIPE_SUBS_KEY = Deno.env.get("STRIPE_RESTRICTED_SUBS_KEY") ?? "";

// Tratě rozlučkového mailu. ⛔ JSOU DVĚ a musí se vybrat podle situace.
// Engine neumí podmínky, takže větev „přístup končí ihned" a „přístup ještě doběhne"
// nejdou udělat v jedné šabloně. Tady se jen vybírá, která se použije.
// ⚠️ 28. 7. 2026 tu byl název `rozlouceni-refund`, který NEEXISTUJE. Rozdělil jsem
// tratě na dvě a konstantu zapomněl přepsat ⇒ při prvním ostrém refundu mail
// NEODEŠEL a chytila to až pojistka „chybí šablona". Proto tu ta poznámka je.
const ROZLOUCENI_HNED = "rozlouceni-refund-hned";
const ROZLOUCENI_DOJEZD = "rozlouceni-refund-dojezd";

/** Vybere trať podle toho, jestli přístup končí teď, nebo ještě doběhne. */
function rozlouceniTrack(expiraceIso: string | null): string {
  if (!expiraceIso) return ROZLOUCENI_HNED;
  return new Date(expiraceIso).getTime() > Date.now() + 60_000
    ? ROZLOUCENI_DOJEZD
    : ROZLOUCENI_HNED;
}

// ⛔⛔ ROZLUČKOVÁ ŠABLONA MÁ VLASTNÍ PROMĚNNÉ A VOLAJÍCÍ JE MUSÍ POSLAT.
// Používá {{castka}}, {{produkt}}, {{varianta}}, {{znovu_odkaz}}, větev s dojezdem
// navíc {{pristup_do}}. NEJSOU to vestavěné proměnné `drip-send`, posílají se v `vars`.
// Když chybí jediná, render spadne na `unresolved_token` a mail NIKDY NEODEJDE.
// ⚠️ Stalo se 28. 7. 2026 při ostrém refundu: trať se vybrala správně, přístup se
// odebral správně, ale mail skončil jako 'error' v `email_events` a Martinovi nic
// nepřišlo. Příčina: tahle cesta recykluje `posliUvitani`, napsaný pro uvítačku,
// která žádné vlastní proměnné nemá. Sesterský `simpleshop-webhook` je posílá
// od začátku ⇒ zase vzorec „nová cesta, staré pravidlo".
function castkaText(halere: number, mena: string): string {
  const c = Math.round(halere) / 100;
  const cislo = Number.isInteger(c) ? String(c) : c.toFixed(2).replace(".", ",");
  return (mena || "czk").toLowerCase() === "czk"
    ? cislo + " Kč"
    : cislo + " " + (mena || "").toUpperCase();
}

/** Datum pro člověka, v pražském čase (edge běží v UTC, u večerních akcí by to jinak ujelo o den). */
function datumCesky(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("cs-CZ", { timeZone: "Europe/Prague" });
  } catch {
    return iso.slice(0, 10);
  }
}

// Stripe (live, účet Tvůj Coach acct_1TqQ56Bq3rKubW9k), založeno 28. 7. 2026:
//   produkt      prod_Uy7nu91R8yjVwI  „Barna Academy členství"
//   price        price_1TyBXTBq3rKubW9kGizHd41g  = 990 CZK/měs, DPH v ceně
//   Payment Link https://buy.stripe.com/bJe9AS3UXgjMcjC8hF3ks00?locale=cs
//   redirect po platbě -> https://martinbarna.cz/akademie/vitejte/

// ⛔⛔ WHITELIST: KTERÉ PLATBY VŮBEC ZAKLÁDAJÍ ACADEMY (přidáno 28. 7. 2026)
// Stripe účet je SPOLEČNÝ pro Academy i pro appku Tvůj Coach (acct_1TqQ56Bq3rKubW9k)
// a webhook endpoint dostává události CELÉHO účtu, ne jen našeho produktu.
// Bez téhle kontroly by každý, kdo si v appce koupí VIP za 499 Kč, dostal zdarma
// i Academy za 8 900 Kč, a nikdo by se to nedozvěděl (nic by nespadlo, alert nesepne).
// Ceny appky pro představu, TY SEM NEPATŘÍ: price_1TtvIk… 499, price_1TtvN6… 249.
// Vzorec „nová cesta, staré pravidlo": appkový stripe-webhook se proti cizím platbám
// brání tím, že vyžaduje user_id v metadatech. Tenhle guard je jeho protějšek.
// ═══ JEDNORÁZOVÉ PRODUKTY (mode=payment) ══════════════════════════════════════
// Katalog: co se za daný klíč dodá. Přidání dalšího produktu (videokurz, konzultace)
// = JEDEN řádek sem a JEDEN do mapy odkazů níž. Do vlastní logiky se nesahá.
//
// ⛔⛔ KLÍČUJE SE PLATEBNÍM ODKAZEM, NE CENOU, a má to dva důvody:
// 1. Událost `checkout.session.completed` u `mode=payment` **cenu vůbec nenese**;
//    položky faktury by se musely dotahovat dalším voláním Stripu.
// 2. Slevový kód mění `amount_total`, takže kontrola na částku by u UPGRADE800 selhala
//    a člověk, který řádně zaplatil 8 100, by přístup nedostal.
//
// ⛔ A NESMÍ SE SLÉVAT S MĚSÍČNÍM SEZNAMEM. Podle toho, kudy člověk zaplatil, se liší
// úplně všechno: expirace (NULL versus 36 dní), zdroj, uvítací trať, appka Tvůj Coach
// i to, jestli se počítá do padesátky zakládajících. Jeden společný seznam by ty dvě
// věci tiše prohodil a poznalo by se to až u zákazníka, kterému po 8 900 vyprší přístup.
type JednorazovyProdukt = {
  produkt: string;    // entitlements.product
  source: string;     // entitlements.source  (⚠️ počítá se do padesátky, viz daily-digest)
  welcome: string;    // trať uvítacího e-mailu
  tcGrant: boolean;   // dostane appku Tvůj Coach na rok?
  nazev: string;      // jak se produkt jmenuje v rozlučkovém mailu
  varianta: string;   // upřesnění varianty v rozlučkovém mailu
  // ⭐ Dostane kupující NAVÍC videokurz jako bonus? (konzultace za 2 990 ho má v ceně,
  // varianta za 2 190 ne, protože ten člověk už videokurz má a proto je levnější.)
  videokurzBonus?: boolean;
  // Má po nákupu přijít Martinovi upozornění, že se má něco udělat ručně?
  // U konzultace ano: musí se ozvat a domluvit termín, jinak zákazník čeká.
  alertPoNakupu?: string;
};

// ⛔⛔ ZDROJ BONUSOVÉHO VIDEOKURZU. Nesmí se slévat s `stripe-videokurz` (samostatný nákup
// za 800) ani s `simpleshop`. Podle tohohle jediného řetězce refund konzultace pozná,
// který videokurz smí odebrat: bonusový ano, zaplacený zvlášť NIKDY. Kdyby zdroje byly
// stejné, nešlo by to rozhodnout a refund konzultace by lidem bral kurz, který si koupili.
const ZDROJ_BONUS_VIDEOKURZ = "konzultace-bonus";

const KATALOG: Record<string, JednorazovyProdukt> = {
  // Academy doživotně 8 900 Kč. Od 29. 7. 2026 nahrazuje SimpleShop.
  // Produkt `prod_UyNGi6oRQPZLOe` „Barna Academy doživotní přístup",
  // cena `price_1TyQVoBq3rKubW9kMVS3SfzC` (jednorázová, DPH v ceně).
  // ⚠️ Vlastní produkt vznikl schválně: první pokus visel na produktu měsíčního členství
  // (`prod_Uy7nu91R8yjVwI`) a checkout kupujícímu ukazoval popis „Měsíční členství…
  // zrušitelné kdykoli". Martin sám při testu myslel, že platí měsíční. U prodeje
  // za 8 900 Kč by to zákazníka zmátlo nebo odradilo, a nikde by to nekřiklo.
  "academy-lifetime": {
    produkt: "academy",
    source: "stripe-lifetime",
    welcome: "onboarding-nakup-academy",
    tcGrant: true,
    nazev: "Barna Academy",
    varianta: "doživotní přístup",
  },
  // Videokurz výživy 800 Kč, doživotní přístup. Od 30. 7. 2026 vedle SimpleShopu.
  // Produkt `prod_UyXOi2f4LCMtOJ`, cena `price_1TyaJvBq3rKubW9ka31byHsB` (jednorázová, DPH v ceně).
  // ⛔ `tcGrant: false` SCHVÁLNĚ: videokurz appku Tvůj Coach nemá a mít nemá. Kupci
  //    videokurzu se appka jen nabízí ke koupi, nedostávají ji v ceně. Kdo to přepne
  //    na true, rozdá roční VIP za 4 990 lidem, kteří zaplatili 800.
  // ⚠️ `source: "stripe-videokurz"` musí zůstat odlišný od Academy zdrojů, jinak by se
  //    kupci videokurzu začali počítat do padesátky zakládajících členů (viz daily-digest).
  "videokurz": {
    produkt: "videokurz",
    source: "stripe-videokurz",
    welcome: "onboarding-nakup-videokurz",
    tcGrant: false,
    nazev: "Videokurz výživy",
    varianta: "videokurz",
  },
  // Konzultace 2 990 Kč. Produkt `prod_Uyn8JGHPgrQNAc`, cena `price_1TypXx…`.
  // ⭐ VIDEOKURZ MÁ V CENĚ, proto `videokurzBonus: true`.
  // ⚠️ `tcGrant: false`: appka Tvůj Coach v konzultaci není.
  "konzultace": {
    produkt: "konzultace",
    source: "stripe-konzultace",
    welcome: "onboarding-nakup-konzultace",
    tcGrant: false,
    nazev: "Konzultace s Martinem Barnou",
    varianta: "konzultace",
    videokurzBonus: true,
    alertPoNakupu: "🗓️ Stripe: ZAPLACENÁ KONZULTACE, ozvi se a domluv termín",
  },
  // Konzultace 2 190 Kč pro majitele videokurzu, cena `price_1TypdQ…`.
  // ⛔ `videokurzBonus` SCHVÁLNĚ CHYBÍ (tedy false): tenhle člověk videokurz už má
  // a právě proto zaplatil o 800 Kč míň. Kdyby ho dostal znovu jako bonus, refund
  // konzultace by mu pak vzal i ten, který si koupil sám.
  "konzultace-vk": {
    produkt: "konzultace",
    source: "stripe-konzultace",
    welcome: "onboarding-nakup-konzultace",
    tcGrant: false,
    nazev: "Konzultace s Martinem Barnou",
    varianta: "konzultace",
    alertPoNakupu: "🗓️ Stripe: ZAPLACENÁ KONZULTACE (majitel videokurzu), ozvi se a domluv termín",
  },
  // ⭐ BALÍČEK „40 receptů a 48 odpovědí" za 349 Kč (6. 8. 2026). Nejlevnější vstup
  // do systému: kuchařka s makry + e-book na nejčastější dotazy klientů, obojí PDF.
  // Produkt `40 receptů a 48 odpovědí`, odkaz `plink_1U1VnFBq3rKubW9kXK79LF0i`.
  // ⛔ `tcGrant: false` SCHVÁLNĚ. Kdo to přepne na true, rozdá roční VIP appky
  //    za 4 990 Kč lidem, kteří zaplatili 349.
  // ⚠️ `source: "stripe-balicek"` musí zůstat odlišný od Academy zdrojů, jinak by se
  //    kupci balíčku začali počítat do padesátky zakládajících členů (viz daily-digest).
  // ⚠️ `produkt: "balicek"` funguje jen díky tomu, že se 6. 8. rozšířil CHECK
  //    `entitlements_product_check`. Bez toho by zaplacený nákup spadl na 500 a NEPŘIŠEL
  //    BY ANI ALERT, přesně jako 30. 7. u konzultace.
  // ⛔ Doručení řeší uvítací trať: soubory NEJSOU veřejně na webu, jinak by z placeného
  //    produktu byl magnet zdarma.
  "balicek": {
    produkt: "balicek",
    source: "stripe-balicek",
    welcome: "onboarding-nakup-balicek",
    tcGrant: false,
    nazev: "40 receptů a 48 odpovědí",
    varianta: "kuchařka a e-book",
  },
  // ⭐ UPGRADE Z BALÍČKU NA VIDEOKURZ za 450 Kč (7. 8. 2026). Kdo má balíček za 349,
  // doplatí rozdíl místo plných 800. Postaveno vzorem `konzultace-vk`: týž produkt
  // jako plná varianta, ale VLASTNÍ KLÍČ KATALOGU, protože se liší cesta i započtení.
  // ⛔ `produkt: "videokurz"` je schválně TOTOŽNÝ s plnou variantou. Kupující dostane
  //    přesně týž přístup, jen za jinou cenu; `entitlements` má PK (email, product),
  //    takže se to správně potká s jedním řádkem videokurzu.
  // ⛔ `source: "stripe-videokurz-upgrade"` musí zůstat ODLIŠNÝ od `stripe-videokurz`.
  //    Jen tak jde v datech poznat, kolik lidí přišlo přes schod z balíčku, a hlavně
  //    se tím nerozbije rozlišení zdrojů u refundu (viz ZDROJ_BONUS_VIDEOKURZ výš:
  //    refund konzultace smí sebrat POUZE bonusový videokurz, nikdy zaplacený).
  // ⛔ `tcGrant: false` SCHVÁLNĚ, stejně jako u plného videokurzu. Kdo to přepne na
  //    true, rozdá roční VIP appky za 4 990 Kč lidem, kteří zaplatili 450.
  // ⚠️ `welcome` je TÁŽ uvítací trať jako u plné varianty: dodává se totéž zboží,
  //    takže i onboarding má být tentýž. Vlastní trať by znamenala druhou sadu šablon,
  //    která se při každé úpravě textů tiše rozejde s originálem.
  // ⚠️ NOVÝ ZDROJ SE MUSÍ DOPLNIT I DO `daily-digest` (seznam zdrojů u denních prodejů),
  //    jinak se prodej nezapočítá a nikde to nekřikne. Doplněno v témže commitu.
  "videokurz-upgrade": {
    produkt: "videokurz",
    source: "stripe-videokurz-upgrade",
    welcome: "onboarding-nakup-videokurz",
    tcGrant: false,
    nazev: "Videokurz výživy",
    varianta: "upgrade z balíčku",
  },
};

// Který odkaz vede na který klíč katalogu. Formát: `plink_A=academy-lifetime,plink_B=videokurz`.
// Proměnná prostředí `STRIPE_ONETIME_LINKS` fallback CELÝ PŘEBIJE, takže když se přes ni
// přidává další odkaz, musí obsahovat i ten stávající. Vzor je stejný jako u měsíčních
// `ACADEMY_ALLOWED_PLINKS` o pár řádků níž.
// ⚠️ ID platebního odkazu není tajemství (nese ho každá adresa checkoutu), proto smí být
//    v kódu. Klíče a tajné tokeny do zdrojáku NEPATŘÍ a taky tu žádné nejsou.
// ⬜ Testovací odkaz zatím neexistuje; až vznikne, přidá se sem nebo do proměnné.
//    Do té doby doživotní větev přijme JEN ostrý odkaz, což nevadí, ten zatím nikdo nezná.
function parsujOdkazy(s: string): Record<string, string> {
  const m: Record<string, string> = {};
  for (const kus of s.split(",")) {
    const [odkaz, klic] = kus.split("=").map((x) => (x ?? "").trim());
    if (!odkaz || !klic) continue;
    if (!KATALOG[klic]) {
      // Překlep v konfiguraci by jinak znamenal, že platba tiše propadne.
      console.error(`[academy-stripe-webhook] STRIPE_ONETIME_LINKS: klic "${klic}" neni v katalogu, odkaz ${odkaz} IGNOROVAN`);
      continue;
    }
    m[odkaz] = klic;
  }
  return m;
}
// ⚠️ Testovací odkaz vede na TÝŽ klíč katalogu jako ostrý, a je to schválně.
// Kdyby měl vlastní `source`, test by neprošel tou cestou, která běží v provozu,
// a neověřil by nic (mimo jiné ani to, jestli se prodej započítá do padesátky).
// ⛔ CENA TOHO: 15Kč odkaz uděluje doživotní Academy za 8 900 Kč plus appku na rok.
//    Po testu se MUSÍ zamknout ve Stripu a testovací nákup uklidit (entitlement,
//    grant v appce, lead), jinak zůstane v počítadle zakládajících navíc jeden člověk.
const ODKAZ_NA_PRODUKT = parsujOdkazy(
  Deno.env.get("STRIPE_ONETIME_LINKS") ??
    // ostrý odkaz, plná cena 8 900 („Barna Academy doživotní přístup")
    "plink_1TyQXwBq3rKubW9k1ywUSITs=academy-lifetime," +
    // ⭐ UPGRADE Z VIDEOKURZU za 8 100 (`price_1TyUNl…`). Dodává se ÚPLNĚ TOTÉŽ,
    // proto vede na týž klíč katalogu: doživotní přístup, appka na rok, uvítačka,
    // a započítá se do padesátky zakládajících. Kupující je zakládající člen jako
    // každý jiný, jen zaplatil o 800 míň za videokurz, který už má.
    // ⚠️ Vznikl NÁHRADOU za slevový kód UPGRADE800, který u ceny s daní v ceně
    // počítal jinak, než ukazoval (sleva 533,33 místo 800). Samostatná cena tuhle
    // třídu chyby vylučuje: není co přepočítávat.
    "plink_1TyUPQBq3rKubW9kj5P2YjCB=academy-lifetime," +
    // ⭐ VIDEOKURZ 800 Kč (`plink_1TymiH…`, cena `price_1TyaJv…`), vytvořeno 30. 7. 2026.
    // Vede na klíč `videokurz`, tedy JINÝ produkt, jiný zdroj, jinou uvítací trať
    // a BEZ appky. Kdyby tenhle řádek chyběl, zaplacený videokurz by spadl do větve
    // „neznámý odkaz" a člověk by přístup nedostal, aniž by to kdekoli křiklo.
    "plink_1TymiHBq3rKubW9kz1vYnyP1=videokurz," +
    // ⭐ KONZULTACE, DVA ODKAZY NA TÝŽ PRODUKT, ALE JINÝ KLÍČ KATALOGU (30. 7. 2026).
    // Rozdíl je JEN v tom, jestli je v ceně videokurz, a právě proto to musí být dva
    // klíče a ne jeden: podle klíče se rozhoduje, jestli se udělí bonusový kurz.
    // `plink_1Tyrn5…` = 2 990 Kč (`price_1TypXx…`), videokurz V CENĚ.
    "plink_1Tyrn5Bq3rKubW9k8n2VoeWL=konzultace," +
    // `plink_1Typhu…` = 2 190 Kč (`price_1TypdQ…`) pro majitele videokurzu, BEZ bonusu.
    "plink_1TyphuBq3rKubW9k1CHEIgDS=konzultace-vk," +
    // testovací 15 Kč, ⬜ zamknout ve Stripu a smazat odsud, až doběhne testování
    // ⭐ POSTUP, KTERÝ SE 30. 7. VYPLATIL: konzultační větev se ověřila tím, že se tenhle
    // odkaz DOČASNĚ přemapoval na `konzultace` a přehrála se už zaplacená (a refundovaná)
    // událost z 29. 7. Testuje se tak ostrá cesta, bez jediné koruny navíc a bez podvrženého
    // podpisu. Odhalilo to CHECK v `entitlements`, který neznal product='konzultace',
    // takže by zaplacená konzultace vracela 500 a NEPŘIŠEL BY ANI ALERT.
    // ⛔ Kdo to udělá znovu, MUSÍ ten řádek vrátit na `academy-lifetime`, jinak testovací
    //    odkaz za 15 Kč prodává produkt za 2 990.
    "plink_1TyPSiBq3rKubW9k3KRDDMtv=academy-lifetime," +
    // ⭐ BALÍČEK 349 Kč („40 receptů a 48 odpovědí"), vytvořeno 6. 8. 2026.
    // Po zaplacení Stripe přesměruje na https://martinbarna.cz/dekuji-balicek/.
    "plink_1U1VnFBq3rKubW9kXK79LF0i=balicek," +
    // ⬜ TESTOVACÍ ODKAZ 15 Kč na produkt „TEST balicek (NEPRODAVAT)", 6. 8. 2026.
    // ⭐ LEPŠÍ POJISTKA NEŽ V ČERVENCI: odkaz má ve Stripu nastaveno „Limit the number
    // of payments = 1", takže se po JEDNOM nákupu SÁM vypne. Nespoléhá se na to, že si
    // někdo vzpomene ho zamknout. Tenhle řádek se pak už jen uklidí odsud.
    // (uklizeno 7. 8. 2026: vycerpany testovaci odkaz na 1 platbu)
    // ⬜ DRUHY TESTOVACI ODKAZ 15 Kc, 7. 8. 2026. Ten prvni se po Martinove platbe
    //    SAM deaktivoval (limit 1 platba funguje, overeno v seznamu odkazu).
    //    Tenhle je taky na 1 platbu. Testuje se jim doklad o zaplaceni.
    // ⚠️ OSTRY odkaz na balicek ma `Limited use: No`, overeno 7. 8. v dashboardu.
    //    Limit patri VYHRADNE na testovaci odkazy, nikdy na prodejni.
    // (uklizeno 7. 8. 2026: vycerpany testovaci odkaz na 1 platbu)
    // ⭐ SANDBOXOVY (TESTOVACI) ODKAZ, 7. 8. 2026: buy.stripe.com/test_bJe9AS3UXgjMcjC8hF3ks00
    //    Zdroj `we_1U1ijpBq3rKubW9kurDo42vd` (event destination `academy-stripe-webhook-test`).
    // ⛔ NEMA limit poctu plateb, a je to zamerne: cely smysl je moct cely nakupni retez
    //    projet znovu a znovu bez Martinovych penez. Ostre odkazy limit mit MUSI, tenhle ne.
    // ⚠️ Sandboxova platba zaklada SKUTECNY radek v `entitlements` a posila SKUTECNE maily.
    //    Testuje se proto vyhradne na `fitness.barna@gmail.com`.
    "plink_1U1imlBq3rKubW9kcGLCUJPh=balicek," +
    // ⬜⬜ UPGRADE Z BALÍČKU NA VIDEOKURZ za 450 Kč (7. 8. 2026).
    // ⛔ ID JE ZATÍM PLACEHOLDER. Odkaz ve Stripu teprve vznikne; až bude, nahradí se
    //    `plink_DOPLNIT_UPGRADE_450` skutečným ID a TEPRVE POTOM to smí jít na produkci.
    //    Do té doby je řádek neškodný: na neexistující odkaz nemůže přijít platba.
    // ⚠️ Placeholder schválně NENÍ zakomentovaný. Mapování se tím dá otestovat hned
    //    (test kontroluje, že klíč vede na `videokurz-upgrade`), a zapomenutý řádek
    //    je vidět v kódu, kdežto zapomenutý komentář nikdo nehledá.
    "plink_DOPLNIT_UPGRADE_450=videokurz-upgrade",
);

const ALLOWED_PLINKS = (Deno.env.get("ACADEMY_ALLOWED_PLINKS") ??
  "plink_1TyBZUBq3rKubW9k81dwwUsq,plink_1TyFAyBq3rKubW9kXRelRllH")
  .split(",").map((s) => s.trim()).filter(Boolean);

const ALLOWED_PRICES = (Deno.env.get("ACADEMY_ALLOWED_PRICES") ??
  "price_1TyBXTBq3rKubW9kGizHd41g,price_1TyF94Bq3rKubW9kuUZwqGWv")
  .split(",").map((s) => s.trim()).filter(Boolean);

// Záchranná síť: kdyby na témž produktu vznikla nová cena a zapomnělo se ji sem dopsat,
// grant by tiše přestal chodit platícím lidem. Produkt je stabilnější klíč než cena.
const ALLOWED_PRODUCTS = (Deno.env.get("ACADEMY_ALLOWED_PRODUCTS") ?? "prod_Uy7nu91R8yjVwI")
  .split(",").map((s) => s.trim()).filter(Boolean);

// Vytáhne z řádků faktury ceny a produkty.
// ⚠️ Tvar ověřen proti Stripe API 2026-06-24.dahlia: cena je na
// `lines.data[].pricing.price_details.price`, NE na `price.id` jako ve starších
// verzích. Čteme obojí, ať to nespadne při změně verze ani jedním směrem.
// Kdyby se četla jen stará cesta, whitelist by neodpovídal NIČEMU a Academy by
// nedostal ani ten, kdo řádně zaplatil. To je horší vada než ta, kterou tohle řeší.
// deno-lint-ignore no-explicit-any
function cenyAProdukty(lines: any): { ceny: string[]; produkty: string[] } {
  const ceny: string[] = [], produkty: string[] = [];
  for (const l of (Array.isArray(lines?.data) ? lines.data : [])) {
    const p = l?.pricing?.price_details;
    const cena = p?.price ?? l?.price?.id ?? null;          // nová i legacy cesta
    const produkt = p?.product ?? l?.price?.product ?? null;
    if (typeof cena === "string") ceny.push(cena);
    if (typeof produkt === "string") produkty.push(produkt);
  }
  return { ceny, produkty };
}

// Trať pro MĚSÍČNÍ členy. Musí existovat v `email_templates`, jinak se pošle alert
// a člen zůstane bez uvítačky (přístup dostane tak jako tak, grant je první).
const WELCOME_TRACK = "onboarding-nakup-academy-mesicni";

// ⛔ DOŽIVOTNÍ MÁ JINOU UVÍTACÍ TRAŤ, a ten rozdíl není kosmetický.
// `onboarding-nakup-academy` (bez přípony) slibuje appku Tvůj Coach jako dárek včetně
// přihlašovacího tlačítka. Doživotnímu členovi to platí, měsíčnímu ne, a proto vznikla
// varianta `-mesicni`. Poslat doživotnímu tu měsíční by ho o slíbený dárek připravilo
// a poslat měsíčnímu tu doživotní by slíbilo něco, co nedostane. Prohodit se nesmí.
// ⇒ Doživotní trať je v `KATALOG` výš (pole `welcome`), tahle konstanta je jen pro měsíční.

// Kolik dní po konci zaplaceného období ještě pustit dovnitř. Kryje Stripe Smart
// Retries u selhané karty, ať nikoho nezamkneme kvůli jednomu neúspěšnému stržení.
const GRACE_DNI = 5;

// Když dorazí `checkout.session.completed`, ale ještě neznáme konec období z faktury,
// dáme prozatímní přístup. `invoice.paid` ho vzápětí přepíše přesným datem.
const PROVIZORNI_DNI = 35;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false },
});

// --- Ověření podpisu Stripu -------------------------------------------------
// ⛔ BEZ TOHOHLE by kdokoli mohl POSTem udělit sám sobě členství zdarma.
// Stripe posílá hlavičku `stripe-signature: t=<ts>,v1=<hex hmac>`, podepisuje se
// řetězec "<ts>.<raw body>" klíčem whsec_. Porovnává se na RAW těle, ne na
// přeparsovaném JSONu (jakákoli reserializace podpis rozbije).
// Spocita HMAC jednim tajemstvim a porovna v konstantnim case.
async function podpisSedi(tajemstvi: string, ts: string, raw: string, v1: string): Promise<boolean> {
  const klic = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(tajemstvi),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const podpis = await crypto.subtle.sign(
    "HMAC",
    klic,
    new TextEncoder().encode(`${ts}.${raw}`),
  );
  const ocekavano = [...new Uint8Array(podpis)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // Porovnání v konstantním čase.
  if (ocekavano.length !== v1.length) return false;
  let rozdil = 0;
  for (let i = 0; i < ocekavano.length; i++) {
    rozdil |= ocekavano.charCodeAt(i) ^ v1.charCodeAt(i);
  }
  return rozdil === 0;
}

async function overPodpis(raw: string, hlavicka: string): Promise<boolean> {
  // ⛔ Ostre I testovaci tajemstvi soucasne, viz komentar u STRIPE_WEBHOOK_SECRET_TEST.
  // Nenastavene se odfiltruje, takze prazdny test secret nikdy nic nepropusti.
  const tajemstvi = [STRIPE_WEBHOOK_SECRET, STRIPE_WEBHOOK_SECRET_TEST].filter(Boolean);
  if (!tajemstvi.length || !hlavicka) return false;

  const casti = Object.fromEntries(
    hlavicka.split(",").map((p) => {
      const i = p.indexOf("=");
      return [p.slice(0, i).trim(), p.slice(i + 1).trim()];
    }),
  );
  const ts = casti["t"];
  const v1 = casti["v1"];
  if (!ts || !v1) return false;

  // Ochrana proti přehrání starého požadavku (Stripe doporučuje 5 minut).
  const stariS = Math.abs(Date.now() / 1000 - Number(ts));
  if (!Number.isFinite(stariS) || stariS > 300) return false;

  // Staci, kdyz sedi JEDNO z tajemstvi: ostre pro platby zakazniku, testovaci pro sandbox.
  for (const t of tajemstvi) {
    if (await podpisSedi(t, ts, raw, v1)) return true;
  }
  return false;
}

// Alert adminovi. Vzor 1:1 podle `simpleshop-webhook`, ať se to hlásí na jedno místo.
// ⚠️ Zapisuje do `email_events` (type='error'), NE do vlastní tabulky. Tabulka
// `admin_alerts` v tomhle projektu NEEXISTUJE (ověřeno v information_schema);
// kdyby se do ní psalo, alerty by tiše mizely a nikdo by se o selhaném grantu nedozvěděl.
async function alertAdmin(predmet: string, detail: Record<string, unknown>) {
  try {
    await admin.from("email_events").insert({
      lead_id: null, step: 0, type: "error",
      detail: {
        track: "academy-stripe-webhook",
        error: predmet + " " + JSON.stringify(detail).slice(0, 300),
      },
    });
  } catch { /* best-effort */ }

  if (!RESEND_KEY) return;
  try {
    let to = ALERT_FALLBACK;
    const { data } = await admin.from("app_config").select("value").eq("key", "admin_emails").maybeSingle();
    if (data?.value) to = String(data.value).split(",")[0].trim() || ALERT_FALLBACK;
    const rows = Object.entries(detail).map(([k, v]) => `<li><b>${k}</b>: ${String(v)}</li>`).join("");
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: "Bearer " + RESEND_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Barna Academy <news@martinbarna.cz>", to: [to],
        subject: "⚠️ " + predmet,
        html: `<p>Upozornění ze Stripe webhooku (Academy/produkty).</p><ul>${rows}</ul>`
          + `<p>Zkontroluj platbu ve Stripu a případně uděl přístup ručně v adminu.</p>`,
      }),
    });
  } catch { /* best-effort */ }
}

// --- Udělení / prodloužení přístupu ----------------------------------------
// Vrací true, když šlo o PRVNÍ udělení (rozhoduje o uvítacím e-mailu).
// `stripe` = vazba na konkrétní platbu. Ukládá se kvůli REFUNDU: bez ní by se
// refund musel párovat podle e-mailu, což je nejednoznačné (Academy i appka jedou
// na jednom Stripe účtu, takže by refund appky mohl sebrat Academy), a bez
// `subscription` by nebylo co zrušit a za měsíc by se strhlo znovu.
async function udelPristup(
  email: string,
  expiraceIso: string,
  stripe?: { customer?: string | null; subscription?: string | null },
  provizorni = false,
): Promise<boolean> {
  const { data: stavajici } = await admin
    .from("entitlements")
    .select("source, active, expires_at")
    .eq("email", email)
    .eq("product", "academy")
    .maybeSingle();

  // ⛔ POJISTKA PROTI DEGRADACI DOŽIVOTNÍHO ČLENSTVÍ.
  // Kdo má doživotní přístup (expires_at IS NULL a jiný zdroj než stripe-monthly),
  // toho měsíční platba NESMÍ přepsat na expirující. Stalo by se to, kdyby si
  // doživotní člen omylem založil ještě předplatné, nebo kdyby dorazily události
  // v jiném pořadí. Přístup necháme být; peníze řeší Martin refundem ve Stripu.
  if (stavajici && stavajici.expires_at === null && stavajici.source !== "stripe-monthly") {
    await alertAdmin("Stripe: platba od člena, který má DOŽIVOTNÍ přístup", {
      email,
      stavajici_zdroj: stavajici.source,
      poznamka: "Přístup nezměněn (nedegradovat na expirující). Zvážit refund předplatného.",
    });
    return false;
  }

  const jePrvni = !stavajici || !stavajici.active;

  // ⛔ PROVIZORNÍ GRANT NESMÍ NIKDY ZKRÁTIT UŽ ZAPSANOU EXPIRACI.
  // `checkout.session.completed` dává jen odhad (35 dní), `invoice.paid` zná přesný
  // konec období. Stripe NEZARUČUJE pořadí doručení, takže když dorazí invoice první,
  // checkout jí přepsal přesnou hodnotu zpátky na odhad. U měsíčního je to den,
  // ⚠️ ALE U ROČNÍHO TARIFU by odhad 35 dní přepsal 370 a člověk by zaplatil rok
  // a přístup by mu vypršel za měsíc. Změřeno 28. 7. 2026 na reálné platbě.
  let expiraceFinal = expiraceIso;
  if (provizorni && stavajici?.expires_at) {
    const stara = new Date(stavajici.expires_at).getTime();
    if (Number.isFinite(stara) && stara > new Date(expiraceIso).getTime()) {
      expiraceFinal = stavajici.expires_at;   // stávající je delší ⇒ nesaháme na ni
    }
  }

  const { error } = await admin.from("entitlements").upsert(
    {
      email,
      product: "academy",
      active: true,
      source: "stripe-monthly",
      granted_at: new Date().toISOString(),
      expires_at: expiraceFinal,
      // ⚠️ Nepřepisovat na null, když událost ID nenese (např. obnova bez customeru).
      // `??` by null zapsalo, proto se pole doplní jen když hodnota opravdu je.
      ...(stripe?.customer ? { stripe_customer_id: stripe.customer } : {}),
      ...(stripe?.subscription ? { stripe_subscription_id: stripe.subscription } : {}),
    },
    { onConflict: "email,product" },
  );
  if (error) throw new Error("db: " + error.message);

  return jePrvni;
}

// --- Doživotní přístup (jednorázová platba 8 900) ---------------------------
// Vrací `novyDozivotni` = true, když člověk doživotní přístup PRÁVĚ získal (nový
// zákazník i ten, kdo přechází z měsíčního). Rozhoduje o uvítacím e-mailu a o TC grantu.
//
// ⛔⛔ EXPIRACE SE MUSÍ PŘEPSAT NA NULL VÝSLOVNĚ. Kdo si dosud platil měsíčně, má
// v řádku datum konce. Upsert, který pole `expires_at` neuvede, tam **starou hodnotu
// NECHÁ**, takže by doživotnímu členovi přístup za pár týdnů vypršel a nikdo by se to
// nedozvěděl. Tahle třída chyby (změna, která se tváří jako provedená) nás 28. 7.
// stála dva testy, viz `feedback-create-or-replace-neni-nahrada`.
async function udelDozivotni(
  email: string,
  def: JednorazovyProdukt,
  stripe?: { customer?: string | null; paymentIntent?: string | null },
): Promise<{ novyDozivotni: boolean; zruseneMesicni: string; predchoziPi: string | null }> {
  const { data: stavajici } = await admin
    .from("entitlements")
    .select("source, active, expires_at, stripe_subscription_id, stripe_payment_intent")
    .eq("email", email)
    .eq("product", def.produkt)
    .maybeSingle();

  // ⛔⛔ PLATBA Z MINULA SE MUSI PRECIST TED, PRED UPSERTEM NIZ.
  // Upsert o par radku niz `stripe_payment_intent` PREPISE tou soucasnou platbou.
  // Kdo si tuhle hodnotu precte az potom (a presne to delala vetev opakovaneho nakupu
  // balicku), dostane platbu, kterou prave ted sam zapsal, porovna ji sama se sebou,
  // vyjde mu shoda a vyhodnoti novy nakup jako "prehrana udalost". 7. 8. 2026 kvuli tomu
  // Martin zaplatil podruhe a NEDOSTAL nic: zadny mail, zadny zaznam v `email_events`.
  // ⇒ Pojistka se nikdy nesmi porovnavat proti udaji, ktery si tentyz beh prepisuje.
  const predchoziPi: string | null = stavajici?.stripe_payment_intent ?? null;

  const bylDozivotni = !!stavajici && stavajici.active && stavajici.expires_at === null;
  if (bylDozivotni) {
    await alertAdmin("Stripe: DRUHÝ doživotní nákup od téhož člověka", {
      email,
      produkt: def.nazev,
      stavajici_zdroj: stavajici.source,
      poznamka: "Přístup už měl. Zvaž vrácení té druhé platby.",
    });
  }

  const { error } = await admin.from("entitlements").upsert(
    {
      email,
      product: def.produkt,
      active: true,
      source: def.source,
      granted_at: new Date().toISOString(),
      expires_at: null,                 // ⛔ výslovně, viz komentář výš
      ...(stripe?.customer ? { stripe_customer_id: stripe.customer } : {}),
      // ⛔⛔ BEZ TOHOHLE NEJDE SPÁROVAT REFUND. U `mode=payment` Stripe zákazníka
      // NEZAKLÁDÁ, takže `stripe_customer_id` zůstane NULL a refundová větev nemá
      // podle čeho hledat. Změřeno naostro 29. 7. 2026: vrácení peněz tiše neudělalo
      // vůbec nic, přístup i appka zůstaly udělené. Viz `entitlements-payment-intent.sql`.
      ...(stripe?.paymentIntent ? { stripe_payment_intent: stripe.paymentIntent } : {}),
    },
    { onConflict: "email,product" },
  );
  if (error) throw new Error("db: " + error.message);

  // ⛔⛔ UPGRADE Z MĚSÍČNÍHO: ZASTAVIT DALŠÍ STRHÁVÁNÍ.
  // Slevový kód na upgrade existuje právě proto, aby měsíční členové přešli na doživotní.
  // Kdybychom jim předplatné nechali běžet, platili by 990 Kč měsíčně NAVÍC k doživotnímu
  // přístupu, který už mají. Nikde by to nespadlo a přišlo by se na to reklamací.
  // Grant je první a zrušení až po něm: kdyby zrušení selhalo, člověk má přístup a přijde
  // hlasitý alert. Opačné pořadí by při chybě nechalo člověka bez přístupu.
  let zruseneMesicni = "nebylo-co";
  const subId = stavajici?.stripe_subscription_id;
  if (subId && stavajici?.source === "stripe-monthly") {
    if (!STRIPE_SUBS_KEY) {
      zruseneMesicni = "CHYBI-KLIC";
    } else {
      try {
        const r = await fetch(
          "https://api.stripe.com/v1/subscriptions/" + encodeURIComponent(subId),
          { method: "DELETE", headers: { Authorization: "Bearer " + STRIPE_SUBS_KEY } },
        );
        if (r.ok) zruseneMesicni = "ok";
        else {
          const telo = await r.text().catch(() => "");
          zruseneMesicni = "http-" + r.status + " " + telo.slice(0, 200);
        }
      } catch (e) { zruseneMesicni = "chyba-" + String(e).slice(0, 60); }
    }
    if (zruseneMesicni !== "ok") {
      await alertAdmin("🔴 Stripe: upgrade na doživotní, ale MĚSÍČNÍ PŘEDPLATNÉ BĚŽÍ DÁL", {
        email,
        subscription: subId,
        vysledek: zruseneMesicni,
        co_delat: "⛔ ZRUŠ PŘEDPLATNÉ RUČNĚ VE STRIPU, jinak mu strhneme 990 Kč navíc.",
      });
    }
  }

  return { novyDozivotni: !bylDozivotni, zruseneMesicni, predchoziPi };
}

// --- Appka Tvůj Coach na rok (jen doživotní varianta) -----------------------
// Vzor 1:1 podle `simpleshop-webhook`, ať se doživotní nákup chová stejně bez ohledu
// na to, kudy peníze přišly. ⚠️ tier `ai_basic` = VIP appky na JEDEN ROK (délku řeší
// SQL `grant_app_access` v repu appky, větví se podle `source`). Neregistrovanému
// se grant uloží jako pending a sedne si, až se zaregistruje.
async function grantTvujCoach(email: string, sessionId: string | null): Promise<string> {
  let vysledek = "no-secret";
  try {
    const { data: gs } = await admin
      .from("app_config").select("value").eq("key", "academy_grant_secret").maybeSingle();
    const gsec = gs?.value ? String(gs.value) : "";
    if (gsec) {
      const r = await fetch("https://kfkmghvhqwqtsalqjmrp.functions.supabase.co/academy-grant", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-academy-secret": gsec },
        body: JSON.stringify({
          email, action: "grant", tier: "ai_basic",
          source: "academy-nakup", academy_order_id: sessionId,
        }),
      }).catch(() => null);
      if (r && r.ok) {
        const jj = await r.json().catch(() => ({}));
        vysledek = String((jj as { result?: string }).result || "ok");
      } else vysledek = r ? "http-" + r.status : "fetch-fail";
    }
    await admin.from("tvujcoach_grants")
      .insert({ email, action: "grant", result: vysledek, source: "academy-nakup" });
  } catch { /* best-effort, nikdy nesmí shodit nákup */ }
  return vysledek;
}

// --- Referral atribuce ------------------------------------------------------
// ⛔ NÁLEZ 29. 7. 2026: tahle logika žila JEN v `simpleshop-webhook`. Ve chvíli, kdy
// Academy přešla na Stripe, se odměna za doporučení přestala připisovat a nikde to
// nekřiklo. Nikdo o peníze nepřišel (tabulka `referrals` byla prázdná), ale mechanismus
// byl rozpojený a u videokurzu na Stripu by se to zopakovalo.
//
// Kód doporučitele se hledá ve DVOU krocích:
//  1) `client_reference_id` z payment linku (připojuje ho `assets/referral.js`). Tohle je
//     odolnější cesta: funguje, i když člověk v modalu přeskočí e-mail nebo zaplatí jinou
//     adresou, než kterou napsal.
//  2) fallback na `referral_click` podle e-mailu kupujícího, přesně jako SimpleShop.
//     Díky němu funguje atribuce i u odkazů bez `client_reference_id`.
//
// ⚠️ Pravidla (platný aktivní kód, zákaz self-referralu, idempotence, výše odměn) jsou
// schválně TOTOŽNÁ se SimpleShopem. Kdyby se rozešla, dostal by doporučitel jinou odměnu
// podle toho, kudy kupující náhodou prošel.
const ODMENA: Record<string, number> = { academy: 300, videokurz: 150 };

async function atribuujReferral(
  buyerEmail: string,
  produkt: string,
  clientRef: string | null,
  orderId: string | null,
): Promise<string> {
  try {
    const email = buyerEmail.toLowerCase().trim();
    let ref = (clientRef ?? "").toUpperCase().trim();

    if (!ref) {
      const cutoff = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
      const { data: clicks } = await admin
        .from("referral_click").select("ref").eq("email", email).gt("created_at", cutoff)
        .order("created_at", { ascending: false }).limit(1);
      ref = clicks?.[0]?.ref ? String(clicks[0].ref).toUpperCase().trim() : "";
    }
    if (!ref) return "bez-kodu";

    const { data: codes } = await admin
      .from("referral_codes").select("owner_email").eq("code", ref).eq("active", true).limit(1);
    const owner = codes?.[0]?.owner_email ? String(codes[0].owner_email).toLowerCase() : "";
    if (!owner) return "neznamy-kod";
    if (owner === email) return "self-referral";

    if (orderId) {
      const { data: existing } = await admin.from("referrals").select("id").eq("order_id", orderId).limit(1);
      if (existing && existing.length) return "duplicita-order";
    }
    const { data: dup } = await admin
      .from("referrals").select("id").eq("buyer_email", email).eq("product", produkt).limit(1);
    if (dup && dup.length) return "duplicita-produkt";

    await admin.from("referrals").insert({
      code: ref, buyer_email: email, product: produkt, amount: null,
      order_id: orderId || null, source: "coupon", status: "pending",
      reward_type: "credit", reward_amount: ODMENA[produkt] ?? 0,
    });
    return "zapsano";
  } catch (e) {
    // Best-effort: atribuce NIKDY nesmí shodit nákup. Selhání jde do alertu, ne do 500.
    await alertAdmin("Stripe: referral atribuce selhala", {
      email: buyerEmail, produkt, chyba: String(e).slice(0, 200),
    });
    return "chyba";
  }
}

// --- Uvítací e-mail (jen při prvním udělení) --------------------------------
// Vzor převzatý ze `simpleshop-webhook`, ale s vlastní tratí pro měsíční členy.
// `track` má výchozí hodnotu, takže původní volání `posliUvitani(email)` funguje
// beze změny. Používá se i pro rozlučkový mail po refundu.
async function posliUvitani(
  email: string,
  track: string = WELCOME_TRACK,
  vars?: Record<string, string>,
) {
  const nowIso = new Date().toISOString();

  // Když trať nemá šablonu, drip-send by neposlal nic a nikdo by se to nedozvěděl.
  // Radši to zakřičí, než aby platící člen tiše zůstal bez uvítačky.
  const { data: sablona } = await admin
    .from("email_templates")
    .select("track")
    .eq("track", track)
    .eq("step", 0)
    .maybeSingle();
  if (!sablona) {
    await alertAdmin("Stripe: měsíční člen nedostal uvítací e-mail (chybí šablona)", {
      email,
      track: track,
      poznamka: "Přístup UDĚLEN. Chybí step 0 v email_templates, dopsat text.",
    });
    return;
  }

  // ⛔ `vars` se ukládají i K LEADOVI, ne jen do těla invoku níž. Tělo existuje jednou;
  // když odeslání selže, opakovaný pokus jede z hodinové dávky a bez tohohle by spadl
  // na `unresolved_token` už navždy. Klíčuje se tratí, viz `leads-vars.sql`.
  const { data: lead } = await admin
    .from("leads").select("id,name,vars,status").eq("email", email).limit(1);

  // ⛔ SLOUČIT, NE PŘEPSAT (opraveno 6. 8. 2026). Do té doby se sem psalo natvrdo
  // `{ [track]: vars }`, což PŘEPSALO CELÝ sloupec a tiše zahodilo proměnné všech
  // ostatních tratí. Kdo si koupil balíček (odkazy ke stažení uložené pod
  // `onboarding-nakup-balicek`) a pak videokurz, přišel zápisem druhého nákupu
  // o proměnné toho prvního. Nespadlo by to, jen by mail vyšel s `unresolved_token`.
  // ⚠️ Slučuje se jen o úroveň výš, klíčem trati. Uvnitř jedné trati je přepis správný:
  //    nové odkazy mají nahradit ty staré, ne se s nimi míchat.
  const stavajiciVars = (lead && lead.length && lead[0].vars
    && typeof lead[0].vars === "object" && !Array.isArray(lead[0].vars))
    ? lead[0].vars as Record<string, unknown>
    : {};
  // ⛔⛔ ODHLASENY CLOVEK, KTERY KOUPIL, NESMI SKONCIT ZPATKY V MARKETINGU (7. 8. 2026).
  // `status: "active"` nize je nutne, jinak `drip-send` nevybere leada a NEODEJDE ANI
  // DORUCENI (vybira `status='active' AND next_send_at IS NOT NULL`). Zaplacene tedy
  // dostat musi. Ale do te doby tim clovek, ktery se drive odhlasil, TICHE OZIL
  // pro vsechny budouci rozesilky. Proto se sem zapisuje znacka a `drip-send` podle ni
  // po prvnim mailu trate vrati `status` zpatky na `unsubscribed` (viz tam `bylOdhlaseny`).
  // ⚠️ Znacka se nesmi ztratit ani smazat: bez ni oprava mlci a chyba se vrati.
  // ⚠️ Zatim se to nikomu nestalo (zmereno 6. 8.: 37 odhlasenych, 0 z nich s nakupem),
  //    takze tohle je prevence, ne oprava skody.
  const bylOdhlaseny = !!(lead && lead.length && lead[0].status === "unsubscribed");
  // ⛔ ZNACKA SE MUSI I MAZAT, ne jen zapisovat (nalez z revize 7. 8. 2026).
  // Kdo se odhlasil, koupil (drip ho vratil mezi odhlasene), pak se ZNOVU PRIHLASIL
  // a koupil podruhe, dostal by doruceni a znacka ze `vars` by ho TISE odhlasila znovu,
  // protoze prezila. Proto se pri aktivnim leadovi vzdycky vyhodi.
  const varsBezZnacky = { ...stavajiciVars };
  delete (varsBezZnacky as Record<string, unknown>)._byl_odhlaseny;
  const varsProLeada = (vars || bylOdhlaseny || "_byl_odhlaseny" in stavajiciVars)
    ? {
      ...varsBezZnacky,
      ...(bylOdhlaseny ? { _byl_odhlaseny: true } : {}),
      ...(vars ? { [track]: vars } : {}),
    }
    : null;

  if (lead && lead.length) {
    await admin.from("leads").update({
      track: track, step: 0, status: "active",
      next_send_at: nowIso, purchased: true, updated_at: nowIso,
      ...(varsProLeada ? { vars: varsProLeada } : {}),
    }).eq("id", lead[0].id);
  } else {
    // ⚠️ `source` u NOVÉHO leada se řídí tratí, ne konstantou. Doživotní kupec zapsaný
    // jako „stripe-monthly" by pak v přehledu podle zdrojů seděl ve špatné škatuli
    // a nikde by to nekřiklo. Týká se jen nově zakládaných leadů; kdo už v tabulce je,
    // si svůj původní zdroj (kampaň, magnet) ponechá, a to je správně.
    const zdrojLeada = track.startsWith("rozlouceni-")
      ? "stripe-refund"
      : (track === WELCOME_TRACK ? "stripe-monthly" : "stripe-lifetime");
    await admin.from("leads").insert({
      email, track: track, step: 0, status: "active",
      next_send_at: nowIso, purchased: true, source: zdrojLeada,
      ...(varsProLeada ? { vars: varsProLeada } : {}),
    });
  }

  const { data: cfg } = await admin
    .from("app_config").select("value").eq("key", "drip_invoke_secret").maybeSingle();
  const dripSecret = cfg?.value ? String(cfg.value) : "";
  if (!dripSecret) return;

  await fetch(SUPABASE_URL + "/functions/v1/drip-send", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-drip-secret": dripSecret },
    // `vars` posíláme jen když nějaké jsou. Uvítačka žádné vlastní proměnné nemá,
    // rozlučka ano a bez nich by se neodeslala (viz komentář u `castkaText`).
    body: JSON.stringify(vars ? { only_email: email, vars } : { only_email: email }),
  }).catch(() => null);
}

function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function zaDni(n: number): string {
  return new Date(Date.now() + n * 86400000).toISOString();
}

// ⭐ DOKLAD O ZAPLACENÍ, SAMOSTATNÝM MAILEM (7. 8. 2026).
// ⛔ Stripe zákaznické účtenky neposílá (v dashboardu vypnuté) a ZAPNOUT je nejde
//    smysluplně: v „Default language" ČEŠTINA VŮBEC NENÍ (ověřeno v účtu, 16 jazyků
//    včetně polštiny a řečtiny, čeština chybí). Anglická účtenka je pro Martinovu
//    cílovku horší než žádná, proto si doklad posíláme sami, česky.
// ⛔⛔ A PROČ SAMOSTATNÝM MAILEM, NE ŘÁDKEM V DORUČOVACÍM: `renderEmail` v drip-send
//    dělá `if (hasToken(...)) throw new Error('unresolved_token')`, takže JAKÁKOLI
//    nenaplněná {{proměnná}} shodí render a mail NEODEJDE. Doklad je doplněk,
//    doručení jsou peníze. ⇒ Doručení nesmí na dokladu viset.
// ⛔⛔⛔ MUSÍ ODEJÍT PŘI KAŽDÉ PLATBĚ (opraveno 7. 8. 2026). Do té doby byl vevnitř
//    `if (novyDozivotni)`, takže kdo koupil podruhé, zaplatil a doklad nedostal.
//    Peníze přišly pokaždé ⇒ doklad musí odejít pokaždé. Idempotenci nedělá tenhle
//    kód, ale místa, odkud se volá: první nákup jen při novém grantu, opakovaný jen
//    při NOVÉM `payment_intent`.
// ⚠️ Vrací stav (ne void), ať je v odpovědi funkce vidět, co se stalo. Tichý doplněk,
//    o kterém nikde není stopa, se hledá stejně blbě jako tichá chyba.
// ⚠️ `amount_total` se bere ze SESSION, ne z ceníku. Slevový kód ji mění a doklad
//    musí říkat, kolik člověk reálně zaplatil.
// deno-lint-ignore no-explicit-any
async function posliDoklad(email: string, obj: any): Promise<string> {
  if (!RESEND_KEY) return "chybi-resend-klic";
  try {
    const castka = castkaText(Number(obj.amount_total ?? 0), String(obj.currency ?? "czk"));
    const cislo = String(obj.id ?? "").slice(-12).toUpperCase();
    const datum = datumCesky(new Date().toISOString());
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: "Bearer " + RESEND_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Martin Barna <news@martinbarna.cz>",
        to: [email],
        reply_to: "martin@martinbarna.cz",
        subject: "Doklad o zaplacení, " + castka,
        html:
          `<div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;font-size:16px;line-height:1.55;color:#222;max-width:560px">`
          + `<p>Dobrý den,</p>`
          + `<p>tady je doklad o zaplacení. Soubory ke stažení máš v předchozím e-mailu.</p>`
          + `<table cellpadding="6" style="border-collapse:collapse;font-size:15px">`
          + `<tr><td style="color:#666">Produkt</td><td><b>40 receptů a 48 odpovědí</b></td></tr>`
          + `<tr><td style="color:#666">Částka</td><td><b>${castka}</b></td></tr>`
          + `<tr><td style="color:#666">Zaplaceno</td><td>${datum}</td></tr>`
          + `<tr><td style="color:#666">Číslo objednávky</td><td>${cislo}</td></tr>`
          + `<tr><td style="color:#666">Prodávající</td><td>Martin Barna, IČO 76383032<br>neplátce DPH</td></tr>`
          + `</table>`
          + `<p style="font-size:14px;color:#555">Platba proběhla přes platební bránu Stripe. `
          + `Do 14 dnů můžeš od smlouvy odstoupit na `
          + `<a href="https://martinbarna.cz/odstoupeni/?product=balicek">martinbarna.cz/odstoupeni</a>.</p>`
          + `<p>Martin Barna<br>martinbarna.cz</p></div>`,
      }),
    });
    return res.ok ? "ok" : "http-" + res.status;
  } catch (e) {
    // Doklad je doplněk, nikdy nesmí shodit doručení zaplaceného produktu.
    return "chyba-" + String(e).slice(0, 60);
  }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method" }, 405);

  const raw = await req.text();
  const sig = req.headers.get("stripe-signature") ?? "";
  if (!(await overPodpis(raw, sig))) {
    return json({ error: "bad-signature" }, 400);
  }

  // deno-lint-ignore no-explicit-any
  let ev: any;
  try {
    ev = JSON.parse(raw);
  } catch {
    return json({ error: "bad-json" }, 400);
  }

  const typ = String(ev?.type ?? "");
  const obj = ev?.data?.object ?? {};

  try {
    // --- 1) První zaplacení z Payment Linku -------------------------------
    if (typ === "checkout.session.completed") {
      // --- 1a) DOŽIVOTNÍ 8 900 Kč: jednorázová platba ---------------------
      // Od 29. 7. 2026 jde doživotní varianta přes Stripe, ne přes SimpleShop.
      // ⚠️ `mode` rozhoduje o VŠEM ostatním, proto se větví hned na začátku.
      if (obj.mode === "payment") {
        const plinkL = typeof obj.payment_link === "string" ? obj.payment_link : "";
        // ⛔ Jen odkazy z naší mapy. Cizí jednorázové platby z téhož Stripe účtu
        // (a je jich tam víc, účet je společný s appkou) sem chodí taky.
        const klic = ODKAZ_NA_PRODUKT[plinkL];
        const def = klic ? KATALOG[klic] : undefined;
        if (!def) {
          return json({ ok: true, ignored: "foreign-price", mode: "payment", payment_link: plinkL || null });
        }
        const emailL = String(
          obj.customer_details?.email ?? obj.customer_email ?? "",
        ).trim().toLowerCase();
        if (!emailL) {
          await alertAdmin("Stripe: doživotní zaplaceno, ale chybí e-mail", {
            session: obj.id,
            poznamka: "Přístup NEUDĚLEN. V Payment Linku musí být e-mail povinný.",
          });
          return json({ error: "no-email" }, 422);
        }

        const { novyDozivotni, zruseneMesicni, predchoziPi } = await udelDozivotni(emailL, def, {
          customer: typeof obj.customer === "string" ? obj.customer : null,
          paymentIntent: typeof obj.payment_intent === "string" ? obj.payment_intent : null,
        });

        // Appka a uvítačka jen tomu, kdo přístup PRÁVĚ získal. Opakovaný nákup
        // (nebo přehrání téže události Stripem) nesmí poslat druhý mail ani druhý grant.
        let tcGrant = def.tcGrant ? "preskoceno" : "netyka-se";
        let referral = "preskoceno";
        let bonusVideokurz = def.videokurzBonus ? "preskoceno" : "netyka-se";
        // Stav dokladu jde do odpovědi funkce, ať je v logu Stripu vidět, jestli odešel.
        let doklad = klic === "balicek" ? "neodeslano" : "netyka-se";
        if (novyDozivotni) {
          if (def.tcGrant) {
            tcGrant = await grantTvujCoach(emailL, typeof obj.id === "string" ? obj.id : null);
          }

          // ⭐ BONUSOVÝ VIDEOKURZ (konzultace za 2 990 ho má v ceně).
          // Udílí se PŘED uvítacím mailem schválně: ten mail bonusy slibuje, takže kdyby
          // se přidávaly po něm a selhalo to, člověk by dostal mail o něčem, co nemá.
          //
          // ⛔⛔ NEZAPISUJEME `stripe_payment_intent` ANI `stripe_customer_id`.
          // Refundová větev páruje dotazem `.eq("stripe_payment_intent", platba).maybeSingle()`,
          // takže kdyby tuhle platbu nesly DVA řádky (konzultace i bonusový kurz),
          // `maybeSingle()` by hodil chybu, webhook by vrátil 500 a Stripe by refund
          // opakoval donekonečna. Bonus se proto dohledává přes e-mail + `source`.
          //
          // ⛔⛔ A NEPŘEPISUJEME ZAPLACENÝ VIDEOKURZ NA BONUSOVÝ. `entitlements` má
          // UNIQUE(email, product), takže slepý `upsert` by u člověka, který si kurz
          // koupil zvlášť za 800 Kč, jen přepsal `source` na `konzultace-bonus`.
          // Refund konzultace pak videokurz odebírá právě podle toho zdroje, takže
          // by mu SEBRAL kurz, který si zaplatil, a nikde by to nekřiklo.
          // ⚠️ A není to okrajový případ: odkaz za 2 190 zná jen ten, kdo přijde
          // z děkovací stránky nebo z uvítacího mailu. Kdo dojde na `/konzultace/`,
          // vidí 2 990 i s videokurzem v ceně, i když kurz dávno má.
          // Proto se sahá jen na řádek, který ještě neexistuje nebo už bonusový JE.
          if (def.videokurzBonus) {
            try {
              const { data: stavajici } = await admin.from("entitlements")
                .select("source").eq("email", emailL).eq("product", "videokurz").maybeSingle();
              if (stavajici && stavajici.source !== ZDROJ_BONUS_VIDEOKURZ) {
                // Kurz už má z jiného titulu (koupený zvlášť, SimpleShop, ruční grant).
                // Nechat být: dostal míň, než slibuje mail, ale nepřišel o zaplacené.
                bonusVideokurz = "jiz-mel-z-" + stavajici.source;
              } else {
                const { error: chybaBonus } = await admin.from("entitlements").upsert({
                  email: emailL,
                  product: "videokurz",
                  active: true,
                  source: ZDROJ_BONUS_VIDEOKURZ,
                  granted_at: new Date().toISOString(),
                  expires_at: null,
                }, { onConflict: "email,product" });
                bonusVideokurz = chybaBonus ? "CHYBA: " + chybaBonus.message : "ok";
              }
            } catch (e) { bonusVideokurz = "chyba-" + String(e).slice(0, 60); }
            // ⚠️ Ty dvě větve MUSÍ zůstat výlučné (`else if`). „Už ho měl" není chyba,
            // ale taky to není „ok", takže by jinak spadlo i do červeného alertu níž
            // a Martinovi by přišlo, že má ručně dodat kurz, který ten člověk má.
            // Táž třída falešného poplachu jako u refundu videokurzu dnes ráno.
            if (bonusVideokurz.startsWith("jiz-mel-z-")) {
              // Není to chyba, ale Martin to má vědět: člověk zaplatil 2 990 za balík,
              // ve kterém je kurz, co už měl. Nabídka za 2 190 mu unikla.
              await alertAdmin("ℹ️ Stripe: konzultace za 2 990 kupci, který videokurz UŽ MĚL", {
                email: emailL, mel_kurz_z: bonusVideokurz.replace("jiz-mel-z-", ""),
                co_delat: "Nic nutného. Zvaž, jestli mu nevrátit rozdíl 800 Kč: existuje "
                  + "varianta za 2 190 Kč pro majitele kurzu a on ji minul.",
              });
            } else if (bonusVideokurz !== "ok") {
              await alertAdmin("🔴 Stripe: konzultace zaplacena, ale BONUSOVÝ VIDEOKURZ se neudělil", {
                email: emailL, chyba: bonusVideokurz,
                co_delat: "⛔ Přidej mu videokurz ručně v adminu. Konzultaci má, kurz ne, "
                  + "a uvítací mail mu ho slibuje.",
              });
            }
          }

          // ⭐ BALÍČEK 349 Kč: doručení JE ten uvítací mail. Soubory nejsou nikde veřejně,
          // takže se sem musí dostat jako podepsané odkazy s expirací. Generuje je server
          // (service role), platnost 14 dní, ať má člověk čas si je uložit i z dovolené.
          // ⛔ Kdyby generování selhalo, mail se NEPOSÍLÁ s prázdnými odkazy: bez souborů
          //    by byl k ničemu a člověk by si myslel, že dostal, co si koupil. Radši alert
          //    Martinovi, ať to pošle ručně.
          let varsProUvitani: Record<string, string> | undefined;
          if (klic === "balicek") {
            // ⚠️ `download` je nosné, ne kosmetika: bez něj prohlížeč PDF jen OTEVŘE
            // v nové záložce a člověk si myslí, že se nic nestáhlo. S ním se soubor
            // uloží, a rovnou pod čitelným jménem místo `Kucharka 40 + receptu.pdf`.
            const podepis = async (soubor: string, jmenoProStazeni: string) => {
              const { data, error } = await admin.storage.from("videokurz-materialy")
                .createSignedUrl(soubor, 14 * 24 * 3600, { download: jmenoProStazeni });
              if (error || !data?.signedUrl) throw new Error("signed_url:" + soubor + ":" + String(error?.message ?? "prazdne"));
              return data.signedUrl;
            };
            try {
              varsProUvitani = {
                // ⚠️ NE `Otazky klientu EBook.docx.pdf`, to je starší export z Wordu bez
                //    brandových barev. Ostrá verze je ta bez `.docx` (ověřeno 6. 8. 2026).
                kucharka_url: await podepis("Kucharka 40 + receptu.pdf", "Martin-Barna-Kucharka-40-receptu.pdf"),
                otazky_url: await podepis("Otazky klientu EBook.pdf", "Martin-Barna-48-odpovedi.pdf"),
                // ⭐ DOKLAD O ZAPLACENÍ VE VLASTNÍM MAILU (7. 8. 2026).
                // ⛔ Stripe zákaznické účtenky NEPOSÍLÁ. Ověřeno 7. 8. průchodem Martinova
                //    Gmailu: za dva týdny testovacích nákupů nedorazila ani jedna účtenka
                //    od Martina Barny, jen účtenky cizích firem a Stripe faktura ZA poplatky
                //    (ta je adresovaná jemu, ne zákazníkovi). Zapíná se to v dashboardu,
                //    kam se nikdo kromě Martina nedostane, takže doklad posíláme sami.
                // ⚠️ `amount_total` je v haléřích a MĚNÍ HO SLEVOVÝ KÓD, takže se bere
                //    ze session, ne z ceníku. Jinak by doklad tvrdil jinou částku, než
                //    kolik člověk reálně zaplatil.
                doklad_castka: castkaText(Number(obj.amount_total ?? 0), String(obj.currency ?? "czk")),
                doklad_datum: datumCesky(new Date().toISOString()),
                doklad_cislo: String(obj.id ?? "").slice(-12).toUpperCase(),
              };
            } catch (e) {
              await alertAdmin("🔴 Stripe: BALÍČEK zaplacen, ale odkazy ke stažení se nevygenerovaly", {
                email: emailL, chyba: String(e).slice(0, 200),
                co_delat: "⛔ Pošli mu kuchařku a e-book ručně. Zaplatil a nedostal nic.",
              });
              varsProUvitani = undefined;
            }
          }

          if (klic === "balicek" && !varsProUvitani) {
            // Uvítačka balíčku bez odkazů nemá smysl posílat, alert už odešel výš.
          } else {
            try { await posliUvitani(emailL, def.welcome, varsProUvitani); }
            catch (e) {
              await alertAdmin("Stripe: přístup udělen, ale uvítací e-mail selhal", {
                email: emailL, produkt: def.nazev, chyba: String(e).slice(0, 200),
              });
            }
          }
          // DOKLAD O ZAPLACENÍ: text i důvody jsou u funkce `posliDoklad` výš.
          // ⛔ Tady je jen PRVNÍ nákup. Opakovaný si doklad volá ve své větvi níž, protože
          //    peníze přišly i tam. Idempotenci dělají ta dvě volací místa, ne funkce sama.
          // ⚠️ Schválně BEZ podmínky na `varsProUvitani`: doklad je o PLATBĚ, ne o odkazech.
          //    Když se odkazy nevygenerují, člověk stejně zaplatil a doklad mu patří
          //    (a Martinovi o tom už odešel alert).
          if (klic === "balicek") doklad = await posliDoklad(emailL, obj);

          // ⭐ RUČNÍ KROK NA MARTINOVI. U konzultace nestačí udělit přístup: musí se ozvat
          // a domluvit termín. Bez tohohle upozornění by zákazník zaplatil 2 990 Kč
          // a čekal, dokud si toho někdo náhodou nevšimne v přehledu platieb.
          if (def.alertPoNakupu) {
            await alertAdmin(def.alertPoNakupu, {
              email: emailL,
              produkt: def.nazev,
              varianta: klic === "konzultace-vk" ? "2 190 Kč (videokurz už měl)" : "2 990 Kč (videokurz v ceně)",
              co_delat: "Ozvi se mu, domluv termín a pošli dotazník před hovorem.",
            });
          }

          // Až po udělení přístupu a jen u NOVÉHO nákupu, ať přehrání události Stripem
          // nezaloží druhý referral. Vlastní idempotenci má funkce i uvnitř.
          referral = await atribuujReferral(
            emailL, def.produkt,
            typeof obj.client_reference_id === "string" ? obj.client_reference_id : null,
            typeof obj.payment_intent === "string" ? obj.payment_intent : null,
          );
        }

        // ⭐⭐ OPAKOVANÝ NÁKUP BALÍČKU: PENÍZE PŘIŠLY, TAK SE MUSÍ NĚCO POSLAT.
        // ⛔ Do 6. 8. 2026 viselo celé doručení uvnitř `if (novyDozivotni)`. Kdo si balíček
        //    koupil podruhé, zaplatil 349 Kč, dostal HTTP 200 a NIC JINÉHO. U tohohle
        //    produktu to není okrajový případ: odkazy platí 14 dní a nejrychlejší reakce
        //    člověka, kterému vypršely, je koupit to znovu za tři stovky, ne psát Martinovi.
        // ⛔⛔ A NESTAČILO BY jen vytáhnout `posliUvitani` z té podmínky ven. `posliUvitani`
        //    postaví leada na krok 0 trati a spustí `drip-send`, jenže ten má deduplikaci
        //    `lead_id + step + type='sent' + detail->>track` (drip-send:634). U druhého
        //    nákupu ji NAJDE, mail PŘESKOČÍ a jen posune krok. Doručení proto musí jít
        //    mimo trať, přímo přes Resend. (Ověřeno čtením drip-send, ne odhadem.)
        // ⚠️ Idempotence: Stripe tutéž událost běžně doručuje víckrát. Rozhoduje
        //    `payment_intent`, ne „má už přístup". Táž platba = mlčet, nová platba = poslat.
        let balicekZnovu = klic === "balicek" && !novyDozivotni ? "neznamo" : "netyka-se";
        if (klic === "balicek" && !novyDozivotni) {
          const pi = typeof obj.payment_intent === "string"
            ? obj.payment_intent
            : (typeof obj.id === "string" ? obj.id : "");
          // ⛔⛔ PŘEHRÁNÍ PRVNÍHO NÁKUPU SE POZNÁ JEN PODLE `predchoziPi`, TEDY PODLE HODNOTY
          //    PŘEČTENÉ PŘED GRANTEM. Do 7. 8. 2026 se sem četlo `entitlements` ZNOVU, jenže
          //    `udelDozivotni` o pár řádků výš do toho sloupce právě zapsal SOUČASNOU platbu.
          //    Porovnání pak vyšlo na shodu vždycky, každý druhý nákup se vyhodnotil jako
          //    přehraná událost a NEODESLALO SE NIC. Martin to zaplatil naostro a nedostal
          //    ani mail, ani řádek v `email_events`. Pojistka porovnávala údaj sama se sebou.
          // Přehrání NĚKTERÉHO z opakovaných nákupů: stopa níž (ta se nepřepisuje).
          const { data: jizPoslano } = await admin.from("email_events")
            .select("id").eq("type", "balicek_znovu_doruceno").eq("detail->>payment_intent", pi).limit(1);

          if (!pi) {
            // Nemělo by nastat (`obj.id` je vždy), ale kdyby ano, člověk zaplatil a nedostal
            // nic. Tichý průchod je tady to nejhorší možné chování.
            balicekZnovu = "preskoceno-chybi-payment-intent";
            await alertAdmin("🔴 Stripe: BALÍČEK koupen znovu, ale CHYBÍ payment_intent", {
              email: emailL, session: String(obj.id ?? ""),
              co_delat: "⛔ Pošli mu soubory ručně. Zaplatil a automatika mu nic neposlala.",
            });
          } else if (predchoziPi === pi || (jizPoslano ?? []).length > 0) {
            balicekZnovu = "preskoceno-prehrana-udalost";
          } else {
            try {
              const podepis = async (soubor: string, jmenoProStazeni: string) => {
                const { data, error } = await admin.storage.from("videokurz-materialy")
                  .createSignedUrl(soubor, 14 * 24 * 3600, { download: jmenoProStazeni });
                if (error || !data?.signedUrl) throw new Error("signed_url:" + soubor);
                return data.signedUrl;
              };
              const kucharka = await podepis("Kucharka 40 + receptu.pdf", "Martin-Barna-Kucharka-40-receptu.pdf");
              const otazky = await podepis("Otazky klientu EBook.pdf", "Martin-Barna-48-odpovedi.pdf");
              if (!RESEND_KEY) throw new Error("missing_RESEND_API_KEY");
              const btn = (href: string, text: string) =>
                `<a href="${href}" style="display:inline-block;background:#EBB12C;color:#161616;`
                + `font-weight:700;text-decoration:none;padding:13px 26px;border-radius:50px;margin:6px 8px 6px 0">${text}</a>`;
              const res = await fetch("https://api.resend.com/emails", {
                method: "POST",
                headers: { Authorization: "Bearer " + RESEND_KEY, "Content-Type": "application/json" },
                body: JSON.stringify({
                  from: "Martin Barna <news@martinbarna.cz>",
                  to: [emailL],
                  reply_to: "martin@martinbarna.cz",
                  subject: "Posílám odkazy ke stažení znovu",
                  html:
                    `<div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;font-size:16px;line-height:1.55;color:#222;max-width:560px">`
                    + `<p>Dobrý den,</p>`
                    + `<p>objednávka na <b>40 receptů a 48 odpovědí</b> dorazila znovu. Nejspíš proto, `
                    + `že původní odkazy ke stažení mezitím vypršely. Tady jsou čerstvé, platí 14 dní:</p>`
                    + `<p>${btn(kucharka, "Stáhnout kuchařku")}${btn(otazky, "Stáhnout e-book")}</p>`
                    + `<p><b>Ulož si oba soubory rovnou do mobilu nebo do počítače.</b> Pak už je nebudeš `
                    + `potřebovat stahovat znovu, zůstanou ti navždy.</p>`
                    + `<p>A hlavně: kdyby ti odkaz zase vypršel, <b>nekupuj to podruhé</b>. Stačí odpovědět `
                    + `na tenhle e-mail a pošlu ti nové zdarma. Ohledně toho druhého nákupu se ti ozvu.</p>`
                    + `<p>Martin Barna<br>martinbarna.cz</p></div>`,
                }),
              });
              if (!res.ok) throw new Error("resend_" + res.status);
              await admin.from("email_events").insert({
                lead_id: null, step: 0, type: "balicek_znovu_doruceno",
                detail: { track: "onboarding-nakup-balicek", payment_intent: pi, email: emailL },
              });
              balicekZnovu = "ok";
              await alertAdmin("💸 Stripe: BALÍČEK koupen PODRUHÉ, odkazy odeslány znovu", {
                email: emailL, payment_intent: pi,
                co_delat: "⛔ Vrať mu 349 Kč (Stripe → Payments → tahle platba → Refund, celou částku). "
                  + "Zaplatil dvakrát za totéž, soubory už dostal. Mail mu slíbil, že se ozveš.",
              });
            } catch (e) {
              balicekZnovu = "CHYBA: " + String(e).slice(0, 120);
              await alertAdmin("🔴 Stripe: BALÍČEK koupen PODRUHÉ a odkazy se NEODESLALY", {
                email: emailL, chyba: String(e).slice(0, 200),
                co_delat: "⛔ Pošli mu kuchařku a e-book ručně A vrať mu 349 Kč. Zaplatil a nedostal nic.",
              });
            }
            // ⛔ DOKLAD I ZA DRUHOU PLATBU. Peníze přišly znovu, takže doklad patří znovu.
            //    Schválně až tady, mimo `try`: i když odkazy selhaly, platba proběhla.
            doklad = await posliDoklad(emailL, obj);
          }
        }

        return json({
          ok: true, email: emailL, produkt: def.produkt, jednorazove: klic,
          novy: novyDozivotni, tc_grant: tcGrant, zruseno_mesicni: zruseneMesicni,
          referral, bonus_videokurz: bonusVideokurz, balicek_znovu: balicekZnovu,
          doklad,
        });
      }

      if (obj.mode !== "subscription") {
        return json({ ok: true, ignorovano: "ne-predplatne" });
      }
      // ⛔ Jen platby z NAŠICH Payment Linků. Session z appky (VIP/Basic) sem taky
      // dorazí, protože účet je společný, a bez tohohle by zakládala Academy zdarma.
      // Tiché ignorování, ne alert: platby za appku jsou v pořádku, jen nejsou naše.
      const plink = typeof obj.payment_link === "string" ? obj.payment_link : "";
      if (!ALLOWED_PLINKS.includes(plink)) {
        return json({ ok: true, ignored: "foreign-price", payment_link: plink || null });
      }
      const email = String(
        obj.customer_details?.email ?? obj.customer_email ?? "",
      ).trim().toLowerCase();
      if (!email) {
        await alertAdmin("Stripe: zaplaceno, ale chybí e-mail", {
          session: obj.id,
          poznamka: "Přístup NEUDĚLEN. V Payment Linku musí být e-mail povinný.",
        });
        return json({ error: "no-email" }, 422);
      }

      // Prozatímní přístup. `invoice.paid` dorazí vzápětí a nahradí ho přesným
      // koncem období. Kdyby nedorazila, člen i tak měsíc dovnitř může.
      // Poslední argument `true` = PROVIZORNÍ. Nesmí zkrátit expiraci, kterou už
      // případně zapsala `invoice.paid` (Stripe pořadí událostí negarantuje).
      const prvni = await udelPristup(email, zaDni(PROVIZORNI_DNI), {
        customer: typeof obj.customer === "string" ? obj.customer : null,
        subscription: typeof obj.subscription === "string" ? obj.subscription : null,
      }, true);
      if (prvni) {
        try { await posliUvitani(email); }
        catch (e) {
          await alertAdmin("Stripe: přístup udělen, ale uvítací e-mail selhal", {
            email, chyba: String(e).slice(0, 200),
          });
        }
      }
      return json({ ok: true, email, prvni });
    }

    // --- 2) Zaplacená faktura: první i každá další obnova ------------------
    if (typ === "invoice.paid" || typ === "invoice.payment_succeeded") {
      // ⛔ Jen faktury za NAŠI cenu nebo náš produkt. Faktura za appkové VIP/Basic
      // sem dorazí taky (společný účet) a bez tohohle by zakládala Academy zdarma.
      const { ceny, produkty } = cenyAProdukty(obj.lines);
      const nase = ceny.some((c) => ALLOWED_PRICES.includes(c)) ||
                   produkty.some((p) => ALLOWED_PRODUCTS.includes(p));
      if (!nase) {
        return json({ ok: true, ignored: "foreign-price", ceny, produkty });
      }

      const email = String(
        obj.customer_email ?? obj.customer_details?.email ?? "",
      ).trim().toLowerCase();
      if (!email) {
        await alertAdmin("Stripe: faktura zaplacena, ale chybí e-mail", {
          invoice: obj.id, poznamka: "Přístup NEPRODLOUŽEN, spárovat ručně.",
        });
        return json({ error: "no-email" }, 422);
      }

      // ⛔ DOŽIVOTNÍHO ČLENA TAHLE VĚTEV NESMÍ POTKAT. Kdyby Stripe k jednorázové
      // platbě 8 900 vystavil fakturu, doputovala by sem a `udelPristup` by
      // doživotnímu členovi zapsal expiraci. Pojistka v `udelPristup` sice degradaci
      // zachytí, ale zakřičí alertem u KAŽDÉHO doživotního nákupu, takže by z ní
      // rychle byl šum, který nikdo nečte. Radši tiše a přesně tady.
      {
        const { data: dozivotni } = await admin
          .from("entitlements").select("source, expires_at, active")
          .eq("email", email).eq("product", "academy").maybeSingle();
        if (dozivotni?.active && dozivotni.expires_at === null) {
          return json({ ok: true, ignored: "lifetime", email });
        }
      }

      // Konec zaplaceného období + grace.
      // ⚠️ Bereme NEJPOZDĚJŠÍ `period.end` ze VŠECH řádků faktury, ne `data[0]`.
      // Faktura předplatného může nést víc řádků (proporcionální dopočet při změně
      // plánu, sleva, jednorázová položka) a pořadí není zaručené. Kdyby se vzal
      // první řádek a byl to proration za pár dní, členovi by přístup vypršel
      // uprostřed zaplaceného měsíce.
      // Tvar pole ověřen proti Stripe API 2026-06-24.dahlia (lines.data[].period.end
      // v ní pořád existuje). Pozn.: `invoice.subscription` se v novějších verzích
      // přesunul pod `parent.subscription_details.subscription`, my ho nečteme.
      const konceS: number[] = Array.isArray(obj.lines?.data)
        ? obj.lines.data.map((l: { period?: { end?: number } }) => Number(l?.period?.end ?? 0))
            .filter((n: number) => Number.isFinite(n) && n > 0)
        : [];
      const konecS = konceS.length ? Math.max(...konceS) : 0;
      const expirace = konecS > 0
        ? new Date(konecS * 1000 + GRACE_DNI * 86400000).toISOString()
        : zaDni(PROVIZORNI_DNI);
      if (konecS === 0) {
        await alertAdmin("Stripe: faktura bez období, dáno provizorních 35 dní", {
          email: String(obj.customer_email ?? ""), invoice: obj.id,
          poznamka: "Zkontroluj tvar lines.data[].period.end proti verzi API.",
        });
      }

      // ⚠️ `invoice.subscription` v novějších verzích API NEEXISTUJE, přesunulo se pod
      // `parent.subscription_details.subscription` (ověřeno proti 2026-06-24.dahlia).
      // Čteme obě cesty, ať to nespadne při změně verze ani jedním směrem.
      const subId = obj.parent?.subscription_details?.subscription ?? obj.subscription ?? null;
      const prvni = await udelPristup(email, expirace, {
        customer: typeof obj.customer === "string" ? obj.customer : null,
        subscription: typeof subId === "string" ? subId : null,
      });

      // ⛔ ODSUD SE UVÍTAČKA NEPOSÍLÁ NIKDY (oprava 28. 7. 2026).
      // Při prvním nákupu dorazí `checkout.session.completed` i `invoice.paid`
      // pár vteřin po sobě a OBA volaly `posliUvitani`. Ten resetuje leada na step 0
      // a hned kopne do `drip-send`, jenže jeho dedupe je check-then-act, takže druhý
      // invoke stihl projít kontrolou a mail ODEŠEL PODRUHÉ. Teprve jeho zápis spadl
      // na unique a spolkl se. ⚠️ Proto to v `email_events` NENÍ VIDĚT: DB ukazuje
      // jeden 'sent', ale ve schránce byly dva maily (18:02:22 a 18:02:25, ověřeno
      // v Gmailu). Nepřítomnost záznamu není důkaz, že se akce nestala.
      // Věcně to sedí i bez toho závodu: `invoice.paid` je ZAPLACENÁ FAKTURA, tedy
      // i obnova. Uvítačka patří k nákupu, ne k obnově.
      // (Hlubší oprava dedupe v drip-send, tedy insert PŘED odesláním, je samostatný úkol.)
      // ⛔ TADY DŘÍV BYL ALERT „přístup udělen z faktury BEZ uvítacího e-mailu" A LHAL.
      // Vycházel z úvahy „když je `prvni`, checkout nedorazil". Jenže Stripe pořadí
      // událostí NEGARANTUJE: 29. 7. 2026 dorazila `invoice.paid` o pět vteřin DŘÍV
      // než `checkout.session.completed`, alert vyskočil a poslal Martina posílat
      // uvítačku ručně, přestože odešla sama hned nato.
      // Závod tady rozhodnout NEJDE, obě události chodí v řádu vteřin a v okamžiku
      // faktury o té druhé nevíme nic. Proto se to neřeší tady, ale odloženě
      // v `daily-digest`: ten se jednou denně zeptá „kdo má aktivní členství a nedostal
      // uvítačku", nezávodí s ničím a mlčí, když je vše v pořádku.
      // ⚠️ Poučení nad rámec tohohle místa: alert, který jednou zalže, se přestane číst,
      // a pak nezafunguje ani ve chvíli, kdy má pravdu.
      return json({ ok: true, email, expirace, prvni });
    }

    // --- 3) Selhaná platba: NIC nezamykáme --------------------------------
    // Grace v `expires_at` pokryje Stripe Smart Retries. Když se karta nakonec
    // nestrhne, přístup vyprší sám. Aktivní revoke by byl křehčí.
    // --- 2b) REFUND a SPOR: odebrat přístup a zastavit další strhávání --------
    // Martin klikne refund tam, kde jsou peníze, a zbytek dodělá tohle.
    // ⛔ Párujeme podle `stripe_customer_id`, NE podle e-mailu. Academy i appka jedou
    //    na jednom Stripe účtu, takže podle e-mailu by refund za appku mohl sebrat
    //    Academy témuž člověku. Cizí platba se sem dostane taky a musí projít bez efektu.
    if (typ === "charge.refunded" || typ === "charge.dispute.created") {
      const jeSpor = typ === "charge.dispute.created";
      // U sporu je v `data.object` Dispute, u refundu Charge. Zákazník je na obou.
      // ⛔⛔ PÁRUJEME PODLE DVOU IDENTIFIKÁTORŮ, PROTOŽE KAŽDÁ VARIANTA MÁ JINÝ.
      // Předplatné: Stripe vždycky založí zákazníka ⇒ `customer`.
      // Jednorázová platba (`mode=payment`): zákazníka NEZAKLÁDÁ ⇒ jediné, co spojuje
      // nákup s refundem, je `payment_intent`.
      // ⚠️ 29. 7. 2026 tady stálo jen to první a doživotní refund proto TIŠE NEUDĚLAL NIC:
      // vrácených 8 900 Kč a zákazník si nechal Academy navždy i appku na rok.
      const SLOUPCE_ENT = "email, product, source, expires_at, stripe_subscription_id";
      const zakaznik = typeof obj.customer === "string" ? obj.customer : "";
      const platba = typeof obj.payment_intent === "string" ? obj.payment_intent : "";
      if (!zakaznik && !platba) return json({ ok: true, ignored: "bez-identifikatoru" });

      // ⛔⛔ PÁROVACÍ KLÍČ JE PLATBA, NE PRODUKT. Do 30. 7. 2026 bylo v obou dotazech
      // `.eq("product","academy")` a refund VIDEOKURZU proto TIŠE NEUDĚLAL NIC: nic nenašel,
      // vyhodnotil to jako „cizí platba", vrátil 200 a zákazník si po vrácení peněz nechal
      // doživotní přístup. Nevyskočil ani alert, protože i záchranná síť níž byla
      // filtrovaná na `academy`. Viz paměť `feedback-novy-produkt-projdi-i-cesty-odchodu`.
      //
      // ⚠️ POŘADÍ JE ZÁMĚRNÉ: nejdřív `payment_intent`, protože ten je pro každou platbu
      // JEDINEČNÝ, takže nemůže být dvojznačný. `stripe_customer_id` naopak Stripe u téhož
      // e-mailu recykluje, takže po zrušení filtru na produkt může padnout na VÍC řádků
      // (kdo koupí Academy i videokurz). Proto se u něj nehádá: jeden aktivní řádek se
      // odebere, u víc řádků se KŘIČÍ a nechá se to na člověku. Špatně odebraný přístup
      // je horší než neodebraný, protože o něj přijde platící zákazník.
      // deno-lint-ignore no-explicit-any
      let ent: any = null;
      let dvojznacne: string[] = [];
      if (platba) {
        const { data } = await admin.from("entitlements").select(SLOUPCE_ENT)
          .eq("stripe_payment_intent", platba).maybeSingle();
        ent = data ?? null;
      }
      if (!ent && zakaznik) {
        const { data } = await admin.from("entitlements").select(SLOUPCE_ENT)
          .eq("stripe_customer_id", zakaznik).eq("active", true);
        const radky = data ?? [];
        if (radky.length === 1) ent = radky[0];
        else if (radky.length > 1) dvojznacne = radky.map((r: { product: string }) => r.product);
      }

      if (dvojznacne.length > 1) {
        await alertAdmin("🔴 Stripe: refund se spároval na VÍC produktů, přístup NEODEBRÁN", {
          zakaznik,
          platba: platba || "(žádná)",
          nalezene_produkty: dvojznacne.join(", "),
          co_delat: "⛔ Automatika schválně nehádala, který přístup odebrat. Odeber ten správný "
            + "ručně v adminu. Nastalo to proto, že týž zákazník má víc aktivních produktů "
            + "a refund nenesl `payment_intent`, podle kterého se páruje jednoznačně.",
        });
        return json({ ok: true, odebrano: false, duvod: "dvojznacne-parovani", produkty: dvojznacne });
      }

      if (!ent) {
        // Není náš zákazník (typicky refund předplatného appky). Ticho je tu SPRÁVNÉ,
        // takových refundů chodí spousta a alert by se z nich stal šum.
        // ⭐ ALE: než mlčky odejdeme, zkusíme e-mail z platby jako POSLEDNÍ pojistku.
        // ⛔ Podle e-mailu se nikdy NEJEDNÁ (Academy a appka sdílí Stripe účet, takže
        // refund appky by sebral Academy), jen se KŘIČÍ. Tím se tahle třída chyby příště
        // pozná do minuty místo až z reklamace, a přitom nehrozí špatné odebrání.
        const emailZPlatby = String(
          obj.billing_details?.email ?? obj.receipt_email ?? "",
        ).trim().toLowerCase();
        if (emailZPlatby) {
          // ⛔ BEZ FILTRU NA PRODUKT. Dokud tu stálo `product = "academy"`, byla tahle
          // pojistka u každého jiného produktu MRTVÁ, a to je horší než žádná: vypadá,
          // že je hlídáno. `limit(1)` stačí, protože se tady jen křičí, nesahá se na nic.
          const { data: podleMailu } = await admin.from("entitlements")
            .select("email, product, source, expires_at")
            .eq("email", emailZPlatby).eq("active", true).limit(1).maybeSingle();
          if (podleMailu) {
            await alertAdmin("🔴 Stripe: refund se NESPÁROVAL, ale e-mail sedí na aktivní přístup", {
              email: emailZPlatby,
              produkt: podleMailu.product,
              zdroj: podleMailu.source,
              zakaznik: zakaznik || "(žádný)",
              platba: platba || "(žádná)",
              co_delat: "⛔ PŘÍSTUP NEBYL ODEBRÁN. Odeber ho ručně v adminu a nahlas to, "
                + "protože párování mělo zafungovat samo.",
            });
          }
        }
        return json({ ok: true, ignored: "not-ours", zakaznik: zakaznik || null, platba: platba || null });
      }

      // ⚠️ ČÁSTEČNÝ REFUND PŘÍSTUP NEODEBÍRÁ. Vrácení 200 Kč z 990 není konec
      // členství a automatika by tu rozhodovala o něčem, co neví. Jen upozorníme.
      const castka = Number(obj.amount ?? 0);
      const vraceno = Number(obj.amount_refunded ?? 0);
      if (!jeSpor && castka > 0 && vraceno > 0 && vraceno < castka) {
        await alertAdmin("Stripe: ČÁSTEČNÝ refund, přístup NECHÁN beze změny", {
          email: ent.email, vraceno_haleru: vraceno, celkem_haleru: castka,
          poznamka: "Rozhodni ručně. Automatika u částečného refundu přístup neodebírá.",
        });
        return json({ ok: true, castecny_refund: true, odebrano: false });
      }

      // 1) zastavit další strhávání
      // ⛔ U DOŽIVOTNÍ VARIANTY SE TENHLE KROK PŘESKAKUJE. Jednorázová platba žádné
      // předplatné nemá, takže není co rušit. A kdo přešel z měsíčního na doživotní,
      // má v řádku ID předplatného, které jsme mu zrušili UŽ PŘI TOM UPGRADU; druhý
      // pokus by Stripe odmítl a my bychom z toho vyrobili falešný poplach.
      const jeDozivotni = ent.source === "stripe-lifetime";
      // Který katalogový produkt to byl, poznáme podle `source`. Slouží jen k pojmenování
      // produktu v rozlučkovém mailu, na logiku odebírání to nemá vliv.
      // ⚠️ Měsíční Academy (`stripe-monthly`) v katalogu NENÍ (ten je jen pro jednorázové
      // platby), takže tady vyjde `undefined` a použije se fallback. To je správně.
      const katalogZdroje = Object.values(KATALOG).find((p) => p.source === ent.source);
      // ⚠️ `KATALOG` obsahuje VÝHRADNĚ jednorázové produkty, takže „našel jsem ho tam"
      // je zároveň odpověď na otázku „může tenhle produkt vůbec mít předplatné?".
      const jeJednorazovy = !!katalogZdroje;
      const nazevProduktu = katalogZdroje?.nazev ?? "Barna Academy";
      const variantaProduktu = katalogZdroje?.varianta ?? (jeDozivotni ? "doživotní přístup" : "měsíční členství");
      let zruseno = jeDozivotni ? "nema-predplatne" : "nebylo-co";
      if (!jeDozivotni && ent.stripe_subscription_id) {
        if (!STRIPE_SUBS_KEY) {
          zruseno = "CHYBI-KLIC";
        } else {
          try {
            const r = await fetch(
              "https://api.stripe.com/v1/subscriptions/" + encodeURIComponent(ent.stripe_subscription_id),
              { method: "DELETE", headers: { Authorization: "Bearer " + STRIPE_SUBS_KEY } },
            );
            if (r.ok) zruseno = "ok";
            else {
              // ⚠️ UKLÁDÁME I TĚLO ODPOVĚDI, ne jen číslo. 28. 7. 2026 přišlo 404
              // a musel jsem příčinu dedukovat z dokumentace, protože jsme měli
              // jen stavový kód. Stripe v těle posílá `error.code` (např.
              // `resource_missing` = objekt v tomhle režimu klíče neexistuje, typicky
              // test klíč na live objekt) a u málo práv i jmenovitě chybějící scope.
              // Nestačí vědět, ŽE to selhalo. Musí být poznat PROČ.
              const telo = await r.text().catch(() => "");
              zruseno = "http-" + r.status + " " + telo.slice(0, 200);
            }
          } catch (e) { zruseno = "chyba-" + String(e).slice(0, 60); }
        }
      }

      // 2) odebrat přístup (expirace na teď, řádek necháváme kvůli historii)
      // Jeden časový otisk pro zápis do DB i pro text mailu, ať se nemůžou rozejít.
      const konecIso = new Date().toISOString();
      // ⛔ `ent.product`, NE natvrdo "academy". Odebírá se ten produkt, který je na
      // nalezeném řádku, tedy ten, za který se opravdu vracely peníze. Natvrdo napsaný
      // produkt tady 30. 7. 2026 způsobil, že refund videokurzu neodebral vůbec nic.
      const { error: chybaRevoke } = await admin
        .from("entitlements")
        .update({ expires_at: konecIso })
        .eq("email", ent.email).eq("product", ent.product);

      // 2b) ⭐ REFUND KONZULTACE ODEBÍRÁ I BONUSOVÝ VIDEOKURZ, ALE JEN TEN BONUSOVÝ.
      // ⛔⛔ Podmínka na `source` je tu to jediné, co chrání zaplacený kurz. Kdo si
      // videokurz koupil zvlášť za 800 Kč (`stripe-videokurz` / `simpleshop`) a pak si
      // koupil konzultaci za 2 190, MUSÍ si kurz po refundu konzultace nechat. Bez téhle
      // podmínky by mu ho vrácení peněz za jinou věc sebralo, a byla by to tichá krádež
      // zaplaceného obsahu.
      let bonusOdebran = "netyka-se";
      if (ent.product === "konzultace") {
        const { data: bonus, error: chybaBonus } = await admin
          .from("entitlements")
          .update({ expires_at: konecIso })
          .eq("email", ent.email)
          .eq("product", "videokurz")
          .eq("source", ZDROJ_BONUS_VIDEOKURZ)
          .select("email");
        bonusOdebran = chybaBonus
          ? "CHYBA: " + chybaBonus.message
          : ((bonus?.length ?? 0) > 0 ? "ok" : "nebyl-bonusovy");
        if (chybaBonus) {
          await alertAdmin("🔴 Stripe: refund konzultace, ale bonusový videokurz se NEODEBRAL", {
            email: ent.email, chyba: chybaBonus.message,
            co_delat: "⛔ Odeber mu videokurz ručně v adminu. ⚠️ ALE NEJDŘÍV ZKONTROLUJ "
              + "`source`: pokud je `stripe-videokurz` nebo `simpleshop`, kurz si koupil "
              + "sám a MUSÍ mu zůstat.",
          });
        }
      }

      // 2c) ⭐ UZAVŘÍT PODANÉ ODSTOUPENÍ OD SMLOUVY (doplněno 7. 8. 2026).
      // `withdrawals.status` má default `'pending'` a do dneška ho NIKDO nikdy nepřepsal
      // na hotovo, protože k tomu neexistovala žádná cesta. Denní přehled přitom počítá
      // `status='pending'` jako „čeká na vyřízení", takže by po prvním odstoupení křičel
      // napořád a Martin by si na ten alert zvykl a přestal ho číst. Nejhorší druh alertu.
      // ⭐ Refund je přesně ten okamžik, kdy je odstoupení vyřízené: peníze jsou zpátky.
      // ⚠️ Zavírají se jen `pending` řádky téhož e-mailu. Když jich je víc (člověk může
      //    odstoupit od víc produktů), zavřou se všechny čekající, a to je správně.
      // ⚠️ Sloupec `resolved_at` NEEXISTUJE, ověřeno proti schématu před zápisem.
      //    Zápis do neexistujícího sloupce by tenhle blok tiše proměnil v no-op.
      // ⚠️ Best-effort: nesmí shodit odebrání přístupu ani rozlučkový mail.
      let odstoupeniUzavreno = "nic-necekalo";
      try {
        const { data: uzavrena, error: chybaW } = await admin.from("withdrawals")
          .update({ status: "resolved" })
          .eq("email", ent.email).eq("status", "pending")
          .select("id");
        odstoupeniUzavreno = chybaW
          ? "CHYBA: " + chybaW.message
          : ((uzavrena?.length ?? 0) > 0 ? "uzavreno-" + uzavrena!.length : "nic-necekalo");
      } catch (e) { odstoupeniUzavreno = "chyba-" + String(e).slice(0, 60); }

      // 3) rozlučkový mail (best-effort, nikdy nesmí shodit odebrání)
      // Po refundu odebíráme přístup ihned, takže vyjde větev „hned". Volba je tu
      // přesto dynamická, ať to sedí i kdyby se sem někdy dostalo zrušení s dojezdem.
      // ⛔ `vars` NENÍ volitelná ozdoba, bez nich mail neodejde. Viz `castkaText`.
      // U sporu je v `obj` Dispute (má `amount`, nemá `amount_refunded`), proto ten fallback.
      try {
        await posliUvitani(ent.email, rozlouceniTrack(konecIso), {
          castka: castkaText(vraceno > 0 ? vraceno : castka, String(obj.currency ?? "czk")),
          // ⛔ Název i varianta jdou Z KATALOGU podle `source`, ne natvrdo. Jinak by
          // kupující videokurzu dostal mail o vrácení „Barna Academy, doživotní přístup",
          // tedy o produktu, který si nikdy nekoupil.
          // ⚠️ Fallback drží PŮVODNÍ chování u měsíční Academy (`stripe-monthly`), která
          // v katalogu jednorázových produktů schválně není.
          produkt: nazevProduktu,
          // ⚠️ Popis varianty se řídí ZDROJEM, ne odhadem. Doživotnímu členovi napsat
          // „měsíční členství" by v mailu o vrácení peněz vypadalo, že nevíme, co mu rušíme.
          varianta: variantaProduktu,
          znovu_odkaz: "https://martinbarna.cz/akademie/#cena",
          pristup_do: datumCesky(konecIso),
        });
      } catch { /* best-effort, nikdy nesmí shodit odebrání přístupu */ }

      // 3b) DOŽIVOTNÍ MĚL V CENĚ APPKU NA ROK ⇒ při vrácení peněz se odebírá taky.
      // Měsíční ji nikdy nedostal, takže se u něj nesahá na nic. Vzor 1:1 podle storno
      // větve `simpleshop-webhook`. Best-effort, odebrání Academy nesmí shodit.
      let tcRevoke = "netyka-se";
      if (jeDozivotni) {
        tcRevoke = "no-secret";
        try {
          const { data: gs } = await admin
            .from("app_config").select("value").eq("key", "academy_grant_secret").maybeSingle();
          const gsec = gs?.value ? String(gs.value) : "";
          if (gsec) {
            const r = await fetch("https://kfkmghvhqwqtsalqjmrp.functions.supabase.co/academy-grant", {
              method: "POST",
              headers: { "Content-Type": "application/json", "x-academy-secret": gsec },
              body: JSON.stringify({
                email: ent.email, action: "revoke",
                source: "academy-storno", academy_order_id: null,
              }),
            }).catch(() => null);
            if (r && r.ok) {
              const jj = await r.json().catch(() => ({}));
              tcRevoke = String((jj as { result?: string }).result || "ok");
            } else tcRevoke = r ? "http-" + r.status : "fetch-fail";
          }
          await admin.from("tvujcoach_grants")
            .insert({ email: ent.email, action: "revoke", result: tcRevoke, source: "academy-storno" });
        } catch { /* best-effort */ }
      }

      // 4) hlásit. U sporu a u nezrušeného předplatného VŽDY, jinak by to zůstalo tiché.
      // ⚠️ „nema-predplatne" u doživotní varianty NENÍ chyba, je to očekávaný stav.
      // Bez téhle výjimky by alert chodil po KAŽDÉM vrácení doživotní platby a rychle
      // by z něj byl šum, který nikdo nečte. Alert má křičet jen tam, kde je co dělat.
      // ⛔ A „nebylo-co" NENÍ chyba u JEDNORÁZOVÉHO produktu, protože ten předplatné mít
      // nemůže. Do 30. 7. 2026 tady ta výjimka chyběla jen pro doživotní Academy, takže
      // refund VIDEOKURZU vyhodil falešný poplach po každém vrácení peněz, a k tomu
      // s cizím názvem produktu („refund Academy"). Falešný alert je vlastní druh škody:
      // pár jich stačí, aby se alerty přestaly číst, a pak zapadne i ten skutečný.
      // ⚠️ Plošně „nebylo-co" povolit NELZE: u měsíčního členství, kterému chybí ID
      // předplatného, je to naopak správný poplach. Proto ta podmínka na jednorázovost.
      const zruseniSelhalo = zruseno !== "ok" && zruseno !== "nema-predplatne"
                             && !(jeJednorazovy && zruseno === "nebylo-co");
      const tcRevokeSelhal = jeDozivotni && tcRevoke !== "ok" && tcRevoke !== "granted"
                             && tcRevoke !== "revoked" && tcRevoke !== "pending";
      if (jeSpor || zruseniSelhalo || chybaRevoke || tcRevokeSelhal) {
        await alertAdmin(
          jeSpor ? "🔴 Stripe: SPOR (chargeback) u " + nazevProduktu + ", přístup odebrán"
                 : "Stripe: refund " + nazevProduktu + ", ale něco se nedotáhlo",
          {
            email: ent.email,
            produkt: nazevProduktu,
            varianta: variantaProduktu,
            zruseni_predplatneho: zruseno,
            odebrani_pristupu: chybaRevoke ? "SELHALO: " + chybaRevoke.message : "ok",
            odebrani_appky: tcRevoke,
            co_delat: zruseno === "CHYBI-KLIC"
              ? "⛔ ZRUŠ PŘEDPLATNÉ RUČNĚ VE STRIPU. Chybí STRIPE_RESTRICTED_SUBS_KEY."
              : (tcRevokeSelhal ? "⛔ ODEBER PŘÍSTUP DO APPKY RUČNĚ v adminu appky."
              : (jeSpor ? "Spor lze u banky vyhrát. Když vyhraješ, vrať přístup ručně." : "Zkontroluj ve Stripu.")),
          },
        );
      }

      return json({
        ok: true, typ, email: ent.email,
        produkt: ent.product,
        varianta: jeDozivotni ? "dozivotni" : "mesicni",
        zruseno_predplatne: zruseno,
        pristup_odebran: !chybaRevoke,
        odebrani_appky: tcRevoke,
        bonus_videokurz_odebran: bonusOdebran,
        odstoupeni_uzavreno: odstoupeniUzavreno,
      });
    }

    if (typ === "invoice.payment_failed") {
      const email = String(obj.customer_email ?? "").trim().toLowerCase();
      await alertAdmin("Stripe: selhala platba měsíčního členství", {
        email, invoice: obj.id, poznamka: `Nezamykáme, grace ${GRACE_DNI} dní, pak vyprší samo.`,
      });
      return json({ ok: true, poznamka: "logovano" });
    }

    // --- 4) Zrušení předplatného: taky NIC --------------------------------
    // Zákazník má zaplaceno do konce období, tak ho tam necháme dojet.
    if (typ === "customer.subscription.deleted") {
      return json({ ok: true, poznamka: "expirace dojede sama" });
    }

    return json({ ok: true, ignorovano: typ });
  } catch (e) {
    // Stripe při nenulovém statusu zkusí událost poslat znovu, což je žádoucí.
    await alertAdmin("Stripe webhook: neošetřená chyba", {
      typ, chyba: String(e).slice(0, 300),
    });
    return json({ error: "internal" }, 500);
  }
});
