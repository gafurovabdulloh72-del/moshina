// Tabiat obyektlari: daraxtlar, toshlar, butalar (nusxali, LOD bilan) va yaqin atrofdagi o't-gullar
import * as THREE from 'three';
import * as T from './terrain.js';
import { MAT } from './geo.js';
import { floraProtos, leafMaterial, grassMaterial, grassPatch, flowerGeo, FLORA_U } from './flora.js';
import { ROAD_RAMPS, RADARS, edgePoint } from './acts.js';
import { hash2, clamp, lerp, noise, smoothstep } from './util.js';
import * as COL from './colliders.js';

const B = T.BIOME;
const TREES = { round: 1, oval: 1, blossom: 1, pine: 1, pineSnow: 1, cypress: 1, acacia: 1, palm: 1, cactus: 1, dead: 1 };
const STONE_P = [0.05, 0.07, 0.1, 0.2, 0.42, 0.3, 0.08, 0.03, 0.1, 0.42];


// Biom bo'yicha ranglar (sRGB hex)
const TINT = {
  green: [0x5f7d38, 0x6b8a3c, 0x55743a, 0x77923f, 0x627f3a], dark: [0x4e6e4a, 0x557650, 0x486845, 0x5a7c54], poplar: [0x4f6e34, 0x5a7838, 0x48682f, 0x5f7c3a],
  autumn: [0xc98a34, 0xb0582c, 0xd6aa48, 0x9c4428, 0xc27a30, 0x8f6a34], birch: [0xd2b046, 0xc8a23e, 0xdcbe58, 0xbf9a3a], sakura: [0xf0bccb, 0xe9aabf, 0xf4cdd8, 0xeeb6c8, 0xe2a0b6],
  savanna: [0x7d8a44, 0x6f7e3e, 0x899448], palm: [0x5e8a3e, 0x688f44], cactus: [0x5f7d4c, 0x6a8654], dry: [0x9a9160, 0x8a8456, 0xa59a6c],
  deadwood: [0x8a7a68, 0x766656], burnt: [0x2a2624, 0x342e2c], rock: [0x8e8d88, 0x7f7f7c, 0x9a9890], redrock: [0xa86a4c, 0x965e44, 0xb47652],
  darkrock: [0x3a3634, 0x2f2c2c, 0x45403c], snowrock: [0xb8bcc6, 0xd0d4dc], sand: [0xc4b08a, 0xb6a27e], snowbush: [0xe6ecf6, 0xd8e0ee], lav: [0x8a72b8, 0x9a80c4],
};
// Har nusxaga biroz boshqa tus (yorqinlik + iliq/sovuq siljish) va katta maydonlar bo'yicha sekin o'zgarish
const vary = (c, x, z, type) => {
  const ix = Math.round(x * 7), iz = Math.round(z * 7), h = hash2(ix, iz, 91), h2 = hash2(ix, iz, 92), n = noise(x * 0.004 + 7, z * 0.004 - 3), rk = type === 'rock' || type === 'rock2' || type === 'stone';
  const k = 0.9 + h * 0.2 + n * 0.07, w = (h2 - 0.5) * (rk ? 0.05 : 0.14);
  c.r *= k * (1 + w); c.g *= k; c.b *= k * (1 - w * 1.2); return c;
};

// Manzillardagi (places/home) qo'lda qo'yilgan daraxtlar uchun navbat: buildProps'dan OLDIN chaqiriladi, daraxt nusxali tizimga (barg kartalari, LOD, shamol) qo'shiladi.
// Kollayder qo'shilmaydi (manzil o'zinikini qo'yadi). kind: 0 keng bargli (pushti hex bo'lsa — olcha), 1 terak, 2 archa
// Qaytaradi: true — navbatga olindi; false — buildProps allaqachon ishlagan (chaqiruvchi eski statik geometriyani chizsin)
export const EXTRA_TREES = [];
let extraDone = false;
export function queueTree(x, y, z, s, hex, kind = 0, rot = (x * 12.9898 + z * 78.233) % 6.283) {
  if (extraDone) return false;
  const type = kind === 1 ? 'cypress' : kind === 2 ? 'pine' : ((hex >> 16) & 255) > 200 && (hex & 255) > 150 ? 'blossom' : 'round';
  // manzillardagi multfilm ranglari (0x5cab4a ...) tabiiy palitraga almashtiriladi: to'q hex — to'q yashil, qolgani — oddiy yashil
  const pal = type === 'blossom' ? TINT.sakura : type === 'cypress' ? TINT.poplar : type === 'pine' || ((hex >> 8) & 255) < 140 ? TINT.dark : TINT.green;
  EXTRA_TREES.push([type, x, y, z, s, rot, pal[(hash2(Math.round(x * 3), Math.round(z * 3), 93) * pal.length) | 0]]); return true;
}
export function buildProps(scene, game) {
  const P = floraProtos(), LM = leafMaterial();
  const CS = 200, NCH = T.SIZE / CS, STEP = 9.5;
  const chunks = new Array(NCH * NCH);
  const cnt = {};
  const put = (type, x, y, z, s, rot, hex) => {
    const ci = clamp(((x + T.HALF) / CS) | 0, 0, NCH - 1), cj = clamp(((z + T.HALF) / CS) | 0, 0, NCH - 1);
    const c = chunks[cj * NCH + ci] || (chunks[cj * NCH + ci] = { ci, cj, items: {} });
    const arr = c.items[type] || (c.items[type] = []), k = arr.length / 6; arr.push(x, y, z, s, rot, hex);
    cnt[type] = (cnt[type] || 0) + 1;
    const pr = P[type];
    if (type === 'stone') T.addBump(x, z, s * 0.95, s * 0.4);
    else if (type === 'rock' && s <= 0.75) T.addBump(x, z, s * 0.95, s * 0.6);
    else if (pr.colR > 0) COL.addCircle(x, z, pr.colR * (type === 'rock2' && s <= 0.75 ? 0.8 : 1) * s, y - 1, y + pr.colH * s, 0, TREES[type] ? { tree: type, x, y, z, s, rot, hex, k, c, sy: 0.92 + ((k * 7919) % 100) / 620 } : null);
  };
  const pick = (arr, h) => arr[Math.min(arr.length - 1, (h * arr.length) | 0)];
  const blocked = (x, z, pad) => {
    for (const p of T.PLACES) { if (p.rect) { if (Math.abs(x - p.x) < p.rect.hl + 25 && Math.abs(z - p.z) < p.rect.hw + 25) return true; } else if ((x - p.x) * (x - p.x) + (z - p.z) * (z - p.z) < (p.r + pad) * (p.r + pad)) return true; }
    for (const e of T.exclusions) if ((x - e.x) * (x - e.x) + (z - e.z) * (z - e.z) < e.r * e.r) return true;
    return false;
  };
  const nI = Math.floor(T.SIZE / STEP);
  const places = T.PLACES;
  for (let j = 0; j < nI; j++) for (let i = 0; i < nI; i++) {
    const h0 = hash2(i, j, 11);
    const x = -T.HALF + (i + hash2(i, j, 1)) * STEP, z = -T.HALF + (j + hash2(i, j, 2)) * STEP;
    const y = T.gridHeight(x, z);
    if (y < 1.6) continue;
    const bio = T.biomeAt(x + (hash2(i, j, 3) - 0.5) * 70, z + (hash2(i, j, 4) - 0.5) * 70);
    // tezkor zichlik tekshiruvi (ko'p kataklar bo'sh qoladi)
    const dens = bio === B.TAIGA ? 0.5 : bio === B.AUTUMN ? 0.52 : bio === B.SAKURA ? 0.24 : bio === B.SNOW ? 0.16 : bio === B.VOLCANIC ? 0.13 : 0.11;
    // mayda toshlar (ustidan yurish mumkin — g'ildirak sakraydi)
    if (hash2(i, j, 12) < STONE_P[bio]) { const xs = -T.HALF + (i + hash2(i, j, 13)) * STEP, zs = -T.HALF + (j + hash2(i, j, 14)) * STEP, s2 = T.siteInfo(xs, zs);
      if (s2.roadD > 1.5 && s2.slope < 0.55 && s2.y > s2.water + 0.3 && s2.y > 1.2 && !blocked(xs, zs, 4)) put('stone', xs, s2.y, zs, 0.32 + hash2(i, j, 15) * hash2(i, j, 16) * 0.95, hash2(i, j, 17) * 6.283, pick(bio === B.CANYON || bio === B.DESERT ? TINT.redrock : bio === B.VOLCANIC ? TINT.darkrock : bio === B.SNOW ? TINT.snowrock : bio === B.BEACH ? TINT.sand : TINT.rock, hash2(i, j, 18))); }
    if (h0 > dens) continue;
    const u = h0 / dens; // 0..1 ichida qayta taqsimlangan
    const si = T.siteInfo(x, z);
    if (si.roadD < 4.2 || si.slope > 0.62 || y < si.water + 0.5) continue;
    if (blocked(x, z, 12)) continue;
    const clump = noise(x * 0.006 + 30, z * 0.006 - 12), h1 = hash2(i, j, 5), h2 = hash2(i, j, 6), rot = h2 * 6.283;
    const s = 0.78 + h1 * 0.6;
    const near = si.roadD < 9 ? 0.6 : 1; // yo'l yoqasida siyrakroq
    switch (bio) {
      case B.MEADOW:
        if (u < 0.3 * smoothstep(0.05, 0.5, clump) * near) put(h2 < 0.75 ? 'round' : 'oval', x, y, z, s * 1.05, rot, pick(TINT.green, h1));
        else if (u < 0.55 && u > 0.36) put('bush', x, y, z, s * (T.lavAt(x, z) ? 0.8 : 1), rot, T.lavAt(x, z) ? pick(TINT.lav, h1) : pick(TINT.green, h1));
        else if (u > 0.92) put(h2 < 0.6 ? 'rock' : 'rock2', x, y, z, 0.5 + h1 * 1.3, rot, pick(TINT.rock, h2));
        else if (u > 0.86 && clump < -0.2) put('cypress', x, y, z, s, rot, pick(TINT.poplar, h1));
        break;
      case B.SAKURA:
        if (u < 0.62 * near) put(h2 < 0.8 ? 'blossom' : 'round', x, y, z, s * 1.1, rot, pick(TINT.sakura, h1));
        else if (u < 0.78) put('bush', x, y, z, s, rot, h2 < 0.5 ? pick(TINT.sakura, h1) : pick(TINT.green, h1));
        else if (u > 0.95) put('rock', x, y, z, 0.5 + h1, rot, pick(TINT.rock, h2));
        break;
      case B.AUTUMN:
        if (clump < -0.45 && u < 0.9) break; // o'rmon yalangliklari
        if (u < 0.62 * near) put(h2 < 0.62 ? 'round' : 'oval', x, y, z, s * 1.15, rot, pick(h2 < 0.62 ? TINT.autumn : TINT.birch, h1));
        else if (u < 0.8 * near) put('pine', x, y, z, s, rot, pick(TINT.dark, h1));
        else if (u < 0.9) put('bush', x, y, z, s, rot, pick(TINT.autumn, h1));
        else if (u > 0.96) put('rock', x, y, z, 0.5 + h1 * 1.2, rot, pick(TINT.rock, h2));
        break;
      case B.TAIGA:
        if (clump < -0.5 && u < 0.92) break;
        if (u < 0.8 * near) put('pine', x, y, z, s * 1.1, rot, pick(TINT.dark, h1));
        else if (u < 0.88) put('bush', x, y, z, s, rot, pick(TINT.dark, h1));
        else if (u > 0.94) put(h2 < 0.5 ? 'rock' : 'rock2', x, y, z, 0.6 + h1 * 1.5, rot, pick(TINT.rock, h2));
        break;
      case B.SNOW: {
        const alt = smoothstep(380, 230, y);
        if (u < 0.55 * alt * near) put('pineSnow', x, y, z, s, rot, pick(TINT.dark, h1));
        else if (u > 0.8) put(h2 < 0.5 ? 'rock' : 'rock2', x, y, z, 0.6 + h1 * 1.6, rot, pick(TINT.snowrock, h2));
        break;
      }
      case B.DESERT:
        if (u < 0.2) put('cactus', x, y, z, s, rot, pick(TINT.cactus, h1));
        else if (u < 0.45) put('shrub', x, y, z, s * 0.7, rot, pick(TINT.dry, h1));
        else if (u > 0.82) put(h2 < 0.5 ? 'rock' : 'rock2', x, y, z, 0.5 + h1 * 1.6, rot, pick(TINT.redrock, h2));
        else if (u > 0.76) put('dead', x, y, z, s, rot, pick(TINT.deadwood, h1));
        break;
      case B.SAVANNA:
        if (u < 0.3) put('acacia', x, y, z, s * 1.2, rot, pick(TINT.savanna, h1));
        else if (u < 0.62) put('shrub', x, y, z, s * 0.8, rot, pick(TINT.dry, h1));
        else if (u > 0.9) put('rock', x, y, z, 0.5 + h1 * 1.3, rot, pick(TINT.rock, h2));
        break;
      case B.CANYON:
        if (u < 0.5) put(h2 < 0.5 ? 'rock' : 'rock2', x, y, z, 0.6 + h1 * 2.0, rot, pick(TINT.redrock, h2));
        else if (u < 0.65) put('cactus', x, y, z, s, rot, pick(TINT.cactus, h1));
        else if (u < 0.78) put('dead', x, y, z, s, rot, pick(TINT.deadwood, h1));
        else if (u < 0.92) put('shrub', x, y, z, s * 0.7, rot, pick(TINT.dry, h1));
        break;
      case B.VOLCANIC:
        if (u < 0.6) put(h2 < 0.5 ? 'rock' : 'rock2', x, y, z, 0.6 + h1 * 2.2, rot, pick(TINT.darkrock, h2));
        else if (u < 0.85) put('dead', x, y, z, s * 1.1, rot, pick(TINT.burnt, h1));
        break;
      case B.BEACH:
        if (y > 2.0 && z > 900 && u < 0.5) put('palm', x, y, z, s * 1.15, rot, pick(TINT.palm, h1));
        else if (u > 0.85) put('rock', x, y, z, 0.4 + h1 * 1.1, rot, pick(TINT.sand, h2));
        break;
    }
  }
  extraDone = true;
  for (const [type, x, y, z, s, rot, hex] of EXTRA_TREES) { // kollayder va g'ildirak do'ngchasisiz
    const ci = clamp(((x + T.HALF) / CS) | 0, 0, NCH - 1), cj = clamp(((z + T.HALF) / CS) | 0, 0, NCH - 1), c = chunks[cj * NCH + ci] || (chunks[cj * NCH + ci] = { ci, cj, items: {} });
    (c.items[type] || (c.items[type] = [])).push(x, y, z, s, rot, hex); cnt[type] = (cnt[type] || 0) + 1;
  }
  const dummy = new THREE.Object3D(), color = new THREE.Color();
  // Yo'ldagi toshlar (piyoda olib tashlash mumkin)
  { const R = T.roads, avoid = ROAD_RAMPS.concat(RADARS).map(([k, f]) => edgePoint(k, f)), list = [];
    for (const e of R.edges) for (let k = 14; k < e.count - 14; k++) {
      const i = e.start + k; if (R.bridge[i] || R.bridge[i - 2] || R.bridge[i + 2]) continue;
      const bio = T.biomeAt(R.x[i], R.z[i]), pr = (e.type ? 0.085 : 0.034) * (bio === B.CANYON || bio === B.VOLCANIC || bio === B.SNOW ? 1.7 : bio === B.DESERT ? 1.3 : 1);
      if (hash2(i, e.id, 51) > pr) continue;
      const off = (hash2(i, e.id, 52) - 0.5) * 2 * e.hw * 0.8, x = R.x[i] + R.tz[i] * off, z = R.z[i] - R.tx[i] * off;
      if (blocked(x, z, 30) || avoid.some((a) => (a.x - x) * (a.x - x) + (a.z - z) * (a.z - z) < 70 * 70)) continue;
      const r = 0.3 + hash2(i, e.id, 53) * (e.type ? 0.42 : 0.26), h = r * 0.4 + 0.03;
      list.push(T.addBump(x, z, r, h, { road: true, i: list.length, y: R.y[i], hex: pick(bio === B.CANYON || bio === B.DESERT ? TINT.redrock : bio === B.VOLCANIC ? TINT.darkrock : bio === B.SNOW ? TINT.snowrock : TINT.rock, hash2(i, e.id, 54)) })); }
    const im = new THREE.InstancedMesh(P.stone.hi, MAT.tree, Math.max(1, list.length)); im.frustumCulled = false; im.castShadow = true;
    list.forEach((b, k) => { dummy.position.set(b.x, b.y - 0.02, b.z); dummy.rotation.set(0, k * 1.7, 0); dummy.scale.set(b.r / 0.95, b.h / 0.4, b.r / 0.95); dummy.updateMatrix(); im.setMatrixAt(k, dummy.matrix); im.setColorAt(k, color.setHex(b.hex)); });
    scene.add(im); cnt.roadStone = list.length;
    T.setBumpHook((b) => { dummy.position.set(0, -999, 0); dummy.scale.setScalar(0.001); dummy.updateMatrix(); im.setMatrixAt(b.i, dummy.matrix); im.instanceMatrix.needsUpdate = true; }); }
  // Nusxali meshlar
  const list = [];
  const group = new THREE.Group();
  for (const c of chunks) {
    if (!c) continue;
    c.meshes = [];
    c.cx = -T.HALF + (c.ci + 0.5) * CS; c.cz = -T.HALF + (c.cj + 0.5) * CS;
    for (const type in c.items) {
      const a = c.items[type], n = a.length / 6, pr = P[type];
      const hi = new THREE.InstancedMesh(pr.hi, MAT.tree, n), lo = new THREE.InstancedMesh(pr.lo, MAT.tree, n), hc = pr.cards ? new THREE.InstancedMesh(pr.cards, LM, n) : null;
      const md = pr.md ? new THREE.InstancedMesh(pr.md === 'lo' ? pr.lo : pr.md, MAT.tree, n) : null; // 0-darajada yaqin masofa varianti (kartasiz; soya tashlaydi)
      for (let k = 0; k < n; k++) {
        const o = k * 6, s = a[o + 3];
        dummy.position.set(a[o], a[o + 1], a[o + 2]); dummy.rotation.set(0, a[o + 4], 0); dummy.scale.set(s, s * (0.92 + ((k * 7919) % 100) / 620), s); dummy.updateMatrix();
        hi.setMatrixAt(k, dummy.matrix); hi.setColorAt(k, vary(color.setHex(a[o + 5]), a[o], a[o + 2], type));
      }
      lo.instanceMatrix = hi.instanceMatrix; lo.instanceColor = hi.instanceColor;
      hi.computeBoundingSphere(); lo.boundingSphere = hi.boundingSphere;
      if (md) { md.instanceMatrix = hi.instanceMatrix; md.instanceColor = hi.instanceColor; md.castShadow = type !== 'bush' && type !== 'shrub'; md.receiveShadow = false; md.matrixAutoUpdate = false; md.visible = false; group.add(md); }
      if (hc) { hc.instanceMatrix = hi.instanceMatrix; hc.instanceColor = hi.instanceColor; hc.computeBoundingSphere(); if (hc.boundingSphere.radius > hi.boundingSphere.radius) hi.boundingSphere = lo.boundingSphere = hc.boundingSphere; else hc.boundingSphere = hi.boundingSphere; }
      if (md) md.boundingSphere = hi.boundingSphere;
      hi.castShadow = type !== 'bush' && type !== 'shrub' && type !== 'stone'; hi.receiveShadow = false; lo.castShadow = false;
      hi.matrixAutoUpdate = false; lo.matrixAutoUpdate = false; hi.visible = false; lo.visible = false;
      group.add(hi); group.add(lo);
      if (hc) { hc.castShadow = hi.castShadow; hc.receiveShadow = false; hc.matrixAutoUpdate = false; hc.visible = false; group.add(hc); }
      // [batafsil, barg kartalari, uzoq, 0-daraja yaqin varianti yoki null]
      c.meshes.push(hi, hc, lo, md); (c.inst || (c.inst = {}))[type] = hi; if (type === 'stone') lo.userData.skip = true;
    }
    c.items = null;
    list.push(c);
  }
  scene.add(group);

  // Sifat darajasi: game.state.set.gfx (applyQuality uni hiD dan oldin yozadi); api.lite = true/false bilan majburlash mumkin
  const tier = () => (api.lite != null ? (api.lite ? 0 : 2) : game && game.state && game.state.set ? game.state.set.gfx : 2);
  const api = {
    counts: cnt, chunks: list, far: 1500, hiD: 330, lite: null,
    update(cam) {
      // 0-darajada barg kartalari (alfa-test, ortiqcha chizish) umuman chizilmaydi: yaqinda kartasiz o'rta variant (md), toshlarda det-1 — eski narxda
      const px = cam.position.x, pz = cam.position.z, t0 = tier() === 0 ? 8 : 0; FLORA_U.uFlLite.value = t0 ? 1 : 0;
      for (let i = 0; i < list.length; i++) {
        const c = list[i]; const d = Math.hypot(c.cx - px, c.cz - pz);
        const st = (d < api.hiD ? 1 : d < api.far ? 2 : 0) + t0;
        if (st !== c.st) { c.st = st; const M = c.meshes, s1 = st & 3, lite = st & 8;
          for (let k = 0; k < M.length; k += 4) { const h = lite && s1 === 1 && M[k + 3] ? 3 : s1; // h: 1 batafsil (+kartalar), 2 uzoq, 3 o'rta
            M[k].visible = h === 1; if (M[k + 1]) M[k + 1].visible = h === 1; M[k + 2].visible = h === 2 && !M[k + 2].userData.skip; if (M[k + 3]) M[k + 3].visible = h === 3; } }
      }
    },
  };
  return api;
}

// --- Yaqin atrofdagi o't va gullar: zich o'tloq (yaqin halqa — egri poyali zich yamoqlar, uzoq halqa — siyrakroq), shamolda tebranadi, chetida yer rangiga singib yo'qoladi ---
export function buildDetail(scene) {
  const NN = 900, N = 2600, NF = 2000;
  const gm = grassMaterial();
  const gSparse = grassPatch(6, 40, false), gLite = grassPatch(8, 16, false, 6); // gLite — 0-daraja uchun arzon yamoq (22 uchburchak, eski o't narxida); geometriya almashtirish sheyderni qayta kompilyatsiya qilmaydi
  const near = new THREE.InstancedMesh(grassPatch(5, 90, true), gm, NN), grass = new THREE.InstancedMesh(gSparse, gm, N), flowers = new THREE.InstancedMesh(flowerGeo(7), gm, NF);
  for (const m of [near, grass, flowers]) { m.frustumCulled = false; m.receiveShadow = true; m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(m.instanceMatrix.count * 3).fill(1), 3); m.count = 0; scene.add(m); }
  const dummy = new THREE.Object3D(), col = new THREE.Color(), gc3 = [0, 0, 0];
  let lx = 1e9, lz = 1e9;
  const CELL = 1.6, RMAX = 26, cuts = [];
  const PL = T.PLACES.filter((p) => !p.rect).map((p) => [p.x, p.z, p.id === 'uy' ? 32 * 32 : p.r * p.r, p.id === 'uy' ? 0 : 0.3]);
  // o't tusi (sRGB): yer rangi bilan aralashtiriladi; [palitra, yer rangining ulushi, ehtimol]
  const GC = { [B.MEADOW]: [[0x6f8a3a, 0x7a9440, 0x657f36], 0.45, 1], [B.SAKURA]: [[0x7a9a48, 0x6e8e42, 0x86a450], 0.45, 1], [B.AUTUMN]: [[0xb09048, 0xa08040, 0xbc9c58], 0.45, 1], [B.TAIGA]: [[0x5a7a40, 0x52703a, 0x648446], 0.45, 1],
    [B.SAVANNA]: [[0xb4a45e, 0xa89656, 0xc0b06a], 0.4, 1], [B.DESERT]: [[0xa89a62, 0x9a8c5a, 0xb4a672], 0.15, 0.22], [B.CANYON]: [[0x9a8c58, 0x8c8052, 0xa69a66], 0.15, 0.14], [B.BEACH]: [[0x9a9a5e, 0x8e9058, 0xa6a46a], 0.1, 0.12] };
  const LAV = [0x8a6cc4, 0x9c7cd0, 0x7e64b8], FC = { [B.MEADOW]: [0xf0eee6, 0xe2c23c, 0xd28caa, 0xf4f2ea, 0x9878c0, 0xe8e4d8], [B.SAKURA]: [0xf4d4de, 0xf6f2f0, 0xeab4c6], [B.AUTUMN]: [0xece0b8, 0xd08a48], [B.TAIGA]: [0xf2f0ea, 0x94b0d8], [B.SAVANNA]: [0xe4d48e, 0xf0ece0] };
  const PAL = {}; for (const b in GC) PAL[b] = GC[b][0].map((h) => { col.setHex(h); return [col.r, col.g, col.b]; });
  // yer rangi (T.grid.col, chiziqli) — ikki chiziqli interpolyatsiya
  const ground = (x, z) => { let fx = (x + T.HALF) / T.CELL, fz = (z + T.HALF) / T.CELL; fx = clamp(fx, 0, T.N - 0.001); fz = clamp(fz, 0, T.N - 0.001); const i = fx | 0, j = fz | 0, u = fx - i, v = fz - j, C = T.grid.col, k = (j * T.NV + i) * 3, k2 = k + T.NV * 3;
    for (let c = 0; c < 3; c++) gc3[c] = (C[k + c] * (1 - u) + C[k + 3 + c] * u) * (1 - v) + (C[k2 + c] * (1 - u) + C[k2 + 3 + c] * u) * v; return gc3; };
  const api = {
    dens: 1,
    excl: [], // o't o'smaydigan to'rtburchaklar {x, z, yaw, hx, hz} (masalan, bug'doy dalasi — ish.js) — qo'shilgach lx = 1e9 qiling
    cut(x, z) { cuts.push([x, z]); if (cuts.length > 80) cuts.shift(); lx = 1e9; },
    update(cam, force) {
      const cx = cam.position.x, cz = cam.position.z;
      if (!force && Math.abs(cx - lx) < 4 && Math.abs(cz - lz) < 4) return;
      lx = cx; lz = cz;
      const dn = api.dens, R = dn < 0.5 ? 18 : dn < 0.9 ? 23 : RMAX, RN = dn < 0.5 ? 0 : dn < 0.9 ? 8 : 11, RD = R * CELL;
      const i0 = Math.floor(cx / CELL), j0 = Math.floor(cz / CELL), R2 = RD * RD, fill = 0.8 + 0.15 * dn, fk = dn < 0.5 ? 0.35 : 0.5 + 0.5 * dn;
      const gg = dn < 0.5 ? gLite : gSparse; if (grass.geometry !== gg) grass.geometry = gg;
      let nn = 0, ng = 0, nf = 0;
      for (let j = j0 - R; j <= j0 + R; j++) for (let i = i0 - R; i <= i0 + R; i++) {
        const h = hash2(i, j, 21);
        if (h > fill) continue;
        const x = (i + hash2(i, j, 22)) * CELL, z = (j + hash2(i, j, 23)) * CELL;
        const dx = x - cx, dz = z - cz, d2 = dx * dx + dz * dz; if (d2 > R2) continue;
        const bio = T.biomeAt(x, z), gcb = GC[bio]; if (!gcb) continue;
        if (h > fill * gcb[2]) continue;
        const y = T.gridHeight(x, z);
        if (y < T.waterY(x, z) + 0.25) continue;
        const nr = T.nearestRoad(x, z, 1); if (nr.edge >= 0 && nr.d < nr.hw + 1.5) continue;
        const sf = T.ground(x, z, 1e9).surf; if (sf !== T.SURF.GRASS && sf !== T.SURF.SAND) continue;
        let ex = false; for (let k = 0; k < api.excl.length; k++) { const q = api.excl[k], dx = x - q.x, dz = z - q.z, c = Math.cos(q.yaw), sn = Math.sin(q.yaw); if (Math.abs(dx * c - dz * sn) < q.hx && Math.abs(dx * sn + dz * c) < q.hz) { ex = true; break; } } if (ex) continue;
        let cutHere = false; for (let k = 0; k < cuts.length; k++) { const q = cuts[k]; if ((q[0] - x) * (q[0] - x) + (q[1] - z) * (q[1] - z) < 2.2) { cutHere = true; break; } } if (cutHere) continue;
        let inPl = false, pf = 1; for (let k = 0; k < PL.length; k++) { const q = PL[k], dd = (q[0] - x) * (q[0] - x) + (q[1] - z) * (q[1] - z); if (dd < q[2] && hash2(i, j, 27) >= q[3]) { inPl = true; break; } if (q[3] === 0 && dd < q[2] + 600) pf = Math.min(pf, (Math.sqrt(dd) - Math.sqrt(q[2])) / 9); } if (inPl) continue; // joy chegarasida o'tlar asta-sekin pasayadi
        const lav = bio === B.MEADOW && T.lavAt(x, z), d = Math.sqrt(d2), fade = (1 - smoothstep(0.55 * RD, RD, d)) * smoothstep(0, 1, pf), h4 = hash2(i, j, 24), s = 0.75 + h4 * 0.6;
        // rang: yer rangi va o't palitrasi aralashmasi, chetga yaqinlashgan sari faqat yer rangi
        const g = ground(x, z), pl = PAL[bio][(hash2(i, j, 26) * 3) | 0], gw = lerp(gcb[1], 1, 1 - fade) , vk = 0.9 + hash2(i, j, 28) * 0.22, gain = lerp(1.18, 1.0, 1 - fade);
        col.setRGB(lerp(pl[0], g[0], gw) * gain * vk, lerp(pl[1], g[1], gw) * gain * vk, lerp(pl[2], g[2], gw) * gain * vk);
        dummy.position.set(x, y - 0.03, z); dummy.rotation.set(0, h * 40, 0); dummy.scale.set(s, s * (0.12 + 0.88 * fade) * (0.8 + hash2(i, j, 29) * 0.45), s); dummy.updateMatrix();
        const useNear = RN > 0 && (d < RN - 2.5 || (d < RN + 2.5 && hash2(i, j, 30) > (d - RN + 2.5) / 5));
        if (useNear && nn < NN) { near.setMatrixAt(nn, dummy.matrix); near.setColorAt(nn, col); nn++; }
        else if (ng < N) { grass.setMatrixAt(ng, dummy.matrix); grass.setColorAt(ng, col); ng++; }
        // gullar (o'tga qo'shimcha, o'rnini egallamaydi)
        const hf = hash2(i, j, 31), fc = lav ? LAV : FC[bio];
        const fp = fc && !lav ? smoothstep(-0.1, 0.6, noise(x * 0.045 + 3.1, z * 0.045 - 7.7)) : 0; // gullar to'p-to'p (dog'lar) bo'lib o'sadi
        if (fc && nf < NF && d < RD * 0.8 && (hf < (0.06 + 0.5 * fp) * fk || (lav && hf < 0.85 * fk))) {
          for (let q = 0; q < (lav ? 4 : 1 + ((hf * 37) % 1 < fp ? 2 : 0)) && nf < NF; q++) {
            let fx = x + (hash2(i, j, 32 + q) - 0.5) * 1.3, fz = z + (hash2(i, j, 35 + q) - 0.5) * 1.3;
            if (lav) { const u = fx * 0.8 + fz * 0.6, du = Math.round(u / 1.7) * 1.7 - u; fx += du * 0.8; fz += du * 0.6; } // lavanda tekis qatorlarda
            const fsc = (0.75 + hash2(i, j, 38 + q) * 0.6) * (0.3 + 0.7 * fade) * (lav ? 1.4 : 1);
            dummy.position.set(fx, T.gridHeight(fx, fz) - 0.02, fz); dummy.rotation.set((hash2(i, j, 41 + q) - 0.5) * 1.1, hf * 50 + q, (hash2(i, j, 44 + q) - 0.5) * 1.1); dummy.scale.set(fsc, fsc * (lav ? 1.5 : 1), fsc); dummy.updateMatrix();
            flowers.setMatrixAt(nf, dummy.matrix); col.setHex(fc[(hash2(i, j, 25 + q) * fc.length) | 0]); flowers.setColorAt(nf, col); nf++;
          }
        }
      }
      near.count = nn; grass.count = ng; flowers.count = nf;
      for (const m of [near, grass, flowers]) { m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
    },
  };
  return api;
}
