// Barna Academy — order-rescue: JEDNA pripominka nedokoncene objednavky.
// Zdroj: pending_orders (plni simpleshop-webhook ?event=order; platba oznaci completed).
// Okno: objednavka starsi nez 3 h (dost casu na zaplaceni) a mladsi nez 72 h (pak uz nespamovat).
// Pojistky: 1 pripominka na objednavku (reminded_at), zadny mail kdyz uz ma entitlement,
// max 10 mailu na beh. Auth: x-drip-secret. TEST: {test_email, product, name}.
import { createClient } from "jsr:@supabase/supabase-js@2";
import { sendIfAllowed } from "../_shared/mailing-guard.ts";
// ⭐ [16. 9. 2026] Odeslani pres spolecny helper, ktery si precte `id` z odpovedi
// Resendu a zapise ho do `email_events`. Bez toho se bounce ani stiznost na spam
// u teto cesty NEDAJI SPAROVAT a nic je nezastavi (nalez V1).
// ⛔ Stopa se tu NEZAPISUJE helperem: `order-rescue` uz svuj radek `px_odeslano`
// pise samo a druhy by ho zdvojil. Helper jen vrati `provider_id` do toho zapisu.
import { odesliPresResend } from "../_shared/resend-odeslat.ts";
// VLASTNI mereni otevreni a prokliku (protejsky: edge funkce mail-pixel a mail-klik).
// ⛔ Soubor je KOPIE, drz ho bajt na bajt shodny s drip-send/stopa.ts a milestones/stopa.ts;
//    hlida to test `drip-send/stopa.test.ts`.
import { ostopkuj } from "./stopa.ts";
// 14. 9. 2026: chyba cteni neni odpoved (guard secretu i fronta s opakovanim, pri trvale chybe 500).
import { chybaCteni, ctiSOpakovanim, overSecret } from "../_shared/secret-guard.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
// ⛔ Secret na podpis mericich odkazu. Jen z env. Kdyz chybi, mail odejde nezmereny.
const MAIL_TRACK_SECRET = Deno.env.get("MAIL_TRACK_SECRET") ?? "";
const FROM = "Martin Barna <news@martinbarna.cz>";
const MAX_PER_RUN = 10;

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { "Content-Type": "application/json" } });
const low = (s: unknown) => String(s ?? "").trim().toLowerCase();

// --- mini render (kompatibilni s email_templates blocks; gender = muzsky default) ---
type Block = { t: "p"; html: string } | { t: "bullets"; items: string[] } | { t: "btn"; text: string; href: string } | { t: "ps"; html: string } | { t: "img"; src: string; alt: string };
function gender(s: string): string {
  let out = "", i = 0;
  while (true) {
    const a = s.indexOf("[[", i);
    if (a < 0) { out += s.slice(i); break; }
    out += s.slice(i, a);
    const sep = s.indexOf("||", a + 2);
    const end = s.indexOf("]]", sep + 2);
    out += s.slice(sep + 2, end);
    i = end + 2;
  }
  return out.split("[a]").join("").split("[á]").join("ý");
}
function merge(s: string, v: Record<string, string>): string {
  let out = "", i = 0;
  while (true) {
    const a = s.indexOf("{{", i);
    if (a < 0) { out += s.slice(i); break; }
    out += s.slice(i, a);
    const end = s.indexOf("}}", a + 2);
    const key = s.slice(a + 2, end);
    out += key in v ? v[key] : "{{" + key + "}}";
    i = end + 2;
  }
  return out;
}
const fill = (s: string, v: Record<string, string>) => merge(gender(s), v);
// HTML atributy jsou tady v JEDNODUCHYCH uvozovkach, takze se escapuje i apostrof,
// jinak by text z atributu vyskocil. Shodne s attr() v drip-send.
const attr = (s: string) =>
  s.split("&").join("&amp;").split("<").join("&lt;").split(">").join("&gt;")
    .split('"').join("&quot;").split("'").join("&#39;");
function renderBlocks(blocks: Block[], v: Record<string, string>): string {
  return blocks.map((b) => {
    if (b.t === "p") return `<p style='margin:0 0 14px'>${fill(b.html, v)}</p>`;
    if (b.t === "ps") return `<p class='mb-ps' style='margin:16px 0 0;color:#A09AAD;font-style:italic'>${fill(b.html, v)}</p>`;
    if (b.t === "bullets")
      return `<ul style='margin:0 0 14px;padding-left:20px'>` + b.items.map((li) => `<li style='margin:0 0 9px'>${fill(li, v)}</li>`).join("") + `</ul>`;
    // Obrazek: sirka 100 % se stropem, aby na mobilu vyplnil a na desktopu nenafoukl.
    // Vsechny styly inline, mailove klienty externi CSS ignoruji. Drz 1:1 s drip-send.
    // ⛔ Tratim rescue-* dnes img blok NIKDO nedal, ale az ho tam nekdo da, bez teto
    //    vetve by zachranny mail k nedokoncene objednavce SPADL na TypeError (img propadne
    //    do vetve pro tlacitko a cte b.href a b.text, ktere obrazek nema).
    if (b.t === "img")
      return `<img src='${attr(fill(b.src, v))}' alt='${attr(fill(b.alt, v))}' width='100%' style='max-width:480px;height:auto;display:block;margin:16px auto;border-radius:8px'>`;
    if (b.t === "btn")
      return `<p style='margin:4px 0 18px'><a class='mb-btn' href='${fill(b.href, v)}' style='display:inline-block;background:#EBB12C;color:#1A1222;text-decoration:none;padding:13px 24px;border-radius:50px;font-weight:700'>${fill(b.text, v)}</a></p>`;
    // ⛔ VYSLOVNY pripad pro neznamy typ. Driv tady byl HOLY return s tlacitkem, takze
    //    kazdy typ, ktery renderer nezna, se tise zpracoval jako tlacitko a spadl na tom,
    //    ze nema href ani text. Radsi chyba se JMENEM typu: zachranny mail k objednavce
    //    s tise vynechanym blokem muze prijit bez odkazu na platbu, a to je horsi
    //    nez mail, ktery nedojde a je videt v chybach behu.
    throw new Error("neznamy_typ_bloku:" + (b as { t: string }).t);
  }).join("\n");
}
function wrap(preheader: string, body: string): string {
  const foot = "Martin Barna, online výživový kouč · IČO 76383032 · <a class='mb-mut' href='https://martinbarna.cz' style='color:#999'>martinbarna.cz</a><br>Tento e-mail ti přišel jako jednorázová připomínka objednávky, kterou jsi rozpracoval na martinbarna.cz. Žádné další maily k ní nedostaneš.";
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
    `</style></head>` +
    `<body class='mb-bg' style='margin:0;background:#0C0B10;padding:16px'>` +
    `<span style='display:none!important;opacity:0;color:transparent;height:0;width:0;overflow:hidden'>${preheader}</span>` +
    `<div class='mb-card mb-body' style='font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;font-size:16px;line-height:1.55;color:#F0EADF;max-width:560px;margin:0 auto;background:#181520;border:1px solid #262232;border-radius:14px;padding:28px'>` +
    `<div class='mb-brand' style='border-left:3px solid #EBB12C;padding-left:10px;font-weight:800;font-size:13px;letter-spacing:.2em;text-transform:uppercase;color:#EBB12C;margin:0 0 20px'>Martin Barna</div>` +
    body + `<hr style='border:none;border-top:1px solid #262232;margin:22px 0 14px'><div class='mb-mut' style='font-size:12px;line-height:1.5;color:#8F8A99'>${foot}</div></div></body></html>`;
}
// ===== 5. pad (vokativ) — kanonicka verze, drz v synci s drip-send =====
const VOK_EXC: Record<string, string> = {
  "jan": "Jene", "pavel": "Pavle", "karel": "Karle", "havel": "Havle", "pavol": "Pavle",
  "zdenek": "Zdenku", "zdeněk": "Zdeňku", "zbynek": "Zbynku", "zbyněk": "Zbyňku",
  "josef": "Josefe", "luboš": "Luboši", "lubos": "Luboši", "bartoloměj": "Bartoloměji",
  "vavřinec": "Vavřinče", "vavrinec": "Vavrinče", "němec": "Němče",
};
const MALE_NAMES = new Set<string>([
  "martin","david","tomáš","tomas","lukáš","lukas","petr","jakub","ondřej","ondrej","marek","michal","michael",
  "filip","vojtěch","vojtech","patrik","patrick","radek","roman","adam","matěj","matej","štěpán","stepan","vít","vit",
  "václav","vaclav","jaroslav","miroslav","stanislav","ladislav","bohuslav","bronislav","rostislav","přemysl","premysl",
  "bohumil","kamil","emil","dalibor","otakar","richard","robert","norbert","albert","rudolf","adolf","oldřich","oldrich",
  "bedřich","bedrich","jindřich","jindrich","vladimír","vladimir","dušan","dusan","milan","alois","ivan","igor","marcel",
  "daniel","gabriel","samuel","dominik","erik","viktor","hynek","čeněk","cenek","kristián","kristian","sebastián","sebastian",
  "maxmilián","maximilián","maximilian","kryštof","krystof","tobiáš","tobias","matyáš","matyas","mikuláš","mikulas","šimon","simon",
  "damián","damian","fabián","fabian","julián","julian","benedikt","arnošt","arnost","evžen","evzen","augustin","antonín","antonin",
  "valentýn","valentyn","radim","vilém","vilem","radovan","miloslav","svatopluk","vratislav","zbyšek","zbysek","aleš","ales",
  "denis","dennis","nikolas","kevin","leon","vlastimil","radomír","radomir","lumír","lumir","ctibor","branislav","jáchym","jachym",
  "kašpar","kaspar","melichar","řehoř","rehor","florián","florian","teodor","theodor","nikolaj","boris",
  "radoslav","miloš","milos","bořek","borek","vladan","hubert","herbert","gustav","ferdinand","leopold","konrád","konrad",
  "arnold","zikmund","matouš","matous","kilián","kilian","mojmír","mojmir",
]);
const FEMALE_NAMES = new Set<string>([
  "ester","dagmar","miriam","karin","karyn","nikol","ingrid","rút","rut","judit","edit","ráchel","rachel",
  "dolores","doris","agnes","mercedes","karmen","carmen","sarah","deborah","abigail","gwen","lilian","vivien",
  "kristin","kristýn","katrin","madlen","jennifer","žaneta",
]);
const VOK_VOWELS = "aeiouyáéěíóúůý";
const isMaleName = (low: string) => (low in VOK_EXC) || MALE_NAMES.has(low);
function vokativ(fn: string, seg: string): string {
  if (!fn) return fn;
  const low = fn.toLowerCase();
  const last = low.slice(-1);
  if (last === "a") return fn.slice(0, -1) + "o";
  if (VOK_VOWELS.includes(last)) return fn;
  if (FEMALE_NAMES.has(low)) return fn;
  if (seg === "zeny" && !isMaleName(low)) return fn;
  if (low in VOK_EXC) return VOK_EXC[low];
  if (low.endsWith("ek")) return fn.slice(0, -2) + "ku";
  if (low.endsWith("ch") || "kgh".includes(last)) return fn + "u";
  if ("szxj".includes(last) || "šžčř".includes(last)) return fn + "i";
  if (low.endsWith("el")) return fn + "i";
  if (last === "r") {
    return VOK_VOWELS.includes(low.slice(-2, -1)) ? fn + "e" : fn.slice(0, -1) + "ře";
  }
  if ("bdflmnptvw".includes(last)) return fn + "e";
  return fn;
}
function vars(name: string): Record<string, string> {
  const t = (name || "").trim().split(" ")[0] || "";
  const fn = vokativ(t ? t.charAt(0).toUpperCase() + t.slice(1) : "", "");
  return { first_name: fn, fn_space: fn ? " " + fn : "", fn_suffix: fn ? ", " + fn : "", fn_prefix: fn ? fn + ", " : "" };
}
/**
 * Vraci `provider_id` zasilky (aby se dalo dopsat do `px_odeslano`) A STATUS.
 *
 * ⛔ [17. 9. 2026, nalez A/N10] Driv tahle funkce pri neuspechu HAZELA vyjimku a volajici
 *    z ni uz nepoznal, JESTLI mail odesel. To ted rozhoduje o tom, jestli se razitko
 *    `reminded_at` vrati zpet (a cron to za dve hodiny zkusi znovu), nebo zustane.
 *    Proto se vraci cely vysledek, ne jen ID.
 */
async function send(to: string, subject: string, html: string): Promise<{ ok: boolean; status: number; providerId: string; chyba: string }> {
  if (!RESEND_KEY) return { ok: false, status: 0, providerId: "", chyba: "missing_RESEND_API_KEY" };
  const r = await odesliPresResend(
    RESEND_KEY,
    { from: FROM, to: [to], subject, html, reply_to: "martin@martinbarna.cz" },
  );
  return { ok: r.ok, status: r.status, providerId: r.providerId, chyba: r.chyba ?? "" };
}

/**
 * Alert Martinovi. ⛔ Nejde pres `sendIfAllowed`: brana chrani adresu zakaznika, ne
 * Martinovu, a kdyby jeho adresa skoncila na seznamu, prestal by se dozvidat prave
 * ta selhani, kvuli kterym alert existuje. (Tyz vzor jako `splatky-guard`.)
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
  } catch { /* zustava fallback */ }
  const r = await send(to, subject, `<pre style="font-family:inherit;white-space:pre-wrap">${text}</pre>`);
  return r.ok;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method" }, 405);
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

  // Sedi / nesedi 401 / NEPRECTENO 500 (ne 401).
  const brana = await overSecret(admin, req, { header: "x-drip-secret" });
  if (!brana.ok) return json(brana.body, brana.status);

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  const getTpl = async (product: string) => {
    const track = product === "academy" ? "rescue-academy" : "rescue-videokurz";
    const { data } = await admin.from("email_templates").select("subject,preheader,blocks,key").eq("track", track).eq("step", 0).maybeSingle();
    return data ? { ...(data as { subject: string; preheader: string; blocks: Block[]; key: string }), track } : null;
  };

  // TEST: nahled Martinovi, nic nezapisovat
  if (typeof body.test_email === "string" && body.test_email.includes("@")) {
    const tpl = await getTpl(String(body.product || "videokurz"));
    if (!tpl) return json({ error: "no_template" }, 400);
    const v = vars(String(body.name ?? ""));
    // ⭐ [17. 9. 2026] Vysledek testovaciho odeslani se vraci v odpovedi. Driv se
    //    zahazoval a "ok: true" znamenalo jen "brana pustila", ne "mail odesel".
    let testOdpoved: { ok: boolean; status: number } | null = null;
    // ⛔ TEST rezim se ZAMERNE nemeri: nahled Martinovi by vyrobil otevreni a proklik
    //    bez odpovidajiciho odeslani a nafoukl by statistiku trate.
    const d = await sendIfAllowed(admin, {
      email: String(body.test_email),
      mailClass: "optional_reminder",
      functionName: "order-rescue",
      path: "order-rescue",
    }, async () => { testOdpoved = await send(String(body.test_email), "[TEST] " + fill(tpl.subject, v), wrap(fill(tpl.preheader, v), renderBlocks(tpl.blocks, v))); });
    // ⚠️ Pretypovani: TypeScript neumi videt prirazeni uvnitr callbacku a zuzil by typ na `never`.
    const to = testOdpoved as { ok: boolean; status: number } | null;
    return json({ ok: true, mode: "test", mail: d.action, reason: d.reason, odeslano: to?.ok ?? null, status: to?.status ?? null });
  }

  // LIVE: objednavky 3-72 h stare, nedokoncene, bez pripominky
  const now = Date.now();
  const from72 = new Date(now - 72 * 3600000).toISOString();
  const to3 = new Date(now - 3 * 3600000).toISOString();
  // ⛔ Chyba cteni fronty = 500, ne `due: 0`: prazdno kvuli 504 by vypadalo jako klidny beh.
  const pendR = await ctiSOpakovanim<{ data: Array<{ order_id: string; email: string; product: string; name: string | null; created_at: string }> | null; error: unknown }>(() =>
    admin.from("pending_orders")
      .select("order_id,email,product,name,created_at")
      .eq("completed", false).is("reminded_at", null)
      .gte("created_at", from72).lte("created_at", to3)
      // ⛔⛔ [13. 9. 2026] Nacita se VIC radku, nez kolik se smi odeslat mailu, a strop
      // se pocita az z ODESLANYCH (`if (sent >= MAX_PER_RUN) break` nize). Duvod: radek,
      // ktery se preskoci (uz ma pristup, chybi sablona, docasny skip brany), drive
      // spotreboval jedno z deseti mist. Ve spojeni s `order by created_at` to znamenalo,
      // ze deset nejstarsich zaseknutych objednavek drzelo celou frontu, dokud jim
      // neuteklo okno 72 h, a novejsi kosik nedostal jedinou sanci. `MAX_PER_RUN` mel
      // byt strop na MAILY (viz komentar v hlavicce souboru), ne na prectene radky.
      .order("created_at", { ascending: true }).limit(MAX_PER_RUN * 3));
  if (pendR.error) return json(chybaCteni("pending_orders", pendR.error), 500);
  const pend = pendR.data;

  let sent = 0, skipped = 0;
  const results: Record<string, unknown>[] = [];
  // ⛔ [R1, nález N5] STROP ALERTŮ. Při výpadku sítě by z jednoho běhu odešlo až deset
  //    stejných mailů Martinovi (a cron jede každé dvě hodiny). Dál se už jen počítá
  //    a celé číslo je v odpovědi.
  const MAX_ALERTU = 3;
  let alertuPoslano = 0;
  let alertuPotlaceno = 0;
  const alertSeStropem = async (subject: string, text: string): Promise<boolean> => {
    if (alertuPoslano >= MAX_ALERTU) { alertuPotlaceno++; return false; }
    alertuPoslano++;
    return await alertMartinovi(admin, subject, text);
  };
  for (const p of pend ?? []) {
    if (sent >= MAX_PER_RUN) break; // strop je na odeslane maily, ne na prectene radky
    const email = low(p.email);
    // pojistka: uz ma pristup (koupil pod jinou objednavkou)? -> oznac a preskoc
    // Expirace: expirovane clenstvi se NEpocita jako "uz ma pristup", jinak by clovek,
    // kteremu mesicni Academy dobehla a znovu si objednava, nedostal zachranny mail.
    // NULL = dozivotni. Viz `mb-academy-pricing-mise`.
    // ⛔ Nepřečtený nárok NENÍ „nemá přístup": clovek by dostal zachranny mail k necemu, co ma.
    const { data: ent, error: entErr } = await admin.from("entitlements").select("email")
      .eq("email", email).eq("product", p.product).eq("active", true)
      .or("expires_at.is.null,expires_at.gt." + new Date().toISOString()).limit(1);
    if (entErr) { skipped++; results.push({ order: p.order_id, error: "entitlements_neprecteno" }); continue; }
    if (ent && ent.length) {
      await admin.from("pending_orders").update({ completed: true }).eq("order_id", p.order_id);
      skipped++; continue;
    }
    const tpl = await getTpl(String(p.product));
    if (!tpl) { skipped++; continue; }
    try {
      const v = vars(String(p.name ?? ""));
      // MERENI: zachranny mail nese odkaz na PLATBU, takze proklik je tady nejcennejsi
      // cislo v celem mailingu. Lead nemusi existovat (objednavka chodi i od cloveka, ktery
      // nikdy nebyl v `leads`); pak se zmeri trat a krok, jen to nejde pripsat osobe.
      const { data: ld } = await admin.from("leads").select("id").eq("email", email).maybeSingle();
      const leadId = ld?.id ? String(ld.id) : null;
      const holeHtml = wrap(fill(tpl.preheader, v), renderBlocks(tpl.blocks, v));
      const html = await ostopkuj(holeHtml, { track: tpl.track, step: 0, key: String(tpl.key ?? ""), lead_id: leadId }, MAIL_TRACK_SECRET, SUPABASE_URL);
      let providerId = "";
      // ⛔⛔ [17. 9. 2026, nález A/N10] RAZÍTKO SE PÍŠE PŘED ODESLÁNÍM A JEHO CHYBA SE ČTE.
      //    Do 17. 9. se `reminded_at` zapisovalo AŽ PO odeslání a návratová hodnota se
      //    zahazovala. Když update selhal (504 brány Supabase, o kterém je celý
      //    `tvujcoach-supabase-504-opakovani`), mail už odešel, razítko chybělo a cron
      //    každé dvě hodiny poslal totéž znovu, až 36krát za okno 72 h.
      //    ⇒ Politika je stejná jako u `client-remind` (Martin 17. 9.: raději nikdy mail navíc):
      //      zapiš, pak pošli; výslovné odmítnutí Resendu razítko vrátí, nejistota ho nechá.
      let razitkoChyba = "";
      let odeslani: { ok: boolean; status: number; providerId: string; chyba: string } | null = null;
      const d = await sendIfAllowed(admin, {
        email,
        mailClass: "optional_reminder",
        functionName: "order-rescue",
        path: "order-rescue",
      }, async () => {
        const { error: razErr } = await admin.from("pending_orders")
          .update({ reminded_at: new Date().toISOString() }).eq("order_id", p.order_id);
        if (razErr) { razitkoChyba = razErr.message; return; } // ⛔ bez razítka NEODESÍLAT
        odeslani = await send(email, fill(tpl.subject, v), html);
        providerId = odeslani.providerId;
      });
      if (d.action === "skip") {
        // ⛔⛔ [13. 9. 2026] Označ, ať cron nezkouší totéž okno znovu, ALE JEN KDYŽ
        // JE DŮVOD TRVALÝ. (Dřív tu stálo jen "unsub je trvalý" a označovalo se vždy.) `mailing-guard` vrací
        // `suppression_load_failed`, když se mu nepodaří NAČÍST seznam odhlášených: třída
        // `optional_reminder` má bránu fail-closed, takže jedna chyba dotazu vypadá stejně
        // jako odhlášení. Spálit kvůli ní JEDINOU připomínku znamená, že člověk
        // s nedokončenou objednávkou už nedostane nic. Stejný vzor jako u poukázky.
        // ⇒ Vypaluje se jen důvod, který je opravdu trvalý; při pochybnosti radši znovu.
        const trvalyDuvod = d.reason === "invalid_email" || d.reason === "hard_bounce" || d.reason === "hard_unsubscribe";
        if (trvalyDuvod) {
          await admin.from("pending_orders").update({ reminded_at: new Date().toISOString() }).eq("order_id", p.order_id);
        }
        skipped++;
        results.push({ order: p.order_id, skipped: d.reason, spaleno: trvalyDuvod });
        continue;
      }
      // Razítko se zapsalo? Když ne, mail vůbec neodešel a další běh to zkusí znovu.
      if (razitkoChyba) {
        console.error("[order-rescue] RAZITKO reminded_at NEZAPSANO, mail NEODESLAN: " + p.order_id + " " + razitkoChyba);
        skipped++;
        results.push({ order: p.order_id, razitko: "SELHALO", odeslano: false, detail: razitkoChyba.slice(0, 120) });
        continue;
      }
      const o = odeslani as { ok: boolean; status: number; providerId: string; chyba: string } | null;
      if (!o || !o.ok) {
        // ⛔⛔ ROZHODUJE, JESTLI TĚLO MAILU MOHLO DOJÍT NA RESEND (R1 nález N1, R2 nález R2-2).
        //    Verze z R1 dělila jen podle statusu. Jenže `status: 0` má DVĚ různé příčiny,
        //    které helper rozlišuje textem chyby (`_shared/resend-odeslat.ts`):
        //      - `missing_RESEND_API_KEY`: požadavek se ani nesestavil => JISTĚ neodešlo,
        //      - `sit:…`: spadl `fetch`, ale tělo už na Resendu být MOHLO.
        //    ⇒ NEJISTOTA = `status >= 500` NEBO chyba začínající `sit:`.
        //  a) jisté neodeslání => razítko zpět na null, ať to cron za dvě hodiny zkusí
        //     znovu (okno 72 h). Zároveň se zapíše stopa do `email_events` (viz níž).
        //  b) nejistota => razítko ZŮSTANE (mail se neopakuje) a Martin dostane alert.
        // ⚠️ Při chybějícím klíči by selhal i alert, jde týmž `send()`. Proto u toho stavu
        //    žádný alert nečekáme a spoléhá se na stopu v DB.
        const stav = o?.status ?? 0;
        const teloMohloDojit = stav >= 500 || String(o?.chyba ?? "").startsWith("sit:");
        // ⛔⛔ [R2, nález R2-1] STOPA PO NEÚSPĚCHU. `order-rescue` předává helperu odeslání
        //    BEZ `stopa` (svůj řádek `px_odeslano` si píše samo a druhý by ho zdvojil),
        //    takže helper po neúspěchu nezapíše nic. Bez tohohle řádku by vrácené razítko
        //    nezanechalo v DB žádný důkaz a trvalá 4xx by byla úplně tichá.
        //    ⚠️ Typ je `odeslani_chyba`, stejný jako píše helper: sjednocené dohledávání
        //    (`select detail->>'via', count(*) from email_events where type='odeslani_chyba'`).
        //    ⛔ Ne `error`: ten typ čte živý jistič `followups_circuit_breaker` a zavíral by
        //    kvůli téhle cestě prodejní maily celé Academy (viz komentář v `resend-odeslat.ts`).
        const { error: stopaErr } = await admin.from("email_events").insert({
          lead_id: leadId, step: 0, type: "odeslani_chyba",
          detail: {
            via: "order-rescue", track: tpl.track, email, status: stav,
            error: String(o?.chyba ?? "").slice(0, 180),
            razitko: teloMohloDojit ? "zustava" : "vraceno",
          },
        });
        if (stopaErr) console.error("[order-rescue] zapis odeslani_chyba selhal: " + stopaErr.message);
        if (!teloMohloDojit) {
          const { error: zpetErr } = await admin.from("pending_orders")
            .update({ reminded_at: null }).eq("order_id", p.order_id);
          if (zpetErr) {
            // ⛔ Razítko drží a mail neodešel. Tohle je jediný stav téhle větve, o kterém
            //    se nikdo jinak nedozví, proto tady alert JE (R1, nález N2).
            console.error("[order-rescue] VRACENI razitka selhalo: " + p.order_id + " " + zpetErr.message);
            await alertSeStropem(
              "[VYRIDIT RUCNE] order-rescue: razitko drzi, mail neodesel (" + email + ")",
              "Objednavka " + p.order_id + " (" + p.product + "), adresa " + email + ".\n\n"
                + "Zachranny mail Resend NEPRIJAL (status " + stav + ": " + (o?.chyba || "") + "),\n"
                + "takze jiste neodesel. Vraceni razitka reminded_at ale taky selhalo:\n"
                + zpetErr.message.slice(0, 160) + "\n\n"
                + "Dusledek: cron uz tu objednavku nikdy nevezme. Smaz jí reminded_at rucne\n"
                + "(order_id=" + p.order_id + "), dokud je v okne 72 h.",
            );
          }
          results.push({ order: p.order_id, odeslano: false, status: stav, razitko: zpetErr ? "ZUSTALO" : "VRACENO" });
        } else {
          const doslo = await alertSeStropem(
            "[VYRIDIT RUCNE] order-rescue: nejiste odeslani (" + email + ")",
            "Objednavka " + p.order_id + " (" + p.product + "), adresa " + email + ".\n\n"
              + "Zachranny mail se nepodarilo odeslat: " + (o?.chyba || "sit nebo timeout") + ".\n"
              + "Stav: NEVIME, jestli mail odesel. Razitko reminded_at zustava zapsane,\n"
              + "takze zadny dalsi beh cronu ho uz neposle.\n\n"
              + "Co s tim: kdyz clovek nic nedostal a objednavka je porad nedokoncena,\n"
              + "smaz mu reminded_at (order_id=" + p.order_id + ") a nech to na dalsim behu.",
          );
          if (!doslo) console.error("[order-rescue] ALERT MARTINOVI NEODESEL: " + p.order_id);
          results.push({ order: p.order_id, odeslano: "nejiste", status: stav, alert: doslo });
        }
        skipped++;
        continue;
      }
      // ⛔ Jmenovatel pro open a click rate. `order-rescue` do `email_events` historicky
      //    nezapisovala nic, takze bez tohohle by otevrenost vychazela proti nule odeslanych.
      //    Typ je `px_odeslano`, ne `sent`, aby se nezmenila cisla v `email_summary`,
      //    `daily-digest` ani denni strop v `drip-send`.
      // ⚠️ Chyba se jen loguje: `reminded_at` uz je zapsane a vyjimka by z uspesne
      //    odeslaneho mailu udelala chybu v `results`.
      // ⛔ [16. 9. 2026] `provider_id` je jedina vec, podle ktere `resend-webhook`
      //    pozna, ke komu patri bounce nebo stiznost na spam (nalez V1).
      const { error: evErr } = await admin.from("email_events").insert({
        lead_id: leadId, step: 0, type: "px_odeslano",
        provider_id: providerId || null,
        detail: { track: tpl.track, key: String(tpl.key ?? ""), fn: "order-rescue", via: "order-rescue", email },
      });
      if (evErr) console.error("[order-rescue] zapis px_odeslano selhal: " + evErr.message);
      sent++; results.push({ order: p.order_id, product: p.product });
    } catch (e) {
      results.push({ order: p.order_id, error: String(e).slice(0, 100) });
    }
  }
  return json({ ok: true, due: (pend ?? []).length, sent, skipped, alerty_potlaceno: alertuPotlaceno, results });
});
