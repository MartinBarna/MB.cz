// Barna Academy: konzultace-pripominka. Připomínka termínu konzultačního hovoru.
// Denní cron (5:40 UTC = 7:40 Prahy) přes `x-drip-secret` (app_config drip_invoke_secret).
//
// PROČ EXISTUJE (nález D/N4 auditu mailových toků 16. 9. 2026):
// `_supabase/konzultace-crm-2026-09-15.sql` cituje Martina: „Termin konzultace zadavam
// ja v adminu, SYSTEM MI TO MAILEM PRIPOMENE." Postavená byla jen zpětná kontrola
// v `daily-digest` (bez termínu, po hovoru bez upsellu) a nadcházející termín digest
// VÝSLOVNĚ přeskakuje. Připomínku tedy nedostal ani Martin, ani kupec, který za hovor
// zaplatil. Tahle funkce to zavírá z obou stran:
//   - klientovi den předem a ráno v den hovoru krátký mail s časem (a s odkazem na
//     dotazník, pokud ho ještě nevyplnil),
//   - Martinovi jeden souhrn za běh, ať to má v schránce, jak si přál.
//
// ⛔ ROZHODUJE JEDEN ZDROJ PRAVDY: `consultation_calls.termin_at`, který zadává Martin
//    v adminu. Nic se tu neodhaduje z plateb ani z dotazníku.
// ⛔ IDEMPOTENCE JE NA RAZÍTKU TERMÍNU, ne na čase odeslání. Viz komentář ve `vyber.ts`.
// ⚠️ TEXTY MAILŮ JSOU NÁVRH KE KONTROLE ŠÉFA (Martinův hlas), označené `⚠️ NÁVRH`.
import { createClient } from "jsr:@supabase/supabase-js@2";
import { sendIfAllowed } from "../_shared/mailing-guard.ts";
import { odesliPresResend } from "../_shared/resend-odeslat.ts";
import { chybaCteni, ctiSOpakovanim, overSecret } from "../_shared/secret-guard.ts";
import { coPoslat, type Druh, prazskeDatum, type Radek, sloupecRazitka } from "./vyber.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_KEY = Deno.env.get("RESEND_API_KEY") ?? "";

const FROM = "Martin Barna <news@martinbarna.cz>";
// Adresa pro odpověď člověka. ⛔ NENÍ to `from`: `news@` je rozesílací adresa.
// Stejná adresa jako u ostatních cest, kde se čeká odpověď (`order-rescue`,
// `poukaz-vydat`, `koucink-onboarding`, `splatky-guard` od 17. 9. 2026).
const REPLY_TO = "martin@martinbarna.cz";
const ALERT_FALLBACK = "fitness.barna@gmail.com";
const DOTAZNIK_URL = "https://martinbarna.cz/konzultace/dotaznik/";

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { "Content-Type": "application/json" } });

const esc = (s: unknown) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Čas hovoru pro člověka, pražsky. */
function cas(iso: string): string {
  return new Intl.DateTimeFormat("cs-CZ", { timeZone: "Europe/Prague", hour: "2-digit", minute: "2-digit" })
    .format(new Date(iso));
}
/** Datum hovoru pro člověka, pražsky (17. 9. 2026). */
function datum(iso: string): string {
  return new Intl.DateTimeFormat("cs-CZ", { timeZone: "Europe/Prague", day: "numeric", month: "numeric", year: "numeric" })
    .format(new Date(iso));
}

function obal(body: string): string {
  return `<div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;font-size:15px;line-height:1.6;color:#222;max-width:560px;margin:0 auto">${body}` +
    `<p style="margin:18px 0 0">Martin</p>` +
    `<p style="margin:14px 0 0;font-size:12px;color:#999">Martin Barna · <a href="https://martinbarna.cz" style="color:#c45e00">martinbarna.cz</a> · odpovědět můžeš rovnou na tenhle e-mail</p></div>`;
}

// ⚠️ NÁVRH TEXTU KE KONTROLE ŠÉFA (Martinův hlas, česky, tykání, bez ceny).
// ⛔ Text je SCHVÁLNĚ bez rodu: žádné příčestí minulé („zadal", „vyplnil"), protože
//    rod klienta tahle funkce nezná a 3. 8. 2026 už jednou přišel mail celý v mužském
//    rodě klientce (viz `admin-api`, offboard). Kdo sem přidá větu s příčestím, musí
//    doplnit i rod, jinak ať ji přepíše.
// ⛔ Žádný slib „do 48 hodin" ani jiný čas, který se nedá garantovat (rozhodnutí
//    Martina 15. 9. 2026, viz `_shared/koucink-onboarding.ts`).
function mailKlientovi(terminIso: string, druh: Druh, maDotaznik: boolean) {
  const kdy = druh === "rano" ? "dnes" : "zítra";
  const subject = druh === "rano"
    ? `Dnes v ${cas(terminIso)} se slyšíme`
    : `Zítra v ${cas(terminIso)} máme hovor`;
  const dotaznik = maDotaznik
    ? `<p>Dotazník od tebe mám, projdu si ho před hovorem.</p>`
    : `<p>Ještě mi prosím vyplň krátký dotazník, ať na hovor jdu připravený a neptám se na základní věci:</p>` +
      `<p style="margin:14px 0"><a href="${DOTAZNIK_URL}" style="display:inline-block;background:#c45e00;color:#fff;text-decoration:none;padding:12px 22px;font-weight:700">Vyplnit dotazník</a></p>` +
      `<p style="font-size:13px;color:#666">Kdyby odkaz nešel otevřít: ${DOTAZNIK_URL}</p>`;
  return {
    subject,
    html: obal(
      `<p>Ahoj,</p>` +
        `<p>${kdy} <b>${datum(terminIso)} v ${cas(terminIso)}</b> spolu máme konzultační hovor. Připomínám, ať ti to nevypadne z hlavy.</p>` +
        dotaznik +
        `<p>Kdyby ti termín nevyšel, napiš mi na tenhle e-mail a domluvíme se na jiném.</p>`,
    ),
  };
}

/**
 * Souhrn Martinovi jde PŘÍMO přes Resend, NE přes `sendIfAllowed`.
 * Brána chrání adresu zákazníka; kdyby na seznamu jednou skončila Martinova adresa,
 * přestal by se dozvídat právě to, kvůli čemu tahle funkce vznikla.
 * (Stejné zdůvodnění jako u `splatky-guard` a `poukaz-vydat`.)
 * ⚠️ Bez `stopa`: Martinova adresa do `email_events` nepatří, viz `resend-odeslat.ts`.
 */
// deno-lint-ignore no-explicit-any
async function souhrnMartinovi(admin: any, radky: string[]): Promise<boolean> {
  if (!RESEND_KEY || !radky.length) return false;
  let to = ALERT_FALLBACK;
  try {
    const { data } = await admin.from("app_config").select("value").eq("key", "admin_emails").maybeSingle();
    const prvni = String(data?.value || "").split(",").map((s: string) => s.trim()).filter(Boolean)[0];
    if (prvni) to = prvni;
  } catch { /* zůstává fallback */ }
  const r = await odesliPresResend(RESEND_KEY, {
    from: FROM,
    to: [to],
    reply_to: REPLY_TO,
    subject: "🗓️ Připomínka: konzultační hovory",
    html: obal(
      `<p>Nadcházející konzultace:</p><ul>${radky.map((x) => `<li>${x}</li>`).join("")}</ul>` +
        `<p style="font-size:13px;color:#666">Termíny zadáváš v adminu, sekce Konzultace. Klient dostal tentýž den svoji připomínku.</p>`,
    ),
  });
  return r.ok;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method" }, 405);
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

  // Sedí / nesedí 401 / NEPŘEČTENO 500 (ne 401): den s hovory nesmí tiše vypadnout.
  const brana = await overSecret(admin, req, { header: "x-drip-secret" });
  if (!brana.ok) return json(brana.body, brana.status);

  const body = await req.json().catch(() => ({}));
  // Suchý běh: jen spočítá, komu by co poslal. Nic neodesílá a nic nezapisuje.
  const dryRun = body?.dry === true || body?.dry === 1;
  // Pevný čas pro vyzkoušení hraničních dnů (ISO). Bez něj „teď".
  const nowMs = body?.now ? Date.parse(String(body.now)) : Date.now();
  if (!Number.isFinite(nowMs)) return json({ error: "bad_now" }, 400);

  // ⛔ Chyba čtení = 500, ne „0 připomínek": prázdno kvůli 504 by znamenalo, že ten den
  //    nikdo nedostane připomínku na zaplacený hovor, a cron by hlásil úspěch.
  const rowsR = await ctiSOpakovanim<{ data: Radek[] | null; error: unknown }>(() =>
    admin.from("consultation_calls")
      .select("email,termin_at,pripominka_den_pred_pro,pripominka_rano_pro")
      .not("termin_at", "is", null)
  );
  if (rowsR.error) return json(chybaCteni("consultation_calls", rowsR.error), 500);

  const kandidati: Array<{ r: Radek; druh: Druh }> = [];
  for (const r of rowsR.data ?? []) {
    const druh = coPoslat(r, nowMs);
    if (druh) kandidati.push({ r, druh });
  }
  if (dryRun) {
    return json({
      ok: true,
      mode: "dry",
      den: prazskeDatum(nowMs),
      kandidati: kandidati.map((k) => ({ email: k.r.email, termin_at: k.r.termin_at, druh: k.druh })),
    });
  }

  const odeslano: string[] = [], preskoceno: string[] = [], selhalo: string[] = [];
  // Komu mail odešel, ale razítko se nezapsalo: příští běh by ho poslal ZNOVU.
  // ⛔ Tenhle seznam existuje kvůli nálezu B/N10: `order-rescue` a `videokurz-onboarding`
  //    chybu zápisu razítka zahazují, takže se duplicitní mail nedá ani poznat.
  const razitkoNezapsano: string[] = [];
  const proMartina: string[] = [];

  for (const { r, druh } of kandidati) {
    const email = String(r.email);
    const terminIso = String(r.termin_at);

    // Vyplněný dotazník mění JEDEN odstavec mailu. Chyba čtení = neví se, takže se bere
    // varianta „dotazník nemám": pobídka navíc je menší škoda než mlčení u člověka,
    // který ho opravdu nevyplnil.
    let maDotaznik = false;
    try {
      const { data: di, error: de } = await admin.from("consultation_intake")
        .select("email").eq("email", email).limit(1).maybeSingle();
      if (!de && di) maDotaznik = true;
    } catch { /* viz komentář výš */ }

    const m = mailKlientovi(terminIso, druh, maDotaznik);
    let sent = false;
    const d = await sendIfAllowed(admin, {
      email,
      // ⛔ `client_operational`, NE `optional_reminder`. Je to termín hovoru, který si
      //    člověk KOUPIL. `optional_reminder` se podle politiky ze 7. 9. 2026 zahazuje
      //    při odhlášení z marketingu, takže by odhlášený kupec přišel o informaci
      //    o zaplacené službě. Hard bounce mail zastaví tak jako tak, u všech tříd.
      mailClass: "client_operational",
      functionName: "konzultace-pripominka",
      path: "konzultace-pripominka",
    }, async () => {
      if (!RESEND_KEY) return;
      const out = await odesliPresResend(
        RESEND_KEY,
        { from: FROM, to: [email], subject: m.subject, html: m.html, reply_to: REPLY_TO },
        { admin, via: "konzultace-pripominka", email, detail: { track: "konzultace-pripominka", kind: druh } },
      );
      sent = out.ok;
    });

    if (d.action === "skip") {
      preskoceno.push(email + ":" + d.reason);
      continue;
    }
    if (!sent) {
      // ⛔ Razítko se NEZAPISUJE, když mail neodešel: příští běh to má zkusit znovu.
      selhalo.push(email);
      continue;
    }
    odeslano.push(email + ":" + druh);
    proMartina.push(
      `${esc(email)} · ${esc(datum(terminIso))} v ${esc(cas(terminIso))} · ` +
        (maDotaznik ? "dotazník má" : "dotazník zatím nevyplněný") +
        ` (${druh === "rano" ? "dnes" : "zítra"})`,
    );

    // ⛔⛔ CHYBA ZÁPISU RAZÍTKA SE ČTE. Mail UŽ ODEŠEL; bez razítka ho příští běh pošle
    //    znovu, a u denního cronu by to byl druhý mail v řadě o tomtéž hovoru.
    const { error: razErr } = await admin.from("consultation_calls")
      .update({ [sloupecRazitka(druh)]: terminIso, updated_at: new Date().toISOString() })
      .eq("email", email);
    if (razErr) {
      console.error("[konzultace-pripominka] razitko NEZAPSANO: " + email + " " + razErr.message);
      razitkoNezapsano.push(email);
    }
  }

  const souhrn = await souhrnMartinovi(admin, proMartina);

  return json({
    ok: true,
    den: prazskeDatum(nowMs),
    kandidatu: kandidati.length,
    odeslano,
    preskoceno,
    selhalo,
    razitko_nezapsano: razitkoNezapsano,
    souhrn_martinovi: souhrn,
  });
});
