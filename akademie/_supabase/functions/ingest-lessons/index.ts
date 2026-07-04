// ingest-lessons — jednorázový/aktualizační plnič korpusu lesson_docs pro RAG AI Martina.
// Načte CURRICULUM z živé stránky /akademie/studium/, pro každou dostupnou lekci stáhne
// její stránku, vytáhne čistý text (bez nav/upsell/quiz) a upsertne do lesson_docs.
// Auth: x-ingest-secret (== app_config.drip_invoke_secret). Zpracuje dávku od ?from o ?count.
// Deploy: supabase functions deploy ingest-lessons --no-verify-jwt
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BASE = Deno.env.get("SITE_BASE") ?? "https://www.martinbarna.cz";

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { "Content-Type": "application/json" } });

function clean(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ").replace(/&hellip;/g, "…").replace(/&mdash;/g, "—").replace(/&ndash;/g, "–")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ").trim();
}
const MARKERS = ['class="quiz"', 'class="done-row"', "lesson-nav", "ba-upsell", '<details class="src"', 'class="src"'];

function extractContent(html: string, fallbackTitle: string): string {
  const h1m = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const h1 = h1m ? clean(h1m[1]) : fallbackTitle;
  let after = h1m ? html.slice((h1m.index ?? 0) + h1m[0].length) : html;
  let cut = after.length;
  for (const mk of MARKERS) { const i = after.indexOf(mk); if (i > -1 && i < cut) cut = i; }
  const body = clean(after.slice(0, cut));
  return (h1 + ". " + body).slice(0, 1100).trim();
}

// deno-lint-ignore no-explicit-any
function parseCurriculum(idxHtml: string): any[] {
  const s = idxHtml.indexOf("var CURRICULUM");
  const arrStart = idxHtml.indexOf("[", s);
  const arrEnd = idxHtml.indexOf("];", s);
  const block = idxHtml.slice(arrStart, arrEnd + 1);
  return new Function("return " + block)();
}

Deno.serve(async (req: Request) => {
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
  const { data: sec } = await admin.from("app_config").select("value").eq("key", "drip_invoke_secret").maybeSingle();
  if (!sec?.value || (req.headers.get("x-ingest-secret") || "") !== sec.value) return json({ error: "unauthorized" }, 401);

  const url = new URL(req.url);
  const from = Math.max(0, parseInt(url.searchParams.get("from") || "0", 10) || 0);
  const count = Math.min(120, Math.max(1, parseInt(url.searchParams.get("count") || "120", 10) || 120));

  const idxHtml = await (await fetch(BASE + "/akademie/studium/")).text();
  const curriculum = parseCurriculum(idxHtml);
  // deno-lint-ignore no-explicit-any
  const flat: { id: string; module: string; title: string; url: string }[] = [];
  for (const m of curriculum) {
    for (const l of (m.lessons || [])) {
      if (l.available) flat.push({ id: l.id, module: m.t, title: l.t, url: "/akademie/studium/" + l.id + "/" });
    }
  }
  const slice = flat.slice(from, from + count);

  let ok = 0, fail = 0;
  const rows: { lesson_id: string; module: string; title: string; url: string; content: string }[] = [];
  // stahuj po menších skupinách, ať to nezahltí
  const GROUP = 12;
  for (let i = 0; i < slice.length; i += GROUP) {
    const grp = slice.slice(i, i + GROUP);
    const fetched = await Promise.all(grp.map(async (L) => {
      try {
        const html = await (await fetch(BASE + L.url, { headers: { "Cache-Control": "no-cache" } })).text();
        const content = extractContent(html, L.title);
        if (content.length < 40) return null;
        return { lesson_id: L.id, module: L.module, title: L.title, url: L.url, content };
      } catch { return null; }
    }));
    for (const r of fetched) { if (r) { rows.push(r); ok++; } else fail++; }
  }

  if (rows.length) {
    const { error } = await admin.from("lesson_docs").upsert(rows, { onConflict: "lesson_id" });
    if (error) return json({ error: "db", detail: error.message, ok, fail }, 500);
  }

  return json({ ok, fail, total_available: flat.length, from, count, next_from: from + count < flat.length ? from + count : null });
});
