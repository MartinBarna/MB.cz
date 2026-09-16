// Test sdileneho odesilani pres Resend a parovani bouncu (16. 9. 2026, nalez V1).
// Doplneno po revizi R1 (nalezy V-1, S-1, S-2, S-5, S-6, N-5).
// Spusteni:
//   npx --yes deno@2 run --allow-read --allow-env akademie/_supabase/functions/_shared/resend-odeslat.test.ts
//
// TRI VRSTVY:
//   1. chovani `odesliPresResend` proti PODVRZENEMU `fetch` a falesnemu `admin`
//      (zadna sit, zadna DB, nic neodchazi),
//   2. textova kontrola `resend-webhook/index.ts` a osmi odesilacich funkci,
//   3. T1: typy udalosti se VYCITAJI ZE ZDROJAKU a porovnavaji se seznamem ve webhooku.
//      Puvodni kontrola porovnavala jen retezec a prave proto prehledla nalez V-1.
//
// ⛔ KONTRAST: kontroly W1 az W5, S1a az S6c a F1 az F8 PADAJI na verzi pred opravou.
//    Overeno (z korene repa, `ad74cf7df` je produkcni SHA ze 16. 9. 2026):
//      mkdir -p /tmp/stare-v1 && for f in resend-webhook client-remind client-report \
//        poukaz-vydat study-reminder milestones splatky-guard order-rescue \
//        academy-stripe-webhook; do mkdir -p /tmp/stare-v1/$f; \
//        git show ad74cf7df:akademie/_supabase/functions/$f/index.ts > /tmp/stare-v1/$f/index.ts; done
//      ZDROJ_V1=/tmp/stare-v1 npx --yes deno@2 run --allow-read --allow-env \
//        akademie/_supabase/functions/_shared/resend-odeslat.test.ts

import { jeMartinovaAdresa, odesliPresResend, zapisOdeslani } from './resend-odeslat.ts';

const KOREN = new URL('../', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const ZDROJ = Deno.env.get('ZDROJ_V1') || KOREN;
const cti = (p: string) => {
  try { return Deno.readTextFileSync(`${ZDROJ}/${p}`).split(String.fromCharCode(13)).join(''); }
  catch { return ''; }
};
// ⚠️ Helper se cte VZDY z pracovniho stromu, ne ze `ZDROJ_V1`: pri kontrastnim behu
//    ve starych zdrojacich neexistuje a kontroly T1b/T1c by spadly na "nenacteno"
//    misto na to, co doopravdy meri.
const ctiZPracovniho = (p: string) => {
  try { return Deno.readTextFileSync(`${KOREN}/${p}`).split(String.fromCharCode(13)).join(''); }
  catch { return ''; }
};

let chyb = 0;
const check = (jmeno: string, podminka: boolean, detail = '') => {
  if (podminka) console.log('  ok   ' + jmeno);
  else { chyb++; console.log('  PADA ' + jmeno + (detail ? '  -> ' + detail : '')); }
};

// --- falesny `admin`, ktery si jen pamatuje, co by zapsal ------------------
type Radek = Record<string, unknown>;
function fakeAdmin(selze = false) {
  const zapsane: Radek[] = [];
  return {
    zapsane,
    from(_t: string) {
      return {
        insert(r: Radek) {
          zapsane.push(r);
          return Promise.resolve(selze ? { error: { message: 'boom' } } : { error: null });
        },
      };
    },
  };
}

const puvodniFetch = globalThis.fetch;
function podvrhniFetch(odpoved: { status: number; telo?: unknown; hodit?: boolean }) {
  globalThis.fetch = ((_u: string | URL | Request, _i?: RequestInit) => {
    if (odpoved.hodit) return Promise.reject(new Error('ECONNRESET'));
    return Promise.resolve(
      new Response(JSON.stringify(odpoved.telo ?? {}), {
        status: odpoved.status,
        headers: { 'content-type': 'application/json' },
      }),
    );
  }) as typeof fetch;
}

// --- 1) CHOVANI HELPERU ----------------------------------------------------
{
  const admin = fakeAdmin();
  podvrhniFetch({ status: 200, telo: { id: 're_abc123' } });
  const r = await odesliPresResend('klic', { to: ['a@b.cz'] }, {
    admin, via: 'test-fn', email: 'A@B.cz', detail: { kind: 'x' },
  });
  check('H1 uspesne odeslani vraci ok a provider_id', r.ok && r.providerId === 're_abc123', r.providerId);
  check('H2 zapise se prave jeden radek', admin.zapsane.length === 1, String(admin.zapsane.length));
  const z = admin.zapsane[0] ?? {};
  // [R1, S-5] `px_odeslano` znamena "mail S PIXELEM" a `admin-api` (akce `mail_mereni`)
  // ho pocita do JMENOVATELE otevrenosti; maily bez pixelu by ho nafoukly. `sent` zase
  // cte denni strop dripu. Vychozi typ je proto `odeslano`.
  check('H3 vychozi typ je `odeslano`, ne `sent` ani `px_odeslano`',
    z.type === 'odeslano', String(z.type));
  check('H4 provider_id je v radku (bez nej se bounce nesparuje)',
    z.provider_id === 're_abc123', String(z.provider_id));
  const d = (z.detail ?? {}) as Record<string, unknown>;
  check('H5 adresa je v detailu male pismem (podle ni se dohledava lead)',
    d.email === 'a@b.cz', String(d.email));
  check('H6 `via` rika, ze ktere funkce mail odesel', d.via === 'test-fn', String(d.via));
  check('H7 doplnkove klice volajiciho zustavaji', d.kind === 'x', String(d.kind));
}
{
  // Resend prijal, ale odpoved nejde precist: radek MUSI vzniknout i tak,
  // protoze na nem u opakovaneho nakupu stoji idempotence.
  const admin = fakeAdmin();
  globalThis.fetch = (() =>
    Promise.resolve(new Response('ne-json', { status: 200 }))) as typeof fetch;
  const r = await odesliPresResend('klic', { to: ['a@b.cz'] }, { admin, via: 'test-fn', email: 'a@b.cz' });
  check('H8 necitelna odpoved: ok zustava true', r.ok && r.providerId === '');
  check('H9 necitelna odpoved: radek PRESTO vznikne (idempotence)', admin.zapsane.length === 1,
    String(admin.zapsane.length));
  check('H10 necitelna odpoved: provider_id je null, ne prazdny retezec',
    (admin.zapsane[0] ?? {}).provider_id === null);
}
{
  const admin = fakeAdmin();
  podvrhniFetch({ status: 422, telo: { message: 'invalid' } });
  const r = await odesliPresResend('klic', { to: ['a@b.cz'] }, { admin, via: 'test-fn', email: 'a@b.cz' });
  check('H11 odmitnuti Resendem: ok=false a status se vraci', !r.ok && r.status === 422, String(r.status));
  // [R1, N-5] Nove se selhani zapisuje jako `type='error'`, aby ho videl zivy jistic
  // `followups_circuit_breaker` (cron 3), ktery pocita prave `error` a pri `resend_429`
  // nebo `quota_exceeded` zavira branu follow-upu.
  check('H12 odmitnuti Resendem: zapise se PRAVE JEDEN radek typu `error`',
    admin.zapsane.length === 1 && (admin.zapsane[0] ?? {}).type === 'error',
    String(admin.zapsane.length) + '/' + String((admin.zapsane[0] ?? {}).type));
  const de = ((admin.zapsane[0] ?? {}).detail ?? {}) as Record<string, unknown>;
  check('H12b radek `error` nese `via`, status i text chyby (jinak se neda dohledat)',
    de.via === 'test-fn' && de.status === 422 && String(de.error ?? '').includes('resend_422'),
    JSON.stringify(de));
}
{
  const admin = fakeAdmin();
  podvrhniFetch({ status: 0, hodit: true });
  const r = await odesliPresResend('klic', { to: ['a@b.cz'] }, { admin, via: 'test-fn', email: 'a@b.cz' });
  check('H13 pad site NEHAZI vyjimku (smycka cronu musi dojet)', !r.ok && r.status === 0);
  check('H13b pad site se taky zapise jako `error`',
    admin.zapsane.length === 1 && (admin.zapsane[0] ?? {}).type === 'error');
}
{
  const r = await odesliPresResend('', { to: ['a@b.cz'] });
  check('H14 chybejici klic se pozna bez volani site', !r.ok && r.chyba === 'missing_RESEND_API_KEY');
}
{
  const admin = fakeAdmin(true);
  const ok = await zapisOdeslani({ admin, via: 'test-fn', email: 'a@b.cz' }, 're_x');
  check('H15 selhani zapisu vraci false a nehazi vyjimku', ok === false);
}
{
  const ok = await zapisOdeslani({ admin: null, via: 'test-fn', email: 'a@b.cz' }, 're_x');
  check('H16 bez klienta databaze se nic nedeje', ok === false);
}
globalThis.fetch = puvodniFetch;

// --- 2) resend-webhook -----------------------------------------------------
const rw = cti('resend-webhook/index.ts');
check('W1 parovani bere seznam typu z pojmenovane konstanty, ne z inline pole',
  /const TYPY_ODESLANI = \[/.test(rw) && /\.in\("type", TYPY_ODESLANI\)/.test(rw));
check('W2 kdyz chybi lead_id, dohleda se lead podle adresy z `detail.email`',
  /const adresaZeStopy = String\(/.test(rw)
  && /\.eq\("email", adresaZeStopy\)/.test(rw));
check('W3 nesparovany bounce nebo stiznost posle alert Martinovi',
  /await alertNesparovano\(admin, t, emailId, adresaZeStopy/.test(rw));
check('W4 alert ma pojistku proti smycce (nejvys jeden za hodinu)',
  /alert_nesparovano/.test(rw) && /3600_000/.test(rw));
check('W5 `odhlas_a_odstran` se dal vola JEN u sparovane stiznosti (nesahalo se na nej)',
  /if \(t === "complaint"\) \{\s*const \{ error: chybaSeznamu \} = await admin\.rpc\("odhlas_a_odstran"/.test(rw));

// --- 3) OSM ODESILACICH FUNKCI POUZIVA HELPER ------------------------------
const FUNKCE: Array<[string, string]> = [
  ['client-remind', 'client-remind/index.ts'],
  ['client-report', 'client-report/index.ts'],
  ['academy-stripe-webhook', 'academy-stripe-webhook/index.ts'],
  ['poukaz-vydat', 'poukaz-vydat/index.ts'],
  ['study-reminder', 'study-reminder/index.ts'],
  ['milestones', 'milestones/index.ts'],
  ['splatky-guard', 'splatky-guard/index.ts'],
  ['order-rescue', 'order-rescue/index.ts'],
];
let i = 0;
for (const [jmeno, cesta] of FUNKCE) {
  i++;
  const zdroj = cti(cesta);
  check(`F${i} ${jmeno} bere odeslani z \`_shared/resend-odeslat.ts\``,
    /from ['"]\.\.\/_shared\/resend-odeslat\.ts['"]/.test(zdroj), zdroj ? '' : 'soubor nenacten');
}

// --- 4) T1: KAZDY TYP, POD KTERYM SE ZAPISUJE ODESLANI, MUSI BYT V SEZNAMU ---
// ⛔⛔ Kontrola z revize R1 (nalez V-1). Puvodni W1 porovnavala jen RETEZEC
//    `["sent", "test", "px_odeslano"]`, takze byla zelena, i kdyz `academy-stripe-webhook`
//    psal `konzultace_znovu_doruceno` a `balicek_znovu_doruceno`, ktere webhook nehledal.
//    Typ, ktery ve webhooku chybi, znamena nesparovany bounce, tedy adresu, kterou nic
//    nezastavi. Kontrola proto typy VYCITA ZE ZDROJAKU.
{
  const seznamRaw = /const TYPY_ODESLANI = \[([\s\S]*?)\];/.exec(rw);
  const vSeznamu = new Set(
    seznamRaw ? [...seznamRaw[1].matchAll(/"([a-z_]+)"/g)].map((m) => m[1]) : [],
  );
  check('T1a seznam typu ve webhooku se podarilo vycist', vSeznamu.size > 0,
    [...vSeznamu].join(','));

  const helper = ctiZPracovniho('_shared/resend-odeslat.ts');
  const vychoziM = /stopa\.typ \?\? "([a-z_]+)"/.exec(helper);
  check('T1b vychozi typ helperu se podarilo vycist', !!vychoziM, vychoziM ? vychoziM[1] : '');
  if (vychoziM) {
    check('T1c vychozi typ helperu `' + vychoziM[1] + '` je v seznamu webhooku',
      vSeznamu.has(vychoziM[1]), [...vSeznamu].join(','));
  }

  // ⚠️ Prochazi se JEN soubory, ktere helper importuji. `typ:` je bezne jmeno klice
  //    i jinde (`admin-api` meta, `drip-send/aktivace.ts`) a sirsi sken by lhal.
  // ⚠️ Nelitralni hodnota (`typ: typZnovu`) se NESMI tise preskocit: musi byt v mape
  //    nize i s tim, odkud se jeji hodnoty ctou, jinak kontrola PADA (T1d).
  const DYNAMICKE: Record<string, { soubor: string; vzor: RegExp }> = {
    typZnovu: {
      soubor: 'academy-stripe-webhook/opakovany-nakup.ts',
      vzor: /return "([a-z_]+)";/g,
    },
  };
  const nalezene = new Set<string>();
  let neznameIdenty = '';
  for (const [, cesta] of FUNKCE) {
    const zdroj = cti(cesta);
    if (!/from ['"]\.\.\/_shared\/resend-odeslat\.ts['"]/.test(zdroj)) continue;
    for (const m of zdroj.matchAll(/\btyp:\s*("([a-z_]+)"|'([a-z_]+)'|([A-Za-z_$][\w$]*))/g)) {
      const literal = m[2] ?? m[3];
      if (literal) { nalezene.add(literal); continue; }
      const ident = m[4];
      if (!ident || ident === 'string') continue;   // deklarace typu parametru, ne hodnota
      const zdrojIdentu = DYNAMICKE[ident];
      if (!zdrojIdentu) { neznameIdenty += cesta + ':' + ident + ' '; continue; }
      const text = ctiZPracovniho(zdrojIdentu.soubor);
      for (const r of text.matchAll(zdrojIdentu.vzor)) if (r[1]) nalezene.add(r[1]);
    }
  }
  check('T1d zadna nerozlustena promenna v `typ:` (kdo prida dynamicky typ, dopise ho sem)',
    neznameIdenty === '', neznameIdenty);
  check('T1e nasel se aspon jeden typ predany helperu', nalezene.size > 0,
    [...nalezene].join(','));
  const chybejici = [...nalezene].filter((t) => !vSeznamu.has(t));
  check('T1f KAZDY typ predany helperu je v seznamu webhooku', chybejici.length === 0,
    'chybi ve webhooku: ' + chybejici.join(',') + ' | nalezeno: ' + [...nalezene].join(','));
}

// --- 5) S-2: MARTINOVY ADRESY --------------------------------------------
check('M1 Martinovy adresy se poznaji (presna i `+znacka`)',
  jeMartinovaAdresa('fitness.barna@gmail.com')
  && jeMartinovaAdresa('FITNESS.BARNA+kittest@gmail.com')
  && jeMartinovaAdresa('martin@martinbarna.cz'));
check('M2 cizi adresa se za Martinovu nepovazuje',
  !jeMartinovaAdresa('mirek.balaban@gmail.com') && !jeMartinovaAdresa('')
  && !jeMartinovaAdresa('barnamaro@gmail.com'));
{
  const admin = fakeAdmin();
  const ok = await zapisOdeslani({ admin, via: 'poukaz-vydat', email: 'fitness.barna@gmail.com' }, 're_x');
  check('M3 pro Martinovu adresu se stopa NEZAPISUJE (jinak by mu bounce zmrazil vlastni lead)',
    ok === false && admin.zapsane.length === 0, String(admin.zapsane.length));
}
check('M4 webhook cte znacku `detail.test` jako testovaci odeslani',
  /orig\?\.type === "test" \|\| detailStopy\.test === true/.test(rw));

// --- 6) S-1 a S-6 ---------------------------------------------------------
check('S1a webhook cte adresu z payloadu Resendu, ne jen ze stopy',
  /const doruceniRaw = ev\?\.data\?\.to;/.test(rw) && /adresyZPayloadu/.test(rw));
check('S1b pri neshode adres se NEZMRAZUJE (lead_id se zahodi)',
  /sparovanoPodle = "adresa_nesedi"/.test(rw)
  && /if \(lead_id && sparovanoPodle === "provider_id" && !adresaSedi\)/.test(rw));
check('S1c prazdny payload NENI neshoda (jinak by zmrazeni vyplo uplne)',
  /adresyZPayloadu\.length === 0 \|\| !adresaZeStopy/.test(rw));
check('S6a chyba cteni puvodniho odeslani vraci 500, ne falesny alert',
  /if \(chybaOrig\) \{/.test(rw) && /"orig_read_failed"/.test(rw));
check('S6b chyba dohledani leada vraci 500', /"lead_lookup_failed"/.test(rw));
check('S6c chyba cteni hodinove pojistky je fail-closed (alert se NEposle)',
  /const uzSlo = chybaPojistky \? true :/.test(rw));

console.log(chyb === 0 ? '\nVSE ZELENE' : `\nPADLO ${chyb} kontrol`);
if (chyb > 0) Deno.exit(1);
