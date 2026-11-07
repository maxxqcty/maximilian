/* Selected work: a floating preview card follows the cursor over the list
   (desktop), and each row draws its own thumbnail on phones. */
(function (App) {
  'use strict';

  const rows = App.$$('.row a');
  const preview = App.$('#preview');
  if (!rows.length || !preview) return;

  const PREVIEW_W = 600, PREVIEW_H = 420, THUMB = 176;      // canvas pixel sizes (2x the CSS size)
  const OFFSET_X = 56, OFFSET_Y = -105;                     // card position relative to the cursor

  const previewCtx = App.$('canvas', preview).getContext('2d');
  const caption = App.$('.cap', preview);
  const thumbs = rows.map(a => ({ key: a.dataset.art, ctx: App.$('.r-thumb', a).getContext('2d') }));

  /* one place decides which row (if any) the card shows */
  let activeRow = null;
  function show(row) {
    if (row === activeRow) return;
    activeRow = row;
    if (row) caption.textContent = row.dataset.caption;
    preview.classList.toggle('on', !!row);
  }

  rows.forEach(a => {
    a.addEventListener('pointerenter', () => show(a));
    a.addEventListener('pointerleave', () => { if (activeRow === a) show(null); });
  });

  /* Scrolling moves rows under a still mouse without firing pointerleave/enter,
     so the card stayed open. Re-check what is under the pointer whenever the page scrolls. */
  addEventListener('scroll', () => {
    if (!App.pointer.active) return;
    show(App.at(App.pointer.x, App.pointer.y).closest('.row a'));
  }, { passive: true });
  /* the pointer leaving the window also closes it */
  document.documentElement.addEventListener('mouseleave', () => show(null));

  let px = 0, py = 0;
  App.onFrame(t => {
    const time = App.reduce ? 0 : t;

    px += (App.pointer.x + OFFSET_X - px) * .14;
    py += (App.pointer.y + OFFSET_Y - py) * .14;
    preview.style.transform = `translate(${px}px, ${py}px)`;
    if (activeRow) App.drawArt(previewCtx, activeRow.dataset.art, time, PREVIEW_W, PREVIEW_H);

    // offsetParent is null while the thumbnail is hidden (desktop), so nothing is drawn then
    thumbs.forEach(th => { if (th.ctx.canvas.offsetParent) App.drawArt(th.ctx, th.key, time, THUMB, THUMB); });
  });
})(window.MAE);
