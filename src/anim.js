// Odam harakati: protsedura skelet animatsiyasi — holatlar aralashmasi, qadam rejalashtiruvchi (oyoq yerga mixlanadi), 2 bo'g'imli IK, prujinalar, nigoh, nafas
import * as THREE from 'three';
import * as T from './terrain.js';

export const B = { body: 0, hips: 1, spine: 2, chest: 3, neck: 4, head: 5, clavL: 6, upL: 7, foreL: 8, handL: 9, fingL: 10, clavR: 11, upR: 12, foreR: 13, handR: 14, fingR: 15, thighL: 16, shinL: 17, footL: 18, toeL: 19, thighR: 20, shinR: 21, footR: 22, toeR: 23 };
export const NB = 24;
const PAR = [-1, 0, 1, 2, 3, 4, 3, 6, 7, 8, 9, 3, 11, 12, 13, 14, 1, 16, 17, 18, 1, 20, 21, 22];
// Umumiy muhit: kamera (uzoqlik bo'yicha tejash), o'yinchi (NPC nigohi), barcha odamlar ro'yxati
const ENV = { cam: null, player: null, rigs: [], time: 0, grips: null };
export function rigEnv(o) { Object.assign(ENV, o); }
const SHADOW_D = [24, 34, 46]; // sifat pog'onasi bo'yicha odam soyasi masofasi (m)
// kamera ko'rish konusida (odam radiusi bilan) — ENV.cam matritsasi bo'yicha, ajratmasiz
function inView(P) { const c = ENV.cam, e = c.matrixWorldInverse.elements, x = P.x, y = P.y + 0.9, z = P.z;
  const vx = e[0] * x + e[4] * y + e[8] * z + e[12], vy = e[1] * x + e[5] * y + e[9] * z + e[13], vz = e[2] * x + e[6] * y + e[10] * z + e[14];
  if (vz > 1.6) return false; const d = Math.max(0, -vz), tv = Math.tan((c.fov || 60) * Math.PI / 360); return Math.abs(vy) < d * tv + 1.6 && Math.abs(vx) < d * tv * (c.aspect || 1.8) + 1.6; }

// ---- kanallar ----
const CH = {}; let nch = 0; for (const k of ['PX', 'PY', 'PZ', 'BX', 'BY', 'BZ', 'HX', 'HY', 'HZ', 'SX', 'SY', 'SZ', 'CX', 'CY', 'CZ', 'NX', 'NY', 'KX', 'KY', 'KZ', 'LOOK']) CH[k] = nch++;
const ARM = ['CLE', 'CLP', 'UF', 'UA', 'UR', 'EF', 'EP', 'WF', 'WD', 'FG'], LEG = ['TF', 'TA', 'TR', 'KF', 'AF', 'TP', 'LIK'];
const AL = nch; nch += ARM.length; const AR = nch; nch += ARM.length; const LL = nch; nch += LEG.length; const LR = nch; nch += LEG.length;
const NCH = nch; ARM.forEach((k, i) => { CH[k + 'L'] = AL + i; CH[k + 'R'] = AR + i; }); LEG.forEach((k, i) => { CH[k + 'L'] = LL + i; CH[k + 'R'] = LR + i; });
const NEUT = new Float32Array(NCH); { const n = NEUT; for (const o of [AL, AR]) { n[o + 2] = 0.07; n[o + 3] = 0.11; n[o + 4] = 0.1; n[o + 5] = 0.3; n[o + 6] = 0.45; n[o + 7] = 0.12; n[o + 9] = 0.45; } n[LL + 6] = 1; n[LR + 6] = 1; n[CH.LOOK] = 1; }
// prujina tezligi (rad/s) kanal bo'yicha: tana — tez (qadam tebranishi yo'qolmasin), qo'l — sekinroq (inersiya), bosh — eng sekin
const OMEGA = new Float32Array(NCH).fill(40); { for (const k of ['PX', 'PY', 'PZ', 'HX', 'HY', 'HZ']) OMEGA[CH[k]] = 70; for (const k of ['SX', 'SY', 'SZ', 'CX', 'CY', 'CZ']) OMEGA[CH[k]] = 45; for (const k of ['NX', 'NY', 'KX', 'KY', 'KZ']) OMEGA[CH[k]] = 22; for (const o of [AL, AR]) { for (let i = 0; i < 10; i++) OMEGA[o + i] = 38; OMEGA[o + 7] = OMEGA[o + 8] = OMEGA[o + 9] = 36; } for (const o of [LL, LR]) for (let i = 0; i < 7; i++) OMEGA[o + i] = 50; OMEGA[CH.BX] = OMEGA[CH.BY] = OMEGA[CH.BZ] = 30; OMEGA[CH.LOOK] = 8; }

// ---- yordamchilar ----
const sn = Math.sin, cs = Math.cos, PI = Math.PI, TAU = PI * 2;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v), lerp = (a, b, t) => a + (b - a) * t, fr = (x) => x - Math.floor(x);
const sm = (a, b, x) => { const t = cl((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const ang = (a) => { while (a > PI) a -= TAU; while (a < -PI) a += TAU; return a; };
// silliq bo'lakli egri: [[x, y], ...] nuqtalari orasida smoothstep
const curve = (P, x) => { if (x <= P[0][0]) return P[0][1]; for (let i = 1; i < P.length; i++) if (x <= P[i][0]) { const a = P[i - 1], b = P[i], t = (x - a[0]) / (b[0] - a[0]); return a[1] + (b[1] - a[1]) * t * t * (3 - 2 * t); } return P[P.length - 1][1]; };
// kritik so'nuvchi prujina (aniq yechim): x, v -> maqsad g ga
const spring = (x, v, i, g, w, dt) => { const e = Math.exp(-w * dt), d = x[i] - g, c = v[i] + w * d; x[i] = g + (d + c * dt) * e; v[i] = (v[i] - w * c * dt) * e; };
const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
// past chastotali shovqin (idle mayda harakatlar uchun)
const noise1 = (t, s) => sn(t * 1.0 + s) * 0.5 + sn(t * 2.3 + s * 1.7) * 0.3 + sn(t * 4.1 + s * 2.9) * 0.2;

const V3 = () => new THREE.Vector3(), Q4 = () => new THREE.Quaternion();
const _e = new THREE.Euler(), _q = Q4(), _q2 = Q4(), _q3 = Q4(), _v = V3(), _v2 = V3(), _v3 = V3(), _v4 = V3(), _m = new THREE.Matrix4(), _Y = new THREE.Vector3(0, 1, 0);
const qE = (q, x, y, z, o) => q.setFromEuler(_e.set(x, y, z, o));

const STATES = ['loco', 'air', 'swim', 'sit', 'bend', 'shake', 'dance', 'wave', 'talk', 'play', 'fish', 'swing', 'fall', 'pet', 'lie', 'eat', 'cook', 'drink', 'wash', 'shower', 'read', 'horn', 'kurash'];
const BLEND = { loco: 0.16, air: 0.07, swim: 0.3, sit: 0.35, bend: 0.2, shake: 0.18, dance: 0.3, wave: 0.2, talk: 0.3, play: 0.3, fish: 0.25, swing: 0.15, fall: 0.08, pet: 0.25, lie: 0.45, eat: 0.35, cook: 0.25, drink: 0.2, wash: 0.25, shower: 0.3, read: 0.3, horn: 0.35, kurash: 0.22 };
const MAP = { idle: 'loco', walk: 'loco', run: 'loco', jump: 'air' };
const IVAR = ['look', 'stretch', 'watch', 'scratch', 'hips', 'cross', 'shrug', 'look'];
const IVAR_M = ['look', 'roll', 'watch', 'neck', 'cross', 'look', 'stretch', 'roll', 'scratch', 'hips']; // erkak: yelka aylantirish, bo'yin cho'zish, atrofga qarash

export function initAnim(rig) {
  const sd = rig.seed, A = {
    kneesW: 0, stepCool: 0, swPh: 0, takeSp: 0, hg: 0, jumped: false, vyLast: 0, dropS: 0,
    w: Object.fromEntries(STATES.map((k) => [k, k === 'loco' ? 1 : 0])), wv: Object.fromEntries(STATES.map((k) => [k, 0])), st: 'loco', stT: 0,
    x: new Float32Array(NCH), v: new Float32Array(NCH), buf: new Float32Array(NCH), acc: new Float32Array(NCH), req: new Float32Array(12), reqAcc: new Float32Array(12),
    Ql: Array.from({ length: NB }, Q4), Qw: Array.from({ length: NB }, Q4), Pw: Array.from({ length: NB }, V3), rest: rig.bones.map((b) => b.position.clone()), align: [], len: [],
    ph: hash(sd) , gaitOn: false, beta: 0.6, g: 0, s2: 0, m: 0, sp: 0, vx: 0, vz: 0, px: null, pz: 0, yaw0: null, yawRate: 0, acc0: 0, accF: 0, fat: 0, br: hash(sd + 1) * 6, brPer: 3.4 + hash(sd + 2) * 1.4,
    wsPh: hash(sd + 3) * 30, wsPer: 6 + hash(sd + 4) * 5, ivNext: 3 + hash(sd + 5) * 7, iv: null, ivT: 0, idleT: 0, gest: null, gestT: 0,
    land: 0, landV: 0, airT: 0, air: false, takeY: 0, lead: 1, peakY: 0, vyMax: 0, grounded: true,
    ft: [0, 1].map((i) => ({ slp: 0, slr: 0, liftH: 0.05, lx: 0, lz: 0, mode: 0, wx: 0, wz: 0, wyaw: 0, sx: 0, sz: 0, syaw: 0, tx: 0, tz: 0, tyaw: 0, u: 0, dur: 0.34, lift: 0.05, gait: false, gy: 0, nx: 0, nz: 0, pitch: 0, toe: 0, ready: false, gyT: 0 })),
    lookX: 0, lookY: 0, lookW: 0, contact: 0, lodAcc: 0, skipT: 0, actDur: 1, t: 0, first: true,
  };
  // suyak tinch yo'nalishlari (IK uchun): bola bo'g'imi qayerda
  for (let i = 0; i < NB; i++) { const ch = PAR.indexOf(i), c = ch >= 0 ? A.rest[ch] : null; if (c && (i === B.thighL || i === B.thighR || i === B.shinL || i === B.shinR || i === B.upL || i === B.upR || i === B.foreL || i === B.foreR)) { const d = c.clone().normalize(); A.align[i] = Q4().setFromUnitVectors(new THREE.Vector3(0, -1, 0), d).invert(); A.len[i] = c.length(); } }
  // tovon va panja nuqtalari (to'piq atrofida aylanish uchun)
  A.aH = rig.J[B.footL][1]; A.heel = -0.058 * rig.s; A.ball = A.rest[B.toeL].z; A.H0 = rig.J[B.body][1]; A.hipX = rig.J[B.thighL][0];
  A.L1 = A.len[B.thighL]; A.L2 = A.len[B.shinL]; A.LS = A.L1 + A.L2;
  // erkak harakati (mk): og'ir, mustahkam qadam — kam son tebranishi, keng tik turish, yelkadan qo'l silkitish; ayollarda (mk=0) avvalgi uslub
  A.mk = rig.fem ? 0 : 0.7 + 0.3 * (rig.mu != null ? rig.mu : 1); A.stW = lerp(0.11, 0.135, A.mk) * rig.s; A.cadK = lerp(1, 0.92, A.mk);
  rig.A = A; A.x.set(NEUT); ENV.rigs.push(rig);
}

// ===================== QADAM REJALASHTIRUVCHI =====================
// Har oyoq dunyo koordinatasida: tayanchda (mixlangan nuqta) yoki havoda (boshlang'ich -> mo'ljal). Yurishda faza bilan, turganda — xato katta bo'lsa kichik qadam
function planFeet(rig, A, dt, root, yaw, grounded) {
  const s = rig.s, sp = A.sp, F = A.ft, cy = cs(yaw), sy = sn(yaw), rq = A.reqAcc;
  const toW = (lx, lz, out, ya = yaw, ox = root.x, oz = root.z) => { const c = cs(ya), si = sn(ya); out[0] = ox + lx * c + lz * si; out[1] = oz - lx * si + lz * c; return out; };
  const tw = [0, 0];
  A.contact = 0;
  if (!grounded || A.wFK > 0.98) { // havoda / suvda: oyoqlar FK, yerga tushganda shu joydan boshlanadi
    for (let i = 0; i < 2; i++) { const f = F[i], sd = i ? -1 : 1; toW(sd * A.stW, 0, tw); f.mode = 0; f.wx = tw[0]; f.wz = tw[1]; f.wyaw = yaw + sd * 0.08; f.pitch = 0; f.toe = 0; f.gait = false; f.ready = true; }
    A.gaitOn = false; return;
  }
  if (A.first || !F[0].ready) { for (let i = 0; i < 2; i++) { const f = F[i], sd = i ? -1 : 1; toW(sd * A.stW, (i ? -0.03 : 0.03) * s, tw); f.wx = tw[0]; f.wz = tw[1]; f.wyaw = yaw + sd * 0.08; f.mode = 0; f.ready = true; } }
  const g = A.g, s2 = A.s2, c = lerp(1.45 + 0.28 * sp, 2.6 + 0.2 * sp, g) * A.cadK, beta = lerp(0.6, lerp(0.38, 0.3, s2), g), ff = lerp(0.36, lerp(0.34, 0.3, s2), g);
  A.beta = beta; A.cad = c;
  const w0 = lerp(0.1, 0.05, g) * s * lerp(1, 1.18, A.mk), vlx = A.vx * cy - A.vz * sy, vlz = A.vx * sy + A.vz * cy, dx = sp > 0.05 ? vlx / sp : 0, dz = sp > 0.05 ? vlz / sp : 1;
  const moving = sp > 0.28;
  if (moving && !A.gaitOn) { // yurishni boshlash: orqadagi oyoq birinchi ko'tariladi
    let lift = 0, worst = -1e9; for (let i = 0; i < 2; i++) { const f = F[i], lz = (f.wx - root.x) * sy + (f.wz - root.z) * cy, e = -(lz * dz) + (i ? 0.001 : 0); if (e > worst) { worst = e; lift = i; } }
    A.ph = fr(beta - lift * 0.5 + 0.001); A.gaitOn = true; for (const f of F) f.gait = false;
  }
  if (A.gaitOn) {
    A.ph = fr(A.ph + (c / 2) * dt);
    const T2 = 2 / c, D = sp * beta * T2;
    let anySwing = false;
    for (let i = 0; i < 2; i++) {
      const f = F[i], sd = i ? -1 : 1, p = fr(A.ph + i * 0.5), stance = p < beta;
      if (stance) {
        if (f.mode === 1) { f.mode = 0; f.wx = f.tx; f.wz = f.tz; f.wyaw = f.tyaw; A.contact |= 1 << i; } // yerga tegdi
        const us = p / beta; f.pitch = A.m * (g < 0.5 ? curve([[0, -0.3], [0.13, 0], [0.48, 0], [1, 0.95]], us) : curve([[0, -0.05], [0.18, 0], [0.36, 0], [1, lerp(1.0, 1.15, s2)]], us)) * 1; f.toe = f.pitch > 0 ? -f.pitch * 0.85 : 0;
        // tayanch oyog'i juda orqada qolsa (keskin burilish/tormoz) — erta ko'tariladi
        const hx = f.wx - root.x, hz = f.wz - root.z; if (hx * hx + hz * hz > (0.9 * A.LS) * (0.9 * A.LS)) { A.ph = fr(beta - i * 0.5 + 0.002); }
      } else {
        const u = (p - beta) / (1 - beta);
        if (f.mode === 0) { f.mode = 1; f.sx = f.wx; f.sz = f.wz; f.syaw = f.wyaw; f.gait = true; }
        anySwing = true;
        const tt = (1 - p) * T2, pyaw = yaw + cl(A.yawRate * tt, -0.7, 0.7), lx = sd * w0 * dz + ff * D * dx, lz = -sd * w0 * dx + ff * D * dz;
        toW(lx, lz + (sp < 0.05 ? (i ? -0.03 : 0.03) * s : 0), tw, pyaw, root.x + A.vx * tt, root.z + A.vz * tt);
        f.tx = tw[0]; f.tz = tw[1]; f.tyaw = pyaw + sd * lerp(0.1, 0.04, g);
        const e = lerp(u * u * (3 - 2 * u), u, 0.35 * g);
        f.wx = lerp(f.sx, f.tx, e); f.wz = lerp(f.sz, f.tz, e); f.wyaw = f.syaw + ang(f.tyaw - f.syaw) * e;
        const H = A.m * lerp(0.075 * lerp(1, 0.85, A.mk), lerp(0.2, 0.33, s2) * lerp(1, 1.05, A.mk), g) * s, peakAt = lerp(0.5, 0.36, g);
        f.lift = H * sn(PI * Math.pow(u, Math.log(0.5) / Math.log(peakAt)));
        f.pitch = A.m * (g < 0.5 ? curve([[0, 0.95], [0.25, 0.4], [0.7, -0.08], [1, -0.3]], u) : curve([[0, 1.1], [0.3, 1.05], [0.75, -0.05], [1, -0.05]], u)); f.toe = u < 0.15 ? -0.4 * (1 - u / 0.15) : 0;
      }
    }
    if (!moving && !anySwing) A.gaitOn = false; // to'xtadi: oxirgi qadam tugadi
    return;
  }
  // ---- turish: oyoqlar mixlangan; mo'ljaldan uzoqlashsa (burilish, holat talabi) — kichik qadam ----
  const wantStep = rq[11] > 0.5 ? 0.045 * s : 0.13 * s;
  for (let i = 0; i < 2; i++) {
    const f = F[i], sd = i ? -1 : 1;
    const lx = sd * (A.stW + rq[i * 5]), lz = (i ? -0.03 : 0.03) * s + rq[i * 5 + 1]; toW(lx, lz, tw);
    const tyaw = yaw + sd * 0.1;
    if (f.mode === 1) { // kichik qadam davom etmoqda
      f.u += dt / f.dur; const u = Math.min(1, f.u), e = u * u * (3 - 2 * u); f.tx = tw[0]; f.tz = tw[1]; f.tyaw = tyaw;
      f.wx = lerp(f.sx, f.tx, e); f.wz = lerp(f.sz, f.tz, e); f.wyaw = f.syaw + ang(f.tyaw - f.syaw) * e; f.lift = f.liftH * sn(PI * u); f.pitch = -0.12 * sn(PI * u); f.toe = 0;
      if (u >= 1) { f.mode = 0; f.lift = 0; A.contact |= 1 << i; A.stepCool = 0.08; }
    } else { f.lift = 0; f.pitch = 0; f.toe = 0; }
  }
  A.stepCool = (A.stepCool || 0) - dt;
  if (F[0].mode === 0 && F[1].mode === 0 && A.stepCool <= 0) { // eng uzoqlashgan oyoq qadam tashlaydi
    let best = -1, be = 0; for (let i = 0; i < 2; i++) { const f = F[i], sd = i ? -1 : 1; toW(sd * (A.stW + rq[i * 5]), (i ? -0.03 : 0.03) * s + rq[i * 5 + 1], tw); const e = Math.hypot(f.wx - tw[0], f.wz - tw[1]) + Math.abs(ang(f.wyaw - yaw - sd * 0.1)) * 0.18 * s; if (e > wantStep && e > be) { be = e; best = i; } }
    if (best >= 0) { const f = F[best]; f.mode = 1; f.u = 0; f.sx = f.wx; f.sz = f.wz; f.syaw = f.wyaw; f.dur = rq[11] > 0.5 ? rq[10] || 0.26 : 0.3 + Math.min(0.12, be); f.liftH = (rq[11] > 0.5 ? 0.06 : 0.045) * s + Math.min(0.04, be * 0.1); }
  }
  // holat talabi: oyoq uchida turish (cho'kkalash) va h.k.
  for (let i = 0; i < 2; i++) { const f = F[i]; if (f.mode === 0) { f.pitch = rq[i * 5 + 2]; f.toe = rq[i * 5 + 3]; } }
}

// ===================== HOLATLAR =====================
const arm = (o, base, v) => { const k = ['cle', 'clp', 'uf', 'ua', 'ur', 'ef', 'ep', 'wf', 'wd', 'fg']; for (let i = 0; i < 10; i++) if (v[k[i]] !== undefined) o[base + i] = v[k[i]]; };
const armAdd = (o, base, v, w = 1) => { const k = ['cle', 'clp', 'uf', 'ua', 'ur', 'ef', 'ep', 'wf', 'wd', 'fg']; for (let i = 0; i < 10; i++) if (v[k[i]] !== undefined) o[base + i] += v[k[i]] * w; };
const armMix = (o, base, v, w) => { const k = ['cle', 'clp', 'uf', 'ua', 'ur', 'ef', 'ep', 'wf', 'wd', 'fg']; for (let i = 0; i < 10; i++) if (v[k[i]] !== undefined) o[base + i] += (v[k[i]] - o[base + i]) * w; };
const legFK = (o, base, tf, kf, af = 0, ta = 0.04, tr = 0) => { o[base] = tf; o[base + 1] = ta; o[base + 2] = tr; o[base + 3] = kf; o[base + 4] = af; o[base + 6] = 0; };

// Turish: nafas, og'irlikni oyoqdan oyoqqa o'tkazish, vaqti-vaqti bilan o'zgarishlar (atrofga qarash, kerishish, soatga qarash...)
function idleLayer(rig, A, o, k, t, dt, allowVar) {
  if (k <= 0.001) return;
  const sd = rig.seed, fat = A.fat, amp = lerp(1, 3.2, fat), br = sn(A.br);
  o[CH.CX] -= 0.014 * amp * br * k; o[CH.SX] -= 0.006 * amp * br * k; o[CH.CLEL] += 0.012 * amp * (0.5 + 0.5 * br) * k; o[CH.CLER] += 0.012 * amp * (0.5 + 0.5 * br) * k; o[CH.KX] += 0.01 * amp * br * k;
  const mk = A.mk, wsR = sn(TAU * (t + A.wsPh) / A.wsPer) * 0.75 + noise1(t * 0.21, sd) * 0.4;
  // erkak: og'irlik ko'pincha bir oyoqda (sekin almashadi), son kam qiyshayadi, yelka biroz orqada, ko'krak ochiq
  const ws = lerp(wsR, cl(Math.sign(wsR) * Math.pow(Math.abs(wsR), 0.4) * 0.8, -0.8, 0.8), mk);
  o[CH.PX] += lerp(0.03, 0.026, mk) * ws * k; o[CH.HZ] += lerp(0.055, 0.034, mk) * ws * k; o[CH.SZ] -= lerp(0.035, 0.024, mk) * ws * k; o[CH.CZ] -= lerp(0.02, 0.008, mk) * ws * k; o[CH.HY] += lerp(0.04, 0.025, mk) * ws * k;
  if (mk > 0) { o[CH.CX] -= 0.035 * mk * k; o[CH.KX] += 0.02 * mk * k; o[CH.CLPL] -= 0.03 * mk * k; o[CH.CLPR] -= 0.03 * mk * k; }
  o[CH.KY] += 0.07 * noise1(t * 0.31, sd + 5) * k; o[CH.KX] += 0.035 * noise1(t * 0.27, sd + 9) * k; o[CH.KZ] += 0.03 * noise1(t * 0.19, sd + 2) * k;
  o[CH.UFL] += 0.03 * noise1(t * 0.4, sd + 11) * k; o[CH.UFR] += 0.03 * noise1(t * 0.37, sd + 13) * k;
  // charchagan: tizzaga tayanib nafas olish
  if (fat > 0.55) { const e = sm(0.55, 0.85, fat) * k; o[CH.HX] += 0.3 * e; o[CH.SX] += 0.42 * e; o[CH.CX] += 0.15 * e; o[CH.PY] -= 0.08 * e; o[CH.PZ] -= 0.06 * e; o[CH.KX] -= 0.5 * e; A.kneesW = e; } else A.kneesW = 0;
  if (!allowVar) return;
  // vaqti-vaqti bilan o'zgarishlar
  if (!A.iv) { A.idleT += dt; if (A.idleT > A.ivNext && k > 0.95 && fat < 0.3) { const L = A.mk > 0 ? IVAR_M : IVAR; A.iv = { k: L[(Math.floor(hash(sd + t * 0.37) * 1000)) % L.length], t: 0 }; A.iv.dur = { look: 3.6, stretch: 3.4, watch: 2.4, scratch: 2.6, hips: 4.5, cross: 5.5, shrug: 1.8, roll: 2.6, neck: 3.2 }[A.iv.k]; A.idleT = 0; A.ivNext = 8 + hash(sd + t) * 12; } return; }
  const v = A.iv; v.t += dt; const u = v.t / v.dur, e = sm(0, 0.38, v.t) * (1 - sm(v.dur - 0.5, v.dur, v.t)) * k;
  if (v.t >= v.dur) { A.iv = null; return; }
  switch (v.k) {
    case 'look': { const y = sn(TAU * u) * 0.95; o[CH.KY] += y * 0.6 * e; o[CH.NY] += y * 0.35 * e; o[CH.CY] += y * 0.12 * e; o[CH.KX] -= 0.08 * e; o[CH.LOOK] -= e; break; }
    case 'stretch': { // yelkani yozish: qo'llar biroz orqaga, ko'krak ochiladi, bosh yonga egiladi (sokin, tabiiy)
      const p = sm(0.15, 0.45, u) * (1 - sm(0.7, 0.95, u)), r2 = sn(PI * sm(0.3, 0.8, u)); armAdd(o, AL, { uf: -0.32, ua: 0.16, ef: -0.1, ep: -0.3, wf: -0.25, fg: -0.15 }, p * e); armAdd(o, AR, { uf: -0.32, ua: 0.16, ef: -0.1, ep: -0.3, wf: -0.25, fg: -0.15 }, p * e);
      o[CH.CX] -= 0.05 * p * e; o[CH.CLPL] -= 0.06 * p * e; o[CH.CLPR] -= 0.06 * p * e; o[CH.KZ] += 0.16 * r2 * e; o[CH.KX] -= 0.06 * p * e; o[CH.LOOK] -= e; break; }
    case 'watch': { armAdd(o, AL, { uf: 0.9, ua: 0.15, ur: 0.95, ef: 1.75, ep: 0.6, wf: 0.2 }, e); o[CH.KX] += 0.38 * e; o[CH.KY] += 0.22 * e; o[CH.NX] += 0.1 * e; o[CH.LOOK] -= e; break; }
    case 'scratch': { armAdd(o, AR, { uf: 1.1, ua: 1.35, ur: 0.2, ef: 2.15 + 0.12 * sn(v.t * 40) * sm(0.3, 0.4, u), wf: 0.3, fg: 0.3 }, e); o[CH.KZ] += 0.14 * e; o[CH.KX] += 0.08 * e; break; }
    case 'hips': { for (const b of [AL, AR]) armAdd(o, b, { ua: 0.62, ur: -0.55, uf: -0.12, ef: 1.55, ep: 0.6, wf: -0.4, fg: -0.15 }, e); o[CH.CX] -= 0.04 * e; o[CH.CLPL] -= 0.04 * e; o[CH.CLPR] -= 0.04 * e; break; }
    case 'cross': { armAdd(o, AL, { uf: 0.42, ua: 0.1, ur: 1.15, ef: 1.75, ep: 0.2, fg: 0.3 }, e); armAdd(o, AR, { uf: 0.34, ua: 0.14, ur: 1.05, ef: 1.85, ep: 0.3, fg: 0.3 }, e); o[CH.CLPL] += 0.04 * e; o[CH.CLPR] += 0.04 * e; o[CH.KX] += 0.04 * e; break; }
    case 'roll': { // yelkalarni orqaga aylantirish (bir marta, sekin): ko'tariladi -> orqaga -> tushadi
      const a = TAU * sm(0.1, 0.9, u), p = sn(PI * u); o[CH.CLEL] += 0.13 * sn(a) * p * e; o[CH.CLER] += 0.13 * sn(a) * p * e; o[CH.CLPL] -= 0.12 * (1 - cs(a)) * 0.5 * e; o[CH.CLPR] -= 0.12 * (1 - cs(a)) * 0.5 * e; o[CH.CX] -= 0.04 * p * e; o[CH.KX] -= 0.05 * p * e; break; }
    case 'neck': { // bo'yinni cho'zish: bosh bir yonga, keyin ikkinchi yonga egiladi
      const z = sn(TAU * sm(0.08, 0.92, u)); o[CH.KZ] += 0.3 * z * e; o[CH.NX] -= 0.04 * e; o[CH.KX] -= 0.05 * e; o[CH.CLEL] -= 0.04 * Math.max(0, z) * e; o[CH.CLER] -= 0.04 * Math.max(0, -z) * e; o[CH.LOOK] -= e; break; }
    case 'shrug': { const p = sn(PI * u); o[CH.CLEL] += 0.16 * p * e; o[CH.CLER] += 0.16 * p * e; armAdd(o, AL, { ep: -0.5, ua: 0.15, ef: 0.6 }, p * e); armAdd(o, AR, { ep: -0.5, ua: 0.15, ef: 0.6 }, p * e); o[CH.KZ] += 0.12 * p * e; break; }
  }
}

// Yurish / yugurish / turish — bitta holat, tezlikka qarab uzluksiz
function sLoco(rig, A, o, t, dt) {
  const m = A.m, g = A.g, s2 = A.s2, ph = A.ph, b = A.beta, sp = A.sp, mk = A.mk, F = (a, c) => lerp(a, c, mk);
  const c1 = cs(TAU * ph), cL = cs(TAU * (ph - b / 2));
  // erkak: tizza biroz bukiq (pastroq chanoq), tik tebranish kam — og'ir, yerga bosib yurish; yugurishda kuchli itarilish
  o[CH.PY] += m * (lerp(F(-0.006, -0.016), F(-0.045, -0.05), g) - 0.03 * s2 + lerp(-F(0.021, 0.011) * cs(2 * TAU * (ph - 0.06)), -lerp(0.028, 0.045, s2) * F(1, 1.05) * cs(2 * TAU * (ph - b / 2)), g));
  o[CH.PX] += m * lerp(F(0.024, 0.009), 0.008 * F(1, 0.6), g) * cL;
  o[CH.HZ] += m * lerp(F(0.06, 0.022), F(0.035, 0.016), g) * cL; o[CH.SZ] -= m * lerp(F(0.04, 0.016), F(0.02, 0.01), g) * cL; o[CH.CZ] -= m * lerp(F(0.02, 0.006), 0.012 * F(1, 0.5), g) * cL;
  // chanoq kam buriladi, yelkalar qarama-qarshi ko'proq (ko'krak oldinga-orqaga)
  const hy = m * lerp(F(0.075, 0.035), lerp(0.14, 0.18, s2) * F(1, 0.55), g), cy2 = m * lerp(F(0.06, 0.1), F(0.14, 0.17), g);
  o[CH.HY] -= hy * c1; o[CH.SY] += (hy + cy2) * 0.5 * c1; o[CH.CY] += (hy + cy2) * 0.5 * c1;
  // ko'krak tik va ochiq; yugurishda bosh biroz oldinda (nigoh gorizontda)
  if (mk > 0) { o[CH.CX] -= 0.03 * mk; o[CH.CLPL] -= 0.025 * mk; o[CH.CLPR] -= 0.025 * mk; o[CH.NX] += 0.08 * g * mk; o[CH.KX] -= 0.06 * g * mk; }
  // tik gavda: yurishda ~3°, yengil yugurishda ~7°, tez yugurishda ~12° (tezlanishda biroz ko'proq, cheklangan)
  o[CH.HX] += m * lerp(0.02, 0.05, g) + 0.04 * s2;
  const lean = cl(m * lerp(0.02, 0.05, g) + 0.07 * s2 + A.accF * m, -0.05, 0.16); o[CH.SX] += lean * 0.55; o[CH.CX] += lean * 0.3; o[CH.KX] -= lean * 0.25;
  // burilishga og'ish (yengil, cheklangan)
  const lt = cl(Math.atan(sp * A.yawRate / 9.8) * 0.45, -0.12, 0.12) * m; o[CH.PX] += sn(lt) * 0.3; o[CH.HZ] -= lt * 0.6; o[CH.SZ] -= lt * 0.2;
  // qo'llar: oyoqqa qarama-qarshi
  // erkak: qo'l yelkadan silkinadi, tirsak bukiq, musht bo'sh yumilgan, bilak qimirlamaydi; yugurishda tirsak ~90°, kuchli silkinish
  const Aw = lerp(0.28, 0.52, cl(sp / 3, 0, 1)) * F(1, 1.05), Ar = lerp(0.8, 1.05, s2) * F(1, 1.08), Aa = m * lerp(Aw, Ar, g);
  for (let i = 0; i < 2; i++) {
    const base = i ? AR : AL, sw = cs(TAU * (ph - (i ? 0 : 0.5))), fw = Math.max(0, sw);
    const swU = Aa * sw * (sw > 0 ? F(1, lerp(0.78, 0.66, g)) : F(1, 1.12)); o[base + 2] += swU + m * lerp(0.03, 0.18, g); // erkak: oldinga kamroq (qo'l ko'krakkacha), orqaga ko'proq
    o[base + 5] += m * lerp(F(0.15, 0.3) + F(0.32, 0.38) * fw, lerp(F(1.3, 1.4), F(1.5, 1.46), s2) + lerp(F(0.3, 0.28), F(0.3, 0.12), g) * sw, g) + 0.55 * mk * Math.max(0, swU) * (1 - g); // oldinga ketgan qo'l doim bukiladi (to'g'ri cho'zilmaydi)
    o[base + 3] += m * lerp(F(0.02, 0.05), 0.1 - 0.1 * fw, g); o[base + 4] += m * lerp(0, F(0.28, 0.1), g); o[base + 9] += m * lerp(F(0.05, 0.3), 0.4 * F(1, 1.2), g); o[base + 6] += m * lerp(0.05, 0.35, g);
    o[base + 1] += m * 0.05 * sw * F(1, 1.6); o[base] += m * 0.02 * fw * mk; // yelka oldinga borganda biroz ko'tariladi
    // tik turishda ham: keng yelka/orqa mushaklari tufayli qo'llar tanadan biroz uzoqda, musht yarim yumuq, bilak tekis
    o[base + 3] += 0.08 * mk; o[base + 9] += 0.42 * mk; o[base + 7] -= 0.1 * mk; o[base + 6] += 0.1 * mk; o[base + 5] += 0.14 * mk * (1 - g) + 0.18 * mk * fw * m * (1 - g); o[base + 8] -= 0.05 * mk;
  }
  idleLayer(rig, A, o, (1 - m) * (A.st === 'loco' ? 1 : 0), t, dt, true);
}

function sAir(rig, A, o, t, dt, ctl) {
  const vy = ctl ? ctl.vy : 0, hg = A.hg, lead = A.lead, run = cl(A.takeSp / 4, 0, 1);
  const push = A.jumped ? 1 - sm(0.03, 0.16, A.airT) : 0, prep = vy < 0 ? sm(1.5, 0.3, hg) : 0, tuck = (1 - prep) * (1 - push);
  const LA = lead ? LL : LR, LB = lead ? LR : LL, aA = lead ? AR : AL, aB = lead ? AL : AR;
  // itarish: orqa oyoq to'g'ri, panja cho'zilgan; havoda: tizzalar yig'ilgan; tushishga tayyorlanish: oyoqlar pastga, tizza yumshoq
  legFK(o, LA, 0.6 * push + lerp(0.75, 1.0, run) * tuck + 0.45 * prep, 0.45 * push + lerp(1.2, 0.9, run) * tuck + 0.45 * prep, 0.55 * push + 0.2 * tuck - 0.1 * prep);
  legFK(o, LB, -0.25 * push + lerp(0.7, -0.1, run) * tuck + 0.28 * prep, 0.15 * push + lerp(1.25, 1.5, run) * tuck + 0.35 * prep, 0.6 * push + 0.45 * tuck - 0.05 * prep);
  arm(o, aA, { uf: 1.3 * push + lerp(0.6, 0.85, run) * tuck + 0.3 * prep, ua: 0.15 + 0.45 * tuck * (1 - run) + 0.55 * prep, ef: 0.6 + 0.3 * tuck, fg: 0.45 });
  arm(o, aB, { uf: 1.1 * push + lerp(0.6, -0.45, run) * tuck + 0.25 * prep, ua: 0.15 + 0.45 * tuck * (1 - run) + 0.6 * prep, ef: 0.55 + 0.3 * tuck, fg: 0.45 });
  o[CH.SX] += 0.14 * tuck - 0.06 * push + 0.05 * prep; o[CH.CX] += 0.06 * tuck; o[CH.HX] += 0.1 * tuck * run; o[CH.KX] -= 0.1 * tuck + 0.15 * prep;
  if (!A.jumped) { // jardan yiqilib tushish: qo'llar muvozanat uchun yoyilgan
    const fl = sn(t * 9) * 0.15; arm(o, AL, { uf: 0.5 + fl, ua: 0.9, ef: 0.5 }); arm(o, AR, { uf: 0.5 - fl, ua: 0.9, ef: 0.5 });
  }
  // sakrashdan oldingi cho'kish: birinchi 0.1 s oyoqlar hali yerda, tana pastda (itarilish ko'rinadi)
  if (A.jumped && A.airT < 0.16) { const rise = Math.max(0, rig.root.position.y - A.takeY); o[CH.PY] -= Math.min(rise, 0.14 * rig.s) / rig.s * (1 - sm(0.07, 0.16, A.airT)); o[CH.LIKL] = o[CH.LIKR] = 1 - sm(0.05, 0.14, A.airT); }
}

function sSwim(rig, A, o, t, dt) {
  const mv = sm(0.3, 1.6, A.sp), q = A.swPh, s = rig.s;
  legFK(o, LL, 0, 0); legFK(o, LR, 0, 0);
  o[CH.BX] = lerp(0.22, 1.42, mv); o[CH.PY] = (1.13 - A.H0) / s + 0.025 * sn(t * 2.2) * (1 - mv);
  // krol: qo'l suv ostida tortadi, keyin yon tomondan havoda qaytadi; tana tortayotgan qo'l tomonga ag'dariladi
  const stroke = (qq) => { if (qq < 0.5) { const u = qq / 0.5; return { uf: lerp(3.0, -0.25, u * u * (3 - 2 * u)), ef: 0.75 * sn(PI * u), ur: 0.45 * sn(PI * u), ua: 0.14, fg: 0.15, wf: 0.2 }; } const u = (qq - 0.5) / 0.5; return { uf: lerp(-0.25, 3.0, u), ua: 0.14 + 0.85 * sn(PI * u), ef: 1.5 * sn(PI * u), ur: -0.35 * sn(PI * u), fg: 0.3, wf: -0.1 }; };
  const sL = stroke(fr(q)), sR = stroke(fr(q + 0.5)), roll = sn(TAU * q) * 0.55;
  const tL = { uf: 0.4, ua: 0.95, ef: 1.0, ur: 0.55 * sn(t * 7), fg: 0.1, wf: 0.3 * sn(t * 7 + 1) }, tR = { uf: 0.4, ua: 0.95, ef: 1.0, ur: 0.55 * sn(t * 7 + PI), fg: 0.1, wf: 0.3 * sn(t * 7 + 1 + PI) };
  const mx = (a, b2) => { const r = {}; for (const k in a) r[k] = lerp(b2[k] ?? 0, a[k], mv); return r; };
  arm(o, AL, mx(sL, tL)); arm(o, AR, mx(sR, tR));
  o[CH.HY] += roll * 0.45 * mv; o[CH.SY] += roll * 0.25 * mv; o[CH.CY] += roll * 0.3 * mv;
  o[CH.KX] -= lerp(0.15, 0.55, mv); o[CH.NX] -= 0.2 * mv; o[CH.KY] += mv * 0.95 * Math.max(0, sn(TAU * q - 0.6)) ** 2;
  const kick = sn(TAU * q * 3), eg = t * 6.5;
  legFK(o, LL, lerp(0.85 + 0.25 * sn(eg), 0.12 + 0.25 * kick, mv), lerp(1.35 + 0.3 * cs(eg), 0.2 + 0.25 * Math.max(0, kick), mv), lerp(0.2, 0.95, mv), lerp(0.35, 0.05, mv));
  legFK(o, LR, lerp(0.85 + 0.25 * sn(eg + PI), 0.12 - 0.25 * kick, mv), lerp(1.35 + 0.3 * cs(eg + PI), 0.2 + 0.25 * Math.max(0, -kick), mv), lerp(0.2, 0.95, mv), lerp(0.35, 0.05, mv));
  o[CH.LOOK] = 0.3;
}

function sSit(rig, A, o, t, dt, rq) {
  const s = rig.s; o[CH.PY] = (0.665 - A.H0) / s; o[CH.PZ] = -0.15; o[CH.HX] = -0.2; o[CH.SX] = 0.1; o[CH.CX] = 0.1; o[CH.KX] -= 0.02;
  rq[1] = rq[6] = 0.36 * s; rq[0] = rq[5] = 0.03 * s; rq[11] = 1; rq[10] = 0.4;
  for (const b of [AL, AR]) arm(o, b, { uf: 0.5, ua: 0.1, ur: 0.25, ef: 0.95, ep: 0.95, wf: 0.15, fg: 0.5 });
  // o'tirganda ham: nafas, atrofga qarash, ba'zan oldinga engashib tirsakni tizzaga qo'yish
  idleLayer(rig, A, o, 0.6, t, dt, false);
  const lv = sm(0.3, 0.7, sn(t * 0.13 + rig.seed) * 0.5 + 0.5) * 0.9; o[CH.HX] += 0.35 * lv; o[CH.SX] += 0.3 * lv; o[CH.CX] += 0.1 * lv; o[CH.KX] -= 0.45 * lv;
  for (const b of [AL, AR]) armMix(o, b, { uf: 0.95, ua: 0.15, ur: 0.6, ef: 1.7, ep: 1.1, fg: 0.6 }, lv);
  o[CH.KY] += 0.55 * sn(t * 0.21 + rig.seed * 3) * (1 - lv);
}

function sBend(rig, A, o, t, dt, rq) {
  const d = A.actDur, e = sm(0, 0.3, t) * (1 - sm(d - 0.32, d + 0.02, t)), s = rig.s;
  if (d <= 1.35) { // egilib olish: son bo'g'imidan bukiladi, tizza yumshoq, o'ng qo'l yerga yetadi, chap qo'l tizzada
    const up = sm(d - 0.5, d - 0.15, t);
    o[CH.HX] += 0.72 * e; o[CH.SX] += 0.45 * e; o[CH.CX] += 0.25 * e; o[CH.PY] -= 0.3 * e; o[CH.PZ] -= 0.13 * e; o[CH.KX] -= 0.4 * e;
    armMix(o, AR, { uf: 0.4 + 0.4 * up, ua: 0.08, ef: 0.12 + 1.5 * up, fg: 0.25 + 0.6 * sm(0.3, 0.5, t), wf: 0.2 }, e);
    armMix(o, AL, { uf: 0.45, ua: 0.15, ef: 0.8, ep: 0.8, fg: 0.5 }, e);
    rq[1] = 0.06 * s * e; rq[6] = -0.06 * s * e; rq[0] = rq[5] = 0.02 * s;
  } else { // uzoq ish: cho'kkalab, ikki qo'l yerda ishlaydi
    const w = sn(t * 5.2);
    o[CH.PY] -= 0.47 * e; o[CH.PZ] -= 0.03 * e; o[CH.HX] += 0.32 * e; o[CH.SX] += 0.34 * e; o[CH.CX] += 0.18 * e; o[CH.KX] -= 0.4 * e;
    armMix(o, AL, { uf: 0.95 + 0.18 * w, ua: 0.12, ef: 0.6 - 0.25 * w, fg: 0.6, ep: 0.5 }, e); armMix(o, AR, { uf: 0.95 - 0.18 * w, ua: 0.12, ef: 0.6 + 0.25 * w, fg: 0.6, ep: 0.5 }, e);
    rq[0] = rq[5] = 0.05 * s * e; rq[2] = rq[7] = 0.38 * e; rq[3] = rq[8] = -0.4 * e;
  }
  rq[11] = 1; rq[10] = 0.24;
}

function sShake(rig, A, o, t, dt, rq) {
  const e = sm(0, 0.22, t), w = sn(t * TAU * 3.2), s = rig.s;
  o[CH.PY] -= 0.07 * e; o[CH.PZ] += 0.05 * w * e; o[CH.SX] += (0.12 + 0.08 * w) * e; o[CH.HX] += 0.06 * e; o[CH.KX] -= (0.3 + 0.04 * w) * e;
  for (const b of [AL, AR]) armMix(o, b, { uf: 1.3, ua: 0.12, ur: 0.3, ef: 0.55 - 0.3 * w, fg: 0.8, wf: -0.3 }, e);
  rq[1] = 0.17 * s; rq[6] = -0.17 * s; rq[0] = rq[5] = 0.03 * s; rq[11] = 1; rq[10] = 0.2;
}

function sSwing(rig, A, o, t, dt, rq) {
  const d = A.actDur, tool = rig.toolName, s = rig.s, e = sm(0, 0.18, t) * (1 - sm(d - 0.2, d, t));
  if (tool === 'pick') { // ko'tarib urish: tayyorgarlik (sekin) -> zarba (tez) -> qaytish
    const n = Math.max(1, Math.round(d / 0.85)), per = d / n, q = fr(t / per);
    const up = sm(0.05, 0.52, q) * (1 - sm(0.55, 0.68, q)), hit = sm(0.55, 0.68, q) * (1 - sm(0.8, 1.0, q));
    const pose = { uf: 0.75 + 2.0 * up - 0.4 * hit, ua: 0.12 + 0.15 * up, ef: 0.7 + 0.35 * up - 0.5 * hit, ur: 0.3, fg: 0.95, wd: -0.85 * (1 - Math.max(up, hit)) - 0.3 * up + 0.1 * hit };
    armMix(o, AR, pose, e); armMix(o, AL, pose, e);
    o[CH.SX] += (-0.16 * up + 0.5 * hit + 0.1) * e; o[CH.CX] += (-0.1 * up + 0.22 * hit) * e; o[CH.HX] += (0.25 * hit) * e; o[CH.PY] += (0.012 * up - 0.13 * hit) * e; o[CH.KX] += (-0.2 * up + 0.1 * hit) * e; o[CH.LOOK] = 0.2;
  } else if (tool === 'shovel') { // qazish: kurakni yerga tiqish, ko'tarish, yonga tashlash
    const n = Math.max(1, Math.round(d / 0.9)), per = d / n, q = fr(t / per);
    const th = sm(0, 0.25, q) * (1 - sm(0.3, 0.5, q)), li = sm(0.3, 0.5, q) * (1 - sm(0.62, 0.8, q)), to = sm(0.55, 0.72, q) * (1 - sm(0.8, 1, q));
    const pose = { uf: 0.32 + 0.12 * th + 0.45 * li + 0.45 * to, ua: 0.08 + 0.15 * to, ef: 0.25 - 0.1 * th + 0.6 * li + 0.3 * to, ur: 0.15, fg: 0.95, wd: -0.2 + 0.45 * li };
    armMix(o, AR, pose, e); armMix(o, AL, { uf: 0.6, ua: 0.1, ef: 0.9, fg: 0.95 }, e);
    o[CH.SX] += (0.25 + 0.2 * th - 0.05 * li) * e; o[CH.HX] += (0.12 + 0.1 * th) * e; o[CH.PY] -= (0.06 + 0.06 * th) * e; o[CH.CY] += 0.55 * to * e; o[CH.HY] += 0.18 * to * e; o[CH.KX] -= 0.15 * e;
  } else { // asbobsiz ish (mashina ta'miri): cho'kkalab, qo'llar oldinda ishlaydi
    const w = sn(t * TAU * 1.6);
    o[CH.PY] -= 0.36 * e; o[CH.HX] += 0.3 * e; o[CH.SX] += 0.28 * e; o[CH.CX] += 0.12 * e; o[CH.KX] -= 0.32 * e;
    armMix(o, AL, { uf: 1.0 + 0.12 * w, ua: 0.15, ef: 1.0 - 0.3 * w, ur: 0.3, fg: 0.8 }, e); armMix(o, AR, { uf: 1.0 - 0.12 * w, ua: 0.15, ef: 1.0 + 0.3 * w, ur: 0.3, fg: 0.8 }, e);
    rq[0] = rq[5] = 0.05 * s * e; rq[2] = rq[7] = 0.3 * e; rq[3] = rq[8] = -0.3 * e;
  }
  if (tool) { rq[1] = 0.13 * s; rq[6] = -0.1 * s; rq[0] = 0.04 * s; rq[5] = 0.04 * s; }
  rq[11] = 1; rq[10] = 0.24;
}

function sPet(rig, A, o, t, dt, rq) {
  const d = A.actDur, e = sm(0, 0.35, t) * (1 - sm(d - 0.3, d + 0.02, t)), w = sn(t * 7.5), s = rig.s;
  o[CH.PY] -= 0.47 * e; o[CH.PZ] -= 0.02 * e; o[CH.HX] += 0.3 * e; o[CH.SX] += 0.32 * e; o[CH.CX] += 0.15 * e; o[CH.KX] -= 0.25 * e;
  armMix(o, AR, { uf: 0.9 + 0.2 * w, ua: 0.06, ef: 0.35 + 0.18 * sn(t * 7.5 + 1), fg: 0.12, wf: -0.35 }, e); armMix(o, AL, { uf: 0.55, ua: 0.15, ef: 1.0, ep: 0.8, fg: 0.5 }, e);
  rq[1] = 0.22 * s * e; rq[6] = -0.2 * s * e; rq[7] = 1.15 * e; rq[8] = -1.0 * e; rq[11] = 1; rq[10] = 0.26;
}

function sDance(rig, A, o, t, dt, rq) {
  const s = rig.s, sd = rig.seed, bt = ENV.time * 2.0 + hash(sd + 7) * 0.12, b = fr(bt / 4) * 4, beat = fr(bt), e = sm(0, 0.4, t);
  // oyoq: har zarbda bir oyoq yonga, keyin joyiga (4 zarbli naqsh)
  const bi = Math.floor(b), side = bi === 0 ? 1 : bi === 2 ? -1 : 0;
  rq[0] = side > 0 ? 0.13 * s : 0; rq[5] = side < 0 ? 0.13 * s : 0; rq[1] = side > 0 ? 0.05 * s : 0; rq[6] = side < 0 ? 0.05 * s : 0; rq[11] = 1; rq[10] = 0.2;
  o[CH.PY] -= (0.045 + 0.035 * (1 - Math.abs(sn(PI * bt)))) * e; o[CH.PX] += 0.045 * sn(PI * bt) * e; o[CH.HZ] += 0.07 * sn(PI * bt) * e; o[CH.HY] += 0.14 * sn(PI * bt / 2) * e; o[CH.SZ] -= 0.05 * sn(PI * bt) * e;
  o[CH.CY] -= 0.18 * sn(PI * bt / 2) * e; o[CH.CZ] += 0.04 * sn(TAU * bt) * e; o[CH.KZ] += 0.13 * sn(PI * bt) * e; o[CH.KY] += 0.2 * sn(PI * bt / 2) * e;
  // qo'llar: o'zbekona raqs — biri tepada, biri yonda, har 4 zarbda almashadi, bilaklar aylanadi
  const sw = 0.5 - 0.5 * cs(PI * bt / 4), st2 = hash(sd + 9), hiA = lerp(2.55, 2.9, st2);
  const hi = { uf: 0.3, ua: hiA, ur: -0.2, ef: 0.9, wf: 0.45 * sn(TAU * bt), wd: 0.45 * cs(TAU * bt), fg: 0.15 }, mid = { uf: 0.45, ua: 1.35, ur: 0.3, ef: 1.2, wf: 0.4 * sn(TAU * bt + 1.5), wd: 0.4 * cs(TAU * bt + 1.5), fg: 0.15 };
  const L = {}, R = {}; for (const k in hi) { L[k] = lerp(hi[k], mid[k], sw); R[k] = lerp(mid[k], hi[k], sw); }
  armMix(o, AL, L, e); armMix(o, AR, R, e); o[CH.LOOK] = 0.3;
}

function sWave(rig, A, o, t, dt) {
  const e = sm(0, 0.26, t), ov = t < 0.45 ? 0.22 * sn(PI * sm(0.1, 0.45, t)) : 0, w = sn(t * TAU * 2.2) * sm(0.2, 0.35, t);
  armMix(o, AR, { cle: 0.1, uf: 0.35, ua: 2.25 + ov, ur: 0.05 + 0.42 * w, ef: 1.3, ep: 0.4, wf: -0.1, fg: 0.05 }, e);
  o[CH.CY] -= 0.06 * e; o[CH.CZ] -= 0.04 * e; o[CH.KZ] -= 0.08 * e; o[CH.SZ] += 0.03 * e;
  idleLayer(rig, A, o, 0.5, t, dt, false);
}

// Suhbat: qo'l imo-ishoralari (ochiq kaft, ritmik urg'u, yelka qisish), bosh irg'ash
function sTalk(rig, A, o, t, dt) {
  idleLayer(rig, A, o, 0.7, t, dt, false);
  if (!A.gest || A.gest.t > A.gest.dur) { const r = hash(rig.seed + t * 1.7); A.gest = { k: Math.floor(r * 5), side: hash(rig.seed + t * 3.1) < 0.5 ? 0 : 1, t: 0, dur: 0.9 + hash(rig.seed + t) * 1.0 }; }
  const G = A.gest; G.t += dt; const u = G.t / G.dur, e = sn(PI * cl(u, 0, 1)), beat = sn(G.t * TAU * 2.4);
  const one = G.side ? AR : AL, oth = G.side ? AL : AR;
  if (G.k === 0) { for (const b of [AL, AR]) armAdd(o, b, { uf: 0.5, ua: 0.2, ef: 1.15 + 0.12 * beat, ep: -1.3, fg: -0.2, wf: -0.2 }, e); }
  else if (G.k === 1) armAdd(o, one, { uf: 0.55, ua: 0.15, ef: 1.3 + 0.28 * beat, ep: -0.4, fg: 0.1 }, e);
  else if (G.k === 2) { armAdd(o, one, { uf: 0.95, ua: 0.3, ur: -0.2, ef: 0.35, fg: 0.6, ep: -0.6 }, e); o[CH.CY] += (G.side ? -0.12 : 0.12) * e; }
  else if (G.k === 3) { o[CH.CLEL] += 0.13 * e; o[CH.CLER] += 0.13 * e; for (const b of [AL, AR]) armAdd(o, b, { ua: 0.3, ef: 1.0, ep: -1.2, fg: -0.25 }, e); o[CH.KZ] += 0.12 * e; }
  else armAdd(o, one, { uf: 0.35, ua: 0.1, ef: 1.6 + 0.2 * beat, ep: 0.3, ur: 0.4, fg: 0.4 }, e);
  armAdd(o, oth, { ef: 0.15 }, 1);
  o[CH.KX] += 0.06 * sn(t * 5.3) * (0.5 + 0.5 * sn(t * 0.9)); o[CH.KZ] += 0.04 * sn(t * 1.3); o[CH.LOOK] = 1.25;
}

function sPlay(rig, A, o, t, dt, rq) {
  const e = sm(0, 0.3, t), beat = ENV.time * 2.0, st = sn(t * TAU * 5.5) * (0.6 + 0.4 * sn(t * TAU * 0.5)), fret = sn(t * 0.9) * 0.08;
  armMix(o, AR, { uf: 0.42, ua: 0.3, ur: 0.62, ef: 1.45, ep: 0.4, wf: 0.25 + 0.38 * st, fg: 0.5 }, e);
  armMix(o, AL, { cle: 0.03, uf: 0.95 + fret, ua: 0.55, ur: 0.45, ef: 1.75 - fret, ep: -0.4, wf: 0.45, fg: 0.75 + 0.15 * sn(t * 9) }, e);
  o[CH.KX] += 0.18 * e; o[CH.KY] += 0.22 * e; o[CH.KZ] += 0.1 * e + 0.05 * sn(PI * beat) * e; o[CH.HY] += 0.06 * sn(t * 2.1) * e; o[CH.PY] -= 0.012 * Math.abs(sn(PI * beat)) * e; o[CH.LOOK] = 0.2;
  rq[3] = -0.28 * Math.max(0, sn(PI * beat)) * e; rq[2] = -0.2 * Math.max(0, sn(PI * beat)) * e;
  idleLayer(rig, A, o, 0.4, t, dt, false);
}

function sFish(rig, A, o, t, dt) {
  // tashlash: qarmoq yelka ortiga (tayyorgarlik), keskin oldinga (zarba), so'ng ushlab turish
  const back = sm(0.05, 0.38, t) * (1 - sm(0.38, 0.52, t)), fwd = sm(0.38, 0.52, t) * (1 - sm(0.6, 1.1, t)), hold = sm(0.55, 1.1, t), sway = sn(t * 1.3) * 0.04 + sn(t * 0.43) * 0.03;
  armMix(o, AR, { uf: 0.6 + 1.9 * back + 0.35 * fwd + sway, ua: 0.16 + 0.15 * back, ur: 0.15, ef: 1.0 + 0.6 * back - 0.6 * fwd, wd: 0.5 - 0.5 * back, fg: 0.95 }, 1);
  armMix(o, AL, { uf: 0.45, ua: 0.12, ef: 0.9, ep: 0.5, fg: 0.85 }, 1);
  o[CH.CY] += 0.25 * back - 0.1 * fwd; o[CH.SX] += 0.04 + 0.08 * fwd - 0.05 * back; o[CH.KX] += 0.18 * hold; o[CH.LOOK] = 0.25;
  idleLayer(rig, A, o, 0.6, t, dt, false);
}

function sFall(rig, A, o, t, dt) {
  const d = Math.max(1.2, A.actDur), down = sm(0.0, 0.38, t) * (1 - sm(d - 0.65, d - 0.05, t)), s = rig.s, kneel = sm(d - 0.65, d - 0.35, t) * (1 - sm(d - 0.35, d - 0.05, t));
  o[CH.BX] = 1.2 * down; o[CH.PY] += ((0.48 - A.H0) / s) * down - 0.2 * kneel; o[CH.PZ] += 0.1 * down;
  arm(o, AL, { uf: 1.15 * down + 0.4 * (1 - down) * sm(0, 0.15, t), ua: 0.25, ef: 0.25, wf: -0.6 * down, fg: 0.1 }); arm(o, AR, { uf: 1.2 * down + 0.4 * (1 - down) * sm(0, 0.15, t), ua: 0.25, ef: 0.25, wf: -0.6 * down, fg: 0.1 });
  legFK(o, LL, 1.2 * down + 0.6 * kneel, 1.55 * down + 1.2 * kneel, 0.5 * down); legFK(o, LR, 1.25 * down + 0.4 * kneel, 1.6 * down + 1.0 * kneel, 0.5 * down);
  const ik = 1 - sm(0.05, 0.2, t) * (1 - sm(d - 0.35, d - 0.02, t)); o[CH.LIKL] = o[CH.LIKR] = ik;
  o[CH.KX] -= 0.6 * down; o[CH.SX] += 0.1 * down; o[CH.LOOK] = 0;
}

// ---- uy hayoti: yotish, stolda ovqatlanish, ovqat pishirish, suv ichish, qo'l yuvish, dush, gazeta o'qish ----
// Chalqancha yotish (karavotda): gavda gorizontal, bosh -Z tomonda, oyoqlar to'g'ri, sekin chuqur nafas
function sLie(rig, A, o, t, dt) {
  const s = rig.s, br = sn(t * 1.25);
  o[CH.BX] = -PI / 2; o[CH.PY] = (0.66 - A.H0) / s; o[CH.PZ] = 0; o[CH.HX] = 0; o[CH.SX] = 0.03 * br; o[CH.CX] = 0.02 + 0.03 * br; o[CH.NX] = 0.25; o[CH.KX] = 0.12; o[CH.KY] = 0.18 * sn(t * 0.09 + 1);
  arm(o, AL, { uf: 0.05, ua: 0.16, ur: 0.1, ef: 0.35, ep: 0.5, wf: 0, fg: 0.45 }); arm(o, AR, { uf: 0.6, ua: 0.22, ur: 0.9, ef: 1.6, ep: 0.3, wf: 0, fg: 0.45 }); // o'ng qo'l ko'krakda
  legFK(o, LL, 0.04, 0.12, -0.5, 0.06); legFK(o, LR, 0.1, 0.22, -0.5, 0.03, -0.15); o[CH.LIKL] = o[CH.LIKR] = 0; o[CH.LOOK] = 0;
}
// Stolda o'tirib ovqatlanish: o'tirish holati + qoshiqni og'izga olib borish (ritmik), bosh biroz egilgan
function sEat(rig, A, o, t, dt, rq) {
  sSit(rig, A, o, t + 2, dt, rq); const c = fr(t / 2.1), up = sm(0.15, 0.4, c) * (1 - sm(0.62, 0.85, c)), e = sm(0, 0.4, t);
  o[CH.HX] += 0.18 * e; o[CH.SX] += 0.12 * e; o[CH.KX] += 0.15 * e - 0.12 * up * e; o[CH.KY] *= 1 - e;
  armMix(o, AR, { uf: lerp(0.75, 1.35, up), ua: lerp(0.25, 0.42, up), ur: lerp(0.2, 0.75, up), ef: lerp(1.1, 2.3, up), ep: 0.2, wf: 0.15, fg: 0.6 }, e);
  armMix(o, AL, { uf: 0.6, ua: 0.2, ur: 0.35, ef: 1.25, ep: 0.6, wf: 0.1, fg: 0.5 }, e); o[CH.LOOK] = 0.2;
}
// Plita oldida: ikki qo'l oldinda, o'ng qo'l qozonni aylana bo'ylab kavlaydi, nigoh pastda
function sCook(rig, A, o, t, dt) {
  const e = sm(0, 0.35, t), a = t * 4.2, s2 = sn(t * 0.7);
  armMix(o, AR, { uf: 0.95 + 0.12 * sn(a), ua: 0.25 + 0.1 * cs(a), ur: 0.35, ef: 1.25 + 0.15 * cs(a), ep: 0.1, wf: 0.1, fg: 0.85 }, e);
  armMix(o, AL, { uf: 0.7, ua: 0.18, ur: 0.4, ef: 1.35, ep: 0.6, wf: 0.1, fg: 0.6 }, e);
  o[CH.HX] += 0.08 * e; o[CH.SX] += 0.08 * e; o[CH.KX] += 0.35 * e; o[CH.KY] += 0.12 * s2 * e; o[CH.CY] += 0.06 * sn(a) * e; o[CH.LOOK] = 0.15;
  idleLayer(rig, A, o, 0.5, t, dt, false);
}
// Suv ichish: stakan og'izga ko'tariladi, bosh orqaga engashadi, so'ng tushiriladi (davomiylik — actDur)
function sDrink(rig, A, o, t, dt) {
  const d = A.actDur, e = sm(0, 0.35, t) * (1 - sm(d - 0.35, d, t)), sip = sm(0.35, 0.65, t) * (1 - sm(d - 0.55, d - 0.25, t));
  armMix(o, AR, { uf: lerp(0.7, 1.15, sip), ua: lerp(0.2, 0.4, sip), ur: lerp(0.3, 0.7, sip), ef: lerp(1.3, 2.35, sip), ep: -0.2, wf: lerp(0, -0.35, sip), fg: 0.9 }, e);
  o[CH.KX] -= 0.38 * sip; o[CH.NX] -= 0.12 * sip; o[CH.CX] -= 0.04 * sip; o[CH.LOOK] = 0.3 * (1 - sip);
  idleLayer(rig, A, o, 0.6, t, dt, false);
}
// Karnay chalish (to'y): o'ng qo'l og'iz oldida karnayni tutadi, chap qo'l oldinda-yuqorida quvurni ushlaydi, bosh ko'tarilgan; har nafasda ko'krak kengayadi
function sHorn(rig, A, o, t, dt) {
  const e = sm(0, 0.5, t), br = sn(t * 1.6) * 0.5 + 0.5;
  armMix(o, AR, { cle: 0.02, uf: 1.05, ua: 0.32, ur: 0.62, ef: 2.15, ep: -0.15, wf: -0.25, fg: 0.95 }, e);
  armMix(o, AL, { cle: 0.06, uf: 1.8, ua: -0.06, ur: 0.55, ef: 0.5, ep: 0.2, wf: 0.15, fg: 0.95 }, e);
  o[CH.KX] -= (0.3 + 0.04 * br) * e; o[CH.NX] -= 0.08 * e; o[CH.CX] -= (0.05 + 0.03 * br) * e; o[CH.LOOK] = 0;
  idleLayer(rig, A, o, 0.35, t, dt, false);
}
// Qo'l yuvish (rakovina): ikki kaft oldinda past, bir-biriga ishqalanadi, nigoh pastda
function sWash(rig, A, o, t, dt) {
  const e = sm(0, 0.3, t), r = sn(t * 11);
  for (const [b, sd] of [[AL, 1], [AR, -1]]) armMix(o, b, { uf: 0.78 + 0.05 * r * sd, ua: 0.05, ur: 0.75, ef: 1.25 + 0.08 * r * sd, ep: -0.5, wf: 0.2, fg: 0.2 }, e);
  o[CH.HX] += 0.18 * e; o[CH.SX] += 0.1 * e; o[CH.KX] += 0.42 * e; o[CH.LOOK] = 0.1; idleLayer(rig, A, o, 0.5, t, dt, false);
}
// Dush: qo'llar bosh ustida — sochni ishqalash, bosh biroz orqada
function sShower(rig, A, o, t, dt) {
  const e = sm(0, 0.4, t), r = sn(t * 8);
  for (const [b, sd] of [[AL, 1], [AR, -1]]) armMix(o, b, { uf: 0.65, ua: 1.75 + 0.12 * r * sd, ur: 0.2, ef: 2.15 + 0.12 * r * sd, ep: 0.2, wf: 0.2, fg: 0.3 }, e);
  o[CH.KX] -= 0.22 * e; o[CH.KY] += 0.1 * sn(t * 1.3) * e; o[CH.LOOK] = 0; idleLayer(rig, A, o, 0.5, t, dt, false);
}
// Gazeta o'qish: ikki qo'l ko'krak oldida qog'ozni tutadi, nigoh pastda, vaqti-vaqti bilan varaqlaydi
function sRead(rig, A, o, t, dt) {
  const e = sm(0, 0.35, t), flip = sm(0, 0.2, fr(t / 3.4)) * (1 - sm(0.2, 0.4, fr(t / 3.4)));
  armMix(o, AR, { uf: 0.95, ua: 0.3, ur: 0.55, ef: 1.55 + 0.25 * flip, ep: -0.7, wf: 0.1, fg: 0.7 }, e); armMix(o, AL, { uf: 0.95, ua: 0.3, ur: 0.55, ef: 1.55, ep: -0.7, wf: 0.1, fg: 0.7 }, e);
  o[CH.KX] += 0.42 * e; o[CH.KY] += 0.1 * sn(t * 0.8) * e; o[CH.LOOK] = 0.1; idleLayer(rig, A, o, 0.6, t, dt, false);
}

// Kurash (kurash.js): rig.kp = {side: -1..1 yonga og'ish, fwd: -1..1 oldinga/orqaga, lift: 0..1 ko'tarib otish, hit: 0..1 tortish zarbi, fly: 0..1 yiqilish (otilgan polvon), win: 0..1 qo'l ko'tarish}
// Past tik turish, oyoqlar keng va zinapoyasimon, ikki qo'l raqib yelkasi/belbog'ida; yiqilganda — orqasi bilan yerga, oyoqlar FK
function sKurash(rig, A, o, t, dt, rq) {
  const k = rig.kp || {}, s = rig.s, e = sm(0, 0.3, t), sd = k.side || 0, fw = k.fwd || 0, lf = k.lift || 0, ht = k.hit || 0, fl = k.fly || 0, wn = k.win || 0, st = 1 - fl, br = sn(A.t * 2.6);
  if (wn > 0.01) { // g'olib: qaddini rostlab, o'ng qo'lni ko'taradi
    armMix(o, AR, { cle: 0.1, uf: 0.4, ua: 2.6, ur: 0.1, ef: 0.35, fg: 0.95 }, wn); armMix(o, AL, { uf: 0.1, ua: 0.15, ef: 0.3, fg: 0.6 }, wn); o[CH.KX] -= 0.15 * wn; o[CH.LOOK] = 0.6;
    if (wn > 0.99) return; }
  const g = e * st * (1 - wn);
  o[CH.PY] -= (0.13 + 0.015 * br) * g; o[CH.HX] += (0.42 + 0.18 * fw - 0.62 * lf) * g; o[CH.SX] += (0.22 + 0.1 * fw - 0.3 * lf) * g; o[CH.CX] += (0.08 - 0.1 * lf) * g; o[CH.KX] -= (0.42 + 0.1 * fw - 0.3 * lf) * g;
  o[CH.PZ] += (0.05 * fw - 0.06 * ht) * g; o[CH.PX] += 0.08 * sd * g; o[CH.HZ] -= 0.2 * sd * g; o[CH.SZ] -= 0.14 * sd * g; o[CH.KZ] += 0.08 * sd * g; // +sd — rigning chap tomoniga (+X) butun gavda og'adi
  o[CH.CY] += 0.65 * lf * g * (sd >= 0 ? 1 : -1); o[CH.HY] += 0.3 * lf * g * (sd >= 0 ? 1 : -1); o[CH.PY] += 0.06 * lf * g;
  const gp = { uf: 1.05 + 0.15 * ht + 0.7 * lf, ua: 0.32 + 0.2 * lf, ur: 0.25, ef: 0.95 - 0.25 * ht + 0.2 * lf, ep: 0.35, wf: 0.1, fg: 0.95 };
  armMix(o, AL, gp, g); armMix(o, AR, gp, g); o[CH.LOOK] = 0.3;
  rq[0] = rq[5] = 0.13 * s * g; rq[1] = (0.14 + 0.04 * sd) * s * g; rq[6] = (-0.1 + 0.04 * sd) * s * g; rq[11] = 1; rq[10] = 0.18;
  if (fl > 0.001) { // otilgan: gavda orqaga ag'dariladi, havoda — chanoq ko'tariladi, oxirida yerda chalqancha
    const up = sn(PI * cl(fl / 0.75, 0, 1)) * (1 - sm(0.75, 1, fl)), dn = sm(0.1, 0.85, fl);
    o[CH.BX] = -1.52 * dn; o[CH.PY] = lerp(o[CH.PY], (0.16 - A.H0) / s, sm(0.55, 1, fl)) + 0.45 * up; o[CH.PZ] = 0;
    armMix(o, AL, { uf: 1.4, ua: 0.8, ur: 0.1, ef: 0.5, fg: 0.3 }, fl); armMix(o, AR, { uf: 1.2, ua: 0.9, ur: 0.1, ef: 0.6, fg: 0.3 }, fl);
    legFK(o, LL, 0.9 * up + 0.25 * dn, 1.2 * up + 0.35 * dn, -0.3 * dn); legFK(o, LR, 0.6 * up + 0.15 * dn, 0.9 * up + 0.2 * dn, -0.3 * dn);
    o[CH.LIKL] = o[CH.LIKR] = 1 - sm(0, 0.15, fl); o[CH.KX] = 0.25 * dn; o[CH.HX] = 0; o[CH.SX] = 0.05; o[CH.CX] = 0.05; o[CH.LOOK] = 0;
  }
}

// ===================== ASOSIY =====================
export function animate(rig, anim, dt, speed, ctl) {
  const A = rig.A, root = rig.root;
  if (anim !== rig.anim) { rig.anim = anim; rig.t = 0; }
  rig.t += dt;
  // uzoqdagi odamlar: kamroq tezlikda yoki muzlatilgan (kamera masofasi bo'yicha)
  if (ENV.cam && rig !== ENV.player) {
    const c = ENV.cam.position, dx = c.x - root.position.x, dz = c.z - root.position.z, d2 = dx * dx + dz * dz, q = ENV.state ? ENV.state.set.gfx : 2, sd = SHADOW_D[q] ?? 45;
    if (rig.mesh) rig.mesh.castShadow = d2 < sd * sd; // uzoqdagi odamning soyasi ko'rinmaydi — soya xaritasiga chizilmaydi (to'y, bozor, ko'cha olomoni)
    if (d2 > 140 * 140 && !A.first) return;
    // uzoqda yoki ekrandan tashqarida — siyrakroq yangilanadi (ko'rinmaydigan odamga har kadr skelet hisoblanmaydi)
    const off = d2 > 12 * 12 && !inView(root.position), iv = Math.max(d2 > 95 * 95 ? 0.25 : d2 > 60 * 60 ? 0.12 : 0, off ? 0.3 : 0);
    if (iv > 0 && !A.first) { A.lodAcc += dt; if (A.lodAcc < iv) return; dt = A.lodAcc; } A.lodAcc = 0;
    A.near = d2 < 35 * 35;
  } else A.near = true;
  dt = Math.min(dt, 0.25);
  // ---- harakat holati: tezlik, tezlanish, burilish ----
  const yaw = root.rotation.y, P = root.position;
  if (A.px == null) { A.px = P.x; A.pz = P.z; A.yaw0 = yaw; }
  let vx, vz; if (ctl) { vx = ctl.vx; vz = ctl.vz; } else { vx = (P.x - A.px) / Math.max(dt, 1e-4); vz = (P.z - A.pz) / Math.max(dt, 1e-4); if (vx * vx + vz * vz > 400) vx = vz = 0; }
  A.px = P.x; A.pz = P.z; A.vx = vx; A.vz = vz;
  // hamma filtrlar eksponensial (kadr chastotasiga bog'liq emas: 30 Gs ham, 144 Gs ham bir xil), sakrashlar cheklanadi
  const spRaw = Math.min(Math.hypot(vx, vz), 12), spPrev = A.sp; A.sp += (spRaw - A.sp) * (1 - Math.exp(-dt * 12)); const sp = A.sp;
  const yr = ang(yaw - A.yaw0) / Math.max(dt, 1e-3); A.yaw0 = yaw; A.yawRate += (cl(yr, -6, 6) - A.yawRate) * (1 - Math.exp(-dt * 6));
  const acc = (sp - spPrev) / Math.max(dt, 1e-3); A.acc0 += (cl(acc, -12, 12) - A.acc0) * (1 - Math.exp(-dt * 8)); A.accF += (cl(A.acc0 * 0.008, -0.06, 0.08) - A.accF) * (1 - Math.exp(-dt * 5));
  // yurish (g) ~3 m/s dan yengil yugurishga o'tadi; s2 — Shift bilan tez yugurish
  A.g = sm(2.2, 4.3, sp); A.s2 = sm(4.9, 7.0, sp); A.m = sm(0.15, 0.9, sp);
  // charchoq: o'yinchida faqat haqiqiy kuch (energiya) tugaganda; aholida — uzoq yugurishdan
  if (ctl && ctl.energy != null) A.fat += (sm(20, 3, ctl.energy) - A.fat) * (1 - Math.exp(-dt * 1.5));
  else if (sp > 5.5) A.fat = Math.min(1, A.fat + dt / 25); else A.fat = Math.max(0, A.fat - dt / (sp > 1 ? 30 : 14));
  A.br += dt * TAU / lerp(A.brPer, 1.25, A.fat); A.swPh = (A.swPh || 0) + dt * lerp(0.42, 0.62, sm(0.3, 1.6, sp));
  if (rig === ENV.player || !ENV.player) ENV.time += dt; // umumiy musiqa vaqti (raqs zarbi)
  // ---- havo / yer ----
  const grounded = ctl ? ctl.grounded !== false && !ctl.swim : true;
  if (!grounded && A.grounded && !(ctl && ctl.swim)) { A.airT = 0; A.jumped = ctl && ctl.vy > 2; A.takeY = P.y; A.takeSp = sp; A.lead = A.ft[0].mode === 1 ? 0 : 1; A.peakY = P.y; }
  if (!grounded) { A.airT += dt; A.peakY = Math.max(A.peakY, P.y); A.vyLast = ctl ? ctl.vy : 0; }
  if (grounded && !A.grounded && A.wasAir) { const vimp = Math.max(-(A.vyLast || 0), Math.sqrt(Math.max(0, 2 * 24 * (A.peakY - P.y)))); const pk = cl(0.012 * Math.pow(vimp, 1.3), 0, 0.38); A.landV -= pk * 2.718 * 11; }
  A.wasAir = !grounded && !(ctl && ctl.swim); A.grounded = grounded;
  if (!grounded && ctl && !ctl.swim) { const gy = T.ground(P.x, P.z, P.y + 0.5).y; A.hg = P.y - gy; } else A.hg = 0;
  // qo'nish prujinasi (o'tirib qolish chuqurligi tushish balandligiga mos)
  { const w = 11, e = Math.exp(-w * dt), c2 = A.landV + w * A.land; A.land = (A.land + c2 * dt) * e; A.landV = (A.landV - w * c2 * dt) * e; }
  // ---- holat tanlash va aralashtirish ----
  let key = MAP[anim] || (STATES.includes(anim) ? anim : 'loco');
  if (ctl && ctl.swim) key = 'swim';
  if (key === 'wave' && rig !== ENV.player && ENV.player && ENV.player.root.visible) { const pp = ENV.player.root.position; if (Math.hypot(pp.x - P.x, pp.z - P.z) < 4.2) key = 'talk'; }
  if (key !== A.st) { A.st = key; A.stT = 0; if (key !== 'loco') A.iv = null; }
  A.stT += dt; A.actDur = rig.actDur || 1;
  let wsum = 0; for (const k of STATES) { const tg = k === key ? 1 : 0, w = 2.2 / BLEND[k], e = Math.exp(-w * dt), d = A.w[k] - tg, c2 = A.wv[k] + w * d; A.w[k] = cl(tg + (d + c2 * dt) * e, 0, 1); A.wv[k] = (A.wv[k] - w * c2 * dt) * e; if (A.w[k] < 0.002 && tg === 0) { A.w[k] = 0; A.wv[k] = 0; } wsum += A.w[k]; }
  if (wsum < 1e-3) { A.w[key] = 1; wsum = 1; }
  // holatlarni baholash
  const acc2 = A.acc, rqa = A.reqAcc; acc2.fill(0); rqa.fill(0); let wFK = 0; A.kneesW = 0; A.t += dt;
  for (const k of STATES) {
    const w = A.w[k] / wsum; if (w <= 0) continue;
    const o = A.buf, rq = A.req; o.set(NEUT); rq.fill(0);
    const t = k === key ? A.stT : A.stT + 1;
    switch (k) {
      case 'loco': sLoco(rig, A, o, A.t + rig.seed * 0.37, dt); break;
      case 'air': sAir(rig, A, o, A.airT, dt, ctl); break;
      case 'swim': sSwim(rig, A, o, A.t, dt); break;
      case 'sit': sSit(rig, A, o, A.stT, dt, rq); break;
      case 'bend': sBend(rig, A, o, A.stT, dt, rq); break;
      case 'shake': sShake(rig, A, o, A.stT, dt, rq); break;
      case 'dance': sDance(rig, A, o, A.stT, dt, rq); break;
      case 'wave': sWave(rig, A, o, A.stT, dt); break;
      case 'talk': sTalk(rig, A, o, A.t, dt); break;
      case 'play': sPlay(rig, A, o, A.stT, dt, rq); break;
      case 'fish': sFish(rig, A, o, A.stT, dt); break;
      case 'swing': sSwing(rig, A, o, A.stT, dt, rq); break;
      case 'fall': sFall(rig, A, o, A.stT, dt); break;
      case 'pet': sPet(rig, A, o, A.stT, dt, rq); break;
      case 'lie': sLie(rig, A, o, A.stT, dt); break;
      case 'eat': sEat(rig, A, o, A.stT, dt, rq); break;
      case 'cook': sCook(rig, A, o, A.stT, dt); break;
      case 'drink': sDrink(rig, A, o, A.stT, dt); break;
      case 'wash': sWash(rig, A, o, A.stT, dt); break;
      case 'shower': sShower(rig, A, o, A.stT, dt); break;
      case 'read': sRead(rig, A, o, A.stT, dt); break;
      case 'horn': sHorn(rig, A, o, A.stT, dt); break;
      case 'kurash': sKurash(rig, A, o, A.stT, dt, rq); break;
    }
    for (let i = 0; i < NCH; i++) acc2[i] += o[i] * w;
    for (let i = 0; i < 12; i++) rqa[i] += rq[i] * w;
    wFK += w * (1 - (o[CH.LIKL] + o[CH.LIKR]) * 0.5);
  }
  A.wFK = wFK;
  // ---- umumiy qatlamlar: qo'nish, nigoh, boshni barqaror tutish ----
  const ld = A.land / rig.s; if (Math.abs(ld) > 1e-4) { acc2[CH.PY] += ld; acc2[CH.SX] -= ld * 1.7; acc2[CH.HX] -= ld * 0.9; acc2[CH.CX] -= ld * 0.6; acc2[CH.KX] += ld * 1.3; acc2[CH.UFL] -= ld * 1.2; acc2[CH.UFR] -= ld * 1.2; acc2[CH.EFL] -= ld * 1.8; acc2[CH.EFR] -= ld * 1.8; }
  look(rig, A, acc2, ctl, dt);
  // ---- prujinalar ----
  if (A.first) { A.x.set(acc2); A.v.fill(0); } else for (let i = 0; i < NCH; i++) spring(A.x, A.v, i, acc2[i], OMEGA[i], dt);
  if (!(A.x[CH.PY] === A.x[CH.PY]) || !(A.x[CH.UFL] === A.x[CH.UFL])) { A.x.set(NEUT); A.v.fill(0); A.land = A.landV = 0; } // xavfsizlik: NaN bo'lsa tiklanadi
  // ---- oyoqlar, FK/IK, suyaklarga yozish ----
  A.dtL = dt; planFeet(rig, A, dt, P, yaw, grounded && key !== 'swim');
  solve(rig, A, A.x, yaw, ctl);
  A.first = false;
}

// Nigoh: o'yinchi — harakat yo'nalishi / kamera / yaqin odam; aholi — yaqin kelgan o'yinchi
function look(rig, A, o, ctl, dt) {
  const P = rig.root.position, yaw = rig.root.rotation.y, s = rig.s;
  let tx = null, ty = 0, tz = 0, wt = 0;
  if (rig === ENV.player) {
    if (ctl && ctl.moveYaw != null && A.sp > 0.5) { const d = cl(ang(ctl.moveYaw - yaw), -1.1, 1.1); tx = P.x + sn(yaw + d) * 10; tz = P.z + cs(yaw + d) * 10; ty = P.y + 1.4 * s; wt = 0.9; }
    else { let best = 6.5 * 6.5, bp = null; for (const r of ENV.rigs) { if (r === rig || r.isRider || !r.root.visible) continue; const q = r.root.position, dx = q.x - P.x, dz = q.z - P.z, d2 = dx * dx + dz * dz; if (d2 < best && Math.abs(ang(Math.atan2(dx, dz) - yaw)) < 1.7) { best = d2; bp = r; } }
      if (bp) { const q = bp.root.position; tx = q.x; ty = q.y + 1.6 * bp.s; tz = q.z; wt = 1; }
      else if (ctl && ctl.camYaw != null) { const d = ang(ctl.camYaw - yaw); if (Math.abs(d) < 1.9) { tx = P.x + sn(ctl.camYaw) * 12; tz = P.z + cs(ctl.camYaw) * 12; ty = P.y + 1.5 * s; wt = 0.75 * sm(1.9, 1.2, Math.abs(d)); } } }
  } else if (ENV.player && ENV.player.root.visible) {
    const q = ENV.player.root.position, dx = q.x - P.x, dz = q.z - P.z, d2 = dx * dx + dz * dz; if (d2 < 11 * 11) { tx = q.x; ty = q.y + 1.6 * ENV.player.s; tz = q.z; wt = sm(11, 7, Math.sqrt(d2)); }
  } else if (ENV.focus) { const q = ENV.focus, dx = q.x - P.x, dz = q.z - P.z; if (dx * dx + dz * dz < 30 * 30) { tx = q.x; ty = q.y + 1.2; tz = q.z; wt = 0.8; } }
  let ly = 0, lp = 0;
  if (tx != null) { const dx = tx - P.x, dz = tz - P.z, lx = dx * cs(yaw) - dz * sn(yaw), lz = dx * sn(yaw) + dz * cs(yaw), hy = P.y + (1.62 + o[CH.PY]) * s; ly = cl(Math.atan2(lx, lz), -1.3, 1.3); lp = cl(Math.atan2(-(ty - hy), Math.hypot(lx, lz)), -0.5, 0.6); if (Math.abs(Math.atan2(lx, lz)) > 2.2) wt = 0; }
  A.lookW += (wt - A.lookW) * Math.min(1, dt * 3); A.lookX += (ly - A.lookX) * Math.min(1, dt * 5); A.lookY += (lp - A.lookY) * Math.min(1, dt * 5);
  const w = A.lookW * cl(o[CH.LOOK], 0, 1.4);
  // bosh barqarorligi: yurishda tana tebransa ham nigoh gorizontda qoladi
  const stab = 0.8;
  const tp = o[CH.HX] + o[CH.SX] + o[CH.CX] + o[CH.BX], tyaw = o[CH.HY] + o[CH.SY] + o[CH.CY], tr = o[CH.HZ] + o[CH.SZ] + o[CH.CZ];
  const kst = stab * (1 - A.w.swim) * (1 - A.w.fall) * (1 - A.w.lie) * (1 - A.w.dance * 0.7);
  o[CH.NX] -= tp * 0.3 * kst * (tp > 0.6 ? 0.5 : 1); o[CH.KX] -= tp * 0.32 * kst * (tp > 0.6 ? 0.5 : 1); o[CH.NY] -= tyaw * 0.4 * kst; o[CH.KY] -= tyaw * 0.45 * kst; o[CH.KZ] -= tr * 0.6 * kst;
  o[CH.CY] += A.lookX * 0.18 * w; o[CH.NY] += A.lookX * 0.34 * w; o[CH.KY] += A.lookX * 0.48 * w; o[CH.NX] += A.lookY * 0.35 * w; o[CH.KX] += A.lookY * 0.55 * w;
}

// ===================== FK + IK =====================
const tq = Q4(), tq2 = Q4(), tv = V3(), tv2 = V3(), tv3 = V3(), tv4 = V3(), hingeV = V3();
const fk = (A, i) => { const p = PAR[i]; A.Qw[i].multiplyQuaternions(A.Qw[p], A.Ql[i]); A.Pw[i].copy(A.rest[i]).applyQuaternion(A.Qw[p]).add(A.Pw[p]); };
// asos yo'nalishlaridan (pastga — dirDown, x — bukilish o'qi) kvaternion
const basis = (out, xAxis, dirDown) => { const y = tv3.copy(dirDown).negate(), z = tv4.crossVectors(xAxis, y).normalize(), x = tv2.crossVectors(y, z); _m.makeBasis(x, y, z); return out.setFromRotationMatrix(_m); };
// 2 bo'g'imli IK: yuqori suyak u, pastki l; root — u bo'g'imi, target — l ning bolasi; pole — o'rta bo'g'im qayoqqa chiqadi; flip — qo'l (tirsak orqaga)
function ik2(A, u, l, target, pole, flip, out) {
  const P0 = A.Pw[u], L1 = A.len[u], L2 = A.len[l], d = tv.subVectors(target, P0); let dl = d.length(); const mx = (L1 + L2) * 0.999, mn = Math.abs(L1 - L2) + 0.01;
  if (dl < 1e-5) { d.set(0, -1, 0); dl = 1e-5; } d.divideScalar(dl); dl = cl(dl, mn, mx);
  const ca = cl((L1 * L1 + dl * dl - L2 * L2) / (2 * L1 * dl), -1, 1), al = Math.acos(ca);
  const p = _v.copy(pole).addScaledVector(d, -pole.dot(d)); if (p.lengthSq() < 1e-8) p.set(0, 0, 1).addScaledVector(d, -d.z); p.normalize();
  const dirU = _v2.copy(d).multiplyScalar(Math.cos(al)).addScaledVector(p, Math.sin(al));
  const mid = _v3.copy(P0).addScaledVector(dirU, L1), dirL = _v4.copy(P0).addScaledVector(d, dl).sub(mid).normalize();
  const hx = hingeV.crossVectors(dirU, p).normalize(); if (!flip) hx.negate();
  basis(tq, hx, dirU); tq.multiply(A.align[u]); out[0].copy(tq);
  basis(tq2, hx, dirL); tq2.multiply(A.align[l]); out[1].copy(tq2);
}
const FQ = [Q4(), Q4()], AT = [V3(), V3()], YW = [0, 0];
const outQ = [Q4(), Q4()], tgt = V3(), pole = V3(), fq = Q4(), fq2 = Q4(), slopeQ = Q4(), upN = V3(), ankle = V3(), piv = V3(), qa = Q4(), qb = Q4();
function solve(rig, A, x, yaw, ctl) {
  const s = rig.s, bones = rig.bones, Q = A.Ql, P = rig.root.position, cy = cs(yaw), sy = sn(yaw);
  // tana (chanoq ildizi)
  qE(Q[B.body], x[CH.BX], x[CH.BY], x[CH.BZ], 'XYZ'); A.Qw[B.body].copy(Q[B.body]); A.Pw[B.body].set(x[CH.PX] * s, A.H0 + x[CH.PY] * s, x[CH.PZ] * s);
  qE(Q[B.hips], x[CH.HX], x[CH.HY], x[CH.HZ], 'YXZ'); fk(A, B.hips);
  qE(Q[B.spine], x[CH.SX], x[CH.SY], x[CH.SZ], 'YXZ'); fk(A, B.spine);
  qE(Q[B.chest], x[CH.CX], x[CH.CY], x[CH.CZ], 'YXZ'); fk(A, B.chest);
  qE(Q[B.neck], x[CH.NX], x[CH.NY], 0, 'YXZ'); fk(A, B.neck);
  qE(Q[B.head], x[CH.KX], x[CH.KY], x[CH.KZ], 'YXZ'); fk(A, B.head);
  for (let i = 0; i < 2; i++) {
    const o = i ? AR : AL, sd = i ? -1 : 1, b0 = i ? B.clavR : B.clavL;
    qE(Q[b0], 0, -sd * x[o + 1] * 0.6, sd * x[o] * 0.9, 'YXZ'); fk(A, b0);
    qE(Q[b0 + 1], -x[o + 2], -sd * x[o + 4], sd * x[o + 3], 'ZXY'); fk(A, b0 + 1);
    qE(Q[b0 + 2], -x[o + 5], -sd * x[o + 6], 0, 'XYZ'); fk(A, b0 + 2);
    qE(Q[b0 + 3], -x[o + 8], 0, -sd * x[o + 7], 'XYZ'); fk(A, b0 + 3);
    qE(Q[b0 + 4], 0, 0, -sd * x[o + 9] * 1.3, 'XYZ'); fk(A, b0 + 4);
  }
  // ---- oyoqlar: rejalashtiruvchi nuqtalari -> chanoq balandligi tuzatmasi -> IK; FK bilan aralashadi ----
  fk(A, B.thighL); fk(A, B.thighR);
  const near = A.near;
  for (let i = 0; i < 2; i++) { const f = A.ft[i]; const lx = (f.wx - P.x) * cy - (f.wz - P.z) * sy, lz = (f.wx - P.x) * sy + (f.wz - P.z) * cy; f.lx = lx; f.lz = lz;
    if (near || !f.gyOk || f.mode === 1) { const gy = T.ground(f.wx, f.wz, P.y + 0.6).y; f.gy = gy - P.y; f.gyOk = true; if (near && f.mode === 0) { const e = 0.14 * s, fx = sn(f.wyaw) * e, fz = cs(f.wyaw) * e; const ga = T.ground(f.wx + fx, f.wz + fz, P.y + 0.6).y, gb = T.ground(f.wx - fz, f.wz + fx, P.y + 0.6).y; f.slp = cl(Math.atan2(gy - ga, e), -0.45, 0.45); f.slr = cl(Math.atan2(gb - gy, e), -0.4, 0.4); } else if (f.mode === 1) { f.slp *= 0.9; f.slr *= 0.9; } } }
  const ikW = [x[CH.LIKL], x[CH.LIKR]];
  // oyoq kafti: yo'nalish (yaw), qiyalik, tovon/panja atrofida aylanish -> to'piq mo'ljali (AT[i]) va kaft yo'nalishi (FQ[i])
  for (let i = 0; i < 2; i++) {
    const f = A.ft[i], fyaw = ang(f.wyaw - yaw), gy = f.gy + (f.mode === 1 ? f.lift : 0), pit = f.pitch, slw = f.mode === 1 ? Math.max(0, 1 - f.lift / (0.1 * s)) : 1;
    qE(slopeQ, (f.slp || 0) * slw, fyaw, (f.slr || 0) * slw, 'YXZ');
    const pz = pit < 0 ? A.heel : A.ball; piv.set(0, -A.aH, pz);
    ankle.copy(piv).applyQuaternion(slopeQ); const pw = tv.set(f.lx, gy + A.aH, f.lz).add(ankle); // tayanch nuqta (tovon yoki panja) joyida qoladi
    qE(FQ[i], pit, 0, 0, 'XYZ'); FQ[i].premultiply(slopeQ);
    ankle.copy(piv).negate().applyQuaternion(FQ[i]); AT[i].copy(pw).add(ankle); YW[i] = fyaw;
  }
  // chanoq juda baland bo'lsa (qiyalik, uzoq qadam) — tayanch oyog'i yetadigan qilib pasaytiriladi (havodagi oyoq hisobga olinmaydi)
  let drop = 0;
  for (let i = 0; i < 2; i++) { if (ikW[i] < 0.3 || A.ft[i].mode === 1) continue; const h = A.Pw[i ? B.thighR : B.thighL], at = AT[i], hd = Math.hypot(at.x - h.x, at.z - h.z), L = A.LS * 0.99; const vmax = hd < L ? Math.sqrt(L * L - hd * hd) : 0; const need = (h.y - (at.y + vmax)) * Math.min(1, ikW[i]); if (need > drop) drop = need; }
  A.dropS = A.dropS || 0; const dmax = (0.05 + 0.25 * cl(1 - A.w.loco + A.w.air, 0, 1)) * s; A.dropS += (Math.min(drop, dmax) - A.dropS) * (1 - Math.exp(-(drop > A.dropS ? 25 : 8) * A.dtL));
  if (A.dropS > 1e-4) { for (const b of [B.body, B.hips, B.spine, B.chest, B.neck, B.head, B.clavL, B.upL, B.foreL, B.handL, B.fingL, B.clavR, B.upR, B.foreR, B.handR, B.fingR]) A.Pw[b].y -= A.dropS; }
  for (let i = 0; i < 2; i++) {
    const f = A.ft[i], sd = i ? -1 : 1, bT = i ? B.thighR : B.thighL, base = i ? LR : LL;
    qE(Q[bT], -x[base], -sd * x[base + 2], sd * x[base + 1], 'ZXY'); fk(A, bT);
    const fkQ0 = qa.copy(Q[bT]);
    qE(Q[bT + 1], x[base + 3], 0, 0, 'XYZ'); const fkQ1 = qb.copy(Q[bT + 1]);
    const w = ikW[i];
    if (w > 0.001) {
      const fyaw = YW[i];
      pole.set(sn(fyaw) * 0.7, 0, cs(fyaw) * 0.7).add(tv2.set(0, 0, 1).applyQuaternion(A.Qw[B.hips]).multiplyScalar(0.4)); pole.y = 0.1; pole.x += sd * 0.05;
      ik2(A, bT, bT + 1, AT[i], pole, false, outQ);
      // mahalliy kvaternionlar: ota (chanoq) ga nisbatan
      tq.copy(A.Qw[B.hips]).invert().multiply(outQ[0]); Q[bT].copy(fkQ0).slerp(tq, w);
      const thW = tq2.multiplyQuaternions(A.Qw[B.hips], Q[bT]);
      tq.copy(thW).invert().multiply(outQ[1]); Q[bT + 1].copy(fkQ1).slerp(tq, w);
      const shW = tq2.multiplyQuaternions(thW, Q[bT + 1]);
      const footLocal = fq2.copy(shW).invert().multiply(FQ[i]);
      fk(A, bT); fk(A, bT + 1);
      qE(Q[bT + 2], x[base + 4], 0, 0, 'XYZ'); Q[bT + 2].slerp(footLocal, w);
      qE(Q[bT + 3], (f.toe || 0) * w + x[base + 5] * (1 - w), 0, 0, 'XYZ');
    } else { Q[bT + 1].copy(fkQ1); fk(A, bT + 1); qE(Q[bT + 2], x[base + 4], 0, 0, 'XYZ'); qE(Q[bT + 3], x[base + 5], 0, 0, 'XYZ'); }
    fk(A, bT + 2); fk(A, bT + 3);
  }
  // ---- ikkinchi qo'l asbob dastasida / charchaganda tizzada (IK) ----
  const grip = ENV.grips && rig.toolName && ENV.grips[rig.toolName];
  const kneesW = A.kneesW * A.w.loco * (1 - A.m), dut = rig.toolName === 'dutor' && rig.dutorM ? A.w.play : 0;
  if ((grip && (A.st === 'swing' || A.st === 'fish')) || kneesW > 0.02 || dut > 0.02) {
    const L = [];
    if (dut > 0.02) { // dutor: chap qo'l dastadagi pardada (sirg'aladi), o'ng qo'l kosada chertadi
      const tC = (x, y, z) => new THREE.Vector3(x, y, z).applyMatrix4(rig.dutorM.matrix).applyQuaternion(A.Qw[B.chest]).add(A.Pw[B.chest]), tt = A.t;
      L.push([B.upL, tC(0, (0.5 + 0.08 * sn(tt * 0.9)) * s, 0.025 * s), dut]); L.push([B.upR, tC(0.012 * s * sn(tt * TAU * 5.5), -0.04 * s + 0.025 * s * sn(tt * TAU * 5.5), 0.075 * s), dut]); }
    if (grip && (A.st === 'swing' || A.st === 'fish')) { const g = grip, hq = A.Qw[B.handR]; tgt.copy(rig.tool.position).add(tv.set(0, Math.cos(g[0]) * g[1], Math.sin(g[0]) * g[1]).applyQuaternion(rig.tool.quaternion)).applyQuaternion(hq).add(A.Pw[B.handR]); L.push([B.upL, tgt.clone(), A.w[A.st]]); }
    if (kneesW > 0.02) for (let i = 0; i < 2; i++) { const kn = A.Pw[i ? B.shinR : B.shinL]; L.push([i ? B.upR : B.upL, kn.clone().add(tv.set(i ? -0.02 : 0.02, 0.07 * s, 0.05 * s)), kneesW]); }
    for (const [bu, tp, w] of L) {
      const sd = bu === B.upL ? 1 : -1; pole.set(sd * 0.75, -0.25, -0.6).applyQuaternion(A.Qw[B.chest]);
      // qo'l uchi (kaft markazi) uchun: bilak nuqtasini mo'ljalga yaqinlashtiramiz
      ik2(A, bu, bu + 1, tp.addScaledVector(tv.set(0, 1, 0).applyQuaternion(A.Qw[bu + 2]), 0.07 * s), pole, true, outQ);
      tq.copy(A.Qw[bu - 1]).invert().multiply(outQ[0]); Q[bu].slerp(tq, w); fk(A, bu);
      tq2.copy(A.Qw[bu]).invert().multiply(outQ[1]); Q[bu + 1].slerp(tq2, w); fk(A, bu + 1); fk(A, bu + 2); fk(A, bu + 3);
    }
  }
  // ---- suyaklarga yozish ----
  bones[B.body].position.copy(A.Pw[B.body]);
  for (let i = 0; i < NB; i++) bones[i].quaternion.copy(Q[i]);
}

// ===================== HAYDOVCHI (velosiped/mototsikl) =====================
// o: vehicles.js dagi B.rider {hip, lean, hand, foot, knee}; crank — pedal burchagi (null — oyoqlar qimirlamaydi), steer — rul burilishi
const _hT = V3(), _fT = V3(), _pl = V3();
export function poseRiderAnim(rig, o, crank, steer = 0, bob = 0) {
  const A = rig.A, Q = A.Ql, s = rig.s, R = rig.root.position, lean = o.lean || 0.1;
  qE(Q[B.body], 0, 0, 0, 'XYZ'); A.Qw[B.body].identity(); A.Pw[B.body].set(0, A.H0 + bob, 0);
  qE(Q[B.hips], lean * 0.45, 0, 0, 'YXZ'); fk(A, B.hips);
  qE(Q[B.spine], lean * 0.3, steer * 0.1, 0, 'YXZ'); fk(A, B.spine);
  qE(Q[B.chest], lean * 0.25, steer * 0.1, 0, 'YXZ'); fk(A, B.chest);
  qE(Q[B.neck], -lean * 0.45, steer * 0.15, 0, 'YXZ'); fk(A, B.neck);
  qE(Q[B.head], -lean * 0.45 - 0.05, steer * 0.3, 0, 'YXZ'); fk(A, B.head);
  for (let i = 0; i < 2; i++) { const sd = i ? -1 : 1, b0 = i ? B.clavR : B.clavL; qE(Q[b0], 0, -sd * 0.06, 0, 'YXZ'); fk(A, b0); qE(Q[b0 + 1], -0.8, 0, sd * 0.15, 'ZXY'); fk(A, b0 + 1); fk(A, b0 + 2); qE(Q[b0 + 3], 0, 0, sd * 0.1, 'XYZ'); qE(Q[b0 + 4], 0, 0, -sd * 0.9, 'XYZ'); }
  for (let i = 0; i < 2; i++) { // qo'llar rulda
    const sd = i ? -1 : 1, bu = i ? B.upR : B.upL, hx = sd * o.hand[0], hz = o.hand[2] + sd * Math.sin(steer) * o.hand[0] * 0.8;
    _hT.set(hx - R.x, o.hand[1] - R.y + 0.02 * s, hz - R.z - 0.02).addScaledVector(tv.set(0, 1, 0), 0.06 * s);
    _pl.set(sd * 0.8, -0.3, -0.5); ik2(A, bu, bu + 1, _hT, _pl, true, outQ);
    tq.copy(A.Qw[bu - 1]).invert().multiply(outQ[0]); Q[bu].copy(tq); fk(A, bu); tq2.copy(A.Qw[bu]).invert().multiply(outQ[1]); Q[bu + 1].copy(tq2); fk(A, bu + 1);
    qE(Q[bu + 2], 0.25, 0, sd * 0.2, 'XYZ'); fk(A, bu + 2); fk(A, bu + 3);
  }
  for (let i = 0; i < 2; i++) { // oyoqlar pedalda (yoki tayanchda)
    const sd = i ? -1 : 1, bT = i ? B.thighR : B.thighL; let fy = o.foot[1], fz = o.foot[2], fp = 0.15;
    if (crank != null) { const a = crank + (i ? Math.PI : 0); fy = o.foot[1] + 0.02 + 0.16 * Math.cos(a); fz = o.foot[2] - 0.02 + 0.16 * Math.sin(a); fp = 0.25 + 0.25 * Math.sin(a + 0.6); }
    qE(Q[bT], 0, 0, 0, 'ZXY'); fk(A, bT);
    _fT.set(sd * Math.max(o.foot[0], 0.1) - R.x, fy - R.y + A.aH * 0.8, fz - R.z - 0.03);
    _pl.set(sd * 0.25, 0.3, 1); ik2(A, bT, bT + 1, _fT, _pl, false, outQ);
    tq.copy(A.Qw[B.hips]).invert().multiply(outQ[0]); Q[bT].copy(tq); fk(A, bT); tq2.copy(A.Qw[bT]).invert().multiply(outQ[1]); Q[bT + 1].copy(tq2); fk(A, bT + 1);
    qE(fq, fp, 0, 0, 'XYZ'); tq.copy(A.Qw[bT + 1]).invert().multiply(fq); Q[bT + 2].copy(tq); qE(Q[bT + 3], 0, 0, 0, 'XYZ');
  }
  const bones = rig.bones; bones[B.body].position.copy(A.Pw[B.body]); for (let i = 0; i < NB; i++) bones[i].quaternion.copy(Q[i]);
}
