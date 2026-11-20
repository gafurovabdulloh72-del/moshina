// Ko'cha mayda narsalari: muzqaymoqchi, kaptarlarga don sepish, qishloqda futbol (to'p va darvozalar), avtobus bekati (avtobus kelib to'xtaydi, boshqa manzilga olib boradi), o'tayotgan mashinalarga qo'l silkish
import * as THREE from 'three';
import * as T from './terrain.js';
import * as COL from './colliders.js';
import { GB, MAT } from './geo.js';
import { makeRig, poseRig } from './rig.js';
import { clamp, angDiff } from './util.js';

export function initKocha(game) {
  const { scene, car } = game, st = game.state, pl = game.player, L = game.live, H2 = game.hayot2, IN = game.interior;
  const K = {}; game.kocha = K;
  const toast = (m, k) => game.toast(m, k), sfx = (n, k) => game.audio.sfx(n, k), fx = () => game.fx;
  const P = game.site.places.bogiston.board, npcs = L._dbg.npcs;
  const busy = (x, z, r) => !H2.freeAt(x, z, r) || npcs.some((o) => Math.hypot(o.x - x, o.z - z) < r + 2) || H2.bld.some((b) => Math.hypot(b.cx - x, b.cz - z) < r + 6) || (game.ish && Object.values(game.ish.pts).some((n) => Math.hypot(n.x - x, n.z - z) < r + 3));
  const find = (r0, r1, rad, ok, seed) => { for (let r = r0; r < r1; r += 2.5) for (let k = 0; k < 28; k++) { const a = k * 0.2244 + r * 0.53 + seed, x = P.x + Math.cos(a) * r, z = P.z + Math.sin(a) * r, si = T.siteInfo(x, z); if (si.y < si.water + 1 || busy(x, z, rad) || !ok(x, z, si)) continue; return [x, z, si]; } return null; };
  const flat = (x, z, rx, rz, yaw, tol) => { let a = 1e9, b = -1e9; const c = Math.cos(yaw), s = Math.sin(yaw); for (const [lx, lz] of [[-rx, -rz], [rx, -rz], [rx, rz], [-rx, rz], [0, 0]]) { const h = T.gridHeight(x + lx * c + lz * s, z - lx * s + lz * c); a = Math.min(a, h); b = Math.max(b, h); } return b - a < tol ? a : null; };
  const roadYaw = (x, z) => { const nr = T.nearestRoad(x, z, 8); return nr.edge >= 0 ? Math.atan2(T.roads.x[nr.i] - x, T.roads.z[nr.i] - z) : 0; };
  const addMesh = (g) => { const m = new THREE.Mesh(g.build(), MAT.flat); m.castShadow = true; m.receiveShadow = true; scene.add(m); return m; };

  // ================= MUZQAYMOQCHI =================
  const ic = find(8, 50, 1.8, (x, z, si) => si.roadD > 2 && si.roadD < 9 && si.slope < 0.2, 3.7);
  if (ic) { const [x, z] = ic, y = T.gridHeight(x, z), yaw = roadYaw(x, z), g = new GB(2701); g.jit = 0.02; g.translate(x, y, z).rotY(yaw);
    g.color(0xf2f6fa).box(0, 0.75, 0, 1.3, 0.75, 0.7); g.color(0x4fb0ff).box(0, 0.5, 0.36, 1.3, 0.22, 0.01); g.color(0xff8ab0).box(0, 1.14, 0, 1.32, 0.04, 0.72); g.color(0xdfeef5).box(0, 1.2, 0, 1.1, 0.06, 0.55);
    for (const sx of [-1, 1]) g.color(0x2a2c33).push().translate(sx * 0.55, 0.22, 0).rotX(Math.PI / 2).cyl(10, 0.2, 0.2, -0.36, 0.36, { cap: true }).pop(); g.color(0xb9bec8).box(-0.85, 0.95, 0, 0.4, 0.04, 0.04);
    g.color(0xb9bec8).cyl(5, 0.025, 0.025, 1.2, 2.3); for (let i = 0; i < 8; i++) g.color(i % 2 ? 0xffffff : 0xff6a8a).push().rotY(i * 0.785).translate(0, 2.3, 0.45).rotX(0.45).box(0, 0, 0, 0.35, 0.03, 0.95).pop();
    for (const [c, xx] of [[0xff8ab0, -0.3], [0xfff0b0, 0], [0x8a5a36, 0.3]]) g.color(c).push().translate(xx, 1.24, 0).blob(0.09, 0, { sy: 0.6 }).pop();
    addMesh(g); COL.addBox(x, z, 0.7, 0.4, yaw, y - 1, y + 1.3); const c = Math.cos(yaw), s = Math.sin(yaw), vx = x - 0.75 * s - 0.0 * c, vz = z - 0.75 * c;
    const r = makeRig({ shirt: 0xf2f6fa, pants: 0x3d74a6, seed: 121, hair: 0x2a1d16, stache: true }); r.root.position.set(vx, T.gridHeight(vx, vz), vz); r.root.rotation.y = yaw + Math.PI; scene.add(r.root);
    COL.addCircle(vx, vz, 0.28, y - 1, y + 1.8); // sotuvchining ichidan o'tib bo'lmaydi
    K.ice = { x, z, vx, vz, yaw, rig: r, wave: 0 }; }
  K.iceOpen = () => game.hour >= 8 && game.hour < 21; // muzqaymoqchi kechasi uyiga ketadi
  K.buyIce = () => { if (st.money < 8) return toast("Pul yetarli emas (8 so'm)", 'bad'); game.addMoney(-8, 'Muzqaymoq'); K.ice.wave = 1.5; sfx('buy'); pl.act('eat', 3.2, () => { st.sat = Math.min(100, st.sat + 8); st.thirst = clamp(st.thirst + 6, 0, 100); st.energy = Math.min(100, st.energy + 4); L.count('eat'); st.stats.ice = (st.stats.ice || 0) + 1; toast('🍦 Muzqaymoq — muzdek va shirin! 😋', 'good'); }, 'icecream'); };

  // ================= KAPTARLAR =================
  const bd = find(10, 45, 2.5, (x, z, si) => si.roadD > 3 && si.slope < 0.2, 5.2), BN = 12;
  const birdIM = (() => { const g = new GB(2702); g.jit = 0; g.color(0x8a8e9a).blob(0.09, 1, { cy: 0.1, sz: 1.5, sy: 0.85 }); g.color(0x6a6e7a).blob(0.055, 0, { cy: 0.18, cz: 0.1 }); g.color(0x3f8a6a).blob(0.04, 0, { cy: 0.15, cz: 0.08 }); g.color(0xf08a3a).box(0, 0.175, 0.16, 0.015, 0.015, 0.04); g.color(0x5a5e6a).box(0, 0.1, -0.13, 0.08, 0.02, 0.1); g.color(0x7a7e8a); for (const sx of [-1, 1]) g.box(sx * 0.07, 0.12, -0.01, 0.03, 0.05, 0.14);
    const im = new THREE.InstancedMesh(g.build(), MAT.flat, BN); im.castShadow = true; im.frustumCulled = false; im.count = 0; scene.add(im); return im; })();
  const birds = []; if (bd) { const [x, z] = bd; for (let i = 0; i < BN; i++) { const a = i * 2.4, r = 0.5 + (i % 4) * 0.5; birds.push({ x: x + Math.cos(a) * r, z: z + Math.sin(a) * r, y: 0, vy: 0, yaw: a, tx: x, tz: z, wait: Math.random() * 2, fly: 0, peck: 0 }); } K.birds = { x, z, list: birds, feedT: 0 }; birdIM.count = BN; }
  K.feed = () => { const B = K.birds; pl.act('bend', 1.0, () => { B.feedT = 9; const f = [pl.p[0] + Math.sin(pl.yaw) * 1.3, pl.p[2] + Math.cos(pl.yaw) * 1.3]; B.food = f; for (const b of B.list) { b.tx = f[0] + (Math.random() - 0.5) * 1.6; b.tz = f[1] + (Math.random() - 0.5) * 1.6; b.wait = 0; b.fly = Math.hypot(b.tx - b.x, b.tz - b.z) > 3 ? 1 : 0; }
    fx().burst(14, f[0], pl.p[1] + 0.3, f[1], 1.2, 0.5, 0.12, 0xe8d8a0, 0.9, -0.4, 4, 0.5); sfx('rustle'); if ((K.karmaT || 0) < game.time) { K.karmaT = game.time + 60; L.karma(1); } st.stats.birds = (st.stats.birds || 0) + 1; toast('🕊 Kaptarlar don terishga yugurib keldi', 'good'); }); };

  // ================= FUTBOL =================
  const fb = find(25, 140, 9, (x, z, si) => si.roadD > 4 && si.roadD < 30 && si.slope < 0.08, 1.1);
  const ball = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, r: 0.22, goalT: 0 };
  const ballM = (() => { const g = new GB(2703); g.jit = 0; g.color(0xf6f6f2).blob(0.22, 2, {}); g.color(0x1d1e22); for (let i = 0; i < 12; i++) { const a = i * 2.4, b = Math.acos(1 - 2 * (i + 0.5) / 12); g.blob(0.055, 0, { cx: Math.sin(b) * Math.cos(a) * 0.205, cy: Math.cos(b) * 0.205, cz: Math.sin(b) * Math.sin(a) * 0.205, sy: 0.6 }); } const m = new THREE.Mesh(g.build(), MAT.flat); m.castShadow = true; m.visible = false; scene.add(m); return m; })();
  if (fb) { const [x, z] = fb, yaw = roadYaw(x, z) + Math.PI / 2, y = flat(x, z, 9, 5, yaw, 1.4); if (y != null) { const c = Math.cos(yaw), s = Math.sin(yaw), W = (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c];
    const g = new GB(2704); g.jit = 0.01; for (const sd of [-1, 1]) { const [gx, gz] = W(0, sd * 9), gy = T.gridHeight(gx, gz); g.push().translate(gx, gy, gz).rotY(yaw); g.color(0xf6f6f2); for (const px of [-1.5, 1.5]) g.push().translate(px, 0, 0).cyl(6, 0.05, 0.05, 0, 1.4).pop(); g.box(0, 1.4, 0, 3.1, 0.08, 0.08); g.color(0xdfe4ea); g.push().translate(0, 0.7, sd * 0.5).box(0, 0, 0, 3.0, 1.4, 0.02).pop(); g.pop(); }
    for (let i = -1; i <= 1; i++) { const [lx, lz] = W(0, i * 9), ly = T.gridHeight(lx, lz) + 0.02; g.push().translate(lx, ly, lz).rotY(yaw).color(0xf6f6f2).box(0, 0, 0, 7, 0.02, 0.1).pop(); } addMesh(g);
    for (const sd of [-1, 1]) for (const px of [-1.5, 1.5]) { const [qx, qz] = W(px, sd * 9); COL.addCircle(qx, qz, 0.08, T.gridHeight(qx, qz) - 1, T.gridHeight(qx, qz) + 1.4); }
    K.pitch = { x, z, yaw, W, c, s }; ball.x = x; ball.z = z; ball.y = T.gridHeight(x, z) + ball.r; ballM.visible = true; } }
  K.ball = ball;
  K.kick = (pow = 1) => { const a = pl.yaw; pl.act('swing', 0.42, null); ball.vx = Math.sin(a) * 11 * pow; ball.vz = Math.cos(a) * 11 * pow; ball.vy = 3.2 * pow; sfx('hit', 0.3); st.stats.kicks = (st.stats.kicks || 0) + 1; };
  const ballStep = (dt) => {
    if (!K.pitch) return; const b = ball; const gy = T.ground(b.x, b.z, b.y + 1).y + b.r;
    // qahramon oyog'i bilan surish (dribling), transport urib yuborishi
    if (pl.onFoot) { const dx = b.x - pl.p[0], dz = b.z - pl.p[2], d = Math.hypot(dx, dz); if (d < 0.55 && b.y < gy + 0.4 && pl.speed > 0.5) { const k = Math.max(pl.speed * 1.25, 2); b.vx = dx / (d || 1) * k; b.vz = dz / (d || 1) * k; } }
    { const dx = b.x - car.p[0], dz = b.z - car.p[2], d = Math.hypot(dx, dz); if (d < car.spec.len / 2 + 0.4 && car.speed > 1) { b.vx = dx / d * car.speed * 1.3; b.vz = dz / d * car.speed * 1.3; b.vy = 2.5; sfx('hit', 0.4); } }
    b.vy -= 18 * dt; b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
    if (b.y < gy) { b.y = gy; if (b.vy < -2) { b.vy = -b.vy * 0.45; sfx('land', 0.08); } else b.vy = 0; const f = Math.exp(-dt * 1.4); b.vx *= f; b.vz *= f; }
    for (const o of COL.query(b.x, b.z, 0.6)) { if (o.dead || o.y1 < b.y - 0.2 || o.y0 > b.y + 0.2) continue; let qx = o.x, qz = o.z; if (o.t === 1) { const sx = o.x2 - o.x, sz = o.z2 - o.z, t = clamp(((b.x - o.x) * sx + (b.z - o.z) * sz) / (sx * sx + sz * sz || 1), 0, 1); qx = o.x + sx * t; qz = o.z + sz * t; }
      const dx = b.x - qx, dz = b.z - qz, d = Math.hypot(dx, dz), pen = o.r + b.r - d; if (pen > 0 && d > 1e-4) { b.x += dx / d * pen; b.z += dz / d * pen; const vn = (b.vx * dx + b.vz * dz) / d; if (vn < 0) { b.vx -= 1.6 * vn * dx / d; b.vz -= 1.6 * vn * dz / d; } } }
    // gol: to'p darvoza chizig'idan o'tdi (ustunlar orasida, to'sindan past)
    const K2 = K.pitch, lx = (b.x - K2.x) * K2.c - (b.z - K2.z) * K2.s, lz = (b.x - K2.x) * K2.s + (b.z - K2.z) * K2.c;
    if (b.goalT > 0) { b.goalT -= dt; if (b.goalT <= 0) { b.x = K2.x; b.z = K2.z; b.y = T.gridHeight(K2.x, K2.z) + 1.5; b.vx = b.vy = b.vz = 0; } }
    else if (Math.abs(lz) > 9 && Math.abs(lz) < 9.6 && Math.abs(lx) < 1.45 && b.y - T.gridHeight(b.x, b.z) < 1.5) { b.goalT = 2.2; b.vx *= 0.2; b.vz *= 0.2; const rw = (K.goalCd || 0) < game.time ? 15 : 0; K.goalCd = game.time + 20; if (rw) game.addMoney(rw, 'Futbol'); st.stats.goals = (st.stats.goals || 0) + 1; sfx('win'); game.banner('GOOOL! ⚽', rw ? `Qishloq bolalari olqishlamoqda · +${rw} so'm` : 'Ajoyib zarba!', 'gold'); fx().burst(20, b.x, b.y + 0.5, b.z, 4, 1.5, 0.3, 0xffd23a, 1, 2, 2, 0); for (const o of npcs) if (Math.hypot(o.x - b.x, o.z - b.z) < 60) o.waveT = 2; }
    if (Math.hypot(b.x - K2.x, b.z - K2.z) > 70) { b.x = K2.x; b.z = K2.z; b.y = T.gridHeight(K2.x, K2.z) + 1; b.vx = b.vy = b.vz = 0; }
    ballM.position.set(b.x, b.y, b.z); const sp = Math.hypot(b.vx, b.vz); if (sp > 0.05) { ballM.rotateOnWorldAxis(_ax.set(b.vz, 0, -b.vx).normalize(), sp * dt / b.r); }
  };
  const _ax = new THREE.Vector3();

  // ================= AVTOBUS BEKATI =================
  const R = T.roads; let stop = null;
  { let best = null; for (let r = 30; r < 420 && !best; r += 10) for (let k = 0; k < 24; k++) { const a = k * 0.2618 + r * 0.37, x = P.x + Math.cos(a) * r, z = P.z + Math.sin(a) * r, nr = T.nearestRoad(x, z, 40); if (nr.edge < 0) continue; const e = R.edges[nr.edge]; if (e.type !== 0 || nr.i - e.start < 70 || e.start + e.count - nr.i < 70 || R.bridge[nr.i]) continue;
    const off = nr.hw + 2.6, sx = R.x[nr.i] - R.tz[nr.i] * off, sz = R.z[nr.i] + R.tx[nr.i] * off, si = T.siteInfo(sx, sz); if (si.y < si.water + 1 || si.slope > 0.25 || busy(sx, sz, 2.4)) continue; best = { i: nr.i, e, x: sx, z: sz, yaw: Math.atan2(R.tx[nr.i], R.tz[nr.i]) + Math.PI / 2, hw: nr.hw }; break; }
    stop = best; }
  if (stop) { const { x, z } = stop, y = T.gridHeight(x, z), g = new GB(2705); g.jit = 0.02; g.translate(x, y, z).rotY(stop.yaw + Math.PI);
    g.color(0x9a948a).box(0, 0.05, 0, 3.4, 0.1, 1.8); g.color(0x3d74a6); for (const sx of [-1.5, 1.5]) g.box(sx, 1.2, 0.7, 0.08, 2.4, 0.08); g.box(0, 2.45, 0.2, 3.5, 0.1, 1.6); g.color(0xbfe4f8).box(0, 1.3, 0.75, 3.0, 1.8, 0.03); g.color(0x3d74a6).box(0, 2.0, 0.76, 3.0, 0.3, 0.02);
    g.color(0x8a5a36).box(0, 0.45, 0.4, 2.4, 0.08, 0.45); g.box(0, 0.75, 0.62, 2.4, 0.45, 0.06); g.color(0x6e4a30); for (const sx of [-1, 1]) g.box(sx * 1.0, 0.22, 0.4, 0.06, 0.44, 0.4);
    g.color(0xb9bec8).push().translate(-2.1, 0, -0.5).cyl(6, 0.04, 0.04, 0, 2.4).pop(); g.color(0xffd23a).push().translate(-2.1, 2.3, -0.5).cyl(14, 0.25, 0.25, -0.02, 0.02, { cap: true }).pop();
    addMesh(g); const c = Math.cos(stop.yaw + Math.PI), s = Math.sin(stop.yaw + Math.PI), W = (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c]; COL.addBox(...W(0, 0.75), 1.6, 0.06, stop.yaw + Math.PI, y - 1, y + 2.4);
    const [bx, bz] = W(0, 0.25); stop.seat = { x: bx, z: bz, yaw: stop.yaw }; }
  // avtobus modeli: yo'l bo'ylab keladi, bekatda to'xtaydi, eshik ochiladi, ketadi
  const busM = (() => { const g = new GB(2706); g.jit = 0.01; g.color(0xf2f2ee).box(0, 1.55, 0, 2.5, 2.3, 9.5); g.color(0xffb030).box(0, 0.75, 0, 2.52, 0.7, 9.52); g.color(0x2a3a4a); for (const sx of [-1, 1]) g.box(sx * 1.26, 1.85, -0.3, 0.02, 0.9, 7.6); g.box(0, 1.8, 4.76, 2.2, 1.0, 0.02); g.color(0xfff4c0).box(-0.8, 0.85, 4.77, 0.35, 0.18, 0.02).box(0.8, 0.85, 4.77, 0.35, 0.18, 0.02);
    g.color(0x1d1e22); for (const z of [-3.2, 3.0]) for (const sx of [-1, 1]) g.push().translate(sx * 1.15, 0.5, z).rotZ(Math.PI / 2).cyl(12, 0.5, 0.5, -0.18, 0.18, { cap: true }).pop(); g.color(0xb9bec8).box(1.27, 1.2, 2.6, 0.02, 1.9, 1.1); g.color(0x3d74a6).box(0, 2.72, 0, 2.3, 0.12, 8.8);
    const m = new THREE.Mesh(g.build(), MAT.flat); m.castShadow = true; m.visible = false; scene.add(m);
    // kechasi yonadigan faralar, orqa chiroqlar va salon yorug'i (alohida yorituvchi to'r — yangi chiroq manbai emas)
    const l = new GB(2707); l.jit = 0; l.color(0xfff2c8).box(-0.8, 0.85, 4.79, 0.36, 0.2, 0.02).box(0.8, 0.85, 4.79, 0.36, 0.2, 0.02); l.color(0xe0281a).box(-0.9, 0.9, -4.77, 0.3, 0.2, 0.02).box(0.9, 0.9, -4.77, 0.3, 0.2, 0.02); l.color(0xffe2a6); for (const sx of [-1, 1]) l.box(sx * 1.27, 1.85, -0.3, 0.01, 0.84, 7.5);
    const lm = new THREE.Mesh(l.build(), MAT.glow); lm.visible = false; m.add(lm); m.userData.lights = lm; return m; })();
  const BUS = { on: false, k: 0, wait: 0, t: 0, side: 1 }; K.bus = BUS; K.stop = stop;
  const busPos = (k) => { const e = stop.e, i0 = clamp(Math.floor(k), e.start, e.start + e.count - 2), f = k - i0, off = stop.hw * 0.5 * BUS.side, x0 = R.x[i0] - R.tz[i0] * off, z0 = R.z[i0] + R.tx[i0] * off, x1 = R.x[i0 + 1] - R.tz[i0 + 1] * off, z1 = R.z[i0 + 1] + R.tx[i0 + 1] * off;
    const x = x0 + (x1 - x0) * f, z = z0 + (z1 - z0) * f; return [x, T.ground(x, z, 1e9).y, z, Math.atan2(x1 - x0, z1 - z0)]; };
  K.callBus = () => { if (!stop || BUS.on) return; BUS.on = true; BUS.dir = 1; BUS.side = 1; BUS.k = stop.i - 65; BUS.wait = 0; BUS.ph = 'come'; busM.visible = true; };
  // avtobus yo'l mashinalari uchun to'siq (ilgari ular uning ichidan o'tib ketardi); o'zi ham oldidagi mashinaga urilmay sekinlaydi
  const busO = { sc: { blk: null }, x: 0, z: 0, vx: 0, vz: 0, fx: 0, fz: 1, half: 4.8, halfW: 1.25, v: 0, car: null, player: false, on: false }; if (game.life && game.life.ext) game.life.ext.push(busO);
  const busGap = () => { const fx = Math.sin(busM.rotation.y), fz = Math.cos(busM.rotation.y), bx = busM.position.x, bz = busM.position.z; let g = 99; const chk = (x, z) => { const dx = x - bx, dz = z - bz, al = dx * fx + dz * fz; if (al > 0 && al < 30 && Math.abs(dx * fz - dz * fx) < 2) g = Math.min(g, al - 7); };
    for (const c of (game.life && game.life.cars) || []) if (c.placed) chk(c.x, c.z); for (const c of (game.shahar && game.shahar.cars) || []) if (c.on) chk(c.x, c.z); if (Math.hypot(car.p[0] - bx, car.p[2] - bz) < 32) chk(car.p[0], car.p[2]); return g; };
  const busStep = (dt) => { if (!BUS.on) { busO.on = false; return; } const tgt = stop.i, gk = BUS.ph === 'stop' ? 1 : clamp(busGap() / 10, 0, 1); dt *= gk;
    if (BUS.ph === 'come') { const left = tgt - BUS.k, v = Math.min(9, 1.2 + left * 0.18); BUS.k += v * dt * 0.5; if (left < 0.4) { BUS.k = tgt; BUS.ph = 'stop'; BUS.wait = 8; sfx('horn', 0.4); toast('🚌 Avtobus bekatda — [E] bilan chiqing (15 so\'m)', 'gold'); } }
    else if (BUS.ph === 'stop') { BUS.wait -= dt; if (BUS.wait <= 0) BUS.ph = 'go'; }
    else { BUS.k += Math.min(10, 1 + (BUS.k - tgt) * 0.2) * dt * 0.5; if (BUS.k > tgt + 65) { BUS.on = false; busM.visible = false; } }
    const [x, y, z, yaw] = busPos(BUS.k); busM.position.set(x, y, z); busM.rotation.y = yaw; busM.userData.lights.visible = game.sky.night > 0.25 || !!game.wxDark; busO.on = true; busO.x = x; busO.z = z; busO.fx = Math.sin(yaw); busO.fz = Math.cos(yaw); busO.v = BUS.ph === 'stop' || !dt ? 0 : 4; busO.vx = busO.fx * busO.v; busO.vz = busO.fz * busO.v; };
  K.ride = (pid) => { const p = game.site.places[pid]; if (!p || !p.board) return; if (st.money < 15) return toast("Pul yetarli emas (15 so'm)", 'bad'); game.addMoney(-15, 'Avtobus'); const f = game.ui.fade; if (f) f.style.opacity = 1; game.ui.close(); BUS.ph = 'go';
    setTimeout(() => { pl.place(p.board.x + 4, p.board.z + 3, 0); game.cam.snap(); if (f) f.style.opacity = 0; toast(`🚌 Avtobus sizni ${p.name}ga olib keldi. Transportingiz qolgan joyda — telefondan taksi chaqirsa bo'ladi`, 'good'); st.stats.bus = (st.stats.bus || 0) + 1; }, game.paused ? 0 : 420); };
  K.rideNow = (pid) => { const p = game.site.places[pid]; game.addMoney(-15, 'Avtobus'); BUS.ph = 'go'; pl.place(p.board.x + 4, p.board.z + 3, 0); st.stats.bus = (st.stats.bus || 0) + 1; }; // sinov uchun (kutishsiz)

  // ================= [E] TAKLIFLARI =================
  const ex0 = L.extra;
  L.extra = (offer, px, pz, p) => { ex0(offer, px, pz, p); if (IN.inside || (game.hayot && game.hayot.dlg)) return;
    if (K.ice) { const d = Math.hypot(K.ice.x - px, K.ice.z - pz) - 0.6; if (d < 1.8) { if (K.iceOpen()) offer(d, "<kbd>E</kbd> Muzqaymoq olish 🍦 — 8 so'm", K.buyIce); else offer(d, "<kbd>E</kbd> Muzqaymoq aravachasi 🍦 — yopiq (8:00–21:00)", () => toast('🌙 Muzqaymoqchi uyiga ketgan — ertalab soat 8 da qaytadi')); } }
    if (K.birds) { const d = Math.hypot(K.birds.x - px, K.birds.z - pz); if (d < 5 && K.birds.feedT <= 0) offer(d + 0.8, "<kbd>E</kbd> Kaptarlarga don sepish 🕊", K.feed); }
    if (K.pitch) { const d = Math.hypot(ball.x - px, ball.z - pz); if (d < 1.6 && ball.goalT <= 0) offer(d - 0.2, "<kbd>E</kbd> To'pni tepish ⚽", () => { pl.yaw += angDiff(Math.atan2(ball.x - pl.p[0], ball.z - pl.p[2]), pl.yaw) * 0.6; K.kick(); }); }
    if (stop) { const s = stop.seat, d = Math.hypot(s.x - px, s.z - pz);
      if (BUS.on && BUS.ph === 'stop' && Math.hypot(busM.position.x - px, busM.position.z - pz) < 9) offer(-0.5, "<kbd>E</kbd> Avtobusga chiqish 🚌 — 15 so'm", () => game.ui.open('avtobus'));
      else if (d < 2.2 && !(pl.sit && K.atStop)) offer(d + 0.2, "<kbd>E</kbd> Bekatda o'tirib avtobus kutish 🚏", () => { pl.p[0] = s.x; pl.p[2] = s.z; pl.yaw = s.yaw; pl.v[0] = pl.v[2] = 0; pl.sit = true; pl.emote = null; K.atStop = 1; K.waitT = 5 + Math.random() * 3; toast('🚏 Avtobus tez orada keladi…'); }); } };

  // ================= KADR =================
  const up0 = L.update;
  L.update = (dt) => { up0(dt); const px = pl.p[0], pz = pl.p[2], foot = pl.onFoot, ins = !!IN.inside;
    if (K.ice) { const d = Math.hypot(K.ice.vx - px, K.ice.vz - pz), op = K.iceOpen(); K.ice.rig.root.visible = d < 140 && !ins && op; if (!op) K.ice.wave = 0; if (d < 60) { if (K.ice.wave > 0) K.ice.wave -= dt; poseRig(K.ice.rig, K.ice.wave > 0 || (foot && d < 4) ? 'wave' : 'idle', dt, 0); } L.dots.push([K.ice.x, K.ice.z, '#ff8ab0']); }
    if (K.birds && !ins && Math.abs(K.birds.x - px) < 150 && Math.abs(K.birds.z - pz) < 150) { const B = K.birds, dm = _d; if (B.feedT > 0) B.feedT -= dt;
      for (let i = 0; i < B.list.length; i++) { const b = B.list[i], dp = Math.hypot(b.x - px, b.z - pz);
        if (b.fly <= 0 && !foot && car.speed > 3 && Math.hypot(b.x - car.p[0], b.z - car.p[2]) < 7) { b.fly = 1; b.tx = B.x + (Math.random() - 0.5) * 6; b.tz = B.z + (Math.random() - 0.5) * 6; if (i === 0) sfx('rustle', 0.6); } // mashina ustidan bostirib kelsa ham uchadi
        if (b.fly <= 0 && foot && dp < 2.6 && pl.speed > 4) { b.fly = 1; b.tx = B.x + (Math.random() - 0.5) * 6; b.tz = B.z + (Math.random() - 0.5) * 6; if (i === 0) sfx('rustle', 0.6); }
        if (b.fly <= 0 && !(B.feedT > 0) && foot && dp < 1.2 && pl.speed > 0.5) { b.tx = b.x + (b.x - px) * 2; b.tz = b.z + (b.z - pz) * 2; }
        const dx = b.tx - b.x, dz = b.tz - b.z, d = Math.hypot(dx, dz), gy = T.gridHeight(b.x, b.z);
        if (d > 0.08) { const v = b.fly > 0 ? 5 : 0.7; b.x += dx / d * Math.min(d, v * dt); b.z += dz / d * Math.min(d, v * dt); b.yaw += angDiff(Math.atan2(dx, dz), b.yaw) * Math.min(1, dt * 8); }
        else { b.fly = 0; b.wait -= dt; if (b.wait <= 0 && game.sky.night > 0.6 && !(B.feedT > 0)) b.wait = 1; /* kechasi uxlaydi — don sepilmasa joyidan qimirlamaydi */ if (b.wait <= 0) { b.wait = 0.6 + Math.random() * 2.5; const c = B.feedT > 0 && B.food ? B.food : [B.x, B.z], r = B.feedT > 0 ? 0.8 : 2.4, a = Math.random() * 6.28; b.tx = c[0] + Math.cos(a) * r * Math.random(); b.tz = c[1] + Math.sin(a) * r * Math.random(); } }
        b.y = b.fly > 0 ? Math.min(2.2, Math.sin(clamp(1 - d / 6, 0, 1) * Math.PI) * 1.8 + 0.3) : Math.abs(Math.sin(game.time * 9 + i)) * 0.03; const pk = b.fly <= 0 && d < 0.1 && game.sky.night < 0.6 && Math.sin(game.time * 7 + i * 1.3) > 0.4 ? 0.5 : 0;
        dm.position.set(b.x, gy + b.y, b.z); dm.rotation.set(pk, b.yaw, 0); dm.updateMatrix(); birdIM.setMatrixAt(i, dm.matrix); } birdIM.instanceMatrix.needsUpdate = true; }
    if (K.pitch && !ins && Math.abs(ball.x - px) < 300 && Math.abs(ball.z - pz) < 300) ballStep(dt);
    if (stop) { if (K.atStop && (!pl.sit || Math.hypot(stop.seat.x - px, stop.seat.z - pz) > 1.5)) K.atStop = 0; if (K.atStop && !BUS.on && (K.waitT -= dt) <= 0) K.callBus(); busStep(dt); if (foot && !ins && Math.hypot(stop.x - px, stop.z - pz) < 400) L.dots.push([stop.x, stop.z, '#4fb0ff']); }
    // o'tayotgan mashinaga qo'l silkish — haydovchi signal chaladi
    if (foot && pl.lockAnim === 'wave' && (K.waveCd || 0) < game.time) { const cs = [...((game.life && game.life.cars) || []).filter((c) => c.placed), ...((game.shahar && game.shahar.cars) || []).filter((c) => c.on)]; for (const c of cs) if (Math.hypot(c.x - px, c.z - pz) < 32) { K.waveCd = game.time + 6; setTimeout(() => sfx('horn', 0.5), 350); toast('🚗 Haydovchi signal chalib javob qaytardi 👋', 'good'); L.count('wave'); break; } }
  };
  const _d = new THREE.Object3D();

  // ================= AVTOBUS OYNASI =================
  const attach = (ui) => {
    ui.s_avtobus = function (w, d, btn, x) {
      x(); const pls = Object.entries(game.site.places).filter(([id, p]) => p.board && id !== 'bogiston');
      w.innerHTML = `<h1>🚌 Avtobus <small>💰 ${Math.round(st.money)} so'm · chipta 15 so'm</small></h1><p class="sub">Haydovchi: «Qayerga boramiz? Hamma bekatlar bir narx!»</p><div class="grid2">${[0, 1].map((c) => `<div>${pls.filter((q, i) => i % 2 === c).map(([id, p]) => `<div class="card" style="margin-bottom:6px;flex-direction:row;align-items:center"><div class="grow"><h4>🚏 ${p.name}</h4></div><button data-a="go:${id}" ${st.money < 15 ? 'disabled' : ''}>Borish</button></div>`).join('')}</div>`).join('')}</div>`;
      this.on({ go: (id) => K.ride(id) });
    };
  };
  let ok = false; game.hooks.push(() => { if (!ok && game.ui) { ok = true; attach(game.ui); } });
  return K;
}
