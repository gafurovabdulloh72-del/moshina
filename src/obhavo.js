// Ob-havo va taqvim: o'yin kuni (hafta kuni, fasl), yomg'ir, momaqaldiroq, qor, tuman — vaqt va hudud bo'yicha almashadi; GPU zarrachalar, nam yo'l, qor qoplami, chaqmoq, ovoz, tutish (grip)
import * as THREE from 'three';
import * as T from './terrain.js';
import { LOOK } from './look.js';
import { KIND, OCC_GLSL } from './fx.js';
import { clamp, lerp, smoothstep } from './util.js';

export const WX = { ochiq: ['☀️', 'Ochiq'], bulut: ['⛅', 'Bulutli'], yomgir: ['🌧️', "Yomg'ir"], dovul: ['⛈️', 'Momaqaldiroq'], qor: ['🌨️', 'Qor'], tuman: ['🌫️', 'Tuman'] };
// [yomg'ir, qor, tuman, bulut qoplami, chaqmoq]
const PAR = { ochiq: [0, 0, 0, 0, 0], bulut: [0, 0, 0, 0.55, 0], yomgir: [0.75, 0, 0.12, 0.9, 0], dovul: [1, 0, 0.18, 1, 1], qor: [0, 0.85, 0.22, 0.85, 0], tuman: [0, 0, 1, 0.8, 0] };
// Tabiiy ob-havo (butun orol uchun "front"). Ochiq havo ustun; yomon havo kamdan-kam, lekin uzoq davom etadi:
//  - har fasl (3 o'yin kuni ≈ 1 soat real vaqt) ichida KO'PI BILAN BITTA yomon havo (yomg'ir/momaqaldiroq/qor), 9–15 o'yin soati (≈ 8–12 daqiqa);
//    undan oldin 3 soat bulut yig'iladi, keyin 2 soat bulutli bo'lib ochiladi (keskin almashmaydi)
//  - qolgan vaqtda 12 soatlik bloklar: ko'pincha ochiq, ba'zan bulutli; ba'zi kunlari tongda tuman
const SPELL = [0.8, 0.55, 0.75, 0.9]; // fasl (bahor, yoz, kuz, qish) ichida yomon havo bo'lish ehtimoli
const BAD = [[['yomgir', 0.72], ['dovul', 0.28]], [['dovul', 0.55], ['yomgir', 0.45]], [['yomgir', 0.85], ['dovul', 0.15]], [['qor', 0.85], ['yomgir', 0.15]]];
const CLOUDP = [0.24, 0.16, 0.26, 0.24], FOGP = [0.2, 0.08, 0.24, 0.18];
export const YEAR = 12, SEASONS = ['Bahor', 'Yoz', 'Kuz', 'Qish'], WEEK = ['Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba', 'Yakshanba'];
export const seasonOf = (d) => Math.floor((((d % YEAR) + YEAR) % YEAR) / 3);
const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
const EP = 72; // fasl davomiyligi (o'yin soati)
// fasl ichidagi yomon havo: [boshlanish, tugash) — fasl boshidan soatlarda; yo'q bo'lsa null
const has = (e) => hash(e * 1.37 + 0.5) < SPELL[(((e % 4) + 4) % 4)];
export function spellOf(e) { const s = (((e % 4) + 4) % 4); if (!has(e) || (has(e - 1) && hash(e * 0.71 + 3.3) < 0.4)) return null; // oldingi faslda ham bo'lgan bo'lsa — kamroq
  const len = 9 + hash(e * 2.71 + 1.3) * 6, a = 18 + hash(e * 0.53 + 7.1) * (EP - len - 30), r = hash(e * 4.13 + 2.9); let t = BAD[s][0][0], acc = 0; for (const [k, p] of BAD[s]) { acc += p; if (r < acc) { t = k; break; } }
  return { a, b: a + len, t }; }
export function natural(day, hour) {
  const H = day * 24 + hour, e = Math.floor(H / EP), u = H - e * EP, sp = spellOf(e), s = (((e % 4) + 4) % 4);
  if (sp && u >= sp.a - 3 && u < sp.b + 2) return u >= sp.a && u < sp.b ? sp.t : 'bulut';
  if (hour >= 4 && hour < 9.5 && hash(Math.floor(day) * 5.11 + 0.7) < FOGP[s]) return 'tuman'; // tuman faqat tongda
  return hash(Math.floor(H / 12) * 3.17 + 2.2) < CLOUDP[s] ? 'bulut' : 'ochiq';
}
// hudud bo'yicha: qorli tog'da yomg'ir — qor, cho'lda — bulut, yozda qor — yomg'ir
export function localType(t, x, z, day) {
  const b = T.biomeAt(x, z), y = T.gridHeight(x, z), s = seasonOf(day), B = T.BIOME;
  if (b === B.SNOW || y > T.SNOW_LO - 10) return t === 'yomgir' || t === 'dovul' ? 'qor' : t;
  if (b === B.DESERT || b === B.CANYON || b === B.VOLCANIC) return t === 'yomgir' || t === 'dovul' || t === 'qor' ? 'bulut' : t === 'tuman' ? 'ochiq' : t;
  if (s === 3 && b === B.TAIGA && (t === 'yomgir' || t === 'dovul')) return 'qor';
  if (s !== 3 && t === 'qor') return 'yomgir';
  return t;
}

const VS = `attribute vec4 aR; uniform vec3 uCam; uniform float uT; uniform float uSnow; uniform vec2 uWind; uniform float uBox; uniform float uH; uniform float uLen;
uniform mat4 uCarM; uniform vec3 uCarMin; uniform vec3 uCarMax;
${OCC_GLSL}varying vec2 vQ; varying float vA;
void main(){
  float sp = mix(13.0 + 4.0 * aR.w, 1.2 + 0.8 * aR.w, uSnow);
  vec3 vel = vec3(uWind.x, -sp, uWind.y) * vec3(mix(0.7, 1.0, uSnow), 1.0, mix(0.7, 1.0, uSnow));
  vec3 p = aR.xyz * vec3(uBox, uH, uBox) + vel * uT;
  p.x += uSnow * sin(uT * (0.7 + aR.w) + aR.y * 40.0) * 0.7; p.z += uSnow * cos(uT * (0.6 + aR.x) + aR.z * 40.0) * 0.7;
  vec3 o = uCam - vec3(uBox * 0.5, uH * 0.55, uBox * 0.5);
  vec3 w = o + mod(p - o, vec3(uBox, uH, uBox));
  vec4 c = viewMatrix * vec4(w, 1.0); vec4 mv;
  if (uSnow < 0.5) { vec3 axv = normalize(mat3(viewMatrix) * normalize(vel)); vec3 side = normalize(cross(axv, normalize(c.xyz))); float wd = 0.012 * (1.0 + length(c.xyz) * 0.07);
    mv = c + vec4(side * position.x * wd + axv * position.y * uLen * (0.8 + 0.7 * aR.w), 0.0); }
  else mv = c + vec4(position.xy * (0.045 + 0.04 * aR.w), 0.0, 0.0);
  float d = length(mv.xyz); vA = smoothstep(1.0, 3.5, d) * (1.0 - smoothstep(uBox * 0.3, uBox * 0.5, d));
  vQ = position.xy; gl_Position = projectionMatrix * mv;
  // tom, ayvon, daraxt ostida va mashina ichida zarracha ko'rinmaydi (chizilmaydi ham)
  vec3 cl = (uCarM * vec4(w, 1.0)).xyz; if (wxOcc(w) > 0.5 || (all(greaterThan(cl, uCarMin)) && all(lessThan(cl, uCarMax)))) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`;
const FS = `uniform vec3 uCol; uniform float uSnow; uniform float uAlpha; varying vec2 vQ; varying float vA;
void main(){ float a = uSnow < 0.5 ? (1.0 - abs(vQ.x)) * (1.0 - vQ.y * vQ.y) : smoothstep(1.0, 0.25, length(vQ)); gl_FragColor = vec4(uCol, a * vA * uAlpha); }`;

export function initObhavo(game) {
  const { scene, sky, car } = game, st = game.state, U = LOOK.U;
  const D0 = { day: 1, toy: -1, nav: -1 }; st.dunyo = Object.assign({}, D0, st.dunyo || {});
  const W = (game.dunyo = { force: window.__TEST ? 'ochiq' : null, // sinov rejimida boshqa sinovlar barqaror bo'lsin — ochiq havo (G.dunyo.set(null) — tabiiy)
     cur: { rain: 0, snow: 0, fog: 0, cover: 0, storm: 0 }, wet: 0, snowC: 0, flash: 0, type: 'ochiq', front: 'ochiq', grip: 1 });
  W.day = () => st.dunyo.day;
  W.weekday = (d = st.dunyo.day) => ((d % 7) + 7) % 7;
  W.season = (d = st.dunyo.day) => seasonOf(d);
  W.dateStr = (d = st.dunyo.day) => `${WEEK[W.weekday(d)]} · ${SEASONS[seasonOf(d)]}, ${((d % YEAR) + YEAR) % YEAR % 3 + 1}-kun`;
  W.typeAt = (d, h, x, z) => localType(natural(d, h), x, z, d);

  // --- zarrachalar: kamera atrofidagi qutida, sheyder ichida harakatlanadi (CPU yangilamaydi) ---
  const MAXN = 7000, g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0]), 3)); g.setIndex([0, 1, 2, 0, 2, 3]);
  { const a = new Float32Array(MAXN * 4); let s = 9137; const r = () => ((s = (s * 16807) % 2147483647) / 2147483647); for (let i = 0; i < a.length; i++) a[i] = r(); g.setAttribute('aR', new THREE.InstancedBufferAttribute(a, 4)); }
  g.instanceCount = 0;
  const FU = game.fx.uni; // to'siq uniformlari zarrachalar tizimi (fx.js) bilan umumiy — yerdagi halqalar ham tom ostida chiqmaydi
  const pu = { uCam: { value: new THREE.Vector3() }, uT: { value: 0 }, uSnow: { value: 0 }, uWind: { value: new THREE.Vector2(1, 0.4) }, uBox: { value: 30 }, uH: { value: 18 }, uLen: { value: 0.55 }, uCol: { value: new THREE.Color(0.7, 0.75, 0.8) }, uAlpha: { value: 0.5 },
    uOccD: FU.uOccD, uOccG: FU.uOccG, uOccY: FU.uOccY, uCarM: { value: new THREE.Matrix4() }, uCarMin: { value: new THREE.Vector3(1, 1, 1) }, uCarMax: { value: new THREE.Vector3(-1, -1, -1) } };
  const pm = new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: FS, uniforms: pu, transparent: true, depthWrite: false, fog: false, side: THREE.DoubleSide });
  const parts = new THREE.Mesh(g, pm); parts.frustumCulled = false; parts.renderOrder = 7; scene.add(parts); W.parts = parts;

  // --- yog'in to'sig'i: kamera ustidan pastga qaragan ortografik kamera kichik nishonga faqat chuqurlikni chizadi (tom, ayvon, soyabon, daraxt) ---
  // Mavjud materiallar o'zgarmaydi (yangi sheyder kompilyatsiyasi yo'q), soyalar qayta chizilmaydi; yog'in bo'lganda ~0,7–2 marta/s, 2 m to'rga bog'langan
  const OH = 16, OR = 64, OTOP = 32, ORNG = 64; // yarim o'lcham (m), piksel, kameradan balandlik va chuqurlik oralig'i (m)
  const ort = new THREE.WebGLRenderTarget(OR, OR, { depthBuffer: true, stencilBuffer: false }); ort.depthTexture = new THREE.DepthTexture(OR, OR); ort.depthTexture.type = THREE.UnsignedIntType;
  ort.texture.generateMipmaps = false; ort.texture.minFilter = ort.texture.magFilter = THREE.NearestFilter;
  const ocam = new THREE.OrthographicCamera(-OH, OH, OH, -OH, 0, ORNG); ocam.up.set(0, 0, -1);
  const OPEN = new Set(['velo', 'skuter', 'kart', 'moto', 'kvadro', 'bagi', 'bolid']), _bb = new THREE.Box3(), _m4 = new THREE.Matrix4();
  let occT = 9, occX = 1e9, occZ = 1e9;
  const carBox = (m) => { if (m._wxBox !== undefined) return m._wxBox; if (m.bike || OPEN.has(m.id)) return (m._wxBox = null);
    const r = m.root; r.updateMatrixWorld(true); const inv = _m4.copy(r.matrixWorld).invert(), box = new THREE.Box3();
    r.traverse((o) => { if (!o.isMesh || o.isSkinnedMesh || !o.geometry) return; const gg = o.geometry; if (!gg.boundingBox) gg.computeBoundingBox(); _bb.copy(gg.boundingBox).applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld)); box.union(_bb); });
    if (box.isEmpty()) return (m._wxBox = null); const c = box.getCenter(new THREE.Vector3()), h = box.getSize(new THREE.Vector3()).multiplyScalar(0.5); h.x *= 0.92; h.z *= 0.95; // ko'zgu, g'ildirak chetlari hisobga olinmaydi
    return (m._wxBox = { min: c.clone().sub(h), max: c.clone().add(h) }); };
  const occUpdate = (dt, cam, on) => { const G4 = FU.uOccG.value; if (!on) { G4.w = 0; occT = 9; return; }
    const cx = Math.round(cam.position.x / 2) * 2, cz = Math.round(cam.position.z / 2) * 2, mv = Math.hypot(cx - occX, cz - occZ); occT += dt;
    if (!(occT > 1.5 || (mv > 0.5 && occT > 0.5) || (mv > 10 && occT > 0.2))) return; // turganda 1,5 s da, yurganda 0,5 s da (tez yurganda 10 m da) bir marta occT = 0; occX = cx; occZ = cz;
    const r = game.renderer, top = cam.position.y + OTOP, m = game.carModel, sm = r.shadowMap, au = sm.autoUpdate, nu = sm.needsUpdate, prev = r.getRenderTarget();
    ocam.position.set(cx, top, cz); ocam.lookAt(cx, top - 1, cz); ocam.updateMatrixWorld();
    const fp = game.fx.points, fv = fp.visible; parts.visible = false; fp.visible = false; sm.autoUpdate = false; sm.needsUpdate = false;
    // o'z mashinamiz (harakatlanadi) bu xaritaga chizilmaydi — uni har kadr quti bilan tekshiramiz; DIQQAT: visible emas, qatlam (layers) — fara chirog'i sahnada qolsin, chiroqlar soni o'zgarsa hamma sheyder qayta kompilyatsiya bo'ladi
    const cm = m ? m._wxMs || (m._wxMs = (() => { const a = []; m.root.traverse((o) => { if (o.isMesh || o.isLine || o.isPoints) a.push(o); }); return a; })()) : []; for (const o of cm) { o._wxL = o.layers.mask; o.layers.mask = 1 << 30; }
    try { r.setRenderTarget(ort); r.clear(); r.render(scene, ocam); } finally { r.setRenderTarget(prev); sm.autoUpdate = au; sm.needsUpdate = nu; parts.visible = true; fp.visible = fv; for (const o of cm) o.layers.mask = o._wxL; }
    FU.uOccD.value = ort.depthTexture; G4.set(cx - OH, cz + OH, 1 / (2 * OH), 1); FU.uOccY.value.set(top, ORNG); W.occN = (W.occN || 0) + 1; };
  const carSync = () => { const m = game.carModel, b = m && m.root.visible ? carBox(m) : null; if (!b) { pu.uCarMin.value.set(1, 1, 1); pu.uCarMax.value.set(-1, -1, -1); return; }
    pu.uCarM.value.copy(m.root.matrixWorld).invert(); pu.uCarMin.value.copy(b.min); pu.uCarMax.value.copy(b.max); };
  W.occInfo = () => ({ on: FU.uOccG.value.w, n: W.occN || 0, car: pu.uCarMax.value.x > pu.uCarMin.value.x });

  // --- ovoz: yomg'ir shovqini (sintez), momaqaldiroq ---
  let rainS = null;
  const audio = () => { const A = game.audio; if (!A.ready) return null; if (!rainS) { const c = A.ctx, mk = (type, f, q) => { const s = c.createBufferSource(); s.buffer = A.noiseBuf; s.loop = true; const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q; const gg = c.createGain(); gg.gain.value = 0; s.connect(fl); fl.connect(gg); gg.connect(A.master); s.start(0, Math.random() * 1.5); return { f: fl, g: gg }; };
    rainS = { hi: mk('highpass', 1400, 0.5), lo: mk('lowpass', 380, 0.6) }; } return A; };
  const thunder = (dist) => { const A = audio(); if (!A) return; const t = A.ctx.currentTime + dist / 340, v = clamp(1.2 / (1 + dist / 700), 0.12, 0.9);
    if (dist < 900) A.burst(t, 0.35, 'bandpass', 1100, 0.8, v * 0.7, 0.4);
    A.burst(t + 0.05, 3.2 + Math.random(), 'lowpass', 220, 0.7, v, 0.35); A.tone(48, t, 2.4, 'sine', v * 0.5, null, 0.05, 0.7); A.burst(t + 0.6 + Math.random() * 0.5, 2.2, 'lowpass', 140, 0.6, v * 0.6, 0.5); };

  // --- tozalagich (kabinadan qaralganda) ---
  const wip = document.createElement('div'); wip.id = 'wiper'; wip.style.cssText = 'position:fixed;inset:0;pointer-events:none;display:none;z-index:3;overflow:hidden';
  wip.innerHTML = '<i style="position:absolute;left:30%;bottom:-2%;width:46%;height:7px;background:#16171b;border-radius:4px;transform-origin:0 50%"></i><i style="position:absolute;left:62%;bottom:-2%;width:40%;height:7px;background:#16171b;border-radius:4px;transform-origin:0 50%"></i>';
  document.body.appendChild(wip); const blades = wip.querySelectorAll('i'); let wipT = 0;

  // --- osmon va tuman: sky.setHour'dan keyin ob-havo qo'llanadi (har kadr) ---
  const sh0 = sky.setHour.bind(sky);
  sky.setHour = (h) => {
    sh0(h); const P = W.cur, F = U.uFog.value, cov = P.cover, fl = W.flash;
    // qoplangan osmon (yomg'ir, qor, tuman): bulut chegarasi pastga — osmonda ko'k "teshik" qolmaydi; osmon/tuman rangi kulrangga (yorqinlik saqlanadi);
    // quyosh allaqachon xiralashgan, shuning uchun bulut soyasi ham yumshaydi (yer ikki marta qoraymasin). Ochiq va oddiy bulutli havoda ovc = 0
    const ovc = Math.min(0.85, smoothstep(0.6, 0.9, cov) * 0.8 + P.fog * 0.3); U.uOvc.value = ovc;
    U.uCloud.value.x = lerp(U.uCloud.value.x, 1.75, cov) + 1.2 * ovc; U.uCloud.value.w = lerp(0.55, 0.15, ovc);
    if (ovc > 0.001) for (const c of [U.uFogOA.value, U.uFogOS.value, U.uFogOZ.value]) { const l = c.r * 0.2126 + c.g * 0.7152 + c.b * 0.0722; c.r += (l * 0.97 - c.r) * ovc; c.g += (l - c.g) * ovc; c.b += (l * 1.035 - c.b) * ovc; } // 0-daraja tumani (ekran rangida)
    sky.sun.intensity *= 1 - 0.42 * cov - 0.25 * P.fog; U.uSunCol.value.copy(sky.sun.color).multiplyScalar(sky.sun.intensity);
    U.uCloudSun.value.multiplyScalar(1 - 0.5 * cov);
    const base = F.x; F.x = lerp(base, Math.max(base, 0.011), P.fog) + 0.0022 * P.rain + 0.003 * P.snow; F.y = lerp(F.y, 1 / 320, P.fog);
    sky.hemi.intensity *= (1 + 0.22 * cov) * (1 + 5 * fl); scene.environmentIntensity *= (1 + 0.15 * cov) * (1 + 4 * fl);
    if (fl > 0.01) U.uCloudSun.value.addScalar(fl * 1.6);
  };

  // --- holat ---
  let lastH = game.hour, flashT = 9, flashSeq = 0, envCov = 0, tipT = 0, breathT = 0, wasSlip = false;
  const snapNow = () => { const p = game.player.onFoot ? game.player.p : car.p; const t = W.force || W.typeAt(st.dunyo.day, game.hour, p[0], p[2]); const a = PAR[t]; W.cur.rain = a[0]; W.cur.snow = a[1]; W.cur.fog = a[2]; W.cur.cover = a[3]; W.cur.storm = a[4]; W.wet = a[0] > 0.2 ? 0.9 : 0; W.snowC = a[1] > 0.2 ? 0.85 : 0; W.type = t; };
  W.snap = snapNow;
  W.set = (t) => { W.force = t && PAR[t] ? t : null; snapNow(); game._envH = (game.hour + 12) % 24; return W.type; };
  // 24 soatlik prognoz (telefon)
  W.forecast = (n = 6) => { const p = game.player.onFoot ? game.player.p : car.p, out = []; let d = st.dunyo.day, h = game.hour;
    for (let i = 0; i < n; i++) { const hh = Math.floor(h / 3) * 3 + 3 * (i + 1), dd = d + Math.floor(hh / 24), hm = hh % 24; out.push({ h: hm, day: dd, t: W.typeAt(dd, hm, p[0], p[2]) }); } return out; };

  W.update = (dt) => {
    const foot = game.player.onFoot, p = foot ? game.player.p : car.p, cam = game.camera, q = st.set.gfx;
    // taqvim: soat 24 dan o'tsa — yangi kun
    if (game.hour < lastH - 12) { st.dunyo.day++; if (W.onDay) W.onDay(st.dunyo.day); } lastH = game.hour;
    const t = W.force || W.typeAt(st.dunyo.day, game.hour, p[0], p[2]); W.front = natural(st.dunyo.day, game.hour);
    if (t !== W.type) { W.type = t; if (game.mode === 'play' && (t === 'yomgir' || t === 'dovul' || t === 'qor' || t === 'tuman')) game.toast(`${WX[t][0]} ${{ yomgir: "Yomg'ir boshlandi — yo'l sirpanchiq bo'ladi", dovul: "Momaqaldiroq! Kuchli yomg'ir — ehtiyot bo'lib hayding", qor: "Qor yog'yapti — yo'l sirpanchiq", tuman: "Quyuq tuman — faralar avtomatik yoqiladi" }[t]}`); }
    const a = PAR[t], k = Math.min(1, dt * 0.035), P = W.cur, kp = Math.min(1, dt * (a[0] + a[1] > P.rain + P.snow ? 0.016 : 0.024)); // yog'in asta boshlanadi (~1 daqiqa), biroz tezroq tinadi; bulut undan oldinroq yig'iladi
    P.rain += (a[0] - P.rain) * kp; P.snow += (a[1] - P.snow) * kp; P.fog += (a[2] - P.fog) * k * 0.8; P.cover += (a[3] - P.cover) * k; P.storm += (a[4] - P.storm) * kp;
    // namlik va qor qoplami asta yig'iladi va asta ketadi
    W.wet = clamp(W.wet + (P.rain > 0.15 ? P.rain * dt / 35 : -dt / 160), 0, 1);
    W.snowC = clamp(W.snowC + (P.snow > 0.15 ? P.snow * dt / 55 : -dt / (P.rain > 0.2 ? 60 : 260)), 0, 1);
    U.uWet.value = W.wet * (1 - W.snowC * 0.6); U.uSnowC.value = W.snowC;
    // tutish: nam yo'lda −20 %, qorda −36 % (fizikaga ko'paytuvchi; ochiq havoda aniq 1)
    W.grip = W.wet + W.snowC < 0.005 ? 1 : 1 - 0.2 * W.wet * (1 - W.snowC) - 0.36 * W.snowC; car.wetGrip = W.grip;
    const slip = W.grip < 0.88; if (slip && !wasSlip && game.mode === 'play' && !foot) game.toast("🛞 Yo'l sirpanchiq: tormoz yo'li uzayadi, burilishda sekinlang", 'bad'); wasSlip = slip;
    game.wxDark = P.fog > 0.4 || P.rain > 0.55 || P.snow > 0.6;
    // chaqmoq
    if (P.storm > 0.5) { if ((flashT -= dt) <= 0) { flashT = 6 + Math.random() * 14; flashSeq = 0.45; thunder(400 + Math.random() * 2600); } }
    if (flashSeq > 0) { flashSeq -= dt; const u = 0.45 - flashSeq; W.flash = u < 0.06 ? 1 : u < 0.12 ? 0.15 : u < 0.2 ? 0.75 : Math.max(0, 0.5 - (u - 0.2) * 2.5); } else W.flash = 0;
    if (W.force !== 'dovul' && P.storm < 0.5) flashT = Math.max(flashT, 3);
    // osmon aksi (PMREM): qoplama sezilarli o'zgarganda yangilanadi
    if (Math.abs(P.cover - envCov) > 0.12 || W.flash > 0.5) { envCov = P.cover; game._envH = (game.hour + 12) % 24; }
    // zarrachalar
    const inside = game.interior && game.interior.inside, amt = inside ? 0 : Math.max(P.rain, P.snow), snowy = P.snow > P.rain;
    const n = Math.round([1600, 3800, MAXN][q] * smoothstep(0.03, 0.9, amt)); g.instanceCount = n; parts.visible = n > 0;
    occUpdate(dt, cam, n > 0 || (P.rain > 0.2 && !inside)); if (n > 0) carSync();
    if (n > 0) { pu.uCam.value.copy(cam.position); pu.uT.value = game.time % 600; pu.uSnow.value = snowy ? 1 : 0; const wd = game.fx ? game.fx.wind : [1.2, 0, 0.4], wk = 1 + 2.5 * P.storm; pu.uWind.value.set(wd[0] * wk, wd[2] * wk);
      const L = U.uSkyAmb.value, lum = clamp(0.25 + (L.r + L.g + L.b) * 0.5, 0.18, 1.1), nt = sky.night; pu.uCol.value.setRGB(lum * (snowy ? 1.25 : 0.95), lum * (snowy ? 1.27 : 1.0), lum * (snowy ? 1.3 : 1.06)).multiplyScalar(1 - 0.55 * nt).addScalar(W.flash * 0.8 + nt * 0.04);
      pu.uAlpha.value = snowy ? 0.95 : 0.5 + 0.2 * P.storm; pu.uLen.value = 0.55 + 0.3 * P.storm; }
    // yerga tushgan tomchilar (halqa) va g'ildirak sachratqisi
    const fx = game.fx;
    if (fx && !inside && P.rain > 0.2 && game.mode !== 'menu') {
      const cp = cam.position, rate = 90 * P.rain * fx.dens; W._sp = (W._sp || 0) + rate * dt;
      while (W._sp >= 1) { W._sp--; const x = cp.x + (Math.random() - 0.5) * 26, z = cp.z + (Math.random() - 0.5) * 26, y = T.ground(x, z, cp.y + 2).y; if (y > cp.y + 1) continue; fx.emit(x, y + 0.03, z, 0, 0, 0, 0.42, 0.28, [0.75, 0.8, 0.86], 0.32, 1.9, 0, 0, KIND.RING); }
      if (!foot && W.wet > 0.3 && Math.abs(car.fwd) > 7 && car.onGround) { const sp = Math.abs(car.fwd), nn = (sp * 0.12 * W.wet * fx.dens * dt * 30) | 0; for (let i = 0; i < Math.min(3, nn + (Math.random() < 0.5 ? 1 : 0)); i++) { const w = car.wheels[2 + (i % 2)]; if (!w.on) continue; fx.emit(w.cx, w.cy + 0.15, w.cz, car.v[0] * 0.4 + (Math.random() - 0.5), 0.8 + Math.random() * 1.2, car.v[2] * 0.4 + (Math.random() - 0.5), 0.9, 0.5 + Math.random() * 0.5, [0.82, 0.85, 0.88], 0.14, 2.2, -0.2, 1.4, KIND.SMOKE); } }
    }
    // sovuqda nafas bug'i (piyoda)
    if (fx && foot && !inside && (P.snow > 0.3 || W.snowC > 0.5 || T.biomeAt(p[0], p[2]) === T.BIOME.SNOW) && (breathT -= dt) <= 0) { breathT = 2.2 + Math.random(); const pl = game.player, fy = Math.sin(pl.yaw), fz = Math.cos(pl.yaw); for (let i = 0; i < 3; i++) fx.emit(p[0] + fy * 0.3, p[1] + 1.6, p[2] + fz * 0.3, fy * 0.5 + (Math.random() - 0.5) * 0.2, 0.15, fz * 0.5 + (Math.random() - 0.5) * 0.2, 1.1, 0.16, [0.9, 0.92, 0.95], 0.22, 3, -0.05, 1.2, KIND.SMOKE); }
    // ovoz
    if (audio() && rainS) { const A = game.audio, c = A.ctx.currentTime, mute = game.mode === 'ui' || inside, inCar = !foot && game.cam.mode !== 3, r = mute ? 0 : P.rain;
      rainS.hi.g.gain.setTargetAtTime(r * (inCar ? 0.05 : 0.11), c, 0.4); rainS.hi.f.frequency.setTargetAtTime(inCar ? 900 : 1500, c, 0.4); rainS.lo.g.gain.setTargetAtTime(r * r * 0.12 + (mute ? 0 : P.snow * 0.015), c, 0.5); }
    // tozalagich: kabinadan (kamera 2) qaraganda yomg'irda
    const wOn = !foot && game.cam.mode === 2 && game.mode === 'play' && !inside && (P.rain > 0.15 || P.snow > 0.3);
    if (wOn) { wipT += dt * (0.8 + 1.4 * Math.max(P.rain, P.snow * 0.6)); const ph = wipT % 1.6, u = ph < 1.0 ? Math.sin(Math.min(ph, 1) * Math.PI) : 0, ang = -8 - 150 * u; blades[0].style.transform = `rotate(${ang}deg)`; blades[1].style.transform = `rotate(${ang}deg)`; }
    if (wOn !== W._wOn) { W._wOn = wOn; wip.style.display = wOn ? 'block' : 'none'; }
    if ((tipT -= dt) < 0) tipT = 0;
  };
  W.phoneHtml = () => { const fc = W.forecast(6), h = game.hour; const now = W.type;
    return `<div class="ph-card"><small>Hozir · ${W.dateStr()}</small><b>${WX[now][0]} ${WX[now][1]}</b><small>${W.grip < 0.97 ? `Yo'l sirpanchiq (tutish ${Math.round(W.grip * 100)}%)` : "Yo'llar quruq"}</small></div><div class="ph-fc">${fc.map((f) => `<div><small>${f.day !== st.dunyo.day ? 'Ertaga ' : ''}${String(f.h).padStart(2, '0')}:00</small><b>${WX[f.t][0]}</b><span>${WX[f.t][1]}</span></div>`).join('')}</div>${void h || ''}`; };
  snapNow(); game.hooks.push(W.update);
  return W;
}
