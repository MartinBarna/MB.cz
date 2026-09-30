-- 84. šéf 30. 9. 2026, Martin: „maily coaching souhlas 26/10, ať fakt pak odejdou.“
-- Martin je 2. až ~23. 10. na Bali. Prodejní maily na koučink se neruší, jen se jim posune
-- next_send_at na 26. až 30. 10. (rozprostřeno podle id kvůli dennímu stropu drip-send).
-- Běží každou hodinu: chytí i lidi, kteří na koučinkový krok dojdou až během října.
-- Po 31. 10. se job sám odplánuje. Ostatní kroky tratí běží beze změny.
create or replace function public.odloz_koucink_bali() returns integer
language plpgsql as $$
declare n integer;
begin
  if now() > timestamptz '2026-10-31 23:00+00' then
    perform cron.unschedule('odloz-koucink-bali');
    return 0;
  end if;
  update leads
     set next_send_at = timestamptz '2026-10-26 07:00+00'
                        + ((abs(hashtext(id::text)) % 5) * interval '1 day')
                        + ((abs(hashtext(id::text)) % 8) * interval '1 hour'),
         updated_at = now()
   where status = 'active'
     and next_send_at is not null
     and next_send_at < timestamptz '2026-10-26 07:00+00'
     and ((track = 'upsell-coaching' and step in (2, 4))
       or (track = 'longtail-kupci' and step = 5)
       or (track = 'longtail-consumer' and step = 11));
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.odloz_koucink_bali() from public, anon, authenticated;
select cron.schedule('odloz-koucink-bali', '25 * * * *', 'select public.odloz_koucink_bali()');
select public.odloz_koucink_bali() as posunuto_ted;
