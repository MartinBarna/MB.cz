/* Uložení check-inu z prohlížeče.
 * Úspěch jen když HTTP projde a tělo má ulozeno:true (server vrátil řádek).
 * Dočasná chyba (síť, 429, 5xx) se zopakuje. Trvalá ne.
 * Formulář se při chybě nemaže: tohle vrací jen výsledek, DOM nechává na stránce.
 * Text hlášky musí zůstat stejný jako HLASKA_CHYBA v checkin-capture/ulozit.ts.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.MBCheckinUloz = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  var HLASKA = "Nepodařilo se uložit, zkus znovu";
  var CEKANI = [300, 900];

  function jeDocasnaOdpoved(status, sit) {
    if (sit) return true;
    var s = Number(status) || 0;
    if (s === 0 || s === 408 || s === 429) return true;
    return s >= 500;
  }

  /** Pravda jen když server potvrdil řádek. Samotné {ok:true} bez ulozeno nestačí. */
  function jeUlozeno(status, body) {
    var s = Number(status) || 0;
    return s >= 200 && s < 300 && !!body && body.ok === true && body.ulozeno === true;
  }

  function ulozSOpakovanim(odesli, opts) {
    var cekani = (opts && opts.cekani) || CEKANI;
    var spi = (opts && opts.spi) || function (ms) {
      return new Promise(function (r) { setTimeout(r, ms); });
    };
    var pokusu = cekani.length + 1;
    var i = 0;
    var posledni = { ok: false, hlaseni: HLASKA, status: 0, body: null, pokusu: 0 };

    function krok() {
      var pauza = i === 0 ? Promise.resolve() : spi(cekani[i - 1] || 0);
      return pauza.then(function () {
        return Promise.resolve()
          .then(function () { return odesli(); })
          .then(function (vys) { return vys || { status: 0, body: null, sit: true }; })
          .catch(function () { return { status: 0, body: null, sit: true }; });
      }).then(function (vys) {
        i += 1;
        posledni = {
          ok: false,
          hlaseni: HLASKA,
          status: Number(vys.status) || 0,
          body: vys.body || null,
          pokusu: i,
        };
        if (jeUlozeno(vys.status, vys.body)) {
          posledni.ok = true;
          posledni.hlaseni = "";
          return posledni;
        }
        if (!jeDocasnaOdpoved(vys.status, !!vys.sit) || i >= pokusu) return posledni;
        return krok();
      });
    }
    return krok();
  }

  return {
    HLASKA: HLASKA,
    CEKANI: CEKANI,
    jeDocasnaOdpoved: jeDocasnaOdpoved,
    jeUlozeno: jeUlozeno,
    ulozSOpakovanim: ulozSOpakovanim,
  };
});
