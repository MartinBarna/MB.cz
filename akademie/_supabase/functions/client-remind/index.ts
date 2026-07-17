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
const REG_URL = "https://martinbarna.cz/akademie/prihlaseni/?next=%2Fakademie%2Fklient%2F";

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

function mailHtml(osloveni: string, kind: "report" | "register"): string {
  const p = (t: string) => `<p style='margin:0 0 14px'>${t}</p>`;
  const cta = (href: string, label: string) =>
    `<p style='margin:4px 0 18px'><a href='${href}' style='display:inline-block;background:#EBB12C;color:#1A1222;text-decoration:none;padding:13px 26px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;font-size:15px'>${label}</a></p>`;
  const telo = kind === "register"
    ? p("zatím nemáš přístup do své klientské sekce. Bez něj mi nepošleš týdenní report a já ti nedoladím plán.") +
      cta(REG_URL, "Založit přístup") +
      p("<span style='color:#A09AAD;font-size:14px'>Zabere to minutu. Přihlásíš se tímhle e-mailem a heslo si nastavíš sám. Uvnitř máš týdenní report, svoje grafy a historii i appku Tvůj Coach v ceně koučinku.</span>") +
      p("<span style='color:#A09AAD;font-size:14px'>Kdyby něco nefungovalo, odepiš mi na tenhle mail a vyřešíme to.</span>")
    : p("nový týden, nová data 💪 Mrkni na váhu a hoď mi <strong>týdenní report</strong>. Zabere ~3 minuty a já ti podle něj doladím plán.") +
      cta(CTA_URL, "Vyplnit report (3 min)") +
      p("<span style='color:#A09AAD;font-size:14px'>Zapisuješ si jídlo v Kalorických tabulkách? V příloze máš návod, jak z nich data vytáhnout jedním klikem a nahrát do reportu. Nemusíš nic opisovat.</span>") +
      p("<span style='color:#A09AAD;font-size:14px'>Tip: zvaž se ráno nalačno a vezmi metr na hruď, pas, boky, zadek a stehna. Míry řeknou víc než váha. Jedeš v Kalorických tabulkách? Průměr kcal najdeš ve Statistiky → Analýza jídelníčku.</span>");
  return `<!doctype html><html lang='cs'><head><meta charset='utf-8'><meta name='color-scheme' content='dark'></head><body style='margin:0;padding:0;background:#0C0B10'>` +
    `<table role='presentation' width='100%' cellpadding='0' cellspacing='0' border='0' bgcolor='#0C0B10'><tr><td align='center' style='padding:16px'>` +
    `<table role='presentation' width='560' cellpadding='0' cellspacing='0' border='0' bgcolor='#181520' style='width:100%;max-width:560px;background:#181520;border-radius:2px;border:1px solid #262232'><tr><td style='padding:28px;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;font-size:16px;line-height:1.55;color:#F0EADF'>` +
    `<div style='border-left:3px solid #EBB12C;padding-left:10px;font-weight:800;font-size:13px;letter-spacing:.2em;text-transform:uppercase;color:#EBB12C;margin:0 0 20px'>Martin Barna</div>` +
    p(osloveni ? "Ahoj " + osloveni + "," : "Ahoj,") +
    telo +
    p("<strong>Be Effective!</strong><br>Martin") +
    `<hr style='border:none;border-top:1px solid #262232;margin:22px 0 14px'><div style='font-size:12px;color:#8F8A99'>Martin Barna · martinbarna.cz · připomínka pro klienty koučinku. Nechceš je? Odepiš mi na tenhle mail a vypnu ti je.</div>` +
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

  // klienti s aktivním coaching entitlementem
  const { data: ents } = await admin.from("entitlements").select("email").eq("product", "coaching").eq("active", true);
  const clients = [...new Set((ents ?? []).map((e) => low(e.email)))].filter(Boolean);
  if (!clients.length) return json({ ok: true, sent: 0 });

  // jen registrovaní (bez účtu nemá report kdo vyplnit — ty řeší pozvánka, ne pondělní mail)
  const registered = new Set<string>();
  let page = 1;
  while (page < 20) {
    const { data: u } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    for (const usr of u?.users ?? []) registered.add(low(usr.email));
    if (!u || u.users.length < 200) break;
    page++;
  }

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

  // KT návod jako příloha (stáhne se jednou pro všechny; best effort — bez něj mail stejně odejde)
  let attachments: { filename: string; content: string }[] | undefined;
  try {
    const { data: pdf } = await admin.storage.from("client-docs").download("shared/kaloricke-tabulky-navod.pdf");
    if (pdf) {
      const buf = new Uint8Array(await pdf.arrayBuffer());
      let bin = "";
      for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
      attachments = [{ filename: "kaloricke-tabulky-navod.pdf", content: btoa(bin) }];
    }
  } catch (_e) { /* příloha je bonus, ne blokace */ }

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
          subject: isReg ? "Chybí ti přístup do klientské sekce (1 minuta)" : "Pondělní report ✍️ (3 minuty)",
          html: mailHtml(nameBy.get(tgt.email) ?? "", tgt.kind),
          reply_to: "martin@martinbarna.cz",
          bcc: ["fitness.barna@gmail.com"],
          ...(attachments && !isReg ? { attachments } : {}),
        }),
      });
      if (r.status === 200) sent++; else errors.push(tgt.email + ":" + r.status);
      await new Promise((res) => setTimeout(res, 550)); // Resend rate limit 2/s
    } catch (e) { errors.push(tgt.email + ":" + String(e).slice(0, 40)); }
  }
  const pocet = (k: string) => targets.filter((x) => x.kind === k).length;
  return json({ ok: true, mode: testEmail ? "test" : "live", clients: clients.length, targets: targets.length, report: pocet("report"), register: pocet("register"), sent, priloha: !!attachments, errors });
});
