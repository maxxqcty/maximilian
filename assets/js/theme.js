/* ==========================================================================
   Theme: restores the saved light/dark choice before first paint and wires
   the toggle button. Loaded in <head> without `defer` so there is no flash
   of the wrong theme.

   Switching: where the browser supports View Transitions, the new theme is
   revealed as a circle growing out of the toggle button. Elsewhere, or with
   reduced motion, it switches instantly.
   ========================================================================== */
(function () {
  'use strict';

  const root = document.documentElement;
  const KEY = 'mae-theme';
  const DURATION = 750; // ms

  try {
    const saved = localStorage.getItem(KEY);
    if (saved === 'light' || saved === 'dark') root.dataset.theme = saved;
  } catch (e) { /* storage blocked: fall back to the OS setting */ }

  function nextTheme() {
    const isDark = root.dataset.theme
      ? root.dataset.theme === 'dark'
      : matchMedia('(prefers-color-scheme: dark)').matches;
    return isDark ? 'light' : 'dark';
  }

  function apply(theme) {
    root.dataset.theme = theme;
    try { localStorage.setItem(KEY, theme); } catch (e) { /* not saved, still switched */ }
  }

  document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('themeBtn');
    if (!btn) return;

    btn.addEventListener('click', () => {
      const theme = nextTheme();
      const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (!document.startViewTransition || reduce) { apply(theme); return; }

      // circle centre: the button; radius: far enough to reach the furthest corner
      const b = btn.getBoundingClientRect();
      const x = b.left + b.width / 2, y = b.top + b.height / 2;
      const r = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));

      root.classList.add('theme-switching');
      const vt = document.startViewTransition(() => apply(theme));
      vt.ready.then(() => {
        root.animate(
          { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] },
          { duration: DURATION, easing: 'cubic-bezier(.7, 0, .2, 1)', pseudoElement: '::view-transition-new(root)' }
        );
      }).catch(() => {});
      vt.finished.finally(() => root.classList.remove('theme-switching'));
    });
  });
})();
