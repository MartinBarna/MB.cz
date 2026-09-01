// =============================================================================
// poukaz-vydat: mail s PDF přílohou přes přímý Resend fetch (vzor appčino
// stripe-webhook/withdrawal-request, `_shared` v appce). Resend `attachments`
// (base64 content) appka/Academy dosud NEPOUŽÍVALY (potvrzeno v průzkumu
// 25. 8. 2026), tohle je první nasazení té cesty, proto testovací mail
// v __tests__ a POUKAZ_OSTRY pojistka v index.ts.
//
// ⛔ Text mailu je PŘESNĚ podle zadání od šéfa, NEMĚNIT bez jeho svolení.
// Žádná dlouhá pomlčka (—) nikde v textu pro lidi.
// =============================================================================

export type VoucherMailInput = {
  to: string;
  subject: string;
  fromLabel: string;
  variantaMailText: string; // krátká fráze pro "PDF poukaz na {varianta}" (akuzativ)
  recipientDisplayName: string; // jméno pro '{jméno}', fallback 'pro tebe' už vyřešeno voláním
  validUntilCzech: string; // '25. 8. 2027'
  pdfBytes: Uint8Array;
  pdfFilename: string;
};

export function buildVoucherMailBody(input: {
  variantaMailText: string;
  recipientDisplayName: string;
  validUntilCzech: string;
}): { text: string; html: string } {
  const text =
    `Ahoj, díky za nákup! V příloze najdeš PDF poukaz na ${input.variantaMailText} pro ${input.recipientDisplayName}. ` +
    `Platí rok, do ${input.validUntilCzech}. Vytiskni ho na A4, nebo ho prostě pošli dál. ` +
    `Až bude obdarovaný chtít začít, napíše mi s kódem z poukazu a domluvíme se přímo spolu. ` +
    `Kdyby cokoliv, stačí odepsat na tenhle mail. Be Effective! Martin`;

  const html =
    `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#1a1a1a;max-width:560px;">` +
    `<p>Ahoj, díky za nákup! V příloze najdeš PDF poukaz na ${escapeHtml(input.variantaMailText)} pro ${escapeHtml(input.recipientDisplayName)}.</p>` +
    `<p>Platí rok, do ${escapeHtml(input.validUntilCzech)}. Vytiskni ho na A4, nebo ho prostě pošli dál.</p>` +
    `<p>Až bude obdarovaný chtít začít, napíše mi s kódem z poukazu a domluvíme se přímo spolu.</p>` +
    `<p>Kdyby cokoliv, stačí odepsat na tenhle mail.</p>` +
    `<p>Be Effective!<br>Martin</p>` +
    `</div>`;

  return { text, html };
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

/** Vrací true, jen když Resend zásilku PŘIJAL (vzor withdrawal-request). */
export async function sendVoucherMail(
  resendApiKey: string,
  input: VoucherMailInput,
): Promise<{ ok: boolean; error?: string }> {
  if (!resendApiKey) return { ok: false, error: 'missing RESEND_API_KEY' };

  const body = buildVoucherMailBody({
    variantaMailText: input.variantaMailText,
    recipientDisplayName: input.recipientDisplayName,
    validUntilCzech: input.validUntilCzech,
  });

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${resendApiKey}` },
      body: JSON.stringify({
        from: input.fromLabel,
        to: [input.to],
        reply_to: 'martin@martinbarna.cz',
        subject: input.subject,
        text: body.text,
        html: body.html,
        attachments: [
          { filename: input.pdfFilename, content: bytesToBase64(input.pdfBytes) },
        ],
      }),
    });
    if (!res.ok) {
      const errText = await res.text();
      return { ok: false, error: `Resend ${res.status}: ${errText}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}
