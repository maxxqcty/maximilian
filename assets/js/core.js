/* ==========================================================================
   Core: shared state and one animation loop that every module plugs into.
   Loaded first. Modules attach themselves to window.MAE.

   Plain scripts (not ES modules) on purpose: ES modules are blocked when
   index.html is opened straight from disk, and this site should work by
   double-clicking it.
   ========================================================================== */
(function () {
  'use strict';

  const root = document.documentElement;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* pointer position in viewport pixels; `active` stays false until the mouse first moves */
  const pointer = { x: -9999, y: -9999, active: false };
  addEventListener('pointermove', e => {
    pointer.x = e.clientX; pointer.y = e.clientY; pointer.active = true;
  }, { passive: true });

  /* theme colours for canvas drawing, cached and re-read when the theme changes */
  let tokens = null;
  const readTokens = () => {
    const cs = getComputedStyle(root), get = n => cs.getPropertyValue(n).trim();
    tokens = { ink: get('--ink'), paper: get('--paper'), paper2: get('--paper-2'), accent: get('--accent') };
  };
  new MutationObserver(() => { tokens = null; }).observe(root, { attributes: true, attributeFilter: ['data-theme'] });
  matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => { tokens = null; });

  /* one requestAnimationFrame loop; modules register a callback that receives seconds since start */
  const frameHandlers = [];

  window.MAE = {
    root,
    reduce,
    pointer,
    $: (sel, ctx = document) => ctx.querySelector(sel),
    $$: (sel, ctx = document) => [...ctx.querySelectorAll(sel)],
    tokens: () => tokens || (readTokens(), tokens),
    /* element under a viewport point. Needed after scrolling: content moving under a
       still mouse fires no pointerover/pointerleave, so hover state must be re-checked. */
    at: (x, y) => document.elementFromPoint(x, y) || document.body,
    onFrame: fn => { frameHandlers.push(fn); },
    start() {
      const t0 = performance.now();
      const tick = now => {
        // the first frame's timestamp can be earlier than t0, so clamp: negative time broke modulo-based animations
        const t = Math.max(0, (now - t0) / 1000);
        for (const fn of frameHandlers) fn(t);
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    },
  };
})();
