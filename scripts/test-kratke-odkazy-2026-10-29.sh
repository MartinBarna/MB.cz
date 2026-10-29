#!/usr/bin/env bash
# Lokální zkouška akademie/_supabase/kratke-odkazy-2026-10-29.sql.
# Založí dočasný Postgres, tabulku email_templates ve schématu z drip-engine.sql
# a syntetické řádky. Na produkci ani na Supabase se nepřipojuje.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SQL="$ROOT/akademie/_supabase/kratke-odkazy-2026-10-29.sql"
PGBIN="/usr/lib/postgresql/16/bin"
DIR="$(mktemp -d)"
PORT=54329

cleanup() {
  if [[ -d "$DIR/data" ]]; then
    "$PGBIN/pg_ctl" -D "$DIR/data" -m fast stop >/dev/null 2>&1 || true
  fi
  rm -rf "$DIR"
}
trap cleanup EXIT

if [[ ! -x "$PGBIN/initdb" ]]; then
  echo "chybi $PGBIN/initdb" >&2
  exit 1
fi

# Podmínka hotfixu 637 musí být u párového UPDATE i u zametání.
for needle in \
  "key in ('lk-3-koucink', 'upsell-co-1', 'upsell-co-2')" \
  "track = 'longtail-kupci' and step = 5" \
  "track = 'upsell-coaching' and step in (2, 4)" \
  "where track = r.track and step = r.step" \
  "t.track = z.track" \
  "t.step = z.step"
do
  count="$(grep -F -c "$needle" "$SQL" || true)"
  if [[ "$count" -lt 1 ]]; then
    echo "v SQL chybi: $needle" >&2
    exit 1
  fi
done
for needle in \
  "key in ('lk-3-koucink', 'upsell-co-1', 'upsell-co-2')" \
  "track = 'longtail-kupci' and step = 5" \
  "track = 'upsell-coaching' and step in (2, 4)"
do
  count="$(grep -F -c "$needle" "$SQL" || true)"
  if [[ "$count" -lt 2 ]]; then
    echo "podminka hotfixu neni u obou UPDATE: $needle ($count)" >&2
    exit 1
  fi
done
if grep -E -n 'select id|where id' "$SQL"; then
  echo "SQL porad cte sloupec id" >&2
  exit 1
fi

node "$ROOT/scripts/kontrola-mail-utm.mjs"

"$PGBIN/initdb" -D "$DIR/data" --username=mbtest --auth=trust --encoding=UTF8 --locale=C.UTF-8 --no-sync >"$DIR/initdb.log"
"$PGBIN/pg_ctl" -D "$DIR/data" -w -o "-p $PORT -k $DIR -c listen_addresses=''" -l "$DIR/postgres.log" start

PSQL=("$PGBIN/psql" -h "$DIR" -p "$PORT" -U mbtest -d postgres -v ON_ERROR_STOP=1)

"${PSQL[@]}" <<'SETUP'
do $role$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated;
  end if;
end
$role$;

-- Schéma z akademie/_supabase/drip-engine.sql (email_templates).
create table public.email_templates (
  track      text not null,
  step       int  not null,
  key        text not null,
  subject    text not null,
  preheader  text not null default '',
  blocks     jsonb not null,
  wait_days  int,
  updated_at timestamptz not null default now(),
  primary key (track, step)
);
alter table public.email_templates enable row level security;

insert into public.email_templates (track, step, key, subject, preheader, blocks, wait_days) values
(
  'test-smichany', 0, 'test-smichany',
  'Hubneš podle starých čísel?',
  'Stihneš to do pátku?',
  $b$[{"t":"p","html":"Hubneš podle starých čísel? Víš, kolik? Pak jez."},{"href":"https://example.com/clanek?plan=basic&utm_source=email&utm_medium=drip","t":"btn","text":"Otevřít?"}]$b$::jsonb,
  3
),
(
  'test-jen-utm', 0, 'test-jen-utm',
  'Jen kampaň, ale otázka?',
  '',
  $b$[{"t":"p","html":"Odkaz <a href=\"https://example.com/jen?utm_source=email&utm_campaign=x\">sem</a>. A dál?"}]$b$::jsonb,
  null
),
(
  'test-kotva', 0, 'test-kotva',
  'Kotva za parametrem?',
  'Preheader s otázkou?',
  $b$[{"t":"p","html":"Jedna https://example.com/stranka?utm_source=email#balicky a druhá https://example.com/c?plan=vip&utm_medium=drip&locale=cs#balicky. Hotovo?"}]$b$::jsonb,
  1
),
(
  'test-amp', 0, 'test-amp',
  'Entita a pořadí?',
  '',
  $b$[{"t":"p","html":"<a href='https://example.com/a?locale=cs&amp;utm_source=email&amp;utm_medium=drip'>text?</a> https://example.com/b?utm_source=email&ref=noviny http://example.com/stary?utm_source=email&page=2"}]$b$::jsonb,
  1
),
(
  'test-par', 0, 'test-par',
  'Pár z výpisu?',
  'Taky otázka?',
  $b$[{"href":"https://tvujcoach.cz/?utm_source=email&utm_medium=drip&utm_campaign=tc-start&utm_content=s1","t":"btn","text":"Appka?"}]$b$::jsonb,
  2
),
(
  'test-par-amp', 0, 'test-par-amp',
  'Pár v HTML?',
  '',
  $b$[{"t":"p","html":"<a href='https://tvujcoach.cz/?utm_source=email&amp;utm_medium=drip&amp;utm_campaign=tc-blok1&amp;utm_content=lm-0'>odkaz?</a>"}]$b$::jsonb,
  2
),
(
  'test-stripe', 0, 'test-stripe',
  'Platba zůstane?',
  '',
  $b$[{"href":"https://buy.stripe.com/7sY14m4Z19Vo2J2eG33ks0r?locale=cs&utm_source=email&utm_medium=drip&utm_campaign=academy-vk-serie&utm_content=avk-1-lekce","t":"btn","text":"Zaplatit?"}]$b$::jsonb,
  null
),
(
  'test-cisty', 0, 'test-cisty',
  'Čistý předmět?',
  '',
  $b$[{"t":"p","html":"Bez kampaně https://example.com/cisty?plan=basic. Opravdu?"}]$b$::jsonb,
  4
),
(
  'longtail-kupci', 5, 'lk-3-koucink',
  'Kapacita koučinku?',
  'Krátký preheader?',
  $b$[{"t":"p","html":"S vedením na míru to půjde rychleji. Odkaz https://martinbarna.cz/koucing/ zůstává. A otázka?"}]$b$::jsonb,
  21
),
(
  'upsell-coaching', 2, 'upsell-co-1',
  'Ještě jedna otázka?',
  '',
  $b$[{"t":"p","html":"Gold a Diamond bez čísla. <a href=\"https://martinbarna.cz/koucing/#balicky\">balíčky</a>?"}]$b$::jsonb,
  5
),
(
  'upsell-coaching', 4, 'upsell-co-2',
  'Poslední mail?',
  'Jak to je?',
  $b$[{"t":"p","html":"Žádný umělý časovač, jen ať víš, jak to je."}]$b$::jsonb,
  null
);

create table public.mb_test_hotfix_pred as
select track, step, key, subject, preheader, blocks, updated_at
from public.email_templates
where (track = 'longtail-kupci' and step = 5)
   or (track = 'upsell-coaching' and step in (2, 4));

create table public.mb_test_cisty_pred as
select track, step, key, subject, preheader, blocks, updated_at
from public.email_templates
where track = 'test-cisty' and step = 0;
SETUP

{
  echo "set client_min_messages to warning;"
  echo "\\i $SQL"
  cat <<'ASSERT'
do $a$
declare
  t text;
  n int;
  subjekt text;
  prehlavicka text;
begin
  select count(*) into n from public.email_templates
   where blocks::text ~* ('https?://[^[:space:]''"<>]*\?[^[:space:]''"<>#]*' || 'u' || 'tm_')
      or coalesce(subject, '') ~* ('https?://[^[:space:]''"<>]*\?[^[:space:]''"<>#]*' || 'u' || 'tm_')
      or coalesce(preheader, '') ~* ('https?://[^[:space:]''"<>]*\?[^[:space:]''"<>#]*' || 'u' || 'tm_');
  if n <> 0 then
    raise exception 'sablon s kampani v URL: %', n;
  end if;

  select count(*) into n
  from public.email_templates sabl
  join public.email_templates_zaloha_kratke_odkazy_20261029 z
    on z.track = sabl.track and z.step = sabl.step
  where sabl.subject is distinct from z.subject
     or sabl.preheader is distinct from z.preheader;
  if n <> 0 then
    raise exception 'zmeneny subject nebo preheader: %', n;
  end if;

  select blocks::text, subject, preheader into t, subjekt, prehlavicka
  from public.email_templates where track = 'test-smichany' and step = 0;
  if subjekt <> 'Hubneš podle starých čísel?' or prehlavicka <> 'Stihneš to do pátku?' then
    raise exception 'smichany predmet/preheader: % | %', subjekt, prehlavicka;
  end if;
  if t not like '%https://example.com/clanek?plan=basic%'
     or t like '%https://example.com/clanek?plan=basic&%'
     or position('u' || 'tm_' in t) > 0
     or t not like '%Hubneš podle starých čísel?%'
     or t not like '%Víš, kolik?%'
     or t not like '%Otevřít?%' then
    raise exception 'smichany blocks: %', t;
  end if;

  select blocks::text, subject, preheader into t, subjekt, prehlavicka
  from public.email_templates where track = 'test-jen-utm' and step = 0;
  if subjekt <> 'Jen kampaň, ale otázka?' or prehlavicka <> '' then
    raise exception 'jen-utm predmet/preheader: % | %', subjekt, prehlavicka;
  end if;
  if position('https://example.com/jen' in t) = 0
     or position('https://example.com/jen?' in t) > 0
     or position('u' || 'tm_' in t) > 0
     or t not like '%A dál?%' then
    raise exception 'jen-utm blocks: %', t;
  end if;

  select blocks::text, subject, preheader into t, subjekt, prehlavicka
  from public.email_templates where track = 'test-kotva' and step = 0;
  if subjekt <> 'Kotva za parametrem?' or prehlavicka <> 'Preheader s otázkou?' then
    raise exception 'kotva predmet: % | %', subjekt, prehlavicka;
  end if;
  if position('https://example.com/stranka#balicky' in t) = 0
     or position('https://example.com/c?plan=vip&locale=cs#balicky' in t) = 0
     or position('u' || 'tm_' in t) > 0
     or t not like '%Hotovo?%' then
    raise exception 'kotva blocks: %', t;
  end if;

  select blocks::text into t from public.email_templates where track = 'test-amp' and step = 0;
  if position('https://example.com/a?locale=cs' in t) = 0
     or position('https://example.com/b?ref=noviny' in t) = 0
     or position('http://example.com/stary?page=2' in t) = 0
     or position('u' || 'tm_' in t) > 0
     or position('&amp;' in t) > 0
     or t not like '%text?%' then
    raise exception 'amp blocks: %', t;
  end if;

  select blocks::text, subject into t, subjekt
  from public.email_templates where track = 'test-par' and step = 0;
  if subjekt <> 'Pár z výpisu?'
     or position('https://martinbarna.cz/go/tc-m/' in t) = 0
     or position('tvujcoach.cz' in t) > 0
     or t not like '%Appka?%' then
    raise exception 'par blocks: %', t;
  end if;

  select blocks::text into t from public.email_templates where track = 'test-par-amp' and step = 0;
  if position('https://martinbarna.cz/go/tc-m/' in t) = 0
     or position('tvujcoach.cz' in t) > 0
     or position('&amp;' in t) > 0
     or t not like '%odkaz?%' then
    raise exception 'par-amp blocks: %', t;
  end if;

  select blocks::text, subject into t, subjekt
  from public.email_templates where track = 'test-stripe' and step = 0;
  if subjekt <> 'Platba zůstane?'
     or position('https://buy.stripe.com/7sY14m4Z19Vo2J2eG33ks0r?locale=cs' in t) = 0
     or position('u' || 'tm_' in t) > 0
     or t not like '%Zaplatit?%' then
    raise exception 'stripe blocks: %', t;
  end if;

  select count(*) into n
  from public.email_templates sabl
  join public.mb_test_cisty_pred z using (track, step)
  where sabl.subject is distinct from z.subject
     or sabl.preheader is distinct from z.preheader
     or sabl.blocks is distinct from z.blocks
     or sabl.updated_at is distinct from z.updated_at;
  if n <> 0 then
    raise exception 'cisty radek se zmenil';
  end if;

  select count(*) into n from public.mb_test_hotfix_pred;
  if n <> 3 then
    raise exception 'hotfix snimek nema 3 radky: %', n;
  end if;
  select count(*) into n
  from public.email_templates sabl
  join public.mb_test_hotfix_pred z using (track, step)
  where sabl.key is distinct from z.key
     or sabl.subject is distinct from z.subject
     or sabl.preheader is distinct from z.preheader
     or sabl.blocks is distinct from z.blocks
     or sabl.updated_at is distinct from z.updated_at;
  if n <> 0 then
    raise exception 'hotfix 637 byl prepsan, radku %', n;
  end if;

  if pg_temp.mb_sundej_kampan(null) is not null then
    raise exception 'NULL se zmenil';
  end if;
  if pg_temp.mb_sundej_kampan('') <> '' then
    raise exception 'prazdny retezec se zmenil';
  end if;
  if pg_temp.mb_sundej_kampan('Hubneš podle starých čísel?') <> 'Hubneš podle starých čísel?' then
    raise exception 'otaznik na konci predmetu zmizel';
  end if;
  if pg_temp.mb_sundej_kampan($q$Podívej https://example.com/x?utm_source=email&plan=basic a víš?$q$)
     <> 'Podívej https://example.com/x?plan=basic a víš?' then
    raise exception 'url uprostred vety: %', pg_temp.mb_sundej_kampan($q$Podívej https://example.com/x?utm_source=email&plan=basic a víš?$q$);
  end if;
  if pg_temp.mb_sundej_kampan('https://example.com/s?utm_source=email#kotva') <> 'https://example.com/s#kotva' then
    raise exception 'kotva ve funkci';
  end if;
  if pg_temp.mb_sundej_kampan($q$<a href=\"https://example.com/jen?utm_source=email&utm_campaign=x\">sem?</a>$q$)
     <> $q$<a href=\"https://example.com/jen\">sem?</a>$q$ then
    raise exception 'json uvozovka: %',
      pg_temp.mb_sundej_kampan($q$<a href=\"https://example.com/jen?utm_source=email&utm_campaign=x\">sem?</a>$q$);
  end if;
  if pg_temp.mb_vycisti_url('https://example.com/s?UTM_SOURCE=email&plan=basic') <> 'https://example.com/s?plan=basic' then
    raise exception 'velka pismena parametru';
  end if;
  if pg_temp.mb_vycisti_url('https://example.com/s?utm_source=email&') <> 'https://example.com/s' then
    raise exception 'osirely ampersand: %', pg_temp.mb_vycisti_url('https://example.com/s?utm_source=email&');
  end if;
  if pg_temp.mb_vycisti_url('https://example.com/s?plan=basic&locale=cs') <> 'https://example.com/s?plan=basic&locale=cs' then
    raise exception 'url bez kampane se zmenila';
  end if;
end
$a$;
ASSERT
} | "${PSQL[@]}" | tee "$DIR/migrace.out"

grep -q 'sablon_s_kampani_v_url' "$DIR/migrace.out"
grep -q 'zmeneny_subject_nebo_preheader' "$DIR/migrace.out"
# psql tiskne hodnotu 0 na vlastním řádku. Oba ověřovací součty mají být 0.
nuly="$(grep -E '^[[:space:]]*0[[:space:]]*$' "$DIR/migrace.out" | wc -l)"
if [[ "$nuly" -lt 2 ]]; then
  echo "overovaci SELECT nevratil dve nuly" >&2
  cat "$DIR/migrace.out" >&2
  exit 1
fi

echo "VYSLEDEK: OK (lokalni Postgres, predmet s otaznikem, URL s dalsim parametrem, jen kampan, kotva)"
