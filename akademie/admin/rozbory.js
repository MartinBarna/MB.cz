/* =============================================================================
 * KONTROLA OD MARTINA: fronta konceptů rozborů v adminu Academy (3. 9. 2026)
 *
 * CO TO JE: klient s tarifem „VIP + Kontrola od Martina" dostává každých 14 dní
 * písemný rozbor svých check-inů. KONCEPT vyrobí automat v appce Tvůj Coach
 * z hotových čísel; Martin ho přečte, případně přepíše a odešle. Do 3. 9. 2026
 * to šlo jen v adminu appky, tedy ve druhém okně. Tenhle modul to přináší sem.
 *
 * KDE JE CO (ať to nikdo nehledá na třech místech):
 *   • TVAR OBRAZOVKY a potvrzení je TADY, skládá ho prohlížeč.
 *   • ČÍSLA i TEXT konceptu počítá a skládá appka (edge `kontrola-rozbory`).
 *   • CESTA TAM je most `admin-api` → `academy-grant` (akce rozbory_fronta,
 *     rozbor_odeslat, rozbor_zahodit). Mail odesílá appka, ne tenhle web.
 *
 * ⛔⛔ ODESLÁNÍ JE NEVRATNÉ. Mail jde klientovi hned a pod Martinovým jménem,
 *    proto dvoukrokové potvrzení, stejně jako v appce. Kdo sem bude přidávat
 *    „odeslat všechny", ať si nejdřív přečte, proč to takhle je.
 * ⛔ Klient bez appky NENÍ chyba. Většina koučinkových klientů appku nepoužívá;
 *    v jejich kartě se to napíše slovy, ne červeně.
 * ⛔ Žádná dlouhá pomlčka v textech.
 * ============================================================================= */
(function (root) {
  "use strict";

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  /* 'YYYY-MM-DD' → '3. 9. 2026'. Cokoli jiného vrací beze změny, ať datum nezmizí. */
  function den(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || ""));
    return m ? (+m[3]) + ". " + (+m[2]) + ". " + m[1] : String(s || "");
  }

  var STAVY = {
    draft: "Koncept",
    schvaleno: "Schváleno",
    odeslano: "Odesláno",
    zamitnuto: "Zahozeno",
  };
  function stavPopis(s) { return STAVY[String(s || "")] || String(s || ""); }

  /* Stav přístupu do appky pro kartu klienta. `zadny` je normální stav, ne chyba. */
  function appkaPopis(stav) {
    if (stav === "aktivni") return "má appku";
    if (stav === "vyprselo") return "přístup do appky vypršel";
    if (stav === "ceka_na_registraci") return "přístup přislíbený, ještě se nezaregistroval";
    return "bez appky";
  }

  /* Důvod od serveru přeložený do věty. Neznámý důvod se ukáže, jak přišel:
     radši ošklivý řetězec než hláška, která zamlčí, co se stalo. */
  function chybaPopis(duvod) {
    if (duvod === "chybi_secret") return "Chybí sdílený klíč k appce, rozbory odsud nejdou.";
    if (duvod === "appka_neodpovida") return "Appka neodpovídá, zkus to za chvíli.";
    if (duvod === "appka_akci_neumi") return "Appka tuhle akci ještě neumí, je potřeba ji nasadit.";
    return String(duvod || "Nepovedlo se.");
  }

  var RAM = "background:rgba(235,177,44,.06);border:1px solid rgba(235,177,44,.28);border-radius:10px;padding:12px;margin:0 0 1rem;";
  var BTN = "background:#EBB12C;color:#1A1222;border:0;border-radius:8px;padding:7px 14px;font-family:inherit;font-weight:700;font-size:.85rem;cursor:pointer;";
  var BTN2 = "background:rgba(255,255,255,.06);color:#ece4d9;border:1px solid rgba(255,255,255,.16);border-radius:8px;padding:7px 14px;font-family:inherit;font-size:.85rem;cursor:pointer;";
  var TXT = "width:100%;box-sizing:border-box;min-height:210px;margin-top:8px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.14);border-radius:8px;padding:10px;color:#fff;font-family:inherit;font-size:.88rem;line-height:1.55;";

  /* Číslo s jednotkou. `null` je „nemám", nikdy ne nula: nula je tvrzení. */
  function cis(v, jed) {
    if (v == null || v === "") return "nemám";
    // esc() i u čísel: dnes sem chodí jen čísla z enginu, ale je to jediné místo
    // v souboru, kde by se do HTML dostala neescapovaná hodnota (nález revize).
    return esc(String(v)) + (jed ? " " + esc(jed) : "");
  }

  /* KRÁTKODOBĚ: čísla, ze kterých se koncept skládal. Berou se ze sloupce `souhrn`
     u rozboru, ne z nového dotazu, aby text a čísla nemohly mluvit o jiném období. */
  function kratkodobe(s) {
    if (!s || typeof s !== "object") return "";
    return '<div class="muted" style="font-size:.78rem;margin:4px 0 0;line-height:1.5;">'
      + "Za 14 dní: váha " + cis(s.vahaKg, "kg")
      + " · trend " + cis(s.vahaTrendPctTydne, "%/týden")
      + " · příjem " + cis(s.prumernyPrijemKcal, "kcal") + " (cíl " + cis(s.cilKcal, "kcal") + ")"
      + " · zápis " + cis(s.zapsanoDni, "") + " z " + cis(s.celkemDni, "dní")
      + " · tréninky " + cis(s.treninkoveDny, "")
      + " · check-iny " + cis(s.checkinyPocet, "")
      + "</div>";
  }

  /* DLOUHODOBĚ: týdenní řádky od začátku. Tahá se až na rozkliknutí, je to
     druhý dotaz do appky a u zavřeného detailu by byl zbytečný. */
  function tydnyTabulka(d) {
    var k = (d && d.kratkodobe) || {};
    var tydny = (d && d.tydny) || [];
    if (!d || d.found === false) return '<p class="muted" style="font-size:.8rem;margin:6px 0 0;">Klient appku nemá, dlouhodobá data nejsou.</p>';
    if (!tydny.length) return '<p class="muted" style="font-size:.8rem;margin:6px 0 0;">Zatím žádná historie.</p>';
    var hlavicka = '<tr><th style="text-align:left;padding:2px 8px;color:#8F8A99;font-weight:400;">Týden od</th>'
      + '<th style="text-align:left;padding:2px 8px;color:#8F8A99;font-weight:400;">Zápis</th>'
      + '<th style="text-align:left;padding:2px 8px;color:#8F8A99;font-weight:400;">kcal</th>'
      + '<th style="text-align:left;padding:2px 8px;color:#8F8A99;font-weight:400;">Bílkoviny</th>'
      + '<th style="text-align:left;padding:2px 8px;color:#8F8A99;font-weight:400;">Váha</th>'
      + '<th style="text-align:left;padding:2px 8px;color:#8F8A99;font-weight:400;">Tréninky</th></tr>';
    var radky = tydny.map(function (t) {
      return '<tr><td style="padding:2px 8px;">' + den(t.tyden) + "</td>"
        + '<td style="padding:2px 8px;">' + cis(t.dny_zapsano, "") + " z 7</td>"
        + '<td style="padding:2px 8px;">' + cis(t.kcal, "") + "</td>"
        + '<td style="padding:2px 8px;">' + cis(t.protein, "g") + "</td>"
        + '<td style="padding:2px 8px;">' + cis(t.vaha, "kg") + "</td>"
        + '<td style="padding:2px 8px;">' + cis(t.treninky, "") + "</td></tr>";
    }).join("");
    return '<p class="muted" style="font-size:.78rem;margin:6px 0 4px;">Od ' + den(d.od)
      + " · cíl dnes " + cis(k.cil_kcal, "kcal") + " a " + cis(k.cil_protein, "g bílkovin") + "</p>"
      + '<div style="overflow-x:auto;max-height:32vh;overflow-y:auto;"><table style="font-size:.78rem;border-collapse:collapse;">'
      + hlavicka + radky + "</table></div>";
  }

  /* Jeden rozbor ve frontě: hlavička, čísla, editor textu a tlačítka. */
  function karta(r) {
    var kdo = esc(r.full_name || r.email || "Klient");
    // ⛔ Prázdný koncept není chyba: klient v okně nic nezapsal, takže automat
    //    nemá z čeho skládat. Řádek ve frontě je schválně, ať Martin o klientovi ví.
    var bezDat = !String(r.koncept || "").trim();
    return '<div data-rozbor="' + esc(r.id) + '" style="border-top:1px solid rgba(255,255,255,.08);padding:10px 0 4px;">'
      + '<div style="font-weight:700;color:#F6CD63;font-size:.88rem;">' + kdo
      + ' <span class="muted" style="font-weight:400;font-size:.8rem;">' + esc(r.email || "") + "</span></div>"
      + '<div class="muted" style="font-size:.78rem;margin:2px 0 0;">Období ' + den(r.obdobi_od) + " až " + den(r.obdobi_do)
      + " · " + esc(stavPopis(r.stav)) + "</div>"
      + kratkodobe(r.souhrn)
      + (r.sent_at && r.stav !== "odeslano"
        ? '<p style="color:#E0A03A;font-size:.82rem;margin:6px 0 0;">Odesílání tohohle rozboru už jednou začalo (' + den(String(r.sent_at).slice(0, 10))
          + '), ale nedoběhlo. Zkontroluj poštu: mail mohl odejít. Server druhé odeslání odmítne.</p>'
        : "")
      + '<details data-dlouhodobe style="margin-top:6px;"><summary style="cursor:pointer;color:#F6CD63;font-size:.8rem;">Dlouhodobá data (po týdnech)</summary>'
      + '<div data-tydny><p class="muted" style="font-size:.8rem;margin:6px 0 0;">Načtu po rozkliknutí.</p></div></details>'
      + (bezDat
        ? '<p style="color:#E0A03A;font-size:.82rem;margin:8px 0 0;">Bez dat: klient si v tomhle období nic nezapsal, automat nemá z čeho skládat. Napiš mu vlastní text, nebo rozbor zahoď.</p>'
        : "")
      + '<textarea data-text style="' + TXT + '">' + esc(r.koncept || "") + "</textarea>"
      + '<div data-akce style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:8px;">'
      + '<button data-krok1 style="' + BTN + '">Odeslat klientovi</button>'
      + '<button data-zahodit1 style="' + BTN2 + '">Zahodit</button>'
      + "</div>"
      + '<div data-hlaska class="muted" style="font-size:.8rem;margin-top:6px;"></div>'
      + "</div>";
  }

  /**
   * Fronta konceptů. `opts`: { box (element), api (funkce), toast (funkce) }.
   * Vrací Promise, ať volající pozná, že se překreslilo.
   */
  function mountFronta(opts) {
    var box = opts.box;
    if (!box) return Promise.resolve();
    box.innerHTML = '<p class="muted" style="padding:.6rem 0;">Načítám…</p>';
    return opts.api({ action: "rozbory_fronta" }).then(function (o) {
      var j = (o && o.j) || {};
      if (!j.ok) {
        box.innerHTML = '<p class="muted" style="padding:.6rem 0;">' + esc(chybaPopis(j.duvod)) + '</p>';
        return;
      }
      var rows = j.rows || [];
      if (!rows.length) {
        box.innerHTML = '<p class="muted" style="padding:.6rem 0;">Fronta je prázdná, nic nečeká na přečtení.</p>';
        return;
      }
      box.innerHTML = '<div style="' + RAM + '">'
        + '<div style="font-weight:700;color:#F6CD63;font-size:.86rem;">Čeká na tebe ' + rows.length + '</div>'
        + '<p class="muted" style="margin:.3rem 0 0;font-size:.78rem;">Koncept skládá automat z čísel za posledních 14 dní. Přečti ho, uprav a teprve pak odešli. Klient ho uvidí až po odeslání.</p>'
        + rows.map(karta).join("")
        + '</div>';
      rows.forEach(function (r) { pripojAkce(box, r, opts); });
      // Proklik z mailu: `?rozbor=<id>` otevře stránku rovnou u toho člověka.
      if (opts.zvyraznit) zvyrazni(box, opts.zvyraznit);
    }).catch(function () {
      box.innerHTML = '<p class="muted" style="padding:.6rem 0;">Nepodařilo se načíst frontu rozborů (zkus obnovit stránku).</p>';
    });
  }

  /* Karta z odkazu v mailu: dorolovat a orámovat, ať je jasné, o koho jde.
     ⛔ Nic se nepředvyplňuje ani neodesílá, je to jen navigace. */
  function zvyrazni(box, id) {
    var el = box.querySelector('[data-rozbor="' + String(id).replace(/"/g, "") + '"]');
    if (!el) return;
    el.style.background = "rgba(235,177,44,.1)";
    el.style.borderRadius = "8px";
    el.style.padding = "10px";
    if (el.scrollIntoView) el.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  /* Posluchače jedné karty. Dvoukrokové potvrzení u obou tlačítek: odeslání je
     nevratné a zahození bere klientovi rozbor za tohle období. */
  function pripojAkce(box, r, opts) {
    var el = box.querySelector('[data-rozbor="' + r.id + '"]');
    if (!el) return;
    var akce = el.querySelector("[data-akce]");
    var hlaska = el.querySelector("[data-hlaska]");
    var text = el.querySelector("[data-text]");

    function rekni(m) { hlaska.textContent = m || ""; }
    function zamkni(ano) {
      akce.querySelectorAll("button").forEach(function (b) { b.disabled = ano; });
      text.disabled = ano;
    }
    function zpetNaZaklad() {
      akce.innerHTML = '<button data-krok1 style="' + BTN + '">Odeslat klientovi</button>'
        + '<button data-zahodit1 style="' + BTN2 + '">Zahodit</button>';
      rekni("");
      naves();
    }
    function hotovo(zprava) {
      akce.innerHTML = "";
      rekni(zprava);
      text.disabled = true;
      el.style.opacity = ".55";
    }

    // Dlouhodobá data až na rozkliknutí a jen jednou. Je to druhý dotaz do appky.
    var det = el.querySelector("[data-dlouhodobe]");
    var tydnyBox = el.querySelector("[data-tydny]");
    var nacteno = false;
    if (det && tydnyBox) det.addEventListener("toggle", function () {
      if (!det.open || nacteno) return;
      nacteno = true;
      tydnyBox.innerHTML = '<p class="muted" style="font-size:.8rem;margin:6px 0 0;">Načítám…</p>';
      opts.api({ action: "klient_prehled", email: r.email, days: 14, tydnu: 26 }).then(function (o) {
        var j = (o && o.j) || {};
        if (!j.ok) { nacteno = false; tydnyBox.innerHTML = '<p class="muted" style="font-size:.8rem;margin:6px 0 0;">' + esc(chybaPopis(j.duvod)) + "</p>"; return; }
        tydnyBox.innerHTML = tydnyTabulka(j.data || {});
      }).catch(function () {
        nacteno = false;
        tydnyBox.innerHTML = '<p class="muted" style="font-size:.8rem;margin:6px 0 0;">Data se nepodařilo načíst.</p>';
      });
    });

    function naves() {
      var k1 = akce.querySelector("[data-krok1]");
      if (k1) k1.addEventListener("click", function () {
        akce.innerHTML = '<button data-ano style="' + BTN + '">Ano, odeslat</button>'
          + '<button data-zpet style="' + BTN2 + '">Zpět</button>';
        rekni("Mail odejde klientovi hned a nedá se vzít zpět. Poslat?");
        akce.querySelector("[data-zpet]").addEventListener("click", zpetNaZaklad);
        akce.querySelector("[data-ano]").addEventListener("click", function () {
          zamkni(true); rekni("Odesílám…");
          opts.api({ action: "rozbor_odeslat", rozbor_id: r.id, koncept: text.value }).then(function (o) {
            var j = (o && o.j) || {};
            if (!j.ok) { zamkni(false); zpetNaZaklad(); rekni(chybaPopis(j.duvod)); return; }
            // ⚠️ `oznaceno:false` znamená, že mail ODEŠEL, ale řádek se v appce
            // neoznačil. Musí to být vidět, jinak Martin rozbor zítra uvidí znovu
            // a pošle ho podruhé.
            if (j.oznaceno === false) {
              hotovo("Mail odešel, ale rozbor se nepodařilo označit jako odeslaný. Neposílej ho znovu a řekni to vývoji.");
              return;
            }
            hotovo("Odesláno klientovi.");
            if (opts.toast) opts.toast("Rozbor odeslán");
          }).catch(function () {
            // ⛔⛔ TADY SE NESMI RIKAT „zkus to znovu". Spojeni muze vyprset i u mailu,
            //    ktery UZ ODESEL (admin ma timeout kratsi, nez umi trvat odeslani),
            //    a druhy klik by klientovi poslal tentyz rozbor podruhe. Server to
            //    sice od 3. 9. blokuje zabranim radku, ale text nema nikoho pobizet
            //    k akci, kterou pak server odmitne.
            zamkni(false);
            zpetNaZaklad();
            rekni("Spojení vypršelo. Mail už mohl odejít, zkontroluj poštu a frontu; neposílej ho znovu naslepo.");
          });
        });
      });

      var z1 = akce.querySelector("[data-zahodit1]");
      if (z1) z1.addEventListener("click", function () {
        akce.innerHTML = '<button data-ano2 style="' + BTN2 + '">Ano, zahodit</button>'
          + '<button data-zpet2 style="' + BTN2 + '">Zpět</button>';
        rekni("Klient za tohle období rozbor nedostane. Další vznikne až za 14 dní.");
        akce.querySelector("[data-zpet2]").addEventListener("click", zpetNaZaklad);
        akce.querySelector("[data-ano2]").addEventListener("click", function () {
          zamkni(true); rekni("Zahazuji…");
          opts.api({ action: "rozbor_zahodit", rozbor_id: r.id }).then(function (o) {
            var j = (o && o.j) || {};
            if (!j.ok) { zamkni(false); zpetNaZaklad(); rekni(chybaPopis(j.duvod)); return; }
            hotovo("Zahozeno, klientovi nic neodešlo.");
            if (opts.toast) opts.toast("Rozbor zahozen");
          }).catch(function () { zamkni(false); zpetNaZaklad(); rekni("Nepovedlo se, zkus to znovu."); });
        });
      });
    }
    naves();
  }

  /**
   * Blok do karty jednoho klienta: poslední rozbory a odkaz na frontu.
   * `opts`: { box, api, email }.
   *
   * ⛔ Tady se schválně NEODESÍLÁ. Karta klienta je na přehled; odesílá se ve
   *    frontě výš, kde je vidět celý text a potvrzení.
   */
  function mountKlient(opts) {
    var box = opts.box;
    if (!box) return Promise.resolve();
    box.innerHTML = '<p class="muted" style="font-size:.8rem;margin:0;">Načítám rozbory…</p>';
    return opts.api({ action: "rozbory_fronta", email: opts.email }).then(function (o) {
      var j = (o && o.j) || {};
      if (!j.ok) {
        box.innerHTML = '<p class="muted" style="font-size:.8rem;margin:0;">' + esc(chybaPopis(j.duvod)) + '</p>';
        return;
      }
      var rows = j.rows || [];
      var stav = '<span class="muted" style="font-size:.78rem;">Appka: ' + esc(appkaPopis(j.stav_appky)) + '</span>';
      if (!rows.length) {
        box.innerHTML = '<p class="muted" style="font-size:.8rem;margin:0;">Zatím žádný rozbor. ' + stav + '</p>';
        return;
      }
      var posledni = rows[0];
      box.innerHTML = '<div style="font-size:.82rem;">'
        + '<div><strong style="color:#F6CD63;">Poslední rozbor:</strong> ' + den(posledni.obdobi_od) + ' až ' + den(posledni.obdobi_do)
        + ' · ' + esc(stavPopis(posledni.stav)) + ' ' + stav + '</div>'
        + '<details style="margin-top:5px;"><summary style="cursor:pointer;color:#F6CD63;">Zobrazit text</summary>'
        + '<div style="white-space:pre-wrap;margin-top:6px;color:#cbbfae;">' + esc(posledni.koncept || "") + '</div></details>'
        + (rows.length > 1 ? '<div class="muted" style="margin-top:5px;font-size:.78rem;">Starší rozbory: '
            + rows.slice(1).map(function (r) { return den(r.obdobi_do) + " (" + stavPopis(r.stav) + ")"; }).join(" · ") + '</div>' : "")
        + '</div>';
    }).catch(function () {
      box.innerHTML = '<p class="muted" style="font-size:.8rem;margin:0;">Rozbory se nepodařilo načíst.</p>';
    });
  }

  root.AdminRozbory = {
    mountFronta: mountFronta,
    mountKlient: mountKlient,
    stavPopis: stavPopis,
    appkaPopis: appkaPopis,
    chybaPopis: chybaPopis,
    den: den,
  };
})(typeof window !== "undefined" ? window : globalThis);
