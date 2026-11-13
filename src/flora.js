// O'simlik va tosh generatorlari: shoxlangan daraxtlar, barg kartalari (protsedura atlas), silliq toshlar, o't yamoqlari va gullar
import * as THREE from 'three';
import { MAT, WIND } from './geo.js';
import { mulberry32, hexLin } from './util.js';

// --- vektor yordamchilari ---
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], len = (a) => Math.hypot(a[0], a[1], a[2]);
const nrm = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const mix3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const sst = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const cl01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const UP = [0, 1, 0];
const perp = (d) => nrm(Math.abs(d[1]) < 0.9 ? cross(d, UP) : cross(d, [1, 0, 0]));
const rot = (v, ax, a) => { const c = Math.cos(a), s = Math.sin(a), k = nrm(ax), d = dot(k, v), cr = cross(k, v); return [v[0] * c + cr[0] * s + k[0] * d * (1 - c), v[1] * c + cr[1] * s + k[1] * d * (1 - c), v[2] * c + cr[2] * s + k[2] * d * (1 - c)]; };
// 3D qiymat shovqini (tosh shakli uchun)
const h3 = (x, y, z, s) => { let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(z | 0, 1440662683) + Math.imul(s | 0, 2147483647)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
function vn3(x, y, z, s) {
  const i = Math.floor(x), j = Math.floor(y), k = Math.floor(z), u = x - i, v = y - j, w = z - k, fu = u * u * (3 - 2 * u), fv = v * v * (3 - 2 * v), fw = w * w * (3 - 2 * w);
  const L = (a, b, t) => a + (b - a) * t;
  return L(L(L(h3(i, j, k, s), h3(i + 1, j, k, s), fu), L(h3(i, j + 1, k, s), h3(i + 1, j + 1, k, s), fu), fv), L(L(h3(i, j, k + 1, s), h3(i + 1, j, k + 1, s), fu), L(h3(i, j + 1, k + 1, s), h3(i + 1, j + 1, k + 1, s), fu), fv), fw) * 2 - 1;
}
const fbm3 = (p, f, s, o = 3) => { let a = 1, n = 0, t = 0; for (let i = 0; i < o; i++) { t += a * vn3(p[0] * f, p[1] * f, p[2] * f, s + i * 13); n += a; a *= 0.5; f *= 2.03; } return t / n; };

// --- ikosfera (indeksli; toshlar va toj yadrolari uchun) ---
const ICO = (() => {
  const t = (1 + Math.sqrt(5)) / 2;
  let v = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]].map(nrm);
  let f = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
  const L = [{ v, f }];
  for (let d = 0; d < 2; d++) {
    const nv = v.map((p) => p.slice()), nf = [], cache = new Map();
    const mid = (a, b) => { const k = a < b ? a * 4096 + b : b * 4096 + a; let i = cache.get(k); if (i === undefined) { nv.push(nrm(mix3(nv[a], nv[b], 0.5))); i = nv.length - 1; cache.set(k, i); } return i; };
    for (const q of f) { const a = mid(q[0], q[1]), b = mid(q[1], q[2]), c = mid(q[2], q[0]); nf.push([q[0], a, c], [q[1], b, a], [q[2], c, b], [a, b, c]); }
    v = nv; f = nf; L.push({ v, f });
  }
  return L;
})();

// --- geometriya quruvchi: position, normal, color (chiziqli), aMask, ixtiyoriy uv ---
class FB {
  constructor(seed) { this.P = []; this.N = []; this.C = []; this.M = []; this.U = []; this.r = mulberry32(seed); }
  v(p, n, c, m, u = 0, w = 0) { this.P.push(p[0], p[1], p[2]); this.N.push(n[0], n[1], n[2]); this.C.push(c[0], c[1], c[2]); this.M.push(m); this.U.push(u, w); }
  // uchburchak; o'rash tartibi normalga qarab avtomatik to'g'rilanadi (tashqaridan soat miliga teskari)
  tri(a, b, c) {
    const fn = cross(sub(b[0], a[0]), sub(c[0], a[0])), an = add(add(a[1], b[1]), c[1]);
    if (dot(fn, an) < 0) { const t = b; b = c; c = t; }
    this.v(...a); this.v(...b); this.v(...c);
  }
  get count() { return this.P.length / 9; }
  build(uv) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.P), 3));
    g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(this.N), 3));
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(this.C), 3));
    g.setAttribute('aMask', new THREE.BufferAttribute(new Float32Array(this.M), 1));
    if (uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(this.U), 2));
    g.computeBoundingSphere(); g.computeBoundingBox();
    return g;
  }
}

// Quvur (tana/shox): pts nuqtalar bo'ylab, rads radiuslar; col(t, p, side) — rang; normal radial
function pipe(b, pts, rads, sides, col, m = 0, twist = 0, qk = null) {
  const n = pts.length, rings = [];
  let u = null;
  for (let i = 0; i < n; i++) {
    const tg = nrm(sub(pts[Math.min(n - 1, i + 1)], pts[Math.max(0, i - 1)]));
    u = u ? nrm(sub(u, mul(tg, dot(u, tg)))) : perp(tg);
    const w = cross(tg, u), ring = [];
    for (let s = 0; s <= sides; s++) {
      const a = (s / sides) * 6.2832 + twist * i, d = add(mul(u, Math.cos(a)), mul(w, Math.sin(a)));
      const p = add(pts[i], mul(d, rads[i]));
      ring.push([p, d, col(i / (n - 1), p, s % sides)]);
    }
    rings.push(ring);
  }
  for (let i = 0; i < n - 1; i++) for (let s = 0; s < sides; s++) {
    const A = rings[i][s], B = rings[i][s + 1], C = rings[i + 1][s + 1], D = rings[i + 1][s], k = qk ? qk(i, s) : 1, f = (q) => (k === 1 ? q[2] : mul(q[2], k)); // qk: har to'rtburchakka alohida (aniq chegarali) rang koeffitsienti
    b.tri([A[0], A[1], f(A), m], [B[0], B[1], f(B), m], [C[0], C[1], f(C), m]);
    b.tri([A[0], A[1], f(A), m], [C[0], C[1], f(C), m], [D[0], D[1], f(D), m]);
  }
}
// Egri shox yo'li: boshlang'ich nuqta, yo'nalish, uzunlik, bukilish (yuqoriga/pastga), qadamlar
function bend(p0, dir, L, curl, steps, rng, wob = 0.08) {
  const pts = [p0]; let d = nrm(dir), p = p0;
  for (let i = 1; i <= steps; i++) { d = nrm(add(add(d, [0, curl / steps, 0]), [(rng() - 0.5) * wob, (rng() - 0.5) * wob, (rng() - 0.5) * wob])); p = add(p, mul(d, L / steps)); pts.push(p); }
  return pts;
}
// Sfera/blob: o.c markaz, o.r [rx,ry,rz], o.det, o.disp(u)->koeff, o.n(p,u)->normal yoki o.smooth (to'rdan hisoblanadi), o.col(p,u,d)
function sphere(b, o) {
  const S = ICO[o.det], P = [], D = [];
  for (const u of S.v) { const d = o.disp ? o.disp(u) : 1; D.push(d); let p = [u[0] * d * o.r[0], u[1] * d * o.r[1], u[2] * d * o.r[2]]; if (o.post) p = o.post(p); P.push(add(o.c, p)); }
  let N;
  if (o.smooth) { N = P.map(() => [0, 0, 0]); for (const f of S.f) { const fn = cross(sub(P[f[1]], P[f[0]]), sub(P[f[2]], P[f[0]])); for (const i of f) { N[i][0] += fn[0]; N[i][1] += fn[1]; N[i][2] += fn[2]; } } N = N.map((n, i) => (dot(n, S.v[i]) < 0 ? mul(nrm(n), -1) : nrm(n))); if (o.n) N = N.map((n, i) => o.n(P[i], S.v[i], n)); }
  else N = P.map((p, i) => o.n(p, S.v[i]));
  const C = P.map((p, i) => o.col(p, S.v[i], D[i], N[i]));
  for (const f of S.f) b.tri([P[f[0]], N[f[0]], C[f[0]], o.m], [P[f[1]], N[f[1]], C[f[1]], o.m], [P[f[2]], N[f[2]], C[f[2]], o.m]);
}
// Atlas katakchasi: 4x2 to'r, 256 px; ichkaridan 3 px chekinish (qo'shni katak sizib chiqmasin)
const CELLUV = (cell) => { const cx = cell % 4, cy = (cell / 4) | 0, e = 3 / 1024, f = 3 / 512; return [cx / 4 + e, 1 - (cy + 1) / 2 + f, (cx + 1) / 4 - e, 1 - cy / 2 - f]; };
// Karta (to'rtburchak): o markaz, U/V yarim o'qlar, nf(p)->normal, cf(p)->rang; u0..u1 katak ichida qism (palma bargi bo'laklari uchun)
function card(b, o, U, V, cell, nf, cf, m = 1, u0 = 0, u1 = 1) {
  const [a0, b0, a1, b1] = CELLUV(cell), ua = a0 + (a1 - a0) * u0, ub = a0 + (a1 - a0) * u1;
  const P = [sub(sub(o, U), V), sub(add(o, U), V), add(add(o, U), V), add(sub(o, U), V)], T = [[ua, b0], [ub, b0], [ub, b1], [ua, b1]];
  const Q = P.map((p, i) => [p, nf(p), cf(p), m, T[i][0], T[i][1]]);
  b.v(...Q[0]); b.v(...Q[1]); b.v(...Q[2]); b.v(...Q[0]); b.v(...Q[2]); b.v(...Q[3]);
}
// Shox kartasi: asosi p0 (u=0) dan uchi p1 (u=1) gacha, eni w, tekislik yon vektori side
function strip(b, p0, p1, side, w0, w1, cell, nf, cf, m = 1, u0 = 0, u1 = 1) {
  const [a0, b0, a1, b1] = CELLUV(cell), ua = a0 + (a1 - a0) * u0, ub = a0 + (a1 - a0) * u1;
  const P = [sub(p0, mul(side, w0)), sub(p1, mul(side, w1)), add(p1, mul(side, w1)), add(p0, mul(side, w0))], T = [[ua, b0], [ub, b0], [ub, b1], [ua, b1]];
  const Q = P.map((p, i) => [p, nf(p), cf(p), m, T[i][0], T[i][1]]);
  b.v(...Q[0]); b.v(...Q[1]); b.v(...Q[2]); b.v(...Q[0]); b.v(...Q[2]); b.v(...Q[3]);
}

// ================= Barg atlasi (Canvas 2D, yuklanishda bir marta) =================
// Katakchalar: 0 keng barg, 1 igna (archa shoxi), 2 gul (olcha), 3 mayda barg (qayin, terak, akatsiya), 4 qor bo'lagi, 5 palma bargi, 6 quruq novda, 7 o'tlar
export const LEAF = { tex: null };
function drawAtlas() {
  const W = 1024, H = 512, cv = document.createElement('canvas'), av = document.createElement('canvas');
  cv.width = av.width = W; cv.height = av.height = H;
  const c = cv.getContext('2d'), a = av.getContext('2d'), R = mulberry32(777);
  c.fillStyle = 'rgb(118,118,118)'; c.fillRect(0, 0, W, H); a.fillStyle = '#000'; a.fillRect(0, 0, W, H);
  const g8 = (v) => Math.max(0, Math.min(255, Math.round(v * 255)));
  const rgb = (r, g, b) => `rgb(${g8(r)},${g8(g)},${g8(b)})`;
  // barg shakli (uchli ellips), ikki tusli (bir yarmi yorug'roq) + o'rta tomir
  const leaf = (x, y, L, Wd, ang, k, tint = [1, 1, 1], vein = true) => {
    for (const [ctx, isA] of [[c, false], [a, true]]) {
      ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
      ctx.beginPath(); ctx.moveTo(-L, 0); ctx.quadraticCurveTo(-L * 0.1, -Wd * 1.5, L, 0); ctx.quadraticCurveTo(-L * 0.1, Wd * 1.5, -L, 0);
      if (isA) { ctx.fillStyle = '#fff'; ctx.fill(); }
      else {
        const gr = ctx.createLinearGradient(0, -Wd, 0, Wd); gr.addColorStop(0, rgb(k * 1.06 * tint[0], k * 1.06 * tint[1], k * 1.06 * tint[2])); gr.addColorStop(0.5, rgb(k * 0.92 * tint[0], k * 0.92 * tint[1], k * 0.92 * tint[2])); gr.addColorStop(1, rgb(k * 0.74 * tint[0], k * 0.74 * tint[1], k * 0.74 * tint[2]));
        ctx.fillStyle = gr; ctx.fill();
        if (vein) { ctx.strokeStyle = rgb(k * 0.62 * tint[0], k * 0.62 * tint[1], k * 0.62 * tint[2]); ctx.lineWidth = 0.9; ctx.beginPath(); ctx.moveTo(-L * 0.9, 0); ctx.lineTo(L * 0.8, 0); ctx.stroke(); }
      }
      ctx.restore();
    }
  };
  const line = (x0, y0, x1, y1, w, k, both = true) => { for (const [ctx, isA] of both ? [[c, false], [a, true]] : [[c, false]]) { ctx.strokeStyle = isA ? '#fff' : rgb(k, k * 0.95, k * 0.9); ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); } };
  const disc = (x, y, r, col, alpha = true) => { c.fillStyle = col; c.beginPath(); c.arc(x, y, r, 0, 6.2832); c.fill(); if (alpha) { a.fillStyle = '#fff'; a.beginPath(); a.arc(x, y, r, 0, 6.2832); a.fill(); } };
  const gauss = () => (R() + R() + R() - 1.5) / 1.5;
  const clip = (ox, oy) => { for (const ctx of [c, a]) { ctx.save(); ctx.beginPath(); ctx.rect(ox + 2, oy + 2, 252, 252); ctx.clip(); } };
  const unclip = () => { c.restore(); a.restore(); };
  // 0: keng barg to'dasi — markazda zich, chetida siyrak (yirtiq siluet)
  { const ox = 0, oy = 0; clip(ox, oy);
    for (let i = 0; i < 9; i++) { const an = R() * 6.28, l = 40 + R() * 70; line(ox + 128, oy + 140, ox + 128 + Math.cos(an) * l, oy + 140 + Math.sin(an) * l, 2.2, 0.32); }
    for (let i = 0; i < 260; i++) { const rr = Math.pow(R(), 0.62) * 118, an = R() * 6.28, x = ox + 128 + Math.cos(an) * rr, y = oy + 128 + Math.sin(an) * rr * 0.92; const k = 0.74 + R() * 0.3 - rr / 118 * 0.06; leaf(x, y, 9 + R() * 6, 4.5 + R() * 2.5, an + (R() - 0.5) * 1.6, k, [1, 1, 1]); }
    unclip(); }
  // 1: archa shoxi — o'q bo'ylab ignali novdalar (u=0 tanada, u=1 uchida), o'rtasi keng
  { const ox = 256, oy = 0; clip(ox, oy);
    const sh = (t) => Math.sin(Math.min(1, t * 1.15) * 3.0) * 0.85 + 0.15;
    line(ox + 4, oy + 128, ox + 250, oy + 128, 3.2, 0.3);
    for (let i = 0; i < 34; i++) { const t = 0.03 + (i / 34) * 0.94, x = ox + 4 + t * 244, len = 104 * sh(t) * (0.75 + R() * 0.35);
      for (const sg of [-1, 1]) { const an = sg * (0.75 + R() * 0.35), ex = x + Math.cos(an) * len * 0.55, ey = oy + 128 + Math.sin(an) * len;
        line(x, oy + 128, ex, ey, 1.6, 0.34);
        for (let q = 0; q < 18; q++) { const s = q / 18, px = x + (ex - x) * s, py = oy + 128 + (ey - oy - 128) * s, nl = 12 * (1 - s * 0.45); for (const sd of [-1, 1]) { const na = an + sd * (0.7 + R() * 0.5) + 0.35, k = 0.66 + R() * 0.36; line(px, py, px + Math.cos(na) * nl, py + Math.sin(na) * nl, 2.0, k); } } } }
    unclip(); }
  // 2: olcha guli — besh gulbargli gullar to'dasi (oq/pushti), orasida yashil barglar
  { const ox = 512, oy = 0; clip(ox, oy);
    for (let i = 0; i < 7; i++) { const an = R() * 6.28, l = 40 + R() * 70; line(ox + 128, oy + 140, ox + 128 + Math.cos(an) * l, oy + 140 + Math.sin(an) * l, 2.4, 0.22); }
    for (let i = 0; i < 46; i++) { const rr = Math.pow(R(), 0.7) * 112, an = R() * 6.28; leaf(ox + 128 + Math.cos(an) * rr, oy + 128 + Math.sin(an) * rr, 9 + R() * 4, 4.5, an, 0.62 + R() * 0.2, [0.55, 0.82, 0.42]); }
    for (let i = 0; i < 150; i++) { const rr = Math.pow(R(), 0.6) * 116, an = R() * 6.28, x = ox + 128 + Math.cos(an) * rr, y = oy + 128 + Math.sin(an) * rr, s = 5 + R() * 3.5, k = 0.86 + R() * 0.14, rot0 = R() * 6.28;
      for (let p = 0; p < 5; p++) { const pa = rot0 + p * 1.2566; disc(x + Math.cos(pa) * s * 0.62, y + Math.sin(pa) * s * 0.62, s * 0.58, rgb(k, k * 0.96, k * 0.97)); }
      disc(x, y, s * 0.3, rgb(0.85, 0.62, 0.42), false); }
    unclip(); }
  // 3: mayda barglar — osilgan ingichka novdalarda (qayin/terak/akatsiya)
  { const ox = 768, oy = 0; clip(ox, oy);
    for (let i = 0; i < 16; i++) { let x = ox + 20 + R() * 216, y = oy + 8 + R() * 70, an = 1.2 + (R() - 0.5) * 0.9; const n = 9 + (R() * 8 | 0);
      for (let q = 0; q < n; q++) { const nx = x + Math.cos(an) * 12, ny = y + Math.sin(an) * 12; line(x, y, nx, ny, 1.2, 0.3); x = nx; y = ny; an += (R() - 0.5) * 0.3;
        for (const sd of [-1, 1]) leaf(x + sd * 4, y, 6 + R() * 2.5, 3.6 + R() * 1.4, an + sd * 0.8, 0.74 + R() * 0.3); } }
    unclip(); }
  // 4: qor bo'lagi — cho'zinchoq oq dog'lar (shox ustida)
  { const ox = 0, oy = 256; clip(ox, oy);
    for (let i = 0; i < 70; i++) { const t = R(), x = ox + 12 + t * 232, wv = Math.sin(Math.min(1, t * 1.1) * 3.0) * 70 + 14, y = oy + 128 + gauss() * wv * 0.6, r = 9 + R() * 14 * (1 - t * 0.5), k = 0.86 + R() * 0.14; disc(x, y, r, rgb(k, k, k * 1.02)); }
    unclip(); }
  // 5: palma bargi — o'q va ikki tomonga uzun bargchalar
  { const ox = 256, oy = 256; clip(ox, oy);
    line(ox + 4, oy + 128, ox + 252, oy + 128, 3.5, 0.45);
    for (let i = 0; i < 44; i++) { const t = 0.03 + (i / 44) * 0.95, x = ox + 4 + t * 246, l = 112 * Math.sin(Math.min(1, t * 1.08 + 0.12) * 2.9) * (0.85 + R() * 0.2);
      for (const sg of [-1, 1]) { const an = sg * (1.05 + R() * 0.2) + 0.25; leaf(x + Math.cos(an) * l * 0.5, oy + 128 + Math.sin(an) * l * 0.5, l * 0.52, 4 + R() * 1.5, an, 0.62 + R() * 0.36); } }
    unclip(); }
  // 6: quruq novdalar — shoxlanuvchi ingichka chiziqlar, kam bargli (saksovul, cho'l butasi)
  { const ox = 512, oy = 256; clip(ox, oy);
    const tw = (x, y, an, l, w, d) => { const ex = x + Math.cos(an) * l, ey = y + Math.sin(an) * l; line(x, y, ex, ey, w, 0.42 + R() * 0.25); if (d > 0) { for (let i = 0; i < 2 + (R() * 2 | 0); i++) tw(ex, ey, an + (R() - 0.5) * 1.3, l * (0.62 + R() * 0.2), w * 0.72, d - 1); } else for (let i = 0; i < 3; i++) leaf(ex + (R() - 0.5) * 6, ey + (R() - 0.5) * 6, 4 + R() * 3, 1.6, R() * 6.28, 0.7 + R() * 0.3, [1, 1, 1], false); };
    for (let i = 0; i < 7; i++) tw(ox + 128 + (R() - 0.5) * 40, oy + 250, -1.57 + (R() - 0.5) * 1.6, 48 + R() * 20, 3, 4);
    unclip(); }
  // 7: o't poyalari (pastdan yuqoriga)
  { const ox = 768, oy = 256; clip(ox, oy);
    for (let i = 0; i < 90; i++) { const x = ox + 6 + R() * 244, h = 120 + R() * 125, lean = (R() - 0.5) * 60, k = 0.5 + R() * 0.5, w = 2 + R() * 2.5;
      for (const [ctx, isA] of [[c, false], [a, true]]) { ctx.fillStyle = isA ? '#fff' : rgb(k * 0.9, k, k * 0.8); ctx.beginPath(); ctx.moveTo(x - w, oy + 254); ctx.quadraticCurveTo(x + lean * 0.3, oy + 254 - h * 0.6, x + lean, oy + 254 - h); ctx.quadraticCurveTo(x + lean * 0.3 + w * 0.5, oy + 254 - h * 0.6, x + w, oy + 254); ctx.fill(); } }
    unclip(); }
  // RGB (rang kanvasi) + A (alfa kanvasi) -> bitta RGBA DataTexture (shaffof piksellarda ham rang saqlanadi: mipmap chetlari qoraymaydi)
  const cd = c.getImageData(0, 0, W, H).data, ad = a.getImageData(0, 0, W, H).data, out = new Uint8Array(W * H * 4);
  for (let y = 0; y < H; y++) { const so = y * W * 4, dO = (H - 1 - y) * W * 4; for (let x = 0; x < W * 4; x += 4) { out[dO + x] = cd[so + x]; out[dO + x + 1] = cd[so + x + 1]; out[dO + x + 2] = cd[so + x + 2]; out[dO + x + 3] = ad[so + x]; } }
  // Atlas — rangli rasm emas, asosan kulrang yorqinlik niqobi (tus nusxa/vertex rangidan keladi): qiymatlar CHIZIQLI albedo koeffitsienti sifatida
  // sozlangan, shuning uchun ataylab NoColorSpace (SRGBColorSpace qilinsa barglar ~1.5 marta qorayadi — qayta sozlash kerak bo'ladi)
  const tex = new THREE.DataTexture(out, W, H, THREE.RGBAFormat); tex.colorSpace = THREE.NoColorSpace;
  tex.generateMipmaps = true; tex.minFilter = THREE.LinearMipmapLinearFilter; tex.magFilter = THREE.LinearFilter; tex.anisotropy = 4; tex.needsUpdate = true;
  return tex;
}

// ================= Materiallar =================
// Umumiy shamol: MAT.tree bilan bir xil tebranish (aMask: nusxa rangi + tebranish), ustiga barg titrashi
const SWAY = `
  #ifdef USE_INSTANCING
    float swT = max(0.0, position.y - 1.2) * aMask; vec4 wpT = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
    transformed.x += sin(uTime * 1.3 + wpT.x * 0.13 + wpT.z * 0.11 + position.y * 0.5) * 0.024 * swT;
    transformed.z += cos(uTime * 1.1 + wpT.x * 0.09 - wpT.z * 0.14 + position.y * 0.4) * 0.02 * swT;
    transformed += normal * sin(uTime * 5.3 + dot(position, vec3(3.1, 2.3, 2.7)) + wpT.x) * 0.035 * aMask * step(0.6, position.y);
  #endif
`;
const COLV = `
  #if defined( USE_COLOR_ALPHA )
    vColor = vec4( 1.0 );
  #elif defined( USE_COLOR ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
    vColor = vec3( 1.0 );
  #endif
  #ifdef USE_COLOR
    vColor *= color;
  #endif
  #ifdef USE_INSTANCING_COLOR
    vColor.xyz *= mix(vec3(1.0), instanceColor.xyz, aMask);
  #endif
`;
// Ikki tomonlama yuzlarda normal teskari aylantirilmaydi (egilgan "toj" normali har ikki tomondan bir xil yoritiladi) + orqadan tushgan yorug'lik (barg shaffofligi)
// Kartaga qirrasidan qaralganda (cho'zilgan chiziqlar) alfa so'ndiriladi: yuz normali ekran hosilalaridan
const EDGE = `  diffuseColor.a *= smoothstep(0.06, 0.3, abs(dot(normalize(cross(dFdx(vViewPosition), dFdy(vViewPosition))), normalize(vViewPosition))));
`;
// wrap: yorug'likdan teskari tomonga ham ozgina tarqalgan yorug'lik (barg toji yarim shaffof) — tunda/tongda tojning soya yarmi qop-qora bo'lib qolmaydi
const FRAG = (trans, wrap) => (s) => s.replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\n  normal = normalize( vNormal );\n')
  .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
  #if NUM_DIR_LIGHTS > 0
    { vec3 dL = directionalLights[0].direction; float blT = pow(max(dot(normalize(-vViewPosition), dL), 0.0), 4.0), nl = dot(normal, dL), wr = 0.25 + (nl + 1.0) * 0.5 - max(0.0, nl);
      reflectedLight.directDiffuse += RECIPROCAL_PI * diffuseColor.rgb * directionalLights[0].color * (blT * ${trans.toFixed(2)} + wr * ${wrap.toFixed(2)}); }
  #endif
`);
export function leafMaterial() {
  if (!LEAF.tex) LEAF.tex = drawAtlas();
  // alphaToCoverage: MSAA bor joyda (2-daraja) karta chetlari silliqlanadi va uzoqda miltillamaydi; MSAA yo'q bo'lsa oddiy alfa-testdek ishlaydi (doimiy xususiyat — qayta kompilyatsiya yo'q)
  const m = new MAT.tree.constructor({ vertexColors: true, map: LEAF.tex, alphaTest: 0.42, alphaToCoverage: true, side: THREE.DoubleSide });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = WIND;
    sh.vertexShader = 'attribute float aMask;\nuniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n' + SWAY).replace('#include <color_vertex>', COLV);
    sh.fragmentShader = FRAG(0.9, 0.45)(sh.fragmentShader).replace('#include <alphatest_fragment>', EDGE + '#include <alphatest_fragment>');
  };
  m.customProgramCacheKey = () => 'flora-leaf-2';
  return m;
}
// O't materiali: poya tebranishi (balandlik kvadrati bilan), nusxa rangi aMask bo'yicha
export function grassMaterial() {
  const m = new MAT.tree.constructor({ vertexColors: true, side: THREE.DoubleSide });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = WIND;
    sh.vertexShader = 'attribute float aMask;\nuniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      #ifdef USE_INSTANCING
        vec4 wpI = instanceMatrix * vec4(position, 1.0); float swy = position.y * position.y * 2.2;
        float gust = sin(uTime * 0.7 + wpI.x * 0.05 + wpI.z * 0.04) * 0.5 + 0.7;
        transformed.x += (sin(uTime * 1.9 + wpI.x * 0.35 + wpI.z * 0.27) * 0.36 * gust + sin(uTime * 4.3 + wpI.x * 1.3 + wpI.z * 0.9) * 0.08) * swy;
        transformed.z += (cos(uTime * 1.6 + wpI.x * 0.22 - wpI.z * 0.31) * 0.3 * gust + sin(uTime * 3.7 + wpI.z * 1.1) * 0.07) * swy;
      #endif
`).replace('#include <color_vertex>', COLV);
    sh.fragmentShader = FRAG(0.7, 0.2)(sh.fragmentShader);
  };
  m.customProgramCacheKey = () => 'flora-grass-2';
  return m;
}

// ================= Daraxt generatorlari =================
// Toj soyasi: markazdan uzoqlik (t) va balandlik (h) bo'yicha — ichi qorong'i, tashqi yuqori uchlari yorug'
const crownAO = (t, h) => (0.62 + 0.38 * sst(0.1, 0.92, t)) * (0.8 + 0.27 * h) * (t > 0.82 && h > 0.55 ? 1.06 : 1);
const hueK = (k, hv) => [k * (1 + 0.08 * hv), k * (1 + 0.025 * hv), k * (1 - 0.09 * hv)];
// Toj: klasterlar ro'yxati -> barg kartalari. Toj ellipsoid "konvert" sifatida qaraladi: normal — ellipsoid normali (+ yuqoriga), soya — markazga yaqinlik va balandlik.
// Ichki klaster markazlarida katta qorong'i kartalar (silliq yadro sharlari o'rniga — ichkari zich barg massasidek ko'rinadi)
function crown(o, c, cl, opt) {
  let mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
  for (const q of cl) for (let a = 0; a < 3; a++) { mn[a] = Math.min(mn[a], q.c[a] - q.r * 0.8); mx[a] = Math.max(mx[a], q.c[a] + q.r * 0.8); }
  const C = opt.center || mul(add(mn, mx), 0.5), E = [Math.max(0.5, (mx[0] - mn[0]) / 2), Math.max(0.5, (mx[1] - mn[1]) / 2), Math.max(0.5, (mx[2] - mn[2]) / 2)];
  const rng = o.r, up = opt.up == null ? 0.45 : opt.up;
  const loc = (p) => [(p[0] - C[0]) / E[0], (p[1] - C[1]) / E[1], (p[2] - C[2]) / E[2]];
  const nAt = (p) => { const l = loc(p); return nrm(add(nrm([l[0] / E[0], l[1] / E[1], l[2] / E[2]]), [0, up, 0])); };
  const kAt = (p) => { const l = loc(p); return crownAO(Math.min(1, len(l)), cl01(l[1] * 0.5 + 0.5)); };
  for (const q of cl) {
    const n = Math.max(2, Math.round((opt.cards || 6) * (q.r / opt.rRef)));
    // ichki qorong'i karta (klaster markazida)
    if (opt.inner !== false) for (let i = 0; i < (opt.inner || 1); i++) { const fn = nrm([rng() * 2 - 1, rng() * 2 - 1, rng() * 2 - 1]); let U = perp(fn); U = rot(U, fn, rng() * 6.28); const V = cross(fn, U), s = q.r * 1.15; card(c, add(q.c, [0, -q.r * 0.1, 0]), mul(U, s), mul(V, s), q.cell == null ? opt.cell : q.cell, nAt, (pp) => opt.ink ? opt.ink(kAt(pp) * 0.7, pp, q.hv) : hueK(kAt(pp) * 0.7, q.hv), 1); }
    for (let i = 0; i < n; i++) {
      const ru = nrm([rng() * 2 - 1, rng() * 2 - 1, rng() * 2 - 1]), p = add(q.c, mul([ru[0], ru[1] * (opt.flat || 1), ru[2]], q.r * (0.3 + 0.6 * Math.sqrt(rng()))));
      const out = nrm(loc(p));
      let fn = opt.horiz ? nrm(add([0, 1, 0], mul(ru, opt.horiz))) : nrm(add(mul(out, 0.35), nrm([rng() * 2 - 1, rng() * 2 - 1, rng() * 2 - 1])));
      if (opt.hang) fn = nrm([fn[0], fn[1] * 0.35, fn[2]]);
      let U = perp(fn); U = rot(U, fn, rng() * 6.28); const V = cross(fn, U), s = q.r * (opt.size || 0.95) * (0.8 + rng() * 0.4);
      card(c, p, mul(U, s), mul(V, s * (opt.aspect || 1)), q.cell == null ? opt.cell : q.cell, nAt, (pp) => opt.ink ? opt.ink(kAt(pp), pp, q.hv) : hueK(kAt(pp), q.hv), 1);
    }
  }
  return { C, E };
}
// Po'stloq rangi: tagida qorong'i (yerga yaqin), toj ostida biroz soya
const barkCol = (base, yTop) => (t, p) => { const k = (0.55 + 0.45 * sst(-0.2, 1.0, p[1])) * (p[1] > yTop * 0.8 ? 0.82 : 1); return [base[0] * k, base[1] * k, base[2] * k]; };

// Keng bargli daraxt (olma/eman/olcha): tana -> ayri asosiy shoxlar -> ellipsoid konvert ichida tekis taqsimlangan barg klasterlari (bo'lakli, notekis toj)
function broadleaf(seed, opt) {
  const o = new FB(seed), c = new FB(seed + 1), rng = o.r, bark = hexLin(opt.bark), cl = [], bk = barkCol(bark, opt.H + 2);
  const H = opt.H, tp = bend([0, -0.3, 0], [(rng() - 0.5) * 0.12, 1, (rng() - 0.5) * 0.12], H + 0.3, 0, 3, rng, 0.06);
  pipe(o, tp, tp.map((_, i) => opt.tr * (1 - 0.3 * i / (tp.length - 1))), 6, bk);
  const fork = tp[tp.length - 1], E = opt.env, Ce = add(fork, [0, E[1] * 0.78, 0]), a0 = rng() * 6.28, ends = [];
  for (let i = 0; i < opt.limbs; i++) {
    const az = a0 + (i / opt.limbs) * 6.28 + (rng() - 0.5) * 0.5, tgt = add(Ce, [Math.cos(az) * E[0] * 0.62, (rng() - 0.2) * E[1] * 0.45, Math.sin(az) * E[2] * 0.62]);
    const d = sub(tgt, fork), lp = bend(fork, d, len(d), 0.12, 2, rng, 0.12); pipe(o, lp, [opt.tr * 0.6, opt.tr * 0.38, opt.tr * 0.16], 4, bk); ends.push(lp[lp.length - 1]);
  }
  for (let i = 0; i < opt.n; i++) {
    let p; for (let t = 0; t < 12; t++) { const u = nrm([rng() * 2 - 1, rng() * 2 - 1.1, rng() * 2 - 1]), f = 0.5 + 0.45 * Math.sqrt(rng()); p = add(Ce, [u[0] * E[0] * f, u[1] * E[1] * f, u[2] * E[2] * f]); if (p[1] > fork[1] + 0.35) break; }
    cl.push({ c: p, r: opt.cr * (0.8 + rng() * 0.4), hv: rng() * 2 - 1 });
    if (i < opt.twigs) { let best = ends[0], bd = 1e9; for (const e of ends) { const dd = len(sub(e, p)); if (dd < bd) { bd = dd; best = e; } } const sp = bend(best, sub(p, best), bd * 0.85, 0.1, 1, rng, 0.1); pipe(o, sp, [opt.tr * 0.17, opt.tr * 0.07], 3, bk); }
  }
  crown(o, c, cl, { cell: opt.cell, cards: opt.cards || 6, rRef: opt.cr, size: opt.size, hang: opt.hang, center: Ce, up: opt.up, inner: opt.inner, ink: opt.ink });
  return { hi: o.build(), cards: c.build(true) };
}
// Uzoq (LOD) varianti: tana + 1–2 silliq blob, tashqariga egilgan normal, pishirilgan soya
function lowCrown(seed, bark, tr, H, blobs, opt = {}) {
  const o = new FB(seed), rng = o.r;
  if (bark) pipe(o, [[0, -0.3, 0], [0, H, 0]], [tr, tr * 0.7], 4, barkCol(hexLin(bark), H));
  let C = [0, 0, 0]; for (const q of blobs) C = add(C, q.c); C = mul(C, 1 / blobs.length);
  let R = 0, yb = 1e9, yt = -1e9; for (const q of blobs) { R = Math.max(R, len(sub(q.c, C)) + Math.max(q.r[0], q.r[1])); yb = Math.min(yb, q.c[1] - q.r[1]); yt = Math.max(yt, q.c[1] + q.r[1]); }
  for (const q of blobs) sphere(o, { det: q.det || 0, c: q.c, r: q.r, disp: () => 0.92 + rng() * 0.16, n: (p) => nrm(add(nrm(sub(p, C)), [0, 0.3, 0])), col: (p) => { const k = crownAO(len(sub(p, C)) / R, cl01((p[1] - yb) / (yt - yb))) * (opt.k || 0.8); return [k, k, k]; }, m: 1 });
  return o.build();
}

// Archa (qoraqarag'ay): tana va qavat-qavat "etak" — har shox ikki bo'lakli karta: asosdan yuqoriroq chiqadi, uchi pastga osiladi (yassi tokcha emas),
// tekisligi tasodifiy qiyalik bilan buralgan; uch qismida shoxlar yuqoriga qaragan tutamlar; snow — shox ustida qor. Ichki konus — yorug'roq yashil igna massasi (tana ko'rinmasin)
function spruce(seed, snow) {
  const o = new FB(seed), c = new FB(seed + 1), rng = o.r, bark = hexLin(0x4a4540), Ht = 11.8;
  pipe(o, [[0, -0.3, 0], [0, 4, 0], [0, Ht - 0.6, 0]], [0.3, 0.19, 0.025], 5, barkCol(bark, 99));
  const Rmax = (y) => 2.6 * Math.pow(Math.max(0, 1 - (y - 1.2) / (Ht - 1.0)), 0.92) + 0.5;
  const nf = (p) => { const r = Math.hypot(p[0], p[2]); return nrm([p[0] / (r || 1), 1.1, p[2] / (r || 1)]); };
  const cf = (p) => { const t = cl01(Math.hypot(p[0], p[2]) / (Rmax(p[1]) + 0.15)); const k = (0.64 + 0.36 * sst(0.0, 0.9, t)) * (0.86 + 0.22 * (p[1] / Ht)); return [k * 0.96, k, k * 1.02]; };
  for (const [y0, y1, rr] of [[1.4, 7.8, 0.5], [5.4, Ht - 0.7, 0.5]]) {
    const r0 = Rmax(y0) * rr, sides = 7;
    for (let s = 0; s < sides; s++) { const a = (s / sides) * 6.2832, b = ((s + 1) / sides) * 6.2832, P0 = [Math.sin(a) * r0, y0, Math.cos(a) * r0], P1 = [Math.sin(b) * r0, y0, Math.cos(b) * r0], T = [0, y1, 0];
      const nn = (p) => nrm([p[0], 0.9, p[2]]), kk = (p) => { const k = 0.46 * (0.85 + 0.25 * (p[1] / Ht)); return [k * 0.95, k, k]; };
      const [a0, b0, a1, b1] = CELLUV(1); c.v(P0, nn(P0), kk(P0), 1, a0, b0); c.v(P1, nn(P1), kk(P1), 1, a0, b1); c.v(T, [0, 1, 0], kk(T), 1, a1, (b0 + b1) / 2); }
  }
  for (let y = 1.5; y < Ht - 0.7; y += (y > Ht - 3.8 ? 0.66 : 1.0) + rng() * 0.12) {
    const f = (y - 1.5) / (Ht - 2), nb = f < 0.5 ? 6 : f < 0.8 ? 5 : 4, a0 = rng() * 6.28, L = Rmax(y) * (0.98 + rng() * 0.1);
    for (let i = 0; i < nb; i++) {
      const az = a0 + (i / nb) * 6.28 + (rng() - 0.5) * 0.35, rise = -0.08 + f * 0.62 + (rng() - 0.5) * 0.14;
      const d = nrm([Math.cos(az), rise, Math.sin(az)]), base = [d[0] * 0.12, y + 0.3, d[2] * 0.12], mid = add(base, mul(d, L * 0.55)), d2 = nrm(add(d, [0, -0.62 + f * 0.45, 0])), tip = add(mid, mul(d2, L * 0.5));
      const side = rot(nrm(cross(d, UP)), d, (rng() - 0.5) * 0.9), w = (6.2832 * L / nb) * 0.92;
      strip(c, base, mid, side, w * 0.22, w * 0.86, 1, nf, cf, 1, 0, 0.55); strip(c, mid, tip, rot(side, d2, (rng() - 0.5) * 0.4), w * 0.86, w, 1, nf, cf, 1, 0.55, 1);
      if (snow) { const up = nrm(cross(side, d)), lift = up[1] < 0 ? -0.09 : 0.09; strip(c, add(add(base, mul(d, L * 0.12)), mul(up, lift)), add(add(mid, mul(d2, L * 0.18)), mul(up, lift)), side, w * 0.15, w * 0.7, 4, () => [0, 1, 0], (p) => { const k = 0.8 + 0.2 * cl01(Math.hypot(p[0], p[2]) / Rmax(p[1])); return [k * 0.95, k * 0.97, k]; }, 0); }
    }
  }
  // uchidagi novda (tik tutam)
  for (let i = 0; i < 3; i++) { const a = i * 1.047, sd = [Math.cos(a), 0, Math.sin(a)]; strip(c, [0, Ht - 2.2, 0], [0, Ht + 0.35, 0], sd, 0.75, 0.1, 1, () => [0, 1, 0], () => [0.95, 1, 0.95], 1); }
  return { hi: o.build(), cards: c.build(true) };
}
// O'rta (0-daraja yaqin) variant: tana + 4 qavat konus va pastki "etak" yuzasi — shaffofliksiz, arzon
function spruceMid(snow) {
  const o = new FB(8), bark = hexLin(0x4e463e);
  pipe(o, [[0, -0.3, 0], [0, 2.2, 0]], [0.3, 0.22], 5, barkCol(bark, 99));
  const tiers = [[2.7, 1.5, 5.6], [2.2, 3.7, 7.7], [1.6, 5.9, 9.8], [1.0, 8.2, 12.0]];
  for (const [r, y0, y1] of tiers) {
    const sides = 8, gc = (p) => { const t = Math.hypot(p[0], p[2]) / r, k = (0.58 + 0.38 * t) * (0.86 + 0.22 * p[1] / 12); return [k * 0.96, k, k * 1.02]; }, nn = (p) => nrm([p[0], 0.75, p[2]]);
    for (let s = 0; s < sides; s++) { const a = (s / sides) * 6.2832 + y0, b = ((s + 1) / sides) * 6.2832 + y0, dr = (s % 2 ? 0.92 : 1.06), P0 = [Math.sin(a) * r * dr, y0 - 0.25 * dr, Math.cos(a) * r * dr], P1 = [Math.sin(b) * r, y0, Math.cos(b) * r], T = [0, y1, 0], Cn = [0, y0 + 0.45, 0];
      o.tri([P0, nn(P0), gc(P0), 1], [P1, nn(P1), gc(P1), 1], [T, [0, 1, 0], gc(T), 1]);
      o.tri([P1, [0, -1, 0], [0.42, 0.44, 0.44], 1], [P0, [0, -1, 0], [0.42, 0.44, 0.44], 1], [Cn, [0, -1, 0], [0.32, 0.34, 0.34], 1]);
      if (snow) { const k = 0.7, S0 = mix3(T, P0, 0.62), S1 = mix3(T, P1, 0.62), nS = (p) => nrm([p[0], 1.4, p[2]]); o.tri([add(S0, [0, 0.06, 0]), nS(S0), [0.88, 0.9, 0.95], 0], [add(S1, [0, 0.06, 0]), nS(S1), [0.88, 0.9, 0.95], 0], [add(T, [0, 0.06, 0]), [0, 1, 0], [0.92, 0.94, 0.98], 0]); void k; }
    }
  }
  return o.build();
}
function spruceLo(snow) {
  const o = new FB(9), bark = hexLin(0x4e463e);
  pipe(o, [[0, -0.3, 0], [0, 2.4, 0]], [0.3, 0.22], 4, barkCol(bark, 99));
  const cone = (r, y0, y1, sides, col, m) => { for (let s = 0; s < sides; s++) { const a = (s / sides) * 6.2832, b = ((s + 1) / sides) * 6.2832, P0 = [Math.sin(a) * r, y0, Math.cos(a) * r], P1 = [Math.sin(b) * r, y0, Math.cos(b) * r], T = [0, y1, 0], nn = (p) => nrm([p[0], 0.7, p[2]]);
    o.tri([P0, nn(P0), col(P0), m], [P1, nn(P1), col(P1), m], [T, [0, 1, 0], col(T), m]); } };
  const gc = (p) => { const k = 0.62 * (0.8 + 0.3 * p[1] / 11.6); return [k, k, k]; };
  cone(2.6, 1.6, 7.6, 6, gc, 1); cone(1.7, 5.4, 11.6, 6, gc, 1);
  if (snow) { const sc = () => [0.86, 0.9, 0.95]; cone(1.75, 4.2, 7.66, 6, sc, 0); cone(1.1, 7.9, 11.66, 6, sc, 0); }
  return o.build();
}
// Qayin: oq po'stloq — gorizontal qora yasmiqchalar (aniq chegarali, har to'rtburchak alohida), tagi kulrang-qora yorilgan; ingichka uzun tana, pastda kalta quruq shoxchalar, osilgan mayda barglar
function birch(seed) {
  const o = new FB(seed), c = new FB(seed + 1), rng = o.r, H = 8.6, cl = [], NR = 22;
  const tp = bend([0, -0.3, 0], [0.04, 1, 0.02], H + 0.3, 0, NR, rng, 0.025);
  const bc = (t, p) => { const y = p[1], k = 0.78 * (0.84 + 0.16 * sst(0, 1.2, y)); return [k, k * 0.975, k * 0.94]; };
  // yasmiqchalar: halqa (i) va yon (s) bo'yicha xesh; tagida (0.6 m gacha) yorilgan qoramtir po'stloq
  const qk = (i, s) => { const y = (i / NR) * (H + 0.3) - 0.3; if (y < 0.55) return h3(i, s, 3, 8) < 0.7 ? 0.32 : 0.5; const r = h3(i, s, 7, 3), run = h3(i, (s + 1) % 5, 7, 3); return r < 0.11 || (r < 0.2 && run < 0.2) ? 0.3 + 0.15 * h3(i, s, 2, 1) : r > 0.88 ? 0.86 : 1; };
  pipe(o, tp, tp.map((_, i) => 0.2 * (1 - 0.72 * i / (tp.length - 1))), 5, bc, 0, 0, qk);
  const at = (y) => tp[Math.min(tp.length - 1, Math.max(0, Math.round((y + 0.3) / (H + 0.3) * (tp.length - 1))))];
  for (let i = 0; i < 4; i++) { const y = 1.7 + i * 0.45 + rng() * 0.2, az = rng() * 6.28, d = nrm([Math.cos(az), 0.25 + rng() * 0.3, Math.sin(az)]); pipe(o, bend(at(y), d, 0.45 + rng() * 0.4, -0.05, 1, rng, 0.2), [0.035, 0.012], 3, () => [0.18, 0.16, 0.14]); }
  for (let i = 0; i < 7; i++) { const y = 3.4 + i * 0.75 + rng() * 0.3, az = rng() * 6.28, base = at(y);
    const d = nrm([Math.cos(az) * 0.8, 0.9, Math.sin(az) * 0.8]), L = 1.6 * (1 - i / 9) + 0.6, sp = bend(base, d, L, -0.15, 1, rng, 0.1);
    pipe(o, sp, [0.065, 0.022], 3, (t) => { const k = 0.2 + 0.25 * (1 - t); return [k, k * 0.95, k * 0.9]; });
    const e = sp[sp.length - 1]; cl.push({ c: add(e, [0, -0.15, 0]), r: 0.95 + rng() * 0.35 - i * 0.04, hv: rng() * 2 - 1 }); cl.push({ c: mix3(base, e, 0.55), r: 0.8 + rng() * 0.25, hv: rng() * 2 - 1 }); }
  cl.push({ c: [tp[tp.length - 1][0], H + 0.3, tp[tp.length - 1][2]], r: 0.8, hv: rng() * 2 - 1 });
  crown(o, c, cl, { cell: 0, cards: 3, rRef: 1, size: 0.95, hang: true, up: 0.5 });
  return { hi: o.build(), cards: c.build(true) };
}
// Terak (ustunsimon): tik yuqoriga qaragan shoxlar bo'ylab zich klasterlar
function poplar(seed) {
  const o = new FB(seed), c = new FB(seed + 1), rng = o.r, H = 10.2, cl = [];
  pipe(o, [[0, -0.3, 0], [0, 4, 0], [0, H, 0]], [0.26, 0.18, 0.05], 6, barkCol(hexLin(0x6a6052), 99));
  for (let y = 1.4; y < H; y += 0.55) { const f = (y - 1.4) / (H - 1.4), w = 0.95 * Math.sin(Math.min(1, f * 1.25 + 0.1) * 2.7) + 0.25, az = rng() * 6.28; cl.push({ c: [Math.cos(az) * w * 0.55, y, Math.sin(az) * w * 0.55], r: 0.55 + w * 0.5, hv: rng() * 2 - 1 }); }
  crown(o, c, cl, { cell: 0, cards: 4, rRef: 1, size: 0.85, up: 0.6, aspect: 1.3, inner: 2 }); // silliq qorong'i yadro o'rniga ichki qorong'i kartalar (bo'shliqlardan "kapsula" ko'rinmasin)
  return { hi: o.build(), cards: c.build(true) };
}
// Akatsiya (savanna): qiyshiq ayri tana, yassi soyabon toj (gorizontal kartalar), pasti qorong'i
function acacia(seed) {
  const o = new FB(seed), c = new FB(seed + 1), rng = o.r, bark = hexLin(0x5a4636), cl = [];
  const tp = bend([0, -0.3, 0], [0.12, 1, 0], 2.6, 0.1, 2, rng, 0.05); pipe(o, tp, [0.3, 0.26, 0.22], 6, barkCol(bark, 99));
  const end = tp[tp.length - 1];
  for (let i = 0; i < 4; i++) { const az = i * 1.6 + rng() * 0.6, d = nrm([Math.cos(az) * 0.9, 1, Math.sin(az) * 0.9]), sp = bend(end, d, 2.6 + rng() * 0.6, 0.25, 2, rng, 0.1); pipe(o, sp, [0.18, 0.12, 0.07], 4, barkCol(bark, 99));
    const e = sp[sp.length - 1]; for (let k = 0; k < 3; k++) { const a = az + (k - 1) * 0.9, rr = 0.6 + rng() * 1.1; cl.push({ c: [e[0] + Math.cos(a) * rr, 5.0 + rng() * 0.35, e[2] + Math.sin(a) * rr], r: 1.15 + rng() * 0.35, hv: rng() * 2 - 1 }); } }
  cl.push({ c: [end[0], 5.35, end[2]], r: 1.4, hv: 0 });
  const C = [end[0], 5.1, end[2]];
  crown(o, c, cl, { cell: 3, cards: 5, rRef: 1.2, size: 1.0, horiz: 0.35, flat: 0.25, center: C, up: 0.8, inner: false });
  return { hi: o.build(), cards: c.build(true) };
}
// Palma: egilgan halqali tana, kamar bo'lib osilgan patsimon barglar
function palm(seed) {
  const o = new FB(seed), c = new FB(seed + 1), rng = o.r, pts = [], rad = [];
  let x = 0, y = -0.3; for (let i = 0; i <= 7; i++) { pts.push([x, y, 0]); rad.push(0.27 - i * 0.012); const lean = 0.05 + i * 0.045; x += Math.sin(lean) * 1.07; y += Math.cos(lean) * 1.07; }
  pipe(o, pts, rad, 7, (t, p) => { const ring = 0.75 + 0.25 * Math.abs(Math.sin(p[1] * 7)); const k = ring * (0.6 + 0.4 * sst(0, 1.5, p[1])); return [0.5 * k, 0.4 * k, 0.29 * k]; });
  const top = pts[pts.length - 1];
  for (let i = 0; i < 14; i++) {
    const az = (i / 14) * 6.28 + rng() * 0.3, d0 = nrm([Math.cos(az), 0.55 - (i % 3) * 0.25, Math.sin(az)]), side = nrm(cross(d0, UP)), L = 3.3 + rng() * 0.6;
    let p = top, d = d0; const segs = 3;
    for (let s = 0; s < segs; s++) {
      const q = add(p, mul(d, L / segs)), w0 = 0.7 * Math.sin((s / segs) * 2.6 + 0.35) + 0.08, w1 = 0.7 * Math.sin(((s + 1) / segs) * 2.6 + 0.35) + 0.04, sd = rot(side, d, -0.35);
      const nf = (pp) => nrm(add(nrm(sub(pp, top)), [0, 0.8, 0])), cf = (pp) => { const k = 0.55 + 0.45 * cl01(len(sub(pp, top)) / L); return [k, k, k]; };
      strip(c, p, q, sd, w0, w1, 5, nf, cf, 1, s / segs, (s + 1) / segs);
      p = q; d = nrm(add(d, [0, -0.42, 0]));
    }
  }
  for (let i = 0; i < 4; i++) { const a = i * 1.6; sphere(o, { det: 0, c: add(top, [Math.cos(a) * 0.22, -0.3, Math.sin(a) * 0.22]), r: [0.16, 0.19, 0.16], n: (p, u) => u, col: () => [0.2, 0.13, 0.07], m: 0 }); }
  return { hi: o.build(), cards: c.build(true) };
}
// Kaktus (saguaro): qovurg'ali silindrlar, ariqchalarda soya
function cactus(seed) {
  const o = new FB(seed), rng = o.r;
  const ribbed = (pts, r0, r1, sides) => {
    const n = pts.length; let u = null; const rings = [];
    for (let i = 0; i < n; i++) { const tg = nrm(sub(pts[Math.min(n - 1, i + 1)], pts[Math.max(0, i - 1)])); u = u ? nrm(sub(u, mul(tg, dot(u, tg)))) : perp(tg); const w = cross(tg, u), t = i / (n - 1), rr = (r0 + (r1 - r0) * t) * (i === n - 1 ? 0.55 : i === n - 2 ? 0.92 : 1), ring = [];
      for (let s = 0; s <= sides; s++) { const a = (s / sides) * 6.2832, rib = Math.cos(a * 8), d = add(mul(u, Math.cos(a)), mul(w, Math.sin(a))), dt = add(mul(u, -Math.sin(a)), mul(w, Math.cos(a)));
        const p = add(pts[i], mul(d, rr * (1 + 0.075 * rib))), nn = nrm(add(d, mul(dt, 0.45 * Math.sin(a * 8)))), k = (0.62 + 0.38 * (rib * 0.5 + 0.5)) * (0.65 + 0.35 * sst(0, 1, p[1])); ring.push([p, i === n - 1 ? nrm(add(nn, tg)) : nn, [k, k, k]]); }
      rings.push(ring); }
    for (let i = 0; i < n - 1; i++) for (let s = 0; s < sides; s++) { const A = rings[i][s], B = rings[i][s + 1], C = rings[i + 1][s + 1], D = rings[i + 1][s]; o.tri([A[0], A[1], A[2], 1], [B[0], B[1], B[2], 1], [C[0], C[1], C[2], 1]); o.tri([A[0], A[1], A[2], 1], [C[0], C[1], C[2], 1], [D[0], D[1], D[2], 1]); }
  };
  ribbed([[0, -0.2, 0], [0, 1.2, 0], [0, 2.4, 0], [0, 3.3, 0], [0, 3.7, 0], [0, 3.82, 0]], 0.42, 0.38, 16);
  ribbed([[0.3, 1.5, 0], [0.8, 1.6, 0], [1.15, 1.95, 0], [1.2, 2.6, 0], [1.2, 3.0, 0], [1.2, 3.1, 0]], 0.25, 0.23, 12);
  ribbed([[-0.3, 2.1, 0], [-0.75, 2.2, 0], [-1.0, 2.5, 0], [-1.02, 2.95, 0], [-1.02, 3.15, 0]], 0.21, 0.19, 12);
  return { hi: o.build(), cards: null };
}
// Quruq/kuygan daraxt va saksovul: buralgan tana, rekursiv qiyshiq shoxlar
function deadTree(seed) {
  const o = new FB(seed), rng = o.r;
  const grow = (p, d, L, r, lvl) => {
    const pts = bend(p, d, L, 0.1, lvl > 1 ? 3 : 1, rng, 0.35);
    pipe(o, pts, pts.map((_, i) => r * (1 - 0.55 * i / (pts.length - 1))), lvl > 2 ? 6 : lvl > 1 ? 4 : 3, (t, q) => { const k = (0.55 + 0.4 * sst(-0.3, 1.2, q[1])) * (0.85 + 0.15 * Math.sin(q[1] * 9 + t * 4)); return [k, k, k]; }, 1);
    if (lvl <= 0) return;
    const e = pts[pts.length - 1], n = lvl > 2 ? 3 : 2;
    for (let i = 0; i < n; i++) { const az = rng() * 6.28, nd = nrm(add(d, [Math.cos(az) * 0.9, 0.2, Math.sin(az) * 0.9])); grow(i === 0 ? e : pts[Math.max(1, pts.length - 2)], nd, L * (0.55 + rng() * 0.15), r * 0.45, lvl - 1); }
  };
  grow([0, -0.3, 0], [0.06, 1, 0.03], 2.4, 0.28, 3);
  return { hi: o.build(), cards: null };
}
// Buta: bir nechta qorong'i yadro + barg kartalari
function bushGen(seed, cell, dry) {
  const o = new FB(seed), c = new FB(seed + 1), rng = o.r, cl = [];
  for (let i = 0; i < 5; i++) { const a = i * 1.3 + rng(), r = i ? 0.55 + rng() * 0.25 : 0.8; cl.push({ c: i ? [Math.cos(a) * 0.65, 0.42 + rng() * 0.2, Math.sin(a) * 0.65] : [0, 0.6, 0], r, hv: rng() * 2 - 1 }); }
  if (dry) for (let i = 0; i < 7; i++) { const az = rng() * 6.28, d = nrm([Math.cos(az) * 0.8, 1, Math.sin(az) * 0.8]), sp = bend([0, -0.05, 0], d, 1.0 + rng() * 0.5, -0.2, 2, rng, 0.3); pipe(o, sp, [0.05, 0.035, 0.015], 3, () => [0.32, 0.27, 0.22], 0); }
  crown(o, c, cl, { cell, cards: dry ? 5 : 6, rRef: 0.7, size: dry ? 1.25 : 1.05, up: 0.6, inner: dry ? false : 1 });
  return { hi: o.build(), cards: c.build(true) };
}
// Tosh: shovqin bilan buzilgan sfera + tekis kesilgan yuzlar (yorilgan, yemirilgan shakl), silliq normallar; tagi qorong'i, chuqurlar soyada, tepasi changli
function rockGen(seed, det, sx, sy, sz, cy, cuts, amp) {
  const o = new FB(seed), rng = o.r, planes = [];
  for (let i = 0; i < cuts; i++) planes.push([nrm([rng() * 2 - 1, rng() * 1.8 - 0.5, rng() * 2 - 1]), 0.5 + rng() * 0.28]);
  const s = (seed * 7) | 0;
  sphere(o, { det, c: [0, cy, 0], r: [sx, sy, sz], smooth: true,
    disp: (u) => 1 + amp * fbm3(u, 2.1, s, 3) + amp * 0.3 * vn3(u[0] * 7, u[1] * 7, u[2] * 7, s + 5),
    post: (p) => { let k = 0; for (const [n, d] of planes) { const e = dot([p[0] / sx, p[1] / sy, p[2] / sz], n) - d; if (e > 0) { p = sub(p, [n[0] * e * sx, n[1] * e * sy, n[2] * e * sz]); k = Math.max(k, Math.min(1, e * 6)); } } if (p[1] < -cy - 0.05) p[1] = -cy - 0.05 + (p[1] + cy + 0.05) * 0.15; return p; },
    col: (p, u, d, n) => { const y = p[1], q = sub(p, [0, cy, 0]); let k = (0.5 + 0.5 * sst(-0.05, 0.5, y)) * (0.84 + 0.55 * (d - 1)); k *= 0.86 + 0.18 * Math.max(0, n[1]); k *= 0.93 + 0.07 * Math.sin(y * 11 + 3 * vn3(q[0] * 2, q[1] * 2, q[2] * 2, s + 2)); k *= 1 + 0.08 * vn3(q[0] * 5, q[1] * 5, q[2] * 5, s + 7);
      const lich = vn3(q[0] * 3, q[1] * 3, q[2] * 3, s + 9) > 0.3 && n[1] > -0.2 ? 1 : 0; return lich ? [k * 1.03, k * 1.06, k * 0.86] : [k, k * 0.99, k * 0.98]; }, m: 1 });
  return o.build();
}

// Olcha tojining ichki/pastki qismi: pushti tus qorong'ilashganda binafsha bo'lib qolmasin — soyada yashil-jigarrang (barg va shox) tomon siljiydi
const cherryInk = (k, p, hv) => { const d = cl01(1 - k); return [k * (1 + 0.05 * hv), k * (1 + 0.42 * d), k * (1 - 0.3 * d)]; };
// Barcha prototiplar: { hi (shaffofsiz, MAT.tree), cards (barg kartalari yoki null), lo (uzoq), md (0-darajada yaqin: kartasiz, shaffofliksiz o'rta variant; 'lo' — uzoq variantning o'zi), colR, colH }
export function floraProtos() {
  const P = {};
  const put = (name, hc, lo, colR, colH, md) => { P[name] = { hi: hc.hi, cards: hc.cards, lo, md: md || null, colR, colH }; };
  const blobs = (seed, bark, tr, H, list, k = 0.8) => lowCrown(seed, bark, tr, H, list.map(([x, y, z, rx, ry, rz]) => ({ c: [x, y, z], r: [rx, ry, rz], det: 1 })), { k });
  put('round', broadleaf(11, { bark: 0x5a5048, H: 2.4, tr: 0.25, limbs: 4, env: [2.7, 2.2, 2.7], n: 13, twigs: 6, cr: 1.1, cell: 0, cards: 4, size: 1.12 }),
    lowCrown(12, 0x5a5048, 0.25, 2.8, [{ c: [0, 4.25, 0], r: [2.9, 2.3, 2.9] }]), 0.38, 6.5,
    blobs(13, 0x5a5048, 0.25, 2.9, [[0, 4.5, 0, 2.1, 1.75, 2.1], [1.35, 3.8, 0.4, 1.5, 1.3, 1.5], [-1.2, 3.95, -0.6, 1.45, 1.25, 1.45]]));
  put('oval', birch(21), lowCrown(22, 0xc8c2b6, 0.2, 4.4, [{ c: [0, 6.2, 0], r: [1.5, 2.8, 1.5] }]), 0.28, 8,
    blobs(23, 0xc8c2b6, 0.2, 4.6, [[0, 6.25, 0, 1.5, 2.65, 1.5]]));
  put('blossom', broadleaf(31, { bark: 0x4e3e34, H: 1.7, tr: 0.26, limbs: 5, env: [3.2, 1.5, 3.2], n: 14, twigs: 6, cr: 1.0, cell: 2, cards: 6, size: 0.9, ink: cherryInk }),
    lowCrown(32, 0x4e3e34, 0.26, 2.0, [{ c: [0, 3.0, 0], r: [3.4, 1.6, 3.4] }]), 0.36, 5,
    blobs(33, 0x4e3e34, 0.26, 2.1, [[0, 3.2, 0, 2.2, 1.15, 2.2], [1.8, 2.85, 0.4, 1.5, 0.9, 1.5], [-1.7, 2.85, -0.5, 1.5, 0.9, 1.5]]));
  put('pine', spruce(41, false), spruceLo(false), 0.34, 11, spruceMid(false));
  put('pineSnow', spruce(41, true), spruceLo(true), 0.34, 11, spruceMid(true));
  put('cypress', poplar(51), lowCrown(52, null, 0, 0, [{ c: [0, 5.4, 0], r: [1.1, 4.4, 1.1] }], { k: 0.6 }), 0.5, 9,
    blobs(53, 0x6a6052, 0.22, 1.6, [[0, 5.5, 0, 1.05, 4.3, 1.05]], 0.66));
  put('acacia', acacia(61), lowCrown(62, 0x5a4636, 0.28, 4.6, [{ c: [0.3, 5.15, 0], r: [3.4, 0.62, 3.4] }]), 0.34, 5.5,
    blobs(63, 0x5a4636, 0.28, 4.6, [[0.3, 5.2, 0, 2.7, 0.55, 2.7], [-1.9, 4.95, 0.7, 1.6, 0.45, 1.6], [2.0, 5.0, -0.8, 1.6, 0.45, 1.6]]));
  put('palm', palm(71), (() => { const o = new FB(72); pipe(o, [[0, -0.3, 0], [0.6, 3.5, 0], [1.45, 7.0, 0]], [0.25, 0.21, 0.17], 4, () => [0.32, 0.24, 0.16]); sphere(o, { det: 0, c: [1.45, 7.0, 0], r: [2.9, 0.8, 2.9], n: (p, u) => nrm(add(u, [0, 0.4, 0])), col: (p) => { const k = p[1] > 7 ? 0.7 : 0.35; return [k, k, k]; }, m: 1 }); return o.build(); })(), 0.3, 7, 'lo');
  put('cactus', cactus(81), (() => { const o = new FB(82); pipe(o, [[0, -0.2, 0], [0, 3.8, 0]], [0.42, 0.38], 5, (t, p) => { const k = 0.7 + 0.3 * t; return [k, k, k]; }, 1); pipe(o, [[1.2, 1.78, 0], [1.2, 3.1, 0]], [0.25, 0.22], 4, () => [0.8, 0.8, 0.8], 1); return o.build(); })(), 0.5, 3.6);
  put('dead', deadTree(91), (() => { const o = new FB(92); pipe(o, [[0, -0.3, 0], [0.1, 2.2, 0], [0.2, 4.2, 0]], [0.26, 0.18, 0.08], 4, () => [0.75, 0.75, 0.75], 1); pipe(o, [[0.1, 2.3, 0], [1.4, 3.6, 0.2]], [0.1, 0.04], 3, () => [0.75, 0.75, 0.75], 1); return o.build(); })(), 0.3, 4);
  put('bush', bushGen(101, 0, false), lowCrown(102, null, 0, 0, [{ c: [0, 0.45, 0], r: [1.15, 0.8, 1.15] }], { k: 0.72 }), 0, 1,
    blobs(103, null, 0, 0, [[0, 0.45, 0, 1.0, 0.72, 1.0], [0.8, 0.3, 0.3, 0.7, 0.52, 0.7]], 0.74));
  put('shrub', bushGen(111, 6, true), lowCrown(112, null, 0, 0, [{ c: [0, 0.4, 0], r: [1.0, 0.62, 1.0] }], { k: 0.62 }), 0, 1, 'lo');
  // toshlar: 0-darajada yaqinda ham det-1 variant (eski bilan bir xil narx)
  P.rock = { hi: rockGen(121, 2, 1.0, 0.68, 0.95, 0.3, 7, 0.3), cards: null, lo: rockGen(121, 1, 1.0, 0.68, 0.95, 0.3, 7, 0.3), md: 'lo', colR: 0.85, colH: 1 };
  { const a = new FB(1); const g1 = rockGen(131, 2, 0.8, 1.15, 0.85, 0.5, 8, 0.3), g2 = rockGen(132, 1, 0.62, 0.42, 0.55, 0.1, 5, 0.26); P.rock2 = { hi: mergeGeo([g1, g2], [[0, 0, 0], [0.8, 0, 0.4]]), cards: null, lo: rockGen(131, 1, 0.8, 1.15, 0.85, 0.5, 8, 0.3), md: 'lo', colR: 0.8, colH: 1.6 }; void a; }
  P.stone = { hi: rockGen(141, 1, 1.0, 0.44, 0.9, 0.0, 5, 0.24), cards: null, lo: rockGen(141, 0, 1.0, 0.44, 0.9, 0.0, 5, 0.24), colR: 0, colH: 0.4 };
  return P;
}
// Bir nechta geometriyani siljitib qo'shish (bir xil atributlar)
function mergeGeo(gs, offs) {
  const names = ['position', 'normal', 'color', 'aMask'], out = {};
  for (const n of names) { const it = gs[0].attributes[n].itemSize; let tot = 0; for (const g of gs) tot += g.attributes[n].array.length; const a = new Float32Array(tot); let o = 0; gs.forEach((g, gi) => { const src = g.attributes[n].array; if (n === 'position') { for (let i = 0; i < src.length; i += 3) { a[o + i] = src[i] + offs[gi][0]; a[o + i + 1] = src[i + 1] + offs[gi][1]; a[o + i + 2] = src[i + 2] + offs[gi][2]; } } else a.set(src, o); o += src.length; }); out[n] = new THREE.BufferAttribute(a, it); }
  const g = new THREE.BufferGeometry(); for (const n of names) g.setAttribute(n, out[n]); g.computeBoundingSphere(); g.computeBoundingBox(); return g;
}

// ================= O't yamog'i va gullar =================
// Bitta katak (1.6 m) uchun o't yamog'i: tutamlarga yig'ilgan poyalar; dense — yaqin halqa (3 uchburchakli egri poya + urug' boshoqlari), aks holda uzoq halqa (1 uchburchak); ground — pastki qavat poyalari soni
export function grassPatch(seed, blades, dense, ground = dense ? 44 : 22) {
  const b = new FB(seed), rng = b.r, clumps = [];
  const nc = dense ? 6 : 8; for (let i = 0; i < nc; i++) clumps.push([(rng() - 0.5) * 1.5, (rng() - 0.5) * 1.5, dense ? 0.12 + rng() * 0.22 : 0.22 + rng() * 0.25]);
  for (let i = 0; i < blades; i++) {
    const q = clumps[i % nc], ga = rng() * 6.28, gr = Math.sqrt(rng()) * q[2] * 1.6, x = q[0] + Math.cos(ga) * gr, z = q[1] + Math.sin(ga) * gr;
    const face = rng() * 6.28, lean = 0.1 + rng() * 0.35, la = ga + (rng() - 0.5) * 1.2, h = (0.24 + rng() * 0.3) * (dense ? 1 : 1.05), w = (dense ? 0.009 : 0.026) + rng() * (dense ? 0.006 : 0.01);
    const ux = Math.cos(face), uz = Math.sin(face), lx = Math.cos(la), lz = Math.sin(la);
    const P = (s, t) => [x + ux * s + lx * lean * h * t * t, h * t * (1 - 0.18 * lean * t), z + uz * s + lz * lean * h * t * t];
    const n0 = nrm([lx * 0.3 - uz * 0.35, 1, lz * 0.3 + ux * 0.35]), n1 = nrm([lx * 0.5 + uz * 0.35, 0.9, lz * 0.5 - ux * 0.35]);
    const r = rng(), hue = r < 0.16 ? [1.16, 1.02, 0.6] : r < 0.3 ? [0.86, 0.95, 0.92] : r < 0.36 ? [1.12, 0.92, 0.62] : [1, 1, 1];
    const col = (k, tipK) => [hue[0] * k * (1 + (tipK || 0) * 0.08), hue[1] * k, hue[2] * k * (1 - (tipK || 0) * 0.12)];
    if (dense) {
      const A = P(-w, 0), Bv = P(w, 0), C = P(-w * 0.62, 0.55), D = P(w * 0.62, 0.55), E = P(0, 1);
      const cA = col(0.38), cC = col(0.86), cE = col(1.12, 1);
      b.v(A, n0, cA, 1); b.v(Bv, n1, cA, 1); b.v(D, n1, cC, 1); b.v(A, n0, cA, 1); b.v(D, n1, cC, 1); b.v(C, n0, cC, 1); b.v(C, n0, cC, 1); b.v(D, n1, cC, 1); b.v(E, n0, cE, 1);
    } else {
      const A = P(-w, 0), Bv = P(w, 0), E = P(0, 1);
      b.v(A, n0, col(0.42), 1); b.v(Bv, n1, col(0.42), 1); b.v(E, n0, col(1.08, 1), 1);
    }
  }
  // pastki qavat: kalta, zich, qorong'iroq poyalar (yer yuzini "gilam" kabi yopadi)
  for (let i = 0; i < ground; i++) {
    const x = (rng() - 0.5) * 1.6, z = (rng() - 0.5) * 1.6, h = 0.07 + rng() * 0.11, w = (dense ? 0.016 : 0.03) + rng() * 0.012, f = rng() * 6.28, ux = Math.cos(f) * w, uz = Math.sin(f) * w, lx = (rng() - 0.5) * 0.1, lz = (rng() - 0.5) * 0.1, r = rng();
    const hue = r < 0.25 ? [1.1, 1.0, 0.7] : [1, 1, 1], n0 = nrm([lx, 1, lz]);
    b.v([x - ux, 0, z - uz], n0, mul(hue, 0.42), 1); b.v([x + ux, 0, z + uz], n0, mul(hue, 0.42), 1); b.v([x + lx, h, z + lz], n0, mul(hue, 0.8), 1);
  }
  if (dense) for (let i = 0; i < 5; i++) { // urug' boshoqlari (baland poyalar uchida)
    const x = (rng() - 0.5) * 1.3, z = (rng() - 0.5) * 1.3, h = 0.55 + rng() * 0.25, lx = (rng() - 0.5) * 0.25, lz = (rng() - 0.5) * 0.25, face = rng() * 6.28, ux = Math.cos(face) * 0.012, uz = Math.sin(face) * 0.012;
    const top = [x + lx, h, z + lz], mid = [x + lx * 0.4, h * 0.6, z + lz * 0.4], nU = [0, 1, 0], cS = [0.55, 0.6, 0.4];
    b.v([x - ux, 0, z - uz], nU, [0.3, 0.32, 0.2], 1); b.v([x + ux, 0, z + uz], nU, [0.3, 0.32, 0.2], 1); b.v(mid, nU, cS, 1);
    b.v([x - ux, 0, z - uz], nU, [0.3, 0.32, 0.2], 1); b.v(mid, nU, cS, 1); b.v(top, nU, cS, 1);
    const sw = [Math.cos(face) * 0.018, 0, Math.sin(face) * 0.018], s0 = [x + lx * 0.85, h * 0.82, z + lz * 0.85], sC = [0.5, 0.42, 0.28];
    b.v(sub(s0, sw), nU, sC, 0.55); b.v(add(s0, sw), nU, sC, 0.55); b.v(add(top, [lx * 0.25, 0.07, lz * 0.25]), nU, mul(sC, 1.1), 0.55);
  }
  return b.build();
}
// Yovvoyi gul: ingichka poya + 2 barg + gulbarglar (yelpig'ich) + o'rtasi; gulbarg rangi nusxa rangidan
export function flowerGeo(seed) {
  const b = new FB(seed), H = 0.36, g = [0.16, 0.3, 0.1], gT = [0.22, 0.4, 0.14];
  const st = (a, c) => [Math.cos(a) * 0.008, 0, Math.sin(a) * 0.008];
  for (const a of [0, 2.1, 4.2]) { const d = st(a), e = st(a + 2.1); b.tri([d, nrm([d[0], 0, d[2]]), g, 0], [e, nrm([e[0], 0, e[2]]), g, 0], [add(e, [0, H, 0]), nrm([e[0], 0, e[2]]), gT, 0]); b.tri([d, nrm([d[0], 0, d[2]]), g, 0], [add(e, [0, H, 0]), nrm([e[0], 0, e[2]]), gT, 0], [add(d, [0, H, 0]), nrm([d[0], 0, d[2]]), gT, 0]); }
  for (const a of [0.4, 3.3]) { const d = [Math.cos(a), 0, Math.sin(a)], s = [-d[2], 0, d[0]]; const p0 = [0, 0.06, 0], p1 = add(mul(d, 0.12), [0, 0.13, 0]); b.v(p0, UP, g, 0); b.v(add(mix3(p0, p1, 0.5), mul(s, 0.025)), UP, gT, 0); b.v(p1, UP, gT, 0); b.v(p0, UP, g, 0); b.v(p1, UP, gT, 0); b.v(add(mix3(p0, p1, 0.5), mul(s, -0.025)), UP, gT, 0); }
  const n = 7, R0 = 0.08, c0 = [0, H + 0.01, 0];
  for (let i = 0; i < n; i++) { const a = (i / n) * 6.2832, a1 = ((i + 0.5) / n) * 6.2832, a2 = ((i + 1) / n) * 6.2832, pm = [Math.cos(a1) * R0, H + 0.025, Math.sin(a1) * R0], pa = [Math.cos(a) * R0 * 0.35, H + 0.012, Math.sin(a) * R0 * 0.35], pb = [Math.cos(a2) * R0 * 0.35, H + 0.012, Math.sin(a2) * R0 * 0.35];
    b.v(c0, UP, [0.85, 0.85, 0.85], 1); b.v(pa, UP, [0.95, 0.95, 0.95], 1); b.v(pm, UP, [1, 1, 1], 1); b.v(c0, UP, [0.85, 0.85, 0.85], 1); b.v(pm, UP, [1, 1, 1], 1); b.v(pb, UP, [0.95, 0.95, 0.95], 1); }
  for (let i = 0; i < 4; i++) { const a = (i / 4) * 6.2832, a2 = ((i + 1) / 4) * 6.2832; b.v([0, H + 0.04, 0], UP, [0.72, 0.5, 0.06], 0); b.v([Math.cos(a) * 0.016, H + 0.028, Math.sin(a) * 0.016], UP, [0.62, 0.42, 0.05], 0); b.v([Math.cos(a2) * 0.016, H + 0.028, Math.sin(a2) * 0.016], UP, [0.62, 0.42, 0.05], 0); }
  return b.build();
}
