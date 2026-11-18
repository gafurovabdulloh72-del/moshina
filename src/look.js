// Umumiy ko'rinish moduli: barcha materiallarga umumiy uniformlar, atmosfera tumani, bulut va relyef soyasi, soya chetini yumshatish, hook() — onBeforeCompile'larni birlashtirish
import * as THREE from 'three';
import { TEX } from './tex.js';

const VER = 'lk4'; // sheyder kaliti versiyasi (umumiy yamoq o'zgarsa oshiriladi)
const v3 = (x, y, z) => ({ value: new THREE.Vector3(x, y, z) }), v4 = (x, y, z, w) => ({ value: new THREE.Vector4(x, y, z, w) }), col = (r, g, b) => ({ value: new THREE.Color(r, g, b) });

// Umumiy uniformlar — har materialga avtomatik beriladi (bir xil obyekt, qiymat bir joyda yangilanadi)
const U = {
  uSunDir: v3(0, 1, 0), // haqiqiy quyosh yo'nalishi (ufq ostida ham), dunyo koordinatasi
  uMoonDir: v3(0, 1, 0), // oy yo'nalishi
  uLightDir: v3(0, 1, 0), // yo'naltirilgan chiroq (sky.sun: kunduzi quyosh, kechasi oy) yo'nalishi
  uSunCol: col(1, 1, 1), // sky.sun rangi × kuchi (chiziqli HDR) — uLightDir yorug'ligi
  uSkyZen: col(0.2, 0.4, 0.9), uSkyHor: col(0.7, 0.8, 0.9), // osmon: tepa va ufq (o'rtacha), chiziqli
  uSkyHorS: col(0.8, 0.8, 0.8), uSkyHorA: col(0.6, 0.7, 0.9), uSkyGlow: col(0, 0, 0), uFogOA: col(0.8, 0.85, 0.9), uFogOS: col(0.9, 0.9, 0.9), uFogOZ: col(0.6, 0.75, 0.95), uFogOG: col(0, 0, 0), // uFogO*: shularning ekran (tonemap + sRGB) fazosidagi nusxasi — 0-daraja tuman rangini pikselda o'girmaslik uchun; 0-daraja arzon osmon: ufq quyosh tomonda / qarshi tomonda, quyosh atrofi nuri
  uSkyAmb: col(0.5, 0.6, 0.8), // osmon yoritishi (yuqoriga qaragan sirt uchun o'rtacha nurlanish)
  uFog: v4(1.6e-4, 1 / 700, 0, 0.5), // tuman: zichlik (1/m, refH balandlikda), balandlik pasayishi (1/m), refH (m), quyosh tomon sochilish kuchi
  uFogCam: { value: 1.6e-4 }, // kamera balandligidagi tuman zichligi = uFog.x·exp(−uFog.y·(kameraY − uFog.z)) — sky.update har kadrda yozadi (pikselda exp hisoblanmasin)
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
const DECL = { uSunDir: 'vec3', uMoonDir: 'vec3', uLightDir: 'vec3', uSunCol: 'vec3', uSkyZen: 'vec3', uSkyHor: 'vec3', uSkyAmb: 'vec3', uSkyHorS: 'vec3', uSkyHorA: 'vec3', uSkyGlow: 'vec3', uFogOA: 'vec3', uFogOS: 'vec3', uFogOZ: 'vec3', uFogOG: 'vec3', uFog: 'vec4', uFogCam: 'float', uTimeL: 'float', uQ: 'float', uWet: 'float', uNight: 'float', tNoise: 'sampler2D', tNrm: 'sampler2D', tSkyLut: 'sampler2D', uCloud: 'vec4', uCloudOff: 'vec2', uCloudSun: 'vec3', uCloudAmb: 'vec3', uViewPos: 'vec3', uHemiStd: 'float', uScotopic: 'float', uShadowEdge: 'vec4', tSunOcc: 'sampler2D', uOccMap: 'vec4' };

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
float lkP128(float w){ w *= w; w *= w; w *= w; w *= w; w *= w; w *= w; return w * w; } // w^128 ≈ exp(-64·(1−cosθ)) (w = 0.5 + 0.5·cosθ)
vec3 lkSkyCheap(vec3 d){ float w = dot(d, uSunDir) * 0.5 + 0.5, a = 1.0 - clamp(d.y, 0.0, 1.0), a2 = a * a, a8 = a2 * a2; a8 *= a8; // ufq yo'li keng (a^4), quyosh tomondagi yorug'lik tor (a^8)
  return uSkyZen + (uSkyHorA - uSkyZen) * (a2 * a2) + (uSkyHorS - uSkyHorA) * (w * w * a8) + uSkyGlow * lkP128(w); }
vec3 safarSky(vec3 d){ if (uQ < 0.5) return lkSkyCheap(d); float y = d.y; float v = 0.5 + 0.5 * sign(y) * sqrt(min(abs(y), 1.0)); float u = sqrt(clamp(0.5 - 0.5 * dot(d, uSunDir), 0.0, 1.0)); return texture(tSkyLut, vec2(u, v)).rgb; }
#endif
`;
const fog = sky + `#ifndef LK_FOG
#define LK_FOG
float safarFogAmount(vec3 wp){ vec3 v = wp - cameraPosition; float dist = length(v), k = uFog.y * v.y, fh;
  if (uQ < 0.5) fh = 1.0 / max(1.0 + k * (0.5 + k * 0.0833), 0.25); else fh = abs(k) > 1e-3 ? (1.0 - exp(-k)) / k : 1.0 - 0.5 * k; // 0-daraja: ratsional yaqinlashish (exp'siz)
  return 1.0 - exp(-max(uFogCam * dist * fh, 0.0)); }
vec3 safarFogColor(vec3 dir){ float sd = max(dot(dir, uSunDir), 0.0); vec3 c = safarSky(vec3(dir.x, max(dir.y, 0.0), dir.z));
  if (uQ < 0.5) return c; return c + uCloudSun * uFog.w * 0.06 * sd * sd * sd * sd * sd * sd * sd * sd; }
vec3 safarFog(vec3 c, vec3 wp){ vec3 v = wp - cameraPosition; float f = safarFogAmount(wp); return mix(c, safarFogColor(v / max(length(v), 1e-3)), f); }
#endif
`;
// bulut zichligi: p — dunyo xz (m); det — mayda detal ulushi 0..1 (manfiy — eng arzon: 2 ta tekstura o'qish)
const cloud = `#ifndef LK_CLOUD
#define LK_CLOUD
#ifdef LK_CLOUD_GRAD
vec2 lkGX = vec2(0.0), lkGY = vec2(0.0); // tekstura izi (uv birligida, 1-oktava uchun) — chaqiruvchi yozadi
vec4 lkCT(vec2 uv, float k){ if (uQ > 0.5) return textureGrad(tNoise, uv, lkGX * k, lkGY * k); return texture(tNoise, uv); }
#define LKCT(uv, k) lkCT(uv, k)
#else
#define LKCT(uv, k) texture(tNoise, uv)
#endif
float lkCloudD(vec2 p, float det){ vec2 q = (p + uCloudOff) * uCloud.y, w = uCloudOff * uCloud.y;
  float a = LKCT(q * 0.31 + 0.11, 0.31).r, b = LKCT(q * 0.93 + w * 0.3 + 0.31, 0.93).r, c = det < 0.0 ? 0.6 : LKCT(q * 2.4 - w * 0.25 + 0.57, 2.4).r;
  float n = a * 0.42 + b * 0.38 + c * 0.2;
  if (det > 0.0) { float e = LKCT(q * 1.9 + w * 0.5 + 0.77, 1.9).b, f = LKCT(q * 6.1 + w * 0.9 + 0.13, 6.1).r; n += ((0.45 - e) * 0.11 + (f - 0.58) * 0.08) * det; }
  float th = mix(0.72, 0.5, uCloud.x); return smoothstep(th, th + 0.16, n); }
float safarCloudShadow(vec3 wp){ vec3 s = uLightDir; if (s.y < 0.02 || uQ < 0.5) return 1.0; vec2 p = wp.xz + s.xz / s.y * (uCloud.z - wp.y);
  return 1.0 - uCloud.w * smoothstep(0.02, 0.15, s.y) * smoothstep(0.05, 0.75, lkCloudD(p, uQ > 1.5 ? 0.0 : -1.0)); }
#endif
`;
// to'g'ridan-to'g'ri quyosh nurini kamaytiruvchilar: bulut soyasi va relyef (tog') soyasi
const sunocc = cloud + `#ifndef LK_SUNOCC
#define LK_SUNOCC
float safarTerrainOcc(vec3 wp){ if (uOccMap.z <= 0.0 || uQ < 0.5) return 1.0; vec2 uv = wp.xz * uOccMap.x + uOccMap.y; if (any(lessThan(uv, vec2(0.0))) || any(greaterThan(uv, vec2(1.0)))) return 1.0;
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
// vFogDepth endi ishlatilmaydi (ortiqcha varying); kerak bo'lgan sheyder #define LK_FOG_DEPTH qo'ysin
const FOG_PARS_V = `#if defined( USE_FOG ) && defined( LK_FOG_DEPTH )
varying float vFogDepth;
#endif
`, FOG_V = `#if defined( USE_FOG ) && defined( LK_FOG_DEPTH )
vFogDepth = - mvPosition.z;
#endif
`, FOG_PARS_F = `#ifdef USE_FOG
uniform vec3 fogColor;
#ifdef LK_FOG_DEPTH
varying float vFogDepth;
#endif
#endif
`, FOG_F = `#ifdef USE_FOG
{ vec3 lkV = vLookW - cameraPosition; float lkL = length(lkV); vec3 lkD = lkV / max(lkL, 1e-3), lkC; float lkF;
#if defined( LK_FOG_POST ) && defined( TONE_MAPPING )
  if ( uQ < 0.5 ) { // 0-daraja: ekran fazosidagi tayyor ranglar, exp2 va bitta bo'lish (LUT, tonemap, sRGB pikselda yo'q)
    float lkW = dot(lkD, uSunDir) * 0.5 + 0.5; lkC = mix(mix(uFogOA, uFogOS, lkW * lkW), uFogOZ, max(lkD.y, 0.0));
    lkF = 1.0 - exp2(-1.4427 * uFogCam * lkL / max(1.0 + 0.5 * uFog.y * lkV.y, 0.25));
  } else { lkF = safarFogAmount(vLookW); lkC = linearToOutputTexel(vec4(toneMapping(safarFogColor(lkD)), 1.0)).rgb; }
#else
  lkF = safarFogAmount(vLookW); lkC = safarFogColor(lkD);
  #if defined( LK_FOG_POST )
  lkC = linearToOutputTexel(vec4(lkC, 1.0)).rgb;
  #endif
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
  // 0-daraja arzon yo'l: g'adir-budur (roughness ≥ 0.5) Standard materiallarda IBL va to'g'ridan-to'g'ri ko'zgu (GGX) hisoblanmaydi — Lambert narxiga yaqin
  const lm = C.lights_fragment_maps, irrOld = 'iblIrradiance += getIBLIrradiance( geometryNormal );', radOld = 'radiance += getIBLRadiance( geometryViewDir, geometryNormal, material.roughness );';
  const lp = C.lights_physical_pars_fragment, ggxOld = 'reflectedLight.directSpecular += irradiance * BRDF_GGX( directLight.direction, geometryViewDir, geometryNormal, material );';
  const le = C.lights_fragment_end, isOld = 'RE_IndirectSpecular( radiance, iblIrradiance, clearcoatRadiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );';
  const pf = C.lights_physical_fragment, grOld = 'vec3 dxy = max( abs( dFdx( nonPerturbedNormal ) ), abs( dFdy( nonPerturbedNormal ) ) );\nfloat geometryRoughness = max( max( dxy.x, dxy.y ), dxy.z );';
  if (lm.includes(irrOld) && lm.includes(radOld) && lp.includes(ggxOld) && le.includes(isOld) && pf.includes(grOld)) {
    const cheap = '( uQ > 0.5 || roughness < 0.5 )'; // roughness — material uniformi (barcha piksellarda bir xil shart)
    // IBL o'qishlari va RE_IndirectSpecular bitta shartli blokda (dasturiy renderda tarqoq bloklar o'tkazib yuborilsa ham qimmat)
    C.lights_fragment_maps = lm.replace(irrOld, '').replace(radOld, '');
    C.lights_physical_pars_fragment = lp.replace(ggxOld, 'if ' + cheap + ' ' + ggxOld);
    C.lights_fragment_end = le.replace(isOld, 'if ' + cheap + ` {
	#if defined( USE_ENVMAP ) && defined( STANDARD ) && defined( ENVMAP_TYPE_CUBE_UV )
		iblIrradiance += getIBLIrradiance( geometryNormal );
	#endif
	#if defined( USE_ENVMAP )
		${radOld}
	#endif
		${isOld}
	}`);
    C.lights_physical_fragment = pf.replace(grOld, 'float geometryRoughness = 0.0;\nif ( uQ > 0.5 || roughnessFactor < 0.5 ) { vec3 dxy = max( abs( dFdx( nonPerturbedNormal ) ), abs( dFdy( nonPerturbedNormal ) ) ); geometryRoughness = max( max( dxy.x, dxy.y ), dxy.z ); }');
  } else console.warn('look: lights_fragment_maps / lights_physical_pars_fragment kutilganidek emas');
  // 0-daraja: soya xaritasidan 16 o'rniga 4 ta (apparat bilinear taqqoslash) o'qish — soya chekkasi biroz qattiqroq, lekin narx Lambert davridagidan past
  { const sp = C.shadowmap_pars_fragment, i0 = sp.indexOf('float getShadow('), a0 = '#elif defined( SHADOWMAP_TYPE_PCF_SOFT )', b0 = '#elif defined( SHADOWMAP_TYPE_VSM )';
    const ia = i0 < 0 ? -1 : sp.indexOf(a0, i0), ib = ia < 0 ? -1 : sp.indexOf(b0, ia);
    if (ib > 0) C.shadowmap_pars_fragment = sp.slice(0, ia) + a0 + `
			if ( uQ < 0.5 ) { vec2 lkT = 0.5 / shadowMapSize;
				shadow = 0.25 * ( texture2DCompare( shadowMap, shadowCoord.xy - lkT, shadowCoord.z ) + texture2DCompare( shadowMap, shadowCoord.xy + lkT, shadowCoord.z ) + texture2DCompare( shadowMap, shadowCoord.xy + vec2( lkT.x, - lkT.y ), shadowCoord.z ) + texture2DCompare( shadowMap, shadowCoord.xy + vec2( - lkT.x, lkT.y ), shadowCoord.z ) );
			} else {` + sp.slice(ia + a0.length, ib) + '\t\t\t}\n\t\t' + sp.slice(ib);
    else console.warn('look: shadowmap_pars_fragment kutilganidek emas'); }
  C.lights_fragment_begin = lf.replace(shOld, shNew)
    .replace(giOld, giOld + '\n\t\tdirectLight.color *= lkSunOccF;')
    .replace('#if ( NUM_DIR_LIGHTS > 0 ) && defined( RE_Direct )', '#if ( NUM_DIR_LIGHTS > 0 ) && defined( RE_Direct )\n\tfloat lkSunOccF = 1.0; if ( uQ > 0.5 ) lkSunOccF = safarSunOcc( vLookW );')
    .replace(hemiOld, 'irradiance += getHemisphereLightIrradiance( hemisphereLights[ i ], geometryNormal ) * lkHemiK;')
    .replace('#if defined( RE_IndirectDiffuse )', `#if defined( RE_IndirectDiffuse )
	#if defined( STANDARD ) && defined( ENVMAP_TYPE_CUBE_UV )
	float lkHemiK = uQ < 0.5 ? 1.0 : uHemiStd; // 0-darajada atrof-muhit xaritasi o'qilmaydi — osmon yoritishi yarim shar chirog'idan
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
  const iF = fs.indexOf('#include <fog_fragment>'), lit = fs.includes('#include <lights_fragment_begin>');
  let fpre = '';
  if ((hasP || hasF) && (iF >= 0 || lit)) { // vLookW faqat tuman yoki yoritish uchun (soya chuqurlik materiallari kabi boshqalarga ortiqcha varying qo'shilmaydi)
    const set = '\n\tvLookW = ( mvPosition.xyz - viewMatrix[ 3 ].xyz ) * mat3( viewMatrix );\n';
    vs = 'varying vec3 vLookW;\n' + (hasP ? vs.replace('#include <project_vertex>', '#include <project_vertex>' + set) : vs.replace('#include <fog_vertex>', set + '#include <fog_vertex>'));
    fpre += 'varying vec3 vLookW;\n';
  } else fpre += '#define vLookW cameraPosition\n';
  if (iF >= 0) { const iT = fs.indexOf('#include <tonemapping_fragment>'), iC = fs.indexOf('#include <colorspace_fragment>'); if ((iT >= 0 && iT < iF) || (iC >= 0 && iC < iF)) fpre += '#define LK_FOG_POST\n'; }
  // tungi (skotopik) ko'rish: tonemapping'dan oldin, chiziqli rangda; yorqin chiroqlar rangini saqlaydi
  if (!/#define\s+LK_NO_SCOTOPIC/.test(fs)) fs = fs.replace('#include <tonemapping_fragment>', 'if ( uScotopic > 0.001 && uQ > 0.5 ) { float lkL = dot(gl_FragColor.rgb, vec3(0.2126, 0.7152, 0.0722)); float lkS = uScotopic * (1.0 - smoothstep(0.03, 0.3, lkL)); gl_FragColor.rgb = mix(gl_FragColor.rgb, lkL * vec3(0.86, 0.9, 1.16), lkS); }\n#include <tonemapping_fragment>');
  const body = (iF >= 0 ? fog : '') + (lit ? sunocc : '');
  const iM = fs.search(/void\s+main\s*\(/); // yordamchi funksiyalar main'dan oldin (sheyderning o'z uniformlaridan keyin)
  sh.fragmentShader = decl(fs) + fpre + (iM >= 0 ? fs.slice(0, iM) + body + fs.slice(iM) : body + fs);
  sh.vertexShader = decl(vs) + vs;
}

// chiziqli HDR rang -> ekran rangi (three'ning NeutralToneMapping + sRGB, JS'da; 0-daraja tuman uchun)
const srgb = (c) => (c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);
function toOut(c, out) {
  const e = LOOK.renderer ? LOOK.renderer.toneMappingExposure : 1, r = LOOK.renderer && LOOK.renderer.toneMapping === THREE.NeutralToneMapping;
  let x = c.r * e, y = c.g * e, z = c.b * e;
  if (r) { const m = Math.min(x, y, z), off = m < 0.08 ? m - 6.25 * m * m : 0.04; x -= off; y -= off; z -= off; const pk = Math.max(x, y, z), S = 0.76, d = 1 - S;
    if (pk >= S) { const np = 1 - (d * d) / (pk + d - S), k = np / pk, g = 1 - 1 / (0.15 * (pk - np) + 1); x = x * k + (np - x * k) * g; y = y * k + (np - y * k) * g; z = z * k + (np - z * k) * g; } }
  return out.setRGB(srgb(Math.min(Math.max(x, 0), 1)), srgb(Math.min(Math.max(y, 0), 1)), srgb(Math.min(Math.max(z, 0), 1)));
}
const tmpCol = new THREE.Color();
// sky.setHour chaqiradi: 0-daraja tuman ranglarini ekran fazosida tayyorlaydi
export function syncFogOut() {
  toOut(U.uSkyHorA.value, U.uFogOA.value); toOut(U.uSkyHorS.value, U.uFogOS.value); toOut(U.uSkyZen.value, U.uFogOZ.value);
  toOut(tmpCol.copy(U.uSkyHorS.value).add(U.uSkyGlow.value), U.uFogOG.value); U.uFogOG.value.sub(U.uFogOS.value);
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
