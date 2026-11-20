// Poyga markazi: ♾ cheksiz poyga (darvozalar yo'l tarmog'ida oldinda o'zi paydo bo'ladi, har biri vaqt qo'shadi), 5 ta aylanma poyga (bir necha aylana, raqiblar), «Yo'l egasi» — har yo'l bo'lagida vaqt rekordi, «Poygalar» oynasi [1]
import * as THREE from 'three';
import * as T from './terrain.js';
import { UI } from './ui.js';
import { fmtTime, fmtDist } from './game.js';
import { estimateTime, pathLen } from './acts.js';
import { vehById } from './vehicles.js';
import { ACTIONS } from './controls.js';

const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const som = (n) => Math.round(n).toLocaleString('ru-RU');
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
// yo'l tugunlarining nomlari (chorrahalar va manzillar)
export const NODE_N = { vil: "Bog'iston", mj: 'Mayoq chorrahasi', mayoq: 'Mayoq burni', brj: "Ko'prik chorrahasi", ormon: "Oltin o'rmon", karj: 'Karyer chorrahasi', karyer: 'Tosh karyeri', kol: "Ko'zgu ko'l", lager: 'Qorli lager', west: "G'arbiy chorraha",
  karvon: 'Karvonsaroy', dara: 'Qizil dara', sw: 'Bandargoh chorrahasi', bandargoh: 'Bandargoh', qala: "Ko'hna qal'a", aero: 'Eski aerodrom', vj: 'Vulqon chorrahasi', choqqi: "Cho'qqi", burgut: 'Burgut qoyasi', teg: 'Tegirmonlar', vulqon: "Olovtog' krateri" };
// aylanma poygalar: [id, nom, taxta, tugunlar halqasi, aylanalar, mukofot, ta'rif]
export const CIRCS = [
  ['h1', 'Sohil halqasi', 'bogiston', ['vil', 'mj', 'bandargoh', 'sw', 'vil'], 2, 1200, "Bog'istondan sohil yo'li bilan Bandargohga va qaytib — 2 aylana."],
  ['h2', 'Savanna halqasi', 'aerodrom', ['aero', 'west', 'karvon', 'dara', 'aero'], 3, 1500, "Aerodrom, cho'l va qizil dara orasida 3 aylana."],
  ['h3', "Qal'a halqasi", 'qala', ['qala', 'aero', 'dara', 'sw', 'vil', 'qala'], 2, 1300, "Ko'hna qal'adan dara va Bog'iston orqali — 2 aylana."],
  ['h4', "G'arbiy halqa", 'bogiston', ['vil', 'qala', 'aero', 'west', 'karvon', 'dara', 'sw', 'vil'], 2, 1800, "Orolning butun g'arbi bo'ylab 8 km halqa — 2 aylana."],
  ['h5', 'Shimoliy halqa', 'kol', ['kol', 'lager', 'west', 'karvon', 'vj', 'kol'], 2, 2000, "Qorli dovon, cho'l va tayga orqali 9 km — chidamlilar uchun, 2 aylana."],
];
export const INF_THR = [8, 16, 28]; // cheksiz poyga: 1/2/3 yulduz uchun darvozalar
const NODE_R = 24, GATE_R = 14;

export function initPoyga(game) {
  const st = game.state, ui = game.ui, car = game.car, R = T.roads, K = game.tryuk;
  const D = () => ({ inf: {}, circ: {}, seg: {}, runs: 0 });
  if (!st.poyga || typeof st.poyga !== 'object') st.poyga = D();
  { const d = D(), s = st.poyga; for (const k in d) if (s[k] == null || typeof s[k] !== typeof d[k]) s[k] = d[k]; }
  const S = st.poyga, toast = game.toast, sfx = (n) => game.audio.sfx(n);
  const P = (game.poyga = { CIRCS, NODE_N, INF_THR, tabs: [] });
  const vf = (id) => (K && K.vehFactor ? K.vehFactor(id) : 1);
  const vname = (id) => (vehById[id] || vehById.jip).name;
  const free = () => game.mode === 'play' && !game.player.onFoot && !(game.suv && game.suv.cur) && !(game.coop && game.coop.ride) && !(game.interior && game.interior.inside);

  // ================= HUD: bo'lak sanog'i / natijasi, darvoza yozuvi =================
  const chip = el('div'); chip.id = 'pg-seg'; ui.hud.appendChild(chip);
  const pop = el('div'); pop.id = 'pg-pop'; ui.hud.appendChild(pop);
  let chipT = 0, popT = 0;
  const popup = (html, kind = '') => { pop.className = ''; void pop.offsetWidth; pop.className = 'on ' + kind; pop.innerHTML = html; popT = 1.6; P.lastPopup = html; };

  // ================= 1. YO'L EGASI: har yo'l bo'lagida vaqt rekordi =================
  const nodeKey = (i) => R.nodes[i].key;
  const segKey = (e, from) => e.key + (from === e.a ? '>' : '<');
  const segs = []; // [{ key, e, from, to, name }]
  for (const e of R.edges) for (const from of [e.a, e.b]) { const to = from === e.a ? e.b : e.a; segs.push({ key: segKey(e, from), e, from, to, name: `${NODE_N[nodeKey(from)] || nodeKey(from)} → ${NODE_N[nodeKey(to)] || nodeKey(to)}` }); }
  const segBy = Object.fromEntries(segs.map((s) => [s.key, s]));
  // me'yor vaqt: transport toifasiga moslanadi (tryuk.js vehFactor)
  const parBase = (s) => { if (s.par == null) { const pts = T.pathByEdges([[s.e.key, s.from !== s.e.a]]), tr = s.e.type === 1; s.len = s.e.len; s.par = +(estimateTime(pts, tr ? 25 : 33, tr ? 6 : 7.5) * 1.1).toFixed(1); } return s.par; };
  P.segs = segs; P.segBy = segBy; P.par = (key, veh = st.veh.cur) => +(parBase(segBy[key]) * vf(veh)).toFixed(1);
  P.owned = () => segs.filter((s) => S.seg[s.key] && S.seg[s.key][2]).length;
  const SG = (P.seg = { cur: null, node: -1, nodeT: -99, now: 0, last: null, chk: 0, off: 0 });
  const segCancel = (why) => { if (SG.cur) { SG.last = { cancel: why, key: SG.cur.s.key }; SG.cur = null; } };
  const segFinish = () => {
    const c = SG.cur, s = c.s, t = +c.t.toFixed(2), id = st.veh.cur; SG.cur = null;
    if (c.prog < 0.8) { SG.last = { cancel: 'qisqa', key: s.key }; return null; }
    const old = S.seg[s.key], par = P.par(s.key, id), rec = !old || t < old[0], own = t <= par, newOwn = own && !(old && old[2]);
    S.seg[s.key] = [rec ? t : old[0], rec ? id : old[1], (old && old[2]) || own ? 1 : 0];
    if (newOwn) { game.addMoney(100, "Yo'l egasi"); st.xp += 15; }
    const best = S.seg[s.key][0];
    chip.innerHTML = `<b>Bo'lak:</b> ${s.name} — <b>${fmtTime(t)}</b> <small>${rec && old ? '· yangi rekord!' : old ? `(rekord ${fmtTime(best)})` : `(me'yor ${fmtTime(par)})`}</small>${newOwn ? `<div class="pg-own">🏁 Bu yo'l endi sizniki! +100 so'm</div>` : ''}`;
    chip.className = 'on done' + (rec ? ' rec' : ''); chipT = 5;
    sfx(newOwn || (rec && old) ? 'medal' : 'check');
    SG.last = { key: s.key, t, rec, own, newOwn, best, par }; game.save();
    return SG.last;
  };
  const segTick = (dt) => {
    if (!free() || game.act) { segCancel('chellenj'); SG.node = -1; SG.lp = null; return; }
    const p = car.p; SG.now += dt;
    if (SG.lp && Math.hypot(p[0] - SG.lp[0], p[2] - SG.lp[1]) > 45) { segCancel('sakrash'); SG.node = -1; } // ko'chirildi (teleport, evakuator, yo'lga qaytish)
    SG.lp = [p[0], p[2]];
    if (SG.cur) SG.cur.t += dt;
    if ((SG.chk -= dt) > 0) return; SG.chk = 0.1;
    let inNode = -1; for (const n of R.nodes) if (Math.abs(n.x - p[0]) < NODE_R && Math.abs(n.z - p[2]) < NODE_R && Math.hypot(n.x - p[0], n.z - p[2]) < NODE_R) { inNode = n.id; break; }
    if (inNode >= 0) {
      if (SG.cur) { if (inNode === SG.cur.to) segFinish(); else if (inNode !== SG.cur.from || SG.cur.t > 4) segCancel('qaytish'); }
      SG.node = inNode; SG.nodeT = SG.now; return;
    }
    const nr = T.nearestRoad(p[0], p[2], 2), on = nr.edge >= 0 && nr.d < nr.hw + 12;
    if (SG.cur) {
      const c = SG.cur, e = c.s.e;
      if (on && nr.edge === e.id) { c.off = 0; const k = R.idx[nr.i], f = k / (e.count - 1), pr = c.from === e.a ? f : 1 - f; if (pr > c.prog) c.prog = pr; }
      else if ((c.off += 0.1) > 4) segCancel("yo'ldan chiqdi");
    } else if (on && SG.node >= 0 && SG.now - SG.nodeT < 5) {
      const e = R.edges[nr.edge];
      if (e.a === SG.node || e.b === SG.node) { const s = segBy[segKey(e, SG.node)]; SG.cur = { s, from: SG.node, to: s.to, t: SG.now - SG.nodeT, prog: 0, off: 0 }; SG.node = -1; }
    }
  };
  const segHud = (dt) => {
    if (chipT > 0) { if ((chipT -= dt) <= 0) chip.className = ''; return; }
    const c = SG.cur; if (c && c.t > 2) { const o = S.seg[c.s.key]; const h = `⏱ ${c.s.name} · <b>${fmtTime(c.t)}</b> <small>${o ? `rekord ${fmtTime(o[0])}` : `me'yor ${fmtTime(P.par(c.s.key))}`}</small>`; if (chip.innerHTML !== h) chip.innerHTML = h; if (chip.className !== 'on') chip.className = 'on'; }
    else if (chip.className) chip.className = '';
  };

  // ================= 2. CHEKSIZ POYGA =================
  const mkGate = (hex, op) => { const g = new THREE.Group(); const m = new THREE.Mesh(new THREE.TorusGeometry(7, 0.5, 8, 28), new THREE.MeshBasicMaterial({ color: hex, transparent: true, opacity: op, fog: false })); m.position.y = 6; g.add(m); const b = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 60, 6, 1, true), new THREE.MeshBasicMaterial({ color: hex, transparent: true, opacity: op * 0.35, fog: false, depthWrite: false })); b.position.y = 30; g.add(b); g.visible = false; game.scene.add(g); return g; };
  const G2 = [mkGate(0xff5ad0, 0.92), mkGate(0xc8a0ff, 0.35)];
  const placeGate = (g, q) => { g.position.set(q.x, T.ground(q.x, q.z, 1e9).y, q.z); g.rotation.y = Math.atan2(q.tx, q.tz); g.visible = true; };
  // yo'l bo'ylab yuruvchi: chorrahada keyingi bo'lak tasodifan tanlanadi (berk ko'chada — ortga)
  const walk = (w, dist) => {
    let { e, k, dir } = w; e = R.edges[e]; let acc = 0; const pts = [[R.x[e.start + k], R.z[e.start + k], R.y[e.start + k]]];
    for (let guard = 0; guard < 4000 && acc < dist; guard++) {
      const k2 = k + dir;
      if (k2 < 0 || k2 >= e.count) {
        const node = R.nodes[dir > 0 ? e.b : e.a], opts = node.edges.filter((q) => q !== e.id), pool = [];
        for (const q of opts) { const qe = R.edges[q]; for (let n = qe.type === 0 ? 3 : 1; n > 0; n--) pool.push(q); }
        const ne = pool.length ? R.edges[pool[(Math.random() * pool.length) | 0]] : e;
        if (ne === e) { dir = -dir; continue; }
        e = ne; if (ne.a === node.id) { k = 0; dir = 1; } else { k = ne.count - 1; dir = -1; } continue;
      }
      const i0 = e.start + k, i1 = e.start + k2; acc += Math.hypot(R.x[i1] - R.x[i0], R.z[i1] - R.z[i0]); k = k2; pts.push([R.x[i1], R.z[i1], R.y[i1]]);
    }
    const i = e.start + k; return { e: e.id, k, dir, x: R.x[i], z: R.z[i], tx: R.tx[i] * dir, tz: R.tz[i] * dir, pts, len: acc };
  };
  const gap = () => 300 + Math.random() * 170;
  const infDef = (P.infDef = { id: 'cheksiz', cat: 'cheksiz', type: 'cheksiz', name: '♾ Cheksiz poyga', desc: "Darvozalar yo'lda oldinda o'zi paydo bo'ladi — har biri vaqt qo'shadi. Vaqt tugaguncha imkon qadar uzoqqa boring!", reward: 0, route: {}, opt: {}, own: () => 0, start: null });
  P.infBest = (id = st.veh.cur) => S.inf[id] || null;
  P.canInf = () => { if (!free()) return "Avval transportga o'tiring"; if (game.act) return 'Avval joriy chellenjni tugating'; const nr = T.nearestRoad(car.p[0], car.p[2], 4); return nr.edge >= 0 && nr.d < 40 ? null : "Avval yo'lga chiqing (40 m ichida)"; };
  P.startInf = () => {
    const why = P.canInf(); if (why) { toast(why, 'bad'); return false; }
    const p = car.p, nr = T.nearestRoad(p[0], p[2], 4), i = nr.i, fx = Math.sin(car.yaw), fz = Math.cos(car.yaw), dir = fx * R.tx[i] + fz * R.tz[i] >= 0 ? 1 : -1;
    infDef.start = { e: R.edge[i], k: R.idx[i], dir };
    if (ui.screenName) ui.close();
    game.startAct(infDef); return !!game.act;
  };
  const infInit = (A) => {
    const s = infDef.start, i = R.edges[s.e].start + s.k;
    car.place(R.x[i], R.z[i], Math.atan2(R.tx[i] * s.dir, R.tz[i] * s.dir)); game.prevP = car.p.slice(); game.cam.snap();
    Object.assign(A, { state: 'count', count3: 3.2, limit: 32, gates: 0, dist: 0, vmax: Math.min(30, car.vTop * 0.82) });
    A.g0 = walk(s, 260); A.g1 = walk(A.g0, gap()); placeGate(G2[0], A.g0); placeGate(G2[1], A.g1); game.setWaypoint(A.g0.x, A.g0.z, true);
    S.runs++; sfx('start');
  };
  // darvozadan o'tganda qo'shiladigan vaqt: yo'l uzunligi va burilishlarga qarab, darvoza ko'paygan sari biroz kamayadi
  const refill = (A, seg) => +clamp(estimateTime(seg.pts, A.vmax, 6.5) * Math.max(0.98, 1.42 - A.gates * 0.016) + 2, 6, 45).toFixed(1);
  P.refill = refill;
  const infTick = (A) => {
    if (A.state !== 'run') return;
    const p = car.p, g = A.g0;
    if (Math.hypot(p[0] - g.x, p[2] - g.z) < GATE_R) {
      A.gates++; A.dist += g.len; const add = refill(A, A.g1), left = A.limit - A.t;
      A.limit += add; if (A.limit - A.t > 75) A.limit = A.t + 75;
      A.g0 = A.g1; A.g1 = walk(A.g0, gap()); placeGate(G2[0], A.g0); placeGate(G2[1], A.g1); game.setWaypoint(A.g0.x, A.g0.z, true);
      popup(`<b>${A.gates}</b> · +${add.toFixed(0)} s`, INF_THR.includes(A.gates) ? 'gold' : ''); sfx(INF_THR.includes(A.gates) ? 'medal' : 'check');
      P.lastGate = { n: A.gates, add, left };
    }
    A.tgt = { x: A.g0.x, z: A.g0.z };
    const b = S.inf[st.veh.cur];
    A.lines = [`Darvozalar: <b>${A.gates}</b> · ${fmtDist(A.dist)}`, `Keyingisigacha: ${fmtDist(game.gpsDist != null ? game.gpsDist : Math.hypot(p[0] - A.g0.x, p[2] - A.g0.z))}`, b ? `Rekord (${vname(st.veh.cur)}): ${b[0]} ta · ${fmtDist(b[1])}` : ''];
  };

  // ================= 3. AYLANMA POYGALAR =================
  const nb = R.nodeBy;
  const loopEdges = (nodes) => { const out = []; for (let i = 0; i < nodes.length - 1; i++) { const a = nb[nodes[i]].id, b = nb[nodes[i + 1]].id, e = R.edges.find((q) => (q.a === a && q.b === b) || (q.a === b && q.b === a)); if (!e) throw new Error('halqa: ' + nodes[i] + '-' + nodes[i + 1]); out.push([e.key, e.a !== a]); } return out; };
  const circDefs = CIRCS.map(([id, name, board, nodes, laps, reward, desc]) => {
    const list = loopEdges(nodes), one = T.pathByEdges(list), pts = one.slice(), lapEnd = [one.length - 1];
    for (let l = 1; l < laps; l++) { for (let i = 1; i < one.length; i++) pts.push(one[i]); lapEnd.push(pts.length - 1); }
    let est = 0; for (const [k, rv] of list) { const e = R.edges.find((q) => q.key === k), tr = e.type === 1; est += estimateTime(T.pathByEdges([[k, rv]]), tr ? 25 : 33, tr ? 6 : 7.5); }
    est *= laps;
    const a = { id, cat: 'circ', type: 'race', name: '⟳ ' + name, desc, board, reward, laps, nodes, route: {}, opt: {}, lapLen: pathLen(one), lapEnd };
    a._p = pts; a._len = pathLen(pts); a._t = [est * 1.38, est * 1.17, est * 1.03];
    a.own = () => (S.circ[id] && S.circ[id].s) || 0;
    a.lines2 = (A) => { const done = A.lapCp ? A.lapCp.filter((k) => A.cpi > k).length : 0, o = S.circ[id]; return [`Aylana: <b>${Math.min(laps, done + 1)}/${laps}</b> · ${fmtTime(A.t - (A.lapStart || 0))}`, o && o.lap ? `Eng tez aylana: ${fmtTime(o.lap)}` : '']; };
    return a;
  });
  P.circs = circDefs; P.circBy = Object.fromEntries(circDefs.map((a) => [a.id, a]));
  P.startCirc = (id) => { const a = P.circBy[id]; if (!a) return false; if (!free()) { toast("Avval transportga o'tiring", 'bad'); return false; } if (ui.screenName) ui.close(); game.startAct(a); return !!game.act; };
  const circInit = (A) => {
    const a = A.def, set = new Set(A.cps.filter((i) => !a.lapEnd.some((L) => i > L - 30 && i < L)));
    for (const L of a.lapEnd) set.add(L);
    A.cps = [...set].sort((p, q) => p - q); A.lapCp = a.lapEnd.map((L) => A.cps.indexOf(L)); A.lapStart = 0; A.lapTimes = [];
  };
  const circTick = (A) => {
    if (!A.lapCp) return; const a = A.def;
    while (A.lapTimes.length < a.laps - 1 && A.cpi > A.lapCp[A.lapTimes.length]) {
      const lt = A.t - A.lapStart; A.lapStart = A.t; A.lapTimes.push(lt); const o = S.circ[a.id], fast = !o || !o.lap || lt < o.lap;
      popup(`${A.lapTimes.length}-aylana: <b>${fmtTime(lt)}</b>${fast && o && o.lap ? ' · eng tezi!' : ''}<small>${a.laps - A.lapTimes.length === 1 ? 'Oxirgi aylana!' : `Yana ${a.laps - A.lapTimes.length} aylana`}</small>`, fast ? 'gold' : '');
    }
  };

  // ================= chellenj tizimiga ulanish (game.startAct / endAct) =================
  const sa = game.startAct;
  game.startAct = (a) => {
    if (a && a.cat === 'circ' && !a._p) return; // bo'lmasligi kerak
    const r = sa(a); const A = game.act;
    if (A && A.def === a) { if (a.cat === 'cheksiz') infInit(A); else if (a.cat === 'circ') circInit(A); }
    return r;
  };
  const ea = game.endAct;
  game.endAct = (ok, why, stars = 0, info = '', ...rest) => {
    const A = game.act;
    if (!A || why === 'cancel' || (A.def.cat !== 'cheksiz' && A.def.cat !== 'circ')) { G2[0].visible = G2[1].visible = false; return ea(ok, why, stars, info, ...rest); }
    const a = A.def, id = st.veh.cur;
    if (a.cat === 'cheksiz') {
      G2[0].visible = G2[1].visible = false;
      const n = A.gates, s = n >= INF_THR[2] ? 3 : n >= INF_THR[1] ? 2 : n >= INF_THR[0] ? 1 : 0, old = S.inf[id], rec = !old || n > old[0] || (n === old[0] && A.dist > old[1]);
      if (rec) S.inf[id] = [n, Math.round(A.dist)];
      a.reward = Math.min(1500, 150 + n * 30);
      P.lastInf = { gates: n, dist: Math.round(A.dist), stars: s, rec: rec && !!old, veh: id };
      return ea(s > 0, s > 0 ? 'done' : 'low', s, `Darvozalar: ${n} · ${fmtDist(A.dist)}${rec && old ? ' · Yangi rekord!' : ''}`, ...rest);
    }
    // aylanma: marraga yetdi — oxirgi aylana vaqti, rekordlar
    const fin = A.cps && A.cpi >= A.cps.length, o = S.circ[a.id] || (S.circ[a.id] = { s: 0, best: 0, lap: 0, n: 0 });
    if (fin) { A.lapTimes.push(A.t - A.lapStart); const fl = Math.min(...A.lapTimes); o.n++; if (!o.best || A.t < o.best) o.best = +A.t.toFixed(2); if (!o.lap || fl < o.lap) o.lap = +fl.toFixed(2); info += ` · eng tez aylana ${fmtTime(fl)}`; }
    delete st.best[a.id]; // umumiy reytingga yuborilmaydi
    P.lastCirc = { id: a.id, fin, laps: A.lapTimes.slice(), stars };
    const r = ea(ok, why, stars, info, ...rest);
    if (ok && stars > o.s) o.s = stars; game.save();
    return r;
  };

  // ================= kadr =================
  game.hooks.push((dt) => {
    segTick(dt); segHud(dt);
    if (popT > 0 && (popT -= dt) <= 0) pop.className = '';
    const A = game.act; if (!A) { if (G2[0].visible) G2[0].visible = G2[1].visible = false; return; }
    if (A.def.cat === 'cheksiz') infTick(A); else if (A.def.cat === 'circ') circTick(A);
  });
  // yulduz chegaralari shkalasi (qulay.js) — cheksiz poygada darvozalar bo'yicha
  if (game.qulay && game.qulay.stars) {
    const qs = game.qulay.stars;
    game.qulay.stars = (A) => {
      if (!A || !A.def || A.def.cat !== 'cheksiz') return qs(A);
      if (A.state === 'count') return null;
      const n = A.gates, th = INF_THR, mx = th[2] * 1.1, v = Math.min(1, n / mx), now = n >= th[2] ? 3 : n >= th[1] ? 2 : n >= th[0] ? 1 : 0, cls = now >= 2 ? '' : now ? 'warn' : 'bad';
      const text = now >= 3 ? 'Oltin olindi! Rekord uchun davom eting' : `${now + 1} yulduz uchun yana <b>${th[now] - n} ta darvoza</b>`;
      return { v, now, cls, text, marks: th.map((x, i) => [x / mx, i + 1, false]), html: `<div class="q-meter"><div class="q-mb"><i class="${cls}" style="width:${(v * 100).toFixed(1)}%"></i>${th.map((x, i) => `<b style="left:${((x / mx) * 100).toFixed(1)}%">${i + 1}★</b>`).join('')}</div><div class="q-mt">Hozir: <span class="st">${'★'.repeat(now)}<i>${'★'.repeat(3 - now)}</i></span> · ${text}</div></div>` };
    };
  }

  // ================= oynalar, taxta, telefon, tugma =================
  P.open = (tab) => { if (game.mode === 'play' || game.mode === 'ui') ui.open('poyga', { tab }); };
  ACTIONS.splice(ACTIONS.findIndex((a) => a.key === 'N'), 0, { key: '1', codes: ['Digit1', 'Numpad1'], on: 'car', ok: (g) => !g.act, run: (g) => g.poyga.open() }); // transportda: «Poygalar» oynasi
  // e'lonlar taxtasida: shu yerdan boshlanadigan aylanmalar va cheksiz poyga
  const sb = ui.s_board;
  ui.s_board = function (w, pid, btn, x) {
    sb.call(this, w, pid, btn, x); const cards = w.querySelector('.cards'); if (!cards) return;
    const start = (fn) => { this.close(); fn(); };
    for (const a of circDefs.filter((q) => q.board === pid)) { const c = el('div', 'card', circCard(a)); const b = el('button', '', a.own() ? 'Qayta poyga' : 'Boshlash'); b.onclick = () => { sfx('click'); start(() => P.startCirc(a.id)); }; c.appendChild(b); cards.appendChild(c); }
    const c = el('div', 'card', infCard()); const b = el('button', '', 'Boshlash'); b.onclick = () => { sfx('click'); start(() => P.startInf()); }; c.appendChild(b); cards.appendChild(c);
  };
  const circCard = (a) => { const o = S.circ[a.id], s = a.own(); return `<h4><span class="tag race">Aylanma</span>${a.name.slice(2)}</h4><p>${a.desc}</p><div class="meta"><span>${a.laps} × ${fmtDist(a.lapLen)} · oltin ${fmtTime(a._t[2])}</span><span>${o && o.best ? 'Rekord ' + fmtTime(o.best) : ''}</span></div><div class="meta"><span>💰 ${som(a.reward)} so'm${K && K.cup && st.sovrin.cups[a.id] ? ` · 🏆×${st.sovrin.cups[a.id]}` : ''}</span><span class="stars">${'★'.repeat(s)}<i>${'★'.repeat(3 - s)}</i></span></div>`; };
  const infCard = () => { const b = S.inf[st.veh.cur]; return `<h4><span class="tag inf">♾</span>Cheksiz poyga</h4><p>Darvozalar yo'lda oldinda paydo bo'ladi, har biri vaqt qo'shadi. ★ ${INF_THR[0]} · ★★ ${INF_THR[1]} · ★★★ ${INF_THR[2]} darvoza.</p><div class="meta"><span>${vname(st.veh.cur)}: ${b ? `rekord ${b[0]} ta · ${fmtDist(b[1])}` : 'hali natija yo\'q'}</span><span>💰 150–1 500 so'm</span></div>`; };
  P.circCard = circCard; P.infCard = infCard;
  // pauza menyusi
  const sp = ui.s_pause;
  ui.s_pause = function (w, d, btn, x) { sp.call(this, w, d, btn, x); const col = w.querySelector('div'); if (col) col.insertBefore(btn(`🏁 Poygalar: cheksiz, aylanma, yo'l egasi  [1]`, () => this.open('poyga'), 'sec'), col.children[3] || null); };
  // boshqaruv oynasida
  const sh = ui.s_help;
  ui.s_help = function (w, d, btn, x) { sh.call(this, w, d, btn, x); const p = el('p', 'sub', "<kbd>1</kbd> (transportda) — Poygalar: cheksiz poyga, aylanma poygalar, yo'l egasi, Yulduz yo'li, transport mahorati"); const b = w.querySelector(':scope > button'); w.insertBefore(p, b); };
  // telefon ilovasi
  const PH = game.phone;
  if (PH && PH.apps) {
    PH.apps.push(['poyga', '🏁', 'Poygalar', '#c8395a']);
    PH.ext.poyga = (head) => head('🏁 Poygalar') + `<div class="ph-list">${[['inf', '♾ Cheksiz poyga', P.infBest() ? `rekord ${P.infBest()[0]} darvoza` : 'darvozalar ortidan'], ['circ', '⟳ Aylanma poygalar', `${circDefs.filter((a) => a.own()).length}/5 o'tilgan`], ['seg', "🛣 Yo'l egasi", `${P.owned()}/${segs.length} bo'lak sizniki`], ...P.tabs.filter((t) => t[3]).map((t) => [t[0], t[1], t[3]()])].map(([t, n, s]) => `<div data-a="pgopen:${t}"><span>${n}<small>${s}</small></span><b>›</b></div>`).join('')}</div>`;
    PH.acts.pgopen = (t) => ui.open('poyga', { tab: t });
  }

  const css = el('style'); css.textContent = `
#pg-seg{left:50%;top:12px;transform:translate(-50%,-8px);padding:7px 16px;border-radius:999px;background:rgba(12,16,28,.62);border:1px solid var(--bd);font-weight:700;font-size:14.5px;opacity:0;transition:opacity .3s,transform .3s;pointer-events:none;white-space:nowrap;text-align:center;backdrop-filter:blur(4px)}
#pg-seg.on{opacity:1;transform:translate(-50%,0)}#pg-seg b{color:var(--ac)}#pg-seg small{color:var(--mut);font-weight:600}
#pg-seg.done{font-size:16.5px;padding:9px 20px;border-color:rgba(255,255,255,.3)}#pg-seg.rec{border-color:var(--ac);box-shadow:0 0 18px rgba(255,200,58,.35)}#pg-seg.rec small{color:#ffe08a}
#pg-seg .pg-own{font-size:13px;color:var(--good);margin-top:2px}
#pg-pop{left:50%;top:27%;transform:translate(-50%,0) scale(.7);text-align:center;opacity:0;pointer-events:none;font-size:40px;font-weight:900;font-style:italic;color:#fff;text-shadow:0 3px 14px rgba(0,0,0,.7),0 0 2px #000;white-space:nowrap}
#pg-pop.on{animation:pgin 1.6s ease-out forwards}#pg-pop b{color:#ff8ae0}#pg-pop.gold b{color:#ffd23a}#pg-pop small{display:block;font-size:17px;font-style:normal;color:#fff2c4;margin-top:2px}
@keyframes pgin{0%{opacity:0;transform:translate(-50%,0) scale(.5)}14%{opacity:1;transform:translate(-50%,0) scale(1.1)}24%{transform:translate(-50%,0) scale(1)}78%{opacity:1}100%{opacity:0;transform:translate(-50%,-22px) scale(.96)}}
.tag.cheksiz,.tag.inf{background:#c8395a}
.pg-tabs{display:flex;flex-wrap:wrap;gap:6px;margin:2px 0 12px}.pg-tabs button{min-height:38px;padding:6px 12px}
.pg-tab table{width:100%;border-collapse:collapse;font-size:13.5px}.pg-tab td,.pg-tab th{padding:5px 8px;text-align:left;border-bottom:1px solid rgba(255,255,255,.08)}.pg-tab th{color:var(--mut);font-weight:700}.pg-tab tr.own td:first-child{color:var(--good)}
.pg-big{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:4px 0 12px}.pg-big div{padding:9px 10px;border-radius:12px;background:rgba(255,255,255,.06);border:1px solid var(--bd);text-align:center}.pg-big b{display:block;font-size:22px;color:var(--ac)}.pg-big small{color:var(--mut);font-size:12px}
@media(max-width:820px){.pg-big{grid-template-columns:1fr}#pg-pop{font-size:30px}#pg-seg{font-size:12.5px;white-space:normal;max-width:88vw}}`;
  document.head.appendChild(css);
  return P;
}

// ---------- «Poygalar» oynasi ----------
UI.prototype.s_poyga = function (w, d, btn, x) {
  const g = this.g, st = g.state, P = g.poyga, S = st.poyga; x();
  const TABS = [['inf', '♾ Cheksiz poyga'], ['circ', '⟳ Aylanma poygalar'], ['seg', "🛣 Yo'l egasi"], ...P.tabs.map((t) => [t[0], t[1]])];
  const tab = (d && d.tab) || this._pgTab || 'inf'; this._pgTab = tab;
  const vn = (vehById[st.veh.cur] || vehById.jip).name;
  let body = '';
  if (tab === 'inf') {
    const why = P.canInf(), rows = Object.keys(S.inf).sort((a, b) => S.inf[b][0] - S.inf[a][0]);
    body = `<p class="sub">Shu joydan boshlanadi: darvozalar yo'l tarmog'ida oldinda o'zi paydo bo'ladi (chorrahada yo'nalish har safar boshqacha), har darvoza vaqtni to'ldiradi. Vaqt tugaganda — natija. ★ ${INF_THR[0]} · ★★ ${INF_THR[1]} · ★★★ ${INF_THR[2]} darvoza; mukofot darvozalarga qarab 150–1 500 so'm. Har transportning o'z rekordi bor.</p>
      <div class="card">${P.infCard()}<button data-a="inf" ${why ? 'disabled' : ''}>${why || `▶ Boshlash — ${vn}`}</button></div>
      <h4 style="margin:14px 0 6px">Transport rekordlari</h4><div class="pg-tab">${rows.length ? `<table><tr><th>Transport</th><th>Darvozalar</th><th>Masofa</th></tr>${rows.map((id) => `<tr><td>${(vehById[id] || {}).name || id}</td><td>${S.inf[id][0]}</td><td>${fmtDist(S.inf[id][1])}</td></tr>`).join('')}</table>` : '<p class="sub">Hali natija yo\'q.</p>'}</div>`;
  } else if (tab === 'circ') {
    body = `<p class="sub">Yo'l tarmog'idagi yopiq halqalarda bir necha aylanali poyga: uch raqib, har aylana vaqti, eng tez aylana alohida yoziladi. 1-o'rin — g'olib kubogi (Sovrinlar). Boshlasangiz, start chizig'iga o'tasiz.</p>
      <div class="cards">${P.circs.map((a) => `<div class="card">${P.circCard(a)}<div class="meta"><span>${a.nodes.slice(0, -1).map((k) => P.NODE_N[k]).join(' → ')}</span><span>${S.circ[a.id] && S.circ[a.id].lap ? 'aylana ' + fmtTime(S.circ[a.id].lap) : ''}</span></div><button data-a="circ:${a.id}">${a.own() ? 'Qayta poyga' : 'Boshlash'}</button></div>`).join('')}</div>`;
  } else if (tab === 'seg') {
    const list = P.segs.slice().sort((a, b) => (S.seg[b.key] ? 1 : 0) - (S.seg[a.key] ? 1 : 0) || a.name.localeCompare(b.name));
    body = `<div class="pg-big"><div><b>${P.owned()}/${P.segs.length}</b><small>bo'lak sizniki</small></div><div><b>${Object.keys(S.seg).length}</b><small>bo'lakda vaqt bor</small></div><div><b>${R2(P)}</b><small>jami yo'l</small></div></div>
      <p class="sub">Erkin sayrda chorrahadan chiqishingiz bilan sanoq o'zi boshlanadi va keyingi chorrahada to'xtaydi. Me'yor vaqtdan tezroq o'tsangiz, yo'l «sizniki» bo'ladi (+100 so'm). Me'yor transport toifasiga moslanadi (${vn}: ×${(g.tryuk ? g.tryuk.vehFactor(st.veh.cur) : 1).toFixed(2)}).</p>
      <div class="pg-tab"><table><tr><th>Bo'lak</th><th>Uzunlik</th><th>Me'yor</th><th>Rekord</th></tr>${list.map((s) => { const r = S.seg[s.key]; return `<tr class="${r && r[2] ? 'own' : ''}"><td>${r && r[2] ? '🏁 ' : ''}${s.name}</td><td>${fmtDist(s.e.len)}</td><td>${fmtTime(P.par(s.key))}</td><td>${r ? `${fmtTime(r[0])} <small style="color:var(--mut)">${(vehById[r[1]] || {}).name || ''}</small>` : '—'}</td></tr>`; }).join('')}</table></div>`;
  } else { const t = P.tabs.find((q) => q[0] === tab); body = t ? t[2].call(this, w, btn) : ''; }
  w.innerHTML = `<h1>Poygalar <small>cheksiz poyga, aylanmalar, yo'l egasi va mahorat</small></h1><div class="pg-tabs">${TABS.map(([id, n]) => `<button class="${id === tab ? '' : 'sec'}" data-a="tab:${id}">${n}</button>`).join('')}</div>${body}`;
  const t = P.tabs.find((q) => q[0] === tab); const extra = t && t[4] ? t[4].call(this, w) : {};
  this.on({ tab: (id) => this.open('poyga', { tab: id }), inf: () => P.startInf(), circ: (id) => P.startCirc(id), ...extra });
};
const R2 = (P) => fmtDist(P.segs.reduce((s, q, i) => s + (i % 2 ? 0 : q.e.len), 0));
