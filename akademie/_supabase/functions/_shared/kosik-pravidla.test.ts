import {
  FLAGY_VYCHOZI,
  duvodStopu,
  flagBool,
  jeMarketingovaUdalost,
  jeVOkne30Dni,
  mail2Po,
  maUplnySouhlas,
  posunDoOkna,
  posunKvuliPromu,
  rozdelPodleCastky,
  sablonaProKlic,
  slozFlagy,
  type RadekStop,
} from "./kosik-pravidla.ts";

function iso(d: Date): string {
  return d.toISOString();
}

const zaklad = (): RadekStop => ({
  produkt_klic: "konzultace",
  email: "a@b.cz",
  test: false,
  zaplaceno_at: null,
  odpoved_at: null,
  odhlaseno_at: null,
  recovery_expires_at: "2026-12-01T00:00:00.000Z",
  recovery_url: "https://checkout.stripe.com/c/pay/cs_test",
});

const ctx = (over: Partial<Parameters<typeof duvodStopu>[1]> = {}) => ({
  ted: new Date("2026-06-01T12:00:00.000Z"),
  aktivniEntitlement: false,
  aktivniKoucink: false,
  guardAkce: "send" as const,
  guardDuvod: "ok",
  dryRun: true,
  jinaSerieDo30Dni: false,
  ...over,
});

Deno.test("okno 8 az 20 Praha, zima, leto a prechod casu", () => {
  const stejne = (vstup: string, ocekavano: string) => {
    const out = iso(posunDoOkna(new Date(vstup)));
    if (out !== ocekavano) throw new Error(vstup + " -> " + out + " != " + ocekavano);
  };
  stejne("2026-01-15T13:00:00.000Z", "2026-01-15T13:00:00.000Z");
  stejne("2026-01-15T05:30:00.000Z", "2026-01-15T07:00:00.000Z");
  stejne("2026-01-15T19:00:00.000Z", "2026-01-15T19:00:00.000Z");
  stejne("2026-01-15T19:00:01.000Z", "2026-01-16T07:00:00.000Z");
  stejne("2026-01-15T20:15:00.000Z", "2026-01-16T07:00:00.000Z");
  stejne("2026-07-15T12:00:00.000Z", "2026-07-15T12:00:00.000Z");
  stejne("2026-07-15T19:00:00.000Z", "2026-07-16T06:00:00.000Z");
  stejne("2026-03-28T21:30:00.000Z", "2026-03-29T06:00:00.000Z");
  stejne("2026-10-24T19:30:00.000Z", "2026-10-25T07:00:00.000Z");
  stejne("2026-10-25T00:30:00.000Z", "2026-10-25T07:00:00.000Z");
});

Deno.test("48 h a pak znovu do okna", () => {
  const vOkne = iso(mail2Po(new Date("2026-01-15T13:00:00.000Z")));
  if (vOkne !== "2026-01-17T13:00:00.000Z") throw new Error(vOkne);
  const poPulnoci = iso(mail2Po(new Date("2026-01-15T19:30:00.000Z")));
  if (poPulnoci !== "2026-01-18T07:00:00.000Z") throw new Error(poPulnoci);
});

Deno.test("strop 30 dnu", () => {
  const ted = new Date("2026-06-01T12:00:00.000Z");
  const den = 24 * 3600 * 1000;
  if (!jeVOkne30Dni(new Date(ted.getTime() - 29 * den), ted)) throw new Error("29 dnu ma blokovat");
  if (jeVOkne30Dni(new Date(ted.getTime() - 30 * den), ted)) throw new Error("presne 30 dnu uz nema blokovat");
  if (jeVOkne30Dni(null, ted)) throw new Error("bez serie se neblokuje");
});

Deno.test("promo utery a patek posune o den, jiny den ne", () => {
  const uter = new Date("2026-01-13T09:00:00.000Z");
  const poUterku = iso(posunKvuliPromu(uter, true));
  if (poUterku !== "2026-01-14T09:00:00.000Z") throw new Error(poUterku);
  if (iso(posunKvuliPromu(uter, false)) !== iso(uter)) throw new Error("bez mailu se neposouva");
  const patek = new Date("2026-01-16T18:30:00.000Z");
  const poPatku = iso(posunKvuliPromu(patek, true));
  if (poPatku !== "2026-01-17T18:30:00.000Z") throw new Error(poPatku);
  const pondeli = new Date("2026-01-12T09:00:00.000Z");
  if (iso(posunKvuliPromu(pondeli, true)) !== iso(pondeli)) throw new Error("pondeli se neposouva");
});

Deno.test("stop podminky", () => {
  const cisty = duvodStopu(zaklad(), ctx());
  if (cisty !== null) throw new Error("cisty radek nema stop: " + cisty);
  const pripady: [string, RadekStop, ReturnType<typeof ctx>][] = [
    ["zaplaceno", { ...zaklad(), zaplaceno_at: "2026-01-01T00:00:00.000Z" }, ctx()],
    ["ma_pristup", zaklad(), ctx({ aktivniEntitlement: true })],
    ["aktivni_koucink", zaklad(), ctx({ aktivniKoucink: true })],
    ["odpoved", { ...zaklad(), odpoved_at: "2026-01-02T00:00:00.000Z" }, ctx()],
    ["odhlaseno", { ...zaklad(), odhlaseno_at: "2026-01-02T00:00:00.000Z" }, ctx()],
    ["brana_hard_unsubscribe", zaklad(), ctx({ guardAkce: "skip", guardDuvod: "hard_unsubscribe" })],
    ["test", { ...zaklad(), test: true }, ctx({ dryRun: false })],
    ["test", { ...zaklad(), email: "a+test@b.cz" }, ctx({ dryRun: false })],
    ["bez_recovery", { ...zaklad(), recovery_url: null }, ctx()],
    ["recovery_expirovalo", { ...zaklad(), recovery_expires_at: "2026-01-01T00:00:00.000Z" }, ctx()],
    ["strop_30_dni", zaklad(), ctx({ jinaSerieDo30Dni: true })],
  ];
  for (const [cekany, radek, okol] of pripady) {
    const duvod = duvodStopu(radek, okol);
    if (duvod !== cekany) throw new Error(JSON.stringify(radek.email) + " " + duvod + " != " + cekany);
  }
  if (duvodStopu({ ...zaklad(), test: true }, ctx({ dryRun: true })) !== null) {
    throw new Error("test radek v dry-run nema byt stop");
  }
  const koucink = duvodStopu(
    { ...zaklad(), produkt_klic: "coaching-gold-3" },
    ctx({ aktivniKoucink: true }),
  );
  if (koucink !== null) throw new Error("aktivni koucink nema zastavit pripominku koucinku: " + koucink);
});

Deno.test("souhlas musi byt uplny", () => {
  const ok = {
    souhlas: true,
    souhlas_at: "t",
    souhlas_text: "text",
    souhlas_verze: "v",
    stripe_session_id: "cs",
  };
  if (!maUplnySouhlas(ok)) throw new Error("uplny ma projit");
  if (maUplnySouhlas({ ...ok, souhlas: false })) throw new Error("false");
  if (maUplnySouhlas({ ...ok, souhlas_text: null })) throw new Error("bez textu");
  if (maUplnySouhlas({ ...ok, souhlas_at: "  " })) throw new Error("prazdny cas");
  if (maUplnySouhlas({ ...ok, stripe_session_id: null })) throw new Error("bez session");
});

Deno.test("slouceni necha vyssi castku", () => {
  const skupiny = rozdelPodleCastky([
    { id: "a", email: "A@b.cz", castka_halere: 299000, created_at: "2026-01-02T00:00:00.000Z" },
    { id: "b", email: "a@b.cz", castka_halere: 645000, created_at: "2026-01-03T00:00:00.000Z" },
    { id: "c", email: "jiny@b.cz", castka_halere: 100, created_at: "2026-01-01T00:00:00.000Z" },
  ]);
  const prvni = skupiny.find((s) => s.vitez.email.toLowerCase() === "a@b.cz");
  if (!prvni || prvni.vitez.id !== "b" || prvni.sloucit.map((x) => x.id).join() !== "a") {
    throw new Error(JSON.stringify(skupiny));
  }
});

Deno.test("flagy jsou ve vychozim stavu vypnute a dry-run zapnuty", () => {
  const f = slozFlagy([], undefined);
  if (f.webZapnuto !== false || f.mailZapnuto !== false || f.dryRun !== true || f.garanceK1 !== false) {
    throw new Error(JSON.stringify(f));
  }
  if (f.produkty.join() !== "konzultace") throw new Error(f.produkty.join());
  const vypnutyDry = slozFlagy([{ key: "kosik_dry_run", value: "false" }], "1");
  if (!vypnutyDry.dryRun) throw new Error("env 1 musi dry-run zapnout");
  if (flagBool("false", true) !== false) throw new Error("false");
  if (FLAGY_VYCHOZI.garanceK1 !== false) throw new Error("garance");
});

Deno.test("marketing z dripu sedi pres lead_id, ne jen detail.email", () => {
  const drip = { type: "sent", lead_id: "lead-1", detail: { track: "lead-magnet", key: "0" } };
  if (!jeMarketingovaUdalost(drip, "a@b.cz", "lead-1")) throw new Error("lead_id ma stacit");
  if (jeMarketingovaUdalost(drip, "a@b.cz", "jiny-lead")) throw new Error("cizi lead");
  if (!jeMarketingovaUdalost({ type: "sent", lead_id: null, detail: { email: "a@b.cz" } }, "a@b.cz", null)) {
    throw new Error("detail.email");
  }
  if (jeMarketingovaUdalost({ type: "sent", lead_id: "lead-1", detail: { track: "kosik-konzultace", email: "a@b.cz" } }, "a@b.cz", "lead-1")) {
    throw new Error("kosik track se nepocita");
  }
  if (jeMarketingovaUdalost({ type: "open", lead_id: "lead-1", detail: {} }, "a@b.cz", "lead-1")) {
    throw new Error("open neni marketing");
  }
});

Deno.test("videokurz a academy nemaji sablonu teto vlny", () => {
  if (sablonaProKlic("konzultace") !== "kosik-konzultace") throw new Error("konzultace");
  if (sablonaProKlic("coaching-gold-1") !== "kosik-koucink") throw new Error("koucink");
  if (sablonaProKlic("videokurz") !== null) throw new Error("videokurz");
  if (sablonaProKlic("academy-lifetime") !== null) throw new Error("academy");
});
