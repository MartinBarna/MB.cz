// Odhlašovací token EN mailingu (13. 10. 2026). ⛔ STEJNÝ KÓD JE V en-mailing/logic.ts
// (funkce se nasazují každá ze své složky, sdílený import přes ../ by po nasazení chyběl).
// Shodu obou kopií hlídá en-mailing/logic_test.ts ("token: en-mailing a en-unsubscribe dávají totéž").
//
// token = HMAC-SHA256(klíč, e-mail malými písmeny), base64url bez paddingu.
// klíč  = secret EN_UNSUB_SECRET, když je nastavený (aspoň 16 znaků),
//         jinak sha256hex("en-unsub|" + SUPABASE_SERVICE_ROLE_KEY) (stejný princip jako sůl v en-lead).
// ⚠️ Rotace service-role klíče bez EN_UNSUB_SECRET zneplatní odkazy ve všech už odeslaných mailech.

export async function sha256hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function deriveUnsubKey(serviceKey: string, override?: string | null): Promise<string> {
  if (override && override.length >= 16) return override;
  if (!serviceKey) return "";
  return await sha256hex("en-unsub|" + serviceKey);
}

function b64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function unsubToken(email: string, key: string): Promise<string> {
  if (!key) throw new Error("unsub key missing");
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(email.trim().toLowerCase()));
  return b64url(new Uint8Array(sig));
}

export async function verifyUnsubToken(email: string, token: string, key: string): Promise<boolean> {
  if (!email || !token || !key) return false;
  const expected = await unsubToken(email, key);
  if (expected.length !== token.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ token.charCodeAt(i);
  return diff === 0;
}
