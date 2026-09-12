// =============================================================================
// Shared Resend send-policy (Martin LOCK 7. 9. 2026).
//
// Volá se TĚSNĚ PŘED každým přímým Resendem na zákazníka. Rozhodnutí je
// `send` nebo `skip` s důvodem. Žádný fetch na api.resend.com sem nepatří.
//
// LOCK:
//   Po newsletter / hard unsub (`odhlaseni_trvale` nebo leads.status=unsubscribed)
//   STOP marketing + měkké nudge. KEEP: faktury/splátky, doručení nákupu a
//   přístupu, důležitý provoz Tvůj Coach / koučinku. Hard bounce STOP u všech.
//
// ⛔ Tabulka `odhlaseni_trvale` je zdroj pravdy o trvalém odhlášení. Lead se
//    NEmaže (zmrazí se). Tahle vrstva čte stav, nic do leads nezapisuje.
// =============================================================================

export const MAIL_CLASSES = [
  "marketing",
  "optional_reminder",
  "client_operational",
  "partner_report",
  "billing_transactional",
  "purchase_delivery",
  "entitlement_delivery",
] as const;

export type MailClass = typeof MAIL_CLASSES[number];

/** Cesty z LOCK 7. 9. 2026. Test hlídá, že se mapa nerozejde s politikou. */
export const PATH_CLASS = {
  "study-reminder": "optional_reminder",
  "client-remind": "client_operational",
  "order-rescue": "optional_reminder",
  "checkin-capture.remind": "optional_reminder",
  "splatky-guard": "billing_transactional",
  "affiliate-mesicni-report": "partner_report",
  "poukaz-vydat": "purchase_delivery",
  "grant-videokurz-z-appky": "entitlement_delivery",
  "admin-api.client_invite": "client_operational",
  "admin-api.client_offboard.confirm": "client_operational",
  "admin-api.client_offboard.sales": "marketing",
} as const;

export type GuardPath = keyof typeof PATH_CLASS;

const STOP_ON_UNSUB: ReadonlySet<MailClass> = new Set([
  "marketing",
  "optional_reminder",
]);

export type SuppressionSnapshot = {
  email: string;
  inOdhlaseniTrvale: boolean;
  leadStatus: string | null;
  leadId: string | null;
  loadError: boolean;
};

export type GuardInput = {
  email: string;
  mailClass: MailClass;
  functionName: string;
  path?: string;
  snapshot: SuppressionSnapshot;
};

export type GuardDecision = {
  action: "send" | "skip";
  reason: string;
  mailClass: MailClass;
  functionName: string;
  path: string;
  email: string;
  leadId: string | null;
};

export function normalizeEmail(raw: unknown): string {
  return String(raw ?? "").trim().toLowerCase();
}

export function jePlatnyEmail(email: string): boolean {
  return Boolean(email) && email.includes("@") && email.length <= 320 && !email.includes(" ");
}

/**
 * ILIKE bere `_` a `%` jako wildcards. Na `a_b@…` by to mohlo trefit cizí řádek.
 * Backslash je v Postgresu výchozí escape znak LIKE.
 */
export function escapeIlikeExact(email: string): string {
  return email.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

export function isHardUnsubscribe(s: SuppressionSnapshot): boolean {
  return s.inOdhlaseniTrvale || s.leadStatus === "unsubscribed";
}

export function isHardBounce(s: SuppressionSnapshot): boolean {
  return s.leadStatus === "bounced";
}

/** Aktivní marketingový lead se u trvale odhlášeného / bounced nezakládá. */
export function shouldCreateMarketingLead(s: SuppressionSnapshot): boolean {
  if (!jePlatnyEmail(s.email)) return false;
  if (s.inOdhlaseniTrvale) return false;
  if (s.leadStatus === "unsubscribed" || s.leadStatus === "bounced") return false;
  return true;
}

export function classForPath(path: string): MailClass {
  if (path in PATH_CLASS) return PATH_CLASS[path as GuardPath];
  throw new Error("mailing-guard: neznama cesta " + path);
}

function decision(
  input: GuardInput,
  action: "send" | "skip",
  reason: string,
): GuardDecision {
  return {
    action,
    reason,
    mailClass: input.mailClass,
    functionName: input.functionName,
    path: input.path || input.functionName,
    email: input.snapshot.email || normalizeEmail(input.email),
    leadId: input.snapshot.leadId,
  };
}

/**
 * Čistá funkce. Testuje se bez sítě a bez Deno.
 *
 * Pořadí je závazné:
 *  1. neplatný e-mail → skip (všem třídám)
 *  2. hard bounce → skip (všem třídám, i transakčním)
 *  3. hard unsub → skip jen marketing a optional_reminder
 *  4. load error + třída se STOP_ON_UNSUB → skip (fail-closed na marketing)
 *  5. jinak send (transakce při load error fail-open)
 */
export function decideSend(input: GuardInput): GuardDecision {
  const email = normalizeEmail(input.email || input.snapshot.email);
  const boxed: GuardInput = {
    ...input,
    email,
    snapshot: { ...input.snapshot, email: input.snapshot.email || email },
  };

  if (!jePlatnyEmail(email)) {
    return decision(boxed, "skip", "invalid_email");
  }
  if (isHardBounce(boxed.snapshot)) {
    return decision(boxed, "skip", "hard_bounce");
  }
  if (isHardUnsubscribe(boxed.snapshot) && STOP_ON_UNSUB.has(boxed.mailClass)) {
    return decision(boxed, "skip", "hard_unsubscribe");
  }
  if (boxed.snapshot.loadError && STOP_ON_UNSUB.has(boxed.mailClass)) {
    return decision(boxed, "skip", "suppression_load_failed");
  }
  if (isHardUnsubscribe(boxed.snapshot)) {
    return decision(boxed, "send", "transactional_exception_unsub");
  }
  if (boxed.snapshot.loadError) {
    return decision(boxed, "send", "suppression_load_failed_allow");
  }
  if (!boxed.snapshot.leadId && !boxed.snapshot.inOdhlaseniTrvale) {
    return decision(boxed, "send", "missing_lead_allow");
  }
  return decision(boxed, "send", "ok");
}

export type SuppressionStore = {
  findOdhlaseniTrvale: (email: string) => Promise<boolean>;
  findLead: (email: string) => Promise<{ id: string; status: string | null } | null>;
};

export async function loadSuppression(
  store: SuppressionStore,
  rawEmail: unknown,
): Promise<SuppressionSnapshot> {
  const email = normalizeEmail(rawEmail);
  const snap: SuppressionSnapshot = {
    email,
    inOdhlaseniTrvale: false,
    leadStatus: null,
    leadId: null,
    loadError: false,
  };
  if (!email) return snap;
  try {
    snap.inOdhlaseniTrvale = await store.findOdhlaseniTrvale(email);
  } catch {
    snap.loadError = true;
  }
  try {
    const lead = await store.findLead(email);
    if (lead) {
      snap.leadId = lead.id;
      snap.leadStatus = lead.status;
    }
  } catch {
    snap.loadError = true;
  }
  return snap;
}

/** Minimální tvar supabase-js builderu, ať guard nemá závislost na client SDK. */
export async function loadSuppressionFromSupabase(
  // deno-lint-ignore no-explicit-any
  admin: any,
  rawEmail: unknown,
): Promise<SuppressionSnapshot> {
  const email = normalizeEmail(rawEmail);
  return loadSuppression({
    async findOdhlaseniTrvale(em) {
      const { data, error } = await admin
        .from("odhlaseni_trvale")
        .select("email")
        .ilike("email", escapeIlikeExact(em))
        .limit(1);
      if (error) throw new Error(error.message);
      const row = Array.isArray(data) ? data[0] : data;
      return Boolean(row && (row as { email?: string }).email);
    },
    async findLead(em) {
      const { data, error } = await admin
        .from("leads")
        .select("id,status")
        .ilike("email", escapeIlikeExact(em))
        .limit(1);
      if (error) throw new Error(error.message);
      const row = Array.isArray(data) ? data[0] : data;
      if (!row) return null;
      return {
        id: String((row as { id: unknown }).id),
        status: (row as { status?: unknown }).status == null
          ? null
          : String((row as { status: unknown }).status),
      };
    },
  }, email);
}

export async function guardSend(
  storeOrAdmin: SuppressionStore | unknown,
  opts: {
    email: string;
    mailClass: MailClass;
    functionName: string;
    path?: string;
  },
): Promise<GuardDecision> {
  const store = storeOrAdmin as SuppressionStore;
  const snapshot = typeof store.findLead === "function"
    ? await loadSuppression(store, opts.email)
    : await loadSuppressionFromSupabase(storeOrAdmin, opts.email);
  return decideSend({
    email: opts.email,
    mailClass: opts.mailClass,
    functionName: opts.functionName,
    path: opts.path,
    snapshot,
  });
}

export async function logMailSkip(
  // deno-lint-ignore no-explicit-any
  admin: any,
  decision: GuardDecision,
): Promise<void> {
  console.warn(
    "[mailing-guard] skip fn=" + decision.functionName +
      " path=" + decision.path +
      " class=" + decision.mailClass +
      " reason=" + decision.reason,
  );
  if (!admin || typeof admin.from !== "function") return;
  try {
    await admin.from("email_events").insert({
      lead_id: decision.leadId,
      step: 0,
      type: "info",
      detail: {
        track: "mailing-guard",
        skipped: true,
        reason: decision.reason,
        class: decision.mailClass,
        fn: decision.functionName,
        path: decision.path,
      },
    });
  } catch {
    /* best-effort: skip nesmí shodit odesílací cestu */
  }
}

/**
 * Gate před Resendem. `send` se volá jen při action=send.
 * Vrací rozhodnutí, ať volající umí započítat skip.
 */
export async function sendIfAllowed(
  storeOrAdmin: SuppressionStore | unknown,
  opts: {
    email: string;
    mailClass: MailClass;
    functionName: string;
    path?: string;
  },
  send: () => Promise<void>,
): Promise<GuardDecision> {
  const decision = await guardSend(storeOrAdmin, opts);
  if (decision.action === "skip") {
    await logMailSkip(storeOrAdmin, decision);
    return decision;
  }
  await send();
  return decision;
}
