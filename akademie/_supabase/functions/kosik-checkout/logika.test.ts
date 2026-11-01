import { FLAGY_VYCHOZI } from "../_shared/kosik-pravidla.ts";
import { DROBNY_TEXT as DROBNY_KLIENT, SOUHLAS_LABEL as LABEL_KLIENT, SOUHLAS_TEXT as TEXT_KLIENT, SOUHLAS_VERZE as VERZE_KLIENT } from "../../../../assets/kosik-checkout-jadro.js";
import { SOUHLAS_LABEL, SOUHLAS_TEXT, SOUHLAS_VERZE, kupoJePovolenaSleva, parametrySession, souhlasZVstupu, vytvorCheckout } from "./logika.ts";
import { KOSIK_KATALOG } from "./katalog.ts";

Deno.test("vypnuty flag, honeypot a souhlas false nezakladaji session a neblokuji nakup", async () => {
  let stripe = 0;
  let insertu = 0;
  const deps = {
    flagy: { ...FLAGY_VYCHOZI },
    ted: new Date("2026-01-15T12:00:00.000Z"),
    ip: "203.0.113.5",
    userAgent: "test",
    env: (n: string) => n === "STRIPE_RESTRICTED_CHECKOUT_KEY" ? "rk_test" : n === "STRIPE_PRICE_KONZULTACE" ? "price_testKonzultace2990" : "",
    pocetZaOkno: async () => 0,
    vloz: async () => {
      insertu++;
      return { id: "u1" };
    },
    aktualizuj: async () => ({ ok: true }),
    najdiPromo: async () => null,
    zalozSession: async () => {
      stripe++;
      return { ok: true as const, url: "https://checkout.stripe.com/c/pay/cs_test", sessionId: "cs_test" };
    },
  };
  const vyp = await vytvorCheckout({ klic: "konzultace", email: "a@b.cz", souhlas: true, souhlas_verze: SOUHLAS_VERZE }, deps);
  if (!("fallback" in vyp.body) || stripe !== 0 || insertu !== 0) throw new Error(JSON.stringify(vyp));

  const med = await vytvorCheckout({ website: "http://spam", klic: "konzultace", email: "a@b.cz" }, {
    ...deps,
    flagy: { ...FLAGY_VYCHOZI, webZapnuto: true },
  });
  if (!("ok" in med.body) || stripe !== 0) throw new Error(JSON.stringify(med));
});

Deno.test("souhlas false ulozi false a session se muze zalozit, true ulozi kanonicky text", async () => {
  const ulozene: Record<string, unknown>[] = [];
  let form = "";
  const deps = {
    flagy: { ...FLAGY_VYCHOZI, webZapnuto: true, produkty: ["konzultace"] },
    ted: new Date("2026-01-15T12:00:00.000Z"),
    ip: "203.0.113.5",
    userAgent: "test",
    env: (n: string) => n === "STRIPE_RESTRICTED_CHECKOUT_KEY" ? "rk_test" : n === "STRIPE_PRICE_KONZULTACE" ? "price_testKonzultace2990" : "",
    pocetZaOkno: async () => 0,
    vloz: async (r: Record<string, unknown>) => {
      ulozene.push(r);
      return { id: "u1" };
    },
    aktualizuj: async () => ({ ok: true }),
    najdiPromo: async () => null,
    zalozSession: async (p: URLSearchParams) => {
      form = p.toString();
      return { ok: true as const, url: "https://checkout.stripe.com/c/pay/cs_test", sessionId: "cs_test" };
    },
  };
  const bez = await vytvorCheckout({
    klic: "konzultace",
    email: "a@b.cz",
    souhlas: false,
    souhlas_verze: SOUHLAS_VERZE,
    href: "",
  } as never, deps);
  if (!("url" in bez.body)) throw new Error(JSON.stringify(bez));
  if (ulozene[0].souhlas !== false || ulozene[0].souhlas_text != null) throw new Error(JSON.stringify(ulozene[0]));

  const se = await vytvorCheckout({
    klic: "konzultace",
    email: "a@b.cz",
    souhlas: true,
    souhlas_verze: SOUHLAS_VERZE,
    cref: "BARNA-TEST_src-web",
    promo: "DOPORUC10",
    zdroj_url: "https://martinbarna.cz/konzultace/?utm_source=web",
  }, deps);
  if (!("url" in se.body)) throw new Error(JSON.stringify(se));
  if (ulozene[1].souhlas !== true || ulozene[1].souhlas_text !== SOUHLAS_TEXT) throw new Error("text");
  if (String(ulozene[1].zdroj_url).includes("utm_")) throw new Error("utm ve zdroji");
  if (form.includes("utm_")) throw new Error("utm ve formulari");
  if (!form.includes("after_expiration%5Brecovery%5D%5Benabled%5D=true") && !form.includes("after_expiration[recovery][enabled]=true")) {
    throw new Error(form);
  }
  const params = new URLSearchParams(form);
  if (params.get("metadata[kosik_klic]") !== "konzultace") throw new Error("metadata");
  if (params.get("metadata[kosik_id]") !== "u1") throw new Error("id");
  if (params.get("client_reference_id") !== "BARNA-TEST_src-web") throw new Error("cref");
});

Deno.test("promo jen 10 procent, jinak bez allow_promotion_codes", async () => {
  if (!kupoJePovolenaSleva({ percentOff: 10, amountOff: null }, [10])) throw new Error("10");
  if (kupoJePovolenaSleva({ percentOff: 20, amountOff: null }, [10])) throw new Error("20");
  if (kupoJePovolenaSleva({ percentOff: null, amountOff: 29900 }, [10])) throw new Error("pevna");
  const bez = parametrySession({
    klic: "konzultace",
    email: "a@b.cz",
    kosikId: "u1",
    cref: null,
    promoId: null,
    polozka: KOSIK_KATALOG.konzultace,
    price: "price_test",
  });
  if (bez.get("allow_promotion_codes") !== "false") throw new Error(bez.toString());
  if (bez.get("discounts[0][promotion_code]")) throw new Error("sleva nema byt");
  const s = parametrySession({
    klic: "konzultace",
    email: "a@b.cz",
    kosikId: "u1",
    cref: null,
    promoId: "promo_10",
    polozka: KOSIK_KATALOG.konzultace,
    price: "price_test",
  });
  if (s.get("discounts[0][promotion_code]") !== "promo_10") throw new Error("chybi sleva");
  if (s.get("allow_promotion_codes")) throw new Error("oboji Stripe odmitne");
  if (s.get("after_expiration[recovery][allow_promotion_codes]") !== "false") throw new Error("recovery");

  let pouzite: string | null = "x";
  const deps = {
    flagy: { ...FLAGY_VYCHOZI, webZapnuto: true, produkty: ["konzultace"] },
    ted: new Date("2026-01-15T12:00:00.000Z"),
    ip: "203.0.113.5",
    userAgent: "test",
    env: (n: string) => n === "STRIPE_RESTRICTED_CHECKOUT_KEY" ? "rk_test" : n === "STRIPE_PRICE_KONZULTACE" ? "price_testKonzultace2990" : "",
    pocetZaOkno: async () => 0,
    vloz: async () => ({ id: "u1" }),
    aktualizuj: async () => ({ ok: true }),
    najdiPromo: async () => ({ id: "promo_20", percentOff: 20, amountOff: null }),
    zalozSession: async (p: URLSearchParams) => {
      pouzite = p.get("discounts[0][promotion_code]");
      if (p.get("allow_promotion_codes") !== "false") throw new Error("ma byt vypnute");
      return { ok: true as const, url: "https://checkout.stripe.com/c/pay/cs_test", sessionId: "cs_test" };
    },
  };
  await vytvorCheckout({
    klic: "konzultace",
    email: "a@b.cz",
    souhlas: false,
    promo: "JINA20",
  }, deps);
  if (pouzite) throw new Error("20 % se nesmi dat na session");
});

Deno.test("parametry session nemaji utm a cena je z katalogu", () => {
  const p = parametrySession({
    klic: "konzultace",
    email: "a@b.cz",
    kosikId: "u1",
    cref: null,
    promoId: null,
    polozka: KOSIK_KATALOG.konzultace,
    price: "price_test",
  });
  if (p.toString().includes("utm_")) throw new Error("utm");
  if (p.get("line_items[0][price]") !== "price_test") throw new Error("price");
  if (p.get("success_url") !== "https://martinbarna.cz/dekuji-konzultace/") throw new Error("success");
  const s = souhlasZVstupu(true, "jina-verze", new Date());
  if (s.souhlas !== false) throw new Error("cizi verze nesmi byt souhlas");
});

Deno.test("souhlas je jen kosik-v2 a starsi verze neni fallback", () => {
  const label = "Pošli mi e-mail, když objednávku nedokončím (nejvýš 2 připomínky). Souhlas můžu kdykoli odvolat odkazem v e-mailu.";
  const text = label + " Zásady ochrany osobních údajů: https://martinbarna.cz/zasady-ochrany-osobnich-udaju/";
  const drobny = "E-mail použijeme k předvyplnění platby ve Stripe. Bez zaškrtnutí ti žádnou připomínku nepošleme.";
  if (SOUHLAS_VERZE !== "kosik-v2-2026-11" || VERZE_KLIENT !== SOUHLAS_VERZE) throw new Error(SOUHLAS_VERZE);
  if (SOUHLAS_LABEL !== label || LABEL_KLIENT !== label) throw new Error("label");
  if (SOUHLAS_TEXT !== text || TEXT_KLIENT !== text) throw new Error(SOUHLAS_TEXT);
  if (DROBNY_KLIENT !== drobny) throw new Error(DROBNY_KLIENT);
  if (SOUHLAS_TEXT.includes("tipy") || SOUHLAS_LABEL.includes("nabídky")) throw new Error("tipy v souhlasu");
  for (const verze of ["kosik-v1-2026-11", "", undefined, "kosik-v2-2026-11 "]) {
    const vysledek = souhlasZVstupu(true, verze, new Date("2026-01-15T12:00:00.000Z"));
    if (vysledek.souhlas !== false || vysledek.souhlas_text !== null || vysledek.souhlas_verze !== null) {
      throw new Error("verze nesmi projit: " + String(verze));
    }
  }
  const ok = souhlasZVstupu(true, SOUHLAS_VERZE, new Date("2026-01-15T12:00:00.000Z"));
  if (ok.souhlas !== true || ok.souhlas_verze !== SOUHLAS_VERZE || ok.souhlas_text !== SOUHLAS_TEXT) {
    throw new Error("v2 ma projit");
  }
});
