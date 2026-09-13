// Hlida tri opravy z 13. 9. 2026: stav se nesmi posunout, kdyz akce neprobehla.
// Stejny vzor jako u poukazu (zaplaceno a nedodano), jen ve trech sousednich funkcich.
//
// ⛔ Test je STATICKY (cte zdrojak). Tyhle funkce nemaji testovaci obalku a zavadet ji
//    kvuli nekolika podminkam by bylo vic kodu nez oprava.
//    ⭐ Proto musi platit KONTRAST: kazda kontrola nize prokazatelne PADA na verzi pred
//    opravou. Jinak by to byl zeleny test, ktery nic nemeri.
// ⚠️ A staticky test umi byt zeleny nad SPATNYM kodem, kdyz hleda jen PRITOMNOST retezce.
//    Prvni verze tohohle souboru to predvedla: A1 hledala `if (!out.sent) { await alertAdmin(`
//    a byla zelena, i kdyz ten alert visel UVNITR `if (out.sent || out.skipped)` a tedy
//    nepokryval pad odeslani. Kontroly proto meri UMISTENI (odsazeni), ne jen vyskyt.
//
// Spusteni: deno test --allow-read --allow-env akademie/_supabase/functions/_shared/tri-sourozenci.test.ts
//   (⛔ `--allow-env` je povinne, cte se `ZDROJ`; bez nej to spadne driv, nez cokoli zmeri)
// Kontrast:  ZDROJ=<adresar se starymi funkcemi> deno test --allow-read --allow-env ...
// ⚠️ Deno hlasi "0 passed | 0 failed", protoze tu nejsou `Deno.test()`; kontroly bezi
//    jako vedlejsi efekt a pri chybe konci `Deno.exit(1)`.

const ZDROJ = Deno.env.get("ZDROJ") || new URL("../", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
// ⛔ CR se strhava: soubory maji CRLF, takze vzory, ktere hledaji konec radku,
//    by jinak nikdy nesedly a kontrola na nich postavena by byla tise zelena.
const cti = (p: string) => Deno.readTextFileSync(`${ZDROJ}/${p}`).split(String.fromCharCode(13)).join("");
const NL = String.fromCharCode(10);

let chyb = 0;
function check(jmeno: string, podminka: boolean) {
  if (podminka) console.log("  ok   " + jmeno);
  else { chyb++; console.log("  PADA " + jmeno); }
}

const sg = cti("splatky-guard/index.ts");
const or = cti("order-rescue/index.ts");
const rw = cti("resend-webhook/index.ts");

console.log("splatky-guard:");
// Alert u varovani musi byt VENKU z `if (out.sent || out.skipped)`, jinak nepokryje
// pad odeslani (brana pustila, Resend neprijal) a Martin se nedozvi nic.
// Meri se odsazenim: venku 6 mezer, uvnitr by bylo 8.
check("A1 warn: alert je VENKU z podminky (6 mezer)", sg.includes(NL + "      if (!out.sent) {"));
check("A1b warn: alert NENI uvnitr podminky (8 mezer)", !sg.includes(NL + "        if (!out.sent) {"));
check("A2 suspend: vysledek odeslani se drzi v promenne", sg.includes("const outS = await sendMailGuarded("));
check("A3 suspend: neodeslana zprava hlasi alertAdmin", sg.includes(NL + "      if (!outS.sent) {"));
check("A4 suspend: email_events nelze natvrdo 'sent'", !/kind: "suspend", email \} \}\)/.test(sg) && sg.includes('type: outS.sent ? "sent" : "info"'));
check("A5 sendMail ma try/catch kolem fetch", /try \{\s*const res = await fetch\("https:\/\/api\.resend\.com\/emails"/.test(sg));
// Alert nesmi jit pres branu: Martinova adresa na seznamu by umlcela prave ty alerty.
const telo = sg.split("async function alertAdmin(")[1] ?? "";
const teloAlert = telo.split(NL + "}" + NL)[0];
check("A6 alertAdmin nejde pres sendIfAllowed", telo.length > 0 && teloAlert.includes("return await sendMail(") && !teloAlert.includes("sendIfAllowed"));
// Kdyz neprojde ani alert, nesmi to zapadnout uplne (cron nema retry, tak aspon log a odpoved).
check("A7 selhany alert se pozna a hlasi", (sg.match(/if \(!doslo\) \{/g) ?? []).length === 2 && sg.includes("alerty_selhaly: alertySelhaly"));

console.log("order-rescue:");
check("B1 skip se vypaluje jen pri trvalem duvodu", /const trvalyDuvod = [\s\S]{0,200}?if \(trvalyDuvod\) \{\s*await admin\.from\("pending_orders"\)\.update\(\{ reminded_at/.test(or));
check("B2 suppression_load_failed NENI mezi trvalymi", /const trvalyDuvod =[^;]*;/.test(or) && !(/const trvalyDuvod =[^;]*suppression_load_failed/.test(or)));
check("B3 trvale duvody sedi s mailing-guard", ["invalid_email", "hard_bounce", "hard_unsubscribe"].every((r) => new RegExp(`const trvalyDuvod =[^;]*"${r}"`).test(or)));
// Bez tohohle by deset zaseknutych objednavek drzelo frontu, dokud jim neutece 72 h.
check("B4 MAX_PER_RUN je strop na ODESLANE, ne na prectene", or.includes("if (sent >= MAX_PER_RUN) break;") && /\.limit\(MAX_PER_RUN \* \d\)/.test(or));

console.log("resend-webhook:");
check("C1 prechodny bounce se pozna z data.bounce.type", /const prechodnyBounce = t === "bounce" && \/\^\(transient\|temporary\)\$\/i\.test\(bounceTyp\)/.test(rw));
check("C2 zmrazeni leadu prechodny bounce preskoci", rw.includes('if ((t === "bounce" || t === "complaint") && lead_id && !prechodnyBounce) {'));
check("C3 typ bounce se uklada do detail", rw.includes("bounce_typ: bounceTyp") && rw.includes("bounce_sub: bounceSub"));
// Fail-closed: zmrazuje se dal i pri Undetermined a kdyz typ nedorazil vubec. Kdyby se
// podminka obratila na "zmrazit jen Permanent", tyhle dva pripady by tise prestaly.
check("C4 zmrazeni NENI podmineno hodnotou Permanent", !/Permanent/i.test(rw.split("if ((t === \"bounce\"")[1]?.split(NL)[0] ?? "Permanent"));

check("Z1 zdrojaky se opravdu nacetly", sg.length > 5000 && or.length > 5000 && rw.length > 5000);

if (chyb) { console.log(`${NL}PADLO ${chyb} kontrol`); Deno.exit(1); }
console.log(`${NL}VSE ZELENE`);
