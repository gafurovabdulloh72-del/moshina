// Umumiy yordamchilar: tasodifiy sonlar, shovqin, matematika, rang
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const saturate = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
export const smoothstep = (a, b, x) => {
  let t = (x - a) / (b - a);
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return t * t * (3 - 2 * t);
};
export const TAU = Math.PI * 2;
export const angDiff = (a, b) => {
  let d = (a - b) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
};

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// Koordinatadan barqaror hash (0..1)
export function hash2(ix, iz, seed = 0) {
  let h = (Math.imul(ix | 0, 374761393) + Math.imul(iz | 0, 668265263) + Math.imul(seed | 0, 2147483647)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

// --- Simplex shovqini (2D) ---
const perm = new Uint8Array(512);
const grad2 = [1, 1, -1, 1, 1, -1, -1, -1, 1, 0, -1, 0, 0, 1, 0, -1];
(function initNoise() {
  const r = mulberry32(20261113);
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = (r() * (i + 1)) | 0;
    const t = p[i]; p[i] = p[j]; p[j] = t;
  }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
})();
const F2 = 0.5 * (Math.sqrt(3) - 1), G2 = (3 - Math.sqrt(3)) / 6;
export function noise(x, y) {
  const s = (x + y) * F2;
  const i = Math.floor(x + s), j = Math.floor(y + s);
  const t = (i + j) * G2;
  const x0 = x - (i - t), y0 = y - (j - t);
  const i1 = x0 > y0 ? 1 : 0, j1 = x0 > y0 ? 0 : 1;
  const x1 = x0 - i1 + G2, y1 = y0 - j1 + G2;
  const x2 = x0 - 1 + 2 * G2, y2 = y0 - 1 + 2 * G2;
  const ii = i & 255, jj = j & 255;
  let n = 0;
  let t0 = 0.5 - x0 * x0 - y0 * y0;
  if (t0 > 0) { const g = (perm[ii + perm[jj]] & 7) * 2; t0 *= t0; n += t0 * t0 * (grad2[g] * x0 + grad2[g + 1] * y0); }
  let t1 = 0.5 - x1 * x1 - y1 * y1;
  if (t1 > 0) { const g = (perm[ii + i1 + perm[jj + j1]] & 7) * 2; t1 *= t1; n += t1 * t1 * (grad2[g] * x1 + grad2[g + 1] * y1); }
  let t2 = 0.5 - x2 * x2 - y2 * y2;
  if (t2 > 0) { const g = (perm[ii + 1 + perm[jj + 1]] & 7) * 2; t2 *= t2; n += t2 * t2 * (grad2[g] * x2 + grad2[g + 1] * y2); }
  return 70 * n; // taxminan -1..1
}
export function fbm(x, y, oct = 4, lac = 2, gain = 0.5) {
  let a = 1, f = 1, s = 0, n = 0;
  for (let i = 0; i < oct; i++) { s += a * noise(x * f, y * f); n += a; a *= gain; f *= lac; }
  return s / n;
}
export function ridged(x, y, oct = 4) {
  let a = 1, f = 1, s = 0, n = 0;
  for (let i = 0; i < oct; i++) { const v = 1 - Math.abs(noise(x * f, y * f)); s += a * v * v; n += a; a *= 0.5; f *= 2.1; }
  return s / n; // 0..1
}

// --- Rang: sRGB hex -> chiziqli RGB (three.js vertex ranglari chiziqli) ---
const s2l = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
export function hexLin(hex) {
  return [s2l(((hex >> 16) & 255) / 255), s2l(((hex >> 8) & 255) / 255), s2l((hex & 255) / 255)];
}
export const mixRGB = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
export const scaleRGB = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
export function lerpHex(h1, h2, t) {
  const r = lerp((h1 >> 16) & 255, (h2 >> 16) & 255, t), g = lerp((h1 >> 8) & 255, (h2 >> 8) & 255, t), b = lerp(h1 & 255, h2 & 255, t);
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b);
}

// Centripetal Catmull-Rom: nuqtalar ro'yxatidan tekis egri chiziq namunalari
export function catmullRom(pts, step = 4, closed = false) {
  const n = pts.length;
  const P = (i) => closed ? pts[((i % n) + n) % n] : pts[clamp(i, 0, n - 1)];
  const out = [];
  const segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
    const d = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
    const m = Math.max(1, Math.round(d / step));
    for (let k = 0; k < m; k++) {
      const t = k / m, t2 = t * t, t3 = t2 * t;
      const x = 0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3);
      const y = 0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3);
      out.push([x, y]);
    }
  }
  if (!closed) out.push([pts[n - 1][0], pts[n - 1][1]]);
  return out;
}
// Bir xil qadam bilan qayta namunalash
export function resample(pts, step) {
  const out = [[pts[0][0], pts[0][1]]];
  let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    let ax = pts[i - 1][0], ay = pts[i - 1][1];
    const bx = pts[i][0], by = pts[i][1];
    let d = Math.hypot(bx - ax, by - ay);
    while (acc + d >= step) {
      const t = (step - acc) / d;
      ax = ax + (bx - ax) * t; ay = ay + (by - ay) * t;
      out.push([ax, ay]);
      d = Math.hypot(bx - ax, by - ay);
      acc = 0;
    }
    acc += d;
  }
  const L = out[out.length - 1], E = pts[pts.length - 1];
  if (Math.hypot(L[0] - E[0], L[1] - E[1]) > step * 0.35) out.push([E[0], E[1]]); else out[out.length - 1] = [E[0], E[1]];
  return out;
}
