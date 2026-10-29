// Upozornění na nový lead. Spuštění (bez sítě, bez env):
//   npx --yes deno@2 test --no-lock akademie/_supabase/functions/lead-capture/upozorneni.test.ts
import {
  ALERT_TO,
  casPraha,
  jeAno,
  jeTestovaciLead,
  jeZapnuto,
  ohlasNovyLead,
  pulnocPrahaIso,
  rozhodni,
  sestavMail,
  stropZHodnoty,
  VYCHOZI_STROP,
  type Konfig,
  type Zavislosti,
} from "./upozorneni.ts";

function check(nazev: string, podminka: boolean, detail = ""): void {
  if (!podminka) throw new Error(nazev + (detail ? " [" + detail + "]" : ""));
}

const TED = new Date("2026-10-29T15:00:00.000Z");
const LEAD = { email: "jana@example.com", name: "Jana", source: "kviz", track: "kviz-vikend" };

function hodinyPraha(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Prague",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

Deno.test("půlnoc Prahy je 00:00 místního času a není v budoucnosti", () => {
  for (const iso of ["2026-01-15T12:00:00.000Z", "2026-07-15T12:00:00.000Z", "2026-10-29T15:00:00.000Z", "2026-10-24T22:30:00.000Z"]) {
    const ted = new Date(iso);
    const pul = pulnocPrahaIso(ted);
    const hod = hodinyPraha(pul).replace("24:00:00", "00:00:00");
    check("půlnoc " + iso, hod === "00:00:00", hod);
    check("půlnoc <= teď " + iso, new Date(pul).getTime() <= ted.getTime());
    check("půlnoc v posledních 24 h " + iso, ted.getTime() - new Date(pul).getTime() < 86400000);
  }
});

Deno.test("čas v mailu je pražský, ne UTC", () => {
  const t = casPraha(TED);
  check("hodina 16", t.includes("16"), t);
  check("den 29", t.includes("29"), t);
  check("rok", t.includes("2026"), t);
});

Deno.test("přepínač: cokoliv jiného než ano/1/true/on je vypnuto, env vyhrává", () => {
  check("prázdné", jeAno("") === false);
  check("null", jeAno(null) === false);
  check("ne", jeAno("ne") === false);
  check("ano", jeAno(" Ano ") === true);
  check("1", jeAno("1") === true);
  check("true", jeAno("TRUE") === true);
  check("on", jeAno("on") === true);
  check("yes není ano", jeAno("yes") === false);
  check("chybí obojí", jeZapnuto(undefined, null) === false);
  check("config ano", jeZapnuto(undefined, "ano") === true);
  check("env ne přebíjí config ano", jeZapnuto("ne", "ano") === false);
  check("env ano přebíjí config ne", jeZapnuto("ano", "ne") === true);
  check("prázdný env není rozhodnutí", jeZapnuto("  ", "ano") === true);
});

Deno.test("strop: nečíslo a extrém padají na výchozí 10", () => {
  check("výchozí", stropZHodnoty(null) === VYCHOZI_STROP);
  check("10", stropZHodnoty("10") === 10);
  check("1", stropZHodnoty("1") === 1);
  check("40", stropZHodnoty("40") === 40);
  check("0", stropZHodnoty("0") === VYCHOZI_STROP);
  check("41", stropZHodnoty("41") === VYCHOZI_STROP);
  check("text", stropZHodnoty("deset") === VYCHOZI_STROP);
  check("zlomek", stropZHodnoty("10.5") === VYCHOZI_STROP);
});

Deno.test("testovací lead: TEST a +tester, ne obyčejné jméno", () => {
  check("TEST", jeTestovaciLead("jana@example.com", "TEST") === true);
  check("test-claude", jeTestovaciLead("jana@example.com", "test-claude") === true);
  check("A TEST", jeTestovaciLead("jana@example.com", "A TEST") === true);
  check("Tester není TEST", jeTestovaciLead("jana@example.com", "Tester") === false);
  check("+tester", jeTestovaciLead("jana+tester@gmail.com", "Jana") === true);
  check("+TESTER", jeTestovaciLead("Jana+TESTER@gmail.com", "Jana") === true);
  check("contest", jeTestovaciLead("contest@example.com", "Jana") === false);
  check("normální", jeTestovaciLead("jana@example.com", "Jana Nováková") === false);
});

Deno.test("rozhodnutí: vypnuto, test, duplicita, strop, souhrn na hraně", () => {
  const zaklad = { duplicate: false, email: LEAD.email, name: LEAD.name, zapnuto: true, pocetDnes: 1, strop: 10 };
  check("jeden", rozhodni(zaklad).poslat === true && rozhodni(zaklad).poslat && (rozhodni(zaklad) as { druh: string }).druh === "jeden");
  check("vypnuto", rozhodni({ ...zaklad, zapnuto: false }).poslat === false);
  check("duplicita", rozhodni({ ...zaklad, duplicate: true }).poslat === false);
  check("test jménem", rozhodni({ ...zaklad, name: "TEST" }).poslat === false);
  check("test mailem", rozhodni({ ...zaklad, email: "a+tester@x.cz" }).poslat === false);
  check("počet neznámý", rozhodni({ ...zaklad, pocetDnes: null }).poslat === false);
  const naHrane = rozhodni({ ...zaklad, pocetDnes: 11 });
  check("souhrn", naHrane.poslat === true && naHrane.poslat && (naHrane as { druh: string }).druh === "souhrn");
  check("nad stropem ticho", rozhodni({ ...zaklad, pocetDnes: 12 }).poslat === false);
  check("přesně strop ještě jeden", rozhodni({ ...zaklad, pocetDnes: 10 }).poslat === true);
});

Deno.test("mail nese zdroj, trať, pražský čas a e-mail, nic z requestu navíc", () => {
  const m = sestavMail({
    druh: "jeden",
    source: "kviz<script>",
    track: "kviz-vikend",
    email: "jana+tag@example.com",
    kdy: TED,
    pocetDnes: 1,
    strop: 10,
  });
  check("předmět bez e-mailu", !m.subject.includes("jana"));
  check("předmět má zdroj", m.subject.includes("kviz"));
  check("html má e-mail", m.html.includes("jana+tag@example.com"));
  check("html má zdroj escapovaný", m.html.includes("kviz&lt;script&gt;") && !m.html.includes("<script>"));
  check("text má e-mail", m.text.includes("jana+tag@example.com"));
  check("čas praha", m.text.includes("16"));
  check("trať", m.text.includes("kviz-vikend"));
  for (const zakaz of ["utm_", "gclid", "fbclid", "heslo", "password", "token", "authorization"]) {
    check("bez " + zakaz, !m.html.toLowerCase().includes(zakaz) && !m.text.toLowerCase().includes(zakaz));
  }
  check("příjemce je Martin", ALERT_TO === "fitness.barna@gmail.com");
});

Deno.test("souhrn řekne počet a taky poslední e-mail", () => {
  const m = sestavMail({
    druh: "souhrn",
    source: "lead_magnet",
    track: "lead-magnet",
    email: "jana@example.com",
    kdy: TED,
    pocetDnes: 11,
    strop: 10,
  });
  check("počet", m.text.includes("11") && m.subject.includes("11"));
  check("e-mail v těle", m.text.includes("jana@example.com"));
  check("e-mail není v předmětu", !m.subject.includes("jana@"));
});

type Stopa = { konfig: number; pocet: number; maily: { subject: string; html: string; text: string }[] };

function deps(stopa: Stopa, opts: { env?: string; konfig?: Konfig; pocet?: number | "chyba"; konfigChyba?: boolean; posliChyba?: boolean }): Zavislosti {
  return {
    env: () => opts.env,
    ted: TED,
    prectiKonfig: async () => {
      stopa.konfig++;
      if (opts.konfigChyba) throw new Error("db config");
      return opts.konfig ?? { prepniac: null, strop: null };
    },
    spocitejOd: async (iso) => {
      stopa.pocet++;
      check("počítá od půlnoci", iso === pulnocPrahaIso(TED), iso);
      if (opts.pocet === "chyba") throw new Error("db count");
      return opts.pocet ?? 1;
    },
    posli: async (m) => {
      if (opts.posliChyba) throw new Error("resend leží");
      stopa.maily.push(m);
      return { ok: true, status: 200 };
    },
  };
}

Deno.test("vypnutý přepínač nepočítá a neposílá", async () => {
  const s: Stopa = { konfig: 0, pocet: 0, maily: [] };
  const v = await ohlasNovyLead(deps(s, {}), LEAD);
  check("duvod", v.posilano === false && v.duvod === "vypnuto", v.duvod);
  check("config se četla", s.konfig === 1);
  check("počet ne", s.pocet === 0 && s.maily.length === 0);
});

Deno.test("env ne je kill switch bez čtení DB", async () => {
  const s: Stopa = { konfig: 0, pocet: 0, maily: [] };
  const v = await ohlasNovyLead(deps(s, { env: "ne", konfig: { prepniac: "ano", strop: "10" } }), LEAD);
  check("vypnuto", v.duvod === "vypnuto" && v.posilano === false);
  check("bez DB", s.konfig === 0 && s.pocet === 0 && s.maily.length === 0);
});

Deno.test("zapnuto pošle jeden mail se zdrojem a e-mailem", async () => {
  const s: Stopa = { konfig: 0, pocet: 0, maily: [] };
  const v = await ohlasNovyLead(deps(s, { konfig: { prepniac: "ano", strop: null } }), LEAD);
  check("odesláno", v.posilano === true && v.duvod === "jeden", v.duvod);
  check("jeden mail", s.maily.length === 1);
  check("tělo", s.maily[0].text.includes("jana@example.com") && s.maily[0].text.includes("kviz"));
});

Deno.test("TEST a +tester nevolají poštu ani počet", async () => {
  for (const lead of [
    { ...LEAD, name: "TEST" },
    { ...LEAD, email: "a+tester@example.com" },
  ]) {
    const s: Stopa = { konfig: 0, pocet: 0, maily: [] };
    const v = await ohlasNovyLead(deps(s, { konfig: { prepniac: "ano", strop: "10" } }), lead);
    check("test " + lead.email, v.duvod === "test" && s.maily.length === 0 && s.pocet === 0 && s.konfig === 0);
  }
});

Deno.test("duplicita neposílá", async () => {
  const s: Stopa = { konfig: 0, pocet: 0, maily: [] };
  const v = await ohlasNovyLead(deps(s, { konfig: { prepniac: "ano", strop: "10" } }), { ...LEAD, duplicate: true });
  check("duplicita", v.duvod === "duplicita" && s.maily.length === 0 && s.konfig === 0);
});

Deno.test("jedenáctý lead je souhrn, dvanáctý ticho", async () => {
  const s11: Stopa = { konfig: 0, pocet: 0, maily: [] };
  const v11 = await ohlasNovyLead(deps(s11, { konfig: { prepniac: "ano", strop: "10" }, pocet: 11 }), LEAD);
  check("souhrn", v11.duvod === "souhrn" && s11.maily.length === 1 && s11.maily[0].subject.includes("11"));
  const s12: Stopa = { konfig: 0, pocet: 0, maily: [] };
  const v12 = await ohlasNovyLead(deps(s12, { konfig: { prepniac: "ano", strop: "10" }, pocet: 12 }), LEAD);
  check("ticho", v12.duvod === "strop" && v12.posilano === false && s12.maily.length === 0);
});

Deno.test("chyba počtu ani pošty neshodí volajícího", async () => {
  const s1: Stopa = { konfig: 0, pocet: 0, maily: [] };
  const a = await ohlasNovyLead(deps(s1, { konfig: { prepniac: "ano", strop: "10" }, pocet: "chyba" }), LEAD);
  check("pocet", a.duvod === "pocet" && a.posilano === false);
  const s2: Stopa = { konfig: 0, pocet: 0, maily: [] };
  const b = await ohlasNovyLead(deps(s2, { konfig: { prepniac: "ano", strop: "10" }, posliChyba: true }), LEAD);
  check("vyjimka", b.duvod === "vyjimka" && b.posilano === false);
  const s3: Stopa = { konfig: 0, pocet: 0, maily: [] };
  const c = await ohlasNovyLead(deps(s3, { konfigChyba: true }), LEAD);
  check("config", c.duvod === "config" && s3.maily.length === 0 && s3.pocet === 0);
});

Deno.test("env ano funguje i když config spadne, strop zůstane výchozí", async () => {
  const s: Stopa = { konfig: 0, pocet: 0, maily: [] };
  const v = await ohlasNovyLead(deps(s, { env: "ano", konfigChyba: true, pocet: 11 }), LEAD);
  check("souhrn na výchozím stropu 10", v.duvod === "souhrn", v.duvod);
});

Deno.test("lead-capture neawaituje alert, posílá přes posliMail a ne přes Resend napřímo", async () => {
  const src = await Deno.readTextFile(new URL("./index.ts", import.meta.url));
  const kod = src.split("\n").filter((l) => !/^\s*\/\//.test(l)).join("\n");
  check("volá ohlas", kod.includes("ohlasNovyLead("));
  check("neawaituje", !/await\s+ohlasNovyLead\s*\(/.test(kod));
  check("waitUntil", kod.includes("waitUntil"));
  check("posliMail", kod.includes("posliMail("));
  check("žádný přímý Resend", !kod.includes("api.resend.com"));
  check("jen po úspěchu, ne při duplicate v téže větvi návratu 500", kod.includes("if (!duplicate)"));
});

Deno.test("děkovačka má tichý odkaz na Academy bez utm, ceny a slibu kapacity", async () => {
  const html = await Deno.readTextFile(new URL("../../../../dekuji-videokurz/index.html", import.meta.url));
  const m = html.match(/<div class="academy-tichy"[\s\S]*?<\/div>/);
  check("blok je", !!m);
  const blok = m![0];
  check("kanonická adresa", blok.includes('href="https://martinbarna.cz/akademie/"'));
  check("bez utm", !blok.includes("utm_"));
  check("bez ceny", !/Kč|Kc/.test(blok));
  check("bez prvních 50", !/prvních 50|prvnich 50/i.test(blok));
  check("bez dlouhé pomlčky", !blok.includes("—") && !blok.includes("–"));
});
