-- search_lessons v2 (nasazeno migraci harden_search_lessons_or_fallback, 14. 7. 2026)
-- websearch AND dotaz najde presne fraze, ale dlouhe konverzacni otazky ANDem nenajdou nic
-- -> RAG AI Martina byl u beznych otazek prazdny. Fallback: OR pres vyznamova slova (>= 4 znaky).
CREATE OR REPLACE FUNCTION public.search_lessons(p_query text, p_limit integer DEFAULT 4)
RETURNS TABLE(lesson_id text, module text, title text, url text, snippet text, rank real)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  q tsquery := websearch_to_tsquery('simple', immutable_unaccent(coalesce(p_query, '')));
  orq tsquery;
BEGIN
  RETURN QUERY
    SELECT d.lesson_id, d.module, d.title, d.url, left(d.content, 1200), ts_rank(d.tsv, q)
    FROM lesson_docs d
    WHERE d.tsv @@ q
    ORDER BY ts_rank(d.tsv, q) DESC
    LIMIT greatest(1, least(coalesce(p_limit, 4), 8));
  IF FOUND THEN RETURN; END IF;

  SELECT to_tsquery('simple', string_agg(t.word, ' | ')) INTO orq
  FROM (
    SELECT DISTINCT w.word
    FROM unnest(tsvector_to_array(to_tsvector('simple', immutable_unaccent(coalesce(p_query, ''))))) AS w(word)
    WHERE length(w.word) >= 4
    LIMIT 12
  ) t;
  IF orq IS NULL THEN RETURN; END IF;

  RETURN QUERY
    SELECT d.lesson_id, d.module, d.title, d.url, left(d.content, 1200), ts_rank(d.tsv, orq)
    FROM lesson_docs d
    WHERE d.tsv @@ orq
    ORDER BY ts_rank(d.tsv, orq) DESC
    LIMIT greatest(1, least(coalesce(p_limit, 4), 8));
END $function$;
