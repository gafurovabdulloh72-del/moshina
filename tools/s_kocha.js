// Ko'cha detallari sinovi: svetofor ustuni to'qnashadi, yo'l va shahar mashinalari bir-birining ichidan o'tmaydi va tiqilib qolmaydi, avtobus to'siq, piyoda chetga qochadi, muzqaymoqchi kechasi yopiq, kaptarlar mashinadan uchadi
// Skrinshotlar: SHOTS=1 bo'lsa shots/kocha_*.jpg
export default async ({ page, shot }) => {
  await page.waitForFunction('window.__ready === true', null, { timeout: 180000 });
  const ev = (js) => page.evaluate(js), T_ = (n, ok, info) => console.log('TEST kocha', n, ok ? 'OK' : 'FAIL', JSON.stringify(info));
  const SH = !!process.env.SHOTS;
  await ev(`window.press = (c) => { G.input.pressed.add(c); G.advance(1 / 60); }; 1`);
  // 1. svetofor ustunlari to'qnashuv jismiga ega
  let r = await ev(`(() => { const n = G.shahar.zebras.map((z) => z.arm.lamp).filter(Boolean).map((l) => G.COL.query(l.x, l.z, 0.5).filter((o) => o.t === 0 && Math.hypot(o.x - l.x, o.z - l.z) < 0.2).length); return { n }; })()`);
  T_('light-pole-collider', r.n.length >= 3 && r.n.every((k) => k > 0), r);
  // 2. gavjum chorraha: yo'l mashinalari (life.js) va shahar mashinalari bir-birining ichidan o'tmaydi, tiqilib qolmaydi
  r = await ev(`(() => { const n = G.T.roads.nodeBy.vil; G.live.mount(true); G.car.place(n.x + 30, n.z + 30, 0); G.prevP = G.car.p.slice(); G.cam.snap(); const L = G.life, S = G.shahar; let ovl = 0, vs = 0, ns = 0; const st = {}; let maxStop = 0;
    for (let t = 0; t < 600; t++) { G.sim(0.5); const all = [...L.cars.filter((c) => c.placed), ...S.cars.filter((c) => c.on)]; for (let i = 0; i < all.length; i++) { const c = all[i], k = c.id != null ? 'L' + c.id : 'S' + c.i; vs += c.v; ns++; st[k] = c.v < 0.3 ? (st[k] || 0) + 0.5 : 0; maxStop = Math.max(maxStop, st[k]); for (let j = i + 1; j < all.length; j++) if (Math.hypot(c.x - all[j].x, c.z - all[j].z) < 2.4) ovl++; } }
    return { ovl, v: +(vs / ns).toFixed(1), maxStop }; })()`);
  T_('traffic-no-overlap', r.ovl <= 6 && r.v > 6 && r.maxStop < 90, r);
  // 3. avtobus: yo'l mashinalari uchun to'siq, kechasi faralari yonadi
  r = await ev(`(() => { const K = G.kocha; if (!K.stop) return { none: 1 }; const ext = G.life.ext.length; G.live.dismount(true); G.player.place(K.stop.x + 3, K.stop.z, 0); G.hour = 23; G.sim(0.5); K.callBus(); G.sim(1); const on = G.life.ext.some((o) => o.on && o.half > 4), lit = K.bus && G.scene.children.some((m) => m.userData.lights && m.userData.lights.visible); G.runUntil(() => K.bus.ph === 'stop', 120); return { ext, on, lit, ph: K.bus.ph }; })()`);
  T_('bus-obstacle-lights', r.none || (r.on && r.lit && r.ph === 'stop'), r);
  if (SH) { await ev(`(() => { const b = G.scene.children.find((m) => m.userData.lights); const p = b.position; G.ui.root.style.visibility = 'hidden'; G.view(p.x + 9, p.y + 3, p.z + 12, p.x, p.y + 1.5, p.z, 23); G.ui.root.style.visibility = ''; return 1; })()`); await shot('kocha_bus_night'); }
  // 4. muzqaymoqchi: kechasi yopiq (sotuvchi ko'rinmaydi, sotmaydi), kunduzi sotadi; sotuvchining ichidan o'tib bo'lmaydi
  r = await ev(`(() => { const K = G.kocha; if (!K.ice) return { none: 1 }; G.player.place(K.ice.x + 1.2, K.ice.z + 1.2, 0); G.hour = 23; G.sim(0.5); const m0 = G.state.money; const pr = G.live.prompt; press('KeyE'); G.sim(0.3); const nightVis = K.ice.rig.root.visible, m1 = G.state.money; G.hour = 12; G.sim(0.5); const dayVis = K.ice.rig.root.visible, col = G.COL.query(K.ice.vx, K.ice.vz, 0.5).some((o) => o.t === 0 && Math.hypot(o.x - K.ice.vx, o.z - K.ice.vz) < 0.05); return { nightVis, dayVis, sold: m1 !== m0, pr: (pr || '').replace(/<[^>]+>/g, ''), col }; })()`);
  T_('ice-hours', r.none || (!r.nightVis && r.dayVis && !r.sold && /yopiq/.test(r.pr) && r.col), r);
  // 5. kaptarlar mashina bostirib kelsa uchib ketadi
  r = await ev(`(() => { const B = G.kocha.birds; if (!B) return { none: 1 }; G.hour = 12; G.live.mount(true); const b = B.list[0]; G.car.place(b.x - 8, b.z, Math.PI / 2); G.prevP = G.car.p.slice(); G.car.v[0] = 8; G.sim(0.05); for (const q of B.list) q.fly = 0; let fly = 0; for (let i = 0; i < 20; i++) { G.car.v[0] = 8; G.sim(0.05); fly = Math.max(fly, B.list.filter((q) => q.fly > 0).length); } return { fly }; })()`);
  T_('pigeons-car', r.none || r.fly > 0, r);
  // 6. piyoda: o'yinchi mashinasi trotuarga chiqib kelsa chetga qochadi
  r = await ev(`(() => { const S = G.shahar, n = G.T.roads.nodeBy.vil; G.hour = 12; G.live.mount(true); G.car.place(n.x + 40, n.z + 40, 0); G.prevP = G.car.p.slice(); G.cam.snap(); G.sim(1); const w = S.walkers.find((q) => q.vis && !q.cross && !q.curb); if (!w) return { none: 1 }; const yaw = Math.atan2(w.x - (w.x - 12), 0); G.car.place(w.x - 12 * Math.sin(w.yaw + 1.57), w.z - 12 * Math.cos(w.yaw + 1.57), w.yaw + 1.57); G.prevP = G.car.p.slice(); let minD = 99;
    for (let i = 0; i < 40; i++) { const f = [Math.sin(w.yaw + 1.57), Math.cos(w.yaw + 1.57)]; G.car.v[0] = f[0] * 9; G.car.v[2] = f[1] * 9; G.sim(0.03); const p = w.rig.root.position; minD = Math.min(minD, Math.hypot(p.x - G.car.p[0], p.z - G.car.p[2])); } return { minD: +minD.toFixed(2), scare: w.scare > 0 || Math.hypot(w.ox || 0, w.oz || 0) > 0.5 }; })()`);
  T_('walker-dodge', r.none || (r.scare && r.minD > 0.9), r);
};
