// Ichki makonlar: uy (darajaga qarab xonalar) va do'kon — protsedura devor/mebel, pishirilgan yorug'lik, kirish/chiqish, yopiq joy kamerasi
import * as THREE from 'three';
import * as T from './terrain.js';
import * as COL from './colliders.js';
import { GB } from './geo.js';
import { makeRig, poseRig } from './rig.js';
import { clamp } from './util.js';

// Ichki makonlar orol chetidagi ochiq dengiz ustida turadi: tashqaridan ko'rinmaydi, yer va boshqa narsalar bilan aralashmaydi.
// Yorug'lik materialga "pishirilgan" (MeshBasic + uch ranglari) — sahnaga yangi chiroq qo'shilmaydi, sheyderlar qayta yig'ilmaydi.
export const HOME_O = [2950, 60, 2950], SHOP_O = [2950, 60, 2890];
const WT = 0.12, Q = 0.1; // devor qalinligi, devor katagi (m)
// Uy darajalari: A — yashash xonasining chapi, C — o'ngi, B — yarim chuqurligi, D — yotoqxona chuqurligi, E — o'ng ustun (oshxona/hammom) kengligi
const LV = [
  { tent: 1, h: 2.25, wall: 0x3f8a6a, floor: 0x7a6a52, ceil: 0x4c9a78 },
  { A: 2.6, B: 2.2, C: 2.4, D: 3.0, E: 0, h: 2.6, wall: 0xd2b080, floor: 0x8a5a36, ceil: 0xc49a66, kfloor: 0x9a6a42 },
  { A: 2.8, B: 2.4, C: 2.2, D: 3.4, E: 3.4, bathD: 2.6, h: 2.75, wall: 0xf0e4cc, floor: 0xa8754a, ceil: 0xf6f0e4, kfloor: 0xd8d2c4, bfloor: 0x9fc8d8 },
  { A: 3.2, B: 2.8, C: 2.6, D: 3.8, E: 3.8, bathD: 2.8, h: 2.9, wall: 0xe8e0d0, floor: 0x9a6a42, ceil: 0xf8f4ec, kfloor: 0xe2dccf, bfloor: 0xa8d0de },
  { A: 3.6, B: 3.0, C: 3.0, D: 4.2, E: 4.2, bathD: 3.0, h: 3.1, wall: 0xf6f2ea, floor: 0xded6ca, ceil: 0xfdfbf6, kfloor: 0xece8e0, bfloor: 0xbfdde6, villa: 1 },
];
export const ROOM_NAME = { liv: 'Mehmonxona', kit: 'Oshxona', bath: 'Hammom', bed: 'Yotoqxona', all: 'Chodir', shop: "Do'kon" };

export function initInterior(game) {
  const scene = game.scene, pl = game.player;
  const matIn = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, fog: false });
  const matWin = new THREE.MeshBasicMaterial({ vertexColors: true, fog: false }); // derazalar: kun vaqtiga qarab rangi o'zgaradi
  const matLamp = new THREE.MeshBasicMaterial({ vertexColors: true, fog: false }); // chiroq abajurlari, displeylar
  const tvCan = document.createElement('canvas'); tvCan.width = 256; tvCan.height = 144; const tvX = tvCan.getContext('2d');
  const tvTex = new THREE.CanvasTexture(tvCan); tvTex.colorSpace = THREE.SRGBColorSpace;
  const matTV = new THREE.MeshBasicMaterial({ map: tvTex, fog: false });
  const IN = { inside: null, room: null, lights: true, tvOn: false, tvCh: 0, ret: null, H: null, S: null, X: {} }; // X — boshqa modullar qo'shgan ichki makonlar (hayot2.js: choyxona, kiyim, sartarosh)
  game.interior = IN;

  // ---------- yordamchilar ----------
  const lin = (h) => new THREE.Color(h);
  // pishirilgan yorug'lik: shift chiroqlari (yaqinlik + yo'nalish), sirt yo'nalishi, pol yaqinida qorong'iroq (AO)
  const bake = (geo, lamps, oy, gain = 1) => {
    const P = geo.attributes.position.array, N = geo.attributes.normal.array, C = geo.attributes.color.array;
    for (let i = 0; i < P.length; i += 3) {
      const x = P[i], y = P[i + 1] - oy, z = P[i + 2], nx = N[i], ny = N[i + 1], nz = N[i + 2];
      let f = 0.46 + 0.1 * ny;
      for (const L of lamps) { const dx = L[0] - x, dy = L[1] - y, dz = L[2] - z, d = Math.hypot(dx, dy, dz) || 1; const ndl = Math.max(0, (dx * nx + dy * ny + dz * nz) / d) * 0.7 + 0.3; f += L[3] * ndl / (1 + 0.11 * d * d); }
      f *= 0.8 + 0.2 * clamp(y / 1.1, 0, 1); f = Math.min(1.5, f) * gain;
      C[i] *= f; C[i + 1] *= f; C[i + 2] *= f;
    }
    geo.attributes.color.needsUpdate = true;
  };
  const mesh = (g, mat, grp) => { const m = new THREE.Mesh(g.build(), mat); m.frustumCulled = false; grp.add(m); return m; };

  // ---------- mebel (mahalliy koordinata: old tomon +z, nuqta poldagi markaz) ----------
  const F = {
    rug(g, w, d, c1, c2) { g.color(c1).box(0, 0.008, 0, w, 0.016, d); g.color(c2).box(0, 0.017, 0, w - 0.3, 0.004, d - 0.3); g.color(c1).box(0, 0.02, 0, w - 0.5, 0.004, d - 0.5); g.color(c2).box(0, 0.023, 0, w * 0.3, 0.004, d * 0.3); },
    bed(g, c, frame) { g.color(frame).box(0, 0.2, 0, 1.6, 0.3, 2.1); g.color(frame).box(0, 0.6, -1.02, 1.66, 1.1, 0.08); g.color(0x5a3a26).box(0, 1.08, -0.99, 1.4, 0.12, 0.04);
      g.color(0xf2efe6).box(0, 0.43, 0.02, 1.52, 0.2, 2.0); g.color(0xfbfaf4); for (const sx of [-0.38, 0.38]) g.blob(0.26, 1, { cx: sx, cy: 0.58, cz: -0.78, sy: 0.4, sz: 0.62, shade: 0.06 });
      g.color(c).box(0, 0.555, 0.32, 1.58, 0.07, 1.4); g.color(c).box(0, 0.38, 1.0, 1.6, 0.36, 0.05); for (const sx of [-1, 1]) g.box(sx * 0.795, 0.38, 0.32, 0.03, 0.36, 1.4); g.color(0xffffff).box(0, 0.594, -0.32, 1.58, 0.012, 0.18); },
    cot(g) { g.color(0x4a5a3a).box(0, 0.38, 0, 0.82, 0.08, 1.95); for (const sx of [-0.36, 0.36]) for (const sz of [-0.85, 0.85]) g.color(0x6e6e66).box(sx, 0.17, sz, 0.04, 0.34, 0.04);
      g.color(0x2f5a8a).box(0, 0.47, 0.25, 0.78, 0.1, 1.3); g.color(0xe8e2d0).blob(0.22, 1, { cy: 0.5, cz: -0.68, sy: 0.4, sz: 0.6 }); },
    nightstand(g, frame) { g.color(frame).box(0, 0.28, 0, 0.45, 0.56, 0.4); g.color(0x3d2a1c).box(0, 0.38, 0.205, 0.38, 0.14, 0.01); g.color(0xd8b860).box(0, 0.38, 0.215, 0.06, 0.02, 0.02); },
    clock(g, gl) { g.color(0x2a2c33).box(0, 0.06, 0, 0.18, 0.12, 0.08); gl.color(0xff3a2a).box(0, 0.065, 0.041, 0.13, 0.06, 0.004); g.color(0xb9bec8); for (const sx of [-0.06, 0.06]) g.push().translate(sx, 0, 0).cyl(6, 0.02, 0.02, 0.12, 0.15, { cap: true }).pop(); },
    sofa(g, w, c) { const hw = w / 2; g.color(c).box(0, 0.24, 0.02, w, 0.28, 0.86); g.color(c).box(0, 0.62, -0.33, w, 0.6, 0.22); for (const sx of [-1, 1]) g.box(sx * (hw - 0.09), 0.48, 0.02, 0.18, 0.4, 0.86);
      const k = 0.92; g.color(new THREE.Color(c).multiplyScalar(1.12).getHex()); const n = w > 1.6 ? 3 : 2, cw = (w - 0.36) / n; for (let i = 0; i < n; i++) { const x = -hw + 0.18 + cw * (i + 0.5); g.box(x, 0.44, 0.07, cw - 0.04, 0.12, 0.68); g.blob(cw * 0.42, 1, { cx: x, cy: 0.7, cz: -0.2, sx: 1, sy: 0.75, sz: 0.38, shade: 0.05 }); }
      g.color(0x2a2c33); for (const sx of [-1, 1]) for (const sz of [-0.36, 0.38]) g.box(sx * (hw - 0.08), 0.05, sz, 0.06, 0.1, 0.06); void k; },
    chair(g, c) { g.color(c).box(0, 0.45, 0, 0.44, 0.05, 0.44); for (const sx of [-0.18, 0.18]) for (const sz of [-0.18, 0.18]) g.box(sx, 0.22, sz, 0.04, 0.44, 0.04); g.box(0, 0.75, -0.2, 0.44, 0.46, 0.04); g.color(0xb84a34).box(0, 0.485, 0.01, 0.36, 0.03, 0.36); },
    stool(g, c) { g.color(c).cyl(8, 0.18, 0.18, 0.4, 0.45, { cap: true }); for (let i = 0; i < 3; i++) { const a = i * 2.09; g.box(Math.sin(a) * 0.12, 0.2, Math.cos(a) * 0.12, 0.035, 0.4, 0.035); } },
    table(g, w, d, c, h = 0.76) { g.color(c).box(0, h - 0.025, 0, w, 0.05, d); for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.box(sx * (w / 2 - 0.06), (h - 0.05) / 2, sz * (d / 2 - 0.06), 0.05, h - 0.05, 0.05); },
    cloth(g, w, d, h = 0.76) { g.color(0xf2ead8).box(0, h + 0.004, 0, w + 0.06, 0.006, d + 0.06); g.color(0xd8392b).box(0, h + 0.008, 0, w * 0.5, 0.004, d + 0.07); },
    counter(g, w, top = 0xd8d2c6, body = 0x8a5a36) { g.color(body).box(0, 0.44, 0, w, 0.84, 0.6); g.color(top).box(0, 0.88, 0.01, w + 0.02, 0.05, 0.63); g.color(0x2a2c33).box(0, 0.05, 0.27, w, 0.1, 0.04);
      const n = Math.max(1, Math.round(w / 0.6)); for (let i = 0; i < n; i++) { const x = -w / 2 + w / n * (i + 0.5); g.color(new THREE.Color(body).multiplyScalar(1.1).getHex()).box(x, 0.47, 0.302, w / n - 0.05, 0.66, 0.012); g.color(0xb9bec8).box(x + w / n / 2 - 0.12, 0.7, 0.315, 0.1, 0.02, 0.02); } },
    sink(g) { F.counter(g, 0.9); g.color(0xc8ccd4).box(0, 0.86, 0.02, 0.52, 0.06, 0.4); g.color(0x8a8e98).box(0, 0.88, 0.02, 0.44, 0.02, 0.32); g.color(0xb9bec8).cyl(6, 0.018, 0.018, 0.9, 1.15).box(0, 1.14, -0.05, 0.03, 0.03, 0.22); g.box(0.1, 0.93, -0.2, 0.04, 0.06, 0.04); },
    stove(g) { g.color(0xeeeeea).box(0, 0.45, 0, 0.62, 0.86, 0.6); g.color(0x1d1e22).box(0, 0.885, 0, 0.62, 0.03, 0.6); g.color(0x2a2c33).box(0, 0.45, 0.302, 0.5, 0.36, 0.012); g.color(0xb9bec8).box(0, 0.68, 0.315, 0.44, 0.03, 0.03);
      for (const [x, z] of [[-0.15, -0.14], [0.15, -0.14], [-0.15, 0.14], [0.15, 0.14]]) g.push().translate(x, 0, z).color(0x4a4c52).cyl(10, 0.09, 0.09, 0.9, 0.91, { cap: true }).pop();
      g.color(0x7a7e88).push().translate(-0.15, 0, -0.14).cyl(10, 0.13, 0.12, 0.91, 1.08, { cap: true }).color(0x2a2c33).box(0.16, 1.02, 0, 0.12, 0.02, 0.03).pop();
      g.color(0x1d1e22); for (let i = 0; i < 4; i++) g.box(-0.21 + i * 0.14, 0.83, 0.305, 0.05, 0.05, 0.02); },
    campStove(g) { g.color(0x8a5a36).box(0, 0.32, 0, 0.6, 0.64, 0.45); g.color(0x5a3a26).box(0, 0.33, 0.228, 0.5, 0.04, 0.01); g.color(0x3a3c42).box(0, 0.68, 0, 0.36, 0.08, 0.3); g.color(0x7a7e88).cyl(10, 0.12, 0.11, 0.72, 0.86, { cap: true }); g.color(0x2f7fd0).push().translate(0.22, 0, 0).cyl(8, 0.06, 0.06, 0.64, 0.86, { cap: true }).pop(); },
    fridge(g, c = 0xe8eaee) { g.color(c).box(0, 0.9, 0, 0.7, 1.8, 0.66); g.color(0x9aa0aa).box(0, 1.22, 0.335, 0.68, 0.012, 0.01); g.color(0xb9bec8).box(0.27, 1.45, 0.35, 0.03, 0.3, 0.03); g.box(0.27, 0.85, 0.35, 0.03, 0.4, 0.03);
      g.color(0xff8a3a).box(-0.18, 1.6, 0.336, 0.08, 0.08, 0.005); g.color(0x4fb0ff).box(-0.08, 1.55, 0.336, 0.07, 0.1, 0.005); },
    coolbox(g) { g.color(0x2f7fd0).box(0, 0.22, 0, 0.7, 0.4, 0.45); g.color(0xf2f2ee).box(0, 0.45, 0, 0.72, 0.08, 0.47); g.color(0x2a2c33).box(0, 0.5, 0, 0.4, 0.03, 0.06); },
    jug(g) { g.color(0x8a5a36).box(0, 0.3, 0, 0.5, 0.6, 0.4); g.color(0x4fb0ff).cyl(10, 0.17, 0.17, 0.6, 1.05, { cap: true }); g.color(0x2f7fd0).box(0, 0.68, 0.18, 0.06, 0.06, 0.08); },
    wardrobe(g, w, c) { g.color(c).box(0, 1.0, 0, w, 2.0, 0.58); g.color(new THREE.Color(c).multiplyScalar(1.12).getHex()); for (const sx of [-1, 1]) g.box(sx * w / 4, 1.0, 0.292, w / 2 - 0.04, 1.86, 0.012); g.color(0xd8b860); for (const sx of [-1, 1]) g.box(sx * 0.05, 1.05, 0.31, 0.02, 0.2, 0.02); },
    shelf(g, w, c, books) { g.color(c); g.box(0, 0.95, -0.14, w, 1.9, 0.03); for (const sx of [-1, 1]) g.box(sx * (w / 2 - 0.015), 0.95, 0, 0.03, 1.9, 0.3); for (let k = 0; k < 5; k++) g.box(0, 0.03 + k * 0.45, 0, w, 0.03, 0.3);
      if (books) for (let k = 0; k < 4; k++) { let x = -w / 2 + 0.05; let i = 0; while (x < w / 2 - 0.1) { const bw = 0.04 + ((k * 7 + i * 3) % 4) * 0.012, bh = 0.24 + ((k + i * 5) % 5) * 0.03; g.color(books[(k * 3 + i) % books.length]).box(x + bw / 2, 0.05 + k * 0.45 + bh / 2, 0, bw, bh, 0.22); x += bw + 0.008; i++; } } },
    plant(g, big) { const s = big ? 1.4 : 1; g.color(0xb85a34).cyl(8, 0.16 * s, 0.12 * s, 0, 0.34 * s, { cap: true }); g.color(0x3f9a58); for (let i = 0; i < 6; i++) { const a = i * 1.05; g.blob(0.16 * s, 1, { cx: Math.sin(a) * 0.1 * s, cy: (0.55 + (i % 3) * 0.16) * s, cz: Math.cos(a) * 0.1 * s, sy: 1.5, sx: 0.55, jitter: 0.1 }); } },
    floorLamp(g, gl) { g.color(0x2a2c33).cyl(8, 0.16, 0.16, 0, 0.03, { cap: true }); g.cyl(6, 0.015, 0.015, 0.03, 1.45); gl.color(0xfff0c8).cyl(10, 0.2, 0.13, 1.35, 1.65); },
    ceilLamp(gl, h) { gl.color(0xfff4d8).blob(0.2, 1, { cy: h - 0.18, sy: 0.55 }); gl.color(0xfff8e8).cyl(6, 0.012, 0.012, h - 0.12, h); },
    tvStand(g, c) { g.color(c).box(0, 0.24, 0, 1.5, 0.48, 0.42); g.color(0x2a2c33).box(0, 0.24, 0.212, 1.3, 0.3, 0.01); g.color(0x1a1b1f).box(0, 0.92, -0.06, 1.22, 0.74, 0.06); g.color(0x2a2c33).box(0, 0.51, -0.06, 0.3, 0.06, 0.2); g.color(0x3a3c42).box(0, 0.6, -0.06, 0.06, 0.16, 0.04); },
    coffee(g, c) { F.table(g, 1.0, 0.56, c, 0.42); },
    toilet(g) { g.color(0xf6f6f2).box(0, 0.2, 0.05, 0.38, 0.4, 0.5); g.box(0, 0.6, -0.2, 0.42, 0.4, 0.18); g.color(0xe8e8e2).box(0, 0.42, 0.08, 0.4, 0.04, 0.48); },
    shower(g, gl) { g.color(0xeef2f4).box(0, 0.05, 0, 0.95, 0.1, 0.95); g.color(0xa8d8e8); for (const [x, z, w, d] of [[0.47, 0, 0.02, 0.95], [0, 0.47, 0.95, 0.02]]) g.box(x, 1.05, z, w, 1.9, d); g.color(0xb9bec8).box(-0.38, 1.95, -0.38, 0.03, 0.4, 0.03); g.box(-0.3, 2.12, -0.3, 0.2, 0.03, 0.2); g.color(0x8a8e98).cyl(10, 0.09, 0.09, 2.06, 2.1, { cap: true }).translate(0, 0, 0); void gl; },
    mirror(g, gl) { g.color(0x8a8e98).box(0, 1.55, -0.02, 0.62, 0.82, 0.03); gl.color(0xc8dcea).box(0, 1.55, 0.0, 0.54, 0.74, 0.01); },
    desk(g, c) { F.table(g, 1.1, 0.55, c, 0.75); g.color(0x2a2c33).box(0, 0.76, 0.02, 0.36, 0.02, 0.26); g.color(0x3a3c42).push().translate(0, 0.77, -0.11).rotX(-0.3).box(0, 0.12, 0, 0.36, 0.24, 0.015).pop(); g.color(0xf2ead8).box(-0.35, 0.765, 0.05, 0.2, 0.02, 0.26); },
    kettle(g) { g.color(0xc8ccd4).cyl(10, 0.09, 0.075, 0.9, 1.08, { cap: true }); g.color(0x2a2c33).box(0, 1.1, 0, 0.12, 0.02, 0.03); g.color(0xc8ccd4).push().translate(0.1, 1.0, 0).rotZ(-0.9).cyl(5, 0.015, 0.01, 0, 0.1).pop(); g.color(0x3f9a58).push().translate(-0.18, 0, 0.05).cyl(8, 0.045, 0.04, 0.9, 0.98, { cap: true }).pop(); },
    paper(g) { g.color(0xf2efe4).box(0, 0.433, 0, 0.32, 0.012, 0.24); g.color(0x3a3d46).box(0, 0.44, -0.07, 0.26, 0.004, 0.05); g.color(0x9a9da6).box(0, 0.44, 0.04, 0.26, 0.004, 0.11); },
    frame(g, w, h, c) { g.color(0x5a3a26).box(0, 0, 0, w, h, 0.03); g.color(c).box(0, 0, 0.016, w - 0.08, h - 0.08, 0.004); g.color(0xffe08a).box(w * 0.15, h * 0.12, 0.019, w * 0.2, h * 0.2, 0.003); g.color(0x3f9a58).box(-w * 0.1, -h * 0.18, 0.019, w * 0.5, h * 0.18, 0.003); },
    switchPlate(g, gl) { g.color(0xf6f6f2).box(0, 1.25, 0, 0.09, 0.13, 0.02); gl.color(0xffd23a).box(0, 1.27, 0.011, 0.03, 0.04, 0.004); },
    lantern(g, gl) { g.color(0x2a2c33).cyl(6, 0.08, 0.08, 0, 0.04, { cap: true }); g.cyl(6, 0.015, 0.015, 0.25, 0.32); gl.color(0xffc870).cyl(8, 0.07, 0.07, 0.04, 0.25); },
    crate(g) { g.color(0x9a6a42).box(0, 0.25, 0, 0.6, 0.5, 0.5); g.color(0x7a4e2e); g.box(0, 0.25, 0.252, 0.6, 0.06, 0.01); g.box(0, 0.25, -0.252, 0.6, 0.06, 0.01); },
    radio(g) { g.color(0x8a5a36).box(0, 0.09, 0, 0.3, 0.18, 0.12); g.color(0xe2d2b4).box(-0.06, 0.09, 0.061, 0.14, 0.12, 0.004); g.color(0x2a2c33).cyl(6, 0.02, 0.02, 0.18, 0.4); },
  };

  // ---------- xona tuzuvchi ----------
  // rooms: [{t, x0, z0, x1, z1, floor}], doors: [{ax:'x'|'z', c, a, b, exit}] (ax='z' — devor z=c chizig'ida, x bo'ylab a..b)
  const buildShell = (I, g, gw, gl, rooms, doors, h, wallC, ceilC, o) => {
    const lines = new Map(), room2 = new Map();
    const put = (ax, c, a, b, ri) => { const key = ax + ':' + Math.round(c / Q); let m = lines.get(key); if (!m) lines.set(key, (m = new Map())); for (let k = Math.round(a / Q); k < Math.round(b / Q); k++) { m.set(k, (m.get(k) || 0) + 1); room2.set(key + ':' + k, ri); } };
    rooms.forEach((r, ri) => { put('z', r.z0, r.x0, r.x1, ri); put('z', r.z1, r.x0, r.x1, ri); put('x', r.x0, r.z0, r.z1, ri); put('x', r.x1, r.z0, r.z1, ri); });
    const isDoor = (ax, c, k) => doors.find((d) => d.ax === ax && Math.abs(d.c - c) < 0.05 && (k + 0.5) * Q > d.a && (k + 0.5) * Q < d.b);
    const segs = [];
    for (const [key, m] of lines) { const [ax, cs] = key.split(':'), c = +cs * Q, ks = [...m.keys()].sort((a, b) => a - b); let run = null;
      const flush = () => { if (run) segs.push(run); run = null; };
      for (const k of ks) { if (isDoor(ax, c, k)) { flush(); continue; } const ext = m.get(k) === 1; if (run && run.k1 === k && run.ext === ext) run.k1 = k + 1; else { flush(); run = { ax, c, k0: k, k1: k + 1, ext, ri: room2.get(key + ':' + k) }; } } flush(); }
    const wallBox = (ax, c, a, b, y0, y1, col, th = WT) => { g.color(col); if (ax === 'z') g.box((a + b) / 2, (y0 + y1) / 2, c, b - a, y1 - y0, th); else g.box(c, (y0 + y1) / 2, (a + b) / 2, th, y1 - y0, b - a); };
    for (const s of segs) { const a = s.k0 * Q, b = s.k1 * Q;
      wallBox(s.ax, s.c, a, b, 0, h, wallC); wallBox(s.ax, s.c, a, b, 0, 0.1, 0x5a3a26, WT + 0.03);
      const wx = (v) => (s.ax === 'z' ? v : s.c), wz = (v) => (s.ax === 'z' ? s.c : v);
      I.cols.push(COL.addSeg(o[0] + wx(a), o[2] + wz(a), o[0] + wx(b), o[2] + wz(b), WT / 2 + 0.02, o[1] - 0.5, o[1] + h));
      // deraza: tashqi devorda, yetarlicha uzun bo'lsa — o'rtasida (ikki tomonga pishirilgan yorug' panel)
      if (s.ext && b - a >= 1.8 && !s.noWin) { const r = rooms[s.ri], m = (a + b) / 2, ww = Math.min(1.5, b - a - 0.7), sideIn = s.ax === 'z' ? Math.sign((r.z0 + r.z1) / 2 - s.c) : Math.sign((r.x0 + r.x1) / 2 - s.c);
        if (r.t === 'bath' || r.t === 'shop') continue;
        const pane = (off) => { gw.color(0xffffff); if (s.ax === 'z') gw.box(m, 1.5, s.c + off, ww, 1.05, 0.01); else gw.box(s.c + off, 1.5, m, 0.01, 1.05, ww); };
        pane(sideIn * (WT / 2 + 0.006)); pane(-sideIn * (WT / 2 + 0.006));
        const fr = (dx, dy, w2, h2) => { g.color(0xf6f6f2); if (s.ax === 'z') g.box(m + dx, dy, s.c + sideIn * (WT / 2 + 0.02), w2, h2, 0.04); else g.box(s.c + sideIn * (WT / 2 + 0.02), dy, m + dx, 0.04, h2, w2); };
        fr(0, 0.95, ww + 0.16, 0.07); fr(0, 2.05, ww + 0.16, 0.07); fr(-ww / 2 - 0.04, 1.5, 0.07, 1.15); fr(ww / 2 + 0.04, 1.5, 0.07, 1.15); fr(0, 1.5, 0.04, 1.05); fr(0, 0.92, ww + 0.3, 0.04);
        const cur = new THREE.Color(I.curtain || 0xc84a3a); // parda: burmali (uch tasma), ustida tayoq
        for (const sd of [-1, 1]) for (let f = 0; f < 3; f++) { g.color(cur.clone().multiplyScalar(f === 1 ? 0.82 : 1).getHex()); const along = m + sd * (ww / 2 + 0.08 + f * 0.1), dep = WT / 2 + 0.05 + (f === 1 ? 0.03 : 0); if (s.ax === 'z') g.box(along, 1.5, s.c + sideIn * dep, 0.11, 1.55, 0.03); else g.box(s.c + sideIn * dep, 1.5, along, 0.03, 1.55, 0.11); }
        g.color(0x6e4a30); if (s.ax === 'z') g.box(m, 2.3, s.c + sideIn * (WT / 2 + 0.07), ww + 0.8, 0.035, 0.035); else g.box(s.c + sideIn * (WT / 2 + 0.07), 2.3, m, 0.035, 0.035, ww + 0.8);
        I.lampsW.push([o[0] + wx(m) + (s.ax === 'x' ? sideIn * 0.8 : 0), o[1] + 1.6, o[2] + wz(m) + (s.ax === 'z' ? sideIn * 0.8 : 0)]); }
    }
    // eshik o'rinlari: ustidagi devor bo'lagi, rom; chiqish eshigi — yopiq eshik tabaqasi
    for (const d of doors) { const L = d.b - d.a; wallBox(d.ax, d.c, d.a, d.b, 2.15, h, wallC);
      const post = (v) => { g.color(0x6e4a30); if (d.ax === 'z') g.box(v, 1.08, d.c, 0.07, 2.16, WT + 0.06); else g.box(d.c, 1.08, v, WT + 0.06, 2.16, 0.07); };
      post(d.a); post(d.b); g.color(0x6e4a30); if (d.ax === 'z') g.box((d.a + d.b) / 2, 2.17, d.c, L + 0.07, 0.07, WT + 0.06); else g.box(d.c, 2.17, (d.a + d.b) / 2, WT + 0.06, 0.07, L + 0.07);
      if (d.exit) { g.color(0x8a5a36); if (d.ax === 'z') g.box((d.a + d.b) / 2, 1.06, d.c, L - 0.04, 2.1, 0.05); else g.box(d.c, 1.06, (d.a + d.b) / 2, 0.05, 2.1, L - 0.04);
        g.color(0x6a4228); for (const yy of [0.62, 1.5]) { if (d.ax === 'z') g.box((d.a + d.b) / 2, yy, d.c, L - 0.3, 0.6, 0.07); else g.box(d.c, yy, (d.a + d.b) / 2, 0.07, 0.6, L - 0.3); }
        g.color(0xd8b860); if (d.ax === 'z') g.box(d.b - 0.14, 1.0, d.c, 0.05, 0.05, 0.12); else g.box(d.c, 1.0, d.b - 0.14, 0.12, 0.05, 0.05);
        I.cols.push(d.ax === 'z' ? COL.addSeg(o[0] + d.a, o[2] + d.c, o[0] + d.b, o[2] + d.c, 0.08, o[1] - 0.5, o[1] + h) : COL.addSeg(o[0] + d.c, o[2] + d.a, o[0] + d.c, o[2] + d.b, 0.08, o[1] - 0.5, o[1] + h)); } }
    // pol (xona bo'yicha), taxta chiziqlari, ship
    let X0 = 1e9, Z0 = 1e9, X1 = -1e9, Z1 = -1e9;
    for (const r of rooms) { X0 = Math.min(X0, r.x0); Z0 = Math.min(Z0, r.z0); X1 = Math.max(X1, r.x1); Z1 = Math.max(Z1, r.z1);
      g.color(r.floor).box((r.x0 + r.x1) / 2, -0.05, (r.z0 + r.z1) / 2, r.x1 - r.x0, 0.1, r.z1 - r.z0);
      const tile = r.t === 'bath' || r.t === 'kit' || r.t === 'shop'; const dk = new THREE.Color(r.floor).multiplyScalar(tile ? 0.86 : 0.8).getHex();
      if (tile) { for (let x = r.x0 + 0.4; x < r.x1 - 0.05; x += 0.4) g.color(dk).box(x, 0.002, (r.z0 + r.z1) / 2, 0.012, 0.004, r.z1 - r.z0); for (let z = r.z0 + 0.4; z < r.z1 - 0.05; z += 0.4) g.color(dk).box((r.x0 + r.x1) / 2, 0.002, z, r.x1 - r.x0, 0.004, 0.012); }
      else for (let x = r.x0 + 0.2; x < r.x1 - 0.05; x += 0.2) g.color(dk).box(x, 0.002, (r.z0 + r.z1) / 2, 0.01, 0.004, r.z1 - r.z0); }
    g.color(ceilC).box((X0 + X1) / 2, h + 0.05, (Z0 + Z1) / 2, X1 - X0 + 0.3, 0.1, Z1 - Z0 + 0.3);
    I.box = [X0, Z0, X1, Z1];
  };
  // mebel qo'yish: mahalliy (x, z, yaw) — fn(g, gl) mebelni chizadi; col — to'qnashuv qutisi [yarim x, yarim z] (mebel koordinatasida)
  const putF = (I, g, gl, x, z, yaw, fn, col, o) => { g.push().translate(x, 0, z).rotY(yaw); gl.push().translate(x, 0, z).rotY(yaw); fn(g, gl); g.pop(); gl.pop();
    if (col) { const c = Math.cos(yaw), s = Math.sin(yaw), P = (lx, lz) => [o[0] + x + lx * c + lz * s, o[2] + z - lx * s + lz * c], hx = col[0], hz = col[1], y1 = o[1] + (col[2] || 1.2);
      const A = P(-hx, -hz), B = P(hx, -hz), C = P(hx, hz), D = P(-hx, hz); for (const [p, q] of [[A, B], [B, C], [C, D], [D, A]]) I.cols.push(COL.addSeg(p[0], p[1], q[0], q[1], 0.05, o[1] - 0.5, y1)); } };
  const spot = (I, k, x, z, yaw, extra) => { const o = I.o; const sp = Object.assign({ k, x: o[0] + x, z: o[2] + z, lx: x, lz: z, yaw, r: 1.25 }, extra); I.spots.push(sp); return sp; };

  const clearI = (I) => { for (const c of I.cols) c.dead = true; I.cols = []; I.spots = []; I.lampsW = []; while (I.grp.children.length) { const m = I.grp.children.pop(); m.geometry && m.geometry.dispose(); } if (I.patch) { const k = T.patches.indexOf(I.patch); if (k >= 0) T.patches.splice(k, 1); I.patch = null; } };
  const finish = (I, g, gw, gl, lamps, gain = 1) => {
    const o = I.o; const m1 = mesh(g, matIn, I.grp); bake(m1.geometry, lamps.map((L) => [o[0] + L[0], L[1], o[2] + L[2], L[3]]).concat(I.lampsW.map((w) => [w[0], w[1] - o[1], w[2], 0.25])), o[1], gain);
    mesh(gw, matWin, I.grp); mesh(gl, matLamp, I.grp);
    const b = I.box; I.patch = T.addPatch(o[0] + (b[0] + b[2]) / 2, o[2] + (b[1] + b[3]) / 2, 0, b[3] - b[1] + 0.6, b[2] - b[0] + 0.6, o[1], o[1], T.SURF.WOOD);
  };
  const newGB = (seed, o) => { const g = new GB(seed); g.jit = 0.012; g.translate(o[0], o[1], o[2]); return g; };

  // ================= UY =================
  const H = (IN.H = { o: HOME_O, grp: new THREE.Group(), cols: [], spots: [], lampsW: [], rooms: [], lvl: -1, patch: null, tv: null });
  const S = (IN.S = { o: SHOP_O, grp: new THREE.Group(), cols: [], spots: [], lampsW: [], rooms: [], patch: null });
  scene.add(H.grp); scene.add(S.grp);
  const tvMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.12, 0.64), matTV); tvMesh.visible = false; tvMesh.frustumCulled = false; scene.add(tvMesh);
  const buildHome = (lvl) => {
    const I = H, o = H.o; clearI(I); I.lvl = lvl; const L = LV[lvl], g = newGB(901 + lvl, o), gw = newGB(902, o), gl = newGB(903, o); I.curtain = [0xc84a3a, 0xc84a3a, 0x3d74a6, 0x8a5a36, 0x6a8a5a][lvl]; I.h = L.h;
    const lamps = []; let rooms, doors;
    const wood = lvl >= 3 ? 0x6e4a30 : 0x8a5a36, fab = [0x3a6ea8, 0x7a4e2e, 0x3d74a6, 0x5a6a7a, 0xd8d0c4][lvl];
    if (L.tent) {
      rooms = [{ t: 'all', x0: -1.9, z0: -1.9, x1: 1.9, z1: 1.9, floor: L.floor }]; doors = [{ ax: 'z', c: -1.9, a: -0.5, b: 0.5, exit: 1 }];
      buildShell(I, g, gw, gl, rooms, doors, L.h, L.wall, L.ceil, o);
      g.color(0x2f6a50); for (const x of [-1.9, 1.9]) g.box(x, L.h / 2, 0, 0.14, L.h, 0.14); // chodir ustunlari
      putF(I, g, gl, -1.3, 0.8, 0, (q) => F.cot(q), [0.42, 1.0, 0.6], o); spot(I, 'bed', -0.7, 0.8, -Math.PI / 2, { bed: [-1.3, 0.8, Math.PI] });
      putF(I, g, gl, 0.0, -1.2, Math.PI / 2, (q) => F.rug(q, 1.2, 1.6, 0xb84a34, 0xf0b83a), null, o);
      putF(I, g, gl, 1.45, 1.35, Math.PI, (q) => F.campStove(q), [0.32, 0.25, 1], o); spot(I, 'stove', 1.45, 0.75, 0);
      putF(I, g, gl, 1.45, 0.3, -Math.PI / 2, (q) => F.jug(q), [0.25, 0.22, 1], o); spot(I, 'tap', 0.95, 0.3, Math.PI / 2);
      putF(I, g, gl, 1.45, -0.7, -Math.PI / 2, (q) => F.coolbox(q), [0.36, 0.24, 0.6], o); spot(I, 'fridge', 0.95, -0.7, Math.PI / 2);
      putF(I, g, gl, -0.2, 1.45, Math.PI, (q, ql) => { F.crate(q); q.translate(0.15, 0.5, 0); F.lantern(q, ql.translate(0.15, 0.5, 0)); }, [0.32, 0.27, 0.6], o);
      putF(I, g, gl, -0.2, 0.75, Math.PI, (q) => F.stool(q, 0x8a5a36), null, o); spot(I, 'sit', -0.2, 0.85, Math.PI, { table: [-0.2, 1.45] });
      putF(I, g, gl, -1.45, -1.3, Math.PI / 2, (q) => F.crate(q), [0.3, 0.27, 0.6], o); putF(I, g, gl, -1.45, -1.3, Math.PI / 2, (q) => { q.translate(0, 0.5, 0); F.radio(q); }, null, o); spot(I, 'desk', -0.9, -1.3, -Math.PI / 2);
      putF(I, g, gl, 0, 0, 0, (q, ql) => F.ceilLamp(ql, L.h), null, o);
      putF(I, g, gl, 0.6, -1.9 + 0.07, 0, (q, ql) => F.switchPlate(q, ql), null, o); spot(I, 'switch', 0.7, -1.5, Math.PI, { room: 0 });
      spot(I, 'door', 0, -1.55, Math.PI); lamps.push([0, L.h - 0.3, 0, 1.0]);
      I.entry = [0, -1.3, 0];
    } else {
      const { A, B, C, D, E, h } = L, bathD = L.bathD || 0, Z1 = B + D;
      rooms = [{ t: 'liv', x0: -A, z0: -B, x1: C, z1: B, floor: L.floor }, { t: 'bed', x0: -A, z0: B, x1: C, z1: Z1, floor: L.floor }];
      doors = [{ ax: 'z', c: -B, a: -A + 0.7, b: -A + 1.7, exit: 1 }, { ax: 'z', c: B, a: -A + 0.9, b: -A + 1.9 }];
      if (E) { rooms.push({ t: 'kit', x0: C, z0: -B + bathD, x1: C + E, z1: Z1, floor: L.kfloor }, { t: 'bath', x0: C, z0: -B, x1: C + E, z1: -B + bathD, floor: L.bfloor });
        const zk = (-B + bathD + B) / 2; doors.push({ ax: 'x', c: C, a: zk - 0.5, b: zk + 0.5 }, { ax: 'x', c: C, a: -B + bathD / 2 - 0.45, b: -B + bathD / 2 + 0.45 }); }
      buildShell(I, g, gw, gl, rooms, doors, h, L.wall, L.ceil, o);
      // --- mehmonxona ---
      const sx = (C - A) / 2 + 0.9, sofaW = Math.min(2.2, A + C - 2.6);
      putF(I, g, gl, sx, B - 0.5, Math.PI, (q) => F.sofa(q, sofaW, fab), [sofaW / 2, 0.42, 0.9], o);
      for (const k of [-0.25, 0.25]) spot(I, 'sit', sx + k * sofaW, B - 0.55, Math.PI, { sofa: 1, r: 1.0 });
      putF(I, g, gl, sx, 0.1, 0, (q) => F.rug(q, Math.min(2.6, sofaW + 0.6), 2.0, lvl >= 4 ? 0x7a8a9a : 0xb84a34, lvl >= 4 ? 0xe6dccb : 0xf0b83a), null, o);
      putF(I, g, gl, sx, 0.75, 0, (q) => F.coffee(q, wood), [0.52, 0.3, 0.45], o); putF(I, g, gl, sx + 0.15, 0.75, 0.3, (q) => F.paper(q), null, o); spot(I, 'paper', sx + 0.15, 1.15, Math.PI, { r: 1.0 });
      if (lvl >= 2) { putF(I, g, gl, sx, -B + 0.24, 0, (q) => F.tvStand(q, wood), [0.75, 0.22, 1.3], o); spot(I, 'tv', sx, -B + 1.0, Math.PI, { r: 1.1 }); I.tv = [o[0] + sx, o[1] + 0.92, o[2] - B + 0.24 - 0.025, 0]; }
      else { putF(I, g, gl, sx, -B + 0.3, 0, (q) => { F.crate(q); q.translate(0, 0.5, 0); F.radio(q); }, [0.32, 0.27, 0.6], o); spot(I, 'radio', sx, -B + 1.0, Math.PI, { r: 1.0 }); I.tv = null; }
      putF(I, g, gl, -A + 0.2, 0.3, Math.PI / 2, (q) => F.shelf(q, 1.0, wood, [0xb84a34, 0x3d74a6, 0xf0b83a, 0x3f9a58, 0xe2d2b4, 0x8a54c8]), [0.5, 0.18, 2], o);
      putF(I, g, gl, -A + 0.3, -B + 0.3, 0, (q) => F.plant(q, lvl >= 3), [0.2, 0.2, 1], o);
      if (lvl >= 3) { putF(I, g, gl, C - 0.35, B - 0.35, 0, (q, ql) => F.floorLamp(q, ql), null, o); }
      putF(I, g, gl, sx, B - 0.06, Math.PI, (q) => { q.translate(0, 1.75, 0); F.frame(q, 1.0, 0.6, 0x7cc4e8); }, null, o);
      putF(I, g, gl, -A + 0.4, -B + 0.07, 0, (q, ql) => F.switchPlate(q, ql), null, o); spot(I, 'switch', -A + 0.45, -B + 0.45, Math.PI, { room: 0, r: 0.9 });
      putF(I, g, gl, (C - A) / 2, 0, 0, (q, ql) => F.ceilLamp(ql, h), null, o); lamps.push([(C - A) / 2, h - 0.3, 0, 1.1]);
      spot(I, 'door', -A + 1.2, -B + 0.35, Math.PI);
      I.entry = [-A + 1.2, -B + 0.7, 0];
      // --- yotoqxona ---
      const bx = (C - A) / 2 + 0.4; const frame = lvl >= 3 ? 0x5a3a26 : 0x8a5a36;
      putF(I, g, gl, bx, Z1 - 1.1, Math.PI, (q) => F.bed(q, [0x3d74a6, 0xc84a3a, 0x3d74a6, 0x6a8a5a, 0x8a7ab0][lvl], frame), [0.8, 1.05, 0.6], o);
      spot(I, 'bed', bx + 1.05, Z1 - 1.1, -Math.PI / 2, { bed: [bx, Z1 - 1.1, Math.PI] });
      putF(I, g, gl, bx + 1.1, Z1 - 0.3, Math.PI, (q) => F.nightstand(q, frame), [0.24, 0.2, 0.6], o); putF(I, g, gl, bx + 1.1, Z1 - 0.3, Math.PI, (q, ql) => { q.translate(0, 0.56, 0); ql.translate(0, 0.56, 0); F.clock(q, ql); }, null, o);
      spot(I, 'alarm', bx + 1.1, Z1 - 0.95, 0, { r: 0.8 });
      putF(I, g, gl, bx - 1.1, Z1 - 0.3, Math.PI, (q) => F.nightstand(q, frame), [0.24, 0.2, 0.6], o); putF(I, g, gl, bx - 1.1, Z1 - 0.3, Math.PI, (q, ql) => { q.translate(0, 0.56, 0); F.lantern(q, ql.translate(0, 0.56, 0)); }, null, o);
      putF(I, g, gl, -A + 0.32, B + D / 2 + 0.3, Math.PI / 2, (q) => F.wardrobe(q, 1.2, frame), [0.62, 0.3, 2], o); spot(I, 'wardrobe', -A + 0.95, B + D / 2 + 0.3, -Math.PI / 2, { r: 1.0 });
      putF(I, g, gl, C - 0.32, B + 0.75, -Math.PI / 2, (q) => F.desk(q, wood), [0.56, 0.3, 0.8], o); putF(I, g, gl, C - 0.85, B + 0.75, Math.PI / 2, (q) => F.chair(q, wood), null, o); spot(I, 'desk', C - 0.95, B + 0.75, Math.PI / 2, { r: 1.0 });
      putF(I, g, gl, bx, B + D / 2 - 0.2, 0, (q) => F.rug(q, 1.8, 1.2, 0xe6dccb, 0x7a8a9a), null, o);
      putF(I, g, gl, bx, Z1 - 0.06, Math.PI, (q) => { q.translate(0, 1.65, 0); F.frame(q, 0.7, 0.5, 0xf0c070); }, null, o);
      putF(I, g, gl, -A + 1.95, B + 0.07, 0, (q, ql) => F.switchPlate(q, ql), null, o); spot(I, 'switch', -A + 2.0, B + 0.45, 0, { room: 1, r: 0.8 });
      putF(I, g, gl, (C - A) / 2, B + D / 2, 0, (q, ql) => F.ceilLamp(ql, h), null, o); lamps.push([(C - A) / 2, h - 0.3, B + D / 2, 1.0]);
      if (!E) { // --- kulba: oshxona mehmonxonaning o'ng devorida, ichimlik suvi — idishda ---
        putF(I, g, gl, C - 0.3, B - 0.45, -Math.PI / 2, (q) => F.coolbox(q), [0.36, 0.24, 0.6], o); spot(I, 'fridge', C - 0.85, B - 0.45, Math.PI / 2, { r: 1.0 });
        putF(I, g, gl, C - 0.3, -0.3, -Math.PI / 2, (q) => F.stove(q), [0.31, 0.3, 1], o); spot(I, 'stove', C - 0.9, -0.3, Math.PI / 2, { r: 1.0 });
        putF(I, g, gl, C - 0.3, 0.55, -Math.PI / 2, (q) => { F.counter(q, 0.9); F.kettle(q); }, [0.45, 0.3, 1], o); spot(I, 'kettle', C - 0.9, 0.55, Math.PI / 2, { r: 0.9 });
        putF(I, g, gl, C - 0.3, -1.25, -Math.PI / 2, (q) => F.jug(q), [0.25, 0.22, 1], o); spot(I, 'tap', C - 0.85, -1.25, Math.PI / 2, { r: 1.0 });
        putF(I, g, gl, -A + 0.95, -0.3, 0, (q) => { F.table(q, 0.8, 1.0, wood); F.cloth(q, 0.8, 1.0); }, [0.42, 0.52, 0.8], o);
        for (const [cz, yaw] of [[-1.05, 0], [0.45, Math.PI]]) { putF(I, g, gl, -A + 0.95, cz, yaw, (q) => F.chair(q, wood), null, o); spot(I, 'sit', -A + 0.95, cz, yaw, { table: [-A + 0.95, -0.3], r: 0.9 }); }
        I.plateAt = [-A + 0.95, -0.3];
      } else {
        // --- oshxona ---
        const kx0 = C, kz0 = -B + bathD, kx1 = C + E;
        putF(I, g, gl, kx1 - 0.36, Z1 - 0.4, -Math.PI / 2, (q) => F.fridge(q, lvl >= 4 ? 0xc8ccd4 : 0xe8eaee), [0.35, 0.34, 1.8], o); spot(I, 'fridge', kx1 - 1.0, Z1 - 0.4, Math.PI / 2, { r: 1.0 });
        putF(I, g, gl, kx1 - 0.3, Z1 - 1.3, -Math.PI / 2, (q) => F.sink(q), [0.45, 0.3, 1], o); spot(I, 'tap', kx1 - 0.9, Z1 - 1.3, Math.PI / 2, { r: 0.9 });
        putF(I, g, gl, kx1 - 0.3, Z1 - 2.06, -Math.PI / 2, (q) => F.stove(q), [0.31, 0.3, 1], o); spot(I, 'stove', kx1 - 0.92, Z1 - 2.06, Math.PI / 2, { r: 0.9 });
        putF(I, g, gl, kx1 - 0.3, Z1 - 2.85, -Math.PI / 2, (q) => { F.counter(q, 0.9); F.kettle(q); }, [0.45, 0.3, 1], o); spot(I, 'kettle', kx1 - 0.9, Z1 - 2.85, Math.PI / 2, { r: 0.9 });
        if (lvl >= 3) putF(I, g, gl, kx1 - 0.3, Z1 - 3.7, -Math.PI / 2, (q) => F.counter(q, 0.8), [0.4, 0.3, 1], o);
        for (let i = 0; i < 3; i++) putF(I, g, gl, kx1 - 0.08, Z1 - 1.3 - i * 0.8, -Math.PI / 2, (q) => { q.color(0x6e4a30).box(0, 1.65, 0.02, 0.7, 0.55, 0.3); q.color(0x8a5a36).box(0, 1.65, 0.17, 0.64, 0.5, 0.01); }, null, o);
        const tx = kx0 + 1.05, tz = Z1 - 1.6;
        putF(I, g, gl, tx, tz, 0, (q) => { F.table(q, 0.85, 1.1, wood); F.cloth(q, 0.85, 1.1); }, [0.45, 0.57, 0.8], o);
        for (const [cz, yaw] of [[tz - 0.75, 0], [tz + 0.75, Math.PI]]) { putF(I, g, gl, tx, cz, yaw, (q) => F.chair(q, wood), null, o); spot(I, 'sit', tx, cz, yaw, { table: [tx, tz], r: 0.9 }); }
        I.plateAt = [tx, tz];
        putF(I, g, gl, kx0 + 0.3, Z1 - 0.3, 0, (q) => F.plant(q), [0.2, 0.2, 1], o);
        putF(I, g, gl, kx0 + 0.07, (-B + bathD + B) / 2 + 0.75, Math.PI / 2, (q, ql) => F.switchPlate(q, ql), null, o); spot(I, 'switch', kx0 + 0.45, (-B + bathD + B) / 2 + 0.8, Math.PI / 2, { room: 2, r: 0.8 });
        putF(I, g, gl, (kx0 + kx1) / 2, (kz0 + Z1) / 2, 0, (q, ql) => F.ceilLamp(ql, h), null, o); lamps.push([(kx0 + kx1) / 2, h - 0.3, (kz0 + Z1) / 2, 1.1]);
        // --- hammom ---
        const bz0 = -B, bz1 = -B + bathD;
        putF(I, g, gl, kx1 - 0.55, bz0 + 0.55, 0, (q, ql) => F.shower(q, ql), null, o); spot(I, 'shower', kx1 - 0.55, bz0 + 0.55, 0, { r: 0.75, inShower: 1 });
        I.cols.push(COL.addSeg(o[0] + kx1 - 1.02, o[2] + bz0 + 1.02, o[0] + kx1 - 1.02 + 0.5, o[2] + bz0 + 1.02, 0.03, o[1] - 0.5, o[1] + 2));
        putF(I, g, gl, kx1 - 0.4, bz1 - 0.45, -Math.PI / 2, (q) => F.toilet(q), [0.22, 0.3, 0.8], o);
        putF(I, g, gl, kx0 + 1.2, bz0 + 0.3, 0, (q, ql) => { q.color(0xf6f6f2).box(0, 0.42, 0, 0.6, 0.84, 0.46); q.color(0xe8e8e2).box(0, 0.85, 0.02, 0.62, 0.05, 0.5); q.color(0xb9bec8).cyl(6, 0.016, 0.016, 0.87, 1.1).box(0, 1.08, 0.06, 0.03, 0.03, 0.16); F.mirror(q, ql); }, [0.32, 0.25, 1], o);
        spot(I, 'sink', kx0 + 1.2, bz0 + 0.95, Math.PI, { r: 0.8 }); spot(I, 'mirror', kx0 + 1.2, bz0 + 0.95, Math.PI, { r: 0.8 });
        putF(I, g, gl, kx0 + 0.07, bz0 + bathD / 2 - 0.75, Math.PI / 2, (q, ql) => F.switchPlate(q, ql), null, o); spot(I, 'switch', kx0 + 0.45, bz0 + bathD / 2 - 0.75, Math.PI / 2, { room: 3, r: 0.7 });
        putF(I, g, gl, (kx0 + kx1) / 2, (bz0 + bz1) / 2, 0, (q, ql) => F.ceilLamp(ql, h), null, o); lamps.push([(kx0 + kx1) / 2, h - 0.3, (bz0 + bz1) / 2, 1.0]);
        // hammom devorlariga kafel (pastki qism)
        g.color(0xdfeef2); g.box((kx0 + kx1) / 2, 0.7, bz0 + 0.07, E - 0.1, 1.4, 0.02); g.box(kx1 - 0.07, 0.7, (bz0 + bz1) / 2, 0.02, 1.4, bathD - 0.1);
      }
    }
    I.rooms = rooms; I.doors = doors;
    finish(I, g, gw, gl, lamps, lvl === 0 ? 0.92 : 1.02);
    I.grp.visible = IN.inside === 'home';
  };

  // ================= DO'KON (ichkarisi) =================
  const shopkeeper = makeRig({ shirt: 0x3f9a58, pants: 0x2a2c33, hair: 0x1d1612, seed: 41, vest: 0xf2ead8 }); shopkeeper.root.visible = false; scene.add(shopkeeper.root);
  const buildShop = () => {
    const I = S, o = S.o; clearI(I); const g = newGB(951, o), gw = newGB(952, o), gl = newGB(953, o); const h = 3.0; I.h = h;
    const rooms = [{ t: 'shop', x0: -3.2, z0: -2.6, x1: 3.2, z1: 2.6, floor: 0xdcd6cc }], doors = [{ ax: 'z', c: -2.6, a: -0.6, b: 0.6, exit: 1 }];
    buildShell(I, g, gw, gl, rooms, doors, h, 0xf2ead8, 0xfbf8f2, o);
    g.color(0x3f9a58).box(0, 2.6, 2.53, 6.2, 0.5, 0.02); // yashil chiziq (do'kon rangi)
    // peshtaxta va sotuvchi
    putF(I, g, gl, 0, 1.2, Math.PI, (q) => { q.color(0x8a5a36).box(0, 0.5, 0, 2.6, 1.0, 0.6); q.color(0xd8d2c6).box(0, 1.02, 0, 2.7, 0.05, 0.66); q.color(0x3f9a58).box(0, 0.55, -0.305, 2.5, 0.25, 0.01);
      q.color(0x2a2c33).box(0.8, 1.15, 0, 0.42, 0.22, 0.32); q.color(0x9fd0ff).box(0.8, 1.22, -0.12, 0.32, 0.12, 0.01); for (let i = 0; i < 5; i++) q.push().translate(-0.9 + i * 0.13, 0, 0.1).color([0xffd23a, 0xff6a8a, 0x4fb0ff, 0xf08a2a, 0x8a54c8][i]).cyl(8, 0.05, 0.05, 1.05, 1.22, { cap: true }).pop(); }, [1.32, 0.32, 1.2], o);
    spot(I, 'counter', 0, 0.35, 0, { r: 1.2 });
    I.keeper = [o[0], o[1], o[2] + 1.85];
    // javonlar (rang-barang tovarlar)
    const goods = [0xd8392b, 0xf0b83a, 0x3f9a58, 0x4fb0ff, 0xff8a3a, 0x8a54c8, 0xf2f2ee, 0xe2572f];
    for (const [x, yaw] of [[-2.95, Math.PI / 2], [2.95, -Math.PI / 2]]) for (const z of [-1.3, 0.3]) putF(I, g, gl, x, z, yaw, (q) => { F.shelf(q, 1.4, 0xb9bec8); for (let k = 0; k < 4; k++) for (let i = 0; i < 7; i++) { const c = goods[(k * 3 + i + (z > 0 ? 2 : 0)) % goods.length], bx = -0.6 + i * 0.2; if ((k + i) % 3 === 0) q.push().translate(bx, 0, 0).color(c).cyl(8, 0.05, 0.05, 0.06 + k * 0.45, 0.3 + k * 0.45, { cap: true }).pop(); else q.color(c).box(bx, 0.17 + k * 0.45, 0, 0.16, 0.24, 0.2); } }, [0.72, 0.18, 2], o);
    // ichimliklar sovutgichi (shisha eshik — yorug')
    putF(I, g, gl, -2.0, 2.25, Math.PI, (q, ql) => { q.color(0xd8392b).box(0, 1.0, 0, 1.0, 2.0, 0.62); ql.color(0xdff4ff).box(0, 1.05, 0.315, 0.84, 1.6, 0.01); for (let k = 0; k < 4; k++) for (let i = 0; i < 6; i++) ql.color([0x4fb0ff, 0xff8a3a, 0x9fe870, 0xffd23a][k]).box(-0.34 + i * 0.135, 0.42 + k * 0.4, 0.3, 0.07, 0.24, 0.02); }, [0.5, 0.31, 2], o);
    spot(I, 'cooler', -2.0, 1.55, 0, { r: 1.0 });
    putF(I, g, gl, 2.4, 2.2, Math.PI, (q) => { for (let k = 0; k < 3; k++) q.color([0xf0b83a, 0xd8392b, 0x2f7fd0][k]).box(0, 0.35 + k * 0.42, 0, 1.0, 0.35, 0.5); }, [0.5, 0.25, 1.4], o); // kanistrlar va qutilar
    for (const x of [-1.6, 1.6]) for (const z of [-1.2, 1.2]) putF(I, g, gl, x, z, 0, (q, ql) => ql.color(0xf6fbff).box(0, h - 0.04, 0, 1.2, 0.05, 0.2), null, o);
    putF(I, g, gl, 0, -1.6, 0, (q) => F.rug(q, 1.2, 0.8, 0x3f9a58, 0x2f6a40), null, o);
    spot(I, 'door', 0, -2.25, Math.PI); I.entry = [0, -1.8, 0];
    finish(I, g, gw, gl, [[-1.6, h - 0.3, -1.2, 0.8], [1.6, h - 0.3, -1.2, 0.8], [-1.6, h - 0.3, 1.2, 0.8], [1.6, h - 0.3, 1.2, 0.8]], 1.0);
    I.rooms = rooms; I.grp.visible = false;
  };
  buildHome(Math.max(0, game.state.home.lvl)); buildShop();

  // ---------- TV ekrani (kanallar: yangiliklar, multfilm, ob-havo) ----------
  const NEWS = ['Orolda yangi yo\'l ochildi', 'Bog\'istonda olma hosili mo\'l', 'Karvonsaroyda bozor kuni', 'Ko\'zgu ko\'lda baliq ko\'paydi', 'Aerodromda poyga musobaqasi'];
  const drawTV = (t) => {
    const x = tvX, W = 256, Hh = 144, ch = IN.tvCh % 3;
    if (ch === 0) { x.fillStyle = '#1d3a6a'; x.fillRect(0, 0, W, Hh); x.fillStyle = '#e2572f'; x.fillRect(0, 108, W, 36); x.fillStyle = '#fff'; x.font = 'bold 15px sans-serif'; x.fillText('OROL YANGILIKLARI', 10, 24);
      x.fillStyle = '#f2d8b0'; x.beginPath(); x.arc(70, 72, 20, 0, 6.3); x.fill(); x.fillStyle = '#2a2c33'; x.fillRect(48, 92, 44, 16); x.fillStyle = '#7cc4e8'; x.fillRect(130, 40, 110, 62);
      x.fillStyle = '#fff'; x.font = 'bold 13px sans-serif'; const s = NEWS[Math.floor(t / 4) % NEWS.length] + '  •  '; const off = (t * 40) % (s.length * 7.5); x.fillText(s + s, 8 - off, 130); }
    else if (ch === 1) { x.fillStyle = '#9fe0ff'; x.fillRect(0, 0, W, Hh); x.fillStyle = '#6ac45a'; x.fillRect(0, 104, W, 40); x.fillStyle = '#ffe14a'; x.beginPath(); x.arc(220, 26, 16, 0, 6.3); x.fill();
      const bx = (t * 60) % (W + 60) - 30, by = 84 - Math.abs(Math.sin(t * 4)) * 40; x.fillStyle = '#ff5a8a'; x.beginPath(); x.arc(bx, by, 16, 0, 6.3); x.fill(); x.fillStyle = '#fff'; x.beginPath(); x.arc(bx + 5, by - 4, 5, 0, 6.3); x.fill(); x.fillStyle = '#000'; x.beginPath(); x.arc(bx + 6, by - 4, 2.4, 0, 6.3); x.fill(); }
    else { x.fillStyle = '#2a6aa8'; x.fillRect(0, 0, W, Hh); x.fillStyle = '#fff'; x.font = 'bold 15px sans-serif'; x.fillText('OB-HAVO', 10, 22); const h0 = Math.floor(game.hour); for (let i = 0; i < 4; i++) { const cx = 34 + i * 62; x.fillStyle = i % 2 ? '#e8eef4' : '#ffd23a'; x.beginPath(); x.arc(cx, 70, 15, 0, 6.3); x.fill(); x.fillStyle = '#fff'; x.font = 'bold 13px sans-serif'; x.fillText(`${(h0 + i * 3) % 24}:00`, cx - 18, 108); x.fillText(`${22 + ((i * 5) % 7)}°`, cx - 10, 126); } }
    tvTex.needsUpdate = true;
  };
  drawTV(0);

  // ---------- kirish va chiqish ----------
  const cur = () => (IN.inside === 'home' ? H : IN.inside === 'shop' ? S : IN.X[IN.inside] || null);
  const mini = () => document.getElementById('mini');
  const fadeFlash = () => { const f = game.ui && game.ui.fade; if (!f) return; f.style.opacity = 1; setTimeout(() => { f.style.opacity = 0; }, 260); };
  IN.enter = (kind, ret) => {
    if (kind === 'home' && H.lvl !== game.state.home.lvl) buildHome(game.state.home.lvl);
    const I = kind === 'home' ? H : kind === 'shop' ? S : IN.X[kind]; fadeFlash();
    IN.ret = ret || [pl.p[0], pl.p[2], pl.yaw + Math.PI]; IN.inside = kind; for (const J of [H, S, ...Object.values(IN.X)]) J.grp.visible = J === I;
    pl.place(I.o[0] + I.entry[0], I.o[2] + I.entry[1], I.entry[2]); pl.sit = false; pl.emote = null;
    shopkeeper.root.visible = kind === 'shop'; if (kind === 'shop') { shopkeeper.root.position.set(S.keeper[0], S.keeper[1], S.keeper[2]); shopkeeper.root.rotation.y = Math.PI; }
    tvMesh.visible = kind === 'home' && !!H.tv; if (H.tv) { tvMesh.position.set(H.tv[0], H.tv[1], H.tv[2] + 0.034); tvMesh.rotation.y = 0; }
    game.cam.snap(); IN.camP = null; if (mini()) mini().style.visibility = 'hidden';
    game.audio.sfx('click');
  };
  IN.exit = () => {
    if (!IN.inside) return; const r = IN.ret; fadeFlash();
    const I = cur(); I.grp.visible = false; shopkeeper.root.visible = false; tvMesh.visible = false; IN.inside = null; IN.tvOn = false; pl.sit = false; pl.emote = null;
    pl.place(r[0], r[1], r[2]); pl.p[1] = T.ground(r[0], r[1], T.gridHeight(r[0], r[1]) + 3).y;
    game.camera.near = 1.2; game.camera.updateProjectionMatrix(); game.cam.snap(); if (mini()) mini().style.visibility = '';
    game.audio.sfx('click');
  };
  IN.cur = cur;
  IN.roomAt = (x, z) => { const I = cur(); if (!I) return null; const lx = x - I.o[0], lz = z - I.o[2]; for (let i = 0; i < I.rooms.length; i++) { const r = I.rooms[i]; if (lx >= r.x0 - 0.05 && lx <= r.x1 + 0.05 && lz >= r.z0 - 0.05 && lz <= r.z1 + 0.05) return i; } return null; };
  IN.rebuildHome = () => { if (H.lvl !== game.state.home.lvl) buildHome(game.state.home.lvl); };

  // ---------- har kadr: yorug'lik, deraza rangi, TV, sotuvchi, yopiq joy kamerasi ----------
  const _c = new THREE.Color(), camT = new THREE.Vector3(), camW = new THREE.Vector3(), look = new THREE.Vector3();
  IN.update = (dt) => {
    const I = cur(); if (!I) return;
    const night = game.sky.night, lit = IN.lights;
    const k = lit ? 1.0 : 0.62 - 0.5 * night; matIn.color.setScalar(k); matLamp.color.setScalar(lit ? 1.35 : 0.3);
    _c.setRGB(1.2 - 0.95 * night, 1.35 - 1.0 * night, 1.6 - 0.9 * night); matWin.color.copy(_c);
    if (IN.inside === 'home' && tvMesh.visible) { if (IN.tvOn) { IN.tvT = (IN.tvT || 0) + dt; if ((IN.tvA = (IN.tvA || 0) + dt) > 0.08) { IN.tvA = 0; drawTV(IN.tvT); } matTV.color.setScalar(1.6); } else matTV.color.setScalar(0.04); }
    if (IN.inside === 'shop') { const kp = shopkeeper.root.position, d = Math.hypot(pl.p[0] - kp.x, pl.p[2] - kp.z); shopkeeper.root.rotation.y = Math.atan2(pl.p[0] - kp.x, pl.p[2] - kp.z); poseRig(shopkeeper, (IN.talkT || 0) > 0 || d < 2.6 ? 'wave' : 'idle', dt, 0); if (IN.talkT > 0) IN.talkT -= dt; }
    // mahalliy chiroq (qahramonni yoritadi): xona shifti ostida
    const Lg = game.localLight; if (Lg) { const ri = IN.roomAt(pl.p[0], pl.p[2]); const r = I.rooms[ri == null ? 0 : ri]; Lg.position.set(I.o[0] + (r.x0 + r.x1) / 2, I.o[1] + I.h - 0.4, I.o[2] + (r.z0 + r.z1) / 2); Lg.color.setHex(0xffe8c8); Lg.intensity = lit ? 60 : 8 + 30 * (1 - night); }
  };
  // Yopiq joy kamerasi: qahramon ortida, yaqinroq; joriy xona chegarasidan va shiftdan chiqmaydi; tor joyda — xonaning eng uzoq burchagidan
  IN.camera = (dt) => {
    const I = cur(); if (!I) return; const cam = game.camera, o = I.o, ri = IN.roomAt(pl.p[0], pl.p[2]); if (ri == null) return; const r = I.rooms[ri];
    const lying = pl.lockAnim === 'lie' || pl.anim === 'lie', sitting = pl.sit || pl.anim === 'sit' || pl.anim === 'eat';
    const hy = o[1] + (lying ? 0.75 : sitting ? 1.05 : 1.45);
    camT.set(pl.p[0], hy, pl.p[2]);
    const a = game.cam.heading + game.cam.yawOff, dist = (lying ? 2.4 : 2.7) * (game.cam.zoom || 1), up = (lying ? 1.1 : 0.55) + game.cam.pitchOff * 1.2;
    const m = 0.24, x0 = o[0] + r.x0 + m, x1 = o[0] + r.x1 - m, z0 = o[2] + r.z0 + m, z1 = o[2] + r.z1 - m, yTop = o[1] + I.h - 0.22;
    camW.set(clamp(pl.p[0] - Math.sin(a) * dist, x0, x1), clamp(hy + up, o[1] + 0.4, yTop), clamp(pl.p[2] - Math.cos(a) * dist, z0, z1));
    if (Math.hypot(camW.x - camT.x, camW.z - camT.z) < 1.15) { let best = null, bd = 0; for (const [cx, cz] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1]]) { const d = Math.hypot(cx - camT.x, cz - camT.z); if (d > bd) { bd = d; best = [cx, cz]; } } camW.set(best[0], yTop - 0.1, best[1]); }
    if (!IN.camP || IN.camRoom !== ri) { IN.camP = camW.clone(); IN.camRoom = ri; } else IN.camP.lerp(camW, Math.min(1, dt * 6));
    cam.position.copy(IN.camP); look.copy(camT); look.y -= lying ? 0.1 : 0.15; cam.lookAt(look);
    if (cam.near !== 0.08) { cam.near = 0.08; cam.updateProjectionMatrix(); }
  };
  IN.shopkeeper = shopkeeper;
  IN.F = F;
  IN.lib = { buildShell, putF, spot, finish, newGB, clearI }; // boshqa ichki makonlarni shu qurollar bilan quriladi
  return IN;
}
