import { jeTestLead, jeTestovaciEmail, maMetaTest, testLeadMaJenUvitacku, zarazeniDoSerie } from "./test-lead.ts";

function check(nazev: string, podminka: boolean): void {
  if (!podminka) throw new Error(nazev);
}

Deno.test("vzor fitness.barna+tester", () => {
  check("zaklad", jeTestovaciEmail("fitness.barna+tester@gmail.com"));
  check("pripona", jeTestovaciEmail("fitness.barna+tester-makro@gmail.com"));
  check("cisla", jeTestovaciEmail("Fitness.Barna+Tester42@Gmail.com"));
  check("mezery kolem", jeTestovaciEmail("  fitness.barna+tester@gmail.com  "));
  check("jiny plus", !jeTestovaciEmail("fitness.barna+test@gmail.com"));
  check("bez tester", !jeTestovaciEmail("fitness.barna+grokfin1@gmail.com"));
  check("jina schranka", !jeTestovaciEmail("nekdo+tester@gmail.com"));
  check("jina domena", !jeTestovaciEmail("fitness.barna+tester@googlemail.com"));
  check("prazdne", !jeTestovaciEmail(""));
  check("null", !jeTestovaciEmail(null));
});

Deno.test("meta.test", () => {
  check("boolean", maMetaTest({ test: true }));
  check("text", maMetaTest({ test: "true" }));
  check("t", maMetaTest({ test: "t" }));
  check("jednicka", maMetaTest({ test: 1 }));
  check("false", !maMetaTest({ test: false }));
  check("jiny klic", !maMetaTest({ goal: "hubnuti" }));
  check("null", !maMetaTest(null));
  check("pole", !maMetaTest(["test"]));
});

Deno.test("jeTestLead: email nebo meta", () => {
  check("email", jeTestLead({ email: "fitness.barna+tester@gmail.com" }));
  check("meta bez vzoru", jeTestLead({ email: "jana@seznam.cz", meta: { test: true } }));
  check("obycejny", !jeTestLead({ email: "jana@seznam.cz", meta: { goal: "x" } }));
  check("prazdny radek", !jeTestLead(null));
});

Deno.test("zarazeni do serie", () => {
  const t = zarazeniDoSerie("fitness.barna+tester-1@gmail.com", 0, 1_700_000_000_000);
  check("paused", t.status === "paused");
  check("bez terminu", t.next_send_at === null);
  check("test", t.test === true);

  const n = zarazeniDoSerie("jana@seznam.cz", 24 * 3600000, 1_700_000_000_000);
  check("bez statusu", n.status === undefined);
  check("termin", n.next_send_at === new Date(1_700_000_000_000 + 24 * 3600000).toISOString());
  check("neni test", n.test === false);
});

Deno.test("jen uvitacka, ne cron", () => {
  const email = "fitness.barna+tester@gmail.com";
  check("only_email", testLeadMaJenUvitacku(email, { test: true }, email));
  check("cron", !testLeadMaJenUvitacku(email, { test: true }, ""));
  check("jiny mail", !testLeadMaJenUvitacku(email, { test: true }, "jana@seznam.cz"));
  check("obycejny only_email", !testLeadMaJenUvitacku("jana@seznam.cz", {}, "jana@seznam.cz"));
  check("meta bez shody adresy", !testLeadMaJenUvitacku("jana@seznam.cz", { test: true }, email));
});
