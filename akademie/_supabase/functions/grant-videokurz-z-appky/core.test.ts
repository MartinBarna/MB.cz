// Testy jádra grant-videokurz-z-appky.
// Spuštění: npx --yes deno@2 run akademie/_supabase/functions/grant-videokurz-z-appky/core.test.ts
// (bez --allow-*: test nečte síť, disk ani proměnné prostředí)
import {
  GrantError,
  PRODUKTY_S_KURZEM,
  SOURCE,
  SOURCE_ROCNI,
  TICHE_BONUSY,
  VIDEA_KURZU,
  buildMail,
  emailProZapis,
  firstName,
  handleGrant,
  jePlatnyEmail,
  jePristupPlatny,
  jeTichyBonus,
  loginUrl,
  nazevPlanu,
  normalizujEmail,
  parseInterval,
  parseTier,
  radekEntitlementu,
  rozhodni,
  sourceEntitlementu,
  escapeIlikeExact,
  type EntitlementRow,
  type GrantDeps,
} from "./core.ts";

import { ZDROJE_BONUS_APPKA } from "../academy-stripe-webhook/refund-bonus.ts";

let selhalo = 0;
function check(nazev: string, podminka: boolean, detail = ""): void {
  if (podminka) {
    console.log("  ok   " + nazev);
  } else {
    selhalo++;
    console.log("  FAIL " + nazev + (detail ? "  [" + detail + "]" : ""));
  }
}

const NOW = new Date("2026-08-19T19:00:00.000Z");

function vk(opts: Partial<EntitlementRow> = {}): EntitlementRow {
  return {
    product: "videokurz",
    active: true,
    expires_at: null,
    source: "stripe-videokurz",
    ...opts,
  };
}

type Stav = {
  entitlementy: Record<string, unknown>[];
  maily: { to: string; subject: string; text?: string; html?: string }[];
  logy: { eventId: string; subscriptionId: string }[];
  alerty: { predmet: string }[];
  leady: number;
  preskoceni: string[];
};

function mock(opts: {
  rows?: EntitlementRow[];
  lead?: { id: string; name: string | null; unsubscribe_token: string } | null;
  uzMail?: boolean;
  uzEvent?: boolean;
  grantSpadne?: boolean;
  mailSpadne?: boolean;
  logSpadne?: boolean;
  jmenoLeada?: string | null;
} = {}): { deps: GrantDeps; stav: Stav } {
  const stav: Stav = { entitlementy: [], maily: [], logy: [], alerty: [], leady: 0, preskoceni: [] };
  const seenEvents = new Set<string>();
  let lead = opts.lead === undefined
    ? { id: "L1", name: opts.jmenoLeada ?? "Martin Test", unsubscribe_token: "tok-1" }
    : opts.lead;
  const deps: GrantDeps = {
    najdiEntitlementy: () => Promise.resolve(opts.rows ?? []),
    udelEntitlement: (row) => {
      if (opts.grantSpadne) throw new Error("db: grant spadl");
      stav.entitlementy.push(row);
      return Promise.resolve();
    },
    najdiLeada: () => Promise.resolve(lead),
    zalozLeada: (_email, name) => {
      stav.leady++;
      lead = { id: "Lnew", name, unsubscribe_token: "tok-new" };
      return Promise.resolve(lead);
    },
    uzVideliEvent: (eventId) => Promise.resolve(Boolean(opts.uzEvent) || seenEvents.has(eventId)),
    uzOdeslanMail: () => Promise.resolve(Boolean(opts.uzMail)),
    posliMail: ({ to, subject, text, html }) => {
      if (opts.mailSpadne) throw new Error("resend_500");
      stav.maily.push({ to, subject, text, html });
      return Promise.resolve("re_1");
    },
    zalogujOdeslani: (args) => {
      if (opts.logSpadne) throw new Error("log: PostgREST padl");
      stav.logy.push({ eventId: args.eventId, subscriptionId: args.subscriptionId });
      return Promise.resolve();
    },
    zaznamPreskoceni: ({ eventId }) => {
      seenEvents.add(eventId);
      stav.preskoceni.push(eventId);
      return Promise.resolve();
    },
    alert: (predmet) => {
      stav.alerty.push({ predmet });
      return Promise.resolve();
    },
    now: () => NOW,
    unsubUrl: (token) => "https://example.test/unsub?token=" + token,
  };
  return { deps, stav };
}

const TELO = {
  email: "Kupujici@Example.com",
  user_id: "u-tc-1",
  name: "Jana Nováková",
  subscription_id: "sub_1",
  event_id: "evt_1",
  tier: "ai_basic",
  interval: "month",
};

async function main(): Promise<void> {
  console.log("\n== grant-videokurz-z-appky: jádro ==");

  check("e-mail: normalizace na malá písmena",
    normalizujEmail({ email: "A@B.CZ" }) === "a@b.cz");
  check("e-mail: bere i buyer_email",
    normalizujEmail({ buyer_email: "A@B.CZ" }) === "a@b.cz");
  check("e-mail: platný", jePlatnyEmail("a@b.cz"));
  check("e-mail: bez zavináče ne", !jePlatnyEmail("ab.cz"));
  check("e-mail: prázdný ne", !jePlatnyEmail(""));

  check("tier: basic", parseTier("basic") === "basic");
  check("tier: ai_basic", parseTier("ai_basic") === "ai_basic");
  check("tier: cizí prázdný", parseTier("gold") === "");
  check("interval: year", parseInterval("year") === "year");
  check("interval: null prázdný", parseInterval(null) === "");
  check("plán: Basic", nazevPlanu("basic") === "Basic");
  check("plán: VIP", nazevPlanu("ai_basic") === "VIP");
  check("plán: neznámý = předplatné", nazevPlanu("") === "předplatné");

  check("source: měsíční VIP = appka-vip",
    sourceEntitlementu("ai_basic", "month") === SOURCE);
  check("source: roční VIP = rocni-vip-bonus",
    sourceEntitlementu("ai_basic", "year") === SOURCE_ROCNI);
  check("source: roční Basic NENÍ rocni-vip-bonus",
    sourceEntitlementu("basic", "year") === SOURCE);
  check("source: měsíční Basic = appka-vip",
    sourceEntitlementu("basic", "month") === SOURCE);

  check("zápis e-mailu: bere casing z videokurzu",
    emailProZapis([vk({ email: "Jana@Seznam.cz" })], "jana@seznam.cz") === "Jana@Seznam.cz");
  check("zápis e-mailu: fallback když řádek casing nemá",
    emailProZapis([vk()], "a@b.cz") === "a@b.cz");

  check("platný: active + bez expirace",
    jePristupPlatny(vk(), NOW));
  check("platný: active=false ne",
    !jePristupPlatny(vk({ active: false }), NOW));
  check("platný: expirace v minulosti ne",
    !jePristupPlatny(vk({ expires_at: "2026-08-01T00:00:00.000Z" }), NOW));
  check("platný: expirace v budoucnosti ano",
    jePristupPlatny(vk({ expires_at: "2026-09-01T00:00:00.000Z" }), NOW));

  check("tichý bonus: prvni-platba-bonus", jeTichyBonus("prvni-platba-bonus"));
  check("tichý bonus: rocni-vip-bonus", jeTichyBonus(SOURCE_ROCNI));
  check("tichý bonus: vlastní source", jeTichyBonus(SOURCE));
  check("tichý bonus: koupený ne", !jeTichyBonus("stripe-videokurz"));
  check("konstanta TICHE_BONUSY drží daily-digest zdroj",
    TICHE_BONUSY.includes(SOURCE_ROCNI));
  check("PRODUKTY_S_KURZEM má videokurz i academy",
    PRODUKTY_S_KURZEM.includes("videokurz") && PRODUKTY_S_KURZEM.includes("academy"));

  check("rozhodni: prázdno → udělit", rozhodni([], NOW).akce === "udelit");
  {
    const d = rozhodni([{ product: "academy", active: true, expires_at: null, source: "stripe-lifetime" }], NOW);
    check("rozhodni: academy → přeskoč", d.akce === "preskoc");
  }
  {
    const d = rozhodni([{ product: "coaching", active: true, expires_at: null, source: "rucne" }], NOW);
    check("rozhodni: coaching → přeskoč", d.akce === "preskoc" && d.grant === "uz-mel-coaching");
  }
  {
    const d = rozhodni([vk({ active: false, source: "simpleshop" })], NOW);
    check("rozhodni: active=false → nesahat", d.akce === "preskoc" && d.grant === "odebrana-nesahat");
  }
  {
    const d = rozhodni([vk()], NOW);
    check("rozhodni: koupený kurz → přeskoč", d.akce === "preskoc" && d.grant === "uz-mel");
  }
  check("rozhodni: tichý bonus → jen mail",
    rozhodni([vk({ source: "prvni-platba-bonus" })], NOW).akce === "jen-mail");
  check("rozhodni: vypršelý → udělit",
    rozhodni([vk({ expires_at: "2026-08-01T00:00:00.000Z" })], NOW).akce === "udelit");
  {
    const d = rozhodni([
      { product: "academy", active: true, expires_at: null, source: "x" },
      vk({ source: "prvni-platba-bonus" }),
    ], NOW);
    check("rozhodni: academy vyhraje nad tichým videokurzem", d.akce === "preskoc" && d.grant === "uz-mel-academy");
  }

  check("ilike: _ a % se escapují", escapeIlikeExact("a_b%c@x.cz") === "a\\_b\\%c@x.cz");
  check("ilike: backslash první", escapeIlikeExact("a\\b@x.cz") === "a\\\\b@x.cz");
  check("ilike: obyčejný e-mail beze změny", escapeIlikeExact("jana@seznam.cz") === "jana@seznam.cz");

  const radek = radekEntitlementu("a@b.cz", NOW, "sub_1", SOURCE);
  check("řádek: produkt videokurz", radek.product === "videokurz");
  check("řádek: source appka-vip", radek.source === SOURCE);
  check("řádek: expires_at výslovně null", radek.expires_at === null);
  check("řádek: subscription_id se uloží", radek.stripe_subscription_id === "sub_1");
  check("řádek: bez sub se pole vynechá",
    !("stripe_subscription_id" in radekEntitlementu("a@b.cz", NOW, "")));
  check("řádek: roční VIP source",
    radekEntitlementu("a@b.cz", NOW, "sub_1", SOURCE_ROCNI).source === SOURCE_ROCNI);

  check("vokativ: Jana → Jano", firstName("Jana Nováková") === "Jano");
  check("login nese e-mail i next na videokurz",
    loginUrl("a@b.cz").includes("email=a%40b.cz") && loginUrl("a@b.cz").includes("/akademie/videokurz/"));

  const draftVip = buildMail("a@b.cz", "Jana", "https://u.test", "ai_basic");
  const draftBasic = buildMail("a@b.cz", "Jana", "https://u.test", "basic");
  check("draft: předmět bez ceny", !/[0-9][0-9 ]*Kč/.test(draftVip.subject + draftVip.html + draftVip.text));
  check("draft: žádná dlouhá pomlčka",
    !draftVip.subject.includes("—") && !draftVip.html.includes("—") && !draftVip.text.includes("—"));
  check("draft: 182 lekcí", draftVip.html.includes(String(VIDEA_KURZU)));
  check("draft: odhlašovací odkaz", draftVip.html.includes("https://u.test"));
  check("draft: tlačítko Vytvořit účet", draftVip.html.includes("Vytvořit účet a začít"));
  check("draft: nezmiňuje garanci vrácení", !/garanti/i.test(draftVip.html + draftVip.text));
  check("draft VIP: říká VIP", draftVip.html.includes("máš VIP") && draftVip.text.includes("máš VIP"));
  check("draft Basic: NEŘÍKÁ VIP",
    !draftBasic.html.includes("VIP") && !draftBasic.text.includes("VIP") && draftBasic.text.includes("máš Basic"));
  check("draft: plaintext má diakritiku",
    draftBasic.text.includes("Tvůj Coach") && draftBasic.text.includes("Koukáš kdy chceš"));
  check("draft: předmět jako TC zrcadlo",
    draftVip.subject === "Máš ode mě videokurz výživy (přístup je aktivní)");

  {
    const { deps, stav } = mock();
    const r = await handleGrant(TELO, deps);
    check("šťastná: grant udelen", r.grant === "udelen", r.grant);
    check("šťastná: mail odeslan", r.mail === "odeslan", r.mail);
    check("šťastná: e-mail v entitlements je lowercase",
      stav.entitlementy[0]?.email === "kupujici@example.com", String(stav.entitlementy[0]?.email));
    check("šťastná: mail šel na lowercase", stav.maily[0]?.to === "kupujici@example.com");
    check("šťastná: log odeslání s event_id",
      stav.logy.length === 1 && stav.logy[0].eventId === "evt_1");
    check("šťastná: log nese subscription_id", stav.logy[0]?.subscriptionId === "sub_1");
    check("šťastná: source měsíční VIP = appka-vip", stav.entitlementy[0]?.source === SOURCE);
    check("šťastná: žádný alert", stav.alerty.length === 0);
    check("šťastná: mail říká VIP", Boolean(stav.maily[0]?.html?.includes("máš VIP")));
  }

  {
    const { deps, stav } = mock();
    const r = await handleGrant({ ...TELO, tier: "ai_basic", interval: "year" }, deps);
    check("roční VIP: source rocni-vip-bonus",
      r.grant === "udelen" && stav.entitlementy[0]?.source === SOURCE_ROCNI,
      String(stav.entitlementy[0]?.source));
  }

  {
    const { deps, stav } = mock();
    const r = await handleGrant({ ...TELO, tier: "basic", interval: "year" }, deps);
    check("roční Basic: source NENÍ rocni-vip-bonus",
      r.grant === "udelen" && stav.entitlementy[0]?.source === SOURCE);
    check("roční Basic: mail bez VIP",
      Boolean(stav.maily[0]?.text?.includes("máš Basic")) && !stav.maily[0]?.text?.includes("VIP"));
  }

  {
    const { deps, stav } = mock({ rows: [vk({ email: "Kupujici@Example.com" })] });
    const r = await handleGrant(TELO, deps);
    check("už má koupený: nic se nezapisuje", stav.entitlementy.length === 0 && r.grant === "uz-mel");
    check("už má koupený: mail NE", stav.maily.length === 0 && r.mail === "neposilat");
    check("už má koupený: není duplicate (jiná platba, druhá pojistka)", r.duplicate !== true);
    check("už má koupený: stopa skipu pro další stejný event", stav.preskoceni.length === 1 && stav.preskoceni[0] === "evt_1");
    const r2 = await handleGrant(TELO, deps);
    check("už má koupený: stejný event podruhé je duplicate", r2.duplicate === true, JSON.stringify(r2));
  }

  {
    const { deps, stav } = mock({ uzEvent: true });
    const r = await handleGrant(TELO, deps);
    check("stejný event: duplicate true", r.ok === true && r.duplicate === true, JSON.stringify(r));
    check("stejný event: grant uz-viden", r.grant === "uz-viden");
    check("stejný event: mail NE, grant se nezapisuje",
      stav.maily.length === 0 && stav.entitlementy.length === 0);
  }

  {
    const { deps, stav } = mock({
      rows: [{ product: "academy", active: true, expires_at: null, source: "stripe-lifetime" }],
    });
    const r = await handleGrant(TELO, deps);
    check("academy: grant se neudělí", stav.entitlementy.length === 0 && r.grant === "uz-mel-academy");
    check("academy: mail NE", r.mail === "neposilat" && stav.maily.length === 0);
  }

  {
    const { deps, stav } = mock({ rows: [vk({ active: false })] });
    const r = await handleGrant(TELO, deps);
    check("odebraný: nesahat", r.grant === "odebrana-nesahat" && stav.entitlementy.length === 0);
    check("odebraný: alert Martinovi", stav.alerty.length === 1, String(stav.alerty[0]?.predmet));
    check("odebraný: mail NE", stav.maily.length === 0);
  }

  {
    const { deps, stav } = mock({ rows: [vk({ source: "prvni-platba-bonus" })] });
    const r = await handleGrant(TELO, deps);
    check("tichý bonus: řádek se NEPŘEPÍŠE", stav.entitlementy.length === 0, r.grant);
    check("tichý bonus: mail se doplní", r.mail === "doplnen" && stav.maily.length === 1, r.mail);
  }

  {
    const { deps, stav } = mock({ rows: [vk({ source: SOURCE_ROCNI })] });
    const r = await handleGrant({ ...TELO, tier: "ai_basic", interval: "year" }, deps);
    check("už má rocni-vip-bonus: řádek se NEPŘEPÍŠE",
      stav.entitlementy.length === 0 && r.grant === "uz-mel-tichy-bonus");
    check("už má rocni-vip-bonus: mail se doplní", r.mail === "doplnen" && stav.maily.length === 1);
  }

  {
    const { deps, stav } = mock({ rows: [vk({ source: SOURCE })], uzMail: true });
    const r = await handleGrant(TELO, deps);
    check("retry po úspěchu: mail se neposílá znovu", r.mail === "uz-odeslan" && stav.maily.length === 0);
  }

  {
    const { deps, stav } = mock({
      rows: [vk({ expires_at: "2026-08-01T00:00:00.000Z", source: "admin-panel" })],
    });
    const r = await handleGrant(TELO, deps);
    check("vypršelý: povýší se na doživotní",
      r.grant === "udelen" && stav.entitlementy[0]?.expires_at === null);
  }

  {
    const { deps, stav } = mock({
      rows: [vk({ expires_at: "2026-08-01T00:00:00.000Z", email: "Kupujici@Example.com" })],
    });
    await handleGrant(TELO, deps);
    check("vypršelý s jiným casing: upsert trefí původní e-mail",
      stav.entitlementy[0]?.email === "Kupujici@Example.com");
  }

  {
    const { deps, stav } = mock({ lead: null });
    const r = await handleGrant(TELO, deps);
    check("bez leada: založí se kvůli odhlášení", stav.leady === 1 && r.mail === "odeslan");
  }

  {
    const { deps, stav } = mock({ grantSpadne: true });
    let status = 0;
    try {
      await handleGrant(TELO, deps);
    } catch (e) {
      status = e instanceof GrantError ? e.status : -1;
    }
    check("grant spadl: 500 a alert", status === 500 && stav.alerty.length === 1);
    check("grant spadl: mail NE", stav.maily.length === 0);
  }

  {
    const { deps, stav } = mock({ mailSpadne: true });
    let status = 0;
    let msg = "";
    try {
      await handleGrant(TELO, deps);
    } catch (e) {
      status = e instanceof GrantError ? e.status : -1;
      msg = e instanceof Error ? e.message : "";
    }
    check("mail spadl: přístup ZŮSTANE udělený", stav.entitlementy.length === 1);
    check("mail spadl: HTTP 503", status === 503, String(status));
    check("mail spadl: nevrací 200 s mail:chyba", msg === "mail failed");
    check("mail spadl: alert", stav.alerty.length === 1);
  }

  {
    const { deps, stav } = mock({ logSpadne: true });
    let status = 0;
    try {
      await handleGrant(TELO, deps);
    } catch (e) {
      status = e instanceof GrantError ? e.status : -1;
    }
    check("log email_events spadl: 503 (nepolyká se)", status === 503);
    check("log email_events spadl: mail už šel, přístup je",
      stav.maily.length === 1 && stav.entitlementy.length === 1);
  }

  {
    const { deps } = mock();
    let vyhozeno = false;
    try { await handleGrant({ email: "neni-mail", user_id: "u", event_id: "e" }, deps); } catch (e) {
      vyhozeno = e instanceof GrantError && e.status === 400;
    }
    check("vstup: nesmyslný e-mail → 400", vyhozeno);
  }

  {
    const { deps } = mock();
    let status = 0;
    try { await handleGrant({ email: "a@b.cz", event_id: "e" }, deps); } catch (e) {
      status = e instanceof GrantError ? e.status : -1;
    }
    check("vstup: chybí user_id → 400", status === 400);
  }

  {
    const { deps } = mock();
    let status = 0;
    try { await handleGrant({ email: "a@b.cz", user_id: "u" }, deps); } catch (e) {
      status = e instanceof GrantError ? e.status : -1;
    }
    check("vstup: chybí event_id → 400", status === 400);
  }

  // ⛔ R4 (2. 9. 2026): zdroje, které tahle funkce a most umí vyrobit, MUSÍ být
  //    v seznamu, podle kterého refund appky bonus poznává. Jinak by po refundu
  //    zůstal přístup, jako 2. 9. 2026 u klientky K.
  check("R4: SOURCE je v ZDROJE_BONUS_APPKA", ZDROJE_BONUS_APPKA.includes(SOURCE), SOURCE);
  check("R4: SOURCE_ROCNI je v ZDROJE_BONUS_APPKA",
    ZDROJE_BONUS_APPKA.includes(SOURCE_ROCNI), SOURCE_ROCNI);
  check("R4: kazdy tichy bonus je v ZDROJE_BONUS_APPKA",
    TICHE_BONUSY.every((z) => ZDROJE_BONUS_APPKA.includes(z)), TICHE_BONUSY.join(","));

  console.log(selhalo === 0 ? "\nVSE ZELENE\n" : `\n${selhalo} SELHANI\n`);
  if (selhalo > 0) throw new Error(String(selhalo) + " selhani");
}

await main();
