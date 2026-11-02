// Čisté rozhodování pro academy-delete-account.
// Žádný síťový import: test soubor to bere bez --allow-net.
// escapeIlikeExact je schválně opsaný z _shared/mailing-guard.ts (stejné tři replace).
// Funkce mailing-guard neimportuje: při deployi se kopíruje jen tahle složka
// a zapomenutý _shared by nasadil starého sourozence.

/** ILIKE bere `_` a `%` jako wildcards. Backslash je v Postgresu výchozí escape LIKE. */
export function escapeIlikeExact(email: string): string {
  return email.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

/**
 * E-mail, podle kterého se smí mazat a odhlašovat.
 * Prázdný nebo bez @ by ilike smazal špatné řádky, nebo žádné, a účet by zmizel
 * s běžícím předplatným. Čárka a závorky by rozbily filtr PostgREST.
 */
export function jePouzitelnyEmail(email: string): boolean {
  return Boolean(email)
    && email.includes("@")
    && email.length <= 320
    && !email.includes(" ")
    && !email.includes(",")
    && !email.includes("(")
    && !email.includes(")");
}

/**
 * Zrušit ve Stripu se smí jen běžící měsíční členství Academy.
 * Jiný source se stejným sloupcem nese cizí předplatné:
 * doživotní upgrade nechá staré id v řádku (už zrušené při upgrade),
 * grant videokurzu z appky tam píše předplatné Tvůj Coach.
 * Referrals tahle funkce vůbec nečte.
 */
export function jeMesicniClenstvi(row: {
  source?: string | null;
  stripe_subscription_id?: string | null;
} | null | undefined): boolean {
  const source = String(row?.source ?? "");
  const id = String(row?.stripe_subscription_id ?? "").trim();
  return source === "stripe-monthly" && id.length > 0;
}

/** Id, které se smí poslat na DELETE /v1/subscriptions/. Cokoli jiného jen alert. */
export function jeStripeSubscriptionId(id: string): boolean {
  return /^sub_[A-Za-z0-9]+$/.test(id);
}

/**
 * Tabulka v PostgREST/Postgres není. Mazání pak nesmí shodit celé smazání účtu.
 * Chybějící sloupec (42703, PGRST204) sem nepatří: to je skutečná chyba a účet
 * se ještě nesmí smazat, jinak by osobní řádek zůstal a my bychom hlásili úspěch.
 */
export function chybiTabulka(err: { code?: string; message?: string } | null | undefined): boolean {
  if (!err) return false;
  const code = String(err.code ?? "");
  if (code === "42703" || code === "PGRST204") return false;
  if (code === "42P01" || code === "PGRST205") return true;
  const msg = String(err.message ?? "");
  if (/column .* does not exist/i.test(msg)) return false;
  if (/could not find the '.+' column/i.test(msg)) return false;
  if (/could not find the table/i.test(msg)) return true;
  if (/relation ["']?[\w.]+["']? does not exist/i.test(msg)) return true;
  return /schema cache/i.test(msg) && /table/i.test(msg) && !/column/i.test(msg);
}

/** Unique violation. Opakovaný zápis na trvalý seznam není chyba. */
export function jeDuplicita(err: { code?: string; message?: string } | null | undefined): boolean {
  if (!err) return false;
  if (String(err.code ?? "") === "23505") return true;
  return /duplicate|unique/i.test(String(err.message ?? ""));
}

/**
 * Mazání podle sloupce `email` (přesné ilike).
 * Nejsou tu razítka proti druhému mailu ani proti druhému Stripe promo
 * (client_remind_sent, tydenik_odeslani, koucink_konec_sent, en_mail_log).
 * Nejsou tu účetní a platební tabulky. Zdůvodnění je v docs/academy-smazani-uctu.md.
 */
export const SMAZAT_EMAIL = [
  "ai_lesson_peeks",
  "checkins",
  "client_intake",
  "client_reports",
  "client_targets",
  "consultation_calls",
  "consultation_intake",
  "contact_messages",
  "crm_enroll_queue",
  "en_leads",
  "mail_skip_log",
  "test_attempts",
  "usage_events",
] as const;

/**
 * Mazání podle `user_id` (ověřeno v živé DB 2. 11. 2026, cizí klíč na auth.users tu není,
 * kaskáda je tedy nesmaže). test_attempts se maže i podle e-mailu výš.
 */
export const SMAZAT_USER_ID = [
  "ai_flags",
  "ai_usage",
  "test_attempts",
] as const;

/** ai_flags má e-mail ve sloupci `user_email` (živá DB 2. 11. 2026). */
export const SMAZAT_USER_EMAIL = [
  "ai_flags",
] as const;

/** Soukromý bucket se soubory klienta ve složce `<email>/`. */
export const BUCKET_KLIENT = "client-docs";

/** Stejné mazání, ale sloupec se jmenuje `client_email` (ověřeno v CREATE). */
export const SMAZAT_CLIENT_EMAIL = [
  "pruvodce_drafts",
  "report_drafts",
] as const;
