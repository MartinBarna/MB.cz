-- ============================================================
-- CRM vrstva (fáze 1a): crm_refresh_from_academy()
-- ------------------------------------------------------------
-- SECURITY DEFINER, jen SELECT ze zdrojových tabulek + upsert do crm_*.
-- Žádný UPDATE/DELETE do leads, customer_contacts, entitlements, profiles.
--
-- ⛔ TENTO SOUBOR NEAPLIKUJ na živou DB z agenta. Viz README-CRM.md.
--
-- Signatura (NESMĚŇ bez DROP FUNCTION): 
--   public.crm_refresh_from_academy() RETURNS jsonb
-- create or replace function NEUMÍ změnit argumenty ani návratový typ.
-- search_path: pg_temp první, ať DROP/INSERT temp tabulek nesahá do public.
-- ============================================================

create or replace function public.crm_refresh_from_academy()
returns jsonb
language plpgsql
security definer
set search_path to pg_temp, public
as $crm$
declare
  v_union_four integer;
  v_leads integer;
begin
  -- ----------------------------------------------------------
  -- A) Sjednocení e-mailů ze všech zdrojových tabulek fáze 1
  -- ----------------------------------------------------------
  drop table if exists pg_temp._crm_src_emails;
  create temp table _crm_src_emails (
    email_norm text primary key,
    email_raw  text not null,
    is_test    boolean not null
  ) on commit drop;

  insert into pg_temp._crm_src_emails (email_norm, email_raw, is_test)
  select public.crm_norm_email(x.email) as email_norm,
         (array_agg(x.email order by length(x.email) desc))[1] as email_raw,
         bool_or(public.crm_is_test_email(x.email)) as is_test
    from (
      select email from public.leads
      union all
      select email from public.customer_contacts
      union all
      select email from public.entitlements
      union all
      select email from public.profiles
      union all
      select email from public.client_reports
      union all
      select email from public.client_intake
      union all
      select email from public.client_targets
      union all
      select email from public.contact_messages
      union all
      select email from public.tvujcoach_grants
      union all
      select owner_email from public.referral_codes
    ) x
   where public.crm_norm_email(x.email) is not null
   group by 1;

  -- Osoby: auto-merge JEN přes shodu lower(email). Když už identifikátor
  -- existuje, osobu nezakládáme (i kdyby primary_email na merged řádku visel).
  insert into public.crm_persons (primary_email, is_test, status, lifecycle)
  select e.email_norm::citext, e.is_test, 'active', 'unknown'
    from pg_temp._crm_src_emails e
   where not exists (
           select 1 from public.crm_identifiers i
            where i.kind = 'email' and i.value_normalized = e.email_norm
         )
     and not exists (
           select 1 from public.crm_persons p
            where p.status = 'active'
              and lower(p.primary_email::text) = e.email_norm
         );

  -- Identifikátor e-mailu. ON CONFLICT drží existující person_id
  -- (ruční merge se nepřepisuje).
  insert into public.crm_identifiers (
    person_id, kind, value_normalized, value_raw, source,
    first_seen_at, last_seen_at, confidence
  )
  select p.id, 'email', e.email_norm, e.email_raw, 'crm_refresh',
         now(), now(), 'hard'
    from pg_temp._crm_src_emails e
    join public.crm_persons p
      on p.status = 'active'
     and lower(p.primary_email::text) = e.email_norm
  on conflict (kind, value_normalized) do update
    set last_seen_at = now(),
        value_raw = coalesce(nullif(excluded.value_raw, ''), public.crm_identifiers.value_raw);

  -- Doplnit identifikátor i tam, kde osoba vznikla dřív přes jiný zdroj
  -- a primary_email už nesedí 1:1 (merged_into následovat). DISTINCT ON
  -- kvůli tomu, že merged poražený může mít pořád stejný primary_email
  -- a jeden INSERT nesmí udeřit tentýž unikát dvakrát.
  insert into public.crm_identifiers (
    person_id, kind, value_normalized, value_raw, source,
    first_seen_at, last_seen_at, confidence
  )
  select distinct on (e.email_norm)
         case
           when p.status = 'active' then p.id
           else coalesce(p.merged_into_id, p.id)
         end,
         'email', e.email_norm, e.email_raw,
         'crm_refresh', now(), now(), 'hard'
    from pg_temp._crm_src_emails e
    join public.crm_persons p
      on lower(p.primary_email::text) = e.email_norm
   where not exists (
           select 1 from public.crm_identifiers i
            where i.kind = 'email' and i.value_normalized = e.email_norm
         )
   order by e.email_norm, case when p.status = 'active' then 0 else 1 end
  on conflict (kind, value_normalized) do update
    set last_seen_at = now();

  update public.crm_identifiers i
     set last_seen_at = now()
    from pg_temp._crm_src_emails e
   where i.kind = 'email'
     and i.value_normalized = e.email_norm;

  -- is_test přepočítat z aktuálních e-mailových identit (ne z prázdna).
  update public.crm_persons p
     set is_test = exists (
           select 1 from public.crm_identifiers i
            where i.person_id = p.id
              and i.kind = 'email'
              and public.crm_is_test_email(i.value_normalized)
         ),
         updated_at = now()
   where p.status = 'active';

  -- Pomocný pohled: aktivní osoba k e-mailu (merged_into řetěz max 5 kroků).
  drop table if exists pg_temp._crm_email_person;
  create temp table _crm_email_person (
    email_norm text primary key,
    person_id  uuid not null
  ) on commit drop;

  insert into pg_temp._crm_email_person (email_norm, person_id)
  select i.value_normalized,
         case
           when p0.status = 'active' then p0.id
           when p1.status = 'active' then p1.id
           when p2.status = 'active' then p2.id
           when p3.status = 'active' then p3.id
           when p4.status = 'active' then p4.id
           else coalesce(p0.merged_into_id, p0.id)
         end
    from public.crm_identifiers i
    join public.crm_persons p0 on p0.id = i.person_id
    left join public.crm_persons p1 on p1.id = p0.merged_into_id
    left join public.crm_persons p2 on p2.id = p1.merged_into_id
    left join public.crm_persons p3 on p3.id = p2.merged_into_id
    left join public.crm_persons p4 on p4.id = p3.merged_into_id
   where i.kind = 'email';

  create index on pg_temp._crm_email_person (person_id);


  -- ----------------------------------------------------------
  -- B) Source links (idempotentní upsert, person_id se při konfliktu
  --    NEMĚNÍ, ať ruční merge přežije další synk)
  -- ----------------------------------------------------------
  insert into public.crm_source_links (person_id, source_system, source_pk, last_synced_at)
  select ep.person_id, 'leads', l.id::text, now()
    from public.leads l
    join pg_temp._crm_email_person ep on ep.email_norm = public.crm_norm_email(l.email)
  on conflict (source_system, source_pk) do update
    set last_synced_at = now();

  insert into public.crm_source_links (person_id, source_system, source_pk, last_synced_at)
  select ep.person_id, 'customer_contacts', public.crm_norm_email(c.email), now()
    from public.customer_contacts c
    join pg_temp._crm_email_person ep on ep.email_norm = public.crm_norm_email(c.email)
  on conflict (source_system, source_pk) do update
    set last_synced_at = now();

  insert into public.crm_source_links (person_id, source_system, source_pk, last_synced_at)
  select ep.person_id, 'entitlements',
         public.crm_norm_email(e.email) || ':' || e.product, now()
    from public.entitlements e
    join pg_temp._crm_email_person ep on ep.email_norm = public.crm_norm_email(e.email)
  on conflict (source_system, source_pk) do update
    set last_synced_at = now();

  insert into public.crm_source_links (person_id, source_system, source_pk, last_synced_at)
  select ep.person_id, 'academy_profiles', pr.id::text, now()
    from public.profiles pr
    join pg_temp._crm_email_person ep on ep.email_norm = public.crm_norm_email(pr.email)
  on conflict (source_system, source_pk) do update
    set last_synced_at = now();

  insert into public.crm_source_links (person_id, source_system, source_pk, last_synced_at)
  select ep.person_id, 'client_reports',
         public.crm_norm_email(r.email) || ':' || r.report_date::text, now()
    from public.client_reports r
    join pg_temp._crm_email_person ep on ep.email_norm = public.crm_norm_email(r.email)
  on conflict (source_system, source_pk) do update
    set last_synced_at = now();

  insert into public.crm_source_links (person_id, source_system, source_pk, last_synced_at)
  select ep.person_id, 'client_intake',
         public.crm_norm_email(i.email) || ':' || coalesce(i.created_at::text, 'na'), now()
    from public.client_intake i
    join pg_temp._crm_email_person ep on ep.email_norm = public.crm_norm_email(i.email)
  on conflict (source_system, source_pk) do update
    set last_synced_at = now();

  insert into public.crm_source_links (person_id, source_system, source_pk, last_synced_at)
  select ep.person_id, 'client_targets', public.crm_norm_email(t.email), now()
    from public.client_targets t
    join pg_temp._crm_email_person ep on ep.email_norm = public.crm_norm_email(t.email)
  on conflict (source_system, source_pk) do update
    set last_synced_at = now();

  insert into public.crm_source_links (person_id, source_system, source_pk, last_synced_at)
  select ep.person_id, 'contact_messages', m.id::text, now()
    from public.contact_messages m
    join pg_temp._crm_email_person ep on ep.email_norm = public.crm_norm_email(m.email)
  on conflict (source_system, source_pk) do update
    set last_synced_at = now();

  insert into public.crm_source_links (person_id, source_system, source_pk, last_synced_at)
  select ep.person_id, 'tvujcoach_grants',
         public.crm_norm_email(g.email) || '|' || coalesce(g.action, '') || '|' ||
         coalesce(g.source, '') || '|' || coalesce(g.created_at::text, ''), now()
    from public.tvujcoach_grants g
    join pg_temp._crm_email_person ep on ep.email_norm = public.crm_norm_email(g.email)
  on conflict (source_system, source_pk) do update
    set last_synced_at = now();

  insert into public.crm_source_links (person_id, source_system, source_pk, last_synced_at)
  select ep.person_id, 'referral_codes', rc.code, now()
    from public.referral_codes rc
    join pg_temp._crm_email_person ep on ep.email_norm = public.crm_norm_email(rc.owner_email)
  on conflict (source_system, source_pk) do update
    set last_synced_at = now();


  -- ----------------------------------------------------------
  -- C) Identifikátory: telefon z leads, academy_user_id z profiles
  --    Telefon NEsjednocuje osoby (auto-merge jen e-mail).
  -- ----------------------------------------------------------
  insert into public.crm_identifiers (
    person_id, kind, value_normalized, value_raw, source,
    first_seen_at, last_seen_at, confidence
  )
  select ep.person_id, 'phone', trim(l.phone), l.phone, 'leads',
         coalesce(l.created_at, now()), now(), 'hard'
    from public.leads l
    join pg_temp._crm_email_person ep on ep.email_norm = public.crm_norm_email(l.email)
   where nullif(trim(l.phone), '') is not null
  on conflict (kind, value_normalized) do update
    set last_seen_at = now();

  insert into public.crm_identifiers (
    person_id, kind, value_normalized, value_raw, source,
    first_seen_at, last_seen_at, confidence
  )
  select ep.person_id, 'academy_user_id', pr.id::text, pr.id::text, 'academy_profiles',
         coalesce(pr.created_at, now()), now(), 'hard'
    from public.profiles pr
    join pg_temp._crm_email_person ep on ep.email_norm = public.crm_norm_email(pr.email)
  on conflict (kind, value_normalized) do update
    set last_seen_at = now();

  update public.crm_persons p
     set academy_user_id = pr.id,
         updated_at = now()
    from public.profiles pr
    join pg_temp._crm_email_person ep on ep.email_norm = public.crm_norm_email(pr.email)
   where p.id = ep.person_id
     and p.status = 'active'
     and (p.academy_user_id is null or p.academy_user_id = pr.id);

  update public.crm_persons p
     set primary_phone = trim(l.phone),
         updated_at = now()
    from public.leads l
    join pg_temp._crm_email_person ep on ep.email_norm = public.crm_norm_email(l.email)
   where p.id = ep.person_id
     and p.status = 'active'
     and p.primary_phone is null
     and nullif(trim(l.phone), '') is not null
     and not exists (
           select 1 from public.crm_persons x
            where x.status = 'active'
              and x.primary_phone = trim(l.phone)
              and x.id <> p.id
         );


  -- ----------------------------------------------------------
  -- D) Atributy. purchased se ignoruje. Prázdná hodnota se nevloží.
  --    Stejný zdroj+source_pk při změně hodnoty: starý řádek superseded.
  -- ----------------------------------------------------------
  drop table if exists pg_temp._crm_attr_in;
  create temp table _crm_attr_in (
    person_id    uuid not null,
    key          text not null,
    value        jsonb not null,
    source       text not null,
    source_pk    text,
    observed_at  timestamptz not null,
    confidence   text not null
  ) on commit drop;

  -- jméno: customer_contacts (nejlepší pokrytí) / profiles / leads
  insert into pg_temp._crm_attr_in
  select ep.person_id, 'name', to_jsonb(trim(c.name)), 'customer_contacts',
         public.crm_norm_email(c.email), coalesce(c.updated_at, c.created_at, now()), 'high'
    from public.customer_contacts c
    join pg_temp._crm_email_person ep on ep.email_norm = public.crm_norm_email(c.email)
   where nullif(trim(c.name), '') is not null;

  insert into pg_temp._crm_attr_in
  select ep.person_id, 'name', to_jsonb(trim(pr.full_name)), 'academy_profiles',
         pr.id::text, coalesce(pr.created_at, now()), 'medium'
    from public.profiles pr
    join pg_temp._crm_email_person ep on ep.email_norm = public.crm_norm_email(pr.email)
   where nullif(trim(pr.full_name), '') is not null;

  insert into pg_temp._crm_attr_in
  select ep.person_id, 'name', to_jsonb(trim(l.name)), 'leads',
         l.id::text, coalesce(l.updated_at, l.created_at, now()), 'medium'
    from public.leads l
    join pg_temp._crm_email_person ep on ep.email_norm = public.crm_norm_email(l.email)
   where nullif(trim(l.name), '') is not null;

  -- pohlaví z leads.segment, 'other' se nebere (často „nevíme“)
  insert into pg_temp._crm_attr_in
  select ep.person_id, 'sex', to_jsonb(l.segment), 'leads',
         l.id::text, coalesce(l.updated_at, l.created_at, now()), 'medium'
    from public.leads l
    join pg_temp._crm_email_person ep on ep.email_norm = public.crm_norm_email(l.email)
   where l.segment in ('zeny', 'muzi');

  -- cíl, věk, UTM z leads.meta (kvíz je nejhustší zdroj)
  insert into pg_temp._crm_attr_in
  select ep.person_id, k.key, to_jsonb(k.val), 'leads',
         l.id::text, coalesce(l.updated_at, l.created_at, now()), 'medium'
    from public.leads l
    join pg_temp._crm_email_person ep on ep.email_norm = public.crm_norm_email(l.email)
    cross join lateral (
      values
        ('goal',         l.meta->>'goal'),
        ('age',          l.meta->>'age'),
        ('utm_source',   l.meta->>'utm_source'),
        ('utm_medium',   l.meta->>'utm_medium'),
        ('utm_campaign', l.meta->>'utm_campaign'),
        ('utm_content',  l.meta->>'utm_content'),
        ('utm_term',     l.meta->>'utm_term'),
        ('utm_id',       l.meta->>'utm_id'),
        ('fbclid',       l.meta->>'fbclid')
    ) as k(key, val)
   where nullif(trim(k.val), '') is not null;

  insert into pg_temp._crm_attr_in
  select ep.person_id, 'lead_source', to_jsonb(l.source), 'leads',
         l.id::text, coalesce(l.created_at, now()), 'high'
    from public.leads l
    join pg_temp._crm_email_person ep on ep.email_norm = public.crm_norm_email(l.email)
   where nullif(trim(l.source), '') is not null;

  insert into pg_temp._crm_attr_in
  select ep.person_id, 'cc_source', to_jsonb(c.source), 'customer_contacts',
         public.crm_norm_email(c.email), coalesce(c.created_at, now()), 'high'
    from public.customer_contacts c
    join pg_temp._crm_email_person ep on ep.email_norm = public.crm_norm_email(c.email)
   where nullif(trim(c.source), '') is not null;

  -- UTM: nová kampaň = další aktuální atribut, prázdno staré nemaže
  -- (prázdno sem vůbec nepřijde). Stejný source+source_pk+key+value = skip.
  update public.crm_attributes a
     set superseded_at = now()
    from pg_temp._crm_attr_in n
   where a.person_id = n.person_id
     and a.key = n.key
     and a.source = n.source
     and a.source_pk is not distinct from n.source_pk
     and a.superseded_at is null
     and a.value is distinct from n.value
     and n.key not in ('utm_source', 'utm_medium', 'utm_campaign',
                       'utm_content', 'utm_term', 'utm_id', 'fbclid');

  insert into public.crm_attributes (
    person_id, key, value, source, source_pk, observed_at, confidence
  )
  select n.person_id, n.key, n.value, n.source, n.source_pk, n.observed_at, n.confidence
    from pg_temp._crm_attr_in n
   where not exists (
           select 1 from public.crm_attributes a
            where a.person_id = n.person_id
              and a.key = n.key
              and a.source = n.source
              and a.source_pk is not distinct from n.source_pk
              and a.superseded_at is null
              and a.value is not distinct from n.value
         );

  -- display_name: vítěz podle priority, prázdné nepřepíše plné
  update public.crm_persons p
     set display_name = coalesce((
           select a.value #>> '{}'
             from public.crm_attributes a
            where a.person_id = p.id
              and a.key = 'name'
              and a.superseded_at is null
              and nullif(a.value #>> '{}', '') is not null
            order by case a.source
                       when 'admin' then 0
                       when 'customer_contacts' then 1
                       when 'academy_profiles' then 2
                       when 'leads' then 3
                       else 8
                     end,
                     a.observed_at desc nulls last
            limit 1
         ), p.display_name),
         updated_at = now()
   where p.status = 'active';


  -- ----------------------------------------------------------
  -- E) Tagy: snapshot z customer_contacts.tags + CRM tagy
  -- ----------------------------------------------------------
  insert into public.crm_tags (person_id, tag, source, attached_at)
  select ep.person_id, trim(x), 'customer_contacts',
         coalesce(c.updated_at, c.created_at, now())
    from public.customer_contacts c
    join pg_temp._crm_email_person ep on ep.email_norm = public.crm_norm_email(c.email)
    cross join lateral unnest(coalesce(c.tags, array[]::text[])) as x
   where nullif(trim(x), '') is not null
  on conflict (person_id, tag) where detached_at is null do nothing;

  -- ss-import-do-not-mail: CC mimo leads (očekávaně 395 k datu inventury).
  -- Predikát necháváme širší (mimo mailingovou frontu). Není to A9:
  -- cc_only v JSON = CC mimo leads i entitlements i profiles (= 388).
  -- Tag a cc_only se kontrolují zvlášť.
  insert into public.crm_tags (person_id, tag, source, attached_at)
  select ep.person_id, 'ss-import-do-not-mail', 'crm_refresh', now()
    from public.customer_contacts c
    join pg_temp._crm_email_person ep on ep.email_norm = public.crm_norm_email(c.email)
   where not exists (
           select 1 from public.leads l
            where public.crm_norm_email(l.email) = public.crm_norm_email(c.email)
         )
  on conflict (person_id, tag) where detached_at is null do nothing;

  update public.crm_tags t
     set detached_at = now()
   where t.tag = 'ss-import-do-not-mail'
     and t.detached_at is null
     and exists (
           select 1
             from public.crm_identifiers i
             join public.leads l
               on public.crm_norm_email(l.email) = i.value_normalized
            where i.person_id = t.person_id
              and i.kind = 'email'
         );

  -- has-videokurz z živých entitlements (ne z leads.purchased)
  insert into public.crm_tags (person_id, tag, source, attached_at)
  select distinct ep.person_id, 'has-videokurz', 'entitlements', now()
    from public.entitlements e
    join pg_temp._crm_email_person ep on ep.email_norm = public.crm_norm_email(e.email)
   where e.product = 'videokurz' and e.active is true
  on conflict (person_id, tag) where detached_at is null do nothing;

  update public.crm_tags t
     set detached_at = now()
   where t.tag = 'has-videokurz'
     and t.detached_at is null
     and not exists (
           select 1
             from public.crm_identifiers i
             join public.entitlements e
               on public.crm_norm_email(e.email) = i.value_normalized
            where i.person_id = t.person_id
              and i.kind = 'email'
              and e.product = 'videokurz'
              and e.active is true
         );


  -- ----------------------------------------------------------
  -- F) Souhlasy. Odhlášení v leads vyhrává nad consent=true.
  --    Bounce není odvolání souhlasu (mrtvá schránka, řeší status).
  -- ----------------------------------------------------------
  insert into public.crm_consents (
    person_id, channel, purpose, legal_basis, state, source,
    granted_at, withdrawn_at, evidence
  )
  select ep.person_id, 'email', 'marketing', 'consent',
         case
           when l.status = 'unsubscribed' then 'withdrawn'
           when coalesce(l.consent, false) then 'granted'
           else 'unknown'
         end,
         'leads',
         case when l.status is distinct from 'unsubscribed' and coalesce(l.consent, false)
              then coalesce(l.created_at, now()) end,
         case when l.status = 'unsubscribed' then coalesce(l.updated_at, now()) end,
         jsonb_build_object('lead_status', l.status, 'consent_flag', l.consent)
    from public.leads l
    join pg_temp._crm_email_person ep on ep.email_norm = public.crm_norm_email(l.email)
  on conflict (person_id, channel, purpose, source) do update
    set state = excluded.state,
        granted_at = coalesce(public.crm_consents.granted_at, excluded.granted_at),
        withdrawn_at = excluded.withdrawn_at,
        evidence = excluded.evidence;

  insert into public.crm_consents (
    person_id, channel, purpose, legal_basis, state, source,
    granted_at, withdrawn_at, evidence
  )
  select ep.person_id, 'email', 'marketing',
         case when c.consent_basis = 'smlouva' then 'contract'
              else 'legitimate_interest' end,
         case when c.unsubscribed_at is not null then 'withdrawn' else 'granted' end,
         'customer_contacts',
         coalesce(c.created_at, now()),
         c.unsubscribed_at,
         jsonb_build_object('consent_basis', c.consent_basis)
    from public.customer_contacts c
    join pg_temp._crm_email_person ep on ep.email_norm = public.crm_norm_email(c.email)
  on conflict (person_id, channel, purpose, source) do update
    set legal_basis = excluded.legal_basis,
        state = excluded.state,
        withdrawn_at = excluded.withdrawn_at,
        evidence = excluded.evidence;


  -- ----------------------------------------------------------
  -- G) Interakce (insert-only podle external_id)
  -- ----------------------------------------------------------
  insert into public.crm_interactions (
    person_id, channel, kind, occurred_at, source, source_pk, payload, external_id
  )
  select ep.person_id, 'email', 'sent', ev.created_at, 'email_events', ev.id::text,
         jsonb_build_object(
           'step', ev.step,
           'track', ev.detail->>'track'
         ),
         'email_events:' || ev.id::text
    from public.email_events ev
    join public.leads l on l.id = ev.lead_id
    join pg_temp._crm_email_person ep on ep.email_norm = public.crm_norm_email(l.email)
   where ev.type = 'sent'
  on conflict (channel, external_id) where external_id is not null do nothing;

  insert into public.crm_interactions (
    person_id, channel, kind, occurred_at, source, source_pk, payload, external_id
  )
  select ep.person_id, 'coaching', 'report',
         coalesce(r.report_date::timestamptz, now()),
         'client_reports',
         public.crm_norm_email(r.email) || ':' || r.report_date::text,
         jsonb_build_object('report_date', r.report_date, 'origin', r.source),
         'client_reports:' || public.crm_norm_email(r.email) || ':' || r.report_date::text
    from public.client_reports r
    join pg_temp._crm_email_person ep on ep.email_norm = public.crm_norm_email(r.email)
  on conflict (channel, external_id) where external_id is not null do nothing;

  insert into public.crm_interactions (
    person_id, channel, kind, occurred_at, source, source_pk, payload, external_id
  )
  select ep.person_id, 'coaching', 'checkin',
         coalesce(i.created_at, now()),
         'client_intake',
         public.crm_norm_email(i.email) || ':' || coalesce(i.created_at::text, 'na'),
         jsonb_build_object('kind', 'intake'),
         'client_intake:' || public.crm_norm_email(i.email) || ':' || coalesce(i.created_at::text, 'na')
    from public.client_intake i
    join pg_temp._crm_email_person ep on ep.email_norm = public.crm_norm_email(i.email)
  on conflict (channel, external_id) where external_id is not null do nothing;

  insert into public.crm_interactions (
    person_id, channel, kind, occurred_at, source, source_pk, payload, external_id
  )
  select ep.person_id, 'coaching', 'checkin',
         coalesce(t.updated_at, now()),
         'client_targets',
         public.crm_norm_email(t.email),
         jsonb_build_object('kind', 'targets'),
         'client_targets:' || public.crm_norm_email(t.email)
    from public.client_targets t
    join pg_temp._crm_email_person ep on ep.email_norm = public.crm_norm_email(t.email)
  on conflict (channel, external_id) where external_id is not null do nothing;

  insert into public.crm_interactions (
    person_id, channel, kind, occurred_at, source, source_pk, payload, external_id
  )
  select ep.person_id, 'form', 'thread_summary', m.created_at, 'contact_messages',
         m.id::text,
         jsonb_build_object('spam', m.spam),
         'contact_messages:' || m.id::text
    from public.contact_messages m
    join pg_temp._crm_email_person ep on ep.email_norm = public.crm_norm_email(m.email)
  on conflict (channel, external_id) where external_id is not null do nothing;

  insert into public.crm_interactions (
    person_id, channel, kind, occurred_at, source, source_pk, payload, external_id
  )
  select ep.person_id, 'app', 'grant',
         coalesce(g.created_at, now()),
         'tvujcoach_grants',
         public.crm_norm_email(g.email) || '|' || coalesce(g.action, '') || '|' ||
         coalesce(g.source, '') || '|' || coalesce(g.created_at::text, ''),
         jsonb_build_object(
           'action', g.action,
           'result', g.result,
           'origin', g.source
         ),
         'tvujcoach_grants:' || public.crm_norm_email(g.email) || '|' ||
         coalesce(g.action, '') || '|' || coalesce(g.source, '') || '|' ||
         coalesce(g.created_at::text, '')
    from public.tvujcoach_grants g
    join pg_temp._crm_email_person ep on ep.email_norm = public.crm_norm_email(g.email)
  on conflict (channel, external_id) where external_id is not null do nothing;


  -- ----------------------------------------------------------
  -- H) lifecycle (denormalizace, ne zdroj pravdy o nákupu)
  -- Priorita: coaching-active, coaching-ex, lead-only (jen leads
  -- bez cc/ent/profiles), živé signály (has_ent / has_academy /
  -- has_prof) PŘED customer-historical, pak cc mimo leads bez
  -- živého nároku, pak cc+leads bez nároku, lead-only fallback, other.
  -- ----------------------------------------------------------
  update public.crm_persons p
     set lifecycle = s.lifecycle,
         updated_at = now()
    from (
      select p2.id,
             case
               when exists (
                 select 1 from public.crm_tags t
                  where t.person_id = p2.id and t.tag = 'coaching-active'
                    and t.detached_at is null
               ) then 'coaching-active'
               when exists (
                 select 1 from public.crm_tags t
                  where t.person_id = p2.id and t.tag = 'coaching-ex'
                    and t.detached_at is null
               ) then 'coaching-ex'
               when has_leads and not has_cc and not has_ent and not has_prof
                 then 'lead-only'
               when has_leads and has_cc and has_ent
                 then 'customer-and-lead'
               when has_academy or has_prof
                 then 'member-academy'
               when has_leads and has_ent
                 then 'customer-and-lead'
               when has_ent
                 then 'customer-and-lead'
               when has_cc and not has_leads
                 then 'customer-historical'
               when has_leads and has_cc
                 then 'customer-and-lead'
               when has_leads
                 then 'lead-only'
               else 'other'
             end as lifecycle
        from public.crm_persons p2
        cross join lateral (
          select
            exists (select 1 from public.crm_source_links sl
                     where sl.person_id = p2.id and sl.source_system = 'leads') as has_leads,
            exists (select 1 from public.crm_source_links sl
                     where sl.person_id = p2.id and sl.source_system = 'customer_contacts') as has_cc,
            exists (select 1 from public.crm_source_links sl
                     where sl.person_id = p2.id and sl.source_system = 'entitlements') as has_ent,
            exists (select 1 from public.crm_source_links sl
                     where sl.person_id = p2.id and sl.source_system = 'academy_profiles') as has_prof,
            exists (
              select 1 from public.crm_identifiers i
              join public.entitlements e
                on public.crm_norm_email(e.email) = i.value_normalized
               where i.person_id = p2.id and i.kind = 'email'
                 and e.product = 'academy' and e.active is true
            ) as has_academy
        ) f
       where p2.status = 'active'
    ) s
   where p.id = s.id
     and p.status = 'active';

  -- primary_email: aktivní trať, jinak entitlements, jinak nejstarší identita
  update public.crm_persons p
     set primary_email = (
           select i.value_normalized::citext
             from public.crm_identifiers i
            where i.person_id = p.id and i.kind = 'email'
            order by
              case when exists (
                select 1 from public.leads l
                 where public.crm_norm_email(l.email) = i.value_normalized
                   and l.status = 'active'
              ) then 0 else 1 end,
              case when exists (
                select 1 from public.entitlements e
                 where public.crm_norm_email(e.email) = i.value_normalized
                   and e.active is true
              ) then 0 else 1 end,
              i.first_seen_at asc
            limit 1
         ),
         updated_at = now()
   where p.status = 'active';


  -- ----------------------------------------------------------
  -- I) Shrnutí (čísla pro README / ruční ověření)
  -- ----------------------------------------------------------
  select count(*) into v_leads from public.leads;

  select count(*) into v_union_four
    from (
      select public.crm_norm_email(email) from public.leads
       where public.crm_norm_email(email) is not null
      union
      select public.crm_norm_email(email) from public.customer_contacts
       where public.crm_norm_email(email) is not null
      union
      select public.crm_norm_email(email) from public.entitlements
       where public.crm_norm_email(email) is not null
      union
      select public.crm_norm_email(email) from public.profiles
       where public.crm_norm_email(email) is not null
    ) u;

  return jsonb_build_object(
    'ok', true,
    'persons_active', (select count(*) from public.crm_persons where status = 'active'),
    'persons_merged', (select count(*) from public.crm_persons where status = 'merged'),
    'union_four_emails', v_union_four,
    'leads_count', v_leads,
    'source_links', (select count(*) from public.crm_source_links),
    'identifiers', (select count(*) from public.crm_identifiers),
    'ss_import_do_not_mail', (
      select count(*) from public.crm_tags
       where tag = 'ss-import-do-not-mail' and detached_at is null
    ),
    'is_test', (
      select count(*) from public.crm_persons
       where status = 'active' and is_test
    ),
    'intersections', jsonb_build_object(
      'leads_n_cc', (
        select count(*) from (
          select public.crm_norm_email(email) from public.leads
           where public.crm_norm_email(email) is not null
          intersect
          select public.crm_norm_email(email) from public.customer_contacts
           where public.crm_norm_email(email) is not null
        ) x
      ),
      'leads_n_entitlements', (
        select count(*) from (
          select public.crm_norm_email(email) from public.leads
           where public.crm_norm_email(email) is not null
          intersect
          select public.crm_norm_email(email) from public.entitlements
           where public.crm_norm_email(email) is not null
        ) x
      ),
      'cc_n_entitlements', (
        select count(*) from (
          select public.crm_norm_email(email) from public.customer_contacts
           where public.crm_norm_email(email) is not null
          intersect
          select public.crm_norm_email(email) from public.entitlements
           where public.crm_norm_email(email) is not null
        ) x
      ),
      'leads_n_cc_n_entitlements', (
        select count(*) from (
          select public.crm_norm_email(email) from public.leads
           where public.crm_norm_email(email) is not null
          intersect
          select public.crm_norm_email(email) from public.customer_contacts
           where public.crm_norm_email(email) is not null
          intersect
          select public.crm_norm_email(email) from public.entitlements
           where public.crm_norm_email(email) is not null
        ) x
      ),
      'leads_n_profiles', (
        select count(*) from (
          select public.crm_norm_email(email) from public.leads
           where public.crm_norm_email(email) is not null
          intersect
          select public.crm_norm_email(email) from public.profiles
           where public.crm_norm_email(email) is not null
        ) x
      ),
      'cc_n_profiles', (
        select count(*) from (
          select public.crm_norm_email(email) from public.customer_contacts
           where public.crm_norm_email(email) is not null
          intersect
          select public.crm_norm_email(email) from public.profiles
           where public.crm_norm_email(email) is not null
        ) x
      ),
      'profiles_n_entitlements', (
        select count(*) from (
          select public.crm_norm_email(email) from public.profiles
           where public.crm_norm_email(email) is not null
          intersect
          select public.crm_norm_email(email) from public.entitlements
           where public.crm_norm_email(email) is not null
        ) x
      ),
      'leads_only', (
        select count(*) from (
          select public.crm_norm_email(email) from public.leads
           where public.crm_norm_email(email) is not null
          except
          select public.crm_norm_email(email) from public.customer_contacts
           where public.crm_norm_email(email) is not null
          except
          select public.crm_norm_email(email) from public.entitlements
           where public.crm_norm_email(email) is not null
          except
          select public.crm_norm_email(email) from public.profiles
           where public.crm_norm_email(email) is not null
        ) x
      ),
      'cc_only', (
        select count(*) from (
          select public.crm_norm_email(email) from public.customer_contacts
           where public.crm_norm_email(email) is not null
          except
          select public.crm_norm_email(email) from public.leads
           where public.crm_norm_email(email) is not null
          except
          select public.crm_norm_email(email) from public.entitlements
           where public.crm_norm_email(email) is not null
          except
          select public.crm_norm_email(email) from public.profiles
           where public.crm_norm_email(email) is not null
        ) x
      )
    )
  );
end;
$crm$;

comment on function public.crm_refresh_from_academy() is
  'Denní synk Academy tabulek do crm_*. Jen SELECT ze zdrojů. purchased ignoruje. Auto-merge jen lower(email).';

revoke all on function public.crm_refresh_from_academy() from public, anon, authenticated;
grant execute on function public.crm_refresh_from_academy() to postgres, service_role;
