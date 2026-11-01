import { KOSIK_KATALOG, castkaSedi } from "../kosik-checkout/katalog.ts";
import { rozhodniLivemodeKosiku, rozpoznajJednorazovyKlic } from "./kosik-rozpoznani.ts";

const KATALOG_KLICE = [
  "academy-lifetime",
  "videokurz",
  "konzultace",
  "konzultace-vk",
  "balicek",
  "videokurz-upgrade",
  "coaching-gold-1",
  "coaching-gold-3",
  "coaching-gold-6",
  "coaching-diamond-1",
  "coaching-diamond-3",
  "coaching-diamond-6",
];

const ODKAZY: Record<string, string> = {
  plink_1Tyrn5Bq3rKubW9k8n2VoeWL: "konzultace",
  plink_1UBIcrBq3rKubW9k9Nk4oIYr: "coaching-gold-1",
};

Deno.test("session bez payment_link s kosik_klic konzultace sedi na castku a bonus je v katalogu webhooku", async () => {
  const vysledek = await rozpoznajJednorazovyKlic({
    obj: {
      amount_total: 299000,
      metadata: { kosik_klic: "konzultace", kosik_id: "u1" },
    },
    odkazNaProdukt: ODKAZY,
    katalogKlice: KATALOG_KLICE,
    dohledatRecovered: async () => {
      throw new Error("nemá se ptat");
    },
  });
  if (!vysledek.ok || vysledek.klic !== "konzultace" || vysledek.zdroj !== "metadata") {
    throw new Error(JSON.stringify(vysledek));
  }
  const zdroj = await Deno.readTextFile(new URL("./index.ts", import.meta.url));
  const i = zdroj.indexOf('"konzultace": {');
  const blok = zdroj.slice(i, zdroj.indexOf('"konzultace-vk"', i));
  if (!/videokurzBonus:\s*true/.test(blok)) throw new Error("konzultace nema videokurzBonus");
});

Deno.test("spatna castka je alert bez naroku, sleva 10 procent u konzultace projde", async () => {
  const spatna = await rozpoznajJednorazovyKlic({
    obj: { amount_total: 100, metadata: { kosik_klic: "konzultace" } },
    odkazNaProdukt: ODKAZY,
    katalogKlice: KATALOG_KLICE,
    dohledatRecovered: async () => null,
  });
  if (spatna.ok || spatna.duvod !== "spatna-castka") throw new Error(JSON.stringify(spatna));
  if (!castkaSedi("konzultace", 269100)) throw new Error("10 procent");
  if (castkaSedi("coaching-gold-1", KOSIK_KATALOG["coaching-gold-1"].castkaHalere - 1)) {
    throw new Error("koucink nema slevu");
  }
});

Deno.test("obnovena session bez metadat se vezme z recovered_from", async () => {
  const vysledek = await rozpoznajJednorazovyKlic({
    obj: { amount_total: 299000, recovered_from: "cs_stara", metadata: {} },
    odkazNaProdukt: ODKAZY,
    katalogKlice: KATALOG_KLICE,
    dohledatRecovered: async (id) => id === "cs_stara" ? "konzultace" : null,
  });
  if (!vysledek.ok || vysledek.zdroj !== "recovered_from" || vysledek.klic !== "konzultace") {
    throw new Error(JSON.stringify(vysledek));
  }
});

Deno.test("stavajici platebni odkaz vyhraje i pri jine castce a cizi session je zadny", async () => {
  const odkaz = await rozpoznajJednorazovyKlic({
    obj: {
      payment_link: "plink_1Tyrn5Bq3rKubW9k8n2VoeWL",
      amount_total: 1500,
      metadata: { kosik_klic: "coaching-gold-6" },
    },
    odkazNaProdukt: ODKAZY,
    katalogKlice: KATALOG_KLICE,
    dohledatRecovered: async () => "konzultace",
  });
  if (!odkaz.ok || odkaz.klic !== "konzultace" || odkaz.zdroj !== "payment_link") {
    throw new Error(JSON.stringify(odkaz));
  }
  const cizi = await rozpoznajJednorazovyKlic({
    obj: { payment_link: "plink_cizi", amount_total: 49900 },
    odkazNaProdukt: ODKAZY,
    katalogKlice: KATALOG_KLICE,
    dohledatRecovered: async () => null,
  });
  if (cizi.ok || cizi.duvod !== "zadny") throw new Error(JSON.stringify(cizi));
});

Deno.test("kosik expired a completed s jinym livemode nez prostredi se ignoruji", () => {
  const kosik = { metadata: { kosik_klic: "konzultace", kosik_id: "u1" } };
  const liveMimo = rozhodniLivemodeKosiku({
    typ: "checkout.session.completed",
    livemode: false,
    obj: kosik,
    prostredi: "live",
  });
  if (!liveMimo.ignoruj || liveMimo.duvod !== "livemode") throw new Error(JSON.stringify(liveMimo));
  const testMimo = rozhodniLivemodeKosiku({
    typ: "checkout.session.expired",
    livemode: true,
    obj: kosik,
    prostredi: "test",
  });
  if (!testMimo.ignoruj) throw new Error(JSON.stringify(testMimo));
  const sedi = rozhodniLivemodeKosiku({
    typ: "checkout.session.completed",
    livemode: true,
    obj: kosik,
    prostredi: "live",
  });
  if (sedi.ignoruj) throw new Error("shoda livemode se nema ignorovat");
  const bezLivemode = rozhodniLivemodeKosiku({
    typ: "checkout.session.expired",
    livemode: "true",
    obj: kosik,
    prostredi: "live",
  });
  if (!bezLivemode.ignoruj) throw new Error("livemode musi byt boolean");
  const odkaz = rozhodniLivemodeKosiku({
    typ: "checkout.session.completed",
    livemode: false,
    obj: { payment_link: "plink_1Tyrn5Bq3rKubW9k8n2VoeWL" },
    prostredi: "live",
  });
  if (odkaz.ignoruj) throw new Error("platebni odkaz neni udalost kosiku");
  const obnova = rozhodniLivemodeKosiku({
    typ: "checkout.session.completed",
    livemode: false,
    obj: { recovered_from: "cs_puvodni" },
    prostredi: "live",
  });
  if (!obnova.ignoruj) throw new Error("obnovena session kosiku ma jit pres filtr");
});

Deno.test("webhook kosik livemode vola filtr driv, nez udeli narok", async () => {
  const zdroj = await Deno.readTextFile(new URL("./index.ts", import.meta.url));
  const filtr = zdroj.indexOf("rozhodniLivemodeKosiku");
  const narok = zdroj.indexOf('if (typ === "checkout.session.completed")');
  if (filtr < 0 || narok < 0 || filtr > narok) throw new Error("filtr musi byt pred completed");
  if (!zdroj.includes('ignored: "livemode"')) throw new Error("ignorovani se ma vratit");
  if (!zdroj.includes("kosik livemode ignorovano")) throw new Error("musi se logovat");
});
