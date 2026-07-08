// contact-send — relay webového kontaktního formuláře Martinovi přes Resend.
// Důvod: FormSubmit vystavoval martin@martinbarna.cz přímo ve zdroji stránky,
// takže spamboti POSTovali napřímo mimo honeypot. Tady e-mail ve zdroji není
// a validace běží server-side (honeypot + časová past + origin + pole).
// verify_jwt: false (volá se z prohlížeče bez přihlášení).

const ALLOWED_ORIGINS = ["https://martinbarna.cz", "https://www.martinbarna.cz"];

function cors(origin: string) {
  const allow = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type",
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

  // Spam signály → tváříme se OK, ale nic neodešleme (nekrmíme boty zpětnou vazbou).
  const spam =
    honey !== "" ||
    !originOk ||
    elapsed < 3000 ||
    !name || !email || !message ||
    !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) ||
    message.length < 5 || message.length > 5000 ||
    name.length > 120;
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
