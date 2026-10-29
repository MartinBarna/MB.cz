// Cron odesilace pripominky kosiku. Vola se s x-drip-secret.
// kosik_mail_zapnuto je ve vychozim stavu vypnute, kosik_dry_run zapnute.
// Odeslani jde pres posliMail (MAIL_PROVIDER, vychozi resend). Dry-run posliMail nevola.
import { createClient } from "jsr:@supabase/supabase-js@2";
import { nactiKosikFlagy } from "../_shared/kosik-flagy-db.ts";
import { escapeIlikeExact, guardSend, sendIfAllowed } from "../_shared/mailing-guard.ts";
import { mailKlic } from "../_shared/mail-provider.ts";
import { aplikujFiltrSouhlasu, castiPraha, jeMarketingovaUdalost, prahaNaUtc, produktEntitlement } from "../_shared/kosik-pravidla.ts";
import { odesliPresResend } from "../_shared/resend-odeslat.ts";
import { overSecret } from "../_shared/secret-guard.ts";
import { ODESILATEL, REPLY_TO } from "../_shared/kosik-texty.ts";
import { filtryKroku, zpracujPripominku, type Kandidat, type VysledekMailu } from "./logika.ts";

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

async function nactiKrok(krok: 0 | 1, dry: boolean, tedIso: string): Promise<Kandidat[]> {
  let q = admin.from("kosik_checkouty").select(
    "id,created_at,email,produkt_klic,castka_halere,souhlas,souhlas_at,souhlas_text,souhlas_verze,stripe_session_id,test,zaplaceno_at,odpoved_at,odhlaseno_at,recovery_url,recovery_expires_at,odhlaseni_token,mail1_due_at,mail1_odeslan_at,mail1_dry_at,mail2_due_at,mail2_odeslan_at,mail2_dry_at",
  );
  q = aplikujFiltrSouhlasu(q);
  const filtr = filtryKroku(krok, dry);
  for (const col of filtr.jeNull) q = q.is(col, null);
  for (const col of filtr.neniNull) {
    q = q.not(col, "is", null);
    if (col === filtr.due) q = q.lte(col, tedIso);
  }
  const { data, error } = await q.limit(40);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({ ...(r as Kandidat), jmeno: null, krok }));
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method" }, 405);
  const brana = await overSecret(admin as never, req, { header: "x-drip-secret" });
  if (!brana.ok) return json(brana.body, brana.status);

  const flagy = await nactiKosikFlagy(admin, Deno.env.get("KOSIK_DRY_RUN"));
  const ted = new Date();
  const klic = mailKlic();
  try {
    const vysledek = await zpracujPripominku({
      ted,
      flagy,
      nactiKandidaty: async () => {
        const a = await nactiKrok(0, flagy.dryRun, ted.toISOString());
        const b = await nactiKrok(1, flagy.dryRun, ted.toISOString());
        return [...a, ...b];
      },
      kontext: async (r) => {
        const produkt = produktEntitlement(r.produkt_klic);
        const tedIso = ted.toISOString();
        const { data: ent, error: entErr } = await admin.from("entitlements").select("email,granted_at")
          .eq("email", r.email).eq("product", produkt ?? "").eq("active", true)
          .or("expires_at.is.null,expires_at.gt." + tedIso).limit(5);
        if (entErr) throw new Error(entErr.message);
        const aktivniEntitlement = (ent ?? []).some((e) => String(e.granted_at ?? "") > r.created_at);
        let aktivniKoucink = false;
        if (r.produkt_klic === "konzultace" || r.produkt_klic === "konzultace-vk") {
          const { data: k, error: kErr } = await admin.from("entitlements").select("email")
            .eq("email", r.email).eq("product", "coaching").eq("active", true)
            .or("expires_at.is.null,expires_at.gt." + tedIso).limit(1);
          if (kErr) throw new Error(kErr.message);
          aktivniKoucink = (k ?? []).length > 0;
        }
        const od30 = new Date(ted.getTime() - 30 * 24 * 3600 * 1000).toISOString();
        const { data: serie, error: sErr } = await admin.from("kosik_checkouty").select("mail1_odeslan_at")
          .eq("email", r.email).neq("id", r.id).not("mail1_odeslan_at", "is", null).gte("mail1_odeslan_at", od30).limit(1);
        if (sErr) throw new Error(sErr.message);
        const jinaSerie = serie && serie[0]?.mail1_odeslan_at ? new Date(serie[0].mail1_odeslan_at) : null;
        const den = castiPraha(ted);
        const odDne = prahaNaUtc(den.year, den.month, den.day, 0, 0, 0).toISOString();
        const { data: lead, error: leadErr } = await admin.from("leads").select("id")
          .ilike("email", escapeIlikeExact(r.email)).limit(1);
        let dostalMarketingDnes = false;
        if (leadErr) {
          dostalMarketingDnes = true;
        } else {
          const leadId = lead && lead[0]?.id ? String(lead[0].id) : null;
          const typy = ["sent", "odeslano", "px_odeslano"];
          const podleLeadu = leadId
            ? await admin.from("email_events").select("lead_id,type,detail")
              .eq("lead_id", leadId).in("type", typy).gte("created_at", odDne).limit(30)
            : { data: [], error: null };
          const podleEmailu = await admin.from("email_events").select("lead_id,type,detail")
            .eq("detail->>email", r.email).in("type", typy).gte("created_at", odDne).limit(30);
          if (podleLeadu.error || podleEmailu.error) {
            dostalMarketingDnes = true;
          } else {
            const vse = [...(podleLeadu.data ?? []), ...(podleEmailu.data ?? [])];
            dostalMarketingDnes = vse.some((e) => jeMarketingovaUdalost({
              type: e.type,
              lead_id: e.lead_id,
              detail: e.detail as { email?: string; track?: string } | null,
            }, r.email, leadId));
          }
        }
        const g = await guardSend(admin, {
          email: r.email,
          mailClass: "marketing",
          functionName: "kosik-pripominka",
          path: "kosik-pripominka",
        });
        return {
          aktivniEntitlement,
          aktivniKoucink,
          jinaSerie,
          dostalMarketingDnes,
          guardAkce: g.action,
          guardDuvod: g.reason,
        };
      },
      oznac: async (id, patch) => {
        const { error } = await admin.from("kosik_checkouty").update(patch).eq("id", id);
        return { ok: !error, chyba: error?.message };
      },
      zapisUdalost: async (detail) => {
        const { type, step, email, ...zbytek } = detail;
        await admin.from("email_events").insert({
          lead_id: null,
          step,
          type,
          provider_id: typeof zbytek.provider_id === "string" ? zbytek.provider_id : null,
          detail: { via: "kosik-pripominka", email, ...zbytek },
        });
      },
      posliMail: async (payload) => {
        let odpoved: VysledekMailu | null = null;
        const d = await sendIfAllowed(admin, {
          email: payload.to,
          mailClass: "marketing",
          functionName: "kosik-pripominka",
          path: "kosik-pripominka",
        }, async () => {
          const r = await odesliPresResend(klic, {
            from: ODESILATEL,
            to: payload.to,
            subject: payload.subject,
            html: payload.html,
            text: payload.text,
            reply_to: REPLY_TO,
            headers: payload.headers,
          });
          odpoved = { ok: r.ok, status: r.status, providerId: r.providerId, chyba: r.chyba };
        });
        if (d.action === "skip") {
          return { ok: false, status: 0, providerId: "", preskoceno: d.reason };
        }
        return odpoved ?? { ok: false, status: 0, providerId: "", chyba: "missing_mail" };
      },
      alert: async (predmet, text) => {
        if (!klic) return;
        await odesliPresResend(klic, {
          from: ODESILATEL,
          to: REPLY_TO,
          subject: predmet,
          text,
        });
      },
    });
    return json({ ok: true, ...vysledek });
  } catch (e) {
    console.error("[kosik-pripominka] beh selhal: " + String(e).slice(0, 200));
    return json({ error: "beh", detail: String(e).slice(0, 160) }, 500);
  }
});
