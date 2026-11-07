/* Scroll ruler: replaces the browser scrollbar with a measuring rail on the
   right edge (desktop with a mouse only; touch keeps the native scrollbar).

   Rail (canvas):
   - a tick for every 1% of the page, a longer numbered tick every 5%
   - a needle with a % readout marks the current position (hidden near the top)
   - ticks near the needle stretch with scroll speed
   - on load the ticks draw in one after another, top to bottom
   - hovering shows a ghost line where a click would jump; click glides there,
     dragging scrubs through the page

   Section headings (DOM letters, one span per letter):
   - each section's name rides the rail vertically, moving with its section
   - as the section reaches the top, the letters fly one by one along a curved
     path and land as a full-size heading beside the rail (the "flip")
   - earlier headings shrink into a compact pile above the current one
   - sections further down wait as compact headings queued at the bottom and
     peel off onto the rail as their section scrolls up
   - clicking a heading glides to its section

   Everything is driven by the scroll position, so the motion runs forwards
   and backwards with the page. Tuning constants are below. */
(function (App) {
  'use strict';

  /* rail */
  const RAIL_W = 60;          // px, also the gutter reserved from page content (hud.css)
  const EDGE_PAD = 12;        // px, inset of the 0% and 100% ticks from the nav and viewport bottom
  const MINOR_LEN = 10, MAJOR_LEN = 20, SECTION_LEN = 28;
  const MINOR_ALPHA = .4, MAJOR_ALPHA = .8, LABEL_ALPHA = .5;
  const VEL_RADIUS = 90;      // px on the rail around the needle where ticks react to speed
  const VEL_STRETCH = .9;     // how far fast scrolling stretches those ticks
  const NEEDLE_FADE = .03;    // progress below which the needle fades out
  const INTRO_DUR = 1000, INTRO_STAGGER = 10;   // ms per tick draw-in, delay between ticks
  const JUMP_MAX = 1250;      // ms, longest click glide (short hops are quicker)
  const DRAG_LERP = .18;      // how tightly the page chases the cursor while dragging

  /* headings */
  /* sizes and spacing follow the reference design (getartcraft.com) */
  const HEAD_PX = 34;         // full-size current heading (keep in sync with .rw-word font-size in hud.css)
  const RIDE_PX = 20;         // vertical word riding the rail
  const QUEUE_PX = 16;        // compact headings (top pile and bottom queue)
  const MAX_PILE = 2;         // earlier headings kept above the current one; older ones slide away
  const MAX_QUEUE = 2;        // upcoming headings shown in the bottom queue
  const RIDE_X = 12;          // px from the rail's left edge to the riding word's centre line
  const RIDE_GAP = 18;        // minimum gap between two words riding the rail
  const TEXT_PAD = 4;         // gap between the rail and horizontal headings
  const TOP_PAD = 12;         // gap between the nav and the first heading in the pile
  const CURRENT_GAP = 26;     // extra gap above the full-size current heading
  const SLOT = 20;            // vertical spacing of compact headings
  const QUEUE_PAD = 36;       // gap between the viewport bottom and the lowest queued heading
  const FLIP_ZONE = 200;      // scroll px over which the flip plays out
  const DETACH_ZONE = 240;    // scroll px over which a queued heading morphs onto the rail
  const STAGGER = .16;        // per-letter delay fraction in a flight
  const ARC = 28;             // px each letter's path bows toward the page mid-flight
  const QUEUE_ALPHA = .35;    // opacity of everything that isn't the current heading
  const CLEAR_ZONE = 120;     // px the portrait must clear above the bottom queue before it fades in
  const SNAP_DELAY = 400;     // ms scroll must rest with a flip half-done before it resolves itself
  const SNAP_DUR = 700;       // ms of the glide that finishes (or undoes) a half-done flip

  const root = document.documentElement;
  const header = App.$('.top');
  const portrait = App.$('.portrait');   // the bottom queue stays hidden while this is in its corner
  const canvas = document.createElement('canvas');
  canvas.className = 'scroll-ruler';
  canvas.setAttribute('aria-hidden', 'true');
  const ctx = canvas.getContext('2d');

  /* heading layer: two contrast pools + one absolutely positioned span per letter */
  const layer = document.createElement('div');
  layer.className = 'ruler-words';
  layer.setAttribute('aria-hidden', 'true');   // the real h2s stay in the page for assistive tech
  const poolTop = document.createElement('div'); poolTop.className = 'rw-pool rw-pool-top';
  const poolBot = document.createElement('div'); poolBot.className = 'rw-pool rw-pool-bot';
  layer.append(poolTop, poolBot);

  const sections = [
    { el: App.$('#top'), head: null, name: 'Intro' },
    ...App.$$('main section[id]').map(s => ({ el: s, head: App.$('h2', s), name: App.$('h2', s)?.textContent.trim() || s.id })),
  ].filter(s => s.el);

  sections.forEach((s, i) => {
    s.text = s.name.toUpperCase();
    s.word = document.createElement('div');
    s.word.className = 'rw-word';
    s.word.dataset.sec = s.el.id || 'top';   // hud.css colours each word by its section
    s.letters = [...s.text].map(ch => {
      const l = document.createElement('span');
      l.className = 'rw-ch';
      l.textContent = ch;
      s.word.appendChild(l);
      return l;
    });
    s.word.addEventListener('click', () => glideTo(Math.min(maxScroll(), anchorOf(i))));
    s.word.addEventListener('pointerenter', () => { hoverWord = i; });
    s.word.addEventListener('pointerleave', () => { if (hoverWord === i) hoverWord = -1; });
    layer.appendChild(s.word);
  });
  let hoverWord = -1;

  /* letter advances (in em) measured in the heading face, so letters sit like set type */
  function measureLetters() {
    const probe = document.createElement('div');
    probe.className = 'rw-word rw-measure';
    document.body.appendChild(probe);
    sections.forEach(s => {
      probe.textContent = '';
      const spans = [...s.text].map(ch => { const sp = document.createElement('span'); sp.textContent = ch; probe.appendChild(sp); return sp; });
      s.adv = spans.map(sp => sp.getBoundingClientRect().width / 100);
      s.cum = []; let acc = 0;
      s.adv.forEach(a => { s.cum.push(acc); acc += a; });
      s.total = acc;
    });
    probe.remove();
  }

  /* ---------- on / off ---------- */
  const fine = matchMedia('(hover: hover) and (pointer: fine) and (min-width: 721px)');
  let on = false;
  function setMode() {
    on = fine.matches;
    root.dataset.ruler = on ? 'on' : 'off';
    if (on && !canvas.isConnected) { document.body.append(canvas, layer); measureLetters(); measure(); }
    if (!on && canvas.isConnected) { canvas.remove(); layer.remove(); }
  }

  const ease = x => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
  const easeOut = x => 1 - Math.pow(1 - x, 3);
  const clamp01 = x => Math.min(1, Math.max(0, x));
  const maxScroll = () => Math.max(1, root.scrollHeight - innerHeight);

  /* ---------- geometry of the rail ---------- */
  let W = RAIL_W, H = 0, dpr = 1, top = 0, span = 1, navB = 0;
  function measure() {
    dpr = Math.min(2, devicePixelRatio || 1);
    H = innerHeight;
    canvas.width = W * dpr; canvas.height = H * dpr;
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    navB = header ? Math.max(0, header.getBoundingClientRect().bottom) : 0;
    top = navB + EDGE_PAD;
    span = Math.max(1, H - EDGE_PAD - top);
  }
  addEventListener('resize', () => { if (on) measure(); });
  (document.fonts?.ready || Promise.resolve()).then(() => { if (on) measureLetters(); });
  fine.addEventListener?.('change', setMode);
  setMode();
  const yOf = p => top + p * span;
  const pOf = y => clamp01((y - top) / span);

  /* ---------- scrolling: click glide and drag scrub ---------- */
  let jump = null, dragging = false, dragTarget = 0, dragStartY = 0, dragMoved = false;
  function setScroll(y) {
    root.style.scrollBehavior = 'auto';   // the page uses smooth scrolling for anchors; bypass it here
    scrollTo(0, y);
    root.style.scrollBehavior = '';
  }
  function glideTo(y, dur) {
    const from = scrollY, dist = Math.abs(y - from);
    if (App.reduce || dist < 2) return setScroll(y);
    jump = { from, to: y, t0: performance.now(), dur: dur || Math.min(JUMP_MAX, 350 + dist * .35) };
  }
  // any wheel, key or touch input cancels a glide in progress
  ['wheel', 'keydown', 'touchstart'].forEach(ev => addEventListener(ev, () => { jump = null; }, { passive: true }));

  /* ---------- pointer on the rail ---------- */
  let hoverY = null;
  canvas.addEventListener('pointermove', e => {
    const y = e.clientY - canvas.getBoundingClientRect().top;
    hoverY = y;
    if (dragging) {
      if (Math.abs(y - dragStartY) > 3) dragMoved = true;
      dragTarget = pOf(y) * maxScroll();
    }
  });
  canvas.addEventListener('pointerleave', () => { if (!dragging) hoverY = null; });
  canvas.addEventListener('pointerdown', e => {
    e.preventDefault();
    const y = e.clientY - canvas.getBoundingClientRect().top;
    canvas.setPointerCapture(e.pointerId);
    dragging = true; jump = null; dragMoved = false; dragStartY = y;
    dragTarget = pOf(y) * maxScroll();
  });
  const endDrag = e => {
    if (!dragging) return;
    dragging = false;
    if (!dragMoved) glideTo(dragTarget);   // a press without movement is a click: glide
    if (e.type === 'pointercancel' || !canvas.matches(':hover')) hoverY = null;
  };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);

  /* ---------- section positions ---------- */
  const headH = () => (header ? header.offsetHeight : 0);
  // scroll target for a section: its heading just below the nav
  // where a section visibly starts: its separator rule (sections after the first), or its
  // first content for the first section, which has no rule above it
  const startOf = i => {
    const s = sections[i];
    return s.el.previousElementSibling?.tagName === 'SECTION' ? s.el.getBoundingClientRect().top : s.head.getBoundingClientRect().top;
  };
  // the line a section's start must reach for its heading to be fully flipped in: just under
  // the full-size heading when the pile is full
  const flipLine = () => navB + TOP_PAD + MAX_PILE * SLOT + CURRENT_GAP + HEAD_PX / 2 + 10;
  // scroll target for a section: its start sitting on the flip line, heading just flipped in
  const anchorOf = i => i === 0 ? 0 : Math.max(0, startOf(i) + scrollY - flipLine());

  /* ---------- heading poses ----------
     A pose is where one letter sits: centre x/y, rotation, scale (of HEAD_PX), opacity. */
  const RIDE = RIDE_PX / HEAD_PX, QUEUE = QUEUE_PX / HEAD_PX;
  let X0 = 0;   // rail's left edge in viewport px
  let colorsFor = null;   // token set the section colours were read for
  let currentIdx = 0;   // section whose heading is (mostly) flipped in, for the rail tick
  let halfFlip = null;   // progress of a half-done flip this frame, if any
  const flat = (s, j, y, scale, alpha) => ({
    x: X0 - TEXT_PAD - (s.total - s.cum[j] - s.adv[j] / 2) * HEAD_PX * scale, y, rot: 0, scale, alpha,
  });
  const riding = (s, j, y) => ({
    x: X0 + RIDE_X, y: y + (s.cum[j] + s.adv[j] / 2) * HEAD_PX * RIDE, rot: 90, scale: RIDE, alpha: QUEUE_ALPHA,
  });

  function placeWords() {
    X0 = innerWidth - RAIL_W;
    const vh = innerHeight, max = maxScroll(), y = scrollY;
    const A = navB + TOP_PAD;                         // first pile slot
    const L = flipLine();                             // where a section's start finishes its flip
    const I = vh - QUEUE_PAD;                         // lowest queue slot

    const st = sections.map((s, i) => {
      const rideLen = s.total * HEAD_PX * RIDE;
      if (i === 0) return { v: -9999, rideLen, flipP: 1, posFlip: 1, detachP: 1, yq: I };
      const v = startOf(i);
      return { v, rawV: v, rideLen, flipP: 0, posFlip: 0, detachP: 1, yq: I };
    });

    for (let i = 1; i < sections.length; i++) {
      const r = st[i], prev = st[i - 1];
      // a riding word waits below the one above it rather than overlapping it
      // (short sections can be closer together than a long vertical word)
      if (i > 1 && prev.flipP < 1) r.v = Math.max(r.v, prev.v + prev.rideLen + RIDE_GAP);
      r.flipP = r.posFlip = clamp01((L + FLIP_ZONE - r.v) / FLIP_ZONE);
      // sections near the end can't scroll up to the flip line: flip them over the last stretch instead
      if (r.rawV + y - max > L) {
        const bottom = sections[i].el.getBoundingClientRect().bottom + y;
        const start = Math.min(bottom - vh, max - 24), len = Math.max(24, max - start);
        r.flipP = Math.max(r.flipP, clamp01((y - start) / len));
      }
    }

    // a flip left half-done (by position, not the end-of-page stretch) is resolved after a rest
    halfFlip = null;
    st.forEach(r => { if (r.posFlip > .06 && r.posFlip < .94 && r.flipP === r.posFlip) halfFlip = r.posFlip; });

    // bottom queue: the nearest upcoming heading on top, then the next; only MAX_QUEUE are
    // shown. rank counts the still-queued headings ahead of this one, so the queue moves
    // up smoothly as the nearest one peels away.
    let rank = 0;
    for (let i = 1; i < sections.length; i++) {
      const r = st[i];
      r.yq = I - SLOT * (MAX_QUEUE - 1 - rank);
      r.detachP = clamp01((r.yq + DETACH_ZONE - (r.v + r.rideLen)) / DETACH_ZONE);
      r.qFade = clamp01(MAX_QUEUE - rank);   // fades in as it moves into the last visible slot
      if (r.flipP <= 0) rank += 1 - r.detachP;
    }

    // keep the queue off the portrait: hidden while the portrait reaches down into the
    // queue's corner, fading in as it scrolls up and clears it
    const queueTop = I - SLOT * (MAX_QUEUE - 1) - QUEUE_PX - 16;
    const pr = portrait && portrait.getBoundingClientRect();
    const clear = pr && pr.bottom > 0 && pr.right > X0 - 700 ? clamp01((queueTop - pr.bottom) / CLEAR_ZONE) : 1;

    // top pile: count fully flipped words and how far the next one has got
    let full = 0, partial = 0, poolT = 0, poolB = 0, pileBottom = A;
    st.forEach(r => { if (r.flipP >= 1) full++; else partial += r.flipP; });
    // how many headings have slid off the top of the pile (continuous while one flips in)
    const shift = Math.max(0, full - 1 + partial - MAX_PILE);
    currentIdx = Math.min(sections.length - 1, full - 1 + (partial >= .5 ? 1 : 0));

    sections.forEach((s, i) => {
      if (!s.adv) return;
      const r = st[i], N = s.letters.length;
      let t, from, to, fade = 1;
      if (r.flipP > 0) {
        t = r.flipP;
        from = j => riding(s, j, r.v);
        if (r.flipP >= 1) {
          // settled in the pile; the current heading shrinks as the next one flips in
          const k = i === full - 1 ? partial : 1;
          const slot = i - shift;
          const yy = A + slot * SLOT + CURRENT_GAP * (1 - k);
          const sc = 1 - (1 - QUEUE) * k, al = 1 - (1 - QUEUE_ALPHA) * k;
          to = j => flat(s, j, yy, sc, al);
          fade = clamp01(1 + slot);   // slides above the first slot as it fades out
          if (fade > 0) pileBottom = Math.max(pileBottom, yy + HEAD_PX * sc);
        } else {
          to = j => flat(s, j, A + (i - shift) * SLOT + CURRENT_GAP, 1, 1);
        }
        poolT = Math.max(poolT, r.flipP);
      } else if (r.detachP < 1) {
        t = r.detachP;
        from = j => flat(s, j, r.yq, QUEUE, QUEUE_ALPHA);
        // lands on its riding spot, which may be held back below the word above it
        to = j => riding(s, j, Math.max(r.v, r.yq - r.rideLen));
        fade = (r.qFade + (1 - r.qFade) * r.detachP) * (clear + (1 - clear) * r.detachP);   // hidden queued words show once they leave
        poolB = Math.max(poolB, (1 - r.detachP) * r.qFade * clear);
      } else {
        t = 1; from = to = j => riding(s, j, r.v);
      }

      const hot = i === hoverWord && fade > .5;
      const O = 1 + (N - 1) * STAGGER;
      let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9, vis = 0;
      for (let j = 0; j < N; j++) {
        const d = ease(clamp01(t * O - j * STAGGER));
        const a = from(j), b = to(j), u = 1 - d;
        const cx = (a.x + b.x) / 2 - ARC, cy = (a.y + b.y) / 2;   // control point bows toward the page
        const x = u * u * a.x + 2 * u * d * cx + d * d * b.x;
        const yy = u * u * a.y + 2 * u * d * cy + d * d * b.y;
        const rot = a.rot + (b.rot - a.rot) * d, sc = a.scale + (b.scale - a.scale) * d;
        const al = (hot ? 1 : a.alpha + (b.alpha - a.alpha) * d) * fade;
        const l = s.letters[j];
        l.style.transform = `translate3d(${x.toFixed(1)}px, ${yy.toFixed(1)}px, 0) translate(-50%, -50%) rotate(${rot.toFixed(1)}deg) scale(${sc.toFixed(3)})`;
        l.style.opacity = al.toFixed(3);
        const half = s.adv[j] * HEAD_PX * sc / 2 + 2, hh = HEAD_PX * sc / 2 + 2, turned = Math.abs(rot) > 45;
        const hx = turned ? hh : half, hy = turned ? half : hh;
        minX = Math.min(minX, x - hx); maxX = Math.max(maxX, x + hx);
        minY = Math.min(minY, yy - hy); maxY = Math.max(maxY, yy + hy);
        vis = Math.max(vis, al);
      }
      s.word.classList.toggle('is-hot', hot);
      // the word's own box is its click target, sized to the letters' current spread
      Object.assign(s.word.style, { left: minX + 'px', top: minY + 'px', width: (maxX - minX) + 'px', height: (maxY - minY) + 'px' });
      s.word.style.setProperty('--ox', -minX + 'px'); s.word.style.setProperty('--oy', -minY + 'px');
      s.word.style.pointerEvents = vis > .05 && maxY > 0 && minY < vh ? 'auto' : 'none';
    });

    poolTop.style.opacity = poolT;
    poolTop.style.top = navB + 'px';
    poolTop.style.height = (pileBottom - navB + 40) + 'px';
    poolBot.style.opacity = poolB;
    poolBot.style.height = (vh - (I - SLOT * (MAX_QUEUE - 1)) + 50) + 'px';
  }

  /* ---------- per frame ---------- */
  const t0 = performance.now();
  let lastY = scrollY, vel = 0, lastT = t0, lastSeenY = scrollY, restSince = t0;

  App.onFrame(() => {
    if (!on) return;
    const now = performance.now(), dt = Math.min(.1, (now - lastT) / 1000) || .016;
    lastT = now;

    // drive scrolling first so the needle matches this frame
    if (jump) {
      const k = clamp01((now - jump.t0) / jump.dur);
      setScroll(jump.from + (jump.to - jump.from) * ease(k));
      if (k >= 1) jump = null;
    } else if (dragging && dragMoved) {
      const y = scrollY + (dragTarget - scrollY) * (App.reduce ? 1 : DRAG_LERP);
      setScroll(Math.abs(dragTarget - y) < .5 ? dragTarget : y);
    }

    placeWords();

    // track scroll rest; finish a half-done flip in whichever direction is closer
    if (scrollY !== lastSeenY) { lastSeenY = scrollY; restSince = now; }
    if (halfFlip != null && !jump && !dragging && now - restSince > SNAP_DELAY) {
      // flip progress grows 1:1 with scroll over FLIP_ZONE px
      const delta = halfFlip >= .5 ? (1 - halfFlip) * FLIP_ZONE : -halfFlip * FLIP_ZONE;
      glideTo(Math.min(maxScroll(), Math.max(0, scrollY + delta + Math.sign(delta))), SNAP_DUR);
    }

    const max = maxScroll(), progress = clamp01(scrollY / max);
    const v = (scrollY - lastY) / dt; lastY = scrollY;
    vel += (v - vel) * (1 - Math.exp(-6 * dt));
    const speed = App.reduce ? 0 : Math.min(1, Math.abs(vel) / 4000);

    const c = App.tokens();
    // each section's colour, re-read when the theme changes (tokens() returns a new object then)
    if (c !== colorsFor) { colorsFor = c; sections.forEach(s => { s.color = getComputedStyle(s.el).getPropertyValue('--accent').trim() || c.accent; }); }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const needleY = yOf(progress);

    // current section (for its tick colour): the last whose anchor the scroll has passed
    const current = currentIdx;
    const anchors = sections.map((s, i) => anchorOf(i));

    // ticks
    const introAt = i => App.reduce ? 1 : easeOut(clamp01((now - t0 - 250 - i * INTRO_STAGGER) / INTRO_DUR));
    for (let i = 0; i <= 100; i++) {
      const y = Math.round(yOf(i / 100)) + .5, major = i % 5 === 0, intro = introAt(i);
      if (intro <= 0) continue;
      const d = Math.abs(y - needleY);
      const near = d < VEL_RADIUS ? Math.pow(1 - d / VEL_RADIUS, 2) : 0;
      const len = (major ? MAJOR_LEN : MINOR_LEN) * (1 + near * speed * VEL_STRETCH) * intro;
      ctx.strokeStyle = c.ink; ctx.lineWidth = 1;
      ctx.globalAlpha = major ? MAJOR_ALPHA : MINOR_ALPHA;
      ctx.beginPath(); ctx.moveTo(W, y); ctx.lineTo(W - len, y); ctx.stroke();

      // numbers on major ticks, yielding to the needle readout
      if (major && intro > .5 && !(progress >= NEEDLE_FADE && Math.abs(y - needleY) < 12)) {
        ctx.globalAlpha = LABEL_ALPHA * (intro - .5) * 2;
        ctx.fillStyle = c.ink; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
        ctx.font = '400 9px "IBM Plex Mono", ui-monospace, monospace';
        ctx.fillText(String(i), W - MAJOR_LEN - 4, y);
      }
    }

    // a longer tick where each section starts on the ruler
    sections.forEach((s, i) => {
      const p = clamp01(anchors[i] / max), intro = introAt(Math.round(p * 100));
      if (intro <= 0) return;
      const ty = Math.round(yOf(p)) + .5;
      ctx.globalAlpha = (i === current ? 1 : .55) * intro;
      ctx.strokeStyle = s.color || c.accent;
      ctx.beginPath(); ctx.moveTo(W, ty); ctx.lineTo(W - SECTION_LEN * intro, ty); ctx.stroke();
    });

    // hover ghost: where a click would jump
    if (hoverY != null && !(dragging && dragMoved)) {
      const gy = Math.round(yOf(pOf(hoverY)));
      ctx.globalAlpha = .9; ctx.fillStyle = c.ink;
      ctx.fillRect(24, gy - 1, W - 24, 3);
      ctx.globalAlpha = 1; ctx.font = '500 9px "IBM Plex Mono", ui-monospace, monospace';
      ctx.textAlign = 'right'; ctx.textBaseline = 'bottom';
      ctx.fillText(Math.round(pOf(hoverY) * 100) + '%', W - 2, gy - 4);
    }

    // needle + readout
    const needleA = App.reduce ? (progress >= NEEDLE_FADE ? 1 : 0) : clamp01((progress - NEEDLE_FADE * .5) / (NEEDLE_FADE * .5));
    if (needleA > 0) {
      const ny = Math.round(needleY);
      ctx.globalAlpha = needleA;
      ctx.fillStyle = sections[current].color || c.accent;
      ctx.fillRect(24, ny - 1, W - 24, 2);
      ctx.beginPath(); ctx.moveTo(24, ny - 4); ctx.lineTo(30, ny); ctx.lineTo(24, ny + 4); ctx.closePath(); ctx.fill();
      ctx.font = '500 10px "IBM Plex Mono", ui-monospace, monospace';
      // readout sits under the needle, or above it near the bottom so it never clips
      const below = ny + 18 < H;
      ctx.textAlign = 'right'; ctx.textBaseline = below ? 'top' : 'bottom';
      ctx.fillText(Math.round(progress * 100) + '%', W - 2, below ? ny + 4 : ny - 4);
    }
    ctx.globalAlpha = 1;
  });
})(window.MAE);
