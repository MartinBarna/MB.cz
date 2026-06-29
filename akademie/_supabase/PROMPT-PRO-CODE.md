# Prompt pro Code (Supabase MCP) — připraveno ke spuštění

Tohle je hotový balík úkolů pro session, která má připojené Supabase MCP (projekt
`uhmrpfsdcujbhbtumqye` „Barna Academy"). Já (Claude Code na webu) Supabase přímo nedosáhnu,
takže tyhle 3 věci udělej ty. Vše je předpřipravené v repu — stačí provést.

---

## 1) AI Martin — nasadit edge funkci + zapnout widget

Funkce už je v repu: `akademie/_supabase/functions/ai-martin/index.ts` (persona v1, hned funkční po klíči).
Frontend `assets/ai-martin.js` má **už předvyplněný ENDPOINT** a čeká jen na `ENABLED:true`.

```
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...        # Martinův klíč
supabase functions deploy ai-martin --no-verify-jwt
```

Volitelně: `AI_MARTIN_MODEL` (default `claude-sonnet-4-6`), `AI_MARTIN_ORIGIN` (default `https://martinbarna.cz`).

**Smoke test** (po deploy):
```
curl -s -X POST https://uhmrpfsdcujbhbtumqye.supabase.co/functions/v1/ai-martin \
  -H 'content-type: application/json' \
  -d '{"messages":[{"role":"user","text":"kolik bilkovin denne?"}]}'
```
→ má vrátit `{"reply":"..."}` v Martinově tónu (tykání, krátce, věcně).

**Zapnutí widgetu** (až test projde): v `assets/ai-martin.js` přepni `CFG.ENABLED: true`,
commit na `claude/learn-claude-code-tay5rb` → PR → merge → deploy `deploy-wedos.yml` (ref:main) → re-sync.
(Endpoint je už nastavený, měníš jen ten jeden flag.)

---

## 2) Onboarding maily videokurz kupcům + coaching klientům — TEST dnes

Plný postup: `akademie/_email/RUNBOOK-onboarding-send.md`. Texty: `akademie/_email/onboarding-videokurz-coaching.md`.
Engine je už onboarding-aware (nepřeskakuje zákazníky) a umí `archive_bcc` (kopie na Martina).

**Pořadí dnes:**
1. `archive_bcc` → `fitness.barna@gmail.com` (krok 0 v runbooku).
2. Vlož 2 šablony (`onboarding-videokurz` step 0, `onboarding-coaching` step 0) — blocks zkopíruj z md.
3. **Pošli TEST na `fitness.barna@gmail.com`** (obě verze) — POST drip-send s `test_email`.
4. **STOP.** Čekej, až Martin napíše „pošli ostro". Nikdy neposílej na ostro bez jeho potvrzení.

**Až řekne ostro (zítra ~8:30):** ověř přístupy (krok 3 runbooku — kdo se NEdostane, ideálně 0),
a naplánuj příjemce s přístupem na zítra 08:30 (krok 4). Hodinový cron je odešle s BCC na Martina.

⚠️ STANDING RULE: před KAŽDÝM ostrým/hromadným odesláním nejdřív TEST na Martina, pak čekej na „pošli ostro".

---

## 3) Dynamická sleva #36 — vytvořit kód + zapnout banner

Frontend `assets/academy-offer.js` (dormant): banner s odpočtem pro aktivní uživatele co nekoupili.
Defaultní config: `CODE:'AKADEMIE10'`, `PCT:10`, `VALID_HOURS:48`, `BUY_URL:'/akademie/objednavka/'`.

**Co zjistit/udělat:**
- Umí SimpleShop **dynamické** kódy (per-uživatel, časově omezené)? Pokud ano → ideál.
- Pokud ne → stačí **jeden statický** SimpleShop kód `AKADEMIE10` na −10 % na Academy.
  Banner sám řeší „komu a kdy se ukáže" (localStorage: min. 3 návštěvy, 1 den, pak 48 h platnost).
- Až je kód v SimpleShopu: v `assets/academy-offer.js` zkontroluj `CODE`/`PCT`, přepni `ENABLED:true`,
  commit → PR → merge → deploy → re-sync.

Preview banneru bez zapnutí: `?offer=test` na `/akademie/`.

---

## Deploy pipeline (pro kroky 1 a 3, když měníš JS)
commit na `claude/learn-claude-code-tay5rb` → push → PR (draft→ready→merge squash) →
`actions_run_trigger` deploy-wedos.yml ref:main → `git fetch origin main && git reset --hard origin/main && git push --force`.
