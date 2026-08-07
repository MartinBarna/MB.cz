-- =========================================================
-- Affiliate program: typ partnera a sazby (7. 8. 2026)
-- Navazuje na `referral-affiliate.sql` (původní schéma referralů).
--
-- ⛔ TENHLE SOUBOR SE JEŠTĚ NESPUSTIL. Píše ho Claude, nasazuje Martin/šéf po revizi.
-- Projekt: uhmrpfsdcujbhbtumqye (Barna Academy).
--
-- PROČ: dosud byl referral jen „member" (kredit v pevné částce). Přibývají
-- affiliate partneři (trenérky), kteří berou PROCENTO z ceny: 30 % z měsíčních
-- plateb, 20 % z jednorázových. Bez rozlišení typu a sazby nejde spočítat,
-- komu kolik poslat.
-- =========================================================

-- 1) Typ partnera a jeho sazby --------------------------------------
alter table public.referral_codes
  add column if not exists partner_type text not null default 'member'
    check (partner_type in ('member','affiliate')),
  add column if not exists rate_monthly numeric,   -- podíl z opakovaných plateb, např. 0.30
  add column if not exists rate_oneoff  numeric;   -- podíl z jednorázových,     např. 0.20

comment on column public.referral_codes.rate_monthly is
  'Podíl z MĚSÍČNÍCH plateb jako desetinné číslo (0.30 = 30 %). NULL u member kódů.';
comment on column public.referral_codes.rate_oneoff is
  'Podíl z JEDNORÁZOVÝCH plateb jako desetinné číslo (0.20 = 20 %). NULL u member kódů.';

-- 2) Co si o nákupu pamatujeme -------------------------------------
-- ⚠️ ŽÁDNÝ `amount_czk`. Sloupec `amount` už v tabulce JE (numeric, dnes všude null)
-- a `admin-api` ho v přehledu referralů čte. Nový sloupec by znamenal dva sloupce
-- na totéž a Martin by v adminu dál viděl prázdno. Webhook proto píše do `amount`.
alter table public.referrals
  add column if not exists partner_type text;      -- kopie typu v době nákupu

comment on column public.referrals.amount is
  'Zaplaceno v Kč (Stripe amount_total/100 u jednorázovky, amount_paid/100 u faktury). Základ provize.';
comment on column public.referrals.partner_type is
  'Typ partnera v době nákupu. Kopie schválně: sazby se můžou v čase měnit, historie ne.';

-- 2b) 🔴 UNIQUE INDEX, KTERÝ BLOKUJE OPAKOVANÉ PROVIZE (nález 7. 8. 2026) ----
-- `referrals_buyer_product_uidx` je UNIQUE na (lower(buyer_email), product), tedy
-- „jeden referral na kupujícího a produkt". To dávalo smysl, dokud byly jen
-- jednorázovky. U affiliate provizí z MĚSÍČNÍHO předplatného ale potřebujeme
-- jeden řádek ZA KAŽDOU FAKTURU, takže druhý měsíc by insert spadl na tenhle index
-- a partnerka by dostala zaplaceno jen jednou.
-- ⚠️ Idempotenci to neoslabí: `referrals_order_uidx` (unique na order_id) drží dál
--    a je přesnější, protože order_id je payment intent u jednorázovky a ID faktury
--    u předplatného. Původní pravidlo „1x na kupujícího a produkt" navíc hlídá i KÓD
--    (`duplicita-produkt` v atribuujReferral), takže jednorázová cesta se nemění.
drop index if exists public.referrals_buyer_product_uidx;

-- 3) 🔴 ROZŠÍŘENÍ CHECKU NA `product` (nález při psaní téhle migrace) ----
-- Původní `referral-affiliate.sql` povoluje POUZE 'academy' a 'videokurz'.
-- Webhook ale volá atribuci s `def.produkt` pro VŠECHNY jednorázové produkty,
-- takže u balíčku, konzultace i upgradu by insert spadl na porušení CHECKu.
-- Dnes to nebylo vidět (referrals má 0 řádků a s kódem zatím nikdo nekoupil),
-- ale affiliate partneři budou prodávat právě i tyhle produkty.
-- ⇒ Bez tohohle kroku by affiliate atribuce u poloviny katalogu TIŠE selhala
--    (spadne do try/catch a odejde jen alert).
alter table public.referrals drop constraint if exists referrals_product_check;
alter table public.referrals
  add constraint referrals_product_check
  check (product in ('academy','videokurz','balicek','konzultace'));

-- 4) Rychlé hledání podle typu partnera (výplaty se dělají po skupinách) --
create index if not exists referral_codes_partner_type_idx
  on public.referral_codes (partner_type) where partner_type = 'affiliate';

-- 5) PŘEHLED PRO VÝPLATY PARTNEREK ----------------------------------
-- ⛔⛔ ŽÁDNÝ NOVÝ SLOUPEC `commission`. Zadání ho chtělo, ale `referrals.reward_amount`
--     (numeric, not null) UŽ JE přesně to: vypočtená provize ZMRAZENÁ v okamžiku zápisu.
--     Webhook do něj počítanou provizi zapisuje v obou větvích (jednorázová i recurring),
--     takže problém „přehled by sčítal historické platby dnešní sazbou" NEEXISTUJE:
--     každý řádek si nese sazbu, která platila při jeho vzniku.
--     Nový sloupec by byl druhý sloupec na totéž, stejně jako by jím byl `amount_czk`.
--     `referral_credit` view i `admin-api` navíc `reward_amount` už čtou.
--
-- ⚠️ `referral_payouts` je vedená podle `owner_email`, ne podle kódu. Spojuje se to
--    díky tomu, že `referral_codes_owner_uidx` drží JEDEN kód na osobu.
-- ⚠️ Filtr `reward_type = 'cash'` je nosný: kdyby kód byl dřív `member` a přepnul se
--    na `affiliate`, staré řádky s kreditem se do výplat počítat NESMÍ.
create or replace view public.affiliate_prehled
with (security_invoker = on) as
select
  rc.code,
  rc.owner_email,
  rc.rate_monthly,
  rc.rate_oneoff,
  count(r.id)                                                        as referralu_celkem,
  count(r.id) filter (where r.status = 'pending')                    as referralu_pending,
  count(r.id) filter (where r.status = 'confirmed')                  as referralu_confirmed,
  -- Obrat = co zaplatili kupující. Provize = co patří partnerce.
  coalesce(sum(r.amount)        filter (where r.status = 'pending'),   0) as obrat_pending,
  coalesce(sum(r.amount)        filter (where r.status = 'confirmed'), 0) as obrat_confirmed,
  coalesce(sum(r.reward_amount) filter (where r.status = 'pending'),   0) as provize_pending,
  coalesce(sum(r.reward_amount) filter (where r.status = 'confirmed'), 0) as provize_confirmed,
  coalesce(v.vyplaceno, 0)                                               as vyplaceno,
  -- ⚠️ K výplatě je jen POTVRZENÁ provize minus už vyplacené. Pending se schválně
  --    nepočítá: je to 14denní lhůta na odstoupení, peníze ještě nejsou jisté.
  coalesce(sum(r.reward_amount) filter (where r.status = 'confirmed'), 0)
    - coalesce(v.vyplaceno, 0)                                           as k_vyplate
from public.referral_codes rc
left join public.referrals r
       on r.code = rc.code
      and r.reward_type = 'cash'
left join (
  select lower(owner_email) as owner_email, sum(amount_czk) as vyplaceno
    from public.referral_payouts
   group by lower(owner_email)
) v on v.owner_email = lower(rc.owner_email)
where rc.partner_type = 'affiliate'
group by rc.code, rc.owner_email, rc.rate_monthly, rc.rate_oneoff, v.vyplaceno;

comment on view public.affiliate_prehled is
  'Podklad pro výplaty affiliate partnerkám. Provize se sčítá z referrals.reward_amount, '
  'které je zmrazené v okamžiku zápisu, takže změna sazby nepřepočítá historii.';

-- =========================================================
-- ⬜ POZNÁMKY K NASAZENÍ (přečíst před spuštěním)
--
-- 1. Sloupce jsou `if not exists` a `partner_type` má default 'member',
--    takže stávající dva kódy zůstanou member a nic se nerozbije.
-- 2. Sazby se u affiliate kódů musí VYPLNIT ručně, jinak webhook spadne
--    zpátky na pevnou ODMENU (schválně, aby partner nedostal nulu).
--    Vzor: update public.referral_codes
--             set partner_type='affiliate', rate_monthly=0.30, rate_oneoff=0.20
--           where code='VERCA10';
-- 3. ⚠️ `referral_credit` view sčítá jen `reward_type='credit'`, takže affiliate
--    provize ('cash') se do salda členů NEPROMÍTNE. To je správně, ale znamená to,
--    že výplaty affiliate partnerům zatím NEMÁ KDE nikdo vidět. Přehled pro ně
--    je samostatná práce, není v téhle migraci.
-- 4. ⚠️ `admin-api` (`referrals_overview`) vybírá sloupce VÝČTEM a `amount_czk`
--    ani `partner_type` v něm nejsou. Dokud se tam nedoplní, Martin ta čísla
--    v adminu neuvidí. Jeden řádek, ale je mimo rozsah téhle změny.
-- =========================================================
