// Transport to'plami: silliq kesimli korpus generatori, haqiqiy g'ildirak (shina, disk, tormoz), quvur/aylanma shakllar, chiroq bloklari va PBR materiallar
import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { GB } from './geo.js';

const V3 = (x, y, z) => [x, y, z];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const crs = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const nrm = (a) => { const l = Math.hypot(a[0], a[1], a[2]); return l > 1e-12 ? [a[0] / l, a[1] / l, a[2] / l] : [0, 0, 0]; };
export const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const sst = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
export const clampN = (v, a, b) => (v < a ? a : v > b ? b : v);

// ---------- quruvchi: GB + har uch uchun g'adir-budurlik va metallik (aRM atributi) ----------
export class VB extends GB {
  constructor(seed = 1, jit = 0) { super(seed); this.jit = jit; this.q = []; this.rmv = [0.6, 0]; }
  rm(r, m = 0) { this.rmv = [r, m]; return this; }
  mat(hex, r, m = 0) { this.color(hex); this.rmv = [r, m]; return this; }
  _col(k) { super._col(k); this.q.push(this.rmv[0], this.rmv[1]); }
  // weld: bir xil uchlarni birlashtirib indeksli geometriya (silliq normal shikastlanishdan keyin ham saqlanadi)
  build(weld) {
    const g = super.build();
    g.setAttribute('aRM', new THREE.BufferAttribute(new Float32Array(this.q), 2));
    if (!weld || !this.count) return g;
    const w = mergeVertices(g, 1e-4); w.computeBoundingSphere(); w.computeBoundingBox(); return w;
  }
  // to'rtburchak (silliq): uchlar a,b,c,d (aylana bo'ylab), normallar va rang ko'paytuvchilari; yo'nalish normalga qarab o'zi tanlanadi
  qS(a, b, c, d, na, nb, nc, nd, ka = 1, kb = 1, kc = 1, kd = 1) {
    const g = crs(sub(b, a), sub(c, a)), g2 = crs(sub(c, a), sub(d, a)), av = [na[0] + nb[0] + nc[0] + nd[0], na[1] + nb[1] + nc[1] + nd[1], na[2] + nb[2] + nc[2] + nd[2]];
    const s = dot(g, av) + dot(g2, av);
    if (s >= 0) { this.triS(a, b, c, na, nb, nc, ka, kb, kc); this.triS(a, c, d, na, nc, nd, ka, kc, kd); }
    else { this.triS(a, c, b, na, nc, nb, ka, kc, kb); this.triS(a, d, c, na, nd, nc, ka, kd, kc); }
    return this;
  }
  // tekis to'rtburchak (yuz normali), yo'nalish ko'rsatilgan tashqi vektor bo'yicha
  qF(a, b, c, d, out) {
    const g = crs(sub(b, a), sub(c, a)); this.newFace();
    if (dot(g, out) >= 0) { this.tri(a, b, c, true); this.tri(a, c, d, true); } else { this.tri(a, c, b, true); this.tri(a, d, c, true); }
    return this;
  }
  // nuqtalar to'ri: G[i][j] = [x,y,z], N — normallar (bo'lmasa hisoblanadi), K(i,j) — rang ko'paytuvchisi, keep(i,j) — katakni chizish
  grid(G, N, K, keep) {
    const ni = G.length, nj = G[0].length; N = N || gridNormals(G, 0, nj - 1);
    const k = (i, j) => (K ? (typeof K === 'function' ? K(i, j) : K) : 1);
    for (let i = 0; i < ni - 1; i++) for (let j = 0; j < nj - 1; j++) {
      const j2 = j + 1; if (keep && !keep(i, j)) continue;
      this.qS(G[i][j], G[i + 1][j], G[i + 1][j2], G[i][j2], N[i][j], N[i + 1][j], N[i + 1][j2], N[i][j2], k(i, j), k(i + 1, j), k(i + 1, j2), k(i, j2));
    }
    return this;
  }
  // X o'qi atrofida aylanma sirt: prof [[r, x, sharp?]], n bo'lak; o.a0/o.a1 — burchak oralig'i (qisman); o.inv — ichkariga qaragan
  lathe(prof, n, o = {}) {
    const a0 = o.a0 || 0, a1 = o.a1 == null ? Math.PI * 2 : o.a1, full = Math.abs(a1 - a0 - Math.PI * 2) < 1e-6, segs = [];
    let cur = [prof[0]];
    for (let i = 1; i < prof.length; i++) { cur.push(prof[i]); if (prof[i][2] && i < prof.length - 1) { segs.push(cur); cur = [prof[i]]; } }
    segs.push(cur);
    const inv = o.inv ? -1 : 1;
    for (const sg of segs) {
      const m = sg.length, PN = [];
      for (let i = 0; i < m; i++) { const p = sg[Math.max(0, i - 1)], q = sg[Math.min(m - 1, i + 1)]; let dx = q[1] - p[1], dr = q[0] - p[0]; const l = Math.hypot(dx, dr) || 1; PN.push([(-dr / l) * inv, (dx / l) * inv]); }
      const G = [], N = [];
      for (let i = 0; i < m; i++) {
        const row = [], nr = [];
        for (let j = 0; j <= n; j++) { const t = a0 + ((a1 - a0) * j) / n, c = Math.cos(t), s = Math.sin(t); row.push([sg[i][1], sg[i][0] * c, sg[i][0] * s]); nr.push([PN[i][0], PN[i][1] * c, PN[i][1] * s]); }
        if (full) { row[n] = row[0]; nr[n] = nr[0]; }
        G.push(row); N.push(nr);
      }
      this.grid(G, N, o.k);
    }
    return this;
  }
  // nuqtalar bo'ylab quvur (silliq): pts [[x,y,z]], r — son yoki massiv, n — kesim bo'laklari, o.cap — uchlarini yopish, o.sy — kesimni bir o'qda siqish
  tube(pts, r, n = 8, o = {}) {
    const m = pts.length, T = [];
    for (let i = 0; i < m; i++) { const a = pts[Math.max(0, i - 1)], b = pts[Math.min(m - 1, i + 1)]; T.push(nrm(sub(b, a))); }
    let up = Math.abs(T[0][1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    const G = [], N = [];
    let U = nrm(crs(crs(T[0], up), T[0]));
    for (let i = 0; i < m; i++) {
      if (i > 0) { const W = crs(T[i], U); U = nrm(crs(W, T[i])); } // parallel ko'chirish
      const Wv = crs(T[i], U), ri = Array.isArray(r) ? r[i] : r, row = [], nr = [];
      for (let j = 0; j <= n; j++) {
        const t = (j / n) * Math.PI * 2 + (o.rot || 0), c = Math.cos(t), s = Math.sin(t), sy = o.sy || 1;
        const d = [U[0] * c * sy + Wv[0] * s, U[1] * c * sy + Wv[1] * s, U[2] * c * sy + Wv[2] * s], dn = nrm([U[0] * c / sy + Wv[0] * s, U[1] * c / sy + Wv[1] * s, U[2] * c / sy + Wv[2] * s]);
        row.push([pts[i][0] + d[0] * ri, pts[i][1] + d[1] * ri, pts[i][2] + d[2] * ri]); nr.push(dn);
      }
      row[n] = row[0]; nr[n] = nr[0]; G.push(row); N.push(nr);
    }
    this.grid(G, N, o.k);
    if (o.cap) for (const [i, sd] of [[0, -1], [m - 1, 1]]) { const c = pts[i], nn = T[i].map((v) => v * sd); for (let j = 0; j < n; j++) { const a = G[i][j], b = G[i][j + 1]; const g = crs(sub(a, c), sub(b, c)); if (dot(g, nn) >= 0) this.triS(c, a, b, nn, nn, nn); else this.triS(c, b, a, nn, nn, nn); } }
    return this;
  }
  // ikki nuqta orasidagi silindr/konus
  rod(a, b, r0, r1 = r0, n = 8, cap = true) { return this.tube([a, b], [r0, r1], n, { cap }); }
  // yumaloq burchakli quti: markaz, o'lcham, burchak radiusi rr, seg — yumaloqlik bo'laklari
  rbox(x, y, z, sx, sy, sz, rr = 0.03, seg = 2, o = {}) {
    const h = [sx / 2, sy / 2, sz / 2], r = Math.min(rr, h[0] * 0.98, h[1] * 0.98, h[2] * 0.98), core = h.map((v) => v - r);
    const ax = (k) => { const v = []; for (let s = 0; s <= seg; s++) v.push(-core[k] - r * Math.cos((s / seg) * Math.PI / 2)); for (let s = seg; s >= 0; s--) v.push(core[k] + r * Math.cos((s / seg) * Math.PI / 2)); return [...new Set(v.map((q) => +q.toFixed(6)))]; };
    const A = [ax(0), ax(1), ax(2)], tx = o.tx || 1, tz = o.tz || 1; // tx/tz: tepa torayishi
    const map = (p) => { const c = p.map((v, k) => clampN(v, -core[k], core[k])); const d = nrm(sub(p, c)); const q = [c[0] + d[0] * r, c[1] + d[1] * r, c[2] + d[2] * r]; const f = (q[1] + h[1]) / (2 * h[1]); const kx = 1 + (tx - 1) * f, kz = 1 + (tz - 1) * f; return [[x + q[0] * kx, y + q[1], z + q[2] * kz], d]; };
    for (let k = 0; k < 3; k++) for (const sd of [-1, 1]) {
      const u = (k + 1) % 3, w = (k + 2) % 3, G = [], N = [];
      for (const a of A[u]) { const row = [], nr = []; for (const b of A[w]) { const p = [0, 0, 0]; p[k] = sd * h[k]; p[u] = a; p[w] = b; const [q, d] = map(p); row.push(q); nr.push(d); } G.push(row); N.push(nr); }
      if (o.noBottom && k === 1 && sd < 0) continue;
      this.grid(G, N, o.k);
    }
    return this;
  }
  // ixtiyoriy kesimni yo'l bo'ylab surish: prof — [[u,v]] (u — yon, v — yuqori) yopiq yoki ochiq; up — kesim "yuqori" yo'nalishi
  sweep(pts, prof, up = [0, 1, 0], o = {}) {
    const m = pts.length, G = [], N = [], pn = prof.length;
    for (let i = 0; i < m; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(m - 1, i + 1)], T = nrm(sub(b, a)), S = nrm(crs(up, T)), U = crs(T, S), row = [];
      for (const p of prof) row.push([pts[i][0] + S[0] * p[0] + U[0] * p[1], pts[i][1] + S[1] * p[0] + U[1] * p[1], pts[i][2] + S[2] * p[0] + U[2] * p[1]]);
      if (o.closed) row.push(row[0]);
      G.push(row);
    }
    if (o.flat) { for (let i = 0; i < m - 1; i++) for (let j = 0; j < G[0].length - 1; j++) { const a = G[i][j], b = G[i + 1][j], c = G[i + 1][j + 1], d = G[i][j + 1], mid = lerp3(lerp3(a, c, 0.5), lerp3(b, d, 0.5), 0.5); const ctr = pts[i]; this.qF(a, b, c, d, sub(mid, ctr)); } return this; }
    return this.grid(G, null, o.k);
  }
}

// To'r normallari: ustunlar [c0..c1] oralig'ida, maydon bilan tortilgan
export function gridNormals(G, c0, c1) {
  const ni = G.length, nj = G[0].length, N = [];
  for (let i = 0; i < ni; i++) { const r = []; for (let j = 0; j < nj; j++) r.push([0, 0, 0]); N.push(r); }
  const add = (i, j, f) => { const n = N[i][j]; n[0] += f[0]; n[1] += f[1]; n[2] += f[2]; };
  for (let i = 0; i < ni - 1; i++) for (let j = c0; j < Math.min(nj - 1, c1); j++) {
    const j2 = j + 1, a = G[i][j], b = G[i + 1][j], c = G[i + 1][j2], d = G[i][j2];
    const f = crs(sub(c, a), sub(d, b)); add(i, j, f); add(i + 1, j, f); add(i + 1, j2, f); add(i, j2, f);
  }
  for (let i = 0; i < ni; i++) for (let j = 0; j < nj; j++) N[i][j] = nrm(N[i][j]);
  return N;
}

// ---------- materiallar ----------
// Bir nechta o'zgartirishni bitta materialga ulash (onBeforeCompile zanjiri; dastur kaliti barqaror)
export function hook(m, key, fn) {
  const prev = m.onBeforeCompile;
  m.onBeforeCompile = function (sh, r) { if (prev && prev !== THREE.Material.prototype.onBeforeCompile) prev.call(this, sh, r); fn(sh); };
  const pk = m.customProgramCacheKey;
  m.customProgramCacheKey = function () { return (pk ? pk.call(this) : '') + '|' + key; };
  m.needsUpdate = true;
  return m;
}
export const VMAT = {};
// Umumiy materiallar (bir marta yaratiladi): trim (plastik/metall/rezina — aRM orqali), oyna, ichki chiroq korpusi
export function vmats() {
  if (VMAT.trim) return VMAT;
  VMAT.trim = hook(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 1 }), 'vtrim1', (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec2 aRM;\nvarying vec2 vRM;\n').replace('#include <begin_vertex>', '#include <begin_vertex>\nvRM = aRM;\n');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec2 vRM;\n')
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = vRM.x;\n')
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor = vRM.y;\n');
  });
  // Oyna: shaffof, to'q, atrof aksi shaffoflikni "yeydi" (premultiplied: o'tgan yorug'lik × (1-a) + aks); transmission ishlatilmaydi
  VMAT.glass = hook(new THREE.MeshStandardMaterial({ vertexColors: true, color: 0x0b1013, roughness: 0.03, metalness: 0.0, transparent: true, opacity: 0.74, depthWrite: false, premultipliedAlpha: true }), 'vglass1', (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace('#include <opaque_fragment>', 'gl_FragColor = vec4(totalDiffuse * diffuseColor.a + totalSpecular * 1.35 + totalEmissiveRadiance, diffuseColor.a);\n')
      .replace('#include <premultiplied_alpha_fragment>', '\n');
  });
  return VMAT;
}
// Kuzov bo'yog'i: lak qatlami (clearcoat) + panel chiziqlari (eshik, kapot, yukxona) obyekt fazosida — geometriyasiz
export function paintMaterial(hex, seam = {}) {
  const m = new THREE.MeshPhysicalMaterial({ vertexColors: true, color: hex, metalness: 0.12, roughness: 0.38, clearcoat: 1, clearcoatRoughness: 0.04 });
  const v4 = (a) => new THREE.Vector4(...(a || [-99, -99, -99, -99]).concat([-99, -99, -99, -99]).slice(0, 4));
  const U = { uSeamA: { value: v4(seam.a) }, uSeamB: { value: v4(seam.b) }, uSeamC: { value: v4(seam.c) }, uPearl: { value: 0 }, uPearlC: { value: new THREE.Color(1, 1, 1) } }; // uPearl — sadaf qoplamasi (boyoq.js): chetlarda tus o'zgaradi
  m.userData.seam = U;
  return hook(m, 'vpaint2', (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vObjP;\n').replace('#include <begin_vertex>', '#include <begin_vertex>\nvObjP = transformed;\n');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vObjP;\nuniform vec4 uSeamA, uSeamB, uSeamC;\nuniform float uPearl;\nuniform vec3 uPearlC;\nfloat seamL(float d, float w){ return 1.0 - smoothstep(0.0012, 0.0012 + w, abs(d)); }\n')
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n{ float pfr = 1.0 - clamp(abs(dot(normal, normalize(vViewPosition))), 0.0, 1.0); diffuseColor.rgb = mix(diffuseColor.rgb, uPearlC * max(0.25, max(diffuseColor.r, max(diffuseColor.g, diffuseColor.b))), uPearl * pfr * (0.35 + 0.65 * pfr)); }\n')
      .replace('#include <color_fragment>', `#include <color_fragment>
      {
        vec3 sp = vObjP; float wz = fwidth(sp.z) + 0.0016, wx = fwidth(sp.x) + 0.0016, sm = 0.0;
        // uSeamC: x — chiziq pastki y, y — yuqori y (bel chizig'i), z — yon sirt boshlanadigan |x|, w — kapot/yukxona ustki y chegarasi
        float side = step(uSeamC.z, abs(sp.x)) * step(uSeamC.x, sp.y) * step(sp.y, uSeamC.y);
        for (int i = 0; i < 4; i++) { float zz = uSeamB[i]; if (zz > -50.0) sm = max(sm, side * seamL(sp.z - zz, wz)); }
        float top = step(uSeamC.w, sp.y);
        if (uSeamA.x > -50.0) { sm = max(sm, top * step(abs(sp.x), uSeamA.y) * seamL(sp.z - uSeamA.x, wz)); sm = max(sm, top * step(uSeamA.x, sp.z) * seamL(abs(sp.x) - uSeamA.y, wx)); }
        if (uSeamA.z > -50.0) { sm = max(sm, top * step(abs(sp.x), uSeamA.w) * seamL(sp.z - uSeamA.z, wz)); sm = max(sm, top * step(sp.z, uSeamA.z) * seamL(abs(sp.x) - uSeamA.w, wx)); }
        diffuseColor.rgb *= 1.0 - 0.82 * sm;
      }
`);
  });
}
// Chiroq materiali (yoqilganda rang > 1 — bloom ushlaydi)
export const lampMat = (hex) => new THREE.MeshBasicMaterial({ color: hex, vertexColors: true, fog: false });

// ---------- silliq polichiziq: [[z, y, r]] — burchaklar r radiusda yumaloqlanadi; z o'suvchi bo'lishi kerak ----------
export function rpoly(pts) {
  if (pts[0][0] > pts[pts.length - 1][0]) pts = pts.slice().reverse();
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], r = p[2] || 0;
    if (i === 0 || i === pts.length - 1 || !r) { out.push([p[0], p[1]]); continue; }
    const a = pts[i - 1], b = pts[i + 1], la = Math.hypot(a[0] - p[0], a[1] - p[1]), lb = Math.hypot(b[0] - p[0], b[1] - p[1]), d = Math.min(r, la * 0.49, lb * 0.49);
    const A = [p[0] + (a[0] - p[0]) * d / la, p[1] + (a[1] - p[1]) * d / la], Bp = [p[0] + (b[0] - p[0]) * d / lb, p[1] + (b[1] - p[1]) * d / lb];
    for (let k = 0; k <= 10; k++) { const t = k / 10, u = 1 - t; out.push([u * u * A[0] + 2 * u * t * p[0] + t * t * Bp[0], u * u * A[1] + 2 * u * t * p[1] + t * t * Bp[1]]); }
  }
  const f = (z) => {
    if (z <= out[0][0]) return out[0][1]; const n = out.length; if (z >= out[n - 1][0]) return out[n - 1][1];
    let lo = 0, hi = n - 1; while (hi - lo > 1) { const md = (lo + hi) >> 1; if (out[md][0] <= z) lo = md; else hi = md; }
    const a = out[lo], b = out[hi], t = (z - a[0]) / (b[0] - a[0] || 1); return a[1] + (b[1] - a[1]) * t;
  };
  f.pts = out; return f;
}

// ---------- KORPUS GENERATORI ----------
// Korpus bo'ylama kesimlardan yasaladi (Z bo'ylab stansiyalar, har birida yarim kesim — pastki markazdan tom markazigacha).
// D: { hl, W, yb, top:[[z,y,r]], bot:[[z,y,r]], belt:[[z,y,r]], tumble, hoodX, crown, pF, pR, wheels:[{z,cy,r,x,w}], need:[z...], step }
// Ustunlar: 0 tag markazi, 1 tag, 2 ostona burchagi, 3..7 yon, 8 yelka (qirra), 9..12 yon oyna, 13..14 tom qirrasi, 15..18 tom/kapot
export const NC = 19, COL = { belt: 8, glass0: 9, roofE: 12, pill: 14 };
export function makeBody(D) {
  const top = rpoly(D.top), bot = rpoly(D.bot), belt = rpoly(D.belt), hl = D.hl, zf = D.zf != null ? D.zf : hl, zr = D.zr != null ? D.zr : -hl;
  const pF = D.pF || 3.2, pR = D.pR || 3.6, W0 = D.W, tumble = D.tumble || 0.8, hoodX = D.hoodX || 0.86, crownR = D.crown || 0.05, crownH = D.crownH || 0.035;
  const roofY = D.roofY || Math.max(...D.top.map((p) => p[1])), hoodY = D.hoodY || D.top[1][1];
  const plan = D.planFn ? (z) => D.planFn(z) : (z) => { // rcF/rcR berilsa — o'sha uchi yumaloq burchakli to'g'ri to'rtburchak (quti shakli)
    const fr = z >= (D.zc || 0), rc = fr ? D.rcF : D.rcR; if (!rc) return superE(z);
    const d = fr ? zf - z : z - zr; if (d < 1e-5) return 0; return d >= rc ? W0 : W0 - rc + Math.sqrt(Math.max(0, rc * rc - (rc - d) * (rc - d)));
  };
  const superE = (z) => {
    const zc = D.zc || 0, t = z >= zc ? (z - zc) / (zf - zc) : (zc - z) / (zc - zr), p = z >= zc ? pF : pR;
    const s = Math.pow(Math.max(0, 1 - Math.pow(Math.min(1, t), p)), 1 / p);
    return W0 * s * (1 - (z >= zc ? D.taperF || 0.04 : D.taperR || 0.02) * t * t);
  };
  const arch = (z) => { let y = -1e9; for (const w of D.wheels || []) { const dz = z - w.z; if (Math.abs(dz) < w.ra) y = Math.max(y, w.cy + Math.sqrt(w.ra * w.ra - dz * dz)); } return y; };
  const humpY = (z) => { let y = -1e9; for (const w of D.wheels || []) { const R = w.ra + 0.1, dz = z - w.z; if (Math.abs(dz) < R) y = Math.max(y, w.cy + Math.sqrt(R * R - dz * dz) - 0.04); } return y; };
  const archIn = (z) => { let x = 1e9; for (const w of D.wheels || []) if (Math.abs(z - w.z) < w.ra) x = Math.min(x, w.xin); return x; };
  // bitta kesim (keshlanadi: sirt so'rovlari bir xil z ni ko'p marta so'raydi)
  const secC = new Map(), section = (z) => { const key = Math.round(z * 1e5); let r = secC.get(key); if (!r) { r = section0(z); secC.set(key, r); } return r; };
  const section0 = (z) => {
    const W = plan(z), yB = bot(z), yT = top(z), yS0 = belt(z), yS = Math.min(yS0, yT - 0.012), h = Math.max(0.02, yS - yB);
    const cab = sst(hoodY + 0.04, roofY - 0.06, yT) * (D.cabZ ? (z < D.cabZ[1] && z > D.cabZ[0] ? 1 : 0) : 1);
    const Xe = W * (hoodX + (tumble - hoodX) * cab), crown = crownH + (crownR - crownH) * cab, rr = Math.min(0.055, W * 0.08) * (0.35 + 0.65 * cab);
    const y14 = yT - crown, Ye = Math.max(Math.min(y14 - rr * 1.1, yT), yB + 0.02);
    const sideK = D.side || [0.997, 1, 0.993, 0.975];
    const P = [
      [0, yB], [W * 0.55, yB], [W * 0.9, yB + 0.004], [W * 0.972, yB + Math.min(0.05, h * 0.15)], [W * sideK[0], yB + h * 0.3], [W * sideK[1], yB + h * 0.52],
      [W * sideK[2], yB + h * 0.76], [W * sideK[3], yS - Math.min(0.025, h * 0.08)], [W * 0.955, yS],
    ];
    const g0 = [W * 0.94, yS + 0.01], E = [Xe, Ye];
    P.push(g0, lerp2(g0, E, 0.36), lerp2(g0, E, 0.7), E, [Xe - rr * 0.42, Ye + rr * 0.72], [Xe - rr * 1.15, Ye + rr * 1.1]);
    const x14 = Xe - rr * 1.15, y14b = Ye + rr * 1.1;
    for (const a of [0.34, 0.64, 0.87]) P.push([x14 * (1 - a), y14b + (yT - y14b) * (1 - (1 - a) * (1 - a))]);
    P.push([0, yT]);
    // ark yelkadan baland bo'lsa — qanot do'ngi: yelka va kapot cheti ark ustidan silliq o'tadi (aks holda ark kesigi kapotdan chiqib, qora "tirnoq" bo'lardi)
    const hump = (1 - cab) * Math.max(0, humpY(z) - P[8][1]);
    if (hump > 1e-4) for (let j = 5; j < 18; j++) P[j][1] += hump * HUMPW[j];
    // g'ildirak arkalari: yon nuqtalarni ark chizig'igacha ko'tarish
    const ay = arch(z), ax = archIn(z), raised = [];
    for (let j = 1; j <= 8; j++) { raised[j] = false; if (P[j][0] > ax && P[j][1] < ay) { P[j][1] = ay; raised[j] = true; if (j >= 3) P[j][0] = Math.max(P[j][0], W * 0.985 + (D.flare || 0)); } }
    return { z, W, yB, yT, yS, cab, P, raised };
  };
  // stansiyalar
  const need = [zr, zf, ...(D.need || [])];
  for (const w of D.wheels || []) for (const k of [-1, -0.7, -0.35, 0, 0.35, 0.7, 1]) need.push(w.z + k * w.ra);
  const Z = [...new Set(need.filter((z) => z >= zr && z <= zf).map((z) => +z.toFixed(4)))].sort((a, b) => a - b), st = D.step || 0.085, zs = [];
  for (let i = 0; i < Z.length - 1; i++) {
    const a = Z[i], b = Z[i + 1], len = b - a, loc = (z) => { const e = Math.min(z - zr, zf - z); return st * (e < 0.3 ? 0.35 + (Math.max(0, e) / 0.3) * 0.65 : 1); };
    const P = [a]; let z = a; while (z < b - 1e-6) { z += loc(z); P.push(z); } // mahalliy qadam bilan yurish, keyin oraliqqa moslash
    const k = len / (P[P.length - 1] - a); for (let q = 0; q < P.length - 1; q++) zs.push(a + (P[q] - a) * k);
  }
  zs.push(zf);
  // uchlarida qo'shimcha (yumaloqlanish uchun) stansiyalar
  const extra = []; for (const [e, sd] of [[zf, -1], [zr, 1]]) for (const t of [0.004, 0.012, 0.025, 0.045]) extra.push(e + sd * t);
  const ZS = [...new Set(zs.concat(extra).map((z) => +z.toFixed(4)))].sort((a, b) => a - b);
  const S = ZS.map(section);
  const G = S.map((s) => s.P.map((p) => [p[0], p[1], s.z]));
  // normallar: bo'laklar bo'yicha (qirralar: 2, 8, 12)
  const bands = D.bands || [[0, 2], [2, 8], [8, 12], [12, 18]];
  const neg = (N) => N.map((r) => r.map((n) => [-n[0], -n[1], -n[2]])); // to'r tartibi ichkariga qaratadi — tashqariga o'giramiz
  const NF = neg(gridNormals(G, 0, NC - 1)), NB = bands.map((b) => neg(gridNormals(G, b[0], b[1])));
  const normalAt = (i, j, bi) => { let n = NB[bi][i][j]; if (!(n[0] || n[1] || n[2])) n = NF[i][j]; if (!(n[0] || n[1] || n[2])) n = (NF[i + 1] || NF[i - 1])[j]; n = n.slice(); if (Math.abs(G[i][j][0]) < 1e-6) { n[0] = 0; n = nrm(n); } return n; };
  const body = { D, S, G, ZS, plan, top, bot, belt, arch, section, bands, normalAt, zf, zr };
  // sirt so'rovlari
  body.halfW = (z, y) => { const s = section(z), P = s.P; for (let j = 2; j < 12; j++) { const a = P[j], b = P[j + 1]; if ((a[1] - y) * (b[1] - y) <= 0 && a[1] !== b[1]) return a[0] + (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]); } return y < s.yB ? 0 : P[8][0]; };
  body.topY = (x, z) => { const P = section(z).P; for (let j = 18; j > 8; j--) { const a = P[j], b = P[j - 1]; if (x >= a[0] && x <= b[0]) return a[1] + (b[1] - a[1]) * (x - a[0]) / (b[0] - a[0] || 1); } return P[8][1]; };
  // old/orqa yuzadagi nuqta: |x| va y berilganda z (end=+1 old, -1 orqa)
  body.endZ = (x, y, end) => { const ax = Math.max(0.012, Math.abs(x)); let lo = end > 0 ? zf - 0.9 : zr + 0.9, hi = end > 0 ? zf : zr; for (let k = 0; k < 24; k++) { const md = (lo + hi) / 2; if (body.halfW(md, y) >= ax) lo = md; else hi = md; } return lo; };
  body.endN = (x, y, end) => { const e = 0.01, ax = Math.abs(x), z0 = body.endZ(ax, y, end), dx = (body.endZ(ax + e, y, end) - z0) / e * (Math.sign(x) || 1), dy = (body.endZ(ax, y + e, end) - z0) / e; return nrm(end > 0 ? [-dx, -dy, 1] : [dx, dy, -1]); };
  return body;
}
const HUMPW = [0, 0, 0, 0, 0, 0.15, 0.55, 1, 1, 1, 1, 1, 1, 1, 1, 0.92, 0.55, 0.2, 0];
const lerp2 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

// Korpusni quruvchilarga tarqatish: who(i, j, s0, s1) -> builder | null; k(i, j) — rang (AO)
export function emitBody(body, who, kfn) {
  const { G, S, bands } = body, ni = G.length;
  const bandOf = (j) => { for (let b = 0; b < bands.length; b++) if (j >= bands[b][0] && j < bands[b][1]) return b; return bands.length - 1; };
  const cache = {};
  const N = (i, j, b) => { const key = (b * 1000 + i) * 32 + j; return cache[key] || (cache[key] = body.normalAt(i, j, b)); };
  for (const sd of [1, -1]) {
    for (let i = 0; i < ni - 1; i++) for (let j = 0; j < NC - 1; j++) {
      const g = who(i, j, S[i], S[i + 1], sd); if (!g) continue;
      const b = bandOf(j), k = (ii, jj) => (kfn ? kfn(ii, jj, S[ii]) : 1);
      g.push(); if (sd < 0) g.scale(-1, 1, 1);
      g.qS(G[i][j], G[i + 1][j], G[i + 1][j + 1], G[i][j + 1], N(i, j, b), N(i + 1, j, b), N(i + 1, j + 1, b), N(i, j + 1, b), k(i, j), k(i + 1, j), k(i + 1, j + 1), k(i, j + 1));
      g.pop();
    }
  }
}
// Ichki qoplama (salon devorlari, shift): tanlangan kataklar ichkariga siljitiladi va teskari qaraydi
export function emitInner(body, g, sel, off = 0.035, out = false) { // out: tashqariga qaraydi (uzilgan bamper ortidagi qoplama)
  const { G, S } = body, ni = G.length;
  for (const sd of [1, -1]) for (let i = 0; i < ni - 1; i++) for (let j = 0; j < NC - 1; j++) {
    if (!sel(i, j, S[i], S[i + 1])) continue;
    const q = [[i, j], [i + 1, j], [i + 1, j + 1], [i, j + 1]].map(([a, b]) => { const n = body.normalAt(a, b, 0); const p = G[a][b]; return [[p[0] - n[0] * off, p[1] - n[1] * off, p[2] - n[2] * off], out ? n : [-n[0], -n[1], -n[2]]]; });
    g.push(); if (sd < 0) g.scale(-1, 1, 1); g.qS(q[0][0], q[1][0], q[2][0], q[3][0], q[0][1], q[1][1], q[2][1], q[3][1]); g.pop();
  }
}
// Old/orqa yuzaga yopishgan yamoq (chiroq, panjara, nomer): x0..x1, y0..y1 (x — chap tomonda musbat), off — yuzadan chiqish
export function endPatch(body, g, end, x0, x1, y0, y1, nx = 4, ny = 2, off = 0.006, k) {
  const G = [];
  for (let a = 0; a <= ny; a++) { const row = [], y = y0 + ((y1 - y0) * a) / ny, xm = body.halfW(end > 0 ? body.zf - 0.4 : body.zr + 0.4, y) * 0.985; for (let b = 0; b <= nx; b++) { let x = x0 + ((x1 - x0) * b) / nx; if (Math.abs(x) > xm) x = Math.sign(x) * xm; const z = body.endZ(x, y, end), n = body.endN(x, y, end); row.push([x + n[0] * off, y + n[1] * off, z + n[2] * off]); } G.push(row); }
  const N = gridNormals(G, 0, nx); const out = [0, 0, end];
  for (let a = 0; a < N.length; a++) for (let b = 0; b < N[a].length; b++) if (dot(N[a][b], out) < 0) N[a][b] = N[a][b].map((v) => -v);
  g.grid(G, N, k);
  return G;
}
// Yon yuzaga yopishgan yamoq: z0..z1, y0..y1, side +1 chap / -1 o'ng
export function sidePatch(body, g, side, z0, z1, y0, y1, nz = 3, ny = 2, off = 0.005, k) {
  const G = [];
  for (let a = 0; a <= ny; a++) { const row = [], y = y0 + ((y1 - y0) * a) / ny; for (let b = 0; b <= nz; b++) { const z = z0 + ((z1 - z0) * b) / nz, x = body.halfW(z, y) + off; row.push([side * x, y, z]); } G.push(row); }
  const N = gridNormals(G, 0, nz);
  for (let a = 0; a < N.length; a++) for (let b = 0; b < N[a].length; b++) if (N[a][b][0] * side < 0) N[a][b] = N[a][b].map((v) => -v);
  g.grid(G, N, k);
  return G;
}

// Tepa yuzaga yopishgan yamoq (kapot, tom, yukxona): x0..x1, z0..z1
export function topPatch(body, g, x0, x1, z0, z1, nx = 3, nz = 3, off = 0.005, k) {
  const G = [];
  for (let a = 0; a <= nz; a++) { const row = [], z = z0 + ((z1 - z0) * a) / nz; for (let b = 0; b <= nx; b++) { const x = x0 + ((x1 - x0) * b) / nx, y = body.topY(Math.abs(x), z); row.push([x, y + off, z]); } G.push(row); }
  const N = gridNormals(G, 0, nx);
  for (let a = 0; a < N.length; a++) for (let b = 0; b < N[a].length; b++) if (N[a][b][1] < 0) N[a][b] = N[a][b].map((v) => -v);
  g.grid(G, N, k);
  return G;
}

// ---------- G'ILDIRAK ----------
// r — tashqi radius, w — kenglik. o: { prof:'road'|'sport'|'off'|'agri'|'bike'|'slick', rim, spokes, style:'y'|'split'|'steel'|'mesh'|'disc'|'wire', side, lite, caliper }
export const tyreSide = (r, o) => (o.side || ({ sport: 0.24, slick: 0.26, off: 0.42, agri: 0.4, kart: 0.36 })[o.prof] || 0.33) * r;
export function wheelGeo(r, w, o = {}) { const g = new VB(260 + Math.round(r * 100), 0); wheelInto(g, r, w, o); return g.build(); }
// G'ildirakni mavjud quruvchiga qo'shish (X o'qi atrofida, markaz 0) — zaxira g'ildirak uchun ham
export function wheelInto(g, r, w, o = {}) {
  const hw = w / 2, n = o.lite ? 16 : o.n || 26, kind = o.prof || 'road';
  const sh = tyreSide(r, o), rr = r - sh;
  const TY = 0x16171a, RIM = o.rim == null ? 0xb8bcc4 : o.rim;
  // shina: munchoqdan yon devor, yelka, protektor (ariqchalar bilan), qarshi tomon
  g.mat(TY, 0.88, 0);
  const pr = [[rr + 0.01, -hw * 0.82, 1], [rr + sh * 0.18, -hw * 0.97], [rr + sh * 0.5, -hw], [rr + sh * 0.82, -hw * 0.97], [r - sh * 0.06, -hw * 0.9], [r - 0.004, -hw * 0.8, 1]];
  if ((kind === 'road' || kind === 'sport') && !o.lite) { const gd = 0.009, gw = Math.min(0.012, w * 0.05); for (const c of [-0.42, 0, 0.42]) pr.push([r, c * hw - gw, 1], [r - gd, c * hw - gw * 0.7, 1], [r - gd, c * hw + gw * 0.7, 1], [r, c * hw + gw, 1]); }
  pr.push([r - 0.004, hw * 0.8, 1], [r - sh * 0.06, hw * 0.9], [rr + sh * 0.82, hw * 0.97], [rr + sh * 0.5, hw], [rr + sh * 0.18, hw * 0.97], [rr + 0.01, hw * 0.82]);
  g.lathe(pr, n, { k: (i) => 1 });
  // protektor bloklari (yo'lsizlik, traktor)
  if (kind === 'off' || kind === 'agri') {
    g.color(0x121316).rm(0.92, 0); const nb = kind === 'agri' ? 18 : Math.round(r * (o.lite ? 30 : 46)), bh = kind === 'agri' ? 0.055 * (r / 0.8) : 0.02 + r * 0.025;
    for (let i = 0; i < nb; i++) for (const sd of [-1, 1]) {
      const a = (i / nb) * Math.PI * 2 + (sd > 0 ? Math.PI / nb : 0);
      g.push().rotX(a);
      if (kind === 'agri') { g.push().translate(sd * hw * 0.45, r - 0.005 + bh / 2, 0).rotY(sd * 0.55); g.box(0, 0, 0, w * 0.62, bh, 0.05 * (r / 0.8)); g.pop(); }
      else { g.box(sd * hw * 0.45, r - 0.004 + bh / 2, 0, w * 0.46, bh, (r * 6.283) / nb * 0.42, { tx: 0.9, tz: 0.85 }); g.box(sd * hw * 0.92, r - sh * 0.12, 0, w * 0.12, bh * 0.9, (r * 6.283) / nb * 0.5); }
      g.pop();
    }
  }
  // disk (gardish)
  const face = hw * 0.62, lip = rr + 0.012;
  g.mat(RIM, o.rimR == null ? 0.28 : o.rimR, o.rimM == null ? 0.9 : o.rimM);
  const style = o.style || 'y', spokesN = o.spokes || 5;
  const inner = style === 'steel' || style === 'disc' ? rr * 0.92 : rr * 0.8;
  g.lathe([[lip, face], [lip, face + 0.016, 1], [rr - 0.006, face + 0.024, 1], [inner, face - 0.004, 1], [inner * 0.97, face - 0.03, 1], [rr - 0.012, face - 0.035, 1], [rr - 0.012, -hw * 0.84]], n);
  // tormoz diski va gupchak (aylanadi)
  if (style !== 'steel' && style !== 'disc' && !o.lite) {
    g.mat(0x6e7178, 0.5, 0.85); const dr = rr * 0.86;
    g.lathe([[dr, hw * 0.05 - 0.022], [dr, hw * 0.05, 1], [dr * 0.42, hw * 0.05]], n);
    g.mat(0x3a3c42, 0.6, 0.7); g.lathe([[dr * 0.42, hw * 0.06], [r * 0.18, face - 0.06]], Math.max(10, n >> 1));
  }
  g.mat(RIM, o.rimR == null ? 0.28 : o.rimR, o.rimM == null ? 0.9 : o.rimM);
  const hubR = r * 0.16;
  if (style === 'steel' || style === 'disc') {
    // po'lat disk: botiq yuz, teshiklar (qora dog'lar), gupchak qopqog'i
    const fz = face - 0.02;
    g.lathe([[inner * 0.97, face - 0.03], [rr * 0.62, fz - 0.03], [hubR * 1.4, fz - 0.01], [hubR * 1.1, fz + 0.012, 1], [hubR, fz + 0.02], [0.001, fz + 0.024]], n);
    if (style === 'steel') { g.mat(0x0e0f12, 0.9, 0); const nh = o.holes || 8; for (let i = 0; i < nh; i++) { const a = (i / nh) * Math.PI * 2; g.push().rotX(a); g.push().translate(fz - 0.028, rr * 0.75, 0); g.prismX(8, rr * 0.075, 0.012); g.pop(); g.pop(); } }
  } else {
    // parchalar (spitsalar): gupchakdan disk chetigacha toraygan prizma
    const sp = (a, wide, x0) => {
      const c = Math.cos(a), s = Math.sin(a), pp = (rad, ww, xx) => [[xx, rad * c - ww * s, rad * s + ww * c], [xx, rad * c + ww * s, rad * s - ww * c]];
      const r0 = hubR * 1.05, r1 = inner * 0.99, w0 = wide * r * 0.15, w1 = wide * r * 0.09, d = 0.022 * (r / 0.33);
      const [a0, b0] = pp(r0, w0, x0), [a1, b1] = pp(r1, w1, x0 - 0.012), [a2, b2] = pp(r0, w0 * 0.8, x0 - d), [a3, b3] = pp(r1, w1 * 0.8, x0 - d - 0.012);
      g.qF(a0, a1, b1, b0, [1, 0, 0]); g.qF(a0, a2, a3, a1, [0, -s, c]); g.qF(b0, b1, b3, b2, [0, s, -c]); g.qF(a1, a3, b3, b1, [0, c, s]);
    };
    const fx = face - 0.012;
    for (let i = 0; i < spokesN; i++) {
      const a = (i / spokesN) * Math.PI * 2;
      if (style === 'split') { sp(a - 0.09, 0.42, fx); sp(a + 0.09, 0.42, fx); }
      else if (style === 'mesh') { sp(a - 0.13, 0.32, fx); sp(a + 0.13, 0.32, fx); sp(a, 0.25, fx - 0.004); }
      else sp(a, style === 'thin' ? 0.55 : 1, fx);
    }
    g.lathe([[hubR * 1.15, fx - 0.03], [hubR * 1.12, fx + 0.004, 1], [hubR * 0.8, fx + 0.01], [0.001, fx + 0.012]], Math.max(12, n >> 1));
  }
  // gayka boltlari va markaz qopqog'i
  g.mat(o.nut || 0x8c9098, 0.3, 0.9); const nn = o.nuts || 5, fz2 = style === 'steel' || style === 'disc' ? face + 0.005 : face - 0.0;
  for (let i = 0; i < (o.lite ? 0 : nn); i++) { const a = (i / nn) * Math.PI * 2 + 0.3; g.push().rotX(a); g.push().translate(fz2, hubR * 0.62, 0); g.prismX(6, hubR * 0.13, 0.03); g.pop(); g.pop(); }
  g.mat(o.cap || 0x2a2c32, 0.3, 0.6); g.push().translate(fz2 + 0.012, 0, 0); g.prismX(10, hubR * 0.38, 0.02); g.pop();
  return g;
}
// Kaliper (aylanmaydi): disk orqasida, tepa-orqada
export function caliperGeo(r, w, o = {}) {
  const g = new VB(77, 0), hw = w / 2, rr = r - tyreSide(r, o), dr = rr * 0.86;
  g.mat(o.color || 0x2a2c30, 0.45, 0.4);
  g.push().rotX(-2.3); g.rbox(hw * 0.05, dr * 0.78, 0, 0.07, dr * 0.32, dr * 0.62, 0.012, 1); g.pop();
  return g.build();
}
// Velosiped/mototsikl g'ildiragi: ingichka shina, gardish, simli yoki quyma
export function bikeWheelGeo(r, w, o = {}) {
  const g = new VB(300 + Math.round(r * 100), 0), hw = w / 2, n = o.lite ? 18 : 28, t = o.thin || 0.04, rr = r - t;
  g.mat(0x16171a, 0.85, 0);
  g.lathe([[rr, -hw * 0.6, 1], [rr + t * 0.35, -hw], [r - t * 0.15, -hw * 0.8], [r, 0], [r - t * 0.15, hw * 0.8], [rr + t * 0.35, hw], [rr, hw * 0.6]], n);
  g.mat(o.rim || 0xc8ccd2, 0.25, 0.9);
  g.lathe([[rr - t * 0.4, -hw * 0.45, 1], [rr + 0.004, -hw * 0.55, 1], [rr + 0.004, hw * 0.55, 1], [rr - t * 0.4, hw * 0.45, 1], [rr - t * 0.4, -hw * 0.45]], n);
  if (o.style === 'cast' || o.style === 'disc') {
    const ns = o.spokes || (o.style === 'disc' ? 0 : 5);
    if (o.style === 'disc') { g.lathe([[rr - t * 0.4, hw * 0.3], [rr * 0.5, hw * 0.45], [0.03, hw * 0.55]], n); g.lathe([[0.03, -hw * 0.55], [rr * 0.5, -hw * 0.45], [rr - t * 0.4, -hw * 0.3]], n); }
    for (let i = 0; i < ns; i++) { const a = (i / ns) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a); g.tube([[0, 0.05 * c, 0.05 * s], [0, rr * 0.55 * c + 0.02 * s, rr * 0.55 * s - 0.02 * c], [0, (rr - t * 0.4) * c, (rr - t * 0.4) * s]], [0.016, 0.012, 0.01], 6, { sy: 0.6 }); }
    if (o.disc) { g.mat(0x8a8e96, 0.4, 0.85); g.lathe([[o.disc * 0.55, hw * 0.75], [o.disc, hw * 0.75, 1], [o.disc, hw * 0.75 + 0.006, 1], [o.disc * 0.55, hw * 0.75 + 0.006]], n); }
  } else {
    // simli: ikki tomonlama tangensial spitsalar
    g.mat(0xb0b4bc, 0.3, 0.9); const ns = o.spokes || 32, hubR = 0.022;
    for (let i = 0; i < ns; i++) {
      const sd = i % 2 ? 1 : -1, a = (i / ns) * Math.PI * 2, b = a + sd * 0.55 * (i % 4 < 2 ? 1 : -1);
      const p0 = [sd * hw * 0.9, hubR * Math.cos(a), hubR * Math.sin(a)], p1 = [sd * hw * 0.15, (rr - t * 0.3) * Math.cos(b), (rr - t * 0.3) * Math.sin(b)];
      g.rod(p0, p1, 0.0016, 0.0016, 3, false);
    }
  }
  g.mat(0x8a8e96, 0.35, 0.85); g.push(); g.prismX(10, 0.028, w * 1.4); g.pop();
  return g.build();
}

// ---------- haydovchi (silliq qo'l-oyoqlar, bosh, kaska) ----------
export function riderGeo2(o, skin = 0xe0b08a) {
  const g = new VB(555, 0), hip = o.hip, lean = o.lean || 0.12, tl = 0.54;
  const sh = [0, hip[1] + Math.cos(lean) * tl, hip[2] + Math.sin(lean) * tl], shirt = o.shirt || 0x2f7fd0, pants = o.pants || 0x34394a;
  g.mat(shirt, 0.85, 0);
  // tana: kesimi ellips bo'lgan quvur (bel -> ko'krak -> yelka)
  const up = [Math.sin(0), Math.cos(lean), Math.sin(lean)], P = (t) => [0, hip[1] + 0.04 + up[1] * tl * t, hip[2] + up[2] * tl * t];
  g.tube([P(0), P(0.35), P(0.7), P(0.94)], [0.14, 0.15, 0.17, 0.13], 10, { sy: 0.68, cap: true });
  for (const sx of [-1, 1]) {
    const s0 = [sx * 0.19, sh[1] - 0.05, sh[2]], hd = [sx * o.hand[0], o.hand[1], o.hand[2]];
    const el = [(s0[0] + hd[0]) / 2 + sx * 0.06, (s0[1] + hd[1]) / 2 - 0.1, (s0[2] + hd[2]) / 2 - 0.04];
    g.mat(shirt, 0.85, 0); g.blob(0.065, 1, { cx: s0[0], cy: s0[1], cz: s0[2], shade: 0 }); g.tube([s0, el], [0.055, 0.045], 8);
    g.mat(o.glove || skin, 0.7, 0); g.tube([el, hd], [0.043, 0.036], 8); g.blob(0.045, 0, { cx: hd[0], cy: hd[1], cz: hd[2], shade: 0 });
    const h0 = [sx * 0.1, hip[1], hip[2]], ft = [sx * o.foot[0], o.foot[1], o.foot[2]];
    const kn = [sx * (o.foot[0] + 0.03), (h0[1] + ft[1]) / 2 + (o.knee || 0.2), (h0[2] + ft[2]) / 2 + 0.1];
    g.mat(pants, 0.9, 0); g.tube([h0, kn], [0.085, 0.065], 8); g.blob(0.066, 0, { cx: kn[0], cy: kn[1], cz: kn[2], shade: 0 }); g.tube([kn, ft], [0.062, 0.05], 8);
    g.mat(0x24262b, 0.7, 0); g.rbox(ft[0], ft[1] - 0.03, ft[2] + 0.06, 0.1, 0.09, 0.26, 0.035, 1);
  }
  const hc = [0, sh[1] + 0.2, sh[2] + 0.03];
  g.mat(skin, 0.6, 0); g.tube([[0, sh[1] - 0.02, sh[2]], [0, sh[1] + 0.09, sh[2] + 0.02]], 0.05, 8); g.blob(0.11, 2, { cx: hc[0], cy: hc[1], cz: hc[2], sy: 1.15, shade: 0 });
  if (o.helmet) { g.mat(o.helmet, 0.25, 0.1); g.blob(0.145, 2, { cx: 0, cy: hc[1] + 0.02, cz: hc[2] - 0.01, sy: 1.08, shade: 0 }); g.mat(0x101114, 0.08, 0.5); g.blob(0.13, 1, { cx: 0, cy: hc[1] + 0.0, cz: hc[2] + 0.05, sx: 0.92, sy: 0.55, sz: 0.85, shade: 0 }); }
  else { g.mat(o.hair || 0x2e2018, 0.9, 0); g.blob(0.118, 1, { cx: 0, cy: hc[1] + 0.04, cz: hc[2] - 0.015, sy: 0.9, shade: 0 }); }
  return g.build();
}
