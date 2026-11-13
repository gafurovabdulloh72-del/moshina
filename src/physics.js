// Transport fizikasi: qattiq jism + 4 ta prujinali g'ildirak (raycast), shina ishqalanishi, to'qnashuvlar.
// Har qanday transport (velosipeddan avtobusgacha) bitta "spec" bilan sozlanadi.
// three.js'siz — Node'da ham sinaladi. O'qlar: +Z oldinga, +X chapga, +Y tepaga.
import { clamp } from './util.js';
import * as COL from './colliders.js';

const G = 9.81;
//                 ROAD  GRASS SAND  SNOW  ROCK  WOOD  WATER ICE  ASPHALT
export const MU = [1.05, 0.86, 0.72, 0.56, 0.95, 0.95, 0.5, 0.3, 1.15];
const RR = [0.012, 0.03, 0.06, 0.04, 0.02, 0.014, 0.1, 0.008, 0.01];
export const DEF_SPEC = { mass: 1500, len: 4.0, wid: 1.78, hgt: 1.85, clr: 0.43, com: 0.79, wx: 0.86, wzF: 1.28, wzR: 1.28, rF: 0.42, rR: 0.42, free: 0.46, travel: 0.36, sag: 0.1226, power: 82000, top: 121, a0: 6.1, brake: 11.3, steer: 0.6, drive: 'awd', grip: 1, down: 1.2 };

export class Car {
  constructor(world, spec) {
    this.world = world; // { ground(x,z,yRef)->{y,surf,road}, waterY(x,z) }
    this.p = [0, 0, 0]; this.q = [0, 0, 0, 1]; this.v = [0, 0, 0]; this.w = [0, 0, 0];
    this.R = new Float64Array(9);
    this.steer = 0; this.sN = 0; this.steerBias = 0; this.extraRR = 0; this.rearK = 1; this.cut = false;
    this.speed = 0; this.fwd = 0; this.onGround = 0; this.airTime = 0; this.flipT = 0; this.slipAng = 0; this.inWater = 0; this.lat = 0; this.slip = 0;
    this.throttle = 0; this.reverse = false; this.nitroOn = false; this.rpm = 0.2; this.gear = 1; this.nitroMul = 1.55; this.grip = 1;
    this.events = [];
    this.setSpec(spec || DEF_SPEC);
    this._updR();
  }
  // Transport parametrlarini o'rnatish (obyekt o'zi saqlanadi)
  setSpec(s) {
    s = Object.assign({}, DEF_SPEC, s); this.spec = s;
    const m = (this.mass = s.mass);
    this.Ib = [Math.max(m * (s.hgt * s.hgt + s.len * s.len) / 12 * 1.07, m * 0.35), Math.max(m * (s.wid * s.wid + s.len * s.len) / 12 * 1.25, m * 0.35), Math.max(m * (s.wid * s.wid + s.hgt * s.hgt) / 12 * 1.33, m * 0.25)];
    this.free = s.free; this.maxComp = s.travel;
    this.k = (m * G) / (4 * s.sag); const cc = Math.sqrt(this.k * m / 4); this.cComp = 0.894 * cc; this.cReb = 1.282 * cc; this.kStop = this.k * 5.5;
    this.restY = s.com;
    const ay = (r) => r + (s.free - s.sag) - s.com;
    this.wheels = [
      { lx: s.wx, ly: ay(s.rF), lz: s.wzF, front: true, r: s.rF }, { lx: -s.wx, ly: ay(s.rF), lz: s.wzF, front: true, r: s.rF },
      { lx: s.wx, ly: ay(s.rR), lz: -s.wzR, front: false, r: s.rR }, { lx: -s.wx, ly: ay(s.rR), lz: -s.wzR, front: false, r: s.rR },
    ].map((w) => ({ ...w, comp: s.sag, len: s.free - s.sag, on: false, slip: 0, surf: 0, spin: 0, cx: 0, cy: 0, cz: 0, load: 0, vlong: 0, vlat: 0 }));
    this.radius = s.rR;
    this.vTop = s.top / 3.6;
    this.basePower = s.power; this.baseFMax = m * s.a0; this.baseBrake = m * s.brake; this.baseK = this.k; this.baseTravel = s.travel;
    this.power = s.power; this.fMax = this.baseFMax; this.brakeF = this.baseBrake;
    this.cd = Math.max(0.05, 2 * (s.power - 0.012 * m * G * this.vTop) / (this.vTop * this.vTop * this.vTop)); this.cdMul = 1;
    this.steerMax = s.steer; this.bike = !!s.bike; this.gripBase = s.grip; this.grip = s.grip; this.down = s.down;
    this.drv = s.drive === 'rwd' ? [0, 0, 0.5, 0.5] : s.drive === 'fwd' ? [0.5, 0.5, 0, 0] : [0.25, 0.25, 0.25, 0.25];
    this.lift = this.bike ? s.com - 0.02 : s.com * 0.63;
    const hw = s.wid / 2, hl = s.len / 2, by = s.clr - s.com, ty = s.hgt - s.com;
    this.box = [[hw * 0.95, by, hl * 0.95], [-hw * 0.95, by, hl * 0.95], [hw * 0.95, by, -hl * 0.95], [-hw * 0.95, by, -hl * 0.95],
      [hw * 0.82, ty, hl * 0.5], [-hw * 0.82, ty, hl * 0.5], [hw * 0.82, ty, -hl * 0.8], [-hw * 0.82, ty, -hl * 0.8], [hw, by + (ty - by) * 0.45, 0], [-hw, by + (ty - by) * 0.45, 0]];
    this.cr = Math.min(1.35, hw + 0.09);
    const n = Math.max(2, Math.round(s.len / (1.7 * this.cr))), span = Math.max(0, hl - this.cr);
    this.cOff = []; for (let i = 0; i < n; i++) this.cOff.push(n === 1 ? 0 : span - (2 * span * i) / (n - 1));
    this.sc = m / 1500;
  }
  _updR() {
    const [x, y, z, w] = this.q, R = this.R;
    R[0] = 1 - 2 * (y * y + z * z); R[1] = 2 * (x * y - z * w); R[2] = 2 * (x * z + y * w);
    R[3] = 2 * (x * y + z * w); R[4] = 1 - 2 * (x * x + z * z); R[5] = 2 * (y * z - x * w);
    R[6] = 2 * (x * z - y * w); R[7] = 2 * (y * z + x * w); R[8] = 1 - 2 * (x * x + y * y);
  }
  get yaw() { return Math.atan2(this.R[2], this.R[8]); }
  get upY() { return this.R[4]; }
  setPose(x, y, z, yaw) {
    this.p[0] = x; this.p[1] = y; this.p[2] = z;
    this.q = [0, Math.sin(yaw / 2), 0, Math.cos(yaw / 2)];
    this.v = [0, 0, 0]; this.w = [0, 0, 0]; this.steer = 0; this.sN = 0; this.flipT = 0; this.airTime = 0;
    this._updR();
  }
  place(x, z, yaw) { const g = this.world.ground(x, z, 1e9); this.setPose(x, g.y + this.restY + 0.05, z, yaw); }

  step(dt, inp) {
    const R = this.R, p = this.p, v = this.v, w = this.w, m = this.mass, world = this.world, sc = this.sc;
    const Lx = R[0], Ly = R[3], Lz = R[6], Ux = R[1], Uy = R[4], Uz = R[7], Fx = R[2], Fy = R[5], Fz = R[8];
    let fx = 0, fy = -m * G, fz = 0, tx = 0, ty = 0, tz = 0;
    const addF = (Fxx, Fyy, Fzz, rx, ry, rz) => { fx += Fxx; fy += Fyy; fz += Fzz; tx += ry * Fzz - rz * Fyy; ty += rz * Fxx - rx * Fzz; tz += rx * Fyy - ry * Fxx; };

    const fwdV = v[0] * Fx + v[1] * Fy + v[2] * Fz, av = Math.abs(fwdV);
    this.fwd = fwdV; this.speed = Math.hypot(v[0], v[1], v[2]);
    // --- boshqaruv ---
    const thr = inp.throttle || 0, brk = inp.brake || 0;
    let drive = 0, braking = 0;
    if (thr > 0.02) { if (fwdV < -1.5) braking = thr; else drive = thr; }
    if (brk > 0.02) { if (fwdV > 1.2) braking = Math.max(braking, brk); else drive = -brk; }
    this.reverse = drive < 0;
    const nitro = !!inp.nitro && drive > 0 && !this.bike;
    this.nitroOn = nitro;
    // Rul: me'yorlangan (-1..1). Markazga qaytish tezlikka bog'liq (o'z-o'zidan to'g'rilanish)
    const sMax = this.steerMax / Math.sqrt(1 + (av / 13) * (av / 13));
    const tgt = clamp(inp.steer || 0, -1, 1);
    const back = Math.abs(tgt) < Math.abs(this.sN) || tgt * this.sN < 0;
    const rate = (back ? 4.2 + Math.min(4.5, av * 0.3) : 3.6 - Math.min(1.3, av * 0.035)) * dt;
    this.sN += clamp(tgt - this.sN, -rate, rate);
    this.steer = this.sN * sMax + this.steerBias * Math.min(1, av / 10);
    let driveF = 0;
    if (drive > 0) {
      const P = this.power * (nitro ? this.nitroMul : 1), FM = this.fMax * (nitro ? 1.3 : 1);
      driveF = drive * Math.min(FM, P / Math.max(1, av));
    } else if (drive < 0) {
      driveF = fwdV > -Math.min(11, this.vTop * 0.35) ? drive * this.fMax * 0.6 : 0;
    }
    if (this.cut) driveF = 0;
    this.throttle = Math.abs(drive);
    const hand = !!inp.handbrake;
    // qo'l tormozi: orqa g'ildiraklar ushlashi keskin tushadi, qo'yib yuborilgach asta tiklanadi (drift)
    this.rearK += ((hand ? 0.42 : 1) - this.rearK) * Math.min(1, dt * (hand ? 18 : 2.6));

    // --- g'ildiraklar ---
    let nOn = 0, slipSum = 0;
    const cs = Math.cos(this.steer), sn = Math.sin(this.steer);
    if (Uy > 0.2) {
      for (let i = 0; i < 4; i++) {
        const wh = this.wheels[i], wr = wh.r;
        const ax = p[0] + Lx * wh.lx + Ux * wh.ly + Fx * wh.lz, ay = p[1] + Ly * wh.lx + Uy * wh.ly + Fy * wh.lz, az = p[2] + Lz * wh.lx + Uz * wh.ly + Fz * wh.lz;
        let t = wh.len + wr, g = null, px = 0, py = 0, pz = 0;
        for (let it = 0; it < 2; it++) {
          px = ax - Ux * t; py = ay - Uy * t; pz = az - Uz * t;
          g = world.ground(px, pz, ay);
          t += (py - g.y) / Uy;
        }
        px = ax - Ux * t; py = ay - Uy * t; pz = az - Uz * t;
        const gy = g.y, surf = g.surf;
        const L = t - wr;
        let comp = this.free - L;
        wh.surf = surf;
        if (comp <= 0) { wh.on = false; wh.comp = 0; wh.len = this.free; wh.slip = 0; wh.load = 0; wh.spin += (wh.vlong / wr) * dt; continue; }
        const e = 0.35;
        const gx1 = world.ground(px + e, pz, ay).y, gz1 = world.ground(px, pz + e, ay).y;
        let nx = -(gx1 - gy) / e, ny = 1, nz = -(gz1 - gy) / e;
        const nl = Math.hypot(nx, ny, nz); nx /= nl; ny /= nl; nz /= nl;
        const rx = px - p[0], ry = py - p[1], rz = pz - p[2];
        const vcx = v[0] + w[1] * rz - w[2] * ry, vcy = v[1] + w[2] * rx - w[0] * rz, vcz = v[2] + w[0] * ry - w[1] * rx;
        const closing = -(vcx * nx + vcy * ny + vcz * nz);
        let Fs = this.k * Math.min(comp, this.maxComp) + (closing > 0 ? this.cComp : this.cReb) * closing;
        if (comp > this.maxComp) Fs += this.kStop * (comp - this.maxComp);
        Fs = clamp(Fs, 0, m * 60);
        if (comp > this.maxComp + 0.1) comp = this.maxComp + 0.1;
        wh.on = true; wh.comp = comp; wh.len = this.free - comp; wh.load = Fs; nOn++;
        wh.cx = px; wh.cy = py; wh.cz = pz;
        addF(nx * Fs, ny * Fs, nz * Fs, rx, ry, rz);
        let hx = Fx, hy = Fy, hz = Fz;
        if (wh.front) { hx = Fx * cs + Lx * sn; hy = Fy * cs + Ly * sn; hz = Fz * cs + Lz * sn; }
        const dn = hx * nx + hy * ny + hz * nz; hx -= nx * dn; hy -= ny * dn; hz -= nz * dn;
        const hl = Math.hypot(hx, hy, hz) || 1; hx /= hl; hy /= hl; hz /= hl;
        const sx = ny * hz - nz * hy, sy = nz * hx - nx * hz, sz = nx * hy - ny * hx; // chap
        const vlong = vcx * hx + vcy * hy + vcz * hz, vlat = vcx * sx + vcy * sy + vcz * sz;
        wh.vlong = vlong; wh.vlat = vlat;
        const mu = MU[surf] * this.grip;
        const share = m / 4;
        let Flat = (-vlat * share / dt) * 0.5;
        let Flong = driveF * this.drv[i];
        const powered = hand && !wh.front && drive > 0.2 && this.drv[i] > 0;
        if (hand && !wh.front && !powered) Flong = (-vlong * share / dt) * 0.8;
        else if (braking > 0) { const bf = braking * this.brakeF * (wh.front ? 0.3 : 0.2); Flong += -Math.sign(vlong) * Math.min(bf, Math.abs(vlong) * share / dt); }
        else if (drive === 0) {
          const a1 = Math.abs(vlong); if (a1 < 0.6) Flong += (-vlong * share / dt) * 0.5; else Flong += -Math.sign(vlong) * (a1 < 4 ? 1500 : 300 + 16 * a1) * sc;
        }
        Flong -= Math.sign(vlong) * Math.min((RR[surf] + this.extraRR * 0.03) * Fs, Math.abs(vlong) * share / dt);
        const Fcap = mu * Fs;
        const latCap = Fcap * (wh.front ? 1 : this.rearK);
        let slip = 0;
        if (Math.abs(Flat) > latCap) { slip = Math.min(2, Math.abs(Flat) / (latCap + 1) - 1); Flat = Math.sign(Flat) * latCap; }
        const mag = Math.hypot(Flong, Flat);
        if (mag > Fcap) {
          const fl = Math.sqrt(Math.max(0, Fcap * Fcap - Flat * Flat * 0.85));
          if (Math.abs(Flong) > fl) { slip = Math.max(slip, Math.min(2, Math.abs(Flong) / (fl + 200 * sc) - 1)); Flong = Math.sign(Flong) * fl; }
        }
        wh.slip = slip; slipSum += slip;
        const lift = this.lift;
        addF(hx * Flong + sx * Flat, hy * Flong + sy * Flat, hz * Flong + sz * Flat, rx + Ux * lift, ry + Uy * lift, rz + Uz * lift);
        wh.spin += ((hand && !wh.front && !powered ? 0 : (Math.abs(Flong) >= Fcap * 0.98 && drive !== 0 ? vlong + Math.sign(drive) * 6 : vlong)) / wr) * dt;
      }
    } else { for (const wh of this.wheels) { wh.on = false; wh.slip = 0; wh.comp = 0; wh.len = this.free; } }
    this.onGround = nOn;
    this.slip = slipSum / 4;

    // --- korpus yerga tegishi ---
    let bodyHit = 0;
    for (let i = 0; i < this.box.length; i++) {
      const b = this.box[i];
      const rx = Lx * b[0] + Ux * b[1] + Fx * b[2], ry = Ly * b[0] + Uy * b[1] + Fy * b[2], rz = Lz * b[0] + Uz * b[1] + Fz * b[2];
      const px = p[0] + rx, py = p[1] + ry, pz = p[2] + rz;
      const g = world.ground(px, pz, py + 0.9);
      const depth = g.y - py;
      if (depth <= 0) continue;
      const gy = g.y, e = 0.4;
      const gx1 = world.ground(px + e, pz, py + 0.9).y, gz1 = world.ground(px, pz + e, py + 0.9).y;
      let nx = -(gx1 - gy) / e, ny = 1, nz = -(gz1 - gy) / e; const nl = Math.hypot(nx, ny, nz); nx /= nl; ny /= nl; nz /= nl;
      const vcx = v[0] + w[1] * rz - w[2] * ry, vcy = v[1] + w[2] * rx - w[0] * rz, vcz = v[2] + w[0] * ry - w[1] * rx;
      const vn = vcx * nx + vcy * ny + vcz * nz;
      const Fn = clamp((110000 * Math.min(depth, 0.5) - 9000 * vn) * sc, 0, 140000 * sc);
      const tvx = vcx - nx * vn, tvy = vcy - ny * vn, tvz = vcz - nz * vn; const tl = Math.hypot(tvx, tvy, tvz);
      let ffx = 0, ffy = 0, ffz = 0;
      if (tl > 0.01) { const ft = Math.min(0.55 * Fn, tl * (m / 6) / dt * 0.4); ffx = -tvx / tl * ft; ffy = -tvy / tl * ft; ffz = -tvz / tl * ft; }
      addF(nx * Fn + ffx, ny * Fn + ffy, nz * Fn + ffz, rx, ry, rz);
      if (-vn > bodyHit) { bodyHit = -vn; this._bhx = px; this._bhz = pz; }
    }
    if (bodyHit > 3.5 && (this._bodyCd || 0) <= 0) { this.events.push({ type: 'crash', v: bodyHit, x: this._bhx, z: this._bhz }); this._bodyCd = 0.4; }
    this._bodyCd = (this._bodyCd || 0) - dt;

    // --- havo qarshiligi, suv ---
    const sp = this.speed, cd = this.cd * this.cdMul;
    fx -= v[0] * sp * cd * 0.5; fy -= v[1] * sp * 0.25 * sc; fz -= v[2] * sp * cd * 0.5;
    if (nOn > 0) { const df = Math.min(2500 * sc, fwdV * fwdV * this.down * sc); fx -= Ux * df; fy -= Uy * df; fz -= Uz * df; }
    const wy = world.waterY(p[0], p[2]);
    const sub = Math.min(wy - (p[1] - this.restY + 0.04), wy - world.ground(p[0], p[2], p[1] + 1).y);
    if (sub > 0) {
      const k = Math.min(1, sub / 1.2);
      fx -= v[0] * 2600 * k * sc; fz -= v[2] * 2600 * k * sc; fy -= v[1] * 1500 * k * sc;
      fy += m * G * 0.6 * Math.min(1.5, Math.max(0, sub - 0.5));
      if (!this.inWater && sp > 3) this.events.push({ type: 'splash', v: sp });
      this.inWater = k;
      if (sub > 1.9) this.events.push({ type: 'sunk' });
    } else this.inWater = 0;

    // --- barqarorlashtirish ---
    if (nOn === 0) {
      this.airTime += dt;
      const K = 3.5 * this.Ib[0]; tx += -Uz * K * 0.57; tz += Ux * K * 0.57 * (this.Ib[2] / this.Ib[0]) * 2.4;
      const pitchIn = (inp.throttle || 0) - (inp.brake || 0), pk = this.Ib[0] * 0.54;
      tx -= Lx * pitchIn * pk; ty -= Ly * pitchIn * pk; tz -= Lz * pitchIn * pk;
    } else {
      if (this.airTime > 0.35) this.events.push({ type: 'land', t: this.airTime, v: Math.abs(v[1]) });
      this.airTime = 0;
    }
    if (this.bike && Uy > 0.15) {
      // ikki g'ildirakli: tik turishga yordam (chapga og'ish = L.y > 0 bo'lsa, F o'qi atrofida qaytaruvchi moment)
      const wF = Fx * w[0] + Fy * w[1] + Fz * w[2];
      const Kr = m * G * this.restY * 9, Cr = 2 * Math.sqrt(Kr * this.Ib[2]);
      const tq = -Kr * Ly - Cr * wF;
      tx += Fx * tq; ty += Fy * tq; tz += Fz * tq;
    }

    // --- integratsiya ---
    v[0] += (fx / m) * dt; v[1] += (fy / m) * dt; v[2] += (fz / m) * dt;
    const tbx = Lx * tx + Ly * ty + Lz * tz, tby = Ux * tx + Uy * ty + Uz * tz, tbz = Fx * tx + Fy * ty + Fz * tz;
    const abx = tbx / this.Ib[0], aby = tby / this.Ib[1], abz = tbz / this.Ib[2];
    w[0] += (Lx * abx + Ux * aby + Fx * abz) * dt; w[1] += (Ly * abx + Uy * aby + Fy * abz) * dt; w[2] += (Lz * abx + Uz * aby + Fz * abz) * dt;
    let wbx = Lx * w[0] + Ly * w[1] + Lz * w[2], wby = Ux * w[0] + Uy * w[1] + Uz * w[2], wbz = Fx * w[0] + Fy * w[1] + Fz * w[2];
    const air = nOn === 0;
    wbx *= 1 - (air ? 1.2 : 1.6) * dt; wby *= 1 - (air ? 0.8 : 0.35) * dt; wbz *= 1 - (air ? 1.4 : 2.2) * dt;
    w[0] = Lx * wbx + Ux * wby + Fx * wbz; w[1] = Ly * wbx + Uy * wby + Fy * wbz; w[2] = Lz * wbx + Uz * wby + Fz * wbz;
    const wl = Math.hypot(w[0], w[1], w[2]); if (wl > 9) { const s = 9 / wl; w[0] *= s; w[1] *= s; w[2] *= s; }
    const vl = Math.hypot(v[0], v[1], v[2]); if (vl > 95) { const s = 95 / vl; v[0] *= s; v[1] *= s; v[2] *= s; }

    p[0] += v[0] * dt; p[1] += v[1] * dt; p[2] += v[2] * dt;
    const q = this.q, hx = 0.5 * dt;
    const qx = q[0], qy = q[1], qz = q[2], qw = q[3];
    q[0] += hx * (w[0] * qw + w[1] * qz - w[2] * qy);
    q[1] += hx * (w[1] * qw + w[2] * qx - w[0] * qz);
    q[2] += hx * (w[2] * qw + w[0] * qy - w[1] * qx);
    q[3] += hx * (-w[0] * qx - w[1] * qy - w[2] * qz);
    const ql = Math.hypot(q[0], q[1], q[2], q[3]); q[0] /= ql; q[1] /= ql; q[2] /= ql; q[3] /= ql;
    this._updR();

    this._collide(dt);

    if (this.R[4] < 0.25 && this.speed < 3) { this.flipT += dt; if (this.flipT > 1.6) { this.events.push({ type: 'flip' }); this.upright(); } } else this.flipT = Math.max(0, this.flipT - dt);
    if (!(p[0] === p[0]) || !(p[1] === p[1])) { this.events.push({ type: 'nan' }); this.setPose(0, 50, 0, 0); }
    const latV = v[0] * this.R[0] + v[1] * this.R[3] + v[2] * this.R[6];
    this.lat = latV;
    this.slipAng = this.speed > 4 ? Math.atan2(latV, Math.abs(this.fwd)) : 0;
    this._gearbox(dt);
  }

  upright() {
    const yaw = this.yaw; const g = this.world.ground(this.p[0], this.p[2], this.p[1] + 2);
    this.setPose(this.p[0], g.y + this.restY + 0.35, this.p[2], yaw);
  }

  _gearbox(dt) {
    const s = Math.abs(this.fwd), vt = this.vTop;
    const tops = [0, vt * 0.2, vt * 0.38, vt * 0.58, vt * 0.8, vt * 1.08];
    let g = this.gear;
    if (this.reverse) g = 1;
    else { if (g < 5 && s > tops[g] * 0.96) g++; else if (g > 1 && s < tops[g - 1] * 0.72) g--; }
    this.gear = g;
    const lo = g > 1 ? tops[g - 1] * 0.55 : 0, hi = tops[g];
    const target = clamp(0.18 + 0.82 * (s - lo) / (hi - lo), 0.18, 1) * (0.75 + 0.25 * this.throttle) + (this.onGround < 2 && this.throttle > 0.5 ? 0.25 : 0);
    this.rpm += (Math.min(1.05, target) - this.rpm) * Math.min(1, dt * 7);
  }

  _collide(dt) {
    const p = this.p, v = this.v, R = this.R, s = this.spec;
    const Fx = R[2], Fz = R[8];
    const near = COL.query(p[0], p[2], s.len / 2 + 2.4);
    if (!near.length) return;
    const yb = p[1] - s.com + 0.22, yt = p[1] - s.com + s.hgt;
    const CR = this.cr;
    for (let ci = 0; ci < this.cOff.length; ci++) {
      const off = this.cOff[ci];
      for (let k = 0; k < near.length; k++) {
        const o = near[k];
        if (o.dead || yb > o.y1 || yt < o.y0) continue;
        const cx = p[0] + Fx * off, cz = p[2] + Fz * off;
        let qx, qz;
        if (o.t === 0) { qx = o.x; qz = o.z; }
        else {
          const sx = o.x2 - o.x, sz = o.z2 - o.z; const l2 = sx * sx + sz * sz || 1;
          const t = clamp(((cx - o.x) * sx + (cz - o.z) * sz) / l2, 0, 1); qx = o.x + sx * t; qz = o.z + sz * t;
        }
        let dx = cx - qx, dz = cz - qz; const d = Math.hypot(dx, dz);
        const pen = CR + o.r - d;
        if (pen <= 0) continue;
        if (d < 1e-4) { dx = -Fx; dz = -Fz; } else { dx /= d; dz /= d; }
        const rx = Fx * off, rz = Fz * off;
        const pvx = v[0] + this.w[1] * rz, pvz = v[2] - this.w[1] * rx;
        const vn = pvx * dx + pvz * dz;
        if (o.kind === 1) {
          if (Math.abs(vn) > 2.2 || this.speed > 5) { o.dead = true; this.events.push({ type: 'smash', ref: o.ref, v: this.speed, x: qx, z: qz }); const k2 = this.mass > 600 ? 0.94 : 0.8; v[0] *= k2; v[2] *= k2; continue; }
        }
        p[0] += dx * pen; p[2] += dz * pen;
        if (vn < 0) {
          const rn = rz * dx - rx * dz;
          const denom = 1 / this.mass + (rn * rn) / this.Ib[1];
          const J = (-(1 + 0.18) * vn) / denom;
          v[0] += (dx * J) / this.mass; v[2] += (dz * J) / this.mass;
          this.w[1] += (rn * J) / this.Ib[1];
          const tvx = pvx - dx * vn, tvz = pvz - dz * vn;
          v[0] -= tvx * 0.12; v[2] -= tvz * 0.12;
          if (-vn > 2.5) this.events.push({ type: 'hit', v: -vn, x: qx, z: qz, ref: o.ref });
        }
      }
    }
  }
}

// Yo'l bo'ylab avtopilot (sinov, raqiblar va trafik uchun). path: [[x,z,(y)],...]
export class Autopilot {
  constructor(path, opts = {}) { this.path = path; this.i = 0; this.maxSpeed = opts.maxSpeed || 22; this.done = false; }
  input(car) {
    const path = this.path, n = path.length, p = car.p;
    let best = 1e18, bi = this.i;
    for (let k = this.i; k < Math.min(n, this.i + 25); k++) { const dx = path[k][0] - p[0], dz = path[k][1] - p[2]; const d = dx * dx + dz * dz; if (d < best) { best = d; bi = k; } }
    this.i = bi;
    if (bi >= n - 2) { this.done = true; return { throttle: 0, brake: 1, steer: 0 }; }
    const sp = Math.abs(car.fwd);
    const look = clamp(5 + sp * 0.55, 6, 26);
    let acc = 0, k = bi;
    while (k < n - 1 && acc < look) { acc += Math.hypot(path[k + 1][0] - path[k][0], path[k + 1][1] - path[k][1]); k++; }
    const tx = path[k][0] - p[0], tz = path[k][1] - p[2];
    const yaw = car.yaw;
    const lx = tx * Math.cos(yaw) - tz * Math.sin(yaw);
    const lz = tx * Math.sin(yaw) + tz * Math.cos(yaw);
    const ang = Math.atan2(lx, lz);
    const steer = clamp(ang * 2.2, -1, 1);
    let k2 = k; acc = 0; while (k2 < n - 1 && acc < 20 + sp * 1.4) { acc += Math.hypot(path[k2 + 1][0] - path[k2][0], path[k2 + 1][1] - path[k2][1]); k2++; }
    const a1 = Math.atan2(path[Math.min(n - 1, bi + 2)][0] - path[bi][0], path[Math.min(n - 1, bi + 2)][1] - path[bi][1]);
    const a2 = Math.atan2(path[k2][0] - path[Math.max(0, k2 - 2)][0], path[k2][1] - path[Math.max(0, k2 - 2)][1]);
    let da = Math.abs(a2 - a1); if (da > Math.PI) da = 2 * Math.PI - da;
    const target = clamp(this.maxSpeed * (1 - da * 0.75), 6, this.maxSpeed) * (Math.abs(ang) > 0.5 ? 0.6 : 1);
    let throttle = 0, brake = 0;
    if (sp < target - 0.5) throttle = clamp((target - sp) * 0.5, 0.2, 1); else if (sp > target + 2.5) brake = clamp((sp - target) * 0.15, 0, 1);
    if (car.fwd < -0.5) { throttle = 1; brake = 0; }
    return { throttle, brake, steer };
  }
}
