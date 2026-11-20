// Gavjum qishloq ko'chalari: Bog'iston chorrahasida svetofor va piyodalar o'tish joylari, ko'chalarda qo'shimcha mashinalar (InstancedMesh) va piyodalar (sifatga qarab soni), to'y korteji
import * as THREE from 'three';
import * as T from './terrain.js';
import * as COL from './colliders.js';
import { GB, MAT } from './geo.js';
import { makeRig, poseRig } from './rig.js';
import { clamp, smoothstep, angDiff, mulberry32 } from './util.js';

const PAINT = [0xf2f2ee, 0xc4c7cc, 0x6b6f75, 0x1c1d21, 0x22324e, 0x5c1a1c, 0xd6cbb2, 0x34503e, 0x2f6fb8, 0x8a2a20, 0xe8e4da, 0x3a3c40];
// svetofor fazalari (soniya): A yashil, A sariq, B yashil, B sariq, hamma qizil (piyodalar o'tadi)
const PH = [['A', 14], ['a', 3], ['B', 10], ['b', 3], ['P', 9]];
const CYC = PH.reduce((s, p) => s + p[1], 0);

export function initShahar(game) {
  const { scene } = game, R = T.roads, life = game.life, rnd = mulberry32(5581);
  const S = (game.shahar = { cars: [], walkers: [], phase: 'A', convoyOn: false, ph: { k: 'A', left: 14 } });
  const node = R.nodeBy.vil, NID = R.nodes.indexOf(node), C = { x: node.x, z: node.z }, RT = 560;
  const lanes = life.lanes.filter((g) => { for (let j = 0; j < g.n; j += 4) if (Math.hypot(g.X[j] - C.x, g.Z[j] - C.z) < RT) return true; return false; });
  // --- chorraha: yo'llar yo'nalishi, faza guruhlari ---
  const arms = node.edges.map((ei) => { const e = R.edges[ei], a = e.a === NID, n = e.count, idx = []; for (let k = 0; k < n; k++) idx.push(e.start + (a ? k : n - 1 - k));
    const at = (d) => { let acc = 0; for (let k = 1; k < idx.length; k++) { const i0 = idx[k - 1], i1 = idx[k], l = Math.hypot(R.x[i1] - R.x[i0], R.z[i1] - R.z[i0]); if (acc + l >= d) { const f = (d - acc) / (l || 1); return { x: R.x[i0] + (R.x[i1] - R.x[i0]) * f, z: R.z[i0] + (R.z[i1] - R.z[i0]) * f, y: R.y[i0] + (R.y[i1] - R.y[i0]) * f, tx: (R.x[i1] - R.x[i0]) / (l || 1), tz: (R.z[i1] - R.z[i0]) / (l || 1) }; } acc += l; } const i = idx[idx.length - 1]; return { x: R.x[i], z: R.z[i], y: R.y[i], tx: 1, tz: 0 }; };
    const p = at(20); return { ei, e, hw: e.hw, at, dx: (p.x - C.x) / 20, dz: (p.z - C.z) / 20, grp: 'B' }; });
  { let best = 9, bi = 0, bj = 1; for (let i = 0; i < arms.length; i++) for (let j = i + 1; j < arms.length; j++) { const d = arms[i].dx * arms[j].dx + arms[i].dz * arms[j].dz; if (d < best) { best = d; bi = i; bj = j; } } arms[bi].grp = arms[bj].grp = 'A'; }
  const grpOf = {}; for (const a of arms) grpOf[a.ei] = a.grp;
  const phaseAt = (t) => { let u = ((t % CYC) + CYC) % CYC; for (const p of PH) { if (u < p[1]) return { k: p[0], left: p[1] - u }; u -= p[1]; } return { k: 'A', left: 1 }; };
  S.nightMode = () => S.forceNight != null ? S.forceNight : game.hour >= 23.5 || game.hour < 5; // yarim tundan tonggacha
  // shu yo'ldan kelgan mashina to'xtashi kerakmi (qizil/sariq yoki o'tish joyida piyoda)
  const pedOn = () => S.walkers.some((w) => w.cross && w.cross.t > 0.02 && w.cross.t < 0.98);
  const mustStop = (edge, gap) => { const ph = S.ph; if (pedOn()) return true; if (ph.k === 'N') return false; /* tunda svetofor sariq miltillaydi — to'xtamasdan, ehtiyot bo'lib o'tiladi */ const g = grpOf[edge]; if (!g) return false; if (ph.k === g) return false; if (ph.k === g.toLowerCase()) return gap > 6; return true; };
  // life.js mashinalari uchun: marshrutda chorrahagacha masofa
  // chorrahadan keyingi chiqish bo'lagi tiqilib qolganmi — bo'lsa chorrahaga kirmaydi (aks holda ichida qolib, yashil bo'lgan ko'ndalang oqim bilan bir-birining ichiga kirardi)
  const onExit = (B, x, z, yaw) => { const tx = B.TX[0], tz = B.TZ[0], dx = x - B.X[0], dz = z - B.Z[0], al = dx * tx + dz * tz; return al > -2 && al < 9 && Math.abs(dx * tz - dz * tx) < 1.6 && Math.sin(yaw) * tx + Math.cos(yaw) * tz > 0.7; }; // shu bo'lakda, shu yo'nalishda (qarshi bo'lakdagi navbat hisoblanmaydi)
  const exitBlocked = (B, self) => { if (!B || !B.n || !B.TX) return false; for (const o of life.cars) if (o !== self && o.placed && o.v < 2.5 && onExit(B, o.x, o.z, o.yaw)) return true; for (const o of cars) if (o.on && o.v < 2.5 && onExit(B, o.x, o.z, o.yaw)) return true; return false; };
  // chorraha ichida ko'ndalang yo'nalishdagi mashina bormi (chapga burilayotgan qarshi oqim ham) — bo'lsa to'xtash chizig'ida kutadi
  const jIn = (x, z) => (x - C.x) ** 2 + (z - C.z) ** 2 < 144;
  const compat = (sA, tA, sB, tB) => sA === sB || (Math.abs(tA) < 0.5 && Math.abs(tB) < 0.5 && grpOf[sA] && grpOf[sA] === grpOf[sB]);
  const junctionBusy = (src, turn, self) => { for (const o of life.cars) { if (o === self || !o.placed || !jIn(o.x, o.z)) continue; const g = o.route[o.ri]; if (!g || !g.conn || g.node !== NID || o.ri < 1) continue; if (!compat(src, turn, o.route[o.ri - 1].edge, g.turn)) return true; }
    for (const o of cars) { if (o === self || !o.on || !o.seg || !o.seg.conn || o.seg.node !== NID || !jIn(o.x, o.z)) continue; if (!compat(src, turn, o.src, o.seg.turn)) return true; } return false; };
  S.stopFor = (c) => { let base = -c.s; for (let k = c.ri; k < c.route.length && base < 90; k++) { const g = c.route[k]; if (!g.conn && g.to === NID) { const gap = base + g.L - c.half - 4; if (gap > -1.5 && (mustStop(g.edge, gap) || (gap > 0.5 && (exitBlocked(c.route[k + 2], c) || (c.route[k + 1] && junctionBusy(g.edge, c.route[k + 1].turn || 0, c)))))) return Math.max(0.2, gap); return null; } base += g.L; } return null; };
  life.stopFor = S.stopFor;

  // --- svetofor ustunlari va zebra (bitta geometriya), chiroq rangi — 6 ta material (rang o'zgaradi, sheyder emas) ---
  const lm = {}; for (const g of ['A', 'B']) for (const c of ['r', 'y', 'g']) lm[g + c] = new THREE.MeshBasicMaterial({ color: 0x222222, fog: true });
  const pole = new GB(4411); pole.jit = 0.01;
  const zeb = new GB(4415); zeb.jit = 0;
  S.zebras = [];
  for (const a of arms) {
    // zebra: chorrahadan 15 m da, yo'l bo'ylab yo'l-yo'l
    const z = a.at(15), nx = -z.tz, nz = z.tx, y = T.ground(z.x, z.z, 1e9).y;
    zeb.color(0xe8e6de); for (let k = -4; k <= 4; k++) { const ox = z.x + nx * k * 1.05, oz = z.z + nz * k * 1.05, oy = T.ground(ox, oz, y + 2).y; zeb.push().translate(ox, oy + 0.025, oz).rotY(Math.atan2(z.tx, z.tz)).box(0, 0, 0, 0.55, 0.03, 2.6).pop(); }
    S.zebras.push({ x: z.x, z: z.z, nx, nz, hw: a.hw, arm: a });
    // ustun: kelayotgan mashina o'ng tomonida, to'xtash chizig'ida (17 m)
    for (const side of [1]) { const p = a.at(18.5), px = p.x + p.tz * (a.hw + 1.3) * side, pz = p.z - p.tx * (a.hw + 1.3) * side, py = T.ground(px, pz, 1e9).y, yaw = Math.atan2(p.tx, p.tz);
      pole.color(0x2c2e33).push().translate(px, py, pz).rotY(yaw).cyl(8, 0.07, 0.06, 0, 3.4).box(0, 3.25, 0.02, 0.36, 1.0, 0.24).color(0xe0b020).box(0, 3.25, -0.11, 0.42, 1.06, 0.02).pop();
      a.lamp = { x: px, z: pz }; COL.addCircle(px, pz, 0.1, py - 1, py + 3.8); } // ustun to'qnashadi (ilgari mashina ichidan o'tib ketardi)
  }
  { const m = new THREE.Mesh(pole.build(), MAT.flat); m.castShadow = true; scene.add(m); const zm = new THREE.Mesh(zeb.build(), MAT.flat); zm.receiveShadow = true; scene.add(zm); }
  // har guruhning chirog'i alohida mesh (o'z materiali bilan); geometriya ustunlar bo'yicha guruhga ajratiladi
  for (const gk of ['A', 'B']) for (const c of ['r', 'y', 'g']) { const gb = new GB(4420); gb.jit = 0; for (const a of arms) if (a.grp === gk && a.lamp) { const p = a.at(18.5), px = p.x + p.tz * (a.hw + 1.3), pz = p.z - p.tx * (a.hw + 1.3), py = T.ground(px, pz, 1e9).y; gb.push().translate(px, py, pz).rotY(Math.atan2(p.tx, p.tz)).translate(0, c === 'r' ? 3.57 : c === 'y' ? 3.25 : 2.93, 0.14).rotX(Math.PI / 2).color(0xffffff).cyl(10, 0.11, 0.11, -0.03, 0.03, { cap: true }).pop(); }
    const geo = gb.build(); const m = new THREE.Mesh(geo, lm[gk + c]); scene.add(m); }
  const setLamps = () => { const k = S.ph.k, blink = Math.sin(game.time * 6) > 0;
    if (k === 'N') { const on = Math.sin(game.time * 4.2) > 0; for (const g of ['A', 'B']) { lm[g + 'r'].color.setRGB(0.12, 0.03, 0.03); lm[g + 'g'].color.setRGB(0.02, 0.1, 0.04); lm[g + 'y'].color.setRGB(...(on ? [3.0, 1.9, 0.2] : [0.12, 0.09, 0.02])); } return; } for (const g of ['A', 'B']) { const gr = k === g, ye = k === g.toLowerCase();
    lm[g + 'r'].color.setRGB(...(!gr && !ye ? [3.2, 0.25, 0.12] : [0.12, 0.03, 0.03])); lm[g + 'y'].color.setRGB(...(ye ? [3.0, 1.9, 0.2] : [0.12, 0.09, 0.02])); lm[g + 'g'].color.setRGB(...(gr && !(S.ph.left < 2.5 && blink) ? [0.25, 2.9, 0.8] : [0.02, 0.1, 0.04])); } };

  // --- mashina modeli: kuzov (bo'yaladi), tafsilotlar, chiroqlar — 3 ta InstancedMesh ---
  const NC = 14;
  const bodyG = new GB(4431); bodyG.jit = 0.015; bodyG.color(0xffffff).box(0, 0.62, 0, 1.74, 0.5, 4.15, { tx: 0.97, tz: 0.97 }).box(0, 1.08, -0.25, 1.6, 0.44, 2.1, { tx: 0.86, tz: 0.72, oz: -0.05 });
  const detG = new GB(4432); detG.jit = 0.02; detG.color(0x1a1c22).box(0, 1.08, -0.25, 1.62, 0.36, 1.9, { tx: 0.86, tz: 0.7, oz: -0.05 });
  detG.color(0x16171a); for (const [x, z] of [[0.78, 1.32], [-0.78, 1.32], [0.78, -1.32], [-0.78, -1.32]]) detG.push().translate(x, 0.34, z).prismX(10, 0.34, 0.24).pop();
  detG.color(0x2a2b30).box(0, 0.42, 2.09, 1.7, 0.18, 0.12).box(0, 0.42, -2.09, 1.7, 0.18, 0.12);
  const lampCG = new GB(4433); lampCG.jit = 0; lampCG.color(0xfff2d6).box(0.6, 0.66, 2.08, 0.36, 0.13, 0.04).box(-0.6, 0.66, 2.08, 0.36, 0.13, 0.04).color(0xe0281a).box(0.66, 0.7, -2.08, 0.3, 0.12, 0.04).box(-0.66, 0.7, -2.08, 0.3, 0.12, 0.04);
  // korteж bezagi: kapotda lentalar (V), tomda sharlar, gullar
  const decG = new GB(4434); decG.jit = 0.02;
  decG.color(0xf4f4f0).push().translate(0, 0.9, 1.0).rotY(0.55).box(0, 0, 0, 0.12, 0.02, 2.1).pop().push().translate(0, 0.9, 1.0).rotY(-0.55).box(0, 0, 0, 0.12, 0.02, 2.1).pop();
  decG.color(0xd8283a).push().translate(0, 0.91, 1.0).rotY(0.55).box(0, 0, 0, 0.05, 0.02, 2.1).pop().push().translate(0, 0.91, 1.0).rotY(-0.55).box(0, 0, 0, 0.05, 0.02, 2.1).pop();
  decG.color(0xf2d2dc).blob(0.2, 1, { cx: 0, cy: 0.92, cz: 1.95 }); decG.color(0xe23a58).blob(0.12, 1, { cx: 0, cy: 1.02, cz: 1.98 });
  for (const [x, z, c] of [[0.5, -0.2, 0xe23a58], [-0.5, -0.2, 0xf4f4f0], [0.5, -0.9, 0xf4c43a], [-0.5, -0.9, 0xe23a58]]) decG.color(0x9a9a9a).push().translate(x, 1.3, z).cyl(4, 0.008, 0.008, 0, 0.6).pop().color(c).blob(0.17, 1, { cx: x, cy: 2.05, cz: z, sy: 1.15 });
  const bodyIM = new THREE.InstancedMesh(bodyG.build(), MAT.flat, NC), detIM = new THREE.InstancedMesh(detG.build(), MAT.flat, NC), lampIM = new THREE.InstancedMesh(lampCG.build(), MAT.glow, NC), decIM = new THREE.InstancedMesh(decG.build(), MAT.flat, 4);
  for (const m of [bodyIM, detIM, lampIM, decIM]) { m.frustumCulled = false; m.castShadow = m !== lampIM; scene.add(m); }
  bodyIM.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(NC * 3).fill(1), 3);
  const ZERO = new THREE.Matrix4().makeScale(0, 0, 0), M = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(0, 0, 0, 'YXZ'), V = new THREE.Vector3(), ONE = new THREE.Vector3(1, 1, 1), col = new THREE.Color();
  for (let i = 0; i < NC; i++) { bodyIM.setMatrixAt(i, ZERO); detIM.setMatrixAt(i, ZERO); lampIM.setMatrixAt(i, ZERO); bodyIM.setColorAt(i, col.setHex(PAINT[i % PAINT.length])); }
  for (let i = 0; i < 4; i++) decIM.setMatrixAt(i, ZERO);
  const segIdx = (g, s) => { const A = g.S; if (s <= 0) return 0; if (s >= g.L) return g.n - 2; let lo = 0, hi = g.n - 1; while (hi - lo > 1) { const mi = (lo + hi) >> 1; if (A[mi] <= s) lo = mi; else hi = mi; } return lo; };
  const at = (g, s, o) => { const j = segIdx(g, s), L = g.S[j + 1] - g.S[j] || 1, f = clamp((s - g.S[j]) / L, 0, 1); o.x = g.X[j] + (g.X[j + 1] - g.X[j]) * f; o.z = g.Z[j] + (g.Z[j + 1] - g.Z[j]) * f; o.y = g.Y[j] + (g.Y[j + 1] - g.Y[j]) * f; o.tx = g.TX[j] + (g.TX[j + 1] - g.TX[j]) * f; o.tz = g.TZ[j] + (g.TZ[j + 1] - g.TZ[j]) * f; o.k = g.K[j]; return o; };
  const P0 = {}, P1 = {}, P2 = {};
  const inTown = (g) => lanes.includes(g.conn ? g.next : g);
  const cars = S.cars;
  for (let i = 0; i < NC; i++) cars.push({ i, seg: null, s: 0, v: 0, x: 0, y: -999, z: 0, yaw: 0, pitch: 0, on: false, vis: false, v0: 9 + rnd() * 4, half: 2.1, convoy: -1, honk: 0, stun: 0 });
  // life.js mashinalari uchun to'siq sifatida (ilgari ular orqadan shu mashinalar ichidan o'tib ketardi)
  const extO = cars.map((c) => ({ sc: c, x: 0, z: 0, vx: 0, vz: 0, fx: 0, fz: 1, half: 2.1, halfW: 0.87, v: 0, car: null, player: false, on: false })); if (life.ext) life.ext.push(...extO);
  const camP = () => game.camera.position;
  const seen = (x, z) => { const cp = camP(), dx = x - cp.x, dz = z - cp.z, d = Math.hypot(dx, dz); if (d < 45) return true; game.camera.getWorldDirection(V); return d < 420 && (dx * V.x + dz * V.z) / d > 0.3; };
  const place = (c, avoidView) => { for (let t = 0; t < 20; t++) { const g = lanes[(rnd() * lanes.length) | 0]; if (g.L < 40) continue; const s = 10 + rnd() * (g.L - 20); at(g, s, P0); if (Math.hypot(P0.x - C.x, P0.z - C.z) > RT) continue; if (avoidView && seen(P0.x, P0.z)) continue;
    if (cars.some((o) => o !== c && o.on && (o.x - P0.x) ** 2 + (o.z - P0.z) ** 2 < 400) || life.cars.some((o) => o.placed && (o.x - P0.x) ** 2 + (o.z - P0.z) ** 2 < 400)) continue;
    c.seg = g; c.s = s; c.v = c.v0 * 0.7; c.on = true; c.x = P0.x; c.z = P0.z; c.picks = null; return true; } c.on = false; return false; };
  // keyingi bo'lak: qishloq ichida qoladigan burilish afzal (kortej ortidagilar boshlovchining tanlovini takrorlaydi)
  const nextSeg = (c) => { const g = c.seg; if (g.conn) return g.next; const outs = g.outs.filter((o) => inTown(o)); if (!outs.length) return null;
    if (c.convoy > 0 && cv.picks.length > c.pk) { const o = cv.picks[c.pk++]; if (g.outs.includes(o)) return o; }
    const o = outs[(rnd() * outs.length) | 0]; if (c.convoy === 0) cv.picks.push(o); return o; };
  const cv = { picks: [], t: 0 };
  S.convoy = (on) => { if (on === S.convoyOn) return; S.convoyOn = on; cv.picks.length = 0;
    if (on) { // boshlovchi oq mashina, qolganlari ketma-ket 11 m oraliqda
      let g = null, s0 = 0; for (let t = 0; t < 40 && !g; t++) { const q = lanes[(rnd() * lanes.length) | 0]; if (q.L < 80) continue; let bj = 0, bd = 1e9; for (let j = 0; j < q.n; j++) { const d = Math.hypot(q.X[j] - C.x, q.Z[j] - C.z); if (d < bd) { bd = d; bj = j; } } if (bd < 200) { g = q; s0 = clamp(q.S[bj] - 60, 45, q.L - 5); } }
      if (!g) { S.convoyOn = false; return; }
      for (let k = 0; k < 4; k++) { const c = cars[k]; c.convoy = k; c.seg = g; c.s = s0 - k * 11; c.v = 6; c.on = true; c.pk = 0; c.v0 = 8; bodyIM.setColorAt(k, col.setHex(k === 0 ? 0xf6f6f2 : PAINT[[3, 4, 10, 1][k]])); }
      bodyIM.instanceColor.needsUpdate = true;
    } else { for (let k = 0; k < 4; k++) { cars[k].convoy = -1; cars[k].v0 = 9 + rnd() * 4; cars[k].on = false; } } };

  // --- piyodalar: yo'l chetida (trotuar) yurib, o'tish joyidan svetofor bilan o'tadi ---
  const NW = 12, LOOKS = [[0xd8392b, 0x2a2c33], [0x2f6fd0, 0x3a3f4c], [0xf6f6f2, 0x1d1e22], [0x3fae5a, 0x4a3a2a], [0xf0b83a, 0x2a2c33], [0x8a54c8, 0x3a3f4c], [0xe86a8a, 0x2a2c33], [0x6a8a9a, 0x2f2a26], [0xc84a2a, 0x3a3a46], [0x2a8a8a, 0x1d1e22], [0xe8e2d4, 0x4a3a2a], [0x4a6ad8, 0x2a2c33]];
  const walkers = S.walkers;
  for (let i = 0; i < NW; i++) { const fem = i % 3 === 1, r = makeRig({ shirt: LOOKS[i][0], pants: LOOKS[i][1], seed: 600 + i * 13, long: fem, vest: i % 4 === 0 ? 0x2a2c33 : undefined }); r.root.visible = false; scene.add(r.root);
    const a = arms[i % arms.length]; walkers.push({ i, rig: r, arm: a, side: i % 2 ? 1 : -1, d: 25 + rnd() * 100, dir: rnd() < 0.5 ? 1 : -1, sp: 1.25 + rnd() * 0.4, wait: 0, cross: null, x: 0, z: 0, y: 0, yaw: 0, vis: false, far: 70 + rnd() * 70 }); }
  const sidePt = (w, d, side, o) => { const p = w.arm.at(d), off = w.arm.hw + 1.9; o.x = p.x + p.tz * off * side; o.z = p.z - p.tx * off * side; o.tx = p.tx; o.tz = p.tz; return o; };
  // tungi rejimda: zebra yonida (25 m) mashina yo'q bo'lsa piyoda o'tadi
  const zebraClear = (a) => { const z = a.at(15); for (const o of life.cars) if (o.placed && (o.x - z.x) ** 2 + (o.z - z.z) ** 2 < 625) return false; for (const o of cars) if (o.on && (o.x - z.x) ** 2 + (o.z - z.z) ** 2 < 625) return false; const pc = game.car.p; return (pc[0] - z.x) ** 2 + (pc[2] - z.z) ** 2 > 625 || game.player.onFoot; };
  const stepWalker = (w, dt) => {
    w.moving = false;
    if (w.cross) { // o'tish joyida
      const c = w.cross; c.t += dt * w.sp * (S.ph.k === 'P' || S.ph.k === 'N' ? 1.15 : 1.9) / c.len; /* qizil yonib qolsa — shoshiladi (mashinalar kutib turmasin) */ const t = Math.min(1, c.t); w.x = c.ax + (c.bx - c.ax) * t; w.z = c.az + (c.bz - c.az) * t; w.yaw = Math.atan2(c.bx - c.ax, c.bz - c.az); w.moving = true;
      if (c.t >= 1) { w.cross = null; w.side = -w.side; w.dir = 1; w.d = 15.5; } return; }
    if (w.wait > 0) { w.wait -= dt; return; }
    if (w.curb) { if ((S.ph.k === 'P' && S.ph.left > 2 * (w.arm.hw + 1.9) / (w.sp * 1.15) + 0.5) || (S.ph.k === 'N' && zebraClear(w.arm))) { w.curb = false; sidePt(w, 15, w.side, P1); sidePt(w, 15, -w.side, P2); w.cross = { ax: P1.x, az: P1.z, bx: P2.x, bz: P2.z, len: Math.hypot(P2.x - P1.x, P2.z - P1.z), t: 0 }; } return; }
    w.d += w.dir * w.sp * dt;
    if (w.dir < 0 && w.d <= 15.5) { w.d = 15.5; w.curb = true; }
    if (w.dir > 0 && w.d >= w.far) { w.dir = -1; w.wait = 1 + rnd() * 3; }
    sidePt(w, w.d, w.side, P1); w.x = P1.x; w.z = P1.z; w.yaw = Math.atan2(P1.tx * w.dir, P1.tz * w.dir); w.moving = !w.curb;
  };

  // --- har kadr ---
  let tPh = 0;
  S.update = (dt) => {
    dt = Math.min(dt, 0.1); const q = game.state.set.gfx, cp = camP(), pc = game.car, pl = game.player, foot = pl.onFoot, night = game.sky.night;
    tPh += dt; S.ph = S.nightMode() ? { k: 'N', left: 99 } : phaseAt(tPh); S.phase = S.ph.k; setLamps();
    const dC = Math.hypot(cp.x - C.x, cp.z - C.z), active = dC < 1100 && !(game.interior && game.interior.inside);
    const hr = game.hour, calm = hr < 5 || hr >= 23 ? 0.3 : hr < 6.5 || hr >= 21.5 ? 0.6 : 1; // tunda ko'chalar tinchroq
    const nCars = active ? Math.round([4, 8, NC][q] * calm) : 0, nWalk = active ? Math.round([4, 8, NW][q] * calm) : 0;
    // mashinalar
    const obs = []; for (const c of cars) if (c.on) obs.push(c); for (const o of life.cars) if (o.placed && Math.abs(o.x - C.x) < RT + 200 && Math.abs(o.z - C.z) < RT + 200) obs.push(o);
    for (const o of life.ext) if (o.on && !o.sc.seg && o.sc.i == null) obs.push(o); obs.push({ x: pc.p[0], z: pc.p[2], v: 0, player: true }); if (foot) obs.push({ x: pl.p[0], z: pl.p[2], v: 0, player: true });
    for (const w of walkers) if (w.vis && w.cross) obs.push({ x: w.x, z: w.z, v: 0, ped: true });
    let vis = 0;
    for (let i = 0; i < NC; i++) {
      const c = cars[i];
      if (i >= nCars && c.convoy < 0 && !(active && c.on && seen(c.x, c.z))) { if (c.on || c.vis) { c.on = false; c.vis = false; bodyIM.setMatrixAt(i, ZERO); detIM.setMatrixAt(i, ZERO); lampIM.setMatrixAt(i, ZERO); } continue; }
      if (!c.on) { if (c.convoy >= 0 || i >= nCars) continue; place(c, true); if (!c.on) continue; } // ortiqchasi ko'z oldida birdan yo'qolmaydi — ko'rinmay qolganda
      const g = c.seg, fx = Math.sin(c.yaw), fz = Math.cos(c.yaw);
      // tezlik: egrilik, chorraha, oldindagi to'siq (IDM), svetofor
      let v0 = c.v0; at(g, Math.min(g.L, c.s + 12), P0); v0 = Math.min(v0, Math.sqrt(2.2 / Math.max(Math.abs(P0.k), 1e-3))); if (g.conn && g.junc) v0 = Math.min(v0, 7);
      if (c.convoy > 0) { const L = cars[c.convoy - 1]; if (L.on) { const gp = Math.hypot(L.x - c.x, L.z - c.z) - 4.5; v0 = Math.min(v0 + 2, Math.max(0, (gp - 6) * 0.6 + L.v)); } }
      let gap = 1e9, vl = 0, blkO = null;
      for (const o of obs) { if (o === c) continue; const dx = o.x - c.x, dz = o.z - c.z, al = dx * fx + dz * fz; if (al < 0.5 || al > 40) continue; const lat = Math.abs(dx * fz - dz * fx); if (lat > (o.ped ? 2.6 : 1.9)) continue; const gp = al - (o.ped ? 1 : 4.3); if (gp < gap) { gap = gp; vl = o.v || 0; blkO = o; } } c.blk = gap < 12 ? blkO : null;
      if (!g.conn && g.to === NID) { const sg = g.L - c.s - c.half - 4; if (sg > -1.5 && (mustStop(g.edge, sg) || (sg > 0.5 && junctionBusy(g.edge, 9, c))) && sg < gap) { gap = Math.max(0.2, sg); vl = 0; } }
      const a = 1.6, b = 2.2, ss = 2.5 + Math.max(0, c.v * 1.2 + (c.v * (c.v - vl)) / (2 * Math.sqrt(a * b)));
      let acc = a * (1 - (c.v / Math.max(0.5, v0)) ** 4) - a * (ss / Math.max(gap, 0.3)) ** 2; if (c.stun > 0) { c.stun -= dt; acc = Math.min(acc, -2); }
      c.v = clamp(c.v + clamp(acc, -7, a) * dt, 0, 16); c.s += c.v * dt;
      while (c.s > c.seg.L) { const nx = nextSeg(c); if (!nx) { c.on = false; break; } if (!c.seg.conn) c.src = c.seg.edge; c.s -= c.seg.L; c.seg = nx; }
      if (!c.on) continue;
      at(c.seg, c.s, P0); c.x = P0.x; c.z = P0.z; c.y = P0.y; c.yaw = Math.atan2(P0.tx, P0.tz);
      { at(c.seg, Math.max(0, c.s - 1.4), P1); at(c.seg, Math.min(c.seg.L, c.s + 1.4), P2); c.pitch = -Math.atan2(P2.y - P1.y, Math.hypot(P2.x - P1.x, P2.z - P1.z) || 1); }
      const dd = Math.hypot(c.x - cp.x, c.z - cp.z);
      if (c.convoy < 0 && Math.hypot(c.x - C.x, c.z - C.z) > RT + 60 && !seen(c.x, c.z)) { c.on = false; continue; }
      // o'yinchi mashinasi bilan to'qnashuv: kinematik — o'yinchini itaradi (life.js kabi)
      { const px = pc.p[0], pz = pc.p[2]; let ox = c.x, oz = c.z; const al = clamp((px - c.x) * fx + (pz - c.z) * fz, -1.2, 1.2); ox += fx * al; oz += fz * al; const d2 = (ox - px) ** 2 + (oz - pz) ** 2, cr = 1.0 + pc.cr;
        if (!foot && d2 < cr * cr && Math.abs(c.y - pc.p[1]) < 2.6) { const d = Math.sqrt(d2) || 0.01, nx = (px - ox) / d, nz = (pz - oz) / d, pen = cr - d; pc.p[0] += nx * pen; pc.p[2] += nz * pen; const rv = (pc.v[0] - fx * c.v) * nx + (pc.v[2] - fz * c.v) * nz; if (rv < 0) { pc.v[0] -= nx * rv * 1.25; pc.v[2] -= nz * rv * 1.25; if (-rv > 2.5) pc.events.push({ type: 'hit', v: -rv, x: px - nx * pc.cr, z: pz - nz * pc.cr }); } if (c.stun <= 0) game.audio.sfx('horn'); c.stun = 2.5; c.v *= 0.25; } }
      const show = dd < 600; c.vis = show;
      if (!show) { bodyIM.setMatrixAt(i, ZERO); detIM.setMatrixAt(i, ZERO); lampIM.setMatrixAt(i, ZERO); if (c.convoy >= 0) decIM.setMatrixAt(c.convoy, ZERO); continue; }
      vis++; E.set(c.pitch, c.yaw, 0); Q.setFromEuler(E); M.compose(V.set(c.x, c.y + 0.02, c.z), Q, ONE);
      bodyIM.setMatrixAt(i, M); detIM.setMatrixAt(i, M); lampIM.setMatrixAt(i, night > 0.25 || game.wxDark || c.convoy >= 0 ? M : ZERO); if (c.convoy >= 0) decIM.setMatrixAt(c.convoy, M);
      if (c.convoy === 0 && S.convoyOn && (c.honk -= dt) < 0 && dd < 90) { c.honk = 1.6 + rnd() * 2.5; game.audio.sfx('horn'); }
    }
    if (!S.convoyOn) for (let k = 0; k < 4; k++) decIM.setMatrixAt(k, ZERO);
    else if (!cars[0].on) S.convoy(false);
    for (let i = 0; i < NC; i++) { const c = cars[i], o = extO[i]; o.on = c.on; if (!c.on) continue; o.fx = Math.sin(c.yaw); o.fz = Math.cos(c.yaw); o.x = c.x; o.z = c.z; o.v = c.v; o.vx = o.fx * c.v; o.vz = o.fz * c.v; }
    for (const m of [bodyIM, detIM, lampIM, decIM]) m.instanceMatrix.needsUpdate = true;
    S.visCars = vis;
    // piyodalar
    let wv = 0;
    for (let i = 0; i < NW; i++) {
      const w = walkers[i], on = i < nWalk || (active && w.vis && Math.hypot(w.x - cp.x, w.z - cp.z) < 60);
      if (!on) { if (w.vis) { w.vis = false; w.rig.root.visible = false; } if (w.cross) { w.cross = null; w.side = -w.side; w.d = 16; w.dir = 1; } w.curb = false; continue; }
      stepWalker(w, dt);
      // mashina yaqinlashsa — chetga
      // o'yinchi mashinasi yaqinlashsa — chetga sakraydi; piyoda o'yinchi bilan bir-birining ichiga kirmaydi
      { const ox = w.x + (w.ox || 0), oz = w.z + (w.oz || 0), dxc = ox - pc.p[0], dzc = oz - pc.p[2], dc = Math.hypot(dxc, dzc), sp = Math.hypot(pc.v[0], pc.v[2]);
        if (!foot && sp > 2 && dc < 3 + sp * 0.5 && dc > 0.01 && (pc.v[0] * dxc + pc.v[2] * dzc) / (sp * dc) > 0.35) { const sd = (dxc * pc.v[2] - dzc * pc.v[0]) > 0 ? 1 : -1, k = Math.min(1, dt * 7); w.ox = (w.ox || 0) + pc.v[2] / sp * sd * 4 * k; w.oz = (w.oz || 0) - pc.v[0] / sp * sd * 4 * k; w.scare = 1.2; }
        if (foot) { const dxp = ox - pl.p[0], dzp = oz - pl.p[2], dp = Math.hypot(dxp, dzp); if (dp < 0.6 && dp > 0.01) { w.ox = (w.ox || 0) + dxp / dp * (0.6 - dp); w.oz = (w.oz || 0) + dzp / dp * (0.6 - dp); } }
        if (w.ox || w.oz) { const L = Math.hypot(w.ox, w.oz); if (L > 3.5) { w.ox *= 3.5 / L; w.oz *= 3.5 / L; } if (!(w.scare > 0)) { const f = Math.exp(-dt * 0.8); w.ox *= f; w.oz *= f; if (Math.abs(w.ox) + Math.abs(w.oz) < 0.01) w.ox = w.oz = 0; } }
        if (w.scare > 0) w.scare -= dt; }
      const d = Math.hypot(w.x - cp.x, w.z - cp.z), show = d < [110, 140, 170][q]; w.vis = show; w.rig.root.visible = show; if (!show) continue; wv++;
      const rx = w.x + (w.ox || 0), rz = w.z + (w.oz || 0); w.y = T.ground(rx, rz, 1e9).y; w.rig.root.position.set(rx, w.y, rz); w.rig.root.rotation.y += angDiff(w.yaw, w.rig.root.rotation.y) * Math.min(1, dt * 8);
      if (d < 90 || (game.time * 10 + i) % 3 < 1) poseRig(w.rig, w.scare > 0 ? 'shake' : w.moving ? 'walk' : 'idle', d < 90 ? dt : dt * 3, w.moving ? w.sp : 0);
    }
    S.visWalk = wv;
  };
  game.hooks.push(S.update);
  return S;
}
