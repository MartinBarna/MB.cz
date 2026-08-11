// Barna Academy - affiliate-mesicni-report. Deno, deploy --no-verify-jwt.
// Mesicni prehled pro AFFILIATE partnery (Jirka a dalsi): kolik lidi, obrat,
// provize za minuly mesic + celkovy stav k vyplate. Spousti GH Actions
// 1. den v mesici (workflow affiliate-report.yml v repu MB.cz).
//
// PROC: Martin partnerum slibil "kazdy mesic prehled a penize" (mail Jirkovi
// 8. 8. 2026). Bez automatu by to viselo na jeho pameti; tenhle mail je
// polovina toho slibu, druhou (platbu) dela Martin rucne podle admin karty.
//
// Bezpecnost a rezimy:
// - x-report-secret musi sedet na AFFILIATE_REPORT_SECRET, jinak 403
//   (fail closed: bez nastaveneho secretu neodpovi nikomu).
// - ?dry=1     nic neposila, vrati JSON s tim, co by slo.
// - ?test=1    posle vsechno JEN na fitness.barna@gmail.com (pravidlo
//              testovacich mailu), do email_events zapise type s '-test'.
// - ?mesic=YYYY-MM   prehled za konkretni mesic (jinak minuly kalendarni).
// Idempotence: email_events(type='affiliate_report', detail.mesic+code);
// druhy beh v temze mesici partnera preskoci.
// Partner bez jedineho referralu VUBEC se preskakuje (nema smysl posilat nuly
// nekomu, kdo jeste nezacal; jakmile ma prvni, chodi mu i mesice s nulou).

import { createClient } from "npm:@supabase/supabase-js@2";

const SB_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SB_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const RESEND_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const SECRET = Deno.env.get("AFFILIATE_REPORT_SECRET") ?? "";
const TEST_INBOX = "fitness.barna@gmail.com";

const admin = createClient(SB_URL, SB_KEY, { auth: { persistSession: false } });

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });

// "2026-07" -> hranice mesice v UTC + ceske jmeno pro predmet mailu.
function hraniceMesice(mesic: string) {
  const [r, m] = mesic.split("-").map(Number);
  const od = new Date(Date.UTC(r, m - 1, 1));
  const doD = new Date(Date.UTC(r, m, 1));
  const JMENA = [
    "leden", "únor", "březen", "duben", "květen", "červen",
    "červenec", "srpen", "září", "říjen", "listopad", "prosinec",
  ];
  return { od: od.toISOString(), do: doD.toISOString(), jmeno: `${JMENA[m - 1]} ${r}` };
}

function minulyMesic(): string {
  const ted = new Date();
  const prvniTohoto = new Date(Date.UTC(ted.getUTCFullYear(), ted.getUTCMonth(), 1));
  const minuly = new Date(prvniTohoto.getTime() - 24 * 3600 * 1000);
  return `${minuly.getUTCFullYear()}-${String(minuly.getUTCMonth() + 1).padStart(2, "0")}`;
}

// Cele castky bez desetin (349 Kč), necele vzdy se dvema (69,80 Kč, ne 69,8 Kč).
const kc = (n: number) =>
  n.toLocaleString("cs-CZ", {
    minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
    maximumFractionDigits: 2,
  }) + " Kč";

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method" }, 405);
  if (!SECRET || req.headers.get("x-report-secret") !== SECRET) {
    return json({ error: "forbidden" }, 403);
  }

  const url = new URL(req.url);
  const dry = url.searchParams.get("dry") === "1";
  const test = url.searchParams.get("test") === "1";
  const mesic = url.searchParams.get("mesic") ?? minulyMesic();
  if (!/^\d{4}-\d{2}$/.test(mesic)) return json({ error: "mesic musi byt YYYY-MM" }, 400);
  const { od, do: doD, jmeno } = hraniceMesice(mesic);

  const { data: kody, error: eKody } = await admin
    .from("referral_codes")
    .select("code, owner_email")
    .eq("active", true)
    .eq("partner_type", "affiliate");
  if (eKody) return json({ ok: false, error: "referral_codes: " + eKody.message }, 500);

  const vysledky: Record<string, unknown>[] = [];
  let chyby = 0;

  for (const k of kody ?? []) {
    const code = String(k.code);
    const ownerEmail = String(k.owner_email ?? "").toLowerCase().trim();
    const zaznam: Record<string, unknown> = { code, owner: ownerEmail };
    try {
      // Ma partner vubec nejaky referral (kdykoliv)? Bez toho mail nema smysl.
      const { count: celkem } = await admin
        .from("referrals").select("id", { count: "exact", head: true }).eq("code", code);
      if (!celkem) { zaznam.stav = "preskoceno-bez-historie"; vysledky.push(zaznam); continue; }

      // Uz za tenhle mesic odeslano? (idempotence; test rezim ma vlastni typ,
      // aby zkouska nezablokovala ostry beh tehoz mesice)
      const typUdalosti = test ? "affiliate_report-test" : "affiliate_report";
      const { data: uzBylo } = await admin
        .from("email_events").select("id")
        .eq("type", typUdalosti)
        .eq("detail->>mesic", mesic).eq("detail->>code", code).limit(1);
      if (uzBylo && uzBylo.length) { zaznam.stav = "preskoceno-uz-odeslano"; vysledky.push(zaznam); continue; }

      // Cisla za mesic. `void` (refundy) se nepocitaji vubec.
      const { data: radky, error: eR } = await admin
        .from("referrals")
        .select("amount, reward_amount, status")
        .eq("code", code).neq("status", "void")
        .gte("created_at", od).lt("created_at", doD);
      if (eR) throw new Error("referrals: " + eR.message);
      const nakupu = (radky ?? []).length;
      const obrat = (radky ?? []).reduce((s, r) => s + Number(r.amount ?? 0), 0);
      const provize = (radky ?? []).reduce((s, r) => s + Number(r.reward_amount ?? 0), 0);
      const potvrzene = (radky ?? []).filter((r) => r.status === "confirmed")
        .reduce((s, r) => s + Number(r.reward_amount ?? 0), 0);
      const cekajici = provize - potvrzene;

      // Celkovy stav z admin view (tehoz, ktery vidi Martin ve Vyplatach).
      const { data: prehled } = await admin
        .from("affiliate_prehled").select("provize_confirmed, vyplaceno, k_vyplate")
        .eq("code", code).limit(1);
      const kVyplate = Number(prehled?.[0]?.k_vyplate ?? 0);
      const vyplaceno = Number(prehled?.[0]?.vyplaceno ?? 0);

      Object.assign(zaznam, { nakupu, obrat, provize, potvrzene, cekajici, kVyplate });

      if (dry) { zaznam.stav = "dry"; vysledky.push(zaznam); continue; }
      if (!RESEND_KEY) throw new Error("missing_RESEND_API_KEY");
      if (!ownerEmail) throw new Error("kod bez owner_email");

      const radek = (l: string, v: string) =>
        `<tr><td style="padding:6px 14px 6px 0;color:#555">${l}</td>`
        + `<td style="padding:6px 0;font-weight:700;text-align:right">${v}</td></tr>`;
      const html =
        `<div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;font-size:16px;line-height:1.55;color:#222;max-width:560px">`
        + `<p>Ahoj,</p>`
        + `<p>posílám slíbený měsíční přehled k tvému partnerskému kódu <b>${code}</b> za <b>${jmeno}</b>:</p>`
        + `<table style="border-collapse:collapse;margin:8px 0 16px">`
        + radek("Nákupů přes tvůj kód", String(nakupu))
        + radek("Obrat", kc(obrat))
        + radek("Tvoje provize za měsíc", kc(provize))
        + (cekajici > 0 ? radek("z toho čeká na potvrzení", kc(cekajici)) : "")
        + radek("Celkem k výplatě", kc(kVyplate))
        + (vyplaceno > 0 ? radek("Už vyplaceno dřív", kc(vyplaceno)) : "")
        + `</table>`
        + (cekajici > 0
          ? `<p style="color:#555;font-size:14px">Provize se potvrzuje 14 dní po nákupu (ochrana proti vráceným platbám), pak se překlopí do částky k výplatě.</p>`
          : "")
        + `<p>${kVyplate > 0 ? "Peníze ti pošlu na účet jako obvykle. Kdyby něco nesedělo, napiš mi." : "Tenhle měsíc bez výplaty. Kdyby něco nesedělo nebo jsi chtěl cokoliv doladit, napiš mi."}</p>`
        + `<p>Díky, že v tom jedeš se mnou.<br>Martin Barna<br>martinbarna.cz</p></div>`;

      const prijemce = test ? TEST_INBOX : ownerEmail;
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: "Bearer " + RESEND_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "Martin Barna <news@martinbarna.cz>",
          to: [prijemce],
          bcc: test ? undefined : [TEST_INBOX],
          reply_to: "martin@martinbarna.cz",
          subject: (test ? "[TEST] " : "") + `Tvůj partnerský přehled za ${jmeno}`,
          html,
        }),
      });
      if (!res.ok) throw new Error("resend_" + res.status + " " + (await res.text()).slice(0, 120));

      await admin.from("email_events").insert({
        lead_id: null, step: 0, type: typUdalosti,
        detail: { mesic, code, prijemce, nakupu, provize },
      });
      zaznam.stav = "odeslano";
      zaznam.prijemce = prijemce;
    } catch (e) {
      chyby++;
      zaznam.stav = "CHYBA: " + String(e).slice(0, 160);
    }
    vysledky.push(zaznam);
  }

  return json({ ok: chyby === 0, mesic, dry, test, kodu: (kody ?? []).length, vysledky });
});
