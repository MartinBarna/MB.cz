// client-remind: nedělní připomínka týdenního reportu klientům koučinku.
// Volá pg_cron (client-remind-weekly, neděle 01:00 UTC, opakování +30 a +60 min) s hlavičkou x-drip-secret.
// Komu: aktivní entitlement 'coaching' mimo optout. Registrovaný dostane připomínku reportu
// (pokud report nemá z posledních 3 dnů; kdo vyplnil v týdnu, mail nedostane).
// Neregistrovaný dostane výzvu k založení přístupu (bez účtu nemá report kam vyplnit).
// ⭐ Nový klient, který nikdy neposlal report, výzvu k reportu hned nedostane: rozhoduje
//    `entitlements.start_at` (od 15. 9. 2026), a když chybí, náhrada „nárok mladší než
//    7 dní" (cerstvy-klient.ts). Upomínky k registraci se to netýká.
// Globální vypnutí: app_config.client_remind_enabled = 'false'.
// Per-klient vypnutí: app_config.client_remind_optout = CSV e-mailů (zapisuje se v adminu).
//
// ⛔ 14. 9. 2026 (Martin: „nesmí se stávat"): chyba čtení NENÍ odpověď. Guard secretu i čtení
//    příjemců jdou přes _shared/secret-guard.ts s opakováním; když DB nejde přečíst ani po
//    třech pokusech, vrací se 500 (cron to uvidí v net._http_response a opakovací běh to zkusí
//    znovu), ne 403 a ne „ok, sent: 0". Paměť: feedback-guard-secretu-pri-vypadku-db-je-403.
// ⭐ Idempotence: kdo dostal výzvu v posledních 5 dnech (client_remind_sent), tu samou nedostane
//    znovu, takže tři cronové běhy za sebou pošlou každému nejvýš jeden mail.
// ⛔⛔ 17. 9. 2026 (nález V3): pořadí je ZAPIŠ, PAK POŠLI. Řádek v `client_remind_sent` se
//    REZERVUJE před odesláním a unikátní index v DB (`client_remind_sent_unique_den`, migrace
//    `client-remind-idempotence-2026-09-17.sql`) ten závod rozhoduje: kdo prohraje vložení,
//    neodesílá. Do 17. 9. se zapisovalo AŽ PO odeslání a selhaný zápis znamenal, že opakovací
//    běh poslal mail podruhé. Martin 17. 9.: „raději nikdy mail navíc."
//    ⛔ Pořadí má cenu: když odeslání selže, mail nedojde. Proto se rozlišuje, jestli tělo
//    mailu mohlo na Resend dojít. NEMOHLO (chybějící klíč, 4xx) ⇒ rezervace se uvolní a běh
//    za 30 minut to zkusí znovu. MOHLO (status >= 500 nebo chyba `sit:…`) ⇒ rezervace
//    zůstane, `sent_ok=false` a alert Martinovi. Revize R1 nález N1, R2 nález R2-2.
//    ⛔ Uvolněná rezervace není tichá: `odesliPresResend` zakládá `email_events`
//    `type='odeslani_chyba'` a nedělní hlídka je čte (R2, nález R2-1).
//    ⛔ MIGRACE MUSÍ BÝT NASAZENÁ DŘÍV NEŽ TAHLE VERZE: bez sloupce `sent_ok` skončí update
//    chybou (jen se zaloguje) a bez unikátního indexu rezervace nic nezaručuje.
// ⛔ 17. 9. 2026 (nález V2): TESTOVACÍ režim má vlastní paměť pod klíčem `test:<druh>`
//    a pojistku „jednou za hodinu"; vědomě se přebíjí `{"test_email":"…","test_znovu":true}`.
//    Vyžaduje migraci `client-remind-test-klice-2026-09-17.sql` (rozšířený CHECK na `kind`).
// ⭐ Dvoutýdenní kadence pro jmenované klienty: app_config.client_remind_14d (CSV e-mailů).
//    Jejich okno je 12 dní, takže neděli po týdnu vynechají a další termín jim vyjde za 14 dní.
import { createClient } from "jsr:@supabase/supabase-js@2";
import { guardSend, logMailSkip } from "../_shared/mailing-guard.ts";
import { chybaCteni, ctiSOpakovanim, overSecret } from "../_shared/secret-guard.ts";
import { emailySeznam } from "../_shared/mail-seznam.ts";
// ⭐ [16. 9. 2026] Odeslani pres spolecny helper, ktery si precte `id` z odpovedi
// Resendu a zapise ho do `email_events`. Bez toho se bounce ani stiznost na spam
// u teto cesty NEDAJI SPAROVAT a nic je nezastavi (nalez V1).
import { odesliPresResend } from "../_shared/resend-odeslat.ts";
import { preskocitVyzvuKReportu } from "./cerstvy-klient.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const FROM = "Martin Barna <news@martinbarna.cz>";
const CTA_URL = "https://martinbarna.cz/akademie/klient/";
// ?tab=up otevre rovnou zalozku "Vytvorit ucet" (prihlaseni/index.html startuje jinak na "Prihlasit se",
// coz je u cloveka bez uctu slepa ulicka). &amp; kvuli platnosti HTML v href.
const REG_URL = "https://martinbarna.cz/akademie/prihlaseni/?tab=up&amp;next=%2Fakademie%2Fklient%2F";
// Okno idempotence: výzva jednou za týden, tři běhy v jedné noci jsou od sebe 30 minut.
const UZ_DOSTAL_DNI = 5;
// ⭐ 14. 9. 2026 (Martin): JEDEN klient má chodit jednou za 14 dní, ostatní beze změny.
// Seznam je v app_config.client_remind_14d (CSV e-mailů). Okno je 12 dní, ne 14: kdyby
// nedělní běh spadl a mail odešel až v pondělí, čtrnáctý den by jinak vyšel o pár hodin
// dřív a termín by se přeskočil až na další neděli. 12 dní neděli po týdnu nepustí (7 < 12).
const UZ_DOSTAL_DNI_14D = 12;

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { "Content-Type": "application/json" } });
const low = (s: unknown) => String(s ?? "").trim().toLowerCase();

// 5. pád, 1:1 pravidla z drip-send (nejistá jména zůstávají v 1. pádu, ženská na souhlásku se nemění)
const VOK_EXC: Record<string, string> = {
  "jan": "Jene", "pavel": "Pavle", "karel": "Karle", "havel": "Havle", "pavol": "Pavle",
  "zdenek": "Zdenku", "zdeněk": "Zdeňku", "zbynek": "Zbynku", "zbyněk": "Zbyňku",
  "josef": "Josefe", "luboš": "Luboši", "lubos": "Luboši", "bartoloměj": "Bartoloměji",
  "vavřinec": "Vavřinče", "vavrinec": "Vavrinče", "němec": "Němče",
};
const FEMALE_NAMES = new Set<string>([
  "ester", "dagmar", "miriam", "karin", "karyn", "nikol", "ingrid", "rút", "rut", "judit", "edit", "ráchel", "rachel",
  "dolores", "doris", "agnes", "mercedes", "karmen", "carmen", "sarah", "deborah", "abigail", "gwen", "lilian", "vivien",
  "kristin", "kristýn", "katrin", "madlen", "jennifer", "žaneta",
]);
const VOK_VOWELS = "aeiouyáéěíóúůý";
function vokativ(fn: string): string {
  if (!fn) return fn;
  const l = fn.toLowerCase();
  const last = l.slice(-1);
  if (last === "a") return fn.slice(0, -1) + "o";
  if (VOK_VOWELS.includes(last)) return fn;
  if (FEMALE_NAMES.has(l)) return fn;
  if (l in VOK_EXC) return VOK_EXC[l];
  if (l.endsWith("ek")) return fn.slice(0, -2) + "ku";
  if (l.endsWith("ch") || "kgh".includes(last)) return fn + "u";
  if ("szxj".includes(last) || "šžčř".includes(last)) return fn + "i";
  if (l.endsWith("el")) return fn + "i";
  if (last === "r") return VOK_VOWELS.includes(l.slice(-2, -1)) ? fn + "e" : fn.slice(0, -1) + "ře";
  if ("bdflmnptvw".includes(last)) return fn + "e";
  return fn;
}

/**
 * ⛔⛔ REZERVACE MÍSTA PŘED ODESLÁNÍM (17. 9. 2026, nález V3).
 *
 * Martinovo rozhodnutí k politice `client_operational`: „RADĚJI NIKDY MAIL NAVÍC."
 * ⇒ pořadí je ZAPIŠ, PAK POŠLI. Do 17. 9. se zapisovalo AŽ PO odeslání, takže když
 * zápis selhal (504 brány Supabase), opakovací běh o 30 minut později poslal týž mail
 * znovu, a nikdo se to nedozvěděl: `zapis_selhal` končí v `net._http_response`.
 *
 * Vrací:
 *   "ok"       rezervace je moje, smím poslat
 *   "obsazeno" řádek už existuje (jiný z trojice cronů, nebo můj dřívější běh) => NEPOSÍLÁM
 *   "chyba"    zápis se nepovedl z jiného důvodu => NEPOSÍLÁM, zkusí to běh za 30 minut
 *
 * ⛔ ŽÁDNÉ OPAKOVÁNÍ ZÁPISU (`ctiSOpakovanim`) tu schválně není. Při 504 by druhý pokus
 *    mohl narazit na řádek, který uložil ten první, vrátil by 23505 a vypadalo by to jako
 *    „má to někdo jiný". Jeden pokus je čitelný: buď mám rezervaci, nebo nemám.
 * ⛔ `upsert ... on conflict do nothing` tu být NEMŮŽE: index je partial a Postgres ho
 *    bez zopakované podmínky nedovodí (42P10), PostgREST podmínku poslat neumí.
 *    Změřeno 17. 9. 2026 na živé DB. Detail v `client-remind-idempotence-2026-09-17.sql`.
 */
async function rezervuj(
  // deno-lint-ignore no-explicit-any
  admin: any,
  email: string,
  kind: string,
): Promise<{ stav: "ok" | "obsazeno" | "chyba"; detail: string }> {
  const { error } = await admin.from("client_remind_sent").insert({ email, kind });
  if (!error) return { stav: "ok", detail: "" };
  const kod = String((error as { code?: unknown }).code ?? "");
  if (kod === "23505") return { stav: "obsazeno", detail: kod };
  return { stav: "chyba", detail: String((error as { message?: unknown }).message ?? error).slice(0, 160) };
}

/**
 * Uvolní rezervaci, když je JISTÉ, že mail neodešel (R1, nález N1).
 * Mazání je omezené na poslední hodinu, ať se nesmaže starší legitimní řádek.
 *
 * ⛔⛔ [R2, nález R2-1] UVOLNĚNÍ MUSÍ NECHAT STOPU, JINAK JE TICHÉ.
 *    Smazaný řádek po sobě v `client_remind_sent` nezanechá nic, takže kdyby selhalo
 *    odeslání VŠEM (špatný klíč, 401 u všech), tabulka by byla prázdná a hlídka by
 *    spadla do větve „funkce běžela a nikomu nemá co poslat" a řekla OK. To je incident
 *    ze 14. 9. 2026, jen jinou cestou.
 *    ⭐ Stopa existuje a píše ji `odesliPresResend`: každé neúspěšné odeslání zakládá
 *    v `email_events` řádek `type='odeslani_chyba'` s `detail.via='client-remind'`
 *    (`_shared/resend-odeslat.ts`, funkce `zapisChybu`). Je to zdroj NEZÁVISLÝ na těle
 *    odpovědi cronu, a hlídka `client_remind_hlidka()` ho čte právě proto.
 *    ⛔ Kdo tady přestane volat helper (nebo mu přestane předávat `stopa`), oslepí tím
 *    hlídku, aniž by cokoli spadlo.
 */
async function uvolniRezervaci(
  // deno-lint-ignore no-explicit-any
  admin: any,
  email: string,
  kind: string,
): Promise<boolean> {
  const { error } = await admin.from("client_remind_sent")
    .delete().eq("email", email).eq("kind", kind)
    .gte("sent_at", new Date(Date.now() - 3600000).toISOString());
  if (error) console.error("[client-remind] UVOLNENI REZERVACE SELHALO: " + email + " " + error.message);
  return !error;
}

/**
 * Označí rezervaci jako „mail nejspíš neodešel" (R1, nález N2).
 * ⛔ Volá se VŠUDE, kde rezervace zůstane bez prokázaného odeslání, ne jen u 5xx.
 *    Hlídka `client_remind_hlidka()` čte právě `sent_ok=false`; kdyby tu tenhle zápis
 *    chyběl (výjimka po rezervaci, selhané uvolnění), ohlásila by klidné `OK` nad řádkem,
 *    u kterého nic neprokazuje odeslání.
 */
async function oznacNejiste(
  // deno-lint-ignore no-explicit-any
  admin: any,
  email: string,
  kind: string,
): Promise<boolean> {
  const { error } = await admin.from("client_remind_sent")
    .update({ sent_ok: false }).eq("email", email).eq("kind", kind)
    .gte("sent_at", new Date(Date.now() - 3600000).toISOString());
  if (error) console.error("[client-remind] zapis sent_ok=false selhal: " + email + " " + error.message);
  return !error;
}

/**
 * Alert Martinovi. ⛔ Jde PŘÍMO přes Resend, NE přes `guardSend`: brána chrání adresu
 * klienta, ne Martinovu, a kdyby jeho adresa jednou skončila na seznamu, přestal by se
 * dozvídat právě ta selhání, kvůli kterým alert existuje. (Týž vzor jako `splatky-guard`.)
 * ⛔ Bez `stopa`: Martinova adresa do `email_events` nepatří (`resend-odeslat.ts`).
 */
async function alertMartinovi(
  // deno-lint-ignore no-explicit-any
  admin: any,
  subject: string,
  text: string,
): Promise<boolean> {
  let to = "fitness.barna@gmail.com";
  try {
    const { data } = await admin.from("app_config").select("value").eq("key", "admin_emails").maybeSingle();
    const prvni = String(data?.value || "").split(",").map((s: string) => s.trim()).filter(Boolean)[0];
    if (prvni) to = prvni;
  } catch { /* zůstává fallback */ }
  const r = await odesliPresResend(RESEND_KEY, {
    from: FROM,
    to: [to],
    subject,
    html: `<pre style="font-family:inherit;white-space:pre-wrap">${text}</pre>`,
  });
  return r.ok;
}

function mailHtml(osloveni: string, kind: "report" | "register", maPrilohu: boolean): string {
  const p = (t: string) => `<p style='margin:0 0 14px'>${t}</p>`;
  const cta = (href: string, label: string) =>
    `<p style='margin:4px 0 18px'><a class='mb-btn' href='${href}' style='display:inline-block;background:#EBB12C;color:#1A1222;text-decoration:none;padding:13px 26px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;font-size:15px'>${label}</a></p>`;
  // POZOR na znění register varianty: 3 ze 4 prijemcu reporty POSILAJI, jen mimo web (vsech 31 zaznamu
  // v client_reports ma source='import-sheet'). Text proto NESMI tvrdit "bez pristupu mi neposles report",
  // to by klientovi lhalo tyden pote, co report poslal. Cil je presun kanalu, ne vycitka.
  // Report varianta chodi v NEDELI (Martin 14. 9. 2026): reporty zpracovava v pondeli, vyplnit se da uz v nedeli.
  const telo = kind === "register"
    ? p("od teď mi svoje reporty posílej přes <strong>klientskou sekci</strong> na webu. Budeš v ní mít svoje grafy, historii i appku Tvůj Coach v ceně koučinku. Žádný Excel, nic neopisuješ.") +
      cta(REG_URL, "Vytvořit přístup") +
      p("<span class='mb-ps' style='color:#A09AAD;font-size:14px'>Zabere to minutu. Registruj se e-mailem, na který ti přišel tenhle vzkaz, jiný ti sekci neotevře. Heslo si zvolíš při registraci.</span>") +
      p("<span class='mb-ps' style='color:#A09AAD;font-size:14px'>Kdyby něco nefungovalo, odepiš mi na tenhle mail a vyřešíme to.</span>")
    : p("týden je za tebou 💪 Zvaž se a hoď mi <strong>týdenní report</strong>. Zabere ~3 minuty a já ti podle něj doladím plán.") +
      p("Reporty zpracovávám v pondělí. Vyplnit ho můžeš v klidu už v neděli, ať to v pondělí ráno mám.") +
      cta(CTA_URL, "Vyplnit report (3 min)") +
      (maPrilohu ? p("<span class='mb-ps' style='color:#A09AAD;font-size:14px'>Zapisuješ si jídlo v Kalorických tabulkách? V příloze máš návod, jak z nich data vytáhnout jedním klikem a nahrát do reportu. Nemusíš nic opisovat.</span>") : "") +
      p("<span class='mb-ps' style='color:#A09AAD;font-size:14px'>Tip: zvaž se ráno nalačno a vezmi metr na hruď, pas, boky, zadek a stehna. Míry řeknou víc než váha. Sečti si i <strong>celkové minuty sportu za týden</strong> (fitko, kardio i jiný pohyb dohromady), samotný počet tréninků mi o zátěži neřekne dost. Na konci reportu si naklikáš i plán kroků a minut na další týden, klidně jedním klikem „bude stejně\". Jedeš v Kalorických tabulkách? Průměr kcal najdeš ve Statistiky → Analýza jídelníčku.</span>");
  // DARK-MODE FIX (drz 1:1 s drip-send): color-scheme 'light dark' + zamky barev pres tridy .mb-*.
  // Gmail app v dark rezimu invertoval kartu na svetlou a zlatou #EBB12C barvil dohneda;
  // [data-ogsc]/[data-ogsb] = Outlook aplikace, @media prefers-color-scheme = Apple Mail.
  return `<!doctype html><html lang='cs'><head><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'><meta name='color-scheme' content='light dark'><meta name='supported-color-schemes' content='light dark'>` +
    `<style>` +
    `:root{color-scheme:light dark;supported-color-schemes:light dark}` +
    `@media (prefers-color-scheme: dark){` +
    `.mb-bg{background:#0C0B10!important}` +
    `.mb-card{background:#181520!important}` +
    `.mb-body{color:#F0EADF!important}` +
    `.mb-brand{color:#EBB12C!important;border-left-color:#EBB12C!important}` +
    `.mb-btn{background:#EBB12C!important;color:#1A1222!important}` +
    `.mb-mut{color:#8F8A99!important}` +
    `.mb-ps{color:#A09AAD!important}` +
    `.mb-link{color:#F6CD63!important}` +
    `}` +
    `[data-ogsc] .mb-bg,[data-ogsb] .mb-bg{background:#0C0B10!important}` +
    `[data-ogsc] .mb-card,[data-ogsb] .mb-card{background:#181520!important}` +
    `[data-ogsc] .mb-body,[data-ogsb] .mb-body{color:#F0EADF!important}` +
    `[data-ogsc] .mb-brand,[data-ogsb] .mb-brand{color:#EBB12C!important;border-left-color:#EBB12C!important}` +
    `[data-ogsc] .mb-btn,[data-ogsb] .mb-btn{background:#EBB12C!important;color:#1A1222!important}` +
    `[data-ogsc] .mb-mut,[data-ogsb] .mb-mut{color:#8F8A99!important}` +
    `[data-ogsc] .mb-ps,[data-ogsb] .mb-ps{color:#A09AAD!important}` +
    `[data-ogsc] .mb-link,[data-ogsb] .mb-link{color:#F6CD63!important}` +
    `</style></head><body class='mb-bg' style='margin:0;padding:0;background:#0C0B10'>` +
    `<table role='presentation' class='mb-bg' width='100%' cellpadding='0' cellspacing='0' border='0' bgcolor='#0C0B10'><tr><td align='center' style='padding:16px'>` +
    `<table role='presentation' class='mb-card' width='560' cellpadding='0' cellspacing='0' border='0' bgcolor='#181520' style='width:100%;max-width:560px;background:#181520;border-radius:2px;border:1px solid #262232'><tr><td class='mb-body' style='padding:28px;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;font-size:16px;line-height:1.55;color:#F0EADF'>` +
    `<div class='mb-brand' style='border-left:3px solid #EBB12C;padding-left:10px;font-weight:800;font-size:13px;letter-spacing:.2em;text-transform:uppercase;color:#EBB12C;margin:0 0 20px'>Martin Barna</div>` +
    p(osloveni ? "Ahoj " + osloveni + "," : "Ahoj,") +
    telo +
    p("<strong>Be Effective!</strong><br>Martin") +
    `<hr style='border:none;border-top:1px solid #262232;margin:22px 0 14px'><div class='mb-mut' style='font-size:12px;color:#8F8A99'>Martin Barna · martinbarna.cz · připomínka pro klienty koučinku. Nechceš je? Odepiš mi na tenhle mail a vypnu ti je.</div>` +
    `</td></tr></table></td></tr></table></body></html>`;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "method" }, 405);
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

  // Tři stavy: sedí / nesedí (403 jako dřív) / NEPŘEČTENO (500, cron zopakuje).
  const brana = await overSecret(admin, req, { header: "x-drip-secret", statusOdmitnuti: 403 });
  if (!brana.ok) return json(brana.body, brana.status);

  type Radek = { value?: unknown } | null;
  type Radky<T> = T[] | null;
  const flag = await ctiSOpakovanim<{ data: Radek; error: unknown }>(() => admin.from("app_config").select("value").eq("key", "client_remind_enabled").maybeSingle());
  if (flag.error) return json(chybaCteni("app_config.client_remind_enabled", flag.error), 500);
  if (flag.data && String(flag.data.value).toLowerCase() === "false") return json({ ok: true, skipped: "disabled" });
  if (!RESEND_KEY) return json({ error: "no_resend" }, 500);

  // TEST rezim: {"test_email":"..."} posle ukazku JEN na tuhle adresu a nikomu jinemu.
  // Driv se test_email tise ignoroval a spustil ostry rozesil (stalo se 17. 7.).
  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const testEmail = typeof body?.test_email === "string" && body.test_email.includes("@") ? body.test_email.trim() : null;
  const testKind: "report" | "register" = body?.test_kind === "register" ? "register" : "report";
  // ⭐ [17. 9. 2026, nález V2] Test má vlastní paměť a vlastní pojistku.
  //    Do 17. 9. testovací běh přeskakoval kontrolu „už dostal nedávno" A nezapisoval nic,
  //    takže každé další spuštění poslalo další mail a nezbyla po něm stopa. Klíč je ODDĚLENÝ
  //    (`test:report`), aby test nikdy neumlčel ostrý nedělní mail klientovi.
  const testZnovu = body?.test_znovu === true;
  const testKlic = "test:" + testKind;
  // OSTRY rezim spousti VYHRADNE cron s prazdnym telem {}. Cokoliv jineho nez prazdne telo
  // nebo platny {"test_email":"...@..."} = chyba, ne tichy ostry rozesil. Whitelist (ne "obsahuje
  // test") schvalne: chyti i {"email":...}, {"to":...}, {"testEmail":...} atd. Presne takhle odesel
  // 17. 7. mail 5 klientum v patek (parametr se tise ignoroval). Radeji 400 nez rozeslat.
  // Jediny legitimni neprazdny vstup je platny test_email. Cokoliv jineho v tele (preklep v klici,
  // spatny typ, chybejici zavinac, test_kind bez test_email) => 400, nikdy tichy ostry rozesil.
  const klice = Object.keys(body ?? {});
  if (klice.length > 0 && !testEmail)
    return json({ error: "test_email_invalid", hint: 'cekam prazdne telo (ostry beh) nebo {"test_email":"nekdo@domena.cz"}', got: klice }, 400);

  // klienti s aktivním coaching entitlementem
  // ⛔ Od 2. 9. 2026 může být koučinkový nárok ČASOVANÝ (zaplacené období přes Stripe).
  // Bez podmínky na expiraci by bývalému klientovi chodila připomínka reportu
  // dál, i když mu koučink skončil. Prázdná expirace = přístup bez konce, ten platí.
  // ⛔ Chyba čtení = 500, ne „nikdo": prázdný seznam kvůli 504 by byl tichý úspěch.
  const nyni = new Date().toISOString();
  // ⭐ 15. 9. 2026 (dávka 9): i `start_at`, den, kdy klient reálně začíná. Je to týž dotaz,
  //    takže nepřibývá žádné další čtení do DB. ⛔ Sloupec MUSÍ existovat dřív, než se tahle
  //    verze nasadí (migrace `davka9-start-koucinku-2026-09-15.sql`): bez něj vrátí PostgREST
  //    chybu a mail nedostane NIKDO. Je to aspoň hlučné selhání, cron ho zapíše do
  //    `net._http_response`, ale pořadí nasazení je migrace → funkce.
  const ents = await ctiSOpakovanim<{ data: Radky<{ email?: unknown; granted_at?: unknown; start_at?: unknown }>; error: unknown }>(() =>
    admin.from("entitlements").select("email,granted_at,start_at")
      .eq("product", "coaching").eq("active", true)
      .or("expires_at.is.null,expires_at.gt." + nyni));
  if (ents.error) return json(chybaCteni("entitlements", ents.error), 500);
  const clients = [...new Set((ents.data ?? []).map((e) => low(e.email)))].filter(Boolean);
  if (!clients.length) return json({ ok: true, sent: 0 });
  // Kdy byl nárok udělen. Je to okamžik kliknutí v adminu, ne start koučinku, ale jiné datum
  // o začátku klienta v systému není. Nečitelné datum se přeskočí.
  const grantOd = new Map<string, number>();
  for (const e of ents.data ?? []) {
    const t = Date.parse(String(e.granted_at ?? ""));
    if (!Number.isFinite(t)) continue;
    const em = low(e.email);
    const drive = grantOd.get(em);
    // ⛔ Drží se NEJSTARŠÍ nárok. Klíč entitlements je (email, product) a je case sensitive,
    //    takže „A@x.cz" a „a@x.cz" jsou dva legitimní řádky, které low() slije do jednoho.
    //    Pořadí řádků PostgREST nezaručuje, takže bez tohohle by mohl vyhrát ten NOVĚJŠÍ
    //    a klient by se ztišil. Nejstarší datum chybuje vždy směrem „mail radši odejde".
    if (drive === undefined || t < drive) grantOd.set(em, t);
  }
  // ⭐ Start koučinku, když ho Martin zadal (`entitlements.start_at`, dávka 9). Sloupec je
  //    `date`, PostgREST ho vrací jako "2026-09-20"; doplní se na půlnoc UTC, ať to Date.parse
  //    nečte jako místní čas. Pro nedělní běh v 01:00 UTC je to bezpečné, protože práh je
  //    v DNECH, ne v hodinách (`PRVNI_VYZVA_PO_DNECH`).
  // ⛔ Nečitelná hodnota se přeskočí a klient padá na náhradu z `granted_at`, ne do ticha.
  // ⚠️ Stejně jako u `grantOd` se drží NEJSTARŠÍ datum: klíč `entitlements` je case sensitive,
  //    takže „A@x.cz" a „a@x.cz" jsou dva řádky, které low() slije do jednoho. Nejstarší start
  //    chybuje vždy směrem „mail radši odejde".
  const startOd = new Map<string, number>();
  for (const e of ents.data ?? []) {
    const s = String(e.start_at ?? "").trim();
    if (!s) continue;
    const t = Date.parse(s.length === 10 ? s + "T00:00:00Z" : s);
    if (!Number.isFinite(t)) continue;
    const em = low(e.email);
    const drive = startOd.get(em);
    if (drive === undefined || t < drive) startOd.set(em, t);
  }

  // jen registrovaní (bez účtu nemá report kdo vyplnit, ty řeší pozvánka, ne nedělní mail)
  // listUsers() chybu NEHAZI, vraci ji v error a data zustanou prazdna. Bez tehle kontroly by
  // vypadek auth API znamenal "nikdo nema ucet" -> vsech 9 klientu (i 5 aktivnich) by dostalo
  // vyzvu k registraci. Radeji neposlat nic nez rozeslat plosne spatny mail.
  const registered = new Set<string>();
  let page = 1;
  while (page < 20) {
    const { data: u, error: uerr } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (uerr) return json({ error: "auth_list_failed", detail: String(uerr.message ?? uerr).slice(0, 120), sent: 0 }, 500);
    for (const usr of u?.users ?? []) registered.add(low(usr.email));
    if (!u || u.users.length < 200) break;
    page++;
  }
  // Prazdny seznam uctu nemuze nastat legitimne (v auth.users jsou desitky uctu) = spolehlivy detektor chyby.
  if (!registered.size) return json({ error: "auth_list_empty", sent: 0 }, 500);

  // kdo už report v posledních 3 dnech poslal, připomínku nedostane
  const cutoff = new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10);
  const recent = await ctiSOpakovanim<{ data: Radky<{ email?: unknown }>; error: unknown }>(() => admin.from("client_reports").select("email").gte("report_date", cutoff));
  if (recent.error) return json(chybaCteni("client_reports", recent.error), 500);
  const recentSet = new Set((recent.data ?? []).map((r) => low(r.email)));

  // Kdo z klientů někdy poslal JAKÝKOLI report (web, import-sheet, sync z appky). Bez toho by se
  // převáděný klient z Excelu po nové pozvánce na týden ztišil, i když reporty posílá roky.
  // ⛔ Filtr .in("email", clients) SCHVÁLNĚ, ne celá tabulka: PostgREST má strop „Max rows"
  //    a při jeho překročení vrátí TIŠE jen prvních N řádků v nezaručeném pořadí. Adresa,
  //    která by takhle vypadla, by se tvářila jako klient bez reportu a na týden by se ztišila.
  //    Stejný tvar filtru, jaký má o pár řádků níž čtení customer_contacts nad týmž seznamem.
  // ⚠️ .in() je case sensitive a seznam „clients" jsou adresy po low(). Celá tahle funkce stojí na tom,
  //    že adresy jsou v DB malými písmeny (stejně to má customer_contacts i guardSend); adresa
  //    psaná jinak by z množiny vypadla. Ověřeno 15. 9.: v entitlements ani client_reports
  //    není žádná adresa mimo lowercase.
  // ⛔ Chyba čtení = 500 jako u ostatních čtení: prázdno po chybě by znamenalo „nikdo nikdy
  //    nereportoval" a na týden by ztišilo každého nového klienta, tiše a bez stopy.
  const historieReportu = await ctiSOpakovanim<{ data: Radky<{ email?: unknown }>; error: unknown }>(() =>
    admin.from("client_reports").select("email").in("email", clients));
  if (historieReportu.error) return json(chybaCteni("client_reports(historie)", historieReportu.error), 500);
  const nekdyReportoval = new Set((historieReportu.data ?? []).map((r) => low(r.email)));

  // per-klient opt-out (klient odepsal, že připomínky nechce → admin ho zapíše do CSV)
  // ⛔ Chyba čtení = 500: bez opt-outu by mail přišel i tomu, kdo si ho vypnul.
  const opt = await ctiSOpakovanim<{ data: Radek; error: unknown }>(() => admin.from("app_config").select("value").eq("key", "client_remind_optout").maybeSingle());
  if (opt.error) return json(chybaCteni("app_config.client_remind_optout", opt.error), 500);
  // ⛔ Parsování přes `emailySeznam`, ne prostý split: `"a@x.cz"` s uvozovkami nebo
  // `Jméno <a@x.cz>` se dřív neshodly a člověk, který si připomínky VYPNUL, by je dostával dál.
  const optout = emailySeznam(opt.data?.value);

  // per-klient dvoutýdenní kadence (CSV e-mailů). ⛔ Chyba čtení = 500: kdyby se seznam
  // nepřečetl, klient s dvoutýdenní kadencí by dostal mail každý týden a nikdo by to nepoznal.
  const kad = await ctiSOpakovanim<{ data: Radek; error: unknown }>(() => admin.from("app_config").select("value").eq("key", "client_remind_14d").maybeSingle());
  if (kad.error) return json(chybaCteni("app_config.client_remind_14d", kad.error), 500);
  const kazdych14 = emailySeznam(kad.data?.value);

  // kdo výzvu dostal v posledních dnech (opakovací běhy cronu, ruční doposlání): nedostane znovu
  const uzCutoff = new Date(Date.now() - Math.max(UZ_DOSTAL_DNI, UZ_DOSTAL_DNI_14D) * 86400000).toISOString();
  // Klíč je e-mail + druh mailu (revize 14. 9.): kdo dostal v 03:00 pozvánku k registraci a do
  // 03:30 se zaregistroval, má výzvu k reportu dostat, ne čekat týden.
  const uz = await ctiSOpakovanim<{ data: Radky<{ email?: unknown; kind?: unknown; sent_at?: unknown }>; error: unknown }>(() => admin.from("client_remind_sent").select("email,kind,sent_at").gte("sent_at", uzCutoff));
  if (uz.error) return json(chybaCteni("client_remind_sent", uz.error), 500);
  // Nejnovější odeslání pro dvojici e-mail + druh mailu. Okno se pak měří podle kadence
  // toho klienta: běžný 5 dní (tři běhy jedné noci), dvoutýdenní 12 dní.
  const poslednePoslano = new Map<string, number>();
  const poslednePoslanoKomukoli = new Map<string, number>();
  for (const r of uz.data ?? []) {
    const cas = Date.parse(String(r.sent_at ?? ""));
    if (!Number.isFinite(cas)) continue; // nečitelné datum radši ignoruj, než aby mail zmizel
    const email = low(r.email);
    const klic = email + ":" + String(r.kind ?? "");
    const drive = poslednePoslano.get(klic);
    if (drive === undefined || cas > drive) poslednePoslano.set(klic, cas);
    // ⛔ Testovací řádky (`test:*`) do „kdykoli komukoli" NEPATŘÍ. Ta mapa hlídá dvoutýdenní
    //    kadenci ostrých mailů; kdyby se do ní počítal test, jedno Martinovo zkoušení na
    //    adresu klienta by mu na 12 dní ztišilo skutečnou výzvu, a to úplně tiše.
    if (!String(r.kind ?? "").startsWith("test:")) {
      const driveK = poslednePoslanoKomukoli.get(email);
      if (driveK === undefined || cas > driveK) poslednePoslanoKomukoli.set(email, cas);
    }
  }
  // ⛔ U dvoutýdenní kadence se okno měří přes OBA druhy mailu dohromady. Kdyby se počítalo
  //    zvlášť (jako u ostatních), klient by dostal v neděli pozvánku, do týdne se zaregistroval
  //    a hned další neděli by mu přišla výzva k reportu: dva maily za osm dní místo za čtrnáct.
  const uzDostalNedavno = (email: string, kind: string): boolean => {
    if (kazdych14.has(email)) {
      const casK = poslednePoslanoKomukoli.get(email);
      return casK !== undefined && Date.now() - casK < UZ_DOSTAL_DNI_14D * 86400000;
    }
    const cas = poslednePoslano.get(email + ":" + kind);
    if (cas === undefined) return false;
    return Date.now() - cas < UZ_DOSTAL_DNI * 86400000;
  };

  // oslovení z customer_contacts (křestní jméno v 5. pádu; bez jména padne na "Ahoj,")
  const { data: cc } = await admin.from("customer_contacts").select("email,name").in("email", clients);
  const nameBy = new Map<string, string>();
  for (const c of cc ?? []) {
    const raw = String(c.name ?? "").trim().split(/\s+/)[0];
    if (raw) nameBy.set(low(c.email), vokativ(raw.charAt(0).toUpperCase() + raw.slice(1)));
  }

  const pool = clients.filter((e) => !optout.has(e));
  // ⭐ Ochranná lhůta po startu (cerstvy-klient.ts): nový klient, který nikdy neposlal report,
  //    výzvu k reportu ještě nedostane. ⛔ Týká se JEN druhu "report". Upomínka k registraci
  //    chodí dál: bez účtu nemá klient report kam vyplnit a odklad by ho jen zdržel.
  // ⭐ 15. 9. 2026 (dávka 9): rozhoduje ZADANÝ start, a když chybí nebo je nečitelný, padá se
  //    na starou náhradu z `granted_at`. Důvod se drží zvlášť, ať jde přeskočený klient
  //    dohledat a ať se pozná, jestli se pole vůbec vyplňuje.
  const naReport = pool.filter((e) => registered.has(e) && !recentSet.has(e));
  const ted = Date.now();
  const rozhodnuti = new Map<string, "start" | "narok">();
  for (const e of naReport) {
    const r = preskocitVyzvuKReportu(e, startOd, grantOd, nekdyReportoval, ted);
    if (r.preskocit && r.duvod) rozhodnuti.set(e, r.duvod);
  }
  const cerstviSet = new Set(rozhodnuti.keys());
  // ⭐ Stopa do logu edge funkce (dashboard), ne jen do odpovědi. Přeskočení je JEDINÁ nová cesta,
  //    jak klient mail nedostane, a čítač cerstvi_klienti leží v net._http_response, kam se nikdo
  //    nedívá. Bez tohohle by se omylem přeskočený klient nedal dohledat. Adresy v logu už tu jsou
  //    (zápis client_remind_sent níž), takže to nic nového neotevírá.
  for (const em of cerstviSet) {
    const dni = ((ted - (grantOd.get(em) ?? ted)) / 86400000).toFixed(1);
    const st = startOd.has(em) ? new Date(startOd.get(em) as number).toISOString().slice(0, 10) : "nezadan";
    console.log("[client-remind] vyzva k reportu preskocena: " + em
      + " (duvod " + rozhodnuti.get(em) + ", " + dni + " dne od naroku, start " + st + ")");
  }
  const kandidati: { email: string; kind: "report" | "register" }[] = [
    ...naReport.filter((e) => !cerstviSet.has(e)).map((email) => ({ email, kind: "report" as const })),
    ...pool.filter((e) => !registered.has(e)).map((email) => ({ email, kind: "register" as const })),
  ];
  // Opakovací běhy cronu: kdo tenhle druh mailu dostal v posledních dnech, nedostane ho znovu.
  const uzDostali = kandidati.filter((t) => uzDostalNedavno(t.email, t.kind)).length;
  // ⭐ [17. 9. 2026, nález V2] HODINOVÁ POJISTKA TESTU. Smoke test se pouští jednou a výsledek
  //    se čte z odpovědi, ne z doručené schránky. Druhé spuštění do hodiny se zastaví a řekne,
  //    jak ho vědomě přebít. ⛔ Hodina, ne den: test se opakuje legitimně (oprava šablony,
  //    druhý druh mailu), jen ne omylem dvakrát za sebou.
  const testPoslednePoslano = testEmail ? (poslednePoslano.get(low(testEmail) + ":" + testKlic) ?? 0) : 0;
  const testUzSel = testPoslednePoslano > Date.now() - 3600_000;
  if (testEmail && testUzSel && !testZnovu) {
    return json({
      ok: true,
      mode: "test",
      skipped: "test_jiz_odeslan_v_posledni_hodine",
      naposledy: new Date(testPoslednePoslano).toISOString(),
      hint: 'opakovat lze pres {"test_email":"…","test_znovu":true}',
    });
  }
  const targets: { email: string; kind: "report" | "register" }[] = testEmail
    ? [{ email: testEmail, kind: testKind }]
    : kandidati.filter((t) => !uzDostalNedavno(t.email, t.kind));

  // Příloha ze storage (stáhne se jednou pro všechny; best effort, bez ní mail stejně odejde)
  async function priloha(soubor: string): Promise<{ filename: string; content: string } | null> {
    try {
      const { data: pdf } = await admin.storage.from("client-docs").download("shared/" + soubor);
      if (!pdf) return null;
      const buf = new Uint8Array(await pdf.arrayBuffer());
      let bin = "";
      for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
      return { filename: soubor, content: btoa(bin) };
    } catch (_e) { return null; /* příloha je bonus, ne blokace */ }
  }
  const ktNavod = await priloha("kaloricke-tabulky-navod.pdf");
  const attachments: { filename: string; content: string }[] | undefined = ktNavod ? [ktNavod] : undefined;

  let sent = 0, skipped = 0;
  const errors: string[] = [];
  // ⛔ Nová jména polí (17. 9. 2026). Staré `zapis_selhal` znamenalo „mail ODEŠEL, ale zápis ne"
  //    (tedy hrozí mail navíc). Od pořadí „zapiš, pak pošli" jsou stavy jiné:
  //  - `rezervace_selhala`: zápis nevyšel, mail NEODEŠEL, běh za 30 minut to zkusí znovu,
  //  - `prohrany_zavod`:    řádek už měl někdo jiný (druhý cron), mail vědomě NEODEŠEL,
  //  - `odeslani_nejiste`:  rezervace drží, ale odeslání skončilo v nejistotě (síť, timeout).
  //                         Mail se NEOPAKUJE (Martin: raději nikdy mail navíc) a řádek má
  //                         `sent_ok=false`, ať to jde v DB najít.
  //  - `uvolneno_neodeslano`: Resend zásilku nepřijal (status 0 nebo 4xx), mail jistě
  //                         neodešel, rezervace se smazala a opakovací běh ji zkusí znovu.
  const rezervaceSelhala: string[] = [];
  const odeslaniNejiste: string[] = [];
  const uvolnenoNeodeslano: string[] = [];
  let prohranyZavod = 0;
  // Alerty Martinovi, které samy neodešly. Cron nemá retry, ať to aspoň jde přečíst z odpovědi.
  const alertySelhaly: string[] = [];
  // ⛔ [R1, nález N5] STROP ALERTŮ. Při výpadku sítě by jinak z jednoho běhu odešlo
  //    až 19 stejných mailů Martinovi, což je proti duchu „nikdy mail navíc". Dál se
  //    už jen počítá a celé číslo je v odpovědi (a přes ni i v nedělní hlídce).
  const MAX_ALERTU = 3;
  let alertuPoslano = 0;
  let alertuPotlaceno = 0;
  const posliAlertNejistoty = async (email: string, kind: string, isReg: boolean, status: number, duvod: string) => {
    if (alertuPoslano >= MAX_ALERTU) { alertuPotlaceno++; return; }
    alertuPoslano++;
    const doslo = await alertMartinovi(
      admin,
      "[VYRIDIT RUCNE] client-remind: nejiste odeslani (" + email + ")",
      "Klientovi " + email + " se nepodarilo odeslat " + (isReg ? "vyzvu k registraci" : "vyzvu k tydennimu reportu") + ".\n\n"
        + "Duvod: " + (duvod || "sit nebo timeout") + " (HTTP status " + status + ").\n"
        + "Stav: NEVIME, jestli mail odesel. Rezervace v client_remind_sent zustava\n"
        + "a ma sent_ok=false, takze zadny dalsi beh ten mail uz neposle.\n\n"
        + "Co s tim: kdyz klient nic nedostal, posli mu to rucne, nebo smaz jeho radek\n"
        + "z client_remind_sent (email=" + email + ", kind=" + kind + ") a nech to\n"
        + "na opakovacim behu cronu. Tohle rozhodnuti je schvalne na cloveku:\n"
        + "Martin 17. 9. 2026: 'radeji nikdy mail navic'.",
    );
    // ⛔ Když neprojde ani alert, nesmí to zapadnout: cron nemá retry, tak aspoň
    //    do logu funkce a do odpovědi (týž vzor jako `splatky-guard`).
    if (!doslo) { console.error("[client-remind] ALERT MARTINOVI NEODESEL: " + email); alertySelhaly.push(email); }
  };
  for (const tgt of targets) {
    const isReg = tgt.kind === "register";
    // ⛔ `rezervovano` je ZÁMĚRNĚ mimo `try`: když spadne cokoli mezi rezervací a
    //    odesláním, řádek v `client_remind_sent` už existuje a mail neodešel. Bez tohohle
    //    by to byla tichá ztráta mailu, přesně ta vada, kterou celá dávka opravuje.
    let rezervovano = false;
    try {
      const d = await guardSend(admin, {
        email: tgt.email,
        mailClass: "client_operational",
        functionName: "client-remind",
        path: "client-remind",
      });
      if (d.action === "skip") {
        await logMailSkip(admin, d);
        skipped++;
        continue;
      }
      // ⛔⛔ REZERVACE PŘED ODESLÁNÍM. Tři crony (19, 47, 48) běží 30 minut po sobě a
      //    do 17. 9. je dělil jen přečtený stav; unikátní index v DB teď dělá závod
      //    rozhodnutelným: kdo prohraje vložení, neposílá.
      if (!testEmail) {
        const rez = await rezervuj(admin, tgt.email, tgt.kind);
        if (rez.stav === "obsazeno") { prohranyZavod++; continue; }
        if (rez.stav === "chyba") {
          console.error("[client-remind] REZERVACE SELHALA, mail neodeslan: " + tgt.email + " " + rez.detail);
          rezervaceSelhala.push(tgt.email);
          continue; // ⛔ neposílat: bez rezervace by mail mohl odejít i z dalšího běhu
        }
        rezervovano = true;
      }
      const r = await odesliPresResend(
        RESEND_KEY,
        {
          from: FROM,
          to: [tgt.email],
          subject: isReg ? "Tvoje klientská sekce čeká (1 minuta)" : "Týdenní report ✍️ (3 minuty)",
          html: mailHtml(nameBy.get(tgt.email) ?? "", tgt.kind, !!ktNavod && !isReg),
          reply_to: "martin@martinbarna.cz",
          // Pri testu je bcc zbytecne (mail uz jde na Martina) a mate: prisel by dvakrat.
          ...(testEmail ? {} : { bcc: ["fitness.barna@gmail.com"] }),
          ...(attachments && !isReg ? { attachments } : {}),
        },
        // ⛔ Stopa se pise i v TESTOVACIM rezimu. Test chodi na Martinovu adresu,
        //    do `client_remind_sent` se od 17. 9. 2026 zapisuje pod ODDELENYM klicem
        //    `test:<druh>` (nalez V2), takze ostry mail neumlci, ale opakovany smoke
        //    test uz nezustane bez pameti. Kdyz Resend zasilku odmitne, chceme to videt.
        { admin, via: "client-remind", email: tgt.email, detail: { kind: tgt.kind, test: !!testEmail } },
      );
      if (r.ok) {
        sent++;
        // ⭐ [17. 9. 2026, nález V2] Stopa po TESTU. Zapisuje se AŽ PO odeslání (na rozdíl od
        //    ostrého běhu): test nemá co rezervovat, protože nesoutěží s jiným během, a když
        //    se odeslání nepovede, má jít zopakovat hned. Klíč je `test:<druh>`, takže tenhle
        //    řádek NIKDY neumlčí ostrý nedělní mail.
        if (testEmail) {
          const { error: tErr } = await admin.from("client_remind_sent").insert({ email: low(tgt.email), kind: testKlic });
          if (tErr) console.error("[client-remind] zapis stopy testu selhal: " + tErr.message);
        }
      } else {
        errors.push(tgt.email + ":" + r.status);
        if (rezervovano) {
          // ⛔⛔ ROZHODUJE, JESTLI TĚLO MAILU MOHLO DOJÍT NA RESEND (R1 nález N1, R2 nález R2-2).
          //    Verze z R1 dělila jen podle statusu (hranice 500) a `status: 0` brala vždy jako
          //    jisté neodeslání. Jenže `status: 0` má DVĚ různé příčiny, které helper rozlišuje
          //    textem chyby (`_shared/resend-odeslat.ts`):
          //      - `missing_RESEND_API_KEY`: požadavek se ani nesestavil => JISTĚ neodešlo,
          //      - `sit:…`: spadl `fetch`, ale tělo už na Resendu být MOHLO (spojení se může
          //        rozpadnout až při čtení odpovědi; `fetch` tam nemá timeout ani AbortController).
          //    ⇒ NEJISTOTA = `status >= 500` NEBO chyba začínající `sit:`. Všechno ostatní
          //      (chybějící klíč, 4xx včetně 401, 422, 429) je jisté neodeslání.
          //  a) jisté neodeslání => rezervaci uvolnit, ať ji běh za 30 minut zkusí znovu.
          //  b) nejistota => rezervace zůstane se `sent_ok=false`, mail se neopakuje
          //     (Martin: raději nikdy mail navíc) a rozhodne člověk podle alertu.
          // ⚠️ Tímhle mizí poslední cesta v téhle dávce, která uměla poslat mail dvakrát.
          const teloMohloDojit = r.status >= 500 || String(r.chyba ?? "").startsWith("sit:");
          if (teloMohloDojit) {
            odeslaniNejiste.push(tgt.email);
            await oznacNejiste(admin, tgt.email, tgt.kind);
            await posliAlertNejistoty(tgt.email, tgt.kind, isReg, r.status, r.chyba ?? "");
          } else {
            const uvolneno = await uvolniRezervaci(admin, tgt.email, tgt.kind);
            if (uvolneno) uvolnenoNeodeslano.push(tgt.email);
            else {
              // ⛔ Řádek drží a mail neodešel. Bez `sent_ok=false` by hlídka ohlásila OK
              //    nad rezervací, u které nic neprokazuje odeslání (R1, nález N2).
              odeslaniNejiste.push(tgt.email);
              await oznacNejiste(admin, tgt.email, tgt.kind);
              await posliAlertNejistoty(tgt.email, tgt.kind, isReg, r.status, "rezervaci se nepodarilo uvolnit: " + (r.chyba ?? ""));
            }
          }
        }
      }
      await new Promise((res) => setTimeout(res, 550)); // Resend rate limit 2/s
    } catch (e) {
      errors.push(tgt.email + ":" + String(e).slice(0, 40));
      // ⛔ [R1, nález N2] Rezervace zůstala a mail nejspíš neodešel. Samotný push do pole
      //    nestačil: hlídka čte `sent_ok` v DB, a bez tohohle zápisu by nad takovým řádkem
      //    ohlásila klidné OK. Alert jde stejnou cestou jako u ostatních nejistot.
      // ⛔ [R2, nález R2-6] Vlastní `try`: `oznacNejiste` i `posliAlertNejistoty` sahají
      //    do DB a na Resend. Bez něj by výjimka z ÚKLIDU shodila celou smyčku a zbylí
      //    klienti by se ten den nezpracovali vůbec. Přesně ten druh pojistky, který
      //    tahle dávka zavádí jinde.
      if (rezervovano) {
        odeslaniNejiste.push(tgt.email);
        try {
          await oznacNejiste(admin, tgt.email, tgt.kind);
          await posliAlertNejistoty(tgt.email, tgt.kind, tgt.kind === "register", 0, "vyjimka po rezervaci: " + String(e).slice(0, 120));
        } catch (e2) {
          console.error("[client-remind] UKLID PO VYJIMCE SELHAL: " + tgt.email + " " + String(e2).slice(0, 120));
        }
      }
    }
  }
  const pocet = (k: string) => targets.filter((x) => x.kind === k).length;
  // ⭐ cerstvi_klienti se hlasi i v TESTOVACIM rezimu (na rozdil od uz_dostali). test_email je
  //    jediny zpusob, jak funkci spustit bez rozesilky klientum, takze je to jedina cesta, jak
  //    si pred nedeli overit "ano, jeden se preskoci". Nic to neriskuje: v testu mail stejne
  //    odejde vyhradne na zadanou adresu a do client_remind_sent se zapisuje pod klicem
  //    `test:<druh>`, ktery ostrou kontrolu "uz dostal nedavno" nikdy netrefi.
  // ⭐ `bez_startu` je levná hlídka (dávka 9): až budou mít klienti start vyplněný, bude to
  //    nula. Když číslo poroste, pole se přestalo vyplňovat a systém tiše spadl zpátky
  //    na náhradu z `granted_at`. Počítá se z `naReport`, tedy z lidí, kterých se práh týká.
  const preskocenoPodleStartu = [...rozhodnuti.values()].filter((d) => d === "start").length;
  const bezStartu = naReport.filter((e) => !startOd.has(e)).length;
  return json({ ok: true, mode: testEmail ? "test" : "live", clients: clients.length, cerstvi_klienti: cerstviSet.size, preskoceno_podle_startu: preskocenoPodleStartu, bez_startu: bezStartu, uz_dostali: testEmail ? 0 : uzDostali, targets: targets.length, report: pocet("report"), register: pocet("register"), sent, skipped, priloha: !!ktNavod, kadence_14d: kazdych14.size, optout: optout.size, prohrany_zavod: prohranyZavod, rezervace_selhala: rezervaceSelhala, odeslani_nejiste: odeslaniNejiste, uvolneno_neodeslano: uvolnenoNeodeslano, alerty_selhaly: alertySelhaly, alerty_potlaceno: alertuPotlaceno, errors });
});
