import { FLAGY_VYCHOZI, type KosikFlagy } from "../_shared/kosik-pravidla.ts";
import { filtryKroku, zpracujPripominku, type Kandidat, type PripominkaDeps } from "./logika.ts";

function radek(over: Partial<Kandidat> = {}): Kandidat {
  return {
    id: "id-1",
    created_at: "2026-01-01T00:00:00.000Z",
    email: "a@b.cz",
    produkt_klic: "konzultace",
    castka_halere: 299000,
    souhlas: true,
    souhlas_at: "2026-01-01T00:00:00.000Z",
    souhlas_text: "presne zneni",
    souhlas_verze: "kosik-v1-2026-11",
    stripe_session_id: "cs_1",
    test: false,
    zaplaceno_at: null,
    odpoved_at: null,
    odhlaseno_at: null,
    recovery_url: "https://checkout.stripe.com/c/pay/cs_recovery",
    recovery_expires_at: "2026-12-01T00:00:00.000Z",
    odhlaseni_token: "11111111-1111-1111-1111-111111111111",
    mail1_due_at: "2026-01-15T13:00:00.000Z",
    mail1_odeslan_at: null,
    mail1_dry_at: null,
    mail2_due_at: null,
    mail2_odeslan_at: null,
    mail2_dry_at: null,
    jmeno: null,
    krok: 0,
    ...over,
  };
}

function flagy(over: Partial<KosikFlagy> = {}): KosikFlagy {
  return { ...FLAGY_VYCHOZI, mailZapnuto: true, dryRun: true, produkty: ["konzultace"], ...over };
}

async function beh(radky: Kandidat[], f: KosikFlagy) {
  const maily: unknown[] = [];
  const udalosti: { type: string; duvod?: string }[] = [];
  const deps: PripominkaDeps = {
    ted: new Date("2026-01-15T13:00:00.000Z"),
    flagy: f,
    nactiKandidaty: async () => radky,
    kontext: async () => ({
      aktivniEntitlement: false,
      aktivniKoucink: false,
      jinaSerie: null,
      dostalMarketingDnes: false,
      guardAkce: "send",
      guardDuvod: "ok",
    }),
    oznac: async () => ({ ok: true }),
    zapisUdalost: async (d) => {
      udalosti.push({ type: d.type, duvod: typeof d.duvod === "string" ? d.duvod : undefined });
    },
    posliMail: async (p) => {
      maily.push(p);
      throw new Error("Resend se nema volat");
    },
    alert: async () => {},
  };
  const vysledek = await zpracujPripominku(deps);
  return { vysledek, maily, udalosti };
}

Deno.test("bez uplneho souhlasu je 0 mailu i v dry-runu", async () => {
  const rady = [
    radek({ id: "s1", email: "s1@b.cz", souhlas: false, souhlas_at: null, souhlas_text: null, souhlas_verze: null }),
    radek({ id: "s2", email: "s2@b.cz", souhlas_text: null }),
    radek({ id: "s3", email: "s3@b.cz", stripe_session_id: null }),
  ];
  const { maily, udalosti, vysledek } = await beh(rady, flagy());
  if (maily.length !== 0) throw new Error("odeslalo se " + maily.length);
  if (vysledek.dry !== 0 || vysledek.odeslano !== 0) throw new Error(JSON.stringify(vysledek));
  if (udalosti.some((u) => u.type === "kosik_dry_run")) throw new Error("dry-run bez souhlasu");
  if (!udalosti.every((u) => u.type === "kosik_stop" && u.duvod === "bez_souhlasu")) {
    throw new Error(JSON.stringify(udalosti));
  }
});

Deno.test("dry-run s souhlasem nevola Resend", async () => {
  const { maily, udalosti, vysledek } = await beh([radek()], flagy());
  if (maily.length !== 0) throw new Error("mail");
  if (vysledek.dry !== 1) throw new Error(JSON.stringify(vysledek));
  if (udalosti[0]?.type !== "kosik_dry_run") throw new Error(JSON.stringify(udalosti));
});

Deno.test("garance K1 pri flagu off v dry-runu neni v predmetu ani by se nedostala do tela", async () => {
  let html = "";
  const deps: PripominkaDeps = {
    ted: new Date("2026-01-15T13:00:00.000Z"),
    flagy: flagy({ garanceK1: false, dryRun: false, mailZapnuto: true }),
    nactiKandidaty: async () => [radek()],
    kontext: async () => ({
      aktivniEntitlement: false,
      aktivniKoucink: false,
      jinaSerie: null,
      dostalMarketingDnes: false,
      guardAkce: "send",
      guardDuvod: "ok",
    }),
    oznac: async () => ({ ok: true }),
    zapisUdalost: async () => {},
    posliMail: async (p) => {
      html = p.html;
      return { ok: true, status: 200, providerId: "re_test_neni_sit" };
    },
    alert: async () => {},
  };
  const v = await zpracujPripominku(deps);
  if (v.odeslano !== 1) throw new Error(JSON.stringify(v));
  if (html.includes("vrátím ti celou částku")) throw new Error("garance odesla");
  if (html.includes("utm_")) throw new Error("utm");
  if (html.includes("{{")) throw new Error("promenna");
});

Deno.test("ostry vyber vynecha radky se suchym razitkem", () => {
  const m1 = filtryKroku(0, false);
  if (!m1.jeNull.includes("mail1_dry_at") || !m1.jeNull.includes("mail1_odeslan_at")) {
    throw new Error(JSON.stringify(m1));
  }
  const m2 = filtryKroku(1, false);
  if (!m2.jeNull.includes("mail2_dry_at") || !m2.jeNull.includes("mail2_odeslan_at")) {
    throw new Error(JSON.stringify(m2));
  }
  const suchy = filtryKroku(0, true);
  if (!suchy.jeNull.includes("mail1_dry_at")) throw new Error("suchy beh by se opakoval");
});

Deno.test("mimo okno 8 az 20 se mail neposle a due se posune", async () => {
  const posuny: Record<string, unknown>[] = [];
  const maily: unknown[] = [];
  const deps: PripominkaDeps = {
    ted: new Date("2026-01-15T20:30:00.000Z"),
    flagy: flagy({ dryRun: false }),
    nactiKandidaty: async () => [radek()],
    kontext: async () => ({
      aktivniEntitlement: false,
      aktivniKoucink: false,
      jinaSerie: null,
      dostalMarketingDnes: false,
      guardAkce: "send",
      guardDuvod: "ok",
    }),
    oznac: async (_id, patch) => {
      posuny.push(patch);
      return { ok: true };
    },
    zapisUdalost: async () => {},
    posliMail: async (p) => {
      maily.push(p);
      return { ok: true, status: 200, providerId: "re_nesmi" };
    },
    alert: async () => {},
  };
  const v = await zpracujPripominku(deps);
  if (maily.length !== 0 || v.odeslano !== 0) throw new Error(JSON.stringify(v));
  const due = String(posuny[0]?.mail1_due_at ?? "");
  if (due !== "2026-01-16T07:00:00.000Z") throw new Error(due);
});

Deno.test("vypnuty mail flag nevola Resend", async () => {
  const { maily, vysledek } = await beh([radek()], flagy({ mailZapnuto: false }));
  if (maily.length !== 0 || vysledek.duvod !== "mail_vypnuto") throw new Error(JSON.stringify(vysledek));
});
