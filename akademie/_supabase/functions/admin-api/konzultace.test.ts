// Testy prevodu terminu konzultace mezi ceskym casem a UTC (15. 9. 2026).
// Spusteni: npx --yes deno@2 run akademie/_supabase/functions/admin-api/konzultace.test.ts
// (bez --allow-*: nic necte sit, disk ani promenne prostredi)
import {
  isoNaPoleFormulare,
  prazskyPosunMinut,
  stavHovoru,
  terminNaIso,
} from "./konzultace.ts";

let selhalo = 0, kontrol = 0;
function zkontroluj(popis: string, dostal: unknown, cekal: unknown) {
  kontrol++;
  if (dostal === cekal) console.log("OK  " + popis);
  else { selhalo++; console.error("CHYBA  " + popis + ": cekal " + String(cekal) + ", dostal " + String(dostal)); }
}
const iso = (p: ReturnType<typeof terminNaIso>) => p.ok ? p.iso : "NEPREVEDENO";
const duvod = (p: ReturnType<typeof terminNaIso>) => p.ok ? "OK" : p.duvod;

// Ted pro testy: 15. 9. 2026 12:00 UTC. Cas se predava, aby test nezestaral.
const TED = Date.parse("2026-09-15T12:00:00Z");

// ---------- LETNI vs ZIMNI CAS: tohle je cely duvod, proc funkce existuje ----------
zkontroluj("letni cas: 18. 9. 14:30 v Praze je 12:30 UTC", iso(terminNaIso("2026-09-18", "14:30", TED)), "2026-09-18T12:30:00.000Z");
zkontroluj("zimni cas: 10. 12. 14:30 v Praze je 13:30 UTC", iso(terminNaIso("2026-12-10", "14:30", TED)), "2026-12-10T13:30:00.000Z");
zkontroluj("posun v zari je 120 minut", prazskyPosunMinut(Date.parse("2026-09-18T12:00:00Z")), 120);
zkontroluj("posun v prosinci je 60 minut", prazskyPosunMinut(Date.parse("2026-12-10T12:00:00Z")), 60);
// Vecer pred prechodem na zimni cas (posledni nedele v rijnu 2026 = 25. 10.).
zkontroluj("24. 10. 2026 9:00 v Praze je jeste letni cas", iso(terminNaIso("2026-10-24", "09:00", TED)), "2026-10-24T07:00:00.000Z");
zkontroluj("26. 10. 2026 9:00 v Praze je uz zimni cas", iso(terminNaIso("2026-10-26", "09:00", TED)), "2026-10-26T08:00:00.000Z");

// ---------- PRAZDNE A NESMYSLNE VSTUPY: musi vratit DUVOD, ne ticho ----------
zkontroluj("prazdne oboji", duvod(terminNaIso("", "", TED)), "prazdne");
zkontroluj("chybi datum", duvod(terminNaIso("", "14:30", TED)), "chybi_datum");
zkontroluj("chybi cas", duvod(terminNaIso("2026-09-18", "", TED)), "chybi_cas");
zkontroluj("datum v jinem tvaru", duvod(terminNaIso("18.9.2026", "14:30", TED)), "datum_nema_tvar_RRRR-MM-DD");
zkontroluj("cas v jinem tvaru", duvod(terminNaIso("2026-09-18", "14.30", TED)), "cas_nema_tvar_HH:MM");
zkontroluj("hodina 25 neexistuje", duvod(terminNaIso("2026-09-18", "25:00", TED)), "cas_mimo_rozsah");
zkontroluj("mesic 13 neexistuje", duvod(terminNaIso("2026-13-01", "10:00", TED)), "datum_mimo_rozsah");
// ⛔ Tohle je ta past: Date.UTC(2026,1,31) tise vyrobi 3. brezna.
zkontroluj("31. unora neexistuje a nesmi se ticho posunout", duvod(terminNaIso("2026-02-31", "10:00", TED)), "datum_neexistuje");
zkontroluj("rok 1970 je zjevny preklep", duvod(terminNaIso("1970-01-01", "10:00", TED)), "datum_mimo_rozumne_okno");
zkontroluj("rok 2099 je zjevny preklep", duvod(terminNaIso("2099-01-01", "10:00", TED)), "datum_mimo_rozumne_okno");
zkontroluj("null nespadne", duvod(terminNaIso(null, null, TED)), "prazdne");
// Termin v nedavne minulosti je LEGITIMNI: Martin zadava i hovor, ktery uz probehl.
zkontroluj("vcerejsi termin je platny", duvod(terminNaIso("2026-09-14", "10:00", TED)), "OK");

// ---------- STAV HOVORU: tatáž hranice, jakou pouziva SQL enroll i drip-send ----------
zkontroluj("bez terminu", stavHovoru(null, TED), "bez_terminu");
zkontroluj("nesmyslny termin se chova jako bez terminu", stavHovoru("nesmysl", TED), "bez_terminu");
zkontroluj("termin v budoucnu = naplanovano", stavHovoru("2026-09-18T12:30:00Z", TED), "naplanovano");
zkontroluj("termin v minulosti = probehlo", stavHovoru("2026-09-15T09:00:00Z", TED), "probehlo");
zkontroluj("termin presne ted uz je probehlo (hranice je <=)", stavHovoru("2026-09-15T12:00:00Z", TED), "probehlo");

// ---------- ZPATKY DO FORMULARE: co ulozim, to musim videt ----------
zkontroluj("zpatky do poli, letni cas (datum)", isoNaPoleFormulare("2026-09-18T12:30:00.000Z").datum, "2026-09-18");
zkontroluj("zpatky do poli, letni cas (cas)", isoNaPoleFormulare("2026-09-18T12:30:00.000Z").cas, "14:30");
zkontroluj("zpatky do poli, zimni cas (cas)", isoNaPoleFormulare("2026-12-10T13:30:00.000Z").cas, "14:30");
zkontroluj("prazdny termin da prazdna pole", isoNaPoleFormulare(null).datum, "");
// Kolotoc: formular -> ISO -> formular musi dat totez.
const tam = terminNaIso("2026-11-03", "07:05", TED);
zkontroluj("kolotoc datum", isoNaPoleFormulare(iso(tam)).datum, "2026-11-03");
zkontroluj("kolotoc cas", isoNaPoleFormulare(iso(tam)).cas, "07:05");

console.log(selhalo === 0 ? ("HOTOVO: " + kontrol + " kontrol, vse proslo.") : ("SELHALO: " + selhalo + " z " + kontrol));
if (selhalo > 0) Deno.exit(1);
