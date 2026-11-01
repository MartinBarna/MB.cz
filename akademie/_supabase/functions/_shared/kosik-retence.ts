// Rozhodnuti, ktery radek kosik_checkouty ma denni uloha smazat.
// Stejne predikaty jsou v akademie/_supabase/kosik-retence-2026-11.sql.
// Sloupec test se necte: TEST radky maji stejna pravidla jako ostre.
// Funkce nevraci e-mail. Radek bez souhlasu sem muze spadnout jen kvuli mazani,
// ne kvuli mailingu ani statistice.

const MS_DEN = 24 * 60 * 60 * 1000;

export type DuvodRetence = "odhlaseni" | "zaplaceno_30" | "bez_souhlasu_30" | "souhlas_90" | null;

export type RadekRetence = {
  id: string;
  created_at: string;
  souhlas: boolean;
  zaplaceno_at: string | null;
  odhlaseno_at: string | null;
  mail1_odeslan_at: string | null;
  mail2_odeslan_at: string | null;
  test: boolean;
};

function jeStarsiNez(iso: string | null | undefined, ted: Date, dny: number): boolean {
  if (!iso || !iso.trim()) return false;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return false;
  return ted.getTime() - t > dny * MS_DEN;
}

/** Posledni skutecne odeslany mail. Sucha razitka mail*_dry_at se nepocitaji. Bez mailu created_at. */
export function kotvaSouhlasu(r: Pick<RadekRetence, "created_at" | "mail1_odeslan_at" | "mail2_odeslan_at">): string {
  const casy = [r.mail1_odeslan_at, r.mail2_odeslan_at].filter((x): x is string => !!x && x.trim() !== "");
  if (!casy.length) return r.created_at;
  return casy.reduce((a, b) => (new Date(a).getTime() >= new Date(b).getTime() ? a : b));
}

/**
 * Poradi je zamerne:
 * 1. odhlaseni: smazat hned (e-mail zustava v odhlaseni_trvale, tahle funkce ho nemaze)
 * 2. zaplaceno: 30 dni po zaplaceni
 * 3. bez souhlasu a nezaplaceno: 30 dni od vytvoreni
 * 4. se souhlasem a nezaplaceno: 90 dni od posledniho odeslaneho mailu, jinak od vytvoreni
 * Presne na hranici se radek jeste nesmaze (SQL pouziva < now() - interval).
 */
export function duvodRetence(r: RadekRetence, ted: Date): DuvodRetence {
  if (r.odhlaseno_at && r.odhlaseno_at.trim()) return "odhlaseni";
  if (jeStarsiNez(r.zaplaceno_at, ted, 30)) return "zaplaceno_30";
  if (r.souhlas !== true && !r.zaplaceno_at && jeStarsiNez(r.created_at, ted, 30)) return "bez_souhlasu_30";
  if (r.souhlas === true && !r.zaplaceno_at && jeStarsiNez(kotvaSouhlasu(r), ted, 90)) return "souhlas_90";
  return null;
}
