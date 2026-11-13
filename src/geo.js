// Low-poly geometriya quruvchisi: yassi yuzli, vertex rangli uchburchaklar
import * as THREE from 'three';
import { mulberry32, hexLin } from './util.js';

const ICO_V = (() => {
  const t = (1 + Math.sqrt(5)) / 2;
  const v = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]];
  return v.map((p) => { const l = Math.hypot(p[0], p[1], p[2]); return [p[0] / l, p[1] / l, p[2] / l]; });
})();
const ICO_F = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];

// Bo'lingan ikosfera (silliq shakllar uchun): detail 1 -> 80 yuz, 2 -> 320 yuz
function subdiv(V, F) {
  const v = V.map((p) => p.slice()), f = [], cache = new Map();
  const mid = (a, b) => { const k = a < b ? a * 4096 + b : b * 4096 + a; let i = cache.get(k); if (i !== undefined) return i; const p = [(v[a][0] + v[b][0]) / 2, (v[a][1] + v[b][1]) / 2, (v[a][2] + v[b][2]) / 2]; const l = Math.hypot(p[0], p[1], p[2]); v.push([p[0] / l, p[1] / l, p[2] / l]); i = v.length - 1; cache.set(k, i); return i; };
  for (const t of F) { const a = mid(t[0], t[1]), b = mid(t[1], t[2]), c = mid(t[2], t[0]); f.push([t[0], a, c], [t[1], b, a], [t[2], c, b], [a, b, c]); }
  return { v, f };
}
const SPH = [{ v: ICO_V, f: ICO_F }];
SPH.push(subdiv(SPH[0].v, SPH[0].f)); SPH.push(subdiv(SPH[1].v, SPH[1].f));

export class GB {
  constructor(seed = 1) {
    this.p = []; this.c = []; this.n = []; this.k = []; this.mk = 0; this.hasMask = false;
    this.m = [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0]; // 3x3 + ko'chirish
    this.stack = [];
    this.col = [1, 1, 1];
    this.jit = 0.05;
    this.rng = mulberry32(seed);
    this.flip = false;
    this._k = 1;
  }
  color(hex) { this.col = hexLin(hex); return this; }
  colorLin(c) { this.col = c; return this; }
  push() { this.stack.push(this.m.slice(), this.flip); return this; }
  pop() { this.flip = this.stack.pop(); this.m = this.stack.pop(); return this; }
  reset() { this.m = [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0]; this.flip = false; this.stack.length = 0; return this; }
  translate(x, y, z) { const m = this.m; m[9] += m[0] * x + m[1] * y + m[2] * z; m[10] += m[3] * x + m[4] * y + m[5] * z; m[11] += m[6] * x + m[7] * y + m[8] * z; return this; }
  _mul(a, b, c, d, e, f, g, h, i) {
    const m = this.m;
    const n0 = m[0] * a + m[1] * d + m[2] * g, n1 = m[0] * b + m[1] * e + m[2] * h, n2 = m[0] * c + m[1] * f + m[2] * i;
    const n3 = m[3] * a + m[4] * d + m[5] * g, n4 = m[3] * b + m[4] * e + m[5] * h, n5 = m[3] * c + m[4] * f + m[5] * i;
    const n6 = m[6] * a + m[7] * d + m[8] * g, n7 = m[6] * b + m[7] * e + m[8] * h, n8 = m[6] * c + m[7] * f + m[8] * i;
    m[0] = n0; m[1] = n1; m[2] = n2; m[3] = n3; m[4] = n4; m[5] = n5; m[6] = n6; m[7] = n7; m[8] = n8;
    return this;
  }
  rotY(a) { const c = Math.cos(a), s = Math.sin(a); return this._mul(c, 0, s, 0, 1, 0, -s, 0, c); }
  rotX(a) { const c = Math.cos(a), s = Math.sin(a); return this._mul(1, 0, 0, 0, c, -s, 0, s, c); }
  rotZ(a) { const c = Math.cos(a), s = Math.sin(a); return this._mul(c, -s, 0, s, c, 0, 0, 0, 1); }
  scale(x, y = x, z = x) { if (x * y * z < 0) this.flip = !this.flip; return this._mul(x, 0, 0, 0, y, 0, 0, 0, z); }
  _v(x, y, z) { const m = this.m; this.p.push(m[0] * x + m[1] * y + m[2] * z + m[9], m[3] * x + m[4] * y + m[5] * z + m[10], m[6] * x + m[7] * y + m[8] * z + m[11]); }
  _col(k) { const c = this.col; this.c.push(c[0] * k, c[1] * k, c[2] * k); this.k.push(this.mk); }
  // mask=1: nusxa rangi (instanceColor) shu uchlarga ta'sir qiladi (barglar), 0: ta'sir qilmaydi (tana)
  mask(v) { this.mk = v; if (v) this.hasMask = true; return this; }
  newFace() { this._k = 1 + (this.rng() - 0.5) * 2 * this.jit; return this; }
  // a,b,c: [x,y,z] — tashqaridan qaraganda soat miliga teskari
  tri(a, b, c, keep) {
    if (!keep) this.newFace();
    const k = this._k;
    if (this.flip) { this._v(a[0], a[1], a[2]); this._v(c[0], c[1], c[2]); this._v(b[0], b[1], b[2]); }
    else { this._v(a[0], a[1], a[2]); this._v(b[0], b[1], b[2]); this._v(c[0], c[1], c[2]); }
    this._col(k); this._col(k); this._col(k);
    this.n.push(NaN, 0, 0, NaN, 0, 0, NaN, 0, 0);
    return this;
  }
  _nrm(n) { const m = this.m; const x = m[0] * n[0] + m[1] * n[1] + m[2] * n[2], y = m[3] * n[0] + m[4] * n[1] + m[5] * n[2], z = m[6] * n[0] + m[7] * n[1] + m[8] * n[2]; const l = Math.hypot(x, y, z) || 1; this.n.push(x / l, y / l, z / l); }
  // Silliq uchburchak: aniq normal va har uch uchun rang ko'paytuvchisi
  triS(a, b, c, na, nb, nc, ka = 1, kb = 1, kc = 1) {
    if (this.flip) { this._v(a[0], a[1], a[2]); this._v(c[0], c[1], c[2]); this._v(b[0], b[1], b[2]); this._col(ka); this._col(kc); this._col(kb); this._nrm(na); this._nrm(nc); this._nrm(nb); }
    else { this._v(a[0], a[1], a[2]); this._v(b[0], b[1], b[2]); this._v(c[0], c[1], c[2]); this._col(ka); this._col(kb); this._col(kc); this._nrm(na); this._nrm(nb); this._nrm(nc); }
    return this;
  }
  // Silliq shar/blob: o.sx,sy,sz (siqish), o.cx,cy,cz (markaz), o.jitter (yumshoq notekislik), o.shade (tepa yorug', past qorong'i)
  blob(r, detail = 1, o = {}) {
    const S = SPH[detail], sx = o.sx || 1, sy = o.sy || 1, sz = o.sz || 1, cx = o.cx || 0, cy = o.cy || 0, cz = o.cz || 0, j = o.jitter || 0, sh = o.shade == null ? 0.16 : o.shade;
    const p1 = this.rng() * 6.28, p2 = this.rng() * 6.28, p3 = this.rng() * 6.28, fq = o.freq || 2.6;
    const P = [], Nn = [], K = [];
    for (const u of S.v) {
      const d = r * (1 + j * (Math.sin(u[0] * fq + p1) * Math.sin(u[1] * fq + p2) + Math.sin(u[2] * fq * 1.3 + p3) * 0.6));
      P.push([cx + u[0] * d * sx, cy + u[1] * d * sy, cz + u[2] * d * sz]);
      const n = [u[0] / sx, u[1] / sy, u[2] / sz]; Nn.push(n);
      K.push(1 + sh * u[1] + (o.spot ? o.spot * Math.sin(u[0] * 7 + p2) * Math.sin(u[2] * 7 + p1) : 0));
    }
    for (const f of S.f) this.triS(P[f[0]], P[f[1]], P[f[2]], Nn[f[0]], Nn[f[1]], Nn[f[2]], K[f[0]], K[f[1]], K[f[2]]);
    return this;
  }
  // Silliq silindr/konus (Y o'qi). o.shade: tepa-past gradiyent, o.cap: tepasini yopish
  cyl(n, r0, r1, y0, y1, o = {}) {
    const sl = (r0 - r1) / (y1 - y0), sh = o.shade || 0, rot = o.rot || 0;
    const kb = 1 - sh, kt = 1 + sh;
    for (let i = 0; i < n; i++) {
      const t0 = rot + (i / n) * Math.PI * 2, t1 = rot + ((i + 1) / n) * Math.PI * 2;
      const s0 = Math.sin(t0), c0 = Math.cos(t0), s1 = Math.sin(t1), c1 = Math.cos(t1);
      const n0 = [s0, sl, c0], n1 = [s1, sl, c1];
      const b0 = [s0 * r0, y0, c0 * r0], b1 = [s1 * r0, y0, c1 * r0], u0 = [s0 * r1, y1, c0 * r1], u1 = [s1 * r1, y1, c1 * r1];
      if (r1 < 1e-4) { const nm = [(s0 + s1) / 2, sl, (c0 + c1) / 2]; this.triS(b0, b1, [0, y1, 0], n0, n1, nm, kb, kb, kt); }
      else { this.triS(b0, b1, u1, n0, n1, n1, kb, kb, kt); this.triS(b0, u1, u0, n0, n1, n0, kb, kt, kt); }
    }
    if (o.cap && r1 > 1e-4) { const up = [0, 1, 0]; for (let i = 1; i < n - 1; i++) { const a = [0, y1, r1 * 1], t1 = rot + (i / n) * Math.PI * 2, t2 = rot + ((i + 1) / n) * Math.PI * 2; this.triS([Math.sin(rot) * r1, y1, Math.cos(rot) * r1], [Math.sin(t1) * r1, y1, Math.cos(t1) * r1], [Math.sin(t2) * r1, y1, Math.cos(t2) * r1], up, up, up, kt, kt, kt); } }
    return this;
  }
  quad(a, b, c, d) { this.newFace(); this.tri(a, b, c, true); this.tri(a, c, d, true); return this; }
  // Quti: markaz (x,y,z), o'lcham (sx,sy,sz). opts.tx/tz: tepa yuz torayishi, opts.ox/oz: tepa siljishi
  box(x, y, z, sx, sy, sz, o) {
    const hx = sx / 2, hy = sy / 2, hz = sz / 2;
    const tx = o && o.tx != null ? o.tx : 1, tz = o && o.tz != null ? o.tz : 1, ox = (o && o.ox) || 0, oz = (o && o.oz) || 0;
    const A = [x - hx, y - hy, z - hz], B = [x + hx, y - hy, z - hz], Cc = [x + hx, y - hy, z + hz], D = [x - hx, y - hy, z + hz];
    const E = [x - hx * tx + ox, y + hy, z - hz * tz + oz], F = [x + hx * tx + ox, y + hy, z - hz * tz + oz], G = [x + hx * tx + ox, y + hy, z + hz * tz + oz], H = [x - hx * tx + ox, y + hy, z + hz * tz + oz];
    this.quad(E, H, G, F); // tepa
    if (!(o && o.noBottom)) this.quad(A, B, Cc, D); // past
    this.quad(D, Cc, G, H); // +z
    this.quad(B, A, E, F); // -z
    this.quad(Cc, B, F, G); // +x
    this.quad(A, D, H, E); // -x
    return this;
  }
  // Y o'qi bo'ylab n-burchakli prizma/konus
  prism(n, r0, r1, y0, y1, o) {
    const rot = (o && o.rot) || 0;
    const capB = !(o && o.noBottom), capT = !(o && o.noTop);
    const ring = (r, y) => { const a = []; for (let i = 0; i < n; i++) { const t = rot + (i / n) * Math.PI * 2; a.push([Math.sin(t) * r, y, Math.cos(t) * r]); } return a; };
    const b = ring(r0, y0), t = ring(r1, y1);
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      if (r1 < 1e-4) this.tri(b[i], b[j], [0, y1, 0]);
      else if (r0 < 1e-4) this.tri([0, y0, 0], t[j], t[i]);
      else this.quad(b[i], b[j], t[j], t[i]);
    }
    if (capT && r1 > 1e-4) { this.newFace(); for (let i = 1; i < n - 1; i++) this.tri(t[0], t[i], t[i + 1], true); }
    if (capB && r0 > 1e-4) { this.newFace(); for (let i = 1; i < n - 1; i++) this.tri(b[0], b[i + 1], b[i], true); }
    return this;
  }
  // Z o'qi bo'ylab silindr (g'ildirak, quvur): markaz (0,0,0)
  prismZ(n, r, len, o) { this.push(); this.rotX(Math.PI / 2); this.prism(n, r, (o && o.r1) != null ? o.r1 : r, -len / 2, len / 2, o); this.pop(); return this; }
  prismX(n, r, len, o) { this.push(); this.rotZ(-Math.PI / 2); this.prism(n, r, (o && o.r1) != null ? o.r1 : r, -len / 2, len / 2, o); this.pop(); return this; }
  // Deformatsiyalangan ikosaedr (daraxt toji, tosh, bulut)
  ico(r, jitter = 0.15, sy = 1, cx = 0, cy = 0, cz = 0, sx = 1, sz = 1) {
    const rg = this.rng;
    const v = ICO_V.map((p) => { const k = r * (1 + (rg() - 0.5) * 2 * jitter); return [cx + p[0] * k * sx, cy + p[1] * k * sy, cz + p[2] * k * sz]; });
    for (const f of ICO_F) this.tri(v[f[0]], v[f[1]], v[f[2]]);
    return this;
  }
  // Ikki qiyalikli tom: asos (w x d) markazda, balandlik h, y0 dan. Qirra Z bo'ylab. over: bo'g'ot chiqishi
  gable(w, d, h, y0, over = 0.3) {
    const hw = w / 2 + over, hd = d / 2 + over;
    const A = [-hw, y0, -hd], B = [hw, y0, -hd], Cc = [hw, y0, hd], D = [-hw, y0, hd], R0 = [0, y0 + h, -hd], R1 = [0, y0 + h, hd];
    this.quad(D, R1, R0, A); this.quad(B, R0, R1, Cc);
    this.tri(A, R0, B); this.tri(Cc, R1, D);
    this.quad(A, B, Cc, D);
    return this;
  }
  // To'rt qiyalikli tom (piramida/kesik)
  hip(w, d, h, y0, over = 0.3, top = 0) {
    const hw = w / 2 + over, hd = d / 2 + over, tw = (w / 2) * top, td = (d / 2) * top;
    this.box(0, y0 + h / 2, 0, hw * 2, h, hd * 2, { tx: top ? tw / hw : 0.001, tz: top ? td / hd : 0.001 });
    return this;
  }
  get count() { return this.p.length / 9; }
  build() {
    const pos = new Float32Array(this.p), col = new Float32Array(this.c), nor = new Float32Array(pos.length);
    for (let i = 0; i < pos.length; i += 9) {
      const ax = pos[i], ay = pos[i + 1], az = pos[i + 2];
      const ux = pos[i + 3] - ax, uy = pos[i + 4] - ay, uz = pos[i + 5] - az, vx = pos[i + 6] - ax, vy = pos[i + 7] - ay, vz = pos[i + 8] - az;
      const sn = this.n;
      if (sn[i] === sn[i]) { for (let k = 0; k < 9; k++) nor[i + k] = sn[i + k]; continue; }
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
      for (let k = 0; k < 9; k += 3) { nor[i + k] = nx; nor[i + k + 1] = ny; nor[i + k + 2] = nz; }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    if (this.hasMask) g.setAttribute('aMask', new THREE.BufferAttribute(new Float32Array(this.k), 1));
    g.computeBoundingSphere(); g.computeBoundingBox();
    return g;
  }
}

export const MAT = {};
export const WIND = { value: 0 }; // shamol vaqti (o't va daraxtlar tebranishi uchun umumiy uniform)
export function initMaterials() {
  MAT.flat = new THREE.MeshLambertMaterial({ vertexColors: true });
  MAT.terrain = new THREE.MeshLambertMaterial({ vertexColors: true });
  // Nusxali o'simliklar: instanceColor faqat aMask=1 uchlarga (barg) qo'llanadi
  MAT.tree = new THREE.MeshLambertMaterial({ vertexColors: true });
  MAT.tree.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = WIND;
    sh.vertexShader = 'attribute float aMask;\nuniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      #ifdef USE_INSTANCING
        float swT = max(0.0, position.y - 1.2) * aMask; vec4 wpT = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
        transformed.x += sin(uTime * 1.3 + wpT.x * 0.13 + wpT.z * 0.11 + position.y * 0.5) * 0.024 * swT;
        transformed.z += cos(uTime * 1.1 + wpT.x * 0.09 - wpT.z * 0.14 + position.y * 0.4) * 0.02 * swT;
      #endif`).replace('#include <color_vertex>', `
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
      #endif`);
  };
  MAT.flatDS = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  MAT.glass = new THREE.MeshStandardMaterial({ vertexColors: true, color: 0x16222e, metalness: 0.85, roughness: 0.12, envMapIntensity: 1.5 });
  MAT.glow = new THREE.MeshBasicMaterial({ vertexColors: true, fog: true }); // derazalar, chiroqlar (tunda yonadi)
  MAT.unlit = new THREE.MeshBasicMaterial({ vertexColors: true, fog: true });
  return MAT;
}
