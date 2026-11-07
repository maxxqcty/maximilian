/* Languages: a small tooltip with the exact code size follows the cursor
   over each language row. Everything it shows is also readable in the row. */
(function (App) {
  'use strict';

  const rows = App.$$('.lang');
  if (!rows.length) return;

  const tip = document.createElement('div');
  tip.className = 'lang-tip mono';
  tip.setAttribute('aria-hidden', 'true');
  document.body.appendChild(tip);

  const kb = bytes => Math.round(bytes / 1000).toLocaleString('en-US') + ' KB';

  rows.forEach(row => {
    row.addEventListener('pointerenter', () => {
      const { name, bytes, repos } = row.dataset;
      tip.textContent = `${name} · ${kb(+bytes)} of code · ${repos} repos`;
      tip.classList.add('on');
    });
    row.addEventListener('pointerleave', () => tip.classList.remove('on'));
    row.addEventListener('pointermove', e => {
      // keep the tooltip on screen near the right edge
      const x = Math.min(e.clientX + 18, innerWidth - tip.offsetWidth - 12);
      tip.style.transform = `translate(${x}px, ${e.clientY + 18}px)`;
    });
  });
})(window.MAE);
