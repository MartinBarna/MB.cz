// Simulovaný webhook end-to-end: postaví RAW tělo (přesně jak by ho poslal
// Stripe), podepíše ho testovacím secretem přes hmacSha256Hex (STEJNÁ cesta,
// jakou používá _shared/signature.ts), ověří přes verifyStripeSignature a
// teprve pak zavolá handleStripeEvent, přesně pořadí kroků z index.ts.
// Ověřuje: špatný/chybějící podpis se ODMÍTNE ještě PŘED core.ts; platný
// podpis + 2x stejné tělo (retry ze Stripu) = idempotentně 1 zpracování;
// a (po revizi, Cursor 25. 8. 2026) že `result.retry` se mapuje na HTTP
// status stejně, jak to dělá index.ts (503 = ať to Stripe zopakuje).
// Spustit: deno test --no-lock supabase/functions/poukaz-vydat/__tests__/webhook-simulation.test.ts
import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { hmacSha256Hex, verifyStripeSignature } from '../../_shared/signature.ts';
import { handleStripeEvent, type CoreDeps, type ExistingVoucher, type StripeEvent } from '../core.ts';

const TEST_SECRET = 'whsec_test_tajny_klic';

async function signedHeader(payload: string, secret: string, tSec: number): Promise<string> {
  const sig = await hmacSha256Hex(secret, `${tSec}.${payload}`);
  return `t=${tSec},v1=${sig}`;
}

type Row = {
  id: string;
  code: string;
  buyer_email: string;
  recipient_name: string | null;
  valid_until: string;
  created_at: string;
  mail_sent_at: string | null;
  vzhled: string;
};

function makeDeps() {
  const rows = new Map<string, Row>();
  const byEvent = new Map<string, string>();
  let mailCalls = 0;
  const deps: CoreDeps = {
    async findByEventId(eventId) {
      const id = byEvent.get(eventId);
      if (!id) return null;
      const r = rows.get(id)!;
      const result: ExistingVoucher = {
        id: r.id,
        code: r.code,
        buyerEmail: r.buyer_email,
        recipientName: r.recipient_name,
        validUntilIso: r.valid_until,
        createdAtIso: r.created_at,
        mailSentAt: r.mail_sent_at,
        vzhled: r.vzhled,
      };
      return result;
    },
    async variantForPaymentLink(paymentLinkId) {
      return paymentLinkId === 'plink_1U8IphBq3rKubW9k61yI0Hlh'
        ? { varianta: 'konzultace', nazevNaPoukaz: 'Online konzultace s Martinem' }
        : null;
    },
    async tryInsertVoucher(row) {
      if (byEvent.has(row.stripe_event_id)) return { kind: 'event_duplicate' };
      const id = `row_${rows.size + 1}`;
      rows.set(id, {
        id,
        code: row.code,
        buyer_email: row.buyer_email,
        recipient_name: row.recipient_name,
        valid_until: row.valid_until,
        created_at: '2026-08-25T12:00:00.000Z',
        mail_sent_at: null,
        vzhled: row.vzhled,
      });
      byEvent.set(row.stripe_event_id, id);
      return { kind: 'inserted', id };
    },
    async markMailSent(id) {
      const r = rows.get(id);
      if (r) r.mail_sent_at = '2026-08-25T12:00:01.000Z';
    },
    async markStatus() {},
    async buildPdf() {
      return new Uint8Array([1, 2, 3]);
    },
    async sendMail() {
      mailCalls++;
      return { ok: true };
    },
    generateCode: (year) => `MB-${year}-SIM1`,
    now: () => new Date('2026-08-25T12:00:00Z'),
    logError: () => {},
  };
  return { deps, rows, mailCallsRef: () => mailCalls };
}

const CONFIG = { ostry: false, testRecipient: 'fitness.barna@gmail.com', mailFrom: 'Martin Barna <news@martinbarna.cz>' };

function rawBody(eventId: string): string {
  const event: StripeEvent = {
    id: eventId,
    type: 'checkout.session.completed',
    data: {
      object: {
        id: 'cs_sim_1',
        payment_link: 'plink_1U8IphBq3rKubW9k61yI0Hlh',
        customer_details: { email: 'kupujici@example.com' },
        custom_fields: [{ key: 'komujedrekjmnoobdarovanho', type: 'text', text: { value: 'Obdarovaná Osoba' } }],
      },
    },
  };
  return JSON.stringify(event);
}

Deno.test('webhook simulace: platný podpis projde, špatný secret se ODMÍTNE PŘED core.ts', async () => {
  const payload = rawBody('evt_sim_sig_1');
  const now = Math.floor(Date.now() / 1000);
  const header = await signedHeader(payload, TEST_SECRET, now);

  const okResult = await verifyStripeSignature(payload, header, TEST_SECRET);
  assert(okResult.ok, 'platný podpis musí projít');

  const badResult = await verifyStripeSignature(payload, header, 'whsec_jiny_secret');
  assert(!badResult.ok, 'podpis s jiným secretem musí selhat');

  const missingResult = await verifyStripeSignature(payload, null, TEST_SECRET);
  assert(!missingResult.ok, 'chybějící hlavička musí selhat');
});

Deno.test('webhook simulace: staré časové razítko (replay) se odmítne', async () => {
  const payload = rawBody('evt_sim_replay');
  const staleT = Math.floor(Date.now() / 1000) - 1000; // > 300s tolerance
  const header = await signedHeader(payload, TEST_SECRET, staleT);
  const result = await verifyStripeSignature(payload, header, TEST_SECRET);
  assert(!result.ok);
  assertEquals(result.reason, 'timestamp outside tolerance');
});

/** Zrcadlí přesně mapování v index.ts: podpis špatný → 400; jinak `retry`
 *  → 503 (Stripe má zopakovat), jinak 200 (hotovo nebo vědomé ignored/duplicate). */
async function simulateRequest(rawPayload: string, sigHeader: string, deps: CoreDeps) {
  const verified = await verifyStripeSignature(rawPayload, sigHeader, TEST_SECRET);
  if (!verified.ok) return { httpStatus: 400 as const };
  const event = JSON.parse(rawPayload) as StripeEvent;
  const result = await handleStripeEvent(event, deps, CONFIG);
  return { httpStatus: (result.retry ? 503 : 200) as 503 | 200, result };
}

Deno.test('webhook simulace end-to-end: ověření podpisu → handleStripeEvent, 2x stejné tělo = idempotentně 1 zápis', async () => {
  const { deps, rows, mailCallsRef } = makeDeps();
  const payload = rawBody('evt_sim_e2e');
  const now = Math.floor(Date.now() / 1000);
  const header = await signedHeader(payload, TEST_SECRET, now);

  const first = await simulateRequest(payload, header, deps);
  assertEquals(first.httpStatus, 200);
  assertEquals(first.result?.status, 'mailed');

  // Stripe retry: STEJNÝ raw payload i hlavička doručené znovu.
  const second = await simulateRequest(payload, header, deps);
  assertEquals(second.httpStatus, 200);
  assertEquals(second.result?.status, 'duplicate_mailed');

  assertEquals(rows.size, 1, 'dvojí doručení nesmí vyrobit dva poukazy');
  assertEquals(mailCallsRef(), 1, 'mail se nesmí poslat dvakrát');

  // Podvržené tělo (jiný event) se stejnou hlavičkou musí selhat na podpisu.
  const forged = await simulateRequest(rawBody('evt_podvrzeny'), header, deps);
  assertEquals(forged.httpStatus, 400);
});

Deno.test('webhook simulace: DB výpadek při zpracování → 503 (retry), ne tiché 200', async () => {
  const { deps } = makeDeps();
  deps.variantForPaymentLink = async () => {
    throw new Error('DB výpadek (simulováno)');
  };
  const payload = rawBody('evt_sim_dbfail');
  const now = Math.floor(Date.now() / 1000);
  const header = await signedHeader(payload, TEST_SECRET, now);

  const result = await simulateRequest(payload, header, deps);
  assertEquals(result.httpStatus, 503, 'DB výpadek musí vrátit 503, ať to Stripe zopakuje');
});
