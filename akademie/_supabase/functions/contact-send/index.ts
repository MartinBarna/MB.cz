// contact-send — relay webového kontaktního formuláře Martinovi přes Resend.
// Důvod: FormSubmit vystavoval martin@martinbarna.cz přímo ve zdroji stránky,
// takže spamboti POSTovali napřímo mimo honeypot. Tady e-mail ve zdroji není
// a validace běží server-side (honeypot + časová past + origin + pole).
// verify_jwt: false (volá se z prohlížeče bez přihlášení).
//
// LOG: každou on-site submisi zapíšeme do contact_messages (relevant vs spam),
// aby ji Martin viděl v adminu. Off-site boti (cizí/chybějící Origin) se NELOGUJÍ
// (jinak by šel endpoint zaplavit řádky). Zápis je best-effort — nikdy neblokuje e-mail.
import { createClient } from "jsr:@supabase/supabase-js@2";

const ALLOWED_ORIGINS = ["https://martinbarna.cz", "https://www.martinbarna.cz"];

function cors(origin: string) {
  const allow = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Vary": "Origin",
  };
}

function json(body: unknown, status: number, origin: string) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors(origin), "Content-Type": "application/json" },
  });
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Zapíše submisi do contact_messages (best-effort). Pole ořízneme kvůli obraně proti balastu.
async function logMessage(row: {
  name: string; email: string; message: string; spam: boolean; spam_reason: string; origin: string;
}) {
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) return;
    const admin = createClient(url, key, { auth: { persistSession: false } });
    await admin.from("contact_messages").insert({
      name: row.name.slice(0, 200),
      email: row.email.slice(0, 200),
      message: row.message.slice(0, 5000),
      spam: row.spam,
      spam_reason: row.spam_reason.slice(0, 300),
      origin: row.origin.slice(0, 200),
    });
  } catch { /* log je doplněk, nesmí shodit odeslání */ }
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin") || "";
  if (req.method === "OPTIONS") return new Response(null, { headers: cors(origin) });
  if (req.method !== "POST") return json({ ok: false }, 405, origin);

  let b: Record<string, unknown> = {};
  try { b = await req.json(); } catch { return json({ ok: true }, 200, origin); }

  const name = String(b.name ?? "").trim();
  const email = String(b.email ?? "").trim();
  const message = String(b.message ?? "").trim();
  const honey = String(b.website ?? "").trim(); // honeypot (skryté pole)
  const elapsed = Number(b.t ?? 0);             // ms od načtení formuláře
  const originOk = ALLOWED_ORIGINS.includes(origin);

  // Off-site POST (cizí/chybějící Origin) = bot mimo web → tiše zahoď, NELOGUJ (jinak zaplavení).
  if (!originOk) return json({ ok: true }, 200, origin);

  // Spam signály (submise ale přišla z webu) → tváříme se OK, ale nic neodešleme
  // (nekrmíme boty zpětnou vazbou). I tak ji zalogujeme jako „potenciální spam".
  const reasons: string[] = [];
  if (honey !== "") reasons.push("honeypot");
  if (elapsed < 3000) reasons.push("příliš rychle (<3s)");
  if (!name) reasons.push("prázdné jméno");
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) reasons.push("neplatný e-mail");
  if (!message || message.length < 5) reasons.push("krátká/prázdná zpráva");
  if (message.length > 5000) reasons.push("příliš dlouhá zpráva");
  if (name.length > 120) reasons.push("příliš dlouhé jméno");
  const spam = reasons.length > 0;
  const spam_reason = reasons.join(", ");

  // Log VŽDY (relevant i spam) — ať to Martin vidí v adminu. Nezáleží na výsledku odeslání.
  await logMessage({ name, email, message, spam, spam_reason, origin });

  if (spam) return json({ ok: true }, 200, origin);

  const key = Deno.env.get("RESEND_API_KEY");
  if (!key) return json({ ok: false, error: "config" }, 500, origin);

  const html =
    `<h3 style="margin:0 0 12px">Nová poptávka z webu (MB.cz)</h3>` +
    `<table cellpadding="6" style="border-collapse:collapse">` +
    `<tr><td><b>Jméno</b></td><td>${esc(name)}</td></tr>` +
    `<tr><td><b>E-mail</b></td><td>${esc(email)}</td></tr>` +
    `<tr><td valign="top"><b>Zpráva</b></td><td>${esc(message).replace(/\n/g, "<br>")}</td></tr>` +
    `</table>`;

  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "Web MB.cz <news@martinbarna.cz>",
      to: ["martin@martinbarna.cz"],
      reply_to: email,
      subject: "Nová poptávka z webu (MB.cz)",
      html,
    }),
  });
  if (!r.ok) return json({ ok: false, error: "send" }, 502, origin);
  return json({ ok: true }, 200, origin);
});
