# Onboarding maily — existující zákazníci (#72) — TEXTY SCHVÁLENY Martinem, čeká na test + „pošli ostro"

⚠️ ODESLAT JEN těm, kdo MAJÍ aktivní entitlement (videokurz) → 100 % se dostanou dovnitř.
⚠️ Registrace = „Vytvořit účet" + heslo (magic-link je rozbitý). Odkaz: `/akademie/prihlaseni/?tab=register`.
⚠️ Test-first na fitness.barna@gmail.com (obě varianty) → po „pošli ostro" ostro. Coaching klienti = videokurz v ceně.

## A) Videokurz zákazníci (tag early-customer / entitlement videokurz) — SCHVÁLENO Martinem
**Track:** `onboarding-videokurz` · step 0
**Subject:** `Tvůj videokurz je teď na novém místě`
**Preheader:** `Všech 182 lekcí i materiály pohromadě. Přihlásíš se za minutu.`
```json
[
  {"t":"p","html":"Ahoj{{fn_space}},"},
  {"t":"p","html":"přesunul jsem tvůj <strong>videokurz výživy</strong> na nový web — do Barna Academy. Je to rychlejší, přehlednější a máš všechno na jednom místě. Nic znovu neplatíš, máš ho dál v ceně."},
  {"t":"p","html":"Uvnitř najdeš:"},
  {"t":"bullets","items":["všech <strong>182 video lekcí</strong> (hubnutí, nabírání, fitness)","všechny <strong>přílohy a materiály</strong> ke stažení","funguje na mobilu i počítači, koukáš kdy chceš"]},
  {"t":"p","html":"<strong>Jak se přihlásíš</strong> (minuta): klikni níž, dej <strong>„Vytvořit účet"</strong> a zaregistruj se <strong>stejným e-mailem, na který ti přišel tenhle mail</strong> — podle něj tě systém pozná. Vytvoříš si heslo a jsi uvnitř."},
  {"t":"btn","text":"Vytvořit přístup do videokurzu","href":"https://www.martinbarna.cz/akademie/prihlaseni/?tab=register"},
  {"t":"p","html":"Kdyby něco nefungovalo, napiš mi, vyřešíme to. <strong>Be Effective!</strong><br>Martin"},
  {"t":"ps","html":"P.S. Přihlas se stejným e-mailem jako u koupě kurzu, jinak tě systém nespáruje."}
]
```

## B) Coaching klienti (tag coaching-active / coaching-ex) — videokurz v ceně — SCHVÁLENO Martinem
**Track:** `onboarding-coaching` · step 0
**Subject:** `Máš u mě videokurz výživy v ceně`
**Preheader:** `Videokurz výživy máš v ceně. Přihlásíš se za minutu.`
```json
[
  {"t":"p","html":"Ahoj{{fn_space}},"},
  {"t":"p","html":"odvedl jsem teď na webu pořádný kus práce — všechno jsem dal na jedno místo, do Barna Academy. Jako váženému klientovi ti přidávám <strong>videokurz výživy v ceně</strong>."},
  {"t":"p","html":"Je to všech <strong>182 lekcí</strong> o tom, jak jíst, počítat makra a držet si formu. Kdykoliv se k tomu budeš chtít vrátit, máš to po ruce."},
  {"t":"p","html":"<strong>Jak dovnitř</strong> (minuta): klikni níž, dej <strong>„Vytvořit účet"</strong> a zaregistruj se <strong>stejným e-mailem, na který ti přišel tenhle mail</strong>. Vytvoříš si heslo a jsi uvnitř."},
  {"t":"btn","text":"Vytvořit přístup","href":"https://www.martinbarna.cz/akademie/prihlaseni/?tab=register"},
  {"t":"p","html":"Díky, že buduješ nejlepší verzi sebe sama. Kdyby cokoliv, víš kde mě najdeš. <strong>Be Effective!</strong><br>Martin"},
  {"t":"ps","html":"P.S. Registruj se e-mailem, na který ti chodí tahle zpráva — podle něj tě systém pustí dovnitř."}
]
```
