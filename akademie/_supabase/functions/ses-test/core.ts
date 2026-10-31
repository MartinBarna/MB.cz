// ses-test: jednorázový testovací mail přes větev SES.
//
// NENASAZOVAT v tomhle kole. Až se bude nasazovat, volání schvaluje Claude
// (Tým 2). Auth je stejný vzor jako admin-api / admin-pulse: POST, hlavička
// Authorization s JWT uživatele, e-mail musí být v app_config.admin_emails.
//
// Odeslání jde vždy přes větev SES v posliMail, i když MAIL_PROVIDER je prázdné
// nebo resend. Přepnutí env je jen na dobu toho jednoho volání a hned se vrátí.
// Nová abstrakce nad poštu tu není: volá se stávající posliMail.
// Po úspěchu se zapíše email_events type=test s provider_id = MessageId a
// detail.test=true, aby ses-events bounce simulatoru spároval.

import { posliMail, type MailOdpoved } from "../_shared/mail-provider.ts";

export const SES_TEST_PRIJEMCI = [
  "success@simulator.amazonses.com",
  "bounce@simulator.amazonses.com",
  "complaint@simulator.amazonses.com",
  "fitness.barna+tester@gmail.com",
] as const;

const PRIJEMCI = new Set<string>(SES_TEST_PRIJEMCI);
const FROM = "Martin Barna <news@martinbarna.cz>";
const VYCHOZI_ADMIN = ["fitness.barna@gmail.com"];

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export type StopaTestu = {
  lead_id: null;
  step: 0;
  type: "test";
  provider_id: string;
  detail: { test: true; via: "ses-test"; email: string };
};

export type SesTestDeps = {
  emailAdmina: (authHeader: string) => Promise<string | null>;
  adminEmaily: () => Promise<string[]>;
  zapisStopu: (radek: StopaTestu) => Promise<{ ok: boolean }>;
  fetchImpl?: typeof fetch;
};

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const low = (s: unknown) => String(s ?? "").trim().toLowerCase();

/** Předmět vždy začíná TEST. Řídicí znaky z těla požadavku se do předmětu nedostanou. */
export function predmetTestu(vstup: unknown): string {
  const cisty = String(vstup ?? "").replace(/[\r\n]/g, " ").trim().slice(0, 160);
  const zaklad = cisty || "TEST SES";
  return zaklad.startsWith("TEST") ? zaklad : "TEST " + zaklad;
}

function prijemceZTela(to: unknown): string | null {
  const jeden = Array.isArray(to) ? (to.length === 1 ? to[0] : null) : to;
  if (jeden == null || Array.isArray(jeden)) return null;
  const s = low(jeden);
  if (!s || s.includes(",") || s.includes(" ") || s.includes(";")) return null;
  return s;
}

async function seznamAdminu(deps: SesTestDeps): Promise<string[]> {
  let raw: string[] = [];
  try {
    raw = await deps.adminEmaily();
  } catch {
    return [];
  }
  const list = (raw ?? []).map((s) => low(s)).filter(Boolean);
  return list.length ? list : VYCHOZI_ADMIN.slice();
}

async function jeAdmin(req: Request, deps: SesTestDeps): Promise<boolean> {
  let email = "";
  try {
    email = low(await deps.emailAdmina(req.headers.get("Authorization") || ""));
  } catch {
    return false;
  }
  if (!email) return false;
  const list = await seznamAdminu(deps);
  return list.includes(email);
}

function vratProvider(pred: string | undefined): void {
  if (pred === undefined) Deno.env.delete("MAIL_PROVIDER");
  else Deno.env.set("MAIL_PROVIDER", pred);
}

async function posliVzdySes(
  payload: { from: string; to: string[]; subject: string; text: string; html: string },
  fetchImpl: typeof fetch | undefined,
): Promise<MailOdpoved> {
  const pred = Deno.env.get("MAIL_PROVIDER");
  Deno.env.set("MAIL_PROVIDER", "ses");
  try {
    return await posliMail(payload, fetchImpl ? { fetch: fetchImpl } : undefined);
  } finally {
    vratProvider(pred);
  }
}

export async function handleSesTest(req: Request, deps: SesTestDeps): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  if (!(await jeAdmin(req, deps))) return json({ error: "forbidden" }, 403);

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const to = prijemceZTela(body.to);
  if (!to || !PRIJEMCI.has(to)) return json({ error: "prijemce" }, 403);

  const subject = predmetTestu(body.subject);
  let odpoved: MailOdpoved;
  try {
    odpoved = await posliVzdySes({
      from: FROM,
      to: [to],
      subject,
      text: "Testovaci zprava SES. Tohle neni rozesilka.",
      html: "<p>Testovaci zprava SES. Tohle neni rozesilka.</p>",
    }, deps.fetchImpl);
  } catch (e) {
    console.error("[ses-test] odeslani selhalo: " + String(e).slice(0, 180));
    return json({ ok: false, error: "ses" }, 502);
  }

  if (!odpoved.ok || !odpoved.providerId) {
    return json({ ok: false, error: "ses", status: odpoved.status }, 502);
  }

  const radek: StopaTestu = {
    lead_id: null,
    step: 0,
    type: "test",
    provider_id: odpoved.providerId,
    detail: { test: true, via: "ses-test", email: to },
  };
  let zapsano = false;
  try {
    zapsano = (await deps.zapisStopu(radek)).ok;
  } catch (e) {
    console.error("[ses-test] zapis stopy spadl: " + String(e).slice(0, 180));
    zapsano = false;
  }
  if (!zapsano) return json({ ok: false, error: "stopa", provider_id: odpoved.providerId }, 502);
  return json({ ok: true, provider_id: odpoved.providerId, to, subject });
}
