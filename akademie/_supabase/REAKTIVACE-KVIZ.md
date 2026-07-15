# Reaktivace mrtvých leadů — kvíz (one-click launch)

Stav: **připraveno, NESPUŠTĚNO** (čeká na Martinovo ANO + na to, až vůbec existují kandidáti).

- Kvíz stránka: `/kviz/` — živá po deployi, funguje i standalone (organika, ads, sítě).
- Šablona: `email_templates` track `reaktivace-kviz`, step 0 (jediný mail, pak track končí).
- Kandidát = lead, který **dojel celou sekvenci** (drip ho zaparkoval: `next_send_at IS NULL`),
  nekoupil, je `active` a od posledního pohybu uplynulo 30+ dní. Mailing běží od 28. 6. 2026,
  takže první kandidáti se objeví nejdřív ~září 2026.

## Spuštění (jeden UPDATE, pouze consumer tracky)

```sql
-- Nejdřív dry-run počet:
SELECT count(*) FROM leads
WHERE status='active' AND coalesce(purchased,false)=false
  AND next_send_at IS NULL
  AND track IN ('lead-magnet','nurture-videokurz','existing-leadmagnet','lead-magnet-tool','nurture-pro-vas')
  AND updated_at < now() - interval '30 days';

-- Ostrý enroll (stejné WHERE):
UPDATE leads SET track='reaktivace-kviz', step=0, next_send_at=now(), updated_at=now()
WHERE status='active' AND coalesce(purchased,false)=false
  AND next_send_at IS NULL
  AND track IN ('lead-magnet','nurture-videokurz','existing-leadmagnet','lead-magnet-tool','nurture-pro-vas')
  AND updated_at < now() - interval '30 days';
```

## Před spuštěním ještě udělat

1. V `lead-capture` fn doplnit do duplicate větve: když `source==='kviz'` a existující lead má
   `track='reaktivace-kviz'` → restart `track='lead-magnet', step=0, next_send_at=now()`
   (reaktivovaný lead, co vyplní kvíz box, si tím řekne o novou sekvenci; jiné tracky NEresetovat).
2. Dry-run počet ukázat Martinovi, až pak UPDATE.
