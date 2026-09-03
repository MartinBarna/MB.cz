// Barna Academy — daily-digest: ranni prehled Martinovi e-mailem.
// Vola pg_cron (07:30 Prahy) pres net.http_post s hlavickou x-drip-secret
// (stejne tajemstvi jako drip-send: app_config drip_invoke_secret).
// Shrnuje VCEREJSEK + aktualni stav: leadi, maily, prodeje (simpleshop),
// fronta, odstoupeni, affiliate, chyby. Cisla pocita kod, zadne odhady.
import { createClient } from "jsr:@supabase/supabase-js@2";
import { hlidkaCisla, hlidkaPrihlaseni } from "./hlidky.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_KEY = Deno.env.get("RESEND_API_KEY") ?? "";

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method" }, 405);
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

  const { data: cfg } = await admin.from("app_config").select("key,value").in("key", ["drip_invoke_secret", "admin_emails", "followups_enabled", "followups_breaker_reason", "drip_daily_cap", "academy_founders_offset", "clenske_track_prefixy", "pocet_cisel_mereno_v"]);
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
    admin.from("leads").select("email,source").gte("created_at", yStart.toISOString()).lt("created_at", dayStart.toISOString()),
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
    admin.from("entitlements").select("product").eq("active", true).in("source", ["simpleshop", "stripe-lifetime", "stripe-videokurz", "stripe-videokurz-upgrade", "stripe-konzultace", "stripe-balicek", "stripe-koucink"]).gte("granted_at", yStart.toISOString()),
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
  // academy_founders_offset: prodeje grantnute rucne, testovaci ucty se nepocitaji).
  // Prvnich 50 = zakladajici clenove (status a pocta). ⛔ Slib o zdrazeni na 12 900
  // po 50. clenovi Martin 8. 8. 2026 ZRUSIL, cena je 8 900 natrvalo.
  const founders = (acadSold.count ?? 0) + (Number(cmap.academy_founders_offset ?? "") || 0);
  const foundersLeft = Math.max(0, 50 - founders);

  // ===== Nove leady vs. reaktivace (2. 9. 2026) =====
  // ⛔ PROC: 2. 9. rano hlasil prehled „52 leadů za 24 h" a vypadalo to jako nejlepsi den
  // v historii. Padesat z nich byla reaktivacni vlna 392, tedy radky ZNOVU zalozene starym
  // kontaktum, ktere Martin zna roky. Cislo, ktere ma merit prisun NOVYCH lidi, jde takhle
  // nafouknout jakoukoli hromadnou akci a Martin podle nej nepozna ani uspech reklamy,
  // ani jeji vypadek.
  // ⇒ „Nove leady" pocitaji jen ty, koho jsme dosud neznali. Zbytek jde na vlastni radek.
  // Za NEnoveho se bere: (a) zdroj zacinajici `reaktivace-` nebo `import`,
  //                      (b) e-mail, ktery uz DRIV byl v `customer_contacts`.
  // ⚠️ Duplicitni radek v `leads` tohle NEPOZNA: `leads` ma e-mail unikatni a hromadne vlny
  // stavajici radek prepisuji, takze zadny starsi radek se stejnou adresou nevznikne.
  // Zmereno 2. 9. 2026: u vsech 50 radku vlny bylo 0 starsich radku v `leads`, ale 50 z 50
  // adres bylo v `customer_contacts`. Registr znamych kontaktu je tedy jediny spolehlivy
  // znak, proto se ptame jeho, ne `leads`.
  const lowEm = (v: unknown) => String(v ?? "").trim().toLowerCase();
  const leadsYrows = (leadsY.data ?? []) as Array<{ email?: string; source?: string }>;
  const leadEmaily = [...new Set(leadsYrows.map((l) => lowEm(l.email)).filter((e) => e.includes("@")))];
  // ⛔ Ptame se JEN na vcerejsi adresy, ne na celou tabulku: `customer_contacts` ma pres
  // 800 radku a PostgREST vraci nanejvys 1000, takze dotaz bez filtru by se casem TISE usekl
  // a vlna by se zase zacala pocitat jako novi lide. Tataz past je popsana u koucinku niz.
  const znamiC = leadEmaily.length
    ? await admin.from("customer_contacts").select("email,created_at").in("email", leadEmaily)
    : { data: [] as Array<{ email: string; created_at: string }>, error: null };
  // ⛔ Chybu dotazu NESPOLKNOUT. Prazdny seznam znamena „nikoho neznam", takze by prehled
  // vlnu zase vydaval za nove leady, jen tentokrat potichu. Hlasi se to alertem niz.
  const znamiChyba = znamiC.error ? String(znamiC.error.message).slice(0, 120) : "";
  const znamiOd = new Map<string, number>();
  for (const c of znamiC.data ?? []) znamiOd.set(lowEm(c.email), Date.parse(String(c.created_at ?? "")) || 0);
  const jeReaktivace = (src: string) => src.startsWith("reaktivace-") || src.startsWith("import");
  const bySrc: Record<string, number> = {};
  const stariBySrc: Record<string, number> = {};
  let leadsYc = 0;
  let leadsStari = 0;
  for (const l of leadsYrows) {
    const src = String(l.source ?? "?");
    const znamyOd = znamiOd.get(lowEm(l.email));
    // Kontakt musi byt znamy DRIV, nez lead vznikl. Zapis leadu si casto zalozi i radek
    // v `customer_contacts`, takze bez teto podminky by byl „znamy" uplne kazdy a
    // „Nove leady" by ukazovaly natvrdo nulu.
    const znamy = znamyOd !== undefined && znamyOd < yStart.getTime();
    if (jeReaktivace(src) || znamy) { leadsStari++; stariBySrc[src] = (stariBySrc[src] ?? 0) + 1; }
    else { leadsYc++; bySrc[src] = (bySrc[src] ?? 0) + 1; }
  }

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
    // ⛔ Reaktivacni a importni radky se sem NEPOCITAJI. Detektor ticha ma hlidat, jestli
    // chodi NOVI lide z reklam. Jedna hromadna vlna by ho jinak umlcela na dalsi dny
    // a rozbity lead-capture by se schoval za nasi vlastni akci.
    admin.from("leads").select("created_at").not("source", "like", "reaktivace-%").not("source", "like", "import%").order("created_at", { ascending: false }).limit(1),
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
  if (znamiChyba) {
    alerts += warn("Registr známých kontaktů se nepodařilo přečíst (" + znamiChyba + "). Číslo "
      + "„Nové leady“ je proto nafouknuté o reaktivace a znovu přihlášené staré kontakty. "
      + "Ber ho dnes jako neplatné.");
  }
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
  // ⛔ 8. 8. 2026 tu byl alert „blíží se 50. člen, připrav zdražení na 12 900 Kč".
  // Martin toho dne zdražení ZRUŠIL, cena zůstává 8 900 natrvalo, takže ten alert
  // vyzýval k akci, která už neplatí. Počítadlo zůstává jako informace (řádek níž),
  // protože „zakládající člen" žije dál jako status a pocta prvním padesáti.
  // Kdo by chtěl alert vrátit, musí nejdřív obnovit veřejný slib o ceně.

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

  // --- Roční VIP appky: balíček se doručuje RUČNĚ -------------------------
  // ⛔ VĚDOMÝ DLUH, NE VADA. K ročnímu VIP appky (4 990 Kč) patří videokurz A balíček
  //    „40 receptů a 48 odpovědí". Videokurz uděluje most `app-purchase-bridge` sám
  //    (entitlement JE ten produkt), ale u balíčku je doručení uvítací mail
  //    s podepsanými odkazy na dvě PDF, a podepisování žije uvnitř
  //    `academy-stripe-webhook`. Třetí opis té logiky se schválně nedělal.
  // ⇒ Dokud se to nepřepíše do sdíleného modulu, musí balíček poslat člověk. A protože
  //    „nezapomeň" není pojistka, ptáme se DAT: kdo dostal bonusový videokurz a nemá
  //    `balicek`, ten na něj pořád čeká. Řádek zmizí sám, jakmile se balíček udělí.
  // ⚠️ Není to alert z události, ale ze STAVU: přežije i to, když se digest jeden den
  //    nepošle nebo když nákup přijde v noci.
  try {
    const { data: bonusovi } = await admin.from("entitlements")
      .select("email").eq("product", "videokurz").eq("source", "rocni-vip-bonus").eq("active", true)
      .limit(50);
    const emaily = (bonusovi ?? []).map((r: { email: string }) => String(r.email));
    if (emaily.length) {
      const { data: majiBalicek } = await admin.from("entitlements")
        .select("email").eq("product", "balicek").eq("active", true).in("email", emaily);
      const s = new Set((majiBalicek ?? []).map((r: { email: string }) => String(r.email)));
      const cekaji = emaily.filter((e) => !s.has(e));
      if (cekaji.length) {
        alerts += warn(`${cekaji.length}× ROČNÍ VIP ČEKÁ NA BALÍČEK (` + cekaji.slice(0, 5).join(", ") +
          `). Videokurz dostali automaticky, balíček „40 receptů a 48 odpovědí" se zatím posílá ` +
          `ručně. Pošli jim ho z adminu; tenhle řádek pak zmizí sám.`);
      }
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
      const vlastniNeovereno = Number(s.vlastni_neovereno ?? 0);
      odkazyRadek = `${s.celkem} zkontrolováno · ${s.chyb} nefunguje`;
      // ⛔ 3. 9. 2026: adresy na vlastní doméně, které blokla ochrana webu (WEDOS,
      // HTTP 401), NEJSOU prokazatelně rozbité. `link_check_souhrn` je od teď počítá
      // zvlášť do `vlastni_neovereno`, ne do `chyb`, ať to nevypadá jako poplach.
      if (vlastniNeovereno > 0) {
        odkazyRadek += ` · ${vlastniNeovereno} vlastních adres neověřeno (ochrana webu blokuje kontrolu, hlídá deploy)`;
      }
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

  // --- 🔭 HLÍDKY: presunuto z drahych Claude rutin (3. 9. 2026) -----------
  // Hlidka 1 "cisla nezamrzla": Academy app_config.pocet_cisel_mereno_v, plni ho cron
  // cisla-sync-6h. Anomalie (chybi/nesmyslne/stare > 26 h) jde jako alert NAHORU,
  // radek do sekce HLIDKY je vzdy.
  const hlidkaCislaR = hlidkaCisla(cmap.pocet_cisel_mereno_v, now.getTime());
  if (hlidkaCislaR.alertText) alerts += warn(hlidkaCislaR.alertText);

  // Hlidka 2 "prihlaseni appky": auth.audit_log_entries appky (kfkmghvhqwqtsalqjmrp).
  // ⛔ OVĚŘENO 3. 9. 2026 přímým dotazem: tabulka existuje a je čitelná ze service role,
  // ale má TRVALE 0 řádků, přestože stejný den reálně proběhla přihlášení (auth.users.
  // last_sign_in_at). GoTrue v tomto projektu posílá audit log jen do Logs Exploreru
  // (auth_logs, Management API), ne do téhle Postgres tabulky.
  // ⇒ Čtení by šlo přes Management API, ale to vyžaduje PAT v edge funkci — zadání
  // to výslovně zakazuje. Bez nového secretu/deploye na appce se sem živá data nedostanou
  // (jediná dnes existující cesta mezi projekty, `academy-grant`, tuhle akci nemá).
  // Funkce hlidkaPrihlaseni() v ./hlidky.ts je hotová a otestovaná pro den, kdy tahle
  // cesta vznikne; do té doby se sem jen napíše, PROČ dnes nic neměříme (žádná tichá nula).
  // hlidkaPrihlaseni([], null) by pro prazdny vstup vratila presne tenhle radek;
  // volani se schvalne nedela naprazdno (zadna data se dnes nikde nectou), viz komentar vys.
  const hlidkaLoginRadek = hlidkaPrihlaseni([], null).radek;
  const hlidkyHtml =
    `<h3 style="margin:18px 0 6px;font-size:15px">🔭 Hlídky</h3>` +
    `<table style="width:100%;border-collapse:collapse;background:#fafafa;border-radius:12px;overflow:hidden">` +
    row("Čísla", hlidkaCislaR.radek) +
    row("Přihlášení appky", hlidkaLoginRadek) +
    `</table>`;

  // --- 🤝 KOUČINK: co dnes potřebuje Martinovu ruku -----------------------
  // ⛔ PŘIBYLO 1. 9. 2026. Do té doby neměl ranní přehled o koučinkových klientech
  // ANI JEDEN ŘÁDEK (ověřeno greppem), přestože je to nejdražší produkt a jediný,
  // kde udržení stojí na tom, že si Martin všimne včas. Přehled v adminu je lepší,
  // ale musí si pro něj dojít; tenhle mail chodí sám.
  // Jen ČTENÍ z DB plus jeden dotaz na appku. Nic se nikam nezapisuje.
  // ⚠️ Martinovy testovací účty se vyhazují (`fitness.barna%` a adresy s `+`), jinak
  // by si četl vlastní zkoušky jako klienty (past `feedback-cisla-z-testovacich-uctu-nejsou-provoz`).
  // ⛔ Celý blok je v try/catch a musí přežít prázdná data: nula klientů dá nuly,
  // ne pád. Kdyby spadl, digest se pošle bez něj, ne vůbec.
  let koucinkHtml = "";
  try {
    const lowE = (v: unknown) => String(v ?? "").trim().toLowerCase();
    const escT = (s: string) => s.replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c] as string));
    const jeTest = (e: string) => e.startsWith("fitness.barna") || e.includes("+");
    const [entsC, repsC, tgsC] = await Promise.all([
      admin.from("entitlements").select("email,active,expires_at").eq("product", "coaching"),
      admin.from("client_reports").select("email,report_date,created_at"),
      admin.from("client_targets").select("email,kcal,protein"),
    ]);
    // ⛔ Chybu dotazu NIKDY nespolknout. `x.data ?? []` udělá z rozbitého dotazu
    // prázdný seznam, takže by mail hlásil „Aktivních klientů 0" a vypadal by,
    // že je klid. Táž tichá vada se v tomhle souboru už jednou stala u počítadla
    // zakládajících (28. 7. 2026, `select` neexistujícího sloupce).
    const chybyDotazu: string[] = [];
    if (entsC.error) chybyDotazu.push("entitlements (" + entsC.error.message + ")");
    if (repsC.error) chybyDotazu.push("client_reports (" + repsC.error.message + ")");
    if (tgsC.error) chybyDotazu.push("client_targets (" + tgsC.error.message + ")");

    const nowMs = now.getTime();
    // ⚠️ `active` samo nestačí: skončený koučink má `active` dál true a jen prošlé
    // `expires_at`. Bez té podmínky by Martin dostával seznam bývalých klientů.
    const klienti = (entsC.data ?? [])
      .map((r: { email: string; active: boolean | null; expires_at: string | null }) =>
        ({ email: lowE(r.email), active: r.active === true, exp: r.expires_at }))
      .filter((r) => r.email && !jeTest(r.email) && r.active &&
        (!r.exp || Date.parse(String(r.exp)) > nowMs));
    const aktivni = new Set(klienti.map((k) => k.email));

    // Křestní jméno z `customer_contacts`. Když ho neznáme, jde do mailu adresa:
    // Martin podle ní člověka najde, a jinde v tomhle přehledu už adresy jsou.
    // ⛔ Ptáme se JEN na adresy koučinkových klientů. Celá tabulka má 822 řádků
    // a PostgREST vrací nanejvýš 1000, takže by se dotaz bez filtru časem tiše
    // usekl a někomu by v mailu zmizelo jméno, aniž by cokoli spadlo.
    // Adresy v `customer_contacts` jsou všechny malými písmeny (ověřeno, 0 výjimek),
    // takže lowercase klíče z entitlements sedí. Prázdný seznam se do filtru neposílá.
    const contactsC = klienti.length
      ? await admin.from("customer_contacts").select("email,name").in("email", klienti.map((k) => k.email))
      : { data: [] as Array<{ email: string; name: string | null }>, error: null };
    if (contactsC.error) chybyDotazu.push("customer_contacts (" + contactsC.error.message + ")");
    if (chybyDotazu.length) {
      alerts += warn("🔴 KOUČINKOVÝ BLOK NEPŘEČETL VŠECHNA DATA: " + chybyDotazu.join(", ") +
        ". Čísla o klientech pod tím jsou tím pádem nižší, než mají být, a nula tam dnes " +
        "neznamená klid. Ber je jako neplatná a řekni Claudovi, ať to prověří.");
    }
    const jmenoBy = new Map<string, string>();
    for (const c of contactsC.data ?? []) {
      if (c.name) jmenoBy.set(lowE(c.email), String(c.name).trim().split(/\s+/)[0]);
    }
    const jmeno = (e: string) => escT(jmenoBy.get(e) || e);

    // Poslední report a reporty za 24 h. ⛔ Časy se porovnávají přes Date.parse,
    // ne jako řetězce: PostgREST vrací "+00:00" a toISOString() vrací "Z",
    // takže textové porovnání by tiše lhalo.
    const posledni = new Map<string, number>();
    let novychReportu = 0;
    const novaJmena: string[] = [];
    for (const r of repsC.data ?? []) {
      const e = lowE(r.email); if (!e || !aktivni.has(e)) continue;
      const den = Date.parse(String(r.report_date ?? ""));
      if (!isNaN(den) && den > (posledni.get(e) ?? -Infinity)) posledni.set(e, den);
      const vzniklo = Date.parse(String(r.created_at ?? ""));
      if (!isNaN(vzniklo) && nowMs - vzniklo <= 86400000) {
        novychReportu++;
        const j = jmeno(e); if (!novaJmena.includes(j)) novaJmena.push(j);
      }
    }
    const bezReportu: string[] = [];
    for (const k of klienti) {
      const den = posledni.get(k.email);
      if (den === undefined) { bezReportu.push(jmeno(k.email) + " (nikdy)"); continue; }
      const dni = Math.floor((nowMs - den) / 86400000);
      if (dni >= 7) bezReportu.push(jmeno(k.email) + " (" + dni + " d)");
    }

    // Zadání se počítá za nastavené, až když má aspoň kalorie nebo bílkoviny.
    // Prázdný řádek v `client_targets` klientovi v jeho sekci neukáže žádný cíl,
    // takže by se počítal jako „má zadání" a nikdo by se k němu nevrátil.
    const maZadani = new Set((tgsC.data ?? [])
      .filter((t: { kcal: number | null; protein: number | null }) => t.kcal != null || t.protein != null)
      .map((t: { email: string }) => lowE(t.email)));
    const bezZadani = klienti.filter((k) => !maZadani.has(k.email)).map((k) => jmeno(k.email));

    // Stav appky. ⛔ NEBRAT z tabulky `tvujcoach_grants`, ta se zapisuje při pozvání
    // a už se neaktualizuje. Živý stav umí appka přes `academy-grant` action
    // `access-status`, týmž kanálem jako admin. Best-effort: když appka neodpoví,
    // napíše se to narovinu, prázdno by se tvářilo jako „všichni appku mají".
    let appkaRadek = klienti.length ? "appka neodpověděla, stav neznámý" : "žádní klienti";
    if (klienti.length) {
      try {
        const { data: gs } = await admin.from("app_config").select("value").eq("key", "academy_grant_secret").maybeSingle();
        const gsec = gs?.value ? String(gs.value) : "";
        if (gsec) {
          const r = await fetch("https://kfkmghvhqwqtsalqjmrp.functions.supabase.co/academy-grant", {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-academy-secret": gsec },
            body: JSON.stringify({ action: "access-status", emails: klienti.map((k) => k.email) }),
            signal: AbortSignal.timeout(10_000),
          });
          if (r.ok) {
            const jj = await r.json().catch(() => null);
            const ceka = ((jj?.rows ?? []) as Array<{ email?: string; stav?: string }>)
              .filter((s) => String(s?.stav ?? "") === "ceka_na_registraci")
              .map((s) => jmeno(lowE(s.email)));
            appkaRadek = ceka.length ? ceka.length + "× " + ceka.slice(0, 8).join(", ") : "nikdo nečeká";
          }
        }
      } catch { /* stav appky je doplněk, nesmí shodit koučinkový blok */ }
    }

    const vypis = (a: string[], max = 8) =>
      a.length ? ": " + a.slice(0, max).join(", ") + (a.length > max ? " a další " + (a.length - max) : "") : "";
    koucinkHtml =
      `<h3 style="margin:18px 0 6px;font-size:15px">🤝 Koučink</h3>` +
      `<table style="width:100%;border-collapse:collapse;background:#fafafa;border-radius:12px;overflow:hidden">` +
      row("Aktivních klientů", String(klienti.length)) +
      row("Bez reportu 7 a víc dní", String(bezReportu.length) + vypis(bezReportu)) +
      row("Bez zadání", String(bezZadani.length) + vypis(bezZadani)) +
      row("Nové reporty za 24 h k odpovědi", String(novychReportu) + vypis(novaJmena)) +
      row("Čeká na vyzvednutí appky", appkaRadek) +
      `</table>`;
  } catch (e) {
    koucinkHtml = info("Koučinkový blok se dnes nepovedlo spočítat: " + String(e).slice(0, 140) +
      ". Zbytek přehledu platí, jen o klientech dnes nevíš nic.");
  }

  // --- 📱 APPKA: nova aktivni predplatna za 24 h ---------------------
  // ⛔ PRIBYLO 2. 9. 2026. Do te doby cetl prehled jen Academy `entitlements`, takze den,
  // kdy appka Tvuj Coach prodala prvni dve predplatna, hlasil „0 prodeju". Radek
  // „PRODEJE ACADEMY (STRIPE)" vys je JEN ACADEMY (videokurz, konzultace, balicek,
  // dozivotni clenstvi); predplatne appky zije v UPLNE JINEM Supabase projektu
  // (kfkmghvhqwqtsalqjmrp) a do toho radku se nikdy nezapocita. Proto vlastni radek,
  // ne rozsireni seznamu zdroju vys.
  //
  // ⛔ PROC VEREJNA RPC A NE SERVICE-ROLE KLIC APPKY: primy dotaz do jeji DB by znamenal
  // drzet v Academy plnou moc nad druhou databazi kvuli trem cislum. Vzorem je proto
  // `verejna_cisla()`, kterou uz `anon` vola z webu: RPC `nova_predplatna_24h()` vraci
  // POUZE souctY (basic, vip, celkem), zadnou adresu ani ID. Staci tedy VEREJNY anon klic
  // appky, ktery uz je stejne v HTML na martinbarna.cz/tvuj-coach/ (soubor
  // `tvuj-coach/index.html`, tamtez se z teze databaze tahaji ceny).
  // ⇒ ZADNY NOVY SECRET SE NEZAKLADA. Klic jde prebit env `TC_SUPABASE_ANON_KEY`,
  //   kdyby ho appka nekdy rotovala; bez nej se pouzije tentyz verejny klic jako na webu.
  //
  // ⚠️ DOKUD SE NEAPLIKUJE MIGRACE `20260902120000_nova_predplatna_24h.sql` v repu
  // appky, vrati PostgREST 404 a radek poctive rekne „nedostupne". ⛔ Nula se misto
  // toho zobrazit NESMI: veta „0 prodeju" je prave to, kvuli cemu tenhle blok vznikl.
  const TC_URL = "https://kfkmghvhqwqtsalqjmrp.supabase.co/rest/v1/rpc/nova_predplatna_24h";
  const TC_ANON = Deno.env.get("TC_SUPABASE_ANON_KEY") ??
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtma21naHZocXdxdHNhbHFqbXJwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4ODA2NjQsImV4cCI6MjA5NTQ1NjY2NH0.8meIfIw51xCttJQa2WHMuX7ArbuCh4kK7t-ZWG7JSQA";
  let appkaPredplatna = "nedostupné (appka neodpověděla)";
  let appkaPocet: number | null = null;
  try {
    const r = await fetch(TC_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": TC_ANON,
        "Authorization": "Bearer " + TC_ANON,
      },
      body: "{}",
      signal: AbortSignal.timeout(10_000),
    });
    if (r.status === 404) appkaPredplatna = "nedostupné (appka zatím nemá RPC nova_predplatna_24h)";
    else if (!r.ok) appkaPredplatna = "nedostupné (appka vrátila HTTP " + r.status + ")";
    else {
      const jj = await r.json().catch(() => null);
      // ⛔ Cisla musi prijit jako cisla. Kdyz v odpovedi nejsou, je to porucha RPC,
      // ne nula prodeju, a musi to byt videt.
      const nc = Number(jj?.celkem), nb = Number(jj?.basic), nv = Number(jj?.vip);
      if ([nc, nb, nv].every((x) => Number.isFinite(x))) {
        appkaPocet = nc;
        appkaPredplatna = nc + " (Basic " + nb + ", VIP " + nv + ")";
      } else {
        appkaPredplatna = "nedostupné (odpověď RPC nemá čísla)";
      }
    }
  } catch (e) {
    appkaPredplatna = "nedostupné (" + String(e).slice(0, 80) + ")";
  }

  const html =
    `<div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;font-size:15px;line-height:1.5;color:#222;max-width:560px;margin:0 auto">` +
    `<h2 style="margin:0 0 4px">🌅 Ranní přehled</h2>` +
    `<p style="margin:0 0 14px;color:#888">za ${dY}</p>` + alerts +
    `<table style="width:100%;border-collapse:collapse;background:#fafafa;border-radius:12px;overflow:hidden">` +
    row("Nové leady", String(leadsYc) + (leadsYc ? " (" + Object.entries(bySrc).map(([k, v]) => k + " " + v).join(", ") + ")" : "")) +
    // Reaktivace na VLASTNIM radku a schvalne az pod novymi leady: jsou to lide, ktere uz
    // znas, takze do cisla o prisunu novych nepatri, ale vedet o vlne potrebujes.
    (leadsStari ? row("Reaktivace a známé kontakty", String(leadsStari) + " (" + Object.entries(stariBySrc).map(([k, v]) => k + " " + v).join(", ") + ")") : "") +
    // Label „SimpleShop" byl relikt (SimpleShop zrušen 29. 7. 2026, prodeje jdou
    // ze Stripe) a 8. 8. zmátl Martina, který kvůli němu řešil, jestli SimpleShop
    // pořád žije. Počítadlo bylo správně, lhal jen nápis.
    row("Prodeje Academy (Stripe)", String(salesYc) + (salesYc ? " (" + Object.entries(salesY).map(([k, v]) => k + " " + v).join(", ") + ")" : "")) +
    // "Resend max 100/den" bylo z free tarifu a od prechodu na placeny uz to neplatilo.
    // Zavadejici udaj: 30. 6. 2026 prave tenhle denni limit vyrobil 307 chyb.
    row("Appka: nová aktivní předplatná za 24 h", appkaPredplatna) +
    row("Odeslané e-maily", String(sent) + " · strop fronty " + cap + " · Resend bez denního limitu") +
    row("Fronta e-mailů teď", String((due.data ?? []).length)) +
    row("Follow-upy", cmap.followups_enabled === "true" ? "zapnuté" : "vypnuté") +
    row("Affiliate čeká na potvrzení", String(refPending)) +
    row("Zakládající členové Academy", founders + " / 50 · zbývá " + foundersLeft) +
    row("Odkazy v mailech a na webu", odkazyRadek) +
    `</table>` + hlidkyHtml + koucinkHtml +
    `<p style="margin:14px 0 4px;color:#666;font-size:13px">Leadi 7 dní: ${trendStr || "—"}</p>` +
    `<p style="margin:14px 0 0;font-size:13px"><a href="https://martinbarna.cz/akademie/admin/" style="color:#c45e00">Otevřít admin →</a></p></div>`;

  if (!RESEND_KEY) return json({ error: "missing_resend" }, 500);
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: "Bearer " + RESEND_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "Barna Academy <news@martinbarna.cz>", to: [to],
      subject: `🌅 Ranní přehled: ${leadsYc} leadů, ${salesYc} prodejů Academy` + (appkaPocet ? `, ${appkaPocet}× appka` : "") + (wdrPending ? `, ⚠️ ${wdrPending} odstoupení` : ""),
      html,
    }),
  });
  if (!res.ok) return json({ error: "resend_" + res.status }, 500);
  return json({ ok: true, to, leads: leadsYc, leads_reaktivace: leadsStari, sales: salesYc, app_subs: appkaPocet, app_subs_text: appkaPredplatna, sent, errors: errs, withdrawals_pending: wdrPending, watchdog: { corsBad, dContact, dLead, kanarek: { ok: kanarekOk, chyba: kanarekChyba } } });
});
