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
    'zvrac', 'vyzvrac', 'vyzvrat', 'vybli', 'poblit', 'poblil', 'poblij', 'purg', 'projimadl',
    'laxativ', 'bulimi', 'anorex', 'obsesivn', 'pocitam kazdou kalor', 'hladov', 'hladovk', 'vyhladov',
  ],
  medical: [
    'stitn', 'hashimot', 'pcos', 'polycystick', 'inzulinova rezistence', 'inzulinov',
    'apnoe', 'depres', 'uzkost', 'cukrovk', 'diabet', 'celiaki', 'crohn',
    'antidepres', 'metformin', 'levothyrox', 'eutyrox', 'ozempic', 'semaglutid', 'mounjaro',
    'statin', 'antikoncepc', 'warfarin',
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
const RESTRICTION_RE: RegExp[] = [
  /(nejmin|co nejmene|jak malo|nejmensi)[^.!?]{0,40}(jist|jidl|kalori|kcal|snist|prijem|jest)/,
  /(jist|jidl|kalori|kcal|prijem|snist|jest)[^.!?]{0,40}(nejmin|co nejmene|jak malo|nejmensi)/,
];
const PURGE_MATH_RE: RegExp[] = [
  /vstreba[^.!?]{0,40}(zvrac|vyzvrac|vyzvrat)/,
  /(zvrac|vyzvrac|vyzvrat)[^.!?]{0,40}(vstreba|kalori|kcal)/,
];

/** Zmínka o věku < 18. */
function detectMinorAge(t: string): boolean {
  const re = /\b(je mi|mam|je ji|je mu|dceri je|synovi je|je jim)\s+(\d{1,2})\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(t)) !== null) {
    const n = Number(m[2]);
    if (n >= 5 && n <= 17) return true;
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
  if (detectMinorAge(t)) { categories.add('minor'); matched.push('minor:age'); }

  const cats = SEVERITY.filter((c) => categories.has(c));
  const flagged = cats.length > 0;
  return { flagged, safeMode: flagged, categories: cats, primary: cats[0] ?? null, matched };
}
