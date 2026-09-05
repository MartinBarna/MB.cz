-- 5. 9. 2026: trať `tc-start` = 2 maily pro člověka, který si na tvujcoach.cz/start
-- spočítal kalorie bez účtu a nechal si čísla poslat. Čísla čte z leads.vars['tc-start']
-- ({{kcal}}, {{protein_g}}, {{fiber_g}}, {{carb_g}}, {{fat_g}}, {{cil}}), plní je edge
-- lead-capture (source 'tc-start'). Krok 0 hned, krok 1 za 2 dny, pak konec (wait_days null).
insert into public.email_templates (track, step, key, subject, preheader, blocks, wait_days) values
('tc-start', 0, 'tcs-0-cisla',
 'Tvoje čísla: {{kcal}} kcal na den',
 'Startovní kalorie a makra z dotazníku, ať je máš po ruce.',
 '[
  {"t":"p","html":"Ahoj{{fn_space}},"},
  {"t":"p","html":"tady máš, co ti dotazník spočítal. Ulož si to, za týden budeš chtít vědět, s čím jsi začínal."},
  {"t":"bullets","items":[
    "<strong>{{kcal}} kcal</strong> na den (cíl: {{cil}})",
    "<strong>{{protein_g}} g bílkovin</strong>, to je číslo, kterého se drž nejvíc",
    "<strong>{{fiber_g}} g vlákniny</strong>, sacharidy {{carb_g}} g, tuky {{fat_g}} g"
  ]},
  {"t":"p","html":"Jsou to startovní čísla z výšky, váhy a aktivity. U klientů vidím, že první dva týdny rozhodne něco jiného: jestli si zapíšeš všechno, co sníš. Kdo zapisuje, ví po týdnu, jestli čísla sedí. Kdo odhaduje, hádá."},
  {"t":"p","html":"Zapisovat můžeš zdarma v appce Tvůj Coach: hledáním, čárovým kódem, přes {{pocet_potravin}} potravin. Tvoje čísla se ti tam po přihlášení doplní samy."},
  {"t":"btn","href":"https://tvujcoach.cz/sign-up?plan=free&utm_source=email&utm_medium=drip&utm_campaign=tc-start&utm_content=s0","text":"Založit účet zdarma"},
  {"t":"p","html":"Za dva dny ti napíšu, jak poznat, že je čas čísla upravit. A kdy na ně naopak nesahat."},
  {"t":"p","html":"<strong>Be Effective!</strong><br>Martin"}
 ]'::jsonb, 2),
('tc-start', 1, 'tcs-1-kdy-upravit',
 'Kdy čísla upravit (a kdy na ně nesahat)',
 'Váha se dva dny nehnula? To ještě nic neznamená.',
 '[
  {"t":"p","html":"Ahoj{{fn_space}},"},
  {"t":"p","html":"startovní čísla máš. Teď nejčastější otázka, kterou od klientů slýchám: „Váha se dva dny nehnula, mám ubrat?“ Dva dny nic neznamenají. Váha kolísá s vodou, solí a spánkem klidně o kilo."},
  {"t":"bullets","items":[
    "<strong>Vyhodnocuj po týdnu</strong>, z průměru vážení, ne z jednoho rána.",
    "<strong>Nejdřív přesnost zápisu</strong>, pak pohyb, až nakonec kalorie. V tomhle pořadí.",
    "<strong>Když příjem sedí a váha stojí dva týdny</strong>, teprve pak má smysl s čísly hnout."
  ]},
  {"t":"p","html":"Přesně tohle za tebe dělá appka v Basicu: každý týden vezme tvoje zápisy a váhu, spočítá nový cíl a přepíše ti ho. Ty jen zapisuješ."},
  {"t":"btn","href":"https://tvujcoach.cz/?utm_source=email&utm_medium=drip&utm_campaign=tc-start&utm_content=s1","text":"Co umí Basic"},
  {"t":"p","html":"Kdo nechce platit, zvládne check-in v hlavě podle tří bodů výš. Funguje to, jen to chce každý týden si na to sednout."},
  {"t":"p","html":"<strong>Be Effective!</strong><br>Martin"}
 ]'::jsonb, null)
on conflict (track, step) do update set key = excluded.key, subject = excluded.subject, preheader = excluded.preheader, blocks = excluded.blocks, wait_days = excluded.wait_days, updated_at = now();
