// Testy preskoceni kroku, ktery prodava uz vlastneny produkt (drip-send, 7. 8. 2026).
// Spusteni: npx --yes deno@2 run akademie/_supabase/functions/drip-send/preskoc.test.ts
// (bez jakychkoli --allow-*: test necte sit, disk ani promenne prostredi)
import { maPreskocitKrok, PRESKOC_KROK_KDYZ_VLASTNI } from './preskoc.ts';

type Case = {
  track: string; step: number; email: string;
  owns: Record<string, Set<string>>;
  expect: string | null;
  why: string;
};

const s = (...emaily: string[]) => new Set(emaily);
const MA_VK = { videokurz: s('kupec@example.com'), academy: s(), coaching: s() };
const NEMA_NIC = { videokurz: s(), academy: s(), coaching: s() };
const MA_BALICEK = { videokurz: s(), academy: s(), coaching: s(), balicek: s('kupec@example.com') };

const CASES: Case[] = [
  // --- JADRO OPRAVY ---
  {
    track: 'onboarding-nakup-balicek', step: 2, email: 'kupec@example.com', owns: MA_VK,
    expect: 'videokurz', why: 'kupec balicku, ktery uz ma videokurz, nesmi dostat nabidku videokurzu',
  },
  {
    track: 'onboarding-nakup-balicek', step: 2, email: 'novy@example.com', owns: MA_VK,
    expect: null, why: 'kdo videokurz nema, nabidku dostat MA (to je smysl te trate)',
  },

  // --- ZBYTEK TRATE MUSI DOJIT VZDYCKY (krok 0 = doruceni zaplaceneho zbozi) ---
  {
    track: 'onboarding-nakup-balicek', step: 0, email: 'kupec@example.com', owns: MA_VK,
    expect: null, why: 'krok 0 je DORUCENI PDF, to se posila i majiteli videokurzu',
  },
  {
    track: 'onboarding-nakup-balicek', step: 1, email: 'kupec@example.com', owns: MA_VK,
    expect: null, why: 'krok 1 "Kde v tom zacit" je navod k zaplacenemu zbozi, ne upsell',
  },

  // --- ZADNA JINA TRAT SE NESMI CHYTIT ---
  {
    track: 'onboarding-nakup-videokurz', step: 2, email: 'kupec@example.com', owns: MA_VK,
    expect: null, why: 'jina trat na stejnem kroku se branky tykat nesmi',
  },
  {
    track: 'longtail-consumer', step: 2, email: 'kupec@example.com', owns: MA_VK,
    expect: null, why: 'jiny krok teze trate se branky tykat nesmi (chyta se jen krok 12)',
  },

  // --- NABIDKA BALICKU NA KONCI LONGTAILU (krok 12 = sablona `lt-balicek`) ---
  {
    track: 'longtail-consumer', step: 12, email: 'kupec@example.com', owns: MA_BALICEK,
    expect: 'balicek', why: 'kdo uz balicek ma, nesmi dostat nabidku balicku',
  },
  {
    track: 'longtail-consumer', step: 12, email: 'novy@example.com', owns: MA_BALICEK,
    expect: null, why: 'kdo balicek nema, nabidku dostat MA (to je smysl toho kroku)',
  },
  {
    track: 'longtail-consumer', step: 12, email: 'kupec@example.com', owns: MA_VK,
    expect: null, why: 'majitel videokurzu bez balicku nabidku dostat MA (a klic `balicek` v mape vlastnictvi vubec neni)',
  },
  {
    track: 'longtail-consumer', step: 11, email: 'kupec@example.com', owns: MA_BALICEK,
    expect: null, why: 'sousedni krok 11 "Kam dal" se branky tykat nesmi',
  },
  {
    track: 'longtail-consumer', step: 12, email: 'KUPEC@Example.COM', owns: MA_BALICEK,
    expect: 'balicek', why: 'i u balicku se e-mail porovnava case-insensitive',
  },

  // --- VLASTNICTVI JINEHO PRODUKTU NESTACI ---
  {
    track: 'onboarding-nakup-balicek', step: 2, email: 'kupec@example.com',
    owns: { videokurz: s(), academy: s('kupec@example.com'), coaching: s() },
    expect: null, why: 'kdo ma Academy ale ne videokurz: mail o videokurzu mu dava smysl',
  },

  // --- ROBUSTNOST ---
  {
    track: 'onboarding-nakup-balicek', step: 2, email: 'KUPEC@Example.COM', owns: MA_VK,
    expect: 'videokurz', why: 'e-mail se porovnava case-insensitive (leads maji ruzne psani)',
  },
  {
    track: 'onboarding-nakup-balicek', step: 2, email: 'kupec@example.com', owns: NEMA_NIC,
    expect: null, why: 'prazdna mapa vlastnictvi = fail-safe smerem k ODESLANI',
  },
  {
    track: 'onboarding-nakup-balicek', step: 2, email: 'kupec@example.com',
    owns: {} as Record<string, Set<string>>,
    expect: null, why: 'kdyz dotaz do entitlements selze a mapa je prazdna, mail odejde jako driv',
  },
  {
    track: '', step: 2, email: 'kupec@example.com', owns: MA_VK,
    expect: null, why: 'prazdny track nesmi spadnout ani nic preskocit',
  },
];

let selhalo = 0;
for (const c of CASES) {
  const dostal = maPreskocitKrok(c.track, c.step, c.email, c.owns);
  const ok = dostal === c.expect;
  if (!ok) {
    selhalo++;
    console.error(`✗ ${c.track}/${c.step} <${c.email}>: cekal ${c.expect}, dostal ${dostal}  (${c.why})`);
  } else {
    console.log(`✓ ${c.why}`);
  }
}

// Pojistka proti tichemu rozsireni mapy: kdyz nekdo prida dalsi krok, musi pribyt i test.
const KLICE = Object.keys(PRESKOC_KROK_KDYZ_VLASTNI).sort();
const OCEKAVANE_KLICE = ['longtail-consumer/12', 'onboarding-nakup-balicek/2'];
if (JSON.stringify(KLICE) !== JSON.stringify(OCEKAVANE_KLICE)) {
  selhalo++;
  console.error(`✗ mapa PRESKOC_KROK_KDYZ_VLASTNI se zmenila: ${JSON.stringify(KLICE)}. Dopln test a uprav OCEKAVANE_KLICE.`);
} else {
  console.log('✓ mapa obsahuje presne ocekavane kroky');
}

console.log(selhalo === 0 ? `\nHOTOVO: ${CASES.length + 1} kontrol, vse proslo.` : `\nSELHALO: ${selhalo}`);
if (selhalo > 0) Deno.exit(1);
