// Ceny v mailových šablonách (23. 9. 2026). Spuštění:
//   npx deno run -A --node-modules-dir=none akademie/_supabase/functions/_shared/ceny.test.ts
// Hlídá: formát, „nenačtená cena CHYBÍ" (žádná záloha), jiná konfigurace = jiné číslo,
// a tvar kódu ve čtyřech rendererech (kontrola PŘED odesláním).
import {
  CENOVE_PROMENNE,
  chybejiciCeny,
  chybejiciPromenne,
  formatujCenu,
  nactiCeny,
  promenneVSablone,
  sestavCeny,
  slevyVideokurzu,
  Z_APP_CONFIG,
} from "./ceny.ts";

let selhalo = 0;
function check(nazev: string, podminka: boolean, detail = ""): void {
  if (podminka) console.log("  ok   " + nazev);
  else { selhalo++; console.log("  FAIL " + nazev + (detail ? "  [" + detail + "]" : "")); }
}

const CONFIG = [
  { key: "cena_videokurz", value: "1490" },
  { key: "cena_academy", value: "8900" },
  { key: "cena_academy_mesic", value: "990" },
  { key: "cena_academy_upgrade", value: "7410" },
  { key: "cena_academy_po_odectu", value: "5930" },
  { key: "cena_konzultace", value: "2990" },
  { key: "cena_konzultace_sleva", value: "2190" },
  { key: "cena_balicek", value: "349" },
  { key: "cena_doplatek_videokurz", value: "1140" },
];
const CENIK = [
  { tier: "ai_basic", interval: "month", price_czk: 499.0, segment: null },
  { tier: "basic", interval: "month", price_czk: 249.0, segment: null },
  { tier: "basic", interval: "year", price_czk: 2490.0, segment: null },
  { tier: "ai_basic", interval: "year", price_czk: 4990.0, segment: null },
  { tier: "ai_kontrola", interval: "month", price_czk: 1990.0, segment: null },
];
const ok = (data: unknown[]) => ({ data: data as Record<string, unknown>[], error: null });
const chyba = (m: string) => ({ data: null, error: new Error(m) });

console.log("\n== formát ==");
check("249", formatujCenu(249) === "249");
check("990", formatujCenu(990) === "990");
check("2 490", formatujCenu(2490) === "2 490");
check("8 900", formatujCenu(8900) === "8 900");
check("37 500", formatujCenu(37500) === "37 500");
check("1 000 000", formatujCenu(1000000) === "1 000 000");
check("499.00 z DB se zaokrouhlí", formatujCenu(499.0) === "499");

console.log("\n== plné načtení (dnešní ceník) ==");
{
  const c = sestavCeny(ok(CONFIG), ok(CENIK));
  check("žádná chyba", c.chyby.length === 0, c.chyby.join("; "));
  check("Basic měsíc 249", c.hodnoty.cena_basic_mesic === "249");
  check("Basic rok 2 490", c.hodnoty.cena_basic_rok === "2 490");
  check("VIP měsíc 499 (tier ai_basic)", c.hodnoty.cena_vip_mesic === "499");
  check("VIP rok 4 990", c.hodnoty.cena_vip_rok === "4 990");
  check("Academy 8 900", c.hodnoty.cena_academy === "8 900");
  check("Academy měsíc 990", c.hodnoty.cena_academy_mesic === "990");
  check("upgrade 7 410", c.hodnoty.cena_academy_upgrade === "7 410");
  check("po odečtu 5 930", c.hodnoty.cena_academy_po_odectu === "5 930");
  check("3 měsíce = 2 970 (odvozeno)", c.hodnoty.cena_academy_3_mesice === "2 970");
  check("konzultace 2 990", c.hodnoty.cena_konzultace === "2 990");
  check("konzultace sleva 2 190", c.hodnoty.cena_konzultace_sleva === "2 190");
  check("balíček 349", c.hodnoty.cena_balicek === "349");
  check("doplatek 1 140", c.hodnoty.cena_doplatek_videokurz === "1 140");
  check("course_price = videokurz 1 490", c.hodnoty.course_price === "1 490" && c.hodnoty.cena_videokurz === "1 490");
  check("každá cenová proměnná kromě slev je naplněná",
    CENOVE_PROMENNE.filter((k) => !k.startsWith("discount")).every((k) => k in c.hodnoty),
    CENOVE_PROMENNE.filter((k) => !k.startsWith("discount") && !(k in c.hodnoty)).join(","));
  const s = slevyVideokurzu(c, { discount_price: 15, discount2_price: 20 });
  check("sleva 15 % z 1 490 = 1 267", s.discount_price === "1 267", s.discount_price);
  check("sleva 20 % z 1 490 = 1 192", s.discount2_price === "1 192", s.discount2_price);
}

console.log("\n== JINÁ konfigurace => JINÉ číslo (žádná konstanta natvrdo) ==");
{
  const cfg = CONFIG.map((r) => r.key === "cena_academy" ? { ...r, value: "9900" } : r.key === "cena_videokurz" ? { ...r, value: "1690" } : r);
  const cen = CENIK.map((r) => r.tier === "basic" && r.interval === "month" ? { ...r, price_czk: 299 } : r);
  const c = sestavCeny(ok(cfg), ok(cen));
  check("Academy 9 900", c.hodnoty.cena_academy === "9 900");
  check("course_price jde s app_config (1 690)", c.hodnoty.course_price === "1 690");
  check("Basic jde s pricing_plans (299)", c.hodnoty.cena_basic_mesic === "299");
  check("sleva se přepočítá (1 690 -> 1 437)", slevyVideokurzu(c, { d: 15 }).d === "1 437");
}

console.log("\n== CHYBA ČTENÍ NENÍ CENA ==");
{
  const c = sestavCeny(chyba("504 brana"), ok(CENIK));
  check("app_config nepřečten => Academy ceny CHYBÍ", !("cena_academy" in c.hodnoty) && !("course_price" in c.hodnoty));
  check("…ceny appky ale jsou", c.hodnoty.cena_basic_mesic === "249");
  check("…a chyba je pojmenovaná", c.chyby.some((x) => x.includes("app_config") && x.includes("504")));
  check("bez ceny kurzu žádná sleva", Object.keys(slevyVideokurzu(c, { discount_price: 15 })).length === 0);
}
{
  const c = sestavCeny(ok(CONFIG), chyba("HTTP 401"));
  check("pricing_plans nepřečten => ceny appky CHYBÍ", !("cena_basic_mesic" in c.hodnoty) && !("cena_vip_rok" in c.hodnoty));
  check("…Academy ceny jsou", c.hodnoty.cena_academy === "8 900");
}
{
  const c = sestavCeny({ data: null, error: null }, ok(CENIK));
  check("prázdná odpověď bez chyby se NEbere jako ceník", c.chyby.length > 0 && !("cena_academy" in c.hodnoty));
}
{
  const c = sestavCeny(ok(CONFIG.filter((r) => r.key !== "cena_balicek")), ok(CENIK));
  check("chybějící klíč chybí jen on", !("cena_balicek" in c.hodnoty) && c.hodnoty.cena_academy === "8 900");
  check("chybějící klíč je v chybách", c.chyby.some((x) => x.includes("cena_balicek")));
}
for (const spatne of ["0", "", "abc", "-990", "NaN"]) {
  const c = sestavCeny(ok(CONFIG.map((r) => r.key === "cena_academy_mesic" ? { ...r, value: spatne } : r)), ok(CENIK));
  check("neplatná cena '" + spatne + "' => chybí (i odvozená 3 měsíce)",
    !("cena_academy_mesic" in c.hodnoty) && !("cena_academy_3_mesice" in c.hodnoty));
}
{
  const c = sestavCeny(ok(CONFIG), ok([...CENIK, { tier: "ai_basic", interval: "month", price_czk: 399, segment: null }]));
  check("dva obecné řádky VIP/měsíc => nehádá, chybí", !("cena_vip_mesic" in c.hodnoty) && c.hodnoty.cena_basic_mesic === "249");
}
{
  const c = sestavCeny(ok(CONFIG), ok([...CENIK, { tier: "basic", interval: "month", price_czk: 199, segment: "trener" }]));
  check("segmentová nabídka ceník NEpřepíše", c.hodnoty.cena_basic_mesic === "249");
}
check("seznam klíčů app_config je úplný (9)", Z_APP_CONFIG.length === 9);

console.log("\n== proměnné v šabloně ==");
{
  const tpl = {
    subject: "Basic za {{cena_basic_mesic}} Kč",
    preheader: "Ahoj{{fn_space}}",
    blocks: [{ t: "p", html: "VIP {{cena_vip_mesic}} Kč, kurz {{course_price}} Kč, {{preklep_ceny}}" }],
  };
  const vse = promenneVSablone(tpl).sort().join(",");
  check("najde všechny proměnné", vse === "cena_basic_mesic,cena_vip_mesic,course_price,fn_space,preklep_ceny", vse);
  const c = sestavCeny(ok(CONFIG), chyba("HTTP 500"));
  const vars = { fn_space: " Jano", ...c.hodnoty };
  const chybiCeny = chybejiciCeny(tpl, vars).sort().join(",");
  check("chybějící CENY: jen ceny appky", chybiCeny === "cena_basic_mesic,cena_vip_mesic", chybiCeny);
  const chybiVse = chybejiciPromenne(tpl, vars).sort().join(",");
  check("chybějící VŠE: ceny appky i překlep", chybiVse === "cena_basic_mesic,cena_vip_mesic,preklep_ceny", chybiVse);
  const plne = { fn_space: "", ...sestavCeny(ok(CONFIG), ok(CENIK)).hodnoty };
  check("plné ceny => cenové nic nechybí", chybejiciCeny(tpl, plne).length === 0);
  check("…ale překlep chybí pořád", chybejiciPromenne(tpl, plne).join(",") === "preklep_ceny");
}

console.log("\n== nactiCeny se sítí nahrazenou ==");
{
  const falesnyAdmin = {
    from: (_t: string) => ({ select: (_c: string) => ({ in: (_k: string, _v: string[]) => Promise.resolve(ok(CONFIG)) }) }),
  };
  const fetchPada: typeof fetch = () => Promise.reject(new Error("timeout"));
  const c = await nactiCeny(falesnyAdmin, fetchPada);
  check("pád sítě => ceny appky chybí, Academy jsou", !("cena_vip_mesic" in c.hodnoty) && c.hodnoty.cena_academy === "8 900");
  const fetch401: typeof fetch = () => Promise.resolve(new Response("{}", { status: 401 }));
  const c2 = await nactiCeny(falesnyAdmin, fetch401);
  check("HTTP 401 => ceny appky chybí", !("cena_basic_rok" in c2.hodnoty) && c2.chyby.some((x) => x.includes("401")));
  const fetchOk: typeof fetch = () => Promise.resolve(new Response(JSON.stringify(CENIK), { status: 200 }));
  const c3 = await nactiCeny(falesnyAdmin, fetchOk);
  check("vše ok => bez chyb", c3.chyby.length === 0 && c3.hodnoty.cena_vip_rok === "4 990");
}

console.log("\n== tvar rendererů (kontrola PŘED odesláním) ==");
{
  const ROOT = new URL("..", import.meta.url);
  const cti = (p: string) => Deno.readTextFile(new URL(p, ROOT));
  const drip = await cti("drip-send/index.ts");
  const adm = await cti("admin-api/index.ts");
  const mil = await cti("milestones/index.ts");
  const res = await cti("order-rescue/index.ts");
  const predTim = (n: string, t: string, a: string, b: string) => {
    const ia = t.indexOf(a), ib = t.indexOf(b);
    check(n, ia >= 0 && ib >= 0 && ia < ib, "a@" + ia + " b@" + ib);
  };
  for (const [jm, t] of [["drip-send", drip], ["admin-api", adm]] as const) {
    check(jm + ": žádná COURSE_PRICE natvrdo", !/const COURSE_PRICE\s*=/.test(t));
    check(jm + ": course_price se nesestavuje z konstanty", !t.includes("course_price: String("));
  }
  predTim("drip-send: odklad cen PŘED renderem v živé smyčce", drip,
    "{ const chybi = chybejiciCeny(tpl, CISLA); if (chybi.length) { odlozenoCeny++;", "const m = renderEmail(tpl, seg, v, footer); const htmlSeStopou");
  check("drip-send: odklad cen NENÍ `error` (jistič) a nemění next_send_at",
    /odlozenoCenyKde\.add\(l\.track \+ '\/' \+ krokSend\); continue; \} \}/.test(drip));
  check("drip-send: test režim bez cen vrací 503", drip.includes("mode: 'test', error: 'ceny_nenacteny'"));
  check("drip-send: oneoff bez cen vrací 503", drip.includes("mode: 'oneoff', error: 'ceny_nenacteny'"));
  check("drip-send: alert na neznámou proměnnou", drip.includes("'drip-send:nezname'"));
  predTim("milestones: kontrola proměnných PŘED odesláním", mil, "const chybi = chybejiciPromenne(tpl, v);", "const providerId = await send(email");
  predTim("order-rescue: kontrola proměnných PŘED razítkem", res, "const chybi = chybejiciPromenne(tpl, v);", "const { error: razErr } = await admin.from(\"pending_orders\")");
  check("admin-api: uložení šablony bez cen = 503, ne render_failed", adm.includes('return json({ error: "ceny_nenacteny", chybi: chybiS'));
}

console.log(selhalo === 0 ? "\nVSE ZELENE\n" : "\n" + selhalo + " SELHANI\n");
if (selhalo > 0) Deno.exit(1);
