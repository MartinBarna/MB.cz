// =============================================================================
// Testovatelné JÁDRO funkce `grant-videokurz-z-appky` (DI, bez Deno a bez sítě).
//
// CO TO JE: appka Tvůj Coach sem po první platbě VIP pošle e-mail, user_id,
// tier, interval, event_id a subscription_id. Tady se udělí doživotní přístup
// k videokurzu v Academy (`entitlements`) a složí se uvítací mail. Vodovod
// (HTTP, DB, Resend) je v `index.ts`.
//
// ⛔ PROČ NOVÁ FUNKCE, A NE ROZŠÍŘENÍ `app-purchase-bridge`: most nákupů řeší
//    affiliate provizi a tichý bonus. Tenhle endpoint má JEDNU práci: přístup
//    + mail. Mail žije tady v kódu, ne v `email_templates`, protože UPDATE
//    šablony = rozeslání (drip běží každou hodinu).
//
// ⛔ NEPOSLOUCHÁ STRIPE. Vstup je server-to-server hovor ověřený secretem.
//    Stripe eventy appky zpracovává webhook APPKY; sem se posílá až výsledek.
//    TC volá až po úspěchu `app-purchase-bridge` (pořadí drží appka).
// =============================================================================

export class GrantError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

/** Výchozí zdroj v `entitlements` (měsíční VIP, Basic). */
export const SOURCE = "appka-vip";

/**
 * Roční VIP. Stejná konvence jako `app-purchase-bridge` (`BONUS_SOURCE`).
 * `daily-digest` hlídá balíček 349 jen u `source='rocni-vip-bonus'`.
 */
export const SOURCE_ROCNI = "rocni-vip-bonus";

/**
 * Tiché bonusy z živého `app-purchase-bridge` v5. Člověk už videokurz MÁ, ale
 * uvítací mail o přístupu mu nikdo neposlal (trigger bere jen `admin-panel`).
 * Řádek se NEPŘEPISUJE (`rocni-vip-bonus` čte daily-digest), jen se doplní mail.
 *
 * `prvni-platba-bonus` sem patří proto, že ho most nákupů umí zapsat. Tahle
 * funkce ho sama nezapisuje.
 */
export const TICHE_BONUSY = ["prvni-platba-bonus", SOURCE_ROCNI, SOURCE];

/** Produkty, které videokurz odemykají samy (`has_entitlement`). */
export const PRODUKTY_S_KURZEM = ["videokurz", "academy", "coaching"];

export const VIDEA_KURZU = 182;
export const LOGIN_PATH =
  "https://martinbarna.cz/akademie/prihlaseni/?tab=up&email=";
export const LOGIN_NEXT = "&next=/akademie/videokurz/";
export const NAVOD_URL = "https://martinbarna.cz/akademie/navod/";
export const SITE = "https://martinbarna.cz";

const PLAN_CS: Record<string, string> = { basic: "Basic", ai_basic: "VIP" };

export type GrantPayload = {
  email?: unknown;
  buyer_email?: unknown;
  user_id?: unknown;
  name?: unknown;
  subscription_id?: unknown;
  event_id?: unknown;
  tier?: unknown;
  interval?: unknown;
};

export type EntitlementRow = {
  email?: string;
  product: string;
  active: boolean;
  expires_at: string | null;
  source: string | null;
};

export type LeadRow = {
  id: string;
  name: string | null;
  unsubscribe_token: string;
};

export type GrantDeps = {
  najdiEntitlementy: (email: string) => Promise<EntitlementRow[]>;
  udelEntitlement: (row: Record<string, unknown>) => Promise<void>;
  najdiLeada: (email: string) => Promise<LeadRow | null>;
  zalozLeada: (email: string, name: string | null) => Promise<LeadRow>;
  uzVideliEvent: (eventId: string) => Promise<boolean>;
  uzOdeslanMail: (email: string) => Promise<boolean>;
  posliMail: (args: {
    to: string;
    subject: string;
    html: string;
    text: string;
    unsub: string;
  }) => Promise<string>;
  zalogujOdeslani: (args: {
    leadId: string;
    providerId: string;
    email: string;
    userId: string;
    eventId: string;
    subscriptionId: string;
  }) => Promise<void>;
  /** Stopa skipu (bez mailu), ať stejný event_id podruhé vrátí duplicate:true. */
  zaznamPreskoceni: (args: { eventId: string; grant: string }) => Promise<void>;
  alert: (predmet: string, detail: Record<string, unknown>) => Promise<void>;
  now: () => Date;
  unsubUrl: (token: string) => string;
};

export type GrantResult = {
  ok: true;
  grant: string;
  mail: string;
  duplicate?: true;
};

function text(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

export function normalizujEmail(body: GrantPayload): string {
  const raw = text(body.email) || text(body.buyer_email);
  return raw.toLowerCase();
}

export function jePlatnyEmail(email: string): boolean {
  return Boolean(email) && email.includes("@") && email.length <= 320;
}

/**
 * ILIKE bere `_` a `%` jako wildcards. Na `a_b@…` by to mohlo trefit cizí řádek.
 * Backslash je v Postgresu výchozí escape znak LIKE.
 */
export function escapeIlikeExact(email: string): string {
  return email.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

export function parseTier(v: unknown): "basic" | "ai_basic" | "" {
  const t = text(v);
  if (t === "basic" || t === "ai_basic") return t;
  return "";
}

export function parseInterval(v: unknown): "month" | "year" | "" {
  const t = text(v);
  if (t === "month" || t === "year") return t;
  return "";
}

/** Jméno plánu do mailu. Basic nesmí dostat „máš VIP". */
export function nazevPlanu(tier: string): string {
  return PLAN_CS[tier] ?? "předplatné";
}

/**
 * Zdroj entitlementu. Roční VIP drží `rocni-vip-bonus`, ať daily-digest
 * pořád vidí frontu balíčku 349 (stejně jako `app-purchase-bridge`).
 */
export function sourceEntitlementu(tier: string, interval: string): string {
  if (tier === "ai_basic" && interval === "year") return SOURCE_ROCNI;
  return SOURCE;
}

/** Když v DB leží jiná velikost písmen, upsert musí trefit tentýž UNIQUE(email, product). */
export function emailProZapis(rows: EntitlementRow[], fallback: string): string {
  const vk = rows.find((r) => r.product === "videokurz" && r.email);
  if (vk?.email) return vk.email;
  const any = rows.find((r) => r.email);
  return any?.email || fallback;
}

export function jePristupPlatny(row: EntitlementRow, now: Date): boolean {
  if (!row.active) return false;
  if (!row.expires_at) return true;
  const konec = Date.parse(row.expires_at);
  if (!Number.isFinite(konec)) return true;
  return konec > now.getTime();
}

export function jeTichyBonus(source: string | null): boolean {
  return TICHE_BONUSY.includes(String(source ?? ""));
}

export type Rozhodnuti =
  | { akce: "preskoc"; grant: string; mail: "neposilat" }
  | { akce: "jen-mail"; grant: string }
  | { akce: "udelit" };

/**
 * Co s tímhle člověkem. Čistá funkce, ať jde otestovat bez DB.
 *
 * Pořadí je závazné:
 *  1. Academy / koučink s platným přístupem = kurz už vidí. Mail by lhal.
 *  2. Videokurz s active=false = vědomé odebrání. Nesahat (alert je ve vodovodu).
 *  3. Platný videokurz z cizího titulu = už ho má, nic.
 *  4. Platný videokurz z tichého bonusu = mail, řádek nechat.
 *  5. Jinak udělit (i když má vypršelý).
 *
 * Idempotence PLATBY (event_id) je nad tímhle: stejný event se sem vůbec
 * nedostane. „Už má kurz" je jen druhá pojistka.
 *
 * Vědomé riziko (šéf 20. 8.): event_id se do sent logu zapisuje AŽ po Resendu.
 * Když mail odejde a log spadne (503), retry s NOVÝM event_id (invoice.paid
 * z TC) stopu nenajde. SOURCE je v TICHE_BONUSY, takže rozhodni → jen-mail
 * a mail smí jít podruhé. Duplicitu hlídá event_id (sent log) + „už má kurz".
 * Žádný insert před Resendem, žádný outbox.
 */
export function rozhodni(
  rows: EntitlementRow[],
  now: Date,
): Rozhodnuti {
  const academy = rows.find((r) => r.product === "academy");
  if (academy && jePristupPlatny(academy, now)) {
    return { akce: "preskoc", grant: "uz-mel-academy", mail: "neposilat" };
  }
  const coaching = rows.find((r) => r.product === "coaching");
  if (coaching && jePristupPlatny(coaching, now)) {
    return { akce: "preskoc", grant: "uz-mel-coaching", mail: "neposilat" };
  }

  const vk = rows.find((r) => r.product === "videokurz");
  if (!vk) return { akce: "udelit" };

  if (!vk.active) {
    return { akce: "preskoc", grant: "odebrana-nesahat", mail: "neposilat" };
  }
  if (!jePristupPlatny(vk, now)) return { akce: "udelit" };

  if (jeTichyBonus(vk.source)) {
    return { akce: "jen-mail", grant: "uz-mel-tichy-bonus" };
  }
  return { akce: "preskoc", grant: "uz-mel", mail: "neposilat" };
}

export function radekEntitlementu(
  email: string,
  now: Date,
  subscriptionId: string,
  source: string = SOURCE,
): Record<string, unknown> {
  return {
    email,
    product: "videokurz",
    active: true,
    source,
    granted_at: now.toISOString(),
    expires_at: null,
    ...(subscriptionId ? { stripe_subscription_id: subscriptionId } : {}),
  };
}

const NL = "\n";
const DQ = '"';

export function esc(s: string): string {
  return s.split("&").join("&amp;").split("<").join("&lt;").split(">").join("&gt;")
    .split(DQ).join("&quot;");
}

const VOK_EXC: Record<string, string> = {
  jan: "Jane",
  pavel: "Pavle",
  karel: "Karle",
  zdenek: "Zdenku",
  "zdeněk": "Zdeňku",
  josef: "Josefe",
};
const VOK_VW = "aeiouyáéěíóúůý";
const VOK_FEM = new Set([
  "dagmar", "ester", "miriam", "mirjam", "ingrid", "karin", "katrin",
  "kristin", "kirsten", "nikol", "nicol", "doris", "iris", "ines", "agnes",
  "ruth", "elen", "ellen", "helen", "karen", "sharon", "megan", "vivien",
  "evelin", "marlen", "carmen", "dolores", "mercedes", "rachel",
]);

function vokativ(fn: string): string {
  if (!fn) return fn;
  const low = fn.toLowerCase();
  if (low in VOK_EXC) return VOK_EXC[low];
  const last = low.slice(-1);
  if (last === "a") return fn.slice(0, -1) + "o";
  if (VOK_VW.includes(last)) return fn;
  if (VOK_FEM.has(low)) return fn;
  if (low.endsWith("ek")) return fn.slice(0, -2) + "ku";
  if (low.endsWith("ch") || "kgh".includes(last)) return fn + "u";
  if ("szxj".includes(last) || "šžč".includes(last)) return fn + "i";
  if (low.endsWith("el")) return fn + "i";
  if (last === "r") {
    return VOK_VW.includes(low.slice(-2, -1)) ? fn + "e" : fn.slice(0, -1) + "ře";
  }
  if ("bdflmnptvw".includes(last)) return fn + "e";
  return fn;
}

export function firstName(name: string): string {
  const t = (name || "").trim().split(" ").filter((x) => x.length > 0)[0] || "";
  return vokativ(t ? t.charAt(0).toUpperCase() + t.slice(1) : "");
}

export function loginUrl(email: string): string {
  return LOGIN_PATH + encodeURIComponent(email) + LOGIN_NEXT;
}

/**
 * Text schválil Martin 20. 8. 2026 (nárok má JEN VIP, viz `index.ts`).
 * Zrcadlo `videokurzWelcomeMailDraft` z TC (182 videí, bez cen).
 * HTML drží drip wrap; plaintext má diakritiku jako TC verze.
 * ⛔ `nazevPlanu` schválně zvládne i `basic`: kdyby se gating v TC někdy
 *    rozšířil, mail nesmí nikomu tvrdit „máš VIP", když VIP nemá.
 */
export function buildMail(
  email: string,
  name: string,
  unsub: string,
  tier: string = "",
): {
  subject: string;
  preheader: string;
  html: string;
  text: string;
} {
  const fn = firstName(name);
  const plan = nazevPlanu(tier);
  const hi = "Ahoj" + (fn ? ", " + esc(fn) : "") + ",";
  const btn = loginUrl(email);
  const subject = "Máš ode mě videokurz výživy (přístup je aktivní)";
  const preheader =
    "Stačí se jednou přihlásit. Návod je uvnitř, přístup už máš.";

  const body =
    `<p style='margin:0 0 14px'>${hi}</p>` +
    `<p style='margin:0 0 14px'>v appce Tvůj Coach máš ${esc(plan)}, a k tomu jsem ti otevřel i <strong>videokurz výživy</strong>. Přístup je už aktivní, nic dalšího řešit nemusíš.</p>` +
    `<p style='margin:0 0 14px'>Čeká na tebe všech <strong>${VIDEA_KURZU} video lekcí</strong> plus přílohy ke stažení. Koukáš kdy chceš, na mobilu i na počítači.</p>` +
    `<p style='margin:0 0 10px'><strong>Jak se dostaneš dovnitř</strong> (zabere minutu):</p>` +
    `<ol style='margin:0 0 18px;padding-left:20px'>` +
      `<li style='margin:0 0 7px'>Klikni na tlačítko níž. Otevře se registrace s předvyplněným e-mailem.</li>` +
      `<li style='margin:0 0 7px'>Dej <strong>„Vytvořit účet“</strong> a zvol si heslo. Registruj se přesně e-mailem <strong>${esc(email)}</strong>. Podle něj tě systém pozná a kurz odemkne.</li>` +
      `<li style='margin:0 0 7px'>Hotovo. Jsi uvnitř.</li>` +
    `</ol>` +
    `<p style='margin:4px 0 18px'><a class='mb-btn' href='${esc(btn)}' style='display:inline-block;background:#EBB12C;color:#1A1222;text-decoration:none;padding:14px 26px;border-radius:0;font-weight:700;text-transform:uppercase;letter-spacing:.05em'>Vytvořit účet a začít</a></p>` +
    `<p class='mb-ps' style='margin:0 0 14px;font-size:14px;color:#A09AAD'>Nevíš si rady? Mám <a class='mb-link' href='${esc(NAVOD_URL)}' style='color:#F6CD63'>návod krok za krokem</a>. A kdyby cokoliv zlobilo, stačí odepsat na tenhle e-mail.</p>` +
    `<p style='margin:16px 0 0'>Be Effective!<br>Martin</p>` +
    `<p class='mb-ps' style='margin:16px 0 0;color:#A09AAD;font-style:italic'>P.S. Účet zakládej přesně na <strong>${esc(email)}</strong>. Jiný e-mail by kurz neodemkl.</p>`;

  const footerHtml =
    `Tento e-mail ti přišel, protože máš ${esc(plan)} v appce Tvůj Coach a k němu videokurz výživy.<br>` +
    `Nechceš už e-maily? <a class='mb-mut' href='${esc(unsub)}' style='color:#8F8A99'>Odhlásit se jedním klikem</a>.<br>` +
    `Martin Barna, online výživový Coach · <a class='mb-mut' href='${esc(SITE)}' style='color:#8F8A99'>martinbarna.cz</a>`;

  const html =
    `<!doctype html><html lang='cs'><head><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'><meta name='color-scheme' content='light dark'><meta name='supported-color-schemes' content='light dark'>` +
    `<style>` +
    `:root{color-scheme:light dark;supported-color-schemes:light dark}` +
    `@media (prefers-color-scheme: dark){` +
    `.mb-bg{background:#0C0B10!important}` +
    `.mb-card{background:#181520!important}` +
    `.mb-body{color:#F0EADF!important}` +
    `.mb-brand{color:#EBB12C!important;border-left-color:#EBB12C!important}` +
    `.mb-btn{background:#EBB12C!important;color:#1A1222!important}` +
    `.mb-mut{color:#8F8A99!important}` +
    `.mb-ps{color:#A09AAD!important}` +
    `.mb-link{color:#F6CD63!important}` +
    `}` +
    `[data-ogsc] .mb-bg,[data-ogsb] .mb-bg{background:#0C0B10!important}` +
    `[data-ogsc] .mb-card,[data-ogsb] .mb-card{background:#181520!important}` +
    `[data-ogsc] .mb-body,[data-ogsb] .mb-body{color:#F0EADF!important}` +
    `[data-ogsc] .mb-brand,[data-ogsb] .mb-brand{color:#EBB12C!important;border-left-color:#EBB12C!important}` +
    `[data-ogsc] .mb-btn,[data-ogsb] .mb-btn{background:#EBB12C!important;color:#1A1222!important}` +
    `[data-ogsc] .mb-mut,[data-ogsb] .mb-mut{color:#8F8A99!important}` +
    `[data-ogsc] .mb-ps,[data-ogsb] .mb-ps{color:#A09AAD!important}` +
    `[data-ogsc] .mb-link,[data-ogsb] .mb-link{color:#F6CD63!important}` +
    `</style></head>` +
    `<body class='mb-bg' style='margin:0;padding:0;background:#0C0B10'>` +
    `<span style='display:none!important;opacity:0;color:transparent;height:0;width:0;overflow:hidden'>${esc(preheader)}</span>` +
    `<table role='presentation' class='mb-bg' width='100%' cellpadding='0' cellspacing='0' border='0' bgcolor='#0C0B10' style='background:#0C0B10'><tr><td align='center' style='padding:16px'>` +
    `<table role='presentation' class='mb-card' width='560' cellpadding='0' cellspacing='0' border='0' bgcolor='#181520' style='width:100%;max-width:560px;background:#181520;border-radius:2px;border:1px solid #262232'><tr><td class='mb-body' style='padding:28px;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;font-size:16px;line-height:1.55;color:#F0EADF'>` +
    `<div class='mb-brand' style='border-left:3px solid #EBB12C;padding-left:10px;font-weight:800;font-size:13px;letter-spacing:.2em;text-transform:uppercase;color:#EBB12C;margin:0 0 20px'>Martin Barna</div>` +
    body +
    `<hr style='border:none;border-top:1px solid #262232;margin:22px 0 14px'>` +
    `<div class='mb-mut' style='font-size:12px;line-height:1.5;color:#8F8A99'>${footerHtml}</div>` +
    `</td></tr></table></td></tr></table></body></html>`;

  const hiText = "Ahoj" + (fn ? ", " + fn : "") + ",";
  const text =
    hiText + NL + NL +
    "v appce Tvůj Coach máš " + plan + ", a k tomu jsem ti otevřel i videokurz výživy. " +
    "Přístup je už aktivní, nic dalšího řešit nemusíš." + NL + NL +
    "Čeká na tebe všech " + VIDEA_KURZU + " video lekcí plus přílohy ke stažení. Koukáš kdy chceš, " +
    "na mobilu i na počítači." + NL + NL +
    "Jak se dostaneš dovnitř:" + NL +
    "1) Otevři: " + btn + NL +
    "2) Dej Vytvořit účet a zvol si heslo. Registruj se přesně e-mailem " + email + "." + NL +
    "3) Hotovo. Jsi uvnitř." + NL + NL +
    "Návod krok za krokem: " + NAVOD_URL + NL + NL +
    "Be Effective!" + NL + "Martin" + NL + NL +
    "P.S. Účet zakládej přesně na " + email + ". Jiný e-mail by kurz neodemkl." + NL + NL +
    "----------------------------------------" + NL +
    "Tento e-mail ti přišel, protože máš " + plan + " v appce Tvůj Coach a k němu videokurz výživy." + NL +
    "Odhlásit se jedním klikem: " + unsub + NL +
    "Martin Barna · martinbarna.cz";

  return { subject, preheader, html, text };
}

export async function handleGrant(
  body: GrantPayload,
  deps: GrantDeps,
): Promise<GrantResult> {
  const email = normalizujEmail(body);
  if (!jePlatnyEmail(email)) {
    throw new GrantError("Chybí platný email.", 400);
  }
  const userId = text(body.user_id);
  if (!userId) {
    throw new GrantError("Chybí user_id.", 400);
  }
  const eventId = text(body.event_id);
  if (!eventId) {
    throw new GrantError("Chybí event_id.", 400);
  }
  const subId = text(body.subscription_id);
  const tier = parseTier(body.tier);
  const interval = parseInterval(body.interval);
  const jmenoZTela = text(body.name);
  const now = deps.now();
  const source = sourceEntitlementu(tier, interval);

  if (await deps.uzVideliEvent(eventId)) {
    return { ok: true, grant: "uz-viden", mail: "neposilat", duplicate: true };
  }

  const rows = await deps.najdiEntitlementy(email);
  const d = rozhodni(rows, now);
  const zapisEmail = emailProZapis(rows, email);

  if (d.akce === "preskoc") {
    if (d.grant === "odebrana-nesahat") {
      await deps.alert("🔴 Appka: videokurz je ODEBRANÝ, nová platba kurz nedostala", {
        email: zapisEmail,
        user_id: userId,
        event_id: eventId,
        subscription_id: subId || "-",
        tier: tier || "-",
        interval: interval || "-",
        co_delat: "Zkontroluj, jestli je to storno nebo ruční zákaz. Když má nová platba nárok, vrať active=true ručně a pošli přístupový mail.",
      });
    }
    try {
      await deps.zaznamPreskoceni({ eventId, grant: d.grant });
    } catch {
      /* best-effort: bez stopy se stejný event_id jen znovu přeskočí */
    }
    return { ok: true, grant: d.grant, mail: d.mail };
  }

  if (d.akce === "udelit") {
    try {
      await deps.udelEntitlement(radekEntitlementu(zapisEmail, now, subId, source));
    } catch (e) {
      await deps.alert("🔴 Appka: videokurz se NEUDĚLIL", {
        email: zapisEmail,
        user_id: userId,
        event_id: eventId,
        tier: tier || "-",
        interval: interval || "-",
        source,
        chyba: String(e).slice(0, 200),
        co_delat: "Uděl videokurz ručně v adminu (source " + source + ") a pošli mu přístupový mail.",
      });
      throw new GrantError("grant failed", 500);
    }
  }

  if (await deps.uzOdeslanMail(email)) {
    return {
      ok: true,
      grant: d.akce === "udelit" ? "udelen" : d.grant,
      mail: "uz-odeslan",
    };
  }

  let lead = await deps.najdiLeada(email);
  if (!lead) {
    lead = await deps.zalozLeada(email, jmenoZTela || null);
  }
  const jmeno = jmenoZTela || lead.name || "";
  const unsub = deps.unsubUrl(lead.unsubscribe_token);
  const m = buildMail(email, jmeno, unsub, tier);

  try {
    const providerId = await deps.posliMail({
      to: email,
      subject: m.subject,
      html: m.html,
      text: m.text,
      unsub,
    });
    await deps.zalogujOdeslani({
      leadId: lead.id,
      providerId,
      email,
      userId,
      eventId,
      subscriptionId: subId,
    });
    return {
      ok: true,
      grant: d.akce === "udelit" ? "udelen" : d.grant,
      mail: d.akce === "udelit" ? "odeslan" : "doplnen",
    };
  } catch (e) {
    // 503 záměrně. TC flag nezapisuje a zopakuje grant na dalším invoice.paid
    // s novým event_id. Když Resend prošel a padl jen log, tenhle catch pořád
    // hodí 503 a retry smí poslat mail znovu (vědomé riziko výše u rozhodni).
    await deps.alert("🔴 Appka: videokurz udělen, ale MAIL NEODESLAL", {
      email,
      user_id: userId,
      event_id: eventId,
      chyba: String(e).slice(0, 200),
      co_delat: "Přístup má. Webhook dostane 503 a zopakuje mail. Když se to točí, pošli mu mail ručně (odkaz /akademie/prihlaseni/?tab=up).",
    });
    throw new GrantError("mail failed", 503);
  }
}
