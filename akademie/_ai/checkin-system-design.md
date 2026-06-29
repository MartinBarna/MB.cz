# Týdenní check-in systém pro koučovací klienty — návrh (#67)

> Návrh postavitelné funkce: koučovací klient 1× týdně vyplní krátký dotazník → data se uloží
> do Supabase → Martin (kouč) je vidí přehledně → klientovi za **konzistenci nabíhá věrnostní
> sleva** (gamifikace retence). Píšu návrh, nestavím kód.
> Stack: statický web (Wedos) + Supabase (Postgres + Deno edge funkce, ref
> `uhmrpfsdcujbhbtumqye`) + Auth email+heslo (`window.BA` v `assets/ba-academy.js`) + e-maily
> Resend (edge funkce `drip-send`) + platby SimpleShop + přístup = `entitlements`.

---

## 1) Executive summary

**Co to je:** klient jednou týdně otevře `/akademie/moje/check-in/`, za ~90 sekund vyplní
8 polí, odešle. Data jdou do tabulky `checkins` (RLS — vidí jen svoje). Martin má jednoduchý
přehledový dashboard `/akademie/moje/kouc/` (gated na admina) + týdenní souhrn e-mailem.
Za každý týden v řadě klientovi roste **věrnostní sleva** (loyalty), kterou uplatní na
prodloužení koučinku, Academy nebo videokurz.

**Sada otázek (8, krátká — ať to klient reálně vyplní):**
1. **Váha** (kg, číslo) — jediné tvrdé měřítko, povinné.
2. **Dodržení plánu** (%, slider 0–100) — strava + plán dohromady, sebehodnocení.
3. **Energie** (1–5) — subjektivní vitalita.
4. **Spánek** (1–5, nebo prům. hodin) — regenerace.
5. **Chutě / hlad** (1–5: 1 = klid, 5 = boj) — varovný signál relapsu.
6. **Tréninky splněno** (X ze Y, dvě malá čísla) — objem pohybu.
7. **Co se povedlo** (1 věta, free text) — win, kotví motivaci.
8. **Kde to drhne** (1 věta, free text) — sem míří Martinova reakce.
+ **Fotky (volitelné)** — 0–3 progress fotky do privátního Storage bucketu.

**Pravidlo nabíhající slevy (konkrétní čísla):**
- 1 check-in / kalendářní týden (Po–Ne) = +**2 %** k věrnostní slevě.
- **Strop 20 %** (= 10 týdnů v řadě). Drží se na stropu, dál neroste.
- **Vynechání týdne:** sleva **nespadne na nulu**, ale **klesne o 6 %** (3 týdny zpět) —
  trest cítit, ale ne demotivačně brutální. Dno = 0 %.
- **Milníky / odznaky:** 4 týdny v řadě = „Konzistentní", 8 = „Disciplinovaný",
  12 = „Železná vůle" (jen gamifikace, bez extra Kč).
- **Uplatnění:** sleva platí na **prodloužení koučinku** (hlavní cíl — retence),
  a sekundárně na **Academy** a **videokurz**. Generuje se jako SimpleShop kupón při
  obnově (MVP: Martin přečte % v dashboardu a vystaví kupón ručně).

**MVP (1–2 dny práce):** tabulka `checkins` + RLS, stránka s formulářem přes `window.BA`,
view `checkin_streak` (počítá streak + %), admin dashboard jako tabulka. Bez automatických
e-mailů, bez auto-kupónů — Martin čte % a vystaví slevu ručně. **Plná verze:** Resend
připomínka (pá/ne), týdenní souhrn Martinovi, automatická generace kupónu, fotky, grafy.

---

## 2) Otázky dotazníku — detailně a zdůvodnění

**Princip: krátké vyhrává.** Coaching check-in, který má 20 polí, klient vyplní 2× a pak
přestane. 8 polí + 2 volné věty se zvládne na mobilu za minutu a půl. Všechno kromě váhy
a dvou vět je tap (slider / 1–5 / stepper) — žádné psaní = nízké tření.

| # | Pole | Typ v UI | DB klíč | Povinné | Proč |
|---|------|----------|---------|---------|------|
| 1 | Váha | number (kg, 1 desetinné) | `weight_kg` | ano | Jediné objektivní číslo, trend v čase. |
| 2 | Dodržení plánu | slider 0–100 % | `plan_adherence_pct` | ano | Hlavní prediktor výsledku; sebehodnocení stačí. |
| 3 | Energie | 1–5 (pills) | `energy` | ano | Včasný signál přetrénování / podjídání. |
| 4 | Spánek | 1–5 (pills) | `sleep` | ano | Regenerace = limit progresu. |
| 5 | Chutě / hlad | 1–5 (1 klid → 5 boj) | `cravings` | ano | Nejlepší predikce relapsu u hubnutí. |
| 6 | Tréninky splněno | 2× stepper (X / Y) | `workouts_done` / `workouts_planned` | ano | Adherence pohybu, oddělená od stravy. |
| 7 | Co se povedlo | textarea (1 věta) | `win_text` | ne | Win kotví motivaci, dává Martinovi co pochválit. |
| 8 | Kde to drhne | textarea (1 věta) | `struggle_text` | ne | Sem směřuje Martinova týdenní reakce. |
| — | Fotky | upload 0–3 | `photo_paths[]` | ne | Vizuální progres; privátní, jen Martin + klient. |

**Volitelné rozšíření (až v plné verzi, ne v MVP — drží to formulář krátký):** obvod pasu
(cm), nálada (1–5), míra stresu (1–5), 1 otázka „na co se příští týden zaměřím". Doporučuji
**nezdvojovat** — každé další pole snižuje completion rate.

**UX detaily otázek:**
- Slidery a 1–5 mají defaultně **střední hodnotu** předvyplněnou (3 / 50 %), ať jde rychle
  upravit. Váhu nepředvyplňovat (musí vědomě zadat).
- Tlačítko „**Zkopírovat z minula**" — natáhne hodnoty z posledního check-inu jako základ
  (kromě váhy a vět). Snižuje tření u stabilních klientů.
- Po odeslání: malé shrnutí trendu („−0,4 kg za týden, energie ↑") + aktuální sleva
  („Tvoje věrnostní sleva: **12 %** 🔥 6. týden v řadě").

---

## 3) Nabíhající sleva — mechanika & ekonomika

### 3.1 Pravidla (jedno místo pravdy)

```
+2 %  za každý kalendářní týden (Po–Ne 00:00 Europe/Prague) s alespoň 1 check-inem
strop 20 % (po 10 týdnech v řadě se zastaví a drží)
−6 %  za každý vynechaný týden (klesne, ale ne na nulu skokem) ; dno 0 %
sleva je vázaná na klienta (user_id), ne na produkt
```

**Proč tato čísla:**
- **+2 %/týden, strop 20 %** — 20 % je vnímatelná, ale neukrojí marži natolik, aby se
  nevyplatila retence. 10 týdnů na strop = ~2,5 měsíce, krásně se to kryje s typickým
  obnovovacím cyklem koučinku → klient dorazí k obnově už „nahoře" a má důvod neodejít.
- **Měkký reset (−6 %), ne tvrdý na nulu** — tvrdý reset trestá jednorázový výpadek (nemoc,
  dovolená) ztrátou 2 měsíců disciplíny → demotivuje a klient to vzdá. Pokles o 3 týdny
  „bolí dost na to, aby nevynechával", ale dá se dohnat. (Klasická retenční chyba je
  postavit streak na „all-or-nothing".)
- **„Záchrana streaku" (volitelné, plná verze):** 1× za 8 týdnů smí klient prokliknout
  „byl jsem nemocný" a týden se nepočítá jako vynechaný (ani nepřičte, ani neubere). Sníží
  frustraci z legitimního výpadku.

### 3.2 Na co se sleva uplatní

| Uplatnění | Priorita | Pozn. |
|-----------|----------|-------|
| **Prodloužení / obnova koučinku** | 1 (hlavní cíl) | Retence — proto celý systém existuje. Sleva = důvod zůstat. |
| **Academy** | 2 | Up-sell konzistentního klienta do produktu. |
| **Videokurz** | 3 | Spíš doplněk; lze i jako odměna. |

**Realizace slevy:** sleva % se přepíše na **SimpleShop kupón** při obnově.
- **MVP:** Martin vidí v dashboardu u klienta `loyalty_pct` → vystaví kupón ručně
  (stejný princip jako affiliate store-kredit v `affiliate-system-design.md`).
- **Plná verze:** edge funkce `checkin-coupon` vygeneruje jednorázový kupón přes SimpleShop
  API (nebo z předpřipravené poolu) a pošle ho klientovi e-mailem při blížící se obnově.

**Antiabuse:** sleva se počítá z **kalendářních týdnů**, ne z počtu odeslání → spam 5 check-inů
za den = pořád +2 % za ten týden. `created_at` + unikátní index na `(user_id, iso_week)`
(viz §4) zabrání víc než 1 započítanému check-inu/týden.

---

## 4) DB schéma (SQL DDL)

```sql
-- ============================================================
-- Týdenní check-iny koučovacích klientů
-- ============================================================

create table if not exists public.checkins (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users(id) on delete cascade,
  email               text not null,                         -- denormalizace pro Martinův přehled
  iso_week            text not null,                         -- '2026-W27' (ISO, Po–Ne) → 1 záznam/týden
  -- odpovědi (sloupce, ne jen jsonb — kvůli trendům/agregaci a typové kontrole)
  weight_kg           numeric(5,1),
  plan_adherence_pct  smallint check (plan_adherence_pct between 0 and 100),
  energy              smallint check (energy between 1 and 5),
  sleep               smallint check (sleep between 1 and 5),
  cravings            smallint check (cravings between 1 and 5),
  workouts_done       smallint check (workouts_done >= 0),
  workouts_planned    smallint check (workouts_planned >= 0),
  win_text            text,
  struggle_text       text,
  photo_paths         text[] default '{}',                   -- cesty v privátním Storage bucketu
  extra               jsonb default '{}'::jsonb,             -- rezerva pro budoucí pole bez migrace
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  -- max 1 započítaný check-in na klienta a ISO-týden:
  constraint checkins_user_week_uniq unique (user_id, iso_week)
);

create index if not exists checkins_user_created_idx on public.checkins (user_id, created_at desc);
create index if not exists checkins_week_idx          on public.checkins (iso_week);

-- ---------- RLS: klient vidí/edituje JEN svoje ----------
alter table public.checkins enable row level security;

create policy "checkins_select_own" on public.checkins
  for select using (auth.uid() = user_id);

create policy "checkins_insert_own" on public.checkins
  for insert with check (auth.uid() = user_id);

-- editace jen vlastního a jen v rámci téhož týdne (oprava překlepu) :
create policy "checkins_update_own" on public.checkins
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
-- (žádná DELETE policy → klient nemůže mazat historii; maže jen kouč/service_role)

-- Martin (kouč) čte všechno: buď přes service_role v edge funkci (dashboard),
-- nebo přidat admin policy přes seznam adminů, např.:
create policy "checkins_select_admin" on public.checkins
  for select using ( (auth.jwt() ->> 'email') in ('martin@martinbarna.cz') );
```

### 4.1 Streak + sleva jako VIEW (jedna pravda, počítá DB)

```sql
-- Agregace per klient: kolik týdnů, streak, aktuální věrnostní sleva.
-- Logika streaku (mezery → reset počítadla) je nejčistší v SQL window funkcích;
-- zde zjednodušená varianta — finální % počítá RPC níže, view dává podklad.

create or replace view public.checkin_summary as
with weeks as (
  select user_id,
         email,
         iso_week,
         min(created_at) as week_at
  from public.checkins
  group by user_id, email, iso_week
),
ranked as (
  select user_id, email, iso_week, week_at,
         row_number() over (partition by user_id order by iso_week) as rn,
         count(*)      over (partition by user_id) as weeks_total
  from weeks
)
select
  user_id,
  email,
  max(weeks_total)              as weeks_total,
  count(*)                      as weeks_counted,
  max(week_at)                  as last_checkin_at
from ranked
group by user_id, email;
```

> **Pozn. k streaku:** přesný „týdnů v řadě + měkký reset −6 %" je nejjednodušší a
> nejtestovatelnější spočítat ve funkci (RPC / edge), ne ve view — view drží jen surová
> data. Doporučená RPC:

```sql
-- Vrátí streak (týdnů v řadě k dnešku) a věrnostní slevu v % dle pravidel §3.
create or replace function public.checkin_loyalty(p_user uuid)
returns table (streak int, loyalty_pct int, weeks_total int)
language plpgsql stable security definer set search_path = public as $$
declare
  r record;
  cur_streak int := 0;
  pct int := 0;
  prev_week date;
  this_week date;
begin
  for r in
    select distinct date_trunc('week', created_at)::date as wk   -- ISO týden (po)
    from public.checkins where user_id = p_user order by wk
  loop
    this_week := r.wk;
    if prev_week is null then
      cur_streak := 1; pct := 2;
    elsif this_week = prev_week + interval '7 day' then
      cur_streak := cur_streak + 1;
      pct := least(pct + 2, 20);                 -- +2 %, strop 20 %
    else
      -- mezera: kolik týdnů chybí
      cur_streak := 1;
      pct := greatest(pct - 6, 0);               -- měkký reset −6 %, dno 0
      pct := least(pct + 2, 20);                 -- a započti tenhle týden
    end if;
    prev_week := this_week;
  end loop;
  -- pokud poslední check-in není z tohoto/minulého týdne → uplatni propad za prodlevu
  if prev_week is not null and prev_week < (date_trunc('week', now())::date - interval '7 day') then
    pct := greatest(pct - 6, 0);
  end if;
  return query select cur_streak,
                      pct,
                      (select count(distinct date_trunc('week', created_at))::int
                         from public.checkins where user_id = p_user);
end $$;
```

> (Čísla v RPC = jediné místo pravdy o slevě; změna pravidel = změna konstant `2 / 20 / 6`.)

---

## 5) Edge funkce / logika

Tři funkce (v duchu existujících `lead-capture`, `drip-send`, `unsubscribe`). MVP potřebuje
jen formulář + RLS insert přes `window.BA` (klientský `supabase-js`) — **edge funkce nejsou
pro samotné uložení nutné**, RLS to pokryje. Edge funkce jdou na automatizaci.

| Funkce | Trigger | Co dělá | MVP? |
|--------|---------|---------|------|
| *(žádná)* — `BA.saveCheckin()` | klient odešle formulář | `insert ... on conflict (user_id, iso_week) do update` přes anon klíč + RLS. ISO-týden počítá klient i DB. | **ano** |
| `checkin-reminder` | cron (pá 18:00, ne 18:00) | najde klienty s entitlementem koučinku, kteří tento ISO-týden ještě nevyplnili → pošle Resend připomínku s deeplinkem na `/akademie/moje/check-in/`. | plná |
| `checkin-digest` | cron (po 7:00) | sestaví Martinovi 1 souhrnný e-mail za minulý týden: kdo vyplnil/ne, kdo má klesající energii/rostoucí chutě (flagy), váhové trendy. | plná |
| `checkin-coupon` | obnova / ručně z dashboardu | vezme `checkin_loyalty().loyalty_pct` → vygeneruje SimpleShop kupón a (volitelně) ho pošle klientovi. | plná |

**Klientské API (přidat do `window.BA` v `assets/ba-academy.js`, stejný styl jako `setDone`):**
```
BA.saveCheckin(data)   → upsert do checkins (on conflict user_id+iso_week)
BA.getCheckins(limit)  → posledních N vlastních check-inů (pro graf trendu)
BA.getLoyalty()        → client.rpc('checkin_loyalty', { p_user: <uid> }) → { streak, loyalty_pct }
```
> V `demo` režimu (bez configu) ukládat do `localStorage` (klíč `ba_checkin_v1`) jako fallback,
> aby se web nerozbil — stejný vzor jako `ba_progress_v1`.

**Resend / drip-send pozn.:** připomínkové i digest maily posílat přes stejnou Resend
integraci jako `drip-send`. České znaky v edge funkcích psát jako **reálné UTF-8**
(pozor na `ď`/`ě` — viz CLAUDE.md). Patička připomínek nemusí mít unsubscribe (transakční
charakter ke koučinku), ale měla by mít „nechci připomínky" link → flag v profilu.

---

## 6) Flow & UX

**Klient (týdenní smyčka):**
1. **Pá / ne** přijde e-mail „Jak šel týden? (90 sekund)" → tlačítko na `/akademie/moje/check-in/`.
2. Stránka přes `BA.requireAccess('coaching', ...)` ověří, že má aktivní koučink (entitlement /
   tag `coaching-active`). Když ne → upsell / info.
3. Vyplní 8 polí (slidery, 1–5, 2 věty), volitelně nahraje fotky. „Zkopírovat z minula".
4. **Odeslat** → `BA.saveCheckin()` → potvrzení + trend + aktuální sleva + odznak.
5. Na `/akademie/moje/` se přidá dlaždice „**Týdenní check-in**" se stavem
   (✅ vyplněno / ⏳ čeká) a aktuální slevou.

**Martin (kouč):**
- **Dashboard** `/akademie/moje/kouc/` (gated: admin e-mail / service_role) — tabulka klientů:
  jméno, poslední check-in, váhový trend (šipka), energie, **flagy** (chutě ↑, energie ↓,
  adherence < 60 %, 0 tréninků), `loyalty_pct`, prokliky na detail + historii + fotky.
- **Týdenní souhrn e-mailem** (`checkin-digest`) — kdo nevyplnil, koho řešit. Martin nemusí
  otvírat dashboard, aby věděl, kde hoří.
- **Detail klienta** — graf váhy + adherence v čase, poslední „povedlo/drhne" věty (sem píše
  reakci). MVP: jen tabulka a věty; grafy až v plné verzi.

**Kdo má check-in zapnutý:** jen klienti s aktivním koučinkem. Vázat na **entitlement
`coaching`** (přidat produkt) nebo na tag `coaching-active` v `customer_contacts`. Academy/
videokurz-only zákazníci check-in nevidí.

---

## 7) MVP vs plná verze

**MVP (postavitelné za 1–2 dny):**
- [ ] Tabulka `checkins` + indexy + RLS (§4).
- [ ] RPC `checkin_loyalty` (§4.1).
- [ ] Stránka `/akademie/moje/check-in/` — formulář 8 polí, `BA.saveCheckin/getLoyalty`.
- [ ] Dlaždice na `/akademie/moje/` se stavem + slevou.
- [ ] Admin dashboard `/akademie/moje/kouc/` — prostá tabulka (read přes admin policy).
- [ ] **Bez** auto-e-mailů, **bez** auto-kupónů, **bez** fotek → Martin čte % a vystaví
      SimpleShop slevu ručně při obnově.

**Plná verze (postupně):**
- [ ] Resend připomínky `checkin-reminder` (pá/ne, jen nevyplnivší).
- [ ] Týdenní digest Martinovi `checkin-digest` + automatické flagy.
- [ ] Fotky do privátního Storage bucketu (signed URL, jen klient + Martin).
- [ ] Grafy trendů (váha, adherence) na detailu klienta.
- [ ] Auto-generace SimpleShop kupónu `checkin-coupon` při obnově.
- [ ] „Záchrana streaku" (1×/8 týdnů), odznaky/milníky, leaderboard (volitelně, anonymně).

---

## 8) Checklist — co musí doplnit / rozhodnout Martin

- [ ] **Otázky finálně:** sedí těchto 8 + 2 věty? Chce přidat obvod pasu / náladu / stres?
      (Doporučení: nepřidávat, držet krátké.)
- [ ] **Čísla slevy:** potvrdit `+2 %/týden`, `strop 20 %`, `−6 % za vynechaný týden`.
      Vyhovuje marži u obnovy koučinku?
- [ ] **Na co sleva platí:** jen koučink, nebo i Academy/videokurz? (Návrh: primárně koučink.)
- [ ] **Kdo má check-in zapnutý:** zavést entitlement `coaching`, nebo jet na tag
      `coaching-active`? Kdo přesně teď koučuje.
- [ ] **Připomínky:** den a čas odeslání (návrh pá 18:00 + ne 18:00). Text mailu.
- [ ] **Admin přístup k dashboardu:** potvrdit admin e-mail(y) v RLS policy.
- [ ] **Fotky:** chce je vůbec sbírat? (GDPR — citlivé, jen privátní bucket, jasný souhlas.)
- [ ] **Realizace kupónu:** MVP ručně přes SimpleShop OK? Kdy chce automatizaci.

---

## 9) Bezpečnost / GDPR (v souladu s CLAUDE.md)

- Check-in data jsou **zdravotně citlivá** (váha, fotky) → jen Supabase, **nikdy do chatu
  seznam hodnot**, jen agregáty/počty.
- RLS: klient vidí výhradně svoje (`auth.uid() = user_id`), nemůže mazat historii. Kouč čte
  přes admin policy / service_role v edge funkci.
- Veřejný web jen **anon** klíč (jako dnes `ba-config.js`); service_role / Resend klíč nikdy
  do repa.
- Fotky → **privátní** Storage bucket, přístup jen přes signed URL (vzor `BA.materialUrl`),
  nikdy veřejné URL.
- Připomínkové maily: reálné UTF-8 v edge funkci, link „nechci připomínky".
