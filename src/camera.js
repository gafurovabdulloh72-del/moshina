// Kuzatuvchi kamera: prujinali ergashish (tezlanishda orqada qolish, tormozda yaqinlashish, burilishda kechikish va og'ish), yo'l titrashi, yo'nalishli zarba silkinishi, devor/yerga kirmaslik, kapot va piyoda (yelka ortidan) rejimlari, durbin
import * as THREE from 'three';
import { clamp, angDiff } from './util.js';
import * as T from './terrain.js';
import * as COL from './colliders.js';

const MODES = [
  { name: 'Yaqin', dist: 8.2, h: 2.9, look: 1.1 },
  { name: 'Uzoq', dist: 13.5, h: 5.2, look: 1.0 },
  { name: 'Kapot', dist: 0, h: 0, look: 0 },
  { name: 'Kino', dist: 11, h: 2.2, look: 1.0 },
];
const FOOT = { dist: 4.4, h: 1.75, look: 1.58, side: 0.72 };
// sirt bo'yicha yo'l titrashi (SURF tartibida): yo'l, o't, qum, qor, tosh/shag'al, taxta, suv, muz, asfalt
const ROUGH = [0.32, 0.85, 0.7, 0.6, 1.3, 1.0, 0.35, 0.08, 0.14];
// silliq tasodifiy tebranish (bir nechta o'zaro karrali bo'lmagan sinuslar yig'indisi): -1..1, takrorlanmaydi, sakramaydi
const wob = (t, s) => Math.sin(t * 1.13 + s) * 0.5 + Math.sin(t * 2.71 + s * 1.7) * 0.3 + Math.sin(t * 4.37 + s * 2.9) * 0.2;
// ikkinchi tartibli prujina (x — siljish, v — tezlik): w — chastota (rad/s), z — so'nish, f — tashqi tezlanish; mayda qadamlar bilan barqaror
function spring(o, k, w, z, f, dt) {
  const n = Math.max(1, Math.ceil(dt * w / 0.35)), h = dt / n;
  for (let i = 0; i < n; i++) { o.v[k] += (-w * w * o.x[k] - 2 * z * w * o.v[k] + f) * h; o.x[k] += o.v[k] * h; }
}
const reduceMotion = () => { try { return !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { return false; } };
const _q = new THREE.Vector3();

export class ChaseCam {
  constructor(camera) {
    this.cam = camera; this.mode = 0; this.heading = 0; this.yawOff = 0; this.pitchOff = 0; this.zoom = 1;
    this.idle = 0; this.shake = 0; this.pos = new THREE.Vector3(); this.look = new THREE.Vector3(); this.orbitT = 0;
    this.first = true; this.fov = 60; this._v = new THREE.Vector3(); this.hgt = 0; this.distS = 8;
    // harakat kuchi: 1 — to'liq, 0.3 — "harakatni kamaytirish" (silkinish, titrash, og'ish, qo'lda ushlash). Sozlamadan o'zgartirish mumkin
    this.motion = reduceMotion() ? 0.3 : 1;
    this.sp = { x: [0, 0, 0], v: [0, 0, 0] }; // yo'nalish koordinatalaridagi prujina: 0 yon (chap), 1 tepa, 2 oldinga
    this.ang = { x: [0, 0, 0], v: [0, 0, 0] }; // burchak prujinasi: 0 bosh egish, 1 burilish, 2 og'ish — zarba silkinishi
    this.hv = 0; this.roll = 0; this.pull = 1; this.lift = 0; this.side = FOOT.side; this.t = 0; this.vib = 0;
    this.vp = [0, 0, 0]; this.cpP = new THREE.Vector3(); this.comp = [0, 0, 0, 0]; this.lookO = new THREE.Vector3(); this.aF = 0;
    // effektlar (fx.js) kuzatilayotgan transportni shu yerdan oladi
    this.link = camera.userData.safar = { tgt: null, foot: false, chase: this };
  }
  get modeName() { return MODES[this.mode].name; }
  next() { this.mode = (this.mode + 1) % MODES.length; this.yawOff = 0; this.pitchOff = 0; this.first = true; }
  snap() { this.first = true; this.yawOff = 0; this.pitchOff = 0; }
  _reset(tgt, cp) {
    for (let k = 0; k < 3; k++) { this.sp.x[k] = this.sp.v[k] = this.ang.x[k] = this.ang.v[k] = 0; }
    this.vp[0] = tgt.v[0]; this.vp[1] = tgt.v[1]; this.vp[2] = tgt.v[2]; this.hv = 0; this.roll = 0; this.pull = 1; this.lift = 0; this.lookO.set(0, 0, 0); this.aF = 0;
    this.cpP.copy(cp); if (tgt.wheels) for (let i = 0; i < 4; i++) this.comp[i] = tgt.wheels[i].comp;
  }
  // Ko'rish chizig'i to'silgan nuqta (0..1): yer, ko'prik, devor, katta tosh. a — burilish nuqtasi, b — istalgan kamera joyi
  _block(ax, ay, az, bx, by, bz, rad) {
    let tHit = 1; by = Math.max(by, T.ground(bx, bz, by + 1).y + 0.9); // kamera uchi baribir ko'tariladi — yer faqat oraliqda tekshiriladi
    for (let i = 1; i <= 5; i++) {
      const t = i / 6, x = ax + (bx - ax) * t, z = az + (bz - az) * t, y = ay + (by - ay) * t;
      if (T.ground(x, z, y + 0.6).y + 0.3 > y) { tHit = Math.max(0, t - 0.12); break; }
    }
    const dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz; if (L2 < 0.01) return tHit;
    const mx = (ax + bx) / 2, mz = (az + bz) / 2, list = COL.query(mx, mz, Math.sqrt(L2) / 2 + 2);
    for (let i = 0; i < list.length; i++) {
      const o = list[i]; if (o.kind) continue; // sinadigan narsalar (quti, to'siq) kamerani to'smaydi
      let t = 2;
      if (o.t === 0) {
        if (o.ref && o.ref.tree) { // daraxt: tanasi emas, shox-shabbasi — faqat kamera uchiga yaqin qismda (o'rmonda kamera tinimsiz sakramasin)
          const h = o.y1 - o.y0, cr = h * 0.2 + rad; t = rayCircle(ax, az, dx, dz, o.x, o.z, cr); if (t < 0.55 || t > 1) continue;
          const y = ay + (by - ay) * t; if (y < o.y0 + 1 + h * 0.25 || y > o.y1) continue; if (t < tHit) tHit = t; continue;
        }
        if (o.r < 0.9) continue; t = rayCircle(ax, az, dx, dz, o.x, o.z, o.r + rad);
      }
      else t = raySeg(ax, az, dx, dz, o.x, o.z, o.x2, o.z2, o.r + rad);
      if (t >= tHit) continue;
      const y = ay + (by - ay) * t; if (y > o.y1 + 0.2 || y < o.y0 - 0.5) continue;
      tHit = t;
    }
    return tHit;
  }
  // tgt: transport yoki piyoda (fwd, yaw, speed, v, R, nitroOn, wheels). cp: kuzatiladigan nuqta
  update(dt, tgt, cp, input, opts = {}) {
    const foot = !!opts.foot, cam = this.cam, M = foot ? FOOT : MODES[this.mode], mo = this.motion;
    const sp = Math.abs(tgt.fwd), spd = tgt.speed || 0;
    this.link.tgt = tgt; this.link.foot = foot;
    if (!(dt > 0)) dt = 1 / 60;
    this.t += dt;
    if (this.first || this.cpP.distanceToSquared(cp) > 30 * 30) this._reset(tgt, cp);
    this.cpP.copy(cp);
    // foydalanuvchi aylantirishi; qo'yib yuborilgach kamera asta (keskin emas) orqaga qaytadi
    if (input && input.mouse.down && (input.mouse.dx || input.mouse.dy)) { this.yawOff -= input.mouse.dx * 0.006; this.pitchOff = clamp(this.pitchOff + input.mouse.dy * 0.004, -0.3, 1.0); this.idle = 0; }
    else {
      this.idle += dt; const del = foot ? 3.5 : 2.2;
      if (this.idle > del && sp > (foot ? 1.5 : 3) && !opts.freeze) { const e = clamp((this.idle - del) / 1.4, 0, 1), k = 1 - Math.exp(-dt * 2.4 * e * e * (3 - 2 * e)); this.yawOff -= angDiff(this.yawOff, 0) * k; this.pitchOff -= this.pitchOff * k; }
    }
    if (input && input.mouse.wheel) this.zoom = clamp(this.zoom + input.mouse.wheel * 0.1, 0.6, 2.4);
    // transportning tezlanishi (dunyo koordinatalarida) — prujinali kameraning harakatlantiruvchisi
    const v = tgt.v, ax0 = clamp((v[0] - this.vp[0]) / dt, -160, 160), ay0 = clamp((v[1] - this.vp[1]) / dt, -160, 160), az0 = clamp((v[2] - this.vp[2]) / dt, -160, 160);
    this.vp[0] = v[0]; this.vp[1] = v[1]; this.vp[2] = v[2];
    // yo'nalish: tezlik vektori bilan aralash (drift paytida mashina yoni ko'rinadi)
    let target = tgt.yaw;
    if (!foot && spd > 6 && tgt.fwd > 0) { const vy = Math.atan2(v[0], v[2]); target = tgt.yaw + angDiff(vy, tgt.yaw) * 0.35; }
    if (this.first) { this.heading = target; this.hv = 0; }
    const err = angDiff(target, this.heading);
    if (foot) { // piyoda: sekin ergashadi (yon tomonga yurganda aylanib ketmasligi uchun)
      const rate = sp > 0.5 && Math.abs(err) < 2.2 ? 1.5 : 0; this.hv = err * (1 - Math.exp(-dt * rate)) / dt; this.heading += this.hv * dt;
    } else { // transport: kritik so'nuvchi ikkinchi tartib — burilishda kamera biroz kechikadi, keyin yumshoq yetib oladi
      const w = 5.2 + sp * 0.06, o = { x: [0], v: [this.hv] }; o.x[0] = -err; spring(o, 0, w, 1, 0, dt); this.hv = o.v[0]; this.heading = target + o.x[0];
    }
    // tezlikka bog'liq ko'rish burchagi — sezilar-sezilmas; tezlanish va nitroda bir oz kengayadi
    const aFw = ax0 * Math.sin(tgt.yaw) + az0 * Math.cos(tgt.yaw); this.aF += (aFw - this.aF) * Math.min(1, dt * 3);
    const fovT = opts.zoom ? 15 : foot ? 60 + Math.min(3, sp * 0.4) : 59 + Math.min(9, sp * 0.2) + (tgt.nitroOn ? 4 : 0) + clamp(this.aF * 0.25, -1, 2.5) * mo;
    this.fov += (fovT - this.fov) * Math.min(1, dt * (opts.zoom || this.fov < 30 ? 9 : 2.5));
    if (Math.abs(cam.fov - this.fov) > 0.05) { cam.fov = this.fov; cam.updateProjectionMatrix(); }

    // zarba: game.js `shake` ga kuch yozadi — uni tezlanish yo'nalishidagi turtki sifatida qabul qilamiz (tasodifiy titroq emas)
    const hx = Math.sin(this.heading), hz = Math.cos(this.heading);
    let aL = ax0 * hz - az0 * hx, aU = ay0, aF = ax0 * hx + az0 * hz;
    if (this.shake > 0.01) {
      const I = Math.min(1.4, this.shake) * mo, al = Math.hypot(aL, aU, aF) || 1, ux = aL / al, uy = aU / al, uz = aF / al;
      const vert = Math.abs(uy) > 0.7 || al < 25; // qo'nish yoki yo'nalishi noaniq zarba
      const A = this.ang.v; if (vert) { A[0] += -2.8 * I; A[2] += (Math.random() - 0.5) * 1.1 * I; } else { A[0] += uz * 3.4 * I; A[1] += -ux * 2.8 * I; A[2] += (-ux * 3.6 + (Math.random() - 0.5) * 1.2) * I; }
      const P = this.sp.v; if (!vert) { P[0] -= ux * 0.8 * I; P[2] -= uz * 0.8 * I; } P[1] -= (vert ? 1.4 : 0.5) * I;
      this.shake = 0;
    }
    for (let k = 0; k < 3; k++) spring(this.ang, k, 42, 0.2, 0, dt);
    // yo'l titrashi: tezlik × sirt g'adir-budurligi + osma siqilishining tezligi (haqiqiy chuqur/do'nglar)
    let cv = 0, rough = 0;
    if (tgt.wheels && !foot) { const W = tgt.wheels; let n = 0; for (let i = 0; i < 4; i++) { const w = W[i]; cv += Math.abs(w.comp - this.comp[i]); this.comp[i] = w.comp; if (w.on) { rough += ROUGH[w.surf] || 0.4; n++; } } cv /= dt * 4; rough = n ? rough / n : 0; }
    const vibT = foot ? 0 : Math.min(0.07, spd * 0.0012 * rough + Math.min(1.5, cv) * 0.02) * mo;
    this.vib += (vibT - this.vib) * Math.min(1, dt * 8);
    const tt = this.t, vibY = this.vib * wob(tt * 9.1, 1.3), vibX = this.vib * 0.5 * wob(tt * 7.3, 4.1), vibP = this.vib * 0.25 * wob(tt * 8.2, 2.2);

    if (opts.zoom) { // durbin: ko'z balandligidan qaraladi
      const a = this.heading + this.yawOff; cam.position.set(cp.x, cp.y + 1.62, cp.z);
      this.look.set(cp.x + Math.sin(a) * 50, cp.y + 1.62 - this.pitchOff * 30 + wob(tt * 0.9, 3) * 0.25 * mo, cp.z + Math.cos(a) * 50); cam.lookAt(this.look); this.first = false; return;
    }
    if (this.mode === 2 && !foot) {
      // kapot kamerasi: haydovchi boshi tezlanishda biroz ortga/oldinga og'adi; dvigatel va yo'l titrashi
      const R = tgt.R, hy = (opts.hgt || 1.85) * 0.52, fz = (opts.len || 4) * 0.09;
      spring(this.sp, 2, 7, 0.7, -clamp(aF, -40, 40) * 0.6, dt); spring(this.sp, 0, 8, 0.7, -clamp(aL, -40, 40) * 0.4, dt); spring(this.sp, 1, 10, 0.5, -clamp(aU, -60, 60) * 0.5, dt);
      const S = this.sp.x, bz = clamp(S[2], -0.12, 0.12) + fz, bx = clamp(S[0], -0.08, 0.08), rpm = tgt.rpm || 0, eng = (0.0015 + rpm * 0.003) * mo * (tgt.spec && tgt.spec.power < 1500 ? 0 : 1);
      const by = hy + clamp(S[1], -0.1, 0.06) + vibY * 0.7 + eng * wob(tt * 31, 0.7);
      cam.position.set(cp.x + R[1] * by + R[2] * bz + R[0] * bx, cp.y + R[4] * by + R[5] * bz + R[3] * bx, cp.z + R[7] * by + R[8] * bz + R[6] * bx);
      const a = tgt.yaw + this.yawOff;
      this.look.set(cam.position.x + R[2] * 10, cam.position.y + R[5] * 10 - 0.6 - this.pitchOff * 6, cam.position.z + R[8] * 10);
      if (this.yawOff) this.look.set(cam.position.x + Math.sin(a) * 10, cam.position.y - 0.6 - this.pitchOff * 6, cam.position.z + Math.cos(a) * 10);
      cam.up.set(R[1], R[4], R[7]); cam.lookAt(this.look); cam.up.set(0, 1, 0);
      const A = this.ang.x; cam.rotateX(A[0] * 0.6 + vibP * 1.5 + clamp(S[2], -0.12, 0.12) * 0.15); cam.rotateY(A[1] * 0.6); cam.rotateZ(A[2] * 0.6 + eng * 0.5 * wob(tt * 27, 2));
      this.first = false; return;
    }
    if (this.mode === 3 && !foot) this.orbitT += dt * 0.22;
    const a = this.heading + this.yawOff + (this.mode === 3 && !foot ? this.orbitT : 0);
    // transport kattaligiga qarab masofa
    const ks = foot ? 1 : clamp(0.55 + (opts.len || 4) / 8.9, 0.72, 1.75), kh = foot ? 1 : clamp((opts.hgt || 1.85) / 1.85, 0.7, 1.7);
    const distT = M.dist * this.zoom * ks * (1 + (foot ? Math.min(0.12, sp * 0.02) : Math.min(0.18, sp * 0.004)));
    if (this.first) this.distS = distT; this.distS += (distT - this.distS) * Math.min(1, dt * 4);
    const dist = this.distS, pitch = this.pitchOff;
    const ox = Math.sin(a), oz = Math.cos(a), lx = oz, lz = -ox; // kamera yo'nalishi va uning chap tomoni
    // prujina: transport tezlansa kamera orqada qoladi, tormozlasa yaqinlashadi, burilishda tashqariga suriladi, qo'nishda pastga "o'tiradi"
    const g = foot ? 0.35 : 1, gk = mo * 0.6 + 0.4;
    spring(this.sp, 2, foot ? 5 : 3.2, 0.82, -clamp(aF, -60, 60) * g * gk, dt);
    spring(this.sp, 0, foot ? 6 : 4.6, 0.85, -clamp(aL, -60, 60) * g * 0.8 * gk, dt);
    spring(this.sp, 1, foot ? 9 : 7.5, 0.5, -clamp(aU, -90, 90) * (foot ? 0.4 : 0.75) * gk, dt);
    const S = this.sp.x; S[2] = clamp(S[2], -1.8 * ks, 1.1 * ks); S[0] = clamp(S[0], -0.9 * ks, 0.9 * ks); S[1] = clamp(S[1], -0.75, 0.5);
    // yelka (piyoda): devor bor tomondan ikkinchi yelkaga o'tadi
    let side = 0;
    if (foot) {
      const hy = cp.y + M.look, r = 0.9, bR = this._block(cp.x, hy, cp.z, cp.x - lx * r, hy, cp.z - lz * r, 0.25), bL = this._block(cp.x, hy, cp.z, cp.x + lx * r, hy, cp.z + lz * r, 0.25);
      const sT = bR > 0.95 ? M.side : bL > 0.95 ? -M.side : 0; this.side += (sT - this.side) * Math.min(1, dt * 3); side = this.side;
    }
    // aylanish nuqtasi (kamera shu nuqtadan qaraydi) va istalgan kamera joyi
    const px = cp.x - lx * side, pz = cp.z - lz * side, py = cp.y + (foot ? M.look : M.look * kh + 0.4);
    let tx = cp.x - ox * dist * Math.cos(pitch) - lx * side + lx * S[0] + ox * S[2], tz = cp.z - oz * dist * Math.cos(pitch) - lz * side + lz * S[0] + oz * S[2];
    let ty = cp.y + M.h * this.zoom * (foot ? 1 : 0.5 + 0.5 * kh) * (0.75 + 0.25 * ks) + dist * Math.sin(pitch) + S[1];
    // to'siq: devor/tepalik ko'rishni to'ssa kamera darhol yaqinlashadi, ochilgach sekin qaytadi
    const tb = clamp(this._block(px, py, pz, tx, ty, tz, foot ? 0.3 : 0.45), foot ? 0.22 : 0.25, 1);
    if (this.first) this.pull = tb; else if (tb < this.pull) this.pull = tb; else this.pull += (tb - this.pull) * Math.min(1, dt * 1.6);
    const pl = this.pull; tx = px + (tx - px) * pl; tz = pz + (tz - pz) * pl; ty = py + (ty - py) * pl + (1 - pl) * (foot ? 0.35 : 1.0);
    // yer, ko'prik va suv ostiga tushmaslik (yumshoq ko'tariladi)
    const gy = Math.max(T.ground(tx, tz, ty + 1).y, opts.water != null ? opts.water : -1e9) + (foot ? 0.45 : 0.9);
    const need = Math.max(0, gy - ty);
    if (this.first) this.lift = need; else this.lift += (need - this.lift) * Math.min(1, dt * (need > this.lift ? 14 : 2.5));
    ty += Math.max(this.lift, need - 0.25);
    if (this.first) { this.hgt = ty; this.first = false; }
    // qo'lda ushlangandek sekin suzish (piyoda turganda), titrash
    const still = foot ? clamp(1 - sp / 1.2, 0, 1) * mo : 0, hh = 0.035 * still;
    cam.position.set(tx + lx * (vibX + hh * wob(tt * 0.31, 5.1)), ty + vibY + hh * wob(tt * 0.23, 8.4), tz + lz * (vibX + hh * wob(tt * 0.31, 5.1)));
    // qarash nuqtasi: tezlik yo'nalishida biroz oldinga (driftda harakat tomonga)
    let lox = 0, loz = 0;
    if (!foot) { const la = clamp(spd * 0.06, 0, 2.4) * (tgt.fwd >= 0 ? 1 : 0.3), vl = Math.hypot(v[0], v[2]) || 1; lox = ox * 2.2 + (spd > 2 ? (v[0] / vl) * la : 0); loz = oz * 2.2 + (spd > 2 ? (v[2] / vl) * la : 0); }
    this.lookO.x += (lox - this.lookO.x) * Math.min(1, dt * 5); this.lookO.z += (loz - this.lookO.z) * Math.min(1, dt * 5);
    if (foot) this.look.set(px + ox * 0.6, cp.y + M.look + hh * 0.5 * wob(tt * 0.27, 1.9), pz + oz * 0.6);
    else this.look.set(cp.x + this.lookO.x, cp.y + M.look * kh + S[1] * 0.35, cp.z + this.lookO.z);
    cam.lookAt(this.look);
    // burilishga og'ish (kichik) va burchak silkinishi
    const rollT = foot ? 0 : clamp(this.hv * Math.min(spd, 40) * 0.0016, -0.04, 0.04) * mo;
    this.roll += (rollT - this.roll) * Math.min(1, dt * 3);
    const A = this.ang.x; cam.rotateX(A[0] + vibP + hh * 0.15 * wob(tt * 0.19, 6.6)); cam.rotateY(A[1] + hh * 0.2 * wob(tt * 0.17, 3.3)); cam.rotateZ(this.roll + A[2]);
    this.pos.copy(cam.position);
  }
}
// 2D nur (a + d·t, t 0..1) va doira kesishuvi
function rayCircle(ax, az, dx, dz, cx, cz, r) {
  const fx = ax - cx, fz = az - cz, A = dx * dx + dz * dz, B = 2 * (fx * dx + fz * dz), C = fx * fx + fz * fz - r * r;
  if (C < 0) return 2; // nuqta doira ichida — e'tiborsiz (mashina daraxtga tiralgan bo'lsa ham kamera sakramasin)
  const D = B * B - 4 * A * C; if (D < 0) return 2;
  const t = (-B - Math.sqrt(D)) / (2 * A); return t >= 0 && t <= 1 ? t : 2;
}
// 2D nur va kapsula (kesma + radius) kesishuvi: kesma bo'ylab namunalar orqali (oddiy va yetarli)
function raySeg(ax, az, dx, dz, x1, z1, x2, z2, r) {
  const sx = x2 - x1, sz = z2 - z1, den = dx * sz - dz * sx;
  let best = 2;
  if (Math.abs(den) > 1e-6) { // markaziy chiziqni kesib o'tish
    const t = ((x1 - ax) * sz - (z1 - az) * sx) / den, u = ((x1 - ax) * dz - (z1 - az) * dx) / den;
    if (t >= 0 && t <= 1 && u >= 0 && u <= 1) { const L = Math.hypot(dx, dz) || 1, sl = Math.hypot(sx, sz) || 1, sn = Math.abs(den) / (L * sl); best = Math.max(0, t - r / (L * Math.max(0.2, sn))); }
  }
  for (let i = 0; i <= 8; i++) { const t = i / 8, qx = ax + dx * t, qz = az + dz * t; const L2 = sx * sx + sz * sz || 1, u = clamp(((qx - x1) * sx + (qz - z1) * sz) / L2, 0, 1); if (Math.hypot(qx - x1 - sx * u, qz - z1 - sz * u) < r) { if (i === 0) return 2; best = Math.min(best, Math.max(0, t - 0.125)); break; } }
  return best;
}
