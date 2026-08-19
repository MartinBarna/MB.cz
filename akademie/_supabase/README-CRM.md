# CRM fáze 1a: SQL vrstva `crm_*`

Soubory v `akademie/_supabase/`. **Nikdo je z agenta nespouští na živou DB.**
Aplikace je ruční krok v Supabase SQL editoru (projekt Barna Academy,
`uhmrpfsdcujbhbtumqye`) až po schválení.

CRM je překryv. `leads`, `customer_contacts`, `entitlements` a `profiles` se
nemažou, nepřepisují a drip engine dál čte jen `leads.track` / `leads.step`.

## Pořadí aplikace

1. `crm-schema.sql` (rozšíření citext, tabulky, indexy, RLS, `crm_norm_email`,
   `crm_is_test_email`)
2. `crm-refresh.sql` (funkce `crm_refresh_from_academy()`)
3. `crm-person-card.sql` (pohled `crm_person_card`)
4. Ručně: `select public.crm_refresh_from_academy();`
5. Ověřovací dotazy níž

Znovuspuštění 1 až 3 je idempotentní (`if not exists` / `create or replace` /
`drop view if exists`). Znovuspuštění kroku 4 je taky idempotentní: source_links
a identifikátory se nezdvojí, interakce s `external_id` se nevloží podruhé.

Cron se v téhle dávce **nenastavuje**. Než bude první běh zkontrolovaný okem,
ať to nespouští pg_cron samo.

## Co který soubor dělá

| soubor | obsah |
|---|---|
| `crm-schema.sql` | 10 tabulek `crm_*`, unikáty, FK, RLS bez politik, revoke anon/authenticated |
| `crm-refresh.sql` | synk ze zdrojů Academy, jen SELECT ven + upsert do `crm_*` |
| `crm-person-card.sql` | karta osoby; produkty a trať čte živě |

Tabulky: `crm_persons`, `crm_identifiers`, `crm_attributes`, `crm_tags`,
`crm_consents`, `crm_interactions`, `crm_source_links`, `crm_merge_log`,
`crm_imports`, `crm_enroll_queue`.

`crm_app_snapshot` tady **není**. To je fáze 2 (appka, jiný projekt).

## RLS

Na všech `crm_*` je RLS zapnuté a **žádná politika** pro `anon` ani
`authenticated`. Čte a píše `service_role` (má `bypassrls`) a `postgres` v
SQL editoru. Komentář v schématu říká pravý důvod: chrání RLS, ne GRANT.
GRANT se přesto odebírá jako druhá brzda, protože Supabase dává `anon` zápis
default privileges.

Pohled `crm_person_card` má `security_invoker = true`. Bez toho by SELECT na
pohled šel pod vlastníkem a obešel RLS.

## Signatura funkce (create or replace ji nezmění)

`create or replace function` umí vyměnit tělo, **ne argumenty ani návratový
typ**. Po aplikaci musí existovat právě jedna varianta:

```sql
select n.nspname as schema,
       p.proname,
       pg_get_function_identity_arguments(p.oid) as args,
       pg_get_function_result(p.oid) as result,
       p.prosecdef as security_definer
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where p.proname like 'crm_%'
 order by 1, 2, 3;
```

Očekávané řádky:

| proname | args | result |
|---|---|---|
| `crm_norm_email` | `p_email text` | `text` |
| `crm_is_test_email` | `p_email text` | `boolean` |
| `crm_refresh_from_academy` | *(prázdné)* | `jsonb` |

Když `crm_refresh_from_academy` uvidíš dvakrát (třeba `()` a `(integer)`),
někdo přidal overload. `create or replace` ten starý **nemaže**. Tehdy
`drop function` té špatné varianty, až po kontrole `pg_proc`.

## Jak poznáš, že je to hotové

Inventura z 19. 8. 2026. Čísla se mají rovnat **těmto**, ne pocitu:

| kontrola | cíl |
|---|---|
| `select count(*) from crm_persons where status = 'active'` | **1319** (sjednocení čtyř tabulek). Může být o pár vyšší, pokud `client_reports` / `contact_messages` / `tvujcoach_grants` / `referral_codes` drží e-mail mimo tu čtyřku. Rozdíl vypiš, neskrývej. |
| `union_four_emails` v návratu funkce | **1319** |
| `leads ∩ customer_contacts` | **424** |
| `leads ∩ entitlements` | **435** |
| `customer_contacts ∩ entitlements` | **424** |
| `leads ∩ cc ∩ entitlements` | **417** |
| `leads ∩ profiles` | **56** |
| `customer_contacts ∩ profiles` | **52** |
| `profiles ∩ entitlements` | **59** |
| jen v leads | **475** |
| jen v customer_contacts (`cc_only` v JSON = CC mimo leads i entitlements i profiles, A9) | **388** |
| tag `ss-import-do-not-mail` (detached_at is null) = CC mimo leads | **395** |
| `select count(*) from leads` | **917** (nedotčené) |

Funkce ty průniky počítá z **živých** zdrojových tabulek (stejná metoda jako
inventura: `lower(trim(email))`) a vrátí je v JSON. Porovnej s tabulkou výš.

Tag a `cc_only` se kontrolují **zvlášť**. Tag je širší (CC mimo mailingovou
frontu `leads`, k datu inventury 395, bezpečnější pro mailing). `cc_only` je
A9 (388). Tag nesrovnávej s 388.

Doplňkové kontroly:

```sql
-- drip fronta beze změny
select count(*) from public.leads;
-- 917

-- nikdo z CRM nesáhl na track/step (řádků je pořád 917, žádný trigger na leads)
select tgname from pg_trigger
 where tgrelid = 'public.leads'::regclass
   and not tgisinternal;

-- karty
select count(*) from public.crm_person_card;

-- testovací účty (plus-adresa nebo fitness.barna@)
select count(*) from public.crm_persons where is_test and status = 'active';

-- open/click se NESMÍ objevit
select kind, count(*) from public.crm_interactions group by 1 order by 2 desc;
```

`email_events` type `open` / `click` se neimportují. Interakce `sent` má být
kolem 8642 (stav inventury; od 19. 8. mohlo přibýt odeslaných).

## Pravidla synku (z návrhu kap. 2)

- Auto-merge **jen** `lower(trim(email))`. Plus-adresa se s holou neslučuje.
- Jméno na kartě: admin ručně, jinak `customer_contacts`, jinak Academy
  `profiles.full_name`, až pak `leads`. Prázdná hodnota plnou nepřepíše.
- `leads.purchased` se ignoruje. Přístup je `entitlements`.
- `leads.segment = 'other'` se do pohlaví nebere.
- Odhlášení v `leads.status` vyhrává nad `consent = true`.
- UTM: první známá atribuce se nemaže prázdnem. Nová kampaň je další atribut.

## Co fáze 1 záměrně nedělá

- Žádný zápis do `leads.track` / `step` (fronta `crm_enroll_queue` je prázdné
  schéma pro fázi 6).
- Žádný snapshot appky, žádný import Gmail/WhatsApp.
- Žádný `pg_cron` na `crm_refresh_from_academy`.
- Žádné ceny v tabulkách ani v komentářích.
- Admin prohlížeč jen pro čtení: `/akademie/admin/crm/` + edge `admin-crm`.
  Nenasazeno, dokud to neschválíš. Žádný zápis, žádný service-role na klientu.

## Známé nejistoty (domyšleno, v návrhu nebylo bajtově)

1. **`tvujcoach_grants` nemá v inventuře PK.** `source_pk` a `external_id` jsou
   složené z `email|action|source|created_at`. Když tabulka `id` má, pořád se
   bere tahle skládanka (stabilní i bez čtení katalogu).
2. **`client_intake.created_at`** bere admin panel. Kdyby sloupec chyběl, synk
   na té větvi spadne. Pak doplnit skutečný časový sloupec.
3. **`entitlements` PK je (email, product).** `source_pk` = `email:product`.
4. **`customer_contacts` klíč je e-mail.** `source_pk` = normalizovaný e-mail.
5. **Telefon z leads se nenormalizuje na E.164** (v leads je 28 volných tvarů).
   Auto-merge podle telefonu fáze 1 nedělá.
6. **`is_test` u každé plus-adresy** (ne jen `fitness.barna+`). Zadání to chce.
   Reálný zákazník s `jmeno+tag@` se otaguje jako test.
7. **`lifecycle` je jedno pole**, kap. 5 má překrývající segmenty. Priorita
   (stejně jako CASE v `crm_refresh_from_academy`): coaching-active,
   coaching-ex, lead-only (jen leads, bez cc/ent/profiles), pak živé signály
   (`customer-and-lead` při `has_ent`, `member-academy` při
   `has_academy`/`has_prof`), teprve potom `customer-historical` (cc mimo
   leads a bez živého nároku/profilu), `customer-and-lead` (cc+leads bez
   nároku), lead-only fallback, other.
8. **Interakce `kind=grant`** pro `tvujcoach_grants` návrh v seznamu kind
   neměl. Bez nového druhu by grant šel jen jako `purchase`, což u revoke
   lže. Proto `grant`.
9. **Počet osob 1319** je sjednocení čtyř identitních tabulek. Synk čte i
   satelity (reporty, formulář, granty, affiliate). Extra e-mail = extra
   osoba. Návrat funkce to rozliší (`persons_active` vs `union_four_emails`).
10. **`crm_interactions.kind` má CHECK.** Nový druh v importu Gmail/WA musí
    nejdřív rozšířit constraint, ne doufat že `create or replace` tabulku
    opraví.
