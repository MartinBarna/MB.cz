-- akademie/_supabase/kosik-retence-2026-11.down.sql
-- NESPOUSTET spolu s migraci. Jen rucni navrat, kdyz se ma retence zase vypnout
-- a radky vratit ze zalohy. Zalohu tabulku tenhle soubor nemaze.

do $$
begin
  perform cron.unschedule('kosik-retence-denne');
exception when others then
  null;
end $$;

update public.app_config
set value = 'false'
where key = 'kosik_retence_zapnuto';

insert into public.kosik_checkouty
select r.*
from (
  select distinct on (z.id) z.radek
  from public.kosik_checkouty_zaloha_retence z
  order by z.id, z.zaloha_at desc
) z
cross join lateral jsonb_populate_record(null::public.kosik_checkouty, z.radek) as r
where not exists (
  select 1 from public.kosik_checkouty k where k.id = r.id
);

drop function if exists public.kosik_retence_smaz();
