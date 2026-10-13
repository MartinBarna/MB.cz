/* Klientska sekce CZ/EN. node akademie/klient/klient-en.test.js
   (a) ceske retezce z git HEAD jsou ve strance porad
   (b) EN rozhrani nema cestinu (jmena a hodnoty v data-v / data-user zustavaji)
   (c) report payload je stejny v CZ i EN */
"use strict";
var fs = require("fs");
var vm = require("vm");
var path = require("path");
var cp = require("child_process");
var assert = require("assert");

var dir = __dirname;
var root = path.resolve(dir, "..", "..");
var DIA = /[áčďéěíňóřšťúůýžÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ]/;
function uiDia(s) { return DIA.test(String(s).replace(/Tvůj/g, "Tvuj")); }
var EM = /\u2014/;
var fail = [];
function check(name, cond, extra) {
  if (!cond) fail.push(name + (extra ? " :: " + String(extra).slice(0, 240) : ""));
}

function stripComments(src) {
  var noBlock = src.replace(/\/\*[\s\S]*?\*\//g, "");
  return noBlock.split("\n").map(function (line) {
    var out = "";
    var q = null;
    for (var i = 0; i < line.length; i++) {
      var c = line[i];
      if (q) {
        out += c;
        if (c === "\\") { out += line[++i] || ""; continue; }
        if (c === q) q = null;
        continue;
      }
      if (c === "\"" || c === "'") { q = c; out += c; continue; }
      if (c === "/" && line[i + 1] === "/") break;
      out += c;
    }
    return out;
  }).join("\n");
}

function literals(src) {
  var out = [];
  src.split("\n").forEach(function (line) {
    var q = null;
    var buf = "";
    var raw = "";
    for (var i = 0; i < line.length; i++) {
      var c = line[i];
      if (q) {
        if (c === "\\") {
          var n = line[++i] || "";
          raw += "\\" + n;
          if (n === "n") buf += "\n";
          else if (n === "t") buf += "\t";
          else buf += n;
          continue;
        }
        if (c === q) {
          out.push({ s: buf, raw: raw, line: line });
          q = null;
          buf = "";
          raw = "";
          continue;
        }
        buf += c;
        raw += c;
        continue;
      }
      if (c === "/" && line[i + 1] === "/") break;
      if (c === "\"" || c === "'") { q = c; buf = ""; raw = ""; }
    }
  });
  return out;
}

var page = fs.readFileSync(path.join(dir, "index.html"), "utf8");
var i18nSrc = fs.readFileSync(path.join(dir, "klient-i18n.js"), "utf8");
var ctx = {};
ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(i18nSrc, ctx);
var I = ctx.KLIENT_I18N;

var head = cp.execSync("git show HEAD:akademie/klient/index.html", { cwd: root, encoding: "utf8" });
var headLit = literals(head);
var seenA = Object.create(null);
headLit.forEach(function (item) {
  if (!DIA.test(item.s) || seenA[item.s]) return;
  seenA[item.s] = 1;
  check("HEAD literal missing", page.indexOf(item.raw) >= 0, item.raw);
});
var headBody = head.split("<script")[0];
headBody.split(/<[^>]+>/).forEach(function (part) {
  var t = part.replace(/\s+/g, " ").trim();
  if (!DIA.test(t)) return;
  check("HEAD text missing", page.indexOf(t) >= 0, t);
});

var SKIP = {
  "zdeněk": 1, "Zdeňku": 1, "zbyněk": 1, "Zbyňku": 1, "luboš": 1, "Luboši": 1,
  "bartoloměj": 1, "Bartoloměji": 1, "vavřinec": 1, "Vavřinče": 1, "Vavrinče": 1,
  "němec": 1, "Němče": 1, "rút": 1, "ráchel": 1, "kristýn": 1, "žaneta": 1,
  "aeiouyáéěíóúůý": 1, "šžčř": 1, "ře": 1,
  "bílkovin": 1, "vláknin": 1
};

function partsOf(html) {
  return html.split(/<[^>]+>/).map(function (p) { return p.replace(/\s+/g, " ").trim(); }).filter(Boolean);
}

var lits = literals(page);
var seenB = Object.create(null);
lits.forEach(function (item) {
  var s = item.s;
  if (!DIA.test(s) || seenB[s] || SKIP[s]) return;
  seenB[s] = 1;
  var fragment = item.line.indexOf("+") >= 0;
  I.setLang("en");
  if (s.indexOf("<") >= 0) {
    var htmlOut = I.trHtml(s);
    partsOf(htmlOut).forEach(function (p) {
      if (!uiDia(p)) return;
      if (p.indexOf("data-user") >= 0) return;
      check("EN html", false, p);
    });
    return;
  }
  var out = I.trText(s);
  if (!uiDia(out)) return;
  if (fragment) return;
  check("EN literal", false, s + " => " + out);
});

var body = page.split("<script")[0];
body.split(/<[^>]+>/).forEach(function (part) {
  var t = part.replace(/\s+/g, " ").trim();
  if (!DIA.test(t)) return;
  I.setLang("en");
  var out = I.trText(t);
  check("EN static", !uiDia(out), t + " => " + out);
});

I.setLang("en");
I.enSamples().forEach(function (s) { check("enSamples", !uiDia(String(s)), s); });
I.phraseKeys().forEach(function (k) {
  var en = I.trText(k);
  check("phrase en", !uiDia(en) || SKIP[k], k + " => " + en);
});

["V exportu není žádný zapsaný den z tvého období (Oct 5 to Oct 11, 2026). V Kalorických tabulkách vyber tyhle dny a stáhni export znovu.",
  "✅ Načteno 5 dní z tvého období, 2 dny mimo období jsem vynechal. Zkontroluj čísla a pokračuj.",
  "✅ Načteno 1 den z tvého období. Zkontroluj čísla a pokračuj.",
  "✅ Načteno 7 dní z Kalorických tabulek, zkontroluj čísla a pokračuj.",
  "Poslední report: Oct 13, 2026. Kopie přijde tobě i Martinovi.",
  "Zadal Martin Oct 13, 2026. Co k tomu potřebuješ probrat, napiš do reportu.",
  "Your period: Oct 5 to Oct 11, 2026 (21 dní).",
  "1800 kcal · cíl 1,800 (přesně)",
  "80 g (cíl teď 150)"
].forEach(function (s) {
  var out = I.trText(s);
  check("runtime", !uiDia(out), s + " => " + out);
});

var chip = I.trHtml('<button type="button" data-v="Fitko">Fitko</button>');
check("data-v Fitko", chip.indexOf('data-v="Fitko"') >= 0, chip);
check("chip label", chip.indexOf(">Gym<") >= 0, chip);
var ta = I.trHtml('<textarea placeholder="např. 71,3">chci zhubnout 8 kg</textarea>');
check("placeholder", ta.indexOf("e.g. 71.3") >= 0, ta);
check("textarea keeps words", ta.indexOf("chci zhubnout 8 kg") >= 0, ta);
var note = I.trHtml('<p>Cíl <span data-user="1">Váha a bílkoviny</span></p>');
check("data-user", note.indexOf("Váha a bílkoviny") >= 0 && note.indexOf("Goal") >= 0 && note.indexOf(">Váha a bílkoviny<") >= 0, note);

I.setLang("cs");
check("cs identity", I.trText("Ahoj, Hano!") === "Ahoj, Hano!" && I.trHtml("<b>Váha</b>") === "<b>Váha</b>");
check("day cs", I.dayLabel("Po") === "Po" && I.dayLabel("Út") === "Út");
I.setLang("en");
check("day en", I.dayLabel("Po") === "Mon" && I.dayLabel("Út") === "Tue" && I.dayLabel("Ne") === "Sun");
check("lang exact", I.resolveLang(null) === "cs" && I.resolveLang({}) === "cs" && I.resolveLang({ jazyk: "EN" }) === "cs" && I.resolveLang({ jazyk: "En" }) === "cs" && I.resolveLang({ jazyk: "en" }) === "en");

var welcome = I.materialView("uvitaci-balicek-v2.pdf");
check("en material", welcome && welcome.page === "/en/materials/uvitaci-balicek/" && welcome.pdf === "/materialy/pdf/en/uvitaci-balicek.pdf", JSON.stringify(welcome));
var sleepPdf = I.materialView("spanek-a-regenerace.pdf");
check("en pdf sleep", sleepPdf && sleepPdf.page === "/en/materials/spanek-a-regenerace/" && sleepPdf.pdf === "/materialy/pdf/en/spanek-a-regenerace.pdf", JSON.stringify(sleepPdf));
var play = I.materialView("eating-out-playbook.pdf");
check("playbook pdf", play && play.pdf === "/download/eating-out-playbook.pdf" && play.page === "/en/materials/eating-out-playbook/", JSON.stringify(play));
check("hide czech only", I.materialView("kucharka.pdf") && I.materialView("kucharka.pdf").hide === true);
check("personal dated stays", I.materialView("pruvodce-2026-10-05.html") === null);
check("unknown personal stays", I.materialView("poznamka-od-martina.pdf") === null);

function payload(lang) {
  I.setLang(lang);
  var a = {
    weight: 71.3,
    measurements: { pas: 80 },
    nutrition: { kcal: 1800, protein: 140, dny: [{ den: "Po", datum: "2026-10-05", kcal: 1900 }] },
    activity: { kroky: 8000 },
    scales: { dodrzeni: 2, unava: 3 },
    notes: { povedlo: "česky text", drhlo: "" },
    plan: { kroky: 9000, stejne: false }
  };
  return I.reportPayload(a, { od: "2026-10-05", "do": "2026-10-11" });
}
var cz = payload("cs");
var en = payload("en");
check("payload equal", JSON.stringify(cz) === JSON.stringify(en), JSON.stringify(cz) + " vs " + JSON.stringify(en));
check("plan_next", en.activity.plan_next && en.activity.plan_next.kroky === 9000);
check("den stays Po", en.nutrition.dny[0].den === "Po");
check("note stays", en.notes.povedlo === "česky text");
check("no obdobi translate", en.obdobi.od === "2026-10-05" && en.obdobi["do"] === "2026-10-11");

check("no emdash i18n", !EM.test(i18nSrc));
check("no emdash page", !EM.test(page));
check("script tag", page.indexOf("/akademie/klient/klient-i18n.js?v=20261013b") >= 0);
check("vyber dny", I.trText("vyber dny") === "select the days");
check("vyber dny veta", !uiDia(I.trText("vyber dny Oct 5 to Oct 11, 2026) nebo screenshot statistik z mobilu.")) && I.trText("vyber dny Oct 5 to Oct 11, 2026) nebo screenshot statistik z mobilu.").indexOf("select the days") === 0, I.trText("vyber dny Oct 5 to Oct 11, 2026) nebo screenshot statistik z mobilu."));
check("ba-academy version", page.indexOf("/assets/ba-academy.js?v=20260728a") >= 0);

var names = cp.execSync("git diff --name-only HEAD", { cwd: root, encoding: "utf8" });
check("ba-academy untouched", names.indexOf("assets/ba-academy.js") < 0, names);
check("ai-martin untouched", names.indexOf("assets/ai-martin.js") < 0, names);

var script = page.split("<script>").pop().split("</script>")[0];
try { new Function(script); check("page script parses", true); }
catch (e) { check("page script parses", false, e.message); }

if (fail.length) {
  console.log("FAIL " + fail.length);
  fail.forEach(function (f) { console.log("- " + f); });
  process.exit(1);
}
console.log("OK klient-en.test.js");
assert.strictEqual(fail.length, 0);
