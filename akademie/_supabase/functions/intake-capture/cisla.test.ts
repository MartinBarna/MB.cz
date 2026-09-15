// Testy převodu čísel z dotazníku před konzultací.
// Spuštění: npx --yes deno@2 run akademie/_supabase/functions/intake-capture/cisla.test.ts
// (bez --allow-*: test nečte síť, disk ani proměnné prostředí)
import { celeCislo, proAlert, vahaNaCislo } from "./cisla.ts";

let selhalo = 0;
function check(popis: string, podminka: boolean, videno?: unknown) {
  if (podminka) {
    console.log("  ok   " + popis);
  } else {
    selhalo++;
    console.log("  CHYBA " + popis + (videno === undefined ? "" : "  (videno: " + String(videno) + ")"));
  }
}
const vek = (v: unknown) => celeCislo(v, 15, 90);
const vyska = (v: unknown) => celeCislo(v, 120, 230);
const kroky = (v: unknown) => celeCislo(v, 0, 60000);

console.log("\ncelecislo: co ma projit");
check('"38" -> 38', vek("38") === 38, vek("38"));
check("38 (cislo, ne text) -> 38", vek(38) === 38, vek(38));
check('" 38 " s mezerami -> 38', vek(" 38 ") === 38, vek(" 38 "));
check('"182" -> 182', vyska("182") === 182, vyska("182"));
check('"7 000" kroku (mezera jako oddelovac tisicu) -> 7000', kroky("7 000") === 7000, kroky("7 000"));
check('"0" kroku -> 0, ne null', kroky("0") === 0, kroky("0"));

console.log("\ncelecislo: co ma spadnout na null");
check('"abc" -> null', vek("abc") === null, vek("abc"));
check('"12" pod minimem -> null', vek("12") === null, vek("12"));
check('"91" nad maximem -> null', vek("91") === null, vek("91"));
check("prazdny retezec -> null", vek("") === null, vek(""));
check("jen mezery -> null", vek("   ") === null, vek("   "));
check("undefined -> null", vek(undefined) === null, vek(undefined));
check("null -> null", vek(null) === null, vek(null));
check('"119" vysky pod minimem -> null', vyska("119") === null, vyska("119"));
check('"231" vysky nad maximem -> null', vyska("231") === null, vyska("231"));
check('"60001" kroku nad maximem -> null', kroky("60001") === null, kroky("60001"));
check('zaporne kroky "-5" -> null', kroky("-5") === null, kroky("-5"));
check('"38 let" s jednotkou -> null', vek("38 let") === null, vek("38 let"));
check('"cca 8000" -> null', kroky("cca 8000") === null, kroky("cca 8000"));

console.log("\ncelecislo: oddelovac tisicu se ZAHAZUJE, necte se jako desetinne misto");
// ⛔ Nalez revize 15. 9. 2026 (S1): pred opravou davalo "7.000" sedm kroku.
check('"7,000" -> null, ne 7', kroky("7,000") === null, kroky("7,000"));
check('"7.000" -> null, ne 7', kroky("7.000") === null, kroky("7.000"));
check('"10.500" -> null, ne 11', kroky("10.500") === null, kroky("10.500"));
check('"60.000" -> null, ne 60', kroky("60.000") === null, kroky("60.000"));
check('"1.234.567" -> null', kroky("1.234.567") === null, kroky("1.234.567"));
check('"1e4" -> null, ne 10000', kroky("1e4") === null, kroky("1e4"));
check('"0x10" -> null, ne 16', kroky("0x10") === null, kroky("0x10"));
check('"1,82" vysky -> null (metry s carkou)', vyska("1,82") === null, vyska("1,82"));
check('"1.82" vysky -> null (metry s teckou, mimo rozsah)', vyska("1.82") === null, vyska("1.82"));

console.log("\ncelecislo: zaokrouhleni a hranice");
check('"38.6" -> 39 (dve a min cislice za teckou zustavaji desetinne)', vek("38.6") === 39, vek("38.6"));
check('"38.65" -> 39', vek("38.65") === 39, vek("38.65"));
check('"15" presne na minimu -> 15', vek("15") === 15, vek("15"));
check('"90" presne na maximu -> 90', vek("90") === 90, vek("90"));
check('"60000" presne na maximu -> 60000', kroky("60000") === 60000, kroky("60000"));

console.log("\nvaha: chovani se nesmelo zmenit, tecka je tam desetinna spravne");
check('"82,5" s carkou -> 82.5', vahaNaCislo("82,5") === 82.5, vahaNaCislo("82,5"));
check('"82.5" s teckou -> 82.5 (u vahy JE tecka desetinna)', vahaNaCislo("82.5") === 82.5, vahaNaCislo("82.5"));
check('"105" -> 105', vahaNaCislo("105") === 105, vahaNaCislo("105"));
check('"700" kg -> null', vahaNaCislo("700") === null, vahaNaCislo("700"));
// Oddelovac tisicu u vahy nehrozi: ctyrciferna vaha v kilech neexistuje a "1.000" spadne
// na dolni mez 25 kg, takze se neuklada jako 1 kg.
check('"1.000" kg -> null (spadne na dolni mez, ne na 1 kg)', vahaNaCislo("1.000") === null, vahaNaCislo("1.000"));
check("prazdna vaha -> null", vahaNaCislo("") === null, vahaNaCislo(""));

console.log("\nproAlert: zahozena hodnota nesmi vypadat jako nevyplnena");
// ⛔ Nalez revize 15. 9. 2026 (S2).
check("cislo projde -> holy text", proAlert("38", 38) === "38", proAlert("38", 38));
check("cislo s jednotkou -> \"38 let\"", proAlert("38", 38, "let") === "38 let", proAlert("38", 38, "let"));
check('nula -> "0", ne prazdno', proAlert("0", 0) === "0", proAlert("0", 0));
check("nevyplneno -> prazdno (radek v mailu nevznikne)", proAlert("", null) === "", proAlert("", null));
check("undefined -> prazdno", proAlert(undefined, null) === "", proAlert(undefined, null));
check("jen mezery -> prazdno", proAlert("   ", null) === "", proAlert("   ", null));
check(
  'necitelna vyska "1,82" -> necitelne s puvodnim textem',
  proAlert("1,82", null, "cm") === 'nečitelné („1,82“)',
  proAlert("1,82", null, "cm"),
);
check(
  'necitelny vek "38 let" -> necitelne s puvodnim textem',
  proAlert("38 let", null, "let") === 'nečitelné („38 let“)',
  proAlert("38 let", null, "let"),
);
check("puvodni text se orizne na 40 znaku", proAlert("x".repeat(200), null) === 'nečitelné („' + "x".repeat(40) + "“)", proAlert("x".repeat(200), null).length);
check("okraje puvodniho textu se orezou", proAlert("  1,82  ", null) === 'nečitelné („1,82“)', proAlert("  1,82  ", null));
// ⚠️ proAlert NEescapuje schvalne, dela to `esc` uvnitr `R()` v index.ts. Kdyby escapoval
//    taky, Martin by v mailu videl &amp;lt; misto <.
check("proAlert neescapuje (dela to esc v R())", proAlert("<b>", null) === 'nečitelné („<b>“)', proAlert("<b>", null));

console.log(selhalo === 0 ? "\nVSE ZELENE\n" : "\n" + selhalo + " SELHANI\n");
if (selhalo > 0) throw new Error(String(selhalo) + " selhani");
