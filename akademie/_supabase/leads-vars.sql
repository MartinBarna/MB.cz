-- ============================================================
-- leads.vars: proměnné mailu přežijí opakovaný pokus o odeslání
-- Barna Academy, 29. 7. 2026
--
-- PROČ:
-- Rozlučkový mail po refundu používá {{castka}}, {{produkt}}, {{varianta}},
-- {{znovu_odkaz}}. Nejsou to vestavěné proměnné `drip-send`, posílá je volající
-- v těle invoku. Jenže tělo invoku existuje JEN JEDNOU. Když odeslání selže
-- (výpadek Resendu, rate limit), engine posune `next_send_at` o 6 hodin a další
-- pokus jede z hodinové dávky, která žádné `vars` nezná ⇒ `unresolved_token`
-- ZNOVU, a to napořád. Po 5 pokusech se lead odstaví na `paused`.
-- Následek: člověk, kterému jsme vrátili peníze, NIKDY nedostane potvrzení,
-- a pozná se to jen z `gave_up` v datech.
--
-- ⛔ TVAR JE ZÁMĚRNĚ KLÍČOVANÝ TRATÍ, ne plochý objekt:
--   {"rozlouceni-refund-hned": {"castka": "15 Kč", ...}}
-- Plochý objekt by se stal minou: lead se časem dostane do jiné tratě (win-back,
-- upsell) a nesl by si s sebou částku z dávného refundu. Kdyby ji nějaká budoucí
-- šablona náhodou pojmenovala stejně, dosadila by se cizí hodnota a NIC by nespadlo.
-- Takhle se čte výhradně `vars -> leads.track`, takže záznam pro jinou trať
-- nemůže prosáknout ani omylem. Stará data se nemusí uklízet.
--
-- Vratnost: aditivní nullable sloupec, nic nepřepisuje, nikomu nic neposílá.
-- Rollback: alter table public.leads drop column vars;
-- ============================================================

alter table public.leads
  add column if not exists vars jsonb;

comment on column public.leads.vars is
  'Proměnné pro render mailu, klíčované NÁZVEM TRATĚ: {"<track>": {"klic": "hodnota"}}.
   Čte je drip-send jako ZÁLOHU, když je invoke nepošle v těle (typicky při opakovaném
   pokusu po chybě). Vestavěné proměnné se z tohohle sloupce nikdy nepřepíšou.';
