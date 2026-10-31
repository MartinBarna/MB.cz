import { maUplnySouhlas } from "./kosik-pravidla.ts";
import { duvodRetence, type RadekRetence } from "./kosik-retence.ts";

const TED = new Date("2026-04-01T12:00:00.000Z");
const DEN = 24 * 60 * 60 * 1000;

function radek(over: Partial<RadekRetence> = {}): RadekRetence {
  return {
    id: "t1",
    created_at: new Date(TED.getTime() - 10 * DEN).toISOString(),
    souhlas: false,
    zaplaceno_at: null,
    odhlaseno_at: null,
    mail1_odeslan_at: null,
    mail2_odeslan_at: null,
    test: true,
    ...over,
  };
}

function o(dny: number): string {
  return new Date(TED.getTime() - dny * DEN).toISOString();
}

Deno.test("TEST radky: retence 30, 90, odhlaseni a zaplaceni", () => {
  const pripady: [string, RadekRetence, ReturnType<typeof duvodRetence>][] = [
    ["bez souhlasu 31 dni", radek({ created_at: o(31) }), "bez_souhlasu_30"],
    ["bez souhlasu presne 30 dni jeste zustava", radek({ created_at: o(30) }), null],
    ["bez souhlasu 29 dni", radek({ created_at: o(29) }), null],
    ["souhlas, mail pred 91 dny", radek({
      souhlas: true,
      created_at: o(100),
      mail1_odeslan_at: o(91),
    }), "souhlas_90"],
    ["souhlas, mail pred 90 dny jeste zustava", radek({
      souhlas: true,
      created_at: o(100),
      mail1_odeslan_at: o(90),
    }), null],
    ["souhlas, bez mailu, created pred 91 dny", radek({ souhlas: true, created_at: o(91) }), "souhlas_90"],
    ["souhlas, bez mailu, created pred 10 dny", radek({ souhlas: true, created_at: o(10) }), null],
    ["souhlas, mail2 je novejsi nez mail1", radek({
      souhlas: true,
      created_at: o(200),
      mail1_odeslan_at: o(120),
      mail2_odeslan_at: o(10),
    }), null],
    ["odhlaseni hned, i kdyz radek vznikl pred chvili", radek({
      souhlas: true,
      created_at: o(0),
      odhlaseno_at: TED.toISOString(),
      mail1_odeslan_at: o(1),
    }), "odhlaseni"],
    ["zaplaceno pred 31 dny", radek({
      souhlas: true,
      created_at: o(40),
      zaplaceno_at: o(31),
      mail1_odeslan_at: o(5),
    }), "zaplaceno_30"],
    ["zaplaceno pred 10 dny, created pred 40 dny, bez souhlasu", radek({
      created_at: o(40),
      zaplaceno_at: o(10),
    }), null],
    ["zaplaceno presne 30 dni jeste zustava", radek({ zaplaceno_at: o(30), created_at: o(40) }), null],
  ];
  for (const [nazev, r, cekany] of pripady) {
    const duvod = duvodRetence(r, TED);
    if (duvod !== cekany) throw new Error(nazev + ": " + duvod + " != " + cekany);
    const ostry = duvodRetence({ ...r, test: false, id: "ostry" }, TED);
    if (ostry !== duvod) throw new Error(nazev + ": TEST a ostry se rozchazi");
  }
});

Deno.test("radek bez souhlasu neni vstup do mailingu", () => {
  const r = radek({ id: "test-bez-souhlasu" });
  if (maUplnySouhlas({
    souhlas: r.souhlas,
    souhlas_at: null,
    souhlas_text: null,
    souhlas_verze: null,
    stripe_session_id: null,
  })) {
    throw new Error("bez souhlasu nesmi projit branou mailu");
  }
  if (duvodRetence(r, TED) !== null) throw new Error("cerny radek se nema mazat pred 30 dny");
});

Deno.test("SQL retence ma stejna pravidla, zalohu, a cron je vypnuty", async () => {
  const sql = await Deno.readTextFile(new URL("../../kosik-retence-2026-11.sql", import.meta.url));
  const down = await Deno.readTextFile(new URL("../../kosik-retence-2026-11.down.sql", import.meta.url));
  const musi = [
    "odhlaseno_at is not null",
    "interval '30 days'",
    "interval '90 days'",
    "kosik_retence_zapnuto",
    "kosik_checkouty_zaloha_retence",
    "enable row level security",
    "coalesce(zapnuto, 'false') <> 'true'",
  ];
  for (const s of musi) {
    if (!sql.includes(s)) throw new Error("SQL chybi: " + s);
  }
  if ((sql.match(/interval '30 days'/g) ?? []).length < 2) throw new Error("30 dni ma byt u souhlasu i u platby");
  if (/delete\s+from\s+public\.odhlaseni_trvale/i.test(sql)) throw new Error("odhlaseni_trvale se nema mazat");
  if (/test\s*=\s*false/.test(sql) || /not\s+k\.test/.test(sql)) throw new Error("TEST radky se nemaji vynechat");
  if (!sql.includes("mail1_odeslan_at, k.mail2_odeslan_at")) throw new Error("kotva ma byt odeslany mail");
  if (sql.includes("mail1_dry_at") || sql.includes("mail2_dry_at")) throw new Error("suchy beh neni odeslani");
  const cron = sql.split("\n").find((r) => r.includes("cron.schedule"));
  if (!cron || !cron.trim().startsWith("--")) throw new Error("cron musi zustat zakomentovany: " + cron);
  if (!down.includes("cron.unschedule") || !down.includes("jsonb_populate_record")) {
    throw new Error("down skript nema navrat");
  }
  if (!down.includes("kosik_retence_zapnuto")) throw new Error("down musi umet flag vypnout");
});
