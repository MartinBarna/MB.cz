# Nurture sekvence `academy-nastroj` (NÁVRH — čeká na test + schválení)

Pro leady, kteří použili FREE generátor (jídelníček/trénink) na `/nastroje-zdarma/` a nechali e-mail.
Cíl: dovést je k Barna Academy. Genderově neutrální (segment je smíšený → `other`).

**Track:** `academy-nastroj` · **Kadence:** step0 hned → wait_days 2 → 3 → 4 → konec.

> ⚠️ STANDING RULE: nejdřív `[TEST]` na `fitness.barna@gmail.com` (test_email + track `academy-nastroj` + step 0–3),
> zkontrolovat render, teprve po Martinově „pošli ostro" pustit. Čísla (224/20) a cenu (8 900/12 900) ověřit před vložením.

## Routing fix (nutné, jinak leady spadnou do špatného tracku)
`akademie/_supabase/functions/lead-capture/index.ts` dnes nenastavuje `track`. Doplnit:
```ts
const track = source.startsWith('nastroj-') ? 'academy-nastroj' : undefined;
// ...v .insert({...}) přidat:  ...(track ? { track } : {})
```
Frontend `lead-form.js` na lite stránkách už posílá `source` = `nastroj-jidelnicek-zdarma` / `nastroj-trenink-zdarma` → uprav prefix-match na `nastroj-` (sedí).
Pozn.: tohle nasadit AŽ ve chvíli, kdy šablony existují v DB — jinak by leady neměly co dostat.

---

## Step 0 — Welcome (hned) · wait_days: 2
**subject:** `Hotovo — a tady je druhý nástroj zdarma{{fn_suffix}}`
**preheader:** `Díky, že jsi vyzkoušel[a] generátor. Mám pro Tebe ještě jeden.`
```json
[
  {"t":"p","html":"Ahoj{{fn_space}},"},
  {"t":"p","html":"díky, že sis vygeneroval[a] plán přes můj <strong>generátor zdarma</strong>. Není to hračka pro efekt — počítá s reálnými makry a dává rozumný základ, ze kterého se dá rovnou jet."},
  {"t":"p","html":"Ať to nezůstane u jednoho: na stránce máš <strong>dva nástroje</strong> — jídelníček i trénink. Jestli sis pustil[a] zatím jen jeden, mrkni i na ten druhý:"},
  {"t":"btn","text":"Oba generátory zdarma","href":"https://martinbarna.cz/nastroje-zdarma/"},
  {"t":"p","html":"Jak z toho vytěžit maximum:"},
  {"t":"bullets","items":["Vezmi plán jako <strong>kostru</strong>, ne svaté písmo — uprav potraviny za ty, co Ti chutnají, makra drž zhruba.","Dej tomu <strong>aspoň 2–3 týdny</strong>, než budeš soudit. Tělo nereaguje ze dne na den.","Buď k sobě [[poctivá||poctivý]] — plán funguje jen tak dobře, jak ho držíš."]},
  {"t":"p","html":"Tyhle generátory jsou ochutnávka. <strong>Plné verze</strong> a <strong>224 lekcí ve 20 modulech</strong> — celý systém, jak tohle dělat pro sebe i pro klienty — žijou v <strong>Barna Academy</strong>. K tomu se dostaneme, dnes hlavně vyzkoušej oba nástroje."},
  {"t":"p","html":"Příští dny Ti pošlu pár věcí, co u lidí dělají největší rozdíl. Krátce a k věci.<br><strong>Be Effective!</strong><br>Martin"},
  {"t":"ps","html":"P.S. Odpověz mi jednou větou: děláš to spíš pro sebe, nebo i pro klienty? Čtu si to a podle toho Ti píšu."}
]
```

## Step 1 — Hodnota/edukace · wait_days: 3
**subject:** `Proč Ti makra „nesedí" (a jak to spravit)`
**preheader:** `Nejčastější chyba, na které lidi i trenéři shoří.`
```json
[
  {"t":"p","html":"Ahoj{{fn_space}},"},
  {"t":"p","html":"generátor Ti dal čísla. Ale čísla samotná nikoho nezformovala. Tady je věc, kterou vidím pořád dokola — u lidí, co makají pro sebe, i u trenérů:"},
  {"t":"p","html":"<strong>Makra nastavíš jednou a pak je půl roku neměníš.</strong> Tělo se ale adaptuje. Co fungovalo na startu, za pár týdnů přestane. Není to selhání vůle — je to fyziologie."},
  {"t":"p","html":"Co s tím prakticky:"},
  {"t":"bullets","items":["Drž <strong>bílkovinu vysoko a stabilně</strong> (zhruba 1,6–2 g na kg) — to je páka, na kterou se nešahá.","Hýbej hlavně <strong>sacharidy a tuky</strong> podle toho, jak reaguje váha a zrcadlo — podle <strong>týdenního průměru</strong>, ne jednoho dne.","U tréninku stejně: <strong>progresivní přetížení</strong>. Když týdny zvedáš pořád stejně, tělo nemá důvod se měnit."]},
  {"t":"p","html":"Tohle je rozdíl mezi „mám plán" a „umím plán řídit". To druhé je dovednost — a přesně tu učím v <strong>Barna Academy</strong> krok za krokem. Dnes stačí pohlídat bílkovinu a sledovat průměr."},
  {"t":"p","html":"<strong>Be Effective!</strong><br>Martin"}
]
```

## Step 2 — Co je Academy + value stack · wait_days: 4
**subject:** `Co celé je Barna Academy (a pro koho)`
**preheader:** `Generátory v plné verzi, klientské materiály, audio, certifikace.`
```json
[
  {"t":"p","html":"Ahoj{{fn_space}},"},
  {"t":"p","html":"slíbil jsem, že si o Academy řekneme pořádně. Narovinu, bez balastu — co uvnitř je a jestli je to pro Tebe."},
  {"t":"p","html":"<strong>Barna Academy</strong> je online škola pro trenéry a výživové poradce — ale klidně i pro lidi, co to chtějí umět pořádně sami pro sebe. Celý můj systém na jednom místě:"},
  {"t":"bullets","items":["<strong>224 lekcí ve 20 modulech</strong> — výživa, trénink, práce s klientem, byznys. Od základů po pokročilé.","<strong>Generátory v plné verzi</strong> — plný nástroj na jídelníčky i tréninky, ne ochutnávka.","<strong>Klientské materiály k přebrandování</strong> — vědecky podložené PDF pod tvým jménem a logem. Ušetří desítky hodin.","<strong>Audio lekce</strong> — pustíš si je v autě nebo na procházce.","<strong>Certifikace</strong> na konci.","<strong>Videokurz</strong> výživy jako součást balíčku."]},
  {"t":"p","html":"Logika je pořád stejná: <strong>neprodávám ryby, učím rybařit.</strong> Nedostaneš jeden jídelníček — dostaneš schopnost sestavit jakýkoliv, sobě i komukoliv dalšímu."},
  {"t":"btn","text":"Prohlédnout celou Academy","href":"https://martinbarna.cz/akademie/"},
  {"t":"p","html":"<strong>Doživotní přístup</strong>, vracíš se kdy chceš. Příště Ti napíšu o ceně — teď se hlavně mrkni dovnitř."},
  {"t":"p","html":"<strong>Be Effective!</strong><br>Martin"},
  {"t":"ps","html":"P.S. Nejsi si jistý[a], jestli je to pro Tebe? Napiš mi na e-mail nebo WhatsApp a řeknu Ti narovinu, ať neutrácíš zbytečně."}
]
```

## Step 3 — Nabídka/urgence · wait_days: null (konec)
**subject:** `Zaváděcí cena Academy: 8 900 místo 12 900{{fn_suffix}}`
**preheader:** `Doživotní přístup. Než cena vyletí na plnou.`
```json
[
  {"t":"p","html":"Ahoj{{fn_space}},"},
  {"t":"p","html":"narovinu, ať nezdržuju. <strong>Barna Academy</strong> teď běží za <strong>zaváděcí cenu 8 900 Kč</strong> místo plných <strong>12 900 Kč</strong>."},
  {"t":"p","html":"Není to umělá sleva na 14 dní. Je to <strong>zaváděcí cena</strong> — odměna pro lidi, co naskočí teď, na začátku. Až bude obsahu a referencí víc, cena půjde nahoru a zpátky už se nevrátí."},
  {"t":"p","html":"Co za to máš:"},
  {"t":"bullets","items":["<strong>224 lekcí ve 20 modulech</strong> + generátory v plné verzi","<strong>Přebrandovatelné klientské materiály</strong> — okamžitě použitelné","<strong>Audio lekce, certifikace, videokurz</strong>","<strong>Doživotní přístup</strong> — zaplatíš jednou, máš napořád, včetně aktualizací"]},
  {"t":"p","html":"Spočítej si to: jestli to děláš pro klienty, vrátí se Ti to na jednom dvou. Jestli pro sebe, je to zlomek toho, co stojí roky tápání a vyhozených peněz za nefunkční rady."},
  {"t":"btn","text":"Vzít Academy za 8 900 Kč","href":"https://martinbarna.cz/akademie/"},
  {"t":"p","html":"Nečekej na „ideální pondělí" — to nepřijde. Buď do toho jdeš teď za zaváděcí cenu, nebo Ti budu fandit z dálky. Ale věřím, že to dáš. 💪"},
  {"t":"p","html":"<strong>Be Effective!</strong><br>Martin"},
  {"t":"ps","html":"P.S. Máš dotaz, jestli se Ti to vyplatí? Napiš mi jednou větou, co řešíš, a řeknu Ti narovinu, jestli do toho jít."}
]
```
