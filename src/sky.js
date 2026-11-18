// Osmon (fizikaviy sochilish jadvali), quyosh/oy diski, yulduzlar, protsedura bulutlar, yoritish, soya va tog' soyasi — kun vaqti bo'yicha
import * as THREE from 'three';
import { FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';
import { clamp, smoothstep, lerp } from './util.js';
import { LOOK, syncFogOut } from './look.js';
import * as T from './terrain.js';

export const DAY_START = 5.4, DAY_END = 19.3;
const LU = LOOK.U;

// --- Atmosfera sochilishi (Rayleigh + Mie + ozon, bir martalik sochilish + oddiy ko'p sochilish) — GLSL va JS bir xil ---
const RE = 6360e3, RA = 6420e3, OBS = 300, BR = [5.802e-6, 13.558e-6, 33.1e-6], HR = 8000, BMS = 3.996e-6, BME = 4.44e-6, HM = 1200, BO = [0.65e-6, 1.881e-6, 0.085e-6], GM = 0.76;
const ATM_GLSL = `
const float RE = ${RE.toFixed(1)}, RA = ${RA.toFixed(1)}, HR = ${HR.toFixed(1)}, HM = ${HM.toFixed(1)}, BMS = ${BMS}, BME = ${BME}, GM = ${GM};
const vec3 BR = vec3(${BR.join(',')}), BO = vec3(${BO.join(',')});
uniform vec3 uS; vec3 gS; uniform float uE; uniform float uHaze; uniform float uMs; uniform vec3 uNightZ; uniform vec3 uNightH;
vec3 dens(float h){ return vec3(exp(-h / HR), exp(-h / HM), max(0.0, 1.0 - abs(h - 25000.0) / 15000.0)); }
float sphFar(vec3 o, vec3 d, float R){ float b = dot(o, d), c = dot(o, o) - R * R, q = b * b - c; return q < 0.0 ? 0.0 : -b + sqrt(q); }
vec3 ext(vec3 od){ return BR * od.x + BME * uHaze * od.y + BO * od.z; }
vec3 odSun(vec3 p, out float vis){ float b = dot(p, gS), c = dot(p, p) - RE * RE; vis = (b < 0.0 && b * b - c > 0.0) ? 0.0 : 1.0;
  float L = sphFar(p, gS, RA); vec3 od = vec3(0.0);
  for (int i = 0; i < 6; i++){ float a = (float(i) + 0.5) / 6.0; od += dens(length(p + gS * (L * a * a)) - RE) * (L * (2.0 * float(i) + 1.0) / 36.0); }
  return od; }
vec3 scatter(vec3 d){
  vec3 o = vec3(0.0, RE + ${OBS.toFixed(1)}, 0.0); float L = sphFar(o, d, RA);
  vec3 sR = vec3(0.0), sM = vec3(0.0), sA = vec3(0.0); vec3 odV = vec3(0.0);
  for (int i = 0; i < 16; i++){ float a0 = float(i) / 16.0, a1 = float(i + 1) / 16.0, t0 = L * a0 * a0, t1 = L * a1 * a1, dt = t1 - t0;
    vec3 p = o + d * (0.5 * (t0 + t1)); vec3 dn = dens(length(p) - RE); vec3 odM = odV + dn * (0.5 * dt);
    float vis; vec3 os = odSun(p, vis); vec3 Tv = exp(-ext(odM));
    vec3 Tt = Tv * exp(-ext(os)) * vis; sR += Tt * dn.x * dt; sM += Tt * dn.y * dt;
    sA += Tv * (BR * dn.x + BMS * uHaze * dn.y) * dt;
    odV += dn * dt; }
  float mu = dot(d, gS), pR = 0.0596831 * (1.0 + mu * mu), g2 = GM * GM;
  float pM = 0.1193662 * (1.0 - g2) * (1.0 + mu * mu) / ((2.0 + g2) * pow(1.0 + g2 - 2.0 * GM * mu, 1.5));
  return uE * (sR * BR * pR + sM * BMS * uHaze * pM) + uE * uMs * sA; }`;
const LUT_FS = `varying vec2 vUv;${ATM_GLSL}
void main(){
  float u = vUv.x, v = vUv.y; float s = v * 2.0 - 1.0; float y = sign(s) * s * s; float yc = max(y, 0.0);
  float mu = 1.0 - 2.0 * u * u; float sy = uS.y, sx = sqrt(max(1.0 - sy * sy, 1e-4)); gS = vec3(sx, sy, 0.0);
  float lim = sqrt(max(1.0 - yc * yc, 0.0)); float dx = clamp((mu - yc * sy) / sx, -lim, lim); vec3 d = vec3(dx, yc, sqrt(max(1.0 - yc * yc - dx * dx, 0.0)));
  vec3 c = scatter(normalize(d));
  c += mix(uNightH, uNightZ, sqrt(yc));
  if (y < 0.0) c *= mix(1.0, 0.72, sqrt(-y));
  gl_FragColor = vec4(c, 1.0); }`;

// JS nusxasi (osmon ranglari, quyosh rangi va yoritish uchun)
const dens = (h, o) => { o[0] = Math.exp(-h / HR); o[1] = Math.exp(-h / HM); o[2] = Math.max(0, 1 - Math.abs(h - 25000) / 15000); return o; };
const _dn = [0, 0, 0];
function odSunJS(px, py, pz, S, M, out) { // quyosh tomon optik chuqurlik; qaytaradi: ko'rinish (0 — Yer soyasida)
  const b = px * S[0] + py * S[1] + pz * S[2], c = px * px + py * py + pz * pz - RE * RE; const vis = b < 0 && b * b - c > 0 ? 0 : 1;
  const cc = px * px + py * py + pz * pz - RA * RA, q = b * b - cc, L = q < 0 ? 0 : -b + Math.sqrt(q);
  out[0] = out[1] = out[2] = 0;
  for (let i = 0; i < M; i++) { const a = (i + 0.5) / M, t = L * a * a, dt = (L * (2 * i + 1)) / (M * M); const x = px + S[0] * t, y = py + S[1] * t, z = pz + S[2] * t; dens(Math.hypot(x, y, z) - RE, _dn); out[0] += _dn[0] * dt; out[1] += _dn[1] * dt; out[2] += _dn[2] * dt; }
  return vis;
}
const extJS = (od, haze, k) => BR[k] * od[0] + BME * haze * od[1] + BO[k] * od[2];
const _os = [0, 0, 0], _ov = [0, 0, 0];
function scatterJS(d, S, E, haze, ms, out) {
  const oy = RE + OBS, b = oy * d[1], c = oy * oy - RA * RA, L = -b + Math.sqrt(b * b - c);
  let r0 = 0, r1 = 0, r2 = 0, m0 = 0, m1 = 0, m2 = 0, a0 = 0, a1 = 0, a2 = 0; _ov[0] = _ov[1] = _ov[2] = 0;
  for (let i = 0; i < 16; i++) {
    const u0 = i / 16, u1 = (i + 1) / 16, t0 = L * u0 * u0, t1 = L * u1 * u1, dt = t1 - t0, t = 0.5 * (t0 + t1);
    const px = d[0] * t, py = oy + d[1] * t, pz = d[2] * t; dens(Math.hypot(px, py, pz) - RE, _dn); const dR = _dn[0], dM = _dn[1], dO = _dn[2];
    const om0 = _ov[0] + dR * dt * 0.5, om1 = _ov[1] + dM * dt * 0.5, om2 = _ov[2] + dO * dt * 0.5;
    const vis = odSunJS(px, py, pz, S, 6, _os);
    for (let k = 0; k < 3; k++) {
      const ev = BR[k] * om0 + BME * haze * om1 + BO[k] * om2, Tv = Math.exp(-ev), Tt = Tv * Math.exp(-extJS(_os, haze, k)) * vis, A = Tv * (BR[k] * dR + BMS * haze * dM) * dt;
      if (k === 0) { r0 += Tt * dR * dt; m0 += Tt * dM * dt; a0 += A; } else if (k === 1) { r1 += Tt * dR * dt; m1 += Tt * dM * dt; a1 += A; } else { r2 += Tt * dR * dt; m2 += Tt * dM * dt; a2 += A; }
    }
    _ov[0] += dR * dt; _ov[1] += dM * dt; _ov[2] += dO * dt;
  }
  const mu = d[0] * S[0] + d[1] * S[1] + d[2] * S[2], pR = 0.0596831 * (1 + mu * mu), g2 = GM * GM, pM = (0.1193662 * (1 - g2) * (1 + mu * mu)) / ((2 + g2) * Math.pow(1 + g2 - 2 * GM * mu, 1.5));
  out[0] = E * (r0 * BR[0] * pR + m0 * BMS * haze * pM) + E * ms * a0; out[1] = E * (r1 * BR[1] * pR + m1 * BMS * haze * pM) + E * ms * a1; out[2] = E * (r2 * BR[2] * pR + m2 * BMS * haze * pM) + E * ms * a2;
  return out;
}
function sunTrans(S, alt, haze, out) { // balandlik alt dan quyosh tomon o'tkazuvchanlik (ufq ostida bo'lsa 0)
  const vis = odSunJS(0, RE + alt, 0, S, 32, _os);
  for (let k = 0; k < 3; k++) out[k] = vis * Math.exp(-extJS(_os, haze, k));
  return out;
}

// --- Osmon gumbazi: jadvaldan osmon + quyosh diski + oy (faza bilan) + yulduzlar va Somon yo'li + bulutlar ---
const SKY_VS = `varying vec3 vDir; varying float vEnv;
void main(){ vDir = position; vec4 wp = modelMatrix * vec4(position, 1.0); vEnv = step(length(wp.xyz - cameraPosition), 300.0); gl_Position = projectionMatrix * viewMatrix * wp; gl_Position.z = gl_Position.w * 0.9999995; }`;
const SKY_FS = `#define LK_NO_SCOTOPIC
#define LK_CLOUD_GRAD
varying vec3 vDir; varying float vEnv;
uniform vec3 uSunDisc; uniform vec3 uMoonCol; uniform vec3 uGround; uniform vec3 uEnvFloor; uniform float uStars; uniform mat3 uStarRot; uniform vec3 uCLDir;
${LOOK.glsl.sky}${LOOK.glsl.cloud}
float h13(vec3 p){ p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
vec3 h33(vec3 p){ p = fract(p * vec3(0.1031, 0.1030, 0.0973)); p += dot(p, p.yxz + 33.33); return fract((p.xxy + p.yxx) * p.zyx); }
float hg(float mu, float g){ float g2 = g * g, x = 1.0 + g2 - 2.0 * g * mu; return 0.0795775 * (1.0 - g2) / (x * sqrt(x)); }
void main(){
  vec3 d = normalize(vDir); bool env = vEnv > 0.5;
  vec3 sky = safarSky(d), col = sky;
  if (env) col = mix(col, uGround, smoothstep(0.0, -0.06, d.y));
  float hor = smoothstep(-0.01, 0.03, d.y);
  // yulduzlar va Somon yo'li (faqat qorong'i osmonda)
  if (!env && uStars > 0.002 && d.y > -0.03) {
    vec3 sd = uStarRot * d; vec3 p = sd * 240.0, c = floor(p), f = fract(p); float h = h13(c), st = 0.0; vec3 sc = vec3(1.0);
    if (h > 0.9935) { vec3 o = h33(c) * 0.5 + 0.25; vec3 q = f - o; q -= sd * dot(q, sd); float r = max(length(fwidth(p)) * 0.75, 0.035);
      float m = fract(h * 731.7); m = 0.08 + 0.92 * m * m * m * m; st = m * exp(-dot(q, q) / (r * r)) * (0.05 / (r * r));
      st *= 0.75 + 0.25 * sin(uTimeL * (2.0 + 6.0 * fract(h * 53.1)) + h * 91.0); sc = mix(vec3(1.0, 0.8, 0.62), vec3(0.75, 0.85, 1.0), fract(h * 17.3)); }
    float mw = exp(-pow(dot(sd, normalize(vec3(0.31, 0.62, 0.72))), 2.0) * 22.0);
    float dust = uQ > 0.5 ? smoothstep(0.35, 0.75, texture(tNoise, sd.xz * 0.9 + sd.y * 0.31).r * 0.6 + texture(tNoise, sd.xy * 2.3 + 0.4).r * 0.4) : 0.45;
    vec3 milky = vec3(0.8, 0.85, 1.0) * mw * dust * 0.012;
    col += (sc * st * 0.9 + milky) * uStars * hor;
  }
  // oy: sharsimon yoritilgan disk (faza quyosh yo'nalishidan)
  { vec3 m = uMoonDir; float cm = dot(d, m); const float r = 0.0125;
    if (cm > 0.9995) { vec3 t1 = normalize(cross(m, vec3(0.0, 1.0, 0.0))), t2 = cross(t1, m); vec2 l = vec2(dot(d, t1), dot(d, t2)) / r; float l2 = dot(l, l);
      if (l2 < 1.0) { vec3 n = t1 * l.x + t2 * l.y - m * sqrt(1.0 - l2); float lit = max(dot(n, uSunDir), 0.0); float alb = 0.55 + 0.45 * smoothstep(0.35, 0.7, texture(tNoise, l * 0.21 + 0.37).r) * (0.8 + 0.2 * texture(tNoise, l * 0.6).b);
        vec3 mc = uMoonCol * alb * (lit + 0.025) * smoothstep(1.0, 0.92, l2); col = mix(col, sky + mc, hor * (env ? 0.0 : 1.0)); } }
    if (cm > 0.97) col += uMoonCol * (0.004 * exp(-(1.0 - cm) * 2500.0) + 0.0012 * exp(-(1.0 - cm) * 300.0)) * hor; }
  // quyosh diski (chegarasi qorayib boradi) va atrofidagi nur
  { float cs = dot(d, uSunDir); float x = (1.0 - cs) / 3.6e-5;
    if (cs > 0.9) { vec3 sun = uSunDisc * (smoothstep(1.08, 0.92, x) * (1.0 - 0.55 * (1.0 - sqrt(max(1.0 - x, 0.0)))) * (env ? 0.0 : 1.0) + 0.012 * exp(-x * 0.06) + 0.0012 * exp(-x * 0.006));
    col += sun * hor; } }
  // bulutlar: bir qatlam (uCloud.z balandlikda), yon tomondan yoritilish, o'z-o'ziga soya, quyosh tomonda kumush hoshiya
  // piksel izini izotrop qilamiz (anizotrop filtr qiya qarashda bulutni radial cho'zib yuboradi)
  float t = (uCloud.z - uViewPos.y) / max(d.y, 0.012); vec2 p = uViewPos.xz + d.xz * t;
  if (uQ > 0.5) { vec2 gx = dFdx(p), gy = dFdy(p); float fl = sqrt(length(gx) * length(gy)) * uCloud.y; lkGX = vec2(fl, 0.0); lkGY = vec2(0.0, fl); }
  if (d.y > 0.0) {
    bool cheap = uQ < 0.5 || env; // 0-daraja va atrof-muhit xaritasi: eng arzon bulut (2 ta o'qish, o'z-o'ziga soyasiz)
    float det = cheap ? -1.0 : smoothstep(60000.0, 9000.0, t) * smoothstep(0.07, 0.01, lkGX.x * 2.4);
    float D = lkCloudD(p, det);
    if (D > 0.003 && uQ < 0.5) { // 0-daraja (atrof-muhit o'tishida ham): oddiy yoritish (tekstura va exp'siz)
      float mu = dot(d, uCLDir), ft = t / (t + 26000.0);
      vec3 cc = uCloudSun * ((0.55 - 0.25 * D) * (0.8 + 0.6 * mu * mu * mu * mu)) + uCloudAmb * (1.05 - 0.45 * D);
      col = mix(col, mix(cc, sky, ft), smoothstep(0.0, 0.42, D) * (1.0 - ft * ft));
    } else if (D > 0.003) {
      vec3 L = uCLDir; vec2 s2 = L.xz; float sl = length(s2); s2 = sl > 1e-3 ? s2 / sl : vec2(1.0, 0.0);
      float od = cheap ? D * 2.2 + 0.25 : D * 1.1 + lkCloudD(p + s2 * 220.0, -1.0) * 0.9 + lkCloudD(p + s2 * 650.0, -1.0) * 0.6;
      float mu = dot(d, L), tr = exp(-od * 0.65);
      float base = mix(1.0, 0.55 + 0.45 * exp(-D * 2.0), smoothstep(0.05, 0.5, d.y));
      vec3 lit = uCloudSun * (tr * (0.7 + 2.5 * hg(mu, 0.5)) * base + 3.0 * hg(mu, 0.85) * exp(-D * 3.0) * (1.0 - exp(-D * 6.0)));
      vec3 cc = lit + uCloudAmb * (1.05 - 0.45 * D) * (0.75 + 0.25 * d.y);
      float a = smoothstep(0.0, 0.42, D); float fk = 1.0 - exp(-t / 26000.0);
      cc = mix(cc, sky, fk); a *= 1.0 - fk * fk;
      col = mix(col, cc, a);
    }
  }
  if (env) col += uEnvFloor;
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

// 0-daraja uchun alohida arzon gumbaz (yuklashda emas, darajaga qarab ko'rinadi — material/define o'zgarmaydi): analitik osmon, oddiy oy va quyosh, 2 o'qishli bulut
const SKY0_FS = `#define LK_NO_SCOTOPIC
varying vec3 vDir; varying float vEnv;
uniform vec3 uSunDisc; uniform vec3 uMoonCol; uniform float uStars; uniform mat3 uStarRot; uniform vec3 uCLDir;
${LOOK.glsl.sky}${LOOK.glsl.cloud}
float h13(vec3 p){ p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
void main(){
  vec3 d = normalize(vDir); vec3 sky = lkSkyCheap(d), col = sky; float hor = smoothstep(-0.01, 0.03, d.y);
  if (uStars > 0.002 && d.y > -0.03) { vec3 sd = uStarRot * d; vec3 p = sd * 240.0, c = floor(p); float h = h13(c);
    if (h > 0.9935) { vec3 q = fract(p) - 0.5; float m = fract(h * 731.7); col += vec3(0.9) * (0.08 + 0.92 * m * m * m * m) * smoothstep(0.16, 0.0, dot(q, q)) * 0.6 * uStars * hor; } }
  { float cm = dot(d, uMoonDir); if (cm > 0.97) col += uMoonCol * (smoothstep(0.99990, 0.99993, cm) * 0.6 + 0.0012 * exp(-(1.0 - cm) * 300.0)) * hor; }
  { float cs = dot(d, uSunDir); if (cs > 0.9) { float x = (1.0 - cs) / 3.6e-5; col += uSunDisc * (smoothstep(1.08, 0.92, x) * 0.8 + 0.012 * exp(-x * 0.06) + 0.0012 * exp(-x * 0.006)) * hor; } }
  if (d.y > 0.0) { float t = (uCloud.z - uViewPos.y) / max(d.y, 0.012); float D = lkCloudD(uViewPos.xz + d.xz * t, -1.0);
    if (D > 0.003) { float mu = dot(d, uCLDir), ft = t / (t + 26000.0);
      vec3 cc = uCloudSun * ((0.55 - 0.25 * D) * (0.8 + 0.6 * mu * mu * mu * mu)) + uCloudAmb * (1.05 - 0.45 * D);
      col = mix(col, mix(cc, sky, ft), smoothstep(0.0, 0.42, D) * (1.0 - ft * ft)); } }
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

const OCC = 256, G_ALB = [0.16, 0.15, 0.1]; // relyef soyasi xaritasi o'lchami
const ENV_K = 0.8; // osmon yoritishi kuchi (quyosh va soya qarama-qarshiligi uchun)
export class Sky {
  constructor(scene, opts = {}) {
    this.scene = scene;
    this.hour = 9;
    this.night = 0; // 0..1
    this.sunDir = new THREE.Vector3(0, 1, 0);
    this.moonDir = new THREE.Vector3(0, 1, 0);
    this.lightDir = new THREE.Vector3(0, 1, 0);
    this.fogColor = new THREE.Color();
    this.uniforms = { uTop: { value: new THREE.Color() }, uHor: { value: new THREE.Color() } }; // boshqa modullar o'qiydi (zenit va ufq rangi)
    this.du = { uSunDisc: { value: new THREE.Color() }, uMoonCol: { value: new THREE.Color() }, uGround: { value: new THREE.Color() }, uEnvFloor: { value: new THREE.Color() }, uStars: { value: 0 }, uStarRot: { value: new THREE.Matrix3() }, uCLDir: { value: new THREE.Vector3(0, 1, 0) } };
    const dome = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 24), new THREE.ShaderMaterial({ vertexShader: SKY_VS, fragmentShader: SKY_FS, uniforms: this.du, side: THREE.BackSide, depthWrite: false, depthTest: true, fog: false }));
    dome.scale.setScalar(1000); dome.renderOrder = 1e6; dome.frustumCulled = false; // shaffof bo'lmaganlardan keyin: chuqurlik sinovi faqat ochiq osmon piksellarini qoldiradi
    this.dome = dome; scene.add(dome);
    const dome0 = new THREE.Mesh(dome.geometry, new THREE.ShaderMaterial({ vertexShader: SKY_VS, fragmentShader: SKY0_FS, uniforms: this.du, side: THREE.BackSide, depthWrite: false, depthTest: true, fog: false }));
    dome0.scale.setScalar(1000); dome0.renderOrder = 1e6; dome0.frustumCulled = false; dome0.visible = false; this.dome0 = dome0; scene.add(dome0);

    // osmon jadvali (LUT): soat o'zgarganda videokartada qayta hisoblanadi
    this.lutU = { uS: { value: new THREE.Vector3(0, 1, 0) }, uE: { value: 10 }, uHaze: { value: 1 }, uMs: { value: 0 }, uNightZ: { value: new THREE.Color() }, uNightH: { value: new THREE.Color() } };
    this.lutRT = new THREE.WebGLRenderTarget(128, 96, { type: THREE.HalfFloatType, format: THREE.RGBAFormat, depthBuffer: false, generateMipmaps: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, wrapS: THREE.ClampToEdgeWrapping, wrapT: THREE.ClampToEdgeWrapping, colorSpace: THREE.NoColorSpace });
    this.lutQuad = new FullScreenQuad(new THREE.RawShaderMaterial({ glslVersion: THREE.GLSL3, uniforms: this.lutU, vertexShader: '#define attribute in\n#define varying out\nattribute vec3 position; attribute vec2 uv; varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }', fragmentShader: 'precision highp float;\n#define varying in\n#define gl_FragColor fc\nout vec4 fc;\n' + LUT_FS, depthTest: false, depthWrite: false }));
    LU.tSkyLut.value = this.lutRT.texture; this._lutH = null; this._lutT = 0;

    // Yorug'lik
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x888888, 1); scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xffffff, 2);
    this.sun.castShadow = true;
    const sh = this.sun.shadow;
    sh.mapSize.set(opts.shadowSize || 2048, opts.shadowSize || 2048);
    this.shR = 125; // soya qamrovi ±125 m
    sh.camera.left = -this.shR; sh.camera.right = this.shR; sh.camera.top = this.shR; sh.camera.bottom = -this.shR; sh.camera.near = 20; sh.camera.far = 1000; sh.camera.updateProjectionMatrix();
    sh.bias = -0.00012; sh.normalBias = 0.07; sh.radius = 1.5;
    this._shDir = new THREE.Vector3(0, 1, 0);
    scene.add(this.sun); scene.add(this.sun.target);
    scene.fog = new THREE.Fog(0xc6e2f6, 260, 5600); // USE_FOG yoqilgan bo'lsin; rang/masofa look.js tumanida ishlatilmaydi

    // relyef quyosh soyasi xaritasi (tog'lar uzun soya tashlaydi)
    this.occData = new Float32Array(OCC * OCC); this.occHalf = new Uint16Array(OCC * OCC).fill(THREE.DataUtils.toHalfFloat(-2000)); this.occStage = new Uint16Array(OCC * OCC);
    this.occTex = new THREE.DataTexture(this.occHalf, OCC, OCC, THREE.RedFormat, THREE.HalfFloatType); this.occTex.magFilter = this.occTex.minFilter = THREE.LinearFilter; this.occTex.needsUpdate = true;
    LU.tSunOcc.value = this.occTex; LU.uOccMap.value.set(1 / T.SIZE, 0.5, 0, 0);
    this._occDir = new THREE.Vector3(0, -1, 0); this._occRow = -1; this._occNext = new THREE.Vector3();
    this._c = [0, 0, 0]; this._d = [0, 0, 0]; this._fl = [0, 0, 0]; this._cache = null; this._zUp = new THREE.Vector3(0, 0, 1);
    this.setHour(this.hour);
  }

  setShadowQuality(size) {
    const sh = this.sun.shadow;
    if (!size) { this.sun.castShadow = false; return; }
    this.sun.castShadow = true;
    if (sh.mapSize.x !== size) { sh.mapSize.set(size, size); if (sh.map) { sh.map.dispose(); sh.map = null; } }
    const R = size <= 1024 ? 95 : 125; if (R !== this.shR) { this.shR = R; const c = sh.camera; c.left = -R; c.right = R; c.top = R; c.bottom = -R; c.updateProjectionMatrix(); } // kichik xaritada qamrov ham kichik (0-daraja: avvalgi ±95 m)
  }

  // atmosfera bo'yicha ranglar (soat kam o'zgarsa qayta hisoblanmaydi)
  _atmo(S) {
    const c = this._cache || (this._cache = { s: new THREE.Vector3(9, 9, 9), zen: [0, 0, 0], hor: [0, 0, 0], amb: [0, 0, 0], sunT: [0, 0, 0], cloudT: [0, 0, 0], horS: [0, 0, 0], horA: [0, 0, 0], glow: [0, 0, 0] });
    if (c.s.distanceToSquared(S) < 2e-6) return c;
    c.s.copy(S);
    const sy = S.y, sx = Math.sqrt(Math.max(1 - sy * sy, 1e-4)), Sc = [sx, sy, 0], E = this.lutU.uE.value, hz = this.lutU.uHaze.value, ms = this.lutU.uMs.value, o = this._c;
    scatterJS([0, 1, 0], Sc, E, hz, ms, c.zen);
    c.hor[0] = c.hor[1] = c.hor[2] = 0; c.amb[0] = c.amb[1] = c.amb[2] = 0; let wsum = 0;
    for (let a = 0; a < 6; a++) { const az = (a / 6) * Math.PI * 2 + 0.26; scatterJS([Math.cos(az) * 0.9995, 0.03, Math.sin(az) * 0.9995], Sc, E, hz, ms, o); for (let k = 0; k < 3; k++) c.hor[k] += o[k] / 6; }
    for (const y of [0.15, 0.45, 0.8]) for (let a = 0; a < 4; a++) { const az = (a / 4) * Math.PI * 2 + 0.4, r = Math.sqrt(1 - y * y); scatterJS([Math.cos(az) * r, y, Math.sin(az) * r], Sc, E, hz, ms, o); for (let k = 0; k < 3; k++) c.amb[k] += o[k] * y; wsum += y; }
    for (let k = 0; k < 3; k++) c.amb[k] = (c.amb[k] / wsum) * 0.8 + c.zen[k] * 0.2;
    sunTrans(Sc, OBS, hz, c.sunT); sunTrans(Sc, 1700, hz, c.cloudT);
    // 0-daraja arzon osmon uchun: ufq quyosh tomonda / qarshi tomonda va quyosh atrofidagi nur (6° yuqorida, arzon modeldan ortig'i)
    scatterJS([0.9995, 0.03, 0], Sc, E, hz, ms, c.horS); scatterJS([-0.9995, 0.03, 0], Sc, E, hz, ms, c.horA);
    { const e = Math.asin(Math.max(-1, Math.min(1, sy))) + 0.1, gy = Math.max(Math.sin(e), 0.0), gd = [Math.sqrt(1 - gy * gy), gy, 0]; scatterJS(gd, Sc, E, hz, ms, o);
      const cs = gd[0] * sx + gd[1] * sy, w = (cs * 0.5 + 0.5) ** 2, v = Math.sqrt(gy), ex = ((cs * 0.5 + 0.5) ** 128);
      for (let k = 0; k < 3; k++) { const base = (c.horA[k] + (c.horS[k] - c.horA[k]) * w) * (1 - v) + c.zen[k] * v; c.glow[k] = Math.max(0, o[k] - base) / ex; } }
    return c;
  }

  setHour(h) {
    h = ((h % 24) + 24) % 24; const dh = Math.abs(h - this.hour); this._jump = dh > 0.2 && dh < 23.8; this.hour = h;
    // Quyosh va oy yo'nalishi (o'yin mantiqi bilan bir xil)
    const isDay = h >= DAY_START && h <= DAY_END;
    const sa = ((h - DAY_START) / (DAY_END - DAY_START)) * Math.PI;
    const nl = 24 - (DAY_END - DAY_START), hn = h > DAY_END ? h - DAY_END : h + 24 - DAY_END, ma = (hn / nl) * Math.PI;
    this.sunDir.set(Math.cos(sa), Math.sin(sa) * 0.92, 0.38).normalize();
    this.moonDir.set(Math.cos(ma) * 0.8, Math.sin(ma) * 0.8 + 0.25, -0.42).normalize();
    const sunEl = this.sunDir.y, moonDir = this.moonDir;
    this.night = isDay ? 1 - smoothstep(-0.02, 0.2, sunEl) : 1;
    // tuman va xira havo: tongda vodiylarda tuman, kunduzi tiniq
    const dawn = Math.exp(-(((h - 6.3) / 1.25) ** 2)), dusk = Math.exp(-(((h - 19.4) / 1.4) ** 2));
    const haze = 1.0 + 0.9 * dawn + 0.5 * dusk; this.lutU.uHaze.value = haze;
    const dark = 1 - smoothstep(-0.2, 0.02, sunEl); // 1 — to'liq tun (quyosh ufqdan 11° pastda)
    this.lutU.uMs.value = 0.025 * smoothstep(-0.25, 0.05, sunEl) * (0.35 + 0.65 * smoothstep(0, 0.5, sunEl));
    const moonUp = smoothstep(-0.05, 0.25, moonDir.y);
    this.lutU.uNightZ.value.setRGB(0.0032, 0.0058, 0.017).multiplyScalar(0.7 + 0.6 * moonUp);
    this.lutU.uNightH.value.setRGB(0.011, 0.018, 0.038).multiplyScalar(0.7 + 0.6 * moonUp);
    this.lutU.uS.value.copy(this.sunDir);
    const A = this._atmo(this.sunDir), nz = this.lutU.uNightZ.value, nh = this.lutU.uNightH.value;
    const top = this.uniforms.uTop.value.setRGB(A.zen[0] + nz.r, A.zen[1] + nz.g, A.zen[2] + nz.b), horC = this.uniforms.uHor.value.setRGB(A.hor[0] + nh.r, A.hor[1] + nh.g, A.hor[2] + nh.b);
    LU.uSkyZen.value.copy(top); LU.uSkyHor.value.copy(horC);
    LU.uSkyHorS.value.setRGB(A.horS[0] + nh.r, A.horS[1] + nh.g, A.horS[2] + nh.b); LU.uSkyHorA.value.setRGB(A.horA[0] + nh.r, A.horA[1] + nh.g, A.horA[2] + nh.b); LU.uSkyGlow.value.setRGB(A.glow[0], A.glow[1], A.glow[2]); syncFogOut();
    const amb = LU.uSkyAmb.value.setRGB(A.amb[0] + (nz.r + nh.r) * 0.5, A.amb[1] + (nz.g + nh.g) * 0.5, A.amb[2] + (nz.b + nh.b) * 0.5);
    this.fogColor.copy(horC); this.scene.fog.color.copy(horC);
    // quyosh / oy yorug'ligi: quyosh ufqqa botgach oy nuri qorong'ilik bilan asta kiradi (yo'nalish almashuvi sezilmaydi)
    const ST = A.sunT, SUNK = 3.5;
    if (isDay) { this.lightDir.copy(this.sunDir); this.sun.color.setRGB(ST[0], ST[1], ST[2]); const m = Math.max(ST[0], ST[1], ST[2], 1e-4); this.sun.color.multiplyScalar(1 / m); this.sun.intensity = SUNK * m * smoothstep(-0.012, 0.03, sunEl); }
    else { this.lightDir.copy(moonDir); this.sun.color.setRGB(0.64, 0.7, 1.0); this.sun.intensity = 0.65 * smoothstep(0.0, 0.25, moonDir.y) * smoothstep(-0.0, -0.14, sunEl); }
    if (this.lightDir.y < 0.08) { this.lightDir.y = 0.08; this.lightDir.normalize(); }
    // osmon yoritishi: Lambert materiallar uchun yarim shar chirog'i (Standard'lar atrof-muhit xaritasidan oladi)
    const gAlb = G_ALB, sunIrr = this.sun.intensity * Math.max(this.lightDir.y, 0) / SUNK;
    const flo = dark * 1.25 + 0.04 + 0.5 * smoothstep(-0.2, -0.02, sunEl) * (1 - smoothstep(-0.02, 0.06, sunEl)); // + tong/shom oralig'i (oy botgan, quyosh hali chiqmagan payt) qorong'i chuqur bo'lmasin // tunda o'ynash uchun minimal yorug'lik (oy nuri ostidagi ko'z moslashuvi)
    const fl = this._fl; fl[0] = 0.05 * flo; fl[1] = 0.058 * flo; fl[2] = 0.15 * flo;
    this.du.uEnvFloor.value.setRGB(fl[0], fl[1], fl[2]);
    const g = this.du.uGround.value.setRGB(gAlb[0] * (sunIrr * this.sun.color.r + amb.r * 1.0), gAlb[1] * (sunIrr * this.sun.color.g + amb.g * 1.0), gAlb[2] * (sunIrr * this.sun.color.b + amb.b * 1.0));
    this.hemi.color.setRGB(amb.r + fl[0], amb.g + fl[1], amb.b + fl[2]); this.hemi.groundColor.setRGB(g.r + fl[0], g.g + fl[1], g.b + fl[2]); this.hemi.intensity = Math.PI * ENV_K; this.scene.environmentIntensity = ENV_K;
    // gumbaz uniformlari
    const E = this.lutU.uE.value; this.du.uSunDisc.value.setRGB(ST[0], ST[1], ST[2]).multiplyScalar(E * 4.0);
    const moonK = 0.9 * (0.4 + 0.6 * dark); this.du.uMoonCol.value.setRGB(0.95 * moonK, 0.96 * moonK, 1.0 * moonK);
    this.du.uStars.value = smoothstep(0.35, 1, dark);
    const ct = A.cloudT, cl = this.du.uCLDir.value;
    if (sunEl > -0.06) { cl.copy(this.sunDir); LU.uCloudSun.value.setRGB(ct[0], ct[1], ct[2]).multiplyScalar(E * 0.36); }
    else { cl.copy(moonDir); LU.uCloudSun.value.setRGB(0.6, 0.7, 0.95).multiplyScalar(0.012 * moonUp); }
    { const l = amb.r * 0.2126 + amb.g * 0.7152 + amb.b * 0.0722; LU.uCloudAmb.value.setRGB(l, l, l).lerp(amb, 0.45).multiplyScalar(1.15); }
    { const ax = this._sax || (this._sax = new THREE.Vector3(0.25, 0.9, 0.35).normalize()), m4 = this._m4 || (this._m4 = new THREE.Matrix4()); this.du.uStarRot.value.setFromMatrix4(m4.makeRotationAxis(ax, (h / 24) * Math.PI * 2)); }
    // umumiy uniformlar
    LU.uSunDir.value.copy(this.sunDir); LU.uMoonDir.value.copy(moonDir); LU.uLightDir.value.copy(this.lightDir); LU.uNight.value = this.night; LU.uScotopic.value = LOOK.scotopic * dark;
    LU.uSunCol.value.copy(this.sun.color).multiplyScalar(this.sun.intensity);
    LU.uFog.value.set(1.7e-4 * haze * (1 + 0.6 * dark) + 2.2e-4 * dawn, 1 / lerp(900, 260, dawn), 0, 0.6);
    LU.uCloud.value.x = 0.42 + 0.1 * Math.sin(h * 0.37 + 1.3);
    LU.uHemiStd.value = 0;
  }

  _renderLut(force) {
    const r = LOOK.renderer; if (!r) return;
    const now = performance.now();
    if (!force && this._lutH !== null && Math.abs(this.hour - this._lutH) < 0.004 && now - this._lutT < 30000) return;
    this._lutH = this.hour; this._lutT = now;
    const prev = r.getRenderTarget(), xr = r.xr.enabled; r.xr.enabled = false;
    r.setRenderTarget(this.lutRT); this.lutQuad.render(r); r.setRenderTarget(prev); r.xr.enabled = xr;
  }

  // relyef soyasi: har kadrda bir necha qator (≈0.3 ms), quyosh siljisa qaytadan; katta sakrashda birdaniga
  _occStep(full) {
    const L = this.lightDir;
    if (full || this._occRow < 0) { if (this._occDir.angleTo(L) < 0.006 && !full) return; this._occNext.copy(L); this._occRow = 0; }
    const D = this._occNext, hl = Math.hypot(D.x, D.z) || 1e-6, dx = D.x / hl, dz = D.z / hl, tn = D.y / hl;
    const gh = T.grid.h, NV = T.NV, N = T.N, CELL = T.CELL, HALF = T.HALF, step = T.SIZE / OCC, data = this.occData;
    const rows = full ? OCC : 4;
    for (let n = 0; n < rows && this._occRow < OCC; n++, this._occRow++) {
      const j = this._occRow, z0 = -HALF + (j + 0.5) * step;
      for (let i = 0; i < OCC; i++) {
        const x0 = -HALF + (i + 0.5) * step; let best = -2000;
        for (let s = 14; s < 4200; s *= 1.16) {
          const fx = (x0 + dx * s + HALF) / CELL, fz = (z0 + dz * s + HALF) / CELL; if (fx < 0 || fz < 0 || fx > N || fz > N) break;
          const v = gh[((fz + 0.5) | 0) * NV + ((fx + 0.5) | 0)] - s * tn; if (v > best) best = v;
        }
        data[j * OCC + i] = best; this.occStage[j * OCC + i] = THREE.DataUtils.toHalfFloat(Math.max(-2000, Math.min(60000, best))); // half-float qator bo'yicha (yakunda sakrash bo'lmasin)
      }
    }
    if (this._occRow >= OCC) {
      this.occHalf.set(this.occStage); this.occTex.needsUpdate = true; this._occDir.copy(D); this._occRow = -1; LU.uOccMap.value.z = 1;
    }
  }

  update(dt, cam, focus) {
    const q0 = LU.uQ.value < 0.5; this.dome.visible = !q0; this.dome0.visible = q0; // 0-darajada arzon gumbaz
    this.dome.position.copy(cam.position); this.dome0.position.copy(cam.position);
    LU.uViewPos.value.copy(cam.position);
    { const F = LU.uFog.value; LU.uFogCam.value = F.x * Math.exp(-F.y * (cam.position.y - F.z)); }
    const g = LOOK.game; LU.uTimeL.value = g ? g.time : 0;
    LU.uCloudOff.value.set(LU.uTimeL.value * 7.5 + 3100, LU.uTimeL.value * 2.2 - 900);
    this._renderLut(this._jump);
    if (T.grid.h) this._occStep(this._jump || LU.uOccMap.value.z === 0);
    this._jump = false;
    // soya kamerasi: yo'nalish kichik qadamlar bilan yangilanadi, markaz teksel bo'yicha yaxlitlanadi — soya titramaydi
    const f = focus || cam.position, sh = this.sun.shadow, sz = sh.mapSize.x, R = this.shR;
    if (this._shDir.angleTo(this.lightDir) > 0.003) this._shDir.copy(this.lightDir);
    const Ld = this._shDir, up = Math.abs(Ld.y) > 0.99 ? this._zUp : this.sun.up;
    const ax = this._ax || (this._ax = new THREE.Vector3()), ay = this._ay || (this._ay = new THREE.Vector3());
    ax.crossVectors(up, Ld).normalize(); ay.crossVectors(Ld, ax);
    const tx = (2 * R) / sz, px = f.x * ax.x + f.y * ax.y + f.z * ax.z, py = f.x * ay.x + f.y * ay.y + f.z * ay.z;
    const qx = Math.round(px / tx) * tx - px, qy = Math.round(py / tx) * tx - py;
    this.sun.target.position.copy(f).addScaledVector(ax, qx).addScaledVector(ay, qy);
    this.sun.position.copy(this.sun.target.position).addScaledVector(Ld, 500);
  }
}
