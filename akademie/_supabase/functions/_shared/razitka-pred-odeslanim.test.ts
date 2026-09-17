// ============================================================================
// RAZÍTKA PROTI DUPLICITĚ: statická kontrola pořadí (17. 9. 2026, nález A/N10)
// Spuštění:
//   npx --yes deno@2 run --allow-read akademie/_supabase/functions/_shared/razitka-pred-odeslanim.test.ts
//
// CO SE HLÍDÁ: `order-rescue` i `videokurz-onboarding` zapisovaly razítko proti
// duplicitě AŽ PO odeslání a návratovou hodnotu (`{ data, error }`) zahazovaly.
// Když update selhal (504 brány Supabase), mail už odešel, razítko chybělo a další
// běh poslal totéž znovu. U `order-rescue` je to cron každé dvě hodiny, tedy až
// 36 opakování za okno 72 h.
//
// ⚠️ Statický test hlídá TVAR kódu, ne chování za běhu. Obě funkce mají dnes
//    prázdnou frontu (`pending_orders` 0 řádků, `customer_contacts` bez razítka 0),
//    takže je za běhu nemá na čem ověřit ani reálný cron.
// ============================================================================
const ROOT = new URL("..", import.meta.url);

let selhalo = 0;
function check(nazev: string, podminka: boolean, detail = ""): void {
  if (podminka) console.log("  ok   " + nazev);
  else { selhalo++; console.log("  FAIL " + nazev + (detail ? "  [" + detail + "]" : "")); }
}

const rescue = await Deno.readTextFile(new URL("order-rescue/index.ts", ROOT));
const onboard = await Deno.readTextFile(new URL("videokurz-onboarding/index.ts", ROOT));

console.log("\n== order-rescue: reminded_at pred odeslanim ==");
{
  const iRazitko = rescue.indexOf('.update({ reminded_at: new Date().toISOString() })');
  const iSend = rescue.indexOf("odeslani = await send(email,");
  check("razitko je PRED odeslanim", iRazitko > 0 && iSend > 0 && iRazitko < iSend,
    "razitko@" + iRazitko + " send@" + iSend);
  check("chyba razitka se cte", rescue.includes("const { error: razErr } = await admin.from(\"pending_orders\")"));
  // KONTRAST: puvodni vada. Zahozeny vysledek updatu uz v kodu byt nesmi.
  check("zahozeny update razitka je pryc",
    !/\n      await admin\.from\("pending_orders"\)\.update\(\{ reminded_at: new Date\(\)/.test(rescue));
  check("bez razitka se NEODESILA", rescue.includes("if (razErr) { razitkoChyba = razErr.message; return; }"));
  // ⛔⛔ [R1 nalez N1, R2 nalez R2-2] ROZHODUJE, JESTLI TELO MOHLO DOJIT NA RESEND.
  check("nejistota je 5xx NEBO chyba 'sit:'",
    rescue.includes('const teloMohloDojit = stav >= 500 || String(o?.chyba ?? "").startsWith("sit:");'));
  check("stary prah 400 je pryc", !rescue.includes("if (stav >= 400)"));
  check("prah jen podle statusu (R1) je pryc", !rescue.includes("if (stav < 500) {"));
  // ⛔⛔ [R2, nalez R2-1] Vracene razitko nesmi byt tiche: order-rescue predava helperu
  //    odeslani BEZ stopy, takze si radek odeslani_chyba musi zapsat samo.
  check("neuspech nechava stopu v email_events",
    /type: "odeslani_chyba"[\s\S]{0,200}?via: "order-rescue"/.test(rescue));
  check("stopa rozlisuje, jestli razitko zustalo", rescue.includes('razitko: teloMohloDojit ? "zustava" : "vraceno"'));
  const vetevVraceni = rescue.split("if (!teloMohloDojit) {")[1]?.split("} else {")[0] ?? "";
  const vetevNejistoty = rescue.split("if (!teloMohloDojit) {")[1]?.split("} else {")[1] ?? "";
  check("jiste neodeslani razitko VRATI", vetevVraceni.includes("reminded_at: null"));
  check("nejistota razitko NEVRACI", vetevNejistoty.length > 0 && !vetevNejistoty.slice(0, 1400).includes("reminded_at: null"));
  check("nejistota posle alert Martinovi", vetevNejistoty.includes("alertSeStropem("));
  // ⛔ [R1, nalez N2] Kdyz se razitko nepovede vratit, cron uz objednavku nikdy nevezme.
  check("selhane vraceni razitka alertuje", vetevVraceni.includes("alertSeStropem("));
  // ⛔ [R1, nalez N5] Strop alertu (cron jede kazde dve hodiny, az deset mailu na beh).
  check("alerty maji strop", rescue.includes("const MAX_ALERTU = 3;") && rescue.includes("alertuPotlaceno++"));
  const teloAlertu = rescue.split("async function alertMartinovi(")[1]?.split("\nDeno.serve")[0] ?? "";
  check("alert nejde pres branu", teloAlertu.length > 0 && !teloAlertu.includes("sendIfAllowed"));
}

console.log("\n== videokurz-onboarding: onboarding_sent_at pred odeslanim ==");
{
  const iRazitko = onboard.indexOf("onboarding_sent_at: nowIso");
  // ⚠️ `sendViaResend(String(body.test_email)…` je testovaci nahled, ne ostra davka.
  const iSend = onboard.indexOf("const id = await sendViaResend(String(r.email)");
  check("razitko je PRED odeslanim", iRazitko > 0 && iSend > 0 && iRazitko < iSend,
    "razitko@" + iRazitko + " send@" + iSend);
  check("chyba razitka se cte", onboard.includes("const { error: razErr } = await admin.from('customer_contacts')"));
  check("bez razitka se NEODESILA", /razitkoSelhalo\.push\(String\(r\.email\)\);\s*\r?\n\s*return;/.test(onboard));
  // ⛔⛔ [R1 nalez N1, R2 nalez R2-2] Puvodni test `zprava.includes('resend_')` nechal
  //    razitko i u `missing_RESEND_API_KEY` a u padu fetch. Verze z R1 zase brala kazdou
  //    chybu bez statusu jako jiste neodeslani, jenze pad fetch muze nastat az pri cteni
  //    odpovedi, kdyz telo uz na Resendu bylo.
  check("rozlisuje chybejici klic od padu fetch",
    onboard.includes("const chybiKlic = zprava.includes('missing_RESEND_API_KEY');") &&
    onboard.includes("const teloMohloDojit = stavOdeslani >= 500 || (!mStav && !chybiKlic);"));
  check("stary test 'obsahuje resend_' je pryc", !onboard.includes("if (zprava.includes('resend_'))"));
  check("prah jen podle statusu (R1) je pryc", !onboard.includes("if (stavOdeslani < 500) {"));
  const vetevVraceniO = onboard.split("if (!teloMohloDojit) {")[1]?.split("} else {")[0] ?? "";
  const vetevNejistoty = onboard.split("if (!teloMohloDojit) {")[1]?.split("} else {")[1] ?? "";
  check("jiste neodeslani razitko VRATI", vetevVraceniO.includes("onboarding_sent_at: null"));
  check("nejistota razitko NEVRACI", vetevNejistoty.length > 0 && !vetevNejistoty.slice(0, 900).includes("onboarding_sent_at: null"));
  check("chyba se dal pocita do errors (rethrow)", onboard.includes("throw e; // at se to zapocita"));
  check("stavy jdou videt v odpovedi",
    onboard.includes("razitko_selhalo: razitkoSelhalo") && onboard.includes("odeslani_nejiste: odeslaniNejiste"));
}

console.log(selhalo === 0 ? "\nVSE ZELENE\n" : "\n" + selhalo + " SELHANI\n");
if (selhalo > 0) Deno.exit(1);
