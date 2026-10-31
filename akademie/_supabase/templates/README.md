# Šablony e-mailů Supabase Auth (Barna Academy, projekt uhmrpfsdcujbhbtumqye)

Supabase posílá tyhle maily sám, na Wedos se nenahrávají (`akademie/_supabase/**` je v exclude deploye).
Obsah se vkládá ručně v dashboardu: Authentication → Emails → Templates. Při změně uprav soubor tady a vlož ho znovu 1:1.

| Šablona v dashboardu | Předmět | Tělo (celý soubor 1:1) |
|---|---|---|
| Confirm signup | Potvrď svůj e-mail pro Barna Academy | `potvrzeni-registrace.html` |

- Vzhled je jednotný kabát Martinových mailů (`wrapHtml` z `akademie/_supabase/functions/drip-send/index.ts`): tmavá karta, zlatá linka, značka MARTIN BARNA, tmavá patička.
- `{{ .ConfirmationURL }}` nechat přesně tak (doplní Supabase). Odkaz se nesmí přepisovat přes mail-pixel, nese bezpečnostní token.
- Patička bez odhlášení: jde o transakční mail k registraci, ne o obchodní sdělení.
