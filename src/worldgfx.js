// Dunyoning ko'rinadigan qismi: silliq relyef (LOD bilan, har piksel yer turi sheyderi), yo'llar (eskirgan asfalt, ikki izli dala yo'li), ko'priklar, suv
import * as THREE from 'three';
import * as T from './terrain.js';
import { GB, WIND } from './geo.js';
import { TEX } from './tex.js';
import { hexLin, mixRGB, lerp, clamp, smoothstep, noise } from './util.js';
import * as COL from './colliders.js';

const { N, NV, CELL, HALF } = T;
const CH = 50, STEPS = [1, 2, 5];

// --- Yer/yo'l/ko'prik materiallari uchun umumiy uniformlar (uYT — vaqt, uYQ — sifat 0/1/2) ---
export const YER = { U: { tYN: { value: null }, tYM: { value: null }, uYT: WIND, uYQ: { value: 2 } }, terrain: null, road: null, wood: null, envK: 0.3 };

// Har piksel yer turi: biom og'irliklari (aB0/aB1), suv sathi, yo'lgacha masofa, lavanda, egrilik (aAx) + qiyalik va balandlik
const GLSL = `
uniform sampler2D tYN; uniform sampler2D tYM; uniform float uYT; uniform float uYQ;
varying vec3 vWP; varying vec3 vWN;
vec3 yA; float yR; float yH; float ySpec; vec2 yNf; float ySp; float yAO; float yS; float yWet; float yNear; float yDry;
vec2 yDx; vec2 yDy; vec3 yPx; vec3 yPy;
const mat2 YR0 = mat2(1.0, 0.0, 0.0, 1.0), YR1 = mat2(0.8, -0.6, 0.6, 0.8), YR2 = mat2(-0.67, 0.74, -0.74, -0.67), YR3 = mat2(0.77, 0.64, -0.64, 0.77), YR4 = mat2(0.28, -0.96, 0.96, 0.28);
vec4 yTex(sampler2D t, vec2 p, float s, mat2 r, vec2 o){ return textureGrad(t, r * p * s + o, r * yDx * s, r * yDy * s); }
float yHash(vec2 p){ vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
// ingichka chiziq (antialias): c — markaz, w — kenglik
float yLine(float x, float c, float w){ float f = max(fwidth(x), 1e-4); return clamp((w * 0.5 - abs(x - c)) / f + 0.5, 0.0, 1.0) * min(1.0, w / f); }
// bulut soyasi (to'g'ri quyosh nurini to'sadi) — keyin umumiy safarCloudShadow() bilan almashtiriladi
float yerCloudShadow(vec3 wp){
  vec2 q = (wp.xz + vec2(uYT * 6.0, uYT * 2.2)) * 0.00034;
  float c = textureLod(tYN, q, 4.5).r * 0.7 + textureLod(tYN, q * 2.7 + 0.31, 3.5).r * 0.3;   // xira (mip) — yumshoq chetli katta dog'lar
  return 1.0 - 0.42 * smoothstep(0.6, 0.72, c);
}
// sirt balandligi hosilasidan normal (ekran hosilalari, qo'shimcha tekstura so'ramaydi)
vec3 yerBump(vec3 n, float H){
  float hx = dFdx(H), hy = dFdy(H);
  vec3 r1 = cross(yPy, n), r2 = cross(n, yPx); float det = dot(yPx, r1);
  vec3 g = sign(det) * (hx * r1 + hy * r2);
  return normalize(abs(det) * n - g);
}
void yerBegin(vec3 wp){ yDx = dFdx(wp.xz); yDy = dFdy(wp.xz); yPx = dFdx(wp); yPy = dFdy(wp); }
void yerGround(vec3 wp, vec3 nW, float dist, vec4 b0, vec4 b1, vec4 ax){
  vec2 p = wp.xz;
  float ws = dot(b0, vec4(1.0)) + dot(b1, vec4(1.0)); b0 /= max(ws, 0.01); b1 /= max(ws, 0.01);
  float slope = length(nW.xz) / max(nW.y, 0.05);
  float nearK = (1.0 - smoothstep(12.0, 55.0, dist)) * step(0.5, uYQ); yNear = nearK;
  float midK = 1.0 - smoothstep(80.0, 420.0, dist);
  vec4 M = yTex(tYN, p, 0.0015625, YR0, vec2(0.31, 0.77));
  vec4 M2 = yTex(tYN, p, 0.00058, YR1, vec2(0.11, 0.53));
  vec4 D = yTex(tYN, p, 0.077, YR2, vec2(0.5));
  vec4 F = vec4(0.58, 0.41, 0.44, 0.5), Nf = vec4(0.5), S = vec4(0.58, 0.41, 0.44, 0.5);
  if (nearK > 0.001) {
    F = yTex(tYN, p, 0.37, YR3, vec2(0.21, 0.4)); Nf = yTex(tYM, p, 0.29, YR0, vec2(0.13));
    vec2 sc = vec2(3.1, 0.8); vec4 S1 = textureGrad(tYN, (YR3 * p) * sc, (YR3 * yDx) * sc, (YR3 * yDy) * sc), S2 = textureGrad(tYN, (YR1 * p) * sc + 0.5, (YR1 * yDx) * sc, (YR1 * yDy) * sc);
    S = max(S1, S2);
  }
  float m = clamp((M.r - 0.58) * 2.6 + 0.5, 0.0, 1.0), m2 = clamp((M2.r - 0.58) * 2.6 + 0.5, 0.0, 1.0);
  float dN = clamp((D.r - 0.58) * 2.6, -1.0, 1.0), fN = clamp((F.r - 0.58) * 2.6, -1.0, 1.0);
  float curv = ax.w - 0.5;
  float wl = ax.x * 100.0 - 10.0, aw = wp.y - wl;            // suv sathidan balandlik (m)
  float rdE = ax.y * 40.0;                                    // yo'l chetigacha (m)
  float dry = clamp(smoothstep(0.2, 0.85, m * 0.55 + m2 * 0.45) - curv * 1.4 + slope * 0.3 + (D.g - 0.41) * 0.5, 0.0, 1.0); yDry = dry;
  float blade = clamp((S.r * 0.6 + S.a * 0.4 - 0.6) * 2.2 + 0.5, 0.0, 1.0);                      // o't tolalari (yaqinda)
  vec3 A = vec3(0.0); float H = 0.0, rough = 0.0;
  // o'tloq / sakura: yam-yashil va qurigan dog'lar, beda, tuproq
  float wg = b0.x + b1.y;
  if (wg > 0.003) {
    vec3 c = mix(vec3(0.095, 0.18, 0.036), vec3(0.17, 0.23, 0.055), m2);
    c = mix(c, vec3(0.22, 0.215, 0.075), dry * dry * 0.55);
    float clump = smoothstep(0.32, 0.08, D.b); c = mix(c, c * vec3(0.72, 0.86, 0.66), clump * 0.55);
    float dirt = smoothstep(0.1, 0.02, D.b) * smoothstep(0.5, 0.72, D.g); c = mix(c, vec3(0.2, 0.135, 0.075), dirt * 0.75);
    c *= 0.84 + 0.32 * D.r;
    c = mix(c, mix(c * 0.7, mix(c * 1.25, vec3(0.3, 0.3, 0.12), 0.2), smoothstep(0.38, 0.72, blade)), nearK * 0.7);
    // lavanda qatorlari
    float lv = ax.z;
    if (lv > 0.01) { float rc = dot(p, vec2(0.6, 0.8)) / 1.7; float st = smoothstep(0.32, 0.12, abs(fract(rc) - 0.5)); st = mix(st, 0.45, smoothstep(0.15, 0.5, fwidth(rc)));
      vec3 lc = mix(vec3(0.17, 0.12, 0.07), vec3(0.27, 0.17, 0.42) * (0.8 + 0.4 * F.r), st); c = mix(c, lc, smoothstep(0.1, 0.5, lv)); }
    // sakura gul barglari
    float pt = b1.y / max(wg, 0.01); c = mix(c, vec3(0.78, 0.5, 0.56), pt * smoothstep(0.1, 0.02, F.b) * smoothstep(0.45, 0.7, D.r) * nearK * 0.8);
    A += c * wg; H += ((blade - 0.5) * 0.03 * nearK + clump * 0.02) * wg; rough += 0.95 * wg;
  }
  // kuzgi o'rmon: xazon (to'q sariq, qizg'ish, sariq) va o't orollari
  if (b0.y > 0.003) {
    float lf = clamp(D.r * 1.3 - 0.25 + fN * 0.35 * nearK, 0.0, 1.0);
    vec3 c = mix(mix(vec3(0.17, 0.09, 0.04), vec3(0.36, 0.17, 0.055), lf), vec3(0.38, 0.27, 0.08), smoothstep(0.6, 0.85, D.a + fN * 0.25) * 0.7);
    c = mix(c, vec3(0.13, 0.15, 0.05), smoothstep(0.45, 0.75, m2 + (D.g - 0.4) * 0.8) * 0.75);
    c *= 0.82 + 0.36 * F.a;
    A += c * b0.y; H += (F.b * 0.03 * nearK + D.r * 0.03) * b0.y; rough += 0.9 * b0.y;
  }
  // tayga: mox, igna to'shamasi, och liken
  if (b0.z > 0.003) {
    vec3 c = mix(vec3(0.07, 0.115, 0.035), vec3(0.16, 0.105, 0.055), smoothstep(0.35, 0.7, D.r + curv * -0.8));
    c = mix(c, vec3(0.32, 0.33, 0.24), smoothstep(0.14, 0.04, D.b) * 0.45);
    c *= 0.85 + 0.3 * F.r;
    A += c * b0.z; H += (smoothstep(0.4, 0.1, F.b) * 0.03 * nearK + D.b * 0.03) * b0.z; rough += 0.95 * b0.z;
  }
  // cho'l qumi: shamol to'lqinchalari va katta qum yollari
  float wsd = b0.w;
  if (wsd > 0.003) {
    vec3 c = mix(vec3(0.45, 0.31, 0.16), vec3(0.6, 0.45, 0.25), m * 0.6 + D.r * 0.4);
    vec2 wd = vec2(0.86, 0.5); float rc = dot(p, wd) / 0.34 + D.r * 5.0 + M.r * 30.0;
    float rp = sin(rc * 6.2832) * (1.0 - smoothstep(0.2, 0.6, fwidth(rc)));
    float dn = sin(dot(p, wd) / 9.0 + M.g * 18.0);
    c *= 0.95 + 0.07 * rp * (1.0 - nearK * 0.5);
    A += c * wsd; H += (rp * 0.012 + dn * 0.15 * midK) * wsd; rough += 0.88 * wsd;
  }
  // kanyon: qizil tuproq
  if (b1.x > 0.003) {
    vec3 c = mix(vec3(0.36, 0.15, 0.07), vec3(0.5, 0.27, 0.13), D.r * 0.7 + m * 0.3);
    c = mix(c, vec3(0.3, 0.27, 0.12), smoothstep(0.62, 0.8, m2) * 0.4);
    A += c * b1.x; H += D.g * 0.04 * b1.x; rough += 0.9 * b1.x;
  }
  // savanna: somon rangli quruq o't
  if (b1.z > 0.003) {
    vec3 c = mix(vec3(0.34, 0.26, 0.105), vec3(0.47, 0.37, 0.15), m * 0.5 + D.r * 0.5);
    c = mix(c, vec3(0.2, 0.19, 0.075), smoothstep(0.3, 0.08, D.b) * 0.5);
    c = mix(c, vec3(0.4, 0.27, 0.15), smoothstep(0.1, 0.03, D.b) * 0.6);
    c = mix(c, mix(c * 0.7, c * 1.3, smoothstep(0.35, 0.75, blade)), nearK * 0.8);
    A += c * b1.z; H += (blade - 0.5) * 0.03 * nearK * b1.z; rough += 0.95 * b1.z;
  }
  // vulqon: kul, bazalt, zang
  if (b1.w > 0.003) {
    vec3 c = mix(vec3(0.13, 0.12, 0.115), vec3(0.035, 0.033, 0.036), smoothstep(0.42, 0.7, D.r + (M.g - 0.4)));
    c = mix(c, vec3(0.17, 0.085, 0.05), smoothstep(0.75, 0.9, D.g) * 0.5);
    A += c * b1.w; H += (smoothstep(0.5, 0.2, F.b) * 0.03 * nearK + D.g * 0.05) * b1.w; rough += 0.82 * b1.w;
  }
  // yo'l yoqasi: shag'al va oyoq ostida qolgan o't
  float rs = smoothstep(2.6, 0.2, rdE + dN * 1.1) * (1.0 - b1.w);
  if (rs > 0.001) { vec3 gc = mix(vec3(0.27, 0.24, 0.19), A * 1.15 + 0.03, 0.35) * (0.75 + 0.5 * F.b); A = mix(A, gc, rs * 0.85); H += rs * smoothstep(0.5, 0.15, F.b) * 0.03 * nearK; rough = mix(rough, 0.95, rs); }
  A = mix(A, A * vec3(1.12, 1.05, 0.9), smoothstep(6.0, 1.5, rdE) * 0.35);
  // qoya (tik qiyalik): ikki proyeksiya, qatlamlar, yoriqlar, liken
  float redness = clamp(b0.w * 0.6 + b1.x, 0.0, 1.0);
  float rk = smoothstep(0.6, 1.0, slope + dN * 0.25 + (M.g - 0.41) * 0.35);
  if (rk > 0.002) {
    vec3 an = abs(nW); float wx = an.x / (an.x + an.z + 1e-4);
    vec4 Rx = textureGrad(tYN, wp.zy * 0.11, yPx.zy * 0.11, yPy.zy * 0.11), Rz = textureGrad(tYN, wp.xy * 0.11 + 0.37, yPx.xy * 0.11, yPy.xy * 0.11);
    vec4 R = mix(Rz, Rx, wx);
    float sb = wp.y * 0.36 + R.r * 1.6 + M.r * 5.0; float band = sin(sb * 6.2832) * 0.5 + 0.5; band = mix(band, 0.5, smoothstep(0.15, 0.5, fwidth(sb)));
    vec3 grey = mix(vec3(0.17, 0.165, 0.155), vec3(0.36, 0.345, 0.31), clamp((R.r - 0.58) * 2.2 + 0.5, 0.0, 1.0) * 0.75 + band * 0.25);
    grey = mix(grey, vec3(0.3, 0.31, 0.17), smoothstep(0.18, 0.04, R.b) * 0.5 * (1.0 - redness));
    vec3 red = mix(mix(vec3(0.36, 0.14, 0.07), vec3(0.52, 0.27, 0.13), band), vec3(0.6, 0.42, 0.26), smoothstep(0.78, 0.95, band) * 0.6) * (0.8 + 0.4 * R.r);
    vec3 rc = mix(grey, red, redness); rc = mix(rc, vec3(0.04, 0.037, 0.042) * (0.8 + 0.5 * R.r), b1.w);
    rc *= (1.0 - 0.55 * smoothstep(0.8, 0.95, R.g)) * (0.85 + 0.3 * smoothstep(0.3, 0.7, R.a));
    A = mix(A, rc, rk); H = mix(H, R.g * 0.35 + band * 0.08, rk); rough = mix(rough, 0.82, rk);
  }
  // qirg'oq: dengizda qum, ko'l/daryoda shag'al va loy; nam chiziq
  float sea = 1.0 - step(1.5, wl);
  float be = smoothstep(4.4, 1.6, wp.y + dN * 0.7) * sea * (1.0 - b1.w);
  if (be > 0.001) { vec3 sc = mix(vec3(0.5, 0.41, 0.26), vec3(0.64, 0.54, 0.35), D.r * 0.6 + m * 0.4) * (0.92 + 0.12 * F.a); A = mix(A, sc, be); float rp = sin((dot(p, vec2(0.3, 0.95)) / 0.5 + D.r * 4.0) * 6.2832) * (1.0 - smoothstep(0.2, 0.6, fwidth(dot(p, vec2(0.3, 0.95)) / 0.5))); H = mix(H, rp * 0.008 + F.b * 0.01, be); rough = mix(rough, 0.9, be); }
  float pb = smoothstep(1.6, 0.25, aw + dN * 0.5) * (1.0 - sea);
  if (pb > 0.001) { float st = smoothstep(0.45, 0.15, F.b); vec3 pc = mix(vec3(0.2, 0.17, 0.12), vec3(0.36, 0.34, 0.3) * (0.7 + 0.6 * F.r), st * nearK + 0.35 * (1.0 - nearK)); A = mix(A, pc, pb); H = mix(H, st * 0.05 * nearK + D.b * 0.02, pb); rough = mix(rough, 0.85, pb); }
  float wet = smoothstep(0.75, 0.05, aw + dN * 0.25 + fN * 0.08); yWet = wet;
  A = mix(A, A * vec3(0.5, 0.52, 0.56), wet * 0.85); rough = mix(rough, 0.32, wet * 0.9);
  // qor: balandlik chizig'i, tik joyda kamroq, yumshoq ko'kish soya, yaltirash
  float snow = smoothstep(${T.SNOW_LO.toFixed(1)}, ${T.SNOW_HI.toFixed(1)}, wp.y + (M.r - 0.55) * 42.0 + dN * 4.0) * (1.0 - 0.85 * smoothstep(0.75, 1.15, slope + dN * 0.2)) * (1.0 - b1.w); yS = snow;
  ySp = 0.0;
  if (snow > 0.001) { vec3 sc = mix(vec3(0.9, 0.92, 0.96), vec3(0.95, 0.96, 0.97), D.r) * (1.0 - 0.05 * smoothstep(0.0, 0.25, curv)); A = mix(A, sc, snow); H = mix(H, D.r * 0.05 + F.r * 0.01 * nearK, snow); rough = mix(rough, 0.72, snow);
    ySp = snow * smoothstep(14.0, 4.0, dist) * step(0.5, uYQ) * smoothstep(0.985, 0.998, fract(F.a * 41.0 + dot(normalize(cameraPosition - wp), vec3(7.1, 5.3, 6.7)))); }
  // uzoqdan qaraganda bir xil tus bo'lmasin: yirik yorug'lik/rang o'zgarishi
  A *= mix(0.88 + 0.24 * m2 + (M.b - 0.44) * 0.12, 1.0, snow * 0.8);
  ySpec = mix(mix(0.35, 0.7, clamp(be + pb + rk + b0.w + b1.x, 0.0, 1.0)), 1.0, max(wet, snow * 0.6));
  yA = A; yR = rough; yH = H * mix(0.35, 1.0, midK); yNf = (Nf.rg * 2.0 - 1.0) * nearK * (0.18 + 0.25 * rk + 0.2 * be) + (Nf.ba * 2.0 - 1.0) * nearK * (pb * 0.5 + rs * 0.3);
  yAO = 1.0 - clamp(curv * 1.6, 0.0, 0.3) + clamp(-curv, 0.0, 0.2) * 0.3;
}
`;

// Material yamog'i: kind 0 — relyef, 1 — yo'l, 2 — ko'prik yog'ochi
const VDECL = ['attribute vec4 aB0; attribute vec4 aB1; attribute vec4 aAx; varying vec4 vB0; varying vec4 vB1; varying vec4 vAx; varying vec3 vWP; varying vec3 vWN;\n',
  'attribute vec4 aB0; attribute vec4 aB1; attribute vec4 aAx; attribute vec4 aRd; varying vec4 vB0; varying vec4 vB1; varying vec4 vAx; varying vec4 vRd; varying vec3 vWP; varying vec3 vWN;\n',
  'attribute vec3 aGr; varying vec3 vGr; varying vec3 vWP; varying vec3 vWN;\n'];
const VSET = ['vB0 = aB0; vB1 = aB1; vAx = aAx;', 'vB0 = aB0; vB1 = aB1; vAx = aAx; vRd = aRd;', 'vGr = aGr;'];
const FDECL = ['varying vec4 vB0; varying vec4 vB1; varying vec4 vAx;\n', 'varying vec4 vB0; varying vec4 vB1; varying vec4 vAx; varying vec4 vRd;\n', 'varying vec3 vGr;\n'];
// yo'l sirti: u — ko'ndalang (m), v — bo'ylama (m); asosiy yo'l — eskirgan qishloq asfalti, dala yo'li — ikki iz, o'rtada o't
const ROAD = `
float yRoad(vec3 wp, vec3 nW, float dist, out vec3 rA, out float rR, out float rH){
  float u = vRd.x, v = vRd.y, au = abs(u), endD = abs(vRd.w), track = step(0.5, vRd.z);
  float hw = mix(5.0, 3.3, track);
  vec2 p = wp.xz;
  vec4 D = yTex(tYN, p, 0.21, YR4, vec2(0.7, 0.1));            // 4.8 m
  vec4 F = yTex(tYN, p, 4.3, YR1, vec2(0.33, 0.6));             // 0.23 m — tosh donlari
  vec4 L = textureGrad(tYN, vec2(v * 0.013, u * 0.09) + 0.27, vec2(dFdx(v) * 0.013, dFdx(u) * 0.09), vec2(dFdy(v) * 0.013, dFdy(u) * 0.09)); // yo'l bo'ylab cho'zilgan
  float nearK = yNear, dN = (D.r - 0.58) * 2.6;
  float mk = smoothstep(9.0, 22.0, endD);                         // chorrahada belgilar yo'q
  float sand = clamp(vB0.w * 1.2 + vB1.z * 0.35 + smoothstep(4.0, 2.0, wp.y) * (1.0 - step(1.5, vAx.x * 100.0 - 10.0)), 0.0, 1.0);
  float m = 0.0; vec3 c = vec3(0.0); float rough = 0.9, H = 0.0;
  vec3 dirt = vColor * vec3(0.78, 0.74, 0.7);
  if (track < 0.5) {
    // asfalt chegarasi uvalangan, keyin shag'al yoqa
    float jn = 1.0 - mk;                                           // chorraha yaqini: yo'llar ustma-ust — sirt faqat dunyo koordinatasiga bog'liq bo'lsin
    float edge = mix(hw - 0.15 + (L.r - 0.58) * 0.9 + (D.b - 0.44) * 0.3, hw + 1.8, jn * jn);
    float asp = 1.0 - smoothstep(edge - 0.06, edge + 0.06, au);
    float lane = abs(au - hw * 0.5);                              // bo'lak o'rtasigacha
    float wheel = smoothstep(0.55, 0.25, abs(lane - 0.85)) * mk;  // g'ildirak izlari
    vec3 ac = vec3(0.1, 0.097, 0.09) * (0.82 + 0.36 * L.r) * (0.9 + 0.2 * D.r);
    ac = mix(ac, vec3(0.19, 0.18, 0.165), smoothstep(0.62, 0.8, F.b) * 0.25 + (F.a - 0.5) * 0.7);   // ochiq tosh donlari
    ac = mix(ac, ac * 0.72, wheel * 0.55);                                                         // silliqlangan izlar
    ac = mix(ac, vec3(0.07, 0.068, 0.066), smoothstep(0.35, 0.05, lane) * 0.3);                    // moy tomchilari chizig'i
    ac *= 1.0 + smoothstep(0.65, 0.9, au / hw) * 0.18 * (1.0 - wheel) * mk;                            // chetlari changli, och
    // yamoqlar (to'rtburchak, to'qroq)
    float pid = floor(v / 7.3), ph = yHash(vec2(pid, 3.1));
    float pu0 = (yHash(vec2(pid, 7.7)) - 0.5) * hw * 1.4, pw = 0.8 + yHash(vec2(pid, 1.9)) * 1.8;
    float rpat = step(0.8, ph) * mk * (1.0 - smoothstep(pw - 0.05, pw + 0.05, abs(u - pu0))) * (1.0 - smoothstep(0.42, 0.48, abs(fract(v / 7.3) - 0.5) * (1.0 + ph)));
    ac = mix(ac, vec3(0.06, 0.06, 0.058) * (0.9 + 0.2 * F.r), rpat * 0.85);
    // yoriqlar: ko'ndalang, bo'ylama, chetda to'rsimon
    float cr = 0.0;
    float tv = v / 9.0 + (L.g - 0.4) * 0.6; float tcr = yLine(fract(tv), 0.5, 0.012 + 0.02 * D.r) * step(0.55, yHash(vec2(floor(tv), 5.3))) * smoothstep(0.3, 0.5, D.g);
    cr = max(cr, tcr);
    cr = max(cr, yLine(u, (L.b - 0.44) * 0.8, 0.015) * smoothstep(0.5, 0.62, L.g) * 0.7);
    cr *= mk;
    float ed = smoothstep(hw - 1.6, hw - 0.3, au); cr = max(cr, ed * smoothstep(0.08, 0.02, abs(F.b - 0.32)) * smoothstep(0.3, 0.6, D.g));
    cr *= 1.0 - rpat * 0.8;
    ac = mix(ac, vec3(0.04, 0.04, 0.038), cr * 0.65);
    // bo'yoq: o'rtadagi uzuq chiziq va chetdagi chiziqlar — yuvilgan
    float paintWear = smoothstep(0.3, 0.7, F.r * 0.4 + D.a * 0.5 + L.r * 0.4 - 0.15) * mk;
    float cl = yLine(u, 0.0, 0.12) * step(fract(v / 12.0), 0.33);
    float el = yLine(au, hw - 0.45, 0.12);
    float paint = max(cl, el) * paintWear * (1.0 - rpat) * (1.0 - smoothstep(0.1, 0.5, yS));
    ac = mix(ac, vec3(0.5, 0.49, 0.45), paint * 0.7);
    // shag'al yoqa
    vec3 gv = mix(dirt, vec3(0.3, 0.28, 0.25), 0.35) * (0.7 + 0.6 * F.b) * (0.9 + 0.2 * D.r);
    c = mix(gv, ac, asp);
    rough = mix(0.95, mix(0.88, 0.62, wheel) - paint * 0.15, asp);
    H = mix(F.b * 0.03, -cr * 0.012 - rpat * 0.004 + F.a * 0.004, asp) - asp * 0.0;
    m = 1.0 - smoothstep(hw + 0.12 + jn * jn * 2.0, hw + 0.42 + jn * jn * 2.0, au + (D.b - 0.44) * 0.35);
    // qor: siqilgan qor, izlarda asfalt va loy
    float sn = yS * (1.0 - wheel * smoothstep(0.3, 0.7, D.r + F.r * 0.3) * 0.85);
    c = mix(c, mix(vec3(0.62, 0.65, 0.7), vec3(0.8, 0.83, 0.88), D.r), sn); c = mix(c, vec3(0.16, 0.15, 0.14), yS * wheel * 0.35);
    rough = mix(rough, 0.45, yS);
    // qum bosgan joylar (cho'l, sohil)
    float sd = sand * smoothstep(0.55, 0.3, D.r * 0.7 + L.r * 0.5 - smoothstep(hw - 2.5, hw, au) * 0.4 - (1.0 - sand) * 0.5);
    c = mix(c, mix(vec3(0.5, 0.38, 0.22), vec3(0.62, 0.5, 0.31), D.r) , sd); rough = mix(rough, 0.92, sd); H = mix(H, F.r * 0.01, sd);
  } else {
    // dala yo'li: ikki iz, o'rtada va chetlarda o't
    float rut = smoothstep(0.42, 0.16, abs(au - 0.88 + (L.r - 0.58) * 0.25));
    float bed = 1.0 - smoothstep(1.55, 2.0, au + (D.r - 0.58) * 1.3 + (L.g - 0.41) * 0.6);   // shibbalangan tuproq kengligi
    float mid = smoothstep(0.55, 0.2, au + (D.b - 0.44) * 0.5);                               // o'rtadagi o't yo'lagi
    vec3 dc = dirt * (0.8 + 0.4 * D.r) * (0.75 + 0.5 * F.b);
    dc = mix(dc, dc * 0.72, rut * 0.6);
    dc = mix(dc, vec3(0.3, 0.29, 0.26) * (0.6 + 0.8 * F.b), smoothstep(0.5, 0.75, F.b) * 0.35 * (1.0 - rut));   // shag'al
    c = dc; rough = mix(0.95, 0.85, rut); H = -rut * 0.05 + F.b * 0.02 * (1.0 - rut);
    m = bed * (1.0 - mid * 0.85) * (1.0 - smoothstep(hw - 0.4, hw + 0.3, au));
    float sn = yS * (1.0 - rut * 0.75); c = mix(c, mix(vec3(0.7, 0.73, 0.79), vec3(0.84, 0.87, 0.92), D.r), sn); c = mix(c, vec3(0.2, 0.18, 0.15), yS * rut * 0.5); rough = mix(rough, 0.5, yS);
    float sd = sand * smoothstep(0.6, 0.35, D.r * 0.8 + L.r * 0.4 - (1.0 - sand) * 0.5); c = mix(c, vec3(0.56, 0.44, 0.27) * (0.9 + 0.2 * D.r), sd * 0.8);
  }
  if (vRd.w < 0.0) m *= smoothstep(1.0, 9.0, endD);               // berk ko'cha uchi yer bilan qo'shiladi
  rA = c; rR = rough; rH = H;
  return m;
}
`;
// Ko'prik yog'ochi: tola yo'nalishi aGr (taxta bo'ylab), ob-havo yegan kulrang-jigarrang
const WOOD = `
void yWood(vec3 wp, vec3 nW, inout vec3 col, out float rough, out float H){
  vec3 d = normalize(vGr), q = normalize(cross(d, nW) + 1e-5);
  float a = dot(wp, d), b = dot(wp, q);
  vec2 uv = vec2(a * 0.23, b * 3.1);
  vec4 G = textureGrad(tYN, uv, vec2(dot(yPx, d) * 0.23, dot(yPx, q) * 3.1), vec2(dot(yPy, d) * 0.23, dot(yPy, q) * 3.1));
  float grain = G.r * 0.6 + G.a * 0.4;
  float lum = dot(col, vec3(0.3, 0.55, 0.15));
  vec3 base = mix(col, vec3(lum) * vec3(1.05, 0.93, 0.8), 0.55) * 0.8;
  float knot = smoothstep(0.16, 0.05, G.b);
  col = base * (0.72 + 0.5 * grain) * (1.0 - knot * 0.45);
  col = mix(col, col * vec3(0.8, 0.85, 0.75), smoothstep(0.6, 0.85, G.g) * 0.4);   // nam/mog'or dog'lari
  rough = 0.86; H = grain * 0.004 - knot * 0.003;
}
`;
const FMAIN = [
  `yerBegin(vWP); vec3 yN0 = normalize(vWN); float yDist = length(cameraPosition - vWP);
  yerGround(vWP, yN0, yDist, vB0, vB1, vAx);
  diffuseColor.rgb = yA;
  vec3 yNW = normalize(yerBump(yN0, yH) + vec3(yNf.x, 0.0, yNf.y));
`,
  `yerBegin(vWP); vec3 yN0 = normalize(vWN); float yDist = length(cameraPosition - vWP);
  yerGround(vWP, yN0, yDist, vB0, vB1, vAx);
  { vec3 rA; float rR, rH; float rm = yRoad(vWP, yN0, yDist, rA, rR, rH); yA = mix(yA, rA, rm); yR = mix(yR, rR, rm); ySpec = mix(ySpec, 0.6 + 0.4 * yS, rm); yH = mix(yH, rH, rm); yNf *= 1.0 - rm * 0.7; ySp *= 1.0 - rm; yAO = mix(yAO, 1.0, rm); }
  diffuseColor.rgb = yA;
  vec3 yNW = normalize(yerBump(yN0, yH) + vec3(yNf.x, 0.0, yNf.y));
`,
  `yerBegin(vWP); vec3 yN0 = normalize(vWN); float yWH; yR = 0.86; ySp = 0.0; yAO = 1.0; ySpec = 0.6;
  yWood(vWP, yN0, diffuseColor.rgb, yR, yWH);
  vec3 yNW = yerBump(yN0, yWH * (1.0 - smoothstep(10.0, 60.0, length(cameraPosition - vWP))));
`];
function patch(sh, kind) {
  for (const k in YER.U) sh.uniforms[k] = YER.U[k];
  sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\n' + VDECL[kind])
    .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz; vWN = normalize(mat3(modelMatrix) * objectNormal); ' + VSET[kind] + '\n');
  sh.fragmentShader = sh.fragmentShader.replace('#include <clipping_planes_pars_fragment>', '#include <clipping_planes_pars_fragment>\n' + FDECL[kind] + GLSL + (kind === 1 ? ROAD : kind === 2 ? WOOD : '') + '\n')
    .replace('#include <color_fragment>', '#include <color_fragment>\n' + FMAIN[kind] + '\n')
    .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = yR;\n')
    .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\nnormal = normalize((viewMatrix * vec4(yNW, 0.0)).xyz);\n')
    .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
{ float yCs = yerCloudShadow(vWP); reflectedLight.directDiffuse *= yCs; reflectedLight.directSpecular = reflectedLight.directSpecular * yCs + ySp * reflectedLight.directDiffuse * 8.0; reflectedLight.indirectDiffuse *= yAO;
  vec3 yV = normalize(cameraPosition - vWP); float yHo = smoothstep(-0.05, 0.45, reflect(-yV, yNW).y);
  reflectedLight.directSpecular *= ySpec; reflectedLight.indirectSpecular *= ySpec * yHo; }
`);
}
function yerMat(kind) {
  const m = new THREE.MeshStandardMaterial({ vertexColors: kind !== 0, roughness: 0.9, metalness: 0, envMapIntensity: 0.2 });
  if (kind === 1) { m.polygonOffset = true; m.polygonOffsetFactor = -1; m.polygonOffsetUnits = -2; }
  // scene.environment ishlatilsa three envMapIntensity o'rniga scene.environmentIntensity oladi — shuning uchun osmon aksini o'zimiz beramiz (kuchi YER.envK)
  m.onBeforeRender = function (r, scene) { if (scene.environment !== this.envMap) this.envMap = scene.environment; this.envMapIntensity = YER.envK; };
  m.onBeforeCompile = (sh) => patch(sh, kind);
  m.customProgramCacheKey = () => 'yer' + kind;
  return m;
}
function initYer() {
  if (YER.terrain) return;
  YER.U.tYN.value = TEX.noise; YER.U.tYM.value = TEX.nrm;
  YER.terrain = yerMat(0); YER.road = yerMat(1); YER.wood = yerMat(2);
}

// --- Yer atributlari (har uch uchun): biom og'irliklari, suv sathi, yo'l chetigacha masofa, lavanda, egrilik ---
let GD = null; // { rdE: Float32Array(NV²) — yo'l chetigacha (m), lap: Float32Array(NV²) — egrilik }
function gridData() {
  if (GD) return GD;
  const h = T.grid.h, R = T.roads, rdE = new Float32Array(NV * NV).fill(99), lap = new Float32Array(NV * NV);
  const RAD = 40;
  for (const e of R.edges) for (let k = 0; k < e.count - 1; k++) {
    const i = e.start + k; if (R.bridge[i] && R.bridge[i + 1]) continue;
    const ax = R.x[i], az = R.z[i], bx = R.x[i + 1], bz = R.z[i + 1], dx = bx - ax, dz = bz - az, ll = dx * dx + dz * dz || 1, hw = e.hw;
    const i0 = Math.max(0, Math.floor((Math.min(ax, bx) - hw - RAD + HALF) / CELL)), i1 = Math.min(N, Math.ceil((Math.max(ax, bx) + hw + RAD + HALF) / CELL));
    const j0 = Math.max(0, Math.floor((Math.min(az, bz) - hw - RAD + HALF) / CELL)), j1 = Math.min(N, Math.ceil((Math.max(az, bz) + hw + RAD + HALF) / CELL));
    for (let j = j0; j <= j1; j++) for (let ii = i0; ii <= i1; ii++) {
      const x = -HALF + ii * CELL, z = -HALF + j * CELL;
      const t = clamp(((x - ax) * dx + (z - az) * dz) / ll, 0, 1), px = ax + dx * t - x, pz = az + dz * t - z;
      const d = Math.sqrt(px * px + pz * pz) - hw + (e.type ? 2.2 : 0), kk = j * NV + ii;
      if (d < rdE[kk]) rdE[kk] = d;
    }
  }
  const H = (i, j) => h[clamp(j, 0, N) * NV + clamp(i, 0, N)];
  for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) lap[j * NV + i] = (H(i - 2, j) + H(i + 2, j) + H(i, j - 2) + H(i, j + 2) - 4 * H(i, j)) / 256;
  return (GD = { rdE, lap });
}
const _zw = new Float32Array(T.NB);
function gAttr(x, z, slope, rdE, lap, wl, b0, b1, ax, o) {
  const W = T.zoneWeights(x, z, _zw);
  b0[o] = W[0] * 255 + 0.5; b0[o + 1] = W[1] * 255 + 0.5; b0[o + 2] = W[2] * 255 + 0.5; b0[o + 3] = W[3] * 255 + 0.5;
  b1[o] = W[4] * 255 + 0.5; b1[o + 1] = W[7] * 255 + 0.5; b1[o + 2] = W[8] * 255 + 0.5; b1[o + 3] = W[9] * 255 + 0.5;
  let lv = 0;
  if (W[0] > 0.6) lv = smoothstep(0.52, 0.66, noise(x * 0.0021 + 100, z * 0.0021 + 60)) * W[0] * (1 - smoothstep(0.1, 0.3, slope)) * smoothstep(0.6, 0.7, W[0]);
  ax[o] = clamp((wl + 10) / 100, 0, 1) * 65535; ax[o + 1] = clamp(rdE / 40, 0, 1) * 65535; ax[o + 2] = lv * 65535; ax[o + 3] = clamp(0.5 + lap * 12, 0, 1) * 65535;
}

function lodIndex(step) {
  const n = CH / step, V = CH + 1, idx = [];
  const vi = (i, j) => j * step * V + i * step;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const a = vi(i, j), b = vi(i + 1, j), c = vi(i, j + 1), d = vi(i + 1, j + 1);
    idx.push(a, c, b, d, b, c);
  }
  // yubka (chetlardagi tirqishlarni yopadi): chet uchlari + pastga tushirilgan nusxalari
  const S0 = V * V; // yubka uchlari boshlanishi: tartib — tepa(j=0), past(j=CH), chap(i=0), o'ng(i=CH), har biri V tadan
  for (let k = 0; k < n; k++) {
    const k0 = k * step, k1 = (k + 1) * step;
    let a = k0, b = k1, sa = S0 + k0, sb = S0 + k1; idx.push(a, b, sb, a, sb, sa);                // tepa chet (z min): tashqariga -z
    a = CH * V + k0; b = CH * V + k1; sa = S0 + V + k0; sb = S0 + V + k1; idx.push(a, sb, b, a, sa, sb); // past chet
    a = k0 * V; b = k1 * V; sa = S0 + 2 * V + k0; sb = S0 + 2 * V + k1; idx.push(a, sb, b, a, sa, sb);   // chap chet
    a = k0 * V + CH; b = k1 * V + CH; sa = S0 + 3 * V + k0; sb = S0 + 3 * V + k1; idx.push(a, b, sb, a, sb, sa); // o'ng chet
  }
  return new THREE.BufferAttribute(new Uint16Array(idx), 1);
}

export function buildTerrain(scene) {
  initYer();
  const group = new THREE.Group();
  const h = T.grid.h, col = T.grid.col, gd = gridData();
  const V = CH + 1;
  const lodIdx = STEPS.map(lodIndex);
  const chunks = [];
  for (let cj = 0; cj < N; cj += CH) for (let ci = 0; ci < N; ci += CH) {
    let maxH = -1e9, minH = 1e9;
    for (let j = 0; j <= CH; j += 5) for (let i = 0; i <= CH; i += 5) { const v = h[(cj + j) * NV + ci + i]; if (v > maxH) maxH = v; if (v < minH) minH = v; }
    if (maxH < -9) continue;
    const nv = V * V + 4 * V;
    const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), cl = new Float32Array(nv * 3);
    const b0 = new Uint8Array(nv * 4), b1 = new Uint8Array(nv * 4), ax = new Uint16Array(nv * 4);
    for (let j = 0; j <= CH; j++) for (let i = 0; i <= CH; i++) {
      const gi = ci + i, gj = cj + j, k = gj * NV + gi, o = (j * V + i) * 3;
      const x = -HALF + gi * CELL, z = -HALF + gj * CELL;
      pos[o] = x; pos[o + 1] = h[k]; pos[o + 2] = z;
      const hl = h[gj * NV + Math.max(0, gi - 1)], hr = h[gj * NV + Math.min(N, gi + 1)], hu = h[Math.max(0, gj - 1) * NV + gi], hd = h[Math.min(N, gj + 1) * NV + gi];
      let nx = -(hr - hl) / (2 * CELL), nz = -(hd - hu) / (2 * CELL); const l = Math.hypot(nx, 1, nz);
      nor[o] = nx / l; nor[o + 1] = 1 / l; nor[o + 2] = nz / l;
      cl[o] = col[k * 3]; cl[o + 1] = col[k * 3 + 1]; cl[o + 2] = col[k * 3 + 2];
      gAttr(x, z, Math.hypot(nx, nz), gd.rdE[k], gd.lap[k], T.waterY(x, z), b0, b1, ax, (j * V + i) * 4);
    }
    const S0 = V * V;
    const skirt = (dst, src) => { const d = (S0 + dst) * 3, s = src * 3; pos[d] = pos[s]; pos[d + 1] = pos[s + 1] - 14; pos[d + 2] = pos[s + 2]; nor[d] = nor[s]; nor[d + 1] = nor[s + 1]; nor[d + 2] = nor[s + 2]; cl[d] = cl[s]; cl[d + 1] = cl[s + 1]; cl[d + 2] = cl[s + 2];
      const d4 = (S0 + dst) * 4, s4 = src * 4; for (let q = 0; q < 4; q++) { b0[d4 + q] = b0[s4 + q]; b1[d4 + q] = b1[s4 + q]; ax[d4 + q] = ax[s4 + q]; } };
    for (let k = 0; k < V; k++) { skirt(k, k); skirt(V + k, CH * V + k); skirt(2 * V + k, k * V); skirt(3 * V + k, k * V + CH); }
    const pa = new THREE.BufferAttribute(pos, 3), na = new THREE.BufferAttribute(nor, 3), ca = new THREE.BufferAttribute(cl, 3);
    const ba0 = new THREE.BufferAttribute(b0, 4, true), ba1 = new THREE.BufferAttribute(b1, 4, true), axa = new THREE.BufferAttribute(ax, 4, true);
    const cx = -HALF + (ci + CH / 2) * CELL, cz = -HALF + (cj + CH / 2) * CELL;
    const sphere = new THREE.Sphere(new THREE.Vector3(cx, (maxH + minH) / 2, cz), Math.hypot(CH * CELL * 0.71, (maxH - minH) / 2 + 20));
    const geos = lodIdx.map((ix) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', pa); g.setAttribute('normal', na); g.setAttribute('color', ca); g.setAttribute('aB0', ba0); g.setAttribute('aB1', ba1); g.setAttribute('aAx', axa); g.setIndex(ix); g.boundingSphere = sphere; return g; });
    const m = new THREE.Mesh(geos[0], YER.terrain);
    m.receiveShadow = true; m.matrixAutoUpdate = false; m.updateMatrix();
    group.add(m);
    chunks.push({ mesh: m, geos, cx, cz, lod: 0 });
  }
  scene.add(group);
  const api = {
    group, chunks, mat: YER.terrain,
    update(cam) {
      const px = cam.position.x, pz = cam.position.z;
      for (let i = 0; i < chunks.length; i++) {
        const c = chunks[i]; const d = Math.hypot(c.cx - px, c.cz - pz);
        const lod = d < 800 ? 0 : d < 1900 ? 1 : 2;
        if (lod !== c.lod) { c.lod = lod; c.mesh.geometry = c.geos[lod]; }
      }
    },
    setQuality(q) { YER.U.uYQ.value = q; },
  };
  return api;
}

// Yo'l rangi biom bo'yicha (shag'al yoqa va dala yo'li tuprog'i)
const RC = [hexLin(0xb79d7a), hexLin(0xa88a68), hexLin(0x9d8c74), hexLin(0xcda468), hexLin(0xb06d4b), null, null, hexLin(0xc2a98a), hexLin(0xc4a36a), hexLin(0x6a6068)];
const RSNOW = hexLin(0xc6cfdf), RBEACH = hexLin(0xd9c58e);
export function roadColor(x, z, y) {
  const W = T.zoneWeights(x, z, _zw);
  let c = [0, 0, 0];
  for (let i = 0; i < T.NB; i++) { const w = W[i]; if (w > 0 && RC[i]) { c[0] += RC[i][0] * w; c[1] += RC[i][1] * w; c[2] += RC[i][2] * w; } }
  const sn = T.snowAt(x, z, y) * (1 - W[9]);
  if (sn > 0) c = mixRGB(c, RSNOW, sn);
  const be = smoothstep(4.2, 2.0, y); if (be > 0) c = mixRGB(c, RBEACH, be);
  return c;
}

// Yo'l lentasi: indeksli to'r (har namunada 9 uch), atributlar — aRd (ko'ndalang m, bo'ylama m, tur, uchgacha m), yer atributlari (chetlar yerga qo'shilsin)
export function buildRoads(scene) {
  initYer();
  const R = T.roads, gd = gridData();
  const group = new THREE.Group();
  const wood = new GB(12); wood.jit = 0.08;
  const grain = [];
  const deg = R.nodes.map((n) => n.edges.length);
  const tn = [0, 0, 0];
  const terrN = (x, z) => { const e = 8, nx = -(T.gridHeight(x + e, z) - T.gridHeight(x - e, z)) / (2 * e), nz = -(T.gridHeight(x, z + e) - T.gridHeight(x, z - e)) / (2 * e), l = Math.hypot(nx, 1, nz); tn[0] = nx / l; tn[1] = 1 / l; tn[2] = nz / l; return tn; };
  for (const e of R.edges) {
    const lift0 = 0.02 + e.id * 0.003, lift = lift0 + (e.type === 0 ? 0.03 : 0);
    const hw = e.hw;
    const offs = e.type === 0 ? [-hw - 1.4, -hw - 0.7, -hw, -hw * 0.5, 0, hw * 0.5, hw, hw + 0.7, hw + 1.4] : [-hw - 1.2, -hw - 0.6, -hw, -1.2, 0, 1.2, hw, hw + 0.6, hw + 1.2];
    const drop = [0.65, 0.3, 0, 0, 0, 0, 0, 0.3, 0.65], NO = offs.length;
    const deadA = deg[e.a] <= 1, deadB = deg[e.b] <= 1;
    const SEG = 96;
    for (let k0 = 0; k0 < e.count - 1; k0 += SEG) {
      const k1 = Math.min(e.count - 1, k0 + SEG), rows = k1 - k0 + 1, nv = rows * NO;
      const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), cl = new Float32Array(nv * 3), rd = new Float32Array(nv * 4);
      const b0 = new Uint8Array(nv * 4), b1 = new Uint8Array(nv * 4), ax = new Uint16Array(nv * 4), idx = [];
      for (let k = k0; k <= k1; k++) {
        const i = e.start + k, r = k - k0;
        const x = R.x[i], z = R.z[i], y = R.y[i] + lift, tx = R.tx[i], tz = R.tz[i], lx = tz, lz = -tx;
        const ka = Math.max(0, k - 1), kb = Math.min(e.count - 1, k + 1), g = (R.y[e.start + kb] - R.y[e.start + ka]) / Math.max(0.1, e.s[kb] - e.s[ka]);
        let rnx = -g * tx, rny = 1, rnz = -g * tz; const rl = Math.hypot(rnx, rny, rnz); rnx /= rl; rny /= rl; rnz /= rl;
        const c = roadColor(x, z, y), s = e.s[k], dA = s, dB = e.len - s;
        const endW = dA < dB ? (deadA ? -dA : dA) : (deadB ? -dB : dB);
        const jf = endW > 0 ? 1 - smoothstep(hw * 2 + 4, hw * 2 + 14, endW) : 0; // chorrahada yoqa tikroq tushadi — boshqa yo'l ustiga chiqmasin
        for (let q = 0; q < NO; q++) {
          const v = r * NO + q, o = v * 3, o4 = v * 4, px = x + lx * offs[q], pz = z + lz * offs[q];
          pos[o] = px; pos[o + 1] = y - drop[q] * (1 + jf * 2.5); pos[o + 2] = pz;
          if (drop[q] > 0) { const t = terrN(px, pz), w = (drop[q] > 0.5 ? 1 : 0.5) * (1 - jf); let nx = lerp(rnx, t[0], w), ny = lerp(rny, t[1], w), nz = lerp(rnz, t[2], w); const l = Math.hypot(nx, ny, nz); nor[o] = nx / l; nor[o + 1] = ny / l; nor[o + 2] = nz / l; }
          else { nor[o] = rnx; nor[o + 1] = rny; nor[o + 2] = rnz; }
          cl[o] = c[0]; cl[o + 1] = c[1]; cl[o + 2] = c[2];
          rd[o4] = offs[q]; rd[o4 + 1] = s; rd[o4 + 2] = e.type; rd[o4 + 3] = endW === 0 ? -0.001 : endW;
          const gi = clamp(Math.round((px + HALF) / CELL), 0, N), gj = clamp(Math.round((pz + HALF) / CELL), 0, N);
          gAttr(px, pz, 0, Math.max(0, Math.abs(offs[q]) - hw) + (e.type ? 2.2 : 0), gd.lap[gj * NV + gi], T.waterY(px, pz), b0, b1, ax, o4);
        }
        if (r > 0 && !(R.bridge[i] && R.bridge[i - 1])) for (let q = 0; q < NO - 1; q++) { const a = (r - 1) * NO + q, b = a + 1, cc = r * NO + q, d = cc + 1; idx.push(a, cc, b, b, cc, d); }
      }
      if (!idx.length) continue;
      const gm = new THREE.BufferGeometry();
      gm.setAttribute('position', new THREE.BufferAttribute(pos, 3)); gm.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); gm.setAttribute('color', new THREE.BufferAttribute(cl, 3));
      gm.setAttribute('aRd', new THREE.BufferAttribute(rd, 4)); gm.setAttribute('aB0', new THREE.BufferAttribute(b0, 4, true)); gm.setAttribute('aB1', new THREE.BufferAttribute(b1, 4, true)); gm.setAttribute('aAx', new THREE.BufferAttribute(ax, 4, true));
      gm.setIndex(idx); gm.computeBoundingSphere();
      const mesh = new THREE.Mesh(gm, YER.road); mesh.receiveShadow = true; mesh.matrixAutoUpdate = false; group.add(mesh);
    }
    let k = 0;
    while (k < e.count) {
      if (!R.bridge[e.start + k]) { k++; continue; }
      let k1 = k; while (k1 + 1 < e.count && R.bridge[e.start + k1 + 1]) k1++;
      buildBridge(wood, grain, e, k, k1, lift0);
      k = k1 + 1;
    }
  }
  scene.add(group);
  const bg = wood.build(); bg.setAttribute('aGr', new THREE.BufferAttribute(new Float32Array(grain), 3));
  const bm = new THREE.Mesh(bg, YER.wood); bm.receiveShadow = true; bm.castShadow = true; scene.add(bm);
  return group;
}

// gr — har uch uchun yog'och tolasi yo'nalishi (dunyo fazosida)
function buildBridge(gb, gr, e, k0, k1, lift) {
  const R = T.roads, hw = e.hw;
  const plankA = 0xb8643e, plankB = 0xa85a38, beam = 0x7a4a30, rail = 0xc27048;
  const dir = (x, y, z) => { const n = gb.p.length / 3; while (gr.length / 3 < n) gr.push(x, y, z); };
  for (let k = k0; k <= k1; k++) {
    const i = e.start + k;
    const x = R.x[i], z = R.z[i], y = R.y[i] + lift, yaw = Math.atan2(R.tx[i], R.tz[i]);
    if (k < k1) {
      const j = i + 1;
      const dx = R.x[j] - x, dz = R.z[j] - z, dy = R.y[j] - R.y[i], len = Math.hypot(dx, dz);
      const yw = Math.atan2(dx, dz), pitch = -Math.atan2(dy, len), ax = dx / len, az = dz / len;
      gb.push().translate(x, y, z).rotY(yw).rotX(pitch);
      const np = 4;
      for (let q = 0; q < np; q++) { gb.color((q + k) % 2 ? plankA : plankB); gb.box(0, -0.11, (q + 0.5) * len / np, hw * 2 + 0.5, 0.2, len / np - 0.06); }
      dir(az, 0, -ax);
      gb.color(beam); gb.box(-hw + 0.5, -0.42, len / 2, 0.3, 0.4, len + 0.05); gb.box(hw - 0.5, -0.42, len / 2, 0.3, 0.4, len + 0.05);
      gb.color(rail);
      for (const sd of [-1, 1]) { gb.box(sd * (hw + 0.1), 1.0, len / 2, 0.14, 0.14, len + 0.05); gb.box(sd * (hw + 0.1), 0.55, len / 2, 0.1, 0.1, len + 0.05); }
      dir(ax, 0, az);
      gb.pop();
      const lx = R.tz[i], lz = -R.tx[i], lx2 = R.tz[j], lz2 = -R.tx[j];
      for (const sd of [-1, 1]) COL.addSeg(x + lx * sd * (hw + 0.1), z + lz * sd * (hw + 0.1), R.x[j] + lx2 * sd * (hw + 0.1), R.z[j] + lz2 * sd * (hw + 0.1), 0.18, y - 0.5, y + 1.3);
    }
    gb.push().translate(x, y, z).rotY(yaw);
    gb.color(rail);
    for (const sd of [-1, 1]) gb.box(sd * (hw + 0.1), 0.5, 0, 0.2, 1.25, 0.2);
    dir(0, 1, 0);
    if ((k - k0) % 2 === 0) {
      const gy = T.gridHeight(x, z);
      const depth = Math.max(1.2, y - gy + 1.2);
      gb.color(beam);
      for (const sd of [-1, 1]) { gb.push().translate(sd * (hw - 0.4), -depth, 0); gb.prism(6, 0.24, 0.2, 0, depth - 0.2); gb.pop(); }
      dir(0, 1, 0);
      gb.box(0, -0.75, 0, hw * 2 + 0.6, 0.26, 0.26);
      if (depth > 3.2) gb.box(0, -depth * 0.55, 0, hw * 2 - 0.6, 0.18, 0.18);
      dir(R.tz[i], 0, -R.tx[i]);
    }
    gb.pop();
  }
}

// --- Suv ---
export function buildWater(scene) {
  const out = {};
  const uni = { uTime: { value: 0 } };
  const wave = (mat, amp) => {
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = uni.uTime;
      sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader
        .replace('#include <beginnormal_vertex>', `
          float wa = position.x*0.021 + uTime*0.8, wb = position.y*0.027 + uTime*1.05, wc = (position.x+position.y)*0.05 + uTime*1.5;
          vec3 objectNormal = normalize(vec3(-(cos(wa)*0.021*0.5 + cos(wc)*0.05*0.16)*${amp.toFixed(2)}, -(cos(wb)*0.027*0.4 + cos(wc)*0.05*0.16)*${amp.toFixed(2)}, 1.0));`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          transformed.z += (sin(wa)*0.5 + sin(wb)*0.4 + sin(wc)*0.16)*${amp.toFixed(2)};`);
    };
  };
  const seaMat = new THREE.MeshLambertMaterial({ color: 0x3aa6d8, transparent: true, opacity: 0.88 });
  wave(seaMat, 0.55);
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(9000, 9000, 180, 180), seaMat);
  sea.rotation.x = -Math.PI / 2; sea.position.y = 0; sea.renderOrder = 2; scene.add(sea);
  const far = new THREE.Mesh(new THREE.PlaneGeometry(60000, 60000), new THREE.MeshLambertMaterial({ color: 0x3aa6d8 }));
  far.rotation.x = -Math.PI / 2; far.position.y = -1.2; scene.add(far);
  out.sea = sea; out.uni = uni; out.seaMat = seaMat;

  const freshMat = new THREE.MeshLambertMaterial({ color: 0x4fb6e0, transparent: true, opacity: 0.86 });
  wave(freshMat, 0.12);
  const lake = new THREE.Mesh(new THREE.CircleGeometry(T.LAKE.r + 75, 48, 0, Math.PI * 2), freshMat);
  lake.rotation.x = -Math.PI / 2; lake.position.set(T.LAKE.x, T.LAKE.y, T.LAKE.z); lake.renderOrder = 2; scene.add(lake);
  // Daryo lentalari
  const rv = T.getRiver();
  const rMat = new THREE.MeshLambertMaterial({ color: 0x4fb6e0, transparent: true, opacity: 0.86 });
  const hw = T.RIVER.hw + 9;
  for (const part of rv.parts) {
    const pos = [], nor = [];
    let px0, pz0, px1, pz1, py;
    const a0 = part.start, b0 = part.start + part.count;
    for (let i = a0; i < b0; i += 2) {
      const a = Math.max(a0, i - 2), b = Math.min(b0 - 1, i + 2);
      let tx = rv.x[b] - rv.x[a], tz = rv.z[b] - rv.z[a]; const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l;
      const x0 = rv.x[i] + tz * hw, z0 = rv.z[i] - tx * hw, x1 = rv.x[i] - tz * hw, z1 = rv.z[i] + tx * hw, y = rv.y[i];
      if (i > a0) { pos.push(px0, py, pz0, x1, y, z1, x0, y, z0, px0, py, pz0, px1, py, pz1, x1, y, z1); for (let q = 0; q < 6; q++) nor.push(0, 1, 0); }
      px0 = x0; pz0 = z0; px1 = x1; pz1 = z1; py = y;
    }
    const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); rg.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    const riverMesh = new THREE.Mesh(rg, rMat); riverMesh.renderOrder = 2; scene.add(riverMesh);
  }
  out.fresh = freshMat;
  return out;
}
