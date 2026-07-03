# „Tvůj Coach AI" (AI Coach) — architektura agenta appky

> Plánovací artefakt pro AI agenta nutriční/fitness appky **„Tvůj Coach"** (Expo + Supabase).
> Appka žije v samostatném repu (na PC Martina: `…\Desktop\AI Martin`), **NE v tomhle repu**.
> Tento dokument je návrh podle požadavků A–F ze zadání. **Implementace čeká na:**
> 1. `AI-MARTIN-AGENT-KNOWLEDGE.md` (identita/hlas/metoda/engine/safety → systémový prompt),
> 2. `AI-COACH-AGENT-TOOLS.md` (přesný kontrakt nástrojů navázaný na `src/data/*.ts` + Edge Functions),
> 3. přístup k repu appky.
> Bez těchto tří se **tool kontrakt ani systémový prompt nedomýšlí** — jen se dosadí 1:1.

## 1) Stack agenta — doporučení
- **Anthropic tool use (Claude Messages API)**, agent loop **serverově** (drží API klíč, nikdy ne v Expo klientu).
- Model: default **Claude Sonnet** (vysoký objem logování jídla/váhy, rychlost + vision na fotky), eskalace na silnější Claude jen pro těžší uvažování. Přepis hlasovek = STT (samostatný krok) → text → stejné nástroje.
- Proč ne OpenAI Assistants / LangChain: nativní tool-use + vision + čeština + streaming; menší závislost, snazší audit.

## 2) Napojení tool-callingu na datovou vrstvu (požadavek B)
- **Serverový endpoint = Supabase Edge Function `ai-coach`**, volaná z Expo **s JWT klienta**.
- Uvnitř: Supabase klient postavený **z JWT klienta** (`Authorization: Bearer <client JWT>`) → všechny READ/WRITE nástroje jedou přes něj → **RLS platí automaticky**, klient vidí/mění jen svoje data.
- **Service-role klient je oddělený** a smí **jen** serverové `ai_flags` / `ai_usage`. Nikdy ne pro akci „za klienta".
- Nástroje mapují na existující logiku `src/data/*.ts` (sdílené TS moduly nebo Postgres RPC) — **vždy JWT-scoped**.

## 3) Brány akcí (požadavek E)
| Brána | Chování |
|---|---|
| READ | provede se rovnou (čtení dat, souhrny) |
| AUTO | provede se rovnou (log jídla/váhy/kroků/vody/tréninku) |
| CONFIRM | **před** provedením se zeptá klienta (změna cílů/tempa/aktivity, mazání účtu, platba) — loop vrátí „confirmation required", appka potvrdí, teprve pak zápis |
| PROHIBITED | agent NEDĚLÁ (zadávání platebních údajů/hesel) — jen předá **Stripe odkaz** |

## 4) Engine počítá, AI mluví (požadavek C)
- Makra jídla = **potravinová DB × gramáž** (nikdy odhad z hlavy).
- Cíle/kalorie = **deterministický engine** nebo explicitní lidský override.
- Agent čísla jen **vysvětluje a zarámuje**, nikdy negeneruje kcal/makra.
- (Sedí to na Academy m3-l1: kalkulačka = startovní bod, ne svatá pravda.)

## 5) Safety (požadavek D)
- **Před zápisem volného textu** → pre-flag klasifikátor.
- Rizikový obsah (poruchy příjmu potravy, těhotenství, léky, psychická krize) → **bezpečný režim**, zápis do `ai_flags`, **nevysvětlovat „matematiku" hladovění**, odkaz na **Martina / lékaře / linku 116 123**.
- Žádná reálná jména/osobní údaje v promptech ani logu nad rámec nutného ID.

## 6) Vstupy (požadavek F)
- **text** → parse → zápisové nástroje
- **hlasovka** → STT přepis → parse → zápisové nástroje
- **foto** → vision → položky → makra z potravinové DB → zápisové nástroje
- Všechny tři končí na **stejných** zápisových nástrojích z tool kontraktu.

## 7) Persistence (požadavek A)
- Systémový prompt (z `AI-MARTIN-AGENT-KNOWLEDGE.md`, ČÁST A+B) + tool definitions (z `AI-COACH-AGENT-TOOLS.md`) + knowledge = **verzované v gitu repa appky**, načítané při každém startu Edge Function. Ne jednorázově do chatu.

## 8) Plán implementace (po dodání 3 vstupů výše)
1. `AI-MARTIN-AGENT-KNOWLEDGE.md` → verzovaný systémový prompt/knowledge (git).
2. `AI-COACH-AGENT-TOOLS.md` → JSON schémata nástrojů + mapování na `src/data`/RPC (+ sloupec Brána).
3. Edge Function `ai-coach`: JWT loop, brány, pre-flag, service-role jen na `ai_flags`/`ai_usage`.
4. Vstupní kanály text/hlas/foto → zápisové nástroje.
5. Testy: RLS izolace (klient A nevidí data klienta B), CONFIRM brány, safety spouštěče, engine-only čísla.

## Stav
- [ ] dodat 3 vstupy (2 md soubory + repo appky)
- [ ] odsouhlasit stack (Anthropic tool use + Edge Function pod JWT)
- [ ] teprve pak implementace v repu appky (ne v MB.cz)
