// gads-conversions-feed — offline import konverzí do Google Ads (READ-ONLY nad `leads`).
// Google Ads si tento endpoint denně stáhne (naplánovaný HTTPS upload) a napáruje leady
// z Google reklam přes gclid — i bez cookie-souhlasu.
//
// GET ?token=<secret>  → token se čte z app_config['gads_feed_token']; nesedí → 403.
// Vrací text/csv v PŘESNÉM formátu Google Ads offline importu.
// NIC nemění: jen čte app_config a leads.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const token = (url.searchParams.get("token") || "").trim();

  const supa = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  // Config: token + název konverze
  const { data: cfg, error: cfgErr } = await supa
    .from("app_config")
    .select("key,value")
    .in("key", ["gads_feed_token", "gads_offline_conversion_name"]);
  if (cfgErr) {
    return new Response("config error: " + cfgErr.message, {
      status: 500, headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }
  const map: Record<string, string> = {};
  (cfg || []).forEach((r: { key: string; value: string }) => { map[r.key] = r.value; });

  const expected = (map["gads_feed_token"] || "").trim();
  if (!expected || token !== expected) {
    return new Response("Forbidden", {
      status: 403, headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }
  const convName = (map["gads_offline_conversion_name"] || "").trim() ||
    "Odeslani formulare pro zajemce (offline)";

  // READ-ONLY: leady s gclidem za posledních 90 dní (atribuční okno Google Ads).
  const since = new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString();
  const { data: leads, error } = await supa
    .from("leads")
    .select("meta, created_at")
    .not("meta->>gclid", "is", null)
    .gt("created_at", since)
    .order("created_at", { ascending: true });
  if (error) {
    return new Response("query error: " + error.message, {
      status: 500, headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  const esc = (s: string) => /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  const fmt = (iso: string) =>
    new Date(iso).toISOString().slice(0, 19).replace("T", " ") + "+00:00";

  const lines: string[] = [
    "Parameters:TimeZone=+0000",
    "Google Click ID,Conversion Name,Conversion Time,Conversion Value,Conversion Currency",
  ];
  for (const row of (leads || []) as Array<{ meta: Record<string, unknown>; created_at: string }>) {
    const gclid = row.meta && typeof row.meta.gclid === "string" ? row.meta.gclid : "";
    if (!gclid) continue;
    // <gclid>,<conversion_name>,<time>,,   (hodnota a měna prázdné)
    lines.push(`${esc(gclid)},${esc(convName)},${fmt(row.created_at)},,`);
  }

  return new Response(lines.join("\n") + "\n", {
    status: 200,
    headers: { "content-type": "text/csv; charset=utf-8", "cache-control": "no-store" },
  });
});
