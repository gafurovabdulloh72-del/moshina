// Daromad: yangi pul topish yo'llari uchun umumiy tizim — ish e'lonlari (hammasi bitta ro'yxatda), bitta ish o'rni, HUD, nur belgilari, ish beruvchilar, obro' darajasi (ko'proq haq), «+so'm» ko'rinishi, daromad manbalari hisobi (bugun/hafta) va telefon «Daromad» ilovasi
import * as THREE from 'three';
import * as T from './terrain.js';
import { UI } from './ui.js';
import { vehById } from './vehicles.js';
import { makeRig, poseRig } from './rig.js';
import { ACTIONS } from './controls.js';
import { angDiff } from './util.js';
import { initIshlar2 } from './ishlar2.js';
import { initIshlar3 } from './ishlar3.js';
import { initSavdo } from './savdo.js';
import { initMoliya } from './moliya.js';

export const som = (n) => Math.round(n).toLocaleString('ru-RU');
export const mmss = (s) => { s = Math.max(0, Math.ceil(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
// obro' darajalari: tajriba chegaralari va nomlari; har daraja haqni 8 % oshiradi va yaxshiroq buyurtmalar ochadi
export const REP = [0, 30, 80, 160, 280, 450];
export const REP_N = ['Shogird', 'Ishchi', 'Tajribali', 'Usta', 'Mohir', 'Afsona'];
export const CATS = { veh: ['🚗', 'Transport bilan'], foot: ['🚶', 'Piyoda'], pul: ['💰', 'Sarmoya va passiv daromad'] };
const DEF_ST = { rep: {}, jobs: {}, days: [], all: {}, cargo: {}, hives: [], rent: {}, bank: { dep: 0, day: -1, earned: 0 }, coop: { n: 0, cost: 0, day: -1, earned: 0, hist: [] }, photo: { n: 0 } };
// sinov va muvozanat: har ishning taxminiy to'lov oralig'i (so'm, bitta ish uchun) — e'lonlarda ko'rsatiladi, sinov ham shuni tekshiradi
export const vcls = (id) => (vehById[id] || {}).cls || 'car';

export function initDaromad(game) {
  const { scene, car, ui } = game, st = game.state, pl = game.player, L = game.live, IS = game.ish, IN = game.interior;
  const D = { defs: {}, order: [], cur: null, givers: {}, lastPay: null }; game.daromad = D;
  const toast = (m, k) => game.toast(m, k), sfx = (n, k) => game.audio.sfx(n, k);
  // saqlov: defState() dagi standart qiymatlar (eski saqlovda ichki maydonlar yo'q bo'lsa ham)
  st.daromad = Object.assign({}, JSON.parse(JSON.stringify(DEF_ST)), st.daromad || {}); for (const k of ['bank', 'coop', 'photo']) st.daromad[k] = Object.assign({}, DEF_ST[k], st.daromad[k] || {});
  const S = st.daromad; D.S = S;
  const gy = (x, z) => T.ground(x, z, 1e9).y; D.gy = gy;
  const pos = () => (pl.onFoot ? pl.p : car.p); D.pos = pos;
  D.dist = (p) => { const q = pos(); return Math.hypot(p.x - q[0], p.z - q[2]); };
  D.vid = () => st.veh.cur; D.cls = () => vcls(st.veh.cur);
  D.bike = () => { const c = D.cls(); return c === 'bike'; };

  // ================= DAROMAD MANBALARI (har pul harakati — o'yin kuni bo'yicha) =================
  const srcOf = (why) => { const s = String(why || 'Daromad').split(/ — |: | \(/)[0].trim(); return s.length > 28 ? s.slice(0, 28) : s; };
  D.srcOf = srcOf;
  const dayRow = () => { const d = st.dunyo.day; let r = S.days[0]; if (!r || r[0] !== d) { r = [d, {}, 0]; S.days.unshift(r); if (S.days.length > 8) S.days.length = 8; } return r; };
  const am1 = game.addMoney;
  game.addMoney = (n, why) => { am1(n, why); n = Math.round(n); if (!n) return; const r = dayRow(); if (n > 0) { const s = srcOf(why); r[1][s] = (r[1][s] || 0) + n; S.all[s] = (S.all[s] || 0) + n; } else r[2] += -n; };
  D.today = () => { const r = S.days.find((q) => q[0] === st.dunyo.day); return r ? r[1] : {}; };
  D.week = () => { const o = {}, d0 = st.dunyo.day; for (const r of S.days) if (d0 - r[0] < 7 && d0 - r[0] >= 0) for (const k in r[1]) o[k] = (o[k] || 0) + r[1][k]; return o; };
  D.spent = (days = 1) => S.days.filter((r) => st.dunyo.day - r[0] < days && st.dunyo.day - r[0] >= 0).reduce((a, r) => a + r[2], 0);
  const sum = (o) => Object.values(o).reduce((a, b) => a + b, 0);

  // ================= OBRO' =================
  D.xp = (id) => S.rep[id] || 0;
  D.lvl = (id) => { const x = D.xp(id); let l = 0; for (let i = 0; i < REP.length; i++) if (x >= REP[i]) l = i; return l; };
  D.mul = (id) => 1 + 0.08 * D.lvl(id);
  D.addXp = (id, n) => { const l0 = D.lvl(id); S.rep[id] = D.xp(id) + n; const l1 = D.lvl(id); if (l1 > l0) { sfx('medal'); game.banner(`${D.defs[id].ic} ${D.defs[id].name}: «${REP_N[l1]}»`, `Obro' ${l1}-daraja — haq +${l1 * 8} %, yangi buyurtmalar ochildi`, 'gold'); } };
  const stat = (id) => S.jobs[id] || (S.jobs[id] = { n: 0, earn: 0, best: 0 });
  D.stat = stat;

  // ================= «+SO'M» KO'RINISHI =================
  const pop = document.createElement('div'); pop.id = 'dr-pop'; let popT = 0, popN = 0;
  D.pop = (n, label) => { if (!pop.parentNode && ui) ui.hud.appendChild(pop); popN = popT > 0.4 ? popN + n : n; pop.innerHTML = `<b>+${som(popN)} so'm</b><small>${label}</small>`; pop.className = ''; void pop.offsetWidth; pop.className = 'on'; popT = 2.2; };
  // to'lov: obro' ko'paytmasi bilan, bank tarixiga manba nomi bilan yoziladi
  D.pay = (id, n, note, raw) => { const d = D.defs[id]; n = Math.round(raw ? n : n * D.mul(id)); if (n <= 0) return 0; game.addMoney(IS && IS.split ? IS.split(n, d.name) : n, d.name + (note ? ' — ' + note : '')); sfx('coin'); D.pop(n, `${d.ic} ${d.name}${note ? ' · ' + note : ''}`);
    const J = D.cur; if (J && J.id === id) J.earn += n; else { const s = stat(id); s.earn += n; } D.lastPay = { id, n, note }; return n; };

  // ================= NUR BELGILARI =================
  const beamMats = [], ringMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7, depthWrite: false, fog: false, side: THREE.DoubleSide });
  const beamGeo = new THREE.CylinderGeometry(0.5, 0.5, 30, 10, 1, true), ringGeo = new THREE.RingGeometry(0.9, 1.15, 24);
  const marks = []; for (let i = 0; i < 12; i++) { const g = new THREE.Group(), bm = new THREE.MeshBasicMaterial({ color: 0xffb24a, transparent: true, opacity: 0.36, depthWrite: false, fog: false }); beamMats.push(bm); const b = new THREE.Mesh(beamGeo, bm); b.position.y = 15; g.add(b); const r = new THREE.Mesh(ringGeo, ringMat); r.rotation.x = -Math.PI / 2; r.position.y = 0.1; g.add(r); g.visible = false; scene.add(g); marks.push(g); }
  D.marks = (pts, col = 0xffb24a) => { marks.forEach((m, i) => { const p = pts && pts[i]; m.visible = !!p; if (p) { m.position.set(p.x, p.y != null ? p.y : gy(p.x, p.z), p.z); beamMats[i].color.setHex(p.c || col); } }); D._mk = (pts || []).slice(0, 12); };
  D._mk = [];

  // ================= ISH BERUVCHILAR (odamlar) =================
  D.giver = (id, x, z, yaw, name, look) => { const r = makeRig(Object.assign({ seed: 6100 + D.order.indexOf(id) * 7 }, look || {})); r.root.position.set(x, gy(x, z), z); r.root.rotation.y = yaw; scene.add(r.root); const g = { id, rig: r, x, z, yaw, yaw0: yaw, wave: 0, name }; D.givers[id] = g; return g; };
  // manzil yonidan bo'sh joy (to'qnashuv jismlari, suv va qiyalikdan uzoq)
  D.spotNear = (cx, cz, r0, r1, ok, seed = 0, rad = 2.5) => { for (let r = r0; r < r1; r += 2) for (let k = 0; k < 24; k++) { const a = k * 0.2618 + r * 0.53 + seed, x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r, si = T.siteInfo(x, z);
    if (si.y < si.water + 0.6 || si.slope > 0.3 || si.roadD < 1.5 || !game.hayot2.freeAt(x, z, rad) || Object.values(D.givers).some((g) => Math.hypot(g.x - x, g.z - z) < 4) || (ok && !ok(x, z, si))) continue; return { x, z, y: si.y }; } return null; };
  D.roadYaw = (x, z) => { const nr = T.nearestRoad(x, z, 8); return nr.edge >= 0 ? Math.atan2(T.roads.x[nr.i] - x, T.roads.z[nr.i] - z) : 0; };
  D.place = (id) => game.site.places[id];
  D.placeName = (id) => (game.site.places[id] && game.site.places[id].name) || id;
  // yo'l nuqtasi: [x, z] yo'lning o'rtasidan yon tomonga off metr
  D.roadPt = (i, off = 0) => { const R = T.roads; return { x: R.x[i] - R.tz[i] * off, z: R.z[i] + R.tx[i] * off, yaw: Math.atan2(R.tx[i], R.tz[i]), i }; };
  D.pathLen = (pts) => pts.reduce((s, p, i, A) => s + (i ? Math.hypot(p[0] - A[i - 1][0], p[1] - A[i - 1][1]) : 0), 0);

  // ================= RO'YXAT =================
  // def: { id, ic, name, cat, place, desc, pay (matn), need (matn), mins, xp, why() — boshlab bo'lmasa sabab, start(J), tick(J, dt, foot), extra(J, offer, px, pz), carE(J) → [matn, fn], line(J), end(J, ok), open() — passiv ishlar oynasi, info() — kartadagi qo'shimcha }
  D.reg = (def) => { D.defs[def.id] = def; if (!D.order.includes(def.id)) D.order.push(def.id); return def; };
  D.busy = () => (D.cur ? 'Avval joriy ishni tugating — [X]' : IS && IS.cur ? 'Avval boshqa ishni tugating — [X]' : game.act ? 'Avval chellenjni tugating' : L.fare ? "Mashinada yo'lovchi bor — avval uni eltib qo'ying" : game.suv && game.suv.cur ? 'Avval qayiq/deltaplandan tushing' : null);
  D.why = (id) => { const d = D.defs[id]; return D.busy() || (d.why ? d.why() : null); };
  D.near = (id, r = 30) => { const g = D.givers[id]; return !g || D.dist(g) < r; };
  D.start = (id, force) => { const d = D.defs[id]; if (!d || d.cat === 'pul') return false; const w = D.why(id); if (w) { toast(w, 'bad'); return false; }
    if (!force && !D.near(id)) { toast(`Avval ish beruvchi oldiga boring: ${D.givers[id].name}`, 'bad'); return false; }
    const J = { id, def: d, done: 0, earn: 0, t: null, t0: 0, el: 0, lvl: D.lvl(id) }; D.cur = J; if (d.start(J) === false) { D.cur = null; D.marks([]); return false; }
    stat(id); sfx('start'); game.banner(`${d.ic} ${d.name}`, J.intro || d.desc, 'gold'); drawHud(); return true; };
  D.finish = (ok, msg) => { const J = D.cur; if (!J) return; D.cur = null; D.marks([]); game.setWaypoint(null); if (J.def.end) J.def.end(J, ok); const s = stat(J.id);
    if (J.done || J.earn) { s.n += ok ? 1 : 0; s.earn += J.earn; s.best = Math.max(s.best, J.earn); D.addXp(J.id, ok ? (J.def.xp || 10) + (J.xpb || 0) : 3); }
    drawHud(); game.save(); game.banner(ok ? `${J.def.ic} Ish bajarildi! 👏` : `${J.def.ic} Ish tugatildi`, msg || `Jami ishlab topildi: ${som(J.earn)} so'm`, ok ? 'gold' : ''); sfx(ok ? 'win' : 'click'); };
  D.quit = () => D.finish(false, D.cur && D.cur.earn ? `Ishlab topilgani sizda qoladi: ${som(D.cur.earn)} so'm` : 'Hech narsa ishlab topilmadi');
  // boshqa ishlar va chellenjlar bilan to'qnashmasin
  const sa0 = game.startAct; game.startAct = (a) => { if (D.cur) return toast('Avval ishni tugating — [X]', 'bad'); return sa0(a); };
  if (IS) for (const k of ['startNon', 'startTaksi', 'startDala']) { const f = IS[k]; if (f) IS[k] = (...a) => (D.cur ? toast('Avval joriy ishni tugating — [X]', 'bad') : f(...a)); }
  { const i = ACTIONS.findIndex((a) => a.key === 'X' && a.bar && /Topshiriq/.test(a.bar(game))); const xa = { key: 'X', codes: ['KeyX'], ok: (g) => !g.act && !(g.ish && g.ish.cur) && !!(g.daromad && g.daromad.cur), bar: () => 'Ishni tugatish', run: (g) => g.daromad.quit() };
    if (i >= 0) { const t0 = ACTIONS[i].ok; ACTIONS[i].ok = (g) => t0(g) && !(g.daromad && g.daromad.cur); ACTIONS.splice(i, 0, xa); } else ACTIONS.splice(ACTIONS.findIndex((a) => a.key === 'T'), 0, xa); }

  // ================= HUD =================
  const hud = document.createElement('div'); hud.className = 'panel tc jobhud dr-hud'; hud.style.display = 'none';
  const drawHud = () => { const J = D.cur; if (!hud.parentNode && ui) ui.hud.appendChild(hud); if (!J || game.act) { hud.style.display = 'none'; return; } hud.style.display = ''; hud.style.top = game.topshiriq && game.topshiriq.cur ? '128px' : '';
    const ln = J.def.line(J), mt = J.meter ? J.meter(J) : null, k = Math.ceil(J.t != null ? J.t : -1) + '|' + ln + '|' + (mt ? mt.join() : '') + '|' + J.earn; if (hud._k === k) return; hud._k = k;
    hud.innerHTML = `<h3>${J.def.ic} ${J.def.name}${J.lvl ? ` <small style="opacity:.7">· ${REP_N[J.lvl]}</small>` : ''}</h3>${J.t != null ? `<div class="timer${J.t < 20 ? ' low' : ''}">${mmss(J.t)}</div>` : ''}<div class="ln">${ln}</div>${mt ? `<div class="dr-meter"><span>${mt[0]}</span><i><b class="${mt[1] < 0.35 ? 'bad' : mt[1] < 0.7 ? 'warn' : ''}" style="width:${Math.round(mt[1] * 100)}%"></b></i><span>${mt[2] || Math.round(mt[1] * 100) + '%'}</span></div>` : ''}<div class="ln" style="opacity:.7;font-size:12px"><kbd>X</kbd> — ishni tugatish · topildi ${som(J.earn)} so'm</div>`; };
  D.drawHud = drawHud;

  // ================= [E] =================
  const ex0 = L.extra;
  L.extra = (offer, px, pz, p) => { ex0(offer, px, pz, p); if (IN.inside || (game.hayot && game.hayot.dlg)) return; const J = D.cur;
    for (const id in D.givers) { const g = D.givers[id], d = Math.hypot(g.x - px, g.z - pz); if (d > 2.6) continue; const def = D.defs[id];
      if (J && J.id === id && def.giverE) { const r = def.giverE(J); if (r) { offer(d - 0.25, r[0], r[1]); continue; } }
      offer(d - 0.2, `<kbd>E</kbd> ${g.name}: «${def.name}» ${def.ic}`, () => { g.wave = 2; pl.yaw = Math.atan2(g.x - px, g.z - pz); if (def.open) def.open(); else ui.open('ish2', { id }); }); }
    for (const id of D.order) { const d = D.defs[id]; if (d.always) d.always(offer, px, pz); }
    if (J && J.def.extra) J.def.extra(J, offer, px, pz); };
  const carAct = () => { const J = D.cur; if (!J || pl.onFoot || !J.def.carE) return null; return J.def.carE(J); };
  const ue0 = L.useE; L.useE = () => { const a = carAct(); if (a && !(game.hayot && game.hayot.dlg)) return a[1](); ue0(); };

  // ================= KADR =================
  const up0 = L.update;
  L.update = (dt) => { up0(dt); const J = D.cur, foot = pl.onFoot, p = pos(), t = game.time;
    for (const id in D.givers) { const g = D.givers[id], d = Math.hypot(g.x - p[0], g.z - p[2]); g.rig.root.visible = d < 160; L.dots.push([g.x, g.z, '#ff9a3a', J ? 0 : 1]); if (d > 80) continue; if (g.wave > 0) g.wave -= dt;
      const nr = foot && d < 8; g.yaw += angDiff(nr ? Math.atan2(p[0] - g.x, p[2] - g.z) : g.yaw0, g.yaw) * Math.min(1, dt * 3); g.rig.root.rotation.y = g.yaw; poseRig(g.rig, g.wave > 0 || (nr && d < 3.5 && !J) ? 'wave' : 'idle', dt, 0); }
    for (const id of D.order) { const d = D.defs[id]; if (d.bg) d.bg(dt, foot); }
    if (J) { J.el += dt; if (J.t != null) { J.t -= dt; if (J.t <= 0) { J.t = 0; if (J.def.timeout) J.def.timeout(J); else D.finish(J.done > 0, `Vaqt tugadi! ${J.earn ? `Topilgani: ${som(J.earn)} so'm` : 'Keyingi safar tezroq!'}`); } }
      if (D.cur === J) { J.def.tick(J, dt, foot); for (const q of D._mk) L.dots.push([q.x, q.z, '#ffb24a']); if (!foot) { const a = carAct(); if (a) L.prompt = a[0]; } }
      for (let i = 0; i < marks.length; i++) if (marks[i].visible) beamMats[i].opacity = 0.3 + 0.1 * Math.sin(t * 4 + i); }
    if (popT > 0 && (popT -= dt) <= 0) pop.className = '';
    drawHud(); };

  // ================= MODULLAR =================
  initIshlar2(game, D); initIshlar3(game, D); initSavdo(game, D); initMoliya(game, D);

  // ================= OYNALAR, TAXTA, TELEFON =================
  const el = (t, c, h) => { const e = document.createElement(t); if (c) e.className = c; if (h != null) e.innerHTML = h; return e; };
  D.card = (id) => { const d = D.defs[id], s = stat(id), l = D.lvl(id), x = D.xp(id), nx = REP[l + 1], g = D.givers[id], on = D.cur && D.cur.id === id;
    const dist = g ? Math.round(D.dist(g)) : null, rep = d.cat === 'pul' ? '' : `<div class="dr-rep"><span>${REP_N[l]}</span><i><b style="width:${nx ? Math.round(((x - REP[l]) / (nx - REP[l])) * 100) : 100}%"></b></i><span>${nx ? `${x}/${nx}` : 'eng yuqori'}</span></div>`;
    return `<h4><span class="tag dr-${d.cat}">${CATS[d.cat][0]}</span>${d.ic} ${d.name}</h4><p>${d.desc}</p><div class="meta"><span>📍 ${d.where || D.placeName(d.place)}${dist != null ? ` · ${dist < 1000 ? dist + ' m' : (dist / 1000).toFixed(1) + ' km'}` : ''}</span><span>💰 ${d.pay}</span></div>${d.need ? `<div class="meta"><span>🔧 ${d.need}</span><span>${d.mins ? `~${d.mins} daq` : ''}</span></div>` : ''}${rep}<div class="meta"><span>${d.info ? d.info() : `Bajarilgan: ${s.n} · jami ${som(s.earn)} so'm`}</span><span>${on ? '⏱ hozir' : l ? `haq +${l * 8} %` : ''}</span></div>`; };
  UI.prototype.s_elonlar = function (w, d, btn, x) { x(); const tab = (d && d.tab) || this._drTab || 'all'; this._drTab = tab; const tabs = [['all', 'Hammasi'], ...Object.entries(CATS).map(([k, v]) => [k, v[0] + ' ' + v[1]])];
    const ids = D.order.filter((id) => tab === 'all' || D.defs[id].cat === tab), tot = sum(D.today());
    w.innerHTML = `<h1>💼 Ish e'lonlari <small>orol bo'ylab ${D.order.length + 3} xil daromad yo'li · bugun topildi ${som(tot)} so'm</small></h1><div class="pg-tabs">${tabs.map(([k, n]) => `<button class="${k === tab ? '' : 'sec'}" data-a="tab:${k}">${n}</button>`).join('')}<button class="sec" data-a="dr">📈 Daromad</button></div>
      <p class="sub">Ish beruvchi oldiga borib <kbd>E</kbd> bosing (xaritada to'q sariq katta nuqta). Har bajarilgan ish obro' beradi: daraja oshgani sari haq ko'payadi va yaxshiroq buyurtmalar ochiladi. Eski ishlar (non, taksi, dala) — telefon → Ishlar.</p>
      <div class="cards">${ids.map((id) => { const df = D.defs[id], g = D.givers[id], w2 = df.cat === 'pul' ? null : D.why(id), nearG = !g || D.dist(g) < 30; return `<div class="card">${D.card(id)}<div class="row" style="gap:6px;margin-top:6px">${g ? `<button class="sec" data-a="go:${id}">📍 Yo'l</button>` : ''}${df.open ? `<button data-a="op:${id}">Ochish</button>` : `<button data-a="st:${id}" ${w2 || !nearG ? 'disabled' : ''}>${w2 && D.cur && D.cur.id === id ? 'Bajarilmoqda' : nearG ? 'Boshlash' : 'Ish beruvchi uzoqda'}</button>`}</div></div>`; }).join('')}</div>`;
    this.on({ tab: (k) => this.open('elonlar', { tab: k }), dr: () => { this.close(); game.phone.open('daromad'); }, go: (id) => { const g = D.givers[id]; game.setWaypoint(g.x, g.z); this.close(); toast(`📍 ${g.name} — xaritada yo'l ko'rsatildi`); }, op: (id) => D.defs[id].open(), st: (id) => { this.close(); D.start(id); } }); };
  UI.prototype.s_ish2 = function (w, d, btn, x) { x(); const id = d && d.id, df = D.defs[id]; if (!df) return; const why = D.why(id), g = D.givers[id];
    w.innerHTML = `<h1>${df.ic} ${df.name} <small>${g ? g.name : ''}</small></h1><div class="card">${D.card(id)}</div>${df.rules ? `<div class="card" style="margin-top:8px"><h4>Qanday</h4><p>${df.rules()}</p></div>` : ''}<div class="row" style="margin-top:12px;gap:8px"><button data-a="start" ${why ? 'disabled' : ''}>${why || 'Ishni boshlash'}</button><button class="sec" data-a="all">Barcha e'lonlar</button><button class="sec" data-a="no">Keyinroq</button></div>`;
    this.on({ start: () => { this.close(); D.start(id); }, all: () => this.open('elonlar'), no: () => this.close() }); };
  D.open = (tab) => { if (game.mode === 'play' || game.mode === 'ui') ui.open('elonlar', tab ? { tab } : undefined); };
  // e'lonlar taxtasi: shu manzildagi ishlar
  const sb = ui.s_board;
  ui.s_board = function (w, pid, btn, x) { sb.call(this, w, pid, btn, x); const cards = w.querySelector('.cards'); if (!cards) return; const here = D.order.filter((id) => D.defs[id].place === pid || (D.defs[id].boards && D.defs[id].boards.includes(pid)));
    for (const id of here) { const df = D.defs[id], c = el('div', 'card', D.card(id)), b = el('button', '', df.open ? 'Ochish' : 'Boshlash'); b.onclick = () => { sfx('click'); if (df.open) return df.boardOpen ? df.boardOpen(pid) : df.open(); this.close(); D.start(id, true); }; c.appendChild(b); cards.appendChild(c); }
    const r = el('div', 'row'); r.style.marginTop = '8px'; r.appendChild(btn("💼 Barcha ish e'lonlari", () => this.open('elonlar'), 'sec')); w.appendChild(r); };
  const sp = ui.s_pause;
  ui.s_pause = function (w, d, btn, x) { sp.call(this, w, d, btn, x); const col = w.querySelector('div'); if (col) col.insertBefore(btn("💼 Ish e'lonlari va daromad", () => this.open('elonlar'), 'sec'), col.children[3] || null); };
  const sh = ui.s_help;
  ui.s_help = function (w, d, btn, x) { sh.call(this, w, d, btn, x); const p = el('p', 'sub', "💼 Ish e'lonlari — telefon (<kbd>4</kbd>), pauza menyusi yoki e'lonlar taxtasi: yuk, avtobus, kuryer, evakuator, tez yordam, o't o'chirish, qor, sayyohlar, yo'l ta'miri, qo'y, asal, hunarmandchilik, quruvchi, fotograf, savdo, ijara, omonat, kooperativ. <kbd>X</kbd> — ishni tugatish"); const b = w.querySelector(':scope > button'); w.insertBefore(p, b); };
  // telefon: «Ish e'lonlari» va «Daromad»
  const PH = game.phone;
  if (PH && PH.apps) {
    PH.apps.push(['elon', '📋', "E'lonlar", '#c87a2a'], ['daromad', '📈', 'Daromad', '#2fa86a']);
    PH.ext.elon = (head) => head("📋 Ish e'lonlari") + `<div class="ph-list">${D.order.map((id) => { const d = D.defs[id], g = D.givers[id], on = D.cur && D.cur.id === id; return `<div data-a="drgo:${id}"><span>${d.ic} ${d.name}<small>${on ? 'Hozir bajarilmoqda' : `${d.pay} · ${REP_N[D.lvl(id)]}`}</small></span><b>${on ? '⏱' : g ? (D.dist(g) < 1000 ? Math.round(D.dist(g)) + ' m' : (D.dist(g) / 1000).toFixed(1) + ' km') : '›'}</b></div>`; }).join('')}</div><button data-a="drall" style="margin:10px 14px">Barcha e'lonlar</button>${D.cur ? '<button class="bad" data-a="drquit" style="margin:0 14px 10px">Ishni tugatish</button>' : ''}`;
    PH.ext.daromad = (head) => { const td = D.today(), wk = D.week(), rows = Object.entries(wk).sort((a, b) => b[1] - a[1]), mx = rows.length ? rows[0][1] : 1, icOf = (s) => { const d = D.order.map((id) => D.defs[id]).find((q) => q.name === s); return d ? d.ic : /^Yangi manzil/.test(s) ? '📍' : '💵'; };
      return head('📈 Daromad') + `<div class="ph-card"><small>Bugun (${st.dunyo.day}-kun)</small><b>+${som(sum(td))} so'm</b><small>Xarajat: −${som(D.spent(1))} · 7 kunda: +${som(sum(wk))} so'm</small></div>
        <div class="ph-list dr-src">${rows.slice(0, 14).map(([k, v]) => `<div><span>${icOf(k)} ${k}<small><i class="dr-bar" style="width:${Math.max(4, Math.round((v / mx) * 100))}%"></i>bugun ${som(td[k] || 0)}</small></span><b class="pos">+${som(v)}</b></div>`).join('') || '<p class="ph-empty">Bu hafta hali daromad yo\'q</p>'}</div>
        ${D.order.some((id) => D.defs[id].cat !== 'pul' && D.xp(id) > 0) ? `<small style="display:block;margin:10px 16px 0;opacity:.7">Obro' darajasi · haqqa ustama</small>` : ''}<div class="ph-list">${D.order.filter((id) => D.defs[id].cat !== 'pul' && D.xp(id) > 0).map((id) => `<div><span>${D.defs[id].ic} ${D.defs[id].name}<small>${REP_N[D.lvl(id)]} · ${stat(id).n} marta</small></span><b>+${D.lvl(id) * 8}%</b></div>`).join('')}</div><button data-a="drall" style="margin:10px 14px">💼 Ish e'lonlari</button>`; };
    PH.acts.drgo = (id) => { const g = D.givers[id]; if (D.defs[id].open && !g) return D.defs[id].open(); if (!g) return; game.setWaypoint(g.x, g.z); ui.close(); toast(`📍 ${g.name} — xaritada yo'l ko'rsatildi`); };
    PH.acts.drall = () => ui.open('elonlar'); PH.acts.drquit = () => { ui.close(); D.quit(); };
  }
  // telefon «Bugungi reja»
  D.planRows = () => { const J = D.cur; if (!J) return []; const m = D._mk[0]; return [{ id: 'dr', ic: J.def.ic, t: `Ish: ${J.def.name}`, s: J.def.line(J).replace(/<[^>]+>/g, ''), ok: true, go: m ? [m.x, m.z] : null }]; };
  if (game.kun) { const ep = game.kun.extraPlan; game.kun.extraPlan = () => [...(ep ? ep() : []), ...D.planRows()]; }

  const css = el('style'); css.textContent = `
#dr-pop{left:50%;bottom:24%;transform:translate(-50%,0);text-align:center;opacity:0;pointer-events:none;white-space:nowrap}
#dr-pop b{display:block;font-size:30px;font-weight:900;color:#7dffa0;text-shadow:0 2px 10px rgba(0,0,0,.75),0 0 2px #000}#dr-pop small{display:block;font-size:14px;font-weight:700;color:#fff;text-shadow:0 1px 6px rgba(0,0,0,.8)}
#dr-pop.on{animation:drpop 2.2s ease-out forwards}@keyframes drpop{0%{opacity:0;transform:translate(-50%,16px) scale(.8)}12%{opacity:1;transform:translate(-50%,0) scale(1.08)}22%{transform:translate(-50%,0) scale(1)}75%{opacity:1}100%{opacity:0;transform:translate(-50%,-30px)}}
.dr-meter{display:flex;align-items:center;gap:8px;font-size:12.5px;margin:3px 0}.dr-meter i{flex:1;height:7px;border-radius:9px;background:rgba(255,255,255,.12);overflow:hidden}.dr-meter b{display:block;height:100%;background:var(--good,#5fd38a)}.dr-meter b.warn{background:#ffc83a}.dr-meter b.bad{background:#ff5a4a}
.dr-rep{display:flex;align-items:center;gap:8px;font-size:12px;color:var(--mut);margin:4px 0}.dr-rep i{flex:1;height:6px;border-radius:9px;background:rgba(255,255,255,.1);overflow:hidden}.dr-rep b{display:block;height:100%;background:var(--ac,#ffc83a)}
.tag.dr-veh{background:#2f6fd0}.tag.dr-foot{background:#3f9a58}.tag.dr-pul{background:#b8862a}
.dr-src small{position:relative}.dr-bar{display:block;height:4px;border-radius:4px;background:#2fa86a;margin:3px 0 2px}
.dr-mg{display:flex;flex-direction:column;align-items:center;gap:10px}.dr-mg .bar{position:relative;width:min(420px,80vw);height:28px;border-radius:14px;background:rgba(255,255,255,.1);overflow:hidden}.dr-mg .zone{position:absolute;top:0;bottom:0;background:rgba(95,211,138,.55)}.dr-mg .ndl{position:absolute;top:-2px;bottom:-2px;width:5px;margin-left:-2px;background:#fff;border-radius:3px;box-shadow:0 0 6px #fff}
.dr-mg .pal{display:flex;gap:10px}.dr-mg .pal button{width:64px;height:64px;border-radius:14px;border:3px solid rgba(255,255,255,.25)}.dr-mg .pal button.lit{border-color:#fff;box-shadow:0 0 18px #fff}.dr-mg .seq{display:flex;gap:6px;min-height:26px}.dr-mg .seq i{width:22px;height:22px;border-radius:6px;display:block}
.dr-tbl{width:100%;border-collapse:collapse;font-size:13.5px}.dr-tbl td,.dr-tbl th{padding:5px 7px;text-align:left;border-bottom:1px solid rgba(255,255,255,.08)}.dr-tbl th{color:var(--mut)}.dr-tbl .up{color:#7dffa0}.dr-tbl .dn{color:#ff8a7a}.dr-tbl button{min-height:32px;padding:4px 10px}
@media(max-width:820px){#dr-pop b{font-size:24px}}`;
  document.head.appendChild(css);
  return D;
}
