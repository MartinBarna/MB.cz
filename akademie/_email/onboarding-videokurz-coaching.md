# Onboarding maily — existující zákazníci (#72) — NÁVRH, čeká na kontrolu přístupů + test + „pošli ostro"

⚠️ ODESLAT JEN těm, kdo MAJÍ aktivní entitlement (videokurz) → 100 % se dostanou dovnitř.
⚠️ Registrace = „Vytvořit účet" + heslo (magic-link je rozbitý). Odkaz: `/akademie/prihlaseni/?tab=register`.
⚠️ Test-first na fitness.barna@gmail.com (obě varianty) → po „pošli ostro" ostro. Coaching klienti = videokurz v ceně.

## A) Videokurz zákazníci (tag early-customer / entitlement videokurz)
**Subject:** `Tvůj videokurz je teď celý na jednom místě`
**Preheader:** `Všech 182 videí + materiály na jednom místě. Přístup si vytvoříš za minutu.`
```json
[
  {"t":"p","html":"Ahoj{{fn_space}},"},
  {"t":"p","html":"tvůj <strong>Videokurz výživy</strong> dostal úplně novou členskou sekci. Přehlednější, rychlejší, všechno pohromadě. A máš ji <strong>v ceně</strong>, nic znovu neplatíš."},
  {"t":"p","html":"Co Tě uvnitř čeká:"},
  {"t":"bullets","items":["<strong>182 video lekcí</strong> o hubnutí, nabírání i fitnessu","Všechny <strong>přílohy a materiály</strong> ke stažení","Funguje na mobilu i počítači, koukáš kdy chceš"]},
  {"t":"p","html":"<strong>Jak se dostaneš dovnitř</strong> (minuta práce): klikni níž, dej <strong>„Vytvořit účet"</strong> a zaregistruj se <strong>stejným e-mailem, na který Ti přišel tenhle mail</strong> — podle něj Tě systém pozná. Vytvoříš si heslo a jsi uvnitř."},
  {"t":"btn","text":"Vytvořit přístup do videokurzu","href":"https://www.martinbarna.cz/akademie/prihlaseni/?tab=register"},
  {"t":"p","html":"Kdyby cokoliv nešlo, napiš mi — ozvu se a vyřešíme to. <strong>Be Effective!</strong><br>Martin"},
  {"t":"ps","html":"P.S. Důležité: registruj se e-mailem, kterým jsi kurz kupoval[a]. Na jiný Tě systém nepozná."}
]
```

## B) Coaching klienti (tag coaching-active / coaching-ex) — videokurz v ceně
**Subject:** `Předělal jsem členskou sekci a něco v ní na tebe čeká`
**Preheader:** `Videokurz výživy v ceně. Přístup si vytvoříš za minutu.`
```json
[
  {"t":"p","html":"Ahoj{{fn_space}},"},
  {"t":"p","html":"dělal jsem na webu velký kus práce a <strong>kompletně předělal členskou sekci</strong>. Chci, abys to měl[a] jako jeden z prvních — a něco Ti k tomu přidávám."},
  {"t":"p","html":"Jako můj klient máš teď <strong>Videokurz výživy v ceně</strong> — všech 182 lekcí o tom, jak jíst, počítat makra a udržet si formu. Kdykoliv se k tomu budeš chtít vrátit, máš to po ruce."},
  {"t":"p","html":"<strong>Jak dovnitř</strong> (minuta): klikni níž, dej <strong>„Vytvořit účet"</strong> a zaregistruj se <strong>stejným e-mailem, na který Ti přišel tenhle mail</strong>. Vytvoříš si heslo a jsi uvnitř."},
  {"t":"btn","text":"Vytvořit přístup","href":"https://www.martinbarna.cz/akademie/prihlaseni/?tab=register"},
  {"t":"p","html":"Díky, že to se mnou táhneš. Kdyby cokoliv, víš kde mě najdeš. <strong>Be Effective!</strong><br>Martin"},
  {"t":"ps","html":"P.S. Registruj se e-mailem, na který Ti chodí tahle zpráva — podle něj Tě systém pustí dovnitř."}
]
```
