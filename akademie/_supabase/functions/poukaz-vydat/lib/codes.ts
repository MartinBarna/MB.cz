// =============================================================================
// poukaz-vydat: generování kódu poukazu server-side.
// Stejná abeceda a formát jako klientský generátor v poukaz.html (MB-ROK-XXXX),
// jen se to teď dělá na serveru s DB UNIQUE pojistkou místo kontroly Ctrl+F
// v Markdown evidenci. Kolize řeší volající: insert do `poukazy` s UNIQUE(code),
// při conflictu zavolá znovu (viz core.ts retry smyčka).
// =============================================================================

// Bez I, L, O, 0, 1, tyhle znaky se při přepisování z papíru pletou.
export const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LEN = 4;

/** Nový kód ve tvaru MB-2026-K7QM. `year` injektovatelný kvůli testům. */
export function generateVoucherCode(year: number = new Date().getFullYear()): string {
  const bytes = new Uint32Array(CODE_LEN);
  crypto.getRandomValues(bytes);
  let s = '';
  for (let i = 0; i < CODE_LEN; i++) {
    const idx = bytes[i] % CODE_ALPHABET.length;
    s += CODE_ALPHABET.charAt(idx);
  }
  return `MB-${year}-${s}`;
}

const CODE_RE = /^MB-\d{4}-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{4}$/;

export function isValidVoucherCode(code: string): boolean {
  return CODE_RE.test(code);
}
