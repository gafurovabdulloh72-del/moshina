// Transport shikastlanishi: zonalar, dvigatel, balonlar, korpusning haqiqiydek pachoqlanishi, qismlarning uzilishi
import { clamp } from './util.js';

export class Damage {
  constructor(game) {
    this.game = game;
    this.zone = { front: 100, rear: 100, left: 100, right: 100 };
    this.engine = 100; this.tires = [0, 0, 0, 0]; this.armor = 0; this.wrecked = false; this.flash = 0; this.enabled = true;
    this.smokeT = 0; this.total = 0; this.cool = 0; this.stallT = 3; this.cutT = 0; this.meshes = []; this.orig = [];
  }
  // Joriy modelga bog'lash (transport almashganda)
  bind(model) {
    this.model = model; this.meshes = model.deform; this.orig = this.meshes.map((q) => q.geometry.attributes.position.array.slice());
    const s = model.spec; this.hw = s.wid / 2; this.hl = s.len / 2; this.yb = s.clr - s.com; this.yt = s.hgt - s.com; this.sc = Math.max(0.5, Math.min(1.6, s.len / 4));
  }
  get health() { const z = this.zone; return Math.round((z.front + z.rear + z.left + z.right) / 4 * 0.5 + this.engine * 0.5); }
  save() { return { z: Object.assign({}, this.zone), e: this.engine, t: this.tires.slice() }; }
  load(d) {
    this.zone = { front: 100, rear: 100, left: 100, right: 100 }; this.engine = 100; this.tires = [0, 0, 0, 0]; this.wrecked = false;
    this.resetLook();
    if (d) { Object.assign(this.zone, d.z); this.engine = d.e; this.tires = (d.t || [0, 0, 0, 0]).slice(); this.wrecked = this.engine <= 0; this.restoreLook(); }
    this.apply(); this.syncParts(true);
  }
  // Zarba: v (m/s), mahalliy nuqta (lx,ly,lz)
  hit(v, lx, ly, lz, kind = 'hit') {
    const g = this.game;
    if (!this.enabled || g.godMode || this.model.v.eng === 0) return 0; // velosiped buzilmaydi (lekin haydovchi yiqiladi)
    const thr = kind === 'land' ? 7.5 : 5.2;
    if (v < thr || this.cool > 0) return 0;
    let dmg = (v - thr) * (kind === 'land' ? 2.2 : 3.1) * (1 - this.armor * 0.15);
    dmg = Math.min(dmg, v > 30 ? 92 : 78);
    let zn;
    if (kind === 'land') zn = Math.random() < 0.5 ? 'front' : 'rear';
    else if (lz > this.hl * 0.5) zn = 'front'; else if (lz < -this.hl * 0.5) zn = 'rear'; else zn = lx > 0 ? 'left' : 'right';
    this.zone[zn] = clamp(this.zone[zn] - dmg, 0, 100);
    // old tomondan qattiq urilish motorni ishdan chiqaradi (100 km/soatdan oshsa — deyarli butunlay)
    const eng = zn === 'front' ? dmg * 0.62 + Math.max(0, v - 20) ** 2 * 0.35 : kind === 'land' ? dmg * 0.4 : dmg * 0.22;
    this.engine = clamp(this.engine - eng, 0, 100);
    if (dmg > 14 && Math.random() < (dmg - 10) / 80) { const w = zn === 'front' ? (lx > 0 ? 0 : 1) : zn === 'rear' ? (lx > 0 ? 2 : 3) : zn === 'left' ? (lz > 0 ? 0 : 2) : (lz > 0 ? 1 : 3); if (!this.tires[w]) { this.tires[w] = 1; g.toast('Balon yorildi!', 'bad'); g.audio.sfx('tire'); } }
    if (kind !== 'land') { const d = Math.min(0.75, dmg * 0.0125) * this.sc; this.deform(lx, ly, lz, d); this.crush(zn, d * 0.75); }
    else this.crush('bottom', Math.min(0.2, dmg * 0.006));
    this.flash = 1; this.total += dmg; this.cool = 0.22;
    this.apply(); this.syncParts(false);
    if (this.engine <= 0 && !this.wrecked) { this.wrecked = true; g.onWreck && g.onWreck(); }
    return dmg;
  }
  _each(fn) {
    for (let mi = 0; mi < this.meshes.length; mi++) {
      const attr = this.meshes[mi].geometry.attributes.position, a = attr.array, o0 = this.orig[mi], lim = 0.8 * this.sc;
      for (let i = 0; i < a.length; i += 3) {
        if (!fn(a, i, o0)) continue;
        const sx = a[i] - o0[i], sy = a[i + 1] - o0[i + 1], sz = a[i + 2] - o0[i + 2], sl = Math.hypot(sx, sy, sz);
        if (sl > lim) { const q = lim / sl; a[i] = o0[i] + sx * q; a[i + 1] = o0[i + 1] + sy * q; a[i + 2] = o0[i + 2] + sz * q; }
      }
      attr.needsUpdate = true; this.meshes[mi].geometry.computeVertexNormals();
    }
  }
  // Zarba nuqtasi atrofini ichkariga botirish (g'ijimlanish shovqini bilan)
  deform(lx, ly, lz, depth) {
    const px = clamp(lx, -this.hw, this.hw), py = clamp(ly, this.yb, this.yt), pz = clamp(lz, -this.hl, this.hl);
    let dx = -px, dy = -(py - (this.yb + this.yt) / 2) * 0.4, dz = -pz * 0.7; const l = Math.hypot(dx, dy, dz) || 1; dx /= l; dy /= l; dz /= l;
    const R = 1.25 * this.sc + depth;
    this._each((a, i, o0) => {
      const ex = a[i] - px, ey = (a[i + 1] - py) * 0.7, ez = a[i + 2] - pz, d = Math.hypot(ex, ey, ez);
      if (d > R) return false;
      const f = 1 - d / R, n = Math.sin(o0[i] * 9.1 + o0[i + 1] * 7.3 + o0[i + 2] * 5.7), k = depth * f * f * (0.65 + 0.7 * Math.abs(n));
      a[i] += dx * k + n * k * 0.18; a[i + 1] += dy * k + Math.cos(o0[i] * 13 + o0[i + 2] * 11) * k * 0.3; a[i + 2] += dz * k;
      return true;
    });
  }
  // Butun tomonni ezish: old tomondan urilsa kapot qisqaradi va ko'tariladi, yondan urilsa eshiklar ichkariga kiradi
  crush(zn, amt) {
    if (amt < 0.01) return; const hl = this.hl, hw = this.hw, yb = this.yb, yt = this.yt;
    this._each((a, i, o0) => {
      const x = o0[i], y = o0[i + 1], z = o0[i + 2], n = Math.sin(x * 7.7 + y * 5.1 + z * 6.3);
      if (zn === 'front') { const t = (z - hl * 0.35) / (hl * 0.65); if (t <= 0) return false; a[i + 2] -= amt * t * (0.8 + 0.4 * n); a[i + 1] += amt * 0.22 * t * (y > (yb + yt) * 0.5 - 0.1 ? 1 : -0.3) * (1 - Math.abs(x) / (hw * 1.4)); return true; }
      if (zn === 'rear') { const t = (-z - hl * 0.4) / (hl * 0.6); if (t <= 0) return false; a[i + 2] += amt * t * (0.8 + 0.4 * n); a[i + 1] += amt * 0.15 * t * n; return true; }
      if (zn === 'left' || zn === 'right') { const sd = zn === 'left' ? 1 : -1, t = (x * sd - hw * 0.25) / (hw * 0.75); if (t <= 0) return false; const c = 1 - Math.min(1, Math.abs(z) / (hl * 1.05)); a[i] -= sd * amt * t * (0.5 + 0.7 * c) * (0.8 + 0.4 * n); return true; }
      if (zn === 'bottom') { const t = 1 - (y - yb) / (yt - yb); if (t <= 0.5) return false; a[i + 1] += amt * (t - 0.5) * (0.5 + 0.5 * n); return true; }
      return false;
    });
  }
  resetLook() {
    for (let mi = 0; mi < this.meshes.length; mi++) { const attr = this.meshes[mi].geometry.attributes.position; attr.array.set(this.orig[mi]); attr.needsUpdate = true; this.meshes[mi].geometry.computeVertexNormals(); }
    const m = this.model, P = m.parts; this.game.fx.reattach(m.tilt);
    for (const k in P) { const p = P[k]; p.on = true; p.mesh.visible = true; if (p.mesh.parent !== m.tilt) m.tilt.add(p.mesh); p.mesh.position.copy(p.home); p.mesh.rotation.set(0, 0, 0); p.mesh.scale.setScalar(1); }
  }
  // Saqlangan holatdan ko'rinishni tiklash (taxminiy pachoqlar)
  restoreLook() {
    const z = this.zone, k = 0.0062 * this.sc;
    if (z.front < 96) { this.deform(this.hw * 0.3, 0, this.hl, (100 - z.front) * k); this.crush('front', (100 - z.front) * k * 0.75); }
    if (z.rear < 96) { this.deform(-this.hw * 0.2, 0, -this.hl, (100 - z.rear) * k); this.crush('rear', (100 - z.rear) * k * 0.75); }
    if (z.left < 96) { this.deform(this.hw, 0, 0.2, (100 - z.left) * k); this.crush('left', (100 - z.left) * k * 0.75); }
    if (z.right < 96) { this.deform(-this.hw, 0, -0.2, (100 - z.right) * k); this.crush('right', (100 - z.right) * k * 0.75); }
  }
  syncParts(silent) {
    const P = this.model.parts, z = this.zone, fx = this.game.fx, car = this.game.car, mn = Math.min(z.left, z.right, z.front, z.rear);
    for (const name in P) { const p = P[name]; if (!p.on) continue; const val = p.zone === 'top' ? mn : z[p.zone]; if (val < p.thr) { p.on = false; if (silent) p.mesh.visible = false; else fx.detach(p, car); } }
  }
  // Fizikaga ta'sir: shikastlangan mashina sekin tortadi, yomon to'xtaydi
  apply() {
    const car = this.game.car, e = this.engine / 100, z = this.zone;
    car.dmgPower = this.engine <= 0 ? 0 : 0.28 + 0.72 * e * e;
    const flat = this.tires[0] + this.tires[1] + this.tires[2] + this.tires[3];
    car.dmgSteer = (this.tires[0] - this.tires[1]) * 0.014; // faqat old balon yorilganda biroz tortadi
    car.dmgGrip = 1 - flat * 0.13 - (100 - Math.min(z.left, z.right)) * 0.0012;
    car.dmgDrag = flat * 0.9 + (100 - z.front) * 0.012 + (100 - z.rear) * 0.006;
    car.dmgAero = 1 + (100 - z.front) * 0.012;
    this.wobble = Math.max(0, 55 - Math.min(z.front, z.left, z.right)) / 55;
    if (this.game.applyUpgrades) this.game.applyUpgrades();
  }
  repair(amount = 100) {
    const full = amount >= 100;
    for (const k in this.zone) this.zone[k] = clamp(this.zone[k] + amount, 0, 100);
    this.engine = clamp(this.engine + amount, 0, 100);
    if (full || this.engine > 0) this.wrecked = false;
    if (full) { this.tires = [0, 0, 0, 0]; this.resetLook(); }
    this.apply();
  }
  update(dt, active = true) {
    this.flash = Math.max(0, this.flash - dt * 2); this.cool -= dt;
    const car = this.game.car, fx = this.game.fx, m = this.model;
    // dvigatelning o'chib qolishi: qattiq shikastlanganda motor "yo'talib" tortmay qoladi
    if (this.engine <= 0) car.cut = true;
    else if (this.engine < 46 && active) {
      if (this.cutT > 0) { this.cutT -= dt; car.cut = true; if (this.cutT <= 0) { car.cut = false; this.stallT = 1.2 + Math.random() * (1 + this.engine * 0.16); } }
      else { car.cut = false; this.stallT -= dt * (0.4 + car.throttle); if (this.stallT <= 0) { this.cutT = 0.25 + Math.random() * (0.9 - this.engine * 0.012); if (Math.random() < 0.5) this.game.audio.sfx('cough'); } }
    } else car.cut = false;
    // rul titrashi (g'ildiraklar qiyshaygan) — o'rtacha nolga teng, mashina bir tomonga tortib ketmaydi
    car.steerBias = (car.dmgSteer || 0) + (this.wobble > 0 ? Math.sin(this.game.time * 13) * 0.012 * this.wobble * Math.min(1, car.speed / 14) : 0);
    if (this.engine < 64 && m.v.eng > 0) {
      this.smokeT -= dt;
      if (this.smokeT <= 0) {
        this.smokeT = this.engine < 30 ? 0.045 : 0.1;
        const R = car.R, p = car.p, f = this.hl * 0.72, u = this.yt * 0.35; const x = p[0] + R[2] * f + R[1] * u, y = p[1] + R[5] * f + R[4] * u, z = p[2] + R[8] * f + R[7] * u;
        const dark = this.engine < 30;
        fx.emit(x + (Math.random() - 0.5) * 0.5, y, z + (Math.random() - 0.5) * 0.5, car.v[0] * 0.3 + (Math.random() - 0.5), 1.8 + Math.random(), car.v[2] * 0.3 + (Math.random() - 0.5), 1.3 + Math.random() * 0.8, dark ? 0.55 : 0.4, dark ? 0x2e2e33 : 0xd8d8dc, dark ? 0.36 : 0.26, 1.6, -0.6, 0.6);
        if (this.engine <= 0 && Math.random() < 0.6) fx.emit(x, y, z, (Math.random() - 0.5) * 1.5, 2 + Math.random() * 2, (Math.random() - 0.5) * 1.5, 0.5, 0.75, Math.random() < 0.5 ? 0xff7a20 : 0xffc040, 0.95, 0.6, -1, 0.5);
      }
    }
  }
}
