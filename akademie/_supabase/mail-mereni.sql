-- Barna Academy: VLASTNI mereni otevreni a prokliku mailu (edge fn `mail-pixel`, `mail-klik`).
-- Projekt: uhmrpfsdcujbhbtumqye. Spousti se JEDNOU, pred nasazenim funkci.
-- ⛔ Nic nemaze a nic nemeni na existujicich datech. Same `if not exists`.
--
-- Kontext, ktery se musi vedet, nez z tech cisel nekdo neco vyvodi:
--   * `email_events` uz obsahuje typy `open` (1313 radku) a `click` (73 radku) z 22. az
--     27. 7. 2026. Jsou to data z Resend trackingu, ktery v tom okne vracel 400 na VSECHNY
--     odkazy, takze lide klikali a koncili na chybove strance. Ta data jsou HORSI NEZ ZADNA.
--     Proto ma vlastni mereni ODLISNE typy: `px_odeslano`, `px_open`, `px_click`.
--     ⛔ Nikdy je neslevat dohromady a nikdy nepsat nove udalosti pod stare nazvy.
--   * `email_events.type` nema CHECK constraint, takze novy typ projde tise. Kdo cte
--     statistiky podle typu (`email_summary`, `daily-digest`, denni strop v `drip-send`),
--     musi vedet, ze `px_*` typy existuji. Zadny z nich je dnes nezapocitava, protoze
--     vsechny filtruji na `type = 'sent'`.

-- 1) OTEVRENI SE POCITA JEN JEDNOU NA MAIL.
-- Gmail si mericí obrazek cachuje u sebe, takze druhe a dalsi otevreni k nam stejne nedojde
-- a "pocet otevreni" by lhal. Zaroven si Gmail a Apple pixel casto stahnou SAMY jeste pred
-- clovekem, takze i tohle jedno otevreni je horni odhad.
-- ⭐ Delame to UNIKATNIM INDEXEM, ne dotazem pred insertem: dedup v `resend-webhook` byl
-- select-then-insert a 23. 7. 2026 propustil ctyri radky za 378 ms.
-- Pozn.: `lead_id` muze byt NULL (mail bez leada); NULLy jsou v unikatnim indexu ruzne,
-- takze se takove radky nesloucí. Je to spravne, nemame podle ceho je spojit.
create unique index if not exists email_events_px_open_uniq
  on public.email_events (lead_id, step, (detail ->> 'track'))
  where type = 'px_open';

-- 2) CTENI PREHLEDU: admin se pta na poslednich 30 dni podle typu.
-- Bez tohohle indexu se cely `email_events` (dnes ~13 700 radku, roste) prochazi seq scanem.
create index if not exists email_events_typ_cas_idx
  on public.email_events (type, created_at desc);

-- 3) FILTR SKENERU SE DELA AZ PRI CTENI, ne pri zapisu.
-- Salva prokliku ve zlomku vteriny je hlavni znak bezpecnostniho skeneru (24. 7. 2026:
-- jeden "lead" trefil objednavku i odhlaseni behem deseti vterin, jiny dvakrat tutez
-- adresu 13 ms po sobe). Kdyby se to slucovalo pri zapisu, obrazec z dat zmizi.
-- Vyhodnocovaci logika zije v `admin-api` (akce `mail_mereni`), aby sla menit bez migrace.

-- 4) KONTROLA PO NASAZENI (jen cteni, nic nemeni):
--    select type, count(*), min(created_at), max(created_at)
--      from public.email_events where type like 'px\_%' group by 1 order by 1;
