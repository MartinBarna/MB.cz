/** fitness.barna+tester*@gmail.com */
export const TEST_LEAD_EMAIL = /^fitness\.barna\+tester[^@]*@gmail\.com$/i;

export function jeTestovaciEmail(email: unknown): boolean {
  return TEST_LEAD_EMAIL.test(String(email ?? "").trim());
}

/** meta.test: true, 1, "true", "t", "1". */
export function maMetaTest(meta: unknown): boolean {
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return false;
  const v = (meta as Record<string, unknown>).test;
  return v === true || v === 1 || v === "true" || v === "t" || v === "1";
}

export function jeTestLead(row: { email?: unknown; meta?: unknown } | null | undefined): boolean {
  if (!row) return false;
  return jeTestovaciEmail(row.email) || maMetaTest(row.meta);
}

/** Tester: paused a bez termínu. Mail s PDF tohle nezakazuje. */
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

/** Jen only_email na tu samou testovací adresu. */
export function testLeadMaJenUvitacku(email: unknown, meta: unknown, onlyEmail: unknown): boolean {
  const jen = String(onlyEmail ?? "").trim().toLowerCase();
  if (!jen.includes("@")) return false;
  return jen === String(email ?? "").trim().toLowerCase() && jeTestLead({ email, meta });
}
