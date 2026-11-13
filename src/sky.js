// Osmon, quyosh/oy, yulduzlar, bulutlar, yoritish va tuman — kun vaqti bo'yicha
import * as THREE from 'three';
import { GB } from './geo.js';
import { lerp, clamp, smoothstep, mulberry32, lerpHex } from './util.js';

// soat, osmonTepa, ufq, tuman, quyoshRangi, quyoshKuchi, hemiOsmon, hemiYer, hemiKuchi, bulutRangi
const KEYS = [
  [0.0, 0x0a1130, 0x1b2f63, 0x182a55, 0x9db8ff, 1.05, 0x4f6ed0, 0x1c2348, 1.0, 0x2a3a6e],
  [4.6, 0x0c1436, 0x24376c, 0x1c2e5c, 0x9db8ff, 1.0, 0x5070d0, 0x1c2348, 1.0, 0x2e3e72],
  [5.6, 0x33508e, 0xf7a488, 0xd8a39a, 0xff9e68, 0.9, 0x8a9ad8, 0x5a4a5a, 0.95, 0xe89a8a],
  [6.6, 0x4a86d8, 0xffd9b8, 0xf0d6c2, 0xffc890, 2.0, 0xa8c0f0, 0x76705a, 1.0, 0xffe0cc],
  [8.5, 0x3f8fe6, 0xc4e6fb, 0xc9e4f6, 0xfff4e0, 2.7, 0xc6defc, 0x86986a, 1.05, 0xffffff],
  [13.0, 0x3a8ae4, 0xbfe3fa, 0xc6e2f6, 0xffffff, 2.9, 0xcfe6ff, 0x8a9a6a, 1.05, 0xffffff],
  [16.5, 0x4688da, 0xf3dcba, 0xeeddc2, 0xffe0b0, 2.6, 0xd0dcf4, 0x9a8c6a, 1.0, 0xfff0dc],
  [18.2, 0x5262b8, 0xff9f6e, 0xf4a986, 0xff8c52, 2.1, 0xb898cc, 0x8a5a58, 0.9, 0xffb090],
  [19.2, 0x2c3180, 0xd06a98, 0x93609e, 0xd070a0, 0.6, 0x8272cc, 0x44305c, 0.92, 0xc878a8],
  [20.4, 0x0d1538, 0x243a74, 0x1c2e5c, 0x9db8ff, 0.9, 0x5070d0, 0x1c2348, 1.0, 0x30407a],
  [24.0, 0x0a1130, 0x1b2f63, 0x182a55, 0x9db8ff, 1.05, 0x4f6ed0, 0x1c2348, 1.0, 0x2a3a6e],
];
export const DAY_START = 5.4, DAY_END = 19.3;

const SKY_VS = `varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * p; gl_Position.z = gl_Position.w; }`;
const SKY_FS = `
uniform vec3 uTop; uniform vec3 uHor; uniform vec3 uSunDir; uniform vec3 uSunCol; uniform float uGlow;
varying vec3 vDir;
void main(){
  vec3 d = normalize(vDir);
  float h = clamp(d.y, -0.2, 1.0);
  float t = pow(clamp(h, 0.0, 1.0), 0.55);
  vec3 col = mix(uHor, uTop, t);
  if (h < 0.0) col = mix(uHor, uHor*0.82, clamp(-h*5.0, 0.0, 1.0));
  float sd = max(dot(d, uSunDir), 0.0);
  col += uSunCol * (pow(sd, 5.0)*0.24 + pow(sd, 60.0)*0.5 + pow(sd, 700.0)*1.2) * uGlow;
  col += uHor * 0.16 * pow(1.0 - clamp(h, 0.0, 1.0), 9.0);
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;

const farZ = (m) => { m.onBeforeCompile = (sh) => { sh.vertexShader = sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\n gl_Position.z = gl_Position.w * 0.999995;'); }; return m; };
export class Sky {
  constructor(scene, opts = {}) {
    this.scene = scene;
    this.hour = 9;
    this.night = 0; // 0..1
    this.sunDir = new THREE.Vector3(0, 1, 0);
    this.lightDir = new THREE.Vector3(0, 1, 0);
    this.fogColor = new THREE.Color();
    this._c1 = new THREE.Color(); this._c2 = new THREE.Color();

    this.uniforms = { uTop: { value: new THREE.Color() }, uHor: { value: new THREE.Color() }, uSunDir: { value: new THREE.Vector3() }, uSunCol: { value: new THREE.Color() }, uGlow: { value: 1 } };
    const dome = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), new THREE.ShaderMaterial({ vertexShader: SKY_VS, fragmentShader: SKY_FS, uniforms: this.uniforms, side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false }));
    dome.scale.setScalar(1000); dome.renderOrder = -100; dome.frustumCulled = false;
    this.dome = dome; scene.add(dome);

    // Yulduzlar
    const rg = mulberry32(77), sp = [];
    for (let i = 0; i < 900; i++) {
      const u = rg() * 2 - 1, a = rg() * Math.PI * 2, r = Math.sqrt(1 - u * u);
      const y = Math.abs(u) * 0.98 + 0.02;
      sp.push(r * Math.cos(a) * 900, y * 900, r * Math.sin(a) * 900);
    }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
    this.starMat = farZ(new THREE.PointsMaterial({ color: 0xffffff, size: 1.8, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false, depthTest: true, fog: false }));
    this.stars = new THREE.Points(sg, this.starMat); this.stars.renderOrder = 4; this.stars.frustumCulled = false; scene.add(this.stars);

    // Quyosh va oy
    const disc = new THREE.CircleGeometry(1, 24);
    this.sunMat = farZ(new THREE.MeshBasicMaterial({ color: 0xfff2c0, fog: false, depthWrite: false, depthTest: true }));
    this.sunMesh = new THREE.Mesh(disc, this.sunMat); this.sunMesh.renderOrder = 5; this.sunMesh.frustumCulled = false; scene.add(this.sunMesh);
    this.moonMat = farZ(new THREE.MeshBasicMaterial({ color: 0xf4f6ff, fog: false, depthWrite: false, depthTest: true }));
    this.moonMesh = new THREE.Mesh(disc, this.moonMat); this.moonMesh.renderOrder = 5; this.moonMesh.frustumCulled = false; scene.add(this.moonMesh);

    // Yorug'lik
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x888888, 1); scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xffffff, 2);
    this.sun.castShadow = true;
    const sh = this.sun.shadow;
    sh.mapSize.set(opts.shadowSize || 2048, opts.shadowSize || 2048);
    sh.camera.left = -95; sh.camera.right = 95; sh.camera.top = 95; sh.camera.bottom = -95; sh.camera.near = 10; sh.camera.far = 700;
    sh.bias = -0.0006; sh.normalBias = 0.5;
    scene.add(this.sun); scene.add(this.sun.target);
    scene.fog = new THREE.Fog(0xc6e2f6, 260, 5600);

    // Bulutlar
    const gb = new GB(5); gb.jit = 0.03; gb.color(0xffffff);
    const rc = mulberry32(31);
    const protos = [];
    for (let k = 0; k < 4; k++) {
      const g = new GB(100 + k); g.jit = 0.03; g.color(0xffffff);
      const n = 4 + ((rc() * 3) | 0);
      for (let i = 0; i < n; i++) g.blob(0.5 + rc() * 0.45, 1, { sy: 0.55, cx: (i - n / 2) * 0.62 + rc() * 0.2, cy: rc() * 0.18, cz: (rc() - 0.5) * 0.7, jitter: 0.06, shade: 0.12 });
      protos.push(g.build());
    }
    this.cloudMat = new THREE.MeshLambertMaterial({ vertexColors: true, fog: false, transparent: true, opacity: 0.95, emissive: 0xffffff, emissiveIntensity: 0.5 });
    this.clouds = [];
    for (let i = 0; i < 46; i++) {
      const m = new THREE.Mesh(protos[i % 4], this.cloudMat);
      const s = 150 + rc() * 260;
      m.scale.set(s, s * 0.75, s);
      m.position.set((rc() - 0.5) * 16000, 620 + rc() * 520, (rc() - 0.5) * 16000);
      m.rotation.y = rc() * 6.28;
      m.userData.v = 4 + rc() * 5;
      scene.add(m); this.clouds.push(m);
    }
    this.setHour(this.hour);
  }

  setShadowQuality(size) {
    const sh = this.sun.shadow;
    if (!size) { this.sun.castShadow = false; return; }
    this.sun.castShadow = true;
    if (sh.mapSize.x !== size) { sh.mapSize.set(size, size); if (sh.map) { sh.map.dispose(); sh.map = null; } }
  }

  setHour(h) {
    h = ((h % 24) + 24) % 24; this.hour = h;
    let i = 0; while (i < KEYS.length - 2 && KEYS[i + 1][0] <= h) i++;
    const A = KEYS[i], B = KEYS[i + 1], t = clamp((h - A[0]) / (B[0] - A[0]), 0, 1);
    const L = (k) => lerpHex(A[k], B[k], t);
    this.uniforms.uTop.value.setHex(L(1)); this.uniforms.uHor.value.setHex(L(2));
    this.fogColor.setHex(L(3)); this.scene.fog.color.copy(this.fogColor);
    this.sun.color.setHex(L(4));
    const sunInt = lerp(A[5], B[5], t);
    this.hemi.color.setHex(L(6)); this.hemi.groundColor.setHex(L(7)); this.hemi.intensity = lerp(A[8], B[8], t);
    this.cloudMat.color.setHex(L(9)); this.cloudMat.emissive.setHex(L(9)); this.cloudMat.emissiveIntensity = 0.42;
    // Quyosh va oy yo'nalishi
    const isDay = h >= DAY_START && h <= DAY_END;
    const sa = ((h - DAY_START) / (DAY_END - DAY_START)) * Math.PI;
    const nl = 24 - (DAY_END - DAY_START);
    const hn = h > DAY_END ? h - DAY_END : h + 24 - DAY_END;
    const ma = (hn / nl) * Math.PI;
    this.sunDir.set(Math.cos(sa), Math.sin(sa) * 0.92, 0.38).normalize();
    const moonDir = this._md || (this._md = new THREE.Vector3());
    moonDir.set(Math.cos(ma) * 0.8, Math.sin(ma) * 0.8 + 0.25, -0.42).normalize();
    const sunEl = this.sunDir.y;
    this.night = isDay ? 1 - smoothstep(-0.02, 0.2, sunEl) : 1;
    if (isDay) { this.lightDir.copy(this.sunDir); this.sun.intensity = sunInt * smoothstep(0.0, 0.16, sunEl); }
    else { this.lightDir.copy(moonDir); this.sun.intensity = sunInt * smoothstep(0.02, 0.3, moonDir.y) * 0.9 + 0.12; }
    if (this.lightDir.y < 0.12) { this.lightDir.y = 0.12; this.lightDir.normalize(); }
    this.uniforms.uSunDir.value.copy(isDay ? this.sunDir : moonDir);
    this.uniforms.uSunCol.value.copy(this.sun.color);
    this.uniforms.uGlow.value = isDay ? 1 : 0.35;
    this.starMat.opacity = smoothstep(0.55, 1, this.night) * 0.95;
    this.sunMesh.visible = isDay; this.moonMesh.visible = !isDay || h > 18.6;
    this._moon = moonDir; this._isDay = isDay;
    this.sunMat.color.setHex(lerpHex(0xfff6d8, 0xffb070, 1 - smoothstep(0, 0.35, sunEl))).multiplyScalar(3.4); this.moonMat.color.setRGB(1.7, 1.75, 1.9);
    // Tuman uzoqligi
    this.scene.fog.near = lerp(260, 90, this.night);
    this.scene.fog.far = lerp(5600, 3000, this.night);
  }

  update(dt, cam, focus) {
    this.dome.position.copy(cam.position);
    this.stars.position.copy(cam.position);
    this.sunMesh.position.copy(cam.position).addScaledVector(this.sunDir, 900); this.sunMesh.scale.setScalar(42); this.sunMesh.lookAt(cam.position);
    if (this._moon) { this.moonMesh.position.copy(cam.position).addScaledVector(this._moon, 900); this.moonMesh.scale.setScalar(30); this.moonMesh.lookAt(cam.position); }
    // soya kamerasi mashina atrofida (teksel bo'yicha yaxlitlash — soya titramasligi uchun)
    const f = focus || cam.position;
    this.sun.target.position.copy(f);
    this.sun.position.copy(f).addScaledVector(this.lightDir, 320);
    for (const c of this.clouds) { c.position.x += c.userData.v * dt; if (c.position.x > 8000) c.position.x = -8000; }
  }
}
