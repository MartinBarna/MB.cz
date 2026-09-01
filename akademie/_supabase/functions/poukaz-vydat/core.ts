// =============================================================================
// poukaz-vydat: testovatelné JÁDRO (DI, bez Deno), vzor stripe-webhook/core.ts.
// Ověření podpisu dělá index.ts JEŠTĚ PŘED voláním tohohle jádra (stejně jako
// appčin stripe-webhook). Tohle jádro dostává už OVĚŘENÝ event.
//
// ⛔ Přepsáno po nezávislé revizi (Cursor, 25. 8. 2026), 3 blokující nálezy:
// 1) Funkce dřív VŽDY vracela 200, i když insert do DB spadl PŘED tím, než
//    vznikl řádek → Stripe si myslel, že je hotovo, a zaplacený poukaz zmizel
//    beze stopy. Teď `ProcessResult.retry` říká indexu, kdy má vrátit 5xx
//    (Stripe zopakuje), přesně jako `stripe-webhook/index.ts` dělá pro
//    `status === 'deferred'`.
// 2) Řádek mohl existovat s `mail_sent_at IS NULL` (insert prošel, mail/PDF
//    ne) a druhé doručení eventu to jen tiše označilo 'duplicate' → mail se
//    už NIKDY neposlal. Teď se při nalezení nedoručeného řádku mail zkusí
//    poslat ZNOVU (`deliverVoucher` z resume větve), ne přeskočit.
// 3) `deps.findByEventId`/`deps.variantForPaymentLink` dřív mlčky zahazovaly
//    chybu DB (Supabase `{ data, error }` a `error` se nekontrolovalo) → výpadek
//    vypadal stejně jako "cizí checkout" a taky se ztratil. Teď MUSÍ throw
//    na skutečnou chybu (viz kontrakt u typu `CoreDeps` níž); throw se tady
//    mapuje na `retry: true`.
//
// Idempotence: nejdřív se hledá řádek podle stripe_event_id (deps.findByEventId).
// Když existuje A má mail poslaný, je to opakované doručení → 'duplicate_mailed',
// nic se neposílá znovu. Když existuje BEZ mailu, doručení se dokončí (bod 2 výš).
// Teprve když řádek neexistuje, generuje se kód s retry na kolizi
// (deps.tryInsertVoucher vrací 'code_collision' při UNIQUE konfliktu na `code`,
// 'event_duplicate' při souběžném insertu téhož eventu, to je race, ne chyba).
// =============================================================================

export type StripeEvent = {
  id: string;
  type: string;
  data?: { object?: Record<string, unknown> };
};

type CustomField = {
  key?: string;
  type?: string;
  text?: { value?: string | null } | null;
  dropdown?: { value?: string | null } | null;
};

type CheckoutSession = {
  id?: string;
  /** Stripe Checkout Session pole `payment_link`: normálně string ID, ale
   *  jde expandovat na objekt `{ id, object: 'payment_link', … }`. Nález 5
   *  nezávislé revize: bez type guardu by expandovaný objekt prošel jako
   *  truthy hodnota, dotaz do `poukaz_varianty` by nesedl a zaplacený
   *  poukaz by tiše spadl do 'ignored'. */
  payment_link?: string | { id?: string | null } | null;
  customer_details?: { email?: string | null } | null;
  customer_email?: string | null;
  custom_fields?: CustomField[] | null;
};

export type VariantConfig = { varianta: string; nazevNaPoukaz: string };

export type VoucherInsertRow = {
  stripe_event_id: string;
  stripe_session_id: string | null;
  payment_link_id: string;
  varianta: string;
  buyer_email: string;
  recipient_name: string | null;
  code: string;
  valid_until: string; // YYYY-MM-DD, Prague-lokální kalendářní den
  status: 'vydan';
  vzhled: string;
};

/** Data existujícího řádku potřebná k DOKONČENÍ doručení (resume), ne jen
 *  k detekci duplicity. `validUntilIso`/`createdAtIso` jsou přesně to, co je
 *  uložené v DB, aby resend použil STEJNÝ kód a STEJNOU platnost jako
 *  originál, ne nově spočítané hodnoty. */
export type ExistingVoucher = {
  id: string;
  code: string;
  buyerEmail: string;
  recipientName: string | null;
  validUntilIso: string; // sloupec `valid_until` (date, YYYY-MM-DD)
  createdAtIso: string; // sloupec `created_at` (timestamptz)
  mailSentAt: string | null;
  vzhled: string;
};

export type InsertOutcome =
  | { kind: 'inserted'; id: string }
  | { kind: 'code_collision' }
  | { kind: 'event_duplicate' };

export type CoreDeps = {
  /** ⛔ MUSÍ throw na skutečnou chybu DB/sítě. Vrátí `null` JEN když řádek
   *  opravdu neexistuje (žádná chyba, prázdný výsledek). */
  findByEventId: (eventId: string) => Promise<ExistingVoucher | null>;
  /** ⛔ MUSÍ throw na skutečnou chybu DB/sítě. Vrátí `null` JEN když linka
   *  opravdu není v `poukaz_varianty` (žádná chyba, prázdný výsledek). */
  variantForPaymentLink: (paymentLinkId: string) => Promise<VariantConfig | null>;
  /** ⛔ MUSÍ throw na jakoukoli chybu KROMĚ UNIQUE konfliktu na `code` nebo
   *  `stripe_event_id` (ty se vrací jako `code_collision` / `event_duplicate`). */
  tryInsertVoucher: (row: VoucherInsertRow) => Promise<InsertOutcome>;
  markMailSent: (id: string, at: Date) => Promise<void>;
  markStatus: (id: string, status: 'vydan' | 'chyba') => Promise<void>;
  buildPdf: (input: {
    recipientName: string;
    whatText: string;
    code: string;
    validUntilCzech: string;
    issuedAtCzech: string;
    vzhled: string;
  }) => Promise<Uint8Array>;
  sendMail: (input: {
    to: string;
    subject: string;
    fromLabel: string;
    variantaMailText: string;
    recipientDisplayName: string;
    validUntilCzech: string;
    pdfBytes: Uint8Array;
    pdfFilename: string;
  }) => Promise<{ ok: boolean; error?: string }>;
  generateCode: (year: number) => string;
  now: () => Date;
  logError: (message: string, meta: Record<string, unknown>) => void;
};

export type ProcessConfig = {
  ostry: boolean; // POUKAZ_OSTRY === '1'
  testRecipient: string; // fitness.barna@gmail.com
  mailFrom: string;
};

export type ProcessResult = {
  status: 'ignored' | 'duplicate_mailed' | 'mailed' | 'retry';
  /** true = index.ts má vrátit 5xx, ať to Stripe zkusí znovu (nedokončená práce). */
  retry: boolean;
  reason?: string;
};

/** Krátká fráze pro mailovou větu „PDF poukaz na {varianta} pro {jméno}" (akuzativ).
 *  Oddělené od `nazev_na_poukaz` (dlouhý text na PDF) schválně, je to jiný pád a jiná délka. */
export const MAIL_VARIANTA_LABELS: Record<string, string> = {
  konzultace: 'online konzultaci s Martinem',
  videokurz: 'videokurz výživy',
  academy: 'Barna Academy doživotně',
  balicek349: 'balíček (40 receptů a 48 odpovědí)',
};

function mailLabelFor(varianta: string): string {
  return MAIL_VARIANTA_LABELS[varianta] ?? 'dárek od Martina Barny';
}

// --- Datum: vždy Europe/Prague, ne runtime/UTC (nález 10 nezávislé revize) ---
// Supabase Edge Functions běží v UTC. Bez týhle vrstvy by nákup těsně po
// půlnoci SELČ (kdy je v UTC ještě předchozí den) dostal platnost i "Vystaveno"
// o den dřív, než by měl. Formátování data patří na JEDNO místo (tady), ne
// duplicitně v lib/pdf.ts, ten dostává už hotové české řetězce.
function pragueYMD(d: Date): { y: number; m: number; day: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Prague',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return { y: get('year'), m: get('month'), day: get('day') };
}

function isoDate(d: Date): string {
  const { y, m, day } = pragueYMD(d);
  return `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function czechDate(d: Date): string {
  const { y, m, day } = pragueYMD(d);
  return `${day}. ${m}. ${y}`;
}

/** `iso` je čistě 'YYYY-MM-DD' (SQL `date` sloupec bez časové zóny), žádný
 *  převod TZ netřeba, jen přeformátování na český tvar. */
function czechDateFromIsoDateOnly(iso: string): string {
  const [y, m, day] = iso.split('-').map(Number);
  return `${day}. ${m}. ${y}`;
}

function addYears(d: Date, years: number): Date {
  const { y, m, day } = pragueYMD(d);
  // Poledne UTC toho pražského kalendářního dne, ať pozdější formátování
  // (kdekoli, v jakékoli TZ) nespadne přes půlnoc na jiný den.
  return new Date(Date.UTC(y + years, m - 1, day, 12, 0, 0));
}

/** Klíč custom pole „Komu je dárek, jméno obdarovaného" na Stripe payment linkách
 *  (dodal šéf 25. 8. 2026, ověřeno ve všech 4 payment linkách). Primární cesta k
 *  jménu; kdyby se klíč na některé lince lišil nebo se poukaz rozšířil na další
 *  linku s jiným klíčem, fallback níž bere první vyplněné textové pole. */
const RECIPIENT_NAME_FIELD_KEY = 'komujedrekjmnoobdarovanho';
const VZHLED_FIELD_KEY = 'vzhledpoukazu';

/** Jméno obdarovaného ze Stripe checkout session custom_fields.
 *  Prázdné/chybějící → '' (fallback 'pro tebe' řeší volající PDF i mail stejně). */
export function extractRecipientName(customFields: CustomField[] | null | undefined): string {
  if (!Array.isArray(customFields)) return '';
  const byKey = customFields.find(
    (f) => f?.key === RECIPIENT_NAME_FIELD_KEY && f?.type === 'text' && typeof f.text?.value === 'string',
  );
  if (byKey?.text?.value?.trim()) return byKey.text.value.trim();

  const firstText = customFields.find(
    (f) => f?.type === 'text' && typeof f.text?.value === 'string' && f.text.value.trim(),
  );
  return firstText?.text?.value?.trim() ?? '';
}

/** Vzhled PDF ze Stripe checkout session custom_fields (dropdown).
 *  Prázdné/chybějící/špatný typ → '' (normalizeVzhled v pdf.ts padne na tmavou).
 *  Žádný fallback na jiné pole. Nikdy nehodí výjimku. */
export function extractVzhled(customFields: CustomField[] | null | undefined): string {
  if (!Array.isArray(customFields)) return '';
  const f = customFields.find(
    (field) => field?.key === VZHLED_FIELD_KEY && field?.type === 'dropdown',
  );
  const value = f?.dropdown?.value;
  if (typeof value === 'string' && value.trim()) return value.trim();
  return '';
}

// Stripe si `value` dropdownu `vzhledpoukazu` vygeneroval SÁM z labelu bez
// diakritiky/mezer (26. 8. 2026, změřeno v API logu), ne z kanonických
// hodnot: "Tmavá zlatá" → `tmavzlat`, "Světlá na tisk" → `svtlnatisk`,
// "Slavnostní" → `slavnostn`. ⚠️ STEJNÁ mapa jako `STRIPE_RAW_VZHLED`
// v `lib/pdf.ts` - DUPLICITNĚ schválně: `core.ts` je záměrně bez závislostí
// (testuje se offline, viz hlavička `__tests__/core.test.ts`), zatímco
// `lib/pdf.ts` vyžaduje síť (esm.sh pdf-lib). Import odtud by core testům
// vzal offline běh. Změníš-li Stripe hodnoty, uprav OBĚ místa.
const STRIPE_RAW_VZHLED_TO_CANONICAL: Record<string, string> = {
  tmavzlat: 'tmava',
  svtlnatisk: 'svetla',
  slavnostn: 'slavnostni',
};

/** Syrovou hodnotu z `extractVzhled` (kanonickou, syrovou Stripe, nebo '')
 *  převede na hodnotu bezpečnou k uložení do `poukazy.vzhled` - VŽDY jednu
 *  z 'tmava'/'svetla'/'slavnostni', nikdy ''  a nikdy syrový Stripe tvar.
 *  Neznámá/chybějící hodnota se zaloguje (surová hodnota + session id) a
 *  padne na tmavou. Nikdy nehodí výjimku. */
function normalizeVzhledForStorage(raw: string, sessionId?: string): string {
  if (raw === 'tmava' || raw === 'svetla' || raw === 'slavnostni') return raw;
  const mapped = STRIPE_RAW_VZHLED_TO_CANONICAL[raw];
  if (mapped) return mapped;
  console.error(
    `[poukaz-vydat] neznámý/chybějící vzhled poukazu, padám na tmava; raw=${JSON.stringify(raw)} sessionId=${JSON.stringify(sessionId ?? null)}`,
  );
  return 'tmava';
}

/** `payment_link` je normálně string ID; expandovaný objekt `{id,...}` se taky
 *  zvládne. Cokoli jiného (nález 5) se zaloguje, ne tiše ignoruje. */
function extractPaymentLinkId(
  session: CheckoutSession,
  logError: CoreDeps['logError'],
): string | null {
  const pl = session.payment_link;
  if (pl == null) return null;
  if (typeof pl === 'string') return pl || null;
  if (typeof pl === 'object' && typeof (pl as { id?: unknown }).id === 'string') {
    return (pl as { id: string }).id || null;
  }
  logError('payment_link má neočekávaný tvar (ani string, ani {id})', { paymentLink: pl });
  return null;
}

const MAX_CODE_ATTEMPTS = 5;

/** Sestaví PDF a pošle mail pro JEDEN konkrétní (už existující nebo právě
 *  vložený) řádek. Sdílená cesta pro "čerstvý insert" i "resume nedoručeného
 *  řádku" (nález 2), ať se logika neduplikuje a nerozejde. */
async function deliverVoucher(
  voucherId: string,
  buyerEmail: string,
  recipientNameRaw: string | null,
  code: string,
  validUntilCzech: string,
  issuedAtCzech: string,
  vzhled: string,
  variant: VariantConfig,
  deps: CoreDeps,
  config: ProcessConfig,
  eventId: string,
): Promise<ProcessResult> {
  const displayName = (recipientNameRaw ?? '').trim() || 'pro tebe';
  try {
    const pdfBytes = await deps.buildPdf({
      recipientName: recipientNameRaw ?? '',
      whatText: variant.nazevNaPoukaz,
      code,
      validUntilCzech,
      issuedAtCzech,
      vzhled,
    });

    const testMode = !config.ostry;
    const to = testMode ? config.testRecipient : buyerEmail;
    const subject = (testMode ? '[TEST] ' : '') + 'Tvůj dárkový poukaz je tady 🎁';

    const mailResult = await deps.sendMail({
      to,
      subject,
      fromLabel: config.mailFrom,
      variantaMailText: mailLabelFor(variant.varianta),
      recipientDisplayName: displayName,
      validUntilCzech,
      pdfBytes,
      pdfFilename: `poukaz-${code}.pdf`,
    });

    if (mailResult.ok) {
      await deps.markMailSent(voucherId, deps.now());
      return { status: 'mailed', retry: false, reason: 'mail sent' };
    }
    deps.logError('odeslání mailu selhalo, žádám Stripe o retry (mail_sent_at zůstává null)', {
      eventId,
      voucherId,
      error: mailResult.error,
    });
    await deps.markStatus(voucherId, 'chyba');
    return { status: 'retry', retry: true, reason: `mail failed: ${mailResult.error}` };
  } catch (e) {
    deps.logError('PDF/mail zpracování selhalo, žádám Stripe o retry', { eventId, voucherId, error: String(e) });
    await deps.markStatus(voucherId, 'chyba');
    return { status: 'retry', retry: true, reason: `pdf/mail error: ${String(e)}` };
  }
}

function resumeAndSendMail(
  existing: ExistingVoucher,
  variant: VariantConfig,
  deps: CoreDeps,
  config: ProcessConfig,
  eventId: string,
): Promise<ProcessResult> {
  return deliverVoucher(
    existing.id,
    existing.buyerEmail,
    existing.recipientName,
    existing.code,
    czechDateFromIsoDateOnly(existing.validUntilIso),
    czechDate(new Date(existing.createdAtIso)),
    existing.vzhled,
    variant,
    deps,
    config,
    eventId,
  );
}

export async function handleStripeEvent(
  event: StripeEvent,
  deps: CoreDeps,
  config: ProcessConfig,
): Promise<ProcessResult> {
  if (event.type !== 'checkout.session.completed') {
    return { status: 'ignored', retry: false, reason: `event type ${event.type}` };
  }

  const session = (event.data?.object ?? {}) as CheckoutSession;
  const paymentLinkId = extractPaymentLinkId(session, deps.logError);
  if (!paymentLinkId) return { status: 'ignored', retry: false, reason: 'no payment_link on session' };

  let variant: VariantConfig | null;
  try {
    variant = await deps.variantForPaymentLink(paymentLinkId);
  } catch (e) {
    deps.logError('variantForPaymentLink selhalo (DB chyba), žádám Stripe o retry', {
      eventId: event.id,
      error: String(e),
    });
    return { status: 'retry', retry: true, reason: `variant lookup failed: ${String(e)}` };
  }
  if (!variant) return { status: 'ignored', retry: false, reason: `unknown payment_link ${paymentLinkId}` };

  let existing: ExistingVoucher | null;
  try {
    existing = await deps.findByEventId(event.id);
  } catch (e) {
    deps.logError('findByEventId selhalo (DB chyba), žádám Stripe o retry', { eventId: event.id, error: String(e) });
    return { status: 'retry', retry: true, reason: `event lookup failed: ${String(e)}` };
  }

  if (existing) {
    if (existing.mailSentAt) return { status: 'duplicate_mailed', retry: false, reason: event.id };
    return resumeAndSendMail(existing, variant, deps, config, event.id);
  }

  const buyerEmail = session.customer_details?.email ?? session.customer_email ?? null;
  if (!buyerEmail) {
    deps.logError('checkout.session.completed bez e-mailu kupujícího, žádám Stripe o retry', { eventId: event.id });
    return { status: 'retry', retry: true, reason: 'missing buyer email' };
  }

  const recipientNameRaw = extractRecipientName(session.custom_fields);
  // ⛔⛔ Nález nezávislé revize (Cursor, 26. 8. 2026, po nasazení): `|| 'tmava'`
  // samo o sobě čistí jen PRÁZDNÝ řetězec, ale živý Academy checkout posílá
  // SYROVÉ hodnoty ze Stripe dropdownu (`tmavzlat`/`svtlnatisk`/`slavnostn` -
  // Stripe si `value` vygeneroval z labelu bez diakritiky, ne z kanonických
  // hodnot). Bez normalizace by šly TYHLE řetězce do sloupce `vzhled`
  // nezměněné a DB by nebyla trojhodnotová, jak slibuje komentář u migrace.
  // `normalizeVzhledForStorage` níž řeší oboje najednou (prázdné i syrové).
  const vzhledRaw = normalizeVzhledForStorage(extractVzhled(session.custom_fields), session.id);
  const now = deps.now();
  const validUntilDate = addYears(now, 1);
  const validUntilIso = isoDate(validUntilDate);

  let insertedId: string | null = null;
  let lastCode = '';
  for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt++) {
    lastCode = deps.generateCode(now.getFullYear());
    let outcome: InsertOutcome;
    try {
      outcome = await deps.tryInsertVoucher({
        stripe_event_id: event.id,
        stripe_session_id: session.id ?? null,
        payment_link_id: paymentLinkId,
        varianta: variant.varianta,
        buyer_email: buyerEmail,
        recipient_name: recipientNameRaw || null,
        code: lastCode,
        valid_until: validUntilIso,
        status: 'vydan',
        vzhled: vzhledRaw,
      });
    } catch (e) {
      deps.logError('tryInsertVoucher selhalo (DB chyba), žádám Stripe o retry', { eventId: event.id, error: String(e) });
      return { status: 'retry', retry: true, reason: `insert failed: ${String(e)}` };
    }

    if (outcome.kind === 'inserted') {
      insertedId = outcome.id;
      break;
    }

    if (outcome.kind === 'event_duplicate') {
      // Souběžný request (race) stihl vložit řádek dřív. Dohledej ho a dokonči
      // doručení místo tichého zahození (stejná logika jako `existing` výš).
      let raced: ExistingVoucher | null;
      try {
        raced = await deps.findByEventId(event.id);
      } catch (e) {
        deps.logError('findByEventId po race selhalo, žádám Stripe o retry', { eventId: event.id, error: String(e) });
        return { status: 'retry', retry: true, reason: `race lookup failed: ${String(e)}` };
      }
      if (!raced) {
        return { status: 'retry', retry: true, reason: 'event_duplicate but row not found' };
      }
      if (raced.mailSentAt) return { status: 'duplicate_mailed', retry: false, reason: event.id };
      return resumeAndSendMail(raced, variant, deps, config, event.id);
    }
    // 'code_collision' → smyčka pokračuje s novým kódem.
  }

  if (!insertedId) {
    deps.logError('generování kódu vyčerpalo pokusy (kolize), žádám Stripe o retry', {
      eventId: event.id,
      attempts: MAX_CODE_ATTEMPTS,
    });
    return { status: 'retry', retry: true, reason: 'code generation exhausted' };
  }

  return deliverVoucher(
    insertedId,
    buyerEmail,
    recipientNameRaw,
    lastCode,
    czechDate(validUntilDate),
    czechDate(now),
    vzhledRaw,
    variant,
    deps,
    config,
    event.id,
  );
}
