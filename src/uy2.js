// Uy kengaytmalari: mehmon xonasi, oshxonani yangilash (duxovka, samovar), garaj (transport saqlash va ta'mir), hovli jihozlari (topchan, mangal, tandir, mevali bog', uzum ishkomi, girlyanda)
import * as THREE from 'three';
import * as T from './terrain.js';
import * as COL from './colliders.js';
import { GB, MAT } from './geo.js';
import { glowMat, withMask } from './details.js';
import { buildVehicle, syncWheels, vehById } from './vehicles.js';
import { ITEMS } from './living.js';
import { ROOM_NAME } from './interior.js';
import { PAINTS } from './carmodel.js';

const som = (n) => Math.round(n).toLocaleString('ru-RU');
const HN = ['Chodir', 'Kulba', 'Hovli uy', 'Ikki qavatli uy', 'Villa'];
// lvl — kerakli uy darajasi (0 chodir, 1 kulba, 2 hovli uy)
export const EXT = [
  { id: 'guest', name: 'Mehmon xonasi', ic: '🛏', cost: 4500, lvl: 1, desc: "Uyga yangi xona: ikkinchi karavot, shkaf, gilam — mehmonlar uchun" },
  { id: 'kitchen', name: 'Oshxonani yangilash', ic: '🍳', cost: 3500, lvl: 2, desc: 'Duxovka (somsa, pirog) va samovar (choy tetiklashtiradi)' },
  { id: 'garage', name: 'Garaj', ic: '🚗', cost: 6000, lvl: 1, desc: "Transport saqlanadi va o'zi ta'mirlanadi, ta'mir va yoqilg'i arzonroq" },
];
export const YARD = [
  { id: 'topchan', name: 'Katta topchan', ic: '🧺', cost: 700, desc: "Hovlida o'tirib dam olasiz — tetiklik tiklanadi" },
  { id: 'ishkom', name: 'Uzum ishkomi', ic: '🍇', cost: 1300, desc: 'Topchan ustida soya; har 12 soatda uzum' },
  { id: 'mangal', name: 'Mangal', ic: '🔥', cost: 900, desc: "Shashlik pishirasiz (go'shti 20 so'm)" },
  { id: 'tandir', name: 'Tandir', ic: '🫓', cost: 1100, desc: "Har 16 soatda 3 ta issiq non (hovli uyda bor)" },
  { id: 'bog', name: "Mevali bog'", ic: '🍎', cost: 1600, desc: "Olma, o'rik, anor — har 12 soatda meva" },
  { id: 'girlyanda', name: 'Girlyanda chiroqlar', ic: '💡', cost: 600, desc: 'Kechqurun hovli rang-barang yonadi' },
];
const NEW_ITEMS = { somsa: ['Uy somsasi', '🥟', 0, 45], pirog: ['Mevali pirog', '🥧', 0, 55], shashlik: ['Shashlik', '🍢', 0, 65] };
export const OVEN = [['somsa', { veg: 1, egg: 1 }, 6], ['pirog', { fruit: 2, egg: 1 }, 7]];

export function initUy2(game) {
  const { scene, car } = game, st = game.state, pl = game.player, L = game.live, HY = game.hayot, IN = game.interior, K = game.kun, F = IN.F, LB = IN.lib;
  const home = game.site.places.uy.home, U = { yard: {}, garage: null }; game.uy2 = U;
  const toast = (m, k) => game.toast(m, k), sfx = (n, k) => game.audio.sfx(n, k), fx = () => game.fx;
  Object.assign(ITEMS, NEW_ITEMS); ROOM_NAME.guest = 'Mehmon xonasi';
  const H = (st.home2 = Object.assign({ guest: 0, kitchen: 0, garage: 0, yard: {}, gVeh: null, gT: 0, bogT: -99, ishkomT: -99, tandirT: -99 }, st.home2 || {})); H.yard = H.yard || {};
  const has = (id) => !!H[id] || !!H.yard[id];
  U.has = has;
  const W = home.W, yawH = home.yaw, gh = (lx, lz) => { const p = W(lx, lz); return T.gridHeight(p[0], p[1]); };
  const visit = () => game.visit && game.visit.on;
  // onlayn mehmon: ko'rinadigan kengaytmalar — xona egasiniki (coop.js U.vh ga yozadi), o'z H saqlovi tegilmaydi
  const NOV = { guest: 0, kitchen: 0, garage: 0, yard: {}, gVeh: null }, HV = () => (visit() ? U.vh || NOV : H);

  // ================= ICHKI XONALAR (interior.js ilgaklari) =================
  IN.homeRooms = (lvl, Lv, rooms, doors) => { if (!HV().guest || lvl < 1) return; const { A, B } = Lv; rooms.push({ t: 'guest', x0: -A - 3.4, z0: -B, x1: -A, z1: B, floor: Lv.floor }); doors.push({ ax: 'x', c: -A, a: B - 1.25, b: B - 0.3 }); };
  IN.homeFurnish = (I, g, gw, gl, lamps, lvl, Lv) => { const o = I.o, { A, B, C, D, E, h } = Lv, wood = lvl >= 3 ? 0x6e4a30 : 0x8a5a36, frame = lvl >= 3 ? 0x5a3a26 : 0x8a5a36;
    if (HV().guest && lvl >= 1) { const x0 = -A - 3.4, x1 = -A, cx = (x0 + x1) / 2;
      LB.putF(I, g, gl, x0 + 1.1, -0.35, Math.PI / 2, (q) => F.bed(q, [0xb84a34, 0x3f7a4a, 0x8a54c8, 0xd08a2a, 0x3d74a6][lvl], frame), [0.8, 1.05, 0.6], o);
      LB.spot(I, 'bed', x0 + 1.1, -0.35 + 1.2, Math.PI, { bed: [x0 + 1.1, -0.35, Math.PI / 2], r: 1.1 });
      LB.putF(I, g, gl, x0 + 0.3, -0.35 - 1.1, Math.PI / 2, (q) => F.nightstand(q, frame), [0.2, 0.24, 0.6], o); LB.putF(I, g, gl, x0 + 0.3, -0.35 - 1.1, Math.PI / 2, (q, ql) => { q.translate(0, 0.56, 0); F.lantern(q, ql.translate(0, 0.56, 0)); }, null, o);
      LB.putF(I, g, gl, x1 - 1.0, -B + 0.32, 0, (q) => F.wardrobe(q, 1.2, frame), [0.62, 0.3, 2], o); LB.spot(I, 'wardrobe', x1 - 1.0, -B + 0.95, Math.PI, { r: 1.0 }); // yuz shkafga: oynada kamera xonaga qaraydi (avval shkaf ichida qolardi)
      LB.putF(I, g, gl, cx + 0.3, 0.1, 0, (q) => F.rug(q, 2.0, 2.6, 0x8a3a5a, 0xf0b83a), null, o);
      LB.putF(I, g, gl, x1 - 0.5, B - 0.4, 0, (q) => F.plant(q, lvl >= 3), [0.2, 0.2, 1], o);
      LB.putF(I, g, gl, x0 + 0.06, 0.9, Math.PI / 2, (q) => { q.translate(0, 1.6, 0); F.frame(q, 0.8, 0.55, 0xa8d8a0); }, null, o);
      LB.putF(I, g, gl, cx, B - 0.06, Math.PI, (q) => { q.translate(0, 1.7, 0); F.frame(q, 0.9, 0.6, 0xf0c070); }, null, o);
      LB.putF(I, g, gl, x0 + 0.95, B - 0.45, Math.PI, (q) => F.chair(q, wood), null, o); LB.spot(I, 'sit', x0 + 0.95, B - 0.45, Math.PI, { r: 0.8 });
      LB.putF(I, g, gl, cx, 0, 0, (q, ql) => F.ceilLamp(ql, h), null, o); lamps.push([cx, h - 0.3, 0, 1.0]);
      LB.putF(I, g, gl, x1 - 0.07, B - 1.6, -Math.PI / 2, (q, ql) => F.switchPlate(q, ql), null, o); LB.spot(I, 'switch', x1 - 0.45, B - 1.6, -Math.PI / 2, { r: 0.7 }); }
    if (HV().kitchen && E) { const kx0 = C, kx1 = C + E, Z1 = B + D;
      // duxovka (gaz plita + pech), samovar xontaxtada, osma javon
      LB.putF(I, g, gl, kx1 - 1.15, Z1 - 0.32, Math.PI, (q, ql) => { q.color(0x2a2c33).box(0, 0.45, 0, 0.62, 0.9, 0.6); q.color(0x1d1e22).box(0, 0.4, 0.301, 0.52, 0.5, 0.01); ql.color(0xff9a40).box(0, 0.4, 0.305, 0.38, 0.26, 0.004); q.color(0xb9bec8).box(0, 0.72, 0.31, 0.46, 0.03, 0.03); q.color(0x3a3c42).box(0, 0.915, 0, 0.62, 0.03, 0.6); for (const [x, z] of [[-0.15, -0.14], [0.15, -0.14], [-0.15, 0.14], [0.15, 0.14]]) q.push().translate(x, 0, z).color(0x6a6e78).cyl(10, 0.08, 0.08, 0.93, 0.95, { cap: true }).pop(); q.color(0xd8a040).push().translate(0.15, 0, 0.14).cyl(10, 0.12, 0.13, 0.95, 1.1, { cap: true }).pop(); }, [0.32, 0.31, 1], o);
      LB.spot(I, 'oven', kx1 - 1.15, Z1 - 0.95, 0, { r: 0.9 });
      LB.putF(I, g, gl, kx0 + 1.0, Z1 - 0.3, Math.PI, (q) => { F.counter(q, 0.7, 0xe8e0d0, 0x7a4e2e); q.color(0xd8a040).cyl(10, 0.11, 0.13, 0.91, 1.22, { cap: true }); q.cyl(10, 0.07, 0.1, 1.22, 1.32, { cap: true }); q.color(0x2a2c33).cyl(6, 0.025, 0.025, 1.32, 1.37, { cap: true }); q.color(0xd8a040).box(0, 0.98, 0.15, 0.03, 0.03, 0.09); q.color(0x3d74a6).push().translate(0, 1.37, 0).cyl(10, 0.06, 0.05, 0, 0.1, { cap: true }).pop();
        q.color(0xf2f2ee); for (const sx of [-0.25, 0.25]) q.push().translate(sx, 0.91, 0.12).cyl(8, 0.045, 0.035, 0, 0.06, { cap: true }).pop(); }, [0.36, 0.3, 1], o);
      LB.spot(I, 'samovar', kx0 + 1.0, Z1 - 0.95, 0, { r: 0.85 });
      LB.putF(I, g, gl, kx1 - 1.15, Z1 - 0.08, Math.PI, (q) => { q.color(0x8a5a36).box(0, 1.75, 0.02, 0.9, 0.5, 0.3); q.color(0xf2f2ee); for (let i = 0; i < 5; i++) q.push().translate(-0.32 + i * 0.16, 1.55, 0.05).cyl(8, 0.05, 0.04, 0, 0.12, { cap: true }).pop(); }, null, o); }
  };
  if (H.guest || H.kitchen) IN.rebuildHome(true);

  // ================= HOVLI JIHOZLARI (tashqarida) =================
  const mkGrp = (seed, fn) => { const g = new GB(seed), gl = new GB(seed + 1); g.jit = 0.025; gl.jit = 0; g.translate(home.x, 0, home.z).rotY(yawH); gl.translate(home.x, 0, home.z).rotY(yawH); const cols = []; fn(g, gl, cols); const grp = new THREE.Group(); const m = new THREE.Mesh(g.build(), MAT.flat); m.castShadow = true; m.receiveShadow = true; grp.add(m); if (gl.count) grp.add(new THREE.Mesh(withMask(gl.build()), glowMat())); scene.add(grp); return { grp, cols }; };
  const at = (g, lx, lz, a, fn, y) => { g.push().translate(lx, y == null ? gh(lx, lz) : y, lz).rotY(a); fn(g); g.pop(); };
  const circ = (cols, lx, lz, r, hh = 1.6) => { const p = W(lx, lz), y = gh(lx, lz); cols.push(COL.addCircle(p[0], p[1], r, y - 1, y + hh)); };
  const box = (cols, lx, lz, hx, hz, hh) => { const y = gh(lx, lz), P = (a, b) => W(lx + a, lz + b), c = [P(-hx, -hz), P(hx, -hz), P(hx, hz), P(-hx, hz)]; for (let i = 0; i < 4; i++) { const a = c[i], b = c[(i + 1) % 4]; cols.push(COL.addSeg(a[0], a[1], b[0], b[1], 0.1, y - 1, y + hh)); } };
  const TP = [-4.4, 7.4], MG = [5.2, 4.2], TD = [-5.6, 0.6], TREES = [[-4, -13.6, 0x4f9e48, 0xe8382e], [0.6, -13.8, 0x5aa83a, 0xf0a030], [5, -13.6, 0x3f8a3a, 0xa8202e]], GP = [[-7.5, 2], [-7.5, 13.5], [7.5, 13.5], [7.5, 2]];
  const BUILD = {
    topchan: () => mkGrp(3501, (g, gl, cols) => { const y = Math.max(...[[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => gh(TP[0] + a, TP[1] + b))); at(g, TP[0], TP[1], 0, (q) => {
      q.color(0x6e4a30); for (const sx of [-0.95, 0.95]) for (const sz of [-1.05, 1.05]) q.box(sx, -0.4, sz, 0.12, 1.7, 0.12); q.color(0x9a6a42).box(0, 0.42, 0, 2.1, 0.1, 2.3); q.color(0x6e4a30); for (const [ax, az, lx, lz] of [[0, -1.12, 2.1, 0.07], [-1.02, 0, 0.07, 2.3], [1.02, 0, 0.07, 2.3]]) q.box(ax, 0.74, az, lx, 0.06, lz);
      q.color(0xb83a2e).box(0, 0.5, 0, 1.95, 0.06, 2.15); q.color(0xf0b83a).box(0, 0.535, 0, 1.5, 0.01, 1.7); q.color(0x2f5a98); for (const x of [-0.6, 0, 0.6]) q.box(x, 0.68, -0.95, 0.5, 0.26, 0.14); q.color(0xd8392b); for (const z of [-0.4, 0.4]) q.box(-0.86, 0.66, z, 0.14, 0.24, 0.6);
      q.color(0x8a5a36).box(0.1, 0.72, 0.1, 0.9, 0.05, 0.7); for (const sx of [-1, 1]) for (const sz of [-1, 1]) q.box(0.1 + sx * 0.38, 0.62, 0.1 + sz * 0.28, 0.05, 0.16, 0.05); q.color(0xf2ead8).push().translate(0.2, 0.75, 0.1).cyl(10, 0.26, 0.28, 0, 0.02, { cap: true }).pop();
      q.color(0x3d74a6).push().translate(-0.1, 0.75, 0.15).cyl(8, 0.07, 0.08, 0, 0.12, { cap: true }).box(0.09, 0.08, 0, 0.06, 0.02, 0.02).pop(); q.color(0xf2f2ee); for (const sx of [0.3, 0.42]) q.push().translate(sx, 0.75, 0.25).cyl(8, 0.04, 0.03, 0, 0.05, { cap: true }).pop(); q.color(0xe0a050).push().translate(0.25, 0.775, -0.05).cyl(10, 0.12, 0.12, 0, 0.03, { cap: true }).pop(); }, y);
      box(cols, TP[0], TP[1], 1.0, 1.1, 0.8); U.yard.topY = y; }),
    ishkom: () => mkGrp(3503, (g, gl, cols) => { const yt = Math.max(...[[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => gh(TP[0] + a * 1.7, TP[1] + b * 1.7))) + 2.75;
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const px = TP[0] + sx * 1.65, pz = TP[1] + sz * 1.75, y = gh(px, pz); at(g, px, pz, 0, (q) => q.color(0x6e4a30).box(0, (yt - y + 0.2) / 2 - 0.1, 0, 0.14, yt - y + 0.3, 0.14)); circ(cols, px, pz, 0.12, 2.6); }
      at(g, TP[0], TP[1], 0, (q) => { q.color(0x6e4a30); for (const sz of [-1.75, 1.75]) q.box(0, 0.05, sz, 3.6, 0.12, 0.1); for (let k = -1.6; k <= 1.61; k += 0.53) q.box(k, 0.14, 0, 0.06, 0.06, 3.8); for (let i = 0; i < 11; i++) { const ax = Math.sin(i * 2.7) * 1.5, az = Math.cos(i * 1.9) * 1.6; q.color([0x4f8f3a, 0x5d9e44, 0x467f34][i % 3]).blob(0.6, 1, { cx: ax, cy: 0.3, cz: az, sy: 0.36, jitter: 0.12, shade: 0.25 }); }
        q.color(0x6e4a30); for (const sx of [-1, 1]) q.push().translate(sx * 1.65, -1.4, 1.75).rotZ(sx * 0.18).cyl(5, 0.05, 0.035, 0, 1.5).pop(); }, yt);
      U.yard.grapeY = yt; }),
    mangal: () => mkGrp(3505, (g, gl, cols) => { at(g, MG[0], MG[1], 0, (q) => { q.color(0x3a3c42); for (const sx of [-0.45, 0.45]) for (const sz of [-0.13, 0.13]) q.box(sx, 0.38, sz, 0.04, 0.76, 0.04); q.color(0x2a2c33).box(0, 0.86, 0, 1.0, 0.24, 0.32); q.color(0x1d1e22).box(0, 0.98, 0, 0.94, 0.02, 0.26); q.color(0x8a909c); for (let i = 0; i < 5; i++) q.box(-0.36 + i * 0.18, 1.0, 0, 0.012, 0.012, 0.5); q.color(0x8a3a2a); for (let i = 0; i < 5; i++) for (let k = 0; k < 4; k++) q.box(-0.36 + i * 0.18, 1.02, -0.12 + k * 0.08, 0.05, 0.04, 0.05); });
      at(gl, MG[0], MG[1], 0, (q) => { q.color(0xff6a20); for (let i = 0; i < 9; i++) q.blob(0.05, 0, { cx: -0.38 + i * 0.095, cy: 0.97, cz: Math.sin(i * 1.7) * 0.07 }); }); circ(cols, MG[0], MG[1], 0.5, 1.1); }),
    tandir: () => mkGrp(3507, (g, gl, cols) => { if (st.home.lvl >= 2) return; at(g, TD[0], TD[1], 0, (q) => { q.color(0x8f8a80).box(0, 0.15, 0, 1.4, 0.3, 1.4); q.color(0xd9b78a).push().translate(0, 0.3, 0).blob(0.58, 1, { cy: 0.38, sy: 0.82, shade: 0.18 }).pop(); q.color(0x3a2a22).push().translate(0, 0.3, 0).rotX(-0.9).cyl(8, 0.2, 0.2, 0.42, 0.6).pop(); q.color(0xc49c6e).push().translate(0, 0.3, 0).cyl(8, 0.24, 0.22, 0.7, 0.82).pop(); }); circ(cols, TD[0], TD[1], 0.7, 1.2); }),
    bog: () => mkGrp(3509, (g, gl, cols) => { for (const [x, z, leaf] of TREES) { at(g, x, z, 0, (q) => { q.color(0x6e4a30).cyl(6, 0.14, 0.1, 0, 1.6).push().translate(0, 1.4, 0).rotZ(0.5).cyl(5, 0.07, 0.05, 0, 0.9).pop().push().translate(0, 1.5, 0).rotZ(-0.6).cyl(5, 0.07, 0.05, 0, 0.8).pop(); q.color(leaf); for (let i = 0; i < 6; i++) q.blob(0.75, 1, { cx: Math.sin(i * 1.05) * 0.6, cy: 2.3 + (i % 2) * 0.45, cz: Math.cos(i * 1.05) * 0.6, jitter: 0.12, shade: 0.22 }); q.color(leaf).blob(0.8, 1, { cy: 2.9 }); }); circ(cols, x, z, 0.25, 3); } }),
    girlyanda: () => mkGrp(3511, (g, gl) => { const top = (p) => gh(p[0], p[1]) + 3.4; for (const p of GP) at(g, p[0], p[1], 0, (q) => { const y = gh(p[0], p[1]); q.color(0x4a4e58).box(0, 1.7, 0, 0.1, 3.4, 0.1); void y; });
      const cols = [0xff4a3a, 0xffd23a, 0x4ad06a, 0x4fb0ff, 0xff7ab8]; let k = 0;
      for (let s = 0; s < 3; s++) { const a = GP[s], b = GP[s + 1], ya = top(a), yb = top(b), n = Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.55);
        for (let i = 0; i <= n; i++) { const t = i / n, x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t, y = ya + (yb - ya) * t - 0.7 * Math.sin(t * Math.PI); gl.push().translate(x, y - 0.08, z).color(cols[k++ % cols.length]).blob(0.07, 0, {}).pop(); if (i < n) { const t2 = (i + 0.5) / n, x2 = a[0] + (b[0] - a[0]) * t2, z2 = a[1] + (b[1] - a[1]) * t2, y2 = ya + (yb - ya) * t2 - 0.7 * Math.sin(t2 * Math.PI); g.push().translate(x2, y2, z2).rotY(Math.atan2(b[0] - a[0], b[1] - a[1])).color(0x2a2c33).box(0, 0, 0, 0.012, 0.012, 0.58).pop(); } } } }),
  };
  // mevalar va uzum: pishganda ko'rinadi
  const fruitM = (() => { const g = new GB(3521); g.jit = 0; g.translate(home.x, 0, home.z).rotY(yawH); for (const [x, z, , c] of TREES) { const y = gh(x, z); g.color(c); for (let i = 0; i < 9; i++) g.blob(0.1, 0, { cx: x + Math.sin(i * 2.3) * 0.95, cy: y + 2.0 + (i % 3) * 0.45, cz: z + Math.cos(i * 2.3) * 0.95 }); } const m = new THREE.Mesh(g.build(), MAT.flat); m.visible = false; scene.add(m); return m; })();
  const grapeM = { m: null };
  const buildGrapes = () => { if (grapeM.m || U.yard.grapeY == null) return; const g = new GB(3523), y = U.yard.grapeY; g.jit = 0; g.translate(home.x, 0, home.z).rotY(yawH); g.color(0x6a3a7a); for (let i = 0; i < 8; i++) g.blob(0.11, 0, { cx: TP[0] + Math.sin(i * 2.1) * 1.3, cy: y - 0.08, cz: TP[1] + Math.cos(i * 1.7) * 1.3, sy: 1.7 }); grapeM.m = new THREE.Mesh(g.build(), MAT.flat); grapeM.m.visible = false; scene.add(grapeM.m); };
  // hovli uyda (2-daraja) tandir o'zi bor — alohida tandir chizilmaydi
  const show = () => { const lv = st.home.lvl; for (const y of YARD) { const want = lv >= 1 && !!HV().yard[y.id] && !(y.id === 'tandir' && lv >= 2); let o = U.yard[y.id]; if (want && !o) o = U.yard[y.id] = BUILD[y.id](); if (o) { o.grp.visible = want; for (const c of o.cols) c.dead = !want; } }
    if (HV().yard.ishkom) buildGrapes(); if (!visit() && H.yard.tandir == null && lv >= 2) H.yard.tandir = 1; garage(); };
  U.show = show;

  // ================= GARAJ =================
  const gSite = (() => { for (const [lx, lz] of [[-9.8, 21.4], [-9.8, 19.8], [-23.5, 4], [-23.5, -6], [23.5, 6]]) { let lo = 1e9, hi = -1e9, ok = true;
    for (const [a, b] of [[-3.4, -3.6], [3.4, -3.6], [3.4, 3.6], [-3.4, 3.6], [0, 0], [0, 6.5]]) { const p = W(lx + a, lz + b), si = T.siteInfo(p[0], p[1]); if (si.roadD < 0.8 || si.y < si.water + 0.5) ok = false; lo = Math.min(lo, si.y); hi = Math.max(hi, si.y); }
    if (ok && hi - lo < 1.6) return { lx, lz, lo, hi, a: lx < -15 ? Math.PI / 2 : lx > 15 ? -Math.PI / 2 : 0 }; } return { lx: -9.8, lz: 21.4, lo: gh(-9.8, 21.4), hi: gh(-9.8, 21.4), a: 0 }; })();
  const GL = (x, z) => { const c = Math.cos(gSite.a), s = Math.sin(gSite.a); return W(gSite.lx + x * c + z * s, gSite.lz - x * s + z * c); }; // garaj ichidagi joy → dunyo
  U.gSite = gSite; U.gDoor = () => GL(0, 4.4); U.gOut = () => { const p = GL(0, 7.5); return [p[0], p[1], yawH + gSite.a]; };
  let gObj = null, gDisp = null; const floorY = gSite.hi + 0.12;
  const garage = () => { const want = !!HV().garage && st.home.lvl >= 1; if (want && !gObj) {
      const g = new GB(3531), gl = new GB(3532); g.jit = 0.02; gl.jit = 0; const [cx, cz] = GL(0, 0), ya = yawH + gSite.a; g.translate(cx, floorY, cz).rotY(ya); gl.translate(cx, floorY, cz).rotY(ya); const wy = 3.0, dep = floorY - gSite.lo + 0.5;
      g.color(0x8f8a80).box(0, -dep / 2, 0, 7.0, dep, 7.4); g.color(0xa8a49c).box(0, 0.02, 0, 6.6, 0.06, 7.0); g.color(0x8e8a82); for (let i = -3; i <= 3; i++) g.box(i * 0.95, 0.055, 0, 0.02, 0.01, 7.0); // beton pol
      g.color(0xc8b8a0).box(0, wy / 2, -3.45, 6.8, wy, 0.2); for (const sx of [-1, 1]) g.box(sx * 3.3, wy / 2, 0, 0.2, wy, 7.1); for (const sx of [-1, 1]) g.box(sx * 2.85, wy / 2, 3.45, 0.7, wy, 0.2); g.box(0, wy - 0.3, 3.45, 5.0, 0.6, 0.2); // devorlar
      g.color(0xa8988a); for (let k = 0; k < 6; k++) g.box(0, 0.25 + k * 0.5, -3.34, 6.6, 0.02, 0.02); g.color(0x8a909c).push().translate(0, wy - 0.42, 3.3).rotZ(Math.PI / 2).cyl(10, 0.22, 0.22, -2.45, 2.45, { cap: true }).pop(); // ko'tarma darvoza o'rami
      g.color(0x6b6e78).push().translate(0, wy + 0.25, 0).rotX(0.06).box(0, 0, 0, 7.4, 0.12, 7.9).pop(); g.color(0x5a5e68); for (let i = -3.4; i <= 3.41; i += 0.38) g.push().translate(i, wy + 0.33, 0).rotX(0.06).box(0, 0, 0, 0.06, 0.05, 7.9).pop(); // tunuka tom
      g.color(0x7a4e2e).box(-2.75, 0.45, -1.2, 0.8, 0.9, 2.6); g.color(0x5a3a26).box(-2.75, 0.92, -1.2, 0.86, 0.05, 2.7); g.color(0x8a909c); for (let i = 0; i < 5; i++) g.box(-3.15, 1.6, -2.2 + i * 0.4, 0.02, 0.5, 0.04); g.color(0xd8392b).box(-2.75, 1.0, -0.4, 0.4, 0.14, 0.24); g.color(0x2a2c33).box(-2.7, 0.98, -1.6, 0.18, 0.06, 0.5); // dastgoh, asboblar
      g.color(0x1d1e22); for (let k = 0; k < 4; k++) g.push().translate(2.6, 0.13 + k * 0.24, -2.6).cyl(14, 0.36, 0.36, -0.11, 0.11, { cap: true }).pop(); g.color(0x2f6fd0).push().translate(2.65, 0, -1.4).cyl(12, 0.3, 0.3, 0, 0.9, { cap: true }).pop(); g.color(0xf0b83a).box(2.65, 0.95, -1.4, 0.2, 0.06, 0.2); // shinalar, bochka
      gl.color(0xfff4d8).box(0, wy - 0.05, 0, 0.16, 0.05, 2.4);
      const sc = document.createElement('canvas'); sc.width = 256; sc.height = 64; { const x = sc.getContext('2d'); x.fillStyle = '#2a2c33'; x.fillRect(0, 0, 256, 64); x.fillStyle = '#ffd23a'; x.font = 'bold 40px sans-serif'; x.textAlign = 'center'; x.fillText('GARAJ', 128, 46); }
      const tx = new THREE.CanvasTexture(sc); tx.colorSpace = THREE.SRGBColorSpace; const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.4), new THREE.MeshBasicMaterial({ map: tx, fog: true })); const sp = GL(0, 3.57); sign.position.set(sp[0], floorY + wy - 0.3, sp[1]); sign.rotation.y = ya;
      const grp = new THREE.Group(); const m = new THREE.Mesh(g.build(), MAT.flat); m.castShadow = true; m.receiveShadow = true; grp.add(m, sign); if (gl.count) grp.add(new THREE.Mesh(withMask(gl.build()), glowMat())); scene.add(grp);
      const cols = []; const seg = (a, b) => { const p = GL(a[0], a[1]), q = GL(b[0], b[1]); cols.push(COL.addSeg(p[0], p[1], q[0], q[1], 0.14, floorY - 1, floorY + wy)); };
      seg([-3.4, -3.45], [3.4, -3.45]); seg([-3.3, -3.45], [-3.3, 3.45]); seg([3.3, -3.45], [3.3, 3.45]); seg([-3.3, 3.45], [-2.5, 3.45]); seg([2.5, 3.45], [3.3, 3.45]); seg([-3.15, -2.5], [-3.15, 0.1]); seg([-2.35, -2.5], [-2.35, 0.1]);
      const pt = T.addPatch(cx, cz, ya, 7.0, 6.6, floorY + 0.05, floorY + 0.05, T.SURF.ROAD); gObj = { grp, cols, pt }; dispVeh(); }
    if (gObj) { dispVeh(); gObj.grp.visible = want; for (const c of gObj.cols) c.dead = !want; if (gDisp) gDisp.root.visible = want; } };
  // garajdagi (saqlangan) transport ko'rinishi — yengil nusxa, chirog'i olib tashlangan (chiroqlar soni o'zgarmasin)
  const dispVeh = () => { const id = HV().gVeh; if (gDisp && gDisp.id === id) return; if (gDisp) { scene.remove(gDisp.root); gDisp = null; } if (!id || !vehById[id] || !gObj) return;
    const m = buildVehicle(id, { lite: true }); m.root.remove(m.spot); m.root.remove(m.spot.target); const pid = !visit() && st.veh.paint[id]; if (pid) { const pp = PAINTS.find((q) => q.id === pid); if (pp) m.paintMat.color.setHex(pp.hex); } if (!visit() && game.applyPaint) game.applyPaint(m, id); // bo'yoq ustaxonasidagi rang va qoplama (boyoq.js)
    const sp = m.spec, fake = { wheels: [0, 1, 2, 3].map((k) => ({ len: sp.free - sp.sag, spin: 0, ly: (k < 2 ? sp.rF : sp.rR) + (sp.free - sp.sag) - sp.com })), steer: 0, fwd: 0 }; syncWheels(m, fake);
    const [x, z] = GL(0.4, -0.4); m.root.position.set(x, floorY + 0.08 + sp.com, z); m.root.rotation.y = yawH + gSite.a; if (m.rider) m.rider.visible = false; scene.add(m.root); gDisp = m; };
  U.garageDisp = () => gDisp;
  // saqlangan transport 4 o'yin soatida o'zi ta'mirlanadi
  K.on(() => { if (H.garage && H.gVeh && H.gT != null && K.since(H.gT) >= 4 && st.veh.dmg[H.gVeh]) { delete st.veh.dmg[H.gVeh]; if (game.ui) toast(`🔧 Garajdagi ${vehById[H.gVeh] ? vehById[H.gVeh].name : 'transport'} to'liq ta'mirlandi`, 'good'); } });
  U.store = (id) => { if (!H.garage || !st.veh.own.includes(id)) return false; const cur = st.veh.cur; if (id === cur) return false; game.pickVehicle(id, U.gOut()); if (vehById[cur]) { H.gVeh = cur; H.gT = K.now(); } dispVeh(); sfx('door'); return true; };
  U.nearGarage = (x, z, r = 9) => !!gObj && H.garage && !visit() && Math.hypot(U.gDoor()[0] - x, U.gDoor()[1] - z) < r;
  U.repairCost = () => Math.round(game.phone.mechCost() * 0.5);
  U.repair = () => { const d = game.damage; if (d.health >= 99 && !d.tires.some(Boolean)) { toast("Transport soz 👍"); return false; } const c = U.repairCost(); if (st.money < c) { toast('Pul yetarli emas', 'bad'); return false; } game.addMoney(-c, "Garajda ta'mir"); d.repair(100); sfx('repair'); game.save(); return true; };
  U.fuelCost = () => (game.fuel && game.fuel.uses() ? Math.round((100 - game.fuel.get()) * 1.5) : 0);
  U.refuel = () => { const FU = game.fuel; if (!FU || !FU.uses() || FU.get() > 99) return false; const c = U.fuelCost(); if (st.money < c) { toast('Pul yetarli emas', 'bad'); return false; } game.addMoney(-c, "Garajda yoqilg'i"); FU.set(100); sfx('pour'); return true; };

  // ================= SOTIB OLISH =================
  U.buy = (id) => { const e = EXT.find((q) => q.id === id), y = YARD.find((q) => q.id === id), it = e || y; if (!it || has(id)) return false; const need = e ? e.lvl : 1;
    if (st.home.lvl < need) { toast(`Avval uyni «${HN[need]}» darajasigacha yaxshilang`, 'bad'); return false; } if (st.money < it.cost) { toast('Pul yetarli emas', 'bad'); return false; }
    game.addMoney(-it.cost, `Uy: ${it.name}`); if (e) H[id] = 1; else H.yard[id] = 1; sfx('buy'); game.banner(`${it.ic} ${it.name}`, e ? (id === 'garage' ? "Uy yonida garaj qurildi — transportingizni saqlang" : 'Uyga kirib ko\'ring!') : 'Hovlingizda yangi narsa!', 'gold');
    if (id === 'guest' || id === 'kitchen') IN.rebuildHome(true); show(); game.save(); return true; };

  // ================= [E] TAKLIFLARI =================
  const ripe = (k, hrs) => K.since(H[k]) >= hrs;
  const cooking = { t: 0 };
  const ex0 = L.extra;
  L.extra = (offer, px, pz, p) => { ex0(offer, px, pz, p); if (HY.dlg) return; const I = IN.cur();
    if (I && IN.inside === 'home') { for (const sp of I.spots) { if (sp.k !== 'oven' && sp.k !== 'samovar') continue; const d = Math.hypot(sp.x - px, sp.z - pz); if (d > sp.r) continue;
        if (sp.k === 'oven') offer(d, '<kbd>E</kbd> Duxovka — somsa, pirog 🥟', () => game.ui.open('duxovka')); else offer(d, '<kbd>E</kbd> Samovardan choy ichish 🫖', () => { pl.yaw = sp.yaw; sfx('pour'); pl.act('cook', 1.8, () => pl.act('drink', 2.2, () => { st.tetik = Math.min(100, st.tetik + 20); st.thirst = Math.min(100, st.thirst + 35); sfx('sip'); toast(`Samovar choyi 🫖 — tetiklik ${Math.round(st.tetik)}% · 💧 ${Math.round(st.thirst)}%`, 'good'); }, 'cup')); }); } return; }
    if (I || st.home.lvl < 1 || Math.hypot(home.x - px, home.z - pz) > 45) { if (!I && U.nearGarage(px, pz, 3)) offer(0.1, '<kbd>E</kbd> Garaj — transport, ta\'mir 🚗', () => game.ui.open('garaj')); return; }
    const L2 = (lx, lz) => { const q = W(lx, lz); return Math.hypot(q[0] - px, q[1] - pz); };
    if (HV().yard.topchan && !pl.sit) { const d = L2(TP[0], TP[1] + 1.25); if (d < 1.6) offer(d, "<kbd>E</kbd> Topchanga o'tirish 🧺", () => { const q = W(TP[0], TP[1] + 1.18); pl.p[0] = q[0]; pl.p[2] = q[1]; pl.yaw = yawH; pl.v[0] = pl.v[2] = 0; pl.sit = true; pl.emote = null; toast("Topchanda dam olyapsiz — tetiklik asta tiklanadi 🍵"); }); }
    if (visit()) return; // mehmon hovlida faqat topchanga o'tiradi — hosil, mangal va garaj egasiniki
    if (H.yard.ishkom) { const d = L2(TP[0], TP[1]) - 1.2; if (d < 1.4) offer(d + 0.3, ripe('ishkomT', 12) ? "<kbd>E</kbd> Uzum uzish 🍇" : `Uzum hali pishmagan (${Math.ceil(12 - K.since(H.ishkomT))} soat)`, () => { if (!ripe('ishkomT', 12)) return; pl.act('shake', 1.2, () => { H.ishkomT = K.now(); st.inv.berry = (st.inv.berry || 0) + 4; sfx('pick'); toast('🍇 Uzum uzildi: +4 (rezavor)', 'good'); }); }); }
    if (H.yard.mangal) { const d = L2(MG[0], MG[1] - 0.8); if (d < 1.5) offer(d, cooking.on ? 'Shashlik pishmoqda… 🔥' : "<kbd>E</kbd> Shashlik pishirish (go'sht 20 so'm) 🍢", () => { if (cooking.on) return; if (st.money < 20) return toast('Pul yetarli emas', 'bad'); game.addMoney(-20, "Go'sht (shashlik)"); const q = W(MG[0], MG[1] - 0.8); pl.p[0] = q[0]; pl.p[2] = q[1]; pl.yaw = yawH; cooking.on = { t: 0, ...(() => { const c = W(MG[0], MG[1]); return { x: c[0], z: c[1], y: gh(MG[0], MG[1]) + 1.1 }; })() }; sfx('sizzle'); pl.act('cook', 5, () => { cooking.on = null; st.inv.shashlik = (st.inv.shashlik || 0) + 2; sfx('medal'); toast("🍢 Shashlik tayyor! +2 — [Y] bilan yeysiz", 'gold'); }, 'spoon'); }); }
    if (H.yard.tandir) { const d = L2(TD[0], TD[1] + 1.0); if (d < 1.4) offer(d, ripe('tandirT', 16) ? '<kbd>E</kbd> Tandirda non yopish 🫓' : `Tandir soviyapti (${Math.ceil(16 - K.since(H.tandirT))} soat)`, () => { if (!ripe('tandirT', 16)) return; pl.act('bend', 3, () => { H.tandirT = K.now(); st.inv.bread = (st.inv.bread || 0) + 3; sfx('medal'); toast("🫓 Tandirdan 3 ta issiq non uzildi!", 'gold'); }); }); }
    if (H.yard.bog) for (const [x, z] of TREES) { const d = L2(x, z); if (d < 2.2) { offer(d + 0.2, ripe('bogT', 12) ? "<kbd>E</kbd> Bog'dan meva terish 🍎" : `Mevalar pishmoqda (${Math.ceil(12 - K.since(H.bogT))} soat)`, () => { if (!ripe('bogT', 12)) return; pl.act('shake', 1.2, () => { H.bogT = K.now(); st.inv.fruit = (st.inv.fruit || 0) + 6; sfx('pick'); toast("🍎 Bog'dan 6 ta meva terildi", 'good'); }); }); break; } }
    if (U.nearGarage(px, pz, 3)) offer(0.1, '<kbd>E</kbd> Garaj — transport, ta\'mir 🚗', () => game.ui.open('garaj'));
  };
  const ue0 = L.useE; L.useE = () => { if (!pl.onFoot && car.speed < 3 && U.nearGarage(car.p[0], car.p[2], 7) && !HY.dlg) return game.ui.open('garaj'); ue0(); };
  // [Y]: boshqa pishgan ovqat bo'lmasa — uy somsasi, pirog, shashlik
  const da0 = L.doAction; L.doAction = (id) => { if (id === 'eat' && pl.onFoot && pl.lock <= 0) { const mine = ['shashlik', 'pirog', 'somsa'].find((k) => st.inv[k] > 0), dish = ['kabob', 'dimlama', 'friedfish', 'soup', 'omlet', 'salad'].some((k) => st.inv[k] > 0), thirsty = st.thirst < 70 && ['water', 'juice', 'tea'].some((k) => st.inv[k] > 0);
    if (mine && !dish && !thirsty && L.eat(mine)) return toast(`${ITEMS[mine][1]} ${ITEMS[mine][0]} — mazali! · to'qlik ${Math.round(st.sat)}%`, 'good'); } return da0(id); };

  // ================= KADR =================
  const up0 = L.update;
  L.update = (dt) => { up0(dt);
    fruitM.visible = !!U.yard.bog && U.yard.bog.grp.visible && ripe('bogT', 12); if (grapeM.m) grapeM.m.visible = !!U.yard.ishkom && U.yard.ishkom.grp.visible && ripe('ishkomT', 12);
    const c = cooking.on; if (c) { c.t += dt; if ((c.f = (c.f || 0) - dt) <= 0) { c.f = 0.25; fx().burst(2, c.x, c.y, c.z, 0.3, 1.2, 0.4, 0xd8d8d0, 0.5, 1.4, -0.5, 2); } if (pl.lockAnim !== 'cook') cooking.on = null; }
    if (!pl.onFoot && car.speed < 3 && U.nearGarage(car.p[0], car.p[2], 7) && !L.prompt) L.prompt = '<kbd>E</kbd> Garaj — transport, ta\'mir 🚗';
    if (HV().garage && gObj) L.dots.push([...U.gDoor(), '#9aa0aa']);
    const vk = visit() ? JSON.stringify(U.vh || 0) : '', ik = HV().guest + ':' + HV().kitchen;
    if (U._lv !== st.home.lvl || U._vk !== vk) { U._lv = st.home.lvl; U._vk = vk; show(); if (U._ik != null && U._ik !== ik) IN.rebuildHome(true); U._ik = ik; } };

  // ================= OYNALAR =================
  const attach = (ui) => {
    // uy daftariga: kengaytmalar va hovli bo'limi qo'shiladi (asl oyna o'zgarmaydi)
    const home0 = ui.s_home; ui.s_home = function (w, d, btn, x) {
      if (visit()) return home0.call(this, w, d, btn, x); const on0 = this.on, self = this;
      const card = (it, owned, need) => `<div class="card" style="margin-bottom:6px;flex-direction:row;align-items:center"><div class="grow"><h4>${it.ic} ${it.name}</h4><p>${it.desc}</p></div><button data-a="u2buy:${it.id}" class="${owned ? 'sec' : ''}" ${owned || st.money < it.cost || st.home.lvl < need ? 'disabled' : ''}>${owned ? '✓ Bor' : st.home.lvl < need ? `${HN[need]} kerak` : som(it.cost) + " so'm"}</button></div>`;
      this.on = (map) => { on0.call(self, Object.assign({}, map, { u2buy: (id) => { if (U.buy(id)) home0.call(self, w, d, btn, x); } }));
        const sec = document.createElement('div'); sec.className = 'u2-ext'; sec.style.marginTop = '12px';
        sec.innerHTML = `<h4 style="margin:0 0 6px">🏗 Uy kengaytmalari</h4>${EXT.map((e) => card(e, has(e.id), e.lvl)).join('')}<h4 style="margin:10px 0 6px">🌳 Hovli jihozlari</h4>${YARD.map((y) => card(y, has(y.id), 1)).join('')}`;
        if (!w.querySelector('.u2-ext')) w.appendChild(sec); };
      home0.call(this, w, d, btn, x); };
    ui.s_duxovka = function (w, d, btn, x) {
      x(); const okR = (r) => Object.entries(r[1]).every(([k, n]) => (st.inv[k] || 0) >= n);
      w.innerHTML = `<h1>🥟 Duxovka <small>to'qlik ${Math.round(st.sat)}%</small></h1>${OVEN.map((r) => `<div class="card" style="margin-bottom:6px;flex-direction:row;align-items:center"><div class="grow"><h4>${ITEMS[r[0]][1]} ${ITEMS[r[0]][0]}</h4><p>Kerak: ${Object.entries(r[1]).map(([k, n]) => `${ITEMS[k][1]} ${ITEMS[k][0].toLowerCase()} ×${n} <small>(sizda ${st.inv[k] || 0})</small>`).join(', ')} · to'qlik +${ITEMS[r[0]][3]}</p></div><button data-a="bake:${r[0]}" ${okR(r) ? '' : 'disabled'}>Yopish · ${r[2]} s</button></div>`).join('')}<p class="sub">Tayyor taomni <kbd>Y</kbd> bilan yeysiz.</p>`;
      this.on({ bake: (id) => { const r = OVEN.find((q) => q[0] === id); if (!r || !okR(r)) return; for (const [k, n] of Object.entries(r[1])) st.inv[k] -= n; this.close(); const sp = HY.spot('oven'); if (sp) { pl.p[0] = sp.x; pl.p[2] = sp.z; pl.yaw = sp.yaw; } sfx('click'); toast(`🥟 ${ITEMS[id][0]} pishirilmoqda…`);
        pl.act('cook', r[2], () => { st.inv[id] = (st.inv[id] || 0) + 2; sfx('medal'); toast(`${ITEMS[id][1]} ${ITEMS[id][0]} tayyor! +2 — [Y] bilan yeysiz`, 'gold'); }, 'spoon'); } });
    };
    ui.s_garaj = function (w, d, btn, x) {
      x(); const render = () => { const dm = game.damage, rc = U.repairCost(), fc = U.fuelCost(), ok = dm.health >= 99 && !dm.tires.some(Boolean), near = U.nearGarage(car.p[0], car.p[2], 18), gv = H.gVeh && vehById[H.gVeh];
        const left = gv && st.veh.dmg[H.gVeh] ? Math.max(0, Math.ceil(4 - K.since(H.gT))) : 0;
        w.innerHTML = `<h1>🚗 Garaj <small>💰 ${som(st.money)} so'm</small></h1><div class="grid2"><div>
          <div class="card"><h4>Garajda turibdi</h4><p>${gv ? `${gv.name} — ${left ? `ta'mirlanmoqda (${left} soat qoldi)` : 'soz, toza 👍'}` : "Bo'sh. Boshqa transportni tanlasangiz, hozirgisi shu yerda qoladi va o'zi ta'mirlanadi."}</p></div>
          <div class="card" style="margin-top:8px"><h4>${game.carModel.v.name} — dvigatel ${Math.round(dm.health)}%${game.fuel && game.fuel.uses() ? ` · ⛽ ${Math.round(game.fuel.get())}%` : ''}</h4><p>${near ? "Garaj oldida — usta arzonroq ishlaydi" : "Transport garajdan uzoqda — avval olib keling"}</p>
            <div class="row" style="gap:6px;flex-wrap:wrap"><button data-a="fix" ${ok || !near || st.money < rc ? 'disabled' : ''}>${ok ? 'Soz ✓' : `Ta'mirlash — ${som(rc)} so'm`}</button><button class="sec" data-a="fuel" ${!near || !fc || st.money < fc ? 'disabled' : ''}>${fc ? `Bak to'ldirish — ${som(fc)}` : "Bak to'la"}</button></div></div>
        </div><div><h4 style="margin:0 0 6px">Transportni almashtirish</h4><div class="vlist">${st.veh.own.map((id) => `<button class="${st.veh.cur === id ? '' : 'sec'}" data-a="pick:${id}" ${st.veh.cur === id ? 'disabled' : ''}>${vehById[id].name}${H.gVeh === id ? ' · garajda' : ''}</button>`).join('')}</div><p class="sub" style="margin-top:6px">Tanlangani darvoza oldiga chiqadi, hozirgisi garajga kiradi.</p></div></div>`; };
      this.on({ fix: () => { if (U.repair()) toast("🔧 Garajda ta'mirlandi", 'good'); render(); }, fuel: () => { if (U.refuel()) toast("⛽ Bak to'ldirildi", 'good'); render(); }, pick: (id) => { if (U.store(id)) toast(`${vehById[id].name} garajdan chiqdi`, 'good'); render(); } });
      render();
    };
  };
  let ok = false; game.hooks.push(() => { if (!ok && game.ui) { ok = true; attach(game.ui); } });
  show();
  return U;
}
