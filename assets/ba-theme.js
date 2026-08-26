/* Barna Academy: světlý / tmavý režim.
   Klíč localStorage: mb-theme ('light' | 'dark'). Default: dark.
   Načti v <head> SYNCHRONNĚ (bez defer/async), ať se data-theme nastaví
   před prvním vykreslením a nesvítne opačný motiv. */
(function () {
  "use strict";
  var KEY = "mb-theme";

  function read() {
    try {
      var v = localStorage.getItem(KEY);
      return v === "light" ? "light" : "dark";
    } catch (e) {
      return "dark";
    }
  }

  function apply(theme) {
    var root = document.documentElement;
    if (theme === "light") root.setAttribute("data-theme", "light");
    else root.removeAttribute("data-theme");
    try { root.style.colorScheme = theme === "light" ? "light" : "dark"; } catch (e) {}
    var btns = document.querySelectorAll(".mb-theme-toggle");
    for (var i = 0; i < btns.length; i++) {
      btns[i].setAttribute("aria-pressed", theme === "light" ? "true" : "false");
      btns[i].setAttribute(
        "aria-label",
        theme === "light" ? "Zapnout tmavý režim" : "Zapnout světlý režim"
      );
      btns[i].title = theme === "light" ? "Tmavý režim" : "Světlý režim";
    }
  }

  function save(theme) {
    try { localStorage.setItem(KEY, theme); } catch (e) {}
  }

  apply(read());

  var SVG =
    '<svg class="mb-ico-moon" viewBox="0 0 24 24" aria-hidden="true">' +
      '<path d="M21 14.3A8.5 8.5 0 0 1 9.7 3 7 7 0 1 0 21 14.3z"/>' +
    "</svg>" +
    '<svg class="mb-ico-sun" viewBox="0 0 24 24" aria-hidden="true">' +
      '<circle cx="12" cy="12" r="4"/>' +
      '<path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>' +
    "</svg>";

  function makeBtn() {
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "mb-theme-toggle";
    btn.innerHTML = SVG;
    btn.addEventListener("click", function () {
      var next = read() === "light" ? "dark" : "light";
      save(next);
      apply(next);
    });
    return btn;
  }

  function mount() {
    if (document.querySelector(".mb-theme-toggle")) {
      apply(read());
      return;
    }
    var btn = makeBtn();
    var topr = document.querySelector(".ba > .top .topr");
    if (topr) {
      topr.appendChild(btn);
      apply(read());
      return;
    }
    var inn = document.querySelector(".ba > .top .in");
    if (inn) {
      inn.appendChild(btn);
      apply(read());
      return;
    }
    var burger = document.querySelector(".nav .nav-burger");
    if (burger && burger.parentNode) {
      burger.parentNode.insertBefore(btn, burger);
      apply(read());
      return;
    }
    var navWrap = document.querySelector(".nav .wrap");
    if (navWrap) {
      navWrap.appendChild(btn);
      apply(read());
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount);
  } else {
    mount();
  }
})();
