/* ==========================================================================
   Project art: one animated canvas drawing per project.
   A row's data-art="<key>" picks the drawing. To add a project, add a
   function here with the signature (ctx, w, h, t, colors).
   ========================================================================== */
(function (App) {
  'use strict';

  const easeOut = x => 1 - Math.pow(1 - x, 3);

  /* shared by the BST and AVL drawings: a tree whose search path lights up node by node */
  function tree(ctx, w, h, t, c, balanced) {
    const DEPTH = 4, nodes = [];
    const build = (x, y, d, spread, path) => {
      nodes.push({ x, y, path });
      if (d >= DEPTH - 1) return;
      const lopsided = !balanced && d >= 1 && path.length % 2 === 1;
      (lopsided ? [1] : [-1, 1]).forEach(s => build(x + s * spread, y + h * .2, d + 1, spread / 2, path + (s < 0 ? 'L' : 'R')));
    };
    build(w / 2, h * .16, 0, w * .22, '');

    const step = Math.floor(t * .6);
    const target = nodes[((step % nodes.length) + nodes.length) % nodes.length].path; // wraps safely for any t
    nodes.forEach(n => {
      if (!n.path) return;
      const parent = nodes.find(m => m.path === n.path.slice(0, -1));
      const on = target.startsWith(n.path);
      ctx.strokeStyle = on ? c.accent : c.ink; ctx.globalAlpha = on ? 1 : .45; ctx.lineWidth = on ? w / 120 : w / 260;
      ctx.beginPath(); ctx.moveTo(parent.x, parent.y); ctx.lineTo(n.x, n.y); ctx.stroke();
    });
    nodes.forEach(n => {
      const on = target.startsWith(n.path);
      ctx.globalAlpha = 1; ctx.fillStyle = on ? c.accent : c.paper2; ctx.strokeStyle = on ? c.accent : c.ink; ctx.lineWidth = w / 260;
      ctx.beginPath(); ctx.arc(n.x, n.y, w * .026, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    });
  }

  const art = {
    /* OpenSeat: a full session; one seat empties and the first person waiting moves in */
    seats(ctx, w, h, t, c) {
      const cols = 8, rows = 5, cs = w / (cols + 2), gap = h / (rows + 2.4), freed = 13;
      const phase = (t * .35) % 1;
      for (let r = 0; r < rows; r++) for (let col = 0; col < cols; col++) {
        const i = r * cols + col;
        ctx.beginPath(); ctx.arc(cs * (col + 1.5), gap * (r + 1.2), cs * .3, 0, Math.PI * 2);
        if (i === freed) { ctx.strokeStyle = c.accent; ctx.globalAlpha = 1; ctx.stroke(); }
        else { ctx.fillStyle = c.ink; ctx.globalAlpha = .7; ctx.fill(); }
      }
      const sx = cs * (freed % cols + 1.5), sy = gap * (Math.floor(freed / cols) + 1.2);
      const qx = cs * 1.5, qy = h - gap * .55;
      const e = phase < .5 ? 0 : Math.min(1, (phase - .5) * 3), k = easeOut(e);
      ctx.globalAlpha = 1; ctx.fillStyle = c.accent;
      ctx.beginPath(); ctx.arc(qx + (sx - qx) * k, qy + (sy - qy) * k, cs * .3, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = .4; ctx.fillStyle = c.ink;
      for (let q = 1; q < 4; q++) {
        ctx.beginPath(); ctx.arc(qx + q * cs * .9 - (e > 0 ? k * cs * .9 : 0), qy, cs * .22, 0, Math.PI * 2); ctx.fill();
      }
    },

    /* Scholar PDF Downloader: papers stack up one at a time, with a running file counter */
    papers(ctx, w, h, t, c) {
      const n = 6, pw = w * .26, ph = h * .5, p = (t * .5) % n;
      for (let i = 0; i < n; i++) {
        if (p < i) continue;
        const k = easeOut(Math.min(1, Math.max(0, p - i)));
        const x = w * .62 - pw / 2 + (1 - k) * -w * .38 + i * 3;
        const y = h * .3 - i * 3 + (1 - k) * h * .05;
        ctx.globalAlpha = 1; ctx.fillStyle = c.paper2; ctx.strokeStyle = i === Math.floor(p) ? c.accent : c.ink;
        ctx.fillRect(x, y, pw, ph); ctx.strokeRect(x, y, pw, ph);
        ctx.globalAlpha = .45; ctx.fillStyle = c.ink;
        for (let l = 0; l < 6; l++) ctx.fillRect(x + pw * .14, y + ph * (.18 + l * .12), pw * (l === 0 ? .5 : .72), Math.max(1, h / 140));
      }
      ctx.globalAlpha = 1; ctx.fillStyle = c.accent;
      ctx.font = `500 ${Math.round(h * .07)}px "IBM Plex Mono", monospace`;
      ctx.fillText(String(Math.floor(p) + 1).padStart(3, '0') + '.pdf', w * .08, h * .9);
    },

    /* BST Visualizer: an unbalanced tree */
    bst(ctx, w, h, t, c) { tree(ctx, w, h, t, c, false); },

    /* AVL Tree Visualizer: a balanced tree that rocks gently, like a rotation settling */
    avl(ctx, w, h, t, c) {
      ctx.translate(w / 2, h / 2); ctx.rotate(Math.sin(t * .8) * .06); ctx.translate(-w / 2, -h / 2);
      tree(ctx, w, h, t + 3, c, true);
    },

    /* School System CRUD: a records table with the selected row moving down */
    table(ctx, w, h, t, c) {
      const rows = 7, rh = h / (rows + 1.5), sel = Math.floor(t * .9) % rows;
      ctx.fillStyle = c.ink; ctx.globalAlpha = .9; ctx.fillRect(w * .08, rh * .5, w * .84, rh * .7);
      for (let r = 0; r < rows; r++) {
        const y = rh * (r + 1.4);
        if (r === sel) { ctx.globalAlpha = .18; ctx.fillStyle = c.accent; ctx.fillRect(w * .08, y - rh * .1, w * .84, rh * .9); }
        ctx.globalAlpha = r === sel ? 1 : .5; ctx.fillStyle = r === sel ? c.accent : c.ink;
        ctx.beginPath(); ctx.arc(w * .14, y + rh * .35, rh * .22, 0, Math.PI * 2); ctx.fill();
        [.22, .5, .72].forEach((cx, ci) => ctx.fillRect(w * cx, y + rh * .28, w * (ci === 0 ? .22 : .14), Math.max(2, rh * .14)));
      }
    },
  };

  /* clears the canvas to the surface colour, then runs the project's drawing */
  App.drawArt = function (ctx, key, t, w, h) {
    const c = App.tokens();
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1;
    ctx.fillStyle = c.paper2; ctx.fillRect(0, 0, w, h);
    ctx.lineWidth = Math.max(1, w / 220);
    if (art[key]) art[key](ctx, w, h, t, c);
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1;
  };
})(window.MAE);
