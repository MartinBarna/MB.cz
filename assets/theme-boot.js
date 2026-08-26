/* Veřejný web: FOUC pojistka světlého režimu.
   Klíč localStorage: mb-theme ('light' | 'dark'). Default: dark.
   Načti v <head> SYNCHRONNĚ (bez defer/async), PŘED prvním CSS. */
(function () {
  try {
    if (localStorage.getItem("mb-theme") === "light") {
      document.documentElement.setAttribute("data-theme", "light");
      document.documentElement.style.colorScheme = "light";
    } else {
      document.documentElement.style.colorScheme = "dark";
    }
  } catch (e) {}
})();
