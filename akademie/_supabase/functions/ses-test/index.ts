// ses-test: POST s JWT admina, mail jen na pevný allowlist, vždy přes SES.
//
// NENASAZOVAT v tomhle PR. Nasazení a každé volání schvaluje Claude (Tým 2).
// Auth 1:1 s admin-api / admin-pulse: user JWT + allowlist admin_emails.
// verify_jwt při pozdějším deployi nechat zapnuté. Tahle funkce si token
// ověřuje znovu, stejně jako ostatní admin funkce.

import { createClient } from "jsr:@supabase/supabase-js@2";
import { handleSesTest } from "./core.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

Deno.serve(async (req) => {
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
  return await handleSesTest(req, {
    async emailAdmina(authHeader) {
      if (!SUPABASE_URL || !ANON_KEY) return null;
      const userClient = createClient(SUPABASE_URL, ANON_KEY, {
        global: { headers: { Authorization: authHeader } },
        auth: { persistSession: false },
      });
      const { data } = await userClient.auth.getUser();
      return data.user?.email ?? null;
    },
    async adminEmaily() {
      const { data } = await admin.from("app_config").select("value").eq("key", "admin_emails").maybeSingle();
      return String(data?.value || "fitness.barna@gmail.com")
        .split(",")
        .map((s: string) => s.trim().toLowerCase())
        .filter(Boolean);
    },
    async zapisStopu(radek) {
      const { error } = await admin.from("email_events").insert(radek);
      if (error) {
        console.error("[ses-test] zapis stopy selhal: " + error.message);
        return { ok: false };
      }
      return { ok: true };
    },
  });
});
