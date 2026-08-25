# Vetveni aktivacni serie podle prvniho zapisu jidla

Pripraveno 25. 8. 2026. **Nic z toho neni nasazene a nic neni aplikovane do zadne DB.**
Zadani znelo „exit po prvnim zapisu"; pri cteni zivych sablon se ukazalo, ze spravna
podoba je vetveni obema smery, ne jednosmerny exit. Duvod je v prvni sekci.

## 1. Proc ne „exit", ale vetveni

Zmereno 20. 8. 2026 (pamet `tvujcoach-hodnota-bez-checkinu`): z 29 skutecnych zkusebek
**16 nezapsalo ani jeden den**. Uzke hrdlo je aktivace, ne cena.

Trat `tc-zkusebka` (4 maily, chodi tam kazda nova registrace) obsahuje 25. 8. 2026 tohle:

| krok | klic | o cem je | co s nim |
|---|---|---|---|
| 0 | `tcz-0-den1` | „Dneska zapis, co jis" | nutkani -> tomu, kdo uz zapsal, je zbytecne |
| 1 | `tcz-1-den3` | **„par dni zapisu za tebou (...) dobra prace"** | ⛔ TVRZENI, ktere u 16 z 29 lidi NENI PRAVDA |
| 2 | `tcz-2-den7` | tyden, check-in, prepocet cilu = Basic | tvrzeni o case + prodejni argument |
| 3 | `tcz-3-den10` | trenink, 120 cviku, Basic | neutralni, sedi na oba stavy |

Dva zavery:

1. **Jednosmerny „exit po prvnim zapisu" by opravil krok 0 a nechal na miste krok 1**,
   ktery je horsi: chvali cloveka za neco, co neudelal.
2. **Utnout celou trat po prvnim zapisu by bylo skodlive.** Kroky 1 az 3 prodavaji
   **Basic**, tedy hlavni prodavany plan (CLAUDE.md). Utnuli bychom prodej prave
   u lidi, kteri appku zacali pouzivat, tedy u nejnadejnejsi skupiny.

⇒ Mechanismus proto vynechava **jeden krok**, ne trat. Presne jako `preskoc.ts`.

## 2. Kudy tece signal

```
appka (projekt kfkmghvhqwqtsalqjmrp)          Academy (projekt uhmrpfsdcujbhbtumqye)
  food_log (RLS)                                 drip-send (hodinovy pg_cron)
      ^                                                |
      | security definer                               | 1x za beh, POST, x-app-secret
  public.zapsali_jidlo(text[])  <---------------  aktivace-stav (edge fn appky)
      vraci JEN adresy, ktere zapsaly                  |
                                                       v
                                          aktivace.ts: preskocit krok? -> advance()
                                          email_events: type = 'skip_podle_zapisu'
```

- **Tah, ne tlak.** Drip se pta ve chvili, kdy se chysta mail poslat, a jen na lidi,
  kteri na vetvene trati skutecne lezi. Adresa nikoho jineho z Academy neodejde.
- **Zadny novy secret.** Pouziva se `app_config.app_onboarding_secret` / v appce
  `ACADEMY_ONBOARDING_SECRET`, tedy tataz dvojice, ktera uz dnes vozi registrace
  opacnym smerem. Nic nemusi projit clovekem.
- **Zadna nova verejna data.** RPC ma grant jen pro `service_role`; `anon`
  a `authenticated` maji `revoke`. Bez toho by to byl verejny orakulum
  „pouziva tahle adresa appku?".
- **Zadny trigger v appce.** Zvazeny byl i push (trigger na `food_log` -> fronta ->
  `onboarding-bridge`, jako u registraci). **Zamitnut:** sahal by do zapisove cesty
  hlavni funkce appky, signal by se pri selhani ztratil natrvalo (v appkovem projektu
  neni `pg_cron`, fronta se vyprazdnuje jen pri dalsi registraci) a bylo by to
  ctvrte pohyblive misto. Stav („zapsal uz nekdy") se ptanim zjisti kdykoli znovu,
  udalost se ztrati jednou provzdy.

## 3. Kde se to vyhodnoti

`akademie/_supabase/functions/drip-send/aktivace.ts`, mapa `KROK_PODLE_ZAPISU`:

```ts
'track/step': 'jen_kdyz_nezapsal' | 'jen_kdyz_zapsal'
```

- `jen_kdyz_nezapsal` = nutkaci mail, komu uz zapsal, se preskoci
- `jen_kdyz_zapsal` = mail tvrdi, ze clovek zapisuje, kdo nezapsal, se preskoci
- **stav `nevime` nepreskoci nikdy** (fail-safe smerem k odeslani)

⛔ **Mapa je dnes PRAZDNA, mechanismus je tedy vypnuty.** Nasazeni v tomhle stavu
nezmeni ani jeden odeslany mail a nepusti ani jeden dotaz do appky. Zapnuti je
obsahove rozhodnuti (viz sekce 5), ne technicke.

## 4. Co se stane s lidmi v pulce serie

Nic zvlastniho, a to je zamer.

- Preskoceny krok vola **`advance()`**, tedy tutez cestu jako `preskoc.ts`: `step + 1`,
  `next_send_at` podle `wait_days` dalsiho kroku. Clovek pokracuje v trati dal.
- Kdyby byl vetveny krok posledni v trati (`wait_days = null`), `advance()` korektne
  spusti **most na navaznou trat** vcetne vsech ctyr pojistek. Nikdo nezustane trcet.
- Do `email_events` se zapise radek `type = 'skip_podle_zapisu'` s tratí, klicem
  sablony, podminkou a stavem. ⚠️ `email_events.type` nema CHECK constraint, takze
  novy typ projde tise; kdo cte statistiky podle typu, musi s nim pocitat
  (stejna past jako u `bridged`).
- **Nikdo se zpetne nepreskakuje.** Rozhoduje se v okamziku odeslani, takze uz
  odeslane maily to nijak nemeni.
- Odpoved funkce nove nese `skipped_zapis` a `zapis_signal` (ostry beh),
  `would_skip_zapis`, `by_zapis`, `zapis_kroky`, `zapis_signal` (dry beh).
  **`dry: true` je jediny zpusob, jak dopad zmerit, aniz by se dotkl ziveho cloveka.**

## 5. Co musi rozhodnout Martin, nez se to zapne

1. **Krok 1 `tcz-1-den3` chvali za zapisy.** Zapnout `jen_kdyz_zapsal` znamena, ze
   nezapisujici clovek dostane krok 0 a pak az krok 2, tedy dira v serii. ⇒ Nejdriv
   musi vzniknout **nahradni mail pro toho, kdo nezapsal** (presne to, co zada bod 2
   pameti `tvujcoach-hodnota-bez-checkinu`: „kdo nezapsal nic, potrebuje jiny mail").
   Az potom se vetveni zapina.
2. **Krok 2 `tcz-2-den7`** je nositelem prodejniho argumentu pro Basic. Podle CLAUDE.md
   se nabidka nezahazuje, prepisuje se naléhavost. ⇒ spis prepsat uvodni vetu, nez vetvit.
3. **Krok 0** se posila hned po registraci, takze vetveni tam zabere jen u toho, kdo
   zapsal driv, nez ho vzal hodinovy cron. Zisk maly, riziko nulove.

## 6. Poradi zapojeni (nic z toho neni udelane)

1. Aplikovat `appka-zapsali-jidlo.sql` jako migraci **v repu appky** (cislo az po
   `martin-souhra`), overit sekci „OVERENI PO APLIKACI" na konci souboru.
2. Nasadit `aktivace-stav` v projektu appky (`--no-verify-jwt`), overit volanim
   se spravnym i se spatnym secretem.
3. Nasadit `drip-send` s prazdnou mapou a overit, ze `dry` vraci `zapis_signal: vypnuto`
   a `would_skip_zapis: 0`, tedy nulovou zmenu chovani.
4. Teprve pak doplnit radek do mapy, znovu `dry`, a az podle jeho cisel ostry beh.

⚠️ `drip-send` se nasazuje jako **trojice souboru** a nove **ctverice**
(`index.ts`, `pravidla.ts`, `preskoc.ts`, `aktivace.ts`). Deploy kopiruje celou slozku;
kdo posle jen `index.ts`, funkce spadne na chybejicim importu.
Viz pamet `mb-edge-funkce-tri-kopie-past` a `mb-deploy-kopiruje-jen-index-past`.
