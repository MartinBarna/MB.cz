-- =============================================================================
-- client-remind: IDEMPOTENCE V DATABÁZI (dávka 2, 17. 9. 2026, nález V3)
--
-- ⛔ SPUSTIT PŘED DEPLOYEM nové verze `client-remind`. Nová verze si řádek
--    REZERVUJE ještě před odesláním (`upsert ... on conflict do nothing`) a bez
--    unikátního indexu by ta rezervace nic neznamenala: dva souběžné běhy by
--    vložily dva řádky a oba by poslaly mail.
--
-- CO SE OPRAVUJE
-- Tři crony (jobid 19, 47, 48) volají tutéž funkci v neděli 01:00, 01:30 a 02:00 UTC.
-- Idempotence dosud stála VÝHRADNĚ na aplikaci: přečti `client_remind_sent`, pošli,
-- pak zapiš. Když zápis po odeslání selhal (funkce to hlásila polem `zapis_selhal`,
-- které končí v `net._http_response`, kam se nikdo nedívá), další běh poslal znovu.
-- Změřeno 17. 9. 2026: `client_remind_sent` má jen `pkey (id)` a `(email, sent_at desc)`,
-- žádný unikátní index, a tabulka je PRÁZDNÁ (0 řádků). Neděle 20. 9. 2026 je první
-- ostrý běh téhle cesty, takže se nic nemusí dočišťovat.
--
-- ROZHODNUTÍ MARTINA 17. 9. 2026 k politice `client_operational`:
--   „RADĚJI NIKDY MAIL NAVÍC." ⇒ pořadí je ZAPIŠ, PAK POŠLI.
--   Cena toho rozhodnutí: když odeslání selže, mail nedojde a rezervace zůstane.
--   Proto `sent_ok` a pravidlo v kódu:
--     - Resend zásilku VÝSLOVNĚ odmítl (HTTP >= 400, mail jistě neodešel)
--         => funkce rezervaci SMAŽE, opakovací běh o 30 minut později to zkusí znovu,
--     - odeslání skončilo v nejistotě (síť, timeout, `status: 0`)
--         => rezervace ZŮSTANE s `sent_ok=false` a Martin dostane alert.
--       Tady se vědomě neopakuje: mail mohl odejít a Martinovo rozhodnutí zní
--       „raději nikdy mail navíc". Rozhodne člověk, ne cron.
--
-- ⚠️ `den` je UTC datum, ne pražské. Všechny tři běhy (01:00 až 02:00 UTC) padnou
--    na týž UTC den, takže na tomhle rozvrhu je to bezpečné. Kdo posune cron přes
--    půlnoc UTC, rozbije tím tuhle pojistku a musí sem sáhnout taky.
-- ⚠️ Index je PARTIAL, jen pro ostré druhy 'report' a 'register'. Testovací klíče
--    `test:report` a `test:register` (dávka 2, nález V2) pod něj schválně nespadají:
--    ty si hlídá hodinová pojistka v kódu a smí se opakovat parametrem `test_znovu`.
--
-- ⛔⛔ PROČ FUNKCE NEPOUŽÍVÁ `upsert ... on conflict do nothing`, jak znělo zadání:
--    ZMĚŘENO 17. 9. 2026 na živé DB (v transakci, kterou shodila `raise exception`):
--    `on conflict (email, kind, den) do nothing` nad PARTIAL indexem skončí chybou
--    `42P10: there is no unique or exclusion constraint matching the ON CONFLICT
--    specification`. Postgres partial index dovodí jen tehdy, když se zopakuje i jeho
--    podmínka (`... where kind in (...)`), a PostgREST žádnou podmínku poslat neumí.
--    ⇒ Funkce dělá prostý `insert` a chybu `23505` čte jako „rezervaci má někdo jiný,
--      já neposílám". Sémantika je stejná („kdo prohraje závod, neodesílá"), jen se
--      neopírá o odvození indexu. Kdo tenhle index někdy udělá úplný (bez `where`),
--      rozbije tím hodinovou pojistku testu, ne idempotenci.
--
-- Spouští se ručně přes MCP apply_migration v DB Academy (uhmrpfsdcujbhbtumqye).
-- =============================================================================

alter table public.client_remind_sent
  add column if not exists den date generated always as ((sent_at at time zone 'UTC')::date) stored;

alter table public.client_remind_sent
  add column if not exists sent_ok boolean not null default true;

comment on column public.client_remind_sent.den is
  'UTC datum odeslani, jen kvuli unikatnimu indexu. Generovany sloupec, nezapisuje se.';
comment on column public.client_remind_sent.sent_ok is
  'false = rezervace zustala, ale odeslani skoncilo v nejistote (sit/timeout). Mail se NEOPAKUJE, resi to Martin.';

-- ⛔ Kdyby tabulka někdy nebyla prázdná, tenhle příkaz na duplicitách spadne.
--    To je záměr: raději ať migrace spadne hlasitě, než aby se data tiše zahodila.
--    Dočištění (kdyby bylo potřeba) je v komentáři na konci souboru.
create unique index if not exists client_remind_sent_unique_den
  on public.client_remind_sent (email, kind, den)
  where kind in ('report', 'register');

-- Nová verze funkce rezervaci maže, když je jisté, že mail neodešel, aby ji opakovací
-- běh mohl zkusit znovu.
-- ⚠️ [R1, nález N6] Tenhle příkaz je NO-OP: změřeno 17. 9. 2026, že `service_role` má
--    na `client_remind_sent` DELETE i UPDATE už z výchozích práv Supabase. Původní
--    zdůvodnění („bez tohohle grantu by smazání tiše selhalo") bylo NEPRAVDIVÉ.
--    Řádek zůstává jako výslovná deklarace, co funkce potřebuje, ať se právo neztratí
--    při příštím úklidu grantů; ale nikdo si z něj nesmí odvodit, že bez něj DELETE nejde.
grant delete on table public.client_remind_sent to service_role;

-- Kontrola po zásahu (čekám unikátní partial index a sloupce den, sent_ok):
--   select indexname, indexdef from pg_indexes where tablename = 'client_remind_sent';
--   select column_name, is_generated from information_schema.columns
--    where table_schema='public' and table_name='client_remind_sent';
--   select has_table_privilege('service_role', 'public.client_remind_sent', 'DELETE');
--
-- Návrat: drop index if exists public.client_remind_sent_unique_den;
--         alter table public.client_remind_sent drop column if exists den;
--         alter table public.client_remind_sent drop column if exists sent_ok;
--         revoke delete on table public.client_remind_sent from service_role;
--
-- Dočištění duplicit, KDYBY index spadl (nechávat jen nejstarší řádek dvojice):
--   delete from public.client_remind_sent a using public.client_remind_sent b
--    where a.email = b.email and a.kind = b.kind
--      and (a.sent_at at time zone 'UTC')::date = (b.sent_at at time zone 'UTC')::date
--      and a.id > b.id;
