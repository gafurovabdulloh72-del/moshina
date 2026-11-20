// Kurash, bo'yoq ustaxonasi, shina to'plamlari, uy uslubi va piyoda masofasi sinovi (kurash.js, boyoq.js, uslub.js):
// davra va [E] taklifi, zinapoya oynasi, g'alaba (zinapoya oldinga), mag'lubiyat va murabbiy yengilligi, taslim, chempion qulfi va kunlik bellashuv, oltinchi polvondan keyin belbog' va unvon;
// bo'yoq: namuna mashinada ko'rinadi, to'lanmasa qaytadi, to'langach transport bo'yicha saqlanadi, yangi material yaratilmaydi; shina: standartda fizika o'zgarmaydi, qishki shina qorda tormoz yo'lini qisqartiradi;
// uy uslubi: an'anaviy hovli ko'rinadi, uy ichi ranglari, saqlanadi; qayiqda suzilgan masofa piyoda masofasiga kirmaydi. SHOTS=0 — skrinshotsiz
export default async ({ page, shot: shot0 }) => {
  const shots = process.env.SHOTS !== '0';
  const shot = async (n) => { if (!shots) return; for (let k = 0; ; k++) { try { return await shot0(n); } catch (e) { if (k >= 3) throw e; console.log('skrinshot sekin, qayta:', n); } } };
  await page.waitForFunction('window.__ready === true', null, { timeout: 120000 });
  const ev = (js) => page.evaluate(js), T_ = (n, ok, info) => console.log('TEST kurash', n, ok ? 'OK' : 'FAIL', JSON.stringify(info));
  await ev(`window.press = (c) => { G.input.pressed.add(c); G.advance(1 / 60); }; window.K = G.kurash; G.state.money = 20000; G.live.dismount(true); G.hour = 11; G.freezeTime = true; G.sim(0.2); 1`);

  // 1. davra: Karvonsaroy hovlisida, [E] taklifi va zinapoya oynasi
  let r = await ev(`(() => { const a = K.at; G.player.place(a.x + 3, a.z + 3, 0); G.sim(0.5); const pr = G.live.prompt; press('KeyE'); const sn = G.ui.screenName, txt = document.querySelector('.win') ? document.querySelector('.win').textContent : '';
    return { at: !!a, pr, sn, cards: document.querySelectorAll('.kr-ladder .card').length, txt: txt.slice(0, 80), place: Math.round(Math.hypot(a.x - G.T.placeBy.karvon.x, a.z - G.T.placeBy.karvon.z)) }; })()`);
  T_('ring-offer', r.at && /Kurash davrasi/.test(r.pr) && r.sn === 'kurash' && r.cards === 6 && r.place < 90, r);
  await shot('kurash_ladder');
  await ev(`G.ui.close(); 1`);

  // 2. g'alaba: avto o'yinchi to'g'ri javob beradi va otadi — zinapoya oldinga, mukofot
  r = await ev(`(() => { const S = G.state.kurash, m0 = G.state.money, l0 = S.lvl; K.auto = 'win'; const ok = K.start(0); let t = 0; while (K.on && t < 120) { G.sim(0.1); t += 0.1; }
    return { ok, t: +t.toFixed(1), on: K.on, last: K.last, lvl: S.lvl, l0, paid: G.state.money - m0, walk: 0 }; })()`);
  T_('win', r.ok && !r.on && r.last.win && r.lvl === r.l0 + 1 && r.paid === 200 - 100 && r.t < 70, r);
  // keyingi polvon — o'rta bellashuv skrinshoti (otish lahzasi)
  r = await ev(`(() => { K.auto = 'win'; K.start(1); let t = 0; while (K.on && K.m.ph !== 'throw' && t < 90) { G.sim(1 / 30); t += 1 / 30; } const ph = K.m && K.m.ph; G.advance(0.45); return { ph, t: +t.toFixed(1) }; })()`);
  await shot('kurash_throw');
  r = await ev(`(() => { let t = 0; while (K.on && t < 30) { G.sim(0.1); t += 0.1; } return { lvl: G.state.kurash.lvl, last: K.last }; })()`);
  T_('win2', r.lvl === 2 && r.last.win, r);

  // 3. mag'lubiyat: hech narsa qilmasa — hujumlar o'tadi, raqib yutadi; ketma-ket ikki mag'lubiyatdan keyin o'q oynasi uzunroq
  r = await ev(`(() => { const S = G.state.kurash, l0 = S.lvl; K.auto = 'lose'; const res = []; for (let k = 0; k < 2; k++) { K.start(l0); let t = 0; while (K.on && t < 120) { G.sim(0.1); t += 0.1; } res.push([K.last.win, K.last.how, +t.toFixed(0)]); }
    K.start(l0); G.sim(2.5); let dur = 0; for (let i = 0; i < 400 && !(K.m.cue); i++) G.sim(1 / 30); dur = K.m.cue ? K.m.cue.dur : 0; K.quit(); G.ui.close();
    return { res, lvl: S.lvl, l0, streak: S.streak, dur: +dur.toFixed(2), base: K.POLVON[l0].win, quit: K.last.how, loss: S.loss }; })()`);
  T_('lose', r.res.every((q) => q[0] === false) && r.lvl === r.l0 && r.streak >= 2 && r.dur > r.base * 1.15 && r.quit === 'taslim', r);

  // 4. qulf va chempion: keyingidan keyingi polvon va chempion yopiq; zinapoya tugagach belbog', unvon, chempion bir kunda bir marta
  r = await ev(`(() => { const S = G.state.kurash; const skip = K.start(S.lvl + 1), champ0 = K.start(K.POLVON.length); K.auto = 'win';
    while (S.lvl < K.POLVON.length) { K.start(S.lvl); let t = 0; while (K.on && t < 150) { G.sim(0.1); t += 0.1; } if (!K.last.win) break; }
    const belt = S.belt, title = S.title, beltOn = K.beltOn(), lk = G.state.look && G.state.look.belt;
    const c1 = K.start(K.POLVON.length); let t = 0; while (K.on && t < 150) { G.sim(0.1); t += 0.1; } const cw = K.last.win, day = S.champ === K.today(); const c2 = K.start(K.POLVON.length); G.ui.close();
    return { skip, champ0, lvl: S.lvl, belt, title, beltOn, lk, c1, cw, day, c2, wins: S.wins, halol: S.halol }; })()`);
  T_('ladder-champ', !r.skip && !r.champ0 && r.lvl === 6 && r.belt && r.title && r.beltOn && r.c1 && r.cw && r.day && !r.c2, r);
  await ev(`(() => { G.ui.open('kurash'); return 1; })()`); await shot('kurash_ladder_done');
  r = await ev(`(() => { const t = document.querySelector('.win').textContent; G.ui.close(); return { t: /Orol polvoni/.test(t), belt: /belbog/i.test(t) }; })()`);
  T_('ladder-ui', r.t && r.belt, r);

  // 5. bo'yoq ustaxonasi: namuna mashinada ko'rinadi, oyna yopilsa qaytadi; to'langach transport bo'yicha saqlanadi; material o'zgarmaydi
  r = await ev(`(() => { const g = G.site.places.bogiston.garage, B = G.boyoq, V = G.state.veh; G.pickVehicle('jip', [g.x + 4, g.z + 4, 0]); G.player.place(g.x + 1, g.z + 1, 0); G.sim(0.3);
    const m = G.carModel, pm = m.paintMat, c0 = pm.color.getHex();
    G.ui.open('boyoq', g); B.set('hex', 0x2a9ad8); B.set('fin', 'met'); G.advance(0.4); const prog0 = G.renderer.info.programs.length; const pv = { c: pm.color.getHex(), met: pm.metalness, cost: B.cost(B.draft) };
    G.ui.close(); G.sim(0.1); const back = pm.color.getHex() === c0 && Math.abs(pm.metalness - 0.12) < 1e-6;
    G.ui.open('boyoq', g); B.set('hex', 0x8a54c8); B.set('fin', 'mat'); B.set('tone', 0xf2f2ee); const cost = B.cost(B.draft), m0 = G.state.money; G.advance(0.3); B.set('fin', 'sadaf'); G.advance(0.3); B.set('fin', 'xrom'); G.advance(0.3); B.set('fin', 'mat'); const progs = G.renderer.info.programs.length - prog0; const ok = B.pay(); const paid = m0 - G.state.money; G.ui.close(); G.sim(0.1);
    const after = { c: pm.color.getHex(), r: pm.roughness, cc: pm.clearcoat, tone: m._partPaint.color.getHex(), sep: m._partPaint.color !== pm.color };
    G.pickVehicle('velo', [g.x + 4, g.z + 4, 0]); const veloC = G.carModel.paintMat.color.getHex(); G.pickVehicle('jip', [g.x + 4, g.z + 4, 0]); const again = G.carModel.paintMat.color.getHex();
    G.save(); const sv = JSON.parse(localStorage.getItem('safar_save_v2')).veh; G.advance(0.2);
    return { pv, back, cost, ok, paid, after, veloC, again, sv: [sv.col.jip, sv.fin.jip, sv.tone.jip], progs }; })()`);
  T_('paint', r.pv.c === 0x2a9ad8 && r.pv.met > 0.6 && r.pv.cost === 1500 + 900 && r.back && r.ok && r.paid === 1500 + 500 + 800 && r.after.c === 0x8a54c8 && r.after.r > 0.8 && r.after.cc > 0 && r.after.sep && r.after.tone === 0xf2f2ee && r.veloC !== 0x8a54c8 && r.again === 0x8a54c8 && r.sv[0] === 0x8a54c8 && r.sv[1] === 'mat' && r.sv[2] === 0xf2f2ee && r.progs === 0, r);
  // skrinshotlar: metallik va mat namunalari (ustaxona oynasi o'ngda)
  await ev(`(() => { const g = G.site.places.bogiston.garage; G.ui.open('boyoq', g); G.boyoq.set('hex', 0x2a9ad8); G.boyoq.set('fin', 'met'); G.advance(1.2); G.ui.open('boyoq', g); return 1; })()`); await shot('kurash_paint_metallik');
  await ev(`(() => { const g = G.site.places.bogiston.garage; G.boyoq.set('hex', 0xd8392b); G.boyoq.set('fin', 'mat'); G.boyoq.set('tone', 0x2a2c33); G.ui.open('boyoq', g); G.advance(0.8); return 1; })()`); await shot('kurash_paint_mat');
  r = await ev(`(() => { G.boyoq.set('fin', 'sadaf'); const U = G.carModel.paintMat.userData.seam; const p = U.uPearl.value; G.ui.close(); G.sim(0.1); return { p, back: U.uPearl.value }; })()`);
  T_('paint-pearl', r.p > 0.3 && r.back === 0, r);

  // 6. shina to'plamlari: standartda fizika o'zgarmaydi (bir xil boshlang'ich holatdan aynan bir xil tormoz yo'li; to'liq tekshiruv — npm test jadvali), qishki shina qorda tormoz yo'lini qisqartiradi; ustaxona tabi
  r = await ev(`(() => { const T = G.T, car = G.car, B = G.boyoq; let spot = null; const L = T.placeBy.lager;
    for (let rr = 40; rr < 600 && !spot; rr += 20) for (let a = 0; a < 6.28 && !spot; a += 0.3) { const x = L.x + Math.sin(a) * rr, z = L.z + Math.cos(a) * rr, g = T.ground(x, z, 1e9); if (g.surf !== 3 || g.road) continue; let ok = true; for (let d = -30; d <= 30 && ok; d += 5) { const q = T.ground(x + d, z, 1e9); if (q.surf !== 3 || Math.abs(q.y - g.y) > 1.2) ok = false; } if (ok) spot = [x, z]; }
    const brake = () => { car.place(spot[0] - 22, spot[1], Math.PI / 2); for (let i = 0; i < 60; i++) car.step(1 / 120, { throttle: 0, brake: 1, steer: 0, handbrake: false }); car.wetGrip = 1; car.v[0] = 16; car.v[2] = 0; const x0 = car.p[0]; let i = 0; for (; i < 1200 && car.speed > 0.4; i++) car.step(1 / 120, { throttle: 0, brake: 1, steer: 0, handbrake: false }); return +(car.p[0] - x0).toFixed(3); };
    const def0 = car.surfMu, d0 = brake(), d1 = brake(); B.fitTyre('qish'); const mu = car.surfMu && car.surfMu[3], dw = brake(); B.fitTyre('-'); const def1 = car.surfMu, d2 = brake();
    G.goHome(); return { spot: !!spot, def0, d0, d1, d2, dw, mu, def1, own: G.state.veh.tyres.jip }; })()`);
  T_('tyres', r.spot && r.def0 === null && r.def1 === null && r.d2 === r.d1 && Math.abs(r.d0 - r.d1) < 0.01 && r.dw < r.d0 * 0.85 && r.mu > 1.3 && r.own.includes('qish'), r);
  await ev(`(() => { const g = G.site.places.bogiston.garage; G.ui.gtab = 2; G.ui.open('garage', g); return 1; })()`); await shot('kurash_tyres');
  r = await ev(`(() => { const t = document.querySelector('.win').textContent; G.ui.close(); return { ok: /Qishki/.test(t) && /Drift/.test(t) && /Yo'ltanlamas/.test(t) }; })()`);
  T_('tyre-ui', r.ok, r);

  // 7. uy uslubi: an'anaviy hovli — boshqa model ko'rinadi, uy ichi ranglari, saqlanadi
  r = await ev(`(() => { const st = G.state, H = G.site.places.uy.home, U = G.uslub; st.home.lvl = 2; G.live.applyHome(); G.player.place(H.gate[0], H.gate[1] + 0, H.yaw); G.sim(0.3);
    const no = U.set(0), m0 = st.money, ok = U.set(1), paid = m0 - st.money, trad = H.trad(), vis = !!(H.alt[2] && H.alt[2].grp.visible) && !H.levels[2].grp.visible;
    G.interior.rebuildHome(); const isty = G.interior.H.sty; st.home.lvl = 4; G.live.applyHome(); const v4 = !!(H.alt[4] && H.alt[4].grp.visible) && !H.levels[4].grp.visible;
    G.save(); const sv = JSON.parse(localStorage.getItem('safar_save_v2')).home.style; return { no, ok, paid, trad, vis, isty, v4, sv }; })()`);
  T_('home-style', !r.no && r.ok && r.paid === 1500 && r.trad && r.vis && r.isty === 1 && r.v4 && r.sv === 1, r);
  const homeView = `(() => { const H = G.site.places.uy.home, p = H.W(-15, 30), q = H.W(0, -2); G.view(p[0], H.y + 9, p[1], q[0], H.y + 2.5, q[1], 10.5); return 1; })()`;
  await ev(homeView); await shot('kurash_home_trad');
  await ev(`(() => { G.state.money += 2000; G.uslub.set(0); return 1; })()`); await ev(homeView); await shot('kurash_home_modern');
  r = await ev(`(() => { const H = G.site.places.uy.home; return { trad: H.trad(), modern: H.levels[4].grp.visible, alt: !H.alt[4].grp.visible }; })()`);
  T_('home-style-back', !r.trad && r.modern && r.alt, r);
  await ev(`(() => { G.state.money += 2000; G.uslub.set(1); G.live.dismount(true); G.interior.enter('home'); G.sim(0.4); G.advance(0.5); return 1; })()`); await page.waitForTimeout(500); await ev('G.advance(0.1)'); await shot('kurash_home_ichi');
  await ev(`(() => { if (G.interior.inside) G.interior.exit(); G.sim(0.3); return 1; })()`);

  // 8. piyoda masofasi: qayiqda suzilgan masofa kirmaydi, piyoda yurganda — kiradi
  r = await ev(`(() => { const S = G.suv, st = G.state; if (G.interior.inside) G.interior.exit(); G.live.dismount(true); const b = G.boat; G.player.place(b.x + Math.cos(b.yaw) * 3.4, b.z - Math.sin(b.yaw) * 3.4, b.yaw); G.sim(0.3);
    const w0 = st.stats.walk, k0 = st.suv.km; S.enter(b, true); S.auto = [1, 0]; G.sim(10); S.auto = null; const km = st.suv.km - k0, w1 = st.stats.walk; S.off(); G.sim(0.5);
    const a = K.at; G.player.place(a.x + 9, a.z + 9, 0); G.sim(0.3); const w2 = st.stats.walk; G.input.keys.add('KeyW'); G.sim(3); G.input.keys.delete('KeyW'); const w3 = st.stats.walk;
    return { boat: +km.toFixed(1), walkBoat: +(w1 - w0).toFixed(2), walkFoot: +(w3 - w2).toFixed(1) }; })()`);
  T_('walk-stat', r.boat > 15 && r.walkBoat < 0.5 && r.walkFoot > 5, r);
};
