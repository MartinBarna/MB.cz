# Jednorázová kampaň: „Zkus videokurz + 15 %" (NÁVRH — čeká na test + „pošli ostro")

Pro: všechny lead-magnet leady (track `lead-magnet`), kdo ještě nekoupil videokurz (skip buyers řeší engine).
Jednorázový broadcast (ne drip krok). Test-first na `fitness.barna@gmail.com` (obě varianty), pak po „pošli ostro" ostro.

**Subject:** `Zkus videokurz zadarmo, bez závazku`
**Preheader:** `Pár lekcí zdarma, bez karty. A když si vezmeš celý, máš 15 %.`

```json
[
  {"t":"p","html":"Ahoj{{fn_space}},"},
  {"t":"p","html":"před časem sis stáhl[a] plán zdarma a já slíbil, že Ti občas hodím něco, co reálně pomůže. Tak tady to je — a žádný tlak."},
  {"t":"p","html":"Můj <strong>Videokurz výživy</strong> si můžeš zkusit hned a <strong>zadarmo</strong> — pustím Tě do prvních lekcí, bez karty, bez závazku. Mrkneš, jestli Ti sedne, jak učím."},
  {"t":"btn","text":"Pustit videokurz zdarma","href":"https://www.martinbarna.cz/videokurz#zdarma"},
  {"t":"p","html":"A jestli Ti to sedne a vezmeš si celý kurz (182 videí + bonusy, doživotně), dávám Ti teď <strong>15 %</strong> s kódem <strong>ZACNI15</strong> — z 800 Kč je <strong>680 Kč</strong>. Zadáš ho v košíku."},
  {"t":"btn","text":"Chci celý videokurz se slevou","href":"https://form.simpleshop.cz/3Vbl/buy/"},
  {"t":"p","html":"Klidně zkus zdarma a <strong>rozhodni se kdykoliv</strong> — lekce ani kód Ti neutečou. <strong>Be Effective!</strong><br>Martin"},
  {"t":"ps","html":"P.S. Máš dotaz, jestli je to pro Tebe? Napiš mi jednou větou, co řešíš. Odpovím."}
]
```

Pozn.: `[a]` / `[[zena||muz]]` = genderové tokeny, engine je doplní podle segmentu (žena „stáhla", muž „stáhl").
Patička + unsubscribe doplní engine automaticky (app_config). Skip buyers + idempotence řeší drip-send.
