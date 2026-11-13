// O'yinchining uyi: 5 daraja (chodir -> kulba -> hovli -> ikki qavatli uy -> villa), bezaklar, poliz, katak, pochta qutisi
import * as THREE from 'three';
import * as T from './terrain.js';
import { GB, MAT } from './geo.js';
import * as COL from './colliders.js';
import * as BK from './blocks.js';
import { glowMat, withMask, waterSurface } from './details.js';
const { PAL } = BK;

export const HOME_LEVELS = [
  { name: 'Chodir', cost: 0, desc: "Boshlanishi: chodir va gulxan. Uxlash mumkin.", inc: 0 },
  { name: "Yog'och kulba", cost: 2000, desc: "Issiq kulba, o'tinxona va kuchuk uyasi. Olapar ismli kuchuk keladi!", inc: 6 },
  { name: 'Hovli uy', cost: 6000, desc: "G'ishtli uy, to'siq, poliz (6 ta jo'yak), tovuq katagi va pochta qutisi.", inc: 16 },
  { name: 'Ikki qavatli uy', cost: 15000, desc: 'Balkonli katta uy, tosh devor, mashina uchun ayvon, chiroqlar.', inc: 40 },
  { name: 'Villa', cost: 35000, desc: "Hovuzli hashamatli villa, mehmonxona qanoti. Orolning eng zo'r uyi!", inc: 90 },
];
export const DECOR = [
  { id: 'gulzor', name: 'Gulzor', cost: 500, desc: 'Hovli atrofida rang-barang gullar' },
  { id: 'bayroq', name: 'Bayroq ustuni', cost: 400, desc: 'Hovlida baland bayroq' },
  { id: 'argimchoq', name: "Arg'imchoq", cost: 600, desc: "Yog'och arg'imchoq" },
  { id: 'chiroq', name: "Yo'lak chiroqlari", cost: 800, desc: "Tunda yo'lakni yoritadi" },
  { id: 'favvora', name: 'Favvora', cost: 1500, desc: "Hovli o'rtasida tosh favvora" },
];

export function buildHome(scene, site, P) {
  const nr = T.nearestRoad(P.x, P.z, 6), R = T.roads;
  const yaw = nr.edge >= 0 ? Math.atan2(R.x[nr.i] - P.x, R.z[nr.i] - P.z) : 0, c = Math.cos(yaw), s = Math.sin(yaw);
  const W = (lx, lz) => [P.x + lx * c + lz * s, P.z - lx * s + lz * c];
  const levels = [], lights = [], fires = []; site.fires = site.fires || [];
  const mkGB = (seed) => { const g = new GB(seed); g.jit = 0.035; g.translate(P.x, P.y, P.z).rotY(yaw); const gl = new GB(seed + 1); gl.jit = 0; gl.translate(P.x, P.y, P.z).rotY(yaw); return [g, gl]; };
  const at = (g, gl, lx, lz, a, fn) => { g.push().translate(lx, 0, lz).rotY(a); gl.push().translate(lx, 0, lz).rotY(a); fn(g, gl); g.pop(); gl.pop(); };
  const finish = (g, gl) => { const grp = new THREE.Group(); const m = new THREE.Mesh(g.build(), MAT.flat); m.castShadow = true; m.receiveShadow = true; grp.add(m); if (gl.count) grp.add(new THREE.Mesh(withMask(gl.build()), glowMat())); grp.visible = false; scene.add(grp); return grp; };
  // shu daraja/bezak qurilayotganda qo'shilgan mo'ri va chiroqlarni belgilash (faqat ko'rinayotgan daraja tutaydi)
  const tagLv = (c0, l0, lv) => { for (let i = c0; i < BK.CHIMNEYS.length; i++) BK.CHIMNEYS[i].lv = lv; for (let i = l0; i < BK.LAMPS.length; i++) BK.LAMPS[i].lv = lv; };
  const seg = (list, a, b, c2, d, h = 2.2, r = 0.25) => { const p1 = W(a, b), p2 = W(c2, d); const o = COL.addSeg(p1[0], p1[1], p2[0], p2[1], r, P.y - 2, P.y + h); o.dead = true; list.push(o); };
  const box = (list, lx, lz, hx, hz, h = 8) => { seg(list, lx - hx, lz - hz, lx + hx, lz - hz, h); seg(list, lx + hx, lz - hz, lx + hx, lz + hz, h); seg(list, lx + hx, lz + hz, lx - hx, lz + hz, h); seg(list, lx - hx, lz + hz, lx - hx, lz - hz, h); };
  const circ = (list, lx, lz, r, h = 4) => { const p = W(lx, lz); const o = COL.addCircle(p[0], p[1], r, P.y - 2, P.y + h); o.dead = true; list.push(o); };
  const light = (lv, lx, ly, lz, hex = 0xffd090, power = 1, decor) => { const p = W(lx, lz); const l = { x: p[0], y: P.y + ly, z: p[1], hex, power, on: false, lv, decor }; lights.push(l); site.lights.push(l); };
  const FX = 17, FZ = 15, GATE = 2.6;
  const fenceSegs = [[-FX, -FZ, FX, -FZ], [FX, -FZ, FX, FZ], [-FX, FZ, -FX, -FZ], [-FX, FZ, -GATE, FZ], [GATE, FZ, FX, FZ]];
  const BEDS = []; for (const bx of [-12.6, -8.6]) for (const bz of [3.2, 6.7, 10.2]) BEDS.push([bx, bz]);
  // hovli jihozlari (2-darajadan)
  const yard = (g, gl, cols, style, lv) => {
    for (const [a, b, c2, d] of fenceSegs) { BK.wall(g, a, b, c2, d, style === 'wood' ? 1.15 : 1.5, style, 0.45); seg(cols, a, b, c2, d, 1.6, 0.28); }
    at(g, gl, 0, FZ, 0, (q) => { q.color(style === 'wood' ? PAL.woodD : PAL.wall[1]); q.box(-GATE - 0.1, 1.3, 0, 0.5, 2.6, 0.5); q.box(GATE + 0.1, 1.3, 0, 0.5, 2.6, 0.5); q.color(PAL.roof[0]).box(0, 2.75, 0, GATE * 2 + 1.6, 0.22, 0.9); });
    for (const [bx, bz] of BEDS) { g.color(0x6a4a34).box(bx, 0.12, bz, 3.0, 0.24, 2.5); g.color(0x8a6a4a).box(bx, 0.2, bz, 2.7, 0.14, 2.2); }
    g.color(PAL.woodD); for (const [bx, bz] of [[-10.6, 1.3], [-10.6, 12.2]]) g.box(bx, 0.3, bz, 0.12, 0.6, 0.12);
    // tovuq katagi
    at(g, gl, 13, -12, -0.5, (q) => { q.color(PAL.wood).box(0, 0.9, 0, 2.4, 1.2, 2.0); q.color(PAL.roof[1]); q.push().rotY(Math.PI / 2); q.gable(2.0, 2.4, 0.7, 1.5, 0.25); q.pop(); q.color(0x2a2c33).box(0, 0.65, 1.01, 0.5, 0.6, 0.04); q.color(PAL.woodD); for (const sx of [-1, 1]) q.box(sx * 1.0, 0.15, 0.6, 0.1, 0.3, 0.1); q.color(PAL.woodL).box(0.2, 0.2, 1.5, 0.5, 0.06, 1.0); });
    box(cols, 13, -12, 1.25, 1.05, 2.4);
    // pochta qutisi
    at(g, gl, 3.5, FZ + 1.5, 0, (q) => { q.color(PAL.woodD).box(0, 0.6, 0, 0.1, 1.2, 0.1); q.color(0x2f7fd0).box(0, 1.3, 0, 0.34, 0.3, 0.5); q.color(PAL.red).box(0.19, 1.4, 0.1, 0.03, 0.22, 0.05); });
    circ(cols, 3.5, FZ + 1.5, 0.2, 1.6);
    // yo'lak toshlari
    g.color(PAL.stone); for (let i = 0; i < 9; i++) g.box((i % 2 ? 0.25 : -0.25), 0.05, 3.4 + i * 1.3, 1.1, 0.08, 0.9);
    BK.tree(g, -14.5, -1.5, 0.8, 0x5cab4a); BK.tree(g, 15, 12.5, 0.75, 0xf7a8c4); circ(cols, -14.5, -1.5, 0.3, 5); circ(cols, 15, 12.5, 0.3, 5);
  };
  const dogHouse = (g) => { g.push().translate(8.8, 0, 0.6).rotY(-0.4); g.color(PAL.wood).box(0, 0.45, 0, 1.2, 0.9, 1.4); g.color(PAL.roof[0]); g.gable(1.2, 1.4, 0.5, 0.9, 0.15); g.color(0x2a2c33).box(0, 0.36, 0.71, 0.5, 0.6, 0.03); g.pop(); };
  const parking = (g, gl, cols, roofed, lv = 0) => {
    g.color(0xb7a58a).box(9.5, 0.05, 21.5, 13, 0.08, 5.6);
    if (roofed) { g.color(PAL.woodD); for (const [x, z] of [[3.2, 19], [15.8, 19], [3.2, 24], [15.8, 24]]) { g.box(x, 2.3, z, 0.26, 4.6, 0.26); circ(cols, x, z, 0.2, 4.6); } g.color(PAL.roof[1]).box(9.5, 4.75, 21.5, 13.8, 0.22, 6.4); gl.color(PAL.lamp).box(9.5, 4.6, 21.5, 4, 0.06, 0.3); light(lv, 9.5, 4, 21.5, 0xfff0d0, 1.1); }
  };
  // --- 0: chodir ---
  { const [g, gl] = mkGB(701), cols = []; BK.tent(g, 0, -2, 0, 0xe2572f, 1.3); BK.campfire(g, 3.6, 2.6); BK.logPile(g, -4.2, 0.5, 0.5, 2); BK.bench(g, 3.6, 5.2, Math.PI);
    g.color(PAL.woodD).box(-3, 0.7, 6, 0.12, 1.4, 0.12); g.color(0xf2ead8).box(-3, 1.25, 6.07, 1.5, 0.6, 0.06);
    circ(cols, 0, -2, 1.7, 2.4); circ(cols, 3.6, 2.6, 0.7, 0.6); const f = W(3.6, 2.6); fires.push({ x: f[0], z: f[1], y: P.y, lv: 0, on: false }); light(0, 3.6, 1.2, 2.6, 0xff9a40, 1.6);
    parking(g, gl, cols, false); levels.push({ grp: finish(g, gl), cols }); }
  // --- 1: kulba ---
  { const [g, gl] = mkGB(711), cols = [];
    at(g, gl, 0, -3.2, 0, (q, ql) => { q.color(PAL.stone).box(0, 0.15, 0, 6.6, 0.3, 5.6); q.color(PAL.wood).box(0, 1.7, 0, 6, 2.8, 5); q.color(PAL.woodD); for (let i = 0; i < 5; i++) q.box(0, 0.6 + i * 0.56, 2.52, 6.06, 0.05, 0.04); q.color(PAL.woodD); q.push().rotY(Math.PI / 2); q.gable(5, 6, 1.9, 3.1, 0.55); q.pop();
      q.color(PAL.door[2]).box(0, 1.35, 2.54, 1.1, 2.1, 0.1); q.color(PAL.woodD).box(-1.9, 1.9, 2.53, 1.15, 1.2, 0.08); ql.mask(1.31).color(PAL.win).box(-1.9, 1.9, 2.56, 0.9, 0.95, 0.06); q.color(PAL.woodD).box(1.9, 1.9, 2.53, 1.15, 1.2, 0.08); ql.mask(1.77).color(PAL.win).box(1.9, 1.9, 2.56, 0.9, 0.95, 0.06); ql.mask(0);
      q.color(PAL.woodL).box(0, 0.22, 3.6, 4.4, 0.14, 2.0); q.color(PAL.woodD); q.box(-2.0, 1.4, 4.4, 0.16, 2.4, 0.16); q.box(2.0, 1.4, 4.4, 0.16, 2.4, 0.16); q.color(PAL.woodD).box(0, 2.7, 3.6, 4.8, 0.14, 2.4); q.color(PAL.stoneD).box(1.9, 4.2, -1.2, 0.8, 2.6, 0.8); });
    { const c = W(1.9, -4.4); BK.CHIMNEYS.push({ x: c[0], y: P.y + 5.6, z: c[1], ph: 31, lv: 1 }); }
    box(cols, 0, -3.2, 3.1, 2.6, 6); BK.logPile(g, -5.6, -3, 0, 3); circ(cols, -5.6, -3, 1.2, 1.4); BK.bench(g, 4.6, 2.2, -1.2); dogHouse(g); circ(cols, 8.8, 0.6, 0.8, 1.2);
    BK.tree(g, -9, 6, 0.9, 0x5cab4a); circ(cols, -9, 6, 0.3, 5); light(1, 0, 2.6, 0.2, 0xffd090, 1.1);
    parking(g, gl, cols, false); levels.push({ grp: finish(g, gl), cols }); }
  // --- 2..4: uylar ---
  const mkHouse = (lv, seed, o, hz, style) => {
    const [g, gl] = mkGB(seed), cols = []; let r; const c0 = BK.CHIMNEYS.length, l0 = BK.LAMPS.length;
    at(g, gl, 0, hz, 0, (q, ql) => { r = BK.house(q, ql, o); }); box(cols, 0, hz, r.hx, r.hz + (o.balcony ? 0.0 : 0), r.top + 3);
    if (o.balcony) for (let i = 0; i <= 4; i++) circ(cols, (i / 4 - 0.5) * (o.w + 0.2), hz + o.d / 2 + 1.9, 0.14, 3);
    yard(g, gl, cols, style, lv); dogHouse(g); circ(cols, 8.8, 0.6, 0.8, 1.2); parking(g, gl, cols, lv >= 3, lv);
    light(lv, 0, 2.6, hz + o.d / 2 + 1.2, 0xffd090, 1.2);
    return { g, gl, cols, c0, l0 };
  };
  { const h = mkHouse(2, 721, { w: 9, d: 7, floors: 1, roof: 'gable', chimney: true, wall: PAL.wall[0], roofC: PAL.roof[0], door: PAL.door[0] }, -5.2, 'wood'); tagLv(h.c0, h.l0, 2); levels.push({ grp: finish(h.g, h.gl), cols: h.cols }); }
  { const h = mkHouse(3, 731, { w: 10.5, d: 8, floors: 2, roof: 'gable', balcony: true, chimney: true, wall: PAL.wall[2], roofC: PAL.roof[2], door: PAL.door[1] }, -6.4, 'stone');
    for (const [x, z] of [[-3.4, 14], [3.4, 14]]) { BK.lampPost(h.g, h.gl, x, z); circ(h.cols, x, z, 0.15, 4); light(3, x, 4, z, 0xffd9a0, 0.9); }
    tagLv(h.c0, h.l0, 3); levels.push({ grp: finish(h.g, h.gl), cols: h.cols }); }
  { const h = mkHouse(4, 741, { w: 14, d: 9, floors: 2, roof: 'hip', balcony: true, chimney: true, wall: 0xfaf6ee, roofC: 0x3a6ea8, door: 0x8a5a36 }, -7, 'stone'), g = h.g, gl = h.gl;
    at(g, gl, -12, -9.6, Math.PI / 2, (q, ql) => BK.house(q, ql, { w: 6, d: 6.6, floors: 1, roof: 'hip', wall: 0xfaf6ee, roofC: 0x3a6ea8, door: 0x8a5a36 })); box(h.cols, -12, -9.6, 3.6, 3.3, 7);
    // hovuz
    g.color(PAL.stone).box(12.3, 0.2, -4.4, 6.4, 0.4, 7.4); g.color(0x4fc4ee).box(12.3, 0.36, -4.4, 5.4, 0.12, 6.4); g.color(0xdfe3ea).box(9.4, 0.5, -1.3, 0.1, 1.0, 0.1); g.box(9.4, 0.5, -1.9, 0.1, 1.0, 0.1); box(h.cols, 12.3, -4.4, 3.2, 3.7, 0.7);
    g.color(0xf2ead8).box(8.2, 0.3, -6, 0.7, 0.14, 1.9); g.color(0xe2572f).box(8.2, 0.42, -6.5, 0.7, 0.1, 0.8);
    for (const [x, z] of [[-3.4, 14], [3.4, 14], [-3.4, 6], [3.4, 6]]) { BK.lampPost(g, gl, x, z); circ(h.cols, x, z, 0.15, 4); light(4, x, 4, z, 0xffd9a0, 0.9); }
    BK.tree(g, 15.2, -12.6, 0.9, 0x2f7a52, 1); BK.tree(g, -15.5, 12.8, 0.9, 0x2f7a52, 1); BK.tree(g, 15.6, 2.5, 0.8, 0x2f7a52, 1);
    tagLv(h.c0, h.l0, 4); const grp4 = finish(g, gl); levels.push({ grp: grp4, cols: h.cols });
    // hovuz suvi: to'lqinlanadigan yuza (osmon aksi bilan)
    { const ws = waterSurface(5.4, 6.4), q = W(12.3, -4.4); ws.position.set(q[0], P.y + 0.43, q[1]); ws.rotation.y = yaw; grp4.add(ws); } }
  // --- bezaklar ---
  const decor = {};
  const mkDecor = (id, seed, fn) => { const [g, gl] = mkGB(seed), cols = [], l0 = BK.LAMPS.length; fn(g, gl, cols); tagLv(BK.CHIMNEYS.length, l0, 'd'); decor[id] = { grp: finish(g, gl), cols }; };
  const waterFx = [];
  mkDecor('gulzor', 751, (g) => { const cl = [0xff6a8a, 0xffd23a, 0xf2f2ee, 0xb07cff, 0xff8a3a]; let k = 0; for (let x = -15.6; x <= 15.6; x += 1.1) { if (Math.abs(x) < 3.6) continue; g.color(0x4f9e48).blob(0.36, 0, { cx: x, cy: 0.22, cz: 13.6, sy: 0.7 }); g.color(cl[k++ % 5]).blob(0.2, 0, { cx: x, cy: 0.52, cz: 13.6 }); g.color(cl[k % 5]).blob(0.15, 0, { cx: x + 0.3, cy: 0.42, cz: 13.9 }); } for (const sx of [-1, 1]) for (let z = 3.5; z < 13; z += 1.3) { g.color(0x4f9e48).blob(0.3, 0, { cx: sx * 1.5, cy: 0.18, cz: z, sy: 0.7 }); g.color(cl[k++ % 5]).blob(0.17, 0, { cx: sx * 1.5, cy: 0.44, cz: z }); } });
  mkDecor('bayroq', 761, (g, gl, cols) => { g.push().translate(-5, 0, 12.6); g.color(PAL.stone).box(0, 0.2, 0, 0.9, 0.4, 0.9); g.color(PAL.metalD).cyl(6, 0.08, 0.05, 0, 8.5); g.color(0x2f7fd0).box(0.85, 8.0, 0, 1.7, 0.36, 0.05); g.color(0xf2f2ee).box(0.85, 7.64, 0, 1.7, 0.36, 0.05); g.color(0x3f9a58).box(0.85, 7.28, 0, 1.7, 0.36, 0.05); g.pop(); circ(cols, -5, 12.6, 0.4, 8); });
  mkDecor('argimchoq', 771, (g, gl, cols) => { g.push().translate(-13.4, 0, -3); g.color(PAL.woodD); for (const sx of [-1, 1]) { g.push().translate(sx * 1.5, 0, 0); g.push().rotX(0.3); g.box(0, 1.4, 0, 0.14, 2.9, 0.14); g.pop(); g.push().rotX(-0.3); g.box(0, 1.4, 0, 0.14, 2.9, 0.14); g.pop(); g.pop(); } g.box(0, 2.75, 0, 3.3, 0.14, 0.14); g.color(0xd9c9a0); g.box(-0.4, 1.7, 0, 0.03, 2.0, 0.03); g.box(0.4, 1.7, 0, 0.03, 2.0, 0.03); g.color(PAL.wood).box(0, 0.7, 0, 1.0, 0.07, 0.36); g.pop(); circ(cols, -14.9, -3, 0.35, 2.8); circ(cols, -11.9, -3, 0.35, 2.8); });
  mkDecor('chiroq', 781, (g, gl, cols) => { for (const [x, z] of [[-2.3, 4.5], [2.3, 4.5], [-2.3, 9.5], [2.3, 9.5]]) { g.push().translate(x, 0, z); g.color(PAL.metalD).cyl(6, 0.06, 0.05, 0, 1.4); g.box(0, 1.45, 0, 0.26, 0.06, 0.26); gl.push().translate(x, 0, z); gl.color(PAL.lamp).box(0, 1.62, 0, 0.2, 0.26, 0.2); gl.pop(); g.color(PAL.metalD).box(0, 1.8, 0, 0.28, 0.06, 0.28, { tx: 0.4, tz: 0.4 }); g.pop(); circ(cols, x, z, 0.12, 1.6); } light(1, 0, 1.7, 7, 0xffe0a0, 1.3, 'chiroq'); });
  mkDecor('favvora', 791, (g, gl, cols) => { g.push().translate(6.2, 0, 10.6); g.color(PAL.stone).prism(10, 1.7, 1.7, 0, 0.5); g.color(0x4fc4ee).prism(10, 1.45, 1.45, 0.44, 0.52); g.color(PAL.stoneD).cyl(8, 0.26, 0.2, 0.4, 1.5); g.color(PAL.stone).prism(8, 0.75, 0.6, 1.5, 1.66); g.color(0x4fc4ee).prism(8, 0.62, 0.62, 1.62, 1.7); g.color(PAL.stoneD).cyl(6, 0.12, 0.08, 1.6, 2.2); g.pop(); circ(cols, 6.2, 10.6, 1.75, 1.2); });
  // favvora: pastki va yuqori kosada to'lqinlanadigan suv, tepada purkagich (details.js zarrachalari)
  { const grp = decor.favvora.grp, q = W(6.2, 10.6); for (const [r, y] of [[1.45, 0.53], [0.62, 1.71]]) { const ws = waterSurface(r, 0, true); ws.position.set(q[0], P.y + y, q[1]); grp.add(ws); } waterFx.push({ grp, x: q[0], y: P.y + 2.25, z: q[1] }); }
  // --- yo'lak (darvozadan yo'lgacha) ---
  { const g = new GB(799); g.jit = 0.02; g.color(0xb7a58a); const n = 12; let prev = null; const d = nr.edge >= 0 ? nr.d - nr.hw : 30;
    for (let i = 0; i <= n; i++) { const lz = FZ + 0.3 + (d - FZ + 1.5) * i / n, a = W(-2.2, lz), b = W(2.2, lz); const row = [[a[0], T.gridHeight(a[0], a[1]) + 0.07, a[1]], [b[0], T.gridHeight(b[0], b[1]) + 0.07, b[1]]]; if (prev) g.quad(prev[0], row[0], row[1], prev[1]); prev = row; }
    const m = new THREE.Mesh(g.build(), MAT.flat); m.receiveShadow = true; scene.add(m); }
  const api = {
    x: P.x, z: P.z, y: P.y, yaw, W, lvl: -1, levels, decor, waterFx,
    door: W(0, 2.6), beds: BEDS.map(([x, z]) => W(x, z)), coop: W(13, -10.4), mail: W(3.5, FZ + 2.4), park: W(9.5, 21.5), parkYaw: yaw + Math.PI / 2, dog: W(8.8, 2.2), gate: W(0, FZ + 3),
    setLevel(n) { api.lvl = n; levels.forEach((L, i) => { L.grp.visible = i === n; for (const o of L.cols) o.dead = i !== n; }); for (const l of lights) if (!l.decor) l.on = l.lv === n; for (const f of fires) { const on = f.lv === n, k = site.fires.indexOf(f); if (on && k < 0) site.fires.push(f); else if (!on && k >= 0) site.fires.splice(k, 1); } },
    setDecor(id, on) { const d = decor[id]; if (!d) return; d.grp.visible = on; for (const o of d.cols) o.dead = !on; for (const l of lights) if (l.decor === id) l.on = on; },
  };
  return api;
}
