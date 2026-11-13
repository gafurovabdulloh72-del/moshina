// Transportlar: 22 ta (velosipeddan bolidgacha). Har birining fizik "spec"i va protsedura bilan yasalgan modeli bor.
// Hamma dizayn va nomlar o'zimizniki (haqiqiy brendlar yo'q). O'qlar: +Z oldinga, +X chapga, markaz — og'irlik markazi.
import * as THREE from 'three';
import { GB, MAT } from './geo.js';
import { buildCarModel } from './carmodel.js';
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

// ---------- umumiy yordamchilar ----------
function wheelGeo(r, w, o = {}) {
  const g = new GB(260 + Math.round(r * 100)); g.jit = 0.04;
  if (o.thin) { // velosiped/skuter/mototsikl
    const n = 16, t = o.thin;
    g.color(TYRE); for (let i = 0; i < n; i++) { g.push().rotX((i / n) * 6.2832); g.box(0, r - t / 2, 0, w, t, (r - t / 2) * 6.2832 / n + 0.012); g.pop(); }
    g.color(o.rim || 0xc4c8d0); for (let i = 0; i < n; i++) { g.push().rotX((i / n) * 6.2832); g.box(0, r - t - 0.012, 0, w * 0.55, 0.024, (r - t) * 6.2832 / n + 0.01); g.pop(); }
    const sp = o.spokes || 8; g.color(o.solid ? (o.rim || 0xc4c8d0) : 0x9aa0aa);
    if (o.solid) { g.push().rotZ(-Math.PI / 2); g.cyl(10, r - t, r - t, -w * 0.2, w * 0.2, { cap: true }); g.rotZ(Math.PI); g.cyl(10, r - t, r - t, w * 0.19, w * 0.2, { cap: true }); g.pop(); }
    else for (let i = 0; i < sp; i++) { g.push().rotX((i / sp) * 6.2832); g.box(0, (r - t) / 2, 0, 0.012, r - t, 0.012); g.pop(); }
    g.color(0x5a5e68); g.push(); g.prismX(6, 0.045, w * 1.5); g.pop();
    return g.build();
  }
  const hw = w / 2;
  g.color(TYRE); g.push().rotZ(-Math.PI / 2); g.cyl(18, r, r, -hw, hw, { cap: true }); g.rotZ(Math.PI); g.cyl(18, r, r, hw - 0.001, hw, { cap: true }); g.pop();
  if (o.tread) { g.color(0x121316); const n = o.tread; for (let i = 0; i < n; i++) { g.push().rotX((i / n) * 6.2832); g.box(0, r + 0.004, 0, w * 1.04, 0.035 * (r / 0.42), r * 0.17); g.pop(); } }
  g.color(o.rim || 0xc4c8d0); g.push().translate(0.02, 0, 0); g.prismX(10, r * 0.56, w + 0.03); g.pop();
  g.color(o.spoke || 0x5a5e68); for (let i = 0; i < 5; i++) { g.push().rotX((i / 5) * 6.2832); g.box(hw + 0.022, r * 0.3, 0, 0.03, r * 0.2, r * 0.17); g.pop(); }
  g.color(0x8a8e98); g.push().translate(hw, 0, 0); g.prismX(6, r * 0.17, 0.06); g.pop();
  return g.build();
}
// Yon profilni (z,y nuqtalar) eni bo'ylab cho'zish. pts: [[z,y,(k)]] — k: shu nuqtadagi en ko'paytuvchisi
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
// O'tirgan haydovchi: hip (o'rindiq), qo'l uchlari (rul), oyoq uchlari
function riderGeo(o) {
  const g = new GB(555); g.jit = 0.03;
  const hip = o.hip, lean = o.lean || 0.12, tl = 0.56;
  const sh = [0, hip[1] + Math.cos(lean) * tl, hip[2] + Math.sin(lean) * tl];
  g.color(o.shirt || 0x2f7fd0); limb(g, [0, hip[1] + 0.05, hip[2]], [0, sh[1], sh[2]], 0.4, 0.24);
  for (const sx of [-1, 1]) {
    g.color(o.shirt || 0x2f7fd0); const s0 = [sx * 0.22, sh[1] - 0.06, sh[2]], hd = [sx * o.hand[0], o.hand[1], o.hand[2]];
    const el = [(s0[0] + hd[0]) / 2 + sx * 0.05, (s0[1] + hd[1]) / 2 - 0.1, (s0[2] + hd[2]) / 2 - 0.03]; limb(g, s0, el, 0.11); g.color(SKIN); limb(g, el, hd, 0.09);
    g.color(o.pants || 0x3a3f4c); const h0 = [sx * 0.12, hip[1], hip[2]], ft = [sx * o.foot[0], o.foot[1], o.foot[2]];
    const kn = [sx * (o.foot[0] + 0.03), (h0[1] + ft[1]) / 2 + (o.knee || 0.2), (h0[2] + ft[2]) / 2 + 0.1]; limb(g, h0, kn, 0.16); limb(g, kn, ft, 0.13); g.color(0x2a2c33).box(ft[0], ft[1] - 0.03, ft[2] + 0.07, 0.12, 0.09, 0.26);
  }
  g.color(SKIN).blob(0.17, 1, { cx: 0, cy: sh[1] + 0.22, cz: sh[2] + 0.03 });
  if (o.helmet) { g.color(o.helmet).blob(0.215, 1, { cx: 0, cy: sh[1] + 0.25, cz: sh[2] + 0.02 }); g.color(0x15161a).box(0, sh[1] + 0.24, sh[2] + 0.17, 0.3, 0.12, 0.12); }
  else g.color(0x3a2a20).blob(0.185, 0, { cx: 0, cy: sh[1] + 0.3, cz: sh[2] - 0.02, sy: 0.62 });
  return g.build();
}

// Yig'ish: materiallar, qismlar, g'ildiraklar, chiroqlar
function assemble(v, B) {
  const s = v.spec, root = new THREE.Group(), tilt = new THREE.Group(); root.add(tilt);
  const paintMat = new THREE.MeshStandardMaterial({ vertexColors: true, color: v.hex, metalness: 0.42, roughness: 0.36, envMapIntensity: 1.0 });
  const mesh = (gb, mat, shadow = true) => { const m = new THREE.Mesh(gb.build(), mat); m.castShadow = shadow; tilt.add(m); return m; };
  const body = mesh(B.paint, paintMat), trimMesh = mesh(B.trim, MAT.flat);
  const deform = [body, trimMesh];
  if (B.glass && B.glass.count) deform.push(mesh(B.glass, MAT.glass, false));
  const parts = {};
  for (const name in B.parts || {}) {
    const [gb, zone, thr, painted] = B.parts[name]; if (!gb.count) continue;
    const geo = gb.build(), c = new THREE.Vector3(); geo.boundingBox.getCenter(c); geo.translate(-c.x, -c.y, -c.z);
    const m = new THREE.Mesh(geo, painted ? paintMat : MAT.flat); m.position.copy(c); m.castShadow = true; tilt.add(m); parts[name] = { mesh: m, zone, thr, on: true, home: c.clone() };
  }
  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff6d8, vertexColors: true, fog: false }), tailMat = new THREE.MeshBasicMaterial({ color: 0x7a1010, vertexColors: true, fog: false });
  if (B.head.count) mesh(B.head, headMat, false); if (B.tail.count) mesh(B.tail, tailMat, false);
  const wheels = [], geos = {};
  for (const w of B.wheels) {
    const key = w.r + '_' + w.w + '_' + (w.style || ''); const geo = geos[key] || (geos[key] = wheelGeo(w.r, w.w, w.o || {}));
    const pivot = new THREE.Group(), m = new THREE.Mesh(geo, MAT.flat); m.castShadow = true; if (w.x < 0) m.scale.x = -1; pivot.add(m); tilt.add(pivot);
    wheels.push({ pivot, mesh: m, src: w.src, x: w.x, z: w.z, front: !!w.front, r: w.r });
  }
  const spot = new THREE.SpotLight(0xfff0d0, 0, 120, 0.62, 0.55, 1.0);
  spot.position.set(0, B.lampY != null ? B.lampY : 0.3, s.len / 2 - 0.1); spot.target.position.set(0, -1.6 - s.com + 0.79, s.len / 2 + 20); root.add(spot); root.add(spot.target);
  let rider = null;
  if (B.rider) { rider = new THREE.Mesh(riderGeo(B.rider), MAT.flat); rider.castShadow = true; rider.visible = false; tilt.add(rider); }
  const out = { id: v.id, v, spec: s, root, tilt, body, trimMesh, deform, parts, paintMat, headMat, tailMat, wheels, spot, rider, open: !!B.rider, fork: null, crank: null, bike: !!s.bike };
  if (B.fork) { const f = new THREE.Mesh(B.fork.build(), MAT.flat); f.castShadow = true; f.position.set(0, 0, s.wzF); f.geometry.translate(0, 0, -s.wzF); tilt.add(f); out.fork = f; }
  if (B.crank) { const c = new THREE.Mesh(B.crank.gb.build(), MAT.flat); c.position.set(0, B.crank.y, B.crank.z); c.geometry.translate(0, -B.crank.y, -B.crank.z); tilt.add(c); out.crank = c; }
  return out;
}
const newB = (seed) => { const mk = (i, j = 0.025) => { const g = new GB(seed * 7 + i); g.jit = j; return g; }; const b = { paint: mk(1, 0.02), trim: mk(2, 0.03), glass: mk(3, 0.01), head: mk(4, 0), tail: mk(5, 0), parts: {}, wheels: [], P: (i) => mk(10 + i, 0.03) }; b.paint.color(0xffffff); b.head.color(0xffffff); b.tail.color(0xffffff); b.glass.color(0xffffff); return b; };
const std4 = (B, s, w, o) => { B.wheels.push({ r: s.rF, w, x: s.wx, z: s.wzF, src: [0], front: true, o }, { r: s.rF, w, x: -s.wx, z: s.wzF, src: [1], front: true, o }, { r: s.rR, w: w * (s.rR > s.rF * 1.2 ? 1.5 : 1), x: s.wx, z: -s.wzR, src: [2], o }, { r: s.rR, w: w * (s.rR > s.rF * 1.2 ? 1.5 : 1), x: -s.wx, z: -s.wzR, src: [3], o }); };

// ---------- yengil mashina (parametrik) ----------
// o: cowl (old oyna tagi z), rf/rr (tom boshi/oxiri z), deck (orqa oyna tagi z), belt, hoodDrop, deckDrop, tumble
function genCar(v, o) {
  const s = v.spec, B = newB(v.id.length * 13 + s.len * 10), P = B.paint, Tm = B.trim, G = B.glass;
  const hl = s.len / 2, hw = s.wid / 2 - (o.fender || 0), yb = s.clr - s.com, yt = s.hgt - s.com, belt = yb + o.belt, bh = o.bump || 0.26;
  const zf = hl - 0.1, zr = -hl + 0.1;
  const hoodY = belt - (o.hoodDrop || 0.06), deckY = belt - (o.deckDrop || 0);
  // pastki korpus
  const prof = [[zr, yb + 0.1, 0.9], [zf, yb + 0.1, 0.9], [zf + 0.04, yb + bh * 1.1, 0.9], [zf - 0.02, hoodY - 0.05, 0.86]];
  if (!o.hoodPart) prof.push([zf - 0.25, hoodY, 0.9]);
  prof.push([o.cowl, belt, 0.97]);
  if (o.pickup) { prof.push([o.rr - 0.02, belt, 0.97], [o.rr - 0.04, belt - 0.34, 0.97], [zr + 0.1, belt - 0.34, 0.96]); }
  else if (o.box) { /* tom butun uzunlikda */ prof.push([zr + 0.04, belt, 0.97]); }
  else prof.push([o.deck, belt, 0.97], [zr + 0.14, deckY, 0.94]);
  prof.push([zr - 0.03, yb + bh * 1.3, 0.92]);
  if (o.hoodPart) { // kapot alohida qism (qattiq urilganda uchib ketadi)
    prof.splice(4, 0, [zf - 0.2, hoodY - 0.08, 0.86], [o.cowl + 0.02, belt - 0.08, 0.9]);
    const hp = B.P(6); hp.color(0xffffff); extrude(hp, [[zf - 0.22, hoodY - 0.085], [zf - 0.24, hoodY], [o.cowl + 0.03, belt], [o.cowl + 0.03, belt - 0.085]], hw * 0.9); B.parts.hood = [hp, 'front', 26, true];
    Tm.color(0x33353c).box(0, belt - 0.2, (zf + o.cowl) / 2 - 0.1, hw * 1.2, 0.2, (zf - o.cowl) * 0.5); Tm.color(STEEL).box(0, belt - 0.12, (zf + o.cowl) / 2 - 0.1, hw * 0.5, 0.1, (zf - o.cowl) * 0.3);
  }
  extrude(P, prof, hw);
  // kabina: oyna hajmi + tom
  const tb = o.tumble || 0.84, rh = yt - 0.05;
  if (o.box) { // furgon: bo'yalgan quti, old oynasi bor
    extrude(P, [[o.cowl, belt, 0.97], [o.rf, yt, 0.92], [zr + 0.06, yt, 0.92], [zr + 0.04, belt, 0.97]], hw);
    G.box(0, (belt + yt) / 2 + 0.03, (o.cowl + o.rf) / 2 + 0.035, hw * 1.66, (yt - belt) * 0.62, 0.06, { oz: (o.rf - o.cowl) * 0.62, tx: 0.95 });
    for (const sx of [-1, 1]) G.box(sx * (hw * 0.955), (belt + yt) / 2 + 0.08, o.rf - 0.7, 0.04, (yt - belt) * 0.5, 0.95);
    G.box(0, (belt + yt) / 2 + 0.1, zr + 0.03, hw * 1.2, (yt - belt) * 0.45, 0.04);
    Tm.color(DARK); for (const sx of [-1, 1]) { Tm.box(sx * hw * 0.975, (belt + yt) / 2 - 0.05, -0.4, 0.02, (yt - belt) * 0.9, 0.03); Tm.box(sx * hw * 0.975, (belt + yt) / 2 - 0.05, -1.5, 0.02, (yt - belt) * 0.9, 0.03); }
  } else {
    const gh = [[o.cowl, belt, 0.93], [o.rf, rh, tb], [o.rr, rh, tb], [o.pickup ? o.rr - 0.03 : o.deck, belt, 0.93]];
    extrude(G, gh, hw);
    extrude(P, [[o.rf + 0.06, rh - 0.01, tb + 0.01], [o.rf - 0.03, yt, tb - 0.02], [o.rr + 0.03, yt, tb - 0.02], [o.rr - 0.06, rh - 0.01, tb + 0.01]], hw);
    // ustunlar
    for (const sx of [-1, 1]) {
      limb(P, [sx * hw * 0.935, belt, o.cowl - 0.01], [sx * hw * tb, rh, o.rf], 0.07, 0.07);
      limb(P, [sx * hw * 0.935, belt, (o.pickup ? o.rr - 0.03 : o.deck) + 0.01], [sx * hw * tb, rh, o.rr], 0.08, 0.08);
      const bz = o.bp != null ? o.bp : (o.rf + o.rr) / 2; limb(P, [sx * hw * 0.94, belt, bz], [sx * hw * (tb + 0.005), rh, bz], 0.03, 0.09);
      if (o.limo) for (const q of [0.25, 0.5, 0.75]) { const z2 = o.rr + (o.rf - o.rr) * q; limb(P, [sx * hw * 0.94, belt, z2], [sx * hw * (tb + 0.005), rh, z2], 0.03, 0.12); }
    }
  }
  // pikap kuzovi
  if (o.pickup) { const by = belt - 0.34; for (const sx of [-1, 1]) P.box(sx * (hw * 0.97 - 0.05), by + 0.19, (o.rr + zr) / 2, 0.09, 0.4, o.rr - zr - 0.16); P.box(0, by + 0.19, zr + 0.11, hw * 1.9, 0.4, 0.09); Tm.color(0x33353c).box(0, by + 0.015, (o.rr + zr) / 2, hw * 1.76, 0.03, o.rr - zr - 0.2); }
  // g'ildirak arkalari, ostona, bamperlar
  if (!o.lift) { Tm.color(0x18191d); for (const [z, r] of [[s.wzF, s.rF], [-s.wzR, s.rR]]) { Tm.push().translate(0, r - s.com, z); Tm.prismX(12, r + 0.07, hw * 1.8 + 0.03); Tm.pop(); } }
  if (o.fender) { P.color(0xffffff); for (const sx of [-1, 1]) for (const [z, r] of [[s.wzF, s.rF], [-s.wzR, s.rR]]) P.box(sx * (hw * 0.9 + o.fender * 0.5 + 0.02), r - s.com + r + 0.1, z, o.fender + 0.1, 0.09, r * 2.5, { tz: 0.7 }); }
  Tm.color(DARK); for (const sx of [-1, 1]) Tm.box(sx * (hw * 0.91), yb + 0.13, (s.wzF - s.wzR) / 2, 0.1, 0.1, s.wzF + s.wzR - (s.rF + s.rR) - 0.3);
  const bF = B.P(1), bR = B.P(2), bc = o.bumpC || DARK;
  bF.color(bc).box(0, yb + bh * 0.62, zf + 0.06, hw * 1.86, bh, 0.16, { tx: 0.96 }); bR.color(bc).box(0, yb + bh * 0.7, zr - 0.05, hw * 1.86, bh, 0.15, { tx: 0.96 });
  if (o.bull) { bF.color(STEEL); for (const sx of [-1, 1]) bF.box(sx * hw * 0.48, yb + bh + 0.1, zf + 0.17, 0.06, 0.5, 0.06); bF.box(0, yb + bh + 0.32, zf + 0.17, hw * 1.1, 0.06, 0.06); }
  if (o.splitter) { bF.color(0x15161a).box(0, yb + 0.07, zf + 0.12, hw * 1.9, 0.04, 0.3); }
  B.parts.bumpF = [bF, 'front', 52]; B.parts.bumpR = [bR, 'rear', 48];
  Tm.color(0x15161a).box(0, yb + bh * 1.25 + (hoodY - yb - bh * 1.3) * 0.42, zf + 0.012, hw * (o.grille || 1.0), (hoodY - yb - bh * 1.3) * 0.52, 0.05);
  // chiroqlar
  const ly = yb + bh * 1.25 + (hoodY - yb - bh * 1.3) * 0.62; B.lampY = ly;
  for (const sx of [-1, 1]) { B.head.box(sx * hw * 0.68, ly, zf + 0.02, hw * (o.lampW || 0.34), o.lampH || 0.1, 0.06); B.tail.box(sx * hw * 0.7, (o.pickup ? belt - 0.2 : deckY - 0.14), zr - 0.03 + (o.pickup ? 0.05 : 0), hw * 0.36, o.tailH || 0.09, 0.05); }
  if (o.tailBar) B.tail.box(0, deckY - 0.14, zr - 0.03, hw * 1.5, 0.035, 0.05);
  // ko'zgular, tutqichlar
  for (const sx of [-1, 1]) { const q = B.P(sx > 0 ? 3 : 4); q.color(DARK).box(sx * (hw * 0.97 + 0.08), belt + 0.07, o.cowl - 0.12, 0.2, 0.05, 0.05); q.color(0xffffff); q.box(sx * (hw * 0.97 + 0.17), belt + 0.1, o.cowl - 0.12, 0.06, 0.13, 0.13); B.parts[sx > 0 ? 'mirL' : 'mirR'] = [q, sx > 0 ? 'left' : 'right', 62, true]; }
  Tm.color(STEEL); for (const sx of [-1, 1]) Tm.box(sx * (hw * 0.972), belt - 0.1, ((o.rf + o.rr) / 2) + 0.3, 0.02, 0.035, 0.14);
  // qo'shimchalar
  const ex = B.P(5);
  if (o.spoiler) { ex.color(o.spoiler === 2 ? 0x15161a : 0xffffff); const sy = o.spoiler === 2 ? deckY + 0.32 : deckY + 0.14; for (const sx of [-1, 1]) ex.box(sx * hw * 0.62, (deckY + sy) / 2, zr + 0.24, 0.05, sy - deckY, 0.16); ex.box(0, sy, zr + 0.2, hw * 1.84, 0.045, 0.36, { oz: -0.04 }); for (const sx of [-1, 1]) ex.box(sx * hw * 0.92, sy + 0.04, zr + 0.2, 0.03, 0.14, 0.38); B.parts.extra = [ex, 'rear', 34, o.spoiler !== 2]; }
  if (o.scoop) { P.box(0, hoodY + 0.05, (zf + o.cowl) / 2 - 0.05, hw * 0.5, 0.11, (zf - o.cowl) * 0.5, { tz: 0.8, tx: 0.9 }); Tm.color(0x15161a).box(0, hoodY + 0.05, (zf + o.cowl) / 2 - 0.05 + (zf - o.cowl) * 0.25, hw * 0.4, 0.07, 0.03); }
  if (o.roofScoop) { P.box(0, yt + 0.05, o.rf - 0.25, hw * 0.4, 0.1, 0.5, { tz: 0.7 }); }
  if (o.lightBar) { Tm.color(DARK).box(0, yt + 0.05, o.rf - 0.1, hw * 1.2, 0.05, 0.08); for (const x of [-0.42, -0.14, 0.14, 0.42]) B.head.box(x * hw * 1.2, yt + 0.12, o.rf - 0.08, 0.18, 0.11, 0.07); }
  if (o.stripe) { Tm.color(o.stripe); Tm.box(0, hoodY + 0.004, (zf + o.cowl) / 2 - 0.1, hw * 0.34, 0.012, zf - o.cowl - 0.25); Tm.box(0, yt + 0.006, (o.rf + o.rr) / 2, hw * 0.34, 0.012, o.rf - o.rr - 0.1); }
  if (o.mud) { Tm.color(0x8a1f1a); for (const sx of [-1, 1]) for (const z of [s.wzF - s.rF - 0.1, -s.wzR - s.rR - 0.1]) Tm.box(sx * hw * 0.9, yb + 0.02, z, 0.24, 0.26, 0.03); }
  if (o.exhaust) { Tm.color(STEEL); for (const sx of [-1, 1]) { Tm.push().translate(sx * hw * 0.5, yb + 0.13, zr - 0.08); Tm.prismZ(6, 0.05, 0.16); Tm.pop(); } }
  if (o.wing) { ex.color(0x15161a); for (const sx of [-1, 1]) ex.box(sx * hw * 0.5, deckY + 0.2, zr + 0.3, 0.05, 0.4, 0.2); ex.box(0, deckY + 0.42, zr + 0.26, hw * 2.0, 0.05, 0.42); for (const sx of [-1, 1]) ex.box(sx * hw * 1.0, deckY + 0.44, zr + 0.26, 0.03, 0.2, 0.46); B.parts.extra = [ex, 'rear', 34]; }
  if (o.vents) { Tm.color(0x15161a); for (const sx of [-1, 1]) Tm.box(sx * hw * 0.985, yb + 0.36, -s.wzR + s.rR + 0.45, 0.03, 0.22, 0.4); }
  if (o.antenna) { Tm.color(DARK).box(hw * 0.7, yt + 0.3, o.rr + 0.2, 0.02, 0.7, 0.02); }
  if (o.lift) { // monster-trak: rama va amortizatorlar
    Tm.color(0x33353c).box(0, yb - 0.25, 0, s.wid * 0.34, 0.2, s.len * 0.8); Tm.color(STEEL);
    for (const sx of [-1, 1]) for (const z of [s.wzF, -s.wzR]) { limb(Tm, [sx * s.wid * 0.17, yb - 0.2, z * 0.8], [sx * (s.wx - 0.3), s.rF - s.com + 0.1, z], 0.1); Tm.color(0xf0b83a); limb(Tm, [sx * s.wid * 0.2, yb + 0.1, z * 0.86], [sx * (s.wx - 0.36), s.rF - s.com + 0.25, z], 0.13); Tm.color(STEEL); }
  }
  std4(B, s, o.ww || s.rF * 0.62, { tread: o.tread, rim: o.rim });
  if (o.spare) { const sp = B.P(7); sp.color(TYRE); sp.push().translate(0, belt - 0.02, zr - 0.13); sp.prismZ(10, s.rR * 0.92, 0.22); sp.pop(); sp.color(STEEL); sp.push().translate(0, belt - 0.02, zr - 0.25); sp.prismZ(8, s.rR * 0.5, 0.04); sp.pop(); B.parts.spare = [sp, 'rear', 30]; }
  return assemble(v, B);
}

// ---------- yuk mashinasi / o't o'chirish / avtobus ----------
function genTruck(v, o) {
  const s = v.spec, B = newB(v.id.length * 17), P = B.paint, Tm = B.trim, G = B.glass;
  const hl = s.len / 2, hw = s.wid / 2, yb = s.clr - s.com, yt = s.hgt - s.com, zf = hl - 0.08, zr = -hl + 0.08;
  if (o.bus) {
    const belt = yb + 1.15;
    extrude(P, [[zr, yb + 0.1, 0.96], [zf, yb + 0.1, 0.96], [zf + 0.03, yb + 0.5, 0.96], [zf, belt, 0.98], [zr, belt, 0.98]], hw);
    extrude(P, [[zf - 0.02, belt, 0.98], [zf - 0.22, yt - 0.06, 0.93], [zf - 0.5, yt, 0.9], [zr + 0.3, yt, 0.9], [zr, yt - 0.25, 0.93], [zr, belt, 0.98]], hw);
    G.box(0, (belt + yt) / 2 + 0.02, zf - 0.105, hw * 1.74, (yt - belt) * 0.66, 0.05, { oz: -0.13, tx: 0.96 }); G.box(0, (belt + yt) / 2 + 0.1, zr - 0.01, hw * 1.5, (yt - belt) * 0.42, 0.04);
    const n = 8; for (const sx of [-1, 1]) for (let i = 0; i < n; i++) { const z = zf - 1.35 - i * ((s.len - 2.2) / n); G.box(sx * (hw * 0.955), (belt + yt) / 2 + 0.1, z, 0.04, (yt - belt) * 0.5, (s.len - 2.2) / n - 0.14); }
    Tm.color(0x33353c); Tm.box(-hw * 0.975, (yb + yt) / 2 - 0.25, zf - 0.75, 0.03, yt - yb - 0.9, 0.85); Tm.box(-hw * 0.975, (yb + yt) / 2 - 0.25, -0.6, 0.03, yt - yb - 0.9, 0.85);
    Tm.color(0xf2f2ee).box(0, belt - 0.08, 0, hw * 1.98, 0.14, s.len - 0.5);
    Tm.color(DARK).box(0, yt + 0.09, -1, hw * 0.9, 0.18, 2.2, { tz: 0.9, tx: 0.9 });
  } else {
    const cabL = o.cabL || 2.1, cz = zf - cabL, belt = yb + 1.2, cabT = yb + (o.cabH || 2.3);
    Tm.color(0x33353c).box(0, yb + 0.14, -0.2, hw * 1.0, 0.26, s.len - 0.7); // rama
    extrude(P, [[cz, yb + 0.12, 0.97], [zf, yb + 0.12, 0.97], [zf + 0.04, yb + 0.7, 0.97], [zf + 0.02, belt, 0.97], [zf - 0.16, cabT - 0.1, 0.93], [zf - 0.4, cabT, 0.9], [cz + 0.04, cabT, 0.9], [cz, belt, 0.97]], hw);
    G.box(0, (belt + cabT) / 2, zf - 0.07, hw * 1.72, (cabT - belt) * 0.7, 0.05, { oz: -0.12, tx: 0.96 }); for (const sx of [-1, 1]) G.box(sx * (hw * 0.945), (belt + cabT) / 2 + 0.02, zf - cabL * 0.52, 0.04, (cabT - belt) * 0.62, cabL * 0.5);
    Tm.color(0x15161a).box(0, yb + 0.86, zf + 0.03, hw * 1.2, 0.5, 0.05);
    const cg = zr + 0.05, cl = cz - 0.2 - cg, cy0 = yb + 0.3;
    if (o.fire) {
      P.box(0, cy0 + 0.85, cg + cl / 2, hw * 1.96, 1.7, cl); Tm.color(STEEL); for (const sx of [-1, 1]) for (let i = 0; i < 3; i++) Tm.box(sx * hw * 0.985, cy0 + 0.8, cg + cl * (0.2 + i * 0.3), 0.03, 1.2, cl * 0.24);
      Tm.color(0xc8ccd4); const ly = cy0 + 1.95; for (const sx of [-1, 1]) limb(Tm, [sx * 0.34, ly, cg + 0.3], [sx * 0.34, ly + 0.25, cz + 0.6], 0.07); for (let i = 0; i < 12; i++) { const t = i / 11; Tm.box(0, ly + 0.25 * t, cg + 0.3 + (cz + 0.3 - cg) * t, 0.68, 0.04, 0.04); }
      Tm.color(0x2f7fd0).box(0, cabT + 0.08, zf - 0.7, hw * 1.1, 0.14, 0.3); B.head.box(-hw * 0.4, cabT + 0.1, zf - 0.7, 0.3, 0.16, 0.32); B.tail.box(hw * 0.4, cabT + 0.1, zf - 0.7, 0.3, 0.16, 0.32);
      Tm.color(0xf2f2ee).box(0, cy0 + 0.25, cg + cl / 2, hw * 1.98, 0.16, cl + 0.02); Tm.color(0x33353c); Tm.push().translate(hw * 0.7, cy0 + 1.75, cg + cl * 0.5); Tm.prismZ(8, 0.16, cl * 0.8); Tm.pop();
    } else {
      Tm.color(0xc9a070).box(0, cy0 + 0.06, cg + cl / 2, hw * 1.96, 0.12, cl); const cb = B.P(8); cb.color(0xe9e3d2);
      cb.box(0, cy0 + 1.05, cg + cl / 2, hw * 1.94, 1.9, cl - 0.06); cb.color(0xc4bda8); for (let i = 0; i <= 4; i++) for (const sx of [-1, 1]) cb.box(sx * hw * 0.975, cy0 + 1.05, cg + 0.1 + (cl - 0.2) * i / 4, 0.03, 1.9, 0.07); cb.color(v.hex).box(0, cy0 + 1.3, cg + cl / 2, hw * 1.96, 0.3, cl * 0.6);
      B.parts.cargo = [cb, 'top', 14];
    }
    Tm.color(STEEL); Tm.push().translate(hw * 0.85, cabT - 0.2, cz - 0.1); Tm.cyl(6, 0.07, 0.07, -1.0, 0.5); Tm.pop();
  }
  const bF = B.P(1), bR = B.P(2); bF.color(GREY).box(0, yb + 0.3, zf + 0.08, hw * 1.96, 0.36, 0.18); bR.color(GREY).box(0, yb + 0.3, zr - 0.06, hw * 1.9, 0.26, 0.14); B.parts.bumpF = [bF, 'front', 50]; B.parts.bumpR = [bR, 'rear', 45];
  for (const sx of [-1, 1]) { const q = B.P(sx > 0 ? 3 : 4); q.color(DARK); q.box(sx * (hw + 0.14), yb + 1.6, zf - 0.3, 0.3, 0.05, 0.05); q.box(sx * (hw + 0.28), yb + 1.55, zf - 0.3, 0.07, 0.42, 0.2); B.parts[sx > 0 ? 'mirL' : 'mirR'] = [q, sx > 0 ? 'left' : 'right', 60]; }
  B.lampY = yb + 0.55; for (const sx of [-1, 1]) { B.head.box(sx * hw * 0.72, yb + 0.55, zf + 0.04, hw * 0.3, 0.16, 0.06); B.tail.box(sx * hw * 0.78, yb + 0.5, zr - 0.02, hw * 0.24, 0.16, 0.05); }
  Tm.color(0x18191d); for (const z of [s.wzF, -s.wzR].concat(o.bus ? [] : [-s.wzR + s.rR * 2.25])) { Tm.push().translate(0, s.rF - s.com, z); Tm.prismX(12, s.rF + 0.09, s.wid * 0.96); Tm.pop(); }
  const wo = { tread: 14, rim: 0xb0b4bc }, ww = 0.34;
  B.wheels.push({ r: s.rF, w: ww, x: s.wx, z: s.wzF, src: [0], front: true, o: wo }, { r: s.rF, w: ww, x: -s.wx, z: s.wzF, src: [1], front: true, o: wo });
  B.wheels.push({ r: s.rR, w: ww * 1.5, x: s.wx - 0.06, z: -s.wzR, src: [2], o: wo }, { r: s.rR, w: ww * 1.5, x: -s.wx + 0.06, z: -s.wzR, src: [3], o: wo });
  if (!o.bus) B.wheels.push({ r: s.rR, w: ww * 1.5, x: s.wx - 0.06, z: -s.wzR + s.rR * 2.25, src: [2], o: wo }, { r: s.rR, w: ww * 1.5, x: -s.wx + 0.06, z: -s.wzR + s.rR * 2.25, src: [3], o: wo });
  return assemble(v, B);
}

// ---------- traktor ----------
function genTractor(v) {
  const s = v.spec, B = newB(91), P = B.paint, Tm = B.trim, G = B.glass, yb = s.clr - s.com, yt = s.hgt - s.com;
  P.box(0, yb + 0.55, 0.95, 0.86, 0.8, 1.9, { tx: 0.9 }); P.box(0, yb + 0.4, -0.5, 1.0, 0.6, 1.4); // kapot va tana
  Tm.color(0x15161a).box(0, yb + 0.55, 1.91, 0.7, 0.6, 0.04); Tm.color(0x33353c).box(0, yb + 0.1, 0.3, 0.6, 0.3, 3.0);
  for (const sx of [-1, 1]) { P.box(sx * 0.86, yb + 1.12, -s.wzR, 0.5, 0.1, 1.5, { tz: 0.7 }); P.box(sx * 0.63, yb + 0.85, -s.wzR, 0.06, 0.6, 1.3); } // qanotlar
  Tm.color(DARK); for (const [x, z] of [[-0.55, 0.0], [0.55, 0.0], [-0.6, -1.25], [0.6, -1.25]]) Tm.box(x, (yb + 1.0 + yt) / 2, z, 0.07, yt - yb - 1.0, 0.07);
  P.box(0, yt - 0.04, -0.62, 1.4, 0.09, 1.55); G.box(0, (yb + 1.2 + yt) / 2, 0.0, 1.06, yt - yb - 1.35, 0.03); G.box(0, (yb + 1.3 + yt) / 2, -1.25, 1.14, yt - yb - 1.5, 0.03);
  Tm.color(0x4a3a2a).box(0, yb + 0.95, -0.75, 0.5, 0.12, 0.5); Tm.box(0, yb + 1.25, -1.0, 0.5, 0.6, 0.1);
  Tm.color(STEEL); Tm.push().translate(0.3, yb + 0.9, 1.3); Tm.cyl(6, 0.05, 0.05, 0, 1.25); Tm.pop(); Tm.color(DARK); Tm.push().translate(0.3, yb + 2.15, 1.3); Tm.cyl(6, 0.075, 0.075, 0, 0.12); Tm.pop();
  Tm.color(DARK); Tm.push().translate(0, yb + 1.25, -0.15).rotX(-0.9); Tm.cyl(5, 0.03, 0.03, 0, 0.5); Tm.pop(); Tm.push().translate(0, yb + 1.56, 0.22).rotX(0.7); Tm.prism(8, 0.2, 0.2, 0, 0.04); Tm.pop();
  for (const sx of [-1, 1]) { B.head.box(sx * 0.26, yb + 0.75, 1.93, 0.16, 0.14, 0.05); B.tail.box(sx * 0.86, yb + 1.0, -s.wzR - 0.76, 0.2, 0.12, 0.04); B.head.box(sx * 0.5, yt + 0.08, 0.1, 0.16, 0.12, 0.1); }
  B.lampY = yb + 0.75; const bF = B.P(1); bF.color(GREY).box(0, yb + 0.25, 2.0, 0.9, 0.3, 0.2); bF.color(0x33353c); for (let i = 0; i < 4; i++) bF.box(0, yb + 0.25, 2.14 + i * 0.07, 0.7, 0.26, 0.05); B.parts.bumpF = [bF, 'front', 45];
  const wo = { tread: 16, rim: 0xf0b83a, spoke: 0xc8962a };
  B.wheels.push({ r: s.rF, w: 0.3, x: s.wx - 0.1, z: s.wzF, src: [0], front: true, o: wo }, { r: s.rF, w: 0.3, x: -s.wx + 0.1, z: s.wzF, src: [1], front: true, o: wo }, { r: s.rR, w: 0.52, x: s.wx, z: -s.wzR, src: [2], o: wo }, { r: s.rR, w: 0.52, x: -s.wx, z: -s.wzR, src: [3], o: wo });
  B.rider = { hip: [0, yb + 1.08, -0.78], lean: 0.05, hand: [0.2, yb + 1.55, 0.02], foot: [0.2, yb + 0.66, -0.2], knee: 0.16, shirt: 0xb84a34 };
  const m = assemble(v, B); m.open = false; m.riderAlways = true; return m;
}

// ---------- ochiq transportlar: karting, kvadrotsikl, bagi, bolid ----------
function genOpen(v) {
  const s = v.spec, id = v.id, B = newB(id.length * 23 + 5), P = B.paint, Tm = B.trim, yb = s.clr - s.com, hl = s.len / 2, hw = s.wid / 2;
  const axF = s.rF - s.com, axR = s.rR - s.com;
  if (id === 'kart') {
    Tm.color(0x33353c).box(0, yb + 0.03, 0, 0.7, 0.05, 1.7); Tm.box(0, yb + 0.05, s.wzF, 1.0, 0.05, 0.08); Tm.box(0, yb + 0.05, -s.wzR, 1.0, 0.06, 0.08);
    P.box(0, yb + 0.12, hl - 0.16, 0.9, 0.12, 0.3, { tz: 0.6 }); for (const sx of [-1, 1]) P.box(sx * 0.5, yb + 0.14, 0, 0.2, 0.14, 0.82, { tz: 0.8 }); P.box(0, yb + 0.3, 0.45, 0.3, 0.3, 0.1, { oz: -0.1 });
    Tm.color(0x15161a).box(0, yb + 0.22, -0.32, 0.42, 0.34, 0.1, { oz: -0.08 }); Tm.box(0, yb + 0.08, -0.14, 0.42, 0.06, 0.36); Tm.color(GREY).box(0.28, yb + 0.2, -0.62, 0.3, 0.26, 0.3);
    Tm.color(DARK); Tm.push().translate(0, yb + 0.5, 0.36).rotX(1.0); Tm.prism(8, 0.14, 0.14, 0, 0.03); Tm.pop(); limb(Tm, [0, yb + 0.1, 0.6], [0, yb + 0.5, 0.36], 0.03);
    const bF = B.P(1); bF.color(DARK).box(0, yb + 0.08, hl, 1.1, 0.08, 0.07); B.parts.bumpF = [bF, 'front', 50]; const bR = B.P(2); bR.color(DARK).box(0, yb + 0.1, -hl, 1.0, 0.1, 0.06); B.parts.bumpR = [bR, 'rear', 46];
    B.tail.box(0, yb + 0.2, -hl - 0.02, 0.14, 0.05, 0.03); B.lampY = yb + 0.15;
    std4(B, s, 0.15, { rim: 0xf0b83a }); B.rider = { hip: [0, yb + 0.14, -0.24], lean: -0.22, hand: [0.14, yb + 0.5, 0.33], foot: [0.2, yb + 0.14, 0.62], knee: 0.22, helmet: 0xf2f2ee, shirt: 0xe2572f };
  } else if (id === 'kvadro') {
    P.box(0, yb + 0.36, 0.1, 0.5, 0.36, 1.3, { tx: 0.8, tz: 0.9 }); for (const sx of [-1, 1]) for (const [z, ax] of [[s.wzF, axF], [-s.wzR, axR]]) P.box(sx * 0.5, ax + s.rF + 0.09, z, 0.36, 0.07, 0.72, { tz: 0.6 });
    Tm.color(0x15161a).box(0, yb + 0.6, -0.3, 0.4, 0.14, 0.72, { tx: 0.8 }); Tm.color(0x33353c).box(0, yb + 0.1, 0, 0.5, 0.2, 1.5); Tm.color(STEEL).box(0, yb + 0.55, -0.85, 0.7, 0.03, 0.4); Tm.box(0, yb + 0.5, 0.86, 0.6, 0.03, 0.3);
    for (const sx of [-1, 1]) for (const [z, ax] of [[s.wzF, axF], [-s.wzR, axR]]) limb(Tm, [sx * 0.2, yb + 0.2, z], [sx * (s.wx - 0.1), ax, z], 0.06);
    Tm.color(DARK); limb(Tm, [0, yb + 0.5, 0.45], [0, yb + 0.86, 0.3], 0.05); Tm.box(0, yb + 0.88, 0.3, 0.74, 0.04, 0.04);
    B.head.box(0, yb + 0.56, 0.78, 0.3, 0.1, 0.05); B.tail.box(0, yb + 0.52, -1.0, 0.3, 0.06, 0.04); B.lampY = yb + 0.56;
    const bF = B.P(1); bF.color(STEEL); bF.box(0, yb + 0.3, hl - 0.02, 0.6, 0.04, 0.04); for (const sx of [-1, 1]) bF.box(sx * 0.28, yb + 0.22, hl - 0.02, 0.04, 0.2, 0.04); B.parts.bumpF = [bF, 'front', 50];
    std4(B, s, 0.26, { tread: 12, rim: 0x33353c }); B.rider = { hip: [0, yb + 0.7, -0.28], lean: 0.3, hand: [0.34, yb + 0.9, 0.3], foot: [0.3, yb + 0.22, 0.05], knee: 0.2, helmet: 0x3f9a58, shirt: 0x2a2c33 };
  } else if (id === 'bagi') {
    Tm.color(0x33353c).box(0, yb + 0.06, 0, 1.1, 0.1, 2.5); P.box(0, yb + 0.26, 0.95, 0.9, 0.3, 0.9, { tx: 0.7, tz: 0.8, oz: 0.08 }); P.box(0, yb + 0.2, -0.1, 1.2, 0.26, 1.3); P.box(0, yb + 0.4, -1.1, 1.0, 0.5, 0.7, { tx: 0.8 });
    Tm.color(GREY).box(0, yb + 0.75, -1.15, 0.6, 0.3, 0.5); Tm.color(STEEL); for (const sx of [-1, 1]) { Tm.push().translate(sx * 0.2, yb + 0.9, -1.35).rotX(-0.5); Tm.cyl(5, 0.04, 0.05, 0, 0.5); Tm.pop(); }
    P.color(0xffffff); const T2 = 0.055, top = s.hgt - s.com - 0.03; // karkas
    for (const sx of [-1, 1]) { limb(P, [sx * 0.56, yb + 0.3, 0.5], [sx * 0.5, top, 0.05], T2); limb(P, [sx * 0.5, top, 0.05], [sx * 0.5, top, -0.75], T2); limb(P, [sx * 0.5, top, -0.75], [sx * 0.56, yb + 0.3, -1.35], T2); limb(P, [sx * 0.5, top, -0.75], [sx * 0.56, yb + 0.3, -0.7], T2); }
    limb(P, [-0.5, top, 0.05], [0.5, top, 0.05], T2); limb(P, [-0.5, top, -0.75], [0.5, top, -0.75], T2); limb(P, [-0.5, top, 0.05], [0.5, top, -0.75], T2 * 0.8);
    Tm.color(0x15161a).box(0, yb + 0.5, -0.5, 0.5, 0.6, 0.12, { oz: -0.1 }); Tm.box(0, yb + 0.25, -0.3, 0.5, 0.1, 0.42);
    Tm.color(STEEL); for (const sx of [-1, 1]) { limb(Tm, [sx * 0.4, yb + 0.15, s.wzF], [sx * (s.wx - 0.12), axF, s.wzF], 0.05); limb(Tm, [sx * 0.4, yb + 0.5, s.wzF - 0.1], [sx * (s.wx - 0.16), axF + 0.05, s.wzF], 0.07); limb(Tm, [sx * 0.45, yb + 0.2, -s.wzR], [sx * (s.wx - 0.14), axR, -s.wzR], 0.07); Tm.color(0xe2572f); limb(Tm, [sx * 0.42, yb + 0.7, -s.wzR + 0.1], [sx * (s.wx - 0.18), axR + 0.05, -s.wzR], 0.08); Tm.color(STEEL); }
    for (const sx of [-1, 1]) B.head.box(sx * 0.26, yb + 0.44, 1.38, 0.16, 0.12, 0.05); for (const x of [-0.3, -0.1, 0.1, 0.3]) B.head.box(x, top + 0.09, 0.05, 0.15, 0.1, 0.06); B.tail.box(0, yb + 0.5, -1.47, 0.6, 0.06, 0.04); B.lampY = yb + 0.44;
    const bF = B.P(1); bF.color(STEEL); bF.box(0, yb + 0.2, hl - 0.05, 0.9, 0.05, 0.05); bF.box(0, yb + 0.02, hl - 0.05, 0.9, 0.05, 0.05); B.parts.bumpF = [bF, 'front', 50];
    const sp = B.P(7); sp.color(TYRE); sp.push().translate(0, yb + 0.95, -1.5).rotX(0.3); sp.prismZ(10, 0.36, 0.2); sp.pop(); B.parts.spare = [sp, 'rear', 32];
    B.wheels.push({ r: s.rF, w: 0.2, x: s.wx, z: s.wzF, src: [0], front: true, o: { tread: 10, rim: 0x33353c } }, { r: s.rF, w: 0.2, x: -s.wx, z: s.wzF, src: [1], front: true, o: { tread: 10, rim: 0x33353c } }, { r: s.rR, w: 0.34, x: s.wx, z: -s.wzR, src: [2], o: { tread: 12, rim: 0x33353c } }, { r: s.rR, w: 0.34, x: -s.wx, z: -s.wzR, src: [3], o: { tread: 12, rim: 0x33353c } });
    B.rider = { hip: [0, yb + 0.34, -0.36], lean: -0.14, hand: [0.17, yb + 0.72, 0.28], foot: [0.18, yb + 0.22, 0.7], knee: 0.18, helmet: 0xf0b83a, shirt: 0x2f7fd0 };
  } else { // bolid
    const dk = 0x15161a;
    extrude(P, [[-1.9, yb + 0.04, 0.5], [0.9, yb + 0.04, 0.55], [hl - 0.25, yb + 0.1, 0.16], [hl - 0.25, yb + 0.2, 0.14], [0.9, yb + 0.42, 0.42], [0.2, yb + 0.5, 0.5], [-0.5, yb + 0.62, 0.42], [-1.5, yb + 0.5, 0.3], [-1.9, yb + 0.3, 0.24]], 0.52);
    for (const sx of [-1, 1]) P.box(sx * 0.62, yb + 0.22, -0.55, 0.42, 0.3, 1.5, { tz: 0.7, tx: 0.8, ox: -sx * 0.04 }); // yon pontonlar
    Tm.color(dk); for (const sx of [-1, 1]) Tm.box(sx * 0.63, yb + 0.25, 0.2, 0.3, 0.2, 0.04);
    Tm.color(dk).box(0, yb + 0.02, -0.2, 1.5, 0.03, 3.2); // tag
    P.box(0, yb + 0.86, -0.72, 0.14, 0.34, 0.5, { tz: 0.5 }); Tm.color(dk).box(0, yb + 0.78, -0.55, 0.2, 0.12, 0.06); // havo olgich
    Tm.color(dk); limb(Tm, [-0.2, yb + 0.5, 0.25], [0, yb + 0.72, 0.0], 0.04); limb(Tm, [0.2, yb + 0.5, 0.25], [0, yb + 0.72, 0.0], 0.04); // "halo"
    const fw = B.P(1); fw.color(dk); fw.box(0, yb + 0.03, hl - 0.12, 1.84, 0.035, 0.42); fw.color(0xffffff); for (const sx of [-1, 1]) { fw.box(sx * 0.9, yb + 0.12, hl - 0.12, 0.03, 0.2, 0.46); fw.box(sx * 0.6, yb + 0.1, hl - 0.2, 0.55, 0.03, 0.22); } B.parts.bumpF = [fw, 'front', 60, true];
    const rw = B.P(2); rw.color(dk); for (const sx of [-1, 1]) rw.box(sx * 0.46, yb + 0.62, -2.2, 0.03, 0.5, 0.42); rw.color(0xffffff); rw.box(0, yb + 0.86, -2.2, 0.98, 0.04, 0.4); rw.box(0, yb + 0.7, -2.26, 0.98, 0.03, 0.26); rw.color(dk); limb(rw, [0, yb + 0.3, -1.9], [0, yb + 0.6, -2.2], 0.06); B.parts.bumpR = [rw, 'rear', 55, true];
    Tm.color(STEEL); for (const sx of [-1, 1]) { for (const dz of [-0.16, 0.16]) { limb(Tm, [sx * 0.2, yb + 0.26, s.wzF + dz], [sx * (s.wx - 0.14), axF, s.wzF], 0.03); limb(Tm, [sx * 0.3, yb + 0.3, -s.wzR + dz], [sx * (s.wx - 0.16), axR, -s.wzR], 0.035); } }
    B.tail.box(0, yb + 0.3, -1.93, 0.1, 0.14, 0.04); B.lampY = yb + 0.2;
    const wo = { rim: 0x202127, spoke: 0xf0b83a };
    B.wheels.push({ r: s.rF, w: 0.3, x: s.wx, z: s.wzF, src: [0], front: true, o: wo }, { r: s.rF, w: 0.3, x: -s.wx, z: s.wzF, src: [1], front: true, o: wo }, { r: s.rR, w: 0.4, x: s.wx - 0.03, z: -s.wzR, src: [2], o: wo }, { r: s.rR, w: 0.4, x: -s.wx + 0.03, z: -s.wzR, src: [3], o: wo });
    B.rider = { hip: [0, yb + 0.16, -0.28], lean: -0.5, hand: [0.12, yb + 0.5, 0.32], foot: [0.1, yb + 0.26, 1.0], knee: 0.08, helmet: 0xf0b83a, shirt: 0xd8392b };
  }
  return assemble(v, B);
}

// ---------- ikki g'ildirakli: velosiped, skuter, mototsikl ----------
function genBike(v) {
  const s = v.spec, id = v.id, B = newB(id.length * 29 + 3), P = B.paint, Tm = B.trim, yb = s.clr - s.com;
  const ax = s.rF - s.com, zF = s.wzF, zR = -s.wzR;
  const fork = (B.fork = new GB(71)); fork.jit = 0.02;
  if (id === 'velo') {
    const bbx = [0, ax - 0.05, 0.0], seat = [0, ax + 0.62, -0.22], head = [0, ax + 0.56, zF - 0.2];
    P.color(0xffffff); limb(P, bbx, seat, 0.045); limb(P, bbx, head, 0.05); limb(P, [0, seat[1] - 0.1, seat[2] + 0.02], head, 0.04);
    for (const sx of [-1, 1]) { limb(P, [sx * 0.05, bbx[1], bbx[2]], [sx * 0.06, ax, zR], 0.03); limb(P, [sx * 0.04, seat[1] - 0.12, seat[2]], [sx * 0.06, ax, zR], 0.025); }
    Tm.color(0x15161a).box(0, seat[1] + 0.04, seat[2] - 0.03, 0.14, 0.05, 0.28, { tz: 0.9 }); Tm.color(STEEL); limb(Tm, [0, seat[1] - 0.05, seat[2]], [0, seat[1] + 0.03, seat[2] - 0.02], 0.03);
    fork.color(STEEL); for (const sx of [-1, 1]) limb(fork, [sx * 0.05, ax, zF], [sx * 0.04, ax + 0.5, zF - 0.14], 0.028); limb(fork, [0, ax + 0.48, zF - 0.14], [0, ax + 0.74, zF - 0.22], 0.035);
    fork.color(0x15161a); fork.box(0, ax + 0.75, zF - 0.2, 0.56, 0.03, 0.03); for (const sx of [-1, 1]) fork.box(sx * 0.27, ax + 0.75, zF - 0.24, 0.035, 0.035, 0.11);
    fork.color(0xffffff); fork.box(0, ax + 0.56, zF - 0.08, 0.06, 0.06, 0.05);
    const cr = new GB(72); cr.jit = 0; cr.color(STEEL); cr.push().translate(0, bbx[1], bbx[2]); cr.prismX(10, 0.1, 0.02); cr.pop();
    for (const sx of [-1, 1]) { cr.color(STEEL); limb(cr, [sx * 0.07, bbx[1], bbx[2]], [sx * 0.07, bbx[1] + sx * 0.16, bbx[2]], 0.02); cr.color(0x15161a).box(sx * 0.12, bbx[1] + sx * 0.16, bbx[2], 0.09, 0.02, 0.07); }
    B.crank = { gb: cr, y: bbx[1], z: bbx[2] };
    B.tail.box(0, seat[1] - 0.1, seat[2] - 0.2, 0.04, 0.04, 0.02);
    const wo = { thin: 0.035, rim: 0xd8dce4, spokes: 10 };
    B.wheels.push({ r: s.rF, w: 0.04, x: 0, z: zF, src: [0, 1], o: wo }, { r: s.rR, w: 0.04, x: 0, z: zR, src: [2, 3], o: wo });
    B.rider = { hip: [0, seat[1] + 0.06, seat[2] - 0.02], lean: 0.5, hand: [0.26, ax + 0.78, zF - 0.24], foot: [0.12, bbx[1] - 0.02, bbx[2] + 0.02], knee: 0.2, shirt: 0xf0b83a, helmet: 0x2fb5b0 };
    B.lampY = ax + 0.56;
  } else if (id === 'skuter') {
    P.box(0, yb + 0.07, 0.05, 0.34, 0.07, 0.7); extrude(P, [[zF - 0.34, yb + 0.05], [zF - 0.2, yb + 0.1], [zF - 0.3, yb + 0.86], [zF - 0.4, yb + 0.86], [zF - 0.46, yb + 0.1]], 0.2);
    extrude(P, [[zR - 0.3, yb + 0.3, 0.7], [zR - 0.34, yb + 0.6, 0.6], [-0.1, yb + 0.6, 0.9], [-0.22, yb + 0.1, 1], [zR + 0.2, yb + 0.12, 1]], 0.2);
    Tm.color(0x4a3a2a).box(0, yb + 0.66, zR + 0.26, 0.3, 0.09, 0.66, { tz: 0.9, tx: 0.85 }); Tm.color(0x15161a).box(0, yb + 0.1, 0.05, 0.3, 0.02, 0.6);
    fork.color(STEEL); for (const sx of [-1, 1]) limb(fork, [sx * 0.07, ax, zF], [sx * 0.06, ax + 0.36, zF - 0.1], 0.04); fork.color(0xffffff); fork.box(0, ax + s.rF + 0.04, zF, 0.14, 0.04, 0.44, { tz: 0.6 });
    fork.color(DARK); limb(fork, [0, yb + 0.8, zF - 0.34], [0, yb + 1.0, zF - 0.4], 0.05); fork.box(0, yb + 1.02, zF - 0.4, 0.6, 0.04, 0.04); for (const sx of [-1, 1]) { fork.box(sx * 0.27, yb + 1.02, zF - 0.42, 0.04, 0.045, 0.1); limb(fork, [sx * 0.2, yb + 1.04, zF - 0.4], [sx * 0.3, yb + 1.2, zF - 0.42], 0.015); fork.box(sx * 0.3, yb + 1.22, zF - 0.42, 0.1, 0.07, 0.02); }
    B.head.box(0, yb + 0.92, zF - 0.27, 0.14, 0.1, 0.04); B.tail.box(0, yb + 0.5, zR - 0.33, 0.12, 0.06, 0.03); B.lampY = yb + 0.92;
    const wo = { thin: 0.07, rim: 0xd8dce4, solid: true };
    B.wheels.push({ r: s.rF, w: 0.1, x: 0, z: zF, src: [0, 1], o: wo }, { r: s.rR, w: 0.11, x: 0, z: zR, src: [2, 3], o: wo });
    B.rider = { hip: [0, yb + 0.74, zR + 0.38], lean: 0.08, hand: [0.26, yb + 1.04, zF - 0.42], foot: [0.1, yb + 0.14, 0.2], knee: 0.12, shirt: 0xf2f2ee, helmet: 0xf0b83a };
  } else { // mototsikl
    Tm.color(0x33353c).box(0, ax + 0.1, 0.02, 0.26, 0.36, 0.5); Tm.color(STEEL).box(0, ax + 0.12, 0.05, 0.3, 0.2, 0.3); for (const sx of [-1, 1]) { Tm.push().translate(sx * 0.14, ax - 0.02, -0.34); Tm.prismZ(6, 0.045, 0.75); Tm.pop(); }
    extrude(P, [[0.36, ax + 0.3, 0.8], [0.4, ax + 0.52, 0.7], [0.0, ax + 0.6, 1], [-0.22, ax + 0.48, 0.9], [-0.2, ax + 0.3, 0.8]], 0.15); // bak
    extrude(P, [[-0.2, ax + 0.34, 0.9], [-0.22, ax + 0.46, 0.9], [zR - 0.2, ax + 0.54, 0.5], [zR - 0.26, ax + 0.46, 0.4]], 0.13); // dum
    Tm.color(0x15161a).box(0, ax + 0.5, -0.42, 0.22, 0.06, 0.5, { tx: 0.8 });
    Tm.color(DARK); for (const sx of [-1, 1]) limb(Tm, [sx * 0.08, ax + 0.1, -0.2], [sx * 0.09, ax, zR], 0.05);
    fork.color(STEEL); for (const sx of [-1, 1]) limb(fork, [sx * 0.09, ax, zF], [sx * 0.08, ax + 0.62, zF - 0.26], 0.045);
    fork.color(0xffffff); fork.box(0, ax + s.rF + 0.03, zF, 0.13, 0.03, 0.4, { tz: 0.6 }); fork.box(0, ax + 0.56, zF - 0.17, 0.3, 0.26, 0.1, { tx: 0.7, oz: -0.05 });
    fork.color(GLASS).box(0, ax + 0.76, zF - 0.24, 0.24, 0.16, 0.02, { oz: -0.06, tx: 0.7 }); fork.color(DARK); fork.box(0, ax + 0.66, zF - 0.3, 0.6, 0.035, 0.035); for (const sx of [-1, 1]) fork.box(sx * 0.28, ax + 0.66, zF - 0.33, 0.04, 0.045, 0.1);
    B.head.box(0, ax + 0.58, zF - 0.1, 0.14, 0.1, 0.04); B.tail.box(0, ax + 0.5, zR - 0.26, 0.1, 0.05, 0.03); B.lampY = ax + 0.58;
    const wo = { thin: 0.085, rim: 0x33353c, spokes: 5 };
    B.wheels.push({ r: s.rF, w: 0.11, x: 0, z: zF, src: [0, 1], o: wo }, { r: s.rR, w: 0.15, x: 0, z: zR, src: [2, 3], o: wo });
    B.rider = { hip: [0, ax + 0.58, -0.36], lean: 0.6, hand: [0.27, ax + 0.68, zF - 0.33], foot: [0.16, ax + 0.02, -0.12], knee: 0.16, shirt: 0x2a2c33, helmet: 0xd8392b };
  }
  return assemble(v, B);
}

// Jip — asl model, umumiy interfeysga moslab
function genJeep(v) {
  const m = buildCarModel(), s = v.spec, tilt = new THREE.Group();
  m.paintMat = new THREE.MeshStandardMaterial({ vertexColors: true, color: v.hex, metalness: 0.42, roughness: 0.36 }); m.body.material = m.paintMat;
  while (m.root.children.length) tilt.add(m.root.children[0]);
  m.root.add(tilt); m.root.add(m.spot); m.root.add(m.spot.target);
  const thr = { bumpF: 52, bumpR: 48, spare: 30, luggage: 22, mirL: 62, mirR: 62 };
  for (const k in m.parts) { m.parts[k].thr = thr[k]; m.parts[k].home = m.parts[k].home.clone(); }
  m.wheels.forEach((w, i) => { w.src = [i]; w.x = i % 2 ? -s.wx : s.wx; w.z = i < 2 ? s.wzF : -s.wzR; w.front = i < 2; w.r = 0.42; });
  return Object.assign(m, { id: v.id, v, spec: s, tilt, deform: [m.body, m.trimMesh], rider: null, open: false, fork: null, crank: null, bike: false });
}

const STYLE = {
  xetch: { cowl: 0.95, rf: 0.45, rr: -1.2, deck: -1.62, belt: 0.72, hoodDrop: 0.1, deckDrop: 0.05, tumble: 0.86, bumpC: 0x33353c, lampW: 0.36, lampH: 0.12 },
  sedan: { cowl: 0.95, rf: 0.35, rr: -0.95, deck: -1.5, belt: 0.72, hoodDrop: 0.08, deckDrop: 0.03, tumble: 0.82, bumpC: 0xb9bec8, hoodPart: true, tailBar: true, exhaust: true },
  pikap: { cowl: 1.25, rf: 0.72, rr: -0.5, deck: -0.52, belt: 0.86, hoodDrop: 0.05, tumble: 0.88, pickup: true, bull: true, tread: 12, bumpC: 0x4a4d57, hoodPart: true, fender: 0.06, lampH: 0.14, grille: 1.1 },
  furgon: { cowl: 1.75, rf: 1.25, rr: -2.4, deck: -2.4, belt: 1.02, hoodDrop: 0.3, box: true, bumpC: 0x4a4d57, lampH: 0.14 },
  ralli: { cowl: 0.92, rf: 0.38, rr: -1.2, deck: -1.6, belt: 0.72, hoodDrop: 0.09, deckDrop: 0.04, tumble: 0.85, spoiler: 2, roofScoop: true, lightBar: true, mud: true, stripe: 0xf2f2ee, tread: 10, rim: 0xf2f2ee, hoodPart: true, scoop: true, bumpC: 0x202127, exhaust: true },
  kupe: { cowl: 0.82, rf: 0.2, rr: -0.75, deck: -1.55, belt: 0.64, hoodDrop: 0.14, deckDrop: 0.06, tumble: 0.8, spoiler: 1, splitter: true, bumpC: 0x202127, hoodPart: true, rim: 0x33353c, exhaust: true, lampH: 0.08, tailBar: true },
  muskul: { cowl: 0.7, rf: 0.05, rr: -0.95, deck: -1.95, belt: 0.68, hoodDrop: 0.05, deckDrop: 0.02, tumble: 0.8, scoop: true, stripe: 0xf2f2ee, spoiler: 1, hoodPart: true, bumpC: 0xb9bec8, rim: 0xb9bec8, exhaust: true, lampW: 0.3, grille: 1.3, tailBar: true },
  limuzin: { cowl: 2.25, rf: 1.65, rr: -2.25, deck: -2.8, belt: 0.74, hoodDrop: 0.07, deckDrop: 0.03, tumble: 0.82, limo: true, bumpC: 0xb9bec8, rim: 0xe0e4ea, hoodPart: true, tailBar: true, antenna: true },
  monstr: { cowl: 1.15, rf: 0.62, rr: -0.55, deck: -0.57, belt: 0.92, hoodDrop: 0.06, tumble: 0.86, pickup: true, lift: true, tread: 14, ww: 0.9, rim: 0xf0b83a, stripe: 0xf0b83a, hoodPart: true, bumpC: 0x33353c, lightBar: true, scoop: true, bump: 0.3 },
  super: { cowl: 0.95, rf: 0.2, rr: -0.5, deck: -1.6, belt: 0.6, hoodDrop: 0.18, deckDrop: 0.05, tumble: 0.74, wing: true, splitter: true, vents: true, bumpC: 0x15161a, rim: 0x202127, lampH: 0.06, lampW: 0.3, tailBar: true, exhaust: true, bump: 0.2, ww: 0.26 },
};

export function buildVehicle(id) {
  const v = vehById[id] || vehById.jip;
  let m;
  if (v.cls === 'jeep') m = genJeep(v);
  else if (v.cls === 'bike') m = genBike(v);
  else if (v.cls === 'open') m = genOpen(v);
  else if (v.cls === 'tractor') m = genTractor(v);
  else if (v.cls === 'truck') m = genTruck(v, v.id === 'otochar' ? { fire: true, cabL: 2.6, cabH: 2.45 } : {});
  else if (v.cls === 'bus') m = genTruck(v, { bus: true });
  else m = genCar(v, STYLE[v.id] || STYLE.sedan);
  m.paintMat.color.setHex(v.hex);
  return m;
}

// G'ildirak va rul holatini fizikadan modelga ko'chirish
export function syncWheels(m, car, flat) {
  const W = car.wheels;
  for (let i = 0; i < m.wheels.length; i++) {
    const o = m.wheels[i], a = W[o.src[0]]; let len = a.len, spin = a.spin, ly = a.ly;
    if (o.src.length > 1) { const b = W[o.src[1]]; len = (len + b.len) / 2; spin = (spin + b.spin) / 2; }
    const fl = flat && flat[o.src[0]];
    o.pivot.position.set(o.x, ly - len - (fl ? 0.06 * (o.r / 0.42) : 0), o.z);
    o.pivot.rotation.set(spin, o.front || (m.fork && i === 0) ? car.steer : 0, 0, 'YXZ');
    o.mesh.scale.y = o.mesh.scale.z = fl ? 0.86 : 1;
  }
  if (m.fork) m.fork.rotation.y = car.steer;
  if (m.crank) m.crank.rotation.x = W[2].spin * 0.42;
  if (m.bike) { const lean = Math.max(-0.6, Math.min(0.6, -car.steer * Math.abs(car.fwd) * Math.abs(car.fwd) * 0.11 / 9.81 * 2.2)); m.tilt.rotation.z += (lean - m.tilt.rotation.z) * 0.15; }
}
