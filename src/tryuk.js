// Havodagi tryuklar (salto, dumalash, gir) va kombo, har transportning rekordi va toifa medali, g'olib kuboklari, «Sovrinlar» oynasi, uydagi sovrinlar javoni, poyga doirasi jadalligi
import * as THREE from 'three';
import * as T from './terrain.js';
import { GB, MAT } from './geo.js';
import * as COL from './colliders.js';
import { UI } from './ui.js';
import { fmtTime } from './game.js';
import { VEHICLES, vehById } from './vehicles.js';

const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const som = (n) => Math.round(n).toLocaleString('ru-RU');
const TAU = Math.PI * 2, DEG = 180 / Math.PI;
export const COMBO_WIN = 4, COMBO_MAX = 8, PAY_MAX = 600, CUP_PAY = 300, CHAMP = 15; // kombo oynasi (s), eng katta ko'paytuvchi, kombo puli chegarasi, birinchi kubok puli, «Chempion» bo'yog'i uchun kuboklar
export const MEDAL = ['', '🥉', '🥈', '🥇'], MEDAL_N = ['', 'Bronza', 'Kumush', 'Oltin'], MEDAL_PAY = [0, 40, 70, 120];
const SPIN_PTS = { 180: 100, 360: 220, 540: 380, 720: 560 };
const plural = (n, a) => (n === 2 ? "Qo'sh " + a.toLowerCase() : n === 3 ? 'Uch karra ' + a.toLowerCase() : n > 3 ? n + ' karra ' + a.toLowerCase() : a);

// Havodagi aylanishlardan tryuklar: p — bo'ylama o'q (musbat — burun pastga, oldinga salto), r — dumalash, y — gir (radian, jism o'qlarida yig'ilgan)
export function judge(p, r, y) {
  const out = [], np = Math.floor(Math.abs(p) / TAU + 0.25), nr = Math.floor(Math.abs(r) / TAU + 0.25), dy = Math.abs(y) * DEG;
  if (np > 0) out.push(p > 0 ? { id: 'salto', n: np, name: plural(np, 'Salto'), pts: 300 * np } : { id: 'osalto', n: np, name: plural(np, 'Orqaga salto'), pts: 350 * np });
  if (nr > 0) out.push({ id: 'roll', n: nr, name: plural(nr, 'Dumalash'), pts: 250 * nr });
  if (dy >= 150) { const s = Math.floor((dy + 30) / 180) * 180; out.push({ id: 'spin', n: s, name: `Gir ${s}°`, pts: SPIN_PTS[s] || 560 + ((s - 720) / 180) * 200 }); }
  return out;
}
// Transport toifasi va me'yor ko'paytuvchisi (eng yuqori tezlik va og'irlikka qarab): poyga vaqti me'yori ×f, ochko/tezlik me'yori ÷f
export const vehClass = (id) => { const v = vehById[id] || vehById.jip; return v.cls === 'bike' ? "Ikki g'ildirakli" : v.spec.mass > 3000 ? "Og'ir" : v.spec.top >= 240 ? 'Sport' : 'Yengil'; };
export const vehFactor = (id) => { const v = vehById[id] || vehById.jip, f = Math.min(2.6, Math.max(0.85, Math.pow(121 / v.spec.top, 0.6))); return +(f * (v.spec.mass > 3000 ? 1.12 : 1)).toFixed(3); };

export function initTryuk(game) {
  const st = game.state, ui = game.ui, car = game.car, A = game.acts.acts;
  // saqlov: eski yoki buzilgan holat standart qiymatlar bilan to'ldiriladi
  const D = () => ({ rec: {}, cups: {}, best: { n: 0, pts: 0 }, tricks: 0, tlog: {}, paid: {} });
  if (!st.sovrin || typeof st.sovrin !== 'object') st.sovrin = D();
  { const d = D(), s = st.sovrin; for (const k in d) if (s[k] == null || typeof s[k] !== typeof d[k]) s[k] = d[k]; if (!Number.isFinite(s.best.n)) s.best = d.best; }
  const S = st.sovrin;
  const K = (game.tryuk = { judge, vehClass, vehFactor, COMBO_WIN });

  // ================= HUD: tryuk yozuvi va kombo o'lchagichi =================
  const pop = el('div'); pop.id = 'tryuk'; ui.hud.appendChild(pop);
  const live = el('div'); live.id = 'tk-live'; ui.hud.appendChild(live);
  const meter = el('div'); meter.id = 'tk-combo'; meter.innerHTML = '<div class="tk-c"></div><div class="tk-bar"><i></i></div>'; ui.hud.appendChild(meter);
  const mText = meter.firstChild, mBar = meter.querySelector('i');
  let popT = 0;
  const popup = (name, sub, kind = '') => { pop.className = ''; void pop.offsetWidth; pop.className = 'on ' + kind; pop.innerHTML = `<div class="tk-n">${name}</div>${sub ? `<div class="tk-s">${sub}</div>` : ''}`; popT = 2.2; K.lastPopup = { name, sub, kind }; };

  // ================= havodagi holat va kombo =================
  const air = (K.air = { on: false, t: 0, p: 0, r: 0, y: 0, c0: 0, mp: 0, mr: 0, my: 0 });
  const C = (K.combo = { n: 0, bank: 0, t: 0, names: [] });
  const qp = car.q.slice();
  const bestLog = (k, v) => { if (!(S.tlog[k] >= v)) S.tlog[k] = v; };
  const payout = () => {
    if (!C.n) return; const money = Math.min(PAY_MAX, Math.round(C.bank / 4));
    game.addMoney(money, 'Tryuk kombosi'); st.xp += Math.min(40, 3 + C.n * 4);
    const rec = C.bank > S.best.pts; if (rec) S.best.pts = Math.round(C.bank); if (C.n > S.best.n) S.best.n = C.n;
    game.toast(`🤸 Kombo ×${C.n} · ${som(C.bank)} ochko · +${som(money)} so'm${rec ? ' · Yangi rekord!' : ''}`, 'gold'); game.audio.sfx(rec ? 'medal' : 'coin');
    K.lastPay = { n: C.n, bank: C.bank, money }; C.n = 0; C.bank = 0; C.t = 0; C.names = []; game.save();
  };
  const burn = (why) => {
    const had = C.n > 0; if (had) { popup('Kombo kuydi!', `${why} · ${som(C.bank)} ochko yo'qoldi`, 'bad'); game.audio.sfx('fail'); }
    else if (Math.max(Math.abs(air.p), Math.abs(air.r)) > 2.2) popup("Qo'nish chiqmadi", why, 'bad');
    C.n = 0; C.bank = 0; C.t = 0; C.names = []; K.lastBurn = { why, had };
  };
  // havodan tushganda: clean — to'rt g'ildirakda tik qo'ndi
  const land = (clean, why = "Ag'darildingiz") => {
    air.on = false; live.className = '';
    if (!clean) { air.hold = true; return burn(why); }
    const tr = judge(air.p, air.r, air.y); if (!tr.length) return;
    let pts = tr.reduce((s, x) => s + x.pts, 0) + Math.round(air.t * 20);
    C.n = Math.min(COMBO_MAX, C.n + 1); const gain = pts * C.n; C.bank += gain; C.t = COMBO_WIN; C.names.push(...tr.map((x) => x.name));
    S.tricks += tr.length; for (const x of tr) bestLog(x.id, x.n);
    popup(tr.map((x) => x.name).join(' + ') + '!', `${C.n > 1 ? `<b>×${C.n}</b> ` : ''}+${som(gain)}`, C.n > 1 ? 'gold' : '');
    game.audio.sfx(C.n > 1 ? 'pick' : 'coin'); K.lastTrick = { tricks: tr, pts, gain, mult: C.n };
  };
  K.land = land;
  // sinov uchun: havodagi aylanishlarni berib, qo'nishni o'tkazish
  K._air = (p, r, y, t = 1.5, clean = true, why) => { Object.assign(air, { on: true, t, p, r, y }); land(clean, why); return { combo: C.n, bank: C.bank, last: K.lastTrick, popup: K.lastPopup }; };

  game.hooks.push((dt) => {
    const q = car.q, ok = game.mode === 'play' && !game.player.onFoot && !(game.coop && game.coop.ride) && !(game.interior && game.interior.inside);
    // oxirgi kadrdan beri burilish (jism o'qlarida): d = qp⁻¹ · q
    const ax = qp[3] * q[0] - qp[0] * q[3] - qp[1] * q[2] + qp[2] * q[1], ay = qp[3] * q[1] + qp[0] * q[2] - qp[1] * q[3] - qp[2] * q[0], az = qp[3] * q[2] - qp[0] * q[1] + qp[1] * q[0] - qp[2] * q[3];
    let aw = qp[3] * q[3] + qp[0] * q[0] + qp[1] * q[1] + qp[2] * q[2], sx = 1; if (aw < 0) { aw = -aw; sx = -1; }
    const vl = Math.hypot(ax, ay, az), k = vl > 1e-9 ? (2 * Math.atan2(vl, aw) / vl) * sx : 0;
    qp[0] = q[0]; qp[1] = q[1]; qp[2] = q[2]; qp[3] = q[3];
    if (popT > 0 && (popT -= dt) <= 0) pop.className = '';
    if (!ok) { if (air.on) air.on = false; live.className = ''; } else {
      if (air.hold && car.onGround > 0) air.hold = false; // muvaffaqiyatsiz qo'nishdan keyin yerga tekkuncha yangi sakrash hisoblanmaydi
      if (car.onGround === 0 && !car.inWater && !air.hold) {
        if (!air.on) Object.assign(air, { on: true, t: 0, p: 0, r: 0, y: 0, c0: st.stats.crashes, armP: false, armS: false });
        if (Math.abs(vl * k) < 1.5) { air.t += dt; air.p += ax * k; air.y += ay * k; air.r += az * k; } // katta sakrash — ko'chirish (teleport), hisoblanmaydi
        const deg = Math.max(Math.abs(air.p), Math.abs(air.r), Math.abs(air.y) * 0.75) * DEG;
        if (deg > 100 && air.t > 0.3) { const s = `↻ ${Math.round(deg / 10) * 10}°`; if (live.textContent !== s) live.textContent = s; live.className = 'on'; }
        // tom yoki yon tomonga tushib qoldi (g'ildiraklar yerga tegmaydi)
        if (air.t > 0.5 && car.R[4] < 0.3 && Math.abs(car.v[1]) < 1.2 && car.speed < 4) land(false, "Ag'darildingiz");
        // havoda boshqaruv (faqat o'yin qatlamida, physics.js o'zgarmaydi): W/S — salto, A/D — dumalash, Probel+A/D — gir.
        // Uchishdan oldin bosib turilgan tugma hisoblanmaydi — havoda qo'yib yuborib, qayta bosilganda ishlaydi (gaz bosib sakraganda o'zi ag'darilib ketmasin)
        if (air.on && air.t > 0.3 && !game.auto && !(game.act && game.act.state === 'count')) {
          const I = game.input.state, pin = (I.throttle || 0) - (I.brake || 0), sin = I.steer || 0;
          if (Math.abs(pin) < 0.1) air.armP = true; if (Math.abs(sin) < 0.1) air.armS = true;
          const tp = air.armP ? pin * 5 : null, spin = !!I.handbrake, ts = air.armS && Math.abs(sin) > 0.1 ? sin * (spin ? 4.4 : 5) : null;
          if (tp || ts) { const R = car.R, w = car.w, a = Math.min(1, dt * 5);
            let wx = R[0] * w[0] + R[3] * w[1] + R[6] * w[2], wy = R[1] * w[0] + R[4] * w[1] + R[7] * w[2], wz = R[2] * w[0] + R[5] * w[1] + R[8] * w[2];
            if (tp) wx += (tp - wx) * a; if (ts != null) { if (spin) wy += (ts - wy) * a; else wz += (-ts - wz) * a; }
            w[0] = R[0] * wx + R[1] * wy + R[2] * wz; w[1] = R[3] * wx + R[4] * wy + R[5] * wz; w[2] = R[6] * wx + R[7] * wy + R[8] * wz; }
        }
      } else if (air.on) {
        if (air.t < 0.3) { air.on = false; live.className = ''; }
        else if (car.inWater) land(false, 'Suvga tushdingiz');
        else if (st.stats.crashes > air.c0) land(false, 'Urilib qoldingiz');
        else land(car.R[4] > 0.55, "Qiyshiq qo'ndingiz");
      }
    }
    // kombo: havoda bo'lmaganda oyna vaqti kamayadi; urilsangiz — kuyadi
    if (C.n) { if (st.stats.crashes > (C.c0 ?? st.stats.crashes) && !air.on) burn('Urilib qoldingiz'); else if (!air.on && (C.t -= dt) <= 0) payout(); }
    C.c0 = st.stats.crashes;
    const sh = C.n > 0; if (sh) { const s = `KOMBO <b>×${C.n}</b> · ${som(C.bank)}`; if (mText.innerHTML !== s) mText.innerHTML = s; mBar.style.width = Math.max(0, C.t / COMBO_WIN) * 100 + '%'; }
    if (meter.classList.contains('on') !== sh) meter.classList.toggle('on', sh);
    // poyga doirasi: chellenj holatiga qarab jadallik (0 — jim)
    game.audio.raceK = doiraK();
    if ((shelfT -= dt) <= 0) { shelfT = 1.5; refreshShelf(); }
  });

  // ================= poyga doirasi jadalligi =================
  const doiraK = () => {
    const a = game.act; if (!a || game.mode === 'menu') return 0; const d = a.def;
    if (d.type === 'race') { const n = a.cps.length; if (a.state === 'count') return 0.3; if (a.cpi >= n - 1) return 1; return Math.min(0.92, 0.4 + 0.3 * (a.cpi / n) + (a.place === 1 ? 0.2 : 0)); }
    if (d.type === 'drift' || d.type === 'smash' || d.type === 'col') return a.timer < 8 ? 1 : a.timer < 15 ? 0.75 : 0.35;
    return a.timer != null && a.timer < 15 ? 0.6 : 0; // oddiy buyurtma — faqat oxirgi soniyalarda
  };
  K.doiraK = doiraK;

  // ================= transport rekordlari va medallar =================
  const medalOf = (a, v, id) => {
    const f = vehFactor(id), s = Math.sqrt(f);
    if (a.type === 'race') { game.raceInfo(a); const t = a._t; return v <= t[2] * f ? 3 : v <= t[1] * f ? 2 : v <= t[0] * f ? 1 : 0; }
    const div = a.type === 'radar' ? f : a.type === 'drift' || a.type === 'smash' || a.type === 'jump' ? s : 0;
    if (div) { const t = a.thr; return v >= t[2] / div ? 3 : v >= t[1] / div ? 2 : v >= t[0] / div ? 1 : 0; }
    return Math.max(0, Math.min(3, v | 0)); // buyurtma, yig'ish — shu transportda olingan yulduzlar
  };
  const lowBetter = (a) => a.type === 'race';
  const fmtVal = (a, v) => (a.type === 'race' ? fmtTime(v) : a.type === 'radar' ? `${v} km/soat` : a.type === 'jump' ? `${v} m` : a.type === 'drift' ? `${som(v)} ochko` : a.type === 'smash' ? `${v} ta` : '★'.repeat(v) || '—');
  K.medalOf = medalOf; K.fmtVal = fmtVal;
  const record = (a, v, id = st.veh.cur) => {
    if (!a || a.cat === 'inf' || v == null || !Number.isFinite(v)) return null;
    const r = S.rec[a.id] || (S.rec[a.id] = {}), old = r[id], m = medalOf(a, v, id), om = old ? old[1] : 0;
    const nb = !old || (lowBetter(a) ? v < old[0] : v > old[0]);
    r[id] = [nb ? v : old[0], Math.max(m, om)];
    const key = a.id + ':' + id, pd = S.paid[key] || 0; let pay = 0;
    if (m > pd) { pay = MEDAL_PAY[m] - MEDAL_PAY[pd]; S.paid[key] = m; game.addMoney(pay, 'Transport medali'); st.xp += (m - pd) * 10; }
    const res = { a, id, v, m, nb: nb && !!old, newMedal: m > om, pay };
    if (res.newMedal) { const vn = (vehById[id] || {}).name; game.toast(`${MEDAL[m]} ${MEDAL_N[m]} medal — ${vn} (${vehClass(id).toLowerCase()} toifa) · ${a.name}${pay ? ` · +${pay} so'm` : ''}`, 'gold'); game.audio.sfx('medal'); }
    K.lastRec = res; return res;
  };
  K.record = record;
  game.onFeat = (a, v) => { if (!game.player.onFoot) record(a, Math.round(v)); };
  K.counts = () => { const c = [0, 0, 0, 0]; for (const k in S.rec) for (const id in S.rec[k]) c[S.rec[k][id][1]]++; return { b: c[1], s: c[2], g: c[3] }; };
  K.vehCounts = (id) => { const c = [0, 0, 0, 0]; for (const k in S.rec) { const r = S.rec[k][id]; if (r) c[r[1]]++; } return c; };
  K.cupTotal = () => { let n = 0; for (const k in S.cups) n += S.cups[k]; return n; };
  K.cupRaces = () => Object.keys(S.cups).filter((k) => S.cups[k] > 0).length;
  const cup = (a) => {
    const first = !S.cups[a.id]; S.cups[a.id] = (S.cups[a.id] || 0) + 1;
    if (first) game.addMoney(CUP_PAY, "G'olib kubogi");
    let champ = false;
    if (K.cupTotal() >= CHAMP && !st.paints.includes('chempion')) { st.paints.push('chempion'); champ = true; }
    K.lastCup = { id: a.id, first, total: K.cupTotal(), champ };
    return K.lastCup;
  };
  K.cup = cup;

  // chellenj tugashi: natija shu transport rekordiga, 1-o'rin — kubok
  let resLine = null;
  const ea = game.endAct;
  game.endAct = (ok, why, stars = 0, info = '', ...rest) => {
    const X = game.act; resLine = null;
    if (X && why !== 'cancel' && !(game.coop && game.coop.ride)) {
      const a = X.def; let v = null;
      if (a.type === 'race') { if (X.cps && X.cpi >= X.cps.length) v = +X.t.toFixed(2); }
      else if (a.type === 'drift' || a.type === 'smash') { if (why === 'done' || why === 'low') v = a.type === 'drift' ? Math.round(X.score) : X.count; }
      else if (ok) v = stars;
      const lines = [], r = v != null ? record(a, v) : null, vn = vehById[st.veh.cur].name;
      if (r) { if (r.newMedal) lines.push(`${MEDAL[r.m]} <b>${MEDAL_N[r.m]} medal</b> — ${vn}`); else if (r.nb) lines.push(`${vn} rekordi: <b>${fmtVal(a, v)}</b>`); else if (!S.rec[a.id][st.veh.cur][1]) lines.push(`${vn} uchun me'yor: ${vehClass(st.veh.cur).toLowerCase()} toifa`); }
      if (a.type === 'race' && ok && /(^|\s)1-o'rin/.test(info)) { const c = cup(a); lines.push(`🏆 <b>G'olib kubogi!</b>${c.first ? ` +${CUP_PAY} so'm` : ''} · jami ${c.total}`); if (c.champ) game.banner('Chempion!', `${CHAMP} ta g'olib kubogi yig'dingiz — ustaxonada «Chempion» bo'yog'i ochildi`, 'gold'); }
      if (lines.length) resLine = { id: a.id, lines };
    }
    return ea(ok, why, stars, info, ...rest);
  };
  const sr = ui.s_result;
  ui.s_result = function (w, r, btn) { sr.call(this, w, r, btn); const x = resLine; if (x && r.def && r.def.id === x.id) { resLine = null; const p = el('div', 'tk-res', x.lines.join(' · ')); const row = w.querySelector('.row'); w.insertBefore(p, row); } };

  // telefon ilovasi «Sovrinlar» (hafta.js usulida)
  let wrapped = false;
  game.hooks.push(() => {
    if (wrapped || !ui.s_telefon || !Object.prototype.hasOwnProperty.call(ui, 's_telefon')) return; wrapped = true;
    const tel = ui.s_telefon, add = (w) => { const g = w.querySelector('.ph-apps'); if (g && !g.querySelector('[data-sovrin]')) g.appendChild(el('div', 'ph-app', `<i style="background:#c99a2a">🏆</i><span>Sovrinlar</span>`)).dataset.sovrin = 1; };
    ui.s_telefon = function (w, d, btn, x) { tel.call(this, w, d, btn, x); add(w); new MutationObserver(() => add(w)).observe(w, { childList: true, subtree: true });
      w.addEventListener('click', (e) => { if (e.target.closest('[data-sovrin]')) { game.audio.sfx('click'); ui.open('sovrin'); } }); };
  });

  // ================= uydagi sovrinlar javoni =================
  // hovlining old to'sig'i yonida (uy o'qlarida x 12, z 12.4 — so'ri va favvoradan chetda), uyga qaragan; javon to'ladi — erishilmagan sovrinlar kulrang soya
  const home = game.site.places.uy.home, LX = 12, LZ = 12.4, RA = Math.PI, wp = home.W(LX, LZ), ca = Math.cos(RA), sa = Math.sin(RA);
  let gy = -1e9; for (const [dx, dz] of [[-1.3, -0.4], [1.3, -0.4], [-1.3, 0.4], [1.3, 0.4], [0, 0]]) { const q = home.W(LX + dx * ca + dz * sa, LZ - dx * sa + dz * ca); gy = Math.max(gy, T.gridHeight(q[0], q[1])); }
  const shelf = (K.shelf = new THREE.Group()); shelf.position.set(wp[0], gy, wp[1]); shelf.rotation.y = home.yaw + RA; game.scene.add(shelf);
  {
    const g = new GB(8801); g.jit = 0.02; const wd = 0x8a5a36, wdD = 0x5e3c24, wdL = 0xb07a4a;
    g.color(0x9a948a).box(0, -0.35, 0, 2.9, 0.9, 1.0); // tosh supa (yer ostiga kiradi)
    g.color(wdD).box(0, 1.2, -0.32, 2.5, 2.3, 0.08); // orqa devor
    for (const sx of [-1, 1]) g.color(wd).box(sx * 1.22, 1.2, 0, 0.1, 2.3, 0.72); // yon devorlar
    g.color(wdL); for (const y of [0.14, 0.86, 1.56]) g.box(0, y, 0, 2.36, 0.08, 0.66); // tokchalar
    g.color(wd).box(0, 2.38, 0.02, 2.7, 0.12, 0.84); g.color(wdD).box(0, 2.5, 0.02, 2.5, 0.1, 0.7); // tepa bo'g'ot
    g.color(0x2f5a98).box(0, 2.24, 0.37, 2.0, 0.22, 0.03); g.color(0xf0c84a).box(0, 2.24, 0.39, 1.7, 0.05, 0.01); // lavha
    g.color(0xb83a2e).box(0, 0.05, 0.1, 2.3, 0.02, 0.5); // pastki tokchada qizil gilam
    const m = new THREE.Mesh(g.build(), MAT.flat); m.castShadow = true; m.receiveShadow = true; shelf.add(m);
    const cs = Math.cos(shelf.rotation.y), sn = Math.sin(shelf.rotation.y), Wl = (x, z) => [wp[0] + x * cs + z * sn, wp[1] - x * sn + z * cs];
    const a1 = Wl(-1.25, -0.35), a2 = Wl(1.25, -0.35), b1 = Wl(-1.25, 0.38), b2 = Wl(1.25, 0.38);
    for (const [p, q] of [[a1, a2], [b1, b2], [a1, b1], [a2, b2]]) COL.addSeg(p[0], p[1], q[0], q[1], 0.12, gy - 1, gy + 2.6);
  }
  // sovrinlar: kubok (yuqori tokcha), medal (o'rta), lavha/quticha (pastki) — InstancedMesh, rangi instans rangi bilan
  const mkI = (fn, n) => { const g = new GB(8810 + n); g.jit = 0; g.color(0xffffff); fn(g); const im = new THREE.InstancedMesh(g.build(), MAT.flat, n); im.castShadow = true; shelf.add(im); return im; };
  const cupIM = mkI((g) => { g.color(0x8a8a8a).box(0, 0.05, 0, 0.26, 0.1, 0.26); g.color(0xd0d0d0).cyl(8, 0.04, 0.04, 0.1, 0.24); g.color(0xffffff).cyl(10, 0.06, 0.17, 0.24, 0.5, { cap: true }); for (const sx of [-1, 1]) g.box(sx * 0.2, 0.4, 0, 0.05, 0.14, 0.03); }, 5);
  const medIM = mkI((g) => { g.color(0x8a8a8a).box(0, 0.03, -0.04, 0.22, 0.06, 0.14); g.color(0xbfbfbf).box(0, 0.25, -0.05, 0.08, 0.4, 0.02); g.push().translate(0, 0.2, 0).rotX(Math.PI / 2); g.color(0xffffff).cyl(12, 0.12, 0.12, -0.02, 0.02, { cap: true }); g.pop(); }, 6);
  const plaqIM = mkI((g) => { g.color(0x9a9a9a).box(0, 0.24, -0.08, 0.5, 0.42, 0.05); g.color(0xffffff).box(0, 0.24, -0.05, 0.4, 0.32, 0.02); g.color(0x9a9a9a).box(0, 0.03, 0, 0.36, 0.06, 0.12); }, 4);
  const put = (im, i, x, y) => { const m = new THREE.Matrix4().makeTranslation(x, y, 0.05); im.setMatrixAt(i, m); };
  for (let i = 0; i < 5; i++) put(cupIM, i, -0.92 + i * 0.46, 1.6);
  for (let i = 0; i < 6; i++) put(medIM, i, -0.95 + i * 0.38, 0.9);
  for (let i = 0; i < 4; i++) put(plaqIM, i, -0.84 + i * 0.56, 0.18);
  const GRAY = 0x55575c, CUPS_AT = [1, 3, 6, 10, CHAMP], c3 = new THREE.Color();
  // har sovrin: [rang, erishildimi]
  K.shelfState = () => {
    const ct = K.cupRaces(), mc = K.counts(), fin = A.find((a) => a.opt && a.opt.final);
    return {
      cups: CUPS_AT.map((n) => ct >= n),
      medals: [[0xc87a3e, mc.b + mc.s + mc.g >= 1], [0xc87a3e, mc.b >= 10], [0xd8dce4, mc.s + mc.g >= 1], [0xd8dce4, mc.s >= 10], [0xffc83a, mc.g >= 1], [0xffc83a, mc.g >= 10]],
      plaq: [[0xffc83a, !!(fin && st.stars[fin.id] > 0)], [0xc79a66, st.chests.length >= game.chestTotal], [0x4fd0ff, S.best.n >= 4], [0xe8e8f0, st.stats.jump >= 60]],
    };
  };
  let shelfSig = '', shelfT = 0;
  const refreshShelf = () => {
    const s = K.shelfState(), sig = JSON.stringify(s); if (sig === shelfSig) return; shelfSig = sig;
    s.cups.forEach((on, i) => cupIM.setColorAt(i, c3.setHex(on ? 0xffc83a : GRAY)));
    s.medals.forEach(([hex, on], i) => medIM.setColorAt(i, c3.setHex(on ? hex : GRAY)));
    s.plaq.forEach(([hex, on], i) => plaqIM.setColorAt(i, c3.setHex(on ? hex : GRAY)));
    for (const im of [cupIM, medIM, plaqIM]) im.instanceColor.needsUpdate = true;
    K.shelfOn = s.cups.filter(Boolean).length + s.medals.filter((x) => x[1]).length + s.plaq.filter((x) => x[1]).length;
  };
  refreshShelf(); K.refreshShelf = () => { shelfSig = ''; refreshShelf(); return K.shelfOn; };
  K.shelfAt = () => ({ x: wp[0], y: gy, z: wp[1], yaw: shelf.rotation.y });

  // uslublar
  const css = el('style'); css.textContent = `
#tryuk{left:50%;top:31%;transform:translate(-50%,0) scale(.6);text-align:center;opacity:0;pointer-events:none;white-space:nowrap;text-shadow:0 3px 14px rgba(0,0,0,.7),0 0 2px #000}
#tryuk.on{animation:tkin 2.2s ease-out forwards}
#tryuk .tk-n{font-size:46px;font-weight:900;font-style:italic;letter-spacing:1px;color:#fff;-webkit-text-stroke:1px rgba(0,0,0,.4)}
#tryuk.gold .tk-n{color:#ffd23a;text-shadow:0 3px 0 #b8701e,0 4px 16px rgba(0,0,0,.6)}
#tryuk.bad .tk-n{color:var(--bad)}
#tryuk .tk-s{font-size:22px;font-weight:800;color:#fff2c4;margin-top:2px}#tryuk .tk-s b{display:inline-block;padding:1px 10px;border-radius:999px;background:var(--ac);color:#141824;font-style:normal;margin-right:6px;text-shadow:none}
@keyframes tkin{0%{opacity:0;transform:translate(-50%,0) scale(.5) rotate(-6deg)}12%{opacity:1;transform:translate(-50%,0) scale(1.12) rotate(2deg)}22%{transform:translate(-50%,0) scale(1) rotate(0)}80%{opacity:1;transform:translate(-50%,-6px) scale(1)}100%{opacity:0;transform:translate(-50%,-24px) scale(.96)}}
#tk-live{left:50%;top:44%;transform:translateX(-50%);font-size:26px;font-weight:900;color:#fff;opacity:0;transition:opacity .2s;text-shadow:0 2px 10px rgba(0,0,0,.7)}#tk-live.on{opacity:.92}
#tk-combo{left:50%;bottom:196px;transform:translateX(-50%);text-align:center;opacity:0;transition:opacity .25s;pointer-events:none}#tk-combo.on{opacity:1}
#tk-combo .tk-c{font-size:20px;font-weight:900;letter-spacing:1px;color:#fff;text-shadow:0 2px 10px rgba(0,0,0,.7)}#tk-combo .tk-c b{color:var(--ac);font-size:28px}
#tk-combo .tk-bar{width:190px;height:6px;margin:5px auto 0;border-radius:4px;background:rgba(255,255,255,.18);overflow:hidden}#tk-combo .tk-bar i{display:block;height:100%;background:var(--ac);border-radius:4px}
.tk-res{margin:10px auto 0;padding:8px 12px;border-radius:12px;background:rgba(255,200,58,.14);border:1px solid var(--ac);font-weight:700;font-size:15px;max-width:560px}
.sv-top{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin:4px 0 10px}
.sv-top div{padding:9px 10px;border-radius:12px;background:rgba(255,255,255,.06);border:1px solid var(--bd);text-align:center}.sv-top b{display:block;font-size:22px;color:var(--ac)}.sv-top small{color:var(--mut);font-size:12px}
.sv-cups{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:6px}
.sv-cup{display:flex;gap:8px;align-items:center;padding:6px 9px;border-radius:10px;background:rgba(255,255,255,.05);font-size:12.5px;line-height:1.2}.sv-cup i{font-style:normal;font-size:22px;filter:grayscale(1);opacity:.35}.sv-cup.on i{filter:none;opacity:1}.sv-cup.on{background:rgba(255,200,58,.12)}
.sv-veh{display:flex;flex-wrap:wrap;gap:6px;margin:4px 0 8px}.sv-veh button{min-height:38px;padding:5px 10px;font-size:12.5px}.sv-veh button.on{background:var(--ac);color:#141824}.sv-veh button small{opacity:.75;margin-left:4px}
.sv-tab table{width:100%;border-collapse:collapse;font-size:13.5px}.sv-tab td,.sv-tab th{padding:5px 8px;text-align:left;border-bottom:1px solid rgba(255,255,255,.08)}.sv-tab th{color:var(--mut);font-weight:700}
.sv-grid{display:grid;grid-template-columns:minmax(0,1.3fr) minmax(0,1fr);gap:14px}
.win h4.sv-h{margin:14px 0 6px}
@media(max-width:820px){.sv-grid{grid-template-columns:1fr}.sv-top{grid-template-columns:repeat(2,minmax(0,1fr))}#tryuk .tk-n{font-size:34px}}`;
  document.head.appendChild(css);
  return K;
}

// ---------- «Sovrinlar» oynasi ----------
const TL = { salto: 'Salto (ketma-ket)', osalto: 'Orqaga salto', roll: 'Dumalash', spin: 'Eng katta gir' };
UI.prototype.s_sovrin = function (w, d, btn, x) {
  const g = this.g, st = g.state, S = st.sovrin, K = g.tryuk, acts = g.acts.acts; x();
  const sel = (d && d.veh) || st.veh.cur, mc = K.counts(), ct = K.cupTotal(), cr = K.cupRaces();
  const races = acts.filter((a) => a.cat === 'race');
  const vc = K.vehCounts(sel), rows = acts.map((a) => [a, S.rec[a.id] && S.rec[a.id][sel]]).filter((q) => q[1]).sort((p, q) => q[1][1] - p[1][1]);
  const f = K.vehFactor(sel), v = vehById[sel] || vehById.jip;
  w.innerHTML = `<h1>Sovrinlar <small>kuboklar, medallar va tryuklar</small></h1>
    <div class="sv-top"><div><b>🏆 ${ct}</b><small>g'olib kuboklari · ${cr}/${races.length} poyga</small></div><div><b>🥇${mc.g} 🥈${mc.s} 🥉${mc.b}</b><small>transport medallari</small></div>
      <div><b>×${S.best.n || 0}</b><small>eng uzun kombo · ${som(S.best.pts || 0)} ochko</small></div><div><b>${S.tricks}</b><small>bajarilgan tryuklar</small></div></div>
    <div class="sv-grid"><div><h4 class="sv-h">Transport medallari</h4>
      <p class="sub" style="margin:0 0 6px">Har transportda har chellenjning o'z rekordi saqlanadi. Me'yor toifaga moslanadi: sekin va og'ir transportda medal olish osonroq, sport mashinasida — qiyinroq.</p>
      <div class="sv-veh">${VEHICLES.map((q) => { const c = K.vehCounts(q.id), n = c[1] + c[2] + c[3]; return `<button class="${q.id === sel ? 'on' : 'sec'}" data-a="veh:${q.id}">${q.name}${n ? `<small>${c[3] ? '🥇' + c[3] : ''}${c[2] ? '🥈' + c[2] : ''}${c[1] ? '🥉' + c[1] : ''}</small>` : ''}</button>`; }).join('')}</div>
      <div class="stat"><span>${v.name} · ${K.vehClass(sel)} toifa</span><b>me'yor ×${f.toFixed(2)} · 🥇${vc[3]} 🥈${vc[2]} 🥉${vc[1]}</b></div>
      <div class="sv-tab">${rows.length ? `<table><tr><th>Chellenj</th><th>Rekord</th><th>Medal</th></tr>${rows.slice(0, 40).map(([a, r]) => `<tr><td>${a.name}</td><td>${K.fmtVal(a, r[0])}</td><td>${r[1] ? MEDAL[r[1]] + ' ' + MEDAL_N[r[1]] : '—'}</td></tr>`).join('')}</table>` : `<p class="sub">Bu transportda hali natija yo'q — poyga, drift, radar yoki tramplinni sinab ko'ring.</p>`}</div>
    </div><div><h4 class="sv-h">G'olib kuboklari</h4><p class="sub" style="margin:0 0 6px">Poygada 1-o'rin — kubok (birinchisi +${CUP_PAY} so'm). ${CHAMP} ta kubok yig'sangiz, ustaxonada «Chempion» bo'yog'i ochiladi.</p>
      <div class="sv-cups">${races.map((a) => `<div class="sv-cup ${S.cups[a.id] ? 'on' : ''}"><i>🏆</i><span>${a.name}${S.cups[a.id] ? `<br><small>×${S.cups[a.id]}</small>` : ''}</span></div>`).join('')}</div>
      <h4 class="sv-h">Tryuklar daftari</h4>
      ${Object.keys(TL).map((k) => `<div class="stat"><span>${TL[k]}</span><b>${S.tlog[k] ? (k === 'spin' ? S.tlog[k] + '°' : '×' + S.tlog[k]) : '—'}</b></div>`).join('')}
      <div class="stat"><span>Eng uzun kombo</span><b>${S.best.n ? `×${S.best.n} · ${som(S.best.pts)} ochko` : '—'}</b></div>
      <p class="sub" style="margin-top:8px">Tramplindan uchib, havoda <kbd>W</kbd>/<kbd>S</kbd> bilan salto qiling. To'rt g'ildirakda toza qo'nsangiz tryuk yoziladi; ${COMBO_WIN} soniya ichida keyingisi — kombo ×2, ×3… ×${COMBO_MAX}. Urilsangiz yoki ag'darilsangiz, kombo kuyadi. Uyingiz hovlisidagi javonda sovrinlar ko'rinadi.</p>
    </div></div>`;
  this.on({ veh: (id) => this.open('sovrin', { veh: id }) });
};
