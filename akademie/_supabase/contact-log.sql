-- ============================================================
-- Barna Academy — contact_messages: log webových kontaktních formulářů
-- Spustit v Supabase SQL editoru. Bezpečné/idempotentní.
-- Zapisuje edge fn contact-send (jen on-site submise), čte admin-api (akce contact_messages).
-- Admin panel: /akademie/admin/ → sekce „Formuláře" (relevantní / potenciální spam).
-- ============================================================

create table if not exists public.contact_messages (
  id          bigint generated always as identity primary key,
  name        text not null default '',
  email       text not null default '',
  message     text not null default '',
  spam        boolean not null default false,   -- tripnul honeypot/časovou past/validaci polí
  spam_reason text not null default '',          -- čárkou oddělené důvody (proč spam)
  origin      text,                              -- Origin hlavička submise
  created_at  timestamptz not null default now()
);
create index if not exists contact_messages_created_idx on public.contact_messages (created_at desc);
create index if not exists contact_messages_spam_idx on public.contact_messages (spam, created_at desc);

-- RLS on, žádná policy → přístup jen přes service_role uvnitř edge funkcí (žádný anon/authenticated).
alter table public.contact_messages enable row level security;

-- POZN.: off-site boti (POST napřímo s cizím/chybějícím Originem) se NELOGUJÍ — jinak by
--        endpoint šel zaplavit řádky. Logujeme jen submise z webu (origin martinbarna.cz);
--        „potenciální spam" = z webu, ale tripnul honeypot / časovou past / validaci.
