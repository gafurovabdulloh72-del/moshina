// Hayotiy mayda detallar: yo'l belgilari, ustunlar va simlar, chiroqlar, qishloq jihozlari, mo'ri tutuni, hilpiragan bayroq va kirlar, suv
import * as THREE from 'three';
import * as T from './terrain.js';
import { GB, MAT, WIND } from './geo.js';
import * as COL from './colliders.js';
import * as BK from './blocks.js';
import { mulberry32, clamp, lerp, smoothstep } from './util.js';
const { PAL } = BK;

// umumiy (tun, soat) uniformlari — har kadr sahna chizilishidan oldin yangilanadi
export const DU = { uNight: { value: 0 }, uHour: { value: 12 } };
// asosiy shamol yo'nalishi (bayroqlar, tutun, kirlar shu tomonga): g'arbdan sharqqa, biroz shimolga
export const WINDDIR = (() => { const a = 0.32; return [Math.cos(a), -Math.sin(a)]; })();

// Yorug' qismlar materiali: MAT.glow bilan bir rang (main.js har kadr o'zgartiradi), lekin aMask bo'yicha:
// aMask 1..2 — deraza (har biri o'z vaqtida yonadi/o'chadi, iliq ranglar har xil, kunduzi shisha), aMask -1 — yo'l nur qaytargichi (faraga qarab yaltiraydi)
let GLOW = null;
export function glowMat() {
  if (GLOW) return GLOW;
  const m = (GLOW = new THREE.MeshBasicMaterial({ vertexColors: true, fog: true })); m.color = MAT.glow.color;
  const prev = m.onBeforeCompile;
  m.onBeforeCompile = (sh, r) => {
    if (prev) prev.call(m, sh, r);
    sh.uniforms.uNight = DU.uNight; sh.uniforms.uHour = DU.uHour; sh.uniforms.uTimeD = WIND;
    sh.vertexShader = 'attribute float aMask;\nvarying float vMk;\nvarying float vGl;\nuniform float uNight;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
vMk = aMask; vGl = 0.0;
if (aMask < -0.5) { vec4 wq = modelMatrix * vec4(position, 1.0); vec3 Vd = cameraPosition - wq.xyz; float dd = max(length(Vd), 0.01); vec3 nW = normalize(mat3(modelMatrix) * normal); vGl = uNight * pow(max(dot(nW, Vd / dd), 0.0), 3.0) * (1.0 - smoothstep(20.0, 230.0, dd)); }
`);
    sh.fragmentShader = 'varying float vMk;\nvarying float vGl;\nuniform float uNight;\nuniform float uHour;\nuniform float uTimeD;\n' + sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
if (vMk > 0.5) {
  float id = vMk - 1.0, per = 45.0 + id * 150.0, slot = floor((uTimeD + id * 977.0) / per);
  float rr = fract(sin(id * 91.7 + slot * 13.37) * 43758.55);
  float hh = uHour < 6.0 ? uHour + 24.0 : uHour;
  float pOn = 0.25 + 0.5 * smoothstep(16.5, 19.5, hh) - 0.6 * smoothstep(22.5, 26.0, hh) + 0.32 * smoothstep(28.6, 29.6, hh);
  float on = step(rr, pOn), cc = fract(id * 7.31);
  vec3 lc = cc < 0.5 ? vec3(1.0, 0.7, 0.36) : cc < 0.78 ? vec3(1.0, 0.83, 0.57) : cc < 0.92 ? vec3(1.0, 0.55, 0.24) : vec3(0.55, 0.68, 1.0);
  float fl = cc > 0.92 ? 0.75 + 0.25 * sin(uTimeD * 7.0 + id * 40.0) * sin(uTimeD * 2.3 + id * 9.0) : 1.0;
  diffuseColor.rgb = vec3(0.05, 0.065, 0.085) * (1.0 - uNight * 0.75) + lc * on * fl * uNight * (1.5 + id * 0.6);
} else if (vMk < -0.5) diffuseColor.rgb = vColor * (0.5 + 10.0 * vGl);
`);
  };
  m.customProgramCacheKey = () => 'safar-glow-deraza-1' + (prev ? prev.toString().length : '');
  return m;
}
// geometriyada aMask bo'lmasa — nollar bilan qo'shib qo'yamiz (atribut joyi boshqa dastur qiymatini olmasin)
export function withMask(geo) { if (!geo.attributes.aMask) geo.setAttribute('aMask', new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count), 1)); return geo; }

// Mato (bayroq, kir): to'r tekislik, chap-yuqori burchak — mahkamlangan nuqta. aW — tebranish og'irligi, aU — to'lqin fazasi, aF — 1 bayroq / 0 kir
const clothGeo = (flag) => {
  const NX = flag ? 8 : 4, NY = flag ? 3 : 4, P = [], W = [], U = [], F = [], I = [];
  for (let j = 0; j <= NY; j++) for (let i = 0; i <= NX; i++) { const x = i / NX, y = -j / NY; P.push(x, y, 0); W.push(flag ? x : -y); U.push(x); F.push(flag ? 1 : 0); }
  for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) { const a = j * (NX + 1) + i, b = a + 1, c = a + NX + 1, d = c + 1; I.push(a, c, b, b, c, d); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(new Array(P.length).fill(0).map((_, k) => (k % 3 === 2 ? 1 : 0)), 3));
  g.setAttribute('aW', new THREE.Float32BufferAttribute(W, 1)); g.setAttribute('aU', new THREE.Float32BufferAttribute(U, 1)); g.setAttribute('aF', new THREE.Float32BufferAttribute(F, 1)); g.setIndex(I); return g;
};
let CLOTH = null;
const clothMat = () => {
  if (CLOTH) return CLOTH;
  const m = (CLOTH = new THREE.MeshLambertMaterial({ side: THREE.DoubleSide }));
  const prev = m.onBeforeCompile;
  m.onBeforeCompile = (sh, r) => {
    if (prev) prev.call(m, sh, r);
    sh.uniforms.uTimeC = WIND;
    sh.vertexShader = 'attribute float aW;\nattribute float aU;\nattribute float aF;\nuniform float uTimeC;\n' + sh.vertexShader.replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
float ipC = 0.0, wzC = 0.0, dzC = 0.0;
#ifdef USE_INSTANCING
ipC = instanceMatrix[3].x * 0.37 + instanceMatrix[3].z * 0.23;
#endif
float gC = 0.62 + 0.38 * sin(uTimeC * 0.41 + ipC) * sin(uTimeC * 0.17 + ipC * 0.5);
if (aF > 0.5) {
  float a1 = uTimeC * (6.0 + 3.0 * gC) - aU * 7.0 + ipC, a2 = uTimeC * 10.7 - aU * 11.0 + ipC * 1.7;
  wzC = aW * (0.15 * sin(a1) + 0.06 * sin(a2)) * (0.5 + gC);
  dzC = (aW * (-1.05 * cos(a1) - 0.66 * cos(a2)) + (0.15 * sin(a1) + 0.06 * sin(a2))) * (0.5 + gC);
} else {
  float a1 = uTimeC * 1.9 + ipC + aU * 0.9;
  wzC = aW * aW * (0.16 + 0.1 * gC) * sin(a1) + aW * 0.05 * sin(uTimeC * 5.3 + aU * 6.0 + ipC);
  dzC = aW * 0.3 * cos(uTimeC * 5.3 + aU * 6.0 + ipC);
}
objectNormal = normalize(vec3(-dzC, 0.0, 1.0));
`).replace('#include <begin_vertex>', `#include <begin_vertex>
transformed.z += wzC;
if (aF > 0.5) transformed.y -= aW * 0.07 * (1.0 - gC);
`);
  };
  m.customProgramCacheKey = () => 'safar-mato-1' + (prev ? prev.toString().length : '');
  return m;
};

// Hovuz/favvora suvi: kichik to'lqinlanadigan tekislik (osmon aksi scene.environment orqali)
let WATER = null;
export function waterSurface(w, d, round = false) {
  if (!WATER) {
    const m = (WATER = new THREE.MeshStandardMaterial({ color: 0x2f8fb8, roughness: 0.06, metalness: 0.0, transparent: true, opacity: 0.82, envMapIntensity: 1.3 }));
    const prev = m.onBeforeCompile;
    m.onBeforeCompile = (sh, r) => {
      if (prev) prev.call(m, sh, r);
      sh.uniforms.uTimeW = WIND;
      sh.vertexShader = 'uniform float uTimeW;\n' + sh.vertexShader.replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
vec4 wpW = modelMatrix * vec4(position, 1.0);
float wa = wpW.x * 2.1 + uTimeW * 2.3, wb = wpW.z * 2.7 - uTimeW * 1.9, wc = (wpW.x + wpW.z) * 3.9 + uTimeW * 3.1;
objectNormal = normalize(vec3(-(0.022 * cos(wa) * 2.1 + 0.012 * cos(wc) * 3.9), 1.0, -(0.018 * cos(wb) * 2.7 + 0.012 * cos(wc) * 3.9)));
`).replace('#include <begin_vertex>', `#include <begin_vertex>
transformed.y += 0.022 * sin(wa) + 0.018 * sin(wb) + 0.012 * sin(wc);
`);
    };
    m.customProgramCacheKey = () => 'safar-hovuz-1' + (prev ? prev.toString().length : '');
  }
  const geo = round ? new THREE.CircleGeometry(w, 24).rotateX(-Math.PI / 2) : new THREE.PlaneGeometry(w, d, 10, 12).rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(geo, WATER); mesh.receiveShadow = true; return mesh;
}

// ======================= MATN ATLASI (yo'l belgilari) =======================
const atlas = () => {
  const S = 2048, cv = document.createElement('canvas'); cv.width = S; cv.height = S; const cx = cv.getContext('2d');
  let sx = 0, sy = 0, rowH = 0; const PAD = 4;
  const alloc = (w, h) => { if (sx + w > S) { sx = 0; sy += rowH + PAD; rowH = 0; } if (sy + h > S) { api.miss = (api.miss || 0) + 1; return null; } const r = { x: sx, y: sy, w, h }; sx += w + PAD; rowH = Math.max(rowH, h); return r; };
  const uv = (r) => ({ u0: (r.x + 1) / S, u1: (r.x + r.w - 1) / S, v0: 1 - (r.y + r.h - 1) / S, v1: 1 - (r.y + 1) / S });
  const fit = (txt, maxW, px, weight = 'bold') => { let f = px; do { cx.font = `${weight} ${f}px Arial, Helvetica, sans-serif`; if (cx.measureText(txt).width <= maxW) break; f -= 2; } while (f > 14); return f; };
  const rr = (x, y, w, h, r) => { cx.beginPath(); cx.moveTo(x + r, y); cx.arcTo(x + w, y, x + w, y + h, r); cx.arcTo(x + w, y + h, x, y + h, r); cx.arcTo(x, y + h, x, y, r); cx.arcTo(x, y, x + w, y, r); cx.closePath(); };
  // strelka: dir 'L' | 'R' | 'S' (to'g'ri)
  const arrow = (x, y, s, dir) => { cx.save(); cx.translate(x, y); cx.rotate(dir === 'L' ? -Math.PI / 2 : dir === 'R' ? Math.PI / 2 : 0); cx.beginPath(); cx.moveTo(0, -s * 0.5); cx.lineTo(s * 0.42, -s * 0.05); cx.lineTo(s * 0.15, -s * 0.05); cx.lineTo(s * 0.15, s * 0.5); cx.lineTo(-s * 0.15, s * 0.5); cx.lineTo(-s * 0.15, -s * 0.05); cx.lineTo(-s * 0.42, -s * 0.05); cx.closePath(); cx.fill(); cx.restore(); };
  const api = { tex: null, S };
  // yo'nalish taxtasi: ko'k fon, oq matn. lines: [{dir, name, km}] (bir xil matn — bitta joy)
  const memo = new Map();
  api.dir = (lines) => { const key = 'd' + JSON.stringify(lines); if (memo.has(key)) return memo.get(key); const W = 400, RH = 58, H = 28 + lines.length * RH, r = alloc(W, H); if (!r) return null;
    cx.fillStyle = '#1d4e9a'; cx.fillRect(r.x, r.y, W, H); cx.strokeStyle = '#f4f6f8'; cx.lineWidth = 4; rr(r.x + 7, r.y + 7, W - 14, H - 14, 9); cx.stroke(); cx.textBaseline = 'middle';
    lines.forEach((l, i) => { const y = r.y + 14 + i * RH + RH / 2; cx.fillStyle = '#f4f6f8'; arrow(r.x + 38, y, 34, l.dir);
      cx.font = 'bold 30px Arial, Helvetica, sans-serif'; const kw = cx.measureText(l.km).width; cx.textAlign = 'right'; cx.fillText(l.km, r.x + W - 22, y + 2);
      const f = fit(l.name, W - 70 - kw - 40, 38); cx.font = `bold ${f}px Arial, Helvetica, sans-serif`; cx.textAlign = 'left'; cx.fillText(l.name, r.x + 66, y + 2);
      if (i < lines.length - 1) { cx.fillStyle = 'rgba(244,246,248,0.45)'; cx.fillRect(r.x + 18, y + RH / 2 - 1, W - 36, 2); } });
    const u = { ...uv(r), ar: W / H }; memo.set(key, u); return u; };
  // aholi punkti nomi: 'kir' oq + qora hoshiya, 'chiq' — qizil chiziq bilan, 'diq' — jigarrang (diqqatga sazovor joy)
  api.place = (name, kind) => { const W = 400, H = 106, r = alloc(W, H); if (!r) return null; const brown = kind === 'diq';
    cx.fillStyle = brown ? '#6b3f22' : '#f6f6f2'; cx.fillRect(r.x, r.y, W, H); cx.strokeStyle = brown ? '#f6f6f2' : '#141414'; cx.lineWidth = 5; rr(r.x + 8, r.y + 8, W - 16, H - 16, 8); cx.stroke();
    const f = fit(name, W - 56, 50); cx.font = `bold ${f}px Arial, Helvetica, sans-serif`; cx.fillStyle = brown ? '#f6f6f2' : '#141414'; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillText(name, r.x + W / 2, r.y + H / 2 + 3);
    if (kind === 'chiq') { cx.strokeStyle = '#c8201a'; cx.lineWidth = 11; cx.beginPath(); cx.moveTo(r.x + 20, r.y + H - 18); cx.lineTo(r.x + W - 20, r.y + 18); cx.stroke(); }
    return { ...uv(r), ar: W / H }; };
  // dumaloq/uchburchak belgilar 128x128 (shaffof burchaklar)
  api.icon = (kind, v) => { const W = 128, r = alloc(W, W); if (!r) return null; const c0 = r.x + 64, c1 = r.y + 64;
    if (kind === 'speed') { cx.fillStyle = '#c8201a'; cx.beginPath(); cx.arc(c0, c1, 62, 0, 7); cx.fill(); cx.fillStyle = '#f6f6f2'; cx.beginPath(); cx.arc(c0, c1, 47, 0, 7); cx.fill(); cx.fillStyle = '#141414'; cx.font = 'bold 50px Arial, Helvetica, sans-serif'; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillText(String(v), c0, c1 + 3); }
    else if (kind === 'curve') { cx.fillStyle = '#c8201a'; cx.beginPath(); cx.moveTo(c0, r.y + 6); cx.lineTo(r.x + 124, r.y + 118); cx.lineTo(r.x + 4, r.y + 118); cx.closePath(); cx.fill(); cx.fillStyle = '#f6f6f2'; cx.beginPath(); cx.moveTo(c0, r.y + 30); cx.lineTo(r.x + 104, r.y + 106); cx.lineTo(r.x + 24, r.y + 106); cx.closePath(); cx.fill();
      cx.strokeStyle = '#141414'; cx.lineWidth = 8; cx.lineCap = 'round'; const s = v === 'L' ? -1 : 1; cx.beginPath(); cx.moveTo(c0 - s * 8, r.y + 100); cx.quadraticCurveTo(c0 - s * 8, r.y + 72, c0 + s * 14, r.y + 62); cx.stroke(); cx.fillStyle = '#141414'; cx.beginPath(); cx.moveTo(c0 + s * 24, r.y + 58); cx.lineTo(c0 + s * 8, r.y + 52); cx.lineTo(c0 + s * 12, r.y + 72); cx.closePath(); cx.fill(); }
    else if (kind === 'chev') { cx.fillStyle = '#c8201a'; cx.fillRect(r.x, r.y, W, W); cx.fillStyle = '#f6f6f2'; const s = v === 'L' ? -1 : 1; for (const o of [-30, 18]) { cx.beginPath(); cx.moveTo(c0 + s * (o - 14), r.y + 18); cx.lineTo(c0 + s * (o + 18), c1); cx.lineTo(c0 + s * (o - 14), r.y + 110); cx.lineTo(c0 + s * (o - 34), r.y + 110); cx.lineTo(c0 + s * (o - 2), c1); cx.lineTo(c0 + s * (o - 34), r.y + 18); cx.closePath(); cx.fill(); } }
    else if (kind === 'bus') { cx.fillStyle = '#1d4e9a'; cx.fillRect(r.x, r.y, W, W); cx.strokeStyle = '#f6f6f2'; cx.lineWidth = 5; cx.strokeRect(r.x + 7, r.y + 7, W - 14, W - 14); cx.fillStyle = '#f6f6f2'; rr(r.x + 26, r.y + 30, 76, 52, 8); cx.fill(); cx.fillStyle = '#1d4e9a'; cx.fillRect(r.x + 32, r.y + 37, 28, 20); cx.fillRect(r.x + 66, r.y + 37, 30, 20); cx.fillStyle = '#f6f6f2'; cx.beginPath(); cx.arc(r.x + 42, r.y + 86, 8, 0, 7); cx.arc(r.x + 86, r.y + 86, 8, 0, 7); cx.fill(); cx.font = 'bold 18px Arial, Helvetica, sans-serif'; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillText('BEKAT', c0, r.y + 108); }
    else if (kind === 'km') { cx.fillStyle = '#f6f6f2'; cx.fillRect(r.x, r.y, W, W); cx.fillStyle = '#141414'; cx.font = 'bold 70px Arial, Helvetica, sans-serif'; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillText(String(v), c0, c1 + 4); }
    return { ...uv(r), ar: 1 }; };
  api.finish = () => { const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; api.tex = t; return t; };
  return api;
};

export function buildDetails(scene, game, site) {
  const R = T.roads, rng = mulberry32(90417), out = { counts: {} };
  const cnt = (k) => (out.counts[k] = (out.counts[k] || 0) + 1);
  out.at = {}; const at = (k, x, z, yaw) => { const L = (out.at[k] = out.at[k] || []); if (L.length < 12) L.push([+x.toFixed(1), +gy(x, z).toFixed(1), +z.toFixed(1), +yaw.toFixed(2)]); }; // sinov/rasm uchun namunaviy joylar
  // ---------- dunyo bo'laklari (har biri: yorug'langan + yorug' + simlar, masofaga qarab ko'rinadi) ----------
  const CH = 320, NC = Math.ceil(T.SIZE / CH), chunks = new Map();
  const chunk = (x, z) => { const i = clamp(Math.floor((x + T.HALF) / CH), 0, NC - 1), j = clamp(Math.floor((z + T.HALF) / CH), 0, NC - 1), k = j * NC + i; let c = chunks.get(k); if (!c) { c = { g: new GB(k * 3 + 1), gl: new GB(k * 3 + 2), ln: [], x: (i + 0.5) * CH - T.HALF, z: (j + 0.5) * CH - T.HALF }; c.g.jit = 0.045; c.gl.jit = 0; chunks.set(k, c); } return c; };
  const put = (x, y, z, yaw, fn) => { const c = chunk(x, z); c.g.push().translate(x, y, z).rotY(yaw); c.gl.push().translate(x, y, z).rotY(yaw); fn(c.g, c.gl, c); c.g.pop(); c.gl.pop(); return c; };
  const wire = (a, b, sag, n = 8) => { const c = chunk((a[0] + b[0]) / 2, (a[2] + b[2]) / 2); let pr = a; for (let k = 1; k <= n; k++) { const t = k / n, p = [lerp(a[0], b[0], t), lerp(a[1], b[1], t) - sag * 4 * t * (1 - t), lerp(a[2], b[2], t)]; c.ln.push(pr[0], pr[1], pr[2], p[0], p[1], p[2]); pr = p; } };
  // matnli plastinalar (bitta umumiy to'r, bitta chizish)
  const AT = atlas(), PP = [], PN = [], PU = [];
  const icon = {}; const ico = (k, v) => icon[k + v] || (icon[k + v] = AT.icon(k, v));
  for (const [k, v] of [['curve', 'L'], ['curve', 'R'], ['speed', 50], ['speed', 30], ['chev', 'L'], ['chev', 'R'], ['bus', 0], ['km', 1], ['km', 2], ['km', 3]]) ico(k, v); // belgilar avval (atlas to'lsa ham bo'lsin)
  const plate = (x, y, z, yaw, w, h, u, lift = 0) => { if (!u) return; const c = Math.cos(yaw), s = Math.sin(yaw), nx = s, nz = c, o = 0.012 + lift; const P = (lx, ly) => [x + lx * c, y + ly, z - lx * s];
    const A = P(-w / 2, -h / 2), B = P(w / 2, -h / 2), C = P(w / 2, h / 2), D = P(-w / 2, h / 2);
    for (const [p, uu, vv] of [[A, u.u0, u.v0], [B, u.u1, u.v0], [C, u.u1, u.v1], [A, u.u0, u.v0], [C, u.u1, u.v1], [D, u.u0, u.v1]]) { PP.push(p[0] + nx * o, p[1], p[2] + nz * o); PN.push(nx, 0, nz); PU.push(uu, vv); } };
  // bo'sh joymi: yo'l ustida emas, suvda emas, to'qnashuv jismlari bilan kesishmaydi
  const solidNear = (x, z, r) => { for (const o of COL.query(x, z, r + 2)) { let qx = o.x, qz = o.z; if (o.t === 1) { const sx = o.x2 - o.x, sz = o.z2 - o.z, t = clamp(((x - o.x) * sx + (z - o.z) * sz) / (sx * sx + sz * sz || 1), 0, 1); qx = o.x + sx * t; qz = o.z + sz * t; } if (Math.hypot(x - qx, z - qz) < o.r + r) return true; } return false; };
  const roadClear = (x, z, m) => { const nr = T.nearestRoad(x, z, 2); return nr.edge < 0 || nr.d - nr.hw > m; };
  const dry = (x, z) => T.gridHeight(x, z) > T.waterY(x, z) + 0.25;
  const inPlace = (x, z, pad = 0) => { for (const p of T.PLACES) { if (p.rect) { if (Math.abs(x - p.x) < p.rect.hl + pad && Math.abs(z - p.z) < p.rect.hw + pad) return p; } else if (Math.hypot(x - p.x, z - p.z) < p.r + pad) return p; } return null; };
  const excl = (x, z, r) => T.exclusions.push({ x, z, r });
  const gy = (x, z) => T.gridHeight(x, z);
  const lamps = []; // ko'cha chiroqlari (yorug'lik dog'i uchun)
  const roadY = (i) => R.y[i];

  // ---------- 1) belgilar ----------
  const NAME = { vil: "Bog'iston", mayoq: 'Mayoq burni', bandargoh: 'Bandargoh', ormon: "Oltin o'rmon", karyer: 'Tosh karyeri', kol: "Ko'zgu ko'l", lager: 'Qorli lager', choqqi: 'Rasadxona', karvon: 'Karvonsaroy', dara: 'Qizil dara', qala: "Ko'hna qal'a", aero: 'Aerodrom', teg: 'Tegirmonlar', vulqon: "Olovtog'" };
  const nodes = R.nodes, edges = R.edges;
  // tugundan qo'shni chekka bo'ylab eng yaqin nomli manzilgacha (Dijkstra, birinchi chekka majburiy)
  const destVia = (n0, e0) => { const e = edges[e0], first = e.a === n0 ? e.b : e.a; const dist = new Map([[first, e.len]]), q = [[e.len, first]], done = new Set([n0]);
    while (q.length) { q.sort((a, b) => a[0] - b[0]); const [d, n] = q.shift(); if (done.has(n)) continue; done.add(n); if (NAME[nodes[n].key]) return { name: NAME[nodes[n].key], d }; for (const ei of nodes[n].edges) { const f = edges[ei], m = f.a === n ? f.b : f.a; if (done.has(m)) continue; const nd = d + f.len; if (!(dist.get(m) <= nd)) { dist.set(m, nd); q.push([nd, m]); } } }
    return null; };
  const km = (d) => { const k = d / 1000; return (k < 9.95 ? k.toFixed(1).replace('.', ',') : Math.round(k)) + ' km'; };
  // chekkada tugundan s metr uzoqlikdagi nuqta indeksi va tugun tomonga yo'nalish
  const along = (e, fromA, s) => { const k = Math.round(s / 4), idx = fromA ? Math.min(e.count - 1, k) : Math.max(0, e.count - 1 - k); return e.start + idx; };
  const right = (dx, dz) => [-dz, dx];
  // ustunli belgi: post(lar) + orqa taxta (yorug'langan) + matn (atlas)
  const signPost = (x, z, yaw, w, h, u, top = 2.6, back = 'rect', twoPosts = false) => {
    const y = gy(x, z); if (!u) return;
    put(x, y, z, yaw, (g) => { g.color(0x9aa0a8); if (twoPosts) { g.box(-w * 0.32, (top + h / 2) / 2, -0.03, 0.08, top + h / 2, 0.08); g.box(w * 0.32, (top + h / 2) / 2, -0.03, 0.08, top + h / 2, 0.08); } else g.cyl(6, 0.045, 0.04, 0, top + h * 0.5);
      g.color(0x8a9098); if (back === 'rect') g.box(0, top, -0.01, w + 0.02, h + 0.02, 0.025); else if (back === 'disc') { g.push().translate(0, top, -0.01); g.prismZ(14, w / 2, 0.025); g.pop(); } else { g.push().translate(0, top - h * 0.12, -0.01); g.prismZ(3, w * 0.58, 0.025, { rot: Math.PI }); g.pop(); } });
    plate(x, y + top, z, yaw, w, h, u); COL.addCircle(x, z, twoPosts ? w * 0.4 : 0.12, y - 1, y + top + h / 2); excl(x, z, 1.6); };
  // 1a. chorrahalar oldida yo'nalish ko'rsatkichlari
  for (const N of nodes) {
    if (N.edges.length < 3) continue;
    for (const ei of N.edges) {
      const e = edges[ei], fromA = e.a === N.id; if (e.len < 120) continue;
      const i = along(e, fromA, 46), j = along(e, fromA, 42); // j — tugunga yaqinroq
      let dx = R.x[j] - R.x[i], dz = R.z[j] - R.z[i]; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l; // tugun tomonga harakat
      const lines = [];
      for (const ej of N.edges) { if (ej === ei) continue; const f = edges[ej], fa = f.a === N.id, k = along(f, fa, 34); let ox = R.x[k] - N.x, oz = R.z[k] - N.z; const ol = Math.hypot(ox, oz) || 1; ox /= ol; oz /= ol;
        const fw = ox * dx + oz * dz, sd = ox * -dz + oz * dx, dir = fw > 0.72 ? 'S' : sd > 0 ? 'R' : 'L'; const ds = destVia(N.id, ej); if (!ds) continue; lines.push({ dir, name: ds.name, km: km(ds.d + 46), o: dir === 'L' ? 0 : dir === 'S' ? 1 : 2 }); }
      if (!lines.length) continue; lines.sort((a, b) => a.o - b.o);
      const u = AT.dir(lines.slice(0, 3)); if (!u) continue; const [rx, rz] = right(dx, dz), off = R.hw[i] + 2.6, x = R.x[i] + rx * off, z = R.z[i] + rz * off;
      if (!dry(x, z) || !roadClear(x, z, 1.2) || solidNear(x, z, 1.2)) continue;
      const w = 2.7, h = w / u.ar; signPost(x, z, Math.atan2(-dx, -dz), w, h, u, 1.6 + h / 2, 'rect', true); cnt('yonalish'); at('yonalish', x, z, Math.atan2(-dx, -dz));
    }
  }
  // 1b. aholi punkti / diqqatga sazovor joy nomi (kirishda), chiqishda — chizilgan nom
  const VIL = { bogiston: "Bog'iston", bandargoh: 'Bandargoh', tegirmon: 'Tegirmon', karvon: 'Karvonsaroy' };
  const DIQ = { mayoq: 'Mayoq burni', ormon: "Oltin o'rmon", kol: "Ko'zgu ko'l", lager: 'Qorli lager', choqqi: 'Rasadxona', dara: 'Qizil dara', qala: "Ko'hna qal'a", karyer: 'Tosh karyeri', vulqon: "Olovtog' krateri", muzkol: "Muzko'l", aerodrom: 'Eski aerodrom' };
  const placeU = {};
  for (const p of T.PLACES) {
    const vil = VIL[p.id], diq = DIQ[p.id]; if (!vil && !diq) continue;
    const RAD = (p.rect ? p.rect.hl : p.r) + (vil ? 55 : 40);
    for (const e of edges) { let prevIn = null; for (let k = 0; k < e.count; k += 1) { const i = e.start + k, inside = p.rect ? Math.abs(R.x[i] - p.x) < p.rect.hl + 40 && Math.abs(R.z[i] - p.z) < p.rect.hw + 40 : Math.hypot(R.x[i] - p.x, R.z[i] - p.z) < RAD;
      if (prevIn !== null && inside !== prevIn && !R.bridge[i]) {
        const i0 = inside ? i - 1 : i, i1 = inside ? i : i - 1; let dx = R.x[i1] - R.x[i0], dz = R.z[i1] - R.z[i0]; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l; // ichkariga
        const [rx, rz] = right(dx, dz), off = R.hw[i] + 2.4;
        const kin = vil ? 'kir' : 'diq'; const key = p.id + kin; const u1 = placeU[key] || (placeU[key] = AT.place(vil || diq, kin));
        let x = R.x[i0] + rx * off, z = R.z[i0] + rz * off; if (dry(x, z) && roadClear(x, z, 1.1) && !solidNear(x, z, 1)) { signPost(x, z, Math.atan2(-dx, -dz), 1.9, 1.9 / 3.76, u1, 1.9); cnt('nom'); at('nom', x, z, Math.atan2(-dx, -dz)); }
        if (vil) { const key2 = p.id + 'chiq', u2 = placeU[key2] || (placeU[key2] = AT.place(vil, 'chiq')); x = R.x[i0] - rx * off; z = R.z[i0] - rz * off; if (dry(x, z) && roadClear(x, z, 1.1) && !solidNear(x, z, 1)) { signPost(x, z, Math.atan2(dx, dz), 1.9, 1.9 / 3.76, u2, 1.9); cnt('nom'); } }
      }
      prevIn = inside; } }
  }
  // 1c. keskin burilishlar oldida ogohlantirish, tezlik cheklovi va burilishda strelkali taxtachalar
  for (const e of edges) {
    if (e.count < 40) continue; let last = -999;
    const hd = (k) => Math.atan2(R.x[e.start + k + 1] - R.x[e.start + k], R.z[e.start + k + 1] - R.z[e.start + k]);
    for (let k = 14; k < e.count - 14; k++) {
      if (k - last < 90) continue; let turn = hd(k + 6) - hd(k - 6); turn = Math.atan2(Math.sin(turn), Math.cos(turn)); if (Math.abs(turn) < 0.78) continue;
      const pl = inPlace(R.x[e.start + k], R.z[e.start + k], 30); if (pl) continue;
      last = k; const lr = turn > 0 ? 'L' : 'R'; // yaw kamaysa — o'ngga (x o'qi teskari)
      // har ikki yo'nalish uchun: 70 m oldin ogohlantirish + tezlik
      for (const dirF of [1, -1]) { const kk = k - dirF * 18; if (kk < 2 || kk > e.count - 3) continue; const i = e.start + kk; let dx = R.x[i + dirF] - R.x[i], dz = R.z[i + dirF] - R.z[i]; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l; const [rx, rz] = right(dx, dz), off = R.hw[i] + 2.2;
        const x = R.x[i] + rx * off, z = R.z[i] + rz * off; if (!dry(x, z) || !roadClear(x, z, 1) || solidNear(x, z, 1) || R.bridge[i]) continue;
        const L2 = dirF > 0 ? lr : lr === 'L' ? 'R' : 'L'; signPost(x, z, Math.atan2(-dx, -dz), 0.8, 0.8, ico('curve', L2), 2.15, 'tri'); cnt('ogoh'); at('ogoh', x, z, Math.atan2(-dx, -dz));
        const i2 = e.start + clamp(kk - dirF * 6, 1, e.count - 2), x2 = R.x[i2] + rx * off, z2 = R.z[i2] + rz * off; if (dry(x2, z2) && roadClear(x2, z2, 1) && !solidNear(x2, z2, 1) && !R.bridge[i2]) { signPost(x2, z2, Math.atan2(-dx, -dz), 0.66, 0.66, ico('speed', e.type === 0 ? 50 : 30), 2.1, 'disc'); cnt('tezlik'); } }
      // tashqi tomonda strelkali taxtachalar
      for (let q = -2; q <= 2; q++) { const kk = k + q * 3, i = e.start + kk; const dx = R.tx[i], dz = R.tz[i]; const sgn = turn > 0 ? 1 : -1, lo = lr === 'L' ? 'R' : 'L'; const [rx, rz] = right(dx, dz), off = R.hw[i] + 1.9; const x = R.x[i] + rx * off * sgn, z = R.z[i] + rz * off * sgn; if (!dry(x, z) || !roadClear(x, z, 0.9) || R.bridge[i]) continue;
        // ikkala yo'nalishga qaragan: oldi va orqasi
        const y = gy(x, z); put(x, y, z, Math.atan2(-dx, -dz), (g) => { g.color(0x8a9098).box(0, 0.55, 0, 0.07, 1.1, 0.07); g.box(0, 1.05, 0, 0.62, 0.62, 0.04); }); plate(x, y + 1.05, z, Math.atan2(-dx, -dz), 0.6, 0.6, ico('chev', lr), 0.012); plate(x, y + 1.05, z, Math.atan2(dx, dz), 0.6, 0.6, ico('chev', lo), 0.012); COL.addCircle(x, z, 0.1, y - 1, y + 1.4); cnt('strelka'); at('strelka', x, z, Math.atan2(-dx, -dz)); }
    }
  }
  // ---------- 2) asosiy yo'llar bo'ylab: nur qaytargichli ustunchalar, kilometr toshlari, to'siqlar, elektr ustunlari va simlar ----------
  for (const e of edges) {
    if (e.type !== 0) continue;
    // 2a. ustunchalar (har 48 m, ikkala tomonda) va kilometr toshlari
    for (let k = 3; k < e.count - 3; k++) {
      const i = e.start + k, s = k * 4; if (R.bridge[i]) continue; const x0 = R.x[i], z0 = R.z[i], tx = R.tx[i], tz = R.tz[i];
      if (inPlace(x0, z0, 40)) continue;
      if (k % 12 === 0) for (const sd of [1, -1]) { const off = R.hw[i] + 2.1, x = x0 - tz * off * sd, z = z0 + tx * off * sd; if (!dry(x, z) || !roadClear(x, z, 1.4)) continue; const y = gy(x, z);
        put(x, y, z, Math.atan2(tx, tz), (g, gl) => { g.color(0xeceee8).box(0, 0.5, 0, 0.11, 1.0, 0.11, { tx: 0.8, tz: 0.8 }); g.color(0x1c1c1e).box(0, 0.84, 0, 0.115, 0.2, 0.115); gl.mask(-1); gl.color(sd > 0 ? 0xffa21a : 0xf4f4f4).box(0, 0.84, -0.06, 0.07, 0.13, 0.012); gl.color(sd > 0 ? 0xf4f4f4 : 0xffa21a).box(0, 0.84, 0.06, 0.07, 0.13, 0.012); gl.mask(0); }); cnt('ustuncha'); }
      if (s % 1000 === 0 && s > 0) { const off = R.hw[i] + 2.5, x = x0 - tz * off, z = z0 + tx * off; if (dry(x, z) && roadClear(x, z, 1.5) && !solidNear(x, z, 0.8)) { const y = gy(x, z), yaw = Math.atan2(-tx, -tz); put(x, y, z, yaw, (g) => { g.color(0xe8e6de).box(0, 0.42, 0, 0.32, 0.84, 0.16); g.color(0xc8201a).box(0, 0.88, 0, 0.34, 0.1, 0.18); }); plate(x, y + 0.52, z, yaw, 0.26, 0.26, ico('km', Math.round(s / 1000)), 0.072); plate(x, y + 0.52, z, yaw + Math.PI, 0.26, 0.26, ico('km', Math.round((e.len - s) / 1000) || 1), 0.072); COL.addCircle(x, z, 0.2, y - 1, y + 0.9); cnt('km'); } }
    }
    // 2b. to'siqlar: tik jarlik yoki ko'prik oldida (har 4 m ustun, metall to'lqinli taxta)
    for (const sd of [1, -1]) {
      let run = [];
      const flush = () => { if (run.length >= 4) { for (let q = 0; q < run.length; q++) { const [x, y, z] = run[q]; put(x, y, z, 0, (g) => { g.color(0x7a7e86).box(0, 0.38, 0, 0.1, 0.76, 0.08); }); if (q) { const [ax, ay, az] = run[q - 1], L = Math.hypot(x - ax, z - az), yaw = Math.atan2(x - ax, z - az), pit = Math.atan2(y - ay, L); put((x + ax) / 2, (y + ay) / 2, (z + az) / 2, yaw, (g) => { g.rotX(-pit); g.color(0xc4c8cc).box(0, 0.6, 0, 0.06, 0.32, L + 0.08); g.color(0x9a9ea6).box(0, 0.6, 0, 0.075, 0.07, L + 0.1); }); COL.addSeg(ax, az, x, z, 0.12, Math.min(ay, y) - 0.6, Math.max(ay, y) + 0.8); } } cnt('tosiq'); at('tosiq', run[0][0], run[0][2], 0); } run = []; };
      for (let k = 2; k < e.count - 2; k++) {
        const i = e.start + k, x0 = R.x[i], z0 = R.z[i], tx = R.tx[i], tz = R.tz[i], off = R.hw[i] + 0.95, x = x0 - tz * off * sd, z = z0 + tx * off * sd;
        let need = false; if (!R.bridge[i] && !inPlace(x0, z0, 20)) { const fx = x0 - tz * (R.hw[i] + 4) * sd, fz = z0 + tx * (R.hw[i] + 4) * sd; need = gy(fx, fz) < roadY(i) - 2.4 || T.waterY(fx, fz) > gy(fx, fz) + 0.3; for (let q = 1; q <= 6 && !need; q++) if ((R.bridge[i + q] && k + q < e.count) || (R.bridge[i - q] && k - q >= 0)) need = true; }
        if (need && roadClear(x, z, 0.4)) run.push([x, Math.max(roadY(i), gy(x, z)) - 0.05, z]); else flush();
      }
      flush();
    }
    // 2c. yog'och elektr ustunlari va osilgan simlar (chap tomonda, ~48 m oraliq)
    let prev = null;
    for (let k = 6; k < e.count - 6; k += 12) {
      const i = e.start + k, tx = R.tx[i], tz = R.tz[i], off = R.hw[i] + 5.6, x = R.x[i] + tz * off, z = R.z[i] - tx * off;
      if (!dry(x, z) || !roadClear(x, z, 4.2) || solidNear(x, z, 1.2) || R.bridge[i] || (T.placeBy.uy && Math.hypot(x - T.placeBy.uy.x, z - T.placeBy.uy.z) < 45)) { prev = null; continue; }
      const y = gy(x, z), yaw = Math.atan2(tx, tz), H = 8.2, lean = (rng() - 0.5) * 0.03;
      put(x, y, z, yaw, (g) => { g.rotZ(lean); g.color(0x5f5040).cyl(6, 0.14, 0.1, -0.3, H, { shade: 0.06 }); g.color(0x4e4234).box(0, H - 0.55, 0, 2.1, 0.12, 0.13); g.box(-0.45, H - 0.85, 0, 0.06, 0.55, 0.06, { ox: 0.3 }); g.color(0xd8dcd8); for (const ax of [-0.9, 0.9]) { g.push().translate(ax, 0, 0); g.cyl(6, 0.055, 0.04, H - 0.49, H - 0.3); g.pop(); } g.cyl(6, 0.055, 0.04, H, H + 0.19); });
      COL.addCircle(x, z, 0.16, y - 1, y + H); excl(x, z, 2.2); cnt('ustun'); at('ustun', x, z, yaw);
      const c = Math.cos(yaw), s = Math.sin(yaw), tops = [-0.9, 0, 0.9].map((ax) => [x + ax * c, y + H - 0.28 + (ax ? 0 : 0.46), z - ax * s]);
      if (prev && Math.hypot(prev[1][0] - x, prev[1][2] - z) < 75) for (let w = 0; w < 3; w++) { const a = prev[w], b = tops[w], L = Math.hypot(a[0] - b[0], a[2] - b[2]); wire(a, b, 0.012 * L + 0.25); }
      prev = tops;
    }
  }
  // ---------- 3) qishloq ko'chalari: chiroqlar, bekat, aryq ----------
  const LAMPV = ['bogiston', 'bandargoh', 'tegirmon', 'karvon', 'mayoq', 'ormon', 'kol', 'qala', 'dara'];
  const LMP = BK.LAMPS.filter((q) => q.lv == null), known = LMP.slice();
  for (const id of LAMPV) {
    const p = T.placeBy[id]; if (!p) continue; const RAD = p.r + 30;
    for (const e of edges) { let acc = 99, side = 1; for (let k = 2; k < e.count - 2; k++) { const i = e.start + k; if (Math.hypot(R.x[i] - p.x, R.z[i] - p.z) > RAD || R.bridge[i]) { acc = 99; continue; } if ((acc += 4) < 34) continue;
      const tx = R.tx[i], tz = R.tz[i], off = R.hw[i] + 1.6, x = R.x[i] - tz * off * side, z = R.z[i] + tx * off * side;
      if (!dry(x, z) || !roadClear(x, z, 0.9) || solidNear(x, z, 0.9) || known.some((q) => Math.hypot(q.x - x, q.z - z) < 20)) continue;
      acc = 0; const y = gy(x, z), yaw = side > 0 ? Math.atan2(tx, tz) : Math.atan2(-tx, -tz), H = 6.6; // +x tomoni yo'lga qaragan
      put(x, y, z, yaw, (g, gl) => { g.color(0x8c9096).cyl(7, 0.11, 0.07, 0, H, { shade: 0.05 }); g.push().translate(0, H - 0.1, 0).rotZ(-0.12); g.box(0.75, 0, 0, 1.6, 0.07, 0.07); g.pop(); g.color(0x5a5e66).box(1.55, H - 0.25, 0, 0.62, 0.14, 0.3, { tx: 0.8, tz: 0.9 }); gl.color(PAL.lamp).box(1.55, H - 0.34, 0, 0.46, 0.04, 0.2); });
      const c = Math.cos(yaw), s = Math.sin(yaw), lx = x + 1.55 * c, lz = z - 1.55 * s; COL.addCircle(x, z, 0.14, y - 1, y + H); excl(x, z, 2); lamps.push({ x: lx, z: lz, y: Math.max(gy(lx, lz), roadY(i)) + 0.07, s: 11 }); site.lights.push({ x: lx, y: y + H - 0.4, z: lz, hex: 0xffd9a0, power: 0.85 }); known.push({ x, z }); side = -side; cnt('chiroq'); at('chiroq', x, z, yaw); } }
  }
  for (const q of LMP) lamps.push({ x: q.x, z: q.z, y: gy(q.x, q.z) + 0.07, s: 9 });
  // avtobus bekati (qishloq markazidan o'tadigan yo'lda)
  for (const id of ['bogiston', 'bandargoh', 'tegirmon', 'karvon']) {
    const p = T.placeBy[id]; if (!p) continue; let done = false;
    for (let t = 0; t < 400 && !done; t++) { const i = (rng() * R.n) | 0, d = Math.hypot(R.x[i] - p.x, R.z[i] - p.z); if (d < p.r * 0.35 || d > p.r + 40 || R.bridge[i] || edges[R.edge[i]].type !== 0) continue;
      const tx = R.tx[i], tz = R.tz[i], off = R.hw[i] + 2.9, x = R.x[i] - tz * off, z = R.z[i] + tx * off; if (!dry(x, z) || !roadClear(x, z, 2.2) || solidNear(x, z, 3.4)) continue;
      const y = gy(x, z), yaw = Math.atan2(tz, -tx); // old tomoni yo'lga
      if (Math.abs(gy(x + tx * 2, z + tz * 2) - y) > 0.6 || Math.abs(gy(x - tx * 2, z - tz * 2) - y) > 0.6) continue;
      put(x, y, z, yaw, (g) => { g.color(PAL.stone).box(0, 0.08, 0, 4.4, 0.16, 2.2); g.color(0x6a7078); for (const sx of [-2, 2]) for (const sz of [-0.85, 0.85]) g.box(sx, 1.3, sz, 0.1, 2.5, 0.1); g.color(0x3a6ea8).box(0, 2.62, 0, 4.6, 0.12, 2.4, { tz: 0.92 }); g.color(0xb8d4e0).box(0, 1.35, -0.88, 3.9, 1.9, 0.04); g.box(-2.0, 1.35, 0, 0.04, 1.9, 1.6); g.color(PAL.wood).box(0, 0.48, -0.55, 3.2, 0.08, 0.42); g.color(PAL.metalD).box(-1.4, 0.24, -0.55, 0.08, 0.46, 0.36); g.box(1.4, 0.24, -0.55, 0.08, 0.46, 0.36); g.color(0x2f8a4a).box(2.6, 0.4, 0.6, 0.5, 0.75, 0.5); g.color(0x26703c).box(2.6, 0.8, 0.6, 0.54, 0.06, 0.54); });
      COL.addBox(x, z, 2.2, 1.0, yaw, y - 1, y + 2.8); excl(x, z, 5);
      const c = Math.cos(yaw), s = Math.sin(yaw), sx2 = x + 2.9 * c + 1.0 * s, sz2 = z - 2.9 * s + 1.0 * c; signPost(sx2, sz2, yaw, 0.6, 0.6, ico('bus', 0), 2.3, 'rect'); done = true; cnt('bekat'); at('bekat', x, z, yaw); }
  }

  // ---------- 4) hovli detallari: to'siqlar, pochta qutisi, o'tin, kir arqoni, gul tuvaklari, axlat qutisi ----------
  const LAUNDRY = []; // [x,y,z,yaw,w,h,hex]
  const fencePiece = (type, ax, az, bx, bz, gate) => { // gate: [t0,t1] oralig'i bo'sh (darvoza)
    const L = Math.hypot(bx - ax, bz - az); if (L < 0.5) return; const yaw = Math.atan2(bx - ax, bz - az);
    const segs = gate ? [[0, gate[0]], [gate[1], 1]] : [[0, 1]];
    for (const [t0, t1] of segs) { if (t1 - t0 < 0.02) continue; const x0 = lerp(ax, bx, t0), z0 = lerp(az, bz, t0), x1 = lerp(ax, bx, t1), z1 = lerp(az, bz, t1), l = L * (t1 - t0); let okp = true; for (let q = 0; q <= 4; q++) { const qx = lerp(x0, x1, q / 4), qz = lerp(z0, z1, q / 4); if (!roadClear(qx, qz, 1.0) || !dry(qx, qz)) okp = false; } if (!okp) continue;
      const y = Math.min(gy(x0, z0), gy(x1, z1));
      put(x0, y, z0, yaw, (g) => {
        if (type === 0) { // shtaketnik (oq yoki yog'och)
          const col = rng() < 0.5 ? 0xf0ede4 : 0xb08a5e; const n = Math.max(2, Math.round(l / 0.24)); g.color(col); for (let q = 0; q < n; q++) { const zz = (q + 0.5) * l / n; g.box(0, 0.52, zz, 0.025, 1.04, 0.09, { tx: 1, tz: 0.4 }); } g.color(PAL.woodD); g.box(-0.04, 0.3, l / 2, 0.04, 0.07, l); g.box(-0.04, 0.8, l / 2, 0.04, 0.07, l); for (let q = 0; q <= Math.ceil(l / 2.2); q++) g.box(-0.05, 0.55, Math.min(l, q * 2.2), 0.09, 1.1, 0.09);
        } else if (type === 1) { // taxta panellar
          g.color(PAL.woodD); for (let q = 0; q <= Math.ceil(l / 2); q++) g.box(0, 0.75, Math.min(l, q * 2), 0.11, 1.5, 0.11); g.color(rng() < 0.5 ? PAL.wood : 0x8a6a4e); const n = Math.max(1, Math.round(l / 0.5)); for (let q = 0; q < n; q++) g.box(0.04, 0.68, (q + 0.5) * l / n, 0.03, 1.28 - (q % 2) * 0.06, l / n - 0.03);
        } else { // past paxsa devor
          g.color(PAL.clay).box(0, 0.5, l / 2, 0.32, 1.0, l); g.color(PAL.clayD).box(0, 1.04, l / 2, 0.4, 0.09, l + 0.06);
        } });
      COL.addSeg(x0, z0, x1, z1, type === 2 ? 0.2 : 0.1, y - 1, y + 1.2); }
  };
  for (const H of site.houses || []) {
    const hr = mulberry32(((H.x * 73.1) | 0) ^ ((H.z * 19.7) | 0) ^ 0x5f3a), c = Math.cos(H.yaw), s = Math.sin(H.yaw), W = (lx, lz) => [H.x + lx * c + lz * s, H.z - lx * s + lz * c];
    const atL = (lx, lz, a, fn) => { const [x, z] = W(lx, lz); if (!dry(x, z) || !roadClear(x, z, 1.2)) return null; const y = gy(x, z); put(x, y, z, H.yaw + a, fn); return [x, y, z]; };
    const hx = H.hx, hz = H.hz, dep = Math.min(3.2, 8.6 - hz), wx = Math.min(hx + 1.0, 7.6);
    // old hovli to'sig'i (darvoza eshik qarshisida)
    if (hr() < 0.68 && dep > 1.4) { const type = (hr() * 3) | 0; const A = W(-wx, hz + dep), B = W(wx, hz + dep), A0 = W(-wx, hz - 0.2), B0 = W(wx, hz - 0.2); fencePiece(type, A[0], A[1], B[0], B[1], [0.5 - 0.625 / wx, 0.5 + 0.625 / wx]); fencePiece(type, A0[0], A0[1], A[0], A[1]); fencePiece(type, B0[0], B0[1], B[0], B[1]); cnt('tosiq_hovli'); at('hovli', H.x, H.z, H.yaw);
      if (hr() < 0.6) { const p = atL(1.9, hz + dep + 0.5, 0, (g) => { g.color(PAL.woodD).box(0, 0.6, 0, 0.08, 1.2, 0.08); g.color([0x2f6fb0, 0x3f8a4a, 0x8a3a2a, 0x5a5e66][(hr() * 4) | 0]).box(0, 1.27, 0, 0.32, 0.26, 0.46); g.color(0x2a2c33).box(0, 1.3, 0.235, 0.18, 0.03, 0.01); }); if (p) { COL.addCircle(p[0], p[2], 0.15, p[1] - 1, p[1] + 1.4); cnt('pochta'); } } }
    // gul tuvaklari eshik yonida
    if (hr() < 0.55) for (const sx of [-1.15, 1.15]) atL(sx, hz + 0.55, 0, (g) => { g.color(0xb4623a).cyl(7, 0.2, 0.15, 0, 0.36, { cap: true, shade: 0.1 }); g.color([0x4f8a3a, 0x3f7a40, 0x5e9a44][(hr() * 3) | 0]).blob(0.28, 0, { cy: 0.5, sy: 0.85, jitter: 0.2 }); if (hr() < 0.6) g.color([0xd8392b, 0xf0b83a, 0xf2f2ee, 0xc04a8a][(hr() * 4) | 0]).blob(0.1, 0, { cx: 0.08, cy: 0.72, cz: 0.05 }); });
    // eshik yonida o'rindiq
    if (hr() < 0.45) { const p = atL(-hx + 1.2, hz + 0.55, 0, (g) => { g.color(PAL.wood).box(0, 0.45, 0, 1.5, 0.07, 0.4); g.box(0, 0.75, -0.17, 1.5, 0.3, 0.05); g.color(PAL.woodD); g.box(-0.65, 0.22, 0, 0.08, 0.45, 0.38); g.box(0.65, 0.22, 0, 0.08, 0.45, 0.38); }); if (p) COL.addCircle(p[0], p[2], 0.45, p[1] - 1, p[1] + 1); }
    // yon tomonda o'tin taxlami
    if (hr() < 0.45) { const sd = hr() < 0.5 ? -1 : 1, p = atL(sd * (hx + 0.75), -hz * 0.3, Math.PI / 2, (g) => { g.color(PAL.woodD); for (let r = 0; r < 4; r++) for (let q = 0; q < 6 - (r > 2 ? 1 : 0); q++) { g.push().translate((q - 2.5) * 0.3 + (r % 2) * 0.12, 0.15 + r * 0.27, 0); g.color(hr() < 0.5 ? 0x8a6a48 : 0x9a7a52).prismZ(6, 0.14, 1.1); g.pop(); } g.color(PAL.roof[1]).box(0, 1.32, 0, 2.2, 0.06, 1.4); }); if (p) { const [bx, bz] = [p[0], p[2]]; COL.addBox(bx, bz, 1.0, 0.6, H.yaw + Math.PI / 2, p[1] - 1, p[1] + 1.4); cnt('otin'); } }
    // orqa hovlida kir arqoni
    if (hr() < 0.5) { const lz = -hz - 2.4, la = W(-1.9, lz), lb = W(1.9, lz); if (dry(la[0], la[1]) && dry(lb[0], lb[1]) && roadClear(la[0], la[1], 1.5) && roadClear(lb[0], lb[1], 1.5) && !solidNear(la[0], la[1], 0.3) && !solidNear(lb[0], lb[1], 0.3)) {
      const ya = gy(la[0], la[1]), yb = gy(lb[0], lb[1]);
      for (const [q, yy] of [[la, ya], [lb, yb]]) { put(q[0], yy, q[1], H.yaw, (g) => { g.color(0x8a9098).cyl(5, 0.04, 0.035, 0, 2.0); g.box(0, 1.92, 0, 0.06, 0.05, 0.7); }); COL.addCircle(q[0], q[1], 0.08, yy - 1, yy + 2); }
      const A = [la[0], ya + 1.9, la[1]], B = [lb[0], yb + 1.9, lb[1]]; wire(A, B, 0.12, 6);
      let t = 0.08; while (t < 0.9) { const w = 0.35 + hr() * 0.55, h = 0.45 + hr() * 0.45; if (t + w / 3.8 > 0.94) break; const y = lerp(A[1], B[1], t) - 0.12 * 4 * t * (1 - t) - 0.01; LAUNDRY.push([lerp(A[0], B[0], t), y, lerp(A[2], B[2], t), H.yaw, w, h, [0xf2f2ee, 0xe2572f, 0x2f7fd0, 0xf0b83a, 0x8a54c8, 0x3f9a58, 0xd8c8a8][(hr() * 7) | 0]]); t += w / 3.8 + 0.03; }
      cnt('kir'); at('kir', la[0], la[1], H.yaw); } }
    // ko'cha tomonda axlat qutisi
    if (hr() < 0.35) { const p = atL(wx + 0.7, hz + dep + 0.7, 0, (g) => { g.color(0x2f6a3e).box(0, 0.5, 0, 0.6, 0.95, 0.7, { tx: 1.06, tz: 1.06 }); g.color(0x24532f).box(0, 1.0, -0.02, 0.66, 0.06, 0.76); g.color(0x1c1c1e); g.push().translate(-0.25, 0.1, -0.32); g.prismX(7, 0.1, 0.06); g.pop(); g.push().translate(0.25, 0.1, -0.32); g.prismX(7, 0.1, 0.06); g.pop(); }); if (p) { COL.addCircle(p[0], p[2], 0.4, p[1] - 1, p[1] + 1.1); cnt('axlat'); } }
  }
  // qishloqlarda qo'l nasosi (suv kolonkasi) — yo'l yoqasida
  for (const [id, n] of [['bogiston', 3], ['bandargoh', 1], ['tegirmon', 1], ['karvon', 1]]) { const p = T.placeBy[id]; if (!p) continue; let got = 0;
    for (let t = 0; t < 300 && got < n; t++) { const a = rng() * 6.283, d = 10 + rng() * p.r, x = p.x + Math.cos(a) * d, z = p.z + Math.sin(a) * d, nr = T.nearestRoad(x, z, 2); if (nr.edge < 0 || nr.d - nr.hw < 2.2 || nr.d - nr.hw > 5 || !dry(x, z) || solidNear(x, z, 1.4)) continue;
      const y = gy(x, z), yaw = Math.atan2(nr.tx, nr.tz); put(x, y, z, yaw, (g) => { g.color(PAL.stoneD).box(0, 0.06, 0, 1.2, 0.12, 1.2); g.color(0x2f5f8a).cyl(8, 0.12, 0.1, 0.1, 1.15, { shade: 0.1 }); g.color(0x24496a).blob(0.13, 0, { cy: 1.18, sy: 0.8 }); g.push().translate(0, 0.78, 0.14).rotX(0.5); g.box(0, 0, 0.18, 0.06, 0.06, 0.4); g.pop(); g.push().translate(0, 1.15, 0).rotX(-0.35); g.box(0, 0, -0.35, 0.05, 0.05, 0.75); g.pop(); g.color(0x4a4e58).box(0, 0.14, 0.38, 0.4, 0.04, 0.3); });
      COL.addCircle(x, z, 0.25, y - 1, y + 1.3); excl(x, z, 1.8); got++; cnt('nasos'); at('nasos', x, z, yaw); } }

  // ---------- qurish: bo'laklar ----------
  const lineMat = new THREE.LineBasicMaterial({ color: 0x1b1c1f, fog: true }), group = [];
  for (const c of chunks.values()) {
    const o = { x: c.x, z: c.z, objs: [] };
    if (c.g.count) { const m = new THREE.Mesh(c.g.build(), MAT.flat); m.castShadow = true; m.receiveShadow = true; m.matrixAutoUpdate = false; scene.add(m); o.objs.push([m, 760]); }
    if (c.gl.count) { const m = new THREE.Mesh(withMask(c.gl.build()), glowMat()); m.matrixAutoUpdate = false; scene.add(m); o.objs.push([m, 900]); }
    if (c.ln.length) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(c.ln, 3)); g.computeBoundingSphere(); const m = new THREE.LineSegments(g, lineMat); m.matrixAutoUpdate = false; scene.add(m); o.objs.push([m, 520]); }
    if (o.objs.length) group.push(o);
  }
  // matnli plastinalar
  const ptex = AT.finish(); const plateMat = new THREE.MeshLambertMaterial({ map: ptex, alphaTest: 0.5, emissive: 0xffffff, emissiveMap: ptex, emissiveIntensity: 0 });
  if (PP.length) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(PP, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(PN, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(PU, 2)); const m = new THREE.Mesh(g, plateMat); m.receiveShadow = true; m.matrixAutoUpdate = false; scene.add(m); out.plates = m; }
  // ko'cha chirog'i ostidagi yumshoq yorug'lik dog'i (haqiqiy chiroq emas — qo'shiluvchi tekislik)
  const poolTex = (() => { const S = 64, cv = document.createElement('canvas'); cv.width = cv.height = S; const cx = cv.getContext('2d'), gr = cx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.55)'); gr.addColorStop(0.7, 'rgba(255,255,255,0.14)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); cx.fillStyle = gr; cx.fillRect(0, 0, S, S); return new THREE.CanvasTexture(cv); })();
  const poolMat = new THREE.MeshBasicMaterial({ map: poolTex, color: 0xffc070, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
  const pools = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), poolMat, Math.max(1, lamps.length)); pools.count = lamps.length; pools.frustumCulled = false; pools.renderOrder = 2;
  { const o = new THREE.Object3D(); lamps.forEach((l, i) => { o.position.set(l.x, l.y, l.z); o.scale.set(l.s, 1, l.s); o.updateMatrix(); pools.setMatrixAt(i, o.matrix); }); } scene.add(pools);
  // mato: bayroqlar va kirlar
  const cmat = clothMat(), dum = new THREE.Object3D(), col = new THREE.Color();
  const FL = BK.FLAGS, flags = new THREE.InstancedMesh(clothGeo(true), cmat, Math.max(1, FL.length)); flags.count = FL.length; flags.castShadow = true; flags.frustumCulled = false;
  const fyaw = Math.atan2(-WINDDIR[1], WINDDIR[0]);
  FL.forEach((f, i) => { dum.position.set(f.x, f.y, f.z); dum.rotation.set(0, fyaw + (rng() - 0.5) * 0.25, 0); dum.scale.set(f.w, f.h, f.w); dum.updateMatrix(); flags.setMatrixAt(i, dum.matrix); flags.setColorAt(i, col.setHex(f.hex)); }); if (!FL.length) flags.setColorAt(0, col.setHex(0xffffff)); scene.add(flags);
  const laundry = new THREE.InstancedMesh(clothGeo(false), cmat, Math.max(1, LAUNDRY.length)); laundry.count = LAUNDRY.length; laundry.castShadow = true; laundry.frustumCulled = false;
  LAUNDRY.forEach((q, i) => { dum.position.set(q[0], q[1], q[2]); dum.rotation.set(0, q[3], 0); dum.scale.set(q[4], q[5], 1); dum.updateMatrix(); laundry.setMatrixAt(i, dum.matrix); laundry.setColorAt(i, col.setHex(q[6])); }); if (!LAUNDRY.length) laundry.setColorAt(0, col.setHex(0xffffff)); scene.add(laundry);
  out.at.bayroq = FL.slice(0, 12).map((f) => [+f.x.toFixed(1), +f.y.toFixed(1), +f.z.toFixed(1)]); out.at.mori = BK.CHIMNEYS.filter((c) => c.lv == null).slice(0, 12).map((c) => [+c.x.toFixed(1), +c.y.toFixed(1), +c.z.toFixed(1)]);
  out.counts.atlas_yetmadi = AT.miss || 0; out.counts.mato = FL.length + LAUNDRY.length; out.counts.bolak = group.length; out.counts.yoruglik_dogi = lamps.length;

  // ---------- har chizishdan oldin: masofa bo'yicha ko'rinish, tun uniformlari ----------
  const sync = (camera) => {
    const night = game.sky ? game.sky.night : 0; DU.uNight.value = night; DU.uHour.value = game.hour != null ? game.hour : 12;
    const cx = camera.position.x, cz = camera.position.z;
    for (const o of group) { const d2 = (o.x - cx) ** 2 + (o.z - cz) ** 2; for (const [m, r] of o.objs) m.visible = d2 < (r + CH * 0.71) ** 2; }
    poolMat.opacity = smoothstep(0.25, 0.75, night) * 0.5; pools.visible = poolMat.opacity > 0.005;
    plateMat.emissiveIntensity = night * 0.1;
  };
  const prevBR = scene.onBeforeRender;
  scene.onBeforeRender = function (renderer, sc, camera, rt) { if (prevBR) prevBR.call(this, renderer, sc, camera, rt); if (camera && camera.isPerspectiveCamera) sync(camera); };

  // ---------- mo'ri tutuni va favvora purkagichi (zarrachalar, o'yinchidan 300 m ichida) ----------
  const CHIM = BK.CHIMNEYS; const home = site.places && site.places.uy && site.places.uy.home;
  for (const c of CHIM) { c.acc = 0; c.k = ((c.ph * 13.7) % 1 + 1) % 1; }
  site.anim.push((dt, t, night) => {
    const fx = game.fx; if (!fx || typeof fx.emit !== 'function' || !game.camera || dt <= 0) return;
    const cp = game.camera.position, share = 0.32 + 0.45 * night, wx = WINDDIR[0], wz = WINDDIR[1];
    for (const c of CHIM) {
      if (c.lv != null && (!home || home.lvl !== c.lv)) continue;
      if ((c.x - cp.x) ** 2 + (c.z - cp.z) ** 2 > 300 * 300) continue;
      const on = 0.5 + 0.5 * Math.sin(t * 0.045 + c.ph) * Math.sin(t * 0.017 + c.ph * 2.3); if (c.k > share || on < 0.3) continue;
      c.acc += dt * (1.6 + 2.2 * on); const g = 0.6 + 0.4 * Math.sin(t * 0.41 + c.ph);
      while (c.acc > 1) { c.acc -= 1; const sh = night > 0.5 ? 0x4a4c52 : on > 0.8 ? 0x8e8c88 : 0xb4b2ae; fx.emit(c.x + (Math.random() - 0.5) * 0.25, c.y, c.z + (Math.random() - 0.5) * 0.25, wx * g * 0.9 + (Math.random() - 0.5) * 0.3, 0.75 + Math.random() * 0.35, wz * g * 0.9 + (Math.random() - 0.5) * 0.3, 5.5 + Math.random() * 2.5, 0.55 + Math.random() * 0.3, sh, 0.26 + 0.1 * on, 2.6, -0.04, 0.12); }
    }
    if (home && home.waterFx) for (const w of home.waterFx) { if (!w.grp.visible || (w.x - cp.x) ** 2 + (w.z - cp.z) ** 2 > 120 * 120) continue; w.acc = (w.acc || 0) + dt * 24; while (w.acc > 1) { w.acc -= 1; const a = Math.random() * 6.283, s = 0.35 + Math.random() * 0.35; fx.emit(w.x, w.y, w.z, Math.cos(a) * s, 2.4 + Math.random() * 0.8, Math.sin(a) * s, 0.75, 0.16, 0xdff2ff, 0.55, 0.4, 9.8, 0); } }
  });
  out.sync = sync; out.chimneys = CHIM;
  return out;
}
