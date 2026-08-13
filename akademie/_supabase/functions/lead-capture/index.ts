import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...CORS, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ ok: false, error: "method" }, 405);
  try {
    const body = await req.json().catch(() => ({}));
    // Honeypot: pole "website" je skryte, clovek ho nevyplni. Bot ano -> tichy uspech bez zapisu i mailu.
    if (String(body.website || "").trim()) return json({ ok: true });
    const email = String(body.email || "").trim().toLowerCase();
    const name = String(body.name || "").trim().slice(0, 120);
    const segRaw = String(body.segment || "other");
    const segment = ["zeny", "muzi"].includes(segRaw) ? segRaw : "other";
    // Generatorove leady (lite nastroje) -> vlastni track s vlastni uvitackou.
    // Uvitacka se odklada o 24 h: sablona lead-magnet-tool:0 vznika zvlast; kdyby jeste
    // nebyla, drip-send lead bezpecne zaparkuje (zadny spatny PDF mail jako driv).
    const tool = segRaw === "academy-jidelnicek" ? "jidelnicek" : segRaw === "academy-trenink" ? "trenink" : "";
    // /pro-vas capture (B2C ochutnávka Academy) -> vlastní nurture s Academy uvítačkou,
    // ať nedostane food-plan welcome ("Tady máš svůj plán") jako makro-plan leady.
    const source = String(body.source || "lead_magnet").slice(0, 60);
    // [2026-07-14] brána na free lekce videokurzu → nurture-videokurz (uvítačka nv-0 má CTA
    // „Pustit první lekce zdarma", žádný slib PDF plánu). Kalkulačka jde do lead-magnet
    // (slibujeme 7denní jídelníček dle segmentu = přesně to, co lead-magnet doručuje).
    // [2026-07-16] FIX kritické regrese: trenérské leady z /pro-trenery (source 'pro-trenery',
    // segment 'trener') patří do tracku 'trener-kit' (startovací kit mailem + Academy sekvence),
    // ne do konzumního 'lead-magnet' (ten posílá makro-plán a prodává videokurz).
    const goal = String(body.goal || "").slice(0, 200);
    const age = String(body.age || "").slice(0, 30);
    const phone = String(body.phone || "").trim().slice(0, 40);
    // UTM z QR letáku (přes /start passthrough) -> atribuce leadu ke konkrétnímu letáku/zdroji
    const utmSource = String(body.utm_source || "").trim().slice(0, 60);
    const utmMedium = String(body.utm_medium || "").trim().slice(0, 60);
    const utmCampaign = String(body.utm_campaign || "").trim().slice(0, 60);
    // [2026-08-13] ⭐ KVÍZOVÝ PROFIL = VLASTNÍ TRAŤ (`kviz-data`, `kviz-vikend`, `kviz-vecer`, `kviz-pohyb`).
    // Kvíz (/kviz/) roztřídí člověka do profilu a posílá ho sem jako `goal` ve tvaru
    // "kviz profil: vikend". Do 13. 8. skončil každý kvízový lead na sdílené trati
    // `lead-magnet` a zaplacená diagnóza se v mailu nikdy nepoužila.
    // ⛔ PROČ VLASTNÍ TRAŤ A NE TOKEN VE SDÍLENÉ ŠABLONĚ: `drip-send` na konci renderu
    //    kontroluje nerozřešené tokeny a vyhazuje `unresolved_token`. Kdyby
    //    `{{kviz_profil}}` přišel do sdílené `lead-magnet`/0, přestal by chodit uvítací
    //    mail VŠEM nekvízovým leadům a nikde by to nekřiklo (jen `error`, po 5 pokusech
    //    `paused`). Šablony `kviz-*`/0 proto žádný nový token nemají, profilový odstavec
    //    je v nich napevno.
    // ⛔ WHITELIST, NE HOLÝ PREFIX. `goal` je vstup ze stránky. Kdyby sem přišla jiná
    //    hodnota, vznikla by trať bez šablony a člověk by NEDOSTAL NIC (drip-send na
    //    chybějící šabloně jen zhasne termín). Neznámý profil proto padá zpátky na
    //    `lead-magnet`, tedy na dnešní fungující cestu. Fail-safe míří k doručení.
    // ⚠️ Rozhoduje PREFIX v `goal`, ne `source`: kdyby kvíz jednou změnil `source`,
    //    mechanismus jede dál. Jiný formulář tenhle prefix neposílá.
    // ⚠️ Kvízová trať má JEN krok 0. Zpátky do `lead-magnet` na KROK 1 (ne 0, to by byl
    //    tentýž mail podruhé) přesouvá DB funkce `presun_kvizove_na_lead_magnet`, kterou
    //    volá pg_cron `kviz-presun-10min`. Most (`app_config.navazujici_trate`) se použít
    //    NEDÁ: ten cílový krok vždycky nastaví na 0.
    const KVIZ_PREFIX = "kviz profil: ";
    const KVIZ_PROFILY = ["data", "vikend", "vecer", "pohyb"];
    const kvizProfil = goal.startsWith(KVIZ_PREFIX) ? goal.slice(KVIZ_PREFIX.length).trim().slice(0, 30) : "";
    const kvizTrat = KVIZ_PROFILY.includes(kvizProfil) ? "kviz-" + kvizProfil : "";
    // [2026-07-30] ⭐ REKLAMNÍ PROVOZ NA MAGNETY JDE DO SÉRIE B (`tc-magnet`), ne do `lead-magnet`.
    // Pozná se podle kampaně v adrese landing page, kterou `lead-form.js` posílá dál.
    // ⛔ Rozhoduje se podle utm_CAMPAIGN, ne podle utm_source: až přibude jiný kanál než Meta,
    //    nesmí to přestat fungovat.
    // ⚠️ POŘADÍ TÉHLE PODMÍNKY JE PODSTATNÉ: musí být ZA speciálními zdroji a PŘED defaultem.
    //    Kdyby byla první, reklama by přebila trenérský kit i generátorové leady a poslala by
    //    lidem trať, která slibuje něco jiného, než na co klikli.
    // ⚠️ `segment` a `source` se NEMĚNÍ. Na segmentu visí, které PDF drip pošle
    //    (`{{lead_magnet_url}}` plní `drip-send` podle `leads.segment`), a `tc-magnet` step 0
    //    tu proměnnou používá stejně jako `lead-magnet` step 0. Kdo to začne přepisovat,
    //    pošle muži ženský jídelníček.
    const jeReklamaMagnet = utmCampaign.toLowerCase() === "tc-leadgen";
    const track = source === "videokurz-free" ? "nurture-videokurz"
      : (source === "pro-trenery" || segRaw === "trener") ? "trener-kit"
      : tool ? "lead-magnet-tool"
      : segRaw === "academy-pro-vas" ? "nurture-pro-vas"
      : jeReklamaMagnet ? "tc-magnet"
      // ⚠️ Kvíz je ZÁMĚRNĚ až za reklamní podmínkou, ne před ní: je to zúžení dnešního
      //    výchozího `lead-magnet` (tam dosud padalo všech 130 kvízových leadů), ne nové
      //    přebíjení kanálů. Kdyby stál výš, přebral by provoz z `tc-leadgen` kampaní.
      : kvizTrat ? kvizTrat
      : "lead-magnet";
    // utm_content = varianta kreativy (A/B test reklam) -> bez nej nejde z DB merit, ktera reklama lead privedla
    const utmContent = String(body.utm_content || "").trim().slice(0, 60);
    // utm_term = klicove slovo z Google search ({keyword}) -> bez nej nejde rict, ktery dotaz lead privedl
    const utmTerm = String(body.utm_term || "").trim().slice(0, 60);
    // utm_id = id kampane z platformy ({{campaign.id}} / {campaignid}) -> tvrdy join na naklady,
    // nezavisly na tom, jestli nekdo mezitim kampan v UI prejmenoval
    const utmId = String(body.utm_id || "").trim().slice(0, 60);
    // Google gclid/gbraid/wbraid — CELY (max 200 zn., NEdorezavat na 60!), jinak se v offline importu konverzi do Google Ads nespáruje
    const gclid = String(body.gclid || "").trim().slice(0, 200);
    // Meta click id (fbclid) — stejny duvod jako gclid u Google Ads
    const fbclid = String(body.fbclid || "").trim().slice(0, 200);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ ok: false, error: "invalid_email" }, 400);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const supa = createClient(
      SUPABASE_URL,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );
    const meta: Record<string, unknown> = { goal, age };
    if (tool) meta.tool = tool;
    if (utmSource) meta.utm_source = utmSource;
    if (utmMedium) meta.utm_medium = utmMedium;
    if (utmCampaign) meta.utm_campaign = utmCampaign;
    if (utmContent) meta.utm_content = utmContent;
    if (utmTerm) meta.utm_term = utmTerm;
    if (utmId) meta.utm_id = utmId;
    if (gclid) meta.gclid = gclid;
    if (fbclid) meta.fbclid = fbclid;
    const { error } = await supa.from("leads").insert({
      email, name, segment, source, phone,   // phone -> vlastni sloupec (Cowork migrace add_phone_to_leads)
      track,
      meta,
      // `meta.goal` zůstává zdrojem pravdy o profilu, `vars` je jeho podoba pro engine.
      // ⛔ Klíč MUSÍ být zanořený pod názvem tratě (u kvízu tedy `kviz-vikend`): `drip-send`
      //    čte výhradně `vars[track]` (viz `varsZLeada`), plochý `vars.kviz_profil` by byl
      //    mrtvá páka. Dnes ho žádná šablona nepoužívá (odstavec je v `kviz-*`/0 napevno),
      //    je to záloha pro případ, že by ho někdy nějaký krok kvízové tratě potřeboval.
      ...(kvizProfil ? { vars: { [track]: { kviz_profil: kvizProfil } } } : {}),
      next_send_at: new Date(Date.now() + (tool ? 24 * 3600000 : 0)).toISOString(),
    });
    // 23505 = unique violation (e-mail uz je v seznamu) -> bereme jako uspech (idempotentni)
    const duplicate = !!(error && error.code === "23505");
    if (error && !duplicate) {
      console.error("lead-capture insert error", error);
      return json({ ok: false, error: "db" }, 500);
    }
    // u duplicitniho e-mailu doplnime telefon, jen kdyz v existujicim leadu chybi (neprepisujeme)
    if (duplicate && phone) {
      await supa.from("leads").update({ phone }).eq("email", email).is("phone", null);
    }

    // OKAMZITE uvitaci mail: spust drip-send JEN pro tenhle novy lead, ale NIKDY neblokuj odpoved.
    // (Driv bezel 'await' -> nova registrace cekala na drip-send/Resend a formular "zatuhl",
    //  zatimco existujici e-mail tenhle blok preskocil a odpovedel hned. Ted cely drip trigger
    //  vcetne cteni secretu bezi na POZADI pres EdgeRuntime.waitUntil; kdyz neni k dispozici,
    //  fire-and-forget. Fallback: hodinovy cron stejne projede leady s next_send_at=now().)
    if (!duplicate && !tool) {   // tool leady nemaji okamzitou uvitacku (odlozena o 24 h)
      const drip = (async () => {
        try {
          const { data: cfg } = await supa.from("app_config").select("value").eq("key", "drip_invoke_secret").maybeSingle();
          const secret = cfg?.value;
          if (!secret) return;
          await fetch(SUPABASE_URL + "/functions/v1/drip-send", {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-drip-secret": secret },
            body: JSON.stringify({ only_email: email }),   // jen tenhle novy lead -> bez duplicit pri navalu
          });
        } catch (e) { console.error("drip trigger error", e); }
      })();
      // @ts-ignore EdgeRuntime background task (dobehne i po odeslani odpovedi, neblokuje klienta)
      if (typeof EdgeRuntime !== "undefined" && EdgeRuntime.waitUntil) EdgeRuntime.waitUntil(drip);
    }

    return json({ ok: true, duplicate });
  } catch (e) {
    console.error("lead-capture exception", e);
    return json({ ok: false, error: "server" }, 500);
  }
});
