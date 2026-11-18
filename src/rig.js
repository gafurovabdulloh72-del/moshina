// Odam modeli (o'yinchi va aholi): suyaklarga bog'langan silliq tana (bitta SkinnedMesh), kiyim/teri/soch xilma-xilligi, shlyapa va asboblar; harakat — anim.js
import * as THREE from 'three';
import { GB, MAT } from './geo.js';
import { hexLin, mulberry32, clamp } from './util.js';
import { B, animate, initAnim, rigEnv, poseRiderAnim } from './anim.js';

const HATS = {
  somon: (g) => { g.color(0xd8bf74).cyl(12, 0.34, 0.3, 0.1, 0.13, { cap: true }); g.cyl(10, 0.17, 0.15, 0.12, 0.26, { cap: true }); g.color(0x9a4434).cyl(10, 0.175, 0.17, 0.13, 0.17); },
  kepka: (g) => { g.color(0xb83a2e).blob(0.185, 1, { cy: 0.1, sy: 0.7 }); g.box(0, 0.1, 0.2, 0.26, 0.03, 0.2); },
  doppi: (g) => { g.color(0x1d1e24).box(0, 0.19, 0, 0.27, 0.12, 0.27, { tx: 0.86, tz: 0.86 }); g.color(0xf2f2ee); for (const [x, z] of [[0.09, 0.136], [-0.09, 0.136], [0.09, -0.136], [-0.09, -0.136], [0.136, 0.09], [0.136, -0.09], [-0.136, 0.09], [-0.136, -0.09]]) g.box(x, 0.17, z, Math.abs(x) > 0.13 ? 0.01 : 0.05, 0.05, Math.abs(z) > 0.13 ? 0.01 : 0.05); },
  toj: (g) => { g.color(0xffd23a).cyl(8, 0.17, 0.18, 0.13, 0.24); for (let i = 0; i < 8; i++) { const a = (i / 8) * 6.283; g.push().translate(Math.sin(a) * 0.17, 0.24, Math.cos(a) * 0.17); g.cyl(4, 0.03, 0, 0, 0.1); g.pop(); } g.color(0xd8392b).blob(0.035, 0, { cy: 0.19, cz: 0.18 }); },
};
// shlyapa joylashuvi yangi (haqiqiy o'lchamdagi) boshga: [masshtab, y, z] — bosh suyagiga nisbatan
const HAT_FIT = { somon: [0.58, 0.035, -0.006], kepka: [0.53, 0.072, -0.006], doppi: [0.6, 0.018, -0.008], toj: [0.55, 0.035, -0.008] };
export const HAT_LIST = [['somon', 'Somon shlyapa', 200], ['kepka', 'Kepka', 250], ['doppi', "Do'ppi", 400], ['toj', 'Oltin toj', 5000]];

// Teri ranglari va kiyim uchun qo'shimcha xilma-xillik
const SKINS = [0xe2b48e, 0xd6a17a, 0xc48d66, 0xb07a55, 0xe8c3a0, 0x9a6a48, 0xd9ad86];
const SHOES = [0x2a2522, 0x3b2a20, 0x1d1e22, 0x5a4636, 0x6b6b70, 0x2f3440];
// To'yingan rangni biroz tabiiylashtirish (kulrangga 18 %) va chiziqli fazoga o'tkazish
const cloth = (hex, k = 1) => { const c = hexLin(hex), l = c[0] * 0.3 + c[1] * 0.55 + c[2] * 0.15; return [(c[0] + (l - c[0]) * 0.18) * k, (c[1] + (l - c[1]) * 0.18) * k, (c[2] + (l - c[2]) * 0.18) * k]; };
const mul = (c, k) => [c[0] * k, c[1] * k, c[2] * k];
const mix3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const sm = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

// Suyaklar: [nom, ota, x, y, z] — 1.76 m bo'yli erkak, tik turgan (qo'llar osilgan) holat
const BONES = [
  ['body', -1, 0, 0.95, 0], ['hips', 0, 0, 0.95, 0], ['spine', 1, 0, 1.05, -0.01], ['chest', 2, 0, 1.24, -0.02], ['neck', 3, 0, 1.465, -0.035], ['head', 4, 0, 1.585, -0.012],
  ['clavL', 3, 0.025, 1.43, 0], ['upL', 6, 0.18, 1.425, -0.02], ['foreL', 7, 0.195, 1.125, -0.035], ['handL', 8, 0.2, 0.875, -0.02], ['fingL', 9, 0.2, 0.795, -0.012],
  ['clavR', 3, -0.025, 1.43, 0], ['upR', 11, -0.18, 1.425, -0.02], ['foreR', 12, -0.195, 1.125, -0.035], ['handR', 13, -0.2, 0.875, -0.02], ['fingR', 14, -0.2, 0.795, -0.012],
  ['thighL', 1, 0.09, 0.91, 0], ['shinL', 16, 0.095, 0.5, 0.01], ['footL', 17, 0.1, 0.085, -0.015], ['toeL', 18, 0.1, 0.02, 0.135],
  ['thighR', 1, -0.09, 0.91, 0], ['shinR', 20, -0.095, 0.5, 0.01], ['footR', 21, -0.1, 0.085, -0.015], ['toeR', 22, -0.1, 0.02, 0.135],
];

// Teriga bog'langan geometriya quruvchisi: indeksli uchlar, rang, 2 ta suyak og'irligi, sirt turi (aSurf)
class SKB {
  constructor() { this.P = []; this.C = []; this.J = []; this.W = []; this.S = []; this.I = []; this.n = 0; }
  v(p, c, w, surf) { this.P.push(p[0], p[1], p[2]); this.C.push(c[0], c[1], c[2]); this.J.push(w[0], w[1], 0, 0); this.W.push(w[2], 1 - w[2], 0, 0); this.S.push(surf); return this.n++; }
  // Halqalardan naycha: o.rings [{c, ru, rf, rb, col, w}], A — naycha o'qi (halqalar ketma-ketligi yo'nalishi), V — "old" (rf tomoni), n — halqadagi uchlar
  tube(o) {
    const n = o.n, A = o.A, V = o.V, U = [A[1] * V[2] - A[2] * V[1], A[2] * V[0] - A[0] * V[2], A[0] * V[1] - A[1] * V[0]], rot = o.rot || 0, R = o.rings, surf = o.surf || 0, base = [];
    for (let k = 0; k < R.length; k++) {
      const r = R[k], b = this.n; base.push(b);
      for (let i = 0; i < n; i++) {
        const th = rot + (i / n) * Math.PI * 2, s = Math.sin(th), c = Math.cos(th), rv = c > 0 ? r.rf : r.rb, ru = r.ru * (r.us && s * r.us > 0 ? 1 + Math.abs(r.us) : 1);
        const p = [r.c[0] + U[0] * s * ru + V[0] * c * rv, r.c[1] + U[1] * s * ru + V[1] * c * rv, r.c[2] + U[2] * s * ru + V[2] * c * rv];
        const q = o.xf ? o.xf(p, th, k) : p;
        this.v(q, o.col ? o.col(q, th, k, r) : r.col, o.wt ? o.wt(q, th, k, r) : r.w || o.w, o.sf ? o.sf(q, th, k) : surf);
      }
    }
    for (let k = 0; k + 1 < R.length; k++) for (let i = 0; i < n; i++) { const a = base[k] + i, b2 = base[k] + ((i + 1) % n), c2 = base[k + 1] + ((i + 1) % n), d = base[k + 1] + i; this.I.push(a, b2, c2, a, c2, d); }
    const cap = (k, len, top) => { const r = R[k], p = [r.c[0] + A[0] * len, r.c[1] + A[1] * len, r.c[2] + A[2] * len], q = o.xf ? o.xf(p, 0, k) : p; const pi = this.v(q, o.col ? o.col(q, 0, k, r) : r.col, o.wt ? o.wt(q, 0, k, r) : r.w || o.w, surf); for (let i = 0; i < n; i++) { const a = base[k] + i, b2 = base[k] + ((i + 1) % n); if (top) this.I.push(a, b2, pi); else this.I.push(pi, b2, a); } };
    if (o.cap0) cap(0, -o.cap0, false);
    if (o.cap1) cap(R.length - 1, o.cap1, true);
    return this;
  }
  // Ellipsoid (yuz detallari, quloq, soch): markaz c, radiuslar, ixtiyoriy aylantirish (rx — X o'qi atrofida) va haykaltaroshlik
  ell(c, rx, ry, rz, n, m, col, w, o = {}) {
    const rings = []; for (let k = 1; k < m; k++) { const v = -Math.PI / 2 + (k / m) * Math.PI; rings.push({ c: [0, Math.sin(v) * ry, 0], ru: Math.cos(v) * rx, rf: Math.cos(v) * rz, rb: Math.cos(v) * rz, col, w }); }
    const ca = Math.cos(o.rx || 0), sa = Math.sin(o.rx || 0), cy = Math.cos(o.ry || 0), sy = Math.sin(o.ry || 0);
    const xf = (p, th, k) => { let q = o.sculpt ? o.sculpt(p.slice(), th, k) : p; let y = q[1] * ca - q[2] * sa, z = q[1] * sa + q[2] * ca, x = q[0]; const x2 = x * cy + z * sy, z2 = -x * sy + z * cy; return [c[0] + x2, c[1] + y, c[2] + z2]; };
    return this.tube({ n, A: [0, 1, 0], V: [0, 0, 1], rings, cap0: o.open ? 0 : ry - Math.abs(rings[0].c[1]), cap1: ry - Math.abs(rings[rings.length - 1].c[1]), xf, col: o.col, wt: o.wt, surf: o.surf, rot: o.rot });
  }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.P, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.C, 3));
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(this.J, 4));
    g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(this.W, 4));
    g.setAttribute('aSurf', new THREE.Float32BufferAttribute(this.S, 1));
    g.setIndex(this.I); g.computeVertexNormals(); return g;
  }
}
// Kesim profili: jadval [[t, ru, rf, rb, dx, dz], ...] bo'yicha istalgan t dagi qiymat (chiziqli)
const prof = (T, t) => { let i = 0; while (i < T.length - 2 && T[i + 1][0] < t) i++; const a = T[i], b = T[i + 1], k = clamp((t - a[0]) / (b[0] - a[0] || 1), 0, 1); return a.map((v, j) => v + ((b[j] || 0) - v) * k); };
// Jadval nuqtalari + chegaralar (rang almashadigan joy) — chegarada 2 mm oraliqli juft halqa, rang aniq ajraladi
const ringTs = (T, seams = []) => { const ts = T.map((r) => r[0]); for (const s of seams) ts.push(s - 0.002, s + 0.002); return [...new Set(ts.map((x) => +x.toFixed(4)))].filter((x) => x >= T[0][0] && x <= T[T.length - 1][0]).sort((a, b) => a - b); };

let rigN = 0, keeper = null;
export function makeRig(o = {}) {
  const seed = o.seed != null ? o.seed : 1013 + rigN * 7919, rnd = mulberry32(seed); rigN++;
  const fem = !!(o.fem != null ? o.fem : o.long);
  const s = (o.height || (fem ? 0.93 + rnd() * 0.06 : 0.96 + rnd() * 0.08)) * (o.player ? 1 : 1);
  const bw = o.build || (0.94 + rnd() * 0.16), hpW = fem ? 1.08 : 1;
  const skin = hexLin(o.skin || SKINS[(seed >>> 3) % SKINS.length]), skinD = mul(skin, 0.8), lip = mix3(skin, hexLin(0x8a3a32), 0.32);
  const shirt = cloth(o.shirt || 0x2f7fd0), pants = cloth(o.pants || 0x3a3f4c, 0.92), hair = hexLin(o.hair || 0x3a2a20), vest = o.vest ? cloth(o.vest) : null;
  const shoe = hexLin(o.shoe || SHOES[(seed >>> 5) % SHOES.length]), sole = mix3(shoe, hexLin(0x8a7a66), 0.45), belt = hexLin(0x2a1f18);
  const sleeve = o.sleeve != null ? o.sleeve : fem ? 1 : rnd() < 0.45 ? 1 : 0.42; // 1 — uzun yeng, <1 — kalta (yelka bo'ylab ulush)
  const dress = fem && (o.dress != null ? o.dress : true), stache = !fem && (o.stache != null ? o.stache : rnd() < 0.35);
  // erkak: baquvvat, sportchi gavda (mu — mushak ulushi: o'yinchi to'liq, aholida 0.75..1); keng yelka, V-shaklli gavda, yo'g'on bo'yin, katta qo'l-oyoq
  const mu = fem ? 0 : o.muscle != null ? o.muscle : o.player ? 1 : 0.75 + rnd() * 0.25, shW = fem ? 0.9 : 1 + 0.2 * mu, M = (a, b) => a + (b - a) * mu;
  // suyak nuqtalari (masshtab bilan)
  const J = BONES.map((b) => { const leg = b[1] >= 16 || b[0].startsWith('thigh'), arm = /clav|up|fore|hand|fing/.test(b[0]); return [b[2] * s * (arm ? shW : leg ? hpW : 1), b[3] * s, b[4] * s]; });
  const g = new SKB();
  const W1 = (b) => [b, b, 1], WB = (a, b, t) => [a, b, 1 - t];
  // ---- tana (chanoqdan bo'yingacha) ----
  const TOR = [ // y, ru, rf, rb, dx, cz
    [0.835, 0.04, 0.03, 0.03, 0, 0.005], [0.85, 0.075, 0.06, 0.07, 0, 0.005], [0.885, 0.145 * hpW, 0.085, 0.105 * hpW, 0, -0.005], [0.94, 0.163 * hpW * M(1, 0.94), 0.093, 0.118 * hpW, 0, -0.012], [0.995, 0.157 * (fem ? 1.02 : M(1, 0.93)), 0.092, 0.098, 0, -0.008],
    [1.07, 0.147 * (fem ? 0.88 : M(1, 0.97)) * bw, M(0.1, 0.097) * bw, M(0.087, 0.09), 0, 0], [1.16, (fem ? 0.1434 : M(0.1576, 0.162)) * bw, (fem ? 0.1135 : M(0.109, 0.108)) * bw, M(0.0921, 0.1), 0, -0.003], [1.205, (fem ? 0.1506 : M(0.1645, 0.18)) * bw, (fem ? 0.1203 : M(0.1135, 0.115)) * bw, M(0.0946, 0.107), 0, -0.004], [fem ? 1.23 : 1.25, 0.168 * (fem ? 0.92 : M(1, 1.18)) * bw, (fem ? 0.124 : M(0.116, 0.123)) * bw, M(0.097, 0.112), 0, -0.006], [1.31, 0.176 * (fem ? 0.9 : M(1, 1.19)), fem ? 0.122 : M(0.114, 0.128), M(0.102, 0.118), 0, -0.012],
    [1.375, 0.18 * shW, M(0.095, 0.118), M(0.104, 0.118), 0, -0.022], [1.425, M(0.17, 0.176) * shW, M(0.075, 0.084), M(0.092, 0.108), 0, -0.03], [1.462, M(0.118, 0.13) * shW, M(0.062, 0.068), M(0.074, 0.088), 0, -0.034], [1.49, M(0.068, 0.082), M(0.052, 0.06), M(0.058, 0.07), 0, -0.035]];
  const beltY = 0.99, hemY = dress ? 0.99 : 0.99;
  const torCol = (y, th) => { let c; if (y < beltY - 0.012) c = pants; else if (y < beltY + 0.012 && !dress) c = belt; else c = shirt; if (vest && y > beltY + 0.012 && y < 1.43 && Math.abs(Math.sin(th)) > 0.18) c = vest; let k = 1; if (y < 0.9) k *= 0.82 + (y - 0.835) * 2.5; if (y > 1.44) k *= 0.92; return mul(c, k * (0.97 + 0.03 * Math.cos(th))); };
  { const ts = ringTs(TOR, [beltY - 0.012, beltY + 0.012]); const rings = ts.map((t) => { const r = prof(TOR, t); return { c: [0, t * s, r[5] * s], ru: r[1] * s, rf: r[2] * s, rb: r[3] * s, t }; });
    g.tube({ n: 16, A: [0, 1, 0], V: [0, 0, 1], rot: Math.PI / 16, rings, cap0: 0.012 * s, cap1: 0.008 * s, surf: 8,
      // erkak ko'kragi old tomondan yassiroq va kengroq (dumaloq emas): kesim superellips tomon tortiladi
      xf: mu > 0 ? (p, th, k) => { const r = rings[k], c = Math.cos(th), w = sm(1.12, 1.22, r.t) * (1 - sm(1.4, 1.47, r.t)) * mu; if (w <= 0 || c <= 0.001) return p; p[2] = r.c[2] + (p[2] - r.c[2]) * (1 + (Math.pow(c, 0.5) / c - 1) * 0.55 * w); return p; } : null,
      col: (p, th, k, r) => torCol(r.t, th),
      wt: (p, th, k, r) => { const y = r.t; if (y < 0.97) return W1(B.hips); if (y < 1.1) return WB(B.hips, B.spine, sm(0.97, 1.1, y)); if (y < 1.27) return WB(B.spine, B.chest, sm(1.1, 1.27, y)); if (y > 1.36 && Math.abs(p[0]) > 0.1 * s * shW) return WB(B.chest, p[0] > 0 ? B.clavL : B.clavR, sm(0.1 * s * shW, 0.18 * s * shW, Math.abs(p[0])) * 0.65 * sm(1.36, 1.42, y)); if (y > 1.47) return WB(B.chest, B.neck, 0.35); return W1(B.chest); } }); }
  // ---- ko'ylak etagi (ayollar: uzun ko'ylak tizzadan pastgacha) ----
  if (dress) { const D = [[0, 0.158 * hpW, 0.096, 0.1], [0.12, 0.17 * hpW, 0.11, 0.13], [0.32, 0.19, 0.135, 0.15], [0.5, 0.205, 0.15, 0.16], [0.62, 0.21, 0.155, 0.165]];
    const y0 = 0.985 * s, rings = D.map((r) => ({ c: [0, y0 - r[0] * s, -0.012 * s], ru: r[1] * s, rf: r[2] * s, rb: r[3] * s, t: r[0] }));
    g.tube({ n: 16, A: [0, -1, 0], V: [0, 0, 1], rot: Math.PI / 16, rings, surf: 8, col: (p, th, k, r) => mul(shirt, (k === rings.length - 1 ? 0.8 : 1) * (0.96 + 0.04 * Math.cos(th))),
      wt: (p, th, k, r) => { const side = Math.sin(th), lt = sm(0.05, 0.6, r.t) * Math.min(1, Math.abs(side) * 1.6) * 0.75; return lt < 0.01 ? W1(B.hips) : [side < 0 ? B.thighL : B.thighR, B.hips, lt]; } }); }
  // ---- bo'yin ----
  { const N0 = J[B.neck], H0 = J[B.head]; const nk = M(1, 1.2), rings = [[1.425, 0.066 * M(1, 1.22), 0.062, 0.062 * nk, -0.034, shirt, W1(B.chest)], [1.475, 0.054 * nk, 0.05 * M(1, 1.12), 0.053 * nk, -0.033, skinD, WB(B.chest, B.neck, 0.6)], [1.53, 0.053 * nk, 0.05 * M(1, 1.1), 0.055 * nk, -0.028, skin, W1(B.neck)], [1.585, 0.052 * M(1, 1.14), 0.047, 0.055 * M(1, 1.12), -0.022, skin, WB(B.neck, B.head, 0.5)], [1.62, 0.05, 0.04, 0.055, -0.02, skin, W1(B.head)]]
      .map((r) => ({ c: [0, r[0] * s, r[4] * s], ru: r[1] * s * (r[5] === shirt ? 1.08 : 1), rf: r[2] * s, rb: r[3] * s, col: r[5], w: r[6] }));
    g.tube({ n: 10, A: [0, 1, 0], V: [0, 0, 1], rings, surf: 11, sf: (p, th, k) => (k < 2 ? 8 : 11) }); }
  // ---- bosh ----
  const HJ = J[B.head], hp = (x, y, z) => [HJ[0] + x * s, HJ[1] + y * s, HJ[2] + z * s];
  { const HD = [[-0.06, M(0.024, 0.032), M(0.016, 0.019), 0.02, 0, 0.071], [-0.045, M(0.046, 0.054), 0.028, 0.034, 0, 0.056], [-0.026, M(0.06, 0.066), 0.046, M(0.05, 0.054), 0, 0.037], [-0.006, M(0.067, 0.07), 0.066, 0.066, 0, 0.022], [0.018, 0.072, 0.08, 0.084, 0, 0.011], [0.044, 0.076, 0.085, 0.095, 0, 0.003], [0.072, 0.078, 0.086, 0.098, 0, -0.003], [0.102, 0.074, 0.079, 0.094, 0, -0.008], [0.13, 0.062, 0.062, 0.079, 0, -0.012], [0.152, 0.04, 0.038, 0.052, 0, -0.015]];
    const fw = fem ? 0.95 : 1, rings = HD.map((r) => ({ c: hp(0, r[0], r[5]), ru: r[1] * s * fw, rf: r[2] * s * fw, rb: r[3] * s * fw, y: r[0] }));
    g.tube({ n: 16, A: [0, 1, 0], V: [0, 0, 1], rot: Math.PI / 16, rings, cap0: 0.007 * s, cap1: 0.014 * s, surf: 11,
      col: (p, th, k, r) => { const c = Math.cos(th); let col = skin; if (r.y < -0.015 && r.y > -0.05 && c > 0.5) col = mix3(skin, skinD, 0.25); if (c < -0.2 && r.y < 0.0) col = mul(skin, 0.9); return mul(col, 0.94 + 0.06 * Math.max(0, c)); }, w: W1(B.head) });
    const H = W1(B.head), ell = (x, y, z, rx, ry, rz, n, m, col, o2) => g.ell(hp(x, y, z), rx * s, ry * s, rz * s, n, m, col, H, Object.assign({ surf: 11 }, o2));
    ell(0, 0.014, 0.084, 0.0125, 0.026, 0.017, 6, 4, mul(skin, 0.97), { rx: -0.32 }); // burun
    if (mu > 0.3) ell(0, 0.0575, 0.0755, 0.047, 0.0085, 0.0105, 8, 3, mul(skin, 0.95)); // erkak: qosh ustidagi bo'rtiq (qattiqroq yuz)
    ell(0, -0.002, 0.086, 0.016, 0.006, 0.008, 6, 3, mul(skin, 0.95)); // burun ostki qanotlari
    for (const sx of [1, -1]) {
      ell(sx * 0.077 * fw, 0.028, -0.008, 0.011, 0.03, 0.019, 6, 3, mul(skin, 0.9), { ry: sx * 0.35 }); // quloq
      ell(sx * 0.031, 0.046, 0.077, 0.0125, 0.0072, 0.006, 6, 3, hexLin(0xe8e2d8), { surf: 12 }); // ko'z oqi
      ell(sx * 0.031, 0.0462, 0.0815, 0.0062, 0.0062, 0.0028, 6, 3, hexLin(0x2a1a12), { surf: 12 }); // qorachiq
      ell(sx * 0.033, 0.0625, 0.0815, 0.0195, 0.0045, 0.006, 6, 3, mul(hair, 0.8), { ry: -sx * 0.18, surf: 0 }); // qosh
    }
    ell(0, -0.0205, 0.0815, 0.021, 0.0052, 0.0065, 6, 3, lip); // lab
    if (stache) ell(0, -0.0075, 0.0855, 0.024, 0.0055, 0.0065, 6, 3, mul(hair, 0.9), { surf: 0 }); // mo'ylov
    // soch: bosh ustidagi qobiq, soch chizig'idan pastki uchlar ichkariga tortiladi (ko'rinmaydi)
    const hairY = (c) => (c > 0 ? 0.062 + 0.04 * Math.pow(c, 0.6) : 0.062 + (fem ? -0.05 : -0.068) * -c);
    g.ell(hp(0, 0.06, -0.006), 0.0855 * s * fw, 0.114 * s, 0.106 * s, 14, 8, hair, H, { rot: Math.PI / 14, surf: 0, open: true,
      sculpt: (p, th) => { const c = Math.cos(th), yl = p[1] / s + 0.06; const hy = hairY(c); if (yl < hy) { const q = (hy - 0.06) / 0.114, f = Math.sqrt(Math.max(0, 1 - q * q)) * 0.955; p[1] = (hy - 0.06) * s; p[0] = Math.sin(th) * 0.0855 * s * fw * f; p[2] = c * 0.106 * s * f; } return p; },
      col: (p, th) => mul(hair, 0.85 + 0.25 * clamp((p[1] - HJ[1]) / (0.17 * s), 0, 1)) });
    if (fem) g.ell(hp(0, -0.035, -0.062), 0.08 * s, 0.13 * s, 0.05 * s, 12, 6, mul(hair, 0.9), [B.head, B.neck, 0.75], { surf: 0, rx: 0.12 }); // uzun soch (yelkagacha)
  }
  // ---- qo'llar ----
  for (const sd of [1, -1]) {
    const L = sd > 0, bC = L ? B.clavL : B.clavR, bU = L ? B.upL : B.upR, bF = L ? B.foreL : B.foreR, bH = L ? B.handL : B.handR, bG = L ? B.fingL : B.fingR;
    const S0 = J[bU], E = J[bF], Wr = J[bH], FG = J[bG];
    const along = (a, b, t, dx = 0, dz = 0) => [a[0] + (b[0] - a[0]) * t + sd * dx * s, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t + dz * s];
    const UP = [[-0.12, 0.026, 0.03, 0.03, -0.004, 0], [-0.05, M(0.042, 0.044), M(0.046, 0.05), M(0.044, 0.048), 0, 0], [0.04, M(0.047, 0.053), M(0.05, 0.056), M(0.047, 0.054), M(0.002, 0.004), 0], [0.13, M(0.0465, 0.055), M(0.0485, 0.055), M(0.0455, 0.054), M(0.002, 0.006), 0], [0.22, M(0.046, 0.051), M(0.047, 0.054), M(0.044, 0.054), 0.002, 0], [0.45, M(0.044, 0.05), M(0.047, 0.059), M(0.043, 0.053), 0, 0.002], [0.75, M(0.039, 0.044), M(0.039, 0.049), M(0.038, 0.046), 0, 0], [0.98, M(0.036, 0.04), M(0.036, 0.04), M(0.035, 0.04), 0, 0]];
    const lenU = Math.hypot(E[0] - S0[0], E[1] - S0[1], E[2] - S0[2]), sl = sleeve * 0.98, cuff = sleeve < 0.99;
    const ts = ringTs(UP, cuff ? [sl] : []), loose = sleeve >= 0.99 ? 1.05 : M(1.07, 1.02);
    g.tube({ n: 8, A: [0, -1, 0], V: [0, 0, 1], rings: ts.map((t) => { const r = prof(UP, t), cl = t < sl + 0.001; return { c: along(S0, E, t, r[4], r[5]), ru: r[1] * s * (fem ? shW : 1) * (cl ? loose : 1), rf: r[2] * s * (cl ? loose : 1), rb: r[3] * s * (cl ? loose : 1), t }; }), cap0: 0.012 * s, surf: 8,
      sf: (p, th, k) => (ts[k] < sl + 0.001 ? 8 : 11),
      col: (p, th, k, r) => (r.t < sl + 0.001 ? mul(shirt, 0.96 + 0.05 * Math.cos(th) - (r.t < 0 ? 0.06 : 0)) : mul(skin, 0.95 + 0.05 * Math.cos(th))),
      wt: (p, th, k, r) => (r.t < 0.02 ? WB(bU, bC, 0.35 * sm(0.02, -0.14, r.t)) : r.t > 0.85 ? WB(bU, bF, sm(0.85, 1.05, r.t) * 0.5) : W1(bU)) });
    const FO = [[-0.05, M(0.036, 0.04), M(0.036, 0.04), M(0.035, 0.04)], [0.15, M(0.041, 0.05), M(0.039, 0.046), M(0.043, 0.052)], [0.45, M(0.035, 0.042), M(0.033, 0.038), M(0.034, 0.041)], [0.8, M(0.027, 0.031), M(0.023, 0.026), M(0.025, 0.029)], [1.0, M(0.025, 0.029), M(0.019, 0.022), M(0.021, 0.024)], [1.04, M(0.023, 0.027), M(0.018, 0.021), M(0.019, 0.022)]];
    const longS = sleeve >= 0.99, ts2 = ringTs(FO, longS ? [0.9] : []);
    g.tube({ n: 8, A: [0, -1, 0], V: [0, 0, 1], rings: ts2.map((t) => { const r = prof(FO, t), cl = longS && t < 0.901; return { c: along(E, Wr, t), ru: r[1] * s * (cl ? 1.15 : 1), rf: r[2] * s * (cl ? 1.2 : 1), rb: r[3] * s * (cl ? 1.2 : 1), t }; }), surf: 11,
      sf: (p, th, k) => (longS && ts2[k] < 0.901 ? 8 : 11),
      col: (p, th, k, r) => (longS && r.t < 0.901 ? mul(shirt, (r.t > 0.85 ? 0.85 : 0.94) + 0.05 * Math.cos(th)) : mul(skin, 0.94 + 0.05 * Math.cos(th))),
      wt: (p, th, k, r) => (r.t < 0.1 ? WB(bU, bF, 0.5 + 0.5 * sm(-0.05, 0.1, r.t)) : r.t > 0.85 ? WB(bF, bH, sm(0.85, 1.04, r.t) * 0.6) : W1(bF)) });
    // kaft va barmoqlar: kaft ichkariga (son tomonga) qaragan
    const hk = M(1, 1.13), hy = Wr[1], HN = [[0.004, 0.017, 0.022, 0.021], [-0.022, 0.019, 0.036, 0.034], [-0.058, 0.0175, 0.04, 0.035], [-0.08, 0.0155, 0.04, 0.033], [-0.112, 0.0135, 0.037, 0.029], [-0.148, 0.0105, 0.031, 0.023]];
    g.tube({ n: 8, A: [0, -1, 0], V: [0, 0, 1], rot: Math.PI / 8, rings: HN.map((r) => ({ c: [Wr[0] - sd * 0.002 * s, hy + r[0] * s * M(1, 1.06), Wr[2] + 0.004 * s], ru: r[1] * s * hk, rf: r[2] * s * hk, rb: r[3] * s * hk, t: r[0] })), cap1: 0.012 * s, surf: 11,
      col: (p, th, k, r) => mul(skin, (r.t < -0.09 ? 0.93 : 0.97) + 0.04 * Math.cos(th) + (Math.sin(th) * sd > 0.3 ? 0.04 : 0)),
      wt: (p, th, k, r) => (r.t > -0.06 ? W1(bH) : r.t > -0.09 ? WB(bH, bG, 0.5) : W1(bG)) });
    // bosh barmoq (old tomonda, kaftga yaqin)
    g.tube({ n: 6, A: [0, -1, 0], V: [0, 0, 1], rings: [[0, -0.012, 0.024, 0.0125], [0.5, -0.045, 0.036, 0.011], [1, -0.07, 0.044, 0.0085]].map((r) => ({ c: [Wr[0] - sd * 0.011 * s * hk, hy + r[1] * s * M(1, 1.06), Wr[2] + r[2] * s * hk], ru: r[3] * s * hk, rf: r[3] * s * hk, rb: r[3] * s * hk })), cap0: 0.004 * s, cap1: 0.008 * s, surf: 11,
      col: () => mul(skin, 0.95), wt: () => W1(bH) });
  }
  // ---- oyoqlar ----
  for (const sd of [1, -1]) {
    const L = sd > 0, bT = L ? B.thighL : B.thighR, bS = L ? B.shinL : B.shinR, bF = L ? B.footL : B.footR, bO = L ? B.toeL : B.toeR;
    const Hj = J[bT], K = J[bS], A = J[bF];
    const along = (a, b, t, dx = 0, dz = 0) => [a[0] + (b[0] - a[0]) * t + sd * dx * s, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t + dz * s];
    const tr = 1.1, TH = [[-0.1, 0.085, 0.088, 0.094, -0.008, 0], [0.0, 0.089, 0.088, 0.096, -0.004, 0], [0.2, 0.083, 0.082, 0.085, 0, 0], [0.45, 0.072, 0.07, 0.068, 0, 0], [0.75, 0.06, 0.058, 0.056, 0, 0], [0.97, 0.053, 0.054, 0.05, 0, 0]];
    g.tube({ n: 10, A: [0, -1, 0], V: [0, 0, 1], rings: TH.map((r) => ({ c: along(Hj, K, r[0], r[4], r[5]), ru: r[1] * s * (fem ? 1.04 : M(1, 1.22 - 0.08 * r[0])) + 0.006 * s, rf: r[2] * s * M(1, 1.22 - 0.1 * r[0]) + 0.006 * s, rb: r[3] * s * (fem ? 1.04 : M(1, 1.1)) + 0.006 * s, t: r[0] })), surf: 8,
      col: (p, th, k, r) => mul(pants, (r.t < 0.05 && Math.sin(th) * sd > 0 ? 0.8 : 0.94) + 0.05 * Math.cos(th)),
      wt: (p, th, k, r) => (r.t < 0.05 ? WB(bT, B.hips, (Math.sin(th) * sd > 0.2 ? 0.35 : 0.5) * sm(0.05, -0.1, r.t)) : r.t > 0.85 ? WB(bT, bS, sm(0.85, 1.05, r.t) * 0.5) : W1(bT)) });
    const SH = [[-0.05, 0.053, 0.054, 0.05, 0, 0], [0.15, 0.05, 0.047, 0.056, 0, -0.005], [0.33, 0.05, 0.044, 0.062, 0, -0.01], [0.6, 0.045, 0.042, 0.05, 0, -0.004], [0.85, 0.043, 0.042, 0.045, 0, 0], [0.97, 0.045, 0.045, 0.047, 0, 0]];
    g.tube({ n: 10, A: [0, -1, 0], V: [0, 0, 1], rings: SH.map((r) => ({ c: along(K, A, r[0], r[4], r[5]), ru: r[1] * s * M(1, r[0] < 0.6 ? 1.1 : 1.04), rf: r[2] * s * M(1, 1.04), rb: r[3] * s * M(1, r[0] > 0.05 && r[0] < 0.6 ? 1.16 : 1.05), t: r[0] })), surf: 8,
      col: (p, th, k, r) => mul(pants, (r.t > 0.9 ? 0.8 : 0.92) + 0.05 * Math.cos(th)),
      wt: (p, th, k, r) => (r.t < 0.1 ? WB(bT, bS, 0.5 + 0.5 * sm(-0.05, 0.1, r.t)) : r.t > 0.9 ? WB(bS, bF, 0.25) : W1(bS)) });
    // poyabzal (tovondan uchigacha, taglik alohida rangda)
    const SO = [[-0.072, 0.048, 0.036, 0.036, 0.044], [-0.045, 0.055, 0.044, 0.05, 0.052], [0.01, 0.05, 0.046, 0.042, 0.048], [0.07, 0.04, 0.05, 0.03, 0.038], [0.13, 0.032, 0.05, 0.022, 0.03], [0.175, 0.03, 0.046, 0.018, 0.028], [0.205, 0.028, 0.036, 0.014, 0.024]];
    g.tube({ n: 10, A: [0, 0, 1], V: [0, 1, 0], rings: SO.map((r) => ({ c: [A[0], r[1] * s, A[2] + r[0] * s], ru: r[2] * s, rf: r[3] * s, rb: r[4] * s, t: r[0] })), cap0: 0.009 * s, cap1: 0.015 * s, surf: 6,
      xf: (p) => p, col: (p, th, k, r) => (Math.cos(th) < -0.5 ? sole : mul(shoe, 0.9 + 0.2 * Math.max(0, Math.cos(th)))),
      wt: (p, th, k, r) => (r.t < 0.1 ? W1(bF) : r.t < 0.15 ? WB(bF, bO, 0.5) : W1(bO)) });
  }
  // ---- skelet va teri ----
  const bones = BONES.map((b, i) => { const x = new THREE.Bone(); x.name = b[0]; const p = J[i], pp = b[1] >= 0 ? J[b[1]] : [0, 0, 0]; x.position.set(p[0] - pp[0], p[1] - pp[1], p[2] - pp[2]); return x; });
  BONES.forEach((b, i) => { if (b[1] >= 0) bones[b[1]].add(bones[i]); });
  const root = new THREE.Group(); root.add(bones[0]);
  const mesh = new THREE.SkinnedMesh(g.build(), MAT.flat); mesh.castShadow = true; mesh.receiveShadow = false; // o'z soyasidan dog' (acne) tushmasin
  mesh.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.9 * s, 0), 1.45 * s); mesh.boundingBox = new THREE.Box3(new THREE.Vector3(-1.2, -0.6, -1.2), new THREE.Vector3(1.2, 2.4, 1.2));
  root.add(mesh); root.updateMatrixWorld(true); mesh.bind(new THREE.Skeleton(bones));
  const hatG = new THREE.Group(); bones[B.head].add(hatG);
  const tool = new THREE.Group(); tool.position.set(0, -0.072 * s * M(1, 1.06), 0.006 * s); bones[B.handR].add(tool); // o'ng qo'ldagi asbob (musht markazi)
  const toolC = new THREE.Group(); bones[B.chest].add(toolC); // ko'krakka suyalgan asbob (dutor)
  const bn = (i) => bones[i];
  const rig = { root, body: bn(B.body), hips: bn(B.hips), torso: bn(B.spine), chest: bn(B.chest), neck: bn(B.neck), head: bn(B.head),
    aL: { clav: bn(B.clavL), up: bn(B.upL), fore: bn(B.foreL), hand: bn(B.handL) }, aR: { clav: bn(B.clavR), up: bn(B.upR), fore: bn(B.foreR), hand: bn(B.handR) },
    lL: { up: bn(B.thighL), shin: bn(B.shinL), foot: bn(B.footL) }, lR: { up: bn(B.thighR), shin: bn(B.shinR), foot: bn(B.footR) },
    hatG, tool, toolC, mesh, bones, J, s, fem, mu, seed, ph: 0, anim: 'idle', t: 0, hat: null, toolName: null, blend: 0 };
  initAnim(rig);
  return rig;
}
// Teri sheyderini yuklanishda tayyorlab qo'yish: bir necha kadr chiziladigan ko'rinmas (nol yuzali) skinned mesh — birinchi odam ko'ringanda qotib qolmasin
export function warmSkin(scene) {
  if (keeper) return keeper; const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute([0, -500, 0, 0, -500, 0, 0, -500, 0], 3)); geo.setAttribute('normal', new THREE.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0], 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute([1, 1, 1, 1, 1, 1, 1, 1, 1], 3));
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], 4)); geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0], 4));
  const bone = new THREE.Bone(), m = new THREE.SkinnedMesh(geo, MAT.flat); m.add(bone); m.bind(new THREE.Skeleton([bone])); m.frustumCulled = false; m.castShadow = true; m.receiveShadow = true;
  let n = 0; m.onAfterRender = () => { if (++n > 12) m.visible = false; }; scene.add(m); keeper = m; return m;
}
export function setHat(rig, id) {
  if (rig.hat === id) return; rig.hat = id; while (rig.hatG.children.length) rig.hatG.remove(rig.hatG.children[0]);
  if (!id || !HATS[id]) return; const g = new GB(77); g.jit = 0.02; HATS[id](g); const m = new THREE.Mesh(g.build(), MAT.flat); m.castShadow = true;
  const f = HAT_FIT[id], s = rig.s * (rig.fem ? 0.95 : 1); m.scale.setScalar(f[0] * s); m.position.set(0, f[1] * rig.s, f[2] * rig.s); rig.hatG.add(m);
}
const TOOLS = {
  rod: (g) => { g.color(0x8a5a36); g.push().rotX(1.15); g.cyl(5, 0.018, 0.008, -0.25, 2.3); g.pop(); g.color(0x2a2c33).box(0, 0.08, 0.14, 0.05, 0.07, 0.07); },
  shovel: (g) => { g.color(0x9a6a42); g.push().rotX(1.9); g.cyl(5, 0.022, 0.022, -0.3, 0.9); g.pop(); g.color(0xb9bec8); g.push().rotX(1.9).translate(0, 1.02, 0); g.box(0, 0, 0, 0.2, 0.3, 0.03, { tx: 0.7 }); g.pop(); },
  pick: (g) => { g.color(0x9a6a42); g.push().rotX(1.2); g.cyl(5, 0.024, 0.024, -0.2, 0.75); g.pop(); g.color(0x6a6e78); g.push().rotX(1.2).translate(0, 0.75, 0); g.box(0, 0, 0, 0.05, 0.06, 0.62, { tz: 0.2 }); g.pop(); },
  dutor: (g) => { g.color(0xb98a5c); g.blob(0.105, 1, { sy: 1.35, sz: 0.62, cy: -0.07 }); g.color(0xe2cfa8).blob(0.085, 0, { sy: 1.25, sz: 0.2, cy: -0.07, cz: 0.05 }); g.color(0x6e4a30).cyl(6, 0.017, 0.013, 0.02, 1.0); g.color(0x5a3a26).box(0, 1.02, 0, 0.035, 0.09, 0.03); for (const y of [0.25, 0.4, 0.55, 0.7]) g.color(0x2a1f18).cyl(6, 0.0185, 0.0185, y, y + 0.006); }, // dutor: nok shaklidagi kosa, uzun dasta, pardalar
  net: (g) => { g.color(0x9a6a42); g.push().rotX(1.3); g.cyl(5, 0.015, 0.015, 0, 1.0); g.pop(); },
};
// Asbob o'qi (qo'l koordinatasida): ikkinchi qo'l shu chiziq bo'ylab ushlaydi — [yo'nalish burchagi rotX, ikkinchi qo'l masofasi]
export const TOOL_GRIP = { rod: [1.15, -0.2], shovel: [1.9, -0.32], pick: [1.2, -0.16], net: [1.3, 0.3] };
rigEnv({ grips: TOOL_GRIP });
export function setTool(rig, id) {
  if (rig.toolName === id) return; rig.toolName = id; rig.tool.rotation.x = 0; for (const G of [rig.tool, rig.toolC]) while (G.children.length) G.remove(G.children[0]);
  if (!id || !TOOLS[id]) return; const g = new GB(88); g.jit = 0.02; TOOLS[id](g); const m = new THREE.Mesh(g.build(), MAT.flat); m.castShadow = true;
  if (id === 'dutor') { // dutor ko'krakka qiya suyalgan: kosasi qorinning o'ng tomonida, dastasi chapga-yuqoriga; qo'llar IK bilan dastaga va kosaga
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0.74, 0.6, 0.3).normalize()); m.position.set(-0.06 * rig.s, -0.19 * rig.s, 0.15 * rig.s); m.updateMatrix(); rig.toolC.add(m); rig.dutorM = m;
  } else rig.tool.add(m);
  rig.tool.rotation.x = id === 'shovel' ? 0.6 : 0; // kurak pastga-oldinga qaraydi (qazish)
}
export function poseRig(rig, anim, dt, speed = 0, ctl) { animate(rig, anim, dt, speed, ctl); }
// Transportdagi haydovchi (velosiped, skuter, mototsikl...): vehicles.js B.rider ma'lumotidan to'liq odam; har kadr poseRider bilan pedal/rulga moslanadi
export function makeRider(o) {
  const rig = makeRig({ shirt: o.shirt || 0x2f7fd0, pants: o.pants || 0x3a3f4c, seed: 4242, sleeve: 1, stache: false, height: 1, build: 1 });
  rig.root.position.set(0, o.hip[1] - rig.J[B.body][1], o.hip[2]);
  if (o.helmet) { const g = new GB(555); g.jit = 0.02; g.color(o.helmet).blob(0.122, 1, { cy: 0.085, sy: 0.92, sz: 1.12 }); g.color(0x15161a).box(0, 0.055, 0.1, 0.17, 0.06, 0.05); const m = new THREE.Mesh(g.build(), MAT.flat); m.castShadow = true; m.scale.setScalar(rig.s); rig.hatG.add(m); }
  rig.isRider = true; rig.riderData = o; poseRiderAnim(rig, o, null, 0); return rig;
}
export function poseRider(rig, crank, steer, bob) { poseRiderAnim(rig, rig.riderData, crank, steer, bob); }
export { rigEnv };
