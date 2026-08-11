// ============================================================
// LINK-CHECK: denní kontrola, že odkazy v mailech a na klíčových stránkách ŽIJÍ.
//
// ⛔ PROČ TO EXISTUJE. Od 22. do 27. 7. 2026 vracela tracking doména Resendu 400
// na VŠECHNY odkazy ve VŠECH mailech. Pět dní. Nepoznalo se to, protože se sledovalo
// DORUČENÍ mailu a klikací události se dál logovaly, takže všechna čísla vypadala
// normálně. Stálo to měsíc mailingu.
// ⇒ Tahle funkce měří PRŮCHOD odkazu, ne doručení mailu. Kanárek, ne statistika.
//
// Deploy: --no-verify-jwt (autentizace vlastním secretem, stejně jako drip-send).
// Spouští: pg_cron 1× denně. Ručně: POST s hlavičkou x-linkcheck-secret.
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY
// ============================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const ALERT_FALLBACK = "fitness.barna@gmail.com";

// Klíčové stránky, které v šablonách být nemusí, ale jejich pád je stejně drahý.
// Platební odkazy jsou tu ZÁMĚRNĚ: mrtvý odkaz na pokladnu je nejdražší ze všech.
// ⚠️ GET na Payment Link je jen načtení stránky, žádnou platbu nezaloží.
const KLICOVE_STRANKY = [
  "https://martinbarna.cz/",
  "https://martinbarna.cz/akademie/",
  "https://martinbarna.cz/akademie/objednavka/",
  "https://martinbarna.cz/akademie/vitejte/",
  "https://martinbarna.cz/akademie/studium/",
  "https://martinbarna.cz/akademie/prihlaseni/",
  "https://martinbarna.cz/pro-vas/",
  "https://martinbarna.cz/pro-trenery/",
  "https://martinbarna.cz/tvuj-coach/",
  "https://martinbarna.cz/obchodni-podminky/",
  "https://martinbarna.cz/zasady-ochrany-osobnich-udaju/",
  "https://tvujcoach.cz/",
  // ⚠️ Platební odkazy patří sem RUČNĚ. V `email_templates` zatím NEJSOU (šablony
  // jsou starší než nový ceník), takže by je automatický výtah z šablon minul.
  // Přitom mrtvá pokladna je ta nejdražší porucha ze všech. Když se ceník změní,
  // aktualizuj i tenhle seznam. Checklist: `tvujcoach-cenik-zmena-checklist`.
  "https://buy.stripe.com/bJe9AS3UXgjMcjC8hF3ks00",     // Academy 990 Kč/měs
  "https://form.simpleshop.cz/Xgl8g/buy/",              // Academy 8 900 doživotně (STARÁ cesta, doběh)
  // ⛔ Od 29. 7. 2026 vede doživotní Academy sem. Kdyby tenhle odkaz umřel, přestane
  // se prodávat nejdražší produkt a nikde jinde to nekřikne. Hlídač na to je právě.
  "https://buy.stripe.com/4gM00ibnpgjMerK7dB3ks04",     // Academy 8 900 doživotně (Stripe)
];
// ✅ DETEKTOR OVĚŘEN 28. 7. 2026 KANÁRKEM, ne jen přečtením kódu.
// Do seznamu se dočasně přidala schválně neexistující adresa
// `martinbarna.cz/tahle-stranka-neexistuje-kanarek/`. Výsledek: HTTP 404, ok=false,
// a odešel alert „1 z 78 odkazů NEFUNGUJE". Celý řetěz detekce → zápis → poplach
// tedy prokazatelně funguje. Kanárek byl hned potom odstraněn, jinak by alert
// chodil každý den a člověk by si na něj zvykl.
// ⚠️ Kdo sem bude sahat, ať si ten test zopakuje. Nula chyb může znamenat
// „vše v pořádku" i „detektor je slepý", a rozdíl pozná jen kanárek.

const TIMEOUT_MS = 15000;
const SOUBEZNE = 6;          // ať nezahltíme Wedos ani sebe
const MAX_URL = 200;         // pojistka proti splašené šabloně

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

type Vysledek = { url: string; kde: string; http_status: number | null; ok: boolean; poznamka: string | null };

function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json" } });
}

async function alertAdmin(predmet: string, detail: Record<string, unknown>) {
  try {
    await admin.from("email_events").insert({
      lead_id: null, step: 0, type: "error",
      detail: { track: "link-check", error: predmet + " " + JSON.stringify(detail).slice(0, 300) },
    });
  } catch { /* best-effort */ }
  if (!RESEND_KEY) return;
  try {
    let to = ALERT_FALLBACK;
    const { data } = await admin.from("app_config").select("value").eq("key", "admin_emails").maybeSingle();
    if (data?.value) to = String(data.value).split(",")[0].trim() || ALERT_FALLBACK;
    const rows = Object.entries(detail).map(([k, v]) => `<li><b>${k}</b>: ${String(v)}</li>`).join("");
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: "Bearer " + RESEND_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Barna Academy <news@martinbarna.cz>", to: [to],
        subject: "🔴 " + predmet,
        html: `<p>Denní kontrola odkazů našla problém. Tohle je přesně ten případ, `
          + `kvůli kterému 22. až 27. 7. pět dní nefungovaly odkazy ve všech mailech.</p>`
          + `<ul>${rows}</ul><p>Zkontroluj to, než odejde další vlna mailů.</p>`,
      }),
    });
  } catch { /* best-effort */ }
}

// Vytáhne URL ze šablon. Regex schválně nebere uvozovky, závorky a lomené závorky.
function urlyZeSablon(blob: string): string[] {
  const nalezene = blob.match(/https?:\/\/[^"'\\ )<>\]}]+/g) ?? [];
  const cisté = nalezene
    .map((u) => u.replace(/[.,;:]+$/, ""))          // uřízni interpunkci na konci
    .filter((u) => !u.includes("{{"))                // ⚠️ odkazy s merge proměnnou
    .filter((u) => !u.includes("unsubscribe_token")) //    nejdou ověřit naslepo
    .filter((u) => !/\.(png|jpg|jpeg|gif|svg|webp)$/i.test(u)); // obrázky neřešíme
  return [...new Set(cisté)];
}

// Jedno ověření. Následuje přesměrování, hlídá i „soft 404" (200, ale stránka je chybová).
async function zkontroluj(url: string, kde: string): Promise<Vysledek> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    // GET, ne HEAD: statické hostingy i Stripe na HEAD občas vrací 405 a vyrobily by
    // falešný poplach. GET je dražší, ale 72 odkazů denně je zanedbatelné.
    // ⚠️ HLAVIČKY PROHLÍŽEČE JSOU NOSNÉ, ne kosmetika. 11. 8. 2026 začal Wedos vracet
    //    401 na KAŽDÝ request bez browser User-Agent (holý Deno fetch) a kontrola
    //    ohlásila „69 z 110 rozbitých", zatímco web lidem normálně jel. Falešný poplach
    //    učí adresáta mail ignorovat, což je horší než ticho. Marker LinkCheck na konci
    //    UA zůstává schválně: v logách Wedosu je poznat, že jsme to my, a WAF projde.
    const r = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: ctrl.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 LinkCheck-MartinBarna",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "cs-CZ,cs;q=0.9",
      },
    });
    const telo = (await r.text().catch(() => "")).slice(0, 4000);

    if (!r.ok) return { url, kde, http_status: r.status, ok: false, poznamka: "HTTP " + r.status };

    // Soft 404: server řekne 200, ale obsah je chybová stránka. Tohle by samotný
    // stavový kód nechytil a je to přesně ten tichý případ, kvůli kterému to stavíme.
    const t2 = telo.toLowerCase();
    const podezrele = /stránka nenalezena|nenalezeno|page not found|404 not found|<title>404/.test(t2);
    if (podezrele) return { url, kde, http_status: r.status, ok: false, poznamka: "soft-404 (200, ale chybová stránka)" };
    if (telo.trim().length < 200) {
      return { url, kde, http_status: r.status, ok: false, poznamka: "podezřele prázdná odpověď (<200 B)" };
    }
    return { url, kde, http_status: r.status, ok: true, poznamka: null };
  } catch (e) {
    const zprava = String(e);
    return {
      url, kde, http_status: null, ok: false,
      poznamka: zprava.includes("abort") ? `timeout > ${TIMEOUT_MS / 1000} s` : zprava.slice(0, 120),
    };
  } finally {
    clearTimeout(t);
  }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method" }, 405);

  // Autentizace vlastním secretem (vzor drip-send), ať to nejde spouštět zvenčí.
  const { data: cfg } = await admin.from("app_config").select("value").eq("key", "linkcheck_secret").maybeSingle();
  const ocekavano = cfg?.value ? String(cfg.value) : "";
  const dodano = req.headers.get("x-linkcheck-secret") ?? "";
  if (!ocekavano || dodano !== ocekavano) return json({ error: "unauthorized" }, 401);

  const runAt = new Date().toISOString();

  // 1) URL ze šablon
  const { data: sablony, error: chybaSablon } = await admin.from("email_templates").select("blocks");
  if (chybaSablon) {
    await alertAdmin("Link-check: nepodařilo se načíst šablony", { chyba: chybaSablon.message });
    return json({ error: "db", detail: chybaSablon.message }, 500);
  }
  const zeSablon = urlyZeSablon((sablony ?? []).map((s) => JSON.stringify(s.blocks)).join(" "));

  // 2) + klíčové stránky, bez duplicit
  const vse: { url: string; kde: string }[] = [];
  const videno = new Set<string>();
  for (const u of KLICOVE_STRANKY) { if (!videno.has(u)) { videno.add(u); vse.push({ url: u, kde: "stranka" }); } }
  for (const u of zeSablon)        { if (!videno.has(u)) { videno.add(u); vse.push({ url: u, kde: "sablona" }); } }

  if (vse.length > MAX_URL) {
    await alertAdmin("Link-check: podezřele moc odkazů, kontrola zkrácena", { nalezeno: vse.length, strop: MAX_URL });
    vse.length = MAX_URL;
  }

  // 3) kontrola po dávkách
  const vysledky: Vysledek[] = [];
  for (let i = 0; i < vse.length; i += SOUBEZNE) {
    const davka = vse.slice(i, i + SOUBEZNE);
    vysledky.push(...await Promise.all(davka.map((v) => zkontroluj(v.url, v.kde))));
  }

  // 4) zápis
  const radky = vysledky.map((v) => ({ ...v, run_at: runAt }));
  const { error: chybaZapisu } = await admin.from("link_check").insert(radky);
  if (chybaZapisu) await alertAdmin("Link-check: výsledky se nepodařilo uložit", { chyba: chybaZapisu.message });

  // 5) alert, jen když je co hlásit
  const rozbite = vysledky.filter((v) => !v.ok);
  if (rozbite.length) {
    await alertAdmin(`Link-check: ${rozbite.length} z ${vysledky.length} odkazů NEFUNGUJE`, {
      rozbite: rozbite.slice(0, 12).map((v) => `${v.url} → ${v.poznamka}`).join(" | "),
      celkem_kontrolovano: vysledky.length,
    });
  }

  try { await admin.rpc("link_check_uklid"); } catch { /* úklid historie je best-effort */ }

  return json({
    ok: true,
    run_at: runAt,
    kontrolovano: vysledky.length,
    rozbitych: rozbite.length,
    preskoceno_s_promennou: "odkazy s {{ }} a unsubscribe tokenem se neověřují",
    rozbite: rozbite.map((v) => ({ url: v.url, status: v.http_status, poznamka: v.poznamka })),
  });
});
