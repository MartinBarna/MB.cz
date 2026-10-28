// ses-events: příjem Amazon SNS notifikací z SES (configuration set mb-mailing).
// Nasazeno s --no-verify-jwt.
//
// POST pouze. Ověření topicu a podpisu fail-closed. Zapisuje do email_events
// a mění stav leads stejně jako resend-webhook.

import { createClient } from "jsr:@supabase/supabase-js@2";
import { handleSns } from "./core.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
  const env = (k: string) => Deno.env.get(k) ?? "";
  const body = await req.text();
  const res = await handleSns(req.method, body, {
    admin,
    fetch: globalThis.fetch,
    now: () => new Date(),
    env,
  });
  return json(res.body, res.status);
});
