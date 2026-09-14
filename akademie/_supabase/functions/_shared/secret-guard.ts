// =============================================================================
// Guard tajného klíče pro funkce volané cronem (x-drip-secret a spol.) a čtení
// s opakováním pro seznamy příjemců.
//
// PROČ: 14. 9. 2026 01:00 UTC spadlo čtení `app_config.drip_invoke_secret` na 504 brány
// (Supabase Free plán, brána shazuje asi 1,35 % požadavků) a `client-remind` vrátil 403,
// jako by volal cizí. Cron hlásil succeeded, 14 klientů koučinku nedostalo připomínku
// a nikdo se to nedozvěděl, dokud se klient neozval sám. `drip-send` v tutéž minutu 401.
//
// Chyba čtení není odpověď na otázku „kdo volá". Tři stavy, ne dva:
//   přečteno a hlavička sedí      -> ok
//   přečteno a hlavička nesedí    -> 401 (nebo 403, podle funkce), jako dřív
//   NEPŘEČTENO po všech pokusech  -> 500 secret_unreadable (cron to vidí v net._http_response
//                                    a opakovací běh to zkusí znovu)
//   přečteno, ale řádek chybí     -> 500 secret_missing (konfigurace, ne cizí volající)
//
// Bez Deno API, bez sítě: testuje se v secret-guard.test.ts s falešným klientem.
// Paměť: feedback-guard-secretu-pri-vypadku-db-je-403, CLAUDE.md pravidlo 13.
// =============================================================================

export type CteniVysledek<T> = { data: T | null; error: unknown };

/** Minimální tvar supabase-js builderu, ať guard nemá závislost na SDK. */
export type KonfigKlient = {
  from: (table: string) => {
    select: (cols: string) => {
      eq: (col: string, val: string) => {
        maybeSingle: () => PromiseLike<CteniVysledek<{ value?: unknown } | null>>;
      };
    };
  };
};

export const VYCHOZI_POKUSY = 3;
export const VYCHOZI_PAUZA_MS = 700;

const pockej = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Zavolá čtení opakovaně, dokud nevrátí bez `error` nebo nedojdou pokusy.
 * Pauza mezi pokusy roste (700, 1400 ms). Výjimku z `fn` bere jako `error`.
 * Vrací výsledek POSLEDNÍHO pokusu. ⛔ Nikdy nevrací prázdno místo chyby:
 * volající se musí na `error` zeptat a při chybě vrátit 500, ne „nikdo".
 */
export async function ctiSOpakovanim<R extends { data: unknown; error: unknown }>(
  fn: () => PromiseLike<R>,
  pokusy = VYCHOZI_POKUSY,
  pauzaMs = VYCHOZI_PAUZA_MS,
): Promise<R | { data: null; error: unknown }> {
  const n = Math.max(1, pokusy);
  let posledni: R | { data: null; error: unknown } = { data: null, error: new Error("zadny pokus") };
  for (let i = 0; i < n; i++) {
    try {
      posledni = await fn();
    } catch (e) {
      posledni = { data: null, error: e };
    }
    if (!posledni.error) return posledni;
    if (i < n - 1) await pockej(pauzaMs * (i + 1));
  }
  return posledni;
}

/** Odpověď 500 pro čtení, které selhalo i po opakování. `kde` = tabulka nebo klíč. */
export function chybaCteni(kde: string, error: unknown): { error: "read_failed"; kde: string; detail: string } {
  const msg = error && typeof error === "object" && "message" in error
    ? String((error as { message: unknown }).message)
    : String(error ?? "");
  return { error: "read_failed", kde, detail: msg.slice(0, 160) };
}

export type OverSecretVysledek =
  | { ok: true; secret: string }
  | { ok: false; status: 401 | 403 | 500; body: { error: string; hint?: string } };

export async function overSecret(
  admin: KonfigKlient,
  req: { headers: { get: (name: string) => string | null } },
  opts: {
    header: string;
    key?: string;
    pokusy?: number;
    pauzaMs?: number;
    /** Kód pro nesouhlasící hlavičku. Funkce, které dřív vracely 403, ho drží kvůli sondám. */
    statusOdmitnuti?: 401 | 403;
  },
): Promise<OverSecretVysledek> {
  const key = opts.key ?? "drip_invoke_secret";
  const r = await ctiSOpakovanim(
    () => admin.from("app_config").select("value").eq("key", key).maybeSingle(),
    opts.pokusy,
    opts.pauzaMs,
  );
  if (r.error) {
    return {
      ok: false,
      status: 500,
      body: { error: "secret_unreadable", hint: "app_config." + key + " se nepodarilo precist (DB nebo brana), zopakuj volani" },
    };
  }
  const secret = r.data?.value == null ? "" : String(r.data.value);
  if (!secret) {
    return { ok: false, status: 500, body: { error: "secret_missing", hint: "app_config." + key + " chybi nebo je prazdny" } };
  }
  const provided = req.headers.get(opts.header) || "";
  if (provided !== secret) {
    const status = opts.statusOdmitnuti ?? 401;
    return { ok: false, status, body: { error: status === 403 ? "forbidden" : "unauthorized" } };
  }
  return { ok: true, secret };
}
