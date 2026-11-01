// Modal e-mailu a souhlasu pred platbou. Flag data-kosik-zapnuto je ve vychozim stavu false:
// bez nej se kliky nechytaji a puvodni odkaz na buy.stripe.com funguje i bez JS.
import {
  DROBNY_TEXT,
  SOUHLAS_LABEL,
  kamDal,
  maSePrepnout,
  obohatOdkaz,
  platnyEmail,
  sestavTelo,
} from "./kosik-checkout-jadro.js?v=k2";

var ENDPOINT = "https://uhmrpfsdcujbhbtumqye.supabase.co/functions/v1/kosik-checkout";
var ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVobXJwZnNkY3VqYmhidHVtcXllIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI0MDA5ODgsImV4cCI6MjA5Nzk3Njk4OH0.6d7mDJtzPvdXxvFQEd6xL9n1ph6PYTrJiyDYOjlYYts";

var skript = document.querySelector('script[src*="kosik-checkout.js"]');
var zapnuto = !!(skript && skript.getAttribute("data-kosik-zapnuto") === "true");
window.MBKosik = { prevezme: maSePrepnout(zapnuto), verze: "k1" };
if (!window.MBKosik.prevezme) {
  // Flag vypnuty: zadny posluchac, nakup jede puvodnim odkazem.
} else {
  var otevreny = null;

  function zavri() {
    if (!otevreny) return;
    otevreny.remove();
    otevreny = null;
    document.body.style.overflow = "";
  }

  function jdi(href) {
    zavri();
    location.href = href;
  }

  function odkazSReferralem(href) {
    var info = null;
    try {
      if (window.MBReferral && window.MBReferral.info) info = window.MBReferral.info(href);
    } catch (e) {
      info = null;
    }
    return obohatOdkaz(href, info);
  }

  function otevri(a) {
    var href = odkazSReferralem(a.getAttribute("href") || a.href);
    var klic = a.getAttribute("data-kosik") || "";
    if (!klic || !href) return;
    zavri();
    var css = "#mb-kosik-ov{position:fixed;inset:0;z-index:100000;background:rgba(8,6,4,.72);display:flex;align-items:center;justify-content:center;padding:18px;font-family:Poppins,Arial,sans-serif}"
      + "#mb-kosik-ov .bx{background:#181520;color:#F0EADF;border:1px solid rgba(235,177,44,.45);border-radius:18px;max-width:440px;width:100%;padding:22px;box-shadow:0 20px 60px rgba(0,0,0,.55)}"
      + "#mb-kosik-ov h2{margin:0 0 8px;color:#fff;font-size:1.2rem}"
      + "#mb-kosik-ov p{margin:0 0 12px;color:#cabfb4;font-size:.9rem;line-height:1.5}"
      + "#mb-kosik-ov label.em{display:block;font-size:.82rem;color:#F0EADF;margin-bottom:6px}"
      + "#mb-kosik-ov input[type=email]{width:100%;background:#221c28;border:1px solid rgba(255,255,255,.2);border-radius:11px;padding:12px 13px;color:#F0EADF;font:inherit;font-size:1rem;box-sizing:border-box}"
      + "#mb-kosik-ov .row{display:flex;gap:10px;align-items:flex-start;margin:14px 0 6px}"
      + "#mb-kosik-ov .row input{margin-top:4px;width:18px;height:18px;flex:none}"
      + "#mb-kosik-ov .row span{font-size:.88rem;line-height:1.45;color:#F0EADF}"
      + "#mb-kosik-ov .row a{color:#F6CD63}"
      + "#mb-kosik-ov .go{width:100%;margin-top:12px;cursor:pointer;border:none;font:inherit;font-weight:800;font-size:1rem;padding:13px;border-radius:50px;background:#EBB12C;color:#1A1222}"
      + "#mb-kosik-ov .skip{display:block;width:100%;margin-top:10px;cursor:pointer;background:none;border:none;color:#cabfb4;font:inherit;font-size:.85rem;text-decoration:underline}"
      + "#mb-kosik-ov .err{color:#ffb4a2;font-size:.82rem;min-height:1.2em;margin-top:6px}"
      + "#mb-kosik-ov .hp{position:absolute;left:-9999px;width:1px;height:1px;opacity:0}";
    var st = document.createElement("style");
    st.textContent = css;
    var ov = document.createElement("div");
    ov.id = "mb-kosik-ov";
    ov.innerHTML = '<div class="bx" role="dialog" aria-modal="true" aria-labelledby="mb-kosik-h">'
      + "<h2 id=\"mb-kosik-h\">Kam ti máme poslat potvrzení?</h2>"
      + '<label class="em" for="mb-kosik-em">E-mail</label>'
      + '<input type="email" id="mb-kosik-em" autocomplete="email" required>'
      + '<input type="text" id="mb-kosik-hp" class="hp" tabindex="-1" autocomplete="off" aria-hidden="true">'
      + '<label class="row"><input type="checkbox" id="mb-kosik-souhlas"><span>'
      + SOUHLAS_LABEL
      + ' <a href="https://martinbarna.cz/zasady-ochrany-osobnich-udaju/">Zásady ochrany osobních údajů</a></span></label>'
      + "<p>" + DROBNY_TEXT + "</p>"
      + '<div class="err" id="mb-kosik-err"></div>'
      + '<button type="button" class="go" id="mb-kosik-go">Pokračovat k platbě →</button>'
      + '<button type="button" class="skip" id="mb-kosik-skip">Pokračovat bez e-mailu</button>'
      + "</div>";
    document.head.appendChild(st);
    document.body.appendChild(ov);
    document.body.style.overflow = "hidden";
    otevreny = ov;
    var em = ov.querySelector("#mb-kosik-em");
    var err = ov.querySelector("#mb-kosik-err");
    var go = ov.querySelector("#mb-kosik-go");
    var box = ov.querySelector("#mb-kosik-souhlas");
    em.focus();

    ov.addEventListener("click", function (e) { if (e.target === ov) zavri(); });
    ov.querySelector("#mb-kosik-skip").addEventListener("click", function () { jdi(href); });
    document.addEventListener("keydown", function esc(e) {
      if (e.key === "Escape") { zavri(); document.removeEventListener("keydown", esc); }
    });

    go.addEventListener("click", function () {
      var email = (em.value || "").trim().toLowerCase();
      if (!platnyEmail(email)) { err.textContent = "Zadej prosím platný e-mail."; return; }
      err.textContent = "";
      go.disabled = true;
      var telo = sestavTelo({
        klic: klic,
        email: email,
        souhlas: box.checked === true,
        href: href,
        cesta: location.pathname || "/",
        website: (ov.querySelector("#mb-kosik-hp").value || ""),
      });
      fetch(ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: ANON,
          Authorization: "Bearer " + ANON,
        },
        body: JSON.stringify(telo),
      }).then(function (r) { return r.json().catch(function () { return {}; }); })
        .then(function (data) { jdi(kamDal(data, href).href); })
        .catch(function () { jdi(href); });
    });
  }

  document.addEventListener("click", function (ev) {
    var t = ev.target;
    var a = t && t.closest ? t.closest("a[data-kosik]") : null;
    if (!a) return;
    if (!a.getAttribute("data-kosik")) return;
    ev.preventDefault();
    otevri(a);
  }, true);
}
