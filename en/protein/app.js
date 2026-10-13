/* Protein per 100 kcal tool. Built from src/en/spolecne-en.mjs and src/en/app-en.js, do not edit by hand. */
(function () {
'use strict';
// Shared by the build (Node) and the browser: calculations, number formatting and the small HTML
// pieces of the price calculator. The build removes the word `export` from this file and puts it in
// front of app-en.js (see scripts/sestav.mjs), so here: no import, nothing from Node, no regex
// lookbehind (older Safari would not run the whole file). Keep this file ASCII and English: it ends
// up in the public app.js, and a test checks that the English page has no Czech text.
// Numbers are rounded only when shown. Every calculation runs at full precision.
//
// The formulas are the same as in src/spolecne.mjs (the Czech tool). scripts/test-en.mjs compares the
// two on random input, so the English and the Czech page cannot drift apart.

const HIGH_THRESHOLD = 10; // g of protein per 100 kcal that earns the label LABEL
const LABEL = 'High protein per calorie';
const SERVING_PROTEIN_G = 30; // the "serving" in the calculator: 30 g of protein
const MAX_ITEMS = 4; // calculator: compare up to this many items
const PROTEIN_MIN = 0.1; // custom food: allowed protein per 100 g
const PROTEIN_MAX = 100;
const NBSP = String.fromCharCode(0xa0);

// Pack size units and how many grams one unit is.
const UNITS = [
  ['g', 1],
  ['kg', 1000],
  ['oz', 28.349523125],
  ['lb', 453.59237]
];
// Currency symbols for the calculator: [symbol, text in the menu]. "No symbol" shows plain numbers.
const CURRENCIES = [
  ['$', '$ (dollar)'],
  [String.fromCharCode(0x20ac), String.fromCharCode(0x20ac) + ' (euro)'],
  [String.fromCharCode(0xa3), String.fromCharCode(0xa3) + ' (pound)'],
  ['', 'No symbol']
];

const fmt0 = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const fmt1 = new Intl.NumberFormat('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const fmt2 = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function isNum(n) {
  return typeof n === 'number' && isFinite(n);
}

// ---------- Calculations ----------

// grams of protein per 100 kcal
function proteinPer100kcal(protein100g, kcal100g) {
  return kcal100g > 0 ? protein100g / kcal100g * 100 : null;
}

function isHigh(ratio) {
  // small tolerance for floating point (3.4 / 34 * 100 comes out as 10.000000000000002)
  return isNum(ratio) && ratio >= HIGH_THRESHOLD - 1e-9;
}

// pack size in grams from a size and a unit, or null
function packGrams(size, unit) {
  if (!(size > 0)) return null;
  for (let i = 0; i < UNITS.length; i++) {
    if (UNITS[i][0] === unit) return size * UNITS[i][1];
  }
  return null;
}

function proteinInPack(packG, protein100g) {
  return packG * protein100g / 100;
}

// cost of 100 g of protein: price / (pack g * protein per 100 g / 100) * 100
function costPer100gProtein(price, packG, protein100g) {
  const protein = proteinInPack(packG, protein100g);
  return protein > 0 && price > 0 ? price / protein * 100 : null;
}

// kcal that come with `proteinG` grams of protein from this food
function kcalForProtein(food, proteinG) {
  return food.protein_100g > 0 ? proteinG / food.protein_100g * food.kcal_100g : null;
}

// "12", "12.50", "12,50", "1,200.50", "1.200,50", "1 200" -> number, anything else -> null.
// A single dot is always a decimal point ("1.500" = 1.5). A comma followed by exactly three digits and
// nothing else after a leading group is read as thousands ("1,500" = 1500), any other single comma
// is a decimal comma ("12,5" = 12.5).
function parseNumber(text) {
  const s = String(text == null ? '' : text).replace(/\s/g, '');
  if (!s) return null;
  let t;
  if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) t = s.replace(/,/g, ''); // 1,200.50  1,234,567
  else if (/^\d{1,3}(\.\d{3}){2,}(,\d+)?$/.test(s) || /^\d{1,3}(\.\d{3})+,\d+$/.test(s)) t = s.replace(/\./g, '').replace(',', '.'); // 1.200,50  1.234.567
  else if (/^(\d+([.,]\d*)?|[.,]\d+)$/.test(s)) t = s.replace(',', '.'); // 12  12.5  12,5  .5  5.
  else return null;
  const n = Number(t);
  return isFinite(n) ? n : null;
}

// ---------- Sorting and filtering ----------

const SORTS = {
  'ratio-desc': { key: 'ratio', dir: -1, label: 'Most protein per 100 kcal' },
  'ratio-asc': { key: 'ratio', dir: 1, label: 'Least protein per 100 kcal' },
  'protein-desc': { key: 'protein_100g', dir: -1, label: 'Most protein per 100 g' },
  'protein-asc': { key: 'protein_100g', dir: 1, label: 'Least protein per 100 g' },
  'kcal-asc': { key: 'kcal_100g', dir: 1, label: 'Fewest kcal per 100 g' },
  'kcal-desc': { key: 'kcal_100g', dir: -1, label: 'Most kcal per 100 g' },
  'name-asc': { key: 'name', dir: 1, label: 'Name A to Z' }
};
const SORT_DEFAULT = 'ratio-desc';

function sortFoods(foods, sortKey) {
  const s = SORTS[sortKey] || SORTS[SORT_DEFAULT];
  return foods.slice().sort((a, b) => {
    const x = a[s.key];
    const y = b[s.key];
    if (typeof x === 'number' && typeof y === 'number' && x !== y) return (x - y) * s.dir;
    if (typeof x === 'string' && typeof y === 'string' && x !== y) return x.localeCompare(y, 'en') * s.dir;
    return a.name.localeCompare(b.name, 'en') || a.state.localeCompare(b.state, 'en') || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  });
}

// Accent marks left over after normalize('NFD') are removed, so "cafe" also finds a food written with an accent.
const MARKS = new RegExp('[' + String.fromCharCode(0x300) + '-' + String.fromCharCode(0x36f) + ']', 'g');
function normalize(text) {
  return String(text).toLowerCase().normalize('NFD').replace(MARKS, '');
}

// f: { search, category, state, high }
function matchesFilter(food, f) {
  if (f.category && food.category !== f.category) return false;
  if (f.state && food.state !== f.state) return false;
  if (f.high && !food.high) return false;
  const words = normalize(f.search || '').split(/\s+/).filter(Boolean);
  if (words.length) {
    const hay = normalize([food.name, food.state, food.category, food.note || ''].join(' '));
    for (let i = 0; i < words.length; i++) if (hay.indexOf(words[i]) === -1) return false;
  }
  return true;
}

// ---------- Formatting ----------

function formatG(n) {
  return isNum(n) ? fmt1.format(n) + NBSP + 'g' : '-';
}
// grams without a needless ".0": 225 g, 100.7 g
function formatGflex(n) {
  if (!isNum(n)) return '-';
  const r = Math.round(n * 10) / 10;
  return (Number.isInteger(r) ? fmt0 : fmt1).format(r) + NBSP + 'g';
}
function formatKcal(n) {
  return isNum(n) ? fmt0.format(n) + NBSP + 'kcal' : '-';
}
function formatInt(n) {
  return isNum(n) ? fmt0.format(n) : '-';
}
function formatMoney(n, symbol) {
  return isNum(n) ? (symbol || '') + fmt2.format(n) : '-';
}
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
// "2026-10-13" -> "13 October 2026"
function formatDate(iso) {
  const p = String(iso).split('-').map(Number);
  return p[2] + ' ' + MONTHS[p[1] - 1] + ' ' + p[0];
}
function countText(shown, total) {
  return 'Showing ' + shown + ' of ' + total + (total === 1 ? ' food.' : ' foods.');
}
// food name with its state, as used in menus and sentences: "Lentils (dry)", "Cheddar cheese"
function foodLabel(food) {
  return food.state === 'as sold' ? food.name : food.name + ' (' + food.state + ')';
}

// ---------- Text and HTML ----------

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
function esc(text) {
  return String(text).replace(/[&<>"']/g, (c) => ESC[c]);
}

// A number and its unit never break across lines.
function typography(text) {
  return String(text).replace(/(\d) +(g|kg|kcal|oz|lb|ml|%)(?=[\s.,;:)?!]|$)/g, '$1' + NBSP + '$2');
}

// foodGroups: [[category, [food, ...]], ...]
function htmlFoodOptions(foodGroups) {
  let h = '<option value="">Choose a food</option><option value="custom">Other food (enter its protein)</option>';
  for (let i = 0; i < foodGroups.length; i++) {
    const options = foodGroups[i][1]
      .map((f) => '<option value="' + esc(f.id) + '">' + esc(foodLabel(f)) + '</option>')
      .join('');
    h += '<optgroup label="' + esc(foodGroups[i][0]) + '">' + options + '</optgroup>';
  }
  return h;
}

function htmlUnitOptions() {
  return UNITS.map((u) => '<option value="' + u[0] + '">' + u[0] + '</option>').join('');
}

// One item of the price calculator. uid is unique for the life of the page (ids of the fields).
function htmlItem(uid, position, foodOptions, symbol, removable) {
  return (
    '<li class="bz-item" data-uid="' + uid + '">' +
    '<div class="bz-item-head"><h3 class="bz-item-title">Item ' + position + '</h3>' +
    '<button type="button" class="bz-kalk-odebrat bz-item-remove" aria-label="Remove item ' + position + '"' + (removable ? '' : ' hidden') + '><span aria-hidden="true">&times;</span></button></div>' +
    '<div class="bz-pole"><label for="bz-p-food-' + uid + '">Food</label><select id="bz-p-food-' + uid + '" class="bz-p-food" autocomplete="off">' + foodOptions + '</select></div>' +
    '<div class="bz-pole bz-p-custom" hidden><label for="bz-p-prot-' + uid + '">Protein per 100 g</label><div class="bz-vstup-jednotka"><input id="bz-p-prot-' + uid + '" class="bz-p-prot" type="text" inputmode="decimal" autocomplete="off" placeholder="0"><span aria-hidden="true">g</span></div></div>' +
    '<div class="bz-p-radek">' +
    '<div class="bz-pole"><label for="bz-p-size-' + uid + '">Pack size</label><div class="bz-vstup-jednotka"><input id="bz-p-size-' + uid + '" class="bz-p-size" type="text" inputmode="decimal" autocomplete="off" placeholder="0"><select id="bz-p-unit-' + uid + '" class="bz-p-unit" aria-label="Pack size unit" autocomplete="off">' + htmlUnitOptions() + '</select></div></div>' +
    '<div class="bz-pole"><label for="bz-p-price-' + uid + '">Price</label><div class="bz-vstup-jednotka"><span class="bz-p-cur" aria-hidden="true">' + esc(symbol) + '</span><input id="bz-p-price-' + uid + '" class="bz-p-price" type="text" inputmode="decimal" autocomplete="off" placeholder="0.00"></div></div>' +
    '</div>' +
    '<div class="bz-item-vysledek">' + htmlItemResult({ status: 'empty' }, false, symbol) + '</div>' +
    '</li>'
  );
}

// input: { food: id | "custom" | "", protein, size, unit, price } (text as typed)
// foodsById: { id: food }. Returns { status: empty | incomplete | invalid | ok, message, ... }.
function computeItem(input, foodsById) {
  if (!input.food) return { status: 'empty' };
  let food = null;
  let protein100g;
  if (input.food === 'custom') {
    if (!String(input.protein).trim()) return { status: 'incomplete', message: 'Enter the protein per 100 g of your food.' };
    protein100g = parseNumber(input.protein);
    if (protein100g === null || protein100g < PROTEIN_MIN || protein100g > PROTEIN_MAX) {
      return { status: 'invalid', message: 'Protein per 100 g must be a number from ' + PROTEIN_MIN + ' to ' + PROTEIN_MAX + '.' };
    }
  } else {
    food = foodsById[input.food];
    if (!food) return { status: 'empty' };
    protein100g = food.protein_100g;
  }
  const sizeBlank = !String(input.size).trim();
  const priceBlank = !String(input.price).trim();
  if (sizeBlank && priceBlank) return { status: 'incomplete', message: 'Enter the pack size and the price.' };
  if (sizeBlank) return { status: 'incomplete', message: 'Enter the pack size.' };
  if (priceBlank) return { status: 'incomplete', message: 'Enter the price.' };
  const size = parseNumber(input.size);
  const packG = size === null ? null : packGrams(size, input.unit);
  if (packG === null) return { status: 'invalid', message: 'Pack size must be a number above 0.' };
  const price = parseNumber(input.price);
  if (price === null || !(price > 0)) return { status: 'invalid', message: 'Price must be a number above 0.' };
  const per100g = costPer100gProtein(price, packG, protein100g);
  return {
    status: 'ok',
    name: food ? foodLabel(food) : 'Other food',
    per100g: per100g,
    per30g: per100g * SERVING_PROTEIN_G / 100,
    proteinG: proteinInPack(packG, protein100g),
    packG: packG,
    ratio: food ? food.ratio : null,
    kcal30: food ? kcalForProtein(food, SERVING_PROTEIN_G) : null
  };
}

// r: result of computeItem; cheapest: true when this item is the cheapest of two or more
function htmlItemResult(r, cheapest, symbol) {
  if (r.status === 'empty') return '<p class="bz-p-hint">Choose a food, then enter the pack size and the price.</p>';
  if (r.status === 'incomplete') return '<p class="bz-p-hint">' + esc(r.message) + '</p>';
  if (r.status === 'invalid') return '<p class="bz-p-hint bz-p-error">' + esc(r.message) + '</p>';
  let detail = 'The pack has ' + formatGflex(r.proteinG) + ' of protein.';
  if (r.kcal30 !== null) {
    detail += ' ' + SERVING_PROTEIN_G + ' g of protein from this food = ' + formatKcal(r.kcal30) + '.';
  }
  return (
    '<div class="bz-res">' +
    (cheapest ? '<span class="bz-res-badge">Cheapest</span>' : '') +
    '<div class="bz-kalk-cisla">' +
    '<div><span class="bz-kalk-stitek">Per 100 g of protein</span><span class="bz-kalk-cislo">' + esc(formatMoney(r.per100g, symbol)) + '</span></div>' +
    '<div><span class="bz-kalk-stitek">Per ' + SERVING_PROTEIN_G + ' g of protein</span><span class="bz-kalk-cislo">' + esc(formatMoney(r.per30g, symbol)) + '</span></div>' +
    '</div>' +
    '<p class="bz-res-detail">' + typography(detail) + '</p>' +
    '</div>'
  );
}

// Browser part of the English protein tool. The build puts src/en/spolecne-en.mjs (without the word
// `export`) in front of this file and wraps both in one function, so shared functions such as
// sortFoods() or computeItem() can be called here without imports. The table and the first two
// calculator items are pre-rendered in the HTML; this code only brings them to life.

const DATA = JSON.parse(document.getElementById('bz-data').textContent);
const foods = DATA.foods;
const foodsById = {};
foods.forEach((f) => {
  foodsById[f.id] = f;
});
const $ = (id) => document.getElementById(id);

// ---------- table: search, filters, sorting ----------

function initTable(table) {
  const tbody = table.tBodies[0];
  const rows = {};
  tbody.querySelectorAll('tr[data-id]').forEach((tr) => {
    rows[tr.getAttribute('data-id')] = tr;
  });
  const field = {
    search: $('bz-f-search'),
    category: $('bz-f-category'),
    state: $('bz-f-state'),
    high: $('bz-f-high'),
    sort: $('bz-f-sort')
  };
  const count = $('bz-count');
  const empty = $('bz-empty');
  const reset = $('bz-reset');
  const heads = table.querySelectorAll('th[data-key]');

  function readState() {
    return {
      search: field.search ? field.search.value : '',
      category: field.category ? field.category.value : '',
      state: field.state ? field.state.value : '',
      high: field.high ? field.high.checked : false,
      sort: field.sort ? field.sort.value : SORT_DEFAULT
    };
  }

  function redraw() {
    const s = readState();
    const fragment = document.createDocumentFragment();
    let shown = 0;
    sortFoods(foods, s.sort).forEach((f) => {
      const tr = rows[f.id];
      if (!tr) return;
      const show = matchesFilter(f, s);
      tr.hidden = !show;
      if (show) shown++;
      fragment.appendChild(tr);
    });
    tbody.appendChild(fragment);
    if (count) count.textContent = countText(shown, foods.length);
    if (empty) empty.hidden = shown > 0;
    if (reset) reset.hidden = !(s.search.trim() || s.category || s.state || s.high);
    const sort = SORTS[s.sort] || SORTS[SORT_DEFAULT];
    heads.forEach((th) => {
      if (th.getAttribute('data-key') === sort.key) th.setAttribute('aria-sort', sort.dir > 0 ? 'ascending' : 'descending');
      else th.removeAttribute('aria-sort');
    });
  }

  if (field.search) field.search.addEventListener('input', redraw);
  [field.category, field.state, field.high, field.sort].forEach((el) => {
    if (el) el.addEventListener('change', redraw);
  });

  // A click on a column heading: the same column flips direction, another column starts with its "best" direction.
  const PAIRS = {
    ratio: ['ratio-desc', 'ratio-asc'],
    protein_100g: ['protein-desc', 'protein-asc'],
    kcal_100g: ['kcal-asc', 'kcal-desc']
  };
  heads.forEach((th) => {
    const button = th.querySelector('button');
    const pair = PAIRS[th.getAttribute('data-key')];
    if (!button || !pair || !field.sort) return;
    button.addEventListener('click', () => {
      field.sort.value = field.sort.value === pair[0] ? pair[1] : pair[0];
      redraw();
    });
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('[data-bz-zrusit]')) return;
    if (field.search) field.search.value = '';
    if (field.category) field.category.value = '';
    if (field.state) field.state.value = '';
    if (field.high) field.high.checked = false;
    redraw();
    if (field.search) field.search.focus();
  });

  // The browser may restore field values after "back"; sync the table with them.
  redraw();
}

// ---------- price calculator ----------

function initCalculator(list) {
  const currency = $('bz-p-cur');
  const addButton = $('bz-p-add');
  const live = $('bz-p-live');
  const foodOptions = htmlFoodOptions(DATA.categories.map((c) => [c, foods.filter((f) => f.category === c)]));
  let nextUid = list.querySelectorAll('.bz-item').length + 1;
  let timer = null;

  function items() {
    return Array.prototype.slice.call(list.querySelectorAll('.bz-item'));
  }

  function readItem(li) {
    return {
      food: li.querySelector('.bz-p-food').value,
      protein: li.querySelector('.bz-p-prot').value,
      size: li.querySelector('.bz-p-size').value,
      unit: li.querySelector('.bz-p-unit').value,
      price: li.querySelector('.bz-p-price').value
    };
  }

  // Titles and remove buttons depend on how many items there are.
  function renumber() {
    const all = items();
    all.forEach((li, i) => {
      li.querySelector('.bz-item-title').textContent = 'Item ' + (i + 1);
      const remove = li.querySelector('.bz-item-remove');
      remove.hidden = all.length < 2;
      remove.setAttribute('aria-label', 'Remove item ' + (i + 1));
    });
    addButton.disabled = all.length >= MAX_ITEMS;
  }

  function update(announce) {
    const symbol = currency.value;
    const all = items();
    const results = all.map((li) => computeItem(readItem(li), foodsById));
    const good = results.filter((r) => r.status === 'ok');
    const cheapestValue = good.length >= 2 ? Math.min.apply(null, good.map((r) => r.per100g)) : null;
    all.forEach((li, i) => {
      const r = results[i];
      const cheapest = cheapestValue !== null && r.status === 'ok' && r.per100g <= cheapestValue * (1 + 1e-9);
      li.querySelector('.bz-item-vysledek').innerHTML = htmlItemResult(r, cheapest, symbol);
      li.classList.toggle('bz-item-best', cheapest);
    });
    clearTimeout(timer);
    if (announce === false) return;
    // On screen the numbers change at once, a screen reader hears them after a short pause.
    timer = setTimeout(() => {
      if (!good.length) {
        live.textContent = '';
        return;
      }
      const best = good.slice().sort((x, y) => x.per100g - y.per100g)[0];
      live.textContent = (good.length >= 2 ? 'Cheapest: ' : '') + best.name + ', ' + formatMoney(best.per100g, symbol) + ' per 100 g of protein.';
    }, 700);
  }

  list.addEventListener('input', () => update());
  list.addEventListener('change', (e) => {
    if (e.target.classList.contains('bz-p-food')) {
      const li = e.target.closest('.bz-item');
      li.querySelector('.bz-p-custom').hidden = e.target.value !== 'custom';
    }
    update();
  });
  list.addEventListener('click', (e) => {
    const button = e.target.closest('.bz-item-remove');
    if (!button) return;
    const li = button.closest('.bz-item');
    const index = items().indexOf(li);
    li.remove();
    renumber();
    update();
    const rest = items();
    (rest[Math.min(index, rest.length - 1)].querySelector('.bz-p-food') || addButton).focus();
  });

  addButton.addEventListener('click', () => {
    if (items().length >= MAX_ITEMS) return;
    list.insertAdjacentHTML('beforeend', htmlItem(nextUid++, items().length + 1, foodOptions, currency.value, true));
    renumber();
    update(false);
    const added = items();
    added[added.length - 1].querySelector('.bz-p-food').focus();
  });

  currency.addEventListener('change', () => {
    items().forEach((li) => {
      li.querySelector('.bz-p-cur').textContent = currency.value;
    });
    update();
  });

  // The browser may restore field values after "back": show the custom field where needed and recalculate.
  items().forEach((li) => {
    li.querySelector('.bz-p-custom').hidden = li.querySelector('.bz-p-food').value !== 'custom';
  });
  items().forEach((li) => {
    li.querySelector('.bz-p-cur').textContent = currency.value;
  });
  renumber();
  update(false);
}

const table = $('bz-table');
if (table) initTable(table);
const itemList = $('bz-items');
if (itemList) initCalculator(itemList);

})();
