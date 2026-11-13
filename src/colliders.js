// Statik to'qnashuv jismlari: doira (daraxt, tosh) va kesma (devor, to'siq). three.js'siz.
const CS = 16, OFF = 3328, GW = Math.ceil((OFF * 2) / CS);
const cells = new Map();
export const list = [];
const key = (cx, cz) => cz * GW + cx;
function put(i, x0, z0, x1, z1) {
  const a = Math.floor((Math.min(x0, x1) + OFF) / CS), b = Math.floor((Math.max(x0, x1) + OFF) / CS);
  const c = Math.floor((Math.min(z0, z1) + OFF) / CS), d = Math.floor((Math.max(z0, z1) + OFF) / CS);
  for (let cz = c; cz <= d; cz++) for (let cx = a; cx <= b; cx++) { const k = key(cx, cz); let arr = cells.get(k); if (!arr) cells.set(k, (arr = [])); arr.push(i); }
}
// kind: 0 qattiq, 1 sinadigan (urilganda uchib ketadi)
export function addCircle(x, z, r, y0, y1, kind = 0, ref = null) {
  const c = { t: 0, x, z, r, y0, y1, kind, ref, dead: false };
  list.push(c); put(list.length - 1, x - r, z - r, x + r, z + r); return c;
}
export function addSeg(x1, z1, x2, z2, r, y0, y1, kind = 0, ref = null) {
  const c = { t: 1, x: x1, z: z1, x2, z2, r, y0, y1, kind, ref, dead: false };
  list.push(c); put(list.length - 1, Math.min(x1, x2) - r, Math.min(z1, z2) - r, Math.max(x1, x2) + r, Math.max(z1, z2) + r); return c;
}
// To'g'ri to'rtburchak (bino): markaz, yarim o'lchamlar, burilish
export function addBox(cx, cz, hx, hz, yaw, y0, y1, r = 0.15) {
  const c = Math.cos(yaw), s = Math.sin(yaw);
  const P = (lx, lz) => [cx + lx * c + lz * s, cz - lx * s + lz * c];
  const a = P(-hx, -hz), b = P(hx, -hz), d = P(hx, hz), e = P(-hx, hz);
  addSeg(a[0], a[1], b[0], b[1], r, y0, y1); addSeg(b[0], b[1], d[0], d[1], r, y0, y1);
  addSeg(d[0], d[1], e[0], e[1], r, y0, y1); addSeg(e[0], e[1], a[0], a[1], r, y0, y1);
}
let stamp = 0; const seen = new Map();
const _out = [];
export function query(x, z, rad) {
  _out.length = 0; stamp++;
  const a = Math.floor((x - rad + OFF) / CS), b = Math.floor((x + rad + OFF) / CS), c = Math.floor((z - rad + OFF) / CS), d = Math.floor((z + rad + OFF) / CS);
  for (let cz = c; cz <= d; cz++) for (let cx = a; cx <= b; cx++) {
    const arr = cells.get(key(cx, cz)); if (!arr) continue;
    for (let k = 0; k < arr.length; k++) { const o = list[arr[k]]; if (o.dead || o._s === stamp) continue; o._s = stamp; _out.push(o); }
  }
  return _out;
}
export function clearAll() { cells.clear(); list.length = 0; }
