// Piyoda ishlar: yo'l ta'miri (Ko'hna qal'a — konus, chuqurlarni ko'mish), qo'y boqish (Shamol tegirmonlari — podani yaylovga haydab, qaytarish), quruvchi (Ko'zgu ko'l — g'isht devor), fotograf (Mayoq burni — gazetaga orol suratlari)
import * as THREE from 'three';
import * as T from './terrain.js';
import * as COL from './colliders.js';
import { GB, MAT } from './geo.js';
import { clamp, angDiff } from './util.js';

const som = (n) => Math.round(n).toLocaleString('ru-RU');
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
// fotograf buyurtmalari: [id, nom, manzil (PLACES) yoki 'qoy', eng yaqin / eng uzoq masofa]
const SUBJ = [['mayoq', 'Mayoq minorasi', 'mayoq', 18, 170], ['qala', "Ko'hna qal'a devorlari", 'qala', 20, 180], ['tegirmon', 'Shamol tegirmonlari', 'tegirmon', 20, 180], ['choqqi', "Cho'qqidagi rasadxona", 'choqqi', 20, 200], ['vulqon', "Olovtog' krateri", 'vulqon', 25, 260],
  ['muzkol', "Muzko'l", 'muzkol', 20, 220], ['karvon', 'Karvonsaroy', 'karvon', 20, 200], ['kol', "Ko'zgu ko'l", 'kol', 20, 220], ['dara', 'Qizil dara qoyalari', 'dara', 20, 220], ['aerodrom', 'Eski aerodrom', 'aerodrom', 30, 300], ['qoy', "Yaylovdagi qo'y", 'qoy', 3, 28], ['bogiston', "Bog'iston qishlog'i", 'bogiston', 25, 220]];

export function initIshlar3(game, D) {
  const { scene, car } = game, st = game.state, pl = game.player, L = game.live;
  const toast = (m, k) => game.toast(m, k), sfx = (n, k) => game.audio.sfx(n, k), fx = () => game.fx, gy = D.gy, places = game.site.places;
  const mesh = (g) => { const m = new THREE.Mesh(g.build(), MAT.flat); m.castShadow = true; m.receiveShadow = true; return m; };
  const dm = new THREE.Object3D(), col = new THREE.Color();
  const giverAt = (id, pid, seed, name, look, r0 = 8, r1 = 45) => { const b = places[pid] && (places[pid].board || places[pid]); if (!b) return null; const p = D.spotNear(b.x, b.z, r0, r1, null, seed); return p ? D.giver(id, p.x, p.z, D.roadYaw(p.x, p.z), name, look) : null; };
  const me = () => (pl.onFoot ? pl.p : car.p);

  // ================= 1. YO'L TA'MIRI =================
  const yg = giverAt('yol', 'qala', 1.1, "Yo'l ustasi Akbar", { shirt: 0xe2902a, pants: 0x3a3f4c, vest: 0xffd23a, hair: 0x2a1d16, stache: true });
  const holeG = (() => { const g = new GB(4201); g.jit = 0.04; g.color(0xffffff).cyl(10, 0.75, 0.85, 0, 0.05, { cap: true }); return g.build(); })();
  const holeIM = new THREE.InstancedMesh(holeG, MAT.flat, 6); holeIM.count = 0; holeIM.receiveShadow = true; scene.add(holeIM);
  const coneG = (() => { const g = new GB(4202); g.jit = 0.01; g.color(0x2a2c33).box(0, 0.03, 0, 0.5, 0.06, 0.5); g.color(0xff6a1a).cyl(10, 0.2, 0.04, 0.06, 0.78, { cap: true }); g.color(0xf2f2ee).cyl(10, 0.145, 0.115, 0.36, 0.48); return g.build(); })();
  const coneIM = new THREE.InstancedMesh(coneG, MAT.flat, 2); coneIM.count = 0; coneIM.castShadow = true; scene.add(coneIM);
  const HOLE_C = [0x1a1714, 0x8a7a64, 0x3a3c42];
  const drawRoad = (J) => { let n = 0; if (J) J.holes.forEach((h) => { dm.position.set(h.x, gy(h.x, h.z) + (h.s === 2 ? 0.02 : 0.005), h.z); dm.rotation.set(0, h.yaw, 0); dm.scale.set(1, 1, 1); dm.updateMatrix(); holeIM.setMatrixAt(n, dm.matrix); holeIM.setColorAt(n, col.setHex(HOLE_C[h.s])); n++; }); holeIM.count = n; holeIM.instanceMatrix.needsUpdate = true; if (holeIM.instanceColor) holeIM.instanceColor.needsUpdate = true;
    n = 0; if (J) for (const c of J.cones) if (c.on) { dm.position.set(c.x, gy(c.x, c.z), c.z); dm.rotation.set(0, 0, 0); dm.updateMatrix(); coneIM.setMatrixAt(n++, dm.matrix); } coneIM.count = n; coneIM.instanceMatrix.needsUpdate = true; };
  const ptAt = (e, s, off) => { let k = 0; while (k < e.count - 1 && e.s[k] < s) k++; return D.roadPt(e.start + k, off); };
  D.reg({ id: 'yol', ic: '🚧', name: "Yo'l ta'miri", cat: 'foot', place: 'qala', mins: 4, xp: 12, pay: "600–1 100 so'm", need: 'piyoda (manzilga transportda borsa bo\'ladi)',
    desc: "Yo'ldagi chuqurlarni ko'mish: avval ikki chetga konus qo'yasiz, har chuqurga shag'al to'kib zichlaysiz, oxirida konuslarni yig'asiz.",
    rules: () => "Ish joyi — to'q sariq nur. Piyoda: konus joyida <kbd>E</kbd>, chuqur oldida <kbd>E</kbd> — shag'al, yana <kbd>E</kbd> — zichlash (kurak bilan). Konussiz chuqurga tegsangiz bo'lmaydi. Chuqur bosqichi 70 so'm, konus 25, oxirida bonus 150.",
    start(J) { if (!yg) return false; const R = T.roads; let e = null, s0 = 0; for (let k = 0; k < 200 && !e; k++) { const i = (Math.random() * R.n) | 0, d = Math.hypot(R.x[i] - yg.x, R.z[i] - yg.z); if (d < 140 || d > 720 || R.bridge[i]) continue; const ee = R.edges[R.edge[i]], ss = ee.s[R.idx[i]]; if (ss < 20 || ss > ee.len - 70) continue; e = ee; s0 = ss; }
      if (!e) return false; const hw = e.hw, holes = [0, 13, 26, 39].map((ds, k) => Object.assign(ptAt(e, s0 + ds, (k % 2 ? 1 : -1) * hw * 0.38), { s: 0 })), cones = [Object.assign(ptAt(e, s0 - 9, hw * 0.15), { on: 0 }), Object.assign(ptAt(e, s0 + 48, -hw * 0.15), { on: 0 })];
      Object.assign(J, { holes, cones, stage: 'cone', intro: `Ish joyi ${Math.round(Math.hypot(holes[0].x - yg.x, holes[0].z - yg.z))} m nariroqda: ikki konus, ${holes.length} chuqur` }); J.t = 240 + Math.hypot(holes[0].x - yg.x, holes[0].z - yg.z) / 5; drawRoad(J); this.mk(J); },
    mk(J) { const pts = J.stage === 'cone' ? J.cones.filter((c) => !c.on) : J.stage === 'fix' ? J.holes.filter((h) => h.s < 2) : J.cones.filter((c) => c.on); D.marks(pts.map((p) => ({ x: p.x, z: p.z }))); },
    extra(J, offer, px, pz) { const nr = (p, r = 2.2) => Math.hypot(p.x - px, p.z - pz) < r;
      if (J.stage === 'cone') for (const c of J.cones) if (!c.on && nr(c)) offer(-0.2, "<kbd>E</kbd> Konus qo'yish 🚧", () => pl.act('bend', 0.7, () => { c.on = 1; sfx('pop'); D.pay('yol', 25, 'konus'); drawRoad(J); if (J.cones.every((q) => q.on)) { J.stage = 'fix'; toast('🚧 Ish joyi o\'ralgan — endi chuqurlarni ko\'ming', 'good'); } this.mk(J); }));
      if (J.stage === 'fix') for (const h of J.holes) if (h.s < 2 && nr(h, 2.0)) offer(-0.2, h.s === 0 ? "<kbd>E</kbd> Shag'al to'kish 🪨" : '<kbd>E</kbd> Kurak bilan zichlash ⛏', () => { pl.yaw = Math.atan2(h.x - pl.p[0], h.z - pl.p[2]); pl.act(h.s ? 'swing' : 'bend', h.s ? 1.3 : 1.0, () => { h.s++; J.done += 0.5; sfx(h.s === 2 ? 'hit' : 'rustle', 0.4); fx().burst(8, h.x, gy(h.x, h.z) + 0.3, h.z, 1.4, 0.6, 0.25, h.s === 2 ? 0x3a3c42 : 0x8a7a64, 0.8, 1, 5, 0.2); D.pay('yol', 70, h.s === 2 ? 'chuqur tekis' : "shag'al"); drawRoad(J);
        if (J.holes.every((q) => q.s === 2)) { J.stage = 'pick'; toast("🛣 Yo'l tekis! Konuslarni yig'ing", 'good'); } this.mk(J); }, 'shovel'); });
      if (J.stage === 'pick') for (const c of J.cones) if (c.on && nr(c)) offer(-0.2, "<kbd>E</kbd> Konusni yig'ish", () => pl.act('bend', 0.7, () => { c.on = 0; sfx('pick'); D.pay('yol', 25, 'konus'); drawRoad(J); this.mk(J); if (J.cones.every((q) => !q.on)) { D.pay('yol', 150 + Math.max(0, J.t) * 0.5, "yo'l ochildi"); D.finish(true, `Akbar aka: «Endi mashinalar silliq o'tadi!» · ${som(J.earn)} so'm`); } })); },
    tick(J) { if (!game.way && D._mk[0]) game.setWaypoint(D._mk[0].x, D._mk[0].z, true); },
    line: (J) => (J.stage === 'cone' ? `Ikki chetga konus qo'ying: ${J.cones.filter((c) => c.on).length}/2` : J.stage === 'fix' ? `Chuqurlar: ${J.holes.filter((h) => h.s === 2).length}/${J.holes.length} · shag'al → zichlash` : `Konuslarni yig'ing: ${J.cones.filter((c) => !c.on).length}/2`),
    end(J) { if (J.stage !== 'pick' || J.cones.some((c) => c.on)) { J.holes = []; J.cones = []; } drawRoad(null); } });

  // ================= 2. QO'Y BOQISH =================
  const qg = giverAt('qoy', 'tegirmon', 2.4, "Cho'pon Ergash bobo", { shirt: 0x8a6a44, pants: 0x4a3a2a, vest: 0x5a3a26, hair: 0xd8d8d8, stache: true }, 10, 60);
  let pen = null; if (qg) { pen = D.spotNear(qg.x, qg.z, 12, 40, (x, z, si) => si.slope < 0.15 && si.roadD > 8, 0.3, 6); if (pen) { const g = new GB(4211); g.jit = 0.03; for (let i = 0; i < 20; i++) { if (i === 0 || i === 19) continue; const a = (i / 20) * 6.283 + D.roadYaw(pen.x, pen.z), x = pen.x + Math.sin(a) * 6, z = pen.z + Math.cos(a) * 6, y = gy(x, z);
    g.push().translate(x, y, z).rotY(a + Math.PI / 2); g.color(0x8a6a44).box(0, 0.5, 0, 0.1, 1.0, 0.1); g.color(0x9a7a50).box(0.95, 0.35, 0, 1.9, 0.07, 0.05).box(0.95, 0.75, 0, 1.9, 0.07, 0.05); g.pop(); } const m = mesh(g); scene.add(m); pen.yaw = D.roadYaw(pen.x, pen.z); } }
  const sheepG = (() => { const g = new GB(4212); g.jit = 0.03; g.color(0xf2efe6).blob(0.36, 1, { cy: 0.62, sz: 1.35, shade: 0.12 }); g.color(0x2a2420).push().translate(0, 0.74, 0.48).rotX(-0.4).blob(0.14, 1, { sz: 1.4 }).pop(); g.color(0x2a2420); for (const [x, z] of [[-0.14, -0.26], [0.14, -0.26], [-0.14, 0.26], [0.14, 0.26]]) g.box(x, 0.2, z, 0.07, 0.4, 0.07); return g.build(); })();
  const sheepIM = new THREE.InstancedMesh(sheepG, MAT.flat, 8); sheepIM.count = 0; sheepIM.castShadow = true; scene.add(sheepIM);
  const postG = (() => { const g = new GB(4213); g.jit = 0.02; g.color(0x8a6a44).box(0, 0.6, 0, 0.08, 1.2, 0.08); g.color(0x5fd38a).box(0.18, 1.05, 0, 0.32, 0.2, 0.02); return g.build(); })();
  const postIM = new THREE.InstancedMesh(postG, MAT.flat, 10); postIM.count = 0; scene.add(postIM);
  const PR = 14, PEN_R = 5.2;
  D.reg({ id: 'qoy', ic: '🐑', name: "Qo'y boqish", cat: 'foot', place: 'tegirmon', mins: 5, xp: 13, pay: "550–1 100 so'm", need: 'piyoda yoki transportda — qo\'ylar sizdan qochadi',
    desc: "Ergash boboning podasini qo'rada chiqarib, yaylovga (yashil bayroqchalar) haydaysiz, o'tlatib, yana qo'raga qaytarasiz. Qo'ylar sizdan qochadi — ortidan yurib yo'naltiring.",
    rules: () => "Qo'ylar 8 m yaqinlashsangiz qochadi (transportda — 13 m). Hammasi yaylov doirasida bo'lsa, 25 soniya o'tlaydi (doiradan chiqqani vaqtni to'xtatadi). Keyin qo'raga qaytaring. Har qo'y 90 so'm, bonus 200 + qolgan vaqt.",
    start(J) { if (!pen) return false; let pas = null; for (let k = 0; k < 60 && !pas; k++) { const a = Math.random() * 6.283, d = 85 + Math.random() * 60, x = pen.x + Math.cos(a) * d, z = pen.z + Math.sin(a) * d, si = T.siteInfo(x, z); if (si.y < si.water + 1.5 || si.slope > 0.22 || si.roadD < 6) continue; let ok = 1; for (let s = 0; s < 6; s++) { const xx = pen.x + (x - pen.x) * s / 6, zz = pen.z + (z - pen.z) * s / 6, q = T.siteInfo(xx, zz); if (q.y < q.water + 0.8 || q.slope > 0.45) ok = 0; } if (ok) pas = { x, z }; }
      if (!pas) return false; const n = J.lvl >= 2 ? 8 : 6, sh = []; for (let i = 0; i < n; i++) { const a = (i / n) * 6.283; sh.push({ x: pen.x + Math.cos(a) * 2.4, z: pen.z + Math.sin(a) * 2.4, vx: 0, vz: 0, yaw: a, ph: i, w: Math.random() * 6 }); }
      Object.assign(J, { sh, pas, stage: 'out', graze: 25, intro: `${n} ta qo'y — yaylovga (${Math.round(Math.hypot(pas.x - pen.x, pas.z - pen.z))} m) haydang, o'tlating va qaytaring` }); J.t = 330; D.marks([Object.assign({ c: 0x5fd38a }, pas)]); this.posts(J); },
    posts(J) { let n = 0; if (J) for (let i = 0; i < 10; i++) { const a = (i / 10) * 6.283, x = J.pas.x + Math.cos(a) * PR, z = J.pas.z + Math.sin(a) * PR; dm.position.set(x, gy(x, z), z); dm.rotation.set(0, -a, 0); dm.scale.setScalar(1); dm.updateMatrix(); postIM.setMatrixAt(n++, dm.matrix); } postIM.count = n; postIM.instanceMatrix.needsUpdate = true; },
    inside: (s, c, r) => Math.hypot(s.x - c.x, s.z - c.z) < r,
    tick(J, dt, foot) { const p = me(), fr = foot ? 8 : 13, t = game.time; let cx = 0, cz = 0; for (const s of J.sh) { cx += s.x; cz += s.z; } cx /= J.sh.length; cz /= J.sh.length;
      for (const s of J.sh) { let ax = 0, az = 0; const dx = s.x - p[0], dz = s.z - p[2], d = Math.hypot(dx, dz); if (d < fr && d > 0.01) { const k = (fr - d) / fr * (foot ? 14 : 18); ax += dx / d * k; az += dz / d * k; if (d < 2.5 && (s.baa || 0) < t) { s.baa = t + 3; sfx('baa'); } }
        const cd = Math.hypot(cx - s.x, cz - s.z); if (cd > 2.5) { ax += (cx - s.x) / cd * 1.2; az += (cz - s.z) / cd * 1.2; } for (const o of J.sh) { if (o === s) continue; const ox = s.x - o.x, oz = s.z - o.z, od = Math.hypot(ox, oz); if (od < 1.3 && od > 0.01) { ax += ox / od * 4; az += oz / od * 4; } }
        s.w += dt * 0.7; ax += Math.sin(s.w) * 0.5; az += Math.cos(s.w * 1.3) * 0.5;
        s.vx = (s.vx + ax * dt) * Math.max(0, 1 - dt * 2.2); s.vz = (s.vz + az * dt) * Math.max(0, 1 - dt * 2.2); const v = Math.hypot(s.vx, s.vz), mx = 4.3; if (v > mx) { s.vx *= mx / v; s.vz *= mx / v; }
        const nx = s.x + s.vx * dt, nz = s.z + s.vz * dt, si = T.siteInfo(nx, nz); if (si.y > si.water + 0.5 && si.slope < 0.6) { s.x = nx; s.z = nz; } else { s.vx *= -0.5; s.vz *= -0.5; } if (v > 0.15) s.yaw += angDiff(Math.atan2(s.vx, s.vz), s.yaw) * Math.min(1, dt * 6); s.ph += dt * (2 + v * 3) * Math.min(1, v * 2); }
      this.draw(J);
      const inP = J.sh.filter((s) => this.inside(s, J.pas, PR)).length, inH = J.sh.filter((s) => this.inside(s, pen, PEN_R)).length; J.inP = inP; J.inH = inH;
      if (J.stage === 'out' && inP === J.sh.length) { J.stage = 'graze'; sfx('check'); toast("🌿 Hamma qo'y yaylovda — o'tlamoqda. Doiradan chiqarmang!", 'good'); }
      if (J.stage === 'graze') { if (inP === J.sh.length) J.graze -= dt; if (J.graze <= 0) { J.stage = 'home'; J.done = J.sh.length; sfx('baa'); toast("🐑 To'yishdi! Endi qo'raga qaytaring", 'gold'); D.marks([Object.assign({ c: 0xffd23a }, pen)]); this.posts(null); } }
      if (J.stage === 'home' && inH === J.sh.length) { D.pay('qoy', 90 * J.sh.length, `${J.sh.length} qo'y`); D.pay('qoy', 200 + Math.max(0, J.t) * 1.2, 'pada qo\'rada'); D.finish(true, `Ergash bobo: «Barakalla, cho'pon bo'libsan!» · ${som(J.earn)} so'm`); }
      if (!game.way || game.way.auto) { const tg = J.stage === 'home' ? pen : J.pas; if (!game.way || Math.hypot(game.way.x - tg.x, game.way.z - tg.z) > 3) game.setWaypoint(tg.x, tg.z, true); } },
    draw(J) { let n = 0; if (J) for (const s of J.sh) { const v = Math.hypot(s.vx, s.vz); dm.position.set(s.x, gy(s.x, s.z) + Math.abs(Math.sin(s.ph)) * Math.min(0.08, v * 0.03), s.z); dm.rotation.set(0, s.yaw, 0); dm.scale.setScalar(1); dm.updateMatrix(); sheepIM.setMatrixAt(n++, dm.matrix); } sheepIM.count = n; sheepIM.instanceMatrix.needsUpdate = true; },
    timeout(J) { const n = J.inH || 0; if (n) D.pay('qoy', 40 * n, `${n} qo'y qaytdi`); D.finish(n > 0, `Vaqt tugadi. Ergash bobo qolganlarini o'zi yig'ib oladi · ${som(J.earn)} so'm`); },
    line: (J) => (J.stage === 'out' ? `Yaylovga haydang: ${J.inP || 0}/${J.sh.length} doirada` : J.stage === 'graze' ? `O'tlamoqda: ${Math.ceil(J.graze)} s${J.inP < J.sh.length ? ` · ⚠ ${J.sh.length - J.inP} ta chiqib ketdi` : ''}` : `Qo'raga qaytaring: ${J.inH || 0}/${J.sh.length}`),
    end(J) { this.draw(null); this.posts(null); } });

  // ================= 3. QURUVCHI =================
  const bg = giverAt('quruvchi', 'kol', 3.3, 'Brigadir Jasur', { shirt: 0x3d74a6, pants: 0x3a3f4c, vest: 0xffd23a, hair: 0x2a1d16 }, 10, 55);
  const brickG = (() => { const g = new GB(4221); g.jit = 0.01; g.color(0xb8542e).box(0, 0.11, 0, 0.5, 0.22, 0.24); g.color(0xd8d2c6).box(0, 0.225, 0, 0.5, 0.01, 0.24); return g.build(); })();
  const brickIM = new THREE.InstancedMesh(brickG, MAT.flat, 40); brickIM.count = 0; brickIM.castShadow = true; brickIM.receiveShadow = true; scene.add(brickIM);
  const ghost = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0x9fd8ff, transparent: true, opacity: 0.22, depthWrite: false })); ghost.visible = false; scene.add(ghost);
  const carryB = (() => { const g = new GB(4222); g.jit = 0.01; for (let i = 0; i < 3; i++) g.color(0xb8542e).box(0, i * 0.12, 0, 0.42, 0.11, 0.2); const m = mesh(g); m.position.set(0, -0.05, 0.28); return m; })();
  const COLS = 6, ROWS = 3;
  let site = null; if (bg) { site = D.spotNear(bg.x, bg.z, 14, 50, (x, z, si) => si.slope < 0.12 && si.roadD > 4, 1.9, 4.5); if (site) { site.yaw = D.roadYaw(site.x, site.z); const c = Math.cos(site.yaw), s = Math.sin(site.yaw); site.W = (lx, lz) => [site.x + lx * c + lz * s, site.z - lx * s + lz * c]; const [px, pz] = site.W(0, 14); site.pal = { x: px, z: pz, y: gy(px, pz) };
    const g = new GB(4223); g.jit = 0.02; g.translate(px, site.pal.y, pz).rotY(site.yaw); g.color(0x8a6a44).box(0, 0.06, 0, 1.2, 0.12, 1.0); for (let i = 0; i < 12; i++) g.color(0xb8542e).box(-0.36 + (i % 3) * 0.36, 0.2 + Math.floor(i / 6) * 0.13, -0.25 + (Math.floor(i / 3) % 2) * 0.5, 0.34, 0.12, 0.45); scene.add(mesh(g)); COL.addCircle(px, pz, 0.6, site.pal.y - 1, site.pal.y + 0.6);
    const fg = new GB(4224); fg.jit = 0.02; const [fx2, fz2] = site.W(0, 0); fg.translate(fx2, gy(fx2, fz2), fz2).rotY(site.yaw); fg.color(0x9a9aa0).box(0, 0.05, 0, COLS * 0.52 + 0.4, 0.1, 0.5); scene.add(mesh(fg)); } }
  const slot = (k) => { const r = Math.floor(k / COLS), c = k % COLS, [x, z] = site.W((c - (COLS - 1) / 2) * 0.52 + (r % 2 ? 0.13 : 0), 0); return { x, z, y: gy(site.x, site.z) + 0.1 + r * 0.23 }; };
  const drawWall = (n) => { for (let k = 0; k < n; k++) { const q = slot(k); dm.position.set(q.x, q.y, q.z); dm.rotation.set(0, site.yaw, 0); dm.scale.setScalar(1); dm.updateMatrix(); brickIM.setMatrixAt(k, dm.matrix); } brickIM.count = n; brickIM.instanceMatrix.needsUpdate = true; };
  D.reg({ id: 'quruvchi', ic: '🧱', name: 'Quruvchi', cat: 'foot', place: 'kol', mins: 3, xp: 11, pay: "600–1 000 so'm", need: 'piyoda',
    desc: "Ko'l bo'yidagi dala hovliga g'isht devor terish: taxlamdan uchtadan g'isht olib, devor o'rniga birma-bir terasiz. Me'yordan tez tursangiz — bonus.",
    rules: () => `Taxlam yonida <kbd>E</kbd> — 3 ta g'isht, devor oldida <kbd>E</kbd> — bitta g'isht teriladi. ${COLS * ROWS} ta g'isht · har biri 40 so'm, tugatganda bonus 200, 2 daqiqadan tez — yana +120.`,
    start(J) { if (!site) return false; Object.assign(J, { n: 0, hand: 0, total: COLS * ROWS, intro: `${COLS * ROWS} g'ishtli devor — taxlamdan oling, devorga tering` }); J.t = 240; drawWall(0); ghost.visible = true; const [x, z] = site.W(0, 0); ghost.position.set(x, gy(site.x, site.z) + 0.1 + ROWS * 0.115, z); ghost.rotation.y = site.yaw; ghost.scale.set(COLS * 0.52 + 0.1, ROWS * 0.23, 0.26); this.mk(J); },
    mk(J) { const [x, z] = site.W(0, 0); D.marks([J.hand ? { x, z } : site.pal]); },
    extra(J, offer, px, pz) { if (!J.hand && Math.hypot(site.pal.x - px, site.pal.z - pz) < 2.2) offer(-0.2, "<kbd>E</kbd> 3 ta g'isht olish 🧱", () => pl.act('bend', 0.6, () => { J.hand = Math.min(3, J.total - J.n); sfx('pick'); this.mk(J); }));
      if (J.hand && J.n < J.total) { const q = slot(J.n); if (Math.hypot(q.x - px, q.z - pz) < 2.6) offer(-0.2, `<kbd>E</kbd> G'isht terish (${J.n + 1}/${J.total})`, () => { pl.yaw = Math.atan2(q.x - pl.p[0], q.z - pl.p[2]); pl.act('bend', 0.55, () => { J.n++; J.hand--; J.done = J.n; drawWall(J.n); sfx('hit', 0.25); fx().burst(4, q.x, q.y + 0.1, q.z, 0.8, 0.4, 0.12, 0xd8d2c6, 0.8, 0.6, 4, 0.1); D.pay('quruvchi', 40, `g'isht ${J.n}/${J.total}`);
        if (J.n >= J.total) { ghost.visible = false; D.pay('quruvchi', 200 + (J.el < 120 ? 120 : 0), J.el < 120 ? 'tez va pishiq!' : 'devor tayyor'); return D.finish(true, `Jasur aka: «Devor tekis — usta ekansiz!» · ${som(J.earn)} so'm`); } this.mk(J); }); }); } },
    tick(J, dt, foot) { if (J.hand && foot) { if (carryB.parent !== pl.rig.chest) pl.rig.chest.add(carryB); } else if (carryB.parent) carryB.parent.remove(carryB); },
    line: (J) => (J.hand ? `G'ishtni devorga tering · qo'lda ${J.hand} · ${J.n}/${J.total}` : `Taxlamdan g'isht oling · terildi ${J.n}/${J.total}`),
    end(J) { ghost.visible = false; if (carryB.parent) carryB.parent.remove(carryB); } });

  // ================= 4. FOTOGRAF =================
  const fg = giverAt('foto', 'mayoq', 4.6, 'Gazeta muharriri Dilnoza', { shirt: 0x8a54c8, pants: 0x2a2c33, long: true, hair: 0x1d1612 }, 8, 50);
  const flashEl = document.createElement('div'); flashEl.style.cssText = 'position:absolute;inset:0;background:#fff;opacity:0;pointer-events:none;transition:opacity .45s;z-index:30';
  const cdir = new THREE.Vector3();
  const subjPos = (s) => { if (s[2] === 'qoy') { const sh = L._dbg.sheep, q = me(); let b = null, bd = 1e9; for (const o of sh) { const d = Math.hypot(o.x - q[0], o.z - q[2]); if (d < bd) { bd = d; b = o; } } return b ? { x: b.x, z: b.z, y: gy(b.x, b.z) + 0.6 } : null; } const p = T.placeBy[s[2]]; return p ? { x: p.x, z: p.z, y: gy(p.x, p.z) + (s[2] === 'mayoq' ? 12 : 4) } : null; };
  const frameQ = (s) => { if (!pl.onFoot) return null; const p = subjPos(s); if (!p) return null; const cp = game.camera.position, d = Math.hypot(p.x - cp.x, p.z - cp.z); if (d < s[3] || d > s[4]) return { far: d > s[4], d };
    game.camera.getWorldDirection(cdir); const vx = p.x - cp.x, vy = p.y - cp.y, vz = p.z - cp.z, vl = Math.hypot(vx, vy, vz), ang = Math.acos(clamp((cdir.x * vx + cdir.y * vy + cdir.z * vz) / vl, -1, 1)) * 57.3; if (ang > 22) return { ang, d };
    const h = game.hour, gold = (h > 6 && h < 8.5) || (h > 17.5 && h < 19.8), mid = (s[3] + s[4]) / 2, dq = 1 - Math.min(1, Math.abs(d - mid) / (s[4] - s[3]) * 1.4), q = clamp((1 - ang / 22) * 0.6 + dq * 0.4 + (gold ? 0.15 : 0), 0.15, 1); return { q, d, ang, gold }; };
  D.reg({ id: 'foto', ic: '📷', name: 'Fotograf', cat: 'foot', place: 'mayoq', mins: 8, xp: 14, pay: "900–1 700 so'm", need: 'piyoda; kamerani manzilga qarating',
    desc: "Gazeta uchun orolning 3 ta joyini suratga olasiz. Suratni piyoda, manzilga qarab turib olasiz: kadr qanchalik markazda va masofa qanchalik to'g'ri bo'lsa, shuncha qimmat. Tong va shom nuri — +15 %.",
    rules: () => "Buyurtmadagi joyga boring (transportda bo'lsa ham), tushib, kamerani o'sha tomonga burang — pastda «📷 Suratga olish · kadr N %» chiqadi, <kbd>E</kbd>. Har surat 200–500 so'm, uchala surat — bonus 300.",
    start(J) { if (!fg) return false; const n = J.lvl >= 2 ? 4 : 3, pool = shuffle(SUBJ.filter((s) => s[2] === 'qoy' || (T.placeBy[s[2]] && Math.hypot(T.placeBy[s[2]].x - fg.x, T.placeBy[s[2]].z - fg.z) > 300))).slice(0, n);
      Object.assign(J, { list: pool.map((s) => ({ s, ok: 0 })), intro: `Buyurtma: ${pool.map((s) => s[1]).join(', ')}` }); this.mk(J); },
    mk(J) { D.marks(J.list.filter((q) => !q.ok).map((q) => subjPos(q.s)).filter(Boolean).map((p) => ({ x: p.x, z: p.z, c: 0xc89aff }))); },
    always(offer) { const J = D.cur; if (!J || J.id !== 'foto') return; for (const q of J.list) { if (q.ok) continue; const f = frameQ(q.s); if (f && f.q) { offer(-0.5, `<kbd>E</kbd> 📷 Suratga olish: ${q.s[1]} · kadr ${Math.round(f.q * 100)} %${f.gold ? ' ☀' : ''}`, () => D.defs.foto.shoot(J, q, f)); return; } } },
    shoot(J, q, f) { q.ok = 1; J.done++; if (!flashEl.parentNode && game.ui) game.ui.hud.appendChild(flashEl); flashEl.style.transition = 'none'; flashEl.style.opacity = '0.85'; void flashEl.offsetWidth; flashEl.style.transition = 'opacity .5s'; flashEl.style.opacity = '0'; sfx('click'); st.daromad.photo.n++;
      D.pay('foto', 200 + 300 * f.q, `${q.s[1]} (${Math.round(f.q * 100)} %)`); this.mk(J); if (J.list.every((r) => r.ok)) { D.pay('foto', 300, "gazeta soni tayyor"); D.finish(true, `Dilnoza: «Suratlaringiz birinchi sahifada chiqadi!» · ${som(J.earn)} so'm`); } },
    tick(J) { const q = J.list.find((r) => !r.ok); if (q && (!game.way || game.way.auto)) { const p = subjPos(q.s); if (p && D.dist(p) > 40 && (!game.way || Math.hypot(game.way.x - p.x, game.way.z - p.z) > 20)) game.setWaypoint(p.x, p.z, true); } },
    line: (J) => { const q = J.list.find((r) => !r.ok); if (!q) return ''; const f = frameQ(q.s); return `Surat ${J.done}/${J.list.length}: ${q.s[1]}${f ? f.q ? ` · kadr ${Math.round(f.q * 100)} %` : f.ang ? ' · kamerani buring' : f.far ? ` · yaqinroq (${Math.round(f.d)} m)` : ' · uzoqroq turing' : pl.onFoot ? '' : ' · piyoda tushing'}`; } });
  D.dbg3 = { pen, site, slot, frameQ, subjPos, SUBJ };
}
