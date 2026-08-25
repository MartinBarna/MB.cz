// PODKLAD PRO REPO APPKY (tvuj-coach), soubor patri do `supabase/functions/aktivace-stav/index.ts`.
//
// ⛔⛔ TENHLE SOUBOR SE ODSUD NENASAZUJE. Lezi v repu MB.cz jen proto, aby cely mechanismus
//     byl na jednom miste ke cteni a revizi. Nasazuje se z repa appky, z produkcni vetve
//     (dnes `p41-nad-p28`), prikazem:
//        npx supabase functions deploy aktivace-stav --no-verify-jwt
//     ⚠️ `--no-verify-jwt` je nutne: vola to server (edge fn Academy), ne prihlaseny uzivatel.
//        Ochranu delá sdileny secret nize, ne JWT.
//
// CO TO DELA: dostane seznam adres, vrati tu jeho podmnozinu, ktera uz v appce zapsala
// jidlo (skutecne snedene, ne naplanovane). Nic nezapisuje.
//
// ⛔ SECRET SE NEZAKLADA NOVY. Pouziva se `ACADEMY_ONBOARDING_SECRET`, tedy tataz hodnota,
//    kterou uz appka pouziva opacnym smerem (`onboarding-bridge` -> `app-onboarding-hook`).
//    Promenne prostredi jsou v Supabase spolecne pro cely projekt, takze tahle funkce ji uz
//    ma k dispozici a nikdo nemusi zadnou hodnotu prenaset. Rotace secretu se tim ale nove
//    dotkne OBOU smeru; kdo ho bude menit, musi vedet o dvou mistech.
//
// ⛔ NEVRACI NIC NAVIC. Zadna jmena, data, pocty ani cokoli o obsahu deniku. Jen adresy,
//    ktere volajici sam poslal. Kdo nema ucet, v odpovedi proste neni.
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SECRET = Deno.env.get("ACADEMY_ONBOARDING_SECRET") ?? "";

// Tentyz strop jako v RPC. Drzi se na obou stranach schvalne: kdo obejde jednu, narazi na druhou.
const MAX_ADRES = 500;

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json" } });

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "method" }, 405);
  // ⛔ Chybejici secret = 500, ne "pusť to dál". Kdyby promenna zmizela, funkce musi
  //    prestat odpovidat, ne zacit odpovidat komukoli.
  if (!SECRET) return json({ error: "not_configured" }, 500);
  if (req.headers.get("x-app-secret") !== SECRET) return json({ error: "forbidden" }, 403);

  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const vstup = Array.isArray((body as { emaily?: unknown })?.emaily) ? (body as { emaily: unknown[] }).emaily : null;
  if (!vstup) return json({ error: "chybi_emaily" }, 400);

  const emaily = [...new Set(
    vstup.map((e) => String(e ?? "").trim().toLowerCase()).filter((e) => e.includes("@")),
  )];
  if (emaily.length === 0) return json({ ok: true, zapsali: [] });
  if (emaily.length > MAX_ADRES) return json({ error: "prilis_mnoho_adres", limit: MAX_ADRES }, 400);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
  const { data, error } = await admin.rpc("zapsali_jidlo", { p_emaily: emaily });
  // ⛔ Pri chybe se NEVRACI prazdny seznam s `ok: true`. Prazdny seznam znamena
  //    „nikdo z nich nezapsal" a volajici by podle nej zadrzel maily. Chyba musi byt
  //    poznat, aby si volajici nastavil stav `nevime` a poslal jako dosud.
  if (error) return json({ error: "rpc", detail: error.message }, 500);

  const zapsali = (data ?? []).map((r: { email: string }) => String(r.email ?? "").toLowerCase()).filter(Boolean);
  return json({ ok: true, zapsali, dotazu: emaily.length });
});
