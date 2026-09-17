// Testy otisku dotazníku (17. 9. 2026, nález D/N14).
// Spuštění: npx --yes deno@2 run akademie/_supabase/functions/intake-capture/otisk.test.ts
// (bez --allow-*: test nečte síť, disk ani proměnné prostředí)
import { OTISK_POLE, otiskOdpovedi, otiskVstup } from "./otisk.ts";

let selhalo = 0;
let kontrol = 0;
function zkontroluj(popis: string, dostal: unknown, cekal: unknown) {
  kontrol++;
  if (JSON.stringify(dostal) === JSON.stringify(cekal)) console.log("✓ " + popis);
  else {
    selhalo++;
    console.error("✗ " + popis + ": cekal " + JSON.stringify(cekal) + ", dostal " + JSON.stringify(dostal));
  }
}

const zaklad = {
  goal: "Chci zhubnout 10 kg",
  tried_before: "keto",
  typical_day: "kava, obed v praci, vecere doma",
  work_shifts: "ne",
  sleep_hours: "7",
  activity: "fitko 2x tydne",
  measurements: "pas 95",
  note: "",
  weight_kg: 95.5,
  age: 38,
  height_cm: 182,
  sex: "m",
  steps_per_day: 7000,
};

const h = await otiskOdpovedi(zaklad);

zkontroluj("otisk je SHA-256 v hexu (64 znaku)", h.length, 64);
zkontroluj("tentyz dotaznik da tentyz otisk", await otiskOdpovedi({ ...zaklad }), h);
zkontroluj("mezery a velka pismena nerozhoduji (tyz dotaznik poslany podruhe)",
  await otiskOdpovedi({ ...zaklad, goal: "  chci zhubnout   10 KG " }), h);
zkontroluj("null a prazdny retezec jsou totez", await otiskOdpovedi({ ...zaklad, note: null }), h);

// KONTRAST: opraveny dotaznik MUSI mit jiny otisk, jinak by se Martin o zmene nedozvedel.
zkontroluj("zmena textu da JINY otisk",
  (await otiskOdpovedi({ ...zaklad, note: "beru leky na stitnou zlazu" })) !== h, true);
zkontroluj("zmena cisla da JINY otisk", (await otiskOdpovedi({ ...zaklad, weight_kg: 95.6 })) !== h, true);
zkontroluj("zmena pohlavi da JINY otisk", (await otiskOdpovedi({ ...zaklad, sex: "z" })) !== h, true);

// ⛔ Posunuti obsahu mezi poli se NESMI slit do stejneho otisku.
zkontroluj("presun textu mezi poli da JINY otisk",
  (await otiskOdpovedi({ ...zaklad, goal: "keto", tried_before: "Chci zhubnout 10 kg" })) !== h, true);

// Otisk se pocita JEN z odpovedi: e-mail, IP ani atribuce v nem nejsou.
zkontroluj("atribuce otisk nemeni",
  await otiskOdpovedi({ ...zaklad, attribution: { utm_source: "fb" }, ip: "1.2.3.4", email: "a@x.cz" }), h);

zkontroluj("vstup ma jeden radek na pole", otiskVstup(zaklad).split("\n").length, OTISK_POLE.length);
zkontroluj("vstup nese jmena poli", otiskVstup(zaklad).startsWith("goal="), true);

console.log(selhalo === 0 ? "\nHOTOVO: " + kontrol + " kontrol, vse proslo." : "\nSELHALO: " + selhalo + " z " + kontrol);
if (selhalo > 0) Deno.exit(1);
