/* Barna Academy — audio přehrávač lekcí.
   Tlačítko „Poslechnout lekci". Priorita: předgenerovaná MP3 (přirozený hlas),
   fallback: hlas prohlížeče (Web Speech API, cs-CZ). Žádná závislost, fail-safe. */
(function () {
  try {
    var wrap = document.querySelector('.wrap');
    if (!wrap) return;
    var h1 = wrap.querySelector('h1');
    if (!h1) return;

    // Posbírej čitelný text lekce (vynech kvíz, navigaci a audio lištu).
    function collectText() {
      var parts = [];
      var nodes = wrap.querySelectorAll('h1, h2, p, li, blockquote, .eq');
      Array.prototype.forEach.call(nodes, function (n) {
        if (n.closest && (n.closest('.quiz') || n.closest('.la-bar') || n.closest('.lessnav'))) return;
        var t = (n.textContent || '').replace(/\s+/g, ' ').trim();
        if (t) parts.push(t);
      });
      return parts.join('. ');
    }

    // MP3 cesta z URL lekce: /akademie/studium/m1-l1/ -> /assets/audio/akademie/m1-l1.mp3
    function mp3Url() {
      var m = location.pathname.match(/\/akademie\/(?:studium|videokurz)\/([a-z0-9-]+)\/?$/i);
      return m ? '/assets/audio/akademie/' + m[1] + '.mp3' : null;
    }

    var st = document.createElement('style');
    st.textContent =
      '.la-bar{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin:-.4rem 0 1.6rem}' +
      '.la-btn{display:inline-flex;align-items:center;gap:8px;background:linear-gradient(145deg,var(--gold-2,#ff9d3c),var(--gold,#ff7a00));color:#160d04;border:none;font-weight:700;font-size:.92rem;padding:10px 18px;border-radius:50px;cursor:pointer;font-family:inherit;transition:transform .15s,box-shadow .15s;box-shadow:0 6px 16px rgba(255,122,0,.18)}' +
      '.la-btn:hover{transform:translateY(-1px)}.la-btn.on{box-shadow:0 0 0 3px rgba(255,122,0,.22)}' +
      '.la-note{font-size:.78rem;color:var(--muted,#9a948c);max-width:340px;line-height:1.4}';
    document.head.appendChild(st);

    var bar = document.createElement('div');
    bar.className = 'la-bar';
    bar.innerHTML = '<button type="button" class="la-btn"><span class="la-ic">🔊</span> <span class="la-lbl">Poslechnout lekci</span></button><span class="la-note"></span>';
    h1.parentNode.insertBefore(bar, h1.nextSibling);
    var btn = bar.querySelector('.la-btn'), lbl = bar.querySelector('.la-lbl'), note = bar.querySelector('.la-note');

    var audioEl = null, mode = null, playing = false, started = false;
    var url = mp3Url();

    function lblText(t) { lbl.textContent = t; }
    function onState() { lblText('Pozastavit'); btn.classList.add('on'); playing = true; }
    function offState(t) { lblText(t || 'Pokračovat'); btn.classList.remove('on'); playing = false; }
    function reset() { started = false; mode = null; offState('Poslechnout lekci'); }

    function startTts() {
      mode = 'tts';
      if (!('speechSynthesis' in window)) { note.textContent = 'Tvůj prohlížeč zatím neumí předčítání. Přirozená audio verze přibývá.'; reset(); return; }
      var u = new SpeechSynthesisUtterance(collectText());
      u.lang = 'cs-CZ'; u.rate = 1; u.pitch = 1;
      var voices = window.speechSynthesis.getVoices() || [];
      var cz = voices.filter(function (v) { return /cs|cz|czech|česk/i.test((v.lang || '') + (v.name || '')); });
      if (cz.length) u.voice = cz[0];
      else note.textContent = '💡 Tvoje zařízení nemá český hlas — přirozená namluvená verze přibývá.';
      u.onend = reset;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
      started = true; onState();
    }

    function startMp3() {
      mode = 'mp3';
      audioEl = new Audio(url);
      audioEl.addEventListener('ended', reset);
      audioEl.addEventListener('error', function () { audioEl = null; startTts(); });
      audioEl.play().then(function () { started = true; onState(); })
        .catch(function () { audioEl = null; startTts(); });
    }

    btn.addEventListener('click', function () {
      if (!started) { note.textContent = ''; if (url) startMp3(); else startTts(); return; }
      if (mode === 'mp3' && audioEl) {
        if (playing) { audioEl.pause(); offState(); } else { audioEl.play(); onState(); }
        return;
      }
      if (mode === 'tts' && 'speechSynthesis' in window) {
        if (playing) { window.speechSynthesis.pause(); offState(); } else { window.speechSynthesis.resume(); onState(); }
      }
    });

    window.addEventListener('beforeunload', function () {
      try { if (window.speechSynthesis) window.speechSynthesis.cancel(); if (audioEl) audioEl.pause(); } catch (e) {}
    });
    // voiceschanged: některé prohlížeče načtou hlasy až později
    if ('speechSynthesis' in window) { try { window.speechSynthesis.getVoices(); } catch (e) {} }
  } catch (e) { /* fail-safe: audio nikdy nesmí shodit lekci */ }
})();
