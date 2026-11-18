// Protsedura shovqin teksturalari: videokartada bir marta pishiriladi (chetlari ulanadigan, mipmap bilan) — yer, yo'l, suv, bulut va detal sheyderlari uchun umumiy manba
import * as THREE from 'three';
import { FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';

// TEX.noise (RGBA): R — yumshoq fbm, G — qirrali (ridged) fbm, B — katakli (Worley F1, 0 = katak markazi), A — mayda don
// TEX.nrm   (RGBA): RG — fbm balandlik maydonining normali (xy, 0.5 = tekis), BA — shag'al/katak maydonining normali
export const TEX = { noise: null, nrm: null, size: 512, rt: {} };

const LIB = `
float h12(vec2 p){ vec3 q = fract(vec3(p.xyx) * .1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
vec2 h22(vec2 p){ vec3 q = fract(vec3(p.xyx) * vec3(.1031, .1030, .0973)); q += dot(q, q.yzx + 33.33); return fract((q.xx + q.yz) * q.zy); }
// davri "per" (butun son) bo'lgan qiymat shovqini — tekstura chetlari uzluksiz ulanadi
float vn(vec2 p, float per){ vec2 i = floor(p), f = fract(p); f = f * f * f * (f * (f * 6. - 15.) + 10.);
  float a = h12(mod(i, per)), b = h12(mod(i + vec2(1., 0.), per)), c = h12(mod(i + vec2(0., 1.), per)), d = h12(mod(i + vec2(1., 1.), per));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y); }
float fbm(vec2 uv, float per, int oct){ float s = 0., a = .5, n = 0.;
  for (int i = 0; i < 8; i++){ if (i >= oct) break; s += a * vn(uv * per + float(i) * 17.3, per); n += a; a *= .5; per *= 2.; }
  return s / n; }
float ridged(vec2 uv, float per, int oct){ float s = 0., a = .5, n = 0.;
  for (int i = 0; i < 8; i++){ if (i >= oct) break; float v = 1. - abs(2. * vn(uv * per + float(i) * 31.7 + 5.2, per) - 1.); s += a * v * v; n += a; a *= .5; per *= 2.; }
  return s / n; }
float cell(vec2 uv, float per){ vec2 p = uv * per, i = floor(p), f = fract(p); float d = 8.;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++){ vec2 g = vec2(float(x), float(y)); vec2 r = g + h22(mod(i + g, per)) - f; d = min(d, dot(r, r)); }
  return sqrt(d); }
float hA(vec2 uv){ return fbm(uv, 6., 6); }
float hB(vec2 uv){ float c = cell(uv, 20.); return smoothstep(.55, .08, c) * .8 + fbm(uv + .37, 48., 3) * .35; }`;
const VS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }';
const FS_NOISE = `varying vec2 vUv; ${LIB}
void main(){ vec2 uv = vUv; gl_FragColor = vec4(fbm(uv, 4., 6), ridged(uv, 4., 5), clamp(cell(uv, 12.), 0., 1.), fbm(uv + .37, 48., 3)); }`;
const FS_NRM = `varying vec2 vUv; uniform float uE; ${LIB}
void main(){ vec2 uv = vUv, ex = vec2(uE, 0.), ey = vec2(0., uE);
  vec2 a = vec2(hA(uv - ex) - hA(uv + ex), hA(uv - ey) - hA(uv + ey)) * 9.;
  vec2 b = vec2(hB(uv - ex) - hB(uv + ex), hB(uv - ey) - hB(uv + ey)) * 5.;
  gl_FragColor = vec4(clamp(a, -1., 1.) * .5 + .5, clamp(b, -1., 1.) * .5 + .5); }`;

export function bakeTextures(renderer, size = 512) {
  if (TEX.noise) return TEX;
  const mk = (fs, uniforms) => {
    const rt = new THREE.WebGLRenderTarget(size, size, { type: THREE.UnsignedByteType, format: THREE.RGBAFormat, depthBuffer: false, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter, wrapS: THREE.RepeatWrapping, wrapT: THREE.RepeatWrapping, colorSpace: THREE.NoColorSpace });
    rt.texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    const mat = new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: fs, uniforms, depthTest: false, depthWrite: false, toneMapped: false });
    const bake = (r) => { const quad = new FullScreenQuad(mat), prev = r.getRenderTarget(); r.setRenderTarget(rt); quad.render(r); r.setRenderTarget(prev); quad.dispose(); };
    bake(renderer); rt.bake = bake; // videokarta konteksti yo'qolib qaytsa — shu nishonga qayta pishiriladi
    return rt;
  };
  TEX.size = size;
  TEX.rt.noise = mk(FS_NOISE, {}); TEX.rt.nrm = mk(FS_NRM, { uE: { value: 1 / size } });
  TEX.noise = TEX.rt.noise.texture; TEX.nrm = TEX.rt.nrm.texture;
  return TEX;
}
// WebGL konteksti tiklangandan keyin teksturalarni o'sha nishonlarga qayta pishirish (materiallardagi havolalar o'zgarmaydi)
export function rebakeTextures(renderer) { for (const k in TEX.rt) { const rt = TEX.rt[k]; if (rt.bake) rt.bake(renderer); } return TEX; }
