/* Contact: the Send button leans toward the cursor, the message form is
   validated, and the copy button copies the address and briefly shows a tick. */
(function (App) {
  'use strict';

  const toast = App.$('#toast');

  /* toast message */
  let hideTimer;
  const say = msg => {
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => toast.classList.remove('show'), 2200);
  };

  /* magnetic pull on the Send button */
  const btn = App.$('#mag');
  if (btn) {
    const inner = App.$('.mag-inner', btn);
    btn.addEventListener('pointermove', e => {
      if (App.reduce) return;
      const r = btn.getBoundingClientRect();
      const dx = e.clientX - r.left - r.width / 2, dy = e.clientY - r.top - r.height / 2;
      btn.style.transform = `translate(${dx * .2}px, ${dy * .35}px)`;
      inner.style.transform = `translate(${dx * .1}px, ${dy * .15}px)`;
    });
    btn.addEventListener('pointerleave', () => { btn.style.transform = ''; inner.style.transform = ''; });
  }

  setupForm();

  /* copy, or select the text when the clipboard is unavailable */
  const copy = App.$('#copyBtn');
  const email = App.$('#email');
  if (!copy || !email) return;

  let doneTimer;
  copy.addEventListener('click', () => {
    const selectText = () => {
      const range = document.createRange();
      range.selectNodeContents(email);
      const sel = getSelection();
      sel.removeAllRanges(); sel.addRange(range);
      say('Selected. Press Ctrl+C to copy');
    };
    const copied = () => {
      say('Email copied');
      copy.classList.add('done');
      clearTimeout(doneTimer);
      doneTimer = setTimeout(() => copy.classList.remove('done'), 1800);
    };
    if (navigator.clipboard) navigator.clipboard.writeText(email.textContent.trim()).then(copied, selectText);
    else selectText();
  });

  /* ---------- message form ---------- */

  /* Delivery hook. Not connected yet: plug a form service in here (e.g. a fetch()
     POST to Web3Forms or Formspree) and resolve when the message is accepted.
     Until then it rejects, and the form tells the visitor to email instead. */
  function sendMessage(/* { email, message } */) {
    return Promise.reject(new Error('not-connected'));
  }

  function setupForm() {
    const form = App.$('#msgForm');
    if (!form) return;
    const from = App.$('#msgEmail', form), text = App.$('#msgText', form);
    const count = App.$('#msgCount', form), status = App.$('#msgStatus', form);
    const send = App.$('#mag', form), sendLabel = App.$('.send-label', send);
    const MAX = +text.maxLength || 2000;
    const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    let tried = false;   // show errors live only after the first submit attempt

    const checks = [
      [from, v => !v ? 'Enter your email so I can reply.' : EMAIL.test(v) ? '' : 'That email doesn’t look right. Check for typos.'],
      [text, v => !v ? 'Write a message first.' : v.length < 10 ? 'Add a little more detail (10 characters or more).' : ''],
    ];
    const validate = field => {
      const [, rule] = checks.find(([f]) => f === field);
      const msg = rule(field.value.trim());
      App.$('#' + field.getAttribute('aria-describedby').split(' ')[0]).textContent = msg;
      field.setAttribute('aria-invalid', msg ? 'true' : 'false');
      return !msg;
    };

    /* textarea grows with its content; counter follows */
    const grow = () => {
      text.style.height = 'auto';
      text.style.height = text.scrollHeight + 'px';
      count.textContent = `${text.value.length} / ${MAX}`;
    };
    text.addEventListener('input', grow);
    grow();

    [from, text].forEach(f => {
      f.addEventListener('input', () => { if (tried) validate(f); status.textContent = ''; status.className = 'msg-status mono'; });
      f.addEventListener('blur', () => { if (tried) validate(f); });
    });

    const setStatus = (msg, kind) => { status.textContent = msg; status.className = 'msg-status mono' + (kind ? ' is-' + kind : ''); };

    form.addEventListener('submit', e => {
      e.preventDefault();
      tried = true;
      const ok = checks.map(([f]) => validate(f));
      if (ok.includes(false)) { checks[ok.indexOf(false)][0].focus(); return; }

      send.disabled = true;
      sendLabel.textContent = 'Sending…';
      setStatus('');
      sendMessage({ email: from.value.trim(), message: text.value.trim() })
        .then(() => {
          form.reset(); grow(); tried = false;
          setStatus('Thanks! Your message was sent. I’ll reply by email.', 'ok');
        })
        .catch(err => {
          setStatus(err.message === 'not-connected'
            ? 'Sending isn’t set up yet. Please email me at the address shown instead. Your message is still here.'
            : 'Couldn’t send just now. Please try again, or email me at the address shown.', 'bad');
        })
        .finally(() => { send.disabled = false; sendLabel.textContent = 'Send message'; });
    });
  }
})(window.MAE);
