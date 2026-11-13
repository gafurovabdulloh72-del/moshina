// "Hayot" tizimlari: piyoda qahramonning 50 ta imkoniyati — terimchilik, ekish, baliq ovi, odamlar, hayvonlar, uy xo'jaligi, qurish, topshiriqlar
import * as THREE from 'three';
import * as T from './terrain.js';
import { GB, MAT } from './geo.js';
import * as COL from './colliders.js';
import * as BK from './blocks.js';
import { hash2, clamp, angDiff } from './util.js';
import { makeRig, poseRig, setTool } from './rig.js';
import { HOME_LEVELS, DECOR } from './home.js';

const B = T.BIOME, SF = T.SURF;
// nom, belgi, sotuv narxi, yeganda to'qlik
export const ITEMS = {
  fruit: ['Meva', '🍎', 15, 22], berry: ['Rezavor', '🫐', 6, 9], veg: ['Sabzavot', '🥕', 48, 20], bread: ['Non', '🍞', 0, 45], mush: ["Qo'ziqorin", '🍄', 22, 0], shell: ["Chig'anoq", '🐚', 28, 0], flower: ['Yovvoyi gul', '💐', 12, 0],
  wood: ["O'tin", '🪵', 8, 0], hay: ['Pichan', '🌾', 5, 0], fish: ['Baliq', '🐟', 45, 0], bigfish: ['Katta baliq', '🐠', 130, 0], egg: ['Tuxum', '🥚', 25, 0], ore: ['Ruda', '🪨', 60, 0], gem: ['Yoqut', '💎', 500, 0],
  seed: ["Urug'", '🌱', 0, 0], sapling: ["Ko'chat", '🌳', 0, 0], kit: ["Ta'mir to'plami", '🧰', 0, 0],
};
export const SHOP = [['seed', "Urug' ×5", 40, 5], ['sapling', "Ko'chat", 120, 1], ['bread', 'Non', 30, 1], ['kit', "Ta'mir to'plami", 220, 1]];
export const TOOLS = [['rod', 'Qarmoq', 250, "Suv bo'yida baliq ovlash"], ['shovel', 'Belkurak', 300, 'Yaltiroq joydan xazina qazish'], ['pick', "Cho'kich", 350, 'Toshloqda ruda qazish'], ['tent', 'Chodir', 400, 'Istalgan joyda tunash'], ['dutor', 'Dutor', 300, 'Kuy chalib pul ishlash']];
const TASKS = [
  ['plant', 'ta gul eking', [4, 8], 14], ['pull', "marta o't yuling", [6, 10], 6], ['shake', 'ta daraxtni silkiting', [4, 8], 10], ['eat', 'marta ovqatlaning', [2, 4], 12], ['mush', "ta qo'ziqorin tering", [3, 6], 16],
  ['shell', "ta chig'anoq tering", [3, 6], 18], ['bfly', 'ta kapalak tuting', [2, 4], 22], ['wflow', 'ta yovvoyi gul tering', [3, 6], 10], ['wood', "ta o'tin yig'ing", [3, 6], 8], ['fish', 'ta baliq tuting', [2, 4], 40],
  ['litter', "ta axlatni yig'ishtiring", [4, 8], 10], ['talk', 'kishi bilan gaplashing', [2, 4], 14], ['gift', 'kishiga yaxshilik qiling', [1, 3], 55], ['hitch', "yo'lovchini manziliga eltib qo'ying", [1, 2], 90], ['feed', "ta qo'yni boqing", [2, 4], 16],
  ['stone', "ta toshni yo'ldan olib tashlang", [2, 4], 22], ['fire', 'marta gulxan yoqing', [1, 1], 45], ['jump', 'marta 15 metrdan uzun sakrang', [2, 4], 35], ['driftc', "so'mlik drift qiling", [100, 250], 0.6], ['smash', 'ta buyumni sindiring', [10, 20], 4],
  ['coin', "ta tanga yig'ing", [10, 20], 4], ['km', "km yo'l bosing", [2, 4], 30], ['berry', 'ta butadan rezavor tering', [2, 4], 12], ['veg', 'ta sabzavot hosili oling', [2, 6], 18], ['pet', 'marta kuchukni erkalang', [1, 2], 20],
];
const TIPS = ["Daraxtni silkitsangiz meva tushadi — [E]. Mevani [Y] bilan yeysiz.", "O't yulsangiz ba'zan urug' chiqadi. Urug'dan [G] bilan gul ekiladi.", "Qarmoq olsangiz, suv bo'yida [E] bilan baliq ovlaysiz.", "Uyingizni yaxshilang — har daraja daromad keltiradi.", "Drift qilish uchun [Probel]ni bosib turib gaz bering.", "Mashina qattiq urilsa motor o'chib qoladi. Ustaxonaga boring!", "Yo'ldagi toshlarni piyoda [E] bilan olib tashlash mumkin — savob!", "Kechasi piyoda yursangiz [L] — fonar.", "[B] — harakatlar menyusi: gulxan, chodir, raqs, dutor...", "Yaltiroq joyni ko'rsangiz belkurak bilan qazing — xazina bo'lishi mumkin.", "Qo'ylar pichanni yaxshi ko'radi. O't yulib, ularni boqing.", "Yo'l chetida qo'l ko'targan odamni ko'rsangiz — manziliga eltib qo'ying.", "Bolid — orolning eng tez mashinasi, lekin toshlardan qo'rqadi.", "Velosiped hech qachon buzilmaydi va benzin so'ramaydi!", "Gulxanda baliq yoki qo'ziqorin pishirsangiz, kuchingiz tez tiklanadi.", "Kasb Egalari — ijodkorlarni xaritadan topadigan platforma. Reklamasini ko'rgandirsiz!"];
const NAMES = ['Dilnoza', 'Jasur', 'Malika', 'Sardor', 'Gulnora', 'Bobur', 'Zilola', 'Aziz', 'Nodira', 'Sherzod', 'Kamola', 'Rustam', 'Madina', 'Otabek', 'Feruza', 'Jahongir', 'Sevara', "Ulug'bek", 'Lola', 'Temur', 'Nigora', 'Farrux', 'Shahlo', 'Anvar', 'Mohira', 'Davron'];
const LOOKS = [{ shirt: 0xe2572f, pants: 0x3a3f4c }, { shirt: 0x3f9a58, pants: 0x4a3a2a, long: true, hair: 0x1d1612 }, { shirt: 0xf2ead8, pants: 0x2f4a78, hair: 0x6a4a30 }, { shirt: 0x8a54c8, pants: 0x2a2c33, long: true }, { shirt: 0x24b8b0, pants: 0x6e4a30, hair: 0x15110e }, { shirt: 0xb84a34, pants: 0x3a3f4c, vest: 0x2a2c33 }, { shirt: 0xf0b83a, pants: 0x2f4a78, long: true, hair: 0x4a2a1a }, { shirt: 0x2f7fd0, pants: 0x4a4d57, hair: 0x8a8a8a }];
const FRUIT = { round: ['Olma', 0xe2402f], oval: ['Nok', 0xc8d048], blossom: ['Gilos', 0xb0183a], palm: ['Kokos', 0x8a5a36], pine: ["Qarag'ay yong'og'i", 0x9a6a42], pineSnow: ["Qarag'ay yong'og'i", 0x9a6a42] };
// biom bo'yicha uchraydigan narsalar: [tur, ehtimol]
const SPAWN = { [B.MEADOW]: [['wflow', 0.07], ['bfly', 0.05], ['berry', 0.05], ['wood', 0.02], ['mush', 0.012]], [B.SAKURA]: [['wflow', 0.08], ['bfly', 0.07], ['berry', 0.04]], [B.AUTUMN]: [['mush', 0.09], ['wood', 0.06], ['berry', 0.04], ['wflow', 0.02]], [B.TAIGA]: [['mush', 0.1], ['wood', 0.07], ['berry', 0.03]],
  [B.SNOW]: [['wood', 0.03], ['ore', 0.035]], [B.DESERT]: [['ore', 0.04], ['wood', 0.03]], [B.CANYON]: [['ore', 0.07]], [B.VOLCANIC]: [['ore', 0.08]], [B.SAVANNA]: [['wflow', 0.04], ['bfly', 0.04], ['wood', 0.03]], [B.BEACH]: [['shell', 0.13]] };
const KIND = {
  mush: { nm: "Qo'ziqorin", inv: 'mush', auto: 1, geo: (g) => { g.color(0xf2ead8).cyl(6, 0.07, 0.05, 0, 0.22); g.color(0xd8392b).blob(0.19, 1, { cy: 0.24, sy: 0.55 }); g.color(0xffffff); for (const [x, z] of [[0.08, 0.05], [-0.07, 0.07], [0, -0.1]]) g.blob(0.035, 0, { cx: x, cy: 0.32, cz: z }); g.color(0xf2ead8).cyl(5, 0.04, 0.03, 0, 0.13).translate(0, 0, 0); } },
  shell: { nm: "Chig'anoq", inv: 'shell', auto: 1, geo: (g) => { g.color(0xffc8d8).blob(0.16, 1, { cy: 0.07, sy: 0.5, sz: 0.8 }); g.color(0xf7a8c4).blob(0.09, 0, { cx: 0.09, cy: 0.1, sy: 0.6 }); } },
  wflow: { nm: 'Yovvoyi gul', inv: 'flower', auto: 1, geo: (g) => { for (const [x, z, h, c] of [[0, 0, 0.5, 0xff6a8a], [0.12, 0.08, 0.38, 0xffd23a], [-0.1, 0.1, 0.42, 0xb07cff], [0.03, -0.13, 0.34, 0xffffff]]) { g.color(0x4f9e48); g.push().translate(x, 0, z); g.cyl(4, 0.018, 0.014, 0, h); g.color(c).blob(0.085, 0, { cy: h + 0.03, sy: 0.7 }); g.color(0xffe14a).blob(0.035, 0, { cy: h + 0.07 }); g.pop(); } } },
  wood: { nm: "O'tin", inv: 'wood', auto: 1, geo: (g) => { g.color(0x8a5a36); for (const [a, y, r] of [[0.3, 0.08, 0.075], [-0.5, 0.09, 0.07], [1.4, 0.2, 0.06]]) { g.push().translate(0, y, 0).rotY(a); g.prismZ(6, r, 0.9); g.pop(); } g.color(0xc79a66); } },
  litter: { nm: 'Axlat', auto: 1, geo: (g) => { g.color(0xe8e8e8).blob(0.13, 0, { cy: 0.1, jitter: 0.3 }); g.color(0xd8392b); g.push().translate(0.2, 0.06, 0.08).rotZ(1.57); g.cyl(6, 0.055, 0.055, -0.1, 0.1, { cap: true }); g.pop(); g.color(0x4fb0ff).box(-0.16, 0.03, -0.1, 0.2, 0.05, 0.14); } },
  bfly: { nm: 'Kapalak', auto: 1, r: 1.7, geo: (g) => { g.color(0x2a2c33).box(0, 0, 0, 0.03, 0.03, 0.2); g.color(0xffffff); for (const sx of [-1, 1]) { g.tri([0, 0, 0.08], [sx * 0.24, 0.06, 0.14], [sx * 0.2, 0.04, -0.02]); g.tri([sx * 0.2, 0.04, -0.02], [sx * 0.24, 0.06, 0.14], [0, 0, 0.08]); g.tri([0, 0, 0], [sx * 0.17, 0.03, -0.14], [0, 0, -0.08]); g.tri([0, 0, -0.08], [sx * 0.17, 0.03, -0.14], [0, 0, 0]); } }, tint: [0xffb030, 0x4fb0ff, 0xff6a8a, 0xf2f2ee, 0xb07cff] },
  berry: { nm: 'Rezavor butasi', geo: (g) => { g.color(0x3d8a4a).blob(0.55, 1, { cy: 0.38, sy: 0.75, jitter: 0.14, shade: 0.2 }); g.color(0xc0203a); for (let i = 0; i < 9; i++) { const a = i * 2.4, r = 0.4 + (i % 3) * 0.07; g.blob(0.06, 0, { cx: Math.cos(a) * r, cy: 0.3 + (i % 4) * 0.13, cz: Math.sin(a) * r }); } } },
  dig: { nm: 'Yaltiroq joy', geo: (g) => { g.color(0x8a6a4a).blob(0.5, 1, { cy: 0.02, sy: 0.3, jitter: 0.15 }); g.color(0xffe14a).blob(0.07, 0, { cy: 0.2 }); g.box(0, 0.2, 0, 0.02, 0.26, 0.02); g.box(0, 0.2, 0, 0.26, 0.02, 0.02); } },
  ore: { nm: 'Ruda toshi', geo: (g) => { g.color(0x5a5560).blob(0.5, 1, { cy: 0.25, sy: 0.8, jitter: 0.22, freq: 3.2 }); g.color(0xffb030); for (const [x, y, z] of [[0.3, 0.4, 0.2], [-0.25, 0.5, 0.1], [0.05, 0.62, -0.2], [-0.1, 0.3, 0.4]]) { g.push().translate(x, y, z).rotZ(x * 3).rotX(z * 3); g.prism(4, 0.07, 0, 0, 0.2); g.pop(); } } },
};

export function initLiving(game) {
  const { scene, car, site } = game, st = game.state, pl = game.player, home = site.places.uy.home, fx = () => game.fx;
  const L = (game.live = { prompt: '', dots: [], fare: null, quest: null, fishing: null });
  const toast = (m, k) => game.toast(m, k), sfx = (n, k) => game.audio.sfx(n, k), rnd = Math.random;
  const give = (id, n = 1) => { st.inv[id] = (st.inv[id] || 0) + n; };
  const dummy = new THREE.Object3D(), col = new THREE.Color();
  const mkIM = (geoFn, cap, mat, seed = 5) => { const g = new GB(seed); g.jit = 0.03; geoFn(g); const im = new THREE.InstancedMesh(g.build(), mat || MAT.flat, cap); im.count = 0; im.frustumCulled = false; im.castShadow = true; scene.add(im); return im; };
  const setI = (im, i, x, y, z, ry = 0, s = 1, sy = s, rx = 0, rz = 0) => { dummy.position.set(x, y, z); dummy.rotation.set(rx, ry, rz); dummy.scale.set(s, sy, s); dummy.updateMatrix(); im.setMatrixAt(i, dummy.matrix); };
  const hearts = (x, y, z, hex = 0xff5a8a) => fx().burst(7, x, y, z, 1.6, 1.1, 0.4, hex, 0.95, 2, -1, 0.3);
  const sparkle = (x, y, z, hex = 0xffe14a, n = 10) => fx().burst(n, x, y, z, 3, 0.6, 0.4, hex, 1, 1.2, 3, 0);
  const pos = () => (pl.onFoot ? pl.p : car.p);
  const front = (d) => [pl.p[0] + Math.sin(pl.yaw) * d, pl.p[2] + Math.cos(pl.yaw) * d];
  const surfAt = (x, z) => T.ground(x, z, 1e9).surf;
  const karma = (n) => { const a = Math.floor(st.karma / 10); st.karma += n; if (Math.floor(st.karma / 10) > a) { game.addMoney(150); game.banner('Yaxshilik qaytadi!', `Yaxshilik ochkosi: ${st.karma} · +150 so'm`, 'gold'); sfx('medal'); } };
  L.karma = karma;

  // ================= TOPSHIRIQLAR VA ALBOM =================
  const newTask = () => { for (let t = 0; t < 30; t++) { const d = TASKS[(rnd() * TASKS.length) | 0]; if (st.tasks.some((q) => q.id === d[0])) continue; if (d[0] === 'fish' && !st.tools.rod) continue; if ((d[0] === 'veg') && st.home.lvl < 2) continue; if (d[0] === 'pet' && st.home.lvl < 1) continue; const goal = d[2][0] + Math.round(rnd() * (d[2][1] - d[2][0])); return { id: d[0], n: 0, goal, rw: Math.round(goal * d[3]) + 25 }; } return { id: 'coin', n: 0, goal: 10, rw: 65 }; };
  while (st.tasks.length < 3) st.tasks.push(newTask());
  L.taskText = (t) => `${t.goal} ${TASKS.find((d) => d[0] === t.id)[1]}`;
  L.count = (key, n = 1) => {
    st.cnt[key] = (st.cnt[key] || 0) + n;
    for (let i = 0; i < st.tasks.length; i++) { const t = st.tasks[i]; if (t.id !== key) continue; t.n += n; if (t.n >= t.goal) { game.addMoney(t.rw); st.xp += 40; st.cnt.tasks = (st.cnt.tasks || 0) + 1; game.banner('Topshiriq bajarildi!', `${L.taskText(t)} · +${t.rw} so'm`, 'gold'); sfx('win'); st.tasks[i] = newTask(); } }
  };
  const see = (key, name) => { if (st.seen[key]) return; st.seen[key] = 1; game.addMoney(40); toast(`Yangi topilma albomga qo'shildi: ${name} · +40 so'm`, 'gold'); };
  L.albumTotal = 25;

  // ================= TERIMLAR (biom bo'yicha paydo bo'ladi) =================
  const CELL = 16, RAD = 5, ims = {}, taken = new Map(); let active = [], cellKey = null, dirty = true;
  for (const k in KIND) ims[k] = mkIM(KIND[k].geo, 36, k === 'bfly' ? new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }) : MAT.flat, k.length * 7 + 3);
  ims.bfly.castShadow = false;
  const rescan = (px, pz) => {
    const i0 = Math.floor(px / CELL), j0 = Math.floor(pz / CELL); active = [];
    for (let j = j0 - RAD; j <= j0 + RAD; j++) for (let i = i0 - RAD; i <= i0 + RAD; i++) {
      const key = (i + 4096) * 8192 + (j + 4096); const tk = taken.get(key); if (tk && tk > game.time) continue;
      const x = (i + 0.15 + hash2(i, j, 92) * 0.7) * CELL, z = (j + 0.15 + hash2(i, j, 93) * 0.7) * CELL; if (Math.abs(x) > 3100 || Math.abs(z) > 3100) continue;
      const si = T.siteInfo(x, z); if (si.y < si.water + 0.3 || si.slope > 0.5 || si.roadD < 1.2) continue;
      let kind = null; const h = hash2(i, j, 91);
      if (si.roadD < 13 && hash2(i, j, 94) < 0.1) kind = 'litter'; else if (hash2(i, j, 95) < 0.012 && si.roadD > 20) kind = 'dig';
      else { const tb = SPAWN[si.biome]; if (tb) { let a = 0; for (const [k, pr] of tb) { a += pr; if (h < a) { kind = k; break; } } } }
      if (!kind) continue; if (kind === 'shell' && si.y > 3.4) continue;
      active.push({ k: kind, x, y: si.y, z, key, ph: h * 60, i, j });
    }
    dirty = true;
  };
  const drawItems = () => {
    const n = {}; for (const k in ims) n[k] = 0;
    for (const a of active) { const im = ims[a.k]; if (n[a.k] >= 36 || a.k === 'bfly') continue; setI(im, n[a.k]++, a.x, a.y, a.z, a.ph, a.k === 'berry' || a.k === 'ore' ? 0.9 + (a.ph % 1) * 0.4 : 1); }
    for (const k in ims) { if (k === 'bfly') continue; ims[k].count = n[k]; ims[k].instanceMatrix.needsUpdate = true; } dirty = false;
  };
  const takeItem = (a, respawn = 240) => { taken.set(a.key, game.time + respawn); active.splice(active.indexOf(a), 1); dirty = true; };
  // tushgan mevalar va topshiriq buyumlari
  const drops = [], dropIM = mkIM((g) => { g.color(0xffffff).blob(0.15, 1, { cy: 0.15 }); g.color(0x4f9e48).box(0.03, 0.31, 0, 0.1, 0.02, 0.05); }, 40, new THREE.MeshLambertMaterial({ vertexColors: true }));
  const drop = (x, y, z, kind, hex, nm) => { if (drops.length >= 40) drops.shift(); const a = rnd() * 6.28, d = 1.1 + rnd() * 1.6; drops.push({ x: x + Math.cos(a) * d, z: z + Math.sin(a) * d, y, vy: 0, kind, hex, nm, t: 0 }); };
  const questIM = mkIM((g) => { g.color(0x8a5a36).box(0, 0.12, 0, 0.42, 0.24, 0.3); g.color(0xffd23a).box(0, 0.14, 0.16, 0.1, 0.1, 0.02); }, 1);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 40, 6, 1, true), new THREE.MeshBasicMaterial({ color: 0x4fd0ff, transparent: true, opacity: 0.25, depthWrite: false, fog: false })); beam.visible = false; scene.add(beam);

  // ================= EKILGAN GUL, DARAXT, BAYROQ, QUM QAL'A, GULXAN, CHODIR =================
  const flowIM = (() => { const g = new GB(61); g.jit = 0; g.color(0x4f9e48).mask(0).cyl(4, 0.028, 0.02, 0, 0.5); g.box(0.07, 0.2, 0, 0.14, 0.02, 0.06); g.color(0xffffff).mask(1); for (let i = 0; i < 6; i++) { const a = i * 1.047; g.blob(0.075, 0, { cx: Math.cos(a) * 0.1, cy: 0.52, cz: Math.sin(a) * 0.1, sy: 0.6 }); } g.color(0xffe14a).mask(0).blob(0.065, 0, { cy: 0.54 }); const im = new THREE.InstancedMesh(g.build(), MAT.tree, 300); im.frustumCulled = false; im.count = 0; scene.add(im); return im; })();
  const FCOL = [0xff6a8a, 0xffd23a, 0xf2f2ee, 0xb07cff, 0xff8a3a, 0x4fb0ff];
  const drawFlowers = () => { const F = st.flowers; flowIM.count = F.length; for (let i = 0; i < F.length; i++) { const f = F[i]; const age = clamp((st.stats.time - (f[3] || 0)) / 25, 0, 1); setI(flowIM, i, f[0], T.gridHeight(f[0], f[1]), f[1], i * 1.7, 0.35 + 0.95 * age); flowIM.setColorAt(i, col.setHex(FCOL[f[2] % 6])); } flowIM.instanceMatrix.needsUpdate = true; if (flowIM.instanceColor) flowIM.instanceColor.needsUpdate = true; };
  const treeIM = (() => { const g = new GB(62); g.jit = 0; g.color(0x7a5236).cyl(7, 0.32, 0.2, -0.3, 3.4, { shade: 0.12 }); g.color(0x63b35c); g.blob(2.2, 1, { cy: 4.7, jitter: 0.09, shade: 0.22, sy: 0.92 }); g.blob(1.55, 1, { cx: 1.25, cy: 3.7, cz: 0.4, jitter: 0.1, shade: 0.22 }); g.blob(1.45, 1, { cx: -1.15, cy: 3.9, cz: -0.5, jitter: 0.1, shade: 0.22 }); g.color(0xe2402f); for (let i = 0; i < 7; i++) { const a = i * 0.9; g.blob(0.13, 0, { cx: Math.cos(a) * 1.9, cy: 4.2 + (i % 3) * 0.5, cz: Math.sin(a) * 1.9 }); } const im = new THREE.InstancedMesh(g.build(), MAT.flat, 40); im.frustumCulled = false; im.castShadow = true; im.count = 0; scene.add(im); return im; })();
  const GROW = 300, treeCols = [];
  const treeScale = (t) => 0.1 + 0.9 * clamp((st.stats.time - t[2]) / GROW, 0, 1);
  const drawTrees = () => { const A = st.trees; treeIM.count = A.length; for (let i = 0; i < A.length; i++) { const t = A[i], s = treeScale(t), y = T.gridHeight(t[0], t[1]); setI(treeIM, i, t[0], y, t[1], i * 2.1, s); if (s >= 0.999 && !treeCols[i]) treeCols[i] = COL.addCircle(t[0], t[1], 0.38, y - 1, y + 6.5, 0, { tree: 'round', planted: i, x: t[0], y, z: t[1], s: 1, rot: i * 2.1, hex: 0x63b35c }); } treeIM.instanceMatrix.needsUpdate = true; };
  const flagIM = mkIM((g) => { g.color(0xc8ccd4).cyl(5, 0.035, 0.03, 0, 2.6); g.color(0xe2572f).box(0.42, 2.3, 0, 0.8, 0.5, 0.03); g.color(0xffd23a).box(0.42, 2.3, 0.02, 0.2, 0.2, 0.01); }, 12);
  const drawFlags = () => { flagIM.count = st.flags.length; st.flags.forEach((f, i) => setI(flagIM, i, f[0], T.gridHeight(f[0], f[1]), f[1], i)); flagIM.instanceMatrix.needsUpdate = true; };
  const sandIM = mkIM((g) => { g.color(0xe6cf98); g.box(0, 0.2, 0, 1.3, 0.4, 1.3, { tx: 0.9, tz: 0.9 }); for (const [x, z] of [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]]) { g.push().translate(x, 0, z); g.cyl(7, 0.2, 0.18, 0, 0.7); g.cyl(7, 0.24, 0, 0.7, 1.0); g.pop(); } g.cyl(8, 0.3, 0.26, 0.4, 1.0); g.cyl(8, 0.36, 0, 1.0, 1.45); g.color(0xd8392b).box(0.1, 1.55, 0, 0.2, 0.12, 0.02); }, 8); let sandN = 0;
  const fires = [], fireMesh = [0, 1, 2].map(() => { const g = new GB(63); g.jit = 0.03; BK.campfire(g, 0, 0); const m = new THREE.Mesh(g.build(), MAT.flat); m.visible = false; m.castShadow = true; scene.add(m); return m; });
  const tentMesh = (() => { const g = new GB(64); g.jit = 0.03; BK.tent(g, 0, 0, 0, 0x2f7fd0, 1.2); const m = new THREE.Mesh(g.build(), MAT.flat); m.visible = false; m.castShadow = true; scene.add(m); return m; })(); let tent = null;
  drawFlowers(); drawTrees(); drawFlags();

  // ================= ODAMLAR =================
  const npcs = [], mkMark = () => { const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.2), new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false })); m.position.y = 2.25; return m; };
  const freeSpot = (x, z, r = 0.8) => { const si = T.siteInfo(x, z); if (si.roadD < 2.2 || si.slope > 0.35 || si.y < si.water + 0.4) return false; for (const o of COL.query(x, z, r + 1.5)) { let qx = o.x, qz = o.z; if (o.t === 1) { const sx = o.x2 - o.x, sz = o.z2 - o.z, t = clamp(((x - o.x) * sx + (z - o.z) * sz) / (sx * sx + sz * sz || 1), 0, 1); qx = o.x + sx * t; qz = o.z + sz * t; } if (Math.hypot(x - qx, z - qz) < o.r + r) return false; } return true; };
  { let k = 0; for (const id in site.places) { const p = site.places[id]; if (!p.board) continue; const n = id === 'bogiston' ? 4 : 2;
      for (let q = 0; q < n; q++) for (let t = 0; t < 24; t++) { const a = hash2(k, t, 31) * 6.283, d = 4 + hash2(k, t, 32) * (id === 'bogiston' ? 30 : 9), x = p.board.x + Math.cos(a) * d, z = p.board.z + Math.sin(a) * d; if (!freeSpot(x, z) || npcs.some((o) => Math.hypot(o.x - x, o.z - z) < 2.5)) continue;
        const rig = makeRig(LOOKS[k % LOOKS.length]), mark = mkMark(); rig.root.add(mark); rig.root.visible = false; scene.add(rig.root); const y = T.gridHeight(x, z), yaw = Math.atan2(p.board.x - x, p.board.z - z) + (hash2(k, 5) - 0.5);
        rig.root.position.set(x, y, z); rig.root.rotation.y = yaw; npcs.push({ rig, mark, x, y, z, yaw, yaw0: yaw, name: NAMES[k % NAMES.length], role: ['talk', 'hungry', 'flower', 'lost'][k % 4], cool: 0, place: id, tip: 0, anim: 'idle', waveT: 0 }); k++; break; } } }
  const ROLE_C = { hungry: 0xff5a4a, flower: 0xff7ab8, lost: 0x4fd0ff, wait: 0x9aa0aa, hitch: 0xffe14a };
  const hikers = [0, 1, 2].map((i) => { const rig = makeRig(LOOKS[(i * 3 + 1) % LOOKS.length]), mark = mkMark(); mark.material.color.setHex(ROLE_C.hitch); rig.root.add(mark); rig.root.visible = false; scene.add(rig.root); return { rig, mark, on: false, t: 3 + i * 9, x: 0, y: 0, z: 0, yaw: 0, dest: null, name: NAMES[(i * 5 + 11) % NAMES.length] }; });
  const boards = Object.values(site.places).filter((p) => p.board);
  const spawnHiker = (h) => { const R = T.roads, p = pos(); for (let t = 0; t < 40; t++) { const e = R.edges[(rnd() * R.edges.length) | 0]; if (e.type !== 0) continue; const i = e.start + 10 + ((rnd() * (e.count - 20)) | 0); if (R.bridge[i]) continue; const d = Math.hypot(R.x[i] - p[0], R.z[i] - p[2]); if (d < 220 || d > 1300) continue; const off = e.hw + 2.7, x = R.x[i] - R.tz[i] * off, z = R.z[i] + R.tx[i] * off; if (!freeSpot(x, z, 0.5)) continue;
      const far = boards.filter((b) => Math.hypot(b.x - x, b.z - z) > 550); h.dest = far[(rnd() * far.length) | 0]; h.x = x; h.z = z; h.y = T.gridHeight(x, z); h.yaw = Math.atan2(R.x[i] - x, R.z[i] - z); h.on = true; h.rig.root.position.set(x, h.y, z); h.rig.root.rotation.y = h.yaw; return; } h.t = 10; };

  // ================= HAYVONLAR =================
  const sheepIM = mkIM((g) => { g.color(0xf6f3ea).blob(0.42, 1, { cy: 0.62, sz: 1.35, sy: 0.9, jitter: 0.1 }); g.color(0x2a2c33).box(0, 0.78, 0.6, 0.22, 0.24, 0.3); g.box(0.13, 0.9, 0.52, 0.06, 0.1, 0.05); g.box(-0.13, 0.9, 0.52, 0.06, 0.1, 0.05); for (const [x, z] of [[0.18, 0.3], [-0.18, 0.3], [0.18, -0.3], [-0.18, -0.3]]) g.box(x, 0.18, z, 0.09, 0.36, 0.09); }, 24); const sheep = [];
  for (const [pid, ox, oz] of [['bogiston', 190, -150], ['tegirmon', -95, 80], ['uy', -70, -40]]) { const P0 = site.places[pid]; if (!P0) continue; let cx = P0.x + ox, cz = P0.z + oz; for (let t = 0; t < 30; t++) { const x = P0.x + ox + (hash2(t, 3, 41) - 0.5) * 120, z = P0.z + oz + (hash2(t, 4, 41) - 0.5) * 120, si = T.siteInfo(x, z); if (si.slope < 0.14 && si.roadD > 22 && si.y > si.water + 2 && si.biome === 0) { cx = x; cz = z; break; } }
    for (let i = 0; i < (pid === 'uy' ? 5 : 8); i++) { const a = i * 2.4, d = 3 + i * 1.6; sheep.push({ cx, cz, x: cx + Math.cos(a) * d, z: cz + Math.sin(a) * d, yaw: a, tx: 0, tz: 0, wait: i, v: 0, hop: 0, fed: 0 }); } }
  sheepIM.count = sheep.length;
  const dog = (() => { const grp = new THREE.Group(), g = new GB(65); g.jit = 0.03; g.color(0xc79a66).box(0, 0.42, 0, 0.26, 0.26, 0.62); g.color(0xf2ead8).box(0, 0.4, 0.16, 0.27, 0.2, 0.2); g.color(0xc79a66).box(0, 0.6, 0.38, 0.22, 0.22, 0.24); g.color(0x6e4a30).box(0, 0.56, 0.54, 0.12, 0.1, 0.12); g.box(0.1, 0.74, 0.34, 0.06, 0.12, 0.08); g.box(-0.1, 0.74, 0.34, 0.06, 0.12, 0.08); g.color(0x2a2c33).box(0, 0.6, 0.6, 0.05, 0.04, 0.03); g.color(0xc79a66); for (const [x, z] of [[0.09, 0.22], [-0.09, 0.22], [0.09, -0.22], [-0.09, -0.22]]) g.box(x, 0.15, z, 0.08, 0.3, 0.08); const m = new THREE.Mesh(g.build(), MAT.flat); m.castShadow = true; grp.add(m); const tg = new GB(66); tg.color(0xc79a66).box(0, 0.12, -0.02, 0.06, 0.26, 0.06); const tail = new THREE.Mesh(tg.build(), MAT.flat); tail.position.set(0, 0.5, -0.3); grp.add(tail); grp.visible = false; scene.add(grp); return { grp, tail, x: home.dog[0], z: home.dog[1], yaw: 0, pet: 0, v: 0 }; })();
  const henIM = mkIM((g) => { g.color(0xf2ead8).blob(0.16, 1, { cy: 0.24, sz: 1.2 }); g.blob(0.09, 0, { cy: 0.42, cz: 0.14 }); g.color(0xd8392b).box(0, 0.52, 0.14, 0.03, 0.06, 0.08); g.color(0xf0b83a).box(0, 0.42, 0.24, 0.04, 0.03, 0.06); g.box(0.05, 0.06, 0.02, 0.02, 0.12, 0.02); g.box(-0.05, 0.06, 0.02, 0.02, 0.12, 0.02); }, 5); const hens = [0, 1, 2, 3, 4].map((i) => ({ x: home.coop[0] + i - 2, z: home.coop[1] + 2 + (i % 2), yaw: i, tx: 0, tz: 0, wait: i * 0.7 }));
  // poliz o'simliklari
  const vegIM = mkIM((g) => { g.color(0x4f9e48); for (const [x, z] of [[-0.8, -0.5], [0, -0.5], [0.8, -0.5], [-0.8, 0.5], [0, 0.5], [0.8, 0.5]]) { g.push().translate(x, 0.2, z); g.blob(0.22, 0, { cy: 0.18, sy: 1.2 }); g.color(0xf08a2a).cyl(5, 0.07, 0.02, -0.06, 0.12); g.color(0x4f9e48); g.pop(); } }, 6);
  const BEDT = (i) => (st.home.wat[i] ? 95 : 170);
  const drawBeds = () => { let n = 0; if (st.home.lvl >= 2) for (let i = 0; i < 6; i++) { const t0 = st.home.beds[i]; if (!t0) continue; const k = clamp((st.stats.time - t0) / BEDT(i), 0, 1); setI(vegIM, n++, home.beds[i][0], home.y, home.beds[i][1], home.yaw, 1, 0.25 + 0.75 * k); } vegIM.count = n; vegIM.instanceMatrix.needsUpdate = true; };

  // ================= UY =================
  const applyHome = () => { home.setLevel(st.home.lvl); for (const d of DECOR) home.setDecor(d.id, !!st.home.decor[d.id]); dog.grp.visible = st.home.lvl >= 1; henIM.visible = st.home.lvl >= 2; drawBeds(); };
  L.applyHome = applyHome; applyHome();
  if (!st.home.incT) st.home.incT = st.stats.time; if (!st.home.eggT) st.home.eggT = st.stats.time; if (!st.home.mailT) st.home.mailT = st.stats.time - 500;
  L.income = () => Math.floor(Math.min(3600, st.stats.time - st.home.incT) / 60 * HOME_LEVELS[st.home.lvl].inc);
  L.collectIncome = () => { const n = L.income(); if (n <= 0) return 0; game.addMoney(n); st.home.incT = st.stats.time; sfx('coin'); return n; };
  L.upgradeHome = () => { const nx = HOME_LEVELS[st.home.lvl + 1]; if (!nx || st.money < nx.cost) return false; game.addMoney(-nx.cost); st.home.lvl++; applyHome(); sfx('win'); game.banner('Uy yaxshilandi!', nx.name, 'gold'); sparkle(home.x, home.y + 3, home.z, 0xffe14a, 40); if (pl.onFoot) pl.place(home.gate[0], home.gate[1], home.yaw + Math.PI); game.save(); return true; };
  L.buyDecor = (id) => { const d = DECOR.find((q) => q.id === id); if (!d || st.home.decor[id] || st.money < d.cost) return false; game.addMoney(-d.cost); st.home.decor[id] = 1; applyHome(); sfx('buy'); game.save(); return true; };
  L.sleep = (h) => { game.hour = h; st.sat = 100; st.energy = 100; toast('Yaxshi dam oldingiz — kuch to\'liq tiklandi', 'good'); };
  L.eat = (id) => { const it = ITEMS[id]; if (!it || !it[3] || !(st.inv[id] > 0)) return false; st.inv[id]--; st.sat = Math.min(100, st.sat + it[3]); st.energy = Math.min(st.sat, st.energy + it[3] * 0.7); sfx('eat'); L.count('eat'); return true; };
  L.eatAny = () => { for (const id of ['fruit', 'berry', 'veg', 'bread']) if (st.inv[id] > 0) { L.eat(id); toast(`${ITEMS[id][1]} ${ITEMS[id][0]} yedingiz · to'qlik ${Math.round(st.sat)}%`, 'good'); return; } toast("Yegulik yo'q. Daraxtni silkiting yoki bozordan non oling", 'bad'); };
  L.sellValue = () => { let s = 0; for (const id in ITEMS) if (ITEMS[id][2] > 0) s += (st.inv[id] || 0) * ITEMS[id][2]; return s; };
  L.sellAll = (keepFood) => { let s = 0; for (const id in ITEMS) { if (!(ITEMS[id][2] > 0) || (keepFood && ITEMS[id][3] > 0)) continue; s += (st.inv[id] || 0) * ITEMS[id][2]; st.inv[id] = 0; } if (s > 0) { game.addMoney(s); sfx('buy'); L.count('sell', s); } return s; };

  // ================= HARAKATLAR =================
  const grassOk = (x, z) => { const g = T.ground(x, z, 1e9); return g.surf === SF.GRASS && !g.road && T.gridHeight(x, z) > T.waterY(x, z) + 0.3; };
  const A = {};
  A.pull = () => { const p = pl.p; if (!grassOk(p[0], p[2])) return toast("Bu yerda o't yo'q", 'bad'); pl.act('bend', 1.0, () => { give('hay'); L.count('pull'); sfx('pluck'); fx().burst(8, p[0] + Math.sin(pl.yaw) * 0.5, p[1] + 0.3, p[2] + Math.cos(pl.yaw) * 0.5, 2, 0.7, 0.3, 0x8ed466, 0.9, 1, 4, 0); game.detail.cut && game.detail.cut(p[0] + Math.sin(pl.yaw) * 0.6, p[2] + Math.cos(pl.yaw) * 0.6); if (rnd() < 0.38) { give('seed'); toast("O't yulindi · 🌾 +1 pichan · 🌱 urug' topildi!", 'good'); } else toast("O't yulindi · 🌾 +1 pichan"); }); };
  A.plant = () => { const [x, z] = front(0.7); if (st.inv.seed < 1) return toast("Urug' yo'q. O't yulib toping yoki bozordan oling", 'bad'); if (!grassOk(x, z)) return toast("Gulni faqat o'tloqqa ekish mumkin", 'bad'); pl.act('bend', 1.0, () => { st.inv.seed--; if (st.flowers.length >= 300) st.flowers.shift(); st.flowers.push([+x.toFixed(1), +z.toFixed(1), (rnd() * 6) | 0, Math.round(st.stats.time)]); drawFlowers(); game.addMoney(10); karma(1); L.count('plant'); sfx('pop'); sparkle(x, pl.p[1] + 0.4, z, 0xff8ab0, 8); toast("Gul ekildi 🌸 +10 so'm", 'good'); }); };
  A.sapling = () => { const [x, z] = front(1.2); if (st.inv.sapling < 1) return toast("Ko'chat yo'q — bozordan oling", 'bad'); if (!grassOk(x, z) || !freeSpot(x, z, 1.5)) return toast("Bu yerga ko'chat ekib bo'lmaydi", 'bad'); if (st.trees.length >= 40) return toast("Juda ko'p daraxt ekdingiz (40 ta)", 'bad'); pl.act('swing', 1.6, () => { st.inv.sapling--; st.trees.push([+x.toFixed(1), +z.toFixed(1), Math.round(st.stats.time)]); drawTrees(); karma(2); game.addMoney(25); L.count('tree'); sfx('pop'); toast("Ko'chat ekildi 🌳 5 daqiqada meva daraxti bo'ladi · +25 so'm", 'good'); }, 'shovel'); };
  A.fire = () => { if (st.inv.wood < 3) return toast("Gulxan uchun 3 ta o'tin kerak (o'rmondan yig'ing)", 'bad'); const [x, z] = front(1.3); if (T.gridHeight(x, z) < T.waterY(x, z) + 0.2) return toast('Suvda gulxan yoqib bo\'lmaydi', 'bad'); pl.act('bend', 1.4, () => { st.inv.wood -= 3; const y = T.gridHeight(x, z); let f = fires.find((q) => !q.on); if (!f) { if (fires.length < 3) { f = { mesh: fireMesh[fires.length], on: false }; fires.push(f); } else { f = fires.reduce((a, b) => (a.t < b.t ? a : b)); killFire(f); } }
      f.on = true; f.t = game.time + 300; f.spot = { x, z, y }; f.light = { x, y: y + 1.2, z, hex: 0xff9a40, power: 1.7, on: true }; f.mesh.position.set(x, y, z); f.mesh.visible = true; site.fires.push(f.spot); site.lights.push(f.light); L.count('fire'); sfx('fire'); toast('Gulxan yondi 🔥 Yonida [E] — ovqat pishirish', 'good'); }); };
  const killFire = (f) => { f.on = false; f.mesh.visible = false; let k = site.fires.indexOf(f.spot); if (k >= 0) site.fires.splice(k, 1); k = site.lights.indexOf(f.light); if (k >= 0) site.lights.splice(k, 1); };
  A.tent = () => { if (!st.tools.tent) return toast('Chodir yo\'q — bozordan oling', 'bad'); const [x, z] = front(2.2); pl.act('bend', 1.5, () => { const y = T.gridHeight(x, z); tentMesh.position.set(x, y, z); tentMesh.rotation.y = pl.yaw + Math.PI; tentMesh.visible = true; tent = { x, z }; sfx('pop'); toast('Chodir tikildi ⛺ Yonida [E] — dam olish', 'good'); }); };
  A.snow = () => { const [x, z] = front(1.5); const s = surfAt(x, z); if (s === SF.SNOW || s === SF.ICE) { pl.act('bend', 1.6, () => { if (site.smash.add('snowman', x, z, pl.yaw + Math.PI)) { site.smash.types.snowman.im.instanceMatrix.needsUpdate = true; L.count('snow'); karma(1); sfx('pop'); toast('Qorbobo tayyor ☃️', 'good'); } else toast('Qorbobolar juda ko\'payib ketdi', 'bad'); }); }
    else if (s === SF.SAND) { pl.act('bend', 1.8, () => { setI(sandIM, sandN % 8, x, T.gridHeight(x, z), z, pl.yaw); sandN++; sandIM.count = Math.min(8, sandN); sandIM.instanceMatrix.needsUpdate = true; L.count('sand'); sfx('pop'); toast("Qum qal'asi qurildi 🏰", 'good'); }); }
    else toast("Qorbobo — qorda, qum qal'asi — qumda quriladi", 'bad'); };
  A.flag = () => { const p = pl.p; pl.act('bend', 1.2, () => { if (st.flags.length >= 12) st.flags.shift(); st.flags.push([+p[0].toFixed(1), +p[2].toFixed(1)]); drawFlags(); sfx('pop'); const pk = Math.floor(p[0] / 500) + '_' + Math.floor(p[2] / 500); if (p[1] > 200 && !st.peaks[pk]) { st.peaks[pk] = 1; game.addMoney(250); game.banner("Cho'qqi zabt etildi!", `Balandlik ${Math.round(p[1])} m · +250 so'm`, 'gold'); sfx('win'); } else toast('Bayroq tikildi 🚩 (xaritada ko\'rinadi)', 'good'); }); };
  A.dance = () => { pl.setEmote('dance'); if (pl.emote) L.count('dance'); };
  A.wave = () => { pl.act('wave', 1.6, () => { let n = 0; for (const o of npcs) if (Math.hypot(o.x - pl.p[0], o.z - pl.p[2]) < 14) { o.waveT = 1.6; n++; } if (n) { toast(`${n} kishi sizga qo'l silkidi 👋`, 'good'); L.count('wave'); } }); };
  A.dutor = () => { if (!st.tools.dutor) return toast('Dutor yo\'q — bozordan oling', 'bad'); pl.setEmote('play', 'dutor'); L.noteT = 0; L.tipT = 3; };
  A.whistle = () => { if (!pl.onFoot) return; if (game.damage.wrecked) return toast('Transport ishdan chiqqan — [T] evakuator', 'bad'); if ((L.whT || 0) > game.time) return toast('Biroz kuting…'); L.whT = game.time + 6; sfx('whistle'); pl.act('wave', 0.9, () => { bringCar(); toast('Transportingiz yetib keldi 🚗', 'good'); }); };
  const bringCar = () => { const p = pl.p, nr = T.nearestRoad(p[0], p[2], 6); let x, z, yaw = pl.yaw; if (nr.edge >= 0 && nr.d < 60 && nr.d > 2) { const i = nr.i; x = T.roads.x[i]; z = T.roads.z[i]; yaw = Math.atan2(T.roads.tx[i], T.roads.tz[i]); } else { const d = car.spec.wid / 2 + 1.6; x = p[0] - Math.cos(pl.yaw) * d; z = p[2] + Math.sin(pl.yaw) * d; } if (T.gridHeight(x, z) < T.waterY(x, z)) { x = p[0]; z = p[2]; } car.place(x, z, yaw); game.prevP = car.p.slice(); };
  L.mount = (bring) => { if (!pl.onFoot) return; if (bring && Math.hypot(car.p[0] - pl.p[0], car.p[2] - pl.p[2]) > 9) bringCar(); pl.onFoot = false; pl.rig.root.visible = false; pl.lamp.intensity = 0; pl.sit = false; pl.emote = null; L.fishing = null; bob.visible = false; if (game.carModel.rider) game.carModel.rider.visible = true; game.cam.snap(); sfx('door'); };
  L.dismount = (force) => { if (pl.onFoot) return; if (!force) { if (car.speed > 3.5) return toast("Avval to'xtang!", 'bad'); if (game.act) return toast('Chellenj vaqtida tushib bo\'lmaydi ([X] — bekor qilish)', 'bad'); } const [x, z] = pl.exitSpot(car); pl.place(x, z, car.yaw); pl.onFoot = true; pl.rig.root.visible = true; pl.lock = 0; pl.lockAnim = null; if (game.carModel.rider && !game.carModel.riderAlways) game.carModel.rider.visible = false; game.cam.snap(); sfx('door'); rescan(x, z); };
  L.tryMount = () => { const d = Math.hypot(car.p[0] - pl.p[0], car.p[2] - pl.p[2]); if (d < car.spec.len / 2 + 2.4) L.mount(); else toast('Transport uzoqda. [V] — hushtak chalib chaqirish'); };
  L.fall = () => { if (pl.onFoot) return; L.dismount(true); pl.act('fall', 1.5, null); st.sat = Math.max(30, st.sat - 6); toast('Yiqildingiz! Ehtiyot bo\'ling', 'bad'); };
  L.actions = () => { const s = pl.onFoot ? surfAt(pl.p[0], pl.p[2]) : 0; return [
    ['fire', '🔥', 'Gulxan yoqish', `3 ta o'tin kerak (sizda ${st.inv.wood})`, st.inv.wood >= 3], ['tent', '⛺', 'Chodir tikish', st.tools.tent ? 'Istalgan joyda tunash' : 'Bozordan chodir oling', !!st.tools.tent],
    ['snow', s === SF.SAND ? '🏰' : '☃️', s === SF.SAND ? "Qum qal'asi" : 'Qorbobo yasash', 'Qorda yoki qumda', s === SF.SNOW || s === SF.ICE || s === SF.SAND], ['sapling', '🌳', "Ko'chat ekish", `Sizda ${st.inv.sapling} ta ko'chat`, st.inv.sapling > 0],
    ['flag', '🚩', 'Bayroq tikish', "Cho'qqida tiksangiz — mukofot", true], ['dance', '💃', 'Raqsga tushish', 'Kayfiyat uchun', true], ['dutor', '🎸', 'Dutor chalish', st.tools.dutor ? 'Odamlar pul tashlaydi' : 'Bozordan dutor oling', !!st.tools.dutor],
    ['wave', '👋', 'Salomlashish', "Yaqindagilarga qo'l silkish", true], ['whistle', '🚗', 'Transportni chaqirish', 'Hushtak [V]', true], ['pull', '🌾', "O't yulish", '[Q]', true], ['plant', '🌸', 'Gul ekish', `[G] · urug': ${st.inv.seed}`, st.inv.seed > 0], ['eat', '🍎', 'Ovqatlanish', '[Y]', true]]; };
  L.doAction = (id) => { if (!pl.onFoot) return toast('Avval transportdan tushing [F]'); if (id === 'eat') return L.eatAny(); if (A[id]) A[id](); };

  // --- baliq ovi ---
  const bob = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff4a3a })); bob.visible = false; scene.add(bob);
  const waterAhead = () => { for (const d of [2.5, 4, 5.5, 7, 9, 11]) { const [x, z] = front(d); const wy = T.waterY(x, z); if (wy > T.gridHeight(x, z) + 0.18) return { x, z, y: wy }; } return null; };
  const startFish = (w) => { L.fishing = { ph: 0, t: 2 + rnd() * 5, w }; pl.emote = 'fish'; pl.sit = false; setTool(pl.rig, 'rod'); bob.position.set(w.x, w.y + 0.05, w.z); bob.visible = true; sfx('cast'); toast("Qarmoq tashlandi… Po'kak cho'kkanda [E] bosing!"); };
  const pullFish = () => { const f = L.fishing; if (f.ph === 1) { const r = rnd(), sea = f.w.y < 1; const id = r < 0.06 ? 'gem' : r < 0.3 ? 'bigfish' : 'fish'; give(id); L.count('fish'); sfx('medal'); fx().burst(12, f.w.x, f.w.y + 0.2, f.w.z, 3, 0.7, 0.5, 0xd8f0ff, 0.9, 1.4, 6, 0); const nm = id === 'gem' ? (sea ? 'Marvarid' : 'Yoqut') : id === 'bigfish' ? (sea ? 'Tunets' : 'Katta forel') : sea ? 'Dengiz baliqchasi' : "Zog'ora"; see('fish_' + nm, nm); toast(`${ITEMS[id][1]} ${nm} tutdingiz!`, 'gold'); f.ph = 0; f.t = 2 + rnd() * 5; } else { toast('Erta tortdingiz — baliq hurkib ketdi'); f.t = 2.5 + rnd() * 4; } };

  // ================= [E] — vaziyatga qarab harakat =================
  let ctx = null; // { text, fn }
  const findCtx = () => {
    const p = pl.p, px = p[0], pz = p[2]; let best = null, bd = 1e9;
    const offer = (d, text, fn) => { if (d < bd) { bd = d; best = { text, fn }; } };
    if (L.fishing) return { text: L.fishing.ph === 1 ? '<kbd>E</kbd> TORTING!' : "Baliq kutilmoqda… <kbd>E</kbd> tortish", fn: pullFish };
    // o'z transporti yonida
    { const d = Math.hypot(car.p[0] - px, car.p[2] - pz) - car.spec.len / 2; const dm = game.damage; if (d < 2.2) { const ti = dm.tires.indexOf(1); if (ti >= 0) offer(d + 0.5, '<kbd>E</kbd> Yorilgan balonni almashtirish', () => pl.act('bend', 3, () => { dm.tires[ti] = 0; dm.apply(); sfx('repair'); L.count('tyre'); toast('Balon almashtirildi 🛞', 'good'); })); else if (dm.health < 80 && st.inv.kit > 0 && !dm.wrecked) offer(d + 0.5, "<kbd>E</kbd> Dalada ta'mirlash (🧰)", () => pl.act('swing', 3, () => { st.inv.kit--; dm.repair(35); sfx('repair'); toast("Ta'mirlandi: +35%", 'good'); })); } }
    // terimlar ([E] bilan olinadiganlari)
    for (const a of active) { if (KIND[a.k].auto) continue; const d = Math.hypot(a.x - px, a.z - pz); if (d > 2.1) continue;
      if (a.k === 'berry') offer(d, '<kbd>E</kbd> Rezavor terish', () => pl.act('bend', 0.9, () => { give('berry', 3); takeItem(a, 200); L.count('berry'); see('berry', 'Rezavor'); sfx('pick'); toast('🫐 +3 rezavor', 'good'); }));
      else if (a.k === 'dig') offer(d, st.tools.shovel ? '<kbd>E</kbd> Qazish' : 'Yaltiroq joy — belkurak kerak', () => { if (!st.tools.shovel) return toast('Belkurak kerak — bozordan oling', 'bad'); pl.act('swing', 1.8, () => { takeItem(a, 900); L.count('dig'); const r = rnd(); sfx('medal'); sparkle(a.x, a.y + 0.4, a.z, 0xffe14a, 18); if (r < 0.5) { const n = 40 + ((rnd() * 13) | 0) * 10; game.addMoney(n); toast(`Xazina! +${n} so'm`, 'gold'); } else if (r < 0.75) { give('seed', 3); toast("Eski xaltacha: 🌱 +3 urug'", 'gold'); } else if (r < 0.9) { give('kit'); toast("Ta'mir to'plami topildi 🧰", 'gold'); } else { give('gem'); see('gem', 'Yoqut'); toast('💎 Yoqut topdingiz!', 'gold'); } }, 'shovel'); });
      else if (a.k === 'ore') offer(d, st.tools.pick ? '<kbd>E</kbd> Ruda qazish' : "Ruda toshi — cho'kich kerak", () => { if (!st.tools.pick) return toast("Cho'kich kerak — bozordan oling", 'bad'); pl.act('swing', 1.6, () => { takeItem(a, 400); give('ore'); L.count('ore'); see('ore', 'Ruda'); sfx('hit', 0.5); fx().debris(5, a.x, a.y + 0.3, a.z, [0x5a5560, 0xffb030], 3, 0.16); if (rnd() < 0.1) { give('gem'); toast('🪨 +1 ruda va 💎 yoqut!', 'gold'); } else toast('🪨 +1 ruda', 'good'); }, 'pick'); }); }
    // daraxt silkitish va yo'ldagi tosh
    for (const o of COL.query(px, pz, 2.4)) { const r = o.ref; if (!r || !r.tree || o.dead) continue; const d = Math.hypot(o.x - px, o.z - pz) - o.r; if (d < 1.3) offer(d + 0.3, '<kbd>E</kbd> Daraxtni silkitish', () => shake(r)); }
    { const s = T.bumpNear && T.bumpNear(px, pz, 1.6); if (s) offer(0.2, "<kbd>E</kbd> Toshni yo'ldan olib tashlash", () => pl.act('bend', 1.1, () => { T.removeBump(s); game.addMoney(18); karma(1); L.count('stone'); sfx('pick'); toast("Yo'l tozalandi! +18 so'm", 'good'); })); }
    // odamlar
    for (const o of npcs) { const d = Math.hypot(o.x - px, o.z - pz); if (d < 2.4) offer(d, npcText(o), () => npcUse(o)); }
    for (const s of sheep) { const d = Math.hypot(s.x - px, s.z - pz); if (d < 2) offer(d + 0.2, st.inv.hay > 0 ? "<kbd>E</kbd> Qo'yni boqish (🌾)" : "Qo'y — pichan bo'lsa boqasiz", () => { if (st.inv.hay < 1) return toast("Pichan yo'q — o't yuling [Q]", 'bad'); pl.act('pet', 1, () => { st.inv.hay--; s.hop = 1; s.fed = game.time + 40; game.addMoney(12); karma(1); L.count('feed'); sfx('baa'); hearts(s.x, T.gridHeight(s.x, s.z) + 1.2, s.z); toast("Qo'y to'ydi 🐑 +12 so'm", 'good'); }); }); }
    if (dog.grp.visible) { const d = Math.hypot(dog.x - px, dog.z - pz); if (d < 1.8) offer(d, '<kbd>E</kbd> Olaparni erkalash', () => pl.act('pet', 1.2, () => { sfx('bark'); hearts(dog.x, home.y + 1, dog.z); if (dog.pet < game.time) { dog.pet = game.time + 90; karma(1); L.count('pet'); toast('Olapar xursand 🐕', 'good'); } })); }
    // uy xo'jaligi
    if (st.home.lvl >= 2 && Math.hypot(home.x - px, home.z - pz) < 40) {
      for (let i = 0; i < 6; i++) { const b = home.beds[i], d = Math.hypot(b[0] - px, b[1] - pz); if (d > 2.2) continue; const t0 = st.home.beds[i];
        if (!t0) offer(d, st.inv.seed > 0 ? "<kbd>E</kbd> Jo'yakka urug' ekish" : "Bo'sh jo'yak — urug' kerak", () => { if (st.inv.seed < 1) return toast("Urug' yo'q", 'bad'); pl.act('bend', 1, () => { st.inv.seed--; st.home.beds[i] = Math.max(1, Math.round(st.stats.time)); st.home.wat[i] = 0; drawBeds(); sfx('pop'); toast("Ekildi 🌱 Sug'orsangiz tezroq pishadi"); }); });
        else if (st.stats.time - t0 >= BEDT(i)) offer(d, "<kbd>E</kbd> Hosilni yig'ish 🥕", () => pl.act('bend', 1, () => { const n = st.home.wat[i] ? 3 : 2; give('veg', n); st.home.beds[i] = 0; st.home.wat[i] = 0; drawBeds(); L.count('veg', n); see('veg', 'Sabzavot'); sfx('pick'); toast(`🥕 +${n} sabzavot`, 'good'); }));
        else if (!st.home.wat[i]) offer(d, "<kbd>E</kbd> Sug'orish 💧", () => pl.act('bend', 0.9, () => { st.home.wat[i] = 1; fx().burst(10, b[0], home.y + 0.6, b[1], 2, 0.6, 0.35, 0x9fd8ff, 0.9, 0.6, 6, 0); sfx('splash', 0.3); toast("Sug'orildi 💧"); }));
        else offer(d, `O'smoqda… ${Math.ceil((BEDT(i) - (st.stats.time - t0)) / 60)} daqiqa`, () => {}); }
      { const d = Math.hypot(home.coop[0] - px, home.coop[1] - pz), n = Math.min(6, Math.floor((st.stats.time - st.home.eggT) / 75)); if (d < 2.6) offer(d, n > 0 ? `<kbd>E</kbd> Tuxumlarni yig'ish (${n} ta) 🥚` : 'Tovuqlar hali tuxum qo\'ymagan', () => { if (n < 1) return; give('egg', n); st.home.eggT = st.stats.time; L.count('egg', n); see('egg', 'Tuxum'); sfx('pick'); toast(`🥚 +${n} tuxum`, 'good'); }); }
      { const d = Math.hypot(home.mail[0] - px, home.mail[1] - pz), rdy = st.stats.time - st.home.mailT >= 600; if (d < 2.2) offer(d, rdy ? "<kbd>E</kbd> Pochta qutisini ochish 📬" : `Pochta ${Math.ceil((600 - (st.stats.time - st.home.mailT)) / 60)} daqiqadan keyin keladi`, () => { if (!rdy) return; st.home.mailT = st.stats.time; const r = rnd(); sfx('medal'); if (r < 0.5) { const n = 100 + ((rnd() * 5) | 0) * 50; game.addMoney(n); toast(`Qarindoshlardan pul o'tkazmasi: +${n} so'm 📬`, 'gold'); } else if (r < 0.75) { give('seed', 5); toast("Sovg'a: 🌱 +5 urug' 📬", 'gold'); } else if (r < 0.9) { give('sapling', 2); toast("Sovg'a: 🌳 +2 ko'chat 📬", 'gold'); } else { give('kit'); toast("Sovg'a: 🧰 ta'mir to'plami 📬", 'gold'); } }); }
    }
    // skameyka, quduq, rasta, gulxan, chodir
    for (const s of BK.SPOTS) { const d = Math.hypot(s.x - px, s.z - pz); if (d > 2.6 || Math.abs(s.y - p[1]) > 3) continue;
      if (s.k === 'bench') offer(d + 0.4, "<kbd>E</kbd> O'tirib dam olish", () => { pl.p[0] = s.x + Math.sin(s.yaw) * 0.25; pl.p[2] = s.z + Math.cos(s.yaw) * 0.25; pl.yaw = s.yaw; pl.v[0] = pl.v[2] = 0; pl.sit = true; pl.emote = null; });
      else if (s.k === 'well') offer(d + 0.4, '<kbd>E</kbd> Quduqdan suv ichish', () => { if ((L.wellT || 0) > game.time) return toast('Hozirgina ichdingiz'); L.wellT = game.time + 25; pl.act('bend', 0.9, () => { st.sat = Math.min(100, st.sat + 12); st.energy = Math.min(st.sat, st.energy + 25); sfx('splash', 0.3); toast('Muzdek suv! 💧 Kuch tiklandi', 'good'); }); });
      else if (s.k === 'stall') offer(d + 0.4, '<kbd>E</kbd> Bozor (sotish va xarid)', () => game.ui.open('shop')); }
    const cook = (d) => { const id = ['bigfish', 'fish', 'mush', 'egg'].find((q) => st.inv[q] > 0); offer(d + 0.3, id ? `<kbd>E</kbd> ${ITEMS[id][0]} pishirib yeyish` : 'Gulxan — baliq, qo\'ziqorin yoki tuxum pishiriladi', () => { if (!id) return toast('Pishiradigan narsa yo\'q'); pl.act('bend', 1.6, () => { st.inv[id]--; const v = { bigfish: 85, fish: 55, mush: 34, egg: 30 }[id]; st.sat = Math.min(100, st.sat + v); st.energy = st.sat; L.count('cook'); L.count('eat'); sfx('eat'); toast(`Mazali! 🍽 To'qlik +${v}%`, 'good'); }); }); };
    for (const f of site.fires) { const d = Math.hypot(f.x - px, f.z - pz); if (d < 2.8) cook(d); }
    if (tent) { const d = Math.hypot(tent.x - px, tent.z - pz); if (d < 3.2) offer(d, '<kbd>E</kbd> Chodirda dam olish', () => game.ui.open('rest')); }
    // baliq ovi
    if (!best) { const w = waterAhead(); if (w && !pl.swim) return st.tools.rod ? { text: '<kbd>E</kbd> Baliq ovlash 🎣', fn: () => startFish(w) } : null; }
    return best;
  };
  const shake = (r) => {
    const key = Math.round(r.x) * 7001 + Math.round(r.z); pl.act('shake', 1.0, () => {
      L.count('shake'); const cd = taken.get('t' + key) > game.time; const f = FRUIT[r.tree];
      if (r.tree === 'cactus') { st.energy = Math.max(0, st.energy - 8); return toast('Voy! Kaktus tikani 🌵', 'bad'); }
      if (r.tree === 'dead') { if (cd) return toast('Quruq shoxlar qolmadi'); taken.set('t' + key, game.time + 240); give('wood', 2); L.count('wood', 2); return toast("Quruq shoxlar sindi: 🪵 +2 o'tin", 'good'); }
      if (!f) { if (!cd && rnd() < 0.5) { taken.set('t' + key, game.time + 200); give('seed'); return toast("Daraxtdan urug' tushdi 🌱", 'good'); } return toast('Faqat barglar to\'kildi 🍃'); }
      if (cd) return toast('Bu daraxtda hozircha meva qolmadi');
      taken.set('t' + key, game.time + 180); const n = 1 + ((rnd() * 3) | 0); for (let i = 0; i < n; i++) drop(r.x, r.y + 3.5 * r.s + rnd(), r.z, 'fruit', f[1], f[0]); see('fr_' + f[0], f[0]); toast(`${f[0]} tushdi (${n} ta) — yig'ib oling`, 'good');
    });
    shakes.push({ r, t: 0 }); sfx('rustle'); fx().burst(10, r.x, r.y + 4 * r.s, r.z, 2.5, 1.6, 0.4, r.hex || 0x63b35c, 0.9, 0.2, 2, 0);
  };
  const shakes = [];
  const npcText = (o) => o.role === 'hungry' ? `<kbd>E</kbd> ${o.name}: «Qornim och…» — meva berish` : o.role === 'flower' ? `<kbd>E</kbd> ${o.name}: «Guldasta kerak edi» — 3 ta gul berish` : o.role === 'lost' ? `<kbd>E</kbd> ${o.name}: «Sumkamni yo'qotdim!» — yordam berish` : o.role === 'wait' ? (L.quest && L.quest.got ? `<kbd>E</kbd> Sumkani ${o.name}ga qaytarish` : `${o.name} sumkasini kutmoqda (ko'k nur)`) : `<kbd>E</kbd> ${o.name} bilan gaplashish`;
  const thank = (o, rw, k = 2) => { game.addMoney(rw); karma(k); L.count('gift'); o.role = 'talk'; o.cool = 150 + rnd() * 150; o.waveT = 1.5; sfx('medal'); hearts(o.x, o.y + 2.1, o.z); toast(`${o.name}: «Rahmat, yaxshi odam ekansiz!» +${rw} so'm`, 'gold'); };
  const npcUse = (o) => {
    pl.yaw = Math.atan2(o.x - pl.p[0], o.z - pl.p[2]);
    if (o.role === 'hungry') { const id = ['fruit', 'berry', 'bread', 'veg'].find((q) => st.inv[q] > 0); if (!id) return toast(`${o.name}ga yegulik kerak — sizda yo'q. Daraxtni silkiting!`, 'bad'); st.inv[id]--; thank(o, 60); }
    else if (o.role === 'flower') { if (st.inv.flower < 3) return toast(`Guldasta uchun 3 ta yovvoyi gul kerak (sizda ${st.inv.flower})`, 'bad'); st.inv.flower -= 3; thank(o, 95); }
    else if (o.role === 'lost') { if (L.quest) return toast('Avval boshqa odamning buyumini topib bering'); for (let t = 0; t < 40; t++) { const a = rnd() * 6.283, d = 45 + rnd() * 70, x = o.x + Math.cos(a) * d, z = o.z + Math.sin(a) * d; if (!freeSpot(x, z, 0.5)) continue; const y = T.gridHeight(x, z); L.quest = { npc: o, x, y, z, got: false }; setI(questIM, 0, x, y, z, a); questIM.count = 1; questIM.instanceMatrix.needsUpdate = true; beam.position.set(x, y + 20, z); beam.visible = true; o.role = 'wait'; sfx('check'); return toast(`${o.name}: «Shu atrofda tushib qolgan…» Ko'k nurni qidiring`, 'gold'); } toast('…'); }
    else if (o.role === 'wait') { if (L.quest && L.quest.got && L.quest.npc === o) { L.quest = null; thank(o, 150, 3); } else toast(`${o.name}: «Topdingizmi? Ko'k nur tushgan joyda bo'lsa kerak»`); }
    else { o.waveT = 1.2; L.count('talk'); sfx('click'); if (rnd() < 0.18) { give('seed'); toast(`${o.name}: «Mana, sizga urug'» 🌱 +1`, 'good'); } else toast(`${o.name}: «${TIPS[(o.tip++ + npcs.indexOf(o)) % TIPS.length]}»`); }
  };
  L.useE = () => { if (pl.onFoot) { if (ctx && pl.lock <= 0) ctx.fn(); return; }
    // transportda: yo'lovchini olish
    for (const h of hikers) if (h.on && Math.hypot(h.x - car.p[0], h.z - car.p[2]) < 10 && car.speed < 3) { if (L.fare) return toast("Mashinada allaqachon yo'lovchi bor"); if (game.act) return toast('Avval chellenjni tugating'); h.on = false; h.rig.root.visible = false; h.t = 25 + rnd() * 40; L.fare = { dest: h.dest, name: h.name, d0: Math.hypot(h.dest.x - h.x, h.dest.z - h.z) }; game.setWaypoint(h.dest.board.x, h.dest.board.z, true); sfx('door'); game.banner(`${h.name}: «${h.dest.name}ga eltib qo'ying»`, "Yo'lovchi mashinada. GPS belgilandi", 'start'); return; } };

  // ================= KLAVISHLAR =================
  L.keys = (inp) => {
    if (inp.hit('KeyI')) game.ui.open('bag');
    if (!pl.onFoot) return;
    if (inp.hit('KeyB')) game.ui.open('wheel');
    if (pl.lock > 0) return;
    if (inp.hit('KeyQ')) A.pull(); else if (inp.hit('KeyG')) A.plant(); else if (inp.hit('KeyY')) L.eatAny(); else if (inp.hit('KeyK')) A.sapling(); else if (inp.hit('KeyV')) A.whistle();
    else if (inp.hit('Digit1')) A.dance(); else if (inp.hit('Digit2')) A.dutor(); else if (inp.hit('Digit3')) A.wave();
    if (inp.hit('KeyL')) { pl.lampOn = !pl.lampOn; toast(pl.lampOn ? 'Fonar yoqildi 🔦' : "Fonar o'chirildi"); sfx('click'); }
  };

  // ================= HAR KADR =================
  let scanT = 0, noteI = 0;
  const SCALE = [62, 64, 67, 69, 72, 74, 76, 79];
  L.update = (dt) => {
    const p = pos(), px = p[0], pz = p[2], foot = pl.onFoot, t = game.time, dots = L.dots; dots.length = 0;
    // terimlar
    const ck = Math.floor(px / CELL) * 9973 + Math.floor(pz / CELL); scanT -= dt; if (ck !== cellKey || scanT <= 0) { cellKey = ck; scanT = 20; rescan(px, pz); }
    if (foot) for (let i = active.length - 1; i >= 0; i--) { const a = active[i], K = KIND[a.k]; if (!K.auto) continue; let ax = a.x, az = a.z; if (a.k === 'bfly') { ax += Math.sin(t * 0.8 + a.ph) * 1.6; az += Math.cos(t * 0.7 + a.ph) * 1.6; } const dx = ax - px, dz = az - pz; if (dx * dx + dz * dz > (K.r || 1.25) ** 2) continue;
      takeItem(a, a.k === 'litter' ? 400 : 260); sfx('pick'); sparkle(ax, a.y + 0.5, az, 0xffffff, 5);
      if (a.k === 'litter') { game.addMoney(8); karma(0.34); L.count('litter'); toast("Axlat yig'ildi ♻️ +8 so'm", 'good'); }
      else if (a.k === 'bfly') { const c = (a.ph | 0) % 5, nm = ['Sariq', 'Moviy', 'Pushti', 'Oq', 'Binafsha'][c] + ' kapalak'; L.count('bfly'); game.addMoney(12); see('bf' + c, nm); toast(`🦋 ${nm} tutildi · +12 so'm`, 'good'); }
      else { give(K.inv); L.count(a.k); see(a.k, K.nm); toast(`${ITEMS[K.inv][1]} +1 ${K.nm.toLowerCase()}`, 'good'); } }
    if (dirty) drawItems();
    { let n = 0; const im = ims.bfly; for (const a of active) { if (a.k !== 'bfly' || n >= 36) continue; const x = a.x + Math.sin(t * 0.8 + a.ph) * 1.6, z = a.z + Math.cos(t * 0.7 + a.ph) * 1.6; dummy.position.set(x, a.y + 0.9 + Math.sin(t * 2 + a.ph) * 0.3, z); dummy.rotation.set(0, t * 0.8 + a.ph, 0); dummy.scale.set(1, 0.3 + Math.abs(Math.sin(t * 16 + a.ph)) * 3.2, 1); dummy.updateMatrix(); im.setMatrixAt(n, dummy.matrix); im.setColorAt(n, col.setHex(KIND.bfly.tint[(a.ph | 0) % 5])); n++; } im.count = n; im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; }
    // tushgan mevalar
    { let n = 0; for (let i = drops.length - 1; i >= 0; i--) { const d = drops[i], gy = T.gridHeight(d.x, d.z); d.t += dt; if (d.y > gy) { d.vy -= 14 * dt; d.y += d.vy * dt; if (d.y <= gy) { d.y = gy; if (d.vy < -3) sfx('step', 1); d.vy = 0; } } else d.y = gy;
        if (d.t > 90 || (foot && d.y <= gy + 0.01 && (d.x - px) ** 2 + (d.z - pz) ** 2 < 1.5)) { if (d.t <= 90) { give('fruit'); sfx('pick'); toast(`🍎 +1 ${d.nm.toLowerCase()}`, 'good'); } drops.splice(i, 1); continue; } }
      for (const d of drops) { setI(dropIM, n, d.x, d.y, d.z, d.t); dropIM.setColorAt(n, col.setHex(d.hex)); n++; } dropIM.count = n; dropIM.instanceMatrix.needsUpdate = true; if (dropIM.instanceColor) dropIM.instanceColor.needsUpdate = true; }
    if (L.quest) { const q = L.quest; if (!q.got) { beam.material.opacity = 0.2 + 0.1 * Math.sin(t * 4); dots.push([q.x, q.z, '#4fd0ff']); if (foot && Math.hypot(q.x - px, q.z - pz) < 1.6) { q.got = true; questIM.count = 0; beam.visible = false; sfx('medal'); toast(`Sumka topildi! Endi ${q.npc.name}ga qaytaring`, 'gold'); } } else dots.push([q.npc.x, q.npc.z, '#4fd0ff']); }
    // daraxt silkinishi
    for (let i = shakes.length - 1; i >= 0; i--) { const s = shakes[i], r = s.r; s.t += dt; const k = Math.max(0, 1 - s.t / 1.3), wob = Math.sin(s.t * 24) * 0.07 * k;
      if (r.planted != null) { setI(treeIM, r.planted, r.x, r.y, r.z, r.rot, 1, 1, wob, wob * 0.7); treeIM.instanceMatrix.needsUpdate = true; }
      else if (r.c && r.c.inst && r.c.inst[r.tree]) { const im = r.c.inst[r.tree]; setI(im, r.k, r.x, r.y, r.z, r.rot, r.s, r.s * r.sy, wob, wob * 0.7); im.instanceMatrix.needsUpdate = true; }
      if (k <= 0) shakes.splice(i, 1); }
    // o'sayotgan daraxtlar va polizni vaqti-vaqti bilan yangilash
    L.growT = (L.growT || 0) - dt; if (L.growT <= 0) { L.growT = 2.5; if (st.trees.some((q, i) => !treeCols[i])) drawTrees(); if (st.home.lvl >= 2 && st.home.beds.some(Boolean)) drawBeds(); if (st.flowers.length && st.stats.time - (st.flowers[st.flowers.length - 1][3] || 0) < 30) drawFlowers(); }
    // gulxanlar
    for (const f of fires) if (f.on && f.t < t) killFire(f);
    // odamlar
    for (const o of npcs) { const d = Math.hypot(o.x - px, o.z - pz), vis = d < 150; o.rig.root.visible = vis; if (o.cool > 0) { o.cool -= dt; if (o.cool <= 0 && o.role === 'talk') o.role = ['hungry', 'flower', 'lost', 'talk'][(rnd() * 4) | 0]; }
      if (o.role !== 'talk' && o.role !== 'wait' && d < 450) dots.push([o.x, o.z, o.role === 'hungry' ? '#ff5a4a' : o.role === 'flower' ? '#ff7ab8' : '#4fd0ff']);
      if (!vis) continue; o.mark.visible = o.role !== 'talk'; if (o.mark.visible) { o.mark.material.color.setHex(ROLE_C[o.role]); o.mark.position.y = 2.25 + Math.sin(t * 3 + o.x) * 0.08; o.mark.rotation.y = t * 2; }
      if (o.waveT > 0) o.waveT -= dt; let an = o.waveT > 0 ? 'wave' : 'idle'; if (foot && pl.emote === 'play' && d < 16) an = 'dance';
      if (d < 9) o.yaw += angDiff(Math.atan2(px - o.x, pz - o.z), o.yaw) * Math.min(1, dt * 4); else o.yaw += angDiff(o.yaw0, o.yaw) * Math.min(1, dt * 2); o.rig.root.rotation.y = o.yaw; if (d < 70) poseRig(o.rig, an, dt, 0); }
    for (const h of hikers) { if (!h.on) { h.t -= dt; if (h.t <= 0 && !L.fare) spawnHiker(h); continue; } const d = Math.hypot(h.x - px, h.z - pz); if (d > 1700) { h.on = false; h.rig.root.visible = false; h.t = 5; continue; } h.rig.root.visible = d < 200; dots.push([h.x, h.z, '#ffe14a']); if (d < 200) { h.mark.position.y = 2.25 + Math.sin(t * 3) * 0.1; h.mark.rotation.y = t * 2; if (d < 80) poseRig(h.rig, d < 45 ? 'wave' : 'idle', dt, 0); } }
    if (L.fare) { const f = L.fare, b = f.dest.board; if (!foot && Math.hypot(b.x - car.p[0], b.z - car.p[2]) < 17 && car.speed < 7) { const rw = Math.round(40 + f.d0 * 0.11); game.addMoney(rw); karma(1); L.count('hitch'); L.fare = null; game.setWaypoint(null); sfx('medal'); game.banner("Yo'lovchi manzilda!", `${f.name}: «Katta rahmat!» · +${rw} so'm`, 'gold'); } }
    // qo'ylar
    for (let i = 0; i < sheep.length; i++) { const s = sheep[i]; const dc = Math.hypot(car.p[0] - s.x, car.p[2] - s.z); let run = false;
      if (dc < 13 && car.speed > 2.5) { const a = Math.atan2(s.x - car.p[0], s.z - car.p[2]); s.tx = s.x + Math.sin(a) * 9; s.tz = s.z + Math.cos(a) * 9; s.wait = 0; run = true; if (dc < 2.6) { s.hop = 1; if ((s.baa || 0) < t) { s.baa = t + 2; sfx('baa'); } } }
      else if (s.wait > 0) s.wait -= dt; else if (Math.hypot(s.tx - s.x, s.tz - s.z) < 0.6 || !s.tx) { s.wait = 2 + rnd() * 7; const a = rnd() * 6.283, d = rnd() * 16; s.tx = s.cx + Math.cos(a) * d; s.tz = s.cz + Math.sin(a) * d; }
      if (s.wait <= 0) { const a = Math.atan2(s.tx - s.x, s.tz - s.z); s.yaw += angDiff(a, s.yaw) * Math.min(1, dt * 5); const v = run ? 5.5 : 0.9; s.x += Math.sin(s.yaw) * v * dt; s.z += Math.cos(s.yaw) * v * dt; }
      if (s.hop > 0) s.hop = Math.max(0, s.hop - dt * 2.2); if (Math.abs(s.x - px) < 260 && Math.abs(s.z - pz) < 260) setI(sheepIM, i, s.x, T.gridHeight(s.x, s.z) + Math.sin(s.hop * Math.PI) * 0.7, s.z, s.yaw, 1, 1, s.wait > 3 ? 0.16 : 0); }
    sheepIM.instanceMatrix.needsUpdate = true;
    // kuchuk va tovuqlar
    if (dog.grp.visible) { const near = foot && Math.hypot(px - home.x, pz - home.z) < 90; const gx = near ? px - Math.sin(pl.yaw) * 1.4 + Math.cos(pl.yaw) * 0.8 : home.dog[0], gz = near ? pz - Math.cos(pl.yaw) * 1.4 - Math.sin(pl.yaw) * 0.8 : home.dog[1]; const d = Math.hypot(gx - dog.x, gz - dog.z);
      if (d > 0.5) { const a = Math.atan2(gx - dog.x, gz - dog.z); dog.yaw += angDiff(a, dog.yaw) * Math.min(1, dt * 8); dog.v = Math.min(8, d * 2.2); dog.x += Math.sin(dog.yaw) * dog.v * dt; dog.z += Math.cos(dog.yaw) * dog.v * dt; } else { dog.v = 0; if (near) dog.yaw += angDiff(Math.atan2(px - dog.x, pz - dog.z), dog.yaw) * Math.min(1, dt * 4); }
      dog.grp.position.set(dog.x, T.ground(dog.x, dog.z, 1e9).y + Math.abs(Math.sin(t * 14)) * Math.min(0.12, dog.v * 0.03), dog.z); dog.grp.rotation.y = dog.yaw; dog.tail.rotation.z = Math.sin(t * (near ? 16 : 5)) * 0.6; dog.tail.rotation.x = -0.6; }
    if (henIM.visible && Math.abs(px - home.x) < 200 && Math.abs(pz - home.z) < 200) { hens.forEach((h, i) => { if (h.wait > 0) h.wait -= dt; else if (!h.tx || Math.hypot(h.tx - h.x, h.tz - h.z) < 0.3) { h.wait = 1 + rnd() * 4; const a = rnd() * 6.283, d = 1.5 + rnd() * 3; h.tx = home.coop[0] + Math.cos(a) * d; h.tz = home.coop[1] + 1.5 + Math.sin(a) * d; } else { const a = Math.atan2(h.tx - h.x, h.tz - h.z); h.yaw += angDiff(a, h.yaw) * Math.min(1, dt * 6); h.x += Math.sin(h.yaw) * 1.2 * dt; h.z += Math.cos(h.yaw) * 1.2 * dt; } setI(henIM, i, h.x, home.y + Math.abs(Math.sin(t * 9 + i)) * (h.wait > 0 ? 0 : 0.05), h.z, h.yaw, 1, 1, h.wait > 1.5 ? 0.5 : 0); }); henIM.count = 5; henIM.instanceMatrix.needsUpdate = true; }
    dots.push([home.x, home.z, '#5fd38a', 1]); for (const f of st.flags) dots.push([f[0], f[1], '#ff8a3a']);
    // baliq ovi, dutor, vaziyat
    if (L.fishing) { const f = L.fishing; if (!foot || pl.emote !== 'fish') { L.fishing = null; bob.visible = false; setTool(pl.rig, null); } else { f.t -= dt; if (f.ph === 0) { bob.position.y = f.w.y + 0.05 + Math.sin(t * 2) * 0.03; if (f.t <= 0) { f.ph = 1; f.t = 0.95; sfx('bite'); fx().burst(6, f.w.x, f.w.y + 0.1, f.w.z, 2, 0.5, 0.3, 0xffffff, 0.9, 1.3, 6, 0); } } else { bob.position.y = f.w.y - 0.12 + Math.sin(t * 30) * 0.03; if (f.t <= 0) { f.ph = 0; f.t = 2 + rnd() * 5; toast('Baliq qochib ketdi…'); } } } }
    if (foot && pl.emote === 'play') { L.noteT -= dt; if (L.noteT <= 0) { L.noteT = [0.26, 0.26, 0.52, 0.26][noteI % 4]; noteI += 1 + ((rnd() * 3) | 0); game.audio.note(SCALE[noteI % SCALE.length] + (rnd() < 0.2 ? 12 : 0), 0.4); }
      L.tipT -= dt; if (L.tipT <= 0) { L.tipT = 4; let s = 0; for (const o of npcs) if (Math.hypot(o.x - px, o.z - pz) < 16) s += 4 + ((rnd() * 8) | 0); if (s) { game.addMoney(s); L.count('music', s); sfx('coin'); toast(`Tinglovchilar pul tashladi 🎶 +${s} so'm`, 'gold'); } } }
    ctx = foot && pl.lock <= 0 ? findCtx() : null;
    let pr = ''; if (foot) { if (pl.lock > 0) pr = ''; else if (ctx) pr = ctx.text; else if (Math.hypot(car.p[0] - px, car.p[2] - pz) < car.spec.len / 2 + 2.4) pr = `<kbd>F</kbd> ${game.carModel.v.name}ga chiqish`; }
    else { for (const h of hikers) if (h.on && Math.hypot(h.x - car.p[0], h.z - car.p[2]) < 10 && car.speed < 3 && !L.fare && !game.act) pr = `<kbd>E</kbd> Yo'lovchini olish → ${h.dest.name}`; }
    L.prompt = pr;
  };
  rescan(pos()[0], pos()[2]);
  L._dbg = { get active() { return active; }, drops, npcs, sheep, hikers, fires, dog, spawnHiker };
  return L;
}
