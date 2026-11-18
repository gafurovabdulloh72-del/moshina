// Qurilish bloklari: uy, devor, chodir, gulxan, daraxt va boshqalar. Hammasi GB ichiga quriladi.
import { hexLin } from './util.js';

// O'zaro ta'sir nuqtalari (skameyka, quduq, rasta): piyoda [E] bilan ishlatiladi
export const SPOTS = [];
const spot = (g, k) => SPOTS.push({ k, x: g.m[9], y: g.m[10], z: g.m[11], yaw: Math.atan2(g.m[2], g.m[8]) });
// Tirik detallar uchun ro'yxatlar (details.js o'qiydi): mo'rilar (tutun), bayroqlar (hilpiraydigan mato)
export const CHIMNEYS = [], FLAGS = [], LAMPS = [];
// quruvchi matritsasi bo'yicha dunyo nuqtasi va joyga bog'liq barqaror tasodif (st.rng oqimiga tegmaydi)
export const wpt = (g, x, y, z) => { const m = g.m; return [m[0] * x + m[1] * y + m[2] * z + m[9], m[3] * x + m[4] * y + m[5] * z + m[10], m[6] * x + m[7] * y + m[8] * z + m[11]]; };
export const hashP = (x, z, k = 0) => { const v = Math.sin(x * 12.9898 + z * 78.233 + k * 37.719) * 43758.5453; return v - Math.floor(v); };
export const PAL = {
  wall: [0xf3ead6, 0xefe2c4, 0xf7efe0, 0xe9d9b8, 0xf2dcc0], roof: [0xc8553a, 0xb84a34, 0xd06244, 0xa9462f], wood: 0x9a6a42, woodD: 0x6e4a30, woodL: 0xc79a66,
  stone: 0xb9b4a8, stoneD: 0x8f8a80, door: [0x2f7fb0, 0x3b8f6a, 0x8a5a36, 0xb84a34], win: 0xffd98a, lamp: 0xffe2a0,
  clay: 0xd9b78a, clayD: 0xc49c6e, turq: 0x2fb5b0, turqD: 0x1f8f96, snow: 0xf4f7fc, metal: 0x8a909c, metalD: 0x4a4e58, red: 0xd8392b, tent: [0xe2572f, 0x2f7fd0, 0xf0b83a, 0x3f9a58, 0x8a54c8],
};

// Oddiy uy. o: {w,d,h,floors,roof:'gable'|'hip'|'flat',wall,roofC,door,balcony,chimney}
export function house(g, gl, o) {
  const w = o.w || 8, d = o.d || 6.5, fh = o.h || 3, fl = o.floors || 1, H = fh * fl;
  g.color(PAL.stone).box(0, 0.2, 0, w + 0.5, 0.5, d + 0.5);
  g.color(o.wall || PAL.wall[0]).box(0, 0.4 + H / 2, 0, w, H, d);
  const ry = 0.4 + H;
  g.color(o.roofC || PAL.roof[0]);
  if (o.roof === 'flat') { g.color(o.wall || PAL.wall[0]).box(0, ry + 0.25, 0, w + 0.3, 0.5, d + 0.3); g.color(PAL.clayD).box(0, ry + 0.52, 0, w - 0.4, 0.06, d - 0.4); }
  else if (o.roof === 'hip') g.hip(w, d, Math.min(w, d) * 0.36, ry, 0.55, 0.35);
  else { g.push().rotY(w >= d ? Math.PI / 2 : 0); g.gable(Math.min(w, d), Math.max(w, d), Math.min(w, d) * 0.42, ry, 0.5); g.pop(); }
  const hx = g.m[9], hz = g.m[11], hh = (k) => hashP(hx, hz, k);
  // eshik (old tomon +z): kesaki, zinapoya, tutqich, ustida soyabon va chiroq
  g.color(o.door || PAL.door[0]).box(0, 0.4 + 1.05, d / 2 + 0.04, 1.1, 2.1, 0.1);
  g.color(PAL.woodD).box(0, 0.4 + 2.2, d / 2 + 0.05, 1.4, 0.14, 0.14); g.box(-0.62, 0.4 + 1.08, d / 2 + 0.05, 0.12, 2.16, 0.12); g.box(0.62, 0.4 + 1.08, d / 2 + 0.05, 0.12, 2.16, 0.12);
  g.color(0xd8c9a0).box(0.38, 0.4 + 1.0, d / 2 + 0.11, 0.05, 0.05, 0.06);
  g.color(PAL.stoneD).box(0, 0.32, d / 2 + 0.55, 1.7, 0.2, 0.8);
  if (hh(1) < 0.55) { g.color(o.roofC || PAL.roof[0]).box(0, 0.4 + 2.55, d / 2 + 0.45, 1.9, 0.08, 0.9); g.color(PAL.metalD).box(0, 0.4 + 2.42, d / 2 + 0.12, 0.12, 0.14, 0.1); gl.push(); gl.m = g.m.slice(); gl.flip = g.flip; gl.color(PAL.lamp).box(0, 0.4 + 2.3, d / 2 + 0.16, 0.14, 0.12, 0.1); gl.pop(); }
  // derazalar: rom, tokcha, o'rta ustuncha; har oyna o'z raqami bilan (kechasi alohida yonadi)
  const shut = hh(2) < 0.35 ? [0x3b6f8f, 0x4f7f4a, 0x6e4a30][(hh(3) * 3) | 0] : 0;
  const win = (x, y, z, ry) => { g.push().translate(x, y, z).rotY(ry); g.color(PAL.woodD).box(0, 0, 0.03, 1.15, 1.3, 0.08); const q = wpt(g, 0, 0, 0); gl.push(); gl.m = g.m.slice(); gl.flip = g.flip; gl.mask(1 + 0.02 + 0.96 * hashP(q[0], q[2], 5)); gl.color(PAL.win).box(0, 0, 0.06, 0.9, 1.05, 0.06); gl.mask(0); gl.pop(); g.color(PAL.woodD).box(0, 0, 0.1, 0.06, 1.05, 0.03); g.box(0, 0.08, 0.1, 0.9, 0.05, 0.03);
    g.color(PAL.stone).box(0, -0.7, 0.13, 1.35, 0.09, 0.26); if (shut) { g.color(shut); g.box(-0.82, 0, 0.07, 0.42, 1.25, 0.05); g.box(0.82, 0, 0.07, 0.42, 1.25, 0.05); } g.pop(); };
  for (let f = 0; f < fl; f++) {
    const y = 0.4 + f * fh + fh * 0.55;
    const nx = Math.max(1, Math.floor(w / 3.2));
    for (let i = 0; i < nx; i++) { const x = (i - (nx - 1) / 2) * (w / nx); if (f > 0 || Math.abs(x) > 1.2) win(x, y, d / 2, 0); win(x, y, -d / 2, Math.PI); }
    const nz = Math.max(1, Math.floor(d / 3.4));
    for (let i = 0; i < nz; i++) { const z = (i - (nz - 1) / 2) * (d / nz); win(w / 2, y, z, Math.PI / 2); win(-w / 2, y, z, -Math.PI / 2); }
  }
  if (o.balcony && fl > 1) {
    g.color(PAL.wood).box(0, 0.4 + fh - 0.1, d / 2 + 1.0, w + 0.4, 0.18, 2.0);
    for (let i = 0; i <= 4; i++) { const x = (i / 4 - 0.5) * (w + 0.2); g.color(PAL.woodD).box(x, 0.4 + fh / 2 - 0.1, d / 2 + 1.9, 0.18, fh - 0.2, 0.18); g.box(x, 0.4 + fh + 0.5, d / 2 + 1.9, 0.12, 1.0, 0.12); }
    g.box(0, 0.4 + fh + 1.0, d / 2 + 1.9, w + 0.4, 0.1, 0.12); g.box(0, 0.4 + fh + 0.55, d / 2 + 1.9, w + 0.4, 0.07, 0.08);
    g.color(o.roofC || PAL.roof[0]).box(0, 0.4 + H + 0.1, d / 2 + 1.2, w + 0.8, 0.14, 2.6);
    for (let i = 0; i <= 4; i++) { const x = (i / 4 - 0.5) * (w + 0.2); g.color(PAL.woodD).box(x, 0.4 + fh + (H - fh) / 2 + 0.3, d / 2 + 1.9, 0.14, H - fh - 0.6, 0.14); }
  }
  if (o.chimney) { g.color(PAL.stoneD).box(w * 0.28, ry + 1.2, -d * 0.2, 0.7, 2.2, 0.7); g.color(0x5a5650).box(w * 0.28, ry + 2.36, -d * 0.2, 0.84, 0.12, 0.84); const c = wpt(g, w * 0.28, ry + 2.45, -d * 0.2); CHIMNEYS.push({ x: c[0], y: c[1], z: c[2], ph: hh(4) * 100 }); }
  // tarnov quvuri (burchakda) va ba'zi tomlarda sun'iy yo'ldosh antennasi
  g.color(PAL.metal).box(w / 2 + 0.06, 0.4 + H / 2, d / 2 + 0.06, 0.1, H, 0.1);
  if (o.roof !== 'flat') g.box(0, ry - 0.02, d / 2 + 0.38, w + 0.9, 0.1, 0.12);
  if (hh(6) < 0.32) { g.push().translate(-w / 2 + 0.7, ry - 0.55, d / 2 + 0.05).rotY(0.5); g.color(PAL.metalD).box(0, 0, 0.18, 0.06, 0.06, 0.36); g.push().translate(0, 0.05, 0.42).rotX(-1.0); g.color(0xe8e8e4).cyl(10, 0.36, 0.06, 0, 0.12, { shade: 0.15 }); g.color(PAL.metalD).box(0, 0.28, 0.0, 0.03, 0.4, 0.03); g.pop(); g.pop(); }
  return { hx: w / 2 + 0.3, hz: d / 2 + 0.3, top: ry };
}

// To'siq/devor: (x1,z1)-(x2,z2), balandlik h. style: 'stone'|'wood'|'clay'
export function wall(g, x1, z1, x2, z2, h = 1.6, style = 'stone', thick = 0.5) {
  const dx = x2 - x1, dz = z2 - z1, len = Math.hypot(dx, dz), yaw = Math.atan2(dx, dz);
  g.push().translate(x1, 0, z1).rotY(yaw);
  if (style === 'wood') {
    const n = Math.max(1, Math.round(len / 2.4));
    g.color(PAL.woodD); for (let i = 0; i <= n; i++) g.box(0, h / 2, (i / n) * len, 0.16, h, 0.16);
    g.color(PAL.wood); g.box(0, h * 0.82, len / 2, 0.08, 0.14, len); g.box(0, h * 0.45, len / 2, 0.08, 0.14, len);
  } else {
    g.color(style === 'clay' ? PAL.clay : PAL.wall[1]).box(0, h / 2, len / 2, thick, h, len);
    g.color(style === 'clay' ? PAL.clayD : PAL.roof[1]).box(0, h + 0.1, len / 2, thick + 0.25, 0.2, len + 0.1);
    const n = Math.max(1, Math.round(len / 6));
    g.color(style === 'clay' ? PAL.clayD : PAL.stone); for (let i = 0; i <= n; i++) g.box(0, (h + 0.5) / 2, (i / n) * len, thick + 0.25, h + 0.5, thick + 0.25);
  }
  g.pop();
}

export function lampPost(g, gl, x, z, h = 4.2) {
  g.push().translate(x, 0, z); g.color(PAL.metalD).cyl(6, 0.09, 0.06, 0, h); g.box(0.35, h - 0.1, 0, 0.8, 0.07, 0.07); g.box(0.7, h - 0.22, 0, 0.3, 0.2, 0.3, { tx: 0.6, tz: 0.6 });
  gl.push(); gl.m = g.m.slice(); gl.color(PAL.lamp).box(0.7, h - 0.38, 0, 0.22, 0.16, 0.22); gl.pop(); const q = wpt(g, 0.7, 0, 0); LAMPS.push({ x: q[0], z: q[2] }); g.pop();
}

export function tent(g, x, z, yaw, hex, s = 1) {
  g.push().translate(x, 0, z).rotY(yaw).scale(s);
  g.color(hex).jit = 0.03;
  const A = [-1.5, 0, -1.8], B = [1.5, 0, -1.8], C = [1.5, 0, 1.8], D = [-1.5, 0, 1.8], R0 = [0, 2.0, -1.5], R1 = [0, 2.0, 1.5];
  g.quad(D, R1, R0, A); g.quad(B, R0, R1, C); g.tri(A, R0, B);
  g.color(0x2a2c33); g.tri([0.55, 0, 1.82], [0, 1.5, 1.6], [-0.55, 0, 1.82]);
  g.color(hex); g.tri(C, R1, [0.55, 0, 1.82]); g.tri([-0.55, 0, 1.82], R1, D); g.tri([0.55, 0, 1.82], R1, [0, 1.5, 1.6]); g.tri([0, 1.5, 1.6], R1, [-0.55, 0, 1.82]);
  g.pop();
}

export function campfire(g, x, z) {
  g.push().translate(x, 0, z);
  g.color(PAL.stoneD); for (let i = 0; i < 8; i++) { const a = (i / 8) * 6.283; g.blob(0.22, 0, { cx: Math.cos(a) * 0.75, cy: 0.1, cz: Math.sin(a) * 0.75, sy: 0.7 }); }
  g.color(PAL.woodD); for (let i = 0; i < 4; i++) { g.push().rotY(i * 0.8).rotZ(1.1); g.cyl(5, 0.09, 0.07, -0.2, 1.0); g.pop(); }
  g.pop();
}
export function logPile(g, x, z, yaw, n = 3) {
  g.push().translate(x, 0, z).rotY(yaw);
  for (let r = 0; r < n; r++) for (let i = 0; i < n - r; i++) { g.push().translate((i - (n - r - 1) / 2) * 0.62, 0.3 + r * 0.54, 0); g.color(PAL.wood).prismZ(7, 0.3, 3.2); g.color(PAL.woodL); g.pop(); }
  g.pop();
}
export function bench(g, x, z, yaw) { g.push().translate(x, 0, z).rotY(yaw); spot(g, 'bench'); g.color(PAL.wood).box(0, 0.5, 0, 2.0, 0.1, 0.5); g.color(PAL.woodD).box(-0.8, 0.25, 0, 0.12, 0.5, 0.45); g.box(0.8, 0.25, 0, 0.12, 0.5, 0.45); g.box(0, 0.85, -0.22, 2.0, 0.4, 0.08); g.pop(); }
export function well(g, x, z) {
  g.push().translate(x, 0, z); spot(g, 'well'); g.color(PAL.stone).prism(8, 1.1, 1.1, 0, 0.9); g.color(0x2a4a6a).prism(8, 0.85, 0.85, 0.85, 0.93);
  g.color(PAL.woodD).box(-0.95, 1.5, 0, 0.14, 2.2, 0.14); g.box(0.95, 1.5, 0, 0.14, 2.2, 0.14); g.color(PAL.roof[1]); g.push().rotY(Math.PI / 2); g.gable(1.4, 2.4, 0.7, 2.5, 0.2); g.pop(); g.pop();
}
export function stall(g, x, z, yaw, hex) {
  g.push().translate(x, 0, z).rotY(yaw); spot(g, 'stall'); g.color(PAL.wood).box(0, 0.85, 0, 2.6, 0.12, 1.3); g.color(PAL.woodD);
  for (const sx of [-1.2, 1.2]) for (const sz of [-0.55, 0.55]) g.box(sx, 1.2, sz, 0.1, 2.4, 0.1);
  g.color(hex).box(0, 2.5, 0.15, 3.0, 0.1, 1.9, { oz: 0.0 }); g.color(0xffffff).box(0, 2.5, 0.75, 3.0, 0.11, 0.3);
  for (let i = 0; i < 4; i++) { g.color([0xe2572f, 0xf0b83a, 0x7cc45a, 0xb84ac8][i]).blob(0.2, 0, { cx: -0.9 + i * 0.6, cy: 1.05, cz: 0.1 }); }
  g.pop();
}
export function board(g, gl, x, z, yaw) {
  g.push().translate(x, 0, z).rotY(yaw); g.color(PAL.woodD).box(-1.1, 1.3, 0, 0.16, 2.6, 0.16); g.box(1.1, 1.3, 0, 0.16, 2.6, 0.16);
  g.color(PAL.wood).box(0, 1.7, 0, 2.4, 1.5, 0.1); g.color(PAL.roof[0]); g.push().rotY(Math.PI / 2); g.gable(0.5, 2.9, 0.3, 2.6, 0.1); g.pop();
  const cols = [0xfdf6e3, 0xffe9a8, 0xcfe8ff, 0xffd0d0];
  for (let i = 0; i < 5; i++) { g.color(cols[i % 4]).box(-0.8 + (i % 3) * 0.75, 1.95 - Math.floor(i / 3) * 0.6, 0.07, 0.5, 0.42, 0.02); }
  g.pop();
}
// Silliq daraxt (statik geometriya ichiga)
export function tree(g, x, z, s, hex, kind = 0) {
  g.push().translate(x, 0, z).scale(s);
  g.color(0x7a5236).cyl(6, 0.3, 0.2, -0.3, 3.2, { shade: 0.1 });
  g.color(hex);
  if (kind === 1) { g.blob(1.0, 1, { cy: 5.0, sy: 4.0, jitter: 0.05, shade: 0.1 }); }
  else if (kind === 2) { g.cyl(9, 2.3, 0, 1.6, 5.2, { shade: 0.2 }); g.cyl(9, 1.8, 0, 3.8, 7.4, { shade: 0.2 }); g.cyl(9, 1.2, 0, 6.0, 9.6, { shade: 0.2 }); }
  else { g.blob(2.1, 1, { cy: 4.5, sy: 0.92, jitter: 0.09, shade: 0.2 }); g.blob(1.4, 1, { cx: 1.2, cy: 3.6, cz: 0.4, jitter: 0.1, shade: 0.2 }); g.blob(1.3, 1, { cx: -1.1, cy: 3.8, cz: -0.4, jitter: 0.1, shade: 0.2 }); }
  g.pop();
}
// Manzildagi odam: statik quti emas — joy va kiyim ro'yxatga yoziladi, places.js ularni haqiqiy skeletli odam (rig.js) qilib qo'yadi
export const PEOPLE = [];
export function person(g, x, z, yaw, shirt = 0x2f7fd0, pants = 0x3a3f4c) {
  const q = wpt(g, x, 0, z); PEOPLE.push({ x: q[0], y: q[1], z: q[2], yaw: Math.atan2(g.m[2], g.m[8]) + yaw, shirt, pants });
}
export function boat(g, x, y, z, yaw, hex = 0x2f7fd0) {
  g.push().translate(x, y, z).rotY(yaw); g.color(hex).box(0, 0.3, 0, 1.5, 0.6, 3.6, { tx: 1.25, tz: 1.12 }); g.color(0xf2ead8).box(0, 0.58, 0, 1.3, 0.08, 3.4, { tx: 1.25, tz: 1.1 });
  g.color(PAL.wood).box(0, 0.5, 0.4, 1.5, 0.08, 0.3); g.box(0, 0.5, -0.8, 1.4, 0.08, 0.3); g.pop();
}
// Bayroq: ustun shu yerda, mato esa details.js da hilpiraydi (FLAGS ro'yxati)
export function flag(g, x, z, h, hex) { g.push().translate(x, 0, z); g.color(PAL.metalD).cyl(5, 0.05, 0.04, 0, h); g.color(0xd8d8d0).blob(0.07, 0, { cy: h + 0.02 }); const p = wpt(g, 0, h - 0.1, 0); FLAGS.push({ x: p[0], y: p[1], z: p[2], hex, w: 1.0 + h * 0.03, h: 0.62 + h * 0.018 }); g.pop(); }
export function arch(g, w, h, d, hex) { // darvoza arkasi: markazda, +z ga qaragan
  g.color(hex).box(-w / 2 - 0.5, h / 2, 0, 1.0, h, d); g.box(w / 2 + 0.5, h / 2, 0, 1.0, h, d); g.box(0, h + 0.5, 0, w + 2.0, 1.0, d);
  g.box(-w / 2 + 0.35, h - 0.35, 0, 0.7, 0.7, d * 0.9, { tx: 0.01 }); g.box(w / 2 - 0.35, h - 0.35, 0, 0.7, 0.7, d * 0.9, { tx: 0.01 });
}
export function dome(g, r, hex, y = 0) { g.color(hex).blob(r, 2, { cy: y, sy: 1.05, shade: 0.12 }); g.color(0xe8c84a).cyl(5, 0.08, 0.02, y + r * 1.02, y + r * 1.02 + r * 0.35); }
export function crate(g, s = 1) { g.color(PAL.woodL).box(0, 0.5 * s, 0, s, s, s); g.color(PAL.woodD); for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.box(sx * 0.47 * s, 0.5 * s, sz * 0.47 * s, 0.1 * s, s * 1.02, 0.1 * s); }
export function barrel(g, hex = 0xb8402e) { g.color(hex).cyl(8, 0.36, 0.36, 0, 1.0, { cap: true, shade: 0.08 }); g.color(PAL.metalD).cyl(8, 0.375, 0.375, 0.28, 0.34); g.cyl(8, 0.375, 0.375, 0.66, 0.72); }
export function hay(g) { g.color(0xe2c460); g.push().translate(0, 0.65, 0); g.prismX(10, 0.65, 1.3); g.pop(); }
export function cone(g) { g.color(0xf26a2a).cyl(6, 0.24, 0.05, 0.04, 0.8); g.color(0x2a2c33).box(0, 0.03, 0, 0.6, 0.06, 0.6); g.color(0xffffff).cyl(6, 0.165, 0.125, 0.36, 0.5); }
export function sign(g) { g.color(PAL.woodD).box(0, 0.8, 0, 0.12, 1.6, 0.12); g.color(0xf2ead8).box(0, 1.5, 0.06, 1.2, 0.6, 0.06); g.color(PAL.red).box(0, 1.5, 0.1, 0.9, 0.12, 0.02); }
