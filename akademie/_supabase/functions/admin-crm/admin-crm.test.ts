// Staticka kontrola admin-crm (read-only CRM prohlizec).
// Spusteni:
//   npx --yes deno@2 run --allow-read akademie/_supabase/functions/admin-crm/admin-crm.test.ts
const KOREN = new URL("../../../../", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const FN = KOREN + "akademie/_supabase/functions/admin-crm/index.ts";
const HTML = KOREN + "akademie/admin/crm/index.html";
const PULSE = KOREN + "akademie/_supabase/functions/admin-pulse/index.ts";
const ADMIN = KOREN + "akademie/admin/index.html";

const fn = await Deno.readTextFile(FN);
const html = await Deno.readTextFile(HTML);
const pulse = await Deno.readTextFile(PULSE);
const admin = await Deno.readTextFile(ADMIN);

type Kontrola = { name: string; pass: boolean; detail: string };
const cases: Kontrola[] = [];
const check = (name: string, pass: boolean, detail = "") => cases.push({ name, pass, detail });

check("A1 funkce overuje user JWT pres getUser", /auth\.getUser\(\)/.test(fn), "");
check("A2 funkce cte allowlist admin_emails", /admin_emails/.test(fn), "");
check("A3 zakaz bez admina je 403 forbidden", /error:\s*"forbidden"/.test(fn) && /403/.test(fn), "");
check("A4 auth je stejny vzor jako admin-pulse (getUser + admin_emails)",
  pulse.includes("admin_emails") && pulse.includes("getUser()"), "");
check("A5 zadny .insert / .update / .upsert / .delete",
  !/\.(insert|update|upsert|delete)\s*\(/.test(fn), "");
check("A6 cte crm_person_card", /crm_person_card/.test(fn), "");
check("A7 cte crm_import_kp2026", /crm_import_kp2026/.test(fn), "");
check("A8 cte crm_identifiers", /crm_identifiers/.test(fn), "");
check("A9 cte emaily_dalsi", /emaily_dalsi/.test(fn), "");
check("A10 akce list a card", /action === "list"/.test(fn) && /action === "card"/.test(fn), "");
check("A11 strankovani fetchAllRows (strop 1000)", /fetchAllRows/.test(fn) && /STEP = 1000/.test(fn), "");

check("H1 HTML vola admin-crm, ne admin-api", /functions\/v1\/admin-crm/.test(html), "");
check("H2 zadny service_role / service-role na klientu",
  !/service[_-]?role/i.test(html), "");
check("H3 token ze session pred kazdym volanim (cerstvyToken)", /cerstvyToken/.test(html), "");
check("H4 opakovani pri 401\/403", /status!==401&&o.status!==403/.test(html) || /refreshSession/.test(html), "");
check("H5 noindex", /noindex/.test(html), "");
check("H6 hledani jmena\/e-mailu", /Hledat jméno nebo e-mail/.test(html), "");
check("H7 razeni podle utracy", /data-sort="soucet_kc"/.test(html), "");
check("H8 karta ukazuje emaily_dalsi, utratu, obdobi, poznamky, tagy",
  /emaily_dalsi/.test(html) && /Útrata/.test(html) && /Poznámky/.test(html) && /Tagy/.test(html), "");
check("H9 zadna dlouha pomlcka U+2014", !html.includes("\u2014"), "");
check("H10 hlavni admin odkazuje na CRM stranku", /\/akademie\/admin\/crm\//.test(admin), "");

const listBlok = fn.slice(fn.indexOf('action === "list"'), fn.indexOf('action === "card"'));
const cardBlok = fn.slice(fn.indexOf('action === "card"'));
check("V1 list paruje jen person_id a primarni email, ne extra",
  /cardByEmail\.has\(email\)/.test(listBlok) && !/for \(const e of extra\)/.test(listBlok) &&
  !/cardByEmail\.has\(e\)/.test(listBlok), "");
check("V1 card neparuje pres emaily_dalsi",
  /primaryEmail/.test(cardBlok) && !/emailsToMatch/.test(cardBlok) &&
  !/emailsFrom\(imp\.emaily_dalsi\)/.test(cardBlok), "");
check("S1 zadny ilike (podtrzitko v adrese neni wildcard)", !/\.ilike\(/.test(fn), "");
check("S1 import podle person_id pres limit(1), ne maybeSingle",
  /\.eq\("person_id", pid\)\.order\("id"\)/.test(fn) && firstRowUsesLimit(fn), "");
check("S1 import podle emailu pres eq po lower, ne ilike",
  /\.eq\("email", low\(card\.primary_email\)\)/.test(fn), "");
check("S2 list cte crm_persons a crm_tags, ne pohled",
  /crm_persons/.test(listBlok) && /crm_tags/.test(listBlok) &&
  !/\.from\("crm_person_card"\)/.test(listBlok), "");
check("S2 plny pohled jen na action=card", /crm_person_card/.test(cardBlok), "");
check("N2 dedup e-mailu na karte je case-insensitive",
  /function pushMail\(arr,e\)/.test(html) && /toLowerCase\(\)===k/.test(html), "");
check("N3 atribut false\/0 se neztrati",
  /v===false/.test(html) && /v===true/.test(html) && /String\(v\)/.test(html) &&
  !/String\(v\|\|''\)/.test(html), "");
check("N5 chyba 500 ukaze detail",
  /o\.status===500/.test(html) && /o\.j\.detail/.test(html), "");

function firstRowUsesLimit(src: string) {
  return /async function firstRow[\s\S]*?\.limit\(1\)/.test(src) &&
    /imp = await firstRow\(/.test(src);
}

let fail = 0;
for (const c of cases) {
  const mark = c.pass ? "OK  " : "FAIL";
  if (!c.pass) fail++;
  console.log(mark, c.name, c.detail);
}
console.log(fail === 0 ? `PASS ${cases.length}/${cases.length}` : `FAIL ${fail}/${cases.length}`);
if (fail) Deno.exit(1);
