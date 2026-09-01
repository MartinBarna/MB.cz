// =============================================================================
// AI Martin — Fáze 7: ověření podpisu Stripe webhooku (Web Crypto).
// ŽELEZNÉ PRAVIDLO: webhook MUSÍ ověřit podpis, jinak kdokoli podvrhne event.
//
// Implementujeme Stripeovo schéma sami přes Web Crypto (HMAC-SHA256) — je
// dostupné v Deno i Node 18+, takže ten samý kód jde otestovat offline v Node
// (ne přes Stripe SDK, které v Deno potřebuje async provider). Čistý modul,
// žádné Deno globály.
//
// Hlavička `Stripe-Signature: t=<unix>,v1=<hex>[,v1=<hex>…]`
//   signed_payload = `${t}.${raw body}`
//   v1 = hex( HMAC-SHA256(signed_payload, signing_secret) )
// =============================================================================

const enc = new TextEncoder();

function hex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Konstantní-čas porovnání dvou stejně dlouhých hex řetězců. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function hmacSha256Hex(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(payload));
  return hex(sig);
}

export type VerifyResult = { ok: boolean; reason?: string };

/**
 * Ověří podpis Stripe webhooku. `nowSec` je injektovatelné kvůli deterministickým
 * testům (jinak aktuální čas). `toleranceSec` brání replay starých eventů (default 300).
 */
export async function verifyStripeSignature(
  payload: string,
  sigHeader: string | null,
  secret: string,
  opts: { toleranceSec?: number; nowSec?: number } = {},
): Promise<VerifyResult> {
  if (!secret) return { ok: false, reason: 'missing signing secret' };
  if (!sigHeader) return { ok: false, reason: 'missing signature header' };

  const tolerance = opts.toleranceSec ?? 300;
  const now = opts.nowSec ?? Math.floor(Date.now() / 1000);

  let t: number | null = null;
  const v1: string[] = [];
  for (const part of sigHeader.split(',')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (k === 't') t = Number(v);
    else if (k === 'v1') v1.push(v);
  }
  if (t === null || Number.isNaN(t)) return { ok: false, reason: 'no timestamp' };
  if (v1.length === 0) return { ok: false, reason: 'no v1 signature' };
  if (Math.abs(now - t) > tolerance) return { ok: false, reason: 'timestamp outside tolerance' };

  const expected = await hmacSha256Hex(secret, `${t}.${payload}`);
  const match = v1.some((sig) => timingSafeEqual(sig, expected));
  return match ? { ok: true } : { ok: false, reason: 'signature mismatch' };
}
