// ============================================================
// Onboarding koučinkového klienta: JEDNO MÍSTO pro obě cesty (2. 9. 2026).
//
// PROČ TENHLE SOUBOR VZNIKL: do 2. 9. 2026 uměl koučinkového klienta založit jedině
// Martin klikem v adminu (`admin-api`, akce `client_invite`). Od 2. 9. jde koučink
// koupit i rovnou přes Stripe, takže tutéž práci musí umět i `academy-stripe-webhook`.
// Kdyby se to napsalo dvakrát, uvítací mail (a s ním odkaz na vstupní dotazník) by se
// mezi ručním a zaplaceným klientem dřív nebo později rozešel a nikde by to nekřiklo.
// ⛔ Kdo mění uvítací mail koučinku, mění ho TADY. Jinde už není.
//
// ⚠️ Soubor leží v `_shared`, takže se veze s KAŽDÝM deployem obou funkcí
// (`admin-api`, `academy-stripe-webhook`). Nasazuje se dvojice, ne jen `index.ts`.
// ============================================================

// deno-lint-ignore-file no-explicit-any

/** Balíček koučinku. Rozdíl je v ceně a v tom, co je v ní (hovor, Academy, hlasovky). */
export type KoucinkPlan = "gold" | "diamond";

/**
 * Kolik lidí Martin bere najednou. Strop je obchodní rozhodnutí (10 míst), ne technické:
 * když je plno, prodejní strana schová „Koupit hned" a nabídne čekací listinu.
 * ⛔ Strop NEHLÍDÁ platbu. Stripe odkaz zná každý, kdo si ho uložil, takže se přes
 *    naplněnou kapacitu dá zaplatit dál. Proto webhook při překročení posílá alert
 *    a Martin platbu buď vezme, nebo vrátí. Tiše to spolknout by bylo horší.
 */
export const KOUCINK_KAPACITA = 10;

/** Zdroj nároku u nákupu přes Stripe. ⛔ Musí zůstat odlišný od `admin-klient-invite`, jinak nepoznáme, co se prodalo samo. */
export const KOUCINK_SOURCE_STRIPE = "stripe-koucink";

/**
 * Konec zaplaceného období. Počítá se KALENDÁŘNĚ (přičte měsíce), ne po 30 dnech:
 * kdo zaplatí 31. ledna šest měsíců, má mít konec 31. července, ne o pár dní dřív.
 * Přetečení krátkého měsíce (31. 1. + 1 měsíc) JS srovná na 3. 3., proto se den
 * ořízne na poslední den cílového měsíce. Jinak by klient dostal dva dny navíc
 * a datum by nešlo vysvětlit.
 */
export function koucinkExpirace(months: number, od: Date = new Date()): string {
  const m = Math.max(1, Math.round(Number(months) || 0));
  const rok = od.getUTCFullYear();
  const mesic = od.getUTCMonth() + m;
  const posledniDenCile = new Date(Date.UTC(rok, mesic + 1, 0)).getUTCDate();
  const den = Math.min(od.getUTCDate(), posledniDenCile);
  const konec = new Date(Date.UTC(
    rok, mesic, den,
    od.getUTCHours(), od.getUTCMinutes(), od.getUTCSeconds(), od.getUTCMilliseconds(),
  ));
  return konec.toISOString();
}

/** Název balíčku pro doklad, alert a admin. */
export function koucinkNazev(plan: KoucinkPlan, months: number): string {
  const m = Math.max(1, Math.round(Number(months) || 0));
  const slovo = m === 1 ? "měsíc" : (m < 5 ? "měsíce" : "měsíců");
  return `Online koučink ${plan === "diamond" ? "Diamond" : "Gold"} (${m} ${slovo})`;
}

/**
 * Kolik lidí má PRÁVĚ TEĎ aktivní koučink. Počítá se z `entitlements`, protože jiný
 * seznam klientů neexistuje (značky v `customer_contacts` se s nároky dávno rozešly,
 * viz komentář u `clients_list` v admin-api).
 * ⚠️ Propadlý nárok (expires_at v minulosti) se nepočítá: místo je zase volné.
 */
export async function koucinkPocetAktivnich(admin: any): Promise<number> {
  const { data } = await admin
    .from("entitlements")
    .select("email,expires_at")
    .eq("product", "coaching")
    .eq("active", true);
  const ted = Date.now();
  return (data ?? []).filter((r: { expires_at: string | null }) =>
    !r.expires_at || new Date(r.expires_at).getTime() > ted
  ).length;
}

export type OnboardVstup = {
  email: string;
  name?: string;
  /** Vokativ do oslovení („Ahoj Milane,"). Ruční pozvánka ho má z UI, u Stripu bývá prázdný. */
  osloveni?: string;
  /** "novy" = vstupní dotazník, "stavajici" = převod klienta z Excelu do sekce. */
  kind?: "novy" | "stavajici";
  source: string;
  plan?: KoucinkPlan;
  months?: number;
  /** ISO konec zaplaceného období. `undefined` = na sloupec se nesahá (ruční grant bez expirace). */
  expiresAt?: string;
  /** Diamond nového klienta: po 3 zaplacených měsících mu Academy zůstává napořád. Jen příznak pro Martina, žádný automat. */
  academyPo3m?: boolean;
  stripe?: { customer?: string | null; paymentIntent?: string | null };
  resendKey: string;
};

export type OnboardVysledek = {
  ok: boolean;
  entitlement: string;
  app_grant: string;
  mail_status: number;
  priloha: boolean;
};

/**
 * Založí (nebo obnoví) koučinkového klienta a pošle mu uvítací mail.
 * Pořadí je schválně: nejdřív přístup, pak appka, pak mail. Kdyby spadl mail,
 * člověk má aspoň to, co si koupil.
 */
export async function onboardKoucink(admin: any, v: OnboardVstup): Promise<OnboardVysledek> {
  const email = String(v.email).trim().toLowerCase();
  const name = String(v.name ?? "").trim().slice(0, 120);
  const osloveni = String(v.osloveni ?? "").trim().slice(0, 60);
  const kind = v.kind === "stavajici" ? "stavajici" : "novy";

  // ⛔ OPRAVA 27. 7. 2026 (přenesená sem beze změny): `entitlements` NEMÁ sloupec `id`.
  // Klíč je (email, product). `upsert` s onConflict zvládne nového i vracejícího se
  // klienta; dřívější INSERT u vracejícího se tiše selhal a přístup se NEOBNOVIL.
  // ⚠️ `expires_at`, `plan`, `months` se zapisují jen když je volající pošle. Ruční
  // pozvánka expiraci nemá a slepé `null` by ji nemělo čím vyplnit, ale u zaplaceného
  // období by chybějící pole nechalo v řádku STARÉ datum. Proto výslovně, ne `??`.
  const { error: entErr } = await admin.from("entitlements").upsert(
    {
      email,
      product: "coaching",
      active: true,
      source: v.source,
      granted_at: new Date().toISOString(),
      ...(v.expiresAt !== undefined ? { expires_at: v.expiresAt } : {}),
      ...(v.plan ? { plan: v.plan } : {}),
      ...(v.months ? { months: Math.round(v.months) } : {}),
      ...(v.academyPo3m !== undefined ? { academy_po_3m: v.academyPo3m } : {}),
      ...(v.stripe?.customer ? { stripe_customer_id: v.stripe.customer } : {}),
      ...(v.stripe?.paymentIntent ? { stripe_payment_intent: v.stripe.paymentIntent } : {}),
    },
    { onConflict: "email,product" },
  );

  // Koučink klient dostává i appku Tvůj Coach (best-effort, pozvánku to nikdy neshodí).
  // ⚠️ Online koučink a appka jsou DVĚ ODDĚLENÉ SLUŽBY. Jediná spojitost je tahle:
  // klientská sekce webu dává přístup i do appky. Nemíchat je dohromady.
  // tier "ai_basic" = VIP verze appky. Do 26. 7. 2026 se posílalo "diamond", ale
  // `gold` a `diamond` jsou v appce prázdné nálepky: jejich jediné vlastní příznaky
  // `one_on_one` a `voice` nejsou v kódu appky nikde použity, takže reálně dávají totéž.
  // ⛔ Roční limit se koučinkových klientů NETÝKÁ, ten je jen pro Academy (migrace 0077
  // v repu appky větví podle `source`). Proto tady musí zůstat `source: "koucink-klient"`.
  // ⚠️ Expirace appky se ZÁMĚRNĚ neposílá ani u zaplaceného období: `grant_app_access`
  //    si u zdroje `koucink-klient` drží vlastní pravidlo a poslat mu vlastní datum
  //    je změna chování appky, ne webu. Dnes tedy appka klientovi po konci koučinku
  //    zůstává; je to existující dluh (platí i pro ruční granty), ne nová vada.
  let gres = "no-secret";
  try {
    const { data: gs } = await admin.from("app_config").select("value").eq("key", "academy_grant_secret").maybeSingle();
    const gsec = gs?.value ? String(gs.value) : "";
    if (gsec) {
      const r = await fetch("https://kfkmghvhqwqtsalqjmrp.functions.supabase.co/academy-grant", {
        method: "POST", headers: { "Content-Type": "application/json", "x-academy-secret": gsec },
        body: JSON.stringify({ email, action: "grant", tier: "ai_basic", source: "koucink-klient" }),
      }).catch(() => null);
      if (r && r.ok) { const jj: any = await r.json().catch(() => ({})); gres = String(jj.result || "ok"); }
      else gres = r ? "http-" + r.status : "fetch-fail";
    }
    await admin.from("tvujcoach_grants").insert({ email, action: "grant", result: gres, source: "koucink-klient" });
  } catch { /* best-effort, pozvánku neshodí */ }

  // ⛔ OPRAVA 28. 7. 2026: tady dřív stálo `if (cc2 && !cc2.name) update(...)`, tedy
  // jméno se zapsalo JEN když kontakt už existoval. U nově pozvaného klienta žádný
  // neexistuje, takže se jméno TIŠE ZAHODILO a nikde to nekřiklo.
  if (name) {
    const { data: cc2 } = await admin.from("customer_contacts").select("email,name").eq("email", email).maybeSingle();
    if (!cc2) {
      await admin.from("customer_contacts").insert({
        email, name, audience: "customer", source: v.source,
        products: ["coaching"], tags: ["coaching-active"],
      });
    } else if (!cc2.name) {
      await admin.from("customer_contacts").update({ name }).eq("email", email);
    }
  } else {
    // U nákupu přes Stripe jméno běžně neznáme, ale kontakt má vzniknout tak jako tak,
    // jinak klient v CRM chybí a Martin ho nemá kde vidět.
    const { data: cc3 } = await admin.from("customer_contacts").select("email").eq("email", email).maybeSingle();
    if (!cc3) {
      await admin.from("customer_contacts").insert({
        email, audience: "customer", source: v.source,
        products: ["coaching"], tags: ["coaching-active"],
      });
    }
  }

  if (!v.resendKey) {
    return { ok: false, entitlement: entErr ? "chyba: " + entErr.message : "ok", app_grant: gres, mail_status: 0, priloha: false };
  }

  const escd = (s: string) => String(s).replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c] as string));
  const ahoj = osloveni ? "Ahoj " + escd(osloveni) + "," : "Ahoj,";
  const CTA_URL = "https://martinbarna.cz/akademie/prihlaseni/?next=%2Fakademie%2Fklient%2F";
  const btn = (label: string) => `<p style='margin:4px 0 18px'><a href='${CTA_URL}' style='display:inline-block;background:#EBB12C;color:#1A1222;text-decoration:none;padding:13px 26px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;font-size:15px'>${label}</a></p>`;
  const p = (t: string) => `<p style='margin:0 0 14px'>${t}</p>`;
  let subject: string, inner: string;
  if (kind === "stavajici") {
    subject = "Konec Excelu 🎉 Tvoje klientská sekce je tady";
    inner = p(ahoj) +
      p("mám pro tebe upgrade naší spolupráce: od teď máš na mém webu <strong>vlastní klientskou sekci</strong>. Žádné vyplňování Excelu a posílání mailem, všechno na pár kliknutí, i z mobilu.") +
      `<p style='margin:0 0 8px'><strong>Co v ní najdeš:</strong></p><ul style='margin:0 0 14px;padding-left:20px'>` +
      `<li style='margin:0 0 7px'>📊 <strong>Grafy tvého pokroku</strong>: váha, míry, kroky… celá tvoje cesta na jednom místě</li>` +
      `<li style='margin:0 0 7px'>📝 <strong>Pondělní report naklikáš za 3 minuty</strong>, provede tě to krok za krokem a kopie přijde nám oběma</li>` +
      `<li style='margin:0 0 7px'>📁 <strong>Dokumenty ode mě</strong>: všechny podklady pohromadě, žádné hledání v mailech</li>` +
      `<li style='margin:0 0 7px'>📸 <strong>Appka Tvůj Coach v ceně</strong>: vyfotíš jídlo a máš spočítaná makra (coach.martinbarna.cz, stejný e-mail)</li>` +
      `<li style='margin:0 0 7px'>🎬 <strong>Videokurz (182 videí)</strong> máš v ceně koučinku</li>` +
      `<li style='margin:0 0 7px'>🎓 <strong>Sleva 20 % na Barna Academy</strong> s kódem <strong>KLIENT20</strong>, jen pro mé klienty</li></ul>` +
      p("<strong>Jak dovnitř:</strong> přihlas se tímhle e-mailem (na který ti píšu) a přístup naskočí automaticky:") +
      btn("Otevřít moji sekci") +
      p("<strong>Be Effective!</strong><br>Martin") +
      `<p style='margin:16px 0 0;color:#A09AAD;font-style:italic;font-size:14px'>P.S. V příloze máš jednostránkový návod (najdeš ho i ve své sekci mezi Dokumenty). Kdyby cokoliv drhlo, odepiš a vyřešíme to spolu.</p>`;
  } else {
    subject = "Vítej v týmu 💪 První krok: 10 minut o tobě";
    inner = p(ahoj) +
      p("vítej v koučinku! Od teď na tvé formě pracujeme spolu. A aby byl plán od prvního dne přesně na tebe, potřebuju tě nejdřív poznat.") +
      p("Připravil jsem <strong>vstupní dotazník</strong>. Proklikáš ho krok za krokem za ~10 minut (cíle, zdraví, co rád jíš, kdy stíháš trénovat…). Nic se nedá zkazit, všechno jde později upravit:") +
      btn("Vyplnit vstupní dotazník") +
      `<p style='margin:0 0 8px'><strong>Co bude dál:</strong></p><ul style='margin:0 0 14px;padding-left:20px'>` +
      `<li style='margin:0 0 7px'>1️⃣ Do <strong>48 hodin</strong> ti nastavím jídelníček, makra a trénink na míru</li>` +
      `<li style='margin:0 0 7px'>2️⃣ Každé <strong>pondělí ráno</strong> ti přijde připomínka na týdenní report (3 minuty klikání)</li>` +
      `<li style='margin:0 0 7px'>3️⃣ Já každý report projdu, upravím plán a ozvu se ti</li></ul>` +
      p("Ve tvé sekci najdeš i <strong>videokurz zdarma</strong> (182 videí), <strong>appku Tvůj Coach</strong> na zapisování jídla (vyfotíš a máš makra), dokumenty ode mě a grafy pokroku, které spolu budeme plnit.") +
      p("<strong>Be Effective!</strong><br>Martin");
  }
  const html = `<!doctype html><html lang='cs'><head><meta charset='utf-8'><meta name='color-scheme' content='dark'></head><body style='margin:0;padding:0;background:#0C0B10'>` +
    `<table role='presentation' width='100%' cellpadding='0' cellspacing='0' border='0' bgcolor='#0C0B10'><tr><td align='center' style='padding:16px'>` +
    `<table role='presentation' width='560' cellpadding='0' cellspacing='0' border='0' bgcolor='#181520' style='width:100%;max-width:560px;background:#181520;border-radius:2px;border:1px solid #262232'><tr><td style='padding:28px;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;font-size:16px;line-height:1.55;color:#F0EADF'>` +
    `<div style='border-left:3px solid #EBB12C;padding-left:10px;font-weight:800;font-size:13px;letter-spacing:.2em;text-transform:uppercase;color:#EBB12C;margin:0 0 20px'>Martin Barna</div>` +
    inner +
    `<hr style='border:none;border-top:1px solid #262232;margin:22px 0 14px'><div style='font-size:12px;color:#8F8A99'>Martin Barna · martinbarna.cz · osobní mail pro klienty koučinku</div>` +
    `</td></tr></table></td></tr></table></body></html>`;

  // návod PDF ze sdílených dokumentů jako příloha (best effort, bez něj mail stejně odejde)
  let attachments: { filename: string; content: string }[] | undefined;
  try {
    const { data: pdf } = await admin.storage.from("client-docs").download("shared/klientska-sekce-navod.pdf");
    if (pdf) {
      const buf = new Uint8Array(await pdf.arrayBuffer());
      let bin = "";
      for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
      attachments = [{ filename: "klientska-sekce-navod.pdf", content: btoa(bin) }];
    }
  } catch (_e) { /* příloha je bonus */ }

  const rs = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${v.resendKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "Martin Barna <news@martinbarna.cz>", to: [email], subject, html,
      reply_to: "martin@martinbarna.cz", bcc: ["fitness.barna@gmail.com"],
      ...(attachments ? { attachments } : {}),
    }),
  });

  return {
    ok: rs.status === 200,
    entitlement: entErr ? "chyba: " + entErr.message : "ok",
    app_grant: gres,
    mail_status: rs.status,
    priloha: !!attachments,
  };
}
