// Transportlar: 22 ta (velosipeddan bolidgacha). Har birining fizik "spec"i va protsedura bilan yasalgan modeli bor.
// Hamma dizayn va nomlar o'zimizniki (haqiqiy brendlar yo'q). O'qlar: +Z oldinga, +X chapga, markaz — og'irlik markazi.
import * as THREE from 'three';
import { VB, vmats, paintMaterial, lampMat, wheelGeo, wheelInto, bikeWheelGeo, caliperGeo, riderGeo2, makeBody, emitBody, emitInner, endPatch, sidePatch, topPatch, lerp3 } from './carkit.js';
import { JEEP, jeepExtras } from './carmodel.js';
import { DEF_SPEC } from './physics.js';

const DARK = 0x2b2d33, GREY = 0x4a4d57, GLASS = 0x1e3246, STEEL = 0xb9bec8, TYRE = 0x1c1d22, SKIN = 0xe8b990;
const S = (o) => Object.assign({}, DEF_SPEC, o);

// id, nom, narx, rang, tavsif, toifa, spec
export const VEHICLES = [
  { id: 'velo', name: 'Velosiped', price: 0, hex: 0x2fb5b0, cls: 'bike', desc: "Benzin kerak emas. Sekin, lekin har yerdan o'tadi va hech qachon buzilmaydi.", eng: 0,
    spec: S({ mass: 95, len: 1.8, wid: 0.6, hgt: 1.7, clr: 0.3, com: 0.78, wx: 0.16, wzF: 0.56, wzR: 0.52, rF: 0.34, rR: 0.34, free: 0.2, travel: 0.13, sag: 0.05, power: 620, top: 36, a0: 2.8, brake: 7.5, steer: 0.72, drive: 'rwd', grip: 1.0, down: 0, bike: true }) },
  { id: 'skuter', name: 'Skuter', price: 500, hex: 0xf0b83a, cls: 'bike', desc: 'Qishloq ichida yurish uchun yengil va tejamkor.', eng: 1.9,
    spec: S({ mass: 170, len: 1.85, wid: 0.66, hgt: 1.66, clr: 0.2, com: 0.62, wx: 0.16, wzF: 0.62, wzR: 0.6, rF: 0.24, rR: 0.24, free: 0.2, travel: 0.13, sag: 0.05, power: 6200, top: 70, a0: 4.0, brake: 8.5, steer: 0.64, drive: 'rwd', grip: 1.0, down: 0, bike: true }) },
  { id: 'kart', name: 'Karting', price: 1800, hex: 0xe2572f, cls: 'open', desc: 'Juda past va chaqqon. Faqat tekis yo\'l uchun!', eng: 1.7,
    spec: S({ mass: 190, len: 1.9, wid: 1.34, hgt: 0.95, clr: 0.12, com: 0.3, wx: 0.58, wzF: 0.62, wzR: 0.6, rF: 0.16, rR: 0.18, free: 0.16, travel: 0.1, sag: 0.04, power: 14000, top: 98, a0: 7, brake: 11, steer: 0.5, drive: 'rwd', grip: 1.14, down: 0.6 }) },
  { id: 'moto', name: 'Mototsikl', price: 2200, hex: 0xd8392b, cls: 'bike', desc: 'Ikki g\'ildirakda shamoldek. Yiqilsangiz — og\'riydi.', eng: 1.5,
    spec: S({ mass: 260, len: 2.15, wid: 0.72, hgt: 1.6, clr: 0.24, com: 0.62, wx: 0.17, wzF: 0.74, wzR: 0.7, rF: 0.33, rR: 0.33, free: 0.26, travel: 0.18, sag: 0.07, power: 54000, top: 175, a0: 8.5, brake: 10.5, steer: 0.55, drive: 'rwd', grip: 1.06, down: 0, bike: true }) },
  { id: 'kvadro', name: 'Kvadrotsikl', price: 2600, hex: 0x3f9a58, cls: 'open', desc: "Yo'lsizlik, qum va qor uchun to'rt g'ildirakli o'yinchoq.", eng: 1.4,
    spec: S({ mass: 380, len: 2.05, wid: 1.24, hgt: 1.5, clr: 0.3, com: 0.6, wx: 0.5, wzF: 0.64, wzR: 0.62, rF: 0.3, rR: 0.3, free: 0.34, travel: 0.26, sag: 0.09, power: 27000, top: 94, a0: 6.4, brake: 9.5, steer: 0.6, drive: 'awd', grip: 1.08, down: 0.2 }) },
  { id: 'xetch', name: 'Xetchbek', price: 3000, hex: 0x4fb0ff, cls: 'car', desc: 'Ixcham shahar mashinasi — arzon va ishonchli.', eng: 1.15,
    spec: S({ mass: 1050, len: 3.75, wid: 1.66, hgt: 1.5, clr: 0.18, com: 0.54, wx: 0.74, wzF: 1.2, wzR: 1.2, rF: 0.3, rR: 0.3, free: 0.34, travel: 0.24, sag: 0.09, power: 62000, top: 152, a0: 5.2, brake: 10.5, steer: 0.6, drive: 'fwd', grip: 1.0, down: 1 }) },
  { id: 'traktor', name: 'Traktor', price: 4000, hex: 0x3f9a58, cls: 'tractor', desc: "Sekin, ammo to'xtatib bo'lmaydi. Har qanday loydan chiqadi.", eng: 0.6,
    spec: S({ mass: 3200, len: 3.9, wid: 2.05, hgt: 2.75, clr: 0.5, com: 1.05, wx: 0.86, wzF: 1.2, wzR: 0.95, rF: 0.46, rR: 0.82, free: 0.3, travel: 0.17, sag: 0.06, power: 78000, top: 47, a0: 3.8, brake: 8, steer: 0.72, drive: 'awd', grip: 1.28, down: 0 }) },
  { id: 'sedan', name: 'Sedan', price: 4800, hex: 0xf2f2ee, cls: 'car', desc: 'Qulay oilaviy mashina. Uzoq yo\'l uchun ayni muddao.', eng: 1.0,
    spec: S({ mass: 1350, len: 4.5, wid: 1.78, hgt: 1.45, clr: 0.17, com: 0.53, wx: 0.78, wzF: 1.38, wzR: 1.36, rF: 0.32, rR: 0.32, free: 0.34, travel: 0.24, sag: 0.09, power: 108000, top: 188, a0: 6.0, brake: 11, steer: 0.58, drive: 'rwd', grip: 1.03, down: 1.2 }) },
  { id: 'pikap', name: 'Pikap', price: 5500, hex: 0x2f7fd0, cls: 'car', desc: "Kuchli va baquvvat — fermaning ishonchli yordamchisi.", eng: 0.85,
    spec: S({ mass: 1900, len: 5.1, wid: 1.9, hgt: 1.84, clr: 0.34, com: 0.74, wx: 0.84, wzF: 1.62, wzR: 1.6, rF: 0.4, rR: 0.4, free: 0.44, travel: 0.33, sag: 0.12, power: 132000, top: 158, a0: 5.6, brake: 10.5, steer: 0.56, drive: 'awd', grip: 1.02, down: 1 }) },
  { id: 'jip', name: 'Sayohat jipi', price: 0, hex: 0xd8392b, cls: 'jeep', desc: "Sarguzasht hamrohingiz. Yo'l ham, yo'lsizlik ham bir xil.", eng: 1.0, spec: S({}) },
  { id: 'furgon', name: 'Furgon', price: 6000, hex: 0xf7efe0, cls: 'van', desc: "Katta yuk bo'limi. Burilishlarda ehtiyot bo'ling — baland!", eng: 0.9,
    spec: S({ mass: 2100, len: 5.0, wid: 1.96, hgt: 2.32, clr: 0.24, com: 0.88, wx: 0.86, wzF: 1.6, wzR: 1.55, rF: 0.36, rR: 0.36, free: 0.38, travel: 0.27, sag: 0.1, power: 98000, top: 140, a0: 4.4, brake: 9.5, steer: 0.56, drive: 'rwd', grip: 1.0, down: 0.8 }) },
  { id: 'bagi', name: 'Bagi', price: 7500, hex: 0xf0b83a, cls: 'open', desc: "Qum barxanlari qiroli: uzun osma, yengil rama.", eng: 1.25,
    spec: S({ mass: 620, len: 3.15, wid: 1.74, hgt: 1.52, clr: 0.36, com: 0.62, wx: 0.76, wzF: 1.08, wzR: 1.0, rF: 0.34, rR: 0.4, free: 0.52, travel: 0.42, sag: 0.15, power: 84000, top: 152, a0: 8, brake: 10.5, steer: 0.6, drive: 'rwd', grip: 1.1, down: 0.6 }) },
  { id: 'ralli', name: 'Ralli mashinasi', price: 9500, hex: 0x2f7fd0, cls: 'car', desc: "To'liq yuritma, turbo. Shag'al yo'llar uchun yaratilgan.", eng: 1.2,
    spec: S({ mass: 1250, len: 4.05, wid: 1.78, hgt: 1.47, clr: 0.22, com: 0.53, wx: 0.79, wzF: 1.28, wzR: 1.26, rF: 0.33, rR: 0.33, free: 0.4, travel: 0.3, sag: 0.1, power: 235000, top: 208, a0: 9.5, brake: 12.5, steer: 0.62, drive: 'awd', grip: 1.16, down: 1.8 }) },
  { id: 'yuk', name: 'Yuk mashinasi', price: 10000, hex: 0xe2572f, cls: 'truck', desc: "Og'ir va kuchli. To'siqlarni payqamaydi ham.", eng: 0.55,
    spec: S({ mass: 6500, len: 7.4, wid: 2.4, hgt: 3.1, clr: 0.46, com: 1.25, wx: 1.02, wzF: 2.4, wzR: 1.9, rF: 0.52, rR: 0.52, free: 0.4, travel: 0.27, sag: 0.1, power: 215000, top: 114, a0: 3.0, brake: 8, steer: 0.58, drive: 'rwd', grip: 1.0, down: 0.4 }) },
  { id: 'avtobus', name: 'Avtobus', price: 11000, hex: 0xf0b83a, cls: 'bus', desc: "O'n metrlik gigant. Tor yo'lda haqiqiy sinov!", eng: 0.6,
    spec: S({ mass: 9000, len: 10.4, wid: 2.5, hgt: 3.2, clr: 0.4, com: 1.3, wx: 1.05, wzF: 3.2, wzR: 2.8, rF: 0.5, rR: 0.5, free: 0.38, travel: 0.25, sag: 0.1, power: 195000, top: 106, a0: 2.6, brake: 7.5, steer: 0.62, drive: 'rwd', grip: 1.0, down: 0.3 }) },
  { id: 'kupe', name: 'Sport kupe', price: 13000, hex: 0xd8392b, cls: 'car', desc: 'Past, tez va chiroyli. Asfaltda tengsiz.', eng: 1.3,
    spec: S({ mass: 1300, len: 4.3, wid: 1.84, hgt: 1.3, clr: 0.14, com: 0.46, wx: 0.8, wzF: 1.3, wzR: 1.3, rF: 0.33, rR: 0.33, free: 0.3, travel: 0.2, sag: 0.07, power: 265000, top: 248, a0: 9, brake: 12.5, steer: 0.56, drive: 'rwd', grip: 1.18, down: 2.4 }) },
  { id: 'otochar', name: "O't o'chirish mashinasi", price: 14000, hex: 0xd8392b, cls: 'truck', desc: "Sirenasi bilan! [H] — signal. Narvonli og'ir mashina.", eng: 0.55,
    spec: S({ mass: 8000, len: 8.2, wid: 2.5, hgt: 3.3, clr: 0.44, com: 1.3, wx: 1.05, wzF: 2.7, wzR: 2.2, rF: 0.54, rR: 0.54, free: 0.4, travel: 0.27, sag: 0.1, power: 305000, top: 127, a0: 3.6, brake: 8.5, steer: 0.6, drive: 'awd', grip: 1.02, down: 0.4 }) },
  { id: 'muskul', name: 'Muskul-kar', price: 15000, hex: 0x2a2c33, cls: 'car', desc: "Ulkan dvigatel, orqa yuritma. Drift uchun eng zo'ri!", eng: 0.75,
    spec: S({ mass: 1650, len: 4.9, wid: 1.92, hgt: 1.37, clr: 0.16, com: 0.5, wx: 0.82, wzF: 1.5, wzR: 1.42, rF: 0.34, rR: 0.36, free: 0.32, travel: 0.22, sag: 0.08, power: 345000, top: 252, a0: 9.5, brake: 11.5, steer: 0.58, drive: 'rwd', grip: 1.08, down: 1.5 }) },
  { id: 'limuzin', name: 'Limuzin', price: 16000, hex: 0x1d1e24, cls: 'car', desc: "Yetti metrlik hashamat. To'yga borishga tayyor.", eng: 0.9,
    spec: S({ mass: 2400, len: 7.4, wid: 1.9, hgt: 1.48, clr: 0.16, com: 0.55, wx: 0.82, wzF: 2.65, wzR: 2.55, rF: 0.34, rR: 0.34, free: 0.34, travel: 0.24, sag: 0.09, power: 225000, top: 192, a0: 5.5, brake: 10, steer: 0.64, drive: 'rwd', grip: 1.03, down: 1 }) },
  { id: 'monstr', name: 'Monster-trak', price: 18000, hex: 0x8a54c8, cls: 'car', desc: "Bir metrlik g'ildiraklar! Hamma narsaning ustidan o'tadi.", eng: 0.5,
    spec: S({ mass: 4200, len: 5.4, wid: 3.1, hgt: 3.45, clr: 1.2, com: 1.72, wx: 1.28, wzF: 1.78, wzR: 1.78, rF: 0.92, rR: 0.92, free: 0.8, travel: 0.6, sag: 0.25, power: 720000, top: 136, a0: 8, brake: 9, steer: 0.56, drive: 'awd', grip: 1.16, down: 0 }) },
  { id: 'super', name: 'Superkar', price: 28000, hex: 0xf0b83a, cls: 'car', desc: "325 km/soat. Yerga yopishib yuradi — toshlardan qo'rqadi.", eng: 1.45,
    spec: S({ mass: 1400, len: 4.5, wid: 1.98, hgt: 1.15, clr: 0.115, com: 0.4, wx: 0.86, wzF: 1.34, wzR: 1.32, rF: 0.33, rR: 0.35, free: 0.26, travel: 0.17, sag: 0.06, power: 575000, top: 325, a0: 12.5, brake: 14, steer: 0.52, drive: 'awd', grip: 1.3, down: 3.4 }) },
  { id: 'bolid', name: 'Poyga bolidi', price: 35000, hex: 0xd8392b, cls: 'open', desc: "Orolning eng tez mashinasi. Faqat haqiqiy ustalar uchun.", eng: 1.8,
    spec: S({ mass: 760, len: 5.0, wid: 1.9, hgt: 1.0, clr: 0.095, com: 0.32, wx: 0.82, wzF: 1.75, wzR: 1.6, rF: 0.33, rR: 0.36, free: 0.22, travel: 0.13, sag: 0.045, power: 610000, top: 345, a0: 14, brake: 16, steer: 0.46, drive: 'rwd', grip: 1.42, down: 5.5 }) },
];
export const vehById = Object.fromEntries(VEHICLES.map((v) => [v.id, v]));
// Ko'rsatkichlar (0..1) — salon uchun
export function vehStats(v) {
  const s = v.spec;
  return { speed: Math.min(1, s.top / 345), accel: Math.min(1, s.a0 / 14), grip: Math.min(1, (s.grip - 0.85) / 0.57), offroad: Math.min(1, (s.clr * 1.6 + (s.drive === 'awd' ? 0.3 : 0.08) + s.travel * 0.5 + (s.bike ? 0.15 : 0)) / 1.35), strong: Math.min(1, Math.sqrt(s.mass / 9000)) };
}


function extrude(g, pts, hw) {
  let cz = 0, cy = 0; for (const p of pts) { cz += p[0]; cy += p[1]; } cz /= pts.length; cy /= pts.length;
  const n = pts.length, X = (p, sd) => [sd * hw * (p[2] == null ? 1 : p[2]), p[1], p[0]];
  for (let i = 0; i < n; i++) {
    const a = pts[i], b = pts[(i + 1) % n];
    const ez = b[0] - a[0], ey = b[1] - a[1]; let nz = ey, ny = -ez; // chetga perpendikulyar
    const out = nz * ((a[0] + b[0]) / 2 - cz) + ny * ((a[1] + b[1]) / 2 - cy) > 0;
    const A = X(a, 1), B = X(b, 1), C = X(b, -1), D = X(a, -1);
    // tashqi normal (0,ny,nz) bo'lishi kerak: (B-A)x(D-A) ning yo'nalishini tekshiramiz
    const ux = B[0] - A[0], uy = B[1] - A[1], uz = B[2] - A[2], vx = D[0] - A[0], vy = D[1] - A[1], vz = D[2] - A[2];
    const fy = uz * vx - ux * vz, fz = ux * vy - uy * vx; const same = fy * ny + fz * nz > 0;
    if (same === out) g.quad(A, B, C, D); else g.quad(A, D, C, B);
  }
  for (const sd of [1, -1]) { g.newFace(); for (let i = 1; i < n - 1; i++) { const a = X(pts[0], sd), b = X(pts[i], sd), c = X(pts[i + 1], sd); const nx = (b[1] - a[1]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[1] - a[1]); if (nx * sd > 0) g.tri(a, b, c, true); else g.tri(a, c, b, true); } }
  return g;
}
// Ikki nuqta orasidagi "suyak" (qo'l/oyoq/quvur)
function limb(g, a, b, t, t2 = t) {
  const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], len = Math.hypot(dx, dy, dz) || 0.01;
  g.push().translate((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2).rotY(Math.atan2(dx, dz)).rotX(-Math.atan2(dy, Math.hypot(dx, dz)));
  g.box(0, 0, 0, t, t2, len); g.pop(); return g;
}

// ---------- umumiy yordamchilar ----------
let LITE = false; // yo'l harakati uchun yengil variant (buildVehicle(id, { lite: true }))
const PLAST = 0x1e1f23, CHROME = 0xd0d4da, BLACKG = 0x0d0e10;
// Quruvchilar to'plami: bo'yoq, trim (aRM bilan), oyna, chiroqlar (old, orqa, tormoz, orqaga yurish, burilish chap/o'ng), qismlar
const newB = (seed) => {
  const mk = (i) => new VB(seed * 7 + i, 0);
  const b = { paint: mk(1), trim: mk(2), glass: mk(3), head: mk(4), tail: mk(5), brake: mk(6), rev: mk(7), sigL: mk(8), sigR: mk(9), parts: {}, wheels: [], P: (i) => mk(20 + i) };
  for (const k of ['paint', 'glass', 'head', 'tail', 'brake', 'rev', 'sigL', 'sigR']) b[k].color(0xffffff);
  b.trim.rm(0.6, 0); return b;
};
const std4 = (B, s, w, o) => { const wr = w * (s.rR > s.rF * 1.2 ? 1.5 : 1); B.wheels.push({ r: s.rF, w, x: s.wx, z: s.wzF, src: [0], front: true, o }, { r: s.rF, w, x: -s.wx, z: s.wzF, src: [1], front: true, o }, { r: s.rR, w: wr, x: s.wx, z: -s.wzR, src: [2], o }, { r: s.rR, w: wr, x: -s.wx, z: -s.wzR, src: [3], o }); };

// Yig'ish: materiallar, qismlar, g'ildiraklar (burilish -> ezilish -> aylanish guruhlari), chiroqlar
function assemble(v, B) {
  const s = v.spec, root = new THREE.Group(), tilt = new THREE.Group(); root.add(tilt);
  const M = vmats(), paintMat = paintMaterial(v.hex, B.seam), partPaint = paintMaterial(v.hex); partPaint.color = paintMat.color; // bitta rang obyekti: setPaint ikkalasini bo'yaydi
  const mesh = (gb, mat, shadow = true, weld = false) => { const m = new THREE.Mesh(gb.build(weld), mat); m.castShadow = shadow; m.receiveShadow = true; tilt.add(m); return m; };
  const body = mesh(B.paint, paintMat, true, true), trimMesh = mesh(B.trim, M.trim, true, true);
  const deform = [body, trimMesh];
  if (B.glass.count) { const gm = mesh(B.glass, M.glass, false, true); gm.receiveShadow = false; deform.push(gm); }
  const parts = {};
  for (const name in B.parts || {}) {
    const [gb, zone, thr, painted] = B.parts[name]; if (!gb.count) continue;
    const geo = gb.build(), c = new THREE.Vector3(); geo.boundingBox.getCenter(c); geo.translate(-c.x, -c.y, -c.z);
    const m = new THREE.Mesh(geo, painted ? partPaint : M.trim); m.position.copy(c); m.castShadow = true; m.receiveShadow = true; tilt.add(m); parts[name] = { mesh: m, zone, thr, on: true, home: c.clone() };
  }
  const L = (gb, hex) => { const mt = lampMat(hex); if (gb.count) tilt.add(new THREE.Mesh(gb.build(), mt)); return mt; };
  const headMat = L(B.head, 0xd8d6cc), tailMat = L(B.tail, 0x7a1010), brakeMat = L(B.brake, 0x7a1010), revMat = L(B.rev, 0x8a8a86), sigLMat = L(B.sigL, 0x8a5212), sigRMat = L(B.sigR, 0x8a5212);
  brakeMat.color = tailMat.color; // hozircha orqa chiroq bilan birga yonadi (alohida boshqarish: m.brakeMat.color = m.brakeMat.color.clone())
  const wheels = [], geos = {};
  for (const w of B.wheels) {
    const o = Object.assign({ lite: LITE }, w.o || {}), key = w.r + '_' + w.w + '_' + JSON.stringify(o);
    const geo = geos[key] || (geos[key] = o.thin ? bikeWheelGeo(w.r, w.w, o) : wheelGeo(w.r, w.w, o));
    const pivot = new THREE.Group(), sq = new THREE.Group(), spin = new THREE.Group(), m = new THREE.Mesh(geo, M.trim);
    m.castShadow = true; m.receiveShadow = true; spin.add(m); sq.add(spin); pivot.add(sq); tilt.add(pivot); if (w.x < 0) sq.scale.x = -1;
    if (!o.thin && !o.noCal && o.style !== 'steel' && o.style !== 'disc') { const ck = 'c' + key, c = new THREE.Mesh(geos[ck] || (geos[ck] = caliperGeo(w.r, w.w, o)), M.trim); if (w.x < 0) c.scale.x = -1; pivot.add(c); }
    wheels.push({ pivot, mesh: sq, spin, src: w.src, x: w.x, z: w.z, front: !!w.front, r: w.r });
  }
  const spot = new THREE.SpotLight(0xfff0d0, 0, 120, 0.62, 0.55, 1.0);
  spot.position.set(0, B.lampY != null ? B.lampY : 0.3, s.len / 2 - 0.1); spot.target.position.set(0, -1.6 - s.com + 0.79, s.len / 2 + 20); root.add(spot); root.add(spot.target);
  let rider = null;
  if (B.rider) { const g = riderGeo2(B.rider); if (B.rider.x) g.translate(B.rider.x, 0, 0); rider = new THREE.Mesh(g, M.trim); rider.castShadow = true; rider.receiveShadow = true; rider.visible = false; tilt.add(rider); }
  const out = { id: v.id, v, spec: s, root, tilt, body, trimMesh, deform, parts, paintMat, headMat, tailMat, brakeMat, revMat, sigLMat, sigRMat, wheels, spot, rider, open: !!B.rider, fork: null, crank: null, bike: !!s.bike, _seam: B.seam, _partPaint: partPaint };
  if (B.fork) { const f = new THREE.Mesh(B.fork.build(), M.trim); f.castShadow = true; f.receiveShadow = true; f.position.set(0, 0, s.wzF); f.geometry.translate(0, 0, -s.wzF); tilt.add(f); out.fork = f; }
  if (B.crank) { const c = new THREE.Mesh(B.crank.gb.build(), M.trim); c.castShadow = true; c.position.set(0, B.crank.y, B.crank.z); c.geometry.translate(0, -B.crank.y, -B.crank.z); tilt.add(c); out.crank = c; }
  return out;
}

// ---------- yengil mashinalar: silliq kesimli korpus ----------
// o.top/o.belt/o.bot: [[z, y(korpus tagidan), r]] — yon siluet; o.win: yon oynalar [[old z, orqa z]]; o.cowl/rf/rr/deck — old oyna tagi, tom boshi/oxiri, orqa oyna tagi
function genCar(v, o) {
  const s = v.spec, B = newB(v.id.length * 13 + Math.round(s.len * 10)), P = B.paint, T = B.trim, G = B.glass;
  const hl = o.hl || s.len / 2, yb = s.clr - s.com + (o.y0 || 0), W = o.W || s.wid / 2 - 0.012, Y = (y) => yb + y, sc = (a) => a.map((p) => [p[0], Y(p[1]), p[2] || 0]);
  const ww = o.ww || s.rF * 0.64, wr = ww * (s.rR > s.rF * 1.2 ? 1.5 : 1);
  const wd = o.lift ? [] : [[s.wzF, s.rF, ww], [-s.wzR, s.rR, wr]].map(([z, r, w]) => ({ z, cy: r - s.com, r, ra: r + (o.gap || 0.05), xin: s.wx - w * 0.5 - 0.07 }));
  const D = { hl, W, zc: o.zc || 0, top: sc(o.top), bot: sc(o.bot || [[hl, 0.25], [hl - 0.36, 0.05, 0.25], [-hl + 0.4, 0.05, 0.25], [-hl, 0.3]]), belt: sc(o.belt),
    tumble: o.tumble, hoodX: o.hoodX, pF: o.pF, pR: o.pR, taperF: o.taperF, taperR: o.taperR, side: o.side, flare: o.flare, crown: o.crown, crownH: o.crownH,
    roofY: Y(o.roofY), hoodY: Y(o.hoodY), rcF: o.rcF, rcR: o.rcR, wheels: wd, step: (o.step || 0.08) * (LITE ? 1.55 : 1), need: [o.cowl, o.rf, o.rr, o.deck, ...(o.win || []).flat(), ...(o.need || [])], cabZ: o.cabZ };
  const body = makeBody(D), GG = body.G;
  // kataklarni taqsimlash
  const wins = o.win || [], inWin = (z) => wins.some(([a, b]) => z < a && z > b), pillar = (z) => !inWin(z) && z < wins[0][0] && z > wins[wins.length - 1][1];
  const hoodP = B.hoodP = o.hoodPart ? B.P(6).color(0xffffff) : null, bF = B.bF = B.P(1).color(0xffffff), bR = B.bR = B.P(2).color(0xffffff), sep = o.bump === 'sep';
  const zBF = s.wzF + s.rF + 0.06, zBR = -s.wzR - s.rR - 0.06, yBF = Y(o.bumpY != null ? o.bumpY : o.top[0][1] + 0.04), yBR = Y(o.bumpYR != null ? o.bumpYR : 0.5), clad = o.clad ? Y(o.clad) : -1e9;
  const blA = o.bl ? (o.blz ? o.blz[0] : o.rr) : null, blB = o.bl ? (o.blz ? o.blz[1] : o.deck) : null;
  const cy = (i, j) => (GG[i][j][1] + GG[i][j + 1][1] + GG[i + 1][j][1] + GG[i + 1][j + 1][1]) / 4;
  emitBody(body, (i, j, s0, s1) => {
    const zc = (s0.z + s1.z) / 2;
    if (j < 2) return T.mat(0x17181b, 0.92, 0);
    if (j < 8) {
      if ((s0.raised[j] && s0.raised[j + 1]) || (s1.raised[j] && s1.raised[j + 1]) || (j === 2 && (s0.raised[3] || s1.raised[3]))) return T.mat(0x111214, 0.95, 0);
      const yc = cy(i, j);
      if (!sep && zc > zBF && yc < yBF) return bF;
      if (!sep && zc < zBR && yc < yBR) return bR;
      if (yc < clad) return T.mat(o.cladC || 0x25262a, 0.7, 0);
      return P;
    }
    if (o.open && o.open(zc, j)) return null;
    if (j === 8) return inWin(zc) ? T.mat(BLACKG, 0.35, 0) : P;
    if (j < 12) { const h0 = s0.P[12][1] - s0.P[9][1], h1 = s1.P[12][1] - s1.P[9][1]; if (inWin(zc) && h0 > 0.03 && h1 > 0.03) return G; if (o.bpBlack && pillar(zc) && h0 > 0.03) return T.mat(BLACKG, 0.1, 0); return P; }
    if (j < 14) return P;
    if (o.cowl != null && zc < o.cowl && zc > o.rf) return G;
    if (o.bl && zc < blA && zc > blB) return G;
    if (o.sunroof && zc < o.sunroof[0] && zc > o.sunroof[1] && j >= 15) return G;
    if (hoodP && zc < hl - 0.05 && zc > o.cowl + 0.035) return hoodP;
    return P;
  }, (i, j, st) => { const y = GG[i][j][1]; return 0.8 + 0.2 * Math.min(1, Math.max(0, (y - st.yB) / 0.32)); });
  if (hoodP) B.parts.hood = [hoodP, 'front', 26, true];
  // panel chiziqlari (bo'yoq sheyderida)
  const hz = body.section(o.cowl + 0.3 < hl ? o.cowl + 0.3 : hl - 0.2).P[14][0], tz = blB != null ? body.section(blB - 0.2).P[14][0] : 0;
  B.seam = { a: [o.hoodPart || o.hoodSeam ? o.cowl + 0.035 : -99, hz, o.trunk ? blB - 0.035 : -99, tz], b: (o.doors || []).concat([-99, -99, -99, -99]).slice(0, 4), c: [Y(0.1), Y((o.belt[1] || o.belt[0])[1]) - 0.015, W * 0.72, Y(Math.min(o.hoodY, o.deckY || 9) - 0.12)] };
  const ctx = { s, B, body, W, yb, Y, hl, o, wd, ww, wr };
  // g'ildirak arkasi qoplamasi (ichkariga qaragan qora yarim silindr)
  for (const w of wd) for (const sd of [1, -1]) { T.mat(0x0f1012, 0.95, 0); T.push().translate(0, w.cy, w.z); if (sd < 0) T.scale(-1, 1, 1); T.lathe([[w.ra + 0.01, w.xin - 0.03], [w.ra + 0.01, W * 0.99]], LITE ? 10 : 16, { a0: -1.85, a1: 1.85, inv: true }); T.pop(); }
  carLamps(ctx); carTrim(ctx);
  if (!LITE && o.cowl != null) carInterior(ctx);
  if (o.extra) o.extra(ctx);
  std4(B, s, ww, Object.assign({ prof: o.prof || 'road', rim: o.rim, style: o.wstyle, spokes: o.spokes, cal: o.cal }, o.wo || {}));
  if (o.driver !== false && o.cowl != null) B.rider = { x: s.wx * 0.42, hip: [0, Y(o.seatY || 0.36), o.seatZ != null ? o.seatZ : (o.cowl + o.rf) / 2 - 0.75], lean: o.drvLean || -0.18, hand: [0.18, Y(o.belt[1][1] + 0.02), (o.cowl + o.rf) / 2 - 0.22], foot: [0.16, Y(0.12), o.cowl - 0.12], knee: 0.16, shirt: 0x3a4a62, pants: 0x2a2d36 };
  return assemble(v, B);
}

// Chiroqlar, panjara, nomer: old/orqa yuzaga yopishgan yamoqlar
function carLamps(c) {
  const { B, body, W, Y, o, s, hl } = c, T = B.trim;
  const h = o.head || [0.5, 0.88, o.top[0][1] - 0.05, o.top[0][1] + 0.07], t = o.tail || [0.55, 0.92, 0.6, 0.76];
  for (const sd of [1, -1]) {
    const X = (f) => sd * W * f, sig = sd > 0 ? B.sigL : B.sigR;
    // old fara: qora korpus + xrom gardish + linza (+ proyektor va kunduzgi chiziq)
    const [x0, x1, y0, y1] = [W * h[0], W * h[1], Y(h[2]), Y(h[3])], ex = (x1 - x0) * 0.06, ey = (y1 - y0) * 0.12;
    T.mat(0x24262b, 0.18, 0.85); endPatch(body, T, 1, sd * (x0 - ex), sd * (x1 + ex), y0 - ey, y1 + ey, 4, 2, 0.004);
    endPatch(body, B.head, 1, sd * x0, sd * x1, y0, y1, 5, 2, 0.007, 0.42);
    const pc = x0 + (x1 - x0) * 0.32, pr = Math.min(x1 - x0, y1 - y0) * 0.3;
    endPatch(body, B.head, 1, sd * (pc - pr), sd * (pc + pr), (y0 + y1) / 2 - pr, (y0 + y1) / 2 + pr, 2, 2, 0.011, 1);
    if (!o.roundLamp) endPatch(body, B.head, 1, sd * (x0 + (x1 - x0) * 0.58), sd * (x1 - (x1 - x0) * 0.04), y1 - (y1 - y0) * 0.24, y1 - (y1 - y0) * 0.06, 3, 1, 0.011, 1);
    endPatch(body, sig, 1, sd * (x1 - (x1 - x0) * 0.18), sd * x1, y0 + (y1 - y0) * 0.1, y0 + (y1 - y0) * 0.5, 1, 1, 0.011, 1);
    // orqa chiroq: korpus, qizil linza, tormoz, orqaga yurish (oq), burilish (sariq)
    const [u0, u1, v0, v1] = [W * t[0], W * t[1], Y(t[2]), Y(t[3])];
    T.mat(0x2a1414, 0.2, 0.5); endPatch(body, T, -1, sd * (u0 - 0.006), sd * (u1 + 0.004), v0 - 0.008, v1 + 0.008, 4, 2, 0.004);
    endPatch(body, B.tail, -1, sd * u0, sd * u1, v0, v1, 4, 2, 0.007, 0.75);
    endPatch(body, B.brake, -1, sd * (u0 + (u1 - u0) * 0.45), sd * (u1 - (u1 - u0) * 0.06), v0 + (v1 - v0) * 0.52, v1 - (v1 - v0) * 0.1, 2, 1, 0.01, 1);
    endPatch(body, B.rev, -1, sd * (u0 + (u1 - u0) * 0.05), sd * (u0 + (u1 - u0) * 0.38), v0 + (v1 - v0) * 0.12, v0 + (v1 - v0) * 0.46, 2, 1, 0.01, 1);
    endPatch(body, sig, -1, sd * (u0 + (u1 - u0) * 0.45), sd * (u1 - (u1 - u0) * 0.06), v0 + (v1 - v0) * 0.12, v0 + (v1 - v0) * 0.44, 2, 1, 0.01, 1);
    if (o.tailBar && sd > 0) endPatch(body, B.tail, -1, -u0 + 0.02, u0 - 0.02, v1 - (v1 - v0) * 0.38, v1 - (v1 - v0) * 0.12, 6, 1, 0.007, 0.7);
  }
  B.lampY = Y((h[2] + h[3]) / 2);
  // panjara va pastki havo olgich
  const gr = o.grille || [0.42, o.top[0][1] - 0.12, o.top[0][1] + 0.04];
  const grB = o.grillePaint ? B.paint : T;
  grB.mat(0x141518, 0.35, 0.2);
  endPatch(body, grB, 1, -W * gr[0], W * gr[0], Y(gr[1]), Y(gr[2]), 8, 4, 0.006, (a, b) => (a % 2 ? 0.55 : 1.4));
  if (o.chromeBar) { T.mat(CHROME, 0.12, 1); endPatch(body, T, 1, -W * gr[0] * 1.02, W * gr[0] * 1.02, Y(gr[2]) - 0.01, Y(gr[2]) + 0.012, 6, 1, 0.01); }
  if (!o.noIntake) { T.mat(0x111215, 0.5, 0); endPatch(body, T, 1, -W * 0.55, W * 0.55, Y(0.12), Y(0.2), 6, 1, 0.005); }
  // nomer belgilari (alohida qism: bamper bilan birga uchadi)
  const plate = (g, end, yc) => { g.mat(0xe9e9e2, 0.45, 0); endPatch(body, g, end, -0.26, 0.26, yc - 0.06, yc + 0.06, 3, 1, 0.012); g.mat(0x1d2a6a, 0.5, 0); endPatch(body, g, end, end > 0 ? 0.2 : -0.26, end > 0 ? 0.26 : -0.2, yc - 0.055, yc + 0.055, 1, 1, 0.0135); g.mat(0x16171a, 0.6, 0); for (let i = 0; i < 6; i++) { const x = -0.16 + i * 0.058 + (i > 2 ? 0.02 : 0); endPatch(body, g, end, x - 0.016, x + 0.016, yc - 0.027, yc + 0.027, 1, 1, 0.0138); } };
  const pF = B.P(9); plate(pF, 1, Y(o.plateF || 0.22)); B.parts.plateF = [pF, 'front', 50];
  plate(T, -1, Y(o.plateR || 0.42));
}
// Ko'zgular, tutqichlar, artgichlar, egzoz, antenna
function carTrim(c) {
  const { B, body, W, Y, o, s, hl } = c, T = B.trim;
  const sep = o.bump === 'sep';
  // ko'zgular (bo'yalgan qism, oynasi qora — lak aks ettiradi)
  if (o.cowl != null) for (const sd of [1, -1]) {
    const q = B.P(sd > 0 ? 3 : 4), z = o.cowl - 0.16, y = Y(o.belt[1][1] + 0.08), x = body.halfW(z, Y(o.belt[1][1])) ;
    q.color(0x111215).tube([[sd * (x - 0.02), y - 0.04, z + 0.02], [sd * (x + 0.08), y - 0.02, z]], [0.022, 0.016], 6, { cap: true });
    q.color(o.mirC || 0xffffff).rbox(sd * (x + 0.15), y, z, 0.16, 0.11, 0.1, 0.04, 2, { tz: 0.85 });
    q.color(0x0b0c0e).rbox(sd * (x + 0.15), y, z - 0.047, 0.135, 0.085, 0.012, 0.02, 1);
    B.parts[sd > 0 ? 'mirL' : 'mirR'] = [q, sd > 0 ? 'left' : 'right', 62, true];
  }
  // eshik tutqichlari
  T.mat(o.handleC || 0x2a2c31, 0.2, o.handleC ? 0.9 : 0.3);
  for (const z of o.handles || []) for (const sd of [1, -1]) sidePatch(body, T, sd, z - 0.07, z + 0.07, Y(o.belt[1][1] - 0.1), Y(o.belt[1][1] - 0.065), 2, 1, 0.008);
  // artgichlar (old oyna tagida)
  if (o.cowl != null && o.rf != null) {
    T.mat(0x0c0d0f, 0.4, 0.3); const zw = o.cowl - Math.max(0.04, (o.cowl - o.rf) * 0.1);
    for (const [xa, xb] of [[-0.04, W * 0.66], [-W * 0.7, -W * 0.08]]) { const pts = []; for (let k = 0; k <= 4; k++) { const x = xa + (xb - xa) * k / 4, z = zw - Math.abs(x - xa) * 0.05; pts.push([x, body.topY(Math.abs(x), z) + 0.014, z]); } T.tube(pts, 0.008, 4, { sy: 0.5 }); }
  }
  // egzoz quvurlari
  for (const ex of o.exhaust || []) for (const sd of ex.dual ? [1, -1] : [1]) { const x = sd * W * ex.x, y = Y(ex.y || 0.13), z = body.endZ(Math.abs(x), y, -1); T.mat(CHROME, 0.15, 1); T.tube([[x, y, z + 0.18], [x, y, z - 0.05]], ex.r || 0.035, 10); T.mat(0x050505, 0.9, 0).rod([x, y, z - 0.03], [x, y, z - 0.048], (ex.r || 0.035) * 0.8, (ex.r || 0.035) * 0.8, 8, true); }
  // bamperlar (alohida: jip, pikap) — korpus burchagi bo'ylab egilgan
  if (sep) {
    const bF = B.bF, bR = B.bR, bc = o.bumpC || 0x2d2f34;
    for (const [g, end] of [[bF, 1], [bR, -1]]) {
      g.mat(bc, 0.55, 0.3); const y = Y(end > 0 ? o.bumpH || 0.2 : o.bumpHR || 0.22), z = body.endZ(0, y, end), zo = z + end * 0.07, w = W * 0.98;
      g.sweep([[-w, y, zo - end * 0.18], [-w * 0.92, y, zo - end * 0.02], [0, y, zo], [w * 0.92, y, zo - end * 0.02], [w, y, zo - end * 0.18]], [[-0.07, -0.1], [0.07, -0.1], [0.08, 0.1], [-0.07, 0.11]].map((p) => [p[0] * end, p[1]]), [0, 1, 0], { closed: true, flat: true });
      g.mat(0x111215, 0.8, 0).rbox(0, y - 0.15, zo - end * 0.06, W * 0.9, 0.06, 0.18, 0.02, 1);
    }
    B.parts.bumpF = [bF, 'front', 52]; B.parts.bumpR = [bR, 'rear', 48];
  } else { B.parts.bumpF = [B.bF, 'front', 52, true]; B.parts.bumpR = [B.bR, 'rear', 48, true]; }
  // antenna (akula qanoti)
  if (o.fin && o.rr != null) { const z = o.rr + 0.12, y = body.topY(0, z); B.paint.rbox(0, y + 0.03, z, 0.05, 0.07, 0.17, 0.02, 1, { tz: 0.4 }); }
  // dvigatel bo'limi (kapot uchsa ko'rinadi) va ichki zarba to'sig'i
  if (o.hoodPart) { const hy = Math.min(o.hoodY, o.top[1][1]); T.mat(0x2e3036, 0.5, 0.6).rbox(0, Y(hy - 0.4), (o.cowl + hl) / 2, W * 1.1, 0.34, (hl - o.cowl) * 0.6, 0.04, 1); T.mat(0x8a8e96, 0.3, 0.9).rbox(0, Y(hy - 0.21), (o.cowl + hl) / 2 - 0.1, W * 0.6, 0.06, (hl - o.cowl) * 0.3, 0.02, 1); }
  T.mat(0x18191c, 0.7, 0.2).rbox(0, Y(0.3), body.endZ(0, Y(0.3), 1) - 0.32, W * 1.05, 0.26, 0.12, 0.03, 1);
}
// Salon: torpeda, rul, o'rindiqlar, eshik qoplamalari, shift
function carInterior(c) {
  const { B, body, W, Y, o, s } = c, T = B.trim, belt = o.belt[1][1], cw = o.cowl, rf = o.rf, rr = o.rr != null ? o.rr : -c.hl + 0.4;
  const seatC = o.seatC || 0x2a2b30, zd = cw - Math.max(0.28, (cw - rf) * 0.35), drvX = s.wx * 0.42;
  T.mat(0x1c1d21, 0.75, 0).rbox(0, Y(belt - 0.06), zd - 0.12, W * 1.72, 0.2, 0.42, 0.06, 1); // torpeda
  T.mat(0x111214, 0.6, 0).rbox(0, Y(belt - 0.25), zd - 0.45, 0.22, 0.32, 0.5, 0.04, 1); // markaziy konsol
  // rul
  const wc = [drvX, Y(belt + 0.04), zd - 0.38], R = 0.17, tl = 0.38, ring = [];
  for (let k = 0; k <= 16; k++) { const a = (k / 16) * Math.PI * 2; ring.push([wc[0] + Math.cos(a) * R, wc[1] + Math.sin(a) * R * Math.cos(tl), wc[2] + Math.sin(a) * R * Math.sin(tl)]); }
  T.mat(0x121316, 0.5, 0).tube(ring, 0.018, 6); T.rod([wc[0], wc[1], wc[2]], [wc[0], wc[1] - 0.1, wc[2] + 0.28], 0.03, 0.04, 6);
  T.rod([wc[0] - R, wc[1], wc[2]], [wc[0] + R, wc[1], wc[2]], 0.012, 0.012, 4, false);
  // o'rindiqlar
  const seat = (x, z, wdt) => { T.mat(seatC, 0.92, 0).rbox(x, Y(0.3), z, wdt, 0.13, 0.5, 0.05, 1); T.push().translate(x, Y(0.36), z - 0.24).rotX(-0.22); T.rbox(0, 0.3, 0, wdt * 0.94, 0.62, 0.13, 0.05, 1); if (wdt < 0.7) T.rbox(0, 0.68, 0.02, wdt * 0.5, 0.16, 0.1, 0.04, 1); T.pop(); };
  const zs = o.seatZ != null ? o.seatZ : (cw + rf) / 2 - 0.75;
  seat(drvX, zs, 0.5); seat(-drvX, zs, 0.5);
  if (!o.twoSeat && zs - 0.9 > rr - 0.1) seat(0, zs - 0.9, W * 1.5);
  T.mat(0x141518, 0.95, 0).rbox(0, Y(0.16), (zs + rr) / 2 + 0.1, W * 1.7, 0.04, Math.max(0.6, zs - rr + 0.8), 0.02, 1); // pol
  // eshik qoplamalari va shift (ichkariga qaragan)
  const z0 = cw - 0.05, z1 = rr + 0.03;
  T.mat(0x1d1e22, 0.85, 0); emitInner(body, T, (i, j, a, b) => j >= 3 && j < 8 && a.z < z0 && b.z > z1 - 0.3 && !(a.raised[j] || b.raised[j]), 0.03);
  T.mat(0x8c8a84, 0.9, 0); emitInner(body, T, (i, j, a, b) => j >= 12 && a.z < rf && b.z > rr, 0.025);
}

// Uslublar: korpus siluetlari (y — korpus tagidan, z — markazdan; old +)
const STYLE = {
  xetch: { cowl: 0.83, rf: 0.22, rr: -1.32, deck: -1.79, top: [[1.875, 0.4], [1.8, 0.6, 0.1], [1.6, 0.67, 0.26], [0.83, 0.79, 0.16], [0.22, 1.3, 0.36], [-1.32, 1.29, 0.26], [-1.79, 1.0, 0.08], [-1.875, 0.62]], belt: [[1.875, 0.58], [0.83, 0.74], [-1.875, 0.85]],
    roofY: 1.3, hoodY: 0.79, deckY: 1.0, tumble: 0.8, hoodX: 0.86, pF: 2.8, pR: 4.5, win: [[0.83, -0.25], [-0.32, -1.18]], bl: true, bpBlack: true, doors: [0.8, -0.28, -0.85], hoodSeam: true, handles: [-0.12, -0.98],
    head: [0.48, 0.9, 0.5, 0.62], tail: [0.62, 0.95, 0.66, 0.9], grille: [0.42, 0.32, 0.46], plateR: 0.48, exhaust: [{ x: 0.45 }], rim: 0xa8acb4, wstyle: 'y', spokes: 5 },
  sedan: { cowl: 0.95, rf: 0.3, rr: -0.95, deck: -1.6, top: [[2.25, 0.44], [2.16, 0.64, 0.1], [1.95, 0.7, 0.3], [0.95, 0.8, 0.15], [0.3, 1.255, 0.4], [-0.95, 1.25, 0.42], [-1.6, 0.89, 0.12], [-2.12, 0.86, 0.12], [-2.25, 0.62]], belt: [[2.25, 0.58], [0.95, 0.76], [-2.25, 0.86]],
    roofY: 1.255, hoodY: 0.8, deckY: 0.89, tumble: 0.8, hoodX: 0.86, win: [[0.93, -0.27], [-0.35, -1.0]], bl: true, bpBlack: true, doors: [0.9, -0.31, -0.98], hoodPart: true, trunk: true, handles: [-0.15, -0.88], fin: true,
    head: [0.5, 0.9, 0.5, 0.62], tail: [0.5, 0.95, 0.66, 0.8], tailBar: true, grille: [0.45, 0.34, 0.48], chromeBar: true, plateR: 0.62, exhaust: [{ x: 0.55, dual: true }], rim: 0xc4c8ce, wstyle: 'split', spokes: 5 },
  pikap: { cowl: 1.25, rf: 0.72, rr: -0.5, top: [[2.55, 0.62], [2.47, 0.86, 0.08], [2.3, 0.92, 0.16], [1.25, 1.0, 0.12], [0.72, 1.48, 0.28], [-0.44, 1.49, 0.08], [-0.52, 1.0, 0.03], [-2.5, 0.98], [-2.55, 0.8]], belt: [[2.55, 0.82], [1.25, 0.98], [-2.55, 0.98]],
    bot: [[2.55, 0.3], [2.2, 0.05, 0.2], [-2.2, 0.05, 0.2], [-2.55, 0.3]], roofY: 1.49, hoodY: 1.0, tumble: 0.9, hoodX: 0.9, pF: 4, rcR: 0.07, side: [0.995, 1, 0.997, 0.99], win: [[1.23, -0.08], [-0.16, -0.42]], doors: [1.2, -0.12], hoodPart: true, handles: [-0.2],
    open: (z, j) => z < -0.55 && j >= 9, clad: 0.16, flare: 0.03, bump: 'sep', bumpC: 0x9ea3ab, bumpH: 0.24, bumpHR: 0.28, head: [0.56, 0.9, 0.6, 0.76], tail: [0.86, 0.99, 0.5, 0.9], grille: [0.5, 0.42, 0.72], chromeBar: true, noIntake: true, plateF: 0.24, plateR: 0.3, prof: 'off', rim: 0x9da2aa, wstyle: 'y', spokes: 6, ww: 0.27, exhaust: [{ x: 0.6 }],
    extra: (c) => { pickupBed(c, -0.56); flares(c, 0.06); bullBar(c); } },
  furgon: { cowl: 1.72, rf: 1.05, top: [[2.5, 0.55], [2.42, 0.86, 0.12], [2.2, 0.95, 0.2], [1.72, 1.02, 0.16], [1.05, 2.02, 0.32], [-2.4, 2.04, 0.1], [-2.5, 1.86]], belt: [[2.5, 0.8], [1.72, 1.0], [-2.5, 1.08]],
    roofY: 2.04, hoodY: 1.02, tumble: 0.93, hoodX: 0.9, pF: 2.6, rcR: 0.12, side: [0.998, 1, 0.998, 0.99], win: [[1.7, 0.95]], doors: [1.68, 0.92, -0.75], handles: [1.0, -0.6], seatZ: 0.55, twoSeat: true,
    head: [0.55, 0.92, 0.62, 0.78], tail: [0.86, 0.99, 0.55, 1.15], grille: [0.5, 0.4, 0.6], plateR: 0.4, rim: 0x2a2c30, wstyle: 'steel', ww: 0.24,
    extra: (c) => { rearPanes(c, [[0.42, 0.06, 1.3, 1.85]]); sidePanes(c, [[0.75, -0.65], [-0.75, -2.15]], 1.25, 1.8); } },
  ralli: { cowl: 0.9, rf: 0.32, rr: -1.15, deck: -1.85, top: [[2.025, 0.4], [1.95, 0.58, 0.1], [1.75, 0.65, 0.25], [0.9, 0.76, 0.15], [0.32, 1.22, 0.35], [-1.15, 1.22, 0.3], [-1.85, 0.92, 0.08], [-2.025, 0.6]], belt: [[2.025, 0.56], [0.9, 0.72], [-2.025, 0.82]],
    roofY: 1.22, hoodY: 0.76, deckY: 0.92, tumble: 0.8, hoodX: 0.86, flare: 0.035, win: [[0.88, -0.25], [-0.33, -1.05]], bl: true, bpBlack: true, doors: [0.86, -0.29, -0.82], hoodPart: true, handles: [-0.12, -0.9],
    head: [0.46, 0.88, 0.48, 0.6], tail: [0.62, 0.95, 0.64, 0.86], grille: [0.46, 0.3, 0.46], plateR: 0.46, prof: 'off', rim: 0xf2f2ee, wstyle: 'y', spokes: 6, exhaust: [{ x: 0.5, r: 0.045 }],
    extra: (c) => { rally(c); } },
  kupe: { cowl: 0.82, rf: 0.15, rr: -0.62, deck: -1.62, top: [[2.15, 0.38], [2.06, 0.55, 0.1], [1.85, 0.62, 0.3], [0.82, 0.72, 0.18], [0.15, 1.15, 0.4], [-0.62, 1.14, 0.45], [-1.62, 0.8, 0.16], [-2.05, 0.77, 0.12], [-2.15, 0.52]], belt: [[2.15, 0.52], [0.82, 0.68], [-2.15, 0.78]],
    roofY: 1.15, hoodY: 0.72, deckY: 0.8, tumble: 0.76, hoodX: 0.86, pF: 2.6, win: [[0.8, -0.72]], bl: true, doors: [0.78, -0.62], hoodPart: true, trunk: true, handles: [-0.45], seatY: 0.3, twoSeat: true, fin: true,
    head: [0.5, 0.92, 0.44, 0.53], tail: [0.48, 0.95, 0.6, 0.72], tailBar: true, grille: [0.4, 0.26, 0.4], plateR: 0.55, prof: 'sport', rim: 0x2c2e33, wstyle: 'split', spokes: 5, cal: 0xc0302a, exhaust: [{ x: 0.5, dual: true, r: 0.04 }],
    extra: (c) => { lipSpoiler(c, true); splitter(c); } },
  muskul: { cowl: 0.7, rf: 0.05, rr: -0.85, deck: -1.8, top: [[2.45, 0.48], [2.38, 0.66, 0.08], [2.2, 0.7, 0.2], [0.7, 0.76, 0.15], [0.05, 1.2, 0.35], [-0.85, 1.2, 0.4], [-1.8, 0.84, 0.12], [-2.35, 0.82, 0.1], [-2.45, 0.58]], belt: [[2.45, 0.6], [0.7, 0.72], [-2.45, 0.8]],
    roofY: 1.2, hoodY: 0.76, deckY: 0.84, tumble: 0.8, hoodX: 0.88, pF: 3.6, pR: 4.5, side: [1, 0.998, 0.99, 0.975], win: [[0.68, -0.82]], bl: true, doors: [0.66, -0.72], hoodPart: true, trunk: true, handles: [-0.55], twoSeat: false,
    head: [0.55, 0.9, 0.44, 0.58], roundLamp: true, tail: [0.15, 0.95, 0.58, 0.72], tailBar: true, grille: [0.86, 0.32, 0.6], chromeBar: true, plateR: 0.4, prof: 'sport', rim: 0xc8ccd2, wstyle: 'mesh', spokes: 5, ww: 0.24, exhaust: [{ x: 0.62, dual: true, r: 0.045 }],
    extra: (c) => { scoop(c); stripes(c, 0xf2f2ee); lipSpoiler(c, false); } },
  limuzin: { cowl: 2.25, rf: 1.62, rr: -2.2, deck: -2.85, top: [[3.7, 0.46], [3.62, 0.66, 0.1], [3.4, 0.72, 0.3], [2.25, 0.82, 0.15], [1.62, 1.31, 0.4], [-2.2, 1.31, 0.42], [-2.85, 0.9, 0.12], [-3.58, 0.88, 0.12], [-3.7, 0.64]], belt: [[3.7, 0.6], [2.25, 0.78], [-3.7, 0.88]],
    roofY: 1.31, hoodY: 0.82, deckY: 0.9, tumble: 0.8, hoodX: 0.86, step: 0.11, win: [[2.23, 1.02], [0.94, -0.45], [-0.53, -1.98]], bl: true, bpBlack: true, doors: [2.2, 0.98, -0.49, -2.0], hoodPart: true, trunk: true, handles: [1.3, -0.8], fin: true, seatC: 0x8a6a4a,
    head: [0.5, 0.9, 0.5, 0.64], tail: [0.5, 0.95, 0.66, 0.8], tailBar: true, grille: [0.48, 0.36, 0.52], chromeBar: true, plateR: 0.62, rim: 0xdfe3e8, wstyle: 'mesh', spokes: 6, exhaust: [{ x: 0.55, dual: true }] },
  monstr: { cowl: 1.12, rf: 0.6, rr: -0.55, y0: 0.55, hl: 2.45, W: 1.02, lift: true, top: [[2.45, 0.6], [2.37, 0.84, 0.08], [2.2, 0.9, 0.16], [1.12, 0.98, 0.12], [0.6, 1.5, 0.28], [-0.5, 1.5, 0.08], [-0.57, 0.98, 0.03], [-2.4, 0.96], [-2.45, 0.78]], belt: [[2.45, 0.8], [1.12, 0.96], [-2.45, 0.96]],
    bot: [[2.45, 0.25], [2.1, 0.04, 0.2], [-2.1, 0.04, 0.2], [-2.45, 0.25]], roofY: 1.5, hoodY: 0.98, tumble: 0.9, hoodX: 0.9, pF: 4, rcR: 0.07, side: [0.995, 1, 0.997, 0.99], win: [[1.1, -0.47]], doors: [1.08, -0.4], hoodPart: true, handles: [-0.2],
    open: (z, j) => z < -0.6 && j >= 9, bump: 'sep', bumpC: 0x2a2c30, head: [0.56, 0.9, 0.6, 0.76], tail: [0.84, 0.99, 0.5, 0.88], grille: [0.5, 0.42, 0.72], noIntake: true, prof: 'off', ww: 0.9, rim: 0xf0b83a, wstyle: 'steel', holes: 10, side_: 0, wo: { side: 0.5 * 0.92, rimR: 0.35, rimM: 0.7 }, driver: false,
    extra: (c) => { pickupBed(c, -0.6); monsterChassis(c); scoop(c); stripes(c, 0xf0b83a); lightBar(c); } },
  super: { cowl: 0.95, rf: 0.2, rr: -0.45, deck: -1.6, blz: [-0.45, -0.95], top: [[2.25, 0.22], [2.15, 0.36, 0.1], [1.9, 0.42, 0.3], [0.95, 0.55, 0.25], [0.2, 1.03, 0.35], [-0.45, 1.02, 0.35], [-1.6, 0.78, 0.3], [-2.15, 0.7, 0.08], [-2.25, 0.5]], belt: [[2.25, 0.4], [0.95, 0.53], [-0.4, 0.68], [-2.25, 0.7]],
    bot: [[2.25, 0.14], [1.95, 0.03, 0.2], [-1.9, 0.03, 0.2], [-2.25, 0.2]], roofY: 1.03, hoodY: 0.55, deckY: 0.78, tumble: 0.7, hoodX: 0.84, pF: 2.4, pR: 3.2, taperF: 0.08, side: [1, 0.99, 0.965, 0.93], win: [[0.93, -0.4]], bl: true, doors: [0.88, -0.42], handles: [], twoSeat: true, seatY: 0.22, seatZ: -0.15, drvLean: -0.35,
    head: [0.52, 0.94, 0.27, 0.35], tail: [0.4, 0.96, 0.5, 0.6], tailBar: true, grille: [0.5, 0.08, 0.22], noIntake: true, plateF: 0.15, plateR: 0.3, prof: 'sport', rim: 0x1d1e22, wstyle: 'split', spokes: 5, cal: 0xf0b83a, ww: 0.26, exhaust: [{ x: 0.12, dual: true, r: 0.045, y: 0.2 }],
    extra: (c) => { superAero(c); } },
};

// ---------- korpus qo'shimchalari ----------
// Pikap kuzovi: pol, ichki devorlar, borti qopqoqlari, orqa oyna
function pickupBed(c, z0) {
  const { B, body, W, Y, hl } = c, P = B.paint, T = B.trim, z1 = -hl + 0.07, L = z0 - z1, zc = (z0 + z1) / 2, yt = body.belt(zc) - 0.01, yf = Y(0.42);
  T.mat(0x1b1c20, 0.85, 0.1); T.box(0, yf, zc, W * 1.8, 0.03, L); for (let i = -3; i <= 3; i++) T.box(i * W * 0.24, yf + 0.02, zc, 0.04, 0.02, L * 0.98);
  P.color(0xd8d8d8); for (const sd of [1, -1]) P.box(sd * W * 0.9, (yf + yt) / 2, zc, 0.035, yt - yf, L); P.box(0, (yf + yt) / 2, z0 - 0.02, W * 1.8, yt - yf, 0.035); P.box(0, (yf + yt) / 2, z1 + 0.03, W * 1.8, yt - yf, 0.04); P.color(0xffffff);
  T.mat(0x18191c, 0.6, 0); for (const sd of [1, -1]) T.rbox(sd * W * 0.925, yt + 0.012, zc, 0.075, 0.03, L + 0.04, 0.012, 1); T.rbox(0, yt + 0.012, z1 + 0.02, W * 1.86, 0.03, 0.07, 0.012, 1);
  // kabina orqa oynasi
  const rr = c.o.rr, y0 = Y(1.12), y1 = Y(1.42), zb = (y) => { const t = (Y(1.49) - y) / (Y(1.49) - Y(1.0)); return rr + 0.06 - t * 0.08 - 0.008; };
  T.mat(BLACKG, 0.3, 0); B.glass.qF([-W * 0.66, y0 - 0.02, zb(y0 - 0.02) + 0.003], [W * 0.66, y0 - 0.02, zb(y0 - 0.02) + 0.003], [W * 0.62, y1 + 0.02, zb(y1 + 0.02) + 0.003], [-W * 0.62, y1 + 0.02, zb(y1 + 0.02) + 0.003], [0, 0, -1]);
  T.qF([-W * 0.7, y0 - 0.04, zb(y0 - 0.04) + 0.006], [W * 0.7, y0 - 0.04, zb(y0 - 0.04) + 0.006], [W * 0.66, y1 + 0.04, zb(y1 + 0.04) + 0.006], [-W * 0.66, y1 + 0.04, zb(y1 + 0.04) + 0.006], [0, 0, -1]);
}
// G'ildirak arkasi kengaytmalari (qora plastik), yoy bo'ylab
function flares(c, h, col = 0x232428) {
  const { B, W, wd } = c, T = B.trim;
  for (const w of wd) for (const sd of [1, -1]) {
    const pts = []; for (let k = 0; k <= 12; k++) { const a = -1.75 + (3.5 * k) / 12; pts.push([W * 0.995, w.cy + Math.cos(a) * (w.ra + h * 0.42), w.z + Math.sin(a) * (w.ra + h * 0.42)]); }
    T.mat(col, 0.7, 0); T.push(); if (sd < 0) T.scale(-1, 1, 1); T.sweep(pts, [[-h / 2, -0.012], [h / 2, -0.012], [h / 2, 0.028], [-h / 2, 0.035]], [1, 0, 0], { closed: true, flat: true }); T.pop();
  }
}
// Old himoya dugasi (bamper qismiga)
function bullBar(c) {
  const { B, body, W, Y } = c, g = B.bF, y0 = Y(0.24), y1 = Y(0.78), z = body.endZ(0, y0, 1) + 0.16;
  g.mat(0x8f949c, 0.3, 0.9);
  for (const sd of [1, -1]) g.tube([[sd * W * 0.5, y0, z - 0.04], [sd * W * 0.5, y1 - 0.06, z], [sd * W * 0.42, y1, z + 0.01]], 0.03, 8);
  g.tube([[-W * 0.42, y1, z + 0.01], [0, y1 + 0.01, z + 0.02], [W * 0.42, y1, z + 0.01]], 0.03, 8); g.tube([[-W * 0.5, y0 + 0.2, z - 0.02], [W * 0.5, y0 + 0.2, z - 0.02]], 0.022, 8);
}
// Old oyna, orqa va yon tekis oynalar (furgon, jip, avtobus) — yuzaga yopishgan
function rearPanes(c, list) {
  const { B, body, W, Y } = c;
  for (const [xo, xi, y0, y1] of list) for (const sd of [1, -1]) {
    B.trim.mat(BLACKG, 0.3, 0); endPatch(body, B.trim, -1, sd * W * (xi - 0.03), sd * W * (xo + 0.03), Y(y0) - 0.03, Y(y1) + 0.03, 2, 2, 0.004);
    endPatch(body, B.glass, -1, sd * W * xi, sd * W * xo, Y(y0), Y(y1), 2, 2, 0.008);
  }
}
function sidePanes(c, list, y0, y1) {
  const { B, body, Y } = c;
  for (const [z0, z1] of list) for (const sd of [1, -1]) {
    B.trim.mat(BLACKG, 0.3, 0); sidePatch(body, B.trim, sd, z1 - 0.03, z0 + 0.03, Y(y0) - 0.03, Y(y1) + 0.03, 3, 2, 0.004);
    sidePatch(body, B.glass, sd, z1, z0, Y(y0), Y(y1), 3, 2, 0.008);
  }
}
// Bagaj qopqog'idagi spoyler (qism, uchishi mumkin)
function lipSpoiler(c, painted) {
  const { B, body, W, hl, o } = c, ex = B.P(5), z = -hl + 0.16, y = body.topY(0, z);
  ex.color(painted ? 0xffffff : 0x121316); ex.rbox(0, y + 0.03, z, W * 1.7, 0.035, 0.18, 0.015, 1, { tz: 0.7 });
  B.parts.extra = [ex, 'rear', 34, painted];
}
function splitter(c) { const { B, body, W, Y } = c; B.bF.color(0x111215).rbox(0, Y(0.04), body.endZ(0, Y(0.08), 1) + 0.02, W * 1.8, 0.025, 0.18, 0.01, 1); B.bF.color(0xffffff); }
// Kapot havo olgichi
function scoop(c) {
  const { B, body, o, hl } = c, g = B.hoodP || B.paint, z = (o.cowl + hl) / 2 - 0.08, y = body.topY(0, z);
  g.color(0xffffff).rbox(0, y + 0.05, z, 0.5, 0.12, 0.7, 0.05, 2, { tx: 0.85, tz: 0.8 }); g.color(0x0c0d0f).rbox(0, y + 0.06, z + 0.32, 0.36, 0.07, 0.04, 0.015, 1); g.color(0xffffff);
}
// Uzunasiga chiziqlar (dekal) — kapotdagisi alohida qism (kapot bilan uchadi)
function stripes(c, col) {
  const { B, body, o, hl } = c, T = B.trim, st = B.P(11);
  for (const x of [-0.16, 0.06]) {
    st.mat(col, 0.35, 0); topPatch(body, st, x, x + 0.1, o.cowl + 0.06, hl - 0.12, 1, 6, 0.006);
    T.mat(col, 0.35, 0); topPatch(body, T, x, x + 0.1, (o.rr || -0.5) + 0.06, o.rf - 0.06, 1, 4, 0.006);
    if (o.deck) topPatch(body, T, x, x + 0.1, -hl + 0.14, o.deck - 0.08, 1, 3, 0.006);
  }
  B.parts.stripe = [st, 'front', 26];
}
// Ralli: tom havo olgichi, qanot, loy tutgichlar, fara bloki, chiziqlar
function rally(c) {
  const { B, body, W, Y, o, hl, s } = c, T = B.trim, P = B.paint;
  const zr = o.rf - 0.25; P.rbox(0, body.topY(0, zr) + 0.04, zr, 0.34, 0.09, 0.42, 0.04, 2, { tz: 0.6 }); T.mat(0x0c0d0f, 0.5, 0).rbox(0, body.topY(0, zr) + 0.05, zr + 0.2, 0.26, 0.05, 0.03, 0.01, 1);
  const ex = B.P(5), z = -hl + 0.22, y = body.topY(0, z) + 0.28; ex.mat(0x15161a, 0.4, 0.1);
  for (const sd of [1, -1]) ex.rbox(sd * W * 0.62, y - 0.14, z + 0.02, 0.04, 0.3, 0.14, 0.01, 1); ex.rbox(0, y, z - 0.02, W * 1.86, 0.04, 0.34, 0.015, 1, { tz: 0.8 }); for (const sd of [1, -1]) ex.rbox(sd * W * 0.93, y + 0.02, z - 0.02, 0.02, 0.16, 0.38, 0.008, 1);
  B.parts.extra = [ex, 'rear', 34];
  T.mat(0xc8302a, 0.8, 0); for (const sd of [1, -1]) for (const w of c.wd) T.rbox(sd * W * 0.86, Y(0.14), w.z - w.ra - 0.06, 0.24, 0.26, 0.02, 0.01, 1);
  // fara bloki (old panjarada 4 ta yumaloq chiroq)
  T.mat(0x15161a, 0.4, 0.2); const yl = Y(0.62), zl = body.endZ(0, yl, 1) + 0.09; T.rbox(0, yl - 0.1, zl - 0.03, W * 1.3, 0.04, 0.05, 0.01, 1);
  for (const x of [-0.42, -0.14, 0.14, 0.42]) { T.mat(0x15161a, 0.4, 0.2); T.push().translate(x * W * 1.3, yl, zl); T.prismZ(14, 0.085, 0.07); T.pop(); B.head.push().translate(x * W * 1.3, yl, zl + 0.037); B.head.prismZ(14, 0.07, 0.006); B.head.pop(); }
  stripesR(c);
}
function stripesR(c) { const { B, body, o, hl } = c, T = B.trim; T.mat(0xf2f2ee, 0.4, 0); for (const sd of [1, -1]) sidePatch(body, T, sd, -0.9, 0.85, c.Y(0.3), c.Y(0.36), 6, 1, 0.006); }
// Yorug'lik paneli (tomda)
function lightBar(c) {
  const { B, body, W, o } = c, z = o.rf - 0.1, y = body.topY(0, z) + 0.1; B.trim.mat(0x15161a, 0.4, 0.3).rbox(0, y, z, W * 1.4, 0.1, 0.1, 0.02, 1);
  for (const sd of [1, -1]) B.trim.rod([sd * W * 0.6, y - 0.1, z - 0.02], [sd * W * 0.62, y - 0.02, z], 0.012, 0.012, 4);
  for (const x of [-0.45, -0.15, 0.15, 0.45]) B.head.rbox(x * W * 1.4, y, z + 0.052, W * 0.36, 0.07, 0.006, 0.003, 1);
}
// Monster-trak: rama, ko'priklar, prujinali amortizatorlar, to'rtburchak tortqilar
function monsterChassis(c) {
  const { B, s, W, Y, hl } = c, T = B.trim, ay = s.rF - s.com, wx = s.wx;
  T.mat(0x26282d, 0.5, 0.6); for (const sd of [1, -1]) T.rbox(sd * 0.42, Y(-0.18), 0, 0.14, 0.2, s.len * 0.86, 0.02, 1);
  for (const z of [-1.9, -0.6, 0.6, 1.9]) T.rbox(0, Y(-0.18), z, 0.98, 0.12, 0.12, 0.02, 1);
  for (const az of [s.wzF, -s.wzR]) {
    T.mat(0x5a5e66, 0.4, 0.8); T.rod([-wx + 0.32, ay, az], [wx - 0.32, ay, az], 0.1, 0.1, 12); T.blob(0.2, 1, { cx: 0, cy: ay, cz: az, sx: 1.1, sz: 0.9, shade: 0 });
    for (const sd of [1, -1]) {
      T.mat(0x3a3d43, 0.4, 0.7); T.rod([sd * 0.42, Y(-0.2), az - Math.sign(az) * 0.9], [sd * 0.5, ay - 0.05, az], 0.045, 0.045, 8); T.rod([sd * 0.3, Y(-0.05), az - Math.sign(az) * 0.8], [sd * 0.3, ay + 0.08, az], 0.04, 0.04, 8);
      for (const dz of [-0.16, 0.16]) {
        const a = [sd * 0.62, ay + 0.04, az + dz], b = [sd * 0.5, Y(0.25), az + dz * 2.2];
        T.mat(0xd8dce2, 0.2, 0.9); T.rod(a, b, 0.035, 0.035, 8); T.mat(0x202226, 0.4, 0.5); T.rod(lerp3(a, b, 0.45), b, 0.06, 0.06, 10);
        T.mat(0xf0b83a, 0.35, 0.3); const pts = []; for (let k = 0; k <= 40; k++) { const t = 0.08 + (k / 40) * 0.5, ang = k * 0.9, p = lerp3(a, b, t); pts.push([p[0] + Math.cos(ang) * 0.075, p[1], p[2] + Math.sin(ang) * 0.075]); } T.tube(pts, 0.014, 5);
      }
    }
  }
  T.mat(0x3a3d43, 0.4, 0.7); T.rod([0, ay + 0.02, s.wzF - 0.2], [0, Y(-0.1), 0], 0.05, 0.05, 8); T.rod([0, ay + 0.02, -s.wzR + 0.2], [0, Y(-0.1), 0], 0.05, 0.05, 8);
}
// Superkar: orqa qanot, yon havo olgichlar, diffuzor
function superAero(c) {
  const { B, body, W, Y, hl, s } = c, T = B.trim, ex = B.P(5), z = -hl + 0.28, y = Y(1.0);
  ex.mat(0x121316, 0.35, 0.2); for (const sd of [1, -1]) ex.rbox(sd * W * 0.45, (y + body.topY(W * 0.45, z)) / 2, z + 0.05, 0.035, y - body.topY(W * 0.45, z), 0.2, 0.01, 1);
  ex.rbox(0, y, z, W * 1.96, 0.035, 0.38, 0.015, 1, { tz: 0.75 }); for (const sd of [1, -1]) ex.rbox(sd * W * 0.98, y + 0.03, z, 0.015, 0.2, 0.44, 0.006, 1);
  B.parts.extra = [ex, 'rear', 34];
  T.mat(0x0c0d0f, 0.6, 0); for (const sd of [1, -1]) sidePatch(body, T, sd, -s.wzR + s.rR + 0.12, -s.wzR + s.rR + 0.62, Y(0.24), Y(0.52), 4, 2, 0.004);
  T.mat(0x141518, 0.5, 0.1); for (let i = -3; i <= 3; i++) T.rbox(i * W * 0.2, Y(0.12), body.endZ(i * W * 0.2, Y(0.12), -1) + 0.12, 0.02, 0.08, 0.3, 0.005, 1);
  splitter(c);
}

// ---------- yuk mashinasi / o't o'chirish: kabina (silliq kesimli), rama, yoqilg'i baki, kuzov ----------
function genTruck(v, o) {
  const s = v.spec, B = newB(v.id.length * 17), P = B.paint, T = B.trim, G = B.glass;
  const hl = s.len / 2, W = s.wid / 2 - 0.02, yb = s.clr - s.com, Y = (y) => yb + y, zf = hl - 0.02, cabL = o.cabL || 2.1, cz = zf - cabL, cabH = o.cabH || 2.35, ax = s.rF - s.com;
  const wdF = [{ z: s.wzF, cy: ax, r: s.rF, ra: s.rF + 0.07, xin: s.wx - 0.24 }];
  const D = { hl, zf, zr: cz, W, zc: (zf + cz) / 2, top: [[zf, Y(1.22)], [zf - 0.03, Y(1.3), 0.05], [zf - 0.11, Y(1.38), 0.06], [zf - 0.44, Y(cabH - 0.02), 0.2], [cz + 0.1, Y(cabH), 0.1], [cz, Y(cabH - 0.3)]],
    bot: [[zf, Y(0.34)], [cz, Y(0.34)]], belt: [[zf, Y(1.22)], [cz, Y(1.26)]], tumble: 0.95, hoodX: 0.94, rcF: 0.12, rcR: 0.15, crown: 0.03, roofY: Y(cabH), hoodY: Y(1.32), side: [0.999, 1, 0.999, 0.995], wheels: wdF, step: 0.1 * (LITE ? 1.5 : 1),
    need: [zf - 0.11, zf - 0.44, zf - 0.16, cz + 0.5, ...(o.fire ? [cz + 1.1, cz + 1.0] : [])] };
  const body = makeBody(D), wins = o.fire ? [[zf - 0.16, cz + 1.1], [cz + 1.0, cz + 0.2]] : [[zf - 0.16, cz + 0.5]], inWin = (z) => wins.some(([a, b]) => z < a && z > b);
  emitBody(body, (i, j, s0, s1) => {
    const zc = (s0.z + s1.z) / 2;
    if (j < 2) return T.mat(0x17181b, 0.9, 0);
    if (j < 8) { if ((s0.raised[j] && s0.raised[j + 1]) || (s1.raised[j] && s1.raised[j + 1]) || (j === 2 && (s0.raised[3] || s1.raised[3]))) return T.mat(0x111214, 0.95, 0); return P; }
    if (j === 8) return inWin(zc) ? T.mat(BLACKG, 0.35, 0) : P;
    if (j < 12) return inWin(zc) && s0.P[12][1] - s0.P[9][1] > 0.05 ? G : P;
    if (j < 14) return P;
    if (zc < zf - 0.11 && zc > zf - 0.44) return G;
    return P;
  }, (i, j, st) => 0.82 + 0.18 * Math.min(1, Math.max(0, (body.G[i][j][1] - st.yB) / 0.4)));
  B.seam = { b: o.fire ? [zf - 0.12, cz + 1.05, cz + 0.12] : [zf - 0.12, cz + 0.45], c: [Y(0.4), Y(1.2), W * 0.8, 99] };
  const c = { s, B, body, W, yb, Y, hl, o: { top: [[0, 1.0]], belt: [[0, 1.2], [0, 1.2]] }, wd: wdF };
  for (const w of wdF) for (const sd of [1, -1]) { T.mat(0x0f1012, 0.95, 0); T.push().translate(0, w.cy, w.z); if (sd < 0) T.scale(-1, 1, 1); T.lathe([[w.ra + 0.01, w.xin - 0.03], [w.ra + 0.01, W * 0.99]], 14, { a0: -1.85, a1: 1.85, inv: true }); T.pop(); }
  // old yuz: panjara, faralar, burilish chiroqlari, artgichlar, quyosh soyaboni
  T.mat(0x131417, 0.35, 0.3); endPatch(body, T, 1, -W * 0.72, W * 0.72, Y(0.62), Y(1.18), 6, 6, 0.006, (a) => (a % 2 ? 0.5 : 1.5));
  for (const sd of [1, -1]) {
    T.mat(0x24262b, 0.2, 0.8); endPatch(body, T, 1, sd * W * 0.62, sd * W * 0.97, Y(0.4), Y(0.6), 3, 1, 0.005);
    endPatch(body, B.head, 1, sd * W * 0.64, sd * W * 0.88, Y(0.42), Y(0.58), 3, 1, 0.008, 0.45); endPatch(body, B.head, 1, sd * W * 0.66, sd * W * 0.74, Y(0.45), Y(0.55), 1, 1, 0.011, 1);
    endPatch(body, sd > 0 ? B.sigL : B.sigR, 1, sd * W * 0.89, sd * W * 0.96, Y(0.42), Y(0.58), 1, 1, 0.008, 1);
  }
  B.lampY = Y(0.5);
  T.mat(0x0c0d0f, 0.4, 0.3); for (const [xa, xb] of [[-0.1, W * 0.75], [-W * 0.8, -W * 0.15]]) { const z = zf - 0.13; T.tube([[xa, Y(1.42), z], [xb, Y(1.42), z - 0.02]], 0.01, 4, { sy: 0.5 }); }
  P.rbox(0, Y(cabH + 0.03), zf - 0.38, W * 1.9, 0.05, 0.3, 0.02, 1);
  if (!o.fire) { P.box(0, Y(cabH + 0.32), cz + 0.7, W * 1.86, 0.62, 1.2, { oz: -0.35, tz: 0.5, tx: 0.96 }); }
  // qadamlar, oyna ko'zgulari (uzun tutqichlarda)
  T.mat(0x9aa0a8, 0.3, 0.9); for (const sd of [1, -1]) { T.rbox(sd * W * 0.95, Y(0.2), zf - 0.7, 0.24, 0.03, 0.5, 0.01, 1); T.rbox(sd * W * 0.95, Y(-0.1), zf - 0.7, 0.24, 0.03, 0.5, 0.01, 1); }
  for (const sd of [1, -1]) {
    const q = B.P(sd > 0 ? 3 : 4), x = sd * (W + 0.02); q.mat(0x18191c, 0.5, 0.3); q.tube([[x, Y(1.85), zf - 0.35], [x + sd * 0.2, Y(1.9), zf - 0.25], [x + sd * 0.26, Y(1.75), zf - 0.22]], 0.018, 6);
    q.rbox(x + sd * 0.3, Y(1.55), zf - 0.22, 0.1, 0.48, 0.24, 0.03, 1); q.mat(0x0a0b0c, 0.05, 0.9).rbox(x + sd * 0.3, Y(1.55), zf - 0.34, 0.08, 0.42, 0.01, 0.01, 1);
    B.parts[sd > 0 ? 'mirL' : 'mirR'] = [q, sd > 0 ? 'left' : 'right', 60];
  }
  // salon
  if (!LITE) { T.mat(0x1c1d21, 0.75, 0).rbox(0, Y(1.15), zf - 0.32, W * 1.8, 0.24, 0.4, 0.05, 1); T.mat(0x2a2b30, 0.9, 0); for (const sd of [1, -1]) { T.rbox(sd * W * 0.5, Y(0.8), zf - 1.2, 0.5, 0.14, 0.5, 0.05, 1); T.rbox(sd * W * 0.5, Y(1.15), zf - 1.45, 0.5, 0.65, 0.14, 0.05, 1); }
    const wc = [W * 0.5, Y(1.3), zf - 0.62], ring = []; for (let k = 0; k <= 16; k++) { const a = (k / 16) * Math.PI * 2; ring.push([wc[0] + Math.cos(a) * 0.22, wc[1] + Math.sin(a) * 0.22 * 0.5, wc[2] + Math.sin(a) * 0.22 * 0.86]); } T.mat(0x121316, 0.5, 0).tube(ring, 0.02, 6); }
  // rama, yoqilg'i baki, akkumulyator, yon himoya
  T.mat(0x24262b, 0.55, 0.5); for (const sd of [1, -1]) T.rbox(sd * 0.46, Y(0.36), -0.2, 0.1, 0.26, s.len - 0.7, 0.015, 1);
  T.mat(0xc8ccd2, 0.22, 0.95); T.tube([[W * 0.78, Y(0.48), cz - 0.15], [W * 0.78, Y(0.48), cz - 1.0]], 0.25, 14, { cap: true, sy: 1.15 });
  T.mat(0x2a2c30, 0.5, 0.6); for (const z of [cz - 0.3, cz - 0.85]) T.rbox(W * 0.78, Y(0.48), z, 0.62, 0.66, 0.05, 0.01, 1);
  T.mat(0x18191c, 0.6, 0.2).rbox(-W * 0.8, Y(0.45), cz - 0.5, 0.5, 0.45, 0.6, 0.03, 1);
  T.mat(0xa0a6ae, 0.3, 0.9); for (const sd of [1, -1]) for (const dy of [0.2, 0.42]) T.rbox(sd * W * 0.96, Y(dy), (cz - 1.15 + (-s.wzR + s.rR * 2.25 + s.rR + 0.1)) / 2, 0.03, 0.06, Math.max(0.2, cz - 1.15 - (-s.wzR + s.rR * 2.25 + s.rR + 0.1)), 0.01, 1);
  // egzoz trubasi (kabina orqasida, tik)
  T.mat(0xc8ccd2, 0.15, 1); T.tube([[-W * 0.9, Y(0.6), cz - 0.12], [-W * 0.9, Y(cabH + 0.25), cz - 0.12]], 0.065, 10); T.mat(0x111214, 0.5, 0.5).rod([-W * 0.9, Y(cabH + 0.24), cz - 0.12], [-W * 0.9, Y(cabH + 0.26), cz - 0.12], 0.05, 0.05, 8);
  const cg = -hl + 0.06, cl = cz - 0.18 - cg, y0 = Y(0.62);
  if (o.fire) {
    // o't o'chirish: yopiq kuzov, jalyuzli eshiklar, oq chiziq, narvon, mayoqlar
    P.rbox(0, y0 + 0.9, cg + cl / 2, W * 1.98, 1.8, cl, 0.06, 2);
    T.mat(0xc8ccd4, 0.35, 0.85); for (const sd of [1, -1]) for (let i = 0; i < 3; i++) { const zc = cg + cl * (0.2 + i * 0.3); T.rbox(sd * W * 0.995, y0 + 0.85, zc, 0.02, 1.25, cl * 0.25, 0.01, 1); for (let k = 0; k < 9; k++) T.mat(0x9ea3aa, 0.4, 0.8).rbox(sd * W * 1.0, y0 + 0.28 + k * 0.14, zc, 0.012, 0.012, cl * 0.24, 0.004, 1); T.mat(0xc8ccd4, 0.35, 0.85); }
    T.mat(0xf2f2ee, 0.4, 0); for (const sd of [1, -1]) T.rbox(sd * W * 0.995, y0 + 0.08, cg + cl / 2, 0.02, 0.1, cl, 0.005, 1);
    const ly = y0 + 1.86; T.mat(0xd4d8de, 0.25, 0.9); for (const sd of [1, -1]) T.tube([[sd * 0.34, ly, cg + 0.3], [sd * 0.34, ly + 0.22, cz + 0.4]], 0.035, 6);
    for (let i = 0; i < 14; i++) { const t = i / 13; T.rod([-0.34, ly + 0.22 * t, cg + 0.3 + (cz + 0.1 - cg) * t], [0.34, ly + 0.22 * t, cg + 0.3 + (cz + 0.1 - cg) * t], 0.014, 0.014, 4, false); }
    T.mat(0x2a2c30, 0.4, 0.5); T.tube([[W * 0.6, ly - 0.02, cg + cl * 0.15], [W * 0.6, ly - 0.02, cg + cl * 0.85]], 0.16, 10, { cap: true });
    T.mat(0x15161a, 0.4, 0.3).rbox(0, Y(cabH + 0.08), zf - 0.6, W * 1.3, 0.1, 0.28, 0.02, 1);
    for (const sd of [1, -1]) (sd > 0 ? B.head : B.tail).rbox(sd * W * 0.38, Y(cabH + 0.14), zf - 0.6, W * 0.5, 0.12, 0.26, 0.04, 1);
  } else {
    // yuk qutisi (qism: tomdan qattiq urilsa uchadi): qovurg'alar, burchak profillari, orqa eshiklar
    T.mat(0xc9a070, 0.8, 0).rbox(0, y0 - 0.06, cg + cl / 2, W * 1.96, 0.1, cl, 0.01, 1);
    const cb = B.P(8), bh = Y(s.hgt - s.clr) - 0.04 - y0;
    cb.mat(0xe6e1d4, 0.55, 0.05).rbox(0, y0 + bh / 2, cg + cl / 2, W * 1.96, bh, cl - 0.04, 0.04, 2);
    cb.mat(0xbcb7a8, 0.4, 0.6); for (let i = 1; i < 8; i++) for (const sd of [1, -1]) cb.rbox(sd * W * 0.985, y0 + bh / 2, cg + 0.02 + (cl - 0.04) * i / 8, 0.025, bh - 0.08, 0.05, 0.01, 1);
    cb.mat(0xa8adb5, 0.3, 0.9); for (const sx of [-1, 1]) for (const zz of [cg + 0.02, cg + cl - 0.02]) cb.rbox(sx * W * 0.98, y0 + bh / 2, zz, 0.06, bh, 0.06, 0.015, 1);
    for (const sx of [-1, 1]) for (const yy of [y0 + 0.02, y0 + bh - 0.02]) cb.rbox(0, yy, cg + cl / 2, W * 1.98, 0.05, cl, 0.012, 1);
    cb.mat(v.hex, 0.45, 0.1); for (const sd of [1, -1]) cb.rbox(sd * W * 0.99, y0 + bh * 0.62, cg + cl / 2, 0.012, 0.32, cl * 0.6, 0.005, 1);
    cb.mat(0x8a8e96, 0.3, 0.85); for (const sx of [-0.45, -0.15, 0.15, 0.45]) cb.tube([[sx * W, y0 + 0.08, cg - 0.035], [sx * W, y0 + bh - 0.08, cg - 0.035]], 0.016, 6);
    B.parts.cargo = [cb, 'top', 14];
  }
  // loy tutgichlar, orqa himoya, orqa chiroqlar
  T.mat(0x141518, 0.85, 0); for (const z of [-s.wzR, -s.wzR + s.rR * 2.25]) for (const sd of [1, -1]) { const pts = []; for (let k = 0; k <= 8; k++) { const a = -1.4 + 2.8 * k / 8; pts.push([sd * (s.wx - 0.06), ax + Math.cos(a) * (s.rR + 0.08), z + Math.sin(a) * (s.rR + 0.08)]); } T.sweep(pts, [[-0.26, 0], [0.26, 0], [0.26, 0.012], [-0.26, 0.012]], [sd, 0, 0], { closed: true, flat: true }); }
  T.mat(0x2a2c30, 0.5, 0.5).rbox(0, Y(0.22), -hl + 0.12, W * 1.8, 0.12, 0.1, 0.02, 1);
  for (const sd of [1, -1]) { const x = sd * W * 0.78, z = -hl + 0.06; B.tail.rbox(x, Y(0.42), z, 0.22, 0.14, 0.03, 0.01, 1); B.brake.rbox(x, Y(0.56), z, 0.22, 0.08, 0.03, 0.01, 1); B.rev.rbox(x - sd * 0.17, Y(0.42), z, 0.1, 0.14, 0.03, 0.01, 1); (sd > 0 ? B.sigL : B.sigR).rbox(x + sd * 0.15, Y(0.42), z, 0.08, 0.14, 0.03, 0.01, 1); }
  T.mat(0xe9e9e2, 0.45, 0).rbox(0, Y(0.4), -hl + 0.05, 0.5, 0.11, 0.01, 0.004, 1);
  // bamperlar
  B.bF = B.P(1); B.bR = B.P(2); B.bF.mat(0x4a4d55, 0.55, 0.1).rbox(0, Y(0.26), zf + 0.06, W * 1.98, 0.34, 0.2, 0.05, 2); B.bF.mat(0xe9e9e2, 0.45, 0).rbox(0, Y(0.25), zf + 0.165, 0.5, 0.11, 0.01, 0.004, 1);
  B.bR.mat(0x2a2c30, 0.6, 0.3).rbox(0, Y(0.12), -hl + 0.1, W * 1.6, 0.08, 0.08, 0.02, 1);
  B.parts.bumpF = [B.bF, 'front', 50]; B.parts.bumpR = [B.bR, 'rear', 45];
  const wo = { prof: 'road', rim: 0xb8bcc4, style: 'steel', holes: 8, nuts: 10, side: 0.36 * s.rF }, ww = 0.34;
  B.wheels.push({ r: s.rF, w: ww, x: s.wx, z: s.wzF, src: [0], front: true, o: wo }, { r: s.rF, w: ww, x: -s.wx, z: s.wzF, src: [1], front: true, o: wo });
  for (const z of [-s.wzR, -s.wzR + s.rR * 2.25]) B.wheels.push({ r: s.rR, w: ww * 1.5, x: s.wx - 0.06, z, src: [2], o: wo }, { r: s.rR, w: ww * 1.5, x: -s.wx + 0.06, z, src: [3], o: wo });
  return assemble(v, B);
}

// ---------- avtobus: butun uzunlik bitta silliq korpus, oynalar qatori, eshiklar ----------
function genBus(v) {
  const s = v.spec, B = newB(41), P = B.paint, T = B.trim, G = B.glass;
  const hl = s.len / 2, W = s.wid / 2 - 0.02, yb = s.clr - s.com, Y = (y) => yb + y, H = s.hgt - s.clr - 0.02, ax = s.rF - s.com;
  const wd = [[s.wzF, s.rF], [-s.wzR, s.rR]].map(([z, r]) => ({ z, cy: r - s.com, r, ra: r + 0.06, xin: s.wx - 0.32 }));
  const n = 8, z0 = hl - 1.55, z1 = -hl + 0.45, wl = (z0 - z1) / n, wins = [[hl - 0.12, hl - 1.5]]; for (let i = 0; i < n; i++) wins.push([z0 - i * wl - 0.05, z0 - (i + 1) * wl + 0.05]);
  const D = { hl, W, top: [[hl, Y(1.0)], [hl - 0.02, Y(1.08), 0.03], [hl - 0.1, Y(1.22), 0.05], [hl - 0.28, Y(H - 0.12), 0.25], [-hl + 0.3, Y(H), 0.2], [-hl, Y(H - 0.3)]],
    bot: [[hl, Y(0.18)], [hl - 0.3, Y(0.05), 0.2], [-hl + 0.3, Y(0.05), 0.2], [-hl, Y(0.2)]], belt: [[hl, Y(1.1)], [-hl, Y(1.18)]], tumble: 0.95, hoodX: 0.95, rcF: 0.18, rcR: 0.15, crown: 0.06, roofY: Y(H), hoodY: Y(1.25), side: [0.999, 1, 0.999, 0.995], wheels: wd, step: 0.14 * (LITE ? 1.5 : 1), need: [hl - 0.1, hl - 0.28, ...wins.flat()] };
  const body = makeBody(D), inWin = (z) => wins.some(([a, b]) => z < a && z > b);
  emitBody(body, (i, j, s0, s1) => {
    const zc = (s0.z + s1.z) / 2;
    if (j < 2) return T.mat(0x17181b, 0.9, 0);
    if (j < 8) { if ((s0.raised[j] && s0.raised[j + 1]) || (s1.raised[j] && s1.raised[j + 1]) || (j === 2 && (s0.raised[3] || s1.raised[3]))) return T.mat(0x111214, 0.95, 0); return P; }
    if (j === 8) return T.mat(0x26282d, 0.4, 0.3);
    if (j < 11) return inWin(zc) ? G : T.mat(BLACKG, 0.15, 0);
    if (j < 14) return P;
    if (zc > hl - 0.28 && zc < hl - 0.1) return G;
    return P;
  }, (i, j, st) => 0.84 + 0.16 * Math.min(1, Math.max(0, (body.G[i][j][1] - st.yB) / 0.5)));
  B.seam = { c: [Y(0.2), Y(1.1), W * 0.8, 99] };
  for (const w of wd) for (const sd of [1, -1]) { T.mat(0x0f1012, 0.95, 0); T.push().translate(0, w.cy, w.z); if (sd < 0) T.scale(-1, 1, 1); T.lathe([[w.ra + 0.01, w.xin - 0.03], [w.ra + 0.01, W * 0.99]], 14, { a0: -1.85, a1: 1.85, inv: true }); T.pop(); }
  // eshiklar (o'ng tomonda): shisha panellar + qora rama
  for (const [za, zb] of [[hl - 0.3, hl - 1.38], [-0.4, -1.5]]) { T.mat(0x1a1b1e, 0.3, 0.3); sidePatch(body, T, -1, zb - 0.04, za + 0.04, Y(0.18), Y(2.28), 3, 4, 0.006); sidePatch(body, G, -1, zb, za, Y(0.24), Y(2.22), 3, 4, 0.01); T.mat(0x8a8e96, 0.3, 0.9); sidePatch(body, T, -1, (za + zb) / 2 - 0.012, (za + zb) / 2 + 0.012, Y(0.22), Y(2.24), 1, 2, 0.014); }
  // old: faralar, panjara, yo'nalish tablosi, artgichlar; orqa: oyna, chiroqlar
  T.mat(0x131417, 0.4, 0.3); endPatch(body, T, 1, -W * 0.5, W * 0.5, Y(0.3), Y(0.62), 5, 3, 0.006, (a) => (a % 2 ? 0.6 : 1.4));
  for (const sd of [1, -1]) { T.mat(0x24262b, 0.2, 0.8); endPatch(body, T, 1, sd * W * 0.58, sd * W * 0.96, Y(0.42), Y(0.66), 3, 1, 0.005); endPatch(body, B.head, 1, sd * W * 0.6, sd * W * 0.86, Y(0.44), Y(0.64), 3, 1, 0.008, 0.45); endPatch(body, B.head, 1, sd * W * 0.63, sd * W * 0.72, Y(0.48), Y(0.6), 1, 1, 0.011, 1); endPatch(body, sd > 0 ? B.sigL : B.sigR, 1, sd * W * 0.87, sd * W * 0.95, Y(0.44), Y(0.64), 1, 1, 0.008, 1); }
  B.lampY = Y(0.54);
  T.mat(0x0a0b0d, 0.3, 0.2); endPatch(body, T, 1, -W * 0.8, W * 0.8, Y(H - 0.32), Y(H - 0.12), 4, 1, 0.006); B.sigL.color(0xffd58a); endPatch(body, B.sigL, 1, -W * 0.5, W * 0.5, Y(H - 0.28), Y(H - 0.16), 4, 1, 0.009, 0.8); B.sigL.color(0xffffff);
  T.mat(0x0c0d0f, 0.4, 0.3); for (const [xa, xb] of [[-0.05, W * 0.85], [-W * 0.9, -W * 0.1]]) T.tube([[xa, Y(1.32), hl - 0.12], [xb, Y(1.34), hl - 0.13]], 0.011, 4, { sy: 0.5 });
  rearPanes({ B, body, W, Y }, [[0.86, -0.86, 1.55, 2.35]]);
  for (const sd of [1, -1]) { const u = [W * 0.8, W * 0.97]; T.mat(0x2a1414, 0.2, 0.5); endPatch(body, T, -1, sd * u[0], sd * u[1], Y(0.4), Y(1.25), 1, 3, 0.004); endPatch(body, B.tail, -1, sd * (u[0] + 0.01), sd * (u[1] - 0.005), Y(0.95), Y(1.22), 1, 1, 0.008, 0.8); endPatch(body, B.brake, -1, sd * (u[0] + 0.01), sd * (u[1] - 0.005), Y(0.75), Y(0.92), 1, 1, 0.008, 1); endPatch(body, sd > 0 ? B.sigL : B.sigR, -1, sd * (u[0] + 0.01), sd * (u[1] - 0.005), Y(0.6), Y(0.72), 1, 1, 0.008, 1); endPatch(body, B.rev, -1, sd * (u[0] + 0.01), sd * (u[1] - 0.005), Y(0.44), Y(0.56), 1, 1, 0.008, 1); }
  T.mat(0xe9e9e2, 0.45, 0); endPatch(body, T, -1, -0.26, 0.26, Y(0.42), Y(0.54), 2, 1, 0.01);
  // tomdagi konditsioner, yon chiziq
  T.mat(0xd8dade, 0.5, 0.2).rbox(0, Y(H) + 0.1, -1, W * 1.1, 0.2, 2.2, 0.08, 2); T.mat(0x9aa0a8, 0.4, 0.6).rbox(0, Y(H) + 0.04, 2.2, W * 0.8, 0.06, 0.8, 0.03, 1);
  T.mat(0xf2f2ee, 0.4, 0); for (const sd of [1, -1]) sidePatch(body, T, sd, -hl + 0.4, hl - 0.5, Y(0.95), Y(1.04), 12, 1, 0.006);
  // ko'zgular ("quloqlar")
  for (const sd of [1, -1]) { const q = B.P(sd > 0 ? 3 : 4); q.mat(0x18191c, 0.5, 0.3); q.tube([[sd * W * 0.92, Y(H - 0.2), hl - 0.25], [sd * (W + 0.15), Y(H - 0.15), hl + 0.05], [sd * (W + 0.18), Y(H - 0.45), hl + 0.18]], 0.022, 6); q.rbox(sd * (W + 0.18), Y(H - 0.72), hl + 0.18, 0.24, 0.48, 0.1, 0.04, 1); q.mat(0x0a0b0c, 0.05, 0.9).rbox(sd * (W + 0.18), Y(H - 0.72), hl + 0.125, 0.2, 0.42, 0.01, 0.01, 1); B.parts[sd > 0 ? 'mirL' : 'mirR'] = [q, sd > 0 ? 'left' : 'right', 60]; }
  // salon: o'rindiqlar qatori, haydovchi joyi
  if (!LITE) {
    T.mat(0x2d3a5a, 0.9, 0); for (let i = 0; i < 9; i++) { const z = hl - 2.0 - i * 0.82; for (const sd of [1, -1]) { T.rbox(sd * W * 0.55, Y(0.85), z, 0.85, 0.12, 0.45, 0.04, 1); T.rbox(sd * W * 0.55, Y(1.2), z - 0.22, 0.85, 0.6, 0.1, 0.04, 1); } }
    T.mat(0x1c1d21, 0.75, 0).rbox(0, Y(1.15), hl - 0.35, W * 1.9, 0.3, 0.35, 0.05, 1);
    T.mat(0xd8dce2, 0.2, 0.9); for (const sd of [1, -1]) T.tube([[sd * W * 0.2, Y(2.15), hl - 1.6], [sd * W * 0.2, Y(2.15), -hl + 0.6]], 0.016, 6);
    T.mat(0x1d1e22, 0.85, 0); emitInner(body, T, (i, j, a, b) => j >= 3 && j < 8 && !(a.raised[j] || b.raised[j]), 0.03); T.mat(0xb8b6b0, 0.9, 0); emitInner(body, T, (i, j) => j >= 12, 0.03);
  }
  B.bF = B.P(1); B.bR = B.P(2); B.bF.mat(0x3a3d44, 0.6, 0.1).rbox(0, Y(0.16), hl + 0.03, W * 1.96, 0.26, 0.14, 0.05, 2); B.bF.mat(0xe9e9e2, 0.45, 0).rbox(0, Y(0.16), hl + 0.1, 0.5, 0.11, 0.01, 0.004, 1); B.bR.mat(0x3a3d44, 0.6, 0.1).rbox(0, Y(0.2), -hl - 0.02, W * 1.9, 0.24, 0.12, 0.05, 2);
  B.parts.bumpF = [B.bF, 'front', 50]; B.parts.bumpR = [B.bR, 'rear', 45];
  const wo = { prof: 'road', rim: 0xc0c4ca, style: 'steel', holes: 10, nuts: 10, side: 0.36 * s.rF };
  B.wheels.push({ r: s.rF, w: 0.34, x: s.wx, z: s.wzF, src: [0], front: true, o: wo }, { r: s.rF, w: 0.34, x: -s.wx, z: s.wzF, src: [1], front: true, o: wo }, { r: s.rR, w: 0.51, x: s.wx - 0.06, z: -s.wzR, src: [2], o: wo }, { r: s.rR, w: 0.51, x: -s.wx + 0.06, z: -s.wzR, src: [3], o: wo });
  return assemble(v, B);
}

// ---------- traktor: kapot, kabina (ustunlar + oynalar), katta orqa g'ildiraklar, qanotlar ----------
function genTractor(v) {
  const s = v.spec, B = newB(91), P = B.paint, T = B.trim, G = B.glass, yb = s.clr - s.com, Y = (y) => yb + y, yt = s.hgt - s.com, axR = s.rR - s.com, axF = s.rF - s.com;
  // kapot va dvigatel
  P.rbox(0, Y(0.72), 1.08, 0.82, 0.72, 1.75, 0.12, 3, { tx: 0.92 });
  T.mat(0x121316, 0.4, 0.3).rbox(0, Y(0.64), 1.955, 0.62, 0.5, 0.02, 0.03, 1); T.mat(0x2a2c30, 0.5, 0.6); for (let i = 0; i < 6; i++) T.rbox(0, Y(0.44 + i * 0.08), 1.97, 0.58, 0.015, 0.012, 0.004, 1);
  T.mat(0x18191c, 0.6, 0.2); for (const sd of [1, -1]) for (let i = 0; i < 5; i++) T.rbox(sd * 0.413, Y(0.82), 1.45 + i * 0.08, 0.01, 0.22, 0.035, 0.004, 1);
  T.mat(0x2e3036, 0.5, 0.6).rbox(0, Y(0.22), 0.9, 0.6, 0.3, 2.0, 0.04, 1); T.rbox(0, Y(0.35), -0.25, 0.9, 0.5, 0.9, 0.06, 2);
  // old o'q va og'irliklar (qism)
  T.mat(0x2a2c30, 0.5, 0.6).rod([-(s.wx - 0.2), axF, s.wzF], [s.wx - 0.2, axF, s.wzF], 0.06, 0.06, 10);
  const bF = B.P(1); bF.mat(0x3a3d44, 0.6, 0.3); for (let i = 0; i < 5; i++) bF.rbox(0, Y(0.32), 2.08 + i * 0.075, 0.74, 0.34, 0.065, 0.02, 1); bF.mat(0x2a2c30, 0.5, 0.6).rbox(0, Y(0.5), 2.2, 0.2, 0.06, 0.4, 0.02, 1); B.parts.bumpF = [bF, 'front', 45];
  // kabina: pol, ustunlar, tom, oynalar
  const cz0 = 0.18, cz1 = -1.35, cy0 = Y(1.02), cyt = yt - 0.1;
  T.mat(0x1d1e22, 0.7, 0.3).rbox(0, cy0, (cz0 + cz1) / 2, 1.2, 0.06, cz0 - cz1, 0.02, 1);
  T.mat(0x1a1b1f, 0.45, 0.5); for (const [x, z] of [[0.56, cz0], [-0.56, cz0], [0.6, cz1], [-0.6, cz1]]) T.tube([[x, cy0, z], [x * 0.95, cyt, z - 0.04]], 0.035, 8);
  P.rbox(0, yt - 0.04, (cz0 + cz1) / 2 - 0.05, 1.42, 0.1, 1.75, 0.04, 2);
  T.mat(0xe8e8e2, 0.6, 0).rbox(0, yt - 0.1, (cz0 + cz1) / 2 - 0.05, 1.3, 0.02, 1.6, 0.01, 1);
  const pane = (a, b, c, d, out) => G.qF(a, b, c, d, out);
  pane([-0.54, cy0 + 0.1, cz0 + 0.01], [0.54, cy0 + 0.1, cz0 + 0.01], [0.52, cyt - 0.04, cz0 - 0.03], [-0.52, cyt - 0.04, cz0 - 0.03], [0, 0, 1]);
  pane([-0.58, cy0 + 0.3, cz1 - 0.01], [0.58, cy0 + 0.3, cz1 - 0.01], [0.56, cyt - 0.04, cz1 - 0.05], [-0.56, cyt - 0.04, cz1 - 0.05], [0, 0, -1]);
  for (const sd of [1, -1]) pane([sd * 0.6, cy0 + 0.1, cz0 - 0.03], [sd * 0.62, cy0 + 0.1, cz1 + 0.03], [sd * 0.58, cyt - 0.04, cz1 + 0.02], [sd * 0.55, cyt - 0.04, cz0 - 0.06], [sd, 0, 0]);
  T.mat(0x2a2b30, 0.9, 0).rbox(0, Y(1.14), -0.78, 0.5, 0.12, 0.48, 0.05, 1); T.rbox(0, Y(1.45), -1.0, 0.5, 0.55, 0.12, 0.05, 1);
  T.mat(0x121316, 0.5, 0); const wc = [0, Y(1.62), -0.18], ring = []; for (let k = 0; k <= 16; k++) { const a = (k / 16) * Math.PI * 2; ring.push([wc[0] + Math.cos(a) * 0.19, wc[1] + Math.sin(a) * 0.19 * 0.64, wc[2] + Math.sin(a) * 0.19 * 0.77]); } T.tube(ring, 0.018, 6); T.rod(wc, [0, Y(1.1), 0.08], 0.03, 0.04, 6);
  // orqa qanotlar (bo'yalgan yoy) va chiroqlar
  for (const sd of [1, -1]) { const pts = []; for (let k = 0; k <= 12; k++) { const a = -1.5 + 2.6 * k / 12; pts.push([sd * s.wx, axR + Math.cos(a) * (s.rR + 0.1), -s.wzR + Math.sin(a) * (s.rR + 0.1)]); } P.sweep(pts, [[-0.32, 0], [0.32, 0], [0.32, 0.02], [-0.32, 0.02]], [sd, 0, 0], { closed: true, flat: true }); }
  for (const sd of [1, -1]) { B.tail.rbox(sd * s.wx, axR + s.rR + 0.15, -s.wzR - 0.55, 0.14, 0.08, 0.03, 0.01, 1); (sd > 0 ? B.sigL : B.sigR).rbox(sd * (s.wx + 0.2), axR + s.rR + 0.15, -s.wzR - 0.52, 0.06, 0.08, 0.03, 0.01, 1);
    T.mat(0x24262b, 0.2, 0.8).rbox(sd * 0.25, Y(0.82), 1.955, 0.16, 0.14, 0.02, 0.02, 1); B.head.rbox(sd * 0.25, Y(0.82), 1.965, 0.13, 0.11, 0.01, 0.02, 1); B.head.rbox(sd * 0.45, yt + 0.03, cz0 + 0.02, 0.14, 0.1, 0.04, 0.02, 1); }
  B.lampY = Y(0.82);
  // egzoz, tutqichlar, tirkama moslamasi
  T.mat(0x1a1b1e, 0.5, 0.5); T.tube([[0.3, Y(1.05), 1.35], [0.3, Y(2.2), 1.35]], 0.05, 8); T.mat(0xc8ccd2, 0.2, 0.9).tube([[0.3, Y(1.4), 1.35], [0.3, Y(1.9), 1.35]], 0.065, 8);
  T.mat(0x2a2c30, 0.5, 0.6); for (const sd of [1, -1]) T.tube([[sd * 0.25, Y(0.35), -0.6], [sd * 0.32, Y(0.15), -1.6]], 0.04, 6); T.tube([[0, Y(0.85), -0.75], [0, Y(0.5), -1.62]], 0.035, 6);
  T.mat(0x9aa0a8, 0.3, 0.9); for (const sd of [1, -1]) T.rbox(sd * 0.62, Y(0.6), 0.0, 0.2, 0.03, 0.3, 0.01, 1);
  const wo = { prof: 'agri', rim: 0xf0b83a, style: 'disc', rimR: 0.45, rimM: 0.3 };
  B.wheels.push({ r: s.rF, w: 0.3, x: s.wx - 0.1, z: s.wzF, src: [0], front: true, o: wo }, { r: s.rF, w: 0.3, x: -s.wx + 0.1, z: s.wzF, src: [1], front: true, o: wo }, { r: s.rR, w: 0.52, x: s.wx, z: -s.wzR, src: [2], o: wo }, { r: s.rR, w: 0.52, x: -s.wx, z: -s.wzR, src: [3], o: wo });
  B.rider = { hip: [0, Y(1.2), -0.78], lean: 0.05, hand: [0.18, Y(1.6), -0.22], foot: [0.2, Y(1.08), -0.2], knee: 0.16, shirt: 0xb84a34, pants: 0x2f4a78 };
  const m = assemble(v, B); m.open = false; m.riderAlways = true; return m;
}

// ---------- ochiq transportlar: karting, kvadrotsikl, bagi, bolid ----------
function genOpen(v) {
  const s = v.spec, id = v.id, B = newB(id.length * 23 + 5), P = B.paint, T = B.trim, yb = s.clr - s.com, Y = (y) => yb + y, hl = s.len / 2, axF = s.rF - s.com, axR = s.rR - s.com;
  const CRM = 0x8c9098, DK = 0x15161a;
  if (id === 'kart') {
    T.mat(0x9aa0a8, 0.3, 0.85); for (const sd of [1, -1]) T.tube([[sd * 0.16, Y(0.06), hl - 0.12], [sd * 0.3, Y(0.04), 0.35], [sd * 0.33, Y(0.04), -0.5], [sd * 0.25, Y(0.06), -hl + 0.15]], 0.016, 6);
    for (const z of [s.wzF, 0.1, -s.wzR]) T.rod([-0.34, Y(0.04), z], [0.34, Y(0.04), z], 0.014, 0.014, 6);
    T.rod([-s.wx + 0.06, axR, -s.wzR], [s.wx - 0.06, axR, -s.wzR], 0.02, 0.02, 8);
    P.rbox(0, Y(0.12), hl - 0.14, 0.86, 0.13, 0.32, 0.05, 2, { tx: 0.8 }); for (const sd of [1, -1]) P.rbox(sd * 0.5, Y(0.13), -0.02, 0.2, 0.15, 0.85, 0.06, 2, { tx: 0.8 });
    P.rbox(0, Y(0.26), 0.42, 0.34, 0.26, 0.12, 0.05, 2, { tz: 0.6 });
    T.mat(DK, 0.25, 0.1).rbox(0, Y(0.1), -0.16, 0.42, 0.08, 0.38, 0.06, 2); T.push().translate(0, Y(0.14), -0.34).rotX(-0.35); T.rbox(0, 0.16, 0, 0.42, 0.36, 0.06, 0.06, 2); T.pop();
    T.mat(0x3a3d44, 0.4, 0.7).rbox(0.26, Y(0.2), -0.62, 0.24, 0.24, 0.26, 0.04, 1); T.mat(0x8a8e96, 0.35, 0.85); for (let i = 0; i < 5; i++) T.rbox(0.26, Y(0.34 + i * 0.022), -0.62, 0.2, 0.01, 0.22, 0.004, 1);
    T.mat(0x5a5e66, 0.3, 0.8).tube([[0.36, Y(0.25), -0.55], [0.45, Y(0.25), -0.75], [0.36, Y(0.22), -0.9]], 0.04, 8, { cap: true });
    T.mat(DK, 0.5, 0); T.rod([0, Y(0.1), 0.6], [0, Y(0.5), 0.36], 0.016, 0.016, 6); const wc = [0, Y(0.52), 0.34], ring = []; for (let k = 0; k <= 14; k++) { const a = (k / 14) * Math.PI * 2; ring.push([Math.cos(a) * 0.14, wc[1] + Math.sin(a) * 0.14 * 0.55, wc[2] + Math.sin(a) * 0.14 * 0.84]); } T.tube(ring, 0.016, 6);
    const bF = B.P(1); bF.mat(0x9aa0a8, 0.3, 0.85).tube([[-0.5, Y(0.06), hl - 0.08], [-0.3, Y(0.1), hl], [0.3, Y(0.1), hl], [0.5, Y(0.06), hl - 0.08]], 0.016, 6); B.parts.bumpF = [bF, 'front', 50];
    const bR = B.P(2); bR.mat(0x9aa0a8, 0.3, 0.85).tube([[-0.55, Y(0.08), -hl + 0.15], [-0.45, Y(0.1), -hl], [0.45, Y(0.1), -hl], [0.55, Y(0.08), -hl + 0.15]], 0.018, 6); B.parts.bumpR = [bR, 'rear', 46];
    B.tail.rbox(0, Y(0.2), -hl - 0.01, 0.12, 0.04, 0.02, 0.01, 1); B.lampY = Y(0.15);
    std4(B, s, 0.15, { prof: 'kart', rim: 0xf0b83a, style: 'y', spokes: 6, rimR: 0.4, rimM: 0.6, noCal: true });
    B.rider = { hip: [0, Y(0.14), -0.24], lean: -0.22, hand: [0.14, Y(0.5), 0.33], foot: [0.2, Y(0.14), 0.62], knee: 0.22, helmet: 0xf2f2ee, shirt: 0xe2572f };
  } else if (id === 'kvadro') {
    // plastik qanotlar (silliq), o'rindiq, rul, yuk panjaralari, osma
    for (const [z, ax] of [[s.wzF, axF], [-s.wzR, axR]]) for (const sd of [1, -1]) P.blob(1, 2, { cx: sd * 0.46, cy: ax + s.rF + 0.06, cz: z, sx: 0.2, sy: 0.07, sz: 0.42, shade: 0 });
    P.blob(1, 2, { cx: 0, cy: Y(0.5), cz: 0.62, sx: 0.32, sy: 0.16, sz: 0.36, shade: 0 }); P.blob(1, 2, { cx: 0, cy: Y(0.48), cz: -0.62, sx: 0.34, sy: 0.14, sz: 0.36, shade: 0 });
    P.rbox(0, Y(0.42), 0.05, 0.4, 0.3, 1.2, 0.1, 2, { tx: 0.85 });
    T.mat(DK, 0.7, 0).rbox(0, Y(0.62), -0.32, 0.36, 0.12, 0.7, 0.05, 2, { tx: 0.85 });
    T.mat(0x2e3036, 0.5, 0.6).rbox(0, Y(0.2), 0, 0.42, 0.26, 0.9, 0.05, 1); T.mat(0x8a8e96, 0.35, 0.85); for (let i = 0; i < 4; i++) T.rbox(0, Y(0.3), -0.2 + i * 0.1, 0.46, 0.012, 0.05, 0.004, 1);
    T.mat(0x2a2c30, 0.4, 0.7); for (const sd of [1, -1]) for (const [z, ax] of [[s.wzF, axF], [-s.wzR, axR]]) { T.tube([[sd * 0.18, Y(0.18), z + 0.12], [sd * (s.wx - 0.12), ax, z]], 0.018, 6); T.tube([[sd * 0.18, Y(0.18), z - 0.12], [sd * (s.wx - 0.12), ax, z]], 0.018, 6); T.mat(0xc83a2a, 0.4, 0.3); T.rod([sd * 0.2, Y(0.45), z], [sd * (s.wx - 0.18), ax + 0.05, z], 0.025, 0.025, 6); T.mat(0x2a2c30, 0.4, 0.7); }
    T.mat(DK, 0.5, 0.3); T.rod([0, Y(0.5), 0.42], [0, Y(0.82), 0.3], 0.025, 0.025, 6); T.tube([[-0.36, Y(0.86), 0.24], [-0.15, Y(0.84), 0.3], [0.15, Y(0.84), 0.3], [0.36, Y(0.86), 0.24]], 0.016, 6); T.mat(0x111214, 0.8, 0); for (const sd of [1, -1]) T.rod([sd * 0.3, Y(0.857), 0.255], [sd * 0.4, Y(0.865), 0.23], 0.022, 0.022, 6);
    T.mat(0x2a2c30, 0.4, 0.7); for (const [z0, w0] of [[0.72, 0.5], [-0.75, 0.56]]) { T.tube([[-w0 / 2, Y(0.64), z0 - 0.15], [-w0 / 2, Y(0.64), z0 + 0.15], [w0 / 2, Y(0.64), z0 + 0.15], [w0 / 2, Y(0.64), z0 - 0.15]], 0.012, 4); for (let i = 1; i < 4; i++) T.rod([-w0 / 2, Y(0.64), z0 - 0.15 + 0.075 * i], [w0 / 2, Y(0.64), z0 - 0.15 + 0.075 * i], 0.008, 0.008, 4, false); }
    T.mat(0x24262b, 0.2, 0.8).rbox(0, Y(0.52), 0.97, 0.36, 0.1, 0.03, 0.02, 1); B.head.rbox(0.09, Y(0.52), 0.985, 0.13, 0.07, 0.008, 0.02, 1); B.head.rbox(-0.09, Y(0.52), 0.985, 0.13, 0.07, 0.008, 0.02, 1);
    B.tail.rbox(0, Y(0.5), -0.98, 0.3, 0.05, 0.02, 0.01, 1); B.lampY = Y(0.52);
    const bF = B.P(1); bF.mat(0x2a2c30, 0.4, 0.7).tube([[-0.3, Y(0.18), hl - 0.12], [-0.28, Y(0.32), hl - 0.02], [0.28, Y(0.32), hl - 0.02], [0.3, Y(0.18), hl - 0.12]], 0.02, 6); B.parts.bumpF = [bF, 'front', 50];
    T.mat(0x5a5e66, 0.3, 0.8).tube([[0.12, Y(0.25), -0.3], [0.2, Y(0.38), -0.8], [0.2, Y(0.4), -0.98]], 0.03, 6);
    std4(B, s, 0.26, { prof: 'off', rim: 0x33353c, style: 'y', spokes: 4 });
    B.rider = { hip: [0, Y(0.7), -0.28], lean: 0.3, hand: [0.34, Y(0.88), 0.27], foot: [0.3, Y(0.22), 0.05], knee: 0.2, helmet: 0x3f9a58, shirt: 0x2a2c33 };
  } else if (id === 'bagi') {
    // trubali karkas (bo'yalgan), tag, burun, dvigatel, o'rindiqlar
    T.mat(0x2e3036, 0.6, 0.4).rbox(0, Y(0.08), -0.05, 1.05, 0.06, 2.4, 0.02, 1);
    P.rbox(0, Y(0.28), 1.02, 0.86, 0.26, 0.9, 0.12, 2, { tx: 0.75, tz: 0.85 });
    const top = s.hgt - s.com - 0.04, R = 0.03; P.color(0xffffff);
    for (const sd of [1, -1]) {
      P.tube([[sd * 0.55, Y(0.12), 0.75], [sd * 0.55, Y(0.4), 0.6], [sd * 0.5, top - 0.06, 0.08], [sd * 0.48, top, -0.15], [sd * 0.48, top, -0.68], [sd * 0.5, top - 0.05, -0.85], [sd * 0.56, Y(0.3), -1.38]], R, 8);
      P.tube([[sd * 0.48, top - 0.02, -0.75], [sd * 0.55, Y(0.25), -0.72]], R, 8); P.tube([[sd * 0.55, Y(0.12), 0.75], [sd * 0.55, Y(0.12), -1.3]], R, 8); P.tube([[sd * 0.55, Y(0.4), 0.0], [sd * 0.55, Y(0.4), -0.72]], R * 0.8, 8);
    }
    for (const [y, z] of [[top, -0.15], [top, -0.7], [Y(0.4), 0.6], [Y(0.12), -1.3]]) P.tube([[-0.5, y, z], [0.5, y, z]], R, 8);
    P.tube([[-0.48, top, -0.15], [0.48, top, -0.7]], R * 0.8, 8);
    T.mat(0x2e3036, 0.5, 0.6).rbox(0, Y(0.42), -1.12, 0.62, 0.42, 0.55, 0.06, 2); T.mat(0x8a8e96, 0.35, 0.85); for (let i = 0; i < 6; i++) T.rbox(0, Y(0.66 + i * 0.03), -1.12, 0.5, 0.012, 0.4, 0.004, 1);
    T.mat(0x9aa0a8, 0.2, 0.9); for (const sd of [1, -1]) T.tube([[sd * 0.2, Y(0.6), -1.25], [sd * 0.25, Y(0.75), -1.5], [sd * 0.25, Y(0.9), -1.6]], 0.035, 8);
    T.mat(DK, 0.8, 0); for (const sd of [1, -1]) { T.rbox(sd * 0.25, Y(0.2), -0.35, 0.44, 0.1, 0.44, 0.05, 1); T.push().translate(sd * 0.25, Y(0.25), -0.56).rotX(-0.25); T.rbox(0, 0.28, 0, 0.44, 0.6, 0.1, 0.06, 2); T.pop(); }
    T.mat(DK, 0.5, 0); T.rod([0.25, Y(0.3), 0.55], [0.25, Y(0.66), 0.22], 0.016, 0.016, 6); const wc = [0.25, Y(0.68), 0.2], ring = []; for (let k = 0; k <= 14; k++) { const a = (k / 14) * Math.PI * 2; ring.push([wc[0] + Math.cos(a) * 0.15, wc[1] + Math.sin(a) * 0.15 * 0.6, wc[2] + Math.sin(a) * 0.15 * 0.8]); } T.tube(ring, 0.016, 6);
    T.mat(0x9aa0a8, 0.3, 0.8); for (const sd of [1, -1]) { T.tube([[sd * 0.4, Y(0.15), s.wzF], [sd * (s.wx - 0.12), axF, s.wzF]], 0.022, 6); T.tube([[sd * 0.4, Y(0.42), s.wzF - 0.08], [sd * (s.wx - 0.16), axF + 0.06, s.wzF]], 0.022, 6); T.tube([[sd * 0.45, Y(0.2), -s.wzR + 0.3], [sd * (s.wx - 0.14), axR, -s.wzR]], 0.025, 6);
      for (const [z, ax, x0] of [[s.wzF, axF, 0.35], [-s.wzR, axR, 0.42]]) { const a = [sd * (s.wx - 0.2), ax + 0.05, z], b = [sd * x0, Y(0.75), z + (z > 0 ? -0.1 : 0.12)]; T.mat(0xd8dce2, 0.2, 0.9); T.rod(a, b, 0.022, 0.022, 6); T.mat(0xe2572f, 0.35, 0.3); const pts = []; for (let k = 0; k <= 30; k++) { const t = 0.1 + (k / 30) * 0.55, p = lerp3(a, b, t), ang = k * 0.9; pts.push([p[0] + Math.cos(ang) * 0.05, p[1], p[2] + Math.sin(ang) * 0.05]); } T.tube(pts, 0.01, 4); T.mat(0x9aa0a8, 0.3, 0.8); } }
    for (const sd of [1, -1]) { T.mat(0x24262b, 0.2, 0.8).rbox(sd * 0.26, Y(0.44), 1.42, 0.16, 0.12, 0.04, 0.03, 1); B.head.rbox(sd * 0.26, Y(0.44), 1.443, 0.13, 0.09, 0.008, 0.03, 1); }
    for (const x of [-0.3, -0.1, 0.1, 0.3]) { T.mat(DK, 0.4, 0.3).rbox(x, top + 0.07, -0.15, 0.15, 0.1, 0.07, 0.02, 1); B.head.rbox(x, top + 0.07, -0.113, 0.13, 0.08, 0.006, 0.02, 1); }
    B.tail.rbox(0, Y(0.5), -1.47, 0.5, 0.05, 0.02, 0.01, 1); B.lampY = Y(0.44);
    const bF = B.P(1); bF.mat(0x9aa0a8, 0.3, 0.85).tube([[-0.45, Y(0.04), hl - 0.12], [-0.42, Y(0.2), hl - 0.04], [0.42, Y(0.2), hl - 0.04], [0.45, Y(0.04), hl - 0.12]], 0.022, 6); B.parts.bumpF = [bF, 'front', 50];
    const sp = B.P(7); sp.push().translate(0, Y(0.95), -1.5).rotX(0.3).rotY(-Math.PI / 2); wheelInto(sp, 0.36, 0.2, { prof: 'off', rim: 0x33353c, style: 'y', spokes: 4, lite: true }); sp.pop(); B.parts.spare = [sp, 'rear', 32];
    B.wheels.push({ r: s.rF, w: 0.2, x: s.wx, z: s.wzF, src: [0], front: true, o: { prof: 'off', rim: 0x33353c, style: 'y', spokes: 4 } }, { r: s.rF, w: 0.2, x: -s.wx, z: s.wzF, src: [1], front: true, o: { prof: 'off', rim: 0x33353c, style: 'y', spokes: 4 } }, { r: s.rR, w: 0.34, x: s.wx, z: -s.wzR, src: [2], o: { prof: 'off', rim: 0x33353c, style: 'y', spokes: 4 } }, { r: s.rR, w: 0.34, x: -s.wx, z: -s.wzR, src: [3], o: { prof: 'off', rim: 0x33353c, style: 'y', spokes: 4 } });
    B.rider = { hip: [0.25, Y(0.32), -0.36], lean: -0.14, hand: [0.17, Y(0.72), 0.24], foot: [0.18, Y(0.22), 0.7], knee: 0.18, helmet: 0xf0b83a, shirt: 0x2f7fd0 };
    B.rider.x = 0.25; B.rider.hip[0] = 0;
  } else { // bolid
    const W0 = 0.44, plan = (z) => { const t = (z + 1.95) / 4.45; if (z > 0.95) return 0.06 + (0.22 - 0.06) * Math.pow(Math.max(0, (hl - 0.05 - z) / (hl - 0.05 - 0.95)), 0.7); if (z > 0.1) return 0.22 + (0.32 - 0.22) * (0.95 - z) / 0.85; if (z > -1.2) return 0.32 - 0.08 * Math.max(0, (-0.4 - z) / 0.8); return Math.max(0, 0.24 - 0.2 * Math.pow((-1.2 - z) / 0.8, 1.5)); void t; void W0; };
    const D = { hl, zf: hl - 0.05, zr: -2.0, W: 0.32, planFn: plan, top: [[hl - 0.05, Y(0.12)], [hl - 0.4, Y(0.2), 0.2], [0.95, Y(0.4), 0.4], [0.35, Y(0.5), 0.2], [-0.15, Y(0.5)], [-0.5, Y(0.78), 0.2], [-1.0, Y(0.72), 0.4], [-1.9, Y(0.42), 0.2], [-2.0, Y(0.3)]],
      bot: [[hl - 0.05, Y(0.08)], [hl - 0.6, Y(0.04), 0.3], [-2.0, Y(0.06)]], belt: [[hl, Y(0.1)], [0.9, Y(0.32)], [-0.3, Y(0.42)], [-2.0, Y(0.36)]], tumble: 0.7, hoodX: 0.82, crown: 0.06, crownH: 0.06, roofY: Y(0.78), hoodY: Y(0.5), wheels: [], step: 0.08 * (LITE ? 1.5 : 1), need: [0.35, -0.2] };
    const body = makeBody(D);
    emitBody(body, (i, j, s0, s1) => { const zc = (s0.z + s1.z) / 2; if (j < 2) return T.mat(DK, 0.6, 0.2); if (zc < 0.36 && zc > -0.22 && j >= 9) return null; return P; }, () => 1);
    T.mat(DK, 0.9, 0).rbox(0, Y(0.42), 0.06, 0.5, 0.06, 0.5, 0.03, 1);
    for (const sd of [1, -1]) { P.blob(1, 2, { cx: sd * 0.5, cy: Y(0.24), cz: -0.6, sx: 0.24, sy: 0.17, sz: 0.85, shade: 0 }); T.mat(DK, 0.6, 0).rbox(sd * 0.5, Y(0.25), 0.22, 0.22, 0.16, 0.04, 0.03, 1); }
    T.mat(DK, 0.5, 0.2).rbox(0, Y(0.02), -0.4, 1.5, 0.025, 2.6, 0.01, 1);
    T.mat(0x2a2c30, 0.3, 0.6); T.tube([[-0.24, Y(0.52), 0.33], [-0.22, Y(0.7), 0.1], [0, Y(0.76), -0.05], [0.22, Y(0.7), 0.1], [0.24, Y(0.52), 0.33]], 0.022, 6); T.rod([0, Y(0.5), 0.45], [0, Y(0.75), -0.03], 0.018, 0.018, 6);
    T.mat(0x2a2c30, 0.35, 0.6); for (const sd of [1, -1]) for (const [z, ax, x0] of [[s.wzF, axF, 0.12], [-s.wzR, axR, 0.25]]) for (const [dz, dy] of [[-0.18, 0.06], [0.18, 0.06], [-0.14, -0.06], [0.14, -0.06]]) T.rod([sd * x0, ax + dy + 0.04, z + dz], [sd * (s.wx - 0.13), ax + dy * 0.6, z], 0.012, 0.012, 4, false);
    const fw = B.P(1); fw.mat(0xffffff, 0.4, 0.2); fw.rbox(0, Y(0.04), hl - 0.12, 1.84, 0.03, 0.36, 0.01, 1, { tz: 0.8 }); fw.mat(DK, 0.4, 0.2); for (const sd of [1, -1]) { fw.rbox(sd * 0.6, Y(0.1), hl - 0.16, 0.55, 0.025, 0.18, 0.01, 1); fw.rbox(sd * 0.92, Y(0.1), hl - 0.12, 0.02, 0.18, 0.42, 0.006, 1); } B.parts.bumpF = [fw, 'front', 60, true];
    const rw = B.P(2); rw.mat(DK, 0.4, 0.2); for (const sd of [1, -1]) rw.rbox(sd * 0.48, Y(0.62), -2.2, 0.02, 0.52, 0.44, 0.006, 1); rw.mat(0xffffff, 0.4, 0.2); rw.rbox(0, Y(0.86), -2.2, 0.96, 0.035, 0.36, 0.012, 1, { tz: 0.8 }); rw.rbox(0, Y(0.72), -2.28, 0.96, 0.025, 0.22, 0.01, 1); rw.mat(DK, 0.4, 0.2); rw.rod([0, Y(0.3), -1.95], [0, Y(0.62), -2.2], 0.03, 0.03, 6); B.parts.bumpR = [rw, 'rear', 55, true];
    B.tail.rbox(0, Y(0.32), -2.0, 0.08, 0.12, 0.02, 0.01, 1); B.lampY = Y(0.2);
    const wo = { prof: 'slick', rim: 0x202127, style: 'y', spokes: 10, rimR: 0.3, rimM: 0.8, side: 0.42 };
    B.wheels.push({ r: s.rF, w: 0.3, x: s.wx, z: s.wzF, src: [0], front: true, o: Object.assign({}, wo, { side: 0.42 * s.rF }) }, { r: s.rF, w: 0.3, x: -s.wx, z: s.wzF, src: [1], front: true, o: Object.assign({}, wo, { side: 0.42 * s.rF }) }, { r: s.rR, w: 0.4, x: s.wx - 0.03, z: -s.wzR, src: [2], o: Object.assign({}, wo, { side: 0.42 * s.rR }) }, { r: s.rR, w: 0.4, x: -s.wx + 0.03, z: -s.wzR, src: [3], o: Object.assign({}, wo, { side: 0.42 * s.rR }) });
    B.rider = { hip: [0, Y(0.16), -0.28], lean: -0.5, hand: [0.12, Y(0.5), 0.32], foot: [0.1, Y(0.26), 1.0], knee: 0.08, helmet: 0xf0b83a, shirt: 0xd8392b };
  }
  return assemble(v, B);
}

// ---------- ikki g'ildirakli: velosiped, skuter, mototsikl ----------
function genBike(v) {
  const s = v.spec, id = v.id, B = newB(id.length * 29 + 3), P = B.paint, T = B.trim, yb = s.clr - s.com, Y = (y) => yb + y;
  const ax = s.rF - s.com, zF = s.wzF, zR = -s.wzR, fork = (B.fork = new VB(71, 0));
  if (id === 'velo') {
    const bb = [0, ax - 0.04, 0.0], seat = [0, ax + 0.6, -0.2], head = [0, ax + 0.56, zF - 0.2], headB = [0, ax + 0.42, zF - 0.16];
    P.color(0xffffff); P.rod(bb, seat, 0.018, 0.016, 8); P.rod(bb, headB, 0.022, 0.02, 8); P.rod([0, seat[1] - 0.06, seat[2] + 0.015], head, 0.016, 0.017, 8); P.rod(headB, head, 0.024, 0.024, 8);
    for (const sd of [1, -1]) { P.rod([sd * 0.03, bb[1], bb[2]], [sd * 0.055, ax, zR], 0.012, 0.01, 6); P.rod([sd * 0.02, seat[1] - 0.08, seat[2]], [sd * 0.055, ax, zR], 0.011, 0.009, 6); }
    T.mat(0x111214, 0.6, 0).rbox(0, seat[1] + 0.06, seat[2] - 0.03, 0.13, 0.05, 0.26, 0.025, 2, { tx: 0.6 }); T.mat(0xb0b4bc, 0.3, 0.9).rod([0, seat[1] - 0.05, seat[2] + 0.02], [0, seat[1] + 0.04, seat[2] - 0.02], 0.013, 0.013, 6);
    T.mat(0x2a2c30, 0.4, 0.7); const ch = []; for (let k = 0; k <= 24; k++) { const a = (k / 24) * Math.PI * 2, rr = k < 12 ? 0.09 : 0.04; const zc = k < 12 ? 0 : zR; ch.push([0.035, ax + Math.sin(a) * 0.09 * (k < 12 ? 1 : 0.5) - 0.04 * (k < 12 ? 1 : 0), zc + Math.cos(a) * rr]); } T.tube([[0.035, bb[1] + 0.09, 0], [0.035, ax + 0.04, zR], [0.035, ax - 0.04, zR], [0.035, bb[1] - 0.09, 0]], 0.004, 3);
    fork.mat(0xb0b4bc, 0.25, 0.9); for (const sd of [1, -1]) fork.rod([sd * 0.045, ax, zF], [sd * 0.035, ax + 0.42, zF - 0.15], 0.012, 0.014, 6); fork.rod([0, ax + 0.42, zF - 0.15], [0, ax + 0.72, zF - 0.24], 0.014, 0.014, 6);
    fork.mat(0x16171a, 0.5, 0.3).tube([[-0.29, ax + 0.73, zF - 0.27], [-0.2, ax + 0.75, zF - 0.24], [0, ax + 0.74, zF - 0.22], [0.2, ax + 0.75, zF - 0.24], [0.29, ax + 0.73, zF - 0.27]], 0.012, 6);
    fork.mat(0x101113, 0.8, 0); for (const sd of [1, -1]) fork.rod([sd * 0.22, ax + 0.735, zF - 0.26], [sd * 0.3, ax + 0.73, zF - 0.28], 0.017, 0.017, 6); fork.mat(0xe8e8e2, 0.4, 0.3).rbox(0, ax + 0.56, zF - 0.1, 0.06, 0.05, 0.05, 0.015, 1);
    const cr = new VB(72, 0); cr.mat(0xb0b4bc, 0.3, 0.9); cr.push().translate(0.04, bb[1], bb[2]); cr.lathe([[0.1, -0.003], [0.1, 0.003, 1], [0.02, 0.003]], 22); cr.pop();
    for (const sd of [1, -1]) { cr.mat(0xb0b4bc, 0.3, 0.9).rod([sd * 0.06, bb[1], bb[2]], [sd * 0.07, bb[1] + sd * 0.165, bb[2]], 0.012, 0.01, 6); cr.mat(0x16171a, 0.6, 0).rbox(sd * 0.11, bb[1] + sd * 0.165, bb[2], 0.08, 0.02, 0.06, 0.008, 1); }
    B.crank = { gb: cr, y: bb[1], z: bb[2] };
    B.tail.rbox(0, seat[1] - 0.08, seat[2] - 0.12, 0.035, 0.03, 0.02, 0.01, 1); B.head.rbox(0, ax + 0.56, zF - 0.07, 0.04, 0.035, 0.01, 0.01, 1);
    const wo = { thin: 0.028, rim: 0xd8dce4, spokes: 32 };
    B.wheels.push({ r: s.rF, w: 0.035, x: 0, z: zF, src: [0, 1], o: wo }, { r: s.rR, w: 0.035, x: 0, z: zR, src: [2, 3], o: wo });
    B.rider = { hip: [0, seat[1] + 0.06, seat[2] - 0.02], lean: 0.5, hand: [0.26, ax + 0.76, zF - 0.27], foot: [0.12, bb[1] - 0.02, bb[2] + 0.02], knee: 0.2, shirt: 0xf0b83a, helmet: 0x2fb5b0 };
    B.lampY = ax + 0.56;
  } else if (id === 'skuter') {
    // silliq panellar: oyoq qalqoni, pol, orqa kapot
    P.rbox(0, Y(0.08), 0.02, 0.32, 0.06, 0.7, 0.02, 1);
    P.push().translate(0, Y(0.45), zF - 0.38).rotX(-0.22); P.rbox(0, 0, 0, 0.42, 0.78, 0.07, 0.035, 2, { tx: 0.7 }); P.pop();
    P.blob(1, 2, { cx: 0, cy: Y(0.42), cz: zR + 0.1, sx: 0.2, sy: 0.24, sz: 0.48, shade: 0 });
    T.mat(0x2a2016, 0.75, 0).rbox(0, Y(0.68), zR + 0.18, 0.28, 0.09, 0.62, 0.04, 2, { tx: 0.85 }); T.mat(0x111214, 0.6, 0).rbox(0, Y(0.1), 0.05, 0.28, 0.015, 0.6, 0.005, 1);
    T.mat(0x3a3d44, 0.4, 0.6).rbox(0.06, Y(0.22), zR + 0.15, 0.14, 0.18, 0.36, 0.03, 1); T.mat(0x9aa0a8, 0.2, 0.9).tube([[-0.1, Y(0.18), zR + 0.15], [-0.14, Y(0.2), zR - 0.1], [-0.14, Y(0.24), zR - 0.25]], 0.035, 8, { cap: true });
    fork.mat(0xb0b4bc, 0.3, 0.9); for (const sd of [1, -1]) fork.rod([sd * 0.06, ax, zF], [sd * 0.05, ax + 0.36, zF - 0.1], 0.02, 0.02, 6);
    fork.color(0xffffff); fork.rbox(0, ax + s.rF + 0.06, zF - 0.02, 0.14, 0.06, 0.4, 0.03, 2, { tz: 0.7 });
    fork.color(0xffffff).rbox(0, Y(1.02), zF - 0.42, 0.42, 0.1, 0.14, 0.04, 2); fork.mat(0x2a2c30, 0.4, 0.5).rod([0, Y(0.82), zF - 0.36], [0, Y(0.98), zF - 0.41], 0.025, 0.025, 6);
    fork.mat(0x111214, 0.8, 0); for (const sd of [1, -1]) fork.rod([sd * 0.21, Y(1.03), zF - 0.43], [sd * 0.31, Y(1.03), zF - 0.44], 0.018, 0.018, 6);
    fork.mat(0x9aa0a8, 0.2, 0.9); for (const sd of [1, -1]) { fork.rod([sd * 0.16, Y(1.06), zF - 0.42], [sd * 0.24, Y(1.2), zF - 0.44], 0.006, 0.006, 4); fork.rbox(sd * 0.25, Y(1.22), zF - 0.44, 0.09, 0.06, 0.015, 0.01, 1); }
    T.mat(0x24262b, 0.2, 0.8).rbox(0, Y(0.92), zF - 0.3, 0.16, 0.12, 0.03, 0.03, 1); B.head.rbox(0, Y(0.92), zF - 0.284, 0.13, 0.09, 0.006, 0.03, 1);
    B.tail.rbox(0, Y(0.55), zR - 0.36, 0.12, 0.05, 0.02, 0.01, 1); B.lampY = Y(0.92);
    const wo = { thin: 0.07, rim: 0xd8dce4, style: 'cast', spokes: 5, disc: 0.1 };
    B.wheels.push({ r: s.rF, w: 0.1, x: 0, z: zF, src: [0, 1], o: wo }, { r: s.rR, w: 0.11, x: 0, z: zR, src: [2, 3], o: wo });
    B.rider = { hip: [0, Y(0.74), zR + 0.38], lean: 0.08, hand: [0.27, Y(1.04), zF - 0.44], foot: [0.1, Y(0.14), 0.2], knee: 0.12, shirt: 0xf2f2ee, helmet: 0xf0b83a };
  } else { // mototsikl
    T.mat(0x2e3036, 0.45, 0.65).rbox(0, ax + 0.12, 0.02, 0.26, 0.32, 0.46, 0.05, 2); T.mat(0x8a8e96, 0.3, 0.85); for (let i = 0; i < 6; i++) T.rbox(0, ax + 0.32 + i * 0.03, 0.12, 0.24, 0.012, 0.18, 0.004, 1);
    T.mat(0x9aa0a8, 0.15, 1); for (const sd of [1, -1]) T.tube([[sd * 0.08, ax + 0.2, 0.25], [sd * 0.12, ax - 0.05, 0.2], [sd * 0.14, ax - 0.04, -0.2], [sd * 0.16, ax + 0.06, zR - 0.1]], 0.026, 8);
    T.mat(0x2a2c30, 0.3, 0.7); for (const sd of [1, -1]) T.tube([[sd * 0.16, ax + 0.06, zR + 0.15], [sd * 0.16, ax + 0.1, zR - 0.25]], 0.055, 10, { cap: true });
    P.blob(1, 2, { cx: 0, cy: ax + 0.48, cz: 0.12, sx: 0.15, sy: 0.12, sz: 0.3, shade: 0 });
    P.push().translate(0, ax + 0.42, -0.5).rotX(0.18); P.rbox(0, 0, 0, 0.2, 0.1, 0.62, 0.05, 2, { tx: 0.6 }); P.pop();
    T.mat(0x121316, 0.7, 0).rbox(0, ax + 0.53, -0.38, 0.24, 0.06, 0.46, 0.03, 2, { tx: 0.8 });
    T.mat(0x2a2c30, 0.4, 0.7); for (const sd of [1, -1]) { T.rod([sd * 0.07, ax + 0.4, 0.38], [sd * 0.09, ax + 0.08, -0.15], 0.02, 0.02, 6); T.rod([sd * 0.09, ax + 0.08, -0.12], [sd * 0.08, ax, zR], 0.03, 0.025, 6); } T.mat(0xe2b030, 0.4, 0.4).rod([0.05, ax + 0.4, -0.3], [0.05, ax + 0.05, zR + 0.15], 0.025, 0.025, 6);
    fork.mat(0xd0d4da, 0.15, 1); for (const sd of [1, -1]) fork.rod([sd * 0.085, ax, zF], [sd * 0.08, ax + 0.36, zF - 0.15], 0.022, 0.022, 8);
    fork.mat(0x1d1e22, 0.35, 0.6); for (const sd of [1, -1]) fork.rod([sd * 0.08, ax + 0.36, zF - 0.15], [sd * 0.078, ax + 0.64, zF - 0.27], 0.028, 0.028, 8); fork.rbox(0, ax + 0.62, zF - 0.27, 0.22, 0.04, 0.08, 0.02, 1);
    fork.color(0xffffff); fork.rbox(0, ax + s.rF + 0.04, zF - 0.02, 0.13, 0.04, 0.38, 0.02, 2, { tz: 0.7 });
    fork.mat(0x1d1e22, 0.3, 0.6).tube([[-0.32, ax + 0.7, zF - 0.38], [-0.12, ax + 0.67, zF - 0.31], [0.12, ax + 0.67, zF - 0.31], [0.32, ax + 0.7, zF - 0.38]], 0.014, 6); fork.mat(0x101113, 0.8, 0); for (const sd of [1, -1]) fork.rod([sd * 0.24, ax + 0.69, zF - 0.35], [sd * 0.33, ax + 0.705, zF - 0.385], 0.02, 0.02, 6);
    fork.mat(0x24262b, 0.2, 0.8).rod([0, ax + 0.56, zF - 0.16], [0, ax + 0.56, zF - 0.02], 0.085, 0.09, 12, true); fork.mat(0x1a2a3a, 0.05, 0.3).rbox(0, ax + 0.74, zF - 0.24, 0.24, 0.16, 0.012, 0.02, 1, { tx: 0.7 });
    B.head.push().translate(0, ax + 0.56, zF - 0.012); B.head.prismZ(16, 0.075, 0.01); B.head.pop();
    B.tail.rbox(0, ax + 0.48, zR - 0.22, 0.1, 0.04, 0.02, 0.01, 1); B.lampY = ax + 0.58;
    const wo = { thin: 0.08, rim: 0x2a2c32, style: 'cast', spokes: 5, disc: 0.15 };
    B.wheels.push({ r: s.rF, w: 0.12, x: 0, z: zF, src: [0, 1], o: wo }, { r: s.rR, w: 0.16, x: 0, z: zR, src: [2, 3], o: Object.assign({}, wo, { disc: 0.11 }) });
    B.rider = { hip: [0, ax + 0.58, -0.36], lean: 0.6, hand: [0.3, ax + 0.7, zF - 0.37], foot: [0.16, ax + 0.02, -0.12], knee: 0.16, shirt: 0x2a2c33, helmet: 0xd8392b };
  }
  return assemble(v, B);
}

STYLE.jip = Object.assign({}, JEEP, { extra: (c) => jeepExtras(c, { flares, bullBar, rearPanes, lightBar }) });

// Namuna nusxasi: bir xil transport ikkinchi marta yasalmaydi — geometriya nusxalanadi (shikastlanadigan meshlar o'z massiviga ega), materiallar yangi
const TPL = {};
function cloneModel(src) {
  const root = src.root.clone(true), A = [], Bo = [], map = new Map(); src.root.traverse((o) => A.push(o)); root.traverse((o) => Bo.push(o)); A.forEach((o, i) => map.set(o, Bo[i]));
  const g = (o) => (o ? map.get(o) : null), pm = paintMaterial(src.paintMat.color.getHex(), src._seam), pp = paintMaterial(0xffffff); pp.color = pm.color;
  const lm = new Map([[src.paintMat, pm], [src._partPaint, pp]]); for (const k of ['headMat', 'tailMat', 'brakeMat', 'revMat', 'sigLMat', 'sigRMat']) lm.set(src[k], lampMat(src[k].color.getHex()));
  const own = new Set(src.deform.concat(Object.values(src.parts).map((p) => p.mesh)));
  for (const o of A) if (o.isMesh) { const c = map.get(o); if (lm.has(o.material)) c.material = lm.get(o.material); if (own.has(o)) c.geometry = o.geometry.clone(); }
  const out = Object.assign({}, src, { root, tilt: g(src.tilt), body: g(src.body), trimMesh: g(src.trimMesh), deform: src.deform.map(g), paintMat: pm, _partPaint: pp, rider: g(src.rider), fork: g(src.fork), crank: g(src.crank), spot: g(src.spot) });
  for (const k of ['headMat', 'tailMat', 'brakeMat', 'revMat', 'sigLMat', 'sigRMat']) out[k] = lm.get(src[k]);
  out.brakeMat.color = out.tailMat.color; out.spot.target = g(src.spot.target);
  out.parts = {}; for (const k in src.parts) { const p = src.parts[k]; out.parts[k] = { mesh: g(p.mesh), zone: p.zone, thr: p.thr, on: true, home: p.home.clone() }; }
  out.wheels = src.wheels.map((w) => Object.assign({}, w, { pivot: g(w.pivot), mesh: g(w.mesh), spin: g(w.spin) }));
  return out;
}
export function buildVehicle(id, opt = {}) {
  const v = vehById[id] || vehById.jip, key = v.id + (opt.lite ? ':L' : '');
  if (!TPL[key]) TPL[key] = buildVehicle0(v, opt);
  const m = cloneModel(TPL[key]); m.paintMat.color.setHex(v.hex);
  return m;
}
function buildVehicle0(v, opt) {
  LITE = !!opt.lite;
  let m;
  if (v.cls === 'bike') m = genBike(v);
  else if (v.cls === 'open') m = genOpen(v);
  else if (v.cls === 'tractor') m = genTractor(v);
  else if (v.cls === 'truck') m = genTruck(v, v.id === 'otochar' ? { fire: true, cabL: 2.6, cabH: 2.45 } : {});
  else if (v.cls === 'bus') m = genBus(v);
  else m = genCar(v, STYLE[v.id] || STYLE.sedan);
  LITE = false;
  m.paintMat.color.setHex(v.hex);
  return m;
}

// G'ildirak va rul holatini fizikadan modelga ko'chirish (pivot: joy + burilish, mesh: ezilish, spin: aylanish)
export function syncWheels(m, car, flat) {
  const W = car.wheels;
  for (let i = 0; i < m.wheels.length; i++) {
    const o = m.wheels[i], a = W[o.src[0]]; let len = a.len, spin = a.spin, ly = a.ly;
    if (o.src.length > 1) { const b = W[o.src[1]]; len = (len + b.len) / 2; spin = (spin + b.spin) / 2; }
    const fl = flat && flat[o.src[0]], st = o.front || (m.fork && i === 0) ? car.steer : 0;
    o.pivot.position.set(o.x, ly - len - (fl ? 0.06 * (o.r / 0.42) : 0), o.z);
    if (o.spin) { o.pivot.rotation.set(0, st, 0); o.spin.rotation.x = spin; } else o.pivot.rotation.set(spin, st, 0, 'YXZ');
    o.mesh.scale.y = o.mesh.scale.z = fl ? 0.86 : 1;
  }
  if (m.fork) m.fork.rotation.y = car.steer;
  if (m.crank) m.crank.rotation.x = W[2].spin * 0.42;
  if (m.bike) { const lean = Math.max(-0.6, Math.min(0.6, -car.steer * Math.abs(car.fwd) * Math.abs(car.fwd) * 0.11 / 9.81 * 2.2)); m.tilt.rotation.z += (lean - m.tilt.rotation.z) * 0.15; }
}
