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
export const YER = { U: { tYN: { value: null }, tYM: { value: null }, uYT: WIND, uYQ: { value: 2 }, uYEnvLo: { value: 0.55 } }, terrain: null, road: null, wood: null, envK: 0.3, qSet: false };

// Har piksel yer turi: biom og'irliklari (aB0/aB1), suv sathi, yo'lgacha masofa, lavanda, egrilik (aAx) + qiyalik va balandlik.
// uYQ >= 0.5 — to'liq yo'l (yerGround: yaqinda mayda detal, qoya uch proyeksiyasi, relyef normali); uYQ < 0.5 — arzon yo'l (yerGroundLo: 2 ta tekstura, normal yo'q)
const GLSL = `
uniform sampler2D tYN; uniform sampler2D tYM; uniform float uYT; uniform float uYQ; uniform float uYEnvLo;
varying vec3 vWP; varying vec3 vWN;
vec3 yA; float yR; float yH; float ySpec; vec2 yNf; float ySp; float yAO; float yS; float yWet; float yNear; float yDry;
vec2 yDx; vec2 yDy; vec3 yPx; vec3 yPy; float yFp; vec4 yM;
const mat2 YR0 = mat2(1.0, 0.0, 0.0, 1.0), YR1 = mat2(0.8, -0.6, 0.6, 0.8), YR2 = mat2(-0.67, 0.74, -0.74, -0.67), YR3 = mat2(0.77, 0.64, -0.64, 0.77), YR4 = mat2(0.28, -0.96, 0.96, 0.28);
vec4 yTex(sampler2D t, vec2 p, float s, mat2 r, vec2 o){ return textureGrad(t, r * p * s + o, r * yDx * s, r * yDy * s); }
// anizotropiyasiz arzon so'rov (yirik miqyos va 0-daraja): mip darajasi piksel izidan qo'lda — textureGrad (anizotropiya 8) dasturiy renderda va kuchsiz videokartada qimmat
vec4 yTexL(sampler2D t, vec2 p, float s, mat2 r, vec2 o){ return textureLod(t, r * p * s + o, max(0.0, 0.5 * log2(max(dot(yDx, yDx), dot(yDy, yDy)) * s * s * 262144.0) - 0.5)); }
// chiziqli koordinata uchun fwidth o'rnini bosuvchi (shartli tarmoq ichida ham to'g'ri): d — yo'nalish, k — miqyos
float yFw(vec2 d, float k){ return (abs(dot(yDx, d)) + abs(dot(yDy, d))) * k; }
// to'lqin uzunligi lam (m) bo'lgan relyef piksel o'lchamidan mayda bo'lsa so'nadi (pog'ona/shovqin bo'lmasin)
float yKf(float lam){ return 1.0 - smoothstep(0.1 * lam, 0.35 * lam, yFp); }
float yHash(vec2 p){ vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
// ingichka chiziq (antialias, ekran izi f oldindan hisoblangan): c — markaz, w — kenglik; f > w bo'lsa xiralashadi
float yLineF(float x, float c, float w, float f){ f = max(f, 1e-4); return clamp((w * 0.5 - abs(x - c)) / f + 0.5, 0.0, 1.0) * min(1.0, w / f); }
// bulut soyasi (to'g'ri quyosh nurini to'sadi) — keyin umumiy safarCloudShadow() bilan almashtiriladi; bitta xira (mip) tekstura
float yerCloudShadow(vec3 wp){
  vec4 t = textureLod(tYN, (wp.xz + vec2(uYT * 6.0, uYT * 2.2)) * 0.00034, 4.5);
  return 1.0 - 0.36 * smoothstep(0.6, 0.74, t.r * 0.78 + t.g * 0.3 - 0.03);
}
// sirt balandligi hosilasidan normal (ekran hosilalari, qo'shimcha tekstura so'ramaydi)
vec3 yerBump(vec3 n, float H){
  float hx = dFdx(H), hy = dFdy(H);
  vec3 r1 = cross(yPy, n), r2 = cross(n, yPx); float det = dot(yPx, r1);
  vec3 g = sign(det) * (hx * r1 + hy * r2);
  return normalize(abs(det) * n - g);
}
// qiya qarashda relyef normali so'nadi (yaltiroq chiziqlar, pog'onalar bo'lmasin)
float yGraze(vec3 n){ return smoothstep(0.06, 0.35, abs(dot(normalize(cameraPosition - vWP), n))); }
void yerBegin(vec3 wp){ yDx = dFdx(wp.xz); yDy = dFdy(wp.xz); }
void yerBeginHi(vec3 wp){ yPx = dFdx(wp); yPy = dFdy(wp); yFp = max(length(yPx), length(yPy)); yM = yTexL(tYN, wp.xz, 0.0015625, YR0, vec2(0.31, 0.77)); }
// qor qoplami: balandlik bo'yicha ulush (yirik shovqin bilan) dog'larga aylanadi — o'tish zonasida kulrang aralashma emas, qor va yer dog'lari
float yerSnow(float y, float n){ return smoothstep(0.44, 0.56, smoothstep(${T.SNOW_LO.toFixed(1)}, ${T.SNOW_HI.toFixed(1)}, y + (yM.r - 0.55) * 42.0) + n); }
void yerGround(vec3 wp, vec3 nW, float dist, vec4 b0, vec4 b1, vec4 ax){
  vec2 p = wp.xz;
  float ws = dot(b0, vec4(1.0)) + dot(b1, vec4(1.0)); b0 /= max(ws, 0.01); b1 /= max(ws, 0.01);
  float slope = length(nW.xz) / max(nW.y, 0.05);
  float nearK = 1.0 - smoothstep(12.0, 55.0, dist); yNear = nearK;
  float midK = 1.0 - smoothstep(80.0, 420.0, dist);
  vec4 M = yM;
  vec4 M2 = yTexL(tYN, p, 0.00058, YR1, vec2(0.11, 0.53));
  vec4 D = yTex(tYN, p, 0.077, YR2, vec2(0.5));
  float m = clamp((M.r - 0.58) * 2.6 + 0.5, 0.0, 1.0), m2 = clamp((M2.r - 0.58) * 2.6 + 0.5, 0.0, 1.0);
  float dN = clamp((D.r - 0.58) * 2.6, -1.0, 1.0);
  float curv = ax.w - 0.5;
  float wl = ax.x * 100.0 - 10.0, aw = wp.y - wl;            // suv sathidan balandlik (m)
  float rdE = ax.y * 40.0;                                    // yo'l chetigacha (m)
  float rs = smoothstep(2.6, 0.2, rdE + dN * 1.1) * (1.0 - b1.w);                     // yo'l yoqasi
  // tik joyda tekislik (xz) teksturasi qiyalik bo'ylab cho'ziladi ('mo'yna' chiziqlari) — niqoblarda faqat yirik shovqin
  float stp = smoothstep(0.3, 0.75, slope), dNm = mix(dN, clamp((M.g - 0.41) * 2.2 + (M2.r - 0.58) * 2.0, -1.0, 1.0), stp);
  // qoya: o'simlikli biomlarda (o'tloq, xazon, tayga, savanna) pastda faqat juda tik joyda — 30° li o't qiyalikda kulrang dog' bo'lmasin
  float rkL = 0.35 * (b0.x + b0.y + b0.z + b1.y + b1.z) * (1.0 - smoothstep(110.0, 160.0, wp.y));
  float rk = smoothstep(0.62 + rkL, 1.05 + rkL, slope + dNm * 0.25 + (M.g - 0.41) * 0.35);
  float wgr = b0.x + b1.y + b1.z;
  vec4 F = vec4(0.58, 0.41, 0.44, 0.5), Nf = vec4(0.5), S = vec4(0.58, 0.41, 0.44, 0.5);
  float bK = 0.0;                                              // o't tolalari ko'rinishi (yaqinda, yo'l yoqasi va qoyada yo'q)
  if (nearK > 0.001) {
    F = yTex(tYN, p, 0.37, YR3, vec2(0.21, 0.4)); Nf = yTex(tYM, p, 0.29, YR0, vec2(0.13));
    bK = nearK * (1.0 - stp) * smoothstep(0.6, 0.4, rs) * smoothstep(0.97, 0.8, rk) * step(0.02, wgr);
    if (bK > 0.001) {
      // ikki cho'zilgan yo'nalish katta dog'lar bo'yicha almashinadi (max emas — to'r naqshi chiqmasin)
      vec2 sc = vec2(3.1, 0.8); vec4 S1 = textureGrad(tYN, (YR3 * p) * sc, (YR3 * yDx) * sc, (YR3 * yDy) * sc), S2 = textureGrad(tYN, (YR1 * p) * sc + 0.5, (YR1 * yDx) * sc, (YR1 * yDy) * sc);
      S = mix(S1, S2, smoothstep(0.4, 0.7, F.r + (D.a - 0.5) * 0.7));
    }
  }
  float fN = clamp((F.r - 0.58) * 2.6, -1.0, 1.0);
  float dry = clamp(smoothstep(0.2, 0.85, m * 0.55 + m2 * 0.45) - curv * 1.4 + slope * 0.3 + (D.g - 0.41) * 0.5, 0.0, 1.0); yDry = dry;
  float blade = clamp((S.r * 0.6 + S.a * 0.4 - 0.6) * 2.2 + 0.5, 0.0, 1.0);
  float bt = smoothstep(0.3, 0.75, blade);
  vec3 A = vec3(0.0); float H = 0.0, rough = 0.0, spec = 0.0;
  // o'tloq / sakura: to'q sarg'ish-yashil, qurigan dog'lar, beda, tuproq (o't — deyarli yaltiramaydi)
  float wg = b0.x + b1.y;
  if (wg > 0.003) {
    vec3 c = mix(vec3(0.1, 0.155, 0.045), vec3(0.165, 0.2, 0.068), m2);
    c = mix(c, vec3(0.25, 0.215, 0.1), dry * dry * 0.6);
    float clump = smoothstep(0.32, 0.08, D.b); c = mix(c, c * vec3(0.74, 0.86, 0.7), clump * 0.5);
    float dirt = smoothstep(0.1, 0.02, D.b) * smoothstep(0.5, 0.72, D.g); c = mix(c, vec3(0.2, 0.14, 0.08), dirt * 0.7);
    c *= 0.84 + 0.32 * mix(D.r, 0.58, stp);   // tik joyda tekislik teksturasi cho'ziladi — o'rtachaga
    c *= mix(1.0, 0.74 + 0.48 * bt, bK * 0.7); c = mix(c, vec3(0.26, 0.245, 0.11), smoothstep(0.7, 0.95, blade) * bK * 0.3);
    // lavanda qatorlari
    float lv = ax.z;
    if (lv > 0.01) { float rc = dot(p, vec2(0.6, 0.8)) / 1.7; float st = smoothstep(0.34, 0.14, abs(fract(rc) - 0.5)); st = mix(st, 0.5, smoothstep(0.05, 0.28, yFw(vec2(0.6, 0.8), 1.0 / 1.7)));
      // butalar kulrang-yashil, gullar xira binafsha (soyada ko'k osmon ostida ham juda ko'karib ketmasin), qatorlar orasida tuproq
      float fl = smoothstep(0.3, 0.65, D.a + F.r * 0.4) * mix(0.8, 0.95, nearK);
      vec3 lc = mix(vec3(0.13, 0.1, 0.06), mix(vec3(0.115, 0.13, 0.07), vec3(0.26, 0.175, 0.33), fl) * (0.85 + 0.3 * F.r), st); c = mix(c, lc, smoothstep(0.1, 0.5, lv) * 0.85); }
    // sakura gul barglari
    float pt = b1.y / max(wg, 0.01); c = mix(c, vec3(0.78, 0.5, 0.56), pt * smoothstep(0.1, 0.02, F.b) * smoothstep(0.45, 0.7, D.r) * nearK * 0.8);
    A += c * wg; H += (blade - 0.5) * 0.012 * bK * yKf(0.3) * wg; rough += wg; spec += 0.05 * wg;
  }
  // kuzgi o'rmon: xazon (to'q sariq, qizg'ish, sariq) va o't orollari
  if (b0.y > 0.003) {
    float lf = clamp(D.r * 1.3 - 0.25 + fN * 0.35 * nearK, 0.0, 1.0);
    vec3 c = mix(mix(vec3(0.17, 0.09, 0.04), vec3(0.34, 0.165, 0.06), lf), vec3(0.36, 0.26, 0.085), smoothstep(0.6, 0.85, D.a + fN * 0.25) * 0.7);
    c = mix(c, vec3(0.12, 0.14, 0.05), smoothstep(0.45, 0.75, m2 + (D.g - 0.4) * 0.8) * 0.75);
    c *= 0.82 + 0.36 * F.a;
    A += c * b0.y; H += (F.b * 0.02 * nearK * yKf(0.3) + D.r * 0.03 * yKf(4.0)) * b0.y; rough += 0.95 * b0.y; spec += 0.08 * b0.y;
  }
  // tayga: mox, igna to'shamasi, och liken
  if (b0.z > 0.003) {
    vec3 c = mix(vec3(0.075, 0.115, 0.04), vec3(0.15, 0.105, 0.06), smoothstep(0.4, 0.75, D.r + curv * -0.8 + (M.r - 0.58)));
    c = mix(c, vec3(0.3, 0.31, 0.22), smoothstep(0.14, 0.04, D.b + (D.r - 0.58) * 0.5) * 0.35);
    c *= 0.85 + 0.3 * F.r;
    A += c * b0.z; H += (smoothstep(0.4, 0.1, F.b) * 0.02 * nearK * yKf(0.3) + D.b * 0.03 * yKf(4.0)) * b0.z; rough += b0.z; spec += 0.06 * b0.z;
  }
  // cho'l qumi: shamol to'lqinchalari va katta qum yollari
  float wsd = b0.w;
  if (wsd > 0.003) {
    vec3 c = mix(vec3(0.45, 0.31, 0.16), vec3(0.6, 0.45, 0.25), m * 0.6 + D.r * 0.4);
    vec2 wd = vec2(0.86, 0.5); float rc = dot(p, wd) / 0.34 + D.r * 5.0 + M.r * 30.0;
    float rp = sin(rc * 6.2832) * (1.0 - smoothstep(0.2, 0.6, yFw(wd, 1.0 / 0.34)));
    float dn = sin(dot(p, wd) / 9.0 + M.g * 18.0);
    c *= 0.95 + 0.07 * rp * (1.0 - nearK * 0.5);
    A += c * wsd; H += (rp * 0.01 + dn * 0.15 * midK) * wsd; rough += 0.88 * wsd; spec += 0.35 * wsd;
  }
  // kanyon: qizil tuproq
  if (b1.x > 0.003) {
    vec3 c = mix(vec3(0.36, 0.15, 0.07), vec3(0.5, 0.27, 0.13), D.r * 0.7 + m * 0.3);
    c = mix(c, vec3(0.3, 0.27, 0.12), smoothstep(0.62, 0.8, m2) * 0.4);
    A += c * b1.x; H += D.g * 0.04 * yKf(4.0) * b1.x; rough += 0.9 * b1.x; spec += 0.3 * b1.x;
  }
  // savanna: somon rangli quruq o't
  if (b1.z > 0.003) {
    vec3 c = mix(vec3(0.33, 0.255, 0.11), vec3(0.45, 0.36, 0.16), m * 0.5 + D.r * 0.5);
    c = mix(c, vec3(0.2, 0.19, 0.08), smoothstep(0.3, 0.08, D.b) * 0.5);
    c = mix(c, vec3(0.4, 0.27, 0.15), smoothstep(0.1, 0.03, D.b) * 0.6);
    c *= mix(1.0, 0.72 + 0.55 * bt, bK * 0.8);
    A += c * b1.z; H += (blade - 0.5) * 0.012 * bK * yKf(0.3) * b1.z; rough += b1.z; spec += 0.06 * b1.z;
  }
  // vulqon: mayda kul, g'ovak bazalt bo'laklari, zang (katakli naqsh emas — tosh yo'lakka o'xshab qolmasin)
  if (b1.w > 0.003) {
    float bs = smoothstep(0.42, 0.7, D.r + (M.g - 0.4));
    vec3 c = mix(vec3(0.095, 0.09, 0.087), vec3(0.06, 0.056, 0.058), bs);
    c *= 0.86 + 0.28 * F.a * (0.5 + bs);
    c = mix(c, vec3(0.17, 0.085, 0.05), smoothstep(0.75, 0.9, D.g) * 0.5);
    A += c * b1.w; H += ((F.r - 0.58) * 0.02 * nearK * yKf(0.5) * (0.4 + bs) + D.g * 0.05 * yKf(4.0)) * b1.w; rough += 0.85 * b1.w; spec += 0.3 * b1.w;
  }
  // yo'l yoqasi: shag'al va oyoq ostida qolgan o't
  if (rs > 0.001) { vec3 gc = mix(vec3(0.27, 0.24, 0.19), A * 1.15 + 0.03, 0.35) * (0.75 + 0.5 * F.b); A = mix(A, gc, rs * 0.85); H += rs * smoothstep(0.5, 0.15, F.b) * 0.015 * nearK * yKf(0.3); rough = mix(rough, 0.95, rs); spec = mix(spec, 0.3, rs); }
  A = mix(A, A * vec3(1.12, 1.05, 0.9), smoothstep(6.0, 1.5, rdE) * 0.35);
  // qoya (tik qiyalik): uch proyeksiya (normal bo'yicha — qiyalikda cho'zilmaydi), qatlamlar, yoriqlar, liken
  float redness = clamp(b0.w * 0.6 + b1.x, 0.0, 1.0);
  float rkN = 0.0;                                             // qoya yirik shovqini (qor chegarasi uchun)
  if (rk > 0.002) {
    // proyeksiya og'irligi haqiqiy uchburchak tekisligidan (uzoq LODda uch normali katta uchburchak qiyaligiga mos emas — tekstura cho'zilardi)
    vec3 ng = normalize(cross(yPx, yPy)); ng *= sign(dot(ng, nW)); vec3 an = normalize(mix(nW, ng, 0.8)); an *= an; an *= an; an /= dot(an, vec3(1.0));
    vec4 R = vec4(0.0); float rw = 0.0;
    if (an.x > 0.03) { R += an.x * textureGrad(tYN, wp.zy * 0.11, yPx.zy * 0.11, yPy.zy * 0.11); rw += an.x; }
    if (an.z > 0.03) { R += an.z * textureGrad(tYN, wp.xy * 0.11 + 0.37, yPx.xy * 0.11, yPy.xy * 0.11); rw += an.z; }
    if (an.y > 0.03) { R += an.y * textureGrad(tYN, wp.xz * 0.11 + 0.71, yPx.xz * 0.11, yPy.xz * 0.11); rw += an.y; }
    R /= max(rw, 1e-3);
    // yirik miqyos (≈45 m) faqat asosiy tekislikda: uzoqdan qoya bir xil kulrang 'mo'yna' bo'lmasin — yoriqlar, och/to'q bo'laklar
    vec2 pq = an.x > max(an.y, an.z) ? wp.zy : (an.z > an.y ? wp.xy : wp.xz); vec2 pqx = an.x > max(an.y, an.z) ? yPx.zy : (an.z > an.y ? yPx.xy : yPx.xz), pqy = an.x > max(an.y, an.z) ? yPy.zy : (an.z > an.y ? yPy.xy : yPy.xz);
    vec4 R2 = textureGrad(tYN, pq * 0.022 + 0.19, pqx * 0.022, pqy * 0.022); rkN = R2.r - 0.58;
    rk = clamp(rk + (R.r - 0.58) * 3.2 * rk * (1.0 - rk), 0.0, 1.0);
    // qatlamlar: yirik shovqin bilan egilgan, ekranda mayda bo'lsa o'rtachaga so'nadi
    float sb = wp.y * 0.3 + R.r * 0.35 + M.r * 6.0; float band = sin(sb * 6.2832) * 0.5 + 0.5; band = mix(band, 0.5, smoothstep(0.15, 0.5, (abs(yPx.y) + abs(yPy.y)) * 0.3));
    float rr = clamp((R.r - 0.58) * 1.6 + (R2.r - 0.58) * 2.4 + 0.5, 0.0, 1.0);
    vec3 grey = mix(vec3(0.21, 0.195, 0.175), vec3(0.39, 0.365, 0.325), rr * 0.85 + band * 0.15);
    grey = mix(grey, vec3(0.3, 0.31, 0.17), smoothstep(0.18, 0.04, R.b) * 0.45 * (1.0 - redness));
    vec3 red = mix(mix(vec3(0.32, 0.135, 0.065), vec3(0.45, 0.22, 0.11), smoothstep(0.25, 0.75, band)), vec3(0.5, 0.34, 0.21), smoothstep(0.88, 0.97, band) * 0.35) * (0.88 + 0.24 * rr);
    grey = mix(grey, grey * vec3(1.12, 1.0, 0.82), clamp(b0.x + b0.y + b0.z + b1.y + b1.z, 0.0, 1.0) * (1.0 - smoothstep(110.0, 160.0, wp.y)) * 0.8);   // o'tloq ostidagi qoya — tuproqli, iliqroq (ko'k osmonda ko'karmasin)
    vec3 rc = mix(grey, red, redness); rc = mix(rc, vec3(0.045, 0.042, 0.047) * (0.8 + 0.5 * R.r), b1.w);
    rc *= (1.0 - 0.45 * smoothstep(0.82, 0.95, R.g) * yKf(1.0)) * (1.0 - 0.4 * smoothstep(0.7, 0.9, R2.g)) * (0.88 + 0.24 * smoothstep(0.3, 0.7, R.a));
    rc *= 1.0 - 0.3 * smoothstep(${(T.SNOW_LO - 30).toFixed(1)}, ${T.SNOW_LO.toFixed(1)}, wp.y);   // baland tog'da qoya to'qroq — qor bilan aniq farq, shakl ko'rinsin
    A = mix(A, rc, rk); H = mix(H, (R.g * 0.3 + band * 0.06) * yKf(1.5), rk); rough = mix(rough, 0.82, rk); spec = mix(spec, 0.5, rk);
  }
  // qirg'oq: dengizda qum, ko'l/daryoda shag'al va loy; nam chiziq
  float sea = 1.0 - step(1.5, wl);
  float be = smoothstep(4.4, 1.6, wp.y + dN * 0.7) * sea * (1.0 - b1.w);
  if (be > 0.001) { vec3 sc = mix(vec3(0.5, 0.41, 0.26), vec3(0.64, 0.54, 0.35), D.r * 0.6 + m * 0.4) * (0.92 + 0.12 * F.a); A = mix(A, sc, be); float rp = sin((dot(p, vec2(0.3, 0.95)) / 0.5 + D.r * 4.0) * 6.2832) * (1.0 - smoothstep(0.2, 0.6, yFw(vec2(0.3, 0.95), 2.0))); H = mix(H, rp * 0.008 + F.b * 0.006 * yKf(0.3), be); rough = mix(rough, 0.9, be); spec = mix(spec, 0.45, be); }
  float pb = smoothstep(0.6, 0.05, aw + dN * 0.3) * (1.0 - sea);
  if (pb > 0.001) { float st = smoothstep(0.26, 0.1, F.b + (F.r - 0.58) * 0.9 + (D.r - 0.58) * 0.4) * nearK, bg = smoothstep(0.22, 0.06, D.b + (D.g - 0.41) * 0.3);
    vec3 pc = mix(vec3(0.18, 0.15, 0.11) * (0.85 + 0.3 * D.r), vec3(0.33, 0.31, 0.28) * (0.7 + 0.6 * F.a), st * 0.7 + 0.2 * (1.0 - nearK)); pc = mix(pc, vec3(0.3, 0.29, 0.26) * (0.85 + 0.3 * F.r), bg * 0.6);
    A = mix(A, pc, pb); H = mix(H, st * 0.008 * yKf(0.3), pb); rough = mix(rough, 0.8, pb); spec = mix(spec, 0.5, pb); }
  float wet = smoothstep(0.45, 0.02, aw + dN * 0.2 + fN * 0.06); yWet = wet;
  A = mix(A, A * vec3(0.5, 0.52, 0.56), wet * 0.85); rough = mix(rough, 0.32, wet * 0.9); spec = mix(spec, 1.0, wet);
  // qor: balandlik chizig'i, tik joyda kamroq; oq 0.8–0.85 (to'yinmasin — quyosh/soya tomoni shakl bersin), yaltirash
  float snow = yerSnow(wp.y, dNm * 0.22 + fN * 0.05 * nearK) * (1.0 - smoothstep(0.92, 1.08, slope + dNm * 0.25 + rkN * 0.9 + (rk - 0.5) * 0.2)) * (1.0 - smoothstep(0.05, 0.35, b1.w)); yS = snow;
  ySp = 0.0;
  if (snow > 0.001) { vec3 sc = mix(vec3(0.8, 0.82, 0.85), vec3(0.85, 0.86, 0.88), D.r) * (1.0 - 0.04 * smoothstep(0.0, 0.25, curv)); A = mix(A, sc, snow); H = mix(H, D.r * 0.018 * yKf(3.0) + F.r * 0.008 * nearK * yKf(0.5), snow); rough = mix(rough, 0.72, snow); spec = mix(spec, 0.45, snow);
    ySp = snow * smoothstep(14.0, 4.0, dist) * smoothstep(0.985, 0.998, fract(F.a * 41.0 + dot(normalize(cameraPosition - wp), vec3(7.1, 5.3, 6.7)))); }
  // uzoqdan qaraganda bir xil tus bo'lmasin: yirik yorug'lik/rang o'zgarishi
  A *= mix(0.88 + 0.24 * m2 + (M.b - 0.44) * 0.12, 1.0, snow * 0.8);
  yA = A; yR = rough; ySpec = spec; yH = H * mix(0.35, 1.0, midK);
  float veg = clamp(wgr + b0.y + b0.z - rk - rs - snow, 0.0, 1.0);
  yNf = ((Nf.rg * 2.0 - 1.0) * (0.18 - 0.1 * veg + 0.15 * be) + (Nf.ba * 2.0 - 1.0) * (pb * 0.4 + rs * 0.3)) * nearK * yKf(0.8) * (1.0 - stp * 0.85);
  yAO = mix(1.0 - clamp(curv * 1.6, 0.0, 0.3) + clamp(-curv, 0.0, 0.2) * 0.3, 1.0, snow * 0.6) * (1.0 - 0.5 * snow);   // qorda yoyilgan yorug'lik kamroq
}
// ob-havo (obhavo.js): uWet — nam yer/yo'l (to'qroq, yaltiroq) va tekis joyda ko'lmaklar (osmon aksi), uSnowC — yog'gan qor qoplami (qiyalikda va yo'l izlarida kamroq)
void yWx(vec3 wp, float road){
  float up = normalize(vWN).y;
  if (uWet > 0.003) {
    float pn = yTexL(tYN, wp.xz, 0.11, YR3, vec2(0.17, 0.61)).r;
    float pud = smoothstep(0.64 - 0.1 * uWet, 0.7 - 0.1 * uWet, pn + road * 0.05) * smoothstep(0.93, 0.985, up) * smoothstep(0.35, 0.9, uWet) * (1.0 - yS);
    float w = uWet * (1.0 - yS * 0.8);
    yA *= 1.0 - w * mix(0.3, 0.42, road); yR = mix(yR, mix(0.38, 0.2, road), w); ySpec = mix(ySpec, 1.0, w * 0.8);
    yA = mix(yA, yA * 0.55, pud); yR = mix(yR, 0.04, pud); ySpec = mix(ySpec, 1.0, pud); yH *= 1.0 - pud; yNf *= 1.0 - pud;
  }
  if (uSnowC > 0.003) {
    float n = yTexL(tYN, wp.xz, 0.05, YR2, vec2(0.4, 0.2)).r;
    float sn = smoothstep(0.25, 0.6, uSnowC * 1.25 + (n - 0.58) * 1.2) * smoothstep(0.45, 0.8, up) * (1.0 - road * 0.45);
    yA = mix(yA, vec3(0.8, 0.82, 0.86) * (0.95 + 0.1 * n), sn); yR = mix(yR, 0.72, sn); ySpec = mix(ySpec, 0.45, sn); yS = max(yS, sn); yAO = mix(yAO, 1.0, sn * 0.5);
  }
}
// Arzon yo'l (0-daraja): rang uchlarda hisoblanadi (yerLoV, vertex sheyderi), pikselda faqat bitta mayda tekstura — eski Lambert relyef narxida
void yerGroundLo(float dr){
  yA = vLo.rgb * mix(0.84 + 0.32 * dr, 1.0, vLo2.y * 0.8); yR = vLo.a; ySpec = vLo2.x; yS = vLo2.y; yWet = vLo2.z; yAO = vLo2.w;
  yH = 0.0; yNf = vec2(0.0); ySp = 0.0; yNear = 0.0; yDry = 0.0;
}
`;

// 0-daraja: arzon yer rangi uchlarda (har biom bitta formula, qoya/qor/qirg'oq oddiy aralashma); 1–2-darajada tarmoq o'tkazib yuboriladi
const VLO = `
uniform sampler2D tYN; uniform float uYQ; varying vec4 vLo; varying vec4 vLo2;
vec4 yTexV(vec2 p, float s, vec2 o, float fp){ return textureLod(tYN, p * s + o, max(0.0, log2(fp * s * 512.0))); }
void yerLoV(vec3 wp, vec3 nW, vec4 b0, vec4 b1, vec4 ax){
  float fp = max(length(cameraPosition - wp) * 0.0016, 8.0);
  float ws = dot(b0, vec4(1.0)) + dot(b1, vec4(1.0)); b0 /= max(ws, 0.01); b1 /= max(ws, 0.01);
  float slope = length(nW.xz) / max(nW.y, 0.05);
  vec4 M = yTexV(wp.xz, 0.0015625, vec2(0.31, 0.77), fp), D = yTexV(mat2(-0.67, 0.74, -0.74, -0.67) * wp.xz, 0.012, vec2(0.5), fp);
  float m = clamp((M.r - 0.58) * 2.6 + 0.5, 0.0, 1.0), dN = clamp((D.r - 0.58) * 2.6, -1.0, 1.0), curv = ax.w - 0.5;
  float wl = ax.x * 100.0 - 10.0, aw = wp.y - wl, rdE = ax.y * 40.0;
  float dry = clamp(m - curv * 1.4 + slope * 0.3, 0.0, 1.0);
  vec3 g = mix(mix(vec3(0.1, 0.155, 0.045), vec3(0.165, 0.2, 0.068), M.b), vec3(0.25, 0.215, 0.1), dry * dry * 0.6);
  g = mix(g, vec3(0.2, 0.15, 0.24), smoothstep(0.1, 0.5, ax.z) * 0.85);
  vec3 A = g * (b0.x + b1.y) + mix(vec3(0.17, 0.09, 0.04), vec3(0.34, 0.17, 0.06), D.r) * b0.y + mix(vec3(0.075, 0.115, 0.04), vec3(0.15, 0.105, 0.06), D.r) * b0.z
    + mix(vec3(0.45, 0.31, 0.16), vec3(0.6, 0.45, 0.25), m) * b0.w + mix(vec3(0.36, 0.15, 0.07), vec3(0.5, 0.27, 0.13), D.r) * b1.x + mix(vec3(0.33, 0.255, 0.11), vec3(0.45, 0.36, 0.16), m) * b1.z
    + mix(vec3(0.105, 0.098, 0.094), vec3(0.05, 0.047, 0.05), smoothstep(0.42, 0.7, D.r + (M.g - 0.4))) * b1.w;
  float veg = b0.x + b1.y + b0.y + b0.z + b1.z;
  float rough = mix(0.88, 1.0, veg), spec = mix(0.32, 0.05, veg);
  float rs = smoothstep(2.6, 0.2, rdE + dN * 1.1) * (1.0 - b1.w); A = mix(A, mix(vec3(0.27, 0.24, 0.19), A * 1.15 + 0.03, 0.35) * (0.8 + 0.4 * D.a), rs * 0.85);
  float stp = smoothstep(0.3, 0.75, slope), dNm = mix(dN, clamp((M.g - 0.41) * 2.2, -1.0, 1.0), stp), mr = clamp((M.r - 0.58) * 2.6 + 0.5, 0.0, 1.0);
  float redness = clamp(b0.w * 0.6 + b1.x, 0.0, 1.0), rkL = 0.35 * (b0.x + b0.y + b0.z + b1.y + b1.z) * (1.0 - smoothstep(110.0, 160.0, wp.y)), rk = smoothstep(0.62 + rkL, 1.05 + rkL, slope + dNm * 0.25 + (M.g - 0.41) * 0.35);
  vec3 rc = mix(mix(vec3(0.21, 0.205, 0.19), vec3(0.33, 0.32, 0.29), mr), mix(vec3(0.34, 0.15, 0.07), vec3(0.44, 0.21, 0.1), mr), redness);
  A = mix(A, mix(rc, vec3(0.045, 0.042, 0.047), b1.w), rk); spec = mix(spec, 0.5, rk);
  float sea = 1.0 - step(1.5, wl), be = smoothstep(4.4, 1.6, wp.y + dN * 0.7) * sea * (1.0 - b1.w); A = mix(A, mix(vec3(0.5, 0.41, 0.26), vec3(0.64, 0.54, 0.35), D.r), be);
  float pb = smoothstep(0.6, 0.05, aw + dN * 0.3) * (1.0 - sea); A = mix(A, vec3(0.22, 0.2, 0.17) * (0.8 + 0.4 * D.r), pb);
  float wet = smoothstep(0.45, 0.02, aw + dN * 0.2); A = mix(A, A * vec3(0.5, 0.52, 0.56), wet * 0.85); rough = mix(rough, 0.32, wet * 0.9); spec = mix(spec, 1.0, wet);
  float snow = smoothstep(0.44, 0.56, smoothstep(${T.SNOW_LO.toFixed(1)}, ${T.SNOW_HI.toFixed(1)}, wp.y + (M.r - 0.55) * 42.0) + dNm * 0.22) * (1.0 - smoothstep(0.92, 1.08, slope + dNm * 0.25 + (rk - 0.5) * 0.2)) * (1.0 - smoothstep(0.05, 0.35, b1.w));
  A = mix(A, mix(vec3(0.8, 0.82, 0.85), vec3(0.85, 0.86, 0.88), D.r), snow); rough = mix(rough, 0.72, snow); spec = mix(spec, 0.45, snow);
  A *= mix(0.9 + (M.b - 0.44) * 0.3, 1.0, snow * 0.8);
  vLo = vec4(A, rough); vLo2 = vec4(spec, snow, wet, (1.0 - clamp(curv * 1.6, 0.0, 0.3)) * (1.0 - 0.5 * snow));
}
`;
// Material yamog'i: kind 0 — relyef, 1 — yo'l, 2 — ko'prik yog'ochi
const VDECL = ['attribute vec4 aB0; attribute vec4 aB1; attribute vec4 aAx; varying vec4 vB0; varying vec4 vB1; varying vec4 vAx; varying vec3 vWP; varying vec3 vWN;\n' + VLO,
  'attribute vec4 aB0; attribute vec4 aB1; attribute vec4 aAx; attribute vec4 aRd; varying vec4 vB0; varying vec4 vB1; varying vec4 vAx; varying vec4 vRd; varying vec3 vWP; varying vec3 vWN;\n' + VLO,
  'attribute vec3 aGr; varying vec3 vGr; varying vec3 vWP; varying vec3 vWN;\n'];
const VSET = ['vB0 = aB0; vB1 = aB1; vAx = aAx; if (uYQ < 0.5) yerLoV(vWP, vWN, aB0, aB1, aAx); else { vLo = vec4(0.0); vLo2 = vec4(0.0); }', 'vB0 = aB0; vB1 = aB1; vAx = aAx; vRd = aRd; if (uYQ < 0.5) yerLoV(vWP, vWN, aB0, aB1, aAx); else { vLo = vec4(0.0); vLo2 = vec4(0.0); }', 'vGr = aGr;'];
const FDECL = ['varying vec4 vB0; varying vec4 vB1; varying vec4 vAx; varying vec4 vLo; varying vec4 vLo2;\n', 'varying vec4 vB0; varying vec4 vB1; varying vec4 vAx; varying vec4 vRd; varying vec4 vLo; varying vec4 vLo2;\n', 'varying vec3 vGr; vec4 vLo; vec4 vLo2;\n'];
// yo'l sirti: u — ko'ndalang (m), v — bo'ylama (m); asosiy yo'l — eskirgan qishloq asfalti, dala yo'li — ikki iz, o'rtada o't.
// yFu/yFv — u va v ning ekran izi (m/piksel), shartli tarmoqdan oldin bir marta hisoblanadi
const ROAD = `
float yFu; float yFv;
float yRoadSand(vec3 wp){ return clamp(vB0.w * 1.2 + vB1.z * 0.35 + smoothstep(4.0, 2.0, wp.y) * (1.0 - step(1.5, vAx.x * 100.0 - 10.0)), 0.0, 1.0); }
float yRoad(vec3 wp, vec3 nW, float dist, out vec3 rA, out float rR, out float rH){
  float u = vRd.x, v = vRd.y, au = abs(u), endD = abs(vRd.w), track = step(0.5, vRd.z);
  float hw = mix(5.0, 3.3, track);
  vec2 p = wp.xz;
  vec4 D = yTex(tYN, p, 0.21, YR4, vec2(0.7, 0.1));            // 4.8 m
  vec4 F = yTex(tYN, p, 4.3, YR1, vec2(0.33, 0.6));             // 0.23 m — tosh donlari
  vec2 lq = vec2(0.013, 0.09);                                   // yo'l bo'ylab cho'zilgan
  vec4 L = textureGrad(tYN, vec2(v, u) * lq + 0.27, vec2(dFdx(v), dFdx(u)) * lq, vec2(dFdy(v), dFdy(u)) * lq);
  L = mix(L, D, 1.0 - smoothstep(9.0, 22.0, abs(vRd.w)));        // chorrahada yo'lga bog'liq naqsh yo'q — ustma-ust lentalar bir xil chizilsin
  float fG = fwidth(F.g);
  float nearK = yNear;
  float mk = smoothstep(9.0, 22.0, endD);                         // chorrahada belgilar yo'q
  float sand = yRoadSand(wp);
  float m = 0.0; vec3 c = vec3(0.0); float rough = 0.9, H = 0.0;
  vec3 dirt = vColor * vec3(0.78, 0.74, 0.7);
  if (track < 0.5) {
    // asfalt chegarasi uvalangan, keyin shag'al yoqa
    float jn = 1.0 - mk;                                           // chorraha yaqini: yo'llar ustma-ust — sirt faqat dunyo koordinatasiga bog'liq bo'lsin
    float edge = mix(hw - 0.15 + (L.r - 0.58) * 0.9 + (D.b - 0.44) * 0.3, hw + 1.8, jn * jn);
    float asp = 1.0 - smoothstep(edge - 0.06, edge + 0.06, au);
    float lane = abs(au - hw * 0.5);                              // bo'lak o'rtasigacha
    float wheel = smoothstep(0.55, 0.25, abs(lane - 0.85)) * mk;  // g'ildirak izlari
    vec3 ac = vec3(0.1, 0.095, 0.085) * (0.82 + 0.36 * L.r) * (0.9 + 0.2 * D.r);
    ac = mix(ac, vec3(0.19, 0.18, 0.165), smoothstep(0.62, 0.8, F.b) * 0.25 + (F.a - 0.5) * 0.7);   // ochiq tosh donlari
    ac = mix(ac, ac * 0.72, wheel * 0.55);                                                         // silliqlangan izlar
    ac = mix(ac, vec3(0.07, 0.068, 0.066), smoothstep(0.35, 0.05, lane) * 0.3);                    // moy tomchilari chizig'i
    ac *= 1.0 + smoothstep(0.65, 0.9, au / hw) * 0.18 * (1.0 - wheel) * mk;                        // chetlari changli, och
    // yamoqlar (to'rtburchak, to'qroq)
    float pid = floor(v / 7.3), ph = yHash(vec2(pid, 3.1));
    float pu0 = (yHash(vec2(pid, 7.7)) - 0.5) * hw * 1.4, pw = 0.8 + yHash(vec2(pid, 1.9)) * 1.8;
    float rpat = step(0.8, ph) * mk * (1.0 - smoothstep(pw - 0.05, pw + 0.05, abs(u - pu0))) * (1.0 - smoothstep(0.42, 0.48, abs(fract(v / 7.3) - 0.5) * (1.0 + ph)));
    ac = mix(ac, vec3(0.06, 0.06, 0.058) * (0.9 + 0.2 * F.r), rpat * 0.85);
    // yoriqlar — ingichka (1–2 sm), ekranda piksel izidan mayda bo'lsa xiralashib yo'qoladi (yLineF): ko'ndalang, bo'ylama, chetda to'rsimon
    float tv = v / 9.0 + (L.g - 0.4) * 0.6 + (F.r - 0.58) * 0.006;
    float tcr = yLineF((fract(tv) - 0.5) * 9.0, 0.0, 0.007 + 0.012 * D.r, yFv) * step(0.55, yHash(vec2(floor(tv), 5.3))) * smoothstep(0.3, 0.5, D.g) * smoothstep(0.3, 0.5, L.b + (D.a - 0.5) * 0.8);
    float cr = max(tcr, yLineF(u, (L.b - 0.44) * 0.8 + (F.r - 0.58) * 0.04, 0.012, yFu) * smoothstep(0.5, 0.62, L.g) * 0.7) * mk;
    float ed = smoothstep(hw - 1.4, hw - 0.3, au) * smoothstep(0.3, 0.6, D.g) * (1.0 - smoothstep(0.012, 0.04, yFp));
    cr = max(cr, ed * smoothstep(0.9 - fG, 0.9 + fG, F.g) * min(1.0, 0.04 / max(fG, 1e-4)));
    cr *= 1.0 - rpat * 0.8;
    ac = mix(ac, vec3(0.035, 0.034, 0.033), cr * 0.6);
    // bo'yoq: o'rtadagi uzuq chiziq va chetdagi chiziqlar — yuvilgan
    float paintWear = smoothstep(0.3, 0.7, F.r * 0.4 + D.a * 0.5 + L.r * 0.4 - 0.15) * mk;
    float cl = yLineF(u, 0.0, 0.12, yFu) * step(fract(v / 12.0), 0.33);
    float el = yLineF(au, hw - 0.45, 0.12, yFu);
    float paint = max(cl, el) * paintWear * (1.0 - rpat) * (1.0 - smoothstep(0.1, 0.5, yS));
    ac = mix(ac, vec3(0.5, 0.49, 0.45), paint * 0.7);
    // shag'al yoqa
    vec3 gv = mix(dirt, vec3(0.3, 0.28, 0.25), 0.35) * (0.7 + 0.6 * F.b) * (0.9 + 0.2 * D.r);
    c = mix(gv, ac, asp);
    rough = mix(0.95, mix(0.88, 0.62, wheel) - paint * 0.15, asp);
    H = mix(F.b * 0.02 * yKf(0.25), -rpat * 0.004 * yKf(0.5) + F.a * 0.003 * yKf(0.05), asp);
    m = 1.0 - smoothstep(hw + 0.12 + jn * jn * 2.0, hw + 0.42 + jn * jn * 2.0, au + (D.b - 0.44) * 0.35);
    // qor: siqilgan qor, izlarda asfalt va loy
    float sn = yS * (1.0 - wheel * smoothstep(0.3, 0.7, D.r + F.r * 0.3) * 0.85);
    c = mix(c, mix(vec3(0.72, 0.74, 0.78), vec3(0.82, 0.84, 0.87), D.r), sn); c = mix(c, vec3(0.16, 0.15, 0.14), yS * wheel * 0.35);
    rough = mix(rough, 0.6, yS);
    // qum bosgan joylar (cho'l, sohil): yupqa qum pardasi + izlardan tashqarida qum uyumlari
    c = mix(c, mix(vec3(0.5, 0.38, 0.22), vec3(0.62, 0.5, 0.31), D.r), sand * (0.3 + 0.4 * sand) * (1.0 - wheel * 0.2));   // cho'lda asfalt ochiq joyida ham chang bosgan
    float sd = sand * smoothstep(0.84, 0.56, D.r * 0.4 + L.r * 0.8 - smoothstep(hw - 2.5, hw, au) * 0.55 - (1.0 - sand) * 0.5 + wheel * 0.25);
    c = mix(c, mix(vec3(0.5, 0.38, 0.22), vec3(0.62, 0.5, 0.31), D.r), sd); rough = mix(rough, 0.92, sd); H = mix(H, F.r * 0.01 * yKf(0.25), sd);
  } else {
    // dala yo'li: ikki iz, o'rtada va chetlarda o't
    float rut = smoothstep(0.42, 0.16, abs(au - 0.88 + (L.r - 0.58) * 0.25));
    float bed = 1.0 - smoothstep(1.55, 2.0, au + (D.r - 0.58) * 1.3 + (L.g - 0.41) * 0.6);   // shibbalangan tuproq kengligi
    float mid = smoothstep(0.55, 0.2, au + (D.b - 0.44) * 0.5);                               // o'rtadagi o't yo'lagi
    vec3 dc = dirt * (0.8 + 0.4 * D.r) * (0.75 + 0.5 * F.b);
    dc = mix(dc, dc * 0.72, rut * 0.6);
    dc = mix(dc, vec3(0.3, 0.29, 0.26) * (0.6 + 0.8 * F.b), smoothstep(0.5, 0.75, F.b) * 0.35 * (1.0 - rut));   // shag'al
    c = dc; rough = mix(0.95, 0.85, rut); H = (-rut * 0.04 + F.b * 0.015 * (1.0 - rut)) * yKf(0.25);
    m = bed * (1.0 - mid * 0.85) * (1.0 - smoothstep(hw - 0.4, hw + 0.3, au));
    float sn = yS * (1.0 - rut * 0.75); c = mix(c, mix(vec3(0.8, 0.82, 0.85), vec3(0.85, 0.86, 0.88), D.r), sn); c = mix(c, vec3(0.2, 0.18, 0.15), yS * rut * 0.5); rough = mix(rough, 0.72, yS);
    float sd = sand * smoothstep(0.6, 0.35, D.r * 0.8 + L.r * 0.4 - (1.0 - sand) * 0.5); c = mix(c, vec3(0.56, 0.44, 0.27) * (0.9 + 0.2 * D.r), sd * 0.8);
  }
  if (vRd.w < 0.0) m *= smoothstep(1.0, 9.0, endD);               // berk ko'cha uchi yer bilan qo'shiladi
  rA = c; rR = rough; rH = H;
  return m;
}
// arzon yo'l (0-daraja): bitta tekstura, asfalt + bo'yoq + yoqa, dala yo'li izlari
float yRoadLo(vec3 wp, out vec3 rA, out float rR, out float dr){
  float u = vRd.x, v = vRd.y, au = abs(u), endD = abs(vRd.w), track = step(0.5, vRd.z);
  float hw = mix(5.0, 3.3, track);
  vec4 D = yTexL(tYN, wp.xz, 0.21, YR4, vec2(0.7, 0.1)); dr = D.r;
  float mk = smoothstep(9.0, 22.0, endD), jn = 1.0 - mk, sand = yRoadSand(wp), m, rough;
  vec3 dirt = vColor * vec3(0.78, 0.74, 0.7) * (0.8 + 0.4 * D.r), c;
  if (track < 0.5) {
    float edge = mix(hw - 0.15 + (D.b - 0.44) * 0.6, hw + 1.8, jn * jn), asp = 1.0 - smoothstep(edge - 0.1, edge + 0.1, au);
    float wheel = smoothstep(0.55, 0.25, abs(abs(au - hw * 0.5) - 0.85)) * mk;
    vec3 ac = vec3(0.1, 0.095, 0.085) * (0.85 + 0.3 * D.r); ac = mix(ac, ac * 0.75, wheel * 0.5);
    float paint = max(yLineF(u, 0.0, 0.12, yFu) * step(fract(v / 12.0), 0.33), yLineF(au, hw - 0.45, 0.12, yFu)) * mk * smoothstep(0.3, 0.6, D.a + 0.15) * (1.0 - smoothstep(0.1, 0.5, yS));
    ac = mix(ac, vec3(0.5, 0.49, 0.45), paint * 0.7);
    c = mix(mix(dirt, vec3(0.3, 0.28, 0.25), 0.35), ac, asp); rough = mix(0.95, 0.85, asp);
    m = 1.0 - smoothstep(hw + 0.12 + jn * jn * 2.0, hw + 0.42 + jn * jn * 2.0, au + (D.b - 0.44) * 0.35);
    c = mix(c, mix(vec3(0.72, 0.74, 0.78), vec3(0.82, 0.84, 0.87), D.r), yS * (1.0 - wheel * 0.7));
    c = mix(c, vec3(0.56, 0.44, 0.27), sand * (0.2 + 0.35 * sand + 0.6 * smoothstep(0.82, 0.58, D.r * 1.2 - smoothstep(hw - 2.5, hw, au) * 0.55 - (1.0 - sand) * 0.5 + wheel * 0.25)));
  } else {
    float rut = smoothstep(0.42, 0.16, abs(au - 0.88)), mid = smoothstep(0.55, 0.2, au + (D.b - 0.44) * 0.5);
    c = mix(dirt, dirt * 0.72, rut * 0.6); rough = 0.92;
    m = (1.0 - smoothstep(1.55, 2.0, au + (D.r - 0.58) * 1.3)) * (1.0 - mid * 0.85) * (1.0 - smoothstep(hw - 0.4, hw + 0.3, au));
    c = mix(c, vec3(0.82, 0.84, 0.86), yS * (1.0 - rut * 0.75)); c = mix(c, vec3(0.56, 0.44, 0.27), sand * 0.5);
  }
  if (vRd.w < 0.0) m *= smoothstep(1.0, 9.0, endD);
  rA = c; rR = rough;
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
  rough = 0.86; H = (grain * 0.004 - knot * 0.003) * yKf(0.05);
}
`;
// yo'l: avval yo'l sirti, yer faqat yo'l yerga qo'shiladigan chetlarda hisoblanadi (rm < 1). uYQ — bir xil (uniform) shart: hosilalar xavfsiz
const FMAIN = [
  `yerBegin(vWP); vec3 yN0 = normalize(vWN); float yDist = length(cameraPosition - vWP); vec3 yNW = yN0;
  if (uYQ > 0.5) { yerBeginHi(vWP); yerGround(vWP, yN0, yDist, vB0, vB1, vAx); yWx(vWP, 0.0); yNW = normalize(yerBump(yN0, yH * yGraze(yN0)) + vec3(yNf.x, 0.0, yNf.y)); }
  else { yerGroundLo(yTexL(tYN, vWP.xz, 0.077, YR2, vec2(0.5)).r); yWx(vWP, 0.0); }
  diffuseColor.rgb = yA;
`,
  `yerBegin(vWP); vec3 yN0 = normalize(vWN); float yDist = length(cameraPosition - vWP); vec3 yNW = yN0;
  yFu = abs(dFdx(vRd.x)) + abs(dFdy(vRd.x)); yFv = abs(dFdx(vRd.y)) + abs(dFdy(vRd.y));
  yNear = 1.0 - smoothstep(12.0, 55.0, yDist);
  { vec3 rA; float rR, rH = 0.0, rm;
    if (uYQ > 0.5) {
      yerBeginHi(vWP); yS = yerSnow(vWP.y, 0.0) * (1.0 - vB1.w / max(dot(vB0, vec4(1.0)) + dot(vB1, vec4(1.0)), 0.01));
      rm = yRoad(vWP, yN0, yDist, rA, rR, rH);
      if (rm < 0.999) yerGround(vWP, yN0, yDist, vB0, vB1, vAx); else { yA = rA; yR = rR; yH = rH; yNf = vec2(0.0); ySp = 0.0; yAO = 1.0; ySpec = 0.5; }
    } else {
      yS = vLo2.y; float dr; rm = yRoadLo(vWP, rA, rR, dr);
      if (rm < 0.999) yerGroundLo(dr); else { yA = rA; yR = rR; yH = 0.0; yNf = vec2(0.0); ySp = 0.0; yAO = 1.0; ySpec = 0.5; }
    }
    yA = mix(yA, rA, rm); yR = mix(yR, rR, rm); ySpec = mix(ySpec, mix(0.5, 0.45, yS), rm); yH = mix(yH, rH, rm); yNf *= 1.0 - rm * 0.7; ySp *= 1.0 - rm; yAO = mix(yAO, 1.0, rm); yWx(vWP, rm); }
  if (uYQ > 0.5) yNW = normalize(yerBump(yN0, yH * yGraze(yN0)) + vec3(yNf.x, 0.0, yNf.y));
  diffuseColor.rgb = yA;
`,
  `yerBegin(vWP); yerBeginHi(vWP); vec3 yN0 = normalize(vWN); float yWH; yR = 0.86; ySp = 0.0; yAO = 1.0; ySpec = 0.6; vec3 yNW = yN0;
  yWood(vWP, yN0, diffuseColor.rgb, yR, yWH);
  if (uYQ > 0.5) yNW = yerBump(yN0, yWH);
`];
function patch(sh, kind) {
  for (const k in YER.U) sh.uniforms[k] = YER.U[k];
  sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\n' + VDECL[kind])
    .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz; vWN = normalize(mat3(modelMatrix) * objectNormal); ' + VSET[kind] + '\n');
  sh.fragmentShader = '#define LK_NO_WX\n' + sh.fragmentShader.replace('#include <clipping_planes_pars_fragment>', '#include <clipping_planes_pars_fragment>\n' + FDECL[kind] + GLSL + (kind === 1 ? ROAD : kind === 2 ? WOOD : '') + '\n')
    .replace('#include <color_fragment>', '#include <color_fragment>\n' + FMAIN[kind] + '\n')
    .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = yR;\n')
    .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\nnormal = normalize((viewMatrix * vec4(yNW, 0.0)).xyz);\n')
    // 0-darajada osmon aksi (IBL, ~8 kub tekstura so'rovi) hisoblanmaydi: o'rniga yarim shar yorug'ligi kuchaytiriladi
    .replace('#include <lights_fragment_maps>', 'if (uYQ > 0.5) {\n#include <lights_fragment_maps>\n} else { iblIrradiance += irradiance * uYEnvLo; }\n')
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
  m.onBeforeRender = function (r, scene) { if (scene.environment !== this.envMap) this.envMap = scene.environment; this.envMapIntensity = YER.envK; if (!YER.qSet) YER.U.uYQ.value = r.getRenderTarget() ? 2 : 0; }; // sifat: setQuality() chaqirilmaguncha — kompozitorsiz (0-daraja) kadrda arzon yo'l
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
  const h = T.grid.h, gd = gridData();
  const V = CH + 1;
  const lodIdx = STEPS.map(lodIndex);
  const chunks = [];
  for (let cj = 0; cj < N; cj += CH) for (let ci = 0; ci < N; ci += CH) {
    let maxH = -1e9, minH = 1e9;
    for (let j = 0; j <= CH; j += 5) for (let i = 0; i <= CH; i += 5) { const v = h[(cj + j) * NV + ci + i]; if (v > maxH) maxH = v; if (v < minH) minH = v; }
    if (maxH < -9) continue;
    const nv = V * V + 4 * V;
    const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3);
    const b0 = new Uint8Array(nv * 4), b1 = new Uint8Array(nv * 4), ax = new Uint16Array(nv * 4);
    for (let j = 0; j <= CH; j++) for (let i = 0; i <= CH; i++) {
      const gi = ci + i, gj = cj + j, k = gj * NV + gi, o = (j * V + i) * 3;
      const x = -HALF + gi * CELL, z = -HALF + gj * CELL;
      pos[o] = x; pos[o + 1] = h[k]; pos[o + 2] = z;
      const hl = h[gj * NV + Math.max(0, gi - 1)], hr = h[gj * NV + Math.min(N, gi + 1)], hu = h[Math.max(0, gj - 1) * NV + gi], hd = h[Math.min(N, gj + 1) * NV + gi];
      let nx = -(hr - hl) / (2 * CELL), nz = -(hd - hu) / (2 * CELL); const l = Math.hypot(nx, 1, nz);
      nor[o] = nx / l; nor[o + 1] = 1 / l; nor[o + 2] = nz / l;
      gAttr(x, z, Math.hypot(nx, nz), gd.rdE[k], gd.lap[k], T.waterY(x, z), b0, b1, ax, (j * V + i) * 4);
    }
    const S0 = V * V;
    const skirt = (dst, src) => { const d = (S0 + dst) * 3, s = src * 3; pos[d] = pos[s]; pos[d + 1] = pos[s + 1] - 14; pos[d + 2] = pos[s + 2]; nor[d] = nor[s]; nor[d + 1] = nor[s + 1]; nor[d + 2] = nor[s + 2];
      const d4 = (S0 + dst) * 4, s4 = src * 4; for (let q = 0; q < 4; q++) { b0[d4 + q] = b0[s4 + q]; b1[d4 + q] = b1[s4 + q]; ax[d4 + q] = ax[s4 + q]; } };
    for (let k = 0; k < V; k++) { skirt(k, k); skirt(V + k, CH * V + k); skirt(2 * V + k, k * V); skirt(3 * V + k, k * V + CH); }
    const pa = new THREE.BufferAttribute(pos, 3), na = new THREE.BufferAttribute(nor, 3);
    const ba0 = new THREE.BufferAttribute(b0, 4, true), ba1 = new THREE.BufferAttribute(b1, 4, true), axa = new THREE.BufferAttribute(ax, 4, true);
    const cx = -HALF + (ci + CH / 2) * CELL, cz = -HALF + (cj + CH / 2) * CELL;
    const sphere = new THREE.Sphere(new THREE.Vector3(cx, (maxH + minH) / 2, cz), Math.hypot(CH * CELL * 0.71, (maxH - minH) / 2 + 20));
    const geos = lodIdx.map((ix) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', pa); g.setAttribute('normal', na); g.setAttribute('aB0', ba0); g.setAttribute('aB1', ba1); g.setAttribute('aAx', axa); g.setIndex(ix); g.boundingSphere = sphere; return g; });
    const m = new THREE.Mesh(geos[0], YER.terrain);
    m.receiveShadow = true; m.matrixAutoUpdate = false; m.updateMatrix();
    group.add(m);
    chunks.push({ mesh: m, geos, cx, cz, lod: 0 });
  }
  scene.add(group);
  const api = {
    group, chunks, mat: YER.terrain, yer: YER,
    update(cam) {
      const px = cam.position.x, pz = cam.position.z;
      for (let i = 0; i < chunks.length; i++) {
        const c = chunks[i]; const d = Math.hypot(c.cx - px, c.cz - pz);
        const lod = d < 800 ? 0 : d < 1900 ? 1 : 2;
        if (lod !== c.lod) { c.lod = lod; c.mesh.geometry = c.geos[lod]; }
      }
    },
    setQuality(q) { YER.qSet = true; YER.U.uYQ.value = q; },
  };
  return api;
}

// Yo'l rangi biom bo'yicha (shag'al yoqa va dala yo'li tuprog'i)
const RC = [hexLin(0xb79d7a), hexLin(0xa88a68), hexLin(0x9d8c74), hexLin(0xcda468), hexLin(0xb06d4b), null, null, hexLin(0xc2a98a), hexLin(0xc4a36a), hexLin(0x5c5856)];
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
    // ko'rinadigan lenta ko'tarilishi turi bo'yicha bir xil (chorrahada pog'ona yo'q), qo'shni lentalar 4 mm farq — bir tekislikda miltillamasin; lift0 — ko'prik/to'siqlar uchun (o'zgarmagan)
    const lift0 = 0.02 + e.id * 0.003, lift = (e.type === 0 ? 0.05 : 0.03) + (e.id % 3) * 0.004;
    const hw = e.hw;
    const offs = e.type === 0 ? [-hw - 1.4, -hw - 0.7, -hw, -hw * 0.5, 0, hw * 0.5, hw, hw + 0.7, hw + 1.4] : [-hw - 1.2, -hw - 0.6, -hw, -1.2, 0, 1.2, hw, hw + 0.6, hw + 1.2];
    const drop = [0.65, 0.3, 0, 0, 0, 0, 0, 0.3, 0.65], NO = offs.length;
    // asosiy yo'l faqat dala yo'llari tutashgan tugunda tugasa — berk uch kabi yerga qo'shiladi (to'rtburchak plita bo'lib qolmasin)
    const onlyTracks = (n) => e.type === 0 && R.nodes[n].edges.every((ei) => ei === e.id || R.edges[ei].type !== 0);
    const deadA = deg[e.a] <= 1 || onlyTracks(e.a), deadB = deg[e.b] <= 1 || onlyTracks(e.b);
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
        const tap = endW <= 0 ? 0.12 + 0.88 * smoothstep(0, 16, -endW) : 1; // berk uchda lenta torayib yopiladi (to'rtburchak plita yo'q)
        for (let q = 0; q < NO; q++) {
          const v = r * NO + q, o = v * 3, o4 = v * 4, oq = offs[q] * tap, px = x + lx * oq, pz = z + lz * oq;
          pos[o] = px; pos[o + 1] = y - drop[q] * (1 + jf * 2.5); pos[o + 2] = pz;
          const inner = hw - 0.4, wq = drop[q] > 0 ? (drop[q] > 0.5 ? 1 : 0.5) : (e.type ? 0.85 : clamp((Math.abs(offs[q]) - inner) / 1.2, 0, 1) * 0.7) * (1 - jf); // yer ko'rinadigan qismda normal yernikiga yaqin (yorug'lik farqi bo'lmasin)
          if (wq > 0) { const t = terrN(px, pz), w = wq; let nx = lerp(rnx, t[0], w), ny = lerp(rny, t[1], w), nz = lerp(rnz, t[2], w); const l = Math.hypot(nx, ny, nz); nor[o] = nx / l; nor[o + 1] = ny / l; nor[o + 2] = nz / l; }
          else { nor[o] = rnx; nor[o + 1] = rny; nor[o + 2] = rnz; }
          cl[o] = c[0]; cl[o + 1] = c[1]; cl[o + 2] = c[2];
          rd[o4] = oq; rd[o4 + 1] = s; rd[o4 + 2] = e.type; rd[o4 + 3] = endW === 0 ? -0.001 : endW;
          const gi = clamp(Math.round((px + HALF) / CELL), 0, N), gj = clamp(Math.round((pz + HALF) / CELL), 0, N);
          gAttr(px, pz, 0, Math.max(0, Math.abs(oq) - hw) + (e.type ? 2.2 : 0), gd.lap[gj * NV + gi], T.waterY(px, pz), b0, b1, ax, o4);
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
  GD = null; // yo'l chetigacha / egrilik panjaralari endi kerak emas (relyef avval quriladi)
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
