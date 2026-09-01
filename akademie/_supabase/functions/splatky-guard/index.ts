// Barna Academy — splatky-guard: hlidac neuhrazenych splatek (produkt "na splatky").
// Denni cron (6:10 UTC = 8:10 Prahy) pres x-drip-secret (app_config drip_invoke_secret).
// Logika (data plni simpleshop-webhook &plan=splatky do installment_status):
//  - splatka se ceka kazdych ~30 dni; WARN_AFTER_DAYS po posledni platbe -> upozornovaci
//    e-mail (status ok -> warned)
//  - SUSPEND_AFTER_WARN_DAYS po upozorneni bez platby -> docasne pozastaveni pristupu
//    (entitlements active=false, JEN source=simpleshop) + e-mail (warned -> suspended)
//  - nova platba pristup sama obnovi (webhook upsertuje entitlement active=true
//    a status vrati na ok/completed) — guard uz nic resit nemusi
// Test rezim: POST {"test_email":"..."} posle oba maily s [TEST] na zadanou adresu, data NEMENI.
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_KEY = Deno.env.get("RESEND_API_KEY") ?? "";

const WARN_AFTER_DAYS = 33;        // 30 dni cyklus + 3 dny tolerance
const SUSPEND_AFTER_WARN_DAYS = 7; // tyden na napravu po upozorneni

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { "Content-Type": "application/json" } });

// 5. pad (osloveni): stejna konzervativni pravidla jako v drip-send — nejista
// jmena zustavaji v 1. padu, zenska jmena na souhlasku se nemeni.
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

function greet(name: string | null, seg = "other"): string {
  const raw = (name || "").trim().split(/\s+/)[0];
  const first = raw ? vokativ(raw.charAt(0).toUpperCase() + raw.slice(1), seg) : "";
  return first ? `Ahoj ${first},` : "Ahoj,";
}

function wrap(body: string): string {
  return `<div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;font-size:15px;line-height:1.6;color:#222;max-width:560px;margin:0 auto">${body}` +
    `<p style="margin:18px 0 0">Martin</p>` +
    `<p style="margin:14px 0 0;font-size:12px;color:#999">Martin Barna · Barna Academy · <a href="https://martinbarna.cz" style="color:#c45e00">martinbarna.cz</a> · odpovědět můžeš rovnou na tenhle e-mail</p></div>`;
}

function warnEmail(name: string | null, seg = "other") {
  return {
    subject: "Splátka za Barna Academy neproběhla",
    html: wrap(
      `<p>${greet(name, seg)}</p>` +
      `<p>dnes se nepodařilo strhnout další splátku <b>3 000 Kč</b> za Barna Academy. Většinou za to může expirovaná karta, denní limit nebo málo prostředků na účtu. Zkontroluj to prosím.</p>` +
      `<p>Kdyby cokoliv nehrálo (změna karty, potřebuješ posunout termín), <b>odepiš mi rovnou na tenhle e-mail</b> a vyřešíme to spolu.</p>` +
      `<p style="padding:10px 14px;background:#fdf3ec;border-radius:10px">⚠️ Pokud se splátku nepodaří uhradit do <b>7 dnů</b>, budu muset přístup k Academy dočasně pozastavit. Po doplacení se obnoví automaticky.</p>`
    ),
  };
}

function suspendEmail(name: string | null, seg = "other") {
  return {
    subject: "Přístup k Barna Academy dočasně pozastaven",
    html: wrap(
      `<p>${greet(name, seg)}</p>` +
      `<p>splátku za Barna Academy se bohužel nepodařilo strhnout ani týden po upozornění, takže jsem musel tvůj přístup <b>dočasně pozastavit</b>.</p>` +
      `<p>Žádný stres: <b>jakmile splátka proběhne, přístup se ti obnoví automaticky</b> během pár minut a pokračuješ přesně tam, kde jsi skončil(a).</p>` +
      `<p>Kdyby ses zasekl(a) na čemkoliv (karta, termín, cokoliv), napiš mi na tenhle e-mail a domluvíme se.</p>`
    ),
  };
}

async function sendMail(to: string, subject: string, html: string): Promise<boolean> {
  if (!RESEND_KEY) return false;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: "Bearer " + RESEND_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ from: "Martin Barna <news@martinbarna.cz>", to: [to], subject, html }),
  });
  return res.ok;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method" }, 405);
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

  const { data: cfg } = await admin.from("app_config").select("value").eq("key", "drip_invoke_secret").maybeSingle();
  const secret = cfg?.value ? String(cfg.value) : "";
  const provided = req.headers.get("x-drip-secret") || "";
  if (!secret || provided !== secret) return json({ error: "unauthorized" }, 401);

  // Test rezim: oba maily na zadanou adresu, zadna zmena dat.
  const body = await req.json().catch(() => ({}));
  if (body?.test_email) {
    const to = String(body.test_email);
    const w = warnEmail("Martin", "muzi"), s = suspendEmail("Martin", "muzi");
    const ok1 = await sendMail(to, "[TEST] " + w.subject, w.html);
    const ok2 = await sendMail(to, "[TEST] " + s.subject, s.html);
    return json({ ok: true, mode: "test", to, warn_sent: ok1, suspend_sent: ok2 });
  }

  const now = Date.now();
  const warnCutoff = new Date(now - WARN_AFTER_DAYS * 86400000).toISOString();
  const suspendCutoff = new Date(now - SUSPEND_AFTER_WARN_DAYS * 86400000).toISOString();

  const { data: rows } = await admin.from("installment_status")
    .select("email,payments_n,last_paid_at,status,warned_at")
    .gte("payments_n", 1).lt("payments_n", 3).in("status", ["ok", "warned"]);

  const warned: string[] = [], suspended: string[] = [];
  for (const r of rows ?? []) {
    const email = String(r.email);
    // jmeno + segment pro osloveni (best-effort z leads)
    let name: string | null = null;
    let seg = "other";
    try {
      const { data: l } = await admin.from("leads").select("name,segment").eq("email", email).maybeSingle();
      name = l?.name ?? null;
      if (l?.segment === "muzi" || l?.segment === "zeny") seg = String(l.segment);
    } catch { /* bez jmena */ }

    if (r.status === "ok" && r.last_paid_at && String(r.last_paid_at) < warnCutoff) {
      const m = warnEmail(name, seg);
      const sent = await sendMail(email, m.subject, m.html);
      if (sent) {
        await admin.from("installment_status").update({
          status: "warned", warned_at: new Date().toISOString(), updated_at: new Date().toISOString(),
        }).eq("email", email);
        warned.push(email);
        try { await admin.from("email_events").insert({ lead_id: null, step: 0, type: "sent", detail: { track: "splatky-guard", kind: "warn", email } }); } catch { /* log best-effort */ }
      }
    } else if (r.status === "warned" && r.warned_at && String(r.warned_at) < suspendCutoff) {
      // pozastav JEN simpleshop grant (rucni/admin granty nechavame byt)
      await admin.from("entitlements").update({ active: false })
        .eq("email", email).eq("product", "academy").eq("source", "simpleshop");
      // Pozastaveni Academy zamkne i appku Tvuj Coach. Symetricke: dalsi splatka pres
      // simpleshop-webhook appku zase odemkne (grant blok tam bezi pri kazde uhrazene splatce).
      // Best-effort: nikdy neshodi guard. Loguje do tvujcoach_grants.
      // ⛔ POJISTKA (stejny vzor jako v admin-api a academy-stripe-webhook): kdo je
      // AKTIVNI koucinkovy klient, o appku defaultem splatky PRIJIT NESMI.
      // `revoke_app_access` v appce nerozlisuje puvod grantu (source='academy' natvrdo),
      // takze by revoke sebral i pristup placeny koucinkem. Academy (kurz) se pozastavi
      // vyse tak jako tak; appka koucinkoveho klienta zustava.
      // ⛔ FAIL-CLOSED: kdyz se koucink NEPODARI precist, chovame se, jako by ho mel.
      // ⛔ Cte se i `expires_at`: refund nastavuje JEN expires_at a `active` necha true
      // (adversarni revize 1. 9., nalez 1); samotne `active` by chranilo navzdy.
      try {
        let maKoucink = false;
        let koucinkNecitelny = false;
        {
          const { data: coachEnt, error: coachErr } = await admin.from("entitlements").select("active, expires_at")
            .eq("email", email).eq("product", "coaching").limit(1).maybeSingle();
          koucinkNecitelny = !!coachErr;
          maKoucink = coachErr ? true
            : (!!coachEnt?.active && (!coachEnt.expires_at || Date.parse(String(coachEnt.expires_at)) > Date.now()));
        }
        if (maKoucink) {
          await admin.from("tvujcoach_grants").insert({ email, action: "revoke", result: koucinkNecitelny ? "skip-koucink-necitelny" : "skip-koucink", source: "splatky-default" });
        } else {
        const { data: gs } = await admin.from("app_config").select("value").eq("key", "academy_grant_secret").maybeSingle();
        const gsec = gs?.value ? String(gs.value) : "";
        let gres = "no-secret";
        if (gsec) {
          const gr = await fetch("https://kfkmghvhqwqtsalqjmrp.functions.supabase.co/academy-grant", {
            method: "POST", headers: { "Content-Type": "application/json", "x-academy-secret": gsec },
            body: JSON.stringify({ email, action: "revoke", source: "splatky-default" }),
          }).catch(() => null);
          // deno-lint-ignore no-explicit-any
          if (gr && gr.ok) { const jj: any = await gr.json().catch(() => ({})); gres = String(jj.result || "ok"); }
          else gres = gr ? "http-" + gr.status : "fetch-fail";
        }
        await admin.from("tvujcoach_grants").insert({ email, action: "revoke", result: gres, source: "splatky-default" });
        }
      } catch { /* best-effort */ }
      const m = suspendEmail(name, seg);
      await sendMail(email, m.subject, m.html);
      await admin.from("installment_status").update({
        status: "suspended", suspended_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      }).eq("email", email);
      suspended.push(email);
      try { await admin.from("email_events").insert({ lead_id: null, step: 0, type: "sent", detail: { track: "splatky-guard", kind: "suspend", email } }); } catch { /* log best-effort */ }
    }
  }

  return json({ ok: true, checked: (rows ?? []).length, warned, suspended });
});
