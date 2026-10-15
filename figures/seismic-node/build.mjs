/* ═══════════════════════════════════════════════════════════════
   FIG 1 — "Seismic node"
   An isometric bench instrument explaining the one idea behind
   EQ-Alert: a node reads ground acceleration on the P-wave, and
   because P outruns S, the reading arrives while there is still
   time to act.

   The object IS the explanation. The dial needle is the same
   number the readout shows, and the lamp steps armed -> P -> S
   off the same ground-motion model that moves the needle.
   ═══════════════════════════════════════════════════════════════ */

import { writeFileSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../kit/iso-kit.mjs";
import * as G from "../kit/lathe.mjs";
import { tubePieces, tubeSvg } from "../kit/tube.mjs";
import { kitScript } from "../scripts/inline-kit.mjs";
import { GROUND, groundAt, peakAt, stateAt } from "../model.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const theme = process.argv.includes("--light") ? "light" : "dark";
const W = 780, H = 486;

/* ── world layout ──────────────────────────────────────────── */
const PLATE   = { x: -122, y: -78, w: 248, d: 158, r: 12 };
const PLATE_H = 15, FOOT_H = 6;

const NODE    = [6, 22];
const PLINTH  = { x: NODE[0] - 28, y: NODE[1] - 28, w: 56, d: 56, r: 4 };
const PLINTH_H = 9;
const CAN_R   = 18, CAN_Z = PLINTH_H, CAN_H = 67;
const CAN_F   = G.frameOf([NODE[0], NODE[1], CAN_Z], [0, 0, 1], [1, 0, 0], [0, 1, 0]);
const LIP_Z   = 58;

const PANEL   = { x: -112, y: -68, w: 54, d: 38, r: 3 };
const PANEL_Z = 34;
const MAST    = [-36, -62], MAST_H = 82;

const DIAL    = [96, -44], DIAL_R = 24, DIAL_Z = 96, DIAL_H = 13, DIAL_TOP = DIAL_Z + DIAL_H;
const POST    = [52, -44], POST_H = 68, ARM_Z = 82;

const LAMP    = [104, -4], LAMP_Z = 54;
const BOX     = { x: -6, y: -70, w: 76, d: 34, r: 3 }, BOX_H = 26;

const P = k.fitProjection(
  [
    ...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0),
    [NODE[0], NODE[1], CAN_Z + CAN_H + 2],
    [MAST[0], MAST[1], MAST_H + 26],
    [PANEL.x + PANEL.w / 2, PANEL.y + PANEL.d / 2, PANEL_Z + 3],
    [DIAL[0] + DIAL_R, DIAL[1], DIAL_TOP],
    [LAMP[0], LAMP[1], LAMP_Z + 14],
    [BOX.x, BOX.y, BOX_H + 6], [BOX.x + BOX.w, BOX.y, BOX_H + 6],
    [BOX.x + BOX.w, BOX.y + BOX.d, BOX_H + 6], [BOX.x, BOX.y + BOX.d, BOX_H + 6]
  ],
  W, H, { pad: 36, azimuth: 42 }
);

const at = (p) => k.iso(p, P);
const S  = (paths, style) => k.solidSvg(paths, style);
const L  = (d, style) => k.lineSvg(d, style);
const D  = (pts, style) => k.dotsSvg(pts, style);
const byDepth = (pts) => [...pts].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));

/* ═══ A · BENCH ═══════════════════════════════════════════ */
function bench() {
  const o = [`<path class="iso-halo" d="${k.haloOf(PLATE, -PLATE_H - FOOT_H, PLATE_H, P)}"/>`];
  for (const [x, y] of byDepth(k.corners(PLATE, 24))) {
    o.push(S(k.cylinder(x, y, 8, -PLATE_H - FOOT_H, 1.8, P, 30), { tone: "lo" }));
    o.push(S(k.cylinder(x, y, 6, -PLATE_H - FOOT_H + 1.8, FOOT_H - 1.8, P, 30), { tone: "mid" }));
    o.push(L(k.ring(x, y, 4.4, -PLATE_H - FOOT_H + 1.8, P, 28), { tone: "faint" }));
  }
  o.push(S(k.slabOf(PLATE, -PLATE_H, PLATE_H, P, 10, 1.4), { tone: "mid" }));
  o.push(L(k.planOutline(k.insetPlan(PLATE, 6), 0, P), { tone: "lo" }));

  const screws = k.corners(PLATE, 12);
  o.push(L(screws.map(([x, y]) => k.ring(x, y, 2.4, 0, P, 18)).join(""), { tone: "lo" }));
  o.push(D(screws.map(([x, y]) => at([x, y, 0])), { size: 0.55 }));

  /* ruler strip along the near edge */
  const strip = { x: PLATE.x + 20, y: PLATE.y + PLATE.d - 20, w: PLATE.w - 130, d: 8, r: 1.5 };
  o.push(S(k.slabOf(strip, 0, 0.8, P, 3, 0.5), { tone: "lo", crease: "none" }));
  const t = k.topTicks(strip.x + 5, strip.x + strip.w - 5, 5, 5, strip.y + 1, 0.8, [2.4, 4.2], P);
  o.push(L(t.minor, { tone: "lo" }), L(t.major, { tone: "mid" }));
  o.push(D([at([strip.x + 3, strip.y + 4, 0.8]), at([strip.x + strip.w - 3, strip.y + 4, 0.8])], { size: 0.5 }));

  /* engraved label plate, far corner */
  const plate = { x: PLATE.x + 22, y: PLATE.y + 16, w: 64, d: 22, r: 2 };
  o.push(S(k.slabOf(plate, 0, 1.4, P, 4, 0.6), { tone: "lo", crease: "none" }));
  o.push(L(k.planOutline(k.insetPlan(plate, 2.4), 1.4, P, 4), { tone: "faint" }));
  for (let i = 0; i < 3; i++) {
    const y = plate.y + 6 + i * 5;
    o.push(L(k.lineOnTop([plate.x + 5, y], [plate.x + plate.w - (i === 2 ? 22 : 6), y], 1.4, P), { tone: "mid", free: "end" }));
  }
  return o.join("");
}

/* ═══ B · NODE PLINTH ══════════════════════════════════════ */
function plinth() {
  const o = [`<path class="iso-halo" d="${k.haloOf(k.insetPlan(PLINTH, 3), 0, PLINTH_H, P)}" style="filter:blur(5px)"/>`];
  o.push(S(k.slabOf(PLINTH, 0, PLINTH_H - 3, P, 5, 1), { tone: "mid" }));
  o.push(S(k.slabOf(k.insetPlan(PLINTH, 2), PLINTH_H - 3, 3, P, 5, 1), { tone: "hi", crease: "lo" }));
  o.push(L(k.planOutline(k.insetPlan(PLINTH, 4), PLINTH_H, P, 5), { tone: "faint" }));
  o.push(D(k.corners(PLINTH, 4.5).map(([x, y]) => at([x, y, PLINTH_H])), { size: 0.5 }));
  o.push(D([[0.78, 0.5], [-0.78, 0.5], [0.5, -0.78], [-0.5, -0.78]].map(([ux, uy]) =>
    at([NODE[0] + ux * CAN_R * 0.7, NODE[1] + uy * CAN_R * 0.7, PLINTH_H])), { size: 0.42 }));
  return o.join("");
}

/* ═══ C · THE SENSOR CAN — the one lit part ════════════════ */
/* s must rise monotonically: a reversed knot breaks the hull and the
   body renders see-through. The dome lives above LIP_Z + 3.2. */
const CAN_PROFILE = [
  [0, CAN_R + 2.6, 1], [2.4, CAN_R + 2.6, 1], [3.6, CAN_R + 1.2, 1], [4.8, CAN_R + 1.2],
  [6, CAN_R, 1], [LIP_Z - 4, CAN_R, 1], [LIP_Z - 2.6, CAN_R + 1.8, 1],
  [LIP_Z + 1.8, CAN_R + 1.8, 1], [LIP_Z + 3.2, CAN_R + 0.5, 1],
  [LIP_Z + 4.4, CAN_R - 3, 1], [LIP_Z + 5.8, CAN_R - 8, 1], [LIP_Z + 7, CAN_R - 14, 1],
  [CAN_H, 0, 1]
];

function can() {
  const paths = G.solidOf(CAN_PROFILE, CAN_F, P, { rows: 4, steps: 56 });
  const o = [`<g class="fig-can">`];
  o.push(S(paths, {
    tone: "hi", crease: "lo", lit: true,
    inner: [
      G.arcOf(CAN_F, 6.5, CAN_R + 1.2, P, { slope: -1.2 }),
      G.arcOf(CAN_F, LIP_Z - 2.6, CAN_R + 1.8, P, { slope: 0.8 }),
      G.arcOf(CAN_F, 30, CAN_R + 0.05, P, { slope: 0 })
    ].map(d => L(d, { tone: "faint" })).join("")
  }));
  o.push(k.fadedSvg(G.ribsOf(CAN_F, 10, LIP_Z - 5, CAN_R + 0.7, 8, P, { fade: [0.06, 0.5] }), { tone: "lo" }));
  o.push(L(G.circleOf(CAN_F, 1, CAN_R * 0.7, P, 52), { tone: "faint" }));
  o.push("</g>");
  return o.join("");
}

function canHardware() {
  const o = [];
  /* three thumb screws around the lip */
  [0.42, 2.55, 4.62].forEach((a) => {
    const rad = G.radialOf(CAN_F, a);
    const p = G.pointOf(CAN_F, LIP_Z - 1, CAN_R + 1.4, a);
    const hx = p[0] - rad[0] * 3.6, hy = p[1] - rad[1] * 3.6;
    o.push(S(k.cylinder(hx, hy, 3.6, LIP_Z - 2, 4, P, 24), { tone: "mid" }));
    o.push(L(k.knurl(hx, hy, 3.6, LIP_Z + 0.6, LIP_Z + 2, 28, P, 0.3), { tone: "lo" }));
    o.push(L(k.lineOnTop([hx, hy], [hx + rad[0] * 2.4, hy + rad[1] * 2.4], LIP_Z + 2, P), { tone: "hi" }));
    o.push(D([at([hx, hy, LIP_Z + 2])], { size: 0.45, tone: "hi" }));
  });
  /* the triaxial element: three bosses at 90 degrees, half way up */
  [0.15, 2.24, 4.33].forEach((a) => {
    const p = G.pointOf(CAN_F, 22, CAN_R + 0.5, a);
    o.push(S(k.cylinder(p[0], p[1], 4.2, 20.4, 3.4, P, 24), { tone: "hi", crease: "lo" }));
    o.push(L(k.ring(p[0], p[1], 2.4, 23.8, P, 22), { tone: "faint" }));
    o.push(D([at([p[0], p[1], 23.8])], { size: 0.5, tone: "hi" }));
  });
  /* conduit gland at the base, facing the viewer */
  const gx = NODE[0] + CAN_R + 5.5, gy = NODE[1] + 6;
  o.push(S(k.cylinder(gx, gy, 5.4, PLINTH_H, 5, P, 26), { tone: "mid" }));
  o.push(L(k.knurl(gx, gy, 5.4, PLINTH_H + 3.4, PLINTH_H + 5, 30, P, 0.3), { tone: "lo" }));
  return o.join("");
}

/* ═══ D · SOLAR PANEL ON ITS BRACKET ══════════════════════ */
function panel() {
  const o = [];
  const cx = PANEL.x + PANEL.w / 2, cy = PANEL.y + PANEL.d / 2;
  o.push(S(k.slabOf({ x: cx - 5, y: cy - 5, w: 10, d: 10, r: 2 }, 0, 3.4, P, 3, 0.6), { tone: "mid" }));
  o.push(D(k.corners({ x: cx - 5, y: cy - 5, w: 10, d: 10, r: 2 }, 2.6).map(([x, y]) => at([x, y, 3.4])), { size: 0.4 }));
  /* two raked legs up to the panel */
  [[-16, -10], [16, -10]].forEach(([dx, dy]) => {
    o.push(S(k.slabOf({ x: cx + dx - 2, y: cy + dy - 2, w: 4, d: 4, r: 1 }, 3.4, PANEL_Z - 7, P, 3, 0.5), { tone: "mid", crease: "none" }));
  });
  o.push(S(k.slabOf({ x: cx - 3.4, y: cy - 3.4, w: 6.8, d: 6.8, r: 1.2 }, PANEL_Z - 3.6, 3.6, P, 3, 0.6), { tone: "mid" }));
  o.push(S(k.cylinder(cx, cy + 3.6, 3, PANEL_Z - 3.6, 3.2, P, 20), { tone: "hi", crease: "lo" }));
  o.push(L(k.knurl(cx, cy + 3.6, 3, PANEL_Z - 1.6, PANEL_Z - 0.4, 22, P, 0.3), { tone: "lo" }));

  o.push(S(k.slabOf(PANEL, PANEL_Z, 2.6, P, 4, 0.8), { tone: "hi", crease: "lo" }));
  o.push(L(k.planOutline(k.insetPlan(PANEL, 3.5), PANEL_Z + 2.6, P, 4), { tone: "faint" }));
  o.push(L(k.lineOnTop([PANEL.x + 4.5, PANEL.y + 4], [PANEL.x + PANEL.w - 4.5, PANEL.y + 4], PANEL_Z + 2.6, P), { tone: "lo" }));
  o.push(L(k.lineOnTop([PANEL.x + 4.5, PANEL.y + PANEL.d - 4], [PANEL.x + PANEL.w - 4.5, PANEL.y + PANEL.d - 4], PANEL_Z + 2.6, P), { tone: "lo" }));
  o.push(L(k.lineOnTop([PANEL.x + 4.5, PANEL.y + 4], [PANEL.x + 4.5, PANEL.y + PANEL.d - 4], PANEL_Z + 2.6, P), { tone: "lo" }));
  o.push(L(k.lineOnTop([PANEL.x + PANEL.w - 4.5, PANEL.y + 4], [PANEL.x + PANEL.w - 4.5, PANEL.y + PANEL.d - 4], PANEL_Z + 2.6, P), { tone: "lo" }));
  o.push(D(k.dotGrid(PANEL.x + 8, PANEL.y + 9, 5, 4, 9, PANEL_Z + 2.6, P), { size: 0.5, tone: "lo" }));
  return o.join("");
}

/* ═══ E · ANTENNA MAST ════════════════════════════════════ */
function mast() {
  const o = [];
  const [mx, my] = MAST;
  o.push(S(k.cylinder(mx, my, 7, 0, 5, P, 26), { tone: "mid" }));
  o.push(L(k.ring(mx, my, 4.8, 5, P, 24), { tone: "faint" }));
  o.push(S(k.cylinder(mx, my, 2.3, 5, MAST_H - 5, P, 20), { tone: "mid", crease: "none" }));
  o.push(L(k.sideArc(mx, my, 2.3, MAST_H * 0.42, P, 14), { tone: "lo" }));
  o.push(L(k.sideArc(mx, my, 2.3, MAST_H * 0.74, P, 14), { tone: "lo" }));
  o.push(S(k.cylinder(mx, my, 3.6, MAST_H - 2, 3.2, P, 22), { tone: "mid" }));
  o.push(S(k.cylinder(mx, my, 1, MAST_H + 1.2, 24, P, 14), { tone: "hi", crease: "none" }));
  o.push(S(G.sphereOf([mx, my, MAST_H + 25.8], 2, P, { steps: 24 }), { tone: "hi", lit: true }));
  o.push(D([at([mx, my, MAST_H + 1.2])], { size: 0.45, tone: "hi" }));
  return o.join("");
}

/* ═══ F · DIAL GAUGE ══════════════════════════════════════ */
function gauge() {
  const o = [];
  const [px, py] = POST;
  o.push(S(k.slabOf({ x: px - 12, y: py - 12, w: 24, d: 24, r: 2.5 }, 0, 5, P, 4, 0.9), { tone: "mid" }));
  o.push(D(k.corners({ x: px - 12, y: py - 12, w: 24, d: 24, r: 2.5 }, 3.6).map(([x, y]) => at([x, y, 5])), { size: 0.45 }));
  o.push(S(k.slabOf({ x: px - 3.6, y: py - 3.6, w: 7.2, d: 7.2, r: 1.2 }, 5, POST_H - 8, P, 3, 0.7), { tone: "mid" }));
  o.push(S(k.slabOf({ x: px - 5.4, y: py - 5.4, w: 10.8, d: 10.8, r: 2 }, POST_H - 3, 3, P, 3, 0.6), { tone: "mid" }));

  const arm = { x: px + 5, y: DIAL[1] - 4.4, w: DIAL[0] - DIAL_R - px - 5 + 4, d: 8.8, r: 2 };
  o.push(S(k.slabOf(arm, ARM_Z, 5.4, P, 4, 0.7), { tone: "mid" }));
  o.push(L(k.lineOnTop([arm.x + 5, arm.y + 1.5], [arm.x + arm.w - 7, arm.y + 1.5], ARM_Z + 5.4, P), { tone: "faint" }));
  o.push(D([at([arm.x + 5, arm.y + arm.d - 1.6, ARM_Z + 5.4]), at([arm.x + arm.w - 7, arm.y + arm.d - 1.6, ARM_Z + 5.4])], { size: 0.4 }));

  const [dx, dy] = DIAL;
  o.push(S(k.cylinder(dx, dy, 5.4, ARM_Z + 5.4, DIAL_Z - ARM_Z - 5.4, P, 24), { tone: "mid" }));
  o.push(S(k.slabOf({ x: dx - DIAL_R - 5, y: dy - 7.4, w: 8.6, d: 14.8, r: 2 }, ARM_Z + 5.4, DIAL_Z - ARM_Z - 5.4, P, 3, 0.5), { tone: "mid" }));
  o.push(S(k.cylinder(dx, dy, DIAL_R, DIAL_Z, DIAL_H, P, 76, 0.9), { tone: "hi", crease: "lo" }));
  o.push(L(k.knurl(dx, dy, DIAL_R, DIAL_TOP - 4.4, DIAL_TOP, 104, P, 0.3), { tone: "lo" }));
  o.push(L(k.sideArc(dx, dy, DIAL_R, DIAL_TOP - 4.4, P, 46), { tone: "faint" }));
  o.push(L(k.ring(dx, dy, DIAL_R - 2.8, DIAL_TOP, P, 76), { tone: "lo" }));

  const t = k.radialTicks(dx, dy, DIAL_R - 4.4, 26, 4, DIAL_TOP, [1.6, 3.6], P, -Math.PI * 0.78, Math.PI * 1.56);
  o.push(L(t.minor, { tone: "lo" }), L(t.major, { tone: "mid" }));
  o.push(k.faceTextSvg(k.topMatrix([dx, dy + 11], DIAL_TOP, P, "x"), "g", { size: 3.4, tone: "mid", anchor: "middle" }));
  o.push(k.faceTextSvg(k.topMatrix([dx - DIAL_R + 7.5, dy - 7.5], DIAL_TOP, P, "x"), "0", { size: 2.4, tone: "faint", anchor: "middle" }));
  o.push(k.faceTextSvg(k.topMatrix([dx + DIAL_R - 7.5, dy - 7.5], DIAL_TOP, P, "x"), ".6", { size: 2.4, tone: "faint", anchor: "middle" }));
  return o.join("");
}

const NEEDLE_TURNS = 1.5;
const needleAt = (turn) => {
  const a = (-0.78 + turn / NEEDLE_TURNS * 1.56) * Math.PI;
  const [x, y] = DIAL;
  return k.lineOnTop(
    [x - Math.sin(a) * 4.8, y + Math.cos(a) * 4.8],
    [x + Math.sin(a) * (DIAL_R - 5.4), y - Math.cos(a) * (DIAL_R - 5.4)],
    DIAL_TOP + 0.3, P
  );
};

/* ═══ G · INDICATOR LAMP ══════════════════════════════════ */
function lampBase() {
  const o = [];
  const [lx, ly] = LAMP;
  o.push(S(k.slabOf({ x: lx - 8, y: ly - 8, w: 16, d: 16, r: 2 }, 0, 3.6, P, 3, 0.6), { tone: "mid" }));
  o.push(D(k.corners({ x: lx - 8, y: ly - 8, w: 16, d: 16, r: 2 }, 3).map(([x, y]) => at([x, y, 3.6])), { size: 0.4 }));
  o.push(S(k.slabOf({ x: lx - 4.6, y: ly - 4.6, w: 9.2, d: 9.2, r: 1.6 }, 3.6, LAMP_Z - 14, P, 3, 0.7), { tone: "mid" }));
  o.push(L(k.planOutline(k.insetPlan({ x: lx - 4.6, y: ly - 4.6, w: 9.2, d: 9.2, r: 1.6 }, 1.6), LAMP_Z - 14, P, 3), { tone: "faint" }));
  o.push(S(k.cylinder(lx, ly, 6.4, LAMP_Z - 14, 4, P, 26), { tone: "mid" }));
  o.push(L(k.ring(lx, ly, 4.4, LAMP_Z - 10, P, 24), { tone: "faint" }));
  o.push(S(k.cylinder(lx, ly, 6, LAMP_Z, 3.6, P, 30), { tone: "hi", crease: "lo" }));
  o.push(L(k.knurl(lx, ly, 6, LAMP_Z + 1, LAMP_Z + 3.6, 34, P, 0.3), { tone: "lo" }));
  return o.join("");
}

function lampDome() {
  const [lx, ly] = LAMP;
  const ball = G.sphereOf([lx, ly, LAMP_Z + 3.6 + 5.6], 5.6, P, { steps: 44 });
  return `<g class="fig-lamp" style="--lamp:#2E7F7C;--lamp-shade:#1C4F4E">
    <g class="iso-solid" data-lit="true">
      <path class="iso-fill" d="${ball.fill}"/>
      ${ball.shades.map((d, i) => `<path class="iso-shade" data-shade="${i}" d="${d}"/>`).join("")}
      <path class="iso-top" d="${ball.top}"/>
      <path class="iso-edge" data-tone="mid" d="${ball.outline}" style="stroke:var(--anatomy-mid)"/>
    </g>
  </g>`;
}

/* ═══ H · GATEWAY BOX ═════════════════════════════════════ */
function gateway() {
  const o = [];
  o.push(S(k.slabOf(k.insetPlan(BOX, 5), 0, 3, P, 4, 0.6), { tone: "lo" }));
  o.push(S(k.slabOf(BOX, 3, BOX_H - 6, P, 5, 1.1), { tone: "mid" }));
  o.push(S(k.slabOf(k.insetPlan(BOX, 1.5), BOX_H - 3, 3, P, 5, 1), { tone: "hi", crease: "lo" }));
  o.push(L(k.planOutline(k.insetPlan(BOX, 4), BOX_H, P, 5), { tone: "faint" }));

  const scr = { x: BOX.x + 7, y: BOX.y + BOX.d - 13, w: 42, d: 10, r: 1 };
  o.push(S(k.slabOf(scr, 6, 1, P, 3, 0.4), { tone: "lo", crease: "none" }));
  o.push(L(k.planOutline(k.insetPlan(scr, 1.8), 7, P, 3), { tone: "faint" }));
  o.push(`<g class="fig-screen">${k.faceTextSvg(k.topMatrix([scr.x + scr.w / 2, scr.y + scr.d / 2 + 0.5], 7, P, "x"), "EDGE 8ms", { size: 3.1, tone: "hi", anchor: "middle" })}</g>`);

  for (let i = 0; i < 6; i++) {
    const x = BOX.x + 54 + i * 3.8;
    o.push(L(k.lineOnTop([x, BOX.y + 9], [x, BOX.y + BOX.d - 9], BOX_H, P), { tone: "faint" }));
  }
  o.push(D(k.corners(BOX, 5).map(([x, y]) => at([x, y, BOX_H])), { size: 0.45 }));
  o.push(k.faceTextSvg(k.topMatrix([BOX.x + 30, BOX.y + BOX.d / 2], BOX_H, P, "x"), "GATEWAY", { size: 3, tone: "lo", anchor: "middle" }));
  return o.join("");
}

/* ═══ I · SIGNAL CABLE ════════════════════════════════════ */
const GLAND = [NODE[0] + CAN_R + 10, NODE[1] + 6];
const ROUTE = G.fillet([
  [GLAND[0], GLAND[1], PLINTH_H + 2.5],
  [GLAND[0] + 10, GLAND[1] + 2, 9],
  [GLAND[0] + 16, GLAND[1] + 3, 2.2],
  [52, GLAND[1] + 3, 2.2],
  [52, -48, 2.2],
  [BOX.x + 5, -48, 2.2],
  [BOX.x + 5, BOX.y + BOX.d / 2 + 1, 2.2],
  [BOX.x + 5, BOX.y + BOX.d / 2 + 1, 9]
], 12, 8, { P, tube: 1.5 });

function cable() {
  const pieces = tubePieces(ROUTE, 1.5, P, { maxLength: 15, spacing: 2.4 });
  return `<g class="fig-cable">${pieces.map(p => tubeSvg(p, { tone: "mid" })).join("")}</g>`;
}

function clamp() {
  const c = G.pointAlong(ROUTE, G.pathLength(ROUTE) * 0.5);
  const o = [];
  o.push(S(k.slabOf({ x: c[0] - 7, y: c[1] - 7, w: 14, d: 14, r: 2 }, 0, 2.2, P, 3, 0.5), { tone: "mid" }));
  o.push(D(k.corners({ x: c[0] - 7, y: c[1] - 7, w: 14, d: 14, r: 2 }, 2.4).map(([x, y]) => at([x, y, 2.2])), { size: 0.4 }));
  o.push(S(k.cylinder(c[0], c[1], 3.6, 2.2, 2.8, P, 22), { tone: "hi", crease: "lo" }));
  o.push(L(k.ring(c[0], c[1], 2.2, 5, P, 20), { tone: "faint" }));
  return o.join("");
}

/* ═══ ASSEMBLE ═══════════════════════════════════════════ */
const hubAt = at([DIAL[0], DIAL[1], DIAL_TOP + 0.3]);
const svg = k.figureSvg({
  width: W, height: H,
  className: "fig-svg",
  label: "A seismic sensor node on a machined bench. A dial gauge reads ground acceleration in g and an indicator lamp steps from armed to p-wave to s-wave as the shaking arrives.",
  body: [
    bench(), plinth(), panel(), mast(), gauge(), lampBase(), gateway(),
    can(), canHardware(), clamp(), cable(), lampDome(),
    `<path data-part="needle" class="iso-line" data-tone="lit" data-free="start" d="${needleAt(0)}" style="stroke-width:1.5"/>`,
    `<circle data-part="hub" cx="${hubAt[0].toFixed(1)}" cy="${hubAt[1].toFixed(1)}" r="2.2" fill="var(--anatomy-lit)"/>`
  ]
});

/* ═══ LIVE ════════════════════════════════════════════════ */
const live = `
const P = ${JSON.stringify(P)};
const GROUND = ${JSON.stringify(GROUND)};
const NEEDLE_TURNS = ${NEEDLE_TURNS};
const DIAL = ${JSON.stringify(DIAL)}, DIAL_R = ${DIAL_R}, DIAL_TOP = ${DIAL_TOP};
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const needleAt = ${needleAt.toString().replace("k.lineOnTop", "lineOnTop")};
const groundAt = ${groundAt.toString()};
const peakAt = ${peakAt.toString()};
const stateAt = ${stateAt.toString()};

const stage = document.querySelector(".fig-stage");
const svgEl = stage.querySelector("svg");
const needle = svgEl.querySelector('[data-part="needle"]');
const lampG = svgEl.querySelector(".fig-lamp");
const screenG = svgEl.querySelector(".fig-screen");
const readout = stage.querySelector("[data-readout]");
const still = matchMedia("(prefers-reduced-motion: reduce)");
const TONE = { green: "#4be0dc", amber: "#ff6a1a", red: "#e5342a" };
const DEEP = { green: "#1F6E6B", amber: "#A3460F", red: "#8E1C16" };

let shown = 0, clock = 0, t = 0, touring = true, visible = false, idleTimer = 0, raf = 0, last = 0;

function frame(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 24) : 1 / 60;
  last = now;
  const calm = still.matches;
  if (touring && !calm) { clock += dt; t = -1.1 + (clock % 7.2); }
  const want = groundAt(t);
  shown = calm ? want : shown + (want - shown) * (1 - Math.exp(-dt / 0.07));
  needle.setAttribute("d", needleAt(shown / 0.6));
  const st = stateAt(t);
  const peak = peakAt(Math.max(t, 0));
  if (lampG) {
    lampG.style.setProperty("--lamp", TONE[st.tone]);
    lampG.style.setProperty("--lamp-shade", DEEP[st.tone]);
  }
  if (screenG) {
    const msg = st.id === "armed" ? "ARMED" : peak.toFixed(2) + "g";
    if (screenG.textContent !== msg) screenG.textContent = msg;
  }
  const line = st.label + " \\u00b7 " + Math.abs(peak).toFixed(3) + " g peak";
  if (readout && readout.textContent !== line) readout.textContent = line;
  stage.setAttribute("aria-valuenow", t.toFixed(1));
  stage.setAttribute("aria-valuetext", line);
  raf = visible ? requestAnimationFrame(frame) : 0;
}
const run = () => { if (!raf && visible) { last = 0; raf = requestAnimationFrame(frame); } };
const steer = (next) => {
  touring = false; t = clamp(next, 0, GROUND.TAIL - 0.3);
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => { touring = !still.matches; clock = t; run(); }, 4500);
  run();
};
new IntersectionObserver((es) => { visible = es[es.length - 1].isIntersecting; if (visible) run(); }, { rootMargin: "140px 0px" }).observe(stage);
if (still.matches) t = 5.2;
stage.addEventListener("pointermove", (e) => {
  const box = svgEl.getBoundingClientRect();
  steer(((e.clientX - box.left) / box.width) * (GROUND.TAIL - 0.6) - 0.2);
});
stage.addEventListener("pointerleave", () => steer(t));
stage.addEventListener("keydown", (e) => {
  const step = e.shiftKey ? 0.2 : 1;
  if (e.key === "ArrowRight") steer(t + step);
  else if (e.key === "ArrowLeft") steer(t - step);
  else if (e.key === "Home") steer(0);
  else if (e.key === "End") steer(GROUND.TAIL - 1);
  else return;
  e.preventDefault();
});
run();
`;

/* ═══ PAGE ════════════════════════════════════════════════ */
const html = k.plateHtml({
  fig: "Fig 1",
  title: "Seismic node",
  hint: "Move across the figure to scrub the event",
  readout: "armed \u00b7 0.000 g peak",
  keys: [
    { mark: "lit", label: "The can: the part that reads ground acceleration" },
    { mark: "raised", label: "Dial needle and lamp: one model, one instant" },
    { mark: "dotted", label: "Triaxial bosses: three orthogonal sensing axes" },
  ],
  caption: "A sensor node on a machined bench. Move across it and the dial needle tracks ground acceleration while the lamp steps armed to p-wave to s-wave. The P-wave is small and fast, the S-wave is large and slow, and everything an operator does with the warning happens in between.",
  body: `<div class="fig-stage" tabindex="0" role="slider" aria-label="Scrub the seismic event"`
    + ` data-proj='${JSON.stringify(P)}'`
    + ` data-dial='${JSON.stringify(DIAL)}' data-dial-top="${DIAL_TOP}" data-dial-r="${DIAL_R}" data-tail="${GROUND.TAIL}"`
    + ` aria-valuemin="-1" aria-valuemax="${GROUND.TAIL}" aria-valuenow="0">${svg}</div>`
});

writeFileSync(
  join(HERE, theme === "light" ? "seismic-node-light.html" : "seismic-node.html"),
  k.pageHtml({ title: "Seismic node", theme, width: W + 40, body: html, script: kitScript() + live })
);
if (!process.argv.includes("--no-inject")) {
  const page = join(HERE, "../../index.html");
  const a = "<!-- FIG:BEGIN -->", b = "<!-- FIG:END -->";
  const cur = readFileSync(page, "utf8");
  const i = cur.indexOf(a), j = cur.indexOf(b);
  if (i < 0 || j < 0) throw new Error("index.html is missing the FIG markers");
  writeFileSync(page, cur.slice(0, i + a.length) + "\n" + html + "\n" + cur.slice(j));
  console.log("injected figure into index.html");
}
console.log("wrote seismic-node", theme);