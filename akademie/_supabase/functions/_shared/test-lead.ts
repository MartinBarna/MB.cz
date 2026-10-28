// Testovací lead z formuláře na webu.
// Adresa fitness.barna+tester…@gmail.com (plus-adresa, „tester“ hned za plus)
// se uloží, uvítací mail s PDF odejde, do série ale nevstoupí a do počtů se nepočítá.
// Stejná podmínka v SQL: public.lead_je_test (akademie/_supabase/test-lead-filtr.sql).

/** fitness.barna+tester…@gmail.com, bez ohledu na velikost písmen. */
export const TEST_LEAD_EMAIL = /^fitness\.barna\+tester[^@]*@gmail\.com$/i;

export function jeTestovaciEmail(email: unknown): boolean {
  return TEST_LEAD_EMAIL.test(String(email ?? "").trim());
}

/** meta.test z lead-capture i z ručního úklidu (boolean i text z jsonb). */
export function maMetaTest(meta: unknown): boolean {
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return false;
  const v = (meta as Record<string, unknown>).test;
  return v === true || v === 1 || v === "true" || v === "t" || v === "1";
}

export function jeTestLead(row: { email?: unknown; meta?: unknown } | null | undefined): boolean {
  if (!row) return false;
  return jeTestovaciEmail(row.email) || maMetaTest(row.meta);
}

/**
 * Zařazení do série při insertu do `leads`.
 * Testovací adresa: status paused, next_send_at null. Uvítací mail posílá volající
 * zvlášť (drip-send only_email), tenhle objekt ho nezakazuje.
 */
export function zarazeniDoSerie(email: unknown, odkladMs: number, ted = Date.now()): {
  status?: "paused";
  next_send_at: string | null;
  test: boolean;
} {
  if (jeTestovaciEmail(email)) {
    return { status: "paused", next_send_at: null, test: true };
  }
  return { next_send_at: new Date(ted + odkladMs).toISOString(), test: false };
}

/**
 * Hromadný běh a cron testovací lead neposílají.
 * only_email na tu samou adresu smí poslat aktuální krok (uvítačka) a pak ho zase zaparkovat.
 */
export function testLeadMaJenUvitacku(email: unknown, meta: unknown, onlyEmail: unknown): boolean {
  const jen = String(onlyEmail ?? "").trim().toLowerCase();
  if (!jen.includes("@")) return false;
  return jen === String(email ?? "").trim().toLowerCase() && jeTestLead({ email, meta });
}
