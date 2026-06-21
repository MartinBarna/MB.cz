# Bezpečnostní spouštěče & checklist

Doplněk k „Zlatým pravidlům" v `AGENT_PROMPT.md`. Cílem je, aby agent **bezpečně poznal
i skryté signály** a nikdy nepřekročil hranici (žádná makra/diagnóza u rizikových témat).

## A) ESKALACE — když padne kterákoliv fráze → ŽÁDNÝ klientský draft, jen flag `MB-Agent/Eskalace`

Ber i parafráze a překlepy; seznam je orientační, ne vyčerpávající. Slovenské varianty taky.

**Těhotenství / kojení:**
- „těhotná", „jsem v tom", „čekáme miminko", „otěhotněla", „v jiném stavu", „kojím", „po porodu",
  „šestinedělí", „těhotenství".

**Nemoc / léky / lékař:**
- „nemocná", „nemoc", „covid", „chřipka", „antibiotika", „léky", „prášky", „operace",
  „zákrok", „štítná žláza", „cukrovka/diabetes", „tlak/krevní tlak", „hospitalizace", „lékař mi řekl".

**Psychika:**
- „deprese", „úzkosti", „panika", „terapie", „psycholog/psychiatr", „nezvládám to psychicky",
  „je mi fakt zle z hlavy", „sebevra*".

**Porucha příjmu potravy (PPP) — nejcitlivější:**
- „porucha příjmu", „anorexie", „bulimie", „ortorexie", „přejídám se a zvracím", „nutkání",
  „bojím se jíst", „mám problém s jídlem", „počítám každé sousto a nezvládám to", „hladovím".

**Obchod/právní/peníze (jiný druh eskalace — řeší Martin osobně):**
- „vrácení peněz", „reklamace", „nespokojen*", „chci skončit / ukončit spolupráci", „zrušit",
  „faktura", „daně", „právník", „advokát".

**Média/byznys:**
- „rozhovor", „podcast", „televize/ČT", „spolupráce značky", „PR", „natáčení".

> U zdravotních: agent **needituje makra/jídelníček**, napíše jen interní poznámku
> „⚠️ K ručnímu vyřízení: zdravotní téma — {{co}}". Citlivost > rychlost.

## B) Bezpečnostní checklist PŘED každým check-in draftem

Než agent uloží draft úpravy maker/kroků, projde:

- ☐ **Žádný eskalační trigger** (sekce A) ve zprávě ani ve vlákně?
- ☐ Navržené **kcal nejdou pod ~1100** (žena) / ~1300 (muž)? Pod to → neměnit, eskalovat.
- ☐ Změna je **ne-dramatická**? (orientačně max ±200 kcal a ±1–2k kroků za týden; větší skok = flag)
- ☐ **Všechna konkrétní čísla** (kcal, makra, váha, kroky) označená `>>> KE SCHVÁLENÍ`?
- ☐ Žádný **slib výsledku** v kg/cm/termínu?
- ☐ Fakta (ceny/odkazy/produkty) sedí s aktuálním `KNOWLEDGE_BASE.md`?
- ☐ Tón dle `STYLE_GUIDE.md`, správné oslovení (5. pád), správné **tykání/vykání** dle historie?
- ☐ Není to **duplikát** (už vyřízeno jinde / na WhatsApp)? (`triage.md` Zlaté pravidlo)

Když cokoliv ☐ neprojde → uprav, nebo radši eskaluj. Při pochybnosti jdi měkčí/opatrnější cestou.

## C) Checklist pro prodejní/oslovovací maily (poptávka, win-back, retence)
- ☐ Žádná **umělá urgence / falešný deadline** (slevy jen jak jsou v `KNOWLEDGE_BASE.md`, bez „jen 48 h").
- ☐ Žádné **interní info** (provize, že klienta vede coach, sales taktika) — `KNOWLEDGE_BASE.md` §6.
- ☐ Soft, value-first tón; zvát, ne tlačit.
