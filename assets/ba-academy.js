/* ============================================================
   Barna Academy / Videokurz — členská sekce (auth + gating + postup)
   ------------------------------------------------------------
   Bezpečné chování:
   • Pokud existuje /assets/ba-config.js (window.BA_CONFIG s url+anonKey),
     běží v režimu "live" proti Supabase (přihlášení, per-produkt přístup,
     postup v DB).
   • Pokud config chybí, běží v režimu "demo": postup v localStorage
     (klíč ba_progress_v1, jako dřív), vše odemčeno — web se nerozbije.
   Žádný build, žádný framework. supabase-js se načítá z CDN jen v live režimu.
   API: window.BA  (viz konec souboru)
   ============================================================ */
(function () {
  "use strict";

  var PROGRESS_KEY = "ba_progress_v1";
  var SUPABASE_CDN = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
  var cfg = (typeof window !== "undefined" && window.BA_CONFIG) || null;
  var LIVE = !!(cfg && cfg.url && cfg.anonKey && cfg.url.indexOf("YOUR-PROJECT") === -1);

  var client = null;
  var authCbs = [];

  // ---- demo (localStorage) helpers --------------------------------
  function lsGet() { try { return JSON.parse(localStorage.getItem(PROGRESS_KEY) || "{}"); } catch (e) { return {}; } }
  function lsSet(o) { try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(o)); } catch (e) {} }

  // ---- načtení supabase-js (jen live) -----------------------------
  function loadSdk() {
    return new Promise(function (resolve, reject) {
      if (window.supabase && window.supabase.createClient) return resolve();
      var s = document.createElement("script");
      s.src = SUPABASE_CDN; s.async = true;
      s.onload = function () { resolve(); };
      s.onerror = function () { reject(new Error("supabase-js se nepodařilo načíst")); };
      document.head.appendChild(s);
    });
  }

  var readyResolve, ready = new Promise(function (r) { readyResolve = r; });

  function init() {
    if (!LIVE) { readyResolve(); return; }
    loadSdk().then(function () {
      client = window.supabase.createClient(cfg.url, cfg.anonKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
      });
      client.auth.onAuthStateChange(function (_e, session) {
        authCbs.forEach(function (cb) { try { cb(session ? session.user : null); } catch (e) {} });
      });
      readyResolve();
    }).catch(function (err) {
      // selhání SDK → degraduj na demo, ať se web nerozbije
      console.warn("[BA] live režim selhal, přepínám na demo:", err && err.message);
      LIVE = false; readyResolve();
    });
  }

  // ---- veřejné API ------------------------------------------------
  var BA = {
    get mode() { return LIVE ? "live" : "demo"; },
    ready: ready,

    onAuth: function (cb) { if (typeof cb === "function") authCbs.push(cb); },

    getUser: function () {
      if (!LIVE) return Promise.resolve(null);
      return client.auth.getUser().then(function (r) { return (r && r.data && r.data.user) || null; }).catch(function () { return null; });
    },

    signUp: function (email, password, fullName) {
      if (!LIVE) return Promise.resolve({ ok: true, demo: true });
      return client.auth.signUp({
        email: email, password: password,
        options: { data: { full_name: fullName || "" } }
      }).then(function (r) { return { ok: !r.error, error: r.error && r.error.message, data: r.data }; });
    },

    signIn: function (email, password) {
      if (!LIVE) return Promise.resolve({ ok: true, demo: true });
      return client.auth.signInWithPassword({ email: email, password: password })
        .then(function (r) { return { ok: !r.error, error: r.error && r.error.message, data: r.data }; });
    },

    signOut: function () {
      if (!LIVE) return Promise.resolve({ ok: true });
      return client.auth.signOut().then(function () { return { ok: true }; });
    },

    // Magic-link / OTP přihlášení BEZ hesla — pošle přihlašovací odkaz na e-mail.
    // shouldCreateUser:true → rovnou registruje nového uživatele (free funnel, min. tření).
    signInWithOtp: function (email, redirectTo) {
      if (!LIVE) return Promise.resolve({ ok: true, demo: true });
      // Kanonický non-www cíl: web 301 přesměrovává www→non-www a session (localStorage)
      // je per-origin — kdyby odkaz skončil na www, session by se po přeskoku ztratila ("přihlásí a vyhodí").
      var dest = (redirectTo || (location.origin + "/akademie/moje/")).replace("://www.", "://");
      return client.auth.signInWithOtp({
        email: email,
        options: {
          shouldCreateUser: true,
          emailRedirectTo: dest
        }
      }).then(function (r) {
        if (r.error) { try { console.error("signInWithOtp error:", r.error, JSON.stringify(r.error)); } catch (e) {} }
        var m = r.error && (r.error.message || r.error.error_description || r.error.msg || "");
        // Supabase při selhání odeslání mailu vrací prázdné tělo → message bývá "{}" nebo "".
        if (m === "{}" || m === "[object Object]" || (m && m.trim() === "")) m = null;
        var status = r.error && (r.error.status || r.error.code);
        if (!m && status) m = "Server vrátil chybu " + status + " při odesílání e-mailu.";
        return { ok: !r.error, error: m };
      }).catch(function (e) {
        try { console.error("signInWithOtp exception:", e); } catch (_) {}
        return { ok: false, error: null };
      });
    },

    // Má uživatel zaplacený přístup k produktu? ('academy' | 'videokurz')
    // Demo režim vrací true (kvůli vývoji).
    hasEntitlement: function (product) {
      if (!LIVE) return Promise.resolve(true);
      return client.rpc("has_entitlement", { p_product: product })
        .then(function (r) { return !r.error && r.data === true; })
        .catch(function () { return false; });
    },

    // Postup: vrací objekt {lesson_id: true, ...}
    getProgress: function () {
      if (!LIVE) return Promise.resolve(lsGet());
      return BA.getUser().then(function (u) {
        if (!u) return {};
        return client.from("progress").select("lesson_id,completed").eq("user_id", u.id)
          .then(function (r) {
            var o = {}; (r.data || []).forEach(function (row) { if (row.completed) o[row.lesson_id] = true; });
            return o;
          }).catch(function () { return {}; });
      });
    },

    // Označit lekci jako hotovou/nehotovou. product: 'academy'|'videokurz'.
    setDone: function (product, lessonId, done) {
      if (!LIVE) { var o = lsGet(); if (done) o[lessonId] = true; else delete o[lessonId]; lsSet(o); return Promise.resolve({ ok: true }); }
      return BA.getUser().then(function (u) {
        if (!u) return { ok: false, error: "not-signed-in" };
        if (done) {
          return client.from("progress").upsert({
            user_id: u.id, product: product, lesson_id: lessonId, completed: true, completed_at: new Date().toISOString()
          }).then(function (r) { return { ok: !r.error, error: r.error && r.error.message }; });
        }
        return client.from("progress").delete().eq("user_id", u.id).eq("lesson_id", lessonId)
          .then(function (r) { return { ok: !r.error, error: r.error && r.error.message }; });
      });
    },

    // Veřejné ověření certifikátu přes RPC. Live → řádek {cert_id, full_name,
    // program, issued_at, valid} nebo null. Demo → null (volající fallne na JSON).
    verifyCertificate: function (certId) {
      if (!LIVE) return Promise.resolve(null);
      return client.rpc("verify_certificate", { p_cert_id: certId })
        .then(function (r) { if (r.error) return null; return (r.data && r.data[0]) || null; })
        .catch(function () { return null; });
    },

    // Podepsaná (dočasná) URL k souboru v Supabase Storage — jen pro přihlášené
    // s přístupem (gating řeší RLS politika bucketu). Demo → null.
    materialUrl: function (bucket, path) {
      if (!LIVE) return Promise.resolve(null);
      return client.storage.from(bucket).createSignedUrl(path, 300)
        .then(function (r) { return (r && r.data && r.data.signedUrl) || null; })
        .catch(function () { return null; });
    },

    // Pohodlný gate pro stránku: když není přihlášen / nemá přístup, přesměruje.
    // V demo režimu nedělá nic (vše dostupné).
    requireAccess: function (product, redirectTo) {
      if (!LIVE) return Promise.resolve(true);
      return BA.getUser().then(function (u) {
        if (!u) { location.href = (redirectTo || "/akademie/prihlaseni/") + "?next=" + encodeURIComponent(location.pathname); return false; }
        return BA.hasEntitlement(product).then(function (has) {
          if (!has) { location.href = "/akademie/prihlaseni/?need=" + encodeURIComponent(product); return false; }
          return true;
        });
      });
    }
  };

  window.BA = BA;
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
