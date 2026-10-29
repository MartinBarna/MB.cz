import { FLAGY_VYCHOZI } from "../_shared/kosik-pravidla.ts";
import { SOUHLAS_TEXT, SOUHLAS_VERZE, parametrySession, souhlasZVstupu, vytvorCheckout } from "./logika.ts";
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
