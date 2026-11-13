// Xaritani PNG qilib chizadi + yo'l statistikasi
import { createRequire } from 'node:module';
import * as T from '../src/terrain.js';
let sharp;
try { sharp = (await import('sharp')).default; }
catch { sharp = createRequire('/opt/npm-tools/node_modules/')('sharp'); } // bulut muhitidagi umumiy o'rnatma
const t0 = Date.now();
T.initWorld();
console.log('init ms', Date.now() - t0);
const { N, NV, CELL, HALF, grid, roads, PLACES } = T;
const S = 1.5;
const W = Math.round(N * S);
const buf = Buffer.alloc(W * W * 3);
const l2s = (c) => Math.round(255 * (c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055));
for (let py = 0; py < W; py++) for (let px = 0; px < W; px++) {
  const x = -HALF + (px + 0.5) / S * CELL, z = -HALF + (py + 0.5) / S * CELL;
  const i = Math.min(N - 1, px / S | 0), j = Math.min(N - 1, py / S | 0), k = j * NV + i;
  const h = T.gridHeight(x, z);
  let r = grid.col[k * 3], g = grid.col[k * 3 + 1], b = grid.col[k * 3 + 2];
  const hx = T.gridHeight(x + 6, z) - T.gridHeight(x - 6, z), hz = T.gridHeight(x, z + 6) - T.gridHeight(x, z - 6);
  const sh = Math.max(0.35, Math.min(1.5, 1 + (-hx - hz) * 0.07));
  r *= sh; g *= sh; b *= sh;
  const wy = T.waterY(x, z);
  if (h < wy) { const d = Math.min(1, (wy - h) / 5); r = r * (1 - d) * 0.5 + 0.05 + 0.0; g = g * (1 - d) * 0.5 + 0.22; b = b * (1 - d) * 0.5 + 0.45; }
  const o = (py * W + px) * 3;
  buf[o] = l2s(Math.min(1, r)); buf[o + 1] = l2s(Math.min(1, g)); buf[o + 2] = l2s(Math.min(1, b));
}
const P = (x) => (x + HALF) / CELL * S;
let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${W}">`;
for (const e of roads.edges) {
  let d = '';
  for (let k = 0; k < e.count; k++) { const i = e.start + k; d += (k ? 'L' : 'M') + P(roads.x[i]).toFixed(1) + ' ' + P(roads.z[i]).toFixed(1); }
  svg += `<path d="${d}" fill="none" stroke="${e.type ? '#6b4a2a' : '#3a2a1a'}" stroke-width="${e.type ? 1.6 : 2.6}"/>`;
  const mi = e.start + (e.count >> 1);
  svg += `<text x="${P(roads.x[mi])}" y="${P(roads.z[mi])}" font-size="11" fill="#000" stroke="#fff" stroke-width="0.4">${e.key}</text>`;
}
for (let i = 0; i < roads.n; i++) if (roads.bridge[i]) svg += `<circle cx="${P(roads.x[i])}" cy="${P(roads.z[i])}" r="2.4" fill="#ff0"/>`;
for (const p of PLACES) svg += `<circle cx="${P(p.x)}" cy="${P(p.z)}" r="${p.r / CELL * S}" fill="none" stroke="#f0f" stroke-width="1.5"/><text x="${P(p.x) + 8}" y="${P(p.z) - 8}" font-size="14" font-weight="bold" fill="#fff" stroke="#000" stroke-width="0.5">${p.id} ${p.y.toFixed(0)}m</text>`;
svg += '</svg>';
const outFile = process.argv[2] || 'shots/map.jpg';
(await import('node:fs')).mkdirSync((await import('node:path')).dirname(outFile), { recursive: true });
await sharp(buf, { raw: { width: W, height: W, channels: 3 } }).composite([{ input: Buffer.from(svg) }]).jpeg({ quality: 85 }).toFile(outFile);
// statistika
let total = 0;
for (const e of roads.edges) {
  let mg = 0, bridge = 0, ymin = 1e9, ymax = -1e9, maxcurv = 0;
  for (let k = 1; k < e.count; k++) {
    const i = e.start + k;
    const ds = e.s[k] - e.s[k - 1];
    mg = Math.max(mg, Math.abs(roads.y[i] - roads.y[i - 1]) / ds);
    if (roads.bridge[i]) bridge++;
    ymin = Math.min(ymin, roads.y[i]); ymax = Math.max(ymax, roads.y[i]);
    if (k > 1) { const a1 = Math.atan2(roads.tz[i], roads.tx[i]), a0 = Math.atan2(roads.tz[i - 1], roads.tx[i - 1]); let da = Math.abs(a1 - a0); if (da > Math.PI) da = 2 * Math.PI - da; maxcurv = Math.max(maxcurv, da / ds); }
  }
  total += e.len;
  console.log(e.key.padEnd(4), 'len', e.len.toFixed(0).padStart(5), 'maxGrade', (mg * 100).toFixed(1).padStart(5) + '%', 'y', ymin.toFixed(0), '..', ymax.toFixed(0), 'bridgeSamples', bridge, 'minRadius', (1 / maxcurv).toFixed(0));
}
console.log('total road m', total.toFixed(0), 'samples', roads.n);
const rv = T.getRiver();
console.log('river y:', Array.from({ length: 12 }, (_, i) => rv.y[Math.floor(i * (rv.n - 1) / 11)].toFixed(1)).join(' '));
let land = 0, hmax = 0; for (let k = 0; k < grid.h.length; k++) { if (grid.h[k] > 0) land++; hmax = Math.max(hmax, grid.h[k]); }
console.log('land km2', (land * CELL * CELL / 1e6).toFixed(2), 'hmax', hmax.toFixed(0));
