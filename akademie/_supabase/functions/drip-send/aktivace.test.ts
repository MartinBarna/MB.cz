// Testy vetveni mailu podle prvniho zapisu jidla (drip-send, 25. 8. 2026).
// Spusteni: npx --yes deno@2 run akademie/_supabase/functions/drip-send/aktivace.test.ts
// (bez jakychkoli --allow-*: test necte sit, disk ani promenne prostredi)
import {
  KROK_PODLE_ZAPISU,
  maPreskocitPodleZapisu,
  type Podminka,
  type StavZapisu,
  trateSeSignalem,
} from './aktivace.ts';

type Case = {
  track: string;
  step: number;
  stav: StavZapisu;
  mapa: Record<string, Podminka>;
  expect: Podminka | null;
  why: string;
};

// Zkusebni mapa. ZAMERNE se netestuje proti ZIVE mape `KROK_PODLE_ZAPISU`: ta je dnes
// prazdna (mechanismus vypnuty) a testy pravidel musi platit bez ohledu na to,
// ktere kroky do ni Martin nakonec pusti.
const MAPA: Record<string, Podminka> = {
  'tc-zkusebka/0': 'jen_kdyz_nezapsal',
  'tc-zkusebka/1': 'jen_kdyz_zapsal',
};

const CASES: Case[] = [
  // --- JADRO: nutkaci mail (jen_kdyz_nezapsal) ---
  {
    track: 'tc-zkusebka', step: 0, stav: 'zapsal', mapa: MAPA,
    expect: 'jen_kdyz_nezapsal',
    why: 'kdo uz zapsal, nema dostat mail „dneska zapis, co jis"',
  },
  {
    track: 'tc-zkusebka', step: 0, stav: 'nezapsal', mapa: MAPA,
    expect: null,
    why: 'kdo nezapsal, nutkaci mail dostat MA (to je cely smysl aktivacni serie)',
  },

  // --- JADRO: mail, ktery TVRDI, ze clovek zapisuje (jen_kdyz_zapsal) ---
  {
    track: 'tc-zkusebka', step: 1, stav: 'nezapsal', mapa: MAPA,
    expect: 'jen_kdyz_zapsal',
    why: 'komu nic nezapsal, nesmi prijit „par dni zapisu za tebou, dobra prace"',
  },
  {
    track: 'tc-zkusebka', step: 1, stav: 'zapsal', mapa: MAPA,
    expect: null,
    why: 'kdo zapisuje, pochvalu dostat ma',
  },

  // --- FAIL-SAFE: `nevime` se NIKDY nesmi chovat jako zadrzeni mailu ---
  {
    track: 'tc-zkusebka', step: 0, stav: 'nevime', mapa: MAPA,
    expect: null,
    why: 'vypadek signalu z appky nesmi zadrzet nutkaci mail',
  },
  {
    track: 'tc-zkusebka', step: 1, stav: 'nevime', mapa: MAPA,
    expect: null,
    why: 'vypadek signalu z appky nesmi zadrzet ani opacne vetveny mail',
  },

  // --- KROKY MIMO MAPU se nesmi dotknout NICEHO ---
  {
    track: 'tc-zkusebka', step: 3, stav: 'nezapsal', mapa: MAPA,
    expect: null, why: 'nevetveny krok teze trate jde vzdy (tcz-3-trenink sedi na oba stavy)',
  },
  {
    track: 'lead-magnet', step: 0, stav: 'nezapsal', mapa: MAPA,
    expect: null, why: 'cizi trat se vetvenim nesmi zastavit ani omylem',
  },
  {
    track: 'tc-zkusebka', step: 0, stav: 'zapsal', mapa: {},
    expect: null, why: 'prazdna mapa = mechanismus VYPNUTY, chova se presne jako dnes',
  },

  // --- ODOLNOST VUCI NESMYSLNEMU VSTUPU ---
  {
    track: '', step: 0, stav: 'zapsal', mapa: MAPA,
    expect: null, why: 'prazdny track nesmi spadnout ani nic preskocit',
  },
  {
    track: 'tc-zkusebka', step: -1, stav: 'zapsal', mapa: MAPA,
    expect: null, why: 'zaporny krok nema v mape protejsek, mail odejde',
  },
];

let selhalo = 0;
for (const c of CASES) {
  const dostal = maPreskocitPodleZapisu(c.track, c.step, c.stav, c.mapa);
  if (dostal !== c.expect) {
    selhalo++;
    console.error(`✗ ${c.track}/${c.step} [${c.stav}]: cekal ${c.expect}, dostal ${dostal}  (${c.why})`);
  } else {
    console.log(`✓ ${c.why}`);
  }
}

// --- trateSeSignalem: index.ts podle nej rozhoduje, ci adresy vubec posle do appky ---
const trate = [...trateSeSignalem(MAPA)].sort();
if (JSON.stringify(trate) !== JSON.stringify(['tc-zkusebka'])) {
  selhalo++;
  console.error(`✗ trateSeSignalem: cekal ["tc-zkusebka"], dostal ${JSON.stringify(trate)}`);
} else {
  console.log('✓ trateSeSignalem vytahne trat z klice track/step');
}
if (trateSeSignalem({}).size !== 0) {
  selhalo++;
  console.error('✗ prazdna mapa musi dat prazdnou mnozinu trati (jinak by se zbytecne volala appka)');
} else {
  console.log('✓ prazdna mapa = zadny dotaz do appky');
}

// Pojistka proti tichemu zapnuti: ZIVA mapa je dnes prazdna, tedy mechanismus je vypnuty.
// Az ji nekdo naplni, tenhle test spadne a donuti ho dopsat testy pro konkretni kroky
// a projit copy tech sablon. Zmena tohohle radku je vedome rozhodnuti, ne uklid.
const ZIVE_KLICE = Object.keys(KROK_PODLE_ZAPISU).sort();
if (ZIVE_KLICE.length !== 0) {
  selhalo++;
  console.error(`✗ KROK_PODLE_ZAPISU uz neni prazdna (${JSON.stringify(ZIVE_KLICE)}). Dopln testy pro tyhle kroky a uprav tuhle pojistku.`);
} else {
  console.log('✓ ziva mapa je prazdna, mechanismus je vypnuty (zadna zmena chovani po nasazeni)');
}

console.log(selhalo === 0 ? `\nHOTOVO: ${CASES.length + 3} kontrol, vse proslo.` : `\nSELHALO: ${selhalo}`);
if (selhalo > 0) Deno.exit(1);
