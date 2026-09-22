// =============================================================================
// `koucink-konec`: automat, který po konci zaplaceného období zavře klientovi
// koučink, odebere appku Tvůj Coach a pošle rozlučkový mail s nabídkou ročního
// VIP se slevou. (Martin, GO 22. 9. 2026.)
//
// Volá pg_cron denně s hlavičkou `x-drip-secret` (vzor `client-remind`).
//
// ⛔ ROZHODOVÁNÍ JE V `core.ts`, TADY JE JEN VODOVOD (revize R1, nález S11).
//    Celá orchestrace dřív žila uvnitř `Deno.serve()`, takže ji test nemohl
//    naimportovat bez nastartování serveru. Kdo sem vrátí podmínku, která
//    rozhoduje o odeslání nebo o zavření přístupu, vrátí i slepé místo.
//
// ⛔⛔ CO TENHLE AUTOMAT DĚLÁ, SE NEDÁ VZÍT ZPÁTKY: odešle mail pod Martinovým
//    jménem a sebere přístup. Každé rozhodnutí je proto raději „nedělej nic"
//    než „udělej to potichu".
//
// ⛔⛔ DNES BY NEZAVŘEL NIKOHO A JE TO SPRÁVNĚ. Změřeno 22. 9. 2026 na živé DB:
//    všech 20 aktivních koučinkových nároků má `expires_at` prázdné, protože ho
//    `client_invite` schválně neposílal a přes Stripe koučink zatím nikdo nekoupil.
//    Automat pracuje VÝHRADNĚ s datem konce: bez něj neví, kdy komu období
//    uplynulo, a hádat to nebude.
//    ⇒ Aby se z toho nestal tichý no-op, běh VŽDY hlásí `bez_data` a jednou týdně
//      (pondělí) na to Martina upozorní mailem. Nula zavřených se nikdy nesmí
//      přečíst jako „nikomu koučink neskončil".
//
// Konfigurace (`app_config`, všechno se čte za běhu, nic není v kódu):
//   koucink_konec_enabled     'true' = automat běží. ⛔ COKOLI JINÉHO = NEBĚŽÍ.
//   koucink_konec_grace_dny   kolik dní po konci se ještě čeká (výchozí 7)
//   koucink_konec_optout      CSV e-mailů, kterých se automat netýká
//   koucink_vip_coupon_id     id kupónu ve Stripu (20 % na roční VIP)
//   academy_grant_secret      most do appky
//   admin_emails              kam chodí alerty
// Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY,
//          STRIPE_RESTRICTED_PROMO_KEY (potřebuje PRÁVO ZÁPISU na promotion codes)
//
// Deploy: --no-verify-jwt (volá cron, ne přihlášený klient; drží to secret).
// ⛔ Deploy musí nahrát CELOU složku i `_shared` (past `mb-deploy-kopiruje-jen-index-past`).
// =============================================================================
import { createClient } from "jsr:@supabase/supabase-js@2";
import { guardSend, logMailSkip } from "../_shared/mailing-guard.ts";
import { chybaCteni, ctiSOpakovanim, overSecret } from "../_shared/secret-guard.ts";
import { emailySeznam } from "../_shared/mail-seznam.ts";
import { odesliPresResend } from "../_shared/resend-odeslat.ts";
import {
  CHYBA_KOD_NEAKTIVNI,
  maZaplacenouAcademy,
  ukonciPristup,
  vyberKeUkonceni,
  vygenerujPromoKod,
  zajistiPromoKod,
  type KoucinkRadek,
} from "../_shared/koucink-konec.ts";
import { buildOffboardMail } from "../_shared/offboard-mail.ts";
import {
  type BehDeps,
  type RazitkoRadek,
  razitkaDoFronty,
  zaber,
  ZASEKNUTO_PO_MS,
  zpracujJednoho,
} from "./core.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const STRIPE_PROMO_KEY = Deno.env.get("STRIPE_RESTRICTED_PROMO_KEY") ?? "";
const FROM = "Martin Barna <news@martinbarna.cz>";

/** Výchozí ochranná lhůta. ⛔ SEDM DNÍ, NE DVA, a je to rozhodnutí s důvodem:
 *  koučink se NEOBNOVUJE sám. Není to předplatné (změřeno 22. 9. 2026: ani jeden
 *  koučinkový nárok nemá `stripe_subscription_id`), je to jednorázový nákup nebo
 *  ruční pozvánka. Klient, který se s Martinem domluví na pokračování, zaplatí
 *  klidně za týden. Rozlučkový mail poslaný mezitím se nedá vzít zpět, zatímco
 *  týden appky navíc nestojí nic. */
const VYCHOZI_GRACE_DNY = 7;

// ---------------------------------------------------------------------------
// ROZPOČET BĚHU (revize R1, nález V2)
// ---------------------------------------------------------------------------
// ⛔ Cron utne HTTP po 120 s (`timeout_milliseconds`) a Supabase Free dává edge
//    funkci 150 s wall clocku. Když se do toho běh nevejde, zabijí ho UPROSTŘED
//    člověka: `catch` se neprovede, razítko zůstane v `rezervovano` a bez pojistky
//    by toho člověka další běh už nikdy nevzal.
// Spočítáno z nejhoršího případu na jednoho člověka:
//   promo kód (Stripe)      15 s  timeout, až 2 pokusy při kolizi kódu = 30 s
//   most do appky           20 s  timeout
//   odeslání mailu         ~10 s  ⚠️ NEMÁ tvrdý timeout, viz níž
//   čtení z DB a pauza      ~2 s
//   ⇒ nejhorší případ kolem 62 s, běžný případ pod 5 s.
// Osm lidí by v nejhorším případě dalo 8 minut, takže samotný strop nestačí:
// rozhoduje DEADLINE. Než se zabere další člověk, zkontroluje se, kolik času
// zbývá; zbytek fronty počká na zítřek a je to vidět v odpovědi (`zbylo`).
// ⚠️ `odesliPresResend` tvrdý timeout NEMÁ a je sdílený s dvanácti dalšími
//    funkcemi, takže se tady nemění. Deadline je proto o 25 s pod limitem cronu.
const MAX_ZA_BEH = 8;
const DEADLINE_MS = 95_000;
const STRIPE_TIMEOUT_MS = 15_000;
const APPKA_TIMEOUT_MS = 20_000;
/** Strop alertů na běh, ať se z poruchy nestane rozesílka Martinovi. */
const MAX_ALERTU = 5;
/** Pacing mezi maily (Resend má výchozí limit 2 požadavky za sekundu). */
const PAUZA_MS = 550;

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { "Content-Type": "application/json" } });
const low = (s: unknown) => String(s ?? "").trim().toLowerCase();
const pockej = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

Deno.serve(async (req: Request): Promise<Response> => {
  const start = Date.now();
  // ⛔ Pořadí kontrol: METODA, pak SECRET, pak práce. Sonda zvenčí musí umět
  //    poznat živou funkci bez toho, aby něco spustila (`tvujcoach-hlidka-platebnich-webhooku`).
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
  const sec = await overSecret(admin, req, { header: "x-drip-secret", statusOdmitnuti: 403 });
  if (!sec.ok) return json(sec.body, sec.status);

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  // NANEČISTO: vypíše, koho by zavřel, a NESÁHNE NA NIC.
  const dry = body.dry === true;

  // ---------------------------------------------------------------------------
  // Konfigurace. ⛔ Chyba čtení NENÍ „není nastaveno" (CLAUDE.md 13).
  // ---------------------------------------------------------------------------
  const cfg = await ctiSOpakovanim<{ data: { key: string; value: string }[] | null; error: unknown }>(() =>
    admin.from("app_config").select("key,value").in("key", [
      "koucink_konec_enabled",
      "koucink_konec_grace_dny",
      "koucink_konec_optout",
      "koucink_vip_coupon_id",
      "academy_grant_secret",
      "admin_emails",
    ])
  );
  if (cfg.error) return json(chybaCteni("app_config", cfg.error), 500);
  const mapa = new Map((cfg.data ?? []).map((r) => [String(r.key), String(r.value ?? "")]));
  const hodnota = (k: string) => (mapa.get(k) ?? "").trim();

  // ⛔ VÝCHOZÍ STAV JE VYPNUTO, na rozdíl od `client-remind`. Nasazení funkce nesmí
  //    samo o sobě začít zavírat lidem přístup: zapnutí je vlastní, viditelný krok.
  const zapnuto = hodnota("koucink_konec_enabled").toLowerCase() === "true";
  if (!zapnuto && !dry) {
    return json({ ok: true, vypnuto: true, hint: "app_config.koucink_konec_enabled neni 'true'" });
  }

  // ⛔ PRÁZDNÁ HODNOTA NENÍ NULA. `Number("")` je 0, tedy konečné a nezáporné,
  //    takže by chybějící řádek v `app_config` tiše nastavil ochrannou lhůtu na
  //    nula dní a automat by zavíral lidi v den, kdy jim období vypršelo.
  const graceText = hodnota("koucink_konec_grace_dny");
  const graceRaw = graceText === "" ? NaN : Number(graceText);
  const graceDny = Number.isFinite(graceRaw) && graceRaw >= 0 ? graceRaw : VYCHOZI_GRACE_DNY;
  const optout = [...emailySeznam(hodnota("koucink_konec_optout"))];
  const couponId = hodnota("koucink_vip_coupon_id");
  const grantSecret = hodnota("academy_grant_secret");
  const adminMail = [...emailySeznam(hodnota("admin_emails"))][0] || "fitness.barna@gmail.com";

  // ---------------------------------------------------------------------------
  // Kdo přichází v úvahu.
  // ---------------------------------------------------------------------------
  const naroky = await ctiSOpakovanim<{ data: KoucinkRadek[] | null; error: unknown }>(() =>
    admin.from("entitlements").select("email,active,expires_at").eq("product", "coaching").eq("active", true)
  );
  if (naroky.error) return json(chybaCteni("entitlements", naroky.error), 500);

  const razitka = await ctiSOpakovanim<{ data: RazitkoRadek[] | null; error: unknown }>(() =>
    admin.from("koucink_konec_sent").select("email,stav,promo_code,pokusy,updated_at,duvod,mail_stav")
  );
  if (razitka.error) return json(chybaCteni("koucink_konec_sent", razitka.error), 500);
  const vsechnaRazitka = razitka.data ?? [];

  const vyber = vyberKeUkonceni(naroky.data ?? [], {
    tedMs: Date.now(),
    graceDny,
    optout,
    jizOrazitkovane: vsechnaRazitka.map((r) => low(r.email)),
  });

  // ⛔⛔ FRONTA MUSÍ DO `zaber` PUSTIT VŠECHNO, CO SI ZASLOUŽÍ ROZHODNUTÍ
  //    (revize R2, nálezy V1 a V2). Do R2 brala jen `opakovat` a `opakovat_mail`
  //    s `pokusy < 5`, takže DVĚ POJISTKY Z R1 BYLY V PROVOZU MRTVÉ:
  //      1. opuštěná `rezervovano` (po zabití běhu timeoutem cronu) se nikdy
  //         nedostala k pravidlu „starší 30 minut", protože `zaber` se pro ni
  //         nezavolal. Člověk zůstal viset navždy, bez alertu.
  //      2. řádek s `pokusy >= 5` fronta VYHODILA, takže `zaber` ho nikdy
  //         nepřepnul na `vzdano` a alert „vzdávám to" nešel. Komentář u filtru
  //         tvrdil, že „`zaber` je stejně přepne". Nepřepnul, nedostal se k nim.
  //    ⇒ Filtruje se JEN to, co je opravdu uzavřené. O všem ostatním rozhoduje
  //      `zaber`, tedy jedno místo, které jde otestovat.
  const zRazitek = razitkaDoFronty(vsechnaRazitka, { tedMs: Date.now() });
  const kOpakovani = zRazitek.emaily;
  const nadStropem = zRazitek.nadStropem;
  // ⭐ Opakování má PŘEDNOST před novými: rozdělaná práce (typicky zavřený přístup
  //    bez rozloučení) je horší stav než čekající nový člověk.
  const celaFronta = [...kOpakovani, ...vyber.kUkonceni.map((r) => r.email)];
  const fronta = celaFronta.slice(0, MAX_ZA_BEH);

  const prehled = {
    grace_dny: graceDny,
    aktivnich_naroku: (naroky.data ?? []).length,
    // ⛔ TOHLE ČÍSLO JE DŮVOD, PROČ AUTOMAT MŮŽE MLČET. Nula zavřených při nenulovém
    //    `bez_data` neznamená „nikomu koučink neskončil", ale „nemám u koho měřit".
    bez_data: vyber.bezData,
    v_graci: vyber.vGraci,
    pred_koncem: vyber.predKoncem,
    v_optout: vyber.vOptout,
    k_ukonceni: vyber.kUkonceni.length,
    k_opakovani: kOpakovani.length,
    nad_stropem: nadStropem,
    zaseknutych: zRazitek.zaseknutych,
    ma_kupon: !!couponId,
  };

  if (dry) {
    return json({ ok: true, dry: true, zapnuto, ...prehled, fronta, ceka_na_zitrek: Math.max(0, celaFronta.length - fronta.length) });
  }

  // ---------------------------------------------------------------------------
  // Alerty. ⛔ Jdou PŘÍMO přes Resend, NE přes `guardSend`: brána chrání adresu
  //    klienta, ne Martinovu, a kdyby jeho adresa skončila na seznamu, přestal by
  //    se dozvídat právě ta selhání, kvůli kterým alert existuje.
  // ⛔ Bez `stopa`: Martinova adresa do `email_events` nepatří.
  // ---------------------------------------------------------------------------
  let alertuPoslano = 0, alertuPotlaceno = 0;
  const alertySelhaly: string[] = [];
  async function alert(predmet: string, text: string, klic = ""): Promise<void> {
    if (alertuPoslano >= MAX_ALERTU) { alertuPotlaceno++; return; }
    alertuPoslano++;
    const r = await odesliPresResend(RESEND_KEY, {
      from: FROM,
      to: [adminMail],
      subject: predmet,
      html: `<pre style="font-family:inherit;white-space:pre-wrap">${text}</pre>`,
    });
    if (!r.ok) {
      console.error("[koucink-konec] ALERT NEODESEL: " + predmet);
      alertySelhaly.push(klic || predmet);
    }
  }

  // ---------------------------------------------------------------------------
  // Zapojení jádra. Tady se nic nerozhoduje, jen překládá na databázi a síť.
  // ---------------------------------------------------------------------------
  const deps: BehDeps = {
    ted: () => Date.now(),
    maKupon: !!couponId,
    graceDny,
    async vlozRazitko(email) {
      const { error } = await admin.from("koucink_konec_sent")
        .insert({ email, stav: "rezervovano", pokusy: 1, mail_stav: "neposlano", updated_at: new Date().toISOString() });
      if (!error) return { ok: true, kod: "", detail: "" };
      return {
        ok: false,
        kod: String((error as { code?: unknown }).code ?? ""),
        detail: String((error as { message?: unknown }).message ?? error).slice(0, 160),
      };
    },
    async ctiRazitko(email) {
      const { data, error } = await admin.from("koucink_konec_sent")
        .select("email,stav,promo_code,pokusy,updated_at,duvod,mail_stav").eq("email", email).maybeSingle();
      if (error) return { radek: null, chyba: String((error as { message?: unknown }).message ?? error).slice(0, 160) };
      return { radek: (data as RazitkoRadek | null) ?? null, chyba: "" };
    },
    async prevezmi(email, zeStavu, pokusy, jenZaseknute) {
      // ⛔⛔ POČET SE BERE Z VRÁCENÝCH ŘÁDKŮ, NE Z `count: "exact"` (revize R3,
      //    nález S3). Dokumentace PostgREST popisuje `Prefer: count=` u ČTENÍ
      //    (stránka Pagination and Count ukazuje jen GET); že u PATCH vrátí počet
      //    změněných řádků, nikde netvrdí. Zámek přitom stál na tom, že vyjde
      //    přesně 1. `.select()` naproti tomu vrací aktualizované řádky
      //    (`Prefer: return=representation`), což je dokumentované chování,
      //    a délka pole je měřitelná věc, ne domněnka.
      //    https://docs.postgrest.org/en/stable/references/api/pagination_count.html
      let q = admin.from("koucink_konec_sent")
        .update({ stav: "rezervovano", pokusy, updated_at: new Date().toISOString() })
        .eq("email", email).eq("stav", zeStavu);
      // ⛔⛔ ZÁMEK MUSÍ BÝT VYLUČOVACÍ I PRO `rezervovano` → `rezervovano`
      //    (revize R3, nález V1). Ten přechod svou vlastní podmínku splní POŘÁD,
      //    takže druhý volající prošel taky a oba poslali mail. Podmínku porušuje
      //    až čas: v TÉMŽE UPDATE se proto žádá, aby razítko bylo starší než
      //    ochranná lhůta. Kdo přijde druhý, uvidí čerstvé `updated_at` a mine.
      if (jenZaseknute) q = q.lt("updated_at", new Date(Date.now() - ZASEKNUTO_PO_MS).toISOString());
      const { data, error } = await q.select("email");
      if (error) return { pocet: 0, chyba: String((error as { message?: unknown }).message ?? error).slice(0, 160) };
      return { pocet: Array.isArray(data) ? data.length : 0, chyba: "" };
    },
    async nastavRazitko(email, pole) {
      const { error } = await admin.from("koucink_konec_sent").update(pole).eq("email", email);
      if (error) console.error("[koucink-konec] update razitka selhal (" + email + "): " + error.message);
      return !error;
    },
    async stavNaroku(email) {
      // ⛔ Chyba čtení vrací `active: null`, tedy „nevím". Jádro to čte jako důvod
      //    nechat člověka na další běh, ne jako „nemá nárok".
      const { data, error } = await admin.from("entitlements").select("active,expires_at")
        .eq("email", email).eq("product", "coaching").limit(1).maybeSingle();
      if (error) return { active: null, expiresAt: null };
      if (!data) return { active: false, expiresAt: null };
      return { active: data.active === true, expiresAt: data.expires_at ?? null };
    },
    maAcademy: (email) => maZaplacenouAcademy(admin, email),
    async brana(email, trida, path) {
      const d = await guardSend(admin, { email, mailClass: trida, functionName: "koucink-konec", path });
      return { action: d.action, reason: d.reason, decision: d };
    },
    // deno-lint-ignore no-explicit-any
    logSkip: (decision) => logMailSkip(admin, decision as any),
    // ⛔ Losování je VLASTNÍ krok: jádro si kód uloží DŘÍV, než se o něm dozví
    //    Stripe, takže opakování po pádu sítě kód nezdvojí (nález V2).
    vylosujKod: () => vygenerujPromoKod(),
    async zalozPromo(email, kod) {
      const p = await zajistiPromoKod(STRIPE_PROMO_KEY, { couponId, email, kod, timeoutMs: STRIPE_TIMEOUT_MS });
      return p.ok ? { ok: true, kod: p.kod } : { ok: false, chyba: p.chyba };
    },
    // ⛔ Archivovaný kód (typicky proto, že Martin vyměnil kupón) se nedá oživit
    //    a Stripe nedovolí založit aktivní kód s týmž textem. Jádro si proto
    //    vylosuje nový, uloží ho a zkusí to ještě jednou.
    kodNeaktivni: CHYBA_KOD_NEAKTIVNI,
    ukonciPristup: (email) => ukonciPristup(admin, { email, grantSecret, timeoutMs: APPKA_TIMEOUT_MS }),
    async posliMail(email, opts) {
      // ⛔ ROD JE `neutral` A NENÍ TO LENOST. Automat pohlaví klienta nezná
      //    (v `entitlements` ani v `customer_contacts` není) a odhad ze jména je
      //    přesně ta vada, kvůli které přepínač rodu v adminu vznikl.
      // ⛔ Oslovení se taky NEHÁDÁ: 5. pád z příjmení by byl trapas.
      const { subject, html } = buildOffboardMail({
        osloveni: "",
        rod: "neutral",
        includeSales: opts.includeSales,
        maAcademy: opts.maAcademy,
        promoKod: opts.promoKod,
      });
      const r = await odesliPresResend(
        RESEND_KEY,
        { from: FROM, to: [email], subject, html, reply_to: "martin@martinbarna.cz", bcc: ["fitness.barna@gmail.com"] },
        { admin, via: "koucink-konec", email, detail: { track: "koucink-konec", ma_academy: opts.maAcademy } },
      );
      return { ok: r.ok, status: r.status, chyba: r.chyba };
    },
    alert,
  };

  const hotovo: string[] = [];
  const opakovat: { email: string; duvod: string }[] = [];
  const odmitnuto: { email: string; duvod: string }[] = [];
  const preskoceno: { email: string; duvod: string }[] = [];
  const nejiste: string[] = [];
  const vzdano: string[] = [];
  let doslo_na_cas = false;

  for (const emailRaw of fronta) {
    const email = low(emailRaw);
    if (!email) continue;
    // ⛔ DEADLINE PŘED ZABRÁNÍM, ne uprostřed práce. Kdo se nevejde, nemá ani
    //    razítko, takže ho zítřek vezme jako nového a nic po něm nezůstane viset.
    if (Date.now() - start > DEADLINE_MS) { doslo_na_cas = true; break; }

    const zabrano = await zaber(email, deps);
    if (zabrano.stav === "obsazeno") { preskoceno.push({ email, duvod: zabrano.duvod }); continue; }
    if (zabrano.stav === "vzdano") { vzdano.push(email); continue; }
    if (zabrano.stav === "chyba") { preskoceno.push({ email, duvod: "razitko_chyba:" + zabrano.detail }); continue; }

    try {
      const v = await zpracujJednoho(email, zabrano, deps);
      if (v.vysledek === "hotovo" || v.vysledek === "hotovo_bez_mailu") hotovo.push(email);
      else if (v.vysledek === "opakovat") opakovat.push({ email, duvod: v.duvod });
      else if (v.vysledek === "odmitnuto") odmitnuto.push({ email, duvod: v.duvod });
      else if (v.vysledek === "nejiste") nejiste.push(email);
      else preskoceno.push({ email, duvod: v.duvod });
    } catch (e) {
      // ⛔ Výjimka po zabrání razítka nesmí nechat řádek viset v `rezervovano`.
      // ⛔⛔ NA `mail_stav` SE NESAHÁ (revize R4). Do R4 tu bylo potřeba ručně
      //    zachovávat stav práce `opakovat_mail`, protože nesl informaci o mailu.
      //    Od R4 je stav mailu vlastní sloupec: výjimka mění jen práci, a jestli
      //    řádek uvízl v `posilam`, uzavře ho po lhůtě rozhodnutí `nejiste`.
      await deps.nastavRazitko(email, {
        stav: "opakovat",
        duvod: "vyjimka:" + String(e).slice(0, 140),
        updated_at: new Date().toISOString(),
      });
      opakovat.push({ email, duvod: "vyjimka" });
      console.error("[koucink-konec] vyjimka u " + email + ": " + String(e).slice(0, 300));
      // ⛔ Výjimka uprostřed nevratné práce se nesmí schovat do JSONu, do kterého
      //    se nikdo nedívá (týž důvod jako u `zapis_selhal` v `client-remind`).
      await alert(
        "🔴 Konec koučinku: výjimka uprostřed zpracování",
        "Klient: " + email + "\nStav práce: opakovat\nChyba: " + String(e).slice(0, 300) +
          "\n\nAutomat to zkusí znovu při dalším běhu. Když se to opakuje, je to vada kódu,\n" +
          "ne stav toho klienta.",
        email,
      );
    }
    await pockej(PAUZA_MS);
  }

  // ---------------------------------------------------------------------------
  // ⭐ TÝDENNÍ PŘIPOMENUTÍ: automat nemá u koho měřit konec.
  //    Bez tohohle by nula zavřených vypadala stejně jako „všechno v pořádku".
  //    Jednou týdně (pondělí), ať to nezevšední.
  // ---------------------------------------------------------------------------
  const pondeli = new Date().getUTCDay() === 1;
  if (vyber.bezData > 0 && pondeli) {
    await alert(
      "⚠️ Koučink: " + vyber.bezData + " klientů nemá vyplněný konec",
      "Automat konec koucinku pracuje jenom s datem konce zaplaceného období.\n" +
        vyber.bezData + " aktivních klientů ho vyplněné nemá, takže se jich automat NETÝKÁ:\n" +
        "sami se jim appka nezavře a rozloučení jim nepřijde.\n\n" +
        "Doplň ho v adminu: karta klienta, pole Konec koučinku.\n" +
        "Dokud tam datum není, není to chyba automatu, jen nemá podle čeho jet.",
    );
  }

  // ⚠️ Alert o nenastaveném kupónu se posílá z JÁDRA, u každého člověka, kterého
  //    se to týká, a KAŽDÝ BĚH (revize R2, nález V2). Dřív byl tady a jen
  //    v pondělí; po pěti dnech bez pondělí zmizel a člověk zůstal otevřený
  //    v tichu. Strop `MAX_ALERTU` drží, aby se z toho nestala rozesílka.

  // ⛔ Nedoběhnutý běh se nesmí schovat do JSONu (revize R2, nález N9). `doslo_na_cas`
  //    znamená, že fronta je delší, než se stihne, a ta se sama nezkrátí.
  if (doslo_na_cas) {
    await alert(
      "⚠️ Konec koučinku: běh nestihl celou frontu",
      "Běh se zastavil na časovém rozpočtu (" + DEADLINE_MS + " ms) a " +
        Math.max(0, celaFronta.length - hotovo.length) + " lidí zůstalo na zítřek.\n\n" +
        "Jednou je to v pořádku (fronta se dožene). Když to přijde několik dní po sobě,\n" +
        "něco visí: nejspíš odesílání mailů, které tvrdý timeout nemá.",
    );
  }

  return json({
    ok: true,
    ...prehled,
    hotovo: hotovo.length,
    opakovat,
    odmitnuto,
    preskoceno,
    odeslani_nejiste: nejiste,
    vzdano,
    doslo_na_cas,
    ceka_na_zitrek: Math.max(0, celaFronta.length - fronta.length),
    trvani_ms: Date.now() - start,
    alerty_potlaceno: alertuPotlaceno,
    alerty_selhaly: alertySelhaly,
  });
});
