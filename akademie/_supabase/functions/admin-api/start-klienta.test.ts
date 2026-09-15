// Testy validace startu koučinku (dávka 9, 15. 9. 2026).
// Spuštění: npx --yes deno@2 run akademie/_supabase/functions/admin-api/start-klienta.test.ts
// (bez jakýchkoli --allow-*: test nečte síť, disk ani proměnné prostředí)
//
// ⭐ KONTRAST: bez něj by stačilo vracet vždy { ok:true } (překlep by prošel do DB)
//    nebo vždy { ok:false } (start by nešlo uložit vůbec) a testy by byly zelené.
//    Změřené mutace (kopie modulu mimo worktree, čísla v BUILD-davka9-admin.md):
//      a) vždy { ok:true, start:s }                 -> padá 8 kontrol
//      b) vždy { ok:false }                         -> padá 13 kontrol
//      c) vypuštěný zpětný převod (31. 2.)          -> padá 1 kontrola
//      d) vypuštěná mez do budoucna                 -> padá 2 kontroly
//      e) vypuštěná mez do minulosti                -> padá 2 kontroly
import { MAX_DNU_DOPREDU, MAX_DNU_DOZADU, overStart } from "./start-klienta.ts";

const DEN = 86400000;
const TED = Date.parse("2026-09-15T12:00:00Z");
const den = (n: number) => new Date(TED + n * DEN).toISOString().slice(0, 10);

type Pripad = {
  nazev: string;
  vstup: unknown;
  ceka: { ok: true; start: string | null } | { ok: false; duvod: string };
  proc: string;
};

const PRIPADY: Pripad[] = [
  {
    nazev: "prázdný řetězec",
    vstup: "",
    ceka: { ok: true, start: null },
    proc: "prázdné pole je legitimní odpověď „start neznám“, ne chyba formuláře",
  },
  {
    nazev: "chybějící hodnota (undefined)",
    vstup: undefined,
    ceka: { ok: true, start: null },
    proc: "starý klient admina start neposílá vůbec; nesmí to být 400",
  },
  {
    nazev: "samé mezery",
    vstup: "   ",
    ceka: { ok: true, start: null },
    proc: "ořízne se a chová se jako prázdno",
  },
  {
    nazev: "platné datum v budoucnu",
    vstup: "2026-09-20",
    ceka: { ok: true, start: "2026-09-20" },
    proc: "běžný případ: Martin zadá nejbližší pondělí nebo neděli",
  },
  {
    nazev: "dnešek",
    vstup: den(0),
    ceka: { ok: true, start: den(0) },
    proc: "start dnes je naprosto v pořádku",
  },
  {
    nazev: "český tvar 20.9.2026",
    vstup: "20.9.2026",
    ceka: { ok: false, duvod: "tvar_RRRR-MM-DD" },
    proc: "do sloupce `date` patří ISO; ručně vepsaný český tvar musí vrátit důvod, ne ticho",
  },
  {
    nazev: "31. února",
    vstup: "2026-02-31",
    ceka: { ok: false, duvod: "datum_neexistuje" },
    proc: "⛔ Date.parse z toho tiše vyrobí 3. březen; bez zpětného převodu by se uložil JINÝ den",
  },
  {
    nazev: "13. měsíc",
    vstup: "2026-13-01",
    ceka: { ok: false, duvod: "datum_neexistuje" },
    proc: "tvar sedí, datum neexistuje",
  },
  {
    nazev: "rok 2027 (překlep, přes 90 dní dopředu)",
    vstup: "2027-06-01",
    ceka: { ok: false, duvod: "prilis_daleko_v_budoucnu" },
    proc: "nejčastější překlep. Kdyby prošel, klient by mlčel měsíce a nikde by to nekřiklo",
  },
  {
    nazev: "hranice: 90 dní dopředu (den 90 musí projít vždy)",
    vstup: den(MAX_DNU_DOPREDU),
    ceka: { ok: true, start: den(MAX_DNU_DOPREDU) },
    // ⚠️ Mez porovnává DEN s OKAMŽIKEM: start je půlnoc UTC, `ted` je poledne, takže se
    //    hranice podle denní doby posouvá až o den. Je to hrubá pojistka proti překlepu
    //    v roce, ne přesné pravidlo, a proto se testují hodnoty jasně uvnitř a jasně venku.
    proc: "devadesátý den je ještě uvnitř meze za každé denní doby",
  },
  {
    nazev: "hranice: 92 dní dopředu",
    vstup: den(MAX_DNU_DOPREDU + 2),
    ceka: { ok: false, duvod: "prilis_daleko_v_budoucnu" },
    proc: "druhá strana téže hranice; dva dny navrch, aby výsledek nezávisel na denní době",
  },
  {
    nazev: "rok 2024 (příliš staré)",
    vstup: "2024-01-01",
    ceka: { ok: false, duvod: "prilis_stare" },
    proc: "start dva roky zpátky je překlep, ne historie; zadává se aktuální klient",
  },
  {
    nazev: "hranice: 364 dní zpátky",
    vstup: den(-MAX_DNU_DOZADU + 1),
    ceka: { ok: true, start: den(-MAX_DNU_DOZADU + 1) },
    proc: "klient se startem skoro rok zpátky ještě projde (táž nepřesnost den vs. okamžik)",
  },
  {
    nazev: "hranice: 367 dní zpátky",
    vstup: den(-MAX_DNU_DOZADU - 2),
    ceka: { ok: false, duvod: "prilis_stare" },
    proc: "druhá strana téže hranice, dva dny navrch kvůli denní době",
  },
  {
    nazev: "číslo místo data",
    vstup: 20260920,
    ceka: { ok: false, duvod: "tvar_RRRR-MM-DD" },
    proc: "cokoli, co není řetězec ve tvaru RRRR-MM-DD, končí důvodem",
  },
];

let selhalo = 0;
console.log("\n== overStart (start koučinku, meze " + MAX_DNU_DOPREDU + " dní dopředu / " + MAX_DNU_DOZADU + " dozadu) ==");

for (const p of PRIPADY) {
  const r = overStart(p.vstup, TED);
  const sedi = r.ok === p.ceka.ok &&
    (r.ok ? r.start === (p.ceka as { start: string | null }).start : r.duvod === (p.ceka as { duvod: string }).duvod);
  if (sedi) {
    console.log("  ok   " + p.nazev + " -> " + (r.ok ? "uloží „" + r.start + "\"" : "400 " + r.duvod));
  } else {
    selhalo++;
    console.error("  PADÁ " + p.nazev + ": čekal " + JSON.stringify(p.ceka) + ", dostal " + JSON.stringify(r) + " (" + p.proc + ")");
  }
}

// Pojistka proti tichému rozejití s čistou funkcí v `client-remind/cerstvy-klient.ts`:
// tam je táž mez pojmenovaná `START_MAX_DNU_DOPREDU`. Kdyby se rozešly, admin by pustil
// datum, které `client-remind` ignoruje, a Martin by viděl uložený start bez účinku.
if (MAX_DNU_DOPREDU !== 90) {
  selhalo++;
  console.error("  PADÁ MAX_DNU_DOPREDU je " + MAX_DNU_DOPREDU + ", ale cerstvy-klient.ts počítá s 90. Srovnej obě čísla.");
} else {
  console.log("  ok   MAX_DNU_DOPREDU je 90 (shoduje se se START_MAX_DNU_DOPREDU)");
}

console.log(selhalo === 0 ? "\nHOTOVO: " + (PRIPADY.length + 1) + " kontrol, vše prošlo.\n" : "\nSELHALO: " + selhalo + "\n");
if (selhalo > 0) Deno.exit(1);
