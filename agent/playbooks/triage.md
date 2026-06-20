# Playbook: TRIAGE (třídění příchozí pošty)

Než agent začne cokoliv draftovat, projde inbox a každou zprávu zařadí. Cílem je
**rychle oddělit reálnou práci od šumu** a hlavně **nedělat duplicitní/zbytečné drafty**.
Zdroj: reálná zkušenost z provozu (6/2026).

## ZLATÉ PRAVIDLO KONTEXTU (čti vždy první)

Vlákno bez odpovědi „ve vlákně" **neznamená**, že je nevyřízené. Než draftneš, ověř:

- **Neodpověděl už Martin v jiném vlákně?** (typicky onboarding založí nové vlákno se
  subjectem klienta — viz reálný případ: vstupní dotazník vypadal nezodpovězený, ale
  klient byl dávno onboardovaný v jiném vlákně.)
- **Není to vyřízené na WhatsApp?** Hodně věcí (domluva konzultace, termíny, platby,
  média) Martin řeší na WA. Když mail nemá odpověď, ale je to „WA-typ", **flag, nedraftuj**.
- **Je klient už aktivní?** Pak ho NIKDY neonboarduj znovu.

Když si nejsi jistý → `MB-Agent/Eskalace` + krátká poznámka, ne draft.

## ŠUM — ignoruj (nedraftuj, neoznačuj)

Typičtí odesílatelé/vzory k přeskočení:
- E-shopy a dopravci: Alza, Zásilkovna, Timestore, AlzaBox („Objednávka …", „připraveno k výdeji").
- Účtenky/platby služeb: Anthropic, Grok/xAI, Google Play, Vodafone, Direct/pojišťovny, SIPO.
- Newslettery a denní články: HeroHero („… is ready", „Denní článek/studie …").
- Reporty platforem: Google Maps/Business („… vidělo X lidí"), Audiolibrix (hodnocení).
- Reklamní maily (kreditka, cestovní pojištění, soutěže…).

## PRÁCE — zařaď a zpracuj

| Typ | Jak poznat | Akce |
|---|---|---|
| **Check-in** | Stávající klient posílá týdenní report (míry, váha, trénink; často příloha xlsx „Report pro Coache") | Draft dle `check-in.md` + štítek `MB-Agent/Check-in` |
| **Onboarding** | Nový klient poslal vstupní dotazník / podklady o sobě, ještě nedostal „informace na první týden" | Draft dle `../templates/onboarding-template.html` (ověř kontext!) + štítek `MB-Agent` |
| **Poptávka (přímá)** | Někdo se ptá na koučing/cenu/spolupráci, „mám zájem", „kolik stojí" | Draft dle `poptavka.md` + štítek `MB-Agent/Poptávka` |
| **Lead z formuláře** | Lead-magnet formulář („Jméno / Email / Věk / Hlavní cíl …") | Řeší **automatický funnel** (7denní plán + e-mail série). **Nedraftuj** — jen štítek `MB-Agent/Poptávka`. Warm nudge dělej jen na výslovné přání Martina. |

## ESKALACE — žádný draft, jen flag + štítek `MB-Agent/Eskalace`

- Média a PR (TV/ČT, podcasty, rozhovory) — Martin řeší sám.
- Byznys/spolupráce/nabídky (weby, značky, kolaborace).
- Platby, pokračování/ukončení spolupráce, vrácení peněz, stížnost.
- Zdravotní komplikace, těhotenství, léky, psychika, PPP → makra neměnit.
- Cokoliv právního/fakturace/daně.

## Po průchodu

Dej Martinovi krátký souhrn: kolik check-inů/poptávek nadraftováno, co je k ručnímu
vyřízení (eskalace) a co bylo jen šum. Drafty čekají v Konceptech ke schválení.
