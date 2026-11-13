// Tabiat obyektlari: daraxtlar, toshlar, butalar (nusxali, LOD bilan) va yaqin atrofdagi o't-gullar
import * as THREE from 'three';
import * as T from './terrain.js';
import { GB, MAT, WIND } from './geo.js';
import { ROAD_RAMPS, RADARS, edgePoint } from './acts.js';
import { hash2, clamp, lerp, noise, smoothstep } from './util.js';
import * as COL from './colliders.js';

const B = T.BIOME;
const TREES = { round: 1, oval: 1, blossom: 1, pine: 1, pineSnow: 1, cypress: 1, acacia: 1, palm: 1, cactus: 1, dead: 1 };
const STONE_P = [0.05, 0.07, 0.1, 0.2, 0.42, 0.3, 0.08, 0.03, 0.1, 0.42];

function protos() {
  const P = {};
  const mk = (name, hiF, loF, colR, colH) => { const a = new GB(name.length * 31 + 7); a.jit = 0; hiF(a); const b = new GB(name.length * 17 + 3); b.jit = 0; loF(b); P[name] = { hi: a.build(), lo: b.build(), colR, colH }; };
  const TRUNK = 0x7a5236, TRUNK2 = 0x5e4030;
  mk('round', (g) => {
    g.color(TRUNK).mask(0).cyl(7, 0.32, 0.2, -0.3, 3.4, { shade: 0.12 });
    g.color(0xffffff).mask(1);
    g.blob(2.2, 1, { cy: 4.7, jitter: 0.09, shade: 0.22, sy: 0.92 });
    g.blob(1.55, 1, { cx: 1.25, cy: 3.7, cz: 0.4, jitter: 0.1, shade: 0.22 });
    g.blob(1.45, 1, { cx: -1.15, cy: 3.9, cz: -0.5, jitter: 0.1, shade: 0.22 });
  }, (g) => { g.color(TRUNK).mask(0).cyl(4, 0.32, 0.2, -0.3, 3.2); g.color(0xffffff).mask(1).blob(2.5, 0, { cy: 4.4, sy: 0.9, shade: 0.22 }); }, 0.38, 6.5);
  mk('oval', (g) => {
    g.color(0xd8d2c4).mask(0).cyl(6, 0.2, 0.14, -0.3, 4.2, { shade: 0.1 });
    g.color(0xffffff).mask(1).blob(1.5, 1, { cy: 6.2, sy: 1.9, jitter: 0.08, shade: 0.2 });
  }, (g) => { g.color(0xd8d2c4).mask(0).cyl(4, 0.2, 0.14, -0.3, 4.2); g.color(0xffffff).mask(1).blob(1.5, 0, { cy: 6.2, sy: 1.9, shade: 0.2 }); }, 0.28, 8);
  mk('blossom', (g) => {
    g.color(TRUNK2).mask(0).cyl(7, 0.3, 0.18, -0.3, 2.6, { shade: 0.12 });
    g.push().translate(0, 2.4, 0).rotZ(0.6); g.cyl(5, 0.14, 0.08, 0, 1.6); g.pop(); g.push().translate(0, 2.4, 0).rotZ(-0.7).rotY(1); g.cyl(5, 0.14, 0.08, 0, 1.5); g.pop();
    g.color(0xffffff).mask(1);
    g.blob(1.9, 1, { cy: 4.2, sy: 0.7, jitter: 0.1, shade: 0.18 });
    g.blob(1.5, 1, { cx: 1.7, cy: 3.6, cz: 0.3, sy: 0.72, jitter: 0.1, shade: 0.18 });
    g.blob(1.5, 1, { cx: -1.6, cy: 3.7, cz: -0.4, sy: 0.72, jitter: 0.1, shade: 0.18 });
    g.blob(1.2, 1, { cx: 0.2, cy: 3.5, cz: 1.6, sy: 0.7, jitter: 0.1, shade: 0.18 });
  }, (g) => { g.color(TRUNK2).mask(0).cyl(4, 0.3, 0.18, -0.3, 2.8); g.color(0xffffff).mask(1).blob(2.9, 0, { cy: 3.9, sy: 0.6, shade: 0.2 }); }, 0.36, 5);
  const pine = (snow) => (g) => {
    g.color(TRUNK2).mask(0).cyl(6, 0.3, 0.2, -0.3, 2.4, { shade: 0.1 });
    const tiers = [[2.5, 1.7, 5.4], [2.0, 4.0, 7.6], [1.45, 6.3, 9.8], [0.9, 8.6, 11.6]];
    for (const [r, y0, y1] of tiers) {
      g.color(0xffffff).mask(1).cyl(10, r, 0, y0, y1, { shade: 0.2 });
      g.color(0xffffff).mask(1); for (let i = 1; i < 9; i++) { const a = (i / 10) * 6.283, b = ((i + 1) / 10) * 6.283; g.triS([0, y0, r], [Math.sin(b) * r, y0, Math.cos(b) * r], [Math.sin(a) * r, y0, Math.cos(a) * r], [0, -1, 0], [0, -1, 0], [0, -1, 0], 0.62, 0.62, 0.62); }
      if (snow) { g.color(0xf6f9ff).mask(0).cyl(10, r * 0.66, 0, y0 + (y1 - y0) * 0.36, y1 + 0.06, { shade: 0.05 }); }
    }
  };
  const pineLo = (snow) => (g) => { g.color(TRUNK2).mask(0).cyl(4, 0.3, 0.2, -0.3, 2.4); g.color(0xffffff).mask(1).cyl(6, 2.4, 0, 1.8, 7.2, { shade: 0.2 }); g.cyl(6, 1.5, 0, 5.6, 11.4, { shade: 0.2 }); if (snow) { g.color(0xf6f9ff).mask(0).cyl(6, 1.5, 0, 3.9, 7.26); g.cyl(6, 0.95, 0, 7.8, 11.46); } };
  mk('pine', pine(false), pineLo(false), 0.34, 11);
  mk('pineSnow', pine(true), pineLo(true), 0.34, 11);
  mk('cypress', (g) => { g.color(TRUNK2).mask(0).cyl(5, 0.2, 0.16, -0.3, 1.2); g.color(0xffffff).mask(1).blob(1.05, 1, { cy: 5.0, sy: 4.0, jitter: 0.05, shade: 0.1 }); },
    (g) => { g.color(0xffffff).mask(1).blob(1.05, 0, { cy: 5.0, sy: 4.0, shade: 0.1 }); }, 0.5, 9);
  mk('acacia', (g) => {
    g.color(0x6e5038).mask(0); g.push().rotZ(0.12); g.cyl(6, 0.28, 0.16, -0.3, 3.6, { shade: 0.1 }); g.pop();
    g.push().translate(-0.4, 3.4, 0).rotZ(0.75); g.cyl(5, 0.14, 0.08, 0, 2.2); g.pop(); g.push().translate(-0.4, 3.4, 0).rotZ(-0.6).rotY(0.8); g.cyl(5, 0.14, 0.08, 0, 2.0); g.pop();
    g.color(0xffffff).mask(1);
    g.blob(2.7, 1, { cx: -0.3, cy: 5.3, sy: 0.3, jitter: 0.08, shade: 0.3 });
    g.blob(1.7, 1, { cx: -2.2, cy: 4.9, cz: 0.6, sy: 0.3, jitter: 0.08, shade: 0.3 });
    g.blob(1.6, 1, { cx: 1.7, cy: 4.8, cz: -0.8, sy: 0.3, jitter: 0.08, shade: 0.3 });
  }, (g) => { g.color(0x6e5038).mask(0).cyl(4, 0.28, 0.16, -0.3, 4.6); g.color(0xffffff).mask(1).blob(3.3, 0, { cx: -0.3, cy: 5.2, sy: 0.26, shade: 0.3 }); }, 0.34, 5.5);
  mk('palm', (g) => {
    g.color(0x9a7a56).mask(0);
    let x = 0, y = -0.3; const segs = 6;
    for (let i = 0; i < segs; i++) { const lean = 0.05 + i * 0.045; g.push().translate(x, y, 0).rotZ(-lean); g.cyl(6, 0.26 - i * 0.02, 0.24 - i * 0.02, 0, 1.25, { shade: 0.06 }); g.pop(); x += Math.sin(lean) * 1.2; y += Math.cos(lean) * 1.2; }
    g.color(0xffffff).mask(1); g.jit = 0.05;
    for (let i = 0; i < 8; i++) { g.push().translate(x, y, 0).rotY((i / 8) * 6.283 + 0.2).rotX(0.5 + (i % 2) * 0.22); g.box(0, 0, 1.5, 0.75, 0.06, 3.0, { tx: 0.15 }); g.pop(); g.push().translate(x, y, 0).rotY((i / 8) * 6.283 + 0.2).rotX(0.5 + (i % 2) * 0.22).translate(0, 0, 2.9).rotX(0.7); g.box(0, 0, 0.6, 0.5, 0.05, 1.3, { tx: 0.1 }); g.pop(); }
    g.color(0x6b4a2e).mask(0); g.blob(0.22, 0, { cx: x + 0.25, cy: y - 0.25 }); g.blob(0.22, 0, { cx: x - 0.2, cy: y - 0.28, cz: 0.2 });
  }, (g) => { g.color(0x9a7a56).mask(0); g.push().rotZ(-0.2); g.cyl(4, 0.24, 0.16, -0.3, 7.4); g.pop(); g.color(0xffffff).mask(1).blob(2.8, 0, { cx: 1.45, cy: 7.1, sy: 0.3 }); }, 0.3, 7);
  mk('cactus', (g) => {
    g.color(0xffffff).mask(1).cyl(8, 0.42, 0.4, -0.2, 3.6, { shade: 0.12 }); g.blob(0.41, 1, { cy: 3.6, shade: 0.1 });
    g.push().translate(0.4, 1.5, 0).rotZ(-1.2); g.cyl(7, 0.26, 0.26, 0, 0.9); g.pop(); g.push().translate(1.2, 1.78, 0); g.cyl(7, 0.26, 0.24, 0, 1.3, { shade: 0.1 }); g.blob(0.25, 0, { cy: 1.3 }); g.pop();
    g.push().translate(-0.4, 2.1, 0).rotZ(1.2); g.cyl(7, 0.22, 0.22, 0, 0.7); g.pop(); g.push().translate(-1.02, 2.32, 0); g.cyl(7, 0.22, 0.2, 0, 0.9, { shade: 0.1 }); g.blob(0.21, 0, { cy: 0.9 }); g.pop();
  }, (g) => { g.color(0xffffff).mask(1).cyl(5, 0.42, 0.38, -0.2, 3.8); g.push().translate(1.2, 1.78, 0); g.cyl(4, 0.26, 0.24, 0, 1.3); g.pop(); }, 0.5, 3.6);
  mk('dead', (g) => {
    g.color(0xffffff).mask(1).cyl(6, 0.26, 0.12, -0.3, 4.2, { shade: 0.1 });
    for (const [y, rz, ry, l] of [[2.2, 0.9, 0, 1.9], [2.9, -0.8, 1.4, 1.6], [3.5, 0.7, 3.0, 1.3], [1.7, -1.0, 4.2, 1.2]]) { g.push().translate(0, y, 0).rotY(ry).rotZ(rz); g.cyl(5, 0.1, 0.04, 0, l); g.pop(); }
  }, (g) => { g.color(0xffffff).mask(1).cyl(4, 0.26, 0.1, -0.3, 4.2); g.push().translate(0, 2.4, 0).rotZ(0.9); g.cyl(3, 0.1, 0.04, 0, 1.8); g.pop(); }, 0.3, 4);
  mk('bush', (g) => { g.color(0xffffff).mask(1).blob(1.0, 1, { cy: 0.45, sy: 0.72, jitter: 0.14, shade: 0.25 }); g.blob(0.7, 1, { cx: 0.8, cy: 0.3, cz: 0.3, sy: 0.75, jitter: 0.14, shade: 0.25 }); },
    (g) => { g.color(0xffffff).mask(1).blob(1.15, 0, { cy: 0.4, sy: 0.7, shade: 0.25 }); }, 0, 1);
  mk('rock', (g) => { g.color(0xffffff).mask(1).blob(1.0, 1, { cy: 0.3, sy: 0.68, jitter: 0.2, freq: 3.3, shade: 0.14 }); },
    (g) => { g.color(0xffffff).mask(1).blob(1.0, 0, { cy: 0.3, sy: 0.68, shade: 0.14 }); }, 0.85, 1);
  mk('rock2', (g) => { g.color(0xffffff).mask(1).blob(1.0, 1, { cy: 0.5, sy: 1.15, sx: 0.8, jitter: 0.24, freq: 2.8, shade: 0.14 }); g.blob(0.6, 1, { cx: 0.8, cy: 0.1, cz: 0.4, sy: 0.7, jitter: 0.2, shade: 0.12 }); },
    (g) => { g.color(0xffffff).mask(1).blob(1.0, 0, { cy: 0.5, sy: 1.15, sx: 0.8, shade: 0.14 }); }, 0.8, 1.6);
  mk('stone', (g) => { g.color(0xffffff).mask(1).blob(1.0, 1, { cy: 0.0, sy: 0.44, jitter: 0.16, freq: 3.6, shade: 0.16 }); },
    (g) => { g.color(0xffffff).mask(1).blob(1.0, 0, { cy: 0.0, sy: 0.44, shade: 0.16 }); }, 0, 0.4);
  return P;
}

// Biom bo'yicha ranglar (sRGB hex)
const TINT = {
  green: [0x5cab4a, 0x6dbb50, 0x4f9e48, 0x7cc45a, 0x63b35c], dark: [0x2f7a52, 0x377f4c, 0x2a6e52, 0x3d8a58],
  autumn: [0xe8872e, 0xd9532b, 0xf0b63a, 0xc94a2a, 0xe6a12f, 0xb8452c], sakura: [0xf7a8c4, 0xf58fb5, 0xfbc4d6, 0xf7b7cf, 0xef86ad],
  savanna: [0x9bab4a, 0x8a9a44, 0xa8b452], palm: [0x4fae4e, 0x58b858], cactus: [0x5a9a52, 0x66a65a], dry: [0xb9a56a, 0xa8935c, 0xc4b274],
  deadwood: [0x8a7560, 0x7a6552], burnt: [0x2e2a2e, 0x38323a], rock: [0x9a9da6, 0x8b8e98, 0xa8abb2], redrock: [0xb4603f, 0xa3553a, 0xc26d48],
  darkrock: [0x4a454e, 0x3d3942, 0x57505a], snowrock: [0xb8c0d0, 0xd4dbe8], sand: [0xcdb88a, 0xbfa97a], snowbush: [0xe6ecf6, 0xd8e0ee], lav: [0x8f6fd0, 0xa184da],
};

export function buildProps(scene, game) {
  const P = protos();
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
        else if (u > 0.86 && clump < -0.2) put('cypress', x, y, z, s, rot, pick(TINT.dark, h1));
        break;
      case B.SAKURA:
        if (u < 0.62 * near) put(h2 < 0.8 ? 'blossom' : 'round', x, y, z, s * 1.1, rot, pick(TINT.sakura, h1));
        else if (u < 0.78) put('bush', x, y, z, s, rot, h2 < 0.5 ? pick(TINT.sakura, h1) : pick(TINT.green, h1));
        else if (u > 0.95) put('rock', x, y, z, 0.5 + h1, rot, pick(TINT.rock, h2));
        break;
      case B.AUTUMN:
        if (clump < -0.45 && u < 0.9) break; // o'rmon yalangliklari
        if (u < 0.62 * near) put(h2 < 0.62 ? 'round' : 'oval', x, y, z, s * 1.15, rot, pick(TINT.autumn, h1));
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
        else if (u < 0.45) put('bush', x, y, z, s * 0.7, rot, pick(TINT.dry, h1));
        else if (u > 0.82) put(h2 < 0.5 ? 'rock' : 'rock2', x, y, z, 0.5 + h1 * 1.6, rot, pick(TINT.redrock, h2));
        else if (u > 0.76) put('dead', x, y, z, s, rot, pick(TINT.deadwood, h1));
        break;
      case B.SAVANNA:
        if (u < 0.3) put('acacia', x, y, z, s * 1.2, rot, pick(TINT.savanna, h1));
        else if (u < 0.62) put('bush', x, y, z, s * 0.8, rot, pick(TINT.dry, h1));
        else if (u > 0.9) put('rock', x, y, z, 0.5 + h1 * 1.3, rot, pick(TINT.rock, h2));
        break;
      case B.CANYON:
        if (u < 0.5) put(h2 < 0.5 ? 'rock' : 'rock2', x, y, z, 0.6 + h1 * 2.0, rot, pick(TINT.redrock, h2));
        else if (u < 0.65) put('cactus', x, y, z, s, rot, pick(TINT.cactus, h1));
        else if (u < 0.78) put('dead', x, y, z, s, rot, pick(TINT.deadwood, h1));
        else if (u < 0.92) put('bush', x, y, z, s * 0.7, rot, pick(TINT.dry, h1));
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
      const hi = new THREE.InstancedMesh(pr.hi, MAT.tree, n), lo = new THREE.InstancedMesh(pr.lo, MAT.tree, n);
      for (let k = 0; k < n; k++) {
        const o = k * 6, s = a[o + 3];
        dummy.position.set(a[o], a[o + 1], a[o + 2]); dummy.rotation.set(0, a[o + 4], 0); dummy.scale.set(s, s * (0.92 + ((k * 7919) % 100) / 620), s); dummy.updateMatrix();
        hi.setMatrixAt(k, dummy.matrix); color.setHex(a[o + 5]); hi.setColorAt(k, color);
      }
      lo.instanceMatrix = hi.instanceMatrix; lo.instanceColor = hi.instanceColor;
      hi.computeBoundingSphere(); lo.boundingSphere = hi.boundingSphere;
      hi.castShadow = type !== 'bush' && type !== 'stone'; hi.receiveShadow = false; lo.castShadow = false;
      hi.matrixAutoUpdate = false; lo.matrixAutoUpdate = false; hi.visible = false; lo.visible = false;
      group.add(hi); group.add(lo);
      c.meshes.push(hi, lo); (c.inst || (c.inst = {}))[type] = hi; if (type === 'stone') lo.userData.skip = true;
    }
    c.items = null;
    list.push(c);
  }
  scene.add(group);

  const api = {
    counts: cnt, chunks: list, far: 1500, hiD: 330,
    update(cam) {
      const px = cam.position.x, pz = cam.position.z;
      for (let i = 0; i < list.length; i++) {
        const c = list[i]; const d = Math.hypot(c.cx - px, c.cz - pz);
        const st = d < api.hiD ? 1 : d < api.far ? 2 : 0;
        if (st !== c.st) { c.st = st; for (let k = 0; k < c.meshes.length; k += 2) { c.meshes[k].visible = st === 1; c.meshes[k + 1].visible = st === 2 && !c.meshes[k + 1].userData.skip; } }
      }
    },
  };
  return api;
}

// --- Yaqin atrofdagi o't va gullar: shamolda tebranadi, kamera bilan birga ko'chadi ---
export function buildDetail(scene) {
  const N = 2600;
  const g = new GB(5); g.jit = 0; g.color(0xffffff);
  const up = [0, 1, 0];
  for (let i = 0; i < 7; i++) {
    const a = i * 0.9 + 0.3, lean = 0.12 + (i % 3) * 0.16, h = 0.3 + (i % 4) * 0.075, w = 0.034 + (i % 2) * 0.012, ox = Math.sin(i * 2.1) * 0.2, oz = Math.cos(i * 1.7) * 0.2;
    const c = Math.cos(a), s = Math.sin(a), P = (u, y) => [ox + c * u + s * lean * y, y, oz - s * u + c * lean * y];
    g.triS(P(-w, 0), P(w, 0), P(w * 0.6, h * 0.55), up, up, up, 0.74, 0.74, 0.98); g.triS(P(-w, 0), P(w * 0.6, h * 0.55), P(-w * 0.6, h * 0.55), up, up, up, 0.74, 0.98, 0.98); g.triS(P(-w * 0.6, h * 0.55), P(w * 0.6, h * 0.55), P(0, h), up, up, up, 0.98, 0.98, 1.22);
  }
  const sway = (mat, amp) => { mat.onBeforeCompile = (sh) => { sh.uniforms.uTime = WIND; sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      #ifdef USE_INSTANCING
        vec4 wpI = instanceMatrix * vec4(position, 1.0); float swy = position.y * position.y * ${amp.toFixed(2)};
        transformed.x += (sin(uTime * 1.9 + wpI.x * 0.35 + wpI.z * 0.27) * 0.36 + sin(uTime * 4.3 + wpI.x * 1.3) * 0.09) * swy;
        transformed.z += cos(uTime * 1.6 + wpI.x * 0.22 - wpI.z * 0.31) * 0.3 * swy;
      #endif`); }; return mat; };
  const grass = new THREE.InstancedMesh(g.build(), sway(new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }), 2.6), N);
  const f = new GB(6); f.jit = 0; f.color(0x5a9a4a).mask(0).cyl(4, 0.025, 0.02, 0, 0.42); f.color(0xffffff).mask(1); for (let i = 0; i < 5; i++) { const a = i * 1.257; f.blob(0.07, 0, { cx: Math.cos(a) * 0.085, cy: 0.45, cz: Math.sin(a) * 0.085, sy: 0.55 }); } f.color(0xffe14a).mask(0).blob(0.055, 0, { cy: 0.47 });
  const flowers = new THREE.InstancedMesh(f.build(), MAT.tree, 700);
  grass.frustumCulled = false; flowers.frustumCulled = false; grass.receiveShadow = true;
  scene.add(grass); scene.add(flowers);
  const dummy = new THREE.Object3D(), col = new THREE.Color();
  let lx = 1e9, lz = 1e9;
  const CELL = 1.6, R = 26, cuts = [];
  const PL = T.PLACES.filter((p) => !p.rect).map((p) => [p.x, p.z, p.id === 'uy' ? 32 * 32 : p.r * p.r, p.id === 'uy' ? 0 : 0.3]);
  const GC = { [B.MEADOW]: [0x8fd45e, 0x7cc452, 0xa4dc6a], [B.SAKURA]: [0x9cd87a, 0x8ccc6e, 0xb0e08c], [B.AUTUMN]: [0xdcae52, 0xcf9c44, 0xe6c060], [B.TAIGA]: [0x66a45e, 0x5a9854, 0x74b068], [B.SAVANNA]: [0xdcc86e, 0xcfb85e, 0xe6d47c], [B.DESERT]: [0xcfb672, 0xc0a664, 0xd8c080] };
  const FC = { [B.MEADOW]: [0xffffff, 0xffe45c, 0xff8fb0, 0xffffff, 0xb07cff], [B.SAKURA]: [0xffc0d8, 0xffffff, 0xff9cc0], [B.AUTUMN]: [0xfff0c0, 0xff9a4a], [B.TAIGA]: [0xffffff, 0x9fd0ff], [B.SAVANNA]: [0xffe9a0, 0xffffff] };
  const api = {
    dens: 1,
    cut(x, z) { cuts.push([x, z]); if (cuts.length > 80) cuts.shift(); lx = 1e9; },
    update(cam, force) {
      const cx = cam.position.x, cz = cam.position.z;
      if (!force && Math.abs(cx - lx) < 4 && Math.abs(cz - lz) < 4) return;
      lx = cx; lz = cz;
      const i0 = Math.floor(cx / CELL), j0 = Math.floor(cz / CELL), R2 = (R * CELL) * (R * CELL), fill = 0.9 * api.dens;
      let ng = 0, nf = 0;
      for (let j = j0 - R; j <= j0 + R; j++) for (let i = i0 - R; i <= i0 + R; i++) {
        const h = hash2(i, j, 21);
        if (h > fill) continue;
        const x = (i + hash2(i, j, 22)) * CELL, z = (j + hash2(i, j, 23)) * CELL;
        const dx = x - cx, dz = z - cz, d2 = dx * dx + dz * dz; if (d2 > R2) continue;
        const bio = T.biomeAt(x, z), gc = GC[bio]; if (!gc) continue;
        if (bio === B.DESERT && h > 0.22) continue;
        const y = T.gridHeight(x, z);
        if (y < T.waterY(x, z) + 0.25) continue;
        const nr = T.nearestRoad(x, z, 1); if (nr.edge >= 0 && nr.d < nr.hw + 1.5) continue;
        const sf = T.ground(x, z, 1e9).surf; if (sf !== T.SURF.GRASS && sf !== T.SURF.SAND) continue;
        let cutHere = false; for (let k = 0; k < cuts.length; k++) { const q = cuts[k]; if ((q[0] - x) * (q[0] - x) + (q[1] - z) * (q[1] - z) < 2.2) { cutHere = true; break; } } if (cutHere) continue;
        let inPl = false; for (let k = 0; k < PL.length; k++) { const q = PL[k]; if ((q[0] - x) * (q[0] - x) + (q[1] - z) * (q[1] - z) < q[2] && hash2(i, j, 27) >= q[3]) { inPl = true; break; } } if (inPl) continue;
        const lav = bio === B.MEADOW && T.lavAt(x, z);
        const edge = 1 - Math.max(0, (Math.sqrt(d2) / (R * CELL) - 0.72) / 0.28), s = (0.7 + hash2(i, j, 24) * 0.75) * (0.35 + 0.65 * edge);
        dummy.position.set(x, y - 0.04, z); dummy.rotation.set(0, h * 40, 0); dummy.scale.set(s * 1.15, s, s * 1.15); dummy.updateMatrix();
        if ((h < 0.05 || (lav && h < 0.3)) && FC[bio] && nf < 700) { dummy.scale.setScalar(0.8 + hash2(i, j, 24) * 0.7); dummy.updateMatrix(); flowers.setMatrixAt(nf, dummy.matrix); const fc = lav ? [0x9a7fe0, 0xb094ee] : FC[bio]; col.setHex(fc[(hash2(i, j, 25) * fc.length) | 0]); flowers.setColorAt(nf, col); nf++; }
        else if (ng < N) { grass.setMatrixAt(ng, dummy.matrix); col.setHex(gc[(hash2(i, j, 26) * 3) | 0]); grass.setColorAt(ng, col); ng++; }
      }
      grass.count = ng; flowers.count = nf;
      grass.instanceMatrix.needsUpdate = true; flowers.instanceMatrix.needsUpdate = true;
      if (grass.instanceColor) grass.instanceColor.needsUpdate = true; if (flowers.instanceColor) flowers.instanceColor.needsUpdate = true;
    },
  };
  return api;
}
