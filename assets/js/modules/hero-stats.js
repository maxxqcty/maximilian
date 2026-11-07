/* Hero stats: each [data-count] figure counts up from zero once the hero has
   loaded in. The final number is already in the markup, so without this
   script (or with reduced motion) the figures simply show as written. */
(function (App) {
  'use strict';

  const figures = App.$$('.hero-stats [data-count]');
  if (!figures.length || App.reduce) return;

  const DELAY = 1150, DURATION = 1400;   // ms: starts as the stats row fades in
  const easeOut = x => 1 - Math.pow(1 - x, 3);

  figures.forEach(el => { el.textContent = '0'; });
  const t0 = performance.now() + DELAY;

  function step(now) {
    const k = Math.min(1, Math.max(0, (now - t0) / DURATION));
    figures.forEach(el => { el.textContent = Math.round(easeOut(k) * +el.dataset.count); });
    if (k < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
})(window.MAE);
