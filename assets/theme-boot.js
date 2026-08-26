/* Veřejný web: FOUC pojistka světlého režimu.
   Klíč localStorage: mb-theme ('light' | 'dark'). Default: dark.
   Načti v <head> SYNCHRONNĚ (bez defer/async), PŘED prvním CSS. */
(function () {
  var light = false;
  try {
    light = localStorage.getItem("mb-theme") === "light";
    if (light) {
      document.documentElement.setAttribute("data-theme", "light");
      document.documentElement.style.colorScheme = "light";
    } else {
      document.documentElement.style.colorScheme = "dark";
    }
  } catch (e) {}
  function paintChrome() {
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      if (!meta.getAttribute("data-theme-color-dark")) {
        meta.setAttribute("data-theme-color-dark", meta.getAttribute("content") || "#0C0B10");
      }
      meta.setAttribute("content", light ? "#F7F3EB" : meta.getAttribute("data-theme-color-dark"));
    }
    var cs = document.querySelector('meta[name="color-scheme"]');
    if (cs) cs.setAttribute("content", light ? "light" : "dark");
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", paintChrome);
  else paintChrome();
})();
