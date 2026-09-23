// Statická kontrola: customer Resend v 9 cestách musí importovat mailing-guard.
// Spuštění: npx --yes deno@2 run --allow-read akademie/_supabase/functions/_shared/resend-call-sites.test.ts
const ROOT = new URL("..", import.meta.url);

const MUST_IMPORT_GUARD = [
  "study-reminder/index.ts",
  "client-remind/index.ts",
  "order-rescue/index.ts",
  "checkin-capture/index.ts",
  "splatky-guard/index.ts",
  "affiliate-mesicni-report/index.ts",
  "poukaz-vydat/index.ts",
  "poukaz-vydat/core.ts",
  "grant-videokurz-z-appky/core.ts",
  "grant-videokurz-z-appky/index.ts",
  "admin-api/index.ts",
  "_shared/koucink-onboarding.ts",
  // Automat „konec koucinku" (22. 9. 2026): posila zakaznikovi tyz mail jako rucni
  // odchod z admina, takze pred nej patri tataz brana.
  "koucink-konec/index.ts",
];

const SCAN_DIRS = [
  "study-reminder",
  "client-remind",
  "order-rescue",
  "checkin-capture",
  "splatky-guard",
  "affiliate-mesicni-report",
  "poukaz-vydat",
  "grant-videokurz-z-appky",
  "admin-api",
  "koucink-konec",
  "_shared",
];

const RESEND = "api.resend.com/emails";
const GUARD_MARK = "mailing-guard";

let selhalo = 0;
function check(nazev: string, podminka: boolean, detail = ""): void {
  if (podminka) console.log("  ok   " + nazev);
  else {
    selhalo++;
    console.log("  FAIL " + nazev + (detail ? "  [" + detail + "]" : ""));
  }
}

/**
 * „`a` stoji v textu PRED `b`" jako jedna kontrola.
 *
 * ⛔⛔ OBA KUSY SE MUSI NAJIT. `indexOf` vraci -1, takze naivni
 *    `text.indexOf(a) < text.indexOf(b)` je PRAVDA i tehdy, kdyz `a` v souboru
 *    UZ VUBEC NENI. Prave to je stav, ktery tyhle kontroly maji chytat: nekdo
 *    tu radku pri refaktoru smaze. Chyceno vlastni mutaci (M22, 22. 9. 2026),
 *    kde smazani deadlinu behu nechalo test zeleny.
 */
function predTim(nazev: string, text: string, a: string, b: string): void {
  const ia = text.indexOf(a);
  const ib = text.indexOf(b);
  check(nazev, ia >= 0 && ib >= 0 && ia < ib, "a@" + ia + " b@" + ib);
}

async function walk(rel: string): Promise<string[]> {
  const out: string[] = [];
  const base = new URL(rel + "/", ROOT);
  for await (const entry of Deno.readDir(base)) {
    const child = rel + "/" + entry.name;
    if (entry.isDirectory) {
      if (entry.name === "node_modules") continue;
      out.push(...await walk(child));
    } else if (entry.name.endsWith(".ts") || entry.name.endsWith(".js")) {
      out.push(child);
    }
  }
  return out;
}

const sites: { file: string; line: number; text: string }[] = [];

console.log("\n== resend-call-sites (9 cest) ==");

for (const rel of MUST_IMPORT_GUARD) {
  const text = await Deno.readTextFile(new URL(rel, ROOT));
  check(rel + " importuje mailing-guard", text.includes(GUARD_MARK));
}

for (const dir of SCAN_DIRS) {
  const files = await walk(dir);
  for (const file of files) {
    if (file.endsWith(".test.ts") || file.includes("/__tests__/")) continue;
    const text = await Deno.readTextFile(new URL(file, ROOT));
    const lines = text.split("\n");
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(RESEND)) {
        sites.push({ file, line: i + 1, text: lines[i].trim() });
      }
    }
  }
}

// ⚠️ ČÍSLO KLESLO Z 9 NA 8 A JE TO POSUN K LEPŠÍMU, ne ztráta cesty (22. 9. 2026).
//    `admin-api` (rozloučení po konci koučinku) přestal volat Resend přímo a posílá
//    přes `_shared/resend-odeslat.ts`, takže jeho `fetch` z tohohle seznamu zmizel
//    a zůstal jediný, ten v helperu. Kontrola měří RAW volání: každé nové znamená
//    další cestu, která si musí sama hlídat bránu i `provider_id`.
// ⛔ Kdo tohle číslo ZVYŠUJE, přidává cestu mimo helper a musí napsat proč.
// ⚠️ 23. 9. 2026 KLESLO Z 8 NA 7: smazaná funkce `videokurz-onboarding` měla vlastní fetch.
check("počet přímých Resend fetchů v rozsahu neroste", sites.length >= 7 && sites.length <= 8, String(sites.length));

// ⛔ AUTOMAT NESMI ODESILAT PRIMO. Cely smysl `_shared/resend-odeslat.ts` je, ze
//    kazde odeslani nechava `provider_id`, podle ktereho se paruje bounce. Kdyby si
//    `koucink-konec` zavolal Resend sam, jeho maily by uz nikdy nikdo nezastavil.
{
  const kk = await Deno.readTextFile(new URL("koucink-konec/index.ts", ROOT));
  const kkCore = await Deno.readTextFile(new URL("koucink-konec/core.ts", ROOT));
  const sdilene = await Deno.readTextFile(new URL("_shared/koucink-konec.ts", ROOT));
  const adm = await Deno.readTextFile(new URL("admin-api/index.ts", ROOT));
  check("koucink-konec nevola Resend primo", !kk.includes(RESEND));
  check("core nevola Resend primo", !kkCore.includes(RESEND));
  check("koucink-konec posila pres helper", kk.includes("odesliPresResend"));
  // ⛔ Brana PRED stavbou mailu, stejne jako u rucniho odchodu.
  // ⛔ Po refaktoru (nalez S11) uz cesta brany neni v `index.ts`, ale v `core.ts`:
  //    `index.ts` jen predava `path` do `guardSend`. Kontrola proto meri poradi
  //    tam, kde se rozhoduje, a zvlast overi, ze obe cesty vubec existuji.
  check("core zna obe cesty brany",
    kkCore.includes('"koucink-konec.confirm"') && kkCore.includes('"koucink-konec.sales"'));
  predTim("core: brana PRED stavbou mailu", kkCore, '"koucink-konec.confirm"', "deps.posliMail(email,");
  check("index predava cestu brany do guardSend",
    kk.includes("guardSend(admin, { email, mailClass: trida, functionName: \"koucink-konec\", path })"));
  // ⛔ Razitko PRED prvnim nevratnym krokem (Martin 17. 9.: radeji nikdy mail navic).
  //    Po refaktoru (revize R1, nalez S11) rozhoduje `core.ts`, takze `index.ts`
  //    uz `ukonciPristup` nevola primo: predava ho jako zavislost. Kontrola proto
  //    meri poradi TAM, kde se ted rozhoduje.
  predTim("koucink-konec: index jen zapojuje, nerozhoduje", kk,
    "await zaber(email, deps)", "zpracujJednoho(email, zabrano, deps)");
  // ⛔⛔ [revize R2, nalez V1 a V2] FRONTU SESTAVUJE JADRO, ne `index.ts`.
  //    Dokud ten vyber zil uvnitr `Deno.serve()`, neslo ho otestovat, a prave
  //    v nem byly dve mrtve pojistky z R1: zaseknuta rezervace a strop pokusu
  //    se do `zaber` vubec nedostaly. Mutace uvnitr `zaber` proto zustavaly zelene.
  check("frontu sestavuje jadro", kk.includes("razitkaDoFronty(vsechnaRazitka"));
  check("index uz frontu nefiltruje sam",
    !kk.includes('r.stav === "opakovat" || r.stav === "opakovat_mail"'));
  check("razitka se ctou i se `mail_stav` (podle nej se pozna chybejici rozlouceni)",
    kk.includes("promo_code,pokusy,updated_at,duvod,mail_stav"));
  // ⛔⛔ [revize R4] STAV MAILU JE VLASTNI SLOUPEC, ne odvozenina ze stavu prace.
  //    Do R4 tutez informaci nesly dve mista (stav prace `opakovat_mail` a boolean
  //    `sent_ok`) a kdyz jedno zmizelo, vyznam druheho se ticho previatil.
  // ⚠️ Hleda se v KODU, ne v komentarich: ty stare nazvy se v komentarich schvalne
  //    zminuji, aby bylo poznat, proti cemu se to opravovalo.
  const kkKod = kkCore.split(String.fromCharCode(10))
    .filter((l) => !l.trim().startsWith("*") && !l.trim().startsWith("//"))
    .join(String.fromCharCode(10));
  check("stavy prace uz nenesou informaci o mailu",
    !kkKod.includes('"opakovat_mail"') && !kkKod.includes('"chyba_nejiste"'));
  check("typ stavu prace ma jen ctyri hodnoty",
    kkCore.includes('export type StavRazitka = "rezervovano" | "opakovat" | "hotovo" | "vzdano";'));
  check("rozhodnuti se ptá jen na `mailStav`",
    kkCore.includes("opts: { mailStav: MailStav; tedMs: number; graceDny: number }"));
  // ⛔⛔ RAZITKO `posilam` PRED VOLANIM RESENDU. Kdyz se ten zapis nepovede,
  //    Resend se NEVOLA; kdyz se nepovede zapis vysledku, radek v nem zustane
  //    a po lhute se cte jako `nejiste`. Druhy mail z toho nevznikne nikdy.
  // ⛔⛔ [revize R5, nalez V2] Poradi `posilam` -> Resend -> vysledek zije v JEDNE
  //    funkci `odesliSRazitkem` v `_shared`, kterou vola cron i admin. Kotvy proto
  //    miri tam; chovani hlidaji behavioralni testy v `koucink-konec.test.ts`.
  predTim("sdilena funkce: `posilam` se zapisuje PRED odeslanim", sdilene,
    'mail_stav: "posilam"', "const r = await opts.posli();");
  check("cron posila pres sdilenou funkci", kkCore.includes("await odesliSRazitkem({"));
  check("cron uz nevola `posliMail` mimo sdilenou funkci",
    (kkCore.match(/deps\.posliMail\(/g) ?? []).length === 1 &&
      kkCore.indexOf("deps.posliMail(") > kkCore.indexOf("await odesliSRazitkem({"));
  check("sdilena funkce: bez zapisu `posilam` se Resend nevola",
    sdilene.includes('if (!zacatek) {') &&
      sdilene.includes('return { vysledek: "posilam_neulozeno", status: 0, providerId: "", vysledekUlozen: false };'));
  check("`sent_ok` je jen odvozenina", kkCore.includes("sent_ok: stav === \"odeslano\""));
  // ⛔ [revize R4, nalez S5] Potvrzeni je soucast POZADAVKU, ne jen dialogu.
  check("admin predava serverove potvrzeni do rozhodnuti",
    adm.includes("potvrzeno: body.potvrzeno === true,") && adm.includes('error: "potrebuje_potvrzeni"'));
  check("rozhodnuti bez potvrzeni vraci `potrebuje_potvrzeni`",
    sdilene.includes('return v.potvrzeno ? { akce: "jen_mail" } : { akce: "potrebuje_potvrzeni" };'));
  // ⛔ [revize R4, nalez S3] Zapis razitka v adminu cte chybu; supabase-js nehazi.
  check("admin cte chybu zapisu razitka",
    adm.includes("const { error: zapErr } = await admin.from(\"koucink_konec_sent\").update(pole).eq(\"email\", email);"));
  check("admin posila pres sdilenou funkci", adm.includes("const o = await odesliSRazitkem({"));
  // ⛔ [revize R4, nalez N6] Bez `updated_at` ve selectu se stari rezervace nepozna.
  check("admin cte `updated_at` razitka",
    adm.includes('.select("stav,promo_code,ma_academy,pokusy,updated_at,mail_stav")'));
  // ⛔ [revize R4] GET promo kodu ma filtr `active=true`.
  check("promo kod se hleda s filtrem active=true",
    sdilene.includes("promotion_codes?limit=1&active=true&code="));
  // ⛔⛔ [revize R3, nalez S3] ZAMEK NESMI STAT NA `count: "exact"`.
  //    Dokumentace PostgREST popisuje `Prefer: count=` u CTENI; ze u PATCH vrati
  //    pocet zmenenych radku, nikde netvrdi. `.select()` vraci aktualizovane
  //    radky, coz dokumentovane je, a delka pole je meritelna vec.
  check("prevezmi nepouziva count:exact", !kk.includes('{ count: "exact" }'));
  check("prevezmi pocita vracene radky", kk.includes('await q.select("email")'));
  // ⛔⛔ [revize R3, nalez V1] `rezervovano` -> `rezervovano` splni svou vlastni
  //    podminku PORAD. Vylucovacim ho dela az podminka na stari v TEMZE UPDATE.
  check("prevezmi pridava podminku na stari u zaseknute rezervace",
    kk.includes('if (jenZaseknute) q = q.lt("updated_at"'));
  check("admin zamek taky nepouziva count:exact u razitka",
    !/koucink_konec_sent[\s\S]{0,400}?\{ count: "exact" \}/.test(adm));
  check("admin zamyka podminenym updatem se `select`",
    adm.includes('const { data: zamekRows, error: zamekErr } = await zq.select("email")'));
  check("admin ma podminku na stari u zaseknute rezervace",
    adm.includes('zq = zq.lt("updated_at"'));
  // ⛔⛔ [revize R3, nalez V1] CERSTVA REZERVACE PATRI BEZICIMU AUTOMATU.
  //    Bez teto vetve by admin prosel i tehdy, kdyz cron toho cloveka prave
  //    zpracovava, a klient by dostal rozlouceni dvakrat.
  check("admin odmita cerstvou rezervaci 409",
    adm.includes('if (r.akce === "automat_pracuje") {') && adm.includes('error: "prave_zpracovava_automat"'));
  check("admin pozna cerstvou rezervaci podle stari",
    adm.includes("const rezervaceCerstva = razitkoStav ===") && adm.includes("razitkoStari <= ZASEKNUTO_PO_MS"));
  // ⛔⛔ [revize R3, nalez S5] Doposlat jde i z `chyba_nejiste`, protoze prave
  //    tam alert Martina posila. Do R3 ta cesta v kodu nebyla.
  // ⛔ [revize R4] Doposlat jde podle STAVU MAILU, ne podle stavu prace.
  // ⛔⛔ [revize R5, nalez V1] Rozhoduje cista funkce a NEJDRIV se pta na narok.
  check("admin rozhoduje pres `rozhodniRucniOdchod`", adm.includes("const r = rozhodniRucniOdchod({"));
  // ⛔ [revize R6, N3] Chybejici klic Resendu nema vlastni vetev: jde pres
  //    `odesliSRazitkem` jako v cronu. Admin `odmitnuto` sam nezapisuje.
  check("admin nema vlastni vetev pro chybejici klic Resendu",
    !adm.includes('mail: "no_resend"') && !adm.includes("if (!RESEND_KEY) {"));
  check("admin sam nezapisuje `odmitnuto` (jen sdilena funkce)", !adm.includes('mail_stav: "odmitnuto"'));
  // ⛔ [revize R6, N1] Neznamy stav mailu je `nejiste` a v DB ho nepusti CHECK.
  check("admin hlasi neznamy stav mailu", adm.includes("jeNeznamyMailStav(razitkoRow?.mail_stav)"));
  check("karta dostava stav mailu normalizovany", adm.includes("konec_mail_stav: razKonec.error ? null : mailStavZRadku("));
  {
    const sql = await Deno.readTextFile(new URL("../koucink-konec-2026-09-22.sql", ROOT));
    check("migrace ma CHECK na hodnoty `mail_stav` (idempotentne)",
      sql.includes("add constraint koucink_konec_sent_mail_stav_hodnoty") &&
        sql.includes("check (mail_stav in ('neposlano', 'posilam', 'odmitnuto', 'nejiste', 'odeslano'))") &&
        sql.includes("where conname = 'koucink_konec_sent_mail_stav_hodnoty'"));
    check("CHECK jde az po prevodu starych dat",
      sql.indexOf("where stav in ('opakovat_mail', 'chyba_nejiste');") > 0 &&
        sql.indexOf("where stav in ('opakovat_mail', 'chyba_nejiste');") < sql.indexOf("add constraint koucink_konec_sent_mail_stav_hodnoty"));
  }
  check("admin predava do rozhodnuti skutecny stav naroku",
    adm.includes("narokExistuje: !!narokRow,") && adm.includes("narokAktivni: narokRow?.active === true,"));
  check("admin pri vraceni zamku vraci i stav mailu",
    adm.includes("mail_stav: razitkoMail,") && adm.includes('sent_ok: razitkoMail === "odeslano",'));
  check("admin cte narok PRED rozhodnutim",
    adm.indexOf('.select("active").eq("email", email).eq("product", "coaching")') > 0 &&
      adm.indexOf('.select("active").eq("email", email).eq("product", "coaching")') < adm.indexOf("const r = rozhodniRucniOdchod({"));
  check("rozhodnuti: bezici narok = plna cesta, pred stavem mailu",
    sdilene.indexOf("if (v.narokAktivni) {") > 0 &&
      sdilene.indexOf("if (v.narokAktivni) {") < sdilene.indexOf('if (v.mailStav === "odeslano") return { akce: "uz_ukoncen" };'));
  // ⛔⛔ [revize R5, nalez V2] Radek razitka EXISTUJE driv, nez se zavre pristup.
  predTim("admin zaklada razitko PRED zavrenim pristupu", adm,
    'email, stav: "rezervovano", mail_stav: "neposlano", pokusy: 0,', "u = await ukonciPristup(admin,");

  // ⛔⛔ [revize R3, nalez S6] PROMO KOD SE OVERUJE NA `active`.
  //    Stripe archivuje kody, kdyz prestane platit jejich kupon; archivovany kod
  //    v pokladne slevu neda a mail by slibil neco, co neplati.
  check("promo kod se cte i s `active`",
    sdilene.includes("active: prvni.active === true") &&
      sdilene.includes("if (nalez && nalez.active) return { ok: true, kod, id: nalez.id };") &&
      sdilene.includes("if (nalez && !nalez.active) return { ok: false, chyba: CHYBA_KOD_NEAKTIVNI };"));
  check("`already exists` se overuje druhym GETem, ne bere jako uspech",
    sdilene.includes("const znovu = await najdiPromoKod(stripeKey, kod, timeoutMs);") &&
      sdilene.includes("if (znovu && znovu.active) return { ok: true, kod, id: znovu.id };"));
  check("archivovany kod ma vlastni chybovy kod (jde na nej reagovat)",
    sdilene.includes("export const CHYBA_KOD_NEAKTIVNI") && kkCore.includes("deps.kodNeaktivni"));

  // ⛔⛔ [revize R3, nalez V2] ZADNY ZAPIS PRED ZAMKEM.
  predTim("admin zamyka DRIV, nez zapise promo kod", adm,
    "const { data: zamekRows, error: zamekErr } = await zq.select(\"email\")",
    'duvod: "promo_pending:rucne"');
  predTim("core: zavreni pristupu az po promo kodu", kkCore, "deps.zalozPromo(email, promo)", "deps.ukonciPristup(email)");
  predTim("core: mail az po zavreni pristupu", kkCore, "deps.ukonciPristup(email)", "deps.posliMail(email,");
  // ⛔⛔ [revize R1, nalez V1] Jiste neodeslani po ZAVRENEM pristupu musi koncit
  //    stavem `opakovat_mail`, ne `opakovat`. Druhy pokus jinak znovu sahne na narok,
  //    dostane `uz_ukoncen` a mail preskoci NAVZDY.
  // ⛔⛔ [revize R1 nalez V1, prepsano v R4] Jiste neodeslani (Resend 4xx,
  //    chybejici klic) MUSI zustat rozeznatelne od nejistoty, jinak se rozlouceni
  //    bud ztrati, nebo odejde podruhe.
  check("sdilena funkce: jiste neodeslani konci na `odmitnuto`",
    sdilene.includes('pole = { stav: "opakovat", mail_stav: "odmitnuto", sent_ok: false,'));
  check("core: nejistota konci na `nejiste`", kkCore.includes('mail("nejiste"'));
  // ⛔ [revize R5, N6] `odeslano` jen s `provider_id`.
  check("sdilena funkce: `odeslano` jen s provider_id",
    sdilene.includes("if (r.ok && providerId) {") &&
      sdilene.includes('pole = { stav: "hotovo", mail_stav: "odeslano", sent_ok: true, provider_id: providerId,'));
  // ⛔ [revize R5, S4] Prazdny druhy GET po `already exists` je `kod_neaktivni`.
  check("prazdny druhy GET je `kod_neaktivni`",
    sdilene.includes('if (znovu === undefined) return { ok: false, chyba: "stripe_kod_existuje_ale_neprecten" };') &&
      sdilene.includes("return { ok: false, chyba: CHYBA_KOD_NEAKTIVNI };"));
  // ⛔ `jenMail` se od R2 zapina i u prevzate zaseknute rezervace s vypnutym
  //    narokem (rozhodnuti `dokonci_mail`), proto `let`, ne `const`.
  check("core: doposlani mailu preskakuje zavirani pristupu",
    kkCore.includes("let jenMail = false;") && kkCore.includes("if (!jenMail) {"));
  check("core: zavreny pristup bez odeslani konci doposlanim mailu",
    kkCore.includes('rozhodnuti === "dokonci_mail"') && kkCore.includes("jenMail = true;"));

  // ⛔⛔ [revize R1, nalez V2] TVRDE TIMEOUTY NA VOLANI VEN.
  //    Cron utne HTTP po 120 s a Supabase Free da funkci 150 s. Jedno visici
  //    volani sezere cely beh, funkci zabiji UPROSTRED cloveka, `catch` se
  //    neprovede a razitko zustane v `rezervovano`. Pojistka na zaseknute
  //    rezervace to sice dozene, ale az za pul hodiny, tedy v praxi az zitra.
  //    Kontrola je STATICKA schvalne: chovani se bez site otestovat neda,
  //    ale zmizeni `AbortSignal` ano, a prave to se stane pri prvnim refaktoru.
  check("Stripe ma tvrdy timeout",
    /fetch\("https:\/\/api\.stripe\.com[\s\S]{0,600}?AbortSignal\.timeout\(/.test(sdilene));
  check("most do appky ma tvrdy timeout",
    /academy-grant[\s\S]{0,600}?AbortSignal\.timeout\(/.test(sdilene));
  check("timeouty jsou pojmenovane konstanty, ne cisla v tele",
    sdilene.includes("VYCHOZI_TIMEOUT_STRIPE_MS") && sdilene.includes("VYCHOZI_TIMEOUT_APPKA_MS"));
  // ⚠️ `odesliPresResend` tvrdy timeout NEMA a je sdileny s dvanacti funkcemi,
  //    takze se v teto davce nemeni. Misto nej drzi rozpoctu `DEADLINE_MS`
  //    v `koucink-konec/index.ts`, ktery je pod limitem cronu.
  check("beh ma deadline pod limitem cronu (120 s)",
    /const DEADLINE_MS = (\d[\d_]*)/.test(kk) &&
      Number(RegExp.$1.replace(/_/g, "")) < 120000);
  predTim("deadline se kontroluje PRED zabranim cloveka", kk, "doslo_na_cas = true", "await zaber(email, deps)");
}

const ALLOW_WITHOUT_LOCAL_GUARD = new Set([
  // Transport. Guard je v poukaz-vydat/core.ts + index.ts před sendMail.
  "poukaz-vydat/lib/mail.ts",
]);

const ALERT_ONLY = new Set([
  // Alert Martinovi, ne zákazník. Customer send jde přes core.ts posliMail.
]);

for (const s of sites) {
  const text = await Deno.readTextFile(new URL(s.file, ROOT));
  const ok = text.includes(GUARD_MARK) || ALLOW_WITHOUT_LOCAL_GUARD.has(s.file);
  check(
    s.file + ":" + s.line + " má guard nebo je evidovaný transport",
    ok,
    s.text.slice(0, 80),
  );
}

const grantIndex = sites.filter((s) => s.file === "grant-videokurz-z-appky/index.ts");
check("grant index má 2 Resend fecthy (alert + posliMail)", grantIndex.length === 2, String(grantIndex.length));
check("grant core importuje guard (customer send)", true);

const koucink = await Deno.readTextFile(new URL("_shared/koucink-onboarding.ts", ROOT));
predTim("koucink-onboarding vola guardSend pred Resendem", koucink, "guardSend", RESEND);

const offboard = await Deno.readTextFile(new URL("admin-api/index.ts", ROOT));
const salesAt = offboard.lastIndexOf('path: "admin-api.client_offboard.sales"');
const buildAt = offboard.lastIndexOf("buildOffboardMail({");
check("offboard sestavuje mail až po guardu sales",
  salesAt > 0 && buildAt > salesAt, `sales@${salesAt} build@${buildAt}`);

console.log("\nNalezené call sites:");
for (const s of sites) console.log("  " + s.file + ":" + s.line);

console.log(selhalo === 0 ? "\nVSE ZELENE\n" : `\n${selhalo} SELHANI\n`);
if (selhalo > 0) throw new Error(String(selhalo) + " selhani");
void ALERT_ONLY;
