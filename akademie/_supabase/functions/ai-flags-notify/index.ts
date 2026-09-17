// ai-flags-notify — mailová notifikace Martinovi o nových rizikových zprávách z AI chatu.
// Volá pg_cron (na projektu Barna Academy) každých 15 minut s hlavičkou x-flags-secret.
// Stejný zdroják běží na OBOU projektech (Barna Academy = web, AI Martin Barna = appka),
// liší se jen env: SOURCE_LABEL, ADMIN_URL, NOTIFY_FROM.
// V mailu je JEN typ a čas, nikdy obsah zprávy ani identita klienta (Martinovo zadání 21. 7. 2026).
// Úryvek zprávy vidí admin až v /akademie/admin/ (web), resp. v Supabase tabulce (appka).
// Stav drží sloupec ai_flags.notified_at, žádná další tabulka. Od 17. 9. 2026 se do něj
// zapisuje OTISK BĚHU PŘED odesláním a při nedoručení se vrací, takže opakovaný ani
// překrytý běh téže instance tentýž flag nepošle dvakrát a zároveň se žádný neztratí.
// Viz komentář u rezervace níž (nález C/N10 a revize R1, nálezy N1, N2, N3, N5).
// ⛔⛔ TENHLE SOUBOR EXISTUJE DVAKRÁT (appka `supabase/functions/`, Academy
//     `akademie/_supabase/functions/` v repu MB.cz) a do 17. 9. 2026 byly obsahově
//     SHODNÉ (liší se jen konce řádků; ověřeno i shodou `ezbr_sha256` obou živých
//     bundlů). Žádný hlídač tu dvojici nekontroluje: `scripts/hlidac-dvou-verzi.mjs`
//     zná jen jídelníček a trénink. Kdo mění jednu, mění i druhou, nebo napíše proč
//     se netýká. Hotový patch pro druhé repo:
//     `_Claude-dokumenty/2026-09-17_sef73/ai-flags-notify-academy.patch`.
// Env: FLAGS_NOTIFY_SECRET (povinný, jinak 403 na vše), RESEND_API_KEY, SOURCE_LABEL, ADMIN_URL, NOTIFY_FROM.
// Deploy: supabase functions deploy ai-flags-notify --no-verify-jwt (v obou projektech).
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const SECRET = Deno.env.get("FLAGS_NOTIFY_SECRET") ?? "";
const SOURCE = Deno.env.get("SOURCE_LABEL") ?? "AI chat";
const ADMIN_URL = Deno.env.get("ADMIN_URL") ?? "https://martinbarna.cz/akademie/admin/";
const FROM = Deno.env.get("NOTIFY_FROM") ?? "Martin Barna <news@martinbarna.cz>";
const TO = "martin@martinbarna.cz";
const BCC = "fitness.barna@gmail.com";

const KAT: Record<string, string> = {
  crisis: "🔴 KRIZE (linka 116 123 poslána)",
  eating_disorder: "🔴 Porucha příjmu potravy",
  medical: "🟠 Zdravotní téma",
  pregnancy: "🟠 Těhotenství",
  minor: "🟠 Nezletilý",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { "Content-Type": "application/json" } });

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "method" }, 405);
  // FAIL CLOSED: bez nastaveného secretu neodpovídáme nikomu (nikdo nesmí vyvolat mail zvenku)
  if (!SECRET || req.headers.get("x-flags-secret") !== SECRET) return json({ error: "forbidden" }, 403);
  if (!RESEND_KEY) return json({ error: "no_resend" }, 500);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
  const { data: flags, error } = await admin.from("ai_flags")
    .select("id,category,created_at")
    .is("notified_at", null)
    .order("created_at", { ascending: true })
    .limit(50);
  if (error) return json({ error: "db", detail: error.message }, 500);
  if (!flags?.length) return json({ ok: true, sent: 0 });

  // ===========================================================================
  // ZAPIŠ, PAK POŠLI (nález C/N10 auditu mailových toků, opraveno 17. 9. 2026)
  //
  // Do 17. 9. se `notified_at` nastavovalo AŽ PO odeslání jedním hromadným
  // `update ... in(ids)`. Když ten update selhal, funkce vrátila `ok:true` s
  // `warn`, ale za 15 minut vzala TYTÉŽ řádky a poslala druhý mail o téže věci.
  //
  // Nově se značka zabere PŘEDEM a PODMÍNĚNĚ (`is('notified_at', null)`).
  // ⚠️ Chrání to proti PŘEKRYVU DVOU BĚHŮ TÉŽE INSTANCE (pomalý běh a další tik
  //    cronu za 15 minut), ne proti druhému projektu: Academy i appka mají každá
  //    vlastní `ai_flags` ve vlastní databázi a cizí řádky zabrat nemůžou
  //    (crony 20 `ai-flags-notify-web` a 21 `ai-flags-notify-app` míří na dvě
  //    různé URL, ověřeno v Academy `cron.job`; revize R1, nález N5).
  // Mail se skládá JEN ze skutečně zabraných řádků, ne z původního výběru.
  //
  // ⛔⛔ CHYBA ZÁPISU NENÍ DŮKAZ, ŽE SE NEZAPSALO (revize R1, nález N2).
  //    Brána Supabase vrátila za 23 hodin 20× HTTP 504 na `/rest/v1/*`, zatímco
  //    v `postgres_logs` k těm požadavkům není ani jedna chyba (změřeno
  //    12. 9. 2026, hlavička `src/lib/supabase-fetch.ts`): „504 znamená nevím,
  //    jak to dopadlo, ne nestalo se to." Kdyby se chyba UPDATE brala jako
  //    „neorazítkováno", jeden takový 504 by znamenal orazítkovaný flag bez
  //    mailu, a fronta (`notified_at is null`) by ho UŽ NIKDY nepustila.
  //    ⇒ Do sloupce jde OTISK BĚHU (přesná hodnota `znacka`) a po chybě UPDATE
  //      se jedním SELECTem zjistí, které řádky ten otisk nesou. Co nese náš
  //      otisk, je naše a pošle se. Zbytek se nechá příštímu běhu. Když spadne
  //      i ověření, je to stav NEVIM a hlásí se jinak než „nezabráno".
  //    ⛔ A když zápis spadne a ověření NIC nenajde, odchází `ok:true` s důvodem
  //      `zapis-spadl-otisk-nenalezen` a s hláškou té chyby, ne se zdravě
  //      vypadajícím „zabral to jiný běh" (revize R2, nález N1). Kdyby se ty dvě
  //      cesty slily, ztratila by se právě ta chyba, kvůli které tenhle kód je.
  //
  // ⛔ Když mail neodejde (odmítnutí Resendu I výjimka z `fetch`), značka se
  //    VRACÍ, jinak by se bezpečnostní upozornění tiše ztratilo. Když selže
  //    i vrácení, je to nejhorší možný stav (flag označený bez mailu).
  //    ⚠️ Odpověď je 500, ale ⛔ NIKDO JI NEČTE: funkci budí pg_cron přes
  //    `net.http_post` a odpověď končí v `net._http_response`, kam se nikdo
  //    nedívá; `hlidka-cerstvost` ani `ai-kanarek` tuhle funkci nesledují
  //    (revize R1, nález N4). Je to tedy stopa k dohledání, ne poplach.
  //    Řádek v `ai_flags` zůstává, takže v adminu je flag pořád vidět.
  //
  // ⛔ Tahle rozhodovací logika je DVAKRÁT: čistá a otestovaná verze je
  //    `rezervujSOtiskem` v `access-expiry-mail/core.ts`
  //    (test `supabase/functions/__tests__/access-expiry-odhlaseni.test.ts`).
  //    Sem se importovat nedá: tenhle soubor je jednosouborový bundle nasazovaný
  //    do DVOU projektů. Kdo mění jednu, mění i druhou.
  // ===========================================================================
  const znacka = new Date().toISOString();
  const vsechnyIds = flags.map((f: { id: string }) => f.id);
  const { data: zabrane, error: rezErr } = await admin.from("ai_flags")
    .update({ notified_at: znacka })
    .in("id", vsechnyIds)
    .is("notified_at", null)
    .select("id");

  let mojeIds: string[];
  if (!rezErr) {
    mojeIds = (zabrane ?? []).map((r: { id: string }) => r.id);
  } else {
    // ⛔ Jen tady, po chybě zápisu. Ptáme se na PŘESNOU hodnotu, kterou jsme
    // zapisovali, takže cizí razítko se za naše skoro jistě vydávat nemůže.
    // ⚠️ „Skoro": otisk je `toISOString()`, tedy jen milisekundy, a v téhle
    // funkci je jeden otisk na CELÝ běh. Dva překryté běhy téže instance, které
    // by startovaly ve stejné milisekundě, by měly otisk shodný a ověření by si
    // mohlo nárokovat cizí řádky. Chce to běh delší než 15 minut, shodu na
    // milisekundu a k tomu 504, takže to nechávám být, ale netvrdím, že to nejde
    // (revize R2, nález N4). Sesterská `access-expiry-mail` tenhle problém nemá:
    // každý její dotaz je omezený i `.eq("user_id", …)` nad unikátním indexem.
    const { data: overene, error: overErr } = await admin.from("ai_flags")
      .select("id")
      .in("id", vsechnyIds)
      .eq("notified_at", znacka);
    if (overErr) {
      // Zápis i ověření spadly: NEVÍME, jestli je otisk zapsaný. Mail neposíláme
      // (druhý mail je horší než pozdní), ale tohle NENÍ „nezabráno": když otisk
      // zapsaný je, fronta ty flagy už nikdy nepustí a musí se dohledat ručně.
      return json({
        error: "REZERVACE-NEVIM",
        detail: `${rezErr.message} / ${overErr.message}`,
        ids: vsechnyIds,
      }, 500);
    }
    mojeIds = (overene ?? []).map((r: { id: string }) => r.id);
  }

  const mojeSet = new Set(mojeIds);
  const posilame = flags.filter((f: { id: string }) => mojeSet.has(f.id));
  if (!posilame.length) {
    // ⛔ DVĚ RŮZNÉ CESTY SEM, A NESMÍ SE SLÍT (revize R2, nález N1). Do R2 odcházelo
    // v obou případech `ok:true` s důvodem „zabral to jiný běh", takže po spadlém
    // zápisu nezůstala v odpovědi ani stopa a běh vypadal jako zdravý. To je
    // zmenšená verze přesně té vady, kterou celá tahle dávka opravuje.
    if (rezErr) {
      return json({
        ok: true,
        sent: 0,
        reason: "zapis-spadl-otisk-nenalezen",
        zapis_chyba: rezErr.message,
        ids: vsechnyIds,
      });
    }
    return json({ ok: true, sent: 0, reason: "flagy mezitim zabral jiny beh teze instance" });
  }

  const hard = posilame.some((f) => f.category === "crisis" || f.category === "eating_disorder");
  const radky = posilame.map((f) => {
    const kdy = new Date(f.created_at).toLocaleString("cs-CZ", {
      timeZone: "Europe/Prague", day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit",
    });
    return `<tr><td style='padding:6px 10px;border-bottom:1px solid #262232;font-weight:700'>${KAT[f.category] ?? f.category}</td>` +
      `<td align='right' style='padding:6px 10px;border-bottom:1px solid #262232;color:#B9B3C4'>${kdy}</td></tr>`;
  }).join("");
  const html = `<!doctype html><html lang='cs'><head><meta charset='utf-8'><meta name='color-scheme' content='dark'></head>` +
    `<body style='margin:0;background:#0C0B10;padding:16px'>` +
    `<table role='presentation' width='560' cellpadding='0' cellspacing='0' style='width:100%;max-width:560px;margin:0 auto;background:#181520;border:1px solid #262232;color:#F0EADF;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;font-size:15px;line-height:1.55'><tr><td style='padding:26px'>` +
    `<div style='border-left:3px solid ${hard ? "#dc503c" : "#EBB12C"};padding-left:10px;font-weight:800;font-size:13px;letter-spacing:.15em;text-transform:uppercase;color:${hard ? "#e07f6f" : "#EBB12C"};margin:0 0 16px'>AI chat · rizikové zprávy · ${SOURCE}</div>` +
    `<p style='margin:0 0 12px'>Zachytil jsem ${posilame.length}× rizikovou zprávu. AI odpověděla bezpečně podle pravidel. Typ a čas níž; obsah zprávy mailem záměrně nechodí.</p>` +
    `<table role='presentation' width='100%' cellpadding='0' cellspacing='0' style='font-size:14px;border-collapse:collapse'>${radky}</table>` +
    `<p style='margin:18px 0 0'><a href='${ADMIN_URL}' style='display:inline-block;background:#EBB12C;color:#1A1222;text-decoration:none;padding:12px 22px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;font-size:14px'>Otevřít detail</a></p>` +
    `</td></tr></table></body></html>`;

  // ⛔⛔ `.catch(() => null)` JE POVINNÝ, ne opatrnost navíc (revize R1, nález N1).
  //    Značka je v tuhle chvíli už zapsaná. Kdyby `fetch` vyhodil výjimku (DNS,
  //    TLS, spadlá síť, abort), odletěla by z handleru, rollback by se nespustil
  //    a flag by zůstal orazítkovaný BEZ MAILU natrvalo. U kategorií `crisis`
  //    a `eating_disorder` je to přesně ta ztráta, kvůli které rollback existuje.
  //    Stejně to má sesterská `access-expiry-mail` (`posliResend`).
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: FROM, to: [TO], bcc: [BCC],
      subject: `${hard ? "🔴" : "⚠️"} AI chat (${SOURCE}): ${posilame.length}× riziková zpráva`,
      html,
    }),
  }).catch(() => null);
  // Mail neodešel → VRAŤ značku, ať to další běh cronu zkusí znovu a upozornění
  // se neztratí. Vrací se jen ta NAŠE (`eq('notified_at', znacka)`), aby se
  // nesmazalo cizí, novější razítko.
  if (!r || r.status !== 200) {
    const { error: vratErr } = await admin.from("ai_flags")
      .update({ notified_at: null })
      .in("id", mojeIds)
      .eq("notified_at", znacka);
    return json({
      error: "resend",
      // 0 = `fetch` vůbec neprošel (výjimka), ne odpověď serveru.
      status: r ? r.status : 0,
      // ⛔ `vraceni_potvrzeno:false` znamená „NEVÍME", ne „nevrátilo se": chyba
      // zápisu není důkaz, že se nezapsalo (504 z brány). Původní jméno
      // `znacka_vracena` slibovalo znalost, kterou nikdo nemá (revize R2, nález N3).
      vraceni_potvrzeno: !vratErr,
      ...(vratErr ? { vraceni_chyba: vratErr.message } : {}),
    }, 500);
  }
  return json({ ok: true, sent: posilame.length, hard });
});
