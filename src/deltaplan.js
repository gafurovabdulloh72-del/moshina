// Deltaplan: modeli (GB) va yumshoq parvoz fizikasi — tezlik ↔ balandlik almashinuvi, sekin cho'kish, qiyalik va issiq havo oqimi, qo'nish
import * as THREE from 'three';
import * as T from './terrain.js';
import { GB, MAT } from './geo.js';
import { PAL } from './blocks.js';
import { clamp, noise } from './util.js';

export const V_TRIM = 10.5, V_STALL = 7; // muvozanat va qulash tezligi (m/s)
// Cho'kish tezligi (m/s): 10 m/s atrofida eng kam (~7:1 sirpanish), tezlashsa yoki sekinlashsa ko'payadi
export const sinkAt = (v) => 1.5 + 0.035 * (v - 10) * (v - 10);
// Havo oqimi (m/s, yuqoriga): shamol qiyalikka urilib ko'tariladi; cho'l, dara va Olovtog' ustida issiq havo
export function airLift(x, z, y, wind) {
  const gh = T.gridHeight(x, z), agl = y - gh; if (agl < 3) return 0;
  const e = 14, gx = (T.gridHeight(x + e, z) - T.gridHeight(x - e, z)) / (2 * e), gz = (T.gridHeight(x, z + e) - T.gridHeight(x, z - e)) / (2 * e);
  const ridge = Math.min(1.3, Math.max(0, gx * wind.x + gz * wind.z) * 0.8) * clamp((200 - agl) / 140, 0, 1);
  const b = T.biomeAt(x, z); let th = 0;
  if (b === T.BIOME.DESERT || b === T.BIOME.CANYON || b === T.BIOME.VOLCANIC) th = Math.max(0, noise(x * 0.005, z * 0.005) - 0.15) * 3.2 * clamp(agl / 40, 0, 1) * clamp((700 - agl) / 300, 0, 1);
  return Math.min(2.2, ridge + th);
}
// Bir qadam: gl {x, y, z, yaw, v, bank}; f: W (+1) — tumshuqni pasaytirish (tezlashish), S (-1) — ko'tarish; s — burilish (+ chapga)
export function glideStep(gl, dt, f, s, wind) {
  const vt = V_TRIM + 5.5 * Math.max(0, f) - 3.6 * Math.max(0, -f);
  const v0 = gl.v; let dv = clamp(vt - gl.v, -1.4, 1.8) * dt; if (gl.v < V_STALL) dv += (V_STALL + 0.6 - gl.v) * 1.6 * dt; // qulash: tumshuq o'zi tushadi
  gl.v = clamp(gl.v + dv, 5, 23);
  const climb = -((gl.v * gl.v - v0 * v0) / 2) / 9.81; // tezlik balandlikdan olinadi (yoki tezlik pasayib, biroz ko'tariladi)
  gl.bank += (s * 0.62 - gl.bank) * Math.min(1, dt * 2.2);
  gl.yaw += (9.81 * Math.tan(gl.bank) / Math.max(gl.v, 6)) * dt;
  let sink = sinkAt(gl.v) / Math.cos(gl.bank); if (gl.v < V_STALL) sink += (V_STALL - gl.v) * 1.8;
  gl.lift = airLift(gl.x, gl.z, gl.y, wind); gl.vy = gl.lift - sink + climb / Math.max(dt, 1e-4);
  gl.y += climb + (gl.lift - sink) * dt;
  gl.x += Math.sin(gl.yaw) * gl.v * dt; gl.z += Math.cos(gl.yaw) * gl.v * dt;
}
// Model: ildiz — uchuvchining sonida; qanot tepada, boshqaruv uchburchagi (A-rama) qo'llar oldida; seat — chavandoz o'rni
export function buildGlider() {
  const root = new THREE.Group(), tilt = new THREE.Group(); root.add(tilt);
  const g = new GB(831); g.jit = 0;
  const tri = (a, b, c) => { g.tri(a, b, c); g.tri(c, b, a); };
  const nose = [0, 1.62, 1.75], tail = [0, 1.5, -1.05], L = [5.1, 1.42, -0.95], R = [-5.1, 1.42, -0.95], lm = [2.5, 1.62, 0.45], rm = [-2.5, 1.62, 0.45], lt = [2.4, 1.46, -1.25], rt = [-2.4, 1.46, -1.25];
  g.color(0xff5a36); tri(nose, lm, tail); tri(nose, tail, rm);
  g.color(0xf0b83a); tri(lm, L, lt); tri(lm, lt, tail); tri(rm, rt, R); tri(rm, tail, rt);
  g.color(0x2f7fd0); tri(nose, L, lm); tri(nose, rm, R);
  g.color(0x30343c); // quvurlar: tizza (keel), oldingi qirra, A-rama, osma
  const tube = (a, b, r = 0.03) => { const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], l = Math.hypot(dx, dy, dz); g.push().translate((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2); g.rotY(Math.atan2(dx, dz)); g.rotX(-Math.atan2(dy, Math.hypot(dx, dz))); g.box(0, 0, 0, r * 2, r * 2, l); g.pop(); };
  tube([0, 1.58, 1.8], [0, 1.48, -1.1]); tube(nose, L); tube(nose, R); tube([0, 1.55, 0.25], [0.62, 0.36, 0.42]); tube([0, 1.55, 0.25], [-0.62, 0.36, 0.42]); tube([0.62, 0.36, 0.42], [-0.62, 0.36, 0.42], 0.035);
  tube([0, 1.55, 0.1], [0, 0.95, 0.0], 0.02); g.color(0x5a5f6a); tube([0, 0.95, 0.0], [0, 0.55, -0.35], 0.06); // osma kamar
  tube([0, 1.85, 0.2], [0, 1.58, 0.2], 0.025);
  const m = new THREE.Mesh(g.build(), MAT.flat); m.castShadow = true; tilt.add(m);
  const seat = new THREE.Group(); tilt.add(seat);
  return { root, tilt, seat, len: 4.2, hgt: 2.4 };
}
// Uchish maydonchasi (Cho'qqidagi qoya chetida): taxta supa va shamol bayroqchasi
export function rampGeo() {
  const g = new GB(841); g.jit = 0.03;
  g.color(PAL.woodD); for (const sx of [-1.6, 1.6]) for (const sz of [-3, 0, 3]) g.box(sx, -1.0, sz, 0.22, 2.4, 0.22);
  g.color(0xb8905e); for (let i = 0; i < 8; i++) g.box(0, 0.12 - i * 0.07, -3.4 + i * 1.0, 3.6, 0.12, 0.92);
  g.color(PAL.metalD).box(2.2, 1.6, -3.2, 0.06, 3.4, 0.06); g.color(0xff8a3a); g.push().translate(2.2, 3.0, -3.2); g.box(0, 0, 0.35, 0.03, 0.3, 0.7); g.pop();
  return g.build();
}
