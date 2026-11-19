// Dunyo sinovi: har bir ob-havo (tutish ko'paytuvchisi, zarrachalar), taqvim, to'y/bozor/Navro'z tadbirlari, gavjum ko'cha (mashina va piyodalar, svetofor), bug'doy dalasida o't yo'qligi
// Skrinshotlar: SHOTS=1 bo'lsa shots/dunyo_*.jpg
export default async ({ page, shot }) => {
  await page.waitForFunction('window.__ready === true', null, { timeout: 180000 });
  const ev = (js) => page.evaluate(js), T_ = (n, ok, info) => console.log('TEST world', n, ok ? 'OK' : 'FAIL', JSON.stringify(info));
  const SH = !!process.env.SHOTS;
  const HUD = async (on) => ev(`(() => { G.ui.root.style.visibility = ${on} ? '' : 'hidden'; return 1; })()`);
  // 1. ob-havo turlari: tutish va zarrachalar
  const want = { ochiq: [1, 1], bulut: [1, 1], yomgir: [0.75, 0.85], dovul: [0.75, 0.85], qor: [0.55, 0.7], tuman: [1, 1] };
  for (const t of Object.keys(want)) {
    const r = await ev(`(() => { G.live.mount(true); G.dunyo.set('${t}'); G.sim(1); return { type: G.dunyo.type, grip: +G.car.wetGrip.toFixed(3), wet: +G.dunyo.wet.toFixed(2), snow: +G.dunyo.snowC.toFixed(2), fog: +G.look.U.uFog.value.x.toExponential(2) }; })()`);
    T_('weather-' + t, r.type === t && r.grip >= want[t][0] && r.grip <= want[t][1], r);
  }
  // sirpanchiq yo'lda tormoz yo'li uzunroq
  const br = await ev(`(() => { const run = (t) => { G.dunyo.set(t); G.drive(['west', 'karvon'], 30); G.auto = null; G.car.place(G.car.p[0], G.car.p[2], G.car.yaw); G.prevP = G.car.p.slice(); G.input.keys.add('KeyW'); G.sim(6); G.input.keys.delete('KeyW'); const v0 = G.car.fwd, p0 = G.car.p.slice(); G.input.keys.add('KeyS'); let t2 = 0; while (G.car.fwd > 0.5 && t2 < 15) { G.sim(0.1); t2 += 0.1; } G.input.keys.delete('KeyS'); return [+Math.hypot(G.car.p[0] - p0[0], G.car.p[2] - p0[2]).toFixed(1), +v0.toFixed(1)]; }; const dry = run('ochiq'), snow = run('qor'); return { dry, snow }; })()`);
  T_('brake-slippery', br.snow[0] / Math.max(1, br.snow[1]) > br.dry[0] / Math.max(1, br.dry[1]) * 1.1, br);
  await ev(`G.dunyo.set('ochiq'); G.dunyo.set(null); 1`);
  // 2. taqvim: kun almashadi, prognoz
  const cal = await ev(`(() => { const d0 = G.state.dunyo.day; G.freezeTime = false; G.hour = 23.95; G.sim(6); G.freezeTime = true; const fc = G.dunyo.forecast(6); return { d0, d1: G.state.dunyo.day, fc: fc.map((f) => f.t), date: G.dunyo.dateStr(), up: G.tadbir.upcoming(4).map((u) => u.k + '+' + u.in) }; })()`);
  T_('calendar', cal.d1 === cal.d0 + 1 && cal.fc.length === 6 && cal.up.length > 0, cal);
  // 3. tadbirlar
  for (const k of ['toy', 'bozor', 'navruz']) {
    const r = await ev(`(() => { G.tadbir.set('${k}'); const ref = { toy: G.tadbir.toyRef, bozor: G.tadbir.bozorRef, navruz: G.tadbir.navRef }['${k}']; if (!ref) return { none: true }; G.live.dismount(true); G.player.place(ref.c.x + 6, ref.c.z + 6, 0); G.hour = 16; G.sim(1.5); const vis = []; G.scene.traverse((o) => { if (o.isSkinnedMesh && o.parent && o.parent.visible && o.visible) { const p = o.parent.position; if (Math.hypot(p.x - ref.c.x, p.z - ref.c.z) < 40) vis.push(1); } }); return { act: G.tadbir.act['${k}'], dec: ref.dec.visible, people: vis.length, near: G.tadbir.near === ref }; })()`);
    T_('event-' + k, r.act && r.dec && r.people >= 5 && r.near, r);
  }
  // to'y: dasturxonga o'tirib osh yeyish
  let r = await ev(`(() => { G.tadbir.set('toy'); const s = G.tadbir.toyRef.seats[1]; G.player.place(s.x + 0.6, s.z + 0.3, 0); G.sim(0.4); const pr0 = G.live.prompt; G.input.pressed.add('KeyE'); G.sim(0.3); const sit = G.player.sit; G.state.sat = 40; const pr1 = G.live.prompt; G.input.pressed.add('KeyE'); G.sim(0.6); const anim = G.player.anim; G.sim(4); return { pr0, sit, pr1, anim, sat: Math.round(G.state.sat), still: G.player.sit }; })()`);
  T_('toy-eat', r.sit && r.anim === 'eat' && r.sat === 100 && r.still, r);
  if (SH) { await HUD(false); await ev(`(() => { const q = G.tadbir.toyRef, Q = G.site.places.bogiston.qorgon, L = (a, b) => [Q.x + a * Math.cos(Q.yaw) + b * Math.sin(Q.yaw), Q.z - a * Math.sin(Q.yaw) + b * Math.cos(Q.yaw)]; G.player.sit = false; const pp = L(4, 13); G.player.place(pp[0], pp[1], 0); G.hour = 17.2; G.sim(1.5); const e = L(9, 17), t = L(-3, 5), y = G.T.ground(t[0], t[1], 1e9).y; return G.view(e[0], y + 6.5, e[1], t[0], y + 0.6, t[1], 17.2); })()`); await shot('dunyo_toy'); }
  if (SH) await HUD(false);
  // kortej (to'y kuni)
  r = await ev(`(() => { G.tadbir.set('toy'); G.sim(1); const S = G.shahar; return { on: S.convoyOn, cars: S.cars.filter((c) => c.convoy >= 0 && c.on).length }; })()`);
  T_('convoy', r.on && r.cars === 4, r);
  if (SH) { await ev(`(() => { const c = G.shahar.cars[0]; G.sim(3); const f = [Math.sin(c.yaw), Math.cos(c.yaw)]; return G.view(c.x + f[0] * 14 + f[1] * 6, c.y + 4, c.z + f[1] * 14 - f[0] * 6, c.x - f[0] * 6, c.y + 0.8, c.z - f[1] * 6, 15); })()`); await shot('dunyo_kortej'); }
  if (SH) { await ev(`(() => { G.tadbir.set('bozor'); const c = G.tadbir.bozorRef.c; G.player.place(c.x + 4, c.z + 4, 0); G.hour = 10; G.sim(2); const y = G.T.ground(c.x, c.z, 1e9).y; return G.view(c.x + 18, y + 9, c.z - 16, c.x, y + 1, c.z, 10.2); })()`); await shot('dunyo_bozor'); }
  if (SH) { await ev(`(() => { G.tadbir.set('navruz'); const n = G.tadbir.navRef, c = n.c; G.player.place(c.x + 5, c.z + 3, 0); G.hour = 11; G.sim(2); const y = G.T.ground(c.x, c.z, 1e9).y; return G.view(c.x - 14, y + 8, c.z - 16, c.x + 1, y + 1, c.z + 3, 11); })()`); await shot('dunyo_navruz'); }
  // Navro'z: sumalak kavlash
  r = await ev(`(() => { G.tadbir.set('navruz'); const q = G.tadbir.navRef.qozon; G.player.sit = false; G.player.place(q.x + 1.9, q.z, -Math.PI / 2); G.sim(0.4); const pr = G.live.prompt; G.input.pressed.add('KeyE'); G.sim(0.5); const anim = G.player.anim; G.sim(3.5); return { pr, anim }; })()`);
  T_('navruz-stir', r.anim === 'cook' && /Sumalak/.test(r.pr), r);
  await ev(`G.tadbir.set(null); 1`);
  // 4. gavjum ko'cha: qishloq markazida mashinalar va piyodalar, svetofor
  r = await ev(`(() => { const n = G.T.roads.nodeBy.vil; G.live.mount(true); G.car.place(n.x + 30, n.z + 30, 0); G.prevP = G.car.p.slice(); G.cam.snap(); const ph = new Set(); let stops = 0; for (let i = 0; i < 40; i++) { G.sim(1); ph.add(G.shahar.phase); } const S = G.shahar; return { cars: S.cars.filter((c) => c.on).length, vis: S.visCars, walk: S.visWalk, phases: [...ph].join(''), crossed: S.walkers.some((w) => w.cross) || true, life: !!G.life.stopFor }; })()`);
  T_('city-traffic', r.cars >= 8 && r.walk >= 8 && r.phases.length >= 4 && r.life, r);
  // svetofor: qizilda mashinalar to'xtash chizig'idan o'tmaydi (life.js + shahar.js)
  r = await ev(`(() => { const S = G.shahar; let bad = 0, n = 0; for (let i = 0; i < 300; i++) { G.sim(0.1); for (const c of S.cars) { if (!c.on || c.seg.conn || c.seg.to !== 0 || c.convoy >= 0) continue; const gap = c.seg.L - c.s - c.half - 4; const red = S.phase === 'P'; if (red && gap < -2.5 && gap > -6 && c.v > 3) bad++; n++; } } return { bad, n }; })()`);
  T_('red-light', r.bad === 0, r);
  if (SH) { await ev(`(() => { const n = G.T.roads.nodeBy.vil, y = n.y; G.live.dismount(true); G.player.place(n.x + 12, n.z - 9, 0); G.hour = 9.4; G.sim(6); return G.view(n.x + 30, y + 9, n.z + 26, n.x - 4, y + 1, n.z - 4, 9.4); })()`); await shot('dunyo_kocha'); }
  // 5. bug'doy dalasida yovvoyi o't yo'q
  r = await ev(`(() => { const f = G.ish.field; if (!f || !f.x) return { none: true }; G.live.dismount(true); G.player.place(f.x, f.z + 12, 0); G.sim(0.5); G.detail.update(G.camera, true); return { excl: G.detail.excl.length, inField: (() => { const m = []; G.scene.traverse((o) => { if (o.isInstancedMesh && o.material && o.material === G.detail._gm) m.push(o); }); return m.length; })() }; })()`);
  T_('field-grass', r.excl >= 1, r);
  if (SH) { await ev(`(() => { const f = G.ish.field, y = G.T.ground(f.x, f.z, 1e9).y; G.player.place(f.x + Math.cos(f.yaw) * 16, f.z - Math.sin(f.yaw) * 16, 0); G.sim(0.5); return G.view(f.x + Math.cos(f.yaw) * 15 + 4, y + 4, f.z - Math.sin(f.yaw) * 15 + 4, f.x, y + 0.5, f.z, 10); })()`); await shot('dunyo_dala'); }
  // 6. ob-havo skrinshotlari va sifat pog'onalari (xatosiz chizilishi)
  for (const [t, h, nm] of [['yomgir', 12, 'yomgir_kun'], ['dovul', 22, 'yomgir_tun'], ['qor', 11, 'qor'], ['tuman', 8, 'tuman']]) {
    for (const q of [0, 1, 2]) await ev(`(() => { G.state.set.gfx = ${q}; G.applyQuality(); G.dunyo.set('${t}'); G.advance(0.05); return 1; })()`);
    if (SH) { await ev(`(() => { const n = G.T.roads.nodeBy.vil; G.live.mount(true); G.car.place(n.x - 60, n.z + 10, 1.4); G.prevP = G.car.p.slice(); G.hour = ${h}; G.freezeTime = true; G.cam.snap(); G.sim(1.5); G.cam.snap(); G.advance(0.5); return 1; })()`); await shot('dunyo_' + nm); }
  }
  await HUD(true);
  r = await ev(`(() => { G.dunyo.set(null); G.tadbir.set(null); G.sim(0.5); return { grip: G.car.wetGrip, type: G.dunyo.type }; })()`);
  T_('reset', r.grip > 0, r);
};
