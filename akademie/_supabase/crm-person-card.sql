-- ============================================================
-- CRM vrstva (fáze 1a): pohled crm_person_card
-- ------------------------------------------------------------
-- Jedna karta člověka: osoba + aktuální atributy + tagy + živé
-- produkty z entitlements + stav leads + souhlasy.
-- Pravda o nákupu se čte ŽIVĚ z entitlements, ne z crm_*.
-- Pravda o trati se čte ŽIVĚ z leads.
--
-- security_invoker = true: pohled nedědí práva vlastníka. Bez toho
-- by SELECT na pohled obešel RLS a vytekl by celý adresář.
-- ⛔ NEAPLIKUJ z agenta. Viz README-CRM.md.
-- ============================================================

drop view if exists public.crm_person_card;

create view public.crm_person_card
with (security_invoker = true)
as
select
  p.id,
  p.display_name,
  p.primary_email,
  p.primary_phone,
  p.academy_user_id,
  p.app_user_id,
  p.lifecycle,
  p.is_test,
  p.status,
  p.created_at,
  p.updated_at,
  coalesce(w.attrs, '{}'::jsonb) as attrs,
  coalesce(u.utm, '[]'::jsonb) as utm,
  coalesce(tg.tags, array[]::text[]) as tags,
  coalesce(tg.ss_import_do_not_mail, false) as ss_import_do_not_mail,
  coalesce(en.products, '[]'::jsonb) as products,
  coalesce(ld.leads, '[]'::jsonb) as leads,
  coalesce(cs.consents, '[]'::jsonb) as consents
from public.crm_persons p
left join lateral (
  select jsonb_object_agg(x.key, jsonb_build_object(
           'value', x.value,
           'source', x.source,
           'observed_at', x.observed_at
         )) as attrs
    from (
      select distinct on (a.key)
             a.key, a.value, a.source, a.observed_at
        from public.crm_attributes a
       where a.person_id = p.id
         and a.superseded_at is null
         and a.key in ('name', 'sex', 'goal', 'age', 'lead_source', 'cc_source')
       order by a.key,
                case a.source
                  when 'admin' then 0
                  when 'customer_contacts' then 1
                  when 'academy_profiles' then 2
                  when 'leads' then 3
                  else 8
                end,
                a.observed_at desc nulls last
    ) x
) w on true
left join lateral (
  select coalesce(jsonb_agg(jsonb_build_object(
           'key', a.key,
           'value', a.value,
           'source', a.source,
           'observed_at', a.observed_at
         ) order by a.observed_at), '[]'::jsonb) as utm
    from public.crm_attributes a
   where a.person_id = p.id
     and a.superseded_at is null
     and a.key in ('utm_source', 'utm_medium', 'utm_campaign',
                   'utm_content', 'utm_term', 'utm_id', 'fbclid')
) u on true
left join lateral (
  select array_agg(t.tag order by t.tag) as tags,
         bool_or(t.tag = 'ss-import-do-not-mail') as ss_import_do_not_mail
    from public.crm_tags t
   where t.person_id = p.id
     and t.detached_at is null
) tg on true
left join lateral (
  select coalesce(jsonb_agg(jsonb_build_object(
           'product', e.product,
           'active', e.active,
           'granted_at', e.granted_at,
           'expires_at', e.expires_at,
           'source', e.source
         ) order by e.product), '[]'::jsonb) as products
    from public.entitlements e
   where e.active is true
     and public.crm_norm_email(e.email) in (
           select i.value_normalized
             from public.crm_identifiers i
            where i.person_id = p.id and i.kind = 'email'
         )
) en on true
left join lateral (
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', l.id,
           'track', l.track,
           'step', l.step,
           'status', l.status,
           'source', l.source,
           'segment', l.segment
         ) order by l.created_at), '[]'::jsonb) as leads
    from public.leads l
   where public.crm_norm_email(l.email) in (
           select i.value_normalized
             from public.crm_identifiers i
            where i.person_id = p.id and i.kind = 'email'
         )
) ld on true
left join lateral (
  select coalesce(jsonb_agg(jsonb_build_object(
           'channel', c.channel,
           'purpose', c.purpose,
           'legal_basis', c.legal_basis,
           'state', c.state,
           'source', c.source,
           'granted_at', c.granted_at,
           'withdrawn_at', c.withdrawn_at
         ) order by c.channel, c.purpose, c.source), '[]'::jsonb) as consents
    from public.crm_consents c
   where c.person_id = p.id
) cs on true
where p.status = 'active';

comment on view public.crm_person_card is
  'Jedna karta aktivní osoby. Produkty a trať se čtou živě. purchased z leads se sem nedává.';

revoke all on public.crm_person_card from public, anon, authenticated;
grant select on public.crm_person_card to postgres, service_role;
