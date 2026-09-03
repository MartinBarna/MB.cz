// =============================================================================
// AI Martin — deterministický safety PRE-FLAG (spec §8, vrstva A).
// ČISTÝ modul bez importů → běží v Deno (Edge Function) i v Node (testy).
// SDÍLENÝ appkou (Tvůj Coach: ai-martin i ai-coach-agent) i webem (Academy).
//
// [safety-sync 2026-07-14] Sjednoceno s web-Claudovou v2 (MB.cz web-ai-martin-handoff,
// de0ac3ca): zúžené false-alarmy (hladov/zvrac/věk), PURGE/HUNGER intent regexy, RED-S,
// MED_CONTEXT_RE (kontext užívání vs. vzdělávací dotaz). App = ZDROJ PRAVDY: nad web verzí
// navíc `\bdnp\b` (DNP je i v malé dávce smrtelné — web ho neměl) a PED substringy specifické
// pro food-appku (ostarine/yohimbin/spalovač/stanozolol/nandrolon/eca stack). Drž identické s webem.
//
// [safety-sync 2026-09-03] SJEDNOCENO NAPRIC TREMI KOPIEMI. Zmereno tento den:
//  * appka ai-coach-agent (importuje tenhle soubor) = tahle verze, nejnovejsi;
//  * appka ai-martin nasazena zive (kfkmghvhqwqtsalqjmrp) = tahle verze MINUS FASTING_INTENT_RE;
//  * Academy ai-martin (uhmrpfsdcujbhbtumqye), git i ziva verze, jsou shodne mezi sebou
//    a proti teto verzi jim chybi FASTING_INTENT_RE a substring 'anabolik'.
// Zadna z ostatnich kopii nema nic, co tady chybi. Rozdily 'hladovk' a 'drzet hlad'
// jsou ZAMERNE SMAZANE (viz duvod u eating_disorder nize), nevracet je pri sjednocovani.
// Kdo sahne na tenhle soubor, nasazuje vsechny tri funkce, nebo napise proc se druha strana netyka.
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
    // [safety 2026-08-19] mezery z adversariálních testů: množné číslo a eufemismus.
    'cekame miminko', 'cekame dite', 'jsem v ocekavani',
    'pregnant', 'breastfeed',
  ],
  eating_disorder: [
    // [harden 2026-07-14 v2] holé 'hladov'/'vyhladov' flagovalo „jsem hladová/vyhladovělá" (běžný hlad)
    // jako ED hard-stop → zúženo na hladovění-jako-restrikci ('hladovim/is' = 1./2. os. — chování,
    // ne stav; minulý čas a úmysl chytá HUNGER_INTENT_RE). 'o hlade'/'hladoven' vyřazeno (benigní
    // „kardio o hladě?", „zhubnout bez hladovění"). Nevolnost ('zvrac') je medical; purging drží
    // PURGE_*_RE. 'bojim se jist' = ED red flag (strach z jídla).
    'vyzvrac', 'vyzvrat', 'vybli', 'poblit', 'poblil', 'poblij', 'purg', 'projimadl',
    'laxativ', 'bulimi', 'anorex', 'ortorex',
    // Samotne sousloví se dosud neflagovalo, chytaly se jen konkretni diagnozy.
    // ⛔ [revize 2026-09-03] `hladovk` a `drzet hlad` ODSTRANĚNY ze substringů.
    // Změřeno naostro na testovacím účtu: „Dneska jsem to přehnala, snědla jsem 2 800 kcal.
    // Mám zítra držet hladovku?" dostala za 1,0 s hard-stop s odkazem na Anabell, tedy
    // zdravý člověk po jednom přejedení byl poslán do péče pro poruchy příjmu potravy
    // a na svou otázku nedostal odpověď vůbec. Substring neumí rozlišit DOTAZ NA RADU
    // („mám držet hladovku?", „je hladovka dobrá?") od ROZHODNUTÍ („budu držet hladovku").
    // Úmysl teď řeší `FASTING_INTENT_RE` níž; dotaz jde do normální odpovědi, kde na něj
    // má systémový prompt vlastní pravidlo (PŘEJEDENÍ A HLADOVKA JAKO DOTAZ).
    // ⚠️ `hladovim` / `hladovis` / `vyhladovet` ZŮSTÁVAJÍ: to už jsou slovesné tvary
    // o chování, ne podstatné jméno z otázky.
    'porucha prijmu potravy', 'poruchu prijmu potravy', 'poruchou prijmu potravy', 'poruch prijmu potravy', 'obsesivn', 'hladovim', 'hladovis', 'vyhladovet',
    'bojim se jist', 'strach z jidla', 'strach se najist',
    // [safety 2026-08-19] mezery z adversariálních testů: vina po jídle a dokonavý vid.
    'bojim se najist', 'vycitam si jidl', 'po jidle si vycitam',
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
    // 'rakovin' jsou v MED_CONTEXT_RE (holé slovo = běžný vzdělávací dotaz, nemá degradovat odpověď):
    'steroid', 'anabolik', 'anabol', 'prohormon', 'klenbuterol', 'clenbuterol',
    'efedrin', 'ephedrin', 'trenbolon', 'dianabol', 'oxandrolon',
    // [app 2026-07-14] PED/spalovače specifické pro food-appku (web je zatím nemá — sync zpět):
    'ostarine', 'yohimbin', 'spalovac tuku', 'stanozolol', 'nandrolon', 'eca stack',
    'prasky na', 'prasek na', 'lek na', 'leky na', 'beru lek', 'vysadit lek', 'vysadit prasky',
    'vysazeni lek', 'na predpis',
  ],
  crisis: [
    'sebevrazd', 'zabit se', 'zabit sebe', 'se zabit', 'zabiju se', 'zabil bych', 'zabila bych',
    'chci umrit', 'chci zemrit', 'chci chcipnout', 'nechci zit', 'nechci uz zit', 'nechci tu byt',
    'ublizit si', 'sebeposkoz', 'podrezat', 'ukoncit svuj zivot', 'nemam duvod zit',
    'nema smysl zit', 'skoncit se zivotem',
    // [safety 2026-08-19] mezera z adversariálních testů: obrácený slovosled a 1. osoba
    // („chci si ublížit", „ublížím si"), + konkrétní krizová fráze se „zmizet".
    // ⛔ Holé 'zmizet'/'nezvladam' sem NEpatří (běžná řeč o dietě, false positives).
    'si ublizit', 'si ublizim', 'ublizim si',
    'chci zmizet', 'chtel bych zmizet', 'chtela bych zmizet',
    'nemam duvod dal zit', 'skoncim se zivotem', 'radsi bych tu nebyl', 'radsi bych tu nebyla',
  ],
  minor: ['nezletil'],
};

// Minimalizace příjmu VÁZANÁ na jídlo (ať „nejmíň 2 l vody" neflagujeme jako ED).
// `\bjak malo` = hranice slova → chytne „JAK MÁLO můžu jíst" (restrikce), ale NE „neJAK MÁLO
// kcal" (= trochu málo, běžná poznámka ke kaloriím jídla).
// `nejnizsi` = synonymum k `nejmensi`, které tu chybělo → „nejnižší rozumný denní
// energetický příjem" proklouzlo (živý smoke, 17. 7.). Doplněno, ať jsou synonyma úplná.
const RESTRICTION_RE: RegExp[] = [
  /(nejmin|co nejmene|\bjak malo|nejmensi|nejnizsi)[^.!?]{0,40}(jist|jidl|kalori|kcal|snist|prijem|jest)/,
  /(jist|jidl|kalori|kcal|prijem|snist|jest)[^.!?]{0,40}(nejmin|co nejmene|\bjak malo|nejmensi|nejnizsi)/,
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
/**
 * [revize 2026-09-03] HLADOVKA JAKO ÚMYSL, ne jako slovo v otázce.
 *
 * Flaguje jen ROZHODNUTÍ v 1. osobě („budu držet hladovku", „držím hladovku",
 * „vyhladovím se", „nebudu jíst"). Otázka na radu („mám držet hladovku?",
 * „je hladovka dobrá?", „vyplatí se hladovka?") projde do normální odpovědi.
 *
 * ⛔ Sloveso musí stát PŘED slovem hladovka a hned u něj, jinak by „chci vědět,
 * jestli hladovka funguje" sepnulo jako úmysl (proto tu není holé „chci").
 * ⛔ U „nebudu jíst" vylučuje lookahead jídlo v předmětu („nebudu jíst maso",
 * „nechci jíst lepek"): to je volba skladby, ne hladovění.
 */
const FASTING_INTENT_RE: RegExp[] = [
  // ⛔ [po druhé revizi 3. 9. 2026] Mezi slovesem a „hladovk" smí stát „se" a „na":
  // „Chystám se na hladovku." starý filtr chytil (substring `hladovk`) a první verze
  // téhle opravy ho pustila, protože vyžadovala `hladovk` hned za slovesem. Regrese.
  /\b(budu|zacnu|zacinam|planuju|chystam|chystam se|dam si|davam si|jedu|jdu|drzim|drzel jsem|drzela jsem)\s+(se\s+)?(na\s+)?(zitra\s+|dnes\s+|dneska\s+|od zitrka\s+)?(drzet\s+)?hladovk/,
  /\bhladovk\w*\s+(drzim|budu drzet|si davam|jedu)\b/,
  // ⛔ [po druhé revizi] Náhrada za smazaný substring `drzet hlad`: bez slovesa je to
  // otázka („mám držet hlad?"), se slovesem rozhodnutí („budu držet hlad až do večera").
  // Starý filtr tuhle větu chytal a první verze opravy ji pustila. Druhá regrese.
  /\b(budu|zacnu|zacinam|planuju|chystam se|jdu|drzim|drzel jsem|drzela jsem)\s+(se\s+)?(drzet\s+)?hlad\b/,
  // „jdu hladovět", „zkusím hladovět" doplňuje HUNGER_INTENT_RE, kde tahle slovesa nebyla.
  /\b(jdu|chystam se|planuju)\s+(se\s+)?hladovet\b/,
  /\bvyhladovim\b/,
  /\b(nebudu|nechci)\s+(uz\s+)?(nic\s+)?(zitra\s+|dnes\s+|dneska\s+)?jist\b(?!\s*(maso|lepek|mlec|mleko|sacharid|cukr|pecivo|smazen|ryb|vejc|syr|orech|luste|zelenin|ovoce|chleb|tucn|slad|po sedme|po sesté|po seste|vecer))/,
  /\b(nejim|nebudu jist)\s+(cely den|cele dny|do vecera|nic)\b/,
];
// [harden 2026-07-14] ztráta/vynechání menstruace při hubnutí = zdravotní varovný signál (RED-S).
const MENSTRUATION_RE: RegExp[] = [
  /(nepri(sla|jde)|vynech|ztrat|zmizel|prestal|nemam|nedostav)[^.!?]{0,40}menstruac/,
  /menstruac[^.!?]{0,40}(neprisla|neprijde|vynech|ztrat|zmizel|prestal)/,
];
// [harden 2026-07-14 v2] medical signály, kde holé slovo = běžný vzdělávací dotaz (nedegradovat
// odpověď safe-modem), ale kontext užívání/nemoci flagovat: testosteron (PED užívání), inzulin
// (píchání), SARM (slovo, ne „šarmantní"), rakovina (ne „rakovinotvorný" mýty).
// [app] SARM přes `\bsarm[sy]?\b`: chytne drogu sarm/sarms/sarmy (vč. českého množ. čísla), ale NE časté
// jídlo „sarma" (jednotné, holubky). Zbývá FP jen na množné „sarmy" (dvojznačné s drogou → přednost drogy).
// Přísnější i než web `\bsarm(?![a-z]{4,})`, který flaguje i „sarma" — doporučit webu k převzetí.
const MED_CONTEXT_RE: RegExp[] = [
  /(beru|picham|koupit|koupim|shanim|shanet|davkov|kur[au]|cyklus|doplnit|nasadit)[^.!?]{0,30}testosteron/,
  /testosteron[^.!?]{0,30}(kur[au]|picha|injek|davk|cyklus|nasadit)/,
  /(picham|beru|aplikuj|davkuj)[^.!?]{0,25}inzulin/,
  /na inzulinu/,
  /\bsarm[sy]?\b/,
  /rakovin(?!otvor)/,
];
// [app 2026-07-14] DNP (2,4-dinitrofenol) — i malá dávka SMRTELNÁ, vždy safe-mode (web ho neměl).
// `\bdnp\b` přes hranici slova, ať neflaguje uvnitř jiného slova.
const SUBSTANCE_RE: RegExp[] = [/\bdnp\b/];

/** Zmínka o věku < 18.
 * [harden 2026-07-14 v2] „mám 15 kg nadváhy" flagovalo nezletilost → číslo následované jednotkou
 * (kg/kilo/cm/%/kcal) se za věk nepovažuje. Holé „mám 16" BEZ jednotky flagujeme dál. */
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
  for (const re of FASTING_INTENT_RE) {
    if (re.test(t)) { categories.add('eating_disorder'); matched.push('eating_disorder:fasting_intent'); }
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
