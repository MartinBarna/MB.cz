// =============================================================================
// Academy: Edge Function `poukaz-vydat` (Deno). Samostatný nový Stripe webhook
// endpoint, NENÍ rozšíření academy-stripe-webhook ani appčina stripe-webhook
// (viz _Claude-dokumenty/poukaz-automatizace-pruzkum-2026-08-25.md bod 5:
// obě jsou dnes křehké a živé, nová funkce znamená menší riziko a snáz se testuje).
//
// Stripe pošle POST, ověří se podpis (POUKAZ_WEBHOOK_SECRET), zpracuje se JEN
// checkout.session.completed jejichž payment_link je v `poukaz_varianty`
// (jinak 200 a konec), idempotence běží přes UNIQUE(stripe_event_id), pak se
// vygeneruje kód, PDF (pdf-lib, lib/pdf.ts) a pošle mail s přílohou přes
// Resend (lib/mail.ts).
//
// ⛔ TEST POJISTKA: POUKAZ_OSTRY musí být přesně '1', jinak se příjemce VŽDY
// přepíše na fitness.barna@gmail.com a subjekt dostane prefix [TEST]. Řeší to
// core.ts (handleStripeEvent) centrálně, ne tady, je to bezpečnostně kritická
// větev a chceme ji pokrytou unit testy bez nutnosti Dena.
//
// ⛔ HTTP status podle nezávislé revize (Cursor, 25. 8. 2026, nález 1+3):
// `result.retry === true` → 503, ať to Stripe zopakuje (nedokončená práce,
// typicky výpadek DB nebo mailu). 200 JEN když je práce persistovaná (mail
// poslaný) nebo jde o vědomé 'ignored'/'duplicate_mailed'. Stejný vzor jako
// appčin stripe-webhook (`status === 'deferred'` → 503).
//
// Nasadit s --no-verify-jwt (Stripe JWT neposílá, bezpečnost drží podpis).
// =============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

import { verifyStripeSignature } from '../_shared/signature.ts';
import { handleStripeEvent, type CoreDeps, type ExistingVoucher, type StripeEvent } from './core.ts';
import { generateVoucherCode } from './lib/codes.ts';
import { buildVoucherPdf } from './lib/pdf.ts';
import { sendVoucherMail } from './lib/mail.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const WEBHOOK_SECRET = Deno.env.get('POUKAZ_WEBHOOK_SECRET') ?? '';
const RESEND_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const OSTRY = Deno.env.get('POUKAZ_OSTRY') === '1';
const TEST_RECIPIENT = 'fitness.barna@gmail.com';
const MAIL_FROM = 'Martin Barna <news@martinbarna.cz>';

// Nález 8 nezávislé revize: bez stropu může kdokoli (podpis to neobejde, jen
// to zahltí funkci) poslat obří tělo na veřejný --no-verify-jwt endpoint.
// Stripe eventy jsou řádově kilobajty, 256 KB je štědrá rezerva.
const MAX_BODY_BYTES = 256 * 1024;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);
  if (!WEBHOOK_SECRET) return json({ error: 'webhook secret not configured' }, 500);
  if (!SUPABASE_URL || !SERVICE_ROLE) return json({ error: 'supabase not configured' }, 500);

  const contentLength = Number(req.headers.get('content-length') ?? '0');
  if (contentLength > MAX_BODY_BYTES) return json({ error: 'payload too large' }, 413);

  const raw = await req.text();
  const sig = req.headers.get('stripe-signature');

  const verified = await verifyStripeSignature(raw, sig, WEBHOOK_SECRET);
  if (!verified.ok) {
    console.error('[poukaz-vydat] podpis neprošel:', verified.reason);
    return json({ error: `signature verification failed: ${verified.reason}` }, 400);
  }

  let event: StripeEvent;
  try {
    event = JSON.parse(raw) as StripeEvent;
  } catch {
    return json({ error: 'invalid json' }, 400);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

  const deps: CoreDeps = {
    async findByEventId(eventId) {
      const { data, error } = await admin
        .from('poukazy')
        .select('id, code, buyer_email, recipient_name, valid_until, created_at, mail_sent_at, vzhled')
        .eq('stripe_event_id', eventId)
        .maybeSingle();
      // ⛔ Nález 3 nezávislé revize: chyba DB se dřív tiše zahazovala a
      // vypadala stejně jako "řádek neexistuje". MUSÍ se probublat.
      if (error) throw new Error(`findByEventId selhal: ${error.message}`);
      if (!data) return null;
      const row = data as {
        id: string;
        code: string;
        buyer_email: string;
        recipient_name: string | null;
        valid_until: string;
        created_at: string;
        mail_sent_at: string | null;
        vzhled: string;
      };
      const result: ExistingVoucher = {
        id: row.id,
        code: row.code,
        buyerEmail: row.buyer_email,
        recipientName: row.recipient_name,
        validUntilIso: row.valid_until,
        createdAtIso: row.created_at,
        mailSentAt: row.mail_sent_at,
        vzhled: row.vzhled,
      };
      return result;
    },
    async variantForPaymentLink(paymentLinkId) {
      const { data, error } = await admin
        .from('poukaz_varianty')
        .select('varianta, nazev_na_poukaz')
        .eq('payment_link_id', paymentLinkId)
        .maybeSingle();
      if (error) throw new Error(`variantForPaymentLink selhal: ${error.message}`);
      if (!data) return null;
      const row = data as { varianta: string; nazev_na_poukaz: string };
      return { varianta: row.varianta, nazevNaPoukaz: row.nazev_na_poukaz };
    },
    async tryInsertVoucher(row) {
      const { data, error } = await admin.from('poukazy').insert(row).select('id').maybeSingle();
      if (!error) return { kind: 'inserted', id: (data as { id: string }).id };

      // 23505 = unique_violation. Rozlišit KTERÝ constraint podle `error.details`
      // (Postgres formát: "Key (sloupec)=(hodnota) already exists."), ne loose
      // substring přes celou zprávu (nález 4 nezávislé revize: `includes('code')`
      // by mohl trefit i jiný sloupec obsahující "code" v textu).
      const details = error.details ?? '';
      if (error.code === '23505' && details.includes('(code)=')) return { kind: 'code_collision' };
      if (error.code === '23505' && details.includes('(stripe_event_id)=')) return { kind: 'event_duplicate' };
      throw new Error(`insert poukazy selhal: ${error.message} ${details}`);
    },
    async markMailSent(id, at) {
      const { error } = await admin.from('poukazy').update({ mail_sent_at: at.toISOString() }).eq('id', id);
      if (error) console.error('[poukaz-vydat] markMailSent selhal:', id, error.message);
    },
    async markStatus(id, status) {
      const { error } = await admin.from('poukazy').update({ status }).eq('id', id);
      if (error) console.error('[poukaz-vydat] markStatus selhal:', id, status, error.message);
    },
    buildPdf: (input) => buildVoucherPdf(input),
    sendMail: (input) => sendVoucherMail(RESEND_KEY, input),
    generateCode: (year) => generateVoucherCode(year),
    now: () => new Date(),
    logError: (message, meta) => console.error(`[poukaz-vydat] ${message}`, meta),
  };

  try {
    const result = await handleStripeEvent(event, deps, {
      ostry: OSTRY,
      testRecipient: TEST_RECIPIENT,
      mailFrom: MAIL_FROM,
    });
    const httpStatus = result.retry ? 503 : 200;
    return json({ received: !result.retry, ...result }, httpStatus);
  } catch (e) {
    console.error('[poukaz-vydat] neočekávaná chyba:', e);
    // Neošetřená chyba: bezpečněji nechat Stripe zopakovat (503), než potichu
    // ohlásit 200 a ztratit zaplacený poukaz beze stopy (nález 1, Cursor revize).
    return json({ received: false, status: 'error', reason: 'unexpected error, logged' }, 503);
  }
});
