// Suv va havo sayohati: qayiq ijarasi (Bandargoh, Ko'zgu ko'l), yelkanli qayiq (shamol), Cho'qqidan deltaplan — o'tirish/tushish, kamera, HUD (shamol o'qi), xarita belgilari, qayiqdan baliq ovi
// O'yinchi bu paytda piyoda hisoblanadi (pl.onFoot), lekin harakatsiz: joyi har qadam qayiq/deltaplandagi o'rindiqqa qo'yiladi (coop.js yo'lovchisi kabi). physics.js o'zgarmagan.
import * as THREE from 'three';
import * as T from './terrain.js';
import * as COL from './colliders.js';
import { GB, MAT } from './geo.js';
import { PAL } from './blocks.js';
import { makeRider, poseRider, setHat } from './rig.js';
import { lookRigOpts } from './hayot2.js';
import { buildRowBoat, buildSailBoat, boatStep, depthAt } from './qayiq.js';
import { buildGlider, glideStep, rampGeo } from './deltaplan.js';
import { clamp, angDiff } from './util.js';

export const PRICE = { row: 60, sail: 200, glide: 150 };
const NAME = { row: 'Eshkakli qayiq', sail: 'Yelkanli qayiq', glide: 'Deltaplan' }, DAT = { row: 'Eshkakli qayiqqa', sail: 'Yelkanli qayiqqa' };
const DOT = { row: '#35d6c8', sail: '#35d6c8', glide: '#c58bff' };

export function initSuv(game) {
  const { scene } = game, pl = game.player, st = game.state, L = game.live;
  st.suv = Object.assign({ row: 0, sail: 0, glide: 0, km: 0, best: 0, fish: 0 }, st.suv || {}); // eski saqlovda bo'lmasa — standart
  const toast = (m, k) => game.toast(m, k), sfx = (n, k) => game.audio.sfx(n, k);
  const S = (game.suv = { cur: null, boats: [], glider: null, auto: null, windF: null, fish: null, from: null });
  const P = T.placeBy, W = (p, yaw, lx, lz) => [p.x + lx * Math.cos(yaw) + lz * Math.sin(yaw), p.z - lx * Math.sin(yaw) + lz * Math.cos(yaw)];

  // ---------- qayiqlar ----------
  const bp = P.bandargoh, by = Math.atan2(bp.x, bp.z), kp = P.kol, ky = Math.atan2(T.LAKE.x - kp.x, T.LAKE.z - kp.z);
  // bezak qayiqlar (places.js) ichidan o'tib ketmaslik uchun
  const deco = [[bp, by, [[-7, 104], [7.5, 120], [-8, 138], [8, 92]]], [kp, ky, [[5, 123], [-5.5, 141]]]].flatMap(([p, y, l]) => l.map(([a, b]) => W(p, y, a, b).concat(2.1)));
  const mkBoat = (kind, place, p, yaw0, lx, lz, hex, turn) => {
    const [x, z] = W(p, yaw0, lx, lz), yaw = yaw0 + turn, m = kind === 'sail' ? buildSailBoat() : buildRowBoat(hex); scene.add(m.root);
    const b = { kind, place, name: NAME[kind], m, home: [x, z, yaw], x, z, yaw, v: 0, w: 0, sail: 0.6, th: 0, eff: 0, beach: false, paid: false, wy: T.waterY(x, z), ph: (x * 0.37 + z * 0.11) % 6.28, rider: null, rd: null, boom: 0, belly: 1, extra: deco };
    S.boats.push(b); return b;
  };
  mkBoat('row', 'bandargoh', bp, by, -7.5, 118, 0x2f9a8a, -0.6); mkBoat('sail', 'bandargoh', bp, by, 8, 142, 0, 0.5); mkBoat('row', 'kol', kp, ky, -5.5, 112, 0xd8392b, -0.6); // tumshug'i iskaladan chetga qaragan

  // ---------- deltaplan: Cho'qqi chetidagi eng yaxshi qoya (keyingi 500 m yer sirpanish yo'lidan past) ----------
  const cq = P.choqqi; let la = 5.9, lr = 115, lh = 0, need = 1e9;
  for (let a = 0; a < 6.283; a += 0.05) { let rb = 0, hb = -1e9; for (let r = 60; r <= 170; r += 5) { const h = T.gridHeight(cq.x + Math.sin(a) * r, cq.z + Math.cos(a) * r); if (h > hb) { hb = h; rb = r; } }
    let nd = -1e9; for (let d = 20; d <= 500; d += 10) nd = Math.max(nd, T.gridHeight(cq.x + Math.sin(a) * (rb + d), cq.z + Math.cos(a) * (rb + d)) - (hb - d / 7)); if (nd < need) { need = nd; la = a; lr = rb; lh = hb; } }
  const rx = cq.x + Math.sin(la) * lr, rz = cq.z + Math.cos(la) * lr, ry = T.gridHeight(rx, rz);
  { const m = new THREE.Mesh(rampGeo(), MAT.flat); m.position.set(rx, ry + 0.9, rz); m.rotation.y = la; m.castShadow = m.receiveShadow = true; scene.add(m); }
  // ijara joyi: rasadxona maydonida, qoya tomonda, bo'sh joy
  let kx = cq.x + Math.sin(la) * 26, kz = cq.z + Math.cos(la) * 26;
  for (let i = 0; i < 40; i++) { const a = la + (i % 2 ? 1 : -1) * Math.floor((i + 1) / 2) * 0.25, r = 24 + (i % 3) * 6, x = cq.x + Math.sin(a) * r, z = cq.z + Math.cos(a) * r; if (Math.abs(T.gridHeight(x, z) - cq.y) > 1.5) continue; let ok = true; for (const o of COL.query(x, z, 4)) if (Math.hypot(o.x - x, o.z - z) < 5) { ok = false; break; } if (ok) { kx = x; kz = z; break; } }
  { const g = new GB(851); g.jit = 0.03; const ky2 = T.gridHeight(kx, kz); g.translate(kx, ky2, kz).rotY(la);
    g.color(PAL.woodD); for (const sx of [-1.3, 1.3]) for (const sz of [-0.9, 0.9]) g.box(sx, 1.2, sz, 0.14, 2.4, 0.14); g.color(0xff5a36); g.push().rotY(0); g.gable(3.2, 2.4, 0.7, 2.4, 0.2); g.pop();
    g.color(PAL.wood).box(0, 0.55, 0.8, 2.6, 1.1, 0.4); g.color(0xf0b83a).box(0, 1.2, 0.8, 2.7, 0.12, 0.5); g.color(0x2f7fd0).box(0, 0.6, 1.02, 1.6, 0.5, 0.03);
    g.color(PAL.metalD).box(1.9, 1.5, 0.6, 0.06, 3.0, 0.06); g.color(0xff8a3a); g.box(1.9, 2.8, 0.95, 0.03, 0.28, 0.6); COL.addCircle(kx, kz, 1.4, ky2 - 1, ky2 + 3);
    const m = new THREE.Mesh(g.build(), MAT.flat); m.castShadow = m.receiveShadow = true; scene.add(m); }
  { const m = buildGlider(); scene.add(m.root);
    S.glider = { kind: 'glide', name: NAME.glide, m, kiosk: [kx, kz], launch: { x: rx + Math.sin(la) * 3.5, y: ry + 0.9 + 0.95, z: rz + Math.cos(la) * 3.5, yaw: la }, x: rx, y: ry + 1.9, z: rz, yaw: la, v: 0, bank: 0, vy: 0, lift: 0, t: 0, landed: null, rider: null, rd: null }; }
  const gl = S.glider;
  const parkGlider = () => { const q = gl.launch; gl.landed = null; gl.m.root.position.set(q.x - Math.sin(q.yaw) * 3.5, q.y, q.z - Math.cos(q.yaw) * 3.5); gl.m.root.rotation.y = q.yaw; gl.m.tilt.rotation.set(0, 0, 0); };
  parkGlider();

  // ---------- chavandoz (o'yinchi ko'rinishida) ----------
  const RD = { // makeRider ma'lumoti: hip, qo'llar, oyoqlar (ota guruh — model ichidagi seat)
    row: () => ({ hip: [0, 0.1, 0], lean: 0.1, hand: [0.46, 0.3, 0.5], foot: [0.2, -0.25, 0.62], knee: 0.2 }),
    sail: () => ({ hip: [0, 0.1, 0], lean: -0.12, hand: [0.24, 0.26, 0.38], foot: [0.18, -0.28, 0.55], knee: 0.2 }),
    glide: () => ({ hip: [0, 0, 0], lean: -0.32, hand: [0.5, 0.38, 0.4], foot: [0.16, -0.55, 0.42], knee: 0.28 }),
  };
  const riderFor = (o) => {
    const key = JSON.stringify(st.look || null) + '|' + (st.hat || ''); if (o.rider && o.rKey === key) { o.rider.root.visible = true; return; }
    if (o.rider) { o.m.seat.remove(o.rider.root); o.rider.mesh.geometry.dispose(); if (o.rider.mesh.skeleton) o.rider.mesh.skeleton.dispose(); }
    o.rd = RD[o.kind](); const r = makeRider(o.rd, lookRigOpts(st.look)); if (st.hat) setHat(r, st.hat); o.m.seat.add(r.root); o.rider = r; o.rKey = key;
  };

  // ---------- shamol: fx.js dagi sekin o'zgaruvchi shamol yo'nalishi; kuchi — 4..9 m/s, bo'ronda kuchliroq ----------
  const wnd = { x: 0, z: 6, s: 6 };
  S.wind = () => { if (S.windF) { const [a, s] = S.windF; wnd.x = Math.sin(a) * s; wnd.z = Math.cos(a) * s; wnd.s = s; return wnd; }
    const w = game.fx ? game.fx.wind : [1.3, 0, 0.5], a = Math.atan2(w[0], w[2]), s = 4 + 2.2 * Math.hypot(w[0], w[2]) + 4 * ((game.dunyo && game.dunyo.cur.storm) || 0);
    wnd.x = Math.sin(a) * s; wnd.z = Math.cos(a) * s; wnd.s = s; return wnd; };
  S.windSet = (a, s = 6) => { S.windF = a == null ? null : [a, s]; return S.wind(); }; // sinov: shamolni qotirish (radian — esayotgan yo'nalish)

  // ---------- o'tirish va tushish ----------
  const hidePl = () => { pl.lock = 1e9; pl.lockAnim = 'sit'; pl.lockFn = null; pl.sit = false; pl.emote = null; pl.v[0] = pl.v[1] = pl.v[2] = 0; pl.rig.root.visible = false; pl.lamp.intensity = 0; L.fishing = null; };
  const showPl = () => { pl.lock = 0; pl.lockAnim = null; pl.rig.root.visible = true; };
  S.enter = (o, free) => {
    if (S.cur || !pl.onFoot) return false;
    if (game.act) { toast('Chellenj vaqtida bo\'lmaydi ([X] — bekor qilish)', 'bad'); return false; }
    if (game.coop && game.coop.ride) return false;
    const pay = o.kind === 'glide' || !o.paid;
    if (pay && !free) { if (st.money < PRICE[o.kind]) { toast(`Pul yetarli emas (${PRICE[o.kind]} so'm)`, 'bad'); return false; } game.addMoney(-PRICE[o.kind], o.name + ' ijarasi'); sfx('buy'); }
    S.from = [pl.p[0], pl.p[1], pl.p[2]]; S.cur = o; S.fish = null; hidePl(); riderFor(o);
    if (o.kind === 'glide') { const q = gl.launch; gl.x = q.x; gl.y = q.y; gl.z = q.z; gl.yaw = q.yaw; gl.v = 10.5; gl.bank = 0; gl.vy = 0; gl.t = 0; gl.dist = 0; gl.landed = null; st.suv.glide++;
      const f = game.ui && game.ui.fade; if (f) { f.style.opacity = 1; setTimeout(() => (f.style.opacity = 0), 420); }
      game.banner('Deltaplan 🪂', "W — tezlashish · S — sekinlash · A/D — burilish. Yumshoq qo'ning!", 'start'); }
    else { if (pay) { o.paid = true; st.suv[o.kind]++; } o.v = 0; o.w = 0; sfx('splash');
      toast(o.kind === 'sail' ? '⛵ W — yelkanni tortish, S — bo\'shatish, A/D — rul. Shamolga qarshi to\'g\'ri suzib bo\'lmaydi — ilon izi bilan boring' : '🚣 W/S — eshkak, A/D — burilish, F — tushish', 'gold'); }
    game.cam.snap(); syncAll(0); seatPl(); return true;
  };
  // qayiq yonidan quruqlik yoki iskala topish; topilmasa — suvga
  const exitSpot = (b) => {
    for (const r of [2.2, 3.0, 4.2, 5.6, 7.0]) for (let i = 0; i < 16; i++) { const a = b.yaw + Math.PI / 2 + (i % 2 ? 1 : -1) * Math.floor((i + 1) / 2) * 0.39, x = b.x + Math.sin(a) * r, z = b.z + Math.cos(a) * r;
      const gy = T.ground(x, z, b.wy + 5).y; if (gy < b.wy + 0.05 || gy > b.wy + 4.6) continue; let ok = true; for (const o of COL.query(x, z, 1)) { if (o.t !== 0 || o.y1 < gy + 0.3 || o.y0 > gy + 1.7) continue; if (Math.hypot(o.x - x, o.z - z) < o.r + 0.4) { ok = false; break; } } if (ok) return [x, z, true]; }
    return [b.x + Math.sin(b.yaw + Math.PI / 2) * 1.8, b.z + Math.cos(b.yaw + Math.PI / 2) * 1.8, false];
  };
  S.off = () => {
    const o = S.cur; if (!o) return false;
    if (o.kind === 'glide') { toast("Havoda tushib bo'lmaydi — pastlab, yumshoq qo'ning", 'bad'); return false; }
    const [x, z, land] = exitSpot(o); S.cur = null; S.fish = null; o.v = 0; o.w = 0; if (o.rider) o.rider.root.visible = false; showPl();
    pl.place(x, z, o.yaw); if (!land) { pl.p[1] = o.wy - 1.0; toast('Suvga sakradingiz — qirg\'oqqa suzib chiqing (qayiq shu yerda kutadi)'); } else toast(`${o.name}dan tushdingiz. Qayiq shu yerda — [E] bilan yana o'tirasiz`);
    sfx('splash'); game.cam.snap(); return true;
  };
  const landGlider = (water) => {
    const vs = -gl.vy, soft = !water && gl.v < 13.6 && vs < 2.9, d = Math.round(Math.hypot(gl.x - gl.launch.x, gl.z - gl.launch.z));
    S.cur = null; if (gl.rider) gl.rider.root.visible = false; showPl(); pl.place(gl.x, gl.z, gl.yaw);
    gl.landed = { x: gl.x, z: gl.z, yaw: gl.yaw, water }; const gy = water ? T.waterY(gl.x, gl.z) : T.ground(gl.x, gl.z, gl.y + 1).y;
    gl.m.root.position.set(gl.x - Math.sin(gl.yaw) * 1.2, gy + (water ? 0.2 : 0.55), gl.z - Math.cos(gl.yaw) * 1.2); gl.m.tilt.rotation.set(water ? 0.05 : -0.18, 0, water ? 0 : 0.12);
    const pay = Math.min(300, Math.floor(d / 100) * 10) + (soft ? 50 : 0); if (pay > 0) game.addMoney(pay, 'Deltaplan parvozi');
    if (d > st.suv.best) st.suv.best = d;
    if (water) { pl.p[1] = T.waterY(gl.x, gl.z) - 1.0; sfx('splash'); toast(`Suvga qo'ndingiz! Parvoz ${d} m · +${pay} so'm`, 'gold'); }
    else if (soft) { sfx('medal'); game.banner("Yumshoq qo'nish! 🪂", `Parvoz ${d} m · +${pay} so'm${d >= st.suv.best ? ' · yangi rekord' : ''}`, 'gold'); game.live.count && game.live.count('glide'); }
    else { sfx('land'); pl.act('fall', 1.5, null); toast(`Qattiq qo'ndingiz — hech gap yo'q, o'rningizdan turing. Parvoz ${d} m · +${pay} so'm`, pay ? 'gold' : ''); }
    game.cam.snap(); return (S.last = { soft, d, pay, water, x: gl.x, z: gl.z });
  };

  // ---------- har qadam ----------
  const axes = (inp) => { if (S.auto) return S.auto; if (!inp) return [0, 0]; const t = inp.touch;
    return [clamp((inp.down('KeyW', 'ArrowUp') ? 1 : 0) - (inp.down('KeyS', 'ArrowDown') ? 1 : 0) + (t.gas ? 1 : 0) - (t.brake ? 1 : 0) - (t.jy || 0), -1, 1), clamp((inp.down('KeyA', 'ArrowLeft') ? 1 : 0) - (inp.down('KeyD', 'ArrowRight') ? 1 : 0) + (t.steer || 0) - (t.jx || 0), -1, 1)]; };
  let lastIn = [0, 0];
  const seatPl = () => { const o = S.cur; if (!o) return; const yy = o.kind === 'glide' ? o.y - 0.9 : o.wy + 0.3, v = o.kind === 'glide' ? o.v : o.v;
    pl.p[0] = o.x; pl.p[1] = yy; pl.p[2] = o.z; pl.yaw = o.yaw; pl.v[0] = Math.sin(o.yaw) * v; pl.v[2] = Math.cos(o.yaw) * v; pl.v[1] = o.kind === 'glide' ? o.vy : 0; pl.speed = Math.abs(v); pl.fwd = Math.abs(v); pl.anim = 'sit'; pl.rig.root.visible = false; pl.lamp.intensity = 0; };
  const ride = (dt, inp) => {
    const o = S.cur, [f, s] = (lastIn = axes(inp)), n = Math.max(1, Math.ceil(dt * 120 - 0.01)), h = dt / n;
    if (o.kind === 'glide') {
      const wind = S.wind();
      for (let i = 0; i < n; i++) { const x0 = gl.x, z0 = gl.z; glideStep(gl, h, f, s, wind); gl.t += h; gl.dist += Math.hypot(gl.x - x0, gl.z - z0);
        const gh = T.ground(gl.x, gl.z, gl.y + 2).y, wy = T.waterY(gl.x, gl.z), floor = Math.max(gh, wy);
        if (!(gl.y === gl.y)) { gl.y = floor + 1; gl.vy = 0; } // NaN'dan himoya
        if (gl.y - 0.95 <= floor) { if (gl.t < 1.2 && wy < gh) { gl.y = gh + 0.95; continue; } gl.y = floor + 0.95; seatPl(); landGlider(wy > gh); return; }
        if (Math.abs(gl.x) > T.HALF + 400 || Math.abs(gl.z) > T.HALF + 400) gl.yaw += 0.6 * h; // orol chegarasidan nariga uchmasin
      }
    } else {
      if (S.fish && (Math.abs(f) > 0.2 || Math.abs(s) > 0.2 || Math.abs(o.v) > 0.9)) { S.fish = null; toast('Qarmoq yig\'ildi'); }
      const wind = o.kind === 'sail' ? S.wind() : wnd;
      for (let i = 0; i < n; i++) { const x0 = o.x, z0 = o.z; boatStep(o, h, f, s, wind, o.extra); const dd = Math.hypot(o.x - x0, o.z - z0); st.suv.km += dd; }
      o.wy = T.waterY(o.x, o.z);
      if (S.fish) fishStep(dt);
    }
    syncAll(dt); seatPl();
  };
  const pu = pl.update; pl.update = function (dt, inp, camYaw, st2) { if (S.cur) return ride(dt, inp); return pu.call(this, dt, inp, camYaw, st2); };

  // ---------- ko'rinish: chayqalish, eshkaklar, yelkan, deltaplan qiyaligi ----------
  const syncBoat = (b, dt, ridden) => {
    const t = game.time, sea = b.wy < 1, amp = sea ? 0.14 : 0.05, m = b.m, ph = b.ph;
    m.root.position.set(b.x, b.wy + amp * Math.sin(t * 1.25 + ph) + amp * 0.4 * Math.sin(t * 2.7 + ph * 2), b.z); m.root.rotation.y = b.yaw;
    let heel = 0;
    if (b.kind === 'sail') {
      const wind = S.wind(), from = Math.atan2(-wind.x, -wind.z), rel = angDiff(from, b.yaw), side = rel >= 0 ? 1 : -1, eff = ridden ? b.eff : 0;
      const luff = Math.abs(rel) < 0.55 || !ridden, tgt = side * (clamp((Math.PI - Math.abs(rel)) * 0.5, 0.12, 1.35) + (1 - (ridden ? b.sail : 0.2)) * 0.35);
      b.boom += (tgt - b.boom) * Math.min(1, dt * 2.5); b.belly += (-side - b.belly) * Math.min(1, dt * 3);
      m.boom.rotation.y = b.boom + (luff ? Math.sin(t * 8.5 + ph) * 0.06 : 0); m.sailG.scale.x = Math.abs(b.belly) < 0.08 ? 0.08 * Math.sign(b.belly || 1) : b.belly;
      heel = side * 0.24 * eff * (ridden ? b.sail : 0) * Math.min(1, wind.s / 7);
    }
    m.tilt.rotation.x = -amp * 0.22 * Math.sin(t * 1.1 + ph) - clamp(b.v, -3, 10) * 0.007; m.tilt.rotation.z = amp * 0.3 * Math.sin(t * 0.9 + ph * 3) + heel;
    if (b.kind === 'row') {
      const [f, s] = ridden ? lastIn : [0, 0]; let hand = null;
      for (const oar of m.oars) {
        const e = clamp(f - oar.sd * s * 0.75, -1, 1), p0 = oar.ph;
        if (ridden && Math.abs(e) > 0.05) oar.ph += e * 3.2 * dt; else { const k = Math.round(oar.ph / 6.2832) * 6.2832 + 4.712; oar.ph += clamp(k - oar.ph, -dt * 2, dt * 2); } // dam olish: eshkak suvdan ko'tarilgan
        const th = -oar.sd * 0.6 * Math.cos(oar.ph), dz = 0.29 + 0.09 * clamp(Math.sin(oar.ph) * 3, -1, 1);
        oar.piv.rotation.y = th; oar.dip.rotation.z = -oar.sd * dz;
        if (ridden && Math.floor(p0 / 3.1416) !== Math.floor(oar.ph / 3.1416) && Math.sin(oar.ph) > 0 && game.fx) { const c = Math.cos(b.yaw), sn = Math.sin(b.yaw), lx = oar.sd * 2.9, lz = -0.2 - Math.sin(th) * 2.4; game.fx.burst(5, b.x + lx * c + lz * sn, b.wy + 0.05, b.z - lx * sn + lz * c, 1.4, 0.6, 0.35, 0xe8f6ff, 0.8, 1.2, 6, 0); }
        if (oar.sd === 1) { const cd = Math.cos(dz); hand = [Math.abs(1.12 - 0.66 * cd * Math.cos(th)), 0.72 - 0.66 * Math.sin(dz) - 0.36, -(-0.2 + 0.66 * cd * Math.sin(th) - 0.3)]; }
      }
      if (ridden && b.rider) { const o = b.rd; o.hand[0] = Math.max(0.3, hand[0]); o.hand[1] = hand[1] + 0.06; o.hand[2] = hand[2]; o.lean = 0.08 + 0.3 * Math.cos(m.oars[0].ph); poseRider(b.rider, null, 0, 0); }
    } else if (ridden && b.rider) poseRider(b.rider, null, clamp(lastIn[1], -1, 1) * 0.3, 0);
    if (ridden && Math.abs(b.v) > 1.2 && game.fx && Math.random() < dt * 8) { const c = Math.cos(b.yaw), sn = Math.sin(b.yaw), lz = b.kind === 'sail' ? 4.3 : 3.0; game.fx.burst(3, b.x + sn * lz, b.wy + 0.05, b.z + c * lz, 1.2 + Math.abs(b.v) * 0.15, 0.7, 0.4, 0xf2fbff, 0.7, 0.8, 5, 0); }
  };
  const syncGlider = () => {
    const m = gl.m; m.root.position.set(gl.x, gl.y, gl.z); m.root.rotation.y = gl.yaw; m.tilt.rotation.set(clamp((gl.v - 10.5) * 0.03, -0.15, 0.3), 0, -gl.bank);
    if (gl.rider) { const o = gl.rd; o.lean = -0.32 + lastIn[0] * 0.18; o.hand[2] = 0.4 - lastIn[0] * 0.08; poseRider(gl.rider, null, -lastIn[1] * 0.4, 0); }
  };
  const syncAll = (dt) => { const o = S.cur; if (!o) return; if (o.kind === 'glide') syncGlider(); else syncBoat(o, dt, true); };

  // ---------- qayiqdan baliq ovi (qarmoq bo'lsa; chuqur suvda katta baliq ko'proq) ----------
  const fishStep = (dt) => { const F = S.fish; F.t -= dt; if (F.ph === 0) { if (F.t <= 0) { F.ph = 1; F.t = 1.1; sfx('bite'); } } else if (F.t <= 0) { F.ph = 0; F.t = 2.5 + Math.random() * 4; toast('Baliq qochib ketdi…'); } };
  S.eText = () => { const o = S.cur; if (!o || o.kind === 'glide' || !st.tools.rod || Math.abs(o.v) > 0.7) return null; return S.fish ? (S.fish.ph === 1 ? 'TORTING!' : 'Tortish') : 'Qarmoq tashlash'; };
  S.useE = () => { const o = S.cur; if (!S.eText()) return;
    if (!S.fish) { S.fish = { ph: 0, t: 2.5 + Math.random() * 4 }; sfx('cast'); toast("Qarmoq tashlandi… «TORTING!» chiqqanda [E] bosing"); return; }
    if (S.fish.ph !== 1) { S.fish.t = 2.5 + Math.random() * 3; toast('Erta tortdingiz — baliq hurkib ketdi'); return; }
    const deep = depthAt(o.x, o.z) > 5, r = Math.random(), id = r < 0.04 ? 'gem' : r < (deep ? 0.48 : 0.3) ? 'bigfish' : 'fish';
    st.inv[id] = (st.inv[id] || 0) + 1; st.suv.fish++; if (game.live.count) game.live.count('fish'); sfx('medal'); S.fish = { ph: 0, t: 3 + Math.random() * 4 };
    toast(id === 'gem' ? '💎 Qarmoqqa marvarid ilindi!' : id === 'bigfish' ? `🐟 Katta baliq tutdingiz!${deep ? ' (chuqur suv)' : ''}` : '🐟 Baliq tutdingiz!', 'gold'); };

  // ---------- kamera (main.js → game.suv.cam) ----------
  const CT = { fwd: 0, speed: 0, v: [0, 0, 0], yaw: 0, R: new Float64Array([1, 0, 0, 0, 1, 0, 0, 0, 1]), nitroOn: false, rpm: 0, spec: { power: 0 } }, cp = new THREE.Vector3();
  S.cam = () => { const o = S.cur; if (!o) return null; const v = o.v, c = Math.cos(o.yaw), sn = Math.sin(o.yaw);
    CT.fwd = v; CT.speed = Math.abs(v); CT.v[0] = sn * v; CT.v[1] = o.kind === 'glide' ? o.vy : 0; CT.v[2] = c * v; CT.yaw = o.yaw; const R = CT.R; R[0] = c; R[2] = sn; R[6] = -sn; R[8] = c;
    if (o.kind === 'glide') cp.set(o.x, o.y - 0.4, o.z); else cp.set(o.x, o.wy + 0.25, o.z);
    return { tgt: CT, cp, len: o.kind === 'glide' ? 4.6 : o.m.len, hgt: o.kind === 'glide' ? 2.4 : o.m.hgt }; };

  // ---------- HUD: tezlik, shamol o'qi, balandlik ----------
  let hud = null, arrow = null, txt = null, hudSig = '';
  const mkHud = () => { const box = game.ui && game.ui.hud; if (!box) return;
    hud = document.createElement('div'); hud.className = 'panel'; hud.id = 'suv-hud'; hud.style.cssText = 'position:absolute;left:50%;top:84px;transform:translateX(-50%);display:none;align-items:center;gap:10px;padding:7px 14px 7px 9px;font:700 14px system-ui;color:#fff;pointer-events:none;white-space:nowrap;z-index:3';
    hud.innerHTML = `<svg width="34" height="34" viewBox="-17 -17 34 34" style="flex:none"><circle r="15.5" fill="rgba(10,14,24,.45)" stroke="rgba(255,255,255,.75)" stroke-width="1.5"/><g id="suv-arr"><path d="M0,-12 L6,-2 L2,-2 L2,11 L-2,11 L-2,-2 L-6,-2 Z" fill="#7fe3ff"/></g></svg><span id="suv-txt"></span>`;
    box.appendChild(hud); arrow = hud.querySelector('#suv-arr'); txt = hud.querySelector('#suv-txt'); };
  const kmh = (v) => Math.round(Math.abs(v) * 3.6);
  const drawHud = () => {
    if (!hud) mkHud(); if (!hud) return; const o = S.cur, on = !!o && game.mode === 'play';
    hud.style.display = on ? 'flex' : 'none'; if (!on) return;
    const w = S.wind(), wa = Math.atan2(w.x, w.z), ch = game.cam.heading + game.cam.yawOff, svg = hud.firstElementChild;
    let line;
    if (o.kind === 'glide') { const agl = Math.max(0, gl.y - 0.95 - Math.max(T.ground(gl.x, gl.z, gl.y + 2).y, T.waterY(gl.x, gl.z))); line = `🪂 ${Math.round(agl)} m · ${gl.vy >= 0 ? '▲' : '▼'} ${Math.abs(gl.vy).toFixed(1)} m/s · ${kmh(gl.v)} km/soat${gl.lift > 0.6 ? ' · issiq oqim ↑' : ''}${gl.v < 7.4 ? ' · <b style="color:#ff8a6a">sekin — W!</b>' : ''}`; }
    else if (o.kind === 'sail') { const pct = Math.round(o.sail * 100), no = o.th < 0.55; line = `⛵ ${kmh(o.v)} km/soat · shamol ${w.s.toFixed(0)} m/s · yelkan ${pct}%${no ? ' · <b style="color:#ffcf6a">shamolga qarshi — burilib, ilon izi bilan suzing</b>' : o.eff > 0.92 ? ' · <b style="color:#8ff0a4">eng yaxshi burchak</b>' : ''}`; }
    else line = `🚣 ${kmh(o.v)} km/soat${o.beach ? ' · sayoz joy' : ''}${S.fish ? ' · 🎣' : ''}`;
    svg.style.display = o.kind === 'row' ? 'none' : ''; arrow.setAttribute('transform', `rotate(${(-(wa - ch) * 180 / Math.PI).toFixed(1)})`);
    if (line !== hudSig) { hudSig = line; txt.innerHTML = line; }
  };

  // ---------- [E] takliflari, ko'rsatma, xarita belgilari ----------
  const ex0 = L.extra;
  L.extra = (offer, px, pz, p) => { if (ex0) ex0(offer, px, pz, p); if (S.cur || (game.interior && game.interior.inside)) return;
    for (const b of S.boats) { const d = Math.hypot(b.x - px, b.z - pz); if (d < 4.8 && Math.abs(p[1] - b.wy) < 5) offer(d * 0.6, b.paid ? `<kbd>E</kbd> ${DAT[b.kind]} o'tirish ${b.kind === 'sail' ? '⛵' : '🚣'}` : `<kbd>E</kbd> ${b.name} ijarasi — ${PRICE[b.kind]} so'm ${b.kind === 'sail' ? '⛵' : '🚣'}`, () => S.enter(b)); }
    const d = Math.hypot(kx - px, kz - pz); if (d < 4.2) offer(d * 0.6, `<kbd>E</kbd> Deltaplanda uchish — ${PRICE.glide} so'm 🪂`, () => S.enter(gl)); };
  const up0 = L.update, hinted = {};
  L.update = (dt) => { up0(dt); const o = S.cur, dots = L.dots;
    for (const b of S.boats) dots.push([b.x, b.z, DOT[b.kind]]); dots.push([kx, kz, DOT.glide]);
    if (o) { L.prompt = o.kind === 'glide' ? '<kbd>W</kbd> tezlashish · <kbd>S</kbd> sekinlash · <kbd>A</kbd>/<kbd>D</kbd> burilish' : S.fish ? (S.fish.ph === 1 ? '<kbd>E</kbd> TORTING!' : "Baliq kutilmoqda… <kbd>E</kbd> tortish") : o.kind === 'sail' ? '<kbd>W</kbd> yelkanni tortish · <kbd>S</kbd> bo\'shatish · <kbd>A</kbd>/<kbd>D</kbd> rul · <kbd>F</kbd> tushish' : `<kbd>W</kbd>/<kbd>S</kbd> eshkak · <kbd>A</kbd>/<kbd>D</kbd> burilish · <kbd>F</kbd> tushish${o.beach ? ' · qirg\'oqqa tiraldingiz' : ''}`; return; }
    if (!pl.onFoot) return; const px = pl.p[0], pz = pl.p[2];
    for (const b of S.boats) { const k = b.place + b.kind, dh = Math.hypot(b.home[0] - px, b.home[1] - pz); if (dh < 45 && !hinted[k]) { hinted[k] = 1; toast(`${b.kind === 'sail' ? '⛵' : '🚣'} Iskala yonida ${b.name.toLowerCase()} — ijarasi ${PRICE[b.kind]} so'm. Yoniga borib [E] bosing`, 'gold'); } }
    if (!hinted.gl && Math.hypot(kx - px, kz - pz) < 50) { hinted.gl = 1; toast(`🪂 Deltaplan ijarasi — ${PRICE.glide} so'm: Cho'qqidan orol ustida uchasiz. Uzoq uchsangiz — mukofot`, 'gold'); }
  };

  // ---------- har kadr: qarovsiz qayiqlar chayqaladi, uzoqda qolsa iskalaga qaytadi; deltaplan joyiga qaytadi; HUD ----------
  game.hooks.push((dt) => {
    const p = pl.onFoot ? pl.p : game.car.p;
    for (const b of S.boats) { if (b === S.cur) continue; const d = Math.hypot(b.x - p[0], b.z - p[2]);
      if ((b.paid || b.x !== b.home[0]) && d > 350) { b.x = b.home[0]; b.z = b.home[1]; b.yaw = b.home[2]; b.v = 0; b.paid = false; b.wy = T.waterY(b.x, b.z); }
      if (d < 600) syncBoat(b, dt, false); }
    if (gl.landed && S.cur !== gl && Math.hypot(gl.landed.x - p[0], gl.landed.z - p[2]) > 160) parkGlider();
    drawHud();
  });
  // saqlash: qayiqda/havoda bo'lsa — o'tirgan joy (suv ustida qolib ketmaslik uchun)
  const sv0 = game.save; game.save = (...a) => { if (!S.cur || !S.from) return sv0(...a); const q = [pl.p[0], pl.p[1], pl.p[2]]; pl.p[0] = S.from[0]; pl.p[1] = S.from[1]; pl.p[2] = S.from[2]; try { return sv0(...a); } finally { pl.p[0] = q[0]; pl.p[1] = q[1]; pl.p[2] = q[2]; } };
  // sinov ilgaklari
  S.land = landGlider; S.depthAt = depthAt; S.glide = gl; game.boat = S.boats[0]; game.sailboat = S.boats[1]; game.glider = gl;
  return S;
}
