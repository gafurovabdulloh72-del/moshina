// Jonli dunyo: yo'ldagi mashinalar (silliq haydash, chiroq va ishoralar), chetda turgan mashinalar, qushlar galasi, havo sharlari
import * as THREE from 'three';
import * as T from './terrain.js';
import * as COL from './colliders.js';
import { GB, MAT } from './geo.js';
import { buildVehicle, syncWheels } from './vehicles.js';
import { mulberry32, clamp, smoothstep, angDiff } from './util.js';

export function buildLife(scene, game) {
  const out = {}, rnd = mulberry32(7391), R = T.roads;
  const ZERO = new THREE.Matrix4().makeScale(0, 0, 0), M = new THREE.Matrix4(), M2 = new THREE.Matrix4(), Mt = new THREE.Matrix4();
  const V3 = new THREE.Vector3(), V3b = new THREE.Vector3(), Q = new THREE.Quaternion(), E = new THREE.Euler(0, 0, 0, 'YXZ'), El = new THREE.Euler(0, 0, 0, 'YZX');
  // umumiy yumshoq dog' teksturasi (chiroq shu'lasi, faraning yo'ldagi nuri)
  const texOf = (w, h, f) => { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const cx = cv.getContext('2d'), im = cx.createImageData(w, h); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const v = f((x + 0.5) / w, (y + 0.5) / h), o = (y * w + x) * 4; im.data[o] = im.data[o + 1] = im.data[o + 2] = Math.round(255 * clamp(v, 0, 1)); im.data[o + 3] = 255; } cx.putImageData(im, 0, 0); const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.NoColorSpace; return t; };
  const haloTex = texOf(64, 64, (u, v) => { const r = Math.hypot(u - 0.5, v - 0.5) * 2; return Math.exp(-r * r * 5) * 0.85 + Math.max(0, 1 - r * 7) * 0.4; });
  const poolTex = texOf(64, 128, (u, v) => { const w = 0.28 + 0.72 * v, x = (u - 0.5) * 2 / w; return Math.max(0, 1 - x * x) ** 1.5 * smoothstep(0, 0.14, v) * (1 - v) ** 1.6; });

  // =================== YO'L TARMOG'I ===================
  // Har yo'l uchun ikki yo'nalishli bo'lak (o'ng tomonlama harakat) va tugunlarda silliq ulagich (Bezier)
  const deg0 = (ni) => R.nodes[ni].edges.filter((ei) => R.edges[ei].type === 0).length;
  const used = R.edges.filter((e) => e.type === 0 && deg0(e.a) > 1 && deg0(e.b) > 1);
  const deg = new Int8Array(R.nodes.length); for (const e of used) { deg[e.a]++; deg[e.b]++; }
  const lanes = [];
  const finish = (g) => {
    const n = g.n, X = g.X, Z = g.Z, S = (g.S = new Float32Array(n));
    for (let j = 1; j < n; j++) S[j] = S[j - 1] + Math.hypot(X[j] - X[j - 1], Z[j] - Z[j - 1]);
    g.L = S[n - 1];
    const TX = (g.TX = new Float32Array(n)), TZ = (g.TZ = new Float32Array(n)), K = (g.K = new Float32Array(n));
    for (let j = 0; j < n; j++) { const a = Math.max(0, j - 2), b = Math.min(n - 1, j + 2); const tx = X[b] - X[a], tz = Z[b] - Z[a], l = Math.hypot(tx, tz) || 1; TX[j] = tx / l; TZ[j] = tz / l; }
    for (let j = 1; j < n - 1; j++) K[j] = angDiff(Math.atan2(X[j + 1] - X[j], Z[j + 1] - Z[j]), Math.atan2(X[j] - X[j - 1], Z[j] - Z[j - 1])) / Math.max(0.5, (S[j + 1] - S[j - 1]) * 0.5);
    K[0] = K[1]; K[n - 1] = K[n - 2];
    const tmp = new Float32Array(n); for (let it = 0; it < 3; it++) { for (let j = 0; j < n; j++) tmp[j] = (K[Math.max(0, j - 1)] + 2 * K[j] + K[Math.min(n - 1, j + 1)]) * 0.25; K.set(tmp); }
    if (!g.NX) { g.NX = new Float32Array(n); g.NZ = new Float32Array(n); for (let j = 0; j < n; j++) { g.NX[j] = -TZ[j]; g.NZ[j] = TX[j]; } }
    return g;
  };
  const mkLane = (e, rev) => {
    const ids = []; for (let k = 0; k < e.count; k++) ids.push(e.start + (rev ? e.count - 1 - k : k));
    const P = []; for (const i of ids) { const l = P[P.length - 1]; if (!l || Math.hypot(R.x[i] - l[0], R.z[i] - l[1]) > 0.6) P.push([R.x[i], R.z[i], R.y[i]]); }
    const ac = [0]; for (let k = 1; k < P.length; k++) ac.push(ac[k - 1] + Math.hypot(P[k][0] - P[k - 1][0], P[k][1] - P[k - 1][1]));
    const tot = ac[ac.length - 1], TR = 13, C = P.filter((p, k) => ac[k] >= TR && ac[k] <= tot - TR), n = C.length, hw = e.hw, off = hw * 0.48;
    const g = { n, X: new Float32Array(n), Z: new Float32Array(n), Y: new Float32Array(n), NX: new Float32Array(n), NZ: new Float32Array(n), hw, off, from: rev ? e.b : e.a, to: rev ? e.a : e.b, edge: e.id, conn: false, outs: [] };
    for (let j = 0; j < n; j++) { const a = C[Math.max(0, j - 2)], b = C[Math.min(n - 1, j + 2)]; let tx = b[0] - a[0], tz = b[1] - a[1]; const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l; g.NX[j] = -tz; g.NZ[j] = tx; g.X[j] = C[j][0] - tz * off; g.Z[j] = C[j][1] + tx * off; g.Y[j] = C[j][2]; }
    return finish(g);
  };
  for (const e of used) { lanes.push(mkLane(e, false), mkLane(e, true)); }
  const mkConn = (A, B, node) => {
    const a = A.n - 1, ax = A.X[a], az = A.Z[a], bx = B.X[0], bz = B.Z[0], d = Math.hypot(bx - ax, bz - az), h = d * 0.4;
    const p1x = ax + A.TX[a] * h, p1z = az + A.TZ[a] * h, p2x = bx - B.TX[0] * h, p2z = bz - B.TZ[0] * h, n = Math.max(5, Math.ceil(d / 2) + 1);
    const g = { n, X: new Float32Array(n), Z: new Float32Array(n), Y: new Float32Array(n), hw: Math.min(A.hw, B.hw), off: B.off, conn: true, next: B, node, junc: deg[node] >= 3 };
    for (let j = 0; j < n; j++) { const t = j / (n - 1), u = 1 - t, b0 = u * u * u, b1 = 3 * u * u * t, b2 = 3 * u * t * t, b3 = t * t * t; g.X[j] = b0 * ax + b1 * p1x + b2 * p2x + b3 * bx; g.Z[j] = b0 * az + b1 * p1z + b2 * p2z + b3 * bz; g.Y[j] = A.Y[a] + (B.Y[0] - A.Y[a]) * smoothstep(0, 1, t); }
    finish(g); g.turn = angDiff(Math.atan2(B.TX[0], B.TZ[0]), Math.atan2(A.TX[a], A.TZ[a]));
    return g;
  };
  for (const A of lanes) for (const B of lanes) if (B.from === A.to && B.edge !== A.edge) A.outs.push(mkConn(A, B, A.to));
  const segIdx = (g, s) => { const S = g.S; if (s <= 0) return 0; if (s >= g.L) return g.n - 2; let lo = 0, hi = g.n - 1; while (hi - lo > 1) { const mi = (lo + hi) >> 1; if (S[mi] <= s) lo = mi; else hi = mi; } return lo; };
  const segAt = (g, s, o) => {
    const j = segIdx(g, s), S = g.S, L = S[j + 1] - S[j] || 1, f = (s - S[j]) / L, fc = f < 0 ? 0 : f > 1 ? 1 : f;
    o.x = g.X[j] + (g.X[j + 1] - g.X[j]) * f; o.z = g.Z[j] + (g.Z[j + 1] - g.Z[j]) * f; o.y = g.Y[j] + (g.Y[j + 1] - g.Y[j]) * fc;
    o.tx = g.TX[j] + (g.TX[j + 1] - g.TX[j]) * fc; o.tz = g.TZ[j] + (g.TZ[j + 1] - g.TZ[j]) * fc; o.nx = g.NX[j] + (g.NX[j + 1] - g.NX[j]) * fc; o.nz = g.NZ[j] + (g.NZ[j + 1] - g.NZ[j]) * fc;
    o.k = g.K[j] + (g.K[j + 1] - g.K[j]) * fc; o.hw = g.hw; o.off = g.off; return o;
  };
  // mashina marshruti bo'ylab d metr oldindagi (manfiy — orqadagi) nuqta
  const locate = (c, d, o) => { let k = c.ri, s = c.s + d, g = c.route[k]; while (s > g.L && k + 1 < c.route.length) { s -= g.L; g = c.route[++k]; } while (s < 0 && k > 0) { g = c.route[--k]; s += g.L; } return segAt(g, s, o); };

  // =================== YO'LDAGI MASHINALAR ===================
  const PAINT = [0xf2f2ee, 0xeeeeea, 0xc4c7cc, 0xa9adb3, 0x6b6f75, 0x3a3c40, 0x1c1d21, 0x22324e, 0x5c1a1c, 0xd6cbb2, 0x34503e, 0x2f6fb8, 0x8a2a20];
  const TYPES = ['sedan', 'xetch', 'pikap', 'jip', 'furgon', 'sedan', 'yuk', 'xetch', 'avtobus', 'sedan'];
  const cars = [], lampG = new GB(97); lampG.jit = 0; lampG.color(0xffffff).box(0, 0, 0, 0.12, 0.075, 0.05);
  const fake = () => ({ wheels: [0, 1, 2, 3].map(() => ({ len: 0, spin: 0, ly: 0 })), steer: 0, fwd: 0 });
  // faralar joyini modelning o'zidan topamiz (modellar almashsa ham ishlaydi)
  const lampSpots = (m) => {
    const sp = m.spec, hl = sp.len / 2, fr = [1e9, -1e9, 0, 0, 0], rr = [1e9, -1e9, 0, 0, 0];
    const scan = (geo, front, b) => { const a = geo.attributes.position.array; for (let i = 0; i < a.length; i += 3) { const z = a[i + 2]; if (front ? z < hl - 0.7 : z > -hl + 0.7) continue; b[0] = Math.min(b[0], a[i + 1]); b[1] = Math.max(b[1], a[i + 1]); b[2] = Math.max(b[2], Math.abs(a[i])); b[3] = front ? Math.max(b[3], z) : Math.min(b[3], z); b[4]++; } };
    m.tilt.traverse((o) => { if (o.isMesh && o.material === m.headMat) scan(o.geometry, true, fr); if (o.isMesh && o.material === m.tailMat) scan(o.geometry, false, rr); });
    const y0 = sp.clr - sp.com + 0.25, hx = sp.wid / 2 - 0.1;
    const F = fr[4] ? [fr[2] - 0.05, (fr[0] + fr[1]) / 2, fr[3] + 0.02] : [hx, y0, hl + 0.02], Rr = rr[4] ? [rr[2] - 0.05, (rr[0] + rr[1]) / 2, rr[3] - 0.02] : [hx, y0 + 0.1, -hl - 0.02];
    return { F, R: Rr, HF: [Math.max(0.2, F[0] - 0.16), F[1], F[2] + 0.04], HR: [Math.max(0.2, Rr[0] - 0.12), Rr[1], Rr[2] - 0.04] };
  };
  const mkCar = (id, i) => {
    const m = buildVehicle(id, { lite: true }), sp = m.spec, heavy = id === 'yuk' || id === 'avtobus' || id === 'furgon';
    if (id !== 'yuk' && id !== 'avtobus') m.paintMat.color.setHex(PAINT[(rnd() * PAINT.length) | 0]);
    m.root.remove(m.spot); m.root.remove(m.spot.target); m.root.visible = false; scene.add(m.root);
    const f = fake(); f.wheels.forEach((w, k) => { w.len = sp.free - sp.sag; w.ly = (k < 2 ? sp.rF : sp.rR) + (sp.free - sp.sag) - sp.com; });
    return { id: i, kind: id, m, fake: f, sp, heavy, half: sp.len / 2, halfW: sp.wid / 2, rad: Math.max(1.4, sp.wid / 2 + 0.5), com: sp.com, wzF: sp.wzF, wzR: sp.wzR, wb: sp.wzF + sp.wzR, rF: sp.rF, rR: sp.rR, lamps: lampSpots(m),
      // haydovchi fe'li: tezlik, oraliq, keskinlik, sabr
      v0: (id === 'yuk' || id === 'avtobus' ? 12 : heavy ? 14 : 16) * (0.84 + rnd() * 0.32), T: 1.0 + rnd() * 0.9 + (heavy ? 0.4 : 0), a: heavy ? 0.9 + rnd() * 0.4 : 1.4 + rnd() * 1.2, bc: heavy ? 1.6 + rnd() * 0.4 : 2.0 + rnd() * 1.3, s0: 2.2 + rnd() * 1.6,
      alat: heavy ? 1.5 + rnd() * 0.4 : 2.0 + rnd() * 1.3, patience: 3 + rnd() * 7, lightOn: 0.1 + rnd() * 0.3, susp: heavy ? 1.35 : 1,
      route: [], ri: 0, s: 0, v: 0, acc: 0, lat: 0, latT: 0, dl: 0, ddl: 0, mode: 0, sig: 0, sigT: 0, stun: 0, waitP: 0, honk: 0, stuck: 0, pullT: 40 + rnd() * 200, waitT: 0, mut: 0, ign: null, ignT: 0, pass: 0,
      th: 0, thv: 0, ph: 0, phv: 0, steer: 0, spinF: 0, spinR: 0, x: 0, y: -9999, z: 0, yaw: 0, pitch: 0, k: 0, vx: 0, vz: 0, vis: false, near: null, hw: 5, ry: 0, placed: false, braking: false, lights: false, blk: null, byPlayer: false };
  };
  for (let i = 0; i < TYPES.length; i++) cars.push(mkCar(TYPES[i], i));
  out.cars = cars; out.lanes = lanes;
  const NC = cars.length;
  // tun bezaklari: burilish chiroqlari, faralarning yo'ldagi nuri, chiroq shu'lasi — barchasi uchun bittadan chizish
  const indIM = new THREE.InstancedMesh(lampG.build(), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.9, 0.6, 0.04), fog: false }), NC * 4); indIM.frustumCulled = false; scene.add(indIM);
  const poolMat = new THREE.MeshBasicMaterial({ map: poolTex, color: 0x000000, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
  const poolIM = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), poolMat, NC); poolIM.frustumCulled = false; scene.add(poolIM);
  const haloPos = new Float32Array(NC * 4 * 3), haloCol = new Float32Array(NC * 4 * 3), haloGeo = new THREE.BufferGeometry();
  haloGeo.setAttribute('position', new THREE.BufferAttribute(haloPos, 3)); haloGeo.setAttribute('color', new THREE.BufferAttribute(haloCol, 3));
  const halos = new THREE.Points(haloGeo, new THREE.PointsMaterial({ size: 1.7, map: haloTex, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); halos.frustumCulled = false; scene.add(halos);
  for (let i = 0; i < NC * 4; i++) indIM.setMatrixAt(i, ZERO); for (let i = 0; i < NC; i++) poolIM.setMatrixAt(i, ZERO);

  const focus = () => { const pl = game.player; return pl.onFoot ? pl.p : game.car.p; };
  const ahead = (c) => { let d = -c.s; for (let k = c.ri; k < c.route.length; k++) d += c.route[k].L; return d; };
  // keyingi burilishni tanlash: to'g'riroq yo'l va o'yinchiga yaqinroq yo'nalish afzal
  const extend = (c) => {
    while (ahead(c) < 240) {
      const last = c.route[c.route.length - 1];
      if (last.conn) { c.route.push(last.next); continue; }
      const outs = last.outs, p = focus(); let pick = outs[0];
      if (outs.length > 1) { let tot = 0; const w = outs.map((o) => { const nd = R.nodes[o.next.to], dn = Math.hypot(nd.x - p[0], nd.z - p[2]); const v = (1.4 - Math.min(1, Math.abs(o.turn) / 2)) * (dn < 1500 ? 1.6 : 1); tot += v; return v; }); let r = rnd() * tot; for (let k = 0; k < outs.length; k++) { r -= w[k]; if (r <= 0) { pick = outs[k]; break; } } }
      c.route.push(pick);
    }
  };
  const advance = (c, ds) => { c.s += ds; while (c.s > c.route[c.ri].L && c.ri + 1 < c.route.length) { c.s -= c.route[c.ri].L; c.ri++; } while (c.ri > 1) { c.route.shift(); c.ri--; } extend(c); };
  const PF = {}, PR = {}, PC = {}, PQ = {};
  const pose = (c) => {
    locate(c, c.wzF, PF); locate(c, -c.wzR, PR);
    const lF = c.lat + c.dl * c.wzF, lR = c.lat - c.dl * c.wzR, fx = PF.x + PF.nx * lF, fz = PF.z + PF.nz * lF, rx = PR.x + PR.nx * lR, rz = PR.z + PR.nz * lR;
    const dx = fx - rx, dz = fz - rz, dh = Math.hypot(dx, dz) || 1, k = c.wzR / c.wb;
    c.x = rx + dx * k; c.z = rz + dz * k; c.yaw = Math.atan2(dx, dz); c.pitch = -Math.atan2(PF.y - PR.y, dh); c.y = PR.y + (PF.y - PR.y) * k + c.com + 0.02;
    c.steerT = clamp(angDiff(Math.atan2(PF.tx, PF.tz) - Math.atan(c.dl + c.ddl * c.wb), c.yaw), -0.62, 0.62);
    locate(c, 0, PC); c.k = PC.k; c.hw = PC.hw; c.ry = PC.y;
  };
  // yo'l chetida mashina sig'adimi (daraxt, ustun, devor, suv, boshqa mashina yo'q)
  const segDist = (o, x, z) => { const vx = o.x2 - o.x, vz = o.z2 - o.z, l2 = vx * vx + vz * vz || 1, t = clamp(((x - o.x) * vx + (z - o.z) * vz) / l2, 0, 1); return Math.hypot(x - o.x - vx * t, z - o.z - vz * t); };
  const spotFree = (x, z, yaw, half, halfW, y, skip) => {
    const fx = Math.sin(yaw), fz = Math.cos(yaw), rr = halfW + 0.35;
    for (const k of [-1, 0, 1]) {
      const px = x + fx * k * (half - halfW * 0.7), pz = z + fz * k * (half - halfW * 0.7), h = T.gridHeight(px, pz);
      if (Math.abs(h - y) > 0.4 || T.waterY(px, pz) > h - 0.4) return false;
      for (const o of COL.query(px, pz, rr + 3)) { const d = o.t === 0 ? Math.hypot(px - o.x, pz - o.z) : segDist(o, px, pz); if (d < o.r + rr + 0.2) return false; }
      for (const o of cars) if (o !== skip && (o.x - px) ** 2 + (o.z - pz) ** 2 < 49) return false;
      for (const o of parked) if ((o.x - px) ** 2 + (o.z - pz) ** 2 < 64) return false;
    }
    return true;
  };
  const camPos = () => game.camera.position;
  const inView = (x, z, maxD) => { const cp = camPos(), dx = x - cp.x, dz = z - cp.z, d = Math.hypot(dx, dz); if (d > maxD) return false; game.camera.getWorldDirection(V3); return (dx * V3.x + dz * V3.z) / (d || 1) > -0.25 || d < 120; };
  const place = (c, minD, maxD, hidden) => {
    const p = focus();
    for (let tries = 0; tries < 16; tries++) {
      const ln = lanes[(rnd() * lanes.length) | 0]; if (ln.L < 80) continue; const s = 25 + rnd() * (ln.L - 50); segAt(ln, s, PQ);
      const d = Math.hypot(PQ.x - p[0], PQ.z - p[2]); if (d < minD || d > maxD) continue;
      if (hidden && inView(PQ.x, PQ.z, 870)) continue;
      if (cars.some((o) => o !== c && o.placed && (o.x - PQ.x) ** 2 + (o.z - PQ.z) ** 2 < 60 * 60)) continue;
      c.route = [ln]; c.ri = 0; c.s = s; c.v = c.v0 * (0.7 + rnd() * 0.2); c.acc = 0; c.lat = c.latT = c.dl = c.ddl = 0; c.mode = 0; c.stun = 0; c.stuck = 0; c.waitP = 0; c.ign = null; c.th = c.ph = c.thv = c.phv = 0;
      extend(c); pose(c); c.steer = c.steerT; c.placed = true; return true;
    }
    return false;
  };
  // yo'l bo'ylab to'siqni proyeksiya qilish: oldinda qancha masofada va yon tomonga qancha siljigan
  const CR = { along: 0, lat: 0, tx: 0, tz: 1 };
  const corridor = (c, ox, oz, look) => {
    let k = c.ri, g = c.route[k], base = -c.s, j = segIdx(g, c.s);
    for (;;) {
      const X = g.X, Z = g.Z, S = g.S;
      for (; j < g.n - 1; j++) {
        const a0 = base + S[j]; if (a0 > look) return null;
        const ax = X[j], az = Z[j], vx = X[j + 1] - ax, vz = Z[j + 1] - az, l2 = vx * vx + vz * vz; if (l2 < 1e-4) continue;
        const t = ((ox - ax) * vx + (oz - az) * vz) / l2; if (t < -0.05 || t > 1.05) continue;
        const l = Math.sqrt(l2), px = ax + vx * t, pz = az + vz * t, lat = ((ox - px) * -vz + (oz - pz) * vx) / l; if (Math.abs(lat) > 12) continue;
        CR.along = a0 + t * l; CR.lat = lat; CR.tx = vx / l; CR.tz = vz / l; return CR;
      }
      if (++k >= c.route.length) return null; base += g.L; g = c.route[k]; j = 0;
    }
  };
  const obs = []; for (let i = 0; i < NC + 2; i++) obs.push({ x: 0, z: 0, vx: 0, vz: 0, fx: 0, fz: 1, half: 1, halfW: 1, car: null, player: false, on: false });
  let recycleT = 0, inited = false;
  const idm = (c, gap, vl, s0, Tg) => { const ss = s0 + Math.max(0, c.v * Tg + (c.v * (c.v - vl)) / (2 * Math.sqrt(c.a * c.bc))); return -c.a * (ss / Math.max(gap, 0.25)) ** 2; };
  const updCars = (dt, t) => {
    const pc = game.car, pl = game.player, night = game.sky.night, foot = pl.onFoot, fp = focus();
    // to'siqlar ro'yxati: mashinalar, o'yinchi mashinasi, piyoda o'yinchi
    for (let i = 0; i < NC; i++) { const c = cars[i], o = obs[i]; o.x = c.x; o.z = c.z; o.vx = c.vx; o.vz = c.vz; o.fx = Math.sin(c.yaw); o.fz = Math.cos(c.yaw); o.half = c.half; o.halfW = c.halfW; o.car = c; o.on = c.placed; o.player = false; }
    { const o = obs[NC], Rm = pc.R, fl = Math.hypot(Rm[2], Rm[8]) || 1; o.x = pc.p[0]; o.z = pc.p[2]; o.vx = pc.v[0]; o.vz = pc.v[2]; o.fx = Rm[2] / fl; o.fz = Rm[8] / fl; o.half = pc.spec.len / 2; o.halfW = pc.spec.wid / 2; o.car = null; o.on = true; o.player = true; }
    { const o = obs[NC + 1]; o.x = pl.p[0]; o.z = pl.p[2]; o.vx = pl.v[0]; o.vz = pl.v[2]; o.half = o.halfW = 0.35; o.car = null; o.on = foot; o.player = true; }
    for (const c of cars) {
      if (!c.placed) continue;
      const look = Math.max(45, c.v * 4.5 + 25);
      // 1) oldindagi egrilik va chorrahalar — tezlikni oldindan pasaytirish
      let v0 = c.v0 * (c.hw < 4 ? 0.75 : 1);
      { let k = c.ri, g = c.route[k], base = -c.s, j = segIdx(g, c.s) + 1; const lim = Math.max(70, c.v * c.v / (1.3 * c.bc) + 35);
        for (let n = 0; n < 60; n++) { if (j >= g.n) { if (++k >= c.route.length) break; base += g.L; g = c.route[k]; j = 0; } const d = base + g.S[j]; if (d > lim) break; let vm = Math.sqrt(c.alat / Math.max(Math.abs(g.K[j]), 1e-4)); if (g.junc) vm = Math.min(vm, 11 + (c.id % 3)); v0 = Math.min(v0, Math.sqrt(vm * vm + 1.3 * c.bc * Math.max(0, d - c.wzF))); j += 2; } }
      if (c.heavy) { locate(c, 6, PQ); v0 *= clamp(1 - Math.max(0, (PQ.y - c.ry) / 6) * 3.2, 0.5, 1); }
      // 2) to'siqlar (IDM — silliq yaqinlashish va masofa saqlash)
      let acc = c.a * (1 - (c.v / Math.max(0.6, v0)) ** 4), blk = null, byPlayer = false, pLat = 0, pGap = 1e9;
      if (c.ignT > 0) c.ignT -= dt; else c.ign = null;
      for (let i = 0; i < NC + 2; i++) {
        const o = obs[i]; if (!o.on || o.car === c || (o.car && o.car === c.ign)) continue;
        if ((o.x - c.x) ** 2 + (o.z - c.z) ** 2 > (look + 12) ** 2) continue;
        const r = corridor(c, o.x, o.z, look); if (!r || r.along < 0) continue;
        const tol = c.halfW + o.halfW + 0.35;
        if (Math.abs(r.lat - c.lat) > tol && Math.abs(r.lat - c.latT) > tol) continue;
        const eh = o.half * Math.abs(o.fx * r.tx + o.fz * r.tz) + o.halfW * Math.abs(o.fx * r.tz - o.fz * r.tx);
        const gap = r.along - c.half - eh, vl = Math.max(-15, o.vx * r.tx + o.vz * r.tz);
        if (o.player) { pLat = r.lat; pGap = Math.min(pGap, gap); }
        const passing = o.player && c.mode === 4, a = passing ? idm(c, gap, vl, 1.3, 0) : idm(c, gap, vl, o.player ? c.s0 + 5.5 : c.s0, c.T);
        const tot = c.a * (1 - (c.v / Math.max(0.6, v0)) ** 4) + a;
        if (tot < acc) { acc = tot; blk = o.car; byPlayer = o.player; }
      }
      // tashqi to'xtash chizig'i (shahar.js: svetofor qizil, piyodalar o'tish joyida) — oldindagi masofa (m) yoki null
      if (out.stopFor) { const sg = out.stopFor(c, locate); if (sg != null) { const tot = c.a * (1 - (c.v / Math.max(0.6, v0)) ** 4) + idm(c, sg, 0, 1.0, 0.8); if (tot < acc) acc = tot; } }
      // yo'l chetiga to'xtash nuqtasi
      if (c.mode === 1 && c.route[c.ri] === c.stopSeg) { const d = c.stopS - c.s, vt = Math.sqrt(2 * 1.3 * Math.max(0, d - 0.4)), a = clamp((vt - c.v) * 1.6, -4.5, c.a); if (a < acc) acc = a; } // bir tekis sekinlab to'xtash
      // o'zaro tiqilib qolish (chorrahada ikkalasi bir-birini kutsa) — bittasi yo'l beradi
      if (blk && blk.blk === c && c.v < 0.3 && blk.v < 0.3) { if ((c.mut += dt) > 2.5 && c.id < blk.id) { c.ign = blk; c.ignT = 4; } } else c.mut = 0;
      c.blk = blk; c.byPlayer = byPlayer;
      if (c.stun > 0) { c.stun -= dt; acc = Math.min(acc, -6); }
      if (c.mode === 2 || (c.mode === 3 && c.latT !== 0)) acc = -9; // yo'l chetida turibdi
      acc = clamp(acc, -9, c.a);
      // keskin o'zgarishsiz (silliq tezlanish/tormoz)
      const J = acc < c.acc ? (acc < -3.5 ? 32 : 9) : 5; c.acc += clamp(acc - c.acc, -J * dt, J * dt);
      c.v += c.acc * dt; if (c.v <= 0) { c.v = 0; if (c.acc < 0) c.acc = 0; }
      c.braking = acc < -0.7 && c.v > 0.4;
      // 3) holatlar: yo'l chetiga chiqish, kutish, qaytish, o'yinchini aylanib o'tish
      const cur = c.route[c.ri], pd = Math.hypot(fp[0] - c.x, fp[2] - c.z);
      c.pullT -= dt;
      if (c.mode === 0 && c.pullT < 0 && !cur.conn && c.v > 6 && cur.L - c.s > 220 && pd > 70 && c.stun <= 0) {
        c.pullT = 20 + rnd() * 30; const s1 = c.s + 75; segAt(cur, s1, PQ);
        const pLatT = cur.hw - 0.7 + c.halfW - cur.off, px = PQ.x + PQ.nx * pLatT, pz = PQ.z + PQ.nz * pLatT;
        if (Math.abs(PQ.k) < 0.006 && spotFree(px, pz, Math.atan2(PQ.tx, PQ.tz), c.half, c.halfW, PQ.y, c)) { c.mode = 1; c.stopSeg = cur; c.stopS = s1; c.pullLat = pLatT; }
      }
      if (c.mode === 1) { if (c.stopSeg !== cur) c.mode = 0; else { if (c.stopS - c.s < 48) c.latT = c.pullLat; if (c.v < 0.05 && c.stopS - c.s < 2) { c.mode = 2; c.waitT = 8 + rnd() * 22; } } }
      else if (c.mode === 2) { if ((c.waitT -= dt) < 0) { c.mode = 3; c.waitT = 2.6; } }
      else if (c.mode === 3) {
        if (c.latT !== 0) { c.waitT -= dt; let clear = c.waitT < 0 && pd > 22; if (clear) for (const o of cars) if (o !== c && o.placed && o.route[o.ri] === cur && o.s < c.s && c.s - o.s < 50 && o.lat < 1) clear = false; if (clear) c.latT = 0; }
        else if (Math.abs(c.lat) < 0.25) { c.mode = 0; c.pullT = 120 + rnd() * 300; }
      } else if (c.mode === 4) { if (pGap > 1e8 && (c.pass -= c.v * dt) < 0) { c.latT = 0; if (Math.abs(c.lat) < 0.3) c.mode = 0; } else if (pGap < 1e8) { c.pass = 10; if (c.v < 0.1 && (c.waitT += dt) > 3) { c.latT = 0; c.mode = 0; c.waitP = 0; } } }
      // o'yinchi yo'lni to'sib qo'ysa: kutadi, signal chaladi, keyin aylanib o'tadi
      if (byPlayer && c.v < 0.5 && pGap < 16 && c.mode === 0) {
        c.waitP += dt; c.honk -= dt;
        if (c.waitP > c.patience && c.honk <= 0 && pd < 50) { game.audio.sfx('horn'); c.honk = 5 + rnd() * 4; }
        if (c.waitP > c.patience * 2 + 5) {
          const need = pLat - (c.halfW + pc.spec.wid / 2 + 0.9), lim = -(cur.off + cur.hw - c.halfW - 0.2);
          let clear = need > lim && Math.abs(c.k) < 0.01 && pGap > 5.5;
          if (clear) for (const o of cars) { if (o === c || !o.placed) continue; const r = corridor(c, o.x, o.z, 110); if (r && r.lat < -1 && r.lat > -cur.off * 2 - 2.5) clear = false; }
          if (clear) { c.mode = 4; c.latT = need; c.pass = 10; c.waitP = 0; c.waitT = 0; }
        }
      } else if (!byPlayer) { c.waitP = Math.max(0, c.waitP - dt); c.honk = 0; }
      // 4) yon siljish (faqat oldinga yurganda — yon tomonga sirpanmaydi)
      const ds = c.v * dt, mx = clamp(0.55 - c.v * 0.03, 0.1, 0.55), dlT = clamp((c.latT - c.lat) * (c.mode === 4 && c.v < 5 ? 0.7 : 0.22), -mx, mx);
      const dl0 = c.dl; c.dl += (dlT - c.dl) * (1 - Math.exp(-ds * (0.35 + 1.2 * Math.max(0, 1 - c.v / 6)))); c.lat += c.dl * ds; c.ddl += ((ds > 1e-4 ? (c.dl - dl0) / ds : 0) - c.ddl) * Math.min(1, dt * 6); if (Math.abs(c.latT - c.lat) < 0.02 && Math.abs(c.dl) < 0.01) { c.lat = c.latT; c.dl = 0; }
      const ox = c.x, oz = c.z;
      advance(c, ds); pose(c);
      if (dt > 0) { c.vx = (c.x - ox) / dt; c.vz = (c.z - oz) / dt; }
      c.stuck = c.v < 0.3 && c.mode === 0 && !byPlayer ? c.stuck + dt : 0;
      // 5) kuzov: tormozda burni egiladi, burilishda yonboshlaydi (prujina — biroz tebranib tinadi)
      const thT = clamp(-c.acc * 0.007, -0.025, 0.05) * c.susp, phT = clamp(c.v * c.v * c.k * 0.009, -0.055, 0.055) * c.susp;
      for (let h = dt, st; h > 0; h -= st) { st = Math.min(h, 1 / 60); c.thv += (60 * (thT - c.th) - 7.5 * c.thv) * st; c.th += c.thv * st; c.phv += (50 * (phT - c.ph) - 7 * c.phv) * st; c.ph += c.phv * st; }
      c.steer += (c.steerT - c.steer) * Math.min(1, dt * 8);
      c.spinF += ds / c.rF; c.spinR += ds / c.rR;
      // 6) ishoralar
      let sig = 0;
      if (c.stun > 0 || c.mode === 2) sig = 2;
      else if (c.mode === 1) sig = c.stopS - c.s < 90 ? -1 : 0;
      else if (c.mode === 3) sig = 1;
      else if (c.mode === 4) sig = c.latT < c.lat - 0.3 ? 1 : c.latT > c.lat + 0.3 ? -1 : 0;
      else { let d = -c.s; for (let k = c.ri; k < c.route.length && d < 75; k++) { const g = c.route[k]; if (g.conn && g.junc && Math.abs(g.turn) > 0.35) { if (d + g.L > -6) sig = g.turn > 0 ? 1 : -1; break; } d += g.L; } }
      if (sig !== c.sig) { c.sig = sig; c.sigT = 0; } else c.sigT += dt;
    }
    // uzoqlashib ketgan yoki tiqilib qolgan mashinani o'yinchi atrofiga (ko'rinmaydigan joyga) ko'chirish
    if ((recycleT -= dt) < 0) { recycleT = 0.25; for (const c of cars) { const d = Math.hypot(c.x - fp[0], c.z - fp[2]); if (!c.placed || ((d > 1150 || c.stuck > 30) && !inView(c.x, c.z, 880))) { place(c, 640, 980, true); break; } } }
    // o'yinchi bilan to'qnashuv (mashinalar kinematik — o'yinchini itaradi)
    const px = pc.p[0], pz = pc.p[2];
    for (const c of cars) {
      if (!c.placed) continue;
      const fx = Math.sin(c.yaw), fz = Math.cos(c.yaw), cr = c.rad + pc.cr; let ox = c.x, oz = c.z; { const al = clamp((px - c.x) * fx + (pz - c.z) * fz, -c.half + c.rad, c.half - c.rad); ox += fx * al; oz += fz * al; } const dd2 = (ox - px) ** 2 + (oz - pz) ** 2;
      if (dd2 < cr * cr && Math.abs(c.y - pc.p[1]) < 2.6) {
        const d = Math.sqrt(dd2) || 0.01, nx = (px - ox) / d, nz = (pz - oz) / d, pen = cr - d;
        pc.p[0] += nx * pen; pc.p[2] += nz * pen;
        const rv = (pc.v[0] - fx * c.v) * nx + (pc.v[2] - fz * c.v) * nz;
        if (rv < 0) { pc.v[0] -= nx * rv * 1.25; pc.v[2] -= nz * rv * 1.25; if (-rv > 2.5) pc.events.push({ type: 'hit', v: -rv, x: px - nx * pc.cr, z: pz - nz * pc.cr }); }
        if (c.stun <= 0) game.audio.sfx('horn'); c.stun = 2.5; c.v *= 0.25; c.acc = Math.min(c.acc, -3);
      }
    }
    drawCars(night, t);
  };
  // ko'rinish: kuzov, g'ildirak, chiroqlar
  const lampM = (c, p, side, out2) => { M2.makeTranslation(p[0] * side, p[1], p[2]); out2.multiplyMatrices(M, M2); };
  const drawCars = (night, t) => {
    const cp = camPos(), nk = smoothstep(0.25, 0.7, night);
    poolMat.color.setRGB(0.3 * nk, 0.27 * nk, 0.21 * nk);
    for (let i = 0; i < NC; i++) {
      const c = cars[i], m = c.m, d = c.placed ? Math.hypot(c.x - cp.x, c.z - cp.z) : 1e9, vis = d < 820; m.root.visible = vis; c.vis = vis;
      if (!vis) { for (let k = 0; k < 4; k++) { indIM.setMatrixAt(i * 4 + k, ZERO); haloCol.fill(0, (i * 4 + k) * 3, (i * 4 + k) * 3 + 3); } poolIM.setMatrixAt(i, ZERO); continue; }
      E.set(c.pitch, c.yaw, 0); m.root.position.set(c.x, c.y, c.z); m.root.quaternion.setFromEuler(E); m.tilt.rotation.set(c.th, 0, c.ph);
      const near = d < 330; if (near !== c.near) { c.near = near; for (const w of m.wheels) w.pivot.visible = near; for (const n in m.parts) m.parts[n].mesh.visible = near; }
      if (near) { const W = c.fake.wheels; W[0].spin = W[1].spin = c.spinF; W[2].spin = W[3].spin = c.spinR; c.fake.steer = c.steer; syncWheels(m, c.fake); for (const w of m.wheels) w.pivot.position.y += w.z * c.th - w.x * c.ph; }
      const on = night > c.lightOn; c.lights = on;
      if (on) m.headMat.color.setRGB(2.5, 2.3, 1.8); else m.headMat.color.setHex(0xb8b8b0);
      if (c.braking || (c.v < 0.2 && c.mode !== 2 && c.mode !== 3)) m.tailMat.color.setRGB(2.6, 0.24, 0.12); else if (on) m.tailMat.color.setRGB(0.95, 0.07, 0.04); else m.tailMat.color.setHex(0x6a1410);
      m.root.updateMatrix(); m.tilt.updateMatrix(); M.multiplyMatrices(m.root.matrix, m.tilt.matrix);
      const blink = c.sig !== 0 && c.sigT % 0.72 < 0.38, L = c.lamps;
      const lOn = blink && (c.sig === 1 || c.sig === 2), rOn = blink && (c.sig === -1 || c.sig === 2);
      if (lOn) { lampM(c, L.F, 1, Mt); indIM.setMatrixAt(i * 4, Mt); lampM(c, L.R, 1, Mt); indIM.setMatrixAt(i * 4 + 1, Mt); } else { indIM.setMatrixAt(i * 4, ZERO); indIM.setMatrixAt(i * 4 + 1, ZERO); }
      if (rOn) { lampM(c, L.F, -1, Mt); indIM.setMatrixAt(i * 4 + 2, Mt); lampM(c, L.R, -1, Mt); indIM.setMatrixAt(i * 4 + 3, Mt); } else { indIM.setMatrixAt(i * 4 + 2, ZERO); indIM.setMatrixAt(i * 4 + 3, ZERO); }
      // faraning yo'ldagi nuri
      if (on && nk > 0.01 && d < 420) { M2.compose(V3.set(0, -c.com + 0.05, c.half + 6.8), Q.identity(), V3b.set(6.5, 1, 13.5)); Mt.multiplyMatrices(m.root.matrix, M2); poolIM.setMatrixAt(i, Mt); } else poolIM.setMatrixAt(i, ZERO);
      // shu'lalar: oldingilar faqat oldidan, orqadagilar orqasidan ko'rinadi
      const fx = Math.sin(c.yaw), fz = Math.cos(c.yaw), tcx = (cp.x - c.x) / (d || 1), tcz = (cp.z - c.z) / (d || 1), fd = fx * tcx + fz * tcz;
      const hk = on ? nk * 1.3 * (0.08 + 0.92 * Math.max(0, fd) ** 1.5) : 0, tb = c.braking || (c.v < 0.2 && c.mode < 2) ? 1.6 : 0.6, tk = (on ? nk : 0) * tb * (0.1 + 0.9 * Math.max(0, -fd) ** 1.2) + (c.braking ? 0.25 * Math.max(0, -fd) : 0);
      for (let k = 0; k < 4; k++) {
        const p = k < 2 ? L.HF : L.HR; V3.set(p[0] * (k % 2 ? -1 : 1), p[1], p[2]).applyMatrix4(M); const o = (i * 4 + k) * 3; haloPos[o] = V3.x; haloPos[o + 1] = V3.y; haloPos[o + 2] = V3.z;
        if (k < 2) { haloCol[o] = hk; haloCol[o + 1] = hk * 0.93; haloCol[o + 2] = hk * 0.78; } else { haloCol[o] = tk; haloCol[o + 1] = tk * 0.07; haloCol[o + 2] = tk * 0.04; }
      }
    }
    indIM.instanceMatrix.needsUpdate = true; poolIM.instanceMatrix.needsUpdate = true; haloGeo.attributes.position.needsUpdate = true; haloGeo.attributes.color.needsUpdate = true;
  };
  const hideCars = () => { for (let i = 0; i < NC; i++) { cars[i].m.root.visible = false; poolIM.setMatrixAt(i, ZERO); for (let k = 0; k < 4; k++) indIM.setMatrixAt(i * 4 + k, ZERO); } haloCol.fill(0); indIM.instanceMatrix.needsUpdate = true; poolIM.instanceMatrix.needsUpdate = true; haloGeo.attributes.color.needsUpdate = true; };

  // =================== MANZILLAR YONIDA TO'XTAB TURGAN MASHINALAR ===================
  const parked = [];
  const PARK_AT = [['bogiston', 2], ['bandargoh', 1], ['karvon', 1], ['qala', 1], ['mayoq', 1], ['tegirmon', 1]], PTYPES = ['sedan', 'xetch', 'pikap', 'furgon', 'xetch', 'sedan', 'pikap'];
  const pmodels = PTYPES.map((id) => { const m = buildVehicle(id, { lite: true }); m.paintMat.color.setHex(PAINT[(rnd() * PAINT.length) | 0]); m.root.remove(m.spot); m.root.remove(m.spot.target); m.root.visible = false; return m; });
  const placeParked = () => {
    let mi = 0; const uy = T.placeBy.uy;
    for (const [pid, n] of PARK_AT) {
      const P = T.placeBy[pid]; if (!P) continue; const rad = (P.r || 60) + 45, cand = [];
      for (let i = 0; i < R.n; i += 2) if ((R.x[i] - P.x) ** 2 + (R.z[i] - P.z) ** 2 < rad * rad && !R.bridge[i]) cand.push(i);
      for (let got = 0, tries = 0; got < n && tries < 60 && cand.length && mi < pmodels.length; tries++) {
        const i = cand[(rnd() * cand.length) | 0], side = rnd() < 0.5 ? 1 : -1, m = pmodels[mi], sp = m.spec, tx = R.tx[i], tz = R.tz[i], o = R.hw[i] + sp.wid / 2 + 0.25;
        const x = R.x[i] - tz * o * side, z = R.z[i] + tx * o * side, yaw = side > 0 ? Math.atan2(tx, tz) : Math.atan2(-tx, -tz), y = R.y[i];
        if (Math.hypot(x - uy.x, z - uy.z) < 80 || Math.hypot(x - game.car.p[0], z - game.car.p[2]) < 15 || (game.points || []).some((q) => Math.hypot(q.x - x, q.z - z) < 18)) continue;
        const nr = T.nearestRoad(x, z, 2); if (nr.edge >= 0 && nr.d < nr.hw + 0.3) continue;
        if (!spotFree(x, z, yaw, sp.len / 2, sp.wid / 2, y, null)) continue;
        const hf = T.gridHeight(x + Math.sin(yaw) * sp.wzF, z + Math.cos(yaw) * sp.wzF), hr = T.gridHeight(x - Math.sin(yaw) * sp.wzR, z - Math.cos(yaw) * sp.wzR), hc = hr + (hf - hr) * (sp.wzR / (sp.wzF + sp.wzR));
        E.set(-Math.atan2(hf - hr, sp.wzF + sp.wzR), yaw, 0); m.root.position.set(x, hc + sp.com + 0.02, z); m.root.quaternion.setFromEuler(E); scene.add(m.root);
        const f = fake(); f.wheels.forEach((w, k) => { w.len = sp.free - sp.sag; w.ly = (k < 2 ? sp.rF : sp.rR) + (sp.free - sp.sag) - sp.com; }); f.steer = (rnd() - 0.5) * 0.4; syncWheels(m, f);
        m.headMat.color.setHex(0xb8b8b0); m.tailMat.color.setHex(0x6a1410);
        COL.addBox(x, z, sp.wid / 2 + 0.05, sp.len / 2 + 0.05, yaw, hc - 0.5, hc + sp.hgt);
        parked.push({ m, x, z, y: hc }); mi++; got++;
      }
    }
  };
  out.parked = parked;
  const updParked = () => { const cp = camPos(); for (const p of parked) p.m.root.visible = (p.x - cp.x) ** 2 + (p.z - cp.z) ** 2 < 520 * 520; };

  // =================== QUSHLAR ===================
  // tanasi + ikki bo'g'imli qanot (ichki va tashqi qism), har biri alohida nusxali chizma; qanot qoqishi protsessorda
  const BS = [
    { span: 0.95, body: 0x2b2c31, wing: 0x2a2b30, hz: 5.2, amp: 0.85, glide: [0.06, 0.02] }, // qarg'a / zag'cha
    { span: 1.45, body: 0xf2f3f3, wing: 0xb4bbc3, hz: 2.6, amp: 0.62, glide: [0.16, -0.18] }, // chag'alay
    { span: 2.25, body: 0x4a3526, wing: 0x5d4330, hz: 1.6, amp: 0.5, glide: [0.12, 0.1] }, // burgut
  ];
  const bodyG = new GB(41); bodyG.jit = 0; bodyG.color(0xffffff);
  { const N = [0, 0.005, 0.21], Tl = [0, 0.012, -0.12], U = [0, 0.05, 0.04], D = [0, -0.04, 0.03], Lf = [0.048, 0.004, 0.04], Rt = [-0.048, 0.004, 0.04];
    bodyG.tri(N, U, Lf); bodyG.tri(N, Lf, D); bodyG.tri(N, D, Rt); bodyG.tri(N, Rt, U); bodyG.tri(Tl, Lf, U); bodyG.tri(Tl, D, Lf); bodyG.tri(Tl, Rt, D); bodyG.tri(Tl, U, Rt);
    bodyG.tri([0.016, 0.012, -0.1], [0.075, 0.008, -0.27], [-0.075, 0.008, -0.27]); bodyG.tri([0.016, 0.012, -0.1], [-0.075, 0.008, -0.27], [-0.016, 0.012, -0.1]); }
  const wingG = (outer, sx) => { const g = new GB(43); g.jit = 0; g.color(0xffffff); const P = outer ? [[0, 0, 0.06, 1], [0.27, 0, 0.0, 0.62], [0.24, 0, -0.055, 0.62], [0, 0, -0.095, 1]] : [[0, 0, 0.078, 1], [0.255, 0, 0.062, 1], [0.255, 0, -0.095, 1], [0, 0, -0.115, 1]];
    const v = P.map((p) => [p[0] * sx, p[1], p[2]]), up = [0, 1, 0]; g.triS(v[0], v[1], v[2], up, up, up, P[0][3], P[1][3], P[2][3]); g.triS(v[0], v[2], v[3], up, up, up, P[0][3], P[2][3], P[3][3]); return g.build(); };
  const NBIRD = 40, birdMat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  const bIM = [bodyG.build(), wingG(false, 1), wingG(true, 1), wingG(false, -1), wingG(true, -1)].map((geo) => { const im = new THREE.InstancedMesh(geo, birdMat, NBIRD); im.frustumCulled = false; scene.add(im); return im; });
  const birds = [];
  const mkBird = (sp, grp) => { const b = { sp, S: BS[sp], grp, x: 0, y: -999, z: 0, vx: 0, vy: 0, vz: 0, yaw: rnd() * 6.28, tyaw: 0, pitch: 0, roll: 0, ph: rnd() * 6.28, w: 1, fold: 0, state: 0, flapT: rnd() * 2, flapOn: true, px: 0, py: 0, pz: 0, hopT: rnd() * 3, peck: 0, hop: 0, delay: 0, ground: false, i: birds.length };
    for (let k = 0; k < 5; k++) bIM[k].setColorAt(b.i, new THREE.Color(k === 0 ? b.S.body : b.S.wing)); birds.push(b); return b; };
  // mayda qushlar galasi (o'yinchi atrofida; daraxt yoki yerga qo'nadi, yaqinlashsangiz uchib ketadi)
  const flocks = [0, 1].map((fi) => ({ fi, birds: [], state: 'fly', timer: 15 + rnd() * 20, ax: 0, az: 0, ang: rnd() * 6.28, rad: 70 + fi * 40, alt: 22 + fi * 10, tx: 0, ty: 0, tz: 0, perchT: 0, calm: 0 }));
  for (const f of flocks) for (let k = 0; k < 12; k++) f.birds.push(mkBird(0, f));
  // chag'alaylar: bandargoh, mayoq va o'yinchiga yaqin qirg'oq
  const gullGroups = [[-1180, 2470], [1318, 2660], null].map((a, gi) => ({ ax: a ? a[0] : 0, az: a ? a[1] : 0, fixed: !!a, gi, list: [], seekT: 0, ok: !!a }));
  for (const g of gullGroups) for (let k = 0; k < (g.fixed ? 5 : 4); k++) { const b = mkBird(1, g); b.r = 25 + rnd() * 45; b.om = (8 + rnd() * 2.5) / b.r * (rnd() < 0.5 ? -1 : 1); b.a0 = rnd() * 6.28; b.h0 = 14 + rnd() * 22; b.cx = (rnd() - 0.5) * 80; b.cz = (rnd() - 0.5) * 80; g.list.push(b); }
  // burgutlar: tog' va dara ustida issiq havo oqimida aylanadi
  const eagles = [[T.MOUNT.x + 140, T.MOUNT.z - 60], [T.MOUNT.x - 220, T.MOUNT.z + 160], [-2030, 705]].map((a) => { const b = mkBird(2, null); b.hx = a[0]; b.hz = a[1]; b.cx = a[0]; b.cz = a[1]; b.r = 65 + rnd() * 40; b.om = 11 / b.r * (rnd() < 0.5 ? -1 : 1); b.a0 = rnd() * 6.28; b.flapT = 5 + rnd() * 10; b.flapOn = false; return b; });
  const groundY = (x, z) => Math.max(T.gridHeight(x, z), T.waterY(x, z), 0);
  const threatOf = (b, pc, pl) => { const dc = Math.hypot(b.x - pc.p[0], b.z - pc.p[2]); if (dc < 13 || (dc < 30 && pc.speed > 3)) return [pc.p[0], pc.p[2]]; if (pl.onFoot && Math.hypot(b.x - pl.p[0], b.z - pl.p[2]) < 9) return [pl.p[0], pl.p[2]]; return null; };
  // tom qirralari: uy to'qnashuv qutilaridan topiladi, balandligi esa manzil modelining eng baland uchlaridan (har kadrda bitta uy)
  const roofs = { boxes: null, meshes: null };
  const initRoofs = () => {
    const L = COL.list, B = [], near = (a, b) => Math.abs(a) < 0.01 && Math.abs(b) < 0.01;
    for (let i = 0; i + 3 < L.length; i++) { const a = L[i], b = L[i + 1], c = L[i + 2], d = L[i + 3]; if (a.t !== 1 || b.t !== 1 || c.t !== 1 || d.t !== 1 || !near(a.x2 - b.x, a.z2 - b.z) || !near(b.x2 - c.x, b.z2 - c.z) || !near(c.x2 - d.x, c.z2 - d.z) || !near(d.x2 - a.x, d.z2 - a.z)) continue;
      const l1 = Math.hypot(a.x2 - a.x, a.z2 - a.z), l2 = Math.hypot(b.x2 - b.x, b.z2 - b.z), h = a.y1 - a.y0 - 2; i += 3;
      if (Math.min(l1, l2) < 4.5 || Math.max(l1, l2) > 20 || h < 3 || h > 14) continue;
      const lg = l1 >= l2 ? a : b, ll = Math.max(l1, l2), cx = (a.x + b.x + c.x + d.x) / 4, cz = (a.z + b.z + c.z + d.z) / 4;
      B.push({ cx, cz, ux: (lg.x2 - lg.x) / ll, uz: (lg.z2 - lg.z) / ll, hl: ll / 2, hw: Math.min(l1, l2) / 2, y0: a.y0 + 2, y1: a.y1, done: false, ridge: null }); }
    roofs.boxes = B; roofs.meshes = [];
    for (const o of scene.children) if (o.isMesh && !o.isInstancedMesh && o.material === MAT.flat && o.geometry.attributes.position.count > 600) { o.updateMatrixWorld(); if (!o.geometry.boundingBox) o.geometry.computeBoundingBox(); roofs.meshes.push({ o, bb: o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld) }); }
  };
  const stepRoofs = (fp) => {
    if (!roofs.boxes) initRoofs();
    const bx = roofs.boxes.find((q) => !q.done && (q.cx - fp[0]) ** 2 + (q.cz - fp[2]) ** 2 < 260 * 260); if (!bx) return; bx.done = true;
    let my = -1e9, lo = 1e9, hi = -1e9; const r = bx.hl + bx.hw;
    for (const { o, bb } of roofs.meshes) {
      if (bb.max.x < bx.cx - r || bb.min.x > bx.cx + r || bb.max.z < bx.cz - r || bb.min.z > bx.cz + r) continue;
      const a = o.geometry.attributes.position.array, e = o.matrixWorld.elements, id = o.matrixWorld.equals(Mt.identity());
      for (let i = 0; i < a.length; i += 3) {
        let x = a[i], y = a[i + 1], z = a[i + 2]; if (!id) { const X = e[0] * x + e[4] * y + e[8] * z + e[12], Y = e[1] * x + e[5] * y + e[9] * z + e[13], Z = e[2] * x + e[6] * y + e[10] * z + e[14]; x = X; y = Y; z = Z; }
        const dx = x - bx.cx, dz = z - bx.cz; if (dx * dx + dz * dz > r * r) continue;
        const du = dx * bx.ux + dz * bx.uz, dv = -dx * bx.uz + dz * bx.ux; if (Math.abs(du) > bx.hl - 0.25 || Math.abs(dv) > bx.hw - 0.25 || y > bx.y1 + 2) continue;
        if (y > my + 0.06) { my = y; lo = hi = du; } else if (y > my - 0.06) { lo = Math.min(lo, du); hi = Math.max(hi, du); }
      }
    }
    if (my > bx.y0 + 2.5 && hi - lo > 1.2) bx.ridge = { y: my, ax: bx.cx + bx.ux * lo, az: bx.cz + bx.uz * lo, bx: bx.cx + bx.ux * hi, bz: bx.cz + bx.uz * hi };
  };
  const CROWN = { round: 6.72, oval: 9.05, blossom: 5.53, pine: 11.6, pineSnow: 11.66, cypress: 9.2, acacia: 6.1 }; // daraxt tojining eng yuqori nuqtasi (props.js modellaridan)
  const choosePerch = (f, fp) => {
    let cx = 0, cz = 0; for (const b of f.birds) { cx += b.x; cz += b.z; } cx /= f.birds.length; cz /= f.birds.length;
    const rf = roofs.boxes ? roofs.boxes.filter((q) => q.ridge && (q.cx - cx) ** 2 + (q.cz - cz) ** 2 < 90 * 90 && Math.hypot(q.cx - fp[0], q.cz - fp[2]) > 30) : [];
    if (rf.length && rnd() < 0.65) {
      const q = rf[(rnd() * rf.length) | 0].ridge, q2 = rf[(rnd() * rf.length) | 0].ridge, ry = Math.atan2(q.bx - q.ax, q.bz - q.az) + Math.PI / 2;
      f.birds.forEach((b, k) => { const g = k % 3 === 2 ? q2 : q, u = 0.06 + rnd() * 0.88; b.px = g.ax + (g.bx - g.ax) * u; b.pz = g.az + (g.bz - g.az) * u; b.py = g.y + 0.01; b.ground = false; b.state = 1; b.ryaw = ry + (rnd() < 0.5 ? 0 : Math.PI) + (rnd() - 0.5) * 0.5; });
      return true;
    }
    const trees = []; for (const o of COL.query(cx, cz, 70)) if (o.ref && CROWN[o.ref.tree] && Math.hypot(o.x - fp[0], o.z - fp[2]) > 40) trees.push(o);
    if (trees.length && rnd() < 0.7) {
      trees.sort((a, b) => (a.x - cx) ** 2 + (a.z - cz) ** 2 - (b.x - cx) ** 2 - (b.z - cz) ** 2); const pick = trees.slice(0, 3);
      f.birds.forEach((b, k) => { const o = pick[k % pick.length], r = o.ref, top = r.y + CROWN[r.tree] * r.s * (r.sy || 1) + 0.1 * r.s, cone = r.tree === 'pine' || r.tree === 'pineSnow' || r.tree === 'cypress', sp = (cone ? 0.18 : 0.7) * r.s, a = rnd() * 6.28, q = Math.sqrt(rnd()), rr = sp * q;
        b.px = o.x + Math.cos(a) * rr; b.pz = o.z + Math.sin(a) * rr; b.py = top + 0.02 - (cone ? rr * 3.2 : rr * rr / (2.4 * r.s)); b.ground = false; b.state = 1; });
      return true;
    }
    for (let tr = 0; tr < 10; tr++) {
      const a = rnd() * 6.28, r = 20 + rnd() * 50, x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r, h = T.gridHeight(x, z);
      if (Math.hypot(x - fp[0], z - fp[2]) < 40 || T.waterY(x, z) > h - 0.3 || Math.abs(T.gridHeight(x + 3, z) - h) > 0.6) continue;
      const nr = T.nearestRoad(x, z, 1); if (nr.edge >= 0 && nr.d < nr.hw + 3) continue;
      if (COL.query(x, z, 6).length) continue;
      f.birds.forEach((b) => { const aa = rnd() * 6.28, rr = Math.sqrt(rnd()) * 5; b.px = x + Math.cos(aa) * rr; b.pz = z + Math.sin(aa) * rr; b.py = T.gridHeight(b.px, b.pz) + 0.02; b.ground = true; b.state = 1; });
      return true;
    }
    return false;
  };
  const takeoff = (f, from, hard) => { for (const b of f.birds) { let dx = b.x - (from ? from[0] : b.x - Math.sin(b.yaw)), dz = b.z - (from ? from[1] : b.z - Math.cos(b.yaw)); const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l; const k = hard ? 6 + rnd() * 3 : 3 + rnd() * 2; b.tvx = dx * k + (rnd() - 0.5) * 2; b.tvz = dz * k + (rnd() - 0.5) * 2; b.tvy = hard ? 4.5 + rnd() * 3 : 2.5 + rnd() * 1.5; b.delay = hard ? rnd() * 0.3 : rnd() * 1.6; if (b.state === 2) b.state = 3; else { b.state = 0; b.delay = 0; b.vx = b.tvx; b.vy = b.tvy; b.vz = b.tvz; } b.flapOn = true; b.flapT = 2 + rnd(); } f.state = 'fly'; f.timer = hard ? 25 + rnd() * 25 : 20 + rnd() * 25; if (from) { const cx = f.birds[0].x, cz = f.birds[0].z, dx = cx - from[0], dz = cz - from[1], l = Math.hypot(dx, dz) || 1; f.ang = Math.atan2(dz / l, dx / l); } };
  const updFlock = (f, dt, t, fp, pc, pl, night, cp) => {
    const B = f.birds; let cx = 0, cy = 0, cz = 0, avx = 0, avy = 0, avz = 0, nf = 0;
    for (const b of B) if (b.state === 0) { cx += b.x; cy += b.y; cz += b.z; avx += b.vx; avy += b.vy; avz += b.vz; nf++; }
    if (nf) { cx /= nf; cy /= nf; cz /= nf; avx /= nf; avy /= nf; avz /= nf; }
    // gala o'yinchidan juda uzoqlashsa (va ko'rinmasa) — yaqinroq joyga ko'chadi
    const fc = B[0], far = Math.hypot(fc.x - fp[0], fc.z - fp[2]) > 480 && Math.hypot(fc.x - cp.x, fc.z - cp.z) > 420;
    if (far || fc.y < -900) { const a = rnd() * 6.28, r = 220 + rnd() * 120, x = fp[0] + Math.cos(a) * r, z = fp[2] + Math.sin(a) * r, y = groundY(x, z) + f.alt; for (const b of B) { b.x = x + (rnd() - 0.5) * 10; b.y = y + (rnd() - 0.5) * 4; b.z = z + (rnd() - 0.5) * 10; b.vx = -Math.sin(a) * 9; b.vz = Math.cos(a) * 9; b.vy = 0; b.state = 0; } f.state = 'fly'; f.ax = fp[0]; f.az = fp[2]; }
    f.ax += (fp[0] - f.ax) * Math.min(1, dt * 0.08); f.az += (fp[2] - f.az) * Math.min(1, dt * 0.08); f.ang += dt * (0.1 + 0.03 * f.fi);
    f.tx = f.ax + Math.cos(f.ang) * f.rad; f.tz = f.az + Math.sin(f.ang) * f.rad; f.ty = groundY(f.tx, f.tz) + f.alt + Math.sin(t * 0.2 + f.fi) * 6;
    f.timer -= dt;
    if (f.state === 'fly' && (f.timer < 0 || night > 0.55)) { if (choosePerch(f, fp)) { f.state = 'land'; f.perchT = 14 + rnd() * 26; } else f.timer = 6; }
    if (f.state === 'land' || f.state === 'perch') {
      let allIn = true, th = null; for (const b of B) { if (b.state !== 2) allIn = false; if (!th) th = threatOf(b, pc, pl); }
      if (th) takeoff(f, th, true); else { if (allIn) f.state = 'perch'; if (f.state === 'perch' && (f.perchT -= dt) < 0 && night < 0.5) takeoff(f, null, false); }
    }
    for (const b of B) {
      if (b.state === 3 && (b.delay -= dt) <= 0) { b.state = 0; b.vx = b.tvx; b.vy = b.tvy; b.vz = b.tvz; }
      if (b.state === 2 || b.state === 3) { // qo'nib turibdi: sakraydi, cho'qiydi, atrofga qaraydi
        b.w += (0 - b.w) * Math.min(1, dt * 6); b.fold += (1 - b.fold) * Math.min(1, dt * 5); b.pitch += (0 - b.pitch) * Math.min(1, dt * 6); b.roll = 0;
        if ((b.hopT -= dt) < 0) { b.hopT = 1.2 + rnd() * 3; if (b.ground && rnd() < 0.6) { b.hop = 1; b.hx0 = b.x; b.hz0 = b.z; const a = rnd() * 6.28; b.hx1 = b.x + Math.cos(a) * 0.35; b.hz1 = b.z + Math.sin(a) * 0.35; b.tyaw = Math.atan2(Math.cos(a), Math.sin(a)); } else if (b.ground) b.peck = 0.45; else b.tyaw = b.yaw + (rnd() - 0.5) * 1.6; }
        b.yaw += angDiff(b.tyaw, b.yaw) * Math.min(1, dt * 5);
        if (b.hop > 0) { b.hop = Math.max(0, b.hop - dt * 3.5); const u = 1 - b.hop; b.x = b.hx0 + (b.hx1 - b.hx0) * u; b.z = b.hz0 + (b.hz1 - b.hz0) * u; b.y = T.gridHeight(b.x, b.z) + 0.02 + Math.sin(u * Math.PI) * 0.14; }
        if (b.peck > 0) { b.peck -= dt; b.pitch = Math.sin((0.45 - b.peck) / 0.45 * Math.PI) * 0.7; }
        continue;
      }
      if (b.state === 1) { // qo'nishga yaqinlashmoqda
        const dx = b.px - b.x, dy = b.py - b.y, dz = b.pz - b.z, d = Math.hypot(dx, dy, dz), sp = clamp(d * 0.8, 0.8, 11), k = Math.min(1, dt * 2.4);
        b.vx += (dx / (d || 1) * sp - b.vx) * k; b.vy += (dy / (d || 1) * sp - b.vy) * k; b.vz += (dz / (d || 1) * sp - b.vz) * k;
        if (d < 0.3) { b.state = 2; b.x = b.px; b.y = b.py; b.z = b.pz; b.vx = b.vy = b.vz = 0; b.hopT = 0.5 + rnd() * 2; b.tyaw = b.ryaw != null ? b.ryaw : b.yaw; b.ryaw = null; continue; }
        b.flapOn = d < 6 || b.vy > -0.5;
      } else { // erkin parvoz: gala qoidalari (yaqinlashish, bir tomonga uchish, bir-biridan qochish)
        let ax = (cx - b.x) * 0.25 + (avx - b.vx) * 0.6, ay = (cy - b.y) * 0.25 + (avy - b.vy) * 0.6, az = (cz - b.z) * 0.25 + (avz - b.vz) * 0.6;
        const tx = f.tx - b.x, ty = f.ty - b.y, tz = f.tz - b.z, tl = Math.hypot(tx, ty, tz) || 1; ax += tx / tl * 3.2; ay += ty / tl * 2.2; az += tz / tl * 3.2;
        for (const o of B) { if (o === b || o.state !== 0) continue; const ex = b.x - o.x, ey = b.y - o.y, ez = b.z - o.z, e2 = ex * ex + ey * ey + ez * ez; if (e2 < 9) { const k = 5 / (e2 + 0.15); ax += ex * k; ay += ey * k; az += ez * k; } }
        const gy = groundY(b.x, b.z) + 9; if (b.y < gy) ay += (gy - b.y) * 3;
        b.vx += ax * dt; b.vy += ay * dt; b.vz += az * dt; b.vy = clamp(b.vy, -4, 5);
        const sp = Math.hypot(b.vx, b.vz), sc = sp > 13 ? 13 / sp : sp < 7 ? 7 / Math.max(sp, 0.1) : 1; b.vx *= sc; b.vz *= sc;
        if ((b.flapT -= dt) < 0) { b.flapOn = !b.flapOn; b.flapT = b.flapOn ? 0.7 + rnd() * 1.1 : 0.35 + rnd() * 0.7; } if (b.vy > 1) b.flapOn = true;
      }
      b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt; b.fold += (0 - b.fold) * Math.min(1, dt * 7);
      flightPose(b, dt);
    }
  };
  const flightPose = (b, dt) => {
    const sp = Math.hypot(b.vx, b.vz); if (sp > 0.3) { const ny = Math.atan2(b.vx, b.vz), om = angDiff(ny, b.yaw) / Math.max(dt, 1e-3); b.yaw = ny; b.roll += (clamp(Math.atan(sp * om / 9.8) * 1.2, -0.75, 0.75) - b.roll) * Math.min(1, dt * 4); }
    b.pitch += (clamp(-Math.atan2(b.vy, Math.max(sp, 1)), -0.6, 0.6) - b.pitch) * Math.min(1, dt * 4);
    b.w += ((b.flapOn ? 1 : 0) - b.w) * Math.min(1, dt * 5); b.ph += dt * b.S.hz * 6.283 * (b.state === 1 ? 1.25 : 1);
  };
  const updGulls = (dt, t, fp) => {
    for (const g of gullGroups) {
      if (!g.fixed && (g.seekT -= dt) < 0) { // o'yinchiga yaqin qirg'oqni izlash
        g.seekT = 8; let best = null; for (let r = 80; r <= 420 && !best; r += 85) for (let k = 0; k < 16; k++) { const a = k / 16 * 6.283, x = fp[0] + Math.cos(a) * r, z = fp[2] + Math.sin(a) * r, h = T.gridHeight(x, z); if (h < 0.4 && h > -6) { best = [x, z]; break; } }
        if (best) { const cp = camPos(); if (!g.ok || Math.hypot(g.ax - cp.x, g.az - cp.z) > 700) { g.ax = best[0]; g.az = best[1]; } g.ok = true; } else if (Math.hypot(g.ax - camPos().x, g.az - camPos().z) > 700) g.ok = false;
      }
      for (const b of g.list) {
        if (!g.ok) { b.y = -999; continue; }
        const a = b.a0 + t * b.om, cx = g.ax + b.cx + Math.sin(t * 0.021 + b.a0) * 55, cz = g.az + b.cz + Math.cos(t * 0.017 + b.a0 * 2) * 55;
        const x = cx + Math.cos(a) * b.r * (1 + 0.25 * Math.sin(t * 0.13 + b.a0)), z = cz + Math.sin(a) * b.r, y = Math.max(0, T.gridHeight(x, z)) + b.h0 + Math.sin(t * 0.31 + b.a0 * 3) * 6;
        if (b.y > -900 && dt > 0) { b.vx = (x - b.x) / dt; b.vy = (y - b.y) / dt; b.vz = (z - b.z) / dt; } b.x = x; b.y = y; b.z = z;
        if ((b.flapT -= dt) < 0) { b.flapOn = !b.flapOn; b.flapT = b.flapOn ? 0.9 + rnd() * 1.2 : 3 + rnd() * 6; } if (b.vy > 1.2) b.flapOn = true;
        flightPose(b, dt);
      }
    }
  };
  const updEagles = (dt, t) => {
    for (const b of eagles) {
      b.cx += dt * 0.9; if (b.cx - b.hx > 420 && !inView(b.x, b.z, 1400)) b.cx -= 840; // issiq oqim shamol bilan suriladi
      const a = b.a0 + t * b.om, x = b.cx + Math.cos(a) * b.r, z = b.cz + Math.sin(a) * b.r, y = Math.max(T.gridHeight(b.cx, b.cz), T.gridHeight(x, z)) + 85 + Math.sin(t * 0.05 + b.a0) * 35;
      if (b.y > -900 && dt > 0 && Math.abs(x - b.x) < 30) { b.vx = (x - b.x) / dt; b.vy = (y - b.y) / dt; b.vz = (z - b.z) / dt; } b.x = x; b.y = y; b.z = z;
      if ((b.flapT -= dt) < 0) { b.flapOn = !b.flapOn; b.flapT = b.flapOn ? 1.6 + rnd() : 10 + rnd() * 14; }
      const sp = Math.hypot(b.vx, b.vz); if (sp > 0.3) b.yaw = Math.atan2(b.vx, b.vz);
      b.roll = -Math.sign(b.om) * 0.32; b.pitch += (clamp(-Math.atan2(b.vy, Math.max(sp, 1)), -0.4, 0.4) - b.pitch) * Math.min(1, dt * 2);
      b.w += ((b.flapOn ? 1 : 0) - b.w) * Math.min(1, dt * 3); b.ph += dt * b.S.hz * 6.283;
    }
  };
  const SH = [0.03, 0.022, 0.05], drawBirds = (night) => {
    const cp = camPos();
    for (const b of birds) {
      const d = Math.hypot(b.x - cp.x, b.y - cp.y, b.z - cp.z), hide = b.y < -900 || d > (b.sp === 0 ? 650 : 1400) || (b.sp > 0 && night > 0.75);
      if (hide) { for (let k = 0; k < 5; k++) bIM[k].setMatrixAt(b.i, ZERO); continue; }
      const S = b.S, sc = S.span / 1.1, bob = b.state >= 2 ? 0 : -Math.sin(b.ph) * 0.025 * b.w * S.span;
      E.set(b.pitch, b.yaw, b.roll); M.compose(V3.set(b.x, b.y + bob + (b.state >= 2 ? 0.05 * S.span : 0), b.z), Q.setFromEuler(E), V3b.set(sc, sc, sc)); bIM[0].setMatrixAt(b.i, M);
      const fl = Math.sin(b.ph), a1 = b.w * (S.amp * fl + 0.12) + (1 - b.w) * S.glide[0], a2 = b.w * (S.amp * 0.9 * Math.sin(b.ph - 0.75)) + (1 - b.w) * S.glide[1], fo = b.fold;
      for (const sd of [1, -1]) {
        El.set(0, sd * fo * 1.35, sd * (a1 * (1 - fo) - fo * 0.15)); Mt.makeRotationFromEuler(El).setPosition(SH[0] * sd, SH[1], SH[2]); M2.multiplyMatrices(M, Mt); bIM[sd > 0 ? 1 : 3].setMatrixAt(b.i, M2);
        El.set(0, -sd * fo * 2.9, sd * a2 * (1 - fo)); Mt.makeRotationFromEuler(El).setPosition(0.255 * sd, fo * 0.014, 0); Mt.premultiply(M2); bIM[sd > 0 ? 2 : 4].setMatrixAt(b.i, Mt);
      }
    }
    for (const im of bIM) im.instanceMatrix.needsUpdate = true;
  };
  for (const b of birds) for (let k = 0; k < 5; k++) bIM[k].setMatrixAt(b.i, ZERO);
  out.birds = birds;

  // =================== HAVO SHARLARI ===================
  // shamol balandlikka qarab yo'nalishini o'zgartiradi — uchuvchi balandlikni tanlab, uyiga yaqin qoladi; o'choq vaqti-vaqti bilan yonadi
  const balloons = [];
  const prof = [[0, 0.16], [0.12, 0.42], [0.28, 0.72], [0.46, 0.93], [0.64, 1.0], [0.8, 0.9], [0.92, 0.62], [1.0, 0.0]];
  const flameG = new GB(61); flameG.jit = 0; { const n = 8, up = 2.6; for (let s = 0; s < n; s++) { const a0 = s / n * 6.283, a1 = (s + 1) / n * 6.283, r = 0.32, P = (a, rr, y) => [Math.sin(a) * rr, y, Math.cos(a) * rr], N = (a) => [Math.sin(a), 0.3, Math.cos(a)];
    flameG.colorLin([1, 0.85, 0.55]); flameG.triS(P(a0, r, 0), P(a1, r, 0), P(a1, r * 0.75, up * 0.45), N(a0), N(a1), N(a1), 1, 1, 0.8); flameG.triS(P(a0, r, 0), P(a1, r * 0.75, up * 0.45), P(a0, r * 0.75, up * 0.45), N(a0), N(a1), N(a0), 1, 0.8, 0.8);
    flameG.triS(P(a0, r * 0.75, up * 0.45), P(a1, r * 0.75, up * 0.45), [0, up, 0], N(a0), N(a1), [0, 1, 0], 0.8, 0.8, 0.15); } }
  const NBAL = 6, flameMat = new THREE.MeshBasicMaterial({ vertexColors: true, color: new THREE.Color(2.4, 1.25, 0.4), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
  const flameIM = new THREE.InstancedMesh(flameG.build(), flameMat, NBAL); flameIM.frustumCulled = false; scene.add(flameIM);
  const glowG = new GB(62); glowG.jit = 0; { const R0 = 9.12, H = 22.2, NG = 12; for (let s = 0; s < NG; s++) { const a0 = s / NG * 6.283, a1 = (s + 1) / NG * 6.283; for (let k = 0; k < 5; k++) { const [h0, r0] = prof[k], [h1, r1] = prof[k + 1], P = (a, h, r) => [Math.sin(a) * r * R0, h * H, Math.cos(a) * r * R0], Nn = (a) => [Math.sin(a), 0, Math.cos(a)], k0 = 1 - h0 * 1.4, k1 = 1 - h1 * 1.4;
    glowG.triS(P(a0, h0, r0), P(a1, h0, r0), P(a1, h1, r1), Nn(a0), Nn(a1), Nn(a1), k0, k0, k1); glowG.triS(P(a0, h0, r0), P(a1, h1, r1), P(a0, h1, r1), Nn(a0), Nn(a1), Nn(a0), k0, k1, k1); } } }
  const glowIM = new THREE.InstancedMesh(glowG.build(), new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }), NBAL); glowIM.frustumCulled = false; scene.add(glowIM);
  const black = new THREE.Color(0, 0, 0); for (let i = 0; i < NBAL; i++) { flameIM.setMatrixAt(i, ZERO); glowIM.setMatrixAt(i, ZERO); glowIM.setColorAt(i, black); }
  const mkBalloon = (x, z, alt, c1, c2, seed) => {
    const g = new GB(seed); g.jit = 0; const Rr = 9, H = 22, NG = 12;
    for (let s = 0; s < NG; s++) {
      g.color(s % 2 ? c1 : c2);
      const a0 = (s / NG) * 6.283, a1 = ((s + 1) / NG) * 6.283;
      for (let k = 0; k < prof.length - 1; k++) {
        const [h0, r0] = prof[k], [h1, r1] = prof[k + 1];
        const P = (a, h, r) => [Math.sin(a) * r * Rr, h * H, Math.cos(a) * r * Rr], Nn = (a, r0q, r1q) => [Math.sin(a), (r0q - r1q) * 0.8, Math.cos(a)];
        const n0 = Nn(a0, r0, r1), n1 = Nn(a1, r0, r1);
        g.triS(P(a0, h0, r0), P(a1, h0, r0), P(a1, h1, r1), n0, n1, n1, 0.86 + h0 * 0.2, 0.86 + h0 * 0.2, 0.86 + h1 * 0.2);
        if (r1 > 0.001) g.triS(P(a0, h0, r0), P(a1, h1, r1), P(a0, h1, r1), n0, n1, n0, 0.86 + h0 * 0.2, 0.86 + h1 * 0.2, 0.86 + h1 * 0.2);
      }
    }
    // savat, arqonlar, o'choq ramkasi va gaz ballonlari
    g.color(0x8a5a36).box(0, -4.2, 0, 2.2, 1.8, 2.2); g.color(0x5e3e26).box(0, -3.25, 0, 2.32, 0.14, 2.32); g.color(0x4a3a2a); for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { g.push().translate(sx * 1.0, -3.3, sz * 1.0); g.box(0, 2.0, 0, 0.06, 4.6, 0.06); g.pop(); }
    g.color(0x3a3d44); for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { g.push().translate(sx * 0.5, -2.35, sz * 0.5); g.box(0, 0, 0, 0.05, 1.3, 0.05); g.pop(); } g.color(0x55585f).box(0, -1.75, 0, 1.1, 0.12, 1.1); g.color(0x9aa0a8).cyl(8, 0.26, 0.26, -1.9, -1.55);
    const m = new THREE.Mesh(g.build(), MAT.flat); m.rotation.order = 'YXZ'; scene.add(m);
    const gy = groundY(x, z);
    balloons.push({ m, i: balloons.length, hx: x, hz: z, x, z, y: Math.max(alt, gy + 90), vx: 0, vz: 0, vy: 0, heat: 0.5, burn: false, burnT: 0, coolT: 2 + seed, tAlt: Math.max(alt, gy + 90) - gy, yaw: seed, yv: 0, ph: seed * 1.7, plan: 0, fl: 0 });
  };
  mkBalloon(-380, 1700, 150, 0xe2572f, 0xf7efe0, 1); mkBalloon(1500, -1300, 190, 0x2f7fd0, 0xf0b83a, 2); mkBalloon(-1900, -600, 170, 0x8a54c8, 0xf7efe0, 3); mkBalloon(1900, 700, 160, 0x3f9a58, 0xf0b83a, 4); mkBalloon(-900, 900, 210, 0xd8392b, 0x2f7fd0, 5); mkBalloon(600, 1900, 130, 0x24b8b0, 0xf7efe0, 6);
  const windAt = (h, t, o) => { const a = 0.35 + h * 0.0048 + Math.sin(t * 0.004) * 0.4, s = 1.4 + h * 0.008; o[0] = Math.cos(a) * s; o[1] = Math.sin(a) * s; return o; };
  const WV = [0, 0], gcol = new THREE.Color();
  const updBalloons = (dt, t, night) => {
    for (const b of balloons) {
      const gy = groundY(b.x, b.z), h = b.y - gy;
      // uchuvchi: uyidan uzoqlashsa — uyga qarab esayotgan shamol qatlamini tanlaydi
      if ((b.plan -= dt) < 0) { b.plan = 18 + rnd() * 14; const hx = b.hx - b.x, hz = b.hz - b.z, hd = Math.hypot(hx, hz); let best = b.tAlt, bs = -1e9; for (let a = 70; a <= 330; a += 20) { windAt(a, t, WV); const sc = (WV[0] * hx + WV[1] * hz) / (hd || 1) * smoothstep(150, 650, hd) + (rnd() - 0.5) * 0.6 - Math.abs(a - b.tAlt) * 0.002; if (sc > bs) { bs = sc; best = a; } } b.tAlt = best; }
      windAt(h, t, WV); b.vx += (WV[0] - b.vx) * Math.min(1, dt * 0.12); b.vz += (WV[1] - b.vz) * Math.min(1, dt * 0.12);
      // o'choq: issiqlik ko'taradi, sovuganda sekin pasayadi
      const want = b.tAlt - h; b.burnT -= dt;
      if (b.burn) { if ((b.burnT < 0 && (want < 3 || b.vy > 1.2)) || b.burnT < -6) { b.burn = false; b.burnT = 2 + rnd() * 3; } }
      else if (b.burnT < 0 && ((want > 4 && b.vy < 0.7) || b.vy < -1.1 || h < 45)) { b.burn = true; b.burnT = 1.6 + rnd() * 2.4; }
      b.heat = clamp(b.heat + (b.burn ? 0.11 : -0.022) * dt, 0, 1); b.vy += ((b.heat - 0.5) * 0.9 - b.vy * 0.22) * dt;
      b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt; if (b.y < gy + 35) { b.y = gy + 35; b.vy = Math.max(b.vy, 0); }
      b.yv += ((rnd() - 0.5) * 0.02 - b.yv * 0.05) * dt; b.yaw += b.yv * dt;
      b.m.position.set(b.x, b.y, b.z); b.m.rotation.set(Math.sin(t * 0.83 + b.ph) * 0.018 + b.vy * 0.004, b.yaw, Math.cos(t * 0.67 + b.ph * 1.3) * 0.016);
      b.m.updateMatrix();
      // alanga titrashi
      const fk = b.burn ? 0.82 + 0.25 * Math.sin(t * 31 + b.ph) * Math.sin(t * 17.3 + b.ph * 2) + 0.08 * Math.sin(t * 53) : 0.12 + 0.02 * Math.sin(t * 23 + b.ph);
      b.fl += (fk - b.fl) * Math.min(1, dt * (b.burn ? 22 : 9));
      M2.compose(V3.set(0, -1.55, 0), Q.identity(), V3b.set(0.8 + b.fl * 0.4, b.fl * 1.25, 0.8 + b.fl * 0.4)); Mt.multiplyMatrices(b.m.matrix, M2); flameIM.setMatrixAt(b.i, Mt);
      const gk = (b.burn ? b.fl : 0) * (0.06 + 0.5 * smoothstep(0.2, 0.8, night)); glowIM.setMatrixAt(b.i, gk > 0.004 ? b.m.matrix : ZERO); glowIM.setColorAt(b.i, gcol.setRGB(gk, gk * 0.42, gk * 0.1));
    }
    flameIM.instanceMatrix.needsUpdate = true; glowIM.instanceMatrix.needsUpdate = true; glowIM.instanceColor.needsUpdate = true;
  };
  out.balloons = balloons;

  // =================== HAR KADR ===================
  const init = () => { inited = true; placeParked(); const fp = focus(); for (const c of cars) place(c, 60, 950, false); };
  out.cars = cars; // piyoda qahramon to'qnashuvi uchun (player.js)
  out.update = (dt, t, active) => {
    dt = Math.min(dt, 0.1); if (!inited) init();
    const night = game.sky.night, fp = focus(), pc = game.car, pl = game.player, cp = camPos();
    if (active) updCars(dt, t); else hideCars();
    updParked(); stepRoofs(fp);
    for (const f of flocks) updFlock(f, dt, t, fp, pc, pl, night, cp);
    updGulls(dt, t, fp); updEagles(dt, t); drawBirds(night);
    updBalloons(dt, t, night);
  };
  return out;
}
