> ⛔ **Poznámka k 9. 8. 2026:** dokument místy počítá se zdražením Academy na 12 900 Kč
> po 50. zakládajícím členovi. **Ten slib Martin 8. 8. 2026 ZRUŠIL, cena zůstává 8 900 Kč**
> (status „zakládající člen" zůstal jako pocta, cenová hrozba ne). Web i mailové šablony
> jsou vyčištěné; tenhle text je ponechán jako historický záznam. Nepoužívej ho jako podklad.

# Promo kalendář H2 2026: one-click launch runbook

> Pro Martina + Clauda. Každá akce tu má přesné kroky, přesné SQL a checklist,
> ať se spouští „na jedno kliknutí" a nic se nevymýšlí v den D.
> Strategický kontext (proč a pro koho): `_zdroje/mailing-longterm-plan.md`, sekce 3.
> Nic z tohoto souboru se nespouští samo. Všechno čeká na Martinovo ANO v den akce.

| Měsíc | Akce | Stav příprav |
|-------|------|--------------|
| srpen | Letní reset: videokurz −20 %, kód LETO20 | šablony hotové (inertní SQL), čeká na spuštění |
| září | Reaktivace-kviz + případně Academy kohorta | kvíz šablona v DB (inertní), postup existuje |
| prosinec | Novoroční waitlist + zdražení Academy na 12 900 | jen plán, žádné soubory |

---

## SRPEN: Letní reset (videokurz −20 %, kód LETO20)

**Kdy spustit:** okno 3.–17. 8. 2026. Mailová křivka trvá 10 dní (maily den 0/3/7/10),
takže enroll nejpozději 7. 8. **Doporučení: pondělí 3. 8. mezi 8. a 9. hodinou ráno**
(drip cron jede každou hodinu, první mail odejde do hodiny od enrollu).
Maily pak padnou 3. 8. / 6. 8. / 10. 8. / 13. 8.

**Co je připravené předem:** šablony v `akademie/_supabase/letni-reset-2026-08.sql`
(track `letni-reset`, 4 maily, INSERT s on conflict do nothing). Soubor je inertní,
dokud ho někdo ručně nespustí.

### Krok 1: kupón LETO20 v SimpleShopu (Martin, ~5 minut)

- Produkt: Videokurz výživy (prodejní formulář 3Vbl).
- Kód přesně `LETO20`, sleva **20 %** (z 800 Kč na 640 Kč).
- Platnost: ode dne spuštění do **23:59 dne posledního mailu** (start + 10 dní,
  tedy při startu 3. 8. platnost do 13. 8. 23:59). Mail č. 4 říká „dnes večer končí",
  tak ať to je pravda.
- Po konci akce kód deaktivovat (nebo nechat vypršet), žádné tiché prodlužování.

### Krok 2: Omnibus checklist (Claude ověří, Martin odkývne)

Projít obecný checklist na konci tohoto souboru. Konkrétně pro letní reset:

- [ ] Cena videokurzu byla posledních 30 dní stále 800 Kč (žádná změna ceny, žádná
      jiná plošná akce od začátku července).
- [ ] Šablony obsahují Omnibus větu („běžná cena … i posledních 30 dní") v mailu
      se slevou i v posledním mailu. Obsahují, nemazat.
- [ ] Po akci min. 30 dní žádná další plošná sleva videokurzu (tj. do půlky září),
      jinak se referenční cena další akce sníží na 640 Kč.

### Krok 3: stop-po-nákupu pro track letni-reset (Claude, před spuštěním)

`drip-send` funkce `shouldStop()` track `letni-reset` nezná. Bez úpravy by ten,
kdo koupí hned po prvním mailu, stejně dostal i slevový a „poslední den" mail.
Do `akademie/_supabase/functions/drip-send/index.ts` přidat vedle pravidla pro
`longtail-consumer` jeden řádek:

```ts
if (t === 'letni-reset') return ownsAny(em);   // sezonni akce prodava videokurz ne-majitelum
```

Deploy: `npx supabase functions deploy drip-send --project-ref uhmrpfsdcujbhbtumqye --no-verify-jwt`

Zároveň ověřit v témže souboru, že `DISCOUNT2_PCT = 20` (šablony počítají slevovou
cenu přes `{{discount2_price}}`, což je course_price minus 20 %; kdyby se DISCOUNT2
někdy změnilo, přestane sedět s LETO20).

### Krok 4: nahrát šablony (Claude)

Spustit obsah `akademie/_supabase/letni-reset-2026-08.sql` v Supabase SQL editoru
(projekt uhmrpfsdcujbhbtumqye). Idempotentní, existující šablony nepřepíše.

### Krok 5: test maily na Martina (Claude)

Poslat všechny 4 kroky na Martinův mail přes test režim drip-send (subject dostane
prefix [TEST], nic se nezapisuje do leads):

```powershell
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$secret = "<hodnota app_config klice drip_invoke_secret>"
foreach ($step in 0..3) {
  $body = @{ test_email = "fitness.barna@gmail.com"; track = "letni-reset"; step = $step; segment = "muzi"; name = "Martin" } | ConvertTo-Json
  Invoke-RestMethod -Method Post -Uri "https://uhmrpfsdcujbhbtumqye.supabase.co/functions/v1/drip-send" -Headers @{ "x-drip-secret" = $secret } -ContentType "application/json; charset=utf-8" -Body $body
}
```

Zkontrolovat: dark-gold vzhled, funkční odkazy (kalkulačka, kvíz, článek, košík,
konzultace), ceny 800/640 Kč, Omnibus věta, žádný nevyplněný token.

### Krok 6: dry-run enrollu (Claude ukáže číslo, Martin řekne ANO)

Cíl = **zaparkované aktivní consumer leady mimo kupce**. Bere jen leady s dojetou
sekvencí (`next_send_at IS NULL`). Kdo je uprostřed své sekvence, jede dál svou
a akci nedostane (nemíchat dvě nabídky jednomu člověku).

```sql
-- Dry-run: kolik lidí akce zasáhne (nic nemění)
select count(*) as kandidatu
from leads l
where l.status = 'active'
  and coalesce(l.purchased, false) = false
  and l.next_send_at is null
  and l.track in ('lead-magnet','existing-leadmagnet','lead-magnet-tool',
                  'nurture-videokurz','nurture-pro-vas','active-no-buy')
  and not exists (select 1 from entitlements e
                  where lower(e.email) = lower(l.email) and e.active)
  and lower(l.email) not in (
    select lower(trim(x))
    from unnest(string_to_array(coalesce(
      (select value from app_config where key = 'admin_emails'), ''), ',')) as x
    where trim(x) <> '');
```

Před GO ještě ověřit brány drip enginu:

```sql
select key, value from app_config
 where key in ('followups_enabled', 'drip_daily_cap');
-- followups_enabled musí být 'true', jinak track letni-reset vůbec neodejde;
-- drip_daily_cap musí být vyšší než počet kandidátů z dry-runu.
```

### Krok 7: GO, ostrý enroll (spustit až po Martinově ANO)

Stejné WHERE jako dry-run, jen UPDATE:

```sql
-- GO: ostrý enroll do letni-reset (spouštět jednou, ráno v den startu)
update leads l
   set track = 'letni-reset', step = 0, next_send_at = now(), updated_at = now()
 where l.status = 'active'
   and coalesce(l.purchased, false) = false
   and l.next_send_at is null
   and l.track in ('lead-magnet','existing-leadmagnet','lead-magnet-tool',
                   'nurture-videokurz','nurture-pro-vas','active-no-buy')
   and not exists (select 1 from entitlements e
                   where lower(e.email) = lower(l.email) and e.active)
   and lower(l.email) not in (
     select lower(trim(x))
     from unnest(string_to_array(coalesce(
       (select value from app_config where key = 'admin_emails'), ''), ',')) as x
     where trim(x) <> '');
```

### Krok 8: monitoring a úklid

Denně během akce (Claude):

```sql
-- Kolik čeho odešlo
select detail->>'key' as mail, count(*)
from email_events
where type = 'sent' and detail->>'track' = 'letni-reset'
group by 1 order by 1;

-- Chyby a stopy po nákupu
select type, count(*)
from email_events
where detail->>'track' = 'letni-reset' and type in ('error', 'skip_purchased')
group by 1;
```

Po akci: deaktivovat kupón (krok 1), spočítat prodeje videokurzu za okno akce
(SimpleShop / entitlements) a zapsat výsledek do tohoto souboru. Track končí sám
(poslední krok má wait_days null, leady se zaparkují).

### Vědomé kompromisy (Martin o nich ví, neřešit v den D)

- Leady, co dojely `nurture-videokurz`, slyšely „poslední připomínka −20 %"
  (JESTE20). LETO20 nejde hlouběji, je to stejných 20 % jako sezónní akce, ne
  eskalace slev. Schválený kompromis.
- Enroll resetuje `updated_at`, takže 30denní okno pro zářijovou reaktivaci-kvíz
  se u zasažených leadů posune (kandidáti na kvíz budou reálně od půlky září dál).
- Leady v `longtail-consumer` (pokud do té doby poběží) akci nedostanou, mají
  `next_send_at` nastavené. Longtail drží slib „žádná nová sleva na videokurz"
  uvnitř své sekvence, plošná akce se ho netýká.

---

## ZÁŘÍ: Reaktivace-kviz + případná Academy kohorta

### Reaktivace-kviz (šablona už v DB, inertní)

- Track `reaktivace-kviz`, step 0, jediný mail. Kvíz stránka `/kviz/` je živá.
- **Kompletní postup + přesné dry-run/enroll SQL: `akademie/_supabase/REAKTIVACE-KVIZ.md`.**
- Kandidáti = aktivní leady s dojetou sekvencí, nekupci, 30+ dní bez pohybu.
  Pozor: letní reset u zasažených leadů resetoval `updated_at`, takže reálné
  kandidáty čekej od půlky září. Klidně spustit až v říjnu, kvízu termín neutíká.
- Před spuštěním zbývá úprava `lead-capture` (restart větev pro source='kviz'),
  je popsaná v REAKTIVACE-KVIZ.md. Pak dry-run počet, Martinovo ANO, UPDATE.
- Omnibus: kvíz mail žádnou slevu nenese, checklist se nepoužije.

### Případná kohorta: „Academy za 8 900 do 50. člena"

- Viz `_zdroje/mailing-longterm-plan.md` (září). Není to sleva, ale reálná urgence
  zaváděcí ceny: po 50. prodeji Academy zdražuje na 12 900 Kč.
- Podmínka: číslo „zbývá X míst" musí být PRAVDIVÉ (spočítat z reálných prodejů),
  jinak je to nekalá praktika. Claude před odesláním spočítá a doloží.
- ⏰ Připomínka z paměti: hlídat počítadlo prodejů Academy. 50. prodej = zdražit.

---

## PROSINEC: Novoroční waitlist + zdražení Academy (jen plán, žádné soubory)

Cíl: využít největší fitness okno roku (29. 12.–15. 1.) a k 1. 1. 2027 udělat
ze zdražení Academy na **12 900 Kč** milník, ne tichou změnu ceníku.

Plán (rozpracovat v listopadu):

1. **LP waitlist** (~1. 12.): nová stránka se sběrem e-mailů do `leads`
   (vlastní track, např. `waitlist-novy-rok`). Slib: „novoroční nábor otevírám
   mezi svátky, waitlist má přednost a starou cenu".
2. **Early-bird pro waitlist** (29.–31. 12.): kdo je na waitlistu, může koupit
   Academy ještě za 8 900 Kč před zdražením.
3. **Zdražení k 1. 1. 2027**: Academy 12 900 Kč pro všechny. Pozor, existuje i
   dřívější spouštěč „po 50. prodeji" (viz září). Platí, co nastane dřív;
   rozhodne Martin, ať se ta dvě pravidla nepobijou.
4. Vánoční dárkový poukaz (z longterm plánu) je samostatná věc, rozhodne Martin.

**Omnibus u early-birdu (důležité):** zdražení není sleva a Omnibus se na něj
nevztahuje. ALE: early-bird se NESMÍ komunikovat jako „sleva z 12 900" (tu cenu
ještě nikdo neplatil, byla by to fiktivní referenční cena). Správná komunikace:
„do 31. 12. za 8 900, od 1. 1. za 12 900". Žádné přeškrtnuté 12 900 před 1. 1.

---

## Omnibus checklist (projít u KAŽDÉ slevy)

1. **Referenční cena** = nejnižší cena, za kterou se produkt plošně prodával
   v posledních 30 dnech před akcí. Ověř, že se prodejní cena neměnila a že
   neběžela jiná plošná akce.
2. V každém mailu a na každé stránce, kde se sleva komunikuje, uvést běžnou cenu
   a větu ve stylu: „Běžná cena je X Kč a stejná byla i posledních 30 dní,
   žádné umělé zdražení před slevou."
3. Personalizované kupóny 1:1 v sekvencích (ZACNI15, JESTE20) nejsou plošná
   prodejní cena. Plošné akce (LETO20, Black Friday) ANO: mezi dvěma plošnými
   akcemi na stejný produkt držet min. 30 dní odstup, jinak referenční cena
   další akce klesne na tu akční.
4. Po akci kód deaktivovat, ať „časově omezené" platí doopravdy. Falešná urgence
   a věčné odpočty jsou nekalá praktika.
5. Nikdy nezdražit těsně před slevou, aby sleva vypadala větší (Omnibus přesně
   tohle chytá).
