/* ==========================================================================
   Liquid cursor (mouse and trackpad only)
   - The head runs on a damped spring, so it overshoots and wobbles.
   - A chain of drops follows the head; the SVG goo filter melts them into
     one stretching shape.
   - Over any element the layer inverts (see cursor.css).
   - Clicking throws droplets that are pulled back in.
   - The crosshair always marks the exact pointer.
   ========================================================================== */
(function (App) {
  'use strict';

  const layer = App.$('#cur');
  const blobs = App.$('#curBlobs');
  const cross = App.$('#curX');
  const label = App.$('#curLabel');
  if (!layer || !blobs || !cross || !label) return;

  /* ---------- tuning ---------- */
  const SIZE = { none: 16, text: 34, link: 30, view: 46, lens: 68 }; // blob radius per hover state (px)
  const TAIL = 14;              // drops in the tail
  const SPRING = .3, DAMP = .6; // head spring stiffness and damping
  const TETHER = 40;            // max distance (px) between blob centre and pointer...
  const CROSS_CLEAR = 9;        // ...and never so far that the crosshair (6px arms) pokes out of the blob
  const MAGNET = .15;           // pull toward the centre of a hovered link/button
  const TEXT_TARGETS = 'h1, h2, h3, p, li, img, figcaption, .label, .mono, .r-meta, .org';

  const fine = matchMedia('(hover: hover) and (pointer: fine)');
  let enabled = false;
  const enable = () => { enabled = fine.matches; App.root.classList.toggle('has-cursor', enabled); };
  enable();
  fine.addEventListener?.('change', enable);

  /* ---------- shapes ---------- */
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const circle = () => {
    const c = document.createElementNS(SVG_NS, 'circle');
    c.setAttribute('r', 0);
    blobs.appendChild(c);
    return c;
  };
  const place = (el, x, y, r) => {
    el.setAttribute('cx', x.toFixed(1));
    el.setAttribute('cy', y.toFixed(1));
    el.setAttribute('r', Math.max(0, r).toFixed(1));
  };
  const tail = Array.from({ length: TAIL }, () => ({ x: 0, y: 0, el: circle() }));
  const head = { x: 0, y: 0, vx: 0, vy: 0, r: SIZE.none, vr: 0, el: circle() }; // created last, so drawn on top
  const drops = [];

  /* ---------- hover state ---------- */
  let state = 'none', magnet = null, pressed = false, started = false;

  function setState(next, el) {
    state = next;
    magnet = next === 'link' ? el : null;
    ['link', 'view', 'lens'].forEach(c => cross.classList.toggle(c, c === next));
    layer.classList.toggle('inv', next !== 'none');
    label.classList.toggle('on', next === 'view');
  }

  /* picks the hover state for whatever element is under the pointer */
  function classify(t) {
    const row = t.closest('.row a'), name = t.closest('#name'), link = t.closest('a, button');
    if (row) { setState('view'); label.textContent = row.dataset.cursor || 'View'; }
    else if (name) setState('lens');
    else if (link) setState('link', link);
    else if (t.closest(TEXT_TARGETS)) setState('text');
    else setState('none');
  }
  addEventListener('pointerover', e => { if (enabled) classify(e.target); });
  /* scrolling slides content under a still mouse without a pointerover, so re-check */
  addEventListener('scroll', () => {
    if (enabled && App.pointer.active) classify(App.at(App.pointer.x, App.pointer.y));
  }, { passive: true });

  /* ---------- click splash ---------- */
  addEventListener('pointerdown', () => {
    pressed = true;
    if (!enabled || App.reduce) return;
    for (let i = 0; i < 9; i++) {
      const a = Math.PI * 2 * i / 9 + Math.random() * .5, speed = 5 + Math.random() * 6;
      drops.push({ x: head.x, y: head.y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, r: 4 + Math.random() * 5, life: 1, el: circle() });
    }
  });
  addEventListener('pointerup', () => { pressed = false; });

  /* ---------- hide when the mouse leaves the window ---------- */
  App.root.addEventListener('mouseleave', () => { layer.classList.add('hide'); cross.classList.add('hide'); });
  App.root.addEventListener('mouseenter', () => { layer.classList.remove('hide'); cross.classList.remove('hide'); });

  /* ---------- per frame ---------- */
  App.onFrame(() => {
    if (!enabled || !App.pointer.active) return;
    const { x: mx, y: my } = App.pointer;

    if (!started) {
      head.x = mx; head.y = my;
      tail.forEach(p => { p.x = mx; p.y = my; });
      started = true;
    }

    // target: the pointer, pulled partway toward a hovered link's centre
    let tx = mx, ty = my;
    if (magnet) {
      const b = magnet.getBoundingClientRect();
      tx += (b.left + b.width / 2 - mx) * MAGNET;
      ty += (b.top + b.height / 2 - my) * MAGNET;
    }

    // head size first (a spring, so changes wobble): the tether below depends on the current radius
    const goal = SIZE[state] * (pressed ? .72 : 1);
    head.vr = (head.vr + (goal - head.r) * .16) * .72;
    head.r = App.reduce ? goal : head.r + head.vr;

    // head position: damped spring, tethered to the pointer. The leash scales with the blob's
    // current radius, so the crosshair stays inside even while the blob is still growing
    // (e.g. entering the name, where it swells from 16px to 68px).
    if (App.reduce) {
      head.x = tx; head.y = ty; head.vx = head.vy = 0;
    } else {
      head.vx = (head.vx + (tx - head.x) * SPRING) * DAMP;
      head.vy = (head.vy + (ty - head.y) * SPRING) * DAMP;
      head.x += head.vx; head.y += head.vy;
      const lx = head.x - mx, ly = head.y - my, dist = Math.hypot(lx, ly);
      const cap = Math.max(2, Math.min(TETHER, head.r - CROSS_CLEAR));
      if (dist > cap) { head.x = mx + lx / dist * cap; head.y = my + ly / dist * cap; head.vx *= .5; head.vy *= .5; }
    }

    // tail: each drop chases the one ahead; speed lengthens the streak
    const speed = Math.min(Math.hypot(head.vx, head.vy), 40);
    const thin = state === 'view' || state === 'lens';
    let ax = head.x, ay = head.y;
    tail.forEach((p, i) => {
      const follow = App.reduce ? 1 : .42 - i * .012;
      p.x += (ax - p.x) * follow;
      p.y += (ay - p.y) * follow;
      const taper = 1 - (i + 1) / (TAIL + 1);
      place(p.el, p.x, p.y, thin ? head.r * taper * .5 : head.r * taper * Math.min(1, .35 + speed / 18));
      ax = p.x; ay = p.y;
    });
    place(head.el, head.x, head.y, head.r);

    // splash droplets: drift out, get pulled back, shrink away
    for (let i = drops.length - 1; i >= 0; i--) {
      const d = drops[i];
      d.vx = (d.vx + (head.x - d.x) * .05) * .85;
      d.vy = (d.vy + (head.y - d.y) * .05) * .85;
      d.x += d.vx; d.y += d.vy; d.life -= .03;
      place(d.el, d.x, d.y, d.r * d.life);
      if (d.life <= 0) { d.el.remove(); drops.splice(i, 1); }
    }

    // Position with the `translate` property, never `transform`: the CSS hover states use the
    // separate `scale`/`rotate` properties, which the browser applies on top of `transform`.
    // With `transform` they scaled/rotated the crosshair's screen position (scale .8 over the
    // name pulled it toward the top-left corner; rotate 135deg over links flung it away).
    // `translate` is applied last, so scale/rotate only affect the crosshair's own shape.
    cross.style.translate = `${mx}px ${my}px`;
    label.style.translate = `calc(${head.x}px - 50%) calc(${head.y}px - 50%)`;
  });
})(window.MAE);
