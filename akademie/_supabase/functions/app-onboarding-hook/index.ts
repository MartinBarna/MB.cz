// app-onboarding-hook — most z appky Tvuj Coach do mailoveho onboardingu na webu.
//
// PROC EXISTUJE: appka se plati Stripem uvnitr appky, kdezto vsechny drip sekvence spousteji
// SimpleShop nakupy. Kdo si koupil predplatne, nedostal dosud zadny onboarding.
//
// ROZDELENI ROLI (schvalil Martin, domluveno s kolegou od appky):
//   - POTVRZENI OBJEDNAVKY posila APPKA. Je to zakonna povinnost a patri k transakci.
//     Tahle funkce potvrzeni NEPOSILA a posilat nesmi, jinak by clovek dostal mail dvakrat.
//   - ONBOARDING jede tady, kde zijí sekvence. Appka sem jen kopne.
//
// Volani z appky:
//   POST https://uhmrpfsdcujbhbtumqye.supabase.co/functions/v1/app-onboarding-hook
//   x-app-secret: <app_config.app_onboarding_secret>
//   { "email": "...", "product": "tvujcoach", "tier": "ai_basic", "source": "app-stripe" }
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-app-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
const low = (s: unknown) => String(s ?? "").trim().toLowerCase();

// Zatim jediny produkt, ktery sem chodi. Seznam drzi kontrolu nad tim, do jake sekvence
// se clovek zapise (nechceme, aby appka mohla poslat libovolny track).
const TRACKY: Record<string, string> = {
  tvujcoach: "onboarding-nakup-tvujcoach",
  // [2026-08-20] ⭐ REGISTRACE (ne nákup) z reklamní kampaně `tc-direct` → `tc-zkusebka`.
  // Volá to trigger v appkové DB, který se pálí JEN když `profiles.signup_attribution`
  // nese `utm_campaign=tc-direct`. Organické registrace se sem vůbec nedostanou,
  // filtr je v podmínce triggeru, ne tady. Kdo už leží v `tc-free`, tam zůstává:
  // tenhle klíč mění jen NOVÉ zápisy, žádný backfill.
  "tvujcoach-registrace": "tc-zkusebka",
};

// ⛔ AKVIZIČNÍ TRATĚ SE NEPŘEPISUJÍ. Kdo běží v magnetové nebo nurture sekvenci a mezitím
// se zaregistruje v appce z reklamy, dojede svou sekvenci do konce. Přepnutí by ho vytrhlo
// uprostřed příběhu, který mu slibujeme. `tc-zkusebka` (dřív `tc-free`) nezačíná na
// `onboarding-`, takže by ho stará podmínka níž nechytila. Registraci jen zapíšeme do
// `meta`, ať to atribuce vidí. (Nákup je pořád silnější signál a přepnout smí, ten sem
// chodí jako `product: tvujcoach`.)
const AKVIZICNI = ["lead-magnet", "tc-magnet", "nurture-", "trener-kit", "longtail-"];
const jeAkvizicni = (t: string) => AKVIZICNI.some((p) => t.startsWith(p));

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method" }, 405);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

  // Sdilene tajemstvi drzime v app_config, at jde vymenit bez nasazovani funkce.
  const { data: sec } = await admin.from("app_config").select("value").eq("key", "app_onboarding_secret").maybeSingle();
  if (!sec?.value) return json({ error: "not_configured" }, 500);
  if (req.headers.get("x-app-secret") !== sec.value) return json({ error: "forbidden" }, 403);

  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const email = low(body?.email);
  const product = low(body?.product) || "tvujcoach";
  const tier = low(body?.tier) || null;
  const source = low(body?.source) || "app-stripe";

  if (!email.includes("@")) return json({ error: "invalid_email" }, 400);
  const track = TRACKY[product];
  if (!track) return json({ error: "unknown_product", got: product }, 400);

  // DEDUPLIKACE (kolega o ni vyslovne zadal): jeden clovek = jeden beh onboardingu.
  // Kdyz uz nejakou onboarding sekvenci ma (treba koupil driv Academy), nezakladame druhou,
  // jinak by mu chodily dve rady mailu naraz.
  const { data: lead } = await admin
    .from("leads").select("id, track, status, purchased, meta").eq("email", email).maybeSingle();

  if (lead) {
    if (lead.track === track) return json({ ok: true, status: "uz_v_teto_sekvenci" });
    if (String(lead.track ?? "").startsWith("onboarding-")) {
      return json({ ok: true, status: "uz_v_jinem_onboardingu", track: lead.track });
    }
    // ⭐ REGISTRACE Z REKLAMY nepřebíjí rozjetou akviziční trať (viz komentář u AKVIZICNI).
    // Jen si k leadovi poznamenáme, že se registroval, ať atribuce nepřijde o informaci.
    if (product === "tvujcoach-registrace" && jeAkvizicni(String(lead.track ?? ""))) {
      const meta = { ...(lead.meta as Record<string, unknown> ?? {}), "tc-direct-registrace": new Date().toISOString() };
      const { error } = await admin.from("leads")
        .update({ meta, updated_at: new Date().toISOString() }).eq("id", lead.id);
      if (error) return json({ error: "meta_update_failed", detail: error.message }, 500);
      return json({ ok: true, status: "ponechan_v_akvizicni_trati", track: lead.track });
    }
    // Byl jen v nurture nebo lead-magnetu: nakup je silnejsi signal, prepneme ho.
    const { error } = await admin.from("leads").update({
      track, step: 0, status: "active", next_send_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }).eq("id", lead.id);
    if (error) return json({ error: "update_failed", detail: error.message }, 500);
    return json({ ok: true, status: "prepnut_do_onboardingu", z: lead.track });
  }

  const { error } = await admin.from("leads").insert({
    email, track, step: 0, status: "active",
    next_send_at: new Date().toISOString(),
    source: source + (tier ? ":" + tier : ""),
  });
  if (error) return json({ error: "insert_failed", detail: error.message }, 500);

  return json({ ok: true, status: "zalozen" });
});
