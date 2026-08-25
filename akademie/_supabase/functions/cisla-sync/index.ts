// cisla-sync: Academy cron (4x denne) stahne verejna cisla z RPC appky a zapise je
// do app_config (pocet_potravin, pocet_receptu, pocet_cisel_mereno_v + *_raw).
// POZOR NA DVA TVARY: pocet_potravin je ZOBRAZOVANA hodnota ("50 000", zaokrouhlena
// dolu na 10 000) a do mailu patri ona. pocet_potravin_raw je SUROVE cislo (59 024)
// a slouzi VYHRADNE sanity brane, aby porovnavala raw proti raw. Kdyby se brana
// merila proti zobrazovane hodnote, propustila by i propad o ctvrtinu.
// Auth: hlavicka x-cisla-secret == app_config.cisla_sync_secret. Jen hlavicka, nikdy ?secret=.
// Deploy: --no-verify-jwt (vola ho pg_cron, ne uzivatel).
import { createClient } from "jsr:@supabase/supabase-js@2";
import { overSanitu, parseVerejneCislo } from "./format.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const APP_RPC = "https://kfkmghvhqwqtsalqjmrp.supabase.co/rest/v1/rpc/verejna_cisla";
const APP_ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtma21naHZocXdxdHNhbHFqbXJwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4ODA2NjQsImV4cCI6MjA5NTQ1NjY2NH0.8meIfIw51xCttJQa2WHMuX7ArbuCh4kK7t-ZWG7JSQA";

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { "Content-Type": "application/json" } });

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "method-not-allowed" }, 405);
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

  const { data: cfg } = await admin.from("app_config").select("value").eq("key", "cisla_sync_secret").maybeSingle();
  const expected = cfg?.value ?? "";
  const provided = req.headers.get("x-cisla-secret") || "";
  if (!expected || provided !== expected) return json({ error: "unauthorized" }, 401);

  const { data: stareRadky } = await admin.from("app_config").select("key,value")
    .in("key", [
      "pocet_potravin",
      "pocet_receptu",
      "pocet_cisel_mereno_v",
      "pocet_potravin_raw",
      "pocet_receptu_raw",
    ]);
  const stare = Object.fromEntries((stareRadky ?? []).map((r: { key: string; value: string }) => [r.key, r.value]));
  // RAW proti RAW: brana cte pocet_potravin_raw, nikdy zobrazovany pocet_potravin.
  // Prvni beh klic jeste nema -> null -> brana poklesu i stropu se preskoci a raw se zapise.
  const ulozeneRaw = parseVerejneCislo(stare.pocet_potravin_raw ?? "");
  const ulozenePotravinyRaw = Number.isFinite(ulozeneRaw) ? ulozeneRaw : null;

  let rpcJson: unknown;
  try {
    const res = await fetch(APP_RPC, {
      method: "POST",
      headers: {
        apikey: APP_ANON,
        Authorization: "Bearer " + APP_ANON,
        "Content-Type": "application/json",
      },
      body: "{}",
    });
    if (!res.ok) {
      return json({ ok: false, duvod: "rpc_http_" + res.status, stare });
    }
    rpcJson = await res.json();
  } catch (e) {
    return json({ ok: false, duvod: "rpc_fetch:" + String(e).slice(0, 200), stare });
  }

  const rpc = (rpcJson && typeof rpcJson === "object") ? rpcJson as Record<string, unknown> : {};
  if (rpc.ok === false) {
    return json({ ok: false, duvod: String(rpc.duvod ?? "rpc_ok_false"), stare, rpc });
  }
  const sanity = overSanitu(rpc, ulozenePotravinyRaw);
  if (!sanity.ok) {
    return json({ ok: false, duvod: sanity.duvod, stare, rpc });
  }

  const ted = new Date().toISOString();
  const mereno = sanity.mereno_v || ted;
  const radky = [
    { key: "pocet_potravin", value: sanity.potraviny_zobrazit, updated_at: ted },
    { key: "pocet_receptu", value: sanity.recepty_zobrazit, updated_at: ted },
    { key: "pocet_cisel_mereno_v", value: mereno, updated_at: ted },
    // *_raw jsou vstup pro sanity branu pristiho behu, ne text do mailu.
    { key: "pocet_potravin_raw", value: String(sanity.potraviny_raw), updated_at: ted },
    { key: "pocet_receptu_raw", value: String(sanity.recepty_raw), updated_at: ted },
  ];
  const { error } = await admin.from("app_config").upsert(radky, { onConflict: "key" });
  if (error) return json({ ok: false, duvod: "upsert:" + error.message, stare }, 500);

  return json({
    ok: true,
    stare: {
      pocet_potravin: stare.pocet_potravin ?? null,
      pocet_receptu: stare.pocet_receptu ?? null,
      pocet_cisel_mereno_v: stare.pocet_cisel_mereno_v ?? null,
      pocet_potravin_raw: stare.pocet_potravin_raw ?? null,
      pocet_receptu_raw: stare.pocet_receptu_raw ?? null,
    },
    nove: {
      pocet_potravin: sanity.potraviny_zobrazit,
      pocet_receptu: sanity.recepty_zobrazit,
      pocet_cisel_mereno_v: mereno,
      potraviny_raw: sanity.potraviny_raw,
      recepty_raw: sanity.recepty_raw,
    },
  });
});
