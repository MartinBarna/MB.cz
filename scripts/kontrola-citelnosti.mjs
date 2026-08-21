#!/usr/bin/env node
// =============================================================================
// KONTROLA ČITELNOSTI ČLÁNKŮ: hledá text, který na stránce není vidět.
//
// PROČ EXISTUJE (21. 8. 2026)
//   Do článku `jak-zacit-hubnout.html` se dostal rámeček `.tyden-box`, který měl
//   SVĚTLÉ POZADÍ a NEMĚL vlastní barvu textu. Na web se ale načítá
//   `marketing-dark.css`, který stránku překlopí do tmavého motivu a text zesvětlí.
//   Výsledek: bílý text na světlém pozadí. Věta byla na produkci nečitelná.
//
//   ⛔⛔ A TEĎ TO PODSTATNÉ: KONTROLA PŘED VYDÁNÍM TO NECHYTILA, PROTOŽE OVĚŘOVALA
//   PŘÍTOMNOST TEXTU, NE JEHO VIDITELNOST. Text v DOM byl, počet nadpisů seděl,
//   odkazy vedly kam měly, všechno svítilo zeleně. Našel to až Martin očima.
//   ⇒ Pravidlo: „element existuje" NENÍ „člověk to uvidí".
//
// CO UMÍ
//   Deterministicky najde nejčastější příčinu: pravidlo, které nastaví barvu pozadí
//   a NENASTAVÍ barvu textu (nebo naopak). Takový prvek je vydaný napospas tomu,
//   jaký motiv se zrovna načte, a při přepnutí motivu zmizí.
//   Když jsou obě barvy zadané, spočítá kontrast a nízký nahlásí.
//
// ⚠️ CO NEUMÍ: nesimuluje kaskádu ani pořadí načítání CSS souborů. Neřekne ti, že
//   je něco nečitelné kvůli pravidlu ze vzdáleného .css. Je to síto na nejčastější
//   chybu, ne důkaz čitelnosti. ⭐ Vizuální kontrolu očima NENAHRAZUJE.
//
// SPUSTIT:  node scripts/kontrola-citelnosti.mjs
//           node scripts/kontrola-citelnosti.mjs clanky/muj-clanek.html
// Vrací nenulový kód, když něco najde.
// =============================================================================

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const SLOZKA = 'clanky';

/** Barvy zapsané jménem, které se v článcích reálně objevují. */
const JMENA_BAREV = {
  white: [255, 255, 255], black: [0, 0, 0], red: [255, 0, 0],
  transparent: null, inherit: null, currentcolor: null, unset: null, initial: null,
};

function naRgb(hodnota) {
  if (!hodnota) return null;
  const h = hodnota.trim().toLowerCase().replace(/\s*!important\s*$/, '');
  if (h in JMENA_BAREV) return JMENA_BAREV[h];
  let m = h.match(/^#([0-9a-f]{3})$/);
  if (m) return [...m[1]].map((c) => parseInt(c + c, 16));
  m = h.match(/^#([0-9a-f]{6})$/);
  if (m) return [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16));
  m = h.match(/^rgba?\(([^)]+)\)$/);
  if (m) {
    const c = m[1].split(/[,/]/).map((s) => parseFloat(s));
    // ⛔ Průhledné pozadí není pozadí. Kdyby se bralo jako barva, kontrola by lhala.
    if (c.length >= 4 && c[3] === 0) return null;
    return [c[0], c[1], c[2]];
  }
  return null; // gradient, var(), hsl a spol. neřešíme, radši mlčíme než hádáme
}

const jas = ([r, g, b]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

/** Rozseká `<style>` blok na dvojice selektor a telo. Bez parseru, stačí to. */
function pravidla(css) {
  const out = [];
  // média a keyframes zahodíme, ať se nesnažíme parsovat vnořené bloky
  const bezMedii = css.replace(/@(media|supports|keyframes)[^{]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, ' ');
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = re.exec(bezMedii)) !== null) out.push({ selektor: m[1].trim(), telo: m[2] });
  return out;
}

function vlastnost(telo, jmena) {
  for (const j of jmena) {
    const m = telo.match(new RegExp('(?:^|;)\\s*' + j + '\\s*:([^;]+)', 'i'));
    if (m) return m[1];
  }
  return null;
}

const nalezy = [];
function hlas(soubor, kde, problem, detail) {
  nalezy.push({ soubor, kde, problem, detail });
}

// ⛔⛔ FILTR SPOLEČNÉ ŠABLONY. Bez něj je tahle kontrola k ničemu: první běh 21. 8. 2026
//    vrátil 728 nálezů ve 148 souborech, protože `.nav`, `.author-box`, `.hero .tag`
//    a `.btn.gold:hover` mají pozadí bez barvy textu a jsou ve VŠECH článcích. Jsou to
//    prvky sdílené šablony a `marketing-dark.css` je přebarvuje záměrně, takže je to
//    v pořádku. Kdo utopí jeden skutečný nález v 727 planých, vyrobil šum a příště
//    kontrole nikdo neuvěří (stejná lekce jako u `feedback-pojistka-cti-co-vidi-clovek`).
// ⇒ Hlásí se JEN selektor, který je vlastní pár článkům, tedy ruční přídavek.
//    Vada z 21. 8. (`.tyden-box`) byla přesně v jednom souboru, takže by prošla sem.
const PRAH_SABLONY = 4; // selektor v >= tolika souborech bereme jako sdílenou šablonu
const cetnostSelektoru = new Map();

function spoctiSelektory(html) {
  const videno = new Set();
  for (const blok of html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)) {
    for (const { selektor } of pravidla(blok[1])) videno.add(selektor);
  }
  for (const s of videno) cetnostSelektoru.set(s, (cetnostSelektoru.get(s) ?? 0) + 1);
}

function zkontroluj(soubor, html) {
  // 1) pravidla ve vložených <style> blocích
  for (const blok of html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)) {
    for (const { selektor, telo } of pravidla(blok[1])) {
      const bgRaw = vlastnost(telo, ['background-color', 'background']);
      const fgRaw = vlastnost(telo, ['color']);
      // gradient v `background` není plocha pod textem, přeskoč
      if (bgRaw && /gradient|url\(/i.test(bgRaw)) continue;
      const bg = naRgb(bgRaw);
      const fg = naRgb(fgRaw);
      // Sdílenou šablonu přeskoč, řeší ji `marketing-dark.css` (viz komentář u PRAH_SABLONY).
      const jeSablona = (cetnostSelektoru.get(selektor) ?? 0) >= PRAH_SABLONY;

      if (bg && !fgRaw) {
        if (!jeSablona) {
          hlas(soubor, selektor, 'pozadi bez barvy textu',
            `background:${bgRaw.trim()} a zadny color; pri tmavem motivu text zesvetli a zmizi`);
        }
      } else if (bg && fg) {
        const k = Math.abs(jas(bg) - jas(fg));
        if (k < 60) {
          hlas(soubor, selektor, 'nizky kontrast',
            `color:${fgRaw.trim()} na background:${bgRaw.trim()}, rozdil jasu ${Math.round(k)} (min 60)`);
        }
      }
    }
  }

  // 2) inline style="..." na prvcích
  for (const m of html.matchAll(/style\s*=\s*"([^"]*)"/gi)) {
    const telo = m[1];
    const bgRaw = vlastnost(telo, ['background-color', 'background']);
    const fgRaw = vlastnost(telo, ['color']);
    if (bgRaw && /gradient|url\(/i.test(bgRaw)) continue;
    const bg = naRgb(bgRaw);
    const fg = naRgb(fgRaw);
    if (bg && fg) {
      const k = Math.abs(jas(bg) - jas(fg));
      if (k < 60) {
        hlas(soubor, 'inline style', 'nizky kontrast',
          `color:${fgRaw.trim()} na background:${bgRaw.trim()}, rozdil jasu ${Math.round(k)}`);
      }
    }
  }
}

const zadane = process.argv.slice(2);
const soubory = zadane.length
  ? zadane
  : readdirSync(SLOZKA).filter((f) => f.endsWith('.html') && f !== 'index.html').map((f) => join(SLOZKA, f));

console.log(`KONTROLA ČITELNOSTI: ${soubory.length} souborů\n`);

// ⛔ PRVNÍ PRŮCHOD JE POVINNÝ: spočítá, které selektory jsou sdílená šablona.
//    ⚠️ Když skriptu předáš jeden soubor, četnost se počítá jen z něj a KAŽDÝ jeho
//    selektor vyjde jako unikátní. Proto se šablona počítá vždy z CELÉ složky.
const proCetnost = readdirSync(SLOZKA)
  .filter((f) => f.endsWith('.html') && f !== 'index.html')
  .map((f) => join(SLOZKA, f));
for (const s of proCetnost) {
  try { spoctiSelektory(readFileSync(s, 'utf8')); } catch { /* nečitelný soubor řeší druhý průchod */ }
}

for (const s of soubory) {
  try {
    zkontroluj(s, readFileSync(s, 'utf8'));
  } catch (e) {
    hlas(s, '-', 'soubor nejde precist', String(e).slice(0, 80));
  }
}

if (!nalezy.length) {
  console.log(`✅ Nic podezřelého. ${soubory.length} souborů prošlo.`);
  console.log('⚠️ Neznamená to, že je stránka čitelná. Znamená to, že v ní není TAHLE chyba.');
  console.log('   Před vydáním se na článek pořád podívej v prohlížeči.');
  process.exit(0);
}

for (const n of nalezy) console.log(`CHYBA  ${n.soubor}  {${n.kde}}\n       ${n.problem}: ${n.detail}`);
console.log(`\n${nalezy.length} nálezů v ${new Set(nalezy.map((n) => n.soubor)).size} souborech.`);
process.exit(1);
