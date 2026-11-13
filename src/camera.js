// Kuzatuvchi kamera: transport va piyoda rejimlari, sichqoncha bilan aylantirish, durbin, yerga kirib ketmaslik
import * as THREE from 'three';
import { clamp, angDiff } from './util.js';
import { gridHeight } from './terrain.js';

const MODES = [
  { name: 'Yaqin', dist: 8.2, h: 2.9, look: 1.1 },
  { name: 'Uzoq', dist: 13.5, h: 5.2, look: 1.0 },
  { name: 'Kapot', dist: 0, h: 0, look: 0 },
  { name: 'Kino', dist: 11, h: 2.2, look: 1.0 },
];
const FOOT = { dist: 5.4, h: 2.15, look: 1.35 };
export class ChaseCam {
  constructor(camera) {
    this.cam = camera; this.mode = 0; this.heading = 0; this.yawOff = 0; this.pitchOff = 0; this.zoom = 1;
    this.idle = 0; this.shake = 0; this.pos = new THREE.Vector3(); this.look = new THREE.Vector3(); this.orbitT = 0;
    this.first = true; this.fov = 60; this._v = new THREE.Vector3(); this.hgt = 0; this.distS = 8;
  }
  get modeName() { return MODES[this.mode].name; }
  next() { this.mode = (this.mode + 1) % MODES.length; this.yawOff = 0; this.pitchOff = 0; this.first = true; }
  snap() { this.first = true; this.yawOff = 0; this.pitchOff = 0; }
  // tgt: transport yoki piyoda (fwd, yaw, speed, v, R, nitroOn). cp: kuzatiladigan nuqta
  update(dt, tgt, cp, input, opts = {}) {
    const foot = !!opts.foot, cam = this.cam, M = foot ? FOOT : MODES[this.mode];
    const sp = Math.abs(tgt.fwd);
    // foydalanuvchi aylantirishi
    if (input && input.mouse.down && (input.mouse.dx || input.mouse.dy)) { this.yawOff -= input.mouse.dx * 0.006; this.pitchOff = clamp(this.pitchOff + input.mouse.dy * 0.004, -0.3, 1.0); this.idle = 0; }
    else { this.idle += dt; if (this.idle > (foot ? 3.5 : 2.2) && sp > (foot ? 1.5 : 3) && !opts.freeze) { const k = 1 - Math.exp(-dt * 2.2); this.yawOff -= this.yawOff * k; this.pitchOff -= this.pitchOff * k; } }
    if (input && input.mouse.wheel) this.zoom = clamp(this.zoom + input.mouse.wheel * 0.1, 0.6, 2.4);
    // yo'nalish: tezlik vektori bilan aralash
    let target = tgt.yaw;
    if (!foot && tgt.speed > 6 && tgt.fwd > 0) { const vy = Math.atan2(tgt.v[0], tgt.v[2]); target = tgt.yaw + angDiff(vy, tgt.yaw) * 0.35; }
    if (this.first) this.heading = target;
    // piyoda: kamera sekin ergashadi (yon tomonga yurganda aylanib ketmasligi uchun), transportda — tez
    const rel = Math.abs(angDiff(target, this.heading)), rate = foot ? (sp > 0.5 && rel < 2.2 ? 1.5 : 0) : 4.4 + sp * 0.09;
    this.heading += angDiff(target, this.heading) * (1 - Math.exp(-dt * rate));
    const fovT = opts.zoom ? 15 : foot ? 60 : 58 + Math.min(20, sp * 0.4) + (tgt.nitroOn ? 5 : 0);
    this.fov += (fovT - this.fov) * Math.min(1, dt * (opts.zoom || this.fov < 30 ? 9 : 3));
    if (Math.abs(cam.fov - this.fov) > 0.05) { cam.fov = this.fov; cam.updateProjectionMatrix(); }

    if (opts.zoom) { // durbin: ko'z balandligidan qaraladi
      const a = this.heading + this.yawOff; cam.position.set(cp.x, cp.y + 1.62, cp.z);
      this.look.set(cp.x + Math.sin(a) * 50, cp.y + 1.62 - this.pitchOff * 30, cp.z + Math.cos(a) * 50); cam.lookAt(this.look); return;
    }
    if (this.mode === 2 && !foot) {
      // kapot kamerasi
      const R = tgt.R, hy = (opts.hgt || 1.85) * 0.52, fz = (opts.len || 4) * 0.09;
      cam.position.set(cp.x + R[1] * hy + R[2] * fz, cp.y + R[4] * hy + R[5] * fz, cp.z + R[7] * hy + R[8] * fz);
      const a = tgt.yaw + this.yawOff;
      this.look.set(cam.position.x + R[2] * 10, cam.position.y + R[5] * 10 - 0.6 - this.pitchOff * 6, cam.position.z + R[8] * 10);
      if (this.yawOff) this.look.set(cam.position.x + Math.sin(a) * 10, cam.position.y - 0.6 - this.pitchOff * 6, cam.position.z + Math.cos(a) * 10);
      cam.up.set(R[1], R[4], R[7]); cam.lookAt(this.look); cam.up.set(0, 1, 0);
      return;
    }
    if (this.mode === 3 && !foot) this.orbitT += dt * 0.22;
    const a = this.heading + this.yawOff + (this.mode === 3 && !foot ? this.orbitT : 0);
    // transport kattaligiga qarab masofa
    const ks = foot ? 1 : clamp(0.55 + (opts.len || 4) / 8.9, 0.72, 1.75), kh = foot ? 1 : clamp((opts.hgt || 1.85) / 1.85, 0.7, 1.7);
    const distT = M.dist * this.zoom * ks * (1 + Math.min(0.25, sp * 0.006));
    if (this.first) this.distS = distT; this.distS += (distT - this.distS) * Math.min(1, dt * 5);
    const dist = this.distS, pitch = this.pitchOff;
    const hx = Math.sin(a), hz = Math.cos(a);
    const tx = cp.x - hx * dist * Math.cos(pitch), tz = cp.z - hz * dist * Math.cos(pitch);
    let ty = cp.y + M.h * this.zoom * (foot ? 1 : 0.5 + 0.5 * kh) * (0.75 + 0.25 * ks) + dist * Math.sin(pitch);
    const gy = Math.max(gridHeight(tx, tz), opts.water != null ? opts.water : -1e9) + (foot ? 0.6 : 1.1);
    if (this.first) { this.hgt = ty; this.first = false; }
    this.hgt += (ty - this.hgt) * (1 - Math.exp(-dt * (foot ? 7 : 5)));
    ty = Math.max(this.hgt, gy);
    let sx = 0, sy = 0;
    if (this.shake > 0.001) { sx = (Math.random() - 0.5) * this.shake; sy = (Math.random() - 0.5) * this.shake; this.shake *= Math.exp(-dt * 7); }
    cam.position.set(tx + sx, ty + sy, tz);
    if (foot) this.look.set(cp.x, cp.y + M.look, cp.z); else this.look.set(cp.x + hx * 2.2, cp.y + M.look * kh, cp.z + hz * 2.2);
    cam.lookAt(this.look);
  }
}
