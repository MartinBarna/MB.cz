# Playbook: KOMENTÁŘE NA SÍTÍCH (IG / FB / YT / TikTok)

Cíl: rychle a ve stylu Martina odbavit komentáře pod posty/reels — **šetřit čas u opakovaných
a „mimo" reakcí**, vytěžit zájemce a nezdržovat se s trolly. Stejná filozofie jako u mailů:
**agent připraví odpověď, Martin schválí/vloží** (dokud není napojené API — viz `../integrations/social-comments.md`).

## 1. Triage komentáře (do které škatulky patří)

| Typ | Příklad | Reakce |
|---|---|---|
| 🔥 **Lead / zájem** | „Kolik to stojí?", „Jak začít?", „Bereš klienty?" | Krátká vřelá odpověď + **posun do DM/bia** (neřešit cenu veřejně). Vytěžit! |
| ❓ **Věcný dotaz** | „Kolik bílkovin?", „Funguje kreatin?" | 1–2 věty z `KNOWLEDGE_BASE.md` + návod (ulož/mrkni do bia). Z knihovny `../content/comment-replies.md`. |
| 🙏 **Pochvala** | „Super video!", „Díky!" | Krátké lidské poděkování + emoji. Nenatahovat. |
| 🤷 **Mimo / off-topic / nízká hodnota** | „😂", „first", nesouvisející | **Lajk / emoji-reakce nebo krátká odlehčená věta**, NEbabrat se. Většinou stačí ❤️/💪. |
| 🧠 **Mýtus / „chytrák"** | „CICO je nesmysl", „sacharidy večer tloustnou" | Klid, fakta, bez hádky. Krátce + odkaz na obsah. Nehádej se v nekonečnu. |
| 😠 **Hejt / troll / spam** | urážky, reklama, boti | **Neživit.** Ignorovat / skrýt / smazat. Nikdy se nehádat veřejně. |
| 🚑 **Zdraví / citlivé** | nemoc, léky, PPP, těhotenství | NEradit veřejně. „Napiš mi do DM, ať to probereme citlivě." → eskalace. |

> Pravidlo 1 nádech: u 🤷 a 😠 se ptej „přidá odpověď hodnotu, nebo jen krmí?". Když ne → lajk/ignore.

## 2. Tón (drž značku)
- Neformální, povzbudivý, „Be Effective", tykání, lehký humor. Krátce — komentář není esej.
- 1 komentář = 1 myšlenka + max 1 CTA. Emoji ano, střídmě (💪🧡🔥).
- Žádné lékařské sliby, žádné konkrétní kg/termíny veřejně. Ceny/odkazy z `KNOWLEDGE_BASE.md`,
  ale v komentáři **raději nasměruj do bia/DM** než vypisuj čísla.

## 3. Workflow
1. Stáhni nové komentáře (YT: vidIQ `vidiq_video_comments`; IG/FB/TikTok zatím ručně — viz integrace).
2. Roztřiď dle tabulky výše. Hromadu 🤷/🙏 vyřeš rychle (knihovna), 🔥 vypíchni Martinovi.
3. Pro každý komentář, co si žádá text, vyber/uprav odpověď z `../content/comment-replies.md`.
4. **Leady (🔥)** zaloguj do `lead-pipeline.md` a navrhni DM zprávu.
5. Připrav balík návrhů „komentář → navržená odpověď" ke schválení; Martin odešle/vloží.

## 4. Hranice
- Nic se nepublikuje bez Martina (dokud není auto-režim s frontou).
- Citlivé/zdravotní/nespokojený klient → do DM + eskalace, ne veřejně.
- Nehádat se, nemazat věcnou kritiku (jen hejt/spam). Stejná osoba opakovaně → 1 odpověď, pak ignore.
