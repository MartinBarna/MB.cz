// Sdilena znalostni tabulka firmy (firemni_poznatky).
// Jedno misto, kam zapisuje Martin, Claude i Elon, aby se poznatky netristily po chatech.
// Auth je stejna jako u admin-api: uzivatelsky JWT -> e-mail musi byt v app_config.admin_emails.
// ⛔ Zamerne SAMOSTATNA funkce, ne zasah do admin-api: admin-api ma 1163 radku a nesmi se rozbit.
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
const txt = (s: unknown) => String(s ?? "").trim();

const AUTORI = ["claude", "elon", "martin", "jiny"];
const OBLASTI = ["mailing", "klienti", "produkt", "ceny", "reklama", "web", "appka", "provoz", "jine"];
const DUVERY = ["zmereno", "hlaseni", "odhad"];
const STAVY = ["aktivni", "vyrizeno", "neplatne"];
const AKCE = ["martin", "claude", "elon", "nikdo"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method" }, 405);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

  // ---- overeni admina (shodne s admin-api) --------------------------------
  const authHeader = req.headers.get("Authorization") || "";
  const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
  const { data: ures } = await userClient.auth.getUser();
  const me = low(ures?.user?.email);
  const cfg = await admin.from("app_config").select("value").eq("key", "admin_emails").maybeSingle();
  const adminList = String(cfg.data?.value || "fitness.barna@gmail.com").split(",").map((s) => low(s)).filter(Boolean);
  if (!me || !adminList.includes(me)) return json({ error: "forbidden" }, 403);

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const action = txt(body.action);

  try {
    // ---- vypis ------------------------------------------------------------
    if (action === "list") {
      let q = admin.from("firemni_poznatky")
        .select("id,vytvoreno,aktualizovano,autor,oblast,nadpis,text,cislo,zmereno_kdy,zdroj,duvera,stav,akce_pro")
        .order("vytvoreno", { ascending: false })
        .limit(500);
      const oblast = txt(body.oblast);
      const stav = txt(body.stav);
      const autor = txt(body.autor);
      if (oblast && OBLASTI.includes(oblast)) q = q.eq("oblast", oblast);
      if (stav && STAVY.includes(stav)) q = q.eq("stav", stav);
      if (autor && AUTORI.includes(autor)) q = q.eq("autor", autor);
      const { data, error } = await q;
      if (error) return json({ error: error.message }, 500);

      const rows = data ?? [];
      const souhrn = {
        celkem: rows.length,
        aktivni: rows.filter((r) => r.stav === "aktivni").length,
        pro_martina: rows.filter((r) => r.stav === "aktivni" && r.akce_pro === "martin").length,
        jen_odhady: rows.filter((r) => r.duvera !== "zmereno").length,
      };
      return json({ ok: true, souhrn, rows });
    }

    // ---- pridani ----------------------------------------------------------
    if (action === "add") {
      const zaznam = {
        autor: AUTORI.includes(low(body.autor)) ? low(body.autor) : "martin",
        oblast: OBLASTI.includes(low(body.oblast)) ? low(body.oblast) : "jine",
        nadpis: txt(body.nadpis),
        text: txt(body.text),
        cislo: txt(body.cislo) || null,
        zmereno_kdy: txt(body.zmereno_kdy) || null,
        zdroj: txt(body.zdroj) || null,
        duvera: DUVERY.includes(low(body.duvera)) ? low(body.duvera) : "odhad",
        akce_pro: AKCE.includes(low(body.akce_pro)) ? low(body.akce_pro) : null,
      };
      if (zaznam.nadpis.length < 3) return json({ error: "nadpis je moc kratky" }, 400);
      if (zaznam.text.length < 10) return json({ error: "text je moc kratky" }, 400);
      // ⚠️ Duvera "zmereno" znamena, ze to nekdo opravdu zmeril. Kdyz chybi zdroj,
      // shodime to na "hlaseni", at se odhad nevydava za mereni.
      if (zaznam.duvera === "zmereno" && !zaznam.zdroj) zaznam.duvera = "hlaseni";

      const { data, error } = await admin.from("firemni_poznatky").insert(zaznam).select("id").single();
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true, id: data?.id });
    }

    // ---- zmena stavu nebo textu -------------------------------------------
    if (action === "update") {
      const id = txt(body.id);
      if (!id) return json({ error: "chybi id" }, 400);
      const zmeny: Record<string, unknown> = {};
      if (STAVY.includes(low(body.stav))) zmeny.stav = low(body.stav);
      if (txt(body.text).length >= 10) zmeny.text = txt(body.text);
      if (txt(body.nadpis).length >= 3) zmeny.nadpis = txt(body.nadpis);
      if (AKCE.includes(low(body.akce_pro))) zmeny.akce_pro = low(body.akce_pro);
      if (!Object.keys(zmeny).length) return json({ error: "nic ke zmene" }, 400);

      const { error } = await admin.from("firemni_poznatky").update(zmeny).eq("id", id);
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true });
    }

    return json({ error: "neznama akce" }, 400);
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
