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
//
// ⛔⛔ [2026-08-21] TENHLE SOUBOR BYL ZACHRANEN Z NASAZENE FUNKCE (verze 16).
//    Do 21. 8. 2026 zila cela logika niz POUZE jako nasazeny blob: v gitu byla
//    83radkova verze BEZ mapovani `tvujcoach-registrace`, BEZ pauzovani pri smazani
//    uctu a BEZ ochrany akvizicnich trati. Kdokoli by funkci nasadil z repa, tise by
//    to vsechno smazal.
//    PRICINA: v MB.cz je cela slozka `supabase/` v `.gitignore` (radek 10), takze
//    pracovni kopie, ze ktere se nasazuje, se necommituje. Sledovana kopie je tahle,
//    pod `akademie/_supabase/functions/`. ⇒ **Kdo meni edge funkci, musi zapsat OBĚ.**
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
  // [2026-07-30] REGISTRACE (ne nákup) z reklamní kampaně `tc-direct`.
  // Volá to trigger v appkové DB, který se pálí JEN když `profiles.signup_attribution`
  // nese `utm_campaign=tc-direct`.
  // [2026-08-20] ⭐ ZMĚNA CÍLE: `tc-free` (série A, 12 mailů) → `tc-zkusebka` (4 maily).
  // Důvod: od zavedení 14denní zkušebky je KAŽDÁ registrace zkušebka, a mosty z appky
  // (`onboarding-bridge`) posílají registrace všech lidí, ne jen z reklamy. Kdyby každá
  // cesta mířila jinam, člověk z reklamy by dostal první mail série A a vzápětí by ho
  // druhý most přehodil do zkušebkové trati od kroku 0. Jeden cíl = žádné přehazování.
  // ⚠️ Lidé, kteří v `tc-free` UŽ BĚŽÍ, tam zůstávají a dojedou ji; mění se jen to,
  //    kam padají NOVÍ.
  "tvujcoach-registrace": "tc-zkusebka",
  // Alias na tentýž cíl. Appka historicky mluví o produktu `tvujcoach-zkusebka`;
  // ať je jedno, který klíč pošle, oba musí skončit ve stejné trati, jinak by
  // deduplikace níž lidi přehazovala tam a zpět.
  "tvujcoach-zkusebka": "tc-zkusebka",
};

// Produkty, které znamenají REGISTRACI (ne nákup). Drží pohromadě kvůli ochraně
// akvizičních tratí níž: nákup přebít smí, registrace ne.
const REGISTRACNI = new Set(["tvujcoach-registrace", "tvujcoach-zkusebka"]);

// ⛔ SMAZÁNÍ ÚČTU NEZAKLÁDÁ SEKVENCI, ZASTAVUJE JI. Lead v Academy DB přežije výmaz
// účtu v appce, takže by mu série jela dál na schránku, kterou už nikdo nečte.
// `paused` + `next_send_at = null` je tady zavedený způsob, jak lead odstavit:
// `drip-send` bere do fronty jen `status='active'` a `enroll_*` funkce `paused` neberou.
const PRODUKT_SMAZANI = "tvujcoach-smazani";

// ⛔ [2026-09-06] VRACENI PENEZ MUSI UMLCET PONAKUPNI MAILY.
// Zmereno na zakaznici, ktera dostala refund 2. 9. v 11:42: pristup ji appka odebrala
// spravne, ale maily placene trate jí chodily dal (`tc-48h-konzultace` 4. 9.,
// `tc-ai` 5. 9.) a cekal ji jeste `tc-checkin` 10. 9., tedy mail o funkci, kterou uz nema.
// Webhook appky pri refundu na Academy dosud nesahal vubec.
//
// ⚠️ PROC NE `tvujcoach-smazani`: ten da leadu `status='paused'`, cimz cloveku vypne
//    i bezny newsletter. Kdo dostal penize zpet, se z mailu neodhlasil. Parkuje se proto
//    stejne jako u odstoupeni od smlouvy (edge funkce `withdrawal`): jen trate
//    `onboarding-nakup-%`, pres `next_send_at = null`, status zustava `active`.
const PRODUKT_REFUND = "tvujcoach-refund";

// [2026-09-03] Akviziční tratě UŽ registrace PŘEBÍJÍ (viz komentář v těle). Seznam
// slouží jen k tomu, aby se původní trať a krok uložily do `meta.puvodni_trat`,
// kdyby se člověk měl někdy vrátit nebo kdybychom chtěli změřit, odkud přišel.
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

  // SMAZÁNÍ ÚČTU: zastavit, co běží. Nikdy nezakládat nový lead, člověk právě odešel.
  if (product === PRODUKT_SMAZANI) {
    const { data: l, error: cteniErr } = await admin
      .from("leads").select("id, track, status").eq("email", email).maybeSingle();
    if (cteniErr) return json({ error: "lookup_failed", detail: cteniErr.message }, 500);
    if (!l) return json({ ok: true, status: "neni_v_zadne_sekvenci" });
    // Odhlášení a bounce nepřepisujeme: jsou to silnější stavy a mají svůj význam.
    if (l.status !== "active") return json({ ok: true, status: "uz_neaktivni", byl: l.status });
    const { error } = await admin.from("leads").update({
      status: "paused", next_send_at: null, updated_at: new Date().toISOString(),
    }).eq("id", l.id);
    if (error) return json({ error: "pause_failed", detail: error.message }, 500);
    return json({ ok: true, status: "pauznuto", track: l.track });
  }

  // VRACENI PENEZ: zaparkovat ponakupni trate, bezny mailing nechat bezet.
  if (product === PRODUKT_REFUND) {
    const { data: parkovane, error: parkErr } = await admin
      .from("leads")
      .update({ next_send_at: null, updated_at: new Date().toISOString() })
      .eq("email", email).eq("status", "active").like("track", "onboarding-nakup-%")
      .select("id, track, step");
    if (parkErr) return json({ error: "park_failed", detail: parkErr.message }, 500);
    for (const p of parkovane ?? []) {
      // Stopa v historii, at je pozdeji videt, PROC lead prestal dostavat maily.
      // Selhani zapisu udalosti nesmi shodit uz provedene zaparkovani.
      await admin.from("email_events").insert({
        lead_id: p.id, step: p.step, type: "paused_refund",
        detail: { track: p.track, duvod: "vraceni penez ve Stripu", zdroj: source },
      }).then(() => {}, () => {});
    }
    return json({
      ok: true,
      status: (parkovane ?? []).length > 0 ? "zaparkovano" : "nic_k_parkovani",
      trate: (parkovane ?? []).map((p) => p.track),
    });
  }

  const track = TRACKY[product];
  if (!track) return json({ error: "unknown_product", got: product }, 400);

  // DEDUPLIKACE (kolega o ni vyslovne zadal): jeden clovek = jeden beh onboardingu.
  // Kdyz uz nejakou onboarding sekvenci ma (treba koupil driv Academy), nezakladame druhou,
  // jinak by mu chodily dve rady mailu naraz.
  const { data: lead } = await admin
    .from("leads").select("id, track, step, status, purchased, meta").eq("email", email).maybeSingle();

  if (lead) {
    if (lead.track === track) return json({ ok: true, status: "uz_v_teto_sekvenci" });
    if (String(lead.track ?? "").startsWith("onboarding-")) {
      return json({ ok: true, status: "uz_v_jinem_onboardingu", track: lead.track });
    }
    // ⭐⭐ [2026-09-03, Martin: „udělej to tak, abychom začali vydělávat"] REGISTRACE
    // V APPCE PŘEBÍJÍ I AKVIZIČNÍ TRAŤ. Do 3. 9. platil kompromis z 21. 8.: trať se
    // nechala běžet (prodej Academy za 8 900) a člověk dostal jeden mail `tc-aktivace`.
    // Pitva 3. 9. (60 dní): akviziční tratě studeným lidem Academy neprodaly ani jednou
    // (longtail 0 nákupů, kvíz 162 lidí a 0 nákupů), zatímco aktivace v appce je jediné
    // hrdlo, kde se rozhoduje o platbě (58 registrací → 3 check-iny → 0 platících).
    // Proto registrace přepíná do `tc-zkusebka` od kroku 0. Razítko `tc-direct-registrace`
    // v `meta` zůstává kvůli atribuci a jako stopa, odkud člověk přišel.
    // ⚠️ Konstanta AKVIZICNI výš zůstává jen pro záznam do `meta.puvodni_trat`.
    const puvodniMeta = (lead.meta as Record<string, unknown>) ?? {};
    const meta = REGISTRACNI.has(product)
      ? {
        ...puvodniMeta,
        "tc-direct-registrace": new Date().toISOString(),
        ...(jeAkvizicni(String(lead.track ?? "")) && !puvodniMeta["puvodni_trat"]
          ? { puvodni_trat: lead.track, puvodni_krok: (lead as Record<string, unknown>).step ?? null }
          : {}),
      }
      : puvodniMeta;
    // Nakup i registrace jsou silnejsi signal nez akvizicni serie, prepneme ho.
    const { error } = await admin.from("leads").update({
      track, step: 0, status: "active", meta,
      next_send_at: new Date().toISOString(), updated_at: new Date().toISOString(),
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
