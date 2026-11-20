// O'yinchining uyi: 5 daraja (chodir -> kulba -> hovli -> ikki qavatli uy -> villa), bezaklar, poliz, katak, pochta qutisi
import * as THREE from 'three';
import * as T from './terrain.js';
import { GB, MAT } from './geo.js';
import * as COL from './colliders.js';
import * as BK from './blocks.js';
import { glowMat, withMask, waterSurface } from './details.js';
import { queueTree } from './props.js';
const { PAL } = BK;

export const HOME_LEVELS = [
  { name: 'Chodir', cost: 0, desc: "Boshlanishi: chodir va gulxan. Uxlash mumkin.", inc: 0 },
  { name: "Yog'och kulba", cost: 2000, desc: "Issiq kulba, o'tinxona va kuchuk uyasi. Olapar ismli kuchuk keladi!", inc: 6 },
  { name: 'Hovli uy', cost: 6000, desc: "G'ishtli uy, to'siq, poliz (6 ta jo'yak), tovuq katagi va pochta qutisi.", inc: 16 },
  { name: 'Ikki qavatli uy', cost: 15000, desc: 'Balkonli katta uy, tosh devor, mashina uchun ayvon, chiroqlar.', inc: 40 },
  { name: 'Villa', cost: 35000, desc: "Hovuzli hashamatli villa, mehmonxona qanoti. Orolning eng zo'r uyi!", inc: 90 },
];
export const DECOR = [
  { id: 'gulzor', name: 'Gulzor', cost: 500, desc: 'Hovli atrofida rang-barang gullar' },
  { id: 'bayroq', name: 'Bayroq ustuni', cost: 400, desc: 'Hovlida baland bayroq' },
  { id: 'argimchoq', name: "Arg'imchoq", cost: 600, desc: "Yog'och arg'imchoq" },
  { id: 'chiroq', name: "Yo'lak chiroqlari", cost: 800, desc: "Tunda yo'lakni yoritadi" },
  { id: 'favvora', name: 'Favvora', cost: 1500, desc: "Hovli o'rtasida tosh favvora" },
];

// qiya tom/ayvon plitasi: (z0,y0)->(z1,y1) chiziq ustida, x bo'yicha eni wx, qalinligi t; rib — cherepitsa qatorlari rangi
const slab = (g, cx, z0, z1, y0, y1, wx, t, col, rib) => {
  if (z1 < z0) { [z0, z1] = [z1, z0]; [y0, y1] = [y1, y0]; }
  const L = Math.hypot(z1 - z0, y1 - y0), th = Math.atan2(y0 - y1, z1 - z0);
  g.push().translate(cx, (y0 + y1) / 2, (z0 + z1) / 2).rotX(th).translate(0, t / 2, 0); g.color(col).box(0, 0, 0, wx, t, L);
  if (rib) { g.color(rib); for (let s = -L / 2 + 0.28; s < L / 2 - 0.1; s += 0.42) g.box(0, t / 2 + 0.018, s, wx, 0.036, 0.08); }
  g.pop();
};
// ikki qiyalikli tom (qirra X bo'ylab): devor tepasi y0 da, devor o'lchami w x d; ovF/ovB — old/orqa bo'g'ot, ovx — yon bo'g'ot
const gableRoof = (g, w, d, rise, y0, o) => {
  const e = d / 2, k = rise / e, ovF = o.ovF == null ? 0.65 : o.ovF, ovB = o.ovB == null ? 0.65 : o.ovB, ovx = o.ovx == null ? 0.55 : o.ovx, t = o.t || 0.18, W2 = w + 2 * ovx;
  g.color(o.wall).push().rotY(Math.PI / 2).gable(d, w, rise - 0.03, y0, 0).pop(); // shchit (devor rangida)
  slab(g, 0, e + ovF, 0, y0 - ovF * k, y0 + rise, W2, t, o.roof, o.rib); slab(g, 0, -e - ovB, 0, y0 - ovB * k, y0 + rise, W2, t, o.roof, o.rib);
  g.color(o.rib).box(0, y0 + rise + t * 0.9, 0, W2 + 0.04, 0.14, 0.34); // tizma
  for (const [sz, ov] of [[1, ovF], [-1, ovB]]) { const ye = y0 - ov * k; g.color(o.fascia).box(0, ye - 0.04, sz * (e + ov - 0.02), W2, 0.2, 0.06); if (o.gutter) { g.color(o.gutter).box(0, ye - 0.12, sz * (e + ov + 0.07), W2, 0.12, 0.14); } }
  return (z) => y0 + rise * (1 - Math.abs(z) / e); // tom balandligi (mo'ri uchun)
};

export function buildHome(scene, site, P) {
  const nr = T.nearestRoad(P.x, P.z, 6), R = T.roads;
  const yaw = nr.edge >= 0 ? Math.atan2(R.x[nr.i] - P.x, R.z[nr.i] - P.z) : 0, c = Math.cos(yaw), s = Math.sin(yaw);
  const W = (lx, lz) => [P.x + lx * c + lz * s, P.z - lx * s + lz * c];
  // Yer: uy maydoni yo'l tomonga ~2 m ko'tariladi (terrain.js o'zgarmaydi) — hamma narsa shu yuzaga moslab quriladi
  const hy = (lx, lz) => { const p = W(lx, lz); return T.gridHeight(p[0], p[1]) - P.y; };
  const span = (lx, lz, hx, hz, a = 0) => { const ca = Math.cos(a), sa = Math.sin(a); let lo = 1e9, hi = -1e9; for (let u = -1; u <= 1; u += 0.5) for (let v = -1; v <= 1; v += 0.5) { const h = hy(lx + u * hx * ca + v * hz * sa, lz - u * hx * sa + v * hz * ca); if (h < lo) lo = h; if (h > hi) hi = h; } return [lo, hi]; };
  const levels = [], lights = [], fires = []; site.fires = site.fires || [];
  const mkGB = (seed) => { const g = new GB(seed); g.jit = 0.035; g.translate(P.x, P.y, P.z).rotY(yaw); const gl = new GB(seed + 1); gl.jit = 0; gl.translate(P.x, P.y, P.z).rotY(yaw); return [g, gl]; };
  const at = (g, gl, lx, lz, a, fn, y = 0) => { g.push().translate(lx, y, lz).rotY(a); gl.push().translate(lx, y, lz).rotY(a); fn(g, gl); g.pop(); gl.pop(); };
  // yerga qo'yilgan buyum (yer balandligida)
  const on = (g, lx, lz, a, fn) => { g.push().translate(lx, hy(lx, lz), lz).rotY(a); fn(g); g.pop(); };
  // tekislangan poydevor: eng baland burchakdan lift yuqori, tosh asos eng past nuqtadan 0.5 m chuqurgacha tushadi
  const pad = (g, gl, lx, lz, a, hx, hz, lift, fn, col = PAL.stone) => {
    const [lo, hi] = span(lx, lz, hx, hz, a), base = hi + lift, ca = Math.cos(a), sa = Math.sin(a);
    const gnd = (x, z) => hy(lx + x * ca + z * sa, lz - x * sa + z * ca) - base;
    at(g, gl, lx, lz, a, (q, ql) => { if (col != null) q.color(col).box(0, (lo - 0.5 - base) / 2, 0, hx * 2, base - lo + 0.5, hz * 2); fn(q, ql, gnd, base); }, base);
    return base;
  };
  // yer qiyaligiga egiluvchi ramka: (x1,z1)->(x2,z2) bo'ylab, y=0 — yer chizig'i (siljish matritsasi)
  const along = (g, x1, z1, x2, z2, fn) => { const dx = x2 - x1, dz = z2 - z1, len = Math.hypot(dx, dz), h1 = hy(x1, z1), h2 = hy(x2, z2); g.push().translate(x1, h1, z1).rotY(Math.atan2(dx, dz))._mul(1, 0, 0, 0, 1, (h2 - h1) / len, 0, 0, 1); fn(g, len); g.pop(); };
  // yerga yopishgan plitkalar (to'rtburchak, uy o'qlarida): asos — choklar rangi, ustida plitkalar
  const tiles = (g, x0, z0, x1, z1, ts, cols, grout, gap = 0.05) => {
    const nx = Math.max(1, Math.round((x1 - x0) / ts)), nz = Math.max(1, Math.round((z1 - z0) / ts)), sx = (x1 - x0) / nx, sz = (z1 - z0) / nz;
    const V = (x, z, l) => [x, hy(x, z) + l, z];
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
      const a = x0 + i * sx, b = z0 + j * sz;
      g.color(grout).quad(V(a, b, 0.04), V(a, b + sz, 0.04), V(a + sx, b + sz, 0.04), V(a + sx, b, 0.04));
      const A = a + gap, B = b + gap; g.color(cols[(BK.hashP(a * 3.1 + P.x, b * 2.7, 3) * cols.length) | 0]);
      g.quad(V(A, B, 0.075), V(A, B + sz - gap * 2, 0.075), V(A + sx - gap * 2, B + sz - gap * 2, 0.075), V(A + sx - gap * 2, B, 0.075));
    }
  };
  // shu daraja/bezak qurilayotganda qo'shilgan mo'ri va chiroqlarni belgilash (faqat ko'rinayotgan daraja tutaydi)
  const tagLv = (c0, l0, lv, sty) => { for (let i = c0; i < BK.CHIMNEYS.length; i++) { BK.CHIMNEYS[i].lv = lv; if (sty != null) BK.CHIMNEYS[i].sty = sty; } for (let i = l0; i < BK.LAMPS.length; i++) BK.LAMPS[i].lv = lv; };
  // to'qnashuvlar: balandligi joydagi yerga qarab
  const seg = (list, a, b, c2, d, h = 2.2, r = 0.25) => { const p1 = W(a, b), p2 = W(c2, d), y1 = hy(a, b), y2 = hy(c2, d); const o = COL.addSeg(p1[0], p1[1], p2[0], p2[1], r, P.y + Math.min(y1, y2) - 2, P.y + Math.max(y1, y2) + h); o.dead = true; list.push(o); };
  const box = (list, lx, lz, hx, hz, h = 8) => { seg(list, lx - hx, lz - hz, lx + hx, lz - hz, h); seg(list, lx + hx, lz - hz, lx + hx, lz + hz, h); seg(list, lx + hx, lz + hz, lx - hx, lz + hz, h); seg(list, lx - hx, lz + hz, lx - hx, lz - hz, h); };
  const circ = (list, lx, lz, r, h = 4) => { const p = W(lx, lz), y = hy(lx, lz); const o = COL.addCircle(p[0], p[1], r, P.y + y - 2, P.y + y + h); o.dead = true; list.push(o); };
  // chiroq: bitta umumiy PointLight eng yaqinini oladi (main.js: kuch = power*60) — past chiroqlar kuchsiz, aks holda o't neon bo'lib yonadi
  const light = (lv, lx, ly, lz, hex = 0xffb070, power = 0.3, decor, sty) => { const p = W(lx, lz); const l = { x: p[0], y: P.y + hy(lx, lz) + ly, z: p[1], hex, power, on: false, lv, decor, sty }; lights.push(l); site.lights.push(l); };
  const finish = (g, gl) => { const grp = new THREE.Group(); const m = new THREE.Mesh(g.build(), MAT.flat); m.castShadow = true; m.receiveShadow = true; grp.add(m); if (gl.count) grp.add(new THREE.Mesh(withMask(gl.build()), glowMat())); grp.visible = false; scene.add(grp); return grp; };
  const glow = (g, gl, fn) => { gl.push(); gl.m = g.m.slice(); gl.flip = g.flip; fn(gl); gl.pop(); };

  // ======== Uy (hovli uylari, 2..4-daraja): suvoqli devor, tosh poydevor, romli derazalar, yog'och eshik, qalin tom, ayvon/balkon ========
  // o: {w,d,fl,fh,roof,wall,roofC,rib,trim,door,sill,band,fascia,shutter,ayvon,balcony,balRoof,villa,chimney}; gnd(x,z) — yer (pol=0 ga nisbatan)
  const house = (g, gl, o, gnd) => {
    const w = o.w, d = o.d, fh = o.fh || 3.1, fl = o.fl || 1, H = fh * fl, villa = !!o.villa, zf = d / 2;
    const gut = 0x9aa0a8, posts = [];
    g.color(o.wall).box(0, H / 2, 0, w, H, d);
    g.color(o.band).box(0, 0.07, 0, w + 0.32, 0.14, d + 0.32); // poydevor qopqog'i
    if (fl > 1) g.box(0, fh, 0, w + 0.16, 0.2, d + 0.16); // qavatlar orasidagi belbog'
    g.box(0, H + 0.11, 0, w + 0.3, 0.22, d + 0.3); // karniz
    if (villa) { g.color(o.band); for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.box(sx * (w / 2 - 0.12), H / 2, sz * (d / 2 - 0.12), 0.46, H, 0.46); }
    // deraza: rom, shisha (tunda yonadi), tabaqa, tokcha, peshtoq, ixtiyoriy darcha qanotlari
    const win = (x, y, z, ry, ww = 1.2, wh = 1.4) => {
      g.push().translate(x, y, z).rotY(ry); g.color(o.trim).box(0, 0, 0.03, ww + 0.22, wh + 0.22, 0.08);
      glow(g, gl, (q) => { const p = BK.wpt(g, 0, 0, 0); q.mask(1.02 + 0.96 * BK.hashP(p[0], p[2], 5)).color(PAL.win).box(0, 0, 0.05, ww, wh, 0.05).mask(0); });
      g.color(o.trim).box(0, 0, 0.09, 0.07, wh, 0.04); g.box(0, wh * 0.2, 0.09, ww, 0.06, 0.04);
      g.color(o.sill).box(0, -wh / 2 - 0.15, 0.12, ww + 0.36, 0.09, 0.3); g.color(o.band).box(0, wh / 2 + 0.18, 0.06, ww + 0.42, 0.13, 0.15);
      if (o.shutter) { g.color(o.shutter); for (const sx of [-1, 1]) { g.box(sx * (ww / 2 + 0.33), 0, 0.08, 0.44, wh + 0.08, 0.05); g.color(o.trim).box(sx * (ww / 2 + 0.33), 0, 0.11, 0.3, wh - 0.3, 0.02); g.color(o.shutter); } }
      g.pop();
    };
    // eshik: romli qo'sh tabaqa, o'yma panellar, tutqich, tepasida shisha
    const door = (x, y, z, dw, dh, glass) => {
      g.push().translate(x, y, z); g.color(o.trim).box(0, dh / 2 + 0.1, 0.04, dw + 0.3, dh + 0.2, 0.1);
      for (const sx of [-1, 1]) {
        if (glass) { glow(g, gl, (q) => { const p = BK.wpt(g, sx, 1, 0); q.mask(1.02 + 0.96 * BK.hashP(p[0], p[2], 6)).color(PAL.win).box(sx * dw / 4, dh / 2, 0.08, dw / 2 - 0.08, dh - 0.1, 0.04).mask(0); }); g.color(o.trim).box(sx * dw / 4, dh / 2, 0.1, dw / 2 - 0.02, 0.07, 0.04); g.box(sx * (dw / 2 - 0.03), dh / 2, 0.1, 0.06, dh, 0.04); }
        else { g.color(o.door).box(sx * dw / 4, dh / 2, 0.08, dw / 2 - 0.03, dh, 0.06); g.color(o.doorD); for (const py of [0.62, 1.55]) g.box(sx * dw / 4, py * dh / 2.2, 0.115, dw / 2 - 0.26, 0.66, 0.025); g.color(0xd8b860).box(sx * 0.09, dh * 0.47, 0.14, 0.04, 0.18, 0.04); }
      }
      glow(g, gl, (q) => { const p = BK.wpt(g, 0, 2, 0); q.mask(1.02 + 0.96 * BK.hashP(p[0], p[2], 7)).color(PAL.win).box(0, dh + 0.26, 0.06, dw - 0.1, 0.24, 0.04).mask(0); });
      g.color(o.trim).box(0, dh + 0.42, 0.05, dw + 0.3, 0.1, 0.1); g.pop();
    };
    const nx = Math.max(1, Math.floor(w / 2.8)), nz = Math.max(1, Math.floor(d / 3.2));
    for (let f = 0; f < fl; f++) {
      const y = f * fh + 1.6;
      for (let i = 0; i < nx; i++) { const x = (i - (nx - 1) / 2) * (w / nx); if (Math.abs(x) > 1.3 || (f > 0 && !o.balcony)) win(x, y, zf, 0, villa ? 1.4 : 1.2, villa ? 1.6 : 1.4); win(x, y, -zf, Math.PI); }
      for (let i = 0; i < nz; i++) { const z = (i - (nz - 1) / 2) * (d / nz); win(w / 2, y, z, Math.PI / 2); win(-w / 2, y, z, -Math.PI / 2); }
    }
    door(0, 0, zf, villa ? 1.8 : 1.5, 2.25, false);
    if (fl > 1 && o.balcony) door(0, fh + 0.16, zf, 1.6, 2.2, true);
    // zinapoya: poldan old tomondagi yergacha
    { const gF = gnd(0, zf + 1.0); if (gF < -0.06) { const n = Math.max(1, Math.round(-gF / 0.17)), st = -gF / n; g.color(o.sill); for (let i = 0; i < n; i++) { const top = -i * st, z = zf + 0.25 + i * 0.34; g.box(0, (top + gF - 0.3) / 2, z, 2.3 - i * 0.04, top - gF + 0.3, i ? 0.36 : 0.5); } } }
    // ustunlar (ayvon/balkon tayanchlari): yerga tosh asos, ustun, bosh
    const post = (x, z, y1, white) => {
      const gy = gnd(x, z); posts.push([x, z]);
      g.color(o.sill).box(x, gy - 0.05, z, 0.46, 0.6, 0.46); g.box(x, gy + 0.3, z, 0.36, 0.1, 0.36);
      if (white) { g.color(o.band).push().translate(x, 0, z).cyl(10, 0.16, 0.13, gy + 0.35, y1 - 0.14, { shade: 0.08 }).pop(); g.box(x, y1 - 0.08, z, 0.44, 0.14, 0.44); }
      else if (o.carved) { // o'ymakor ustun: ko'zasimon asos, sakkiz qirrali tana, halqalar, keng bosh (sarlavha)
        g.color(o.post).push().translate(x, 0, z); g.cyl(8, 0.15, 0.19, gy + 0.35, gy + 0.62, { shade: 0.1 }); g.cyl(8, 0.19, 0.1, gy + 0.62, gy + 0.95, { shade: 0.1 }); g.cyl(8, 0.1, 0.12, gy + 0.95, y1 - 0.42, { shade: 0.12 });
        g.color(o.postD); for (const k of [0.3, 0.55, 0.78]) { const yy = gy + 0.95 + (y1 - 0.42 - gy - 0.95) * k; g.cyl(8, 0.135, 0.135, yy - 0.03, yy + 0.03); } g.cyl(8, 0.12, 0.2, y1 - 0.42, y1 - 0.2, { shade: 0.1 }); g.pop();
        g.color(o.postD).box(x, y1 - 0.12, z, 0.62, 0.16, 0.34); g.color(o.post).box(x, y1 - 0.24, z, 0.46, 0.08, 0.28); }
      else { g.color(o.post).box(x, (gy + 0.35 + y1) / 2, z, 0.22, y1 - gy - 0.35, 0.22); g.color(o.postD).box(x, y1 - 0.1, z, 0.34, 0.12, 0.34); g.box(x, y1 - 0.28, z, 0.28, 0.1, 0.28); g.box(x, gy + 0.62, z, 0.28, 0.12, 0.28); g.box(x, y1 - 0.06, z, 0.24, 0.14, 0.9); }
    };
    // ayvon (1 qavatli): old tomonda yengil qiya tom, ustunlar
    if (o.ayvon) {
      const D = o.ayvon, ze = zf + D, xs = w / 2 - 0.3, yW = H - 0.08, yE = H - 0.78, yAt = (z) => yW + (yE - yW) * (z - zf) / (D + 0.35);
      for (const x of [-xs, -xs / 3, xs / 3, xs]) post(x, ze - 0.25, yAt(ze - 0.25), false);
      g.color(o.postD).box(0, yAt(ze - 0.25) - 0.02, ze - 0.25, w - 0.4, 0.16, 0.22); // to'sin
      slab(g, 0, zf - 0.02, ze + 0.35, yW + 0.02, yE, w + 0.6, 0.14, o.roofC, o.rib);
      g.color(o.fascia).box(0, yE - 0.06, ze + 0.33, w + 0.6, 0.18, 0.06); g.color(gut).box(0, yE - 0.12, ze + 0.42, w + 0.6, 0.11, 0.13);
    }
    // balkon (2 qavatli): beton plita, panjara (ustunchalar), pastda tayanch ustunlar, ustida (ixtiyoriy) qiya tom
    if (fl > 1 && o.balcony) {
      const bd = o.balcony, bw = w - 0.4, ze = zf + bd, yb = fh + 0.17, rh = 1.0;
      g.color(o.slabC).box(0, fh + 0.06, zf + bd / 2, bw, 0.22, bd); g.color(o.band).box(0, fh + 0.02, ze - 0.03, bw + 0.06, 0.32, 0.12);
      for (const sx of [-1, 1]) g.box(sx * bw / 2, fh + 0.02, zf + bd / 2, 0.12, 0.32, bd);
      g.color(o.rail); g.box(0, yb + rh, ze - 0.1, bw, 0.08, 0.14); g.box(0, yb + 0.1, ze - 0.1, bw, 0.07, 0.1);
      for (const sx of [-1, 1]) { g.box(sx * (bw / 2 - 0.08), yb + rh, zf + bd / 2, 0.14, 0.08, bd); g.box(sx * (bw / 2 - 0.08), yb + 0.1, zf + bd / 2, 0.1, 0.07, bd); }
      const bal = (x, z) => { if (villa) g.push().translate(x, 0, z).cyl(6, 0.04, 0.05, yb + 0.13, yb + rh - 0.04).pop(); else g.box(x, yb + rh / 2 + 0.05, z, 0.05, rh - 0.1, 0.05); };
      for (let x = -bw / 2 + 0.25; x < bw / 2 - 0.15; x += 0.2) bal(x, ze - 0.1);
      for (const sx of [-1, 1]) for (let z = zf + 0.25; z < ze - 0.2; z += 0.2) bal(sx * (bw / 2 - 0.08), z);
      const xs = bw / 2 - 0.25, px = villa ? [-xs, -xs / 3, xs / 3, xs] : [-xs, -xs / 3, xs / 3, xs];
      for (const x of px) post(x, ze - 0.28, fh - 0.05, villa);
      if (o.balRoof) {
        const yW = H - 0.06, yE = H - 0.8, yAt = (z) => yW + (yE - yW) * (z - zf) / (bd + 0.35);
        for (const x of px) { g.color(o.post).box(x, (yb + 0.02 + yAt(ze - 0.28)) / 2, ze - 0.28, 0.18, yAt(ze - 0.28) - yb, 0.18); g.color(o.postD).box(x, yAt(ze - 0.28) - 0.1, ze - 0.28, 0.3, 0.12, 0.3); }
        g.color(o.postD).box(0, yAt(ze - 0.28) - 0.04, ze - 0.28, bw, 0.14, 0.2);
        slab(g, 0, zf - 0.02, ze + 0.35, yW + 0.02, yE, w + 0.4, 0.14, o.roofC, o.rib);
        g.color(o.fascia).box(0, yE - 0.06, ze + 0.33, w + 0.4, 0.18, 0.06); g.color(gut).box(0, yE - 0.12, ze + 0.42, w + 0.4, 0.11, 0.13);
      }
    }
    // tom
    const y0 = H + 0.22; let roofY;
    if (o.roof === 'hip') {
      const ov = 0.7, rise = Math.min(w, d) * 0.3;
      g.color(o.band).box(0, y0 - 0.02, 0, w + ov * 2, 0.24, d + ov * 2); g.color(gut);
      for (const sz of [-1, 1]) g.box(0, y0 - 0.1, sz * (d / 2 + ov + 0.06), w + ov * 2 + 0.1, 0.12, 0.13);
      for (const sx of [-1, 1]) g.box(sx * (w / 2 + ov + 0.06), y0 - 0.1, 0, 0.13, 0.12, d + ov * 2 + 0.1);
      g.color(o.roofC).hip(w, d, rise, y0 + 0.1, ov - 0.04, 0.22); roofY = (z) => y0 + 0.1 + rise * (1 - Math.abs(z) / (d / 2 + ov)) * 0.95;
    } else if (o.roof === 'flat') { // an'anaviy tekis tom: loy suvoq, chiqib turgan to'sin uchlari (vassa), past parapet
      g.color(o.band).box(0, y0 - 0.02, 0, w + 0.7, 0.24, d + 0.7); g.color(o.roofC).box(0, y0 + 0.17, 0, w + 0.56, 0.14, d + 0.56);
      g.color(o.post); for (let x = -w / 2 + 0.3; x <= w / 2 - 0.25; x += 0.55) for (const sz of [-1, 1]) g.box(x, y0 - 0.2, sz * (d / 2 + 0.28), 0.13, 0.13, 0.42);
      g.color(o.band); for (const sz of [-1, 1]) g.box(0, y0 + 0.38, sz * (d / 2 + 0.22), w + 0.56, 0.3, 0.12); for (const sx of [-1, 1]) g.box(sx * (w / 2 + 0.22), y0 + 0.38, 0, 0.12, 0.3, d + 0.56);
      roofY = () => y0 + 0.25;
    } else roofY = gableRoof(g, w, d, d * 0.34, y0, { wall: o.wall, roof: o.roofC, rib: o.rib, fascia: o.fascia, gutter: gut, ovF: o.ayvon || o.balRoof ? 0.25 : 0.65 });
    // tarnov quvurlari (old burchaklarda, yergacha)
    if (!o.carved) { g.color(gut); for (const sx of [-1, 1]) { const x = sx * (w / 2 + 0.16), z = zf + 0.16, b = gnd(x, z) + 0.05; g.box(x, (y0 + b) / 2, z, 0.1, y0 - b, 0.1); g.box(x, b + 0.04, z + 0.14, 0.1, 0.08, 0.3); } }
    if (o.chimney) { const cx = w * 0.28, cz = -d * 0.16, yr = roofY(cz); g.color(PAL.stoneD).box(cx, yr + 0.5, cz, 0.7, 1.9, 0.7); g.color(0x5a5650).box(cx, yr + 1.5, cz, 0.86, 0.12, 0.86); const p = BK.wpt(g, cx, yr + 1.6, cz); BK.CHIMNEYS.push({ x: p[0], y: p[1], z: p[2], ph: BK.hashP(p[0], p[2], 4) * 100 }); }
    return { hx: w / 2 + 0.3, hz: d / 2 + 0.3, top: y0 + 3, posts, front: zf + (o.ayvon || o.balcony || 0) };
  };

  const FX = 17, FZ = 15, GATE = 2.6;
  const BEDS = []; for (const bx of [-12.6, -8.6]) for (const bz of [3.2, 6.7, 10.2]) BEDS.push([bx, bz]);
  const bedY = BEDS.map(([bx, bz]) => P.y + span(bx, bz, 1.5, 1.25)[1] + 0.24);
  // ---- to'siq/devor: yerga qarab bo'laklangan, poydevor yer ostiga kiradi, ustunlar har bo'lak chegarasida ----
  const fence = (g, cols, x1, z1, x2, z2, st) => {
    const len = Math.hypot(x2 - x1, z2 - z1), n = Math.max(1, Math.ceil(len / (st.wood ? 2.5 : 3.6))), yw = Math.atan2(x2 - x1, z2 - z1), h = st.h, th = 0.42;
    for (let i = 0; i < n; i++) {
      const a = i / n, b = (i + 1) / n, ax = x1 + (x2 - x1) * a, az = z1 + (z2 - z1) * a, bx = x1 + (x2 - x1) * b, bz = z1 + (z2 - z1) * b;
      along(g, ax, az, bx, bz, (q, L) => {
        if (st.wood) { q.color(PAL.wood).box(0, 0.34, L / 2, 0.07, 0.1, L); q.box(0, h - 0.24, L / 2, 0.07, 0.1, L); q.color(st.picket); const np = Math.round(L / 0.3); for (let k = 0; k < np; k++) { const z = (k + 0.5) * L / np; q.box(0.06, (h - 0.2) / 2, z, 0.04, h + 0.2, 0.12); q.box(0.06, h + 0.02, z, 0.04, 0.08, 0.07); } }
        else { q.color(st.plinth).box(0, -0.06, L / 2, th + 0.14, 0.92, L); q.color(st.wall).box(0, 0.4 + (h - 0.4) / 2, L / 2, th, h - 0.4, L); q.color(st.cap).box(0, h + 0.06, L / 2, th + 0.2, 0.12, L + 0.02); }
      });
    }
    for (let i = 0; i <= n; i++) { const x = x1 + (x2 - x1) * i / n, z = z1 + (z2 - z1) * i / n; on(g, x, z, yw, (q) => { if (st.wood) { q.color(PAL.woodD).box(0, (h - 0.4) / 2, 0, 0.14, h + 0.5, 0.14); q.box(0, h + 0.1, 0, 0.18, 0.06, 0.18); } else { q.color(st.plinth).box(0, (h - 0.2) / 2, 0, 0.64, h + 0.9, 0.64); q.color(st.cap).box(0, h + 0.32, 0, 0.78, 0.12, 0.78); q.box(0, h + 0.42, 0, 0.5, 0.1, 0.5); } }); }
    seg(cols, x1, z1, x2, z2, h + 0.1, 0.28);
  };
  // darvoza: ikki katta ustun, tepasida kichik tom, ichkariga ochilgan ikki tabaqa
  const gate = (g, cols, st) => {
    const hL = hy(-GATE - 0.35, FZ), hR = hy(GATE + 0.35, FZ), top = Math.max(hL, hR) + 3.0;
    for (const sx of [-1, 1]) on(g, sx * (GATE + 0.35), FZ, 0, (q) => { const y = hy(sx * (GATE + 0.35), FZ), H2 = top - y; q.color(st.wood ? PAL.woodD : st.plinth).box(0, (H2 - 0.5) / 2, 0, 0.7, H2 + 0.5, 0.7); q.color(st.wood ? PAL.wood : st.cap).box(0, H2 + 0.06, 0, 0.84, 0.12, 0.84); });
    g.push().translate(0, top, FZ); g.color(st.wood ? PAL.woodD : st.cap).box(0, 0.12, 0, GATE * 2 + 1.4, 0.24, 0.5); slab(g, 0, -0.75, 0, 0.3, 0.75, GATE * 2 + 1.9, 0.12, st.roof, st.rib); slab(g, 0, 0.75, 0, 0.3, 0.75, GATE * 2 + 1.9, 0.12, st.roof, st.rib); g.pop();
    // tabaqalar: ochiq holatda (90°), ichkariga
    for (const sx of [-1, 1]) {
      const x = sx * (GATE - 0.05), z0 = FZ - 0.3, z1 = FZ - 0.3 - GATE, [, hiL] = span(x, (z0 + z1) / 2, 0.1, GATE / 2), y = hiL + 0.08, gh = 2.1;
      g.push().translate(x, y, (z0 + z1) / 2); g.color(st.leaf).box(0, gh / 2, 0, 0.08, gh, GATE - 0.08); g.color(st.leafD);
      g.box(0, gh / 2, 0, 0.1, gh, 0.08); for (const zz of [-1, 1]) g.box(0, gh / 2, zz * (GATE / 2 - 0.06), 0.1, gh, 0.1); g.box(0, gh - 0.05, 0, 0.1, 0.1, GATE - 0.08); g.box(0, 0.05, 0, 0.1, 0.1, GATE - 0.08); g.box(0, gh * 0.62, 0, 0.1, 0.07, GATE - 0.08);
      for (const zz of [-1, 1]) for (const yy of [0.32, 0.82]) g.box(0, gh * yy, zz * GATE / 4, 0.11, 0.42, GATE / 2 - 0.4);
      g.pop(); seg(cols, x, z0, x, z1, 2.1, 0.12);
    }
  };
  // poliz jo'yagi: yog'och hoshiyali ko'tarma tuproq, ikki egat
  const bed = (g, bx, bz) => {
    const [lo, hi] = span(bx, bz, 1.5, 1.25), top = hi + 0.24, dep = top - lo + 0.15;
    g.push().translate(bx, top, bz); g.color(PAL.woodD); for (const sz of [-1, 1]) g.box(0, 0.03 - dep / 2, sz * 1.21, 3.0, dep + 0.06, 0.08); for (const sx of [-1, 1]) g.box(sx * 1.46, 0.03 - dep / 2, 0, 0.08, dep + 0.06, 2.34);
    g.color(0x5e4130).box(0, -dep / 2, 0, 2.84, dep, 2.34); g.color(0x7a5639); for (const sz of [-0.55, 0.55]) g.box(0, 0.05, sz, 2.72, 0.1, 0.62, { tz: 0.5 }); g.color(0x4e3526).box(0, 0.005, 0, 2.72, 0.02, 0.3);
    g.pop();
  };
  // so'ri: yog'och supa (to'shak, yostiq, xontaxta) va ustida tok ishkomi
  const tapchan = (g, gl, cols, x, z) => {
    pad(g, gl, x, z, 0, 1.4, 1.4, 0.05, (q, _, gnd) => {
      q.color(PAL.woodD); for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const gy = gnd(sx * 1.2, sz * 1.2); q.box(sx * 1.2, (gy - 0.1 + 0.45) / 2, sz * 1.2, 0.14, 0.55 - gy, 0.14); }
      q.color(PAL.wood).box(0, 0.48, 0, 2.6, 0.1, 2.6); q.color(PAL.woodD); for (const [ax, az, lx, lz] of [[0, -1.25, 2.6, 0.08], [-1.25, 0, 0.08, 2.6], [1.25, 0, 0.08, 2.6]]) { q.box(ax, 0.82, az, lx, 0.08, lz); for (let k = -1; k <= 1; k += 0.5) q.box(ax + (lz > 1 ? 0 : k * 1.2), 0.66, az + (lz > 1 ? k * 1.2 : 0), 0.06, 0.32, 0.06); }
      q.color(0xb8322e).box(0, 0.56, 0, 2.4, 0.07, 2.4); q.color(0xe8b23a); for (const [ax, az, lx, lz] of [[0, -1.0, 2.2, 0.36], [-1.0, 0.1, 0.36, 1.9], [1.0, 0.1, 0.36, 1.9]]) q.box(ax, 0.64, az, lx, 0.1, lz);
      q.color(0x2f6fa8); for (const [ax, az] of [[-0.7, -1.08], [0.1, -1.08], [0.9, -1.08]]) q.box(ax, 0.8, az, 0.6, 0.3, 0.16);
      q.color(PAL.woodL).box(0, 0.74, 0.15, 0.95, 0.06, 0.7); q.color(PAL.woodD); for (const sx of [-1, 1]) for (const sz of [-1, 1]) q.box(sx * 0.4, 0.66, 0.15 + sz * 0.28, 0.06, 0.12, 0.06);
      q.color(0xf2ead8).push().translate(0.15, 0.77, 0.2).cyl(8, 0.18, 0.2, 0, 0.03).pop(); q.color(0x2f7fb0).push().translate(-0.18, 0.77, 0.05).cyl(6, 0.05, 0.06, 0, 0.07).pop();
    });
    // ishkom: 4 ustun, panjara, tok barglari va uzum shingillari
    const [, hi] = span(x, z, 1.9, 1.9), yt = hi + 2.7;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const px = x + sx * 1.85, pz = z + sz * 1.85; on(g, px, pz, 0, (q) => { const y = hy(px, pz); q.color(PAL.woodD).box(0, (yt - y - 0.3) / 2, 0, 0.14, yt - y + 0.3, 0.14); }); circ(cols, px, pz, 0.12, 2.6); }
    g.push().translate(x, yt, z); g.color(PAL.woodD); for (const sz of [-1, 1]) g.box(0, 0.06, sz * 1.85, 4.0, 0.12, 0.1); for (let k = -1.85; k <= 1.86; k += 0.62) g.box(k, 0.15, 0, 0.06, 0.06, 4.0);
    for (let i = 0; i < 9; i++) { const ax = (BK.hashP(x + i, z, 11) - 0.5) * 3.4, az = (BK.hashP(x, z + i, 12) - 0.5) * 3.4; g.color([0x4f8f3a, 0x5d9e44, 0x467f34][i % 3]).blob(0.62, 1, { cx: ax, cy: 0.28, cz: az, sy: 0.38, jitter: 0.12, shade: 0.25 }); }
    g.color(0x6a3a7a); for (let i = 0; i < 6; i++) { const ax = (BK.hashP(x + i, z, 13) - 0.5) * 3, az = (BK.hashP(x, z + i, 14) - 0.5) * 3; g.blob(0.11, 0, { cx: ax, cy: 0.0, cz: az, sy: 1.6 }); }
    g.color(0x6e4a30); for (const sx of [-1, 1]) g.push().translate(sx * 1.85, -1.2, 1.85).rotZ(sx * 0.15).cyl(5, 0.05, 0.04, 0, 1.3).pop();
    g.pop(); circ(cols, x, z, 1.45, 0.9);
  };
  // yo'lak: darvozadan uyga (plitka)
  const path = (g, z0, z1, cols, grout) => tiles(g, -0.9, z0, 0.9, z1, 0.6, cols, grout);
  // hovli jihozlari (2-darajadan)
  const yard = (g, gl, cols, st, lv, front) => {
    for (const [a, b, c2, d] of [[-FX, -FZ, FX, -FZ], [FX, -FZ, FX, FZ], [-FX, FZ, -FX, -FZ], [-FX, FZ, -GATE - 0.7, FZ], [GATE + 0.7, FZ, FX, FZ]]) fence(g, cols, a, b, c2, d, st);
    gate(g, cols, st);
    for (const [bx, bz] of BEDS) bed(g, bx, bz);
    // tovuq katagi: oyoqlarda, narvoncha, to'r bilan o'ralgan maydoncha
    pad(g, gl, 13, -12, -0.5, 1.3, 1.1, 0.42, (q, ql, gnd) => {
      q.color(PAL.woodD); for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const gy = gnd(sx * 1.1, sz * 0.9); q.box(sx * 1.1, gy / 2, sz * 0.9, 0.12, -gy + 0.05, 0.12); }
      q.color(PAL.wood).box(0, 0.6, 0, 2.4, 1.2, 2.0); q.color(PAL.woodD); for (let i = 0; i < 4; i++) q.box(0, 0.15 + i * 0.3, 1.01, 2.42, 0.03, 0.03);
      q.color(0x2a2c33).box(0.5, 0.4, 1.02, 0.4, 0.5, 0.04); q.color(PAL.woodL).box(0.5, 0.0, 1.02, 0.5, 0.06, 0.06);
      gableRoof(q, 2.4, 2.0, 0.7, 1.2, { wall: PAL.wood, roof: PAL.roof[1], rib: 0x8e3a28, fascia: PAL.woodD, ovF: 0.25, ovB: 0.25, ovx: 0.2, t: 0.1 });
      const gy = gnd(0.5, 1.9); q.push().translate(0.5, gy / 2 - 0.02, 1.5).rotX(Math.atan2(-gy, 1.0)); q.color(PAL.woodL).box(0, 0, 0, 0.45, 0.05, Math.hypot(gy, 1.0)); q.pop();
    }, null);
    box(cols, 13, -12, 1.25, 1.05, 2.4);
    // pochta qutisi (darvoza tashqarisida)
    on(g, 3.5, FZ + 1.5, 0, (q) => { q.color(PAL.woodD).box(0, 0.5, 0, 0.1, 1.4, 0.1); q.color(0x2f7fd0).box(0, 1.3, 0, 0.36, 0.32, 0.52); q.push().translate(0, 1.46, 0).rotX(Math.PI / 2).cyl(8, 0.18, 0.18, -0.26, 0.26).pop(); q.color(PAL.red).box(0.2, 1.42, 0.12, 0.03, 0.24, 0.05); });
    circ(cols, 3.5, FZ + 1.5, 0.2, 1.6);
    path(g, front, FZ + 0.4, st.tile, st.grout);
    // tandir (loy tandir, tosh supa ustida)
    pad(g, gl, -5.6, 0.6, 0.6, 0.7, 0.7, 0.05, (q) => { q.color(PAL.stoneD).box(0, 0.15, 0, 1.4, 0.3, 1.4); q.color(PAL.clay).push().translate(0, 0.3, 0).blob(0.58, 1, { cy: 0.38, sy: 0.82, shade: 0.18 }).pop(); q.color(0x3a2a22).push().translate(0, 0.3, 0).rotX(-0.9).cyl(8, 0.2, 0.2, 0.42, 0.6).pop(); q.color(PAL.clayD).push().translate(0, 0.3, 0).cyl(8, 0.24, 0.22, 0.7, 0.82).pop(); }, PAL.stoneD);
    circ(cols, -5.6, 0.6, 0.7, 1.2);
    tapchan(g, gl, cols, 11.5, 7.5);
  };
  // kuchuk uyasi (poydevorda, qiya tomli)
  const dogHouse = (g, gl) => pad(g, gl, 8.8, 0.6, -0.4, 0.7, 0.8, 0.08, (q) => { q.color(PAL.wood).box(0, 0.45, 0, 1.2, 0.9, 1.4); q.color(PAL.woodD); for (let i = 0; i < 3; i++) q.box(0, 0.2 + i * 0.28, 0.71, 1.22, 0.03, 0.02); gableRoof(q, 1.4, 1.2, 0.5, 0.9, { wall: PAL.wood, roof: PAL.roof[0], rib: 0x8e3a28, fascia: PAL.woodD, ovF: 0.18, ovB: 0.18, ovx: 0.12, t: 0.08 }); q.color(0x2a2c33).box(0, 0.36, 0.71, 0.5, 0.6, 0.03); q.color(0x8a909c).push().translate(0.45, 0, 1.1).cyl(8, 0.18, 0.2, 0, 0.1).pop(); }, PAL.stoneD);
  // mashina joyi: yerga yopishgan shag'al, 3-4 darajada ustunli soyabon
  const parking = (g, gl, cols, roofed, lv = 0) => {
    tiles(g, 3.0, 18.7, 16.0, 24.3, 1.3, [0xb3a48c, 0xab9c84, 0xb8aa92], 0x8e826e, 0.03);
    if (roofed) { const ps = [[3.2, 19], [15.8, 19], [3.2, 24], [15.8, 24]], top = Math.max(...ps.map(([x, z]) => hy(x, z))) + 4.6;
      for (const [x, z] of ps) { on(g, x, z, 0, (q) => { const y = hy(x, z); q.color(PAL.stone).box(0, 0.1, 0, 0.5, 0.5, 0.5); q.color(PAL.woodD).box(0, (top - y + 0.3) / 2, 0, 0.26, top - y - 0.3, 0.26); }); circ(cols, x, z, 0.2, 4.6); }
      g.push().translate(9.5, top, 21.5); g.color(PAL.woodD).box(0, -0.1, -2.5, 13, 0.24, 0.22).box(0, -0.1, 2.5, 13, 0.24, 0.22); slab(g, 0, -3.2, 3.2, 0.25, -0.15, 13.8, 0.14, PAL.roof[1], 0x8e3a28);
      gl.push(); gl.m = g.m.slice(); gl.color(PAL.lamp).box(0, -0.25, 0, 3.6, 0.06, 0.3); gl.pop(); g.pop(); light(lv, 9.5, top - hy(9.5, 21.5) - 0.4, 21.5, 0xffb070, 0.22); }
  };
  // hovli daraxtlari: barcha darajada turadi — haqiqiy o'simlik (props.js/flora.js), navbat yopilgan bo'lsa eski geometriya
  { const [g, gl] = mkGB(698), cols = []; for (const [x, z, sc, hex] of [[-14.5, -1.5, 0.8, 0x5cab4a], [15, 12.5, 0.75, 0xf7a8c4], [-8, -18.6, 0.9, 0x2f7a52], [7, -19, 0.8, 0x5cab4a]]) { const p = W(x, z); if (!queueTree(p[0], P.y + hy(x, z), p[1], sc, hex)) on(g, x, z, 0, (q) => BK.tree(q, 0, 0, sc, hex)); COL.addCircle(p[0], p[1], 0.3, P.y + hy(x, z) - 2, P.y + hy(x, z) + 5); }
    if (g.count) { const m = new THREE.Mesh(g.build(), MAT.flat); m.castShadow = true; m.receiveShadow = true; scene.add(m); } }
  // --- 0: chodir ---
  { const [g, gl] = mkGB(701), cols = [];
    on(g, 0, -2, 0, (q) => { q.translate(0, -0.06, 0); BK.tent(q, 0, 0, 0, 0xe2572f, 1.3); }); on(g, 3.6, 2.6, 0, (q) => BK.campfire(q, 0, 0)); on(g, -4.2, 0.5, 0.5, (q) => BK.logPile(q, 0, 0, 0, 2)); on(g, 3.6, 5.2, Math.PI, (q) => BK.bench(q, 0, 0, 0));
    on(g, -3, 6, 0, (q) => { q.color(PAL.woodD).box(0, 0.6, 0, 0.12, 1.6, 0.12); q.color(0xf2ead8).box(0, 1.25, 0.07, 1.5, 0.6, 0.06); });
    tiles(g, -0.9, 6.5, 0.9, FZ + 0.4, 0.9, [0xa8916e, 0x9e8866], 0x8a7a5e, 0.12);
    circ(cols, 0, -2, 1.7, 2.4); circ(cols, 3.6, 2.6, 0.7, 0.6); const f = W(3.6, 2.6); fires.push({ x: f[0], z: f[1], y: P.y + hy(3.6, 2.6), lv: 0, on: false }); light(0, 3.6, 1.2, 2.6, 0xff9a40, 0.6);
    parking(g, gl, cols, false); levels.push({ grp: finish(g, gl), cols }); }
  // --- 1: kulba ---
  { const [g, gl] = mkGB(711), cols = [];
    const base = pad(g, gl, 0, -3.2, 0, 3.3, 2.8, 0.35, (q, ql, gnd) => {
      q.color(PAL.wood).box(0, 1.45, 0, 6, 2.9, 5); q.color(PAL.woodD); for (let i = 0; i < 9; i++) { q.box(0, 0.2 + i * 0.33, 2.52, 6.06, 0.05, 0.04); q.box(0, 0.2 + i * 0.33, -2.52, 6.06, 0.05, 0.04); }
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) q.box(sx * 3.0, 1.45, sz * 2.5, 0.26, 2.95, 0.26);
      gableRoof(q, 6, 5, 1.8, 2.9, { wall: PAL.wood, roof: PAL.woodD, rib: 0x4e3422, fascia: 0x5a3c26, ovF: 0.6, ovB: 0.5, ovx: 0.45, t: 0.16 });
      q.color(PAL.door[2]).box(0, 1.05, 2.54, 1.0, 2.1, 0.1); q.color(0x6a4428).box(0, 1.05, 2.6, 0.8, 1.8, 0.02); q.color(0xd8b860).box(0.35, 1.0, 2.62, 0.05, 0.12, 0.05);
      for (const sx of [-1, 1]) { q.color(PAL.woodD).box(sx * 1.9, 1.6, 2.53, 1.15, 1.2, 0.08); ql.mask(sx < 0 ? 1.31 : 1.77).color(PAL.win).box(sx * 1.9, 1.6, 2.56, 0.9, 0.95, 0.06); ql.mask(0); q.color(PAL.woodD).box(sx * 1.9, 1.6, 2.62, 0.06, 0.95, 0.03); q.color(PAL.woodL).box(sx * 1.9, 0.95, 2.66, 1.3, 0.08, 0.24); q.color(0xb84a34).box(sx * 1.9, 1.04, 2.68, 1.1, 0.12, 0.2); }
      // ayvoncha: taxta pol (yerga ustunchalarda), ikki ustun, soyabon
      const g1 = gnd(0, 3.6); q.color(PAL.woodD); for (const sx of [-2, 2]) for (const sz of [2.8, 4.4]) { const gy = gnd(sx, sz); q.box(sx, (gy + 0.08) / 2 - 0.1, sz, 0.14, 0.18 - gy, 0.14); }
      q.color(PAL.woodL).box(0, 0.02, 3.6, 4.4, 0.12, 2.0); q.color(PAL.woodD); for (let i = 0; i < 7; i++) q.box(-2.1 + i * 0.7, 0.085, 3.6, 0.02, 0.01, 2.0);
      if (g1 < -0.3) { q.color(PAL.woodL); const n = Math.round(-g1 / 0.2); for (let i = 1; i <= n; i++) q.box(0, -i * (-g1 / (n + 1)), 4.6 + i * 0.3, 1.4, 0.08, 0.3); }
      q.color(PAL.woodD); q.box(-2.0, 1.2, 4.4, 0.16, 2.4, 0.16); q.box(2.0, 1.2, 4.4, 0.16, 2.4, 0.16); slab(q, 0, 2.5, 4.8, 2.62, 2.25, 4.9, 0.1, PAL.woodD, 0x4e3422);
      q.color(PAL.stoneD).box(1.9, 4.1, -1.2, 0.8, 2.6, 0.8); q.color(0x5a5650).box(1.9, 5.45, -1.2, 0.95, 0.12, 0.95);
    });
    { const c = W(1.9, -4.4); BK.CHIMNEYS.push({ x: c[0], y: P.y + base + 5.6, z: c[1], ph: 31, lv: 1 }); }
    box(cols, 0, -3.2, 3.1, 2.6, 6); on(g, -5.6, -3, 0, (q) => BK.logPile(q, 0, 0, 0, 3)); circ(cols, -5.6, -3, 1.2, 1.4); on(g, 4.6, 2.2, -1.2, (q) => BK.bench(q, 0, 0, 0)); dogHouse(g, gl); circ(cols, 8.8, 0.6, 0.8, 1.2);
    tiles(g, -0.7, 2.2, 0.7, FZ + 0.4, 0.7, [0xa8916e, 0x9e8866, 0xb09a78], 0x8a7a5e, 0.1);
    light(1, 0, base - hy(0, 0.2) + 2.3, 1.4, 0xffb070, 0.2);
    parking(g, gl, cols, false); levels.push({ grp: finish(g, gl), cols }); }
  // --- 2..4: uylar ---
  const ST = {
    wood: { wood: true, h: 1.25, picket: 0xc89a66, roof: PAL.roof[0], rib: 0x8e3a28, leaf: 0x9a6a42, leafD: 0x6e4a30, tile: [0xb5674a, 0xa85e44, 0xbe7052], grout: 0x9a8a72 },
    stone: { h: 1.75, plinth: 0xa59e90, wall: 0xeadcc2, cap: 0xc9b9a0, roof: 0x8e3b2e, rib: 0x6e2a22, leaf: 0x2f6f6a, leafD: 0x24524f, tile: [0xa8a49c, 0x9d9990, 0xb2aea4], grout: 0x7e7a72 },
    villa: { h: 1.85, plinth: 0x9a9488, wall: 0xf6f2ea, cap: 0xdcd6ca, roof: 0x3a6ea8, rib: 0x2c5684, leaf: 0x3a3f48, leafD: 0xc9a24a, tile: [0xe2d8c4, 0xd8ccb6, 0xeae2d0], grout: 0xb8ae9a },
  };
  const mkHouse = (lv, seed, o, hz, st) => {
    const [g, gl] = mkGB(seed), cols = []; let r; const c0 = BK.CHIMNEYS.length, l0 = BK.LAMPS.length;
    const base = pad(g, gl, 0, hz, 0, o.w / 2 + 0.16, o.d / 2 + 0.16, 0.5, (q, ql, gnd) => { r = house(q, ql, o, gnd); });
    box(cols, 0, hz, r.hx, r.hz, r.top + 3); for (const [x, z] of r.posts) circ(cols, x, hz + z, 0.24, 3);
    const front = hz + r.front + 0.35;
    tiles(g, -o.w / 2 - 0.3, hz + o.d / 2 + 0.3, o.w / 2 + 0.3, front, 0.8, st.tile, st.grout); // ayvon/balkon osti — plitka
    yard(g, gl, cols, st, lv, front); dogHouse(g, gl); circ(cols, 8.8, 0.6, 0.8, 1.2); parking(g, gl, cols, lv >= 3, lv);
    light(lv, 0, base - hy(0, front - 0.6) + 2.5, front - 0.6, 0xffb070, 0.22);
    return { g, gl, cols, c0, l0, base };
  };
  // An'anaviy uslub (uslub.js, sty=1): paxsa devor, firuza eshik-deraza, o'ymakor ustunli ayvon, tekis loy tom, paxsa hovli devori — xuddi shu joylashuv
  const TRAD = { roof: 'flat', chimney: false, carved: true, wall: 0xdcc39a, band: 0xc9ab80, roofC: 0xb89468, rib: 0x8a6a44, trim: 0x1f9a96, shutter: 0x1f9a96, door: 0x1c8c8a, doorD: 0x14706e, sill: 0xc4a77c, fascia: 0x6e4a30, post: 0x8a5a36, postD: 0x5e3a22, slabC: 0xc9ab80, rail: 0x7a4e2e };
  ST.trad = { h: 2.3, plinth: 0xb8996c, wall: 0xd7b98c, cap: 0xc2a072, roof: 0xb08a5e, rib: 0x8a6a44, leaf: 0x1f9a96, leafD: 0x14706e, tile: [0xc9a878, 0xbf9e6e, 0xd2b282], grout: 0x9a8058 };
  const mkLevels = (sty) => { const out = [], sd = sty ? 100 : 0, S = (o) => (sty ? Object.assign({}, o, TRAD, { villa: false, balRoof: o.balRoof }) : o), lt0 = lights.length;
  { const h = mkHouse(2, 721 + sd, S({ w: 9, d: 7, fl: 1, fh: 3.1, roof: 'gable', chimney: true, ayvon: 2.4, wall: 0xeedfc4, roofC: PAL.roof[0], rib: 0x8e3a28, trim: 0x3d74a6, shutter: 0x3d74a6, door: 0x8a5a36, doorD: 0x6a4228, sill: 0xb9b2a4, band: 0xe2d2b4, fascia: 0x6e4a30, post: 0x8a5a36, postD: 0x6e4a30 }), -5.2, sty ? ST.trad : ST.wood); tagLv(h.c0, h.l0, 2, sty); out.push({ grp: finish(h.g, h.gl), cols: h.cols }); }
  { const h = mkHouse(3, 731 + sd, S({ w: 10.5, d: 8, fl: 2, fh: 3.0, roof: 'gable', balcony: 2.0, balRoof: true, chimney: true, wall: 0xf3e7d0, roofC: 0x8e3b2e, rib: 0x6e2a22, trim: 0x7a4e2e, door: 0x7a4a2a, doorD: 0x5a3420, sill: 0xb9b2a4, band: 0xe6d6ba, fascia: 0x5a3a24, post: 0x7a4e2e, postD: 0x5a3a24, slabC: 0xd8cfc0, rail: 0x6e4a30 }), -6.4, sty ? ST.trad : ST.stone);
    for (const [x, z] of [[-3.4, 13.4], [3.4, 13.4]]) { on(h.g, x, z, 0, (q) => BK.lampPost(q, h.gl, 0, 0)); circ(h.cols, x, z, 0.15, 4); light(3, x + 0.7, 3.8, z, 0xffb070, 0.28, null, sty); }
    tagLv(h.c0, h.l0, 3, sty); out.push({ grp: finish(h.g, h.gl), cols: h.cols }); }
  { const h = mkHouse(4, 741 + sd, S({ w: 14, d: 9, fl: 2, fh: 3.2, roof: 'hip', balcony: 2.2, villa: true, chimney: true, wall: 0xfaf6ee, roofC: 0x3a6ea8, trim: 0xe4ded2, door: 0x8a5a36, doorD: 0x6a4228, sill: 0xd8d2c6, band: 0xece6da, fascia: 0xece6da, post: 0xf4f0e8, postD: 0xdcd6ca, slabC: 0xe8e2d6, rail: 0xf2eee6 }), -7, sty ? ST.trad : ST.villa), g = h.g, gl = h.gl;
    pad(g, gl, -12, -9.6, Math.PI / 2, 3.2, 3.5, 0.5, (q, ql, gnd) => house(q, ql, S({ w: 6, d: 6.6, fl: 1, fh: 3.2, roof: 'hip', villa: true, wall: 0xfaf6ee, roofC: 0x3a6ea8, trim: 0xe4ded2, door: 0x8a5a36, doorD: 0x6a4228, sill: 0xd8d2c6, band: 0xece6da, fascia: 0xece6da }), gnd)); box(h.cols, -12, -9.6, 3.6, 3.3, 7);
    // hovuz: tosh supa (yer ostiga kiradi), suv, narvon, shezlong
    let pb; { const [lo, hi] = span(12.3, -4.4, 3.4, 3.9); pb = hi + 0.6; g.push().translate(12.3, pb, -4.4); const dy = (lo - 0.5 - pb) / 2, dh = pb - lo + 0.5; g.color(PAL.stone); for (const sz of [-1, 1]) g.box(0, dy, sz * 3.65, 7.2, dh, 0.9); for (const sx of [-1, 1]) g.box(sx * 3.15, dy, 0, 0.9, dh, 6.4); g.color(0x5fb8d8).box(0, hi - pb + 0.03, 0, 5.4, 0.04, 6.4); /* hovuz tubi: yer ustida (yer qazilmaydi) */ g.color(0xe6e0d4); for (const sz of [-1, 1]) g.box(0, 0.06, sz * 3.45, 6.6, 0.12, 0.5); for (const sx of [-1, 1]) g.box(sx * 2.95, 0.06, 0, 0.5, 0.12, 7.4); g.color(0xdfe3ea); for (const sx of [-0.3, 0.3]) g.push().translate(-2.9 + sx * 0, 0, 3.0 + sx).cyl(6, 0.04, 0.04, -0.2, 0.9).pop(); g.pop(); }
    box(h.cols, 12.3, -4.4, 3.4, 3.9, 0.9);
    on(g, 8.2, -6, 0, (q) => { q.color(0xf2ead8).box(0, 0.32, 0, 0.7, 0.1, 1.9); q.box(0, 0.6, -0.8, 0.7, 0.5, 0.1, { oz: 0.25 }); q.color(PAL.metalD); for (const sx of [-1, 1]) for (const sz of [-1, 1]) q.box(sx * 0.3, 0.14, sz * 0.8, 0.05, 0.28, 0.05); q.color(0xe2572f).box(0, 0.4, 0.2, 0.62, 0.06, 1.1); });
    for (const [x, z] of [[-3.4, 13.4], [3.4, 13.4], [-3.4, 6], [3.4, 6]]) { on(g, x, z, 0, (q) => BK.lampPost(q, gl, 0, 0)); circ(h.cols, x, z, 0.15, 4); light(4, x + 0.7, 3.8, z, 0xffb070, 0.28, null, sty); }
    for (const [x, z] of [[15.2, -12.6], [-15.5, 12.8], [15.6, 2.5]]) on(g, x, z, 0, (q) => BK.tree(q, 0, 0, 0.9, 0x2f7a52, 1));
    tagLv(h.c0, h.l0, 4, sty); const grp4 = finish(g, gl); out.push({ grp: grp4, cols: h.cols });
    // hovuz suvi: to'lqinlanadigan yuza (osmon aksi bilan)
    { const ws = waterSurface(5.4, 6.4), q = W(12.3, -4.4); ws.position.set(q[0], P.y + pb - 0.08, q[1]); ws.rotation.y = yaw; grp4.add(ws); } }
    for (let i = lt0; i < lights.length; i++) if (lights[i].sty == null) lights[i].sty = sty; // uslub bo'yicha yoqiladi
    return out; };
  for (const L of mkLevels(0)) levels.push(L);
  const alt = []; // an'anaviy uslubdagi 2..4-darajalar — birinchi tanlanganda quriladi (yuklash vaqtiga ta'sir qilmaydi)
  const altLevels = () => { if (!alt.length) { const L = mkLevels(1); alt[2] = L[0]; alt[3] = L[1]; alt[4] = L[2]; } return alt; };
  // --- bezaklar ---
  const decor = {};
  const mkDecor = (id, seed, fn) => { const [g, gl] = mkGB(seed), cols = [], l0 = BK.LAMPS.length; fn(g, gl, cols); tagLv(BK.CHIMNEYS.length, l0, 'd'); decor[id] = { grp: finish(g, gl), cols }; };
  const waterFx = [];
  // gul: poya, barglar, gultoj (5 gulbarg)
  const flower = (g, x, y, z, col, s, k) => { g.push().translate(x, y, z).rotY(k * 2.1).scale(s); g.color(0x3f8a3a).box(0, 0.22, 0, 0.03, 0.44, 0.03); g.box(0.07, 0.16, 0, 0.14, 0.02, 0.06); g.box(-0.06, 0.26, 0, 0.12, 0.02, 0.05); g.color(col); for (let i = 0; i < 5; i++) { const a = i * 1.2566; g.box(Math.sin(a) * 0.06, 0.45, Math.cos(a) * 0.06, 0.07, 0.025, 0.07); } g.color(0xf2c63a).box(0, 0.465, 0, 0.04, 0.03, 0.04); g.pop(); };
  mkDecor('gulzor', 751, (g) => {
    const cl = [0xff6a8a, 0xffd23a, 0xf2f2ee, 0xb07cff, 0xff8a3a, 0xe8384a]; let k = 0;
    // fasad bo'ylab va yo'lak yonida g'isht hoshiyali gul pushtalari (yerga moslab)
    const strip = (x1, z1, x2, z2, wd) => { along(g, x1, z1, x2, z2, (q, L) => { q.color(0xa85e44).box(-wd / 2, 0.02, L / 2, 0.1, 0.32, L); q.box(wd / 2, 0.02, L / 2, 0.1, 0.32, L); q.color(0x5a3e2a).box(0, 0.04, L / 2, wd, 0.22, L); q.color(0x4f9e48); for (let z = 0.3; z < L - 0.2; z += 0.45) q.blob(0.17, 0, { cx: (BK.hashP(z, x1, 2) - 0.5) * wd * 0.5, cy: 0.18, cz: z, sy: 0.6 }); }); const n = Math.floor(Math.hypot(x2 - x1, z2 - z1) / 0.42); for (let i = 0; i < n; i++) { const t = (i + 0.5) / n, x = x1 + (x2 - x1) * t + (BK.hashP(i, x1, 3) - 0.5) * wd * 0.5, z = z1 + (z2 - z1) * t + (BK.hashP(z1, i, 4) - 0.5) * wd * 0.4; flower(g, x, hy(x, z) + 0.12, z, cl[k++ % cl.length], 0.9 + BK.hashP(i, z1, 5) * 0.5, i); } };
    strip(-15.8, 13.7, -3.8, 13.7, 0.8); strip(3.8, 13.7, 15.8, 13.7, 0.8); strip(-1.45, 4.0, -1.45, 13.0, 0.5); strip(1.45, 4.0, 1.45, 13.0, 0.5);
  });
  mkDecor('bayroq', 761, (g, gl, cols) => { on(g, -5, 12.6, 0, (q) => { q.color(PAL.stone).box(0, 0.0, 0, 1.0, 0.7, 1.0); q.box(0, 0.42, 0, 0.7, 0.16, 0.7); q.color(PAL.metalD).cyl(6, 0.08, 0.05, 0, 8.5); q.color(0xd8d8d0).blob(0.1, 0, { cy: 8.55 }); q.color(0x2f7fd0).box(0.85, 8.0, 0, 1.7, 0.36, 0.05); q.color(0xf2f2ee).box(0.85, 7.64, 0, 1.7, 0.36, 0.05); q.color(0x3f9a58).box(0.85, 7.28, 0, 1.7, 0.36, 0.05); }); circ(cols, -5, 12.6, 0.45, 8); });
  // arg'imchoq: ikki yonda A-ramka, tepada to'sin, arqonlar va o'rindiq
  mkDecor('argimchoq', 771, (g, gl, cols) => {
    const x0 = -13.4, z0 = -3, [, hi] = span(x0, z0, 1.9, 0.9), top = hi + 2.6;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const fx = x0 + sx * 1.6, fz = z0 + sz * 0.85, fy = hy(fx, fz) - 0.15, L = Math.hypot(0.85, top - fy), a = Math.atan2(0.85, top - fy); g.push().translate(fx, fy, fz).rotX(-sz * a); g.color(PAL.woodD).box(0, L / 2, 0, 0.14, L, 0.14); g.pop(); }
    g.push().translate(x0, top, z0); g.color(PAL.woodD).box(0, 0.05, 0, 3.6, 0.16, 0.16); for (const sx of [-1, 1]) g.box(sx * 1.6, -0.55, 0, 0.1, 0.08, 1.0);
    g.color(0xd9c9a0); for (const sx of [-0.42, 0.42]) for (const sz of [-0.12, 0.12]) g.box(sx, -0.95, sz, 0.03, 1.9, 0.03); g.color(PAL.wood).box(0, -1.9, 0, 1.0, 0.07, 0.38); g.pop();
    circ(cols, x0 - 1.6, z0, 0.35, 2.8); circ(cols, x0 + 1.6, z0, 0.35, 2.8);
  });
  // yo'lak chiroqchalari: past ustunchalar, iliq kuchsiz yorug'lik
  mkDecor('chiroq', 781, (g, gl, cols) => { for (const [x, z] of [[-2.3, 4.5], [2.3, 4.5], [-2.3, 9.5], [2.3, 9.5]]) { const y = hy(x, z); g.push().translate(x, y, z); g.color(PAL.metalD).box(0, 0.0, 0, 0.26, 0.2, 0.26); g.cyl(6, 0.06, 0.05, 0, 1.0); g.box(0, 1.03, 0, 0.26, 0.06, 0.26); gl.push().translate(x, y, z); gl.color(PAL.lamp).box(0, 1.17, 0, 0.18, 0.22, 0.18); gl.pop(); g.color(PAL.metalD).box(0, 1.33, 0, 0.3, 0.06, 0.3, { tx: 0.4, tz: 0.4 }); g.pop(); circ(cols, x, z, 0.12, 1.2); } light(1, 0, 1.3, 7, 0xffb070, 0.1, 'chiroq'); });
  mkDecor('favvora', 791, (g, gl, cols) => { pad(g, gl, 6.2, 10.6, 0, 1.8, 1.8, 0.05, (q) => { q.color(PAL.stone).prism(10, 1.75, 1.7, -0.1, 0.5); q.color(0x3fa8d0).prism(10, 1.45, 1.45, 0.3, 0.44); q.color(PAL.stoneD).cyl(8, 0.26, 0.2, 0.4, 1.5); q.color(PAL.stone).prism(8, 0.75, 0.6, 1.5, 1.66); q.color(0x3fa8d0).prism(8, 0.62, 0.62, 1.56, 1.64); q.color(PAL.stoneD).cyl(6, 0.12, 0.08, 1.6, 2.2); }, PAL.stoneD); circ(cols, 6.2, 10.6, 1.75, 1.2); });
  // favvora: pastki va yuqori kosada to'lqinlanadigan suv, tepada purkagich (details.js zarrachalari)
  { const grp = decor.favvora.grp, q = W(6.2, 10.6), fb = span(6.2, 10.6, 1.8, 1.8)[1] + 0.05; for (const [r, y] of [[1.45, 0.45], [0.62, 1.65]]) { const ws = waterSurface(r, 0, true); ws.position.set(q[0], P.y + fb + y, q[1]); grp.add(ws); } waterFx.push({ grp, x: q[0], y: P.y + fb + 2.25, z: q[1] }); }
  // --- yo'lak (darvozadan yo'lgacha) ---
  { const g = new GB(799); g.jit = 0.02; g.color(0xb7a58a); const n = 12; let prev = null; const d = nr.edge >= 0 ? nr.d - nr.hw : 30;
    for (let i = 0; i <= n; i++) { const lz = FZ + 0.3 + (d - FZ + 1.5) * i / n, a = W(-2.2, lz), b = W(2.2, lz); const row = [[a[0], T.gridHeight(a[0], a[1]) + 0.07, a[1]], [b[0], T.gridHeight(b[0], b[1]) + 0.07, b[1]]]; if (prev) g.quad(prev[0], row[0], row[1], prev[1]); prev = row; }
    const m = new THREE.Mesh(g.build(), MAT.flat); m.receiveShadow = true; scene.add(m); }
  const api = {
    x: P.x, z: P.z, y: P.y, yaw, W, lvl: -1, levels, alt, decor, waterFx,
    door: W(0, 2.6), beds: BEDS.map(([x, z]) => W(x, z)), bedY, coop: W(13, -10.4), mail: W(3.5, FZ + 2.4), park: W(9.5, 21.5), parkYaw: yaw + Math.PI / 2, dog: W(8.8, 2.2), gate: W(0, FZ + 3),
    style: 0, // 0 — zamonaviy, 1 — an'anaviy hovli (2..4-darajada ko'rinadi; uslub.js)
    trad: () => api.style === 1 && api.lvl >= 2,
    setStyle(v) { api.style = v === 1 ? 1 : 0; if (api.lvl >= 0) api.setLevel(api.lvl); },
    setLevel(n) { api.lvl = n; const tr = api.style === 1 && n >= 2; if (tr) altLevels();
      levels.forEach((L, i) => { const on = i === n && !tr; L.grp.visible = on; for (const o of L.cols) o.dead = !on; });
      alt.forEach((L, i) => { if (!L) return; const on = tr && i === n; L.grp.visible = on; for (const o of L.cols) o.dead = !on; });
      for (const l of lights) if (!l.decor) l.on = l.lv === n && (l.sty == null || (l.sty === 1) === tr); for (const f of fires) { const on = f.lv === n, k = site.fires.indexOf(f); if (on && k < 0) site.fires.push(f); else if (!on && k >= 0) site.fires.splice(k, 1); } },
    setDecor(id, on) { const d = decor[id]; if (!d) return; d.grp.visible = on; for (const o of d.cols) o.dead = !on; for (const l of lights) if (l.decor === id) l.on = on; },
  };
  return api;
}
