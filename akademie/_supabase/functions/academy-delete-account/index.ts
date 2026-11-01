// academy-delete-account
// Smazání vlastního účtu Academy (člověk maže jen sebe, identita jen z JWT).
//
// Pořadí:
//   1. auth.getUser() z Authorization. Tělo požadavku se nečte (žádné cizí id).
//   2. Zrušit běžící měsíční členství ve Stripu (best-effort, nesmí blokovat výmaz).
//   3. Trvalé odhlášení z mailingu (best-effort).
//   4. Smazat osobní řádky klíčované e-mailem, které nemají kaskádu z auth.users.
//   5. admin.auth.admin.deleteUser. profiles a progress spadnou kaskádou.
//
// Selhání Stripe nebo odhlášení účet nesmaže ze hry: zapíše se alert do email_events
// (type error, track academy-delete-account) a výmaz pokračuje.
// Selhání mazání osobních řádků (když tabulka v DB je) vrátí 500 a deleteUser
// se nezavolá, ať se dá požadavek zopakovat.
// Chybějící tabulka (42P01 / PGRST205) výmaz neblokuje: kosik migrace v repu
// je označená NESPOUSTET a v produkci být nemusí.
//
// Deploy (NESPOUŠTĚT z téhle větve, udělá Claude po kontrole):
//   rm -rf supabase/functions/academy-delete-account
//   cp -r akademie/_supabase/functions/academy-delete-account supabase/functions/
//   npx supabase functions deploy academy-delete-account --project-ref uhmrpfsdcujbhbtumqye --no-verify-jwt
// verify_jwt nechat false jako lesson-peek a client-report. Bránu drží auth.getUser() v kódu.
// Nová funkce, živá verze neexistuje. Bez tajných klíčů, jen Deno.env.get.
//
// Vzor identity a pořadí Stripe před deleteUser: appka Tvůj Coach, funkce delete-account.
// Stripe klíč a tvar DELETE: academy-stripe-webhook (STRIPE_RESTRICTED_SUBS_KEY).
// Alert: app-purchase-bridge alertAdmin, ale BEZ mailu ven.

import { createClient } from "jsr:@supabase/supabase-js@2";
import {
  chybiTabulka,
  escapeIlikeExact,
  jeDuplicita,
  jeMesicniClenstvi,
  jePouzitelnyEmail,
  jeStripeSubscriptionId,
  SMAZAT_CLIENT_EMAIL,
  SMAZAT_EMAIL,
} from "./vyber.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const STRIPE_SUBS_KEY = Deno.env.get("STRIPE_RESTRICTED_SUBS_KEY") ?? "";

const ALLOWED = ["https://martinbarna.cz", "https://www.martinbarna.cz"];

type Admin = ReturnType<typeof createClient>;
type DbErr = { code?: string; message?: string } | null;

function cors(req: Request): Record<string, string> {
  const o = req.headers.get("Origin") ?? "";
  return {
    "Access-Control-Allow-Origin": ALLOWED.includes(o) ? o : ALLOWED[0],
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function json(body: unknown, headers: Record<string, string>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });
}

async function alertAdmin(admin: Admin, predmet: string, detail: Record<string, unknown>): Promise<void> {
  try {
    const { error } = await admin.from("email_events").insert({
      lead_id: null,
      step: 0,
      type: "error",
      detail: {
        track: "academy-delete-account",
        error: predmet + " " + JSON.stringify(detail).slice(0, 300),
      },
    });
    if (error) throw new Error(error.message);
  } catch (e) {
    const sub = detail.subscription ? String(detail.subscription).slice(0, 40) : "";
    console.error(
      "[academy-delete-account] alert se nepodarilo zapsat:",
      predmet,
      sub,
      String(e).slice(0, 160),
    );
  }
}

async function zrusMesicni(admin: Admin, email: string, esc: string): Promise<void> {
  try {
    const { data, error } = await admin
      .from("entitlements")
      .select("source, stripe_subscription_id")
      .ilike("email", esc);
    if (error) {
      await alertAdmin(admin, "entitlements se nepodarilo precist, mesicni clenstvi zkontroluj rucne", {
        email,
        code: error.code,
        message: String(error.message || "").slice(0, 160),
      });
      return;
    }
    const ids = new Set<string>();
    for (const row of data ?? []) {
      if (!jeMesicniClenstvi(row)) continue;
      const id = String(row.stripe_subscription_id ?? "").trim();
      if (id) ids.add(id);
    }
    if (ids.size === 0) return;
    if (!STRIPE_SUBS_KEY) {
      await alertAdmin(admin, "chybi STRIPE_RESTRICTED_SUBS_KEY, mesicni predplatne zrus rucne", {
        email,
        subscriptions: [...ids].join(","),
      });
      return;
    }
    for (const id of ids) {
      if (!jeStripeSubscriptionId(id)) {
        await alertAdmin(admin, "mesicni clenstvi ma divne stripe id, zkontroluj rucne", {
          email,
          subscription: id.slice(0, 40),
        });
        continue;
      }
      try {
        const r = await fetch(
          "https://api.stripe.com/v1/subscriptions/" + encodeURIComponent(id),
          { method: "DELETE", headers: { Authorization: "Bearer " + STRIPE_SUBS_KEY } },
        );
        if (r.ok) continue;
        const telo = await r.text().catch(() => "");
        if (/resource_missing/i.test(telo)) continue;
        await alertAdmin(admin, "zruseni mesicniho predplatneho selhalo", {
          email,
          subscription: id,
          http: r.status,
          telo: telo.slice(0, 160),
        });
      } catch (e) {
        await alertAdmin(admin, "zruseni mesicniho predplatneho spadlo", {
          email,
          subscription: id,
          chyba: String(e).slice(0, 160),
        });
      }
    }
  } catch (e) {
    await alertAdmin(admin, "krok Stripe spadl, ucet mazu dal", {
      email,
      chyba: String(e).slice(0, 160),
    });
  }
}

async function odhlasTrvale(admin: Admin, email: string, esc: string): Promise<void> {
  try {
    const vlozeno = await admin.from("odhlaseni_trvale").insert({
      email,
      zdroj: "academy-delete-account",
    });
    const insErr = vlozeno.error as DbErr;
    if (insErr && !jeDuplicita(insErr)) {
      await alertAdmin(admin, "odhlaseni_trvale insert selhal, zkousim lead a kontakty dal", {
        email,
        code: insErr.code,
        message: String(insErr.message || "").slice(0, 160),
      });
    }

    const { data: leads, error: leadErr } = await admin.from("leads").select("id,status").ilike("email", esc);
    if (leadErr) {
      await alertAdmin(admin, "leads se nepodarilo precist", {
        email,
        code: leadErr.code,
        message: String(leadErr.message || "").slice(0, 160),
      });
    } else {
      for (const lead of leads ?? []) {
        if (String(lead.status ?? "") === "unsubscribed") continue;
        const { error: rpcErr } = await admin.rpc("odhlas_a_odstran", {
          p_lead_id: lead.id,
          p_zdroj: "academy-delete-account",
        });
        if (rpcErr) {
          await alertAdmin(admin, "odhlas_a_odstran selhalo", {
            email,
            lead_id: lead.id,
            message: String(rpcErr.message || "").slice(0, 160),
          });
        }
      }
    }

    await zmrazKontakty(admin, email, esc);

    const en = await admin.from("en_unsubscribes").insert({
      email,
      source: "academy-delete-account",
    });
    const enErr = en.error as DbErr;
    if (enErr && !jeDuplicita(enErr)) {
      await alertAdmin(admin, "en_unsubscribes insert selhal", {
        email,
        code: enErr.code,
        message: String(enErr.message || "").slice(0, 160),
      });
    }
  } catch (e) {
    await alertAdmin(admin, "odhlaseni spadlo, ucet mazu dal", {
      email,
      chyba: String(e).slice(0, 160),
    });
  }
}

async function zmrazKontakty(admin: Admin, email: string, esc: string): Promise<void> {
  const now = new Date().toISOString();
  const stav = await admin
    .from("customer_contacts")
    .update({ status: "unsubscribed" })
    .ilike("email", esc)
    .or("status.is.null,status.neq.unsubscribed");
  if (stav.error && chybiTabulka(stav.error)) {
    await alertAdmin(admin, "customer_contacts v DB neni", {
      email,
      code: stav.error.code,
      message: String(stav.error.message || "").slice(0, 160),
    });
    return;
  }
  if (stav.error) {
    await alertAdmin(admin, "customer_contacts status se nepodarilo zmrazit", {
      email,
      code: stav.error.code,
      message: String(stav.error.message || "").slice(0, 160),
    });
  }
  const cas = await admin
    .from("customer_contacts")
    .update({ updated_at: now })
    .ilike("email", esc);
  if (cas.error && !chybiTabulka(cas.error)) {
    await alertAdmin(admin, "customer_contacts updated_at se nepodarilo zapsat", {
      email,
      code: cas.error.code,
      message: String(cas.error.message || "").slice(0, 120),
    });
  }
  const poprve = await admin
    .from("customer_contacts")
    .update({ unsubscribed_at: now })
    .ilike("email", esc)
    .is("unsubscribed_at", null);
  if (poprve.error && !chybiTabulka(poprve.error)) {
    await alertAdmin(admin, "customer_contacts unsubscribed_at se nepodarilo zapsat", {
      email,
      code: poprve.error.code,
      message: String(poprve.error.message || "").slice(0, 120),
    });
  }
}

/** Vrátí "db", když osobní řádek zůstal a účet se ještě nemá smazat. */
async function smazOsobniRadky(admin: Admin, email: string, esc: string): Promise<string | null> {
  for (const table of SMAZAT_EMAIL) {
    const stop = await smazTabulku(admin, email, table, () =>
      admin.from(table).delete().ilike("email", esc)
    );
    if (stop) return stop;
  }
  for (const table of SMAZAT_CLIENT_EMAIL) {
    const stop = await smazTabulku(admin, email, table, () =>
      admin.from(table).delete().ilike("client_email", esc)
    );
    if (stop) return stop;
  }
  const kosik = await smazTabulku(admin, email, "kosik_checkouty", () =>
    admin.from("kosik_checkouty").delete().ilike("email", esc).is("zaplaceno_at", null)
  );
  return kosik;
}

async function smazTabulku(
  admin: Admin,
  email: string,
  table: string,
  akce: () => PromiseLike<{ error: DbErr }>,
): Promise<string | null> {
  try {
    const { error } = await akce();
    if (!error) return null;
    await alertAdmin(admin, "mazani tabulky selhalo: " + table, {
      email,
      code: error.code,
      message: String(error.message || "").slice(0, 160),
    });
    if (chybiTabulka(error)) return null;
    return "db";
  } catch (e) {
    await alertAdmin(admin, "mazani tabulky spadlo: " + table, {
      email,
      chyba: String(e).slice(0, 160),
    });
    return "db";
  }
}

Deno.serve(async (req: Request) => {
  const C = cors(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: C });
  if (req.method !== "POST") return json({ ok: false, error: "method" }, C, 405);
  if (!SUPABASE_URL || !ANON_KEY || !SERVICE_ROLE) return json({ ok: false, error: "server" }, C, 500);

  try {
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
    if (!token) return json({ ok: false, error: "unauthorized" }, C, 401);

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: "Bearer " + token } },
      auth: { persistSession: false },
    });
    const { data: udata, error: authErr } = await userClient.auth.getUser(token);
    const userId = udata?.user?.id ?? "";
    if (authErr || !userId) return json({ ok: false, error: "unauthorized" }, C, 401);

    const email = String(udata?.user?.email ?? "").trim().toLowerCase();
    if (!jePouzitelnyEmail(email)) return json({ ok: false, error: "chybi_email" }, C, 400);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
    const esc = escapeIlikeExact(email);

    await zrusMesicni(admin, email, esc);
    await odhlasTrvale(admin, email, esc);
    const dbChyba = await smazOsobniRadky(admin, email, esc);
    if (dbChyba) return json({ ok: false, error: "db" }, C, 500);

    const { error: delErr } = await admin.auth.admin.deleteUser(userId);
    if (delErr) {
      await alertAdmin(admin, "deleteUser selhal", {
        email,
        message: String(delErr.message || "").slice(0, 180),
      });
      return json({ ok: false, error: "db" }, C, 500);
    }
    return json({ ok: true }, C);
  } catch (e) {
    console.error(
      "[academy-delete-account] nevyresena vyjimka",
      e instanceof Error ? e.message.slice(0, 180) : "",
    );
    return json({ ok: false, error: "server" }, C, 500);
  }
});
