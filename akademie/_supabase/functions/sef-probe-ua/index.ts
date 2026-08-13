// ============================================================
// SEF-PROBE-UA: VYŘAZENO 13. 8. 2026. Nezbyl tu žádný aktivní kód, jen 410.
//
// K čemu to bylo: link-check hlásil 11. až 13. 8. „69 z 111 odkazů NEFUNGUJE",
// všechny martinbarna.cz, HTTP 401. Z Česka přitom web normálně jel. Odsud,
// z edge prostředí, se to změřit dalo, a měření vyvrátilo obě dosavadní teorie.
//
// CO SE ZMĚŘILO (celé viz komentář v `link-check/index.ts`):
//  - martinbarna.cz odpoví 200 i požadavku ÚPLNĚ BEZ hlaviček ⇒ User-Agent nevinen,
//  - osm spuštění = osm RŮZNÝCH odchozích IP (AWS eu-central-1) a stav kopíruje IP:
//    3.123.189.42→401, 52.59.212.129→200, 54.93.239.162→401, 63.179.252.166→200,
//    zhruba tři čtvrtiny IP odmítnuty ⇒ nejde o ASN blok, ale o nedůvěru k IP,
//  - 401 nese ověřovací stránku „WEDOS.protection - Security verification", tedy
//    JS výzvu pro prohlížeč, ne informaci o mrtvém odkazu,
//  - nálet (24 požadavků po 6 souběžných) umí označkovat i IP, která předtím
//    čtyřikrát v řadě vrátila 200.
//
// Funkce se nemaže, jen umlčuje: kdyby zmizela ze seznamu, `kontrola:nasazeni`
// by ji příště hlásila jako „žije bez zdroje v gitu". Vzor: `sef-upload-shared`.
// ============================================================

Deno.serve(() =>
  new Response(
    JSON.stringify({
      gone: true,
      co_to_bylo: "Dočasná sonda k falešným 401 na martinbarna.cz (11. až 13. 8. 2026).",
      vysledek: "Ověřovací výzva WEDOS Global Protection vůči IP datacentra, ne mrtvé odkazy. Nálezy jsou v komentáři funkce link-check.",
    }),
    { status: 410, headers: { "content-type": "application/json" } },
  )
);
