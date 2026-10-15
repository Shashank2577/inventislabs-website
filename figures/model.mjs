/* ═══════════════════════════════════════════════════════════════
   FIG 1 — "Seismic node"
   An isometric bench instrument explaining the one idea behind
   EQ-Alert: a node reads ground acceleration on the P-wave, and
   because P outruns S, the reading arrives while there is still
   time to act.

   The object IS the explanation. The dial needle is the same
   number the site reads out, and the lamp steps armed -> P -> S
   off the same ground-motion model that moves the needle.
   ═══════════════════════════════════════════════════════════════ */

export const GROUND = {
  /* seconds from P-wave arrival, and the acceleration in g at that
     instant — one model, driving the needle, the lamp and the site */
  P_ARRIVAL: 0,
  S_ARRIVAL: 3.4,
  TAIL: 14,
  pAmp: 0.055,
  sAmp: 0.34,
  pFreq: 7.4,
  sFreq: 2.35
};

/** Acceleration in g at time t (s) after the P-wave. Signed, in g. */
export function groundAt(t) {
  if (t < 0 || t > GROUND.TAIL) return 0;
  const pEnv = Math.exp(-t / 0.85);
  const p = GROUND.pAmp * pEnv * Math.sin(2 * Math.PI * GROUND.pFreq * t);
  const u = t - GROUND.S_ARRIVAL;
  const sEnv = u < 0 ? 0 : Math.exp(-u / 2.6) * (1 - Math.exp(-u / 0.55));
  const s = GROUND.sAmp * sEnv * Math.sin(2 * Math.PI * GROUND.sFreq * u);
  /* a slow microtremor floor, so the needle is never dead still */
  const floor = 0.0025 * Math.sin(2 * Math.PI * 0.45 * t + 1.1);
  return p + s + floor;
}

/** Peak absolute acceleration in g up to time t — the peak-picked value. */
export function peakAt(t) {
  if (t <= 0) return 0;
  let peak = 0;
  const step = 0.02;
  for (let u = 0; u <= Math.min(t, GROUND.TAIL); u += step) {
    const v = Math.abs(groundAt(u));
    if (v > peak) peak = v;
  }
  return peak;
}

/** Operational state at time t. */
export function stateAt(t) {
  if (t < GROUND.P_ARRIVAL) return { id: 'armed', label: 'armed', tone: 'green' };
  if (t < GROUND.S_ARRIVAL) return { id: 'p', label: 'p-wave', tone: 'amber' };
  if (t < GROUND.S_ARRIVAL + 7) return { id: 's', label: 's-wave', tone: 'red' };
  return { id: 'settled', label: 'settling', tone: 'amber' };
}