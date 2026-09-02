/* Martin Barna - referral capture (doporučovací i affiliate program).
   1) Zachytí ?ref=KOD z odkazu doporučitele nebo partnera → localStorage (60 dní).
   2) Když kamarád klikne na buy odkaz videokurzu (3Vbl) nebo Academy (Xgl8g)
      A MÁ uložený ref → sebere e-mail (kvůli spárování odměny), pošle {ref,email}
      do referral-click a předvyplní ?email= do SimpleShop odkazu.
   Bez uloženého refu je skript neaktivní - běžný nakupující nic nepozná.
   Sdílený soubor, načítá se z každé stránky za analytics.js.

   ⭐ DVA DRUHY KÓDŮ (od 2. 9. 2026):
   - Členský `BARNA-XXXX` (doporučovací program): sleva `DOPORUC10`.
   - Affiliate partner (`LUCIE10`, `KRISTINA10`, …): slevový kód se rovná KÓDU SAMÉMU.
   Do 2. 9. 2026 se přijímal jen tvar `BARNA-`, takže `martinbarna.cz/?ref=KRISTINA10`
   se nikam neuložil, klik se nezalogoval a partnerka o provizi tiše přišla. */
(function () {
  var CLICK_FN = 'https://uhmrpfsdcujbhbtumqye.supabase.co/functions/v1/referral-click';
  var LS = 'ba_ref', LS_T = 'ba_ref_t', MAX_DAYS = 60;

  // ---- 1) zachyť ?ref= ----
  // Tvar je schválně široký: platnost kódu ověřuje server (`referral-click` hledá řádek
  // v `referral_codes` a junk zahodí), tady jen odfiltrujeme zjevný nesmysl a držíme
  // strop 32 znaků, který má i ta funkce.
  //
  // ⛔ VYJÍMÁME kódy začínající `SRC-`, `MED-`, `CMP-`, `CNT-`: přesně tyhle předpony
  // rozebírá `rozdelClientRef` v `academy-stripe-webhook` jako atribuci reklamy, takže
  // by takový kód ve `client_reference_id` zmizel a partner by tiše přišel o provizi.
  // Žádný takový kód dnes neexistuje, tohle je pojistka pro budoucí zakládání kódů.
  var TVAR_KODU = /^[A-Z0-9][A-Z0-9_-]{2,31}$/;
  var TVAR_ATRIBUCE = /^(SRC|MED|CMP|CNT)-/;
  function platnyKod(k) { return TVAR_KODU.test(k) && !TVAR_ATRIBUCE.test(k); }
  /** Členský kód doporučovacího programu (sleva DOPORUC10) vs. affiliate partner. */
  function jeClensky(k) { return /^BARNA-/.test(k); }

  function refZUrl() {
    try {
      var k = (new URLSearchParams(location.search).get('ref') || '').trim().toUpperCase();
      return platnyKod(k) ? k : '';
    } catch (e) { return ''; }
  }

  try {
    var ref = refZUrl();
    if (ref) {
      localStorage.setItem(LS, ref);
      localStorage.setItem(LS_T, String(Date.now()));
    }
  } catch (e) {}

  function getRef() {
    try {
      var t = parseInt(localStorage.getItem(LS_T) || '0', 10);
      if (t && (Date.now() - t) > MAX_DAYS * 864e5) {
        localStorage.removeItem(LS); localStorage.removeItem(LS_T); return refZUrl();
      }
      // Adresa má přednost: kdo přišel z odkazu partnera, patří partnerovi z odkazu.
      // Zároveň to drží kód i tam, kde je localStorage zakázaný (privátní režim).
      return refZUrl() || localStorage.getItem(LS) || '';
    } catch (e) { return refZUrl(); }
  }

  // Export pro `analytics.js`, který kód dotaguje do odkazů na tvujcoach.cz.
  // ⛔ Klíče `ba_ref`/`ba_ref_t` definuje JEN tenhle soubor; druhá definice jinde
  // by se dřív nebo později rozešla (jiná expirace, jiný tvar kódu).
  window.MBRef = { get: getRef, jeClensky: jeClensky };

  // ---- 2) je to buy odkaz produktu v referralu? ----
  // ⛔ Od 29. 7. 2026 jde Academy přes STRIPE, ne SimpleShop. Bez řádku pro Stripe
  // by referral u doživotní Academy TIŠE PŘESTAL FUNGOVAT: `buyInfo` by vrátilo null,
  // modal by se neukázal a doporučitel by o odměnu přišel, aniž by kdokoli poznal proč.
  // `4gM00ibnpgjMerK7dB3ks04` = odkaz Academy doživotně (plink_1TyQXw…).
  function buyInfo(href) {
    if (!href) return null;
    // ⚠️ SimpleShop varianta ZŮSTÁVÁ: web je od 30. 7. 2026 na Stripu, ale staré odkazy
    // žijí v už rozeslaných mailech a doporučitel by u nich přišel o odměnu.
    if (href.indexOf('simpleshop.cz/3Vbl') >= 0) return { url: href, prod: 'videokurz' };
    // Videokurz na Stripu, 1 490 Kč od 1. 9. 2026 (`plink_1UAy87…`).
    if (href.indexOf('7sYeVc6356Jc4Ra8hF3ks0h') >= 0) return { url: href, prod: 'videokurz', stripe: true };
    // Doplatek z balíčku 349 na videokurz, 1 140 Kč (`plink_1UAyAO…`). Dodává TÝŽ produkt,
    // jen levněji, proto stejný `prod` (stejně jako Academy s odečtem níž).
    // ⛔ Doplatek KUPÓNY NEBERE (změřeno v pokladně 2. 9. 2026: s KRISTINA10 i s DOPORUC10
    // zůstane 1 140 Kč). Je to už zvýhodněná cena. `bezKuponu` proto vypne
    // `prefilled_promo_code` I slib slevy v modalu: slíbit slevu, kterou pokladna nedá,
    // je horší než ji neslíbit vůbec.
    // ⚠️ `client_reference_id` se posílá dál, provize partnera na kupónu nestojí.
    if (href.indexOf('3cIaEWezBebE2J22Xl3ks0i') >= 0) return { url: href, prod: 'videokurz', stripe: true, bezKuponu: true };
    // Stará cena 800 Kč (`plink_1TymiH…`) ZŮSTÁVÁ: na webu už není, ale žije v rozeslaných
    // mailech a doporučitel by u těch nákupů jinak o odměnu přišel.
    if (href.indexOf('dRmeVcbnpaZs5VedBZ3ks06') >= 0) return { url: href, prod: 'videokurz', stripe: true };
    if (href.indexOf('simpleshop.cz/Xgl8g') >= 0) return { url: href, prod: 'academy' };
    if (href.indexOf('4gM00ibnpgjMerK7dB3ks04') >= 0) return { url: href, prod: 'academy', stripe: true };
    // Odkaz s odečtem videokurzu (8 100 Kč) dodává TÝŽ produkt, jen levněji, proto stejný `prod`.
    if (href.indexOf('9B6aEW6356Jc4Ra55t3ks05') >= 0) return { url: href, prod: 'academy', stripe: true };
    // ⬜ Měsíční členství (`bJe9AS3UXgjMcjC8hF3ks00`) tu VĚDOMĚ NENÍ: jestli se za předplatné
    //    má vyplácet odměna za doporučení, je obchodní rozhodnutí, ne technické. Až padne, přidat sem.
    return null;
  }
  // ⚠️ Každá pokladna si jméno parametru pojmenovala po svém. SimpleShop čte `email`,
  // Stripe `prefilled_email`; poslat Stripu `email` znamená, že se pole prostě
  // nepředvyplní. Nic nespadne, jen člověk píše adresu znovu a část jich odpadne.
  //
  // ⛔ A hlavně: SimpleShop dostával kód doporučitele v těle webhooku, Stripe ho takhle
  // NEPŘENESE. Payment link umí nést vlastní identifikátor jedině v `client_reference_id`
  // (písmena, číslice, `-` a `_`, do 200 znaků; náš formát BARNA-XXXX se vejde).
  // Bez něj by doporučitel o odměnu přišel a nikde by se to nerozsvítilo.
  // ⚠️ Kód se připojuje i tehdy, když člověk e-mail NEZADÁ: odměna stojí na kódu, ne na mailu.
  //
  // ⛔⛔ A OD 1. 9. 2026 JE V TOM POLI JEŠTĚ NĚCO: `analytics.js` do něj dotaguje
  // atribuci reklamy (`src-meta_med-cpc_…`) na KAŽDÝ odkaz na buy.stripe.com.
  // Stripe nese jen JEDNU hodnotu, takže se stará odstraní a kód se s atribucí složí
  // do jednoho řetězce (`slozClientRef`, od 2. 9. 2026). Bez toho by v adrese byly
  // parametry DVA, Stripe by si vybral sám a doporučitel by o odměnu přišel podle toho,
  // jak se zrovna trefil.
  function slevovyKod(ref) { return (!ref || jeClensky(ref)) ? 'DOPORUC10' : ref; }

  /* ⭐ KÓD PARTNERA A ATRIBUCE REKLAMY SE VEJDOU OBA (2. 9. 2026).
     `rozdelClientRef` ve webhooku umí z `KRISTINA10_src-meta_med-cpc` vytáhnout kód
     I atribuci, takže se nemusí vybírat. Do 2. 9. se stará hodnota jen zahodila a KAŽDÝ
     nákup přes partnera vypadal v datech jako nákup bez kampaně.
     ⛔ Přilepují se JEN kusy, které webhook pozná jako atribuci. Cokoli jiného by
     spadlo do `zbytek` a stalo se součástí KÓDU, čímž by se lookup rozbil a provize
     by tiše nevznikla.
     ⛔ Strop Stripu je 200 znaků. Když se nevejde vše, uřízne se MĚŘENÍ, nikdy ne kód. */
  var TVAR_ATRIB_POLE = /^(src|med|cmp|cnt)-[a-z0-9-]+$/i;
  var CREF_MAX = 200;
  function slozClientRef(ref, puvodni) {
    var casti = [ref], delka = ref.length;
    String(puvodni || '').split('_').forEach(function (c) {
      if (!TVAR_ATRIB_POLE.test(c)) return;
      if (delka + 1 + c.length > CREF_MAX) return;
      casti.push(c); delka += 1 + c.length;
    });
    return casti.join('_');
  }
  function sParametry(url, email, jeStripe, ref, bezKuponu) {
    var u = url, puvodniCref = '';
    if (jeStripe && ref) {
      try {
        var bez = new URL(u, location.href);
        puvodniCref = bez.searchParams.get('client_reference_id') || '';
        bez.searchParams.delete('client_reference_id');
        u = bez.toString();
      } catch (e) { /* nevalidní adresu necháme být, kód se připojí za ni */ }
    }
    function pridej(klic, hodnota) {
      u += (u.indexOf('?') >= 0 ? '&' : '?') + klic + '=' + encodeURIComponent(hodnota);
    }
    if (jeStripe && ref) pridej('client_reference_id', slozClientRef(ref, puvodniCref));
    // Kupón se předvyplní sám (ověřeno živým checkoutem 8. 8. 2026);
    // bez tohohle musel kamarád kód ručně opsat a část jich to vzdala.
    // ⚠️ Členský program má jeden společný kupón `DOPORUC10`, affiliate partner má
    // ve Stripu kupón POJMENOVANÝ STEJNĚ jako svůj kód (LUCIE10, KRISTINA10, …).
    // Poslat partnerovu zákazníkovi `DOPORUC10` by mu sice dalo slevu, ale ve Stripe
    // session by se objevil cizí promo kód a `zjistiPromoKod` ve webhooku ho bere
    // s NEJVYŠŠÍ prioritou ⇒ provize by šla mimo partnera.
    // ⛔ U odkazu, který kupóny nebere (`bezKuponu`), se promo kód NEPOSÍLÁ a modal
    // slevu neslibuje; jinak by člověk čekal 10 % a v pokladně uviděl plnou částku.
    if (jeStripe && !bezKuponu) pridej('prefilled_promo_code', slevovyKod(ref));
    if (email) pridej(jeStripe ? 'prefilled_email' : 'email', email);
    return u;
  }
  function validEmail(e) { return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e); }

  // ---- modal ----
  var modal = null;
  function ensureModal() {
    if (modal) return modal;
    var css = '#ba-ref-ov{position:fixed;inset:0;z-index:99997;background:rgba(8,6,4,.72);display:flex;align-items:center;justify-content:center;padding:18px;font-family:"Poppins",Arial,sans-serif}'
      + '#ba-ref-ov .bx{background:#161310;border:1px solid rgba(235,177,44,.4);border-radius:18px;max-width:400px;width:100%;padding:22px 22px 20px;color:#ece4d9;box-shadow:0 20px 60px rgba(0,0,0,.6)}'
      + '#ba-ref-ov h3{margin:.1rem 0 .3rem;color:#fff;font-size:1.18rem}'
      + '#ba-ref-ov p{margin:.2rem 0 .9rem;color:#b7ab9b;font-size:.9rem;line-height:1.5}'
      + '#ba-ref-ov input[type=email]{width:100%;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.16);border-radius:11px;padding:12px 13px;color:#fff;font-family:inherit;font-size:.98rem;box-sizing:border-box}'
      + '#ba-ref-ov .hp{position:absolute;left:-9999px;width:1px;height:1px;opacity:0}'
      + '#ba-ref-ov .go{width:100%;margin-top:12px;cursor:pointer;border:none;font-family:inherit;font-weight:800;font-size:1rem;padding:13px;border-radius:50px;background:linear-gradient(145deg,#F6CD63,#EBB12C);color:#1A1222}'
      + '#ba-ref-ov .skip{display:block;width:100%;margin-top:10px;cursor:pointer;background:none;border:none;color:#8a7e6d;font-family:inherit;font-size:.82rem;text-decoration:underline}'
      + '#ba-ref-ov .err{color:#ff8b6b;font-size:.82rem;margin-top:6px;min-height:1em}';
    var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    var ov = document.createElement('div'); ov.id = 'ba-ref-ov'; ov.style.display = 'none';
    ov.innerHTML = '<div class="bx" role="dialog" aria-modal="true">'
      + '<h3 id="ba-ref-h">Máš slevu 10 % 🎉</h3>'
      + '<p id="ba-ref-txt"></p>'
      + '<input type="email" id="ba-ref-em" placeholder="tvuj@email.cz" autocomplete="email">'
      + '<input type="text" id="ba-ref-hp" class="hp" tabindex="-1" autocomplete="off" aria-hidden="true">'
      + '<div class="err" id="ba-ref-err"></div>'
      + '<button class="go" id="ba-ref-go">Pokračovat k platbě →</button>'
      + '<button class="skip" id="ba-ref-skip">Pokračovat bez slevy</button>'
      + '</div>';
    document.body.appendChild(ov);
    modal = ov;
    return ov;
  }

  function openModal(info, ref) {
    var ov = ensureModal();
    ov.style.display = 'flex';
    var em = document.getElementById('ba-ref-em');
    var hp = document.getElementById('ba-ref-hp');
    var err = document.getElementById('ba-ref-err');
    var go = document.getElementById('ba-ref-go');
    var skip = document.getElementById('ba-ref-skip');
    err.textContent = ''; em.value = ''; setTimeout(function () { em.focus(); }, 50);

    // Text sedí na to, odkud člověk přišel. „Kamarád ti poslal doporučení" u nákupu
    // z odkazu partnerky nedává smysl a kód k ručnímu opsání je u obou jiný.
    var kupon = slevovyKod(ref);
    // ⛔ U odkazu bez kupónu (doplatek videokurzu) se sleva NESMÍ slíbit: pokladna
    // ji nedá a člověk by se to dozvěděl až u platby. E-mail sbíráme dál, provize
    // partnera na kupónu nestojí.
    document.getElementById('ba-ref-h').textContent = info.bezKuponu
      ? 'Ještě jedna věc'
      : 'Máš slevu 10 % 🎉';
    skip.textContent = info.bezKuponu ? 'Pokračovat bez e-mailu' : 'Pokračovat bez slevy';
    document.getElementById('ba-ref-txt').innerHTML = info.bezKuponu
      ? 'Přišel jsi přes partnera. Zadej svůj e-mail, ať tě spárujeme, a pošleme tě k platbě. '
        + 'Doplatek už je zvýhodněná cena, další sleva na něj neplatí.'
      : (jeClensky(ref)
        ? 'Kamarád ti poslal doporučení. Zadej svůj e-mail, ať ti slevu spárujeme.'
        : 'Přišel jsi přes partnera, který ti dal slevu 10 %. Zadej svůj e-mail, ať ji spárujeme.')
      + ' Pak tě pošleme k platbě, kde se sleva načte sama (kdyby ne, vlož kód <b>'
      + kupon.replace(/[<>&]/g, '') + '</b> do pole „Přidat kód promoakce").';

    function close() { ov.style.display = 'none'; }
    function proceed(url) { close(); location.href = url; }

    go.onclick = function () {
      var email = (em.value || '').trim().toLowerCase();
      if (!validEmail(email)) { err.textContent = 'Zadej prosím platný e-mail.'; return; }
      // fire-and-forget zápis do referral-click (návratovku ignorujeme)
      try {
        fetch(CLICK_FN, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ref: ref, email: email, website: (hp.value || '') })
        }).catch(function () {});
      } catch (e) {}
      proceed(sParametry(info.url, email, info.stripe, ref, info.bezKuponu));
    };
    em.onkeydown = function (e) { if (e.key === 'Enter') go.onclick(); };
    // I při přeskočení e-mailu musí kód doporučitele odejít, jinak přijde o odměnu.
    skip.onclick = function () { proceed(sParametry(info.url, '', info.stripe, ref, info.bezKuponu)); };
    ov.onclick = function (e) { if (e.target === ov) close(); };
  }

  // ---- 3) zachyť kliknutí na buy odkazy (capture fáze, aby to chytlo dřív než navigace) ----
  document.addEventListener('click', function (ev) {
    var t = ev.target;
    var a = (t && t.closest) ? t.closest('a[href]') : null;
    if (!a) return;
    var info = buyInfo(a.getAttribute('href') || a.href || '');
    if (!info) return;
    var ref = getRef();
    if (!ref) return; // žádný referral → normální chování
    ev.preventDefault();
    ev.stopPropagation();
    openModal(info, ref);
  }, true);
})();
