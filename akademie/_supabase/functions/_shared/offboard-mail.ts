// Sestavení rozloučení po ukončení koučinku.
// Potvrzení (client_operational) a prodejní blok (marketing) jsou oddělené,
// ať send-policy umí prodej po hard unsub vynechat a potvrzení nechat.
//
// ⛔⛔ DVĚ VĚTVE FAKTU O APPCE, A JE TO OPRAVA VADY (22. 9. 2026, nález revize).
// Do teď mail VŽDY tvrdil „s koučinkem skončil i tvůj přístup do appky". U člověka
// se zaplacenou Academy to není pravda: server mu appku nebere, jen ji přepne na
// roční Academy grant (`set-expiry`), a toast v adminu Martinovi říkal přesný opak
// toho, co stálo v mailu. Rozhoduje `maAcademy`, tedy táž hodnota, podle které se
// rozhoduje i příkaz do appky. Jeden vstup, dvě pravdivá znění.
//
// ⛔⛔ TŘI RODY, ZE STEJNÉHO DŮVODU. Ruční odchod z admina rod ZNÁ (Martin ho
// překlikne a vidí ho), automat ho NEZNÁ: v `entitlements` ani v `customer_contacts`
// pohlaví není a odhad ze jména je přesně ta vada, kvůli které tenhle přepínač
// vznikl (3. 8. 2026 dostala Jana Kaločayová celý mail v mužském rodě). Kdo rod
// nezná, NEHÁDÁ HO: `rod: "neutral"` je vlastní znění bez jediného příčestí, ne
// mužská větev s jiným štítkem. Kdo sem přidá větu s minulým časem, musí ji přidat
// do všech tří.
//
// ⛔ CENA TU NENÍ A BÝT NESMÍ. Ceny appky jsou natvrdo v šablonách v `email_templates`
// a při změně ceníku se na ně zapomíná. Sleva se popisuje PROCENTEM, částku ukáže až
// pokladna podle kupónu ve Stripu (`tvujcoach-cenik-zmena-checklist`).

export type Rod = "z" | "m" | "neutral";

export type OffboardMailInput = {
  osloveni: string;
  /** „z" žena, „m" muž, „neutral" rod neznáme (automat). */
  rod: Rod;
  includeSales: boolean;
  /**
   * Měl v okamžiku ukončení zaplacenou Academy? TRUE = appka mu ZŮSTÁVÁ (rok od
   * konce koučinku) a nabídka VIP se mu neposílá, protože by mu prodávala něco,
   * co už má.
   */
  maAcademy?: boolean;
  /**
   * Jednorázový promo kód na roční VIP (`VIP-XXXXXX`), platný 14 dní.
   * Prázdný = nabídka se do mailu NEDÁ. ⛔ Mail nesmí slíbit slevu bez kódu:
   * člověk by v pokladně dostal „neplatný kód" a nekoupil nic.
   */
  promoKod?: string;
};

export function offboardSubject(): string {
  return "Díky za spolupráci. Co dál s appkou a s tvými daty";
}

function escd(s: string): string {
  return String(s).replace(/[<>&"]/g, (c) =>
    ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c] as string),
  );
}

/** Odkaz do pokladny appky s předvybraným ročním VIP a s kódem. */
export function vipOdkaz(promoKod: string): string {
  return "https://tvujcoach.cz/koupit?plan=vip-rok&promo=" + encodeURIComponent(promoKod) +
    "&utm_source=mail&utm_medium=offboard&utm_campaign=koucink-konec";
}

/**
 * Smí mail nést prodejní nabídku ročního VIP?
 * ⛔ Tři podmínky, každá zavře jinou díru:
 *   1. `includeSales` = rozhodnutí brány (hard unsub marketing nedostane),
 *   2. `!maAcademy`   = kdo má Academy, appku si nechává a nabídka by mu lhala,
 *   3. `promoKod`     = bez kódu je slib slevy nepravdivý.
 */
export function maNabidnoutVip(input: OffboardMailInput): boolean {
  return input.includeSales === true && input.maAcademy !== true && !!String(input.promoKod ?? "").trim();
}

export function buildOffboardInner(input: OffboardMailInput): string {
  const ahoj = input.osloveni ? "Ahoj " + escd(input.osloveni) + "," : "Ahoj,";
  const p = (t: string) => `<p style='margin:0 0 14px'>${t}</p>`;
  const btn = (href: string, label: string) =>
    `<p style='margin:4px 0 18px'><a href='${href}' style='display:inline-block;background:#EBB12C;color:#1A1222;text-decoration:none;padding:13px 26px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;font-size:15px'>${label}</a></p>`;
  const btn2 = (href: string, label: string) =>
    `<p style='margin:4px 0 18px'><a href='${href}' style='display:inline-block;border:1px solid #EBB12C;color:#EBB12C;text-decoration:none;padding:12px 25px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;font-size:15px'>${label}</a></p>`;
  const neutral = input.rod === "neutral";
  /** Tvar s příčestím. V neutrální větvi se NEPOUŽÍVÁ, věta se píše jinak. */
  const rd = (muzsky: string, zensky: string) => (input.rod === "z" ? zensky : muzsky);
  /** Věta ve dvou podobách: rodová a neutrální. */
  const vt = (rodova: string, neutralni: string) => (neutral ? neutralni : rodova);
  const maAcademy = input.maAcademy === true;

  // Řádek o appce je jediné místo, kde se větve liší ve FAKTU. Zbytek potvrzení
  // je společný, ať se texty nerozjedou každý svým směrem.
  const radekOAppce = maAcademy
    ? `<li style='margin:0 0 7px'>Appku <strong>Tvůj Coach</strong> si necháváš. Máš zaplacenou Barna Academy a ta appku zahrnuje, takže ti běží dál a nemusíš nic dělat.</li>`
    : `<li style='margin:0 0 7px'>S ní skončil i tvůj přístup do appky <strong>Tvůj Coach</strong>, ` +
      vt("protože jsi ji " + rd("měl", "měla") + " v ceně koučinku.", "protože byla v ceně koučinku.") +
      `</li>`;

  const confirm =
    p(ahoj) +
    p(vt(
      "naše spolupráce v koučinku právě končí. Děkuju ti za ni a za práci, kterou jsi do toho " + rd("dal", "dala") + ". Chci, abys " + rd("věděl", "věděla") + ", co se teď děje s tvým přístupem, ať tě nic nepřekvapí.",
      "naše spolupráce v koučinku právě končí. Děkuju ti za ni i za tvoji práci. Tady je, co se teď děje s tvým přístupem, ať tě nic nepřekvapí.",
    )) +
    `<p style='margin:0 0 8px'><strong>Co se změnilo:</strong></p><ul style='margin:0 0 14px;padding-left:20px'>` +
    `<li style='margin:0 0 7px'>Klientská sekce na webu se zavřela.</li>` +
    radekOAppce +
    `<li style='margin:0 0 7px'>Účet ani zapsaná data ti nemažu. ` +
    vt("Zůstávají tam, kdyby ses " + rd("vrátil", "vrátila") + ".", "Zůstávají tam pro případ, že se k tomu vrátíš.") +
    `</li></ul>`;

  // ⛔ NABÍDKA JEN TOMU, KOMU APPKA OPRAVDU SKONČILA. Kdo má Academy, dostane
  //    jen potvrzení a rozloučení: prodávat mu VIP by znamenalo prodávat mu to,
  //    co už zaplatil.
  const kodRaw = String(input.promoKod ?? "").trim();
  const kod = escd(kodRaw);
  const sales = maNabidnoutVip(input)
    ? p(vt(
        "Jestli sis na appku " + rd("zvykl", "zvykla") + ", můžeš v ní pokračovat " + rd("sám", "sama") + " za sebe.",
        "Jestli ti appka sedla, můžeš v ní pokračovat dál.",
      ) + " Mám pro tebe roční <strong>VIP</strong> se <strong>slevou 20 %</strong>, jen pro moje klienty. Kód je <strong>" + kod + "</strong> a platí čtrnáct dní, pak zmizí.") +
      btn(vipOdkaz(kodRaw), "Chci VIP na rok se slevou") +
      p("Z tlačítka se kód do pokladny předvyplní. Kdyby tam nebyl, přepiš ho do kolonky se slevou.") +
      p(vt(
        "A jestli chceš rozumět tomu, co jsme spolu dělali, a umět si to řídit " + rd("sám", "sama") + ", je tu <strong>Barna Academy</strong>.",
        "A jestli chceš rozumět tomu, co jsme spolu dělali, a umět si to řídit po svém, je tu <strong>Barna Academy</strong>.",
      ) + " Celý systém výživy a tréninku vysvětlený od základů. " +
        vt("Jako " + rd("můj klient", "moje klientka") + " na ni máš", "Jako klient koučinku na ni máš") +
        " <strong>slevu 20 % s kódem KLIENT20</strong> a ten ti platí dál.") +
      btn2("https://martinbarna.cz/akademie/?utm_source=mail&utm_medium=offboard&utm_campaign=koucink-konec", "Mrknout na Academy")
    : "";

  const closing =
    p(vt(
      "Kdybys " + rd("chtěl", "chtěla") + " někdy koučink znovu, ozvi se. Vím, kde jsme skončili.",
      "Kdyby přišel čas na koučink znovu, ozvi se. Vím, kde jsme skončili.",
    )) +
    p("<strong>Be Effective!</strong><br>Martin");

  return confirm + sales + closing;
}

export function wrapOffboardHtml(inner: string): string {
  return `<!doctype html><html lang='cs'><head><meta charset='utf-8'><meta name='color-scheme' content='dark'></head><body style='margin:0;padding:0;background:#0C0B10'>` +
    `<table role='presentation' width='100%' cellpadding='0' cellspacing='0' border='0' bgcolor='#0C0B10'><tr><td align='center' style='padding:16px'>` +
    `<table role='presentation' width='560' cellpadding='0' cellspacing='0' border='0' bgcolor='#181520' style='width:100%;max-width:560px;background:#181520;border-radius:2px;border:1px solid #262232'><tr><td style='padding:28px;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;font-size:16px;line-height:1.55;color:#F0EADF'>` +
    `<div style='border-left:3px solid #EBB12C;padding-left:10px;font-weight:800;font-size:13px;letter-spacing:.2em;text-transform:uppercase;color:#EBB12C;margin:0 0 20px'>Martin Barna</div>` +
    inner +
    `<hr style='border:none;border-top:1px solid #262232;margin:22px 0 14px'><div style='font-size:12px;color:#8F8A99'>Martin Barna · martinbarna.cz · osobní mail pro klienty koučinku</div>` +
    `</td></tr></table></td></tr></table></body></html>`;
}

export function buildOffboardMail(input: OffboardMailInput): { subject: string; html: string } {
  return { subject: offboardSubject(), html: wrapOffboardHtml(buildOffboardInner(input)) };
}
