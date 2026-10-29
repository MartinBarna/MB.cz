// en-mailing: anglické maily pro leady z martinbarna.cz/en/ (13. 10. 2026, větev en-mailing-1013).
// Kroky 1-5 úvodní série, kroky 6-41 týdenní (weekly.ts). Pravidla: ./logic.ts. Návod: ./README-EN-MAILING.md.
//
// ⛔ VYPNUTO, DOKUD MARTIN NEZAPNE: public.en_mailing_config.enabled = false => běh je jen náhled
//    (dry-run), nic se nerazítkuje a nic neposílá. Chyba čtení vypínače = 500 a nic (ne "asi zapnuto").
// ⛔ NIKDY MAIL NAVÍC: razítko en_mail_log (unique lead_email + step) PŘED Resendem. Konflikt = už
//    vyřízeno, přeskočit. Selhání Resendu = status 'failed', ŽÁDNÉ opakování.
// ⛔ Odhlášený (en_unsubscribes), bez souhlasu, jen s přihláškou (application) = nic.
// ⛔ Testovací řádky (TEST-CLAUDE, fitness.barna@gmail.com) jen v náhledu.
//
// Volání: jen POST s hlavičkou x-cron-secret == secret EN_MAILING_SECRET (jinak 401; GET 405).
//   body {}                     běh podle vypínače (vypnuto = náhled)
//   body {"dry_run": true}      náhled i při zapnutém vypínači
//   body {"test_step": 1..41}   jeden mail daného kroku JEN na fitness.barna@gmail.com, předmět [TEST],
//                               nic se nezapisuje; {"test_step": 1, "test_no_calc": true} = mail 1 bez čísel
// Odpovědi neobsahují celé e-maily (cron je ukládá do net._http_response), jen lead_id a masku.
//
// Secrets (Academy uhmrpfsdcujbhbtumqye): EN_MAILING_SECRET (povinný, aspoň 16 znaků), RESEND_API_KEY,
//   EN_UNSUB_SECRET (volitelný, jinak klíč odvozený ze SUPABASE_SERVICE_ROLE_KEY, viz logic.ts),
//   SUPABASE_URL a SUPABASE_SERVICE_ROLE_KEY dodává platforma.
// Nasazení: CELÁ složka (rm -rf + cp -r), deploy --no-verify-jwt. Viz README.
import { createClient } from "jsr:@supabase/supabase-js@2";
import {
  deriveUnsubKey,
  type Lead,
  type LogRow,
  maskEmail,
  MAX_PER_RUN,
  planRun,
  renderEmail,
  type RenderedMail,
  STEPS,
  TEST_EMAIL,
  unsubOneClickUrl,
  unsubPageUrl,
  unsubToken,
} from "./logic.ts";
import { mailKlic, posliMail } from "../_shared/mail-provider.ts";
import { zapisOdeslani } from "../_shared/resend-odeslat.ts";

const FROM = "Martin Barna <news@martinbarna.cz>";
// Mail 1 a 5 žádají o odpověď: odpovědi musí dojít Martinovi, ne na news@.
const REPLY_TO = "martin@martinbarna.cz";
const SEND_GAP_MS = 600; // Resend má výchozí limit 2 požadavky za sekundu
const RESEND_TIMEOUT_MS = 15_000;
const MAX_FAILURES = 3; // po třetím selhání Resendu v jednom běhu se běh zastaví (další by jen pálily kroky)
const DEADLINE_MS = 100_000; // pod timeoutem cronu (120 s) i limitem edge funkce
const FETCH_LIMIT = 10_000;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function safeEqual(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a);
  const y = new TextEncoder().encode(b);
  if (x.length !== y.length) return false;
  let d = 0;
  for (let i = 0; i < x.length; i++) d |= x[i] ^ y[i];
  return d === 0;
}

type SendResult = { ok: true; id: string } | { ok: false; error: string };

async function sendResend(apiKey: string, to: string, mail: RenderedMail, oneClick: string): Promise<SendResult> {
  try {
    const r = await posliMail({
      from: FROM,
      to: [to],
      reply_to: REPLY_TO,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
      headers: {
        "List-Unsubscribe": `<${oneClick}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
    }, { resendKey: apiKey, signal: AbortSignal.timeout(RESEND_TIMEOUT_MS) });
    if (r.ok && r.providerId) return { ok: true, id: r.providerId };
    // `message` se driv cetlo z JSON tela. `posliMail` telo vraci v `chyba`.
    let message = "";
    const c = r.chyba ?? "";
    const prefixR = "resend_" + r.status + ":";
    const prefixS = "ses_" + r.status + ":";
    const telo = c.startsWith(prefixR) ? c.slice(prefixR.length) : c.startsWith(prefixS) ? c.slice(prefixS.length) : c;
    try {
      const j = JSON.parse(telo) as { message?: unknown };
      message = String(j?.message ?? "");
    } catch { /* prazdne, jako driv kdyz telo nebyl JSON */ }
    if (r.status === 0 && !message) message = c;
    return { ok: false, error: `status ${r.status}: ${message.slice(0, 200)}` };
  } catch (e) {
    return { ok: false, error: (e instanceof Error ? e.name + ": " + e.message : String(e)).slice(0, 200) };
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

Deno.serve(async (req: Request) => {
  const t0 = Date.now();
  // Pořadí: metoda -> secret -> práce (sonda POST bez secretu musí vrátit 401, ne 405).
  if (req.method !== "POST") return json({ ok: false, error: "method" }, 405);
  const secret = Deno.env.get("EN_MAILING_SECRET") ?? "";
  if (secret.length < 16) {
    console.error("en-mailing: EN_MAILING_SECRET chybí nebo je kratší než 16 znaků");
    return json({ ok: false, error: "config" }, 500);
  }
  if (!safeEqual(req.headers.get("x-cron-secret") ?? "", secret)) return json({ ok: false, error: "unauthorized" }, 401);

  let body: Record<string, unknown> = {};
  try {
    const raw = (await req.text()).trim();
    if (raw) {
      const p = JSON.parse(raw);
      if (!p || typeof p !== "object" || Array.isArray(p)) throw new Error("not object");
      body = p as Record<string, unknown>;
    }
  } catch {
    return json({ ok: false, error: "bad_json" }, 400);
  }
  const dryRun = body.dry_run === true;
  const testStep = body.test_step;
  if (testStep !== undefined && !(Number.isInteger(testStep) && (testStep as number) >= 1 && (testStep as number) <= STEPS)) {
    return json({ ok: false, error: "bad_test_step" }, 400);
  }

  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const unsubKey = await deriveUnsubKey(key, Deno.env.get("EN_UNSUB_SECRET"));
  if (!url || !key || !unsubKey) {
    console.error("en-mailing: chybí SUPABASE_URL nebo SUPABASE_SERVICE_ROLE_KEY");
    return json({ ok: false, error: "config" }, 500);
  }
  const resendKey = mailKlic();

  // --- Testovací mail: jen na TEST_EMAIL. en_mail_log se nerazítkuje (krok série se nespálí).
  // Stopa email_events type=test ano, ať bounce simulatoru jde spárovat. Vypínač se neřeší.
  if (testStep !== undefined) {
    if (!resendKey) return json({ ok: false, error: "resend_key_missing" }, 500);
    const token = await unsubToken(TEST_EMAIL, unsubKey);
    const mail = renderEmail(testStep as number, {
      firstName: "Martin",
      calc: body.test_no_calc === true ? null : { kcal: 2150, protein_g: 160 },
      unsubscribeUrl: unsubPageUrl(TEST_EMAIL, token),
    });
    mail.subject = "[TEST] " + mail.subject;
    const r = await sendResend(resendKey, TEST_EMAIL, mail, unsubOneClickUrl(url, TEST_EMAIL, token));
    if (r.ok) {
      const supaTest = createClient(url, key, { auth: { persistSession: false } });
      await zapisOdeslani({
        admin: supaTest, via: "en-mailing", email: TEST_EMAIL, typ: "test",
        step: testStep as number, detail: { test: true },
      }, r.id);
    }
    return json({ ok: r.ok, test: true, step: testStep, to: TEST_EMAIL, ...(r.ok ? { provider_id: r.id } : { error: r.error }) }, r.ok ? 200 : 502);
  }

  const supa = createClient(url, key, { auth: { persistSession: false } });

  // ⛔ Chyba čtení vypínače NENÍ "vypnuto" ani "zapnuto": nevím => nic nedělám.
  const { data: cfg, error: cfgErr } = await supa.from("en_mailing_config").select("enabled").eq("id", true).maybeSingle();
  if (cfgErr || !cfg) {
    console.error("en-mailing: vypínač nejde přečíst", cfgErr?.code ?? "", cfgErr?.message ?? "řádek chybí");
    return json({ ok: false, error: "config_read" }, 500);
  }
  const enabled = cfg.enabled === true;

  const [leadsQ, logQ, unsubQ] = await Promise.all([
    supa.from("en_leads").select("id,created_at,kind,first_name,email,consent,calc").order("created_at", { ascending: true }).limit(FETCH_LIMIT),
    supa.from("en_mail_log").select("lead_email,step,sent_at,status").limit(FETCH_LIMIT),
    supa.from("en_unsubscribes").select("email").limit(FETCH_LIMIT),
  ]);
  // ⛔ Neúplný obraz = nic neposílat (chybějící log nebo odhlášení by znamenalo mail navíc).
  for (const [name, q] of [["en_leads", leadsQ], ["en_mail_log", logQ], ["en_unsubscribes", unsubQ]] as const) {
    if (q.error || !Array.isArray(q.data)) {
      console.error("en-mailing: čtení selhalo", name, q.error?.code ?? "", q.error?.message ?? "");
      return json({ ok: false, error: "db_read", table: name }, 500);
    }
    if (q.data.length >= FETCH_LIMIT) {
      console.error("en-mailing: tabulka dosáhla FETCH_LIMIT, obraz by nebyl úplný", name);
      return json({ ok: false, error: "too_many_rows", table: name }, 500);
    }
  }

  const plan = planRun({
    leads: leadsQ.data as Lead[],
    log: logQ.data as LogRow[],
    unsubscribed: (unsubQ.data as { email: string }[]).map((r) => r.email),
    now: new Date(),
    enabled,
    dryRun,
    max: MAX_PER_RUN,
  });

  if (plan.mode === "dry") {
    return json({
      ok: true,
      mode: "dry",
      enabled,
      would_send: plan.items.length,
      capped: plan.capped,
      skipped: plan.skipped,
      items: plan.items.map((i) => ({
        lead_id: i.lead_id,
        email: maskEmail(i.email),
        step: i.step,
        kind: i.kind,
        numbers: !!i.calc,
        test: i.test,
        start_at: i.start_at,
      })),
    });
  }

  // --- Ostrý běh ---
  if (!resendKey) {
    console.error("en-mailing: RESEND_API_KEY chybí, nic se nerazítkuje");
    return json({ ok: false, error: "resend_key_missing" }, 500);
  }

  const res = { sent: 0, failed: 0, conflicts: 0, stamp_errors: 0, render_errors: 0, update_errors: 0, by_step: {} as Record<string, number> };
  let stopped: string | null = null;
  let first = true;

  for (const item of plan.items) {
    if (res.failed >= MAX_FAILURES) { stopped = "failures"; break; }
    if (Date.now() - t0 > DEADLINE_MS) { stopped = "deadline"; break; }

    // Mail se sestaví PŘED razítkem: chyba šablony nesmí spotřebovat krok.
    let mail: RenderedMail;
    let oneClick: string;
    try {
      const token = await unsubToken(item.email, unsubKey);
      mail = renderEmail(item.step, { firstName: item.first_name, calc: item.calc, unsubscribeUrl: unsubPageUrl(item.email, token) });
      oneClick = unsubOneClickUrl(url, item.email, token);
    } catch (e) {
      res.render_errors++;
      console.error("en-mailing: sestavení mailu selhalo", item.lead_id, item.step, e instanceof Error ? e.message : String(e));
      continue;
    }

    // Razítko PŘED odesláním. unique (lead_email, step): souběžný běh dostane 23505 a mail nepošle.
    const { data: stamp, error: stampErr } = await supa.from("en_mail_log")
      .insert({ lead_email: item.email, lead_id: item.lead_id, step: item.step, status: "sending" })
      .select("id").single();
    if (stampErr || !stamp) {
      if (stampErr?.code === "23505") res.conflicts++;
      else {
        res.stamp_errors++;
        console.error("en-mailing: razítko selhalo, mail se NEPOSÍLÁ", item.lead_id, item.step, stampErr?.code ?? "", stampErr?.message ?? "");
      }
      continue;
    }

    if (!first) await sleep(SEND_GAP_MS);
    first = false;
    const r = await sendResend(resendKey, item.email, mail, oneClick);
    const upd = r.ok
      ? { status: "sent", provider_id: r.id, sent_at: new Date().toISOString() }
      : { status: "failed", error: r.error };
    if (r.ok) {
      res.sent++;
      res.by_step[String(item.step)] = (res.by_step[String(item.step)] ?? 0) + 1;
      await zapisOdeslani({
        admin: supa, via: "en-mailing", email: item.email, step: item.step,
        detail: { step: item.step },
      }, r.id);
    } else {
      res.failed++;
      console.error("en-mailing: Resend selhal (neopakuje se)", item.lead_id, item.step, r.error);
    }
    // Když se výsledek nezapíše, řádek zůstane 'sending' a krok je dál spotřebovaný (žádný druhý mail).
    const { error: updErr } = await supa.from("en_mail_log").update(upd).eq("id", (stamp as { id: number }).id);
    if (updErr) {
      res.update_errors++;
      console.error("en-mailing: zápis výsledku selhal", item.lead_id, item.step, updErr.code ?? "", updErr.message ?? "");
    }
  }

  return json({
    ok: true,
    mode: "live",
    ...res,
    planned: plan.items.length,
    capped: plan.capped,
    stopped,
    skipped: plan.skipped,
    ms: Date.now() - t0,
  });
});
