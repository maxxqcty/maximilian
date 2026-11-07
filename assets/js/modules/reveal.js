/* Reveal: elements with .reveal slide up as they scroll into view.
   They are fully visible without this script; it only adds motion. */
(function (App) {
  'use strict';

  if (App.reduce || !('IntersectionObserver' in window)) return;

  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      // only animate things entering from below, not what is already on screen at load
      if (e.isIntersecting && e.boundingClientRect.top > innerHeight * .5) {
        e.target.classList.add('in');
        io.unobserve(e.target);
      }
    });
  }, { threshold: .1 });

  App.$$('.reveal').forEach(el => io.observe(el));
})(window.MAE);
