// Potraviny, které jsou v databázi appky (curated_foods), ale ne v malé databázi generátoru
// assets/food-db.json. Používají je jen PDF makro-plány, počítá je tentýž kód (MealGen.macrosFor).
//
// ⛔ Do assets/food-db.json je NEPŘIDÁVEJ: generátor jídelníčku existuje dvakrát (appka + web)
// a hlídá to pre-commit hook. Tady je to jen lokální doplněk výpočtu PDF.
//
// ⭐ Kolo 3 (25. 9. 2026): šéf opravil generické řádky v curated_foods na mediány skutečných výrobků;
// tady jsou PŘESNĚ ty hodnoty (id v poli zdroj), ať PDF i appka říkají totéž. Níž původní ověření.
//
// Ověření podle pravidla 7b (agent 79. šéfa, 25. 9. 2026, dotaz do curated_foods projektu
// kfkmghvhqwqtsalqjmrp). Generické položky „Proteinová tyčinka" a „Pizza Margherita" nemají
// v poznámce zdroj, proto jsou porovnané se skutečnými výrobky:
//
// - Proteinová tyčinka (kolo 2, můj dotaz; šéf pak v kole 3 spočítal medián 162 tyčinek, viz pole zdroj):
//   generická 350 kcal, B 30, S 35, T 10, vl. 4 na 100 g. Medián 70 skutečných
//   proteinových tyčinek s EAN z Open Food Facts CZ (bílkoviny aspoň 20 g/100 g): 400 kcal,
//   B 26,6, S 34,5, T 17, vl. 5,6. Tuk generické položky je o 41 % nižší (limit 15 %) ⇒ bereme medián.
//   Sacharidy z evropských etiket jsou bez vlákniny (carbBasis 'available').
// - Pizza Margherita: generická 249 kcal, B 11, S 30, T 9, vl. 2 na 100 g. Medián 7 margherit
//   prodávaných v ČR se zdrojem u výrobce (etiketa s EAN nebo e-shop: Jeden Tag, Váš Výběr, Clever,
//   Vemondo, Chef Select, Dr. Oetker Ristorante, Re Pomodoro): 237 kcal, B 9,2, S 34, T 6,4, vl. 2.
//   Tuk generické položky +41 %, bílkoviny +20 % ⇒ bereme medián (zdroj nejblíž výrobci, Martin 13. 9.).
//   Pro srovnání sýrové pizzy USDA/CIQUAL (FDC 170317, 2708622, 2708612, CIQUAL cheese and mushrooms):
//   medián 266 kcal, B 11,2, S 28,2 bez vlákniny, T 10,7. Americká sýrová pizza je tučnější než margherita.
// - Pivo 12° (světlý ležák): USDA FDC 168746 (Beer, regular), 43 kcal, B 0,5, S 3,6, T 0 na 100 g.
//   Kalorie piva jsou hlavně z alkoholu, proto makra nedají součet kcal.
//
// ⭐ [25. 9. 2026, generátor +101 potravin] `proteinova-tycinka` odsud ODEŠLA do assets/food-db.json
// se STEJNÝMI hodnotami (400/26/34/17/6, available, curated_foods 2ddd5ca7…). Kontrola duplicity
// v makro-plan-core.js by jinak build shodila. Přepočet obou PDF po přesunu: 0 rozdílů.
module.exports = [
  { id: 'pizza-margherita', name: 'Pizza margherita',
    per100: { kcal: 240, p: 9, c: 34, f: 7, fib: 2, carbBasis: 'available' },
    zdroj: 'curated_foods id 97cd02cb-eda4-4c36-b1e6-3aa887a38908 „Pizza Margherita", opraveno 25. 9. 2026 na medián margherit prodávaných v ČR se zdrojem u výrobce' },
  { id: 'pivo-12', name: 'Pivo 12° světlý ležák',
    per100: { kcal: 43, p: 0.5, c: 3.6, f: 0, fib: 0, carbBasis: 'available' },
    zdroj: 'USDA FDC 168746 (Alcoholic beverage, beer, regular, all), v curated_foods „Pivo světlé"' },
];
