// O'yin mantig'i: saqlash, iqtisod, tyuning, tangalar, radarlar, tramplinlar, chellenjlar, shikastlanish hodisalari
import * as THREE from 'three';
import * as T from './terrain.js';
import { GB, MAT } from './geo.js';
import { clamp, lerp, mulberry32, hash2, angDiff } from './util.js';
import { buildActs, estimateTime, pathLen, scatterItems, edgePoint } from './acts.js';
import { Car, Autopilot } from './physics.js';
import { PAINTS } from './carmodel.js';
import { buildVehicle, syncWheels, VEHICLES, vehById } from './vehicles.js';
import * as COL from './colliders.js';

const KEY = 'safar_save_v2';
const HOLD = { throttle: 0, brake: 0, steer: 0, handbrake: true };
export const UPG = [
  { id: 'engine', name: 'Dvigatel', desc: 'Quvvat va eng yuqori tezlik', max: 4, cost: [900, 2000, 4000, 7500] },
  { id: 'nitro', name: 'Nitro', desc: 'Kuchliroq va uzoqroq tezlatgich', max: 3, cost: [700, 1600, 3200] },
  { id: 'tires', name: 'Shinalar', desc: "Yo'lda ham, yo'lsizlikda ham mahkam tutadi", max: 3, cost: [600, 1500, 3000] },
  { id: 'susp', name: 'Osma', desc: "Sakrashdan yumshoq qo'nish, kamroq shikast", max: 3, cost: [600, 1400, 2800] },
  { id: 'armor', name: 'Zirh', desc: 'Urilganda shikast kamroq', max: 3, cost: [800, 1800, 3600] },
  { id: 'brake', name: 'Tormoz', desc: "Tezroq to'xtash", max: 2, cost: [500, 1300] },
];
const REGION = ["Yashil vodiy", "Oltin o'rmon", 'Tayga', "Qizilqum cho'li", 'Qizil dara', "Oqtog' qorlari", 'Sohil', 'Sakura vodiysi', 'Savanna', "Olovtog' etagi"];
const LEVELS = ['Yangi haydovchi', "Yo'lovchi", 'Sayyoh', 'Tajribali sayyoh', "Yo'l ustasi", 'Ralli ustasi', 'Orol afsonasi'];
const ICON = { sheep: 0xf6f3ea, shell: 0xffc8d8, mush: 0xfff2d0, oar: 0xc79a66, flare: 0xff5030, rock: 0x9fd0ff, coin: 0xffd040, gold: 0xffd040, crate: 0xc79a66, tool: 0xff9a30 };

function defState() {
  return { v: 2, money: 300, xp: 0, stars: {}, best: {}, up: { engine: 0, nitro: 0, tires: 0, susp: 0, armor: 0, brake: 0 }, paint: 'qizil', paints: ['qizil'], coins: [], chests: [], places: {},
    stats: { dist: 0, top: 0, jump: 0, smashed: 0, crashes: 0, time: 0, drift: 0, air: 0, walk: 0 }, set: { vol: 0.8, music: true, gfx: 2, damage: true }, hour: 9.5, pos: null, dmg: null, fresh: true,
    veh: { own: ['jip', 'velo'], cur: 'jip', dmg: {}, paint: {} }, foot: null,
    inv: { seed: 3, sapling: 0, fruit: 0, berry: 0, veg: 0, bread: 1, mush: 0, shell: 0, flower: 0, wood: 0, hay: 0, fish: 0, bigfish: 0, egg: 0, ore: 0, gem: 0, kit: 0, water: 1, juice: 0, sweets: 0, snack: 0, canister: 0, friedfish: 0, kabob: 0, soup: 0, omlet: 0, salad: 0, dimlama: 0, tea: 0 },
    tools: {}, hats: [], hat: null, karma: 0, sat: 100, energy: 100,
    home: { lvl: 0, decor: {}, beds: [0, 0, 0, 0, 0, 0], wat: [0, 0, 0, 0, 0, 0], eggT: 0, mailT: 0, incT: 0, fund: 0 }, // fund — onlayn xonada do'stlar qo'shgan pul (keyingi darajaga)
    flowers: [], trees: [], flags: [], tasks: [], cnt: {}, seen: {}, peaks: {},
    thirst: 100, fuel: {}, fridge: {}, alarm: 6.5, // kundalik hayot (hayot.js): chanqoq, transport yoqilg'isi (%), muzlatkich, budilnik soati
    look: null, clothes: [], income: [], jobs: {}, // hayot2/ish: kiyim-soch ko'rinishi, sotib olingan kiyimlar, pul tarixi, ishlar hisobi
    dunyo: { day: 1, toy: -1, nav: -1 }, // obhavo/tadbir: o'yin kuni, oxirgi to'y/Navro'z sovg'asi olingan kun
    hafta: { w: -1, best: null, stars: 0, paid: 0, tries: 0, s: { money: 0, km: 0, jobs: 0, wins: 0 }, hist: [], badges: {}, done: 0, weeks: 0 }, // hafta.js: joriy hafta raqami, haftalik chellenj rekordi/yulduzi/to'langan mukofot, hafta ko'rsatkichlari (km — metrda), o'tgan haftalar, nishonlar
    biz: {}, home2: {}, tetik: 100, hurmat: 0, errands: {}, soat: 0, // hayot3: biznes (biznes.js), uy kengaytmalari (uy2.js), tetiklik — charchoq va o'tgan o'yin soatlari (kun.js), hurmat va topshiriqlar (topshiriq.js)
    sovrin: { rec: {}, cups: {}, best: { n: 0, pts: 0 }, tricks: 0, tlog: {}, paid: {} }, // tryuk.js: transport rekordlari {chellenj: {transport: [natija, medal]}}, kuboklar {poyga: soni}, eng yaxshi kombo, tryuklar soni, tryuklar daftari, to'langan medal mukofotlari
    errCur: null }; // topshiriq.js: bajarilayotgan topshiriq (tur, beruvchi, bosqich) — qayta yuklanganda davom etadi; null — yo'q
}
function loadState() {
  const d = defState(); let s = null; try { s = JSON.parse(localStorage.getItem(KEY)); } catch (e) { /* saqlangan o'yin yo'q */ }
  if (!s || s.v !== 2) return d;
  const st = Object.assign({}, d, s);
  for (const k of ['stats', 'set', 'up', 'veh', 'inv', 'home']) st[k] = Object.assign({}, d[k], s[k] || {});
  if (!st.veh.own.includes('velo')) st.veh.own.push('velo'); if (!vehById[st.veh.cur]) st.veh.cur = 'jip';
  if (s.dmg && !st.veh.dmg.jip) st.veh.dmg.jip = s.dmg; st.dmg = null;
  if (s.paint && s.paint !== 'qizil' && !st.veh.paint.jip) st.veh.paint.jip = s.paint;
  return st;
}

export function initGame(game) {
  const { scene, car, site } = game;
  const st = (game.state = loadState());
  const A = (game.acts = buildActs(site));
  game.save = () => { if (game.noSave) return; try { const pl = game.player; st.pos = [car.p[0], car.p[2], car.yaw]; st.foot = pl && pl.onFoot ? [pl.p[0], pl.p[2], pl.yaw] : null; st.hour = game.hour; st.veh.dmg[st.veh.cur] = game.damage.save(); localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) { /* saqlash imkoni yo'q */ } };
  game.resetSave = () => { try { localStorage.removeItem(KEY); } catch (e) {} location.reload(); };
  const ui = () => game.ui;
  game.toast = (m, k) => ui() && ui().toast(m, k);
  game.banner = (a, b, k) => ui() && ui().banner(a, b, k);
  game.totalStars = () => { let n = 0; for (const k in st.stars) n += st.stars[k]; return n; };
  game.maxStars = A.acts.length * 3;
  game.level = () => Math.min(LEVELS.length, Math.floor(Math.sqrt(st.xp / 220)) + 1);
  game.levelName = () => LEVELS[game.level() - 1];
  game.stamps = () => { const o = {}; for (const pid in A.byPlace) { const jobs = A.byPlace[pid].filter((a) => a.cat === 'job'); if (jobs.length) o[pid] = jobs.every((j) => st.stars[j.id] > 0); } return o; };
  game.stampCount = () => Object.values(game.stamps()).filter(Boolean).length;
  // pul: game.addMoney(n, sabab) — boshqa tizimlar uni o'raydi (ish.js — telefon banki tarixi, hafta.js — hafta statistikasi); ichki chaqiruvlar ham o'ralgan nusxa orqali o'tadi
  game.addMoney = (n) => { st.money = Math.max(0, Math.round(st.money + n)); };
  const addMoney = (n, why) => game.addMoney(n, why);

  // --- tyuning ---
  game.applyUpgrades = () => {
    const u = st.up, d = game.damage;
    const dp = d ? car.dmgPower ?? 1 : 1;
    car.power = car.basePower * (1 + 0.28 * u.engine) * dp; car.fMax = car.baseFMax * (1 + 0.08 * u.engine) * Math.max(0.3, dp);
    car.grip = car.gripBase * (1 + 0.06 * u.tires) * Math.max(0.5, car.dmgGrip ?? 1); car.k = car.baseK * (1 + 0.1 * u.susp); car.maxComp = car.baseTravel * (1 + 0.08 * u.susp);
    car.brakeF = car.baseBrake * (1 + 0.2 * u.brake); car.nitroMul = 1.55 + 0.1 * u.nitro; car.extraRR = car.dmgDrag || 0; car.cdMul = car.dmgAero || 1;
    if (d) { d.armor = u.armor; d.landK = 1 - 0.2 * u.susp; d.enabled = st.set.damage !== false; }
  };
  // --- transportlar ---
  const models = {};
  game.setVehicle = (id, keep = true) => {
    const old = game.carModel, v = vehById[id] || vehById.jip; id = v.id;
    if (old) { st.veh.dmg[old.id] = game.damage.save(); game.fx.reattach(old.tilt); old.root.visible = false; }
    const m = models[id] || (models[id] = buildVehicle(id)); if (!m.root.parent) scene.add(m.root);
    const x = car.p[0], z = car.p[2], yaw = car.yaw;
    car.setSpec(v.spec); game.carModel = m; m.root.visible = true; m.tilt.rotation.z = 0; st.veh.cur = id;
    game.damage.bind(m); game.damage.load(st.veh.dmg[id]);
    const pid = st.veh.paint[id], pp = pid && PAINTS.find((q) => q.id === pid); m.paintMat.color.setHex(pp ? pp.hex : v.hex); st.paint = pid || null;
    if (m.rider) m.rider.visible = m.riderAlways || !(game.player && game.player.onFoot);
    game.applyUpgrades(); game.nitro = 1;
    if (keep) { car.place(x, z, yaw); game.prevP = car.p.slice(); }
    if (game.cam) game.cam.snap();
  };
  game.buyVehicle = (id) => { const v = vehById[id]; if (!v || st.veh.own.includes(id) || st.money < v.price) return false; addMoney(-v.price, 'Transport: ' + v.name); st.veh.own.push(id); game.audio.sfx('win'); game.banner('Yangi transport!', v.name, 'gold'); game.save(); return true; };
  game.setPaint = (id) => { const p = PAINTS.find((q) => q.id === id); if (p) { st.paint = id; st.veh.paint[st.veh.cur] = id; game.carModel.paintMat.color.setHex(p.hex); } };
  game.setVehicle(st.veh.cur, false);
  game.nitro = 1;

  // --- 3D belgilar ---
  const markers = [];
  const mkMarker = (x, z, hex, kind) => {
    const y = T.ground(x, z, 1e9).y; const grp = new THREE.Group(); grp.position.set(x, y, z);
    const mat = new THREE.MeshBasicMaterial({ color: hex, transparent: true, opacity: 0.9, fog: false });
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.9), mat); gem.position.y = 5.2; grp.add(gem);
    const ring = new THREE.Mesh(new THREE.RingGeometry(3.6, 4.2, 28).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: hex, transparent: true, opacity: 0.55, depthWrite: false })); ring.position.y = 0.12; grp.add(ring);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 60, 6, 1, true), new THREE.MeshBasicMaterial({ color: hex, transparent: true, opacity: 0.16, depthWrite: false, fog: false })); beam.position.y = 34; grp.add(beam);
    scene.add(grp); const m = { grp, gem, ring, x, z, y, kind, hex }; markers.push(m); return m;
  };
  game.points = []; // {x,z,kind,place,label}
  for (const id in site.places) {
    const p = site.places[id];
    if (p.board) { mkMarker(p.board.x, p.board.z, 0xffc83a, 'board'); game.points.push({ x: p.board.x, z: p.board.z, kind: 'board', place: id, r: 7.5 }); }
    if (p.garage) { mkMarker(p.garage.x, p.garage.z, 0x3aa0ff, 'garage'); game.points.push({ x: p.garage.x, z: p.garage.z, kind: 'garage', place: id, r: 6.5 }); }
    if (p.home && p.home.door) { mkMarker(p.home.door[0], p.home.door[1], 0x5fd38a, 'home'); game.points.push({ x: p.home.door[0], z: p.home.door[1], kind: 'home', place: id, r: 3.4 }); }
  }
  // maqsad mayog'i, nazorat darvozalari, yig'iladigan buyumlar
  const beacon = new THREE.Group();
  { const m1 = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 120, 10, 1, true), new THREE.MeshBasicMaterial({ color: 0xffe14a, transparent: true, opacity: 0.22, depthWrite: false, fog: false, side: THREE.DoubleSide })); m1.position.y = 60; beacon.add(m1);
    const m2 = new THREE.Mesh(new THREE.RingGeometry(12.6, 14, 44).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffe14a, transparent: true, opacity: 0.7, depthWrite: false })); m2.position.y = 0.15; beacon.add(m2); beacon.visible = false; scene.add(beacon); }
  const gates = [0, 1].map((i) => { const g = new THREE.Group(); const m = new THREE.Mesh(new THREE.TorusGeometry(7.5, 0.45, 8, 28), new THREE.MeshBasicMaterial({ color: i ? 0x8fd0ff : 0xffe14a, transparent: true, opacity: i ? 0.35 : 0.9, fog: false })); m.position.y = 6; g.add(m); g.visible = false; scene.add(g); return g; });
  const itemGeo = new THREE.IcosahedronGeometry(0.75, 1);
  const items = []; for (let i = 0; i < 14; i++) { const g = new THREE.Group(); const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false }); const m = new THREE.Mesh(itemGeo, mat); m.position.y = 1.6; g.add(m); const b = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 46, 6, 1, true), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.22, depthWrite: false, fog: false })); b.position.y = 24; g.add(b); g.visible = false; scene.add(g); items.push({ g, m, b, mat }); }

  // --- radarlar va tramplin belgilari (statik model) ---
  { const g = new GB(909); g.jit = 0.02;
    for (const a of A.acts) if (a.cat === 'radar') {
      const yaw = Math.atan2(a.tx, a.tz);
      g.push().translate(a.x, a.y, a.z).rotY(yaw);
      // start chizig'i yo'l yuzasiga yopishgan bo'laklar (yo'l chetidan chiqmaydi); ustunlar yerga tushadi
      const NS = Math.max(2, Math.round(a.hw * 2)), sw = (a.hw * 2 - 0.4) / NS;
      for (let k = 0; k < NS; k++) { const lx = -a.hw + 0.2 + (k + 0.5) * sw, gy = T.ground(a.x + a.tz * lx, a.z - a.tx * lx, a.y + 2).y - a.y; g.color(0xffffff).box(lx, gy + 0.025, 0, sw + 0.02, 0.03, 0.7); g.color(0xf0c030).box(lx, gy + 0.03, 0.6, sw + 0.02, 0.03, 0.25); }
      for (const sx of [-1, 1]) { const px = sx * (a.hw + 3.4), b = Math.min(0, T.gridHeight(a.x + a.tz * px, a.z - a.tx * px) - a.y) - 0.3; g.color(0x4a4e58).box(px, (b + 5.8) / 2, 0, 0.18, 5.8 - b, 0.18); g.color(0xf0c030).box(px, 5.0, 0, 0.7, 0.9, 0.6); g.color(0x202127).box(px, 5.0, 0.31, 0.4, 0.4, 0.05); }
      g.color(0x4a4e58).box(0, 5.8, 0, a.hw * 2 + 7, 0.16, 0.16);
      g.pop(); COL.addCircle(a.x + a.tz * (a.hw + 3.4), a.z - a.tx * (a.hw + 3.4), 0.25, a.y - 1, a.y + 5); COL.addCircle(a.x - a.tz * (a.hw + 3.4), a.z + a.tx * (a.hw + 3.4), 0.25, a.y - 1, a.y + 5);
    }
    const m = new THREE.Mesh(g.build(), MAT.flat); m.castShadow = true; scene.add(m); }

  // --- tangalar, sandiqlar, ta'mir qutilari ---
  const pick = { coins: [], chests: [], kits: [] };
  { const R = T.roads;
    for (const e of R.edges) for (let k = 14; k < e.count - 10; k += e.type === 0 ? 24 : 34) { const i = e.start + k; if (R.bridge[i]) continue; const off = ((k / 24) | 0) % 2 ? 1.9 : -1.9; pick.coins.push({ x: R.x[i] + R.tz[i] * off, z: R.z[i] - R.tx[i] * off, y: R.y[i] + 1.1 }); }
    const rg = mulberry32(4711);
    for (let c = 0; c < 46; c++) { for (let t = 0; t < 40; t++) { const x = (rg() - 0.5) * 5600, z = (rg() - 0.5) * 5600; const si = T.siteInfo(x, z); if (si.y < si.water + 1 || si.y < 2 || si.slope > 0.3 || si.roadD < 30) continue; for (let q = 0; q < 5; q++) { const a = q * 1.2566, px = x + Math.cos(a) * 5, pz = z + Math.sin(a) * 5; pick.coins.push({ x: px, z: pz, y: T.gridHeight(px, pz) + 1.1 }); } break; } }
    const spec = [[T.MOUNT.x + 14, T.MOUNT.z + 20], [1335, 2662], [2420, -640], [T.POND.x, T.POND.z], [-560, 590], [-1150, 60]];
    const boardAt = (x, z) => Object.values(game.site.places).some((p) => p.board && Math.hypot(p.board.x - x, p.board.z - z) < 4);
    for (const s of spec) { let x = s[0], z = s[1]; // belgilangan sandiq taxta oyog'i yoki jism ichida qolmasin — yaqin bo'sh joyga suriladi
      for (let k = 0; k < 24 && (boardAt(x, z) || COL.query(x, z, 1.4).some((o) => !o.dead && (o.t === 1 || Math.hypot(o.x - x, o.z - z) < o.r + 1.2))); k++) { const a = k * 2.4, d = 2 + k * 0.6; x = s[0] + Math.cos(a) * d; z = s[1] + Math.sin(a) * d; }
      pick.chests.push({ x, z, y: T.ground(x, z, 1e9).y }); }
    for (let t = 0; t < 4000 && pick.chests.length < 32; t++) { const x = (rg() - 0.5) * 5400, z = (rg() - 0.5) * 5400; const si = T.siteInfo(x, z); if (si.y < si.water + 1.5 || si.y < 2.5 || si.slope > 0.35 || si.roadD < 70) continue; if (COL.query(x, z, 3).length) continue; if (pick.chests.some((c) => Math.hypot(c.x - x, c.z - z) < 520)) continue; pick.chests.push({ x, z, y: si.y }); }
    // ta'mir qutisi: yo'l yoqasida, ustun/daraxt/devor ichida emas (yaqin bo'sh nuqta qidiriladi)
    const clear = (x, z, r) => !COL.query(x, z, r + 1).some((o) => { if (o.dead) return false; let qx = o.x, qz = o.z; if (o.t === 1) { const sx = o.x2 - o.x, sz = o.z2 - o.z, t = clamp(((x - o.x) * sx + (z - o.z) * sz) / (sx * sx + sz * sz || 1), 0, 1); qx = o.x + sx * t; qz = o.z + sz * t; } return Math.hypot(x - qx, z - qz) < (o.r || 0) + r; });
    for (const e of R.edges) { if (e.type !== 0) continue; for (let k = 60; k < e.count - 40; k += 330) { let best = null; for (const dk of [0, 2, -2, 4, -4, 7, -7]) { for (const sd of [1, -1]) { const i = e.start + k + dk; if (R.bridge[i]) continue; const off = (e.hw + 2.6) * sd, x = R.x[i] + R.tz[i] * off, z = R.z[i] - R.tx[i] * off; if (clear(x, z, 1.4) && T.gridHeight(x, z) > T.waterY(x, z) + 0.3) { best = [x, z]; break; } } if (best) break; }
      if (!best) { const i = e.start + k, off = e.hw + 2.6; best = [R.x[i] + R.tz[i] * off, R.z[i] - R.tx[i] * off]; } pick.kits.push({ x: best[0], z: best[1], y: T.gridHeight(best[0], best[1]) + 1.0, cd: 0 }); } }
  }
  const dummy = new THREE.Object3D();
  const mkInst = (gb, n, mat) => { const im = new THREE.InstancedMesh(gb.build(), mat || MAT.flat, n); im.frustumCulled = false; scene.add(im); return im; };
  { const g = new GB(1); g.jit = 0; g.color(0xffd23a); g.push().rotX(Math.PI / 2); g.cyl(14, 0.62, 0.62, -0.07, 0.07, { cap: true }); g.pop(); g.push().rotX(-Math.PI / 2); g.cyl(14, 0.62, 0.62, 0.069, 0.07, { cap: true }); g.pop(); g.color(0xfff0a0); g.box(0, 0, 0, 0.5, 0.5, 0.18);
    pick.coinIM = mkInst(g, pick.coins.length, new THREE.MeshLambertMaterial({ vertexColors: true, emissive: 0x6a4a00 })); }
  { const g = new GB(2); g.jit = 0.03; g.color(0x8a5a36).box(0, 0.45, 0, 1.5, 0.9, 1.0); g.color(0x6e4a30); g.push().translate(0, 0.9, 0); g.prismX(8, 0.5, 1.5); g.pop(); g.color(0xffd23a).box(0, 0.5, 0.52, 0.26, 0.32, 0.06); for (const sx of [-0.55, 0.55]) g.box(sx, 0.7, 0, 0.12, 1.45, 1.06);
    pick.chestIM = mkInst(g, pick.chests.length); pick.chestIM.castShadow = true; }
  { const g = new GB(3); g.jit = 0; g.color(0xf2f2f2).box(0, 0, 0, 1.0, 0.8, 0.8); g.color(0xe03a2a).box(0, 0, 0.41, 0.6, 0.16, 0.02); g.box(0, 0, 0.41, 0.16, 0.6, 0.02); g.box(0, 0, -0.41, 0.6, 0.16, 0.02); g.box(0, 0, -0.41, 0.16, 0.6, 0.02);
    pick.kitIM = mkInst(g, pick.kits.length, new THREE.MeshLambertMaterial({ vertexColors: true, emissive: 0x333333 })); }
  const coinSet = new Set(st.coins), chestSet = new Set(st.chests);
  const placeInst = (im, i, o, rot, s) => { dummy.position.set(o.x, o.y, o.z); dummy.rotation.set(0, rot, 0); dummy.scale.setScalar(s); dummy.updateMatrix(); im.setMatrixAt(i, dummy.matrix); };
  pick.chests.forEach((c, i) => placeInst(pick.chestIM, i, c, hash2(i, 7) * 6, chestSet.has(i) ? 0.001 : 1));
  game.pick = pick;
  game.coinTotal = pick.coins.length; game.chestTotal = pick.chests.length;

  // --- raqib mashinalar ---
  const rivals = [0x2f7fd0, 0xf0b83a, 0x3f9a58].map((hex, i) => { const m = buildVehicle('jip'); m.paintMat.color.setHex(hex); m.root.visible = false; m.root.remove(m.spot); m.root.remove(m.spot.target); scene.add(m.root); return { car: new Car(game.world), model: m, ap: null, active: false, fin: 0, name: ['Sardor', 'Malika', 'Bobur'][i] }; });
  game.rivals = rivals;

  // ================= CHELLENJ ISHGA TUSHIRISH =================
  let act = null; game.act = null;
  const starsFor = (a) => (a.cat === 'inf' ? 0 : st.stars[a.id] || 0);
  // Cheksiz tezkor buyurtma: har safar yangi manzil
  game.infJob = (pid) => { const others = Object.values(site.places).filter((q) => q.board && q.id !== pid && q.id !== 'muzkol' && q.id !== 'choqqi' && q.id !== 'vulqon'), from = site.places[pid]; const t = others[(Math.random() * others.length) | 0], d = Math.hypot(t.x - from.x, t.z - from.z); const kinds = [['del', 'Tezkor yetkazma', 'Posilkani'], ['frag', "Mo'rt posilka", "Mo'rt yukni"], ['taxi', 'Shoshilinch yo\'lovchi', "Yo'lovchini"]], k = kinds[(Math.random() * 3) | 0];
    return { id: 'inf', cat: 'inf', type: k[0], place: pid, order: 1, name: `♾ ${k[1]}`, desc: `${k[2]} ${t.name} manziliga eltib bering (${fmtDist(d)}).`, target: t.id, reward: Math.round(120 + d * 0.22), opt: {} }; };
  game.starsFor = starsFor;
  game.unlocked = (a) => {
    if (a.cat === 'job') { if (a.order === 1) return true; const prev = A.acts.find((q) => q.cat === 'job' && q.place === a.place && q.order === a.order - 1); return starsFor(prev) > 0; }
    if (a.opt && a.opt.final) return game.stampCount() >= 10;
    return true;
  };
  const racePath = (a) => {
    if (a.route.runway) { const rw = site.runway, pts = []; for (let x = rw.x0 + 30; x <= rw.x1 - 30; x += 6) pts.push([x, rw.z, rw.y]); return pts; }
    return a.route.edges ? T.pathByEdges(a.route.edges) : T.pathByNodes(a.route.nodes);
  };
  game.raceInfo = (a) => { if (!a._p) { a._p = racePath(a); a._len = pathLen(a._p); const t = a.opt && a.opt.track ? estimateTime(a._p, 25, 6) : estimateTime(a._p, a.route.runway ? 44 : 33); a._t = [t * 1.38, t * 1.17, t * 1.03]; } return a; };
  const targetOf = (pid) => { const p = site.places[pid]; return p.board ? { x: p.board.x, z: p.board.z, name: p.name } : { x: p.x, z: p.z, name: p.name }; };
  const setTarget = (t) => { act.tgt = t; if (t) { beacon.position.set(t.x, T.ground(t.x, t.z, 1e9).y, t.z); beacon.visible = true; game.setWaypoint(t.x, t.z, true); } else { beacon.visible = false; game.setWaypoint(null); } };

  game.startAct = (a) => {
    if (act) game.endAct(false, 'cancel');
    if (game.damage.wrecked) { game.toast("Avval transportni ta'mirlang!", 'bad'); return; }
    if (game.player.onFoot) game.live.mount(true);
    act = game.act = { def: a, t: 0, state: 'run', cargo: 100, comfort: 100, score: 0, combo: 1, count: 0, cpi: 0, dmg0: game.damage.total, lines: [], hourBak: null, stage: 0 };
    const p = car.p;
    if (a.type === 'del' || a.type === 'frag' || a.type === 'taxi' || a.type === 'multi') {
      act.stops = (a.type === 'multi' ? a.target : [a.target]).map(targetOf);
      let len = 0, cx = p[0], cz = p[2];
      for (const s of act.stops) { const r = T.route(cx, cz, s.x, s.z); len += r ? estimateTime(r.pts, 24, 6) + 6 : Math.hypot(s.x - cx, s.z - cz) / 12; cx = s.x; cz = s.z; }
      act.limit = Math.round((len * (a.type === 'taxi' || a.type === 'frag' ? 1.75 : 1.45) + 25) * (a.opt.tight || 1));
      setTarget(act.stops[0]);
    } else if (a.type === 'col') {
      const o = a.target; let c = site.places[a.place];
      if (o.runway) { const rw = site.runway; act.items = []; for (let i = 0; i < o.n; i++) act.items.push({ x: rw.x0 + 50 + i * ((rw.x1 - rw.x0 - 100) / (o.n - 1)), z: rw.z + (i % 3 - 1) * 8, y: rw.y }); }
      else act.items = scatterItems(c.x, c.z, o.r, o.n, a.id.length * 97 + a.name.length);
      act.left = act.items.length; act.limit = Math.round(80 + act.items.length * 30 + o.r * 0.2);
      act.items.forEach((it, i) => { const m = items[i]; m.g.position.set(it.x, it.y, it.z); m.g.visible = true; m.mat.color.setHex(ICON[o.icon] || 0xffffff); m.b.material.color.setHex(ICON[o.icon] || 0xffffff); it.m = m; });
      if (o.hour != null) { act.hourBak = game.hour; game.hour = o.hour; }
      game.setWaypoint(null);
    } else if (a.type === 'race') {
      game.raceInfo(a); const pts = a._p; act.path = pts; act.cps = [];
      let acc = 0; for (let i = 1; i < pts.length; i++) { acc += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); if (acc >= 240 && i < pts.length - 12) { act.cps.push(i); acc = 0; } }
      act.cps.push(pts.length - 1);
      const yaw = Math.atan2(pts[4][0] - pts[0][0], pts[4][1] - pts[0][1]);
      // birga poyga (onlayn): har o'yinchi start chizig'ida o'z joyida (2 qator), sun'iy raqiblar yo'q
      const cr = game.coopRace, gl = cr ? (cr.grid % 2 ? 2.7 : -2.7) : 0, gb = cr ? (cr.grid >> 1) * 8 : 0;
      car.place(pts[1][0] + Math.cos(yaw) * gl - Math.sin(yaw) * gb, pts[1][1] - Math.sin(yaw) * gl - Math.cos(yaw) * gb, yaw); game.prevP = car.p.slice(); game.cam.snap();
      // raqiblar
      const lx = Math.cos(yaw), lz = -Math.sin(yaw), fx = Math.sin(yaw), fz = Math.cos(yaw);
      const base = a.route.runway ? 41 : 31 + Math.min(4, st.up.engine) * 1.7;
      if (!cr) rivals.forEach((r, i) => {
        const off = (i % 2 ? 2.7 : -2.7), ahead = 8 + i * 6;
        const rp = pts.map((q) => [q[0], q[1]]);
        const gi = Math.min(pts.length - 2, 1 + Math.round(ahead / 4)), gq = pts[gi], gn = pts[gi + 1], gy = Math.atan2(gn[0] - gq[0], gn[1] - gq[1]);
        r.car.place(gq[0] + Math.cos(gy) * off, gq[1] - Math.sin(gy) * off, gy);
        r.ap = new Autopilot(rp, { maxSpeed: Math.max(base, Math.min(car.vTop * 0.9, 62)) * (0.9 + i * 0.055) }); r.ap.base0 = r.ap.maxSpeed; r.active = true; r.fin = 0; r.model.root.visible = true; r.car.power = Math.max(82000 * (1 + 0.2 * st.up.engine), car.power * 0.8 * 1500 / car.mass) * (0.92 + i * 0.07);
      });
      act.state = 'count'; act.count3 = 3.2; act.place = 1; game.setWaypoint(null);
      game.audio.sfx('start');
    } else if (a.type === 'drift' || a.type === 'smash') {
      act.limit = a.secs; if (a.type === 'smash') site.smash.restoreAll();
      game.setWaypoint(null);
    }
    game.banner(a.name, a.desc, 'start'); if (a.type !== 'race') game.audio.sfx('check');
    game.onActChange && game.onActChange();
  };

  game.endAct = (ok, why, stars = 0, info = '') => {
    if (!act) return; const a = act.def;
    beacon.visible = false; gates[0].visible = gates[1].visible = false; for (const m of items) m.g.visible = false;
    for (const r of rivals) { r.active = false; r.model.root.visible = false; }
    if (act.hourBak != null) game.hour = act.hourBak;
    game.setWaypoint(null);
    const prev = starsFor(a);
    let reward = 0;
    if (ok) {
      const mult = [0, 0.55, 0.8, 1][stars]; reward = Math.round(a.reward * mult * (a.cat === 'inf' ? 1 : prev >= stars ? 0.3 : 1));
      if (stars > prev && a.cat !== 'inf') st.stars[a.id] = stars; if (a.cat === 'inf') game.live.count('inf');
      addMoney(reward, 'Chellenj: ' + a.name); st.xp += stars * 45 + 20;
      game.audio.sfx(stars >= 3 ? 'win' : 'medal');
    } else if (why !== 'cancel') game.audio.sfx('fail');
    const res = { ok, why, stars, reward, info, def: a, time: act.t, prev };
    game.lastResult = res;
    act = game.act = null;
    if (why !== 'cancel') ui().result(res); else game.toast('Chellenj bekor qilindi');
    game.save(); game.onActChange && game.onActChange();
  };

  const starsByTime = (t, thr) => (t <= thr[2] ? 3 : t <= thr[1] ? 2 : t <= thr[0] ? 1 : 0);
  const starsByScore = (s, thr) => (s >= thr[2] ? 3 : s >= thr[1] ? 2 : s >= thr[0] ? 1 : 0);
  game.starsByScore = starsByScore;

  function updateAct(dt) {
    const a = act.def, p = car.p, sp = car.speed;
    if (act.state === 'count') {
      act.count3 -= dt; car.v[0] *= 0.8; car.v[2] *= 0.8;
      if (act.count3 <= 0) { act.state = 'run'; act.t = 0; }
      return;
    }
    act.t += dt;
    if (a.type === 'race') {
      const pts = act.path, ci = act.cps[act.cpi], cp = pts[ci];
      const nx = act.cps[act.cpi + 1];
      const place = (g, i) => { const q = pts[i], b = pts[Math.max(0, i - 3)]; g.position.set(q[0], T.ground(q[0], q[1], 1e9).y, q[1]); g.rotation.y = Math.atan2(q[0] - b[0], q[1] - b[1]); g.visible = true; };
      place(gates[0], ci); if (nx != null) place(gates[1], nx); else gates[1].visible = false;
      act.tgt = { x: cp[0], z: cp[1] };
      if (Math.hypot(p[0] - cp[0], p[2] - cp[1]) < 13) {
        act.cpi++; game.audio.sfx('check');
        if (act.cpi >= act.cps.length) { const pos = game.coopRace ? 1 + (game.coopRace.done || 0) : 1 + rivals.filter((r) => r.fin).length; const s = starsByTime(act.t, a._t); const tm = fmtTime(act.t); const key = a.id; if (!st.best[key] || act.t < st.best[key]) st.best[key] = +act.t.toFixed(2); game.endAct(s > 0, s > 0 ? 'done' : 'slow', s, `Vaqt: ${tm} · ${pos}-o'rin`); return; }
      }
      // o'rin: raqiblarning marshrutdagi indeksi bilan solishtirish
      let my = 0, bd = 1e18; const lo = act.cpi ? act.cps[act.cpi - 1] : 0; for (let i = Math.max(0, lo - 5); i <= Math.min(pts.length - 1, ci + 5); i++) { const d = (pts[i][0] - p[0]) ** 2 + (pts[i][1] - p[2]) ** 2; if (d < bd) { bd = d; my = i; } }
      act.place = game.coopRace ? game.coopRace.place || 1 : 1 + rivals.filter((r) => r.active && (r.fin || r.ap.i > my)).length; act.my = my;
      act.lines = [`Nazorat: ${act.cpi}/${act.cps.length}`, `O'rin: ${act.place}/${game.coopRace ? game.coopRace.n : 4}`, `Oltin: ${fmtTime(a._t[2])}`];
      act.timer = act.t; return;
    }
    act.timer = act.limit - act.t;
    if (act.timer <= 0) {
      if (a.type === 'drift' || a.type === 'smash') { const sc = a.type === 'drift' ? Math.round(act.score) : act.count; const s = starsByScore(sc, a.thr); if (!st.best[a.id] || sc > st.best[a.id]) st.best[a.id] = sc; game.endAct(s > 0, s > 0 ? 'done' : 'low', s, a.type === 'drift' ? `Ochko: ${sc}` : `Sindirildi: ${sc} ta`); }
      else game.endAct(false, 'time');
      return;
    }
    if (act.timer < 10 && Math.floor(act.timer) !== Math.floor(act.timer + dt)) game.audio.sfx('tick');
    if (a.type === 'del' || a.type === 'frag' || a.type === 'taxi' || a.type === 'multi') {
      const t = act.tgt; const d = Math.hypot(p[0] - t.x, p[2] - t.z);
      if (a.type === 'taxi') { let calm = true; if (car.onGround >= 2 && sp > 8) { const g = Math.abs(car.w[1]) * sp / 9.81; if (g > 0.72) { act.comfort -= (g - 0.72) * 16 * dt; calm = false; } } if (car.airTime > 0.3) { act.comfort -= 16 * dt; calm = false; } if (calm) act.comfort = Math.min(100, act.comfort + 1.2 * dt); act.comfort = Math.max(0, act.comfort); if (act.comfort <= 0) { game.endAct(false, 'comfort'); return; } }
      if (a.type === 'frag' && act.cargo <= 0) { game.endAct(false, 'cargo'); return; }
      act.lines = [`Manzil: ${t.name}`, `Masofa: ${fmtDist(game.gpsDist != null ? game.gpsDist : d)}`];
      if (a.type === 'frag') act.bar = { label: 'Yuk', v: act.cargo / 100 }; else if (a.type === 'taxi') act.bar = { label: 'Qulaylik', v: act.comfort / 100 };
      if (d < 14 && sp < 12) {
        act.stage++; game.audio.sfx('check');
        if (act.stage >= act.stops.length) {
          let s; if (a.type === 'frag') s = act.cargo >= 82 ? 3 : act.cargo >= 45 ? 2 : 1; else if (a.type === 'taxi') s = act.comfort >= 75 ? 3 : act.comfort >= 40 ? 2 : 1; else { const f = act.timer / act.limit; s = f >= 0.3 ? 3 : f >= 0.12 ? 2 : 1; }
          game.endAct(true, 'done', s, a.type === 'frag' ? `Yuk holati: ${Math.round(act.cargo)}%` : a.type === 'taxi' ? `Qulaylik: ${Math.round(act.comfort)}%` : `Qolgan vaqt: ${fmtTime(act.timer)}`);
        } else { setTarget(act.stops[act.stage]); game.toast(`Yetkazildi! Keyingi manzil: ${act.stops[act.stage].name}`, 'good'); }
      }
    } else if (a.type === 'col') {
      let near = null, nd = 1e9;
      for (const it of act.items) { if (it.got) continue; const d = Math.hypot(p[0] - it.x, p[2] - it.z); if (d < nd) { nd = d; near = it; } it.m.m.position.y = 1.6 + Math.sin(game.time * 3 + it.x) * 0.3; it.m.m.rotation.y += dt * 2;
        if (d < 4.2) { it.got = true; it.m.g.visible = false; act.left--; game.audio.sfx('coin'); game.fx.burst(10, it.x, it.y + 1.2, it.z, 4, 0.6, 0.5, 0xffe14a, 0.9, 1, 3); } }
      act.tgt = near; act.lines = [`Topildi: ${act.items.length - act.left}/${act.items.length}`, near ? `Eng yaqini: ${fmtDist(nd)}` : ''];
      if (act.left <= 0) { const f = act.timer / act.limit; game.endAct(true, 'done', f >= 0.35 ? 3 : f >= 0.15 ? 2 : 1, `Qolgan vaqt: ${fmtTime(act.timer)}`); }
    } else if (a.type === 'drift') {
      const sa = Math.abs(car.slipAng || 0) * 57.3;
      if (sa > 14 && sp > 7 && car.onGround >= 2) { act.combo = Math.min(5, act.combo + dt * 0.5); act.score += sa * sp * dt * 0.35 * act.combo; act.drifting = true; } else { act.drifting = false; act.combo = Math.max(1, act.combo - dt * 1.5); }
      const pl = site.places[a.place]; if (Math.hypot(p[0] - pl.x, p[2] - pl.z) > pl.r + 160) { game.endAct(false, 'left'); return; }
      act.lines = [`Ochko: ${Math.round(act.score)}`, `Kombo: x${act.combo.toFixed(1)}`, `★ ${a.thr[0]} · ★★ ${a.thr[1]} · ★★★ ${a.thr[2]}`];
    } else if (a.type === 'smash') {
      act.lines = [`Sindirildi: ${act.count}`, `★ ${a.thr[0]} · ★★ ${a.thr[1]} · ★★★ ${a.thr[2]}`];
    }
  }

  // --- GPS ---
  game.way = null; game.gpsDist = null; game.routePts = null; let routeT = 0;
  game.setWaypoint = (x, z, auto) => { if (x == null) { game.way = null; game.routePts = null; game.gpsDist = null; return; } game.way = { x, z, auto }; routeT = 0; };

  // --- radar va sakrash holati ---
  const radars = A.acts.filter((q) => q.cat === 'radar'), jumps = A.acts.filter((q) => q.cat === 'jump');
  for (const r of radars) r._s = 0;
  let air = null, lastGround = [car.p[0], car.p[2]];
  const award = (a, stars, text) => {
    const prev = starsFor(a);
    if (stars > prev) { st.stars[a.id] = stars; const rw = Math.round(a.reward * (stars - prev) / 3); addMoney(rw, a.cat === 'radar' ? 'Radar' : 'Tramplin'); st.xp += (stars - prev) * 30; game.toast(`${text} ${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}  +${rw} so'm`, 'gold'); game.audio.sfx('medal'); game.save(); }
    else game.toast(`${text} ${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}`, stars ? 'good' : '');
  };

  // --- manzil ---
  let curPlace = null; game.curPlace = null;
  game.nearPoint = null;
  let saveT = 0, kitT = 0;

  game.onWreck = () => { game.banner('Motor ishdan chiqdi!', 'Transport yurmaydi. [T] — evakuator ustaxonaga olib boradi', 'bad'); game.audio.sfx('fail'); if (act) game.endAct(false, 'wreck'); };
  game.tow = () => {
    let best = null, bd = 1e18; for (const pt of game.points) if (pt.kind === 'garage') { const d = Math.hypot(pt.x - car.p[0], pt.z - car.p[2]); if (d < bd) { bd = d; best = pt; } }
    const fee = Math.min(st.money, 200); addMoney(-fee, 'Evakuator'); game.damage.repair(100); car.place(best.x, best.z, 0); game.prevP = car.p.slice(); if (game.player.onFoot) game.live.mount(false); game.cam.snap();
    game.toast(`Evakuator sizni ustaxonaga olib keldi va ta'mirlandi. To'lov: ${fee} so'm`, 'good'); game.audio.sfx('repair'); game.save();
  };
  game.respawn = (msg) => { const c = car; const nr = T.nearestRoad(c.p[0], c.p[2], 12); if (nr.edge >= 0) { const i = nr.i; c.place(T.roads.x[i], T.roads.z[i], Math.atan2(T.roads.tx[i], T.roads.tz[i])); } else { const h = site.places.bogiston; c.place(h.x + 20, h.z + 8, 0); } game.prevP = c.p.slice(); game.cam.snap(); if (msg) game.toast(msg, 'bad'); };

  function handleEvents() {
    const ev = car.events, fx = game.fx, R = car.R, p = car.p;
    for (let i = 0; i < ev.length; i++) {
      const e = ev[i];
      if (e.type === 'hit' || e.type === 'crash') {
        let lx = 0, ly = 0, lz = 1.9;
        if (e.type === 'hit') { const dx = e.x - p[0], dz = e.z - p[2]; lx = dx * R[0] + dz * R[6]; lz = dx * R[2] + dz * R[8]; ly = 0.1; } else { lz = (car.fwd >= 0 ? 0.9 : -0.9) * car.spec.len / 2; ly = -0.2; }
        const d = game.damage.hit(e.v, lx, ly, lz, 'hit'); drift.s = 0;
        if (car.bike && e.v > 6.5 && !game.player.onFoot && !game.godMode) game.live.fall();
        game.audio.sfx(e.v > 9 ? 'crash' : 'hit', clamp(e.v / 12, 0.3, 1)); game.cam.shake = Math.min(1.2, e.v * 0.05);
        if (e.x != null) fx.burst(8, e.x, p[1], e.z, 5, 0.4, 0.3, 0xffd080, 1, 1, 9, 0);
        if (d > 0) { st.stats.crashes++; if (d > 14) fx.debris(d > 35 ? 9 : 4, p[0] + R[2] * lz, p[1], p[2] + R[8] * lz, [0x2b2d33, 0x9aa0aa, game.carModel.paintMat.color.getHex(), 0x1e3246], 6, 0.24, car.v[0], car.v[2]); if (d > 30) fx.burst(14, p[0] + R[2] * lz, p[1] + 0.4, p[2] + R[8] * lz, 6, 0.5, 0.25, 0xffe0a0, 1, 1, 8, 0); }
        if (act) { if (act.def.type === 'frag') act.cargo = Math.max(0, act.cargo - Math.max(3, e.v * 2.2)); if (act.def.type === 'taxi') act.comfort = Math.max(0, act.comfort - Math.max(4, e.v * 2)); }
      } else if (e.type === 'land') {
        game.audio.sfx('land', clamp(e.v / 9, 0.3, 1)); game.cam.shake = Math.min(1, e.v * 0.05);
        const d = game.damage.hit(e.v * (game.damage.landK || 1), 0, -0.3, 0, 'land');
        if (act && act.def.type === 'frag') act.cargo = Math.max(0, act.cargo - Math.max(0, (e.v - 4) * 4));
      } else if (e.type === 'smash') {
        const ref = e.ref; if (ref) { site.smash.hide(ref); const cols = { crate: [0xc79a66, 0x9a6a42], barrel: [0xb8402e, 0x4a4e58], hay: [0xe2c460, 0xd0b050], cone: [0xf26a2a, 0xffffff], sign: [0xf2ead8, 0x6e4a30], fence: [0x9a6a42, 0x6e4a30], snowman: [0xf6f9ff, 0xf08a2a] }[ref.type]; fx.debris(ref.type === 'cone' ? 3 : 7, ref.x, ref.y, ref.z, cols, 6, ref.type === 'hay' ? 0.5 : 0.36, car.v[0], car.v[2]); }
        game.audio.sfx('smash'); st.stats.smashed++; addMoney(3, 'Sindirish'); game.live.count('smash'); if (act && act.def.type === 'smash') act.count++;
        if (act && act.def.type === 'frag') act.cargo = Math.max(0, act.cargo - 4);
      } else if (e.type === 'splash') { game.audio.sfx('splash'); }
      else if (e.type === 'sunk') { game.damage.engine = Math.max(0, game.damage.engine - 12); game.damage.apply(); game.respawn('Suvga botdingiz! Dvigatelga suv kirdi.'); if (act && act.def.type !== 'race') game.endAct(false, 'sunk'); }
      else if (e.type === 'flip') game.toast("Mashina to'g'rilandi");
    }
    ev.length = 0;
  }
  const DUST = [0xb79d7a, 0x8fb86a, 0xe2c88a, 0xf4f7fc, 0xb08a70, 0xa88052, 0xd8f0ff, 0xdff2fb, 0x8a8c94];
  const dustColor = (s) => DUST[s] || 0xb79d7a;

  let dustT = 0, weatherT = 0; const drift = { s: 0, t: 0 }; let kmAcc = 0;
  function effects(dt) {
    const fx = game.fx, sp = car.speed;
    // g'ildirak changi, izlar, suv sachratqisi, nitro alangasi — fx.js o'zi (fx.vehicle) chizadi
    // ob-havo: qor, gulbarg, kuzgi barglar
    weatherT -= dt;
    if (weatherT <= 0) {
      weatherT = 0.05; const cp = game.camera.position, bio = T.biomeAt(cp.x, cp.z);
      const n = bio === T.BIOME.SNOW ? 5 : bio === T.BIOME.SAKURA || bio === T.BIOME.AUTUMN ? 2 : bio === T.BIOME.DESERT && sp > 10 ? 1 : 0;
      for (let i = 0; i < n; i++) {
        const x = cp.x + (Math.random() - 0.5) * 70 + car.v[0] * 1.2, z = cp.z + (Math.random() - 0.5) * 70 + car.v[2] * 1.2, y = cp.y + 4 + Math.random() * 14;
        if (bio === T.BIOME.SNOW) fx.emit(x, y, z, 1.5, -2.2 - Math.random(), 0.6, 5, 0.32, 0xffffff, 0.9, 0, 0, 0);
        else if (bio === T.BIOME.SAKURA) fx.emit(x, y, z, 1.2, -1.1, 0.4, 7, 0.34, Math.random() < 0.5 ? 0xffb8d0 : 0xffd8e4, 0.9, 0, 0, 0);
        else if (bio === T.BIOME.AUTUMN) fx.emit(x, y, z, 1.4, -1.3, 0.5, 6, 0.36, [0xe8872e, 0xd9532b, 0xf0b63a][(Math.random() * 3) | 0], 0.9, 0, 0, 0);
        else fx.emit(x, cp.y - 1 + Math.random() * 3, z, 5, 0.2, 1, 3, 0.7, 0xe2c88a, 0.25, 1, 0, 0);
      }
      if (game.sky.night > 0.6 && (bio === T.BIOME.MEADOW || bio === T.BIOME.SAKURA || bio === T.BIOME.TAIGA || bio === T.BIOME.AUTUMN) && Math.random() < 0.5) { const fp = game.player.onFoot ? game.player.p : car.p, x = fp[0] + (Math.random() - 0.5) * 50, z = fp[2] + (Math.random() - 0.5) * 50; fx.emit(x, T.gridHeight(x, z) + 0.4 + Math.random() * 1.6, z, (Math.random() - 0.5) * 0.5, 0.12, (Math.random() - 0.5) * 0.5, 3.5, 0.2, 0xe8ff7a, 1, 0, 0, 0); }
      if (site.fires) for (const f of site.fires) { if (Math.abs(f.x - cp.x) < 120 && Math.abs(f.z - cp.z) < 120) { fx.emit(f.x + (Math.random() - 0.5) * 0.5, f.y + 0.4, f.z + (Math.random() - 0.5) * 0.5, (Math.random() - 0.5) * 0.4, 1.6 + Math.random(), (Math.random() - 0.5) * 0.4, 0.6, 0.8, Math.random() < 0.5 ? 0xff8a20 : 0xffd040, 0.95, -0.5, -1.5, 0.3); if (Math.random() < 0.25) fx.emit(f.x, f.y + 1.6, f.z, 0.3, 1.4, 0.2, 3, 0.9, 0x8a8a90, 0.25, 2.5, -0.3, 0.2); } }
    }
  }

  // ================= HAR KADR =================
  game.updateGame = (dt) => {
    const pl = game.player, foot = pl.onFoot, p = foot ? pl.p : car.p, sp = foot ? pl.speed : car.speed, kmh = sp * 3.6;
    handleEvents();
    game.damage.update(dt, !foot);
    effects(dt);
    // nitro
    if (car.nitroOn) game.nitro = Math.max(0, game.nitro - dt * (0.3 - 0.045 * st.up.nitro)); else game.nitro = Math.min(1, game.nitro + dt * (0.05 + 0.02 * st.up.nitro));
    // statistika
    st.stats.time += dt; const dd = Math.hypot(p[0] - lastGround[0], p[2] - lastGround[1]); if (dd < 30 && !(game.coop && game.coop.ride)) { if (foot) st.stats.walk += dd; else st.stats.dist += dd; kmAcc += dd; if (kmAcc >= 1000) { kmAcc -= 1000; game.live.count('km'); } } else air = null; lastGround[0] = p[0]; lastGround[1] = p[2];
    if (!foot && kmh > st.stats.top) st.stats.top = Math.round(kmh);
    // sakrash: uzun sakrash uchun tanga
    if (foot) air = null;
    else if (car.onGround === 0) { if (!air) { air = { x: p[0], z: p[2], t: 0, ramp: null }; for (const j of jumps) if (Math.hypot(j.x - p[0], j.z - p[2]) < 13) air.ramp = j; } air.t += dt; }
    else if (air && car.onGround >= 2) { const d = Math.hypot(p[0] - air.x, p[2] - air.z); if (air.t > 0.45) { if (d > st.stats.jump) st.stats.jump = Math.round(d); st.stats.air += air.t;
        const coins = d > 10 ? Math.min(220, Math.round(d * 1.6 + air.t * 12)) : 0; if (coins) { addMoney(coins, 'Sakrash'); st.xp += 4; game.audio.sfx('coin'); } if (d >= 15) game.live.count('jump');
        if (air.ramp) { if (!st.best[air.ramp.id] || d > st.best[air.ramp.id]) st.best[air.ramp.id] = Math.round(d); if (game.onFeat) game.onFeat(air.ramp, d); award(air.ramp, starsByScore(d, air.ramp.thr), `Sakrash: ${d.toFixed(0)} m · +${coins} so'm`); } else if (coins) game.toast(`Sakrash: ${d.toFixed(0)} m · havoda ${air.t.toFixed(1)} s · +${coins} so'm`, 'gold'); } air = null; }
    // erkin drift: sirpanish burchagi va tezlik uchun ochko, tugaganda tanga
    if (!foot && !(act && act.def.type === 'drift')) { const sa = Math.abs(car.slipAng || 0) * 57.3;
      if (sa > 16 && sp > 8 && car.onGround >= 2 && car.fwd > 2) { drift.s += sa * sp * dt; drift.t = 0.8; game.driftScore = drift.s; }
      else if (drift.t > 0) { drift.t -= dt; if (drift.t <= 0) { if (drift.s > 300) { const rw = Math.min(320, Math.round(drift.s / 24)); addMoney(rw, 'Drift'); st.stats.drift += Math.round(drift.s); st.xp += 3; game.audio.sfx('coin'); game.live.count('driftc', rw); game.toast(`Drift! ${Math.round(drift.s)} ochko · +${rw} so'm`, 'gold'); } drift.s = 0; game.driftScore = 0; } } }
    // radarlar
    if (!foot) for (const r of radars) { const dx = p[0] - r.x, dz = p[2] - r.z; if (dx * dx + dz * dz > 900) { r._s = 0; continue; } const along = dx * r.tx + dz * r.tz, lat = Math.abs(dx * r.tz - dz * r.tx); const s = along > 0 ? 1 : -1; if (r._s && s !== r._s && lat < r.hw + 2.5) { const v = Math.round(kmh); const nb = !st.best[r.id] || v > st.best[r.id]; if (nb) st.best[r.id] = v; if (game.onFeat) game.onFeat(r, v); const rs = starsByScore(v, r.thr); if (rs > 0 || (nb && v >= r.thr[0] * 0.75)) award(r, rs, `📸 ${r.name}: ${v} km/soat`); } r._s = s; }
    // tangalar va sandiqlar
    { const im = pick.coinIM, cs = pick.coins, t = game.time; let ch = false;
      for (let i = 0; i < cs.length; i++) { const c = cs[i]; if (coinSet.has(i)) { if (!c.h) { c.h = true; placeInst(im, i, c, 0, 0.001); ch = true; } continue; } const dx = c.x - p[0], dz = c.z - p[2]; if (dx > 260 || dx < -260 || dz > 260 || dz < -260) continue;
        if (dx * dx + dz * dz < 6.5 && Math.abs(c.y - p[1]) < 3.5) { coinSet.add(i); st.coins.push(i); addMoney(15, 'Tanga'); st.xp += 2; game.live.count('coin'); game.audio.sfx('coin'); game.fx.burst(6, c.x, c.y, c.z, 3, 0.4, 0.4, 0xffe14a, 1, 1, 3, 0); continue; }
        placeInst(im, i, c, t * 2.4 + i, 1); ch = true; }
      if (ch) im.instanceMatrix.needsUpdate = true;
      pick.chests.forEach((c, i) => { if (chestSet.has(i)) return; if (Math.abs(c.x - p[0]) < 3.6 && Math.abs(c.z - p[2]) < 3.6) { chestSet.add(i); st.chests.push(i); placeInst(pick.chestIM, i, c, 0, 0.001); pick.chestIM.instanceMatrix.needsUpdate = true; addMoney(350, 'Sandiq'); st.xp += 40; game.audio.sfx('medal'); game.fx.burst(24, c.x, c.y + 1, c.z, 6, 0.9, 0.6, 0xffe14a, 1, 1.5, 6, 0); game.banner('Yashirin sandiq topildi!', `+350 so'm · ${st.chests.length}/${pick.chests.length}`, 'gold'); game.save(); } });
      kitT += dt; let kc = false;
      pick.kits.forEach((k, i) => { if (k.cd > 0) { k.cd -= dt; if (k.cd <= 0) kc = true; else return; } const near = Math.abs(k.x - p[0]) < 220 && Math.abs(k.z - p[2]) < 220; if (near || kc) { placeInst(pick.kitIM, i, k, game.time * 1.5 + i, 1); kc = true; }
        if (!foot && Math.abs(k.x - p[0]) < 3.2 && Math.abs(k.z - p[2]) < 3.2 && game.damage.health < 96) { k.cd = 150; placeInst(pick.kitIM, i, k, 0, 0.001); kc = true; game.damage.repair(40); const ti = game.damage.tires.indexOf(1); if (ti >= 0) game.damage.tires[ti] = 0; game.damage.apply(); game.audio.sfx('repair'); game.toast("Ta'mir qutisi: +40% ta'mir", 'good'); } });
      if (kc) pick.kitIM.instanceMatrix.needsUpdate = true; }
    // lava
    if (site.lava && foot) { const l = site.lava; if (Math.hypot(p[0] - l.x, p[2] - l.z) < l.r && p[1] < l.y + 1.2) { const v = site.places.vulqon; pl.place(v.x + 4, v.z + 4, 0); st.sat = Math.max(30, st.sat - 25); game.toast('Lava juda issiq! Zo\'rg\'a qochib chiqdingiz', 'bad'); game.audio.sfx('fail'); } }
    else if (site.lava) { const l = site.lava; if (Math.hypot(p[0] - l.x, p[2] - l.z) < l.r && p[1] < l.y + 2.2) { game.damage.engine = Math.max(0, game.damage.engine - 30); game.damage.zone.front = Math.max(0, game.damage.zone.front - 25); game.damage.apply(); game.fx.burst(30, p[0], p[1], p[2], 8, 1, 1.2, 0xff7a20, 1, 2, 4, 1); const v = site.places.vulqon; car.place(v.x, v.z, 0); game.prevP = car.p.slice(); game.cam.snap(); game.toast('Lavaga tushdingiz! Mashina kuydi.', 'bad'); game.audio.sfx('crash'); if (game.damage.engine <= 0 && !game.damage.wrecked) { game.damage.wrecked = true; game.onWreck(); } } }
    // manzilni aniqlash
    let np = null; for (const id in site.places) { const pl = site.places[id]; const d = Math.hypot(p[0] - pl.x, p[2] - pl.z); if (d < pl.r) { np = pl; break; } }
    if (np !== curPlace) { curPlace = game.curPlace = np; if (np) { if (!st.places[np.id]) { st.places[np.id] = 1; addMoney(150, 'Yangi manzil'); st.xp += 60; game.banner(np.id === 'uy' ? 'Bu — sizning uyingiz!' : 'Yangi manzil ochildi', `${np.name} · +150 so'm`, 'gold'); game.audio.sfx('medal'); game.save(); } else game.banner(np.name, '', 'place'); } }
    game.region = REGION[T.biomeAt(p[0], p[2])];
    // yaqin nuqta (E)
    let nearPt = null; if (!act || act.def.type !== 'race') for (const pt of game.points) { if (Math.abs(pt.x - p[0]) < pt.r && Math.abs(pt.z - p[2]) < pt.r && sp < 4.5) { nearPt = pt; break; } }
    game.nearPoint = nearPt;
    // belgilar animatsiyasi
    for (const m of markers) { const d2 = (m.x - p[0]) ** 2 + (m.z - p[2]) ** 2; const vis = d2 < 520 * 520 && !(act && act.def.type === 'race'); m.grp.visible = vis; if (vis) { m.gem.rotation.y += dt * 1.6; m.gem.position.y = 5.2 + Math.sin(game.time * 2 + m.x) * 0.35; } }
    // raqiblar
    for (const r of rivals) { if (!r.active) continue; const c = r.car; const inp = act && act.state === 'count' ? HOLD : r.fin ? (c.fwd > 2 ? { brake: 1 } : HOLD) : r.ap.input(c);
      // rezina effekti: orqada qolsa tezlashadi
      if (act && act.path && !r.fin) { const gap = Math.hypot(c.p[0] - p[0], c.p[2] - p[2]); const behind = r.ap.i < (act.cpi ? act.cps[act.cpi - 1] : 0); r.ap.maxSpeed += ((behind && gap > 60 ? 1.12 : !behind && gap > 90 ? 0.9 : 1) * r.ap.base0 - r.ap.maxSpeed) * dt; }
      for (let k = 0; k < game.subN; k++) c.step(1 / 120, inp); c.events.length = 0;
      if (r.ap.done && !r.fin && act) { r.fin = act.t; game.toast(`${r.name} marraga yetdi`, ''); }
      const m = r.model; m.root.position.set(c.p[0], c.p[1], c.p[2]); m.root.quaternion.set(c.q[0], c.q[1], c.q[2], c.q[3]); syncWheels(m, c);
      // mashinalar to'qnashuvi (oddiy doiralar)
      const dx = c.p[0] - p[0], dz = c.p[2] - p[2], d = Math.hypot(dx, dz);
      if (d < 2.7 && d > 0.01 && Math.abs(c.p[1] - p[1]) < 2) { const nx = dx / d, nz = dz / d, pen = (2.7 - d) / 2; c.p[0] += nx * pen; c.p[2] += nz * pen; p[0] -= nx * pen; p[2] -= nz * pen; const rv = (c.v[0] - car.v[0]) * nx + (c.v[2] - car.v[2]) * nz; if (rv < 0) { const j = -rv * 0.6; c.v[0] += nx * j; c.v[2] += nz * j; car.v[0] -= nx * j; car.v[2] -= nz * j; if (-rv > 4) { game.audio.sfx('hit', 0.6); game.damage.hit(-rv * 0.7, (nx * car.R[0] + nz * car.R[6]) * car.spec.wid, 0, (nx * car.R[2] + nz * car.R[8]) * car.spec.len / 2); } } }
    }
    if (act) updateAct(dt);
    game.live.update(dt);
    // GPS marshruti
    if (game.way) { routeT -= dt; if (routeT <= 0) { routeT = 1.5; const r = T.route(p[0], p[2], game.way.x, game.way.z); if (r && r.pts.length > 1) { game.routePts = r.pts; game.gpsDist = r.len + Math.hypot(r.pts[r.pts.length - 1][0] - game.way.x, r.pts[r.pts.length - 1][1] - game.way.z); } else { game.routePts = null; game.gpsDist = Math.hypot(p[0] - game.way.x, p[2] - game.way.z); } }
      if (!game.way.auto && Math.hypot(p[0] - game.way.x, p[2] - game.way.z) < 14) { game.setWaypoint(null); game.toast('Belgilangan nuqtaga yetdingiz', 'good'); } }
    saveT += dt; if (saveT > 20) { saveT = 0; game.save(); }
  };
  for (const r of rivals) r.ap = null;
}

export function fmtTime(t) { t = Math.max(0, t); const m = Math.floor(t / 60), s = t - m * 60; return `${m}:${s < 10 ? '0' : ''}${s.toFixed(1)}`; }
export function fmtDist(d) { return d >= 1000 ? (d / 1000).toFixed(1) + ' km' : Math.round(d) + ' m'; }
