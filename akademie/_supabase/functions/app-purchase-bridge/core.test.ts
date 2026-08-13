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
  /**
   * Ordery, které kontrola `jeOrderZapsany` NEVIDÍ, ale unikátní index je odmítne.
   * Simuluje souběh dvou webhooků k téže faktuře: oba projdou kontrolou, druhého
   * zastaví až DB. Věcně správný výsledek, který se nesmí hlásit jako selhání.
   */
  souzeniOrdery?: string[];
  /** Kód partnera z předchozího nákupu appky (ledger `referrals`), null = žádná historie. */
  historieKod?: string | null;
  /**
   * Ke kterému PŘEDPLATNÉMU ten starý řádek patří. `undefined` = 'sub_1' (tedy totéž
   * předplatné, které platí dál), `null` = starý řádek zapsaný dřív, než sloupec
   * `stripe_subscription_id` existoval.
   */
  historieSub?: string | null;
  entitlement?: { active: boolean; expires_at: string | null; source: string | null } | null;
  zapisSpadne?: boolean;
  grantSpadne?: boolean;
} = {}): { deps: BridgeDeps; stav: Stav } {
  const stav: Stav = { referraly: [], entitlementy: [], alerty: [], logy: [], promoDotazy: [] };
  const kody = opts.kody ?? { JIRKA10: JIRKA };
  const ordery = new Set(opts.zapsaneOrdery ?? []);
  // Co odmítne unikátní index `referrals_order_uidx`. Nadmnožina toho, co vidí
  // předběžná kontrola: souběžný webhook stihl zapsat mezi kontrolou a insertem.
  const orderyVIndexu = new Set([...(opts.zapsaneOrdery ?? []), ...(opts.souzeniOrdery ?? [])]);
  const deps: BridgeDeps = {
    najdiAktivniKod: (kod) => Promise.resolve(kody[kod] ?? null),
    rozlozPromoId: (id) => {
      stav.promoDotazy.push(id);
      if (opts.promoKlic === false) return Promise.resolve({ kod: '', jak: 'chybi-klic:' + id });
      const kod = opts.promo?.[id];
      return Promise.resolve(kod ? { kod, jak: 'lookup' } : { kod: '', jak: 'lookup-bez-code' });
    },
    jeOrderZapsany: (id) => Promise.resolve(ordery.has(id)),
    // Kód z historie nákupů appky. ⚠️ Mock schválně NEfiltruje podle `kind`: kdyby se
    // jádro na historii zeptalo i u prvního nákupu, test to musí vidět.
    // ⭐ Zrcadlí produkci: hledá se podle PŘEDPLATNÉHO, a teprve když se nic nenajde,
    //   sáhne se po starém řádku, který předplatné neznal. Kdyby mock vracel kód
    //   vždycky, prošel by i kód, který provizi platí ze špatné kapsy (vada V2).
    najdiPredchoziKodProAppku: (_email, subscriptionId) => {
      const kod = opts.historieKod ?? null;
      if (!kod) return Promise.resolve(null);
      const sub = opts.historieSub === undefined ? 'sub_1' : opts.historieSub;
      if (sub === null) return Promise.resolve(kod); // starý řádek bez vazby: fallback přes e-mail
      return Promise.resolve(subscriptionId && subscriptionId === sub ? kod : null);
    },
    zapisReferral: (row) => {
      if (opts.zapisSpadne) throw new Error('db: spadlo');
      // Mock se chová jako DB s unique indexem `referrals_order_uidx`: co je jednou
      // zapsané, je od té chvíle „už zapsané". Bez toho by test opakovaného doručení
      // téže faktury prošel, i kdyby idempotence nefungovala.
      if (typeof row.order_id === 'string' && orderyVIndexu.has(row.order_id)) {
        return Promise.resolve('duplicita' as const);
      }
      stav.referraly.push(row);
      if (typeof row.order_id === 'string') {
        ordery.add(row.order_id);
        orderyVIndexu.add(row.order_id);
      }
      return Promise.resolve('ok' as const);
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

  // --- OPAKOVANÁ PLATBA (obnova předplatného) --------------------------------
  // Měsíční VIP 499 Kč: partner má dostat 149,70 Kč z KAŽDÉ faktury, ne jen z první.
  const FAKTURA = {
    buyer_email: 'kupujici@example.com',
    user_id: 'u1',
    kind: 'renewal',
    amount: 49900,
    amount_source: 'invoice',
    currency: 'czk',
    event_id: 'evt_faktura_1',
    order_id: 'in_0001',
    subscription_id: 'sub_1',
    affiliate_code: null,
    billing_reason: 'subscription_cycle',
  };
  {
    const { deps, stav } = mock({ historieKod: 'JIRKA10' });

    const r1 = await handleAppPurchase(FAKTURA, deps);
    check('obnova: partner dohledán z historie', r1.referral === 'zapsano-historie', r1.referral);
    check('obnova: bonus se NEuděluje podruhé', r1.bonus === 'netyka-se-obnova', r1.bonus);
    check('obnova: žádný entitlement navíc', stav.entitlementy.length === 0, String(stav.entitlementy.length));
    const f1 = stav.referraly[0] ?? {};
    check('obnova: order_id je ID FAKTURY', f1.order_id === 'in_0001', String(f1.order_id));
    check('obnova: provize 30 % z 499 Kč = 149,70', f1.reward_amount === 149.7, String(f1.reward_amount));
    check('obnova: částka z faktury v korunách', f1.amount === 499, String(f1.amount));
    check('obnova: kód je partnerův', f1.code === 'JIRKA10', String(f1.code));

    // Druhá faktura = druhý řádek. Přesně to, co do 13. 8. 2026 nevznikalo.
    const r2 = await handleAppPurchase(
      { ...FAKTURA, event_id: 'evt_faktura_2', order_id: 'in_0002' },
      deps,
    );
    check('obnova: DRUHÁ faktura = DRUHÝ řádek', r2.referral === 'zapsano-historie', r2.referral);
    check('obnova: po dvou fakturách jsou dva řádky', stav.referraly.length === 2, String(stav.referraly.length));

    // Táž faktura doručená znovu (Stripe retry, nebo `invoice.paid`
    // I `invoice.payment_succeeded` k téže faktuře) NESMÍ zaplatit dvakrát.
    const r3 = await handleAppPurchase(
      { ...FAKTURA, event_id: 'evt_faktura_1_znovu', order_id: 'in_0001' },
      deps,
    );
    check('obnova: TÁŽ faktura podruhé = duplicita', r3.referral === 'duplicita-order', r3.referral);
    check('obnova: pořád jen dva řádky', stav.referraly.length === 2, String(stav.referraly.length));
  }
  {
    // ⛔ U PRVNÍHO nákupu se historie nesmí použít: nový nákup bez kódu patří Martinovi.
    const { deps, stav } = mock({ historieKod: 'JIRKA10' });
    const r = await handleAppPurchase(
      { ...ROCNI_VIP, affiliate_code: null, event_id: 'evt_bez_kodu' },
      deps,
    );
    check('první nákup: historie se NEPOUŽIJE', r.referral === 'bez-kodu', r.referral);
    check('první nákup: bez kódu se nic nezapíše', stav.referraly.length === 0, String(stav.referraly.length));
  }
  {
    // Obnova bez jakékoli historie (partner nikdy nebyl) nesmí nic vymýšlet.
    const { deps, stav } = mock({ historieKod: null });
    const r = await handleAppPurchase(FAKTURA, deps);
    check('obnova: bez historie = bez kódu', r.referral === 'bez-kodu', r.referral);
    check('obnova: bez historie se nic nezapíše', stav.referraly.length === 0, String(stav.referraly.length));
  }
  {
    // Kód z metadat faktury má přednost před historií (kdyby Stripe metadata poslal).
    const { deps, stav } = mock({ kody: { JIRKA10: JIRKA, LUCIE10: JIRKA }, historieKod: 'LUCIE10' });
    const r = await handleAppPurchase({ ...FAKTURA, affiliate_code: 'JIRKA10' }, deps);
    check('obnova: metadata mají přednost před historií', r.referral === 'zapsano-metadata', r.referral);
    check('obnova: zapsal se kód z metadat', stav.referraly[0]?.code === 'JIRKA10', String(stav.referraly[0]?.code));
  }
  {
    // Deaktivovaný kód: partner byl vypnutý, obnova mu už provizi nepřipíše.
    const { deps, stav } = mock({ kody: {}, historieKod: 'JIRKA10' });
    const r = await handleAppPurchase(FAKTURA, deps);
    check('obnova: neaktivní kód = neznamy-kod', r.referral === 'neznamy-kod', r.referral);
    check('obnova: neaktivní kód nic nezapíše', stav.referraly.length === 0, String(stav.referraly.length));
  }
  {
    // Roční VIP obnova po roce: bonusový videokurz se NESMÍ udělit znovu.
    const { deps, stav } = mock({ historieKod: 'JIRKA10' });
    const r = await handleAppPurchase(
      { ...FAKTURA, tier: 'ai_basic', interval: 'year', amount: 499000, order_id: 'in_rok_2' },
      deps,
    );
    check('obnova ročního VIP: bonus se NEuděluje', r.bonus === 'netyka-se-obnova', r.bonus);
    check('obnova ročního VIP: entitlement nevznikl', stav.entitlementy.length === 0, String(stav.entitlementy.length));
    check('obnova ročního VIP: provize 30 % z 4990 = 1497', stav.referraly[0]?.reward_amount === 1497,
      String(stav.referraly[0]?.reward_amount));
  }

  // --- V2: NÁVRAT PŘÍMO, BEZ KÓDU. Starý partner už provizi brát nesmí ---------
  // Reprodukce vady, kterou našla revize 13. 8. 2026: člověk přišel přes JIRKA10,
  // předplatné zrušil a po půl roce se upsal SÁM a bez kódu. První faktura byla správně
  // bez provize, ale obnovy nového předplatného platil zase Jirka, a to napořád.
  {
    const { deps, stav } = mock({ historieKod: 'JIRKA10', historieSub: 'sub_stare' });

    // 1) nový PŘÍMÝ nákup bez kódu: nic se nepřipisuje (tohle fungovalo i dřív)
    const prvni = await handleAppPurchase(
      { ...ROCNI_VIP, affiliate_code: null, event_id: 'evt_navrat', subscription_id: 'sub_nove' },
      deps,
    );
    check('návrat: první faktura nového předplatného je bez kódu', prvni.referral === 'bez-kodu', prvni.referral);

    // 2) druhá a třetí faktura TÉHOŽ nového předplatného: taky nic
    const druha = await handleAppPurchase(
      { ...FAKTURA, order_id: 'in_navrat_2', event_id: 'evt_navrat_2', subscription_id: 'sub_nove' },
      deps,
    );
    const treti = await handleAppPurchase(
      { ...FAKTURA, order_id: 'in_navrat_3', event_id: 'evt_navrat_3', subscription_id: 'sub_nove' },
      deps,
    );
    check('návrat: obnova NOVÉHO předplatného nedá provizi starému partnerovi',
      druha.referral === 'bez-kodu' && treti.referral === 'bez-kodu', druha.referral + '/' + treti.referral);
    check('návrat: v ledgeru nevznikl ani jeden řádek', stav.referraly.length === 0, String(stav.referraly.length));
  }
  {
    // Naopak: obnova PŮVODNÍHO předplatného partnerovi dál patří.
    const { deps, stav } = mock({ historieKod: 'JIRKA10', historieSub: 'sub_stare' });
    const r = await handleAppPurchase({ ...FAKTURA, subscription_id: 'sub_stare' }, deps);
    check('návrat: obnova PŮVODNÍHO předplatného partnerovi zůstává',
      r.referral === 'zapsano-historie' && stav.referraly.length === 1, r.referral);
  }
  {
    // Řádek musí vazbu na předplatné nést, jinak by ji další faktura neměla kde najít.
    const { deps, stav } = mock({ historieKod: 'JIRKA10' });
    await handleAppPurchase(FAKTURA, deps);
    check('obnova: řádek nese vazbu na předplatné',
      stav.referraly[0]?.stripe_subscription_id === 'sub_1', String(stav.referraly[0]?.stripe_subscription_id));
    const { deps: d2, stav: s2 } = mock();
    await handleAppPurchase(ROCNI_VIP, d2);
    check('první nákup: řádek nese vazbu na předplatné',
      s2.referraly[0]?.stripe_subscription_id === 'sub_1', String(s2.referraly[0]?.stripe_subscription_id));
  }
  {
    // Řádky zapsané dřív, než sloupec existoval, se musí dohledat dál (přes e-mail).
    const { deps, stav } = mock({ historieKod: 'JIRKA10', historieSub: null });
    const r = await handleAppPurchase(FAKTURA, deps);
    check('obnova: starý řádek bez vazby se pořád dohledá', r.referral === 'zapsano-historie', r.referral);
    check('obnova: dopsaný řádek už vazbu má (příště se hledat nemusí)',
      stav.referraly[0]?.stripe_subscription_id === 'sub_1', String(stav.referraly[0]?.stripe_subscription_id));
  }
  {
    // Obnova bez ID předplatného (starší verze appky): historie se hledat nedá jinak
    // než mezi starými řádky, a ty tady nejsou.
    const { deps, stav } = mock({ historieKod: 'JIRKA10', historieSub: 'sub_1' });
    const r = await handleAppPurchase({ ...FAKTURA, subscription_id: null }, deps);
    check('obnova bez ID předplatného: radši nic než ze špatné kapsy',
      r.referral === 'bez-kodu' && stav.referraly.length === 0, r.referral);
  }

  // --- V6: SOUBĚH dvou webhooků k téže faktuře NENÍ selhání --------------------
  {
    const { deps, stav } = mock({ historieKod: 'JIRKA10', souzeniOrdery: ['in_0001'] });
    const r = await handleAppPurchase(FAKTURA, deps);
    check('souběh: index odmítl druhý zápis a je to duplicita, ne chyba',
      r.referral === 'duplicita-order', r.referral);
    check('souběh: druhý řádek nevznikl', stav.referraly.length === 0, String(stav.referraly.length));
    check('souběh: NEPŘIJDE falešný alert', stav.alerty.length === 0, JSON.stringify(stav.alerty.map((a) => a.predmet)));
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
