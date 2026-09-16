// Resend webhook → email_events (open / click / bounce / complaint) + stav leadu.
// Zapoji se v Resend dashboardu: Webhooks → Add endpoint →
//   https://uhmrpfsdcujbhbtumqye.supabase.co/functions/v1/resend-webhook
//   eventy: email.opened, email.clicked, email.bounced, email.complained
// Podpisovy secret (whsec_...) MUSI byt v app_config klici 'resend_webhook_secret' —
// dokud tam neni, funkce vraci 503 a NIC nezapisuje (fail closed: podvrzeny bounce
// by jinak umel vypnout mailing celym leadum).
// Funkce musi byt nasazena s verify_jwt = false (externi webhook nema Supabase JWT).
//
// Pozn. k open rate: drip-send posila archivni BCC kopii se STEJNYM Resend id —
// kdyz Martin otevre archiv, zapocita se open leadovi. Metriku ber orientacne,
// dokud se archivace nepreveda na samostatny send.
// Pozn. ke click: Resend click tracking prepisuje odkazy pres cizi domenu (mirne horsi
// dorucitelnost). AKTUALIZACE 22. 7. 2026: Click i Open tracking je v Resendu ZAPNUTY
// (domena links.martinbarna.cz Verified), prokliky se sem tedy realne zapisuji.
//
// ⚠️ JAK TAHLE DATA CIST (24. 7. 2026, jinak z nich vyjde opacny zaver):
//  1) `open` je nafouknuty na 95-100 % — postovni servery (Gmail, seznam) si sledovaci
//     obrazek stahnou samy. Open NEMERI cteni, jen zhruba dorucitelnost.
//  2) Dedup nize je select-then-insert, tedy NEATOMICKY: kdyz prijde nekolik webhooku
//     naraz, projdou vsechny. Realny priklad 23. 7.: 4 radky click na tentyz mail
//     behem 378 ms. Pri cteni proto VZDY `count(distinct lead_id)`, ne `count(*)`.
//     Neatomicnost schvalne NEopravujeme (chtelo by to unikatni index): ta multiplicita
//     je uzitecny signal, nekolik kliku ve zlomku sekundy = skener, ne clovek.
//  3) Click se dedupuje az na (lead, step, track, URL), ne jen na mail — jinak by se
//     ulozil jen prvni klik a nesel by odlisit klik na nabidku od kliku na odhlaseni.
//     ⚠️ Data pred 24. 7. 13:31 UTC URL nemaji vubec a maji jen prvni klik na mail,
//     takze se s novejsimi NEDAJI scitat do jedne rady.
import { createClient } from "jsr:@supabase/supabase-js@2";
// ⭐ [16. 9. 2026] Alert Martinovi, když se bounce nebo stížnost nepodaří přiřadit
// k žádnému leadovi. Do té doby to funkce tiše ignorovala a ta adresa dostávala
// všechno dál (nález V1: ze 22 bounců se 7 nespárovalo vůbec).
import { odesliPresResend } from "../_shared/resend-odeslat.ts";
import { emailySeznam } from "../_shared/mail-seznam.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { "Content-Type": "application/json" } });

// Svix podpis: HMAC-SHA256(base64-dekodovany secret za 'whsec_', `${id}.${ts}.${payload}`) → base64.
// Hlavicka svix-signature = mezerami oddelene varianty "v1,<base64sig>".
async function verifySvix(secret: string, id: string, ts: string, payload: string, sigHeader: string): Promise<boolean> {
  try {
    if (!id || !ts || !sigHeader) return false;
    const age = Math.abs(Date.now() / 1000 - Number(ts));
    if (!Number.isFinite(age) || age > 600) return false; // replay okno 10 min
    const key = secret.startsWith("whsec_") ? secret.slice(6) : secret;
    const raw = Uint8Array.from(atob(key), (c) => c.charCodeAt(0));
    const ck = await crypto.subtle.importKey("raw", raw, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const mac = new Uint8Array(await crypto.subtle.sign("HMAC", ck, new TextEncoder().encode(id + "." + ts + "." + payload)));
    let b = ""; for (const x of mac) b += String.fromCharCode(x);
    const expected = btoa(b);
    return sigHeader.split(" ").some((s) => {
      const p = s.split(",");
      return p.length === 2 && p[0] === "v1" && p[1] === expected;
    });
  } catch { return false; }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method" }, 405);
  const payload = await req.text();
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

  // FAIL CLOSED: bez secretu nic neprijimame (jinak by podvrzeny bounce vypinal mailing)
  const { data: cfg } = await admin.from("app_config").select("value").eq("key", "resend_webhook_secret").maybeSingle();
  const secret = String(cfg?.value || "");
  if (!secret) return json({ error: "not_configured" }, 503);
  const ok = await verifySvix(
    secret,
    req.headers.get("svix-id") || "",
    req.headers.get("svix-timestamp") || "",
    payload,
    req.headers.get("svix-signature") || "",
  );
  if (!ok) return json({ error: "bad_signature" }, 401);

  let ev: { type?: string; data?: { email_id?: string; to?: string | string[]; click?: { link?: string }; bounce?: { type?: string; subType?: string; message?: string } } };
  try { ev = JSON.parse(payload); } catch { return json({ error: "bad_json" }, 400); }

  // ⭐⭐ [7. 9. 2026] `email.delivered` PŘIBYLO. Do té doby se sbíralo jen otevření, klik,
  // odmítnutí a stížnost, tedy samé ŠPATNÉ zprávy. Chybělo POTVRZENÍ, že mail dorazil.
  // Rozdíl je podstatný: „nepřišel bounce" není důkaz doručení, protože mail může
  // uváznout i tiše. Bez `delivered` se nedá odpovědět na otázku „odešlo 15 připomínek
  // klientům, dorazily?", a přesně ta padla 7. 9. ráno a nikdo ji zodpovědět neuměl.
  // ⚠️ Událost musí být zapnutá i v Resendu (Webhooks → endpoint → LISTENING FOR),
  //    sama od sebe chodit nezačne. Tady je jen příjem.
  // ⚠️ Objem: ~2 700 mailů týdně, tedy ~2 700 řádků `delivered` týdně navíc.
  const map: Record<string, string> = { "email.delivered": "delivered", "email.opened": "open", "email.clicked": "click", "email.bounced": "bounce", "email.complained": "complaint" };
  const t = map[String(ev?.type || "")];
  if (!t) return json({ ok: true, ignored: String(ev?.type || "") });

  const emailId = String(ev?.data?.email_id || "");
  if (!emailId) return json({ ok: true, ignored: "no_email_id" });

  // ⛔⛔ TENHLE SEZNAM MUSI OBSAHOVAT KAZDY TYP, POD KTERYM SE NEKDE ZAPISUJE ODESLANI.
  // Typ, ktery tu chybi, znamena presne to, co tahle davka opravuje: bounce se
  // nesparuje, `leads.status` se nezmeni a adresa dostava vsechno dal. Revize R1
  // to nasla u `konzultace_znovu_doruceno` a `balicek_znovu_doruceno` (nalez V-1).
  // ⛔ Hlida to kontrola T1 v `_shared/resend-odeslat.test.ts`, ktera typy VYCTE
  //    ZE ZDROJAKU vsech funkci, ne porovna retezec.
  //
  // Co je co:
  //   `sent`      drip-send a spol., ostry mail leadovi
  //   `test`      testovaci odeslani (nikdy nezmrazuje)
  //   `px_odeslano` mail S MERICIM PIXELEM (`milestones`, `order-rescue`);
  //                 `admin-api` ho pocita do jmenovatele otevrenosti
  //   `odeslano`  vychozi typ `_shared/resend-odeslat.ts`, mail BEZ pixelu
  //   `konzultace_znovu_doruceno` / `balicek_znovu_doruceno`
  //               opakovany nakup; na techhle radcich stoji i IDEMPOTENCE
  //               pres `detail->>payment_intent`, proto maji vlastni typ
  const TYPY_ODESLANI = [
    "sent",
    "test",
    "px_odeslano",
    "odeslano",
    "konzultace_znovu_doruceno",
    "balicek_znovu_doruceno",
  ];
  const { data: orig, error: chybaOrig } = await admin.from("email_events")
    .select("lead_id,step,type,detail").eq("provider_id", emailId)
    .in("type", TYPY_ODESLANI).limit(1).maybeSingle();

  // ⛔⛔ [R1, nalez S-6] CHYBA DOTAZU NENI ODPOVED DOTAZU. Timeout nebo 504 vypada
  //    stejne jako "nenaslo se": clovek by se nezmrazil a Martinovi by prisel FALESNY
  //    alert o nesparovanem bouncu. Resend webhook pri 5xx opakuje, takze spravna
  //    reakce je PRIZNAT NEVIM a nechat ho prijit znovu.
  //    (pamet `feedback-chyba-dotazu-neni-odpoved`: brana na 504 uz jednou poslala
  //    platiciho VIP na paywall)
  if (chybaOrig) {
    console.error("[resend-webhook] cteni puvodniho odeslani selhalo: " + chybaOrig.message);
    return json({ error: "orig_read_failed", retry: true }, 500);
  }

  const detailStopy = (orig?.detail && typeof orig.detail === "object")
    ? (orig.detail as Record<string, unknown>)
    : {};
  // ⛔ [R1, nalez S-2] TESTOVACI ODESLANI SE POZNA I PODLE ZNACKY V `detail`.
  //    Do R1 byl `isTest` pravda jen pro stary typ `test`, takze bounce na Martinovu
  //    testovaci adresu (`client-remind` v testovacim rezimu) by zmrazil lead.
  const isTest = orig?.type === "test" || detailStopy.test === true;

  // ⛔⛔ [R1, nalez S-1] ADRESA, KTERA SE DOOPRAVDY ODRAZILA, JE V PAYLOADU RESENDU.
  //    Resend vraci pro zasilku s `to` + `bcc` JEDNO `email_id`. `detail.email` je vzdy
  //    PRIMARNI prijemce, takze bounce BCC kopie (Martinova archivni kopie u
  //    `client-remind` a `client-report`) by zmrazil KLIENTA, ktery mail dostal
  //    v poradku. U `complaint` by navic sel na trvaly seznam.
  //    ⇒ Adresa z payloadu je zdroj pravdy. Kdyz se neshoduje se stopou, NEZMRAZUJE SE.
  // ⚠️ `ev.data.to` byva pole, ale nemusi prijit vubec; prazdne pole = nevime,
  //    a "nevime" se nesmi cist jako "neshoda" (to by zmrazeni vyplo uplne).
  const doruceniRaw = ev?.data?.to;
  const adresyZPayloadu = (Array.isArray(doruceniRaw) ? doruceniRaw : (doruceniRaw ? [doruceniRaw] : []))
    .map((x: unknown) => String(x ?? "").trim().toLowerCase())
    .filter((x: string) => x.length > 0);

  let lead_id = (!isTest && orig?.lead_id) ? (orig.lead_id as string) : null;
  // ⭐⭐ [16. 9. 2026] ZALOZNI PAROVANI PODLE ADRESY. Cesty mimo drip casto `lead_id`
  // neznaji (posilaji klientovi, kupci poukazu, dluznikovi splatky), takze stopa ma
  // `lead_id = null` a `detail.email`. Bez tohohle dohledani by mrtva adresa
  // z techto cest dal dostavala vsechno, presne jako pred opravou.
  // ⚠️ Hleda se JEN kdyz stopa adresu nese. Nikdy se nehada z jineho zdroje.
  let sparovanoPodle = lead_id ? "provider_id" : "nesparovano";
  const adresaZeStopy = String(detailStopy.email ?? "").trim().toLowerCase();
  // `false` = payload adresu prinesl a NESEDI se stopou (typicky bounce BCC kopie).
  // `true` = sedi, nebo payload adresu vubec neprinesl (pak se chovame jako dosud).
  const adresaSedi = adresyZPayloadu.length === 0 || !adresaZeStopy
    || adresyZPayloadu.includes(adresaZeStopy);

  if (!lead_id && !isTest && adresaZeStopy && adresaSedi) {
    const { data: l, error: chybaLeada } = await admin.from("leads")
      .select("id").eq("email", adresaZeStopy).limit(1).maybeSingle();
    // ⛔ [R1, S-6] Zase: chyba != nenaslo se. Radsi 500 a opakovani nez tichy omyl.
    if (chybaLeada) {
      console.error("[resend-webhook] dohledani leada podle adresy selhalo: " + chybaLeada.message);
      return json({ error: "lead_lookup_failed", retry: true }, 500);
    }
    if (l?.id) { lead_id = String(l.id); sparovanoPodle = "email"; }
  } else if (!adresaSedi) {
    sparovanoPodle = "adresa_nesedi";
  }
  // ⛔ [R1, S-1] Totez i pro parovani pres `provider_id`: kdyz payload rika, ze se
  //    odrazila JINA adresa nez ta ve stope, je to kopie a lead se zmrazit nesmi.
  if (lead_id && sparovanoPodle === "provider_id" && !adresaSedi) {
    lead_id = null;
    sparovanoPodle = "adresa_nesedi";
  }
  const step = orig?.step == null ? null : Number(orig.step);
  const baseDetail = detailStopy;
  const track = String(baseDetail.track ?? "");
  // URL prokliku (jen u click) — bez ni nerozlisime klik na nabidku od kliku na "odhlasit se"
  // ani cloveka od bezpecnostniho skeneru, ktery proklika vsechny odkazy v mailu naraz.
  // IP ani user agent ZAMERNE neukladame (osobni udaj, k rozliseni odkazu netreba).
  const clickUrl = t === "click" ? String(ev?.data?.click?.link || "") : "";
  // ⛔⛔ [13. 9. 2026] BOUNCE NENÍ JEN JEDEN. Resend (přes SES) rozlišuje `Permanent`
  // (mrtvá adresa), `Transient` (dočasné, např. `MailboxFull`) a `Undetermined`.
  // Do dneška se to nečetlo vůbec a KAŽDÝ bounce zmrazil lead natrvalo na
  // `status='bounced'`. Člověk s přeplněnou schránkou tak přišel o veškeré maily
  // a ručně se to nevrátí, protože o tom nikdo neví.
  // ⚠️ Typ se ukládá i do `detail`: do dneška jsme o žádném z 22 bounců nevěděli,
  //    jestli byl trvalý, takže se to nedalo ani zpětně spočítat.
  const bounceTyp = t === "bounce" ? String(ev?.data?.bounce?.type || "") : "";
  const bounceSub = t === "bounce" ? String(ev?.data?.bounce?.subType || "") : "";
  // Fail-closed: zmrazíme při `Permanent`, `Undetermined` i když typ nepřišel vůbec.
  // Jen výslovně dočasný bounce lead nechává na pokoji.
  const prechodnyBounce = t === "bounce" && /^(transient|temporary)$/i.test(bounceTyp);
  const detail = {
    ...baseDetail,
    via: "resend-webhook",
    of: isTest ? "test" : "sent",
    ...(clickUrl ? { url: clickUrl } : {}),
    ...(t === "bounce" ? { bounce_typ: bounceTyp, bounce_sub: bounceSub, prechodny: prechodnyBounce } : {}),
    sparovano_podle: sparovanoPodle,
    // ⛔ [R1, S-1] Adresa z payloadu se uklada VZDY, kdyz prisla: bez ni nejde zpetne
    //    rozhodnout, jestli se odrazil primarni prijemce, nebo jen BCC kopie.
    ...(adresyZPayloadu.length ? { doruceno_na: adresyZPayloadu } : {}),
  };

  // dedup: open staci jednou za mail — pres (lead, step, track) u leadu, pres provider_id jinak.
  // ⚠️ U CLICK je soucasti klice i URL: v jednom mailu je vic odkazu a klik na nabidku je jina
  // informace nez klik na odhlaseni. Bez URL v klici by se ulozil jen PRVNI klik na dany mail
  // a ten rozdil by se nedal precist (nalez z revize 24. 7.). Kdyz Resend URL nepošle,
  // chovame se jako driv (konzervativne jeden click na mail).
  // ⚠️ `delivered` se dedupuje VŽDY přes `provider_id`, ne přes (lead, step, track):
  // doručení patří ke KONKRÉTNÍMU mailu, a kdyby se klíčovalo přes krok tratě, druhé
  // odeslání téhož kroku (opakování, jednorázovka) by se tvářilo jako duplicita
  // a v datech by chybělo. Retry z Resendu se tím odfiltruje, dvě různá odeslání ne.
  if (t === "open" || t === "click" || t === "delivered") {
    let dq = admin.from("email_events").select("id").eq("type", t).limit(1);
    if (t === "delivered") dq = dq.eq("provider_id", emailId);
    else if (lead_id && step != null) dq = dq.eq("lead_id", lead_id).eq("step", step).eq("detail->>track", track);
    else dq = dq.eq("provider_id", emailId);
    // URL az jako DALSI podminka nad obema vetvemi (nikdy mezi if a else — else by se navazal sem)
    if (t === "click" && clickUrl) dq = dq.eq("detail->>url", clickUrl);
    const { data: dup } = await dq;
    if (dup && dup.length) return json({ ok: true, dedup: true });
  }

  await admin.from("email_events").insert({ lead_id, step: step ?? 0, type: t, provider_id: emailId, detail });

  // bounce = nedorucitelna adresa, complaint = spam → stop mailingu.
  // Status menime JEN pri overenem sparovani na ostry 'sent' event (test/nesparovane nikdy).
  if ((t === "bounce" || t === "complaint") && lead_id && !prechodnyBounce) {
    await admin.from("leads").update({
      status: t === "bounce" ? "bounced" : "unsubscribed",
      next_send_at: null,
      updated_at: new Date().toISOString(),
      // Stiznost na spam JE odhlaseni, jen prislo pres postovni schranku. Datum patri do
      // stejneho sloupce jako u tlacitka v paticce (`unsubscribed_at`), jinak by mericí
      // dotaz cast odhlaseni nevidel. U `bounce` se NEZAPISUJE: mrtva adresa neni
      // rozhodnuti cloveka a smichat to dohromady by cislo nafouklo.
      // ⚠️ Prepisuje i drivejsi datum. Vic nez jedna stiznost od tehoz cloveka se zatim
      //    nestala (4 stiznosti celkem od 11. 7. 2026) a stat se to nema.
      ...(t === "complaint" ? { unsubscribed_at: new Date().toISOString() } : {}),
    }).eq("id", lead_id);

    // ⛔ [6. 9. 2026] STIZNOST NA SPAM PATRI NA TRVALY SEZNAM ODHLASENYCH.
    // Do dneska tu koncil `status='unsubscribed'`, coz je zaznam v RADKU, ktery pri dalsim
    // importu (SimpleShop, Academy, formular) prepise nekdo jiny. Kdo nas nahlasil jako spam,
    // se nesmi vratit uz vubec. `odhlas_a_odstran` adresu zapise na seznam a lead zmrazi;
    // od te chvile ho drzi trigger `leads_respektuj_odhlaseni` primo v databazi.
    // ⚠️ JEN u `complaint`. Bounce je mrtva adresa, ne rozhodnuti cloveka, a na trvaly
    //    seznam nepatri: az si ji nekdo opravi, ma mit pravo maily zase dostavat.
    // Best-effort: pad tady nesmi shodit uz provedeny zapis stavu.
    if (t === "complaint") {
      const { error: chybaSeznamu } = await admin.rpc("odhlas_a_odstran", {
        p_lead_id: lead_id,
        p_zdroj: "spam-complaint",
      });
      if (chybaSeznamu) {
        console.error("[resend-webhook] zapis stiznosti na trvaly seznam selhal:", chybaSeznamu.message);
      }
    }
  }

  // ⛔⛔ [16. 9. 2026] NESPAROVANY BOUNCE NEBO STIZNOST UZ NESMI BYT TICHY.
  // Do dneska se takova udalost jen zapsala do `email_events` a nic dalsiho se
  // nestalo: `leads.status` zustal `active`, `mailing-guard.isHardBounce` tu adresu
  // nikdy neodstrihl a chodilo ji vsechno dal. Zmereno 16. 9. 2026: ze 22 bouncu
  // se 7 nesparovalo vubec.
  // ⛔ Zmrazeni naslepo podle adresy tady NEDELAME. `odhlas_a_odstran` a triggery
  //    v DB jsou zdroj pravdy a zapis do nich bez leada je vysoka sazka; rozhodnuti
  //    patri Martinovi. Tohle je hlidka, ne automatika.
  if ((t === "bounce" || t === "complaint") && !lead_id && !isTest && !prechodnyBounce) {
    await alertNesparovano(admin, t, emailId, adresaZeStopy, String(baseDetail.via ?? ""),
      bounceTyp, sparovanoPodle, adresyZPayloadu);
  }
  return json({ ok: true, type: t, sparovano_podle: sparovanoPodle });
});

// ⚠️ POJISTKA PROTI SMYCCE: alert jde mailem, takze kdyby se odrazil, prisel by dalsi
// webhook, zase nesparovany, a dalsi alert. Proto se posila NEJVYS JEDEN ZA HODINU
// a sam se zapisuje do `email_events` jako `alert_nesparovano` (to je zaroven stopa,
// podle ktere se to da zpetne spocitat).
// deno-lint-ignore no-explicit-any
async function alertNesparovano(
  admin: any, typ: string, emailId: string, adresa: string, via: string, bounceTyp: string,
  duvod: string, doruceno: string[],
): Promise<void> {
  const hodinaZpet = new Date(Date.now() - 3600_000).toISOString();
  const { data: nedavno, error: chybaPojistky } = await admin.from("email_events").select("id")
    .eq("type", "alert_nesparovano").gte("created_at", hodinaZpet).limit(1);
  // ⛔ [R1, S-6] Chyba cteni pojistky NENI "nic se neposlalo". Kdyby se cetla jako false,
  //    vypadne ochrana proti lavine a alerty se muzou sypat. Fail-closed: pri chybe
  //    se alert NEPOSILA, jen se zapise radek. Ticho na jeden pripad je mensi skoda
  //    nez sto mailu Martinovi.
  const uzSlo = chybaPojistky ? true : !!(nedavno && nedavno.length);
  if (chybaPojistky) {
    console.error("[resend-webhook] cteni hodinove pojistky selhalo: " + chybaPojistky.message);
  }

  const { error } = await admin.from("email_events").insert({
    lead_id: null, step: 0, type: "alert_nesparovano",
    detail: { via: "resend-webhook", udalost: typ, provider_id: emailId,
              email: adresa || null, zdrojova_funkce: via || null,
              bounce_typ: bounceTyp || null, duvod, doruceno_na: doruceno.length ? doruceno : null,
              alert_odeslan: !uzSlo, pojistka_necitelna: !!chybaPojistky },
  });
  if (error) console.error("[resend-webhook] zapis alert_nesparovano selhal: " + error.message);
  if (uzSlo || !RESEND_KEY) return;

  let komu = "fitness.barna@gmail.com";
  try {
    const { data } = await admin.from("app_config").select("value").eq("key", "admin_emails").maybeSingle();
    const prvni = [...emailySeznam(data?.value)][0];
    if (prvni) komu = prvni;
  } catch { /* zustava fallback */ }

  const popis = typ === "bounce" ? "odmítnutý mail (bounce)" : "stížnost na spam";
  // ⛔ [R1, S-1] Dva různé důvody, dvě různé rady. „Adresa nesedí" znamená, že se
  //    odrazila kopie (typicky BCC Martinovi), ne mail primárního příjemce; zmrazit
  //    v tom případě klienta by byla škoda na platícím člověku.
  const vysvetleni = duvod === "adresa_nesedi"
    ? "Odrazila se <b>jiná adresa, než na kterou mail mířil</b>. Nejspíš skrytá kopie "
      + "(BCC), takže se schválně nic nezmrazilo: příjemce mail nejspíš dostal v pořádku."
    : "Nepodařilo se ho přiřadit k žádnému kontaktu, takže se sám od sebe nic nezastavilo.";
  const coSTim = duvod === "adresa_nesedi"
    ? "Zkontroluj schránku, na kterou ti chodí kopie. Klientův lead se nechal být."
    : "Najdi tu adresu v adminu a zastav jí maily ručně. Dokud to nikdo neudělá, "
      + "chodí jí všechno dál a kazí to doručitelnost ostatním.";
  await odesliPresResend(RESEND_KEY, {
    from: "Martin Barna <news@martinbarna.cz>",
    to: [komu],
    subject: "🔴 Resend: " + popis + ", který se nepodařilo přiřadit",
    html: `<div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;font-size:15px;line-height:1.55;color:#222;max-width:560px">`
      + `<p>Přišel <b>${popis}</b>. ${vysvetleni}</p>`
      + `<table cellpadding="5" style="border-collapse:collapse;font-size:14px">`
      + `<tr><td style="color:#666">Resend id</td><td><code>${emailId}</code></td></tr>`
      + `<tr><td style="color:#666">Adresa ze stopy</td><td>${adresa || "(žádná)"}</td></tr>`
      + `<tr><td style="color:#666">Odrazilo se na</td><td>${doruceno.length ? doruceno.join(", ") : "(payload adresu neposlal)"}</td></tr>`
      + `<tr><td style="color:#666">Odesílající funkce</td><td>${via || "(neznámá)"}</td></tr>`
      + `<tr><td style="color:#666">Typ bounce</td><td>${bounceTyp || "(nepřišel)"}</td></tr>`
      + `</table>`
      + `<p><b>Co s tím:</b> ${coSTim}</p>`
      + `<p style="font-size:13px;color:#666">Další takový alert přijde nejdřív za hodinu, `
      + `ať se z toho nestane lavina. Všechny případy jsou v <code>email_events</code> `
      + `pod typem <code>alert_nesparovano</code>.</p></div>`,
  });
}
