// Jonli dunyo: yo'ldagi boshqa mashinalar, qushlar, havo sharlari
import * as THREE from 'three';
import * as T from './terrain.js';
import { GB, MAT } from './geo.js';
import { buildVehicle, syncWheels } from './vehicles.js';
import { mulberry32, clamp } from './util.js';

export function buildLife(scene, game) {
  const out = {};
  // ---------- transport ----------
  const ring = T.pathByNodes(['vil', 'mj', 'brj', 'ormon', 'karj', 'kol', 'lager', 'west', 'karvon', 'dara', 'sw', 'vil']);
  const mid = T.pathByNodes(['vil', 'qala', 'aero', 'west']);
  const paints = [0xf2f2ee, 0x2f7fd0, 0xf0b83a, 0x3f9a58, 0x8a54c8, 0x2a2c33, 0x24b8b0];
  const cars = [];
  const mk = (path, s0, dir, i) => {
    const id = ['jip', 'sedan', 'xetch', 'pikap', 'furgon', 'jip', 'yuk', 'avtobus'][i % 8], m = buildVehicle(id); if (id === 'jip' || id === 'sedan' || id === 'xetch') m.paintMat.color.setHex(paints[i % paints.length]); m.root.remove(m.spot); m.root.remove(m.spot.target); m.root.visible = false; scene.add(m.root);
    const sp = m.spec, fake = { wheels: [0, 1, 2, 3].map((k) => ({ len: sp.free - sp.sag, spin: 0, ly: (k < 2 ? sp.rF : sp.rR) + (sp.free - sp.sag) - sp.com })), steer: 0, fwd: 0 };
    cars.push({ m, fake, half: sp.len / 2, rad: Math.max(1.4, sp.wid / 2 + 0.5), com: sp.com, rr: sp.rR, path, s: s0 * (path.length - 1), dir, v: 13, cruise: (id === 'yuk' || id === 'avtobus' ? 10 : 12) + (i % 3) * 2, stun: 0, x: 0, y: 0, z: 0, yaw: 0, spin: 0 });
  };
  for (let i = 0; i < 6; i++) mk(ring, (i + 0.4) / 6, i % 2 ? -1 : 1, i);
  mk(mid, 0.3, 1, 6); mk(mid, 0.7, -1, 7);
  out.cars = cars;
  const q = new THREE.Quaternion(), e = new THREE.Euler(0, 0, 0, 'YXZ');
  const updCars = (dt) => {
    const pc = game.car, px = pc.p[0], pz = pc.p[2], night = game.sky.night, pl = game.player, fpx = pl.onFoot ? pl.p[0] : px, fpz = pl.onFoot ? pl.p[2] : pz;
    for (const c of cars) {
      const n = c.path.length;
      // oldinda to'siq bormi (o'yinchi yoki boshqa mashina)
      let target = c.cruise;
      const fx = Math.sin(c.yaw), fz = Math.cos(c.yaw);
      const chk = (ox, oz) => { const dx = ox - c.x, dz = oz - c.z; const al = dx * fx + dz * fz, la = Math.abs(dx * fz - dz * fx); if (al > 0 && al < 20 && la < 2.6) target = Math.min(target, al < 9 ? 0 : c.cruise * (al - 9) / 11); };
      chk(px, pz); if (pl.onFoot) chk(fpx, fpz); for (const o of cars) if (o !== c) chk(o.x, o.z);
      if (c.stun > 0) { c.stun -= dt; target = 0; }
      c.v += clamp(target - c.v, -14 * dt, 4 * dt);
      c.s += c.dir * c.v * dt / 4;
      if (c.s >= n - 1) { if (c.path === ring) c.s -= n - 1; else { c.s = n - 1.01; c.dir = -1; } } else if (c.s < 0) { if (c.path === ring) c.s += n - 1; else { c.s = 0.01; c.dir = 1; } }
      const i = Math.floor(c.s), f = c.s - i, a = c.path[i], b = c.path[Math.min(n - 1, i + 1)];
      let tx = b[0] - a[0], tz = b[1] - a[1]; const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l;
      const off = -2.4 * c.dir; // o'ng tomonlama harakat
      c.x = a[0] + (b[0] - a[0]) * f + tz * off; c.z = a[1] + (b[1] - a[1]) * f - tx * off; c.y = a[2] + (b[2] - a[2]) * f + c.com + 0.02;
      c.yaw = Math.atan2(tx * c.dir, tz * c.dir);
      const d2 = (c.x - px) ** 2 + (c.z - pz) ** 2;
      const vis = (c.x - fpx) ** 2 + (c.z - fpz) ** 2 < 900 * 900; c.m.root.visible = vis;
      if (vis) {
        e.set(-Math.atan2((b[2] - a[2]) * c.dir, l), c.yaw, 0); c.m.root.position.set(c.x, c.y, c.z); c.m.root.quaternion.setFromEuler(e);
        c.spin += c.v * dt / c.rr; for (const w of c.fake.wheels) w.spin = c.spin; syncWheels(c.m, c.fake);
        if (night > 0.35) c.m.headMat.color.setRGB(2.2, 2.05, 1.6); else c.m.headMat.color.setHex(0xb8b8b0); c.m.tailMat.color.setHex(target < c.cruise * 0.5 ? 0xff2a1a : night > 0.35 ? 0xa81810 : 0x6a1410);
      }
      // o'yinchi bilan to'qnashuv
      const cr = c.rad + pc.cr; let ox = c.x, oz = c.z; { const al = clamp((px - c.x) * fx + (pz - c.z) * fz, -c.half + c.rad, c.half - c.rad); ox += fx * al; oz += fz * al; } const dd2 = (ox - px) ** 2 + (oz - pz) ** 2;
      if (dd2 < cr * cr && Math.abs(c.y - pc.p[1]) < 2.6) {
        const d = Math.sqrt(dd2) || 0.01, nx = (px - ox) / d, nz = (pz - oz) / d, pen = cr - d;
        pc.p[0] += nx * pen; pc.p[2] += nz * pen;
        const rv = (pc.v[0] - fx * c.v) * nx + (pc.v[2] - fz * c.v) * nz;
        if (rv < 0) { pc.v[0] -= nx * rv * 1.25; pc.v[2] -= nz * rv * 1.25; if (-rv > 2.5) pc.events.push({ type: 'hit', v: -rv, x: px - nx * pc.cr, z: pz - nz * pc.cr }); }
        if (c.stun <= 0) game.audio.sfx('horn'); c.stun = 2.5; c.v = 0;
      }
    }
  };
  // ---------- qushlar ----------
  const bg = new GB(9); bg.jit = 0; bg.color(0x2a2c33);
  bg.tri([0, 0, 0.25], [1.1, 0.25, -0.2], [0, 0, -0.15]); bg.tri([0, 0, -0.15], [1.1, 0.25, -0.2], [0, 0, 0.25]); bg.tri([0, 0, 0.25], [0, 0, -0.15], [-1.1, 0.25, -0.2]); bg.tri([-1.1, 0.25, -0.2], [0, 0, -0.15], [0, 0, 0.25]);
  const NB = 27, birds = new THREE.InstancedMesh(bg.build(), new THREE.MeshBasicMaterial({ color: 0x2a2c33, fog: true }), NB); birds.frustumCulled = false; scene.add(birds);
  const flocks = [0, 1, 2].map((i) => ({ cx: 0, cz: 0, r: 60 + i * 35, h: 45 + i * 22, sp: 0.22 - i * 0.04, ph: i * 2.1 }));
  const dm = new THREE.Object3D();
  const updBirds = (dt, t) => {
    const p = game.car.p, night = game.sky.night; birds.visible = night < 0.7; if (!birds.visible) return;
    flocks.forEach((f, fi) => {
      f.cx += (p[0] + Math.sin(t * 0.05 + fi * 2) * 180 - f.cx) * dt * 0.3; f.cz += (p[2] + Math.cos(t * 0.04 + fi * 3) * 180 - f.cz) * dt * 0.3;
      for (let k = 0; k < 9; k++) {
        const a = t * f.sp + f.ph + k * 0.16, r = f.r + (k % 3) * 7;
        const x = f.cx + Math.cos(a) * r, z = f.cz + Math.sin(a) * r, y = Math.max(T.gridHeight(x, z), 0) + f.h + Math.sin(t * 0.5 + k) * 4 + (k % 2) * 2;
        dm.position.set(x, y, z); dm.rotation.set(0, -a, 0.25); dm.scale.set(1.3, Math.sin(t * 7 + k * 1.3) * 1.6, 1.3); dm.updateMatrix(); birds.setMatrixAt(fi * 9 + k, dm.matrix);
      }
    });
    birds.instanceMatrix.needsUpdate = true;
  };
  // ---------- havo sharlari ----------
  const balloons = [];
  const prof = [[0, 0.16], [0.12, 0.42], [0.28, 0.72], [0.46, 0.93], [0.64, 1.0], [0.8, 0.9], [0.92, 0.62], [1.0, 0.0]];
  const mkBalloon = (x, z, alt, c1, c2, seed) => {
    const g = new GB(seed); g.jit = 0; const R = 9, H = 22, NG = 12;
    for (let s = 0; s < NG; s++) {
      g.color(s % 2 ? c1 : c2);
      const a0 = (s / NG) * 6.283, a1 = ((s + 1) / NG) * 6.283;
      for (let k = 0; k < prof.length - 1; k++) {
        const [h0, r0] = prof[k], [h1, r1] = prof[k + 1];
        const P = (a, h, r) => [Math.sin(a) * r * R, h * H, Math.cos(a) * r * R], Nn = (a, r0q, r1q) => [Math.sin(a), (r0q - r1q) * 0.8, Math.cos(a)];
        const n0 = Nn(a0, r0, r1), n1 = Nn(a1, r0, r1);
        g.triS(P(a0, h0, r0), P(a1, h0, r0), P(a1, h1, r1), n0, n1, n1, 0.86 + h0 * 0.2, 0.86 + h0 * 0.2, 0.86 + h1 * 0.2);
        if (r1 > 0.001) g.triS(P(a0, h0, r0), P(a1, h1, r1), P(a0, h1, r1), n0, n1, n0, 0.86 + h0 * 0.2, 0.86 + h1 * 0.2, 0.86 + h1 * 0.2);
      }
    }
    g.color(0x8a5a36).box(0, -4.2, 0, 2.2, 1.8, 2.2); g.color(0x4a3a2a); for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { g.push().translate(sx * 1.0, -3.3, sz * 1.0); g.box(0, 2.0, 0, 0.06, 4.6, 0.06); g.pop(); }
    const m = new THREE.Mesh(g.build(), MAT.flat); scene.add(m); balloons.push({ m, x, z, alt, ph: seed });
  };
  mkBalloon(-380, 1700, 150, 0xe2572f, 0xf7efe0, 1); mkBalloon(1500, -1300, 190, 0x2f7fd0, 0xf0b83a, 2); mkBalloon(-1900, -600, 170, 0x8a54c8, 0xf7efe0, 3); mkBalloon(1900, 700, 160, 0x3f9a58, 0xf0b83a, 4); mkBalloon(-900, 900, 210, 0xd8392b, 0x2f7fd0, 5); mkBalloon(600, 1900, 130, 0x24b8b0, 0xf7efe0, 6);
  const updBalloons = (dt, t) => { for (const b of balloons) { const a = t * 0.012 + b.ph; b.m.position.set(b.x + Math.cos(a) * 220, b.alt + Math.sin(t * 0.25 + b.ph) * 6, b.z + Math.sin(a) * 220); b.m.rotation.y = a * 0.5; } };
  out.update = (dt, t, active) => { if (active) updCars(dt); else for (const c of cars) c.m.root.visible = false; updBirds(dt, t); updBalloons(dt, t); };
  return out;
}
