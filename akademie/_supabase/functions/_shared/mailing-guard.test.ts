// Testy send-policy. Bez sítě, bez Deno permissions.
// Spuštění: npx --yes deno@2 run akademie/_supabase/functions/_shared/mailing-guard.test.ts
import {
  PATH_CLASS,
  classForPath,
  decideSend,
  escapeIlikeExact,
  guardSend,
  isHardBounce,
  isHardUnsubscribe,
  jePlatnyEmail,
  loadSuppression,
  normalizeEmail,
  sendIfAllowed,
  shouldCreateMarketingLead,
  type MailClass,
  type SuppressionSnapshot,
  type SuppressionStore,
} from "./mailing-guard.ts";

let selhalo = 0;
function check(nazev: string, podminka: boolean, detail = ""): void {
  if (podminka) {
    console.log("  ok   " + nazev);
  } else {
    selhalo++;
    console.log("  FAIL " + nazev + (detail ? "  [" + detail + "]" : ""));
  }
}

function snap(opts: Partial<SuppressionSnapshot> = {}): SuppressionSnapshot {
  return {
    email: "jana@example.com",
    inOdhlaseniTrvale: false,
    leadStatus: "active",
    leadId: "L1",
    loadError: false,
    ...opts,
  };
}

function decide(
  mailClass: MailClass,
  snapshot: SuppressionSnapshot,
  email = snapshot.email,
) {
  return decideSend({
    email,
    mailClass,
    functionName: "test-fn",
    path: "test-fn",
    snapshot,
  });
}

function store(opts: {
  perm?: boolean;
  lead?: { id: string; status: string | null } | null;
  permThrow?: boolean;
  leadThrow?: boolean;
} = {}): SuppressionStore {
  return {
    findOdhlaseniTrvale: () => {
      if (opts.permThrow) return Promise.reject(new Error("odhlaseni down"));
      return Promise.resolve(Boolean(opts.perm));
    },
    findLead: () => {
      if (opts.leadThrow) return Promise.reject(new Error("leads down"));
      if (opts.lead === undefined) {
        return Promise.resolve({ id: "L1", status: "active" });
      }
      return Promise.resolve(opts.lead);
    },
  };
}

async function main(): Promise<void> {
  console.log("\n== mailing-guard ==");

  check("e-mail: normalizace", normalizeEmail("  A@B.CZ ") === "a@b.cz");
  check("e-mail: platný", jePlatnyEmail("a@b.cz"));
  check("e-mail: bez zavináče ne", !jePlatnyEmail("ab.cz"));
  check("e-mail: mezera ne", !jePlatnyEmail("a @b.cz"));
  check("ilike: _ a % se escapují", escapeIlikeExact("a_b%c@x.cz") === "a\\_b\\%c@x.cz");

  check("PATH_CLASS: study-reminder je optional_reminder",
    PATH_CLASS["study-reminder"] === "optional_reminder");
  check("PATH_CLASS: client-remind je client_operational",
    PATH_CLASS["client-remind"] === "client_operational");
  check("PATH_CLASS: order-rescue je optional_reminder",
    PATH_CLASS["order-rescue"] === "optional_reminder");
  check("PATH_CLASS: checkin remind je optional_reminder",
    PATH_CLASS["checkin-capture.remind"] === "optional_reminder");
  check("PATH_CLASS: splatky-guard je billing_transactional",
    PATH_CLASS["splatky-guard"] === "billing_transactional");
  check("PATH_CLASS: affiliate je partner_report",
    PATH_CLASS["affiliate-mesicni-report"] === "partner_report");
  check("PATH_CLASS: poukaz je purchase_delivery",
    PATH_CLASS["poukaz-vydat"] === "purchase_delivery");
  check("PATH_CLASS: grant je entitlement_delivery",
    PATH_CLASS["grant-videokurz-z-appky"] === "entitlement_delivery");
  check("PATH_CLASS: invite je client_operational",
    PATH_CLASS["admin-api.client_invite"] === "client_operational");
  check("PATH_CLASS: offboard confirm je client_operational",
    PATH_CLASS["admin-api.client_offboard.confirm"] === "client_operational");
  check("PATH_CLASS: offboard sales je marketing",
    PATH_CLASS["admin-api.client_offboard.sales"] === "marketing");
  check("classForPath sedí na PATH_CLASS",
    classForPath("study-reminder") === "optional_reminder");

  // --- aktivní adresát: všechny třídy posílají ---
  for (const c of [
    "marketing",
    "optional_reminder",
    "client_operational",
    "partner_report",
    "billing_transactional",
    "purchase_delivery",
    "entitlement_delivery",
  ] as MailClass[]) {
    const d = decide(c, snap());
    check("aktivní: " + c + " → send", d.action === "send" && d.reason === "ok", d.reason);
  }

  // --- hard unsub (odhlaseni_trvale) ---
  {
    const s = snap({ inOdhlaseniTrvale: true, leadStatus: "unsubscribed" });
    check("unsub: marketing skip", decide("marketing", s).action === "skip");
    check("unsub: optional_reminder skip", decide("optional_reminder", s).reason === "hard_unsubscribe");
    check("unsub: client_operational KEEP",
      decide("client_operational", s).action === "send" &&
      decide("client_operational", s).reason === "transactional_exception_unsub");
    check("unsub: partner_report KEEP", decide("partner_report", s).action === "send");
    check("unsub: billing KEEP", decide("billing_transactional", s).action === "send");
    check("unsub: purchase KEEP", decide("purchase_delivery", s).action === "send");
    check("unsub: entitlement KEEP", decide("entitlement_delivery", s).action === "send");
  }

  // --- jen leads.status=unsubscribed, bez řádku v odhlaseni_trvale ---
  {
    const s = snap({ inOdhlaseniTrvale: false, leadStatus: "unsubscribed" });
    check("lead unsub: optional skip", decide("optional_reminder", s).action === "skip");
    check("lead unsub: billing KEEP", decide("billing_transactional", s).action === "send");
    check("isHardUnsubscribe true", isHardUnsubscribe(s) === true);
  }

  // --- jen odhlaseni_trvale, lead chybí (GDPR výmaz) ---
  {
    const s = snap({ inOdhlaseniTrvale: true, leadStatus: null, leadId: null });
    check("perm bez leada: marketing skip", decide("marketing", s).action === "skip");
    check("perm bez leada: entitlement KEEP", decide("entitlement_delivery", s).action === "send");
    check("perm bez leada: marketing lead se nezakládá", shouldCreateMarketingLead(s) === false);
  }

  // --- hard bounce: STOP u všech ---
  {
    const s = snap({ leadStatus: "bounced" });
    check("bounce: isHardBounce", isHardBounce(s) === true);
    for (const c of [
      "marketing",
      "optional_reminder",
      "client_operational",
      "partner_report",
      "billing_transactional",
      "purchase_delivery",
      "entitlement_delivery",
    ] as MailClass[]) {
      const d = decide(c, s);
      check("bounce: " + c + " skip", d.action === "skip" && d.reason === "hard_bounce", d.reason);
    }
    check("bounce: marketing lead se nezakládá", shouldCreateMarketingLead(s) === false);
  }

  // --- chybějící lead, není na trvalém seznamu ---
  {
    const s = snap({ leadId: null, leadStatus: null, inOdhlaseniTrvale: false });
    check("missing lead: marketing send",
      decide("marketing", s).action === "send" && decide("marketing", s).reason === "missing_lead_allow");
    check("missing lead: optional send", decide("optional_reminder", s).action === "send");
    check("missing lead: purchase send", decide("purchase_delivery", s).action === "send");
    check("missing lead: smí založit marketing lead", shouldCreateMarketingLead(s) === true);
  }

  // --- neplatný e-mail ---
  check("invalid: skip i u purchase",
    decide("purchase_delivery", snap({ email: "" }), "").reason === "invalid_email");

  // --- load error: marketing fail-closed, transakce fail-open ---
  {
    const s = snap({ loadError: true, leadStatus: "active" });
    check("load error: marketing skip", decide("marketing", s).reason === "suppression_load_failed");
    check("load error: optional skip", decide("optional_reminder", s).action === "skip");
    check("load error: billing send",
      decide("billing_transactional", s).reason === "suppression_load_failed_allow");
    check("load error: entitlement send", decide("entitlement_delivery", s).action === "send");
  }

  // --- load error + bounce známý z toho, co se načetlo ---
  {
    const s = snap({ loadError: true, leadStatus: "bounced" });
    check("load error + bounce: purchase skip", decide("purchase_delivery", s).reason === "hard_bounce");
  }

  check("paused lead není unsub",
    decide("marketing", snap({ leadStatus: "paused" })).action === "send");

  // --- store / guardSend ---
  {
    const d = await guardSend(store(), {
      email: "Jana@Example.com",
      mailClass: "optional_reminder",
      functionName: "study-reminder",
      path: "study-reminder",
    });
    check("guardSend aktivní → send", d.action === "send" && d.email === "jana@example.com");
  }
  {
    const d = await guardSend(store({ perm: true, lead: { id: "L2", status: "unsubscribed" } }), {
      email: "x@example.com",
      mailClass: "optional_reminder",
      functionName: "order-rescue",
    });
    check("guardSend unsub optional → skip", d.action === "skip" && d.reason === "hard_unsubscribe");
  }
  {
    const d = await guardSend(store({ lead: { id: "L3", status: "bounced" } }), {
      email: "x@example.com",
      mailClass: "partner_report",
      functionName: "affiliate-mesicni-report",
    });
    check("guardSend bounce partner → skip", d.reason === "hard_bounce");
  }
  {
    const d = await guardSend(store({ lead: null }), {
      email: "nikdo@example.com",
      mailClass: "optional_reminder",
      functionName: "order-rescue",
    });
    check("guardSend missing lead optional → send", d.reason === "missing_lead_allow");
  }
  {
    const d = await guardSend(store({ perm: true, lead: null }), {
      email: "x@example.com",
      mailClass: "entitlement_delivery",
      functionName: "grant-videokurz-z-appky",
    });
    check("guardSend perm + missing lead entitlement → send",
      d.action === "send" && d.reason === "transactional_exception_unsub");
  }
  {
    const d = await loadSuppression(store({ permThrow: true }), "a@b.cz");
    check("load: pád odhlaseni_trvale nastaví loadError", d.loadError === true);
  }
  {
    const d = await guardSend(store({ leadThrow: true }), {
      email: "a@b.cz",
      mailClass: "marketing",
      functionName: "admin-api",
      path: "admin-api.client_offboard.sales",
    });
    check("guardSend load fail marketing → skip", d.reason === "suppression_load_failed");
  }

  // --- sendIfAllowed: skip nevolá send ---
  {
    let volano = 0;
    const d = await sendIfAllowed(
      store({ perm: true, lead: { id: "L", status: "unsubscribed" } }),
      { email: "x@example.com", mailClass: "marketing", functionName: "admin-api" },
      () => {
        volano++;
        return Promise.resolve();
      },
    );
    check("sendIfAllowed skip nevolá send", d.action === "skip" && volano === 0);
  }
  {
    let volano = 0;
    const d = await sendIfAllowed(
      store(),
      { email: "x@example.com", mailClass: "client_operational", functionName: "client-remind" },
      () => {
        volano++;
        return Promise.resolve();
      },
    );
    check("sendIfAllowed send volá send", d.action === "send" && volano === 1);
  }

  // --- LOCK příklady po jménech cest ---
  check("LOCK: study-reminder unsub skip",
    decide(PATH_CLASS["study-reminder"], snap({ inOdhlaseniTrvale: true })).action === "skip");
  check("LOCK: client-remind unsub KEEP",
    decide(PATH_CLASS["client-remind"], snap({ inOdhlaseniTrvale: true })).action === "send");
  check("LOCK: order-rescue unsub skip",
    decide(PATH_CLASS["order-rescue"], snap({ leadStatus: "unsubscribed" })).action === "skip");
  check("LOCK: checkin unsub skip",
    decide(PATH_CLASS["checkin-capture.remind"], snap({ inOdhlaseniTrvale: true })).action === "skip");
  check("LOCK: splatky unsub KEEP",
    decide(PATH_CLASS["splatky-guard"], snap({ inOdhlaseniTrvale: true })).action === "send");
  check("LOCK: affiliate unsub KEEP",
    decide(PATH_CLASS["affiliate-mesicni-report"], snap({ inOdhlaseniTrvale: true })).action === "send");
  check("LOCK: poukaz unsub KEEP",
    decide(PATH_CLASS["poukaz-vydat"], snap({ inOdhlaseniTrvale: true })).action === "send");
  check("LOCK: grant unsub KEEP",
    decide(PATH_CLASS["grant-videokurz-z-appky"], snap({ inOdhlaseniTrvale: true })).action === "send");
  check("LOCK: invite unsub KEEP",
    decide(PATH_CLASS["admin-api.client_invite"], snap({ inOdhlaseniTrvale: true })).action === "send");
  check("LOCK: offboard confirm unsub KEEP",
    decide(PATH_CLASS["admin-api.client_offboard.confirm"], snap({ inOdhlaseniTrvale: true })).action === "send");
  check("LOCK: offboard sales unsub skip",
    decide(PATH_CLASS["admin-api.client_offboard.sales"], snap({ inOdhlaseniTrvale: true })).action === "skip");
  check("LOCK: affiliate bounce skip",
    decide(PATH_CLASS["affiliate-mesicni-report"], snap({ leadStatus: "bounced" })).action === "skip");
  check("LOCK: client-remind bounce skip",
    decide(PATH_CLASS["client-remind"], snap({ leadStatus: "bounced" })).action === "skip");

  console.log(selhalo === 0 ? "\nVSE ZELENE\n" : `\n${selhalo} SELHANI\n`);
  if (selhalo > 0) throw new Error(String(selhalo) + " selhani");
}

await main();
