# LEKCE: Nasazená edge funkce může být novější než repo

**Shrnutí:** Před JAKOUKOLI úpravou Supabase edge funkce nejdřív `get_edge_function` (MCP)
a porovnej s repem. Nasadit „opravu" z repa může smazat živou funkcionalitu.

Stalo se 2026-07-01: repo `drip-send/index.ts` měl DAILY_CAP 75 a starou logiku výběru leadů.
Nasazená v9 měla DAILY_CAP 50, bránu `followups_enabled` (app_config) a prioritizaci
follow-upů před onboarding bulkem — nic z toho v repu nebylo. Kdybych „jen nasadil repo",
otevřel bych follow-upy bez brány a zvedl cap nad bezpečnou rezervu Resend limitu.

**Postup:**
1. `get_edge_function` → diff proti repu.
2. Změny dělej nad NASAZENOU verzí.
3. Po deployi zapiš nasazený stav zpět do repa (repo = zrcadlo, ne zdroj pravdy).

Druhá past téhož večera: deploy payload jsem ručně skládal a zduplikoval catch blok —
Supabase to naštěstí odmítlo (syntax check). Payload vždy skládej ze souboru, ne z hlavy.
