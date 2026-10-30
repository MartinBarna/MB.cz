// Každá cesta, která dřív po posliMail nezapsala provider_id, ho teď zapíše.
// Staticky: handler nejde importovat (Deno.serve při načtení).
// Spuštění:
//   npx --yes deno@2 run --allow-read akademie/_supabase/functions/_shared/stopa-cesty.test.ts

const KOREN = new URL("../", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const cti = (p: string) => Deno.readTextFileSync(`${KOREN}/${p}`).split("\r").join("");

let chyb = 0;
const check = (j: string, ok: boolean, d = "") => {
  if (ok) console.log("  ok   " + j);
  else { chyb++; console.log("  PADA " + j + (d ? "  -> " + d : "")); }
};

const CESTY: Array<[string, string]> = [
  ["simpleshop-webhook/index.ts", 'via: "simpleshop-webhook"'],
  ["withdrawal/index.ts", 'via: "withdrawal.potvrzeni"'],
  ["withdrawal/index.ts", 'via: "withdrawal.alert"'],
  ["grant-videokurz-z-appky/index.ts", 'via: "grant-videokurz-z-appky.alert"'],
  ["intake-capture/index.ts", 'via: "intake-capture"'],
  ["link-check/index.ts", 'via: "link-check"'],
  ["daily-digest/index.ts", 'via: "daily-digest"'],
  ["en-lead/index.ts", 'via: "en-lead"'],
  ["en-mailing/index.ts", 'via: "en-mailing"'],
  ["affiliate-mesicni-report/index.ts", 'via: "affiliate-mesicni-report"'],
  ["ai-flags-notify/index.ts", 'via: "ai-flags-notify"'],
  ["ai-martin/cap-notify.ts", "via: 'ai-martin.cap-notify'"],
  ["app-purchase-bridge/index.ts", 'via: "app-purchase-bridge"'],
  ["checkin-capture/index.ts", 'via: "checkin-capture.remind"'],
  ["contact-send/index.ts", 'via: "contact-send"'],
  ["academy-stripe-webhook/index.ts", 'via: "academy-stripe-webhook.alert"'],
  ["_shared/koucink-onboarding.ts", 'via: "koucink-onboarding"'],
  ["splatky-guard/index.ts", 'via: "splatky-guard.alert"'],
  ["resend-webhook/index.ts", 'via: "resend-webhook.alert"'],
  ["ses-events/core.ts", 'via: "ses-events.alert"'],
  ["konzultace-pripominka/index.ts", 'via: "konzultace-pripominka.souhrn"'],
  ["koucink-konec/index.ts", 'via: "koucink-konec.alert"'],
  ["order-rescue/index.ts", 'via: "order-rescue.alert"'],
  ["client-remind/index.ts", 'via: "client-remind.alert"'],
  ["_shared/ceny.ts", 'via: "alert-ceny"'],
];

for (const [soubor, znacka] of CESTY) {
  const text = cti(soubor);
  const maZapis = text.includes("zapisOdeslani") || text.includes("odesliPresResend");
  check(soubor + " má stopu " + znacka, text.includes(znacka) && maZapis, text ? "" : "soubor nenacten");
}

const helper = cti("_shared/resend-odeslat.ts");
check("zapisOdeslani výjimku chytá a vrací false", helper.includes("zapis stopy shodil vyjimku"));

const ses = cti("ses-events/core.ts");
const rw = cti("resend-webhook/index.ts");
check("ses-events záloha podle příjemce", ses.includes("najdiPodlePrijemce") && ses.includes('? "prijemce"'));
check("okno zálohy je 14 dní", ses.includes("export const OKNO_PRIJEMCE_MS = 14 * 24 * 60 * 60 * 1000"));
for (const typ of ["oneoff", "affiliate_report", "affiliate_report-test"]) {
  check("ses-events i resend-webhook mají typ " + typ, ses.includes('"' + typ + '"') && rw.includes('"' + typ + '"'));
}

const drip = cti("drip-send/index.ts");
check("drip oneoff dál píše provider_id", drip.includes("type: 'oneoff', provider_id: id"));

const checkin = cti("checkin-capture/index.ts");
check("checkin remind zapíše stopu až po odeslání", checkin.indexOf("await zapisOdeslani") > checkin.indexOf("await sendResend"));

const onb = cti("_shared/koucink-onboarding.ts");
check("uvítání koučinku zapíše stopu až po posliMail", onb.indexOf("await zapisOdeslani") > onb.indexOf("await posliMail"));

console.log(chyb === 0 ? "\nVSE ZELENE\n" : `\n${chyb} SELHANI\n`);
if (chyb > 0) Deno.exit(1);
