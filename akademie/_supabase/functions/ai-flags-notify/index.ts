// ai-flags-notify — mailová notifikace Martinovi o nových rizikových zprávách z AI chatu.
// Volá pg_cron (na projektu Barna Academy) každých 15 minut s hlavičkou x-flags-secret.
// Stejný zdroják běží na OBOU projektech (Barna Academy = web, AI Martin Barna = appka),
// liší se jen env: SOURCE_LABEL, ADMIN_URL, NOTIFY_FROM.
// V mailu je JEN typ a čas — nikdy obsah zprávy ani identita klienta (Martinovo zadání 21. 7. 2026).
// Úryvek zprávy vidí admin až v /akademie/admin/ (web), resp. v Supabase tabulce (appka).
// Stav drží sloupec ai_flags.notified_at — žádná další tabulka, opakovaný běh nic nepošle dvakrát.
// Env: FLAGS_NOTIFY_SECRET (povinný, jinak 403 na vše), RESEND_API_KEY, SOURCE_LABEL, ADMIN_URL, NOTIFY_FROM.
// Deploy: supabase functions deploy ai-flags-notify --no-verify-jwt (v obou projektech).
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const SECRET = Deno.env.get("FLAGS_NOTIFY_SECRET") ?? "";
const SOURCE = Deno.env.get("SOURCE_LABEL") ?? "AI chat";
const ADMIN_URL = Deno.env.get("ADMIN_URL") ?? "https://martinbarna.cz/akademie/admin/";
const FROM = Deno.env.get("NOTIFY_FROM") ?? "Martin Barna <news@martinbarna.cz>";
const TO = "martin@martinbarna.cz";
const BCC = "fitness.barna@gmail.com";

const KAT: Record<string, string> = {
  crisis: "🔴 KRIZE (linka 116 123 poslána)",
  eating_disorder: "🔴 Porucha příjmu potravy",
  medical: "🟠 Zdravotní téma",
  pregnancy: "🟠 Těhotenství",
  minor: "🟠 Nezletilý",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { "Content-Type": "application/json" } });

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "method" }, 405);
  // FAIL CLOSED: bez nastaveného secretu neodpovídáme nikomu (nikdo nesmí vyvolat mail zvenku)
  if (!SECRET || req.headers.get("x-flags-secret") !== SECRET) return json({ error: "forbidden" }, 403);
  if (!RESEND_KEY) return json({ error: "no_resend" }, 500);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
  const { data: flags, error } = await admin.from("ai_flags")
    .select("id,category,created_at")
    .is("notified_at", null)
    .order("created_at", { ascending: true })
    .limit(50);
  if (error) return json({ error: "db", detail: error.message }, 500);
  if (!flags?.length) return json({ ok: true, sent: 0 });

  const hard = flags.some((f) => f.category === "crisis" || f.category === "eating_disorder");
  const radky = flags.map((f) => {
    const kdy = new Date(f.created_at).toLocaleString("cs-CZ", {
      timeZone: "Europe/Prague", day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit",
    });
    return `<tr><td style='padding:6px 10px;border-bottom:1px solid #262232;font-weight:700'>${KAT[f.category] ?? f.category}</td>` +
      `<td align='right' style='padding:6px 10px;border-bottom:1px solid #262232;color:#B9B3C4'>${kdy}</td></tr>`;
  }).join("");
  const html = `<!doctype html><html lang='cs'><head><meta charset='utf-8'><meta name='color-scheme' content='dark'></head>` +
    `<body style='margin:0;background:#0C0B10;padding:16px'>` +
    `<table role='presentation' width='560' cellpadding='0' cellspacing='0' style='width:100%;max-width:560px;margin:0 auto;background:#181520;border:1px solid #262232;color:#F0EADF;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;font-size:15px;line-height:1.55'><tr><td style='padding:26px'>` +
    `<div style='border-left:3px solid ${hard ? "#dc503c" : "#EBB12C"};padding-left:10px;font-weight:800;font-size:13px;letter-spacing:.15em;text-transform:uppercase;color:${hard ? "#e07f6f" : "#EBB12C"};margin:0 0 16px'>AI chat · rizikové zprávy · ${SOURCE}</div>` +
    `<p style='margin:0 0 12px'>Zachytil jsem ${flags.length}× rizikovou zprávu. AI odpověděla bezpečně podle pravidel. Typ a čas níž; obsah zprávy mailem záměrně nechodí.</p>` +
    `<table role='presentation' width='100%' cellpadding='0' cellspacing='0' style='font-size:14px;border-collapse:collapse'>${radky}</table>` +
    `<p style='margin:18px 0 0'><a href='${ADMIN_URL}' style='display:inline-block;background:#EBB12C;color:#1A1222;text-decoration:none;padding:12px 22px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;font-size:14px'>Otevřít detail</a></p>` +
    `</td></tr></table></body></html>`;

  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: FROM, to: [TO], bcc: [BCC],
      subject: `${hard ? "🔴" : "⚠️"} AI chat (${SOURCE}): ${flags.length}× riziková zpráva`,
      html,
    }),
  });
  // Mail neodešel → notified_at NEoznačovat, další běh cronu to zkusí znovu (nic se neztratí).
  if (r.status !== 200) return json({ error: "resend", status: r.status }, 500);
  const { error: upErr } = await admin.from("ai_flags")
    .update({ notified_at: new Date().toISOString() })
    .in("id", flags.map((f) => f.id));
  if (upErr) return json({ ok: true, sent: flags.length, warn: "notified_at update selhal: " + upErr.message });
  return json({ ok: true, sent: flags.length, hard });
});
