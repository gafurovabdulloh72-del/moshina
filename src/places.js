// 15 ta manzilni quradi: binolar, to'qnashuv jismlari, yorug'lik nuqtalari, sinadigan buyumlar
import * as THREE from 'three';
import * as T from './terrain.js';
import { GB, MAT } from './geo.js';
import { mulberry32, clamp, lerp } from './util.js';
import * as COL from './colliders.js';
import * as BK from './blocks.js';
import { ROAD_RAMPS, edgePoint } from './acts.js';
import { buildHome } from './home.js';
import { buildDetails, glowMat, withMask } from './details.js';
import { makeRig, poseRig } from './rig.js';
const { PAL } = BK;

class Site {
  constructor(p, yaw, seed) {
    this.p = p; this.yaw = yaw; this.c = Math.cos(yaw); this.s = Math.sin(yaw); this.rng = mulberry32(seed);
    this.g = new GB(seed); this.g.toProps = true; this.g.jit = 0.035; this.gl = new GB(seed + 1); this.gl.jit = 0;
    this.g.translate(p.x, p.y, p.z).rotY(yaw); this.gl.translate(p.x, p.y, p.z).rotY(yaw);
    this.lights = []; this.taken = [];
  }
  w(lx, lz) { return [this.p.x + lx * this.c + lz * this.s, this.p.z - lx * this.s + lz * this.c]; }
  gy(lx, lz) { const [x, z] = this.w(lx, lz); return T.gridHeight(x, z) - this.p.y; }
  roadD(lx, lz) { const [x, z] = this.w(lx, lz); const nr = T.nearestRoad(x, z, 2); return nr.edge >= 0 ? nr.d - nr.hw : 99; }
  // Obyektni joylash: fn ichida g mahalliy (0,0,0) atrofida quradi
  put(lx, lz, yaw, fn, lift = 0) { const y = this.gy(lx, lz) + lift; this.g.push().translate(lx, y, lz).rotY(yaw); this.gl.push().translate(lx, y, lz).rotY(yaw); fn(this.g, this.gl); this.g.pop(); this.gl.pop(); return y; }
  box(lx, lz, hx, hz, yaw, h = 6) { const [x, z] = this.w(lx, lz); const y = T.gridHeight(x, z); COL.addBox(x, z, hx, hz, this.yaw + yaw, y - 2, y + h); }
  circ(lx, lz, r, h = 5) { const [x, z] = this.w(lx, lz); const y = T.gridHeight(x, z); COL.addCircle(x, z, r, y - 2, y + h); }
  seg(l1x, l1z, l2x, l2z, h = 2, r = 0.3) { const a = this.w(l1x, l1z), b = this.w(l2x, l2z); const y = T.gridHeight(a[0], a[1]); COL.addSeg(a[0], a[1], b[0], b[1], r, y - 2, y + h); }
  light(lx, ly, lz, hex = 0xffc878, power = 1) { const [x, z] = this.w(lx, lz); this.lights.push({ x, y: T.gridHeight(x, z) + ly, z, hex, power }); }
  free(lx, lz, r) { for (const t of this.taken) if (Math.hypot(t[0] - lx, t[1] - lz) < t[2] + r) return false; return true; }
  take(lx, lz, r) { this.taken.push([lx, lz, r]); }
  // Yo'ldan uzoq, bo'sh joy topish
  spot(rMin, rMax, r, roadMin = 6, tries = 60) {
    for (let i = 0; i < tries; i++) {
      const a = this.rng() * 6.283, d = lerp(rMin, rMax, Math.sqrt(this.rng()));
      const lx = Math.cos(a) * d, lz = Math.sin(a) * d;
      if (this.roadD(lx, lz) < roadMin + r * 0.5 || !this.free(lx, lz, r)) continue;
      this.take(lx, lz, r); return [lx, lz];
    }
    return null;
  }
  // Yo'l yoqasidagi nuqta (e'lonlar taxtasi uchun)
  roadside(rad = 16, dMin = 3.2, dMax = 7) {
    let best = null;
    for (let k = 0; k < 4; k++) for (let i = 0; i < 48; i++) {
      const a = (i / 48) * 6.283, d = rad + k * 8, lx = Math.cos(a) * d, lz = Math.sin(a) * d, rd = this.roadD(lx, lz);
      if (rd >= dMin && rd <= dMax && this.free(lx, lz, 3)) { best = [lx, lz]; break; }
      if (best) break;
    }
    if (!best) best = [rad, 0];
    this.take(best[0], best[1], 3); return best;
  }
  // Yo'lga qaragan burchak (mahalliy)
  faceRoad(lx, lz) { const [x, z] = this.w(lx, lz); const nr = T.nearestRoad(x, z, 3); if (nr.edge < 0) return 0; const i = nr.i; const dx = T.roads.x[i] - x, dz = T.roads.z[i] - z; return Math.atan2(dx, dz) - this.yaw; }
  finish(scene) {
    const m = new THREE.Mesh(this.g.build(), MAT.flat); m.castShadow = true; m.receiveShadow = true; m.matrixAutoUpdate = false; scene.add(m);
    if (this.gl.count) { const q = new THREE.Mesh(withMask(this.gl.build()), glowMat()); q.matrixAutoUpdate = false; scene.add(q); }
  }
}

export function buildPlaces(scene, game) {
  const out = { places: {}, lights: [], anim: [], smash: null, points: [], ramps: [], houses: [] };
  const P = T.placeBy;
  // --- sinadigan buyumlar ---
  const SM = {};
  const smDef = { crate: [(g) => BK.crate(g, 0.9), 0.6, 1, 220], barrel: [(g) => BK.barrel(g), 0.45, 1.1, 160], hay: [(g) => BK.hay(g), 0.8, 1.3, 120], cone: [(g) => BK.cone(g), 0.3, 0.8, 260], sign: [(g) => BK.sign(g), 0.25, 1.8, 80],
    fence: [(g) => { g.color(PAL.woodD).box(-1.1, 0.55, 0, 0.14, 1.1, 0.14); g.box(1.1, 0.55, 0, 0.14, 1.1, 0.14); g.color(PAL.wood).box(0, 0.85, 0, 2.4, 0.13, 0.07); g.box(0, 0.45, 0, 2.4, 0.13, 0.07); }, 0, 1.2, 420],
    snowman: [(g) => { g.color(0xf6f9ff).blob(0.55, 1, { cy: 0.5 }); g.blob(0.4, 1, { cy: 1.25 }); g.blob(0.28, 1, { cy: 1.82 }); g.color(0xf08a2a).cyl(5, 0.06, 0, 0, 0.3); g.color(0x2a2c33).blob(0.05, 0, { cx: 0.1, cy: 1.9, cz: 0.24 }); g.blob(0.05, 0, { cx: -0.1, cy: 1.9, cz: 0.24 }); }, 0.5, 2, 30] };
  const dummy = new THREE.Object3D();
  for (const k in smDef) { const g = new GB(k.length * 13); g.jit = 0.04; smDef[k][0](g); const im = new THREE.InstancedMesh(g.build(), MAT.flat, smDef[k][3]); im.count = 0; im.castShadow = true; im.frustumCulled = false; scene.add(im); SM[k] = { im, n: 0, r: smDef[k][1], h: smDef[k][2], items: [] }; }
  const smash = (type, x, z, yaw = 0, s = 1) => {
    const S = SM[type]; if (S.n >= S.im.instanceMatrix.count) return;
    const y = T.ground(x, z, 1e9).y; const idx = S.n++;
    dummy.position.set(x, y, z); dummy.rotation.set(0, yaw, 0); dummy.scale.setScalar(s); dummy.updateMatrix(); S.im.setMatrixAt(idx, dummy.matrix); S.im.count = S.n;
    const ref = { type, idx, x, y, z, yaw, s, col: null, alive: true };
    if (type === 'fence') ref.col = COL.addSeg(x - Math.cos(yaw) * 1.2 * s, z + Math.sin(yaw) * 1.2 * s, x + Math.cos(yaw) * 1.2 * s, z - Math.sin(yaw) * 1.2 * s, 0.15, y - 1, y + 1.3, 1, ref);
    else ref.col = COL.addCircle(x, z, S.r * s, y - 1, y + S.h * s, 1, ref);
    S.items.push(ref); return ref;
  };
  out.smash = {
    types: SM, total: () => Object.values(SM).reduce((a, s) => a + s.n, 0),
    hide(ref) { if (!ref.alive) return; ref.alive = false; dummy.position.set(0, -500, 0); dummy.scale.setScalar(0.001); dummy.updateMatrix(); const S = SM[ref.type]; S.im.setMatrixAt(ref.idx, dummy.matrix); S.im.instanceMatrix.needsUpdate = true; },
    restoreAll() { for (const k in SM) { const S = SM[k]; for (const r of S.items) { if (!r.alive) { r.alive = true; r.col.dead = false; dummy.position.set(r.x, r.y, r.z); dummy.rotation.set(0, r.yaw, 0); dummy.scale.setScalar(r.s); dummy.updateMatrix(); S.im.setMatrixAt(r.idx, dummy.matrix); } } S.im.instanceMatrix.needsUpdate = true; } },
    add: smash,
  };
  const smashL = (st, type, lx, lz, yaw = 0, s = 1) => { const [x, z] = st.w(lx, lz); return smash(type, x, z, st.yaw + yaw, s); };
  const fenceLine = (st, x1, z1, x2, z2) => { const n = Math.max(1, Math.round(Math.hypot(x2 - x1, z2 - z1) / 2.45)); const yaw = Math.atan2(-(z2 - z1), x2 - x1); for (let i = 0; i < n; i++) { const t = (i + 0.5) / n; const lx = lerp(x1, x2, t), lz = lerp(z1, z2, t); if (st.roadD(lx, lz) > 2.5) smashL(st, 'fence', lx, lz, yaw); } };
  const done = (st, extra = {}) => {
    st.finish(scene);
    for (const l of st.lights) out.lights.push(l);
    const b = st.board ? st.w(st.board[0], st.board[1]) : null;
    out.places[st.p.id] = Object.assign({ id: st.p.id, name: st.p.name, x: st.p.x, z: st.p.z, y: st.p.y, r: st.p.rect ? 300 : st.p.r + 60, board: b ? { x: b[0], z: b[1] } : null }, extra);
  };
  const addBoard = (st, rad = 16) => { const b = st.roadside(rad); st.board = b; st.put(b[0], b[1], st.faceRoad(b[0], b[1]), (g, gl) => BK.board(g, gl, 0, 0, 0)); st.circ(b[0], b[1], 0.9, 3); return b; };
  const garageAt = (st, lx, lz, yaw) => {
    st.take(lx, lz, 8);
    st.put(lx, lz, yaw, (g, gl) => {
      g.color(PAL.stone).box(0, 0.15, 0, 11, 0.3, 9); g.color(0xdfe3ea).box(0, 2.5, -3.2, 10, 4.4, 2.2); g.box(-4.6, 2.5, 0.6, 0.8, 4.4, 6.0); g.box(4.6, 2.5, 0.6, 0.8, 4.4, 6.0);
      g.color(PAL.red).box(0, 4.95, 0, 10.6, 0.5, 8.8); g.color(0xffffff).box(0, 5.5, 3.6, 5.2, 1.1, 0.25); g.color(PAL.red).box(0, 5.5, 3.75, 4.6, 0.26, 0.05);
      g.color(PAL.metalD).box(-3.2, 0.9, -1.7, 1.6, 1.2, 0.7); g.color(0x2f7fd0).box(3.2, 0.7, -1.7, 1.2, 0.8, 0.8); g.color(0x202127); g.push().translate(3.6, 0.45, 2.2); g.prismX(8, 0.42, 0.3); g.pop(); g.push().translate(3.6, 0.75, 2.2).rotZ(0.3); g.prismX(8, 0.42, 0.3); g.pop();
      gl.color(PAL.lamp).box(0, 4.6, 0.5, 6, 0.1, 0.4);
      // ichki jihozlar: asboblar taxtasi, dastgoh, ko'targich, shinalar ustuni, moy bochkalari, qizil-oq ustun chiziqlari
      g.color(0x6e4a30).box(0, 2.4, -2.06, 5.2, 1.6, 0.06); g.color(PAL.metalD); for (let i = 0; i < 9; i++) g.box(-2.2 + i * 0.55, 2.3 + (i % 3) * 0.3, -2.0, 0.08, 0.5 + (i % 2) * 0.2, 0.05); g.color(PAL.red).box(1.8, 2.9, -2.0, 0.6, 0.2, 0.08);
      g.color(PAL.wood).box(0, 1.0, -1.65, 4.0, 0.1, 0.8); g.color(PAL.woodD); for (const sx of [-1.9, 1.9]) g.box(sx, 0.5, -1.65, 0.1, 1.0, 0.7); g.color(0x2f7fd0).box(-1.2, 1.18, -1.6, 0.7, 0.26, 0.36); g.color(PAL.red).box(1.0, 1.15, -1.7, 0.5, 0.2, 0.3);
      g.color(0xf0b83a); for (const sx of [-2.0, 2.0]) { g.box(sx, 1.0, 0.8, 0.3, 2.0, 0.3); g.box(sx * 0.7, 0.55, 0.8, 1.3, 0.1, 0.18); } g.color(0x2a2c33).box(0, 0.32, 0.8, 3.0, 0.04, 2.6);
      g.color(0x202127); for (let i = 0; i < 4; i++) { g.push().translate(-3.6, 0.42 + i * 0.36, 2.6); g.prism(10, 0.42, 0.42, -0.17, 0.17, { cap: true }); g.pop(); }
      g.color(0x3f9a58).cyl(8, 0.32, 0.32, 0.3, 1.2, { cap: true }); g.push().translate(-3.7, 0, -1.4); g.color(0x2f7fd0).cyl(8, 0.32, 0.32, 0.3, 1.2, { cap: true }); g.pop();
      for (const sx of [-4.6, 4.6]) for (let k = 0; k < 4; k++) { g.color(k % 2 ? PAL.red : 0xf6f6f2).box(sx, 0.5 + k * 1.1, 3.62, 0.84, 1.1, 0.06); }
    });
    { const [sx, sz] = st.w(lx + 3.74 * Math.sin(yaw), lz + 3.74 * Math.cos(yaw)); (out.signs = out.signs || []).push({ x: sx, z: sz, y: st.p.y + st.gy(lx, lz) + 5.5, yaw: st.yaw + yaw, w: 4.7, h: 1.0, text: 'USTAXONA' }); }
    st.box(lx, lz, 5.2, 1.3, yaw, 6); // orqa devor
    const c = Math.cos(yaw), s = Math.sin(yaw);
    st.box(lx - 4.6 * c + 0.6 * s, lz + 4.6 * s + 0.6 * c, 0.5, 3.0, yaw, 6); st.box(lx + 4.6 * c + 0.6 * s, lz - 4.6 * s + 0.6 * c, 0.5, 3.0, yaw, 6);
    st.light(lx + 1.5 * s, 4, lz + 1.5 * c, 0xfff0d0, 1.2);
    const [x, z] = st.w(lx + 5.5 * s, lz + 5.5 * c); return { x, z };
  };
  const houseAt = (st, lx, lz, yaw, o) => { let r; const y = st.put(lx, lz, yaw, (g, gl) => { r = BK.house(g, gl, o); }); st.box(lx, lz, r.hx, r.hz, yaw, r.top + 3); const [x, z] = st.w(lx, lz); out.houses.push({ x, z, y: st.p.y + y, yaw: st.yaw + yaw, hx: r.hx, hz: r.hz }); return r; };
  const rnd = (st, a) => a[(st.rng() * a.length) | 0];

  // ===== 1. Bog'iston qishlog'i =====
  {
    const st = new Site(P.bogiston, 0, 101);
    st.take(0, 0, 10);
    addBoard(st, 14);
    // katta hovli-qo'rg'on
    const e = st.spot(55, 95, 30, 14) || [70, 60];
    const ey = st.faceRoad(e[0], e[1]);
    st.put(e[0], e[1], ey, (g, gl) => {
      g.push().translate(0, 0, -8); BK.house(g, (gl.push(), gl.m = g.m.slice(), gl), { w: 13, d: 8, floors: 2, roof: 'hip', balcony: true, chimney: true, wall: PAL.wall[2], door: PAL.door[0] }); gl.pop(); g.pop();
      for (const [a, b, c, d] of [[-20, -18, 20, -18], [20, -18, 20, 16], [-20, 16, -20, -18], [-20, 16, -4.5, 16], [4.5, 16, 20, 16]]) BK.wall(g, a, b, c, d, 1.8, 'stone');
      g.push().translate(0, 0, 16); BK.arch(g, 5, 3.6, 1.2, PAL.wall[1]); g.color(PAL.roof[0]).box(0, 4.75, 0, 8, 0.3, 2.2); g.pop();
      // pergola (so'ri) va bog'
      g.color(PAL.woodD); for (const px of [-14, -8]) for (const pz of [2, 9]) g.box(px, 1.4, pz, 0.2, 2.8, 0.2);
      g.color(PAL.wood); for (let i = 0; i < 7; i++) g.box(-11, 2.85, 1.5 + i * 1.3, 7, 0.12, 0.14); g.box(-14, 2.75, 5.5, 0.16, 0.16, 8); g.box(-8, 2.75, 5.5, 0.16, 0.16, 8);
      g.color(0x5fae4c); for (let i = 0; i < 9; i++) g.blob(0.7, 0, { cx: -14 + (i % 4) * 2, cy: 3.05, cz: 2 + Math.floor(i / 4) * 3.2, sy: 0.4 });
      BK.tree(g, 13, 6, 1.0, 0xf7a8c4); BK.tree(g, 12, -4, 1.1, 0x5cab4a); BK.tree(g, -15, -12, 0.9, 0x2f7a52, 1); BK.tree(g, 16, -14, 0.95, 0x2f7a52, 1); BK.tree(g, 8, 11, 0.8, 0x6dbb50);
      BK.bench(g, 9, 2, -1.2); BK.well(g, 5, 8);
    });
    for (const [a, b, c, d] of [[-20, -18, 20, -18], [20, -18, 20, 16], [-20, 16, -20, -18], [-20, 16, -4.5, 16], [4.5, 16, 20, 16]]) { const c0 = Math.cos(ey), s0 = Math.sin(ey); st.seg(e[0] + a * c0 + b * s0, e[1] - a * s0 + b * c0, e[0] + c * c0 + d * s0, e[1] - c * s0 + d * c0, 2.2, 0.35); }
    { const c0 = Math.cos(ey), s0 = Math.sin(ey); st.box(e[0] - 8 * s0, e[1] - 8 * c0, 6.8, 4.3, ey, 9); st.light(e[0] + 14 * s0, 3.5, e[1] + 14 * c0, 0xffd090, 1); }
    // garaj
    const gp = st.spot(26, 60, 9, 7) || [-40, 30];
    const gar = garageAt(st, gp[0], gp[1], st.faceRoad(gp[0], gp[1]));
    // uylar
    for (let i = 0; i < 15; i++) {
      const q = st.spot(34, 138, 9.5, 7); if (!q) continue;
      const fl = st.rng() < 0.35 ? 2 : 1;
      houseAt(st, q[0], q[1], st.faceRoad(q[0], q[1]) + (st.rng() - 0.5) * 0.3, { w: 7 + st.rng() * 3, d: 6 + st.rng() * 2, floors: fl, roof: st.rng() < 0.7 ? 'gable' : 'hip', balcony: fl > 1 && st.rng() < 0.7, chimney: st.rng() < 0.5, wall: rnd(st, PAL.wall), roofC: rnd(st, PAL.roof), door: rnd(st, PAL.door) });
    }
    // maydon: quduq, rastalar
    const pl = st.spot(14, 32, 8, 5) || [20, -20];
    st.put(pl[0], pl[1], 0, (g) => { BK.well(g, 0, 0); BK.stall(g, 5, 2, -0.6, 0xe2572f); BK.stall(g, -5, 2.5, 0.5, 0x2f7fd0); BK.stall(g, 0.5, -5.5, 3.14, 0xf0b83a); BK.person(g, 4, 3.8, 2.4, 0xe2572f); BK.person(g, -3, -1.5, 0.6, 0xf2ead8); BK.bench(g, -4, -5, 0.4); });
    for (const [sx, sz, sy] of [[5, 2, -0.6], [-5, 2.5, 0.5], [0.5, -5.5, 3.14]]) st.box(pl[0] + sx, pl[1] + sz, 1.35, 0.7, sy, 2.6); // rasta ustunlari to'qnashadi
    st.circ(pl[0], pl[1], 1.2); st.light(pl[0], 3.5, pl[1], 0xffd090, 1);
    // chiroq ustunlari, daraxtlar, pichan
    for (let i = 0; i < 16; i++) { const a = (i / 16) * 6.283, d = 30 + (i % 4) * 26; const lx = Math.cos(a) * d, lz = Math.sin(a) * d; const rd = st.roadD(lx, lz); if (rd > 1.5 && rd < 9 && st.free(lx, lz, 2)) { st.take(lx, lz, 2); st.put(lx, lz, st.faceRoad(lx, lz) - 1.57, (g, gl) => BK.lampPost(g, gl, 0, 0)); st.circ(lx, lz, 0.2, 4); st.light(lx, 4, lz, 0xffd9a0, 0.9); } }
    for (let i = 0; i < 26; i++) { const q = st.spot(20, 150, 3.5, 5); if (!q) continue; const k = st.rng(); st.put(q[0], q[1], st.rng() * 6, (g) => BK.tree(g, 0, 0, 0.85 + st.rng() * 0.5, k < 0.2 ? 0xf7a8c4 : rnd(st, [0x5cab4a, 0x6dbb50, 0x4f9e48, 0x2f7a52]), k > 0.75 ? 1 : 0)); st.circ(q[0], q[1], 0.35, 6); }
    for (let i = 0; i < 12; i++) { const q = st.spot(40, 150, 2.5, 5); if (q) smashL(st, 'hay', q[0], q[1], st.rng() * 3); }
    for (let i = 0; i < 6; i++) { const q = st.spot(50, 145, 14, 4); if (q) { const a = st.rng() * 3; fenceLine(st, q[0] - Math.cos(a) * 12, q[1] - Math.sin(a) * 12, q[0] + Math.cos(a) * 12, q[1] + Math.sin(a) * 12); } }
    for (let i = 0; i < 8; i++) { const q = st.spot(15, 120, 2, 3.5); if (q) smashL(st, st.rng() < 0.5 ? 'crate' : 'barrel', q[0], q[1], st.rng() * 3); }
    done(st, { garage: gar, home: true });
  }

  // ===== 2. Mayoq =====
  {
    const p = P.mayoq, n = T.roads.nodeBy.mayoq; const st = new Site(p, Math.atan2(n.x - p.x, n.z - p.z), 202);
    st.put(0, -6, 0, (g, gl) => {
      g.color(PAL.stone).cyl(12, 5.2, 4.8, -1, 1.2, { cap: true });
      const H = 26; for (let i = 0; i < 5; i++) { g.color(i % 2 ? PAL.red : 0xf6f3ea).cyl(14, 3.6 - i * 0.36, 3.6 - (i + 1) * 0.36, 1.2 + i * H / 5, 1.2 + (i + 1) * H / 5, { shade: 0.03 }); }
      g.color(PAL.metalD).cyl(14, 2.7, 2.7, 27.2, 27.6, { cap: true }); g.color(PAL.metalD); for (let i = 0; i < 8; i++) { const a = i * 0.785; g.box(Math.sin(a) * 2.6, 28.2, Math.cos(a) * 2.6, 0.08, 1.2, 0.08); }
      gl.color(0xfff0b0).prism(8, 1.3, 1.3, 27.6, 29.6); g.color(PAL.red).cyl(10, 2.0, 0.1, 29.6, 31.2); g.color(PAL.metalD).cyl(5, 0.06, 0.03, 31.2, 32.6);
      g.color(PAL.door[0]).box(0, 2.3, 4.72, 1.3, 2.2, 0.2);
    });
    st.circ(0, -6, 5.3, 30); st.light(0, 6, 2, 0xfff0c0, 1.2);
    // mayoq tosh qoya ustida: atrofida yirik qoya bo'laklari (eshik tomoni ochiq)
    for (let i = 0; i < 14; i++) { const a = 0.55 + (i / 14) * (6.283 - 1.1) + (st.rng() - 0.5) * 0.25, d = 6.2 + st.rng() * 4.5, s = 1.6 + st.rng() * 2.4, x = Math.sin(a) * d, z = -6 + Math.cos(a) * d;
      st.put(x, z, st.rng() * 6, (g) => { g.color(rnd(st, [0x8f8a80, 0x9d988c, 0x7e7a72])).blob(s, 1, { cy: s * 0.2, sy: 0.75, jitter: 0.22, shade: 0.14 }); }, -0.4); if (s > 2.4) st.circ(x, z, s * 0.75, s * 0.9); }
    houseAt(st, -16, 6, 1.2, { w: 7, d: 6, floors: 1, roof: 'gable', chimney: true, wall: PAL.wall[0], roofC: PAL.roof[1] });
    addBoard(st, 14);
    for (let i = 0; i < 5; i++) { const q = st.spot(10, 36, 2, 3); if (q) smashL(st, i % 2 ? 'crate' : 'barrel', q[0], q[1], st.rng() * 3); }
    st.put(12, -14, 0.4, (g) => { BK.bench(g, 0, 0, 0); BK.person(g, 2, 1, -0.5, 0xf0b83a); });
    // aylanuvchi nur
    // nur: qo'shiluvchi iliq yorug'lik, chiroqdan uzoqlashgan sari so'nadi (alphaMap — uzunasiga gradient), ichida torroq yorqin o'zak
    const bTex = (() => { const cv = document.createElement('canvas'); cv.width = 4; cv.height = 128; const cx = cv.getContext('2d'), gr = cx.createLinearGradient(0, 0, 0, 128); gr.addColorStop(0, '#fff'); gr.addColorStop(0.25, '#9a9a9a'); gr.addColorStop(0.7, '#2a2a2a'); gr.addColorStop(1, '#000'); cx.fillStyle = gr; cx.fillRect(0, 0, 4, 128); return new THREE.CanvasTexture(cv); })();
    const bMat = (c) => new THREE.MeshBasicMaterial({ color: c, alphaMap: bTex, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, fog: false, blending: THREE.AdditiveBlending });
    const beam = new THREE.Group(); for (const [r, c] of [[15, 0xffd890], [6, 0xffe8b8]]) beam.add(new THREE.Mesh(new THREE.ConeGeometry(r, 150, 16, 1, true).rotateX(-Math.PI / 2).translate(0, 0, 75), bMat(c)));
    const [bx, bz] = st.w(0, -6); beam.position.set(bx, p.y + 28.6, bz); beam.rotation.order = 'YXZ'; scene.add(beam);
    out.anim.push((dt, t, night) => { const k = clamp((night - 0.3) / 0.35, 0, 1), o = k * k * (3 - 2 * k); beam.children[0].material.opacity = o * 0.22; beam.children[1].material.opacity = o * 0.3; beam.visible = o > 0.01; beam.rotation.y = t * 0.5; beam.rotation.x = 0.06; });
    done(st);
  }

  // ===== 3. Baliqchilar bandargohi =====
  {
    const p = P.bandargoh; const sea = Math.atan2(p.x, p.z); // dengiz tomoni: markazdan tashqariga
    const st = new Site(p, sea, 303); st.take(0, 0, 8);
    // iskala (dengizga)
    const L = 96, y0 = p.y + 0.15, zs = 55;
    st.g.push().translate(0, y0 - p.y, zs);
    for (let i = 0; i < L / 2; i++) { st.g.color(i % 2 ? 0xb8905e : 0xa88052).box(0, -0.1, i * 2 + 1, 6.4, 0.2, 1.92); }
    st.g.color(PAL.woodD); for (let i = 0; i <= L / 8; i++) for (const sx of [-2.9, 2.9]) { st.g.push().translate(sx, -6, i * 8); st.g.prism(6, 0.24, 0.22, 0, 6.6); st.g.pop(); }
    for (let i = 0; i < L / 8; i++) for (const sx of [-3.1, 3.1]) st.g.box(sx, 0.5, i * 8 + 4, 0.12, 0.12, 8);
    st.g.pop();
    { const [x, z] = st.w(0, zs + L / 2); T.addPatch(x, z, st.yaw, L, 6.4, y0, y0, T.SURF.WOOD); for (const sx of [-3.1, 3.1]) st.seg(sx, zs + 14, sx, zs + L, 1.4, 0.15); st.seg(-3.1, zs + L, 3.1, zs + L, 1.4, 0.15); }
    for (const [bx, bz, by, c] of [[-7, 104, 0.5, 0x2f7fd0], [7.5, 120, -0.4, 0xd8392b], [-8, 138, 0.3, 0xf0b83a], [8, 92, 0.2, 0x3f9a58]]) (out.boats = out.boats || []).push(st.w(bx, bz)), st.g.push(), BK.boat(st.g, bx, -p.y - 0.15, bz, by, c), st.g.pop();
    st.light(0, 4, 60, 0xffd9a0, 1); st.light(0, 4, 145, 0xffd9a0, 0.8);
    const gp = st.spot(24, 58, 9, 7) || [-40, -20]; const gar = garageAt(st, gp[0], gp[1], st.faceRoad(gp[0], gp[1]));
    for (let i = 0; i < 7; i++) { const q = st.spot(18, 66, 8, 6); if (q) houseAt(st, q[0], q[1], st.faceRoad(q[0], q[1]), { w: 6.5 + st.rng() * 2, d: 5.5 + st.rng(), floors: st.rng() < 0.3 ? 2 : 1, roof: 'gable', wall: rnd(st, [0xe9f1f4, 0xd8ecf2, 0xf6efe0, 0xcfe3ea]), roofC: rnd(st, [0x3a78a8, 0x2f6a98, 0xc8553a]), door: rnd(st, PAL.door), chimney: st.rng() < 0.4 }); }
    addBoard(st, 12);
    for (let i = 0; i < 14; i++) { const q = st.spot(8, 60, 1.6, 3); if (q) smashL(st, st.rng() < 0.6 ? 'crate' : 'barrel', q[0], q[1], st.rng() * 3, 0.9 + st.rng() * 0.3); }
    for (let i = 0; i < 5; i++) { const q = st.spot(14, 60, 2, 3); if (q) { st.put(q[0], q[1], st.faceRoad(q[0], q[1]) - 1.57, (g, gl) => BK.lampPost(g, gl, 0, 0)); st.light(q[0], 4, q[1], 0xffd9a0, 0.9); st.circ(q[0], q[1], 0.2, 4); } }
    st.put(6, 12, 0.5, (g) => { BK.person(g, 0, 0, 1, 0xf2ead8); BK.person(g, 1.5, 0.6, -1.8, 0x2f7fd0); g.color(PAL.woodD); for (let i = 0; i < 3; i++) g.box(-4 + i * 1.4, 1.1, -2, 0.1, 2.2, 0.1); g.color(0xcfd8d8).box(-2.6, 1.6, -2, 3.0, 1.0, 0.03); });
    done(st, { garage: gar });
  }

  // ===== 4. Oltin o'rmon (o'rmonchi qarorgohi) =====
  {
    const p = P.ormon, n = T.roads.nodeBy.ormon; const st = new Site(p, Math.atan2(n.x - p.x, n.z - p.z), 404);
    const logc = { w: 13, d: 9, floors: 2, roof: 'gable', balcony: true, chimney: true, wall: 0x9a6a42, roofC: 0x6e4a30, door: 0x3b8f6a };
    houseAt(st, 0, -22, 0, logc); st.take(0, -22, 14); st.light(0, 4, -14, 0xffc070, 1.2);
    st.put(-26, -4, 1.57, (g) => { g.color(PAL.woodD); for (const sx of [-5, 5]) for (const sz of [-3, 3]) g.box(sx, 2, sz, 0.3, 4, 0.3); g.color(0x6e4a30); g.push().rotY(1.57); g.gable(7, 11, 1.8, 4, 0.6); g.pop(); BK.logPile(g, 0, 0, 0, 4); g.color(PAL.metal).box(3.5, 1.0, 0, 0.1, 1.4, 1.4); }); st.take(-26, -4, 8); st.box(-26, -4, 3.4, 5.4, 1.57, 5);
    const gp = st.spot(16, 50, 9, 6) || [28, -6]; const gar = garageAt(st, gp[0], gp[1], st.faceRoad(gp[0], gp[1]));
    st.put(14, 6, 0, (g) => { BK.campfire(g, 0, 0); BK.bench(g, 0, -2.6, 0); BK.bench(g, 2.6, 0, -1.57); BK.person(g, -2, 0.6, 1.4, 0xb84a34); BK.person(g, 0.4, -2.2, 0, 0x3f9a58); }); st.take(14, 6, 5); st.light(14, 1.2, 6, 0xff9a40, 1.6); out.fires = out.fires || []; { const [x, z] = st.w(14, 6); out.fires.push({ x, z, y: p.y }); }
    for (let i = 0; i < 5; i++) { const q = st.spot(16, 56, 3, 4); if (q) { st.put(q[0], q[1], st.rng() * 3, (g) => BK.logPile(g, 0, 0, 0, 3)); st.box(q[0], q[1], 1.2, 1.7, 0, 2); } }
    for (let i = 0; i < 8; i++) { const q = st.spot(10, 56, 1.5, 3); if (q) smashL(st, st.rng() < 0.5 ? 'crate' : 'barrel', q[0], q[1], st.rng() * 3); }
    addBoard(st, 18);
    done(st, { garage: gar });
  }

  // ===== 5. Ko'zgu ko'l =====
  {
    const p = P.kol; const dir = Math.atan2(T.LAKE.x - p.x, T.LAKE.z - p.z); const st = new Site(p, dir, 505);
    // iskala ko'l tomonga
    const y0 = T.LAKE.y + 2.0, L = 110, z0 = 45;
    st.g.push().translate(0, y0 - p.y, z0);
    for (let i = 0; i < L / 2; i++) st.g.color(i % 2 ? 0xb8905e : 0xa88052).box(0, -0.1, i * 2 + 1, 4.6, 0.2, 1.92);
    st.g.color(PAL.woodD); for (let i = 0; i <= L / 8; i++) for (const sx of [-2.0, 2.0]) { st.g.push().translate(sx, -11, i * 8); st.g.prism(6, 0.2, 0.18, 0, 11.6); st.g.pop(); }
    st.g.pop();
    { const [x, z] = st.w(0, z0 + L / 2); T.addPatch(x, z, st.yaw, L, 4.6, y0, y0, T.SURF.WOOD); for (const sx of [-2.25, 2.25]) st.seg(sx, z0 + 24, sx, z0 + L, 1.2, 0.12); st.seg(-2.25, z0 + L, 2.25, z0 + L, 1.2, 0.12); }
    st.g.push(); BK.boat(st.g, 5, T.LAKE.y - p.y - 0.15, z0 + 78, 0.3, 0xd8392b); BK.boat(st.g, -5.5, T.LAKE.y - p.y - 0.15, z0 + 96, -0.2, 0xf2ead8); st.g.pop();
    houseAt(st, -22, -8, 0.6, { w: 8, d: 6, floors: 1, roof: 'gable', chimney: true, wall: 0xa87a4e, roofC: 0x3f7a58 }); st.take(-22, -8, 9);
    houseAt(st, 24, -10, -0.5, { w: 7, d: 5.5, floors: 1, roof: 'gable', wall: 0xb8875a, roofC: 0x6e4a30 }); st.take(24, -10, 8);
    const cf = st.spot(14, 44, 10, 7) || [8, 8]; // qarorgoh yo'ldan uzoqda (chodirlar yo'lga tushmasin)
    st.put(cf[0], cf[1], 0, (g) => { BK.campfire(g, 0, 0); BK.tent(g, -6, 2, 1.2, PAL.tent[1]); BK.tent(g, 5, 5, -0.9, PAL.tent[2]); BK.bench(g, 0, -2.8, 0); BK.person(g, 2.2, 0.3, -1.6, 0x3f9a58); });
    { const [x, z] = st.w(cf[0], cf[1]); out.fires.push({ x, z, y: p.y }); st.light(cf[0], 1.2, cf[1], 0xff9a40, 1.6); st.circ(cf[0] - 6, cf[1] + 2, 1.6, 2.2); st.circ(cf[0] + 5, cf[1] + 5, 1.6, 2.2); }
    addBoard(st, 16);
    for (let i = 0; i < 6; i++) { const q = st.spot(10, 44, 1.5, 3); if (q) smashL(st, 'crate', q[0], q[1], st.rng() * 3); }
    done(st, { rest: true });
  }

  // ===== 6. Qorli lager =====
  {
    const st = new Site(P.lager, 0, 606); st.take(0, 0, 10);
    const f = st.spot(20, 40, 10, 7) || [26, 22];
    st.put(f[0], f[1], 0, (g) => { BK.campfire(g, 0, 0); for (let i = 0; i < 3; i++) BK.bench(g, Math.sin(i * 2.1) * 3, Math.cos(i * 2.1) * 3, i * 2.1 + 3.14); BK.person(g, -2.2, 1.2, 2.0, 0xd8392b); BK.person(g, 1.8, -2.0, -0.6, 0x2f7fd0); BK.person(g, 2.4, 1.6, -2.2, 0xf0b83a); });
    { const [x, z] = st.w(f[0], f[1]); out.fires.push({ x, z, y: P.lager.y }); st.light(f[0], 1.2, f[1], 0xff9a40, 1.8); }
    for (let i = 0; i < 7; i++) { const q = st.spot(16, 62, 4.5, 6); if (!q) continue; const yw = Math.atan2(f[0] - q[0], f[1] - q[1]); st.put(q[0], q[1], yw, (g) => BK.tent(g, 0, 0, 0, PAL.tent[i % 5], 1.25)); st.circ(q[0], q[1], 1.9, 2.4); }
    const c = st.spot(28, 62, 9, 7) || [-34, -30];
    houseAt(st, c[0], c[1], st.faceRoad(c[0], c[1]), { w: 9, d: 7, floors: 1, roof: 'gable', chimney: true, wall: 0x8a5a36, roofC: 0xf2f6fc, door: 0xb84a34 }); st.light(c[0], 3, c[1] + 5, 0xffc070, 1);
    for (let i = 0; i < 4; i++) { const q = st.spot(14, 60, 2, 4); if (q) smashL(st, 'snowman', q[0], q[1], st.rng() * 6); }
    for (let i = 0; i < 6; i++) { const q = st.spot(12, 60, 1.5, 3); if (q) smashL(st, st.rng() < 0.5 ? 'crate' : 'barrel', q[0], q[1], st.rng() * 3); }
    for (let i = 0; i < 4; i++) { const q = st.spot(12, 60, 2, 3); if (q) st.put(q[0], q[1], 0, (g) => BK.flag(g, 0, 0, 5, PAL.tent[i])); }
    for (let i = 0; i < 3; i++) { const q = st.spot(14, 60, 3, 4); if (q) { st.put(q[0], q[1], st.rng() * 3, (g) => BK.logPile(g, 0, 0, 0, 3)); st.box(q[0], q[1], 1.2, 1.7, 0, 2); } }
    addBoard(st, 14);
    done(st, { rest: true });
  }

  // ===== 7. Cho'qqi rasadxonasi =====
  {
    const st = new Site(P.choqqi, 0, 707); st.take(0, 0, 9);
    const q = st.spot(18, 30, 9, 6) || [20, -16];
    st.put(q[0], q[1], 0, (g, gl) => {
      g.color(0xe8ecf2).cyl(16, 6, 6, 0, 5, { shade: 0.04 }); g.color(0xf6f8fc).blob(6, 2, { cy: 5, sy: 0.9, shade: 0.1 }); g.color(0xb8bec8).cyl(16, 6.12, 6.12, 4.85, 5.15);
      // gumbaz tirqishi: gumbaz sirtiga yopishgan qora tasma (qutisi chiqib turmaydi), ichidan teleskop tumshug'i ko'rinadi
      g.color(0x23272f); for (let k = 0; k < 9; k++) { const e0 = 0.12 + k * 0.16, e = e0 + 0.08, r = 6.03; g.push().translate(0, 5 + 5.4 * Math.sin(e), r * Math.cos(e)).rotX(-e); g.box(0, 0, 0, 1.5, 0.98, 0.1); g.pop(); }
      g.color(PAL.metal); for (const sx of [-0.85, 0.85]) for (let k = 0; k < 9; k++) { const e = 0.2 + k * 0.16; g.push().translate(sx, 5 + 5.45 * Math.sin(e), 6.07 * Math.cos(e)).rotX(-e); g.box(0, 0, 0, 0.14, 0.98, 0.12); g.pop(); }
      g.color(0xdfe3ea); g.push().translate(0, 7.2, 1.2).rotX(-0.75); g.cyl(10, 0.62, 0.55, 0, 3.6, { cap: true }); g.pop();
      g.color(PAL.door[0]).box(0, 1.1, 6.0, 1.3, 2.2, 0.2); gl.color(PAL.win); for (let i = 1; i < 8; i++) { const a = i * 0.785; gl.box(Math.sin(a) * 6.02, 2.8, Math.cos(a) * 6.02, 0.9, 0.9, 0.12); }
    }); st.circ(q[0], q[1], 6.2, 12); st.light(q[0], 3, q[1] + 8, 0xcfe0ff, 1);
    const a = st.spot(20, 36, 4, 5) || [-24, 14];
    // aloqa minorasi: beton poydevor, ingichkalashib boruvchi uch oyoqli panjara (diagonal tirgaklar), yuqorida antenna likopchasi va qizil chiroq
    st.put(a[0], a[1], 0, (g, gl) => { g.color(PAL.stoneD).box(0, 0.25, 0, 3.6, 0.5, 3.6); g.color(0xc8ccd2); const L = (i) => [Math.sin(i * 2.094), Math.cos(i * 2.094)], H = 21, R0 = 1.5, R1 = 0.35, r = (y) => R0 + (R1 - R0) * y / H;
      const rod = (p, q, t) => { const dx = q[0] - p[0], dy = q[1] - p[1], dz = q[2] - p[2], l = Math.hypot(dx, dy, dz); g.push().translate((p[0] + q[0]) / 2, (p[1] + q[1]) / 2, (p[2] + q[2]) / 2).rotY(Math.atan2(dx, dz)).rotX(Math.atan2(Math.hypot(dx, dz), dy)); g.box(0, 0, 0, t, l, t); g.pop(); };
      const P = (i, y) => { const [c, s2] = L(i); return [c * r(y), y, s2 * r(y)]; };
      for (let i = 0; i < 3; i++) { rod(P(i, 0.4), P(i, H), 0.16); for (let k = 0; k < 7; k++) { const y0 = 0.4 + k * 3, y1 = y0 + 3; rod(P(i, y0), P(i + 1, y1), 0.06); rod(P(i, y1), P(i + 1, y1), 0.07); } }
      g.color(0xf2f2f2); g.push().translate(0.5, 16.5, 0).rotZ(1.2); g.cyl(14, 1.3, 0.25, 0, 0.5); g.pop(); g.push().translate(-0.4, 13, 0.3).rotZ(-1.3); g.cyl(12, 0.9, 0.2, 0, 0.4); g.pop();
      g.color(0x8a909c).cyl(6, 0.06, 0.04, H, H + 2.6); gl.color(0xff3020).blob(0.25, 0, { cy: H + 2.7 }); });
    st.circ(a[0], a[1], 1.8, 22);
    addBoard(st, 13);
    for (let i = 0; i < 3; i++) { const z = st.spot(10, 34, 2, 3); if (z) st.put(z[0], z[1], 0, (g) => BK.flag(g, 0, 0, 6, PAL.tent[i])); }
    st.put(-8, -20, 0.4, (g) => { BK.bench(g, 0, 0, 0); BK.person(g, 2.5, 0.5, 2.6, 0xd8392b); });
    done(st);
  }

  // ===== 8. Karvonsaroy =====
  {
    const st = new Site(P.karvon, 0, 808); st.take(0, 0, 10);
    const q = st.spot(44, 62, 30, 9) || [50, 40]; const yw = st.faceRoad(q[0], q[1]);
    const W = 23;
    st.put(q[0], q[1], yw, (g, gl) => {
      for (const [a, b, c, d] of [[-W, -W, W, -W], [W, -W, W, W], [-W, W, -W, -W], [-W, W, -4, W], [4, W, W, W]]) BK.wall(g, a, b, c, d, 5.2, 'clay', 1.4);
      for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { g.push().translate(sx * W, 0, sz * W); g.color(PAL.clay).cyl(10, 3, 2.7, 0, 7.4, { shade: 0.05 }); BK.dome(g, 2.5, PAL.turq, 7.4); g.pop(); }
      g.push().translate(0, 0, W); BK.arch(g, 6, 5.2, 2.4, PAL.clay); g.color(PAL.turq).box(0, 6.6, 0, 9, 0.5, 2.6); g.color(0xf2ead8).box(0, 5.9, 1.25, 7, 0.5, 0.1); g.pop();
      // ichki bino: firuza gumbazli
      g.push().translate(0, 0, -11); g.color(PAL.clay).box(0, 3, 0, 16, 6, 9); g.color(PAL.clayD).box(0, 6.2, 0, 16.6, 0.4, 9.6); g.color(PAL.clay).cyl(12, 4.2, 4.2, 6.2, 7.6); BK.dome(g, 4.2, PAL.turq, 7.6);
      for (let i = -2; i <= 2; i++) { g.color(PAL.turqD).box(i * 3, 2.2, 4.55, 1.6, 3.2, 0.12); gl.color(PAL.win).box(i * 3, 2.4, 4.62, 1.0, 2.0, 0.06); }
      g.pop();
      BK.well(g, 0, 6); BK.stall(g, -12, 8, 1.2, 0xb84ac8); BK.stall(g, 12, 6, -1.2, 0x2fb5b0); BK.person(g, -9, 9, 1.4, 0xf2ead8); BK.person(g, 4, 9, -0.4, 0x2fb5b0);
      for (const [x, z] of [[-15, -2], [15, -3], [-14, 15], [14, 15]]) { g.push().translate(x, 0, z); g.color(0x9a7a56).cyl(6, 0.3, 0.2, 0, 6); g.color(0x4fae4e); for (let i = 0; i < 7; i++) { g.push().translate(0, 6, 0).rotY(i * 0.9).rotX(0.6); g.box(0, 0, 1.4, 0.7, 0.06, 2.8, { tx: 0.15 }); g.pop(); } g.pop(); }
    });
    { const c0 = Math.cos(yw), s0 = Math.sin(yw); const L = (a, b) => [q[0] + a * c0 + b * s0, q[1] - a * s0 + b * c0];
      for (const [a, b, c, d] of [[-W, -W, W, -W], [W, -W, W, W], [-W, W, -W, -W], [-W, W, -4, W], [4, W, W, W]]) { const A = L(a, b), Bq = L(c, d); st.seg(A[0], A[1], Bq[0], Bq[1], 6, 0.8); }
      const hb = L(0, -11); st.box(hb[0], hb[1], 8.2, 4.7, yw, 12); for (const [sx, sz, sy] of [[-12, 8, 1.2], [12, 6, -1.2]]) { const q2 = L(sx, sz); st.box(q2[0], q2[1], 1.35, 0.7, yw + sy, 2.6); } const wl = L(0, 6); st.circ(wl[0], wl[1], 1.2); const lt = L(0, 12); st.light(lt[0], 4, lt[1], 0xffc070, 1.4); const g2 = L(0, W + 6); st.light(g2[0], 4, g2[1], 0xffc070, 1); }
    // ustaxona karvonsaroy devori yonida (yolg'iz turmasin)
    let gp = null; { const c0 = Math.cos(yw), s0 = Math.sin(yw); for (const [a, b] of [[W + 10, 8], [-W - 10, 8], [W + 10, -10], [-W - 10, -10], [12, W + 12], [-12, W + 12]]) { const x = q[0] + a * c0 + b * s0, z = q[1] - a * s0 + b * c0; if (st.taken.every((t) => (t[0] === q[0] && t[1] === q[1]) || Math.hypot(t[0] - x, t[1] - z) >= t[2] + 7) && st.roadD(x, z) > 5) { gp = [x, z]; st.take(x, z, 8); break; } } }
    if (!gp) gp = st.spot(22, 60, 9, 7) || [-40, -30]; const gar = garageAt(st, gp[0], gp[1], st.faceRoad(gp[0], gp[1]));
    addBoard(st, 15);
    for (let i = 0; i < 10; i++) { const z = st.spot(12, 84, 1.6, 3); if (z) smashL(st, st.rng() < 0.5 ? 'crate' : 'barrel', z[0], z[1], st.rng() * 3); }
    done(st, { garage: gar });
  }

  // ===== 9. Qizil dara =====
  {
    const p = P.dara, n = T.roads.nodeBy.dara; const st = new Site(p, Math.atan2(n.x - p.x, n.z - p.z), 909);
    st.put(0, -16, 0, (g, gl) => { g.color(PAL.woodD); for (const sx of [-2, 2]) for (const sz of [-2, 2]) g.box(sx, 5, sz, 0.3, 10, 0.3); g.color(PAL.wood).box(0, 9.6, 0, 5.4, 0.3, 5.4); for (const [a, b, c, d] of [[-2.6, -2.6, 2.6, -2.6], [2.6, -2.6, 2.6, 2.6], [2.6, 2.6, -2.6, 2.6], [-2.6, 2.6, -2.6, -2.6]]) g.box((a + c) / 2, 10.6, (b + d) / 2, Math.abs(c - a) + 0.15, 0.12, Math.abs(d - b) + 0.15); g.color(PAL.roof[1]).hip(6, 6, 1.6, 12.2, 0.4); for (const sx of [-2.5, 2.5]) for (const sz of [-2.5, 2.5]) g.color(PAL.woodD).box(sx, 11, sz, 0.16, 2.6, 0.16); g.box(0, 4, 2, 4.2, 0.14, 0.14); g.box(0, 7, -2, 4.2, 0.14, 0.14); gl.color(PAL.lamp).box(0, 11.9, 0, 0.5, 0.3, 0.5); });
    st.box(0, -16, 2.3, 2.3, 0, 12); st.take(0, -16, 5); st.light(0, 4, -12, 0xffc070, 1.2);
    houseAt(st, -20, -4, 0.8, { w: 8, d: 6, floors: 1, roof: 'flat', wall: PAL.clay, door: PAL.door[2] }); st.take(-20, -4, 8);
    addBoard(st, 16);
    for (let i = 0; i < 9; i++) { const z = st.spot(8, 46, 1.6, 3); if (z) smashL(st, i % 3 ? 'barrel' : 'crate', z[0], z[1], st.rng() * 3); }
    st.put(14, -10, 0, (g) => { BK.campfire(g, 0, 0); BK.bench(g, 0, -2.6, 0); BK.person(g, 1.8, 0.8, -1.9, 0xb84a34); }); { const [x, z] = st.w(14, -10); out.fires.push({ x, z, y: p.y }); st.light(14, 1.2, -10, 0xff9a40, 1.6); }
    done(st);
  }

  // ===== 10. Eski aerodrom =====
  {
    const p = P.aerodrom; const st = new Site(p, 0, 1010);
    const RW = { x0: -410, x1: 410, zc: -14, hw: 15 };
    out.runway = { x0: p.x + RW.x0, x1: p.x + RW.x1, z: p.z + RW.zc, y: p.y, hw: RW.hw };
    const g = st.g;
    g.jit = 0.012; g.color(0x4a4d55).box(0, 0.06, RW.zc, RW.x1 - RW.x0, 0.12, RW.hw * 2); g.jit = 0;
    g.color(0xf2f2f2); for (let x = RW.x0 + 30; x < RW.x1 - 20; x += 26) g.box(x, 0.13, RW.zc, 12, 0.02, 0.5);
    for (const sx of [RW.x0 + 8, RW.x1 - 8]) for (let i = -4; i <= 4; i++) g.box(sx, 0.13, RW.zc + i * 2.8, 10, 0.02, 1.2);
    g.color(0xf0c030); g.box(0, 0.13, RW.zc - RW.hw + 0.6, RW.x1 - RW.x0, 0.02, 0.3); g.box(0, 0.13, RW.zc + RW.hw - 0.6, RW.x1 - RW.x0, 0.02, 0.3);
    g.jit = 0.035;
    T.surfZones.push({ rect: true, x: p.x, z: p.z + RW.zc, hx: (RW.x1 - RW.x0) / 2, hz: RW.hw, surf: T.SURF.ASPHALT });
    T.addPatch(p.x, p.z + RW.zc, Math.PI / 2, RW.x1 - RW.x0, RW.hw * 2, p.y + 0.12, p.y + 0.12, T.SURF.ASPHALT);
    // angar, minora, samolyot
    st.put(60, 30, 3.14, (g, gl) => { g.color(0x9aa2b0); for (let i = 0; i < 8; i++) { const a0 = (i / 8) * Math.PI, a1 = ((i + 1) / 8) * Math.PI; g.quad([-Math.cos(a0) * 11, Math.sin(a0) * 8, -9], [-Math.cos(a1) * 11, Math.sin(a1) * 8, -9], [-Math.cos(a1) * 11, Math.sin(a1) * 8, 9], [-Math.cos(a0) * 11, Math.sin(a0) * 8, 9]); } g.color(0x7a8290).box(0, 4, -9, 22, 8, 0.3, { tx: 0.01 }); g.color(PAL.red).box(0, 8.3, 9.1, 6, 1.0, 0.2); gl.color(PAL.lamp).box(0, 6.4, 8.6, 8, 0.16, 0.2); });
    st.box(60 - 11, 30, 0.4, 9, 0, 8); st.box(60 + 11, 30, 0.4, 9, 0, 8); st.box(60, 39, 11, 0.4, 0, 8); st.light(60, 5, 18, 0xfff0d0, 1.3);
    st.put(20, 34, 0, (g, gl) => { g.color(0xe8ecf2).box(0, 6, 0, 5, 12, 5); g.color(PAL.stoneD).box(0, 0.4, 0, 5.6, 0.8, 5.6); g.color(0xc0c6d0); for (let k = 1; k < 4; k++) g.box(0, k * 3, 0, 5.12, 0.18, 5.12); g.color(PAL.door[0]).box(0, 1.2, 2.56, 1.2, 2.2, 0.12); gl.color(PAL.win); for (let k = 1; k < 4; k++) for (const [sx, sz, ry] of [[0, 2.53, 0], [0, -2.53, 0], [2.53, 0, 1], [-2.53, 0, 1]]) if (!(k === 1 && sz > 0)) gl.box(sx, k * 3 + 1.5, sz, ry ? 0.08 : 1.1, 1.1, ry ? 1.1 : 0.08); g.color(0x8a909c); for (const [sx, sz] of [[-3.4, -3.4], [3.4, -3.4], [3.4, 3.4], [-3.4, 3.4]]) g.box(sx, 13.2, sz, 0.18, 2.4, 0.18); g.box(0, 12.1, 0, 7.4, 0.12, 7.4); g.color(0x3a4050).box(0, 13.2, 0, 7, 2.4, 7, { tx: 1.15, tz: 1.15 }); gl.color(0x9fe0ff).box(0, 13.2, 0, 7.2, 1.3, 7.2, { tx: 1.13, tz: 1.13 }); g.color(PAL.red).box(0, 14.6, 0, 8.2, 0.4, 8.2); g.color(PAL.metalD).cyl(5, 0.06, 0.03, 14.8, 18.5); gl.color(0xff3020).blob(0.25, 0, { cy: 18.6 }); });
    st.box(20, 34, 2.6, 2.6, 0, 16);
    st.put(-60, 26, 0.5, (g) => { // eski samolyot
      g.color(0xf2ead8).push().translate(0, 1.9, 0); g.prismZ(8, 0.9, 8, { r1: 0.5 }); g.pop(); g.color(0xd8392b).box(0, 2.0, 1.5, 11, 0.16, 1.7); g.box(0, 3.3, 1.5, 9.5, 0.14, 1.5); g.color(PAL.woodD); for (const sx of [-3.5, 3.5]) g.box(sx, 2.65, 1.5, 0.08, 1.3, 0.08);
      g.color(0xd8392b).box(0, 2.3, -3.6, 3.4, 0.12, 1.0); g.box(0, 2.9, -3.7, 0.12, 1.5, 0.9); g.color(0x2a2c33).box(0, 1.9, 4.1, 0.2, 2.4, 0.1); g.color(0x202127); for (const sx of [-1.1, 1.1]) { g.push().translate(sx, 0.4, 1.4); g.prismX(8, 0.4, 0.2); g.pop(); g.box(sx, 1.0, 1.4, 0.08, 1.2, 0.08); }
    }); st.circ(-60, 26, 3.6, 4);
    st.put(-20, 40, 0, (g) => { g.color(PAL.metalD).cyl(5, 0.07, 0.05, 0, 7); g.color(0xf26a2a).push().translate(0, 6.6, 0).rotZ(-1.3); g.cyl(7, 0.5, 0.2, 0, 2.6); g.pop(); });
    const gar = garageAt(st, 110, 34, 3.14);
    st.board = [-100, 40]; st.put(-100, 40, 3.14, (g, gl) => BK.board(g, gl, 0, 0, 0)); st.circ(-100, 40, 0.9, 3);
    for (let i = 0; i < 30; i++) { smashL(st, 'cone', RW.x0 + 50 + i * 25, RW.zc + (i % 2 ? 6.5 : -6.5)); if (i % 3 === 0) smashL(st, i % 2 ? 'barrel' : 'crate', RW.x0 + 62 + i * 25, RW.zc + (i % 2 ? -2 : 2), i); }
    for (let i = 0; i < 10; i++) smashL(st, i % 2 ? 'barrel' : 'crate', 30 + (i % 5) * 2.2, 22 + Math.floor(i / 5) * 2.2, i);
    done(st, { garage: gar });
  }

  // ===== 11. Ko'hna qal'a =====
  {
    const st = new Site(P.qala, 0, 1111); st.take(0, 0, 9);
    const R = 46, NS = 20;
    for (let i = 0; i < NS; i++) {
      const a0 = (i / NS) * 6.283, a1 = ((i + 1) / NS) * 6.283, am = (a0 + a1) / 2;
      const x0 = Math.cos(a0) * R, z0 = Math.sin(a0) * R, x1 = Math.cos(a1) * R, z1 = Math.sin(a1) * R;
      if (st.roadD(Math.cos(am) * R, Math.sin(am) * R) < 5.5 || st.roadD(x0, z0) < 4 || st.roadD(x1, z1) < 4) continue;
      const broken = st.rng() < 0.3, h = broken ? 2.2 + st.rng() * 2 : 6.5;
      const y = st.gy(Math.cos(am) * R, Math.sin(am) * R);
      st.g.push().translate(0, y - 0.5, 0); BK.wall(st.g, x0, z0, x1, z1, h + 0.5, 'stone', 1.6);
      if (!broken) { const len = Math.hypot(x1 - x0, z1 - z0), yaw = Math.atan2(x1 - x0, z1 - z0); st.g.push().translate(x0, 0, z0).rotY(yaw); st.g.color(PAL.wall[1]); for (let k = 0; k < 5; k++) st.g.box(0, h + 1.2, (k + 0.5) * len / 5, 1.6, 0.9, len / 10); st.g.pop(); }
      st.g.pop(); st.seg(x0, z0, x1, z1, h, 0.9);
      if (i % 5 === 0 && st.roadD(x0, z0) > 8) { st.g.push().translate(x0, y - 0.5, z0); st.g.color(PAL.wall[3]).cyl(10, 4, 3.6, 0, 10.5, { shade: 0.05 }); st.g.color(PAL.stoneD); for (let k = 0; k < 8; k++) st.g.box(Math.sin(k * 0.785) * 3.5, 11.1, Math.cos(k * 0.785) * 3.5, 1.2, 1.2, 1.2); st.g.color(PAL.roof[0]).cyl(10, 4.4, 0, 10.5, 15, { shade: 0.1 }); st.g.pop(); st.circ(x0, z0, 4.1, 12); }
    }
    const k = st.spot(14, 26, 9, 7) || [18, -16];
    st.put(k[0], k[1], st.faceRoad(k[0], k[1]), (g, gl) => { g.color(PAL.wall[3]).box(0, 5, 0, 10, 10, 9); g.color(PAL.stoneD); for (let i = -2; i <= 2; i++) { g.box(i * 2.2, 10.6, 4.2, 1.2, 1.2, 0.8); g.box(i * 2.2, 10.6, -4.2, 1.2, 1.2, 0.8); } g.color(PAL.woodD).box(0, 1.6, 4.55, 2.2, 3.2, 0.16); gl.color(PAL.win); for (const sx of [-3, 3]) gl.box(sx, 6.5, 4.52, 0.8, 1.6, 0.06); BK.flag(g, 4, -3.5, 16, PAL.red); });
    st.box(k[0], k[1], 5.2, 4.7, st.faceRoad(k[0], k[1]), 12); st.light(k[0], 4, k[1], 0xffb060, 1.4);
    // hovli: tosh plitalar, markazda quduq, arava, pichan, mashq qo'g'irchoqlari va qurol tokchasi (bo'm-bo'sh maydon emas)
    for (let x = -20; x <= 20; x += 2.2) for (let z = -20; z <= 20; z += 2.2) { const ox = x + (st.rng() - 0.5) * 0.4, oz = z + (st.rng() - 0.5) * 0.4; if (Math.hypot(ox, oz) > 21 || st.roadD(ox, oz) < 1 || !st.free(ox, oz, 0.6)) continue; st.put(ox, oz, st.rng() * 0.3, (g) => g.color(rnd(st, [0xb8ad98, 0xa89e8a, 0xc4b9a2, 0x9c927e])).box(0, 0.03, 0, 1.9 + st.rng() * 0.2, 0.08, 1.9 + st.rng() * 0.2), -0.02); }
    { const w = st.spot(4, 14, 3, 4); if (w) { st.put(w[0], w[1], 0, (g) => BK.well(g, 0, 0)); st.circ(w[0], w[1], 1.2); } }
    { const c = st.spot(8, 30, 3.5, 4); if (c) { const yw = st.rng() * 6; st.put(c[0], c[1], yw, (g) => { g.color(PAL.wood).box(0, 0.95, 0, 1.8, 0.12, 3.2); g.color(PAL.woodD); for (const sx of [-0.9, 0.9]) { g.box(sx, 1.25, 0, 0.1, 0.5, 3.2); g.push().translate(sx * 1.08, 0.62, 0.3); g.prismX(10, 0.62, 0.12); g.pop(); } g.box(0, 0.75, 2.4, 0.12, 0.12, 2.2); g.color(0xe2c460); g.push().translate(0, 1.45, -0.4); g.prismX(8, 0.5, 1.4); g.pop(); }); st.circ(c[0], c[1], 1.8, 1.6); } }
    for (let n = 0; n < 2; n++) { const d = st.spot(10, 30, 2.5, 4); if (!d) continue; st.put(d[0], d[1], st.rng() * 6, (g) => { g.color(PAL.woodD).box(0, 0.9, 0, 0.16, 1.8, 0.16); g.box(0, 1.35, 0, 1.2, 0.12, 0.12); g.color(0xd8c48a).box(0, 1.25, 0, 0.5, 0.7, 0.32); g.blob(0.22, 1, { cy: 1.82 }); g.color(PAL.woodD).box(1.6, 0.05, 0, 0.12, 0.1, 2.2); for (let q = 0; q < 4; q++) { g.color(0x8a909c).box(1.6, 0.85, -0.8 + q * 0.5, 0.05, 1.6, 0.05); } g.color(PAL.woodD).box(1.6, 1.5, 0, 0.1, 0.1, 2.2); }); st.circ(d[0], d[1], 0.4, 2); }
    for (let n = 0; n < 4; n++) { const h = st.spot(10, 34, 1.6, 4); if (h) smashL(st, 'hay', h[0], h[1], st.rng() * 3); }
    addBoard(st, 14);
    for (let i = 0; i < 4; i++) { const z = st.spot(10, 40, 2, 3.5); if (z) { st.put(z[0], z[1], 0, (g, gl) => { g.color(PAL.woodD).cyl(5, 0.09, 0.07, 0, 2.6); gl.color(0xffb040).blob(0.22, 0, { cy: 2.8, sy: 1.4 }); }); st.light(z[0], 2.8, z[1], 0xff9a40, 1.2); st.circ(z[0], z[1], 0.2, 3); } }
    for (let i = 0; i < 8; i++) { const z = st.spot(8, 42, 1.6, 3); if (z) smashL(st, i % 2 ? 'barrel' : 'crate', z[0], z[1], st.rng() * 3); }
    for (let i = 0; i < 6; i++) { const z = st.spot(10, 42, 2.4, 3); if (z) { st.put(z[0], z[1], st.rng() * 3, (g) => { g.color(PAL.wall[1]).blob(1.3, 1, { cy: 0.3, sy: 0.6, jitter: 0.2, shade: 0.12 }); }); st.circ(z[0], z[1], 1.1, 1.2); } }
    done(st);
  }

  // ===== 12. Tosh karyeri (tryuk maydoni) =====
  {
    const p = P.karyer, n = T.roads.nodeBy.karyer; const st = new Site(p, Math.atan2(n.x - p.x, n.z - p.z), 1212);
    const ramp = (lx, lz, yaw, len, wid, h, hex = 0xf0b83a) => {
      st.g.push().translate(lx, 0, lz).rotY(yaw);
      st.g.color(hex).quad([-wid / 2, 0, -len / 2], [-wid / 2, h, len / 2], [wid / 2, h, len / 2], [wid / 2, 0, -len / 2]);
      st.g.color(PAL.metalD).quad([-wid / 2, 0, -len / 2], [-wid / 2, 0, len / 2], [-wid / 2, h, len / 2], [-wid / 2, 0, -len / 2]); st.g.tri([-wid / 2, 0, len / 2], [-wid / 2, 0, -len / 2], [-wid / 2, h, len / 2]); st.g.tri([wid / 2, 0, -len / 2], [wid / 2, 0, len / 2], [wid / 2, h, len / 2]);
      st.g.quad([-wid / 2, 0, len / 2], [wid / 2, 0, len / 2], [wid / 2, h, len / 2], [-wid / 2, h, len / 2]);
      st.g.color(0x2a2c33); for (let i = 0; i < 4; i++) { const t = (i + 0.5) / 4; st.g.box(0, h * t + 0.03, -len / 2 + len * t, wid * 0.5, 0.03, 0.5); }
      st.g.pop();
      const [x, z] = st.w(lx, lz); T.addPatch(x, z, st.yaw + yaw, len, wid, p.y, p.y + h, T.SURF.WOOD);
      out.ramps.push({ x, z, yaw: st.yaw + yaw, y: p.y + h, y0: p.y, len, wid, h });
      const fx = Math.sin(yaw), fz = Math.cos(yaw); st.take(lx, lz, len / 2 + 2); st.take(lx + fx * (len / 2 + 10), lz + fz * (len / 2 + 10), 9); st.take(lx - fx * (len / 2 + 5), lz - fz * (len / 2 + 5), 4); // tramplin, qo'nish va yugurish joyi bo'sh
    };
    T.surfZones.push({ x: p.x, z: p.z, r: p.r + 18, surf: T.SURF.ROCK }); // shag'al tub: o't o'smaydi
    ramp(0, 10, 0, 16, 7, 3.6); ramp(-34, -20, 0.9, 14, 7, 2.8, 0xe2572f); ramp(36, -30, -0.7, 20, 8, 5.2, 0x2f7fd0); ramp(-10, -56, 2.4, 12, 6, 2.2, 0x3f9a58); ramp(52, 30, 2.0, 16, 7, 3.8, 0xb84ac8);
    st.put(-60, 30, 0.4, (g) => { g.color(0xf0b83a).box(0, 1.6, 0, 3.2, 2.2, 5); g.color(0x2a2c33).box(0, 0.5, 0, 3.6, 1.0, 5.6); g.color(0xf0b83a); g.push().translate(0, 2.6, 2.4).rotX(-0.7); g.box(0, 0, 3, 0.6, 0.6, 6); g.pop(); g.push().translate(0, 6.4, 6.9).rotX(0.9); g.box(0, 0, 2, 0.5, 0.5, 4.4); g.pop(); g.color(PAL.metalD).box(0, 3.6, 10.2, 1.6, 1.2, 1.4); g.color(0x9fd0e8).box(0, 2.9, -1.2, 2.2, 1.2, 1.6); });
    st.box(-60, 30, 2, 3, 0.4, 5);
    for (let i = 0; i < 9; i++) { const q = st.spot(30, 88, 5, 5); if (q) { const s = 2 + st.rng() * 3; st.put(q[0], q[1], st.rng() * 3, (g) => g.color(rnd(st, [0x9a9da6, 0x8b8e98, 0xb0a48e])).blob(s, 1, { cy: s * 0.15, sy: 0.55, jitter: 0.16, shade: 0.12 })); st.circ(q[0], q[1], s * 0.8, s * 0.6); } }
    for (const [x, z, yw, c] of [[20, 50, 0.3, 0x2f7fd0], [26, 53, 0.3, 0xd8392b], [-70, -10, 1.4, 0x3f9a58]]) { st.put(x, z, yw, (g) => { g.color(c).box(0, 1.3, 0, 2.5, 2.6, 6.1); g.color(PAL.metalD).box(0, 1.3, 3.06, 2.3, 2.3, 0.05); }); st.box(x, z, 1.3, 3.1, yw, 3); }
    addBoard(st, 60);
    for (let i = 0; i < 26; i++) { const q = st.spot(8, 86, 1.4, 2.5); if (q) smashL(st, ['cone', 'barrel', 'crate', 'cone'][i % 4], q[0], q[1], st.rng() * 3); }
    st.light(0, 6, 0, 0xfff0d0, 1.4);
    done(st);
  }

  // ===== 13. Shamol tegirmonlari =====
  {
    const st = new Site(P.tegirmon, 0, 1313); st.take(0, 0, 9);
    for (let i = 0; i < 3; i++) {
      const q = st.spot(18, 52, 9, 7); if (!q) continue;
      const yw = st.rng() * 6;
      st.put(q[0], q[1], yw, (g, gl) => { g.color(PAL.stone).cyl(10, 4.2, 3.9, -0.5, 1.2); g.color(0xf6f1e4).cyl(10, 3.8, 2.6, 1.2, 12, { shade: 0.04 }); g.color(PAL.roof[0]).cyl(10, 3.1, 0.1, 12, 15.2, { shade: 0.1 }); g.color(PAL.door[0]).box(0, 1.6, 3.75, 1.3, 2.2, 0.25); gl.color(PAL.win).box(0, 7, 3.0, 0.9, 1.1, 0.2); g.color(PAL.woodD).push().translate(0, 11.4, 2.6); g.prismZ(6, 0.3, 1.6); g.pop(); });
      st.circ(q[0], q[1], 4.1, 12);
      const bl = new GB(50 + i); bl.jit = 0.03;
      for (let k = 0; k < 4; k++) { bl.push().rotZ(k * 1.5708); bl.color(PAL.woodD).box(0, 4.2, 0, 0.22, 8.4, 0.16); bl.color(0xf2ead8).box(0.75, 4.9, 0.02, 1.3, 6.6, 0.05); bl.pop(); }
      const m = new THREE.Mesh(bl.build(), MAT.flat); m.castShadow = true;
      const [x, z] = st.w(q[0] + Math.sin(yw) * 3.5, q[1] + Math.cos(yw) * 3.5); m.position.set(x, P.tegirmon.y + st.gy(q[0], q[1]) + 11.4, z); m.rotation.order = 'YXZ'; m.rotation.y = st.yaw + yw; scene.add(m);
      // parraklar shamol zarbalariga qarab tezlashib-sekinlashadi
      const sp = 0.5 + i * 0.13; let ang = i * 0.7; out.anim.push((dt, t) => { ang += dt * sp * (0.75 + 0.18 * Math.sin(t * 0.21 + i * 1.7) + 0.07 * Math.sin(t * 0.83 + i)); m.rotation.z = ang; });
    }
    const h = st.spot(22, 52, 9, 7); if (h) houseAt(st, h[0], h[1], st.faceRoad(h[0], h[1]), { w: 9, d: 7, floors: 1, roof: 'gable', chimney: true, wall: PAL.wall[0], roofC: PAL.roof[0] });
    for (let i = 0; i < 14; i++) { const q = st.spot(10, 58, 2.5, 4); if (q) smashL(st, 'hay', q[0], q[1], st.rng() * 3); }
    for (let i = 0; i < 4; i++) { const q = st.spot(26, 58, 13, 4); if (q) { const a = st.rng() * 3; fenceLine(st, q[0] - Math.cos(a) * 11, q[1] - Math.sin(a) * 11, q[0] + Math.cos(a) * 11, q[1] + Math.sin(a) * 11); } }
    addBoard(st, 13);
    done(st);
  }

  // ===== 14. Olovtog' krateri =====
  {
    const p = P.vulqon; const dir = Math.atan2(T.VOLC.x - p.x, T.VOLC.z - p.z); const st = new Site(p, dir, 1414);
    for (let i = -3; i <= 3; i++) { st.put(i * 4, 16, 0, (g) => { g.color(PAL.metalD).box(0, 0.6, 0, 0.14, 1.2, 0.14); if (i < 3) { g.box(2, 1.1, 0, 4, 0.1, 0.1); g.box(2, 0.6, 0, 4, 0.08, 0.08); } }); }
    st.seg(-12, 16, 12, 16, 1.6, 0.2);
    addBoard(st, 12);
    st.put(-9, 8, 0.5, (g) => { BK.sign(g); }); st.put(8, 6, 0, (g) => { BK.bench(g, 0, 0, 3.14); BK.person(g, 2.6, 0, 3.4, 0xf0b83a); });
    // lava ko'li
    const ly = T.gridHeight(T.VOLC.x, T.VOLC.z) + 9;
    // lava: sheyderda shovqinli qobiq plitalari, orasida yorqin (HDR — bloom ushlaydi) oqayotgan yoriqlar, chetida qizigan hoshiya
    const LR = T.VOLC.crater * 0.82, lavaU = { uT: { value: 0 }, uR: { value: LR } };
    const lavaMat = new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false });
    lavaMat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, lavaU);
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vLp;\n').replace('#include <begin_vertex>', '#include <begin_vertex>\nvLp = position.xz;\n');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
uniform float uT; uniform float uR; varying vec2 vLp;
float lh(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float ln(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(lh(i), lh(i + vec2(1, 0)), f.x), mix(lh(i + vec2(0, 1)), lh(i + vec2(1, 1)), f.x), f.y); }
float lf(vec2 p) { float a = 0.0, w = 0.5; for (int k = 0; k < 4; k++) { a += w * ln(p); p = p * 2.03 + 7.1; w *= 0.5; } return a; }
float cell(vec2 p) { vec2 i = floor(p), f = fract(p); float d1 = 9.0, d2 = 9.0; for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) { vec2 o = vec2(float(x), float(y)); vec2 c = o + vec2(lh(i + o), lh(i + o + 3.7)) - f; float d = dot(c, c); if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d; } return sqrt(d2) - sqrt(d1); }
`).replace('#include <color_fragment>', `#include <color_fragment>
{ vec2 q = vLp * 0.045; vec2 fl = vec2(lf(q * 0.7 + uT * 0.03), lf(q * 0.7 - uT * 0.025 + 5.0)) - 0.5;
  float e = cell(q + fl * 1.3 + vec2(uT * 0.012, -uT * 0.008));
  float crack = 1.0 - smoothstep(0.015, 0.1 + 0.07 * lf(q * 3.0), e);
  float n = lf(vLp * 0.12 + uT * 0.05), r = length(vLp) / uR;
  float rim = smoothstep(0.78, 1.0, r);
  float hot = clamp(crack * (0.75 + 0.5 * n) + rim * 0.9, 0.0, 1.0);
  float pulse = 0.85 + 0.15 * sin(uT * 1.7 + n * 6.0);
  vec3 crust = mix(vec3(0.018, 0.012, 0.011), vec3(0.075, 0.022, 0.01), n * n) + vec3(0.25, 0.04, 0.0) * smoothstep(0.25, 0.0, e) * 0.5;
  vec3 glow = mix(vec3(0.9, 0.2, 0.02), vec3(1.7, 0.75, 0.16), hot * hot) * pulse;
  diffuseColor.rgb = mix(crust, glow, smoothstep(0.15, 0.75, hot)); }
`);
    };
    const lava = new THREE.Mesh(new THREE.CircleGeometry(LR, 64).rotateX(-Math.PI / 2), lavaMat); lava.position.set(T.VOLC.x, ly, T.VOLC.z); scene.add(lava);
    out.lava = { x: T.VOLC.x, z: T.VOLC.z, y: ly, r: T.VOLC.crater * 0.82 };
    out.lights.push({ x: T.VOLC.x, y: ly + 12, z: T.VOLC.z, hex: 0xff5a10, power: 3 });
    out.anim.push((dt, t) => { lavaU.uT.value = t; });
    done(st);
  }

  // ===== 15. Muzko'l (muz maydoni) =====
  {
    const p = P.muzkol; const st = new Site(p, 0, 1515);
    // muz: chokli (takrorlanuvchi) tekstura — qirov dog'lari, yoriqlar, konki izlari; o'zi nur sochmaydi (kechasi ko'k yonmaydi), osmonni xira aks ettiradi
    const iceTex = (() => { const S = 512, cv = document.createElement('canvas'); cv.width = cv.height = S; const cx = cv.getContext('2d'), rg = mulberry32(1517);
      cx.fillStyle = '#b9d9ea'; cx.fillRect(0, 0, S, S);
      const wrap = (f) => { for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) { cx.save(); cx.translate(ox, oy); f(); cx.restore(); } };
      for (let i = 0; i < 70; i++) { const x = rg() * S, y = rg() * S, r = 20 + rg() * 70, w = rg() < 0.6; wrap(() => { const gr = cx.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, w ? 'rgba(240,248,255,0.35)' : 'rgba(120,170,200,0.25)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); cx.fillStyle = gr; cx.fillRect(x - r, y - r, r * 2, r * 2); }); }
      for (let i = 0; i < 26; i++) { let x = rg() * S, y = rg() * S, a = rg() * 6.283; const pts = [[x, y]]; for (let k = 0; k < 8; k++) { a += (rg() - 0.5) * 1.2; const l = 8 + rg() * 22; x += Math.cos(a) * l; y += Math.sin(a) * l; pts.push([x, y]); } const lw = 0.6 + rg() * 1.2, white = rg() < 0.5;
        wrap(() => { cx.strokeStyle = white ? 'rgba(250,253,255,0.75)' : 'rgba(70,115,150,0.5)'; cx.lineWidth = lw; cx.beginPath(); pts.forEach((p, k) => (k ? cx.lineTo(p[0], p[1]) : cx.moveTo(p[0], p[1]))); cx.stroke(); }); }
      for (let i = 0; i < 18; i++) { const x = rg() * S, y = rg() * S, r = 40 + rg() * 160, a0 = rg() * 6.283, da = 0.4 + rg() * 1.2; wrap(() => { cx.strokeStyle = 'rgba(235,245,255,0.45)'; cx.lineWidth = 1.2; cx.beginPath(); cx.arc(x, y, r, a0, a0 + da); cx.stroke(); }); }
      const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(7, 7); t.anisotropy = 8; return t; })();
    const ice = new THREE.Mesh(new THREE.CircleGeometry(T.POND.r, 48).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xe4f2fa, map: iceTex, roughness: 0.32, metalness: 0.0, envMapIntensity: 0.8 }));
    ice.position.set(p.x, p.y + 0.06, p.z); ice.receiveShadow = true; scene.add(ice);
    T.surfZones.push({ x: p.x, z: p.z, r: T.POND.r, surf: T.SURF.ICE });
    for (let i = 0; i < 24; i++) { const a = (i / 24) * 6.283; if (i % 3 === 0) st.put(Math.cos(a) * (T.POND.r + 4), Math.sin(a) * (T.POND.r + 4), 0, (g) => BK.flag(g, 0, 0, 4.5, PAL.tent[i % 5])); else smashL(st, 'cone', Math.cos(a) * (T.POND.r + 2), Math.sin(a) * (T.POND.r + 2)); }
    for (let i = 0; i < 9; i++) { const a = i * 0.7, d = 30 + (i * 37) % 70; smashL(st, 'cone', Math.cos(a) * d, Math.sin(a) * d); }
    // taxta ko'lning eng yaqin yo'l tomonida (yo'ldan kelganda birinchi ko'rinadi)
    const nr0 = T.nearestRoad(p.x, p.z, 12), ba = nr0.edge >= 0 ? Math.atan2(T.roads.x[nr0.i] - p.x, T.roads.z[nr0.i] - p.z) : Math.PI, bs = Math.sin(ba), bc = Math.cos(ba), br = T.POND.r + 8;
    st.board = [bs * br, bc * br]; st.put(bs * br, bc * br, ba, (g, gl) => BK.board(g, gl, 0, 0, 0)); st.circ(bs * br, bc * br, 0.9, 3);
    for (let i = 0; i < 3; i++) { const t = 9 + i * 6, sx = bs * (br - 2) + bc * t, sz = bc * (br - 2) - bs * t; if (st.roadD(sx, sz) > 3) smashL(st, 'snowman', sx, sz, 0); }
    done(st);
  }
  // ===== O'yinchining uyi =====
  { const p = P.uy; out.fires = out.fires || []; const h = buildHome(scene, out, p); out.places.uy = { id: 'uy', name: p.name, x: p.x, z: p.z, y: p.y, r: 60, board: null, home: h }; }
  // ===== Yo'l yoqasidagi tramplinlar =====
  {
    const g = new GB(4242); g.jit = 0.03;
    const cols = [0xf0b83a, 0xe2572f, 0x2f7fd0, 0x3f9a58, 0xb84ac8];
    ROAD_RAMPS.forEach(([key, f, side], i) => {
      const p = edgePoint(key, f); const off = side * (p.hw + 6.2);
      const x = p.x + p.tz * off, z = p.z - p.tx * off, yaw = Math.atan2(p.tx, p.tz) + (side < 0 ? Math.PI : 0);
      const y = T.gridHeight(x, z) - 0.05, len = 13, wid = 6, h = 2.7;
      g.push().translate(x, y, z).rotY(yaw);
      g.color(cols[i % 5]).quad([-wid / 2, 0, -len / 2], [-wid / 2, h, len / 2], [wid / 2, h, len / 2], [wid / 2, 0, -len / 2]);
      g.color(PAL.metalD).tri([-wid / 2, 0, len / 2], [-wid / 2, 0, -len / 2], [-wid / 2, h, len / 2]); g.tri([wid / 2, 0, -len / 2], [wid / 2, 0, len / 2], [wid / 2, h, len / 2]);
      g.quad([-wid / 2, 0, len / 2], [wid / 2, 0, len / 2], [wid / 2, h, len / 2], [-wid / 2, h, len / 2]);
      g.color(0xffffff); for (let k = 0; k < 3; k++) { const t = (k + 0.5) / 3; g.push().translate(0, h * t + 0.04, -len / 2 + len * t).rotX(-Math.atan2(h, len)); g.box(0, 0, 0, 2.2, 0.03, 0.5); g.pop(); }
      g.color(PAL.woodD).box(wid / 2 + 0.6, 1.4, -len / 2, 0.14, 2.8, 0.14); g.color(cols[i % 5]).box(wid / 2 + 0.6, 2.5, -len / 2, 1.3, 0.7, 0.08);
      g.pop();
      T.addPatch(x, z, yaw, len, wid, y, y + h, T.SURF.WOOD);
      const fx = Math.sin(yaw), fz = Math.cos(yaw);
      T.exclusions.push({ x, z, r: 11 }, { x: x + fx * 24, z: z + fz * 24, r: 22 }, { x: x - fx * 16, z: z - fz * 16, r: 9 });
      out.ramps.push({ x, z, yaw, y: y + h, y0: y, len, wid, h, road: true });
    });
    const m = new THREE.Mesh(g.build(), MAT.flat); m.castShadow = true; m.receiveShadow = true; scene.add(m);
  }
  // ===== Manzillardagi odamlar: skeletli rig, yaqinda ko'rinadi va jonli turadi (gaplashadi, qo'l siltaydi) =====
  { const PEO = BK.PEOPLE.map((q, i) => { const rig = makeRig({ shirt: q.shirt, pants: q.pants, seed: 7000 + i * 31, long: i % 3 === 1, hair: [0x3a2a20, 0x1d1612, 0x6a4a30][i % 3] }); rig.root.position.set(q.x, q.y, q.z); rig.root.rotation.y = q.yaw; rig.root.visible = false; scene.add(rig.root); COL.addCircle(q.x, q.z, 0.3, q.y - 1, q.y + 1.8); return { rig, q, anim: i % 4 === 1 ? 'talk' : 'idle' }; });
    out.people = PEO;
    out.anim.push((dt) => { const c = game.camera && game.camera.position; if (!c) return; for (const o of PEO) { const d2 = (o.q.x - c.x) ** 2 + (o.q.z - c.z) ** 2, on = d2 < 150 * 150; o.rig.root.visible = on; if (on) poseRig(o.rig, o.anim, dt, 0); } }); }
  // ===== Hayotiy detallar: yo'l belgilari, ustunlar, simlar, chiroqlar, hovli jihozlari, tutun, bayroqlar =====
  out.details = buildDetails(scene, game, out);
  return out;
}
