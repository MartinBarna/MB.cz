// Barna Academy — checkin-capture: přijme týdenní check-in, spočítá věrnostní kredit,
// spočítá "doporučení na míru" z reálných dat (analysis.ts) a vrátí ho rovnou frontendu.
// Režimy: POST check-in (z /akademie/check-in/) | POST {mode:'remind'}+x-drip-secret (týdenní cron)
//         | GET ?stop=<reminder_token> (opt-out z připomínek).
import { createClient } from "jsr:@supabase/supabase-js@2";
import { sendIfAllowed } from "../_shared/mailing-guard.ts";
// 14. 9. 2026: chyba čtení není odpověď (guard secretu i příjemci s opakováním, při trvalé chybě 500).
import { chybaCteni, ctiSOpakovanim, overSecret } from "../_shared/secret-guard.ts";
import { analyzeCheckin, type Checkin } from "./analysis.ts";
import { mailKlic, posliMail, type MailOdpoved } from "../_shared/mail-provider.ts";
import {
  RESEND_PREDPOKLAD,
  drzetRezervaci,
  isoTyden,
  naplnDavku,
  pripravFrontu,
  stropTohotoBehu,
  type Osoba,
} from "./pripominky.ts";
import { stejnyCheckin, vlozSOpakovanim, type CheckinRadek } from "./ulozit.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = mailKlic();
const SITE = "https://martinbarna.cz";
const FROM = "Martin Barna <news@martinbarna.cz>";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-drip-secret",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
const low = (s: unknown) => String(s ?? "").trim().toLowerCase();
const esc = (s: string) => String(s).split("&").join("&amp;").split("<").join("&lt;").split(">").join("&gt;");
// ⛔ ČÍSLO S DESETINNOU ČÁRKOU. Formulář check-inu posílá váhu a míry jako TEXT
// (`type="number"` česky psanou „82,5" podle locale prohlížeče zahodí a odešle prázdno,
// takže se hodnota TIŠE ztratila; opraveno 30. 7. 2026). Tady se proto čárka převádí
// na tečku, jinak by `Number("82,5")` dalo NaN a `num()` by uložilo null, tedy tatáž
// tichá ztráta, jen o vrstvu dál.
// ⚠️ Rozsah se hlídá TADY, ne v atributech `min`/`max` inputu: ty u `type="text"`
// neplatí. Bez toho by šlo uložit 4000 kg a report by podle toho počítal.
const num = (x: unknown, min?: number, max?: number) => {
  const s = String(x ?? "").replace(",", ".").trim();
  if (s === "") return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  if (min != null && n < min) return null;
  if (max != null && n > max) return null;
  return Math.round(n * 10) / 10;
};

function wrapHtml(preheader: string, body: string, footerHtml: string): string {
  return `<!doctype html><html lang='cs'><head><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'></head>` +
    `<body style='margin:0;background:#f4f4f5;padding:16px'>` +
    `<span style='display:none!important;opacity:0;color:transparent'>${esc(preheader)}</span>` +
    `<div style='font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;font-size:16px;line-height:1.55;color:#222;max-width:560px;margin:0 auto;background:#fff;border-radius:14px;padding:28px'>` +
    body +
    `<hr style='border:none;border-top:1px solid #eee;margin:22px 0 14px'>` +
    `<div style='font-size:12px;line-height:1.5;color:#999'>${footerHtml}</div></div></body></html>`;
}
const btn = (text: string, href: string) =>
  `<p style='margin:6px 0 16px'><a href='${href}' style='display:inline-block;background:#EBB12C;color:#1A1222;text-decoration:none;padding:13px 24px;border-radius:50px;font-weight:700'>${esc(text)}</a></p>`;

// Rezervace týdne JE ten zámek proti duplicitě. Update projde jen když týden
// ještě není dnešní (včetně NULL: v SQL `NULL <> týden` není pravda, proto or).
// Žádný vrácený řádek = už rezervováno, mail se neposílá.
async function rezervujTyden(admin: any, emailRaw: string, tyden: string): Promise<boolean> {
  const { data, error } = await admin.from("discount_credits")
    .update({ reminded_week: tyden })
    .eq("email", emailRaw)
    .or("reminded_week.is.null,reminded_week.neq." + tyden)
    .select("email");
  if (error) return false;
  return Array.isArray(data) && data.length > 0;
}

async function uvolniTyden(admin: any, emailRaw: string, tyden: string, predchozi: string | null): Promise<void> {
  await admin.from("discount_credits")
    .update({ reminded_week: predchozi })
    .eq("email", emailRaw)
    .eq("reminded_week", tyden);
}

async function sendResend(to: string, subject: string, html: string, text: string, replyTo: string): Promise<MailOdpoved> {
  if (!RESEND_API_KEY) return { ok: false, status: 0, providerId: "", chyba: "missing_RESEND_API_KEY" };
  return await posliMail(
    { from: FROM, to: [to], subject, html, text, reply_to: replyTo || undefined },
    { resendKey: RESEND_API_KEY },
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

  const { data: cfgRows } = await admin.from("app_config").select("key,value")
    .in("key", ["footer_html", "reply_to_email", "drip_invoke_secret", "coach_credit_per_checkin", "coach_milestone_2cm_bonus", "coach_credit_cap_czk"]);
  const cfg = Object.fromEntries((cfgRows ?? []).map((r: { key: string; value: string }) => [r.key, r.value]));
  const perCheckin = Number(cfg.coach_credit_per_checkin ?? 30) || 30;
  const milestoneBonus = Number(cfg.coach_milestone_2cm_bonus ?? 100) || 100;
  const cap = Number(cfg.coach_credit_cap_czk ?? 400) || 400;
  const replyTo = cfg.reply_to_email ?? "";
  const footerHtml = cfg.footer_html ?? "Barna Academy · Martin Barna · martinbarna.cz";

  // ---- OPT-OUT (GET ?stop=<reminder_token>) ----
  if (req.method === "GET") {
    const token = new URL(req.url).searchParams.get("stop") ?? "";
    if (token) {
      await admin.from("discount_credits").update({ reminders_off: true, updated_at: new Date().toISOString() }).eq("reminder_token", token);
    }
    return new Response(
      `<!doctype html><meta charset='utf-8'><body style='font-family:sans-serif;background:#161616;color:#eee;text-align:center;padding:60px 20px'>` +
      `<h2 style='color:#ff9d3c'>Hotovo ✓</h2><p>Týdenní připomínky check-inu jsou vypnuté. Vyplnit ho můžeš dál kdykoliv.</p>` +
      `<p><a href='${SITE}/akademie/moje/' style='color:#ff9d3c'>← Zpět do Academy</a></p></body>`,
      { headers: { "Content-Type": "text/html; charset=utf-8", ...CORS } },
    );
  }

  if (req.method !== "POST") return json({ error: "method" }, 405);
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  // ---- REMINDER MODE (týdenní cron) ----
  if (body.mode === "remind") {
    // Secret se čte znovu s opakováním (hromadné `.in` výš chybu zahazuje): sedí / nesedí 401 / NEPŘEČTENO 500.
    const brana = await overSecret(admin, req, { header: "x-drip-secret" });
    if (!brana.ok) return json(brana.body, brana.status);
    const now = Date.now();
    // kdo je v loopu: má aspoň 1 check-in, reminders zapnuté; připomeň, když poslední check-in 6–45 dní zpět
    // ⛔ Chyba čtení = 500, ne „nikdo". Prázdný `coachSet` kvůli 504 by koučinkovým klientům poslal
    //    členský check-in navíc k nedělnímu reportu.
    type Radky<T> = { data: T[] | null; error: unknown };
    const creds = await ctiSOpakovanim<Radky<{ email?: unknown; reminder_token?: unknown; reminded_week?: unknown }>>(() =>
      admin.from("discount_credits").select("email,reminder_token,reminded_week").eq("reminders_off", false));
    if (creds.error) return json(chybaCteni("discount_credits", creds.error), 500);
    // [2026-07-14] koučink klienti mají vlastní klientskou sekci + nedělní report (client-remind)
    // — starý členský check-in by jim chodil duplicitně, tak je z připomínek vynecháváme
    const coachEnts = await ctiSOpakovanim<Radky<{ email?: unknown }>>(() =>
      admin.from("entitlements").select("email").eq("product", "coaching").eq("active", true));
    if (coachEnts.error) return json(chybaCteni("entitlements", coachEnts.error), 500);
    const coachSet = new Set((coachEnts.data ?? []).map((e) => low(e.email)));
    const tyden = isoTyden(now);
    let dripDailyCap = RESEND_PREDPOKLAD.dripDailyCapVychozi;
    const { data: capRows, error: capErr } = await admin.from("app_config").select("value").eq("key", "drip_daily_cap").limit(1);
    if (!capErr && capRows && capRows[0]) {
      const n = Number(capRows[0].value);
      if (Number.isFinite(n) && n > 0) dripDailyCap = n;
    }
    const dayStart = new Date(now);
    dayStart.setUTCHours(0, 0, 0, 0);
    const { count: odeslanoDnes, error: cntErr } = await admin.from("email_events")
      .select("id", { count: "exact", head: true })
      .eq("type", "sent")
      .gte("created_at", dayStart.toISOString());
    // Nepřečtený počet dneška není důvod poslat nulu: běh má vlastní strop 80.
    // Rezerva proti dripu se uplatní jen když počet známe.
    const limit = stropTohotoBehu({
      dripDailyCap,
      odeslanoDnes: cntErr ? 0 : (odeslanoDnes ?? 0),
    });
    const lide: Osoba[] = [];
    for (const c of (creds.data ?? [])) {
      const email = low(c.email);
      if (!email.includes("@")) continue;
      const week = c.reminded_week == null ? "" : String(c.reminded_week).trim();
      lide.push({
        email,
        emailRaw: String(c.email ?? ""),
        token: String(c.reminder_token ?? ""),
        coaching: coachSet.has(email),
        remindersOff: false,
        lastRemindedWeek: week === "" ? null : week,
      });
    }
    const fronta = pripravFrontu(lide, tyden);
    const napln = await naplnDavku(fronta, limit, now, async (email) => {
      const { data: last, error: lastErr } = await admin.from("member_checkins").select("created_at").eq("email", email).order("created_at", { ascending: false }).limit(1).maybeSingle();
      // Nepřečtený poslední check-in není „žádný check-in": člověk se přeskočí a spočítá zvlášť.
      if (lastErr) return { at: null, chyba: true };
      return { at: last?.created_at ? String(last.created_at) : null, chyba: false };
    });
    let sent = 0, skipped = 0, uvolneno = 0, nejiste = 0;
    const neprecteno = napln.neprecteno;
    // Suchý běh nic nerezervuje a nic neposílá. V odpovědi nejsou adresy.
    if (body.dry === true) {
      return json({
        ok: true, mode: "remind", dry: true, sent: 0, skipped, neprecteno, nejiste, uvolneno,
        limit, tyden, fronta: fronta.length, davka: napln.davka.length, mimo_okno: napln.mimoOkno,
        cap_read: capErr ? "chyba" : "ok", sent_today_read: cntErr ? "chyba" : "ok",
      });
    }
    for (const c of napln.davka) {
      const drzi = await rezervujTyden(admin, c.emailRaw, tyden);
      if (!drzi) { skipped++; continue; }
      await new Promise((r) => setTimeout(r, RESEND_PREDPOKLAD.mezeraMs));
      const stop = SUPABASE_URL + "/functions/v1/checkin-capture?stop=" + encodeURIComponent(c.token);
      const foot = footerHtml + ` · <a href='${stop}' style='color:#999'>Vypnout připomínky</a>`;
      const html = wrapHtml(
        "30 vteřin a máš doporučení na míru.",
        `<p style='margin:0 0 14px'>Ahoj,</p>` +
        `<p style='margin:0 0 14px'>jak se ti vedl týden? Naklikej si <strong>30vteřinový check-in</strong>. Hned dostaneš <strong>doporučení na míru</strong> na další týden a načítá se ti sleva. 💪</p>` +
        btn("Vyplnit check-in", SITE + "/akademie/check-in/") +
        `<p style='margin:14px 0 0'>Drž se!<br><strong>Be Effective!</strong><br>Martin</p>`,
        foot,
      );
      const text = "Ahoj, čas na týdenní check-in: " + SITE + "/akademie/check-in/\n\nBe Effective! Martin";
      const box: { odp: MailOdpoved | null } = { odp: null };
      try {
        const d = await sendIfAllowed(admin, {
          email: c.email,
          mailClass: "optional_reminder",
          functionName: "checkin-capture",
          path: "checkin-capture.remind",
        }, async () => {
          const vysledek = await sendResend(c.email, "Čas na týdenní check-in 💪", html, text, replyTo);
          box.odp = vysledek;
          if (!vysledek.ok) throw new Error(vysledek.chyba || ("resend_" + vysledek.status));
        });
        if (d.action === "skip") { skipped++; continue; }
        sent++;
      } catch {
        const status = box.odp?.status ?? 0;
        const chyba = box.odp?.chyba ?? "sit:";
        if (drzetRezervaci(status, chyba)) nejiste++;
        else {
          await uvolniTyden(admin, c.emailRaw, tyden, c.lastRemindedWeek);
          uvolneno++;
        }
      }
    }
    return json({
      ok: true, mode: "remind", sent, skipped, neprecteno, nejiste, uvolneno,
      limit, tyden, fronta: fronta.length, mimo_okno: napln.mimoOkno,
      cap_read: capErr ? "chyba" : "ok", sent_today_read: cntErr ? "chyba" : "ok",
    });
  }

  // ---- SUBMIT MODE (z /akademie/check-in/) ----
  // E-mail bereme z OVERENEHO JWT prihlaseneho uzivatele — body.email nelze verit
  // (jinak by kdokoliv umel farmit kredit na cizi/vlastni adresu bez prihlaseni).
  let email = "";
  const bearer = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (bearer) {
    try { const { data: ures } = await admin.auth.getUser(bearer); email = low(ures?.user?.email || ""); } catch { /* neplatny token */ }
  }
  if (!email || !email.includes("@")) return json({ error: "unauthorized" }, 401);

  // Rozsahy odpovídají tomu, co dřív hlídaly atributy `min`/`max` v inputech.
  // Škály (adherence, spánek, pocit) jsou 1 až 5, tréninky 0 až 21 za týden.
  const ci = {
    email,
    weight: num(body.weight, 30, 350),
    waist: num(body.waist, 40, 200),
    hips: num(body.hips, 40, 200),
    steps: (body.steps as string) || null,
    workouts: num(body.workouts, 0, 21),
    adherence: num(body.adherence, 1, 5),
    sleep: num(body.sleep, 1, 5),
    feeling: num(body.feeling, 1, 5),
    note: String(body.note ?? "").slice(0, 200) || null,
  };
  // historii ctem PRED insertem, at v ni neni prave odeslany check-in;
  // 4 zaznamy staci na trend i na "kolikaty check-in v rade to je"
  const { data: hist } = await admin.from("member_checkins")
    .select("weight,waist,hips,steps,workouts,adherence,sleep,feeling,note,created_at")
    .eq("email", email).order("created_at", { ascending: false }).limit(4);
  const history = (hist ?? []) as Checkin[];
  const ulozeni = await vlozSOpakovanim(ci, {
    najdiNedavny: async () => {
      const { data, error } = await admin.from("member_checkins")
        .select("email,weight,waist,hips,steps,workouts,adherence,sleep,feeling,note,created_at")
        .eq("email", email)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) return { radek: null, chyba: { code: String(error.code ?? ""), message: String(error.message ?? ""), status: 500 } };
      if (!data?.created_at) return { radek: null, chyba: null };
      const vek = Date.now() - Date.parse(String(data.created_at));
      if (!Number.isFinite(vek) || vek > 2 * 60 * 1000) return { radek: null, chyba: null };
      return { radek: data as CheckinRadek, chyba: null };
    },
    vloz: async () => {
      const { data, error } = await admin.from("member_checkins").insert(ci).select().single();
      if (error || !data) {
        // Prázdná odpověď bez kódu je nejistota (řádek mohl vzniknout). To je dočasné,
        // ať se další pokus chytí o okno duplicity a nevloží kopii.
        if (!error) return { radek: null, chyba: { message: "no_row", status: 503 } };
        return { radek: null, chyba: { code: String(error.code ?? ""), message: String(error.message ?? "save_failed") } };
      }
      return { radek: data as CheckinRadek, chyba: null };
    },
  });
  if (!ulozeni.ok) {
    return json({ ok: false, ulozeno: false, error: "save_failed" }, ulozeni.docasna ? 503 : 422);
  }

  let historyForReco = history;
  if (ulozeni.duplicita && history[0] && stejnyCheckin({ ...(history[0] as Checkin), email } as CheckinRadek, ci)) {
    historyForReco = history.slice(1);
  }
  const prev = historyForReco[0] ?? null;

  // věrnostní kredit — pripisuje se max 1x za ~tyden (6 dni), dalsi check-iny
  // v tomtez tydnu se ulozi, ale kredit nefarmi. Opakovaný pokus téhož uložení
  // (duplicita v krátkém okně) kredit nepřipisuje znovu.
  const tooSoon = ulozeni.duplicita || !!(prev?.created_at && (Date.now() - new Date(prev.created_at as string).getTime()) < 6 * 24 * 3600 * 1000);
  const { data: dc } = await admin.from("discount_credits").select("*").eq("email", email).maybeSingle();
  let credit = dc ? Number(dc.credit_czk) : 0;
  const n = (dc ? Number(dc.checkins_n) : 0) + (tooSoon ? 0 : 1);
  let baseline = dc ? dc.baseline_waist : null;
  let milestone = dc ? dc.milestone_2cm : false;
  let awarded = 0;
  if (!tooSoon) {
    credit += perCheckin; awarded = perCheckin;
    if (baseline == null && ci.waist != null) baseline = ci.waist;
    if (!milestone && baseline != null && ci.waist != null && (Number(baseline) - ci.waist) >= 2) { credit += milestoneBonus; awarded += milestoneBonus; milestone = true; }
    credit = Math.min(credit, cap);
    await admin.from("discount_credits").upsert(
      { email, credit_czk: credit, checkins_n: n, baseline_waist: baseline, milestone_2cm: milestone, updated_at: new Date().toISOString() },
      { onConflict: "email" },
    );
  }

  // doporučení na míru: engine počítá, čísla v textu jsou reálná data toho člověka
  const recoPoints = analyzeCheckin(ci, historyForReco, Date.now());

  return json({
    ok: true,
    ulozeno: true,
    credit: awarded,
    credit_total: credit,
    checkins_n: n,
    reco: recoPoints.join(" "),
    reco_points: recoPoints,
  });
});
