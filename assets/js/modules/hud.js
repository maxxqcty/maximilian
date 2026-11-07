/* HUD: page coordinates of the cursor (bottom left).
   The scroll position lives in the scroll ruler (scroll-ruler.js). */
(function (App) {
  'use strict';

  const coords = App.$('#coords');
  if (!coords) return;

  const pad = n => String(Math.max(0, Math.round(n))).padStart(4, '0');

  App.onFrame(() => {
    const { x, y } = App.pointer;
    coords.textContent = `X ${pad(x)} · Y ${pad(y + scrollY)}`;
  });
})(window.MAE);
