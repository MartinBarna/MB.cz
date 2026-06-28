-- ============================================================
-- Barna Academy - CHECK-IN COACHING (automatizovaný týdenní coaching)
-- Frontend: /akademie/check-in/ (hotovo). Tohle je BACKEND SPEC pro Cowork.
-- Spust PO drip-engine.sql. Obsahuje: tabulky, konstanty, e-mail šablony,
-- pravidla doporučení. Vlastní logiku (výpočet kreditu, výběr doporučení)
-- implementuje edge funkce 'checkin-capture' — návrh logiky je v komentářích.
--
-- SCHVÁLENÁ MECHANIKA (Martin):
--   +30 Kč za každý vyplněný check-in
--   bonus +100 Kč za milník −2 cm v pase (oproti prvnímu měření)
--   strop slevy = 50 % ceny produktu
-- ============================================================

-- 1) TABULKY ------------------------------------------------------------------
-- týdenní měření od uživatele (z formuláře /akademie/check-in/)
create table if not exists public.checkins (
  id          bigint generated always as identity primary key,
  email       text not null,
  created_at  timestamptz not null default now(),
  weight      numeric,            -- kg
  waist       numeric,            -- pás cm
  hips        numeric,            -- boky cm
  steps       text,               -- 'do5k' | '5-8k' | '8-10k' | '10k+'
  workouts    int,                -- 0..5(+)
  adherence   int,                -- 1..5 (dodržení plánu)
  sleep       int,                -- 1..5
  feeling     int,                -- 1..5
  note        text
);
create index if not exists checkins_email_idx on public.checkins (email, created_at desc);
alter table public.checkins enable row level security;  -- jen server (service_role) píše/čte

-- nasbíraný slevový kredit (po troškách)
create table if not exists public.discount_credits (
  email       text primary key,
  credit_czk  int not null default 0,         -- aktuální nasbíraná sleva
  checkins_n  int not null default 0,         -- počet vyplněných check-inů
  baseline_waist numeric,                      -- první naměřený pás (pro milník)
  milestone_2cm boolean not null default false,-- už připsán bonus za −2 cm?
  updated_at  timestamptz not null default now()
);
alter table public.discount_credits enable row level security;

-- konstanty mechaniky (editovatelné bez deploye)
insert into public.app_config (key, value) values
('coach_credit_per_checkin', '30'),
('coach_milestone_2cm_bonus', '100'),
('coach_credit_cap_pct', '50')          -- strop = 50 % ceny produktu
on conflict (key) do update set value = excluded.value, updated_at = now();

-- 2) LOGIKA checkin-capture (návrh — implementuje edge funkce) ----------------
-- Po přijetí check-inu funkce:
--  a) insert do checkins
--  b) upsert discount_credits: checkins_n += 1; credit += 30
--     - pokud baseline_waist je null → ulož aktuální waist jako baseline
--     - pokud (baseline_waist - waist) >= 2 a not milestone_2cm → credit += 100; milestone_2cm = true
--     - ořízni credit na strop: min(credit, round(price * cap_pct/100))
--  c) vyber DOPORUČENÍ na příští týden podle pravidel (tabulka níž) a naplánuj
--     e-mail track 'coaching' (přes leads/email_templates nebo přímý send)
--  d) vrať frontendu {ok:true, credit:30, credit_total:<celkem>}  (frontend to ukáže)

-- 3) PRAVIDLA DOPORUČENÍ (decision tree → blok textu do dalšího mailu) --------
-- Funkce vybere PRVNÍ sedící pravidlo (shora). Texty v Martinově hlase.
create table if not exists public.coaching_rules (
  prio     int primary key,
  cond     text not null,     -- lidský popis podmínky (logiku řeší funkce)
  message  text not null      -- blok doporučení do dalšího mailu
);
insert into public.coaching_rules (prio, cond, message) values
(10, 'sleep <= 2',
 'Vidím, že spánek teď vázne — a to je brzda, kterou většina lidí podcení. Tento týden jedna věc: pevný čas, kdy jdeš spát, a hodinu předtím pryč od telefonu. Spánek ti srovná chuť k jídlu víc než jakákoliv dieta.'),
(20, 'feeling <= 2',
 'Čtu, že to teď není ono — a to je úplně v pohodě, máš to u mě bez soudů. Zmenšíme krok: tento týden mi stačí, když každý den vyrazíš na 10 minut ven. Pohyb zvedne náladu líp než cokoliv a rozjede to zbytek.'),
(30, 'weight down AND adherence >= 4',
 'Tohle je přesně ono! 💪 Váha dolů a plán držíš — drž tempo, nic neměň. Jedna věc navíc na příští týden: přidej bílkovinu do snídaně, ať máš přes den klid na sladké.'),
(40, 'weight stagnates AND steps low',
 'Váha se na chvíli zastavila — žádná panika, řešíme týdenní průměr. Páka je teď pohyb mimo posilku: přidej ~1500 kroků denně. Malá změna, velký rozdíl v energetickém výdeji.'),
(50, 'weight stagnates AND adherence <= 3',
 'Váha stojí a vidím, že plán trochu ujíždí — bez kázání :) Vyber si tento týden JEDNO jídlo denně, kam přidáš pořádnou porci bílkoviny a zeleniny. Nejdřív tahle jedna změna, zbytek nech být.'),
(60, 'weight up AND adherence >= 4',
 'Klid — váha nahoru při poctivém týdnu je skoro vždycky voda (sůl, hormony, trénink), ne tuk. Nereaguj na jeden den. Drž kurz, příští týden to spadne. Věř procesu.'),
(70, 'workouts = 0',
 'Tento týden bez tréninku — život jede, chápu. Cíl na příště je malý a splnitelný: dva krátké tréninky, klidně 20 minut doma. Rozjezd je důležitější než dokonalost.'),
(99, 'default',
 'Díky za check-in! Jedeš dál a to se počítá. Tento týden drž to, co ti funguje, a mrkni, jestli zvládneš o kousek víc kroků nebo o jedno poctivé jídlo navíc. Maličkosti dělají výsledek.')
on conflict (prio) do update set cond = excluded.cond, message = excluded.message;

-- 4) E-MAIL: track 'coaching' -------------------------------------------------
-- Týdenní smyčka: 1× týdně mail s (a) doporučením z minulého check-inu
-- + (b) výzvou vyplnit nový. Recommendation blok vkládá funkce dynamicky
-- (token {{coach_reco}}). Opt-in: uživatel přijme nabídku z některého
-- úvodního mailu → enroll do tracku 'coaching' (1 enroll řádek v leads).
insert into public.email_templates (track, step, key, subject, preheader, blocks, wait_days) values
('coaching', 0, 'coach-welcome',
 $s$Jdeme na to — tvůj coaching začíná 💪$s$,
 $h$Jednou týdně check-in, na míru doporučení. Zadarmo.$h$,
 $j$[{"t":"p","html":"Ahoj{{fn_space}},"},{"t":"p","html":"Super rozhodnutí. Od teď to bereme spolu — jednou týdně mi pošleš krátký <strong>check-in</strong> (30 vteřin, naklikáš) a já ti podle něj pošlu <strong>doporučení na míru</strong> na další týden. Přesně jak to dělám s klienty v koučinku."},{"t":"p","html":"A bonus: za každý vyplněný check-in se ti <strong>po troškách načítá sleva</strong> na videokurz i Academy. Čím líp ti to půjde, tím větší. 🎁"},{"t":"btn","text":"Vyplnit první check-in","href":"https://martinbarna.cz/akademie/check-in/"},{"t":"p","html":"Tak jdeme. Drž se a uvidíš výsledky.<br><strong>Be Effective!</strong><br>Martin"}]$j$::jsonb,
 7),
('coaching', 1, 'coach-weekly',
 $s$Tvůj týdenní check-in (+ tip na míru)$s$,
 $h$Jak se vedlo? A co tento týden.$h$,
 $j$[{"t":"p","html":"Ahoj{{fn_space}},"},{"t":"p","html":"Tvoje doporučení na tento týden, podle posledního check-inu:"},{"t":"reco","html":"{{coach_reco}}"},{"t":"p","html":"A teď ten dnešní — ať máme z čeho vyjít příště. Zabere to 30 vteřin:"},{"t":"btn","text":"Vyplnit check-in","href":"https://martinbarna.cz/akademie/check-in/"},{"t":"p","html":"Jdeme dál!<br><strong>Be Effective!</strong><br>Martin"},{"t":"ps","html":"P.S. Nasbíraná sleva ti drží — koukni po vyplnění, kolik už máš. 😉"}]$j$::jsonb,
 7)
on conflict (track, step) do update set
  key = excluded.key, subject = excluded.subject, preheader = excluded.preheader,
  blocks = excluded.blocks, wait_days = excluded.wait_days, updated_at = now();

-- POZN.: track 'coaching' krok 1 se po odeslání NEPOSOUVÁ dál (zůstává weekly).
-- Cowork: po odeslání kroku 1 nech step=1 a next_send_at = now()+7d (smyčka),
-- nebo řeš weekly samostatným cronem nad aktivními 'coaching' leady.
-- Blok {"t":"reco"} renderuj v drip-send jako zvýrazněný box (jako .praxe).
-- ============================================================
