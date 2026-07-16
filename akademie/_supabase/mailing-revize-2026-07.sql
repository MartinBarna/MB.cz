-- ============================================================
-- Barna Academy — MAILING REVIZE 2026-07 (audit mise-revize-2026-07-16)
-- Opravy a doplnění šablon v email_templates + patička v app_config.
--
-- ⚠️ NESPOUŠTĚT AUTOMATICKY. Spustit ručně (Supabase SQL editor) po schválení Martinem.
-- ⚠️ Pořadí bloků je závazné — sjednocení tykání (blok 8) běží až PO přepisech P.S.,
--    které cílí na původní texty s velkým „Ti/Tebe“.
-- Lidský přehled změn + plné texty nových mailů: _zdroje/mailing-revize-preview.md
--
-- UPDATE jsou psané jako replace(přesný starý text → nový), takže jsou re-runnatelné
-- (po prvním běhu už vzor neexistuje) a přežijí drobné změny šablony jinde.
-- INSERTy mají ON CONFLICT (track, step) DO NOTHING — existující šablonu nepřepíšou.
-- ============================================================

begin;

-- ─────────────────────────────────────────────────────────────
-- 1) POČTY LEKCÍ: 241 i 255 → 256 (živý web /akademie/ uvádí 256)
--    Zasahuje: trener-kit/2, trener-kit/3 (i preheader), upsell-academy/0,
--    upsell-academy/2, lead-magnet-tool/1, rescue-academy/0.
-- ─────────────────────────────────────────────────────────────
update email_templates
   set blocks = replace(blocks::text, '255 lekcí', '256 lekcí')::jsonb, updated_at = now()
 where blocks::text like '%255 lekcí%';

update email_templates
   set preheader = replace(preheader, '255 lekcí', '256 lekcí'), updated_at = now()
 where preheader like '%255 lekcí%';

update email_templates
   set blocks = replace(blocks::text, '241 lekcí', '256 lekcí')::jsonb, updated_at = now()
 where blocks::text like '%241 lekcí%';

-- ─────────────────────────────────────────────────────────────
-- 2) GENDER FIXY — bezrodé formulace tam, kde segment neznáme
--    (nurture-pro-vas jde na segment 'other', rescue-academy rendruje
--    order-rescue vždy mužsky, lead-magnet-tool nemá gender ve formuláři).
--    Tokeny [a]/[á] z těchto šablon pryč — přepis bez rodu.
-- ─────────────────────────────────────────────────────────────

-- 2a) nurture-pro-vas step 0 (pv-welcome): „poskládáš sám“ → bez rodu
update email_templates
   set blocks = replace(blocks::text,
       $old$ať si jídelníček i trénink poskládáš sám a nemusíš za každý plán někomu platit dokola$old$,
       $new$ať si jídelníček i trénink poskládáš po svém a nemusíš za každý plán někomu platit dokola$new$)::jsonb,
       updated_at = now()
 where track = 'nurture-pro-vas' and step = 0;

-- 2b) nurture-pro-vas step 1 (pv-proc): „kde jsi začal“ + „poradíš si sám“ → bez rodu
update email_templates
   set blocks = replace(replace(blocks::text,
       $old$Problém je, že za měsíc jsi zase tam, kde jsi začal — protože nikdo ti neřekl$old$,
       $new$Problém je, že za měsíc jsi zase na začátku — protože nikdo ti neřekl$new$),
       $old$Když rozumíš principu, poradíš si sám: na dovolené, na oslavě, když se změní cíl.$old$,
       $new$Když rozumíš principu, poradíš si bez cizí pomoci: na dovolené, na oslavě, když se změní cíl.$new$)::jsonb,
       updated_at = now()
 where track = 'nurture-pro-vas' and step = 1;

-- 2c) nurture-pro-vas step 2 (pv-academy): „aby ses v tom vyznal sám“ → bez rodu
update email_templates
   set blocks = replace(blocks::text,
       $old$tě krok za krokem naučí výživu i trénink tak, aby ses v tom vyznal sám — a k tomu máš nástroje$old$,
       $new$tě krok za krokem naučí výživu i trénink tak, ať se v tom vyznáš bez cizí pomoci — a k tomu máš nástroje$new$)::jsonb,
       updated_at = now()
 where track = 'nurture-pro-vas' and step = 2;

-- 2d) upsell-academy step 2 (upsell-ac-2): P.S. „[[sama||sám]]“ → neutrální věta
--     (kupci/trenéři mají segment 'other' → token by padl vždy mužsky)
update email_templates
   set blocks = replace(blocks::text,
       $old$spíš Academy (nauč se to [[sama||sám]]), nebo koučink (dovedu tě já)?$old$,
       $new$spíš Academy (naučit se to), nebo koučink (dovedu tě já)?$new$)::jsonb,
       updated_at = now()
 where track = 'upsell-academy' and step = 2;

-- 2e) rescue-academy: „sis objednal[a]“ → neutrálně přes objednávku
--     (vzor ze sesterské rescue-videokurz; order-rescue rendruje [a] vždy mužsky)
update email_templates
   set blocks = replace(blocks::text,
       $old$všiml jsem si, že sis objednal[a] <strong>Barna Academy</strong>, ale platba nedoběhla. Objednávka je pořád připravená — stačí ji dokončit.$old$,
       $new$všiml jsem si, že tvoje objednávka <strong>Barna Academy</strong> zůstala kousek před cílem — platba nedoběhla. Pořád je připravená, stačí ji dokončit.$new$)::jsonb,
       updated_at = now()
 where track = 'rescue-academy' and step = 0;

-- 2f) lead-magnet-tool step 1 (tool-follow): dva tokeny [a] → bez rodu
update email_templates
   set blocks = replace(replace(blocks::text,
       $old$před pár dny sis otevřel[a] moje <strong>generátory jídelníčku a tréninku</strong> — tak se jen ptám: sedí ti výstupy?$old$,
       $new$před pár dny jsem ti poslal přístup ke svým <strong>generátorům jídelníčku a tréninku</strong> — tak se jen ptám: sedí ti výstupy?$new$),
       $old$P.S. Generátory zůstávají zdarma, i kdyby sis nic nekoupil[a]. Používej je, kolik chceš.$old$,
       $new$P.S. Generátory zůstávají zdarma i bez jakéhokoliv nákupu. Používej je, kolik chceš.$new$)::jsonb,
       updated_at = now()
 where track = 'lead-magnet-tool' and step = 1;

-- 2g) Patička všech drip mailů (app_config footer_html + footer_text):
--     „sis … stáhl[a]“ → úplně bez rodu (segment 'other' = kupci, trenéři…)
update app_config
   set value = replace(value,
       $old$Tento e-mail ti přišel, protože sis na martinbarna.cz stáhl[a] plán zdarma, nebo u mě máš zakoupený kurz či koučink.$old$,
       $new$Tento e-mail ti přišel, protože máš z martinbarna.cz stažený plán zdarma, nebo u mě zakoupený kurz či koučink.$new$)
 where key in ('footer_html', 'footer_text');

-- ─────────────────────────────────────────────────────────────
-- 3) WHATSAPP P.S. BEZ ČÍSLA → „odepiš na tenhle e-mail“
--    Čerstvý lead žádné Martinovo číslo nemá — mrtvá CTA v momentě rozhodování.
--    (Zmínky WhatsAppu jako SOUČÁSTI koučinku v lc-5/lk-3/upsell-co-1 zůstávají.)
-- ─────────────────────────────────────────────────────────────

-- 3a) kurz-nabidka (lead-magnet/3 + existing-leadmagnet/1 — stejný text)
update email_templates
   set blocks = replace(blocks::text,
       $old$P.S. Máš dotaz, jestli je to pro Tebe? Napiš mi na WhatsApp, však víš :) Řeknu Ti narovinu.$old$,
       $new$P.S. Máš dotaz, jestli je to pro tebe? Stačí odepsat na tenhle e-mail — čtu všechno a řeknu ti narovinu.$new$)::jsonb,
       updated_at = now()
 where blocks::text like '%Napiš mi na WhatsApp, však víš%';

-- 3b) academy-nabidka (lead-magnet/7 + existing-leadmagnet/5 + nurture-videokurz/8)
update email_templates
   set blocks = replace(blocks::text,
       $old$jestli je to pro Tebe? Napiš mi na WhatsApp, řeknu narovinu.$old$,
       $new$jestli je to pro tebe? Stačí odepsat na tenhle e-mail, čtu všechno — a řeknu narovinu.$new$)::jsonb,
       updated_at = now()
 where key = 'academy-nabidka' and blocks::text like '%Napiš mi na WhatsApp%';

-- 3c) upsell-coaching step 2 (upsell-co-2)
update email_templates
   set blocks = replace(blocks::text,
       $old$Napiš mi na WhatsApp, nezávazně, bez prodejních keců.$old$,
       $new$Stačí odepsat na tenhle e-mail — nezávazně, bez prodejních keců.$new$)::jsonb,
       updated_at = now()
 where track = 'upsell-coaching' and step = 2;

-- ─────────────────────────────────────────────────────────────
-- 4) upsell-co-0 SUBJECT: jméno viselo za otazníkem („…osobně? Tomáši“)
--    → vokativ před otazník přes {{fn_suffix}} („…osobně, Tomáši?“)
-- ─────────────────────────────────────────────────────────────
update email_templates
   set subject = 'Videokurz máš. Chceš pomoc i ode mě osobně{{fn_suffix}}?', updated_at = now()
 where track = 'upsell-coaching' and step = 0
   and subject = 'Videokurz máš. Chceš pomoc i ode mě osobně?{{fn_space}}';

-- ─────────────────────────────────────────────────────────────
-- 5) nurture-videokurz: „Prohlédnout/Mrknout“ CTA → prodejní stránka /videokurz
--    (sliby „prohlédnout“ vedly rovnou na SimpleShop pokladnu bez referencí
--    a garance). Slevové CTA „Vzít…“ zůstávají na pokladně.
-- ─────────────────────────────────────────────────────────────

-- 5a) nv-1 + nv-5: tlačítko „Prohlédnout videokurz“
update email_templates
   set blocks = replace(blocks::text,
       $old${"t": "btn", "href": "{{course_url}}", "text": "Prohlédnout videokurz"}$old$,
       $new${"t": "btn", "href": "https://martinbarna.cz/videokurz?utm_source=email&utm_medium=drip&utm_campaign=nurture", "text": "Prohlédnout videokurz"}$new$)::jsonb,
       updated_at = now()
 where track = 'nurture-videokurz' and blocks::text like '%"text": "Prohlédnout videokurz"%';

-- 5b) nv-7 (close): tlačítko „Mrknout na videokurz“ → prodejní stránka
--     + sekundární textový odkaz „rovnou koupit“ na pokladnu
update email_templates
   set blocks = replace(replace(blocks::text,
       $old${"t": "btn", "href": "{{course_url}}", "text": "Mrknout na videokurz"}$old$,
       $new${"t": "btn", "href": "https://martinbarna.cz/videokurz?utm_source=email&utm_medium=drip&utm_campaign=nurture", "text": "Mrknout na videokurz"}$new$),
       $old${"t": "p", "html": "Díky, že čteš až sem.$old$,
       $new${"t": "p", "html": "A jestli máš rozhodnuto, <a href='{{course_url}}'>tady kurz rovnou koupíš</a> — odemkne se ti do minuty."}, {"t": "p", "html": "Díky, že čteš až sem.$new$)::jsonb,
       updated_at = now()
 where track = 'nurture-videokurz' and step = 7;

-- ─────────────────────────────────────────────────────────────
-- 6) trener-kit step 3 (kit-academy-nabidka): chyběl podpis — jediný mail
--    z celého mailingu bez „Be Effective! / Martin“. Doplnit před P.S.
-- ─────────────────────────────────────────────────────────────
update email_templates
   set blocks = replace(blocks::text,
       $old${"t": "ps", "html": "P.S. Jestli váháš, odepiš mi, na co konkrétně. Odpovídám osobně."}$old$,
       $new${"t": "p", "html": "<strong>Be Effective!</strong><br>Martin"}, {"t": "ps", "html": "P.S. Jestli váháš, odepiš mi, na co konkrétně. Odpovídám osobně."}$new$)::jsonb,
       updated_at = now()
 where track = 'trener-kit' and step = 3
   and blocks::text not like '%Be Effective!%';

-- ─────────────────────────────────────────────────────────────
-- 7) DVOJITÁ „POSLEDNÍ ŠANCE“: nurture-videokurz slevy přerámovat jako
--    PŘIPOMÍNKU TÉ SAMÉ nabídky z lead-magnetu, ne novou slevu.
--    Zvolená pravda: slib „20 % je nejvyšší sleva“ drží lead-magnet;
--    nurture jen vrací stejné kódy (a longtail už žádnou slevu nedává).
--    Bonus: natvrdo „800 Kč“ → {{course_price}} (sjednocení se sesterskými tracky).
-- ─────────────────────────────────────────────────────────────

-- 7a) nv-2 (sleva15): „ti dávám slevu“ → „kód, co už máš, pořád platí“
update email_templates
   set blocks = replace(replace(blocks::text,
       $old$Na <strong>Videokurz výživy</strong> ti dávám slevu <strong>{{discount_pct}} %</strong> kódem <strong>{{discount_code}}</strong> — z 800 Kč je <strong>{{discount_price}} Kč</strong>. Doživotní přístup, koukáš, kdy chceš.$old$,
       $new$Sleva <strong>{{discount_pct}} %</strong> na <strong>Videokurz výživy</strong>, kterou jsem ti poslal už dřív, pořád platí: kód <strong>{{discount_code}}</strong> — z {{course_price}} Kč je <strong>{{discount_price}} Kč</strong>. Doživotní přístup, koukáš, kdy chceš.$new$),
       $old$Běžná cena kurzu je 800 Kč a stejná byla i posledních 30 dní, žádné umělé zdražení před slevou.$old$,
       $new$Běžná cena kurzu je {{course_price}} Kč a stejná byla i posledních 30 dní, žádné umělé zdražení před slevou.$new$)::jsonb,
       updated_at = now()
 where track = 'nurture-videokurz' and step = 2;

-- 7b) nv-6 (sleva20): „naposledy nabídnu / víc už slevu nedám“ → poslední PŘIPOMÍNKA
--     stejného kódu (subject, preheader i tělo)
update email_templates
   set subject = 'Poslední připomínka: −{{discount2_pct}} % na videokurz',
       preheader = 'Stejný kód jako dřív — a poslední mail, kde ho připomínám.',
       blocks = replace(replace(replace(blocks::text,
       $old$týdny ti posílám tipy zdarma. Teď ti naposledy nabídnu i celý systém — a rovnou za nejlepší cenu, jakou dám:$old$,
       $new$týdny ti posílám tipy zdarma. Dnes naposledy připomenu kód, který u mě máš z dřívějška — pořád je to nejvyšší sleva, jakou na kurz dávám:$new$),
       $old$Videokurz výživy se slevou <strong>{{discount2_pct}} %</strong> kódem <strong>{{discount2_code}}</strong> — z 800 Kč je <strong>{{discount2_price}} Kč</strong>. Doživotně, koukáš, kdy chceš.$old$,
       $new$Videokurz výživy se slevou <strong>{{discount2_pct}} %</strong> kódem <strong>{{discount2_code}}</strong> — z {{course_price}} Kč je <strong>{{discount2_price}} Kč</strong>. Doživotně, koukáš, kdy chceš.$new$),
       $old$P.S. Kód {{discount2_code}} zadáš v košíku. Víc už slevu nedám. Běžná cena kurzu je 800 Kč a stejná byla i posledních 30 dní.$old$,
       $new$P.S. Kód {{discount2_code}} zadáš v košíku. Žádná nová sleva — stejný kód jako dřív, jen ho po tomhle mailu už připomínat nebudu. Běžná cena kurzu je {{course_price}} Kč a stejná byla i posledních 30 dní.$new$)::jsonb,
       updated_at = now()
 where track = 'nurture-videokurz' and step = 6;

-- ─────────────────────────────────────────────────────────────
-- 8) TYKÁNÍ: „Ti/Tě/Tebe“ → malé písmeno (jen lead-magnet, existing-leadmagnet
--    a academy-nabidka v nurture-videokurz/8 — ostatní tracky už píšou malé).
--    Konzervativně: jen vzory s mezerou PŘED zájmenem (uvnitř věty). Ručně
--    ověřeno, že v těchto šablonách žádné „Ti/Tě“ nezačíná větu.
--    ⚠️ Musí běžet až PO bloku 3 (P.S. přepisy cílí na původní velká písmena).
-- ─────────────────────────────────────────────────────────────
update email_templates
   set blocks = replace(replace(replace(replace(replace(replace(
       blocks::text,
       ' Ti ', ' ti '),
       ' Tě ', ' tě '),
       ' Tebe ', ' tebe '),
       ' Tebe?', ' tebe?'),
       ' Tobě ', ' tobě '),
       ' i Ty,', ' i ty,')::jsonb,
       updated_at = now()
 where (track in ('lead-magnet', 'existing-leadmagnet') or (track = 'nurture-videokurz' and step = 8))
   and (blocks::text like '% Ti %' or blocks::text like '% Tě %' or blocks::text like '% Tebe%'
        or blocks::text like '% Tobě %' or blocks::text like '% i Ty,%');

update email_templates
   set subject = replace(replace(subject, ' Ti ', ' ti '), ' Tebe ', ' tebe '), updated_at = now()
 where track in ('lead-magnet', 'existing-leadmagnet')
   and (subject like '% Ti %' or subject like '% Tebe %');

update email_templates
   set preheader = replace(replace(preheader, ' Ti ', ' ti '), ' Tě ', ' tě '), updated_at = now()
 where track in ('lead-magnet', 'existing-leadmagnet')
   and (preheader like '% Ti %' or preheader like '% Tě %');

-- ─────────────────────────────────────────────────────────────
-- 9) NOVÉ MAILY
-- ─────────────────────────────────────────────────────────────

-- 9a+9b) ONBOARDING-NAKUP-ACADEMY: doplnit step 1 (prohlídka, +2 dny)
--        a step 2 (maximum, +7 dní). Step 0 dosud končil track (wait_days null).
--        Pozn.: kupci, co onboarding už dojeli (next_send_at null), nové maily
--        automaticky NEdostanou — případné doposlání je „K rozhodnutí“ v preview.
update email_templates
   set wait_days = 2, updated_at = now()
 where track = 'onboarding-nakup-academy' and step = 0;

insert into public.email_templates (track, step, key, subject, preheader, blocks, wait_days) values

('onboarding-nakup-academy', 1, 'nakup-academy-tour',
 $s$Rychlá prohlídka Academy — ať ti nic neuteče{{fn_suffix}}$s$,
 $h$Generátory, prompt knihovna, AI Martin a cesta k certifikátu.$h$,
 $j$[{"t": "p", "html": "Ahoj{{fn_space}},"}, {"t": "p", "html": "pár dní jsi uvnitř, tak ti ukážu, co všechno v Academy máš — členové často objeví půlku věcí až po měsících:"}, {"t": "bullets", "items": ["<strong>Generátory jídelníčků a tréninků</strong> — hotový plán na pár kliknutí, s exportem do PDF pod tvým jménem. Najdeš je v sekci <a href='https://martinbarna.cz/akademie/nastroje/'>Nástroje</a>.", "<strong>Prompt knihovna a modul AI</strong> — hotové prompty pro práci s klienty, obsah i byznys. Tohle ti ušetří hodiny týdně.", "<strong>AI Martin</strong> — chat přímo ve studiu: zeptáš se na cokoliv z výživy a tréninku a odpovídá z lekcí Academy. A když mu vyfotíš jídlo, odhadne kalorie.", "<strong>Certifikát</strong> — po dokončení testů získáš certifikát s veřejným ověřením online. Jde přidat na LinkedIn i na web, ať ho klienti vidí."]}, {"t": "p", "html": "<strong>Praktický tip, kde začít:</strong> otevři si studium, vyber studijní cestu (od nuly / vedení klientů / věda &amp; závodníci) a dej si první modul. Půl hodiny denně bohatě stačí — konzistence poráží dokonalost."}, {"t": "btn", "href": "https://martinbarna.cz/akademie/studium/?utm_source=email&utm_medium=drip&utm_campaign=onboarding-academy", "text": "Otevřít studium"}, {"t": "p", "html": "Kdyby cokoliv nešlo, stačí odpovědět na tenhle e-mail. <strong>Be Effective!</strong><br>Martin"}, {"t": "ps", "html": "P.S. Co tě zajímá nejvíc — práce s klienty, vlastní forma, nebo AI? Odepiš jednou větou a nasměruju tě na správný modul."}]$j$::jsonb,
 5),

('onboarding-nakup-academy', 2, 'nakup-academy-maximum',
 $s$Jak z Academy vytěžit maximum$s$,
 $h$Studijní rytmus, Praxe kit — a proč se ti to vrátí s prvním klientem.$h$,
 $j$[{"t": "p", "html": "Ahoj{{fn_space}},"}, {"t": "p", "html": "týden v Academy za tebou. Posílám postup, který se členům osvědčil nejvíc — od prvního modulu až k certifikátu:"}, {"t": "bullets", "items": ["<strong>Jeď po modulech popořadě.</strong> Jsou poskládané jako cesta — základy výživy a tréninku ti pak podrží všechno ostatní.", "<strong>Dej si rytmus, ne nálož.</strong> 2–3 lekce denně stačí. Důležitější než tempo je nevypadnout — pokrok vidíš v <a href='https://martinbarna.cz/akademie/studium/'>Moje studium</a>.", "<strong>Praxe kit používej hned.</strong> Vstupní dotazník, check-in šablonu i tracker vytiskneš pod svým jménem a použiješ s klientem klidně zítra: <a href='https://martinbarna.cz/akademie/praxe/'>Praxe kit</a>.", "<strong>Teorii si osahej na sobě.</strong> Pár týdnů si važ a zapisuj jídlo a sleduj týdenní průměr váhy — co si projdeš na vlastní kůži, to klientům vysvětlíš desetkrát líp."]}, {"t": "p", "html": "Bereš Academy pro sebe, ne pro klienty? Postup je stejný — jen místo Praxe kitu začni generátory a vlastním jídelníčkem."}, {"t": "p", "html": "A nezapomeň na cíl: po dokončení máš v ruce certifikát s veřejným ověřením, nástroje i klientské materiály pod svým jménem — všechno, s čím jde služby nabízet od prvního dne. Academy se ti vrátí s prvním klientem."}, {"t": "btn", "href": "https://martinbarna.cz/akademie/studium/?utm_source=email&utm_medium=drip&utm_campaign=onboarding-academy", "text": "Pokračovat ve studiu"}, {"t": "p", "html": "<strong>Be Effective!</strong><br>Martin"}, {"t": "ps", "html": "P.S. Zasekneš se kdekoliv — lekce, test, nástroj? Odepiš na tenhle e-mail, vyřešíme to spolu."}]$j$::jsonb,
 null)

on conflict (track, step) do nothing;

-- 9d) MOST lead-magnet-tool → videokurz: step 2 (+3 dny po tool-follow).
--     Od nástroje k systému; trenéry P.S. posílá na kit /pro-trenery.
--     Přeřazení tool-leadů do nurture-videokurz je změna enroll logiky — viz preview.
update email_templates
   set wait_days = 3, updated_at = now()
 where track = 'lead-magnet-tool' and step = 1;

insert into public.email_templates (track, step, key, subject, preheader, blocks, wait_days) values

('lead-magnet-tool', 2, 'tool-bridge-videokurz',
 $s$Čísla máš. Teď to hlavní{{fn_suffix}}$s$,
 $h$Generátor ti dal plán. Videokurz tě naučí ho uřídit v reálném životě.$h$,
 $j$[{"t": "p", "html": "Ahoj{{fn_space}},"}, {"t": "p", "html": "generátor ti spočítal kalorie i makra a poskládal plán. To je dobrý start — ale plán na papíře ještě nikoho neproměnil. Rozhoduje, co s ním uděláš v restauraci, o víkendu a v týdnu, kdy se váha zasekne."}, {"t": "p", "html": "Přesně tohle učím ve <strong>videokurzu výživy</strong>: jak si pár týdnů jídlo vážit a zapisovat (jen než si vytrénuješ oko), jak číst týdenní průměr váhy místo denních výkyvů a jak jíst flexibilně — bez zakázaných jídel. 182 lekcí, doživotní přístup za {{course_price}} Kč."}, {"t": "btn", "href": "https://martinbarna.cz/videokurz?utm_source=email&utm_medium=drip&utm_campaign=tool-bridge", "text": "Prohlédnout videokurz"}, {"t": "p", "html": "A jestli chceš nejdřív nakouknout dovnitř: <a href='{{free_lessons_url}}'>11 lekcí si pustíš zdarma</a>, bez registrace a bez karty."}, {"t": "p", "html": "<strong>Be Effective!</strong><br>Martin"}, {"t": "ps", "html": "P.S. Skládáš plány pro klienty, ne pro sebe? Pak začni jinde — <a href='https://martinbarna.cz/pro-trenery/'>startovacím kitem pro trenéry zdarma</a>."}]$j$::jsonb,
 null)

on conflict (track, step) do nothing;

-- 9c) NOVÝ TRACK evergreen-consumer: 6 hodnotových mailů à 30 dní pro leady
--     po dojetí longtail-consumer. Žádný prodejní tlak — jen materiály z webu
--     a soft zmínka na konci. ENROLL ZATÍM NEEXISTUJE (šablony jsou inertní),
--     potřebuje rozšířit enroll_into_longtail nebo nový cron — viz preview.
insert into public.email_templates (track, step, key, subject, preheader, blocks, wait_days) values

('evergreen-consumer', 0, 'ev-0-kviz',
 $s$2 minuty: co ti reálně brání zhubnout?$s$,
 $h$Krátký kvíz zdarma — a doporučení přesně pro tvoji situaci.$h$,
 $j$[{"t": "p", "html": "Ahoj{{fn_space}},"}, {"t": "p", "html": "chvíli jsem se neozval, tak jen v klidu — nic dnes neprodávám. Jen se chci zeptat, jak se daří. A jestli se to někde zaseklo, mám na to nástroj: krátký kvíz, který ti za 2 minuty ukáže, kde to nejspíš vázne."}, {"t": "btn", "href": "https://martinbarna.cz/kviz/?utm_source=email&utm_medium=drip&utm_campaign=evergreen", "text": "Spustit kvíz zdarma"}, {"t": "p", "html": "Pár otázek a na konci konkrétní doporučení podle tvé situace. Většinou totiž nevázne jídlo samotné — bývá to spánek, víkendy, nebo moc přísný plán, který se nedá vydržet."}, {"t": "p", "html": "<strong>Be Effective!</strong><br>Martin"}, {"t": "ps", "html": "P.S. Výsledek mi klidně pošli v odpovědi na tenhle e-mail — mrknu na to a poradím, co s tím."}]$j$::jsonb,
 30),

('evergreen-consumer', 1, 'ev-1-kalkulacka',
 $s$Hubneš podle starých čísel?$s$,
 $h$Lehčí tělo potřebuje míň. Přepočítej si příjem za 2 minuty.$h$,
 $j$[{"t": "p", "html": "Ahoj{{fn_space}},"}, {"t": "p", "html": "častá chyba, kterou vídám: člověk zhubne pár kilo, ale jede dál na čísla spočítaná na starou váhu. Lehčí tělo potřebuje míň energie — a hubnutí se zastaví, i když děláš všechno „správně“."}, {"t": "p", "html": "Když se váha pár týdnů nehne, většinou nepotřebuješ víc disciplíny. Potřebuješ aktuální čísla:"}, {"t": "btn", "href": "https://martinbarna.cz/kalkulacka-kalorii-a-makrozivin/?utm_source=email&utm_medium=drip&utm_campaign=evergreen", "text": "Přepočítat kalorie a makra zdarma"}, {"t": "p", "html": "Pravidlo k tomu: přepočítávej zhruba po každých 5 kg dole, ne každý týden. Mezitím drž kurz a řiď se týdenním průměrem váhy, ne jedním ranním číslem."}, {"t": "p", "html": "<strong>Be Effective!</strong><br>Martin"}, {"t": "ps", "html": "P.S. Nová čísla, a nevíš, jak z nich poskládat talíř? Přesně tohle krok za krokem učím ve <a href='https://martinbarna.cz/videokurz?utm_source=email&utm_medium=drip&utm_campaign=evergreen'>videokurzu výživy</a>."}]$j$::jsonb,
 30),

('evergreen-consumer', 2, 'ev-2-bilkoviny',
 $s$Jedna páka, co změní nejvíc: bílkoviny$s$,
 $h$Kolik jich reálně potřebuješ a z čeho je poskládat.$h$,
 $j$[{"t": "p", "html": "Ahoj{{fn_space}},"}, {"t": "p", "html": "kdybych měl z výživy vybrat jedinou věc, kterou vyladit jako první, jsou to <strong>bílkoviny</strong>. Zasytí nejvíc ze všech živin, drží svaly při hubnutí — a skoro každý jich jí míň, než si myslí."}, {"t": "p", "html": "Sepsal jsem k nim praktický článek: kolik jich denně potřebuješ, z čeho je reálně poskládat a jak to vypadá na talíři:"}, {"t": "btn", "href": "https://martinbarna.cz/clanky/bilkoviny.html?utm_source=email&utm_medium=drip&utm_campaign=evergreen", "text": "Přečíst: bílkoviny prakticky"}, {"t": "p", "html": "Rychlý test na dnešek: projdi si v hlavě dnešní jídla — kolik z nich mělo pořádný zdroj bílkovin (maso, ryba, vejce, tvaroh, skyr, luštěniny)? Míň než tři? Máš svůj první krok."}, {"t": "p", "html": "<strong>Be Effective!</strong><br>Martin"}]$j$::jsonb,
 30),

('evergreen-consumer', 3, 'ev-3-spanek',
 $s$Děláš všechno dobře, a stejně to drhne?$s$,
 $h$Podceňovaný spojenec hubnutí: spánek.$h$,
 $j$[{"t": "p", "html": "Ahoj{{fn_space}},"}, {"t": "p", "html": "můžeš mít jídelníček i trénink srovnané — a stejně to drhne, když spíš 5–6 hodin. Nevyspané tělo má druhý den větší hlad a chutě, hlavně na sladké a tučné, a hůř se mu odolává."}, {"t": "p", "html": "Napsal jsem o tom článek: co spánek reálně dělá s hubnutím a čím začít, když ho chceš zlepšit:"}, {"t": "btn", "href": "https://martinbarna.cz/clanky/spanek-a-hubnuti.html?utm_source=email&utm_medium=drip&utm_campaign=evergreen", "text": "Přečíst: spánek a hubnutí"}, {"t": "p", "html": "Jeden krok na tento týden: pevný čas, kdy jdeš spát, a hodinu předtím pryč od telefonu. Menší chutě poznáš dřív, než čekáš."}, {"t": "p", "html": "<strong>Be Effective!</strong><br>Martin"}]$j$::jsonb,
 30),

('evergreen-consumer', 4, 'ev-4-checkin',
 $s$5 minut v pondělí, co řídí celý tvůj pokrok$s$,
 $h$Týdenní check-in na jednu stránku — PDF zdarma.$h$,
 $j$[{"t": "p", "html": "Ahoj{{fn_space}},"}, {"t": "p", "html": "jestli ti před časem zapadl, posílám znovu nejužitečnější materiál, který mám: <strong>pondělní check-in na jednu stránku</strong>. Přesně tohle chci každé pondělí od klientů — a přesně tohle odděluje ty, kdo pokrok řídí, od těch, kdo v něj jen doufají."}, {"t": "btn", "href": "https://martinbarna.cz/download/tydenni-checkin.pdf", "text": "Stáhnout check-in PDF"}, {"t": "p", "html": "Váha (týdenní průměr!), míry, energie, hlad, kroky, spánek. Pět minut — a víš, jestli plán funguje, nebo je čas ho upravit. Podle dat, ne podle nálady."}, {"t": "p", "html": "<strong>Be Effective!</strong><br>Martin"}, {"t": "ps", "html": "P.S. Chceš, ať ta pondělní čísla se mnou řešíš napřímo? Přesně takhle funguje <a href='https://martinbarna.cz/koucing/?utm_source=email&utm_medium=drip&utm_campaign=evergreen'>můj koučink</a>."}]$j$::jsonb,
 30),

('evergreen-consumer', 5, 'ev-5-vikendy',
 $s$Klasika, co bourá výsledky: víkend$s$,
 $h$Přes týden podle plánu, o víkendu chaos? Jde to i jinak.$h$,
 $j$[{"t": "p", "html": "Ahoj{{fn_space}},"}, {"t": "p", "html": "jestli za 13 let praxe vídám jeden vzorec pořád dokola, je to tenhle: pondělí až čtvrtek na jedničku, v pátek večer to povolí — a neděle končí ve stylu „od pondělí znovu“. Není to slabá vůle. Je to systém, který s víkendem nepočítá."}, {"t": "p", "html": "Jak si nastavit týdenní průměr kalorií a plánovaný volnější den, ať si víkend užiješ a nezboříš celý týden:"}, {"t": "btn", "href": "https://martinbarna.cz/clanky/vikendove-prejidani.html?utm_source=email&utm_medium=drip&utm_campaign=evergreen", "text": "Přečíst: víkendové přejídání"}, {"t": "p", "html": "Tímhle mailem moje občasné tipy končí — nechci ti plnit schránku. Ozvu se, jen když budu mít něco, co za to fakt stojí. A ty se ozvi kdykoliv: stačí odepsat na tenhle e-mail, čtu všechno."}, {"t": "p", "html": "<strong>Be Effective!</strong><br>Martin"}]$j$::jsonb,
 null)

on conflict (track, step) do nothing;

commit;

-- ============================================================
-- KONEC. Po nasazení doporučeno:
--  1) test-send pár šablon přes drip-send (mode test_email) — hlavně
--     nurture-videokurz/2+6+7, academy-nabidka a nové šablony,
--  2) vyrobit čerstvý dump do drip-templates.sql (starý tímto zastará),
--  3) rozhodnout enroll pro evergreen-consumer (viz preview.md, sekce K rozhodnutí).
-- ============================================================
