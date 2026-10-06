// =============================================================================
// Období reportu na straně `client-report` (5. 10. 2026). Čisté funkce ve vlastním
// souboru, protože `index.ts` volá `Deno.serve()` hned při importu a test by ho
// nenačetl (stejný vzor jako `client-remind/cerstvy-klient.ts`).
// Testy: `obdobi-kontrola.test.ts`.
//
// ⛔ CHYBA ČTENÍ HISTORIE NENÍ „PRVNÍ REPORT". Kdyby se z prázdného seznamu spočítalo
//    období, klient po 14 dnech by dostal formulář na 7 dní a půlka jeho dat by zmizela.
//    Akce `obdobi` proto vrací 503 a formulář jede v náhradním režimu s varováním.
// ⛔ PŘI ULOŽENÍ SE UKLÁDÁ OBDOBÍ, KE KTERÉMU PATŘÍ ČÍSLA, tedy to, které klient viděl.
//    Neshodu s přepočtem serveru (stránka otevřená přes noc ze středy na čtvrtek, druhé
//    zařízení) se Martin dozví větou v mailu, ale čísla se k jinému období nepřepisují.
// =============================================================================
import {
  obdobiReportu,
  overObdobiKlienta,
  overRozpisKObdobi,
  popisObdobi,
  vetaBezObdobi,
  type Obdobi,
  type RadekReportu,
} from "../_shared/report-obdobi.ts";

/** Odpověď akce `obdobi`. `cteni` je výsledek dotazu na reporty klienta. */
export function odpovedObdobi(
  dnes: string,
  cteni: { data: RadekReportu[] | null; error: unknown },
): { status: number; body: Record<string, unknown> } {
  if (cteni.error) return { status: 503, body: { ok: false, error: "obdobi_neznam" } };
  return { status: 200, body: { ok: true, dnes, ...obdobiReportu(dnes, cteni.data ?? []) } };
}

export type KontrolaObdobi = {
  /** Co se uloží do `obdobi_od` a `obdobi_do`. null = nic (report se bere jako jeden týden). */
  obdobi: Obdobi | null;
  stav: "shoda" | "neshoda" | "neovereno" | "neplatne" | "bez_obdobi";
  /** Věta do Martinovy kopie mailu, nebo null. */
  poznamka: string | null;
};

/**
 * Co uložit k odeslanému reportu.
 * @param odKlienta  `data.obdobi` z formuláře ({od, do}), nebo nic (stará stránka, náhradní režim)
 * @param rozpis     `data.nutrition.dny`
 * @param historie   reporty klienta (bez dnešního se to řeší uvnitř), null = čtení selhalo
 */
export function kontrolaObdobi(v: {
  dnes: string;
  odKlienta: unknown;
  rozpis: unknown;
  historie: RadekReportu[] | null;
}): KontrolaObdobi {
  if (v.odKlienta == null) {
    if (!overRozpisKObdobi(v.rozpis, null)) {
      return {
        obdobi: null,
        stav: "neplatne",
        poznamka: "⚠️ Denní rozpis má data dnů, ale formulář neposlal období. Report je uložený, rozpis ber s rezervou a řekni Claudovi.",
      };
    }
    return { obdobi: null, stav: "bez_obdobi", poznamka: vetaBezObdobi(v.dnes, v.historie) };
  }
  const o = overObdobiKlienta(v.odKlienta, v.dnes);
  if (!o || !overRozpisKObdobi(v.rozpis, o)) {
    return {
      obdobi: null,
      stav: "neplatne",
      poznamka: "⚠️ Formulář poslal neplatné období reportu (nebo rozpis dnů mimo něj). Report je uložený bez období a bere se jako jeden týden. Řekni Claudovi.",
    };
  }
  if (!v.historie) {
    return {
      obdobi: o,
      stav: "neovereno",
      poznamka: "⚠️ Období " + popisObdobi(o.od, o.do) + " jsem nemohl ověřit, historie reportů se nenačetla. Uložil jsem ho tak, jak ho klient viděl.",
    };
  }
  const ocek = obdobiReportu(v.dnes, v.historie);
  if (ocek.od === o.od && ocek.do === o.do) return { obdobi: o, stav: "shoda", poznamka: null };
  return {
    obdobi: o,
    stav: "neshoda",
    poznamka: "⚠️ Období reportu se liší od očekávaného: klient vyplňoval " + popisObdobi(o.od, o.do) +
      ", podle historie mělo být " + popisObdobi(ocek.od, ocek.do) +
      ". Čísla patří k tomu, co viděl klient, proto je uložené jeho období.",
  };
}
