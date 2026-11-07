/* Portrait parallax: the photo and the accent disc drift in opposite
   directions with the cursor. Uses the `translate` property so it never
   fights the CSS load animation, which uses `transform`. */
(function (App) {
  'use strict';

  const img = App.$('#portraitImg');
  const disc = App.$('.portrait .disc');
  if (!img || !disc || App.reduce) return;

  let px = 0, py = 0;

  App.onFrame(() => {
    if (!App.pointer.active) return;
    const tx = App.pointer.x / innerWidth - .5;
    const ty = App.pointer.y / innerHeight - .5;
    px += (tx - px) * .06;
    py += (ty - py) * .06;
    img.style.translate = `${px * 14}px ${py * 8}px`;
    disc.style.translate = `${px * -22}px ${py * -14}px`;
  });
})(window.MAE);
