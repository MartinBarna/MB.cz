// Pozvánka na první check-in v mailu po nákupu videokurzu.
// Spuštění: npx --yes deno@2 run akademie/_supabase/functions/drip-send/pozvanka-checkin.test.ts
import {
  ODKAZ_CHECKIN,
  TEXT_POZVANKY,
  TEXT_TLACITKA,
  doplnPozvankuCheckinu,
  type BlokPozvanky,
} from "./pozvanka-checkin.ts";

let selhalo = 0;
function check(nazev: string, podminka: boolean, detail = ""): void {
  if (podminka) console.log("  ok   " + nazev);
  else {
    selhalo++;
    console.log("  FAIL " + nazev + (detail ? "  [" + detail + "]" : ""));
  }
}

const sablona: BlokPozvanky[] = [
  { t: "p", html: "Ahoj{{fn_space}}," },
  { t: "p", html: "díky za nákup." },
  { t: "btn", href: "https://martinbarna.cz/akademie/prihlaseni/?tab=up", text: "Vytvořit účet a začít" },
  { t: "p", html: "Kdyby cokoliv nešlo, stačí odpovědět." },
  { t: "ps", html: "P.S. Použij {{email}}." },
];

function main(): void {
  console.log("\n== jen uvítací krok nákupu videokurzu ==");
  const hotovo = doplnPozvankuCheckinu("onboarding-nakup-videokurz", 0, sablona);
  const hrefs = hotovo.filter((b) => b.t === "btn").map((b) => b.href);
  check("přibylo tlačítko na check-in", hrefs.includes(ODKAZ_CHECKIN));
  check("původní tlačítko zůstalo", hrefs.includes("https://martinbarna.cz/akademie/prihlaseni/?tab=up"));
  check("pozvánka je před větou Kdyby cokoliv nešlo",
    hotovo.findIndex((b) => b.html === TEXT_POZVANKY) === 3 &&
      hotovo[5]?.html === "Kdyby cokoliv nešlo, stačí odpovědět.");
  check("odkaz nemá utm", !ODKAZ_CHECKIN.includes("utm") && !JSON.stringify(hotovo).includes("utm_"));
  check("text tyká a nemá dlouhou pomlčku",
    TEXT_POZVANKY.includes("Vyplň si") && !TEXT_POZVANKY.includes("\u2014") && !TEXT_TLACITKA.includes("\u2014"));
  check("vstupní pole se nemění", sablona.length === 5);

  console.log("\n== jiné tratě a už vložená pozvánka ==");
  const academy = doplnPozvankuCheckinu("onboarding-nakup-academy", 0, sablona);
  check("KONTRAST: Academy se nemění", JSON.stringify(academy) === JSON.stringify(sablona));
  check("KONTRAST: krok 1 videokurzu se nemění",
    doplnPozvankuCheckinu("onboarding-nakup-videokurz", 1, sablona).length === 5);
  const podruhe = doplnPozvankuCheckinu("onboarding-nakup-videokurz", 0, hotovo);
  check("podruhé se pozvánka nezdvojí", podruhe.filter((b) => b.href === ODKAZ_CHECKIN).length === 1);

  const bezZaveru: BlokPozvanky[] = [
    { t: "p", html: "Ahoj," },
    { t: "ps", html: "P.S. hotovo" },
  ];
  const predPs = doplnPozvankuCheckinu("onboarding-nakup-videokurz", 0, bezZaveru);
  check("bez závěrečné věty se vloží před P.S.", predPs[1]?.html === TEXT_POZVANKY && predPs[3]?.t === "ps");

  console.log(selhalo === 0 ? "\nVSE ZELENE\n" : "\n" + selhalo + " SELHANI\n");
  if (selhalo) Deno.exit(1);
}

main();
