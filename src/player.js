// Piyoda qahramon: yurish, yugurish, sakrash, suzish, to'siqlar bilan to'qnashuv, transportga chiqish/tushish
import * as THREE from 'three';
import * as T from './terrain.js';
import * as COL from './colliders.js';
import { clamp, angDiff } from './util.js';
import { makeRig, poseRig, setHat, setTool, warmSkin, rigEnv } from './rig.js';

export class Player {
  constructor(game) {
    this.game = game; this.p = [0, 0, 0]; this.v = [0, 0, 0]; this.yaw = 0; this.speed = 0; this.onFoot = false; this.grounded = true; this.swim = false; this.sit = false;
    this.lock = 0; this.lockAnim = null; this.emote = null; this.stepT = 0; this.fwd = 0; this.nitroOn = false; this.R = new Float64Array([1, 0, 0, 0, 1, 0, 0, 0, 1]);
    this.rig = makeRig({ shirt: 0xf0b83a, pants: 0x2f4a78, hair: 0x2a1d16, skin: 0xdcae86, seed: 7, height: 1, build: 1, sleeve: 0.42, stache: false, player: true }); this.rig.root.visible = false; game.scene.add(this.rig.root);
    rigEnv({ cam: game.camera, player: this.rig, state: game.state }); warmSkin(game.scene); // teri sheyderi yuklanishda tayyorlanadi
    this.ctl = { vx: 0, vz: 0, vy: 0, grounded: true, swim: false, energy: 100, moveYaw: null, camYaw: 0 }; // animatsiya uchun harakat holati
    this.lamp = new THREE.SpotLight(0xfff2d8, 0, 40, 0.62, 0.6, 1.0); game.scene.add(this.lamp); game.scene.add(this.lamp.target);
    this.lampOn = false;
  }
  setHat(id) { setHat(this.rig, id); }
  // kimgadir yuzlanish: keskin sakrab emas, ~0,3 s da buriladi (gaplashish, sovg'a berish)
  faceTo(yaw) { this.faceYaw = yaw; }
  // Harakatni vaqtincha band qilish (egilish, silkitish...) — tugagach fn chaqiriladi
  act(anim, secs, fn, tool) { if (this.lock > 0) return false; this.lock = secs; this.lockAnim = anim; this.rig.actDur = secs; this.lockFn = fn || null; this.sit = false; this.emote = null; if (tool !== undefined) setTool(this.rig, tool); this._tool = tool; return true; }
  setEmote(anim, tool) { this.emote = this.emote === anim ? null : anim; this.sit = false; setTool(this.rig, this.emote ? tool || null : null); }
  place(x, z, yaw) { this.p[0] = x; this.p[2] = z; this.p[1] = T.ground(x, z, 1e9).y; this.yaw = yaw; this.faceYaw = null; this.v[0] = this.v[1] = this.v[2] = 0; this.grounded = true; }
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
  // yerga qo'nish: tushish tezligiga qarab tovush, kamera silkinishi; juda balanddan (~6 m dan) — yiqilib, o'rnidan turadi
  _land(vy, st) {
    const g = this.game; if (vy < -9) g.audio.sfx('land', clamp(0.35 + (-vy - 9) * 0.07, 0.35, 1));
    if (vy < -12 && g.cam) g.cam.shake = Math.max(g.cam.shake || 0, clamp((-vy - 12) * 0.08, 0.15, 0.7));
    if (vy < -17.5 && this.lock <= 0) { this.act('fall', 1.4, null); st.energy = Math.max(0, st.energy - 12); if ((g.time || 0) - (this._fallT || -99) > 20) { this._fallT = g.time || 0; g.toast && g.toast('Baland joydan yiqildingiz — ehtiyot bo\'ling!', 'bad'); } }
  }
  update(dt, inp, camYaw, st) {
    const g = this.game, p = this.p, v = this.v, rig = this.rig;
    let mx = 0, mz = 0, run = false, jump = false, mag = 1;
    if (this.lock > 0) { this.lock -= dt; if (this.lock <= 0) { const fn = this.lockFn; this.lockFn = null; this.lockAnim = null; if (this._tool !== undefined) { setTool(rig, null); this._tool = undefined; } if (fn) fn(); } }
    else if (inp) {
      const f = (inp.down('KeyW', 'ArrowUp') ? 1 : 0) - (inp.down('KeyS', 'ArrowDown') ? 1 : 0) + (inp.touch.gas ? 1 : 0) - (inp.touch.brake ? 1 : 0) - (inp.touch.jy || 0), s = (inp.down('KeyA', 'ArrowLeft') ? 1 : 0) - (inp.down('KeyD', 'ArrowRight') ? 1 : 0) + (inp.touch.steer || 0) - (inp.touch.jx || 0);
      if (f || s) { const fx = Math.sin(camYaw), fz = Math.cos(camYaw); mx = fx * f + fz * s; mz = fz * f - fx * s; const l = Math.hypot(mx, mz); mx /= l; mz /= l; this.sit = false; this.emote = null; setTool(rig, null);
        mag = l >= 0.98 ? 1 : 0.3 + 0.7 * clamp((l - 0.18) / 0.72, 0, 1); } // virtual joystik: oz egilsa — sekin yuradi (avval har qanday egilish to'liq tezlik edi)
      run = inp.down('ShiftLeft', 'ShiftRight') || inp.touch.nitro; jump = inp.hit('Space') || inp.touch.hand;
      if (jump && this.sit) { jump = false; if (!(g.hayot && g.hayot.seat)) this.sit = false; } // skameykada o'tirganda Probel — o'rnidan turadi (o'tirgan joyidan havoga sakrab, qo'nib yana o'tirib qolardi)
    }
    const gy0 = T.ground(p[0], p[2], p[1] + 0.7).y, wy = T.waterY(p[0], p[2]);
    this.swim = wy > gy0 + 1.2 && p[1] < wy - 0.9;
    const wade = !this.swim && wy > gy0 + 0.12; // sayoz suvda (ariq, qirg'oq) — sekinroq, chayqalib yuradi
    const runReq = run && (mx !== 0 || mz !== 0), tired = st.energy <= 0.5; if (tired) this.tiredT = 2.5; if (this.tiredT > 0) { this.tiredT -= dt; run = false; }
    const moving = mx !== 0 || mz !== 0; run = run && moving && !this.swim;
    const vmax = (this.swim ? 2.3 : run ? 7.4 : 3.7) * (this.speedMul || 1) * mag * (wade && !this.swim ? 0.72 : 1); // speedMul — charchoqda biroz sekinroq (kun.js)
    const tvx = mx * vmax, tvz = mz * vmax, acc = this.grounded || this.swim ? 16 : 5;
    v[0] += clamp(tvx - v[0], -acc * dt, acc * dt); v[2] += clamp(tvz - v[2], -acc * dt, acc * dt);
    if (moving) { this.yaw += angDiff(Math.atan2(mx, mz), this.yaw) * Math.min(1, dt * 11); this.faceYaw = null; }
    else if (this.faceYaw != null) { const d = angDiff(this.faceYaw, this.yaw); this.yaw += d * Math.min(1, dt * 10); if (Math.abs(d) < 0.01) this.faceYaw = null; }
    if (this.swim) { v[1] += ((wy - 1.28 - p[1]) * 6 - v[1]) * Math.min(1, dt * 6); this.grounded = false; }
    else { v[1] -= 24 * dt; if (jump && this.grounded) { const tir = this.tiredT > 0; v[1] = tir ? 5.6 : 7.6; this.grounded = false; st.energy = Math.max(0, st.energy - 2.5); g.audio.sfx('jump'); } } // sakrash biroz kuch oladi; charchaganda pastroq sakraydi
    // yangi joy
    let nx = p[0] + v[0] * dt, nz = p[2] + v[2] * dt;
    // tik qiyalikka chiqa olmaydi
    if (moving && this.grounded) { const gy1 = T.ground(nx, nz, p[1] + 0.7).y, step = Math.hypot(nx - p[0], nz - p[2]); if (gy1 - p[1] > step * 1.5 + 0.02 && gy1 - p[1] > 0.02) {
        // qiyalik bo'ylab sirpanib o'tadi (avval butunlay to'xtab qolardi — tepalik etagida "yopishib" qolish): harakatdan yuqoriga qaragan qismi olib tashlanadi
        const e = 0.4, gx = T.ground(p[0] + e, p[2], p[1] + 0.7).y - T.ground(p[0] - e, p[2], p[1] + 0.7).y, gz = T.ground(p[0], p[2] + e, p[1] + 0.7).y - T.ground(p[0], p[2] - e, p[1] + 0.7).y, gl = Math.hypot(gx, gz);
        let ok = false; if (gl > 1e-5) { const ux = gx / gl, uz = gz / gl, dx = nx - p[0], dz = nz - p[2], k = dx * ux + dz * uz; if (k > 0) { const sx = p[0] + (dx - ux * k) * 0.85, sz = p[2] + (dz - uz * k) * 0.85, s2 = Math.hypot(sx - p[0], sz - p[2]), gy2 = T.ground(sx, sz, p[1] + 0.7).y; if (s2 > 1e-3 && !(gy2 - p[1] > s2 * 1.5 + 0.02 && gy2 - p[1] > 0.02)) { nx = sx; nz = sz; ok = true; } } }
        if (!ok) { nx = p[0]; nz = p[2]; } v[0] *= 0.5; v[2] *= 0.5; } }
    // to'siqlar
    const near = COL.query(nx, nz, 1.6);
    const seated = this.sit || this.lockAnim === 'lie' || this.lockAnim === 'eat'; // mebelda o'tirgan/yotgan — mebel to'sig'i itarmaydi
    if (!seated) for (let it = 0; it < 2; it++) for (let i = 0; i < near.length; i++) {
      const o = near[i]; if (o.dead || o.y1 < p[1] + 0.35 || o.y0 > p[1] + 1.7) continue;
      let qx = o.x, qz = o.z; if (o.t === 1) { const sx = o.x2 - o.x, sz = o.z2 - o.z, t = clamp(((nx - o.x) * sx + (nz - o.z) * sz) / (sx * sx + sz * sz || 1), 0, 1); qx = o.x + sx * t; qz = o.z + sz * t; }
      let dx = nx - qx, dz = nz - qz; const d = Math.hypot(dx, dz), pen = o.r + 0.32 - d; if (pen <= 0) continue;
      if (d < 1e-4) { dx = 1; dz = 0; } else { dx /= d; dz /= d; } nx += dx * pen; nz += dz * pen;
    }
    // odamlar (qishloq aholisi, yo'lovchilar, ko'cha piyodalari) — yuzma-yuz kelganda ichidan o'tib ketmaydi, yonidan sirpanib o'tadi
    if (!seated) { const L = g.live && g.live._dbg, W = g.shahar && g.shahar.walkers; const push = (o) => { const r = o && o.rig && o.rig.root; if (!r || !r.visible) return; const q = r.position; if (Math.abs(q.y - p[1]) > 1.4) return; let dx = nx - q.x, dz = nz - q.z; const d = Math.hypot(dx, dz), pen = 0.6 - d; if (pen <= 0) return; if (d < 1e-4) { dx = -Math.sin(this.yaw); dz = -Math.cos(this.yaw); } else { dx /= d; dz /= d; } nx += dx * pen; nz += dz * pen; };
      if (L) { for (const o of L.npcs) push(o); for (const o of L.hikers) if (o.on) push(o); } if (W) for (const o of W) if (o.vis) push(o); }
    // transportlar (o'zimizniki va boshqalar) — oddiy doira
    { const c = g.car, R = c.R, s = c.spec; const lx = (nx - c.p[0]) * R[0] + (nz - c.p[2]) * R[6], lz = (nx - c.p[0]) * R[2] + (nz - c.p[2]) * R[8]; const hx = s.wid / 2 + 0.3, hz = s.len / 2 + 0.3;
      if (Math.abs(lx) < hx && Math.abs(lz) < hz && Math.abs(p[1] - (c.p[1] - s.com)) < s.hgt) { const ox = hx - Math.abs(lx), oz = hz - Math.abs(lz); if (ox < oz) { const k = Math.sign(lx || 1) * ox; nx += R[0] * k; nz += R[6] * k; } else { const k = Math.sign(lz || 1) * oz; nx += R[2] * k; nz += R[8] * k; } } }
    // yo'ldagi boshqa mashinalar (life.js) — to'xtab turgan mashina ichidan o'tib ketmaydi
    { const LC = g.life && g.life.cars; if (LC) for (const c of LC) { if (!c.placed || !c.m.root.visible || Math.abs(c.x - nx) > 8 || Math.abs(c.z - nz) > 8) continue; if (Math.abs(p[1] - (c.y - c.com)) > c.sp.hgt) continue;
      const fx = Math.sin(c.yaw), fz = Math.cos(c.yaw), dx = nx - c.x, dz = nz - c.z, lx = dx * fz - dz * fx, lz = dx * fx + dz * fz, hx = c.halfW + 0.3, hz = c.half + 0.3; if (Math.abs(lx) >= hx || Math.abs(lz) >= hz) continue;
      const ox = hx - Math.abs(lx), oz = hz - Math.abs(lz); if (ox < oz) { const k = Math.sign(lx || 1) * ox; nx += fz * k; nz -= fx * k; } else { const k = Math.sign(lz || 1) * oz; nx += fx * k; nz += fz * k; } } }
    nx = clamp(nx, -3150, 3150); nz = clamp(nz, -3150, 3150);
    const avx = dt > 1e-4 ? (nx - p[0]) / dt : 0, avz = dt > 1e-4 ? (nz - p[2]) / dt : 0; // haqiqiy siljish (devorga tiralganda ~0) — animatsiya uchun
    p[0] = nx; p[2] = nz; p[1] += v[1] * dt;
    const gy = T.ground(nx, nz, p[1] + 0.7).y;
    if (!this.swim) { if (p[1] <= gy) { if (!this.grounded) this._land(v[1], st); p[1] = gy; v[1] = 0; this.grounded = true; } else if (this.grounded && p[1] - gy < 0.45 && v[1] <= 0) p[1] = gy; else this.grounded = false; }
    else if (p[1] < gy) p[1] = gy;
    this.speed = Math.hypot(v[0], v[2]); this.fwd = this.speed;
    // suvga tushish va suzish: chayqalish ovozi va tomchilar; suzayotganda qo'l eshish shovqini
    if (this.swim && !this._wasSwim && (g.time || 0) - (this._splT || -9) > 1.5) { this._splT = g.time || 0; g.audio.sfx('splash'); if (g.fx && g.fx.burst) g.fx.burst(14, p[0], wy + 0.1, p[2], 2.6, 1.2, 0.4, 0xdff2ff, 0.9, 0.9, 6, 0); }
    this._wasSwim = this.swim; this._strT = (this._strT || 0) - dt; if (this.swim && moving && this._strT <= 0) { this._strT = 0.95; g.audio.sfx('swim'); }
    if (tired && runReq && (this._tmT || 0) <= 0) { this._tmT = 40; g.toast && g.toast('Kuchingiz tugadi — biroz yuring yoki dam oling ⚡'); } this._tmT = (this._tmT || 0) - dt;
    // kuch (energiya): yugurish sarflaydi, to'qlik darajasigacha tiklanadi
    if (run && this.grounded) st.energy = Math.max(0, st.energy - 5.5 * dt); else st.energy = Math.min(st.sat, st.energy + (this.sit ? 22 : moving ? 3.5 : 9) * dt);
    st.sat = Math.max(30, st.sat - dt * 0.055);
    // animatsiya
    let anim = 'idle';
    if (this.lockAnim) anim = this.lockAnim; else if (this.swim) anim = 'swim'; else if (!this.grounded) anim = 'jump'; else if (this.speed > 4.6) anim = 'run'; else if (this.speed > 0.4) anim = 'walk'; else if (this.sit) anim = 'sit'; else if (this.emote) anim = this.emote;
    rig.root.position.set(p[0], p[1], p[2]); rig.root.rotation.y = this.yaw;
    const C = this.ctl, real = avx * avx + avz * avz < 150; C.vx = real ? avx : v[0]; C.vz = real ? avz : v[2]; C.vy = v[1]; // devorga tiralsa oyoq joyida yurmaydi, gavda yiqilayotgandek engashmaydi
    C.grounded = this.grounded; C.swim = this.swim; C.energy = st.energy; C.moveYaw = moving ? Math.atan2(mx, mz) : null; C.camYaw = camYaw;
    poseRig(rig, anim, dt, this.speed, C); this.anim = anim;
    const c = Math.cos(this.yaw), s2 = Math.sin(this.yaw); this.R[0] = c; this.R[2] = s2; this.R[6] = -s2; this.R[8] = c;
    // qadam tovushi
    if (this.grounded && this.speed > 1 && rig.A.contact) g.audio.sfx('step', wade ? 6 : T.ground(nx, nz, 1e9).surf, run ? 1.3 : 1); // oyoq yerga tekkan zahoti
    const night = g.sky.night, Lm = this.lamp; Lm.intensity += ((this.lampOn && night > 0.2 ? 170 : 0) - Lm.intensity) * Math.min(1, dt * 8); Lm.position.set(p[0] + s2 * 0.3, p[1] + 1.4, p[2] + c * 0.3); Lm.target.position.set(p[0] + s2 * 7, p[1] + 0.1, p[2] + c * 7);
  }
}
