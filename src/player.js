// Piyoda qahramon: yurish, yugurish, sakrash, suzish, to'siqlar bilan to'qnashuv, transportga chiqish/tushish
import * as THREE from 'three';
import * as T from './terrain.js';
import * as COL from './colliders.js';
import { clamp, angDiff } from './util.js';
import { makeRig, poseRig, setHat, setTool } from './rig.js';

export class Player {
  constructor(game) {
    this.game = game; this.p = [0, 0, 0]; this.v = [0, 0, 0]; this.yaw = 0; this.speed = 0; this.onFoot = false; this.grounded = true; this.swim = false; this.sit = false;
    this.lock = 0; this.lockAnim = null; this.emote = null; this.stepT = 0; this.fwd = 0; this.nitroOn = false; this.R = new Float64Array([1, 0, 0, 0, 1, 0, 0, 0, 1]);
    this.rig = makeRig({ shirt: 0xf0b83a, pants: 0x2f4a78, hair: 0x2a1d16 }); this.rig.root.visible = false; game.scene.add(this.rig.root);
    this.lamp = new THREE.SpotLight(0xfff2d8, 0, 40, 0.62, 0.6, 1.0); game.scene.add(this.lamp); game.scene.add(this.lamp.target);
    this.lampOn = false;
  }
  setHat(id) { setHat(this.rig, id); }
  // Harakatni vaqtincha band qilish (egilish, silkitish...) — tugagach fn chaqiriladi
  act(anim, secs, fn, tool) { if (this.lock > 0) return false; this.lock = secs; this.lockAnim = anim; this.lockFn = fn || null; this.sit = false; this.emote = null; if (tool !== undefined) setTool(this.rig, tool); this._tool = tool; return true; }
  setEmote(anim, tool) { this.emote = this.emote === anim ? null : anim; this.sit = false; setTool(this.rig, this.emote ? tool || null : null); }
  place(x, z, yaw) { this.p[0] = x; this.p[2] = z; this.p[1] = T.ground(x, z, 1e9).y; this.yaw = yaw; this.v[0] = this.v[1] = this.v[2] = 0; this.grounded = true; }
  // Transport yonidan bo'sh joy topish
  exitSpot(car) {
    const s = car.spec, R = car.R, p = car.p, d = s.wid / 2 + 0.85;
    const cand = [[d, 0], [-d, 0], [d, -s.len * 0.3], [-d, s.len * 0.3], [0, -s.len / 2 - 1.0], [0, s.len / 2 + 1.0], [d + 1.2, 0], [-d - 1.2, 0]];
    for (const [lx, lz] of cand) {
      const x = p[0] + R[0] * lx + R[2] * lz, z = p[2] + R[6] * lx + R[8] * lz; const gy = T.ground(x, z, p[1] + 1).y;
      if (Math.abs(gy - (p[1] - s.com)) > 2.2) continue;
      let ok = true; for (const o of COL.query(x, z, 1.2)) { if (o.y1 < gy + 0.3 || o.y0 > gy + 1.7) continue; let qx = o.x, qz = o.z; if (o.t === 1) { const sx = o.x2 - o.x, sz = o.z2 - o.z, t = clamp(((x - o.x) * sx + (z - o.z) * sz) / (sx * sx + sz * sz || 1), 0, 1); qx = o.x + sx * t; qz = o.z + sz * t; } if (Math.hypot(x - qx, z - qz) < o.r + 0.4) { ok = false; break; } }
      if (ok) return [x, z];
    }
    return [p[0] + R[0] * d, p[2] + R[6] * d];
  }
  update(dt, inp, camYaw, st) {
    const g = this.game, p = this.p, v = this.v, rig = this.rig;
    let mx = 0, mz = 0, run = false, jump = false;
    if (this.lock > 0) { this.lock -= dt; if (this.lock <= 0) { const fn = this.lockFn; this.lockFn = null; this.lockAnim = null; if (this._tool !== undefined) { setTool(rig, null); this._tool = undefined; } if (fn) fn(); } }
    else if (inp) {
      const f = (inp.down('KeyW', 'ArrowUp') ? 1 : 0) - (inp.down('KeyS', 'ArrowDown') ? 1 : 0) + (inp.touch.gas ? 1 : 0) - (inp.touch.brake ? 1 : 0), s = (inp.down('KeyA', 'ArrowLeft') ? 1 : 0) - (inp.down('KeyD', 'ArrowRight') ? 1 : 0) + (inp.touch.steer || 0);
      if (f || s) { const fx = Math.sin(camYaw), fz = Math.cos(camYaw); mx = fx * f + fz * s; mz = fz * f - fx * s; const l = Math.hypot(mx, mz); mx /= l; mz /= l; this.sit = false; this.emote = null; setTool(rig, null); }
      run = inp.down('ShiftLeft', 'ShiftRight') || inp.touch.nitro; jump = inp.hit('Space') || inp.touch.hand;
    }
    const gy0 = T.ground(p[0], p[2], p[1] + 0.7).y, wy = T.waterY(p[0], p[2]);
    this.swim = wy > gy0 + 1.2 && p[1] < wy - 0.9;
    const tired = st.energy <= 0.5; if (tired) this.tiredT = 2.5; if (this.tiredT > 0) { this.tiredT -= dt; run = false; }
    const moving = mx !== 0 || mz !== 0; run = run && moving && !this.swim;
    const vmax = this.swim ? 2.3 : run ? 7.4 : 3.7;
    const tvx = mx * vmax, tvz = mz * vmax, acc = this.grounded || this.swim ? 16 : 5;
    v[0] += clamp(tvx - v[0], -acc * dt, acc * dt); v[2] += clamp(tvz - v[2], -acc * dt, acc * dt);
    if (moving) this.yaw += angDiff(Math.atan2(mx, mz), this.yaw) * Math.min(1, dt * 11);
    if (this.swim) { v[1] += ((wy - 1.28 - p[1]) * 6 - v[1]) * Math.min(1, dt * 6); this.grounded = false; }
    else { v[1] -= 24 * dt; if (jump && this.grounded) { v[1] = 7.6; this.grounded = false; g.audio.sfx('jump'); } }
    // yangi joy
    let nx = p[0] + v[0] * dt, nz = p[2] + v[2] * dt;
    // tik qiyalikka chiqa olmaydi
    if (moving && this.grounded) { const gy1 = T.ground(nx, nz, p[1] + 0.7).y, step = Math.hypot(nx - p[0], nz - p[2]); if (gy1 - p[1] > step * 1.5 + 0.02 && gy1 - p[1] > 0.02) { nx = p[0]; nz = p[2]; v[0] *= 0.5; v[2] *= 0.5; } }
    // to'siqlar
    const near = COL.query(nx, nz, 1.6);
    for (let it = 0; it < 2; it++) for (let i = 0; i < near.length; i++) {
      const o = near[i]; if (o.dead || o.y1 < p[1] + 0.35 || o.y0 > p[1] + 1.7) continue;
      let qx = o.x, qz = o.z; if (o.t === 1) { const sx = o.x2 - o.x, sz = o.z2 - o.z, t = clamp(((nx - o.x) * sx + (nz - o.z) * sz) / (sx * sx + sz * sz || 1), 0, 1); qx = o.x + sx * t; qz = o.z + sz * t; }
      let dx = nx - qx, dz = nz - qz; const d = Math.hypot(dx, dz), pen = o.r + 0.32 - d; if (pen <= 0) continue;
      if (d < 1e-4) { dx = 1; dz = 0; } else { dx /= d; dz /= d; } nx += dx * pen; nz += dz * pen;
    }
    // transportlar (o'zimizniki va boshqalar) — oddiy doira
    { const c = g.car, R = c.R, s = c.spec; const lx = (nx - c.p[0]) * R[0] + (nz - c.p[2]) * R[6], lz = (nx - c.p[0]) * R[2] + (nz - c.p[2]) * R[8]; const hx = s.wid / 2 + 0.3, hz = s.len / 2 + 0.3;
      if (Math.abs(lx) < hx && Math.abs(lz) < hz && Math.abs(p[1] - (c.p[1] - s.com)) < s.hgt) { const ox = hx - Math.abs(lx), oz = hz - Math.abs(lz); if (ox < oz) { const k = Math.sign(lx || 1) * ox; nx += R[0] * k; nz += R[6] * k; } else { const k = Math.sign(lz || 1) * oz; nx += R[2] * k; nz += R[8] * k; } } }
    nx = clamp(nx, -3150, 3150); nz = clamp(nz, -3150, 3150);
    p[0] = nx; p[2] = nz; p[1] += v[1] * dt;
    const gy = T.ground(nx, nz, p[1] + 0.7).y;
    if (!this.swim) { if (p[1] <= gy) { if (!this.grounded && v[1] < -9) g.audio.sfx('land', 0.35); p[1] = gy; v[1] = 0; this.grounded = true; } else if (this.grounded && p[1] - gy < 0.45 && v[1] <= 0) p[1] = gy; else this.grounded = false; }
    else if (p[1] < gy) p[1] = gy;
    this.speed = Math.hypot(v[0], v[2]); this.fwd = this.speed;
    // kuch (energiya): yugurish sarflaydi, to'qlik darajasigacha tiklanadi
    if (run && this.grounded) st.energy = Math.max(0, st.energy - 5.5 * dt); else st.energy = Math.min(st.sat, st.energy + (this.sit ? 22 : moving ? 3.5 : 9) * dt);
    st.sat = Math.max(30, st.sat - dt * 0.055);
    // animatsiya
    let anim = 'idle';
    if (this.lockAnim) anim = this.lockAnim; else if (this.swim) anim = 'swim'; else if (!this.grounded) anim = 'jump'; else if (this.speed > 4.6) anim = 'run'; else if (this.speed > 0.4) anim = 'walk'; else if (this.sit) anim = 'sit'; else if (this.emote) anim = this.emote;
    poseRig(rig, anim, dt, this.speed); this.anim = anim;
    rig.root.position.set(p[0], p[1], p[2]); rig.root.rotation.y = this.yaw;
    const c = Math.cos(this.yaw), s2 = Math.sin(this.yaw); this.R[0] = c; this.R[2] = s2; this.R[6] = -s2; this.R[8] = c;
    // qadam tovushi
    if (this.grounded && this.speed > 1) { this.stepT -= dt * this.speed; if (this.stepT <= 0) { this.stepT = 2.3; g.audio.sfx('step', T.ground(nx, nz, 1e9).surf); } }
    const night = g.sky.night, Lm = this.lamp; Lm.intensity += ((this.lampOn && night > 0.2 ? 170 : 0) - Lm.intensity) * Math.min(1, dt * 8); Lm.position.set(p[0] + s2 * 0.3, p[1] + 1.4, p[2] + c * 0.3); Lm.target.position.set(p[0] + s2 * 7, p[1] + 0.1, p[2] + c * 7);
  }
}
