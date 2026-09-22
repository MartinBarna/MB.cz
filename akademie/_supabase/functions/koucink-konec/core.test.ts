// Spuštění: npx --yes deno@2 run akademie/_supabase/functions/koucink-konec/core.test.ts
//
// Orchestrace automatu „konec koučinku" s falešnými závislostmi. Databáze ani
// síť se nevolají. Vzniklo po revizi R1 (nález S11): rozhodování žilo uvnitř
// `Deno.serve()`, takže ho test nemohl naimportovat, a právě proto revize našla
// tři smyčky, které testy nemohly vidět:
//   V1 rozloučení navždy ztracené po 4xx z Resendu,
//   V2 zaseknutá rezervace po timeoutu cronu,
//   S4 fronta `opakovat` bez stropu.
import {
  jeZaseknute,
  mailStavZRadku,
  type MailStav,
  MAX_POKUSU,
  razitkaDoFronty,
  rozhodniOPrevzatem,
  type BehDeps,
  type RazitkoRadek,
  zaber,
  ZASEKNUTO_PO_MS,
  zpracujJednoho,
} from "./core.ts";

let selhalo = 0;
function check(nazev: string, podminka: boolean, detail = ""): void {
  if (podminka) console.log("  ok   " + nazev);
  else { selhalo++; console.log("  FAIL " + nazev + (detail ? "  [" + detail + "]" : "")); }
}

const TED = Date.parse("2026-09-22T10:00:00Z");
const EMAIL = "klient@example.cz";

type Stopa = {
  razitka: Map<string, RazitkoRadek>;
  zapisy: Record<string, unknown>[];
  alerty: string[];
  alertyTelo: string[];
  volano: string[];
};

/** Falešné závislosti. Každý test si je posune tam, kam potřebuje. */
function mockDeps(opts: {
  razitko?: Partial<RazitkoRadek> & { duvod?: string | null };
  maAcademy?: boolean;
  brana?: "send" | "skip";
  sales?: "send" | "skip";
  promo?: { ok: true; kod: string } | { ok: false; chyba: string };
  promoPodlePokusu?: ({ ok: true; kod: string } | { ok: false; chyba: string })[];
  ukonceni?: { stav: string; maAcademy?: boolean; tvujcoach?: string; detail?: string };
  mail?: { ok: boolean; status: number; chyba?: string };
  maKupon?: boolean;
  narok?: { active: boolean | null; expiresAt: string | null };
  graceDny?: number;
  zapisSelze?: boolean;
  zapisSelzeOd?: number;
} = {}): { deps: BehDeps; stopa: Stopa } {
  const stopa: Stopa = { razitka: new Map(), zapisy: [], alerty: [], alertyTelo: [], volano: [] };
  if (opts.razitko) {
    stopa.razitka.set(EMAIL, {
      email: EMAIL,
      stav: "opakovat",
      promo_code: null,
      pokusy: 1,
      updated_at: new Date(TED).toISOString(),
      ...opts.razitko,
    });
  }
  const deps: BehDeps = {
    ted: () => TED,
    maKupon: opts.maKupon !== false,
    graceDny: opts.graceDny ?? 7,
    vlozRazitko: (email) => {
      stopa.volano.push("vloz");
      if (stopa.razitka.has(email)) return Promise.resolve({ ok: false, kod: "23505", detail: "duplicate" });
      stopa.razitka.set(email, { email, stav: "rezervovano", promo_code: null, pokusy: 1, mail_stav: "neposlano", updated_at: new Date(TED).toISOString() });
      return Promise.resolve({ ok: true, kod: "", detail: "" });
    },
    ctiRazitko: (email) => Promise.resolve({ radek: stopa.razitka.get(email) ?? null, chyba: "" }),
    prevezmi: (email, zeStavu, pokusy, jenZaseknute) => {
      stopa.volano.push("prevezmi:" + zeStavu + (jenZaseknute ? ":stare" : ""));
      const r = stopa.razitka.get(email);
      if (!r || r.stav !== zeStavu) return Promise.resolve({ pocet: 0, chyba: "" });
      // ⛔ Napodobuje SQL podmínku `updated_at < now() - 30 min`: bez ní by
      //    `rezervovano` → `rezervovano` prošlo dvěma volajícím naráz.
      if (jenZaseknute) {
        const t = Date.parse(String(r.updated_at ?? ""));
        if (Number.isFinite(t) && TED - t <= ZASEKNUTO_PO_MS) return Promise.resolve({ pocet: 0, chyba: "" });
      }
      stopa.razitka.set(email, { ...r, stav: "rezervovano", pokusy, updated_at: new Date(TED).toISOString() });
      return Promise.resolve({ pocet: 1, chyba: "" });
    },
    nastavRazitko: (email, pole) => {
      stopa.zapisy.push({ email, ...pole });
      if (opts.zapisSelze) return Promise.resolve(false);
      // `zapisSelzeOd: 2` = první zápis projde, druhý a další selžou. Tím jde
      // oddělit „nešlo zapsat `posilam`" od „nešel zapsat výsledek".
      if (opts.zapisSelzeOd && stopa.zapisy.length >= opts.zapisSelzeOd) return Promise.resolve(false);
      // ⚠️ Řádek se zakládá i tehdy, když ho test předem nevložil: `zpracujJednoho`
      //    se v testech volá i bez `zaber`, ale v provozu už razítko vždycky existuje.
      const r = stopa.razitka.get(email) ?? { email, stav: "rezervovano", promo_code: null, pokusy: 1, mail_stav: "neposlano" };
      stopa.razitka.set(email, { ...r, ...(pole as Partial<RazitkoRadek>) });
      return Promise.resolve(true);
    },
    stavNaroku: () => Promise.resolve(opts.narok ?? { active: true, expiresAt: new Date(TED - 30 * 86400000).toISOString() }),
    maAcademy: () => Promise.resolve(opts.maAcademy === true),
    brana: (_e, trida) => {
      const a = trida === "marketing" ? (opts.sales ?? "send") : (opts.brana ?? "send");
      return Promise.resolve({ action: a, reason: a === "skip" ? "hard_unsub" : "ok", decision: { trida } });
    },
    logSkip: () => { stopa.volano.push("logSkip"); return Promise.resolve(); },
    kodNeaktivni: "kod_neaktivni",
    vylosujKod: () => {
      stopa.volano.push("vylosujKod");
      return "VIP-KOD" + String(stopa.volano.filter((x) => x === "vylosujKod").length);
    },
    zalozPromo: (_e, kod) => {
      stopa.volano.push("zalozPromo:" + kod);
      // `promoPodlePokusu` umožní vrátit jinou odpověď na první a druhý pokus
      // (archivovaný kód => nový text).
      const poradi = stopa.volano.filter((x) => x.startsWith("zalozPromo:")).length;
      const zvlast = opts.promoPodlePokusu?.[poradi - 1];
      if (zvlast) return Promise.resolve(zvlast);
      return Promise.resolve(opts.promo ?? { ok: true, kod });
    },
    // deno-lint-ignore no-explicit-any
    ukonciPristup: () => {
      stopa.volano.push("ukonciPristup");
      const u = opts.ukonceni ?? { stav: "ok", maAcademy: opts.maAcademy === true, tvujcoach: "revoked" };
      // deno-lint-ignore no-explicit-any
      return Promise.resolve(u as any);
    },
    posliMail: (_e, o) => {
      stopa.volano.push("posliMail:" + (o.promoKod || "bez-kodu") + ":" + (o.includeSales ? "sales" : "bez-sales"));
      return Promise.resolve(opts.mail ?? { ok: true, status: 200 });
    },
    alert: (predmet, text) => {
      stopa.alerty.push(predmet);
      // ⚠️ Těla se sbírají zvlášť: u některých vad je rozdíl právě ve VĚTĚ,
      //    kterou Martin v alertu přečte, ne v jeho předmětu.
      stopa.alertyTelo.push(String(text ?? ""));
      return Promise.resolve();
    },
  };
  return { deps, stopa };
}

const posledniStav = (stopa: Stopa) => String(stopa.razitka.get(EMAIL)?.stav ?? "");
const posledniMail = (stopa: Stopa) => String(stopa.razitka.get(EMAIL)?.mail_stav ?? "");

// =============================================================================
console.log("\n== zaber: kdo se smí vzít ==");
{
  const { deps, stopa } = mockDeps();
  const z = await zaber(EMAIL, deps);
  check("nový člověk se zabere", z.stav === "ok" && z.predchozi === "" && z.pokusy === 1, JSON.stringify(z));
  check("nový má pokusy = 1", Number(stopa.razitka.get(EMAIL)?.pokusy) === 1);
}
{
  const { deps } = mockDeps({ razitko: { stav: "hotovo" } });
  const z = await zaber(EMAIL, deps);
  check("hotový se NEZABERE", z.stav === "obsazeno", JSON.stringify(z));
}
{
  // ⛔ `hotovo` je uzavřená práce bez ohledu na to, co říká `mail_stav`.
  const { deps } = mockDeps({ razitko: { stav: "hotovo", mail_stav: "nejiste" } });
  check("hotovo s nejistým mailem se NEZABERE", (await zaber(EMAIL, deps)).stav === "obsazeno");
}
{
  const { deps } = mockDeps({ razitko: { stav: "vzdano" } });
  check("vzdano se NEZABERE", (await zaber(EMAIL, deps)).stav === "obsazeno");
}
{
  const { deps } = mockDeps({ razitko: { stav: "opakovat", promo_code: "VIP-ULOZENY" } });
  const z = await zaber(EMAIL, deps);
  check("opakovat se zabere", z.stav === "ok" && z.predchozi === "opakovat", JSON.stringify(z));
  // ⛔ S4: uložený kód se PŘEDÁ dál, aby se ve Stripu nezakládal druhý.
  check("uložený promo kód se předá", z.stav === "ok" && z.promo === "VIP-ULOZENY");
  check("pokusy se zvedly", z.stav === "ok" && z.pokusy === 2);
}
{
  // ⛔ Stav mailu se ze `zaber` předává dál; podle NĚJ se pak rozhoduje.
  const { deps } = mockDeps({ razitko: { stav: "opakovat", mail_stav: "odmitnuto" } });
  const z = await zaber(EMAIL, deps);
  check("zabraný řádek nese stav mailu", z.stav === "ok" && z.mailStav === "odmitnuto", JSON.stringify(z));
}
{
  const { deps } = mockDeps({ razitko: { stav: "opakovat", mail_stav: "nesmysl" } });
  const z = await zaber(EMAIL, deps);
  check("neznámý stav mailu se čte jako `neposlano`", z.stav === "ok" && z.mailStav === "neposlano");
  check("mailStavZRadku: prázdno i nesmysl jsou `neposlano`",
    mailStavZRadku(null) === "neposlano" && mailStavZRadku("xxx") === "neposlano" &&
      mailStavZRadku("odeslano") === "odeslano");
}

// =============================================================================
// ⛔⛔ FRONTA BĚHU. Tady byla po R1 díra, kterou testy nemohly vidět: pravidla
//    uvnitř `zaber` (zaseknutá rezervace, strop pokusů) byla správně, ale fronta
//    v `index.ts` do `zaber` ty řádky VŮBEC NEPOUŠTĚLA. Mutace M15 a M16 proto
//    zůstávaly zelené: volaly `zaber` napřímo a frontu neviděly.
console.log("\n== V1 a V2: co patří do fronty běhu ==");
{
  const r = (email: string, stav: string, extra: Partial<RazitkoRadek> = {}): RazitkoRadek => ({
    email, stav, promo_code: null, pokusy: 1, updated_at: new Date(TED).toISOString(), ...extra,
  });
  const vstup: RazitkoRadek[] = [
    r("opakovat@x.cz", "opakovat"),
    r("mail@x.cz", "opakovat", { mail_stav: "odmitnuto" }),
    r("cerstve@x.cz", "rezervovano", { updated_at: new Date(TED - 60_000).toISOString() }),
    r("zaseknute@x.cz", "rezervovano", { updated_at: new Date(TED - ZASEKNUTO_PO_MS - 60_000).toISOString() }),
    r("hotovo@x.cz", "hotovo"),
    r("nejiste@x.cz", "hotovo", { mail_stav: "nejiste" }),
    r("vzdano@x.cz", "vzdano"),
    r("nadstropem@x.cz", "opakovat", { pokusy: MAX_POKUSU }),
    r("PREKLEP@x.cz", "opakovat"),
  ];
  const f = razitkaDoFronty(vstup, { tedMs: TED });
  check("`opakovat` do fronty patří", f.emaily.includes("opakovat@x.cz"));
  check("`opakovat` s odmítnutým mailem do fronty patří", f.emaily.includes("mail@x.cz"));
  // ⛔ TOHLE JE NÁLEZ V1: bez téhle řádky se pojistka na zaseknuté rezervace
  //    v provozu NIKDY nespustí, protože `zaber` se pro ně nezavolá.
  check("opuštěné `rezervovano` do fronty PATŘÍ", f.emaily.includes("zaseknute@x.cz"), f.emaily.join(","));
  check("čerstvé `rezervovano` do fronty NEpatří", !f.emaily.includes("cerstve@x.cz"));
  // ⛔ TOHLE JE NÁLEZ V2: řádek nad stropem musí do `zaber` dojít, jinak se
  //    `vzdano` nikdy nezapíše a alert „vzdávám to" nikdy nepřijde.
  check("řádek nad stropem do fronty PATŘÍ", f.emaily.includes("nadstropem@x.cz"), f.emaily.join(","));
  check("a je vidět v počítadle", f.nadStropem === 1, String(f.nadStropem));
  check("zaseknutých je vidět v počítadle", f.zaseknutych === 1, String(f.zaseknutych));
  check("uzavřené stavy do fronty NEpatří",
    !f.emaily.includes("hotovo@x.cz") && !f.emaily.includes("nejiste@x.cz") && !f.emaily.includes("vzdano@x.cz"));
  check("e-mail se normalizuje", f.emaily.includes("preklep@x.cz") && !f.emaily.includes("PREKLEP@x.cz"));
  check("prázdný seznam nespadne", razitkaDoFronty([], { tedMs: TED }).emaily.length === 0);
}

console.log("\n== V2: zaseknutá rezervace ==");
{
  // Čerstvá rezervace patří běžícímu běhu, do té se nesahá.
  const { deps } = mockDeps({ razitko: { stav: "rezervovano", updated_at: new Date(TED - 60_000).toISOString() } });
  const z = await zaber(EMAIL, deps);
  check("čerstvé `rezervovano` se NEZABERE", z.stav === "obsazeno", JSON.stringify(z));
}
{
  // ⛔ KONTRAST: po timeoutu cronu zůstane řádek v `rezervovano` navždy a bez
  //    téhle pojistky by ho další běh jen přeskakoval jako „má ho někdo jiný".
  const { deps, stopa } = mockDeps({
    razitko: { stav: "rezervovano", updated_at: new Date(TED - ZASEKNUTO_PO_MS - 60_000).toISOString() },
  });
  const z = await zaber(EMAIL, deps);
  check("opuštěné `rezervovano` se ZABERE", z.stav === "ok" && z.predchozi === "zaseknute", JSON.stringify(z));
  check("a Martin se o tom dozví", stopa.alerty.some((a) => a.includes("opuštěná rezervace")), JSON.stringify(stopa.alerty));
}
{
  const { deps } = mockDeps({ razitko: { stav: "rezervovano", updated_at: null } });
  check("`rezervovano` bez času se bere jako opuštěné",
    (await zaber(EMAIL, deps)).stav === "ok");
}
check("jeZaseknute: hranice 30 minut",
  jeZaseknute({ email: EMAIL, stav: "rezervovano", promo_code: null, updated_at: new Date(TED - ZASEKNUTO_PO_MS - 1).toISOString() }, TED) === true &&
  jeZaseknute({ email: EMAIL, stav: "rezervovano", promo_code: null, updated_at: new Date(TED - ZASEKNUTO_PO_MS + 60_000).toISOString() }, TED) === false);

console.log("\n== V1: zámek musí být vylučovací i pro rezervovano -> rezervovano ==");
{
  // ⛔⛔ TOHLE JE NÁLEZ V1. Přechod `rezervovano` → `rezervovano` splní svou
  //    vlastní podmínku POŘÁD, takže druhý volající prošel taky a oba poslali
  //    mail. Vylučovacím ho dělá až podmínka na stáří V TÉMŽE UPDATE.
  const { deps, stopa } = mockDeps({
    razitko: { stav: "rezervovano", updated_at: new Date(TED - ZASEKNUTO_PO_MS - 60_000).toISOString() },
  });
  const prvni = await zaber(EMAIL, deps);
  check("první běh opuštěnou rezervaci vezme", prvni.stav === "ok" && prvni.predchozi === "zaseknute");
  check("a žádá podmínku na stáří", stopa.volano.includes("prevezmi:rezervovano:stare"), stopa.volano.join(","));
  // Druhý běh hned po prvním: razítko je teď čerstvé, takže ho minout MUSÍ.
  const druhy = await zaber(EMAIL, deps);
  check("druhý běh už ji NEVEZME", druhy.stav === "obsazeno", JSON.stringify(druhy));
}
{
  // KONTRAST: u `opakovat` podmínku porušuje sám zápis, stáří se neřeší.
  const { deps, stopa } = mockDeps({ razitko: { stav: "opakovat" } });
  await zaber(EMAIL, deps);
  check("`opakovat` podmínku na stáří nežádá",
    stopa.volano.includes("prevezmi:opakovat") && !stopa.volano.includes("prevezmi:opakovat:stare"),
    stopa.volano.join(","));
}
{
  // ⛔ Alert o opuštěné rezervaci jde PŘED zámkem (nález S3): je to fakt o stavu
  //    databáze, ne odměna za vyhraný závod.
  const { deps, stopa } = mockDeps({
    razitko: { stav: "rezervovano", updated_at: new Date(TED - ZASEKNUTO_PO_MS - 60_000).toISOString() },
  });
  deps.prevezmi = () => Promise.resolve({ pocet: 0, chyba: "" });
  const z = await zaber(EMAIL, deps);
  check("prohraný závod nepokračuje", z.stav === "obsazeno");
  check("ale alert o opuštěné rezervaci PŘESTO jde",
    stopa.alerty.some((a) => a.includes("opuštěná rezervace")), JSON.stringify(stopa.alerty));
}

console.log("\n== S4: strop pokusů ==");
{
  const { deps, stopa } = mockDeps({ razitko: { stav: "opakovat", pokusy: MAX_POKUSU } });
  const z = await zaber(EMAIL, deps);
  check("po stropu se vzdává", z.stav === "vzdano", JSON.stringify(z));
  check("razítko jde na `vzdano`", posledniStav(stopa) === "vzdano", posledniStav(stopa));
  check("a jde alert", stopa.alerty.some((a) => a.includes("vzdávám")), JSON.stringify(stopa.alerty));
  check("Stripe se už vůbec nevolá", !stopa.volano.includes("zalozPromo"));
}
{
  const { deps } = mockDeps({ razitko: { stav: "opakovat", pokusy: MAX_POKUSU - 1 } });
  check("těsně pod stropem se ještě zkusí", (await zaber(EMAIL, deps)).stav === "ok");
}

console.log("\n== závod dvou běhů ==");
{
  const { deps, stopa } = mockDeps({ razitko: { stav: "opakovat" } });
  // Druhý běh mezitím stav přepnul, takže `prevezmi` nic nezmění.
  deps.prevezmi = () => Promise.resolve({ pocet: 0, chyba: "" });
  const z = await zaber(EMAIL, deps);
  check("kdo prohraje závod, neodesílá", z.stav === "obsazeno", JSON.stringify(z));
  check("a nic nezapsal", stopa.zapisy.length === 0);
}

// =============================================================================
console.log("\n== zpracujJednoho: šťastná cesta ==");
{
  const { deps, stopa } = mockDeps();
  const v = await zpracujJednoho(EMAIL, { predchozi: "", promo: "" }, deps);
  check("dojde až k `hotovo`", v.vysledek === "hotovo", JSON.stringify(v));
  // ⛔ Pořadí je závazné: kód se NEJDŘÍV vylosuje a uloží, pak se o něm dozví
  //    Stripe, pak se zavře přístup a teprve nakonec jde mail (revize R2, V2).
  check("pořadí: losování, Stripe, appka, mail",
    /vylosujKod,zalozPromo:[^,]+,ukonciPristup,posliMail/.test(stopa.volano.join(",")), stopa.volano.join(","));
  // ⛔⛔ KÓD MUSÍ BÝT ULOŽENÝ DŘÍV, NEŽ SE VOLÁ STRIPE. Opačné pořadí znamená,
  //    že pád sítě nechá ve Stripu kód, o kterém nevíme, a další běh založí další.
  const iUlozeni = stopa.zapisy.findIndex((z) => z.duvod === "promo_pending");
  check("kód se uloží PŘED voláním Stripu", iUlozeni === 0, JSON.stringify(stopa.zapisy[0]));
  check("mail nese nový kód", stopa.volano.some((x) => x.startsWith("posliMail:VIP-KOD1:sales")));
  check("razítko `hotovo` a `sent_ok`", posledniStav(stopa) === "hotovo" &&
    stopa.zapisy.some((z) => z.sent_ok === true));
}
{
  const { deps, stopa } = mockDeps({ maAcademy: true });
  const v = await zpracujJednoho(EMAIL, { predchozi: "", promo: "" }, deps);
  check("Academy: promo kód se nezakládá", v.vysledek === "hotovo" && !stopa.volano.includes("zalozPromo"));
  check("Academy: mail jde bez kódu", stopa.volano.some((x) => x.startsWith("posliMail:bez-kodu")));
}
{
  const { deps, stopa } = mockDeps({ brana: "skip" });
  const v = await zpracujJednoho(EMAIL, { predchozi: "", promo: "" }, deps);
  check("brána zavřená: přístup se stejně zavře", stopa.volano.includes("ukonciPristup"));
  check("brána zavřená: mail se neposílá", !stopa.volano.some((x) => x.startsWith("posliMail")));
  check("brána zavřená: razítko `hotovo`", v.vysledek === "hotovo_bez_mailu" && posledniStav(stopa) === "hotovo");
  check("brána zavřená: promo kód se nezakládá", !stopa.volano.includes("zalozPromo"));
}

console.log("\n== V1: mail spadl po zavřeném přístupu ==");
{
  // ⛔⛔ TOHLE JE TEN NÁLEZ. Resend 422 = tělo JISTĚ neodešlo, ale přístup už je pryč.
  const { deps, stopa } = mockDeps({ mail: { ok: false, status: 422, chyba: "resend_422:invalid" } });
  const v = await zpracujJednoho(EMAIL, { predchozi: "", promo: "" }, deps);
  check("mail jde na `odmitnuto`, práce na `opakovat`",
    v.vysledek === "odmitnuto" && posledniMail(stopa) === "odmitnuto" && posledniStav(stopa) === "opakovat",
    posledniStav(stopa) + "/" + posledniMail(stopa));
  // ⛔ Do revize tu alert NEBYL: alertovalo se jen u 5xx.
  check("alert jde HNED", stopa.alerty.some((a) => a.includes("rozloučení NEODESLO")), JSON.stringify(stopa.alerty));
  check("kód se uchová na příště", String(stopa.razitka.get(EMAIL)?.promo_code) === "VIP-KOD1");
}
{
  // ⛔⛔ DRUHÁ POLOVINA NÁLEZU: další běh takového člověka MUSÍ doposlat mail
  //    a NESMÍ znovu sahat na nárok. Před opravou vracel `ukonciPristup`
  //    `uz_ukoncen`, kód to četl jako „zavřel to někdo jinde" a mail přeskočil.
  const { deps, stopa } = mockDeps({ narok: { active: false, expiresAt: null } });
  const v = await zpracujJednoho(EMAIL, { predchozi: "opakovat", promo: "VIP-ULOZENY", mailStav: "odmitnuto" }, deps);
  check("opakování: `ukonciPristup` se NEVOLÁ", !stopa.volano.includes("ukonciPristup"), stopa.volano.join(","));
  check("opakování: mail se POŠLE", stopa.volano.some((x) => x.startsWith("posliMail:VIP-ULOZENY")), stopa.volano.join(","));
  // ⛔ Uložený kód při doposlání Stripe vůbec neřeší (revize R4): pád Stripu
  //    nesmí zablokovat rozloučení člověku, který přístup už nemá.
  check("opakování: Stripe se vůbec nevolá", !stopa.volano.some((x) => x.startsWith("zalozPromo")));
  check("opakování: skončí `hotovo` a `odeslano`", v.vysledek === "hotovo" && posledniMail(stopa) === "odeslano");
}
{
  // Nejistota (5xx) je JINÝ případ: mail mohl odejít, opakovat se nesmí.
  const { deps, stopa } = mockDeps({ mail: { ok: false, status: 503, chyba: "resend_503:" } });
  const v = await zpracujJednoho(EMAIL, { predchozi: "", promo: "" }, deps);
  check("5xx končí na `nejiste`", v.vysledek === "nejiste" && posledniMail(stopa) === "nejiste");
  check("a práce je uzavřená", posledniStav(stopa) === "hotovo");
}
{
  const { deps, stopa } = mockDeps({ mail: { ok: false, status: 0, chyba: "sit:timeout" } });
  await zpracujJednoho(EMAIL, { predchozi: "", promo: "" }, deps);
  check("pád sítě se taky bere jako nejistota", posledniMail(stopa) === "nejiste");
}
{
  const { deps, stopa } = mockDeps({ mail: { ok: false, status: 0, chyba: "missing_RESEND_API_KEY" } });
  const v = await zpracujJednoho(EMAIL, { predchozi: "", promo: "" }, deps);
  check("chybějící klíč je JISTÉ neodeslání", v.vysledek === "odmitnuto" && posledniMail(stopa) === "odmitnuto");
}

console.log("\n== S5: bez kupónu se nezavírá nic ==");
{
  const { deps, stopa } = mockDeps({ maKupon: false });
  const v = await zpracujJednoho(EMAIL, { predchozi: "", promo: "" }, deps);
  check("bez kupónu: `opakovat`", v.vysledek === "opakovat" && v.duvod === "bez_kuponu");
  check("bez kupónu: NIC se nezavřelo", !stopa.volano.includes("ukonciPristup"), stopa.volano.join(","));
  check("bez kupónu: Stripe se ani neptáme", !stopa.volano.includes("zalozPromo"));
  check("bez kupónu: mail neodešel", !stopa.volano.some((x) => x.startsWith("posliMail")));
  // ⛔ Alert KAŽDÝ běh, ne jednou týdně: jinak po pěti dnech bez pondělí zmizí
  //    i to jediné, co o tom stavu říkalo.
  check("bez kupónu: alert jde hned", stopa.alerty.some((a) => a.includes("kupón na roční VIP")));
  // ⛔⛔ Pokus se NEPOČÍTÁ (revize R2, nález V2): kupón je Martinova konfigurace,
  //    ne porucha klienta. Jinak by po pěti dnech skončil ve `vzdano` a po doplnění
  //    kupónu by ho automat už nikdy nevzal.
  const zapis = stopa.zapisy.find((z) => z.duvod === "bez_kuponu");
  check("bez kupónu: pokus se vrací zpět", Number(zapis?.pokusy) === 0, JSON.stringify(zapis));
}
{
  // Kdo má Academy, kupón nepotřebuje: jeho odchod projde i bez něj.
  const { deps, stopa } = mockDeps({ maKupon: false, maAcademy: true });
  const v = await zpracujJednoho(EMAIL, { predchozi: "", promo: "" }, deps);
  check("bez kupónu, ale s Academy: projde", v.vysledek === "hotovo" && stopa.volano.includes("ukonciPristup"));
}
{
  // A kdo nesmí dostat marketing, taky kupón nepotřebuje.
  const { deps, stopa } = mockDeps({ maKupon: false, sales: "skip" });
  const v = await zpracujJednoho(EMAIL, { predchozi: "", promo: "" }, deps);
  check("bez kupónu, ale bez prodejního bloku: projde", v.vysledek === "hotovo");
  check("a mail jde bez kódu i bez sales", stopa.volano.some((x) => x === "posliMail:bez-kodu:bez-sales"));
}

console.log("\n== V2: zápis promo kódu se nesmí zahodit ==");
{
  // ⛔⛔ Když se kód nepodaří ULOŽIT, Stripe se nesmí volat vůbec: jinak by tam
  //    vznikl kód, o kterém nevíme, a další pokus by založil další.
  const { deps, stopa } = mockDeps({ zapisSelze: true });
  const v = await zpracujJednoho(EMAIL, { predchozi: "", promo: "" }, deps);
  check("neuložený kód: Stripe se nevolá", !stopa.volano.some((x) => x.startsWith("zalozPromo")), stopa.volano.join(","));
  check("neuložený kód: NIC se nezavřelo", !stopa.volano.includes("ukonciPristup"));
  check("neuložený kód: `opakovat`", v.vysledek === "opakovat" && v.duvod === "promo_neulozen");
  check("neuložený kód: alert", stopa.alerty.some((a) => a.includes("nepodařilo uložit")));
}
{
  // Uložený kód se při dalším pokusu POUŽIJE, nový se nelosuje.
  const { deps, stopa } = mockDeps();
  await zpracujJednoho(EMAIL, { predchozi: "opakovat", promo: "VIP-ULOZENY", mailStav: "neposlano" }, deps);
  check("uložený kód se nelosuje znovu", !stopa.volano.includes("vylosujKod"), stopa.volano.join(","));
  check("ale Stripe se o něm ujistí (idempotentně)", stopa.volano.includes("zalozPromo:VIP-ULOZENY"));
}

console.log("\n== S4: zápis koncového stavu se ověřuje ==");
{
  // ⛔⛔ TOHLE JE JÁDRO R4: když se nepovede zapsat `posilam`, Resend se NEVOLÁ.
  //    Bez toho zápisu by se po selhání dalšího kroku nedalo poznat, jestli mail
  //    odešel, a automat by riskoval druhý.
  const { deps, stopa } = mockDeps({ zapisSelze: true });
  const v = await zpracujJednoho(EMAIL, { predchozi: "", promo: "", mailStav: "neposlano" },
    { ...deps, maAcademy: () => Promise.resolve(true) });
  check("neuložené `posilam`: Resend se NEVOLÁ", !stopa.volano.some((x) => x.startsWith("posliMail")),
    stopa.volano.join(","));
  check("neuložené `posilam`: `opakovat`", v.vysledek === "opakovat" && v.duvod === "posilam_neulozeno");
  check("neuložené `posilam`: alert", stopa.alerty.some((a) => a.includes("začínám posílat")));
}
{
  // ⛔ Zápis VÝSLEDKU selže až po odeslání. Řádek zůstane v `posilam` a po
  //    ochranné lhůtě se čte jako `nejiste`: druhý mail z toho nevznikne.
  const { deps, stopa } = mockDeps({ zapisSelzeOd: 2 });
  const v = await zpracujJednoho(EMAIL, { predchozi: "", promo: "", mailStav: "neposlano" },
    { ...deps, maAcademy: () => Promise.resolve(true) });
  check("mail odešel, výsledek se nezapsal: hlásí `hotovo`", v.vysledek === "hotovo");
  check("řádek zůstal v `posilam`", posledniMail(stopa) === "posilam", posledniMail(stopa));
  check("a alert to říká", stopa.alerty.some((a) => a.includes("razítko se neuložilo")), JSON.stringify(stopa.alerty));
  // ⛔ A tohle je ta pojistka: takový řádek se po lhůtě čte jako nejistota.
  check("po lhůtě je z toho `nejiste`, ne druhý mail",
    rozhodniOPrevzatem({ active: false, expiresAt: null }, { mailStav: "posilam", tedMs: TED, graceDny: 7 }) ===
      "nejiste_rozhodne_clovek");
}
{
  const { deps, stopa } = mockDeps({ zapisSelzeOd: 2, mail: { ok: false, status: 503, chyba: "resend_503:" } });
  const v = await zpracujJednoho(EMAIL, { predchozi: "", promo: "", mailStav: "neposlano" },
    { ...deps, maAcademy: () => Promise.resolve(true) });
  check("nejisté odeslání + neuložený výsledek = alert to řekne v těle", v.vysledek === "nejiste" &&
    stopa.alertyTelo.some((a) => a.includes("zůstal v `posilam`")), JSON.stringify(stopa.alerty));
}
{
  // Rozdělaná práce s `sent_ok: false` se NEDOPOSÍLÁ, uzavře se jako nejistá.
  const { deps, stopa } = mockDeps({ narok: { active: false, expiresAt: null } });
  const v = await zpracujJednoho(EMAIL, { predchozi: "zaseknute", promo: "VIP-X", mailStav: "nejiste" }, deps);
  check("nejistota z minula se NEOPAKUJE", v.vysledek === "nejiste" &&
    !stopa.volano.some((x) => x.startsWith("posliMail")), stopa.volano.join(","));
  check("a uzavře se jako `hotovo` + `nejiste`", posledniStav(stopa) === "hotovo" && posledniMail(stopa) === "nejiste");
  check("s alertem, který popisuje cestu přes admin",
    stopa.alerty.some((a) => a.includes("skončilo v nejistotě")));
}

console.log("\n== S6: archivovaný promo kód ==");
{
  // ⛔ Stripe archivuje promo kódy, když přestane platit jejich kupón, a nedovolí
  //    založit aktivní kód se stejným textem. Musí se vylosovat NOVÝ.
  const { deps, stopa } = mockDeps({
    promoPodlePokusu: [{ ok: false, chyba: "kod_neaktivni" }, { ok: true, kod: "VIP-KOD2" }],
  });
  const v = await zpracujJednoho(EMAIL, { predchozi: "", promo: "", mailStav: "neposlano" }, deps);
  check("archivovaný kód: vylosuje se nový", stopa.volano.filter((x) => x === "vylosujKod").length === 2,
    stopa.volano.join(","));
  check("archivovaný kód: mail jde s NOVÝM kódem",
    v.vysledek === "hotovo" && stopa.volano.some((x) => x === "posliMail:VIP-KOD2:sales"), stopa.volano.join(","));
  check("archivovaný kód: nový text se uloží",
    stopa.zapisy.some((z) => z.duvod === "promo_pending:nahrada_archivovaneho"));
}
{
  // Druhá kolize v řadě je porucha, ne náhoda: dál se to nezkouší.
  const { deps, stopa } = mockDeps({
    promoPodlePokusu: [{ ok: false, chyba: "kod_neaktivni" }, { ok: false, chyba: "kod_neaktivni" }],
  });
  const v = await zpracujJednoho(EMAIL, { predchozi: "", promo: "", mailStav: "neposlano" }, deps);
  check("dvě kolize za sebou = vzdát a nezavírat", v.vysledek === "opakovat" &&
    !stopa.volano.includes("ukonciPristup"), stopa.volano.join(","));
  check("a jen dva pokusy o Stripe", stopa.volano.filter((x) => x.startsWith("zalozPromo")).length === 2);
}

console.log("\n== selhání promo kódu a appky ==");
{
  const { deps, stopa } = mockDeps({ promo: { ok: false, chyba: "stripe_403:no write" } });
  const v = await zpracujJednoho(EMAIL, { predchozi: "", promo: "" }, deps);
  check("promo selhalo: `opakovat`", v.vysledek === "opakovat" && posledniStav(stopa) === "opakovat");
  check("promo selhalo: NIC se nezavřelo", !stopa.volano.includes("ukonciPristup"));
  check("promo selhalo: alert", stopa.alerty.some((a) => a.includes("promo kód")));
}
{
  const { deps, stopa } = mockDeps({ ukonceni: { stav: "appka_selhala", tvujcoach: "http-500" } });
  const v = await zpracujJednoho(EMAIL, { predchozi: "", promo: "" }, deps);
  check("appka selhala: `opakovat`", v.vysledek === "opakovat");
  check("appka selhala: mail neodešel", !stopa.volano.some((x) => x.startsWith("posliMail")));
  check("appka selhala: alert", stopa.alerty.some((a) => a.includes("appka neodpověděla")));
}
{
  const { deps, stopa } = mockDeps({ ukonceni: { stav: "uz_ukoncen" } });
  const v = await zpracujJednoho(EMAIL, { predchozi: "", promo: "" }, deps);
  check("zavřel ho někdo jinde: nic se neposílá", v.vysledek === "preskoceno" &&
    !stopa.volano.some((x) => x.startsWith("posliMail")));
}

console.log("\n== S8: rozdělaná práce vráceného klienta ==");
const roz = (
  narok: { active: boolean | null; expiresAt: string | null },
  mailStav: MailStav = "neposlano",
) => rozhodniOPrevzatem(narok, { mailStav, tedMs: TED, graceDny: 7 });

check("chyba čtení je `nevim`", roz({ active: null, expiresAt: null }) === "nevim");
check("jen mail + aktivní nárok = vrátil se", roz({ active: true, expiresAt: null }, "odmitnuto") === "znovu_klient");
check("jen mail + neaktivní nárok = doposlat", roz({ active: false, expiresAt: null }, "odmitnuto") === "dokonci_mail");
check("zavírání + nový konec v budoucnu = vrátil se",
  roz({ active: true, expiresAt: new Date(TED + 60 * 86400000).toISOString() }) === "znovu_klient");
check("zavírání + aktivní bez konce = vrátil se", roz({ active: true, expiresAt: null }) === "znovu_klient");
check("zavírání + starý konec = zavřít",
  roz({ active: true, expiresAt: new Date(TED - 30 * 86400000).toISOString() }) === "zavri");

// ⛔⛔ JÁDRO OPRAVY V1 (revize R2): vypnutý nárok NEZNAMENÁ „hotovo bez mailu".
//    Do R2 se to obojí slilo do `zavren_jinde`, takže převzatá zaseknutá rezervace
//    člověka umlčela navždy: přístup pryč, rozloučení nikdy, alert žádný.
//    Rozhoduje `sentOk`, a jen `true` se počítá jako prokázané odeslání.
check("vypnutý nárok + `neposlano` = doposlat",
  roz({ active: false, expiresAt: null }, "neposlano") === "dokonci_mail");
// ⛔⛔ TABULKA STAV MAILU × STAV NÁROKU (revize R4). Rozhoduje JEN `mail_stav`,
//    ne to, odkud řádek přišel. Do R4 tutéž informaci nesly dvě různá místa
//    (stav práce a boolean `sent_ok`), a když jedno zmizelo, význam druhého se
//    tiše převrátil.
{
  const VYPNUTY = { active: false, expiresAt: null };
  const PO_KONCI = { active: true, expiresAt: new Date(TED - 30 * 86400000).toISOString() };
  const BEZI = { active: true, expiresAt: new Date(TED + 60 * 86400000).toISOString() };
  const tabulka: [MailStav, string, string][] = [
    // mail_stav, nárok vypnutý, nárok po konci
    ["neposlano", "dokonci_mail", "zavri"],
    ["odmitnuto", "dokonci_mail", "zavri"],
    ["posilam", "nejiste_rozhodne_clovek", "nejiste_rozhodne_clovek"],
    ["nejiste", "nejiste_rozhodne_clovek", "nejiste_rozhodne_clovek"],
    ["odeslano", "uzavri_bez_mailu", "znovu_klient"],
  ];
  for (const [ms, prVypnuty, prPoKonci] of tabulka) {
    check("tabulka: " + ms + " + vypnutý nárok = " + prVypnuty, roz(VYPNUTY, ms) === prVypnuty, roz(VYPNUTY, ms));
    check("tabulka: " + ms + " + nárok po konci = " + prPoKonci, roz(PO_KONCI, ms) === prPoKonci, roz(PO_KONCI, ms));
  }
  // Běžící období je vždycky „vrátil se", ať se s mailem stalo cokoli.
  for (const [ms] of tabulka) {
    if (ms === "posilam" || ms === "nejiste") continue; // ty rozhoduje člověk
    check("tabulka: " + ms + " + běžící období = znovu_klient", roz(BEZI, ms) === "znovu_klient", roz(BEZI, ms));
  }
  // ⛔ Chyba čtení nároku přebíjí všechno: nesmí se sáhnout na nic.
  for (const [ms] of tabulka) {
    check("tabulka: " + ms + " + nečitelný nárok = nevim", roz({ active: null, expiresAt: null }, ms) === "nevim");
  }
}
{
  // ⛔ KONTRAST: razítko z minulého konce zůstalo (smazání při pozvánce selhalo)
  //    a člověk je zase klient. Nesmí dostat rozloučení uprostřed spolupráce.
  const { deps, stopa } = mockDeps({ narok: { active: true, expiresAt: null } });
  const v = await zpracujJednoho(EMAIL, { predchozi: "opakovat_mail", promo: "VIP-STARY" }, deps);
  check("vrácený klient nedostane rozloučení", v.vysledek === "preskoceno" &&
    !stopa.volano.some((x) => x.startsWith("posliMail")), stopa.volano.join(","));
  check("a ani se mu nic nezavře", !stopa.volano.includes("ukonciPristup"));
  check("a Martin se o tom dozví", stopa.alerty.some((a) => a.includes("klientovi, který se vrátil")));
}
{
  const { deps, stopa } = mockDeps({ narok: { active: true, expiresAt: new Date(TED + 60 * 86400000).toISOString() } });
  const v = await zpracujJednoho(EMAIL, { predchozi: "opakovat", promo: "" }, deps);
  check("vrácenému klientovi se nezavře nový nárok", v.vysledek === "preskoceno" &&
    !stopa.volano.includes("ukonciPristup"), stopa.volano.join(","));
}

console.log("\n== V3: chyba čtení nároku nesmí zahodit rozdělané rozloučení ==");
{
  const { deps, stopa } = mockDeps({ narok: { active: null, expiresAt: null } });
  const v = await zpracujJednoho(EMAIL, { predchozi: "opakovat", promo: "" }, deps);
  check("nečitelný nárok u `opakovat` = zůstane `opakovat`",
    v.vysledek === "opakovat" && posledniStav(stopa) === "opakovat");
  check("a nic se nestalo", !stopa.volano.includes("ukonciPristup"));
  check("a jde alert", stopa.alerty.some((a) => a.includes("nárok se nepodařilo přečíst")));
}
{
  // ⛔⛔ TOHLE BYL NÁLEZ V3 a od R4 je nezajímavý ze správného důvodu: stav mailu
  //    je vlastní sloupec, takže chyba čtení nároku na něj NEMÁ JAK sáhnout.
  //    Do R2 se sem psalo natvrdo `opakovat`, čímž se ze stavu práce, který nesl
  //    informaci o mailu, stalo obyčejné opakování a rozloučení se ztratilo.
  const { deps, stopa } = mockDeps({
    razitko: { stav: "opakovat", mail_stav: "odmitnuto" },
    narok: { active: null, expiresAt: null },
  });
  const v = await zpracujJednoho(EMAIL, { predchozi: "opakovat", promo: "VIP-X", mailStav: "odmitnuto" }, deps);
  check("nečitelný nárok nechá práci na `opakovat`", v.vysledek === "opakovat" && posledniStav(stopa) === "opakovat");
  check("a stavu MAILU se vůbec nedotkne", posledniMail(stopa) === "odmitnuto", posledniMail(stopa));
  check("žádný zápis nenese `mail_stav`", !stopa.zapisy.some((z) => "mail_stav" in z), JSON.stringify(stopa.zapisy));
  check("a mail se teď neposílá", !stopa.volano.some((x) => x.startsWith("posliMail")));
  check("a nesahá se na nárok", !stopa.volano.includes("ukonciPristup"));
}
{
  // Doposlání po zaseknuté rezervaci: přístup pryč, rozloučení chybí.
  const { deps, stopa } = mockDeps({ narok: { active: false, expiresAt: null } });
  const v = await zpracujJednoho(EMAIL, { predchozi: "zaseknute", promo: "VIP-ULOZENY", mailStav: "neposlano" }, deps);
  check("zaseknuté s vypnutým nárokem POŠLE mail",
    v.vysledek === "hotovo" && stopa.volano.some((x) => x.startsWith("posliMail:VIP-ULOZENY")), stopa.volano.join(","));
  check("a na nárok už nesáhne", !stopa.volano.includes("ukonciPristup"));
}
{
  const { deps, stopa } = mockDeps({ narok: { active: false, expiresAt: null } });
  const v = await zpracujJednoho(EMAIL, { predchozi: "zaseknute", promo: "VIP-X", mailStav: "odeslano" }, deps);
  check("zaseknuté s prokázaným odesláním jen uzavře",
    v.vysledek === "preskoceno" && v.duvod === "uz_odeslano" && !stopa.volano.some((x) => x.startsWith("posliMail")));
}
{
  // ⛔ U NOVÉHO člověka se živý stav neověřuje: výběr ho vybral podle data teď.
  const { deps, stopa } = mockDeps({ narok: { active: true, expiresAt: null } });
  const v = await zpracujJednoho(EMAIL, { predchozi: "", promo: "" }, deps);
  check("nový člověk kontrolou neprochází", v.vysledek === "hotovo" && stopa.volano.includes("ukonciPristup"));
}

console.log(selhalo === 0 ? "\nVSE ZELENE\n" : `\n${selhalo} SELHANI\n`);
if (selhalo > 0) throw new Error(String(selhalo) + " selhani");
