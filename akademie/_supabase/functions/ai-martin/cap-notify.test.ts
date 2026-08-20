// Testy stropového mailu na webu. Odeslání je vždy dvojník, nikdy Resend.
// Spuštění: npx tsx cap-notify.test.ts
import {
  capFeatureLabel,
  capNotifyHtml,
  capNotifySubject,
  dayStartIso,
  notifyCapReached,
  type CapNotifyOpts,
} from './cap-notify.ts';

type Case = { name: string; pass: boolean; detail: string };
const cases: Case[] = [];
function check(name: string, pass: boolean, detail = '') {
  cases.push({ name, pass, detail });
}

type FetchCall = { url: string; init?: RequestInit };
function makeOpts(over: Partial<CapNotifyOpts> & {
  cappedToday?: boolean;
  checkFails?: boolean;
  name?: string | null;
  onFetch?: (url: string, init?: RequestInit) => void;
} = {}): CapNotifyOpts & { calls: string[]; mails: any[]; fetches: FetchCall[] } {
  const calls: string[] = [];
  const mails: any[] = [];
  const fetches: FetchCall[] = [];
  const cappedToday = over.cappedToday ?? false;
  const checkFails = over.checkFails ?? false;
  const fetchImpl: CapNotifyOpts['fetchImpl'] = async (url, init) => {
    fetches.push({ url, init });
    over.onFetch?.(url, init);
    const u = String(url);
    if (u.includes('/ai_usage') && (init?.method ?? 'GET') !== 'POST') {
      calls.push('check');
      if (checkFails) return { ok: false, status: 500, json: async () => [] };
      return { ok: true, status: 200, json: async () => (cappedToday ? [{ id: 1 }] : []) };
    }
    if (u.includes('customer_contacts')) {
      const n = over.name === undefined ? 'Jana Nováková' : over.name;
      return { ok: true, status: 200, json: async () => (n ? [{ name: n }] : []) };
    }
    if (u.includes('resend.com')) {
      calls.push('mail');
      mails.push(JSON.parse(String(init?.body ?? '{}')));
      return { ok: true, status: 200, json: async () => ({ id: 're_test' }) };
    }
    return { ok: true, status: 200, json: async () => [] };
  };
  const zapisZnacku = over.zapisZnacku ?? (async () => { calls.push('znacka'); });
  const opts: CapNotifyOpts = {
    userId: over.userId ?? 'u1',
    email: over.email === undefined ? 'jana@example.com' : over.email,
    via: over.via === undefined ? 'academy' : over.via,
    feature: over.feature ?? 'ai_chat_web_capped_daily',
    kind: over.kind ?? 'daily',
    supabaseUrl: over.supabaseUrl ?? 'https://example.supabase.co',
    serviceRole: over.serviceRole ?? 'service-role',
    resendKey: over.resendKey ?? 're_test',
    notifyFrom: over.notifyFrom,
    now: over.now ?? new Date('2026-08-20T18:00:00.000Z'),
    fetchImpl: over.fetchImpl ?? fetchImpl,
    zapisZnacku,
  };
  return Object.assign(opts, { calls, mails, fetches });
}

async function run() {
  const now = new Date('2026-08-20T18:00:00.000Z');

  // 1) první náraz → mail
  {
    const o = makeOpts({ now });
    const r = await notifyCapReached(o);
    check('CAP1 první náraz na strop pošle mail Martinovi', r === 'sent' && o.mails.length === 1, `${r} / ${o.mails.length}`);
    check('CAP1b mail jde na ověřenou adresu a má předmět s e-mailem',
      o.mails[0]?.to?.[0] === 'martin@martinbarna.cz'
      && o.mails[0]?.subject === 'Klient vyčerpal limit AI na webu: jana@example.com',
      JSON.stringify({ to: o.mails[0]?.to, subject: o.mails[0]?.subject }));
    check('CAP1c mail nese jméno, e-mail, denní strop, webový chat a členství',
      typeof o.mails[0]?.html === 'string'
      && o.mails[0].html.includes('Jana Nováková')
      && o.mails[0].html.includes('jana@example.com')
      && o.mails[0].html.includes('denní limit chatu')
      && o.mails[0].html.includes('chat AI Martina na webu')
      && o.mails[0].html.includes('Barna Academy'),
      String(o.mails[0]?.html).slice(0, 400));
  }

  // 2) druhý náraz téhož člověka týž den → NE
  {
    const o = makeOpts({ now, cappedToday: true });
    const r = await notifyCapReached(o);
    check('CAP2 druhý náraz téhož člověka týž den mail NEPOŠLE', r === 'duplicate' && o.mails.length === 0, `${r} / ${o.mails.length}`);
    check('CAP2b u duplicity se značka zapíše, ale mail NE',
      o.calls.join('>') === 'check>znacka', o.calls.join('>'));
  }

  // 3) jiný člověk týž den → ano
  {
    const o = makeOpts({ now, userId: 'u2', email: 'petr@example.com', name: 'Petr', feature: 'ai_vision_web_capped_daily' });
    const r = await notifyCapReached(o);
    check('CAP3 jiný člověk týž den mail dostane',
      r === 'sent' && o.mails[0]?.subject === 'Klient vyčerpal limit AI na webu: petr@example.com', `${r}`);
    check('CAP3b vision denní strop se v mailu jmenuje odhad z fotky',
      String(o.mails[0]?.html).includes('odhad jídla z fotky na webu')
      && String(o.mails[0]?.html).includes('denní limit chatu'), '');
  }

  // 4) selhání odeslání nic neshodí, značka už leží
  {
    const o = makeOpts({
      now,
      fetchImpl: async (url, init) => {
        const u = String(url);
        if (u.includes('/ai_usage')) return { ok: true, status: 200, json: async () => [] };
        if (u.includes('customer_contacts')) return { ok: true, status: 200, json: async () => [] };
        throw new Error('resend down');
      },
    });
    let hodilo = false;
    let r: string = '';
    try { r = await notifyCapReached(o); } catch { hodilo = true; r = 'vyjimka'; }
    check('CAP4 selhání odeslání nevyhodí výjimku', !hodilo && r === 'failed', r);
  }
  {
    const o = makeOpts({
      now,
      fetchImpl: async (url) => {
        const u = String(url);
        if (u.includes('/ai_usage')) return { ok: true, status: 200, json: async () => [] };
        if (u.includes('customer_contacts')) return { ok: true, status: 200, json: async () => [] };
        return { ok: false, status: 500, json: async () => ({}) };
      },
    });
    const r = await notifyCapReached(o);
    check('CAP4b Resend vrátí 500 → jen failed, žádná výjimka', r === 'failed', r);
  }
  {
    const o = makeOpts({ now, checkFails: true });
    const r = await notifyCapReached(o);
    check('CAP4c výpadek kontroly duplicity mail NEPOŠLE', r === 'duplicate' && o.mails.length === 0, `${r} / ${o.mails.length}`);
  }

  // 4d) pořadí kontrola → značka → mail
  {
    const o = makeOpts({ now });
    const r = await notifyCapReached(o);
    check('CAP4d pořadí je kontrola → značka → mail',
      r === 'sent' && o.calls.join('>') === 'check>znacka>mail', o.calls.join('>'));
  }

  // 4e) selhání zápisu značky mail zablokuje (bez stopy by další náraz poslal znovu)
  {
    let hodilo = false;
    let r: unknown = null;
    const mails: any[] = [];
    try {
      r = await notifyCapReached(makeOpts({
        now,
        zapisZnacku: async () => { throw new Error('insert selhal'); },
        fetchImpl: async (url, init) => {
          const u = String(url);
          if (u.includes('/ai_usage')) return { ok: true, status: 200, json: async () => [] };
          if (u.includes('resend.com')) {
            mails.push(JSON.parse(String(init?.body ?? '{}')));
            return { ok: true, status: 200, json: async () => ({}) };
          }
          return { ok: true, status: 200, json: async () => [] };
        },
      }));
    } catch { hodilo = true; }
    check('CAP4e selhání zápisu značky mail NEPOŠLE a nic neshodí',
      !hodilo && r === 'failed' && mails.length === 0, String(r));
  }

  // 5) chybějící klíč
  {
    const o = makeOpts({ now, resendKey: '' });
    const r = await notifyCapReached(o);
    check('CAP5 chybějící RESEND_API_KEY nic neshodí a nic nepošle',
      r === 'no_key' && o.mails.length === 0 && o.calls.includes('znacka'), `${r} / ${o.calls.join('>')}`);
  }

  // 6) žádná dlouhá pomlčka, den začíná o půlnoci UTC
  {
    const texty = [
      capNotifySubject('jana@example.com'),
      capFeatureLabel('ai_chat_web_capped_daily'),
      capFeatureLabel('ai_vision_web_capped'),
      capNotifyHtml({
        ctx: { email: 'jana@example.com', jmeno: 'Jana Nováková', via: 'coaching' },
        feature: 'ai_chat_web_capped',
        kind: 'monthly',
      }),
    ];
    check('CAP6 v textech není dlouhá pomlčka', texty.every((t) => !t.includes('—')), JSON.stringify(texty.filter((t) => t.includes('—'))));
    check('CAP6b dayStartIso je půlnoc UTC téhož dne', dayStartIso(now) === '2026-08-20T00:00:00.000Z', dayStartIso(now));
    check('CAP7 mail bez dohledaného e-mailu se pošle taky',
      capNotifySubject(null).includes('neznámý e-mail'), capNotifySubject(null));
    check('CAP8 měsíční strop má v mailu vlastní pojmenování',
      capNotifyHtml({ ctx: { email: 'a@b.cz', jmeno: null, via: 'academy' }, feature: 'ai_chat_web_capped', kind: 'monthly' })
        .includes('měsíční nákladový strop'), '');
    check('CAP9 koučinkové členství se v mailu jmenuje koučink, ne Academy',
      capNotifyHtml({ ctx: { email: 'a@b.cz', jmeno: null, via: 'coaching' }, feature: 'ai_chat_web_capped_daily', kind: 'daily' })
        .includes('osobního koučinku')
      && !capNotifyHtml({ ctx: { email: 'a@b.cz', jmeno: null, via: 'coaching' }, feature: 'ai_chat_web_capped_daily', kind: 'daily' })
        .includes('Barna Academy'), '');
  }

  const failures = cases.filter((c) => !c.pass).length;
  const lines = cases.map((c) => `${c.pass ? '  ok' : 'FAIL'}  ${c.name}${c.pass ? '' : '  -> ' + c.detail}`);
  console.log(['ai-martin cap-notify — testy', '----------------------------', ...lines, '----------------------------', `${cases.length - failures}/${cases.length} prošlo`].join('\n'));
  if (failures) process.exit(1);
}

run();
