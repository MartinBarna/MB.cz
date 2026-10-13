/* Klientska sekce: CZ/EN vrstva. Ceske retezce ve strance se nemeni.
   EN jen pri zobrazeni (jazyk klienta nebo ?lang=en). Chyba cteni = cs.
   Do DB se posilaji stejne klice a hodnoty, prekladaji se jen popisky. */
(function (root) {
  "use strict";
  var lang = "cs";
  var previewOn = false;
  var hooksOn = false;
  var PHRASE = Object.create(null);

  var LINES = [
    "MB\tMB",
    "Klientská sekce\tClient area",
    "Koučink\tCoaching",
    "Moje studium\tMy courses",
    "Napsat Martinovi\tEmail Martin",
    "Odhlásit\tLog out",
    "Načítám tvoji sekci…\tLoading your page...",
    "Tahle sekce je jen pro klienty koučinku.\tThis page is only for coaching clients.",
    "Přihlásit se\tLog in",
    "Tvůj e-mail (\tYour email (",
    ") zatím nemá přístup do klientské sekce, ta je součástí\t) does not have access to the client page yet. It is part of",
    "osobního koučinku\tpersonal coaching",
    "Jsi Martinův klient a nevidíš sekci? Napiš na\tYou are Martin's client and you do not see the page? Email",
    ": přístup ti zapne (musí sedět e-mail, kterým se registruješ).\t: he will turn access on (the email has to match the one you register with).",
    "Tvůj koučink s Martinem\tYour coaching with Martin",
    "Ahoj!\tHi!",
    "Ahoj\tHi",
    "Tady je celá tvoje cesta: reporty, grafy pokroku, dokumenty od Martina i výhody navíc.\tEverything is here: reports, progress charts, files from Martin, and extras.",
    "📝 Začínáme: vstupní dotazník\t📝 Start here: intake questionnaire",
    "~10 minut o tobě, ať je plán od prvního dne přesně na míru. Nic se nedá zkazit.\tAbout 10 minutes about you, so the plan fits from day one. You cannot mess this up.",
    "Vyplnit dotazník\tFill in the questionnaire",
    "📊 Týdenní report\t📊 Weekly report",
    "Naklikáš ho za ~3 minuty. Kopie přijde tobě i Martinovi.\tIt takes about 3 minutes. A copy goes to you and to Martin.",
    "Vyplnit report\tFill in the report",
    "Naplánuj si to\tPlan it",
    "🍽️ Jídelníček na míru\t🍽️ Custom meal plan",
    "Vygeneruj si jídelníček na svoje čísla, vyměň, co ti nesedí, a ulož do PDF. Cíl od Martina máš nahoře, podle něj si nastav kalorie.\tBuild a meal plan for your numbers, swap what does not fit, and save a PDF. Martin's target is at the top. Set calories from that.",
    "🏋️ Tréninkový plán\t🏋️ Training plan",
    "Sestav si tréninkový plán podle toho, kolikrát týdně stíháš a kde cvičíš. Databáze cviků s popisem techniky je součástí.\tBuild a training plan from how many days a week you can train and where you train. The exercise library with technique notes is included.",
    "🧮 Výpočet kalorií a maker\t🧮 Calorie and macro calculator",
    "Spočítej si kalorie, bílkoviny, sacharidy, tuky i vlákninu podle váhy, aktivity a cíle. Když máš zadání od Martina, drž se jeho čísel.\tWork out calories, protein, carbs, fat and fiber from your weight, activity and goal. If Martin has set your numbers, use his.",
    "Aktuální váha\tCurrent weight",
    "Celková změna\tTotal change",
    "Odeslané reporty\tReports sent",
    "Dodržení plánu Ø\tPlan adherence, average",
    "průměr ze všech reportů (1 = nejlíp, 5 = nejhůř)\taverage of all reports (1 = best, 5 = worst)",
    "🌟 Tvoje proměna může inspirovat\t🌟 Your progress can help others start",
    "Máš za sebou pěkný kus cesty. Když budeš souhlasit, Martin může tvůj pokrok (křestní jméno + čísla) použít jako referenci, pomůžeš dalším se rozhoupat.\tYou have put in a solid stretch of work. If you agree, Martin can use your progress (first name and numbers) as a reference. That helps other people get started.",
    "Tvoje reference\tYour reference",
    "Napiš pár vět: jak se ti spolupracuje, co se změnilo…\tA few sentences: how the work together feels, what changed...",
    "Souhlasím, aby Martin použil moje křestní jméno, moje slova a čísla pokroku jako referenci na webu a sociálních sítích.\tI agree that Martin may use my first name, my words and my progress numbers as a reference on the website and on social media.",
    "Odeslat Martinovi\tSend to Martin",
    "Chci pomoct referencí\tI want to leave a reference",
    "Grafy pokroku\tProgress charts",
    "Období:\tPeriod:",
    "8 týdnů\t8 weeks",
    "12 týdnů\t12 weeks",
    "26 týdnů\t26 weeks",
    "Vše\tAll",
    "Váha\tWeight",
    "váha\tweight",
    "týdenní průměry (kg) ·\tweekly averages (kg) ·",
    "⬇︎ uložit jako obrázek\t⬇︎ save as image",
    "Míry\tMeasurements",
    "pas · boky · hruď (cm)\twaist · hips · chest (cm)",
    "Kalorie\tCalories",
    "denní průměr v týdnu (kcal)\tdaily average for the week (kcal)",
    "Bílkoviny\tProtein",
    "denní průměr v týdnu (g)\tdaily average for the week (g)",
    "Kroky\tSteps",
    "denní průměr v týdnu\tdaily average for the week",
    "Energie a dodržení\tEnergy and adherence",
    "škály 1–5 jako ve škole: u všech nižší = líp\tscales 1 to 5, like school grades: for all of them, lower is better",
    "Historie reportů\tReport history",
    "Datum\tDate",
    "Pas\tWaist",
    "pas\twaist",
    "kcal Ø\tkcal avg",
    "Bílk. Ø\tProtein avg",
    "Sach. Ø\tCarbs avg",
    "Tuky Ø\tFat avg",
    "Vlák. Ø\tFiber avg",
    "Dny\tDays",
    "Kroky Ø\tSteps avg",
    "Fitko\tGym",
    "Sport (min)\tTraining (min)",
    "Dodržení\tAdherence",
    "📷 Tvoje fotky\t📷 Your photos",
    "Fotky z reportů pohromadě: tvoje proměna černé na bílém. Vidíte je jen ty a Martin. Klepnutím otevřeš plnou velikost.\tReport photos in one place: your progress, clear to see. Only you and Martin can view them. Tap to open full size.",
    "Dokumenty od Martina\tFiles from Martin",
    "Zatím tu žádné dokumenty nejsou, jakmile ti Martin něco nahraje (plán, jídelníček, podklady), objeví se tady.\tNo files here yet. When Martin uploads something (a plan, a meal plan, notes), it will show up here.",
    "Jak na to: nejčastější otázky\tHow this works: common questions",
    "Kdy a jak často vyplnit report?\tWhen and how often do I fill in the report?",
    "Jednou týdně, za celý uplynulý týden, nejlíp v neděli večer nebo v pondělí ráno. Formulář tě provede krok za krokem, kopie přijde tobě i mně. Já ho projdu a ozvu se ti s úpravami zadání.\tOnce a week, for the whole week just gone, best on Sunday evening or Monday morning. The form walks you through it. A copy goes to you and to me. I read it and write back with changes to your targets.",
    "Co znamenají grafy a barvy v historii?\tWhat do the charts and the colors in the history mean?",
    "Váha a míry jsou týdenní průměry z reportů, jednotlivé dny kolísají díky fluktuacím tekutin. Kalorie, bílkoviny a kroky srovnávám s cílem, který platil ten týden, proto se historie nepřebarví, když ti cíl posunu. Zelená znamená v pásmu 5 % kolem cíle (u bílkovin i nad ním), oranžová mimo.\tWeight and measurements are weekly averages from reports. Single days move with fluid shifts. I compare calories, protein and steps with the target that was set that week, so the history does not change color when I move your target. Green means within 5% of the target (for protein, also above it). Orange means outside that.",
    "Zapomněl/a jsem den zapsat.\tI forgot to log a day.",
    "Doplň, co si pamatuješ, snaž se ten odhad nepodcenit a v reportu uveď, kolik dní máš zapsaných. Počítám s tím a průměr beru jen ze zapsaných dní.\tFill in what you remember, do not lowball the estimate, and say in the report how many days you logged. I expect that, and the average uses only the days you logged.",
    "Kdy mi psát rovnou a kdy počkat na report?\tWhen should I message you now, and when should I wait for the report?",
    "Zdravotní věci, bolest při tréninku, situace, které vzniknou během týdne a potřebuješ se poradit, a cokoli, co tě blokuje víc než pár dní, piš hned na WhatsApp. Chuť, hlad, kolísání váhy, změny na mírách či plán na další týdny patří do reportu, tam to vidím v souvislostech. Rychlé dotazy zodpoví i AI Martin (zlaté tlačítko vpravo dole), velké věci nech na mě.\tHealth issues, pain in training, anything that comes up during the week and you need to talk it through, and anything that blocks you for more than a couple of days: message me on WhatsApp right away. Cravings, hunger, weight bouncing around, tape-measure changes and the plan for the next weeks belong in the report. That is where I see the whole picture. The in-page AI chat is not available in English. Quick questions go to email or WhatsApp. Bigger things stay with me.",
    "Jak otevřu dokumenty od Martina?\tHow do I open files from Martin?",
    "Klepni na název, dokument se otevře v nové kartě a PDF si můžeš uložit. Když se nic neotevře, povol vyskakovací okna pro martinbarna.cz nebo zkus jiný prohlížeč. Jídelníček, tréninkový plán i výpočet kalorií si navíc kdykoli uděláš sám v nástrojích nahoře, čísla od Martina už tam máš předvyplněná.\tTap the name. The file opens in a new tab and you can save the PDF. If nothing opens, allow pop-ups for martinbarna.cz or try another browser. You can also build a meal plan, a training plan and a calorie estimate any time in the tools above. Martin's numbers are already filled in.",
    "Tvoje výhody v ceně koučinku\tWhat is included in coaching",
    "💬 Napiš mi na WhatsApp\t💬 Message me on WhatsApp",
    "Když něco hoří mezi reporty nebo si nevíš rady, napiš mi rovnou. Ozvu se, jak to půjde. Do reportu pak dej celý týden, ať to mám pohromadě.\tIf something is urgent between reports, or you are stuck, message me. I will reply when I can. Then put the whole week in the report so I have it in one place.",
    "Napsat Martinovi na WhatsApp\tMessage Martin on WhatsApp",
    "🎬 Videokurz výživy\t🎬 Nutrition video course",
    "182 videí o hubnutí, jídle a tréninku, máš kompletně odemčený. Skvělý doplněk ke koučinku.\t182 videos on fat loss, food and training. You have the full course. A strong add-on to coaching.",
    "📱 Appka Tvůj Coach: máš v ceně koučinku\t📱 Tvůj Coach app: included in coaching",
    "Vyfotíš jídlo a appka spočítá makra, hlídá kalorie a bílkoviny. Ideální na zapisování stravy pro report. Registruj se stejným e-mailem jako tady.\tYou take a photo of a meal and the app estimates macros and tracks calories and protein. Useful for logging food for the report. Register with the same email as here.",
    "🎓 Barna Academy −20 %\t🎓 Barna Academy, 20% off",
    "Chceš jít do hloubky (nebo se stát trenérem)? Jako můj klient máš slevu 20 % s kódem\tWant to go deeper (or become a coach)? As my client you get 20% off with the code",
    "KLIENT20\tKLIENT20",
    "Nahlédnout zdarma můžeš hned\tYou can look for free right now",
    ": mrkni na ukázkové lekce.\t: take a look at the sample lessons.",
    "👀 Academy: ochutnávka zdarma\t👀 Academy: free sample",
    "Prohlédni si obsah všech 24 modulů a pusť si volné ukázkové lekce, ať víš, do čeho bys šel/šla.\tLook through all 24 modules and play the free sample lessons, so you know what you would be getting.",
    "🤖 AI Martin: máš v ceně\t🤖 AI Martin: included",
    "Zlaté tlačítko vpravo dole 👉 rychlé dotazy mezi check-iny (jídlo, trénink, motivace) zodpoví AI vytrénovaná na Martinově metodice. Velké věci řeš dál v reportu, čte ho Martin osobně.\tThe in-page AI chat is not available in English. Quick questions between check-ins (food, training, motivation) go to WhatsApp or email. Bigger things stay in the report. Martin reads that himself.",
    "🎁 Doporuč kamarádovi\t🎁 Refer a friend",
    "Kamarád přes tvůj odkaz ušetří 10 % na videokurzu nebo Academy a ty dostaneš 150 až 300 Kč kredit na další nákup. Svůj osobní kód najdeš na stránce doporučení, pošleš ho jedním klikem.\tA friend who uses your link saves 10% on the video course or Academy, and you get a 150 to 300 CZK credit toward your next purchase. Your personal code is on the referral page. You can send it in one click.",
    "Klientská sekce · Martin Barna · osobní koučink ·\tClient area · Martin Barna · personal coaching ·",
    "Klientská sekce · Martin Barna\tClient area · Martin Barna",
    "Zpět\tBack",
    "Zavřít\tClose",
    "Pokračovat\tContinue",
    "Odeslat\tSend",
    "Jaká je tvoje váha?\tWhat is your weight?",
    "Zvaž se\tWeigh yourself",
    "ráno nalačno, po záchodě\tin the morning, fasted, after the bathroom",
    ": jedno vážení stačí. A počítej s tím, že váha běžně kolísá o\t: one weigh-in is enough. Expect the scale to move by",
    "1–3 kg\t1 to 3 kg",
    "(voda, glykogen, plné břicho, u žen cyklus) bez ohledu na to, jestli hubneš, proto sledujeme i míry, ty řeknou pravdu.\t(water, glycogen, a full stomach, and for women the cycle) whether you are losing fat or not. That is why we also track measurements. They tell the truth.",
    "Pro fitness nadšence: kdo se váží denně, může zadat\tFor people who like the details: if you weigh in daily, you can enter",
    "průměr 7 ranních vážení\tthe average of 7 morning weigh-ins",
    ": je přesnější. Není to ale povinnost, denní vážení není pro každého.\t: it is more precise. It is not required. Daily weigh-ins are not for everyone.",
    "Váha\tWeight",
    "např. 71,3\te.g. 71.3",
    "Měřil/a ses tento týden?\tDid you measure this week?",
    "Měřil/a ses od minulého reportu?\tDid you measure since the last report?",
    "Míry řeknou to, co váha neumí: hlavně pupík, pas a boky.\tMeasurements show what the scale cannot: mainly belly, waist and hips.",
    "Míry tento týden\tMeasurements this week",
    "Míry od minulého reportu\tMeasurements since the last report",
    "Ano, mám míry\tYes, I have measurements",
    "Tento týden přeskočím\tI will skip this week",
    "Tentokrát přeskočím\tI will skip this time",
    "Vyber prosím jednu možnost.\tPlease pick one option.",
    "Tvoje míry (cm)\tYour measurements (cm)",
    "Každý týden sledujeme\tEach week we track",
    "hruď, pas, boky, zadek a stehna\tchest, waist, hips, glutes and thighs",
    ": zaberou celé tělo a dají Martinovi kontext, který samotná váha neumí. Co nestihneš, nech prázdné.\t: they cover the whole body and give Martin context the scale alone cannot. Leave blank whatever you did not get to.",
    "Skrýt bonusové míry\tHide extra measurements",
    "+ Pro fitnessáky: lýtka, paže, krk, pupík\t+ Extra: calves, arms, neck, belly",
    "Vyplň aspoň jednu z hlavních měr, nebo se vrať a zvol „přeskočím“.\tFill in at least one of the main measurements, or go back and choose \"I will skip\".",
    "Strava: týdenní průměr\tFood: weekly average",
    "Strava: průměr za\tFood: average over",
    "Stačí\tEnough to enter",
    "průměr kcal a bílkovin\tthe average calories and protein",
    "za dny, kdy jsi zapisoval/a, nemusíš na gram přesně (Kalorické tabulky: Statistiky → Analýza jídelníčku). A jestli jedeš KT na webu, nech to celé na mně: nahraj export a čísla doplním sám(a).\tfor the days you logged. It does not have to be exact to the gram (Kaloricke tabulky: Statistics, then meal analysis). If you use the KT website, leave the numbers to me: upload the export and I will fill them in.",
    "📥 Načíst z Kalorických tabulek (XLS export)\t📥 Load from Kaloricke tabulky (XLS export)",
    "Na webu KT: ikona šipky dolů v hlavičce jídelníčku →\tOn the KT website: the down-arrow in the meal-plan header, then",
    "vyber poslední týden\tpick the last week",
    "vyber dny\tselect the days",
    ") nebo screenshot statistik z mobilu.\t) or a screenshot of the stats from your phone.",
    "→ XLS. Průměry i denní rozpis se doplní samy a export se přiloží pro Martina.\tthen XLS. Averages and the day-by-day log fill in on their own, and the export is attached for Martin.",
    "Tenhle týden jsem stravu nezapisoval/a\tI did not log food this week",
    "Za tohle období jsem stravu nezapisoval/a\tI did not log food for this period",
    "Čísla se přeskočí. Nic si nevymýšlej, Martin to tak uvidí férově.\tThe numbers are skipped. Do not invent them. Martin will see that plainly.",
    "Pole stravy jsou vypnutá, protože máš zaškrtnuto, že jsi stravu nezapisoval/a. Chceš je vyplnit? Odškrtni políčko, nebo ťukni do pole.\tThe food fields are off because you checked that you did not log food. Want to fill them in? Uncheck the box, or tap a field.",
    "Kalorie Ø/den\tCalories, avg/day",
    "např. 1750\te.g. 1750",
    "Bílkoviny Ø\tProtein, avg",
    "Sacharidy Ø\tCarbs, avg",
    "Tuky Ø\tFat, avg",
    "Vláknina Ø\tFiber, avg",
    "Sacharidy\tCarbs",
    "Tuky\tFat",
    "Vláknina\tFiber",
    "Kolik dní jsi zapisoval/a?\tHow many days did you log?",
    "Kolik dní z\tHow many days out of",
    "jsi zapisoval/a?\tdid you log?",
    "+ Denní rozpis (nepovinné)\t+ Day-by-day log (optional)",
    "Skrýt denní rozpis\tHide the day-by-day log",
    "Vyplň, co znáš, klidně jen kcal.\tFill in what you know, even calories only.",
    "Průměry nahoře ti spočítám sám\tI will calculate the averages above",
    ", přepisovat je nemusíš. Nebo detail vůbec nepřepisuj a přilož export/screenshot z Kalorických tabulek v kroku Fotky a přílohy.\t, you do not have to retype them. Or skip the detail and attach an export or screenshot from Kaloricke tabulky in the Photos and files step.",
    "B (g)\tP (g)",
    "S (g)\tC (g)",
    "T (g)\tF (g)",
    "Vl (g)\tFi (g)",
    "B\tP",
    "S\tC",
    "T\tF",
    "Vl\tFi",
    "Den\tDay",
    "(nepovinné)\t(optional)",
    "nepovinné\toptional",
    "Vyber, kolik dní jsi zapisoval/a (klidně 0).\tPick how many days you logged (0 is fine).",
    "Napiš, kolik dní jsi zapisoval/a (klidně 0).\tType how many days you logged (0 is fine).",
    "Počet zapsaných dní je celé číslo od 0 do\tLogged days have to be a whole number from 0 to",
    "Aktivity za týden\tTraining for the week",
    "Aktivity (průměrně za týden)\tTraining (weekly average)",
    "Kroky ti řekne mobil/hodinky. U sportu Martina zajímají hlavně\tYour phone or watch has your steps. For training, Martin mainly wants",
    "celkové minuty za týden\ttotal minutes for the week",
    ": „4× fitko\" může znamenat 4× 30 minut i 4× 120 minut, a pro plán je to obrovský rozdíl. Sečti fitko, kardio i jiný pohyb dohromady.\t: \"4x gym\" can mean 4x 30 minutes or 4x 120 minutes, and for the plan that is a huge difference. Add gym, cardio and other movement together.",
    "Report je za\tThe report covers",
    ", takže kroky napiš jako denní průměr a sport i tréninky jako\t, so write steps as a daily average and training minutes and sessions as",
    "průměr na jeden týden\tthe average for one week",
    "Kroky Ø/den\tSteps, avg/day",
    "kroků\tsteps",
    "např. 8500\te.g. 8500",
    "Fitko: počet tréninků\tGym: number of sessions",
    "Fitko: počet tréninků za týden (průměr)\tGym: sessions per week (average)",
    "Sport celkem za týden\tTraining minutes for the week",
    "Sport celkem za týden (průměr)\tTraining minutes for the week (average)",
    "fitko + kardio + vše, např. 240\tgym + cardio + everything else, e.g. 240",
    "Kardio\tCardio",
    "např. 2× 30 min chůze do kopce\te.g. 2x 30 min uphill walking",
    "Jiný sport / pohyb\tOther sport / movement",
    "např. volejbal 1×, kolo o víkendu\te.g. volleyball once, a bike ride on the weekend",
    "Vyber počet tréninků ve fitku (klidně 0).\tPick how many gym sessions (0 is fine).",
    "celkové minuty sportu za týden (klidně 0)\ttotal training minutes for the week (0 is fine)",
    "Plán na příští týden\tPlan for next week",
    "Plán do dalšího reportu\tPlan until the next report",
    "Domluva dopředu: kolik kroků denně a kolik minut sportu příští týden dáš? Martin pak v dalším reportu vidí plán vedle reality. Nechceš-li nic měnit, stačí kliknout „bude stejně\".\tAgree it up front: how many steps a day and how many training minutes next week? Martin then sees the plan next to what happened. If you want no change, tap \"same as this week\".",
    "Domluva dopředu: kolik kroků denně a kolik minut sportu za týden dáš do dalšího reportu? Martin pak v něm vidí plán vedle reality. Nechceš-li nic měnit, stačí kliknout „bude stejně\".\tAgree it up front: how many steps a day and how many training minutes per week until the next report? Martin then sees the plan next to what happened. If you want no change, tap \"same as so far\".",
    "Jak to bude příští týden?\tWhat will next week look like?",
    "Jak to bude do dalšího reportu?\tWhat will it look like until the next report?",
    "Bude stejně jako tento týden\tSame as this week",
    "Bude stejně jako dosud\tSame as so far",
    "Nastavím si čísla\tI will set the numbers",
    "Plán: kroky Ø/den\tPlan: steps, avg/day",
    "např. 9000\te.g. 9000",
    "Plán: sport celkem za týden\tPlan: training minutes for the week",
    "např. 270\te.g. 270",
    "Vyber, jak to bude příští týden.\tPick what next week will look like.",
    "Vyber, jak to bude do dalšího reportu.\tPick what it will look like until the next report.",
    "plánované kroky\tplanned steps",
    "plánované minuty sportu (klidně 0)\tplanned training minutes (0 is fine)",
    "Plán:\tPlan:",
    "Jak ses cítil/a?\tHow did you feel?",
    "Všechny škály jako známky ve škole: 1 = nejlíp, 5 = nejhůř. Není správná odpověď, podle tohohle Martin ladí plán.\tAll scales are like school grades: 1 = best, 5 = worst. There is no right answer. Martin uses this to adjust the plan.",
    "Únava\tFatigue",
    "1 = čerstvý/á\t1 = fresh",
    "5 = vyřízený/á\t5 = wiped out",
    "Hlad\tHunger",
    "1 = žádný\t1 = none",
    "5 = pořád\t5 = constant",
    "Síla v tréninku\tStrength in training",
    "1 = nabušeno\t1 = strong",
    "5 = slabota\t5 = flat",
    "Kvalita spánku\tSleep quality",
    "1 = výborná\t1 = excellent",
    "5 = mizerná\t5 = poor",
    "Spánek: hodin průměrně\tSleep: hours on average",
    "např. 7\te.g. 7",
    "Dodržení plánu\tPlan adherence",
    "1 = na 100 %\t1 = 100%",
    "5 = vůbec\t5 = not at all",
    "Naklikej prosím\tPlease tap",
    "únavu\tfatigue",
    "hlad\thunger",
    "sílu\tstrength",
    "kvalitu spánku\tsleep quality",
    "dodržení plánu\tplan adherence",
    "Spánek:\tSleep:",
    "Slovní zhodnocení\tIn your own words",
    "Pár vět stačí, tohle je pro Martina často to nejcennější z celého reportu. Žádné pole nemá limit délky.\tA few sentences are enough. For Martin this is often the most useful part of the report. No field has a length limit.",
    "✓ Co se tenhle týden povedlo?\t✓ What went well this week?",
    "✓ Co se od minulého reportu povedlo?\t✓ What went well since the last report?",
    "✗ Co drhlo?\t✗ What was hard?",
    "? Otázky na Martina\t? Questions for Martin",
    "💬 Cokoliv dalšího\t💬 Anything else",
    "prostor jen pro tebe, klidně napiš román\tspace just for you, write as much as you want",
    "Fotky a přílohy (nepovinné)\tPhotos and files (optional)",
    "Fotky a přílohy\tPhotos and files",
    "(nepovinné · max 6, každá do 8 MB)\t(optional, max 6, each up to 8 MB)",
    "Jednou za čas řekne fotka víc než váha, pomůže tobě i Martinovi vidět proměnu. Ale\tNow and then a photo says more than the scale. It helps you and Martin see the change. But",
    "nikdy to není povinnost\tit is never required",
    ": foť se, jen když se cítíš pohodlně. Sem patří i\t: take photos only when you feel comfortable. This is also the place for",
    "export nebo screenshot jídelníčku z Kalorických tabulek\ta food-log export or screenshot from Kaloricke tabulky",
    ": Martin pak vidí detail toho, co jsi reálně jedl/a.\t: Martin then sees the detail of what you actually ate.",
    "Vidíte je jen ty a Martin (tvoje soukromé úložiště). Kromě fotek jde přiložit i\tOnly you and Martin can see them (your private storage). Besides photos you can also attach",
    "PDF/XLS export jídelníčku z Kalorických tabulek\ta PDF or XLS food-log export from Kaloricke tabulky",
    "Souhrn: zkontroluj a odešli\tSummary: check it and send",
    "Po odeslání přijde hezky zpracovaný report mailem tobě i Martinovi.\tAfter you send, a clear report goes by email to you and to Martin.",
    "Upravit\tEdit",
    "Týdenní průměr\tWeekly average",
    "Tento týden\tThis week",
    "Tentokrát\tThis time",
    "přeskočeno\tskipped",
    "Strava\tFood",
    "Strava Ø\tFood, avg",
    "Tenhle týden\tThis week",
    "Za tohle období\tThis period",
    "strava nezapsána\tfood not logged",
    "Zapsáno dní\tDays logged",
    "Aktivity\tTraining",
    "za týden\tper week",
    "Sport celkem\tTraining total",
    "Další\tOther",
    "stejně jako tento týden\tsame as this week",
    "stejně jako dosud\tsame as so far",
    "Režim\tSetup",
    "Pocity\tHow you felt",
    "Síla\tStrength",
    "Spánek\tSleep",
    "Slovně\tIn words",
    "Povedlo se\tWent well",
    "Drhlo\tWas hard",
    "Otázky\tQuestions",
    "Navíc\tExtra",
    "Fotky\tPhotos",
    "Přiloženo\tAttached",
    "Odeslat report 📨\tSend report",
    "Něco o tobě\tAbout you",
    "Základ, ať Martin počítá s reálnými čísly.\tThe basics, so Martin works from real numbers.",
    "Věk\tAge",
    "let\tyears",
    "Výška\tHeight",
    "Aktuální váha\tCurrent weight",
    "Váha je tady jednorázová, jen pro výpočet plánu, zvaž se ráno nalačno. A nelekej se jí: běžně kolísá o\tWeight here is a one-off, only for setting the plan. Weigh in the morning, fasted. Do not panic: it commonly moves by",
    ", i když hubneš. Trend pak hlídáme v týdenních reportech spolu s mírami.\t, even while you are losing fat. We then watch the trend in the weekly reports, together with measurements.",
    "Telefon\tPhone",
    "Tvůj cíl\tYour goal",
    "Čím konkrétněji, tím líp. „Zhubnout 8 kg do Vánoc“ je lepší než „zhubnout“.\tThe more specific, the better. \"Lose 8 kg by Christmas\" is better than \"lose weight\".",
    "Čeho chceš dosáhnout?\tWhat do you want to achieve?",
    "váha, postava, síla, zdraví…\tweight, shape, strength, health...",
    "Proč to chceš? Co se změní, až to dokážeš?\tWhy do you want it? What changes when you get there?",
    "tvoje motivace, k té se budeme vracet\tyour reason, we will come back to it",
    "Do kdy / kvůli jaké události?\tBy when, or for what event?",
    "např. svatba v září, dovolená…\te.g. a wedding in September, a holiday...",
    "Napiš prosím svůj cíl.\tPlease write your goal.",
    "Napiš prosím i svoje proč, je důležitější, než se zdá.\tPlease also write your why. It matters more than it seems.",
    "Co už máš za sebou\tWhat you have already tried",
    "Diety, výkyvy váhy, sporty, ať Martin neopakuje, co u tebe nefungovalo.\tDiets, weight swings, sports, so Martin does not repeat what did not work for you.",
    "Diety a hubnutí v minulosti\tDiets and fat loss in the past",
    "co jsi zkoušel/a a jak to dopadlo\twhat you tried and how it went",
    "Sport dřív a teď\tSport then and now",
    "co jsi dělal/a a co děláš teď\twhat you used to do and what you do now",
    "Zdraví\tHealth",
    "⚠️ Jen pro Martina, ať plán ničemu neublíží.\t⚠️ For Martin only, so the plan does not work against you.",
    "Nenahrazuje lékaře\tThis does not replace a doctor",
    ": zdravotní potíže vždy řeš primárně s ním.\t: always deal with health problems with a doctor first.",
    "Zdravotní omezení / diagnózy\tHealth limits / diagnoses",
    "klouby, záda, štítná žláza, tlak…\tjoints, back, thyroid, blood pressure...",
    "Léky a doplňky, které bereš\tMedication and supplements you take",
    "Alergie a intolerance\tAllergies and intolerances",
    "laktóza, lepek, ořechy…\tlactose, gluten, nuts...",
    "Jídlo\tFood",
    "Plán musí sedět tobě, ne ty plánu.\tThe plan has to fit you, not the other way around.",
    "Co nejíš / nesnášíš?\tWhat do you not eat, or cannot stand?",
    "Kolik jídel denně ti vyhovuje?\tHow many meals a day suits you?",
    "Kdo ti vaří / jak se přes den stravuješ?\tWho cooks, and how do you eat during the day?",
    "vařím si / partner/ka / kantýna / restaurace…\tI cook / partner / canteen / restaurants...",
    "Vyber počet jídel denně.\tPick how many meals a day.",
    "Trénink\tTraining",
    "Reálné možnosti > ideální plán, který nedáš.\tWhat you can actually do beats a perfect plan you will not follow.",
    "Kde můžeš cvičit?\tWhere can you train?",
    "Fitko i doma\tGym and at home",
    "Doma\tAt home",
    "Zatím nikde\tNowhere yet",
    "Kolik dní v týdnu reálně stíháš?\tHow many days a week can you really train?",
    "Vybavení doma (pokud cvičíš doma)\tEquipment at home (if you train at home)",
    "činky, gumy, hrazda…\tdumbbells, bands, a pull-up bar...",
    "Vyber, kde můžeš cvičit.\tPick where you can train.",
    "Vyber počet dní v týdnu.\tPick how many days a week.",
    "Tvůj den\tYour day",
    "Směny, pohyb a režim rozhodují o tom, jak plán poskládat.\tShifts, movement and your schedule decide how the plan is built.",
    "Práce a režim dne\tWork and daily schedule",
    "sedavá / na nohou / směny, jaké?\tdesk / on your feet / shifts, which?",
    "Úroveň aktivity přes den\tActivity level during the day",
    "Sedavá\tSedentary",
    "Lehce aktivní\tLightly active",
    "Aktivní\tActive",
    "Velmi aktivní\tVery active",
    "Kroky denně: kolik cca reálně dáš?\tSteps a day: about how many can you really do?",
    "mrkni do mobilu / hodinek\tcheck your phone or watch",
    "Popiš prosím práci a režim dne.\tPlease describe your work and daily schedule.",
    "Vyber úroveň aktivity přes den.\tPick your activity level during the day.",
    "odhad kroků za den\tyour estimate of steps per day",
    "Výchozí míry (cm)\tStarting measurements (cm)",
    "Startovní čára pro grafy:\tA starting line for the charts:",
    "zaberou celé tělo, s váhou dohromady je to pro Martina dost dat na přesné úpravy. Měř ráno, volně, bez zatahování břicha.\tthey cover the whole body. Together with weight, that is enough for Martin to adjust the plan well. Measure in the morning, relaxed, without sucking your stomach in.",
    "Změř prosím aspoň pas nebo boky, bez startovní čáry nejde měřit pokrok.\tPlease measure at least waist or hips. Without a starting line there is nothing to measure progress against.",
    "Výchozí fotky (nepovinné)\tStarting photos (optional)",
    "Startovní čára pro pozdější porovnání proměny, za pár měsíců za ně budeš rád/a. Ale\tA starting line so you can compare later. In a few months you will be glad you have them. But",
    ": foť se, jen když se cítíš pohodlně.\t: take photos only when you feel comfortable.",
    "Ještě něco?\tAnything else?",
    "Cokoliv, co by měl Martin vědět a nikam se to nevešlo. Bez omezení délky, klidně román.\tAnything Martin should know that did not fit elsewhere. No length limit.",
    "Vzkaz pro Martina\tNote for Martin",
    "piš, kolik potřebuješ\twrite as much as you need",
    "Po odeslání dostaneš kopii mailem a Martin ti do\tAfter you send, you get a copy by email and Martin will",
    "48 hodin\t48 hours",
    "nastaví plán.\tset your plan.",
    "O tobě\tAbout you",
    "Cíl\tGoal",
    "Proč\tWhy",
    "Termín\tDeadline",
    "Historie\tHistory",
    "Diety\tDiets",
    "Sport\tSport",
    "Omezení\tLimits",
    "Léky\tMedication",
    "Alergie\tAllergies",
    "Nejí\tDoes not eat",
    "Jídel denně\tMeals a day",
    "Vaření\tCooking",
    "Kde\tWhere",
    "Dní/týden\tDays/week",
    "Vybavení\tEquipment",
    "Práce\tWork",
    "Aktivita\tActivity",
    "Kroky/den\tSteps/day",
    "Poznámka\tNote",
    "Vzkaz\tNote",
    "Odeslat dotazník 📨\tSend questionnaire",
    "Nahrávám fotky…\tUploading photos...",
    "Odesílám…\tSending...",
    "Zkusit odeslat znovu\tTry sending again",
    "Fotky se nepodařilo nahrát, zkus to znovu, nebo je v kroku Fotky odeber.\tThe photos did not upload. Try again, or remove them in the Photos step.",
    "Odeslání se nepovedlo, tvoje odpovědi jsou uložené, zkus to za chvíli znovu.\tSending failed. Your answers are saved. Try again in a little while.",
    "Odeslání se nepovedlo, zkus to znovu.\tSending failed. Try again.",
    "Kopie ti právě letí na e-mail (mrkni i do hromadných). Martin se ozve.\tA copy is on its way to your email (check the promotions tab too). Martin will reply.",
    "Zpět do sekce\tBack to your page",
    "Report odeslán!\tReport sent!",
    "Dotazník odeslán!\tQuestionnaire sent!",
    "Zavřít? Rozpracované odpovědi zůstanou uložené v tomhle prohlížeči.\tClose? Your draft answers stay saved in this browser.",
    "Načítám…\tLoading...",
    "Sekce se nepodařilo načíst, obnov prosím stránku.\tThe page did not load. Please refresh.",
    "Sekce vyžaduje připojení, zkus to prosím později.\tThis page needs a connection. Please try again later.",
    "Nepodařilo se načíst data. Zkus obnovit stránku.\tThe data did not load. Try refreshing the page.",
    "První report odemkne grafy pokroku. Naklikáš ho za ~3 minuty.\tYour first report opens the progress charts. It takes about 3 minutes.",
    "První report odemkne zbytek grafů. Startovní váhu a míry už máme z dotazníku.\tYour first report opens the rest of the charts. We already have your starting weight and measurements from the questionnaire.",
    "doplní se, až pošleš váhu podruhé\tthis fills in after you send your weight a second time",
    "zatím žádný\tnone yet",
    "Poslední report:\tLast report:",
    ". Kopie přijde tobě i Martinovi.\t. A copy goes to you and to Martin.",
    "z reportu\tfrom the report",
    "ze vstupního dotazníku\tfrom the intake questionnaire",
    "od začátku (\tsince the start (",
    "první\tfirst",
    "Posledních\tLast",
    "týdnů\tweeks",
    "Celá tvoje historie\tYour full history",
    "V tomhle období nemáš žádný report. Přepni na delší období.\tYou have no report in this period. Switch to a longer period.",
    "V tomhle období nemáš žádný report.\tYou have no report in this period.",
    "Zatím málo dat, doplní se z reportů.\tNot enough data yet. It fills in from reports.",
    "Ø kalorie\tAvg calories",
    "Ø bílkoviny\tAvg protein",
    "Ø kroky\tAvg steps",
    "Ø dodržení\tAvg adherence",
    "přesně\texactly",
    "(přesně)\t(exactly)",
    "· cíl\t· target",
    "cíl teď\ttarget now",
    "(cíl teď\t(target now",
    "· aktuální cíl\t· current target",
    "tvůj aktuální cíl od Martina:\tyour current target from Martin:",
    "🎯 Tvoje zadání na tento týden\t🎯 Your targets for this week",
    "Zadal Martin\tSet by Martin",
    ". Co k tomu potřebuješ probrat, napiš do reportu.\t. If you want to talk any of this through, put it in the report.",
    "Kalorie\tCalories",
    "kcal/den\tkcal/day",
    "g/den\tg/day",
    "Ø/den\tavg/day",
    "min/týden\tmin/week",
    "×/týden\tx/week",
    "Sport celkem\tTraining total",
    "Tréninky\tSessions",
    "Hruď\tChest",
    "hruď\tchest",
    "Boky\tHips",
    "boky\thips",
    "Zadek\tGlutes",
    "P stehno\tR thigh",
    "L stehno\tL thigh",
    "P lýtko\tR calf",
    "L lýtko\tL calf",
    "P paže\tR arm",
    "L paže\tL arm",
    "Krk\tNeck",
    "Pupík\tBelly",
    "Průvodce koučinkem\tCoaching guide",
    "Tréninkový plán\tTraining plan",
    "Jídelníček na míru\tCustom meal plan",
    "· pro všechny klienty\t· for all clients",
    "Prohlížeč zablokoval nové okno.\tThe browser blocked the new window.",
    "Dokument se nepodařilo otevřít, zkus to znovu.\tThe file did not open. Try again.",
    "Soubor se nepodařilo stáhnout, zkus to znovu.\tThe file did not download. Try again.",
    "Dokumenty se teď nepodařilo načíst. Zkus obnovit stránku, kdyby to nepomohlo, napiš mi.\tThe files did not load. Refresh the page. If that does not help, message me.",
    "nenačteno, obnov stránku\tdid not load, refresh the page",
    "Fotka z\tPhoto from",
    "denní rozpis stravy\tday-by-day food log",
    "🍽️ Tvůj denní rozpis, tady vidíš, co se kdy dělo:\t🍽️ Your day-by-day log, so you can see what happened when:",
    "Graf se doplní z reportů.\tThe chart fills in from reports.",
    "Obrázek se nepodařilo vytvořit.\tThe image could not be created.",
    "martinbarna.cz · osobní koučink\tmartinbarna.cz · personal coaching",
    "moje-vaha.png\tmoje-vaha.png",
    "Napiš prosím pár vět, tvoje slova jsou to nejcennější.\tPlease write a few sentences. Your own words matter most.",
    "Zaškrtni prosím souhlas, bez něj to Martin nepoužije.\tPlease check the consent box. Without it Martin will not use this.",
    "✅ Díky! Martin se ti ozve, a tvoje cesta může inspirovat další.\t✅ Thanks. Martin will reply, and your progress can help other people start.",
    "Maximálně 6 příloh na jeden report.\t6 attachments maximum on one report.",
    "má přes 8 MB, pošli běžnou kvalitu z mobilu.\tis over 8 MB. Send a normal phone photo.",
    ", přikládej fotky, PDF nebo XLS.\t: attach photos, PDF or XLS.",
    "Čtečku XLS se nepodařilo načíst, zkontroluj připojení.\tThe XLS reader did not load. Check your connection.",
    "V souboru jsem nenašel jídelníček, přilož ho prosím v kroku Fotky a přílohy a průměry vyplň ručně.\tI did not find a meal log in that file. Attach it in Photos and files and fill the averages in by hand.",
    "Soubor se nepodařilo přečíst.\tThe file could not be read.",
    "Čtu export…\tReading the export...",
    "✅ Průměry nahoře jsem dopočítal z rozpisu. Zapsaných dní:\t✅ I filled the averages above from the day log. Days logged:",
    "Rozpracovaná strava v konceptu byla z jiného období, smazal jsem ji. Ostatní odpovědi zůstaly.\tThe food draft was from a different period, so I cleared it. Your other answers stayed.",
    "Tvoje období:\tYour period:",
    "Za tohle období už report máš. Když ho pošleš znovu, Martin dostane opravenou verzi.\tYou already have a report for this period. If you send it again, Martin gets the corrected version.",
    "Report sahá nejvýš 4 týdny zpátky, proto tentokrát bere jen posledních\tA report goes back 4 weeks at most, so this time it only covers the last",
    "⚠️ Období reportu se teď nepodařilo načíst, formulář proto bere jeden týden: denní rozpis Po až Ne a z exportu posledních 7 dní. Jestli máš report za víc než týden, zavři ho a zkus to za chvíli znovu.\t⚠️ The report period did not load, so the form uses one week: days Mon to Sun, and the last 7 days from an export. If your report covers more than a week, close it and try again in a moment.",
    "Vyplň prosím\tPlease fill in",
    "vypadá mimo rozsah\tlooks out of range",
    ", zkontroluj překlep.\t, check for a typo.",
    "Hodnota „\tThe value \"",
    "“ vypadá jako překlep, zkontroluj ji.\t\" looks like a typo, check it.",
    "průměrné kalorie\taverage calories",
    "průměrné bílkoviny\taverage protein",
    "průměrné kroky\taverage steps",
    "váhu\tweight",
    "věk\tage",
    "výšku\theight",
    "bílkoviny:\tprotein:",
    "sacharidy:\tcarbs:",
    "tuky:\tfat:",
    "vláknina:\tfiber:",
    "Sacharidy:\tCarbs:",
    "Tuky:\tFat:",
    "Vláknina:\tFiber:",
    "kcal:\tcalories:",
    "Po\tMon",
    "Út\tTue",
    "St\tWed",
    "Čt\tThu",
    "Pá\tFri",
    "So\tSat",
    "Ne\tSun",
    "den\tday",
    "dny\tdays",
    "dní\tdays",
    "ů\ts",
    "y\ts",
    "0 až\t0 to",
    "z appky\tfrom the app",
    "bílkoviny\tprotein",
    "dodržení\tadherence",
    "síla\tstrength",
    "únava\tfatigue",
    ". Co k tomu potřebuješ probrat, napiš do reportu.\t. If you want to talk about it, put it in the report.",
    "(na webu KT: ikona šipky dolů v hlavičce jídelníčku →\t(on the KT website: the down arrow in the meal-plan header, then",
    "(voda, glykogen, plné břicho, u žen cyklus), i když hubneš. Trend pak hlídáme v týdenních reportech spolu s mírami.\t(water, glycogen, a full stomach, and for women the cycle), even while you are losing fat. We then watch the trend in the weekly reports, together with measurements.",
    "Vyplň prosím pole.\tPlease fill in the field."
  ];

  for (var i = 0; i < LINES.length; i++) {
    var line = LINES[i];
    var tab = line.indexOf("\t");
    if (tab < 1) continue;
    PHRASE[line.slice(0, tab)] = line.slice(tab + 1);
  }

  var DIA = /[áčďéěíňóřšťúůýžÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ]/;
  var LONG = Object.keys(PHRASE).filter(function (k) { return k.length >= 12; }).sort(function (a, b) { return b.length - a.length; });

  function word(cs) {
    return Object.prototype.hasOwnProperty.call(PHRASE, cs) ? PHRASE[cs] : cs;
  }

  function rangeEn(s) {
    return String(s).replace(/\u2013/g, " to ").replace(/-/g, " to ");
  }

  var PATTERNS = [
    [/^Posledních (\d+) týdnů$/, function (m) { return "Last " + m[1] + " weeks"; }],
    [/^\((\d+) reports?\)$/, function (m) { return "(" + m[1] + (m[1] === "1" ? " report" : " reports") + ")"; }],
    [/^\((\d+) reporty\)$/, function (m) { return "(" + m[1] + " reports)"; }],
    [/^\((\d+) reportů\)$/, function (m) { return "(" + m[1] + " reports)"; }],
    [/^z reportu (.+)$/, function (m) { return "from the report " + m[1]; }],
    [/^ze vstupního dotazníku (.+)$/, function (m) { return "from the intake questionnaire " + m[1]; }],
    [/^od začátku \((.+)\)$/, function (m) { return "since the start (" + m[1] + ")"; }],
    [/^první (.+)$/, function (m) { return "first " + m[1]; }],
    [/^Poslední report: (.+?)\. Kopie přijde tobě i Martinovi\.$/, function (m) { return "Last report: " + m[1] + ". A copy goes to you and to Martin."; }],
    [/^Poslední report: (.+)$/, function (m) { return "Last report: " + m[1]; }],
    [/^Zadal Martin( .+)?\. Co k tomu potřebuješ probrat, napiš do reportu\.$/, function (m) { return "Set by Martin" + (m[1] || "") + ". If you want to talk about it, put it in the report."; }],
    [/^denní průměr v týdnu \(kcal\)(?: · aktuální cíl (.+))?$/, function (m) { return "daily average for the week (kcal)" + (m[1] ? " · current target " + m[1] : ""); }],
    [/^denní průměr v týdnu \(g\)(?: · aktuální cíl (.+))?$/, function (m) { return "daily average for the week (g)" + (m[1] ? " · current target " + m[1] : ""); }],
    [/^cíl teď (.+)$/, function (m) { return "target now " + m[1]; }],
    [/^tvůj aktuální cíl od Martina: (.+)$/, function (m) { return "your current target from Martin: " + m[1]; }],
    [/^Fotka z (.+)$/, function (m) { return "Photo from " + m[1]; }],
    [/^Vyplň prosím (.+)\.$/, function (m) { return "Please fill in " + word(m[1]) + "."; }],
    [/^(.+) vypadá mimo rozsah \((.+)\), zkontroluj překlep\.$/, function (m) { return word(m[1]) + " looks out of range (" + rangeEn(m[2]) + "), check for a typo."; }],
    [/^Hodnota „(.+)“ vypadá jako překlep, zkontroluj ji\.$/, function (m) { return "The value \"" + m[1] + "\" looks like a typo, check it."; }],
    [/^([^:]+): Hodnota „(.+)“ vypadá jako překlep, zkontroluj ji\.$/, function (m) { return word(m[1]) + ": the value \"" + m[2] + "\" looks like a typo, check it."; }],
    [/^Naklikej prosím (.+) \(1[\u2013-]5\)\.$/, function (m) { return "Please tap " + word(m[1]) + " (1 to 5)."; }],
    [/^Strava: průměr za (\d+) (den|dny|dní)$/, function (m) { return "Food: average over " + m[1] + (m[1] === "1" ? " day" : " days"); }],
    [/^Kolik dní z (\d+) jsi zapisoval\/a\?$/, function (m) { return "How many of the " + m[1] + " days did you log?"; }],
    [/^(\d+) den$/, function (m) { return m[1] + " day"; }],
    [/^(\d+) dny$/, function (m) { return m[1] + " days"; }],
    [/^(\d+) dní$/, function (m) { return m[1] + " days"; }],
    [/^0 až (\d+)$/, function (m) { return "0 to " + m[1]; }],
    [/^Počet zapsaných dní je celé číslo od 0 do (\d+)\.$/, function (m) { return "Logged days have to be a whole number from 0 to " + m[1] + "."; }],
    [/^Report sahá nejvýš 4 týdny zpátky, proto tentokrát bere jen posledních (\d+) (den|dny|dní)\.$/, function (m) { return "A report goes back 4 weeks at most, so this time it only covers the last " + m[1] + (m[1] === "1" ? " day" : " days") + "."; }],
    [/^✅ Průměry nahoře jsem dopočítal z rozpisu\. Zapsaných dní: (\d+)\.$/, function (m) { return "✅ I filled the averages above from the day log. Days logged: " + m[1] + "."; }],
    [/^✅ Načteno (\d+) (den|dny|dní) z tvého období(?:, (\d+) (den|dny|dní) mimo období jsem vynechal)?\. Zkontroluj čísla a pokračuj\.$/, function (m) {
      var out = "✅ Loaded " + m[1] + (m[1] === "1" ? " day" : " days") + " from your period";
      if (m[3]) out += ", skipped " + m[3] + (m[3] === "1" ? " day" : " days") + " outside the period";
      return out + ". Check the numbers and continue.";
    }],
    [/^✅ Načteno (\d+) dní z Kalorických tabulek, zkontroluj čísla a pokračuj\.$/, function (m) { return "✅ Loaded " + m[1] + " days from Kaloricke tabulky. Check the numbers and continue."; }],
    [/^V exportu není žádný zapsaný den z tvého období \((.+)\)\. V Kalorických tabulkách vyber tyhle dny a stáhni export znovu\.$/, function (m) { return "The export has no logged day from your period (" + m[1] + "). In Kaloricke tabulky, select those days and download the export again."; }],
    [/^Průvodce koučinkem \((.+)\)$/, function (m) { return "Coaching guide (" + m[1] + ")"; }],
    [/^Tréninkový plán \((.+)\)$/, function (m) { return "Training plan (" + m[1] + ")"; }],
    [/^Jídelníček na míru \((.+)\)$/, function (m) { return "Custom meal plan (" + m[1] + ")"; }],
    [/^vyber dny (.+)$/, function (m) { return "select the days " + trCore(m[1], 1); }],
    [/^(.+) má přes 8 MB, pošli běžnou kvalitu z mobilu\.$/, function (m) { return m[1] + " is over 8 MB. Send a normal phone photo."; }],
    [/^(.+), přikládej fotky, PDF nebo XLS\.$/, function (m) { return m[1] + ": attach photos, PDF or XLS."; }],
    [/^(.+) kcal: (.+)$/, function (m) { return m[1] + " calories: " + trCore(m[2], 1); }],
    [/^(.+) bílkoviny: (.+)$/, function (m) { return m[1] + " protein: " + trCore(m[2], 1); }],
    [/^(.+) sacharidy: (.+)$/, function (m) { return m[1] + " carbs: " + trCore(m[2], 1); }],
    [/^(.+) tuky: (.+)$/, function (m) { return m[1] + " fat: " + trCore(m[2], 1); }],
    [/^(.+) vláknina: (.+)$/, function (m) { return m[1] + " fiber: " + trCore(m[2], 1); }],
    [/^Plán: (.+)$/, function (m) { return "Plan: " + trCore(m[1], 1); }],
    [/^Spánek: (.+)$/, function (m) { return "Sleep: " + trCore(m[1], 1); }],
    [/^Sacharidy: (.+)$/, function (m) { return "Carbs: " + trCore(m[1], 1); }],
    [/^Tuky: (.+)$/, function (m) { return "Fat: " + trCore(m[1], 1); }],
    [/^Vláknina: (.+)$/, function (m) { return "Fiber: " + trCore(m[1], 1); }],
    [/^(.+): (.+) vypadá mimo rozsah \((.+)\), zkontroluj překlep\.$/, function (m) { return word(m[1]) + ": " + trCore(m[2] + " vypadá mimo rozsah (" + m[3] + "), zkontroluj překlep.", 1); }]
  ];

  function applyPat(s) {
    for (var i = 0; i < PATTERNS.length; i++) {
      var m = PATTERNS[i][0].exec(s);
      if (m) return PATTERNS[i][1](m);
    }
    return null;
  }

  function trCore(s, depth) {
    if (s == null) return s;
    if (Object.prototype.hasOwnProperty.call(PHRASE, s)) return PHRASE[s];
    if (depth > 2) return s;
    var pat = applyPat(s);
    if (pat != null) return pat;
    if (!DIA.test(s)) return s;
    var out = s;
    for (var i = 0; i < LONG.length; i++) {
      var k = LONG[i];
      if (out.indexOf(k) !== -1) out = out.split(k).join(PHRASE[k]);
    }
    return out;
  }

  function polish(s) {
    return String(s)
      .replace(/(\d+) dní/g, "$1 days")
      .replace(/(\d+) dny/g, "$1 days")
      .replace(/(\d+) den\b/g, "$1 day")
      .replace(/cíl teď/g, "target now")
      .replace(/ · cíl /g, " · target ")
      .replace(/\(přesně\)/g, "(exactly)");
  }

  function trText(s) {
    if (typeof s !== "string") return s;
    if (lang !== "en") return s;
    var m = /^(\s*)([\s\S]*?)(\s*)$/.exec(s);
    if (!m || !m[2]) return s;
    var core = m[2].replace(/\s+/g, " ").trim();
    var hit = trCore(core, 0);
    if (hit === core && m[2] !== core) hit = trCore(m[2], 0);
    return m[1] + polish(hit) + m[3];
  }

  function trAttr(part) {
    return part.replace(/\b(placeholder|aria-label|title|alt)="([^"]*)"/g, function (_all, attr, val) {
      return attr + "=\"" + trText(val).replace(/"/g, "&quot;") + "\"";
    });
  }

  function trHtml(html) {
    if (lang !== "en" || typeof html !== "string") return html;
    if (html.indexOf("<") < 0) return trText(html);
    var saved = [];
    function stash(block) {
      saved.push(block);
      return "<i data-keep=\"" + (saved.length - 1) + "\"></i>";
    }
    var h = html.replace(/<textarea\b[^>]*>[\s\S]*?<\/textarea>/gi, function (block) {
      var open = block.match(/^<textarea\b[^>]*>/i)[0];
      var inner = block.slice(open.length, block.length - 11);
      return stash(trAttr(open) + inner + "</textarea>");
    });
    h = h.replace(/<span\b[^>]*\bdata-user="1"[^>]*>[\s\S]*?<\/span>/gi, function (block) { return stash(block); });
    h = h.split(/(<[^>]+>)/).map(function (part) {
      if (!part) return part;
      if (part.charAt(0) === "<") return trAttr(part);
      return trText(part);
    }).join("");
    return h.replace(/<i data-keep="(\d+)"><\/i>/g, function (_a, n) { return saved[+n]; });
  }

  var MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  function dateEn(d) {
    return MON[d.getMonth()] + " " + d.getDate() + ", " + d.getFullYear();
  }
  function isoKratceEn(iso, withYear) {
    var p = String(iso).split("-");
    var s = MON[+p[1] - 1] + " " + (+p[2]);
    if (withYear) s += ", " + p[0];
    return s;
  }
  function popisObdEn(od, d) {
    if (od === d) return isoKratceEn(od, true);
    return isoKratceEn(od, od.slice(0, 4) !== d.slice(0, 4)) + " to " + isoKratceEn(d, true);
  }
  function axisDenEn(d) { return MON[d.getMonth()] + " " + d.getDate(); }
  function slovoDniEn(n) { return n + (n === 1 ? " day" : " days"); }

  var DAY = { "Po": "Mon", "Út": "Tue", "St": "Wed", "Čt": "Thu", "Pá": "Fri", "So": "Sat", "Ne": "Sun" };
  function dayLabel(den) {
    if (lang !== "en") return den;
    return Object.prototype.hasOwnProperty.call(DAY, den) ? DAY[den] : den;
  }

  function personalTitle(kind) {
    var map = { pruvodce: "Coaching guide", trenink: "Training plan", jidelnicek: "Custom meal plan" };
    return map[String(kind || "").toLowerCase()] || "";
  }
  function hezkyNazevEn(kind, year, month, day) {
    var name = personalTitle(kind) || String(kind || "");
    var d = new Date(Date.UTC(+year, +month - 1, +day, 12));
    return name + " (" + MON[d.getUTCMonth()] + " " + d.getUTCDate() + ", " + d.getUTCFullYear() + ")";
  }

  var EN_MATERIALS = {
    "denik-navyku": { title: "Habit tracker (weekly sheet)", pdf: "/materialy/pdf/en/denik-navyku.pdf" },
    "flexibilni-strava": { title: "Flexible eating", pdf: "/materialy/pdf/en/flexibilni-strava.pdf" },
    "jidlo-v-restauraci": { title: "Eating out and on the road", pdf: "/materialy/pdf/en/jidlo-v-restauraci.pdf" },
    "kroky-a-cardio": { title: "Steps, NEAT and cardio: how much and when", pdf: "/materialy/pdf/en/kroky-a-cardio.pdf" },
    "plato-zastavena-vaha": { title: "Plateau: when your weight stops moving", pdf: "/materialy/pdf/en/plato-zastavena-vaha.pdf" },
    "porce-bez-vazeni": { title: "Portions without weighing", pdf: "/materialy/pdf/en/porce-bez-vazeni.pdf" },
    "uvitaci-balicek": { title: "Welcome to working together", pdf: "/materialy/pdf/en/uvitaci-balicek.pdf" },
    "vikendove-prejidani": { title: "How to handle weekend overeating", pdf: "/materialy/pdf/en/vikendove-prejidani.pdf" },
    "high-protein-recepty": { title: "Protein and high-protein recipes", pdf: "/materialy/pdf/en/high-protein-recepty.pdf" },
    "hydratace-pitny-rezim": { title: "Hydration", pdf: "/materialy/pdf/en/hydratace-pitny-rezim.pdf" },
    "jak-cist-studie": { title: "How to read a scientific study", pdf: "/materialy/pdf/en/jak-cist-studie.pdf" },
    "spanek-a-regenerace": { title: "Sleep and recovery", pdf: "/materialy/pdf/en/spanek-a-regenerace.pdf" },
    "stres-a-kortizol": { title: "Stress, cortisol and fat loss", pdf: "/materialy/pdf/en/stres-a-kortizol.pdf" },
    "suplementy-co-funguje": { title: "Supplements: what works and what is a waste of money", pdf: "/materialy/pdf/en/suplementy-co-funguje.pdf" },
    "treninkovy-plan": { title: "Training plan: effective strength training", pdf: "/materialy/pdf/en/treninkovy-plan.pdf" },
    "tydenni-checkin": { title: "Weekly check-in", pdf: "/materialy/pdf/en/tydenni-checkin.pdf" },
    "vstupni-dotaznik": { title: "Intake questionnaire", pdf: "/materialy/pdf/en/vstupni-dotaznik.pdf" },
    "zacni-cvicit": { title: "How to start training: a guide for complete beginners", pdf: "/materialy/pdf/en/zacni-cvicit.pdf" },
    "eating-out-playbook": { title: "The Eating Out Playbook", pdf: "/download/eating-out-playbook.pdf" }
  };
  var CZECH_ONLY = { "kucharka": 1, "lead-system-trener": 1, "prvni-konzultace": 1 };

  function materialSlug(name) {
    return String(name || "").replace(/\.[^.]+$/i, "").replace(/-v\d+$/i, "");
  }
  function materialView(name) {
    var raw = String(name || "");
    if (/^(pruvodce|trenink|jidelnicek)-\d{4}-\d{2}-\d{2}\.html?$/i.test(raw)) return null;
    var slug = materialSlug(raw);
    if (Object.prototype.hasOwnProperty.call(EN_MATERIALS, slug)) {
      var row = EN_MATERIALS[slug];
      return { hide: false, page: "/en/materials/" + slug + "/", pdf: row.pdf, title: row.title, slug: slug };
    }
    if (Object.prototype.hasOwnProperty.call(CZECH_ONLY, slug)) return { hide: true, slug: slug };
    return null;
  }

  function resolveLang(row) {
    try {
      if (!row || typeof row !== "object") return "cs";
      return row.jazyk === "en" ? "en" : "cs";
    } catch (e) {
      return "cs";
    }
  }

  function reportPayload(a, obd) {
    var ac = a.activity || {};
    if (a.plan) ac.plan_next = a.plan;
    return {
      weight: a.weight,
      measurements: a.measurements || {},
      nutrition: a.nutrition === null ? null : (a.nutrition || {}),
      activity: ac,
      scales: a.scales || {},
      notes: a.notes || {},
      obdobi: obd ? { od: obd.od, "do": obd["do"] } : undefined
    };
  }

  function applyStatic(rootEl) {
    if (lang !== "en" || !rootEl || typeof document === "undefined") return;
    var walker = document.createTreeWalker(rootEl, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        var p = n.parentNode;
        if (!p || p.nodeName === "SCRIPT" || p.nodeName === "STYLE") return NodeFilter.FILTER_REJECT;
        if (p.closest && p.closest("[data-user]")) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    var nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(function (n) {
      var next = trText(n.nodeValue);
      if (next !== n.nodeValue) n.nodeValue = next;
    });
    if (rootEl.querySelectorAll) {
      rootEl.querySelectorAll("[placeholder],[aria-label],[title],[alt]").forEach(function (el) {
        ["placeholder", "aria-label", "title", "alt"].forEach(function (attr) {
          if (!el.hasAttribute(attr)) return;
          el.setAttribute(attr, trText(el.getAttribute(attr)));
        });
      });
    }
  }

  function hideAi() {
    if (lang !== "en" || typeof document === "undefined") return;
    var buttons = document.querySelectorAll("body > button");
    for (var i = 0; i < buttons.length; i++) {
      var st = buttons[i].getAttribute("style") || "";
      if (st.indexOf("99998") !== -1) buttons[i].remove();
    }
    var panel = document.getElementById("amPanel");
    if (panel) panel.remove();
  }

  function pointWhatsApp() {
    if (lang !== "en" || typeof document === "undefined") return;
    var links = document.querySelectorAll('a[href*="wa.me/420603229831"]');
    for (var i = 0; i < links.length; i++) {
      links[i].href = "https://wa.me/420603229831?text=Hi%20Martin%2C%20";
    }
  }

  function installHooks() {
    if (hooksOn || typeof Element === "undefined") return;
    hooksOn = true;
    var tc = Object.getOwnPropertyDescriptor(Node.prototype, "textContent");
    var ih = Object.getOwnPropertyDescriptor(Element.prototype, "innerHTML");
    if (!tc || !ih || !tc.set || !ih.set) return;
    Object.defineProperty(Element.prototype, "textContent", {
      configurable: true,
      enumerable: tc.enumerable,
      get: function () { return tc.get.call(this); },
      set: function (v) {
        if (lang === "en" && typeof v === "string" && this.nodeName !== "SCRIPT" && this.nodeName !== "STYLE") {
          var skip = false;
          try { skip = !!(this.closest && this.closest("[data-user]")); } catch (e) { skip = false; }
          if (!skip) v = trText(v);
        }
        return tc.set.call(this, v);
      }
    });
    Object.defineProperty(Element.prototype, "innerHTML", {
      configurable: true,
      enumerable: ih.enumerable,
      get: function () { return ih.get.call(this); },
      set: function (v) {
        if (lang === "en" && typeof v === "string" && this.nodeName !== "SCRIPT" && this.nodeName !== "STYLE") v = trHtml(v);
        return ih.set.call(this, v);
      }
    });
  }

  function activate(next) {
    lang = next === "en" ? "en" : "cs";
    if (typeof document === "undefined") return;
    installHooks();
    if (lang === "en") {
      document.documentElement.lang = "en";
      if (PHRASE[document.title]) document.title = PHRASE[document.title];
      else document.title = trText(document.title);
      applyStatic(document.body);
      pointWhatsApp();
      hideAi();
    }
  }

  function previewEn() {
    try {
      var q = "";
      if (typeof location !== "undefined" && location && location.search) q = String(location.search);
      return /(?:^|[?&])lang=en(?:&|$)/.test(q);
    } catch (e) {
      return false;
    }
  }

  function bootPage() {
    previewOn = previewEn();
    // Hooky na textContent/innerHTML jen v angličtině (activate je nainstaluje). Český klient = nic nepatchujeme.
    if (previewOn) activate("en");
    if (typeof window !== "undefined" && window.addEventListener) {
      window.addEventListener("load", function () {
        if (lang !== "en") return;
        hideAi();
        setTimeout(hideAi, 400);
      });
    }
  }

  function applyClientLang(row) {
    if (previewOn) return lang;
    var next = "cs";
    try { next = resolveLang(row); } catch (e) { next = "cs"; }
    if (next === "en" && lang !== "en") activate("en");
    return lang;
  }

  function enSamples() {
    var was = lang;
    lang = "en";
    var out = [];
    function push(s) { out.push(trText(s)); }
    push("Ahoj!");
    push("Posledních 12 týdnů");
    push("(1 report)");
    push("(3 reporty)");
    push("(8 reportů)");
    push("z reportu Oct 13, 2026");
    push("od začátku (Oct 13, 2026: 71.3 kg)");
    push("první Oct 13, 2026");
    push("Poslední report: Oct 13, 2026. Kopie přijde tobě i Martinovi.");
    push("denní průměr v týdnu (kcal) · aktuální cíl 1,800");
    push("cíl teď 1800");
    push("Vyplň prosím váhu.");
    push("váhu vypadá mimo rozsah (30–300), zkontroluj překlep.");
    push("Hodnota „71“ vypadá jako překlep, zkontroluj ji.");
    push("Hruď: Hodnota „9“ vypadá jako překlep, zkontroluj ji.");
    push("Naklikej prosím únavu (1–5).");
    push("Strava: průměr za 21 dní");
    push("Kolik dní z 21 jsi zapisoval/a?");
    push("21 dní");
    push("4 dny");
    push("1 den");
    push("0 až 21");
    push("Počet zapsaných dní je celé číslo od 0 do 21.");
    push("✅ Načteno 5 dní z tvého období, 2 dny mimo období jsem vynechal. Zkontroluj čísla a pokračuj.");
    push("✅ Načteno 7 dní z Kalorických tabulek, zkontroluj čísla a pokračuj.");
    push("V exportu není žádný zapsaný den z tvého období (Oct 5 to Oct 11, 2026). V Kalorických tabulkách vyber tyhle dny a stáhni export znovu.");
    push("Průvodce koučinkem (Oct 5, 2026)");
    push("foto.jpg má přes 8 MB, pošli běžnou kvalitu z mobilu.");
    push("poznamky.txt, přikládej fotky, PDF nebo XLS.");
    push("Mon Oct 5 kcal: Hodnota „x“ vypadá jako překlep, zkontroluj ji.");
    out.push(dayLabel("Po"));
    out.push(dayLabel("Út"));
    out.push(hezkyNazevEn("pruvodce", "2026", "10", "05"));
    out.push(dateEn(new Date(2026, 9, 13, 12)));
    out.push(popisObdEn("2026-10-05", "2026-10-11"));
    out.push("Hi, Jana!");
    lang = was;
    return out;
  }

  root.KLIENT_I18N = {
    lang: function () { return lang; },
    setLang: function (next) { lang = next === "en" ? "en" : "cs"; return lang; },
    tr: trText,
    trText: trText,
    trHtml: trHtml,
    resolveLang: resolveLang,
    reportPayload: reportPayload,
    materialView: materialView,
    materialSlug: materialSlug,
    dayLabel: dayLabel,
    dateEn: dateEn,
    isoKratceEn: isoKratceEn,
    popisObdEn: popisObdEn,
    axisDenEn: axisDenEn,
    slovoDniEn: slovoDniEn,
    hezkyNazevEn: hezkyNazevEn,
    personalTitle: personalTitle,
    applyStatic: applyStatic,
    bootPage: bootPage,
    applyClientLang: applyClientLang,
    previewEn: function () { return previewOn || previewEn(); },
    hideAi: hideAi,
    enSamples: enSamples,
    phraseKeys: function () { return Object.keys(PHRASE); }
  };
})(typeof window !== "undefined" ? window : globalThis);
