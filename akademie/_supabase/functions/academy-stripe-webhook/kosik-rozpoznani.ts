// Rozpoznani jednorazove Checkout Session z kosiku.
// Platebni odkaz ma prednost: stavajici buy.stripe.com odkazy se chovaji jako driv,
// i kdyz je castka jina (slevovy kod na odkazu). Metadata a recovered_from jsou az zaloha.
// Castka se kontroluje jen na ceste z metadat, protoze tu cenu urcuje nas katalog, ne odkaz.

import { KOSIK_KLICE, castkaSedi } from "../kosik-checkout/katalog.ts";

export type Rozpoznani =
  | { ok: true; klic: string; zdroj: "payment_link" | "metadata" | "recovered_from" }
  | { ok: false; duvod: "zadny" | "spatna-castka" | "klic-mimo-whitelist" | "klic-mimo-katalog" };

export type VstupRozpoznani = {
  obj: {
    payment_link?: unknown;
    amount_total?: unknown;
    metadata?: unknown;
    recovered_from?: unknown;
  };
  odkazNaProdukt: Record<string, string>;
  katalogKlice: readonly string[];
  dohledatRecovered: (sessionId: string) => Promise<string | null>;
};

function metaKlic(obj: VstupRozpoznani["obj"]): string {
  const meta = obj.metadata;
  if (!meta || typeof meta !== "object") return "";
  const k = (meta as { kosik_klic?: unknown }).kosik_klic;
  return typeof k === "string" ? k : "";
}

function zkontrolujKlic(klic: string, amount: unknown, katalogKlice: readonly string[]): Rozpoznani {
  if (!(KOSIK_KLICE as readonly string[]).includes(klic)) return { ok: false, duvod: "klic-mimo-whitelist" };
  if (!katalogKlice.includes(klic)) return { ok: false, duvod: "klic-mimo-katalog" };
  if (!castkaSedi(klic, amount)) return { ok: false, duvod: "spatna-castka" };
  return { ok: true, klic, zdroj: "metadata" };
}

export async function rozpoznajJednorazovyKlic(vstup: VstupRozpoznani): Promise<Rozpoznani> {
  const plink = typeof vstup.obj.payment_link === "string" ? vstup.obj.payment_link : "";
  if (plink && vstup.odkazNaProdukt[plink]) {
    return { ok: true, klic: vstup.odkazNaProdukt[plink], zdroj: "payment_link" };
  }

  const zMetadat = metaKlic(vstup.obj);
  if (zMetadat) {
    return zkontrolujKlic(zMetadat, vstup.obj.amount_total, vstup.katalogKlice);
  }

  const recovered = typeof vstup.obj.recovered_from === "string" ? vstup.obj.recovered_from : "";
  if (recovered) {
    const klic = await vstup.dohledatRecovered(recovered);
    if (klic) {
      const vysledek = zkontrolujKlic(klic, vstup.obj.amount_total, vstup.katalogKlice);
      if (vysledek.ok) return { ok: true, klic: vysledek.klic, zdroj: "recovered_from" };
      return vysledek;
    }
  }

  return { ok: false, duvod: "zadny" };
}
