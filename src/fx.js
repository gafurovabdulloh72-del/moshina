// Effektlar: yorug'lik oladigan yumshoq zarrachalar (chang, tutun, sachrash, shag'al, uchqun, olov, yomg'ir), transport effektlari, aylanib uchadigan parchalar, so'nib boruvchi shina izlari va g'ildirak izlari
import * as THREE from 'three';
import * as T from './terrain.js';
import * as COL from './colliders.js';
import { TEX } from './tex.js';
import { hexLin, clamp } from './util.js';

// Zarracha turlari: shunga qarab sheyder yoritadi, cho'zadi va aralashtiradi
export const KIND = { SMOKE: 0, FIRE: 1, SPARK: 2, GRAIN: 3, WATER: 4, RING: 5, RAIN: 6 };
const S = T.SURF;

const VS = `attribute vec4 iA; attribute vec4 iB; attribute vec4 iC; attribute vec4 iD;
uniform vec3 uSunDir; uniform vec3 uSunCol; uniform vec3 uSky; uniform vec3 uGnd; uniform vec2 uFogR;
varying vec2 vUv; varying vec4 vCol; varying vec3 vInfo; varying vec3 vLight; varying float vFog; varying float vGH;
void main(){
  float kind = iC.w, sz = iA.w, r = iD.x; vec3 wp = iA.xyz; vec2 c = position.xy; vUv = c;
  vec2 cs = vec2(cos(r), sin(r)), q = vec2(c.x * cs.x - c.y * cs.y, c.x * cs.y + c.y * cs.x);
  vec4 mv; float up = 0.0;
  if (kind > 4.5 && kind < 5.5) { mv = viewMatrix * vec4(wp + vec3(q.x, 0.0, q.y) * sz, 1.0); }
  else {
    mv = viewMatrix * vec4(wp, 1.0);
    // uchqun, tomchi va donalar tezlik bo'yicha cho'ziladi (kamera ekspozitsiyasi kabi)
    float ex = kind > 5.5 ? 0.05 : kind > 3.5 ? 0.022 : kind > 2.5 ? 0.014 : kind > 1.5 ? 0.035 : kind > 0.5 ? 0.02 : 0.0;
    vec2 v2 = (mat3(viewMatrix) * iC.xyz).xy; float vl = length(v2);
    vec2 o2;
    if (ex > 0.0 && vl * ex > sz * 0.3) { vec2 d = v2 / vl; o2 = d * c.x * (sz + vl * ex * 0.5) + vec2(-d.y, d.x) * c.y * sz; }
    else o2 = q * sz;
    mv.xy += o2; up = o2.y;
  }
  gl_Position = projectionMatrix * mv;
  float dep = -mv.z;
  // kameraga juda yaqin katta zarracha ekranni to'sib qo'ymasin
  float a = iB.a * smoothstep(0.6, 0.6 + sz * 2.0, dep);
  vCol = vec4(iB.rgb, a); vInfo = vec3(kind, iD.y, iD.w);
  // yerga yumshoq tutashish: bo'lakning yerdan balandligi (iD.z — zarracha ostidagi yer)
  vGH = kind > 4.5 && kind < 5.5 ? 1.0 : (wp.y - iD.z) + up * viewMatrix[1][1];
  // yoritish: osmon/yer yoyilgan yorug'ligi + quyosh; tutun quyoshga qarab tursa yorqinroq (oldinga sochilish)
  vec3 V = normalize(wp - cameraPosition); float mu = max(dot(V, uSunDir), 0.0);
  vec3 amb = mix(uGnd, uSky, 0.62);
  float sun;
  if (kind < 0.5) sun = 0.42 + 1.5 * pow(mu, 6.0);
  else if (kind > 3.5 && kind < 4.5) sun = 0.5 + 2.4 * pow(mu, 10.0);
  else if (kind > 4.5 && kind < 5.5) sun = max(uSunDir.y, 0.0);
  else sun = 0.75;
  vLight = (amb + uSunCol * sun) * 0.3183;
  if (kind > 3.5 && kind < 4.5) vLight += uSky * 0.18;
  vFog = smoothstep(uFogR.x, uFogR.y, dep);
}`;
const FS = `uniform sampler2D tNoise; uniform vec3 uFogCol; uniform float uTime;
varying vec2 vUv; varying vec4 vCol; varying vec3 vInfo; varying vec3 vLight; varying float vFog; varying float vGH;
void main(){
  float kind = vInfo.x, seed = vInfo.y, life = vInfo.z; vec2 c = vUv; float r2 = dot(c, c); if (r2 > 1.0) discard;
  float a = vCol.a, add = 0.0; vec3 col = vCol.rgb;
  if (kind < 0.5) { // tutun/chang: shovqinli yumshoq bulut, tepasi yorug'roq
    vec2 nuv = c * 0.21 + vec2(seed, seed * 1.618) + vec2(0.0, life * 0.06);
    float n = texture2D(tNoise, nuv).r, n2 = texture2D(tNoise, nuv * 2.7 + 0.31).g;
    float d = 1.0 - r2, m = smoothstep(0.0, 0.75, d * 1.15 + (n - 0.58) * 1.5 + (n2 - 0.41) * 0.45);
    a *= m * m;
    col *= vLight * (0.78 + 0.32 * (c.y * 0.5 + 0.5)) * (0.86 + 0.34 * n);
  } else if (kind < 1.5) { // olov / nur: issiq markaz
    float d = 1.0 - r2; float n = texture2D(tNoise, c * 0.25 + seed).r;
    col *= (0.5 + 2.6 * d * d) * (0.75 + 0.5 * n); a *= d * (0.6 + 0.4 * n); add = 1.0;
  } else if (kind < 2.5) { // uchqun: ingichka yorqin chiziq
    float d = 1.0 - r2; col *= 1.0 + 4.0 * d * d; a *= smoothstep(0.0, 0.7, d); add = 1.0;
  } else if (kind < 3.5) { // shag'al, qum, qor, loy, barg: qattiq chetli mayda bo'lak
    a *= (1.0 - smoothstep(0.55, 1.0, r2)); col *= vLight * (0.8 + 0.4 * (c.y * 0.5 + 0.5));
  } else if (kind < 4.5 || kind > 5.5) { // suv: tomchilar to'dasi, yomg'ir — ingichka
    float n = texture2D(tNoise, c * 0.18 + seed).b;
    float k = kind > 5.5 ? (1.0 - smoothstep(0.0, 1.0, abs(c.y) * 1.6 + r2 * 0.3)) : (1.0 - smoothstep(0.25, 1.0, r2)) * (0.55 + 0.6 * (1.0 - smoothstep(0.15, 0.6, n)));
    a *= k; col *= vLight * (1.0 + 0.4 * (c.y * 0.5 + 0.5));
  } else { // halqa: suv ko'pigi yoki yerga yoyilgan chang
    float rr = sqrt(r2), n = texture2D(tNoise, c * 0.3 + seed).r;
    float ring = smoothstep(0.35 + 0.4 * life, 0.8, rr + (n - 0.58) * 0.35) * (1.0 - smoothstep(0.82, 1.0, rr));
    a *= ring * (0.6 + 0.6 * n); col *= vLight;
  }
  a *= smoothstep(0.0, 0.5, vGH);
  col = mix(col, uFogCol * (1.0 - add), vFog); a *= 1.0 - vFog * add;
  gl_FragColor = vec4(col, a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  gl_FragColor.rgb *= a; gl_FragColor.a = a * (1.0 - add);
}`;
// Shina izi / g'ildirak izi: tagidagi rangni ko'paytirib qoraytiradi (kun-tun farqi o'z-o'zidan to'g'ri), vaqt o'tib so'nadi
const SK_VS = `attribute vec4 aI; attribute float aL; varying vec4 vI; varying float vL; varying float vD;
void main(){ vI = aI; vL = aL; vec4 mv = modelViewMatrix * vec4(position, 1.0); vD = -mv.z; gl_Position = projectionMatrix * mv; }`;
const SK_FS = `uniform float uTime; uniform vec3 uTint[5]; uniform float uLife[5]; varying vec4 vI; varying float vL; varying float vD;
void main(){
  int k = int(vI.z + 0.5); vec3 tint = uTint[0]; float life = uLife[0];
  for (int i = 1; i < 5; i++) if (i == k) { tint = uTint[i]; life = uLife[i]; }
  float age = uTime - vI.x, f = 1.0 - smoothstep(life * 0.45, life, age);
  float x = abs(vI.w), edge = (1.0 - smoothstep(0.7, 1.0, x));
  float tread = k == 0 ? 0.85 + 0.15 * step(0.5, fract(vI.w * 2.5)) : 0.72 + 0.28 * step(0.45, fract(vL * 2.6 + vI.w * 0.4));
  float a = clamp(vI.y, 0.0, 1.0) * f * edge * tread * (1.0 - smoothstep(140.0, 260.0, vD));
  vec3 m = mix(vec3(1.0), tint, a);
  if (k > 0) m *= 1.0 + 0.1 * smoothstep(0.55, 0.95, x) * f; // iz chetidagi tuproq uyumi biroz yorug'roq
  gl_FragColor = vec4(m, 1.0);
}`;
// izning rangi (ko'paytiriladi) va umri: 0 rezina (asfalt), 1 tuproq/o't, 2 qum, 3 qor, 4 loy/shag'al
const SK_TINT = [[0.16, 0.16, 0.17], [0.6, 0.55, 0.48], [0.72, 0.62, 0.5], [0.62, 0.7, 0.84], [0.55, 0.5, 0.45]], SK_LIFE = [110, 70, 80, 90, 60];

const _c = new THREE.Color();
// doimiy ranglar (chiziqli RGB) — har zarrachada yangi massiv yaratilmasin
const C_WATER = [0.82, 0.88, 0.92], C_FOAM = [0.9, 0.93, 0.95], C_SNOW = [0.88, 0.92, 0.97], C_HOT = [0.5, 0.8, 2.4], C_RAIN = [0.75, 0.8, 0.86], C_MIST = [0.85, 0.88, 0.9], C_SPK1 = [2.4, 1.9, 1.2], C_SPK2 = [2.2, 1.25, 0.35];
const E_GRASS = [0.3, 0.25, 0.17], E_ROAD = [0.42, 0.39, 0.35], E_ROCK = [0.46, 0.43, 0.39], SIDES2 = [-1, 1], SIDES1 = [0];
// chang va donalar miqdori sirt bo'yicha (SURF tartibida): yo'l, o't, qum, qor, tosh, taxta, suv, muz, asfalt
const KD = [0, 0.12, 0.5, 0.4, 0.3, 0, 0, 0, 0], KG = [0, 0.2, 0.7, 0.6, 0.35, 0, 0, 0.15, 0]; // yo'l/asfaltda chang yo'q; yo'lsizlikda ham me'yorida (ko'rishga xalaqit bermasin)
const rnd = Math.random, rs = (k) => (rnd() - 0.5) * k;

export class FX {
  constructor(scene, renderer) {
    this.scene = scene;
    const N = (this.N = 2400);
    // simulyatsiya (CPU) massivlari
    this.pos = new Float32Array(N * 3); this.vel = new Float32Array(N * 3); this.col = new Float32Array(N * 3);
    this.life = new Float32Array(N); this.maxLife = new Float32Array(N); this.s0 = new Float32Array(N); this.grow = new Float32Array(N); this.a0 = new Float32Array(N);
    this.grav = new Float32Array(N); this.drag = new Float32Array(N); this.kind = new Uint8Array(N); this.rot = new Float32Array(N); this.rotV = new Float32Array(N); this.seed = new Float32Array(N); this.gnd = new Float32Array(N); this.gnd0 = new Float32Array(N); this.g0 = -1e9; // g0: chiqarilgan joydagi sirt (yo'l/ko'prik yerdan baland)
    this.size = new Float32Array(N); this.alpha = new Float32Array(N); // eski nomlar (tashqi kod o'qishi mumkin)
    this.next = 0; this.live = 0;
    // GPU: bitta chizish chaqiruvi — ekranga qaragan to'rtburchaklar (instancing)
    const g = new THREE.InstancedBufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0]), 3)); g.setIndex([0, 1, 2, 0, 2, 3]);
    this.gA = new Float32Array(N * 4); this.gB = new Float32Array(N * 4); this.gC = new Float32Array(N * 4); this.gD = new Float32Array(N * 4);
    this.attrs = ['iA', 'iB', 'iC', 'iD'].map((n, i) => { const a = new THREE.InstancedBufferAttribute([this.gA, this.gB, this.gC, this.gD][i], 4); a.setUsage(THREE.DynamicDrawUsage); g.setAttribute(n, a); return a; });
    g.instanceCount = 0;
    this.order = new Uint16Array(N); this.dep = new Float32Array(N); this._ord = []; this._depCmp = (a, b) => this.dep[b] - this.dep[a];
    this.uni = {
      uScale: { value: 600 }, uTime: { value: 0 }, tNoise: { value: TEX.noise },
      uSunDir: { value: new THREE.Vector3(0.4, 0.8, 0.3) }, uSunCol: { value: new THREE.Vector3(2, 2, 2) }, uSky: { value: new THREE.Vector3(0.6, 0.7, 0.9) }, uGnd: { value: new THREE.Vector3(0.4, 0.4, 0.35) },
      uFogR: { value: new THREE.Vector2(260, 5600) }, uFogCol: { value: new THREE.Color(0xbfd0e0) },
    };
    this.mat = new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: FS, uniforms: this.uni, transparent: true, depthWrite: false,
      side: THREE.DoubleSide, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor });
    this.points = new THREE.Mesh(g, this.mat); this.points.frustumCulled = false; this.points.renderOrder = 6; scene.add(this.points);
    // parchalar: notekis bo'laklar (yassi siniq va qalin bo'lak), aylanib uchadi, sakraydi, yerga yotib asta botadi
    const DN = (this.DN = 160);
    const dg = new THREE.IcosahedronGeometry(0.62, 0); dg.scale(1, 0.8, 1.15);
    this.deb = new THREE.InstancedMesh(dg, new THREE.MeshStandardMaterial({ roughness: 0.55, metalness: 0.2, flatShading: true }), DN); this.deb.frustumCulled = false; this.deb.castShadow = true; scene.add(this.deb);
    this.d = []; for (let i = 0; i < DN; i++) this.d.push({ life: 0, p: new THREE.Vector3(), v: new THREE.Vector3(), q: new THREE.Quaternion(), w: new THREE.Vector3(), s: new THREE.Vector3(), rest: false, puff: 0 });
    this.dNext = 0; this._o = new THREE.Object3D(); this._c = new THREE.Color(); this._qq = new THREE.Quaternion(); this._e = new THREE.Vector3(); this._eu = new THREE.Euler();
    for (let i = 0; i < DN; i++) { this._o.position.set(0, -999, 0); this._o.scale.setScalar(0.001); this._o.updateMatrix(); this.deb.setMatrixAt(i, this._o.matrix); this.deb.setColorAt(i, this._c.setHex(0xffffff)); }
    this.loose = []; // mashinadan ajralgan qismlar
    // shina izlari: uzluksiz lentalar (har g'ildirakka bittadan), halqa bufer
    const SN = (this.SN = 2600);
    this.skPos = new Float32Array(SN * 18); this.skI = new Float32Array(SN * 24); this.skL = new Float32Array(SN * 6);
    const sg = new THREE.BufferGeometry(); sg.setDrawRange(0, 0); this.skUsed = 0; // faqat yozilgan bo'laklar chiziladi
    this.skA = [['position', this.skPos, 3], ['aI', this.skI, 4], ['aL', this.skL, 1]].map(([n, arr, k]) => { const a = new THREE.BufferAttribute(arr, k); a.setUsage(THREE.DynamicDrawUsage); sg.setAttribute(n, a); return a; });
    this.skU = { uTime: { value: 0 }, uTint: { value: SK_TINT.map((t) => new THREE.Vector3(...t)) }, uLife: { value: SK_LIFE.slice() } };
    this.skid = new THREE.Mesh(sg, new THREE.ShaderMaterial({ vertexShader: SK_VS, fragmentShader: SK_FS, uniforms: this.skU, transparent: true, depthWrite: false, side: THREE.DoubleSide,
      blending: THREE.CustomBlending, blendSrc: THREE.ZeroFactor, blendDst: THREE.SrcColorFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 }));
    this.skid.frustumCulled = false; this.skid.renderOrder = 1; scene.add(this.skid); this.skNext = 0; this.skLast = [null, null, null, null]; this.skDirty = -1; this.skDirtyN = 0;
    // transport effektlari holati
    this.q = 2; this.dens = 1; this.auto = 0; this.cold = null; this.rain = 0; this.time = 0;
    this.wind = [1.3, 0, 0.5]; this.acc = new Float32Array(64); this.air = 0; this.vyAir = 0; this.wasWater = 0; this.track = null;
    this.lights = null;
  }
  // Sifat pog'onasi (0/1/2): zarrachalar zichligi; sheyder o'zgarmaydi
  setQuality(q) { this.q = q; this.dens = [0.5, 0.78, 1][q] ?? 1; }
  // Yomg'ir uchun ilgak: 0..1 (tomchilar kamera atrofida, yerga tekkanda halqa)
  setRain(k) { this.rain = clamp(k || 0, 0, 1); }
  // Bitta zarracha. kind berilmasa — eski chaqiruvlar uchun parametrlaridan taxmin qilinadi
  emit(x, y, z, vx, vy, vz, life, size, hex, alpha = 0.6, grow = 0, grav = 0, drag = 0, kind) {
    if (kind === undefined) { if (this.auto > 0 && this._legacyWheel(life, size, hex, grow, grav, drag)) return; kind = this._classify(size, hex, alpha, grow, grav); }
    const i = this.next; this.next = (this.next + 1) % this.N; const o = i * 3;
    this.pos[o] = x; this.pos[o + 1] = y; this.pos[o + 2] = z; this.vel[o] = vx; this.vel[o + 1] = vy; this.vel[o + 2] = vz;
    const c = typeof hex === 'number' ? hexLin(hex) : hex; this.col[o] = c[0]; this.col[o + 1] = c[1]; this.col[o + 2] = c[2];
    this.life[i] = life; this.maxLife[i] = life; this.s0[i] = size * 0.5; this.a0[i] = alpha; this.grow[i] = grow; this.grav[i] = grav; this.drag[i] = drag; this.kind[i] = kind;
    this.rot[i] = rnd() * 6.283; this.rotV[i] = kind === KIND.SMOKE ? rs(0.9) : kind === KIND.RING ? rs(0.3) : 0; this.seed[i] = rnd(); this.gnd[i] = -1e9; this.gnd0[i] = this.g0; this.size[i] = size; this.alpha[i] = alpha;
    return i;
  }
  _classify(size, hex, alpha, grow, grav) {
    const c = typeof hex === 'number' ? hexLin(hex) : hex, warm = c[0] > 0.7 && c[2] < c[0] * 0.75;
    if (hex === 0xe8ff7a) return KIND.FIRE; // yaltiroq qo'ng'iz
    if (warm && grav >= 6 && size < 0.6) return KIND.SPARK;
    if (warm && alpha >= 0.9 && (grav < 0 || grav > 0)) return KIND.FIRE; // olov, lava, tanga yaltirashi
    if (c[2] > 0.95 && c[1] > 0.78 && c[0] > 0.55 && c[0] < 0.85 && grav > 3) return KIND.WATER;
    if (grow >= 0.9 && alpha <= 0.5) return KIND.SMOKE;
    return KIND.GRAIN;
  }
  // game.js dagi eski g'ildirak effektlari: FX transportni o'zi kuzatayotganda takror chizilmasin (game.js dan olib tashlangach keraksiz)
  _legacyWheel(life, size, hex, grow, grav, drag) {
    return (grow === 2.2 && grav === -0.3 && drag === 1.2) || (hex === 0xd8f0ff && grav === 9 && drag === 0.5 && life === 0.6) || (life === 0.25 && grow === 0.6 && grav === 0 && drag === 0);
  }
  burst(n, x, y, z, speed, life, size, hex, alpha = 0.7, up = 1, grav = 4, grow = 1) {
    if (this.auto > 0 && ((n === 4 && size === 1.2 && grav === 1 && grow === 2) || (n === 26 && hex === 0xd8f0ff))) return; // qo'nish changi, suvga sachrash — FX o'zi chizadi
    const kind = this._classify(size, hex, alpha, grow, grav);
    for (let i = 0; i < n; i++) { const a = rnd() * 6.283, s = speed * (0.3 + rnd() * 0.7); this.emit(x + rs(0.6), y + rnd() * 0.4, z + rs(0.6), Math.cos(a) * s, (0.3 + rnd()) * speed * 0.6 * up, Math.sin(a) * s, life * (0.6 + rnd() * 0.6), size * (0.6 + rnd() * 0.8), hex, alpha, grow, grav, kind === KIND.SPARK ? 0.4 : 1.5, kind); }
  }
  debris(n, x, y, z, hex, speed = 6, size = 0.35, vx = 0, vz = 0) {
    for (let i = 0; i < n; i++) {
      const d = this.d[this.dNext]; const idx = this.dNext; this.dNext = (this.dNext + 1) % this.DN;
      d.life = 6 + rnd() * 4; d.rest = false; d.puff = 1; d.p.set(x + rs(0.8), y + 0.3 + rnd() * 0.8, z + rs(0.8));
      const a = rnd() * 6.283, s = speed * (0.3 + rnd() * 0.8); d.v.set(Math.cos(a) * s + vx * 0.7, 2 + rnd() * speed * 0.7, Math.sin(a) * s + vz * 0.7);
      d.w.set(rs(16), rs(16), rs(16)); d.q.setFromEuler(this._eu.set(rnd() * 6, rnd() * 6, rnd() * 6));
      const k = size * (0.5 + rnd()), flat = rnd() < 0.5; d.s.set(k * (0.6 + rnd()), k * (flat ? 0.12 + rnd() * 0.15 : 0.4 + rnd() * 0.6), k * (0.6 + rnd())); d.idx = idx;
      this.deb.setColorAt(idx, this._c.setHex(Array.isArray(hex) ? hex[(rnd() * hex.length) | 0] : hex));
    }
    this.deb.instanceColor.needsUpdate = true;
  }
  // Mashina qismini uzib yuborish
  detach(part, car) {
    const m = part.mesh; m.updateWorldMatrix(true, false);
    this.scene.attach(m);
    this.loose.push({ m, part, v: new THREE.Vector3(car.v[0] * 0.6 + rs(5), 3 + rnd() * 3, car.v[2] * 0.6 + rs(5)), w: new THREE.Vector3(rs(8), rs(8), rs(8)), life: 14 });
  }
  reattach(root) { for (const l of this.loose) { root.add(l.m); l.m.position.copy(l.part.home); l.m.rotation.set(0, 0, 0); l.m.scale.setScalar(1); l.m.visible = true; l.part.on = true; } this.loose.length = 0; }
  // Eski API: g'ildirak izi (game.js). FX transportni o'zi kuzatsa — e'tiborsiz
  skidMark(i, x, y, z, nx, nz, w) { if (this.auto > 0) return; this._ribbon(i, x, y, z, nx, nz, w, 0, 0.6, 0); }
  skidEnd(i) { if (this.auto > 0) return; this.skLast[i] = null; }
  // Lenta bo'lagi: g'ildirak i, markaz (x,y,z), yon yo'nalish (nx,nz), yarim kenglik w, iz turi t, kuchi a, bosib o'tilgan yo'l `along`
  _ribbon(i, x, y, z, nx, nz, w, t, a, along) {
    const L = this.skLast[i];
    const ax = x + nx * w, az = z + nz * w, bx = x - nx * w, bz = z - nz * w;
    if (L && L[6] === t && Math.hypot(L[0] - ax, L[2] - az) < 4) {
      const s = this.skNext, o = s * 18, p = this.skPos, I = this.skI, oi = s * 24, ol = s * 6, now = this.time;
      this.skNext = (s + 1) % this.SN;
      p[o] = L[0]; p[o + 1] = L[1]; p[o + 2] = L[2]; p[o + 3] = ax; p[o + 4] = y; p[o + 5] = az; p[o + 6] = bx; p[o + 7] = y; p[o + 8] = bz;
      p[o + 9] = L[0]; p[o + 10] = L[1]; p[o + 11] = L[2]; p[o + 12] = bx; p[o + 13] = y; p[o + 14] = bz; p[o + 15] = L[3]; p[o + 16] = L[4]; p[o + 17] = L[5];
      const la = L[7], ll = L[8], side = [1, 1, -1, 1, -1, -1], tb = [ll, now, now, ll, now, ll], aa = [la, a, a, la, a, la], al = [L[9], along, along, L[9], along, L[9]];
      for (let k = 0; k < 6; k++) { I[oi + k * 4] = tb[k]; I[oi + k * 4 + 1] = aa[k]; I[oi + k * 4 + 2] = t; I[oi + k * 4 + 3] = side[k]; this.skL[ol + k] = al[k]; }
      if (this.skDirtyN === 0) this.skDirty = s; this.skDirtyN++;
    }
    this.skLast[i] = [ax, y, az, bx, y, bz, t, a, this.time, along, x, z];
  }
  _flushSkid() {
    if (!this.skDirtyN) return;
    this.skUsed = Math.min(this.SN, this.skUsed + this.skDirtyN); this.skid.geometry.setDrawRange(0, this.skUsed * 6);
    const n = Math.min(this.skDirtyN, this.SN), s0 = this.skDirty, parts = s0 + n <= this.SN ? [[s0, n]] : [[s0, this.SN - s0], [0, s0 + n - this.SN]];
    // diapazonlar three.js yuklagach o'zi tozalaydi; bir necha yangilanish bitta kadrga to'g'ri kelsa — hammasi yig'iladi
    for (const a of this.skA) { if (a.updateRanges.length > 48) { a.clearUpdateRanges(); a.addUpdateRange(0, a.array.length); } else for (const [s, c] of parts) a.addUpdateRange(s * 6 * a.itemSize, c * 6 * a.itemSize); a.needsUpdate = true; }
    this.skDirtyN = 0;
  }
  // yer rangi (chiziqli RGB) — chang va loy shu rangdan olinadi
  groundCol(x, z, out) {
    const g = T.grid.col; if (!g) { out[0] = 0.4; out[1] = 0.36; out[2] = 0.3; return out; }
    const i = clamp(Math.round((x + T.HALF) / T.CELL), 0, T.N), j = clamp(Math.round((z + T.HALF) / T.CELL), 0, T.N), k = (j * T.NV + i) * 3;
    out[0] = g[k]; out[1] = g[k + 1]; out[2] = g[k + 2]; return out;
  }
  // fraksiyali hisoblagich bilan kadr tezligiga bog'liq bo'lmagan chiqarish soni
  _n(slot, rate, dt) { const a = (this.acc[slot] += rate * dt * this.dens), n = a | 0; this.acc[slot] = a - n; return n; }
  _lights() {
    if (!this.lights) { let sun = null, hemi = null; for (const o of this.scene.children) { if (o.isDirectionalLight && !sun) sun = o; if (o.isHemisphereLight && !hemi) hemi = o; } if (!sun) return; this.lights = { sun, hemi }; }
    const { sun, hemi } = this.lights, U = this.uni;
    U.uSunDir.value.copy(sun.position).sub(sun.target.position).normalize();
    U.uSunCol.value.set(sun.color.r, sun.color.g, sun.color.b).multiplyScalar(sun.intensity);
    if (hemi) { U.uSky.value.set(hemi.color.r, hemi.color.g, hemi.color.b).multiplyScalar(hemi.intensity); U.uGnd.value.set(hemi.groundColor.r, hemi.groundColor.g, hemi.groundColor.b).multiplyScalar(hemi.intensity); }
    const f = this.scene.fog; if (f) { U.uFogCol.value.copy(f.color); if (f.isFog) U.uFogR.value.set(f.near, f.far); }
  }
  // Transport effektlari: chang, shag'al/qum/qor sachrashi, loy, shina tutuni, izlar, suv, qo'nish, chiqindi gaz, nitro, uchqunlar
  vehicle(dt, car) {
    const sp = car.speed, R = car.R, p = car.p, v = car.v, sc = car.spec, W = car.wheels;
    const Fx = R[2], Fy = R[5], Fz = R[8], Lx = R[0], Lz = R[6], Ux = R[1], Uy = R[4], Uz = R[7];
    const gc = this._gc || (this._gc = [0, 0, 0]), dc = this._dc || (this._dc = [0, 0, 0]), K = KIND;
    const hw = clamp(sc.wid * 0.085, 0.06, 0.19); // shina yarim kengligi
    const big = clamp(sc.mass / 1500, 0.4, 2.2);
    let cold = this.cold;
    if (cold == null) { const d = this.uni.uSunDir.value; cold = d.z < 0 ? 1 : d.x > 0.2 && d.y < 0.6 ? clamp((0.6 - d.y) * 2.2, 0, 1) * 0.8 : 0; if (T.biomeAt(p[0], p[2]) === T.BIOME.SNOW) cold = 1; }
    for (let i = 0; i < 4; i++) {
      const w = W[i], sl = i * 12;
      if (!w.on) { this.skLast[i] = null; continue; }
      this.g0 = w.cy - 0.05;
      const s = w.surf, x = w.cx, y = w.cy, z = w.cz, wy = T.waterY(x, z), wet = y < wy + 0.12 && s !== S.WOOD;
      const slide = Math.abs(w.vlat) + w.slip * 5, rear = !w.front, hard = s === S.ROAD || s === S.ASPHALT || s === S.WOOD || s === S.ICE;
      const along = (w._al = (w._al || 0) + Math.abs(w.vlong) * dt);
      // --- izlar: yumshoq yerda doim (chuqurcha), qattiq yerda faqat sirpanganda (rezina) ---
      if (!wet && sp > 0.4) {
        let t = -1, a = 0;
        if (hard) { const on = this.skLast[i] && this.skLast[i][6] === 0; if (w.slip > (on ? 0.18 : 0.32) && slide > (on ? 1.2 : 2.2)) { t = 0; a = clamp(0.22 + w.slip * 0.5, 0, 0.8); } } // boshlanish va to'xtash chegarasi har xil — iz uzuq-uzuq bo'lmasin
        else if (s === S.GRASS) { t = 1; a = 0.36 + clamp(slide * 0.06, 0, 0.35); }
        else if (s === S.SAND) { t = 2; a = 0.66 + clamp(slide * 0.05, 0, 0.3); }
        else if (s === S.SNOW) { t = 3; a = 0.62 + clamp(slide * 0.05, 0, 0.3); }
        else if (s === S.ROCK) { t = 4; a = 0.2 + clamp(slide * 0.05, 0, 0.3); }
        if (t >= 0) { const L = this.skLast[i], seg = clamp(sp * 0.045, 0.35, 1.6); if (!L || L[6] !== t || Math.hypot(L[10] - x, L[11] - z) > seg) this._ribbon(i, x, y + 0.03, z, Lx, Lz, t === 0 ? hw * 0.9 : hw * (t === 3 ? 1.35 : 1.15), t, a * (t === 0 ? 1 : 0.6 + 0.4 * clamp(w.load / (sc.mass * 2.45), 0, 1.4)), along); }
        else this.skLast[i] = null;
      } else this.skLast[i] = null;
      // --- suv: g'ildiraklardan sachrash va ko'pik ---
      if (wet) {
        const dep = clamp((wy - y) / 0.5 + 0.3, 0, 1), k = clamp(sp / 8, 0, 1.5) * dep;
        for (let n = this._n(sl, 70 * k, dt); n > 0; n--) { const sd = i & 1 ? -1 : 1, out = 1.5 + sp * 0.14 + rnd() * 1.5; this.emit(x + rs(0.3), wy + 0.05, z + rs(0.3), v[0] * 0.45 + Lx * sd * out + rs(1), 1.6 + sp * 0.13 + rnd() * 2.2, v[2] * 0.45 + Lz * sd * out + rs(1), 0.6 + rnd() * 0.5, 0.25 + rnd() * 0.35, C_WATER, 0.55, 0.6, 9.8, 0.4, K.WATER); }
        for (let n = this._n(sl + 1, 7 * k, dt); n > 0; n--) this.emit(x + rs(0.4), wy + 0.04, z + rs(0.4), v[0] * 0.15, 0, v[2] * 0.15, 2.2 + rnd(), 1.2 + rnd() * 0.8, C_FOAM, 0.42, 2.4, 0, 1.5, K.RING);
        continue;
      }
      // --- chang (sirt rangida, yer bag'irlab, uzoq turadi, shamolda suriladi) ---
      const kd = KD[s] || 0;
      if (kd > 0) {
        this.groundCol(x, z, gc);
        if (s === S.SNOW || s === S.ICE) { dc[0] = 0.86; dc[1] = 0.9; dc[2] = 0.96; }
        else { const e = s === S.GRASS ? E_GRASS : s === S.ROAD ? E_ROAD : s === S.ROCK ? E_ROCK : gc, m = s === S.SAND ? 0 : s === S.ROCK ? 0.3 : 0.55; for (let k = 0; k < 3; k++) dc[k] = (gc[k] * (1 - m) + e[k] * m) * 1.15 + 0.025; }
        const rate = kd * ((rear ? 1 : 0) * Math.min(Math.max(0, sp - 3) * 0.5, 9) + Math.min(slide, 6) * 2);
        for (let n = this._n(sl + 2, rate, dt); n > 0; n--) {
          const ss = 0.55 + rnd() * 0.5;
          this.emit(x + rs(0.4) - Fx * 0.3, y + 0.25 + rnd() * 0.2, z + rs(0.4) - Fz * 0.3, v[0] * 0.22 + rs(1.6), 0.4 + rnd() * 0.9, v[2] * 0.22 + rs(1.6), 1.8 + rnd() * 1.8, ss * big, dc, (s === S.SAND || s === S.SNOW ? 0.34 : 0.26) * (0.7 + rnd() * 0.5), 3 + rnd() * 2, -0.12, 1.3, K.SMOKE);
        }
      }
      // --- shag'al, qum, qor donalari, loy bo'laklari (g'ildirakdan orqaga-yuqoriga otiladi, tushadi) ---
      const kg = KG[s] || 0;
      if (kg > 0 && (rear || slide > 2)) {
        const rate = kg * (Math.max(0, sp - 1.5) * 1.6 + slide * 10) * (hard ? clamp(w.slip, 0, 1) : 1);
        for (let n = this._n(sl + 3, rate, dt); n > 0; n--) {
          this.groundCol(x, z, gc); const sn = s === S.SNOW || s === S.ICE, mud = s === S.GRASS && rnd() < 0.7, f = sn ? 1 : 0.85 + rnd() * 0.3;
          const col = sn ? C_SNOW : dc; if (!sn) { if (mud) { dc[0] = 0.16 + rnd() * 0.05; dc[1] = 0.12; dc[2] = 0.08; } else { dc[0] = gc[0] * f; dc[1] = gc[1] * f; dc[2] = gc[2] * f; } }
          const th = 1.4 + slide * 0.5 + sp * 0.06;
          this.emit(x + rs(0.25) - Fx * 0.25, y + 0.1, z + rs(0.25) - Fz * 0.25, v[0] * 0.55 - Fx * th + rs(1.8), 1.4 + rnd() * (2.2 + slide * 0.4), v[2] * 0.55 - Fz * th + rs(1.8), 0.5 + rnd() * 0.7, (sn ? 0.09 : mud ? 0.1 : 0.06) * (0.7 + rnd() * 0.9), col, 0.95, 0, 9.8, 0.25, K.GRAIN);
        }
      }
      // --- shina tutuni: qattiq yo'lda drift yoki joyida aylantirishda — qalin, uzoq turadi ---
      if (hard && s !== S.ICE && w.slip > 0.35 && slide > 2.5) {
        const k = clamp((w.slip - 0.35) * 1.6, 0, 1.6) * clamp(slide / 6, 0.3, 1.5);
        for (let n = this._n(sl + 4, 26 * k, dt); n > 0; n--) { const g = 0.74 + rnd() * 0.12; dc[0] = g; dc[1] = g; dc[2] = g * 1.03; this.emit(x + rs(0.3), y + 0.3, z + rs(0.3), v[0] * 0.18 + rs(1.2), 0.5 + rnd() * 0.7, v[2] * 0.18 + rs(1.2), 2.8 + rnd() * 2.4, (0.7 + rnd() * 0.5) * big, dc, 0.22 + rnd() * 0.14, 4.5 + rnd() * 2.5, -0.25, 0.9, K.SMOKE); }
      }
      // --- osma oxirigacha siqilsa (pastga urilish) — tagidan uchqun ---
      if (w.comp > car.maxComp * 0.99 && sp > 5 && (s === S.ROAD || s === S.ASPHALT || s === S.ROCK)) for (let n = this._n(sl + 5, 60, dt); n > 0; n--) this._spark(x, y + 0.05, z, v, 0.6);
    }
    this.g0 = -1e9;
    // --- qo'nish: zarb kuchiga qarab chang halqasi, donalar ---
    if (car.onGround === 0) { this.air += dt; this.vyAir = Math.min(this.vyAir, v[1]); }
    else {
      if (this.air > 0.25 && this.vyAir < -3) {
        const vs = -this.vyAir;
        for (const w of W) {
          if (!w.on) continue; const s = w.surf, wy = T.waterY(w.cx, w.cz);
          if (w.cy < wy + 0.1) { this._splash(w.cx, wy, w.cz, v, vs * 0.5); continue; }
          this.groundCol(w.cx, w.cz, gc); const sn = s === S.SNOW || s === S.ICE, hd = s === S.ROAD || s === S.ASPHALT || s === S.WOOD, c = sn ? C_SNOW : dc; if (!sn) { dc[0] = gc[0] * 1.15 + 0.03; dc[1] = gc[1] * 1.12 + 0.03; dc[2] = gc[2] * 1.1 + 0.03; }
          const n = Math.round((hd ? 2 : 5 + vs * 0.8) * this.dens);
          for (let k = 0; k < n; k++) { const a = rnd() * 6.283, sv = 1.5 + rnd() * (1 + vs * 0.35); this.emit(w.cx + Math.cos(a) * 0.4, w.cy + 0.2, w.cz + Math.sin(a) * 0.4, Math.cos(a) * sv + v[0] * 0.3, 0.3 + rnd() * 0.8, Math.sin(a) * sv + v[2] * 0.3, 1.6 + rnd() * 1.5, (0.8 + rnd() * 0.6) * big, c, hd ? 0.18 : 0.32, 2.8, -0.1, 1.8, K.SMOKE); }
          if (!hd) this.emit(w.cx, w.cy + 0.05, w.cz, 0, 0, 0, 1.4, 1.2 + vs * 0.25, c, 0.3, 2.2, 0, 0, K.RING);
        }
      }
      this.air = 0; this.vyAir = 0;
    }
    // --- suvga kirish: katta sachrash ---
    if (car.inWater > 0.05 && this.wasWater <= 0.05 && sp > 3) this._splash(p[0], T.waterY(p[0], p[2]), p[2], v, sp);
    // suvda suzganda — old tomondan to'lqin va ortida iz
    if (car.inWater > 0.05 && sp > 2) {
      const wy = T.waterY(p[0], p[2]), fx = p[0] + Fx * sc.len * 0.5, fz = p[2] + Fz * sc.len * 0.5, k = clamp(sp / 10, 0, 1.4);
      for (let n = this._n(48, 40 * k, dt); n > 0; n--) { const sd = rnd() < 0.5 ? -1 : 1; this.emit(fx + Lx * sd * sc.wid * 0.4, wy + 0.1, fz + Lz * sd * sc.wid * 0.4, v[0] * 0.5 + Lx * sd * (2 + sp * 0.2), 1.2 + sp * 0.12 + rnd() * 1.5, v[2] * 0.5 + Lz * sd * (2 + sp * 0.2), 0.6 + rnd() * 0.4, 0.3 + rnd() * 0.3, C_WATER, 0.5, 0.8, 9.8, 0.3, K.WATER); }
      for (let n = this._n(49, 5 * k, dt); n > 0; n--) this.emit(p[0] - Fx * sc.len * 0.4 + rs(1), wy + 0.04, p[2] - Fz * sc.len * 0.4 + rs(1), 0, 0, 0, 3.2 + rnd(), sc.wid * 1.2, C_FOAM, 0.38, 2.2, 0, 0, K.RING);
    }
    this.wasWater = car.inWater;
    // --- chiqindi gaz: salt ishlashda siyrak, gaz bosilganda ko'p; sovuq ertalab/tunda oq va quyuq ---
    const ex = sc.power > 1500 && !car.cut && car.inWater < 0.3;
    const ee = this._ex || (this._ex = [0, 0, 0]), exh = (sd) => { const b = sc.len * 0.48, h = sc.clr + 0.12 - sc.com, o = sc.wid * 0.28 * sd; ee[0] = p[0] - Fx * b + Lx * o + Ux * h; ee[1] = p[1] - Fy * b + R[3] * o + Uy * h; ee[2] = p[2] - Fz * b + Lz * o + Uz * h; return ee; };
    if (ex) {
      const th = car.throttle || 0, rpm = car.rpm || 0.2, rate = (3 + th * rpm * 18 + cold * 9) * (car.bike ? 0.6 : 1);
      for (let n = this._n(50, rate, dt); n > 0; n--) {
        const e = exh(car.bike ? 0 : 1), gr = cold ? 0.8 + rnd() * 0.08 : 0.36 + rnd() * 0.06, al = cold ? 0.16 + th * 0.1 : 0.05 + th * rpm * 0.12; dc[0] = gr; dc[1] = gr * 1.01; dc[2] = gr * 1.05;
        this.emit(e[0], e[1], e[2], v[0] - Fx * (1 + th * 2.5) + rs(0.4), v[1] + 0.2 + rnd() * 0.3, v[2] - Fz * (1 + th * 2.5) + rs(0.4), (cold ? 1.8 : 1) + rnd() * (cold ? 1.2 : 0.6), 0.14 + rnd() * 0.08, dc, al * 0.8, cold ? 9 : 6, -0.25, 2.4, K.SMOKE);
      }
    }
    // --- nitro alangasi: ko'k o'zak, uchi zarg'aldoq, juda qisqa umr ---
    if (car.nitroOn && ex) {
      for (const sd of car.bike ? SIDES1 : SIDES2) {
        const e = exh(sd);
        for (let n = this._n(51 + (sd > 0 ? 1 : 0), 150, dt); n > 0; n--) {
          const t = rnd(), hot = t < 0.45, d = 0.15 + t * 0.7, c = hot ? C_HOT : dc; if (!hot) { dc[0] = 2.2; dc[1] = 0.9 + rnd() * 0.4; dc[2] = 0.25; }
          this.emit(e[0] - Fx * d, e[1] - Fy * d + rs(0.05), e[2] - Fz * d, v[0] - Fx * 6, v[1], v[2] - Fz * 6, hot ? 0.06 + rnd() * 0.05 : 0.09 + rnd() * 0.08, (hot ? 0.15 : 0.24) * (1 - t * 0.5), c, 0.85, hot ? 0.3 : 0.9, -1, 0, K.FIRE);
        }
      }
    }
    // --- uchqunlar: ag'darilib sirpanish va devorga ishqalanish ---
    if (sp > 3) {
      if (Uy < 0.35) { const gy = T.ground(p[0], p[2], p[1] + 1).y; if (p[1] - gy < sc.hgt * 0.9) for (let n = this._n(54, 90 * clamp(sp / 10, 0.3, 1.5), dt); n > 0; n--) this._spark(p[0] + rs(sc.wid), gy + 0.05, p[2] + rs(sc.wid), v, 0.7); }
      const rad = sc.wid * 0.5 + 0.45, list = COL.query(p[0], p[2], rad + 1);
      for (let k = 0; k < list.length; k++) {
        const o = list[k]; if (o.kind || o.y1 < p[1] - 0.6 || o.y0 > p[1] + 0.6) continue;
        let qx = o.x, qz = o.z; if (o.t === 1) { const sx = o.x2 - o.x, sz = o.z2 - o.z, t = clamp(((p[0] - o.x) * sx + (p[2] - o.z) * sz) / (sx * sx + sz * sz || 1), 0, 1); qx = o.x + sx * t; qz = o.z + sz * t; }
        const dx = qx - p[0], dz = qz - p[2], dd = Math.hypot(dx, dz) - o.r;
        // yon tomon bilan tegishi (oldi/orqasi bilan urilish — game.js zarba uchqunlari)
        const lat = Math.abs(dx * Lx + dz * Lz) - sc.wid * 0.5, lon = Math.abs(dx * Fx + dz * Fz) - sc.len * 0.5;
        if (dd < rad && lat < o.r + 0.12 && lon < 0.2) { const n0 = this._n(55, 120, dt); for (let n = n0; n > 0; n--) this._spark(qx - (dx / (dd + o.r || 1)) * o.r, p[1] - 0.1 + rnd() * 0.4, qz - (dz / (dd + o.r || 1)) * o.r, v, 0.9); break; }
      }
    }
  }
  _spark(x, y, z, v, k) {
    const c = rnd() < 0.3 ? C_SPK1 : C_SPK2;
    this.emit(x, y, z, v[0] * 0.65 + rs(5 * k), 0.8 + rnd() * 3 * k, v[2] * 0.65 + rs(5 * k), 0.25 + rnd() * 0.4, 0.035 + rnd() * 0.03, c, 1, 0, 9.8, 0.25, KIND.SPARK);
  }
  // Suvga katta sachrash: tomchilar toji, ko'pik halqalari, mayda tuman
  _splash(x, wy, z, v, sp) {
    const n = Math.round((24 + sp * 4) * this.dens), K = KIND;
    for (let i = 0; i < n; i++) { const a = rnd() * 6.283, s = 1.5 + rnd() * (2 + sp * 0.3); this.emit(x + Math.cos(a) * 0.8, wy + 0.1, z + Math.sin(a) * 0.8, Math.cos(a) * s + v[0] * 0.3, 2.5 + rnd() * (2 + sp * 0.35), Math.sin(a) * s + v[2] * 0.3, 0.7 + rnd() * 0.6, 0.3 + rnd() * 0.45, C_WATER, 0.6, 0.7, 9.8, 0.35, K.WATER); }
    for (let i = 0; i < 3; i++) this.emit(x + rs(1), wy + 0.04, z + rs(1), 0, 0, 0, 2.6 + i, 1.6 + i * 1.4 + sp * 0.12, C_FOAM, 0.45, 2.2, 0, 0, K.RING);
    for (let i = 0; i < 6 * this.dens; i++) this.emit(x + rs(2), wy + 0.6, z + rs(2), rs(2) + v[0] * 0.2, 0.8 + rnd(), rs(2) + v[2] * 0.2, 1.4 + rnd(), 1.4 + rnd(), C_MIST, 0.16, 2.5, -0.1, 1.5, K.SMOKE);
  }
  update(dt, cam) {
    this.time += dt; const t = this.time;
    this.uni.uTime.value = t; this.skU.uTime.value = t;
    this._lights();
    // kuzatilayotgan transport (camera.js `userData.safar`) yoki `fx.track`
    const link = cam && cam.userData && cam.userData.safar, car = this.track || (link && !link.foot && link.tgt && link.tgt.wheels ? link.tgt : null);
    if (car && dt > 0) { this.vehicle(dt, car); this.auto = 0.3; } else { this.auto = Math.max(0, this.auto - dt); if (!car) for (let i = 0; i < 4; i++) this.skLast[i] = null; }
    // shamol: yo'nalishi va kuchi asta o'zgaradi
    const wa = 0.4 + Math.sin(t * 0.021) * 0.9 + Math.sin(t * 0.0053) * 1.6, wsp = 1.2 + 0.7 * Math.sin(t * 0.037) + 0.4 * Math.sin(t * 0.21);
    this.wind[0] = Math.cos(wa) * wsp; this.wind[2] = Math.sin(wa) * wsp;
    // yomg'ir
    if (this.rain > 0 && cam) {
      const cp = cam.position;
      for (let n = this._n(60, 520 * this.rain, dt); n > 0; n--) { const x = cp.x + rs(46), z = cp.z + rs(46); this.emit(x, cp.y + 6 + rnd() * 12, z, this.wind[0] * 0.6, -14 - rnd() * 3, this.wind[2] * 0.6, 3, 0.022, C_RAIN, 0.35, 0, 0, 0, KIND.RAIN); }
    }
    const N = this.N, pos = this.pos, vel = this.vel, wx = this.wind[0], wz = this.wind[2], K = KIND;
    const A = this.gA, B = this.gB, C = this.gC, D = this.gD, order = this.order, dep = this.dep;
    const e = cam ? cam.matrixWorldInverse.elements : null; // ko'rish chuqurligi bo'yicha saralash uchun
    let live = 0;
    for (let i = 0; i < N; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt; const o = i * 3, k = this.kind[i];
      if (this.life[i] <= 0) { this.alpha[i] = 0; this.size[i] = 0; continue; }
      const dr = Math.min(1, this.drag[i] * dt);
      // tutun va chang havoga ergashadi (shamol), og'ir bo'laklar faqat sekinlashadi
      const wk = k === K.SMOKE || k === K.RING ? 1 : k === K.GRAIN || k === K.WATER ? 0.15 : 0;
      vel[o] += (wx * wk - vel[o]) * dr; vel[o + 2] += (wz * wk - vel[o + 2]) * dr; vel[o + 1] = vel[o + 1] * (1 - dr) - this.grav[i] * dt;
      pos[o] += vel[o] * dt; pos[o + 1] += vel[o + 1] * dt; pos[o + 2] += vel[o + 2] * dt;
      if (((i + (t * 60) | 0) & 3) === 0 || this.gnd[i] < -1e8) this.gnd[i] = Math.max(T.gridHeight(pos[o], pos[o + 2]), this.gnd0[i]);
      const gy = this.gnd[i];
      if (k === K.GRAIN || k === K.SPARK || k === K.WATER || k === K.RAIN) {
        if (pos[o + 1] < gy + 0.02 && vel[o + 1] < 0) {
          if (k === K.SPARK) { pos[o + 1] = gy + 0.02; vel[o + 1] *= -0.35; vel[o] *= 0.6; vel[o + 2] *= 0.6; }
          else if (k === K.RAIN) { this.life[i] = 0; if (rnd() < 0.25) this.emit(pos[o], gy + 0.03, pos[o + 2], 0, 0, 0, 0.45, 0.35, C_RAIN, 0.35, 1.8, 0, 0, K.RING); continue; }
          else { pos[o + 1] = gy + 0.02; vel[o] *= 0.2; vel[o + 1] = 0; vel[o + 2] *= 0.2; if (this.life[i] > 0.35) this.life[i] = 0.35; }
        }
      } else if (k === K.SMOKE && pos[o + 1] < gy + 0.1) { pos[o + 1] = gy + 0.1; if (vel[o + 1] < 0) vel[o + 1] = 0; }
      this.rot[i] += this.rotV[i] * dt;
      const tl = this.life[i] / this.maxLife[i], u = 1 - tl;
      // tutun: tez paydo bo'lib, sekin yoyiladi va eriydi (o'sish sekinlashib boradi)
      const al = k === K.SMOKE ? this.a0[i] * Math.min(1, u * 9) * (tl * tl * (3 - 2 * tl)) : this.a0[i] * Math.min(1, tl * 2.2) * Math.min(1, u * 8);
      const sz = this.s0[i] * (1 + this.grow[i] * (k === K.SMOKE || k === K.RING ? 1 - tl * tl : u));
      this.alpha[i] = al; this.size[i] = sz * 2;
      const q = live * 4;
      A[q] = pos[o]; A[q + 1] = pos[o + 1]; A[q + 2] = pos[o + 2]; A[q + 3] = sz;
      B[q] = this.col[o]; B[q + 1] = this.col[o + 1]; B[q + 2] = this.col[o + 2]; B[q + 3] = al;
      C[q] = vel[o]; C[q + 1] = vel[o + 1]; C[q + 2] = vel[o + 2]; C[q + 3] = k;
      D[q] = this.rot[i]; D[q + 1] = this.seed[i]; D[q + 2] = gy; D[q + 3] = u;
      dep[live] = e ? -(e[2] * pos[o] + e[6] * pos[o + 1] + e[10] * pos[o + 2] + e[14]) : 0; order[live] = live;
      live++;
    }
    // orqadan oldinga saralash (shaffof tutunlar to'g'ri ustma-ust tushsin)
    const g = this.points.geometry; g.instanceCount = live; this.live = live;
    if (live > 1 && e) {
      const ord = this._ord; ord.length = live; for (let i = 0; i < live; i++) ord[i] = i; ord.sort(this._depCmp);
      const tmp = this._tmp || (this._tmp = new Float32Array(N * 16));
      for (let j = 0; j < live; j++) { const s = ord[j] * 4, d = j * 16; for (let m = 0; m < 4; m++) { tmp[d + m] = A[s + m]; tmp[d + 4 + m] = B[s + m]; tmp[d + 8 + m] = C[s + m]; tmp[d + 12 + m] = D[s + m]; } }
      for (let j = 0; j < live; j++) { const s = j * 16, d = j * 4; for (let m = 0; m < 4; m++) { A[d + m] = tmp[s + m]; B[d + m] = tmp[s + 4 + m]; C[d + m] = tmp[s + 8 + m]; D[d + m] = tmp[s + 12 + m]; } }
    }
    for (const a of this.attrs) { a.clearUpdateRanges(); if (live) { a.addUpdateRange(0, live * 4); a.needsUpdate = true; } }
    this._flushSkid();
    // parchalar
    let any = false;
    for (let i = 0; i < this.DN; i++) {
      const d = this.d[i]; if (d.life <= 0) continue; any = true;
      d.life -= dt;
      const gy = T.ground(d.p.x, d.p.z, d.p.y + 1).y + d.s.y * 0.45;
      if (!d.rest) {
        d.v.y -= 16 * dt; d.p.addScaledVector(d.v, dt);
        if (d.p.y < gy) {
          d.p.y = gy;
          if (d.v.y < -2.5 && d.puff > 0) { d.puff--; this.groundCol(d.p.x, d.p.z, this._gc || (this._gc = [0, 0, 0])); const c = this._gc; c[0] = c[0] * 1.2 + 0.03; c[1] = c[1] * 1.15 + 0.03; c[2] = c[2] * 1.1 + 0.03; this.emit(d.p.x, gy + 0.1, d.p.z, d.v.x * 0.2, 0.4, d.v.z * 0.2, 1.2, 0.7, c, 0.25, 2, -0.1, 1.5, KIND.SMOKE); }
          if (d.v.y < 0) d.v.y *= -0.32; d.v.x *= 0.62; d.v.z *= 0.62; d.w.multiplyScalar(0.55);
          if (Math.abs(d.v.y) < 0.6 && d.v.x * d.v.x + d.v.z * d.v.z < 0.25) d.rest = true;
        }
        const wl = d.w.length(); if (wl > 1e-3) { this._qq.setFromAxisAngle(this._e.copy(d.w).divideScalar(wl), wl * dt); d.q.premultiply(this._qq); }
      } else d.p.y = gy;
      const sink = d.life < 1.5 ? (1.5 - Math.max(0, d.life)) * d.s.y * 0.8 : 0; // oxirida yerga botadi (kichrayib yo'qolmaydi)
      this._o.position.set(d.p.x, d.p.y - sink, d.p.z); this._o.quaternion.copy(d.q); this._o.scale.copy(d.s); if (d.life <= 0) this._o.scale.setScalar(0.001);
      this._o.updateMatrix(); this.deb.setMatrixAt(i, this._o.matrix);
    }
    if (any) this.deb.instanceMatrix.needsUpdate = true;
    for (let i = this.loose.length - 1; i >= 0; i--) {
      const l = this.loose[i]; l.life -= dt; l.v.y -= 16 * dt; l.m.position.addScaledVector(l.v, dt);
      const gy = T.ground(l.m.position.x, l.m.position.z, l.m.position.y + 1).y + 0.25;
      if (l.m.position.y < gy) { l.m.position.y = gy; if (l.v.y < 0) l.v.y *= -0.3; l.v.x *= 0.75; l.v.z *= 0.75; l.w.multiplyScalar(0.7); }
      l.m.rotation.x += l.w.x * dt; l.m.rotation.y += l.w.y * dt; l.m.rotation.z += l.w.z * dt;
      if (l.life < 0) l.m.visible = false;
    }
  }
}
