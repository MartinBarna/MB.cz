-- =============================================================================
-- Klientská sekce: CÍLE na sacharidy, tuky a vlákninu, doplněk k client-targets.sql
--
-- Proč: `client_targets` dosud uměla jen kalorie a bílkoviny (+ kroky/sport/tréninky).
-- Martin chce zadávat klientům i sacharidy, tuky a vlákninu. Kcal, bílkoviny a vláknina
-- zůstávají prioritní (zobrazují se přednostně), sacharidy a tuky jsou doplňkové.
--
-- ADITIVNÍ: nic nemaže, nic nepřepisuje. Meze držet 1:1 se `client-targets-makra`
-- v admin-api/index.ts (MEZE), jinak dostane uživatel syrovou chybu z Postgresu.
-- =============================================================================

alter table public.client_targets
  add column if not exists carbs integer,
  add column if not exists fat   integer,
  add column if not exists fiber integer;

alter table public.client_targets
  add constraint client_targets_carbs_rozsah check (carbs is null or carbs between 0 and 1200),
  add constraint client_targets_fat_rozsah   check (fat   is null or fat   between 0 and 400),
  add constraint client_targets_fiber_rozsah check (fiber is null or fiber between 0 and 150);

comment on column public.client_targets.carbs is 'Cíl sacharidy g/den, doplňkové (sekundární zobrazení).';
comment on column public.client_targets.fat   is 'Cíl tuky g/den, doplňkové (sekundární zobrazení).';
comment on column public.client_targets.fiber is 'Cíl vláknina g/den, prioritní (zobrazuje se přednostně vedle kcal a bílkovin).';
