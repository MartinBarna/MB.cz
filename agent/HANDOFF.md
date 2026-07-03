# HANDOFF — předání agenta (stav k 2026-07-03)

> Pokračuješ v práci na agentovi Martina Barny. Přečti si tenhle soubor první, pak
> `CLAUDE.md` (sekce „# AI Martin — persona") a `agent/ai-coach-app/ARCHITECTURE.md`.
> Nezačínej od nuly — níže je vše hotové i všechny otevřené body.

## 0) Prostředí a repo (důležité reálie)
- Pracovní složka: `/home/user/MB.cz`, **cloud Linux kontejner (pomíjivý)** — co není commitnuté a pushnuté, zmizí.
- Repo `martinbarna/mb.cz` (teď **private**). Pracovní větev: **`claude/email-whatsapp-response-agent-h678qg`**.
  **Na `main` nepushovat bez výslovného svolení.** Otevřený **draft PR #1** → `main`.
- **Egress proxy blokuje přímý web** (403 CONNECT) na `supabase.co` i `martinbarna.cz` → `curl`/Playwright na tyhle hosty **nefungují**. Živý proklik webu ani přímé HTTP na Edge Functions nejdou.
- **Windows cesty `C:\Users\fitne\...` nejsou dostupné** (jsou na PC Martina, ne v kontejneru).
- **Supabase**: dosažitelný jen přes MCP nástroje, které se **opakovaně odpojují/připojují** (flap). Když MCP je, Edge Function volej **přes `net.http_post` (pg_net)** — přímý curl je blokovaný. Projekt „Barna Academy" ref `uhmrpfsdcujbhbtumqye`.

## 1) HOTOVO tento session

### A) AI Martin — persona (TASK 1) ✅
- **Persona zapsána doslova** do `CLAUDE.md`, sekce `# AI Martin — persona` (jen přidaná sekce, zbytek nezměněn). Commit `555a0607`.
- **Akademie přenesena do větve** z `origin/main` (identické bloby) — **20 modulů / 224 lekcí**. Commit `2054442e`.
  - Znalostní báze: `akademie/studium/index.html` (pole `CURRICULUM`), plný text lekce `akademie/studium/<id>/index.html` (např. `m3-l1`). Dohledávání grepem **funguje**.
- Mechanika ověřena na reálných lekcích (m3-l1 energetická bilance, m1-l7 návyky/„~66 dní", m3-l2 bílkoviny).

### B) App agent „Tvůj Coach AI" — architektura (TASK 2) ✅ návrh, ⛔ implementace
- Návrh: **`agent/ai-coach-app/ARCHITECTURE.md`**. Commit `4cf7d397`.
- Stack doporučení: **Anthropic tool use + Supabase Edge Function `ai-coach` pod JWT klienta (RLS)**; service-role jen `ai_flags`/`ai_usage`; brány READ/AUTO/CONFIRM/PROHIBITED; **engine počítá, AI mluví**; pre-flag safety (poruchy příjmu potravy/těhotenství/léky/krize → linka 116 123); vstupy text/hlas/foto → stejné zápisové nástroje.

### C) Dřívější práce v tomto session (kontext, ať to neděláš znovu)
- **Email/drip pipeline (Supabase)**: oddiagnostikováno jako zdravé (cron žije, `archive_bcc` nastaveno, Resend OK). Upravil jsem šablony `onboarding-videokurz` a `onboarding-coaching` step 0 a poslal 2 testy na Martinův mail.
  ⚠️ **Onboarding pak KOMPLETNĚ dořešil druhý agent („codevedle") — v5 nasazena, 407 leadů, 99 odesláno.** → **drip-send / leady / onboarding NEŘEŠIT**, patří druhému agentovi.
- **CRM zápis jedné klientky** (tag `coaching-active` + entitlement videokurz) — udělal druhý agent; já dodal idempotentní SQL. Osobní data **do repa nepatří** (jen agregát).
- **Audit landing page `index.html`** (nálezy, NEOPRAVENO): (1) videokurz uvádí „153 videí" — reálně **182** (potvrzeno `akademie/videokurz/v181,v182`) → landing je zastaralá; (2) chybí `og:image` + twitter card; (3) sticky nav → přidat `scroll-margin-top` na sekce; (4) mobilní menu se po kliknutí nezavře; (5) meta description je moc dlouhá. Drobné a11y.

## 2) OTEVŘENÉ BODY (co dodělat)

1. **CLAUDE.md konflikt na `main`.** `main` má jinou `CLAUDE.md` („# Barna Academy — pracovní pravidla", 87 ř., se Supabase sekcí, **bez persony**); tahle větev má „orientace pro Claude" **+ personu**. Při merge PR #1 bude konflikt → **rozhodnout, který základ vyhrává, a zajistit, že sekce persony zůstane**. (Nejlepší: sloučit — vzít main jako základ a připojit sekci persony.) Vyžaduje svolení Martina k zásahu na `main`.
2. **TASK 2 — implementace app agenta.** Chybí: `AI-MARTIN-AGENT-KNOWLEDGE.md`, `AI-COACH-AGENT-TOOLS.md` a **repo appky** (Expo+Supabase, `…\Desktop\AI Martin`). Dokud nejsou v dosahu (commit do viditelného repa nebo vložit obsah), **tool kontrakt ani systémový prompt se nedomýšlí**. Implementace půjde do **repa appky**, ne do `MB.cz`.
3. **(Volitelné) Fixy landing page** dle auditu výše — hlavně **153→182** a `og:image`.

## 3) Commity tohoto session (větev `claude/email-whatsapp-response-agent-h678qg`)
- `555a0607` — CLAUDE.md: persona AI Martin
- `2054442e` — akademie: přenos 224 lekcí + update pozn.
- `4cf7d397` — agent/ai-coach-app: architektura app agenta
- `<tento>` — agent/HANDOFF.md

## 4) Rychlý start v novém chatu
1. Přečti `agent/HANDOFF.md` (tenhle), `CLAUDE.md` → sekce persony, `agent/ai-coach-app/ARCHITECTURE.md`.
2. Pokud jedeš jako **AI Martin**: odpovídej personou, lekce dohledávej grepem v `akademie/studium/`.
3. Pokud stavíš **app agenta**: vyžádej si 2 binding soubory + repo appky, pak podle ARCHITECTURE.md.
4. Nezapomeň: `main` nešahat bez svolení; drip-send/onboarding je cizí teritorium; osobní data ne do repa.
