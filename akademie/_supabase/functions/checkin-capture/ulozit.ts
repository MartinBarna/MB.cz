// Uložení check-inu: ověř vrácený řádek, při dočasné chybě zkus znovu,
// a když už stejný řádek v okně leží, nevkládej ho podruhé.
// Bez Deno a bez sítě. HTTP hlášku pro formulář drží i akademie/check-in/ulozit.js
// (prohlížeč tenhle soubor nenačte). Text musí zůstat stejný na obou místech.

export const HLASKA_CHYBA = "Nepodařilo se uložit, zkus znovu";
export const OKNO_DUPLICITY_MS = 2 * 60 * 1000;
/** Pauzy před 2. a 3. pokusem. Tři pokusy celkem. */
export const CEKANI_MS = [250, 750];

export type DbChyba = { code?: string; message?: string; status?: number } | null;

export type CheckinRadek = {
  email: string;
  weight: number | null;
  waist: number | null;
  hips: number | null;
  steps: string | null;
  workouts: number | null;
  adherence: number | null;
  sleep: number | null;
  feeling: number | null;
  note: string | null;
  created_at?: string;
};

export type Vlozeni =
  | { ok: true; radek: CheckinRadek; duplicita: boolean }
  | { ok: false; docasna: boolean; chyba: string };

const CISLA = ["weight", "waist", "hips", "workouts", "adherence", "sleep", "feeling"] as const;
const TEXTY = ["steps", "note"] as const;

function stejneCislo(a: unknown, b: unknown): boolean {
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  const na = Number(a);
  const nb = Number(b);
  if (Number.isFinite(na) && Number.isFinite(nb)) return na === nb;
  return String(a) === String(b);
}

function stejnyText(a: unknown, b: unknown): boolean {
  const sa = a == null || a === "" ? null : String(a);
  const sb = b == null || b === "" ? null : String(b);
  return sa === sb;
}

/** Stejný člověk a stejné hodnoty. Čísla z Postgresu (`"82.50"`) sedí s `82.5`. */
export function stejnyCheckin(a: CheckinRadek, b: CheckinRadek): boolean {
  if (String(a.email).trim().toLowerCase() !== String(b.email).trim().toLowerCase()) return false;
  for (const k of CISLA) {
    if (!stejneCislo(a[k], b[k])) return false;
  }
  for (const k of TEXTY) {
    if (!stejnyText(a[k], b[k])) return false;
  }
  return true;
}

/**
 * Dočasná chyba, u které má smysl počkat a zkusit znovu.
 * Trvalá (oprávnění, constraint, vadná data) se neopakuje.
 */
export function jeDocasnaDb(err: DbChyba): boolean {
  if (!err) return false;
  const code = String(err.code ?? "");
  const msg = String(err.message ?? "").toLowerCase();
  const status = Number(err.status ?? 0);
  if (status === 408 || status === 429 || status >= 500) return true;
  if (["40001", "40P01", "57014", "53300", "08006", "08001", "08000", "08003"].includes(code)) return true;
  if (code === "PGRST000" || code === "PGRST002" || code === "PGRST003") return true;
  if (
    msg.includes("timeout") || msg.includes("gateway") || msg.includes("network") ||
    msg.includes("fetch failed") || msg.includes("econnreset") || msg.includes("503") ||
    msg.includes("504") || msg.includes("502")
  ) return true;
  return false;
}

const pockejVychozi = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Nejdřív se podívá, jestli stejný check-in v krátkém okně už neleží
 * (předchozí pokus mohl projít a odpověď se ztratit). Pak vloží.
 * Dočasnou chybu zopakuje. Trvalou vrátí hned. Bez úspěšného řádku nevrací ok.
 */
export async function vlozSOpakovanim(
  radek: CheckinRadek,
  deps: {
    najdiNedavny: () => Promise<{ radek: CheckinRadek | null; chyba: DbChyba }>;
    vloz: () => Promise<{ radek: CheckinRadek | null; chyba: DbChyba }>;
    cekani?: number[];
    spi?: (ms: number) => Promise<void>;
  },
): Promise<Vlozeni> {
  const cekani = deps.cekani ?? CEKANI_MS;
  const spi = deps.spi ?? pockejVychozi;
  const pokusu = cekani.length + 1;
  let posledni = "save_failed";
  for (let i = 0; i < pokusu; i++) {
    if (i > 0) await spi(cekani[i - 1] ?? 0);
    const nalez = await deps.najdiNedavny();
    if (nalez.chyba) {
      posledni = nalez.chyba.message ?? "read_failed";
      if (!jeDocasnaDb(nalez.chyba) || i === pokusu - 1) {
        return { ok: false, docasna: jeDocasnaDb(nalez.chyba), chyba: posledni };
      }
      continue;
    }
    if (nalez.radek && stejnyCheckin(nalez.radek, radek)) {
      return { ok: true, radek: nalez.radek, duplicita: true };
    }
    const ins = await deps.vloz();
    if (ins.radek && !ins.chyba) return { ok: true, radek: ins.radek, duplicita: false };
    posledni = ins.chyba?.message ?? "no_row";
    const docasna = ins.chyba ? jeDocasnaDb(ins.chyba) : true;
    if (!docasna || i === pokusu - 1) return { ok: false, docasna, chyba: posledni };
  }
  return { ok: false, docasna: true, chyba: posledni };
}
