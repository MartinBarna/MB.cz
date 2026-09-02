// Test enginu variant cílů (`assets/onboarding-cile.js`). Spouštění: node scripts/onboarding-cile-test.js
//
// Co se kontroluje:
//   1) šest profilů projde a vrátí tři karty,
//   2) invarianty, které NESMÍ padnout ani u jednoho profilu (podlaha kcal, podlaha tuku,
//      bílkoviny v pásmu, vláknina v pásmu, součet maker sedí na kalorie),
//   3) Martinův referenční klient z uvítacího mailu (muž 20 let, 181 cm, 64 kg, MMA 6× 90 min,
//      9000 kroků, nabírání) proti tomu, co Martin poslal ručně: 3300 kcal, 130 g bílkovin, 46 g vlákniny,
//   4) že v textech i v mailech není dlouhá pomlčka.
'use strict';
const OC = require('../assets/onboarding-cile.js');

let chyb = 0;
function ok(podminka, popis) {
  if (!podminka) { chyb++; console.log('  ⛔ ' + popis); }
  else console.log('  ✅ ' + popis);
}
function pct(a, b) { return Math.round((a - b) / b * 1000) / 10; }

const PROFILY = [
  {
    nazev: 'Martinův referenční klient (muž, nabírání, MMA)',
    pohlavi: 'm',
    vstup: { vek: 20, vyska: 181, vaha: 64, kroky: 9000, dny_treninku: 6, trenink_minut: 90,
      sport: 'MMA', cil: 'nabrat svaly', aktivita: 'sedavá práce', prace: 'student, sedavá', spanek: '8' },
    ocekavam: { klic: 'lehke', kcal: 3300, protein: 130, fiber: 46 }
  },
  {
    nazev: 'Žena s obezitou (BMI 38, hubnutí, bez tréninku)',
    pohlavi: 'z',
    vstup: { vek: 42, vyska: 165, vaha: 104, kroky: 4000, dny_treninku: 0,
      sport: '', cil: 'zhubnout', aktivita: 'sedavá', prace: 'kancelář', spanek: '6' }
  },
  {
    nazev: 'Drobná žena (50 kg, hubnutí, 3× fitko)',
    pohlavi: 'z',
    vstup: { vek: 30, vyska: 160, vaha: 50, kroky: 7000, dny_treninku: 3, trenink_minut: 60,
      sport: 'posilovna', cil: 'zhubnout pár kilo', aktivita: 'lehká', prace: 'kancelář', spanek: '7' }
  },
  {
    nazev: 'Muž, udržení a postava (rekompozice)',
    pohlavi: 'm',
    vstup: { vek: 35, vyska: 178, vaha: 82, kroky: 11000, dny_treninku: 4, trenink_minut: 75,
      sport: 'posilovna a běh', cil: 'zpevnit postavu', aktivita: 'střední', prace: 'prodavač', spanek: '7,5' }
  },
  {
    nazev: 'Muž s fyzickou prací, hubnutí, chybí kroky i tréninky',
    pohlavi: 'm',
    vstup: { vek: 48, vyska: 183, vaha: 96, cil: 'shodit břicho', aktivita: 'fyzická práce',
      prace: 'stavba', spanek: '6', zdravi: 'vysoký tlak, beru léky', leky: 'na tlak' }
  },
  {
    nazev: 'Žena, nabírání, jóga',
    pohlavi: 'z',
    vstup: { vek: 26, vyska: 172, vaha: 55, kroky: 8000, dny_treninku: 2, trenink_minut: 60,
      sport: 'jóga', cil: 'nabrat pár kilo', aktivita: 'lehká', prace: 'kancelář', spanek: '8' }
  }
];

console.log('ENGINE VARIANT CÍLŮ: ' + PROFILY.length + ' profilů\n');

PROFILY.forEach(function (p) {
  console.log('- ' + p.nazev);
  const r = OC.varianty(Object.assign({ pohlavi: p.pohlavi }, p.vstup));
  ok(r.ok === true, 'engine dopočítal (chybí: ' + (r.chybi || []).join(', ') + ')');
  if (!r.ok) return;
  console.log('   BMR ' + Math.round(r.vydej.bmr) + ' · násobič dne ' + r.vydej.nasobic
    + ' · kroky ' + Math.round(r.vydej.kroky_kcal) + ' kcal · trénink ' + Math.round(r.vydej.trenink_kcal)
    + ' kcal (MET ' + r.vydej.met + ') · TDEE ' + Math.round(r.vydej.tdee)
    + ' · BMI ' + r.bmi + ' · referenční váha ' + r.ref_kg + ' kg · cíl ' + r.cil);
  ok(r.karty.length === 3, 'tři varianty');

  r.karty.forEach(function (k) {
    const soucet = k.protein_kcal + k.carbs_kcal + k.fat_kcal;
    console.log('   · ' + k.nazev + ': ' + k.kcal + ' kcal · B ' + k.protein + ' g (' + k.protein_kcal
      + ' kcal, ' + k.bilkoviny_g_kg + ' g/kg ref) · S ' + k.carbs + ' g · T ' + k.fat + ' g · vláknina '
      + k.fiber + ' g · ' + k.kg_tyden + ' kg/týden'
      + (k.varovani.length ? ' · ⚠️ ' + k.varovani.length : ''));
    ok(k.kcal >= (p.pohlavi === 'z' ? 1200 : 1500), '   ' + k.nazev + ': kalorie nad podlahou');
    ok(k.bilkoviny_g_kg >= 1.19 && k.bilkoviny_g_kg <= 2.21, '   ' + k.nazev + ': bílkoviny 1,2 až 2,2 g/kg referenční váhy');
    ok(k.fat * 9 >= k.kcal * 0.215, '   ' + k.nazev + ': tuk nad podlahou 22 % kalorií');
    ok(k.fiber >= 25 && k.fiber <= 60, '   ' + k.nazev + ': vláknina 25 až 60 g');
    ok(Math.abs(soucet - k.kcal) / k.kcal <= 0.05, '   ' + k.nazev + ': součet maker sedí na kalorie (' + soucet + ' vs ' + k.kcal + ')');
    // deficit nikdy nad 25 % výdeje
    ok(k.kcal >= r.vydej.tdee * 0.75 - 1 || k.kcal === (p.pohlavi === 'z' ? 1200 : 1500),
      '   ' + k.nazev + ': deficit do 25 % výdeje (nebo na podlaze)');
  });

  if (p.ocekavam) {
    const k = r.karty.filter(function (x) { return x.klic === p.ocekavam.klic; })[0];
    ok(!!k, 'varianta ' + p.ocekavam.klic + ' existuje');
    if (k) {
      console.log('   POROVNÁNÍ s Martinovým ručním mailem:');
      [['kcal', k.kcal, p.ocekavam.kcal], ['bílkoviny', k.protein, p.ocekavam.protein], ['vláknina', k.fiber, p.ocekavam.fiber]]
        .forEach(function (x) {
          const d = pct(x[1], x[2]);
          console.log('     ' + x[0] + ': engine ' + x[1] + ' vs Martin ' + x[2] + ' (' + (d >= 0 ? '+' : '') + d + ' %)'
            + (Math.abs(d) > 5 ? '  ⚠️ nad 5 %' : ''));
        });
    }
  }
  console.log('');
});

// Maily
console.log('- Maily');
const r = OC.varianty(Object.assign({ pohlavi: 'm' }, PROFILY[0].vstup));
const karta = r.karty.filter(function (x) { return x.klic === 'lehke'; })[0];
const m1 = OC.mailUvitaci({ jmeno: 'Tomáš', osloveni: 'Tomáši', karta: karta, vstup: r.vstup, cil: r.cil, appka: 'propsano' });
const m2 = OC.mailPruvodce({ jmeno: 'Tomáš', osloveni: 'Tomáši' });
ok(m1.telo.indexOf(String(karta.kcal)) > -1, 'uvítací mail obsahuje kalorie z vybrané varianty');
ok(m1.telo.indexOf('undefined') === -1 && m2.telo.indexOf('undefined') === -1, 'v mailech není undefined');
ok(m1.telo.indexOf('už máš tyhle cíle nastavené') > -1, 'věta o propsání do appky sedí na stav propsano');
const m1b = OC.mailUvitaci({ jmeno: 'Tomáš', osloveni: 'Tomáši', karta: karta, vstup: r.vstup, cil: r.cil, appka: 'neni' });
ok(m1b.telo.indexOf('Zaregistruj se do appky') > -1, 'věta o registraci sedí na stav neni');
ok(m1.telo.split('\n').filter(function (x) { return /^\d\) /.test(x); }).length >= 1, 'priority se do mailu dostaly');

// Ruční přepis bílkovin: Martin dal svému klientovi 2,0 g/kg místo pravidla 1,8 pro nabírání.
const rB = OC.varianty(Object.assign({ pohlavi: 'm', bilkoviny_g_kg: 2.0 }, PROFILY[0].vstup));
const kB = rB.karty.filter(function (x) { return x.klic === 'lehke'; })[0];
console.log('   s ručním přepisem 2,0 g/kg: bílkoviny ' + kB.protein + ' g (Martin ručně 130 g, '
  + (kB.protein - 130 >= 0 ? '+' : '') + Math.round((kB.protein - 130) / 130 * 1000) / 10 + ' %)');
ok(kB.protein === 128, 'přepis 2,0 g/kg dá 128 g bílkovin');
ok(OC.varianty(Object.assign({ pohlavi: 'm', bilkoviny_g_kg: 5 }, PROFILY[0].vstup))
  .karty[0].bilkoviny_g_kg <= 2.21, 'nesmyslný přepis se ořeže na 2,2 g/kg');

// Priority: deterministicky ze spánku, tréninků a kroků
const pr = OC.priority({ spanek: '5', dny_treninku: 0, kroky: 3000 });
ok(pr.length === 3, 'málo spánku + žádný trénink + málo kroků = tři priority');
ok(pr[0].indexOf('Spánek') === 0, 'spánek je první priorita');
const pr2 = OC.priority({ spanek: '8', dny_treninku: 4, kroky: 11000, sport: 'posilovna' });
ok(pr2.length === 2 && pr2[0].indexOf('Držet pohyb') === 0, 'bez slabin se použije záložní dvojice');

// Citlivá pole
const c = OC.citliva({ zdravi: 'jsem těhotná ve 3. měsíci', leky: '', diety: '' });
ok(c.indexOf('těhotenství') > -1, 'těhotenství se pozná v poli zdraví');
ok(OC.citliva({ zdravi: '', leky: 'metformin', diety: '' }).indexOf('cukrovka') > -1, 'cukrovka se pozná podle léku');
ok(OC.citliva({ zdravi: 'nic', leky: '', diety: '' }).length === 0, 'čistý dotazník nehlásí nic');

// Chybějící údaje
const bez = OC.varianty({ pohlavi: 'm', vek: 30, vaha: 80 });
ok(bez.ok === false && bez.chybi.indexOf('výška') > -1, 'bez výšky engine nepočítá a řekne proč');

// Dlouhá pomlčka
const fs = require('fs');
const zdroj = fs.readFileSync(__dirname + '/../assets/onboarding-cile.js', 'utf8');
ok(zdroj.indexOf('—') === -1, 've zdrojáku enginu není dlouhá pomlčka');
ok(m1.telo.indexOf('—') === -1 && m2.telo.indexOf('—') === -1, 'v mailech není dlouhá pomlčka');

console.log('\n' + (chyb ? '⛔ ' + chyb + ' selhání' : '✅ vše prošlo'));
process.exit(chyb ? 1 : 0);
