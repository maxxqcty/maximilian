/* Hero name: splits the heading into letters (words stay unbreakable) and
   makes each letter heavier and narrower as the cursor comes near. */
(function (App) {
  'use strict';

  const name = App.$('#name');
  if (!name) return;

  const RADIUS = 380;   // px: how far the cursor's influence reaches
  const EASE = .15;     // how quickly letters follow (0-1)

  const words = name.textContent.trim().split(/\s+/);
  name.textContent = '';
  let index = 0;
  words.forEach((word, wi) => {
    const wrap = document.createElement('span');
    wrap.className = 'word';
    wrap.setAttribute('aria-hidden', 'true'); // the h1 keeps an aria-label with the full name
    for (const c of word) {
      const ch = document.createElement('span');
      ch.className = 'ch';
      ch.textContent = c;
      ch.style.setProperty('--i', index++);
      wrap.appendChild(ch);
    }
    name.appendChild(wrap);
    if (wi < words.length - 1) name.appendChild(document.createTextNode(' '));
  });

  const letters = App.$$('.ch', name);
  const weight = letters.map(() => 0);

  App.onFrame(() => {
    const { x, y } = App.pointer;
    letters.forEach((ch, i) => {
      const r = ch.getBoundingClientRect();
      const d = Math.hypot(x - (r.left + r.width / 2), y - (r.top + r.height / 2));
      weight[i] += (Math.max(0, 1 - d / RADIUS) - weight[i]) * EASE;
      const k = weight[i];
      ch.style.fontVariationSettings = `"wght" ${Math.round(300 + k * 500)}, "wdth" ${Math.round(85 - k * 10)}, "opsz" 96`;
    });
  });
})(window.MAE);
