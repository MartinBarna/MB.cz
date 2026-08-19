/* Demo videa na /tvuj-coach/: poster v HTML, <video> až po kliknutí.
   Assety žijí na tvujcoach.cz, sem se nekopírují. */
(function () {
  var BASE = 'https://tvujcoach.cz/demo-videa';
  var root = document.getElementById('dv-grid');
  if (!root) return;

  var current = null;

  function stopCurrent() {
    if (!current) return;
    var video = current.video;
    var card = current.card;
    if (video) {
      video.pause();
      video.removeAttribute('src');
      video.load();
      if (video.parentNode) video.parentNode.removeChild(video);
    }
    if (card) card.classList.remove('is-playing');
    current = null;
  }

  function start(card) {
    if (current && current.card === card) return;
    stopCurrent();
    var id = card.getAttribute('data-dv-id');
    var frame = card.querySelector('.dv-frame');
    if (!id || !frame) return;
    var caption = card.querySelector('.dv-caption');
    var video = document.createElement('video');
    video.preload = 'none';
    video.controls = true;
    video.playsInline = true;
    video.setAttribute('preload', 'none');
    video.setAttribute('controls', '');
    video.setAttribute('playsinline', '');
    video.setAttribute('webkit-playsinline', '');
    video.src = BASE + '/' + id + '.mp4';
    video.poster = BASE + '/' + id + '-poster.jpg';
    video.setAttribute('aria-label', caption ? caption.textContent : id);
    frame.appendChild(video);
    card.classList.add('is-playing');
    current = { card: card, video: video };
    var playPromise = video.play();
    if (playPromise && playPromise.catch) playPromise.catch(function () {});
    video.addEventListener('ended', function () {
      /* Pozdní `ended` ze starého prvku nesmí zabít nově spuštěné video. */
      if (current && current.video === video) stopCurrent();
    });
  }

  root.addEventListener('click', function (e) {
    var btn = e.target.closest ? e.target.closest('.dv-playbtn') : null;
    if (!btn) return;
    var card = btn.closest('.dv-card');
    if (!card) return;
    start(card);
  });
})();
