// Testy ochranné lhůty po pozvání klienta (15. 9. 2026).
// Spuštění: npx --yes deno@2 run akademie/_supabase/functions/client-remind/cerstvy-klient.test.ts
// (bez jakýchkoli --allow-*: test nečte síť, disk ani proměnné prostředí)
//
// ⭐ KONTRAST je smysl těchhle testů: bez něj by stačilo vracet pořád true (nikomu nic)
//    nebo pořád false (oprava by nic nedělala) a testy by byly zelené.
import {
  jeCerstvyKlient,
  preskocitVyzvuKReportu,
  PRVNI_VYZVA_PO_DNECH,
  START_GRACE_DNI,
  START_MAX_DNU_DOPREDU,
} from "./cerstvy-klient.ts";

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


// =============================================================================
// DÁVKA 9 (15. 9. 2026): `preskocitVyzvuKReportu` nad zadaným `entitlements.start_at`.
//
// ⭐ KONTRAST je i tady smysl testů. Změřené mutace (zanesené do kopie modulu mimo
//    worktree, výsledky v BUILD-davka9-admin.md):
//      a) funkce vrací vždy { preskocit:false }        -> padá 12 kontrol
//      b) funkce vrací vždy { preskocit:true }         -> padá 9 kontrol
//      c) vypuštěná podmínka `nekdyReportoval`         -> padá 1 kontrola 
//      d) práh 7 místo 6                               -> padá 2 kontroly
//      e) vypuštěná pojistka START_MAX_DNU_DOPREDU     -> padá 2 kontroly
// =============================================================================

type PripadS = {
  nazev: string;
  email: string;
  startOd: [string, string][]; // e-mail + hodnota `start_at`, jak ji vrací PostgREST
  grantOd: [string, string][];
  reportovali: string[];
  ceka: boolean;
  duvod: "start" | "narok" | "";
  proc: string;
};

const JA = "klient@example.com";
const den = (n: number) => new Date(TED + n * DEN).toISOString().slice(0, 10);

const PRIPADY_START: PripadS[] = [
  // --- ZADANÝ START ROZHODUJE ---
  {
    nazev: "start v budoucnu",
    email: JA,
    startOd: [[JA, den(7)]],
    grantOd: [[JA, "2026-08-01T10:00:00Z"]],
    reportovali: [],
    ceka: true,
    duvod: "start",
    proc: "klient, který teprve začne, nemá co reportovat, i kdyby nárok měl měsíc",
  },
  {
    nazev: "start dnes",
    email: JA,
    startOd: [[JA, den(0)]],
    grantOd: [],
    reportovali: [],
    ceka: true,
    duvod: "start",
    proc: "v den startu je za klientem nula dní koučinku",
  },
  {
    nazev: "hranice: start před 5 dny",
    email: JA,
    startOd: [[JA, den(-5)]],
    grantOd: [],
    reportovali: [],
    ceka: true,
    duvod: "start",
    proc: "pátý den je poslední uvnitř lhůty (práh je 6)",
  },
  {
    nazev: "hranice: start před 6 dny",
    email: JA,
    startOd: [[JA, den(-6)]],
    grantOd: [],
    reportovali: [],
    ceka: false,
    duvod: "start",
    proc: "šestý den je první, kdy výzva projde; obě strany hranice musí být v testu",
  },
  {
    nazev: "start dávno",
    email: JA,
    startOd: [[JA, den(-40)]],
    grantOd: [],
    reportovali: [],
    ceka: false,
    duvod: "start",
    proc: "běžný klient dostává výzvu dál",
  },

  // --- KDO REPORTOVAL, TOMU SE NESAHÁ (první podmínka v pořadí) ---
  {
    nazev: "start před 5 dny, ale klient už reportoval",
    email: JA,
    startOd: [[JA, den(-5)]],
    grantOd: [],
    reportovali: [JA],
    ceka: false,
    duvod: "",
    proc: "převáděný klient z Excelu posílá reporty roky; nový start ho ztišit nesmí",
  },

  // --- NÁHRADA Z `granted_at` ŽIJE DÁL ---
  {
    nazev: "bez startu, nárok starý 2 dny",
    email: JA,
    startOd: [],
    grantOd: [[JA, new Date(TED - 2 * DEN).toISOString()]],
    reportovali: [],
    ceka: true,
    duvod: "narok",
    proc: "klient bez zadaného startu se chová přesně jako před dávkou 9",
  },
  {
    nazev: "bez startu, nárok starý 10 dní",
    email: JA,
    startOd: [],
    grantOd: [[JA, new Date(TED - 10 * DEN).toISOString()]],
    reportovali: [],
    ceka: false,
    duvod: "narok",
    proc: "stará náhrada pustí výzvu po sedmi dnech, na tom se nic nemění",
  },

  // --- DATOVÁ ANOMÁLIE: START SE NESMÍ STÁT PASTÍ ---
  {
    nazev: "start 400 dní v budoucnu (překlep v roce)",
    email: JA,
    startOd: [[JA, den(400)]],
    grantOd: [[JA, new Date(TED - 10 * DEN).toISOString()]],
    reportovali: [],
    ceka: false,
    duvod: "narok",
    proc: "překlep by klienta umlčel na rok a nikde by to nekřiklo; padá se na náhradu",
  },
  {
    nazev: "start 400 dní v budoucnu, nárok čerstvý",
    email: JA,
    startOd: [[JA, den(400)]],
    grantOd: [[JA, new Date(TED - 2 * DEN).toISOString()]],
    reportovali: [],
    ceka: true,
    duvod: "narok",
    proc: "po pádu na náhradu rozhoduje nárok, ne ignorovaný start",
  },
  {
    nazev: "start těsně uvnitř pojistky (89 dní)",
    email: JA,
    startOd: [[JA, den(89)]],
    grantOd: [[JA, new Date(TED - 30 * DEN).toISOString()]],
    reportovali: [],
    ceka: true,
    duvod: "start",
    proc: "start do 90 dnů je pořád důvěryhodný a rozhoduje on, ne nárok",
  },
  {
    nazev: "nečitelný start (20.9.2026)",
    email: JA,
    startOd: [[JA, "20.9.2026"]],
    grantOd: [[JA, new Date(TED - 10 * DEN).toISOString()]],
    reportovali: [],
    ceka: false,
    duvod: "narok",
    proc: "nečitelné datum se do mapy nedostane; ticho místo mailu není přípustné",
  },
  {
    nazev: "prázdný start",
    email: JA,
    startOd: [[JA, ""]],
    grantOd: [[JA, new Date(TED - 2 * DEN).toISOString()]],
    reportovali: [],
    ceka: true,
    duvod: "narok",
    proc: "prázdná hodnota znamená nezadáno, ne nulu, a náhrada platí dál",
  },
];

console.log("\n== preskocitVyzvuKReportu (start " + PRVNI_VYZVA_PO_DNECH + " dní, pojistka " + START_MAX_DNU_DOPREDU + " dní) ==");

// Mapa startů se plní PŘESNĚ tak, jak to dělá `client-remind/index.ts`: `date` z PostgRESTu
// je "2026-09-20", doplní se na půlnoc UTC, nečitelné se přeskočí. Kdyby se to tu rozešlo,
// testy by měřily něco jiného, než co běží v produkci.
function mapaStartu(dvojice: [string, string][]): Map<string, number> {
  const m = new Map<string, number>();
  for (const [em, hodnota] of dvojice) {
    const s = String(hodnota ?? "").trim();
    if (!s) continue;
    const t = Date.parse(s.length === 10 ? s + "T00:00:00Z" : s);
    if (!Number.isFinite(t)) continue;
    const drive = m.get(em);
    if (drive === undefined || t < drive) m.set(em, t);
  }
  return m;
}

for (const p of PRIPADY_START) {
  const grant = new Map<string, number>();
  for (const [em, iso] of p.grantOd) {
    const t = Date.parse(iso);
    if (Number.isFinite(t)) grant.set(em, t);
  }
  const r = preskocitVyzvuKReportu(p.email, mapaStartu(p.startOd), grant, new Set(p.reportovali), TED);
  if (r.preskocit === p.ceka && r.duvod === p.duvod) {
    console.log("  ok   " + p.nazev + " -> " + (r.preskocit ? "přeskočit" : "poslat") + (r.duvod ? " (" + r.duvod + ")" : ""));
  } else {
    selhalo++;
    console.error("  PADÁ " + p.nazev + ": čekal " + p.ceka + "/" + p.duvod
      + ", dostal " + r.preskocit + "/" + r.duvod + " (" + p.proc + ")");
  }
}

// `date` i `timestamptz` musí dát tentýž výsledek. Sloupec je dnes `date`, ale kdyby ho
// někdo přetypoval, PostgREST začne vracet plné ISO a práh se nesmí posunout.
{
  const jenDen = preskocitVyzvuKReportu(JA, mapaStartu([[JA, den(-5)]]), new Map(), new Set(), TED);
  const plneIso = preskocitVyzvuKReportu(JA, mapaStartu([[JA, den(-5) + "T00:00:00+00:00"]]), new Map(), new Set(), TED);
  if (jenDen.preskocit === plneIso.preskocit && jenDen.duvod === plneIso.duvod) {
    console.log("  ok   date i timestamptz dávají tentýž výsledek");
  } else {
    selhalo++;
    console.error("  PADÁ date vrací " + jenDen.preskocit + ", timestamptz " + plneIso.preskocit);
  }
}

// Pojistka proti tichému posunu prahu: hraniční případy výš stojí na šestce.
if (PRVNI_VYZVA_PO_DNECH !== 6) {
  selhalo++;
  console.error("  PADÁ PRVNI_VYZVA_PO_DNECH se změnil na " + PRVNI_VYZVA_PO_DNECH + ". Uprav hraniční testy (den -5 a -6) i komentář.");
} else {
  console.log("  ok   PRVNI_VYZVA_PO_DNECH je 6");
}
if (START_MAX_DNU_DOPREDU !== 90) {
  selhalo++;
  console.error("  PADÁ START_MAX_DNU_DOPREDU se změnil na " + START_MAX_DNU_DOPREDU + ". Uprav test „89 dní\" i validaci v admin-api.");
} else {
  console.log("  ok   START_MAX_DNU_DOPREDU je 90");
}

console.log(
  selhalo === 0
    ? "\nHOTOVO: " + (PRIPADY.length + 1 + PRIPADY_START.length + 3) + " kontrol, vše prošlo.\n"
    : "\nSELHALO: " + selhalo + "\n",
);
if (selhalo > 0) Deno.exit(1);
