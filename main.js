/* ═══════════════════════════════════════════════════════════════
   INVENTIS LABS — RUNTIME
   Zero dependencies. Every module is opt-in via a data attribute.
   ═══════════════════════════════════════════════════════════════ */
(() => {
'use strict';

const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const clamp = (v, a = 0, b = 1) => v < a ? a : v > b ? b : v;
const lerp  = (a, b, t) => a + (b - a) * t;
const rand  = (a, b) => a + Math.random() * (b - a);
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

const PAL = {
  amber: [255, 106, 26],
  red:   [229, 52, 42],
  cyan:  [75, 224, 220],
  grid:  'rgba(255,255,255,0.05)',
  axis: 'rgba(255,255,255,0.10)',
  idle:  [108, 116, 128]
};
const rgb = (c, a = 1) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

/* ── canvas helper: size to box with devicePixelRatio ─────────── */
function fit(cv, cssH) {
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const w = cv.clientWidth || cv.parentElement.clientWidth || 600;
  const h = cssH || cv.clientHeight || 200;
  cv.width = Math.round(w * dpr);
  cv.height = Math.round(h * dpr);
  const ctx = cv.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, w, h };
}

/* ── visibility-aware animation loop ──────────────────────────── */
function loopWhenVisible(el, draw) {
  let raf = 0, last = performance.now(), visible = false;

  const frame = now => {
    const dt = Math.min(now - last, 48);
    last = now;
    draw(dt, now);
    if (visible) raf = requestAnimationFrame(frame);
  };
  const start = () => { if (!raf && visible) { last = performance.now(); raf = requestAnimationFrame(frame); } };
  const stop  = () => { if (raf) { cancelAnimationFrame(raf); raf = 0; } };

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(es => {
      visible = es[0].isIntersecting;
      visible ? start() : stop();
    }, { threshold: 0 }).observe(el);
  } else { visible = true; start(); }

  let rt;
  addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(start, 180); });
  start();
  return { start, stop };
}

/* ═══ 1 · SCROLL PROGRESS ═════════════════════════════════════ */
function initProgress() {
  const bar = $('[data-progress]');
  if (!bar) return;
  let queued = false;
  const update = () => {
    queued = false;
    const max = document.documentElement.scrollHeight - innerHeight;
    bar.style.width = (max > 0 ? clamp(scrollY / max) * 100 : 0) + '%';
  };
  addEventListener('scroll', () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(update);
  }, { passive: true });
  update();
}

/* ═══ 2 · NAV ══════════════════════════════════════════════════ */
function initNav() {
  const nav = $('[data-nav]');
  if (!nav) return;

  let last = scrollY;
  const onScroll = () => {
    const y = scrollY;
    nav.classList.toggle('is-stuck', y > 24);
    nav.classList.toggle('is-hidden', y > 420 && y > last && !$('[data-menu]').classList.contains('is-open'));
    last = y;
  };
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* mobile sheet */
  const sheet = $('[data-menu]');
  const toggle = $('[data-menu-toggle]');
  if (!sheet || !toggle) return;

  const setOpen = open => {
    sheet.classList.toggle('is-open', open);
    sheet.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
    document.body.style.overflow = open ? 'hidden' : '';
    if (open) nav.classList.remove('is-hidden');
  };
  toggle.addEventListener('click', () => setOpen(sheet.hidden));
  sheet.addEventListener('click', e => { if (e.target.closest('a')) setOpen(false); });
  addEventListener('keydown', e => { if (e.key === 'Escape' && !sheet.hidden) setOpen(false); });

  /* active section */
  const links = $$('[data-navlink]');
  const map = new Map();
  links.forEach(a => {
    const id = a.getAttribute('href').slice(1);
    const sec = document.getElementById(id);
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

/* ═══ 3 · REVEAL ══════════════════════════════════════════════ */
function initReveal() {
  const els = $$('[data-reveal]');
  if (!els.length) return;
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
  }, { rootMargin: '0px 0px -12% 0px', threshold: 0.08 });
  els.forEach(el => io.observe(el));
}

/* ═══ 4 · COUNTERS ════════════════════════════════════════════ */
function initCounters() {
  const els = $$('[data-count]');
  if (!els.length) return;
  const run = el => {
    const to = +el.dataset.count || 0;
    if (REDUCED) { el.textContent = to.toLocaleString('en-IN'); return; }
    const t0 = performance.now(), dur = 1700;
    const step = now => {
      const p = clamp((now - t0) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(to * eased).toLocaleString('en-IN');
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

/* ═══ 5 · SEISMOGRAPH ══════════════════════════════════════════
   Rolling ring-buffer waveform with randomly injected seismic
   events, colour-banded by local amplitude.                    ═══ */
function seismograph(canvas, opts = {}) {
  const {
    amp = 1, idleAmp = 1, thickness = 1.35, cssH = null,
    gridStep = 64, glow = true, seedEvent = true
  } = opts;

  const N = 1400;
  const buf = new Float32Array(N);
  let head = 0;
  let dims = fit(canvas, cssH);
  let ev = null, nextEv = performance.now() + rand(900, 2200);
  let peak = 1, drift = 0;

  addEventListener('resize', () => { dims = fit(canvas, cssH); }, { passive: true });

  function spawn() {
    ev = {
      t: 0,
      dur: rand(1600, 2500),
      amp: rand(0.55, 1),
      freq: rand(32, 54),
      decay: rand(0.6, 1),
      seed: rand(0, 6.28)
    };
  }

  function sample(now) {
    drift = drift * 0.9 + (Math.random() - 0.5) * 0.22;
    let v = drift * 0.5 + (Math.random() - 0.5) * idleAmp;
    if (!ev && seedEvent && now > nextEv) {
      if (Math.random() < 0.7) spawn();
      nextEv = now + rand(2600, 6000);
    }
    if (ev) {
      ev.t += 16.7;
      if (ev.t > ev.dur) { ev = null; }
      else {
        const u = ev.t / 1000;
        const env = Math.exp(-u * ev.decay * 2.3) * clamp(ev.t / 70);
        const carrier = Math.sin(2 * Math.PI * ev.freq * u + ev.seed) * 0.6
                      + Math.sin(2 * Math.PI * ev.freq * 0.29 * u) * 0.3
                      + (Math.random() - 0.5) * 0.35;
        v += carrier * env * ev.amp * amp;
      }
    }
    return v;
  }

  function draw(_dt, now) {
    const { ctx, w, h } = dims;
    buf[head] = sample(now);
    head = (head + 1) % N;
    peak = Math.max(peak * 0.996, Math.abs(buf[head - 1]), 0.0001);

    ctx.clearRect(0, 0, w, h);
    const mid = h / 2;

    ctx.strokeStyle = PAL.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    const off = (now / 30) % gridStep;
    for (let x = off; x < w; x += gridStep) { ctx.moveTo(x + .5, 0); ctx.lineTo(x + .5, h); }
    for (let y = gridStep / 2; y < h; y += gridStep / 2) { ctx.moveTo(0, y + .5); ctx.lineTo(w, y + .5); }
    ctx.stroke();

    ctx.strokeStyle = PAL.axis;
    ctx.beginPath(); ctx.moveTo(0, mid + .5); ctx.lineTo(w, mid + .5); ctx.stroke();

    /* waveform, colour banded by local amplitude.
       `ref` floors the reference so an idle channel never normalises
       to full scale (which would paint the flat line hot-red).     */
    const scale = (h * 0.44) * amp;
    const ref = Math.max(peak, idleAmp * 0.8);
    const bands = [
      { test: a => a < 0.26, col: rgb(PAL.idle, .6) },
      { test: a => a < 0.58, col: rgb(PAL.cyan, .75) },
      { test: a => a < 0.84, col: rgb(PAL.amber, .95) },
      { test: () => true,     col: rgb(PAL.red, .98) }
    ];

    if (glow) { ctx.shadowColor = 'rgba(255,106,26,.35)'; ctx.shadowBlur = 10; }

    for (const band of bands) {
      ctx.beginPath();
      ctx.strokeStyle = band.col;
      ctx.lineWidth = thickness;
      ctx.lineJoin = 'round';
      let pen = false;
      for (let i = 0; i < N; i += 2) {
        const idx = (head + i) % N;
        const val = buf[idx];
        const a = Math.abs(val) / ref;
        if (!band.test(a)) { pen = false; continue; }
        const x = (i / (N - 1)) * w;
        const y = mid - val * scale;
        pen ? ctx.lineTo(x, y) : (ctx.moveTo(x, y), pen = true);
      }
      ctx.stroke();
    }
    ctx.shadowBlur = 0;

    /* leading-edge marker */
    ctx.fillStyle = rgb(PAL.amber, .9);
    ctx.fillRect(w - 2, 0, 2, h);
  }

  loopWhenVisible(canvas, draw);
}

/* ═══ 6 · HERO TRACE ═══════════════════════════════════════════ */
function initHero() {
  const cv = $('[data-hero-trace]');
  if (!cv) return;
  /* NB: assigning canvas.height here would reset the DPR transform
     applied by fit(), so the trace would draw at 2× offset. */
  fit(cv, Math.max(560, innerHeight));
  addEventListener('resize', () => fit(cv, Math.max(560, innerHeight)), { passive: true });

  const N = 1600;
  const buf = new Float32Array(N);
  let head = 0, peak = 1, ev = null, nextEv = performance.now() + rand(1100, 2400), scrollK = 0;

  addEventListener('scroll', () => {
    const max = document.documentElement.scrollHeight - innerHeight;
    scrollK = clamp(scrollY / (max || 1));
  }, { passive: true });

  function spawn() {
    ev = { t: 0, dur: rand(2400, 3600), amp: rand(.5, 1), freq: rand(9, 17), decay: rand(.5, .9), seed: rand(0, 6.28) };
  }
  function sample(now) {
    let v = (Math.random() - 0.5) * 1.6;
    if (!ev && now > nextEv) { if (Math.random() < .75) spawn(); nextEv = now + rand(3200, 7000); }
    if (ev) {
      ev.t += 16.7;
      if (ev.t > ev.dur) ev = null;
      else {
        const u = ev.t / 1000;
        const env = Math.exp(-u * ev.decay * 1.8) * clamp(ev.t / 120);
        v += (Math.sin(2 * Math.PI * ev.freq * u + ev.seed) * .7 +
              Math.sin(2 * Math.PI * ev.freq * 2.7 * u) * .3 +
              (Math.random() - .5) * .3) * env * ev.amp;
      }
    }
    return v;
  }

  loopWhenVisible(cv, (_dt, now) => {
    const g = cv.getContext('2d');
    const W = cv.width / (Math.min(devicePixelRatio || 1, 2));
    const H = cv.height / (Math.min(devicePixelRatio || 1, 2));

    buf[head] = sample(now);
    head = (head + 1) % N;
    peak = Math.max(peak * .995, Math.abs(buf[head - 1]), .0001);

    g.clearRect(0, 0, W, H);

    /* faint horizontal rulings */
    g.strokeStyle = 'rgba(255,255,255,.035)';
    g.lineWidth = 1;
    g.beginPath();
    for (let y = 0; y < H; y += 64) { g.moveTo(0, y + .5); g.lineTo(W, y + .5); }
    g.stroke();

    const mid = H * (0.76 + scrollK * 0.1);
    const scale = H * (innerWidth < 720 ? 0.11 : 0.2) * (1 + scrollK * 0.7);

    /* reference ceiling keeps the idle trace in the "live" band instead of
       normalising to full scale (which would paint a flat line hot-red)   */
    const ref = Math.max(peak, 1.28);
    const bands = [
      { test: a => a < .26, col: 'rgba(150,160,176,.55)' },
      { test: a => a < .58, col: 'rgba(75,224,220,.75)' },
      { test: a => a < .84, col: 'rgba(255,106,26,.85)' },
      { test: () => true,    col: 'rgba(229,52,42,.95)' }
    ];
    g.shadowColor = 'rgba(255,106,26,.28)';
    g.shadowBlur = 14;
    for (const band of bands) {
      g.beginPath();
      g.strokeStyle = band.col;
      g.lineWidth = 1.25;
      let pen = false;
      for (let i = 0; i < N; i += 2) {
        const idx = (head + i) % N;
        const val = buf[idx];
        if (!band.test(Math.abs(val) / ref)) { pen = false; continue; }
        const x = (i / (N - 1)) * W;
        const y = mid - val * scale;
        pen ? g.lineTo(x, y) : (g.moveTo(x, y), pen = true);
      }
      g.stroke();
    }
    g.shadowBlur = 0;

    /* sweep line + head */
    const sweep = ((now / 26) % (W + 320)) - 160;
    const grad = g.createLinearGradient(sweep - 140, 0, sweep, 0);
    grad.addColorStop(0, 'rgba(255,255,255,0)');
    grad.addColorStop(1, 'rgba(255,106,26,.10)');
    g.fillStyle = grad;
    g.fillRect(sweep - 140, 0, 140, H);
  });
}

/* ═══ 7 · P → S EVENT PLAYER ═══════════════════════════════════ */
const PHASES = [
  { id: 'standby', label: 'STANDBY',    at: 0.00, step: -1 },
  { id: 'detect',  label: 'DETECT',     at: 0.10, step: 0 },
  { id: 'analyse', label: 'ANALYSE',    at: 0.24, step: 1 },
  { id: 'broadcast', label: 'BROADCAST', at: 0.40, step: 2 },
  { id: 'respond', label: 'RESPOND',    at: 0.60, step: 3 },
  { id: 'impact',  label: 'IMPACT',     at: 0.80, step: 4 }
];
const SPAN = 6.4;                       /* seconds represented by 0→1 */

function initPlayer() {
  const root = $('[data-player]');
  if (!root) return;
  const cv = $('[data-player-canvas]', root);
  const fill = $('[data-player-fill]', root);
  const knob = $('[data-player-knob]', root);
  const track = $('[data-player-track]', root);
  const clock = $('[data-player-time]', root);
  const stateEl = $('[data-player-state]', root);
  const steps = $$('[data-steps] .step', root);

  let dims = fit(cv, cv.clientHeight || 240);
  addEventListener('resize', () => { dims = fit(cv, cv.clientHeight || 240); }, { passive: true });

  let p = 0;                                   /* 0 → 1 timeline position */
  let dragging = false;
  let paused = REDUCED;

  const P_AT = 0.115, S_AT = 0.845;

  const setP = v => {
    p = clamp(v);
    fill.style.width = (p * 100) + '%';
    knob.style.left = (p * 100) + '%';
    clock.textContent = (p * SPAN).toFixed(1);

    let ph = PHASES[0];
    for (const q of PHASES) if (p >= q.at) ph = q;

    if (stateEl.textContent !== ph.label) {
      stateEl.textContent = ph.label;
      stateEl.classList.toggle('is-warn', ph.id === 'broadcast');
      stateEl.classList.toggle('is-impact', ph.id === 'impact');
    }
    steps.forEach((s, i) => s.classList.toggle('is-on', i === ph.step));
  };

  /* ── canvas ────────────────────────────────────────────────── */
  function wave(x, c, freq, decay, alpha) {
    const u = (x - c) / 1000;
    const env = Math.exp(-Math.abs(u) * freq) * decay;
    return Math.sin(u * 62 + 1.2) * env * alpha + Math.sin(u * 168) * env * alpha * 0.35;
  }

  function draw() {
    const { ctx, w, h } = dims;
    ctx.clearRect(0, 0, w, h);
    const mid = h / 2;

    /* graticule */
    ctx.lineWidth = 1;
    ctx.strokeStyle = PAL.grid;
    ctx.beginPath();
    for (let x = w / 12; x < w; x += w / 12) { ctx.moveTo(Math.round(x) + .5, 0); ctx.lineTo(Math.round(x) + .5, h); }
    for (let y = 0; y < h; y += h / 4) { ctx.moveTo(0, Math.round(y) + .5); ctx.lineTo(w, Math.round(y) + .5); }
    ctx.stroke();
    ctx.strokeStyle = PAL.axis;
    ctx.beginPath(); ctx.moveTo(0, mid + .5); ctx.lineTo(w, mid + .5); ctx.stroke();

    const X = t => t * w;

    /* 1 · P-wave packet */
    const px = X(P_AT);
    ctx.save();
    ctx.shadowColor = 'rgba(76,141,255,.45)'; ctx.shadowBlur = 12;
    ctx.strokeStyle = 'rgba(76,141,255,.95)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    for (let x = Math.max(0, px - 130); x <= Math.min(w, px + 260); x += 2) {
      const y = mid - wave(x, px, 22, 1, 26);
      x === Math.max(0, px - 130) ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.restore();
    label(ctx, 'P', px, mid - 44, 'rgba(76,141,255,1)', 'left');

    /* 2 · broadcast wavefronts */
    if (p > 0.36) {
      const k = clamp((p - 0.36) / 0.26);
      for (let i = 0; i < 4; i++) {
        const r = k * w * 1.05 - i * 62;
        if (r <= 0) continue;
        ctx.beginPath();
        ctx.arc(px, mid, r, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255,106,26,${clamp(.42 - i * .09) * (1 - k * .35)})`;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }

    /* 3 · action ticks during RESPOND */
    if (p > 0.58) {
      const acts = ['GAS', 'LIFT', 'PA', 'SAFE'];
      acts.forEach((a, i) => {
        const at = 0.60 + i * 0.045;
        if (p < at) return;
        const x = X(at), y = h - 16;
        ctx.strokeStyle = 'rgba(75,224,220,.75)';
        ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.moveTo(x, y - 7); ctx.lineTo(x, y); ctx.stroke();
        label(ctx, a, x + 4, y - 8, 'rgba(75,224,220,.9)', 'left', 9);
      });
    }

    /* 4 · S-wave impact — ghosted ahead of the playhead, lit on arrival */
    const sx = X(S_AT);
    const passed = p >= S_AT;
    const envS = passed ? clamp((p - S_AT) / 0.06) : 0;
    const drawS = alpha => {
      ctx.save();
      ctx.shadowColor = passed ? 'rgba(229,52,42,.55)' : 'transparent';
      ctx.shadowBlur = passed ? 18 + envS * 30 : 0;
      ctx.strokeStyle = passed ? `rgba(229,52,42,${alpha})` : `rgba(229,52,42,${alpha * .22})`;
      ctx.lineWidth = (passed ? 2 + envS : 1.4);
      ctx.beginPath();
      for (let x = Math.max(0, sx - 200); x < w; x += 2) {
        const y = mid - wave(x, sx, 3.4, 1, 40 * (1 + envS));
        x === Math.max(0, sx - 200) ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.restore();
    };
    drawS(passed ? .5 + envS * .5 : .55);
    label(ctx, 'S', sx, mid - 44, passed ? 'rgba(229,52,42,1)' : 'rgba(229,52,42,.45)', 'left');

    /* 5 · playhead */
    const hx = X(p);
    const grad = ctx.createLinearGradient(hx - 52, 0, hx, 0);
    grad.addColorStop(0, 'rgba(255,255,255,0)');
    grad.addColorStop(1, 'rgba(255,255,255,.055)');
    ctx.fillStyle = grad;
    ctx.fillRect(hx - 52, 0, 52, h);

    ctx.strokeStyle = 'rgba(255,255,255,.5)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(hx + .5, 0); ctx.lineTo(hx + .5, h); ctx.stroke();

    ctx.fillStyle = p > S_AT ? PAL.red : p > P_AT ? PAL.amber : 'rgba(255,255,255,.6)';
    ctx.beginPath();
    ctx.arc(hx, 8, 3.5, 0, Math.PI * 2);
    ctx.fill();

    /* stage dividers */
    ctx.strokeStyle = 'rgba(255,255,255,.09)';
    ctx.setLineDash([3, 5]);
    PHASES.slice(1).forEach(ph => {
      ctx.beginPath(); ctx.moveTo(X(ph.at) + .5, 0); ctx.lineTo(X(ph.at) + .5, h); ctx.stroke();
    });
    ctx.setLineDash([]);
  }

  function label(c, txt, x, y, color, align = 'center', size = 11) {
    c.save();
    c.font = `700 ${size}px 'JetBrains Mono', monospace`;
    c.fillStyle = color;
    c.textAlign = align;
    c.textBaseline = 'alphabetic';
    c.fillText(txt, x, y);
    c.restore();
  }

  /* ── scrub interaction ─────────────────────────────────────── */
  const fromEvent = e => {
    const r = track.getBoundingClientRect();
    return clamp((e.clientX - r.left) / r.width);
  };
  track.addEventListener('pointerdown', e => {
    dragging = true;
    track.setPointerCapture(e.pointerId);
    setP(fromEvent(e));
    draw();
  });
  track.addEventListener('pointermove', e => { if (dragging) { setP(fromEvent(e)); draw(); } });
  const end = e => {
    if (!dragging) return;
    dragging = false;
    try { track.releasePointerCapture(e.pointerId); } catch {}
  };
  track.addEventListener('pointerup', end);
  track.addEventListener('pointercancel', end);

  /* ── autoplay ──────────────────────────────────────────────── */
  loopWhenVisible(root, dt => {
    if (!paused && !dragging) {
      p += dt / (SPAN * 1000);
      if (p >= 1) p = 0;
      setP(p);
    }
    draw();
  });

  setP(REDUCED ? 0.62 : 0);
  draw();
}

/* ═══ 8 · INDIA DOT-MATRIX MAP ═════════════════════════════════ */
const INDIA = [
  [340,95],[425,114],[476,289],[544,334],[748,418],[952,388],[1020,372],
  [935,475],[868,608],[874,622],[816,551],[731,513],[714,437],[680,623],
  [612,693],[510,796],[434,1050],[357,1138],[316,1084],[265,954],[197,722],
  [68,597],[41,540],[102,388],[255,266],[323,133]
];
const HOTSPOTS = {
  n: { x: 347, y: 357, label: 'Delhi NCR',    color: PAL.red,   n: 450 },
  w: { x: 119, y: 551, label: 'Kutch',        color: PAL.amber, n: 350 },
  e: { x: 846, y: 471, label: 'Shillong',     color: [169,112,255], n: 300 },
  c: { x: 391, y: 616, label: 'Narmada–Son',  color: PAL.cyan,  n: 200 }
};

function inPoly(px, py, poly) {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

function initMap() {
  const cv = $('[data-map]');
  if (!cv) return;
  let dims = fit(cv);
  let dots = null, mapping = null;

  const GAP = 13;

  function build() {
    dims = fit(cv);
    const { w, h } = dims;
    const xs = INDIA.map(p => p[0]), ys = INDIA.map(p => p[1]);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const pad = 18;
    const s = Math.min((w - pad * 2) / (maxX - minX), (h - pad * 2) / (maxY - minY));
    const ox = (w - (maxX - minX) * s) / 2 - minX * s;
    const oy = (h - (maxY - minY) * s) / 2 - minY * s;
    mapping = { s, ox, oy };
    const P = ([x, y]) => [x * s + ox, y * s + oy];

    const pts = [];
    for (let y = minY; y <= maxY; y += GAP) {
      for (let x = minX; x <= maxX; x += GAP) {
        if (inPoly(x, y, INDIA)) pts.push(P([x, y]));
      }
    }
    dots = pts;
  }

  build();
  addEventListener('resize', build, { passive: true });

  const regions = $$('.region');
  const hot = new Set();
  regions.forEach(r => {
    const key = r.dataset.region;
    r.addEventListener('pointerenter', () => hot.add(key));
    r.addEventListener('pointerleave', () => hot.delete(key));
  });

  loopWhenVisible(cv, (_dt, now) => {
    const { ctx, w, h } = dims;
    ctx.clearRect(0, 0, w, h);
    const t = now / 1000;

    /* dots */
    dots.forEach(([x, y], i) => {
      const tw = 0.5 + 0.5 * Math.sin(t * 1.5 + i * 0.35);
      ctx.fillStyle = `rgba(198,208,222,${0.2 + tw * 0.16})`;
      ctx.fillRect(x - 1, y - 1, 2, 2);
    });

    /* region washes */
    for (const [key, hs] of Object.entries(HOTSPOTS)) {
      const [x, y] = [hs.x * mapping.s + mapping.ox, hs.y * mapping.s + mapping.oy];
      const on = hot.has(key);
      const pulse = 0.5 + 0.5 * Math.sin(t * 1.9);
      const r = (on ? 62 : 42) + pulse * (on ? 22 : 12);

      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, rgb(hs.color, on ? .42 : .24));
      g.addColorStop(1, rgb(hs.color, 0));
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();

      ctx.fillStyle = rgb(hs.color, .95);
      ctx.beginPath(); ctx.arc(x, y, on ? 4.5 : 3.4, 0, Math.PI * 2); ctx.fill();

      /* ring ping */
      const ph = (t * 0.55) % 1;
      ctx.strokeStyle = rgb(hs.color, (1 - ph) * .5);
      ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(x, y, 8 + ph * 34, 0, Math.PI * 2); ctx.stroke();

      if (on) {
        ctx.font = "600 10px 'JetBrains Mono', monospace";
        ctx.fillStyle = rgb(hs.color, .95);
        ctx.textAlign = 'center';
        ctx.fillText(hs.label.toUpperCase(), x, y - 58);
        ctx.font = "700 12px 'JetBrains Mono', monospace";
        ctx.fillText(hs.n + '+ NODES', x, y - 44);
      }
    }

    /* travelling survey scan */
    const sy = ((t * 0.11) % 1.2) * h;
    const sg = ctx.createLinearGradient(0, sy - 60, 0, sy + 60);
    sg.addColorStop(0, 'rgba(255,106,26,0)');
    sg.addColorStop(.5, 'rgba(255,106,26,.14)');
    sg.addColorStop(1, 'rgba(255,106,26,0)');
    ctx.fillStyle = sg;
    ctx.fillRect(0, sy - 60, w, 120);
  });
}

/* ═══ 9 · PLATFORM SCOPE ═══════════════════════════════════════ */
function initScope() {
  const cv = $('[data-scope]');
  if (cv) seismograph(cv, { amp: 1.15, idleAmp: 1.4, thickness: 1.25, gridStep: 52 });
  const hero = $('[data-hero-trace]');
  /* hero handled separately below */
}

/* ═══ 10 · SOLUTIONS RAIL ═════════════════════════════════════ */
function initRail() {
  const rail = $('[data-sols-rail]');
  if (!rail) return;
  const prev = $('[data-sols-prev]');
  const next = $('[data-sols-next]');
  if (!prev || !next) return;

  const step = () => {
    const first = rail.firstElementChild;
    if (!first) return 320;
    const gap = parseFloat(getComputedStyle(rail).columnGap || 16) || 16;
    return first.getBoundingClientRect().width + gap;
  };
  prev.addEventListener('click', () => rail.scrollBy({ left: -step(), behavior: 'smooth' }));
  next.addEventListener('click', () => rail.scrollBy({ left:  step(), behavior: 'smooth' }));

  const sync = () => {
    const max = rail.scrollWidth - rail.clientWidth;
    prev.disabled = rail.scrollLeft < 8;
    next.disabled = rail.scrollLeft > max - 8;
  };
  rail.addEventListener('scroll', sync, { passive: true });
  addEventListener('resize', sync, { passive: true });
  sync();

  /* keyboard support */
  rail.addEventListener('keydown', e => {
    if (e.key === 'ArrowRight') { e.preventDefault(); next.click(); }
    if (e.key === 'ArrowLeft')  { e.preventDefault(); prev.click(); }
  });
  rail.tabIndex = 0;
}

/* ═══ 11 · PANEL TABS ═════════════════════════════════════════ */
function initTabs() {
  $$('[data-tabs]').forEach(bar => {
    const panel = bar.parentElement.querySelector('[data-tabpanel]');
    const all = bar.parentElement.querySelectorAll('[data-tabpanel]');
    const btns = $$('button', bar);
    btns.forEach(b => b.addEventListener('click', () => {
      const i = +b.dataset.tab;
      btns.forEach(x => x.classList.toggle('is-on', x === b));
      all.forEach((p, j) => { p.hidden = j !== i; });
    }));
    if (panel) panel.hidden = false;
  });
}

/* ═══ 12 · PILOT FORM ══════════════════════════════════════════ */
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
      if (!f.required || !f.checkValidity()) return;
      const wrap = f.closest('.field');
      if (!wrap) return;
      const fail = !f.value.trim() || !f.checkValidity();
      wrap.classList.toggle('is-bad', fail);
      if (fail && f.type !== 'checkbox') bad.push(f);
    });

    const agree = form.querySelector('[name="agree"]');
    if (agree && !agree.checked) {
      note.textContent = 'Please accept the terms to continue.';
      note.className = 'form__note is-bad';
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
      label.textContent = 'Request received — we’ll reply within 24 hours';
      note.textContent = 'Request logged. The EQ-Alert team will follow up shortly.';
      note.className = 'form__note is-ok';
      form.reset();
    }, 1100);
  });

  $$('.field input,.field textarea,.field select', form).forEach(f => {
    f.addEventListener('input', () => f.closest('.field')?.classList.remove('is-bad'));
  });
}

/* ═══ 13 · MISC ═══════════════════════════════════════════════ */
function initMisc() {
  const y = $('[data-year]');
  if (y) y.textContent = new Date().getFullYear();

  /* live uptime read-out that drifts imperceptibly */
  const up = $('[data-uptime]');
  if (up && !REDUCED) {
    let v = 99.9;
    setInterval(() => {
      v = clamp(v + rand(-.03, .03), 99.82, 99.98);
      up.textContent = v.toFixed(2) + '%';
    }, 3200);
  }
}

/* ── boot ─────────────────────────────────────────────────────── */
function boot() {
  initProgress();
  initNav();
  initReveal();
  initCounters();
  initHero();
  initPlayer();
  initMap();
  initScope();
  initRail();
  initTabs();
  initForm();
  initMisc();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
})();