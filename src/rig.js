// Odam modeli (o'yinchi va aholi uchun): bo'g'imli low-poly figura va protsedura animatsiyalari
import * as THREE from 'three';
import { GB, MAT } from './geo.js';

const HATS = {
  somon: (g) => { g.color(0xe2c460).cyl(10, 0.34, 0.3, 0.1, 0.13, { cap: true }); g.cyl(8, 0.17, 0.15, 0.12, 0.26, { cap: true }); g.color(0xb84a34).cyl(8, 0.175, 0.17, 0.13, 0.17); },
  kepka: (g) => { g.color(0xd8392b).blob(0.185, 1, { cy: 0.1, sy: 0.7 }); g.box(0, 0.1, 0.2, 0.26, 0.03, 0.2); },
  doppi: (g) => { g.color(0x1d1e24).box(0, 0.19, 0, 0.27, 0.12, 0.27, { tx: 0.86, tz: 0.86 }); g.color(0xf2f2ee); for (const [x, z] of [[0.09, 0.136], [-0.09, 0.136], [0.09, -0.136], [-0.09, -0.136], [0.136, 0.09], [0.136, -0.09], [-0.136, 0.09], [-0.136, -0.09]]) g.box(x, 0.17, z, Math.abs(x) > 0.13 ? 0.01 : 0.05, 0.05, Math.abs(z) > 0.13 ? 0.01 : 0.05); },
  toj: (g) => { g.color(0xffd23a).cyl(8, 0.17, 0.18, 0.13, 0.24); for (let i = 0; i < 8; i++) { const a = (i / 8) * 6.283; g.push().translate(Math.sin(a) * 0.17, 0.24, Math.cos(a) * 0.17); g.cyl(4, 0.03, 0, 0, 0.1); g.pop(); } g.color(0xd8392b).blob(0.035, 0, { cy: 0.19, cz: 0.18 }); },
};
export const HAT_LIST = [['somon', 'Somon shlyapa', 200], ['kepka', 'Kepka', 250], ['doppi', "Do'ppi", 400], ['toj', 'Oltin toj', 5000]];

export function makeRig(o = {}) {
  const shirt = o.shirt || 0x2f7fd0, pants = o.pants || 0x3a3f4c, skin = o.skin || 0xe8b990, hair = o.hair || 0x3a2a20, shoe = 0x2a2c33;
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const part = (parent, x, y, z, fn, seed) => { const g = new GB(seed); g.jit = 0.03; fn(g); const piv = new THREE.Group(); piv.position.set(x, y, z); const m = new THREE.Mesh(g.build(), MAT.flat); m.castShadow = true; piv.add(m); parent.add(piv); return piv; };
  const hips = new THREE.Group(); hips.position.y = 0.9; body.add(hips);
  const torso = part(hips, 0, 0, 0, (g) => { g.color(pants).box(0, 0.02, 0, 0.36, 0.16, 0.22); g.color(shirt).box(0, 0.34, 0, 0.42, 0.5, 0.24, { tx: 1.06 }); if (o.vest) g.color(o.vest).box(0, 0.34, 0.005, 0.44, 0.44, 0.2); }, 3);
  const head = part(torso, 0, 0.62, 0, (g) => { g.color(skin).box(0, 0.02, 0, 0.1, 0.08, 0.1); g.blob(0.165, 1, { cy: 0.19 }); g.color(hair).blob(0.175, 0, { cy: 0.25, cz: -0.03, sy: 0.66 }); if (o.long) g.blob(0.15, 0, { cy: 0.1, cz: -0.1, sy: 1.0, sz: 0.5 }); g.color(0x2a2c33).box(0.06, 0.2, 0.155, 0.03, 0.035, 0.02); g.box(-0.06, 0.2, 0.155, 0.03, 0.035, 0.02); }, 4);
  const mkArm = (sx) => { const up = part(torso, sx * 0.27, 0.54, 0, (g) => { g.color(shirt).box(0, -0.14, 0, 0.12, 0.32, 0.13); }, 5); const fore = part(up, 0, -0.3, 0, (g) => { g.color(skin).box(0, -0.13, 0, 0.09, 0.27, 0.1); g.box(0, -0.3, 0, 0.1, 0.1, 0.11); }, 6); return { up, fore }; };
  const mkLeg = (sx) => { const up = part(hips, sx * 0.105, -0.04, 0, (g) => { g.color(pants).box(0, -0.2, 0, 0.16, 0.44, 0.18); }, 7); const shin = part(up, 0, -0.42, 0, (g) => { g.color(pants).box(0, -0.2, 0, 0.13, 0.42, 0.15); g.color(shoe).box(0, -0.41, 0.045, 0.14, 0.1, 0.26); }, 8); return { up, shin }; };
  const aL = mkArm(1), aR = mkArm(-1), lL = mkLeg(1), lR = mkLeg(-1);
  const hatG = new THREE.Group(); hatG.position.y = 0.24; head.add(hatG);
  const tool = new THREE.Group(); tool.position.set(0, -0.3, 0.02); aR.fore.add(tool); // qo'ldagi asbob
  const rig = { root, body, hips, torso, head, aL, aR, lL, lR, hatG, tool, ph: 0, anim: 'idle', t: 0, hat: null, toolName: null, blend: 0 };
  return rig;
}
export function setHat(rig, id) {
  if (rig.hat === id) return; rig.hat = id; while (rig.hatG.children.length) rig.hatG.remove(rig.hatG.children[0]);
  if (!id || !HATS[id]) return; const g = new GB(77); g.jit = 0.02; HATS[id](g); const m = new THREE.Mesh(g.build(), MAT.flat); m.castShadow = true; rig.hatG.add(m);
}
const TOOLS = {
  rod: (g) => { g.color(0x8a5a36); g.push().rotX(1.15); g.cyl(5, 0.018, 0.008, 0, 2.3); g.pop(); g.color(0x2a2c33).box(0, 0.08, 0.14, 0.05, 0.07, 0.07); },
  shovel: (g) => { g.color(0x9a6a42); g.push().rotX(1.9); g.cyl(5, 0.022, 0.022, -0.3, 0.9); g.pop(); g.color(0xb9bec8); g.push().rotX(1.9).translate(0, 1.02, 0); g.box(0, 0, 0, 0.2, 0.3, 0.03, { tx: 0.7 }); g.pop(); },
  pick: (g) => { g.color(0x9a6a42); g.push().rotX(1.2); g.cyl(5, 0.024, 0.024, -0.2, 0.75); g.pop(); g.color(0x6a6e78); g.push().rotX(1.2).translate(0, 0.75, 0); g.box(0, 0, 0, 0.05, 0.06, 0.62, { tz: 0.2 }); g.pop(); },
  dutor: (g) => { g.color(0xc79a66); g.push().rotZ(1.0).rotX(0.2); g.blob(0.16, 1, { sy: 1.25, sz: 0.5, cy: -0.1 }); g.color(0x6e4a30).cyl(5, 0.022, 0.018, 0.05, 0.85); g.pop(); },
  net: (g) => { g.color(0x9a6a42); g.push().rotX(1.3); g.cyl(5, 0.015, 0.015, 0, 1.0); g.pop(); },
};
export function setTool(rig, id) {
  if (rig.toolName === id) return; rig.toolName = id; while (rig.tool.children.length) rig.tool.remove(rig.tool.children[0]);
  if (!id || !TOOLS[id]) return; const g = new GB(88); g.jit = 0.02; TOOLS[id](g); const m = new THREE.Mesh(g.build(), MAT.flat); m.castShadow = true; rig.tool.add(m);
}

// Animatsiya: anim nomi, dt, harakat tezligi. Bo'g'imlarni silliq o'tish bilan qo'yadi.
export function poseRig(rig, anim, dt, speed = 0) {
  if (anim !== rig.anim) { rig.anim = anim; rig.t = 0; }
  rig.t += dt; const t = rig.t, k = Math.min(1, dt * 12);
  // maqsad burchaklar
  let hipY = 0.9, lean = 0, twist = 0, headX = 0, headY = 0, bodyX = 0, bodyY = 0, roll = 0;
  let aLx = 0.06, aLz = 0.08, aLf = -0.12, aRx = 0.06, aRz = -0.08, aRf = -0.12, lLx = 0, lLk = 0, lRx = 0, lRk = 0;
  const sn = Math.sin, cs = Math.cos;
  if (anim === 'walk' || anim === 'run') {
    const run = anim === 'run'; rig.ph += dt * (run ? 2.05 : 2.7) * Math.max(1.2, speed); const p = rig.ph, A = run ? 0.95 : 0.55;
    lLx = sn(p) * A; lRx = -sn(p) * A; lLk = Math.max(0, -cs(p)) * (run ? 1.5 : 0.8) + 0.08; lRk = Math.max(0, cs(p)) * (run ? 1.5 : 0.8) + 0.08;
    aLx = -sn(p) * A * 0.9; aRx = sn(p) * A * 0.9; aLf = run ? -1.25 : -0.3; aRf = run ? -1.25 : -0.3; lean = run ? 0.26 : 0.06; hipY = 0.9 + Math.abs(cs(p)) * (run ? 0.06 : 0.03) - (run ? 0.03 : 0); twist = sn(p) * 0.1;
  } else if (anim === 'jump') { lLx = 0.5; lRx = -0.3; lLk = 0.9; lRk = 0.5; aLx = -2.2; aRx = -2.0; aLz = 0.4; aRz = -0.4; lean = 0.1; }
  else if (anim === 'swim') { bodyX = 1.25; hipY = 0.35; const p = t * 3.2; aLx = -2.6 + sn(p) * 0.9; aRx = -2.6 - sn(p) * 0.9; aLz = 0.3 + cs(p) * 0.3; aRz = -0.3 + cs(p) * 0.3; lLx = sn(p * 1.5) * 0.4; lRx = -sn(p * 1.5) * 0.4; lLk = 0.3; lRk = 0.3; headX = -0.9; }
  else if (anim === 'sit') { hipY = 0.5; lLx = -1.5; lRx = -1.5; lLk = 1.5; lRk = 1.5; aLx = -0.6; aRx = -0.6; aLf = -0.5; aRf = -0.5; lean = -0.05; headY = sn(t * 0.5) * 0.3; }
  else if (anim === 'bend') { const q = Math.min(1, t / 0.35) * (t > 0.75 ? Math.max(0, 1 - (t - 0.75) / 0.3) : 1); lean = 1.05 * q; hipY = 0.9 - 0.22 * q; lLk = 0.7 * q; lRk = 0.7 * q; lLx = -0.5 * q; lRx = -0.5 * q; aLx = -1.2 * q; aRx = -1.4 * q + sn(t * 16) * 0.12 * q; aLf = -0.2; aRf = -0.2; headX = -0.4 * q; }
  else if (anim === 'shake') { aLx = -2.0 + sn(t * 18) * 0.25; aRx = -2.0 - sn(t * 18) * 0.25; aLf = -0.5; aRf = -0.5; lean = 0.12 + sn(t * 18) * 0.05; lLx = 0.2; lRx = -0.2; }
  else if (anim === 'dance') { const p = t * 7; hipY = 0.86 + Math.abs(sn(p)) * 0.07; twist = sn(p * 0.5) * 0.5; roll = sn(p) * 0.12; aLx = -2.4 + sn(p) * 0.5; aRx = -2.4 - sn(p) * 0.5; aLz = 0.5 + cs(p) * 0.3; aRz = -0.5 - cs(p) * 0.3; aLf = -0.8; aRf = -0.8; lLx = sn(p) * 0.3; lRx = -sn(p) * 0.3; lLk = 0.3 + Math.max(0, sn(p)) * 0.5; lRk = 0.3 + Math.max(0, -sn(p)) * 0.5; bodyY = t * 1.6; headY = sn(p * 0.5) * 0.3; }
  else if (anim === 'wave') { aRx = -2.7; aRz = -0.5 + sn(t * 11) * 0.35; aRf = -0.5; headX = -0.1; }
  else if (anim === 'play') { aLx = -1.0; aLz = 0.5; aLf = -1.5; aRx = -0.7 + sn(t * 13) * 0.14; aRz = 0.25; aRf = -1.45; headY = sn(t * 1.5) * 0.2; lean = 0.04; twist = sn(t * 3) * 0.06; hipY = 0.9 + Math.abs(sn(t * 3)) * 0.015; }
  else if (anim === 'fish') { aRx = -1.25 + sn(t * 1.3) * 0.04; aRf = -0.5; aLx = -1.0; aLz = -0.35; aLf = -0.9; lean = 0.03; }
  else if (anim === 'swing') { const q = (t * 2.6) % 1; const s = q < 0.55 ? q / 0.55 : 1 - (q - 0.55) / 0.45; aRx = -2.7 + s * 2.2; aLx = -2.5 + s * 2.0; aLz = -0.3; aRf = -0.4; aLf = -0.5; lean = 0.1 + s * 0.5; lLk = 0.2 + s * 0.3; lRk = 0.2 + s * 0.3; lLx = -0.15 - s * 0.2; lRx = 0.25; }
  else if (anim === 'fall') { bodyX = Math.min(1.5, t * 6); hipY = Math.max(0.25, 0.9 - t * 3); aLx = -2.5; aRx = -2.3; lLx = 0.3; lRx = -0.4; lLk = 0.5; }
  else if (anim === 'pet') { lean = 0.75; hipY = 0.62; lLk = 1.3; lRk = 1.3; lLx = -1.0; lRx = -1.0; aRx = -1.3 + sn(t * 9) * 0.18; aRf = -0.3; aLx = -0.4; headX = -0.3; }
  else { const b = sn(t * 1.7); lean = 0.02 + b * 0.012; aLz = 0.1 + b * 0.015; aRz = -0.1 - b * 0.015; headY = sn(t * 0.37) * 0.25; }
  const L = (o, ax, v) => { o.rotation[ax] += (v - o.rotation[ax]) * k; };
  rig.hips.position.y += (hipY - rig.hips.position.y) * k;
  L(rig.torso, 'x', lean); L(rig.torso, 'y', twist); L(rig.torso, 'z', roll); L(rig.head, 'x', headX); L(rig.head, 'y', headY);
  L(rig.body, 'x', bodyX); if (anim === 'dance') rig.body.rotation.y = bodyY; else L(rig.body, 'y', 0);
  L(rig.aL.up, 'x', aLx); L(rig.aL.up, 'z', aLz); L(rig.aL.fore, 'x', aLf); L(rig.aR.up, 'x', aRx); L(rig.aR.up, 'z', aRz); L(rig.aR.fore, 'x', aRf);
  L(rig.lL.up, 'x', -lLx); L(rig.lL.shin, 'x', lLk); L(rig.lR.up, 'x', -lRx); L(rig.lR.shin, 'x', lRk);
}
