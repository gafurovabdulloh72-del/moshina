// Tadbirlar: Bog'istonda to'y (bezatilgan hovli, dasturxon, karnay-doira, raqs, kortej), bozor kuni (qo'shimcha rastalar, olomon, sotuvchilar chaqirig'i), Navro'z sayli (sumalak qozoni, arg'imchoq, raqs) — o'yin taqvimi bo'yicha
import * as THREE from 'three';
import * as T from './terrain.js';
import * as COL from './colliders.js';
import { GB, MAT } from './geo.js';
import { makeRig, poseRig } from './rig.js';
import { KIND } from './fx.js';
import { WEEK, YEAR } from './obhavo.js';
import { clamp, angDiff, mulberry32 } from './util.js';

const hash = (n) => { const s = Math.sin(n * 91.7 + 17.3) * 43758.5453; return s - Math.floor(s); };
export const EV = { toy: ["To'y", '💍', '#ff6ab0', 14, 23], bozor: ['Bozor kuni', '🧺', '#7ad040', 7, 15], navruz: ["Navro'z sayli", '🌷', '#ffcc33', 8, 20] };
// taqvim: Navro'z — yil boshi (12 kunlik yilning 1-kuni), bozor — chorshanba va yakshanba, to'y — shanba (ba'zan payshanba)
export function eventsOn(d) { const yd = ((d % YEAR) + YEAR) % YEAR, wd = ((d % 7) + 7) % 7, out = []; if (yd === 0) { out.push('navruz'); return out; } if (wd === 2 || wd === 6) out.push('bozor'); if (wd === 5 || (wd === 3 && hash(d) < 0.5)) out.push('toy'); return out; }
const VISD = [100, 125, 150]; // tadbir odamlari ko'rinadigan masofa (sifat pog'onasi bo'yicha)
const CALLS = ['Olma, shirin olma!', 'Qovun — asaldek!', 'Keling, aka, tatib ko\'ring!', 'Arzon, arzon!', 'Issiq non, yangi non!', 'Uzum, mayiz, yong\'oq!', "Pomidor — o'z bog'imizdan!", 'Opa, qarab keting!'];

export function initTadbir(game) {
  const { scene } = game, st = game.state, W = game.dunyo, BG = game.site.places.bogiston, rnd = mulberry32(8812);
  const E = (game.tadbir = { force: null, act: {}, near: null });
  const loc = (b, a, c) => [b.x + a * Math.cos(b.yaw) + c * Math.sin(b.yaw), b.z - a * Math.sin(b.yaw) + c * Math.cos(b.yaw)];
  const gy = (x, z) => T.ground(x, z, 1e9).y;
  const meshOf = (g, mat = MAT.flat, shadow = true) => { const m = new THREE.Mesh(g.build(), mat); m.castShadow = shadow; m.receiveShadow = true; scene.add(m); return m; };
  const freeAt = (x, z, r) => { for (const o of COL.query(x, z, r + 1)) { let qx = o.x, qz = o.z; if (o.t === 1) { const sx = o.x2 - o.x, sz = o.z2 - o.z, t = clamp(((x - o.x) * sx + (z - o.z) * sz) / (sx * sx + sz * sz || 1), 0, 1); qx = o.x + sx * t; qz = o.z + sz * t; } if (Math.hypot(x - qx, z - qz) < o.r + r) return false; } return true; };
  const gb = (seed) => { const g = new GB(seed); g.jit = 0.02; return g; };
  const stallG = (g, x, z, y, yaw, hex, goods) => { g.push().translate(x, y, z).rotY(yaw).color(0x9a6a42).box(0, 0.85, 0, 2.6, 0.12, 1.3).color(0x6e4a30); for (const sx of [-1.2, 1.2]) for (const sz of [-0.55, 0.55]) g.box(sx, 1.2, sz, 0.1, 2.4, 0.1);
    g.color(hex).box(0, 2.5, 0.15, 3.0, 0.1, 1.9).color(0xf6f2ea).box(0, 2.45, 1.05, 3.0, 0.3, 0.06); for (let i = 0; i < 6; i++) g.color(goods[i % goods.length]).blob(0.17 + (i % 2) * 0.05, 0, { cx: -1.0 + i * 0.4, cy: 1.05, cz: -0.1 + (i % 2) * 0.25 }); g.pop(); };

  // ================= TO'Y: katta hovli-qo'rg'on (places.js) =================
  const Q = BG.qorgon, toy = { k: 'toy', seats: [], dance: null, c: null };
  if (Q) {
    const Y = Q.yaw, perm = gb(5101), dec = gb(5102), glow = gb(5103);
    // ikki uzun stol va o'rindiqlar (doimiy — hovlida turadi)
    for (const tx of [-4.2, 0.6]) { const [x, z] = loc(Q, tx, 4.5), y = gy(x, z); perm.push().translate(x, y, z).rotY(Y).color(0x8a5a36).box(0, 0.74, 0, 1.1, 0.07, 9).color(0x6e4a30); for (const sz of [-4.2, 4.2]) for (const sx of [-0.45, 0.45]) perm.box(sx, 0.37, sz, 0.08, 0.74, 0.08);
      perm.color(0x7a5232); for (const sx of [-1.0, 1.0]) { perm.box(sx, 0.43, 0, 0.42, 0.06, 9); perm.box(sx, 0.21, -4, 0.06, 0.42, 0.3).box(sx, 0.21, 4, 0.06, 0.42, 0.3); } perm.pop();
      COL.addBox(x, z, 0.6, 4.6, Y, y - 1, y + 0.8);
      for (let k = 0; k < 6; k++) for (const sx of [-1.0, 1.0]) { const [px, pz] = loc(Q, tx + sx, 4.5 - 3.6 + k * 1.45); toy.seats.push({ x: px, z: pz, y: gy(px, pz), yaw: Y + (sx < 0 ? Math.PI / 2 : -Math.PI / 2), used: null }); }
      // dasturxon: atlas yo'l, lagan osh, non, meva (faqat to'y kuni)
      dec.push().translate(x, y, z).rotY(Y).color(0xc8283a).box(0, 0.785, 0, 0.62, 0.012, 8.8).color(0xf0c040).box(0.33, 0.786, 0, 0.04, 0.014, 8.8).box(-0.33, 0.786, 0, 0.04, 0.014, 8.8);
      for (let k = 0; k < 5; k++) { const zz = -3.6 + k * 1.8; dec.push().translate(0, 0, zz).color(0xf2efe6).cyl(12, 0.26, 0.2, 0.79, 0.83, { cap: true }).color(0xe0a040).blob(0.2, 1, { cy: 0.86, sy: 0.4 }).color(0x8a4a2a).blob(0.06, 0, { cx: 0.05, cy: 0.94 }).pop(); // lagan osh
        dec.push().translate(0.3, 0, zz + 0.6).color(0xd89040).cyl(10, 0.13, 0.13, 0.79, 0.83, { cap: true }).pop().push().translate(-0.28, 0, zz - 0.6).color([0xe2572f, 0x7cc45a, 0xf0b83a][k % 3]).blob(0.12, 0, { cy: 0.88 }).pop(); } // non va meva
      dec.pop(); }
    meshOf(perm);
    // hovli ustidan bayroqcha va chiroq shodalari, darvozada lentalar, "To'yingiz muborak" yozuvi
    const garland = (a0, b0, a1, b1, h) => { const [x0, z0] = loc(Q, a0, b0), [x1, z1] = loc(Q, a1, b1), y0 = gy(x0, z0) + h, y1 = gy(x1, z1) + h, n = 18;
      let px = 0, py = 0, pz = 0; for (let i = 0; i <= n; i++) { const t = i / n, x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t, y = y0 + (y1 - y0) * t - Math.sin(t * Math.PI) * 0.9;
        if (i) { const l = Math.hypot(x - px, y - py, z - pz); dec.push().translate((x + px) / 2, (y + py) / 2, (z + pz) / 2).rotY(Math.atan2(x - px, z - pz)).rotX(-Math.asin((y - py) / l)).color(0x3a3a3a).box(0, 0, 0, 0.025, 0.025, l).pop(); } px = x; py = y; pz = z; /* arqon */ dec.push().translate(x, y, z).rotY(Math.atan2(x1 - x0, z1 - z0) + Math.PI / 2).color([0xd8283a, 0xf0c040, 0x2f9a58, 0x2f6fd0, 0xf4f4f0][i % 5]).box(0, -0.18, 0, 0.02, 0.32, 0.28, { tz: 0.05 }).pop(); glow.push().translate(x + 0.2, y - 0.05, z + 0.2).color([0xffe0a0, 0xffb0c8, 0xa0e0ff][i % 3]).blob(0.07, 0).pop(); } };
    garland(-18, 15, 18, -8, 4.6); garland(-18, -2, 18, 15, 4.4); garland(-12, 15.5, 12, 15.5, 4.2); garland(0, -4, 0, 15.5, 5);
    for (const [px, pz] of [[-18, 15], [18, -8], [-18, -2], [18, 15], [0, -4.5]]) { const [x, z] = loc(Q, px, pz), y = gy(x, z); dec.push().translate(x, y, z).color(0x6e4a30).cyl(6, 0.06, 0.05, 0, 5.2).pop(); }
    { const [x, z] = loc(Q, 0, 16.4), y = gy(x, z); dec.push().translate(x, y, z).rotY(Y); for (const sx of [-2.6, 2.6]) for (let i = 0; i < 5; i++) dec.color([0xf4f4f0, 0xd8283a, 0xf0c040][i % 3]).box(sx + (i - 2) * 0.08, 2.4 - i * 0.1, 0.7, 0.07, 2.2 + i * 0.25, 0.03);
      for (const sx of [-2.4, 2.4]) dec.color(0xe23a58).blob(0.3, 1, { cx: sx, cy: 3.8, cz: 0.7 }).color(0xf4f4f0).blob(0.26, 1, { cx: sx * 0.86, cy: 4.2, cz: 0.7 }); dec.pop(); }
    // kelin-kuyov o'rni (bosh stol, gul arkasi)
    { const [x, z] = loc(Q, -1.8, -2.6), y = gy(x, z); dec.push().translate(x, y, z).rotY(Y).color(0xf6f4ee).box(0, 0.75, 0, 2.6, 0.08, 0.9).color(0xe8e2d4).box(0, 0.38, 0, 2.5, 0.74, 0.8).color(0xf0d8e0); for (let i = 0; i < 11; i++) { const a = (i / 10) * Math.PI; dec.blob(0.22, 1, { cx: Math.cos(a) * 1.7, cy: 0.5 + Math.sin(a) * 2.4, cz: -0.8 }); } dec.pop();
      toy.head = [{ x: x - Math.cos(Y) * 0.5 - Math.sin(Y) * 0.8, z: z + Math.sin(Y) * 0.5 - Math.cos(Y) * 0.8, yaw: Y }, { x: x + Math.cos(Y) * 0.5 - Math.sin(Y) * 0.8, z: z - Math.sin(Y) * 0.5 - Math.cos(Y) * 0.8, yaw: Y }]; }
    // yozuv
    { const cv = document.createElement('canvas'); cv.width = 512; cv.height = 96; const cx = cv.getContext('2d'); cx.fillStyle = '#b8203a'; cx.fillRect(0, 0, 512, 96); cx.strokeStyle = '#f0c040'; cx.lineWidth = 6; cx.strokeRect(6, 6, 500, 84); cx.fillStyle = '#fff4dc'; cx.font = 'bold 50px Georgia, serif'; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillText("TO'YINGIZ MUBORAK!", 256, 50);
      const tx = new THREE.CanvasTexture(cv); tx.colorSpace = THREE.SRGBColorSpace; tx.anisotropy = 4; const m = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 0.98), new THREE.MeshBasicMaterial({ map: tx, side: THREE.DoubleSide, fog: true }));
      const [x, z] = loc(Q, 0, 16.9); m.position.set(x, gy(x, z) + 5.35, z); m.rotation.y = Y; toy.banner = m; scene.add(m); }
    toy.dec = meshOf(dec); toy.glow = meshOf(glow, MAT.glow, false);
    const [dx, dz] = loc(Q, -1.5, 12); toy.dance = { x: dx, z: dz }; toy.c = { x: Q.x, z: Q.z }; const [mx, mz] = loc(Q, -7.5, 12.5); toy.mus = { x: mx, z: mz, yaw: Y + Math.PI / 2 };
    // mehmonlar o'rni: o'tirganlar (stol), raqs doirasi
    const seated = [], ring = []; for (let i = 0; i < toy.seats.length; i += 2) { const s = toy.seats[i + (i % 4 ? 1 : 0)]; seated.push({ x: s.x, z: s.z, yaw: s.yaw, anim: i % 3 ? 'sit' : 'eat', seat: s }); }
    for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2; ring.push({ x: dx + Math.cos(a) * 2.6, z: dz + Math.sin(a) * 2.6, yaw: Math.atan2(-Math.cos(a), -Math.sin(a)), anim: 'dance', ring: a }); }
    toy.slots = [...ring.slice(0, 4), ...seated.slice(0, 5), ...ring.slice(4), ...seated.slice(5)]; // past sifatda ham raqs va dasturxon ko'rinsin
    E.toyRef = toy;
  }

  // ================= BOZOR: qishloq maydoni atrofida qo'shimcha rastalar =================
  const SQ = BG.square, bozor = { k: 'bozor', stalls: [], c: SQ ? { x: SQ.x, z: SQ.z } : null };
  if (SQ) {
    const g = gb(5201), GOODS = [[0xe2572f, 0xf0b83a, 0x7cc45a], [0xf0d060, 0x8ac050], [0xd83a2a, 0xe86a2a], [0x7a3aa0, 0x5ab040, 0xf0d070], [0xc89050, 0xe8d0a0], [0x3aa060, 0xf0b83a]], HEX = [0xd8392b, 0x2f9a58, 0xf0b83a, 0x2f6fd0, 0xb84ac8, 0xe86a2a, 0x2fb5b0, 0xd8283a];
    let n = 0; for (let r = 9; r < 30 && n < 9; r += 3.2) for (let k = 0; k < 12 && n < 9; k++) { const a = k * 0.5236 + r * 0.37, x = SQ.x + Math.cos(a) * r, z = SQ.z + Math.sin(a) * r;
      const nr = T.nearestRoad(x, z, 6); if (nr.edge >= 0 && nr.d < nr.hw + 2.5) continue; if (!freeAt(x, z, 2.2) || bozor.stalls.some((s) => Math.hypot(s.x - x, s.z - z) < 4.6)) continue;
      const h = [gy(x - 1.3, z), gy(x + 1.3, z), gy(x, z - 1), gy(x, z + 1)]; if (Math.max(...h) - Math.min(...h) > 0.7) continue;
      const y = Math.min(...h), yaw = Math.atan2(SQ.x - x, SQ.z - z); stallG(g, x, z, y, yaw, HEX[n % HEX.length], GOODS[n % GOODS.length]);
      const col = COL.addCircle(x, z, 1.35, y - 1, y + 2.6); col.dead = true; const sx = x - Math.sin(yaw) * 1.1, sz = z - Math.cos(yaw) * 1.1;
      bozor.stalls.push({ x, z, y, yaw, col, seller: { x: sx, z: sz, yaw } }); n++; }
    bozor.dec = meshOf(g);
    bozor.slots = bozor.stalls.map((s) => ({ x: s.seller.x, z: s.seller.z, yaw: s.yaw, anim: 'idle', seller: true }));
    for (let i = 0; i < 12; i++) bozor.slots.push({ wander: true, x: SQ.x + (rnd() - 0.5) * 16, z: SQ.z + (rnd() - 0.5) * 16, yaw: 0, anim: 'idle', tx: SQ.x, tz: SQ.z, wait: rnd() * 4 });
    E.bozorRef = bozor;
  }

  // ================= NAVRO'Z: qishloq chetidagi maydon =================
  const nav = { k: 'navruz', c: null };
  { const P = T.placeBy.bogiston; let spot = null;
    for (let r = 70; r < 190 && !spot; r += 6) for (let k = 0; k < 24 && !spot; k++) { const a = k * 0.2618 + r * 0.13, x = P.x + Math.cos(a) * r, z = P.z + Math.sin(a) * r, si = T.siteInfo(x, z);
      if (si.y < si.water + 1.5 || si.slope > 0.14 || si.roadD < 9 || si.roadD > 40) continue; let ok = true; for (let i = 0; i < 9 && ok; i++) { const b = (i / 9) * 6.283; if (!freeAt(x + Math.cos(b) * 9, z + Math.sin(b) * 9, 2.5) || Math.abs(gy(x + Math.cos(b) * 10, z + Math.sin(b) * 10) - si.y) > 1.4) ok = false; } if (ok && freeAt(x, z, 4)) spot = { x, z, y: si.y }; }
    if (spot) {
      const nr = T.nearestRoad(spot.x, spot.z, 50), yaw = nr.edge >= 0 ? Math.atan2(T.roads.x[nr.i] - spot.x, T.roads.z[nr.i] - spot.z) : 0, B = { x: spot.x, z: spot.z, yaw };
      const g = gb(5301), glow = gb(5302);
      // sumalak qozoni: o'choq, katta qozon, kapgir
      { const [x, z] = loc(B, 0, 0), y = gy(x, z); g.push().translate(x, y, z).color(0x8a4a32); for (let i = 0; i < 10; i++) { const a = (i / 10) * 6.283; g.box(Math.cos(a) * 1.05, 0.3, Math.sin(a) * 1.05, 0.5, 0.6, 0.36); } g.color(0x2a2a2e).cyl(16, 1.05, 0.7, 0.55, 1.25, { cap: false }).cyl(16, 0.7, 0.4, 0.15, 0.55).color(0x6a3a1a).cyl(16, 0.98, 0.98, 1.12, 1.16, { cap: true });
        g.color(0x8a6a42).push().translate(0.3, 1.2, 0.1).rotZ(-0.6).cyl(5, 0.035, 0.035, 0, 1.8).pop().pop(); glow.push().translate(x, y + 0.2, z).color(0xff7a22).blob(0.45, 0, { sy: 0.5 }).pop(); COL.addCircle(x, z, 1.25, y - 1, y + 1.3); nav.qozon = { x, z, y }; }
      // bezatilgan darvoza, bayroqlar, gul (lola) to'shamalari
      { const [x, z] = loc(B, 0, 12), y = gy(x, z); g.push().translate(x, y, z).rotY(yaw); for (const sx of [-3.2, 3.2]) g.color(0x2f9a58).box(sx, 2.2, 0, 0.3, 4.4, 0.3); g.color(0xf0c040).box(0, 4.5, 0, 7, 0.5, 0.35); for (let i = 0; i < 9; i++) g.color([0xd8283a, 0xf4f4f0, 0x2f9a58][i % 3]).blob(0.26, 1, { cx: -3.2 + i * 0.8, cy: 4.95, cz: 0 }); g.pop(); }
      for (let i = 0; i < 10; i++) { const a = (i / 10) * 6.283, [x, z] = loc(B, Math.cos(a) * 11, Math.sin(a) * 9), y = gy(x, z); g.push().translate(x, y, z).color(0x6e4a30).cyl(5, 0.05, 0.04, 0, 4).color([0xd8283a, 0x2f9a58, 0xf0c040, 0x2f6fd0, 0xf4f4f0][i % 5]).box(0.4, 3.6, 0, 0.8, 0.5, 0.02).pop(); }
      for (let i = 0; i < 40; i++) { const [x, z] = loc(B, (rnd() - 0.5) * 22, -8 + rnd() * 3), y = gy(x, z); g.push().translate(x, y, z).color(0x3a8a3a).cyl(4, 0.012, 0.012, 0, 0.32).color([0xd8283a, 0xe8b020, 0xe84a7a][i % 3]).blob(0.06, 0, { cy: 0.36, sy: 1.4 }).pop(); }
      // dasturxon stoli (sumalak kosalari, non, ko'k somsa)
      { const [x, z] = loc(B, -6, 1), y = gy(x, z); g.push().translate(x, y, z).rotY(yaw).color(0x8a5a36).box(0, 0.74, 0, 1.1, 0.07, 5).color(0xc8283a).box(0, 0.785, 0, 0.7, 0.012, 4.8); for (let k = 0; k < 6; k++) g.color(0xf2efe6).push().translate(0, 0, -2 + k * 0.8).cyl(10, 0.16, 0.11, 0.79, 0.86, { cap: true }).color(0x6a3418).cyl(10, 0.14, 0.14, 0.85, 0.855, { cap: true }).pop();
        g.color(0x6e4a30); for (const sz of [-2.3, 2.3]) for (const sx of [-0.45, 0.45]) g.box(sx, 0.37, sz, 0.08, 0.74, 0.08); g.color(0x7a5232); for (const sx of [-1, 1]) g.box(sx, 0.43, 0, 0.42, 0.06, 5); g.pop(); COL.addBox(x, z, 0.6, 2.6, yaw, y - 1, y + 0.8); nav.table = { x, z };
        nav.seats = []; for (let k = 0; k < 3; k++) for (const sx of [-1, 1]) { const [wx, wz] = loc(B, -6 + sx, -0.6 + k * 1.6); nav.seats.push({ x: wx, z: wz, yaw: yaw + (sx < 0 ? Math.PI / 2 : -Math.PI / 2) }); } }
      // arg'imchoq (ikki tirgak, ko'ndalang yog'och); o'rindiq va bola alohida harakatlanadi
      { const [x, z] = loc(B, 7, 2), y = gy(x, z); g.push().translate(x, y, z).rotY(yaw).color(0x8a5a36); for (const sx of [-1.4, 1.4]) { g.push().translate(sx, 0, 0).rotX(0.25).box(0, 1.8, 0, 0.14, 3.7, 0.14).pop().push().translate(sx, 0, 0).rotX(-0.25).box(0, 1.8, 0, 0.14, 3.7, 0.14).pop(); } g.box(0, 3.55, 0, 3.0, 0.16, 0.16).pop();
        const sg = gb(5303); sg.color(0xb0a080).box(-0.35, -1.45, 0, 0.02, 2.9, 0.02).box(0.35, -1.45, 0, 0.02, 2.9, 0.02).color(0xd8392b).box(0, -2.9, 0, 0.8, 0.06, 0.32); const sw = new THREE.Mesh(sg.build(), MAT.flat); sw.castShadow = true; sw.position.set(x, y + 3.5, z); sw.rotation.order = 'YXZ'; sw.rotation.y = yaw; scene.add(sw); nav.swing = { m: sw, x, z, y, yaw }; COL.addCircle(x, z, 0.4, y - 1, y + 3.6); }
      nav.dec = meshOf(g); nav.glow = meshOf(glow, MAT.glow, false); nav.c = { x: B.x, z: B.z }; nav.B = B;
      const [dx, dz] = loc(B, 0, 6); nav.dance = { x: dx, z: dz }; const [mx, mz] = loc(B, -3.5, 8.5); nav.mus = { x: mx, z: mz, yaw: yaw + Math.PI * 0.75 };
      nav.slots = [];
      for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; nav.slots.push({ x: dx + Math.cos(a) * 3, z: dz + Math.sin(a) * 3, yaw: Math.atan2(-Math.cos(a), -Math.sin(a)), anim: 'dance', ring: a }); }
      for (const s of nav.seats.slice(0, 4)) nav.slots.push({ x: s.x, z: s.z, yaw: s.yaw, anim: 'eat' });
      { const q = nav.qozon; nav.slots.push({ x: q.x + 1.6, z: q.z + 0.4, yaw: Math.atan2(-1.6, -0.4), anim: 'cook' }); nav.slots.push({ x: q.x - 1.4, z: q.z + 1.0, yaw: Math.atan2(1.4, -1.0), anim: 'talk' }); }
      nav.slots.push({ swing: true, x: nav.swing.x, z: nav.swing.z, yaw: yaw, anim: 'sit' });
      E.navRef = nav;
    }
  }

  // ================= ODAMLAR: umumiy rig hovuzi + doimiy musiqachilar, kelin-kuyov =================
  const LOOKS = [[0xf6f6f2, 0x1d1e22, 0], [0xd8283a, 0x2a2c33, 1], [0x2f6fd0, 0x3a3f4c, 0], [0xe8b020, 0x2a2c33, 1], [0x3fae5a, 0x4a3a2a, 0], [0x8a54c8, 0x2a2c33, 1], [0x6a8a9a, 0x2f2a26, 0], [0xe86a8a, 0x3a3a46, 1], [0x2a8a8a, 0x1d1e22, 0], [0xc84a2a, 0x2a2c33, 1], [0xe8e2d4, 0x4a3a2a, 0], [0x4a6ad8, 0x2a2c33, 1], [0x1d1e22, 0x1d1e22, 0], [0xf0b83a, 0x3a3f4c, 1], [0x9a3a2a, 0x2a2c33, 0], [0x2fb5b0, 0x3a3a46, 1]];
  const pool = LOOKS.map((l, i) => { const r = makeRig({ shirt: l[0], pants: l[1], long: !!l[2], seed: 900 + i * 17, vest: i % 5 === 0 ? 0x2a2c33 : undefined, hat: undefined }); r.root.visible = false; scene.add(r.root); return { rig: r, slot: null }; });
  const mkFixed = (o) => { const r = makeRig(o); r.root.visible = false; scene.add(r.root); return r; };
  const karnay = mkFixed({ shirt: 0x2a3a6a, pants: 0x1d1e22, seed: 951, vest: 0xc8a040, stache: true }), doira = mkFixed({ shirt: 0xd8283a, pants: 0x1d1e22, seed: 952, vest: 0x1d1e22 });
  { const k = gb(5401); k.color(0xd8b040).push().rotX(1.34).cyl(10, 0.022, 0.2, 0, 2.2, { cap: false }).color(0x8a6a2a).cyl(8, 0.03, 0.03, 0, 0.08, { cap: true }).pop(); const m = new THREE.Mesh(k.build(), MAT.flat); m.castShadow = true; m.position.set(0, 0.035, 0.1); karnay.head.add(m); // og'izdan oldinga va biroz yuqoriga — bosh ko'tarilgani bilan ~30°
    const d = gb(5402); d.push().rotX(Math.PI / 2).color(0x8a5a36).cyl(18, 0.27, 0.27, -0.04, 0.04).color(0xe8d8b0).cyl(18, 0.25, 0.25, 0.041, 0.042, { cap: true }).pop(); const dm = new THREE.Mesh(d.build(), MAT.flat); dm.position.set(0, 0.25, 0.42); doira.chest.add(dm); }
  const kelin = mkFixed({ shirt: 0xf8f6f0, pants: 0xf8f6f0, long: true, dress: true, seed: 953, hair: 0x2a1d16 }), kuyov = mkFixed({ shirt: 0xf6f6f2, pants: 0x1d1e22, seed: 954, vest: 0x1d1e22 });
  { const v = gb(5403); v.color(0xf6f4f0).blob(0.24, 1, { cy: 0.12, sy: 1.2 }); const m = new THREE.Mesh(v.build(), MAT.flat); m.position.set(0, 0.06, -0.05); kelin.head.add(m); } // kelin ro'moli
  const fixedRigs = [karnay, doira, kelin, kuyov];

  // ================= MUSIQA: sintez qilingan karnay, surnay va doira =================
  let bus = null, nextBeat = 0, beatN = 0;
  const HIJ = [62, 63, 66, 67, 69, 70, 72, 74, 75, 78]; // D hijoz (sharqona) tovushqatori
  const musicTick = (vol) => { const A = game.audio; if (!A.ready) return; const c = A.ctx; if (!bus) { bus = c.createGain(); bus.gain.value = 0; bus.connect(A.master); nextBeat = c.currentTime + 0.1; }
    bus.gain.setTargetAtTime(vol, c.currentTime, 0.3); if (vol < 0.005) { nextBeat = c.currentTime + 0.1; return; }
    const midi = (n) => 440 * Math.pow(2, (n - 69) / 12), bt = 60 / 132;
    while (nextBeat < c.currentTime + 0.25) { const t = nextBeat, b = beatN % 6, bar = Math.floor(beatN / 6);
      // doira: 6/8 usul — bum . tak tak . tak
      const hit = (f, q, v, d, type) => { const s = c.createBufferSource(); s.buffer = A.noiseBuf; const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q; const g = c.createGain(); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d); s.connect(fl); fl.connect(g); g.connect(bus); s.start(t, Math.random()); s.stop(t + d + 0.05); };
      if (b === 0) { hit(160, 0.8, 0.9, 0.28, 'lowpass'); A.tone(70, t, 0.25, 'sine', 0.5, bus, 0.003, 0.6); } if (b === 2 || b === 3 || b === 5) hit(2600, 1.2, b === 3 ? 0.55 : 0.35, 0.09, 'bandpass'); if (b === 4 && bar % 2) hit(5200, 2, 0.18, 0.05, 'highpass');
      // surnay kuyi: sawtooth + vibrato, har zarbda bir nota
      if (bar % 8 < 6 && (b === 0 || b === 2 || b === 3 || (b === 5 && bar % 2))) { const idx = (Math.floor(hash(bar * 7 + b) * 5) + (bar % 4) + (b === 0 ? 0 : 2)) % HIJ.length, f = midi(HIJ[idx] + 12), o = c.createOscillator(), lf = c.createOscillator(), lg = c.createGain(), fl = c.createBiquadFilter(), g = c.createGain();
        o.type = 'sawtooth'; o.frequency.setValueAtTime(f, t); lf.frequency.value = 6.2; lg.gain.value = f * 0.012; lf.connect(lg); lg.connect(o.frequency); fl.type = 'bandpass'; fl.frequency.value = f * 2.2; fl.Q.value = 1.6;
        const d = b === 0 ? bt * 1.9 : bt * 0.95; g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.16, t + 0.03); g.gain.setValueAtTime(0.14, t + d * 0.7); g.gain.exponentialRampToValueAtTime(0.0001, t + d); o.connect(fl); fl.connect(g); g.connect(bus); o.start(t); lf.start(t); o.stop(t + d + 0.05); lf.stop(t + d + 0.05); }
      // karnay: har 8 taktda uzun past sado (ikki nota)
      if (bar % 8 === 6 && b === 0) for (const [n, dt0, du] of [[45, 0, 2.2], [50, 2.3, 2.8]]) { const o = c.createOscillator(), fl = c.createBiquadFilter(), g = c.createGain(); o.type = 'sawtooth'; o.frequency.setValueAtTime(midi(n) * 0.98, t + dt0); o.frequency.linearRampToValueAtTime(midi(n), t + dt0 + 0.25); fl.type = 'lowpass'; fl.frequency.setValueAtTime(400, t + dt0); fl.frequency.linearRampToValueAtTime(1600, t + dt0 + 0.4);
        g.gain.setValueAtTime(0.0001, t + dt0); g.gain.linearRampToValueAtTime(0.3, t + dt0 + 0.25); g.gain.setValueAtTime(0.28, t + dt0 + du - 0.3); g.gain.exponentialRampToValueAtTime(0.0001, t + dt0 + du); o.connect(fl); fl.connect(g); g.connect(bus); o.start(t + dt0); o.stop(t + dt0 + du + 0.05); }
      nextBeat += bt / 2; beatN++; } };
  // sotuvchi chaqirig'i (qisqa "hoy!" — formant sirpanishi)
  const callSfx = (vol) => { const A = game.audio; if (!A.ready || vol < 0.02) return; const c = A.ctx, t = c.currentTime, o = c.createOscillator(), f1 = c.createBiquadFilter(), g = c.createGain(); o.type = 'sawtooth'; const f0 = 170 + Math.random() * 90; o.frequency.setValueAtTime(f0, t); o.frequency.linearRampToValueAtTime(f0 * 1.35, t + 0.18); o.frequency.linearRampToValueAtTime(f0 * 1.1, t + 0.5);
    f1.type = 'bandpass'; f1.frequency.setValueAtTime(700, t); f1.frequency.linearRampToValueAtTime(1100, t + 0.3); f1.Q.value = 4; g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.12 * vol, t + 0.05); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6); o.connect(f1); f1.connect(g); g.connect(A.master); o.start(t); o.stop(t + 0.65); };

  // nutq pufakchasi (sotuvchi ustida)
  const bub = document.createElement('div'); bub.style.cssText = 'position:fixed;left:0;top:0;pointer-events:none;display:none;z-index:4;background:#fffdf4;color:#2a2418;font:600 14px system-ui,sans-serif;padding:6px 10px;border-radius:12px;box-shadow:0 2px 8px #0005;transform:translate(-50%,-100%);white-space:nowrap';
  document.body.appendChild(bub); let bubT = 0, bubAt = null; const V3 = new THREE.Vector3();

  // ================= HOLAT =================
  const REFS = { toy: E.toyRef, bozor: E.bozorRef, navruz: E.navRef };
  E.today = (d = st.dunyo.day) => eventsOn(d);
  E.isActive = (k) => { if (E.force) return E.force === k; const ev = EV[k], h = game.hour; return eventsOn(st.dunyo.day).includes(k) && h >= ev[3] && h < ev[4]; };
  E.set = (k) => { E.force = k && EV[k] ? k : null; refresh(true); return E.force; };
  E.upcoming = (n = 6) => { const out = [], d0 = st.dunyo.day; for (let d = d0; d < d0 + YEAR + 1 && out.length < n; d++) for (const k of eventsOn(d)) { if (d === d0 && game.hour >= EV[k][4]) continue; out.push({ k, d, in: d - d0 }); } return out; };
  const visGroup = (ref, on) => { if (!ref) return; for (const m of [ref.dec, ref.glow, ref.banner]) if (m) m.visible = on; if (ref.stalls) for (const s of ref.stalls) s.col.dead = !on; };
  let lastAct = '';
  const refresh = (force) => { const a = {}; for (const k in EV) a[k] = E.isActive(k) && !!REFS[k]; const key = JSON.stringify(a); if (!force && key === lastAct) return; lastAct = key; E.act = a;
    visGroup(E.toyRef, a.toy); visGroup(E.bozorRef, a.bozor); visGroup(E.navRef, a.navruz); if (!a.toy && !a.navruz) for (const r of fixedRigs) r.root.visible = false; };
  // to'y kortejini boshqarish (to'y kuni 12:00–15:00)
  const convoyWanted = () => (E.force === 'toy' && E.convoyForce !== false) || E.convoyForce === true || (!E.force && eventsOn(st.dunyo.day).includes('toy') && game.hour >= 12 && game.hour < 15);
  let annDay = -1, danceT = 0, dutT = 0;
  W.onDay = () => { annDay = -1; };

  // E tugmasi bilan harakatlar
  const L = game.live, pl = game.player, ex0 = L.extra;
  const seatPl = (s) => { pl.p[0] = s.x; pl.p[2] = s.z; pl.p[1] = gy(s.x, s.z); pl.yaw = s.yaw; pl.v[0] = pl.v[2] = 0; pl.sit = true; pl.emote = null; E.seat = s; };
  L.extra = (offer, px, pz, p) => { if (ex0) ex0(offer, px, pz, p); if (game.interior && game.interior.inside) return;
    if (E.act.toy && E.toyRef) { const t = E.toyRef;
      if (E.seat && pl.sit && Math.hypot(E.seat.x - px, E.seat.z - pz) < 0.6) { offer(-1, "<kbd>E</kbd> To'y oshini yeyish 🍚", () => { pl.act('eat', 3.4, () => { st.sat = 100; st.energy = Math.min(100, st.energy + 25); st.thirst = Math.min(100, (st.thirst || 0) + 20); pl.sit = true; game.audio.sfx('eat');
        if (st.dunyo.toy !== st.dunyo.day) { st.dunyo.toy = st.dunyo.day; st.karma = (st.karma || 0) + 3; game.toast("💍 «To'yingiz muborak!» — mezbonlar sizni duo qilishdi · to'qlik 100 %, ❤ +3", 'gold'); } else game.toast("🍚 Mazali to'y oshi! To'qlik 100 %", 'good'); }); }); }
      else for (const s of t.seats) { const d = Math.hypot(s.x - px, s.z - pz); if (d < 1.4 && !s.used) offer(d - 0.4, "<kbd>E</kbd> To'y dasturxoniga o'tirish 🎉", () => seatPl(s)); } }
    if (E.act.bozor && E.bozorRef) for (const s of E.bozorRef.stalls) { const d = Math.hypot(s.x - px, s.z - pz) - 1.3; if (d < 1.6) offer(d, '<kbd>E</kbd> Bozor rastasi (sotish va xarid) 🧺', () => game.ui.open('shop')); }
    if (E.act.navruz && E.navRef) { const n = E.navRef, q = n.qozon, d = Math.hypot(q.x - px, q.z - pz) - 1.2;
      if (d < 1.5) offer(d, "<kbd>E</kbd> Sumalak kavlash 🥣", () => { pl.yaw = Math.atan2(q.x - pl.p[0], q.z - pl.p[2]); pl.act('cook', 3.2, () => { if (st.dunyo.nav !== st.dunyo.day) { st.dunyo.nav = st.dunyo.day; st.karma = (st.karma || 0) + 3; game.addMoney(20, "Navro'z sovg'asi"); game.toast("🌷 Navro'z muborak! Sumalak kavlaganingiz uchun ❤ +3 va 20 so'm sovg'a", 'gold'); } else game.toast('🥣 Sumalak qaynayapti — tun bo\'yi kavlanadi!', 'good'); }); });
      const td = Math.hypot(n.table.x - px, n.table.z - pz) - 0.8; if (td < 1.6) offer(td, "<kbd>E</kbd> Sumalak tatib ko'rish 😋", () => { pl.act('drink', 1.6, () => { st.sat = Math.min(100, st.sat + 30); st.energy = Math.min(100, st.energy + 15); game.audio.sfx('eat'); game.toast("😋 Shirin sumalak! To'qlik +30", 'good'); }); }); }
  };

  E.update = (dt) => {
    refresh(false);
    const cp = game.camera.position, foot = pl.onFoot, pp = foot ? pl.p : game.car.p, q = st.set.gfx, inside = game.interior && game.interior.inside;
    // kortej
    if (game.shahar) game.shahar.convoy(convoyWanted());
    // xaritada belgi va e'lon
    const dots = L.dots, today = eventsOn(st.dunyo.day);
    for (const k of today) { const r = REFS[k]; if (r && r.c && game.hour < EV[k][4]) dots.push([r.c.x, r.c.z, EV[k][2], E.act[k] ? 1 : 0]); }
    if (E.force && REFS[E.force] && REFS[E.force].c && !today.includes(E.force)) dots.push([REFS[E.force].c.x, REFS[E.force].c.z, EV[E.force][2], 1]);
    const upk = today.filter((k) => game.hour < EV[k][4]); // tugagan tadbir e'lon qilinmaydi (ilgari soat 16 da «bugun bozor 7–15» deb chiqardi)
    if (game.mode === 'play' && annDay !== st.dunyo.day && game.hour >= 7.5 && game.hour < 18 && upk.length) { annDay = st.dunyo.day; const k = upk[0]; game.toast(`${EV[k][1]} Bugun Bog'istonda — ${EV[k][0]} (${EV[k][3]}:00–${EV[k][4]}:00). Xaritada belgilangan`, 'gold'); }
    // eng yaqin faol tadbir
    let near = null, nd = 1e9; for (const k in E.act) if (E.act[k]) { const r = REFS[k], d = Math.hypot(r.c.x - cp.x, r.c.z - cp.z); if (d < nd) { nd = d; near = r; } }
    E.near = near; E.nearD = nd;
    const live = near && nd < 190 && !inside;
    // musiqa (to'y va Navro'z)
    const musVol = live && near.mus ? Math.pow(clamp(1 - nd / 170, 0, 1), 1.6) * 0.55 * (game.mode === 'ui' ? 0.3 : 1) : 0; musicTick(musVol);
    // odamlarni o'rniga qo'yish
    const maxN = [6, 11, pool.length][q], slots = live ? near.slots : [];
    for (let i = 0; i < pool.length; i++) { const P = pool[i], s = i < maxN ? slots[i] : null; if (P.slot !== s) { P.slot = s; P.rig.root.visible = !!s; if (s) { P.rig.root.position.set(s.x, gy(s.x, s.z), s.z); P.rig.root.rotation.set(0, s.yaw, 0); } } }
    // o'yinchi o'tirgan joy band
    if (E.seat && ((!pl.sit && pl.lockAnim !== 'eat') || !foot)) E.seat = null;
    const t = game.time;
    for (let i = 0; i < Math.min(maxN, slots.length); i++) { const P = pool[i], s = P.slot, r = P.rig; if (!s) continue; const d = Math.hypot(s.x - cp.x, s.z - cp.z);
      if (s.seat && E.seat === s.seat) { r.root.visible = false; continue; } r.root.visible = d < VISD[q];
      let an = s.anim, sp = 0;
      if (s.wander) { if (s.wait > 0) { s.wait -= dt; } else { const dx = s.tx - s.x, dz = s.tz - s.z, dl = Math.hypot(dx, dz); if (dl < 0.4) { const st2 = E.bozorRef.stalls[(rnd() * E.bozorRef.stalls.length) | 0]; s.tx = st2 ? st2.x + Math.sin(st2.yaw) * 2.2 + (rnd() - 0.5) * 2 : near.c.x; s.tz = st2 ? st2.z + Math.cos(st2.yaw) * 2.2 + (rnd() - 0.5) * 2 : near.c.z; s.wait = 2 + rnd() * 5; } else { const v = 1.2; s.x += dx / dl * v * dt; s.z += dz / dl * v * dt; s.yaw = Math.atan2(dx, dz); an = 'walk'; sp = v; } }
        r.root.position.set(s.x, gy(s.x, s.z), s.z); r.root.rotation.y += angDiff(s.yaw, r.root.rotation.y) * Math.min(1, dt * 6); }
      else if (s.ring != null) { const a = s.ring + t * 0.25, c = s.ring >= 0 ? (near.dance) : null; if (c) { const R = near === E.toyRef ? 2.6 : 3; const x = c.x + Math.cos(a) * R, z = c.z + Math.sin(a) * R; r.root.position.set(x, gy(x, z), z); r.root.rotation.y = Math.atan2(c.x - x, c.z - z) + Math.sin(t * 1.3 + i) * 0.6; } }
      else if (s.swing) { const sw = near.swing, ang = Math.sin(t * 1.9) * 0.55; sw.m.rotation.x = ang; const R = 2.9; r.root.position.set(sw.x + Math.sin(sw.yaw) * Math.sin(ang) * R, sw.y + 3.5 - Math.cos(ang) * R - 0.48, sw.z + Math.cos(sw.yaw) * Math.sin(ang) * R); r.root.rotation.y = sw.yaw; r.root.rotation.x = ang; }
      else if (s.seller && near === E.bozorRef) { const dd = Math.hypot(pp[0] - s.x, pp[2] - s.z); an = dd < 6 ? 'wave' : (Math.sin(t * 0.7 + i) > 0.6 ? 'talk' : 'idle'); }
      if (d < 70 || (Math.floor(t * 20) + i) % 3 === 0) { r.actDur = 99; poseRig(r, an, d < 70 ? dt : dt * 3, sp); } }
    if (near !== E.navRef && E.navRef && E.navRef.swing) E.navRef.swing.m.rotation.x *= 0.98;
    // musiqachilar va kelin-kuyov
    const showFixed = live && near.mus;
    if (showFixed) { const m = near.mus, c = Math.cos(m.yaw), sn = Math.sin(m.yaw); const pos = [[m.x, m.z], [m.x + c * 1.2, m.z - sn * 1.2]];
      [karnay, doira].forEach((r, k) => { r.root.visible = nd < 160; r.root.position.set(pos[k][0], gy(pos[k][0], pos[k][1]), pos[k][1]); r.root.rotation.y = m.yaw; r.actDur = 99; if (nd < 90) poseRig(r, k ? 'play' : 'horn', dt, 0); });
      const hd = near === E.toyRef && E.toyRef.head; [kelin, kuyov].forEach((r, k) => { r.root.visible = !!hd && nd < 160; if (hd) { r.root.position.set(hd[k].x, gy(hd[k].x, hd[k].z), hd[k].z); r.root.rotation.y = hd[k].yaw; r.actDur = 99; if (nd < 90) poseRig(r, 'sit', dt, 0); } }); }
    else for (const r of fixedRigs) if (r.root.visible) r.root.visible = false;
    // Navro'z: qozondan bug', o'choqdan uchqun
    if (live && near === E.navRef && game.fx && Math.random() < dt * 6) { const qz = near.qozon; game.fx.emit(qz.x + (Math.random() - 0.5) * 0.8, qz.y + 1.25, qz.z + (Math.random() - 0.5) * 0.8, 0.1, 0.6, 0.05, 2.4, 0.5, [0.9, 0.9, 0.92], 0.18, 3, -0.15, 0.6, KIND.SMOKE); if (Math.random() < 0.5) game.fx.emit(qz.x + (Math.random() - 0.5) * 0.6, qz.y + 0.25, qz.z + (Math.random() - 0.5) * 0.6, 0, 1.2, 0, 0.5, 0.35, [2.4, 1.1, 0.3], 0.8, 0.5, -1, 0.5, KIND.FIRE); }
    // o'yinchi raqsga tushsa (1-tugma) — mehmonlar olqishlaydi, kuniga bir marta sovg'a
    if (live && near.dance && foot && pl.emote === 'dance' && Math.hypot(pp[0] - near.dance.x, pp[2] - near.dance.z) < 7) { danceT += dt; if (danceT > 6) { danceT = -999; const key = near === E.toyRef ? 'toy' : 'nav'; const dk = 'd' + key; if (st.dunyo[dk] !== st.dunyo.day) { st.dunyo[dk] = st.dunyo.day; st.karma = (st.karma || 0) + 2; game.addMoney(15, near === E.toyRef ? "To'yda raqs" : "Navro'zda raqs"); game.toast('👏 Mehmonlar qarsak chalib olqishladi! ❤ +2, 15 so\'m', 'gold'); } else game.toast('👏 Qoyil! Davra qizidi', 'good'); } } else if (danceT > 0) danceT = 0; else if (danceT < 0 && pl.emote !== 'dance') danceT = 0;
    // bozor: sotuvchilar chaqiradi (pufakcha + ovoz)
    bubT -= dt;
    if (live && near === E.bozorRef && bubT <= 0) { bubT = 3.5 + Math.random() * 4; let best = null, bd = 30; for (const s of near.stalls) { const d = Math.hypot(s.seller.x - pp[0], s.seller.z - pp[2]); if (d < bd && Math.random() < 0.6) { bd = d; best = s; } } if (best) { bubAt = best.seller; bub.textContent = CALLS[(Math.random() * CALLS.length) | 0]; bub.style.display = 'block'; dutT = 2.6; callSfx(clamp(1 - bd / 30, 0, 1)); } }
    if (dutT > 0 && bubAt && game.mode === 'play' && !inside) { /* binoga kirganda pufakcha ekranda osilib qolmaydi */ dutT -= dt; V3.set(bubAt.x, gy(bubAt.x, bubAt.z) + 2.2, bubAt.z).project(game.camera); if (V3.z < 1 && Math.abs(V3.x) < 1.1 && Math.abs(V3.y) < 1.1) { bub.style.left = ((V3.x + 1) / 2) * innerWidth + 'px'; bub.style.top = ((1 - V3.y) / 2) * innerHeight + 'px'; bub.style.display = 'block'; } else bub.style.display = 'none'; if (dutT <= 0) bub.style.display = 'none'; }
    else if (bub.style.display !== 'none' && (dutT <= 0 || game.mode !== 'play' || inside)) bub.style.display = 'none';
    void foot;
  };
  E.phoneHtml = () => { const up = E.upcoming(5), d0 = st.dunyo.day;
    return `<div class="ph-list">${up.map((u) => { const ev = EV[u.k], when = u.in === 0 ? (E.isActive(u.k) ? 'Hozir davom etmoqda' : `Bugun ${ev[3]}:00 da`) : u.in === 1 ? `Ertaga, ${ev[3]}:00` : `${u.in} kundan keyin (${WEEK[((u.d % 7) + 7) % 7]})`; return `<div><span>${ev[1]} ${ev[0]}<small>${when} · Bog'iston</small></span><b style="color:${ev[2]}">●</b></div>`; }).join('') || '<p class="ph-empty">Yaqin kunlarda tadbir yo\'q</p>'}</div><p class="ph-empty">${void d0 || ''}To'yda dasturxonga o'tiring, raqsga tushing (1). Navro'zda sumalak kavlang</p>`; };
  refresh(true); game.hooks.push(E.update);
  return E;
}
