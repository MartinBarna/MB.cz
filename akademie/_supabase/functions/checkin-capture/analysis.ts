// Barna Academy: deterministicka analyza tydenniho check-inu clena.
// PRINCIP: engine pocita, copy jen mluvi. Vsechna cisla a zavery vznikaji tady v kodu
// z realne vyplnenych dat. Duvod: predchozi verze tahala jednu z 8 fixnich vet z tabulky
// coaching_rules, takze doporuceni bylo skoro porad stejne a necitovalo zadna data clena.
// Vystup = 2 az 4 body: fakta z cisel, pochvala za realny fakt, jedna nejdulezitejsi zmena.

export type Checkin = {
  weight: number | null;
  waist: number | null;
  hips: number | null;
  steps: string | null;
  workouts: number | null;
  adherence: number | null;
  sleep: number | null;
  feeling: number | null;
  created_at?: string | null;
};

// desetinne cislo po cesku, bez zbytecne nuly: 0.6 -> "0,6", 2.0 -> "2"
const dec1 = (n: number) => n.toFixed(1).replace(/\.0$/, "").replace(".", ",");
const dayWord = (n: number) => (n === 1 ? "den" : n >= 2 && n <= 4 ? "dny" : "dní");
// "3 tréninky ... jsou" vs "5 tréninků ... je" (chip 5+ posila hodnotu 5)
const trainWord = (n: number) => (n <= 4 ? "tréninky" : "tréninků");
const trainVerb = (n: number) => (n <= 4 ? "jsou" : "je");

// chipy z formulare -> poradi (1 = nejmin) + text, kterym se na hodnotu odkazujeme
const STEPS: Record<string, { rank: number; label: string }> = {
  "do5k": { rank: 1, label: "do 5 000 kroků denně" },
  "5-8k": { rank: 2, label: "5 až 8 tisíc kroků denně" },
  "8-10k": { rank: 3, label: "8 až 10 tisíc kroků denně" },
  "10k+": { rank: 4, label: "přes 10 tisíc kroků denně" },
};
const stepsRank = (s: string | null) => (s && STEPS[s] ? STEPS[s].rank : 0);
const stepsLabel = (s: string | null) => (s && STEPS[s] ? STEPS[s].label : "");

/**
 * @param ci      prave odeslany check-in
 * @param history predchozi check-iny tehoz cloveka, od nejnovejsiho (bez toho aktualniho)
 * @param nowMs   cas odeslani (Date.now v produkci, fixni hodnota v testech)
 */
export function analyzeCheckin(ci: Checkin, history: Checkin[], nowMs: number): string[] {
  const prev = history.find((h) => !!h.created_at) ?? null;
  const days = prev?.created_at
    ? Math.max(1, Math.round((nowMs - Date.parse(prev.created_at)) / 86400000))
    : 0;

  const dWeight = prev && prev.weight != null && ci.weight != null ? ci.weight - prev.weight : null;
  const dWaist = prev && prev.waist != null && ci.waist != null ? ci.waist - prev.waist : null;
  const dHips = prev && prev.hips != null && ci.hips != null ? ci.hips - prev.hips : null;
  const rank = stepsRank(ci.steps);
  const adh = ci.adherence, slp = ci.sleep, feel = ci.feeling, wo = ci.workouts;
  const points: string[] = [];

  // ---- 1) FAKTA: co rikaji cisla proti minulemu check-inu ----
  if (!prev) {
    const abs: string[] = [];
    if (ci.weight != null) abs.push(`váha ${dec1(ci.weight)} kg`);
    if (ci.waist != null) abs.push(`pás ${dec1(ci.waist)} cm`);
    if (ci.hips != null) abs.push(`boky ${dec1(ci.hips)} cm`);
    points.push(abs.length
      ? `První check-in, takže srovnávat nemám s čím. Beru dnešek jako nulu: ${abs.join(", ")}. Od příště ti počítám rozdíl proti těmhle číslům.`
      : `První check-in, ale bez váhy i pásu nemám z čeho počítat. Příště vyplň aspoň jedno z nich.`);
  } else {
    const bits: string[] = [];
    if (dWeight != null && ci.weight != null) {
      bits.push(Math.abs(dWeight) < 0.3
        ? `váha stojí na ${dec1(ci.weight)} kg`
        : `váha ${dWeight < 0 ? "dolů" : "nahoru"} o ${dec1(Math.abs(dWeight))} kg`);
    }
    if (dWaist != null && ci.waist != null) {
      bits.push(Math.abs(dWaist) < 0.5
        ? `pás beze změny na ${dec1(ci.waist)} cm`
        : `pás ${dWaist < 0 ? "dolů" : "nahoru"} o ${dec1(Math.abs(dWaist))} cm`);
    } else if (dHips != null && Math.abs(dHips) >= 0.5) {
      bits.push(`boky ${dHips < 0 ? "dolů" : "nahoru"} o ${dec1(Math.abs(dHips))} cm`);
    }
    if (bits.length) {
      let t = `Za ${days} ${dayWord(days)} od minulého check-inu: ${bits.join(", ")}.`;
      // kratky interval + maly rozdil = sum, ne trend; rikame to rovnou, at z toho nedela zavery
      if (days <= 9 && dWeight != null && Math.abs(dWeight) < 1) {
        t += ` Za ${days} ${dayWord(days)} je ale takový rozdíl z velké části voda, trend čti až po dvou týdnech.`;
      }
      points.push(t);
    } else {
      points.push(`Minulý check-in máš ${days} ${dayWord(days)} zpátky, jenže porovnat čísla nejde: v jednom z nich chybí váha i pás.`);
    }
  }

  // ---- 2) CO SE DARI: prvni platny realny fakt, nikdy prazdna pochvala ----
  const win = (() => {
    if (dWaist != null && dWaist <= -1) {
      return `Nejdůležitější číslo je ten pás: dolů o ${dec1(Math.abs(dWaist))} cm znamená reálný úbytek tuku, ne kolísání vody.`;
    }
    if (dWeight != null && dWeight <= -0.3 && adh != null && adh >= 4) {
      return `Váha jde dolů a plán s jídlem držíš na ${adh} z 5. Tahle dvě čísla spolu souvisí, není to náhoda.`;
    }
    if (wo != null && wo >= 3) {
      return `${wo} ${trainWord(wo)} za týden ${trainVerb(wo)} nadprůměr, tréninkovou část máš vyřešenou.`;
    }
    if (rank >= 3) {
      return `Kroky máš ${stepsLabel(ci.steps)}, základní denní výdej je pokrytý.`;
    }
    if (adh != null && adh >= 4) {
      return `Plán s jídlem držíš na ${adh} z 5, což je nad tím, co zvládne většina lidí.`;
    }
    if (slp != null && slp >= 4) {
      return `Spánek ${slp} z 5. Regenerace je v pořádku a to je půlka výsledku.`;
    }
    if (history.length >= 2) {
      return `Tohle je nejmíň tvůj třetí check-in za sebou. Bez těch dat bych ti nic konkrétního napsat nemohl.`;
    }
    return null;
  })();
  if (win) points.push(win);

  // ---- 3) JEDNA VEC KE ZMENE: poradi = od nejvetsi brzdy po nejmensi ----
  let focus: string;
  if (slp != null && slp <= 2) {
    focus = `Jedna věc na tenhle týden: spánek, máš u něj ${slp} z 5. Nastav si pevný čas, kdy jdeš spát, a hodinu předtím pryč od telefonu. Nevyspalý člověk má vyšší chuť na sladké, tohle ti zlevní všechno ostatní.`;
  } else if (adh != null && adh <= 2) {
    focus = `Jedna věc na tenhle týden: jídlo, plán držíš na ${adh} z 5. Neřeš celý jídelníček. Vyber si jedno jídlo denně, které budeš mít pořád stejné a poctivé, bílkovina plus zelenina. Zbytek zatím nech být.`;
  } else if (feel != null && feel <= 2) {
    focus = `Jedna věc na tenhle týden: energie, hodnotíš se na ${feel} z 5. Zmenšíme krok, cíl je 10 minut venku každý den a nic víc. Až se to zvedne, vrátíme se k číslům.`;
  } else if (wo === 0) {
    const twoInRow = prev != null && prev.workouts === 0;
    focus = `Jedna věc na tenhle týden: rozjet trénink. ${twoInRow ? "Máš dva check-iny po sobě s nulou tréninků." : "Tenhle týden máš nula tréninků."} Cíl jsou dva krátké tréninky, klidně 20 minut doma. Teď je důležitější rozjezd než objem.`;
  } else if (rank === 1) {
    focus = `Jedna věc na tenhle týden: kroky. Máš ${stepsLabel(ci.steps)} a to je tvoje největší rezerva. Přidej 1 500 kroků denně, což je zhruba 15 minut chůze navíc, a jídlo zatím nech tak, jak je.`;
  } else if (days >= 12 && dWeight != null && Math.abs(dWeight) < 0.3 && (dWaist == null || Math.abs(dWaist) < 0.5)) {
    // stagnace na dost dlouhem intervalu, aby to nebyl sum: pakou je bud vydej, nebo mereni prijmu
    focus = rank === 2
      ? `Jedna věc na tenhle týden: za ${days} ${dayWord(days)} se váha ani pás nehnuly, příjem a výdej jsou tedy v rovnováze. Nejlevnější páka jsou kroky, máš ${stepsLabel(ci.steps)}, posuň se nad 8 tisíc.`
      : `Jedna věc na tenhle týden: za ${days} ${dayWord(days)} se váha ani pás nehnuly, příjem a výdej jsou tedy v rovnováze. Dva týdny važ tři hlavní jídla, ať víme, kolik toho reálně jde dovnitř. Bez toho jen hádáme.`;
  } else if (dWeight != null && dWeight >= 0.5 && days >= 12 && adh != null && adh >= 4) {
    focus = `Jedna věc na tenhle týden: váha nahoru o ${dec1(dWeight)} kg za ${days} ${dayWord(days)} při plánu na ${adh} z 5 nesedí. Projdi porce olejů, ořechů a tekutých kalorií, tam se schová 300 kcal denně, aniž by to bylo vidět.`;
  } else if (adh === 3) {
    focus = `Jedna věc na tenhle týden: jídlo, plán držíš na 3 z 5 a tam je teď největší prostor. Vyber si dva dny v týdnu, které jsou nejvíc rozhozené, a naplánuj si pro ně jídlo dopředu.`;
  } else if (wo === 1) {
    focus = `Jedna věc na tenhle týden: přidej druhý trénink. Jeden týdně je málo na to, aby se to projevilo na síle. Dvacet minut stačí, jde o frekvenci.`;
  } else if (rank === 2) {
    focus = `Jedna věc na tenhle týden: kroky. Máš ${stepsLabel(ci.steps)}, posuň se nad 8 tisíc. Je to nejlevnější výdej, který ti nesebere regeneraci na trénink.`;
  } else if (slp === 3) {
    focus = `Jedna věc na tenhle týden: spánek na 3 z 5 tě brzdí víc, než to vypadá. Čtrnáct dní choď spát o 30 minut dřív a uvidíme, co to udělá s chutí k jídlu.`;
  } else if (feel === 3) {
    focus = `Jedna věc na tenhle týden: cítíš se na 3 z 5, tedy nijak. Přidej jednu věc, která ti dělá dobře mimo trénink, a drž zbytek beze změny.`;
  } else {
    // nic nedrhne: nabidni jednu paku, kterou clovek jeste nema vytezenou
    const lever = rank > 0 && rank < 4
      ? "kroky o tisíc denně nahoru"
      : (wo != null && wo < 4 ? "jeden trénink navíc" : "15 minut chůze po večeři");
    focus = `Slabé místo v datech nevidím, čísla drží pohromadě. Nech nastavení beze změny a za týden porovnáme. Když chceš přitlačit, změň jedinou věc: ${lever}.`;
  }
  points.push(focus);

  // ---- 4) doplnek: co chybi v datech, nebo prilis velky odstup ----
  if (ci.waist == null) {
    points.push(`Příště změř i pás přes pupík. Váha sama kolísá o kilo podle vody a jídla, obvod pasu ukáže tuk spolehlivěji.`);
  } else if (days >= 21) {
    points.push(`Mezi check-iny je ${days} ${dayWord(days)}. Když je vyplníš po týdnu, čísla mají větší vypovídací hodnotu a doporučení sedí líp.`);
  }

  return points;
}
