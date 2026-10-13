-- Jazyk koučinkového klienta. Jen sloupec, žádná funkce.
-- Čte ho klientská sekce z select=* na client_targets.
-- Chybí-li sloupec nebo řádek, stránka zůstane česky.
-- Návrat: alter table public.client_targets drop column if exists jazyk;

alter table public.client_targets
  add column if not exists jazyk text not null default 'cs';

alter table public.client_targets
  drop constraint if exists client_targets_jazyk_check;

alter table public.client_targets
  add constraint client_targets_jazyk_check check (jazyk in ('cs', 'en'));

comment on column public.client_targets.jazyk is
  'Jazyk klientské sekce: cs nebo en. Default cs. Prázdné cíle (jen jazyk) kartu zadání nezobrazí.';
