// Yoqilg'i: transport benzini (velosipeddan tashqari), sarf (masofa va gaz bo'yicha), yo'l bo'yidagi yoqilg'i quyish shoxobchalari, kanistr
import * as THREE from 'three';
import * as T from './terrain.js';
import * as COL from './colliders.js';
import { GB, MAT } from './geo.js';
import { vehById } from './vehicles.js';
import { makeRig, poseRig } from './rig.js';
import { clamp } from './util.js';

export const FUEL_PRICE = 2; // so'm / 1 %
const TARGETS = [[-520, 1760], [-1650, -920], [1500, 1550], [400, 2050]]; // shoxobcha qidiriladigan joylar (asosiy yo'llar yaqinida)
const som = (n) => Math.round(n).toLocaleString('ru-RU');

export function initFuel(game) {
  const { scene, car } = game, st = game.state, R = T.roads;
  const FU = { stations: [], fill: null, warned: false, emptyT: 0 };
  game.fuel = FU;
  FU.uses = (id = st.veh.cur) => { const v = vehById[id]; return !!v && v.eng > 0; };
  FU.get = (id = st.veh.cur) => (FU.uses(id) ? (st.fuel[id] == null ? 100 : st.fuel[id]) : 100);
  FU.set = (v, id = st.veh.cur) => { st.fuel[id] = clamp(v, 0, 100); };
  FU.empty = () => FU.uses() && FU.get() <= 0.01;

  // ---------- shoxobchalarni joylash ----------
  const free = (x, z, r) => { for (const o of COL.query(x, z, r)) { if (o.dead) continue; let qx = o.x, qz = o.z; if (o.t === 1) { const sx = o.x2 - o.x, sz = o.z2 - o.z, t = clamp(((x - o.x) * sx + (z - o.z) * sz) / (sx * sx + sz * sz || 1), 0, 1); qx = o.x + sx * t; qz = o.z + sz * t; } if (Math.hypot(x - qx, z - qz) < o.r + r) return false; } return true; };
  const find = (tx, tz) => {
    let best = null;
    for (const e of R.edges) { if (e.type !== 0) continue; for (let k = 8; k < e.count - 8; k += 2) { const i = e.start + k; if (R.bridge[i]) continue; const d = Math.hypot(R.x[i] - tx, R.z[i] - tz); if (d > 350) continue;
      if (FU.stations.some((s) => Math.hypot(s.x - R.x[i], s.z - R.z[i]) < 300)) continue;
      for (const sd of [1, -1]) { const nx = R.tz[i] * sd, nz = -R.tx[i] * sd, off = R.hw[i] + 9, cx = R.x[i] + nx * off, cz = R.z[i] + nz * off; let ok = true, maxd = 0;
        for (let a = -8; a <= 8 && ok; a += 4) for (let b = -6; b <= 6; b += 3) { const px = cx + R.tx[i] * a + nx * b, pz = cz + R.tz[i] * a + nz * b, h = T.gridHeight(px, pz); maxd = Math.max(maxd, Math.abs(h - R.y[i])); if (T.waterY(px, pz) > h - 0.5) ok = false; const nr = T.nearestRoad(px, pz, 2); if (nr.edge >= 0 && nr.d < nr.hw + 1 && nr.edge !== R.edge[i]) ok = false; }
        const j = i + 6, j2 = i - 6, turn = Math.abs(Math.atan2(R.tx[j], R.tz[j]) - Math.atan2(R.tx[j2], R.tz[j2]));
        if (!ok || maxd > 1.0 || turn > 0.12 || !free(cx, cz, 9.5)) continue; const sc = d + maxd * 60; if (!best || sc < best.sc) best = { sc, i, sd, nx, nz, cx, cz }; } } }
    return best;
  };
  // sign (kanva tekstura) — bitta material, yuklashda tayyorlanadi
  const sc = document.createElement('canvas'); sc.width = 256; sc.height = 96; { const x = sc.getContext('2d'); x.fillStyle = '#d8392b'; x.fillRect(0, 0, 256, 96); x.fillStyle = '#fff'; x.font = 'bold 40px sans-serif'; x.textAlign = 'center'; x.fillText("YOQILG'I", 128, 50); x.font = 'bold 20px sans-serif'; x.fillText(`${FUEL_PRICE} so'm / 1%`, 128, 82); }
  const signTex = new THREE.CanvasTexture(sc); signTex.colorSpace = THREE.SRGBColorSpace; const signMat = new THREE.MeshBasicMaterial({ map: signTex, fog: true });
  for (const t of TARGETS) {
    const f = find(t[0], t[1]); if (!f) continue; const i = f.i, ry = R.y[i] + 0.03, yaw = Math.atan2(R.tx[i], R.tz[i]);
    // mahalliy: x — yo'ldan uzoqlashish (nx), z — yo'l bo'ylab
    const ux = f.nx, uz = f.nz, vx = R.tx[i], vz = R.tz[i], ox = R.x[i] + ux * (R.hw[i] + 0.5), oz = R.z[i] + uz * (R.hw[i] + 0.5);
    const W = (lx, lz) => [ox + ux * lx + vx * lz, oz + uz * lx + vz * lz];
    const g = new GB(1700 + FU.stations.length); g.jit = 0.02; g.translate(ox, ry, oz); g._mul(ux, 0, vx, 0, 1, 0, uz, 0, vz); // x -> u, z -> v
    if ((ux * vz - uz * vx) < 0) g.flip = !g.flip;
    // maydon (asfalt), bordyur
    let gmin = ry; for (let a = 0; a <= 18; a += 3) for (let b = -10; b <= 10; b += 4) { const [px, pz] = W(a, b); gmin = Math.min(gmin, T.gridHeight(px, pz)); }
    const th = ry - gmin + 0.35; g.color(0x55575e).box(9, -th / 2 + 0.02, 0, 18, th, 21); g.color(0xe8e2d0).box(18.1, 0.06, 0, 0.25, 0.12, 21); g.color(0xf2f2ee); for (const lz of [-3, 3]) g.box(6, 0.045, lz, 7, 0.01, 0.12);
    // soyabon: 4 ustun, tom, chekka chiroq chizig'i
    g.color(0xe8e8e2); for (const [a, b] of [[3.2, -4.5], [3.2, 4.5], [9.2, -4.5], [9.2, 4.5]]) g.box(a, 2.4, b, 0.32, 4.8, 0.32);
    g.color(0xf2f2ee).box(6.2, 5.0, 0, 8.6, 0.5, 12.4); g.color(0xd8392b).box(6.2, 5.0, 6.21, 8.6, 0.42, 0.02); g.box(6.2, 5.0, -6.21, 8.6, 0.42, 0.02); g.box(1.89, 5.0, 0, 0.02, 0.42, 12.4); g.box(10.51, 5.0, 0, 0.02, 0.42, 12.4);
    // nasoslar (2 ta orolcha)
    const pumps = [];
    for (const b of [-2.4, 2.4]) { g.color(0xc8c2b4).box(6.2, 0.1, b, 1.2, 0.2, 3.0); for (const lz of [-0.7, 0.7]) { g.color(0xf2f2ee).box(6.2, 0.95, b + lz, 0.6, 1.7, 0.42); g.color(0xd8392b).box(6.2, 1.55, b + lz, 0.62, 0.34, 0.44); g.color(0x1d1e22).box(5.89, 1.15, b + lz, 0.02, 0.28, 0.3); g.color(0x2a2c33).box(5.86, 0.8, b + lz + 0.12, 0.08, 0.3, 0.06); }
      const [px, pz] = W(6.2, b); pumps.push({ x: px, z: pz }); COL.addBox(px, pz, 0.6, 1.5, yaw, ry - 1, ry + 2); }
    for (const [a, b] of [[3.2, -4.5], [3.2, 4.5], [9.2, -4.5], [9.2, 4.5]]) { const [px, pz] = W(a, b); COL.addCircle(px, pz, 0.22, ry - 1, ry + 5); }
    // kiosk (do'koncha): oyna, eshik, yashil chiziq
    g.color(0xf2ead8).box(14.8, 1.55, 0, 4.4, 3.1, 6.0); g.color(0x3f9a58).box(14.8, 3.25, 0, 4.6, 0.3, 6.2); g.color(0x9fd0ff).box(12.59, 1.6, -1.2, 0.02, 1.4, 2.6); g.color(0x8a5a36).box(12.59, 1.05, 1.6, 0.03, 2.1, 1.0);
    { const [px, pz] = W(14.8, 0); COL.addBox(px, pz, 2.2, 3.0, yaw, ry - 1, ry + 3.2); }
    // ustundagi narx belgisi
    g.color(0x8a8e98).box(1.0, 3.2, -9, 0.22, 6.4, 0.22);
    const m = new THREE.Mesh(g.build(), MAT.flat); m.castShadow = true; m.receiveShadow = true; scene.add(m);
    const sg = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.0), signMat); const [sx, sz] = W(0.86, -9); sg.position.set(sx, ry + 5.6, sz); sg.rotation.y = Math.atan2(-ux, -uz); scene.add(sg);
    const sg2 = sg.clone(); sg2.position.set(sx - ux * 0.27, ry + 5.6, sz - uz * 0.27); sg2.rotation.y = Math.atan2(ux, uz); scene.add(sg2);
    { const [px, pz] = W(1.0, -9); COL.addCircle(px, pz, 0.2, ry - 1, ry + 6.5); }
    // maydon — g'ildiraklar uchun tekis sirt (asfalt)
    { const [cx, cz] = W(9, 0); T.addPatch(cx, cz, Math.atan2(vx, vz), 21, 18, ry, ry, T.SURF.ASPHALT); }
    // xodim
    const rig = makeRig({ shirt: 0xd8392b, pants: 0x2a2c33, hair: 0x2a1d16, seed: 300 + FU.stations.length, vest: 0xf0b83a }); const [ax, az] = W(7.3, 0); rig.root.position.set(ax, ry, az); rig.root.rotation.y = Math.atan2(-ux, -uz); rig.root.visible = false; scene.add(rig.root);
    const [cx, cz] = W(6.2, 0);
    const [kx, kz] = W(11.9, 1.6); // kiosk eshigi oldi (piyoda [E] — do'koncha)
    FU.stations.push({ x: cx, z: cz, y: ry, yaw, pumps, rig, ax, az, kiosk: [kx, kz], ayaw: Math.atan2(-ux, -uz), wave: 0, name: ['Bog\'iston', 'Karvon yo\'li', 'Sharqiy yo\'l', 'Tegirmon yo\'li'][FU.stations.length] + " shoxobchasi" });
  }
  // eng yaqin nasos (transport uning yonida turishi kerak)
  FU.pumpNear = (x, z, r = 4.2) => { let best = null, bd = r; for (const s of FU.stations) { if (Math.abs(s.x - x) > 30 || Math.abs(s.z - z) > 30) continue; for (const p of s.pumps) { const d = Math.hypot(p.x - x, p.z - z); if (d < bd) { bd = d; best = { s, p, d }; } } } return best; };
  FU.nearest = (x, z) => { let best = null, bd = 1e9; for (const s of FU.stations) { const d = Math.hypot(s.x - x, s.z - z); if (d < bd) { bd = d; best = s; } } return best ? { s: best, d: bd } : null; };

  // ---------- quyish ----------
  FU.start = () => { const n = FU.pumpNear(car.p[0], car.p[2]); if (!n || !FU.uses()) return false; if (FU.get() > 99.5) { game.toast("Bak to'la ⛽"); return true; } if (game.state.money < FUEL_PRICE) { game.toast("Pul yetmaydi", 'bad'); return true; }
    FU.fill = { s: n.s, paid: 0, t: 0, from: FU.get() }; n.s.wave = 2; game.audio.sfx('click'); game.toast(`${n.s.name}: «Xush kelibsiz! Hozir to'ldiramiz»`, 'gold'); return true; };
  FU.stop = (why) => { const f = FU.fill; if (!f) return; FU.fill = null; const got = FU.get() - f.from; if (got > 0.5) { game.toast(`⛽ +${Math.round(got)}% yoqilg'i · −${som(f.paid)} so'm${why ? ' · ' + why : ''}`, 'good'); game.audio.sfx('coin'); game.save(); } };
  FU.canister = () => { if (!(st.inv.canister > 0)) return false; st.inv.canister--; FU.set(FU.get() + 35); FU.warned = false; game.toast(`Kanistrdan quyildi: ⛽ ${Math.round(FU.get())}%`, 'good'); game.audio.sfx('pour'); game.save(); return true; };

  // gaz pedalini cheklash (physics.js ga tegmaydi): bak bo'sh — faqat sudraladi; quyish paytida — joyida turadi
  const inp = game.input, poll0 = inp.poll.bind(inp);
  inp.poll = () => { const s = poll0(); if (game.player.onFoot) return s;
    if (FU.fill) { s.throttle = 0; s.handbrake = true; s.nitro = false; }
    else if (FU.empty()) { s.nitro = false; s.throttle = car.speed > 3.2 ? 0 : Math.min(s.throttle, 0.22); }
    return s; };

  // ---------- har kadr ----------
  let lastP = null;
  FU.update = (dt) => {
    const foot = game.player.onFoot, id = st.veh.cur;
    if (!foot && FU.uses(id)) {
      const p = car.p, d = lastP ? Math.hypot(p[0] - lastP[0], p[2] - lastP[1]) : 0; lastP = [p[0], p[2]];
      const v = vehById[id], k = clamp(v.spec.mass / 1500, 0.55, 2.2) * (car.nitroOn ? 2 : 1), thr = inp.state.throttle || 0;
      if (d < 30 && !game.damage.wrecked) FU.set(FU.get(id) - (d * 0.0021 + thr * dt * 0.006) * k, id);
      const f = FU.get(id);
      if (f < 15 && !FU.warned && f > 0.01) { FU.warned = true; const n = FU.nearest(p[0], p[2]); game.toast(`⛽ Yoqilg'i kam (${Math.round(f)}%)${n ? ` — eng yaqin shoxobcha ${Math.round(n.d)} m` : ''}`, 'bad'); }
      if (f <= 0.01) { if (FU.emptyT <= 0) game.banner("Yoqilg'i tugadi!", "Mashina zo'rg'a sudraladi. Shoxobchaga yeting yoki kanistr ishlating (do'konda sotiladi)", 'bad'); FU.emptyT = 60; }
      if (f > 20) FU.warned = false;
    } else lastP = null;
    if (FU.emptyT > 0) FU.emptyT -= dt;
    // quyish jarayoni
    const f = FU.fill;
    if (f) { const n = FU.pumpNear(car.p[0], car.p[2], 5);
      if (foot || !n || car.speed > 1.2) FU.stop("to'xtatildi");
      else { f.t += dt; const add = Math.min(14 * dt, 100 - FU.get(), (st.money - 0) / FUEL_PRICE); if (add > 0) { FU.set(FU.get() + add); f.acc = (f.acc || 0) + add * FUEL_PRICE; const pay = Math.floor(f.acc); if (pay > 0) { game.addMoney(-pay, 'Yoqilg\'i'); f.paid += pay; f.acc -= pay; } }
        if (FU.get() >= 99.9) FU.stop("bak to'ldi"); else if (st.money < FUEL_PRICE) FU.stop('pul tugadi'); } }
    // xodimlar
    const fp = foot ? game.player.p : car.p;
    for (const s of FU.stations) { const d = Math.hypot(s.ax - fp[0], s.az - fp[2]), vis = d < 140; s.rig.root.visible = vis; if (!vis) continue; if (s.wave > 0) s.wave -= dt;
      const near = d < 10; s.rig.root.rotation.y += (((near ? Math.atan2(fp[0] - s.ax, fp[2] - s.az) : s.ayaw) - s.rig.root.rotation.y + Math.PI * 3) % (Math.PI * 2) - Math.PI) * Math.min(1, dt * 3);
      poseRig(s.rig, s.wave > 0 || (FU.fill && FU.fill.s === s) ? 'wave' : 'idle', dt, 0); }
  };
  FU.prompt = () => { // transportdagi [E] taklifi
    if (game.player.onFoot || !FU.uses()) return null; const f = FU.fill;
    if (f) return `⛽ Quyilmoqda… ${Math.round(FU.get())}% · −${som(f.paid)} so'm`;
    const n = FU.pumpNear(car.p[0], car.p[2]); if (!n || car.speed > 1.5) return null;
    const need = Math.ceil((100 - FU.get()) * FUEL_PRICE); return need > 0 ? `<kbd>E</kbd> Yoqilg'i quyish · to'liq bak ${som(need)} so'm` : "Bak to'la ⛽";
  };
  return FU;
}
