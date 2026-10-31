// Cteni flagu z app_config. Chyba cteni = vychozi: web vypnuto, mail vypnuto, dry-run zapnuto.
// Zadny mail a zadna session, kdyz se konfigurace nepodari precist.

import { FLAGY_VYCHOZI, type KosikFlagy, slozFlagy } from "./kosik-pravidla.ts";

const KLICE = [
  "kosik_web_zapnuto",
  "kosik_mail_zapnuto",
  "kosik_dry_run",
  "kosik_garance_k1",
  "kosik_produkty",
];

export async function nactiKosikFlagy(
  // supabase-js builder neni primo Promise, proto any. Chyba cteni pada do vychozich flagu.
  // deno-lint-ignore no-explicit-any
  admin: any,
  envDry: string | undefined,
): Promise<KosikFlagy> {
  try {
    const { data, error } = await admin.from("app_config").select("key,value").in("key", KLICE);
    if (error || !data) return slozFlagy([], envDry);
    return slozFlagy(data, envDry);
  } catch {
    return { ...FLAGY_VYCHOZI, produkty: [...FLAGY_VYCHOZI.produkty], dryRun: envDry === "1" ? true : FLAGY_VYCHOZI.dryRun };
  }
}
