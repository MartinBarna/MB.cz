// ============================================================
// LINK-CHECK: denní kontrola, že odkazy v mailech a na klíčových stránkách ŽIJÍ.
//
// ⛔ PROČ TO EXISTUJE. Od 22. do 27. 7. 2026 vracela tracking doména Resendu 400
// na VŠECHNY odkazy ve VŠECH mailech. Pět dní. Nepoznalo se to, protože se sledovalo
// DORUČENÍ mailu a klikací události se dál logovaly, takže všechna čísla vypadala
// normálně. Stálo to měsíc mailingu.
// ⇒ Tahle funkce měří PRŮCHOD odkazu, ne doručení mailu. Kanárek, ne statistika.
//
// ⛔⛔ 11. až 13. 8. 2026 tenhle kanárek TŘI DNY LHAL: hlásil „69 z 111 odkazů
// NEFUNGUJE" (všechny martinbarna.cz, HTTP 401), zatímco web lidem normálně jel.
// První diagnóza zněla „chybí browser User-Agent" a byla ŠPATNĚ; UA se doplnil
// 11. 8. (v14) a nezměnilo to vůbec NIC. Změřeno 13. 8. sondou přímo z edge
// prostředí (funkce `sef-probe-ua`, po měření zrušená):
//   - požadavek na martinbarna.cz projde i ÚPLNĚ BEZ hlaviček (HTTP 200), takže
//     User-Agent s tím nemá co dělat,
//   - osm spuštění za sebou: pokaždé JINÁ odchozí IP (AWS eu-central-1) a stav
//     kopíruje IP, ne hlavičky: 3.123.189.42→401, 52.59.212.129→200,
//     54.93.239.162→401, 63.179.252.166→200 … zhruba tři čtvrtiny IP odmítnuty.
// ⇒ SKUTEČNÁ PŘÍČINA: ochrana webu (WEDOS Global Protection) nedůvěřuje IP adresám
// datacentra a místo stránky vrací HTTP 401 s ověřovací stránkou „Security
// verification", kterou prohlížeč proklikne JavaScriptem a holý fetch nikdy.
// ⛔ Jedno spuštění funkce = JEDNA odchozí IP, takže se buď povede všech 66 odkazů
// martinbarna.cz, nebo ani jeden. Odsud to podezřele kulaté „69 z 111" každý den.
// ⇒ Tohle se z naší strany OPRAVIT NEDÁ, jen poctivě přiznat: ověřovací výzva se
// od 13. 8. hlásí jako „nepodařilo se ověřit", ne jako „odkaz nefunguje".
// ⇒ Opravdová oprava je na straně WEDOSu (povolit naše IP nebo zmírnit ochranu).
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

// ⛔ ODSTAVENÉ POKLADNY. Adresa se z kontroly NEMAŽE (kdyby ji někdo někam vrátil,
// ať to křikne), ale její mrtvý produkt je OČEKÁVANÝ stav, ne porucha. Bez tohohle
// rozlišení by detektor `jeMrtvyProdukt()` níž posílal poplach každý den a člověk
// by si na něj zvykl. Falešný poplach je horší než ticho, viz komentář u alertu.
const ODSTAVENE_POKLADNY = new Set<string>([
  "https://form.simpleshop.cz/Xgl8g/buy/",   // Academy 8 900 doživotně, od 29. 7. 2026 nahrazeno Stripe
]);

// ⛔⛔ ODKAZY SCHOVANÉ ZA MERGE TOKENEM. Tohle je díra, kvůli které tenhle hlídač
// hlásil zeleně, zatímco maily vodily lidi na zrušenou pokladnu SimpleShopu.
// `urlyZeSablon()` čte jen adresy napsané v šabloně NATVRDO. Token `{{course_url}}`
// se dosazuje až v odesílateli (konstanta `COURSE_URL` v edge funkci `drip-send`),
// takže v šabloně žádná adresa není a hlídač o ní nevěděl. Změřeno 22. 8. 2026:
// v tabulce `link_check` se `form.simpleshop.cz/3Vbl` nevyskytuje ANI JEDNOU.
// ⇒ Kdo přidá do šablon nový token s adresou, přidá ho SEM.
// ⭐ Kontroluje se jen token, který v nějaké šabloně opravdu je, takže až token
//    ze šablon zmizí, tenhle seznam sám ztichne a nedělá falešný poplach.
const TOKENY_S_ADRESOU_V_KODU: Record<string, string> = {
  course_url: "https://form.simpleshop.cz/3Vbl/buy/",   // drip-send v62, konstanta COURSE_URL
};
// ✅ DETEKTOR OVĚŘEN 28. 7. 2026 KANÁRKEM, ne jen přečtením kódu.
// Do seznamu se dočasně přidala schválně neexistující adresa
// `martinbarna.cz/tahle-stranka-neexistuje-kanarek/`. Výsledek: HTTP 404, ok=false,
// a odešel alert „1 z 78 odkazů NEFUNGUJE". Celý řetěz detekce → zápis → poplach
// tedy prokazatelně funguje. Kanárek byl hned potom odstraněn, jinak by alert
// chodil každý den a člověk by si na něj zvykl.
// ⚠️ Kdo sem bude sahat, ať si ten test zopakuje. Nula chyb může znamenat
// „vše v pořádku" i „detektor je slepý", a rozdíl pozná jen kanárek.

const TIMEOUT_MS = 15000;
const PAUZA_MS = 400;        // pauza mezi dvěma požadavky na TÝŽ host
const HOSTU_SOUBEZNE = 6;    // různé hosty smí běžet souběžně, týž host NIKDY
const RETRY_MS = 8000;       // druhá šance, když ochrana webu vrátí ověřovací výzvu
const MAX_URL = 200;         // pojistka proti splašené šabloně

// ⛔ JEDINÉ MÍSTO, kde se definují hlavičky odchozího požadavku. Každý odchozí
// požadavek na kontrolovaný odkaz jde přes `jedenPokus()` a bere je odsud, takže
// nemůže vzniknout cesta, která by je zapomněla přiložit.
const PROHLIZEC_HLAVICKY: Record<string, string> = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 LinkCheck-MartinBarna",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "cs-CZ,cs;q=0.9",
};

const pauza = (ms: number) => new Promise((r) => setTimeout(r, ms));

function hostZ(url: string): string {
  try { return new URL(url).hostname; } catch { return "?"; }
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

// Vysledek = přesně sloupce tabulky `link_check`. Nic navíc se do insertu nesmí dostat.
type Vysledek = { url: string; kde: string; http_status: number | null; ok: boolean; poznamka: string | null };
// Mereni = Vysledek + interní příznak, který do DB NEJDE (viz sestavení `radky`).
type Mereni = Vysledek & { blokovano: boolean };
// Stav jednoho běhu: které hosty nás zablokovaly a u kterých už se čekalo na druhou šanci.
type Stav = { blokovane: Set<string>; druhaSanceVycerpana: Set<string> };

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

// ⚠️ UKLÁDEJ TĚLO CHYBOVÉ ODPOVĚDI, NE JEN ČÍSLO. Do 13. 8. 2026 se ukládalo jen
// „HTTP 401" a tři dny se kvůli tomu hádalo, jestli je vinen User-Agent, ASN nebo web.
// Odpověď byla celou dobu v těle: ověřovací stránka ochrany webu. Od teď se do
// `poznamka` vždycky ukládá i útržek těla a hlavičky, které pojmenují viníka.
function diagnostika(r: Response, telo: string): string {
  const h = (n: string) => r.headers.get(n) ?? "-";
  return `server=${h("server")} | x-protected-by=${h("x-protected-by")} | www-authenticate=${h("www-authenticate")}`
    + ` | telo: ${telo.replace(/\s+/g, " ").trim().slice(0, 300)}`;
}

// Ochrana webu (WEDOS Global Protection) neodpoví „stránka neexistuje", ale pošle
// HTTP 401 s ověřovací stránkou „Security verification". Prohlížeč ji proklikne
// JavaScriptem, holý fetch nikdy. ⛔ TOHLE NENÍ ROZBITÝ ODKAZ, je to „nezměřeno".
// Pozor: hlavička `x-protected-by` je i na ÚSPĚŠNÝCH odpovědích, takže sama o sobě
// nic neznamená; rozhoduje až v kombinaci s neúspěšným stavovým kódem.
function jeVyzvaOchrany(r: Response, telo: string): boolean {
  if (r.ok) return false;
  const chranenoKym = (r.headers.get("x-protected-by") ?? "").toLowerCase();
  return chranenoKym.includes("wedos") || /wedos\.protection|security verification/i.test(telo);
}

// ⛔ MRTVÁ POKLADNA VRACÍ HTTP 200. Změřeno 22. 8. 2026: `form.simpleshop.cz/Xgl8g/buy/`
// odpoví 200 a 1787 B s titulkem „Produkt se již neprodává.“. Stavový kód to nechytí,
// vzor soft-404 taky ne (nejsou tam slova o nenalezené stránce) a strop 200 B už vůbec.
// ⇒ Hlídač tu adresu deset dní po sobě zapsal jako `ok=true, poznamka=null`, doloženo
//   v tabulce `link_check`. Věta výš „mrtvá pokladna je nejdražší porucha ze všech“
//   byla do 22. 8. 2026 jen komentář, kód ji poznat neuměl.
// ⚠️ Vzory pro Stripe jsou odhad podle jeho chybových stránek, NEOVĚŘENÉ mrtvým
//   Stripe odkazem (žádný takový k dispozici nebyl). SimpleShop vzor ověřen měřením.
function jeMrtvyProdukt(telo: string): boolean {
  return /produkt se ji[žz] neprod[áa]v[áa]|produkt nebyl nalezen|formul[áa][řr] ji[žz] nen[íi] aktivn[íi]|no longer active|no longer accepting payments|this link is inactive/i
    .test(telo);
}

// Jeden odchozí požadavek. Následuje přesměrování, hlídá i „soft 404" (200, ale
// stránka je chybová). Hlavičky prohlížeče bere z PROHLIZEC_HLAVICKY, jinde se
// odchozí požadavek na kontrolovaný odkaz nedělá.
async function jedenPokus(url: string, kde: string): Promise<Mereni> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    // GET, ne HEAD: statické hostingy i Stripe na HEAD občas vrací 405 a vyrobily by
    // falešný poplach. GET je dražší, ale 111 odkazů denně je zanedbatelné.
    const r = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: ctrl.signal,
      headers: PROHLIZEC_HLAVICKY,
    });
    const telo = (await r.text().catch(() => "")).slice(0, 4000);

    if (jeVyzvaOchrany(r, telo)) {
      return {
        url, kde, http_status: r.status, ok: false, blokovano: true,
        poznamka: `NELZE OVĚŘIT: ochrana webu vrátila ověřovací stránku, ne obsah. HTTP ${r.status} | ${diagnostika(r, telo)}`,
      };
    }
    if (!r.ok) return { url, kde, http_status: r.status, ok: false, blokovano: false, poznamka: `HTTP ${r.status} | ${diagnostika(r, telo)}` };

    // Mrtvý produkt: pokladna odpoví 200 a normální stránkou, jen na ní stojí, že se
    // produkt už neprodává. Musí se testovat PŘED soft-404, protože žádné z jeho slov
    // neobsahuje a jinak by propadl jako zdravý odkaz.
    if (jeMrtvyProdukt(telo)) {
      if (ODSTAVENE_POKLADNY.has(url)) {
        return {
          url, kde, http_status: r.status, ok: true, blokovano: false,
          poznamka: "odstavená pokladna: mrtvý produkt je tu OČEKÁVANÝ stav, viz ODSTAVENE_POKLADNY",
        };
      }
      return {
        url, kde, http_status: r.status, ok: false, blokovano: false,
        poznamka: `MRTVÁ POKLADNA: HTTP ${r.status}, ale prodejce na stránce hlásí, že produkt se už neprodává | ${diagnostika(r, telo)}`,
      };
    }

    // Soft 404: server řekne 200, ale obsah je chybová stránka. Tohle by samotný
    // stavový kód nechytil a je to přesně ten tichý případ, kvůli kterému to stavíme.
    const t2 = telo.toLowerCase();
    const podezrele = /stránka nenalezena|nenalezeno|page not found|404 not found|<title>404/.test(t2);
    if (podezrele) return { url, kde, http_status: r.status, ok: false, blokovano: false, poznamka: `soft-404 (200, ale chybová stránka) | ${diagnostika(r, telo)}` };
    if (telo.trim().length < 200) {
      return { url, kde, http_status: r.status, ok: false, blokovano: false, poznamka: `podezřele prázdná odpověď (<200 B) | ${diagnostika(r, telo)}` };
    }
    return { url, kde, http_status: r.status, ok: true, blokovano: false, poznamka: null };
  } catch (e) {
    const zprava = String(e);
    return {
      url, kde, http_status: null, ok: false, blokovano: false,
      poznamka: zprava.includes("abort") ? `timeout > ${TIMEOUT_MS / 1000} s` : zprava.slice(0, 200),
    };
  } finally {
    clearTimeout(t);
  }
}

// Jedno ověření včetně druhé šance. Když ochrana webu vrátí výzvu, počká se a zkusí
// znovu; teprve druhé odmítnutí znamená, že je zablokovaná celá naše IP, ne ten odkaz.
// ⛔ Po zablokování se na týž host UŽ NEPOSÍLÁ NIC: měřeno 13. 8. 2026, blokace přežije
// i pauzu a další požadavky by ji jen prodlužovaly. Zbytek odkazů se rovnou označí
// za neověřené (`ok=false`, ale `blokovano`), aby se nic netvářilo jako zkontrolované.
async function zkontroluj(url: string, kde: string, stav: Stav): Promise<Mereni> {
  const host = hostZ(url);
  if (stav.blokovane.has(host)) {
    return {
      url, kde, http_status: null, ok: false, blokovano: true,
      poznamka: `NELZE OVĚŘIT: ochrana webu ${host} předtím zablokovala naši IP, další požadavky by blokaci jen prodlužovaly`,
    };
  }
  let v = await jedenPokus(url, kde);
  if (v.blokovano) {
    // ⚠️ Druhá šance jen JEDNOU ZA HOST A BĚH. Kdyby se čekalo u každého odkazu,
    // 66 odkazů × RETRY_MS by přerostlo časový limit funkce a neuložilo by se NIC.
    // ⚠️ A nečekej od ní zázrak: celý běh jede z JEDNÉ odchozí IP, takže když ji
    // ochrana odmítá, odmítne i opakování. Je to levná pojistka na přechodný stav,
    // ne řešení. Řešení je povolit naše IP na straně WEDOSu.
    if (stav.druhaSanceVycerpana.has(host)) {
      stav.blokovane.add(host);
      return v;
    }
    stav.druhaSanceVycerpana.add(host);
    await pauza(RETRY_MS);
    v = await jedenPokus(url, kde);
    if (v.blokovano) stav.blokovane.add(host);
  }
  return v;
}

// Odkazy se kontrolují po hostech: různé weby souběžně, TÝŽ WEB VŽDY PO JEDNOM
// a s pauzou. Do 13. 8. 2026 tu bylo 6 souběžných požadavků bez pauzy.
// ⚠️ Tohle NENÍ oprava falešných 401 (ty jsou z nedůvěry ochrany k IP datacentra,
// viz hlavička souboru). Je to pojistka na druhý, MĚŘITELNÝ jev: 13. 8. odpovídala
// čerstvá IP čtyřikrát v řadě 200, po náletu 24 požadavků po šesti začala vracet
// 401 i na osamocený požadavek. ⇒ Náletem si umíme pokazit i IP, která by prošla.
async function projdiHost(polozky: { url: string; kde: string }[], stav: Stav): Promise<Mereni[]> {
  const out: Mereni[] = [];
  for (const p of polozky) {
    const uzBlokovano = stav.blokovane.has(hostZ(p.url));
    out.push(await zkontroluj(p.url, p.kde, stav));
    if (!uzBlokovano) await pauza(PAUZA_MS);   // u zkratky se nečeká, není na co
  }
  return out;
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
  const blobSablon = (sablony ?? []).map((s) => JSON.stringify(s.blocks)).join(" ");
  const zeSablon = urlyZeSablon(blobSablon);

  // 1b) adresy schované za merge tokenem (viz TOKENY_S_ADRESOU_V_KODU). Berou se jen
  //     tokeny, které v šablonách OPRAVDU jsou, ať seznam po jejich vymýcení ztichne.
  const zTokenu: { url: string; kde: string }[] = [];
  const tokenyNalezene: string[] = [];
  for (const [token, url] of Object.entries(TOKENY_S_ADRESOU_V_KODU)) {
    if (!blobSablon.includes("{{" + token + "}}")) continue;
    tokenyNalezene.push(token);
    zTokenu.push({ url, kde: "token:" + token });
  }
  // Tokeny tvaru {{neco_url}}, ke kterým adresu NEZNÁME. Nemůžu je zkontrolovat,
  // ale musí být VIDĚT v odpovědi, jinak se díra zase zamete pod koberec.
  const nalezeneTokeny: string[] = blobSablon.match(/\{\{[a-z0-9_]+_url\}\}/gi) ?? [];
  const tokenyBezAdresy = [...new Set(nalezeneTokeny.map((t) => t.slice(2, -2).toLowerCase()))]
    .filter((t) => !(t in TOKENY_S_ADRESOU_V_KODU));

  // 2) + klíčové stránky a adresy z tokenů, bez duplicit
  const vse: { url: string; kde: string }[] = [];
  const videno = new Set<string>();
  for (const u of KLICOVE_STRANKY) { if (!videno.has(u)) { videno.add(u); vse.push({ url: u, kde: "stranka" }); } }
  for (const t of zTokenu)         { if (!videno.has(t.url)) { videno.add(t.url); vse.push(t); } }
  for (const u of zeSablon)        { if (!videno.has(u)) { videno.add(u); vse.push({ url: u, kde: "sablona" }); } }

  if (vse.length > MAX_URL) {
    await alertAdmin("Link-check: podezřele moc odkazů, kontrola zkrácena", { nalezeno: vse.length, strop: MAX_URL });
    vse.length = MAX_URL;
  }

  // 3) kontrola: seskupeno po hostech. Různé weby souběžně, týž web po jednom.
  // ⚠️ `stav` musí vzniknout AŽ TADY, uvnitř běhu. Modulová proměnná by v teplém
  // isolate přežila do dalšího spuštění a včerejší blokace by tiše sebrala dnešní
  // kontrolu, aniž by se o to kdokoli pokusil.
  const stav: Stav = { blokovane: new Set<string>(), druhaSanceVycerpana: new Set<string>() };
  const podleHostu = new Map<string, { url: string; kde: string }[]>();
  for (const v of vse) {
    const h = hostZ(v.url);
    const seznam = podleHostu.get(h);
    if (seznam) seznam.push(v); else podleHostu.set(h, [v]);
  }
  const skupiny = [...podleHostu.values()];
  const vysledky: Mereni[] = [];
  for (let i = 0; i < skupiny.length; i += HOSTU_SOUBEZNE) {
    const davka = skupiny.slice(i, i + HOSTU_SOUBEZNE);
    for (const cast of await Promise.all(davka.map((s) => projdiHost(s, stav)))) vysledky.push(...cast);
  }

  // 4) zápis. Sloupce vypsané ručně: `blokovano` je interní příznak a insert
  //    s neexistujícím sloupcem by neshodil jeden řádek, ale zápis CELÉHO běhu.
  const radky = vysledky.map((v) => ({
    url: v.url, kde: v.kde, http_status: v.http_status, ok: v.ok, poznamka: v.poznamka, run_at: runAt,
  }));
  const { error: chybaZapisu } = await admin.from("link_check").insert(radky);
  if (chybaZapisu) await alertAdmin("Link-check: výsledky se nepodařilo uložit", { chyba: chybaZapisu.message });

  // 5) alert, jen když je co hlásit. ⛔ „Nepodařilo se ověřit" a „nefunguje" jsou
  // DVĚ RŮZNÉ věci a nesmí se slít do jednoho poplachu: 11. až 13. 8. 2026 chodilo
  // „69 odkazů NEFUNGUJE", zatímco web lidem normálně jel a jen nás odmítala jeho
  // ochrana. Falešný poplach naučí adresáta mail ignorovat, což je horší než ticho.
  const blokovane = vysledky.filter((v) => v.blokovano);
  const rozbite = vysledky.filter((v) => !v.ok && !v.blokovano);
  if (rozbite.length) {
    await alertAdmin(`Link-check: ${rozbite.length} z ${vysledky.length} odkazů NEFUNGUJE`, {
      rozbite: rozbite.slice(0, 12).map((v) => `${v.url} → ${v.poznamka}`).join(" | "),
      celkem_kontrolovano: vysledky.length,
      neovereno_kvuli_ochrane_webu: blokovane.length,
    });
  } else if (blokovane.length) {
    await alertAdmin(`Link-check: ${blokovane.length} odkazů se NEPODAŘILO OVĚŘIT (ochrana webu nás odmítá)`, {
      co_to_znamena: "Tyhle odkazy NEJSOU prokazatelně rozbité. Ochrana webu vrátila ověřovací stránku místo obsahu, takže kontrola u nich dnes neproběhla.",
      co_s_tim: "Kontrola běží z IP datacentra a WEDOS Global Protection jim z velké části nedůvěřuje. Spravit to jde jen na straně WEDOSu (povolit naše IP nebo zmírnit ochranu), z appky ne.",
      hosty: [...new Set(blokovane.map((v) => v.url.split("/")[2]))].join(", "),
      prvni: blokovane.slice(0, 3).map((v) => `${v.url} → ${v.poznamka}`).join(" | "),
      overeno_v_poradku: vysledky.filter((v) => v.ok).length,
    });
  }

  try { await admin.rpc("link_check_uklid"); } catch { /* úklid historie je best-effort */ }

  return json({
    ok: true,
    run_at: runAt,
    kontrolovano: vysledky.length,
    v_poradku: vysledky.filter((v) => v.ok).length,
    rozbitych: rozbite.length,
    neovereno_kvuli_ochrane: blokovane.length,
    // ⛔ Tahle věta dřív říkala jen „odkazy s {{ }} se neověřují“ a tím se ta díra
    //   zametla pod koberec. Teď je vidět, které tokeny se dohledaly a které ne.
    tokeny_dohledane: tokenyNalezene,
    tokeny_v_sablonach_bez_adresy: tokenyBezAdresy,
    preskoceno_s_promennou: "adresy s {{ }} uvnitř se neověřují; tokeny s adresou v kódu jsou v TOKENY_S_ADRESOU_V_KODU",
    rozbite: rozbite.map((v) => ({ url: v.url, status: v.http_status, poznamka: v.poznamka })),
    blokovane_hosty: [...stav.blokovane],
  });
});
