// Testy mostu nákupů appky (11. 8. 2026).
// Spusteni: npx --yes deno@2 run akademie/_supabase/functions/app-purchase-bridge/core.test.ts
// (bez jakychkoli --allow-*: test necte sit, disk ani promenne prostredi)
//
// Co se tady hlida (a proc prave to):
//  - bonus dostane JEN rocni VIP (mesicni ani Basic ne), jinak rozdavame 990 Kc zdarma
//  - kdo videokurz uz ma, tomu se radek NEPREPISE, jinak se rozbije vazba na jeho platbu
//  - idempotence podle PLATBY, ne podle stavu pristupu
//  - anti-self a neznamy kod
//  - chybejici sazba => radek SE ZAPISE s nulou a prijde alert (ne ticho)
import {
  BONUS_SOURCE,
  BridgeError,
  type BridgeDeps,
  handleAppPurchase,
  maNarokNaBonus,
  PRODUKT_APPKA,
  type ReferralCodeRow,
  sazbaProAppku,
} from './core.ts';

let selhalo = 0;
function check(nazev: string, podminka: boolean, detail = ''): void {
  if (podminka) {
    console.log('  ok   ' + nazev);
  } else {
    selhalo++;
    console.log('  FAIL ' + nazev + (detail ? '  [' + detail + ']' : ''));
  }
}

const JIRKA: ReferralCodeRow = {
  owner_email: 'jirka@example.com',
  partner_type: 'affiliate',
  rate_monthly: 0.3,
  rate_oneoff: 0.2,
};

type Stav = {
  referraly: Record<string, unknown>[];
  entitlementy: Record<string, unknown>[];
  alerty: { predmet: string; detail: Record<string, unknown> }[];
  logy: { promoId: string; jak: string }[];
  promoDotazy: string[];
};

function mock(opts: {
  kody?: Record<string, ReferralCodeRow>;
  promo?: Record<string, string>;
  promoKlic?: boolean;
  zapsaneOrdery?: string[];
  entitlement?: { active: boolean; expires_at: string | null; source: string | null } | null;
  zapisSpadne?: boolean;
  grantSpadne?: boolean;
} = {}): { deps: BridgeDeps; stav: Stav } {
  const stav: Stav = { referraly: [], entitlementy: [], alerty: [], logy: [], promoDotazy: [] };
  const kody = opts.kody ?? { JIRKA10: JIRKA };
  const ordery = new Set(opts.zapsaneOrdery ?? []);
  const deps: BridgeDeps = {
    najdiAktivniKod: (kod) => Promise.resolve(kody[kod] ?? null),
    rozlozPromoId: (id) => {
      stav.promoDotazy.push(id);
      if (opts.promoKlic === false) return Promise.resolve({ kod: '', jak: 'chybi-klic:' + id });
      const kod = opts.promo?.[id];
      return Promise.resolve(kod ? { kod, jak: 'lookup' } : { kod: '', jak: 'lookup-bez-code' });
    },
    jeOrderZapsany: (id) => Promise.resolve(ordery.has(id)),
    zapisReferral: (row) => {
      if (opts.zapisSpadne) throw new Error('db: spadlo');
      stav.referraly.push(row);
      return Promise.resolve();
    },
    zalogujNerozpoznanouSlevu: (promoId, jak) => {
      stav.logy.push({ promoId, jak });
      return Promise.resolve();
    },
    najdiEntitlement: () => Promise.resolve(opts.entitlement ?? null),
    udelEntitlement: (row) => {
      if (opts.grantSpadne) throw new Error('db: grant spadl');
      stav.entitlementy.push(row);
      return Promise.resolve();
    },
    alert: (predmet, detail) => {
      stav.alerty.push({ predmet, detail });
      return Promise.resolve();
    },
  };
  return { deps, stav };
}

/** Roční VIP nákup 4 990 Kč s Jirkovým kódem z odkazu. */
const ROCNI_VIP = {
  buyer_email: 'Kupujici@Example.com',
  user_id: 'u1',
  tier: 'ai_basic',
  interval: 'year',
  amount: 499000,
  amount_source: 'session',
  currency: 'czk',
  event_id: 'evt_1',
  subscription_id: 'sub_1',
  affiliate_code: 'JIRKA10',
};

async function main(): Promise<void> {
  console.log('\n== app-purchase-bridge: jádro ==');

  // --- Nárok na bonus (čistá funkce) ----------------------------------------
  check('bonus: roční VIP ano', maNarokNaBonus('ai_basic', 'year'));
  check('bonus: měsíční VIP NE', !maNarokNaBonus('ai_basic', 'month'));
  check('bonus: roční Basic NE', !maNarokNaBonus('basic', 'year'));
  check('bonus: neznámý interval NE', !maNarokNaBonus('ai_basic', ''));

  // Sazba: předplatné bere rate_monthly i u ročního (rate_oneoff je pro jednorázovky).
  check('sazba: roční předplatné bere rate_monthly', sazbaProAppku(JIRKA) === 0.3);
  check('sazba: chybějící rate_monthly = 0', sazbaProAppku({ ...JIRKA, rate_monthly: null }) === 0);

  // --- Šťastná cesta: roční VIP s kódem z odkazu -----------------------------
  {
    const { deps, stav } = mock();
    const r = await handleAppPurchase(ROCNI_VIP, deps);
    const ref = stav.referraly[0] ?? {};
    check('roční VIP: referral zapsán z metadat', r.referral === 'zapsano-metadata', r.referral);
    check('roční VIP: produkt je appka', ref.product === PRODUKT_APPKA, String(ref.product));
    check('roční VIP: e-mail se normalizuje na malá písmena',
      ref.buyer_email === 'kupujici@example.com', String(ref.buyer_email));
    check('roční VIP: částka v korunách, ne v haléřích', ref.amount === 4990, String(ref.amount));
    check('roční VIP: provize 30 % = 1497 Kč', ref.reward_amount === 1497, String(ref.reward_amount));
    check('roční VIP: source je coupon (CHECK zná jen coupon/self_report/manual)',
      ref.source === 'coupon', String(ref.source));
    check('roční VIP: odměna affiliate je cash', ref.reward_type === 'cash', String(ref.reward_type));
    check('roční VIP: order_id = event_id (subscription nemá payment_intent)',
      ref.order_id === 'evt_1', String(ref.order_id));
    check('roční VIP: bonus udělen', r.bonus === 'udelen', r.bonus);
    const ent = stav.entitlementy[0] ?? {};
    check('roční VIP: bonus je videokurz', ent.product === 'videokurz', String(ent.product));
    check('roční VIP: bonus má vlastní source', ent.source === BONUS_SOURCE, String(ent.source));
    check('roční VIP: bonus je doživotní (expires_at výslovně null)',
      'expires_at' in ent && ent.expires_at === null, JSON.stringify(ent));
    check('roční VIP: žádný alert', stav.alerty.length === 0, JSON.stringify(stav.alerty));
  }

  // --- Párovací klíče refundu na bonusovém řádku (2. 9. 2026) ----------------
  // ⛔ Bez nich refundová větev `academy-stripe-webhook` bonus nenajde a přístup
  //    po vrácení peněz zůstane. Přesně to se stalo 2. 9. 2026.
  {
    const { deps, stav } = mock();
    await handleAppPurchase(
      { ...ROCNI_VIP, customer_id: 'cus_TEST', stripe_payment_intent: 'pi_TEST' },
      deps,
    );
    const ent = stav.entitlementy[0] ?? {};
    check('bonus nese stripe_customer_id', ent.stripe_customer_id === 'cus_TEST', JSON.stringify(ent));
    check('bonus nese stripe_payment_intent', ent.stripe_payment_intent === 'pi_TEST', JSON.stringify(ent));
    check('bonus nese stripe_subscription_id', ent.stripe_subscription_id === 'sub_1', JSON.stringify(ent));
  }
  {
    // Když identifikátory nedorazí, pole se do upsertu VŮBEC nedostanou: prázdný
    // string by přepsal existující vazbu na NULL.
    const { deps, stav } = mock();
    await handleAppPurchase(ROCNI_VIP, deps);
    const ent = stav.entitlementy[0] ?? {};
    check('bez customer_id se pole nezapisuje', !('stripe_customer_id' in ent), JSON.stringify(ent));
    check('bez payment_intent se pole nezapisuje', !('stripe_payment_intent' in ent), JSON.stringify(ent));
  }

  // --- payment_intent má přednost před event_id ------------------------------
  {
    const { deps, stav } = mock();
    await handleAppPurchase({ ...ROCNI_VIP, payment_intent: 'pi_9' }, deps);
    check('idempotence: klíčem je platba, když je k dispozici',
      stav.referraly[0]?.order_id === 'pi_9', String(stav.referraly[0]?.order_id));
  }

  // --- Duplicita: tentýž event podruhé --------------------------------------
  {
    const { deps, stav } = mock({ zapsaneOrdery: ['evt_1'] });
    const r = await handleAppPurchase(ROCNI_VIP, deps);
    check('duplicita: druhý průchod nezapíše referral', r.referral === 'duplicita-order' && stav.referraly.length === 0, r.referral);
  }

  // --- MĚSÍČNÍ VIP: provize ano, bonus NE ------------------------------------
  {
    const { deps, stav } = mock();
    const r = await handleAppPurchase({ ...ROCNI_VIP, interval: 'month', amount: 49900 }, deps);
    check('měsíční VIP: provize 30 % ze 499 = 149,7', stav.referraly[0]?.reward_amount === 149.7, String(stav.referraly[0]?.reward_amount));
    check('měsíční VIP: BONUS SE NEUDĚLÍ', r.bonus === 'netyka-se' && stav.entitlementy.length === 0, r.bonus);
  }

  // --- ROČNÍ BASIC: provize ano, bonus NE ------------------------------------
  {
    const { deps, stav } = mock();
    const r = await handleAppPurchase({ ...ROCNI_VIP, tier: 'basic', amount: 249000 }, deps);
    check('roční Basic: BONUS SE NEUDĚLÍ', r.bonus === 'netyka-se' && stav.entitlementy.length === 0, r.bonus);
    check('roční Basic: provize se přesto zapíše', stav.referraly.length === 1);
  }

  // --- Kdo videokurz UŽ MÁ, tomu se řádek nepřepíše --------------------------
  {
    const { deps, stav } = mock({ entitlement: { active: true, expires_at: null, source: 'stripe-videokurz' } });
    const r = await handleAppPurchase(ROCNI_VIP, deps);
    check('bonus: koupený videokurz se NEPŘEPÍŠE', r.bonus === 'uz-mel' && stav.entitlementy.length === 0, r.bonus);
  }
  {
    // Dočasný přístup (s expirací) se naopak povýšit MÁ, bonus je doživotní.
    const { deps, stav } = mock({ entitlement: { active: true, expires_at: '2026-09-01T00:00:00Z', source: 'admin-panel' } });
    const r = await handleAppPurchase(ROCNI_VIP, deps);
    check('bonus: dočasný přístup se povýší na doživotní', r.bonus === 'udelen' && stav.entitlementy[0]?.expires_at === null, r.bonus);
  }

  // --- Promo kód z pokladny (druhá cesta) ------------------------------------
  {
    const { deps, stav } = mock({ promo: { promo_abc: 'JIRKA10' } });
    const r = await handleAppPurchase(
      { ...ROCNI_VIP, affiliate_code: null, promotion_code_id: 'promo_abc' },
      deps,
    );
    check('promo: kód se rozloží a atribuuje', r.referral === 'zapsano-promo', r.referral);
    check('promo: zapsal se text kódu, ne ID', stav.referraly[0]?.code === 'JIRKA10', String(stav.referraly[0]?.code));
  }
  {
    // Kód z odkazu má PŘEDNOST před promem: promo se ani nedolupuje.
    const { deps, stav } = mock({ promo: { promo_abc: 'JINY10' } });
    await handleAppPurchase({ ...ROCNI_VIP, promotion_code_id: 'promo_abc' }, deps);
    check('priorita: metadata před promem', stav.referraly[0]?.code === 'JIRKA10', String(stav.referraly[0]?.code));
    check('priorita: promo se zbytečně nedolupuje', stav.promoDotazy.length === 0);
  }
  {
    // Sleva byla, ale kód se nepřečetl: NEZAPISOVAT nic a uložit tvar k dohledání.
    const { deps, stav } = mock({ promoKlic: false });
    const r = await handleAppPurchase(
      { ...ROCNI_VIP, affiliate_code: null, promotion_code_id: 'promo_xyz' },
      deps,
    );
    check('promo bez klíče: nic se nezapíše', stav.referraly.length === 0 && r.referral.startsWith('promo-neprecten'), r.referral);
    check('promo bez klíče: tvar se zaloguje', stav.logy.length === 1, JSON.stringify(stav.logy));
    check('promo bez klíče: bonus se přesto udělí', r.bonus === 'udelen', r.bonus);
  }

  // --- Bez kódu: jen bonus ---------------------------------------------------
  {
    const { deps, stav } = mock();
    const r = await handleAppPurchase({ ...ROCNI_VIP, affiliate_code: null }, deps);
    check('bez kódu: žádný referral, ale bonus ano', r.referral === 'bez-kodu' && stav.referraly.length === 0 && r.bonus === 'udelen', r.referral);
  }

  // --- Anti-self a neznámý kód ----------------------------------------------
  {
    const { deps, stav } = mock();
    const r = await handleAppPurchase({ ...ROCNI_VIP, buyer_email: 'jirka@example.com' }, deps);
    check('anti-self: partner si nevydělá na sobě', r.referral === 'self-referral' && stav.referraly.length === 0, r.referral);
  }
  {
    const { deps, stav } = mock();
    const r = await handleAppPurchase({ ...ROCNI_VIP, affiliate_code: 'NEEXISTUJE' }, deps);
    check('neznámý kód: nic se nezapíše', r.referral === 'neznamy-kod' && stav.referraly.length === 0, r.referral);
  }

  // --- Chybějící sazba: ZAPSAT s nulou a KŘIČET ------------------------------
  {
    const { deps, stav } = mock({ kody: { JIRKA10: { ...JIRKA, rate_monthly: null } } });
    const r = await handleAppPurchase(ROCNI_VIP, deps);
    check('bez sazby: řádek se PŘESTO zapíše (prodej nesmí zmizet)',
      r.referral === 'zapsano-metadata' && stav.referraly.length === 1, r.referral);
    check('bez sazby: odměna 0', stav.referraly[0]?.reward_amount === 0, String(stav.referraly[0]?.reward_amount));
    check('bez sazby: přijde alert', stav.alerty.length === 1, JSON.stringify(stav.alerty.map((a) => a.predmet)));
  }

  // --- Member kód: taky se zapíše, ale jako credit ---------------------------
  {
    const { deps, stav } = mock({
      kody: { 'BARNA-RV4Q': { owner_email: 'clen@example.com', partner_type: 'member', rate_monthly: null, rate_oneoff: null } },
    });
    await handleAppPurchase({ ...ROCNI_VIP, affiliate_code: 'BARNA-RV4Q' }, deps);
    check('member: reward_type je credit', stav.referraly[0]?.reward_type === 'credit', String(stav.referraly[0]?.reward_type));
    check('member: partner_type se uloží', stav.referraly[0]?.partner_type === 'member', String(stav.referraly[0]?.partner_type));
  }

  // --- Cizí měna: NEZAPISOVAT provizi ---------------------------------------
  {
    const { deps, stav } = mock();
    const r = await handleAppPurchase({ ...ROCNI_VIP, currency: 'eur' }, deps);
    check('cizí měna: provize se nezapíše', stav.referraly.length === 0 && r.referral.startsWith('cizi-mena'), r.referral);
    check('cizí měna: přijde alert', stav.alerty.length === 1);
  }

  // --- Selhání jedné půlky nesmí shodit druhou ------------------------------
  {
    const { deps, stav } = mock({ zapisSpadne: true });
    const r = await handleAppPurchase(ROCNI_VIP, deps);
    check('selhání atribuce: bonus se přesto udělí', r.referral === 'chyba' && r.bonus === 'udelen', r.referral + '/' + r.bonus);
    check('selhání atribuce: přijde alert', stav.alerty.length === 1);
  }
  {
    const { deps, stav } = mock({ grantSpadne: true });
    const r = await handleAppPurchase(ROCNI_VIP, deps);
    check('selhání bonusu: provize se přesto zapíše', r.referral === 'zapsano-metadata' && r.bonus === 'chyba', r.bonus);
    check('selhání bonusu: přijde HLASITÝ alert', stav.alerty.length === 1 && String(stav.alerty[0].predmet).includes('bonusový videokurz'), JSON.stringify(stav.alerty[0]?.predmet));
  }

  // --- Vstupní kontroly ------------------------------------------------------
  for (const [nazev, telo] of [
    ['bez e-mailu', { ...ROCNI_VIP, buyer_email: '' }],
    ['nesmyslný e-mail', { ...ROCNI_VIP, buyer_email: 'neni-email' }],
    ['bez event_id', { ...ROCNI_VIP, event_id: '' }],
  ] as const) {
    const { deps } = mock();
    let vyhozeno = false;
    try {
      await handleAppPurchase(telo, deps);
    } catch (e) {
      vyhozeno = e instanceof BridgeError && e.status === 400;
    }
    check('vstup: ' + nazev + ' → 400', vyhozeno);
  }

  console.log(selhalo === 0 ? '\nVSE ZELENE\n' : `\n${selhalo} SELHANI\n`);
  if (selhalo > 0) throw new Error(String(selhalo) + ' selhani');
}

await main();
