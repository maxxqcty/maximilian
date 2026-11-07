/* Grid: the 12 content columns live inside the centred container, so on wide
   screens the lines stopped at its edges. This repeats the same column width and
   spacing outward until it reaches both edges of the window. Loaded before
   background.js, which reads every visible column to place its scan pulses. */
(function (App) {
  'use strict';

  const host = App.$('.grid-bg');
  if (!host) return;

  const ext = document.createElement('div');
  ext.className = 'grid-ext';
  host.appendChild(ext);

  function build() {
    const cols = App.$$('.grid-bg .wrap span').map(s => s.getBoundingClientRect()).filter(r => r.width > 0);
    ext.textContent = '';
    if (cols.length < 2) return;

    const width = cols[0].width;
    const pitch = cols[1].left - cols[0].left;          // column width + gutter
    const frag = document.createDocumentFragment();
    const add = (left, step) => {
      const s = document.createElement('span');
      s.style.left = left + 'px';
      s.style.width = width + 'px';
      s.style.setProperty('--i', cols.length + step);    // continues the draw-in stagger outward
      frag.appendChild(s);
    };

    for (let x = cols[0].left - pitch, k = 1; x + width > 0; x -= pitch, k++) add(x, k);
    const last = cols[cols.length - 1];
    for (let x = last.left + pitch, k = 1; x < innerWidth; x += pitch, k++) add(x, k);
    ext.appendChild(frag);
  }

  build();
  (document.fonts?.ready || Promise.resolve()).then(build);
  let t;
  addEventListener('resize', () => { clearTimeout(t); t = setTimeout(build, 100); });
})(window.MAE);
