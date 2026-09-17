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
  check("vyslovne odmitnuti (>= 400) razitko VRATI", /if \(stav >= 400\) \{[\s\S]{0,260}?reminded_at: null/.test(rescue));
  const vetevNejistoty = rescue.split("if (stav >= 400)")[1]?.split("} else {")[1] ?? "";
  check("nejistota razitko NEVRACI", vetevNejistoty.length > 0 && !vetevNejistoty.slice(0, 1400).includes("reminded_at: null"));
  check("nejistota posle alert Martinovi", vetevNejistoty.includes("alertMartinovi("));
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
  check("vyslovne odmitnuti Resendu razitko VRATI",
    /zprava\.includes\('resend_'\)\) \{[\s\S]{0,260}?onboarding_sent_at: null/.test(onboard));
  const vetevNejistoty = onboard.split("if (zprava.includes('resend_'))")[1]?.split("} else {")[1] ?? "";
  check("nejistota razitko NEVRACI", vetevNejistoty.length > 0 && !vetevNejistoty.slice(0, 900).includes("onboarding_sent_at: null"));
  check("chyba se dal pocita do errors (rethrow)", onboard.includes("throw e; // at se to zapocita"));
  check("stavy jdou videt v odpovedi",
    onboard.includes("razitko_selhalo: razitkoSelhalo") && onboard.includes("odeslani_nejiste: odeslaniNejiste"));
}

console.log(selhalo === 0 ? "\nVSE ZELENE\n" : "\n" + selhalo + " SELHANI\n");
if (selhalo > 0) Deno.exit(1);
