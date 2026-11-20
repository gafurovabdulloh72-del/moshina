// Qazilma maydoni: Karvonsaroy yonidagi qum ostidagi qadimiy shahar — asbob ijarasi, 25 katak (belkurak bilan qazish → cho'tka bilan ehtiyotlab tozalash mini-o'yini), topilmalar to'plami, muzey javoni va asta ochiladigan devorlar
import * as THREE from 'three';
import * as T from './terrain.js';
import * as COL from './colliders.js';
import { GB, MAT } from './geo.js';
import { makeRig, poseRig, setHat, setTool } from './rig.js';
import { hash2 } from './util.js';

const som = (n) => Math.round(n).toLocaleString('ru-RU');
// topilmalar: id, nom, belgi, qiymat (so'm), rang, kamyoblik (og'irlik)
export const FINDS = [
  ['sopol', 'Sopol parcha', '🏺', 20, 0xc0703a, 6], ['mis', 'Mis tanga', '🪙', 35, 0xc8803a, 5], ['koshin', 'Koshin parchasi', '🟦', 45, 0x2a7ad0, 4], ['munchoq', 'Munchoq shodasi', '📿', 40, 0xd84a6a, 4],
  ['chiroq', 'Moy chiroq', '🪔', 60, 0xb88a4a, 3], ['muhr', 'Tosh muhr', '🔏', 80, 0x8a8a90, 2], ['kumush', 'Kumush tanga', '🥈', 90, 0xd8d8e0, 2], ['haykal', 'Sopol haykalcha', '🗿', 140, 0xb06a3a, 1],
];
export const FIND_BY = Object.fromEntries(FINDS.map((f, i) => [f[0], i]));
export const DIG_DAY = 4, RENT = 30, GRID = 5, CS = 4; // kuniga katak, ijara (so'm/kun), 5×5 katak, katak o'lchami (m)
// birinchi qatlamning topilmalari (25 katak — har 8 turdan kamida bittasi)
const LAYER0 = [0, 1, 0, 3, 2, 1, 4, 0, 2, 5, 0, 3, 7, 1, 0, 2, 6, 0, 1, 4, 3, 0, 5, 1, 2];
export const findOf = (layer, i) => { if (!layer) return LAYER0[i]; const tot = FINDS.reduce((s, f, k) => s + f[5] + (k > 3 ? layer : 0), 0); let r = hash2(i, layer, 77) * tot; for (let k = 0; k < FINDS.length; k++) { r -= FINDS[k][5] + (k > 3 ? layer : 0); if (r <= 0) return k; } return 0; };
// shahar tarhi: devorlar katak qirralarida [qator, ustun, qirra: 0 — shimol (−z), 1 — sharq (+x), 2 — janub (+z), 3 — g'arb (−x)]
const WALLS = (() => { const w = []; for (let i = 0; i < GRID; i++) { if (i !== 2) w.push([0, i, 0]); w.push([GRID - 1, i, 2]); w.push([i, 0, 3]); if (i !== 3) w.push([i, GRID - 1, 1]); }
  for (const r of [0, 1, 2]) w.push([r, 1, 1]); for (const c of [0, 1, 3]) w.push([2, c, 2]); for (const r of [3, 4]) w.push([r, 2, 1]); w.push([1, 3, 2]); return w; })();

export function initQazilma(game) {
  const { scene } = game, st = game.state, pl = game.player, L = game.live, ui = game.ui;
  const S = st.sir, toast = (m, k) => game.toast(m, k), sfx = (n) => game.audio.sfx(n);
  const D = (S.dig = Object.assign({ cells: [], layer: 0, day: -1, n: 0, rent: -999 }, S.dig || {}));
  if (!Array.isArray(D.cells) || D.cells.length !== GRID * GRID) D.cells = new Array(GRID * GRID).fill(0);
  S.finds = S.finds || {}; S.museum = S.museum || {};
  const Q = (game.qazilma = { brush: null, FINDS, findOf });
  const gy = (x, z) => T.ground(x, z, 1e9).y;

  // ================= JOY: Karvonsaroy yonida, tekis qumloq, atrofi bo'sh =================
  const CAND = [[-1760, -705], [-2212, -608], [-1642, -751], [-2160, -905], [-1768, -651], [-1989, -639], [-2340, -901], [-2233, -661]];
  const clear = (x, z) => !COL.query(x, z, 27).some((o) => !o.dead && Math.hypot(o.x - x, o.z - z) < 27 + (o.r || 1));
  const [cx, cz] = CAND.find(([x, z]) => clear(x, z)) || CAND[0];
  const C = (Q.site = { x: cx, z: cz, y: gy(cx, cz) });
  const cellXZ = (i) => [cx + ((i % GRID) - 2) * CS, cz + (Math.floor(i / GRID) - 2) * CS];
  Q.cellXZ = cellXZ;
  Q.cellAt = (x, z) => { const c = Math.round((x - cx) / CS) + 2, r = Math.round((z - cz) / CS) + 2; return c >= 0 && c < GRID && r >= 0 && r < GRID ? r * GRID + c : -1; };
  const camp = (Q.camp = { x: cx + 15, z: cz - 3 }), mus = (Q.museum = { x: cx + 15, z: cz + 8 });

  // ================= MODELLAR =================
  const mk = (g, mat = MAT.flat) => { const m = new THREE.Mesh(g.build(), mat); m.castShadow = true; m.receiveShadow = true; scene.add(m); return m; };
  const inst = (g, n) => { const im = new THREE.InstancedMesh(g.build(), MAT.flat, n); im.castShadow = true; im.receiveShadow = true; im.frustumCulled = false; scene.add(im); return im; };
  // qum uyumi (qazilmagan katak), chuqur tubi, devor bo'lagi, chuqurdagi topilma
  const moundIM = inst((() => { const g = new GB(9101); g.jit = 0.04; g.color(0xd9b97c).box(0, 0.12, 0, CS * 0.94, 0.24, CS * 0.94, { tx: 0.92, tz: 0.92 }).blob(1.1, 1, { cy: 0.2, sx: 1.35, sy: 0.28, sz: 1.35, jitter: 0.12 }); return g; })(), GRID * GRID);
  const pitIM = inst((() => { const g = new GB(9102); g.jit = 0.02; g.color(0x9a7646).box(0, 0.02, 0, CS * 0.9, 0.06, CS * 0.9); g.color(0xcfae74).box(0, 0.08, -CS * 0.46, CS * 0.98, 0.18, 0.16, { tz: 0.5 }).box(0, 0.08, CS * 0.46, CS * 0.98, 0.18, 0.16, { tz: 0.5 }).box(-CS * 0.46, 0.08, 0, 0.16, 0.18, CS * 0.98, { tx: 0.5 }).box(CS * 0.46, 0.08, 0, 0.16, 0.18, CS * 0.98, { tx: 0.5 }); return g; })(), GRID * GRID);
  const wallIM = inst((() => { const g = new GB(9103); g.jit = 0.05; g.color(0xb8865a).box(0, 0.5, 0, CS + 0.4, 1.0, 0.55, { tx: 0.98, tz: 0.8 }); g.color(0xa07048); for (let k = 0; k < 4; k++) g.box(-1.5 + k, 1.02, 0, 0.7 - (k % 2) * 0.25, 0.08, 0.5); return g; })(), WALLS.length);
  const findIM = inst((() => { const g = new GB(9104); g.jit = 0.03; g.color(0xc0703a).blob(0.22, 1, { sy: 0.45, jitter: 0.2 }); g.color(0xe8d0a0).box(0.05, 0.08, 0, 0.12, 0.03, 0.2); return g; })(), GRID * GRID);
  const dmy = new THREE.Object3D(), floorY = (i) => { const [x, z] = cellXZ(i); return gy(x, z) + 0.03; };
  const setI = (im, i, x, y, z, ry, s) => { dmy.position.set(x, y, z); dmy.rotation.set(0, ry, 0); dmy.scale.setScalar(s); dmy.updateMatrix(); im.setMatrixAt(i, dmy.matrix); };
  // to'siq ustunlari va arqon (maydon chegarasi), lager chodiri, stol, muzey javoni
  { const g = new GB(9105); g.jit = 0.02; const H = GRID * CS / 2 + 1;
    for (let k = -H; k <= H + 0.01; k += 4) for (const [x, z] of [[k, -H], [k, H], [-H, k], [H, k]]) { const px = cx + x, pz = cz + z; g.push().translate(px, gy(px, pz), pz).color(0x8a6a44).box(0, 0.5, 0, 0.09, 1.0, 0.09).color(0xff6a3a).box(0, 0.9, 0, 0.11, 0.1, 0.11).pop(); }
    for (const [x0, z0, x1, z1] of [[-H, -H, H, -H], [-H, H, H, H], [-H, -H, -H, H], [H, -H, H, H]]) { const n = Math.round(Math.hypot(x1 - x0, z1 - z0) / 4); for (let k = 0; k < n; k++) { const ax = cx + x0 + (x1 - x0) * k / n, az = cz + z0 + (z1 - z0) * k / n, bx = cx + x0 + (x1 - x0) * (k + 1) / n, bz = cz + z0 + (z1 - z0) * (k + 1) / n, mx = (ax + bx) / 2, mz = (az + bz) / 2;
      g.push().translate(mx, (gy(ax, az) + gy(bx, bz)) / 2 + 0.82, mz).rotY(Math.atan2(bx - ax, bz - az)).color(0xf0e0b0).box(0, 0, 0, 0.03, 0.03, Math.hypot(bx - ax, bz - az)).pop(); } }
    // lager: soyabon chodir, stol, qutilar, belkurak va cho'tkalar
    const ty = gy(camp.x, camp.z); g.push().translate(camp.x, ty, camp.z);
    g.color(0x6e4a30); for (const [x, z] of [[-2, -1.6], [2, -1.6], [-2, 1.6], [2, 1.6]]) g.box(x, 1.25, z, 0.1, 2.5, 0.1);
    g.color(0xe8dcc0).box(0, 2.55, 0, 4.6, 0.08, 3.8, { tx: 0.92, tz: 0.9 }); g.color(0xd8392b).box(0, 2.45, 1.92, 4.6, 0.22, 0.05).box(0, 2.45, -1.92, 4.6, 0.22, 0.05);
    g.color(0x8a5a36).box(0, 0.78, -0.4, 2.2, 0.08, 1.0); for (const x of [-1, 1]) for (const z of [-0.8, 0]) g.box(x, 0.38, z, 0.07, 0.76, 0.07);
    g.color(0xe8e2d0).box(-0.5, 0.84, -0.4, 0.6, 0.02, 0.42); g.color(0xc0703a).blob(0.1, 1, { cx: 0.4, cy: 0.88, cz: -0.3, sy: 0.5 }); g.color(0x2a7ad0).box(0.7, 0.84, -0.6, 0.16, 0.03, 0.16);
    g.color(0xa07a4a).box(1.6, 0.3, 1.0, 0.8, 0.6, 0.6).box(1.5, 0.82, 1.0, 0.6, 0.45, 0.5); g.color(0x9a6a42); for (let k = 0; k < 3; k++) g.push().translate(-1.7 + k * 0.25, 0.7, 1.4).rotX(0.12).box(0, 0, 0, 0.05, 1.4, 0.05).pop(); g.color(0xb9bec8); for (let k = 0; k < 3; k++) g.box(-1.7 + k * 0.25, 0.05, 1.32, 0.2, 0.3, 0.03);
    g.pop(); COL.addBox(camp.x, camp.z - 0.4, 1.15, 0.55, 0, ty - 1, ty + 0.9);
    // muzey javoni: tomli yog'och rasta, 2 tokcha × 4 joy
    const my = gy(mus.x, mus.z); g.push().translate(mus.x, my, mus.z).rotY(-Math.PI / 2);
    g.color(0xd8c8a0).box(0, 0.08, 0, 5.2, 0.16, 2.2); g.color(0x7a5232); for (const x of [-2.4, 2.4]) for (const z of [-0.9, 0.9]) g.box(x, 1.5, z, 0.14, 2.9, 0.14);
    g.color(0x8a5a36).box(0, 0.75, -0.5, 4.6, 0.08, 0.8).box(0, 1.55, -0.5, 4.6, 0.08, 0.8).box(0, 1.15, -0.88, 4.6, 1.6, 0.06); for (let k = 0; k < 5; k++) g.box(-2.2 + k * 1.1, 1.15, -0.5, 0.06, 0.8, 0.78);
    g.color(0x2f6fb0).box(0, 3.0, 0, 5.6, 0.12, 2.6, { tx: 0.9, tz: 0.85 }); g.color(0xf0c040).box(0, 2.85, 1.3, 5.6, 0.18, 0.06);
    g.pop(); COL.addBox(mus.x + 0.5, mus.z, 0.55, 2.4, 0, my - 1, my + 1.8);
    mk(g); }
  // muzey yozuvi (CanvasTexture)
  { const cv = document.createElement('canvas'); cv.width = 512; cv.height = 96; const c = cv.getContext('2d'); c.fillStyle = '#f6efd8'; c.fillRect(0, 0, 512, 96); c.fillStyle = '#7a3a1a'; c.font = '800 44px system-ui,sans-serif'; c.textAlign = 'center'; c.fillText('QADIMIY SHAHAR MUZEYI', 256, 64);
    const tx = new THREE.CanvasTexture(cv); tx.colorSpace = THREE.SRGBColorSpace; const m = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 0.78), new THREE.MeshBasicMaterial({ map: tx, color: 0xbbbbbb }));
    m.position.set(mus.x - 1.28, gy(mus.x, mus.z) + 2.5, mus.z); m.rotation.y = -Math.PI / 2; scene.add(m); }
  // javondagi topilmalar (8 ta alohida kichik model: topshirilganda ko'rinadi)
  const FIND_G = {
    sopol: (g) => { g.color(0xc0703a).cyl(10, 0.1, 0.16, 0, 0.22).cyl(10, 0.16, 0.07, 0.22, 0.36).cyl(10, 0.07, 0.09, 0.36, 0.42); },
    mis: (g) => { g.color(0xc8803a); g.push().rotX(1.2).cyl(14, 0.11, 0.11, -0.012, 0.012, { cap: true }).pop(); g.color(0x8a4a20).box(0, 0.06, 0.03, 0.04, 0.04, 0.02); },
    koshin: (g) => { g.color(0x2a7ad0).box(0, 0.14, 0, 0.3, 0.28, 0.03); g.color(0xf0f0e0).box(0, 0.14, 0.017, 0.16, 0.04, 0.005).box(0, 0.14, 0.017, 0.04, 0.16, 0.005); g.color(0x3ab0c0).box(0, 0.14, 0.018, 0.06, 0.06, 0.005); },
    munchoq: (g) => { for (let k = 0; k < 9; k++) { const a = k / 9 * 6.283; g.color([0xd84a6a, 0x3ab0c0, 0xf0c040][k % 3]).blob(0.035, 0, { cx: Math.cos(a) * 0.13, cz: Math.sin(a) * 0.08, cy: 0.04 }); } },
    chiroq: (g) => { g.color(0xb88a4a).blob(0.12, 1, { sy: 0.45, sz: 0.8, cy: 0.06 }); g.box(0, 0.06, 0.15, 0.06, 0.05, 0.12); g.box(0, 0.12, -0.12, 0.04, 0.1, 0.04); },
    muhr: (g) => { g.color(0x8a8a90).cyl(6, 0.1, 0.09, 0, 0.12, { cap: true }); g.color(0x6a6a70).blob(0.06, 0, { cy: 0.16 }); },
    kumush: (g) => { g.color(0xd8d8e0); for (let k = 0; k < 3; k++) g.push().translate(k * 0.07 - 0.07, 0.02 + k * 0.01, 0).rotX(1.45).cyl(14, 0.08, 0.08, -0.01, 0.01, { cap: true }).pop(); },
    haykal: (g) => { g.color(0xb06a3a).cyl(8, 0.08, 0.06, 0, 0.2, { cap: true }).blob(0.06, 0, { cy: 0.26 }); g.box(0, 0.15, 0, 0.22, 0.04, 0.04); },
  };
  const shelf = FINDS.map((f, k) => { const g = new GB(9110 + k); g.jit = 0.01; FIND_G[f[0]](g); const m = mk(g); const row = k < 4 ? 0 : 1, col = k % 4; // tokchalar mahalliy koordinatada (javon −90° burilgan)
    const lx = -1.65 + col * 1.1, ly = row ? 1.6 : 0.8, my = gy(mus.x, mus.z); m.position.set(mus.x + 0.45, my + ly, mus.z + lx); m.rotation.y = -Math.PI / 2; m.scale.setScalar(1.6); m.visible = !!S.museum[f[0]]; return m; });
  // ochilgach paydo bo'ladigan qismlar: ustunlar (8 katak) va koshinli darvoza (to'liq qatlam)
  const cols = (() => { const g = new GB(9120); g.jit = 0.03; for (const [i, s] of [[6, 1], [8, -1]]) { const [x, z] = cellXZ(i), y = floorY(i); g.push().translate(x + s * 0.6, y, z + 0.6).color(0xc8a070).cyl(10, 0.42, 0.42, 0, 0.3, { cap: true }).color(0xd8b888).cyl(10, 0.3, 0.27, 0.3, 1.5, { cap: true }).pop(); } const m = mk(g); m.visible = false; return m; })();
  const gate = (() => { const g = new GB(9121); g.jit = 0.03; const [x, z] = cellXZ(2), y = floorY(2); g.push().translate(x, y, z - CS / 2);
    g.color(0xb8865a); for (const s of [-1, 1]) g.box(s * 1.35, 1.2, 0, 0.7, 2.4, 0.7); g.color(0x2a7ad0).box(0, 2.6, 0, 3.4, 0.5, 0.75); g.color(0x3ab0c0); for (let k = 0; k < 5; k++) g.box(-1.2 + k * 0.6, 2.6, 0.38, 0.32, 0.32, 0.02); g.color(0xf0c040).box(0, 2.95, 0, 3.6, 0.12, 0.8); g.pop();
    const m = mk(g); m.visible = false; return m; })();
  // arxeolog Nodira opa
  const arx = makeRig({ shirt: 0xe8d8b0, pants: 0x6a5a40, seed: 9130, long: true, vest: 0x8a6a3a }); setHat(arx, 'panama'); arx.root.position.set(camp.x - 0.4, gy(camp.x, camp.z + 0.6), camp.z + 0.6); arx.root.rotation.y = Math.PI * 0.75; scene.add(arx.root);
  Q.arx = arx;

  // ================= HOLAT VA CHIZISH =================
  const doneN = () => D.cells.filter((c) => c === 2).length;
  Q.doneN = doneN;
  const shown = (wi) => { const w = WALLS[wi], i = w[0] * GRID + w[1]; return D.layer > 0 || D.cells[i] === 2; };
  const draw = () => {
    for (let i = 0; i < GRID * GRID; i++) { const [x, z] = cellXZ(i), c = D.cells[i], y = gy(x, z), fy = floorY(i);
      setI(moundIM, i, x, y - 0.02, z, hash2(i, 3) * 0.3, c === 0 ? 1 : 0.001); setI(pitIM, i, x, fy, z, 0, c === 0 ? 0.001 : 1);
      setI(findIM, i, x + 0.3, fy + 0.04, z - 0.2, hash2(i, 5) * 6, c === 1 ? 1 : 0.001); }
    WALLS.forEach((w, k) => { const i = w[0] * GRID + w[1], [x, z] = cellXZ(i), e = w[2], ox = e === 1 ? CS / 2 : e === 3 ? -CS / 2 : 0, oz = e === 2 ? CS / 2 : e === 0 ? -CS / 2 : 0; setI(wallIM, k, x + ox, floorY(i) - 0.48, z + oz, e % 2 ? Math.PI / 2 : 0, shown(k) ? 1 : 0.001); });
    for (const im of [moundIM, pitIM, wallIM, findIM]) im.instanceMatrix.needsUpdate = true;
    const n = D.layer > 0 ? GRID * GRID : doneN(); cols.visible = n >= 8; gate.visible = n >= GRID * GRID;
    FINDS.forEach((f, k) => { shelf[k].visible = !!S.museum[f[0]]; });
  };
  Q.draw = draw; draw();
  const today = () => st.dunyo.day;
  Q.rented = () => D.rent === today();
  Q.left = () => (D.day === today() ? Math.max(0, DIG_DAY - D.n) : DIG_DAY);
  Q.rent = () => { if (Q.rented()) return true; if (st.money < RENT) { toast(`Ijara uchun ${RENT} so'm kerak`, 'bad'); return false; } game.addMoney(-RENT, 'Qazilma asboblari ijarasi'); D.rent = today(); sfx('buy'); toast(`Nodira opa: «Mana belkurak va cho'tka — bugun kechgacha sizniki!» ⛏🖌`, 'gold'); game.save(); return true; };
  // belkurak bilan qazish (katak → chuqur, topilma ko'rinadi)
  Q.dig = (i, instant) => { if (D.cells[i] !== 0) return false; if (!Q.rented()) { toast("Avval lagerdagi Nodira opadan asbob ijaraga oling (E)", 'bad'); return false; }
    if (Q.left() <= 0) { toast(`Bugungi ruxsat tugadi (${DIG_DAY} katak). Ertaga keling — qum qochmaydi 🙂`, 'bad'); return false; }
    const fin = () => { if (D.day !== today()) { D.day = today(); D.n = 0; } D.n++; D.cells[i] = 1; draw(); sfx('pluck'); game.fx.burst(14, cellXZ(i)[0], gy(...cellXZ(i)) + 0.3, cellXZ(i)[1], 3, 0.8, 0.5, 0xd9b97c, 0.9, 1, 4, 0); toast("Qum ostidan nimadir ko'rindi! Endi cho'tka bilan ehtiyotlab tozalang (E — sekin-sekin)", 'gold'); };
    if (instant) fin(); else pl.act('swing', 1.8, fin, 'shovel'); return true; };
  // cho'tka mini-o'yini: har E — bitta silash; juda tez-tez silasangiz «qizish» oshadi, chegaradan o'tsa topilma darz ketadi (2 marta — sinadi)
  Q.startBrush = (i) => { if (D.cells[i] !== 1 || Q.brush) return false; Q.brush = { i, prog: 0, heat: 0, cracks: 0, last: -9 }; setTool(pl.rig, 'brush'); pl.emote = 'bend'; drawB(); return true; };
  Q.stroke = () => { const B = Q.brush; if (!B) return; const now = game.time, gap = now - B.last; B.last = now;
    B.heat += gap < 0.3 ? 0.34 : gap < 0.55 ? 0.16 : 0.07; B.prog = Math.min(1, B.prog + 0.1); pl.emote = 'bend'; game.audio.burst && game.audio.ready && game.audio.burst(game.audio.ctx.currentTime, 0.18, 'highpass', 3600, 0.7, 0.12, 0.8);
    { const [x, z] = cellXZ(B.i); game.fx.burst(4, x + 0.3, floorY(B.i) + 0.15, z - 0.2, 1.4, 0.4, 0.25, 0xe0c890, 0.8, 0.6, 2, 0); }
    if (B.heat > 1) { B.cracks++; B.heat = 0.35; sfx('smash'); if (B.cracks >= 2) return endBrush(false); toast("Shoshilmang! Topilma darz ketdi — yana bir marta shunday bo'lsa sinadi", 'bad'); }
    if (B.prog >= 1) endBrush(true); drawB(); };
  const endBrush = (ok) => { const B = Q.brush; if (!B) return; Q.brush = null; drawB(); setTool(pl.rig, null); if (pl.emote === 'bend') pl.emote = null; D.cells[B.i] = 2;
    const k = findOf(D.layer, B.i), f = FINDS[k];
    if (ok) { S.finds[f[0]] = (S.finds[f[0]] || 0) + 1; S.found = (S.found || 0) + 1; sfx('medal'); game.fx.burst(16, cellXZ(B.i)[0], floorY(B.i) + 0.5, cellXZ(B.i)[1], 3, 0.9, 0.5, 0xffe14a, 1, 1, 4, 0);
      game.banner(`${f[2]} ${f[1]} topildi!`, `${B.cracks ? 'Biroz darz ketgan, lekin butun' : 'Butun-butun, a\'lo ish!'} · to'plamda ${S.finds[f[0]]} ta · muzey javoniga topshiring`, 'gold'); }
    else { S.broken = (S.broken || 0) + 1; game.addMoney(5, 'Siniq parchalar'); toast(`${f[2]} ${f[1]} sinib ketdi 😢 Keyingi safar sekinroq silang. (siniqlar uchun +5 so'm)`, 'bad'); }
    if (doneN() >= GRID * GRID) { D.layer++; D.cells = new Array(GRID * GRID).fill(0); game.addMoney(600, 'Qazilma qatlami'); game.banner('🏛 Qadimiy shahar qatlami ochildi!', "Devorlar butunlay ko'rindi · +600 so'm · ostida yana bir qatlam bor — topilmalar kamyobroq", 'gold'); }
    draw(); game.save(); };
  Q.endBrush = endBrush;
  // muzey: har turdan birinchisi — javonga (qiymat ×3 + hurmat), takrorlari — muzey sotib oladi (qiymati)
  Q.donate = (id) => { const k = FIND_BY[id], f = FINDS[k]; if (k == null || !(S.finds[id] > 0) || S.museum[id]) return false; S.finds[id]--; S.museum[id] = 1; const rw = f[3] * 3; game.addMoney(rw, 'Muzeyga topilma'); st.hurmat = (st.hurmat || 0) + 1; sfx('medal'); draw();
    const n = Object.keys(S.museum).length; if (n >= FINDS.length && !S.arx) { S.arx = 1; game.addMoney(2500, 'Muzey to\'ldi'); game.banner('🏛 Muzey javoni to\'ldi!', "«Arxeolog» unvoni · +2 500 so'm · qadimiy shahar sirlari ochildi", 'gold'); sfx('win'); }
    else toast(`${f[2]} ${f[1]} muzey javoniga qo'yildi · +${som(rw)} so'm · 🤝 hurmat +1 (${n}/${FINDS.length})`, 'gold'); game.save(); return true; };
  Q.sell = (id) => { const k = FIND_BY[id]; if (k == null || !(S.finds[id] > 0) || !S.museum[id]) return false; S.finds[id]--; game.addMoney(FINDS[k][3], 'Topilma sotildi'); sfx('buy'); game.save(); return true; };

  // cho'tka paneli (ekran pastida)
  const bEl = document.createElement('div'); bEl.className = 'panel'; bEl.id = 'qz-brush'; bEl.style.cssText = 'position:absolute;left:50%;bottom:150px;transform:translateX(-50%);padding:10px 14px;min-width:280px;display:none;pointer-events:none;text-align:center';
  const drawB = () => { const B = Q.brush; if (!B) { bEl.style.display = 'none'; return; } if (!bEl.parentNode) ui.hud.appendChild(bEl); bEl.style.display = '';
    const hot = B.heat > 0.7; bEl.innerHTML = `<b>🖌 Cho'tka bilan tozalash</b><div class="bar" style="margin:6px 0 4px"><i style="width:${Math.round(B.prog * 100)}%;background:var(--good)"></i></div><div style="font-size:12px;color:var(--mut)">Ehtiyotkorlik</div><div class="bar" style="margin:3px 0"><i style="width:${Math.round(Math.min(1, B.heat) * 100)}%;background:${hot ? 'var(--bad)' : '#f0c040'}"></i></div><small>${'💔'.repeat(B.cracks)}${B.cracks ? ' ' : ''}<kbd>E</kbd> — bir silash · tez-tez bosmang!</small>`; };
  Q.drawB = drawB;

  // ================= [E] TAKLIFLARI =================
  const ex0 = L.extra;
  L.extra = (offer, px, pz, p) => { if (ex0) ex0(offer, px, pz, p); if (game.interior && game.interior.inside) return; if (Math.abs(px - cx) > 40 || Math.abs(pz - cz) > 40) return;
    if (Q.brush) { offer(-2, "<kbd>E</kbd> Cho'tka bilan silash 🖌", Q.stroke); return; }
    { const d = Math.hypot(arx.root.position.x - px, arx.root.position.z - pz); if (d < 2.6) offer(d, `<kbd>E</kbd> Arxeolog Nodira opa — qazilma ⛏`, () => ui.open('qazilma')); }
    { const d = Math.hypot(mus.x - px, mus.z - pz); if (d < 3.2) offer(d, '<kbd>E</kbd> Muzey javoni — topilmalarni topshirish 🏛', () => ui.open('muzey')); }
    const i = Q.cellAt(px, pz); if (i < 0) return; const [x, z] = cellXZ(i), d = Math.hypot(x - px, z - pz) * 0.5;
    if (D.cells[i] === 0) offer(d, Q.rented() ? (Q.left() > 0 ? `<kbd>E</kbd> Qazish ⛏ (bugun yana ${Q.left()})` : 'Bugungi ruxsat tugadi — ertaga') : "Qazish uchun asbob kerak — lagerdagi Nodira opa", () => Q.dig(i));
    else if (D.cells[i] === 1) offer(d, "<kbd>E</kbd> Cho'tka bilan tozalashni boshlash 🖌", () => Q.startBrush(i)); };

  // ================= OYNALAR =================
  const css = document.createElement('style'); css.textContent = `
.qz-g{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-top:10px}.qz-f{padding:10px;border-radius:12px;background:rgba(255,255,255,.06);border:1px solid var(--bd);text-align:center;font-size:13px}
.qz-f i{display:block;font-style:normal;font-size:28px}.qz-f.on{border-color:rgba(255,200,58,.6);background:rgba(255,200,58,.1)}.qz-f.off i{filter:grayscale(1);opacity:.4}.qz-f button{margin-top:6px;padding:5px 8px;font-size:12px;width:100%}
.qz-map{display:grid;grid-template-columns:repeat(5,22px);gap:3px}.qz-map i{width:22px;height:22px;border-radius:4px;background:#d9b97c}.qz-map i.d1{background:#a8844e;outline:2px solid #ffe14a}.qz-map i.d2{background:#6a5034}
@media(max-width:720px){.qz-g{grid-template-columns:repeat(2,minmax(0,1fr))}}`;
  document.head.appendChild(css);
  const mapHtml = () => `<div class="qz-map">${D.cells.map((c) => `<i class="d${c}"></i>`).join('')}</div>`;
  ui.s_qazilma = function (w, d, btn, x) { x(); const draw2 = () => { const n = doneN(), tot = Object.values(S.finds).reduce((a, b) => a + b, 0);
      w.innerHTML = `<h1>⛏ Qum ostidagi qadimiy shahar <small>arxeolog Nodira opa</small></h1><p class="sub">«Bu yerda ming yillar oldin savdo shahri bo'lgan. Belkurak bilan qumni oling, keyin cho'tka bilan <b>sekin-sekin</b> tozalang — shoshilsangiz topilma sinadi.»</p>
      <div class="grid2"><div><div class="stat"><span>Asboblar (belkurak + cho'tka)</span><b>${Q.rented() ? '✔ bugun sizda' : `${RENT} so'm / kun`}</b></div><div class="stat"><span>Bugun qazish mumkin</span><b>${Q.left()} / ${DIG_DAY} katak</b></div><div class="stat"><span>Qatlam</span><b>${D.layer + 1}-qatlam · ${n}/25</b></div><div class="stat"><span>To'plamda</span><b>${tot} ta topilma</b></div><div class="stat"><span>Muzey javoni</span><b>${Object.keys(S.museum).length}/${FINDS.length}</b></div><div class="stat"><span>Singanlar</span><b>${S.broken || 0}</b></div>
      <div class="row" style="margin-top:10px">${Q.rented() ? '' : `<button data-a="rent">⛏ Asbob ijarasi — ${RENT} so'm</button>`}<button class="sec" data-a="mus">🏛 Muzey javoni</button></div></div><div><h4 style="margin:4px 0 6px">Maydon xaritasi</h4>${mapHtml()}<p class="sub" style="margin-top:8px">Qum — qazilmagan · sariq hoshiya — tozalash kutmoqda · to'q — ochilgan. Ochilgan kataklarda qadimiy devorlar ko'rinadi.</p></div></div>`; };
    this.on({ rent: () => { Q.rent(); draw2(); }, mus: () => this.open('muzey') }); draw2(); };
  ui.s_muzey = function (w, d, btn, x) { x(); const draw2 = () => { w.innerHTML = `<h1>🏛 Qadimiy shahar muzeyi <small>${Object.keys(S.museum).length}/${FINDS.length} javonda</small></h1><p class="sub">Har turdan birinchisini javonga qo'ying (qiymati ×3 + 🤝 hurmat). Javonda bori takrorlarini muzey sotib oladi. Javon to'lsa — «Arxeolog» unvoni va 2 500 so'm.</p>
      <div class="qz-g">${FINDS.map((f) => { const n = S.finds[f[0]] || 0, on = !!S.museum[f[0]]; return `<div class="qz-f ${on ? 'on' : n ? '' : 'off'}"><i>${f[2]}</i><b>${f[1]}</b><br><small>${on ? '✔ javonda' : 'javon bo\'sh'} · sizda ${n}</small>${!on && n ? `<button data-a="don:${f[0]}">Javonga qo'yish (+${som(f[3] * 3)})</button>` : on && n ? `<button class="sec" data-a="sell:${f[0]}">Sotish (+${f[3]})</button>` : ''}</div>`; }).join('')}</div>`; };
    this.on({ don: (id) => { Q.donate(id); draw2(); }, sell: (id) => { Q.sell(id); draw2(); } }); draw2(); };

  // ================= KADR =================
  game.hooks.push((dt) => {
    const p = pl.p, near = pl.onFoot && Math.abs(p[0] - cx) < 90 && Math.abs(p[2] - cz) < 90;
    { const d = Math.hypot(arx.root.position.x - p[0], arx.root.position.z - p[2]); arx.root.visible = d < 160; if (d < 70) poseRig(arx, d < 5 ? 'talk' : 'idle', dt, 0); }
    if (Q.brush) { const [x, z] = cellXZ(Q.brush.i); Q.brush.heat = Math.max(0, Q.brush.heat - dt * 0.45); if (!near || Math.hypot(x - p[0], z - p[2]) > 3.2 || !pl.onFoot) { Q.brush = null; setTool(pl.rig, null); if (pl.emote === 'bend') pl.emote = null; toast("Tozalash to'xtatildi — topilma chuqurda kutib turibdi"); } else if (pl.emote !== 'bend') pl.emote = 'bend'; drawB(); }
    L.dots.push([cx, cz, '#e0a050']);
  });
  return Q;
}
