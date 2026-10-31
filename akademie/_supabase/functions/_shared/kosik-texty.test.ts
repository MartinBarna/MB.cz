import { renderKosikMail, vsechnyMaily } from "./kosik-texty.ts";

const KOREN = new URL("../../../../", import.meta.url).pathname;
const ZDROJ = KOREN + "akademie/_email/kosik-final-v2.md";
const JSON_CESTA = new URL("./kosik-texty.json", import.meta.url).pathname;

const POVOLENE = new Set(["fn_space", "RECOVERY_URL", "ODKAZ_ODHLASENI"]);
const KLICE = [
  "kosik-konzultace:0",
  "kosik-konzultace:1",
  "kosik-koucink:0",
  "kosik-koucink:1",
  "kosik-videokurz:0",
  "kosik-videokurz:1",
  "kosik-academy:0",
  "kosik-academy:1",
  "kosik-appka:0",
  "kosik-appka:1",
];

Deno.test("texty jsou 1:1 se zdrojem, 10 mailu, bez utm a dlouhe pomlcky", async () => {
  const md = await Deno.readTextFile(ZDROJ);
  const maily = vsechnyMaily();
  if (maily.length !== 10) throw new Error("mailu " + maily.length);
  const klice = maily.map((m) => m.klic + ":" + m.krok);
  if (klice.join("|") !== KLICE.join("|")) throw new Error(klice.join("|"));

  const json = JSON.parse(await Deno.readTextFile(JSON_CESTA));
  const kontrolaRetezce = (s: string, kde: string) => {
    if (s.includes("utm_")) throw new Error("utm v " + kde);
    if (s.includes("\u2014")) throw new Error("dlouha pomlcka v " + kde);
    for (const m of s.matchAll(/\{\{([^{}]+)\}\}/g)) {
      if (!POVOLENE.has(m[1])) throw new Error("promenna " + m[1] + " v " + kde);
    }
  };
  const musiBytVeZdroji = (s: string, kde: string) => {
    if (!md.includes(s)) throw new Error("neni podretezec " + kde + ": " + s.slice(0, 80));
  };

  for (const r of json.paticka_web as string[]) {
    musiBytVeZdroji(r, "paticka");
    kontrolaRetezce(r, "paticka");
  }
  const app = (json.paticka_app as string[]).join("\n");
  const web = (json.paticka_web as string[]).join("\n");
  if (app !== web.replace("na martinbarna.cz", "v appce Tvůj Coach")) {
    throw new Error("paticka appky nevznikla jednou nahradou");
  }
  if (JSON.stringify(json).includes("Poznámka k K1")) throw new Error("poznamka k K1 nesmi byt v JSON");

  for (const mail of maily) {
    musiBytVeZdroji(mail.predmet, mail.oznaceni + " predmet");
    musiBytVeZdroji(mail.preheader, mail.oznaceni + " preheader");
    kontrolaRetezce(mail.predmet, mail.oznaceni);
    kontrolaRetezce(mail.preheader, mail.oznaceni);
    for (const blok of mail.bloky) {
      if (blok.t === "p") {
        musiBytVeZdroji(blok.text, mail.oznaceni);
        kontrolaRetezce(blok.text, mail.oznaceni);
      } else if (blok.t === "btn") {
        musiBytVeZdroji("[" + blok.text + "] → " + blok.href, mail.oznaceni + " btn");
        kontrolaRetezce(blok.href, mail.oznaceni);
      } else {
        for (const r of blok.radky) musiBytVeZdroji(r, "podpis");
      }
    }
    for (const r of mail.paticka) kontrolaRetezce(r, "paticka " + mail.oznaceni);
  }
});

Deno.test("generator da stejny JSON", async () => {
  const cmd = new Deno.Command("node", {
    args: ["scripts/kosik-texty-z-md.mjs", "--stdout"],
    cwd: KOREN,
    stdout: "piped",
    stderr: "piped",
  });
  const out = await cmd.output();
  if (!out.success) throw new Error(new TextDecoder().decode(out.stderr));
  const cerstvy = new TextDecoder().decode(out.stdout);
  const ulozeny = await Deno.readTextFile(JSON_CESTA);
  if (cerstvy !== ulozeny) throw new Error("pregeneruj: node scripts/kosik-texty-z-md.mjs");
});

Deno.test("K1 garance je cela pryc, kdyz je flag vypnuty", () => {
  const vars = {
    fn_space: "",
    RECOVERY_URL: "https://checkout.stripe.com/c/pay/cs_test_recovery",
    ODKAZ_ODHLASENI: "https://martinbarna.cz/odhlasit/?token=abc",
  };
  const vyp = renderKosikMail("kosik-konzultace", 0, vars, { kosik_garance_k1: false });
  const zap = renderKosikMail("kosik-konzultace", 0, vars, { kosik_garance_k1: true });
  if (!vyp || !zap) throw new Error("render");
  if (vyp.chybi.length || zap.chybi.length) throw new Error("chybi " + vyp.chybi.join(","));
  if (vyp.html.includes("{{") || vyp.subject.includes("{{")) throw new Error("nevyplnena promenna");
  const veta = "vrátím ti celou částku";
  if (vyp.html.includes(veta) || vyp.text.includes(veta)) throw new Error("garance prosla pri flagu off");
  if (!zap.html.includes("Když z hovoru neodejdeš se spočítanými kaloriemi, bílkovinami a prvními kroky na týden, vrátím ti celou částku.")) {
    throw new Error("garance chybi pri flagu on");
  }
});

Deno.test("A2 nema fotku, ctecku ani tarif", () => {
  const a2 = vsechnyMaily().find((m) => m.oznaceni === "A2");
  if (!a2) throw new Error("A2");
  const text = [a2.predmet, a2.preheader, ...a2.bloky.map((b) => JSON.stringify(b)), ...a2.paticka].join("\n");
  const nizko = text.toLowerCase();
  for (const kus of ["fot", "čteč", "čárov", "sken", "vip", "basic"]) {
    if (nizko.includes(kus)) throw new Error("A2 obsahuje " + kus);
  }
  const vars = {
    fn_space: "",
    RECOVERY_URL: "https://checkout.stripe.com/c/pay/cs_test_a2",
    ODKAZ_ODHLASENI: "https://martinbarna.cz/odhlasit/?token=abc",
  };
  const r = renderKosikMail("kosik-appka", 1, vars, { kosik_garance_k1: false });
  if (!r || r.chybi.length || r.html.includes("{{")) throw new Error("render A2");
});
