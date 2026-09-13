// Spuštění: npx --yes deno@2 run akademie/_supabase/functions/admin-api/offboard-mail.test.ts
import { buildOffboardInner, buildOffboardMail, offboardSubject } from "./offboard-mail.ts";

let selhalo = 0;
function check(nazev: string, podminka: boolean, detail = ""): void {
  if (podminka) console.log("  ok   " + nazev);
  else {
    selhalo++;
    console.log("  FAIL " + nazev + (detail ? "  [" + detail + "]" : ""));
  }
}

const MUZ = { osloveni: "Milane", zena: false, includeSales: true };
const ZENA = { osloveni: "Jano", zena: true, includeSales: true };

console.log("\n== offboard-mail ==");

check("předmět beze změny",
  offboardSubject() === "Díky za spolupráci. Co dál s appkou a s tvými daty");

const s = buildOffboardInner(MUZ);
check("sales: CTA appky", s.includes("Pokračovat v Tvůj Coach"));
check("sales: kód KLIENT20", s.includes("KLIENT20"));
check("confirm: klientská sekce se zavřela", s.includes("Klientská sekce na webu se zavřela"));
check("closing: koučink znovu", s.includes("koučink znovu"));
check("žádná dlouhá pomlčka", !s.includes("—") && !buildOffboardMail(MUZ).html.includes("—"));

const bez = buildOffboardInner({ ...MUZ, includeSales: false });
check("bez sales: žádné CTA appky", !bez.includes("Pokračovat v Tvůj Coach"));
check("bez sales: žádné KLIENT20", !bez.includes("KLIENT20") && !bez.includes("/akademie/?utm_source=mail"));
check("bez sales: potvrzení zůstává", bez.includes("Klientská sekce na webu se zavřela"));
check("bez sales: closing zůstává", bez.includes("Be Effective"));

check("žena: dala / věděla",
  buildOffboardInner(ZENA).includes("dala") && buildOffboardInner(ZENA).includes("věděla"));
check("muž: dal / věděl",
  s.includes("dal") && s.includes("věděl") && !s.includes("věděla"));
check("osloveni v HTML", s.includes("Ahoj Milane,"));
check("prázdné oslovení",
  buildOffboardInner({ osloveni: "", zena: false, includeSales: false }).startsWith("<p style='margin:0 0 14px'>Ahoj,"));

const html = buildOffboardMail(MUZ).html;
check("wrap: doctype a karta", html.includes("<!doctype html>") && html.includes("Martin Barna"));

console.log(selhalo === 0 ? "\nVSE ZELENE\n" : `\n${selhalo} SELHANI\n`);
if (selhalo > 0) throw new Error(String(selhalo) + " selhani");
