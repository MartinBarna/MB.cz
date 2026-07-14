// =============================================================================
// AI Martin (Academy web) — deterministický safety PRE-FLAG.
// Přeneseno 1:1 z appky Tvůj Coach (supabase/functions/ai-martin/preflag.ts),
// aby webový chatbot i appka sdílely STEJNOU bezpečnostní vrstvu (spec §8).
// ČISTÝ modul bez importů → běží v Deno (Edge Function) i v Node (testy).
// Kategorie: pregnancy | eating_disorder | medical | crisis | minor
// =============================================================================

export type FlagCategory = 'pregnancy' | 'eating_disorder' | 'medical' | 'crisis' | 'minor';

export type PreflagResult = {
  flagged: boolean;
  safeMode: boolean; // = flagged (jakékoli riziko → opatrný režim)
  categories: FlagCategory[];
  primary: FlagCategory | null;
  matched: string[];
};

/** Normalizace: lowercase + bez diakritiky + sjednocené mezery (robustní match). */
function norm(s: string): string {
  return (s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Substringové signály (psané bez diakritiky, protože text je normalizovaný).
const SUBSTR: Record<FlagCategory, string[]> = {
  pregnancy: [
    'tehotn', 'otehotn', 'kojim', 'kojen', 'v jinem stavu', 'cekam miminko', 'cekam dite',
    'pregnant', 'breastfeed',
  ],
  eating_disorder: [
    // [harden 2026-07-14 v2] holé 'hladov'/'vyhladov' flagovalo „jsem hladová/vyhladovělá" (běžný hlad)
    // jako ED hard-stop → zúženo na hladovění-jako-restrikci ('hladovim/is' = 1./2. os. — chování,
    // ne stav; minulý čas a úmysl chytá HUNGER_INTENT_RE). 'o hlade'/'hladoven' vyřazeno (benigní
    // „kardio o hladě?", „zhubnout bez hladovění"). Nevolnost ('zvrac') je medical; purging drží
    // PURGE_*_RE. 'bojim se jist' = ED red flag (strach z jídla).
    'vyzvrac', 'vyzvrat', 'vybli', 'poblit', 'poblil', 'poblij', 'purg', 'projimadl',
    'laxativ', 'bulimi', 'anorex', 'obsesivn', 'hladovk', 'hladovim', 'hladovis', 'vyhladovet',
    'drzet hlad', 'bojim se jist', 'strach z jidla', 'strach se najist',
  ],
  medical: [
    'stitn', 'hashimot', 'pcos', 'polycystick', 'inzulinova rezistence', 'inzulinov',
    'apnoe', 'depres', 'uzkost', 'cukrovk', 'diabet', 'celiaki', 'crohn', 'zvrac',
    'antidepres', 'metformin', 'levothyrox', 'eutyrox', 'ozempi', 'semaglutid', 'mounjaro',
    'statin', 'antikoncepc', 'warfarin',
    // [harden 2026-07-14] GLP-1/hubnoucí léky (kmeny kvůli skloňování: saxend = Saxenda/Saxendu/Saxendě):
    'wegovy', 'saxend', 'liraglutid', 'tirzepatid', 'zepbound', 'retatrutid', 'glp-1', 'glp1',
    // orgánová onemocnění a onkologie (běžná čísla 1,6–2,2 g/kg tu nemusí platit).
    // POZOR: 'jatern' bylo moc široké („jaternice", „jaterní paštika" = jídlo!) → vázáno na nemoc.
    'ledvin', 'nemoc jater', 'nemocna jatra', 'jaterni onemocnen', 'selhani jater', 'jaterni test',
    'jaterni hodnot', 'cirhoz', 'ztukovatel', 'onkolog', 'chemoterap', 'dialyz',
    'tyreo', 'hypotyr', 'hypertyr', 'struma',
    // antidepresiva (účinné látky, které lidi píšou jménem):
    'escitalopram', 'sertralin', 'citalopram', 'venlafaxin', 'bupropion', 'wellbutrin',
    // kardio signály (stimulanty/spalovače u rizikových lidí):
    'arytmi', 'buseni srdce', 'busi mi srdce', 'vysoky tlak', 'hypertenz',
    // doping / PED (SYSTEM to odmítá; safe-mode navíc hlídá čísla). 'testosteron'/'sarm'/'inzulin'/
    // 'rakovin' jsou v MED_CONTEXT_RE (holé slovo = běžný vzdělávací dotaz, nemá degradovat odpověď).
    // [sync 2026-07-14 s appkou Tvůj Coach — app preflag.ts = zdroj pravdy, byte-parity]:
    'steroid', 'anabol', 'prohormon', 'klenbuterol', 'clenbuterol',
    'efedrin', 'ephedrin', 'trenbolon', 'dianabol', 'oxandrolon',
    'ostarine', 'yohimbin', 'spalovac tuku', 'stanozolol', 'nandrolon', 'eca stack',
    'prasky na', 'prasek na', 'lek na', 'leky na', 'beru lek', 'vysadit lek', 'vysadit prasky',
    'vysazeni lek', 'na predpis',
  ],
  crisis: [
    'sebevrazd', 'zabit se', 'zabit sebe', 'se zabit', 'zabiju se', 'zabil bych', 'zabila bych',
    'chci umrit', 'chci zemrit', 'chci chcipnout', 'nechci zit', 'nechci uz zit', 'nechci tu byt',
    'ublizit si', 'sebeposkoz', 'podrezat', 'ukoncit svuj zivot', 'nemam duvod zit',
    'nema smysl zit', 'skoncit se zivotem',
  ],
  minor: ['nezletil'],
};

// Minimalizace příjmu VÁZANÁ na jídlo (ať „nejmíň 2 l vody" neflagujeme jako ED).
// `\bjak malo` = hranice slova → chytne „JAK MÁLO můžu jíst" (restrikce), ale NE „neJAK MÁLO
// kcal" (= trochu málo, běžná poznámka ke kaloriím jídla). Bez \b to bylo falešně pozitivní.
// [safety-sync 2026-07-14: zrcadleno z app supabase/functions/ai-martin/preflag.ts, app = zdroj pravdy]
const RESTRICTION_RE: RegExp[] = [
  /(nejmin|co nejmene|\bjak malo|nejmensi)[^.!?]{0,40}(jist|jidl|kalori|kcal|snist|prijem|jest)/,
  /(jist|jidl|kalori|kcal|prijem|snist|jest)[^.!?]{0,40}(nejmin|co nejmene|\bjak malo|nejmensi)/,
];
const PURGE_MATH_RE: RegExp[] = [
  /vstreba[^.!?]{0,40}(zvrac|vyzvrac|vyzvrat)/,
  /(zvrac|vyzvrac|vyzvrat)[^.!?]{0,40}(vstreba|kalori|kcal)/,
];
// [harden 2026-07-14 v2] zvracení V KONTEXTU JÍDLA = purging (ED); holá nevolnost je jen medical.
// Idiom „na zvracení / k zvracení" (nevolnost) vylučuje lookbehind PŘÍMO u výskytu — ne globální
// vypínač celé zprávy (ten se dal obejít přilepením idiomu k purge dotazu).
const PURGE_FOOD_RE: RegExp[] = [
  /(po jidle|jidl|najim)[^.!?]{0,40}(?<!na )(?<!k )zvrac/,
  /(?<!na )(?<!k )zvrac[^.!?]{0,40}(po jidle|jidl)/,
];
// Záměrné zvracení (i bez zmínky jídla) = ED: „nutím se zvracet", „vyvolávám zvracení", „zvracím schválně".
const PURGE_INTENT_RE: RegExp[] = [
  /(nutim|nutit|schvalne|vyvola)[^.!?]{0,40}zvrac/,
  /zvrac[^.!?]{0,40}(schvalne|abych zhub|zhubn|hubnut)/,
];
// Hladovění s úmyslem (slovesa/minulý čas s restriktivním kontextem) = ED; benigní „jsem vyhladovělá"
// nebo „zhubnout bez hladovění" projde.
const HUNGER_INTENT_RE: RegExp[] = [
  /\b(chci|budu|zkusim|radsi|zacnu|jedu|drzim)\b[^.!?]{0,30}hladovet/,
  /(vy)?hladovel[aiy]?\b[^.!?]{0,40}(schvalne|abych|zhub|cely tyden|cele dny|tyden|dny)/,
  /(cely den|cele dny|kazdy den|porad|furt)[^.!?]{0,30}(o hlade|hladov)/,
  /hladoven[^.!?]{0,35}(vyhovuje|funguje|jedu|zvyk|super|v pohode)/,
  /(vyhovuje|funguje|zvykl)[^.!?]{0,25}hladoven/,
];
// [harden 2026-07-14] ztráta/vynechání menstruace při hubnutí = zdravotní varovný signál (RED-S).
const MENSTRUATION_RE: RegExp[] = [
  /(nepri(sla|jde)|vynech|ztrat|zmizel|prestal|nemam|nedostav)[^.!?]{0,40}menstruac/,
  /menstruac[^.!?]{0,40}(neprisla|neprijde|vynech|ztrat|zmizel|prestal)/,
];
// [harden 2026-07-14 v2] medical signály, kde holé slovo = běžný vzdělávací dotaz (nedegradovat
// odpověď safe-modem), ale kontext užívání/nemoci flagovat: testosteron (PED užívání), inzulin
// (píchání), SARM (slovo, ne „šarmantní"), rakovina (ne „rakovinotvorný" mýty).
const MED_CONTEXT_RE: RegExp[] = [
  /(beru|picham|koupit|koupim|shanim|shanet|davkov|kur[au]|cyklus|doplnit|nasadit)[^.!?]{0,30}testosteron/,
  /testosteron[^.!?]{0,30}(kur[au]|picha|injek|davk|cyklus|nasadit)/,
  /(picham|beru|aplikuj|davkuj)[^.!?]{0,25}inzulin/,
  /na inzulinu/,
  // [sync 2026-07-14 app] \bsarm[sy]?\b — dřívější (?![a-z]{4,}) flagoval jídlo „sarma" (holubky)
  /\bsarm[sy]?\b/,
  /rakovin(?!otvor)/,
];
// [sync 2026-07-14 app] látky, které musí být word-boundary (DNP = smrtelné i v malé dávce,
// ale „dnp" se jinak vyskytuje ve zkratkách) → medical.
const SUBSTANCE_RE: RegExp[] = [
  /\bdnp\b/,
];

/** Zmínka o věku < 18.
 * [harden 2026-07-14 v2] „mám 15 kg nadváhy" flagovalo nezletilost → číslo následované jednotkou
 * (kg/kilo/cm/%/kcal) se za věk nepovažuje. Holé „mám 16" BEZ jednotky flagujeme dál (hovorové
 * udání věku; falešný poplach stojí jen levný safe-mode, minutý nezletilý je chráněná kategorie). */
function detectMinorAge(t: string): boolean {
  const re = /\b(je mi|mam|je ji|je mu|dceri je|synovi je|je jim)\s+(\d{1,2})\b(\s*(kg|kilo|kila|kil|cm|%|kcal|let|roku|roky))?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(t)) !== null) {
    const n = Number(m[2]);
    const unit = (m[4] ?? '').trim();
    if (n < 5 || n > 17) continue;
    if (['kg', 'kilo', 'kila', 'kil', 'cm', '%', 'kcal'].includes(unit)) continue; // jednotka ≠ věk
    return true;
  }
  return false;
}

const SEVERITY: FlagCategory[] = ['crisis', 'eating_disorder', 'medical', 'pregnancy', 'minor'];

/** Deterministický pre-flag vstupní zprávy. */
export function preflagMessage(text: string): PreflagResult {
  const t = norm(text);
  if (!t) return { flagged: false, safeMode: false, categories: [], primary: null, matched: [] };

  const categories = new Set<FlagCategory>();
  const matched: string[] = [];

  (Object.keys(SUBSTR) as FlagCategory[]).forEach((cat) => {
    for (const kw of SUBSTR[cat]) {
      if (t.includes(kw)) { categories.add(cat); matched.push(`${cat}:${kw}`); }
    }
  });
  for (const re of RESTRICTION_RE) {
    if (re.test(t)) { categories.add('eating_disorder'); matched.push('eating_disorder:restriction'); }
  }
  for (const re of PURGE_MATH_RE) {
    if (re.test(t)) { categories.add('eating_disorder'); matched.push('eating_disorder:purge_math'); }
  }
  for (const re of PURGE_FOOD_RE) {
    if (re.test(t)) { categories.add('eating_disorder'); matched.push('eating_disorder:purge_food'); }
  }
  for (const re of PURGE_INTENT_RE) {
    if (re.test(t)) { categories.add('eating_disorder'); matched.push('eating_disorder:purge_intent'); }
  }
  for (const re of HUNGER_INTENT_RE) {
    if (re.test(t)) { categories.add('eating_disorder'); matched.push('eating_disorder:hunger_intent'); }
  }
  for (const re of MENSTRUATION_RE) {
    if (re.test(t)) { categories.add('medical'); matched.push('medical:menstruation'); }
  }
  for (const re of MED_CONTEXT_RE) {
    if (re.test(t)) { categories.add('medical'); matched.push('medical:context'); }
  }
  for (const re of SUBSTANCE_RE) {
    if (re.test(t)) { categories.add('medical'); matched.push('medical:substance'); }
  }
  if (detectMinorAge(t)) { categories.add('minor'); matched.push('minor:age'); }

  const cats = SEVERITY.filter((c) => categories.has(c));
  const flagged = cats.length > 0;
  return { flagged, safeMode: flagged, categories: cats, primary: cats[0] ?? null, matched };
}
