// Kuchli grafika: HDR post-ishlov (bloom, tone mapping, rang korreksiyasi, vinyetka, MSAA), suv sheyderi
// (chuqurlik rangi, qirg'oq ko'pigi, osmon aksi, quyosh jilosi), relyef teksturasi, mashina bo'yog'i uchun osmon aksi.
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import * as T from './terrain.js';
import { MAT, WIND } from './geo.js';

const NOISE = `
float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), f.x), f.y); }`;
const WATER_VS = `uniform float uTime; uniform float uAmp; varying vec3 vW;
#include <fog_pars_vertex>
void main(){
  vec4 wp = modelMatrix * vec4(position, 1.0);
  float wa = wp.x * 0.021 + uTime * 0.8, wb = wp.z * 0.027 + uTime * 1.05, wc = (wp.x + wp.z) * 0.05 + uTime * 1.5;
  wp.y += (sin(wa) * 0.5 + sin(wb) * 0.4 + sin(wc) * 0.16) * uAmp;
  vW = wp.xyz; vec4 mvPosition = viewMatrix * wp; gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;
const WATER_FS = `uniform sampler2D tH; uniform float uTime; uniform float uAmp; uniform vec3 uSunDir; uniform vec3 uSunCol; uniform vec3 uAmb; uniform vec3 uTop; uniform vec3 uHor; uniform vec3 uDeep; uniform vec3 uShallow; uniform vec4 uMap;
varying vec3 vW;
#include <fog_pars_fragment>
${NOISE}
void main(){
  vec2 p = vW.xz; float t = uTime;
  float gh = texture2D(tH, p * uMap.x + uMap.y).r;
  float depth = vW.y - gh;
  float dist = length(cameraPosition - vW), nearK = clamp(1.0 - dist / 900.0, 0.0, 1.0);
  // to'lqin normali: yirik va mayda jimirlash
  vec2 g1 = vec2(cos(p.x * 0.021 + t * 0.8) * 0.0105 + cos((p.x + p.y) * 0.05 + t * 1.5) * 0.008, cos(p.y * 0.027 + t * 1.05) * 0.0108 + cos((p.x + p.y) * 0.05 + t * 1.5) * 0.008) * uAmp;
  float r1 = vnoise(p * 0.35 + vec2(t * 0.6, t * 0.4)), r2 = vnoise(p * 0.35 + vec2(0.9 + t * 0.6, t * 0.4)), r3 = vnoise(p * 0.35 + vec2(t * 0.6, 0.9 + t * 0.4));
  float s1 = vnoise(p * 1.3 - vec2(t * 0.9, t * 0.7)), s2 = vnoise(p * 1.3 - vec2(t * 0.9 - 0.5, t * 0.7)), s3 = vnoise(p * 1.3 - vec2(t * 0.9, t * 0.7 - 0.5));
  vec2 g2 = vec2(r2 - r1, r3 - r1) * 0.42 + vec2(s2 - s1, s3 - s1) * 0.3 * nearK;
  vec3 n = normalize(vec3(-(g1.x + g2.x), 1.0, -(g1.y + g2.y)));
  vec3 V = normalize(cameraPosition - vW);
  float fres = 0.05 + 0.95 * pow(1.0 - max(dot(n, V), 0.0), 4.5);
  vec3 R = reflect(-V, n); R.y = abs(R.y);
  vec3 sky = mix(uHor, uTop, pow(clamp(R.y, 0.0, 1.0), 0.5));
  float sd = max(dot(R, uSunDir), 0.0);
  vec3 spec = uSunCol * (pow(sd, 260.0) * 9.0 + pow(sd, 28.0) * 0.35);
  float k = clamp(depth / 8.0, 0.0, 1.0);
  vec3 base = mix(uShallow, uDeep, pow(k, 0.55)) * (uAmb + uSunCol * (0.35 + 0.65 * max(dot(n, uSunDir), 0.0)));
  vec3 col = mix(base, sky, fres * 0.85) + spec;
  // qirg'oq ko'pigi
  float fn = vnoise(p * 0.9 + vec2(t * 0.5, -t * 0.35));
  float foam = smoothstep(0.75, 0.0, depth + sin(t * 1.4 + p.x * 0.3 + p.y * 0.26) * 0.22 - fn * 0.4) + smoothstep(0.62, 0.9, fn) * smoothstep(2.6, 0.4, depth) * 0.6;
  col = mix(col, (uAmb + uSunCol) * 0.95, clamp(foam, 0.0, 1.0) * 0.85 * step(-0.3, depth));
  float alpha = clamp(0.3 + depth * 0.55, 0.0, 0.96) + fres * 0.3 + foam * 0.3;
  gl_FragColor = vec4(col, clamp(alpha, 0.0, 0.97));
  #include <fog_fragment>
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
const GRADE = {
  uniforms: { tDiffuse: { value: null }, uSat: { value: 1.14 }, uCon: { value: 1.07 }, uVig: { value: 0.3 }, uTint: { value: new THREE.Vector3(1, 1, 1) } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uSat; uniform float uCon; uniform float uVig; uniform vec3 uTint; varying vec2 vUv;
    void main(){ vec4 c = texture2D(tDiffuse, vUv); vec3 col = c.rgb * uTint; float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
      col = mix(vec3(l), col, uSat); col = max((col - 0.18) * uCon + 0.18, 0.0);
      vec2 q = (vUv - 0.5) * vec2(1.0, 0.86); float v = smoothstep(0.82, 0.28, length(q)); col *= mix(1.0 - uVig, 1.0, v);
      gl_FragColor = vec4(col, c.a); }`,
};

export function initGfx(game) {
  const { renderer, scene, camera, sky } = game;
  renderer.toneMapping = THREE.NeutralToneMapping; renderer.toneMappingExposure = 1.05;

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
        diffuseColor.rgb *= 1.0 - 0.24 * cs * uDay; }`);
  };
  MAT.terrain.needsUpdate = true;

  // ---------- suv ----------
  const NV = T.NV, hd = new Uint16Array(NV * NV), gh = T.grid.h; for (let i = 0; i < hd.length; i++) hd[i] = THREE.DataUtils.toHalfFloat(Math.max(-80, Math.min(600, gh[i])));
  const hTex = new THREE.DataTexture(hd, NV, NV, THREE.RedFormat, THREE.HalfFloatType); hTex.magFilter = hTex.minFilter = THREE.LinearFilter; hTex.wrapS = hTex.wrapT = THREE.ClampToEdgeWrapping; hTex.needsUpdate = true;
  const U = { uTime: { value: 0 }, tH: { value: hTex }, uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uSunCol: { value: new THREE.Color() }, uAmb: { value: new THREE.Color() }, uTop: { value: new THREE.Color() }, uHor: { value: new THREE.Color() }, uMap: { value: new THREE.Vector4(1 / (T.CELL * NV), (T.HALF / T.CELL + 0.5) / NV, 0, 0) } };
  const waterMat = (deep, shallow, amp) => new THREE.ShaderMaterial({ vertexShader: WATER_VS, fragmentShader: WATER_FS, transparent: true, depthWrite: false, fog: true,
    uniforms: Object.assign({ fogColor: { value: new THREE.Color() }, fogNear: { value: 1 }, fogFar: { value: 2000 }, fogDensity: { value: 0.00025 }, uDeep: { value: new THREE.Color().setRGB(deep[0], deep[1], deep[2]) }, uShallow: { value: new THREE.Color().setRGB(shallow[0], shallow[1], shallow[2]) }, uAmp: { value: amp } }, U) });
  const seaMat = waterMat([0.012, 0.115, 0.3], [0.07, 0.5, 0.56], 0.55), freshMat = waterMat([0.02, 0.15, 0.3], [0.1, 0.46, 0.52], 0.1), riverMat = waterMat([0.03, 0.2, 0.34], [0.12, 0.5, 0.56], 0);
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(9000, 9000, 170, 170).rotateX(-Math.PI / 2), seaMat); sea.renderOrder = 2; sea.frustumCulled = false; scene.add(sea);
  const farMat = new THREE.MeshLambertMaterial({ color: 0x1c6aa6 }); const far = new THREE.Mesh(new THREE.PlaneGeometry(60000, 60000).rotateX(-Math.PI / 2), farMat); far.position.y = -1.6; scene.add(far);
  const lake = new THREE.Mesh(new THREE.CircleGeometry(T.LAKE.r + 75, 56).rotateX(-Math.PI / 2), freshMat); lake.position.set(T.LAKE.x, T.LAKE.y, T.LAKE.z); lake.renderOrder = 2; scene.add(lake);
  { const rv = T.getRiver(), hw = T.RIVER.hw + 9;
    for (const part of rv.parts) { const pos = []; let px0, pz0, px1, pz1, py; const a0 = part.start, b0 = part.start + part.count;
      for (let i = a0; i < b0; i += 2) { const a = Math.max(a0, i - 2), b = Math.min(b0 - 1, i + 2); let tx = rv.x[b] - rv.x[a], tz = rv.z[b] - rv.z[a]; const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l;
        const x0 = rv.x[i] + tz * hw, z0 = rv.z[i] - tx * hw, x1 = rv.x[i] - tz * hw, z1 = rv.z[i] + tx * hw, y = rv.y[i];
        if (i > a0) pos.push(px0, py, pz0, x1, y, z1, x0, y, z0, px0, py, pz0, px1, py, pz1, x1, y, z1);
        px0 = x0; pz0 = z0; px1 = x1; pz1 = z1; py = y; }
      const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); const m = new THREE.Mesh(rg, riverMat); m.renderOrder = 2; scene.add(m); } }

  // ---------- osmon aksi (mashina bo'yog'i va oynalar yaltirashi uchun) ----------
  const pmrem = new THREE.PMREMGenerator(renderer), envScene = new THREE.Scene(); envScene.add(new THREE.Mesh(new THREE.SphereGeometry(40, 24, 12), sky.dome.material));
  let envRT = null, envHour = null;
  const updEnv = () => { const rt = pmrem.fromScene(envScene, 0, 0.1, 200); if (envRT) envRT.dispose(); envRT = rt; scene.environment = rt.texture; envHour = game.hour; };

  // ---------- post-ishlov ----------
  let composer = null, bloom = null, grade = null, quality = -1;
  const size = new THREE.Vector2();
  const build = (q) => {
    quality = q; if (composer) { composer.renderTarget1.dispose(); composer.renderTarget2.dispose(); composer = null; }
    if (q === 0) return;
    renderer.getDrawingBufferSize(size);
    const rt = new THREE.WebGLRenderTarget(Math.max(2, size.x), Math.max(2, size.y), { type: THREE.HalfFloatType, samples: q === 2 ? 4 : 0 });
    composer = new EffectComposer(renderer, rt);
    composer.addPass(new RenderPass(scene, camera));
    bloom = new UnrealBloomPass(new THREE.Vector2(size.x / 2, size.y / 2), 0.32, 0.6, 1.0); composer.addPass(bloom);
    grade = new ShaderPass(GRADE); composer.addPass(grade);
    composer.addPass(new OutputPass());
  };
  const tmpC = new THREE.Color();
  const api = {
    sea, hTex,
    setQuality(q) { if (q !== quality) build(q); },
    resize() { if (!composer) return; renderer.getDrawingBufferSize(size); composer.setSize(Math.max(2, size.x), Math.max(2, size.y)); },
    update(dt, force) {
      U.uTime.value = game.time; U.uSunDir.value.copy(sky.lightDir);
      const si = sky.sun.intensity * 0.36; U.uSunCol.value.copy(sky.sun.color).multiplyScalar(si);
      U.uAmb.value.copy(sky.hemi.color).multiplyScalar(sky.hemi.intensity * 0.3);
      U.uTop.value.copy(sky.uniforms.uTop.value); U.uHor.value.copy(sky.uniforms.uHor.value);
      farMat.color.setRGB(0.012, 0.115, 0.3).multiplyScalar(2.2); uDay.value = 1 - sky.night;
      let dh = envHour == null ? 99 : Math.abs(game.hour - envHour); if (dh > 12 && dh < 90) dh = 24 - dh; if (dh > 0.45 || force) updEnv();
      if (bloom) { const n = sky.night; bloom.strength = 0.3 + 0.32 * n; bloom.threshold = 1.0 - 0.18 * n; grade.uniforms.uVig.value = 0.28 + 0.1 * n; }
    },
    render() { if (composer) composer.render(); else renderer.render(scene, camera); },
  };
  return api;
}
