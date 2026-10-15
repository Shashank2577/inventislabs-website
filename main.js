/* ═══════════════════════════════════════════════════════════════
   INVENTIS LABS — RUNTIME
   One requestAnimationFrame loop drives every moving thing:
   smooth scroll, parallax, scrubbed sections, the seismographs,
   the P→S player, the map and the figure.
   ═══════════════════════════════════════════════════════════════ */
(() => {
'use strict';

const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const clamp = (v, a = 0, b = 1) => v < a ? a : v > b ? b : v;
const lerp  = (a, b, t) => a + (b - a) * t;
const rand  = (a, b) => a + Math.random() * (b - a);
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const COARSE  = matchMedia('(hover: none)').matches;

const PAL = {
  amber: [255, 106, 26],
  red:   [229, 52, 42],
  cyan:  [75, 224, 220],
  idle:  [108, 116, 128],
  grid:  'rgba(255,255,255,0.05)',
  axis:  'rgba(255,255,255,0.10)'
};
const rgb = (c, a = 1) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

/* ── canvas sizing with DPR ──────────────────────────────────── */
function fit(cv, cssH) {
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const w = cv.clientWidth || cv.parentElement?.clientWidth || 600;
  const h = cssH || cv.clientHeight || 200;
  cv.width  = Math.round(w * dpr);
  cv.height = Math.round(h * dpr);
  const ctx = cv.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, w, h, dpr };
}

/* ═══════════════════════════════════════════════════════════════
   THE LOOP — one rAF, everything reads from it
   ═══════════════════════════════════════════════════════════════ */
const Loop = {
  jobs: new Set(),
  last: performance.now(),
  time: 0,
  scrollY: scrollY,
  smooth: scrollY,          /* eased scroll, for parallax */
  vel: 0,                   /* eased scroll velocity */
  add(fn) { this.jobs.add(fn); },
  start() {
    const tick = now => {
      const dt = Math.min(now - this.last, 50);
      this.last = now;
      this.time = now;

      this.scrollY = scrollY;
      const prev = this.smooth;
      this.smooth = REDUCED ? this.scrollY : lerp(this.smooth, this.scrollY, 1 - Math.exp(-dt / 70));
      this.vel = lerp(this.vel, (this.scrollY - prev) / Math.max(dt, 1) * 16, 1 - Math.exp(-dt / 90));

      for (const job of this.jobs) job(dt, now);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
};

/* run `fn` only while `el` is on screen */
function whileVisible(el, fn) {
  let on = false, was = false;
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(es => { on = es[es.length - 1].isIntersecting; }, { rootMargin: '120px' }).observe(el);
  } else on = true;
  Loop.add((dt, now) => {
    if (!on && !was) return;
    was = on;
    fn(dt, now);
  });
}

/* ═══ 1 · SCROLL PROGRESS ═══════════════════════════════════ */
function initProgress() {
  const bar = $('[data-progress]');
  if (!bar) return;
  let x = 0;
  Loop.add(() => {
    const max = document.documentElement.scrollHeight - innerHeight;
    const want = max > 0 ? clamp(scrollY / max) : 0;
    x = lerp(x, want, 0.22);
    bar.style.width = (x * 100).toFixed(2) + '%';
  });
}

/* ═══ 2 · NAV ════════════════════════════════════════════════ */
function initNav() {
  const nav = $('[data-nav]');
  if (!nav) return;
  let last = scrollY;
  addEventListener('scroll', () => {
    const y = scrollY;
    nav.classList.toggle('is-stuck', y > 24);
    nav.classList.toggle('is-hidden', y > 420 && y > last);
    last = y;
  }, { passive: true });

  const sheet = $('[data-menu]');
  const toggle = $('[data-menu-toggle]');
  if (!sheet || !toggle) return;
  const setOpen = open => {
    sheet.classList.toggle('is-open', open);
    sheet.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
    document.body.classList.toggle('is-locked', open);
    if (open) nav.classList.remove('is-hidden');
  };
  toggle.addEventListener('click', () => setOpen(sheet.hidden));
  sheet.addEventListener('click', e => { if (e.target.closest('a')) setOpen(false); });
  addEventListener('keydown', e => { if (e.key === 'Escape' && !sheet.hidden) setOpen(false); });

  const links = $$('[data-navlink]');
  const map = new Map();
  links.forEach(a => {
    const sec = document.getElementById(a.getAttribute('href').slice(1));
    if (sec) map.set(sec, a);
  });
  if (!map.size) return;
  const spy = new IntersectionObserver(es => {
    es.forEach(e => {
      if (!e.isIntersecting) return;
      links.forEach(a => a.classList.remove('is-active'));
      map.get(e.target)?.classList.add('is-active');
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  map.forEach((_, sec) => spy.observe(sec));
}

/* ═══ 3 · REVEALS + STAGGER ═════════════════════════════════ */
function initReveal() {
  const els = $$('[data-in]');
  els.forEach(el => {
    if (el.dataset.in === 'mask' && el.firstElementChild?.className !== 'mask-in') {
      const inner = document.createElement('span');
      inner.className = 'mask-in';
      while (el.firstChild) inner.appendChild(el.firstChild);
      el.appendChild(inner);
    }
    if (el.hasAttribute('data-stagger')) {
      Array.from(el.children).forEach((kid, i) => kid.style.setProperty('--i', i));
    }
  });
  if (REDUCED || !('IntersectionObserver' in window)) {
    els.forEach(e => e.classList.add('is-in'));
    return;
  }
  const io = new IntersectionObserver((es, self) => {
    es.forEach(e => {
      if (!e.isIntersecting) return;
      e.target.classList.add('is-in');
      self.unobserve(e.target);
    });
  }, { rootMargin: '0px 0px -10% 0px', threshold: 0.06 });
  els.forEach(el => io.observe(el));
}

/* ═══ 4 · PARALLAX ═══════════════════════════════════════════ */
function initParallax() {
  const items = $$('[data-parallax]').map(el => ({
    el, k: parseFloat(el.dataset.parallax) || 0, y: 0
  }));
  if (!items.length) return;
  whileVisible(document.body, () => {
    const vh = innerHeight;
    for (const it of items) {
      const r = it.el.getBoundingClientRect();
      if (r.bottom < -200 || r.top > vh + 200) continue;
      const centre = r.top + r.height / 2 - vh / 2;
      const want = -centre * it.k;
      it.y = lerp(it.y, want, 0.14);
      it.el.style.transform = `translate3d(0, ${it.y.toFixed(2)}px, 0)`;
    }
  });
}

/* ═══ 5 · COUNTERS ═══════════════════════════════════════════ */
function initCounters() {
  const els = $$('[data-count]');
  if (!els.length) return;
  const run = el => {
    const to = +el.dataset.count || 0;
    if (REDUCED) { el.textContent = to.toLocaleString('en-IN'); return; }
    const t0 = performance.now();
    const step = now => {
      const p = clamp((now - t0) / 1800);
      el.textContent = Math.round(to * (1 - Math.pow(1 - p, 3))).toLocaleString('en-IN');
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };
  if (!('IntersectionObserver' in window)) return els.forEach(run);
  const io = new IntersectionObserver((es, self) => {
    es.forEach(e => { if (e.isIntersecting) { run(e.target); self.unobserve(e.target); } });
  }, { threshold: 0.6 });
  els.forEach(el => io.observe(el));
}

/* ═══ 6 · CURSOR ══════════════════════════════════════════════ */
function initCursor() {
  const box = $('[data-cursor]');
  if (!box || COARSE || REDUCED) return;
  const dot = $('[data-cursor-dot]', box);
  const ring = $('[data-cursor-ring]', box);
  const tx = { x: innerWidth / 2, y: innerHeight / 2 };
  const rx = { ...tx };
  let hot = false, text = false, shown = false;

  addEventListener('pointermove', e => {
    tx.x = e.clientX; tx.y = e.clientY;
    if (!shown) { shown = true; rx.x = tx.x; rx.y = tx.y; box.classList.add('is-on'); }
    const t = e.target;
    const h = t.closest('a,button,summary,label,input,textarea,select,[role="slider"]');
    const x = !!t.closest('input,textarea');
    if (h !== hot) { hot = !!h; box.classList.toggle('is-hot', hot); }
    if (x !== text) { text = x; box.classList.toggle('is-text', text); }
  }, { passive: true });
  addEventListener('pointerdown', () => box.style.setProperty('scale', '.82'));
  addEventListener('pointerup',   () => box.style.setProperty('scale', '1'));
  addEventListener('pointerleave', () => box.classList.remove('is-on'));

  Loop.add(() => {
    rx.x = lerp(rx.x, tx.x, 0.16);
    rx.y = lerp(rx.y, tx.y, 0.16);
    dot.style.transform  = `translate(${tx.x}px, ${tx.y}px) translate(-50%,-50%) scale(${box.style.getPropertyValue('scale') || 1})`;
    ring.style.transform = `translate(${rx.x.toFixed(1)}px, ${rx.y.toFixed(1)}px) translate(-50%,-50%) scale(${box.style.getPropertyValue('scale') || 1})`;
  });
}

/* ═══ 7 · MAGNETIC BUTTONS ═══════════════════════════════════ */
function initMagnets() {
  const els = $$('[data-magnet]');
  if (!els.length || COARSE || REDUCED) return;
  els.forEach(el => {
    const st = { x: 0, y: 0, tx: 0, ty: 0, mx: 50, my: 50, live: false };
    el.addEventListener('pointermove', e => {
      const r = el.getBoundingClientRect();
      st.mx = ((e.clientX - r.left) / r.width) * 100;
      st.my = ((e.clientY - r.top) / r.height) * 100;
      st.tx = (e.clientX - (r.left + r.width / 2)) * 0.28;
      st.ty = (e.clientY - (r.top + r.height / 2)) * 0.38;
      st.live = true;
      el.style.setProperty('--mx', st.mx.toFixed(1) + '%');
    });
    el.addEventListener('pointerleave', () => { st.tx = 0; st.ty = 0; st.live = false; });
    Loop.add(() => {
      if (!st.live && Math.abs(st.x) < 0.05 && Math.abs(st.y) < 0.05) return;
      st.x = lerp(st.x, st.tx, 0.16);
      st.y = lerp(st.y, st.ty, 0.16);
      el.style.setProperty('--tx', st.x.toFixed(2) + 'px');
      el.style.setProperty('--ty', st.y.toFixed(2) + 'px');
    });
  });
}

/* ═══ 8 · TILT + SHEEN ═══════════════════════════════════════ */
function initTilt() {
  const els = $$('[data-tilt]');
  if (!els.length || COARSE || REDUCED) return;
  els.forEach(el => {
    const st = { rx: 0, ry: 0, trx: 0, try_: 0, live: false };
    el.addEventListener('pointermove', e => {
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width;
      const py = (e.clientY - r.top) / r.height;
      el.style.setProperty('--gx', (px * 100).toFixed(1) + '%');
      el.style.setProperty('--gy', (py * 100).toFixed(1) + '%');
      st.trx = (0.5 - py) * 5;
      st.try_ = (px - 0.5) * 6;
      st.live = true;
    });
    el.addEventListener('pointerleave', () => { st.trx = 0; st.try_ = 0; st.live = false; });
    Loop.add(() => {
      if (!st.live && Math.abs(st.rx) < 0.01 && Math.abs(st.ry) < 0.01) return;
      st.rx = lerp(st.rx, st.trx, 0.12);
      st.ry = lerp(st.ry, st.try_, 0.12);
      el.style.transform = `perspective(900px) rotateX(${st.rx.toFixed(2)}deg) rotateY(${st.ry.toFixed(2)}deg)`;
    });
  });
}

/* ═══ 9 · TOAST ══════════════════════════════════════════════ */
function toast(msg) {
  const el = $('[data-toast]');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('is-up');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('is-up'), 2400);
}
function initCopy() {
  $$('[data-copy]').forEach(a => a.addEventListener('click', async e => {
    try {
      await navigator.clipboard.writeText(a.dataset.copy);
      toast('Copied ' + a.dataset.copy);
    } catch { toast(a.dataset.copy); }
  }));
}

/* ═══ 10 · TICKER — reacts to scroll velocity ════════════════ */
function initTicker() {
  const track = $('.ticker__track');
  if (!track || REDUCED) return;
  let x = 0;
  const setW = () => { track.dataset.w = track.scrollWidth / 2 || 1; };
  setW();
  addEventListener('resize', setW);
  whileVisible(track, (dt, now) => {
    const speed = 0.42 + Math.min(Math.abs(Loop.vel) * 0.9, 7);
    x -= speed * (dt / 16.67);
    const half = +track.dataset.w;
    if (x <= -half) x += half;
    if (x > 0) x -= half;
    track.style.transform = `translate3d(${x.toFixed(1)}px,0,0)`;
  });
}

/* ═══ 11 · SEISMOGRAPH ENGINE ════════════════════════════════ */
function seismograph(cv, opts = {}) {
  const {
    amp = 1, idleAmp = 1, thickness = 1.35, cssH = null,
    gridStep = 64, glow = true, seed = true, hero = false
  } = opts;

  const N = 1400;
  const buf = new Float32Array(N);
  let head = 0, peak = 1, ev = null, drift = 0;
  let dims = fit(cv, cssH);
  let nextEv = performance.now() + rand(900, 2400);
  let scrollK = 0;

  addEventListener('resize', () => { dims = fit(cv, cssH); }, { passive: true });
  addEventListener('scroll', () => {
    const max = document.documentElement.scrollHeight - innerHeight;
    scrollK = clamp(scrollY / (max || 1));
  }, { passive: true });

  function spawn() {
    ev = {
      t: 0, dur: hero ? rand(2400, 3600) : rand(1600, 2500),
      amp: rand(.55, 1),
      freq: hero ? rand(9, 17) : rand(32, 54),
      decay: rand(.55, 1), phase: rand(0, 6.28)
    };
  }

  function sample(now) {
    drift = drift * 0.9 + (Math.random() - 0.5) * (hero ? 0.22 : 0.3);
    let v = drift * 0.5 + (Math.random() - 0.5) * idleAmp;
    if (!ev && seed && now > nextEv) {
      if (Math.random() < 0.72) spawn();
      nextEv = now + rand(2600, 6200);
    }
    if (ev) {
      ev.t += 16.7;
      if (ev.t > ev.dur) ev = null;
      else {
        const u = ev.t / 1000;
        const env = Math.exp(-u * ev.decay * (hero ? 1.8 : 2.3)) * clamp(ev.t / (hero ? 120 : 70));
        const f = ev.freq;
        v += (Math.sin(2 * Math.PI * f * u + ev.phase) * .62
            + Math.sin(2 * Math.PI * f * .29 * u) * .3
            + (Math.random() - .5) * .3) * env * ev.amp;
      }
    }
    return v;
  }

  const bands = hero
    ? [{ t: a => a < .26, c: 'rgba(150,160,176,.55)' },
       { t: a => a < .58, c: 'rgba(75,224,220,.75)' },
       { t: a => a < .84, c: 'rgba(255,106,26,.85)' },
       { t: () => true,  c: 'rgba(229,52,42,.95)' }]
    : [{ t: a => a < 0.26, c: rgb(PAL.idle, .6) },
       { t: a => a < 0.58, c: rgb(PAL.cyan, .75) },
       { t: a => a < 0.84, c: rgb(PAL.amber, .95) },
       { t: () => true,    c: rgb(PAL.red, .98) }];

  const draw = (_dt, now) => {
    const { ctx, w, h } = dims;
    buf[head] = sample(now);
    head = (head + 1) % N;
    peak = Math.max(peak * (hero ? .995 : .996), Math.abs(buf[head - 1]), 0.0001);

    ctx.clearRect(0, 0, w, h);

    ctx.strokeStyle = PAL.grid; ctx.lineWidth = 1;
    ctx.beginPath();
    const step = hero ? 64 : gridStep;
    const off = (now / 30) % step;
    for (let x = off; x < w; x += step) { ctx.moveTo(x + .5, 0); ctx.lineTo(x + .5, h); }
    for (let y = step / 2; y < h; y += step / 2) { ctx.moveTo(0, y + .5); ctx.lineTo(w, y + .5); }
    ctx.stroke();

    const mid = hero ? h * (0.76 + scrollK * 0.1) : h / 2;
    ctx.strokeStyle = PAL.axis;
    ctx.beginPath(); ctx.moveTo(0, mid + .5); ctx.lineTo(w, mid + .5); ctx.stroke();

    /* `ref` floors the reference so an idle channel never normalises to
       full scale, which would paint the flat line hot-red */
    const scale = (hero ? h * (innerWidth < 720 ? 0.11 : 0.2) : h * 0.44) * amp;
    const ref = Math.max(peak, idleAmp * (hero ? 1.6 : 0.8));

    if (glow) { ctx.shadowColor = 'rgba(255,106,26,.32)'; ctx.shadowBlur = hero ? 14 : 10; }
    for (const band of bands) {
      ctx.beginPath();
      ctx.strokeStyle = band.c;
      ctx.lineWidth = thickness;
      ctx.lineJoin = 'round';
      let pen = false;
      for (let i = 0; i < N; i += 2) {
        const val = buf[(head + i) % N];
        if (!band.t(Math.abs(val) / ref)) { pen = false; continue; }
        const x = (i / (N - 1)) * w;
        const y = mid - val * scale;
        pen ? ctx.lineTo(x, y) : (ctx.moveTo(x, y), pen = true);
      }
      ctx.stroke();
    }
    ctx.shadowBlur = 0;
  };

  whileVisible(cv, draw);
}

/* ═══ 12 · P → S EVENT PLAYER (scroll-scrubbed) ═════════════ */
const PHASES = [
  { at: 0.00, label: 'ARMED',    step: -1 },
  { at: 0.10, label: 'DETECT',   step: 0 },
  { at: 0.24, label: 'ANALYSE',  step: 1 },
  { at: 0.40, label: 'BROADCAST',step: 2 },
  { at: 0.60, label: 'RESPOND',  step: 3 },
  { at: 0.80, label: 'IMPACT',   step: 4 }
];
const SPAN = 6.4;
const P_AT = 0.115, S_AT = 0.845;

function initPlayer() {
  const root = $('[data-player]');
  if (!root) return;
  const section = root.closest('[data-scrub="player"]') || root;
  const cv   = $('[data-player-canvas]', root);
  const fill = $('[data-player-fill]', root);
  const knob = $('[data-player-knob]', root);
  const track = $('[data-player-track]', root);
  const clock = $('[data-player-time]', root);
  const stateEl = $('[data-player-state]', root);
  const steps = $$('[data-steps] .step');
  const rail = $('[data-mech-rail]');

  let dims = fit(cv, cv.clientHeight || 240);
  addEventListener('resize', () => { dims = fit(cv, cv.clientHeight || 240); }, { passive: true });

  let p = 0, dragging = false, held = false;

  const setP = v => {
    p = clamp(v);
    fill.style.width = (p * 100) + '%';
    knob.style.left = (p * 100) + '%';
    clock.textContent = (p * SPAN).toFixed(1);
    let ph = PHASES[0];
    for (const q of PHASES) if (p >= q.at) ph = q;
    if (stateEl.textContent !== ph.label) {
      stateEl.textContent = ph.label;
      stateEl.classList.toggle('is-warn', ph.label === 'BROADCAST');
      stateEl.classList.toggle('is-impact', ph.label === 'IMPACT');
    }
    steps.forEach((s, i) => s.classList.toggle('is-on', i === ph.step));
    track.setAttribute('aria-valuenow', String(Math.round(p * 100)));
  };

  /* canvas */
  const wave = (x, c, freq, decay, alpha) => {
    const u = (x - c) / 1000;
    return Math.sin(u * 62 + 1.2) * Math.exp(-Math.abs(u) * freq) * decay * alpha
         + Math.sin(u * 168) * Math.exp(-Math.abs(u) * freq) * decay * alpha * 0.35;
  };
  const label = (c, txt, x, y, color, anchor = 'center', size = 11) => {
    c.save();
    c.font = `700 ${size}px 'JetBrains Mono', monospace`;
    c.fillStyle = color; c.textAlign = anchor;
    c.fillText(txt, x, y);
    c.restore();
  };

  function draw() {
    const { ctx, w, h } = dims;
    ctx.clearRect(0, 0, w, h);
    const mid = h / 2;
    const X = t => t * w;

    ctx.lineWidth = 1; ctx.strokeStyle = PAL.grid;
    ctx.beginPath();
    for (let x = w / 12; x < w; x += w / 12) { ctx.moveTo(Math.round(x) + .5, 0); ctx.lineTo(Math.round(x) + .5, h); }
    for (let y = 0; y < h; y += h / 4) { ctx.moveTo(0, Math.round(y) + .5); ctx.lineTo(w, Math.round(y) + .5); }
    ctx.stroke();
    ctx.strokeStyle = PAL.axis;
    ctx.beginPath(); ctx.moveTo(0, mid + .5); ctx.lineTo(w, mid + .5); ctx.stroke();

    /* P packet */
    const px = X(P_AT);
    ctx.save();
    ctx.shadowColor = 'rgba(76,141,255,.45)'; ctx.shadowBlur = 12;
    ctx.strokeStyle = 'rgba(76,141,255,.95)'; ctx.lineWidth = 1.6;
    ctx.beginPath();
    for (let x = Math.max(0, px - 130); x <= Math.min(w, px + 260); x += 2) {
      const y = mid - wave(x, px, 22, 1, 26);
      x === Math.max(0, px - 130) ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke(); ctx.restore();
    label(ctx, 'P', px, mid - 44, 'rgba(76,141,255,1)', 'left');

    /* broadcast wavefronts */
    if (p > 0.36) {
      const k = clamp((p - 0.36) / 0.26);
      for (let i = 0; i < 4; i++) {
        const r = k * w * 1.05 - i * 62;
        if (r <= 0) continue;
        ctx.beginPath(); ctx.arc(px, mid, r, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255,106,26,${clamp(.42 - i * .09) * (1 - k * .35)})`;
        ctx.lineWidth = 1.5; ctx.stroke();
      }
    }

    /* automated actions */
    if (p > 0.58) {
      ['GAS', 'LIFT', 'PA', 'SAFE'].forEach((a, i) => {
        const at = 0.60 + i * 0.045;
        if (p < at) return;
        const x = X(at), y = h - 14;
        ctx.strokeStyle = 'rgba(75,224,220,.75)'; ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.moveTo(x, y - 7); ctx.lineTo(x, y); ctx.stroke();
        label(ctx, a, x + 4, y - 8, 'rgba(75,224,220,.9)', 'left', 9);
      });
    }

    /* S wave — ghosted until the playhead arrives */
    const sx = X(S_AT);
    const passed = p >= S_AT;
    const envS = passed ? clamp((p - S_AT) / 0.06) : 0;
    ctx.save();
    ctx.shadowColor = passed ? 'rgba(229,52,42,.55)' : 'transparent';
    ctx.shadowBlur = passed ? 18 + envS * 30 : 0;
    ctx.strokeStyle = passed ? `rgba(229,52,42,${.5 + envS * .5})` : 'rgba(229,52,42,.13)';
    ctx.lineWidth = passed ? 2 + envS : 1.4;
    ctx.beginPath();
    for (let x = Math.max(0, sx - 200); x < w; x += 2) {
      const y = mid - wave(x, sx, 3.4, 1, 40 * (1 + envS));
      x === Math.max(0, sx - 200) ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke(); ctx.restore();
    label(ctx, 'S', sx, mid - 44, passed ? 'rgba(229,52,42,1)' : 'rgba(229,52,42,.45)', 'left');

    /* playhead */
    const hx = X(p);
    const grad = ctx.createLinearGradient(hx - 52, 0, hx, 0);
    grad.addColorStop(0, 'rgba(255,255,255,0)');
    grad.addColorStop(1, 'rgba(255,255,255,.055)');
    ctx.fillStyle = grad; ctx.fillRect(hx - 52, 0, 52, h);
    ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(hx + .5, 0); ctx.lineTo(hx + .5, h); ctx.stroke();
    ctx.fillStyle = p > S_AT ? PAL.red : p > P_AT ? PAL.amber : 'rgba(255,255,255,.6)';
    ctx.beginPath(); ctx.arc(hx, 8, 3.5, 0, Math.PI * 2); ctx.fill();

    ctx.strokeStyle = 'rgba(255,255,255,.09)'; ctx.setLineDash([3, 5]);
    PHASES.slice(1).forEach(ph => {
      ctx.beginPath(); ctx.moveTo(X(ph.at) + .5, 0); ctx.lineTo(X(ph.at) + .5, h); ctx.stroke();
    });
    ctx.setLineDash([]);
  }

  /* scrub by pointer */
  const fromEvent = e => {
    const r = track.getBoundingClientRect();
    return clamp((e.clientX - r.left) / r.width);
  };
  track.addEventListener('pointerdown', e => {
    dragging = true; held = true;
    track.setPointerCapture(e.pointerId);
    setP(fromEvent(e)); draw();
  });
  track.addEventListener('pointermove', e => { if (dragging) { setP(fromEvent(e)); draw(); } });
  const end = e => { if (!dragging) return; dragging = false; try { track.releasePointerCapture(e.pointerId); } catch {} };
  track.addEventListener('pointerup', end);
  track.addEventListener('pointercancel', end);
  track.addEventListener('keydown', e => {
    if (e.key === 'ArrowRight') setP(p + (e.shiftKey ? .01 : .06));
    else if (e.key === 'ArrowLeft') setP(p - (e.shiftKey ? .01 : .06));
    else if (e.key === 'Home') setP(0);
    else if (e.key === 'End') setP(1);
    else return;
    e.preventDefault(); held = true; draw();
  });

  /* scroll drives it, unless the reader has taken hold */
  const pinned = getComputedStyle(section).position === 'sticky' || section.offsetHeight > innerHeight * 2;
  whileVisible(section, () => {
    if (!held || dragging) {
      if (!held) {
        const r = section.getBoundingClientRect();
        const travel = section.offsetHeight - innerHeight;
        const prog = travel > 0 ? clamp(-r.top / travel) : 0;
        setP(prog);
        if (rail) rail.style.width = (prog * 100).toFixed(1) + '%';
      }
      draw();
    }
  });
  /* idle autoplay once the reader leaves the section */
  if (!pinned) setInterval(() => { if (!held) { setP((p + .004) % 1); draw(); } }, 40);
}

/* ═══ 13 · INDIA DOT-MATRIX MAP ══════════════════════════════ */
const INDIA = [
  [340,95],[425,114],[476,289],[544,334],[748,418],[952,388],[1020,372],
  [935,475],[868,608],[874,622],[816,551],[731,513],[714,437],[680,623],
  [612,693],[510,796],[434,1050],[357,1138],[316,1084],[265,954],[197,722],
  [68,597],[41,540],[102,388],[255,266],[323,133]
];
const HOTSPOTS = {
  n: { x: 347, y: 357, label: 'Delhi NCR',   color: PAL.red,   n: 450 },
  w: { x: 119, y: 551, label: 'Kutch',       color: PAL.amber, n: 350 },
  e: { x: 846, y: 471, label: 'Shillong',    color: [169,112,255], n: 300 },
  c: { x: 391, y: 616, label: 'Narmada–Son', color: PAL.cyan,  n: 200 }
};
const inPoly = (px, py, poly) => {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
};

function initMap() {
  const cv = $('[data-map]');
  if (!cv) return;
  const GAP = 13;
  let dims = fit(cv), dots = null, m = null;

  function build() {
    dims = fit(cv);
    const { w, h } = dims;
    const xs = INDIA.map(p => p[0]), ys = INDIA.map(p => p[1]);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const pad = 18;
    const s = Math.min((w - pad * 2) / (maxX - minX), (h - pad * 2) / (maxY - minY));
    m = { s, ox: (w - (maxX - minX) * s) / 2 - minX * s, oy: (h - (maxY - minY) * s) / 2 - minY * s };
    const pts = [];
    for (let y = minY; y <= maxY; y += GAP)
      for (let x = minX; x <= maxX; x += GAP)
        if (inPoly(x, y, INDIA)) pts.push([x * s + m.ox, y * s + m.oy]);
    dots = pts;
  }
  build();
  addEventListener('resize', build, { passive: true });

  const hot = new Set();
  $$('.region').forEach(r => {
    r.addEventListener('pointerenter', () => hot.add(r.dataset.region));
    r.addEventListener('pointerleave', () => hot.delete(r.dataset.region));
  });

  whileVisible(cv, (_dt, now) => {
    const { ctx, w, h } = dims;
    const t = now / 1000;
    ctx.clearRect(0, 0, w, h);

    dots.forEach(([x, y], i) => {
      ctx.fillStyle = `rgba(198,208,222,${0.2 + (0.5 + 0.5 * Math.sin(t * 1.5 + i * 0.35)) * 0.16})`;
      ctx.fillRect(x - 1, y - 1, 2, 2);
    });

    for (const [key, hs] of Object.entries(HOTSPOTS)) {
      const x = hs.x * m.s + m.ox, y = hs.y * m.s + m.oy;
      const on = hot.has(key);
      const r = (on ? 62 : 42) + (0.5 + 0.5 * Math.sin(t * 1.9)) * (on ? 22 : 12);
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, rgb(hs.color, on ? .42 : .24));
      g.addColorStop(1, rgb(hs.color, 0));
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();

      ctx.fillStyle = rgb(hs.color, .95);
      ctx.beginPath(); ctx.arc(x, y, on ? 4.5 : 3.4, 0, Math.PI * 2); ctx.fill();

      const ph = (t * 0.55) % 1;
      ctx.strokeStyle = rgb(hs.color, (1 - ph) * .5); ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(x, y, 8 + ph * 34, 0, Math.PI * 2); ctx.stroke();

      if (on) {
        ctx.textAlign = 'center';
        ctx.font = "600 10px 'JetBrains Mono', monospace";
        ctx.fillStyle = rgb(hs.color, .95);
        ctx.fillText(hs.label.toUpperCase(), x, y - 58);
        ctx.font = "700 12px 'JetBrains Mono', monospace";
        ctx.fillText(hs.n + '+ NODES', x, y - 44);
      }
    }

    const sy = ((t * 0.11) % 1.2) * h;
    const sg = ctx.createLinearGradient(0, sy - 60, 0, sy + 60);
    sg.addColorStop(0, 'rgba(255,106,26,0)');
    sg.addColorStop(.5, 'rgba(255,106,26,.14)');
    sg.addColorStop(1, 'rgba(255,106,26,0)');
    ctx.fillStyle = sg; ctx.fillRect(0, sy - 60, w, 120);
  });
}

/* ═══ 14 · SOLUTIONS — pinned horizontal scroll ═══════════════ */
function initRail() {
  const section = $('[data-scrub="rail"]');
  const rail = $('[data-sols-rail]');
  if (!section || !rail) return;
  const prev = $('[data-sols-prev]'), next = $('[data-sols-next]');
  const bar = $('[data-sols-track]');
  const pinned = section.offsetHeight > innerHeight * 1.6;

  let max = 0, x = 0;
  const measure = () => {
    const pad = parseFloat(getComputedStyle(rail).paddingLeft) || 0;
    max = Math.max(0, rail.scrollWidth - innerWidth + pad);
  };
  measure();
  addEventListener('resize', measure, { passive: true });

  if (pinned && !REDUCED) {
    whileVisible(section, () => {
      const r = section.getBoundingClientRect();
      const travel = section.offsetHeight - innerHeight;
      const prog = travel > 0 ? clamp(-r.top / travel) : 0;
      const want = -prog * max;
      x = lerp(x, want, 0.12);
      rail.style.transform = `translate3d(${x.toFixed(2)}px,0,0)`;
      if (bar) bar.style.width = (max ? (x / -max) * 100 : 0).toFixed(1) + '%';
      sync();
    });
  }

  function sync() {
    if (!prev || !next) return;
    const at0 = pinned ? x >= -4 : rail.scrollLeft < 8;
    const at1 = pinned ? x <= -max + 4 : rail.scrollLeft > rail.scrollWidth - rail.clientWidth - 8;
    prev.disabled = at0; next.disabled = at1;
  }

  if (prev && next) {
    const step = () => {
      const first = rail.firstElementChild;
      if (!first) return 320;
      return first.getBoundingClientRect().width + 16;
    };
    prev.addEventListener('click', () => pinned
      ? (x += step(), x = Math.min(0, Math.max(-max, x)), rail.style.transform = `translate3d(${x}px,0,0)`)
      : rail.scrollBy({ left: -step(), behavior: 'smooth' }));
    next.addEventListener('click', () => pinned
      ? (x -= step(), x = Math.max(-max, Math.min(0, x)), rail.style.transform = `translate3d(${x}px,0,0)`)
      : rail.scrollBy({ left: step(), behavior: 'smooth' }));
    rail.addEventListener('scroll', sync, { passive: true });
    sync();
  }
}

/* ═══ 15 · PANEL TABS ════════════════════════════════════════ */
function initTabs() {
  $$('[data-tabs]').forEach(bar => {
    const all = bar.parentElement.querySelectorAll('[data-tabpanel]');
    const btns = $$('button', bar);
    btns.forEach(b => b.addEventListener('click', () => {
      const i = +b.dataset.tab;
      btns.forEach(x => x.classList.toggle('is-on', x === b));
      all.forEach((p, j) => { p.hidden = j !== i; });
    }));
  });
}

/* ═══ 16 · PILOT FORM ════════════════════════════════════════ */
function initForm() {
  const form = $('[data-pilot-form]');
  if (!form) return;
  const note = $('[data-form-note]', form);
  const label = $('[data-submit-label]', form);
  const btn = $('button[type="submit"]', form);

  form.addEventListener('submit', e => {
    e.preventDefault();
    const bad = [];
    $$('input,select,textarea', form).forEach(f => {
      if (!f.required) return;
      const wrap = f.closest('.field');
      const fail = f.type === 'checkbox' ? !f.checked : (!f.value.trim() || !f.checkValidity());
      if (wrap) wrap.classList.toggle('is-bad', fail);
      if (fail && f.type !== 'checkbox') bad.push(f);
    });

    const agree = form.querySelector('[name="agree"]');
    if (agree && !agree.checked) {
      note.textContent = 'Please accept the terms to continue.';
      note.className = 'form__note is-bad';
      agree.focus();
      return;
    }
    if (bad.length) {
      note.textContent = 'Complete the highlighted fields.';
      note.className = 'form__note is-bad';
      bad[0].focus();
      return;
    }

    btn.disabled = true;
    label.textContent = 'Transmitting…';
    note.textContent = '';

    setTimeout(() => {
      btn.disabled = false;
      label.textContent = 'Request received';
      note.textContent = 'Logged. The EQ-Alert team replies within 24 hours.';
      note.className = 'form__note is-ok';
      form.reset();
      toast('Pilot request sent');
    }, 1100);
  });

  $$('.field input,.field textarea,.field select', form).forEach(f =>
    f.addEventListener('input', () => f.closest('.field')?.classList.remove('is-bad')));
}

/* ═══ 17 · MISC ═════════════════════════════════════════════ */
function initMisc() {
  const y = $('[data-year]');
  if (y) y.textContent = new Date().getFullYear();

  const up = $('[data-uptime]');
  if (up && !REDUCED) {
    let v = 99.9;
    setInterval(() => {
      v = clamp(v + rand(-.03, .03), 99.82, 99.98);
      up.textContent = v.toFixed(2) + '%';
    }, 3200);
  }
}

/* ═══ 18 · THE FIGURE ════════════════════════════════════════ */
function initFigure() {
  const stage = $('.fig-stage');
  if (!stage) return;
  const svgEl = stage.querySelector('svg');
  const needle = svgEl.querySelector('[data-part="needle"]');
  const lampG = svgEl.querySelector('.fig-lamp');
  const screenG = svgEl.querySelector('.fig-screen');
  const readout = stage.querySelector('[data-readout]');
  if (!needle) return;

  const still = REDUCED;
  const TONE = { green: '#4be0dc', amber: '#ff6a1a', red: '#e5342a' };
  const DEEP = { green: '#1F6E6B', amber: '#A3460F', red: '#8E1C16' };

  const P = JSON.parse(stage.dataset.proj);
  const DIAL = JSON.parse(stage.dataset.dial);
  const DIAL_TOP = +stage.dataset.dialTop;
  const TAIL = +stage.dataset.tail;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lineOnTop = (a, b, z, p) => {
    const sinA = Math.sin((p.azimuth ?? 42) * Math.PI / 180);
    const cosA = Math.cos((p.azimuth ?? 42) * Math.PI / 180);
    const sinE = Math.sin((p.elevation ?? 30) * Math.PI / 180);
    const cosE = Math.cos((p.elevation ?? 30) * Math.PI / 180);
    const k = p.scale;
    /* the kit's lineOnTop takes a flat [x, y] plus a separate height */
    const s = pt => [
      p.origin[0] + (pt[0] * sinA - pt[1] * cosA) * k,
      p.origin[1] + ((pt[0] * cosA + pt[1] * sinA) * sinE - z * cosE) * k
    ];
    const A = s(a), B = s(b);
    return `M${A[0].toFixed(1)} ${A[1].toFixed(1)}L${B[0].toFixed(1)} ${B[1].toFixed(1)}`;
  };
  const needleAt = turn => {
    const a = (-0.78 + turn / 1.5 * 1.56) * Math.PI;
    return lineOnTop(
      [DIAL[0] - Math.sin(a) * 4.8, DIAL[1] + Math.cos(a) * 4.8],
      [DIAL[0] + Math.sin(a) * (24 - 5.4), DIAL[1] - Math.cos(a) * (24 - 5.4)],
      DIAL_TOP + 0.3, P
    );
  };

  const groundAt = t => {
    if (t < 0 || t > TAIL) return 0;
    const pE = Math.exp(-t / 0.85);
    const p = 0.055 * pE * Math.sin(2 * Math.PI * 7.4 * t);
    const u = t - 3.4;
    const sE = u < 0 ? 0 : Math.exp(-u / 2.6) * (1 - Math.exp(-u / 0.55));
    const s = 0.34 * sE * Math.sin(2 * Math.PI * 2.35 * u);
    return p + s + 0.0025 * Math.sin(2 * Math.PI * 0.45 * t + 1.1);
  };
  const stateAt = t => {
    if (t < 0)    return { label: 'armed',   tone: 'green' };
    if (t < 3.4)  return { label: 'p-wave',  tone: 'amber' };
    if (t < 10.4) return { label: 's-wave',  tone: 'red' };
    return { label: 'settling', tone: 'amber' };
  };
  let peak = 0;
  const peakAt = t => {
    if (t <= 0) return 0;
    let m = 0;
    for (let u = 0; u <= Math.min(t, TAIL); u += 0.03) m = Math.max(m, Math.abs(groundAt(u)));
    return peak = m;
  };

  let shown = 0, clock = 0, t = -1.1, touring = true, idleTimer = 0;
  const steer = next => {
    touring = false; t = clamp(next, -1.2, TAIL - 0.3);
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => { touring = !still; clock = t + 1.1; }, 4500);
  };

  whileVisible(stage, (dt) => {
    if (touring && !still) { clock += dt / 1000; t = -1.1 + (clock % 7.2); }
    const want = groundAt(t);
    shown = still ? want : shown + (want - shown) * (1 - Math.exp(-(dt / 1000) / 0.07));
    needle.setAttribute('d', needleAt(shown / 0.6));
    const st = stateAt(t);
    const pk = peakAt(Math.max(t, 0));
    if (lampG) {
      lampG.style.setProperty('--lamp', TONE[st.tone]);
      lampG.style.setProperty('--lamp-shade', DEEP[st.tone]);
    }
    if (screenG) {
      const msg = st.label === 'armed' ? 'ARMED' : pk.toFixed(2) + 'g';
      if (screenG.textContent !== msg) screenG.textContent = msg;
    }
    const line = st.label + ' \u00b7 ' + pk.toFixed(3) + ' g peak';
    if (readout && readout.textContent !== line) readout.textContent = line;
    stage.setAttribute('aria-valuenow', t.toFixed(1));
    stage.setAttribute('aria-valuetext', line);
  });

  stage.addEventListener('pointermove', e => {
    const b = svgEl.getBoundingClientRect();
    steer(((e.clientX - b.left) / b.width) * (TAIL - 0.6) - 1.4);
  });
  stage.addEventListener('pointerleave', () => steer(t));
  stage.addEventListener('keydown', e => {
    const s = e.shiftKey ? 0.2 : 1;
    if (e.key === 'ArrowRight') steer(t + s);
    else if (e.key === 'ArrowLeft') steer(t - s);
    else if (e.key === 'Home') steer(-1.2);
    else if (e.key === 'End') steer(TAIL - 1);
    else return;
    e.preventDefault();
  });
}

/* ── boot ─────────────────────────────────────────────────────── */
function boot() {
  initProgress();
  initNav();
  initReveal();
  initParallax();
  initCounters();
  initCursor();
  initMagnets();
  initTilt();
  initCopy();
  initTicker();
  initPlayer();
  initMap();
  initRail();
  initTabs();
  initForm();
  initFigure();
  initMisc();
  Loop.start();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
})();