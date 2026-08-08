// Barna Academy — daily-digest: ranni prehled Martinovi e-mailem.
// Vola pg_cron (07:30 Prahy) pres net.http_post s hlavickou x-drip-secret
// (stejne tajemstvi jako drip-send: app_config drip_invoke_secret).
// Shrnuje VCEREJSEK + aktualni stav: leadi, maily, prodeje (simpleshop),
// fronta, odstoupeni, affiliate, chyby. Cisla pocita kod, zadne odhady.
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_KEY = Deno.env.get("RESEND_API_KEY") ?? "";

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method" }, 405);
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

  const { data: cfg } = await admin.from("app_config").select("key,value").in("key", ["drip_invoke_secret", "admin_emails", "followups_enabled", "followups_breaker_reason", "drip_daily_cap", "academy_founders_offset", "clenske_track_prefixy"]);
  const cmap = Object.fromEntries((cfg ?? []).map((r: { key: string; value: string }) => [r.key, r.value]));
  const provided = req.headers.get("x-drip-secret") || "";
  if (!cmap.drip_invoke_secret || provided !== cmap.drip_invoke_secret) return json({ error: "unauthorized" }, 401);
  const to = String(cmap.admin_emails || "fitness.barna@gmail.com").split(",")[0].trim();
  // strop fronty z app_config (autotune cron ho zvedne po dojeti backlogu).
  // POZOR: driv tu stalo "Resend limit 100/den je pevny" — to platilo pro free tarif.
  // Od prechodu na placeny Resend denni limit NENI (potvrdil Martin 20. 7. 2026).
  const cap = Math.max(1, Number(cmap.drip_daily_cap ?? "") || 60);

  const now = new Date();
  const dayStart = new Date(now); dayStart.setUTCHours(0, 0, 0, 0);
  const yStart = new Date(dayStart.getTime() - 86400000);
  const d7 = new Date(now.getTime() - 7 * 86400000).toISOString();

  const [leadsY, leads7, evY, due, entsY, wdr, refs, acadSold] = await Promise.all([
    admin.from("leads").select("source").gte("created_at", yStart.toISOString()).lt("created_at", dayStart.toISOString()),
    admin.from("leads").select("created_at").gte("created_at", d7),
    admin.from("email_events").select("type,detail").gte("created_at", yStart.toISOString()).lt("created_at", dayStart.toISOString()),
    admin.from("leads").select("id").eq("status", "active").not("next_send_at", "is", null).lte("next_send_at", now.toISOString()),
    // Vcerejsi realne prodeje. `stripe-lifetime` = dozivotni Academy pres Stripe
    // (od 29. 7. 2026 nahrazuje SimpleShop), musi se pocitat stejne jako `simpleshop`.
    // ⛔ ROZŠÍŘENO 6. 8. 2026: seznam znal jen Academy, takže prodej videokurzu,
    //    konzultace a balíčku se do řádku „Prodeje" NEZAPOČÍTAL. Den, kdy balíček
    //    koupilo deset lidí, vypadal v přehledu stejně jako den bez prodeje, takže
    //    Martin neměl z čeho poznat ani úspěch, ani výpadek doručení.
    //    ⚠️ Nezaměňovat s počítadlem zakládajících členů níž (ř. ~64): tam je užší
    //    filtr ZÁMĚRNÝ, do padesátky se kupci ostatních produktů počítat nesmí.
    //    ⛔ ROZŠÍŘENO ZNOVU 7. 8. 2026 o `stripe-videokurz-upgrade` (upgrade z balíčku
    //    na videokurz za 450 Kč). Tenhle seznam je natvrdo, takže KAŽDÝ nový `source`
    //    v `academy-stripe-webhook` se sem musí doplnit ručně. Kdo na to zapomene,
    //    vyrobí přesně tutéž tichou vadu jako 6. 8.: peníze přijdou, přehled mlčí.
    admin.from("entitlements").select("product").eq("active", true).in("source", ["simpleshop", "stripe-lifetime", "stripe-videokurz", "stripe-videokurz-upgrade", "stripe-konzultace", "stripe-balicek"]).gte("granted_at", yStart.toISOString()),
    admin.from("withdrawals").select("status"),
    admin.from("referrals").select("status"),
    // ⛔ OPRAVA 28. 7. 2026: bylo tu `select("id")`, jenze `entitlements` sloupec `id`
    // NEMA (PK je email+product). Dotaz tise selhal, `count` vyslo null a radek nize
    // ho prebil nulou -> pocitadlo zakladajicich hlasilo jen rucni offset. Nebylo to
    // videt, protoze skutecny pocet byl taky 0. Tataz chyba byla 27. 7. opravena
    // v admin-api, tady se prehledla. Detail: pamet `feedback-select-neexistujiciho-sloupce`.
    // ⚠️ Filtr na zdroj je ZAMERNY a musi zustat: do padesatky zakladajicich se pocitaji
    // jen DOZIVOTNI prodeje, ne mesicni clenstvi (source='stripe-monthly').
    // ⛔ ROZSIRENO 29. 7. 2026 o 'stripe-lifetime'. Dozivotni varianta se toho dne
    // presunula ze SimpleShopu na Stripe; kdyby tu zustal jen 'simpleshop', pocitadlo
    // by od te chvile TISE STALO na miste a Martin by podle nej nikdy nezdrazil,
    // prestoze verejne slibil cenu 8 900 jen pro prvnich 50 lidi. Nic by nespadlo.
    // ⚠️ Kdo sem prida dalsi zdroj dozivotniho prodeje, musi ho pridat i v `admin-pulse`
    // (30denni prodeje) — jsou to DVE ruzna mista a nic je nedrzi v synci.
    // ⛔ A MUSÍ SE POČÍTAT JEN TEN, KOMU PŘÍSTUP OPRAVDU PLATÍ.
    // Refund nastavuje `expires_at` do minulosti, ale `active` nechává na true (řádek se
    // schválně drží kvůli historii). Bez podmínky na expiraci by se tedy vrácené nákupy
    // počítaly dál a Martin by zdražil na 12 900 dřív, než má 50 skutečných zakládajících.
    // Změřeno 29. 7. 2026 na testovacím nákupu: počítadlo hlásilo 1, správně mělo 0.
    // ⚠️ Táž slepota vůči expiraci byla 28. 7. opravena v `drip-send` (seznam kupců).
    // Tady se přehlédla, protože to je JINÝ dotaz v JINÉ funkci. NULL = doživotní, platí vždy.
    admin.from("entitlements").select("email", { count: "exact", head: true }).eq("product", "academy").eq("active", true).in("source", ["simpleshop", "stripe-lifetime"]).or("expires_at.is.null,expires_at.gt." + new Date().toISOString()),
  ]);

  // zakladajici clenove: realne prodeje pres SimpleShop + rucni offset (app_config
  // academy_founders_offset — prodeje grantnute rucne, testovaci ucty se nepocitaji);
  // verejny slib: cena 8 900 plati pro prvnich 50, pak zdrazit
  const founders = (acadSold.count ?? 0) + (Number(cmap.academy_founders_offset ?? "") || 0);
  const foundersLeft = Math.max(0, 50 - founders);

  const bySrc: Record<string, number> = {};
  for (const l of leadsY.data ?? []) bySrc[String(l.source ?? "?")] = (bySrc[String(l.source ?? "?")] ?? 0) + 1;
  const leadsYc = (leadsY.data ?? []).length;

  let sent = 0, errs = 0, lastErr = "";
  // Od 20. 7. 2026 umi drip-send po MAX_TRIES neuspesich leada odstavit (udalost 'gave_up',
  // status='paused'). U follow-upu je to spravne, mrtva adresa prestane vyrabet chyby.
  // U ONBOARDINGU je to ale vazne: clovek zaplatil a nedostal pristup. Tise se to stat nesmi,
  // proto se to tady pocita zvlast a vyskakuje jako alert.
  let gaveUp = 0, gaveUpOnboarding = 0;
  const gaveUpTracks = new Set<string>();
  const CLENSKE_PREFIXY = String(cmap.clenske_track_prefixy ?? "")
    .split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (CLENSKE_PREFIXY.length === 0) CLENSKE_PREFIXY.push("onboarding", "milestone", "reactivation", "rescue");
  for (const e of evY.data ?? []) {
    if (e.type === "sent") sent++;
    else if (e.type === "error") { errs++; lastErr = String((e.detail as Record<string, unknown>)?.error ?? "").slice(0, 120); }
    else if (e.type === "gave_up" || e.type === "gave_up_warn") {
      const tr = String((e.detail as Record<string, unknown>)?.track ?? "?");
      // 'gave_up' = follow-up, uz se neposila. 'gave_up_warn' = clensky track, zkousi se DAL,
      // ale opakovane to selhava a nekdo za to zaplatil. Druhe je vaznejsi.
      // Zdroj pravdy je app_config.clenske_track_prefixy, stejny radek cte i drip-send.
      // Driv tu byl seznam natvrdo podruhe a drzel ho jen komentar "drz to shodne".
      if (CLENSKE_PREFIXY.some((p) => tr.startsWith(p))) gaveUpOnboarding++;
      else { gaveUp++; gaveUpTracks.add(tr); }
    }
  }

  const salesY: Record<string, number> = {};
  for (const s of entsY.data ?? []) salesY[String(s.product)] = (salesY[String(s.product)] ?? 0) + 1;
  const salesYc = (entsY.data ?? []).length;

  let wdrPending = 0;
  for (const w of wdr.data ?? []) if (w.status === "pending") wdrPending++;
  let refPending = 0;
  for (const r of refs.data ?? []) if (r.status === "pending") refPending++;

  const trend: Record<string, number> = {};
  for (const l of leads7.data ?? []) { const d = String(l.created_at).slice(5, 10); trend[d] = (trend[d] ?? 0) + 1; }
  const trendStr = Object.keys(trend).sort().map((k) => k.split("-").reverse().join(".") + ". <b>" + trend[k] + "</b>").join(" &nbsp;·&nbsp; ");

  // ===== Hlidac konverznich kanalu (21. 7. 2026) =====
  // Vznikl po 13dennim TICHEM vypadku kontaktniho formulare: contact-send po nasazeni 8. 7.
  // povoloval v CORS jen content-type, stranky posilaji i apikey+authorization, prohlizec
  // kazde odeslani zablokoval jeste u navstevnika a na serveru nezustala zadna stopa.
  // Server-side test tohle NIKDY neodhali, proto se denne ptame PRESNE jako prohlizec.
  // Klic = funkce, hodnota = hlavicky, ktere JEJI stranky realne posilaji (overeno v kodu
  // 21. 7.: index.html + landing pages posilaji apikey+authorization, check-in taky,
  // ai-martin.js posila jen authorization). Kdyz se zmeni fetch na strance, zmen i tohle.
  const BROWSER_FNS: Record<string, string[]> = {
    "contact-send": ["authorization", "apikey", "content-type"],
    "lead-capture": ["authorization", "apikey", "content-type"],
    "checkin-capture": ["authorization", "apikey", "content-type"],
    "ai-martin": ["authorization", "content-type"],
  };
  const corsBad: string[] = [];
  await Promise.all(Object.keys(BROWSER_FNS).map(async (slug) => {
    const needed = BROWSER_FNS[slug];
    try {
      const r = await fetch(`${SUPABASE_URL}/functions/v1/${slug}`, {
        method: "OPTIONS",
        headers: {
          "Origin": "https://martinbarna.cz",
          "Access-Control-Request-Method": "POST",
          "Access-Control-Request-Headers": needed.join(", "),
        },
      });
      const allow = (r.headers.get("access-control-allow-headers") || "").toLowerCase();
      const ok = allow.includes("*") || needed.every((h) => allow.includes(h));
      if (!r.ok || !ok) corsBad.push(`${slug} (povoluje: ${allow || "nic"})`);
    } catch (_e) { corsBad.push(slug + " (nedostupná)"); }
  }));
  // ===== KANÁREK zápisové cesty kontaktního formuláře (5. 8. 2026) =====
  // PROČ: detektor ticha níž hlásil „formulář nemá 14 dní ani jeden záznam, možná je
  // rozbitá cesta zápisu". Prověřeno naostro: cesta FUNGOVALA, jen nikdo nepsal.
  // Off-site boti se totiž ZÁMĚRNĚ nelogují (contact-send je zahazuje podle Origin),
  // takže úplné ticho je u malého webu normální stav, ne porucha.
  // Ten alert tedy strašil kvůli něčemu, co nešlo z ticha poznat. Místo hádání se
  // teď každý den zkusí NAPSAT a ověří se, že řádek vznikl.
  //
  // ⛔ DVĚ NEZÁVISLÉ POJISTKY, aby kanárek NIKDY neposlal Martinovi mail:
  //   1) honeypot `website` je vyplněný
  //   2) `t` = 0, tedy odesláno pod 3 vteřiny
  // Stačí jedna z nich, aby contact-send vyhodnotil submisi jako spam a mail neodeslal.
  // Kdyby někdo v budoucnu jednu kontrolu zrušil, druhá pořád drží.
  const KANAREK_JMENO = "KANAREK-DIGEST";
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? SERVICE_ROLE;
  let kanarekOk = false;
  let kanarekChyba = "";
  try {
    const r = await fetch(`${SUPABASE_URL}/functions/v1/contact-send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Origin musí být v ALLOWED_ORIGINS, jinak contact-send submisi tiše zahodí
        // a NEZALOGUJE. Kanárek by pak "selhal", i kdyby cesta fungovala.
        "Origin": "https://martinbarna.cz",
        // Stránky posílají obojí, posíláme to samé, ať testujeme tutéž cestu.
        "apikey": ANON_KEY,
        "Authorization": "Bearer " + ANON_KEY,
      },
      body: JSON.stringify({
        name: KANAREK_JMENO,
        email: "kanarek@martinbarna.cz",
        message: "Automatická denní kontrola zápisové cesty. Záznam se hned maže.",
        website: "kanarek",
        t: 0,
      }),
    });
    if (!r.ok) throw new Error("contact-send vrátil HTTP " + r.status);
    // Odpověď nestačí: contact-send vrací ok:true i na spam a log je best-effort.
    // Důkazem je až řádek v tabulce, proto se ptáme databáze.
    const { data: stopa, error: chybaCteni } = await admin.from("contact_messages")
      .select("id")
      .eq("name", KANAREK_JMENO)
      .gte("created_at", new Date(Date.now() - 5 * 60000).toISOString())
      .limit(1);
    if (chybaCteni) throw new Error("čtení stopy selhalo: " + chybaCteni.message);
    kanarekOk = !!(stopa && stopa.length);
    if (!kanarekOk) kanarekChyba = "POST prošel, ale řádek v contact_messages nevznikl";
  } catch (e) {
    kanarekChyba = String(e).slice(0, 160);
  }
  // Úklid VŽDY, i když ověření selhalo. Bere všechny kanárkové řádky, takže po sobě
  // uklidí i případné pozůstatky z dřívějších neúspěšných běhů a tabulka nezarůstá.
  try { await admin.from("contact_messages").delete().eq("name", KANAREK_JMENO); } catch { /* úklid nesmí shodit digest */ }

  // Detektor ticha: kdyz kanal dlouho nema ANI spamovy zaznam, je podezrely cely retez
  // (formular pise do contact_messages i spam, leady chodi z reklam denne).
  // ⚠️ Kanárkové řádky se z tohohle dotazu VYLUČUJÍ. Kdyby se sem započítaly, ukazoval by
  // detektor napořád „0 dní" a skutečné ticho by zamaskoval. Vyloučení je druhá pojistka
  // vedle mazání: kdyby úklid někdy selhal, statistika zůstane pravdivá.
  const [lastContact, lastLead] = await Promise.all([
    admin.from("contact_messages").select("created_at").neq("name", KANAREK_JMENO).order("created_at", { ascending: false }).limit(1),
    admin.from("leads").select("created_at").order("created_at", { ascending: false }).limit(1),
  ]);
  const daysSince = (v: unknown) => v ? Math.floor((now.getTime() - new Date(String(v)).getTime()) / 86400000) : 9999;
  const dContact = daysSince(lastContact.data?.[0]?.created_at);
  const dLead = daysSince(lastLead.data?.[0]?.created_at);

  const dY = yStart.toLocaleDateString("cs-CZ", { timeZone: "Europe/Prague", day: "numeric", month: "long" });
  const row = (label: string, val: string) => `<tr><td style="padding:7px 12px;color:#666">${label}</td><td style="padding:7px 12px;font-weight:700;text-align:right">${val}</td></tr>`;
  const warn = (t: string) => `<p style="margin:10px 0;padding:10px 14px;background:#fdecea;border-radius:10px;color:#a3352b"><b>⚠️ ${t}</b></p>`;
  // Neutrální sdělení. Schválně NENÍ červené a NENÍ v něm vykřičník: je to informace,
  // na kterou se nic nedělá. Kdyby vypadala jako alert, Martin by časem přestal číst obojí.
  const info = (t: string) => `<p style="margin:10px 0;padding:10px 14px;background:#f2f4f7;border-radius:10px;color:#555">${t}</p>`;

  let alerts = "";
  if (corsBad.length > 0) {
    alerts += warn("🔴 FORMULÁŘOVÁ CESTA MŮŽE BÝT ROZBITÁ (CORS): " + corsBad.join(", ") +
      ". Prohlížeč návštěvníka pak odeslání zablokuje bez stopy na serveru. Stejná chyba v červenci " +
      "13 dní tiše blokovala kontaktní formulář. Řekni Claudovi, ať to hned opraví a otestuje z prohlížeče.");
  }
  // ⛔ ZMĚNA 5. 8. 2026: „dlouho ani jeden záznam" UŽ NENÍ VAROVÁNÍ.
  // Původní alert tvrdil, že je možná rozbitá cesta zápisu, ale z ticha se to poznat NEDÁ:
  // off-site boti se záměrně nelogují, takže u malého webu je úplné ticho normální stav.
  // Prověřeno naostro (Fable, 5. 8.): cesta fungovala, jen nikdo nepsal. Alert tedy jen strašil.
  // O rozbité cestě nově rozhoduje JEDINĚ kanárek výš, který se o zápis reálně pokusí.
  if (!kanarekOk) {
    alerts += warn("🔴 ZÁPISOVÁ CESTA KONTAKTNÍHO FORMULÁŘE NEFUNGUJE. Denní kanárek zkusil poslat " +
      "testovací zprávu z martinbarna.cz a záznam v databázi nevznikl. Co selhalo: " +
      (kanarekChyba || "neuvedeno") + ". Prakticky to znamená, že když ti teď někdo napíše přes " +
      "formulář, zpráva se ztratí a nikde po ní nezůstane stopa. Řekni Claudovi, ať to hned prověří.");
  } else if (dContact >= 10 && dContact < 9999) {
    alerts += info("Kontaktním formulářem ti " + dContact + " dní nikdo nenapsal. Zápisová cesta je " +
      "dnes ověřená kanárkem, takže je to opravdu tichý provoz, ne porucha.");
  }
  if (dLead >= 3 && dLead < 9999) {
    alerts += warn("Sběr leadů nemá už " + dLead + " dní žádný nový kontakt. Při běžících reklamách " +
      "to znamená rozbitý sběr (lead-capture) nebo vypnuté kampaně. Zkontrolovat.");
  }
  if (wdrPending > 0) alerts += warn(wdrPending + "× odstoupení od smlouvy čeká na vyřízení (refundace do 14 dnů!)");
  if (errs > 0) alerts += warn(errs + "× chyba odesílání e-mailů včera" + (lastErr ? ": " + lastErr : ""));
  // Sepnuty jistic byl driv jen radek v tabulce nize, ktery vypada kazdy den stejne a lisi se
  // jedinym slovem. Pri zavrene brane mlci vsechny follow-up sekvence (cca 355 lidi) a nic
  // to nehlasi. Proto to od 20. 7. 2026 patri mezi alerty, ne do tabulky.
  if (cmap.followups_enabled !== "true") {
    alerts += warn("FOLLOW-UPY JSOU VYPNUTÉ. Jistič sepnul a všechny navazující sekvence mlčí. " +
      "Důvod: " + (cmap.followups_breaker_reason || "neuveden") + ". " +
      "Brána se otevře sama po 3 hodinách bez další chyby. Když spěcháš, jde přepnout ručně v app_config.");
  }
  if (gaveUpOnboarding > 0) {
    alerts += warn("🔴 " + gaveUpOnboarding + "× KOUPIL, ALE UVÍTACÍ E-MAIL MU OPAKOVANĚ NEDORAZIL. " +
      "Systém to zkouší dál každých 6 hodin a nevzdá to, ale ozvi se jim radši sám. " +
      "Nejspíš mají překlep v adrese. Najdeš je v e-mailových událostech pod typem 'gave_up_warn'.");
  }
  if (gaveUp > 0) {
    alerts += warn(gaveUp + "× odstavený kontakt po opakovaném selhání (" +
      Array.from(gaveUpTracks).join(", ") + "). U follow-upů je to v pořádku, jen ať o tom víš.");
  }
  if (founders >= 45) alerts += warn("Blíží se 50. zakládající člen Academy (" + founders + "/50). Podle slibu na webu pak cena roste na 12 900 Kč. Připrav zdražení (objednávka + akademie + JSON-LD).");

  // --- Zaplatil Academy a nedostal uvítačku? -------------------------------
  // ⛔ Přibylo 29. 7. 2026 NÁHRADOU za alert, který posílal `academy-stripe-webhook`
  // přímo z faktury a LHAL. Stál na úvaze „když je to první udělení, checkout nedorazil",
  // jenže Stripe pořadí událostí NEGARANTUJE a faktura občas dorazí o pár vteřin dřív.
  // Alert pak vyskočil, přestože uvítačka hned nato odešla.
  // ⇒ Závod nejde rozhodnout v okamžiku události. S odstupem ale ano: když uvítačka
  // odešla, `drip-send` posunul leada z kroku 0 dál. Kdo po dvou hodinách pořád visí
  // na nule, ten ji nedostal — a je jedno, jestli selhalo odeslání, nebo se `drip-send`
  // vůbec nezavolal. Tahle kontrola chytí OBA případy, na rozdíl od té původní.
  try {
    // ⛔ ROZŠÍŘENO 6. 8. 2026 z `onboarding-nakup-academy%` na `onboarding-nakup-%`.
    //    Pojistka vypadala, že hlídá, ale byla mrtvá pro TŘI ze čtyř produktů:
    //    videokurz, konzultaci i balíček. Zaplacený nákup, který uvízne na kroku 0
    //    bez chybové události, se nikde neobjevil a Martin se to dozvěděl z reklamace.
    //    Je to týž vzorec „nová cesta, staré pravidlo": při každém dalším produktu
    //    zkontroluj, jestli ho existující pojistky vidí, ne jestli existují.
    const { data: bezUvitacky } = await admin.from("leads")
      .select("email,track")
      .like("track", "onboarding-nakup-%")
      .eq("step", 0).eq("status", "active")
      .lt("updated_at", new Date(Date.now() - 2 * 3600000).toISOString())
      .limit(20);
    if (bezUvitacky && bezUvitacky.length) {
      alerts += warn(`${bezUvitacky.length}× zaplacený nákup BEZ uvítacího e-mailu (`
        + bezUvitacky.slice(0, 5).map((l: { email: string; track: string }) => l.email + " / " + l.track).join(", ")
        + `). Přístup mají, mail ne. Pošli ho ručně přes drip-send only_email a zjisti proč.`);
    }
  } catch { /* best-effort: doplňková kontrola nesmí shodit celý digest */ }

  // --- Denní kontrola odkazů (pojistka po incidentu s mrtvými odkazy 22. až 27. 7.) ---
  // ⚠️ „Žádný běh" NENÍ „všechno v pořádku". Když kontrola neproběhla, je to samo o sobě
  // poplach: přesně takhle se tehdy pět dní nevědělo, že odkazy nefungují.
  let odkazyRadek = "kontrola zatím neproběhla";
  try {
    const { data: lc } = await admin.rpc("link_check_souhrn");
    const s = Array.isArray(lc) ? lc[0] : lc;
    if (!s || !s.posledni_beh) {
      alerts += warn("Kontrola odkazů NIKDY neproběhla. Buď se nespustil cron link-check-daily, nebo padá. Zkontroluj to, tohle je pojistka proti mrtvým odkazům v mailech.");
    } else {
      const stari = (Date.now() - new Date(s.posledni_beh).getTime()) / 3600000;
      odkazyRadek = `${s.celkem} zkontrolováno · ${s.chyb} nefunguje`;
      if (s.chyb > 0) {
        alerts += warn(`ROZBITÉ ODKAZY: ${s.chyb} z ${s.celkem} nefunguje. ${String(s.prvni_chyby ?? "").split("\n").slice(0, 5).join(" · ")}`);
      }
      if (stari > 30) {
        alerts += warn(`Kontrola odkazů je stará ${Math.round(stari)} h, měla by běžet denně. Nejede cron link-check-daily?`);
        odkazyRadek += ` · ⚠️ stará ${Math.round(stari)} h`;
      }
    }
  } catch (e) {
    alerts += warn("Kontrola odkazů se nedá přečíst: " + String(e).slice(0, 120));
  }

  const html =
    `<div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;font-size:15px;line-height:1.5;color:#222;max-width:560px;margin:0 auto">` +
    `<h2 style="margin:0 0 4px">🌅 Ranní přehled</h2>` +
    `<p style="margin:0 0 14px;color:#888">za ${dY}</p>` + alerts +
    `<table style="width:100%;border-collapse:collapse;background:#fafafa;border-radius:12px;overflow:hidden">` +
    row("Nové leady", String(leadsYc) + (leadsYc ? " (" + Object.entries(bySrc).map(([k, v]) => k + " " + v).join(", ") + ")" : "")) +
    // Label „SimpleShop" byl relikt (SimpleShop zrušen 29. 7. 2026, prodeje jdou
    // ze Stripe) a 8. 8. zmátl Martina, který kvůli němu řešil, jestli SimpleShop
    // pořád žije. Počítadlo bylo správně, lhal jen nápis.
    row("Prodeje (Stripe)", String(salesYc) + (salesYc ? " (" + Object.entries(salesY).map(([k, v]) => k + " " + v).join(", ") + ")" : "")) +
    // "Resend max 100/den" bylo z free tarifu a od prechodu na placeny uz to neplatilo.
    // Zavadejici udaj: 30. 6. 2026 prave tenhle denni limit vyrobil 307 chyb.
    row("Odeslané e-maily", String(sent) + " · strop fronty " + cap + " · Resend bez denního limitu") +
    row("Fronta e-mailů teď", String((due.data ?? []).length)) +
    row("Follow-upy", cmap.followups_enabled === "true" ? "zapnuté" : "vypnuté") +
    row("Affiliate čeká na potvrzení", String(refPending)) +
    row("Zakládající členové Academy", founders + " / 50 · zbývá " + foundersLeft) +
    row("Odkazy v mailech a na webu", odkazyRadek) +
    `</table>` +
    `<p style="margin:14px 0 4px;color:#666;font-size:13px">Leadi 7 dní: ${trendStr || "—"}</p>` +
    `<p style="margin:14px 0 0;font-size:13px"><a href="https://martinbarna.cz/akademie/admin/" style="color:#c45e00">Otevřít admin →</a></p></div>`;

  if (!RESEND_KEY) return json({ error: "missing_resend" }, 500);
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: "Bearer " + RESEND_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "Barna Academy <news@martinbarna.cz>", to: [to],
      subject: `🌅 Ranní přehled: ${leadsYc} leadů, ${salesYc} prodejů` + (wdrPending ? `, ⚠️ ${wdrPending} odstoupení` : ""),
      html,
    }),
  });
  if (!res.ok) return json({ error: "resend_" + res.status }, 500);
  return json({ ok: true, to, leads: leadsYc, sales: salesYc, sent, errors: errs, withdrawals_pending: wdrPending, watchdog: { corsBad, dContact, dLead, kanarek: { ok: kanarekOk, chyba: kanarekChyba } } });
});
