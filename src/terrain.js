// Dunyo ta'rifi: katta orol relyefi, biomlar, daryolar, yo'l tarmog'i va barcha so'rovlar.
// Bu modul three.js'ga bog'liq emas — Node'da ham ishlaydi (sinov va xarita uchun).
import { clamp, lerp, smoothstep, noise, fbm, ridged, catmullRom, resample, hexLin, hash2 } from './util.js';

export const SIZE = 6400, CELL = 8, N = SIZE / CELL, HALF = SIZE / 2, NV = N + 1;
export const MOUNT = { x: 150, z: -450, s: 900, h: 470 };
export const VOLC = { x: -2050, z: -1620, s: 430, h: 250, crater: 150 };
export const LAKE = { x: 1540, z: -1340, r: 300, y: 38 };
export const POND = { x: -70, z: -1440, r: 125 };
export const BIOME = { MEADOW: 0, AUTUMN: 1, TAIGA: 2, DESERT: 3, CANYON: 4, SNOW: 5, BEACH: 6, SAKURA: 7, SAVANNA: 8, VOLCANIC: 9 };
export const NB = 10;
export const SURF = { ROAD: 0, GRASS: 1, SAND: 2, SNOW: 3, ROCK: 4, WOOD: 5, WATER: 6, ICE: 7, ASPHALT: 8 };

const ZONES = [
  { b: 1, x: 1950, z: 650, r: 1350 },
  { b: 2, x: 1400, z: -1550, r: 1250 },
  { b: 2, x: -350, z: -2250, r: 1050 },
  { b: 3, x: -1950, z: -850, r: 1300 },
  { b: 9, x: -2050, z: -1620, r: 640 },
  { b: 4, x: -2080, z: 650, r: 850 },
  { b: 7, x: -640, z: 1080, r: 720 },
  { b: 8, x: -1250, z: 150, r: 760 },
];

// Manzillar (pad = tekislangan maydon). rect: {hl,hw,yaw} bo'lsa to'rtburchak
export const PLACES = [
  { id: 'bogiston', name: "Bog'iston qishlog'i", x: -380, z: 1920, r: 150, blend: 90 },
  { id: 'mayoq', name: 'Mayoq burni', x: 1318, z: 2640, r: 44, blend: 60, lift: 6 },
  { id: 'bandargoh', name: 'Baliqchilar bandargohi', x: -1180, z: 2452, r: 70, blend: 60, fixY: 3.2 },
  { id: 'ormon', name: "Oltin o'rmon", x: 2160, z: 180, r: 60, blend: 50 },
  { id: 'kol', name: "Ko'zgu ko'l", x: 1272, z: -1100, r: 52, blend: 46 },
  { id: 'lager', name: 'Qorli lager', x: 100, z: -1330, r: 70, blend: 70, fixY: 182 },
  { id: 'choqqi', name: "Cho'qqi rasadxonasi", x: 150, z: -450, r: 46, blend: 50, lift: -10 },
  { id: 'karvon', name: 'Karvonsaroy', x: -1920, z: -910, r: 90, blend: 60 },
  { id: 'dara', name: 'Qizil dara', x: -2030, z: 705, r: 52, blend: 36 },
  { id: 'aerodrom', name: 'Eski aerodrom', x: -1150, z: 30, r: 0, blend: 80, rect: { hl: 430, hw: 48, yaw: 0 } },
  { id: 'qala', name: "Ko'hna qal'a", x: -560, z: 560, r: 62, blend: 60, lift: 4 },
  { id: 'karyer', name: 'Tosh karyeri', x: 2420, z: -690, r: 95, blend: 38, lift: -12, quarry: 1 },
  { id: 'tegirmon', name: 'Shamol tegirmonlari', x: 700, z: 1900, r: 60, blend: 70, lift: 8 },
  { id: 'vulqon', name: "Olovtog' krateri", x: 0, z: 0, r: 30, blend: 34 },
  { id: 'muzkol', name: "Muzko'l", x: POND.x, z: POND.z, r: POND.r + 12, blend: 60, fixY: 181.4 },
  { id: 'uy', name: 'Mening uyim', x: -602, z: 1861, r: 30, blend: 26 },
];

const NODES = {
  vil: [-380, 1920], mj: [640, 2080], mayoq: [1300, 2620], brj: [1830, 1330], ormon: [2110, 190], karj: [2160, -520],
  karyer: [2400, -680], kol: [1290, -1060], lager: [100, -1330], west: [-1250, -900], karvon: [-1920, -910], dara: [-2020, 680],
  sw: [-1250, 1680], bandargoh: [-1180, 2440], qala: [-560, 560], aero: [-1250, 86], vj: [-1480, -1700], choqqi: [150, -450],
  burgut: [1300, 100], teg: [700, 1900],
};
const VSP = spiral(VOLC.x, VOLC.z, NODES.vj, 0.9, 180, 31, 1.0, -1, true);
NODES.vulqon = VSP.pop();
function spiral(cx, cz, from, turns, r1, n, pow = 0.92, dir = -1, incl = false) {
  const pts = [];
  const a0 = Math.atan2(from[1] - cz, from[0] - cx), R0 = Math.hypot(from[0] - cx, from[1] - cz);
  for (let k = 1; k < n + (incl ? 1 : 0); k++) { const t = k / n, a = a0 + dir * t * turns * Math.PI * 2, r = lerp(R0, r1, Math.pow(t, pow)); pts.push([cx + Math.cos(a) * r, cz + Math.sin(a) * r]); }
  return pts;
}
export const placeBy = Object.fromEntries(PLACES.map((p) => [p.id, p]));
placeBy.vulqon.x = NODES.vulqon[0]; placeBy.vulqon.z = NODES.vulqon[1];
const EDGES = [
  { id: 'e1', a: 'vil', b: 'mj', type: 0, via: [[-100, 1990], [200, 2040], [440, 2010]] },
  { id: 'e2', a: 'mj', b: 'mayoq', type: 0, via: [[860, 2260], [1080, 2440]] },
  { id: 'e3', a: 'mj', b: 'brj', type: 0, via: [[900, 1960], [1160, 1720], [1400, 1500], [1620, 1400]] },
  { id: 'e3b', a: 'brj', b: 'ormon', type: 0, via: [[2040, 1100], [2180, 800], [2200, 480]] },
  { id: 'e4', a: 'ormon', b: 'karj', type: 0, via: [[2140, -100], [2190, -320]] },
  { id: 'e4b', a: 'karj', b: 'kol', type: 0, via: [[2060, -760], [1820, -900], [1640, -940], [1460, -960]] },
  { id: 'e5', a: 'kol', b: 'lager', type: 0, via: [[1050, -1180], [820, -1420], [560, -1520], [320, -1440]] },
  { id: 'e6', a: 'lager', b: 'west', type: 0, via: [[-120, -1290], [-420, -1320], [-700, -1300], [-980, -1180]] },
  { id: 'e7', a: 'west', b: 'karvon', type: 0, via: [[-1480, -820], [-1720, -920]] },
  { id: 'e8', a: 'karvon', b: 'dara', type: 0, via: [[-2150, -650], [-2280, -300], [-2180, 50], [-2250, 400]] },
  { id: 'e9', a: 'dara', b: 'sw', type: 0, via: [[-1850, 950], [-1650, 1250], [-1450, 1500]] },
  { id: 'e10', a: 'sw', b: 'vil', type: 0, via: [[-1000, 1840], [-700, 1900]] },
  { id: 'e11', a: 'vil', b: 'qala', type: 0, via: [[-450, 1600], [-620, 1280], [-700, 950]] },
  { id: 'e11b', a: 'qala', b: 'aero', type: 0, via: [[-800, 380], [-1020, 230]] },
  { id: 'e11c', a: 'aero', b: 'west', type: 0, via: [[-1400, -150], [-1380, -500]] },
  { id: 'e12', a: 'sw', b: 'bandargoh', type: 0, via: [[-1300, 1950], [-1240, 2220]] },
  { id: 'e13', a: 'mj', b: 'teg', type: 1, via: [[660, 1990]] },
  { id: 't1', a: 'lager', b: 'choqqi', type: 1, via: spiral(MOUNT.x, MOUNT.z, NODES.lager, 1.6, 30, 40, 0.92, 1) },
  { id: 't2', a: 'mj', b: 'bandargoh', type: 1, via: [[500, 2380], [220, 2600], [-200, 2640], [-600, 2600], [-950, 2520]] },
  { id: 't3', a: 'kol', b: 'vj', type: 1, via: [[1150, -1500], [950, -1950], [550, -2350], [50, -2520], [-500, -2480], [-1000, -2300], [-1320, -2000]] },
  { id: 't3b', a: 'vj', b: 'karvon', type: 1, via: [[-1500, -1420], [-1680, -1120]] },
  { id: 't4', a: 'ormon', b: 'burgut', type: 1, via: [[1900, 120], [1640, 150], [1450, 130]] },
  { id: 't5', a: 'karj', b: 'karyer', type: 1, via: [[2280, -600]] },
  { id: 't6', a: 'vj', b: 'vulqon', type: 1, via: VSP },
  { id: 't7', a: 'aero', b: 'dara', type: 1, via: [[-1500, 350], [-1780, 520]] },
];
const RIVER_DEFS = [
  { name: 'Zilol', pts: [[1565, -1150], [1640, -900], [1720, -500], [1690, -100], [1640, 300], [1560, 700], [1590, 1100], [1620, 1450], [1700, 1900], [1950, 2300], [2250, 2650], [2480, 3000]], y0: LAKE.y - 0.15 },
  { name: 'Gulsoy', pts: [[-230, 420], [-380, 760], [-420, 1050], [-300, 1350], [-80, 1650], [50, 2000], [150, 2400], [260, 2800], [320, 3100]], y0: null },
];
export const RIVER = { hw: 8, bank: 18, depth: 1.0 };

// --- Quruqlik niqobi ---
function landMask(x, z) {
  const wx = x + 230 * noise(x * 0.0007 + 3.1, z * 0.0007 - 1.7) + 60 * noise(x * 0.0022 + 9, z * 0.0022), wz = z + 230 * noise(x * 0.0007 - 8.3, z * 0.0007 + 4.4) + 60 * noise(x * 0.0022, z * 0.0022 + 9);
  const r = Math.hypot(wx, wz);
  const Rc = 3060 + 150 * noise(wx * 0.0005 + 20, wz * 0.0005 + 7);
  let land = smoothstep(Rc, Rc - 620, r);
  const dc = Math.hypot(x - 1230, z - 2540);
  const cape = smoothstep(560, 160, dc) * 0.9;
  land = 1 - (1 - land) * (1 - cape);
  return land;
}

const _w = new Float32Array(NB);
export function zoneWeights(x, z, out) {
  const wx = x + 150 * noise(x * 0.0014 + 9, z * 0.0014 + 2) + 40 * noise(x * 0.005, z * 0.005 + 7), wz = z + 150 * noise(x * 0.0014 - 5, z * 0.0014 + 31) + 40 * noise(x * 0.005 + 7, z * 0.005);
  for (let i = 0; i < NB; i++) out[i] = 0;
  let sum = 0;
  for (let i = 0; i < ZONES.length; i++) {
    const zn = ZONES[i];
    const d = Math.hypot(wx - zn.x, wz - zn.z);
    if (d >= zn.r) continue;
    const w = smoothstep(zn.r, zn.r * 0.55, d);
    if (w > out[zn.b]) { sum += w - out[zn.b]; out[zn.b] = w; }
  }
  const wv = out[9];
  if (wv > 0) { sum -= wv; }
  if (sum > 1) { const k = 1 / sum; for (let i = 1; i < 9; i++) out[i] *= k; sum = 1; }
  if (wv > 0) { for (let i = 1; i < 9; i++) out[i] *= 1 - wv; sum = sum * (1 - wv) + wv; }
  out[0] = 1 - sum;
  return out;
}

// --- Daryolar ---
const river = { x: null, z: null, y: null, n: 0, grid: null, parts: [] };
const HC = 32, HG = Math.ceil(SIZE / HC) + 2;
const hkey = (x, z) => (clamp(((z + HALF) / HC) | 0, 0, HG - 1)) * HG + clamp(((x + HALF) / HC) | 0, 0, HG - 1);
function buildHash(xs, zs, n) {
  const g = new Array(HG * HG);
  for (let i = 0; i < n; i++) { const k = hkey(xs[i], zs[i]); (g[k] || (g[k] = [])).push(i); }
  return g;
}
function initRiverPath() {
  const all = []; river.parts = [];
  for (const d of RIVER_DEFS) {
    const pts = resample(catmullRom(d.pts, 3), 3.5);
    river.parts.push({ start: all.length, count: pts.length, y0: d.y0, name: d.name });
    for (const p of pts) all.push(p);
  }
  river.n = all.length;
  river.x = new Float32Array(river.n); river.z = new Float32Array(river.n); river.y = new Float32Array(river.n);
  for (let i = 0; i < river.n; i++) { river.x[i] = all[i][0]; river.z[i] = all[i][1]; }
  river.grid = buildHash(river.x, river.z, river.n);
}
const _rv = { d: 1e9, i: -1 };
function riverNear(x, z, rad) {
  let best = 1e18, bi = -1;
  const cx = ((x + HALF) / HC) | 0, cz = ((z + HALF) / HC) | 0, cr = Math.ceil(rad / HC);
  for (let dz = -cr; dz <= cr; dz++) {
    const zz = cz + dz; if (zz < 0 || zz >= HG) continue;
    for (let dx = -cr; dx <= cr; dx++) {
      const xx = cx + dx; if (xx < 0 || xx >= HG) continue;
      const cell = river.grid[zz * HG + xx]; if (!cell) continue;
      for (let k = 0; k < cell.length; k++) { const i = cell[k]; const ex = river.x[i] - x, ez = river.z[i] - z; const d2 = ex * ex + ez * ez; if (d2 < best) { best = d2; bi = i; } }
    }
  }
  _rv.d = bi < 0 ? 1e9 : Math.sqrt(best); _rv.i = bi;
  return _rv;
}

function padWeight(p, x, z) {
  if (p.rect) {
    const c = Math.cos(p.rect.yaw), s = Math.sin(p.rect.yaw);
    const dx = x - p.x, dz = z - p.z;
    const u = Math.abs(dx * c + dz * s) - p.rect.hl, v = Math.abs(-dx * s + dz * c) - p.rect.hw;
    const d = Math.hypot(Math.max(u, 0), Math.max(v, 0));
    return d >= p.blend ? 0 : smoothstep(p.blend, 0, d);
  }
  const d = Math.hypot(x - p.x, z - p.z);
  return d >= p.r + p.blend ? 0 : smoothstep(p.r + p.blend, p.r, d);
}

let padsReady = false;
// Asosiy balandlik (yo'l va daryo o'yig'isiz). roadMode: plato/barxanlarsiz (yo'l profili uchun)
export function base0(x, z, roadMode = false, noPads = false) {
  const land = landMask(x, z);
  let h = -20 + 27 * Math.pow(land, 0.7);
  // tog'lar quruqlik niqobidan mustaqil
  const mx = x - MOUNT.x + 120 * noise(x * 0.0018 + 40, z * 0.0018), mz = z - MOUNT.z + 120 * noise(x * 0.0018, z * 0.0018 + 40);
  const dm2 = mx * mx + mz * mz;
  let mt = 0;
  if (dm2 < 2600 * 2600) mt = Math.exp(-dm2 / (MOUNT.s * MOUNT.s));
  const vx = x - VOLC.x, vz = z - VOLC.z, dv = Math.hypot(vx, vz);
  let vt = 0;
  if (dv < 1500) vt = Math.exp(-(dv * dv) / (VOLC.s * VOLC.s));
  if (land < 0.002 && mt < 0.001 && vt < 0.001) return h;
  const W = zoneWeights(x, z, _w);
  const rv = riverNear(x, z, 260);
  const valley = smoothstep(260, 30, rv.d);
  let hills = 10 + 20 * fbm(x * 0.0016, z * 0.0016, 4) + 5 * noise(x * 0.006 + 3, z * 0.006);
  hills *= (1 - 0.6 * valley) * (1 - 0.45 * W[3]) * (1 - 0.3 * W[8]);
  const rough = 1.0 * noise(x * 0.016, z * 0.016) * (1 - 0.7 * valley);
  h += land * (hills + rough);
  if (mt > 0) h += MOUNT.h * Math.pow(mt, 1.2) + mt * 70 * (ridged(x * 0.0022, z * 0.0022, 3) - 0.45) + smoothstep(0.08, 0.5, mt) * 7 * noise(x * 0.011, z * 0.011);
  if (vt > 0) {
    h += VOLC.h * Math.pow(vt, 0.9) + vt * 14 * noise(x * 0.009, z * 0.009);
    h -= 85 * smoothstep(VOLC.crater + 25, VOLC.crater * 0.45, dv);
  }
  if (!roadMode) {
    if (W[3] > 0.01) { const dn = 1 - Math.abs(noise(x * 0.0075 + z * 0.0009, z * 0.003 + 3)); h += W[3] * land * 9 * dn * dn * (1 - vt * 2 > 0 ? 1 - vt * 2 : 0); }
    if (W[4] > 0.01) {
      const pl = W[4] * land;
      h += pl * (30 + 7 * noise(x * 0.003, z * 0.003));
      const q = h / 9, f = q - Math.floor(q);
      const ht = (Math.floor(q) + smoothstep(0.62, 1, f)) * 9;
      h = lerp(h, ht, Math.min(1, pl * 1.3) * 0.8);
    }
  }
  // Ko'l havzasi
  const lx = x - LAKE.x + 55 * noise(x * 0.004 + 5, z * 0.004), lz = z - LAKE.z + 55 * noise(x * 0.004, z * 0.004 + 5);
  const dl = Math.hypot(lx, lz);
  if (dl < LAKE.r + 320) {
    const target = LAKE.y + 1.8 - 10 * smoothstep(LAKE.r, LAKE.r - 150, dl);
    h = lerp(h, target, smoothstep(LAKE.r + 320, LAKE.r + 140, dl));
  }
  if (!noPads && padsReady) {
    for (let i = 0; i < PLACES.length; i++) {
      const p = PLACES[i];
      let w = padWeight(p, x, z);
      if (p.quarry && w > 0 && w < 1) { const q = w * 3, f = q - Math.floor(q); w = (Math.floor(q) + smoothstep(0.55, 1, f)) / 3; } // karyer devorlari: 3 ta pog'ona
      if (w > 0) h = lerp(h, p.y, w);
    }
  }
  return h;
}

// --- Yo'llar ---
export const roads = { nodes: [], edges: [], x: null, z: null, y: null, hw: null, edge: null, idx: null, n: 0, grid: null, bridge: null };
const FLAT_EXTRA = 12.5, BLEND = 44;

function initRoads() {
  const names = Object.keys(NODES);
  roads.nodes = names.map((k, i) => ({ id: i, key: k, x: NODES[k][0], z: NODES[k][1], y: 0, edges: [] }));
  const nodeBy = Object.fromEntries(roads.nodes.map((n) => [n.key, n]));
  roads.nodeBy = nodeBy;
  for (const n of roads.nodes) { n.y = Math.max(2.2, base0(n.x, n.z, true)); for (const p of PLACES) if (padWeight(p, n.x, n.z) > 0.45) n.y = p.y; }
  const all = [];
  roads.edges = EDGES.map((e, ei) => {
    const A = nodeBy[e.a], B = nodeBy[e.b];
    const ctrl = [[A.x, A.z], ...e.via, [B.x, B.z]];
    let pts = resample(catmullRom(ctrl, 2), 4);
    // tabiiy ilon izi: yon tomonga shovqin (uchlarda so'nadi). Spiral yo'llarda kamroq
    const m0 = pts.length, amp = e.id === 't1' || e.id === 't6' ? 5 : e.type === 0 ? 20 : 16;
    const wig = pts.map((p, i) => {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(m0 - 1, i + 1)];
      let tx = b[0] - a[0], tz = b[1] - a[1]; const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l;
      const sd = i * 4, fade = smoothstep(0, 140, sd) * smoothstep(0, 140, (m0 - 1 - i) * 4);
      const o = amp * fade * (noise(sd * 0.0034 + ei * 7.7, ei * 3.3) + 0.4 * noise(sd * 0.009 + ei * 2.1, 5 + ei));
      return [p[0] + tz * o, p[1] - tx * o];
    });
    pts = resample(wig, 4);
    const m = pts.length;
    const ys = new Float32Array(m);
    for (let i = 0; i < m; i++) ys[i] = Math.max(2.2, base0(pts[i][0], pts[i][1], true));
    ys[0] = A.y; ys[m - 1] = B.y;
    const tmp = new Float32Array(m);
    const iters = e.type === 1 ? 300 : 520;
    for (let it = 0; it < iters; it++) {
      for (let i = 1; i < m - 1; i++) tmp[i] = (ys[i - 1] + ys[i] * 2 + ys[i + 1]) * 0.25;
      for (let i = 1; i < m - 1; i++) ys[i] = tmp[i];
    }
    const s = new Float32Array(m);
    for (let i = 1; i < m; i++) s[i] = s[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    const Gm = e.type === 0 ? 0.13 : 0.19;
    const limit = (n) => { for (let it = 0; it < n; it++) {
      for (let i = 1; i < m - 1; i++) { const l = Gm * (s[i] - s[i - 1]); ys[i] = clamp(ys[i], ys[i - 1] - l, ys[i - 1] + l); }
      for (let i = m - 2; i >= 1; i--) { const l = Gm * (s[i + 1] - s[i]); ys[i] = clamp(ys[i], ys[i + 1] - l, ys[i + 1] + l); }
    } };
    limit(60);
    for (let it = 0; it < 30; it++) { for (let i = 1; i < m - 1; i++) tmp[i] = (ys[i - 1] + ys[i] * 2 + ys[i + 1]) * 0.25; for (let i = 1; i < m - 1; i++) ys[i] = tmp[i]; }
    limit(12);
    // to'rtburchak maydon (aerodrom) ichida yo'l maydon sathida yotadi — silliqlash uni tuproq ostiga tortmasin
    for (const p of PLACES) { if (!p.rect) continue; let hit = 0; for (let i = 1; i < m - 1; i++) { const w = padWeight(p, pts[i][0], pts[i][1]); if (w > 0) { ys[i] = lerp(ys[i], p.y, Math.min(1, w * 1.6)); hit = 1; } } if (hit) limit(12); }
    const hw = e.type === 0 ? 5.0 : 3.3;
    const edge = { id: ei, key: e.id, a: A.id, b: B.id, type: e.type, hw, start: all.length, count: m, len: s[m - 1], s };
    A.edges.push(ei); B.edges.push(ei);
    for (let i = 0; i < m; i++) all.push([pts[i][0], pts[i][1], ys[i], hw, ei, i]);
    return edge;
  });
  const n = all.length;
  roads.n = n;
  roads.x = new Float32Array(n); roads.z = new Float32Array(n); roads.y = new Float32Array(n); roads.hw = new Float32Array(n);
  roads.edge = new Int16Array(n); roads.idx = new Int32Array(n); roads.bridge = new Uint8Array(n);
  roads.tx = new Float32Array(n); roads.tz = new Float32Array(n);
  for (let i = 0; i < n; i++) { const a = all[i]; roads.x[i] = a[0]; roads.z[i] = a[1]; roads.y[i] = a[2]; roads.hw[i] = a[3]; roads.edge[i] = a[4]; roads.idx[i] = a[5]; }
  for (const e of roads.edges) {
    for (let k = 0; k < e.count; k++) {
      const i = e.start + k, i0 = e.start + Math.max(0, k - 1), i1 = e.start + Math.min(e.count - 1, k + 1);
      let tx = roads.x[i1] - roads.x[i0], tz = roads.z[i1] - roads.z[i0];
      const l = Math.hypot(tx, tz) || 1; roads.tx[i] = tx / l; roads.tz[i] = tz / l;
    }
  }
  roads.grid = buildHash(roads.x, roads.z, n);
}

const _rf = { d: 1e9, y: 0, hw: 0, i: -1 };
function roadFlat(x, z) {
  const cx = ((x + HALF) / HC) | 0, cz = ((z + HALF) / HC) | 0;
  let best = 1e18, bi = -1, sw = 0, sy = 0;
  for (let dz = -2; dz <= 2; dz++) {
    const zz = cz + dz; if (zz < 0 || zz >= HG) continue;
    for (let dx = -2; dx <= 2; dx++) {
      const xx = cx + dx; if (xx < 0 || xx >= HG) continue;
      const cell = roads.grid[zz * HG + xx]; if (!cell) continue;
      for (let k = 0; k < cell.length; k++) {
        const i = cell[k]; const ex = roads.x[i] - x, ez = roads.z[i] - z; const d2 = ex * ex + ez * ez;
        if (d2 < best) { best = d2; bi = i; }
        if (d2 < 4200) { const w = 1 / ((d2 + 2) * (d2 + 2)); sw += w; sy += w * roads.y[i]; }
      }
    }
  }
  _rf.i = bi;
  if (bi < 0) { _rf.d = 1e9; return _rf; }
  _rf.d = Math.sqrt(best); _rf.hw = roads.hw[bi]; _rf.y = sw > 0 ? sy / sw : roads.y[bi];
  return _rf;
}

// Aniq eng yaqin yo'l (segmentga proyeksiya)
const _nr = { d: 1e9, y: 0, hw: 0, edge: -1, i: -1, t: 0, side: 0, tx: 0, tz: 1, bridge: 0 };
export function nearestRoad(x, z, cr = 1) {
  const cx = ((x + HALF) / HC) | 0, cz = ((z + HALF) / HC) | 0;
  let best = 1e18, bi = -1;
  for (let dz = -cr; dz <= cr; dz++) {
    const zz = cz + dz; if (zz < 0 || zz >= HG) continue;
    for (let dx = -cr; dx <= cr; dx++) {
      const xx = cx + dx; if (xx < 0 || xx >= HG) continue;
      const cell = roads.grid[zz * HG + xx]; if (!cell) continue;
      for (let k = 0; k < cell.length; k++) { const i = cell[k]; const ex = roads.x[i] - x, ez = roads.z[i] - z; const d2 = ex * ex + ez * ez; if (d2 < best) { best = d2; bi = i; } }
    }
  }
  const o = _nr; o.i = bi;
  if (bi < 0) { o.d = 1e9; o.edge = -1; return o; }
  const e = roads.edges[roads.edge[bi]];
  let bd = 1e18;
  for (let s = -1; s <= 0; s++) {
    const a = bi + s, b = a + 1;
    if (a < e.start || b >= e.start + e.count) continue;
    const ax = roads.x[a], az = roads.z[a], bx = roads.x[b], bz = roads.z[b];
    const vx = bx - ax, vz = bz - az, l2 = vx * vx + vz * vz;
    let t = ((x - ax) * vx + (z - az) * vz) / l2; t = t < 0 ? 0 : t > 1 ? 1 : t;
    const px = ax + vx * t, pz = az + vz * t; const d2 = (x - px) * (x - px) + (z - pz) * (z - pz);
    if (d2 < bd) {
      bd = d2; o.i = a; o.t = t; o.y = roads.y[a] + (roads.y[b] - roads.y[a]) * t;
      const l = Math.sqrt(l2); o.tx = vx / l; o.tz = vz / l;
      o.side = (x - px) * (vz / l) - (z - pz) * (vx / l); // chap tomonga musbat
      o.bridge = roads.bridge[a] | roads.bridge[b];
    }
  }
  o.d = Math.sqrt(bd); o.hw = roads.hw[bi]; o.edge = e.id;
  return o;
}

// --- Balandlik to'ri ---
export const grid = { h: null, col: null, biome: null };
let riverReady = false;

function riverCarve(x, z, h) {
  const rv = riverNear(x, z, 96);
  if (rv.i < 0) return h;
  const yw = river.y[rv.i];
  const bed = yw - RIVER.depth;
  if (h <= bed) return h;
  const bank = RIVER.bank + Math.max(0, (h - yw)) * 1.5;
  if (rv.d > RIVER.hw + bank) return h;
  const cw = smoothstep(RIVER.hw + bank, RIVER.hw, rv.d);
  return lerp(h, bed, cw);
}

function heightFull(x, z) {
  let h = base0(x, z);
  // to'rtburchak maydon cheti avval, yo'l tekislash keyin — yo'l hech qachon tuproq ostida qolmaydi
  for (let i = 0; i < PLACES.length; i++) { const p = PLACES[i]; if (!p.rect) continue; const c = Math.cos(p.rect.yaw), s = Math.sin(p.rect.yaw), dx = x - p.x, dz = z - p.z; const u = Math.abs(dx * c + dz * s) - p.rect.hl, v = Math.abs(-dx * s + dz * c) - p.rect.hw; const d = Math.hypot(Math.max(u, 0), Math.max(v, 0)); if (d < 16) h = lerp(h, p.y, smoothstep(16, 2, d)); }
  const rf = roadFlat(x, z);
  if (rf.i >= 0) {
    const W = zoneWeights(x, z, _w);
    const blend = lerp(BLEND, 17, W[4]);
    const f0 = rf.hw + FLAT_EXTRA;
    if (rf.d < f0 + blend) {
      const t = smoothstep(f0, f0 + blend, rf.d);
      const sink = 0.22 * smoothstep(rf.hw + 3.5, rf.hw + 1.5, rf.d);
      h = lerp(rf.y - sink, h, t);
    }
  }
  if (riverReady) h = riverCarve(x, z, h);
  return h;
}

// Palitra (yumshoq, to'yingan)
const C = {
  meadow: [hexLin(0x86cb5a), hexLin(0x76c056), hexLin(0x98d466)],
  autumn: [hexLin(0xd9a552), hexLin(0xcf9048), hexLin(0xe2b860)],
  taiga: [hexLin(0x5f9f5e), hexLin(0x548f58), hexLin(0x6caa62)],
  desert: [hexLin(0xe9c783), hexLin(0xe2ba72), hexLin(0xf0d292)],
  canyon: [hexLin(0xcf7a4a), hexLin(0xc26a40), hexLin(0xdc8a55)],
  sakura: [hexLin(0x9ad27c), hexLin(0x8ac873), hexLin(0xb4dc90)],
  savanna: [hexLin(0xd6c067), hexLin(0xc9b25c), hexLin(0xe1cd78)],
  volcanic: [hexLin(0x524c56), hexLin(0x46414b), hexLin(0x5e5560)],
  snow: [hexLin(0xf2f6fc), hexLin(0xe8eefa), hexLin(0xffffff)],
  beach: [hexLin(0xf1e0aa), hexLin(0xead69c), hexLin(0xf6e8ba)],
  rock: [hexLin(0x8f929c), hexLin(0x83868f), hexLin(0x9da0a8)],
  redrock: [hexLin(0xa9553a), hexLin(0x9c4c35), hexLin(0xb86343)],
  gravel: hexLin(0xa9a294), lavender: hexLin(0x9a7fd0), seabed: hexLin(0xc9c79a), riverbed: hexLin(0xb9b08c),
};
const QUARRY = PLACES.find((p) => p.quarry);
const BCOL = [C.meadow, C.autumn, C.taiga, C.desert, C.canyon, null, null, C.sakura, C.savanna, C.volcanic];
const ZB = [0, 1, 2, 3, 4, 7, 8, 9];
const _c = [0, 0, 0];
export const SNOW_LO = 148, SNOW_HI = 176;
export function snowAt(x, z, h) { return smoothstep(SNOW_LO, SNOW_HI, h + 12 * noise(x * 0.006, z * 0.006)); }
// Yer rangi: biom og'irliklari + qiyalik + balandlik (silliq o'tishlar)
export function groundColor(x, z, h, slope) {
  const W = zoneWeights(x, z, _w);
  let r = 0, g = 0, b = 0;
  // yumshoq yirik naqsh: 3 ta tus orasida silliq aralashtirish
  const pat = noise(x * 0.0055 + 50, z * 0.0055 - 20) * 0.7 + noise(x * 0.019, z * 0.019 + 9) * 0.3;
  const k1 = smoothstep(-0.5, -0.05, pat), k2 = smoothstep(0.05, 0.5, pat);
  let dom = 0, dw = W[0];
  for (let q = 0; q < ZB.length; q++) {
    const i = ZB[q], w = W[i]; if (w <= 0) continue;
    const c = BCOL[i];
    r += w * lerp(lerp(c[1][0], c[0][0], k1), c[2][0], k2); g += w * lerp(lerp(c[1][1], c[0][1], k1), c[2][1], k2); b += w * lerp(lerp(c[1][2], c[0][2], k1), c[2][2], k2);
    if (i > 0 && w > dw) { dw = w; dom = i; }
  }
  // lavanda dalalari (o'tloqda)
  // lavanda dalalari (o'tloqda): aniq chegarali, manzillar va yo'llardan uzoqda; yaqinda gullar qator-qator
  _c.lav = 0;
  if (W[0] > 0.6 && slope < 0.3) { let lv = smoothstep(0.585, 0.615, noise(x * 0.0021 + 100, z * 0.0021 + 60)) * smoothstep(0.6, 0.8, W[0]) * (1 - smoothstep(0.12, 0.25, slope));
    if (lv > 0) { for (let i = 0; i < PLACES.length; i++) { const p = PLACES[i]; const d = p.rect ? (padWeight(p, x, z) > 0 ? 0 : 1e9) : Math.hypot(x - p.x, z - p.z) - p.r - p.blend; if (d < 110) { lv *= smoothstep(40, 110, d); if (lv <= 0) break; } } }
    if (lv > 0 && roads.grid) { const nr = nearestRoad(x, z, 2); if (nr.edge >= 0) lv *= smoothstep(14, 26, nr.d - nr.hw); }
    if (lv > 0) { const k = lv * 0.75; r = lerp(r, C.lavender[0], k); g = lerp(g, C.lavender[1], k); b = lerp(b, C.lavender[2], k); _c.lav = lv > 0.5 ? 1 : 0; } }
  // karyer: o't emas — shag'al tubi, devorlarda qatlam-qatlam tosh
  const qw = QUARRY ? padWeight(QUARRY, x, z) : 0;
  if (qw > 0) { const k = smoothstep(0, 0.35, qw), v = 0.85 + 0.3 * noise(x * 0.05, z * 0.05), band = 0.9 + 0.12 * Math.sin(h * 2.3 + noise(x * 0.02, z * 0.02) * 2); const gr = C.gravel; r = lerp(r, gr[0] * v * band, k); g = lerp(g, gr[1] * v * band, k); b = lerp(b, gr[2] * v * band, k); _c.lav = 0; }
  const redness = Math.min(1, W[3] * 0.5 + W[4]);
  const rk = smoothstep(0.5, 0.85, slope);
  if (rk > 0) {
    let rr = lerp(C.rock[0][0], C.redrock[0][0], redness), rg = lerp(C.rock[0][1], C.redrock[0][1], redness), rb = lerp(C.rock[0][2], C.redrock[0][2], redness);
    if (W[9] > 0) { rr = lerp(rr, 0.07, W[9]); rg = lerp(rg, 0.06, W[9]); rb = lerp(rb, 0.075, W[9]); }
    r = lerp(r, rr, rk); g = lerp(g, rg, rk); b = lerp(b, rb, rk);
  }
  const sn = snowAt(x, z, h) * (1 - 0.8 * smoothstep(0.75, 1.1, slope)) * (1 - W[9]);
  if (sn > 0) { const c = C.snow[0]; r = lerp(r, c[0], sn); g = lerp(g, c[1], sn); b = lerp(b, c[2], sn); if (sn > 0.5) dom = BIOME.SNOW; }
  const be = smoothstep(4.2, 1.8, h) * (1 - W[9]) * (1 - smoothstep(0, 0.2, qw));
  if (be > 0) { const c = C.beach[0]; r = lerp(r, c[0], be); g = lerp(g, c[1], be); b = lerp(b, c[2], be); if (be > 0.5) dom = BIOME.BEACH; }
  if (h < 0) { const k = smoothstep(0, -7, h) * 0.7; r = lerp(r, C.seabed[0], k); g = lerp(g, C.seabed[1], k); b = lerp(b, C.seabed[2], k); }
  _c[0] = r; _c[1] = g; _c[2] = b; _c.dom = dom;
  return _c;
}

export function initWorld(onProgress) {
  initRiverPath();
  for (const p of PLACES) {
    let sum = base0(p.x, p.z, true, true), cnt = 1;
    const rr = p.rect ? 30 : p.r * 0.6;
    for (let a = 0; a < 8; a++) { sum += base0(p.x + Math.cos(a * 0.785) * rr, p.z + Math.sin(a * 0.785) * rr, true, true); cnt++; }
    p.y = p.fixY || (Math.max(2.6, p.lift ? base0(p.x, p.z, true, true) : sum / cnt) + (p.lift || 0));
  }
  padsReady = true;
  // Daryo profillari: monoton pasayuvchi
  for (const part of river.parts) {
    const a = part.start, b = part.start + part.count;
    let run = part.y0 != null ? part.y0 : base0(river.x[a], river.z[a]) - 1.3;
    for (let i = a; i < b; i++) {
      const bb = base0(river.x[i], river.z[i]) - 1.4;
      if (i > a + 10 || part.y0 == null) run = Math.min(run, bb);
      run = Math.max(run, -0.7);
      river.y[i] = run;
    }
    for (let it = 0; it < 40; it++) for (let i = a + 1; i < b - 1; i++) river.y[i] = Math.min(river.y[i - 1], (river.y[i - 1] + river.y[i] * 2 + river.y[i + 1]) * 0.25);
  }
  initRoads();
  riverReady = true;
  const h = (grid.h = new Float32Array(NV * NV));
  for (let j = 0; j < NV; j++) {
    const z = -HALF + j * CELL;
    for (let i = 0; i < NV; i++) h[j * NV + i] = heightFull(-HALF + i * CELL, z);
    if (onProgress && (j & 63) === 0) onProgress(j / NV);
  }
  for (let i = 0; i < roads.n; i++) {
    const g = gridHeight(roads.x[i], roads.z[i]);
    if (g < roads.y[i] - 0.75) roads.bridge[i] = 1;
  }
  for (const e of roads.edges) {
    const src = roads.bridge.slice(e.start, e.start + e.count);
    for (let k = 0; k < e.count; k++) if (src[k]) for (let d = -2; d <= 2; d++) { const q = k + d; if (q >= 0 && q < e.count) roads.bridge[e.start + q] = 1; }
  }
  const col = (grid.col = new Float32Array(NV * NV * 3));
  const bio = (grid.biome = new Uint8Array(NV * NV));
  grid.lav = new Uint8Array(NV * NV);
  for (let j = 0; j < NV; j++) {
    for (let i = 0; i < NV; i++) {
      const k = j * NV + i;
      const hl = h[j * NV + Math.max(0, i - 1)], hr = h[j * NV + Math.min(N, i + 1)], hu = h[Math.max(0, j - 1) * NV + i], hd = h[Math.min(N, j + 1) * NV + i];
      const sx = (hr - hl) / (2 * CELL), sz = (hd - hu) / (2 * CELL);
      const slope = Math.sqrt(sx * sx + sz * sz);
      const x = -HALF + i * CELL, z = -HALF + j * CELL;
      if (h[k] < -9) { col[k * 3] = C.seabed[0] * 0.8; col[k * 3 + 1] = C.seabed[1] * 0.8; col[k * 3 + 2] = C.seabed[2] * 0.8; bio[k] = BIOME.BEACH; continue; }
      const c = groundColor(x, z, h[k], slope);
      const rv = riverNear(x, z, 32);
      if (rv.i >= 0 && rv.d < RIVER.hw + 7 && h[k] < river.y[rv.i] + 0.4) { const t = 0.8; c[0] = lerp(c[0], C.riverbed[0], t); c[1] = lerp(c[1], C.riverbed[1], t); c[2] = lerp(c[2], C.riverbed[2], t); }
      col[k * 3] = c[0]; col[k * 3 + 1] = c[1]; col[k * 3 + 2] = c[2];
      bio[k] = c.dom; grid.lav[k] = c.lav ? 1 : 0;
    }
    if (onProgress && (j & 63) === 0) onProgress(1 + j / NV);
  }
  return true;
}

// To'r uchburchaklari bo'yicha aniq balandlik (ko'rinadigan relyef bilan bir xil)
export function gridHeight(x, z) {
  let fx = (x + HALF) / CELL, fz = (z + HALF) / CELL;
  if (fx < 0) fx = 0; else if (fx > N - 0.0001) fx = N - 0.0001;
  if (fz < 0) fz = 0; else if (fz > N - 0.0001) fz = N - 0.0001;
  const i = fx | 0, j = fz | 0, u = fx - i, v = fz - j;
  const h = grid.h, k = j * NV + i;
  const h00 = h[k], h10 = h[k + 1], h01 = h[k + NV], h11 = h[k + NV + 1];
  if (u + v <= 1) return h00 + (h10 - h00) * u + (h01 - h00) * v;
  return h11 + (h01 - h11) * (1 - u) + (h10 - h11) * (1 - v);
}
export function biomeAt(x, z) {
  const i = clamp(Math.round((x + HALF) / CELL), 0, N), j = clamp(Math.round((z + HALF) / CELL), 0, N);
  return grid.biome[j * NV + i];
}
export function lavAt(x, z) {
  const i = clamp(Math.round((x + HALF) / CELL), 0, N), j = clamp(Math.round((z + HALF) / CELL), 0, N);
  return grid.lav[j * NV + i];
}

// Qo'shimcha sirtlar: rampalar, iskala va h.k.
export const patches = [];
export function addPatch(cx, cz, yaw, len, width, y0, y1, surf = SURF.WOOD) {
  const p = { cx, cz, c: Math.cos(yaw), s: Math.sin(yaw), hl: len / 2, hw: width / 2, y0, y1, surf, rad: Math.hypot(len, width) / 2 + 1 };
  patches.push(p); return p;
}
// Maxsus sirt zonalari (muz, asfalt): {x,z,r,surf}
export const surfZones = [];
// O'simlik qo'yilmaydigan doiralar (tramplin, qo'nish maydoni): {x,z,r}
export const exclusions = [];

// Toshlar: yer sirtidagi do'ngliklar — g'ildirak ularning ustidan haqiqiydek o'tadi. {x,z,r,h,dead,road,i}
export const bumps = [];
const BC = 8, BN = Math.ceil(SIZE / BC), bumpHead = new Int32Array(BN * BN).fill(-1), bumpNext = [], bumpRef = [];
export function addBump(x, z, r, h, extra) {
  const b = Object.assign({ x, z, r, h, r2: r * r, dead: false }, extra); bumps.push(b); const id = bumps.length - 1;
  const i0 = clamp(Math.floor((x - r + HALF) / BC), 0, BN - 1), i1 = clamp(Math.floor((x + r + HALF) / BC), 0, BN - 1), j0 = clamp(Math.floor((z - r + HALF) / BC), 0, BN - 1), j1 = clamp(Math.floor((z + r + HALF) / BC), 0, BN - 1);
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const c = j * BN + i; bumpRef.push(id); bumpNext.push(bumpHead[c]); bumpHead[c] = bumpRef.length - 1; }
  return b;
}
export function bumpAt(x, z) {
  const i = ((x + HALF) / BC) | 0, j = ((z + HALF) / BC) | 0; if (i < 0 || j < 0 || i >= BN || j >= BN) return 0;
  let n = bumpHead[j * BN + i], y = 0;
  while (n >= 0) { const b = bumps[bumpRef[n]]; n = bumpNext[n]; if (b.dead) continue; const dx = x - b.x, dz = z - b.z, d2 = dx * dx + dz * dz; if (d2 < b.r2) { const v = b.h * (1 - d2 / b.r2); if (v > y) y = v; } }
  return y;
}
// Piyoda olib tashlash mumkin bo'lgan (yo'ldagi) eng yaqin tosh
export function bumpNear(x, z, rad) {
  let best = null, bd = rad;
  for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { const i = (((x + HALF) / BC) | 0) + di, j = (((z + HALF) / BC) | 0) + dj; if (i < 0 || j < 0 || i >= BN || j >= BN) continue; let n = bumpHead[j * BN + i];
    while (n >= 0) { const b = bumps[bumpRef[n]]; n = bumpNext[n]; if (b.dead || !b.road) continue; const d = Math.hypot(x - b.x, z - b.z) - b.r; if (d < bd) { bd = d; best = b; } } }
  return best;
}
export let onBumpRemoved = null;
export function setBumpHook(fn) { onBumpRemoved = fn; }
export function removeBump(b) { b.dead = true; if (onBumpRemoved) onBumpRemoved(b); }

const BS = [SURF.GRASS, SURF.GRASS, SURF.GRASS, SURF.SAND, SURF.ROCK, SURF.SNOW, SURF.SAND, SURF.GRASS, SURF.GRASS, SURF.ROCK];
const _g = { y: 0, surf: SURF.GRASS, road: 0 };
export function ground(x, z, yRef = 1e9) {
  let y = gridHeight(x, z), surf = -1, road = 0;
  const nr = nearestRoad(x, z, 1);
  if (nr.edge >= 0 && nr.d < nr.hw + 1.3) {
    let ry = nr.y;
    if (nr.d > nr.hw) ry -= ((nr.d - nr.hw) / 1.3) * 0.55;
    if (ry > y && yRef > ry - 1.3) { y = ry; surf = nr.bridge ? SURF.WOOD : SURF.ROAD; road = 1; }
    else if (nr.d < nr.hw && ry > y - 0.3) { surf = SURF.ROAD; road = 1; }
  }
  for (let i = 0; i < patches.length; i++) {
    const p = patches[i];
    const dx = x - p.cx, dz = z - p.cz;
    if (dx > p.rad || dx < -p.rad || dz > p.rad || dz < -p.rad) continue;
    const u = dx * p.s + dz * p.c, w = dx * p.c - dz * p.s;
    if (u < -p.hl || u > p.hl || w < -p.hw || w > p.hw) continue;
    const py = p.y0 + (p.y1 - p.y0) * ((u + p.hl) / (2 * p.hl));
    if (py > y && yRef > py - 1.1) { y = py; surf = p.surf; }
  }
  if (surf < 0) {
    for (let i = 0; i < surfZones.length; i++) { const s = surfZones[i]; const dx = x - s.x, dz = z - s.z; if (s.rect ? (Math.abs(dx) < s.hx && Math.abs(dz) < s.hz) : dx * dx + dz * dz < s.r * s.r) { surf = s.surf; break; } }
    if (surf < 0) surf = BS[biomeAt(x, z)];
  }
  if (bumps.length) { const b = bumpAt(x, z); if (b > 0 && yRef > y - 0.5) { y += b; if (b > 0.04) surf = SURF.ROCK; } }
  _g.y = y; _g.surf = surf; _g.road = road;
  return _g;
}
export function groundY(x, z, yRef) { return ground(x, z, yRef).y; }

// Suv sathi (dengiz 0, ko'l, daryo)
export function waterY(x, z) {
  const dx = x - LAKE.x, dz = z - LAKE.z;
  if (dx * dx + dz * dz < (LAKE.r + 80) * (LAKE.r + 80)) return LAKE.y;
  const rv = riverNear(x, z, 32);
  if (rv.i >= 0 && rv.d < RIVER.hw + 12) return river.y[rv.i];
  return 0;
}
export function getRiver() { return river; }

// --- Marshrut (Dijkstra tugunlar bo'yicha) ---
export function nodePath(a, b) {
  const nn = roads.nodes.length;
  const dist = new Float64Array(nn).fill(1e18), prev = new Int32Array(nn).fill(-1), prevE = new Int32Array(nn).fill(-1), done = new Uint8Array(nn);
  dist[a] = 0;
  for (;;) {
    let u = -1, bd = 1e18;
    for (let i = 0; i < nn; i++) if (!done[i] && dist[i] < bd) { bd = dist[i]; u = i; }
    if (u < 0 || u === b) break;
    done[u] = 1;
    for (const ei of roads.nodes[u].edges) {
      const e = roads.edges[ei]; const v = e.a === u ? e.b : e.a;
      const w = e.len * (e.type === 1 ? 1.3 : 1);
      if (dist[u] + w < dist[v]) { dist[v] = dist[u] + w; prev[v] = u; prevE[v] = ei; }
    }
  }
  const path = [];
  let c = b;
  while (c !== a && prev[c] >= 0) { path.push({ edge: prevE[c], to: c, from: prev[c] }); c = prev[c]; }
  path.reverse();
  return { path, dist: dist[b] };
}
function edgeSlice(e, i0, i1, out) {
  const st = i0 <= i1 ? 1 : -1;
  for (let k = i0; st > 0 ? k <= i1 : k >= i1; k += st) out.push([roads.x[e.start + k], roads.z[e.start + k], roads.y[e.start + k]]);
}
// Ikki nuqta orasidagi yo'l bo'ylab marshrut
export function route(x0, z0, x1, z1) {
  const A = nearestRoad(x0, z0, 12); if (A.edge < 0) return null;
  const eA = roads.edges[A.edge], iA = roads.idx[A.i];
  const B = nearestRoad(x1, z1, 12); if (B.edge < 0) return null;
  const eB = roads.edges[B.edge], iB = roads.idx[B.i];
  const out = [];
  if (eA.id === eB.id) { edgeSlice(eA, iA, iB, out); return { pts: out, len: Math.abs(eA.s[iB] - eA.s[iA]) }; }
  let best = null;
  for (const na of [eA.a, eA.b]) for (const nb of [eB.a, eB.b]) {
    const dA = na === eA.a ? eA.s[iA] : eA.len - eA.s[iA];
    const dB = nb === eB.a ? eB.s[iB] : eB.len - eB.s[iB];
    const np = na === nb ? { path: [], dist: 0 } : nodePath(na, nb);
    if (np.dist > 1e17) continue;
    const tot = dA + np.dist + dB;
    if (!best || tot < best.tot) best = { tot, na, nb, np };
  }
  if (!best) return null;
  edgeSlice(eA, iA, best.na === eA.a ? 0 : eA.count - 1, out);
  for (const st of best.np.path) { const e = roads.edges[st.edge]; if (e.a === st.from) edgeSlice(e, 0, e.count - 1, out); else edgeSlice(e, e.count - 1, 0, out); }
  edgeSlice(eB, best.nb === eB.a ? 0 : eB.count - 1, iB, out);
  return { pts: out, len: best.tot };
}
// Tugun kalitlari ketma-ketligi bo'yicha yo'l nuqtalari
export function pathByNodes(keys) {
  const pts = [];
  for (let i = 0; i < keys.length - 1; i++) {
    const a = roads.nodeBy[keys[i]], b = roads.nodeBy[keys[i + 1]]; const np = nodePath(a.id, b.id);
    for (const st of np.path) { const e = roads.edges[st.edge]; if (e.a === st.from) edgeSlice(e, 0, e.count - 1, pts); else edgeSlice(e, e.count - 1, 0, pts); }
  }
  return pts;
}
export function pathByEdges(list) { // [['e1',false],['t2',true]] — true: teskari
  const pts = [];
  for (const [key, rev] of list) { const e = roads.edges.find((q) => q.key === key); if (rev) edgeSlice(e, e.count - 1, 0, pts); else edgeSlice(e, 0, e.count - 1, pts); }
  return pts;
}

export function siteInfo(x, z) {
  const y = gridHeight(x, z);
  const e = 3;
  const sx = (gridHeight(x + e, z) - gridHeight(x - e, z)) / (2 * e), sz = (gridHeight(x, z + e) - gridHeight(x, z - e)) / (2 * e);
  const nr = nearestRoad(x, z, 1);
  return { y, slope: Math.hypot(sx, sz), roadD: nr.edge >= 0 ? nr.d - nr.hw : 99, water: waterY(x, z), biome: biomeAt(x, z) };
}
export { hash2 };
