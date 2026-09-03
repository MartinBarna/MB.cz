insert into public.app_config (key, value)
values ('provize_koucink', '0.10')
on conflict (key) do nothing;
