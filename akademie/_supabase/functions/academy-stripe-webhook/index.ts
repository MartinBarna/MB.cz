// ============================================================
// Barna Academy — Stripe webhook pro MĚSÍČNÍ členství 990 Kč/měs.
//
// Doživotní varianta (8 900) jde dál přes SimpleShop a `simpleshop-webhook`.
// Tahle funkce řeší VÝHRADNĚ předplatné ze Stripu.
//
// ⛔ NEVOLÁ `academy-grant` appky Tvůj Coach. Měsíční členství appku V CENĚ NEMÁ
//    (rozhodnutí 2 mise `mb-academy-pricing-mise`). Roční VIP appky zůstává
//    exkluzivní výhodou doživotní varianty, je to hlavní důvod k upgradu.
//    Kdo sem TC grant přidá, zabije ten důvod a rozdá appku zadarmo.
//
// ⛔ NEENROLLUJE do `onboarding-nakup-academy`. Ta trať je psaná pro doživotní
//    nákup a její step 0 slibuje appku Tvůj Coach jako dárek včetně přihlašovacího
//    tlačítka. Měsíčnímu členovi by tedy hned po zaplacení přišel slib, který
//    neplatí, a tlačítko, které ho nikam nepustí. Proto vlastní trať.
//
// Deploy: --no-verify-jwt (autentizace je Stripe podpisem, ne JWT).
// Env: STRIPE_WEBHOOK_SECRET (whsec_...), SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// ============================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const STRIPE_WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "";
const RESEND_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const ALERT_FALLBACK = "fitness.barna@gmail.com";

// ⚠️ RESTRICTED klíč, NE plný secret. Práva jen Subscriptions:Write (+Read, co si
// k tomu Stripe vyžádá). Schválně se nejmenuje STRIPE_SECRET_KEY jako v appce, aby
// si nikdo nemyslel, že tu leží plný klíč a že si přes něj může sáhnout na platby.
// Slouží k JEDINÉ věci: zrušit předplatné při refundu. Bez něj by se za měsíc
// strhlo znovu, i když jsme přístup odebrali.
const STRIPE_SUBS_KEY = Deno.env.get("STRIPE_RESTRICTED_SUBS_KEY") ?? "";

// Tratě rozlučkového mailu. ⛔ JSOU DVĚ a musí se vybrat podle situace.
// Engine neumí podmínky, takže větev „přístup končí ihned" a „přístup ještě doběhne"
// nejdou udělat v jedné šabloně. Tady se jen vybírá, která se použije.
// ⚠️ 28. 7. 2026 tu byl název `rozlouceni-refund`, který NEEXISTUJE. Rozdělil jsem
// tratě na dvě a konstantu zapomněl přepsat ⇒ při prvním ostrém refundu mail
// NEODEŠEL a chytila to až pojistka „chybí šablona". Proto tu ta poznámka je.
const ROZLOUCENI_HNED = "rozlouceni-refund-hned";
const ROZLOUCENI_DOJEZD = "rozlouceni-refund-dojezd";

/** Vybere trať podle toho, jestli přístup končí teď, nebo ještě doběhne. */
function rozlouceniTrack(expiraceIso: string | null): string {
  if (!expiraceIso) return ROZLOUCENI_HNED;
  return new Date(expiraceIso).getTime() > Date.now() + 60_000
    ? ROZLOUCENI_DOJEZD
    : ROZLOUCENI_HNED;
}

// ⛔⛔ ROZLUČKOVÁ ŠABLONA MÁ VLASTNÍ PROMĚNNÉ A VOLAJÍCÍ JE MUSÍ POSLAT.
// Používá {{castka}}, {{produkt}}, {{varianta}}, {{znovu_odkaz}}, větev s dojezdem
// navíc {{pristup_do}}. NEJSOU to vestavěné proměnné `drip-send`, posílají se v `vars`.
// Když chybí jediná, render spadne na `unresolved_token` a mail NIKDY NEODEJDE.
// ⚠️ Stalo se 28. 7. 2026 při ostrém refundu: trať se vybrala správně, přístup se
// odebral správně, ale mail skončil jako 'error' v `email_events` a Martinovi nic
// nepřišlo. Příčina: tahle cesta recykluje `posliUvitani`, napsaný pro uvítačku,
// která žádné vlastní proměnné nemá. Sesterský `simpleshop-webhook` je posílá
// od začátku ⇒ zase vzorec „nová cesta, staré pravidlo".
function castkaText(halere: number, mena: string): string {
  const c = Math.round(halere) / 100;
  const cislo = Number.isInteger(c) ? String(c) : c.toFixed(2).replace(".", ",");
  return (mena || "czk").toLowerCase() === "czk"
    ? cislo + " Kč"
    : cislo + " " + (mena || "").toUpperCase();
}

/** Datum pro člověka, v pražském čase (edge běží v UTC, u večerních akcí by to jinak ujelo o den). */
function datumCesky(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("cs-CZ", { timeZone: "Europe/Prague" });
  } catch {
    return iso.slice(0, 10);
  }
}

// Stripe (live, účet Tvůj Coach acct_1TqQ56Bq3rKubW9k), založeno 28. 7. 2026:
//   produkt      prod_Uy7nu91R8yjVwI  „Barna Academy členství"
//   price        price_1TyBXTBq3rKubW9kGizHd41g  = 990 CZK/měs, DPH v ceně
//   Payment Link https://buy.stripe.com/bJe9AS3UXgjMcjC8hF3ks00
//   redirect po platbě -> https://martinbarna.cz/akademie/vitejte/

// ⛔⛔ WHITELIST: KTERÉ PLATBY VŮBEC ZAKLÁDAJÍ ACADEMY (přidáno 28. 7. 2026)
// Stripe účet je SPOLEČNÝ pro Academy i pro appku Tvůj Coach (acct_1TqQ56Bq3rKubW9k)
// a webhook endpoint dostává události CELÉHO účtu, ne jen našeho produktu.
// Bez téhle kontroly by každý, kdo si v appce koupí VIP za 499 Kč, dostal zdarma
// i Academy za 8 900 Kč, a nikdo by se to nedozvěděl (nic by nespadlo, alert nesepne).
// Ceny appky pro představu, TY SEM NEPATŘÍ: price_1TtvIk… 499, price_1TtvN6… 249.
// Vzorec „nová cesta, staré pravidlo": appkový stripe-webhook se proti cizím platbám
// brání tím, že vyžaduje user_id v metadatech. Tenhle guard je jeho protějšek.
const ALLOWED_PLINKS = (Deno.env.get("ACADEMY_ALLOWED_PLINKS") ??
  "plink_1TyBZUBq3rKubW9k81dwwUsq,plink_1TyFAyBq3rKubW9kXRelRllH")
  .split(",").map((s) => s.trim()).filter(Boolean);

const ALLOWED_PRICES = (Deno.env.get("ACADEMY_ALLOWED_PRICES") ??
  "price_1TyBXTBq3rKubW9kGizHd41g,price_1TyF94Bq3rKubW9kuUZwqGWv")
  .split(",").map((s) => s.trim()).filter(Boolean);

// Záchranná síť: kdyby na témž produktu vznikla nová cena a zapomnělo se ji sem dopsat,
// grant by tiše přestal chodit platícím lidem. Produkt je stabilnější klíč než cena.
const ALLOWED_PRODUCTS = (Deno.env.get("ACADEMY_ALLOWED_PRODUCTS") ?? "prod_Uy7nu91R8yjVwI")
  .split(",").map((s) => s.trim()).filter(Boolean);

// Vytáhne z řádků faktury ceny a produkty.
// ⚠️ Tvar ověřen proti Stripe API 2026-06-24.dahlia: cena je na
// `lines.data[].pricing.price_details.price`, NE na `price.id` jako ve starších
// verzích. Čteme obojí, ať to nespadne při změně verze ani jedním směrem.
// Kdyby se četla jen stará cesta, whitelist by neodpovídal NIČEMU a Academy by
// nedostal ani ten, kdo řádně zaplatil. To je horší vada než ta, kterou tohle řeší.
// deno-lint-ignore no-explicit-any
function cenyAProdukty(lines: any): { ceny: string[]; produkty: string[] } {
  const ceny: string[] = [], produkty: string[] = [];
  for (const l of (Array.isArray(lines?.data) ? lines.data : [])) {
    const p = l?.pricing?.price_details;
    const cena = p?.price ?? l?.price?.id ?? null;          // nová i legacy cesta
    const produkt = p?.product ?? l?.price?.product ?? null;
    if (typeof cena === "string") ceny.push(cena);
    if (typeof produkt === "string") produkty.push(produkt);
  }
  return { ceny, produkty };
}

// Trať pro MĚSÍČNÍ členy. Musí existovat v `email_templates`, jinak se pošle alert
// a člen zůstane bez uvítačky (přístup dostane tak jako tak, grant je první).
const WELCOME_TRACK = "onboarding-nakup-academy-mesicni";

// Kolik dní po konci zaplaceného období ještě pustit dovnitř. Kryje Stripe Smart
// Retries u selhané karty, ať nikoho nezamkneme kvůli jednomu neúspěšnému stržení.
const GRACE_DNI = 5;

// Když dorazí `checkout.session.completed`, ale ještě neznáme konec období z faktury,
// dáme prozatímní přístup. `invoice.paid` ho vzápětí přepíše přesným datem.
const PROVIZORNI_DNI = 35;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false },
});

// --- Ověření podpisu Stripu -------------------------------------------------
// ⛔ BEZ TOHOHLE by kdokoli mohl POSTem udělit sám sobě členství zdarma.
// Stripe posílá hlavičku `stripe-signature: t=<ts>,v1=<hex hmac>`, podepisuje se
// řetězec "<ts>.<raw body>" klíčem whsec_. Porovnává se na RAW těle, ne na
// přeparsovaném JSONu (jakákoli reserializace podpis rozbije).
async function overPodpis(raw: string, hlavicka: string): Promise<boolean> {
  if (!STRIPE_WEBHOOK_SECRET || !hlavicka) return false;

  const casti = Object.fromEntries(
    hlavicka.split(",").map((p) => {
      const i = p.indexOf("=");
      return [p.slice(0, i).trim(), p.slice(i + 1).trim()];
    }),
  );
  const ts = casti["t"];
  const v1 = casti["v1"];
  if (!ts || !v1) return false;

  // Ochrana proti přehrání starého požadavku (Stripe doporučuje 5 minut).
  const stariS = Math.abs(Date.now() / 1000 - Number(ts));
  if (!Number.isFinite(stariS) || stariS > 300) return false;

  const klic = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(STRIPE_WEBHOOK_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const podpis = await crypto.subtle.sign(
    "HMAC",
    klic,
    new TextEncoder().encode(`${ts}.${raw}`),
  );
  const ocekavano = [...new Uint8Array(podpis)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // Porovnání v konstantním čase.
  if (ocekavano.length !== v1.length) return false;
  let rozdil = 0;
  for (let i = 0; i < ocekavano.length; i++) {
    rozdil |= ocekavano.charCodeAt(i) ^ v1.charCodeAt(i);
  }
  return rozdil === 0;
}

// Alert adminovi. Vzor 1:1 podle `simpleshop-webhook`, ať se to hlásí na jedno místo.
// ⚠️ Zapisuje do `email_events` (type='error'), NE do vlastní tabulky. Tabulka
// `admin_alerts` v tomhle projektu NEEXISTUJE (ověřeno v information_schema);
// kdyby se do ní psalo, alerty by tiše mizely a nikdo by se o selhaném grantu nedozvěděl.
async function alertAdmin(predmet: string, detail: Record<string, unknown>) {
  try {
    await admin.from("email_events").insert({
      lead_id: null, step: 0, type: "error",
      detail: {
        track: "academy-stripe-webhook",
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
        html: `<p>Stripe webhook měsíčního členství narazil.</p><ul>${rows}</ul>`
          + `<p>Zkontroluj platbu ve Stripu a případně uděl přístup ručně v adminu.</p>`,
      }),
    });
  } catch { /* best-effort */ }
}

// --- Udělení / prodloužení přístupu ----------------------------------------
// Vrací true, když šlo o PRVNÍ udělení (rozhoduje o uvítacím e-mailu).
// `stripe` = vazba na konkrétní platbu. Ukládá se kvůli REFUNDU: bez ní by se
// refund musel párovat podle e-mailu, což je nejednoznačné (Academy i appka jedou
// na jednom Stripe účtu, takže by refund appky mohl sebrat Academy), a bez
// `subscription` by nebylo co zrušit a za měsíc by se strhlo znovu.
async function udelPristup(
  email: string,
  expiraceIso: string,
  stripe?: { customer?: string | null; subscription?: string | null },
  provizorni = false,
): Promise<boolean> {
  const { data: stavajici } = await admin
    .from("entitlements")
    .select("source, active, expires_at")
    .eq("email", email)
    .eq("product", "academy")
    .maybeSingle();

  // ⛔ POJISTKA PROTI DEGRADACI DOŽIVOTNÍHO ČLENSTVÍ.
  // Kdo má doživotní přístup (expires_at IS NULL a jiný zdroj než stripe-monthly),
  // toho měsíční platba NESMÍ přepsat na expirující. Stalo by se to, kdyby si
  // doživotní člen omylem založil ještě předplatné, nebo kdyby dorazily události
  // v jiném pořadí. Přístup necháme být; peníze řeší Martin refundem ve Stripu.
  if (stavajici && stavajici.expires_at === null && stavajici.source !== "stripe-monthly") {
    await alertAdmin("Stripe: platba od člena, který má DOŽIVOTNÍ přístup", {
      email,
      stavajici_zdroj: stavajici.source,
      poznamka: "Přístup nezměněn (nedegradovat na expirující). Zvážit refund předplatného.",
    });
    return false;
  }

  const jePrvni = !stavajici || !stavajici.active;

  // ⛔ PROVIZORNÍ GRANT NESMÍ NIKDY ZKRÁTIT UŽ ZAPSANOU EXPIRACI.
  // `checkout.session.completed` dává jen odhad (35 dní), `invoice.paid` zná přesný
  // konec období. Stripe NEZARUČUJE pořadí doručení, takže když dorazí invoice první,
  // checkout jí přepsal přesnou hodnotu zpátky na odhad. U měsíčního je to den,
  // ⚠️ ALE U ROČNÍHO TARIFU by odhad 35 dní přepsal 370 a člověk by zaplatil rok
  // a přístup by mu vypršel za měsíc. Změřeno 28. 7. 2026 na reálné platbě.
  let expiraceFinal = expiraceIso;
  if (provizorni && stavajici?.expires_at) {
    const stara = new Date(stavajici.expires_at).getTime();
    if (Number.isFinite(stara) && stara > new Date(expiraceIso).getTime()) {
      expiraceFinal = stavajici.expires_at;   // stávající je delší ⇒ nesaháme na ni
    }
  }

  const { error } = await admin.from("entitlements").upsert(
    {
      email,
      product: "academy",
      active: true,
      source: "stripe-monthly",
      granted_at: new Date().toISOString(),
      expires_at: expiraceFinal,
      // ⚠️ Nepřepisovat na null, když událost ID nenese (např. obnova bez customeru).
      // `??` by null zapsalo, proto se pole doplní jen když hodnota opravdu je.
      ...(stripe?.customer ? { stripe_customer_id: stripe.customer } : {}),
      ...(stripe?.subscription ? { stripe_subscription_id: stripe.subscription } : {}),
    },
    { onConflict: "email,product" },
  );
  if (error) throw new Error("db: " + error.message);

  return jePrvni;
}

// --- Uvítací e-mail (jen při prvním udělení) --------------------------------
// Vzor převzatý ze `simpleshop-webhook`, ale s vlastní tratí pro měsíční členy.
// `track` má výchozí hodnotu, takže původní volání `posliUvitani(email)` funguje
// beze změny. Používá se i pro rozlučkový mail po refundu.
async function posliUvitani(
  email: string,
  track: string = WELCOME_TRACK,
  vars?: Record<string, string>,
) {
  const nowIso = new Date().toISOString();

  // Když trať nemá šablonu, drip-send by neposlal nic a nikdo by se to nedozvěděl.
  // Radši to zakřičí, než aby platící člen tiše zůstal bez uvítačky.
  const { data: sablona } = await admin
    .from("email_templates")
    .select("track")
    .eq("track", track)
    .eq("step", 0)
    .maybeSingle();
  if (!sablona) {
    await alertAdmin("Stripe: měsíční člen nedostal uvítací e-mail (chybí šablona)", {
      email,
      track: track,
      poznamka: "Přístup UDĚLEN. Chybí step 0 v email_templates, dopsat text.",
    });
    return;
  }

  // ⛔ `vars` se ukládají i K LEADOVI, ne jen do těla invoku níž. Tělo existuje jednou;
  // když odeslání selže, opakovaný pokus jede z hodinové dávky a bez tohohle by spadl
  // na `unresolved_token` už navždy. Klíčuje se tratí, viz `leads-vars.sql`.
  const varsProLeada = vars ? { [track]: vars } : null;

  const { data: lead } = await admin
    .from("leads").select("id,name").eq("email", email).limit(1);
  if (lead && lead.length) {
    await admin.from("leads").update({
      track: track, step: 0, status: "active",
      next_send_at: nowIso, purchased: true, updated_at: nowIso,
      ...(varsProLeada ? { vars: varsProLeada } : {}),
    }).eq("id", lead[0].id);
  } else {
    await admin.from("leads").insert({
      email, track: track, step: 0, status: "active",
      next_send_at: nowIso, purchased: true, source: "stripe-monthly",
      ...(varsProLeada ? { vars: varsProLeada } : {}),
    });
  }

  const { data: cfg } = await admin
    .from("app_config").select("value").eq("key", "drip_invoke_secret").maybeSingle();
  const dripSecret = cfg?.value ? String(cfg.value) : "";
  if (!dripSecret) return;

  await fetch(SUPABASE_URL + "/functions/v1/drip-send", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-drip-secret": dripSecret },
    // `vars` posíláme jen když nějaké jsou. Uvítačka žádné vlastní proměnné nemá,
    // rozlučka ano a bez nich by se neodeslala (viz komentář u `castkaText`).
    body: JSON.stringify(vars ? { only_email: email, vars } : { only_email: email }),
  }).catch(() => null);
}

function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function zaDni(n: number): string {
  return new Date(Date.now() + n * 86400000).toISOString();
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method" }, 405);

  const raw = await req.text();
  const sig = req.headers.get("stripe-signature") ?? "";
  if (!(await overPodpis(raw, sig))) {
    return json({ error: "bad-signature" }, 400);
  }

  // deno-lint-ignore no-explicit-any
  let ev: any;
  try {
    ev = JSON.parse(raw);
  } catch {
    return json({ error: "bad-json" }, 400);
  }

  const typ = String(ev?.type ?? "");
  const obj = ev?.data?.object ?? {};

  try {
    // --- 1) První zaplacení z Payment Linku -------------------------------
    if (typ === "checkout.session.completed") {
      if (obj.mode !== "subscription") {
        return json({ ok: true, ignorovano: "ne-predplatne" });
      }
      // ⛔ Jen platby z NAŠICH Payment Linků. Session z appky (VIP/Basic) sem taky
      // dorazí, protože účet je společný, a bez tohohle by zakládala Academy zdarma.
      // Tiché ignorování, ne alert: platby za appku jsou v pořádku, jen nejsou naše.
      const plink = typeof obj.payment_link === "string" ? obj.payment_link : "";
      if (!ALLOWED_PLINKS.includes(plink)) {
        return json({ ok: true, ignored: "foreign-price", payment_link: plink || null });
      }
      const email = String(
        obj.customer_details?.email ?? obj.customer_email ?? "",
      ).trim().toLowerCase();
      if (!email) {
        await alertAdmin("Stripe: zaplaceno, ale chybí e-mail", {
          session: obj.id,
          poznamka: "Přístup NEUDĚLEN. V Payment Linku musí být e-mail povinný.",
        });
        return json({ error: "no-email" }, 422);
      }

      // Prozatímní přístup. `invoice.paid` dorazí vzápětí a nahradí ho přesným
      // koncem období. Kdyby nedorazila, člen i tak měsíc dovnitř může.
      // Poslední argument `true` = PROVIZORNÍ. Nesmí zkrátit expiraci, kterou už
      // případně zapsala `invoice.paid` (Stripe pořadí událostí negarantuje).
      const prvni = await udelPristup(email, zaDni(PROVIZORNI_DNI), {
        customer: typeof obj.customer === "string" ? obj.customer : null,
        subscription: typeof obj.subscription === "string" ? obj.subscription : null,
      }, true);
      if (prvni) {
        try { await posliUvitani(email); }
        catch (e) {
          await alertAdmin("Stripe: přístup udělen, ale uvítací e-mail selhal", {
            email, chyba: String(e).slice(0, 200),
          });
        }
      }
      return json({ ok: true, email, prvni });
    }

    // --- 2) Zaplacená faktura: první i každá další obnova ------------------
    if (typ === "invoice.paid" || typ === "invoice.payment_succeeded") {
      // ⛔ Jen faktury za NAŠI cenu nebo náš produkt. Faktura za appkové VIP/Basic
      // sem dorazí taky (společný účet) a bez tohohle by zakládala Academy zdarma.
      const { ceny, produkty } = cenyAProdukty(obj.lines);
      const nase = ceny.some((c) => ALLOWED_PRICES.includes(c)) ||
                   produkty.some((p) => ALLOWED_PRODUCTS.includes(p));
      if (!nase) {
        return json({ ok: true, ignored: "foreign-price", ceny, produkty });
      }

      const email = String(
        obj.customer_email ?? obj.customer_details?.email ?? "",
      ).trim().toLowerCase();
      if (!email) {
        await alertAdmin("Stripe: faktura zaplacena, ale chybí e-mail", {
          invoice: obj.id, poznamka: "Přístup NEPRODLOUŽEN, spárovat ručně.",
        });
        return json({ error: "no-email" }, 422);
      }

      // Konec zaplaceného období + grace.
      // ⚠️ Bereme NEJPOZDĚJŠÍ `period.end` ze VŠECH řádků faktury, ne `data[0]`.
      // Faktura předplatného může nést víc řádků (proporcionální dopočet při změně
      // plánu, sleva, jednorázová položka) a pořadí není zaručené. Kdyby se vzal
      // první řádek a byl to proration za pár dní, členovi by přístup vypršel
      // uprostřed zaplaceného měsíce.
      // Tvar pole ověřen proti Stripe API 2026-06-24.dahlia (lines.data[].period.end
      // v ní pořád existuje). Pozn.: `invoice.subscription` se v novějších verzích
      // přesunul pod `parent.subscription_details.subscription`, my ho nečteme.
      const konceS: number[] = Array.isArray(obj.lines?.data)
        ? obj.lines.data.map((l: { period?: { end?: number } }) => Number(l?.period?.end ?? 0))
            .filter((n: number) => Number.isFinite(n) && n > 0)
        : [];
      const konecS = konceS.length ? Math.max(...konceS) : 0;
      const expirace = konecS > 0
        ? new Date(konecS * 1000 + GRACE_DNI * 86400000).toISOString()
        : zaDni(PROVIZORNI_DNI);
      if (konecS === 0) {
        await alertAdmin("Stripe: faktura bez období, dáno provizorních 35 dní", {
          email: String(obj.customer_email ?? ""), invoice: obj.id,
          poznamka: "Zkontroluj tvar lines.data[].period.end proti verzi API.",
        });
      }

      // ⚠️ `invoice.subscription` v novějších verzích API NEEXISTUJE, přesunulo se pod
      // `parent.subscription_details.subscription` (ověřeno proti 2026-06-24.dahlia).
      // Čteme obě cesty, ať to nespadne při změně verze ani jedním směrem.
      const subId = obj.parent?.subscription_details?.subscription ?? obj.subscription ?? null;
      const prvni = await udelPristup(email, expirace, {
        customer: typeof obj.customer === "string" ? obj.customer : null,
        subscription: typeof subId === "string" ? subId : null,
      });

      // ⛔ ODSUD SE UVÍTAČKA NEPOSÍLÁ NIKDY (oprava 28. 7. 2026).
      // Při prvním nákupu dorazí `checkout.session.completed` i `invoice.paid`
      // pár vteřin po sobě a OBA volaly `posliUvitani`. Ten resetuje leada na step 0
      // a hned kopne do `drip-send`, jenže jeho dedupe je check-then-act, takže druhý
      // invoke stihl projít kontrolou a mail ODEŠEL PODRUHÉ. Teprve jeho zápis spadl
      // na unique a spolkl se. ⚠️ Proto to v `email_events` NENÍ VIDĚT: DB ukazuje
      // jeden 'sent', ale ve schránce byly dva maily (18:02:22 a 18:02:25, ověřeno
      // v Gmailu). Nepřítomnost záznamu není důkaz, že se akce nestala.
      // Věcně to sedí i bez toho závodu: `invoice.paid` je ZAPLACENÁ FAKTURA, tedy
      // i obnova. Uvítačka patří k nákupu, ne k obnově.
      // (Hlubší oprava dedupe v drip-send, tedy insert PŘED odesláním, je samostatný úkol.)
      if (prvni) {
        // Sem se to dostane jen tehdy, když `checkout.session.completed` NEDORAZILA
        // (jinak už řádek existuje a `prvni` je false). Přístup dostal, uvítačku ne,
        // a to se nesmí stát tiše.
        await alertAdmin("Stripe: přístup udělen z faktury BEZ uvítacího e-mailu", {
          email,
          poznamka: "Nedorazila checkout.session.completed. Přístup JE udělen. "
            + "Uvítačku pošli ručně (drip-send only_email) nebo prověř doručování webhooku.",
        });
      }
      return json({ ok: true, email, expirace, prvni });
    }

    // --- 3) Selhaná platba: NIC nezamykáme --------------------------------
    // Grace v `expires_at` pokryje Stripe Smart Retries. Když se karta nakonec
    // nestrhne, přístup vyprší sám. Aktivní revoke by byl křehčí.
    // --- 2b) REFUND a SPOR: odebrat přístup a zastavit další strhávání --------
    // Martin klikne refund tam, kde jsou peníze, a zbytek dodělá tohle.
    // ⛔ Párujeme podle `stripe_customer_id`, NE podle e-mailu. Academy i appka jedou
    //    na jednom Stripe účtu, takže podle e-mailu by refund za appku mohl sebrat
    //    Academy témuž člověku. Cizí platba se sem dostane taky a musí projít bez efektu.
    if (typ === "charge.refunded" || typ === "charge.dispute.created") {
      const jeSpor = typ === "charge.dispute.created";
      // U sporu je v `data.object` Dispute, u refundu Charge. Zákazník je na obou.
      const zakaznik = typeof obj.customer === "string" ? obj.customer : "";
      if (!zakaznik) return json({ ok: true, ignored: "bez-zakaznika" });

      const { data: ent } = await admin
        .from("entitlements")
        .select("email, product, source, expires_at, stripe_subscription_id")
        .eq("stripe_customer_id", zakaznik)
        .eq("product", "academy")
        .maybeSingle();

      // Není náš zákazník (typicky refund předplatného appky). Ticho, žádný alert.
      if (!ent) return json({ ok: true, ignored: "not-ours", zakaznik });

      // ⚠️ ČÁSTEČNÝ REFUND PŘÍSTUP NEODEBÍRÁ. Vrácení 200 Kč z 990 není konec
      // členství a automatika by tu rozhodovala o něčem, co neví. Jen upozorníme.
      const castka = Number(obj.amount ?? 0);
      const vraceno = Number(obj.amount_refunded ?? 0);
      if (!jeSpor && castka > 0 && vraceno > 0 && vraceno < castka) {
        await alertAdmin("Stripe: ČÁSTEČNÝ refund, přístup NECHÁN beze změny", {
          email: ent.email, vraceno_haleru: vraceno, celkem_haleru: castka,
          poznamka: "Rozhodni ručně. Automatika u částečného refundu přístup neodebírá.",
        });
        return json({ ok: true, castecny_refund: true, odebrano: false });
      }

      // 1) zastavit další strhávání
      let zruseno = "nebylo-co";
      if (ent.stripe_subscription_id) {
        if (!STRIPE_SUBS_KEY) {
          zruseno = "CHYBI-KLIC";
        } else {
          try {
            const r = await fetch(
              "https://api.stripe.com/v1/subscriptions/" + encodeURIComponent(ent.stripe_subscription_id),
              { method: "DELETE", headers: { Authorization: "Bearer " + STRIPE_SUBS_KEY } },
            );
            if (r.ok) zruseno = "ok";
            else {
              // ⚠️ UKLÁDÁME I TĚLO ODPOVĚDI, ne jen číslo. 28. 7. 2026 přišlo 404
              // a musel jsem příčinu dedukovat z dokumentace, protože jsme měli
              // jen stavový kód. Stripe v těle posílá `error.code` (např.
              // `resource_missing` = objekt v tomhle režimu klíče neexistuje, typicky
              // test klíč na live objekt) a u málo práv i jmenovitě chybějící scope.
              // Nestačí vědět, ŽE to selhalo. Musí být poznat PROČ.
              const telo = await r.text().catch(() => "");
              zruseno = "http-" + r.status + " " + telo.slice(0, 200);
            }
          } catch (e) { zruseno = "chyba-" + String(e).slice(0, 60); }
        }
      }

      // 2) odebrat přístup (expirace na teď, řádek necháváme kvůli historii)
      // Jeden časový otisk pro zápis do DB i pro text mailu, ať se nemůžou rozejít.
      const konecIso = new Date().toISOString();
      const { error: chybaRevoke } = await admin
        .from("entitlements")
        .update({ expires_at: konecIso })
        .eq("email", ent.email).eq("product", "academy");

      // 3) rozlučkový mail (best-effort, nikdy nesmí shodit odebrání)
      // Po refundu odebíráme přístup ihned, takže vyjde větev „hned". Volba je tu
      // přesto dynamická, ať to sedí i kdyby se sem někdy dostalo zrušení s dojezdem.
      // ⛔ `vars` NENÍ volitelná ozdoba, bez nich mail neodejde. Viz `castkaText`.
      // U sporu je v `obj` Dispute (má `amount`, nemá `amount_refunded`), proto ten fallback.
      try {
        await posliUvitani(ent.email, rozlouceniTrack(konecIso), {
          castka: castkaText(vraceno > 0 ? vraceno : castka, String(obj.currency ?? "czk")),
          produkt: "Barna Academy",
          varianta: "měsíční členství",
          znovu_odkaz: "https://martinbarna.cz/akademie/#cena",
          pristup_do: datumCesky(konecIso),
        });
      } catch { /* best-effort, nikdy nesmí shodit odebrání přístupu */ }

      // 4) hlásit. U sporu a u nezrušeného předplatného VŽDY, jinak by to zůstalo tiché.
      if (jeSpor || zruseno !== "ok" || chybaRevoke) {
        await alertAdmin(
          jeSpor ? "🔴 Stripe: SPOR (chargeback) u Academy, přístup odebrán"
                 : "Stripe: refund Academy, ale předplatné se nezrušilo",
          {
            email: ent.email,
            zruseni_predplatneho: zruseno,
            odebrani_pristupu: chybaRevoke ? "SELHALO: " + chybaRevoke.message : "ok",
            co_delat: zruseno === "CHYBI-KLIC"
              ? "⛔ ZRUŠ PŘEDPLATNÉ RUČNĚ VE STRIPU. Chybí STRIPE_RESTRICTED_SUBS_KEY."
              : (jeSpor ? "Spor lze u banky vyhrát. Když vyhraješ, vrať přístup ručně." : "Zkontroluj ve Stripu."),
          },
        );
      }

      return json({
        ok: true, typ, email: ent.email,
        zruseno_predplatne: zruseno,
        pristup_odebran: !chybaRevoke,
      });
    }

    if (typ === "invoice.payment_failed") {
      const email = String(obj.customer_email ?? "").trim().toLowerCase();
      await alertAdmin("Stripe: selhala platba měsíčního členství", {
        email, invoice: obj.id, poznamka: `Nezamykáme, grace ${GRACE_DNI} dní, pak vyprší samo.`,
      });
      return json({ ok: true, poznamka: "logovano" });
    }

    // --- 4) Zrušení předplatného: taky NIC --------------------------------
    // Zákazník má zaplaceno do konce období, tak ho tam necháme dojet.
    if (typ === "customer.subscription.deleted") {
      return json({ ok: true, poznamka: "expirace dojede sama" });
    }

    return json({ ok: true, ignorovano: typ });
  } catch (e) {
    // Stripe při nenulovém statusu zkusí událost poslat znovu, což je žádoucí.
    await alertAdmin("Stripe webhook: neošetřená chyba", {
      typ, chyba: String(e).slice(0, 300),
    });
    return json({ error: "internal" }, 500);
  }
});
