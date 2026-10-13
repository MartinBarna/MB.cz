// Testy čistých funkcí en-mailing. Spuštění (z této složky):
//   deno test --no-lock logic_test.ts
import { assert, assertEquals, assertFalse, assertThrows } from "jsr:@std/assert@1";
import {
  cleanCalc,
  deriveUnsubKey,
  fill,
  type Lead,
  type LogRow,
  MAX_PER_RUN,
  MAX_START_AGE_DAYS,
  nextStep,
  planRun,
  renderEmail,
  STEPS,
  TEST_EMAIL,
  unsubPageUrl,
  unsubToken,
  verifyUnsubToken,
} from "./logic.ts";
import * as unsubCopy from "../en-unsubscribe/token.ts";

const DAY = 86_400_000;
const HOUR = 3_600_000;
const NOW = new Date("2026-10-20T12:00:00Z");
const ago = (ms: number) => new Date(NOW.getTime() - ms).toISOString();

let n = 0;
function lead(p: Partial<Lead> = {}): Lead {
  n++;
  return {
    id: `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`,
    created_at: ago(0),
    kind: "kit",
    first_name: "Anna",
    email: `anna${n}@example.com`,
    consent: true,
    calc: { kcal: 2150, protein_g: 160 },
    ...p,
  };
}
const log = (email: string, step: number, sentAgoMs: number, status = "sent"): LogRow =>
  ({ lead_email: email, step, sent_at: ago(sentAgoMs), status });
const live = (leads: Lead[], logRows: LogRow[] = [], unsub: string[] = []) =>
  planRun({ leads, log: logRows, unsubscribed: unsub, now: NOW, enabled: true, dryRun: false });

// --- výběr kroku podle dnů ---------------------------------------------------
Deno.test("krok 1 hned po přihlášení", () => {
  assertEquals(nextStep(ago(5 * 60_000), [], NOW), { step: 1 });
});

Deno.test("rozvrh dnů 0/2/4/6/8: před termínem not_yet, po něm další krok", () => {
  const days = [0, 2, 4, 6, 8];
  for (let s = 2; s <= STEPS; s++) {
    const prev: LogRow[] = [];
    for (let k = 1; k < s; k++) prev.push(log("a@x.cz", k, 2 * DAY)); // předchozí mail před 2 dny
    const pred = nextStep(ago(days[s - 1] * DAY - HOUR), prev, NOW);
    assertEquals(pred, { step: null, reason: "not_yet" }, `krok ${s} hodinu před termínem`);
    const po = nextStep(ago(days[s - 1] * DAY + HOUR), prev, NOW);
    assertEquals(po, { step: s }, `krok ${s} hodinu po termínu`);
  }
});

Deno.test("po kroku 5 už nic", () => {
  const rows = [1, 2, 3, 4, 5].map((s) => log("a@x.cz", s, 10 * DAY));
  assertEquals(nextStep(ago(30 * DAY), rows, NOW), { step: null, reason: "done" });
});

Deno.test("dohánění po pauze: nejvýš jeden mail za 20 h", () => {
  // start před 12 dny, krok 1 odešel před 3 h: krok 2 je podle dnů dávno na řadě, ale čeká na mezeru
  assertEquals(nextStep(ago(12 * DAY), [log("a@x.cz", 1, 3 * HOUR)], NOW), { step: null, reason: "gap" });
  assertEquals(nextStep(ago(12 * DAY), [log("a@x.cz", 1, 21 * HOUR)], NOW), { step: 2 });
});

Deno.test("starý lead sérii nezačne (MAX_START_AGE_DAYS)", () => {
  assertEquals(nextStep(ago((MAX_START_AGE_DAYS + 1) * DAY), [], NOW), { step: null, reason: "too_old" });
  // rozjetá série se ale dokončí
  assertEquals(nextStep(ago(40 * DAY), [log("a@x.cz", 1, 2 * DAY)], NOW), { step: 2 });
});

Deno.test("neplatné datum = nic", () => {
  assertEquals(nextStep("nesmysl", [], NOW), { step: null, reason: "bad_date" });
});

// --- žádný krok 2x ------------------------------------------------------------
Deno.test("žádný krok 2x: i failed a sending spotřebují krok, další je max+1", () => {
  assertEquals(nextStep(ago(3 * DAY), [log("a@x.cz", 1, 2 * DAY, "failed")], NOW), { step: 2 });
  assertEquals(nextStep(ago(3 * DAY), [log("a@x.cz", 1, 2 * DAY, "sending")], NOW), { step: 2 });
  // díra v logu (ruční zásah): nikdy se nejde zpátky na krok 2
  const d = nextStep(ago(9 * DAY), [log("a@x.cz", 1, 5 * DAY), log("a@x.cz", 3, 2 * DAY)], NOW);
  assertEquals(d, { step: 4 });
});

Deno.test("žádný krok 2x: dva leady téhož e-mailu = jedna série, start = nejstarší", () => {
  const old = lead({ email: "Same@Example.com", kind: "calculator", created_at: ago(3 * DAY) });
  const newer = lead({ email: "same@example.com", kind: "kit", created_at: ago(HOUR) });
  const p = live([newer, old], [log("same@example.com", 1, 3 * DAY)]);
  assertEquals(p.items.length, 1);
  assertEquals(p.items[0].email, "same@example.com");
  assertEquals(p.items[0].lead_id, old.id);
  assertEquals(p.items[0].step, 2);
});

Deno.test("žádný krok 2x: simulace 30 dní hodinového cronu = přesně 5 mailů, každý krok jednou", () => {
  const l = lead({ created_at: "2026-10-01T08:30:00Z" });
  const rows: LogRow[] = [];
  const sentDays: number[] = [];
  for (let h = 0; h < 30 * 24; h++) {
    const now = new Date(Date.parse("2026-10-01T09:15:00Z") + h * HOUR);
    const p = planRun({ leads: [l], log: rows, unsubscribed: [], now, enabled: true, dryRun: false });
    for (const it of p.items) {
      rows.push({ lead_email: it.email, step: it.step, sent_at: now.toISOString(), status: "sent" });
      sentDays.push(Math.floor((now.getTime() - Date.parse(l.created_at)) / DAY));
    }
  }
  assertEquals(rows.map((r) => r.step), [1, 2, 3, 4, 5]);
  assertEquals(sentDays, [0, 2, 4, 6, 8]);
});

// --- odhlášený, application, souhlas, test ------------------------------------
Deno.test("odhlášený nic (i s jinou velikostí písmen)", () => {
  const l = lead({ email: "bob@example.com" });
  const p = live([l], [], ["BOB@example.com"]);
  assertEquals(p.items.length, 0);
  assertEquals(p.skipped.unsubscribed, 1);
});

Deno.test("application nic: sama sérii nespustí", () => {
  const p = live([lead({ kind: "application", calc: null })]);
  assertEquals(p.items.length, 0);
  assertEquals(p.skipped.no_series_lead, 1);
});

Deno.test("application k e-mailu s kitem: série se zastaví (SKIP_IF_APPLIED)", () => {
  const a = lead({ email: "c@example.com", created_at: ago(3 * DAY) });
  const b = lead({ email: "c@example.com", kind: "application", created_at: ago(DAY) });
  const p = live([a, b], [log("c@example.com", 1, 3 * DAY)]);
  assertEquals(p.items.length, 0);
  assertEquals(p.skipped.applied, 1);
});

Deno.test("bez souhlasu nic", () => {
  const p = live([lead({ consent: false })]);
  assertEquals(p.items.length, 0);
  assertEquals(p.skipped.no_consent, 1);
});

Deno.test("kit, calculator, workout spouští sérii", () => {
  const p = live([lead({ kind: "kit" }), lead({ kind: "calculator" }), lead({ kind: "workout", calc: null })]);
  assertEquals(p.items.map((i) => i.kind).sort(), ["calculator", "kit", "workout"]);
});

Deno.test("testovací řádky: v ostrém běhu nic, v náhledu ano", () => {
  const leads = [lead({ first_name: "TEST-CLAUDE" }), lead({ email: TEST_EMAIL }), lead({ first_name: "test-claude " })];
  const l = live(leads);
  assertEquals(l.items.length, 0);
  assertEquals(l.skipped.test_live, 3);
  const d = planRun({ leads, log: [], unsubscribed: [], now: NOW, enabled: false, dryRun: false });
  assertEquals(d.items.length, 3);
  assert(d.items.every((i) => i.test));
});

// --- vypínač ------------------------------------------------------------------
Deno.test("enabled=false nic: mode dry i bez dry_run a i s dry_run=false", () => {
  const p = planRun({ leads: [lead()], log: [], unsubscribed: [], now: NOW, enabled: false, dryRun: false });
  assertEquals(p.mode, "dry");
  assertEquals(p.items.length, 1); // náhled ukáže, kdo by dostal co
});

Deno.test("enabled=true + dry_run=true = jen náhled; jen enabled===true je live", () => {
  assertEquals(planRun({ leads: [], log: [], unsubscribed: [], now: NOW, enabled: true, dryRun: true }).mode, "dry");
  // deno-lint-ignore no-explicit-any
  assertEquals(planRun({ leads: [], log: [], unsubscribed: [], now: NOW, enabled: "true" as any, dryRun: false }).mode, "dry");
  assertEquals(planRun({ leads: [], log: [], unsubscribed: [], now: NOW, enabled: true, dryRun: false }).mode, "live");
});

Deno.test("strop 50 mailů za běh, nejstarší start první", () => {
  const leads = Array.from({ length: 60 }, (_, i) => lead({ created_at: ago((60 - i) * 60_000) }));
  const p = live(leads);
  assertEquals(p.items.length, MAX_PER_RUN);
  assertEquals(p.capped, 10);
  assertEquals(p.items[0].lead_id, leads[0].id);
});

// --- texty ----------------------------------------------------------------------
Deno.test("mail 1 s čísly i bez nich, všech 5 kroků bez {{ }} a bez dlouhé pomlčky", () => {
  const url = "https://martinbarna.cz/en/unsubscribe/?e=a%40b.cz&t=x";
  for (let s = 1; s <= STEPS; s++) {
    for (const calc of [{ kcal: 2150, protein_g: 160 }, null]) {
      const m = renderEmail(s, { firstName: "Anna", calc, unsubscribeUrl: url });
      for (const part of [m.subject, m.preheader, m.text, m.html]) {
        assertFalse(part.includes("{{"), `krok ${s}: zbyl placeholder`);
        assertFalse(part.includes(String.fromCharCode(0x2014)), `krok ${s}: dlouhá pomlčka`);
        assertFalse(part.includes(String.fromCharCode(0x2013)), `krok ${s}: střední pomlčka`);
      }
      assert(m.text.startsWith("Hi Anna,"));
      assert(m.text.includes("Unsubscribe: " + url), `krok ${s}: odhlášení v textu`);
      assert(m.html.includes(`href="${url.replace(/&/g, "&amp;")}"`), `krok ${s}: odhlášení v HTML`);
      assert(m.text.includes("Lumírova 489/11"), `krok ${s}: adresa`);
    }
  }
  const s1 = renderEmail(1, { firstName: "Anna", calc: { kcal: 2150, protein_g: 160 }, unsubscribeUrl: url });
  assert(s1.text.includes("2,150 kcal a day") && s1.text.includes("160 g of protein a day"));
  const s1b = renderEmail(1, { firstName: "Anna", calc: null, unsubscribeUrl: url });
  assertFalse(/\d kcal a day/.test(s1b.text));
  assert(s1b.text.includes("#calculator"));
  // cena v mailu 5 není (price_block prázdný) a nezůstala po něm trojitá mezera
  const s5 = renderEmail(5, { firstName: "Anna", calc: null, unsubscribeUrl: url });
  assertFalse(s5.text.includes("\n\n\n"));
  assertFalse(/\$|USD|€/.test(s5.text));
});

Deno.test("jméno: HTML escapované, prázdné = there", () => {
  const m = renderEmail(2, { firstName: "<b>Eve</b>", calc: null, unsubscribeUrl: "https://x.test/u" });
  assert(m.html.includes("Hi &lt;b&gt;Eve&lt;/b&gt;,"));
  assert(renderEmail(2, { firstName: "  ", calc: null, unsubscribeUrl: "https://x.test/u" }).text.startsWith("Hi there,"));
});

Deno.test("fill: neznámý placeholder = výjimka (mail s {{...}} neodejde)", () => {
  assertThrows(() => fill("Hi {{nope}}", {}));
  assertThrows(() => renderEmail(1, { firstName: "A", calc: null, unsubscribeUrl: "" }));
});

Deno.test("cleanCalc: jen rozumná čísla", () => {
  assertEquals(cleanCalc({ kcal: 2150.4, protein_g: 159.6 }), { kcal: 2150, protein_g: 160 });
  assertEquals(cleanCalc({ kcal: 2150 }), null);
  assertEquals(cleanCalc({ kcal: 50, protein_g: 100 }), null);
  assertEquals(cleanCalc(null), null);
});

Deno.test("čísla z nejnovějšího leadu, který je má", () => {
  const a = lead({ email: "d@example.com", kind: "workout", calc: null, created_at: ago(2 * HOUR) });
  const b = lead({ email: "d@example.com", kind: "calculator", calc: { kcal: 1900, protein_g: 140 }, created_at: ago(HOUR) });
  const p = live([a, b]);
  assertEquals(p.items[0].lead_id, a.id);
  assertEquals(p.items[0].calc, { kcal: 1900, protein_g: 140 });
});

// --- token ----------------------------------------------------------------------
Deno.test("token: ověří se, cizí e-mail ani upravený token neprojde, velikost písmen nevadí", async () => {
  const key = await deriveUnsubKey("service-role-key-example-123456");
  const t = await unsubToken("Anna@Example.com", key);
  assert(await verifyUnsubToken("anna@example.com", t, key));
  assertFalse(await verifyUnsubToken("eve@example.com", t, key));
  assertFalse(await verifyUnsubToken("anna@example.com", t.slice(0, -1) + (t.endsWith("A") ? "B" : "A"), key));
  assertFalse(await verifyUnsubToken("anna@example.com", "", key));
  assertFalse(await verifyUnsubToken("anna@example.com", t, await deriveUnsubKey("jiny-klic-0000000000")));
  assert(/^[A-Za-z0-9_-]{43}$/.test(t));
});

Deno.test("token: EN_UNSUB_SECRET má přednost, krátký se ignoruje", async () => {
  assertEquals(await deriveUnsubKey("svc", "override-secret-1234"), "override-secret-1234");
  assertEquals(await deriveUnsubKey("svc", "short"), await deriveUnsubKey("svc"));
  assertEquals(await deriveUnsubKey(""), "");
});

Deno.test("token: en-mailing a en-unsubscribe dávají totéž (kopie se nerozjely)", async () => {
  for (const svc of ["a-service-role-key", "jiny-klic-xyz"]) {
    const k1 = await deriveUnsubKey(svc);
    const k2 = await unsubCopy.deriveUnsubKey(svc);
    assertEquals(k1, k2);
    for (const e of ["anna@example.com", "Bob.Smith+x@Mail.co.uk"]) {
      const t = await unsubToken(e, k1);
      assertEquals(t, await unsubCopy.unsubToken(e, k2));
      assert(await unsubCopy.verifyUnsubToken(e.toLowerCase(), t, k2));
    }
  }
});

Deno.test("odkaz na odhlášení: e-mail i token zakódované", () => {
  const u = unsubPageUrl("a+b@example.com", "tok_-");
  assertEquals(u, "https://martinbarna.cz/en/unsubscribe/?e=a%2Bb%40example.com&t=tok_-");
});
