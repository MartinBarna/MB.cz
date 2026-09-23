// Generuje SQL migraci šablon: ceny natvrdo -> proměnné (23. 9. 2026, větev fix/ceny-v-mailech-0923).
// POUŽITÍ (když zámek migrace spadne, protože někdo šablony mezitím upravil):
//   1) stáhni aktuální stav (jen SELECT):
//      select track, step, key, subject, preheader, blocks, wait_days, updated_at,
//             md5(blocks::text) as blocks_md5 from email_templates order by track, step;
//      npx supabase@latest db query --linked --project-ref uhmrpfsdcujbhbtumqye --output-format json --file dotaz.sql > dump.raw
//      (z výstupu vezmi pole "rows" a ulož ho jako dump.json)
//   2) node akademie/_supabase/ceny-sablony-generator.cjs dump.json <vystupni-slozka>
//   3) zkontroluj prehled.md, pusť sablony-nanecisto.sql, pak teprve sablony.sql.
// Skript sám ověří NEUTRALITU: dosazení dnešních cen do nového textu musí vrátit přesně starý.
const fs = require("fs");
const crypto = require("crypto");
const VSTUP = process.argv[2] || __dirname + "/et.json";
const VYSTUP = (process.argv[3] || __dirname) + "/";
const rows = JSON.parse(fs.readFileSync(VSTUP, "utf8"));

// Dnešní ceny (ověřeno: pricing_plans živě, Stripe odkazy v komentářích webhooku, web JSON-LD).
const DNES = {
  cena_basic_mesic: "249", cena_basic_rok: "2 490", cena_vip_mesic: "499", cena_vip_rok: "4 990",
  cena_academy: "8 900", cena_academy_mesic: "990", cena_academy_upgrade: "7 410",
  cena_academy_po_odectu: "5 930", cena_academy_3_mesice: "2 970", cena_konzultace: "2 990",
  cena_konzultace_sleva: "2 190", cena_balicek: "349", cena_doplatek_videokurz: "1 140",
};
// Pořadí: delší čísla první. Lookbehind: číslo nesmí být konec většího čísla („2 990" není „990").
// Lookahead: za číslem musí být „ Kč" (mezera, nbsp nebo &nbsp;).
const PRAVIDLA = [
  ["8 900", "cena_academy"], ["7 410", "cena_academy_upgrade"], ["5 930", "cena_academy_po_odectu"],
  ["2 970", "cena_academy_3_mesice"], ["2 990", "cena_konzultace"], ["2 190", "cena_konzultace_sleva"],
  ["1 140", "cena_doplatek_videokurz"], ["4 990", "cena_vip_rok"], ["2 490", "cena_basic_rok"],
  ["990", "cena_academy_mesic"], ["499", "cena_vip_mesic"], ["349", "cena_balicek"], ["249", "cena_basic_mesic"],
];
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
function nahrad(s) {
  if (!s) return s;
  // Jediná cena BEZ „Kč": preheader onb-vk-konzultace „za 2 190 místo 2 990."
  s = s.replace(/(?<!\d[  ]?)2 190 místo 2 990(?![  ]?\d)/g, "{{cena_konzultace_sleva}} místo {{cena_konzultace}}");
  for (const [cislo, prom] of PRAVIDLA) {
    const re = new RegExp("(?<!\\d[ \\u00a0]?)" + esc(cislo) + "(?=(?:[ \\u00a0]|&nbsp;)Kč)", "g");
    s = s.replace(re, "{{" + prom + "}}");
  }
  return s;
}
// ⛔ [R2, rozhodnutí šéfa po revizi R1, N1 a N2] V těchto šablonách cena NEBUDE VŮBEC,
//    ani jako proměnná. Doručovací maily (slíbený plán z kvízu, startovací kit pro trenéra)
//    a mail opuštěného košíku (volá ho SQL `tc_kosik_zapis`, která odpověď nečte) nesmí
//    stát na tom, jestli se zrovna načte ceník. Věta se přepíše BEZ částky.
//    Přesné staré znění: když ho mezitím někdo změní, skript SPADNE (nic se nehádá).
//    Kontrola neutrality pak porovnává s textem PO téhle úpravě.
const KVIZ_STARE = "<strong>Basic stojí 249 Kč měsíčně</strong> a k první platbě ti navíc otevřu celý svůj videokurz výživy (182 videí, hodnota {{course_price}} Kč), který ti zůstane";
const KVIZ_NOVE = "K první platbě za <strong>Basic</strong> ti navíc otevřu celý svůj videokurz výživy (182 videí), který ti zůstane";
const TEXTY_BEZ_CENY = {
  "kviz-data/0": [[KVIZ_STARE, KVIZ_NOVE]],
  "kviz-pohyb/0": [[KVIZ_STARE, KVIZ_NOVE]],
  "kviz-vecer/0": [[KVIZ_STARE, KVIZ_NOVE]],
  "kviz-vikend/0": [[KVIZ_STARE, KVIZ_NOVE]],
  "trener-kit/0": [
    ["týdenní check-in a přepočet cílů je pak v Basicu za 249 Kč měsíčně:", "týdenní check-in a přepočet cílů je pak v Basicu, nejlevnějším placeném plánu:"],
    ["(182 videí, hodnota {{course_price}} Kč)", "(182 videí)"],
  ],
  "tc-kosik/0": [["<strong>Basic stojí 249 Kč měsíčně</strong> a odemyká", "<strong>Basic je nejlevnější placený plán</strong> a odemyká"]],
};
function upravText(klic, s, pouzito) {
  if (!s || !TEXTY_BEZ_CENY[klic]) return s;
  for (const [stare, nove] of TEXTY_BEZ_CENY[klic]) {
    const n = s.split(stare).length - 1;
    if (n > 0) { s = s.split(stare).join(nove); pouzito.set(stare, (pouzito.get(stare) || 0) + n); }
  }
  return s;
}
const vypln = (s) => (s || "").replace(/\{\{(cena_[a-z0-9_]+)\}\}/g, (m, k) => (k in DNES ? DNES[k] : m));

const zmeny = [];
for (const r of rows) {
  const blocks = typeof r.blocks === "string" ? JSON.parse(r.blocks) : r.blocks;
  const nove = JSON.parse(JSON.stringify(blocks));
  const vety = [];
  const pole = (stare, nove_, kde) => { if (stare !== nove_) vety.push({ kde, pred: stare, po: nove_ }); return nove_; };
  const klic = r.track + "/" + r.step;
  const pouzito = new Map();
  const uprav = (s) => upravText(klic, s, pouzito);
  // Očekávaný text = původní text s vědomými úpravami bez ceny (jen u šablon z TEXTY_BEZ_CENY).
  const ocek = { subject: uprav(r.subject), preheader: uprav(r.preheader), blocks: JSON.parse(JSON.stringify(blocks)) };
  const subject = pole(r.subject, nahrad(ocek.subject), "subject");
  const preheader = pole(r.preheader, nahrad(ocek.preheader), "preheader");
  nove.forEach((b, i) => {
    // ⛔ href a src se NEMĚNÍ: „utm_content=basic-249" je štítek kampaně, ne cena.
    const bo = ocek.blocks[i];
    for (const k of ["html", "text", "alt"]) if (typeof b[k] === "string") { bo[k] = uprav(b[k]); b[k] = pole(b[k], nahrad(bo[k]), `b${i}.${b.t}.${k}`); }
    if (Array.isArray(b.items)) { bo.items = b.items.map(uprav); b.items = b.items.map((it, j) => pole(it, nahrad(bo.items[j]), `b${i}.bullets[${j}]`)); }
  });
  if (TEXTY_BEZ_CENY[klic]) {
    for (const [stare] of TEXTY_BEZ_CENY[klic]) if (!pouzito.get(stare)) throw new Error("TEXT SE ZMENIL, uprava bez ceny nesedi: " + klic + " :: " + stare.slice(0, 60));
    const vse = subject + preheader + JSON.stringify(nove);
    if (/\{\{(cena_|course_price|discount)/.test(vse)) throw new Error("Sablona bez ceny ma porad cenovou promennou: " + klic);
  }
  if (!vety.length) continue;
  // NEUTRALITA: dosazení dnešních cen musí vrátit PŘESNĚ očekávaný text (= původní, u šablon
  // z TEXTY_BEZ_CENY původní s vědomou úpravou věty).
  const zpet = { subject: vypln(subject), preheader: vypln(preheader), blocks: JSON.parse(vypln(JSON.stringify(nove))) };
  const neutralni = zpet.subject === ocek.subject && zpet.preheader === ocek.preheader && JSON.stringify(zpet.blocks) === JSON.stringify(ocek.blocks);
  if (!neutralni) throw new Error("NENI NEUTRALNI: " + r.track + "/" + r.step);
  zmeny.push({ track: r.track, step: r.step, key: r.key, blocks_md5: r.blocks_md5,
    subject_md5: crypto.createHash("md5").update(r.subject, "utf8").digest("hex"),
    preheader_md5: crypto.createHash("md5").update(r.preheader || "", "utf8").digest("hex"),
    subject, preheader, blocks: nove, vety });
}

// Kontrola zbytků: co číslem v Kč zůstalo v CELÉ tabulce po nahrazení (mají to být jen ne-ceny).
const zbytky = {};
for (const r of rows) {
  const z = zmeny.find((x) => x.track === r.track && x.step === r.step);
  const text = z ? z.subject + " " + z.preheader + " " + JSON.stringify(z.blocks) : r.subject + " " + r.preheader + " " + JSON.stringify(r.blocks);
  for (const m of text.matchAll(/(?<!\d[  ]?)(\d{1,3}(?:[  ]\d{3})*)(?=(?:[  ]|&nbsp;)Kč)/g)) {
    const k = m[1];
    (zbytky[k] = zbytky[k] || new Set()).add(r.track + "/" + r.step);
  }
}
const pocetVyskytu = zmeny.reduce((a, z) => a + z.vety.reduce((b, v) => b + (v.po.match(/\{\{cena_/g) || []).length - (v.pred.match(/\{\{cena_/g) || []).length, 0), 0);
console.log("zmenenych sablon:", zmeny.length, "nahrazenych cen:", pocetVyskytu);
console.log("zbytky Kč:", Object.fromEntries(Object.entries(zbytky).map(([k, v]) => [k, [...v]])));
fs.writeFileSync(VYSTUP + "zmeny.json", JSON.stringify(zmeny, null, 1));

// ---- SQL ----
const q = (s) => "$q$" + s + "$q$";
if (zmeny.some((z) => (z.subject + z.preheader + JSON.stringify(z.blocks)).includes("$q$"))) throw new Error("$q$ v textu");
const values = zmeny.map((z) =>
  `    (${q(z.track)}, ${z.step}, ${q(z.key)}, '${z.blocks_md5}', '${z.subject_md5}', '${z.preheader_md5}',\n     ${q(z.subject)},\n     ${q(z.preheader)},\n     ${q(JSON.stringify(z.blocks))}::jsonb)`).join(",\n");
const N = zmeny.length;
function sql(nanecisto) {
  return `-- ============================================================================
-- CENY V MAILOVÝCH ŠABLONÁCH -> PROMĚNNÉ (23. 9. 2026, větev fix/ceny-v-mailech-0923)
-- Projekt: Academy uhmrpfsdcujbhbtumqye, tabulka public.email_templates.
-- Vygenerováno skriptem nad SELECTem živé tabulky (R2, 23. 9. 2026 večer).
-- [R2] kviz-*/0, trener-kit/0 a tc-kosik/0: věta s cenou přepsaná BEZ částky (doručení nečeká na ceník).
-- ============================================================================
-- ⛔ POŘADÍ NASAZENÍ (BUILD-ceny-v-mailech.md): 1) ceny-app-config-2026-09-23.sql,
--    2) deploy drip-send, admin-api, milestones, order-rescue, 3) TENHLE soubor.
--    Obráceně by milestones a order-rescue poslaly zákazníkovi doslova „{{cena_...}} Kč"
--    (staré verze nevyplněnou proměnnou nekontrolují) a drip-send by maily zaparkoval.
-- ⛔ OPTIMISTICKÝ ZÁMEK: řádek se změní JEN když blocks, subject i preheader jsou přesně
--    ve stavu z generování (md5). Když ho mezitím někdo upravil, počet nesedí a CELÉ se to vrátí.
-- ⛔ Záloha celé tabulky vzniká ve stejné transakci, s RLS a bez práv pro anon/authenticated.
-- Ověření neutrality (mimo SQL, skript): dosazení dnešních cen do nových textů vrací
-- PŘESNĚ původní texty (u šesti šablon výše původní s přepsanou větou bez částky).
-- ============================================================================
${nanecisto ? "-- !!! NANEČISTO: na konci vyhodí výjimku, takže se NIC nezapíše (ani záloha).\n" : ""}begin;
do $mig$
declare
  nanecisto constant boolean := ${nanecisto ? "true" : "false"};
  ocekavano constant int := ${N};
  n int;
  zbyva int;
  bez_ceny int;
begin
  create table public.zaloha_email_templates_ceny_20260923 as select * from public.email_templates;
  alter table public.zaloha_email_templates_ceny_20260923 enable row level security;
  revoke all on public.zaloha_email_templates_ceny_20260923 from anon, authenticated;

  update public.email_templates t
     set subject = z.novy_subject, preheader = z.novy_preheader, blocks = z.nove_blocks, updated_at = now()
    from (values
${values}
    ) as z(track, step, key, blocks_md5, subject_md5, preheader_md5, novy_subject, novy_preheader, nove_blocks)
   where t.track = z.track and t.step = z.step and t.key = z.key
     and md5(t.blocks::text) = z.blocks_md5
     and md5(t.subject) = z.subject_md5
     and md5(t.preheader) = z.preheader_md5;
  get diagnostics n = row_count;
  if n <> ocekavano then
    raise exception 'ZAMEK: ocekavano % sablon, zmeneno %. Nekdo sablony mezitim upravil, vygeneruj migraci znovu.', ocekavano, n;
  end if;

  -- Po nahrazení nesmí v CELÉ tabulce zůstat žádná z nahrazovaných cen číslem.
  select count(*) into zbyva from public.email_templates
   where (subject || ' ' || preheader || ' ' || blocks::text)
         ~ '(8 900|7 410|5 930|2 970|2 990|2 190|1 140|4 990|2 490) Kč|(^|[^0-9 ]|[^0-9] )(990|499|349|249) Kč';
  if zbyva <> 0 then
    raise exception 'ZBYTKY: % sablon ma porad cenu cislem', zbyva;
  end if;

  -- [R2] Doručovací maily a košík nesmí nést ŽÁDNOU cenovou proměnnou (nesmí čekat na ceník).
  select count(*) into bez_ceny from public.email_templates
   where (track, step) in (('kviz-data',0),('kviz-pohyb',0),('kviz-vecer',0),('kviz-vikend',0),('trener-kit',0),('tc-kosik',0))
     and (subject || ' ' || preheader || ' ' || blocks::text) ~ '[{][{](cena_|course_price|discount)';
  if bez_ceny <> 0 then
    raise exception 'DORUCOVACI: % sablon ma porad cenovou promennou', bez_ceny;
  end if;

  select count(*) into bez_ceny from public.zaloha_email_templates_ceny_20260923;
  if nanecisto then
    raise exception 'NANECISTO OK: zmeneno % z % sablon, zbytky %, zaloha by mela % radku. Vse vraceno.', n, ocekavano, zbyva, bez_ceny;
  end if;
  raise notice 'HOTOVO: zmeneno % sablon, zaloha zaloha_email_templates_ceny_20260923 (% radku)', n, bez_ceny;
end
$mig$;
${nanecisto ? "rollback;" : "commit;"}
`;
}
fs.writeFileSync(VYSTUP + "sablony.sql", sql(false));
fs.writeFileSync(VYSTUP + "sablony-nanecisto.sql", sql(true));

// ---- přehled před/po ----
const md = zmeny.map((z) => `### ${z.track}/${z.step} \`${z.key}\`\n` + z.vety.map((v) =>
  `- ${v.kde}\n  - před: ${v.pred.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim()}\n  - po: ${v.po.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim()}`).join("\n")).join("\n\n");
fs.writeFileSync(VYSTUP + "prehled.md", md);
