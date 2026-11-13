// Umumiy ko'rinish moduli: barcha materiallarga umumiy uniformlar, atmosfera tumani, bulut va relyef soyasi, soya chetini yumshatish, hook() — onBeforeCompile'larni birlashtirish
import * as THREE from 'three';
import { TEX } from './tex.js';

const VER = 'lk3'; // sheyder kaliti versiyasi (umumiy yamoq o'zgarsa oshiriladi)
const v3 = (x, y, z) => ({ value: new THREE.Vector3(x, y, z) }), v4 = (x, y, z, w) => ({ value: new THREE.Vector4(x, y, z, w) }), col = (r, g, b) => ({ value: new THREE.Color(r, g, b) });

// Umumiy uniformlar — har materialga avtomatik beriladi (bir xil obyekt, qiymat bir joyda yangilanadi)
const U = {
  uSunDir: v3(0, 1, 0), // haqiqiy quyosh yo'nalishi (ufq ostida ham), dunyo koordinatasi
  uMoonDir: v3(0, 1, 0), // oy yo'nalishi
  uLightDir: v3(0, 1, 0), // yo'naltirilgan chiroq (sky.sun: kunduzi quyosh, kechasi oy) yo'nalishi
  uSunCol: col(1, 1, 1), // sky.sun rangi × kuchi (chiziqli HDR) — uLightDir yorug'ligi
  uSkyZen: col(0.2, 0.4, 0.9), uSkyHor: col(0.7, 0.8, 0.9), // osmon: tepa va ufq (o'rtacha), chiziqli
  uSkyAmb: col(0.5, 0.6, 0.8), // osmon yoritishi (yuqoriga qaragan sirt uchun o'rtacha nurlanish)
  uFog: v4(1.6e-4, 1 / 700, 0, 0.5), // tuman: zichlik (1/m, refH balandlikda), balandlik pasayishi (1/m), refH (m), quyosh tomon sochilish kuchi
  uTimeL: { value: 0 }, // soniya (o'yin vaqti)
  uQ: { value: 2 }, // sifat darajasi 0/1/2
  uWet: { value: 0 }, // yomg'ir namligi 0..1 (hozircha 0)
  uNight: { value: 0 }, // tun 0..1 (sky.night)
  tNoise: { value: null }, tNrm: { value: null }, // tex.js teksturalari
  tSkyLut: { value: null }, // osmon jadvali (128×96, HalfFloat): u = sin(quyoshgacha burchak/2), v = 0.5 + 0.5·sign(y)·sqrt|y|
  uCloud: v4(0.45, 1 / 12000, 1700, 0.55), // bulut: qoplama 0..1, masshtab (1/m), balandlik (m), yerga soya kuchi
  uCloudOff: { value: new THREE.Vector2() }, // shamol siljishi (m)
  uCloudSun: col(1, 1, 1), uCloudAmb: col(0.5, 0.6, 0.8), // bulutni yorituvchi quyosh/oy va osmon nuri (osmon birligida)
  uViewPos: v3(0, 20, 0), // asosiy kamera joyi (gumbaz bulut tekisligi uchun — PMREM o'tishida ham bir xil)
  uHemiStd: { value: 0 }, // atrof-muhit xaritasi bor Standard materiallarda yarim shar chirog'i ulushi
  uScotopic: { value: 0 }, // tungi ko'rish kuchi (= LOOK.scotopic × qorong'ilik, sky.js har soatda yozadi): qorong'i joylar rangsizlanib ko'kish tusga kiradi
  uShadowEdge: v4(0.7, 0.97, 0, 0), // soya xaritasi chetida yo'qolish: smoothstep(x, y, |koord|)
  tSunOcc: { value: null }, uOccMap: v4(0, 0, 0, 0), // relyef soyasi: tSunOcc.r = soya balandligi (m; nuqta undan baland bo'lsa yorug'), uv = xz·x + y, z = kuch
};
const DECL = { uSunDir: 'vec3', uMoonDir: 'vec3', uLightDir: 'vec3', uSunCol: 'vec3', uSkyZen: 'vec3', uSkyHor: 'vec3', uSkyAmb: 'vec3', uFog: 'vec4', uTimeL: 'float', uQ: 'float', uWet: 'float', uNight: 'float', tNoise: 'sampler2D', tNrm: 'sampler2D', tSkyLut: 'sampler2D', uCloud: 'vec4', uCloudOff: 'vec2', uCloudSun: 'vec3', uCloudAmb: 'vec3', uViewPos: 'vec3', uHemiStd: 'float', uScotopic: 'float', uShadowEdge: 'vec4', tSunOcc: 'sampler2D', uOccMap: 'vec4' };

// --- GLSL kutubxonasi (har biri #ifndef bilan himoyalangan: bir sheyderga ikki marta qo'shilsa ham xato bermaydi) ---
const noise = `#ifndef LK_NOISE
#define LK_NOISE
float lkFbm(vec2 p){ return texture(tNoise, p).r; }
float lkRidged(vec2 p){ return texture(tNoise, p).g; }
float lkCell(vec2 p){ return texture(tNoise, p).b; }
float lkGrain(vec2 p){ return texture(tNoise, p).a; }
float fbm2(vec2 p){ return texture(tNoise, p).r * 0.62 + texture(tNoise, p * 2.13 + 0.37).r * 0.38; }
#endif
`;
const sky = `#ifndef LK_SKY
#define LK_SKY
vec3 safarSky(vec3 d){ float y = d.y; float v = 0.5 + 0.5 * sign(y) * sqrt(min(abs(y), 1.0)); float u = sqrt(clamp(0.5 - 0.5 * dot(d, uSunDir), 0.0, 1.0)); return texture(tSkyLut, vec2(u, v)).rgb; }
#endif
`;
const fog = sky + `#ifndef LK_FOG
#define LK_FOG
float safarFogAmount(vec3 wp){ vec3 v = wp - cameraPosition; float dist = length(v); float b = uFog.y, k = b * v.y;
  float fh = abs(k) > 1e-3 ? (1.0 - exp(-k)) / k : 1.0 - 0.5 * k;
  float tau = uFog.x * exp(-b * (cameraPosition.y - uFog.z)) * dist * fh; return 1.0 - exp(-max(tau, 0.0)); }
vec3 safarFogColor(vec3 dir){ vec3 c = safarSky(vec3(dir.x, max(dir.y, 0.0), dir.z)); float sd = max(dot(dir, uSunDir), 0.0); return c + uCloudSun * uFog.w * 0.06 * sd * sd * sd * sd * sd * sd * sd * sd; }
vec3 safarFog(vec3 c, vec3 wp){ vec3 v = wp - cameraPosition; float f = safarFogAmount(wp); return mix(c, safarFogColor(v / max(length(v), 1e-3)), f); }
#endif
`;
// bulut zichligi: p — dunyo xz (m); det — mayda detal ulushi 0..1
const cloud = `#ifndef LK_CLOUD
#define LK_CLOUD
float lkCloudD(vec2 p, float det){ vec2 q = (p + uCloudOff) * uCloud.y, w = uCloudOff * uCloud.y;
  float a = texture(tNoise, q * 0.31 + 0.11).r, b = texture(tNoise, q * 0.93 + w * 0.3 + 0.31).r, c = texture(tNoise, q * 2.4 - w * 0.25 + 0.57).r;
  float n = a * 0.42 + b * 0.38 + c * 0.2;
  if (det > 0.0) { float e = texture(tNoise, q * 1.9 + w * 0.5 + 0.77).b, f = texture(tNoise, q * 6.1 + w * 0.9 + 0.13).r; n += ((0.45 - e) * 0.11 + (f - 0.58) * 0.08) * det; }
  float th = mix(0.72, 0.5, uCloud.x); return smoothstep(th, th + 0.16, n); }
float safarCloudShadow(vec3 wp){ vec3 s = uLightDir; if (s.y < 0.02 || uQ < 0.5) return 1.0; vec2 p = wp.xz + s.xz / s.y * (uCloud.z - wp.y);
  return 1.0 - uCloud.w * smoothstep(0.02, 0.15, s.y) * smoothstep(0.05, 0.75, lkCloudD(p, 0.0)); }
#endif
`;
// to'g'ridan-to'g'ri quyosh nurini kamaytiruvchilar: bulut soyasi va relyef (tog') soyasi
const sunocc = cloud + `#ifndef LK_SUNOCC
#define LK_SUNOCC
float safarTerrainOcc(vec3 wp){ if (uOccMap.z <= 0.0) return 1.0; vec2 uv = wp.xz * uOccMap.x + uOccMap.y; if (any(lessThan(uv, vec2(0.0))) || any(greaterThan(uv, vec2(1.0)))) return 1.0;
  float hs = texture(tSunOcc, uv).r; return mix(1.0, smoothstep(hs - 7.0, hs + 5.0, wp.y), uOccMap.z); }
float safarSunOcc(vec3 wp){ return safarCloudShadow(wp) * safarTerrainOcc(wp); }
float lkShadowEdge(vec4 sc){ vec2 e = abs(sc.xy / sc.w * 2.0 - 1.0); return 1.0 - smoothstep(uShadowEdge.x, uShadowEdge.y, max(e.x, e.y)); }
#endif
`;
export const LOOK = { U, glsl: { noise, sky, fog, cloud, cloudShadow: cloud, sunOcc: sunocc }, hook, renderer: null, ver: VER, scotopic: 0.7 }; // scotopic: tungi rangsizlanish kuchi (post-ishlov o'zi qilsa 0 qo'ying)

// Material uchun bir nechta sheyder yamog'ini qo'shish (onBeforeCompile'ni almashtirmaydi). key — yamoqning yopilgan qiymatlarini ham ifodalasin
export function hook(material, key, fn) {
  const h = (material._lkH || []).filter((x) => x.key !== key); h.push({ key, fn }); material._lkH = h; material.needsUpdate = true; return material;
}

// --- three'ning tuman bo'laklari o'rniga atmosfera tumani ---
const FOG_PARS_V = `#ifdef USE_FOG
varying float vFogDepth;
#endif
`, FOG_V = `#ifdef USE_FOG
vFogDepth = - mvPosition.z;
#endif
`, FOG_PARS_F = `#ifdef USE_FOG
uniform vec3 fogColor; varying float vFogDepth;
#endif
`, FOG_F = `#ifdef USE_FOG
{ vec3 lkV = vLookW - cameraPosition; float lkF = safarFogAmount(vLookW); vec3 lkC = safarFogColor(lkV / max(length(lkV), 1e-3));
#if defined( LK_FOG_POST )
  #if defined( TONE_MAPPING )
  lkC = toneMapping(lkC);
  #endif
  lkC = linearToOutputTexel(vec4(lkC, 1.0)).rgb;
#endif
  gl_FragColor.rgb = mix(gl_FragColor.rgb, lkC, lkF); }
#endif
`;

function patchChunks() {
  const C = THREE.ShaderChunk;
  C.fog_pars_vertex = FOG_PARS_V; C.fog_vertex = FOG_V; C.fog_pars_fragment = FOG_PARS_F; C.fog_fragment = FOG_F;
  // yo'naltirilgan chiroq (quyosh/oy): soya xaritasi chetida yumshoq yo'qoladi, bulut va tog' soyasi qo'shiladi
  const lf = C.lights_fragment_begin;
  const shOld = 'directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowIntensity, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;';
  const shNew = 'directLight.color *= ( directLight.visible && receiveShadow ) ? mix( 1.0, getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowIntensity, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ), lkShadowEdge( vDirectionalShadowCoord[ i ] ) ) : 1.0;';
  const giOld = 'getDirectionalLightInfo( directionalLight, directLight );';
  const hemiOld = 'irradiance += getHemisphereLightIrradiance( hemisphereLights[ i ], geometryNormal );';
  if (!lf.includes(shOld) || !lf.includes(giOld) || !lf.includes(hemiOld)) { console.warn('look: lights_fragment_begin kutilganidek emas'); return; }
  C.lights_fragment_begin = lf.replace(shOld, shNew)
    .replace(giOld, giOld + '\n\t\tdirectLight.color *= lkSunOccF;')
    .replace('#if ( NUM_DIR_LIGHTS > 0 ) && defined( RE_Direct )', '#if ( NUM_DIR_LIGHTS > 0 ) && defined( RE_Direct )\n\tfloat lkSunOccF = safarSunOcc( vLookW );')
    .replace(hemiOld, 'irradiance += getHemisphereLightIrradiance( hemisphereLights[ i ], geometryNormal ) * lkHemiK;')
    .replace('#if defined( RE_IndirectDiffuse )', `#if defined( RE_IndirectDiffuse )
	#if defined( STANDARD ) && defined( ENVMAP_TYPE_CUBE_UV )
	float lkHemiK = uHemiStd;
	#else
	float lkHemiK = 1.0;
	#endif`);
}

// --- har materialga qo'llanadigan umumiy yamoq ---
const reDecl = {}; for (const k in DECL) reDecl[k] = new RegExp('uniform\\s+\\w+\\s+' + k + '\\b');
const decl = (src) => { let s = ''; for (const k in DECL) if (!reDecl[k].test(src)) s += 'uniform ' + DECL[k] + ' ' + k + ';\n'; return s; };
function globalPatch(sh) {
  if (sh.isRawShaderMaterial) return; // xom sheyderlar o'zi to'liq (precision ham yo'q) — tegilmaydi
  for (const k in U) if (!sh.uniforms[k]) sh.uniforms[k] = U[k];
  let vs = sh.vertexShader, fs = sh.fragmentShader;
  const hasP = vs.includes('#include <project_vertex>'), hasF = vs.includes('#include <fog_vertex>');
  let fpre = '';
  if (hasP || hasF) {
    const set = '\n\tvLookW = ( mvPosition.xyz - viewMatrix[ 3 ].xyz ) * mat3( viewMatrix );\n';
    vs = 'varying vec3 vLookW;\n' + (hasP ? vs.replace('#include <project_vertex>', '#include <project_vertex>' + set) : vs.replace('#include <fog_vertex>', set + '#include <fog_vertex>'));
    fpre += 'varying vec3 vLookW;\n';
  } else fpre += '#define vLookW cameraPosition\n';
  const iF = fs.indexOf('#include <fog_fragment>');
  if (iF >= 0) { const iT = fs.indexOf('#include <tonemapping_fragment>'), iC = fs.indexOf('#include <colorspace_fragment>'); if ((iT >= 0 && iT < iF) || (iC >= 0 && iC < iF)) fpre += '#define LK_FOG_POST\n'; }
  const lit = fs.includes('#include <lights_fragment_begin>');
  // tungi (skotopik) ko'rish: tonemapping'dan oldin, chiziqli rangda; yorqin chiroqlar rangini saqlaydi
  if (!/#define\s+LK_NO_SCOTOPIC/.test(fs)) fs = fs.replace('#include <tonemapping_fragment>', '{ float lkL = dot(gl_FragColor.rgb, vec3(0.2126, 0.7152, 0.0722)); float lkS = uScotopic * (1.0 - smoothstep(0.03, 0.3, lkL)); gl_FragColor.rgb = mix(gl_FragColor.rgb, lkL * vec3(0.72, 0.87, 1.3), lkS); }\n#include <tonemapping_fragment>');
  const body = (iF >= 0 ? fog : '') + (lit ? sunocc : '');
  const iM = fs.search(/void\s+main\s*\(/); // yordamchi funksiyalar main'dan oldin (sheyderning o'z uniformlaridan keyin)
  sh.fragmentShader = decl(fs) + fpre + (iM >= 0 ? fs.slice(0, iM) + body + fs.slice(iM) : body + fs);
  sh.vertexShader = decl(vs) + vs;
}

export function initLook(game) {
  LOOK.renderer = game.renderer; LOOK.game = game; game.look = LOOK;
  U.tNoise.value = TEX.noise; U.tNrm.value = TEX.nrm;
  if (!U.tSunOcc.value) { const t = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1); t.needsUpdate = true; U.tSunOcc.value = t; }
  if (!U.tSkyLut.value) { const t = new THREE.DataTexture(new Uint8Array([150, 180, 220, 255]), 1, 1); t.needsUpdate = true; U.tSkyLut.value = t; }
  if (LOOK.ready) return LOOK;
  patchChunks();
  const P = THREE.Material.prototype;
  Object.defineProperty(P, 'onBeforeCompile', {
    configurable: true,
    get() { const m = this; return function lkCompose(sh, r) { if (m._lkU) m._lkU.call(m, sh, r); if (m._lkH) for (const h of m._lkH) h.fn.call(m, sh, r); globalPatch(sh); }; },
    set(fn) { this._lkU = fn; },
  });
  P.customProgramCacheKey = function () { let k = VER; if (this._lkU) k += '|' + this._lkU.toString(); if (this._lkH) for (const h of this._lkH) k += '|' + h.key + ':' + h.fn.toString(); return k; };
  LOOK.ready = true;
  return LOOK;
}
