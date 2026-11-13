// Jipning low-poly modeli (o'z dizaynimiz): korpus, tom bagaji, zaxira g'ildirak, chiroqlar
import * as THREE from 'three';
import { GB, MAT } from './geo.js';

export const PAINTS = [
  { id: 'qizil', name: 'Olov qizil', hex: 0xd8392b, cost: 0 },
  { id: 'kok', name: "Moviy ko'l", hex: 0x2f7fd0, cost: 600 },
  { id: 'yashil', name: "Archa yashil", hex: 0x3f9a58, cost: 600 },
  { id: 'sariq', name: 'Qum sariq', hex: 0xf0b83a, cost: 800 },
  { id: 'oq', name: 'Qor oq', hex: 0xf2f2ee, cost: 800 },
  { id: 'qora', name: 'Tun qora', hex: 0x2a2c33, cost: 1000 },
  { id: 'binafsha', name: 'Shafaq binafsha', hex: 0x8a54c8, cost: 1200 },
  { id: 'firuza', name: 'Firuza', hex: 0x24b8b0, cost: 1200 },
  { id: 'oltin', name: 'Oltin (Katta Safar sovrini)', hex: 0xe8b23a, cost: -1 },
];

export function buildCarModel() {
  const root = new THREE.Group();
  const paint = new GB(21); paint.jit = 0.02; paint.color(0xffffff);
  const trim = new GB(22); trim.jit = 0.03;
  const pBumpF = new GB(31), pBumpR = new GB(32), pSpare = new GB(33), pLug = new GB(34), pMirL = new GB(35), pMirR = new GB(36);
  for (const q of [pBumpF, pBumpR, pSpare, pLug, pMirL, pMirR]) q.jit = 0.03;
  const DARK = 0x2b2d33, GREY = 0x4a4d57, GLASS = 0x1e3246, STEEL = 0xb9bec8;

  // --- bo'yaladigan korpus ---
  paint.box(0, -0.05, 0, 1.74, 0.56, 3.84);                          // pastki korpus
  paint.box(0, 0.33, 1.34, 1.6, 0.2, 1.16, { tx: 0.94, tz: 0.96, oz: -0.02 }); // kapot
  paint.box(0, 0.36, -0.58, 1.72, 0.26, 2.66);                       // kabina pasti (eshik chizig'i)
  paint.box(0, 0.98, -0.62, 1.6, 0.1, 2.5, { tx: 0.97, tz: 0.97 }); // tom
  // ustunlar
  for (const sx of [-1, 1]) {
    paint.box(sx * 0.78, 0.71, 0.62, 0.09, 0.46, 0.1, { oz: -0.1 });
    paint.box(sx * 0.78, 0.71, -0.55, 0.09, 0.46, 0.1);
    paint.box(sx * 0.78, 0.71, -1.82, 0.09, 0.46, 0.12);
  }
  paint.box(0, 0.71, -1.86, 1.56, 0.46, 0.06); // orqa devor ramkasi (oyna atrofi)

  // --- oynalar ---
  trim.color(GLASS); trim.jit = 0.01;
  trim.box(0, 0.71, 0.58, 1.5, 0.42, 0.05, { oz: -0.1 });            // old oyna
  for (const sx of [-1, 1]) { trim.box(sx * 0.775, 0.71, 0.03, 0.05, 0.4, 1.06); trim.box(sx * 0.775, 0.71, -1.18, 0.05, 0.4, 1.14); }
  trim.box(0, 0.73, -1.9, 1.1, 0.34, 0.04);
  trim.jit = 0.03;

  // --- qora detallar ---
  trim.color(DARK);
  trim.box(0, -0.4, 0, 1.3, 0.16, 3.6);                               // rama
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    // qanot kengaytmalari
    trim.box(sx * 0.9, 0.04, sz * 1.28, 0.2, 0.1, 1.06);
    trim.box(sx * 0.9, -0.1, sz * 1.28 + 0.56, 0.2, 0.2, 0.1);
    trim.box(sx * 0.9, -0.1, sz * 1.28 - 0.56, 0.2, 0.2, 0.1);
  }
  for (const sx of [-1, 1]) trim.box(sx * 0.93, -0.3, 0, 0.18, 0.07, 1.34); // ostona
  pBumpF.color(GREY).box(0, -0.2, 1.98, 1.78, 0.24, 0.2);             // old bamper
  pBumpR.color(GREY).box(0, -0.2, -1.98, 1.78, 0.22, 0.18);           // orqa bamper
  trim.color(DARK);
  trim.box(0, 0.12, 1.93, 1.0, 0.3, 0.06);                            // radiator panjarasi
  // himoya dugasi
  pBumpF.color(STEEL);
  for (const sx of [-1, 1]) pBumpF.box(sx * 0.42, 0.0, 2.1, 0.06, 0.5, 0.06);
  pBumpF.box(0, 0.24, 2.1, 0.92, 0.06, 0.06); pBumpF.box(0, -0.02, 2.1, 0.92, 0.05, 0.05);
  // shnorkel
  trim.color(DARK);
  trim.box(-0.84, 0.62, 0.72, 0.09, 0.72, 0.09, { oz: -0.12 }); trim.box(-0.84, 1.02, 0.6, 0.12, 0.14, 0.16);
  // ko'zgular
  for (const sx of [-1, 1]) { const q = sx > 0 ? pMirL : pMirR; q.color(DARK); q.box(sx * 0.96, 0.56, 0.66, 0.2, 0.05, 0.05); q.box(sx * 1.04, 0.6, 0.66, 0.06, 0.2, 0.14); }
  // eshik tutqichlari
  trim.color(STEEL);
  for (const sx of [-1, 1]) { trim.box(sx * 0.875, 0.34, -0.3, 0.02, 0.04, 0.14); trim.box(sx * 0.875, 0.34, -1.5, 0.02, 0.04, 0.14); }
  // antenna
  trim.color(DARK); trim.box(0.7, 0.9, 1.0, 0.025, 1.0, 0.025);

  // --- tom bagaji ---
  trim.color(DARK);
  for (const sx of [-1, 1]) { trim.box(sx * 0.74, 1.12, -0.7, 0.05, 0.05, 2.3); trim.box(sx * 0.74, 1.2, -0.7, 0.04, 0.04, 2.3); }
  for (const z of [0.42, -0.14, -0.7, -1.26, -1.82]) { trim.box(0, 1.1, z, 1.5, 0.04, 0.06); for (const sx of [-1, 1]) trim.box(sx * 0.74, 1.08, z, 0.05, 0.12, 0.05); }
  // yuklar
  pLug.color(0x2f6fb8); pLug.box(-0.3, 1.27, -0.35, 0.72, 0.3, 0.8);        // ko'k sandiq
  pLug.color(0x26589a); pLug.box(-0.3, 1.43, -0.35, 0.74, 0.04, 0.82);
  pLug.color(0x3f8a54); pLug.box(0.36, 1.24, -0.2, 0.5, 0.24, 0.5, { tx: 0.85, tz: 0.85 }); // yashil sumka
  pLug.color(0xeeeae0); pLug.push().translate(0, 1.26, -1.05).rotZ(0); pLug.prismX(8, 0.15, 1.2); pLug.pop(); // o'ralgan ko'rpa
  pLug.color(0xd8a13a); pLug.push().translate(0.0, 1.25, -1.42); pLug.prismX(8, 0.13, 1.0); pLug.pop();      // chodir
  pLug.color(0xb8402e); pLug.box(0.42, 1.28, -0.75, 0.26, 0.34, 0.4);       // kanistra
  pLug.color(0x8a5a36); pLug.box(-0.42, 1.21, -1.72, 0.5, 0.2, 0.36);       // yog'och quti

  // --- zaxira g'ildirak ---
  pSpare.color(0x1e1f24); pSpare.push().translate(0, 0.32, -2.12); pSpare.prismZ(10, 0.4, 0.24); pSpare.pop();
  pSpare.color(STEEL); pSpare.push().translate(0, 0.32, -2.25); pSpare.prismZ(8, 0.2, 0.04); pSpare.pop();

  const paintMat = new THREE.MeshLambertMaterial({ vertexColors: true, color: PAINTS[0].hex });
  const body = new THREE.Mesh(paint.build(), paintMat); body.castShadow = true; root.add(body);
  const trimMesh = new THREE.Mesh(trim.build(), MAT.flat); trimMesh.castShadow = true; root.add(trimMesh);
  const parts = {};
  const mkPart = (name, gb, zone) => { const geo = gb.build(); const c = new THREE.Vector3(); geo.boundingBox.getCenter(c); geo.translate(-c.x, -c.y, -c.z); const m = new THREE.Mesh(geo, MAT.flat); m.position.copy(c); m.castShadow = true; root.add(m); parts[name] = { mesh: m, zone, on: true, home: c }; };
  mkPart('bumpF', pBumpF, 'front'); mkPart('bumpR', pBumpR, 'rear'); mkPart('spare', pSpare, 'rear'); mkPart('luggage', pLug, 'top'); mkPart('mirL', pMirL, 'left'); mkPart('mirR', pMirR, 'right');

  // --- chiroqlar (alohida materiallar) ---
  const mk = (gb, mat) => { const m = new THREE.Mesh(gb.build(), mat); root.add(m); return m; };
  const hl = new GB(23); hl.jit = 0; hl.color(0xffffff);
  for (const sx of [-1, 1]) { hl.push().translate(sx * 0.62, 0.14, 1.94); hl.prismZ(8, 0.13, 0.06); hl.pop(); }
  for (const x of [-0.45, -0.15, 0.15, 0.45]) hl.box(x, 1.16, 0.5, 0.2, 0.12, 0.08); // tom chiroqlari
  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff6d8, vertexColors: true, fog: false });
  mk(hl, headMat);
  const tl = new GB(24); tl.jit = 0; tl.color(0xffffff);
  for (const sx of [-1, 1]) { tl.box(sx * 0.72, 0.1, -1.93, 0.16, 0.22, 0.04); }
  const tailMat = new THREE.MeshBasicMaterial({ color: 0x7a1010, vertexColors: true, fog: false });
  mk(tl, tailMat);
  const ind = new GB(25); ind.jit = 0; ind.color(0xffffff);
  for (const sx of [-1, 1]) ind.box(sx * 0.72, -0.08, -1.93, 0.16, 0.08, 0.04);
  mk(ind, new THREE.MeshBasicMaterial({ color: 0xe8e8e8, vertexColors: true }));

  // --- g'ildiraklar ---
  const wg = new GB(26); wg.jit = 0.04;
  wg.color(0x202127); wg.push().rotZ(-Math.PI / 2); wg.cyl(18, 0.42, 0.42, -0.15, 0.15, { cap: true }); wg.rotZ(Math.PI); wg.cyl(18, 0.42, 0.42, 0.149, 0.15, { cap: true }); wg.pop();
  wg.color(0x15161a); for (let i = 0; i < 12; i++) { wg.push().rotX((i / 12) * Math.PI * 2); wg.box(0, 0.425, 0, 0.32, 0.035, 0.07); wg.pop(); }
  wg.color(0xc4c8d0); wg.push().translate(0.02, 0, 0); wg.prismX(8, 0.23, 0.32); wg.pop();
  wg.color(0x5a5e68); for (let i = 0; i < 5; i++) { wg.push().rotX((i / 5) * Math.PI * 2); wg.box(0.17, 0.13, 0, 0.03, 0.07, 0.07); wg.pop(); }
  wg.color(0x8a8e98); wg.push().translate(0.15, 0, 0); wg.prismX(6, 0.07, 0.06); wg.pop();
  const wgeo = wg.build();
  const wheels = [];
  for (let i = 0; i < 4; i++) {
    const pivot = new THREE.Group();
    const m = new THREE.Mesh(wgeo, MAT.flat); m.castShadow = true;
    if (i % 2 === 1) m.scale.x = -1; // o'ng tomon: disk tashqariga qarasin
    pivot.add(m); root.add(pivot); wheels.push({ pivot, mesh: m });
  }
  // old chiroq nuri
  const spot = new THREE.SpotLight(0xfff0d0, 0, 120, 0.62, 0.55, 1.0);
  spot.position.set(0, 0.5, 1.9); spot.target.position.set(0, -1.6, 22);
  root.add(spot); root.add(spot.target);
  // nur konusi (soxta hajmli nur)
  return { root, body, trimMesh, parts, paintMat, headMat, tailMat, wheels, spot };
}
