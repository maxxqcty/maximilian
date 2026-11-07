/* ==========================================================================
   Background: an animated drafting layer behind the content, on one canvas.
   - scan pulses   accent light running down the grid's column lines
   - compass arcs  dashed circles that slowly draw and rotate
   - reg marks     "+" marks at grid crossings that pulse in turn
   - graph         drifting nodes joined by edges; parallax on scroll, they
                   move aside for the cursor
   - notation      faint CS glyphs (O(log n), </>, 0x2F...) floating upward
   All strokes use the theme's ink/accent at low opacity. With reduced motion
   a single still frame is drawn.
   ========================================================================== */
(function (App) {
  'use strict';

  const canvas = App.$('#bgfx');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  /* ---------- tuning ---------- */
  const NODES_WIDE = 22, NODES_NARROW = 10;   // graph size by screen width
  const LINK_DIST = 170;                       // px: nodes closer than this get an edge
  const CURSOR_PUSH = 140;                     // px: radius the cursor clears
  const SCAN_EVERY = 2.4;                      // seconds between column pulses
  const GLYPHS = ['O(log n)', '</>', '{ }', '0x2F', 'n → n+1', 'λ', '∑', '[ ]', 'O(1)', '&&', '01101', 'h(k)'];

  let W = 0, H = 0, cols = [], nodes = [], arcs = [], marks = [], glyphs = [], scans = [];
  let lastScan = 0, lastT = 0;
  const rand = (a, b) => a + Math.random() * (b - a);

  function measureColumns() {
    // both edges of every visible grid column, so pulses run exactly on the drawn lines
    cols = App.$$('.grid-bg span')
      .map(s => s.getBoundingClientRect())
      .filter(r => r.width > 0)
      .flatMap(r => [r.left + .5, r.right - .5]);
  }

  function seed() {
    const n = W < 720 ? NODES_NARROW : NODES_WIDE;
    nodes = Array.from({ length: n }, () => ({
      x: rand(0, W), y: rand(0, H), vx: rand(-.15, .15), vy: rand(-.15, .15), ox: 0, oy: 0, z: rand(.15, .55),
    }));
    arcs = Array.from({ length: W < 720 ? 2 : 4 }, () => ({
      cx: rand(-.1, 1.1) * W, cy: rand(0, 1) * H, r: rand(140, 420), a0: rand(0, Math.PI * 2),
      speed: rand(.02, .06) * (Math.random() < .5 ? -1 : 1), len: rand(.6, 1.6), z: rand(.1, .3), phase: rand(0, 10),
    }));
    // registration marks on grid crossings: column edges x every 180px down the screen
    marks = [];
    if (cols.length) for (let k = 0; k < (W < 720 ? 6 : 14); k++) {
      marks.push({ x: cols[Math.floor(rand(0, cols.length))], row: Math.floor(rand(0, 40)), phase: rand(0, 6) });
    }
    glyphs = Array.from({ length: W < 720 ? 5 : 10 }, () => ({
      text: GLYPHS[Math.floor(rand(0, GLYPHS.length))], x: rand(0, W), y: rand(0, H), vy: rand(-.12, -.04), z: rand(.2, .5), size: rand(11, 15),
    }));
  }

  function resize() {
    const dpr = Math.min(2, devicePixelRatio || 1);
    W = innerWidth; H = innerHeight;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    measureColumns();
    seed();
    if (App.reduce) draw(0);
  }

  /* wraps a parallax-shifted coordinate so elements loop instead of leaving the screen */
  const wrap = (v, size, pad = 60) => ((v + pad) % (size + pad * 2) + size + pad * 2) % (size + pad * 2) - pad;

  function draw(t) {
    const c = App.tokens();
    const dt = Math.min(.05, t - lastT || .016); lastT = t;
    const sy = scrollY;
    ctx.clearRect(0, 0, W, H);
    ctx.lineCap = 'round';

    /* compass arcs */
    ctx.strokeStyle = c.ink; ctx.lineWidth = 1; ctx.setLineDash([2, 7]);
    arcs.forEach(a => {
      const grow = (Math.sin(t * .25 + a.phase) * .5 + .5) * a.len + .2;   // the arc draws and undraws
      const start = a.a0 + t * a.speed;
      const cy = wrap(a.cy - sy * a.z, H, a.r);
      ctx.globalAlpha = .16;
      ctx.beginPath(); ctx.arc(a.cx, cy, a.r, start, start + grow * Math.PI); ctx.stroke();
      // a small centre mark, like the compass point
      ctx.globalAlpha = .22; ctx.setLineDash([]);
      ctx.beginPath(); ctx.moveTo(a.cx - 4, cy); ctx.lineTo(a.cx + 4, cy); ctx.moveTo(a.cx, cy - 4); ctx.lineTo(a.cx, cy + 4); ctx.stroke();
      ctx.setLineDash([2, 7]);
    });
    ctx.setLineDash([]);

    /* registration marks on the grid, pulsing in turn */
    marks.forEach(m => {
      const y = wrap(m.row * 180 + 90 - sy * .35, H);
      const p = Math.max(0, Math.sin(t * .9 + m.phase));
      const s = 5 + p * 4;
      ctx.globalAlpha = .12 + p * .35; ctx.strokeStyle = p > .6 ? c.accent : c.ink;
      ctx.beginPath(); ctx.moveTo(m.x - s, y); ctx.lineTo(m.x + s, y); ctx.moveTo(m.x, y - s); ctx.lineTo(m.x, y + s); ctx.stroke();
      if (p > .2) { ctx.globalAlpha = p * .25; ctx.beginPath(); ctx.arc(m.x, y, s + 4, 0, Math.PI * 2); ctx.stroke(); }
    });

    /* scan pulses down the column lines */
    if (!App.reduce && cols.length && t - lastScan > SCAN_EVERY) {
      lastScan = t;
      scans.push({ x: cols[Math.floor(rand(0, cols.length))], y: -160, v: rand(260, 420) });
    }
    scans = scans.filter(s => s.y < H + 160);
    scans.forEach(s => {
      s.y += s.v * dt;
      const g = ctx.createLinearGradient(0, s.y - 150, 0, s.y);
      g.addColorStop(0, 'transparent'); g.addColorStop(1, c.accent);
      ctx.globalAlpha = .55; ctx.strokeStyle = g; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(s.x, s.y - 150); ctx.lineTo(s.x, s.y); ctx.stroke();
      ctx.globalAlpha = .9; ctx.fillStyle = c.accent;
      ctx.beginPath(); ctx.arc(s.x, s.y, 2, 0, Math.PI * 2); ctx.fill();
    });
    ctx.lineWidth = 1;

    /* graph: drift, parallax, and make room for the cursor */
    const { x: mx, y: my, active } = App.pointer;
    const pts = nodes.map(n => {
      if (!App.reduce) {
        n.x += n.vx; n.y += n.vy;
        if (n.x < -40) n.x += W + 80; if (n.x > W + 40) n.x -= W + 80;
      }
      const px = n.x, py = wrap(n.y - sy * n.z, H);
      // ease an offset away from the cursor, then let it settle back
      let tx = 0, ty = 0;
      if (active && !App.reduce) {
        const dx = px - mx, dy = py - my, d = Math.hypot(dx, dy);
        if (d < CURSOR_PUSH && d > .1) { const f = (1 - d / CURSOR_PUSH) * 38; tx = dx / d * f; ty = dy / d * f; }
      }
      n.ox += (tx - n.ox) * .08; n.oy += (ty - n.oy) * .08;
      return [px + n.ox, py + n.oy];
    });
    ctx.strokeStyle = c.ink;
    for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
      const d = Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1]);
      if (d < LINK_DIST) {
        ctx.globalAlpha = (1 - d / LINK_DIST) * .18;
        ctx.beginPath(); ctx.moveTo(pts[i][0], pts[i][1]); ctx.lineTo(pts[j][0], pts[j][1]); ctx.stroke();
      }
    }
    pts.forEach(([x, y], i) => {
      const lit = (Math.floor(t * .7) + i) % 9 === 0;   // one node in nine lights up in turn
      ctx.globalAlpha = lit ? .8 : .3;
      ctx.fillStyle = lit ? c.accent : c.paper; ctx.strokeStyle = lit ? c.accent : c.ink;
      ctx.fillRect(x - 3, y - 3, 6, 6); ctx.strokeRect(x - 3, y - 3, 6, 6);
    });

    /* floating notation */
    ctx.fillStyle = c.ink; ctx.textAlign = 'center';
    glyphs.forEach(g => {
      if (!App.reduce) g.y += g.vy;
      const y = wrap(g.y - sy * g.z, H);
      ctx.globalAlpha = .13;
      ctx.font = `400 ${g.size}px "IBM Plex Mono", monospace`;
      ctx.fillText(g.text, g.x, y);
    });

    ctx.globalAlpha = 1;
  }

  let resizeTimer;
  addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(resize, 150); });
  // wait for fonts and the grid's own layout before measuring columns
  (document.fonts?.ready || Promise.resolve()).then(resize);
  resize();

  App.onFrame(t => { if (!App.reduce) draw(t); });
  /* a theme change re-colours the still frame too */
  new MutationObserver(() => { if (App.reduce) draw(0); }).observe(App.root, { attributes: true, attributeFilter: ['data-theme'] });
})(window.MAE);
