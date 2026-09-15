// Testy převodu čísel z dotazníku před konzultací.
// Spuštění: npx --yes deno@2 run akademie/_supabase/functions/intake-capture/cisla.test.ts
// (bez --allow-*: test nečte síť, disk ani proměnné prostředí)
import { celeCislo, vahaNaCislo } from "./cisla.ts";

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
check('38 (cislo, ne text) -> 38', vek(38) === 38, vek(38));
check('" 38 " s mezerami -> 38', vek(" 38 ") === 38, vek(" 38 "));
check('"182" -> 182', vyska("182") === 182, vyska("182"));
check('"7 000" krok\u016f -> 7000', kroky("7 000") === 7000, kroky("7 000"));
check('"0" krok\u016f -> 0, ne null', kroky("0") === 0, kroky("0"));

console.log("\ncelecislo: co ma spadnout na null");
check('"abc" -> null', vek("abc") === null, vek("abc"));
check('"12" pod minimem -> null', vek("12") === null, vek("12"));
check('"91" nad maximem -> null', vek("91") === null, vek("91"));
check('prazdny retezec -> null', vek("") === null, vek(""));
check('jen mezery -> null', vek("   ") === null, vek("   "));
check('undefined -> null', vek(undefined) === null, vek(undefined));
check('null -> null', vek(null) === null, vek(null));
check('"119" vysky pod minimem -> null', vyska("119") === null, vyska("119"));
check('"231" vysky nad maximem -> null', vyska("231") === null, vyska("231"));
check('"60001" kroku nad maximem -> null', kroky("60001") === null, kroky("60001"));
check('zaporne kroky -> null', kroky("-5") === null, kroky("-5"));
// ⛔ "7,000" je past: prevod carky na tecku by z toho udelal 7 kroku a Martin by
//    pocital s nesmyslem. Radsi null a prazdny radek v alertu.
check('"7,000" -> null, ne 7', kroky("7,000") === null, kroky("7,000"));

console.log("\ncelecislo: zaokrouhleni a hranice");
check('"38.6" -> 39', vek("38.6") === 39, vek("38.6"));
check('"15" presne na minimu -> 15', vek("15") === 15, vek("15"));
check('"90" presne na maximu -> 90', vek("90") === 90, vek("90"));

console.log("\nvaha: chovani se nesmelo zmenit");
check('"82,5" s carkou -> 82.5', vahaNaCislo("82,5") === 82.5, vahaNaCislo("82,5"));
check('"82.5" s teckou -> 82.5', vahaNaCislo("82.5") === 82.5, vahaNaCislo("82.5"));
check('"700" kg -> null', vahaNaCislo("700") === null, vahaNaCislo("700"));
check('prazdna vaha -> null', vahaNaCislo("") === null, vahaNaCislo(""));

console.log(selhalo === 0 ? "\nVSE ZELENE\n" : "\n" + selhalo + " SELHANI\n");
if (selhalo > 0) throw new Error(String(selhalo) + " selhani");
