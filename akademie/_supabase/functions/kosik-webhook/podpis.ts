// HMAC kontrola podpisu Stripe. Stejne okno 300 s jako academy-stripe-webhook.
// Tajemstvi se predavaji zvenku, v tomhle souboru zadna hodnota neni.

export async function hmacHex(secret: string, payload: string): Promise<string> {
  const klic = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const podpis = await crypto.subtle.sign("HMAC", klic, new TextEncoder().encode(payload));
  return [...new Uint8Array(podpis)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function podepis(secret: string, raw: string, ts = Math.floor(Date.now() / 1000)): Promise<string> {
  const v1 = await hmacHex(secret, `${ts}.${raw}`);
  return `t=${ts},v1=${v1}`;
}

export async function overPodpisStripe(
  raw: string,
  hlavicka: string,
  tajemstvi: string[],
  nowMs = Date.now(),
): Promise<boolean> {
  const secrety = tajemstvi.filter((s) => s && s.length > 0);
  if (!secrety.length || !hlavicka) return false;
  const casti = Object.fromEntries(
    hlavicka.split(",").map((p) => {
      const i = p.indexOf("=");
      return [p.slice(0, i).trim(), p.slice(i + 1).trim()];
    }),
  );
  const ts = casti["t"];
  const v1 = casti["v1"];
  if (!ts || !v1) return false;
  const stariS = Math.abs(nowMs / 1000 - Number(ts));
  if (!Number.isFinite(stariS) || stariS > 300) return false;
  for (const t of secrety) {
    const ocekavano = await hmacHex(t, `${ts}.${raw}`);
    if (ocekavano.length !== v1.length) continue;
    let rozdil = 0;
    for (let i = 0; i < ocekavano.length; i++) rozdil |= ocekavano.charCodeAt(i) ^ v1.charCodeAt(i);
    if (rozdil === 0) return true;
  }
  return false;
}
