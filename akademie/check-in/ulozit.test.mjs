// Logika uložení z formuláře /akademie/check-in/.
// Spuštění: node akademie/check-in/ulozit.test.mjs
import { createRequire } from "node:module";

const { ulozSOpakovanim, jeUlozeno, HLASKA } = createRequire(import.meta.url)("./ulozit.js");

let selhalo = 0;
function check(nazev, podminka, detail = "") {
  if (podminka) console.log("  ok   " + nazev);
  else {
    selhalo++;
    console.log("  FAIL " + nazev + (detail ? "  [" + detail + "]" : ""));
  }
}

const okTelo = { ok: true, ulozeno: true, id: null, reco_points: ["Drž tempo."] };
const spi = async () => {};

console.log("\n== úspěch ==");
{
  let volani = 0;
  const vys = await ulozSOpakovanim(async () => {
    volani++;
    return { status: 200, body: okTelo };
  }, { spi, cekani: [1, 1] });
  check("200 a ulozeno je úspěch", vys.ok === true && vys.pokusu === 1 && volani === 1);
  check("jeUlozeno chce řádek, ne jen ok", jeUlozeno(200, okTelo) === true);
  check("KONTRAST: {ok:true} bez ulozeno není úspěch", jeUlozeno(200, { ok: true, reco: "text" }) === false);
}

console.log("\n== dočasná chyba a pak úspěch ==");
{
  let volani = 0;
  const vys = await ulozSOpakovanim(async () => {
    volani++;
    if (volani === 1) throw new Error("síť");
    return { status: 200, body: okTelo };
  }, { spi, cekani: [1, 1] });
  check("pád sítě se zopakuje a druhý pokus projde", vys.ok === true && vys.pokusu === 2 && volani === 2);
}

{
  let volani = 0;
  const vys = await ulozSOpakovanim(async () => {
    volani++;
    if (volani < 3) return { status: 503, body: { ok: false, ulozeno: false } };
    return { status: 200, body: okTelo };
  }, { spi, cekani: [1, 1] });
  check("503 se opakuje, třetí pokus uloží", vys.ok === true && volani === 3);
}

console.log("\n== trvalá chyba ==");
{
  let volani = 0;
  const vys = await ulozSOpakovanim(async () => {
    volani++;
    return { status: 422, body: { ok: false, ulozeno: false, error: "save_failed" } };
  }, { spi, cekani: [1, 1] });
  check("422 se neopakuje", volani === 1 && vys.pokusu === 1);
  check("hláška je přesně ta pro formulář", vys.ok === false && vys.hlaseni === HLASKA && HLASKA === "Nepodařilo se uložit, zkus znovu");
  check("tělo odpovědi zůstává, ať stránka formulář nemaže", vys.body && vys.body.ulozeno === false);
}

console.log("\n== samé dočasné chyby ==");
{
  let volani = 0;
  const vys = await ulozSOpakovanim(async () => {
    volani++;
    return { status: 500, body: null };
  }, { spi, cekani: [1, 1] });
  check("tři pokusy a pak chybová hláška", volani === 3 && vys.ok === false && vys.hlaseni === "Nepodařilo se uložit, zkus znovu");
}

console.log("\n== 200 bez potvrzeného řádku ==");
{
  const vys = await ulozSOpakovanim(async () => {
    return { status: 200, body: { ok: true } };
  }, { spi, cekani: [1, 1] });
  check("staré {ok:true} bez ulozeno není Hotovo a neopakuje se", vys.ok === false && vys.pokusu === 1 && vys.hlaseni === HLASKA);
}

if (selhalo) {
  console.log("\n" + selhalo + " SELHANI\n");
  process.exit(1);
}
console.log("\nVSE ZELENE\n");
