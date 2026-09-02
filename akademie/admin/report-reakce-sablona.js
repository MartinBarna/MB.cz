/* =============================================================================
 * ŠABLONA REAKCE NA TÝDENNÍ REPORT (2. 9. 2026)
 *
 * Kostra vytažená z DESETI skutečných odpovědí, které Martin poslal klientům mezi
 * 17. 8. a 1. 9. 2026 (Gmail, složka Odeslané). ⛔ Žádná jména, adresy ani čísla
 * konkrétních lidí tady nejsou a nikdy tu být nesmí, jen sloty.
 *
 * Kdo tenhle soubor mění, ať ví, kde je co:
 *   • TVAR MAILU (oslovení, pořadí bloků, závěr) je TADY. Skládá ho prohlížeč.
 *   • ČÍSLA počítá `akademie/_supabase/functions/admin-api/report-engine.js`.
 *   • PRAVIDLA PRO AI (co smí napsat) jsou v `admin-api/index.ts` u konstanty RD_SYSTEM.
 *   Jsou to tři různé věci, ne tři kopie téhož. Nekopíruj mezi nimi čísla ani pravidla.
 *
 * ⛔ NIC ODSUD SE NEODESÍLÁ. Výstupem je text a odkaz „Otevřít v Gmailu", který jen
 *    předvyplní rozepsaný mail. Odeslání zůstává Martinův klik v jeho schránce.
 * ============================================================================= */
(function (root) {
  "use strict";

  var NL = "\n";

  /* ---------------------------------------------------------------------------
   * KOSTRA: co má KAŽDÁ Martinova reakce na report, v tomhle pořadí.
   * Čísla v závorkách jsou z rozboru deseti odeslaných mailů.
   * ------------------------------------------------------------------------- */
  var KOSTRA = [
    { klic: "osloveni", popis: "Přání dne + oslovení v 5. pádu", kdo: "sablona",
      pozn: "Vzdycky. Strida se prani dne z pole PRANI niz." },
    { klic: "podekovani", popis: "Poděkování za report, s úsměvem", kdo: "sablona",
      pozn: "Ve všech deseti mailech. Typicky jedna věta." },
    { klic: "stav", popis: "Blok s nadpisem Takhle vypada stav a holymi cisly", kdo: "engine",
      pozn: "Váha od minule i od startu, míry s minulou hodnotou, zápis N ze 7, průměr kcal proti cíli, bílkoviny proti cíli, kroky proti plánu. Bez vět, jako výpis." },
    { klic: "zhodnoceni", popis: "Zhodnocení: co ta čísla znamenají", kdo: "ai",
      pozn: "Dvě až čtyři věty. Kolísání měr se komentuje jako normální, dlouhodobý trend se staví nad jeden týden." },
    { klic: "pochvala", popis: "Pochvala za jednu konkrétní věc podloženou číslem", kdo: "ai",
      pozn: "Ve všech deseti. Nikdy obecně, vždy k něčemu, co je vidět v číslech." },
    { klic: "co_menit", popis: "Co měnit a proč (kalorie, kroky, tréninky, bílkoviny)", kdo: "engine+ai",
      pozn: "Cislo doda engine, vetu kolem nej napise AI. Kdyz se nic nemeni, rekne se to nahlas, ze cil zustava." },
    { klic: "ukoly", popis: "Jeden až dva konkrétní úkoly na příští týden", kdo: "ai",
      pozn: "Vzdy meritelne: kroky, dny zapisu, gramy bilkovin. Nikdy obecne povzbuzeni." },
    { klic: "otazka", popis: "Otázka na konec, ať se klient ozve", kdo: "ai",
      pozn: "V sesti z deseti. Typu Rozumime si, Co rikas, nebo nabidka prepadovek na WhatsAppu." },
    { klic: "priloha", popis: "Téma týdne a odkaz na přílohu", kdo: "sablona",
      pozn: "Volitelné. Martin ho v pondělí posílá všem naráz a u někoho ho schválně prohodí, takže se nikdy neodvozuje." },
    { klic: "zaver", popis: "Uzavření: WhatsApp, Be Effective! a podpis", kdo: "sablona",
      pozn: "Beze změny ve všech deseti mailech." },
  ];

  /* Naměřené parametry stylu. Slouží k tomu, aby koncept neseděl vedle Martinova
   * mailu jako cizí těleso. Nejsou to pravidla pro AI, ta jsou v RD_SYSTEM. */
  var STYL = {
    delka_znaku: [1500, 3500],   // osobní část bez čísel a bez patičky
    tykani: true,
    smajlik: ":)",                // a jeho varianty :)) a :-D, moderní emoji nikdy
    cisla: "desetinná čárka, minus krátkou pomlčkou, hodnota a v závorce minulá (pas 107, minule 104)",
    pomer: "na jednu výtku připadá aspoň jedna pochvala",
    zvyrazneni: "čísla a jeden hlavní úkol tučně, zbytek ne",
  };

  /* Střídavá přání dne. Pořadí je Martinovo, ne abecední. */
  var PRANI = ["Přeju úspěšný den", "Přeju super den", "Přeju bomba den", "Přeju dělo den"];

  /** Přání dne odvozené od data, ať se ve stejném týdnu neopakuje pořád totéž. */
  function prani(datum) {
    var d = Date.parse(String(datum || "") + "T12:00:00Z");
    if (!isFinite(d)) return PRANI[0];
    return PRANI[Math.floor(d / 86400000) % PRANI.length];
  }

  /** „1/9", jak to Martin píše do předmětu. */
  function denMesic(datum) {
    var p = String(datum || "").split("-");
    if (p.length !== 3) return "";
    return String(Number(p[2])) + "/" + String(Number(p[1]));
  }

  /** Předmět: „<oslovení> report <d/m> :)". Bez oslovení jen „Report <d/m> :)". */
  function predmet(osloveni, datum) {
    var dm = denMesic(datum);
    var o = String(osloveni || "").trim();
    return (o ? o + " report" : "Report") + (dm ? " " + dm : "") + " :)";
  }

  /**
   * Složí celé tělo mailu. ⛔ Čísla přebírá HOTOVÁ z enginu, nic nepřepočítává.
   * @param {{osloveni:string, datum:string, stavRadky:string[], textAi:string,
   *          tema?:string, temaOdkaz?:string}} v
   */
  function telo(v) {
    var o = String(v.osloveni || "").trim();
    var casti = [];
    casti.push(prani(v.datum) + (o ? ", " + o + "!" : "!"));
    casti.push("");
    casti.push("Díky za reporta! :)");
    casti.push("");
    var radky = (v.stavRadky || []).filter(Boolean);
    if (radky.length) {
      casti.push("Takhle vypadá stav:");
      casti.push("");
      casti.push(radky.join(NL));
      casti.push("");
    }
    var ai = String(v.textAi || "").trim();
    if (ai) { casti.push(ai); casti.push(""); }
    if (v.tema) {
      casti.push("Dnešní příloha:");
      casti.push(String(v.tema) + (v.temaOdkaz ? NL + String(v.temaOdkaz) : ""));
      casti.push("");
    }
    casti.push("Kdyžtak jsem klasicky i na WA :)");
    casti.push("");
    casti.push("Be Effective!");
    casti.push("Martin");
    return casti.join(NL);
  }

  /* ---------------------------------------------------------------------------
   * ODKAZ DO GMAILU
   *
   * `view=cm&fs=1` otevře nové okno rozepsaného mailu v účtu, který je v prohlížeči
   * přihlášený. ⛔ Nic to neodesílá, jen předvyplní.
   *
   * ⚠️ DÉLKA: adresní řádek prohlížeče má strop (v praxi kolem 8 000 znaků, Chrome
   * i víc, ale Gmail delší `body` tiše ořízne). Reakce na report bývá 1 500 až 3 500
   * znaků, po URL kódování diakritiky až trojnásobek, takže se na strop dá narazit.
   * Když se to nevejde, vrací se odkaz BEZ těla a volající musí nabídnout „Kopírovat"
   * (`vejdeSe:false`). Tichý ořez by znamenal odeslaný půlmail, což je horší než klik navíc.
   * ------------------------------------------------------------------------- */
  // 15 000 znaku URL: Chrome unese kolem 32 000, takze je tu rezerva na dvojnasobek.
  // Zmereno na testovaci strance: mail s 1 145 znaky tela dal URL 2 143 znaku, takze
  // i nejdelsi Martinova odpoved (kolem 3 500 znaku prozy plus blok cisel) se vejde.
  var GMAIL_MAX = 15000;

  function gmailOdkaz(komu, predmetTxt, teloTxt) {
    var zaklad = "https://mail.google.com/mail/?view=cm&fs=1";
    var bezTela = zaklad +
      "&to=" + encodeURIComponent(String(komu || "")) +
      "&su=" + encodeURIComponent(String(predmetTxt || ""));
    var plny = bezTela + "&body=" + encodeURIComponent(String(teloTxt || ""));
    if (plny.length <= GMAIL_MAX) return { url: plny, vejdeSe: true, delka: plny.length };
    return { url: bezTela, vejdeSe: false, delka: plny.length };
  }

  root.ReportReakce = {
    KOSTRA: KOSTRA, STYL: STYL, PRANI: PRANI,
    prani: prani, denMesic: denMesic, predmet: predmet, telo: telo, gmailOdkaz: gmailOdkaz,
  };
})(typeof window !== "undefined" ? window : globalThis);
