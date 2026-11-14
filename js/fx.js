/* เอฟเฟกต์เกม: คอนเฟตติ, เสียงสังเคราะห์ (WebAudio), แฟลช, แบนเนอร์, สแปลช */
(() => {
  const $ = (s) => document.querySelector(s);
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const img = (n) => `<img class="gi" src="assets/game/${n}.webp" alt="" decoding="async">`;

  /* ---------- เสียง ---------- */
  let ac = null, muted = false;
  try { muted = localStorage.getItem('mg.mute') === '1'; } catch {}
  const ctx = () => {
    if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch {} }
    if (ac && ac.state === 'suspended') ac.resume();
    return ac;
  };
  function tone(f, t0, dur, type = 'sine', vol = 0.16, to) {
    const a = ctx(); if (!a) return;
    const o = a.createOscillator(), g = a.createGain(), t = a.currentTime + t0;
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(a.destination); o.start(t); o.stop(t + dur + 0.03);
  }
  const arp = (notes, step, type, vol, len = 0.22) => notes.forEach((f, i) => tone(f, i * step, len, type, vol));
  const SOUND = {
    click: () => tone(700, 0, 0.06, 'triangle', 0.1),
    pop: () => { tone(520, 0, 0.09, 'triangle', 0.12, 820); },
    vote: () => tone(480, 0, 0.08, 'triangle', 0.1, 360),
    tick: () => tone(1100, 0, 0.04, 'square', 0.05),
    correct: () => arp([523, 659, 784, 1047], 0.075, 'triangle', 0.15, 0.28),
    wrong: () => { tone(220, 0, 0.22, 'sawtooth', 0.1, 120); tone(165, 0.12, 0.28, 'sawtooth', 0.1, 90); },
    buzz: () => { tone(150, 0, 0.18, 'square', 0.1); tone(150, 0.22, 0.28, 'square', 0.1); },
    start: () => { tone(180, 0, 0.45, 'sawtooth', 0.05, 900); arp([392, 523, 659, 784], 0.1, 'square', 0.07, 0.3); },
    win: () => { arp([523, 523, 523, 659, 784, 659, 784, 1047], 0.11, 'triangle', 0.15, 0.3); tone(262, 0, 0.9, 'sine', 0.1); },
    lose: () => arp([392, 349, 330, 262], 0.18, 'triangle', 0.13, 0.4),
  };
  const play = (n) => { if (!muted && SOUND[n]) { try { SOUND[n](); } catch {} } };
  const vib = (p) => { if (!reduce && navigator.vibrate) { try { navigator.vibrate(p); } catch {} } };

  const sbtn = $('#sound');
  const speaker = () => {
    sbtn.innerHTML = `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5v5h4l5 4v-13l-5 4z"/>${muted ? '<path d="M17 9l5 6M22 9l-5 6"/>' : '<path d="M16.5 9a4 4 0 0 1 0 6M19 6.5a8 8 0 0 1 0 11"/>'}</svg>`;
    sbtn.setAttribute('aria-pressed', String(!muted)); sbtn.title = muted ? 'เปิดเสียง' : 'ปิดเสียง';
  };
  sbtn.addEventListener('click', () => { muted = !muted; try { localStorage.setItem('mg.mute', muted ? '1' : '0'); } catch {} speaker(); play('pop'); });
  speaker();
  document.addEventListener('pointerdown', () => ctx(), { once: true });

  /* ---------- คอนเฟตติ ---------- */
  const cv = $('#fx'), g = cv.getContext('2d');
  let W = 0, H = 0, parts = [], raf = 0;
  const size = () => { const d = Math.min(2, devicePixelRatio || 1); W = innerWidth; H = innerHeight; cv.width = W * d; cv.height = H * d; g.setTransform(d, 0, 0, d, 0, 0); };
  addEventListener('resize', size); size();
  const COL = ['#ff4a2e', '#ffc929', '#35c98b', '#59bdf6', '#8b6ee6', '#fff7e0', '#ff8fb1'];
  const rnd = (a, b) => a + Math.random() * (b - a);
  function spawn(n, x, y, o = {}) {
    n = reduce ? Math.min(n, 10) : n;
    const { angle = -Math.PI / 2, spread = Math.PI * 2, speed = 11, grav = 0.3, life = 120, stars = 0.15 } = o;
    for (let i = 0; i < n; i++) {
      const a = angle + rnd(-spread / 2, spread / 2), s = rnd(speed * 0.35, speed);
      parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, r: rnd(0, 6.28), vr: rnd(-0.3, 0.3), w: rnd(7, 13), h: rnd(5, 9), c: COL[(Math.random() * COL.length) | 0],
        k: Math.random() < stars ? 2 : Math.random() < 0.35 ? 1 : 0, grav, life, max: life });
    }
    if (!raf) raf = requestAnimationFrame(loop);
  }
  function star(x, y, r) {
    g.beginPath();
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
    g.closePath(); g.fill();
  }
  function loop() {
    g.clearRect(0, 0, W, H);
    parts = parts.filter((p) => p.life > 0 && p.y < H + 40);
    for (const p of parts) {
      p.vy += p.grav; p.vx *= 0.985; p.vy *= 0.99; p.x += p.vx; p.y += p.vy; p.r += p.vr; p.life--;
      g.save(); g.globalAlpha = Math.min(1, p.life / 30); g.translate(p.x, p.y); g.rotate(p.r); g.fillStyle = p.c;
      if (p.k === 2) { g.fillStyle = '#ffc929'; star(0, 0, p.w * 0.9); }
      else if (p.k === 1) { g.beginPath(); g.arc(0, 0, p.h * 0.7, 0, 6.28); g.fill(); }
      else g.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      g.restore();
    }
    raf = parts.length ? requestAnimationFrame(loop) : 0;
    if (!raf) g.clearRect(0, 0, W, H);
  }
  const burst = (x = W / 2, y = H * 0.4, n = 90) => spawn(n, x, y, { speed: 13 });
  const cannons = () => {
    spawn(70, 0, H, { angle: -Math.PI / 3, spread: 0.9, speed: 22, life: 150 });
    spawn(70, W, H, { angle: -Math.PI * 2 / 3, spread: 0.9, speed: 22, life: 150 });
    setTimeout(() => burst(W / 2, H * 0.3, 80), 350);
  };
  let rainT = 0;
  const rain = (ms = 2500) => {
    if (reduce) return; const end = Date.now() + ms; clearInterval(rainT);
    rainT = setInterval(() => { if (Date.now() > end) return clearInterval(rainT); spawn(5, rnd(0, W), -10, { angle: Math.PI / 2, spread: 0.6, speed: 4, grav: 0.12, life: 200, stars: 0.2 }); }, 90);
  };
  const sparkle = (x, y) => spawn(14, x, y, { speed: 6, life: 60, stars: 1, grav: 0.05 });

  /* ---------- แฟลช / สั่น / ข้อความลอย / แบนเนอร์ / สแปลช ---------- */
  function flash(kind = 'red') {
    if (reduce) return; const f = $('#flash'); f.className = ''; void f.offsetWidth; f.className = 'on ' + kind;
  }
  function shake(el = $('.stage')) {
    if (reduce || !el) return; el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake');
    setTimeout(() => el.classList.remove('shake'), 520);
  }
  function floaty(text, x = W / 2 - 30, y = H * 0.4) {
    const d = document.createElement('div'); d.className = 'floaty'; d.textContent = text; d.style.left = x + 'px'; d.style.top = y + 'px';
    document.body.appendChild(d); setTimeout(() => d.remove(), 1400);
  }
  function banner(text, icon = 'check') {
    const box = $('#banners'); while (box.children.length > 2) box.firstChild.remove();
    const d = document.createElement('div'); d.className = 'bn'; d.innerHTML = `${img(icon)}<span>${esc(text)}</span>`;
    box.appendChild(d);
    setTimeout(() => { d.classList.add('out'); setTimeout(() => d.remove(), 360); }, 2600);
  }
  let spT;
  function splash({ icon, title, sub = '', bad = false, ms = 1500 }) {
    const s = $('#splash'); clearTimeout(spT);
    s.className = 'on'; s.innerHTML = `<div class="sp ${bad ? 'bad' : ''}">${img(icon)}<b>${esc(title)}</b>${sub ? `<span>${esc(sub)}</span>` : ''}</div>`;
    spT = setTimeout(() => { s.className = 'off'; setTimeout(() => { s.className = ''; s.innerHTML = ''; }, 380); }, ms);
  }

  window.FX = { play, vib, burst, cannons, rain, sparkle, flash, shake, floaty, banner, splash, reduce, get muted() { return muted; } };
})();
