/* Barna Academy — audio přehrávač lekcí.
   Tlačítko „Poslechnout lekci". Priorita: předgenerovaná MP3 (přirozený hlas),
   fallback: hlas prohlížeče (Web Speech API, cs-CZ). Žádná závislost, fail-safe.

   Důležité opravy:
   - Klik spouští předčítání PŘÍMO v rámci user-gesture (jinak ho prohlížeč zablokuje).
     MP3 se zkouší jen když opravdu existuje (zjištěno předem z manifestu),
     takže neexistující MP3 (404) už nerozbije fallback.
   - Dlouhý text se čte po větách → obchází ~15s limit Chrome i délkový strop
     jedné promluvy (dlouhá lekce se teď přečte celá).
   - Český hlas se dobere i když ho prohlížeč načte se zpožděním (voiceschanged). */
(function () {
  try {
    var wrap = document.querySelector('.wrap');
    if (!wrap) return;
    var h1 = wrap.querySelector('h1');
    if (!h1) return;

    // Posbírej čitelný text lekce (vynech kvíz, navigaci a audio lištu),
    // rozsekaný na krátké věty kvůli limitům prohlížečů.
    function collectChunks() {
      var raw = [];
      var nodes = wrap.querySelectorAll('h1, h2, p, li, blockquote, .eq');
      Array.prototype.forEach.call(nodes, function (n) {
        if (n.closest && (n.closest('.quiz') || n.closest('.la-bar') || n.closest('.lessnav') || n.closest('.lesson-nav') || n.closest('.src') || n.closest('.done-row'))) return;
        var t = (n.textContent || '').replace(/\s+/g, ' ').trim();
        if (t) raw.push(t);
      });
      var chunks = [];
      raw.forEach(function (t) {
        // rozděl dlouhé bloky na věty (~220 znaků max na promluvu)
        if (t.length <= 220) { chunks.push(t); return; }
        var sentences = t.match(/[^.!?]+[.!?]*\s*/g) || [t];
        var buf = '';
        sentences.forEach(function (s) {
          if ((buf + s).length > 220 && buf) { chunks.push(buf.trim()); buf = ''; }
          buf += s;
        });
        if (buf.trim()) chunks.push(buf.trim());
      });
      return chunks;
    }

    // MP3 cesta z URL lekce: /akademie/studium/m1-l1/ -> /assets/audio/akademie/m1-l1.mp3
    function lessonId() {
      var m = location.pathname.match(/\/akademie\/(?:studium|videokurz)\/([a-z0-9-]+)\/?$/i);
      return m ? m[1] : null;
    }
    var LID = lessonId();
    var mp3Url = null; // nastaví se jen když MP3 reálně existuje (z manifestu)

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
    var chunks = [], idx = 0, voice = null;

    function lblText(t) { lbl.textContent = t; }
    function onState() { lblText('Pozastavit'); btn.classList.add('on'); playing = true; }
    function offState(t) { lblText(t || 'Pokračovat'); btn.classList.remove('on'); playing = false; }
    function reset() { started = false; mode = null; idx = 0; offState('Poslechnout lekci'); }

    // ---- TTS (hlas prohlížeče), čtený po větách ----
    function pickVoice() {
      if (!('speechSynthesis' in window)) return null;
      var voices = window.speechSynthesis.getVoices() || [];
      var cz = voices.filter(function (v) { return /cs[-_]?cz|czech|česk/i.test((v.lang || '') + ' ' + (v.name || '')); });
      return cz.length ? cz[0] : null;
    }

    function speakNext() {
      if (!playing) return;
      if (idx >= chunks.length) { reset(); return; }
      var u = new SpeechSynthesisUtterance(chunks[idx]);
      u.lang = 'cs-CZ'; u.rate = 1; u.pitch = 1;
      if (voice) u.voice = voice;
      u.onend = function () { idx++; if (playing) speakNext(); };
      u.onerror = function () { idx++; if (playing) speakNext(); };
      window.speechSynthesis.speak(u);
    }

    function startTts() {
      mode = 'tts';
      if (!('speechSynthesis' in window)) { note.textContent = 'Tvůj prohlížeč zatím neumí předčítání. Přirozená audio verze přibývá.'; reset(); return; }
      chunks = collectChunks(); idx = 0;
      if (!chunks.length) { note.textContent = 'Tady zatím není co předčítat.'; reset(); return; }
      voice = pickVoice();
      if (!voice) note.textContent = '💡 Tvoje zařízení nemá nainstalovaný český hlas — předčítá se náhradním hlasem. Přirozená namluvená verze přibývá.';
      window.speechSynthesis.cancel();
      started = true; onState();
      speakNext();
    }

    // ---- MP3 (až bude existovat) ----
    function startMp3() {
      mode = 'mp3';
      audioEl = new Audio(mp3Url);
      audioEl.addEventListener('ended', reset);
      audioEl.addEventListener('error', function () { audioEl = null; startTts(); });
      audioEl.play().then(function () { started = true; onState(); })
        .catch(function () { audioEl = null; startTts(); });
    }

    btn.addEventListener('click', function () {
      if (!started) {
        note.textContent = '';
        if (mp3Url) startMp3(); else startTts();
        return;
      }
      if (mode === 'mp3' && audioEl) {
        if (playing) { audioEl.pause(); offState(); } else { audioEl.play(); onState(); }
        return;
      }
      if (mode === 'tts' && 'speechSynthesis' in window) {
        if (playing) {
          window.speechSynthesis.pause(); offState();
        } else {
          // Chrome občas „zapomene" resume — pojistka: když se do chvilky nerozjede, čti dál ručně.
          onState();
          window.speechSynthesis.resume();
          var resumeIdx = idx;
          setTimeout(function () {
            if (playing && window.speechSynthesis && !window.speechSynthesis.speaking && idx === resumeIdx) speakNext();
          }, 250);
        }
      }
    });

    window.addEventListener('beforeunload', function () {
      try { if (window.speechSynthesis) window.speechSynthesis.cancel(); if (audioEl) audioEl.pause(); } catch (e) {}
    });

    // Načti hlasy (některé prohlížeče je doplní později).
    if ('speechSynthesis' in window) {
      try { window.speechSynthesis.getVoices(); } catch (e) {}
      window.speechSynthesis.onvoiceschanged = function () { voice = pickVoice(); };
    }
    // Pozn.: zatím žádné předgenerované MP3 neexistují → klik jde rovnou na předčítání
    // prohlížečem (uvnitř user-gesture). Až dorazí ElevenLabs pipeline, tady se doplní
    // detekce MP3 (mp3Url) a tlačítko se samo přepne na přirozený hlas.
  } catch (e) { /* fail-safe: audio nikdy nesmí shodit lekci */ }
})();
