// client-remind — pondělní ranní připomínka týdenního reportu klientům koučinku.
// Volá pg_cron (client-remind-weekly, pondělí ráno) s hlavičkou x-drip-secret.
// Komu: aktivní entitlement 'coaching' mimo optout. Registrovaný dostane připomínku reportu
// (pokud report nemá z posledních 3 dnů; kdo vyplnil o víkendu, mail nedostane).
// Neregistrovaný dostane výzvu k založení přístupu (bez účtu nemá report kam vyplnit).
// Globální vypnutí: app_config.client_remind_enabled = 'false'.
// Per-klient vypnutí: app_config.client_remind_optout = CSV e-mailů (zapisuje se v adminu).
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const FROM = "Martin Barna <news@martinbarna.cz>";
const CTA_URL = "https://martinbarna.cz/akademie/klient/";
// ?tab=up otevre rovnou zalozku "Vytvorit ucet" (prihlaseni/index.html startuje jinak na "Prihlasit se",
// coz je u cloveka bez uctu slepa ulicka). &amp; kvuli platnosti HTML v href.
const REG_URL = "https://martinbarna.cz/akademie/prihlaseni/?tab=up&amp;next=%2Fakademie%2Fklient%2F";

// JEDNORÁZOVÁ zmínka o novém návodu klientské sekce (Martin rozhodl 11. 8. 2026: starý
// návod neseděl s okénky v reportu, nahlásila to klientka).
// ⛔ OKNO, ne přesný den. Kdyby pondělní běh vypadl (cron, výpadek, Resend), s podmínkou
//    `dnes === "2026-08-18"` by se omluva neposlala NIKDY a nikdo by si toho nevšiml.
//    Funkce běží 1× týdně, takže uvnitř okna proběhne právě jednou.
// ⚠️ Ruční spuštění uvnitř okna by ji poslalo znovu; testovací režim jde jen na test adresu.
// ⏰ Po 23. 8. 2026 je tenhle blok mrtvý kód a smaže se (i s druhou přílohou).
// Okno posunuto 11. 8. z 18.-24. na 17.-23.: Martin chce omluvu v pondělním běhu 17. 8.
// (cron jede po 01:00 UTC = 03:00 lokálně; porovnává se UTC datum, 17. 8. padne dovnitř,
// další pondělí 24. 8. už je venku, jednorázovost drží).
const NAVOD_OD = "2026-08-17";
const NAVOD_DO = "2026-08-23";
const NAVOD_SOUBOR = "klientska-sekce-navod.pdf";

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { "Content-Type": "application/json" } });
const low = (s: unknown) => String(s ?? "").trim().toLowerCase();

// 5. pád — 1:1 pravidla z drip-send (nejistá jména zůstávají v 1. pádu, ženská na souhlásku se nemění)
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

function mailHtml(osloveni: string, kind: "report" | "register", maPrilohu: boolean, sNavodem = false): string {
  const p = (t: string) => `<p style='margin:0 0 14px'>${t}</p>`;
  const cta = (href: string, label: string) =>
    `<p style='margin:4px 0 18px'><a class='mb-btn' href='${href}' style='display:inline-block;background:#EBB12C;color:#1A1222;text-decoration:none;padding:13px 26px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;font-size:15px'>${label}</a></p>`;
  // POZOR na znění register varianty: 3 ze 4 prijemcu reporty POSILAJI, jen mimo web (vsech 31 zaznamu
  // v client_reports ma source='import-sheet'). Text proto NESMI tvrdit "bez pristupu mi neposles report",
  // to by klientovi lhalo tyden pote, co report poslal. Cil je presun kanalu, ne vycitka.
  const telo = kind === "register"
    ? p("od teď mi svoje reporty posílej přes <strong>klientskou sekci</strong> na webu. Budeš v ní mít svoje grafy, historii i appku Tvůj Coach v ceně koučinku. Žádný Excel, nic neopisuješ.") +
      cta(REG_URL, "Vytvořit přístup") +
      p("<span class='mb-ps' style='color:#A09AAD;font-size:14px'>Zabere to minutu. Registruj se e-mailem, na který ti přišel tenhle vzkaz, jiný ti sekci neotevře. Heslo si zvolíš při registraci.</span>") +
      p("<span class='mb-ps' style='color:#A09AAD;font-size:14px'>Kdyby něco nefungovalo, odepiš mi na tenhle mail a vyřešíme to.</span>")
    : p("nový týden, nová data 💪 Mrkni na váhu a hoď mi <strong>týdenní report</strong>. Zabere ~3 minuty a já ti podle něj doladím plán.") +
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
    // Jednorázová zmínka o novém návodu. Až se blok bude mazat, smaž i konstanty nahoře.
    (sNavodem
      ? p("<span class='mb-ps' style='color:#A09AAD;font-size:14px'>Ještě jedna věc: <strong>přepsal jsem návod ke klientské sekci</strong>. Ten starý neseděl s tím, co v reportu doopravdy vidíš, pár okének v něm chybělo. Omlouvám se, jestli tě to zdrželo. Nový je v příloze a najdeš ho i v sekci mezi dokumenty.</span>")
      : "") +
    p("<strong>Be Effective!</strong><br>Martin") +
    `<hr style='border:none;border-top:1px solid #262232;margin:22px 0 14px'><div class='mb-mut' style='font-size:12px;color:#8F8A99'>Martin Barna · martinbarna.cz · připomínka pro klienty koučinku. Nechceš je? Odepiš mi na tenhle mail a vypnu ti je.</div>` +
    `</td></tr></table></td></tr></table></body></html>`;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "method" }, 405);
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

  const { data: sec } = await admin.from("app_config").select("value").eq("key", "drip_invoke_secret").maybeSingle();
  if (!sec?.value || req.headers.get("x-drip-secret") !== sec.value) return json({ error: "forbidden" }, 403);

  const { data: flag } = await admin.from("app_config").select("value").eq("key", "client_remind_enabled").maybeSingle();
  if (flag && String(flag.value).toLowerCase() === "false") return json({ ok: true, skipped: "disabled" });
  if (!RESEND_KEY) return json({ error: "no_resend" }, 500);

  // TEST rezim: {"test_email":"..."} posle ukazku JEN na tuhle adresu a nikomu jinemu.
  // Driv se test_email tise ignoroval a spustil ostry rozesil (stalo se 17. 7.).
  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const testEmail = typeof body?.test_email === "string" && body.test_email.includes("@") ? body.test_email.trim() : null;
  const testKind: "report" | "register" = body?.test_kind === "register" ? "register" : "report";
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
  // Bez podmínky na expiraci by bývalému klientovi chodila pondělní připomínka reportu
  // dál, i když mu koučink skončil. Prázdná expirace = přístup bez konce, ten platí.
  const nyni = new Date().toISOString();
  const { data: ents } = await admin.from("entitlements").select("email")
    .eq("product", "coaching").eq("active", true)
    .or("expires_at.is.null,expires_at.gt." + nyni);
  const clients = [...new Set((ents ?? []).map((e) => low(e.email)))].filter(Boolean);
  if (!clients.length) return json({ ok: true, sent: 0 });

  // jen registrovaní (bez účtu nemá report kdo vyplnit — ty řeší pozvánka, ne pondělní mail)
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
  const { data: recent } = await admin.from("client_reports").select("email").gte("report_date", cutoff);
  const recentSet = new Set((recent ?? []).map((r) => low(r.email)));

  // per-klient opt-out (klient odepsal, že připomínky nechce → admin ho zapíše do CSV)
  const { data: opt } = await admin.from("app_config").select("value").eq("key", "client_remind_optout").maybeSingle();
  const optout = new Set(String(opt?.value ?? "").split(/[\s,;]+/).map((s) => low(s)).filter(Boolean));

  // oslovení z customer_contacts (křestní jméno v 5. pádu; bez jména padne na "Ahoj,")
  const { data: cc } = await admin.from("customer_contacts").select("email,name").in("email", clients);
  const nameBy = new Map<string, string>();
  for (const c of cc ?? []) {
    const raw = String(c.name ?? "").trim().split(/\s+/)[0];
    if (raw) nameBy.set(low(c.email), vokativ(raw.charAt(0).toUpperCase() + raw.slice(1)));
  }

  const pool = clients.filter((e) => !optout.has(e));
  const targets: { email: string; kind: "report" | "register" }[] = testEmail
    ? [{ email: testEmail, kind: testKind }]
    : [
        ...pool.filter((e) => registered.has(e) && !recentSet.has(e)).map((email) => ({ email, kind: "report" as const })),
        ...pool.filter((e) => !registered.has(e)).map((email) => ({ email, kind: "register" as const })),
      ];

  // Přílohy ze storage (stáhnou se jednou pro všechny; best effort, bez nich mail stejně odejde)
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
  let attachments: { filename: string; content: string }[] | undefined = ktNavod ? [ktNavod] : undefined;

  // Jednorázové okno: přiložit i nový návod klientské sekce a zmínit ho v textu.
  // ⛔ Datum bereme z hodin běhu, ne z parametru: parametr by šel omylem poslat kdykoli.
  const dnes = new Date().toISOString().slice(0, 10);
  const oknoNavodu = dnes >= NAVOD_OD && dnes <= NAVOD_DO;
  const sekceNavod = oknoNavodu ? await priloha(NAVOD_SOUBOR) : null;
  // Zmínku posíláme JEN když příloha opravdu je. Jinak by text sliboval přílohu,
  // která v mailu není, a to je horší než nezmínit nic.
  const zminNavod = !!sekceNavod;
  if (sekceNavod) attachments = [...(attachments ?? []), sekceNavod];

  let sent = 0;
  const errors: string[] = [];
  for (const tgt of targets) {
    const isReg = tgt.kind === "register";
    try {
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: FROM,
          to: [tgt.email],
          subject: isReg ? "Tvoje klientská sekce čeká (1 minuta)" : "Pondělní report ✍️ (3 minuty)",
          html: mailHtml(nameBy.get(tgt.email) ?? "", tgt.kind, !!ktNavod && !isReg, zminNavod && !isReg),
          reply_to: "martin@martinbarna.cz",
          // Pri testu je bcc zbytecne (mail uz jde na Martina) a mate: prisel by dvakrat.
          ...(testEmail ? {} : { bcc: ["fitness.barna@gmail.com"] }),
          ...(attachments && !isReg ? { attachments } : {}),
        }),
      });
      if (r.status === 200) sent++; else errors.push(tgt.email + ":" + r.status);
      await new Promise((res) => setTimeout(res, 550)); // Resend rate limit 2/s
    } catch (e) { errors.push(tgt.email + ":" + String(e).slice(0, 40)); }
  }
  const pocet = (k: string) => targets.filter((x) => x.kind === k).length;
  return json({ ok: true, mode: testEmail ? "test" : "live", clients: clients.length, targets: targets.length, report: pocet("report"), register: pocet("register"), sent, priloha: !!ktNavod, okno_navodu: oknoNavodu, navod_prilozen: zminNavod, errors });
});
