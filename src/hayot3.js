// Kundalik hayot 3: kun tartibi va charchoq (kun.js), o'z biznesingiz (biznes.js), uy kengaytmalari (uy2.js), qishloq topshiriqlari (topshiriq.js); ikki g'ildirakli transport haydovchisi — o'yinchining kiyimi va sochida
import { makeRider, setHat } from './rig.js';
import { lookRigOpts } from './hayot2.js';
import { initKun } from './kun.js';
import { initBiznes } from './biznes.js';
import { initUy2 } from './uy2.js';
import { initTopshiriq } from './topshiriq.js';

export function initHayot3(game) {
  const st = game.state;
  initKun(game); initBiznes(game); initUy2(game); initTopshiriq(game);
  // transport haydovchisi (velosiped, skuter, mototsikl, karting…): kiyim/soch/shapka o'zgarsa — qayta quriladi (rig.js makeRider, ko'rinish bilan)
  const fixRider = () => {
    const m = game.carModel; if (!m || !m.rider || !m._rd || !m.rider.userData.rig) return;
    const key = JSON.stringify(st.look || null) + '|' + (st.hat || ''); if (m._lookK === key) return; m._lookK = key;
    const old = m.rider, w = old.parent; if (!w) return; const r = makeRider(m._rd, lookRigOpts(st.look)); r.root.userData.rig = r; r.root.visible = old.visible;
    if (!m._rd.helmet) setHat(r, st.hat || null);
    w.remove(old); w.add(r.root); const ord = old.userData.rig; if (ord && ord.mesh) { ord.mesh.geometry.dispose(); if (ord.mesh.skeleton) ord.mesh.skeleton.dispose(); } m.rider = r.root;
  };
  game.hooks.push(fixRider); fixRider();
  game.fixRider = fixRider;
}
