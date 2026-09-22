// Spuštění: npx --yes deno@2 run akademie/_supabase/functions/_shared/offboard-mail.test.ts
import {
  buildOffboardInner,
  buildOffboardMail,
  maNabidnoutVip,
  offboardSubject,
  vipOdkaz,
} from "./offboard-mail.ts";

let selhalo = 0;
function check(nazev: string, podminka: boolean, detail = ""): void {
  if (podminka) console.log("  ok   " + nazev);
  else {
    selhalo++;
    console.log("  FAIL " + nazev + (detail ? "  [" + detail + "]" : ""));
  }
}

const KOD = "VIP-A7K3MP";
const MUZ = { osloveni: "Milane", rod: "m" as const, includeSales: true, promoKod: KOD };
const ZENA = { osloveni: "Jano", rod: "z" as const, includeSales: true, promoKod: KOD };

console.log("\n== offboard-mail ==");

check("předmět beze změny",
  offboardSubject() === "Díky za spolupráci. Co dál s appkou a s tvými daty");

const s = buildOffboardInner(MUZ);
check("sales: CTA na roční VIP", s.includes("Chci VIP na rok se slevou"));
check("sales: kód v textu", s.includes(KOD));
check("sales: sleva procentem, ne částkou", s.includes("slevou 20 %"));
check("sales: čtrnáct dní", s.includes("čtrnáct dní"));
check("sales: odkaz nese plan i promo",
  s.includes("plan=vip-rok") && s.includes("promo=" + KOD));
check("sales: kód KLIENT20 na Academy zůstává", s.includes("KLIENT20"));
check("confirm: klientská sekce se zavřela", s.includes("Klientská sekce na webu se zavřela"));
check("closing: koučink znovu", s.includes("koučink znovu"));
check("žádná dlouhá pomlčka", !s.includes("—") && !buildOffboardMail(MUZ).html.includes("—"));

// ⛔ CENA V MAILU NESMÍ BÝT. Hlídá se tvar „číslo + Kč", ne konkrétní částka:
//    test by jinak přežil zdražení a chytil by jen dnešních 249/499.
check("nikde žádná cena v korunách", !/\d[\d\s]*\s*(Kč|kč|CZK)/.test(s));

const bez = buildOffboardInner({ ...MUZ, includeSales: false });
check("bez sales: žádné CTA na VIP", !bez.includes("Chci VIP na rok se slevou"));
check("bez sales: kód se neukáže", !bez.includes(KOD) && !bez.includes("KLIENT20"));
check("bez sales: potvrzení zůstává", bez.includes("Klientská sekce na webu se zavřela"));
check("bez sales: closing zůstává", bez.includes("Be Effective"));

// ⛔⛔ KONTRAST, KVŮLI KTERÉMU TAHLE VĚTEV VZNIKLA (nález revize 22. 9. 2026).
//    Kdo má zaplacenou Academy, o appku nepřijde. Mail mu to musí říct správně,
//    jinak si myslí, že přišel o něco, co pořád má, a odejde i z Academy.
console.log("\n== větev: klient se zaplacenou Academy ==");
const sAcad = buildOffboardInner({ ...MUZ, maAcademy: true });
check("Academy: appka ZŮSTÁVÁ", sAcad.includes("necháváš"));
check("Academy: netvrdí, že přístup skončil", !sAcad.includes("skončil i tvůj přístup"));
check("Academy: žádná nabídka VIP", !sAcad.includes("Chci VIP na rok se slevou") && !sAcad.includes(KOD));
check("Academy: ani druhá nabídka Academy", !sAcad.includes("KLIENT20"));
check("Academy: potvrzení a rozloučení zůstává",
  sAcad.includes("Klientská sekce na webu se zavřela") && sAcad.includes("Be Effective"));
check("bez Academy: appka SKONČILA", s.includes("skončil i tvůj přístup") && !s.includes("necháváš"));

console.log("\n== brána nabídky VIP ==");
check("nabídka jen při sales + bez Academy + s kódem", maNabidnoutVip(MUZ) === true);
check("bez kódu se nenabízí", maNabidnoutVip({ ...MUZ, promoKod: "" }) === false);
check("prázdné mezery nejsou kód", maNabidnoutVip({ ...MUZ, promoKod: "   " }) === false);
check("s Academy se nenabízí", maNabidnoutVip({ ...MUZ, maAcademy: true }) === false);
check("po hard unsub se nenabízí", maNabidnoutVip({ ...MUZ, includeSales: false }) === false);
// ⛔ Bez kódu NESMÍ v mailu zůstat slib slevy: to by v pokladně skončilo hláškou
//    „neplatný kód" a člověk by nekoupil nic.
const bezKodu = buildOffboardInner({ ...MUZ, promoKod: "" });
check("bez kódu: žádný slib slevy 20 % na VIP", !bezKodu.includes("slevou 20 %"));

console.log("\n== drobnosti ==");
check("odkaz je na pokladnu appky s ročním VIP",
  vipOdkaz(KOD).startsWith("https://tvujcoach.cz/koupit?plan=vip-rok&promo=" + KOD));
check("žena: dala / věděla",
  buildOffboardInner(ZENA).includes("dala") && buildOffboardInner(ZENA).includes("věděla"));
check("muž: dal / věděl",
  s.includes("dal") && s.includes("věděl") && !s.includes("věděla"));
check("osloveni v HTML", s.includes("Ahoj Milane,"));
check("prázdné oslovení",
  buildOffboardInner({ osloveni: "", rod: "m" as const, includeSales: false }).startsWith("<p style='margin:0 0 14px'>Ahoj,"));

const html = buildOffboardMail(MUZ).html;
check("wrap: doctype a karta", html.includes("<!doctype html>") && html.includes("Martin Barna"));


// ⛔⛔ NEUTRÁLNÍ ROD PRO AUTOMAT (22. 9. 2026). Cron pohlaví klienta NEZNÁ a odhad
//    ze jména je přesně ta vada, kvůli které přepínač rodu vznikl. Neutrální znění
//    proto nesmí obsahovat ANI JEDNO příčestí minulé, jinak je to mužská větev
//    s jiným štítkem.
console.log("\n== neutrální rod (automat) ==");
const NEUTRAL = { osloveni: "Milane", rod: "neutral" as const, includeSales: true, promoKod: KOD };
const n = buildOffboardInner(NEUTRAL);
const PRICESTI = ["dal", "dala", "věděl", "věděla", "měl", "měla", "vrátil", "vrátila",
  "zvykl", "zvykla", "chtěl", "chtěla", "sám", "sama"];
for (const tvar of PRICESTI) {
  check("neutrál neobsahuje `" + tvar + "`", !new RegExp("[^a-záčďéěíňóřšťúůýž]" + tvar + "[^a-záčďéěíňóřšťúůýž]", "i").test(n), tvar);
}
check("neutrál: potvrzení i rozloučení zůstává",
  n.includes("Klientská sekce na webu se zavřela") && n.includes("Be Effective"));
check("neutrál: appka skončila (bez Academy)", n.includes("byla v ceně koučinku"));
check("neutrál: nabídka VIP funguje i tady", n.includes("Chci VIP na rok se slevou") && n.includes(KOD));
check("neutrál: žádná dlouhá pomlčka", !n.includes("—"));
check("neutrál s Academy: appku si nechává",
  buildOffboardInner({ ...NEUTRAL, maAcademy: true }).includes("necháváš"));
// KONTRAST: mužská větev ta příčestí opravdu MÁ, takže test výš něco měří.
check("mužská větev příčestí má", /[^a-záčďéěíňóřšťúůýž]dal[^a-záčďéěíňóřšťúůýž]/i.test(buildOffboardInner(MUZ)));

console.log(selhalo === 0 ? "\nVSE ZELENE\n" : `\n${selhalo} SELHANI\n`);
if (selhalo > 0) throw new Error(String(selhalo) + " selhani");
