// =============================================================================
// `koucink-konec`: automat, který po konci zaplaceného období zavře klientovi
// koučink, odebere appku Tvůj Coach a pošle rozlučkový mail s nabídkou ročního
// VIP se slevou. (Martin, GO 22. 9. 2026.)
//
// Volá pg_cron denně s hlavičkou `x-drip-secret` (vzor `client-remind`).
//
// ⛔⛔ CO TENHLE AUTOMAT DĚLÁ, SE NEDÁ VZÍT ZPÁTKY: odešle mail pod Martinovým
//    jménem a sebere přístup. Každé rozhodnutí je proto raději „nedělej nic"
//    než „udělej to potichu".
//
// ⛔⛔ DNES BY NEZAVŘEL NIKOHO A JE TO SPRÁVNĚ. Změřeno 22. 9. 2026 na živé DB:
//    všech 20 aktivních koučinkových nároků má `expires_at` prázdné, protože ho
//    `client_invite` schválně neposílá a přes Stripe koučink zatím nikdo nekoupil
//    (`stripe_subscription_id` u všech prázdné). Automat pracuje VÝHRADNĚ s datem
//    konce: bez něj neví, kdy komu období uplynulo, a hádat to nebude.
//    ⇒ Aby se z toho nestal tichý no-op, běh VŽDY hlásí `bez_data` a jednou týdně
//      (pondělí) na to Martina upozorní mailem. Nula zavřených se nikdy nesmí
//      přečíst jako „nikomu koučink neskončil".
//    Datum doplní Martin v adminu (karta klienta, pole „Konec koučinku"), nebo
//    přijde ze Stripu u zaplaceného balíčku.
//
// ⛔ POŘADÍ UVNITŘ JEDNOHO ČLOVĚKA (a proč přesně takhle):
//    1. RAZÍTKO   (`koucink_konec_sent`)  před vším ostatním. Bez něj se neděje nic.
//    2. PROMO KÓD ve Stripu. Selže => razítko na `opakovat`, NIC se nezavřelo,
//       další běh to zkusí znovu. Mail bez kódu by slíbil slevu, kterou pokladna
//       nezná.
//    3. APPKA     (`academy-grant`). Selže => razítko na `opakovat`, nárok
//       ZŮSTÁVÁ AKTIVNÍ (o to se stará `ukonciPristup`).
//    4. NÁROK + značka v CRM.
//    5. MAIL      přes `guardSend` a `odesliPresResend` (stopa s `provider_id`).
//    Když odeslání skončí v NEJISTOTĚ (5xx, síť), razítko ZŮSTANE a jde alert:
//    Martin 17. 9. 2026 „raději nikdy mail navíc", rozhodne člověk, ne cron.
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
  maZaplacenouAcademy,
  ukonciPristup,
  vyberKeUkonceni,
  vytvorPromoKod,
  type KoucinkRadek,
} from "../_shared/koucink-konec.ts";
import { buildOffboardMail } from "../_shared/offboard-mail.ts";

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
/** Strop na jeden běh. Víc než tohle znamená, že se něco děje jinak, než čekáme. */
const MAX_ZA_BEH = 20;
/** Strop alertů na běh, ať se z poruchy nestane rozesílka Martinovi. */
const MAX_ALERTU = 5;
/** Pacing mezi maily (Resend má výchozí limit 2 požadavky za sekundu). */
const PAUZA_MS = 550;

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { "Content-Type": "application/json" } });
const low = (s: unknown) => String(s ?? "").trim().toLowerCase();
const pockej = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

type Razitko = { email: string; stav: string; promo_code: string | null };

Deno.serve(async (req: Request): Promise<Response> => {
  // ⛔ Pořadí kontrol: METODA, pak SECRET, pak práce. Sonda zvenčí musí umět
  //    poznat živou funkci bez toho, aby něco spustila (`tvujcoach-hlidka-platebnich-webhooku`).
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
  const sec = await overSecret(admin, req, { header: "x-drip-secret", statusOdmitnuti: 403 });
  if (!sec.ok) return json(sec.body, sec.status);

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  // NANEČISTO: vypíše, koho by zavřel, a NESÁHNE NA NIC. Tím se automat kontroluje
  // před ostrým zapnutím i po každé změně dat.
  const dry = body.dry === true;

  // ---------------------------------------------------------------------------
  // Konfigurace. ⛔ Chyba čtení NENÍ „není nastaveno" (CLAUDE.md 13): na Free plánu
  //    padá asi 1,35 % požadavků na 504 a tichý pád na výchozí hodnoty by znamenal,
  //    že automat jede s grací 7 i tehdy, když ji Martin nastavil na 30.
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
  // `emailySeznam` vrací `Set`, výběr chce pole.
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

  const razitka = await ctiSOpakovanim<{ data: Razitko[] | null; error: unknown }>(() =>
    admin.from("koucink_konec_sent").select("email,stav,promo_code")
  );
  if (razitka.error) return json(chybaCteni("koucink_konec_sent", razitka.error), 500);
  const vsechnaRazitka = razitka.data ?? [];

  const vyber = vyberKeUkonceni(naroky.data ?? [], {
    tedMs: Date.now(),
    graceDny,
    optout,
    jizOrazitkovane: vsechnaRazitka.map((r) => low(r.email)),
  });

  // ⛔ FRONTA NA OPAKOVÁNÍ JE VLASTNÍ SEZNAM, NE DRUHÝ POHLED NA `entitlements`.
  //    Jakmile se nárok jednou vypne, z výběru výš vypadne navždy. Kdyby po tom
  //    selhalo odeslání, člověk by zůstal zavřený bez rozloučení a nikdo by to
  //    nevěděl. Práci proto řídí razítko, ne nárok.
  const kOpakovani = vsechnaRazitka.filter((r) => r.stav === "opakovat").map((r) => low(r.email));
  const fronta = [...vyber.kUkonceni.map((r) => r.email), ...kOpakovani].slice(0, MAX_ZA_BEH);

  const prehled = {
    grace_dny: graceDny,
    aktivnich_naroku: (naroky.data ?? []).length,
    // ⛔ TOHLE ČÍSLO JE DŮVOD, PROČ AUTOMAT MŮŽE MLČET. Nula zavřených při nenulovém
    //    `bez_data` neznamená „nikomu koučink neskončil", ale „nemám u koho měřit".
    bez_data: vyber.bezData,
    v_graci: vyber.vGraci,
    v_optout: vyber.vOptout,
    k_ukonceni: vyber.kUkonceni.length,
    k_opakovani: kOpakovani.length,
  };

  if (dry) {
    return json({ ok: true, dry: true, zapnuto, ...prehled, fronta });
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

  /** Razítko na jiný stav. Chyba se čte a hlásí: tiché selhání by frontu zaseklo. */
  async function nastavRazitko(email: string, pole: Record<string, unknown>): Promise<boolean> {
    const { error } = await admin.from("koucink_konec_sent").update(pole).eq("email", email);
    if (error) console.error("[koucink-konec] update razitka selhal (" + email + "): " + error.message);
    return !error;
  }

  /**
   * Zabere si člověka. Vrací uložený promo kód, aby se po opakování nezakládal druhý.
   * ⛔ Nový řádek jde prostým `insert`em a `23505` se čte jako „má ho někdo jiný".
   *    `upsert ... on conflict do nothing` tu být nemusí a nemá: unikátní index je
   *    úplný (bez `where`), ale jeden výklad je čitelnější než dva.
   */
  async function zaber(email: string): Promise<{ stav: "ok" | "obsazeno" | "chyba"; promo: string; detail: string }> {
    const { error } = await admin.from("koucink_konec_sent").insert({ email, stav: "rezervovano" });
    if (!error) return { stav: "ok", promo: "", detail: "" };
    const kod = String((error as { code?: unknown }).code ?? "");
    if (kod !== "23505") {
      return { stav: "chyba", promo: "", detail: String((error as { message?: unknown }).message ?? error).slice(0, 160) };
    }
    // Existuje. Zabrat ho smím, jen když čeká na opakování; `update` s počtem
    // rozhodne závod mezi souběžnými běhy.
    const { data, error: uErr, count } = await admin.from("koucink_konec_sent")
      .update({ stav: "rezervovano" }, { count: "exact" })
      .eq("email", email).eq("stav", "opakovat").select("promo_code");
    if (uErr) return { stav: "chyba", promo: "", detail: String(uErr.message ?? uErr).slice(0, 160) };
    if (!count) return { stav: "obsazeno", promo: "", detail: "" };
    const promo = Array.isArray(data) && data[0] ? String((data[0] as { promo_code?: unknown }).promo_code ?? "") : "";
    return { stav: "ok", promo, detail: "" };
  }

  const hotovo: string[] = [];
  const opakovat: { email: string; duvod: string }[] = [];
  const preskoceno: { email: string; duvod: string }[] = [];
  const nejiste: string[] = [];

  for (const emailRaw of fronta) {
    const email = low(emailRaw);
    if (!email) continue;

    const zabrano = await zaber(email);
    if (zabrano.stav === "obsazeno") { preskoceno.push({ email, duvod: "razitko_ma_nekdo_jiny" }); continue; }
    if (zabrano.stav === "chyba") { preskoceno.push({ email, duvod: "razitko_chyba:" + zabrano.detail }); continue; }

    try {
      const maAcademy = await maZaplacenouAcademy(admin, email);

      // Brána. Ptáme se PŘED zásahem, protože podle výsledku se rozhoduje,
      // jestli vůbec potřebujeme promo kód ze Stripu.
      const confirm = await guardSend(admin, {
        email, mailClass: "client_operational",
        functionName: "koucink-konec", path: "koucink-konec.confirm",
      });
      const sales = await guardSend(admin, {
        email, mailClass: "marketing",
        functionName: "koucink-konec", path: "koucink-konec.sales",
      });
      const posleMail = confirm.action === "send";
      const potrebaPromo = posleMail && sales.action === "send" && !maAcademy;

      // --- 2) PROMO KÓD -------------------------------------------------------
      let promo = zabrano.promo;
      if (potrebaPromo && !promo) {
        const p = await vytvorPromoKod(STRIPE_PROMO_KEY, { couponId, email });
        if (!p.ok) {
          // ⛔ NIC SE JEŠTĚ NEZMĚNILO. Nárok je aktivní, appka běží, mail neodešel.
          //    Razítko na `opakovat` a rozhodne další běh.
          await nastavRazitko(email, { stav: "opakovat", duvod: "promo:" + p.chyba });
          opakovat.push({ email, duvod: "promo:" + p.chyba });
          await alert(
            "🔴 Konec koučinku: promo kód se nepodařilo založit",
            "Klient: " + email + "\nChyba Stripu: " + p.chyba +
            "\n\nStav: NIC se nezavřelo a mail NEODESEL. Nárok i appka běží dál.\n" +
            "Co zkontrolovat:\n" +
            " 1. app_config.koucink_vip_coupon_id ukazuje na existující kupón ve Stripu,\n" +
            " 2. secret STRIPE_RESTRICTED_PROMO_KEY má právo ZÁPISU na Promotion codes.\n" +
            "Další běh to zkusí znovu sám.",
            email,
          );
          continue;
        }
        promo = p.kod;
        // ⛔ Kód se ukládá HNED. Kdyby se to odložilo až za odeslání a mezitím
        //    cokoli spadlo, další běh by ve Stripu založil druhý kód a první by
        //    tam zůstal viset nepoužitý.
        await nastavRazitko(email, { promo_code: promo });
      }

      // --- 3) + 4) APPKA A NÁROK ---------------------------------------------
      const u = await ukonciPristup(admin, { email, grantSecret });
      if (u.stav === "appka_selhala" || u.stav === "narok_selhal") {
        await nastavRazitko(email, { stav: "opakovat", duvod: u.stav + ":" + (u.detail ?? u.tvujcoach) });
        opakovat.push({ email, duvod: u.stav });
        await alert(
          "🔴 Konec koučinku: " + (u.stav === "appka_selhala" ? "appka neodpověděla" : "nárok se nevypnul"),
          "Klient: " + email + "\nMost do appky: " + u.tvujcoach + "\nDetail: " + (u.detail ?? "") +
          "\n\nStav: mail NEODESEL." +
          (u.stav === "appka_selhala"
            ? "\nNárok ZŮSTAVA AKTIVNI, schválně: zavřít koučink a nechat appku běžet by byla tichá polovina.\n"
            : "\nAppka už zásah dostala, nárok se ale nevypnul. Zkontroluj ho v adminu.\n") +
          "Další běh to zkusí znovu sám.",
          email,
        );
        continue;
      }
      if (u.stav === "neni_klient" || u.stav === "uz_ukoncen") {
        // Někdo ho zavřel mezitím (ručně v adminu). Mail od automatu by byl druhý.
        await nastavRazitko(email, { stav: "hotovo", duvod: "zavren_jinde:" + u.stav, sent_at: new Date().toISOString(), sent_ok: false });
        preskoceno.push({ email, duvod: u.stav });
        continue;
      }

      // --- 5) MAIL ------------------------------------------------------------
      if (!posleMail) {
        await logMailSkip(admin, confirm);
        await nastavRazitko(email, { stav: "hotovo", duvod: "mail_preskocen:" + confirm.reason, ma_academy: u.maAcademy, sent_at: new Date().toISOString(), sent_ok: false });
        preskoceno.push({ email, duvod: "mail_preskocen:" + confirm.reason });
        hotovo.push(email);
        continue;
      }
      if (sales.action === "skip") await logMailSkip(admin, sales);

      // ⛔ ROD JE `neutral` A NENÍ TO LENOST. Automat pohlaví klienta nezná
      //    (v `entitlements` ani v `customer_contacts` není) a odhad ze jména je
      //    přesně ta vada, kvůli které přepínač rodu v adminu vznikl. Neutrální
      //    znění je vlastní text bez příčestí, ne mužská větev s jiným štítkem.
      // ⛔ Oslovení se taky NEHÁDÁ: 5. pád z příjmení by byl trapas. Mail začíná
      //    obecným „Ahoj,". Kdo chce oslovení, pošle rozloučení z admina.
      const { subject, html } = buildOffboardMail({
        osloveni: "",
        rod: "neutral",
        includeSales: sales.action === "send",
        maAcademy: u.maAcademy,
        promoKod: promo,
      });
      const r = await odesliPresResend(
        RESEND_KEY,
        { from: FROM, to: [email], subject, html, reply_to: "martin@martinbarna.cz", bcc: ["fitness.barna@gmail.com"] },
        { admin, via: "koucink-konec", email, detail: { track: "koucink-konec", ma_academy: u.maAcademy } },
      );

      if (r.ok) {
        await nastavRazitko(email, { stav: "hotovo", duvod: "odeslano", ma_academy: u.maAcademy, sent_at: new Date().toISOString(), sent_ok: true });
        hotovo.push(email);
      } else {
        // ⛔⛔ ROZHODUJE, JESTLI TĚLO MAILU MOHLO DOJÍT NA RESEND (vzor `client-remind`).
        //    NEMOHLO (4xx, chybějící klíč) => razítko na `opakovat`, další běh to
        //    zkusí znovu; přístup už je zavřený, ale mail ještě nikdo nedostal.
        //    MOHLO (5xx, `sit:`) => razítko zůstává na `chyba_nejiste` a rozhodne
        //    člověk. Martin 17. 9. 2026: „raději nikdy mail navíc."
        const teloMohloDojit = r.status >= 500 || String(r.chyba ?? "").startsWith("sit:");
        if (teloMohloDojit) {
          await nastavRazitko(email, { stav: "chyba_nejiste", duvod: "resend:" + (r.chyba ?? r.status), ma_academy: u.maAcademy, sent_at: new Date().toISOString(), sent_ok: false });
          nejiste.push(email);
          await alert(
            "⚠️ Konec koučinku: NEVÍM, jestli rozlučkový mail odešel",
            "Klient: " + email + "\nStav Resendu: " + r.status + "\nChyba: " + (r.chyba ?? "") +
            "\n\nPřístup je zavřený. Mail MOHL odejít, proto ho automat NEZOPAKUJE.\n" +
            "Zkontroluj schránku (Resend, logy) a rozhodni se sám. Když má jít znovu,\n" +
            "smaž jeho řádek z `koucink_konec_sent` nebo mu pošli rozloučení z admina.",
            email,
          );
        } else {
          await nastavRazitko(email, { stav: "opakovat", duvod: "resend:" + (r.chyba ?? r.status), ma_academy: u.maAcademy });
          opakovat.push({ email, duvod: "resend:" + r.status });
        }
      }
    } catch (e) {
      // ⛔ Výjimka po zabrání razítka nesmí nechat řádek viset v `rezervovano`:
      //    tam by ho už nikdy nikdo nesebral a člověk by zůstal bez rozloučení.
      await nastavRazitko(email, { stav: "opakovat", duvod: "vyjimka:" + String(e).slice(0, 140) });
      opakovat.push({ email, duvod: "vyjimka" });
      console.error("[koucink-konec] vyjimka u " + email + ": " + String(e).slice(0, 300));
    }
    await pockej(PAUZA_MS);
  }

  // ---------------------------------------------------------------------------
  // ⭐ TÝDENNÍ PŘIPOMENUTÍ: automat nemá u koho měřit konec.
  //    Bez tohohle by nula zavřených vypadala stejně jako „všechno v pořádku".
  //    Jednou týdně (pondělí), ať to nezevšední.
  // ---------------------------------------------------------------------------
  if (vyber.bezData > 0 && new Date().getUTCDay() === 1) {
    await alert(
      "⚠️ Koučink: " + vyber.bezData + " klientů nemá vyplněný konec",
      "Automat konec koucinku pracuje jenom s datem konce zaplaceného období.\n" +
      vyber.bezData + " aktivních klientů ho vyplněné nemá, takže se jich automat NETÝKÁ:\n" +
      "sami se jim appka nezavře a rozloučení jim nepřijde.\n\n" +
      "Doplň ho v adminu: karta klienta, pole Konec koučinku.\n" +
      "Dokud tam datum není, není to chyba automatu, jen nemá podle čeho jet.",
    );
  }

  return json({
    ok: true,
    ...prehled,
    hotovo: hotovo.length,
    opakovat,
    preskoceno,
    odeslani_nejiste: nejiste,
    alerty_potlaceno: alertuPotlaceno,
    alerty_selhaly: alertySelhaly,
  });
});
