// Samostatny webhook kosiku. Deploy --no-verify-jwt, podpis KOSIK_STRIPE_WEBHOOK_SECRET.
// Mail se tady neposila. Cizi session (appka, platebni odkazy) vrati 200 a nic nezapise.
import { createClient } from "jsr:@supabase/supabase-js@2";
import { overPodpisStripe } from "./podpis.ts";
import { zpracujWebhook, type RadekKosiku } from "./logika.ts";

const admin = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  { auth: { persistSession: false } },
);

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method" }, 405);
  const raw = await req.text();
  const sig = req.headers.get("stripe-signature") ?? "";
  const secrety = [
    Deno.env.get("KOSIK_STRIPE_WEBHOOK_SECRET") ?? "",
    Deno.env.get("KOSIK_STRIPE_WEBHOOK_SECRET_TEST") ?? "",
  ];
  const odpoved = await zpracujWebhook(raw, sig, {
    ted: new Date(),
    overPodpis: (telo, hlavicka) => overPodpisStripe(telo, hlavicka, secrety),
    najdi: async (dotaz) => {
      let q = admin.from("kosik_checkouty").select(
        "id,email,souhlas,souhlas_at,souhlas_text,souhlas_verze,stripe_session_id,expirovano_at,zaplaceno_at",
      );
      if (dotaz.id) q = q.eq("id", dotaz.id);
      else if (dotaz.session) q = q.eq("stripe_session_id", dotaz.session);
      else return null;
      const { data, error } = await q.maybeSingle();
      if (error || !data) return null;
      return data as RadekKosiku;
    },
    zapisExpiraci: async (id, patch) => {
      const { data, error } = await admin.from("kosik_checkouty")
        .update(patch)
        .eq("id", id)
        .is("expirovano_at", null)
        .select("id");
      if (error) return "uz_bylo";
      return data && data.length > 0 ? "ok" : "uz_bylo";
    },
    zapisPlatbu: async (id, patch) => {
      await admin.from("kosik_checkouty").update(patch).eq("id", id).is("zaplaceno_at", null);
    },
  });
  return json(odpoved.body, odpoved.status);
});
