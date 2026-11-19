// Kundalik hayot 3 sinovi: tetiklik (charchoq, sekin yurish, uyqu), ish jadvali bonusi va «Bugungi reja», biznes (sotib olish, daromad, kassa, tovar, ishchi, daraja, mijozlar),
// uy kengaytmalari (mehmon xonasi, oshxona — duxovka/samovar, garaj, hovli jihozlari), qishloq topshiriqlari (10 tur), haydovchi ko'rinishi, saqlov
export default async ({ page, shot: shot0 }) => {
  const shot = async (n) => { for (let k = 0; ; k++) { try { return await shot0(n); } catch (e) { if (k >= 3) throw e; console.log('skrinshot sekin, qayta:', n); } } };
  await page.waitForFunction('window.__ready === true', null, { timeout: 120000 });
  const ev = (js) => page.evaluate(js), T_ = (n, ok, info) => console.log('TEST life3', n, ok ? 'OK' : 'FAIL', JSON.stringify(info));
  await ev(`window.press = (c) => { G.input.pressed.add(c); G.advance(1 / 60); }; window.go = (x, z, yaw = 0) => { G.player.place(x, z, yaw); G.sim(0.3); }; window.click = (a) => { const b = document.querySelector('[data-a="' + a + '"]'); if (b && !b.disabled) { b.click(); return true; } return false; }; G.state.money = 200000; G.live.dismount(true); G.hour = 10; G.freezeTime = true; G.sim(0.2); 1`);

  // 1. tetiklik: vaqt o'tsa kamayadi, past bo'lsa sekin yuradi, uxlasa tiklanadi
  let r = await ev(`(() => { const st = G.state; st.tetik = 100; G.freezeTime = false; G.sim(20); G.freezeTime = true; const d1 = 100 - st.tetik;
    st.tetik = 6; G.sim(0.5); const mul = G.player.speedMul, low = G.kun.low(); const veil = +document.getElementById('tired').style.opacity;
    return { d1: +d1.toFixed(2), mul: +mul.toFixed(3), low: +low.toFixed(2), veil }; })()`);
  T_('fatigue', r.d1 > 0.5 && r.d1 < 3 && r.mul < 0.9 && r.low > 0.7 && r.veil > 0.3, r);
  await ev('G.advance(0.2)'); await shot('life3_tired');
  r = await ev(`(() => { const h = G.site.places.uy.home; go(h.door[0], h.door[1] + 1.5, Math.PI); G.hayot.enterHome(); G.sim(0.3); const s = G.hayot.spot('bed'); go(s.x, s.z, s.yaw); press('KeyE'); G.sim(4); G.sim(2); return { ins: G.interior.inside, tetik: Math.round(G.state.tetik), hour: +G.hour.toFixed(1) }; })()`);
  T_('sleep', r.ins === 'home' && r.tetik === 100 && Math.abs(r.hour - 6.5) < 0.01, r);

  // 2. ish jadvali: ertalab non — bonus; telefon «Bugungi reja» [7]
  r = await ev(`(() => { G.interior.exit(); G.hour = 8; G.sim(0.2); G.ish.startNon(); G.sim(1.1); const J = G.ish.cur, sched = !!(J && J.sched); const p = J.pts[0]; go(p.x + 0.8, p.z + 0.8); press('KeyE'); G.sim(1.3); const bonus = G.state.income.find((q) => q[1] === 'Ish vaqti bonusi'); G.ish.quit(); G.sim(0.2);
    G.hour = 14; G.sim(0.1); G.ish.startNon(); const s2 = !!(G.ish.cur && G.ish.cur.sched); G.ish.quit(); G.sim(1.2); return { sched, bonus: bonus ? bonus[2] : 0, s2 }; })()`);
  T_('job-schedule', r.sched && r.bonus === 9 && !r.s2, r);
  r = await ev(`(() => { press('Digit7'); const scr = G.ui.screenName, app = G.phone.app, rows = document.querySelectorAll('[data-a^="kgo:"]').length; G.advance(0.05); return { scr, app, rows }; })()`);
  T_('phone-plan', r.scr === 'telefon' && r.app === 'kun' && r.rows >= 4, r);
  await shot('life3_phone_kun');
  await ev('G.ui.close()');

  // 3. biznes: choyxonani sotib olish, daromad (o'yin vaqti), kassa, tovar, ishchi, daraja, mijozlar
  r = await ev(`(() => { const b = G.hayot2.bld.find((q) => q.kind === 'cafe'); go(b.x, b.z, b.yaw + Math.PI); press('KeyE'); G.sim(0.3); const sp = G.interior.cur().spots.find((s) => s.k === 'biz'); go(sp.x, sp.z, 0); const pr = G.live.prompt; press('KeyE'); const scr = G.ui.screenName; const m0 = G.state.money; click('buy'); const own = G.biznes.own('choyxona'), paid = m0 - G.state.money; G.ui.close(); return { pr, scr, own, paid }; })()`);
  T_('biz-buy', /sotib olish/.test(r.pr) && r.scr === 'biznes' && r.own && r.paid === 22000, r);
  r = await ev(`(() => { const s = G.state.biz.choyxona; G.kun.pass(6); const cash = Math.floor(s.cash), stock = Math.round(s.stock); press('KeyE'); const m0 = G.state.money; click('col'); const got = G.state.money - m0; const inc = G.state.income.find((q) => q[1] === 'Biznes: Choyxona');
    const rc = G.biznes.restockCost('choyxona'); const m1 = G.state.money; click('stock'); const paidS = m1 - G.state.money; click('hire'); click('up'); click('up'); click('up'); click('up'); const lvl = s.lvl, staff = s.staff; G.ui.close();
    return { cash, stock, got, inc: inc && inc[2], rc, paidS, full: Math.round(s.stock), lvl, staff, rate: Math.round(G.biznes.rate('choyxona', 13)), guests: G.interior.X.cafe.grp.children.length }; })()`);
  T_('biz-manage', r.cash > 200 && r.stock < 100 && r.got === r.cash && r.inc === r.cash && r.paidS === r.rc && r.full === 100 && r.lvl === 5 && r.staff === 1 && r.rate > 75 * 3.6, r);
  await ev('G.sim(0.5); G.cam.snap(); G.advance(0.3)'); await shot('life3_biz_inside');
  r = await ev(`(() => { G.interior.exit(); const S = G.biznes.sites.choyxona; go(S.door[0] + Math.sin(S.yaw) * 9, S.door[1] + Math.cos(S.yaw) * 9, S.yaw + Math.PI); G.hour = 13; G.sim(6); const vis = G.biznes.pool.filter((c) => c.rig.root.visible).length; const deco = [1, 2, 3, 4, 5].every((i) => S.lv[i].visible); return { vis, deco, n: G.biznes.guests('choyxona', 13) }; })()`);
  T_('biz-outside', r.vis >= 3 && r.deco && r.n >= 5, r);
  await ev(`(() => { const S = G.biznes.sites.choyxona; const [x, z] = S.W(6, 12); const y = G.T.ground(x, z, 1e9).y; const [tx, tz] = S.W(0, 1); G.view(x, y + 4, z, tx, y + 1.2, tz, 13); })()`); await shot('life3_biz_outside');
  r = await ev(`(() => { press('Digit4'); click('app:biznes'); G.advance(0.05); const rows = document.querySelectorAll('[data-a^="bzwin:"]').length; return { rows }; })()`);
  await shot('life3_phone_biz');
  r = Object.assign(r, await ev(`(() => { click('home'); click('app:bank'); const extra = document.querySelectorAll('[data-a="bzwin:choyxona"]').length; click('home'); click('app:biznes'); click('bzwin:choyxona'); const scr = G.ui.screenName, dis = document.querySelector('[data-a="col"]').disabled; G.advance(0.05); return { extra, scr, dis }; })()`));
  T_('biz-phone', r.rows === 1 && r.extra === 1 && r.scr === 'biznes' && r.dis, r);
  await shot('life3_biz_window');
  await ev('G.ui.close()');

  // 4. uy: villa, kengaytmalar va hovli jihozlari
  r = await ev(`(() => { const st = G.state; for (let i = 0; i < 4; i++) G.live.upgradeHome(); const lvl = st.home.lvl; G.ui.open('home'); const n = document.querySelectorAll('[data-a^="u2buy:"]').length; for (const id of ['guest', 'kitchen', 'garage', 'topchan', 'ishkom', 'mangal', 'tandir', 'bog', 'girlyanda']) click('u2buy:' + id); const ext = document.querySelector('.u2-ext') ? 1 : 0; G.ui.close(); G.sim(0.3);
    const H = st.home2; return { lvl, n, ext, own: ['guest', 'kitchen', 'garage'].map((k) => H[k]).join(''), yard: Object.keys(H.yard).sort().join(','), vis: Object.values(G.uy2.yard).filter((o) => o && o.grp && o.grp.visible).length }; })()`);
  T_('home-buy', r.lvl === 4 && r.n === 9 && r.ext && r.own === '111' && r.yard.split(',').length === 6 && r.vis >= 5, r);
  r = await ev(`(() => { const h = G.site.places.uy.home; go(h.door[0], h.door[1] + 1.5, Math.PI); G.hayot.enterHome(); G.sim(0.3); const I = G.interior.cur(), rooms = I.rooms.map((q) => q.t).join(','); const gb = I.spots.filter((s) => s.k === 'bed').length;
    const sv = G.hayot.spot('samovar'); G.state.tetik = 40; go(sv.x, sv.z, 0); const pr = G.live.prompt; press('KeyE'); G.sim(5); const t1 = Math.round(G.state.tetik);
    const ov = G.hayot.spot('oven'); G.state.inv.veg = 2; G.state.inv.egg = 2; go(ov.x, ov.z, 0); press('KeyE'); const scr = G.ui.screenName; click('bake:somsa'); G.sim(7); const somsa = G.state.inv.somsa || 0; return { rooms, gb, pr, t1, scr, somsa }; })()`);
  T_('home-rooms', /guest/.test(r.rooms) && r.gb === 2 && /Samovar/.test(r.pr) && r.t1 >= 60 && r.scr === 'duxovka' && r.somsa === 2, r);
  await ev(`(() => { const I = G.interior.cur(), rm = I.rooms.find((q) => q.t === 'guest'), o = I.o; go(o[0] + rm.x1 - 0.7, o[2] + rm.z1 - 0.8, -2.4); G.sim(0.3); G.view(o[0] + rm.x1 - 0.25, o[1] + 2.2, o[2] + rm.z1 - 0.25, o[0] + rm.x0 + 1.0, o[1] + 0.6, o[2] + (rm.z0 + rm.z1) / 2 - 0.4); })()`); await shot('life3_guestroom');
  await ev(`(() => { const ov = G.hayot.spot('oven'); go(ov.x - 0.6, ov.z - 1.2, 0.4); G.cam.snap(); G.sim(0.4); G.advance(0.2); })()`); await shot('life3_kitchen');
  r = await ev(`(() => { G.interior.exit(); const st = G.state, H = st.home2, U = G.uy2, h = G.site.places.uy.home; const W = (x, z) => h.W(x, z); let p = W(-4.4, 7.4 + 1.25); go(p[0], p[1]); press('KeyE'); G.sim(0.3); const sit = G.player.sit; G.player.sit = false;
    p = W(5.2, 4.2 - 0.8); go(p[0], p[1]); const m0 = st.money; press('KeyE'); G.sim(5.5); const sh = st.inv.shashlik || 0, paid = m0 - st.money;
    p = W(-4, -13.6 + 1.5); go(p[0], p[1]); const f0 = st.inv.fruit || 0; press('KeyE'); G.sim(1.5); const fr = (st.inv.fruit || 0) - f0;
    p = W(-4.4 + 2.0, 7.4); go(p[0], p[1]); const b0 = st.inv.berry || 0; press('KeyE'); G.sim(1.5); const gr = (st.inv.berry || 0) - b0;
    p = W(-5.6, 0.6 + 1.0); go(p[0], p[1]); const n0 = st.inv.bread || 0; press('KeyE'); G.sim(3.5); const nb = (st.inv.bread || 0) - n0;
    st.inv.kabob = 0; st.inv.dimlama = 0; st.inv.friedfish = 0; st.inv.soup = 0; st.inv.omlet = 0; st.inv.salad = 0; st.thirst = 100; st.sat = 30; press('KeyY'); const ate = st.inv.shashlik < sh;
    return { sit, sh, paid, fr, gr, nb, ate }; })()`);
  T_('yard', r.sit && r.sh === 2 && r.paid === 20 && r.fr === 6 && r.gr === 4 && r.nb === 3 && r.ate, r);
  r = await ev(`(() => { const st = G.state, U = G.uy2; G.live.mount(true); G.setVehicle('jip'); const d = U.gDoor(); G.car.place(d[0], d[1], 0); G.prevP = G.car.p.slice(); G.damage.zone.front = 40; G.damage.engine = 60; G.sim(0.5); press('KeyE'); const scr = G.ui.screenName; const m0 = st.money; click('fix'); const fixed = G.damage.health >= 99, paid = m0 - st.money;
    click('pick:velo'); const cur = st.veh.cur, gv = st.home2.gVeh, disp = !!(U.garageDisp() && U.garageDisp().root.visible); G.ui.close(); return { scr, fixed, paid, cur, gv, disp }; })()`);
  T_('garage', r.scr === 'garaj' && r.fixed && r.paid > 0 && r.cur === 'velo' && r.gv === 'jip' && r.disp, r);
  await ev(`(() => { const h = G.site.places.uy.home, p = h.W(-14, 30), t = h.W(-2, 4); const y = G.T.gridHeight(t[0], t[1]); G.view(p[0], y + 15, p[1], t[0], y, t[1], 16.5); })()`); await shot('life3_yard');
  await ev(`(() => { G.hour = 21; G.sim(0.1); const h = G.site.places.uy.home, p = h.W(6, 17), t = h.W(-4.4, 6.5); const y = G.T.gridHeight(t[0], t[1]); G.view(p[0], y + 4.5, p[1], t[0], y + 1.6, t[1], 21); })()`); await shot('life3_yard_night');

  // 5. haydovchi: kiyim o'zgarsa — velosipedchi ham yangi kiyimda
  r = await ev(`(() => { const m = G.carModel, r0 = m.rider; G.state.look = Object.assign({}, G.hayot2.lookOf(), { shirt: 0xd8392b, hs: 3, beard: 'soqol' }); G.sim(0.1); const r1 = G.carModel.rider; G.setVehicle('moto'); G.sim(0.1); const r2 = G.carModel.rider; return { veh: G.carModel.id, changed: r0 !== r1, vis: r1.visible, moto: !!(r2 && G.carModel._lookK) }; })()`);
  T_('rider-look', r.changed && r.vis && r.moto, r);
  await ev(`(() => { G.setVehicle('velo'); const c = G.car.p; G.view(c[0] + 2.6, c[1] + 1.2, c[2] + 1.8, c[0], c[1] + 0.6, c[2]); })()`); await shot('life3_rider');

  // 6. topshiriqlar: 10 tur — har birini boshlab, bajarib ko'ramiz
  r = await ev(`(() => { const E = G.topshiriq, st = G.state, npcs = G.live._dbg.npcs, out = {}; G.live.dismount(true); G.setVehicle('jip');
    const giver = (type) => { const o = npcs.find((q) => !q.away && q.role === 'talk' && (q.err = type, q.errCool = 0, q.draft = null, E.offer(q))); return o; };
    const at = (o) => { const b = (G.site.places[o.place] || {}).board; let dx = 1, dz = 0.3; if (b) { dx = o.x - b.x; dz = o.z - b.z; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l; } go(o.x + dx * 1.1, o.z + dz * 1.1); }; // e'lonlar taxtasidan uzoq tomondan
    const back = (o) => { at(o); press('KeyE'); G.sim(1.4); };
    for (const type of ['sumka', 'xat', 'echki', 'tovuq', 'suv', 'devor', 'non', 'otin', 'baliq', 'bozor']) {
      const h0 = st.hurmat, m0 = st.money, o = giver(type); if (!o) { out[type] = 'no-giver'; continue; }
      at(o); press('KeyE'); const scr = G.ui.screenName; click('ok'); const D = E.cur; if (!D) { out[type] = 'no-start:' + scr; continue; }
      if (type === 'sumka') { go(D.dest.x + 0.6, D.dest.z + 0.6); press('KeyE'); G.sim(1.2); }
      if (type === 'xat') back(D.who);
      if (type === 'echki') { go(D.goat.x + 1, D.goat.z + 0.5); press('KeyE'); G.sim(1.4); at(o); G.sim(3); press('KeyE'); G.sim(0.3); }
      if (type === 'tovuq') { for (const hh of D.hens) { go(hh.x + 0.5, hh.z + 0.3); G.sim(0.2); press('KeyE'); G.sim(1.1); } back(o); }
      if (type === 'suv') { go(D.well.x + 1.4, D.well.z + 0.6); press('KeyE'); G.sim(1.6); back(o); }
      if (type === 'devor') { for (const f of D.fence) { go(f.x + 0.9, f.z + 0.4); press('KeyE'); G.sim(1.7); } at(o); press('KeyE'); G.sim(0.3); }
      if (type === 'non') { st.inv.bread = 2; back(o); }
      if (type === 'otin') { st.inv.wood = 4; back(o); }
      if (type === 'baliq') { st.inv.fish = 1; back(o); }
      if (type === 'bozor') { G.live.mount(true); G.car.place(o.x + 5, o.z + 5, 0); G.prevP = G.car.p.slice(); G.sim(0.6); press('KeyE'); G.sim(0.3); const ride = D.stage; G.car.place(D.dest.x + 3, D.dest.z + 3, 0); G.prevP = G.car.p.slice(); G.sim(1.5); out.ride = ride; G.live.dismount(true); }
      out[type] = (!E.cur && st.hurmat > h0 && st.money > m0) ? 'ok' : 'fail:' + (E.cur ? E.cur.type : '-') + ':' + scr;
      if (E.cur) E.quit(); }
    return { out, hurmat: st.hurmat, done: st.errands.done }; })()`);
  const types = ['sumka', 'xat', 'echki', 'tovuq', 'suv', 'devor', 'non', 'otin', 'baliq', 'bozor'];
  T_('errands', types.every((t) => r.out[t] === 'ok') && r.done >= 10 && r.out.ride === 'ride', r);
  // echki ortidan ergashadi (rasm uchun)
  await ev(`(() => { const E = G.topshiriq, npcs = G.live._dbg.npcs; const o = npcs.find((q) => q.role === 'talk' && (q.err = 'echki', q.errCool = 0, q.draft = null, E.offer(q))); if (!o) return; E.start(o); const D = E.cur; go(D.goat.x + 1, D.goat.z + 0.5); press('KeyE'); G.sim(1.4); G.hour = 15; go(D.goat.x - 3, D.goat.z - 3, 0.6); G.sim(2.5); const p = G.player.p, gp = G.uy2 && D; const c = [p[0] + 3.5, p[1] + 2.2, p[2] + 3.5]; G.view(c[0], c[1], c[2], p[0] - 0.6, p[1] + 0.6, p[2] - 0.6, 15); })()`); await shot('life3_errand_goat');
  r = await ev(`(() => { const o = G.live._dbg.npcs.find((q) => q.role === 'talk' && !q.away && G.topshiriq.offerOf(q) && q !== (G.topshiriq.cur && G.topshiriq.cur.o)); G.topshiriq.quit(); if (!o) return { none: 1 }; go(o.x + 1.4, o.z + 0.6, -1.6); press('KeyE'); G.advance(0.05); return { scr: G.ui.screenName }; })()`);
  T_('errand-dialog', r.scr === 'topshiriq', r);
  await shot('life3_errand_dialog');
  await ev('G.ui.close()');

  // 7. saqlov: yangi maydonlar saqlanadi va qayta yuklanadi
  r = await ev(`(() => { G.save(); const sv = JSON.parse(localStorage.getItem('safar_save_v2')); return { biz: !!(sv.biz && sv.biz.choyxona && sv.biz.choyxona.lvl === 5), home2: !!(sv.home2 && sv.home2.garage && sv.home2.yard.bog), tetik: typeof sv.tetik, hurmat: sv.hurmat, done: sv.errands && sv.errands.done, soat: sv.soat > 5 }; })()`);
  T_('save', r.biz && r.home2 && r.tetik === 'number' && r.hurmat >= 20 && r.done >= 10 && r.soat, r);
  await page.reload(); await page.waitForFunction('window.__ready === true', null, { timeout: 120000 });
  r = await ev(`(() => { const st = G.state; G.sim(0.3); return { biz: G.biznes.own('choyxona') && st.biz.choyxona.lvl, garage: !!G.uy2.garageDisp(), yard: Object.values(G.uy2.yard).filter((o) => o && o.grp && o.grp.visible).length, rooms: G.interior.H.rooms.length, hurmat: st.hurmat }; })()`);
  T_('reload', r.biz === 5 && r.garage && r.yard >= 5 && r.rooms >= 5 && r.hurmat >= 20, r);
};
