// ============================================================================
// ZAPIŠ, PAK POŠLI: statická kontrola pořadí v `client-remind` (17. 9. 2026, nález V3)
// Spuštění:
//   npx --yes deno@2 run --allow-read akademie/_supabase/functions/client-remind/poradi-zapisu.test.ts
//
// PROČ STATICKY: `index.ts` volá `Deno.serve()` hned při importu, takže smyčku odesílání
// nejde načíst bez nastartování serveru. Stejný vzor už v repu je (`_shared/tri-sourozenci.test.ts`),
// a přesně ten tam odhalil alert schovaný uvnitř podmínky.
// ⚠️ Statický test ověřuje TVAR kódu, ne chování za běhu. Chování ověřuje rollback test
//    nad živou DB (viz BUILD-maily-davka2a.md) a nedělní běh.
// ⚠️ [R1] Revizor upozornil, že takový test zezelená i nad kódem s vadou, kterou pozná
//    jen z toho, co v kódu NENÍ. Proto má skoro každá kontrola i KONTRAST: tvrzení, že
//    starý (vadný) tvar v souboru už není.
// ============================================================================
const SRC = await Deno.readTextFile(new URL("./index.ts", import.meta.url));

let selhalo = 0;
function check(nazev: string, podminka: boolean, detail = ""): void {
  if (podminka) console.log("  ok   " + nazev);
  else { selhalo++; console.log("  FAIL " + nazev + (detail ? "  [" + detail + "]" : "")); }
}

console.log("\n== client-remind: poradi zapisu a odeslani ==");

const iRezervuj = SRC.indexOf("const rez = await rezervuj(admin");
// ⚠️ `odesliPresResend(RESEND_KEY, {` na jednom radku je alert Martinovi, ne klientsky mail.
//    Odeslani klientovi pozname podle zalomeni hned za zavorkou.
const iOdeslani = SRC.search(/const r = await odesliPresResend\(\r?\n/);
check("rezervace je v kodu PRED odeslanim", iRezervuj > 0 && iOdeslani > 0 && iRezervuj < iOdeslani,
  "rezervuj@" + iRezervuj + " odeslani@" + iOdeslani);

// KONTRAST: puvodni vada. Zapis po uspesnem odeslani uz v kodu byt nesmi.
check("stary zapis AZ PO odeslani je pryc",
  !SRC.includes('.insert({ email: tgt.email, kind: tgt.kind }).select("id")'));

check("prohrany zavod NEODESILA (po 'obsazeno' nasleduje continue)",
  /rez\.stav === "obsazeno"\)\s*\{\s*prohranyZavod\+\+;\s*continue;/.test(SRC));
check("chyba zapisu NEODESILA (po 'chyba' nasleduje continue)",
  /rez\.stav === "chyba"\)\s*\{[\s\S]{0,400}?continue;/.test(SRC));

// ⛔⛔ [R1 nalez N1, R2 nalez R2-2] ROZHODUJE, JESTLI TELO MOHLO DOJIT NA RESEND.
//    `status: 0` ma dve pricny: `missing_RESEND_API_KEY` (pozadavek se ani nesestavil,
//    JISTE neodeslano) a `sit:…` (pad fetch, telo uz na Resendu byt MOHLO).
check("nejistota je 5xx NEBO chyba 'sit:'",
  SRC.includes('const teloMohloDojit = r.status >= 500 || String(r.chyba ?? "").startsWith("sit:");'));
// KONTRAST: obe stare verze prahu uz v kodu byt nesmi.
check("stary prah 400 je pryc", !SRC.includes("if (r.status >= 400) {"));
check("prah jen podle statusu (R1) je pryc", !SRC.includes("if (r.status >= 500) {"));

const poHranici = SRC.split("if (teloMohloDojit) {")[1] ?? "";
const vetevNejistoty = poHranici.split("} else {")[0] ?? "";
const vetevNeodeslano = poHranici.split("} else {")[1] ?? "";
check("pri nejistote se rezervace NEMAZE",
  vetevNejistoty.length > 0 && !vetevNejistoty.includes("uvolniRezervaci("));
check("pri nejistote se zapisuje sent_ok=false", vetevNejistoty.includes("oznacNejiste("));
check("pri nejistote jde alert Martinovi", vetevNejistoty.includes("posliAlertNejistoty("));
check("jiste neodeslani rezervaci UVOLNI", vetevNeodeslano.includes("uvolniRezervaci("));
// ⛔ [R1, nalez N2] Kdyz se uvolneni nepovede, radek drzi a mail neodesel: hlidka to musi videt.
check("selhane uvolneni oznaci sent_ok=false a alertuje",
  vetevNeodeslano.includes("oznacNejiste(") && vetevNeodeslano.includes("posliAlertNejistoty("));

// ⛔⛔ [R2, nalez R2-1] Uvolnena rezervace nesmi byt ticha. Stopu pise helper
//    (`odesliPresResend` -> `email_events` type 'odeslani_chyba'), a hlidka ji cte.
//    Kdyz se odsud prestane volat helper, oslepne hlidka, aniz by cokoli spadlo.
check("odeslani jde pres helper, ktery pise stopu o chybe",
  SRC.includes("await odesliPresResend(") && SRC.includes("{ admin, via: \"client-remind\", email: tgt.email"));

// ⛔ [R1, nalez N2] Vyjimka po rezervaci taky musi skoncit sent_ok=false, ne jen v poli.
const vetevCatch = SRC.split("} catch (e) {")[1] ?? "";
check("vyjimka po rezervaci oznaci sent_ok=false",
  vetevCatch.includes("oznacNejiste(") && vetevCatch.includes("posliAlertNejistoty("));
// ⛔ [R2, nalez R2-6] Uklid po vyjimce ma vlastni try: jinak by vyjimka z uklidu
//    shodila celou smycku a zbyli klienti by se ten den nezpracovali vubec.
check("uklid po vyjimce ma vlastni try", /if \(rezervovano\) \{[\s\S]{0,160}?try \{/.test(SRC));
check("selhany uklid se zaloguje", SRC.includes("UKLID PO VYJIMCE SELHAL"));

// ⛔ [R1, nalez N5] Strop alertu: jeden vypadek site nesmi poslat 19 stejnych mailu.
check("alerty maji strop", SRC.includes("const MAX_ALERTU = 3;") && SRC.includes("alertuPotlaceno++"));
check("potlacene alerty jsou videt v odpovedi", SRC.includes("alerty_potlaceno: alertuPotlaceno"));

// Alert nesmi jit pres branu: Martinova adresa na seznamu by umlcela prave ty alerty.
const teloAlertu = SRC.split("async function alertMartinovi(")[1]?.split("function mailHtml(")[0] ?? "";
check("alertMartinovi nejde pres guardSend", teloAlertu.length > 0 && !teloAlertu.includes("guardSend"));
check("alertMartinovi nepise stopu do email_events (Martinova adresa)",
  teloAlertu.includes("odesliPresResend(RESEND_KEY, {") && !teloAlertu.includes("admin, via:"));

// Kdyz neprojde ani alert, nesmi to zapadnout uplne (cron nema retry).
check("selhany alert se pozna a hlasi v odpovedi",
  SRC.includes("alertySelhaly.push(") && SRC.includes("alerty_selhaly: alertySelhaly"));

// Rezervace se nesmi opakovat pres ctiSOpakovanim (druhy pokus by narazil na vlastni radek).
const teloRezervace = SRC.split("async function rezervuj(")[1]?.split("\n}")[0] ?? "";
check("rezervace se NEOPAKUJE", teloRezervace.length > 0 && !teloRezervace.includes("ctiSOpakovanim"));
check("rezervace pozna 23505 jako obsazeno", teloRezervace.includes('"23505"'));

console.log("\n== client-remind: testovaci rezim ma vlastni pamet (nalez V2) ==");

check("testovaci klic je oddeleny (test:<druh>)", SRC.includes('const testKlic = "test:" + testKind;'));
// KONTRAST: test NESMI psat ostry druh, jinak by umlcel nedelni mail klientovi.
check("test NEZAPISUJE ostry druh", !/testEmail\)\s*\{[\s\S]{0,300}?insert\(\{ email: tgt\.email, kind: tgt\.kind \}\)/.test(SRC));
check("test zapisuje pod testKlic", SRC.includes("kind: testKlic })"));
// ⛔ [R1, nalez N9] Testovaci zapis musi adresu snizit, jinak v tabulce vzniknou dve varianty.
check("testovaci zapis adresu snizuje", SRC.includes("insert({ email: low(tgt.email), kind: testKlic })"));
check("hodinova pojistka existuje", SRC.includes("test_jiz_odeslan_v_posledni_hodine") && SRC.includes("3600_000"));
check("pojistka jde vedome prebit", SRC.includes("body?.test_znovu === true") && SRC.includes("test_znovu"));
check("pojistka se pta na testKlic, ne na ostry druh",
  SRC.includes('poslednePoslano.get(low(testEmail) + ":" + testKlic)'));
// Test na adresu klienta nesmi ovlivnit dvoutydenni kadenci.
check("testovaci radky nejdou do mapy 'kdykoli komukoli'",
  /if \(!String\(r\.kind \?\? ""\)\.startsWith\("test:"\)\) \{[\s\S]{0,300}?poslednePoslanoKomukoli\.set/.test(SRC));

console.log(selhalo === 0 ? "\nVSE ZELENE\n" : "\n" + selhalo + " SELHANI\n");
if (selhalo > 0) Deno.exit(1);
