// Testy výběru připomínky konzultace. Bez sítě, bez DB, bez Deno permissions.
// Spuštění: npx --yes deno@2 run akademie/_supabase/functions/konzultace-pripominka/vyber.test.ts
//
// ⭐ KAŽDÝ TEST MÁ KONTRAST: ke každému „pošle se" je i „nepošle se", jinak by prošla
//    i funkce, která vrací pořád totéž (pravidlo `feedback-zeleny-test-neni-dukaz-spravnosti`).
import {
  coPoslat,
  denPo,
  neposilatKlientovi,
  prazskeDatum,
  type Radek,
  sloupecRazitka,
} from "./vyber.ts";

let selhalo = 0;
function check(nazev: string, podminka: boolean, detail = ""): void {
  if (podminka) console.log("  ok   " + nazev);
  else {
    selhalo++;
    console.log("  FAIL " + nazev + (detail ? "  [" + detail + "]" : ""));
  }
}

// Běh cronu: 5:40 UTC = 7:40 pražského času (letní čas).
const TED = Date.parse("2026-09-17T05:40:00Z");
const DNES_15 = "2026-09-17T13:00:00Z"; // 15:00 Prahy
const ZITRA_15 = "2026-09-18T13:00:00Z";
const POZITRI_15 = "2026-09-19T13:00:00Z";
const DNES_RANO = "2026-09-17T04:00:00Z"; // 6:00 Prahy, tedy PŘED během cronu

function r(x: Partial<Radek>): Radek {
  return {
    email: "kupec@example.com",
    termin_at: null,
    pripominka_den_pred_pro: null,
    pripominka_rano_pro: null,
    ...x,
  };
}

function main(): void {
  console.log("\n== kdy se připomínka pošle a kdy NE ==");
  check("zítra bez razítka → den_pred", coPoslat(r({ termin_at: ZITRA_15 }), TED) === "den_pred");
  check("KONTRAST: zítra s razítkem na týž termín → nic",
    coPoslat(r({ termin_at: ZITRA_15, pripominka_den_pred_pro: ZITRA_15 }), TED) === null);

  check("dnes bez razítka → rano", coPoslat(r({ termin_at: DNES_15 }), TED) === "rano");
  check("KONTRAST: dnes s ranním razítkem → nic",
    coPoslat(r({ termin_at: DNES_15, pripominka_rano_pro: DNES_15 }), TED) === null);

  check("dnes, včera odešla den_pred → dnes ještě rano",
    coPoslat(r({ termin_at: DNES_15, pripominka_den_pred_pro: DNES_15 }), TED) === "rano");
  check("KONTRAST: dnes, obě razítka → nic",
    coPoslat(r({ termin_at: DNES_15, pripominka_den_pred_pro: DNES_15, pripominka_rano_pro: DNES_15 }), TED) === null);

  console.log("\n== co se NEpřipomíná ==");
  check("pozítří → nic (ještě není čas)", coPoslat(r({ termin_at: POZITRI_15 }), TED) === null);
  check("hovor už proběhl dnes ráno → nic", coPoslat(r({ termin_at: DNES_RANO }), TED) === null);
  check("bez termínu → nic", coPoslat(r({ termin_at: null }), TED) === null);
  check("nesmyslný termín → nic (a ne výjimka)", coPoslat(r({ termin_at: "nesmysl" }), TED) === null);

  console.log("\n== přesunutý termín se musí připomenout znovu ==");
  // Martin přesune hovor ze zítřka na pozítří a zase zpět na zítřek, razítko drží STARÝ termín.
  check("razítko na JINÝ termín neplatí → pošle se znovu",
    coPoslat(r({ termin_at: ZITRA_15, pripominka_den_pred_pro: POZITRI_15 }), TED) === "den_pred");
  check("KONTRAST: razítko na týž okamžik v jiném zápisu (+00:00) platí",
    coPoslat(r({ termin_at: ZITRA_15, pripominka_den_pred_pro: "2026-09-18T13:00:00+00:00" }), TED) === null);

  console.log("\n== pražský čas a přelom dne ==");
  // 22:30 UTC 17. 9. = 0:30 pražského 18. 9. ⇒ hovor patří do ZÍTŘKA, ne do dneška.
  check("večerní UTC termín patří do pražského zítřka",
    coPoslat(r({ termin_at: "2026-09-17T22:30:00Z" }), TED) === "den_pred");
  check("KONTRAST: týž okamžik brán jako dnešek by dal rano (kontrola dat testu)",
    prazskeDatum(Date.parse("2026-09-17T22:30:00Z")) === "2026-09-18");
  check("prazskeDatum běhu je 17. 9.", prazskeDatum(TED) === "2026-09-17");

  console.log("\n== denPo: den, ne 24 hodin ==");
  check("běžný den", denPo("2026-09-17") === "2026-09-18");
  check("konec měsíce", denPo("2026-09-30") === "2026-10-01");
  check("přechod na zimní čas (25hodinový den)", denPo("2026-10-24") === "2026-10-25");
  check("přestupný rok", denPo("2028-02-28") === "2028-02-29");

  console.log("\n== razítko míří do správného sloupce ==");
  check("den_pred", sloupecRazitka("den_pred") === "pripominka_den_pred_pro");
  check("KONTRAST: rano", sloupecRazitka("rano") === "pripominka_rano_pro");

  console.log("\n== komu se klientsky mail NIKDY neposila (R1, nalez N3) ==");
  check("Martinova hlavni adresa", neposilatKlientovi("martin@martinbarna.cz") === "martinova_adresa");
  check("fitness.barna@gmail.com", neposilatKlientovi("fitness.barna@gmail.com") === "martinova_adresa");
  check("znackovana varianta +konzultace",
    neposilatKlientovi("fitness.barna+konzultace@gmail.com") === "martinova_adresa");
  check("velka pismena a mezery kolem", neposilatKlientovi("  Martin@MartinBarna.cz ") === "martinova_adresa");
  check("vyhrazena domena example.com", neposilatKlientovi("kdokoli@example.com") === "testovaci_domena");
  check("vyhrazena domena example.net (doplnila revize R2)",
    neposilatKlientovi("kdokoli@example.net") === "testovaci_domena");
  check("vyhrazena TLD .invalid", neposilatKlientovi("kdokoli@neco.invalid") === "testovaci_domena");
  check("KONTRAST: bezna domena s example ve jmenu projde",
    neposilatKlientovi("kdokoli@examplemarket.cz") === null);
  check("KONTRAST: .cz domena konci jinak nez vyhrazena TLD",
    neposilatKlientovi("kdokoli@testovani.cz") === null);
  check("prazdna adresa", neposilatKlientovi("") === "prazdna_adresa");
  check("KONTRAST: bezny zakaznik projde", neposilatKlientovi("novak@seznam.cz") === null);
  check("KONTRAST: jina adresa na martinbarna.cz projde",
    neposilatKlientovi("info@martinbarna.cz") === null);
  check("KONTRAST: podobna adresa, ktera Martinova NENI",
    neposilatKlientovi("fitness.barnova@gmail.com") === null);
  check("KONTRAST: rodinna adresa projde, je to provozni mail o zaplacene sluzbe",
    neposilatKlientovi("ivanabarnova@seznam.cz") === null);

  console.log(selhalo === 0 ? "\nVSE ZELENE\n" : `\n${selhalo} SELHANI\n`);
  if (selhalo > 0) throw new Error(String(selhalo) + " selhani");
}

main();
