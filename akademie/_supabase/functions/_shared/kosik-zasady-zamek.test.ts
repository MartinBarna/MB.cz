const root = new URL("../../../../", import.meta.url);

async function soubor(cesta: string): Promise<string> {
  return await Deno.readTextFile(new URL(cesta, root));
}

const NADPIS = "4b. Připomínka nedokončené objednávky";
const SES = "Amazon Web Services EMEA SARL";
const ODSTAVCE = [
  "Když na prodejní stránce před platbou zadáte e-mail, použijeme ho k předvyplnění platby ve Stripe. Jde o krok před uzavřením smlouvy na vaši žádost (čl. 6 odst. 1 písm. b) GDPR). Spolu s e-mailem ukládáme vybraný produkt, čas a stránku, ze které jste přišli, a kvůli ochraně před zneužitím zkrácený otisk (hash) vaší IP adresy a typ prohlížeče (oprávněný zájem, čl. 6 odst. 1 písm. f) GDPR).",
  "Pokud objednávku nedokončíte, pošleme vám na zadaný e-mail nejvýš dva e-maily s připomínkou téže objednávky a odkazem na její dokončení. Jiné nabídky v nich nejsou. Děláme to na základě oprávněného zájmu (čl. 6 odst. 1 písm. f) GDPR), o kterém vás informujeme přímo u pole pro e-mail. Připomínky nechcete? Pokračujte k platbě bez e-mailu, nebo se odhlaste jedním klikem v kterémkoli z nich. Proti zpracování můžete kdykoli vznést námitku, po ní vám už nic nepošleme. Ukládáme znění informace, kterou jste viděli, a čas zadání.",
  "Údaje smažeme do 90 dnů od posledního e-mailu (když žádný neodešel, od zadání), nebo hned po odhlášení či námitce. Po odhlášení si ponecháme jen e-mailovou adresu na seznamu odhlášených, abychom vám už nic neposlali. E-maily odesíláme přes poskytovatele uvedené v čl. 3.",
];

Deno.test("4b a cl. 3 jsou na webu prave tehdy, kdyz je kosik zapnuty", async () => {
  const zasady = await soubor("zasady-ochrany-osobnich-udaju/index.html");
  const konzultace = await soubor("konzultace/index.html");
  const koucing = await soubor("koucing/index.html");
  const pravidla = await soubor("akademie/_supabase/functions/_shared/kosik-pravidla.ts");
  const sql = await soubor("akademie/_supabase/kosik-2026-11.sql");
  const pripravene = await soubor("docs/kosik/zasady-4b-a-cl3.md");
  const navrh = await soubor("docs/kosik/ZASADY-4B-NAVRH.md");
  const skript = await soubor("scripts/kosik-zasady-aplikuj.mjs");
  const deploy = await soubor(".github/workflows/deploy-wedos.yml");

  const zapnutoHtml = konzultace.includes('data-kosik-zapnuto="true"')
    || koucing.includes('data-kosik-zapnuto="true"');
  const zapnutoKod = /export const FLAGY_VYCHOZI[\s\S]{0,400}webZapnuto:\s*true/.test(pravidla);
  const zive = zapnutoHtml || zapnutoKod;
  const ma4b = zasady.includes(NADPIS);
  const maSes = zasady.includes(SES);

  if (!zive && (ma4b || maSes)) {
    throw new Error("4b nebo SES jsou na zive strance, kosik je vypnuty");
  }
  if (zive && (!ma4b || !maSes)) {
    throw new Error("zapnuty kosik bez 4b nebo bez SES v zasadech");
  }
  // Od 1. 11. 2026 (Martin: "pokud ok nasad") je kosik na webu zapnuty atributem.
  // Vychozi hodnoty v kodu a v SQL zustavaji vypnute: zapina se jen atributem a flagy v DB.
  for (const html of [konzultace, koucing]) {
    if (!html.includes('data-kosik-zapnuto="false"') && !html.includes('data-kosik-zapnuto="true"')) {
      throw new Error("chybi atribut data-kosik-zapnuto");
    }
  }
  if (!sql.includes("('kosik_web_zapnuto','false')")) throw new Error("sql flag");
  if (!/webZapnuto:\s*false/.test(pravidla)) throw new Error("vychozi web");

  for (const odst of ODSTAVCE) {
    if (!pripravene.includes(odst) || !navrh.includes(odst)) throw new Error("chybi odstavec v pripravenem zneni");
    if (!zive && zasady.includes(odst)) throw new Error("odstavec 4b je na webu");
    if (zive && !zasady.includes(odst)) throw new Error("zapnuty kosik, ale odstavec 4b na webu chybi nebo je jinak");
  }
  if (!pripravene.includes(SES) || !pripravene.includes("eu-central-1")) throw new Error("chybi SES v priprave");
  if (!zasady.includes("<b>Resend</b>")) throw new Error("Resend ma v cl. 3 zustat");
  if (!skript.includes("--az-pri-zapnuti-kosik-web") || !skript.includes("process.exit(2)")) {
    throw new Error("skript nema tvrdou branu");
  }
  if (deploy.includes("kosik-zasady-aplikuj")) throw new Error("deploy nesmi skript volat");
});
