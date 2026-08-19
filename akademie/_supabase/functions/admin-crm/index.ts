// Barna Academy admin-crm: read-only prohlizec CRM (crm_*, crm_person_card, crm_import_kp2026).
// Auth 1:1 s admin-api / admin-pulse: user JWT + allowlist admin_emails z app_config.
// Service-role jen tady na serveru. Zadny zapis (select only). RLS na crm_* nema politiky zamerne.
//
// Deploy az po schvaleni:
//   cp akademie/_supabase/functions/admin-crm/index.ts supabase/functions/admin-crm/index.ts
//   npx supabase functions deploy admin-crm --project-ref uhmrpfsdcujbhbtumqye --no-verify-jwt
// Po deployi overit get_edge_function (ne jen hlasku Deployed). Stranka: /akademie/admin/crm/
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const low = (s: unknown) => String(s ?? "").trim().toLowerCase();

// PostgREST vraci max 1000 radku. Razeni MUSI byt deterministicke.
// deno-lint-ignore no-explicit-any
async function fetchAllRows(pageQuery: (from: number, to: number) => any): Promise<any[]> {
  // deno-lint-ignore no-explicit-any
  const out: any[] = [];
  const STEP = 1000;
  for (let from = 0; ; from += STEP) {
    const { data, error } = await pageQuery(from, from + STEP - 1);
    if (error) throw new Error(String(error.message ?? error));
    const batch = data ?? [];
    out.push(...batch);
    if (batch.length < STEP) break;
  }
  return out;
}

// Neunikatni sloupec: limit(1), ne maybeSingle (2+ radky = 500).
// deno-lint-ignore no-explicit-any
async function firstRow(query: any): Promise<Record<string, any> | null> {
  const { data, error } = await query.limit(1);
  if (error) throw new Error(String(error.message ?? error));
  return (data && data[0]) || null;
}

function emailsFrom(raw: unknown): string[] {
  if (raw == null || raw === "") return [];
  if (Array.isArray(raw)) {
    return raw.map((x) => low(x)).filter(Boolean);
  }
  if (typeof raw === "object") {
    return Object.values(raw as Record<string, unknown>).flatMap(emailsFrom);
  }
  return String(raw).split(/[,;|\s]+/).map((s) => low(s)).filter((s) => s.includes("@"));
}

function numOrNull(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function strOrNull(v: unknown): string | null {
  const s = String(v ?? "").trim();
  return s ? s : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method" }, 405);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

  const authHeader = req.headers.get("Authorization") || "";
  const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
  const { data: ures } = await userClient.auth.getUser();
  const me = low(ures?.user?.email);
  const cfg = await admin.from("app_config").select("value").eq("key", "admin_emails").maybeSingle();
  const adminList = String(cfg.data?.value || "fitness.barna@gmail.com").split(",").map((s) => low(s)).filter(Boolean);
  if (!me || !adminList.includes(me)) return json({ error: "forbidden" }, 403);

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const action = String(body.action || "");

  try {
    if (action === "list") {
      // Seznam: osoby + tagy. Plny pohled crm_person_card az na action=card
      // (lateraly na entitlements/leads/souhlasy by tady bezely zbytecne).
      const [impRows, personRows, tagRows] = await Promise.all([
        fetchAllRows((f, t) => admin.from("crm_import_kp2026").select("*").order("id").range(f, t)),
        fetchAllRows((f, t) =>
          admin.from("crm_persons").select(
            "id,display_name,primary_email,primary_phone,lifecycle,is_test",
          ).eq("status", "active").order("id").range(f, t)
        ),
        fetchAllRows((f, t) =>
          admin.from("crm_tags").select("person_id,tag").is("detached_at", null)
            .eq("tag", "ss-import-do-not-mail").order("id").range(f, t)
        ),
      ]);

      const cardById = new Map<string, Record<string, unknown>>();
      const cardByEmail = new Map<string, Record<string, unknown>>();
      for (const c of personRows) {
        const id = String(c.id);
        cardById.set(id, c);
        const em = low(c.primary_email);
        if (em) cardByEmail.set(em, c);
      }
      const doNotMail = new Set(tagRows.map((t) => String(t.person_id)));

      const usedCard = new Set<string>();
      const rows: Record<string, unknown>[] = [];
      let importWithEmail = 0;
      let importSoucet = 0;

      for (const r of impRows) {
        const extra = emailsFrom(r.emaily_dalsi);
        const email = low(r.email);
        if (email) importWithEmail++;
        const kc = numOrNull(r.soucet_kc) ?? 0;
        importSoucet += kc;
        let card: Record<string, unknown> | undefined;
        const pid = strOrNull(r.person_id);
        if (pid && cardById.has(pid)) card = cardById.get(pid);
        // Jen person_id a primarni email. emaily_dalsi se ukazuji, neslepuji.
        if (!card && email && cardByEmail.has(email)) card = cardByEmail.get(email);
        if (card) usedCard.add(String(card.id));
        rows.push({
          k: "i:" + String(r.id),
          import_id: r.id,
          person_id: card ? card.id : (pid || null),
          jmeno: strOrNull(r.jmeno) || strOrNull(card?.display_name) || "",
          email: email || null,
          emaily_dalsi: extra,
          soucet_kc: numOrNull(r.soucet_kc),
          pocet_plateb: numOrNull(r.pocet_plateb),
          prvni_platba: strOrNull(r.prvni_platba),
          posledni_obdobi_konec: strOrNull(r.posledni_obdobi_konec),
          lifecycle: card ? strOrNull(card.lifecycle) : null,
          is_test: Boolean(card?.is_test),
          neposilat: card ? doNotMail.has(String(card.id)) : false,
          zdroj: card ? "oboje" : "koucink",
        });
      }

      for (const c of personRows) {
        if (usedCard.has(String(c.id))) continue;
        rows.push({
          k: "p:" + String(c.id),
          import_id: null,
          person_id: c.id,
          jmeno: strOrNull(c.display_name) || "",
          email: low(c.primary_email) || null,
          emaily_dalsi: [],
          soucet_kc: null,
          pocet_plateb: null,
          prvni_platba: null,
          posledni_obdobi_konec: null,
          lifecycle: strOrNull(c.lifecycle),
          is_test: Boolean(c.is_test),
          neposilat: doNotMail.has(String(c.id)),
          zdroj: "academy",
        });
      }

      rows.sort((a, b) => {
        const ka = a.soucet_kc == null ? -1 : Number(a.soucet_kc);
        const kb = b.soucet_kc == null ? -1 : Number(b.soucet_kc);
        if (kb !== ka) return kb - ka;
        return String(a.jmeno).localeCompare(String(b.jmeno), "cs");
      });

      return json({
        ok: true,
        rows,
        meta: {
          import_total: impRows.length,
          import_with_email: importWithEmail,
          cards_total: personRows.length,
          import_soucet_kc: importSoucet,
          rows_total: rows.length,
        },
      });
    }

    if (action === "card") {
      const importIdRaw = body.import_id;
      const personId = strOrNull(body.person_id);
      const importId = importIdRaw == null || importIdRaw === "" ? null : importIdRaw;

      // deno-lint-ignore no-explicit-any
      let imp: Record<string, any> | null = null;
      if (importId != null) {
        const { data, error } = await admin.from("crm_import_kp2026").select("*").eq("id", importId).maybeSingle();
        if (error) throw new Error(String(error.message ?? error));
        imp = data ?? null;
      }

      let pid = personId || strOrNull(imp?.person_id);
      const primaryEmail = imp ? low(imp.email) : "";

      // deno-lint-ignore no-explicit-any
      let card: Record<string, any> | null = null;
      if (pid) {
        const { data, error } = await admin.from("crm_person_card").select("*").eq("id", pid).maybeSingle();
        if (error) throw new Error(String(error.message ?? error));
        card = data ?? null;
      }
      // Jen primarni email, ne emaily_dalsi. Vedlejsi adresa neni dukaz teze osoby.
      if (!card && primaryEmail) {
        card = await firstRow(
          admin.from("crm_person_card").select("*").eq("primary_email", primaryEmail).order("id"),
        );
        if (card) pid = String(card.id);
      }

      if (!imp && pid) {
        imp = await firstRow(
          admin.from("crm_import_kp2026").select("*").eq("person_id", pid).order("id"),
        );
        if (!imp && card?.primary_email) {
          imp = await firstRow(
            admin.from("crm_import_kp2026").select("*").eq("email", low(card.primary_email)).order("id"),
          );
        }
      }

      if (!imp && !card) return json({ error: "not_found" }, 404);

      // deno-lint-ignore no-explicit-any
      let identifiers: any[] = [];
      if (pid) {
        identifiers = await fetchAllRows((f, t) =>
          admin.from("crm_identifiers")
            .select("kind,value_normalized,value_raw,source,confidence")
            .eq("person_id", pid)
            .order("kind")
            .range(f, t)
        );
      }

      return json({
        ok: true,
        import: imp,
        card,
        identifiers,
      });
    }

    return json({ error: "unknown_action" }, 400);
  } catch (e) {
    return json({ error: "server", detail: String(e).slice(0, 300) }, 500);
  }
});
