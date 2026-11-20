// Kurash: Karvonsaroy hovlisidagi polvonlar davrasi — milliy kurash mini-o'yini (piyoda). 6 polvon zinapoyasi, kunlik chempion bellashuvi, belbog' va «Orol polvoni» unvoni.
// Raqib og'irligini qaysi tomonga tashlaganini kuzatasiz (gavdasi va ekrandagi o'q): o'z vaqtida A/D — yonga tortish, W — itarish, S — o'ziga tortish (hujumni qaytarish).
// Raqib muvozanati to'lganda Probel — otish: «halol» (darhol g'alaba), «yonbosh» (2 ochko), «chala» (1 ochko). 4 ochko yoki vaqt tugaganda ko'prog'i yutadi.
// Qaytarilmagan hujum o'yinchi muvozanatini buzadi; muvozanat to'lsa — raqib halol yutadi. Tugmani ketma-ket bosish emas, raqibni kuzatish yutadi.
import * as THREE from 'three';
import * as T from './terrain.js';
import * as COL from './colliders.js';
import { GB, MAT } from './geo.js';
import * as BK from './blocks.js';
import { makeRig, poseRig } from './rig.js';
import { clamp } from './util.js';
const { PAL } = BK;

// win — o'q oynasi (s), gap — harakatlar orasi (s), atk — hujum ulushi, pow — qaytarilmagan hujum zarbi, feint — aldamchi og'ish, res — to'g'ri javobda raqib muvozanati qancha buziladi
export const POLVON = [
  { name: 'Bekmurod', about: "Qishloq yigiti, endi o'rganmoqda", shirt: 0x2f6fd0, h: 0.98, b: 1.0, win: 1.6, gap: 1.75, atk: 0.16, pow: 0.28, feint: 0, res: 0.42, prize: 200, hint: true },
  { name: 'Sherzod', about: "Tez, lekin sabrsiz", shirt: 0x3f9a58, h: 1.0, b: 1.04, win: 1.38, gap: 1.5, atk: 0.22, pow: 0.32, feint: 0, res: 0.38, prize: 320, hint: true },
  { name: "G'ayrat", about: "Ba'zan aldab, boshqa tomonga og'adi", shirt: 0x2f6fd0, h: 1.03, b: 1.1, win: 1.2, gap: 1.35, atk: 0.27, pow: 0.36, feint: 0.12, res: 0.35, prize: 480 },
  { name: 'Olimjon', about: "Ko'p hujum qiladi — S bilan qaytaring", shirt: 0x3f9a58, h: 1.02, b: 1.14, win: 1.05, gap: 1.2, atk: 0.36, pow: 0.4, feint: 0.16, res: 0.32, prize: 650 },
  { name: 'Rustam', about: "Og'ir va ayyor", shirt: 0x2f6fd0, h: 1.06, b: 1.2, win: 0.94, gap: 1.08, atk: 0.36, pow: 0.44, feint: 0.24, res: 0.29, prize: 850 },
  { name: 'Bahodir', about: "Orolning eng kuchli polvoni", shirt: 0x3f9a58, h: 1.07, b: 1.24, win: 0.84, gap: 0.98, atk: 0.4, pow: 0.48, feint: 0.3, res: 0.27, prize: 1200 },
];
export const CHAMP = { name: 'Qahramon', about: "Kunlik chempion bellashuvi: har o'yin kunida bir marta", shirt: 0xd8392b, h: 1.08, b: 1.26, win: 0.8, gap: 0.92, atk: 0.42, pow: 0.5, feint: 0.34, res: 0.26, prize: 700, time: 70 };
export const FEE = 100, REMATCH = 120, TIME = 60, BELT = 0xc8202a;
const KEY = { L: 'KeyA', R: 'KeyD', F: 'KeyS', B: 'KeyW' }, KEYN = { L: 'A', R: 'D', F: 'S', B: 'W' }, ROT = { L: -90, R: 90, F: 180, B: 0 };
const sm = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const som = (n) => Math.round(n).toLocaleString('ru-RU');

export function initKurash(game) {
  const { scene } = game, st = game.state, pl = game.player, L = game.live, at = game.site.places.karvon && game.site.places.karvon.kurash;
  st.kurash = Object.assign({ lvl: 0, champ: -1, belt: 0, title: 0, wins: 0, loss: 0, halol: 0, streak: 0, best: 0 }, st.kurash || {}); // eski saqlovda bo'lmasa — standart
  const S = st.kurash, K = (game.kurash = { on: false, m: null, at, auto: null, POLVON, CHAMP });
  if (!at) return K;
  const toast = (m, k) => game.toast(m, k), sfx = (n, k) => game.audio.sfx(n, k);
  const C = at, c = Math.cos(at.yaw), s = Math.sin(at.yaw), W = (lx, lz) => [C.x + lx * c + lz * s, C.z - lx * s + lz * c], GY = (lx, lz) => { const p = W(lx, lz); return T.ground(p[0], p[1], C.y + 3).y; };
  const R = 4.0; // davra radiusi

  // ---------- davra: gilam, o'rindiqlar, tomoshabinlar, bayroqlar, nog'ora ----------
  { const g = new GB(1771); g.jit = 0.02; g.translate(C.x, C.y, C.z).rotY(at.yaw); const y0 = GY(0, 0) - C.y;
    g.push().translate(0, y0, 0); g.color(0x2a58b8).cyl(40, R, R, -0.05, 0.05, { cap: true }); g.color(0xd8392b).cyl(40, R - 0.75, R - 0.75, 0.05, 0.06, { cap: true }); g.color(0xf2ead8).cyl(40, 0.5, 0.5, 0.06, 0.07, { cap: true }); g.pop();
    for (let i = 0; i < 28; i++) { const a = (i / 28) * 6.283, x = Math.sin(a) * (R + 0.18), z = Math.cos(a) * (R + 0.18); g.push().translate(x, GY(x, z) - C.y, z).rotY(a); g.color(i % 2 ? 0xf0b83a : 0xf2ead8).box(0, 0.04, 0, 0.9, 0.08, 0.28); g.pop(); }
    const bench = (a) => { const x = Math.sin(a) * 6.4, z = Math.cos(a) * 6.4; g.push().translate(x, GY(x, z) - C.y, z).rotY(a + Math.PI); BK.bench(g, 0, 0, 0); g.pop(); const p = W(x, z); COL.addSeg(p[0] - Math.cos(a + at.yaw) * 1.0, p[1] + Math.sin(a + at.yaw) * 1.0, p[0] + Math.cos(a + at.yaw) * 1.0, p[1] - Math.sin(a + at.yaw) * 1.0, 0.3, C.y - 1, C.y + 0.6); };
    for (const a of [1.0, 1.45, 1.9, -1.0, -1.45, -1.9]) bench(a);
    const shirts = [0xf0b83a, 0x8a54c8, 0xf2f2ee, 0x3d74a6, 0xd8392b, 0x24b8b0, 0x6e4a30, 0xff7ab8, 0x2a2c33, 0x7cc4e8];
    let k = 0; for (const a of [0.85, 1.22, 1.68, 2.1, -0.85, -1.22, -1.68, -2.1, 2.5, -2.5]) { const x = Math.sin(a) * 7.6, z = Math.cos(a) * 7.6; g.push().translate(0, GY(x, z) - C.y, 0); BK.person(g, x, z, a + Math.PI, shirts[k++ % shirts.length]); g.pop(); }
    for (const sx of [-1, 1]) { const x = sx * 5.4, z = -4.6; g.push().translate(0, GY(x, z) - C.y, 0); BK.flag(g, x, z, 5.5, sx > 0 ? 0x2a58b8 : 0xd8392b); g.pop(); }
    { const x = 0, z = -5.6; g.push().translate(x, GY(x, z) - C.y, z); g.color(PAL.woodD).cyl(10, 0.34, 0.34, 0, 0.52, { cap: true }); g.color(0xf2e2c0).cyl(10, 0.36, 0.36, 0.52, 0.56, { cap: true }); g.color(PAL.wood).box(0.7, 0.4, 0, 0.9, 0.08, 0.5); g.pop(); } // nog'ora va hakam stoli
    const m = new THREE.Mesh(g.build(), MAT.flat); m.castShadow = true; m.receiveShadow = true; scene.add(m); K.mesh = m; }

  // ---------- jonli odamlar: hakam va 4 tomoshabin (olqishlaydi), raqib — har bellashuvda quriladi ----------
  const mkNpc = (o, lx, lz, yaw) => { const r = makeRig(o), p = W(lx, lz); r.root.position.set(p[0], GY(lx, lz), p[1]); r.root.rotation.order = 'YXZ'; r.root.rotation.y = at.yaw + yaw; scene.add(r.root); r.home = [lx, lz, yaw]; return r; };
  const ref = mkNpc({ shirt: 0xf2f2ee, pants: 0x2a2c33, seed: 1791, sleeve: 1, stache: true, hair: 0x15110e }, 0.9, -4.7, 0);
  const fans = [[0x8a54c8, 4.9, 3.9], [0xf0b83a, -5.2, 3.4], [0x24b8b0, 5.6, -2.2], [0xd8392b, -5.7, -1.8]].map(([sh, x, z], i) => mkNpc({ shirt: sh, seed: 1801 + i, fem: i === 1 }, x, z, Math.atan2(-x, -z)));
  let opp = null;
  const buildOpp = (d, i) => { if (opp) { scene.remove(opp.root); opp.mesh.geometry.dispose(); opp.mesh.skeleton.dispose(); }
    opp = makeRig({ shirt: d.shirt, pants: 0xf2f2ee, seed: 1900 + i * 17, height: d.h, build: d.b, sleeve: 1, stache: i % 2 === 1, beltCol: BELT, muscle: 1 }); opp.root.rotation.order = 'YXZ'; opp.kp = {}; scene.add(opp.root); return opp; };

  // ---------- bellashuv ----------
  const dirs = ['L', 'R', 'B'];
  const ease = () => 1 + Math.min(0.3, S.streak * 0.1); // ketma-ket yutqazsangiz — biroz yengillashadi (murabbiy maslahati)
  K.can = () => !K.on && pl.onFoot && !game.act && !(game.suv && game.suv.cur) && !(game.coop && game.coop.ride) && !(game.interior && game.interior.inside) && pl.lock <= 0;
  K.today = () => (st.dunyo && st.dunyo.day) || 1;
  K.start = (i, free) => {
    if (!K.can()) { toast("Hozir bellashib bo'lmaydi", 'bad'); return false; }
    const champ = i >= POLVON.length; if (champ && (S.lvl < POLVON.length || S.champ === K.today())) { toast(S.lvl < POLVON.length ? "Avval oltita polvonni yenging" : 'Chempion bellashuvi ertaga yana bo\'ladi', 'bad'); return false; }
    if (!champ && i > S.lvl) { toast('Avval oldingi polvonni yenging', 'bad'); return false; }
    if (!free) { if (st.money < FEE) { toast(`Ishtirok haqi ${FEE} so'm`, 'bad'); return false; } game.addMoney(-FEE, 'Kurash: ishtirok haqi'); }
    const d = champ ? CHAMP : POLVON[i]; buildOpp(d, i); // sc — o'yinchi ochkosi, ag — raqib ochkosi, me.bal — o'yinchi muvozanati buzilishi, op.ob — raqibniki
    K.m = { i, d, champ, rematch: !champ && i < S.lvl, ph: 'intro', t: 0, time: d.time || TIME, sc: 0, ag: 0, me: { bal: 0, sta: 100, idle: 9, reads: 0 }, op: { ob: 0, hits: 0 }, cue: null, next: 1.2, msg: '', msgT: 0, ang: 0, flash: 0, res: null };
    K.on = true; pl.sit = false; pl.emote = null; pl.v[0] = pl.v[1] = pl.v[2] = 0; pl.rig.root.rotation.order = 'YXZ'; pl.rig.kp = {}; pl.lamp.intensity = 0;
    const f = game.ui && game.ui.fade; if (f) { f.style.opacity = 1; setTimeout(() => (f.style.opacity = 0), 380); }
    sfx('drum', 4); place(1); game.banner(`🤼 ${d.name}${champ ? ' — chempion bellashuvi' : ''}`, d.hint ? "Raqib og'ilgan tomonga o'q ko'rsatiladi: shu tugmani bosing. Muvozanati to'lganda — Probel!" : `${d.about} · ${K.m.time} soniya`, 'start');
    return true;
  };
  // ikki polvon davra markazida: o'yinchi kameraga orqa bilan, raqib qarshisida; juftlik sekin aylanib turadi
  const pos = { me: [0, 0], op: [0, 0], yaw: 0 };
  function place(snap) {
    const M = K.m, a = M.ang, ux = Math.cos(at.yaw + a), uz = -Math.sin(at.yaw + a), gap = 0.44 + 0.03 * (M.d.b - 1) * 4;
    pos.me[0] = C.x - ux * gap; pos.me[1] = C.z - uz * gap; pos.op[0] = C.x + ux * gap; pos.op[1] = C.z + uz * gap; pos.yaw = Math.atan2(ux, uz); pos.u = [ux, uz];
    if (snap) { camP.set(pos.me[0] - ux * 3.2, C.y + 2.1, pos.me[1] - uz * 3.2); game.camera.position.copy(camP); }
  }
  const msg = (t, k) => { K.m.msg = t; K.m.msgK = k || ''; K.m.msgT = 1.3; };
  // to'g'ri javob kuchi: holsizlikda — yarmi
  const hit = (q) => { const M = K.m, me = M.me, weak = me.sta < 15, perfect = q.t < q.dur * 0.55; let g = M.d.res * (perfect ? 1.2 : 1) * (weak ? 0.5 : 1) * ease();
    M.op.ob = Math.min(1.15, M.op.ob + g); me.sta = Math.max(0, me.sta - 7); me.reads++; sfx('grip', 0.8); msg(weak ? 'Holsizsiz — nafas rostlang' : perfect ? 'Aniq! 👌' : 'Yaxshi!', weak ? 'bad' : 'good'); };
  const press = (key) => {
    const M = K.m, me = M.me, q = M.cue; me.idle = 0; const pk = { KeyA: [1, 0], KeyD: [-1, 0], KeyW: [0, 1], KeyS: [0, -1] }[key]; if (pk) { pl.rig.kp.side = pk[0] * 0.8; pl.rig.kp.fwd = pk[1] * 0.8; pl.rig.kp.hit = key === 'KeyS' ? 1 : 0; M.myT = 0.32; }
    if (q && !q.done) { if (KEY[q.dir] === key) { q.done = 1; hit(q); M.next = M.d.gap * (0.7 + Math.random() * 0.6); return; }
      me.bal = Math.min(1.2, me.bal + 0.13); me.sta = Math.max(0, me.sta - 12); sfx('hit', 0.3); msg("Noto'g'ri tomon!", 'bad'); return; }
    me.bal = Math.min(1.2, me.bal + 0.05); me.sta = Math.max(0, me.sta - 6); msg('Shoshilmang — raqibni kuzating');
  };
  const throwTry = () => {
    const M = K.m, me = M.me, ob = M.op.ob; me.idle = 0; M.cue = null;
    if (ob >= 0.95) return finishThrow('halol');
    if (ob >= 0.32) { const two = ob >= 0.62; M.sc += two ? 2 : 1; M.op.ob = 0.08; me.bal = Math.max(0, me.bal - 0.2); sfx('crowd', two ? 1 : 0.6); sfx('drum', two ? 3 : 2); msg(two ? 'YONBOSH! +2' : 'CHALA! +1', 'gold'); M.ph = 'pause'; M.t = 0; M.pk = 'part'; M.next = 1.0; if (M.sc >= 4) { M.res = { win: true, how: 'ochko' }; M.ph = 'end'; M.t = 0; } return; }
    me.sta = Math.max(0, me.sta - 18); me.bal = Math.min(1.2, me.bal + 0.24); sfx('hit', 0.5); msg('Otish chiqmadi — raqib hali muvozanatda', 'bad'); if (me.bal >= 1) finishThrow('lose');
  };
  function finishThrow(how) { const M = K.m; M.cue = null; M.ph = 'throw'; M.t = 0; M.res = how === 'halol' ? { win: true, how: 'halol' } : { win: false, how: 'halol' }; sfx('crowd', 1.2); sfx('drum', 5); msg(how === 'halol' ? 'HALOL! 🏆' : 'Siz yiqildingiz…', how === 'halol' ? 'gold' : 'bad'); }
  // har qadam (pl.update o'rniga — o'yinchi davrada, boshqaruv kurashga)
  const step = (dt, inp) => {
    const M = K.m, me = M.me, op = M.op, d = M.d, kp = pl.rig.kp, ok = opp.kp; M.t += dt; if (M.msgT > 0) M.msgT -= dt; if (M.myT > 0) { M.myT -= dt; if (M.myT <= 0) { kp.side = 0; kp.fwd = 0; kp.hit = 0; } }
    if (M.ph === 'intro') { if (M.t > 2.2) { M.ph = 'fight'; M.t = 0; sfx('whistle'); msg('Kurash!', 'gold'); } }
    else if (M.ph === 'fight') {
      M.time -= dt; me.idle += dt; if (me.idle > 0.6) me.sta = Math.min(100, me.sta + dt * 11);
      op.ob = Math.max(0, op.ob - dt * 0.035); if (!M.cue) me.bal = Math.max(0, me.bal - dt * 0.05);
      M.ang = 0.28 * Math.sin(M.t * 0.33) + 0.1 * Math.sin(M.t * 0.81);
      // raqib harakati: og'ish (o'q oynasi bilan) yoki hujum
      if (!M.cue) { M.next -= dt; if (M.next <= 0) { const f = Math.random() < d.atk, dir = f ? 'F' : dirs[Math.random() < 0.42 ? 0 : Math.random() < 0.72 ? 1 : 2], dur = d.win * ease();
          M.cue = { dir, t: 0, dur, feint: !f && dir !== 'B' && Math.random() < d.feint, sw: false, done: 0 }; if (f) sfx('hit', 0.15); } }
      const q = M.cue;
      if (q) { q.t += dt;
        if (q.feint && !q.sw && q.t > q.dur * 0.42) { q.sw = true; q.dir = q.dir === 'L' ? 'R' : 'L'; q.t = q.dur * 0.25; M.flash = 0.4; }
        if (q.done) { q.out = (q.out || 0) + dt; if (q.out > 0.3) M.cue = null; }
        else if (q.t >= q.dur) { // javobsiz qoldi
          if (q.dir === 'F') { me.bal += d.pow / ease(); op.hits++; sfx('hit', 0.8); if (me.bal >= 1) { finishThrow('lose'); return pose(dt); } M.ag++; msg('Raqib hujumi o\'tdi — raqibga chala', 'bad'); sfx('drum', 1); if (M.ag >= 4) { M.res = { win: false, how: 'ochko' }; M.ph = 'end'; M.t = 0; return pose(dt); } }
          M.cue = null; M.next = d.gap * (0.6 + Math.random() * 0.6); }
      }
      // kiritish (sinovda — avto o'yinchi)
      if (K.auto) autoPlay(); else if (inp) { for (const k of ['KeyA', 'KeyD', 'KeyW', 'KeyS']) if (inp.hit(k)) press(k); if (inp.hit('Space')) throwTry(); }
      if (M.ph === 'fight' && M.time <= 0) { M.time = 0; const a = M.sc, b = M.ag; M.res = { win: a > b || (a === b && me.reads > op.hits), how: a === b ? 'hakam' : 'vaqt' }; M.ph = 'end'; M.t = 0; sfx('whistle'); }
    } else if (M.ph === 'pause') { if (M.t > 1.1) { M.ph = 'fight'; M.t = 0; M.pk = null; } }
    else if (M.ph === 'throw') { if (M.t > 1.7) { M.ph = 'end'; M.t = 0; } }
    else if (M.ph === 'end') { if (M.t > 2.6) return finish(); }
    pose(dt);
  };
  K.press = (k) => { if (K.on && K.m.ph === 'fight') { if (k === 'Space') throwTry(); else press(k); } };
  // sinov uchun avto o'yinchi: 'win' — har og'ishga o'z vaqtida javob beradi va muvozanat to'lganda otadi; 'lose' — hech narsa qilmaydi
  function autoPlay() { const M = K.m, q = M.cue; if (K.auto !== 'win') return; if (M.op.ob >= 0.95) return throwTry(); if (q && !q.done && (!q.feint || q.sw) && q.t > Math.min(0.35, q.dur * 0.3)) press(KEY[q.dir]); }

  // ---------- pozalar va joylashuv ----------
  const camP = new THREE.Vector3(), camT = new THREE.Vector3();
  function pose(dt) {
    const M = K.m; place(0); const kp = pl.rig.kp, ok = opp.kp, q = M.cue, ph = M.ph, t = M.t;
    // raqib og'ishi: o'q yo'nalishi bo'yicha (raqib o'yinchiga qaragan: ekranning o'ng tomoni — uning chap tomoni)
    let ts = 0, tf = 0; if (q && !q.done && ph === 'fight') { const k = sm(0, 0.22, q.t) * (q.dir === 'F' ? 1.1 : 0.9); if (q.dir === 'L') ts = -k; else if (q.dir === 'R') ts = k; else if (q.dir === 'F') tf = k; else tf = -k; }
    if (q && q.done) { const k = 1 - sm(0, 0.3, q.out || 0); ts = q.dir === 'L' ? -1.1 * k : q.dir === 'R' ? 1.1 * k : 0; tf = q.dir === 'F' ? -0.6 * k : q.dir === 'B' ? -0.8 * k : 0; }
    const lk = Math.min(1, dt * 14); ok.side = (ok.side || 0) + (ts - (ok.side || 0)) * lk; ok.fwd = (ok.fwd || 0) + (tf - (ok.fwd || 0)) * lk; ok.hit = q && q.dir === 'F' && !q.done ? sm(0.3, 0.8, q.t / q.dur) : 0;
    ok.lift = 0; ok.fly = 0; ok.win = 0; kp.lift = 0; kp.fly = 0; kp.win = 0;
    let mx = pos.me[0], mz = pos.me[1], ox = pos.op[0], oz = pos.op[1]; const u = pos.u;
    if (ph === 'pause' && M.pk === 'part') { const e = Math.sin(Math.PI * clamp(t / 1.0, 0, 1)); kp.lift = 0.7 * e; ok.fly = 0.3 * e; ox += u[0] * 0.5 * e; oz += u[1] * 0.5 * e; }
    if (ph === 'throw' || (ph === 'end' && M.res && M.res.how === 'halol')) { const tt = ph === 'throw' ? t : 2, win = M.res.win, th = win ? kp : ok, vi = win ? ok : kp, fl = sm(0.2, 1.25, tt);
      th.lift = sm(0, 0.35, tt) * (1 - sm(0.9, 1.5, tt)); vi.fly = fl; const sd = win ? 1 : -1, wx = -u[1], wz = u[0], dx = (u[0] * 0.9 + wx * 0.7) * sd * fl, dz = (u[1] * 0.9 + wz * 0.7) * sd * fl;
      if (win) { ox += dx; oz += dz; } else { mx += dx; mz += dz; } }
    if (ph === 'end') { const e = sm(0.3, 0.9, t), win = M.res && M.res.win; if (win) kp.win = e; else ok.win = e; }
    // o'yinchi
    const P = pl.p; P[0] = mx; P[2] = mz; P[1] = T.ground(mx, mz, C.y + 3).y; pl.yaw = pos.yaw; pl.v[0] = pl.v[1] = pl.v[2] = 0; pl.speed = 0; pl.fwd = 0; pl.anim = 'kurash'; pl.grounded = true;
    const r = pl.rig; r.root.visible = true; r.root.position.set(P[0], P[1], P[2]); r.root.rotation.y = pl.yaw; const Cc = pl.ctl; Cc.vx = Cc.vz = Cc.vy = 0; Cc.grounded = true; Cc.swim = false; Cc.moveYaw = null; poseRig(r, 'kurash', dt, 0, Cc);
    // raqib
    opp.root.visible = true; opp.root.position.set(ox, T.ground(ox, oz, C.y + 3).y, oz); opp.root.rotation.y = pos.yaw + Math.PI; poseRig(opp, 'kurash', dt, 0);
  }
  function release() { const r = pl.rig; r.kp = null; r.root.rotation.x = r.root.rotation.z = 0; K.on = false; if (opp) opp.root.visible = false; const p = W(0, R + 1.6); pl.place(p[0], p[1], at.yaw); game.cam.snap(); }
  // natija: mukofot, zinapoya, belbog' va unvon
  function finish() {
    const M = K.m, res = M.res, d = M.d; release(); let pay = 0, extra = '';
    if (res.win) { S.wins++; S.streak = 0; if (res.how === 'halol') S.halol++; S.best = Math.max(S.best, M.sc);
      if (M.champ) { S.champ = K.today(); pay = d.prize; extra = 'Bugungi chempion siz! 🏆'; }
      else if (M.rematch) pay = REMATCH;
      else { pay = d.prize; S.lvl = Math.max(S.lvl, M.i + 1); if (M.i === POLVON.length - 1 && !S.belt) { S.belt = 1; S.title = 1; extra = "Polvon belbog'i va «Orol polvoni» unvoni sizniki!"; wearBelt(true); } }
      game.addMoney(pay, 'Kurash: g\'alaba'); st.xp += M.champ ? 40 : 25; sfx('win'); game.banner(res.how === 'halol' ? 'HALOL G\'ALABA! 🤼' : "G'alaba! 🤼", `${d.name} yengildi · +${som(pay)} so'm${extra ? ' · ' + extra : ''}`, 'gold');
      if (game.live.count) game.live.count('kurash');
    } else { S.loss++; S.streak++; sfx('fail'); game.banner('Mag\'lubiyat', `${d.name} bu safar kuchliroq chiqdi. ${S.streak >= 2 ? "Murabbiy maslahati: raqib og'ilgan tomonga — o'sha tugma; hujumda (o'q sizga qarab) — S." : 'Yana urinib ko\'ring!'}`, 'bad'); }
    M.payout = pay; K.last = { win: res.win, how: res.how, name: d.name, pay, pts: M.sc, ag: M.ag, extra };
    K.m = null; game.save(); if (game.ui && !K.auto) game.ui.open('kurash', { res: K.last });
  }
  K.quit = () => { if (!K.on) return; const M = K.m; M.res = { win: false, how: 'taslim' }; finish(); };
  // belbog' — kiyimning bir qismi (rig.js beltCol), kiyim do'konidagi ko'rinishga qo'shiladi
  function wearBelt(on) { const H2 = game.hayot2; if (!H2) return; const lk = Object.assign({}, H2.lookOf()); if (on) lk.belt = BELT; else delete lk.belt; st.look = lk; H2.restyle(lk); }
  K.wearBelt = (on) => { if (!S.belt) return false; wearBelt(on); game.save(); return true; };
  K.beltOn = () => !!(st.look && st.look.belt);

  const pu = pl.update; pl.update = function (dt, inp, camYaw, st2) { if (K.on && K.m) return step(dt, inp); return pu.call(this, dt, inp, camYaw, st2); };

  // ---------- HUD ----------
  let hud = null; const $ = (id) => hud.querySelector('#' + id);
  const mkHud = () => { const box = game.ui && game.ui.hud; if (!box) return; hud = document.createElement('div'); hud.id = 'kur-hud';
    hud.innerHTML = `<div class="kr-top"><div class="kr-side"><span class="kr-nm">Siz · muvozanat / kuch</span><div class="kr-bar"><i id="kr-bal" style="background:#ff6a55"></i></div><div class="kr-bar"><i id="kr-sta" style="background:#5fd38a"></i></div></div>
      <span class="kr-pts" id="kr-p1">0</span><span class="kr-t" id="kr-t">60</span><span class="kr-pts" id="kr-p2">0</span>
      <div class="kr-side r"><span class="kr-nm" id="kr-on">Raqib</span><div class="kr-bar" style="position:relative"><i id="kr-ob" style="background:linear-gradient(90deg,#f0b83a,#5fd38a)"></i><b style="position:absolute;left:32%;top:0;bottom:0;width:2px;background:#fff8"></b><b style="position:absolute;left:62%;top:0;bottom:0;width:2px;background:#fff8"></b><b style="position:absolute;left:95%;top:0;bottom:0;width:2px;background:#fff"></b></div><span class="kr-nm" style="font-size:11px;opacity:.7">raqib muvozanati: chala · yonbosh · halol</span></div></div>
      <svg class="kr-cue" viewBox="-50 -50 100 100"><circle r="40" fill="rgba(10,14,24,.45)" stroke="rgba(255,255,255,.25)" stroke-width="6"/><circle id="kr-ring" r="40" fill="none" stroke="#ffd23a" stroke-width="6" stroke-dasharray="251.3" stroke-dashoffset="0" transform="rotate(-90)"/><g id="kr-arr"><path d="M0,-28 L14,-6 L5,-6 L5,22 L-5,22 L-5,-6 L-14,-6 Z" fill="#ffd23a"/></g></svg><div class="kr-key" id="kr-key"></div><div class="kr-msg" id="kr-msg"></div>`;
    box.appendChild(hud); };
  const drawHud = () => {
    if (!hud) mkHud(); if (!hud) return; const on = K.on && K.m && game.mode === 'play'; hud.style.display = on ? 'flex' : 'none'; if (!on) return;
    const M = K.m, q = M.cue, me = M.me;
    $('kr-bal').style.width = Math.min(100, me.bal * 100) + '%'; $('kr-sta').style.width = me.sta + '%'; $('kr-ob').style.width = Math.min(100, M.op.ob * 100) + '%';
    $('kr-p1').textContent = M.sc; $('kr-p2').textContent = M.ag; $('kr-on').textContent = M.d.name + (M.champ ? ' 👑' : ''); $('kr-t').textContent = Math.ceil(M.time);
    const svg = hud.querySelector('.kr-cue'), act = q && !q.done && M.ph === 'fight'; svg.style.opacity = act ? 1 : 0.25;
    if (act) { $('kr-arr').setAttribute('transform', `rotate(${ROT[q.dir]})`); $('kr-ring').setAttribute('stroke-dashoffset', (251.3 * clamp(q.t / q.dur, 0, 1)).toFixed(1)); const col = q.dir === 'F' ? '#ff6a55' : M.flash > 0 ? '#ff9af0' : '#ffd23a'; $('kr-arr').firstChild.setAttribute('fill', col); $('kr-ring').setAttribute('stroke', col);
      $('kr-key').textContent = M.d.hint || S.streak >= 2 ? KEYN[q.dir] + (q.dir === 'F' ? ' — qaytaring!' : '') : q.dir === 'F' ? 'HUJUM!' : ''; } else $('kr-key').textContent = M.op.ob >= 0.95 ? 'PROBEL — OTING!' : '';
    if (M.flash > 0) M.flash -= 1 / 60;
    const ms = $('kr-msg'), txt = M.msgT > 0 ? M.msg : M.ph === 'intro' ? 'Salomlashish…' : ''; if (ms.textContent !== txt) { ms.textContent = txt; ms.style.color = M.msgK === 'bad' ? '#ff8a6a' : M.msgK === 'gold' ? '#ffd23a' : '#fff'; }
  };

  // ---------- [E] taklifi, xarita belgisi, kamera, tomoshabinlar ----------
  const ex0 = L.extra;
  L.extra = (offer, px, pz, p) => { if (ex0) ex0(offer, px, pz, p); if (K.on || (game.interior && game.interior.inside)) return; const dd = Math.hypot(C.x - px, C.z - pz); if (dd < R + 2.5 && Math.abs(p[1] - C.y) < 4) offer(dd * 0.5 + 0.5, `<kbd>E</kbd> Kurash davrasi — polvonlar bilan bellashish 🤼`, () => game.ui.open('kurash')); };
  const up0 = L.update; let hinted = false;
  L.update = (dt) => { up0(dt); L.dots.push([C.x, C.z, '#e8b23a']);
    if (K.on) { L.prompt = '🤼 <kbd>A</kbd>/<kbd>D</kbd> tortish · <kbd>W</kbd> itarish · <kbd>S</kbd> qaytarish · <kbd>Probel</kbd> otish'; return; }
    if (!hinted && pl.onFoot && Math.hypot(C.x - pl.p[0], C.z - pl.p[2]) < 40) { hinted = true; toast('🤼 Karvonsaroy hovlisida kurash davrasi: polvonlar bilan bellashing — belbog\' va unvon yutib oling!', 'gold'); } };
  let cheer = 0;
  game.hooks.push((dt) => {
    drawHud(); const p = pl.onFoot ? pl.p : game.car.p, far = Math.hypot(C.x - p[0], C.z - p[2]) > 160;
    for (const r of [ref, ...fans]) r.root.visible = !far;
    if (!far) { const M = K.m, hot = K.on && M && (M.ph === 'throw' || M.ph === 'pause' || M.ph === 'end');
      cheer = hot ? 2 : Math.max(0, cheer - dt);
      fans.forEach((r, i) => poseRig(r, cheer > 0 && i % 2 === 0 ? 'dance' : cheer > 0 ? 'wave' : K.on ? 'idle' : 'idle', dt, 0));
      poseRig(ref, K.on && M && M.ph === 'end' ? 'wave' : 'idle', dt, 0);
      if (opp && !K.on && opp.root.visible) opp.root.visible = false; }
    if (K.on && K.m) { // kamera: o'yinchining orqasida, biroz yon tomondan — ikkala polvon ko'rinadi
      const u = pos.u, cam = game.camera, wx = -u[1], wz = u[0], k = Math.min(1, dt * 4);
      camP.set(pos.me[0] - u[0] * 3.1 + wx * 0.9, C.y + 2.05, pos.me[1] - u[1] * 3.1 + wz * 0.9); cam.position.lerp(camP, k);
      camT.set(C.x + u[0] * 0.35, C.y + 1.05, C.z + u[1] * 0.35); cam.lookAt(camT); }
  });

  // ---------- zinapoya oynasi ----------
  game.ui.s_kurash = function (w, d, btn, x) {
    x(); const g = game, last = d && d.res;
    const render = () => {
      const day = K.today(), champOk = S.lvl >= POLVON.length, champDone = S.champ === day;
      const card = (p, i) => { const done = i < S.lvl, next = i === S.lvl, lock = i > S.lvl, stars = '★'.repeat(Math.min(5, 1 + Math.round(i * 0.8)));
        return `<div class="card${done ? ' done' : ''}${next ? ' next' : ''}"><h4>${i + 1}. ${p.name} <small style="color:var(--ac)">${stars}</small></h4><p>${p.about}</p><div class="meta"><span>${done ? '✓ Yengilgan' : lock ? '🔒' : 'Navbatdagi raqib'}</span><span>🏆 ${som(done ? REMATCH : p.prize)} so'm</span></div>
          <button data-a="go:${i}" class="${done ? 'sec' : ''}" ${lock || st.money < FEE ? 'disabled' : ''}>${lock ? 'Avval oldingisini yenging' : st.money < FEE ? `Ishtirok haqi ${FEE} so'm` : done ? `Qayta bellashish — ${FEE} so'm` : `Bellashish — ${FEE} so'm`}</button></div>`; };
      w.innerHTML = `<h1>🤼 Kurash davrasi <small>Karvonsaroy · 💰 ${som(st.money)} so'm</small></h1>
        ${last ? `<div class="card" style="margin-bottom:10px;border-color:${last.win ? 'var(--good)' : 'var(--bad)'}"><h4>${last.win ? (last.how === 'halol' ? '🏆 Halol g\'alaba!' : "🏆 G'alaba!") : last.how === 'taslim' ? '🏳 Taslim bo\'ldingiz' : '😓 Mag\'lubiyat'} — ${last.name}</h4><p>Ochkolar: ${last.pts} : ${last.ag}${last.pay ? ` · +${som(last.pay)} so'm` : ''}${last.extra ? ' · ' + last.extra : ''}</p></div>` : ''}
        <p class="sub">Raqib og'irligini qaysi tomonga tashlaganini kuzating: <b>A</b>/<b>D</b> — yonga tortish, <b>W</b> — itarish, <b>S</b> — o'zingizga tortish (qizil o'q — hujum, albatta qaytaring!). Raqib muvozanati to'lganda <b>Probel</b> — otish: <b>halol</b> darhol g'alaba, <b>yonbosh</b> +2, <b>chala</b> +1 ochko. 4 ochko yoki vaqt tugaganda ko'prog'i yutadi.</p>
        <p class="sub">Siz: ${S.title ? '🎖 <b>Orol polvoni</b> · ' : ''}g'alaba ${S.wins} · mag'lubiyat ${S.loss} · halol ${S.halol}${S.streak >= 2 ? ' · <span style="color:var(--ac)">murabbiy yordami yoqilgan (o\'q oynasi uzunroq)</span>' : ''}</p>
        <div class="kr-ladder">${POLVON.map(card).join('')}</div>
        <div class="card" style="margin-top:10px;${champOk && !champDone ? 'border-color:var(--ac)' : ''}"><h4>👑 Kunlik chempion bellashuvi — ${CHAMP.name}</h4><p>${CHAMP.about}. G'olibga ${som(CHAMP.prize)} so'm.</p>
          <button data-a="go:${POLVON.length}" ${!champOk || champDone || st.money < FEE ? 'disabled' : ''}>${!champOk ? 'Oltita polvonni yenging' : champDone ? 'Bugun o\'tkazildi — ertaga yana' : `Chempion bilan bellashish — ${FEE} so'm`}</button></div>
        ${S.belt ? `<div class="row" style="margin-top:10px"><button class="sec" data-a="belt">${K.beltOn() ? "Belbog'ni yechish" : "🥋 Polvon belbog'ini taqish"}</button></div>` : ''}`;
      g.ui.on({ go: (i) => { g.ui.close(); K.start(+i); }, belt: () => { K.wearBelt(!K.beltOn()); render(); } });
    };
    render();
  };
  return K;
}
