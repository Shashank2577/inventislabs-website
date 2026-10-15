/* ═══════════════════════════════════════════════════════════════
   INVENTIS LABS — RUNTIME
   One rAF loop. It reads the theme's live tokens, so every canvas
   repaints correctly when the theme flips.
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

/* ── the palette, read from CSS so themes just work ──────────── */
const C = {
  get ink()  { return getComputedStyle(document.documentElement).getPropertyValue('--ink').trim() || '#CFC8BA'; },
  get ink3() { return getComputedStyle(document.documentElement).getPropertyValue('--ink-3').trim() || 'rgba(207,200,186,.62)'; },
  get ink4() { return getComputedStyle(document.documentElement).getPropertyValue('--ink-4').trim() || 'rgba(207,200,186,.22)'; },
  get rule() { return getComputedStyle(document.documentElement).getPropertyValue('--rule').trim() || 'rgba(207,200,186,.22)'; },
  get rule2(){ return getComputedStyle(document.documentElement).getPropertyValue('--rule-2').trim() || 'rgba(207,200,186,.08)'; },
  get amber(){ return getComputedStyle(document.documentElement).getPropertyValue('--amber').trim() || '#E0A94A'; },
  get red()  { return getComputedStyle(document.documentElement).getPropertyValue('--red').trim() || '#D9614C'; },
  get sage() { return getComputedStyle(document.documentElement).getPropertyValue('--sage').trim() || '#8FA98C'; },
  get teal() { return getComputedStyle(document.documentElement).getPropertyValue('--teal').trim() || '#6FCFBD'; },
  get violet(){return getComputedStyle(document.documentElement).getPropertyValue('--violet').trim() || '#A970FF'; }
};

function fit(cv, cssH) {
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const w = cv.clientWidth || cv.parentElement?.clientWidth || 600;
  const h = cssH || cv.clientHeight || 200;
  cv.width = Math.round(w * dpr);
  cv.height = Math.round(h * dpr);
  const ctx = cv.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, w, h };
}

/* ═══ THE LOOP ═══════════════════════════════════════════════ */
const Loop = {
  jobs: new Set(),
  last: performance.now(),
  vel: 0, prevY: scrollY,
  add(fn) { this.jobs.add(fn); },
  start() {
    const tick = now => {
      const dt = Math.min(now - this.last, 50);
      this.last = now;
      const y = scrollY;
      this.vel = lerp(this.vel, (y - this.prevY) / Math.max(dt, 1) * 16, 1 - Math.exp(-dt / 90));
      this.prevY = y;
      for (const job of this.jobs) job(dt, now);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
};

function whileVisible(el, fn) {
  let on = false, was = false;
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(es => { on = es[es.length - 1].isIntersecting; }, { rootMargin: '140px' }).observe(el);
  } else on = true;
  Loop.add((dt, now) => {
    if (!on && !was) return;
    was = on;
    fn(dt, now);
  });
}

/* ═══ 1 · THEME ══════════════════════════════════════════════ */
function initTheme() {
  const btn = $('[data-theme-toggle]');
  const label = $('[data-theme-label]');
  const apply = () => {
    const light = document.documentElement.dataset.theme === 'light';
    if (label) label.textContent = light ? 'Dark' : 'Light';
    const meta = $('meta[name="theme-color"]');
    if (meta) meta.content = light ? '#F2F0E9' : '#0E1113';
  };
  apply();
  btn?.addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('il-theme', next); } catch (e) {}
    apply();
    Loop.jobs.forEach(j => j._redraw && j._redraw());
  });
}

/* ═══ 2 · CHROME ═════════════════════════════════════════════ */
function initChrome() {
  const bar = $('[data-progress]');
  const mast = $('[data-nav],.mast');
  const ticks = $('[data-ticks]');
  const navLinks = $$('.mast__nav a');
  let x = 0, last = scrollY;

  Loop.add(() => {
    const max = document.documentElement.scrollHeight - innerHeight;
    const want = max > 0 ? clamp(scrollY / max) : 0;
    x = lerp(x, want, 0.25);
    if (bar) bar.style.width = (x * 100).toFixed(2) + '%';
    if (ticks) ticks.style.left = (x * 100).toFixed(2) + '%';

    mast?.classList.toggle('is-stuck', scrollY > 40);
    const go = document.getElementById('pilot');
    if (go) {
      const r = go.getBoundingClientRect();
      mast?.classList.toggle('is-lite', r.top < 80 && r.bottom > 40);
    }
    mast?.classList.toggle('is-hidden', scrollY > 520 && scrollY > last && !$('[data-menu]')?.classList.contains('is-open'));
    last = scrollY;
  });

  /* mobile sheet */
  const sheet = $('[data-menu]');
  const burger = $('[data-menu-toggle]');
  if (!sheet || !burger) return;
  const setOpen = open => {
    sheet.classList.toggle('is-open', open);
    sheet.hidden = !open;
    burger.setAttribute('aria-expanded', String(open));
    document.body.classList.toggle('is-locked', open);
  };
  burger.addEventListener('click', () => setOpen(sheet.hidden));
  sheet.addEventListener('click', e => { if (e.target.closest('a')) setOpen(false); });
  addEventListener('keydown', e => { if (e.key === 'Escape' && !sheet.hidden) setOpen(false); });

  /* scroll spy */
  const map = new Map();
  navLinks.forEach(a => {
    const sec = document.getElementById(a.getAttribute('href').slice(1));
    if (sec) map.set(sec, a);
  });
  if (!map.size) return;
  const spy = new IntersectionObserver(es => {
    es.forEach(e => {
      if (!e.isIntersecting) return;
      navLinks.forEach(a => a.classList.remove('is-on'));
      map.get(e.target)?.classList.add('is-on');
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  map.forEach((_, s) => spy.observe(s));
}

/* ═══ 3 · REVEAL ═════════════════════════════════════════════ */
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
  if (REDUCED || !('IntersectionObserver' in window)) return els.forEach(e => e.classList.add('is-in'));
  const io = new IntersectionObserver((es, self) => {
    es.forEach(e => {
      if (!e.isIntersecting) return;
      e.target.classList.add('is-in');
      self.unobserve(e.target);
    });
  }, { rootMargin: '0px 0px -10% 0px', threshold: 0.06 });
  els.forEach(el => io.observe(el));
}

/* ═══ 4 · MAGNETIC BUTTONS ═══════════════════════════════════ */
function initMagnets() {
  const els = $$('[data-magnet]');
  if (!els.length || COARSE || REDUCED) return;
  els.forEach(el => {
    const st = { x: 0, y: 0, tx: 0, ty: 0, live: false };
    el.addEventListener('pointermove', e => {
      const r = el.getBoundingClientRect();
      st.tx = (e.clientX - (r.left + r.width / 2)) * 0.26;
      st.ty = (e.clientY - (r.top + r.height / 2)) * 0.36;
      st.live = true;
    });
    el.addEventListener('pointerleave', () => { st.tx = 0; st.ty = 0; st.live = false; });
    Loop.add(() => {
      if (!st.live && Math.abs(st.x) < 0.05 && Math.abs(st.y) < 0.05) return;
      st.x = lerp(st.x, st.tx, 0.16);
      st.y = lerp(st.y, st.ty, 0.16);
      el.style.transform = `translate(${st.x.toFixed(2)}px, ${st.y.toFixed(2)}px)`;
    });
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

/* ═══ 6 · TOAST + COPY ══════════════════════════════════════ */
function toast(msg) {
  const el = $('[data-toast]');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('is-up');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('is-up'), 2400);
}
function initCopy() {
  $$('[data-copy]').forEach(a => a.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(a.dataset.copy); toast('Copied · ' + a.dataset.copy); }
    catch { toast(a.dataset.copy); }
  }));
}

/* ═══ 7 · SEISMOGRAPH — one trace engine, three sizes ════════ */
function trace(cv, opts = {}) {
  const {
    amp = 1, idleAmp = 1, thickness = 1, cssH = null,
    seed = true, hero = false, band = true
  } = opts;

  const N = hero ? 1500 : 900;
  const buf = new Float32Array(N);
  let head = 0, peak = 1, ev = null, drift = 0, fine = 0, scrollK = 0;
  let dims = fit(cv, cssH);
  let nextEv = performance.now() + rand(900, 2400);
  for (let i = 0; i < N; i++) buf[i] = (Math.random() - 0.5) * idleAmp * 0.4;

  addEventListener('resize', () => { dims = fit(cv, cssH); }, { passive: true });
  if (hero) addEventListener('scroll', () => {
    const max = document.documentElement.scrollHeight - innerHeight;
    scrollK = clamp(scrollY / (max || 1));
  }, { passive: true });

  function spawn() {
    ev = {
      t: 0, dur: hero ? rand(2200, 3400) : rand(1500, 2400),
      amp: rand(.5, 1), freq: hero ? rand(7, 15) : rand(26, 48),
      decay: rand(.5, 1), phase: rand(0, 6.28)
    };
  }
  function sample(now) {
    drift = drift * 0.86 + (Math.random() - 0.5) * 0.24;
    fine = fine * 0.62 + (Math.random() - 0.5) * idleAmp;
    let v = drift * 0.9 + fine * 0.5;
    if (!ev && seed && now > nextEv) {
      if (Math.random() < 0.7) spawn();
      nextEv = now + rand(2400, 5600);
    }
    if (ev) {
      ev.t += 16.7;
      if (ev.t > ev.dur) ev = null;
      else {
        const u = ev.t / 1000;
        const env = Math.exp(-u * ev.decay * 2.2) * clamp(ev.t / 80);
        const f = ev.freq;
        v += (Math.sin(2 * Math.PI * f * u + ev.phase) * .62
            + Math.sin(2 * Math.PI * f * .27 * u) * .3
            + (Math.random() - .5) * .28) * env * ev.amp;
      }
    }
    return v;
  }

  function paint(advance = true) {
    const { ctx, w, h } = dims;
    if (advance) {
      buf[head] = sample(performance.now());
      head = (head + 1) % N;
    }
    peak = Math.max(peak * .995, Math.abs(buf[(head - 1 + N) % N]), 0.0001);
    if (!Number.isFinite(peak)) peak = 1;

    ctx.clearRect(0, 0, w, h);

    const mid = hero ? h * (0.9 + scrollK * 0.04) : h / 2;
    ctx.strokeStyle = C.rule2; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, mid + .5); ctx.lineTo(w, mid + .5); ctx.stroke();

    const scale = (hero ? h * 0.085 : h * 0.4) * amp;
    const ref = Math.max(peak, idleAmp * 1.5);

    const colours = band
      ? [[0.30, C.ink3], [0.62, C.amber], [1, C.red]]
      : [[0.34, C.ink3], [1, C.amber]];

    for (const [max, col] of colours) {
      ctx.beginPath();
      ctx.strokeStyle = col;
      ctx.lineWidth = thickness;
      ctx.lineJoin = 'round';
      let pen = false;
      for (let i = 0; i < N; i += 2) {
        const val = buf[(head + i) % N];
        if (Math.abs(val) / ref > max) { pen = false; continue; }
        const x = (i / (N - 1)) * w;
        const y = mid - val * scale;
        pen ? ctx.lineTo(x, y) : (ctx.moveTo(x, y), pen = true);
      }
      ctx.stroke();
    }
  }

  const job = () => paint(true);
  job._redraw = () => paint(false);
  whileVisible(cv, job);
}

/* ═══ 8 · SEAMS — the live trace rule between chapters ══════ */
function initSeams() {
  $$('[data-seam]').forEach(seam => {
    const cv = $('canvas', seam);
    if (cv) trace(cv, { amp: 1, idleAmp: 1.4, thickness: 1.1, band: false, cssH: seam.offsetHeight || 150 });

    const cap = $('[data-seam-caption]', seam);
    if (!cap) return;
    const label = cap.textContent.trim();
    let chars = 0;
    const tick = () => {
      chars += 1;
      if (chars % 4 === 0) cap.textContent = label;
    };
    if (!REDUCED) setInterval(tick, 2400);
  });
}

/* ═══ 9 · HERO ═══════════════════════════════════════════════ */
function initHero() {
  const cv = $('[data-hero-trace]');
  if (!cv) return;
  const job = (dt, now) => {};
  trace(cv, { hero: true, amp: 1, idleAmp: 1.2, thickness: 1.15 });
}

/* ═══ 10 · P → S PLAYER ══════════════════════════════════════ */
const PHASES = [
  { at: 0.00, label: 'Armed',    step: -1 },
  { at: 0.10, label: 'Detect',   step: 0 },
  { at: 0.24, label: 'Analyse',  step: 1 },
  { at: 0.40, label: 'Broadcast',step: 2 },
  { at: 0.60, label: 'Respond',  step: 3 },
  { at: 0.80, label: 'Impact',   step: 4 }
];
const SPAN = 6.4, P_AT = 0.115, S_AT = 0.845;

function initPlayer() {
  const root = $('[data-player]');
  if (!root) return;
  const section = root.closest('.mech');
  const cv = $('[data-player-canvas]', root);
  const fill = $('[data-player-fill]', root);
  const knob = $('[data-player-knob]', root);
  const track = $('[data-player-track]', root);
  const clock = $('[data-player-time]', root);
  const stateEl = $('[data-player-state]', root);
  const steps = $$('[data-steps] li');

  let dims = fit(cv, cv.clientHeight || 220);
  addEventListener('resize', () => { dims = fit(cv, cv.clientHeight || 220); }, { passive: true });

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
      stateEl.classList.toggle('is-warn', ph.label === 'Broadcast');
      stateEl.classList.toggle('is-impact', ph.label === 'Impact');
    }
    steps.forEach((s, i) => s.classList.toggle('is-on', i === ph.step));
    track.setAttribute('aria-valuenow', String(Math.round(p * 100)));
  };

  const wave = (x, c, freq, decay, alpha) => {
    const u = (x - c) / 1000;
    const e = Math.exp(-Math.abs(u) * freq) * decay;
    return Math.sin(u * 62 + 1.2) * e * alpha + Math.sin(u * 168) * e * alpha * 0.35;
  };
  const label = (c, txt, x, y, color, anchor = 'center', size = 10) => {
    c.save();
    c.font = `400 ${size}px ui-monospace, Menlo, monospace`;
    c.fillStyle = color; c.textAlign = anchor;
    c.fillText(txt, x, y); c.restore();
  };

  function draw() {
    const { ctx, w, h } = dims;
    ctx.clearRect(0, 0, w, h);
    const mid = h / 2, X = t => t * w;

    ctx.strokeStyle = C.rule2; ctx.lineWidth = 1;
    ctx.beginPath();
    for (let y = 0; y < h; y += h / 4) { ctx.moveTo(0, Math.round(y) + .5); ctx.lineTo(w, Math.round(y) + .5); }
    ctx.stroke();
    ctx.strokeStyle = C.rule;
    ctx.beginPath(); ctx.moveTo(0, mid + .5); ctx.lineTo(w, mid + .5); ctx.stroke();

    const px = X(P_AT);
    ctx.save();
    ctx.shadowColor = C.amber; ctx.shadowBlur = 10;
    ctx.strokeStyle = C.amber; ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let x = Math.max(0, px - 130); x <= Math.min(w, px + 260); x += 2) {
      const y = mid - wave(x, px, 22, 1, 26);
      x === Math.max(0, px - 130) ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke(); ctx.restore();
    label(ctx, 'P', px, mid - 40, C.amber, 'left');

    if (p > 0.36) {
      const k = clamp((p - 0.36) / 0.26);
      for (let i = 0; i < 4; i++) {
        const r = k * w * 1.05 - i * 62;
        if (r <= 0) continue;
        ctx.beginPath(); ctx.arc(px, mid, r, 0, Math.PI * 2);
        ctx.strokeStyle = C.amber; ctx.globalAlpha = clamp(.4 - i * .09) * (1 - k * .35);
        ctx.lineWidth = 1; ctx.stroke(); ctx.globalAlpha = 1;
      }
    }

    if (p > 0.58) {
      ['GAS', 'LIFT', 'PA', 'SAFE'].forEach((a, i) => {
        const at = 0.60 + i * 0.045;
        if (p < at) return;
        const x = X(at), y = h - 12;
        ctx.strokeStyle = C.teal; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(x, y - 6); ctx.lineTo(x, y); ctx.stroke();
        label(ctx, a, x + 4, y - 7, C.teal, 'left', 9);
      });
    }

    const sx = X(S_AT), passed = p >= S_AT;
    const envS = passed ? clamp((p - S_AT) / 0.06) : 0;
    ctx.save();
    ctx.shadowColor = passed ? C.red : 'transparent';
    ctx.shadowBlur = passed ? 16 + envS * 26 : 0;
    ctx.globalAlpha = passed ? .5 + envS * .5 : .18;
    ctx.strokeStyle = C.red; ctx.lineWidth = passed ? 1.8 + envS : 1.2;
    ctx.beginPath();
    for (let x = Math.max(0, sx - 200); x < w; x += 2) {
      const y = mid - wave(x, sx, 3.4, 1, 40 * (1 + envS));
      x === Math.max(0, sx - 200) ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke(); ctx.restore();
    label(ctx, 'S', sx, mid - 40, passed ? C.red : C.ink4, 'left');

    const hx = X(p);
    ctx.strokeStyle = C.rule; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(hx + .5, 0); ctx.lineTo(hx + .5, h); ctx.stroke();
    ctx.fillStyle = p > S_AT ? C.red : p > P_AT ? C.amber : C.ink3;
    ctx.beginPath(); ctx.arc(hx, 6, 3, 0, Math.PI * 2); ctx.fill();

    ctx.strokeStyle = C.rule2; ctx.setLineDash([2, 6]);
    PHASES.slice(1).forEach(ph => {
      ctx.beginPath(); ctx.moveTo(X(ph.at) + .5, 0); ctx.lineTo(X(ph.at) + .5, h); ctx.stroke();
    });
    ctx.setLineDash([]);
  }

  const fromEvent = e => {
    const r = track.getBoundingClientRect();
    return clamp((e.clientX - r.left) / r.width);
  };
  track.addEventListener('pointerdown', e => {
    dragging = held = true;
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

  const pinned = section.offsetHeight > innerHeight * 2;
  whileVisible(section, () => {
    if (held && !dragging) { draw(); return; }
    const r = section.getBoundingClientRect();
    const travel = section.offsetHeight - innerHeight;
    const prog = travel > 0 && pinned ? clamp(-r.top / travel) : p;
    if (!held) setP(prog);
    else if (!pinned) setP((p + 0.004) % 1);
    draw();
  });
}

/* ═══ 11 · INDIA DOT MAP ═════════════════════════════════════ */
const INDIA = [
  [340,95],[425,114],[476,289],[544,334],[748,418],[952,388],[1020,372],
  [935,475],[868,608],[874,622],[816,551],[731,513],[714,437],[680,623],
  [612,693],[510,796],[434,1050],[357,1138],[316,1084],[265,954],[197,722],
  [68,597],[41,540],[102,388],[255,266],[323,133]
];
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
  const GAP = 12;
  let dims = fit(cv), dots = null, m = null;

  const HOT = {
    n: { x: 347, y: 357, label: 'Delhi NCR',  c: () => C.red,    n: 450 },
    w: { x: 119, y: 551, label: 'Kutch',      c: () => C.amber,  n: 350 },
    e: { x: 846, y: 471, label: 'Shillong',   c: () => C.violet, n: 300 },
    c: { x: 391, y: 616, label: 'Narmada–Son',c: () => C.teal,   n: 200 }
  };

  function build() {
    dims = fit(cv);
    const { w, h } = dims;
    const xs = INDIA.map(p => p[0]), ys = INDIA.map(p => p[1]);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const pad = 10;
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
  $$('.regions li').forEach(r => {
    r.addEventListener('pointerenter', () => hot.add(r.dataset.region));
    r.addEventListener('pointerleave', () => hot.delete(r.dataset.region));
  });

  whileVisible(cv, (_dt, now) => {
    const { ctx, w, h } = dims;
    const t = now / 1000;
    ctx.clearRect(0, 0, w, h);

    ctx.fillStyle = C.ink3;
    dots.forEach(([x, y], i) => {
      ctx.globalAlpha = 0.28 + (0.5 + 0.5 * Math.sin(t * 1.4 + i * 0.33)) * 0.28;
      ctx.fillRect(x - 1, y - 1, 2, 2);
    });
    ctx.globalAlpha = 1;

    for (const [key, hs] of Object.entries(HOT)) {
      const col = hs.c();
      const x = hs.x * m.s + m.ox, y = hs.y * m.s + m.oy;
      const on = hot.has(key);
      const r = (on ? 60 : 40) + (0.5 + 0.5 * Math.sin(t * 1.9)) * (on ? 22 : 12);
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, col + (on ? '55' : '33'));
      g.addColorStop(1, col + '00');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();

      ctx.fillStyle = col;
      ctx.beginPath(); ctx.arc(x, y, on ? 4 : 3, 0, Math.PI * 2); ctx.fill();

      const ph = (t * 0.55) % 1;
      ctx.strokeStyle = col; ctx.globalAlpha = (1 - ph) * .45;
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(x, y, 8 + ph * 32, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 1;

      if (on) {
        ctx.textAlign = 'center';
        ctx.font = "400 10px ui-monospace, Menlo, monospace";
        ctx.fillStyle = col;
        ctx.fillText(hs.label.toUpperCase(), x, y - 54);
        ctx.fillText(hs.n + '+ NODES', x, y - 40);
      }
    }
  });
}

/* ═══ 12 · FORM ══════════════════════════════════════════════ */
function initForm() {
  const form = $('[data-pilot-form]');
  if (!form) return;
  const note = $('[data-form-note]', form);
  const label = $('[data-submit-label]', form);
  const state = $('[data-form-state]', form);
  const btn = $('button[type="submit"]', form);

  form.addEventListener('submit', e => {
    e.preventDefault();
    const bad = [];
    $$('input,select,textarea', form).forEach(f => {
      if (!f.required) return;
      const wrap = f.closest('.fld');
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
    label.textContent = 'Sending…';
    note.textContent = '';
    setTimeout(() => {
      btn.disabled = false;
      label.textContent = 'Request received';
      state.textContent = 'done';
      note.textContent = 'Logged. The EQ-Alert team replies within 24 hours.';
      note.className = 'form__note is-ok';
      form.reset();
      toast('Pilot request sent');
    }, 1000);
  });

  $$('.fld input,.fld textarea,.fld select', form).forEach(f =>
    f.addEventListener('input', () => f.closest('.fld')?.classList.remove('is-bad')));
}

/* ═══ 13 · RECEIPT FIGURES ═══════════════════════════════════ */
async function initReceipt() {
  const out = $('[data-receipt-weight]');
  const fonts = $('[data-receipt-fonts]');
  if (fonts) fonts.textContent = '0';
  if (!out || !performance.getEntriesByType) return;
  try {
    const res = await fetch(location.href, { cache: 'force-cache' });
    const buf = await res.arrayBuffer();
    if (res.ok) out.textContent = '≈ ' + Math.max(1, Math.round(buf.byteLength / 1024)) + ' kB';
  } catch (e) { /* offline: leave the estimate alone */ }
}

/* ═══ 14 · MISC ══════════════════════════════════════════════ */
function initMisc() {
  const y = $('[data-year]');
  if (y) y.textContent = new Date().getFullYear();
}

/* ── boot ─────────────────────────────────────────────────────── */
function boot() {
  initTheme();
  initChrome();
  initReveal();
  initMagnets();
  initCounters();
  initCopy();
  initHero();
  initSeams();
  initPlayer();
  initMap();
  initForm();
  initMisc();
  initReceipt();
  Loop.start();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
})();