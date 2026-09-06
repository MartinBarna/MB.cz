/* Martin Barna - GA4 (G-C3JC8G3FS0) s Google Consent Mode v2 + jednoduchá cookie lišta.
   Měření je defaultně VYPNuté (analytics_storage: denied) a zapne se až po souhlasu.
   Sdílený soubor - odkazuje se z každé stránky jedním <script defer src="/assets/analytics.js">. */
(function () {
  var GA_ID = 'G-C3JC8G3FS0';
  var KEY = 'mb_consent_v1';

  // ⛔⛔ [6. 9. 2026] VOLBA SE UKLÁDÁ NA DVĚ MÍSTA, JINAK SE LIŠTA VRACÍ.
  // Tester hlásil, že po kliknutí na „Odmítnout" lišta zůstává. Ve skutečnosti zmizí,
  // ale volba se ukládala JEN do `localStorage`, a ten je v přísném režimu prohlížeče
  // (blokované cookies třetích stran, privátní okno, „vymazat data při zavření") k dispozici
  // jen zdánlivě: zápis vyhodí výjimku, kterou `try/catch` spolkne, a při dalším načtení
  // se lišta objeví znovu. Člověk pak odmítá pořád dokola a vypadá to, že tlačítko nefunguje.
  // ⇒ Zrcadlí se do cookie (rok, SameSite=Lax). Čte se `localStorage` a při prázdnu cookie.
  // ⚠️ Je to nutné cookie ve smyslu ePrivacy (uchovává volbu souhlasu), takže žádný souhlas
  //    nepotřebuje. Neukládá nic o člověku, jen jeho vlastní rozhodnutí.
  function ulozVolbu(mode) {
    try { localStorage.setItem(KEY, mode); } catch (e) { /* přísný režim, zkusíme cookie */ }
    try {
      document.cookie = KEY + '=' + encodeURIComponent(mode)
        + ';path=/;max-age=31536000;SameSite=Lax'
        + (location.protocol === 'https:' ? ';Secure' : '');
    } catch (e) { /* i tak zmizí lišta aspoň do konce návštěvy */ }
  }
  function nactiVolbu() {
    var v = null;
    try { v = localStorage.getItem(KEY); } catch (e) {}
    if (v) return v;
    try {
      var m = document.cookie.match('(?:^|; )' + KEY + '=([^;]*)');
      if (m) return decodeURIComponent(m[1]);
    } catch (e) {}
    return null;
  }

  window.dataLayer = window.dataLayer || [];
  function gtag() { dataLayer.push(arguments); }
  window.gtag = gtag;
  gtag('js', new Date());

  // Consent Mode v2 - vše defaultně zamítnuté, dokud návštěvník nesouhlasí
  gtag('consent', 'default', {
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    analytics_storage: 'denied',
    wait_for_update: 500
  });
  gtag('config', GA_ID, { anonymize_ip: true });

  // načti gtag knihovnu (v consent mode posílá data bez cookies, dokud není souhlas)
  var g = document.createElement('script');
  g.async = true;
  g.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_ID;
  document.head.appendChild(g);

  function applyConsent(mode) {
    // Granularita souhlasu: 'granted' = statistika i reklamy, 'analytics' = jen statistika
    // (GA4 bez ad_* signálů, Meta Pixel se nenačte), 'denied' = vše zamítnuté.
    var an = (mode === 'granted' || mode === 'analytics') ? 'granted' : 'denied';
    var ad = (mode === 'granted') ? 'granted' : 'denied';
    gtag('consent', 'update', {
      analytics_storage: an,
      ad_storage: ad,
      ad_user_data: ad,
      ad_personalization: ad
    });
  }

  // Meta (Facebook) Pixel - načte se a odpálí AŽ po souhlasu (kvůli GDPR).
  var PIXEL_ID = '277526073774099';
  function loadMetaPixel() {
    if (window.fbq) return;
    !function (f, b, e, v, n, t, s) {
      if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); };
      if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0'; n.queue = [];
      t = b.createElement(e); t.async = !0; t.src = v; s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
    }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
    window.fbq('init', PIXEL_ID);
    window.fbq('track', 'PageView');
  }

  // ===== Konverzní eventy (Meta Pixel + GA4) - aby se reklamy učily a retargetovaly =====
  function onReady(fn) { if (document.readyState !== 'loading') fn(); else document.addEventListener('DOMContentLoaded', fn); }
  // Unikátní eventID pro deduplikaci s budoucím serverovým CAPI.
  function rnd() { return new Date().getTime().toString(36) + Math.random().toString(36).slice(2, 10); }
  function evId(prefix) { return prefix + '-' + rnd(); }
  // Která konverze patří k aktuální stránce.
  // DŮLEŽITÉ: Purchase se měří VÝHRADNĚ SERVEROVĚ přes Meta CAPI + GA4 MP
  // (SimpleShop produkt 42679 → webhook → Cloudflare Worker „ss-capi", dedup přes
  // event_id = číslo objednávky). Klientský Purchase tady ZÁMĚRNĚ NEEXISTUJE - jinak
  // by se nákup dubloval a rozbil dedup s CAPI. Děkovací stránky (/dekuji-*) neměří nic.
  // Kdyby kdy přibyl client-side Purchase, MUSÍ mít eventID = pouze order_number.
  function pageConv() {
    var p = location.pathname;
    if (/dekuji/.test(p))    return null; // Purchase řeší výhradně server-side CAPI
    // ⛔ [6. 9. 2026] Hodnota byla 800 Kč i po zdražení z 1. 9. na 1 490. Reklamy se tak
    //    učily na skoro poloviční hodnotě konverze, než jakou nákup opravdu má.
    //    ⚠️ Řádky níž s hodnotou 800 jsou u STARÝCH odkazů a zůstávají správně: ty odkazy
    //       účtovaly 800 a opožděný klik z rozeslaného mailu je pořád možný.
    if (/^\/videokurz/.test(p)) return { kind: 'view', name: 'Videokurz výživy', id: 'videokurz', value: 1490 };
    if (/^\/akademie\/(objednavka\/?)?(index\.html)?$/.test(p)) return { kind: 'view', name: 'Barna Academy', id: 'academy', value: 8900 };
    return null;
  }
  function fireConvFB() {
    var c = pageConv(); if (!c || !window.fbq) return;
    // Pouze ViewContent (horní trychtýř) - žádný client-side Purchase.
    fbq('track', 'ViewContent', { content_name: c.name, content_type: 'product', content_ids: [c.id], value: c.value, currency: 'CZK' }, { eventID: evId('view') });
  }
  function fireConvGA() {
    var c = pageConv(); if (!c || !window.gtag) return;
    // Pouze view_item - purchase posílá do GA4 server-side (Measurement Protocol).
    gtag('event', 'view_item', { value: c.value, currency: 'CZK', items: [{ item_id: c.id, item_name: c.name, price: c.value }] });
  }
  function loadMetaPixelAndConvert() { loadMetaPixel(); fireConvFB(); }
  // Veřejný helper, ať i appka (registrace magic-link, čekací listina Academy) hlásí Lead
  // konzistentně do Meta i GA4. Když návštěvník odmítl cookies, fbq neexistuje → do Meta nic,
  // GA4 v consent mode pošle cookieless ping. To je správné GDPR chování.
  function trackLead(method, extra) {
    var props = extra || {};
    var fbProps = { content_name: method || 'lead' };
    var gaProps = { method: method || 'lead' };
    for (var k in props) { if (props.hasOwnProperty(k)) { fbProps[k] = props[k]; gaProps[k] = props[k]; } }
    if (window.fbq)  fbq('track', 'Lead', fbProps, { eventID: evId('lead') });
    if (window.gtag) gtag('event', 'generate_lead', gaProps);
    // Atribuce doputovala na server, v prohlížeči už ji držet nemusíme (GDPR:
    // nedrží se déle, než je k čemu). Stejné chování má appka po registraci.
    // ⛔ JEN u odeslání, která atribuci OPRAVDU nesou: `lead_magnet` (lead-form.js)
    // a `kviz` (kviz/index.html) ji přikládají k datům. Registrace do Academy jde
    // přes `BA.signUp()` BEZ atribuce, takže smazat zrcadlo i tam by zahodilo
    // zdroj, který se nikam nezapsal, a člověk by po pozdějším nákupu vypadal
    // jako přímá návštěva.
    if (method === 'lead_magnet' || method === 'kviz') {
      try { if (window.MBAttr && window.MBAttr.smazZrcadlo) window.MBAttr.smazZrcadlo(); } catch (e) {}
    }
  }
  window.mbTrackLead = trackLead;
  function wireConversions() {
    // Klik na nákup → InitiateCheckout / begin_checkout.
    // ⛔ POZOR NA VÝBĚR ODKAZŮ: od 29. 7. 2026 jde Academy přes STRIPE, ne SimpleShop.
    // Kdyby tu zůstal jen výběr `a[href*="simpleshop.cz"]`, klik na doživotní Academy
    // by se přestal měřit ÚPLNĚ: Meta ani Google by o zahájení nákupu za 8 900 Kč
    // nevěděly a optimalizovaly by reklamy na nekompletních datech. Nic by nespadlo,
    // jen by tiše zmizela nejdražší konverze, kterou máme.
    document.addEventListener('click', function (e) {
      var a = e.target.closest
        ? e.target.closest('a[href*="simpleshop.cz"], a[href*="buy.stripe.com"]')
        : null;
      if (!a) return;
      var href = a.getAttribute('href') || '';
      // Stripe odkazy nemají v adrese jméno produktu, poznají se podle ID odkazu.
      // ⛔ KAŽDÝ NOVÝ STRIPE ODKAZ NA WEBU MUSÍ PŘIBÝT I SEM. Když tu chybí, spadne do
      // větve `stripe-other` s hodnotou 0: událost se odešle, takže nic nevypadá rozbitě,
      // ale Meta i Google se učí, že ten nákup nemá cenu. Nejhorší druh tiché chyby,
      // protože reklamy pak optimalizují proti nejdražším produktům.
      // `4gM00ibnpgjMerK7dB3ks04` = Academy doživotně 8 900 Kč (plink_1TyQXw…).
      // `9B6aEW6356Jc4Ra55t3ks05` = Academy doživotně po odečtu videokurzu, 8 100 Kč.
      // `bJe9AS3UXgjMcjC8hF3ks00` = Academy měsíčně 990 Kč (hodnota = první platba).
      // `7sYeVc6356Jc4Ra8hF3ks0h` = Videokurz výživy 1 490 Kč (plink_1UAy87…), od 1. 9. 2026.
      // `3cIaEWezBebE2J22Xl3ks0i` = doplatek z balíčku 349 na videokurz, 1 140 Kč (plink_1UAyAO…).
      // `dRmeVcbnpaZs5VedBZ3ks06` = Videokurz výživy za STAROU cenu 800 Kč (plink_1TymiH…),
      //    od 30. 7. 2026. Na webu už nikde není, ale žije v rozeslaných mailech, takže se
      //    dál měří na 800: kdo klikne ze starého mailu, tolik na pokladně opravdu zaplatí.
      // `bJe6oG8bdc3wcjCdBZ3ks08` = Konzultace 2 990 Kč (plink_1Tyrn5…), od 30. 7. 2026.
      // `6oU8wO3UX3x00AU55t3ks07` = Konzultace 2 190 Kč pro majitele videokurzu (plink_1Typhu…).
      //    ⚠️ Dva různé `id` schválně: dodává se totéž, ale reklamy se musí učit na skutečně
      //    zaplacené částce. Slít je do jednoho by u poloviny nákupů měřilo o 800 Kč vedle.
      var c = href.indexOf('4gM00ibnpgjMerK7dB3ks04') !== -1 ? { id: 'academy', name: 'Barna Academy', val: 8900 }
            : href.indexOf('9B6aEW6356Jc4Ra55t3ks05') !== -1 ? { id: 'academy-upgrade', name: 'Barna Academy (odečet videokurzu)', val: 8100 }
            : href.indexOf('bJe9AS3UXgjMcjC8hF3ks00') !== -1 ? { id: 'academy-mesicne', name: 'Barna Academy měsíčně', val: 990 }
            : href.indexOf('7sYeVc6356Jc4Ra8hF3ks0h') !== -1 ? { id: 'videokurz', name: 'Videokurz výživy', val: 1490 }
            : href.indexOf('3cIaEWezBebE2J22Xl3ks0i') !== -1 ? { id: 'videokurz-doplatek', name: 'Videokurz (doplatek z balíčku)', val: 1140 }
            : href.indexOf('dRmeVcbnpaZs5VedBZ3ks06') !== -1 ? { id: 'videokurz', name: 'Videokurz výživy', val: 800 }
            : href.indexOf('bJe6oG8bdc3wcjCdBZ3ks08') !== -1 ? { id: 'konzultace', name: 'Konzultace', val: 2990 }
            : href.indexOf('6oU8wO3UX3x00AU55t3ks07') !== -1 ? { id: 'konzultace-vk', name: 'Konzultace (majitel videokurzu)', val: 2190 }
            // `4gMbJ0ezBc3wcjC0Pd3ks09` = balíček „40 receptů a 48 odpovědí" 349 Kč
            //    (plink_1U1VnF…), od 6. 8. 2026. Bez tohohle řádku spadne do `stripe-other`
            //    s hodnotou 0, přesně ta tichá chyba, kterou popisuje komentář výš.
            : href.indexOf('4gMbJ0ezBc3wcjC0Pd3ks09') !== -1 ? { id: 'balicek', name: '40 receptů a 48 odpovědí', val: 349 }
            // Dárkové poukazy (od 25. 8. 2026, stránka /poukaz/). Vlastní odkazy schválně:
            // kupující je DÁRCE, ne uživatel produktu, a děkovačka i plnění se liší
            // (PDF poukaz do 24 h, přístup vzniká až obdarovanému). Slít je s běžnými
            // produktovými odkazy by rozbilo jak měření, tak doručení.
            : href.indexOf('14A14mdvx8Rk83m9lJ3ks0d') !== -1 ? { id: 'poukaz-konzultace', name: 'Poukaz: konzultace', val: 2990 }
            : href.indexOf('3cI14m4Z10kOdnGgOb3ks0e') !== -1 ? { id: 'poukaz-videokurz', name: 'Poukaz: videokurz', val: 800 }
            : href.indexOf('00w8wO0IL3x0bfyeG33ks0j') !== -1 ? { id: 'poukaz-videokurz', name: 'Poukaz: videokurz', val: 1490 }
            : href.indexOf('9B66oGfDF0kOdnG41p3ks0f') !== -1 ? { id: 'poukaz-academy', name: 'Poukaz: Barna Academy', val: 8900 }
            : href.indexOf('cNi28qajlebE1EY1Th3ks0g') !== -1 ? { id: 'poukaz-balicek', name: 'Poukaz: 40 receptů a 48 odpovědí', val: 349 }
            // ⭐⭐ ONLINE KOUČINK GOLD A DIAMOND (od 2. 9. 2026, stránka /koucing/).
            // Šest odkazů = šest období, každé s jinou cenou. KAŽDÉ má vlastní `id`
            // a vlastní hodnotu schválně, ze stejného důvodu jako dvě konzultace výš:
            // reklamy se musí učit na částce, která opravdu přišla. Slít Gold na měsíc
            // (6 450) s Diamondem na půl roku (59 500) by měřilo devítinásobně vedle.
            // ⛔ Bez těchhle šesti řádků padá nejdražší produkt na webu do větve
            // `stripe-other` s hodnotou 0. Táž ID musí být i v `koucing/index.html`
            // (mapa ODKAZY), v `assets/referral.js` (KOUCINK_ODKAZY) a ve webhooku.
            : href.indexOf('eVqbJ08bdffI5VebtR3ks0l') !== -1 ? { id: 'koucink-gold-1', name: 'Online koučink Gold (1 měsíc)', val: 6450 }
            : href.indexOf('aFaaEW0IL8Rk97qgOb3ks0m') !== -1 ? { id: 'koucink-gold-3', name: 'Online koučink Gold (3 měsíce)', val: 16950 }
            : href.indexOf('00wfZg779aZs4Ra2Xl3ks0n') !== -1 ? { id: 'koucink-gold-6', name: 'Online koučink Gold (6 měsíců)', val: 31950 }
            : href.indexOf('cNi9ASbnpaZs97q0Pd3ks0o') !== -1 ? { id: 'koucink-diamond-1', name: 'Online koučink Diamond (1 měsíc)', val: 11900 }
            : href.indexOf('5kQbJ00IL5F84Ra9lJ3ks0p') !== -1 ? { id: 'koucink-diamond-3', name: 'Online koučink Diamond (3 měsíce)', val: 32900 }
            : href.indexOf('cNi3cuajl1oSerKapN3ks0q') !== -1 ? { id: 'koucink-diamond-6', name: 'Online koučink Diamond (6 měsíců)', val: 59500 }
            // ⚠️ SimpleShop varianta ZŮSTÁVÁ schválně: web je od 30. 7. přepnutý na Stripe,
            // ale staré odkazy pořád žijí v už rozeslaných mailech. Kdyby tenhle řádek zmizel,
            // klik ze starého mailu by se měřil s hodnotou 0.
            : href.indexOf('3Vbl') !== -1  ? { id: 'videokurz',  name: 'Videokurz výživy', val: 800 }
            : href.indexOf('Xgl8g') !== -1 ? { id: 'academy',    name: 'Barna Academy',    val: 8900 }
            // ⛔ 1990, NE 2990: tenhle odkaz vede na SimpleShop, kde je konzultace pořád
            // za starou cenu. Přepsat hodnotu na 2 990 by měřilo příjem, který nepřišel.
            : href.indexOf('qG2yO') !== -1 ? { id: 'konzultace', name: 'Konzultace',       val: 1990 }
            : href.indexOf('buy.stripe.com') !== -1 ? { id: 'stripe-other', name: 'Stripe', val: 0 }
            :                                { id: 'simpleshop-other', name: 'SimpleShop', val: 0 };
      if (window.fbq) fbq('track', 'InitiateCheckout', { content_name: c.name, content_type: 'product', content_ids: [c.id], value: c.val, currency: 'CZK' }, { eventID: evId('checkout') });
      if (window.gtag) gtag('event', 'begin_checkout', { value: c.val, currency: 'CZK', items: [{ item_id: c.id, item_name: c.name, price: c.val }] });
    }, true);
    // Odeslání kontaktního formuláře → Lead
    var kf = document.getElementById('kontaktForm');
    if (kf) kf.addEventListener('submit', function () { if (window.fbq) fbq('track', 'Lead', {}, { eventID: evId('lead') }); if (window.gtag) gtag('event', 'generate_lead'); });
  }
  onReady(function () { wireConversions(); fireConvGA(); });

  // --- cookie lišta (karta vlevo dole, ať nekoliduje s CTA lištou) ---
  function setChoice(mode, box) {
    ulozVolbu(mode);
    applyConsent(mode);
    if (mode === 'granted') loadMetaPixelAndConvert();
    if (box) box.remove();
    try { document.dispatchEvent(new CustomEvent('mb-consent', { detail: mode })); } catch (e) {}
  }
  function showBanner() {
    var old = document.getElementById('mb-cookie');
    if (old) old.remove();
    if (!document.getElementById('mb-cookie-css')) {
      var st = document.createElement('style');
      st.id = 'mb-cookie-css';
      st.textContent =
        // Mobil (4. 9. 2026, nalez Groka: lista prekryvala CTA „ACADEMY 8 900" a „Chci Gold"):
        // kompaktni karta, kratsi text, bez titulku, mensi tlacitka. Vyska ~120 px misto ~230.
        '@media(max-width:991px){#mb-cookie{left:12px!important;right:12px!important;bottom:92px!important;max-width:none!important;padding:12px 14px 10px!important;font-size:.82rem!important;line-height:1.35!important}' +
          '#mb-cookie .mb-c-title{display:none!important}#mb-cookie .mb-c-long{display:none!important}#mb-cookie .mb-c-short{display:inline!important}' +
          '#mb-cookie #mb-c-ok,#mb-cookie #mb-c-no{padding:7px 10px!important;font-size:.85rem!important}#mb-cookie #mb-c-an{margin-top:4px!important;font-size:.76rem!important;padding:0!important}}' +
        '#mb-cookie .mb-c-short{display:none}' +
        'html[data-theme="light"] #mb-cookie{' +
          'background:linear-gradient(180deg,var(--mb-surface,#ffffff),var(--mb-bg,#F7F3EB))!important;' +
          'color:var(--mb-text,#161310)!important;' +
          'border-color:var(--bd-line,rgba(22,19,16,.12))!important;' +
          'box-shadow:0 18px 50px rgba(22,19,16,.16)!important;' +
        '}' +
        'html[data-theme="light"] #mb-cookie .mb-c-title{color:var(--mb-text,#161310)!important;}' +
        'html[data-theme="light"] #mb-cookie .mb-c-text{color:var(--bd-muted,#5C564C)!important;}' +
        'html[data-theme="light"] #mb-cookie .mb-c-text a{color:var(--bd-gold-soft,#6B4E08)!important;}' +
        'html[data-theme="light"] #mb-c-no{border-color:rgba(22,19,16,.22)!important;color:var(--mb-text,#161310)!important;}' +
        'html[data-theme="light"] #mb-c-an{color:var(--bd-muted,#5C564C)!important;}';
      document.head.appendChild(st);
    }
    var box = document.createElement('div');
    box.id = 'mb-cookie';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-label', 'Souhlas s cookies');
    box.style.cssText = 'position:fixed;left:16px;bottom:16px;z-index:3000;max-width:360px;' +
      'background:linear-gradient(180deg,#16130f,#100d0a);color:#ece4d9;border:1px solid rgba(255,255,255,.1);border-radius:16px;' +
      '-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);' +
      'box-shadow:0 18px 50px rgba(0,0,0,.55);padding:18px 18px 16px;font-family:Poppins,Arial,sans-serif;' +
      'font-size:.92rem;line-height:1.5;';
    box.innerHTML =
      '<div class="mb-c-title" style="font-weight:700;margin-bottom:.3rem;color:#fff">🍪 Cookies</div>' +
      '<div class="mb-c-text" style="color:#f3ece2"><span class="mb-c-long">Používáme cookies pro statistiku návštěvnosti (Google Analytics) a měření reklam (Meta Pixel), abychom web i reklamy vylepšovali. Spustí se až s tvým souhlasem. Podrobnosti v <a href="/zasady-ochrany-osobnich-udaju/" style="color:#F6CD63">zásadách ochrany údajů</a>.</span><span class="mb-c-short">🍪 Cookies pro statistiku a měření reklam, jen s tvým souhlasem. <a href="/zasady-ochrany-osobnich-udaju/" style="color:#F6CD63">Zásady</a>.</span></div>' +
      '<div style="display:flex;gap:8px;margin-top:12px">' +
        '<button id="mb-c-ok" style="flex:1;border:none;cursor:pointer;background:#EBB12C;color:#160d04;font-weight:700;padding:10px 12px;border-radius:2px">Přijmout</button>' +
        '<button id="mb-c-no" style="flex:1;border:1.5px solid rgba(255,255,255,.22);cursor:pointer;background:transparent;color:#ece4d9;font-weight:700;padding:10px 12px;border-radius:2px">Odmítnout</button>' +
      '</div>' +
      '<button id="mb-c-an" style="width:100%;margin-top:8px;border:none;background:transparent;color:#cabfae;cursor:pointer;font-family:inherit;font-size:.82rem;text-decoration:underline;padding:2px">Povolit jen statistiku (bez reklamních cookies)</button>';
    document.body.appendChild(box);
    document.getElementById('mb-c-ok').onclick = function () { setChoice('granted', box); };
    document.getElementById('mb-c-no').onclick = function () { setChoice('denied', box); };
    document.getElementById('mb-c-an').onclick = function () { setChoice('analytics', box); };
  }
  // Trvalá možnost změnit volbu: odkaz s atributem data-cookie-settings kdekoli na webu
  // (patičky právních stránek a článků) lištu znovu otevře.
  window.mbCookieSettings = showBanner;
  document.addEventListener('click', function (e) {
    var el = e.target.closest ? e.target.closest('[data-cookie-settings]') : null;
    if (el) { e.preventDefault(); showBanner(); }
  });

  var saved = nactiVolbu();
  if (saved === 'granted') { applyConsent('granted'); loadMetaPixelAndConvert(); try { document.dispatchEvent(new CustomEvent('mb-consent', { detail: 'granted' })); } catch (e) {} return; }
  if (saved === 'analytics') { applyConsent('analytics'); try { document.dispatchEvent(new CustomEvent('mb-consent', { detail: 'analytics' })); } catch (e) {} return; }
  if (saved === 'denied') { applyConsent('denied'); return; }

  if (document.body) showBanner();
  else document.addEventListener('DOMContentLoaded', showBanner);
})();

/* ===== Vlastní cookieless měření návštěv (page-view → Supabase) ============
   Jeden ping na načtení stránky. Žádná IP, žádné cookie, session_hash žije
   jen v sessionStorage (zavřeš kartu = pryč). Neposílá se, když návštěvník
   odmítl analytické cookies. sendBeacon, ať to nezdržuje načtení. */
(function () {
  var FN = 'https://uhmrpfsdcujbhbtumqye.supabase.co/functions/v1/page-view';
  var SID_KEY = 'mb_pv_sid';
  var sent = false;

  function hasAnalyticsConsent(mode) {
    if (mode === 'granted' || mode === 'analytics') return true;
    var saved = '';
    try { saved = localStorage.getItem('mb_consent_v1') || ''; } catch (e) {}
    return saved === 'granted' || saved === 'analytics';
  }

  function sessionHash() {
    try {
      var s = sessionStorage.getItem(SID_KEY);
      if (s && s.length >= 8 && s.length <= 64) return s;
      var n = '';
      if (window.crypto && crypto.getRandomValues) {
        var a = new Uint8Array(16);
        crypto.getRandomValues(a);
        n = Array.prototype.map.call(a, function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
      } else {
        n = Date.now().toString(36) + Math.random().toString(36).slice(2, 12);
      }
      sessionStorage.setItem(SID_KEY, n);
      return n;
    } catch (e) { return ''; }
  }

  function device() {
    var ua = navigator.userAgent || '';
    if (/iPad|Tablet|PlayBook/i.test(ua)) return 'tablet';
    if (navigator.maxTouchPoints > 1 && /Macintosh/.test(ua)) return 'tablet';
    if (/Mobi|Android|iPhone|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua)) return 'mobile';
    return 'desktop';
  }

  function utm() {
    var out = { utm_source: '', utm_medium: '', utm_campaign: '' };
    try {
      var attr = (window.MBAttr && window.MBAttr.get) ? window.MBAttr.get() : {};
      var p = new URLSearchParams(location.search);
      out.utm_source = String(attr.utm_source || p.get('utm_source') || '').trim().slice(0, 80);
      out.utm_medium = String(attr.utm_medium || p.get('utm_medium') || '').trim().slice(0, 80);
      out.utm_campaign = String(attr.utm_campaign || p.get('utm_campaign') || '').trim().slice(0, 80);
    } catch (e) {}
    return out;
  }

  function payload() {
    var u = utm();
    return {
      path: (location.pathname || '/').slice(0, 299),
      referrer: (document.referrer || '').slice(0, 500),
      utm_source: u.utm_source || undefined,
      utm_medium: u.utm_medium || undefined,
      utm_campaign: u.utm_campaign || undefined,
      device: device(),
      session_hash: sessionHash() || undefined
    };
  }

  function send() {
    if (sent) return;
    if (!hasAnalyticsConsent()) return;
    var path = location.pathname || '/';
    if (path.indexOf('/akademie/admin') === 0) return;
    sent = true;
    var body = JSON.stringify(payload());
    try {
      if (navigator.sendBeacon) {
        var blob = new Blob([body], { type: 'text/plain;charset=UTF-8' });
        if (navigator.sendBeacon(FN, blob)) return;
      }
    } catch (e) {}
    try {
      fetch(FN, { method: 'POST', body: body, keepalive: true, mode: 'cors' }).catch(function () {});
    } catch (e) {}
  }

  document.addEventListener('mb-consent', function (e) {
    var mode = e && e.detail;
    if (mode === 'granted' || mode === 'analytics') send();
  });
  if (hasAnalyticsConsent()) setTimeout(send, 0);
})();

/* ===== Atribuce reklam napříč stránkami i doménou ===========================
   PROBLÉM, který to řeší (dvě tiché díry v měření):
   1) UTM se dosud četla až při odeslání formuláře z location.search. Kdo přišel
      z reklamy na článek a formulář vyplnil o dvě stránky dál (nebo přes
      lead-popup), přišel o atribuci úplně. V DB pak vypadal jako organický.
   2) Odkazy na tvujcoach.cz vedly holé, takže na hranici domény stopa končila
      a registraci v appce nešlo spárovat s kampaní.
   ŘEŠENÍ: první stránka s reklamními parametry si je uloží do sessionStorage
   a zároveň do localStorage jako zrcadlo s platností 7 dní (obojí je úložiště
   první strany, žádné sledování napříč weby; podrobné zdůvodnění u `KEY_ZRCADLO`
   níž). Formuláře i odkazy do appky si je odtud vezmou. Po odeslání formuláře
   se zrcadlo maže.
   Nový klik z reklamy vlastní parametry přepíše = last touch v rámci návštěvy. */
(function () {
  var KEY = 'mb_attr_v1';
  // Pořadí polí drž shodné s lead-form.js a s edge funkcí lead-capture.
  var UTM = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'utm_id'];

  // Reklamní parametry z aktuální URL. Stejná pravidla jako v lead-form.js:
  // utm_* max 60 znaků, klik ID celé (max 200) - zkrácený gclid je pro offline
  // import konverzí do Google Ads nepoužitelný.
  function fromUrl() {
    try {
      var p = new URLSearchParams(location.search), out = {};
      UTM.forEach(function (k) {
        var v = (p.get(k) || '').trim().slice(0, 60);
        if (v) out[k] = v;
      });
      var gcl = (p.get('gclid') || p.get('gbraid') || p.get('wbraid') || '').trim().slice(0, 200);
      if (gcl) {
        out.gclid = gcl;
        if (!out.utm_source) out.utm_source = 'google-ads';
        if (!out.utm_medium) out.utm_medium = 'cpc';
      }
      var fbc = (p.get('fbclid') || '').trim().slice(0, 200);
      if (fbc) {
        out.fbclid = fbc;
        if (!out.utm_source) out.utm_source = 'facebook';
        if (!out.utm_medium) out.utm_medium = 'cpc';
      }
      return out;
    } catch (e) { return {}; }
  }

  /* ⚠️ ZRCADLO DO localStorage (schválil Martin 8. 8. 2026). Doslovný protějšek toho,
     co appka dostala 4. 8. (`src/lib/attribution.ts`), včetně platnosti i mazání.
     PROČ: samotné sessionStorage žije jen v JEDNOM panelu. Odkazy z reklam, z mailů
     a z komentářů na sítích se ale na mobilu otevírají ve VESTAVĚNÉM prohlížeči
     aplikace, a jakmile člověk přejde do svého skutečného prohlížeče (nebo panel
     zavře a vrátí se jiný den), sessionStorage je prázdné a zdroj je nenávratně pryč.
     Změřeno v appce 4. 8. 2026: z 27 profilů nenesl `utm_campaign` ANI JEDEN, přestože
     se parametry z URL zachytávaly správně. Web měl tutéž vadu o čtyři dny déle.
     GDPR: obojí je úložiště PRVNÍ STRANY a neslouží k profilování napříč weby.
     Zrcadlo má platnost 7 dní a po odeslání formuláře se SMAŽE, takže se nedrží
     déle, než je k čemu. */
  var KEY_ZRCADLO = KEY + '_zrcadlo';
  var ZRCADLO_PLATNOST_MS = 7 * 24 * 60 * 60 * 1000;

  function ctiZrcadlo() {
    try {
      var raw = localStorage.getItem(KEY_ZRCADLO);
      if (!raw) return {};
      var parsed = JSON.parse(raw) || {};
      var ulozeno = Number(parsed.ulozeno) || 0;
      if (!ulozeno || Date.now() - ulozeno > ZRCADLO_PLATNOST_MS) { smazZrcadlo(); return {}; }
      var data = parsed.data;
      return (data && typeof data === 'object') ? data : {};
    } catch (e) { return {}; }
  }
  function zapisZrcadlo(o) {
    try { localStorage.setItem(KEY_ZRCADLO, JSON.stringify({ ulozeno: Date.now(), data: o })); }
    catch (e) { /* privátní režim nebo plné úložiště: atribuce se prostě nepřenese */ }
  }
  function smazZrcadlo() {
    try { localStorage.removeItem(KEY_ZRCADLO); } catch (e) { /* nevadí, vyprší samo */ }
  }

  function read() {
    try {
      var raw = sessionStorage.getItem(KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') return parsed;
      }
    } catch (e) { /* padáme na zrcadlo níž */ }
    // Session je prázdná: buď nový panel (typicky přechod z vestavěného prohlížeče
    // do skutečného), nebo se člověk vrátil jiný den.
    return ctiZrcadlo();
  }
  function save(o) {
    try { sessionStorage.setItem(KEY, JSON.stringify(o)); } catch (e) { /* privátní režim */ }
    zapisZrcadlo(o);
  }

  // Uloží jen tehdy, když URL reklamní parametry opravdu nese. Prosté prokliknutí
  // na další stránku (bez parametrů) tím pádem uložený záznam nesmaže.
  var live = fromUrl();
  var hasLive = false;
  for (var k in live) { if (live.hasOwnProperty(k)) { hasLive = true; break; } }
  if (hasLive) save(live);

  function get() {
    var stored = read(), cur = fromUrl(), out = {};
    for (var a in stored) if (stored.hasOwnProperty(a)) out[a] = stored[a];
    for (var b in cur) if (cur.hasOwnProperty(b)) out[b] = cur[b];   // aktuální URL má přednost
    return out;
  }
  window.MBAttr = { get: get, key: KEY, smazZrcadlo: smazZrcadlo };

  /* ⭐ ATRIBUCE DO STRIPE POKLADNY (1. 9. 2026) ================================
     Payment Link umí do Checkout Session propsat z adresy JEN `client_reference_id`
     (písmena, číslice, `-`, `_`, max 200 znaků) a `prefilled_email`. UTM parametry
     v odkazu se do session NEDOSTANOU. Konzultace za 2 990 Kč prodaná z Meta reklamy
     proto dorazila do Stripu bez jediné stopy po kampani a nešlo říct, co ji prodalo.
     Skládáme je tedy do toho jednoho povoleného pole.

     Formát: `src-meta_med-cpc_cmp-koucink-warm_cnt-koucink-warm-portret`
     `_` odděluje pole, uvnitř hodnot se proto nesmí objevit (čistička ho mění na `-`).
     Bez uložené atribuce se posílá `src-direct`: v datech se pak pozná „přímá návštěva"
     od „skript vůbec neběžel" (tam pole chybí celé).

     ⛔⛔ ROZEBÍRÁ TO EDGE FUNKCE `academy-stripe-webhook` (funkce `rozdelClientRef`).
     Kdo mění formát nebo předpony, mění OBĚ strany. Kdyby to webhook neuměl rozebrat,
     vzal by atribuci jako kód doporučitele, lookup by vrátil „neznamy-kod" a fallback
     na `referral_click` by se nespustil ⇒ partner tiše přijde o provizi. */
  function ocistiHodnotu(v) {
    return String(v == null ? '' : v).toLowerCase()
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40)
      .replace(/-$/, '');            // useknutí uprostřed nesmí nechat koncovou pomlčku
  }
  var CREF_POLE = [['src', 'utm_source'], ['med', 'utm_medium'], ['cmp', 'utm_campaign'], ['cnt', 'utm_content']];
  function clientRefAtribuce(attr) {
    var casti = [];
    CREF_POLE.forEach(function (p) {
      var v = ocistiHodnotu(attr[p[1]]);
      if (v) casti.push(p[0] + '-' + v);
    });
    // 4 pole po nejvýš 44 znacích a 3 oddělovače = 179, do stropu se to vejde vždy.
    // `slice` je pojistka pro případ, že by pole někdy přibylo.
    return casti.length ? casti.join('_').slice(0, 200) : 'src-direct';
  }

  // Odkazy na appku dostanou atribuci do URL. Cross-domain jinak nejde: appka
  // běží na jiné doméně (Vercel), takže se k sessionStorage martinbarna.cz nedostane.
  // Vlastní parametry odkazu (např. ?plan=vip z ceníku) zůstávají, atribuce jen doplňuje.
  function decorate() {
    var attr = get(), keys = [];
    for (var k in attr) if (attr.hasOwnProperty(k)) keys.push(k);

    /* ⭐ KÓD PARTNERA DO ODKAZŮ NA APPKU (2. 9. 2026).
       Partnerka posílá lidi na `martinbarna.cz/?ref=KRISTINA10`. Když takový člověk
       klikne na appku, doména se mění (tvujcoach.cz běží na Vercelu) a kód by zůstal
       v localStorage martinbarna.cz, kam appka nevidí ⇒ registrace v appce by o partnera
       přišla. Proto se `ref` veze v adrese, stejně jako atribuce reklamy nad tím.
       ⛔ Kód a jeho expiraci vlastní `assets/referral.js` (klíče `ba_ref`/`ba_ref_t`,
       60 dní); čteme ho jedině přes `window.MBRef.get()`, ať nevznikne druhá definice. */
    var refPartnera = '';
    try { refPartnera = (window.MBRef && window.MBRef.get && window.MBRef.get()) || ''; } catch (e) {}

    if (keys.length || refPartnera) {
      var links = document.querySelectorAll('a[href*="tvujcoach.cz"]');
      Array.prototype.forEach.call(links, function (a) {
        var href = a.getAttribute('href') || '';
        if (href.indexOf('tvujcoach.cz') === -1) return;
        try {
          var u = new URL(href, location.href);
          keys.forEach(function (k) { if (!u.searchParams.has(k)) u.searchParams.set(k, attr[k]); });
          // Ruční `?ref=` v odkazu (zkratky /go/*) má přednost, nepřepisujeme ho.
          if (refPartnera && !u.searchParams.has('ref')) u.searchParams.set('ref', refPartnera);
          a.setAttribute('href', u.toString());
        } catch (e) { /* nevalidní href necháme být */ }
      });
    }

    // Stripe se dotaguje VŽDY, i bez uložené atribuce (viz `src-direct` výš).
    var cref = clientRefAtribuce(attr);
    var stripeOdkazy = document.querySelectorAll('a[href*="buy.stripe.com"]');
    Array.prototype.forEach.call(stripeOdkazy, function (a) {
      var href = a.getAttribute('href') || '';
      if (href.indexOf('buy.stripe.com') === -1) return;
      try {
        var u = new URL(href, location.href);
        // ⛔ Hodnotu, kterou tam někdo napsal ručně, nepřepisujeme: nevíme, co jí měřil.
        // Kód doporučitele se sem NEDOSTANE, ten připojuje až při kliknutí `referral.js`
        // a ten si tuhle atribuci přepíše (peníze partnera mají přednost).
        if (u.searchParams.has('client_reference_id')) return;
        u.searchParams.set('client_reference_id', cref);
        a.setAttribute('href', u.toString());
      } catch (e) { /* nevalidní href necháme být */ }
    });
  }
  // ⛔ Deferovaný skript běží se `readyState === 'interactive'`, takže první průchod
  // proběhne JEŠTĚ PŘED `referral.js` (načítá se za analytics.js) a `window.MBRef` by
  // v něm neexistoval ⇒ kód partnera by v odkazech na appku chyběl. Druhý průchod na
  // DOMContentLoaded ho doplní. Opakování je neškodné: co v odkazu je, se nepřepisuje.
  if (document.readyState !== 'loading') decorate();
  document.addEventListener('DOMContentLoaded', decorate);
})();

/* ===== WhatsApp na počítači → QR popup =====================================
   Problém: klik na wa.me na PC je k ničemu (otevře přihlášení do WhatsApp Webu).
   Řešení: na desktopu klik na jakýkoli WhatsApp odkaz NEnaviguje, ale ukáže QR
   (naskenuješ mobilem → otevře se chat s předvyplněnou zprávou). Na mobilu se
   odkaz chová normálně (otevře appku se zprávou) - tam QR netřeba. */
(function () {
  var PHONE = '420603229831';
  function isDesktop() {
    var coarse = window.matchMedia && window.matchMedia('(pointer:coarse)').matches;
    var mobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(navigator.userAgent || '');
    return !coarse && !mobileUA;
  }
  function textOf(href) { try { return new URL(href, location.href).searchParams.get('text') || ''; } catch (e) { return ''; } }
  function qrFileFor(href) {
    var t = textOf(href);
    if (/Academy/i.test(t)) return '/assets/qr/wa-academy.svg';
    if (/osobn|tr[ée]nink/i.test(t)) return '/assets/qr/wa-trenink.svg';
    if (/kou[cč]ink/i.test(t)) return '/assets/qr/wa-koucink.svg';
    return '/assets/qr/wa-chat.svg';
  }
  function webHref(href) {
    var t = textOf(href);
    return 'https://web.whatsapp.com/send?phone=' + PHONE + (t ? '&text=' + encodeURIComponent(t) : '');
  }
  var openEl = null;
  function onKey(e) { if (e.key === 'Escape' || e.keyCode === 27) closeQR(); }
  function closeQR() { if (openEl) { openEl.remove(); openEl = null; document.removeEventListener('keydown', onKey); } }
  function openQR(href) {
    closeQR();
    var wrap = document.createElement('div');
    wrap.setAttribute('role', 'dialog'); wrap.setAttribute('aria-label', 'WhatsApp QR kód');
    wrap.style.cssText = 'position:fixed;inset:0;z-index:4000;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;padding:20px;font-family:Poppins,Arial,sans-serif;';
    wrap.innerHTML =
      '<div style="background:#fff;color:#161616;border-radius:18px;max-width:340px;width:100%;padding:24px 22px 20px;text-align:center;box-shadow:0 24px 60px rgba(0,0,0,.35);position:relative;">' +
        '<button type="button" aria-label="Zavřít" data-x style="position:absolute;top:8px;right:12px;border:none;background:transparent;font-size:1.6rem;line-height:1;cursor:pointer;color:#9a948c;">×</button>' +
        '<div style="display:flex;align-items:center;justify-content:center;gap:9px;font-weight:800;font-size:1.08rem;margin-bottom:.3rem;"><span style="width:13px;height:13px;border-radius:50%;background:#EBB12C;display:inline-block;"></span>WhatsApp</div>' +
        '<p style="margin:.2rem 0 1rem;color:#5a5045;font-size:.9rem;line-height:1.45;">Naskenuj QR kód mobilem a otevře se ti chat se mnou i s předvyplněnou zprávou. Nebo napiš na <b>+420&nbsp;603&nbsp;229&nbsp;831</b>.</p>' +
        '<img src="' + qrFileFor(href) + '" alt="WhatsApp QR kód" width="210" height="210" style="width:210px;height:210px;display:block;margin:0 auto;border:1px solid #eee;border-radius:10px;padding:8px;background:#fff;">' +
        '<a href="' + webHref(href) + '" target="_blank" rel="noopener" style="display:inline-block;margin-top:14px;background:#EBB12C;color:#fff;font-weight:700;text-decoration:none;padding:11px 22px;border-radius:50px;font-size:.92rem;">Otevřít WhatsApp Web</a>' +
        '<div style="margin-top:10px;"><a href="' + href + '" target="_blank" rel="noopener" style="color:#9a948c;font-size:.82rem;">Mám appku v počítači → otevřít rovnou</a></div>' +
      '</div>';
    wrap.addEventListener('click', function (e) { if (e.target === wrap) closeQR(); });
    wrap.querySelector('[data-x]').addEventListener('click', closeQR);
    document.body.appendChild(wrap);
    document.addEventListener('keydown', onKey);
    openEl = wrap;
  }
  document.addEventListener('click', function (e) {
    if (!isDesktop()) return;
    if (document.getElementById('waModal')) return; // stránka má vlastní WhatsApp okénko (homepage)
    var a = e.target.closest ? e.target.closest('a[href*="wa.me"], a[href*="api.whatsapp.com"]') : null;
    if (!a) return;
    e.preventDefault();
    openQR(a.getAttribute('href') || ('https://wa.me/' + PHONE));
  }, false);
})();

/* ===== Kotvy zvenku (celý web) ==============================================
   CSS scroll-behavior:smooth (inline na stránkách i v ba-ui.css) v Chromiu
   přeruší skok na #kotvu při načítání stránky (posuny layoutu z lazy obrázků),
   takže příchod z článku nebo mailu skončí nahoře místo u cílové sekce.
   Po load proto doskočíme najisto s dočasně vypnutým smooth. Homepage má
   vlastní řešení; případný druhý skok na tentýž cíl je neškodný. */
(function () {
  if (!location.hash) return;
  addEventListener('load', function () {
    var id = location.hash.slice(1);
    try { id = decodeURIComponent(id); } catch (e) {}
    var el = document.getElementById(id);
    if (!el && document.getElementsByName) el = document.getElementsByName(id)[0];
    if (!el) return;
    var de = document.documentElement, prev = de.style.scrollBehavior;
    de.style.scrollBehavior = 'auto';
    el.scrollIntoView();
    de.style.scrollBehavior = prev;
  });
})();
