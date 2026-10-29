import { podepis, overPodpisStripe } from "./podpis.ts";
import { planExpirace, planPlatby, zpracujWebhook, type RadekKosiku } from "./logika.ts";

const SECRET = "whsec_test_kosik_neni_produkce";

function radek(over: Partial<RadekKosiku> = {}): RadekKosiku {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    email: "a@b.cz",
    souhlas: true,
    souhlas_at: "2026-01-01T00:00:00.000Z",
    souhlas_text: "zneni",
    souhlas_verze: "kosik-v1-2026-11",
    stripe_session_id: "cs_puvodni",
    expirovano_at: null,
    zaplaceno_at: null,
    ...over,
  };
}

Deno.test("podpis: sedi, stare okno ne, cizi secret ne", async () => {
  const raw = '{"type":"checkout.session.expired"}';
  const hlavicka = await podepis(SECRET, raw, 1_700_000_000);
  const ted = 1_700_000_100_000;
  if (!await overPodpisStripe(raw, hlavicka, [SECRET], ted)) throw new Error("ma sedet");
  if (await overPodpisStripe(raw, hlavicka, [SECRET], ted + 400_000)) throw new Error("okno 300 s");
  if (await overPodpisStripe(raw, hlavicka, ["jiny"], ted)) throw new Error("cizi secret");
  if (await overPodpisStripe(raw + " ", hlavicka, [SECRET], ted)) throw new Error("telo");
});

Deno.test("cizi session a platebni odkaz se ignoruji, duplicitni expirace nic nezdvoji", async () => {
  const exp = {
    type: "checkout.session.expired",
    data: {
      object: {
        id: "cs_cizi",
        metadata: {},
        after_expiration: { recovery: { url: "https://checkout.stripe.com/c/pay/x", expires_at: 1_800_000_000 } },
      },
    },
  };
  const raw = JSON.stringify(exp);
  const hlavicka = await podepis(SECRET, raw);
  const pocet = { zapisu: 0 };
  const cizi = await zpracujWebhook(raw, hlavicka, {
    ted: new Date("2026-01-15T12:00:00.000Z"),
    overPodpis: (t, h) => overPodpisStripe(t, h, [SECRET]),
    najdi: async () => null,
    zapisExpiraci: async () => {
      pocet.zapisu++;
      return "ok";
    },
    zapisPlatbu: async () => {
      pocet.zapisu++;
    },
  });
  if (cizi.body.ignored !== "cizi" || pocet.zapisu !== 0) throw new Error(JSON.stringify(cizi));
});

Deno.test("expirace naplanuje mail a druha udalost uz nezapise", async () => {
  const exp = {
    type: "checkout.session.expired",
    data: {
      object: {
        id: "cs_puvodni",
        metadata: { kosik_id: radek().id },
        after_expiration: { recovery: { url: "https://checkout.stripe.com/c/pay/x", expires_at: 1_800_000_000 } },
      },
    },
  };
  const pocet = { zapisu: 0 };
  const sRadkem = {
    ...exp,
    data: { object: { ...exp.data.object, id: "cs_puvodni", metadata: { kosik_id: radek().id } } },
  };
  const raw2 = JSON.stringify(sRadkem);
  const h2 = await podepis(SECRET, raw2);
  const prvni = await zpracujWebhook(raw2, h2, {
    ted: new Date("2026-01-15T21:30:00.000Z"),
    overPodpis: (t, h) => overPodpisStripe(t, h, [SECRET]),
    najdi: async () => radek(),
    zapisExpiraci: async (_id, patch) => {
      pocet.zapisu++;
      if (patch.stav !== "propadlo" || !patch.mail1_due_at) throw new Error("plan " + JSON.stringify(patch));
      if (String(patch.recovery_url).includes("utm_")) throw new Error("utm");
      return "ok";
    },
    zapisPlatbu: async () => {},
  });
  const zapsano = Number(pocet.zapisu);
  if (prvni.body.mail !== true || zapsano !== 1) throw new Error(JSON.stringify(prvni) + " zapisu=" + zapsano);

  const druhy = await zpracujWebhook(raw2, h2, {
    ted: new Date("2026-01-15T21:30:00.000Z"),
    overPodpis: (t, h) => overPodpisStripe(t, h, [SECRET]),
    najdi: async () => radek({ expirovano_at: "2026-01-15T21:00:00.000Z" }),
    zapisExpiraci: async () => {
      throw new Error("duplicita nema zapisovat");
    },
    zapisPlatbu: async () => {},
  });
  if (druhy.body.ignored !== "duplicita") throw new Error(JSON.stringify(druhy));
});

Deno.test("bez souhlasu se mail neplanuje", () => {
  const plan = planExpirace(
    radek({ souhlas: false, souhlas_text: null, souhlas_at: null, souhlas_verze: null }),
    { id: "cs_puvodni", after_expiration: { recovery: { url: "https://checkout.stripe.com/c/pay/x", expires_at: 1_800_000_000 } } },
    new Date("2026-01-15T12:00:00.000Z"),
  );
  if (plan.akce !== "zapis" || plan.patch.mail1_due_at != null || plan.patch.stav !== "propadlo_bez_souhlasu") {
    throw new Error(JSON.stringify(plan));
  }
});

Deno.test("completed s recovered_from zastavi serii", () => {
  const plan = planPlatby(
    radek(),
    { id: "cs_nova", recovered_from: "cs_puvodni", payment_status: "paid", metadata: { kosik_id: radek().id } },
    new Date("2026-02-01T10:00:00.000Z"),
  );
  if (plan.akce !== "zapis" || plan.patch.obnoveno !== true || plan.patch.stav !== "zaplaceno") {
    throw new Error(JSON.stringify(plan));
  }
});
