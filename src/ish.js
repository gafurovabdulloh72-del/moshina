// Ishlar va telefon: non yetkazish (novvoyxona → uylar), taksi smenasi (qishloq ichida yo'lovchilar), dalada o'rim (bug'doy o'rib aravaga tashish); pul tarixi; telefon (xarita, bank, kontaktlar, kamera, ob-havo, ishlar)
import * as THREE from 'three';
import * as T from './terrain.js';
import * as COL from './colliders.js';
import { GB, MAT } from './geo.js';
import { makeRig, poseRig } from './rig.js';
import { clamp, angDiff } from './util.js';

const som = (n) => Math.round(n).toLocaleString('ru-RU');
const hm = (h) => { const a = Math.floor(h), m = Math.floor((h - a) * 60); return `${a < 10 ? '0' : ''}${a}:${m < 10 ? '0' : ''}${m}`; };
const mmss = (s) => { s = Math.max(0, Math.ceil(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
export const JOBS = { non: ['🍞', 'Non yetkazish', "Novvoy Karim aka issiq nonni 5 ta uyga yetkazishni so'raydi. Har bir uy — 30 so'm, tez bo'lsangiz qo'shimcha."], taksi: ['🚕', 'Taksi smenasi', "Dispetcher Lola opa: qishloq ichida 3 ta yo'lovchini manziliga eltib qo'ying. Kutib turganlarni oling."], dala: ['🌾', "Dalada o'rim", "Fermer Bobur aka: bug'doyni o'roq bilan o'rib, bog'larni aravaga tashing. 6 bog' — vaqt cheklangan."] };
const PASS = ['Dilfuza opa', 'Hasan bobo', 'Shoira', "Ulug'bek", 'Nodir', 'Gulchehra xola', 'Sanjar', 'Muxlisa'];
const TEMP = [24, 18, 11, 33, 30, -5, 27, 22, 31, 36]; // hudud bo'yicha kunduzgi harorat (°C)

export function initIsh(game) {
  const { scene, car } = game, st = game.state, pl = game.player, L = game.live, H2 = game.hayot2, IN = game.interior;
  const IS = { cur: null, pts: {} }; game.ish = IS;
  const toast = (m, k) => game.toast(m, k), sfx = (n, k) => game.audio.sfx(n, k), fx = () => game.fx;

  // ================= PUL TARIXI (telefon banki) =================
  const am0 = game.addMoney;
  game.addMoney = (n, why) => { am0(n); n = Math.round(n); if (!n) return; const lab = why || (n > 0 ? 'Daromad' : 'Xarid'), now = st.stats.time, last = st.income[0];
    if (last && last[1] === lab && now - last[3] < 30 && Math.sign(last[2]) === Math.sign(n)) { last[2] += n; last[3] = now; last[0] = hm(game.hour); }
    else { st.income.unshift([hm(game.hour), lab, n, now]); if (st.income.length > 30) st.income.length = 30; } };
  const pay = (n, why) => { game.addMoney(n, why); sfx('coin'); };

  // ================= JOYLAR: novvoyxona, taksi bekati, dala =================
  const P = game.site.places.bogiston.board, npcs = L._dbg.npcs;
  const findSpot = (cx, cz, r0, r1, rad, ok, seed = 0) => { for (let r = r0; r < r1; r += 2.5) for (let k = 0; k < 28; k++) { const a = k * 0.2244 + r * 0.71 + seed, x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r, si = T.siteInfo(x, z);
    if (si.y < si.water + 1 || !H2.freeAt(x, z, rad) || npcs.some((o) => Math.hypot(o.x - x, o.z - z) < rad + 2) || H2.bld.some((b) => Math.hypot(b.cx - x, b.cz - z) < rad + 6) || !ok(x, z, si)) continue; return [x, z, si]; } return null; };
  const roadYaw = (x, z) => { const nr = T.nearestRoad(x, z, 8); return nr.edge >= 0 ? Math.atan2(T.roads.x[nr.i] - x, T.roads.z[nr.i] - z) : 0; };
  const flat = (x, z, r, tol) => { let a = 1e9, b = -1e9; for (const [dx, dz] of [[-r, -r], [r, -r], [r, r], [-r, r], [0, 0]]) { const h = T.gridHeight(x + dx, z + dz); a = Math.min(a, h); b = Math.max(b, h); } return b - a < tol ? a : null; };
  const addMesh = (g) => { const m = new THREE.Mesh(g.build(), MAT.flat); m.castShadow = true; m.receiveShadow = true; scene.add(m); return m; };
  const mkNpc = (o, x, z, yaw) => { const r = makeRig(o); r.root.position.set(x, T.gridHeight(x, z), z); r.root.rotation.y = yaw; scene.add(r.root); return { rig: r, x, z, yaw, yaw0: yaw, wave: 0 }; };
  // novvoyxona: tandir, non stoli, soyabon, novvoy
  const bk = findSpot(P.x, P.z, 14, 70, 3.5, (x, z, si) => si.roadD > 4 && si.roadD < 16 && si.slope < 0.2 && flat(x, z, 2.5, 0.8) != null, 1.3);
  if (bk) { const [x, z] = bk, y = flat(x, z, 2.5, 0.8), yaw = roadYaw(x, z), g = new GB(2601); g.jit = 0.02; g.translate(x, y, z).rotY(yaw);
    g.color(0xc8a27a).cyl(12, 0.85, 0.7, 0, 0.9, { cap: true }); g.blob(0.72, 1, { cy: 0.9, sy: 0.75 }); g.color(0x2a1d16).box(0, 1.0, 0.62, 0.42, 0.34, 0.12); g.color(0xe86a2a).box(0, 0.98, 0.6, 0.3, 0.2, 0.06); // tandir
    g.push().translate(1.8, 0, 0.4); g.color(0x8a5a36).box(0, 0.4, 0, 1.6, 0.06, 0.8); for (const [a, b] of [[-0.72, -0.32], [0.72, -0.32], [-0.72, 0.32], [0.72, 0.32]]) g.box(a, 0.2, b, 0.06, 0.4, 0.06); g.color(0xd89040); for (let i = 0; i < 8; i++) g.push().translate(-0.55 + (i % 4) * 0.36, 0.45 + Math.floor(i / 4) * 0.05, -0.15 + Math.floor(i / 4) * 0.3).cyl(12, 0.15, 0.15, 0, 0.05, { cap: true }).pop(); g.pop();
    for (let i = 0; i < 6; i++) g.color(i % 2 ? 0xf2ead8 : 0xd8392b).push().translate(0.4 + i * 0.6 - 0.9 + 0.3, 2.35, 1.0).rotX(0.25).box(0, 0, 0, 0.6, 0.05, 1.6).pop(); for (const [a, b] of [[-0.9, 1.7], [2.7, 1.7], [-0.9, 0.2], [2.7, 0.2]]) g.color(0x6e4a30).box(a, 1.15, b - 0.5, 0.08, 2.3, 0.08);
    addMesh(g); const W = (lx, lz) => [x + lx * Math.cos(yaw) + lz * Math.sin(yaw), z - lx * Math.sin(yaw) + lz * Math.cos(yaw)];
    COL.addCircle(x, z, 0.85, y - 1, y + 1.6); COL.addBox(...W(1.8, 0.4), 0.8, 0.4, yaw, y - 1, y + 0.6);
    const [nx, nz] = W(1.0, -0.6); IS.pts.non = mkNpc({ shirt: 0xf6f6f2, pants: 0x3a3f4c, seed: 101, vest: 0xe8e2d4, stache: true }, nx, nz, yaw); IS.pts.non.name = 'Novvoy Karim aka'; IS.bakery = { x, z, y, yaw }; }
  // taksi bekati: belgi ustuni va dispetcher kursisi
  const tx = findSpot(P.x, P.z, 10, 60, 2.2, (x, z, si) => si.roadD > 2.5 && si.roadD < 7 && si.slope < 0.25, 2.9);
  if (tx) { const [x, z] = tx, y = T.gridHeight(x, z), yaw = roadYaw(x, z), g = new GB(2602); g.jit = 0.02; g.translate(x, y, z).rotY(yaw);
    g.color(0x6b6e78).cyl(6, 0.05, 0.05, 0, 2.6); g.color(0xffd23a).box(0, 2.55, 0, 0.9, 0.42, 0.06); g.color(0x1d1e22); for (let i = 0; i < 4; i++) g.box(-0.3 + i * 0.2, 2.42, 0.035, 0.1, 0.1, 0.01).box(-0.2 + i * 0.2, 2.68, 0.035, 0.1, 0.1, 0.01);
    g.color(0x8a5a36).box(1.2, 0.45, 0.2, 0.5, 0.06, 0.5); g.color(0x6e4a30).box(1.2, 0.22, 0.2, 0.06, 0.44, 0.06); g.color(0x3d74a6).box(1.2, 0.75, 0.0, 0.5, 0.5, 0.05);
    addMesh(g); COL.addCircle(x, z, 0.12, y - 1, y + 2.6); const c = Math.cos(yaw), s = Math.sin(yaw);
    IS.pts.taksi = mkNpc({ shirt: 0xffd23a, pants: 0x2a2c33, seed: 102, long: true, hair: 0x2a1d16 }, x + 1.2 * c + 0.7 * s, z - 1.2 * s + 0.7 * c, yaw); IS.pts.taksi.name = 'Dispetcher Lola opa'; IS.taxiStand = { x, z, yaw }; }
  // dala: bug'doy maydoni (26×16), arava va fermer
  const fd = findSpot(P.x, P.z, 40, 220, 14, (x, z, si) => si.roadD > 6 && si.roadD < 40 && si.slope < 0.12 && flat(x, z, 12, 1.6) != null && (si.biome === 0 || si.biome === 8 || si.biome === 7), 0.6);
  const field = { clumps: [], cart: null };
  if (fd) { const [x, z] = fd, yaw = roadYaw(x, z), c = Math.cos(yaw), s = Math.sin(yaw), W = (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c];
    field.x = x; field.z = z; field.yaw = yaw; field.W = W; if (game.detail && game.detail.excl) game.detail.excl.push({ x, z, yaw, hx: 13.2, hz: 8.6 }); // dala ichida yovvoyi o't chiqmasin
    const g = new GB(2603); g.jit = 0.02; for (let i = 0; i < 9; i++) { const [px, pz] = W(-11 + i * 2.75, 0); g.push().translate(px, T.gridHeight(px, pz) + 0.02, pz).rotY(yaw).color(i % 2 ? 0x8a6a3a : 0x7a5a32).box(0, 0, 0, 2.6, 0.08, 15).pop(); } addMesh(g);
    const sg = new GB(2604); sg.jit = 0.03; sg.color(0xe2c060); for (let i = 0; i < 9; i++) { const a = i * 0.7; sg.push().translate(Math.sin(a) * 0.18, 0, Math.cos(a) * 0.18).rotZ(Math.sin(a * 3) * 0.12).cyl(4, 0.02, 0.012, 0, 1.0 + (i % 3) * 0.12).color(0xf0d070).cyl(5, 0.035, 0.02, 0.9 + (i % 3) * 0.12, 1.15 + (i % 3) * 0.12).color(0xe2c060).pop(); }
    const im = new THREE.InstancedMesh(sg.build(), MAT.flat, 160); im.castShadow = true; im.frustumCulled = false; scene.add(im); field.im = im; const dm = new THREE.Object3D();
    for (let i = 0; i < 9; i++) for (let j = 0; j < 14; j++) { const [px, pz] = W(-11 + i * 2.75 + ((j % 2) - 0.5) * 0.6, -6.5 + j * 1.0); field.clumps.push({ x: px, z: pz, y: T.gridHeight(px, pz), s: 1, cut: 0, k: field.clumps.length }); }
    field.draw = () => { im.count = field.clumps.length; for (const q of field.clumps) { dm.position.set(q.x, q.y, q.z); dm.rotation.set(0, q.k * 1.7, 0); dm.scale.set(1, q.cut ? 0.18 : q.s, 1); dm.updateMatrix(); im.setMatrixAt(q.k, dm.matrix); } im.instanceMatrix.needsUpdate = true; }; field.draw();
    // arava (yuk joyi) va fermer
    const [ax, az] = W(0, -9.5), ay = T.gridHeight(ax, az), cg = new GB(2605); cg.jit = 0.02; cg.translate(ax, ay, az).rotY(yaw + Math.PI / 2);
    cg.color(0x8a5a36).box(0, 0.75, 0, 2.2, 0.08, 1.3); for (const sx of [-1, 1]) cg.box(0, 0.95, sx * 0.63, 2.2, 0.35, 0.05); cg.box(1.08, 0.95, 0, 0.05, 0.35, 1.3); cg.box(-1.08, 0.95, 0, 0.05, 0.35, 1.3); cg.color(0x6e4a30).box(-1.9, 0.55, 0, 1.6, 0.06, 0.08);
    for (const sx of [-1, 1]) cg.color(0x5a3a26).push().translate(0, 0.55, sx * 0.72).rotX(Math.PI / 2).cyl(12, 0.55, 0.55, -0.04, 0.04, { cap: true }).color(0x8a5a36).cyl(8, 0.12, 0.12, -0.06, 0.06, { cap: true }).pop();
    addMesh(cg); COL.addBox(ax, az, 0.75, 1.2, yaw, ay - 1, ay + 1.3); field.cart = { x: ax, z: az, y: ay };
    const lg = new GB(2606); lg.jit = 0.03; lg.color(0xe2c060).push().rotZ(Math.PI / 2).cyl(7, 0.16, 0.2, -0.45, 0.45, { cap: true }).pop(); field.loadIM = new THREE.InstancedMesh(lg.build(), MAT.flat, 8); field.loadIM.count = 0; field.loadIM.castShadow = true; scene.add(field.loadIM);
    const [fx2, fz2] = W(3.2, -9.8); IS.pts.dala = mkNpc({ shirt: 0x6a8a5a, pants: 0x4a3a2a, seed: 103, stache: true, hair: 0x6a6a6a }, fx2, fz2, yaw + Math.PI); IS.pts.dala.name = 'Fermer Bobur aka'; IS.field = field; }
  const drawLoad = (n) => { if (!field.loadIM) return; const d = new THREE.Object3D(), c = field.cart; field.loadIM.count = n; for (let i = 0; i < n; i++) { d.position.set(c.x + Math.sin(field.yaw) * ((i % 3) - 1) * 0.42, c.y + 0.98 + Math.floor(i / 3) * 0.3, c.z + Math.cos(field.yaw) * ((i % 3) - 1) * 0.42); d.rotation.set(0, field.yaw, 0); d.updateMatrix(); field.loadIM.setMatrixAt(i, d.matrix); } field.loadIM.instanceMatrix.needsUpdate = true; };

  // ================= BELGILAR (nur ustun + suzuvchi belgi) =================
  const beamMat = new THREE.MeshBasicMaterial({ color: 0xffd23a, transparent: true, opacity: 0.4, depthWrite: false, fog: false }), ringMat = new THREE.MeshBasicMaterial({ color: 0xffd23a, transparent: true, opacity: 0.7, depthWrite: false, fog: false, side: THREE.DoubleSide });
  const marks = [0, 1, 2, 3, 4, 5].map(() => { const g = new THREE.Group(), b = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 30, 10, 1, true), beamMat); b.position.y = 15; g.add(b); const rg = new THREE.Mesh(new THREE.RingGeometry(0.8, 1.05, 24), ringMat); rg.rotation.x = -Math.PI / 2; rg.position.y = 0.08; g.add(rg); const ic = new THREE.Mesh(new THREE.OctahedronGeometry(0.28), new THREE.MeshBasicMaterial({ color: 0xffe14a, fog: false })); ic.position.y = 2.6; g.add(ic); g.ic = ic; g.visible = false; scene.add(g); return g; });
  const showMarks = (pts, col = 0xffe14a) => { marks.forEach((m, i) => { const p = pts[i]; m.visible = !!p; if (p) { m.position.set(p.x, T.ground(p.x, p.z, 1e9).y, p.z); m.ic.material.color.setHex(col); } }); };
  // yelkadagi yuk (bog' yoki non xaltasi) — ko'krak suyagiga bog'lanadi (yurganda asbob kabi tushib qolmaydi)
  const carryM = (() => { const g = new GB(2607); g.jit = 0.02; g.color(0xe2c060).push().rotX(1.2).cyl(7, 0.09, 0.12, -0.25, 0.45, { cap: true }).color(0xf0d070).cyl(7, 0.15, 0.08, 0.4, 0.62).color(0x8a6a3a).cyl(7, 0.105, 0.105, 0.05, 0.1).pop(); const m = new THREE.Mesh(g.build(), MAT.flat); m.position.set(0.16, 0.12, -0.04); m.rotation.set(0, 0, -0.5); m.castShadow = true; return m; })();
  const sackM = (() => { const g = new GB(2608); g.jit = 0.03; g.color(0xc8a070).blob(0.17, 1, { sy: 1.3, sz: 0.7 }); g.color(0x8a5a36).box(0, 0.2, 0.02, 0.06, 0.06, 0.12); g.color(0xe0a050).blob(0.08, 0, { cy: 0.22, sy: 0.5 }); const m = new THREE.Mesh(g.build(), MAT.flat); m.position.set(0, 0, -0.2); m.castShadow = true; return m; })();
  const wear = (m, on) => { if (on) { if (m.parent !== pl.rig.chest) pl.rig.chest.add(m); } else if (m.parent) m.parent.remove(m); };

  // ================= ISH BOSHLASH / TUGATISH =================
  const housesNear = (cx, cz, r0, r1, n, avoid = []) => { const H = game.site.houses.map((h) => ({ h, d: Math.hypot(h.x - cx, h.z - cz) })).filter((q) => q.d > r0 && q.d < r1).map((q) => { const h = q.h, dd = h.hz + 1.4; return { x: h.x + Math.sin(h.yaw) * dd, z: h.z + Math.cos(h.yaw) * dd, yaw: h.yaw }; })
    .filter((p) => { const si = T.siteInfo(p.x, p.z); return si.y > si.water + 0.5 && H2.freeAt(p.x, p.z, 0.35) && !avoid.some((a) => Math.hypot(a.x - p.x, a.z - p.z) < 25); }); for (let i = H.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [H[i], H[j]] = [H[j], H[i]]; } return H.slice(0, n); };
  const hud = document.createElement('div'); hud.className = 'panel tc jobhud'; hud.style.display = 'none';
  const drawHud = () => { const J = IS.cur; if (!hud.parentNode && game.ui) game.ui.hud.appendChild(hud); if (!J || game.act) { hud.style.display = 'none'; return; } hud.style.display = '';
    const k = Math.ceil(J.t != null ? J.t : -1) + ':' + J.done + ':' + (J.stage || '') + (J.carry ? 1 : 0); if (hud._k === k) return; hud._k = k;
    hud.innerHTML = `<h3>${JOBS[J.id][0]} ${JOBS[J.id][1]}</h3>${J.t != null ? `<div class="timer${J.t < 20 ? ' low' : ''}">${mmss(J.t)}</div>` : ''}<div class="ln">${J.line()}</div><div class="ln" style="opacity:.7;font-size:12px"><kbd>X</kbd> — ishni tugatish · ishlab topildi ${som(J.earn)} so'm</div>`; };
  const begin = (id, J) => { if (IS.cur) return toast('Avval joriy ishni tugating', 'bad'); if (game.act) return toast('Avval chellenjni tugating', 'bad'); if (L.fare) return toast("Mashinada yo'lovchi bor — avval uni eltib qo'ying", 'bad');
    IS.cur = Object.assign({ id, done: 0, earn: 0 }, J); st.jobs[id] = st.jobs[id] || { n: 0, best: 0, earn: 0 }; sfx('start'); game.banner(JOBS[id][0] + ' ' + JOBS[id][1], J.intro, 'gold'); return true; };
  const finish = (ok, msg) => { const J = IS.cur; if (!J) return; IS.cur = null; showMarks([]); game.setWaypoint(null); wear(carryM, false); wear(sackM, false); if (J.pass) { J.pass.rig.root.visible = false; } if (J.end) J.end();
    const s = st.jobs[J.id]; if (J.done) { s.n++; s.earn += J.earn; s.best = Math.max(s.best, J.earn); } drawHud(); game.save();
    game.banner(ok ? 'Ish bajarildi! 👏' : 'Ish tugatildi', msg || `Jami ishlab topildi: ${som(J.earn)} so'm`, ok ? 'gold' : ''); sfx(ok ? 'win' : 'click'); };
  IS.quit = () => finish(false, IS.cur && IS.cur.earn ? `Ishlab topilgani sizda qoladi: ${som(IS.cur.earn)} so'm` : "Hech narsa ishlab topilmadi");
  const sa0 = game.startAct; game.startAct = (a) => { if (IS.cur) return toast('Avval ishni tugating — [X]', 'bad'); return sa0(a); };

  // --- 1. NON YETKAZISH ---
  IS.startNon = () => { if (!IS.bakery) return; const pts = housesNear(IS.bakery.x, IS.bakery.z, 25, 420, 5); if (pts.length < 3) return toast("Bugun buyurtma yo'q", 'bad');
    begin('non', { t: 150 + pts.length * 6, pts, intro: `${pts.length} ta uyga issiq non — sariq nur tushgan eshiklar. Piyoda yoki mashinada!`,
      line() { return `Yetkazildi: ${this.done}/${this.pts.length} · eshik oldida <kbd>E</kbd>`; } }); showMarks(pts); wear(sackM, true); pl.act('bend', 0.9, null, 'basket'); };
  const deliver = (p) => { const J = IS.cur; p.ok = 1; J.done++; const n = 30; J.earn += n; pay(n, 'Non yetkazish'); sfx('pop'); toast(`🍞 Non topshirildi! «Rahmat, bolam!» +${n} so'm · ${J.done}/${J.pts.length}`, 'good'); L.karma(1);
    fx().burst(8, p.x, T.ground(p.x, p.z, 1e9).y + 1.5, p.z, 1.6, 1.1, 0.35, 0xffd23a, 0.9, 1.6, 2, 0.2);
    showMarks(J.pts.filter((q) => !q.ok)); if (J.done >= J.pts.length) { const bonus = 50 + Math.round(J.t * 0.8); J.earn += bonus; pay(bonus, 'Non yetkazish — bonus'); finish(true, `Barcha non yetkazildi! Tezlik bonusi +${bonus} so'm · jami ${som(J.earn)} so'm`); } };
  // --- 2. TAKSI SMENASI ---
  const passRig = makeRig({ shirt: 0xe2572f, pants: 0x3a3f4c, seed: 111 }); passRig.root.visible = false; scene.add(passRig.root);
  const newRide = (J) => { const a = housesNear(car.p[0], car.p[2], 110, 520, 1)[0] || housesNear(car.p[0], car.p[2], 40, 900, 1)[0]; if (!a) return finish(false, "Yo'lovchi topilmadi");
    J.stage = 'pick'; J.a = a; J.b = null; J.t = null; J.name = PASS[(Math.random() * PASS.length) | 0]; const y = T.ground(a.x, a.z, 1e9).y; passRig.root.position.set(a.x, y, a.z); passRig.root.rotation.y = a.yaw; passRig.root.visible = true; J.pass = { rig: passRig }; showMarks([a], 0x4fd0ff); game.setWaypoint(a.x, a.z, true); };
  IS.startTaksi = () => { if (car.spec && game.carModel.id === 'velo') return toast("Velosipedda taksi bo'lmaydi — mashina oling", 'bad');
    if (begin('taksi', { goal: 3, intro: "3 ta yo'lovchi kutmoqda — ko'k belgi. Yoniga borib to'xtang va [E] bosing.", line() { return this.stage === 'pick' ? `Yo'lovchi ${this.name} kutmoqda (ko'k) · ${this.done}/${this.goal}` : `${this.name} → manzilga (sariq) · ${this.done}/${this.goal}`; } })) newRide(IS.cur); };
  const pickUp = () => { const J = IS.cur, a = J.a; J.pass.rig.root.visible = false; const b = housesNear(a.x, a.z, 260, 950, 1, [a])[0] || housesNear(a.x, a.z, 120, 1400, 1, [a])[0]; if (!b) return finish(false);
    const r = T.route(car.p[0], car.p[2], b.x, b.z), len = r ? r.pts.reduce((s, p, i, A) => s + (i ? Math.hypot(p[0] - A[i - 1][0], p[1] - A[i - 1][1]) : 0), 0) : Math.hypot(b.x - a.x, b.z - a.z) * 1.4;
    J.b = b; J.len = len; J.t = Math.round(len / 10 + 25); J.t0 = J.t; J.stage = 'drop'; showMarks([b]); game.setWaypoint(b.x, b.z, true); sfx('check'); toast(`🚕 ${J.name}: «Assalomu alaykum! Meni ana u uyga olib boring, iltimos» · ${Math.round(len)} m`, 'gold'); };
  const dropOff = () => { const J = IS.cur, b = J.b, fast = J.t > 0, n = Math.round(25 + J.len * 0.06 + (fast ? 20 : 0) * 1); J.done++; J.earn += n; pay(n, 'Taksi'); L.karma(1);
    passRig.root.position.set(b.x, T.ground(b.x, b.z, 1e9).y, b.z); passRig.root.rotation.y = b.yaw + Math.PI; passRig.root.visible = true; J.byeT = 3;
    toast(`🚕 ${J.name}: «Rahmat, ${fast ? 'tez yetkazdingiz!' : 'yetib keldik.'}» +${n} so'm${fast ? ' (o\'z vaqtida)' : ''}`, 'good');
    if (J.done >= J.goal) { const bonus = 80; J.earn += bonus; pay(bonus, 'Taksi — smena bonusi'); finish(true, `Smena tugadi: ${J.goal} yo'lovchi · bonus +${bonus} · jami ${som(J.earn)} so'm`); passRig.root.visible = true; setTimeout(() => { if (!IS.cur) passRig.root.visible = false; }, 3000); }
    else { J.stage = 'wait'; J.waitT = 2.5; showMarks([]); game.setWaypoint(null); } };
  // --- 3. DALADA O'RIM ---
  IS.startDala = () => { if (!field.im) return; const left = field.clumps.filter((q) => !q.cut); for (const q of field.clumps) q.cut = 0; const pick = []; const pool = field.clumps.filter((q, i) => i % 3 === 1);
    for (let i = 0; i < 6; i++) pick.push(pool.splice((Math.random() * pool.length) | 0, 1)[0]); void left; field.draw(); drawLoad(0);
    begin('dala', { t: 170, goal: 6, pick, carry: false, intro: "Sariq belgili bug'doyni o'roq bilan o'ring [E] va bog'ni aravaga olib boring.", line() { return this.carry ? `Bog'ni aravaga olib boring · ${this.done}/${this.goal}` : `O'rildi va ortildi: ${this.done}/${this.goal} · bug'doy oldida <kbd>E</kbd>`; } }); showMarks(pick); };
  const reap = (q) => { const J = IS.cur; pl.yaw = Math.atan2(q.x - pl.p[0], q.z - pl.p[2]); pl.act('swing', 1.3, () => { q.cut = 1; field.draw(); J.carry = true; J.pick.splice(J.pick.indexOf(q), 1); wear(carryM, true); sfx('rustle'); fx().burst(10, q.x, q.y + 0.6, q.z, 1.5, 0.6, 0.25, 0xe2c060, 0.9, 1.2, 1, 0.4); showMarks([field.cart]); game.setWaypoint(field.cart.x, field.cart.z, true); }, 'sickle'); };
  const load = () => { const J = IS.cur; pl.act('bend', 0.8, () => { J.carry = false; wear(carryM, false); J.done++; drawLoad(J.done); const n = 18; J.earn += n; pay(n, "Dalada o'rim"); toast(`🌾 Bog' aravada! +${n} so'm · ${J.done}/${J.goal}`, 'good');
    if (J.done >= J.goal) { const bonus = 70; J.earn += bonus; pay(bonus, "Dalada o'rim — bonus"); finish(true, `Hosil yig'ildi! Bobur aka: «Barakalla!» +${bonus} · jami ${som(J.earn)} so'm`); } else { showMarks(J.pick); game.setWaypoint(null); } }); };
  IS.dbg = { field, deliver, pickUp, dropOff, reap, load };

  // ================= [E] TAKLIFLARI =================
  const ex0 = L.extra;
  L.extra = (offer, px, pz, p) => { ex0(offer, px, pz, p); if (IN.inside || (game.hayot && game.hayot.dlg)) return; const J = IS.cur;
    for (const id in IS.pts) { const n = IS.pts[id], d = Math.hypot(n.x - px, n.z - pz); if (d > 2.6) continue; if (!J) offer(d - 0.2, `<kbd>E</kbd> ${n.name}: «${JOBS[id][1]}» ishi ${JOBS[id][0]}`, () => { n.wave = 2; pl.yaw = Math.atan2(n.x - px, n.z - pz); game.ui.open('ishlar', { focus: id }); });
      else if (J.id === id) offer(d, `${n.name}: «Ishni bajaring — vaqt ketyapti!»`, () => {}); }
    if (!J) return;
    if (J.id === 'non') for (const q of J.pts) { if (q.ok) continue; const d = Math.hypot(q.x - px, q.z - pz); if (d < 2.8) offer(d - 0.3, '<kbd>E</kbd> Nonni topshirish 🍞', () => { pl.yaw = Math.atan2(q.x - pl.p[0], q.z - pl.p[2]); pl.act('bend', 0.9, () => deliver(q), 'basket'); }); }
    if (J.id === 'dala') { if (!J.carry) { for (const q of J.pick) { const d = Math.hypot(q.x - px, q.z - pz); if (d < 2.2) offer(d - 0.3, "<kbd>E</kbd> Bug'doyni o'rish 🌾", () => reap(q)); } } else { const c = field.cart, d = Math.hypot(c.x - px, c.z - pz) - 1; if (d < 2.2) offer(d - 0.3, "<kbd>E</kbd> Bog'ni aravaga ortish", load); } } };
  // transportda: [E] — yo'lovchini olish / nonni derazadan uzatish
  const carAct = () => { const J = IS.cur; if (!J || pl.onFoot || car.speed > 3) return null; const cx = car.p[0], cz = car.p[2];
    if (J.id === 'taksi' && J.stage === 'pick' && Math.hypot(J.a.x - cx, J.a.z - cz) < 11) return ['<kbd>E</kbd> Yo\'lovchini olish 🚕', pickUp];
    if (J.id === 'non') for (const q of J.pts) if (!q.ok && Math.hypot(q.x - cx, q.z - cz) < 8) return ['<kbd>E</kbd> Nonni derazadan uzatish 🍞', () => deliver(q)];
    return null; };
  const ue0 = L.useE; L.useE = () => { const a = carAct(); if (a && !(game.hayot && game.hayot.dlg)) return a[1](); ue0(); };

  // ================= KADR =================
  const up0 = L.update;
  L.update = (dt) => { up0(dt); const J = IS.cur, foot = pl.onFoot;
    for (const id in IS.pts) { const n = IS.pts[id], d = Math.hypot(n.x - pl.p[0], n.z - pl.p[2]); n.rig.root.visible = d < 150; if (d > 80) continue; if (n.wave > 0) n.wave -= dt; const near = foot && d < 8; n.yaw += angDiff(near ? Math.atan2(pl.p[0] - n.x, pl.p[2] - n.z) : n.yaw0, n.yaw) * Math.min(1, dt * 3); n.rig.root.rotation.y = n.yaw; poseRig(n.rig, n.wave > 0 || (near && d < 3.5 && !J) ? 'wave' : 'idle', dt, 0);
      if (!J || J.id !== id) L.dots.push([n.x, n.z, '#ffd23a']); }
    if (J) {
      if (J.t != null) { J.t -= dt; if (J.t <= 0 && J.id !== 'taksi') { J.t = 0; return finish(false, `Vaqt tugadi! ${J.done ? `Bajarilgani uchun ${som(J.earn)} so'm` : 'Keyingi safar tezroq!'}`); } }
      for (const m of marks) if (m.visible) { m.ic.rotation.y += dt * 2; m.ic.position.y = 2.6 + Math.sin(game.time * 3) * 0.12; beamMat.opacity = 0.32 + 0.1 * Math.sin(game.time * 4); }
      if (J.id === 'non') { const left = J.pts.filter((q) => !q.ok); for (const q of left) L.dots.push([q.x, q.z, '#ffd23a']); if (!game.way && left.length) { let b = left[0], bd = 1e9; for (const q of left) { const d = Math.hypot(q.x - pl.p[0], q.z - pl.p[2]); if (d < bd) { bd = d; b = q; } } game.setWaypoint(b.x, b.z, true); } }
      if (J.id === 'taksi') { const tgt = J.stage === 'pick' ? J.a : J.b; if (tgt) L.dots.push([tgt.x, tgt.z, J.stage === 'pick' ? '#4fd0ff' : '#ffd23a']);
        if (J.stage === 'pick') { passRig.root.rotation.y += angDiff(Math.atan2(car.p[0] - J.a.x, car.p[2] - J.a.z), passRig.root.rotation.y) * Math.min(1, dt * 3); poseRig(passRig, Math.hypot(car.p[0] - J.a.x, car.p[2] - J.a.z) < 40 ? 'wave' : 'idle', dt, 0); }
        if (J.stage === 'drop' && !foot && car.speed < 3 && Math.hypot(J.b.x - car.p[0], J.b.z - car.p[2]) < 11) dropOff();
        if (J.stage === 'wait' && (J.waitT -= dt) <= 0) newRide(J); if (J.byeT > 0) { J.byeT -= dt; poseRig(passRig, 'wave', dt, 0); if (J.byeT <= 0 && J.stage !== 'pick') passRig.root.visible = false; } }
      if (J.id === 'dala') { for (const q of J.pick) L.dots.push([q.x, q.z, '#ffd23a']); if (J.carry) wear(carryM, foot); }
      if (J.id === 'non') wear(sackM, foot);
      if (!foot) { const a = carAct(); if (a) L.prompt = a[0]; }
    }
    drawHud(); };

  // ================= TELEFON =================
  const PH = (game.phone = { app: null });
  PH.open = (app) => { if (game.mode !== 'play') return; PH.app = app || null; game.ui.open('telefon'); sfx('click'); };
  const tempNow = () => { const p = pl.onFoot ? pl.p : car.p, b = T.biomeAt(p[0], p[2]), h = game.hour; return Math.round(TEMP[b] - 7 + 7 * Math.cos((h - 14.5) / 24 * 6.283)); };
  PH.callTaxi = () => { if (IN.inside) return toast('Avval tashqariga chiqing 🙂', 'bad'); if (!pl.onFoot) return toast('Siz allaqachon rul ortidasiz 🙂'); const fee = 60; if (st.money < fee) return toast("Pul yetarli emas (60 so'm)", 'bad');
    const nr = T.nearestRoad(pl.p[0], pl.p[2], 45); let x, z, yaw;
    if (nr.edge >= 0 && nr.d < 12) { const R = T.roads, off = nr.hw * 0.5; x = R.x[nr.i] - R.tz[nr.i] * off; z = R.z[nr.i] + R.tx[nr.i] * off; yaw = Math.atan2(R.tx[nr.i], R.tz[nr.i]); }
    else { yaw = pl.yaw + Math.PI / 2; x = pl.p[0] + Math.sin(pl.yaw + 1.2) * 4.5; z = pl.p[2] + Math.cos(pl.yaw + 1.2) * 4.5; }
    car.place(x, z, yaw); game.prevP = car.p.slice(); game.addMoney(-fee, 'Taksi chaqirish'); sfx('horn'); game.ui.close(); toast(`🚕 Haydovchi ${game.carModel.v.name}ingizni yoningizga olib keldi · −${fee} so'm`, 'good'); return true; };
  PH.mechCost = () => { const d = game.damage; return Math.round(40 + ((100 - d.health) * 9 + d.tires.reduce((a, b) => a + b, 0) * 60) * Math.max(0.4, Math.sqrt(car.mass / 1500)) * 1.2); };
  PH.callMech = () => { const d = game.damage; if (d.health >= 99 && !d.tires.some(Boolean)) return toast('Mexanik Rustam: «Mashinangiz soz, aka!» 👍'); const c = PH.mechCost(); if (st.money < c) return toast(`Pul yetarli emas (${som(c)} so'm)`, 'bad');
    game.addMoney(-c, 'Mexanik'); d.repair(100); sfx('repair'); game.save(); game.ui.close(); toast(`🔧 Mexanik Rustam keldi va ${game.carModel.v.name}ni tuzatdi · −${som(c)} so'm`, 'good'); return true; };
  const APPS = [['xarita', '🗺️', 'Xarita', '#2f8a50'], ['bank', '🏦', 'Bank', '#2f6fd0'], ['kontakt', '📞', 'Kontaktlar', '#3fae5a'], ['kamera', '📷', 'Kamera', '#5a5f6e'], ['havo', '⛅', 'Ob-havo', '#3d9ae0'], ['ish', '💼', 'Ishlar', '#d8822a'], ['musiqa', '🎵', 'Musiqa', '#d8392b'], ['uy', '🏠', 'Uyim', '#8a54c8']];
  PH.apps = APPS; PH.ext = {}; PH.acts = {}; // boshqa modullar o'z ilovasini qo'shadi (hayot3: biznes, kun rejasi): PH.ext[id](head, render) — ilova ichi, PH.acts — tugmalar
  const attach = (ui) => {
    ui.s_telefon = function (w, d, btn, x) {
      x(); const render = () => { const app = PH.app, h = game.hour, night = h < 6 || h > 20;
        const bar = `<div class="ph-bar"><b>${hm(h)}</b><span>📶 SAFAR · 🔋 ${86 - Math.round(st.stats.time / 600) % 60}%</span></div>`;
        let body = '';
        if (!app) body = `<div class="ph-clock"><b>${hm(h)}</b><span>${night ? '🌙' : '☀️'} ${tempNow()}° · ${game.region || 'Orol'}</span></div><div class="ph-apps">${APPS.map((a) => `<div class="ph-app" data-a="app:${a[0]}"><i style="background:${a[3]}">${a[1]}</i><span>${a[2]}</span></div>`).join('')}</div><div class="ph-dock"><span>💰 ${som(st.money)} so'm</span><span>❤ ${Math.floor(st.karma)}</span></div>`;
        else { const head = (t) => `<div class="ph-head"><button class="sec" data-a="home">‹</button><b>${t}</b></div>`;
          if (app === 'bank') { const inc = st.income.slice(0, 14), earned = st.income.filter((q) => q[2] > 0).reduce((a, q) => a + q[2], 0);
            body = head('🏦 Orol Bank') + `<div class="ph-card"><small>Hisobingizda</small><b>${som(st.money)} so'm</b><small>So'nggi tushum: +${som(earned)} so'm</small></div>${PH.bankExtra ? PH.bankExtra() : ''}<div class="ph-list">${inc.map((q) => `<div><span>${q[1]}<small>${q[0]}</small></span><b class="${q[2] > 0 ? 'pos' : 'neg'}">${q[2] > 0 ? '+' : ''}${som(q[2])}</b></div>`).join('') || '<p class="ph-empty">Hali pul harakati yo\'q</p>'}</div>`; }
          else if (app === 'kontakt') { const dm = game.damage, mc = PH.mechCost();
            body = head('📞 Kontaktlar') + `<div class="ph-list ph-ct"><div data-a="taxi"><span>🚕 Taksi xizmati<small>Transportingizni yoningizga olib keladi</small></span><b>60 so'm</b></div><div data-a="mech"><span>🔧 Mexanik Rustam<small>${dm.health >= 99 && !dm.tires.some(Boolean) ? 'Mashina soz' : `Dvigatel ${Math.round(dm.health)}% — joyida ta'mir`}</small></span><b>${dm.health >= 99 && !dm.tires.some(Boolean) ? '—' : som(mc) + " so'm"}</b></div><div data-a="mom"><span>👩 Onam<small>Qo'ng'iroq qilish</small></span><b>📞</b></div><div data-a="disp"><span>🚖 Dispetcher Lola opa<small>Taksi smenasini boshlash</small></span><b>💼</b></div></div>`; }
          else if (app === 'havo') { const t0 = tempNow(); body = head('⛅ Ob-havo va soat') + `<div class="ph-big"><b>${hm(h)}</b><span>${['Tun', 'Tong', 'Kunduz', 'Shom'][h < 5 ? 0 : h < 10 ? 1 : h < 18 ? 2 : h < 21 ? 3 : 0]} · ${game.region || 'Orol'}</span><i>${night ? '🌙' : '☀️'} ${t0}°C</i></div><div class="ph-fc">${[3, 6, 9, 12].map((k) => { const hh = (h + k) % 24, n = hh < 6 || hh > 20; return `<div><small>${hm(Math.floor(hh))}</small><b>${n ? '🌙' : k === 6 ? '⛅' : '☀️'}</b><span>${t0 + Math.round(7 * Math.cos((hh - 14.5) / 24 * 6.283) - 7 * Math.cos((h - 14.5) / 24 * 6.283))}°</span></div>`; }).join('')}</div><p class="ph-empty">Budilnik: ${hm(st.alarm || 6.5)} · bir sutka — 20 daqiqa</p>` + (game.dunyo ? game.dunyo.phoneHtml() : '') + (game.tadbir ? '<p class="ph-empty" style="margin-top:6px"><b>📅 Tadbirlar taqvimi</b></p>' + game.tadbir.phoneHtml() : ''); }
          else if (app === 'ish') body = head('💼 Ishlar') + `<div class="ph-list">${Object.keys(JOBS).map((id) => { const s = st.jobs[id] || { n: 0, earn: 0 }, on = IS.cur && IS.cur.id === id; return `<div data-a="go:${id}"><span>${JOBS[id][0]} ${JOBS[id][1]}<small>${on ? 'Hozir bajarilmoqda' : `${s.n} marta · ${som(s.earn)} so'm`}</small></span><b>${on ? '⏱' : '📍'}</b></div>`; }).join('')}</div>${IS.cur ? '<button class="bad" data-a="quit" style="margin:10px 14px">Ishni tugatish</button>' : '<p class="ph-empty">📍 — xaritada yo\'l ko\'rsatadi. Ish beruvchi oldida <kbd>E</kbd>.</p>'}`;
          else if (PH.ext[app]) body = PH.ext[app](head, render);
          else if (app === 'uy') { const H = ['Chodir', 'Kulba', 'Hovli uy', 'Ikki qavatli uy', 'Villa'][st.home.lvl]; body = head('🏠 Uyim') + `<div class="ph-card"><small>Uyingiz</small><b>${H}</b><small>To'qlik ${Math.round(st.sat)}% · 💧 ${Math.round(st.thirst)}% · kuch ${Math.round(st.energy)}%</small></div><div class="ph-list"><div data-a="gohome"><span>📍 Uyga yo'l<small>Xaritada belgilash</small></span><b>›</b></div></div>`; }
        }
        w.innerHTML = `<div class="phone">${bar}<div class="ph-scr${app ? ' in' : ''}">${body}</div><div class="ph-homebtn" data-a="home"></div></div>`; };
      this.on({ ...Object.fromEntries(Object.entries(PH.acts).map(([k, f]) => [k, (v, b) => f(v, b, render)])), app: (a) => { if (a === 'xarita') return ui.open('map'); if (a === 'kamera') { ui.close(); ui.setHud(false); sfx('click'); return toast('📷 Surat rejimi — interfeys yashirildi'); } if (a === 'musiqa') { const s = st.set; s.music = !s.music; game.audio.setMusic(s.music); toast(s.music ? '🎵 Musiqa yoqildi' : "🎵 Musiqa o'chirildi"); return render(); } PH.app = a; render(); },
        home: () => { PH.app = null; render(); }, taxi: () => { PH.callTaxi(); }, mech: () => { PH.callMech(); }, mom: () => { toast(["👩 Onam: «Bolam, ovqatlandingmi? Choyxonada osh yeb ol!»", "👩 Onam: «Ehtiyot bo'lib hayda, bolam!»", "👩 Onam: «Uyingga kir, dam ol — kech bo'ldi»"][(Math.random() * 3) | 0], 'gold'); },
        disp: () => { if (pl.onFoot || IN.inside) return toast('Dispetcher: «Avval mashinaga o\'tiring!»', 'bad'); ui.close(); IS.startTaksi(); },
        go: (id) => { const n = IS.pts[id]; if (!n) return; game.setWaypoint(n.x, n.z); ui.close(); toast(`📍 ${n.name} — xaritada yo'l ko'rsatildi`); },
        quit: () => { ui.close(); IS.quit(); }, gohome: () => { const hh = game.site.places.uy.home; game.setWaypoint(hh.x, hh.z); ui.close(); toast("📍 Uyga yo'l ko'rsatildi"); } });
      render();
    };
    // ish beruvchi oynasi (NPC oldida)
    ui.s_ishlar = function (w, d, btn, x) {
      x(); const id = d && d.focus, n = IS.pts[id], s = st.jobs[id] || { n: 0, best: 0, earn: 0 }, inCar = !pl.onFoot;
      const rule = { non: "5 ta uy · 30 so'm har biri + tezlik bonusi · ~2,5 daqiqa", taksi: "3 yo'lovchi · 25 so'm + masofa · o'z vaqtida +20 · smena bonusi 80", dala: "6 bog' · 18 so'm har biri + 70 bonus · ~3 daqiqa" }[id];
      w.innerHTML = `<h1>${JOBS[id][0]} ${JOBS[id][1]} <small>${n ? n.name : ''}</small></h1><p class="sub">${JOBS[id][2]}</p><div class="card"><h4>Shartlar</h4><p>${rule}</p><p>Bajarilgan: ${s.n} marta · eng yaxshi: ${som(s.best)} so'm · jami: ${som(s.earn)} so'm</p></div>
        ${id === 'taksi' ? `<p class="sub" style="margin-top:8px">Taksi uchun transportingiz kerak (velosipeddan boshqa). ${inCar ? '' : "Boshlagach transportga o'tiring [F]."}</p>` : ''}<div class="row" style="margin-top:12px;gap:8px"><button data-a="start">Ishni boshlash</button><button class="sec" data-a="no">Keyinroq</button></div>`;
      this.on({ start: () => { this.close(); if (id === 'non') IS.startNon(); else if (id === 'taksi') { if (game.carModel.id === 'velo') return toast("Velosipedda taksi bo'lmaydi — garajdan mashina oling", 'bad'); IS.startTaksi(); } else IS.startDala(); }, no: () => this.close() });
    };
  };
  let ok = false; game.hooks.push(() => { if (!ok && game.ui) { ok = true; attach(game.ui); } });
  return IS;
}
