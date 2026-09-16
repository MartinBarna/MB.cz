// Test sdileneho odesilani pres Resend a parovani bouncu (16. 9. 2026, nalez V1).
// Spusteni:
//   npx --yes deno@2 run --allow-read --allow-env akademie/_supabase/functions/_shared/resend-odeslat.test.ts
//
// DVE VRSTVY:
//   1. chovani `odesliPresResend` proti PODVRZENEMU `fetch` a falesnemu `admin`
//      (zadna sit, zadna DB, nic neodchazi),
//   2. textova kontrola `resend-webhook/index.ts` a osmi odesilacich funkci.
//
// ⛔ KONTRAST: kontroly W1 az W4 a F1 az F8 PADAJI na verzi pred touhle opravou.
//    Overeno (z korene repa, `ad74cf7df` je produkcni SHA ze 16. 9. 2026):
//      mkdir -p /tmp/stare-v1 && for f in resend-webhook client-remind client-report \
//        poukaz-vydat study-reminder milestones splatky-guard order-rescue \
//        academy-stripe-webhook; do mkdir -p /tmp/stare-v1/$f; \
//        git show ad74cf7df:akademie/_supabase/functions/$f/index.ts > /tmp/stare-v1/$f/index.ts; done
//      ZDROJ_V1=/tmp/stare-v1 npx --yes deno@2 run --allow-read --allow-env \
//        akademie/_supabase/functions/_shared/resend-odeslat.test.ts
//    Namereno 16. 9. 2026: na stare verzi 12 kontrol PADA, na nove 0.

import { odesliPresResend, zapisOdeslani } from './resend-odeslat.ts';

const KOREN = new URL('../', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const ZDROJ = Deno.env.get('ZDROJ_V1') || KOREN;
const cti = (p: string) => {
  try { return Deno.readTextFileSync(`${ZDROJ}/${p}`).split(String.fromCharCode(13)).join(''); }
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
  check('H3 typ je `px_odeslano`, NE `sent` (jinak by ukusoval z denniho stropu dripu)',
    z.type === 'px_odeslano', String(z.type));
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
  check('H12 odmitnuti Resendem: NIC se nezapisuje', admin.zapsane.length === 0, String(admin.zapsane.length));
}
{
  const admin = fakeAdmin();
  podvrhniFetch({ status: 0, hodit: true });
  const r = await odesliPresResend('klic', { to: ['a@b.cz'] }, { admin, via: 'test-fn', email: 'a@b.cz' });
  check('H13 pad site NEHAZI vyjimku (smycka cronu musi dojet)', !r.ok && r.status === 0);
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
check('W1 parovani hleda i typ `px_odeslano`',
  /\.in\("type", \["sent", "test", "px_odeslano"\]\)/.test(rw));
check('W2 kdyz chybi lead_id, dohleda se lead podle adresy z `detail.email`',
  /const adresaZeStopy = String\(/.test(rw)
  && /\.from\("leads"\)\.select\("id"\)\.eq\("email", adresaZeStopy\)/.test(rw));
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

console.log(chyb === 0 ? '\nVSE ZELENE' : `\nPADLO ${chyb} kontrol`);
if (chyb > 0) Deno.exit(1);
