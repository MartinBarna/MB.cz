// Spustit: deno test --no-lock supabase/functions/poukaz-vydat/__tests__/core.test.ts
// Offline simulace webhooku: fake DB v paměti, fake PDF/mail. Pokrývá zadání
// (idempotence, neznámý payment_link, test pojistka, extrakce jména, kolize
// kódu) A tři blokující nálezy z nezávislé revize (Cursor, 25. 8. 2026):
//  1) DB chyba PŘED insertem → retry:true (5xx), nikdy tiché 200.
//  2) Řádek existuje ale mail_sent_at je null → mail se pošle ZNOVU (resume),
//     ne tiché 'duplicate'.
//  3) DB chyba se MUSÍ probublat jako throw (deps kontrakt), core.ts na to
//     spoléhá a mapuje throw → retry:true.
import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  extractRecipientName,
  extractVzhled,
  handleStripeEvent,
  MAIL_VARIANTA_LABELS,
  type CoreDeps,
  type ExistingVoucher,
  type InsertOutcome,
  type StripeEvent,
  type VoucherInsertRow,
} from '../core.ts';

const VARIANTS: Record<string, { varianta: string; nazevNaPoukaz: string }> = {
  plink_konzultace: { varianta: 'konzultace', nazevNaPoukaz: 'Online konzultace s Martinem' },
  plink_balicek349: { varianta: 'balicek349', nazevNaPoukaz: '40 receptů a 48 odpovědí' },
};

type Row = {
  id: string;
  stripe_event_id: string;
  code: string;
  buyer_email: string;
  recipient_name: string | null;
  valid_until: string;
  created_at: string;
  mail_sent_at: string | null;
  status: 'vydan' | 'chyba';
  vzhled: string;
};

/** Fake DB v paměti + počítadla volání, aby šlo ověřit idempotenci, retry i resume. */
function makeFakeDeps(opts: {
  codesToReturn?: string[];
  codeCollisions?: Set<string>;
  mailOk?: boolean;
  mailError?: string;
  failVariantLookup?: boolean;
  failFindByEventId?: boolean;
  failInsertWithUnknownError?: boolean;
} = {}) {
  const rows = new Map<string, Row>();
  const byEvent = new Map<string, string>();
  let mailCalls = 0;
  let pdfCalls = 0;
  let codeIdx = 0;
  const errors: Array<{ message: string; meta: Record<string, unknown> }> = [];

  function toExisting(r: Row): ExistingVoucher {
    return {
      id: r.id,
      code: r.code,
      buyerEmail: r.buyer_email,
      recipientName: r.recipient_name,
      validUntilIso: r.valid_until,
      createdAtIso: r.created_at,
      mailSentAt: r.mail_sent_at,
      vzhled: r.vzhled,
    };
  }

  const deps: CoreDeps = {
    async findByEventId(eventId) {
      if (opts.failFindByEventId) throw new Error('DB výpadek (simulováno)');
      const id = byEvent.get(eventId);
      if (!id) return null;
      return toExisting(rows.get(id)!);
    },
    async variantForPaymentLink(paymentLinkId) {
      if (opts.failVariantLookup) throw new Error('DB výpadek (simulováno)');
      return VARIANTS[paymentLinkId] ?? null;
    },
    async tryInsertVoucher(row: VoucherInsertRow): Promise<InsertOutcome> {
      if (opts.failInsertWithUnknownError) throw new Error('insert poukazy selhal: connection reset');
      if (byEvent.has(row.stripe_event_id)) return { kind: 'event_duplicate' };
      if (opts.codeCollisions?.has(row.code)) return { kind: 'code_collision' };
      const id = `row_${rows.size + 1}`;
      rows.set(id, {
        id,
        stripe_event_id: row.stripe_event_id,
        code: row.code,
        buyer_email: row.buyer_email,
        recipient_name: row.recipient_name,
        valid_until: row.valid_until,
        created_at: '2026-08-25T12:00:00.000Z',
        mail_sent_at: null,
        status: 'vydan',
        vzhled: row.vzhled,
      });
      byEvent.set(row.stripe_event_id, id);
      return { kind: 'inserted', id };
    },
    async markMailSent(id) {
      const r = rows.get(id);
      if (r) r.mail_sent_at = '2026-08-25T12:00:01.000Z';
    },
    async markStatus(id, status) {
      const r = rows.get(id);
      if (r) r.status = status;
    },
    async buildPdf() {
      pdfCalls++;
      return new Uint8Array([1, 2, 3]);
    },
    async sendMail() {
      mailCalls++;
      if (opts.mailOk === false) return { ok: false, error: opts.mailError ?? 'boom' };
      return { ok: true };
    },
    generateCode() {
      const c = opts.codesToReturn?.[codeIdx] ?? `MB-2026-C${codeIdx}XX`.slice(0, 12);
      codeIdx++;
      return c;
    },
    now: () => new Date('2026-08-25T12:00:00Z'),
    logError: (message, meta) => errors.push({ message, meta }),
  };

  return { deps, rows, mailCallsRef: () => mailCalls, pdfCallsRef: () => pdfCalls, errors };
}

const CONFIG = { ostry: false, testRecipient: 'fitness.barna@gmail.com', mailFrom: 'Martin Barna <news@martinbarna.cz>' };

function checkoutEvent(over: Partial<{
  id: string;
  paymentLink: string | { id?: string | null } | null;
  email: string | null;
  customFields: unknown[];
}> = {}): StripeEvent {
  return {
    id: over.id ?? 'evt_1',
    type: 'checkout.session.completed',
    data: {
      object: {
        id: 'cs_test_1',
        payment_link: over.paymentLink === undefined ? 'plink_konzultace' : over.paymentLink,
        customer_details: { email: over.email === undefined ? 'buyer@example.com' : over.email },
        custom_fields: over.customFields ?? [],
      },
    },
  };
}

Deno.test('neznámý payment_link → ignored, retry:false, žádný zápis, žádný mail', async () => {
  const { deps, rows, mailCallsRef } = makeFakeDeps();
  const result = await handleStripeEvent(checkoutEvent({ paymentLink: 'plink_neexistuje' }), deps, CONFIG);
  assertEquals(result.status, 'ignored');
  assertEquals(result.retry, false);
  assertEquals(rows.size, 0);
  assertEquals(mailCallsRef(), 0);
});

Deno.test('jiný event type (ne checkout.session.completed) → ignored, retry:false', async () => {
  const { deps, mailCallsRef } = makeFakeDeps();
  const event: StripeEvent = { id: 'evt_x', type: 'invoice.paid', data: { object: {} } };
  const result = await handleStripeEvent(event, deps, CONFIG);
  assertEquals(result.status, 'ignored');
  assertEquals(result.retry, false);
  assertEquals(mailCallsRef(), 0);
});

Deno.test('chybějící e-mail kupujícího → retry:true (5xx), žádný zápis', async () => {
  const { deps, rows } = makeFakeDeps();
  const result = await handleStripeEvent(checkoutEvent({ email: null }), deps, CONFIG);
  assertEquals(result.status, 'retry');
  assertEquals(result.retry, true);
  assertEquals(rows.size, 0);
});

Deno.test('happy path: vloží řádek, pošle mail; test pojistka (ostry=false) přepíše příjemce a přidá [TEST]', async () => {
  const { deps, rows, pdfCallsRef } = makeFakeDeps({ codesToReturn: ['MB-2026-AAAA'] });
  let capturedTo = '';
  let capturedSubject = '';
  deps.sendMail = async (input) => {
    capturedTo = input.to;
    capturedSubject = input.subject;
    return { ok: true };
  };
  const result = await handleStripeEvent(checkoutEvent(), deps, CONFIG);
  assertEquals(result.status, 'mailed');
  assertEquals(result.retry, false);
  assertEquals(rows.size, 1);
  assertEquals(pdfCallsRef(), 1);
  assertEquals(capturedTo, 'fitness.barna@gmail.com');
  assert(capturedSubject.startsWith('[TEST] '), `subjekt nemá [TEST] prefix: "${capturedSubject}"`);
});

Deno.test('POUKAZ_OSTRY=1 (ostry:true) pošle na skutečnou adresu kupujícího, bez [TEST]', async () => {
  const { deps } = makeFakeDeps({ codesToReturn: ['MB-2026-BBBB'] });
  let capturedTo = '';
  let capturedSubject = '';
  deps.sendMail = async (input) => {
    capturedTo = input.to;
    capturedSubject = input.subject;
    return { ok: true };
  };
  const result = await handleStripeEvent(checkoutEvent({ email: 'zakaznik@example.com' }), deps, { ...CONFIG, ostry: true });
  assertEquals(result.status, 'mailed');
  assertEquals(capturedTo, 'zakaznik@example.com');
  assert(!capturedSubject.startsWith('[TEST]'));
});

Deno.test('idempotence: 2x tentýž stripe_event_id PO ÚSPĚŠNÉM mailu → druhý je duplicate_mailed, mail se pošle jen jednou', async () => {
  const { deps, rows, mailCallsRef } = makeFakeDeps({ codesToReturn: ['MB-2026-CCCC'] });
  const event = checkoutEvent({ id: 'evt_dup' });
  const first = await handleStripeEvent(event, deps, CONFIG);
  const second = await handleStripeEvent(event, deps, CONFIG);
  assertEquals(first.status, 'mailed');
  assertEquals(second.status, 'duplicate_mailed');
  assertEquals(second.retry, false);
  assertEquals(rows.size, 1, 'druhé doručení nesmí vyrobit druhý řádek');
  assertEquals(mailCallsRef(), 1, 'mail se nesmí poslat podruhé, když už jednou prošel');
});

Deno.test('NÁLEZ 2 (Cursor): řádek existuje, ale mail_sent_at je null → druhé doručení mail DOŠLE (resume), ne duplicate', async () => {
  const { deps, rows, mailCallsRef } = makeFakeDeps({ codesToReturn: ['MB-2026-RESM'], mailOk: false });
  const event = checkoutEvent({ id: 'evt_resume' });

  const first = await handleStripeEvent(event, deps, CONFIG);
  assertEquals(first.status, 'retry', 'první pokus: mail selže, chceme retry od Stripu');
  assertEquals(rows.size, 1, 'řádek MUSÍ vzniknout i když mail selhal');
  assertEquals([...rows.values()][0].mail_sent_at, null);
  assertEquals([...rows.values()][0].status, 'chyba');

  // Stripe zopakuje TENTÝŽ event (retry:true → 503 → Stripe to zkusí znovu).
  // Tentokrát mail projde.
  deps.sendMail = async () => ({ ok: true });
  const second = await handleStripeEvent(event, deps, CONFIG);
  assertEquals(second.status, 'mailed', 'resume musí dokončit doručení, ne vrátit tiché duplicate');
  assertEquals(second.retry, false);
  assertEquals(rows.size, 1, 'pořád jen JEDEN řádek, resume nevytváří nový');
  assertEquals([...rows.values()][0].mail_sent_at, '2026-08-25T12:00:01.000Z');
  // Počítadlo z makeFakeDeps zachytilo jen 1. pokus, protože 2. přepsal
  // `deps.sendMail` úplně novou funkcí (viz výš), skutečné odeslání ověřuje
  // `mail_sent_at` na řádku, ne tenhle counter.
  assertEquals(mailCallsRef(), 1);

  // Třetí doručení: mail už je poslaný, teď už opravdu duplicate.
  let thirdMailCalled = false;
  deps.sendMail = async () => {
    thirdMailCalled = true;
    return { ok: true };
  };
  const third = await handleStripeEvent(event, deps, CONFIG);
  assertEquals(third.status, 'duplicate_mailed');
  assert(!thirdMailCalled, 'po úspěšném mailu se už neposílá znovu');
});

Deno.test('NÁLEZ 1+3 (Cursor): DB chyba při hledání varianty → retry:true, nikdy tiché 200/ignored', async () => {
  const { deps, rows } = makeFakeDeps({ failVariantLookup: true });
  const result = await handleStripeEvent(checkoutEvent(), deps, CONFIG);
  assertEquals(result.status, 'retry');
  assertEquals(result.retry, true);
  assertEquals(rows.size, 0);
});

Deno.test('NÁLEZ 1+3 (Cursor): DB chyba při findByEventId → retry:true', async () => {
  const { deps } = makeFakeDeps({ failFindByEventId: true });
  const result = await handleStripeEvent(checkoutEvent(), deps, CONFIG);
  assertEquals(result.status, 'retry');
  assertEquals(result.retry, true);
});

Deno.test('NÁLEZ 1+3 (Cursor): neznámá chyba insertu (ne UNIQUE) → retry:true, nikdy tichý throw do 200', async () => {
  const { deps, rows } = makeFakeDeps({ failInsertWithUnknownError: true });
  const result = await handleStripeEvent(checkoutEvent({ id: 'evt_insertfail' }), deps, CONFIG);
  assertEquals(result.status, 'retry');
  assertEquals(result.retry, true);
  assertEquals(rows.size, 0);
});

Deno.test('kolize kódu: retry vygeneruje nový kód a vloží se až ten nekolidující', async () => {
  const collisions = new Set(['MB-2026-DUP1', 'MB-2026-DUP2']);
  const { deps, rows } = makeFakeDeps({
    codesToReturn: ['MB-2026-DUP1', 'MB-2026-DUP2', 'MB-2026-OKOK'],
    codeCollisions: collisions,
  });
  const result = await handleStripeEvent(checkoutEvent({ id: 'evt_retry' }), deps, CONFIG);
  assertEquals(result.status, 'mailed');
  assertEquals(rows.size, 1);
  const row = [...rows.values()][0];
  assertEquals(row.code, 'MB-2026-OKOK');
});

Deno.test('kolize kódu vyčerpá všech 5 pokusů → retry:true, nic se neuloží', async () => {
  const codes = ['A', 'B', 'C', 'D', 'E'].map((s) => `MB-2026-${s}${s}${s}${s}`);
  const { deps, rows } = makeFakeDeps({ codesToReturn: codes, codeCollisions: new Set(codes) });
  const result = await handleStripeEvent(checkoutEvent({ id: 'evt_exhaust' }), deps, CONFIG);
  assertEquals(result.status, 'retry');
  assertEquals(result.retry, true);
  assertEquals(rows.size, 0);
});

Deno.test('selhání buildPdf: nespadne, uloží status "chyba", vrátí retry:true (ne throw ven)', async () => {
  const { deps, rows } = makeFakeDeps({ codesToReturn: ['MB-2026-PDFX'] });
  deps.buildPdf = async () => {
    throw new Error('font selhal');
  };
  const result = await handleStripeEvent(checkoutEvent({ id: 'evt_pdffail' }), deps, CONFIG);
  assertEquals(result.status, 'retry');
  assert(result.reason?.includes('pdf/mail error'));
  const row = [...rows.values()][0];
  assertEquals(row.status, 'chyba');
});

// --- extractRecipientName -----------------------------------------------------

Deno.test('extractRecipientName: bere pole s klíčem komujedrekjmnoobdarovanho', () => {
  const name = extractRecipientName([
    { key: 'jiny_klic', type: 'text', text: { value: 'Špatně' } },
    { key: 'komujedrekjmnoobdarovanho', type: 'text', text: { value: 'Jana Nováková' } },
  ]);
  assertEquals(name, 'Jana Nováková');
});

Deno.test('extractRecipientName: fallback na první textové pole, když klíč chybí', () => {
  const name = extractRecipientName([
    { key: 'neco_jineho', type: 'text', text: { value: 'Petr Svoboda' } },
  ]);
  assertEquals(name, 'Petr Svoboda');
});

Deno.test('extractRecipientName: prázdné/chybějící custom_fields → prázdný řetězec', () => {
  assertEquals(extractRecipientName([]), '');
  assertEquals(extractRecipientName(null), '');
  assertEquals(extractRecipientName(undefined), '');
});

Deno.test('extractRecipientName: přeskočí prázdné hodnoty a najde první neprázdnou', () => {
  const name = extractRecipientName([
    { key: 'x', type: 'text', text: { value: '   ' } },
    { key: 'komujedrekjmnoobdarovanho', type: 'text', text: { value: '' } },
    { key: 'y', type: 'text', text: { value: 'Až tady' } },
  ]);
  assertEquals(name, 'Až tady');
});

// --- payment_link jako expandovaný objekt (nález 5) ---------------------------

Deno.test('payment_link jako expandovaný objekt {id,...} se přijme stejně jako string', async () => {
  const { deps, rows } = makeFakeDeps({ codesToReturn: ['MB-2026-OBJ1'] });
  const result = await handleStripeEvent(
    checkoutEvent({ id: 'evt_obj', paymentLink: { id: 'plink_konzultace', object: 'payment_link' } as unknown as string }),
    deps,
    CONFIG,
  );
  assertEquals(result.status, 'mailed');
  assertEquals(rows.size, 1);
});

Deno.test('payment_link s neočekávaným tvarem (bez id) se zaloguje a ignoruje, ne spadne', async () => {
  const { deps, errors } = makeFakeDeps();
  const result = await handleStripeEvent(
    checkoutEvent({ paymentLink: { foo: 'bar' } as unknown as string }),
    deps,
    CONFIG,
  );
  assertEquals(result.status, 'ignored');
  assertEquals(result.retry, false);
  assert(errors.some((e) => e.message.includes('neočekávaný tvar')));
});

// --- MAIL_VARIANTA_LABELS pokrývá reálné 4 varianty --------------------------

Deno.test('MAIL_VARIANTA_LABELS má krátkou frázi pro všechny 4 nasazené varianty', () => {
  for (const v of ['konzultace', 'videokurz', 'academy', 'balicek349']) {
    assert(v in MAIL_VARIANTA_LABELS, `chybí mailová fráze pro variantu "${v}"`);
    assert(MAIL_VARIANTA_LABELS[v].length > 0);
  }
});

// --- extractVzhled ------------------------------------------------------------

Deno.test('extractVzhled: bere pole s klíčem vzhledpoukazu a dropdown.value', () => {
  const vzhled = extractVzhled([
    { key: 'jiny_klic', type: 'dropdown', dropdown: { value: 'svetla' } },
    { key: 'vzhledpoukazu', type: 'dropdown', dropdown: { value: 'slavnostni' } },
  ]);
  assertEquals(vzhled, 'slavnostni');
});

Deno.test('extractVzhled: chybějící pole / prázdné / špatný typ → prázdný řetězec', () => {
  assertEquals(extractVzhled([]), '');
  assertEquals(extractVzhled(null), '');
  assertEquals(extractVzhled(undefined), '');
  assertEquals(extractVzhled([{ key: 'vzhledpoukazu', type: 'text', text: { value: 'svetla' } }]), '');
  assertEquals(extractVzhled([{ key: 'neco_jineho', type: 'dropdown', dropdown: { value: 'svetla' } }]), '');
  assertEquals(extractVzhled([{ key: 'vzhledpoukazu', type: 'dropdown', dropdown: { value: '' } }]), '');
  assertEquals(extractVzhled([{ key: 'vzhledpoukazu', type: 'dropdown', dropdown: { value: '   ' } }]), '');
  assertEquals(extractVzhled([{ key: 'vzhledpoukazu', type: 'dropdown' }]), '');
});

Deno.test('handleStripeEvent: vzhled z custom_fields doputuje do buildPdf i do insert řádku', async () => {
  const { deps, rows } = makeFakeDeps({ codesToReturn: ['MB-2026-VZHL'] });
  let capturedVzhled = '';
  deps.buildPdf = async (input) => {
    capturedVzhled = input.vzhled;
    return new Uint8Array([1, 2, 3]);
  };
  const result = await handleStripeEvent(
    checkoutEvent({
      id: 'evt_vzhled',
      customFields: [{ key: 'vzhledpoukazu', type: 'dropdown', dropdown: { value: 'svetla' } }],
    }),
    deps,
    CONFIG,
  );
  assertEquals(result.status, 'mailed');
  assertEquals(capturedVzhled, 'svetla');
  assertEquals([...rows.values()][0].vzhled, 'svetla');
});

// Nález nezávislé revize (Cursor, 26. 8. 2026, po nasazení): živý Academy
// checkout posílá SYROVOU Stripe hodnotu (Stripe si `value` dropdownu
// vygeneroval z labelu bez diakritiky), ne kanonickou. Přesně tenhle payload
// (`dropdown.value: 'svtlnatisk'`) chodí z API, jinde otestovaný jen s
// kanonickým `'svetla'`.
Deno.test('handleStripeEvent se SYROVOU Stripe hodnotou (svtlnatisk) uloží kanonickou "svetla", ne syrový tvar', async () => {
  const { deps, rows } = makeFakeDeps({ codesToReturn: ['MB-2026-RAWV'] });
  let capturedVzhled = '';
  deps.buildPdf = async (input) => {
    capturedVzhled = input.vzhled;
    return new Uint8Array([1, 2, 3]);
  };
  const result = await handleStripeEvent(
    checkoutEvent({
      id: 'evt_raw_vzhled',
      customFields: [{ key: 'vzhledpoukazu', type: 'dropdown', dropdown: { value: 'svtlnatisk' } }],
    }),
    deps,
    CONFIG,
  );
  assertEquals(result.status, 'mailed');
  assertEquals(capturedVzhled, 'svetla');
  assertEquals([...rows.values()][0].vzhled, 'svetla');
});

// Nález z nasazení (26. 8. 2026): dřív se prázdný custom_fields (starší
// checkout bez pole `vzhledpoukazu`) ukládal do DB jako '' - třetí/čtvrtá
// hodnota vedle 'tmava'/'svetla'/'slavnostni'. `handleStripeEvent` teď musí
// uložit rovnou 'tmava', ať sloupec `vzhled` v `poukazy` nikdy neobsahuje ''.
Deno.test('chybějící custom_fields (starší checkout) → vzhled se uloží jako "tmava", NE prázdný řetězec', async () => {
  const { deps, rows } = makeFakeDeps({ codesToReturn: ['MB-2026-STAR'] });
  let capturedVzhled = '';
  deps.buildPdf = async (input) => {
    capturedVzhled = input.vzhled;
    return new Uint8Array([1, 2, 3]);
  };
  const result = await handleStripeEvent(
    checkoutEvent({ id: 'evt_bez_vzhledu', customFields: [] }),
    deps,
    CONFIG,
  );
  assertEquals(result.status, 'mailed');
  assertEquals(capturedVzhled, 'tmava');
  assertEquals([...rows.values()][0].vzhled, 'tmava');
});

Deno.test('resume: uložený vzhled slavnostni se použije i když nový event má jiné/prázdné custom_fields', async () => {
  const { deps, rows } = makeFakeDeps({ codesToReturn: ['MB-2026-RESV'], mailOk: false });
  const firstEvent = checkoutEvent({
    id: 'evt_vzhled_resume',
    customFields: [{ key: 'vzhledpoukazu', type: 'dropdown', dropdown: { value: 'slavnostni' } }],
  });
  const first = await handleStripeEvent(firstEvent, deps, CONFIG);
  assertEquals(first.status, 'retry');
  assertEquals([...rows.values()][0].vzhled, 'slavnostni');

  let capturedVzhled = '';
  deps.buildPdf = async (input) => {
    capturedVzhled = input.vzhled;
    return new Uint8Array([1, 2, 3]);
  };
  deps.sendMail = async () => ({ ok: true });
  const second = await handleStripeEvent(
    checkoutEvent({
      id: 'evt_vzhled_resume',
      customFields: [{ key: 'vzhledpoukazu', type: 'dropdown', dropdown: { value: 'svetla' } }],
    }),
    deps,
    CONFIG,
  );
  assertEquals(second.status, 'mailed');
  assertEquals(capturedVzhled, 'slavnostni', 'resume musí brát vzhled z uloženého řádku, ne z nového eventu');
});

Deno.test('prázdné jméno obdarovaného → mail dostane "pro tebe"', async () => {
  const { deps } = makeFakeDeps({ codesToReturn: ['MB-2026-NONA'] });
  let capturedName = '';
  deps.sendMail = async (input) => {
    capturedName = input.recipientDisplayName;
    return { ok: true };
  };
  await handleStripeEvent(checkoutEvent({ id: 'evt_noname', customFields: [] }), deps, CONFIG);
  assertEquals(capturedName, 'pro tebe');
});
