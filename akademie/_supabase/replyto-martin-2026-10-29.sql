-- ============================================================================
-- REPLY-TO MAILŮ: app_config.reply_to_email → martin@martinbarna.cz (29. 10. 2026)
-- Projekt: Academy uhmrpfsdcujbhbtumqye.
-- ============================================================================
-- ⛔ JEN SOUBOR. Nespouštět, dokud Martin neřekne GO. Žádný deploy funkcí odsud.
-- Martin 29. 10. 2026: podpora všude martin@martinbarna.cz.
-- Dnes v DB stojí fitness.barna@gmail.com. Čtou to drip-send a checkin-capture.
-- Záloha je JEN řádek reply_to_email, ne celá app_config (tam leží secrety).
-- Druhý běh spadne na existující záloze, nic se podruhé nepřepíše.
-- ============================================================================

-- KONTROLA PŘED (očekávej value = fitness.barna@gmail.com)
select key, value, updated_at
from public.app_config
where key = 'reply_to_email';

begin;

create table public.zaloha_app_config_replyto_20261029 as
select * from public.app_config where key = 'reply_to_email';

alter table public.zaloha_app_config_replyto_20261029 enable row level security;
revoke all on public.zaloha_app_config_replyto_20261029 from public, anon, authenticated;

do $reply$
declare
  n int;
  po text;
begin
  if (select count(*) from public.zaloha_app_config_replyto_20261029) <> 1 then
    raise exception 'ZALOHA: cekal jsem 1 radek reply_to_email, je %',
      (select count(*) from public.zaloha_app_config_replyto_20261029);
  end if;

  update public.app_config
     set value = 'martin@martinbarna.cz',
         updated_at = now()
   where key = 'reply_to_email'
     and value in ('fitness.barna@gmail.com', 'martin@martinbarna.cz');
  get diagnostics n = row_count;
  if n <> 1 then
    raise exception 'REPLY-TO: cekal jsem 1 radek (fitness.barna@gmail.com nebo uz martin@), zmeneno %. Nic se nezapsalo.', n;
  end if;

  select value into po from public.app_config where key = 'reply_to_email';
  if po is distinct from 'martin@martinbarna.cz' then
    raise exception 'REPLY-TO: po zapisu je %', po;
  end if;

  raise notice 'HOTOVO: reply_to_email = % (zaloha zaloha_app_config_replyto_20261029)', po;
end
$reply$;

commit;

-- KONTROLA PO (očekávej value = martin@martinbarna.cz)
select key, value, updated_at
from public.app_config
where key = 'reply_to_email';

-- ROLLBACK (ručně, až kdyby GO mělo couvnout; nepatří do tohohle běhu):
-- begin;
-- update public.app_config c
--    set value = z.value,
--        updated_at = now()
--   from public.zaloha_app_config_replyto_20261029 z
--  where c.key = z.key;
-- commit;
