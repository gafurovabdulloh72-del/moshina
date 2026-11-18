// Kuchli grafika: o'z HDR quvuri (sahna → chuqurlik teksturasi bilan HDR nishon → SSAO, nur ustunlari, bloom, tone mapping, rang, dither, keskinlik),
// suv (kamera ortidan yuruvchi to'r, Gerstner to'lqinlari, osmon aksi, quyosh yo'lakchasi, sayozlik rangi, ko'pik, kaustika), relyef teksturasi, osmon aksi (PMREM).
import * as THREE from 'three';
import { FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';
import * as T from './terrain.js';
import { MAT, WIND } from './geo.js';
import { TEX } from './tex.js';

const NOISE = `
float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), f.x), f.y); }`;

// ---------- suv sheyderi (KIND: 0 dengiz, 1 ko'l, 2 daryo; uQ — sifat darajasi: pastida qimmat qismlar tashlab ketiladi) ----------
const WATER_VS = `uniform float uTime; uniform float uAmp; uniform vec4 uW[6]; uniform vec4 uWs[6]; uniform vec2 uSp; uniform float uLow; uniform float uQ; uniform sampler2D tNoise;
varying vec3 vW; varying vec3 vN; varying vec4 vM; varying float vJ;
#if KIND == 2
attribute vec4 aRiv; varying vec4 vRiv;
#endif
#include <fog_pars_vertex>
void main(){
  vec4 wp = modelMatrix * vec4(position, 1.0); vN = vec3(0.0, 1.0, 0.0); vM = vec4(1.0, 1.0, 1.0, 0.0); vJ = 1.0;
#if KIND == 0
  // Gerstner: uchidagi to'r siyrak — har cho'qqi faqat to'r qadamidan ancha uzun to'lqinni oladi (to'lqin "suzmaydi").
  // To'lqin juftlarining balandligi katta dog'lar bo'yicha o'zgaradi (bir xil parallel chiziqlar bo'lmasin); past kamera atrofida to'lqin so'nadi (cho'qqi kameradan oshmasin)
  float sp = length(modelMatrix[0].xyz) * (uSp.x * length(position.xz) + uSp.y);
  // to'r qadami eng uzun to'lqindan (64 m) 5 baravar kalta bo'lmasa (≈200 m dan nari) to'lqin yo'q — hisob tashlab ketiladi; 0-darajada (LOW) faqat 3 ta eng uzun to'lqin, shovqinsiz
  float ma = 1.0, mb = 1.0, dmp = 1.0; vec3 off = vec3(0.0), N = vec3(0.0, 1.0, 0.0); float jac = 1.0, hgt = 0.0;
  if (uAmp > 0.0 && sp < 12.8) {
#if !LOW
    vec2 m = textureLod(tNoise, wp.xz * 0.0011 + uTime * vec2(0.0011, 0.0007), 2.0).rg; ma = clamp(m.r * 2.3 - 0.6, 0.3, 1.45); mb = clamp(m.g * 1.5 + 0.3, 0.3, 1.45);
#endif
    dmp = mix(1.0, smoothstep(5.0, 28.0, length(wp.xz - cameraPosition.xz)), uLow);
    for (int i = 0; i < (LOW == 1 ? 3 : 6); i++){ vec4 w = uW[i], s = uWs[i]; float A = w.w * uAmp * dmp * (i == 0 || i == 2 || i == 4 ? ma : mb) * clamp(s.w / (5.0 * sp) - 1.0, 0.0, 1.0);
      float th = w.z * dot(w.xy, wp.xz) - s.y * uTime + s.z, c = cos(th), sn = sin(th), wa = w.z * A;
      off += vec3(s.x * A * w.x * c, A * sn, s.x * A * w.y * c); N.x -= w.x * wa * c; N.z -= w.y * wa * c; N.y -= s.x * wa * sn; jac -= s.x * wa * sn; hgt += A * sn; } }
  wp.xyz += off; vN = N; vM = vec4(ma, mb, dmp, hgt); vJ = jac;
#endif
#if KIND == 2
  vRiv = aRiv;
#endif
  vW = wp.xyz; vec4 mvPosition = viewMatrix * wp; gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;
const WATER_FS = `uniform sampler2D tH; uniform sampler2D tNoise; uniform sampler2D tNrm; uniform float uTime; uniform float uAmp; uniform float uRough; uniform float uQ; uniform float uGlint; uniform vec3 uAbs; uniform vec3 uBed; uniform vec3 uShore; uniform float uFoamK; uniform float uFoamD; uniform float uNrmK; uniform float uNS; uniform float uDeepD; uniform float uCaus;
uniform vec3 uSunDir; uniform vec3 uGlintDir; uniform vec3 uSunCol; uniform vec3 uSkySun; uniform vec3 uAmb; uniform vec3 uTop; uniform vec3 uHor; uniform vec3 uDeep; uniform vec3 uShallow; uniform vec4 uMap; uniform vec4 uW[6]; uniform vec4 uWs[6];
varying vec3 vW; varying vec3 vN; varying vec4 vM; varying float vJ;
#if KIND == 2
varying vec4 vRiv;
#endif
#include <fog_pars_fragment>
// 0–1-darajada izotrop mip (textureLod): umumiy teksturalarning anizotrop filtri (×8) arzon videokartada qimmat; gLp — piksel o'lchamining log2 (512² tekstura, 1 m = 1 birlik)
float gLp = 0.0;
vec2 nrm2(vec2 uv, float s){ vec2 n; if (uQ < 1.5) n = textureLod(tNrm, uv, max(gLp + log2(s), 0.0)).rg; else n = texture2D(tNrm, uv).rg; return n * 2.0 - 1.0; }
float p5(float x){ float x2 = x * x; return x2 * x2 * x; }
vec3 skyCol(vec3 d){ float h = clamp(d.y, 0.0, 1.0), g = 1.0 - h, g2 = g * g, g4 = g2 * g2; vec3 c = mix(uHor, uTop, sqrt(h)) + uHor * (0.16 * g4 * g4 * g); float sd = max(dot(d, uGlintDir), 0.0), s4 = sd * sd; s4 *= s4; float s16 = s4 * s4; s16 *= s16; return c + uSkySun * (s4 * sd * 0.24 + s16 * s16 * s16 * s4 * s4 * s4 * 0.5); }
void main(){
  vec2 p = vW.xz; float t = uTime;
  { vec2 dx = dFdx(p), dy = dFdy(p); gLp = log2(max(max(dot(dx, dx), dot(dy, dy)), 1e-12)) * 0.5 + 8.5; }
  vec3 dV = cameraPosition - vW; float dist = length(dV); vec3 V = dV / dist;
  float gh = texture2D(tH, p * uMap.x + uMap.y).r;
  float depth = vW.y - gh;
#if KIND == 2
  depth = max(depth, ${T.RIVER.depth.toFixed(2)} * clamp(1.0 - pow(abs(vRiv.y) / ${T.RIVER.hw.toFixed(1)}, 2.0), 0.0, 1.0));
#endif
  if (depth < -0.05) { gl_FragColor = vec4(0.0); return; } // quruqlik ustida — shaffof (discard emas: discard videokartaning erta chuqurlik sinovini o'chiradi, yashirin suv piksellari ham to'liq hisoblanardi)
  depth = max(depth, 0.0);
#if LOW
  // 0-daraja — alohida ixcham variant (LOW=1, boshida kompilyatsiya qilinadi; darajaga qarab to'r o'z materialini oladi — dasturiy rasterda tarmoq ham pul turadi): cho'qqidagi to'lqin normali + bitta mayda normal o'qishi (RG va BA), osmon aksi, quyosh yo'lakchasi, yutilish, qirg'oq ko'pigi
#if KIND == 2
  vec2 fd0 = normalize(vRiv.zw + 1e-5); vec4 q = textureLod(tNrm, vec2(vRiv.y, vRiv.x) * 0.2 + vec2(0.0, -t * 0.25), max(gLp - 2.3, 0.0)) * 2.0 - 1.0; vec2 d0 = q.xy * 0.8 + q.zw * 0.3, dw0 = vec2(fd0.y, -fd0.x) * d0.x + fd0 * d0.y;
#else
  vec4 q = textureLod(tNrm, mat2(0.8, 0.6, -0.6, 0.8) * p * (0.14 * uNS) - t * vec2(0.022, -0.015), max(gLp + log2(0.14 * uNS), 0.0)) * 2.0 - 1.0; vec2 dw0 = q.xy * 0.75 + q.zw * 0.3;
#endif
  vec3 n0 = normalize(vN + vec3(dw0.x, 0.0, dw0.y) * uNrmK); float nv = max(dot(n0, V), 0.0), f0 = 0.02 + 0.98 * p5(1.0 - nv);
  vec3 r0 = reflect(-V, n0); float ry = abs(r0.y), sd0 = max(dot(r0, uGlintDir), 0.0), s2 = sd0 * sd0;
  vec3 rf = mix(uHor, uTop, sqrt(ry)) + uSkySun * (s2 * s2 * sd0 * 0.24);
#if KIND != 0
  rf = mix(uShore * uAmb, rf, smoothstep(0.015, 0.1, ry));
#endif
  vec3 h0 = normalize(V + uGlintDir); float q2 = max(dot(n0, h0), 1e-3); q2 *= q2; float m0 = 0.0018 + 0.004 * uRough + 0.012 * clamp(dist / 1500.0, 0.0, 1.0) * (KIND == 0 ? 1.0 : 0.4);
  vec3 sp0 = vec3(0.0); if (q2 > 0.85) sp0 = uSunCol * (uGlint * min(exp((q2 - 1.0) / (m0 * q2)) / (3.14159 * m0 * q2 * q2) * f0 / (4.0 * max(nv, 0.12)), 60.0) * smoothstep(-0.02, 0.05, uGlintDir.y));
  vec3 tr = vec3(0.0); if (depth < 40.0) tr = exp(-uAbs * (depth * 2.6)); float tm = min(tr.r, min(tr.g, tr.b)), sy = max(uSunDir.y, 0.0);
  vec3 bd = mix(uShallow, uDeep, smoothstep(0.0, uDeepD, depth)) * (uAmb * 0.55 + uSunCol * 0.3 * sy) * (1.0 - dot(tr, vec3(0.3333))) + uBed * (uAmb * 0.45 + uSunCol * 0.6 * sy) * (tr - tm);
  float sz = clamp(1.0 - depth / uFoamD, 0.0, 1.0), n2 = 0.45 + dw0.y * 0.5;
  float fm = 0.0; if (depth < uFoamD) fm = clamp((sz * sz * smoothstep(0.55, 0.95, (sin(depth / uFoamD * 9.0 - t * 1.3 + dw0.x * 3.0 + 3.3) * 0.5 + 0.5) * 0.5 + n2 * 0.55 + sz * 0.3) + smoothstep(0.1, 0.0, depth) * smoothstep(0.3, 0.75, n2) * 0.7) * uFoamK, 0.0, 1.0);
  float eg = smoothstep(0.0, 0.25, depth + 0.05), fe = f0 * eg;
  vec3 c0 = bd * (1.0 - fe) + rf * fe + sp0 * eg; float a0 = (1.0 - tm) * (1.0 - fe) + fe;
  c0 = mix(c0, (uAmb * 0.75 + uSunCol * 0.55 * max(dot(n0, uSunDir), 0.0)) * 0.85, fm); a0 = clamp(mix(a0, 1.0, fm), 0.0, 1.0);
  gl_FragColor = vec4(c0 / max(a0, 1e-3), a0);
#else
  // yirik to'lqinlar: 2-darajada har pikselda (Gerstner hosilasi; piksel o'lchamidan kalta to'lqin so'ndiriladi), 1-darajada — cho'qqidagi normal
  vec3 N = vN; float jac = vJ, hgt = vM.w;
  if (uQ > 1.5 && uAmp > 0.0) { float fp = max(length(fwidth(p)), 1e-3); N = vec3(0.0, 1.0, 0.0); jac = 1.0; hgt = 0.0;
    for (int i = 0; i < 6; i++){ vec4 w = uW[i], s = uWs[i]; float A = w.w * uAmp * vM.z * (i == 0 || i == 2 || i == 4 ? vM.x : vM.y) * smoothstep(2.0 * fp, 6.0 * fp, s.w); float th = w.z * dot(w.xy, p) - s.y * t + s.z; float c = cos(th), sn = sin(th), wa = w.z * A;
      N.x -= w.x * wa * c; N.z -= w.y * wa * c; N.y -= s.x * wa * sn; jac -= s.x * wa * sn; hgt += A * sn; } }
  vec3 Nm = normalize(N);
  // mayda normal — umumiy normal teksturasidan (mipmap uzoqda o'zi tekislaydi), 4 qatlam
#if KIND == 2
  vec2 fd = normalize(vRiv.zw + 1e-5), fq = vec2(fd.y, -fd.x), ruv = vec2(vRiv.y, vRiv.x);
  vec2 dl = nrm2(ruv * 0.11 + vec2(0.0, -t * 0.13), 0.11) * 0.7 + nrm2(ruv * 0.29 + vec2(0.37, -t * 0.31), 0.29) * 0.5;
  vec2 dw = fq * dl.x + fd * dl.y;
#else
  vec2 dw = nrm2(mat2(0.8, 0.6, -0.6, 0.8) * p * (0.083 * uNS) - t * vec2(0.016, -0.011), 0.083 * uNS) * 0.45 + nrm2(mat2(0.6, -0.8, 0.8, 0.6) * p * (0.23 * uNS) + t * vec2(-0.03, 0.022), 0.23 * uNS) * 0.42
    + nrm2(p * (0.031 * uNS) + t * vec2(0.010, 0.006), 0.031 * uNS) * 0.28 + nrm2(p * (0.71 * uNS) - t * vec2(0.05, 0.07), 0.71 * uNS) * 0.32;
#endif
  vec3 Nd = normalize(N + vec3(dw.x, 0.0, dw.y) * uNrmK);
  float NdV = max(dot(Nd, V), 0.0);
  float F = 0.02 + 0.98 * p5(1.0 - NdV);
  vec3 R = reflect(-V, Nd); R.y = abs(R.y);
  vec3 refl = skyCol(R);
#if KIND != 0
  refl = mix(uShore * uAmb, refl, smoothstep(0.015, 0.1, R.y)); // ko'l/daryo: ufq o'rnida qarshi qirg'oq (daraxt, tepalik) aksi
#endif
  // quyosh (tunda oy) yo'lakchasi: Beckmann; uzoqda ko'rinmas to'lqinlar g'adir-budurlikka qo'shiladi; uGlint — quyosh tepalik ortiga botganda so'nadi
  vec3 L = uGlintDir, Hh = normalize(V + L); float nh = max(dot(Nd, Hh), 1e-3), nh2 = nh * nh;
  vec3 spec = vec3(0.0);
  if (nh2 > 0.85 && uGlint > 0.001) { // lobdan uzoq piksellar (deyarli hammasi) — hisobsiz
    float m2 = 0.0018 + 0.004 * uRough + 0.012 * smoothstep(30.0, 1500.0, dist) * (KIND == 0 ? 1.0 : 0.4);
    float D = exp((nh2 - 1.0) / (m2 * nh2)) / (3.14159 * m2 * nh2 * nh2);
    float Fh = 0.02 + 0.98 * p5(1.0 - max(dot(Hh, V), 0.0));
    spec = uSunCol * (uGlint * min(D * Fh / (4.0 * max(NdV, 0.12)), 60.0) * smoothstep(-0.02, 0.05, L.y) * step(0.0, dot(Nd, L))); }
  // suv tanasi: rang kanallari bo'yicha yutilish (qizil tez yutiladi → sayoz tub firuza ko'rinadi, chuqur — to'q ko'k).
  // Alfa = eng ko'p o'tadigan kanalning yutilishi emas, eng kami: tubdagi haqiqiy narsa shu ulushda ko'rinadi, qolgan kanallar taxminiy tub rangi bilan to'ldiriladi
  // chuqur suvda (40 m dan ortiq) tub ko'rinmaydi — yutilish hisobi tashlab ketiladi (ochiq dengiz piksellarining ko'pchiligi)
  vec3 Tr = vec3(0.0); if (depth < 40.0) { float cosT = sqrt(1.0 - (1.0 - NdV * NdV) * 0.565), path = depth * (1.0 + 1.0 / max(cosT, 0.2)); Tr = exp(-uAbs * path); } float Tm = min(Tr.r, min(Tr.g, Tr.b)), aB = 1.0 - Tm;
  vec3 lit = uAmb * 0.55 + uSunCol * 0.3 * max(uSunDir.y, 0.0);
  vec3 bedL = uBed * (uAmb * 0.45 + uSunCol * 0.6 * max(uSunDir.y, 0.0));
  vec3 scat = mix(uShallow, uDeep, smoothstep(0.0, uDeepD, depth)) * lit * (1.0 - dot(Tr, vec3(0.3333)));
  // shovqin: ikkita o'qish (ikkinchisining B kanali kaustikaning birinchi qatlami)
  vec2 nuv = p * 0.071 + t * vec2(0.004, -0.003); vec4 nA; if (uQ < 1.5) nA = textureLod(tNoise, nuv, max(gLp - 3.8, 0.0)); else nA = texture2D(tNoise, nuv); float n1 = nA.r, n2 = nA.g; vec3 caus = vec3(0.0);
  { vec4 nB = texture2D(tNoise, p * 0.27 + t * vec2(-0.011, 0.008)); n2 = nB.g;
    // to'lqin cho'qqisidan o'tgan quyosh (past quyoshda yashil-firuza nur)
    scat += uShallow * uSunCol * pow(max(dot(V, -L), 0.0), 4.0) * clamp(hgt * 1.5 + 0.25, 0.0, 1.0) * smoothstep(-0.02, 0.1, L.y) * 0.35 * aB;
    // kaustika: sayoz tubga tushgan quyosh to'ri (ikki siljuvchi katak qatlami)
    if (depth < 4.5) { float c2 = texture2D(tNoise, mat2(0.8, 0.6, -0.6, 0.8) * p * 0.31 - t * vec2(0.017, -0.019)).b;
      caus = uSunCol * uBed * pow(smoothstep(0.3, 0.85, nB.b) * smoothstep(0.3, 0.85, c2), 1.5) * uCaus * smoothstep(0.03, 0.4, depth) * smoothstep(4.5, 0.6, depth) * smoothstep(0.02, 0.25, uSunDir.y); } }
  vec3 body = scat + (bedL + caus) * (Tr - Tm) + caus * Tm;
  // ko'pik: qirg'oqqa yuguruvchi yumshoq tasmalar + suv chizig'i + to'lqin cho'qqilari
  float foam = 0.0;
  if (depth < uFoamD) { float sz = 1.0 - depth / uFoamD, band = sin(depth / uFoamD * 9.0 - t * 1.3 + n1 * 6.0) * 0.5 + 0.5;
    foam = sz * sz * smoothstep(0.55, 0.95, band * 0.5 + n2 * 0.55 + sz * 0.3) + smoothstep(0.1, 0.0, depth) * smoothstep(0.3, 0.75, n2) * 0.7; }
#if KIND == 0
  // oq yollar (to'lqinli dengizda): cho'qqi siqilishi (yaqinda) + siljuvchi shovqin dog'lari (uzoqda ham)
  foam += smoothstep(0.66, 0.86, n1 * 0.55 + n2 * 0.55 + (1.0 - jac) * 0.9) * smoothstep(0.5, 0.95, uRough) * smoothstep(1.5, 6.0, depth) * 0.9;
#endif
  foam = clamp(foam * uFoamK, 0.0, 1.0);
  vec3 foamCol = (uAmb * 0.75 + uSunCol * 0.55 * max(dot(Nm, uSunDir), 0.0)) * 0.85;
  // birlashtirish (oldindan alfa ko'paytirilgan): aks shaffof emas, tana — chuqurlikka qarab
  float edge = smoothstep(0.0, 0.25, depth + 0.05), Fe = F * edge;
  vec3 rgb = body * (1.0 - Fe) + refl * Fe + spec * edge;
  float a = aB * (1.0 - Fe) + Fe;
  rgb = mix(rgb, foamCol, foam); a = clamp(mix(a, 1.0, foam), 0.0, 1.0);
  gl_FragColor = vec4(rgb / max(a, 1e-3), a);
#endif
  #include <fog_fragment>
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  gl_FragColor.rgb *= gl_FragColor.a;
}`;

// ---------- post-ishlov sheyderlari ----------
const PV = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
const IGN = 'float ign(vec2 p){ return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }\n';
const pmat = (fs, uniforms, extra) => new THREE.ShaderMaterial(Object.assign({ vertexShader: PV, fragmentShader: fs, uniforms, depthTest: false, depthWrite: false, toneMapped: false }, extra || {}));
// SSAO (yarim o'lcham): faqat chuqurlikdan — normal chuqurlikdan tiklanadi, Alchemy/SAO formulasi, masofa bo'yicha so'nadi
const AO_FS = `uniform sampler2D tDepth; uniform mat4 uProj; uniform mat4 uProjInv; uniform vec2 uTexel; uniform vec2 uFull; uniform float uR; uniform float uK; uniform int uDbg;
varying vec2 vUv;
${IGN}
// har doim to'liq o'lchamli teksel markazidan o'qiladi va tiklanadi (aks holda qiya yerda chiziqli "pog'onalar" chiqadi)
vec3 vpos(vec2 uv){ uv = (floor(uv * uFull) + 0.5) / uFull; float d = texture2D(tDepth, uv).r; vec4 v = uProjInv * vec4(uv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0); return v.xyz / v.w; }
void main(){
  float d = texture2D(tDepth, (floor(vUv * uFull) + 0.5) / uFull).r;
  if (d >= 0.99999) { gl_FragColor = vec4(1.0, 1e4, 0.0, 1.0); return; }
  vec3 P = vpos(vUv); float z = -P.z;
  if (z > 160.0) { gl_FragColor = vec4(1.0, z, 0.0, 1.0); return; }
  vec2 ox = vec2(uTexel.x, 0.0), oy = vec2(0.0, uTexel.y);
  vec3 pr = vpos(vUv + ox), pl = vpos(vUv - ox), pu = vpos(vUv + oy), pd = vpos(vUv - oy);
  // markaziy farq; faqat chuqurlik uzilishida (qirra) kichik tomon olinadi — kvantlangan chuqurlikda normal sinmasin
  float ax = pr.z - P.z, bx = P.z - pl.z, ay = pu.z - P.z, by = P.z - pd.z, tol = 0.02 * z + 0.05;
  vec3 dx = abs(ax - bx) < tol ? pr - pl : (abs(ax) < abs(bx) ? pr - P : P - pl), dy = abs(ay - by) < tol + 0.5 * max(abs(ay), abs(by)) ? pu - pd : (abs(ay) < abs(by) ? pu - P : P - pd);
  vec3 Nv = normalize(cross(dx, dy));
  if (uDbg == 4) { gl_FragColor = vec4(Nv * 0.5 + 0.5, 1.0); return; }
  vec2 rs = vec2(uProj[0][0], uProj[1][1]) * 0.5 * uR / z; float sc = min(1.0, 0.12 / rs.y); rs *= sc; float R = uR * sc;
  float a0 = ign(gl_FragCoord.xy) * 6.2831853, ao = 0.0;
  for (int i = 0; i < 12; i++){ float fi = (float(i) + 0.5) / 12.0, ang = a0 + float(i) * 2.3999632; vec2 o = vec2(cos(ang), sin(ang)) * rs * (fi * fi * 0.85 + 0.15);
    vec3 v = vpos(vUv + o) - P; float vv = dot(v, v), vn = dot(v, Nv);
    ao += max(1.0 - vv / (R * R), 0.0) * max(vn - 0.004 * z - 0.02, 0.0) / (vv + 0.02 * R * R); }
  ao = clamp(1.0 - ao * uK * R / 12.0, 0.0, 1.0);
  ao = mix(ao, 1.0, smoothstep(70.0, 150.0, z));
  gl_FragColor = vec4(ao, z, 0.0, 1.0);
}`;
// chuqurlikni hisobga oluvchi 4×4 xiralashtirish (shovqinni yo'qotadi, qirralarda tashqariga oqmaydi)
const AOB_FS = `uniform sampler2D tAO; uniform vec2 uTexel; varying vec2 vUv;
void main(){ vec2 c = texture2D(tAO, vUv).rg; float s = 0.0, w = 0.0;
  for (int y = -1; y < 3; y++) for (int x = -1; x < 3; x++){ vec2 a = texture2D(tAO, vUv + vec2(float(x), float(y)) * uTexel).rg; float k = max(0.0, 1.0 - abs(a.y - c.y) / (0.03 * c.y + 0.05)); s += a.x * k; w += k; }
  gl_FragColor = vec4(w > 0.0 ? s / w : c.x, c.y, 0.0, 1.0); }`;
// bloom: yorqinlik chegarasi (yumshoq tizza) + Karis o'rtachasi (yolg'iz yaltiroq piksel lipillamasin)
const PRE_FS = `uniform sampler2D tSrc; uniform vec2 uTexel; uniform float uThr; uniform float uKnee; varying vec2 vUv;
vec3 tap(vec2 o){ vec3 c = min(texture2D(tSrc, vUv + o * uTexel).rgb, vec3(200.0)); float l = max(c.r, max(c.g, c.b)); float q = clamp(l - uThr + uKnee, 0.0, 2.0 * uKnee); q = q * q / (4.0 * uKnee + 1e-4);
  return c * max(q, l - uThr) / max(l, 1e-4) / (1.0 + l * 0.25); }
void main(){ gl_FragColor = vec4((tap(vec2(-1.0, -1.0)) + tap(vec2(1.0, -1.0)) + tap(vec2(-1.0, 1.0)) + tap(vec2(1.0, 1.0))) * 0.25, 1.0); }`;
const DOWN_FS = `uniform sampler2D tSrc; uniform vec2 uTexel; varying vec2 vUv;
vec3 T(float x, float y){ return texture2D(tSrc, vUv + vec2(x, y) * uTexel).rgb; }
void main(){ vec3 c = T(0., 0.) * 0.125 + (T(-2., 2.) + T(2., 2.) + T(-2., -2.) + T(2., -2.)) * 0.03125 + (T(0., 2.) + T(-2., 0.) + T(2., 0.) + T(0., -2.)) * 0.0625 + (T(-1., 1.) + T(1., 1.) + T(-1., -1.) + T(1., -1.)) * 0.125;
  gl_FragColor = vec4(c, 1.0); }`;
const UP_FS = `uniform sampler2D tSrc; uniform vec2 uTexel; uniform float uW; varying vec2 vUv;
vec3 T(float x, float y){ return texture2D(tSrc, vUv + vec2(x, y) * uTexel).rgb; }
void main(){ vec3 c = (T(-1., -1.) + T(1., -1.) + T(-1., 1.) + T(1., 1.) + (T(0., -1.) + T(-1., 0.) + T(1., 0.) + T(0., 1.)) * 2.0 + T(0., 0.) * 4.0) / 16.0;
  gl_FragColor = vec4(c * uW, 1.0); }`;
// nur ustunlari: osmon niqobi (chorak o'lcham) va quyosh tomon radial xiralashtirish
const MASK_FS = `uniform sampler2D tSrc; uniform sampler2D tDepth; uniform vec2 uSun; uniform float uAsp; varying vec2 vUv;
void main(){ float sky = step(0.99999, texture2D(tDepth, vUv).r); vec3 c = texture2D(tSrc, vUv).rgb; vec2 d = (vUv - uSun) * vec2(uAsp, 1.0);
  float m = sky * min(dot(c, vec3(0.2126, 0.7152, 0.0722)), 3.0) * exp(-dot(d, d) * 9.0); gl_FragColor = vec4(m, m, m, 1.0); }`;
const RAD_FS = `uniform sampler2D tSrc; uniform vec2 uSun; uniform float uLen; varying vec2 vUv;
${IGN}
void main(){ vec2 st = (uSun - vUv) * uLen / 20.0, uv = vUv + st * ign(gl_FragCoord.xy); float s = 0.0, w = 1.0, ws = 0.0;
  for (int i = 0; i < 20; i++){ s += texture2D(tSrc, uv).r * w; ws += w; w *= 0.93; uv += st; }
  float r = s / ws; gl_FragColor = vec4(r, r, r, 1.0); }`;
// yakuniy kompozit: keskinlik (piksel nisbati < 1), AO, bloom, nurlar, tone mapping, rang, vinyetka, sRGB, dither
const COMP_FS = `uniform sampler2D tScene; uniform sampler2D tDepth; uniform sampler2D tAO; uniform sampler2D tBloom; uniform sampler2D tShaft;
uniform vec2 uTexel; uniform vec2 uAOTexel; uniform vec2 uPZ; uniform float uAOk; uniform float uBloom; uniform float uSharp; uniform float uShaftK; uniform vec3 uShaftCol; uniform float uVig; uniform float uSat; uniform float uCon; uniform vec3 uWB; uniform int uTM; uniform int uDbg;
varying vec2 vUv;
#include <tonemapping_pars_fragment>
${IGN}
void main(){
  vec3 c = texture2D(tScene, vUv).rgb;
  if (uSharp > 0.0) { vec3 n = texture2D(tScene, vUv + vec2(0.0, uTexel.y)).rgb, s = texture2D(tScene, vUv - vec2(0.0, uTexel.y)).rgb, e = texture2D(tScene, vUv + vec2(uTexel.x, 0.0)).rgb, w = texture2D(tScene, vUv - vec2(uTexel.x, 0.0)).rgb;
    vec3 mn = min(c, min(min(n, s), min(e, w))), mx = max(c, max(max(n, s), max(e, w))); c = clamp(c + (4.0 * c - n - s - e - w) * uSharp * 0.25, mn, mx); }
  if (uAOk > 0.0) { float z = uPZ.y / (texture2D(tDepth, vUv).r * 2.0 - 1.0 + uPZ.x); float s = 0.0, w = 0.0;
    for (int i = 0; i < 4; i++){ vec2 o = vec2(float(i - (i / 2) * 2) - 0.5, float(i / 2) - 0.5) * uAOTexel; vec2 a = texture2D(tAO, vUv + o).rg; float k = 1.0 / (0.002 + abs(a.y - z) / max(z, 0.1)); s += a.x * k; w += k; }
    c *= mix(1.0, s / w, uAOk); if (uDbg == 4) { gl_FragColor = vec4(texture2D(tAO, vUv).rgb, 1.0); return; } if (uDbg == 1 || uDbg == 3) { gl_FragColor = vec4(vec3(s / w), 1.0); return; } if (uDbg == 2) { gl_FragColor = vec4(vec3(fract(z)), 1.0); return; } }
  c += texture2D(tBloom, vUv).rgb * uBloom;
  if (uShaftK > 0.0) c += texture2D(tShaft, vUv).r * uShaftCol;
  c *= uWB;
  c = uTM == 0 ? NeutralToneMapping(c) : uTM == 1 ? ACESFilmicToneMapping(c) : AgXToneMapping(c);
  c = clamp(c, 0.0, 1.0);
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722)); c = max(mix(vec3(l), c, uSat), 0.0);
  float l2 = max((l - 0.18) * uCon + 0.18, 0.0); c = clamp(c * (l2 / max(l, 1e-4)), 0.0, 1.0); // kontrast faqat yorqinlikka (to'yinganlik oshmasin)
  vec2 q = (vUv - 0.5) * vec2(1.0, 0.8); c *= 1.0 - uVig * smoothstep(0.2, 0.75, length(q));
  gl_FragColor = vec4(c, 1.0);
  #include <colorspace_fragment>
  gl_FragColor.rgb += (ign(gl_FragCoord.xy) + ign(gl_FragCoord.xy + 17.3) - 1.0) / 255.0;
}`;

export function initGfx(game) {
  const { renderer, scene, camera, sky } = game;
  // tone mapping operatori bir marta (0-daraja materiallari ham shuni ishlatadi) — o'yin davomida almashtirilmaydi
  const TM = [THREE.NeutralToneMapping, THREE.ACESFilmicToneMapping, THREE.AgXToneMapping], post = { tm: 1, exposure: 0.74, nightExp: 1.35, sat: 1.0, con: 1.04, vig: 0.14, bloom: 0.9, ao: 0.85, shafts: 1.0 };
  renderer.toneMapping = TM[post.tm]; renderer.toneMappingExposure = post.exposure;

  // ---------- relyef: mayda tekstura (rang shovqini) ----------
  const uDay = { value: 1 };
  MAT.terrain.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = WIND; sh.uniforms.uDay = uDay;
    sh.vertexShader = 'varying vec3 vWP;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  vWP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = 'varying vec3 vWP;\nuniform float uTime;\nuniform float uDay;\n' + NOISE + '\n' + sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      { float dd = length(cameraPosition - vWP), kN = clamp(1.0 - dd / 420.0, 0.0, 1.0), kF = clamp(1.0 - dd / 2600.0, 0.0, 1.0);
        float n1 = vnoise(vWP.xz * 0.7) - 0.5, n2 = vnoise(vWP.xz * 0.085 + 31.7) - 0.5, n3 = vnoise(vWP.xz * 3.1 + 11.0) - 0.5;
        diffuseColor.rgb *= 1.0 + (n1 * 0.16 + n3 * 0.1) * kN + n2 * 0.14 * kF;
        float cs = smoothstep(0.52, 0.8, vnoise(vWP.xz * 0.0013 + vec2(uTime * 0.0045, uTime * 0.003)) * 0.65 + vnoise(vWP.xz * 0.0041 - vec2(uTime * 0.006, 0.0)) * 0.35);
        diffuseColor.rgb *= 1.0 - 0.24 * cs * uDay;
        float lu = dot(diffuseColor.rgb, vec3(0.3, 0.55, 0.15)); diffuseColor.rgb = mix(vec3(lu), diffuseColor.rgb, 0.45 + 0.55 * uDay); } /* tunda yer rangi xiralashadi: kuzgi/savanna to'q sariq, tepaliklar zangori-yashil yonmaydi */`);
  };
  MAT.terrain.needsUpdate = true;

  // ---------- suv ----------
  const NV = T.NV, hd = new Uint16Array(NV * NV), gh = T.grid.h; for (let i = 0; i < hd.length; i++) hd[i] = THREE.DataUtils.toHalfFloat(Math.max(-80, Math.min(600, gh[i])));
  const hTex = new THREE.DataTexture(hd, NV, NV, THREE.RedFormat, THREE.HalfFloatType); hTex.magFilter = hTex.minFilter = THREE.LinearFilter; hTex.wrapS = hTex.wrapT = THREE.ClampToEdgeWrapping; hTex.needsUpdate = true;
  // to'lqinlar: [to'lqin uzunligi m, balandlik m (to'lqinli dengizda), shamolga nisbatan burchak]
  const WV = [[64, 0.45, 0], [39, 0.35, 0.5], [23, 0.25, -0.55], [13.5, 0.16, 0.95], [7.7, 0.1, -1.25], [4.3, 0.06, 0.3]], wind = Math.atan2(0.62, 0.78);
  const uW = WV.map(() => new THREE.Vector4()), uWs = WV.map(([lam, a, d], i) => { const k = (2 * Math.PI) / lam; return new THREE.Vector4(0.12 / (k * a), Math.sqrt(9.81 * k), i * 1.7, lam); });
  WV.forEach(([lam, a, d], i) => uW[i].set(Math.cos(wind + d), Math.sin(wind + d), (2 * Math.PI) / lam, a));
  const water = { rough: 0.4 };
  const U = { uTime: { value: 0 }, tH: { value: hTex }, tNoise: { value: TEX.noise }, tNrm: { value: TEX.nrm }, uRough: { value: water.rough }, uW: { value: uW }, uWs: { value: uWs },
    uQ: { value: 2 }, uGlint: { value: 1 }, uLow: { value: 0 }, uSp: { value: new THREE.Vector2(0.066, 0.8) },
    uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uGlintDir: { value: new THREE.Vector3(0, 1, 0) }, uSunCol: { value: new THREE.Color() }, uSkySun: { value: new THREE.Color() }, uAmb: { value: new THREE.Color() }, uTop: { value: new THREE.Color() }, uHor: { value: new THREE.Color() },
    uMap: { value: new THREE.Vector4(1 / (T.CELL * NV), (T.HALF / T.CELL + 0.5) / NV, 0, 0) } };
  const waterMat = (kind, o) => new THREE.ShaderMaterial({ vertexShader: WATER_VS, fragmentShader: WATER_FS, defines: { KIND: kind, LOW: 0 }, transparent: true, premultipliedAlpha: true, depthWrite: true, fog: true,
    uniforms: Object.assign({ fogColor: { value: new THREE.Color() }, fogNear: { value: 1 }, fogFar: { value: 2000 }, fogDensity: { value: 0.00025 },
      uDeep: { value: new THREE.Color().setRGB(...o.deep) }, uShallow: { value: new THREE.Color().setRGB(...o.shallow) }, uAmp: { value: o.amp }, uAbs: { value: new THREE.Vector3(...o.abs) }, uBed: { value: new THREE.Color().setRGB(...o.bed) }, uShore: { value: new THREE.Color().setRGB(...(o.shore || [0, 0, 0])) }, uFoamK: { value: o.foam }, uFoamD: { value: o.foamD },
      uNrmK: { value: o.nrm }, uNS: { value: o.ns }, uDeepD: { value: o.deepD }, uCaus: { value: o.caus } }, U) });
  const seaMat = waterMat(0, { deep: [0.002, 0.016, 0.042], shallow: [0.025, 0.2, 0.18], amp: 1, abs: [0.36, 0.09, 0.065], bed: [0.46, 0.4, 0.28], foam: 1, foamD: 1.5, nrm: 0.3, ns: 1, deepD: 16, caus: 0.5 });
  const freshMat = waterMat(1, { deep: [0.004, 0.022, 0.028], shallow: [0.035, 0.13, 0.085], amp: 0.05, abs: [0.45, 0.18, 0.3], bed: [0.22, 0.19, 0.12], shore: [0.05, 0.07, 0.04], foam: 0.45, foamD: 0.5, nrm: 0.22, ns: 1.7, deepD: 8, caus: 0.35 });
  const riverMat = waterMat(2, { deep: [0.015, 0.045, 0.04], shallow: [0.05, 0.12, 0.08], amp: 0, abs: [0.9, 0.5, 0.7], bed: [0.28, 0.24, 0.15], shore: [0.06, 0.07, 0.04], foam: 0.35, foamD: 0.3, nrm: 0.35, ns: 1, deepD: 1.2, caus: 0.2 });
  // dengiz: kamera ortidan yuruvchi qutbli to'r — markazda zichroq (1.6 m, 96 bo'lak; qadam ≈ uSp.x·r + uSp.y), uzoqda siyrak (15 km gacha, ufqgacha yetadi)
  const seaGeo = (() => { const S = 96, rs = [], pos = [0, 0, 0], idx = []; for (let r = 1.6; r < 15000; r *= 1.06) rs.push(r); rs.push(15000);
    for (const r of rs) for (let j = 0; j < S; j++) { const a = (j / S) * Math.PI * 2; pos.push(Math.cos(a) * r, 0, Math.sin(a) * r); }
    for (let j = 0; j < S; j++) idx.push(0, 1 + ((j + 1) % S), 1 + j);
    for (let i = 0; i < rs.length - 1; i++) for (let j = 0; j < S; j++) { const a = 1 + i * S + j, b = 1 + i * S + ((j + 1) % S); idx.push(a, b, a + S, b, b + S, a + S); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); return g; })();
  // 0-daraja uchun ixcham nusxalar (LOW=1): o'sha uniformlar, alohida dastur; setQuality faqat to'rning materialini almashtiradi (yangi kompilyatsiya yo'q — ikkalasi oldindan tayyorlanadi)
  const lowOf = (m) => new THREE.ShaderMaterial({ vertexShader: WATER_VS, fragmentShader: WATER_FS, defines: { KIND: m.defines.KIND, LOW: 1 }, transparent: true, premultipliedAlpha: true, depthWrite: true, fog: true, uniforms: m.uniforms });
  const wMeshes = [], wAdd = (mesh) => { wMeshes.push({ mesh, hi: mesh.material, lo: lowOf(mesh.material) }); return mesh; };
  const sea = new THREE.Mesh(seaGeo, seaMat); sea.renderOrder = 2; sea.frustumCulled = false; scene.add(wAdd(sea));
  const lake = new THREE.Mesh(new THREE.CircleGeometry(T.LAKE.r + 75, 96).rotateX(-Math.PI / 2), freshMat); lake.position.set(T.LAKE.x, T.LAKE.y, T.LAKE.z); lake.renderOrder = 2; scene.add(wAdd(lake));
  { const rv = T.getRiver(), hw = T.RIVER.hw + 9;
    for (const part of rv.parts) { const pos = [], at = []; let P0, P1, A0, A1, along = 0, lx, lz; const a0 = part.start, b0 = part.start + part.count;
      for (let i = a0; i < b0; i += 2) { const a = Math.max(a0, i - 2), b = Math.min(b0 - 1, i + 2); let tx = rv.x[b] - rv.x[a], tz = rv.z[b] - rv.z[a]; const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l;
        if (i > a0) along += Math.hypot(rv.x[i] - lx, rv.z[i] - lz); lx = rv.x[i]; lz = rv.z[i];
        const y = rv.y[i], Q0 = [rv.x[i] + tz * hw, y, rv.z[i] - tx * hw], Q1 = [rv.x[i] - tz * hw, y, rv.z[i] + tx * hw], B0 = [along, hw, tx, tz], B1 = [along, -hw, tx, tz];
        if (i > a0) { pos.push(...P0, ...Q1, ...Q0, ...P0, ...P1, ...Q1); at.push(...A0, ...B1, ...B0, ...A0, ...A1, ...B1); }
        P0 = Q0; P1 = Q1; A0 = B0; A1 = B1; }
      const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); rg.setAttribute('aRiv', new THREE.Float32BufferAttribute(at, 4));
      const m = new THREE.Mesh(rg, riverMat); m.renderOrder = 2; scene.add(wAdd(m)); } }

  // ---------- osmon aksi (PMREM): kichik kub kamerada osmon gumbazi, natija nishoni qayta ishlatiladi ----------
  const pmrem = new THREE.PMREMGenerator(renderer), envScene = new THREE.Scene(); envScene.add(new THREE.Mesh(new THREE.SphereGeometry(40, 24, 12), sky.dome.material));
  const cubeRT = new THREE.WebGLCubeRenderTarget(128, { type: THREE.HalfFloatType, generateMipmaps: false }), cubeCam = new THREE.CubeCamera(0.1, 200, cubeRT);
  let envRT = null, envHour = null;
  const updEnv = () => { cubeCam.update(renderer, envScene); envRT = pmrem.fromCubemap(cubeRT.texture, envRT); scene.environment = envRT.texture; envHour = game.hour; };

  // ---------- post-ishlov quvuri ----------
  const lin = { type: THREE.HalfFloatType, depthBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: false };
  const near = Object.assign({}, lin, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
  const V2 = () => ({ value: new THREE.Vector2() }), F1 = (v) => ({ value: v });
  const aoMat = pmat(AO_FS, { tDepth: F1(null), uProj: F1(camera.projectionMatrix), uProjInv: F1(camera.projectionMatrixInverse), uTexel: V2(), uFull: V2(), uR: F1(1.6), uK: F1(2.2), uDbg: F1(0) });
  const aoBMat = pmat(AOB_FS, { tAO: F1(null), uTexel: V2() });
  const preMat = pmat(PRE_FS, { tSrc: F1(null), uTexel: V2(), uThr: F1(1.6), uKnee: F1(0.6) });
  const downMat = pmat(DOWN_FS, { tSrc: F1(null), uTexel: V2() });
  const upMat = pmat(UP_FS, { tSrc: F1(null), uTexel: V2(), uW: F1(1) }, { blending: THREE.AdditiveBlending, transparent: true });
  const maskMat = pmat(MASK_FS, { tSrc: F1(null), tDepth: F1(null), uSun: V2(), uAsp: F1(1) });
  const radMat = pmat(RAD_FS, { tSrc: F1(null), uSun: V2(), uLen: F1(1) });
  const compMat = pmat(COMP_FS, { tScene: F1(null), tDepth: F1(null), tAO: F1(null), tBloom: F1(null), tShaft: F1(null), uTexel: V2(), uAOTexel: V2(), uPZ: V2(), uAOk: F1(0), uBloom: F1(0.9), uSharp: F1(0), uShaftK: F1(0), uShaftCol: F1(new THREE.Color()),
    uVig: F1(0.14), uSat: F1(1), uCon: F1(1), uWB: F1(new THREE.Vector3(1, 1, 1)), uTM: F1(post.tm), uDbg: F1(0) });
  const fsq = new FullScreenQuad(null), size = new THREE.Vector2(), sunP = new THREE.Vector3(), camF = new THREE.Vector3();
  let quality = -1, R = null, shaftOn = false;
  const free = () => { if (!R) return; for (const k in R) { const v = R[k]; if (Array.isArray(v)) v.forEach((t) => t.dispose()); else if (v && v.dispose) v.dispose(); } R = null; };
  // 0-darajada ham sahna nishonga chiziladi (bloom/AO yo'q): ekranga to'g'ridan-to'g'ri chizilsa tone mapping har bir material sheyderiga o'tib,
  // BARCHA sheyderlar qayta kompilyatsiya bo'lardi — o'yin 1–3 soniya qotib, kanvas qora bo'lib turardi
  const black = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1); black.needsUpdate = true;
  const alloc = () => {
    free();
    renderer.getDrawingBufferSize(size); const w = Math.max(2, Math.round(size.x)), h = Math.max(2, Math.round(size.y));
    const mk = (fw, fh, o) => new THREE.WebGLRenderTarget(Math.max(1, Math.round(fw)), Math.max(1, Math.round(fh)), o);
    R = { scene: new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, samples: quality === 2 ? 4 : 0, depthTexture: quality > 0 ? new THREE.DepthTexture(w, h, THREE.FloatType) : null, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: false }), bloom: [] };
    if (quality > 0) for (let i = 1; i <= 6; i++) R.bloom.push(mk(w / 2 ** i, h / 2 ** i, lin));
    if (quality === 2) { R.aoA = mk(w / 2, h / 2, near); R.aoB = mk(w / 2, h / 2, near); R.sA = mk(w / 4, h / 4, lin); R.sB = mk(w / 4, h / 4, lin); }
  };
  const pass = (m, rt) => { m.uniformsNeedUpdate = true; fsq.material = m; renderer.setRenderTarget(rt); fsq.render(renderer); };
  const texel = (u, rt) => u.value.set(1 / rt.width, 1 / rt.height);
  const api = {
    sea, hTex, water, post,
    setQuality(q) { U.uQ.value = q; for (const w of wMeshes) w.mesh.material = q === 0 ? w.lo : w.hi; if (q !== quality) { quality = q; alloc(); } },
    // Boshlanishda barcha sheyderlarni (yashirin narsalar va suvning 0-daraja variantini ham) nishonga oldindan kompilyatsiya qilish: keyin o'yin qotmaydi
    precompile() {
      if (!R) api.setQuality(game.state.set.gfx ?? 2);
      const hid = []; scene.traverse((o) => { if (!o.visible) { hid.push(o); o.visible = true; } });
      const prev = renderer.getRenderTarget(); renderer.setRenderTarget(R.scene);
      try { renderer.compile(scene, camera); for (const w of wMeshes) w.mesh.material = w.mesh.material === w.lo ? w.hi : w.lo; renderer.compile(scene, camera); }
      finally { for (const w of wMeshes) w.mesh.material = quality === 0 ? w.lo : w.hi; renderer.setRenderTarget(prev); for (const o of hid) o.visible = false; }
    },
    get quality() { return quality; },
    envRefresh: () => updEnv(),
    resize() { if (quality >= 0) alloc(); },
    update(dt, force) {
      const sun = sky.sun, n = sky.night;
      U.uTime.value = game.time; U.uSunDir.value.copy(sky.lightDir); U.uGlintDir.value.copy(sky.uniforms.uSunDir ? sky.uniforms.uSunDir.value : sky.lightDir).normalize();
      U.uSunCol.value.copy(sun.color).multiplyScalar(sun.intensity); U.uAmb.value.copy(sky.hemi.color).multiplyScalar(sky.hemi.intensity);
      U.uTop.value.copy(sky.uniforms.uTop.value); U.uHor.value.copy(sky.uniforms.uHor.value);
      U.uSkySun.value.copy(sky.uniforms.uSunCol ? sky.uniforms.uSunCol.value : sun.color).multiplyScalar(sky.uniforms.uGlow ? sky.uniforms.uGlow.value : 1);
      U.uRough.value = water.rough; const as = 0.25 + 0.75 * water.rough; WV.forEach((w, i) => (uW[i].w = w[1] * as));
      sea.position.set(Math.round(camera.position.x / 4) * 4, 0, Math.round(camera.position.z / 4) * 4);
      // suv sathiga yaqin kamera (suzish): yaqin to'lqinlar so'nadi; quyosh yo'lakchasi — quyosh relyef (tepalik) ortiga o'tsa so'nadi (kameradan quyosh tomonga 20 nuqta)
      const cp = camera.position; U.uLow.value = THREE.MathUtils.clamp((4 - cp.y) / 2, 0, 1);
      const G = U.uGlintDir.value, gl = Math.hypot(G.x, G.z); let gk = 1;
      if (G.y > -0.05 && G.y < 0.4 && gl > 1e-3) { const tn = G.y / gl, gx = G.x / gl, gz = G.z / gl, y0 = Math.max(cp.y, 0.5); let mn = 1;
        for (let i = 0, d = 25; i < 20; i++, d *= 1.32) mn = Math.min(mn, (y0 + d * tn - T.gridHeight(cp.x + gx * d, cp.z + gz * d)) / d);
        gk = THREE.MathUtils.smoothstep(mn, -0.012, 0.012); }
      U.uGlint.value += (gk - U.uGlint.value) * (force || !(dt > 0) ? 1 : Math.min(1, dt * 3));
      uDay.value = 1 - n;
      renderer.toneMappingExposure = post.exposure * (1 + (post.nightExp - 1) * n);
      let dh = envHour == null ? 99 : Math.abs(game.hour - envHour); if (dh > 12 && dh < 90) dh = 24 - dh; if (dh > 0.45 || force) updEnv();
    },
    render() {
      if (!R) api.setQuality(game.state.set.gfx ?? 2);
      const S = R.scene, n = sky.night, lite = quality === 0;
      renderer.setRenderTarget(S); renderer.render(scene, camera);
      // AO (faqat 2-daraja)
      const aoOn = quality === 2 && post.ao > 0;
      if (aoOn) { const u = aoMat.uniforms; u.tDepth.value = S.depthTexture; u.uTexel.value.set(2 / S.width, 2 / S.height); u.uFull.value.set(S.width, S.height); u.uDbg.value = post.dbg | 0; pass(aoMat, R.aoA); aoBMat.uniforms.tAO.value = R.aoA.texture; texel(aoBMat.uniforms.uTexel, R.aoB); pass(aoBMat, R.aoB); }
      // bloom: chegaradan yuqori yorug'lik → 6 pog'ona pastga, keyin yuqoriga qo'shib yig'ish
      if (!lite) { preMat.uniforms.tSrc.value = S.texture; texel(preMat.uniforms.uTexel, S); preMat.uniforms.uThr.value = 1.6 - 0.75 * n; pass(preMat, R.bloom[0]);
      for (let i = 1; i < R.bloom.length; i++) { downMat.uniforms.tSrc.value = R.bloom[i - 1].texture; texel(downMat.uniforms.uTexel, R.bloom[i - 1]); pass(downMat, R.bloom[i]); }
      const ac = renderer.autoClear; renderer.autoClear = false;
      for (let i = R.bloom.length - 1; i > 0; i--) { upMat.uniforms.tSrc.value = R.bloom[i].texture; texel(upMat.uniforms.uTexel, R.bloom[i]); pass(upMat, R.bloom[i - 1]); }
      renderer.autoClear = ac; }
      // nur ustunlari: quyosh ekranda bo'lsa (2-daraja, kunduzi)
      shaftOn = false; let shK = 0;
      if (quality === 2 && post.shafts > 0 && sky.sunMesh && sky.sunMesh.visible) {
        const sd = sky.sunDir || sky.lightDir; camera.getWorldDirection(camF);
        if (camF.dot(sd) > 0.15) { sunP.copy(camera.position).addScaledVector(sd, 1000).project(camera); const sx = sunP.x * 0.5 + 0.5, sy = sunP.y * 0.5 + 0.5, off = Math.max(Math.abs(sx - 0.5), Math.abs(sy - 0.5));
          shK = post.shafts * THREE.MathUtils.smoothstep(sd.y, -0.03, 0.06) * (1 - THREE.MathUtils.smoothstep(off, 0.55, 0.95)) * (0.45 + 0.55 * (1 - THREE.MathUtils.smoothstep(sd.y, 0.2, 0.7)));
          if (shK > 0.01) { shaftOn = true; maskMat.uniforms.uSun.value.set(sx, sy); radMat.uniforms.uSun.value.set(sx, sy); maskMat.uniforms.uAsp.value = S.width / S.height;
            maskMat.uniforms.tSrc.value = S.texture; maskMat.uniforms.tDepth.value = S.depthTexture; pass(maskMat, R.sA);
            radMat.uniforms.tSrc.value = R.sA.texture; radMat.uniforms.uLen.value = 0.9; pass(radMat, R.sB); radMat.uniforms.tSrc.value = R.sB.texture; radMat.uniforms.uLen.value = 0.3; pass(radMat, R.sA); } } }
      // yakuniy kompozit → ekran
      const u = compMat.uniforms, P = camera.projectionMatrix.elements;
      u.tScene.value = S.texture; u.tDepth.value = S.depthTexture; u.tBloom.value = lite ? black : R.bloom[0].texture; texel(u.uTexel, S); u.uPZ.value.set(P[10], P[14]);
      u.uAOk.value = aoOn ? post.ao : 0; if (aoOn) { u.tAO.value = post.dbg >= 3 ? R.aoA.texture : R.aoB.texture; texel(u.uAOTexel, R.aoB); }
      u.uShaftK.value = shaftOn ? 1 : 0; if (shaftOn) { u.tShaft.value = R.sA.texture; u.uShaftCol.value.copy(sky.sun.color).multiplyScalar(shK * 0.55); }
      u.uBloom.value = lite ? 0 : post.bloom / 6; const pr = renderer.getPixelRatio(); u.uSharp.value = pr < 0.999 ? Math.min(0.7, (1 - pr) * 1.6) : 0;
      u.uTM.value = post.tm; u.uDbg.value = post.dbg | 0; u.uSat.value = post.sat * (1 - 0.3 * n); u.uCon.value = post.con; u.uVig.value = post.vig + 0.08 * n;
      pass(compMat, null);
    },
  };
  updEnv(); envHour = null; // birinchi kadrda osmon ranglari bilan qayta pishiriladi
  return api;
}
