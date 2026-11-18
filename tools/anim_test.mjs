// Odam animatsiyasi sinovi (Node): haqiqiy kadr siklidagidek o'zgaruvchan dt (1/144..1/30, 0.1 s uzilishlar), burilish, to'xtash, devorga urilish — gavda, tizza, oyoq chegaralari tekshiriladi
import * as THREE from 'three';
import * as T from '../src/terrain.js';
import { makeRig, poseRig } from '../src/rig.js';
import { B } from '../src/anim.js';

T.initWorld();
const H = T.placeBy.uy || { x: 120, z: -80 };
let seed = 12345; const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
const rig = makeRig({ shirt: 0xf0b83a, pants: 0x2f4a78, hair: 0x2a1d16, skin: 0xdcae86, seed: 7, height: 1, build: 1, sleeve: 0.42, player: true });
const A = rig.A, D = 180 / Math.PI;
const up = new THREE.Vector3(), fw = new THREE.Vector3(), q = new THREE.Quaternion(), tq = new THREE.Quaternion(), v1 = new THREE.Vector3(), v2 = new THREE.Vector3();
// o'yinchi harakatini player.js dagidek takrorlaymiz
const P = { x: H.x + 4, z: H.z + 4, y: 0, vx: 0, vz: 0, yaw: 0 }; P.y = T.ground(P.x, P.z, 1e9).y;
const ctl = { vx: 0, vz: 0, vy: 0, grounded: true, swim: false, energy: 100, moveYaw: null, camYaw: 0 };
const dtGen = (mode) => mode === 'jit' ? (rnd() < 0.03 ? 0.1 : [1 / 144, 1 / 120, 1 / 60, 1 / 30][(rnd() * 4) | 0] * (0.8 + 0.4 * rnd())) : mode;
const stats = {};
function step(dt, dir, run, wall, tag) {
  const vmax = run ? 7.4 : 3.7, moving = dir != null, tvx = moving ? Math.sin(dir) * vmax : 0, tvz = moving ? Math.cos(dir) * vmax : 0, a = 16 * Math.min(dt, 0.05);
  P.vx += Math.max(-a, Math.min(a, tvx - P.vx)); P.vz += Math.max(-a, Math.min(a, tvz - P.vz));
  if (moving) { let d = dir - P.yaw; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; P.yaw += d * Math.min(1, Math.min(dt, 0.05) * 11); }
  const ox = P.x, oz = P.z;
  if (!wall) { P.x += P.vx * Math.min(dt, 0.05); P.z += P.vz * Math.min(dt, 0.05); } // devor: tezlik qoladi, joy o'zgarmaydi
  P.y = T.ground(P.x, P.z, P.y + 0.7).y;
  rig.root.position.set(P.x, P.y, P.z); rig.root.rotation.y = P.yaw;
  const h = Math.min(dt, 0.05); Object.assign(ctl, { vx: (P.x - ox) / h, vz: (P.z - oz) / h, // player.js dagidek: haqiqiy siljish
    moveYaw: moving ? dir : null, camYaw: dir ?? 0 });
  const sp = Math.hypot(P.vx, P.vz), anim = sp > 4.6 ? 'run' : sp > 0.4 ? 'walk' : 'idle';
  poseRig(rig, anim, Math.min(dt, 0.05), sp, ctl);
  measure(tag, sp);
}
function measure(tag, sp) {
  const s = stats[tag] || (stats[tag] = { n: 0, pitch: 0, pitchMin: 0, roll: 0, knee: 0, kneeMin: 999, under: 0, drop: 0, headP: 0, sp: 0 }); s.n++; s.sp = Math.max(s.sp, sp);
  // gavda: chanoqdan bo'yingacha vektor — oldinga/yonga og'ish (ildizga nisbatan)
  v1.copy(A.Pw[B.neck]).sub(A.Pw[B.hips]).normalize(); const pitch = Math.atan2(v1.z, v1.y) * D, roll = Math.atan2(Math.abs(v1.x), v1.y) * D;
  s.pitch = Math.max(s.pitch, pitch); s.pitchMin = Math.min(s.pitchMin, pitch); s.roll = Math.max(s.roll, roll);
  // bosh: yuz yo'nalishi pastga qancha egilgan
  fw.set(0, 0, 1).applyQuaternion(A.Qw[B.head]); s.headP = Math.max(s.headP, Math.asin(Math.max(-1, Math.min(1, -fw.y))) * D);
  for (const [t, sh, ft] of [[B.thighL, B.shinL, B.footL], [B.thighR, B.shinR, B.footR]]) {
    v1.copy(A.Pw[sh]).sub(A.Pw[t]).normalize(); v2.copy(A.Pw[ft]).sub(A.Pw[sh]).normalize();
    const k = Math.acos(Math.max(-1, Math.min(1, v1.dot(v2)))) * D; s.knee = Math.max(s.knee, k);
    // tizza orqaga bukilmasin: tizza bo'g'imi son-to'piq chizig'idan oldinda (yoki chiziqda) bo'lsin
    tq.copy(A.Qw[t]); fw.set(0, 0, 1).applyQuaternion(tq); // son "oldi"
    const hk = v2.copy(A.Pw[sh]).sub(A.Pw[t]), ha = v1.copy(A.Pw[ft]).sub(A.Pw[t]); const off = hk.clone().sub(ha.clone().multiplyScalar(hk.dot(ha) / ha.lengthSq())).dot(fw);
    if (off < -0.01 * rig.s) s.kneeMin = Math.min(s.kneeMin, off); // giperekstenziya
    const wy = A.Pw[ft].y + P.y, gy = T.ground(P.x + 0, P.z, P.y + 1).y; // taxminiy (ildiz ostidagi yer)
    const footWorld = v1.copy(A.Pw[ft]).applyAxisAngle(up.set(0, 1, 0), P.yaw).add(new THREE.Vector3(P.x, P.y, P.z)); const g2 = T.ground(footWorld.x, footWorld.z, footWorld.y + 1).y;
    s.under = Math.max(s.under, g2 - (footWorld.y - A.aH * 0.6)); void wy; void gy;
  }
  s.drop = Math.max(s.drop, A.dropS || 0);
}
const run = (tag, secs, mode, dirF, runF = () => false, wallF = () => false) => { let t = 0; while (t < secs) { const dt = dtGen(mode); step(dt, dirF(t), runF(t), wallF(t), tag); t += dt; } };
for (const mode of [1 / 60, 1 / 144, 1 / 30, 'jit']) {
  const m = typeof mode === 'string' ? mode : Math.round(1 / mode) + 'Hz';
  run('idle ' + m, 2, mode, () => null);
  run('walk ' + m, 4, mode, () => 0.3);
  run('run ' + m, 4, mode, () => 0.3, () => true);
  run('zigzag ' + m, 5, mode, (t) => 0.3 + Math.sin(t * 2.5) * 1.6, (t) => t > 2.5);
  run('uturn ' + m, 3, mode, (t) => (t > 1 ? 0.3 + Math.PI : 0.3), (t) => t < 2);
  run('stop ' + m, 2, mode, () => null);
  run('wall ' + m, 3, mode, () => 0.3, (t) => t > 1.5, () => true);
  run('stop2 ' + m, 2, mode, () => null);
}
// chegaralar: yurishda gavda < 15°, yugurishda < 25°, yonga < 12°, tizza 0..140°, oyoq yer ostida emas
let bad = 0; const f = (v) => v.toFixed(1).padStart(6);
console.log('holat            n   gavda+  gavda-   yon   tizza  bosh↓  yerOst  chanoq');
for (const [k, s] of Object.entries(stats)) {
  const lim = s.sp > 5 ? 25 : 15, okk = s.pitch < lim && s.pitchMin > -10 && s.roll < 12 && s.knee < 140 && s.kneeMin > -0.02 && s.under < 0.06 && s.drop < 0.16 && s.headP < 35;
  if (!okk) bad++;
  console.log(k.padEnd(15), String(s.n).padStart(5), f(s.pitch), f(s.pitchMin), f(s.roll), f(s.knee), f(s.headP), f(s.under * 100), f(s.drop * 100), okk ? 'OK' : 'FAIL');
}
console.log(bad ? `XATO: ${bad} holat chegaradan chiqdi` : 'hammasi chegarada');
process.exitCode = bad ? 1 : 0;
