// Hlida tri opravy z 13. 9. 2026: stav se nesmi posunout, kdyz akce neprobehla.
// Stejny vzor jako u poukazu (zaplaceno a nedodano), jen ve trech sousednich funkcich.
//
// ⛔ Test je STATICKY (cte zdrojak), protoze tyhle funkce nemaji zadnou testovaci
//    obalku a zavadet ji kvuli trem podminkam by bylo vic kodu nez oprava.
//    ⭐ Proto musi platit KONTRAST: kazda kontrola nize prokazatelne PADA na verzi
//    pred opravou (overeno spustenim proti `git show HEAD~1`), jinak by to byl
//    zeleny test, ktery nic nemeri (pouceni z 13. 9., viz `feedback-zeleny-test-neni-dukaz-spravnosti`).
//
// Spusteni: deno test --allow-read akademie/_supabase/functions/_shared/tri-sourozenci.test.ts
// Jiny zdroj: ZDROJ=<cesta k adresari functions> (pouziva se prave na mereni kontrastu).

const ZDROJ = Deno.env.get("ZDROJ") || new URL("../", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const cti = (p: string) => Deno.readTextFileSync(`${ZDROJ}/${p}`);

let chyb = 0;
function check(jmeno: string, podminka: boolean) {
  if (podminka) console.log("  ok   " + jmeno);
  else { chyb++; console.log("  PADA " + jmeno); }
}

const sg = cti("splatky-guard/index.ts");
const or = cti("order-rescue/index.ts");
const rw = cti("resend-webhook/index.ts");

console.log("splatky-guard:");
// 1. Varovani, ktere neodeslo, se musi dozvedet Martin (lhuta bezi dal).
check("A1 warn: neodeslane varovani hlasi alertAdmin", /if \(!out\.sent\) \{\s*await alertAdmin\(/.test(sg));
// 2. Pozastaveni: vysledek mailu se uz nezahazuje.
check("A2 suspend: vysledek odeslani se drzi v promenne", sg.includes("const outS = await sendMailGuarded("));
check("A3 suspend: neodeslana zprava hlasi alertAdmin", /if \(!outS\.sent\) \{\s*await alertAdmin\(/.test(sg));
// 3. Do email_events uz se nepise "sent" bez ohledu na skutecnost.
check("A4 suspend: email_events nelze natvrdo 'sent'", !/kind: "suspend", email \} \}\)/.test(sg) && sg.includes('type: outS.sent ? "sent" : "info"'));
// 4. Pad fetch neshodi cely beh cronu.
check("A5 sendMail ma try/catch kolem fetch", /try \{\s*const res = await fetch\("https:\/\/api\.resend\.com\/emails"/.test(sg));
// 5. Alert nesmi jit pres branu (jinak by Martinova adresa na seznamu alerty umlcela).
check("A6 alertAdmin nejde pres sendIfAllowed", /async function alertAdmin\([\s\S]{0,700}?return await sendMail\(/.test(sg));

console.log("order-rescue:");
// 6. Docasny skip nesmi spalit jedinou pripominku.
check("B1 skip se vypaluje jen pri trvalem duvodu", /const trvalyDuvod = [\s\S]{0,200}?if \(trvalyDuvod\) \{\s*await admin\.from\("pending_orders"\)\.update\(\{ reminded_at/.test(or));
check("B2 suppression_load_failed NENI mezi trvalymi", /const trvalyDuvod =[^;]*;/.test(or) && !(/const trvalyDuvod =[^;]*suppression_load_failed/.test(or)));
check("B3 trvale duvody sedi s mailing-guard", ["invalid_email", "hard_bounce", "hard_unsubscribe"].every((r) => new RegExp(`const trvalyDuvod =[^;]*"${r}"`).test(or)));

console.log("resend-webhook:");
// 7. Prechodny bounce nesmi lead zmrazit natrvalo.
check("C1 prechodny bounce se pozna z data.bounce.type", /const prechodnyBounce = t === "bounce" && \/\^\(transient\|temporary\)\$\/i\.test\(bounceTyp\)/.test(rw));
check("C2 zmrazeni leadu prechodny bounce preskoci", rw.includes('if ((t === "bounce" || t === "complaint") && lead_id && !prechodnyBounce) {'));
check("C3 typ bounce se uklada do detail", rw.includes("bounce_typ: bounceTyp") && rw.includes("bounce_sub: bounceSub"));
const c4radek = (rw.split("const prechodnyBounce")[1] ?? "").split(String.fromCharCode(10))[0];
check("C4 Undetermined a chybejici typ zustavaji fail-closed", c4radek.length > 0 && !/undetermined/i.test(c4radek));

// ⛔ Kontrola samotneho testu: kdyby se nacetl prazdny soubor, vsechno by "proslo".
check("Z1 zdrojaky se opravdu nacetly", sg.length > 5000 && or.length > 5000 && rw.length > 5000);

if (chyb) { console.log(`\nPADLO ${chyb} kontrol`); Deno.exit(1); }
console.log("\nVSE ZELENE");
