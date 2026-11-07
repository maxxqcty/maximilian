/* Clock: live Philippine time in the contact section, with a note on
   whether it is daytime there. (#clock is used too if a page has one.) */
(function (App) {
  'use strict';

  const header = App.$('#clock');
  const ctTime = App.$('#contactTime');
  const ctNote = App.$('#contactNote');
  if (!header && !ctTime) return;

  const opts = { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' };
  const full = new Intl.DateTimeFormat('en-GB', { ...opts, second: '2-digit' });
  const short = new Intl.DateTimeFormat('en-GB', opts);

  let lastPart = '';
  const tick = () => {
    const now = new Date();
    if (header) header.textContent = 'Dumaguete ' + full.format(now);
    if (!ctTime) return;
    const hm = short.format(now);
    ctTime.textContent = hm;

    const h = parseInt(hm, 10);
    const part = h >= 7 && h < 22 ? 'day' : 'night';
    if (ctNote && part !== lastPart) {
      lastPart = part;
      ctNote.innerHTML = part === 'day'
        ? '<span class="dot"></span>daytime there'
        : 'night-time there';
    }
  };

  tick();
  setInterval(tick, 1000);
})(window.MAE);
