import { readFileSync } from "node:fs";
import { SOUHLAS_TEXT, kamDal, maSePrepnout, obohatOdkaz, sestavTelo } from "../assets/kosik-checkout-jadro.js";

let chyb = 0;
function check(nazev, ok, detail = "") {
  if (ok) console.log("  ok   " + nazev);
  else {
    chyb++;
    console.log("  FAIL " + nazev + (detail ? "  " + detail : ""));
  }
}

const js = readFileSync(new URL("../assets/kosik-checkout.js", import.meta.url), "utf8");
const html = readFileSync(new URL("../konzultace/index.html", import.meta.url), "utf8");
const server = readFileSync(new URL("../akademie/_supabase/functions/kosik-checkout/logika.ts", import.meta.url), "utf8");

check("flag ve vychozim stavu je false", html.includes('data-kosik-zapnuto="false"'));
check("ctyri tlacitka konzultace maji data-kosik a puvodni href",
  (html.match(/data-kosik="konzultace"/g) || []).length === 4
  && (html.match(/buy\.stripe\.com\/bJe6oG8bdc3wcjCdBZ3ks08/g) || []).length === 4);
check("v okne neni zaskrtavaci policko (v3, opravneny zajem)", !js.includes('type="checkbox"') && !js.includes("mb-kosik-souhlas") && !js.includes("checked"));
check("souhlas neni podminka: je tlacitko bez e-mailu", js.includes("Pokračovat bez e-mailu"));
check("flag off se neprepina", maSePrepnout(false) === false && maSePrepnout(true) === true);

const bez = sestavTelo({
  klic: "konzultace",
  email: "A@B.cz",
  href: "https://buy.stripe.com/x?utm_source=web&client_reference_id=BARNA-ABC&prefilled_promo_code=DOPORUC10",
  cesta: "/konzultace/",
  website: "",
});
check("s e-mailem jde vzdy informace v3", bez.souhlas === true && bez.souhlas_verze === "kosik-oz-v3-2026-11" && bez.email === "a@b.cz");
check("cref a promo se prenesou, utm ne", bez.cref === "BARNA-ABC" && bez.promo === "DOPORUC10" && !JSON.stringify(bez).includes("utm_"));

const se = sestavTelo({ klic: "konzultace", email: "a@b.cz", souhlas: false, href: "", cesta: "/konzultace/", website: "" });
check("stary parametr souhlas uz nic nemeni", se.souhlas === true && se.souhlas_verze === "kosik-oz-v3-2026-11");

check("chyba funkce = puvodni odkaz", kamDal({ fallback: true }, "https://buy.stripe.com/puvodni").href.endsWith("/puvodni"));
check("url ze session ma prednost", kamDal({ url: "https://checkout.stripe.com/c/pay/cs" }, "https://buy.stripe.com/x").href.includes("checkout.stripe.com"));

check("zneni souhlasu je stejne na serveru",
  server.includes("nejvýš 2 připomínky")
  && server.includes("Zásady ochrany osobních údajů: https://martinbarna.cz/zasady-ochrany-osobnich-udaju/")
  && SOUHLAS_TEXT.endsWith("https://martinbarna.cz/zasady-ochrany-osobnich-udaju/"));
check("verze je kosik-oz-v3 a v1/v2 nejsou konstanta", SOUHLAS_TEXT.includes("nejvýš 2 připomínky") && server.includes('SOUHLAS_VERZE = "kosik-oz-v3-2026-11"') && !server.includes("kosik-v1-2026-11") && !server.includes("kosik-v2-2026-11") && !js.includes("kosik-v2-2026-11"));
check("v kosiku nejsou tipy a nabidky", !js.includes("tipy a nabídky") && !server.includes("tipy a nabídky") && !SOUHLAS_TEXT.includes("tipy"));
check("odkaz na zasady je absolutni", js.includes('href="https://martinbarna.cz/zasady-ochrany-osobnich-udaju/"'));
check("informace je u e-mailu videt s odkazem na zasady", js.includes('<p class="info">') && js.includes("SOUHLAS_LABEL"));
check("cache verze skriptu je k3 a flag zustava false", html.includes('kosik-checkout.js?v=k3') && js.includes("kosik-checkout-jadro.js?v=k3") && html.includes('data-kosik-zapnuto="false"'));
check("novy skript nema utm_", !js.includes("utm_"));
check("import je .js, ne .mjs", js.includes("./kosik-checkout-jadro.js") && !js.includes(".mjs"));
const obohaceny = obohatOdkaz(
  "https://buy.stripe.com/x?client_reference_id=src-web",
  { cref: "PARTNER10_src-web", promo: "" },
);
check("fallback nese cref z referralu", obohaceny.includes("client_reference_id=PARTNER10_src-web"));
const sTelm = sestavTelo({
  klic: "coaching-gold-1",
  email: "a@b.cz",
  href: obohaceny,
  cesta: "/koucing/",
  website: "",
});
check("checkout teleso ma stejny cref", sTelm.cref === "PARTNER10_src-web" && !sTelm.promo);

if (chyb) {
  console.log(chyb + " FAIL");
  process.exit(1);
}
console.log("frontend ok");
