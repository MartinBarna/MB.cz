/* Bílkoviny za korunu. Sestaveno ze src/spolecne.mjs a src/app.js, ručně needitovat. */
(function () {
'use strict';
// Sdílené výpočty, formátování a kousky HTML pro kalkulačku.
//
// Tenhle soubor používají DVĚ strany:
//   1. sestavení v Node (scripts/sestav.mjs a scripts/kontrola.mjs ho importují),
//   2. prohlížeč: sestavení z něj vyrobí začátek dist/app.js tak, že smaže slova `export`.
// Proto sem nepatří import, nic z Node (fs, process) ani regulární výrazy s lookbehind
// (starší Safari by kvůli nim nespustil celý app.js).
// Čísla se zaokrouhlují jen při zobrazení, výpočty běží na plnou přesnost.

const LIBOVA_HRANICE = 10; // aspoň tolik g bílkovin na 100 kcal = „libová“
const MIX_MAX_POLOZEK = 3; // nejlevnější mix: nejvýš tolik potravin
const MIX_MAX_PODIL = 50; // nejlevnější mix: jedna potravina nejvýš tolik % bílkovin
const KALKULACKA_MAX_POLOZEK = 4; // kalkulačka: nejvýš tolik vybraných potravin
const CIL_VYCHOZI = 100; // kalkulačka: výchozí denní cíl bílkovin v g
const CIL_MIN = 20;
const CIL_MAX = 400;
const NBSP = String.fromCharCode(0xa0); // pevná mezera
const TEXT_MIX_NEJDE = 'Na mix chybí aspoň dvě libové potraviny z různých kategorií.';

const fmt0 = new Intl.NumberFormat('cs-CZ', { maximumFractionDigits: 0 });
const fmt1 = new Intl.NumberFormat('cs-CZ', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const fmt2 = new Intl.NumberFormat('cs-CZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtKg = new Intl.NumberFormat('cs-CZ', { maximumFractionDigits: 2 });

// ---------- Metriky ----------

// kc_za_100g_bilkovin = cena_kc / (baleni_g * jedly_podil * bilkoviny_100g / 100) * 100
// g_bilkovin_na_100kcal = bilkoviny_100g / kcal_100g * 100
function spocitejMetriky(p) {
  const jedly = typeof p.jedly_podil === 'number' ? p.jedly_podil : 1;
  const bilkovinyVBaleni = p.baleni_g * jedly * p.bilkoviny_100g / 100;
  const kc = bilkovinyVBaleni > 0 ? p.cena_kc / bilkovinyVBaleni * 100 : null;
  const gl = p.kcal_100g > 0 ? p.bilkoviny_100g / p.kcal_100g * 100 : null;
  return {
    kc_za_100g_bilkovin: kc,
    g_bilkovin_na_100kcal: gl,
    bilkoviny_v_baleni_g: bilkovinyVBaleni,
    libova: jeLibova(gl)
  };
}

function jeLibova(gl) {
  // malá tolerance kvůli plovoucí čárce (15,4 / 154 × 100 vyjde 9,999999999999998)
  return typeof gl === 'number' && gl >= LIBOVA_HRANICE - 1e-9;
}

// ---------- Řazení a filtry ----------

const RAZENI = {
  'kc-vzestupne': { klic: 'kc_za_100g_bilkovin', smer: 1, popis: 'Nejlevnější bílkoviny' },
  'kc-sestupne': { klic: 'kc_za_100g_bilkovin', smer: -1, popis: 'Nejdražší bílkoviny' },
  'gl-sestupne': { klic: 'g_bilkovin_na_100kcal', smer: -1, popis: 'Nejvíce bílkovin na 100 kcal' },
  'gl-vzestupne': { klic: 'g_bilkovin_na_100kcal', smer: 1, popis: 'Nejméně bílkovin na 100 kcal' }
};
const RAZENI_VYCHOZI = 'kc-vzestupne';

function seradit(polozky, razeni) {
  const r = RAZENI[razeni] || RAZENI[RAZENI_VYCHOZI];
  return polozky.slice().sort((a, b) => {
    const x = a[r.klic];
    const y = b[r.klic];
    const xOk = typeof x === 'number';
    const yOk = typeof y === 'number';
    if (xOk && yOk && x !== y) return (x - y) * r.smer;
    if (xOk !== yOk) return xOk ? -1 : 1; // položka bez čísla jde vždy na konec
    return a.nazev.localeCompare(b.nazev, 'cs') || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  });
}

// Spojovací diakritická znaménka U+0300 až U+036F (po normalize('NFD') zbydou samostatně).
const DIAKRITIKA = new RegExp('[' + String.fromCharCode(0x300) + '-' + String.fromCharCode(0x36f) + ']', 'g');

function normalizuj(text) {
  return String(text).toLowerCase().normalize('NFD').replace(DIAKRITIKA, '');
}

function odpovidaFiltru(p, f) {
  if (f.kategorie && p.kategorie !== f.kategorie) return false;
  if (f.obchod && p.obchod !== f.obchod) return false;
  if (f.libove && !p.libova) return false;
  const slova = normalizuj(f.hledat || '').split(/\s+/).filter(Boolean);
  if (slova.length) {
    const kde = normalizuj([p.nazev, p.znacka, p.obchod, p.kategorie].join(' '));
    for (const s of slova) if (!kde.includes(s)) return false;
  }
  return true;
}

// ---------- Kalkulačka ----------

// Nejlevnější mix: jen libové potraviny, nejvýš MIX_MAX_POLOZEK, každá z jiné kategorie
// (dvoje kuřecí prsa z různých obchodů nejsou mix) a žádná nad MIX_MAX_PODIL %.
// Vrací [{ id, podil }] se součtem 100, nebo null, když to z dat nejde složit.
function nejlevnejsiMix(polozky) {
  const kandidati = seradit(
    polozky.filter((p) => p.libova && typeof p.kc_za_100g_bilkovin === 'number'),
    RAZENI_VYCHOZI
  );
  const mix = [];
  const pouziteKategorie = new Set();
  let zbyva = 100;
  for (const p of kandidati) {
    if (zbyva <= 0 || mix.length >= MIX_MAX_POLOZEK) break;
    if (pouziteKategorie.has(p.kategorie)) continue;
    const podil = Math.min(MIX_MAX_PODIL, zbyva);
    mix.push({ id: p.id, podil });
    pouziteKategorie.add(p.kategorie);
    zbyva -= podil;
  }
  return zbyva === 0 ? mix : null;
}

// Rozpočítá celé číslo `celkem` v poměru vah (metoda největších zbytků), součet sedí přesně.
function rozpocitej(vahy, celkem) {
  if (!vahy.length) return [];
  const soucet = vahy.reduce((s, v) => s + v, 0);
  const presne = vahy.map((v) => (soucet > 0 ? v / soucet : 1 / vahy.length) * celkem);
  const cele = presne.map(Math.floor);
  const chybi = celkem - cele.reduce((s, v) => s + v, 0);
  const poradi = presne
    .map((v, i) => [v - Math.floor(v), i])
    .sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  for (let k = 0; k < chybi; k++) cele[poradi[k][1]] += 1;
  return cele;
}

// Posuvník `index` dostane `hodnota` a zbytek do 100 % se rozdělí mezi ostatní
// v poměru jejich dosavadních podílů.
function rozdelPodily(podily, index, hodnota) {
  if (podily.length <= 1) return podily.map(() => 100);
  const h = Math.min(100, Math.max(0, Math.round(hodnota)));
  const nove = rozpocitej(podily.filter((_, i) => i !== index), 100 - h);
  const vysledek = [];
  let k = 0;
  for (let i = 0; i < podily.length; i++) vysledek.push(i === index ? h : nove[k++]);
  return vysledek;
}

// vyber: [{ polozka, podil }], podíly v % se sčítají do 100
function spocitejKalkulacku(vyber, cilG) {
  let zaDen = 0;
  let kcal = 0;
  const radky = vyber.map(({ polozka: p, podil }) => {
    const gBilkovin = cilG * podil / 100;
    const kcDen = gBilkovin * p.kc_za_100g_bilkovin / 100;
    const gJidla = p.bilkoviny_100g > 0 ? gBilkovin / p.bilkoviny_100g * 100 : 0;
    const kcalDen = gJidla * p.kcal_100g / 100;
    zaDen += kcDen;
    kcal += kcalDen;
    return { polozka: p, podil, gBilkovin, kcDen, gJidla, kcalDen };
  });
  return { cilG, zaDen, za30: zaDen * 30, kcal, radky };
}

// ---------- Formátování (česky, zaokrouhlení až tady) ----------

function jeCislo(n) {
  return typeof n === 'number' && isFinite(n);
}
function formatKc(n) {
  return jeCislo(n) ? fmt1.format(n) + NBSP + 'Kč' : '–';
}
function formatG(n) {
  return jeCislo(n) ? fmt1.format(n) + NBSP + 'g' : '–';
}
function formatCele(n) {
  return jeCislo(n) ? fmt0.format(n) : '–';
}
function formatProcenta(n) {
  return fmt0.format(n) + NBSP + '%';
}
function formatPomer(x) {
  return fmt1.format(x) + '×';
}
// cena balení jako na cenovce: 549 Kč, 99,90 Kč
function formatCena(n) {
  return (Number.isInteger(n) ? fmt0.format(n) : fmt2.format(n)) + NBSP + 'Kč';
}
function formatBaleni(g) {
  return g >= 1000 ? fmtKg.format(g / 1000) + NBSP + 'kg' : fmt0.format(g) + NBSP + 'g';
}
// "2026-10-13" -> "13. 10. 2026"
function formatDatum(iso) {
  const [r, m, d] = String(iso).split('-').map(Number);
  return d + '.' + NBSP + m + '.' + NBSP + r;
}

// ---------- Text a HTML ----------

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
function esc(text) {
  return String(text).replace(/[&<>"']/g, (z) => ESC[z]);
}

// Česká typografie: jednopísmenná předložka nebo spojka nezůstane na konci řádku.
// Dva průchody kvůli řetězcům typu „s a v“.
function nbspText(text) {
  let s = String(text);
  for (let k = 0; k < 2; k++) s = s.replace(/(^|[\s(„])([kvszouaiKVSZOUAI]) +/g, '$1$2' + NBSP);
  return s;
}

function t(text) {
  return esc(nbspText(text));
}

// ukazObchod: false, když jsou všechny ceny z jednoho obchodu (pak by se jen opakoval)
function htmlPolozkaKalkulacky(p, podil, i, pocet, ukazObchod) {
  const jedina = pocet <= 1;
  const obchod = ukazObchod ? `<span class="bz-kalk-polozka-obchod">${t(p.obchod)}</span>` : '';
  return `<li class="bz-kalk-polozka">
<div class="bz-kalk-polozka-hlava"><span class="bz-kalk-polozka-nazev">${t(p.nazev)}</span>${obchod}<button type="button" class="bz-kalk-odebrat" data-i="${i}" aria-label="Odebrat: ${esc(p.nazev)}"><span aria-hidden="true">×</span></button></div>
<div class="bz-kalk-polozka-podil"><input type="range" class="bz-kalk-posuvnik" id="bz-k-podil-${i}" min="0" max="100" step="1" value="${podil}" data-i="${i}" autocomplete="off" aria-label="Podíl na bílkovinách: ${esc(p.nazev)}" aria-valuetext="${podil} %"${jedina ? ' disabled' : ''}><output class="bz-kalk-procenta" for="bz-k-podil-${i}" data-i="${i}">${formatProcenta(podil)}</output></div>
</li>`;
}

// „Vidíš 12 z 29 potravin.“ (po „z“ je vždy 2. pád; jednotné číslo jen u jediné položky)
function textPoctu(videt, celkem) {
  return 'Vidíš ' + videt + ' z ' + celkem + (celkem === 1 ? ' potraviny.' : ' potravin.');
}

// Zvýrazněná čísla jsou ve <span>, ne v <p>: světlý režim martinbarna.cz přebarvuje
// všechny p, li, td a strong přes !important a zlatá čísla by zčernala.
function htmlVysledekKalkulacky(v) {
  if (!v.radky.length) {
    return '<div class="bz-kalk-prazdny">Vyber aspoň jednu potravinu a uvidíš, kolik Tě bílkoviny stojí.</div>';
  }
  const rozpis = v.radky
    .map(
      (r) => `<li><span class="bz-kalk-rozpis-nazev">${t(r.polozka.nazev)}<span class="bz-kalk-rozpis-detail">${formatG(r.gBilkovin)} bílkovin, zhruba ${formatCele(r.gJidla)}${NBSP}g potraviny</span></span><span class="bz-kalk-rozpis-cena">${formatKc(r.kcDen)}</span></li>`
    )
    .join('');
  return `<div class="bz-kalk-cisla">
<div><span class="bz-kalk-stitek">Za den</span><span class="bz-kalk-cislo">${formatKc(v.zaDen)}</span></div>
<div><span class="bz-kalk-stitek">Za 30 dní</span><span class="bz-kalk-cislo">${formatKc(v.za30)}</span></div>
</div>
<div class="bz-kalk-cil-info">Při cíli ${formatCele(v.cilG)}${NBSP}g bílkovin denně.</div>
<ul class="bz-kalk-rozpis">${rozpis}</ul>
<div class="bz-kalk-kcal">Tohle množství jídla má zhruba ${formatCele(v.kcal)}${NBSP}kcal.</div>`;
}

// Prohlížečová část stránky. Sestavení (scripts/sestav.mjs) před tenhle kód vloží
// src/spolecne.mjs bez slov `export` a oboje obalí do jedné funkce. Proto tu lze volat
// seradit(), odpovidaFiltru(), spocitejKalkulacku(), formatKc() a další bez importu.
// Tabulka i kalkulačka jsou předvyrenderované v HTML; tenhle kód je jen oživí.

const DATA = JSON.parse(document.getElementById('bz-data').textContent);
const produkty = DATA.produkty;
const podleId = {};
produkty.forEach((p) => {
  podleId[p.id] = p;
});
const $ = (id) => document.getElementById(id);

// ---------- tabulka: hledání, filtry, řazení ----------

function zapniTabulku(tabulka) {
  const tbody = tabulka.tBodies[0];
  const radky = {};
  tbody.querySelectorAll('tr[data-id]').forEach((tr) => {
    radky[tr.getAttribute('data-id')] = tr;
  });
  const pole = {
    hledat: $('bz-f-hledat'),
    kategorie: $('bz-f-kategorie'),
    obchod: $('bz-f-obchod'), // při jednom obchodu na stránce není
    libove: $('bz-f-libove'),
    razeni: $('bz-f-razeni')
  };
  const pocet = $('bz-pocet');
  const prazdno = $('bz-prazdno');
  const zrusit = $('bz-zrusit');
  const hlavicky = tabulka.querySelectorAll('th[data-klic]');

  function stav() {
    return {
      hledat: pole.hledat ? pole.hledat.value : '',
      kategorie: pole.kategorie ? pole.kategorie.value : '',
      obchod: pole.obchod ? pole.obchod.value : '',
      libove: pole.libove ? pole.libove.checked : false,
      razeni: pole.razeni ? pole.razeni.value : RAZENI_VYCHOZI
    };
  }

  function prekresli() {
    const s = stav();
    const kousek = document.createDocumentFragment();
    let videt = 0;
    seradit(produkty, s.razeni).forEach((p) => {
      const tr = radky[p.id];
      if (!tr) return;
      const ukazat = odpovidaFiltru(p, s);
      tr.hidden = !ukazat;
      if (ukazat) videt++;
      kousek.appendChild(tr);
    });
    tbody.appendChild(kousek);
    if (pocet) pocet.textContent = textPoctu(videt, produkty.length);
    if (prazdno) prazdno.hidden = videt > 0;
    if (zrusit) zrusit.hidden = !(s.hledat.trim() || s.kategorie || s.obchod || s.libove);
    const r = RAZENI[s.razeni] || RAZENI[RAZENI_VYCHOZI];
    hlavicky.forEach((th) => {
      if (th.getAttribute('data-klic') === r.klic) th.setAttribute('aria-sort', r.smer > 0 ? 'ascending' : 'descending');
      else th.removeAttribute('aria-sort');
    });
  }

  if (pole.hledat) pole.hledat.addEventListener('input', prekresli);
  [pole.kategorie, pole.obchod, pole.libove, pole.razeni].forEach((el) => {
    if (el) el.addEventListener('change', prekresli);
  });

  // Klik na hlavičku sloupce: stejný sloupec otočí směr, jiný začne „nejlepším“ směrem.
  hlavicky.forEach((th) => {
    const tlacitko = th.querySelector('button');
    if (!tlacitko || !pole.razeni) return;
    tlacitko.addEventListener('click', () => {
      const naCene = th.getAttribute('data-klic') === 'kc_za_100g_bilkovin';
      const ted = pole.razeni.value;
      if (naCene) pole.razeni.value = ted === 'kc-vzestupne' ? 'kc-sestupne' : 'kc-vzestupne';
      else pole.razeni.value = ted === 'gl-sestupne' ? 'gl-vzestupne' : 'gl-sestupne';
      prekresli();
    });
  });

  document.addEventListener('click', (e) => {
    const tlacitko = e.target.closest('[data-bz-zrusit]');
    if (!tlacitko) return;
    if (pole.hledat) pole.hledat.value = '';
    if (pole.kategorie) pole.kategorie.value = '';
    if (pole.obchod) pole.obchod.value = '';
    if (pole.libove) pole.libove.checked = false;
    prekresli();
    if (pole.hledat) pole.hledat.focus();
  });

  // Prohlížeč může po návratu zpět obnovit hodnoty polí; tabulka se s nimi srovná.
  prekresli();
}

// ---------- kalkulačka ----------

function zapniKalkulacku(seznam) {
  const cilEl = $('bz-k-cil');
  const pridat = $('bz-k-pridat');
  const mixTlacitko = $('bz-k-mix');
  const vysledek = $('bz-k-vysledek');
  const prazdne = $('bz-k-prazdne');
  const plno = $('bz-k-plno');
  const chyba = $('bz-k-chyba');
  const hlaseni = $('bz-k-hlaseni');
  const stav = {
    cil: DATA.cil,
    polozky: DATA.start.filter((x) => podleId[x.id]).map((x) => ({ id: x.id, podil: x.podil }))
  };
  let casovac = null;

  function vypocet() {
    return spocitejKalkulacku(
      stav.polozky.map((x) => ({ polozka: podleId[x.id], podil: x.podil })),
      stav.cil
    );
  }

  // Viditelná čísla se mění hned, čtečce obrazovky se výsledek ohlásí až po chvíli klidu.
  function vykresliVysledek(ohlasit = true) {
    const v = vypocet();
    vysledek.innerHTML = htmlVysledekKalkulacky(v);
    clearTimeout(casovac);
    if (!ohlasit) return;
    casovac = setTimeout(() => {
      hlaseni.textContent = v.radky.length
        ? 'Za den ' + formatKc(v.zaDen) + ', za 30 dní ' + formatKc(v.za30) + '.'
        : '';
    }, 700);
  }

  function vykresliPolozky() {
    const n = stav.polozky.length;
    seznam.innerHTML = stav.polozky
      .map((x, i) => htmlPolozkaKalkulacky(podleId[x.id], x.podil, i, n, DATA.ukazObchod))
      .join('');
    prazdne.hidden = n > 0;
    pridat.disabled = n >= KALKULACKA_MAX_POLOZEK;
    plno.hidden = n < KALKULACKA_MAX_POLOZEK;
    const vybrane = new Set(stav.polozky.map((x) => x.id));
    Array.prototype.forEach.call(pridat.options, (o) => {
      if (o.value) o.disabled = vybrane.has(o.value);
    });
  }

  function nastavPodily(podily) {
    podily.forEach((v, k) => {
      stav.polozky[k].podil = v;
    });
  }

  // Po pohybu jednoho posuvníku přepíše ostatní na místě (bez překreslení, ať se neztratí tah).
  function srovnejPosuvniky(krome) {
    seznam.querySelectorAll('input[type="range"]').forEach((r) => {
      const k = Number(r.getAttribute('data-i'));
      const v = stav.polozky[k].podil;
      if (k !== krome) r.value = v;
      r.setAttribute('aria-valuetext', v + ' %');
    });
    seznam.querySelectorAll('output').forEach((o) => {
      o.textContent = formatProcenta(stav.polozky[Number(o.getAttribute('data-i'))].podil);
    });
  }

  seznam.addEventListener('input', (e) => {
    const r = e.target;
    if (!r.matches('input[type="range"]')) return;
    const i = Number(r.getAttribute('data-i'));
    nastavPodily(rozdelPodily(stav.polozky.map((x) => x.podil), i, Number(r.value)));
    srovnejPosuvniky(i);
    vykresliVysledek();
  });

  seznam.addEventListener('click', (e) => {
    const tlacitko = e.target.closest('.bz-kalk-odebrat');
    if (!tlacitko) return;
    const i = Number(tlacitko.getAttribute('data-i'));
    stav.polozky.splice(i, 1);
    nastavPodily(rozpocitej(stav.polozky.map((x) => x.podil), 100));
    vykresliPolozky();
    vykresliVysledek();
    const zbyla = seznam.querySelectorAll('.bz-kalk-odebrat');
    (zbyla[Math.min(i, zbyla.length - 1)] || pridat).focus();
  });

  pridat.addEventListener('change', () => {
    const id = pridat.value;
    pridat.value = '';
    if (!id || !podleId[id] || stav.polozky.some((x) => x.id === id)) return;
    if (stav.polozky.length >= KALKULACKA_MAX_POLOZEK) return;
    stav.polozky.push({ id, podil: 0 });
    const n = stav.polozky.length;
    nastavPodily(n === 1 ? [100] : rozdelPodily(stav.polozky.map((x) => x.podil), n - 1, Math.round(100 / n)));
    chyba.hidden = true;
    vykresliPolozky();
    vykresliVysledek();
  });

  mixTlacitko.addEventListener('click', () => {
    const mix = nejlevnejsiMix(produkty);
    if (!mix) {
      chyba.textContent = TEXT_MIX_NEJDE;
      chyba.hidden = false;
      return;
    }
    chyba.hidden = true;
    stav.polozky = mix.map((x) => ({ id: x.id, podil: x.podil }));
    vykresliPolozky();
    vykresliVysledek();
  });

  function prectiCil() {
    const v = parseFloat(String(cilEl.value).replace(',', '.'));
    return isFinite(v) ? v : null;
  }
  cilEl.addEventListener('input', () => {
    const v = prectiCil();
    if (v !== null && v >= CIL_MIN && v <= CIL_MAX) {
      stav.cil = v;
      vykresliVysledek();
    }
  });
  cilEl.addEventListener('change', () => {
    const v = prectiCil();
    stav.cil = Math.min(CIL_MAX, Math.max(CIL_MIN, Math.round(v === null ? stav.cil : v)));
    cilEl.value = stav.cil;
    vykresliVysledek();
  });

  // Start: srovnat stav s polem cíle (prohlížeč ho mohl obnovit) a překreslit podle dat.
  const obnoveny = prectiCil();
  if (obnoveny !== null && obnoveny >= CIL_MIN && obnoveny <= CIL_MAX) stav.cil = obnoveny;
  else cilEl.value = stav.cil;
  vykresliPolozky();
  vykresliVysledek(false);
}

const tabulka = $('bz-tabulka');
if (tabulka) zapniTabulku(tabulka);
const seznamKalkulacky = $('bz-k-polozky');
if (seznamKalkulacky) zapniKalkulacku(seznamKalkulacky);

})();
