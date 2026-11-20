// Qayiqlar: eshkakli va yelkanli qayiq modeli (GB) hamda oddiy suzish fizikasi — suzuvchanlik, chayqalish, sayozda yumshoq tiralish, shamol burchagi
import * as THREE from 'three';
import * as T from './terrain.js';
import * as COL from './colliders.js';
import { GB, MAT } from './geo.js';
import { PAL } from './blocks.js';
import { clamp, angDiff } from './util.js';

export const DRAFT = 0.32; // qayiq cho'kishi (m): bundan sayoz joyda tiraladi
// Suv chuqurligi: yer (yoki iskala, to'siq) suv sathidan baland bo'lsa — manfiy
export function depthAt(x, z, extra) {
  const wy = T.waterY(x, z); let d = wy - T.gridHeight(x, z);
  // iskala taxtasi suvga yaqin (qayiq tagidan o'tolmaydi) — quruqlikdek
  for (let i = 0; i < T.patches.length; i++) { const p = T.patches[i], dx = x - p.cx, dz = z - p.cz; if (dx > p.rad || dx < -p.rad || dz > p.rad || dz < -p.rad) continue;
    const u = dx * p.s + dz * p.c, w = dx * p.c - dz * p.s; if (u < -p.hl - 0.8 || u > p.hl + 0.8 || w < -p.hw - 0.8 || w > p.hw + 0.8) continue; const py = Math.max(p.y0, p.y1); if (py > wy - 0.5 && py < wy + 3.4) return -1; }
  for (const o of COL.query(x, z, 1.6)) { if (o.kind || o.y1 < wy - 0.2 || o.y0 > wy + 1.4) continue; let qx = o.x, qz = o.z; if (o.t === 1) { const sx = o.x2 - o.x, sz = o.z2 - o.z, t = clamp(((x - o.x) * sx + (z - o.z) * sz) / (sx * sx + sz * sz || 1), 0, 1); qx = o.x + sx * t; qz = o.z + sz * t; } else if (o.t !== 0) continue; if (Math.hypot(x - qx, z - qz) < o.r + 0.7) return -1; }
  if (extra) for (const c of extra) if (Math.hypot(x - c[0], z - c[1]) < c[2]) return -1;
  return d;
}
// Yelkan samaradorligi: th — qayiq yo'nalishi bilan shamol kelayotgan tomon orasidagi burchak (0 — shamolga qarshi, PI — shamol orqadan)
export function sailEff(th) { th = Math.abs(th); return th < 0.52 ? 0 : th < 1.0 ? ((th - 0.52) / 0.48) * 0.75 : th < 1.75 ? 0.75 + (0.25 * (th - 1.0)) / 0.75 : 1 - (0.38 * (th - 1.75)) / (Math.PI - 1.75); }

// Bir qadam: b {kind, x, z, yaw, v, w, sail}, f — oldinga/orqaga (-1..1), s — burilish (+ chapga), wind {x, z, s} (shamol esayotgan yo'nalish, m/s)
export function boatStep(b, dt, f, s, wind, extra) {
  const sail = b.kind === 'sail';
  if (sail) {
    // W — yelkanni tortish, S — bo'shatish (tormoz); tegilmasa joyida qoladi
    if (f > 0.1) b.sail = Math.min(1, b.sail + dt * 0.8 * f); else if (f < -0.1) b.sail = Math.max(0, b.sail + dt * 0.9 * f);
    const from = Math.atan2(-wind.x, -wind.z); b.th = Math.abs(angDiff(b.yaw, from)); b.eff = sailEff(b.th);
    const vt = Math.min(10.5, wind.s * 1.2 * b.eff * b.sail); b.v += (vt - b.v) * dt * (vt > b.v ? 0.3 : 0.45);
    const wt = s * clamp(0.12 + 0.075 * Math.abs(b.v), 0, 0.55); b.w += (wt - b.w) * Math.min(1, dt * 2);
  } else {
    const thr = f > 0 ? f * 1.45 : f * 0.95; b.v += (thr - 0.16 * b.v - 0.09 * b.v * Math.abs(b.v)) * dt; // eshkak: sekin, lekin barqaror (~12 km/soat)
    const wt = s * (0.55 + 0.08 * Math.abs(b.v)); b.w += (wt - b.w) * Math.min(1, dt * 2.2);
  }
  // sayoz joy: oldingi (yoki orqaga yurganda — orqa) uchi bo'yicha chuqurlik; sayozlashgan sari yumshoq sekinlashadi, quruqlikka chiqmaydi
  const half = (sail ? 4.2 : 3.0) * Math.sign(b.v || 1), sy = Math.sin(b.yaw), cy = Math.cos(b.yaw);
  const tipD = depthAt(b.x + sy * half, b.z + cy * half, extra);
  b.beach = false;
  if (tipD < 0.9) { b.v -= b.v * Math.min(1, (0.9 - Math.max(tipD, 0)) * 3.2 * dt); if (tipD < DRAFT) { b.beach = true; if (Math.abs(b.v) < 0.25 || tipD < 0.05) b.v = 0; } }
  let nx = b.x + sy * b.v * dt, nz = b.z + cy * b.v * dt;
  if (depthAt(nx, nz, extra) < DRAFT * 0.6 || (b.beach && tipD < 0.05 && depthAt(nx + sy * half, nz + cy * half, extra) < tipD)) { nx = b.x; nz = b.z; b.v *= 0.5; }
  b.x = nx; b.z = nz;
  // burilishda orqa/old uchi quruqlikka urilmasin
  const ny = b.yaw + b.w * dt, L = sail ? 3.6 : 2.6;
  if (depthAt(b.x + Math.sin(ny) * L, b.z + Math.cos(ny) * L, extra) > 0.05 && depthAt(b.x - Math.sin(ny) * L, b.z - Math.cos(ny) * L, extra) > 0.05) b.yaw = ny; else b.w *= 0.3;
}

// --- modellar ---
// Korpus (blocks.js boat shakli): uchli tumshuq, egilgan bortlar, ichida pol va o'rindiqlar; sx/sy/sz — o'lcham
function hull(g, hex, sx, sy, sz, stripe) {
  const S = [[-2.7, 1.0, 0.62, 0.95, 0.12], [-1.2, 1.15, 0.7, 0.92, 0.05], [0.6, 1.1, 0.6, 0.95, 0.05], [2.0, 0.75, 0.25, 1.05, 0.15], [3.1, 0.02, 0.0, 1.25, 0.45]].map(([z, t, b, y, k]) => [z * sz, t * sx, b * sx, y * sy, k * sy]);
  const dq = (a, b, c, d) => { g.quad(a, b, c, d); g.quad(d, c, b, a); };
  g.color(hex); for (let k = 0; k < S.length - 1; k++) { const [z0, t0, b0, y0, k0] = S[k], [z1, t1, b1, y1, k1] = S[k + 1];
    for (const sd of [-1, 1]) { if (stripe) { const m0 = y0 - 0.22 * sy, m1 = y1 - 0.22 * sy, q0 = t0 + (b0 - t0) * 0.25, q1 = t1 + (b1 - t1) * 0.25; g.color(stripe); dq([sd * t0, y0, z0], [sd * t1, y1, z1], [sd * q1, m1, z1], [sd * q0, m0, z0]); g.color(hex); dq([sd * q0, m0, z0], [sd * q1, m1, z1], [sd * b1, k1, z1], [sd * b0, k0, z0]); }
      else dq([sd * t0, y0, z0], [sd * t1, y1, z1], [sd * b1, k1, z1], [sd * b0, k0, z0]); } }
  g.color(0x2a2c33); for (let k = 0; k < S.length - 1; k++) { const [z0, , b0, , k0] = S[k], [z1, , b1, , k1] = S[k + 1]; dq([-b0, k0, z0], [-b1, k1, z1], [b1, k1, z1], [b0, k0, z0]); }
  g.color(hex); dq([-S[0][1], S[0][3], S[0][0]], [S[0][1], S[0][3], S[0][0]], [S[0][2], S[0][4], S[0][0]], [-S[0][2], S[0][4], S[0][0]]);
  g.color(0xf2ead8); for (let k = 0; k < S.length - 1; k++) { const [z0, t0, , y0] = S[k], [z1, t1, , y1] = S[k + 1]; for (const sd of [-1, 1]) g.box(sd * (t0 + t1) / 2, (y0 + y1) / 2 + 0.03, (z0 + z1) / 2, 0.1, 0.08, Math.hypot(z1 - z0, t1 - t0) + 0.05, { oz: 0 }); }
  g.color(0xb8905e).box(0, 0.32 * sy, -0.4 * sz, 1.3 * sx, 0.05, 3.6 * sz);
}
const mesh = (geo, mat = MAT.flat) => { const m = new THREE.Mesh(geo, mat); m.castShadow = true; m.receiveShadow = true; return m; };
// Eshkakli qayiq: root (suvda), tilt (chayqalish), ikkita eshkak (o'z bandida aylanadi), seat — eshkakchi o'rindig'i (orqaga qaragan)
export function buildRowBoat(hex = 0x2f7fd0) {
  const root = new THREE.Group(), tilt = new THREE.Group(); root.add(tilt);
  const g = new GB(811); g.jit = 0.02; g.translate(0, -0.3, 0); hull(g, hex, 1, 1, 1);
  g.color(PAL.wood); g.box(0, 0.62, -1.9, 1.75, 0.07, 0.4); g.box(0, 0.62, 0.3, 2.0, 0.07, 0.36); g.box(0, 0.66, 2.1, 1.2, 0.07, 0.3);
  g.color(PAL.metalD); for (const sd of [-1, 1]) g.box(sd * 1.12, 0.98, -0.2, 0.08, 0.12, 0.08); // eshkak tayanchlari
  tilt.add(mesh(g.build()));
  const oars = [1, -1].map((sd) => { // sd: +1 — qayiqning +x tomoni
    const piv = new THREE.Group(), dip = new THREE.Group(); piv.position.set(sd * 1.12, 0.72, -0.2); piv.add(dip); tilt.add(piv);
    const o = new GB(812 + sd); o.jit = 0; o.color(PAL.woodL); o.box(sd * 0.82, 0, 0, 3.3, 0.06, 0.06); o.color(PAL.wood).box(sd * -0.66, 0, 0, 0.32, 0.075, 0.075); o.color(0xf2ead8).box(sd * 2.25, 0, 0, 0.62, 0.035, 0.24);
    dip.add(mesh(o.build())); return { piv, dip, sd, ph: 0 };
  });
  const seat = new THREE.Group(); seat.position.set(0, 0.36, 0.3); seat.rotation.y = Math.PI; tilt.add(seat);
  return { root, tilt, oars, seat, len: 5.8, hgt: 1.5 };
}
// Yelkanli qayiq: uzunroq korpus, ustun, burilib turadigan gik va yelkan (ikki tomonlama), suv osti qanoti
export function buildSailBoat(hex = 0xf2ead8) {
  const root = new THREE.Group(), tilt = new THREE.Group(); root.add(tilt);
  const g = new GB(821); g.jit = 0.015; g.translate(0, -0.34, 0); hull(g, hex, 1.08, 1.05, 1.42, 0x2f6a98);
  g.color(PAL.wood); g.box(0, 0.66, -2.9, 1.9, 0.07, 0.5); g.box(0, 0.66, -0.4, 2.15, 0.07, 0.4); g.color(0xb8905e).box(0, 0.98, 3.0, 1.1, 0.06, 1.8);
  g.color(0x2a2c33).box(0, -0.35, 0.2, 0.08, 0.9, 1.4); // suv osti qanoti
  g.color(0xe9e4d8); g.translate(0, 0.34, 0); g.cyl(6, 0.075, 0.05, 0.6, 7.2); g.translate(0, -0.34, 0); // ustun (z=0)
  g.color(PAL.metalD); g.box(0, 0.6, -3.9, 0.06, 0.5, 0.4); g.color(PAL.woodD).box(0, 0.95, -3.3, 0.05, 0.05, 1.0); // rul va dasta
  // old kichik yelkan (qo'zg'almas): ustun uchidan tumshuqqa
  { const a = [0, 6.4, 0.08], b = [0, 1.3, 3.95], c = [0.3, 1.35, 1.1]; g.color(0xf6f2ea); g.tri(a, b, c); g.tri(c, b, a); }
  tilt.add(mesh(g.build()));
  const boom = new THREE.Group(); boom.position.set(0, 1.25, 0); tilt.add(boom);
  const b2 = new GB(822); b2.jit = 0; b2.color(0x8a909c).box(0, 0, -1.65, 0.08, 0.08, 3.3);
  boom.add(mesh(b2.build()));
  const sailG = new THREE.Group(); boom.add(sailG);
  const s = new GB(823); s.jit = 0; const sq = (a, b, c) => { s.tri(a, b, c); s.tri(c, b, a); };
  // yelkan: ustun bo'ylab (z=0) va gik bo'ylab (pastda); o'rtasi biroz bo'rtib turadi (x>0 tomonga — kerak bo'lsa ko'zgu bilan almashadi)
  const top = [0, 5.85, -0.05], foot = [0, 0.08, -0.08], clew = [0, 0.1, -3.15], mid = [0.38, 2.2, -1.25], hi = [0.2, 4.0, -0.55];
  s.color(0xfbf8f0); sq(top, hi, foot); sq(hi, mid, foot); sq(foot, mid, clew); sq(hi, top, mid); s.color(0xd8392b); sq(mid, top, clew);
  sailG.add(mesh(s.build()));
  const seat = new THREE.Group(); seat.position.set(0, 0.42, -2.75); tilt.add(seat);
  return { root, tilt, boom, sailG, seat, len: 8.0, hgt: 2.6 };
}
