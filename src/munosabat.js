// Aholi haydashingizga munosabat bildiradi: tez yaqinlashsangiz chetga sakrab baqiradi, yaqinda drift/tryuk qilsangiz olqishlaydi, signalni ko'p chalsangiz norozi, to'xtab yo'l bersangiz rahmat aytadi — gap pufakchalari va ozgina hurmat (faqat yaqindagi odamlar tekshiriladi)
import * as THREE from 'three';

const pick = (a) => a[(Math.random() * a.length) | 0];
export const SAY = {
  scared: ['Voy-voy! Sekinroq!', "Ko'zingizga qarang, uka!", 'Ehtiyot bo\'ling-e!', "Bu yer poyga yo'li emas!", 'Yuragim yorilay dedi!', 'Shoshmang, aka!'],
  cheer: ['Qoyil! 👏', 'Zo\'r-ku!', 'Barakalla, usta!', 'Voy, ajoyib!', 'Yana bir marta!', 'Haqiqiy chavandoz!'],
  frown: ['Bas qiling, quloq bitdi!', 'Signal o\'yinchoq emas!', 'Tinchlik buzilyapti-ku…', 'Hoy, nima gap?!'],
  thanks: ['Rahmat, yaxshi odam! 🙏', "Yo'l berganingiz uchun rahmat!", 'Ehtiyotkor haydovchi ekansiz!', 'Sog\' bo\'ling!'],
  slow: ['Sekin haydaganingiz uchun rahmat!', 'Qishloqda shunday haydash kerak 👍', 'Yaxshi yo\'l!'],
};
const HORN = { horn: 1, bell: 1, siren: 1, beep: 1, airhorn: 1 };

export function initMunosabat(game) {
  const st = game.state, S = st.sir, car = game.car, pl = game.player, L = game.live;
  const M = (game.munosabat = { log: [], last: null });
  S.react = Object.assign({ scared: 0, cheer: 0, frown: 0, thanks: 0, slow: 0 }, S.react || {});
  S.rep = Object.assign({ d: -1, p: 0, n: 0, slow: -1 }, S.rep || {});
  // hurmatga ozgina ta'sir: kuniga ko'pi bilan +2 / −2 (hurmat 0 dan pastga tushmaydi)
  M.rep = (v) => { const R = S.rep, d = st.dunyo.day; if (R.d !== d) { R.d = d; R.p = 0; R.n = 0; } if (game.act) return 0;
    if (v > 0) { const a = Math.min(v, 2 - R.p); if (a <= 0) return 0; R.p += a; st.hurmat = (st.hurmat || 0) + a; return a; }
    const a = Math.min(-v, 2 - R.n, st.hurmat || 0); if (a <= 0) return 0; R.n += a; st.hurmat -= a; return -a; };

  // ================= GAP PUFAKCHALARI =================
  const css = document.createElement('style'); css.textContent = `.sir-bub{position:fixed;left:0;top:0;pointer-events:none;display:none;z-index:4;background:#fffdf4;color:#2a2418;font:700 14px system-ui,sans-serif;padding:6px 11px;border-radius:13px;box-shadow:0 2px 8px #0005;transform:translate(-50%,-100%);white-space:nowrap}
.sir-bub:after{content:'';position:absolute;left:50%;bottom:-6px;margin-left:-6px;border:6px solid transparent;border-bottom:0;border-top-color:#fffdf4}.sir-bub.bad{background:#ffe2dc}.sir-bub.bad:after{border-top-color:#ffe2dc}.sir-bub.good{background:#e4f8e8}.sir-bub.good:after{border-top-color:#e4f8e8}`;
  document.head.appendChild(css);
  const V3 = new THREE.Vector3(), bubs = [0, 1, 2, 3, 4].map(() => { const el = document.createElement('div'); el.className = 'sir-bub'; document.body.appendChild(el); return { el, who: null, t: 0 }; });
  M.say = (who, text, kind = '') => { let b = bubs.find((q) => q.who === who) || bubs.find((q) => q.t <= 0) || bubs.reduce((a, q) => (q.t < a.t ? q : a)); b.who = who; b.t = 2.6; b.el.textContent = text; b.el.className = 'sir-bub ' + kind; M.last = { text, kind }; M.log.unshift(text); if (M.log.length > 12) M.log.length = 12; };
  const drawBubs = (dt) => { const on = game.mode === 'play' && game.hudOn !== false;
    for (const b of bubs) { if (b.t <= 0) continue; b.t -= dt; const r = b.who.rig.root; if (b.t <= 0 || !on || !r.visible) { if (b.t <= 0) b.who = null; b.el.style.display = 'none'; continue; }
      V3.set(r.position.x, r.position.y + 2.25, r.position.z).project(game.camera); if (V3.z < 1 && Math.abs(V3.x) < 1.05 && Math.abs(V3.y) < 1.05) { b.el.style.left = ((V3.x + 1) / 2) * innerWidth + 'px'; b.el.style.top = ((1 - V3.y) / 2) * innerHeight + 'px'; b.el.style.display = 'block'; } else b.el.style.display = 'none'; } };

  // ================= ODAMLAR (yaqindagilari) =================
  // p: { kind: 'w' (ko'cha piyodasi, shahar.js) | 'n' (qishloq aholisi, living.js), o, rig, x, z }
  const near = [], all = () => { const out = []; const W = game.shahar ? game.shahar.walkers : []; for (const w of W) if (w.vis && w.rig.root.visible) out.push({ kind: 'w', o: w, rig: w.rig, x: w.x, z: w.z });
    for (const o of L._dbg.npcs) if (o.rig.root.visible && !o.ride) out.push({ kind: 'n', o, rig: o.rig, x: o.x, z: o.z }); return out; };
  M.people = all;
  const RE = new Map(); const reOf = (o) => { let r = RE.get(o); if (!r) { r = { cd: 0, jt: 0, jx: 0, jz: 0, cross: null }; RE.set(o, r); } return r; };
  // chetga sakrash: harakat yo'nalishiga tik, mashinadan uzoqroq tomonga
  M.jump = (p, vx, vz) => { const r = reOf(p.o), l = Math.hypot(vx, vz) || 1, nx = -vz / l, nz = vx / l, sd = (p.x - car.p[0]) * nx + (p.z - car.p[2]) * nz >= 0 ? 1 : -1; r.jt = 0.7; r.jx = nx * sd * 2.2; r.jz = nz * sd * 2.2; if (p.kind === 'n') p.o.waveT = 1.6; };
  M.react = (p, type) => { const r = reOf(p.o); r.cd = type === 'cheer' ? 4 : 6; S.react[type] = (S.react[type] || 0) + 1;
    const kind = type === 'scared' || type === 'frown' ? 'bad' : 'good'; M.say(p, pick(SAY[type]), kind);
    if (type === 'cheer' || type === 'thanks' || type === 'slow') { if (p.kind === 'n') p.o.waveT = 2.2; else { r.jt = 0.45; r.jx = 0; r.jz = 0; } } };

  // signal: [H] ketma-ket ko'p chalinsa — norozilik
  const horns = [];
  const sfx0 = game.audio.sfx.bind(game.audio);
  game.audio.sfx = (name, k) => { if (HORN[name] && !pl.onFoot && game.mode === 'play') horns.push(game.time); return sfx0(name, k); };
  M.horn = () => horns.push(game.time); // sinov uchun

  let acc = 0, lastDrift = 0, lastTrick = null, frownCd = 0, cheerCd = 0;
  M.update = (dt) => {
    drawBubs(dt);
    // sakrash animatsiyasi (piyodaning joyi shahar.js da har kadr qo'yiladi — ustiga qo'shamiz; qishloq odami turgan joyiga qaytadi)
    for (const [o, r] of RE) { if (r.jt <= 0) continue; r.jt = Math.max(0, r.jt - dt); const u = 1 - r.jt / (r.jx || r.jz ? 0.7 : 0.45), side = Math.min(1, u * 1.6), hop = Math.sin(Math.PI * Math.min(1, u * 1.4)) * (r.jx || r.jz ? 0.55 : 0.3);
      const R = o.rig.root; if (o.arm) { R.position.x += r.jx * (r.jt > 0 ? side : 0); R.position.z += r.jz * (r.jt > 0 ? side : 0); R.position.y += hop; }
      else if (r.jt > 0) R.position.set(o.x + r.jx * Math.sin(Math.PI * Math.min(1, u)) * side, o.y + hop, o.z + r.jz * Math.sin(Math.PI * Math.min(1, u)) * side); else R.position.set(o.x, o.y, o.z); }
    if (game.mode !== 'play') return;
    for (const r of RE.values()) if (r.cd > 0) r.cd -= dt;
    frownCd -= dt; cheerCd -= dt;
    while (horns.length && horns[0] < game.time - 5) horns.shift();
    const foot = pl.onFoot || (game.suv && game.suv.cur) || (game.interior && game.interior.inside);
    // drift tugadi / tryuk qo'nildi — yaqindagilar olqishlaydi
    const ds = game.driftScore || 0, tr = game.tryuk && game.tryuk.lastTrick; let cool = false;
    if (lastDrift > 300 && ds === 0) cool = true; lastDrift = ds;
    if (tr && tr !== lastTrick && lastTrick !== undefined) cool = true; lastTrick = tr || null;
    if ((acc += dt) < 0.1 && !cool && horns.length < 4) return; acc = 0;
    if (foot) return;
    const cx = car.p[0], cz = car.p[2], vx = car.v[0], vz = car.v[2], sp = Math.hypot(vx, vz);
    near.length = 0; for (const p of all()) { const d = Math.hypot(p.x - cx, p.z - cz); if (d < 40) { p.d = d; near.push(p); } }
    if (!near.length) return;
    near.sort((a, b) => a.d - b.d);
    if (cool && cheerCd <= 0) { let n = 0; for (const p of near) { if (p.d > 35 || n >= 3) break; if (reOf(p.o).cd > 0) continue; M.react(p, 'cheer'); n++; } if (n) { cheerCd = 12; M.rep(0.2); } }
    if (horns.length >= 4 && frownCd <= 0) { let n = 0; for (const p of near) { if (p.d > 35 || n >= 2) break; M.react(p, 'frown'); n++; } if (n) { frownCd = 15; horns.length = 0; M.rep(-0.25); } }
    for (const p of near) { const r = reOf(p.o); if (r.cd > 0) continue; const dx = p.x - cx, dz = p.z - cz;
      // tez yaqinlashish (40 km/soatdan tez, oldinda, yo'lida)
      if (sp > 11) { const al = (dx * vx + dz * vz) / sp, lat = Math.abs(dx * vz - dz * vx) / sp; if (al > -1 && al < 16 && lat < 4.5) { M.jump(p, vx, vz); M.react(p, 'scared'); M.rep(-0.1); continue; } }
      // piyoda zebradan o'tyapti va siz oldida to'xtadingiz
      if (p.kind === 'w' && p.o.cross && sp < 0.8 && p.d < 18 && r.cross !== p.o.cross) { r.cross = p.o.cross; M.react(p, 'thanks'); M.rep(0.2); continue; }
      // qishloqdan sekin o'tish — kuniga bir marta rahmat (+1 savob)
      if (p.kind === 'n' && sp > 2 && sp < 11 && p.d < 10 && S.rep.slow !== st.dunyo.day) { S.rep.slow = st.dunyo.day; M.react(p, 'slow'); if (L.karma) L.karma(1); game.toast(`${p.o.name}: «Sekin haydaganingiz uchun rahmat!» ❤ +1 savob`, 'good'); } }
  };
  game.hooks.push(M.update);
  return M;
}
