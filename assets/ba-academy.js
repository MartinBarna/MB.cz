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
  // Aktivita pro gamifikaci (streak / týdenní cíl): pole dat "YYYY-MM-DD".
  var ACT_KEY = "ba_activity_v1";
  function actGet() { try { return JSON.parse(localStorage.getItem(ACT_KEY) || "[]"); } catch (e) { return []; } }
  function actStamp() { try { var a = actGet(); var d = new Date().toISOString().slice(0, 10); if (a.indexOf(d) < 0) { a.push(d); localStorage.setItem(ACT_KEY, JSON.stringify(a)); } } catch (e) {} }

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

    // Zapomenuté heslo: pošle e-mail s odkazem na nastavení nového hesla.
    // Odkaz vede na /akademie/nove-heslo/, kde stránka zavolá updatePassword.
    resetPassword: function (email) {
      if (!LIVE) return Promise.resolve({ ok: true, demo: true });
      // Kanonický non-www cíl — stejný důvod jako u signInWithOtp (session je per-origin).
      var dest = (location.origin + "/akademie/nove-heslo/").replace("://www.", "://");
      return client.auth.resetPasswordForEmail(email, { redirectTo: dest })
        .then(function (r) { return { ok: !r.error, error: r.error && r.error.message }; })
        .catch(function (e) { return { ok: false, error: String(e && e.message || e) }; });
    },

    // Nastavení nového hesla přihlášeného uživatele (typicky po recovery odkazu,
    // kdy detectSessionInUrl ustaví session z URL hashe).
    updatePassword: function (newPassword) {
      if (!LIVE) return Promise.resolve({ ok: true, demo: true });
      return client.auth.updateUser({ password: newPassword })
        .then(function (r) { return { ok: !r.error, error: r.error && r.error.message }; })
        .catch(function (e) { return { ok: false, error: String(e && e.message || e) }; });
    },

    // Má uživatel zaplacený přístup k produktu? ('academy' | 'videokurz')
    // Demo režim vrací true (kvůli vývoji).
    hasEntitlement: function (product) {
      if (!LIVE) return Promise.resolve(true);
      return client.rpc("has_entitlement", { p_product: product })
        .then(function (r) { return !r.error && r.data === true; })
        .catch(function () { return false; });
    },

    // Přihlašovací token (JWT) pro autorizované volání edge funkcí (např. AI Martin).
    getToken: function () {
      if (!LIVE) return Promise.resolve(null);
      return client.auth.getSession()
        .then(function (r) { return (r && r.data && r.data.session && r.data.session.access_token) || null; })
        .catch(function () { return null; });
    },

    // YouTube ID lekce videokurzu z manifestu v DB. RLS: free lekce čte kdokoliv,
    // placené jen přihlášený s aktivním přístupem (has_entitlement) — ID placených
    // videí tak nejsou ve statickém HTML.
    getVideoId: function (slug) {
      if (!LIVE) return Promise.resolve(null);
      return client.from("videokurz_manifest").select("youtube_id").eq("slug", slug).maybeSingle()
        .then(function (r) { return (r.data && r.data.youtube_id) || null; })
        .catch(function () { return null; });
    },

    // Obsah placené lekce z DB. RLS: čte jen přihlášený s aktivním přístupem
    // (has_entitlement) — text lekcí tak není ve statickém HTML ani pro curl.
    getLessonHtml: function (lessonId) {
      if (!LIVE) return Promise.resolve(null);
      return client.from("lesson_content").select("html").eq("lesson_id", lessonId).maybeSingle()
        .then(function (r) { return (r.data && r.data.html) || null; })
        .catch(function () { return null; });
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

    // Data studijní aktivity ("YYYY-MM-DD") pro streak + týdenní cíl.
    // Live → z progress.completed_at; demo → z localStorage ba_activity_v1.
    getActivityDates: function () {
      if (!LIVE) return Promise.resolve(actGet());
      return BA.getUser().then(function (u) {
        if (!u) return actGet();
        return client.from("progress").select("completed_at").eq("user_id", u.id)
          .then(function (r) { var out = []; (r.data || []).forEach(function (row) { if (row.completed_at) out.push(String(row.completed_at).slice(0, 10)); }); return out; })
          .catch(function () { return []; });
      });
    },

    // Označit lekci jako hotovou/nehotovou. product: 'academy'|'videokurz'.
    setDone: function (product, lessonId, done) {
      if (!LIVE) { var o = lsGet(); if (done) { o[lessonId] = true; actStamp(); } else delete o[lessonId]; lsSet(o); return Promise.resolve({ ok: true }); }
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

    // Vystavení certifikátu přihlášenému členovi (RPC ověří přístup + dokončení
    // server-side, 1 certifikát/uživatele, idempotentní). Live → {ok, cert_id,
    // full_name, issued_at} nebo {ok:false, error}. Demo → simulovaný náhled.
    issueCertificate: function (fullName) {
      if (!LIVE) return Promise.resolve({ ok: true, demo: true, cert_id: "BA-DEMO-0001", full_name: fullName || "Jméno Příjmení", issued_at: new Date().toISOString() });
      return client.rpc("issue_certificate", { p_full_name: fullName }).then(function (r) {
        if (r.error) return { ok: false, error: r.error.message };
        var row = (r.data && r.data[0]) || null;
        return row ? { ok: true, cert_id: row.cert_id, full_name: row.full_name, issued_at: row.issued_at } : { ok: false, error: "no-row" };
      }).catch(function (e) { return { ok: false, error: String(e && e.message || e) }; });
    },

    // Admin (Martin) vystaví certifikát studentovi po schválení Mistrovské pečeti.
    // Live → {ok, cert_id, full_name, issued_at} nebo {ok:false, error}.
    adminIssueCertificate: function (userId, email, fullName) {
      if (!LIVE) return Promise.resolve({ ok: true, demo: true, cert_id: "BA-DEMO-0001" });
      return client.rpc("admin_issue_certificate", { p_user_id: userId, p_email: email, p_full_name: fullName }).then(function (r) {
        if (r.error) return { ok: false, error: r.error.message };
        var row = (r.data && r.data[0]) || null;
        return row ? { ok: true, cert_id: row.cert_id, full_name: row.full_name, issued_at: row.issued_at } : { ok: false, error: "no-row" };
      }).catch(function (e) { return { ok: false, error: String(e && e.message || e) }; });
    },

    // Uloží pokus o závěrečný test (skóre + konkrétní odpovědi) pro učitelský detail.
    // data: { score, total, passed, answers:[{q,a,correct,ok}], full_name }. Best-effort.
    saveTestAttempt: function (data) {
      if (!LIVE) return Promise.resolve({ ok: true, demo: true });
      return client.rpc("save_test_attempt", {
        p_score: data.score, p_total: data.total, p_passed: !!data.passed,
        p_answers: data.answers || [], p_full_name: data.full_name || null
      }).then(function (r) { return { ok: !r.error, id: r.data, error: r.error && r.error.message }; })
        .catch(function (e) { return { ok: false, error: String(e && e.message || e) }; });
    },
    // Admin (Martin): všechny pokusy o test přes RLS admin-policy. Ostatním prázdno.
    getTestAttempts: function () {
      if (!LIVE) return Promise.resolve([]);
      return client.from("test_attempts").select("*").order("created_at", { ascending: false })
        .then(function (r) { return r.data || []; }).catch(function () { return []; });
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
        // I host (nepřihlášený) dostane need=<product> — login stránka pak ukáže
        // nákupní hlášku místo holého formuláře (host z free lekce = nejteplejší moment).
        if (!u) { location.href = (redirectTo || "/akademie/prihlaseni/") + "?next=" + encodeURIComponent(location.pathname) + "&need=" + encodeURIComponent(product); return false; }
        return BA.hasEntitlement(product).then(function (has) {
          if (!has) { location.href = "/akademie/prihlaseni/?need=" + encodeURIComponent(product); return false; }
          return true;
        });
      });
    },

    // ---- Týdenní check-in (koučovací klienti): 1 záznam/ISO-týden, věrnostní sleva ----
    _isoWeek: function () {
      var dt = new Date();
      var d = new Date(Date.UTC(dt.getFullYear(), dt.getMonth(), dt.getDate()));
      var dayNum = (d.getUTCDay() + 6) % 7;            // Po=0 … Ne=6
      d.setUTCDate(d.getUTCDate() - dayNum + 3);       // nejbližší čtvrtek určuje ISO rok
      var firstThu = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
      var w = 1 + Math.round(((d - firstThu) / 864e5 - 3 + ((firstThu.getUTCDay() + 6) % 7)) / 7);
      return d.getUTCFullYear() + "-W" + (w < 10 ? "0" + w : "" + w);
    },
    // Uloží/aktualizuje check-in za aktuální ISO-týden (upsert dle user_id+iso_week).
    saveCheckin: function (data) {
      if (!LIVE) return Promise.resolve({ ok: true, demo: true });
      return BA.getUser().then(function (u) {
        if (!u) return { ok: false, error: "not-signed-in" };
        var row = {
          user_id: u.id, email: u.email, iso_week: BA._isoWeek(),
          weight_kg: data.weight_kg, plan_adherence_pct: data.plan_adherence_pct,
          energy: data.energy, sleep: data.sleep, cravings: data.cravings,
          workouts_done: data.workouts_done, workouts_planned: data.workouts_planned,
          win_text: data.win_text || null, struggle_text: data.struggle_text || null,
          updated_at: new Date().toISOString()
        };
        return client.from("checkins").upsert(row, { onConflict: "user_id,iso_week" })
          .then(function (r) { return { ok: !r.error, error: r.error && r.error.message }; });
      });
    },
    // Posledních N vlastních check-inů (pro trend a „zkopírovat z minula").
    getCheckins: function (limit) {
      if (!LIVE) return Promise.resolve([]);
      return BA.getUser().then(function (u) {
        if (!u) return [];
        return client.from("checkins").select("*").eq("user_id", u.id)
          .order("created_at", { ascending: false }).limit(limit || 12)
          .then(function (r) { return r.data || []; }).catch(function () { return []; });
      });
    },
    // Streak + věrnostní sleva (RPC počítá logiku; bez argumentu = přihlášený uživatel).
    getLoyalty: function () {
      if (!LIVE) return Promise.resolve({ streak: 0, loyalty_pct: 0, weeks_total: 0 });
      return client.rpc("checkin_loyalty").then(function (r) {
        return (!r.error && r.data && r.data[0]) || { streak: 0, loyalty_pct: 0, weeks_total: 0 };
      }).catch(function () { return { streak: 0, loyalty_pct: 0, weeks_total: 0 }; });
    },
    // Admin (Martin): všechny check-iny přes RLS admin-policy. Ostatním vrátí prázdno.
    // ISO tyden pro LIBOVOLNE datum, stejny format jako _isoWeek() vyse ("2026-W30").
    _isoWeekOf: function (iso) {
      var dt = new Date(iso + "T12:00:00Z");
      if (isNaN(dt.getTime())) return "";
      var d = new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate()));
      var dayNum = (d.getUTCDay() + 6) % 7;
      d.setUTCDate(d.getUTCDate() - dayNum + 3);
      var firstThu = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
      var w = 1 + Math.round(((d - firstThu) / 864e5 - 3 + ((firstThu.getUTCDay() + 6) % 7)) / 7);
      return d.getUTCFullYear() + "-W" + (w < 10 ? "0" + w : "" + w);
    },
    // POZOR: reporty klientu leti do "client_reports", NE do "checkins". Tabulka "checkins"
    // je pozustatek formulare, ktery se nakonec nepouziva, a je trvale prazdna. Prehled pro
    // kouce proto do 20. 7. 2026 ukazoval nuly, i kdyz klienti reporty poctive posilali.
    // Tvary obou tabulek se lisi, takze tady prevadime na to, co prehled ocekava.
    getAllCheckins: function () {
      if (!LIVE) return Promise.resolve([]);
      var self = this;
      return client.from("client_reports").select("*").order("report_date", { ascending: false })
        .then(function (r) {
          function num(v) {
            if (v === null || v === undefined || v === "") return null;
            var n = Number(String(v).replace(",", "."));
            return isFinite(n) ? n : null;
          }
          return (r.data || []).map(function (row) {
            var s = row.scales || {}, ac = row.activity || {}, nt = row.notes || {};
            var adh = num(s.dodrzeni); // skala 1 az 5 -> procenta, at sedi prah "adherence < 60 %"
            return {
              email: row.email,
              user_id: row.email,            // client_reports nema user_id, seskupuje se podle e-mailu
              created_at: row.created_at,
              iso_week: self._isoWeekOf(row.report_date),
              weight_kg: num(row.weight),
              plan_adherence_pct: adh == null ? null : Math.round(adh * 20),
              energy: num(s.sila),           // "sila" je nejblizsi tomu, co prehled zove energii
              sleep: num(s.spanek_kvalita),
              cravings: num(s.hlad),
              workouts_done: num(ac.fitko),
              workouts_planned: null,        // formular planovany pocet treninku nesbira
              win_text: nt.povedlo || "",
              struggle_text: nt.drhlo || ""
            };
          });
        }).catch(function () { return []; });
    }
  };

  window.BA = BA;
  // ---- upsell podle vlastnictvi ---------------------------------
  // Free ukazkove lekce maji v HTML vyzvu k nakupu (spravne pro navstevnika bez pristupu).
  // Kdo produkt UZ MA, nesmi videt "Odemknout za 8 900 / 800 Kc" u obsahu, ktery vlastni.
  // Prvky jsou znacene atributem data-upsell="academy" | "videokurz".
  function hideOwnedUpsells() {
    var els = document.querySelectorAll("[data-upsell]");
    if (!els.length) { showUpsells(); return; }
    var produkty = {};
    for (var i = 0; i < els.length; i++) produkty[els[i].getAttribute("data-upsell")] = 1;
    var jmena = Object.keys(produkty);
    Promise.all(jmena.map(function (p) {
      return BA.hasEntitlement(p).then(function (ma) { return { p: p, ma: ma }; })
        .catch(function () { return { p: p, ma: false }; });
    })).then(function (vysledky) {
      vysledky.forEach(function (v) {
        if (!v.ma) return;
        var vlastnene = document.querySelectorAll('[data-upsell="' + v.p + '"]');
        for (var j = 0; j < vlastnene.length; j++) vlastnene[j].style.display = "none";
      });
    }).catch(function () { /* pri chybe radeji upsell ukazat nez skryt obsah */ })
      .then(showUpsells);
  }

  // Proti probliknuti: prihlasenemu uzivateli upsell docasne skryjeme, nez overime pristup.
  // Nepřihlaseny (tedy vetsina navstevniku free ukazek) vidi upsell hned, bez zpozdeni.
  function hideUpsellsWhileChecking() {
    try {
      var maSession = false;
      for (var i = 0; i < localStorage.length; i++) {
        if (/^sb-.*-auth-token$/.test(localStorage.key(i))) { maSession = true; break; }
      }
      if (!maSession) return;
      var st = document.createElement("style");
      st.id = "ba-upsell-check";
      st.textContent = "[data-upsell]{visibility:hidden}";
      (document.head || document.documentElement).appendChild(st);
      setTimeout(showUpsells, 3000); // pojistka, kdyby overeni nedobehlo
    } catch (e) { /* bez localStorage proste neskryvame */ }
  }
  function showUpsells() {
    var st = document.getElementById("ba-upsell-check");
    if (st && st.parentNode) st.parentNode.removeChild(st);
  }

  hideUpsellsWhileChecking();
  ready.then(hideOwnedUpsells);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
