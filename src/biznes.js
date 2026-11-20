// O'z biznesingiz: do'kon, kiyim do'koni yoki choyxonani sotib olish — o'yin vaqtida daromad (kassa yoki avto-bank), tovar, ishchilar, daraja, reklama; mijozlar ko'payadi
import * as THREE from 'three';
import * as T from './terrain.js';
import { GB, MAT } from './geo.js';
import { glowMat, withMask } from './details.js';
import { makeRig, poseRig, setTool } from './rig.js';
import { clamp, angDiff } from './util.js';

const som = (n) => Math.round(n).toLocaleString('ru-RU');
const hm = (h) => { h = ((h % 24) + 24) % 24; const a = Math.floor(h), m = Math.floor((h - a) * 60); return `${a < 10 ? '0' : ''}${a}:${m < 10 ? '0' : ''}${m}`; };
// id, nom, belgi, narx, asosiy daromad (so'm/o'yin soati), xodim, tavsif, ish vaqti egri chizig'i
export const BIZ = [
  { id: 'dokon', name: "Bog'iston do'koni", ic: '🛒', price: 12000, base: 40, keeper: 'Hamid aka', desc: "Non, suv, sharbat va kanistr sotiladi. Kun bo'yi xaridor bor, kechqurun ko'proq.", busy: (h) => (h < 6 ? 0.1 : h < 9 ? 0.8 : h < 18 ? 1 : h < 22 ? 1.3 : 0.4) },
  { id: 'kiyim', name: "Kiyim do'koni", ic: '👕', price: 16000, base: 55, keeper: 'Nilufar', desc: "Ko'ylak, shim va bosh kiyimlar. Kunduzi gavjum, tunda yopiq.", busy: (h) => (h < 8 ? 0.05 : h < 10 ? 0.6 : h < 19 ? 1.15 : h < 21 ? 0.7 : 0.05) },
  { id: 'choyxona', name: 'Choyxona', ic: '🍵', price: 22000, base: 75, keeper: 'Sobir aka', desc: "Osh, somsa, lag'mon va choy. Tushlik va kechki payt odam ko'p.", busy: (h) => (h < 6 ? 0.15 : h < 11 ? 0.7 : h < 14.5 ? 1.6 : h < 18 ? 0.9 : h < 22 ? 1.4 : 0.5) },
];
export const BIZ_LVL = [1, 1.5, 2.1, 2.8, 3.6]; // daraja bo'yicha savdo ko'paytmasi
const UP_COST = [0, 0.3, 0.45, 0.65, 0.9]; // keyingi daraja narxi (biznes narxiga nisbatan)
const LVL_NAME = ['Kichik', "O'rtacha", 'Mashhur', 'Gavjum', 'Orolda eng zo\'r'];
const MAX_STAFF = 3, AUTO_FEE = 0.05;

export function initBiznes(game) {
  const { scene } = game, st = game.state, pl = game.player, L = game.live, HY = game.hayot, H2 = game.hayot2, IN = game.interior, PH = game.phone, K = game.kun;
  const B = { list: BIZ, sites: {}, pool: [], shopPid: null }; game.biznes = B;
  const toast = (m, k) => game.toast(m, k), sfx = (n, k) => game.audio.sfx(n, k);
  st.biz = st.biz || {};
  const def = (id) => BIZ.find((q) => q.id === id), own = (id) => st.biz[id] && st.biz[id].lvl > 0;
  B.own = own; B.def = def;

  // ================= HISOB-KITOB =================
  const mul = (s) => BIZ_LVL[s.lvl - 1] * (1 + 0.35 * s.staff);
  B.rate = (id, h = game.hour) => { const s = st.biz[id], d = def(id); if (!own(id)) return 0; return d.base * mul(s) * d.busy(h) * (s.stock > 0 ? 1 : 0.2) * (s.ads > 0 ? 1.4 : 1); };
  B.wage = (id) => (8 + 4 * st.biz[id].lvl); // bir ishchiga, o'yin soatiga
  B.cap = (id) => Math.round(def(id).base * mul(st.biz[id]) * 30); // kassa sig'imi
  B.restockCost = (id) => { const s = st.biz[id]; return Math.round((100 - s.stock) * def(id).base * 0.06 * BIZ_LVL[s.lvl - 1]); };
  B.upCost = (id) => { const s = st.biz[id]; return s.lvl >= 5 ? 0 : Math.round(def(id).price * UP_COST[s.lvl]); };
  B.hireCost = (id) => 250 * (st.biz[id].staff + 1);
  B.adsCost = (id) => Math.round(def(id).base * 5);
  B.guests = (id, h = game.hour) => { const d = def(id); return own(id) ? clamp(Math.round(B.rate(id, h) / d.base * 1.4), 1, 6) : 0; }; // ko'rinadigan mijozlar
  const log = (s, text, n) => { s.log = s.log || []; s.log.unshift([hm(game.hour), text, Math.round(n)]); if (s.log.length > 14) s.log.length = 14; };
  const step = (id, dt, h) => { const s = st.biz[id], d = def(id); const r = B.rate(id, h), sold = r * dt, wage = s.staff * B.wage(id) * dt;
    if (s.stock > 0) s.stock = Math.max(0, s.stock - 5.5 * (1 + 0.35 * s.staff) * d.busy(h) * (s.ads > 0 ? 1.4 : 1) * dt);
    if (s.ads > 0) s.ads = Math.max(0, s.ads - dt);
    s.cash = clamp(s.cash + sold - wage, 0, B.cap(id)); s.earned += sold; s.wages = (s.wages || 0) + wage; s.pend = (s.pend || 0) + sold; s.pw = (s.pw || 0) + wage; s.lt = (s.lt || 0) + dt;
    if (s.lt >= 3) { if (s.pend >= 1) log(s, `Savdo (${Math.round(s.lt)} soat)`, s.pend); if (s.pw >= 1) log(s, 'Ishchilar maoshi', -s.pw); s.pend = 0; s.pw = 0; s.lt = 0; }
    if (s.stock <= 0 && !s.warned) { s.warned = 1; toast(`${d.ic} ${d.name}: tovar tugadi! Savdo deyarli to'xtadi — telefon → Biznesim → Tovar keltirish`, 'bad'); }
    if (s.auto) { s.at = (s.at || 0) + dt; if (s.at >= 1 && s.cash >= 1) { s.at = 0; const n = Math.floor(s.cash), fee = Math.round(n * AUTO_FEE); s.cash -= n; game.addMoney(n - fee, `Biznes: ${d.name}`); log(s, 'Bankka o\'tkazildi', n - fee); } } };
  // o'tgan o'yin vaqti (uyqu ham) — yarim soatlik bo'laklarda: kun vaqtiga qarab mijozlar oqimi o'zgaradi
  B.accrue = (dh) => { const ids = BIZ.filter((d) => own(d.id)).map((d) => d.id); if (!ids.length) return; let h0 = (((game.hour - dh) % 24) + 24) % 24, left = Math.min(dh, 72);
    while (left > 1e-6) { const s = Math.min(0.5, left); for (const id of ids) step(id, s, (h0 + s / 2) % 24); h0 = (h0 + s) % 24; left -= s; } };
  K.on(B.accrue);

  // ================= AMALLAR =================
  B.buy = (id) => { const d = def(id); if (own(id)) return false; if (st.money < d.price) { toast(`Pul yetarli emas (${som(d.price)} so'm)`, 'bad'); return false; }
    game.addMoney(-d.price, `Biznes sotib olindi: ${d.name}`); st.biz[id] = { lvl: 1, staff: 0, stock: 100, cash: 0, auto: 0, earned: 0, wages: 0, ads: 0, log: [], since: K.now() }; log(st.biz[id], 'Sotib olindi', -d.price);
    sfx('win'); game.banner(`${d.ic} ${d.name} — endi sizniki!`, `${d.keeper} siz uchun ishlaydi. Daromad kassaga yig'iladi — telefon → Biznesim`, 'gold'); refresh(); game.save(); return true; };
  B.collect = (id) => { const s = st.biz[id]; if (!own(id) || s.cash < 1) return 0; const n = Math.floor(s.cash); s.cash -= n; game.addMoney(n, `Biznes: ${def(id).name}`); log(s, 'Kassadan olindi', n); sfx('coin'); game.save(); return n; };
  B.restock = (id) => { const s = st.biz[id], c = B.restockCost(id); if (!own(id) || s.stock >= 99.5) return false; if (st.money < c) { toast('Pul yetarli emas', 'bad'); return false; } game.addMoney(-c, `Tovar: ${def(id).name}`); s.stock = 100; s.warned = 0; log(s, 'Tovar keltirildi', -c); sfx('buy'); return true; };
  B.hire = (id) => { const s = st.biz[id], c = B.hireCost(id); if (!own(id) || s.staff >= MAX_STAFF) return false; if (st.money < c) { toast('Pul yetarli emas', 'bad'); return false; } game.addMoney(-c, `Ishchi yollandi: ${def(id).name}`); s.staff++; log(s, `Ishchi yollandi (${s.staff})`, -c); sfx('buy'); refresh(); return true; };
  B.fire = (id) => { const s = st.biz[id]; if (!own(id) || s.staff <= 0) return false; s.staff--; log(s, `Ishchi bo'shatildi (${s.staff})`, 0); refresh(); return true; };
  B.upgrade = (id) => { const s = st.biz[id], c = B.upCost(id); if (!own(id) || s.lvl >= 5) return false; if (st.money < c) { toast('Pul yetarli emas', 'bad'); return false; } game.addMoney(-c, `Biznes yangilandi: ${def(id).name}`); s.lvl++; log(s, `Daraja ${s.lvl}: ${LVL_NAME[s.lvl - 1]}`, -c); sfx('medal'); game.banner(`${def(id).ic} ${def(id).name} — ${s.lvl}-daraja`, `«${LVL_NAME[s.lvl - 1]}» · savdo ×${BIZ_LVL[s.lvl - 1]}`, 'gold'); refresh(); game.save(); return true; };
  B.ads = (id) => { const s = st.biz[id], c = B.adsCost(id); if (!own(id)) return false; if (st.money < c) { toast('Pul yetarli emas', 'bad'); return false; } game.addMoney(-c, `Reklama: ${def(id).name}`); s.ads = (s.ads || 0) + 12; log(s, 'Reklama (12 soat, +40%)', -c); sfx('buy'); return true; };
  B.setAuto = (id, on) => { if (own(id)) { st.biz[id].auto = on ? 1 : 0; st.biz[id].at = 0; } };

  // ================= BINOLAR (tashqi bezaklar va mijozlar) =================
  const fromOut = (out) => { const yaw = out[2], c = Math.cos(yaw), s = Math.sin(yaw), x = out[0] - Math.sin(yaw) * 3.5, z = out[1] - Math.cos(yaw) * 3.5; return { x, z, yaw, W: (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c] }; };
  const shop = HY.shops.find((q) => q.pid === 'bogiston'), cafe = H2.bld.find((q) => q.kind === 'cafe'), kiy = H2.bld.find((q) => q.kind === 'kiyim');
  const siteOf = { dokon: shop ? Object.assign(fromOut(shop.out), { door: [shop.x, shop.z], inK: 'shop' }) : null, choyxona: cafe ? { x: cafe.cx, z: cafe.cz, yaw: cafe.yaw, W: cafe.W, door: [cafe.x, cafe.z], inK: 'cafe' } : null, kiyim: kiy ? { x: kiy.cx, z: kiy.cz, yaw: kiy.yaw, W: kiy.W, door: [kiy.x, kiy.z], inK: 'kiyim' } : null };
  const signMat = (txt, bg) => { const c = document.createElement('canvas'); c.width = 256; c.height = 96; const x = c.getContext('2d'); x.fillStyle = bg; x.fillRect(0, 0, 256, 96); x.strokeStyle = '#ffe08a'; x.lineWidth = 6; x.strokeRect(5, 5, 246, 86); x.fillStyle = '#ffe08a'; x.font = 'bold 40px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(txt, 128, 50); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return new THREE.MeshBasicMaterial({ map: t, fog: true }); };
  const ownMat = signMat('★ SIZNIKI', '#2a5a3a');
  for (const d of BIZ) { const S = siteOf[d.id]; if (!S) continue; B.sites[d.id] = S; const lv = [];
    const at = (g, lx, lz, a, fn) => { const [x, z] = S.W(lx, lz), y = T.ground(x, z, 1e9).y; g.push().translate(x, y, z).rotY(S.yaw + a); fn(g); g.pop(); };
    const mk = (seed, fn, glow) => { const g = new GB(seed), gl = new GB(seed + 1); g.jit = 0.02; gl.jit = 0; fn(g, gl); const grp = new THREE.Group(); const m = new THREE.Mesh(g.build(), MAT.flat); m.castShadow = true; m.receiveShadow = true; grp.add(m); if (glow && gl.count) grp.add(new THREE.Mesh(withMask(gl.build()), glowMat())); grp.visible = false; scene.add(grp); return grp; };
    const pot = (g) => { g.color(0xb85a34).cyl(8, 0.26, 0.2, 0, 0.5, { cap: true }); g.color(0x3f9a58); for (let i = 0; i < 6; i++) g.blob(0.2, 1, { cx: Math.sin(i) * 0.12, cy: 0.6 + (i % 3) * 0.14, cz: Math.cos(i) * 0.12, sy: 1.3 }); g.color(0xff6a8a); for (let i = 0; i < 4; i++) g.blob(0.06, 0, { cx: Math.sin(i * 1.6) * 0.18, cy: 0.85, cz: Math.cos(i * 1.6) * 0.18 }); };
    const bench = (g) => { g.color(0x8a5a36).box(0, 0.45, 0, 1.8, 0.08, 0.45); g.color(0x6e4a30); for (const sx of [-0.8, 0.8]) g.box(sx, 0.22, 0, 0.1, 0.45, 0.4); g.box(0, 0.8, -0.2, 1.8, 0.35, 0.06); };
    const table = (g, c) => { g.color(0x7a4e2e).box(0, 0.74, 0, 1.0, 0.06, 1.0); g.box(0, 0.37, 0, 0.1, 0.72, 0.1); g.box(0, 0.03, 0, 0.6, 0.06, 0.6); g.color(0xd8d2c6).cyl(6, 0.03, 0.03, 0.75, 2.4); for (let i = 0; i < 8; i++) g.color(i % 2 ? 0xf2f2ee : c).push().translate(0, 2.35, 0).rotY(i * 0.785).rotX(0.3).box(0, 0, 0.55, 0.62, 0.04, 1.1).pop(); g.color(0x8a5a36); for (const [x, z] of [[-0.75, 0], [0.75, 0]]) g.cyl(8, 0.2, 0.2, 0.42, 0.46, { cap: true }).translate(0, 0, 0) && g.push().translate(x, 0, z).cyl(8, 0.2, 0.2, 0.42, 0.46, { cap: true }).box(0, 0.21, 0, 0.06, 0.42, 0.06).pop(); };
    const c0 = d.id === 'choyxona' ? 0x2f6aa8 : d.id === 'kiyim' ? 0x8a3a8a : 0x3f9a58;
    lv[1] = mk(3401 + BIZ.indexOf(d) * 10, (g) => at(g, 3.9, 3.2, 0, (q) => { q.color(0x6e4a30).box(0, 0.7, 0, 0.08, 1.4, 0.08); }));
    { const sg = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.34), ownMat); const [x, z] = S.W(3.9, 3.25), y = T.ground(x, z, 1e9).y; sg.position.set(x, y + 1.5, z); sg.rotation.y = S.yaw; lv[1].add(sg); }
    lv[2] = mk(3402 + BIZ.indexOf(d) * 10, (g) => { at(g, -1.25, 3.05, 0, pot); at(g, 1.25, 3.05, 0, pot); at(g, -4.7, 2.2, Math.PI / 2, bench); });
    lv[3] = mk(3403 + BIZ.indexOf(d) * 10, (g) => at(g, 4.7, 1.2, 0, (q) => table(q, c0)));
    lv[4] = mk(3404 + BIZ.indexOf(d) * 10, (g, gl) => { for (const sx of [-3.4, 3.4]) at(g, sx, 3.9, 0, (q) => q.color(0x2a2c33).box(0, 1.5, 0, 0.08, 3.0, 0.08)); const cols = [0xff5a4a, 0xffd23a, 0x5ad06a, 0x4fb0ff];
      for (let i = 0; i <= 16; i++) { const lx = -3.4 + i * 0.425, sag = 2.75 - 0.35 * Math.sin((i / 16) * Math.PI); at(gl, lx, 3.9, 0, (q) => q.color(cols[i % 4]).blob(0.07, 0, { cy: sag })); at(g, lx, 3.9, 0, (q) => q.color(0x2a2c33).box(0, sag + 0.1, 0, 0.44, 0.012, 0.012)); } }, true);
    lv[5] = mk(3405 + BIZ.indexOf(d) * 10, (g) => { at(g, -4.9, -1.0, 0, (q) => table(q, 0xf0b83a)); at(g, 4.8, -1.4, 0, pot); at(g, -4.8, 3.6, 0, pot); });
    S.lv = lv; S.seats = [[-4.55, 1.7, -Math.PI / 2], [-4.55, 2.7, -Math.PI / 2], [3.95, 1.2, Math.PI / 2], [5.45, 1.2, -Math.PI / 2]]; }
  const refresh = () => { for (const d of BIZ) { const S = B.sites[d.id]; if (!S) continue; const s = st.biz[d.id], l = own(d.id) ? s.lvl : 0; for (let i = 1; i <= 5; i++) S.lv[i].visible = l >= i; } inside(); };
  // mijozlar: 6 kishilik umumiy guruh — eng yaqin o'z biznesingiz oldida yurishadi, kirib-chiqishadi, o'tirishadi
  const LOOKS = [{ shirt: 0x3d74a6, pants: 0x2a2c33 }, { shirt: 0xd8392b, pants: 0x3a3f4c, long: true }, { shirt: 0x6a8a5a, pants: 0x4a3a2a, stache: true }, { shirt: 0xf0b83a, pants: 0x2f4a78 }, { shirt: 0x8a54c8, pants: 0x2a2c33, long: true }, { shirt: 0xe8e2d4, pants: 0x5a6a3a, stache: true, hair: 0xb8bcc4 }];
  const pool = () => { if (!B.pool.length) for (let i = 0; i < 6; i++) { const r = makeRig(Object.assign({ seed: 5100 + i * 13 }, LOOKS[i])); r.root.visible = false; scene.add(r.root); B.pool.push({ rig: r, x: 0, z: 0, yaw: 0, ph: 'off', t: i * 1.7, site: null }); } return B.pool; };
  const W2 = (S, lx, lz) => S.W(lx, lz);
  const custStep = (c, S, i, n, dt) => { const r = c.rig, sv = S === c.site;
    if (!sv) { c.site = S; c.ph = 'off'; c.t = i * 1.3; }
    const sit = S.lvl >= 2 && i === n - 1 ? S.seats[0] : S.lvl >= 3 && i === n - 2 ? S.seats[2] : null;
    if (i >= n) { r.root.visible = false; c.ph = 'off'; return; }
    if (sit) { const [x, z] = W2(S, sit[0], sit[1]); r.root.position.set(x, T.ground(x, z, 1e9).y, z); r.root.rotation.y = S.yaw + sit[2]; r.root.visible = true; r.actDur = 3; poseRig(r, i % 2 ? 'sit' : 'talk', dt, 0); return; }
    const spawn = W2(S, (i % 2 ? 1 : -1) * (5.6 + (i % 3) * 0.4), 6.2 + (i % 2) * 0.5), door = W2(S, (i % 3 - 1) * 0.25, 3.3);
    const walk = (tx, tz) => { const dx = tx - c.x, dz = tz - c.z, d = Math.hypot(dx, dz); if (d < 0.08) return true; const s = Math.min(d, 1.25 * dt); c.x += dx / d * s; c.z += dz / d * s; c.yaw += angDiff(Math.atan2(dx, dz), c.yaw) * Math.min(1, dt * 8); return false; };
    let an = 'idle', sp = 0; c.t -= dt;
    if (c.ph === 'off') { r.root.visible = false; if (c.t <= 0) { c.ph = 'in'; c.x = spawn[0]; c.z = spawn[1]; c.yaw = Math.atan2(door[0] - c.x, door[1] - c.z); } }
    else if (c.ph === 'in') { an = 'walk'; sp = 1.25; if (walk(door[0], door[1])) { c.ph = 'shop'; c.t = 3 + (i * 1.9) % 5; } }
    else if (c.ph === 'shop') { r.root.visible = false; if (c.t <= 0) { c.ph = 'out'; c.yaw = S.yaw; } }
    else if (c.ph === 'out') { an = 'walk'; sp = 1.25; if (walk(spawn[0], spawn[1])) { c.ph = 'off'; c.t = 1.5 + (i * 2.3) % 4; } }
    if (c.ph === 'in' || c.ph === 'out') { r.root.visible = true; r.root.position.set(c.x, T.ground(c.x, c.z, 1e9).y, c.z); r.root.rotation.y = c.yaw; poseRig(r, an, dt, sp); } };

  // ================= ICHKARIDA: qo'shimcha mehmonlar, ishchilar, biznes daftari =================
  const IX = { choyxona: IN.X.cafe, kiyim: IN.X.kiyim, dokon: IN.S };
  const SPOT = { choyxona: [1.2, 2.0, 0], kiyim: [0.2, 2.0, 0], dokon: [1.9, 0.6, 0] };
  for (const id in IX) { const I = IX[id]; if (!I) continue; const [x, z, yaw] = SPOT[id]; IN.lib.spot(I, 'biz', x, z, yaw, { r: 1.0, biz: id }); }
  // [lx, lz, yaw, anim] — daraja oshgan sari ko'proq mehmon; ishchi — birinchi yollanganda
  const GUEST = { choyxona: [[2.75, -2.18, 0, 'sit'], [2.75, -0.82, Math.PI, 'eat']], dokon: [[-2.25, -1.3, -Math.PI / 2, 'idle'], [2.25, 0.3, Math.PI / 2, 'idle']], kiyim: [[-2.45, 0.7, -Math.PI / 2, 'idle'], [2.45, -1.0, Math.PI / 2, 'idle']] };
  const STAFF = { choyxona: [-1.7, 2.15, Math.PI, { shirt: 0xf6f6f2, pants: 0x1d1e22, vest: 0x2a2c33, sleeve: 1, seed: 5201 }], dokon: [-1.0, 1.85, Math.PI, { shirt: 0x3f9a58, pants: 0x2a2c33, seed: 5202 }], kiyim: [0.8, 2.55, Math.PI, { shirt: 0xb860b8, pants: 0x2a2c33, long: true, seed: 5203 }] };
  const INR = {};
  const inside = () => { for (const id in IX) { const I = IX[id]; if (!I || !own(id)) continue; const s = st.biz[id], R = INR[id] || (INR[id] = { g: [], w: null });
    const n = s.lvl >= 4 ? 2 : s.lvl >= 2 ? 1 : 0;
    while (R.g.length < n) { const q = GUEST[id][R.g.length], r = makeRig({ seed: 5300 + R.g.length + id.length * 7, shirt: [0x3d74a6, 0xd8602a][R.g.length], pants: 0x2a2c33, long: R.g.length === 1 }); r.root.position.set(I.o[0] + q[0], I.o[1], I.o[2] + q[1]); r.root.rotation.y = q[2]; I.grp.add(r.root); R.g.push({ r, q });
      if (id === 'choyxona') { const k = I.spots.findIndex((sp) => sp.k === 'csit' && Math.hypot(sp.lx - q[0], sp.lz - q[1]) < 0.3); if (k >= 0) { const sp = I.spots.splice(k, 1)[0], j = I.seats.indexOf(sp); if (j >= 0) I.seats.splice(j, 1); } } }
    if (s.staff > 0 && !R.w) { const q = STAFF[id], r = makeRig(q[3]); r.root.position.set(I.o[0] + q[0], I.o[1], I.o[2] + q[1]); r.root.rotation.y = q[2]; I.grp.add(r.root); R.w = r; }
    if (R.w) R.w.root.visible = s.staff > 0; } };
  refresh();

  // ================= KADR =================
  game.hooks.push((dt) => {
    if (game.mode !== 'play') return; const px = pl.onFoot ? pl.p[0] : game.car.p[0], pz = pl.onFoot ? pl.p[2] : game.car.p[2];
    // tashqarida: eng yaqin o'z biznesingiz (120 m ichida)
    let S = null, bd = 120, sid = null; if (!IN.inside) for (const d of BIZ) { const s2 = B.sites[d.id]; if (!s2 || !own(d.id)) continue; const dd = Math.hypot(s2.x - px, s2.z - pz); if (dd < bd) { bd = dd; S = s2; sid = d.id; } }
    if (S) { S.lvl = st.biz[sid].lvl; const P = pool(), n = B.guests(sid); P.forEach((c, i) => custStep(c, S, i, n, dt)); } else if (B.pool.length) for (const c of B.pool) { c.rig.root.visible = false; c.site = null; }
    // ichkarida
    const id = Object.keys(IX).find((k) => IX[k] && IN.cur() === IX[k]); if (id && INR[id]) { const R = INR[id], show = id !== 'dokon' || B.shopPid === 'bogiston';
      for (const { r, q } of R.g) { r.root.visible = show; if (show) { r.actDur = 4; poseRig(r, q[3] === 'eat' && (game.time % 9) > 5 ? 'eat' : q[3], dt, 0); if (q[3] === 'eat' && r.toolName !== ((game.time % 9) > 5 ? 'spoon' : null)) setTool(r, (game.time % 9) > 5 ? 'spoon' : null); } }
      if (R.w) { R.w.root.visible = show && st.biz[id].staff > 0; if (R.w.root.visible) poseRig(R.w, Math.hypot(pl.p[0] - R.w.root.position.x, pl.p[2] - R.w.root.position.z) < 2.4 ? 'talk' : 'idle', dt, 0); } }
  });
  const ent0 = HY.enterShop; HY.enterShop = (sh) => { B.shopPid = sh.pid; ent0(sh); };

  // ================= [E]: biznes daftari (ichkarida) =================
  const ex0 = L.extra;
  L.extra = (offer, px, pz, p) => { ex0(offer, px, pz, p); if (HY.dlg) return; const I = IN.cur(); if (!I) return;
    for (const sp of I.spots) { if (sp.k !== 'biz') continue; if (sp.biz === 'dokon' && B.shopPid !== 'bogiston') continue; const d = Math.hypot(sp.x - px, sp.z - pz); if (d > sp.r) continue; const D = def(sp.biz);
      offer(d - 0.05, own(sp.biz) ? `<kbd>E</kbd> Biznes daftari — kassada ${som(st.biz[sp.biz].cash)} so'm 📒` : `<kbd>E</kbd> ${D.name}ni sotib olish — ${som(D.price)} so'm 🏪`, () => game.ui.open('biznes', { id: sp.biz, at: true })); } };

  // ================= TELEFON: BIZNESIM =================
  const bar = (v, col) => `<div style="height:7px;border-radius:5px;background:rgba(255,255,255,.15);overflow:hidden;margin-top:3px"><i style="display:block;height:100%;width:${Math.round(clamp(v, 0, 100))}%;background:${col}"></i></div>`;
  PH.apps.push(['biznes', '🏪', 'Biznesim', '#2a9a6a']);
  PH.ext.biznes = (head) => { const mine = BIZ.filter((d) => own(d.id));
    if (!mine.length) return head('🏪 Biznesim') + `<p class="ph-empty" style="margin-top:4px">Sizda hali biznes yo'q. Sotib oling — u o'zi pul ishlaydi!</p><div class="ph-list">${BIZ.map((d) => `<div data-a="bzgo:${d.id}"><span>${d.ic} ${d.name}<small style="display:block;opacity:.75;font-weight:600">${som(d.base)} so'm/soatdan · ichkarida <kbd>E</kbd></small></span><b>${som(d.price)}</b></div>`).join('')}</div>`;
    const tot = mine.reduce((a, d) => a + st.biz[d.id].cash, 0), rate = mine.reduce((a, d) => a + B.rate(d.id), 0);
    return head('🏪 Biznesim') + `<div class="ph-card" style="background:linear-gradient(135deg,#2a9a6a,#2f6fd0)"><small>Kassalarda</small><b>${som(tot)} so'm</b><small>Hozir: +${som(rate)} so'm/soat · ${mine.length} ta biznes</small></div>
      <div class="ph-list">${mine.map((d) => { const s = st.biz[d.id]; return `<div data-a="bzwin:${d.id}"><span style="flex:1">${d.ic} ${d.name} · ${s.lvl}★<small style="display:block;opacity:.75;font-weight:600">Kassa ${som(s.cash)} · ${som(B.rate(d.id))}/soat · ishchi ${s.staff} · ${s.auto ? 'avto-bank ✓' : 'kassada'}</small>${bar(s.stock, s.stock < 20 ? '#ff5a4a' : '#7fe08a')}</span><b>›</b></div>`; }).join('')}
      ${BIZ.filter((d) => !own(d.id)).map((d) => `<div data-a="bzgo:${d.id}"><span>${d.ic} ${d.name}<small style="display:block;opacity:.75;font-weight:600">sotiladi</small></span><b>${som(d.price)}</b></div>`).join('')}</div>
      <p class="ph-empty">Kassani biznesning o'zida olasiz yoki «avto-bank» yoqing (komissiya ${Math.round(AUTO_FEE * 100)}%).</p>`; };
  PH.acts.bzgo = (id) => { const S = B.sites[id]; if (!S) return; game.setWaypoint(S.door[0], S.door[1]); game.ui.close(); toast(`📍 ${def(id).name} — yo'l ko'rsatildi`); };
  PH.acts.bzwin = (id) => game.ui.open('biznes', { id, at: false });
  PH.bankExtra = () => { const mine = BIZ.filter((d) => own(d.id)); if (!mine.length) return ''; return `<div class="ph-list" style="margin-bottom:10px">${mine.map((d) => `<div data-a="bzwin:${d.id}"><span>${d.ic} ${d.name}<small> kassa · ${st.biz[d.id].auto ? 'avto' : 'qo\'lda'}</small></span><b class="pos">${som(st.biz[d.id].cash)}</b></div>`).join('')}</div>`; };
  K.extraPlan = ((f0) => () => { const r = f0 ? f0() : []; for (const d of BIZ) { if (!own(d.id)) continue; const s = st.biz[d.id], S = B.sites[d.id]; if (s.stock < 25) r.push({ id: 'bz:' + d.id, ic: '📦', t: `${d.name}: tovar kam (${Math.round(s.stock)}%)`, s: `Tovar keltirish — ${som(B.restockCost(d.id))} so'm`, ok: false, go: S ? S.door : null }); else if (!s.auto && s.cash > B.cap(d.id) * 0.5) r.push({ id: 'bz:' + d.id, ic: '💰', t: `${d.name}: kassada ${som(s.cash)} so'm`, s: 'Borib oling — kassa to\'lib qolmasin', ok: true, go: S ? S.door : null }); } return r; })(K.extraPlan);

  // ================= OYNA: biznes boshqaruvi =================
  const attach = (ui) => {
    ui.s_biznes = function (w, dd, btn, x) {
      x(); const id = (dd && dd.id) || 'choyxona', at = !!(dd && dd.at), d = def(id);
      const render = () => { const s = st.biz[id];
        if (!own(id)) { w.innerHTML = `<h1>${d.ic} ${d.name} <small>💰 ${som(st.money)} so'm</small></h1><div class="card"><h4>Biznesni sotib oling</h4><p>${d.desc}</p><p>Daromad: ${som(d.base)} so'm/soatdan (o'yin vaqti) — yangilash, ishchilar va reklama bilan ${som(d.base * 3.6 * 2.05)} so'm/soatgacha. Pul kassaga yig'iladi — shu yerda olasiz yoki avto-bankka o'tkazasiz. ${d.keeper} siz uchun ishlaydi.</p><div class="meta"><span>Narxi: ${som(d.price)} so'm</span></div>
          <button data-a="buy" ${!at || st.money < d.price ? 'disabled' : ''}>${!at ? 'Biznesning o\'ziga borib sotib oling' : st.money < d.price ? `Yana ${som(d.price - st.money)} so'm kerak` : `Sotib olish — ${som(d.price)} so'm`}</button></div>`; return; }
        const r = B.rate(id), up = B.upCost(id), rc = B.restockCost(id), h = game.hour;
        w.innerHTML = `<h1>${d.ic} ${d.name} <small>${s.lvl}/5 · «${LVL_NAME[s.lvl - 1]}» · 💰 ${som(st.money)} so'm</small></h1>
          <div class="grid2"><div>
            <div class="card"><h4>💰 Kassa: ${som(s.cash)} so'm <small style="opacity:.7">/ ${som(B.cap(id))}</small></h4><p>Hozir: +${som(r)} so'm/soat · mijozlar ~${B.guests(id) * 6} kishi/soat${s.ads > 0 ? ` · 📣 reklama ${Math.ceil(s.ads)} soat` : ''}<br>Jami savdo: ${som(s.earned)} so'm · maoshlar: ${som(s.wages || 0)} so'm</p>
              <div class="row" style="gap:6px;flex-wrap:wrap"><button data-a="col" ${at && s.cash >= 1 ? '' : 'disabled'}>${at ? `Kassani olish — ${som(s.cash)}` : 'Kassa — faqat biznesda'}</button><button class="${s.auto ? '' : 'sec'}" data-a="auto">${s.auto ? '✓ Avto-bank yoqilgan' : `Avto-bank (−${Math.round(AUTO_FEE * 100)}%)`}</button></div></div>
            <div class="card" style="margin-top:8px"><h4>📒 Daftar</h4><div class="ph-list" style="margin:4px 0 0;background:rgba(255,255,255,.05)">${(s.log || []).slice(0, 8).map((q) => `<div><span>${q[1]}<small style="opacity:.6"> ${q[0]}</small></span><b class="${q[2] >= 0 ? 'pos' : 'neg'}" style="color:${q[2] >= 0 ? '#7fe08a' : '#ff8a7a'}">${q[2] > 0 ? '+' : ''}${som(q[2])}</b></div>`).join('') || '<p class="sub">Hali yozuv yo\'q</p>'}</div></div>
          </div><div>
            <div class="card"><h4>📦 Tovar zaxirasi: ${Math.round(s.stock)}%</h4>${bar(s.stock, s.stock < 20 ? '#ff5a4a' : '#7fe08a')}<p>Tovar tugasa savdo deyarli to'xtaydi. ${s.stock < 99.5 ? `To'ldirish — ${som(rc)} so'm` : "Omborda to'la"}</p><button data-a="stock" ${s.stock >= 99.5 || st.money < rc ? 'disabled' : ''}>Tovar keltirish</button></div>
            <div class="card" style="margin-top:8px"><h4>👥 Ishchilar: ${s.staff}/${MAX_STAFF}</h4><p>Har biri savdoni +35% oshiradi, maoshi ${B.wage(id)} so'm/soat.</p><div class="row" style="gap:6px"><button data-a="hire" ${s.staff >= MAX_STAFF || st.money < B.hireCost(id) ? 'disabled' : ''}>${s.staff >= MAX_STAFF ? "To'liq" : `Yollash — ${som(B.hireCost(id))}`}</button><button class="sec" data-a="fire" ${s.staff ? '' : 'disabled'}>Bo'shatish</button></div></div>
            <div class="card" style="margin-top:8px"><h4>⭐ Daraja ${s.lvl}/5</h4><p>${s.lvl < 5 ? `Keyingisi: «${LVL_NAME[s.lvl]}» — savdo ×${BIZ_LVL[s.lvl]}, tashqarida yangi bezaklar, mijozlar ko'payadi` : "Eng yuqori daraja! 🏆"}</p>${s.lvl < 5 ? `<button data-a="up" ${st.money < up ? 'disabled' : ''}>Yangilash — ${som(up)} so'm</button>` : ''}</div>
            <div class="card" style="margin-top:8px"><h4>📣 Reklama</h4><p>12 soat davomida savdo +40%.</p><button class="sec" data-a="ads" ${st.money < B.adsCost(id) ? 'disabled' : ''}>Reklama berish — ${som(B.adsCost(id))}</button></div>
          </div></div><p class="sub" style="margin-top:6px">Ish vaqti: hozir ${hm(h)} — ${d.busy(h) > 1.1 ? 'gavjum payt 🔥' : d.busy(h) < 0.3 ? 'tinch payt 🌙' : 'odatdagidek'}. Daromad o\'yin vaqti o\'tganda (uxlaganda ham) yig\'iladi.</p>`; };
      this.on({ buy: () => { if (B.buy(id)) render(); }, col: () => { const n = B.collect(id); if (n) toast(`💰 Kassadan olindi: +${som(n)} so'm`, 'gold'); render(); }, auto: () => { B.setAuto(id, !st.biz[id].auto); toast(st.biz[id].auto ? `Avto-bank yoqildi — har soatda bankka (−${Math.round(AUTO_FEE * 100)}%)` : "Avto-bank o'chirildi — kassani biznesda oling"); render(); },
        stock: () => { if (B.restock(id)) toast('📦 Tovar keltirildi — ombor to\'la', 'good'); render(); }, hire: () => { if (B.hire(id)) toast('👥 Yangi ishchi ishga tushdi', 'good'); render(); }, fire: () => { B.fire(id); render(); }, up: () => { B.upgrade(id); render(); }, ads: () => { if (B.ads(id)) toast('📣 Reklama berildi — 12 soat +40%', 'good'); render(); } });
      render();
    };
  };
  let ok = false; game.hooks.push(() => { if (!ok && game.ui) { ok = true; attach(game.ui); } });
  return B;
}
