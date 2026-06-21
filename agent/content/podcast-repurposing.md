# Podcast → obsah (jedna epizoda = týden contentu)

Cíl: z práce, kterou už děláš (podcast), vytěžit maximum. Z jedné epizody udělá agent balík
obsahu napříč kanály. Napojení: content engine (`README.md`, `content-calendar.md`),
success stories (`success-stories.md`), publikace (`../integrations/` Blotato).

## Vstup
Odkaz na epizodu (YT/Spotify/Apple) nebo audio/video soubor.

## Postup
1. **Přepis:** `vidiq_video_transcript` (YT) nebo `media_summarize` (audio/video soubor) → text.
2. **Vytěž zlato:** najdi 3–6 nejsilnějších momentů — pointy, kontroverze, „aha" věty,
   příběhy, prakticky použitelné tipy. (Drž tón a fakta dle `../KNOWLEDGE_BASE.md`.)
3. **Vyrob balík** (vše jako DRAFT ke schválení):
   - **2–4 reels/shorts klipy** — `vidiq_generate_clips` na nejlepší úseky + titulky.
   - **1 carousel** „hlavní myšlenka + 3–5 bodů" (viz `carousels.md`).
   - **Show notes** (popis epizody + timestampy + CTA) pro YT/Spotify.
   - **1 e-mail do série** s odkazem na epizodu (recyklace, `content-calendar.md`).
   - **3–5 citátů** na testimonial/grafiku (brand barvy).
4. **Ověř hooky/titulky:** `vidiq_score_title` (+ thumbnail přes `vidiq_score_thumbnail`).
5. **Naplánuj:** přes Blotato do kalendáře (`content-calendar.md`) — pondělí epizoda, klipy přes týden.

## Zásady
- 1 CTA na výstup (lead magnet / koučing / poslech epizody). Žádné lékařské sliby, drž disclaimer.
- Klipy musí dávat smysl i bez kontextu (samostatný hook v prvních 2 s).
- Vše čeká na tvé OK — nic se nepublikuje samo.

## Pointa
1 hodina podcastu → ~10 výstupů. Místo „co dnes postnu?" jen schvaluješ hotové.
