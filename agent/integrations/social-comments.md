# Napojení: odpovědi na komentáře (IG / FB / YT / TikTok)

Cíl: dotáhnout komentáře z „agent připraví → Martin vloží" do **poloautomatu se schvalovací frontou**.
Playbook a knihovna: `../playbooks/social-comments.md`, `../content/comment-replies.md`.

## Stav kanálů
| Síť | Číst komentáře | Odpovídat | Jak |
|---|---|---|---|
| YouTube | ✅ teď (vidIQ `vidiq_video_comments`) | ⏳ přes YouTube Data API | čtení hotové, reply potřebuje API/OAuth |
| Instagram | ⏳ | ⏳ | Meta Graph API (`instagram_manage_comments`) — jako WhatsApp BSP |
| Facebook | ⏳ | ⏳ | Meta Graph API (`pages_manage_engagement`) |
| TikTok | ⏳ | ⏳ | omezené API, zatím ručně |

## Režim teď (assisted)
1. YT: agent stáhne nové komentáře přes vidIQ, roztřídí (triage), navrhne odpovědi z knihovny.
2. IG/FB/TikTok: Martin nakopíruje komentáře (nebo screenshot) → agent vrátí návrhy odpovědí.
3. Martin schválí/vloží. Leady jdou do `../playbooks/lead-pipeline.md`.

## Cílový režim (auto-draft + fronta)
- Napojit Meta Graph (IG/FB) + YouTube Data API → agent průběžně tahá nové komentáře,
  navrhuje odpovědi do **schvalovací fronty** (např. Telegram/Sheet), Martin jedním klikem pustí.
- Filtry: priorita 🔥 leadů, hromadné odbavení 🙏/🤷, auto-skrytí zjevného spamu (na potvrzení).
- Hranice: nic veřejně bez schválení; zdraví/citlivé → DM + eskalace.

## Co je potřeba od Martina
- Které sítě jsou prioritní (kde je nejvíc komentářů)?
- Souhlas s napojením Meta Graph (stejné účty jako pro budoucí WhatsApp/ads) + YouTube OAuth.
- Kde chce schvalovat (Telegram fronta vs. koncepty).
