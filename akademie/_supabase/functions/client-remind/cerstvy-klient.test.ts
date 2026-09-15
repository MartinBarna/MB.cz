// Testy ochranné lhůty po pozvání klienta (15. 9. 2026).
// Spuštění: npx --yes deno@2 run akademie/_supabase/functions/client-remind/cerstvy-klient.test.ts
// (bez jakýchkoli --allow-*: test nečte síť, disk ani proměnné prostředí)
//
// ⭐ KONTRAST je smysl těchhle testů: bez něj by stačilo vracet pořád true (nikomu nic)
//    nebo pořád false (oprava by nic nedělala) a testy by byly zelené.
import { jeCerstvyKlient, START_GRACE_DNI } from "./cerstvy-klient.ts";

const DEN = 86400000;
const TED = Date.parse("2026-09-20T01:00:00Z"); // nedělní běh cronu

type Pripad = {
  nazev: string;
  email: string;
  grantOd: [string, string][]; // e-mail + ISO datum nároku
  reportovali: string[];
  ceka: boolean;
  proc: string;
};

const PRIPADY: Pripad[] = [
  // --- JÁDRO OPRAVY ---
  {
    nazev: "nový klient bez reportu",
    email: "mirek@example.com",
    grantOd: [["mirek@example.com", "2026-09-15T12:21:00Z"]],
    reportovali: [],
    ceka: true,
    proc: "pozvaný v úterý, start v neděli: výzvu k reportu v den startu dostat nesmí",
  },
  {
    nazev: "nový klient s reportem z importu",
    email: "prevadeny@example.com",
    grantOd: [["prevadeny@example.com", "2026-09-15T12:21:00Z"]],
    reportovali: ["prevadeny@example.com"],
    ceka: false,
    proc: "převáděný klient z Excelu reporty posílá roky, ztišit se na týden nesmí",
  },
  {
    nazev: "starý klient bez reportu",
    email: "vlasta@example.com",
    grantOd: [["vlasta@example.com", "2026-08-24T13:43:00Z"]],
    reportovali: [],
    ceka: false,
    proc: "klient měsíc po pozvání má výzvu dostávat dál, i když nikdy nereportoval",
  },

  // --- HRANICE 7 DNÍ ---
  {
    nazev: "hranice: přesně 7 dní od nároku",
    email: "hranice@example.com",
    grantOd: [["hranice@example.com", new Date(TED - 7 * DEN).toISOString()]],
    reportovali: [],
    ceka: false,
    proc: "sedmý den je první, kdy má týden za sebou: výzva projde",
  },
  {
    nazev: "hranice: minutu před sedmým dnem",
    email: "hranice2@example.com",
    grantOd: [["hranice2@example.com", new Date(TED - 7 * DEN + 60000).toISOString()]],
    reportovali: [],
    ceka: true,
    proc: "těsně uvnitř lhůty se ještě přeskakuje",
  },
  {
    nazev: "hranice: den po lhůtě",
    email: "hranice3@example.com",
    grantOd: [["hranice3@example.com", new Date(TED - 8 * DEN).toISOString()]],
    reportovali: [],
    ceka: false,
    proc: "osmý den je lhůta pryč",
  },

  // --- CO NESMÍ MAIL ZADRŽET ---
  {
    nazev: "neznámý granted_at",
    email: "nikde@example.com",
    grantOd: [],
    reportovali: [],
    ceka: false,
    proc: "o klientovi bez data nevíme nic; mlčet by bylo tiché selhání, mail odejde jako dosud",
  },
  {
    nazev: "nečitelný granted_at",
    email: "rozbity@example.com",
    grantOd: [["rozbity@example.com", "tohle datum neni"]],
    reportovali: [],
    ceka: false,
    proc: "nečitelné datum se do mapy vůbec nedostane, chová se jako neznámé",
  },

  // --- DATOVÁ ANOMÁLIE ---
  {
    nazev: "nárok datovaný do budoucna",
    email: "budoucnost@example.com",
    grantOd: [["budoucnost@example.com", "2026-10-01T00:00:00Z"]],
    reportovali: [],
    ceka: true,
    proc: "klient, jehož nárok ještě ani nezačal, je tím spíš čerstvý",
  },
  {
    nazev: "starý nárok, ale report existuje",
    email: "jakub@example.com",
    grantOd: [["jakub@example.com", "2026-08-31T16:40:00Z"]],
    reportovali: ["jakub@example.com"],
    ceka: false,
    proc: "kdo reportoval, lhůtu neřeší vůbec (pojistka nesmí záviset na pořadí podmínek)",
  },
];

let selhalo = 0;
console.log("\n== cerstvy-klient (ochranná lhůta " + START_GRACE_DNI + " dní) ==");

for (const p of PRIPADY) {
  const mapa = new Map<string, number>();
  for (const [em, iso] of p.grantOd) {
    const t = Date.parse(iso);
    if (Number.isFinite(t)) mapa.set(em, t);
  }
  const vysledek = jeCerstvyKlient(p.email, mapa, new Set(p.reportovali), TED);
  if (vysledek === p.ceka) {
    console.log("  ok   " + p.nazev + " -> " + (vysledek ? "přeskočit" : "poslat"));
  } else {
    selhalo++;
    console.error("  PADÁ " + p.nazev + ": čekal " + p.ceka + ", dostal " + vysledek + " (" + p.proc + ")");
  }
}

// Pojistka proti tichému posunu konstanty: kdyby někdo lhůtu změnil, ať o tom ví.
if (START_GRACE_DNI !== 7) {
  selhalo++;
  console.error("  PADÁ START_GRACE_DNI se změnil na " + START_GRACE_DNI + ". Uprav hraniční testy i komentář.");
} else {
  console.log("  ok   START_GRACE_DNI je 7");
}

console.log(selhalo === 0 ? "\nHOTOVO: " + (PRIPADY.length + 1) + " kontrol, vše prošlo.\n" : "\nSELHALO: " + selhalo + "\n");
if (selhalo > 0) Deno.exit(1);
