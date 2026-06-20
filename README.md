# MB.cz — Martin Barna (online výživový coaching)

Repozitář má dvě části:

1. **Web** — `index.html` (on-brand landing page) + `clanky/` (SEO blog články).
   Grafit + oranžová, balíčky Gold/Diamond, lead magnet, FAQ, kontakty.
2. **`agent/`** — „mozek" AI asistenta, který za Martina **připravuje koncepty odpovědí**
   (drafty) na e-maily: poptávky, check-iny klientů, WhatsApp dotazy. Agent nikdy nic
   neodesílá — vždy připraví draft, Martin schválí.

## Kudy do toho

- **Orientace pro AI/Claude:** [`CLAUDE.md`](CLAUDE.md)
- **Co agent umí a jak ho spustit:** [`agent/README.md`](agent/README.md), [`agent/RUNBOOK.md`](agent/RUNBOOK.md)
- **Co aktivovat naostro:** [`agent/ACTIVATION.md`](agent/ACTIVATION.md)

## Zásady

- Vývoj na větvi `claude/email-whatsapp-response-agent-h678qg`.
- Osobní data klientů do repa **nepatří** (jen agregát / schémata). Živá data jsou v
  Gmailu, Google Sheetu (CRM) a Drive.
- Fakta (ceny, odkazy) jediný zdroj pravdy: `agent/KNOWLEDGE_BASE.md`.

Be Effective!
