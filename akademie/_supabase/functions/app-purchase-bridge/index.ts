// =============================================================================
// Barna Academy: Edge Function `app-purchase-bridge`.
//
// Appka Tvůj Coach (projekt kfkmghvhqwqtsalqjmrp) sem po PRVNÍ aktivaci předplatného
// pošle fakta o nákupu a SHARED SECRET v hlavičce `x-app-purchase-secret`.
// Odsud se udělá affiliate provize (`referrals`), bonusový videokurz ke KAŽDÉ první
// platbě a měsíc Academy na zkoušku u ročního VIP (obojí `entitlements`).
// Rozhodovací logika je v `core.ts`, tady je jen vodovod.
//
// ⛔ NEPOSLOUCHÁ STRIPE. Vstup je náš vlastní server-to-server hovor, ověřený secretem.
//    Stripe eventy appky zpracovává webhook APPKY; sem se posílá až výsledek.
//
// Secrets:
//   APP_PURCHASE_BRIDGE_SECRET  = dlouhý náhodný řetězec, tentýž má appka v PURCHASE_BRIDGE_SECRET
//   STRIPE_RESTRICTED_PROMO_KEY = čtení promo kódů (rozklad `promo_…` na text kódu).
//                                 Volitelný: bez něj funguje cesta přes `?ref=` odkaz,
//                                 jen se ručně zadaný promo kód nepřečte a zaloguje se to.
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY (alerty)
//
// Deploy: --no-verify-jwt (volá server, ne přihlášený klient; bezpečnost drží secret).
// =============================================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { BridgeError, type BridgeDeps, handleAppPurchase } from "./core.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BRIDGE_SECRET = Deno.env.get("APP_PURCHASE_BRIDGE_SECRET") ?? "";
// ⚠️ RESTRICTED klíč s právem číst promo kódy. `STRIPE_RESTRICTED_SUBS_KEY` na to
// práva NEMÁ (je omezený na Subscriptions), proto samostatná proměnná. Tentýž klíč
// používá `academy-stripe-webhook`; schválně se nesdílí přes app_config, ať se
// tajemství nedostane do tabulky, kterou čte admin.
const STRIPE_PROMO_KEY = Deno.env.get("STRIPE_RESTRICTED_PROMO_KEY") ?? "";
const RESEND_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const ALERT_FALLBACK = "fitness.barna@gmail.com";

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json" } });
}

/** Časově konstantní porovnání (proti timing útoku na secret). Vzor `academy-grant`. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length || a.length === 0) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// Alert adminovi. Vzor 1:1 podle `academy-stripe-webhook`, ať se všechno hlásí na jedno
// místo. ⚠️ Zapisuje do `email_events` (type='error'); tabulka `admin_alerts` v tomhle
// projektu NEEXISTUJE a zápis do ní by tiše mizel.
async function alertAdmin(predmet: string, detail: Record<string, unknown>): Promise<void> {
  try {
    await admin.from("email_events").insert({
      lead_id: null, step: 0, type: "error",
      detail: {
        track: "app-purchase-bridge",
        error: predmet + " " + JSON.stringify(detail).slice(0, 300),
      },
    });
  } catch { /* best-effort */ }

  if (!RESEND_KEY) return;
  try {
    let to = ALERT_FALLBACK;
    const { data } = await admin.from("app_config").select("value").eq("key", "admin_emails").maybeSingle();
    if (data?.value) to = String(data.value).split(",")[0].trim() || ALERT_FALLBACK;
    const rows = Object.entries(detail).map(([k, v]) => `<li><b>${k}</b>: ${String(v)}</li>`).join("");
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: "Bearer " + RESEND_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Barna Academy <news@martinbarna.cz>", to: [to],
        subject: "⚠️ " + predmet,
        html: `<p>Upozornění z mostu nákupů appky (Tvůj Coach → Academy).</p><ul>${rows}</ul>`,
      }),
    });
  } catch { /* best-effort */ }
}

const deps: BridgeDeps = {
  async najdiAktivniKod(kod) {
    const { data } = await admin
      .from("referral_codes").select("owner_email,partner_type,rate_monthly,rate_oneoff")
      .eq("code", kod).eq("active", true).limit(1);
    const r = data?.[0];
    return r
      ? {
        owner_email: String(r.owner_email),
        partner_type: String(r.partner_type ?? "member"),
        rate_monthly: r.rate_monthly === null || r.rate_monthly === undefined ? null : Number(r.rate_monthly),
        rate_oneoff: r.rate_oneoff === null || r.rate_oneoff === undefined ? null : Number(r.rate_oneoff),
      }
      : null;
  },
  // Rozklad ID promo kódu na text. Vzor `zjistiPromoKod` v `academy-stripe-webhook`;
  // schválně se nikdy nevyhazuje výjimka, jen se vrátí důvod, ať se dá zalogovat.
  async rozlozPromoId(promoId) {
    if (!STRIPE_PROMO_KEY) return { kod: "", jak: "chybi-klic:" + promoId.slice(0, 24) };
    try {
      const r = await fetch("https://api.stripe.com/v1/promotion_codes/" + encodeURIComponent(promoId), {
        headers: { Authorization: "Bearer " + STRIPE_PROMO_KEY },
      });
      if (!r.ok) return { kod: "", jak: "lookup-http-" + r.status };
      const j = await r.json();
      return typeof j?.code === "string"
        ? { kod: String(j.code).toUpperCase().trim(), jak: "lookup" }
        : { kod: "", jak: "lookup-bez-code" };
    } catch (e) {
      return { kod: "", jak: "lookup-chyba-" + String(e).slice(0, 40) };
    }
  },
  async jeOrderZapsany(orderId) {
    const { data } = await admin.from("referrals").select("id").eq("order_id", orderId).limit(1);
    return Boolean(data && data.length);
  },
  // Partner z historie: jediné TRVALÉ místo, kde vazba „nákup → partner" u appky žije.
  // ⚠️ Filtr na `product='appka'` je zároveň bezpečnostní hranice: řádky s tímhle produktem
  // zapisuje jen tenhle most, takže se sem nemůže připlést atribuce z Academy.
  async najdiPredchoziKodProAppku(email, subscriptionId) {
    // 1) PŘESNÁ VAZBA na tohle předplatné. Od 13. 8. 2026 hlavní a skoro vždycky jediná
    //    cesta; hledání podle e-mailu platilo provizi z nového přímého nákupu starému
    //    partnerovi (V2 z revize P48).
    if (subscriptionId) {
      const { data, error } = await admin
        .from("referrals").select("code")
        .eq("stripe_subscription_id", subscriptionId).eq("product", "appka").neq("status", "void")
        .order("created_at", { ascending: false }).limit(1);
      if (error) throw new Error("db: " + error.message);
      const kod = data?.[0]?.code;
      if (typeof kod === "string" && kod) return kod;
    }
    // 2) STARÉ ŘÁDKY, zapsané dřív, než sloupec `stripe_subscription_id` existoval:
    //    vazbu na předplatné nemají a jinak než přes e-mail se dohledat nedají. Bez téhle
    //    větve by partner o provizi z už rozjetého předplatného přišel.
    // ⛔ Schválně JEN řádky s prázdným `stripe_subscription_id`. Kdyby se hledalo přes
    //    všechny, vrátila by se V2 zpátky: nový přímý nákup by zase platil starý partner.
    // ⏰ Až budou všechny appkové řádky mít předplatné, tahle větev může zmizet.
    // ⚠️ `buyer_email` se z tohohle mostu zapisuje vždycky malými písmeny (jádro ho
    //    lowercasuje), takže `.eq` stačí a nepotřebujeme `ilike`, který by podtržítko
    //    v adrese bral jako zástupný znak.
    const { data, error } = await admin
      .from("referrals").select("code")
      .eq("buyer_email", email).eq("product", "appka").neq("status", "void")
      .is("stripe_subscription_id", null)
      .order("created_at", { ascending: false }).limit(1);
    if (error) throw new Error("db: " + error.message);
    const kod = data?.[0]?.code;
    return typeof kod === "string" && kod ? kod : null;
  },
  async zapisReferral(row) {
    const { error } = await admin.from("referrals").insert(row);
    if (!error) return "ok";
    // 23505 = unique_violation. Na `referrals` může přijít jedině z `referrals_order_uidx`
    // (jediný další unikátní index je primární klíč z identity, ten se pohádat nemůže),
    // takže to znamená přesně „tuhle platbu už někdo zapsal". Není to selhání, ale
    // idempotence, která dělá svou práci: jádro z toho udělá `duplicita-order` a alert
    // se neposílá. Do 13. 8. 2026 z toho chodil Martinovi falešný poplach (V6).
    if (error.code === "23505") return "duplicita";
    throw new Error("db: " + error.message);
  },
  async zalogujNerozpoznanouSlevu(promoId, jak) {
    try {
      await admin.from("referral_webhook_log").insert({
        matched: false,
        note: "appka: promo kod nerozpoznan: " + jak,
        // Schválně JEN id slevy, ne celý payload: jsou v něm osobní údaje kupujícího.
        payload: { promotion_code_id: promoId, zdroj: "app-purchase-bridge" },
      });
    } catch { /* log je pomůcka, nikdy nesmí shodit nákup */ }
  },
  async najdiEntitlement(email, produkt) {
    const { data } = await admin
      .from("entitlements").select("active,expires_at,source")
      .eq("email", email).eq("product", produkt).maybeSingle();
    return data
      ? { active: Boolean(data.active), expires_at: data.expires_at ?? null, source: data.source ?? null }
      : null;
  },
  async udelEntitlement(row) {
    const { error } = await admin.from("entitlements").upsert(row, { onConflict: "email,product" });
    if (error) throw new Error("db: " + error.message);
  },
  alert: alertAdmin,
};

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);
  if (!BRIDGE_SECRET) return json({ error: "bridge secret not configured" }, 500);

  const provided = req.headers.get("x-app-purchase-secret") ?? "";
  if (!safeEqual(provided, BRIDGE_SECRET)) return json({ error: "unauthorized" }, 401);

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return json({ error: "invalid json" }, 400);
  }

  try {
    const result = await handleAppPurchase(body, deps);
    // Do logu i výsledek: když se něco nepřipíše, tohle je jediné místo, kde se pozná PROČ.
    console.log(`[app-purchase-bridge] event=${String(body.event_id ?? "-")} kind=${String(body.kind ?? "first")} order=${String(body.order_id ?? body.payment_intent ?? "-")} referral=${result.referral} bonus=${result.bonus} academy=${result.academy}`);
    return json(result);
  } catch (e) {
    if (e instanceof BridgeError) return json({ error: e.message }, e.status);
    console.error("[app-purchase-bridge] selhalo:", e);
    // 500 schválně: appka to zaloguje a Stripe event u ní zůstane zpracovaný. Provize
    // se dá dopočítat ručně, ale nesmí se kvůli ní opakovat celý webhook appky.
    await alertAdmin("Most appky: zpracování nákupu selhalo", {
      event_id: String(body.event_id ?? "-"), chyba: String(e).slice(0, 200),
    });
    return json({ error: "bridge failed" }, 500);
  }
});
