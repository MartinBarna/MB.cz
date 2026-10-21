# Promo videa, verze 2 (9. 10. 2026)

Větev `cloud/promo-videa-1009`. **Nemergovat do `main`**, videa na web nepatří. Nic není nasazené
ani publikované na sítích. Verze 1 zůstává beze změny v `_cloud/videa/` (pro srovnání).

Výstupy v2 jsou v `_cloud/videa-v2/`:

- **10 videí 1080×1920**, 30 fps, H.264 + AAC, s jemnými zvuky rozhraní (ťuknutí, psaní): `<video>.mp4`
- **10 tichých verzí** (bez jakékoli zvukové stopy): `bez-zvuku/<video>-bez-zvuku.mp4`
- **10 coverů 1080×1920** se schválenými titulky coverů: `<video>-cover.png`
- **10 kontaktních archů** (snímek každých 0,5 s, s časem): `archy/<video>.jpg`
- `TEXTY-V2.md`: každý text na obrazovce s časem, typem záběru, zdrojem a změnou proti schválenému znění
- `src/`: z čeho se videa skládají (HTML/CSS scéna, engine, scénáře, generátor zvuků)

## Seznam videí

| Video | Délka | Velikost (se zvuky / tichá) | Záběrů (s rozhraním) | Háček v 0 s | Cover |
|---|---|---|---|---|---|
| `tvuj-coach-vip-15.mp4` | 15 s | 3,23 / 3,15 MB | 11 (10) | Otázka k jídlu ve dvě ráno? | AI kouč, který vidí tvoje čísla |
| `tvuj-coach-vip-30.mp4` | 30 s | 6,75 / 6,63 MB | 25 (15) | Otázka k jídlu ve dvě ráno? | AI kouč odpoví i ve dvě ráno. |
| `tvuj-coach-basic-15.mp4` | 15 s | 3,41 / 3,35 MB | 12 (6) | Zbývá ti 400 kcal | Zbývá 400 kcal. Co si ještě dát? |
| `tvuj-coach-basic-30.mp4` | 30 s | 6,85 / 6,77 MB | 24 (12) | Kolik sérií týdně padlo na záda? | Trénink, jídelníček a cíle každý týden |
| `videokurz-15.mp4` | 15 s | 4,34 / 4,30 MB | 14 (8) | Dá se jíst pizza | Pizza se do jídelníčku vejde. |
| `videokurz-30.mp4` | 30 s | 8,17 / 8,11 MB | 23 (7) | Kalorie, bílkoviny, sacharidy, tuky. | Výživa od základů. 182 videí. |
| `academy-15.mp4` | 15 s | 4,16 / 4,12 MB | 11 (8) | Klient chce jídelníček. | Jídelníček klientovi za pár vteřin |
| `academy-30.mp4` | 30 s | 8,37 / 8,31 MB | 25 (16) | Studuješ v deset večer | 256 lekcí, generátory a AI Martin |
| `koucing-15.mp4` | 15 s | 4,54 / 4,52 MB | 13 (2) | Kdo ti každý týden projde čísla? | Plán ti každý týden upravím já. |
| `koucing-30.mp4` | 30 s | 8,70 / 8,66 MB | 25 (3) | Týdenní report za 3 minuty | Report za 3 minuty. Plán upravím já. |

Všechna videa jsou pod limitem 20 MB (největší 8,70 MB). Formát 1080×1920, 30 fps, H.264 CRF 17, AAC 128 kb/s 48 kHz. Zvuky rozhraní jsou schválně tiché a řídké: špička −6 dBFS, průměr kolem −25 až −28 LUFS (žádná hudba, která by je překryla).
Kontaktní archy: [`tvuj-coach-vip-15`](videa-v2/archy/tvuj-coach-vip-15.jpg), [`tvuj-coach-vip-30`](videa-v2/archy/tvuj-coach-vip-30.jpg), [`tvuj-coach-basic-15`](videa-v2/archy/tvuj-coach-basic-15.jpg), [`tvuj-coach-basic-30`](videa-v2/archy/tvuj-coach-basic-30.jpg), [`videokurz-15`](videa-v2/archy/videokurz-15.jpg), [`videokurz-30`](videa-v2/archy/videokurz-30.jpg), [`academy-15`](videa-v2/archy/academy-15.jpg), [`academy-30`](videa-v2/archy/academy-30.jpg), [`koucing-15`](videa-v2/archy/koucing-15.jpg), [`koucing-30`](videa-v2/archy/koucing-30.jpg).

## Co se zlepšilo proti v1 (vada po vadě)

### 1. Rozmazané zvětšené screenshoty → rozhraní postavené znovu v HTML
V1 zvětšovala screenshoty appky (390 px široké) na celou výšku videa, proto byly měkké.
V2 **nepoužívá ani jeden screenshot**. Každá obrazovka je znovu postavená v HTML/CSS přímo
v rozlišení videa: písmo Poppins / Barlow Condensed, barvy změřené ze screenshotů
(`#15111c`, zlatá `#EBB12C`, karta `#19151f`, fialová pilulka AI Coach `#7a2a68`), rozložení podle
`assets/app/*.webp`, `assets/screeny/academy/*.webp` a živých stránek. Text je vektorový, takže je
ostrý i při přiblížení kamery.

Obsah a čísla jsou **doslova** ze screenshotů a stránek, nic není vymyšlené:

| Obrazovka | Předloha | Co je na ní |
|---|---|---|
| AI Coach (chat) | `assets/app/ai-kouc.png` | dotaz „Kolik mi dnes zbývá?", odpověď „1118 kcal … zbývá **82 kcal** …" doslova |
| Dnes | `assets/app/dnes.webp` | prstenec 1450 / 1623 kcal, zbývá 173, check-in, tlačítka mikrofonu a foťáku (bez demo jména) |
| Zápis jídla | `assets/app/zapis-jidla.webp` | hledání „kuřecí prsa", 4 výsledky s kcal/100 g, **bez odznaku „Ověřeno Martinem"** |
| Generátor jídelníčku | `assets/app/generator-jidelnicku*.png` | snídaně 450 kcal, 6 položek s gramážemi |
| Generátor tréninku | `assets/app/generator-treninku.png` | Push (tlaky), 5 cviků s fotkami z `assets/cviky/` |
| Academy generátor | `03-generator-cz-mobil.webp` | 2143 kcal, 152 / 233 / 67 / 30 g, snídaně 655 kcal |
| Academy lekce | `02-lekce-mobil.webp` + `akademie/studium/m1-l1` | „Proč lidé jedí, i když nemají hlad", perex a „Co si z lekce odneseš" doslova |
| AI Martin (Academy) | `04-ai-martin-mobil.webp` | odpověď a „Kde to najdeš" doslova |
| Nástroje pro trenéry | živá `akademie/nastroje/` | 5 karet nástrojů, popisy a štítky doslova (včetně „128 cviků") |
| Videokurz: přehled | živá `akademie/videokurz/` | „182 video lekcí…", přílohy 26 materiálů, moduly s počty videí |
| Videokurz: lekce | živá `akademie/videokurz/v001/` | „Modul 1: Základy výživy · Video 1 / 182", seznam lekcí se štítky ZDARMA |
| Videokurz: přílohy | živá `akademie/videokurz/#materialy` | 13 prvních příloh s popisy doslova |

### 2. Useknutý text v kartě AI Coache
Karta už není obrázek, ale živý text: zalamuje se v bublině a celá odpověď se vejde.
Automatická kontrola měří každých 0,1 s, jestli titulek nepřetéká nebo není uříznutý (0 nálezů).

### 3. Pomalé prolínačky → střih každé 1–2 s, přechody do 0,2 s
Dlouhé crossfady jsou pryč. Mezi záběry je střih se zoomem 0,15 s, kamera nad telefonem se
přesouvá 0,2 s, přepnutí obrazovky je posun 0,18 s. Když jde o stejnou obrazovku (Academy nástroje),
je to plynulý scroll. Žádný snímek mezi záběry není černý (opravené i dva prázdné snímky
na nástupu čísel a závěrečné karty, které odhalil arch).

Pohyb uvnitř rozhraní: psaní znak po znaku s klávesnicí a zvýrazněnými klávesami, odpověď AI
naskakuje slovo po slově, prstenec kalorií se dopočítá, ťuknutí s vlnkou, výsledky hledání
naskakují po jednom, generátory skládají dlaždice, chat Academy, scroll nástrojů, zaškrtnutí lekce
ve videokurzu, rámeček čárového kódu se zamkne.

### 4. Prázdná spodní třetina a malý telefon
- Telefon je 900 px široký (83 % šířky) a kamera ho přibližuje na 100–120 % podle toho, co je důležité.
- Chat AI Coache i AI Martina má zprávy **přilepené nad vstupním polem** jako ve skutečné appce,
  takže pod odpovědí není prázdná plocha (v1 i první render v2 tam měly prázdnou polovinu).
- Čistě textových záběrů je skoro o polovinu méně (z 49 na 26, záběrů s rozhraním je 87): videokurz dostal skutečné prostředí kurzu (přehled,
  lekce, přílohy), Basic a Academy nahradily textové předěly obrazovkami (zápis jídla, trénink,
  nástroje). Zbylé textové záběry mají větší písmo (158 px) a zlatou linku, čísla 420 px.

### 5. Nečitelné karty s drobným textem → titulky min. 64 px, max. 6 slov
Titulky Barlow Condensed 800, 118 px (nejmenší po automatickém zmenšení 72 px), na obrazovce
nejvýš 6 slov, naskakují slovo po slově. Žádné odstavce drobného textu. Delší schválené věty jsou
rozdělené do po sobě jdoucích záběrů beze změny znění. Všechny titulky leží v bezpečné zóně
y 250–1570 px, x 60–1020 px (měřeno, ne odhadnuto).

### 6. Špatný název „AI Martin, kouč 24/7"
V appce se avatar jmenuje **AI Coach**. V `koucing-30` je teď „AI Coach v appce" a pod tím skutečný
chat AI Coache. „24/7" ani nic, co na stránce doslova není, se nepřidává. „AI kouč" zůstává tam,
kde ho doslova používá `tvuj-coach/` („AI kouč odpovídá podle tvých čísel v appce").
V Academy zůstává „AI Martin", protože tak se chatbot jmenuje v Academy (UI i stránka).

### 7. Uříznutá hlava Martina
Fotka `hero-2048.jpg` (2048 px, ostrá) přes celý obraz, výřez `66 % 0 %`: celá hlava s rezervou
nahoře, oči pod horní bezpečnou zónou. `koucink.jpg` a `prednaska.jpg` jsou karty na šířku
s celou hlavou. Ověřeno na snímcích v plném rozlišení.

### 8. Syntetická hudba → žádná hudba, dvě verze zvuku
Hudba je pryč úplně. Hlavní verze má jen jemné zvuky rozhraní generované kódem (`src/sfx.py`:
ťuknutí, klávesy, „pop" zprávy, tick, závěrka), načasované přesně na dění v obraze, špička −6 dBFS.
Tichá verze v `bez-zvuku/` nemá zvukovou stopu vůbec (na TikTok / Reels, kde se zvuk přidává v appce).

## Covery
Cover je **samostatný obrázek** se schváleným titulkem coveru z `_cloud/videa/TEXTY.md` (po kole
hlasu Martina, např. „AI kouč odpoví i ve dvě ráno.", „Pizza se do jídelníčku vejde.", „Plán ti každý
týden upravím já."), vizuál je z nejsilnějšího záběru videa a dole štítek produktu a ceny.
Snímek videa v 0 s je zvlášť háček s velkým titulkem viditelným hned (bez animace), takže funguje
i jako první snímek při automatickém přehrávání.

## Změny textů proti schválenému znění
Úplný soupis s časy a zdroji je v `videa-v2/TEXTY-V2.md`. Změn je 11, všechny kvůli limitu
6 slov na obrazovce nebo kvůli pokynu k názvu AI Coache:

- **tvuj-coach-vip-15** (13,0 s): „+ videokurz výživy zdarma k první platbě“ → „+ videokurz zdarma k první platbě“ (max 6 slov)
- **tvuj-coach-vip-30** (23,3 s): z „Podle toho, kde cvičíš a kolik dní máš.“ vypadlo „a kolik dní máš“ (čas)
- **tvuj-coach-vip-30** (28,0 s): „+ videokurz výživy zdarma k první platbě“ → „+ videokurz zdarma k první platbě“ (max 6 slov)
- **tvuj-coach-basic-30** (4,9 s): zbytek věty („jestli je to málo, akorát, nebo už moc“) nahrazen grafem se štítky málo / akorát / moc
- **videokurz-15** (13,0 s): „Nebo zdarma k první platbě appky Tvůj Coach VIP“ → „Nebo zdarma k první platbě VIP“ (max 6 slov na kartě)
- **videokurz-30** (4,7 s): modul „Praxe & udržení návyků“ psán „Praxe a udržení návyků“
- **academy-15** (0,0 s): kicker „Pro trenéry a výživové poradce“ → „Pro trenéry“ (max 6 slov s háčkem)
- **academy-30** (0,0 s): kicker „Barna Academy pro trenéry“ → „Barna Academy“ (max 6 slov s háčkem)
- **academy-30** (14,9 s): podtitulek „fitko, doma i venku“ nahrazen štítkem „Fitko / doma / venku“ přímo na kartě nástroje
- **academy-30** (17,7 s): vypadl dovětek „(přílohy, kuchařky, plány)“ (max 6 slov)
- **koucing-30** (16,7 s): „AI Martin, kouč 24/7“ → „AI Coach v appce“ (pokyn majitele: avatar v appce se jmenuje AI Coach, „24/7“ nepřidávat)

## Kontrola (bod G)
- **Automaticky** každých 0,1 s u všech 10 videí: titulky v bezpečné zóně, nic nepřetéká, max. 6 slov,
  0 chyb JavaScriptu. Výsledek: 0 nálezů u všech videí.
- **Očima**: kontaktní arch každého videa (snímek každých 0,5 s) + vybrané snímky v plném rozlišení.
  První kolo archů odhalilo a opravilo: prázdnou spodní polovinu pod odpovědí AI (chat), prázdný snímek
  na nástupu čísel a závěrečné karty, přes 4 s holého textu v úvodu Basic, videokurz složený skoro
  jen z textu, prázdnou plochu v panelu AI Martina, přepnutí obrazovky místo scrollu v Academy.
- Ceny a názvy proti stránkám: VIP 499 Kč / měsíc, Basic 249 Kč / měsíc nebo 2 490 Kč / rok,
  videokurz 1 490 Kč (zdarma k první platbě VIP), Academy 990 Kč / měsíc nebo 8 900 Kč doživotně,
  koučink Gold 6 450 Kč / měsíc, konzultace 2 990 Kč.
- Otázka „vydal bych to jako reklamu značky za 499 Kč měsíčně?": u appky, Academy a videokurzu ano,
  rozhraní je ostré a skutečné. U koučinku je víc fotek a typografie, protože klientská sekce se
  bez přihlášení nedá ukázat a nechtěl jsem ji vymýšlet. Víc v doporučení níže.

## Na co upozornit (rozhodnutí pro Martina)
1. **Web koučinku pořád píše „AI Martin: kouč 24/7"** (`koucing/index.html`), přitom appka říká
   AI Coach. Ve videu je opraveno, na webu ne (nesahal jsem na něj).
2. **Videokurz: „Šest modulů" vs. členská sekce.** Prodejní stránka `videokurz.html` píše „Šest modulů,
   od základů po pokročilé strategie", ale v kurzu je 8 modulů a dalších 8 sekcí (16 celkem).
   Video drží text stránky a seznam modulů ukazuje jako typografii, ne přes členskou sekci, aby se to
   v obraze nepralo. Stojí za sjednocení na webu.
3. **Ilustrační prvky** (nejsou to skutečné obrazovky, v obraze nejsou vydávané za data):
   rámeček čárového kódu, graf objemu po partiích (málo / akorát / moc, bez čísel),
   přehrávač lekce videokurzu (tmavý, bez záběru z videa: náhledy z YouTube jsou z tohoto prostředí
   blokované). Hlas a fotka talíře jsou ukázané jako ťuknutí na skutečná tlačítka mikrofonu a foťáku.
4. **Starý screenshot nástrojů** `assets/screeny/academy/05-nastroje.webp` uvádí „120 cviků",
   živá stránka 128. Video bere čísla jen ze živé stránky.
5. Doména **tvujcoach.cz** na závěrečné kartě je převzatá z v1, živě jsem ji neověřoval.

## Doporučení
- **Reklama:** `tvuj-coach-vip-15`, `academy-15`, `videokurz-15` (krátké, rozhraní hned od první
  vteřiny, cena na konci). Tichá verze se hodí tam, kde reklama běží bez zvuku.
- **Organicky:** 30s verze, hlavně `academy-30` a `tvuj-coach-vip-30`, které vysvětlí víc funkcí.
- **Koučink:** nejsilnější materiál by bylo skutečné natáčení (Martin u počítače, kus klientské
  sekce s anonymizovanými daty). Pak se dá koučinkové video postavit stejně jako appka.

## Jak videa přegenerovat
Z kořene repa: `python3 -m http.server 8099 &` a pak
`NODE_PATH=$(npm root -g) node _cloud/videa-v2/src/render.js [id …]`
(`--check` jen kontrola, `--preview=auto` náhledy, `--covers` jen covery).
Texty se upravují v `src/videos.js`, soupis `node _cloud/videa-v2/src/texty.js`.
