// Kundalik hayot 2 sinovi: choyxona (buyurtma, ofitsiant, ovqatlanish), kiyim do'koni (sotib olish, saqlanish), sartarosh, 3 ish (non, taksi, dala), telefon (taksi, mexanik), ko'cha (muzqaymoq, kaptar, futbol, avtobus)
export default async ({ page, shot: shot0 }) => {
  // dasturiy renderda ba'zan bitta skrinshot 2 daqiqadan oshadi — bir marta qayta urinamiz (o'yin holati o'zgarmaydi)
  const shot = async (n) => { for (let k = 0; ; k++) { try { return await shot0(n); } catch (e) { if (k >= 3) throw e; console.log('skrinshot sekin, qayta:', n); } } };
  await page.waitForFunction('window.__ready === true', null, { timeout: 120000 });
  const ev = (js) => page.evaluate(js), T_ = (n, ok, info) => console.log('TEST life2', n, ok ? 'OK' : 'FAIL', JSON.stringify(info));
  await ev(`window.press = (c) => { G.input.pressed.add(c); G.advance(1 / 60); }; window.go = (x, z, yaw = 0) => { G.player.place(x, z, yaw); G.sim(0.3); }; window.click = (a) => { const b = document.querySelector('[data-a="' + a + '"]'); if (b) b.click(); return !!b; }; G.state.money = 5000; 1`);
  // 1. choyxona: kirish, topchanga o'tirish, menyu, ofitsiant olib keladi, ovqatlanish
  let r = await ev(`(() => { G.live.dismount(true); G.hour = 13; G.freezeTime = true; const b = G.hayot2.bld.find((q) => q.kind === 'cafe'); go(b.x, b.z, b.yaw + Math.PI); press('KeyE'); G.sim(0.4); return { inside: G.interior.inside, region: G.region }; })()`);
  T_('cafe-enter', r.inside === 'cafe', r);
  r = await ev(`(() => { const s = G.interior.X.cafe.seats[0]; go(s.x + 1.7, s.z + 0.6, -Math.PI / 2); press('KeyE'); G.sim(0.5); const sit = G.player.sit && G.player.anim === 'sit', pr = G.live.prompt; press('KeyE'); const scr = G.ui.screenName; const m0 = G.state.money; click('ord:osh'); click('ord:choy'); const m1 = G.state.money; G.ui.close(); G.sim(0.5); const walking = G.hayot2.waiter.ph; G.sim(9); return { sit, pr, scr, paid: m0 - m1, walking, dishes: G.hayot2.dishes.map((d) => d.id), py: +(G.player.p[1] - 60).toFixed(2) }; })()`);
  T_('cafe-order', r.sit && r.scr === 'choyxona' && r.paid === 51 && r.walking === 'go' && r.dishes.length === 2, r);
  await ev('G.cam.snap(); G.advance(0.3)'); await shot('life2_cafe');
  r = await ev(`(() => { G.state.sat = 40; G.state.thirst = 30; press('KeyE'); G.sim(1); const a1 = G.player.anim; G.sim(4); const s1 = Math.round(G.state.sat); press('KeyE'); G.sim(0.8); const a2 = G.player.anim; G.sim(2.5); return { a1, s1, a2, th: Math.round(G.state.thirst), left: G.hayot2.dishes.length }; })()`);
  T_('cafe-eat', r.a1 === 'eat' && r.s1 >= 95 && r.a2 === 'drink' && r.th >= 65 && r.left === 0, r);
  // 2. kiyim do'koni: ko'zgu oldida qizil ko'ylak + qora shim + panama, sotib olish va saqlanishi
  r = await ev(`(() => { G.interior.exit(); G.player.sit = false; const b = G.hayot2.bld.find((q) => q.kind === 'kiyim'); go(b.x, b.z, b.yaw + Math.PI); press('KeyE'); const ins = G.interior.inside; const s = G.hayot2.spot('kiyim'); go(s.x, s.z, 0); press('KeyE'); const scr = G.ui.screenName, rig0 = G.player.rig; click('shirt:' + 0xd8392b); click('tab:2'); click('pants:' + 0x1d1e22); click('tab:3'); click('hat:panama'); const changed = G.player.rig !== rig0; G.advance(0.1); return { ins, scr, changed }; })()`);
  await shot('life2_kiyim');
  r = Object.assign(r, await ev(`(() => { const m0 = G.state.money; click('buy'); G.sim(0.2); G.save(); const sv = JSON.parse(localStorage.getItem('safar_save_v2')); return { paid: m0 - G.state.money, look: G.state.look && G.state.look.shirt, hat: G.state.hat, own: G.state.clothes, svShirt: sv.look && sv.look.shirt, svPants: sv.look && sv.look.pants, kept: G.hayot2.look.shirt }; })()`));
  T_('clothes-buy', r.ins === 'kiyim' && r.scr === 'kiyim' && r.changed && r.paid === 80 + 90 + 220 && r.svShirt === 0xd8392b && r.svPants === 0x1d1e22 && r.hat === 'panama' && r.kept === 0xd8392b, r);
  // ko'rib chiqib sotib olmasa — eski kiyim qaytadi
  r = await ev(`(() => { const s = G.hayot2.spot('kiyim'); go(s.x, s.z, 0); press('KeyE'); click('tab:0'); click('shirt:' + 0x3f9a58); const pv = G.hayot2.look.shirt; G.ui.close(); G.sim(0.1); return { pv, back: G.hayot2.look.shirt, st: G.state.look.shirt }; })()`);
  T_('clothes-revert', r.pv === 0x3f9a58 && r.back === 0xd8392b && r.st === 0xd8392b, r);
  // 3. sartarosh: kresloga o'tirish, soqol va soch rangi
  r = await ev(`(() => { G.interior.exit(); const b = G.hayot2.bld.find((q) => q.kind === 'sart'); go(b.x, b.z, b.yaw + Math.PI); press('KeyE'); const ins = G.interior.inside; const s = G.hayot2.spot('sartarosh'); go(s.x + 0.5, s.z - 0.4, 0); press('KeyE'); G.sim(0.6); const sit = G.player.sit; press('KeyE'); const scr = G.ui.screenName; click('bd:soqol'); click('hc:' + 0x15110e); click('hs:1'); G.advance(0.1); return { ins, sit, scr }; })()`);
  await shot('life2_sartarosh');
  r = Object.assign(r, await ev(`(() => { const m0 = G.state.money; click('cut'); G.sim(1.5); const cutting = !!G.hayot2.barber.cut; G.sim(3); return { cutting, paid: m0 - G.state.money, look: G.state.look, sit: G.player.sit }; })()`));
  T_('barber', r.ins === 'sart' && r.sit && r.scr === 'sartarosh' && r.cutting && r.paid === 40 + 60 + 40 && r.look.beard === 'soqol' && r.look.hs === 1 && r.look.hair === 0x15110e, r);
  await ev(`(() => { G.advance(0.3); const p = G.player.p; G.view(p[0] + 0.75, p[1] + 1.35, p[2] + 0.85, p[0], p[1] + 1.1, p[2]); })()`); await shot('life2_sartarosh2'); // yangi soch va soqol — oldidan
  // 4. ish: non yetkazish
  r = await ev(`(() => { G.interior.exit(); G.player.sit = false; const n = G.ish.pts.non; go(n.x + 1.5, n.z, -Math.PI / 2); press('KeyE'); const scr = G.ui.screenName; click('start'); G.sim(1.2); const J = G.ish.cur; return { scr, id: J && J.id, n: J && J.pts.length }; })()`);
  await ev(`(() => { const p = G.ish.cur.pts[0]; G.player.place(p.x + 3, p.z + 3, 0); G.cam.snap(); G.advance(0.4); })()`); await shot('life2_non');
  r = Object.assign(r, await ev(`(() => { const m0 = G.state.money, J = G.ish.cur; for (const p of J.pts.slice()) { go(p.x + 0.8, p.z + 0.8); press('KeyE'); G.sim(1.3); } return { done: J.done, cur: !!G.ish.cur, earn: J.earn, money: G.state.money - m0, jn: G.state.jobs.non && G.state.jobs.non.n }; })()`));
  T_('job-bread', r.scr === 'ishlar' && r.id === 'non' && r.done === r.n && !r.cur && r.money > r.n * 30 && r.jn === 1, r);
  // 5. ish: dalada o'rim
  r = await ev(`(() => { const n = G.ish.pts.dala; go(n.x + 1.2, n.z, -Math.PI / 2); press('KeyE'); click('start'); G.sim(0.3); const J = G.ish.cur; const id = J && J.id; return { id }; })()`);
  await ev(`(() => { const q = G.ish.cur.pick[0]; G.player.place(q.x + 1.2, q.z + 1.2, -2.3); G.sim(0.3); press('KeyE'); G.sim(1.5); const c = G.ish.field.cart; G.player.place(c.x + 3, c.z + 2, -2); G.cam.snap(); G.advance(0.5); })()`); await shot('life2_dala');
  r = Object.assign(r, await ev(`(() => { const J = G.ish.cur, c = G.ish.field.cart, m0 = G.state.money; go(c.x + 1.6, c.z + 1.6); press('KeyE'); G.sim(1.1); let ok = J.done === 1;
    while (J.pick.length && G.ish.cur) { const q = J.pick[0]; go(q.x + 0.9, q.z + 0.9); press('KeyE'); G.sim(1.6); if (!J.carry) ok = false; go(c.x + 1.6, c.z + 1.6); press('KeyE'); G.sim(1.1); }
    return { ok, done: J.done, cur: !!G.ish.cur, earn: J.earn }; })()`));
  T_('job-field', r.id === 'dala' && r.ok && r.done === 6 && !r.cur && r.earn === 6 * 18 + 70, r);
  // 6. ish: taksi smenasi (3 yo'lovchi)
  r = await ev(`(() => { G.live.mount(true); G.setVehicle('jip'); const m0 = G.state.money; G.ish.startTaksi(); const J = G.ish.cur; const log = [];
    for (let k = 0; k < 3; k++) { G.runUntil((g) => g.ish.cur && g.ish.cur.stage === 'pick', 8); const a = J.a; G.car.place(a.x + 4, a.z + 4, 0); G.prevP = G.car.p.slice(); G.sim(0.6); const pr = G.live.prompt; press('KeyE'); G.sim(0.3); const st1 = J.stage; const b = J.b; G.car.place(b.x + 3, b.z + 3, 0); G.prevP = G.car.p.slice(); G.sim(1.2); log.push([pr.includes('olish'), st1, J.done]); }
    return { log, cur: !!G.ish.cur, earn: J.earn, money: G.state.money - m0 }; })()`);
  T_('job-taxi', r.log.every((q) => q[0] && q[1] === 'drop') && !r.cur && r.earn > 150 && r.money >= r.earn, r);
  // 7. telefon: ochish, bank, taksi chaqirish (transport yoniga keladi), mexanik
  r = await ev(`(() => { G.live.dismount(true); const p = G.player.p; G.car.place(p[0] + 300, p[2] + 300, 0); G.prevP = G.car.p.slice(); G.sim(0.3); press('Digit4'); const scr = G.ui.screenName; G.advance(0.1); return { scr }; })()`);
  await shot('life2_phone');
  await ev(`click('app:bank'); G.advance(0.05)`); await shot('life2_phone_bank');
  r = Object.assign(r, await ev(`(() => { const bank = document.querySelectorAll('.ph-list > div').length; click('home'); click('app:kontakt'); const m0 = G.state.money; click('taxi'); G.sim(0.3); const p = G.player.p, d = Math.hypot(G.car.p[0] - p[0], G.car.p[2] - p[2]);
    const z = G.damage.zone; z.front = 30; z.left = 40; G.damage.engine = 50; const h0 = G.damage.health; press('Digit4'); click('app:kontakt'); click('mech'); G.sim(0.2); return { bank, d: Math.round(d), fee: m0 - G.state.money, h0, h1: G.damage.health, scr: G.ui.screenName }; })()`));
  T_('phone', r.scr === null && r.bank >= 5 && r.d < 16 && r.h0 < 80 && r.h1 >= 99, r);
  await ev(`(() => { press('Digit4'); click('app:havo'); G.advance(0.05); })()`); await shot('life2_phone_havo');
  await ev('G.ui.close()');
  // 8. ko'cha: muzqaymoq, kaptarlar, futbol goli, avtobus
  r = await ev(`(() => { const K = G.kocha, ic = K.ice; go(ic.x + Math.sin(ic.yaw + Math.PI) * 1.4, ic.z + Math.cos(ic.yaw + Math.PI) * 1.4, ic.yaw); const i0 = G.state.stats.ice || 0; press('KeyE'); G.sim(0.6); const a = G.player.anim; G.sim(3); const inc = G.state.income.find((q) => q[1] === 'Muzqaymoq'), paid = inc ? -inc[2] : 0, ice = (G.state.stats.ice || 0) - i0;
    const B = K.birds; go(B.x + 2.5, B.z, -Math.PI / 2); press('KeyE'); G.sim(1.2); const feed = B.feedT > 0; G.sim(3); const near = B.list.filter((b) => Math.hypot(b.x - B.food[0], b.z - B.food[1]) < 2).length;
    return { a, paid, ice, feed, near }; })()`);
  T_('icecream-birds', r.a === 'eat' && r.paid === 8 && r.ice === 1 && r.feed && r.near >= 6, r);
  await ev(`(() => { const B = G.kocha.birds; G.player.place(B.x + 4, B.z + 2.5, -2); G.cam.snap(); G.advance(0.4); })()`); await shot('life2_birds');
  r = await ev(`(() => { const K = G.kocha, P = K.pitch, b = K.ball, g0 = G.state.stats.goals || 0; const [gx, gz] = P.W(0, 6.5); b.x = gx; b.z = gz; b.vx = b.vy = b.vz = 0; const yaw = Math.atan2(P.W(0, 9)[0] - gx, P.W(0, 9)[1] - gz); go(gx - Math.sin(yaw) * 1.0, gz - Math.cos(yaw) * 1.0, yaw); b.x = gx; b.z = gz; b.vx = b.vz = 0; press('KeyE'); G.sim(2); return { goals: (G.state.stats.goals || 0) - g0 }; })()`);
  T_('football', r.goals === 1, r);
  r = await ev(`(() => { const K = G.kocha, s = K.stop.seat; go(s.x + 1, s.z); press('KeyE'); G.sim(0.4); const sit = G.player.sit; G.runUntil((g) => g.kocha.bus.ph === 'stop', 60); G.sim(0.2); const ph = K.bus.ph; return { sit, ph }; })()`);
  await ev(`(() => { const s = G.kocha.stop; G.view(s.x + Math.sin(s.yaw) * 14 + 6, G.T.gridHeight(s.x, s.z) + 4, s.z + Math.cos(s.yaw) * 14 + 6, G.kocha.bus.on ? s.x : s.x, G.T.gridHeight(s.x, s.z) + 1.2, s.z); })()`); await shot('life2_bus');
  r = Object.assign(r, await ev(`(() => { press('KeyE'); const scr = G.ui.screenName; const m0 = G.state.money; click('go:mayoq'); return { scr, m0 }; })()`));
  await page.waitForTimeout(300);
  r = Object.assign(r, await ev(`(() => { const b = G.site.places.mayoq.board, p = G.player.p; return { d: Math.round(Math.hypot(p[0] - b.x, p[2] - b.z)), paid: ${r.m0} - G.state.money }; })()`));
  T_('bus', r.sit && r.ph === 'stop' && r.scr === 'avtobus' && r.d < 15 && r.paid === 15, r);
  // 9. saqlov: yangi maydonlar va uydagi shkaf
  r = await ev(`(() => { G.save(); const sv = JSON.parse(localStorage.getItem('safar_save_v2')); return { look: !!sv.look, clothes: sv.clothes.length, inc: sv.income.length, jobs: Object.keys(sv.jobs) }; })()`);
  T_('save-fields', r.look && r.clothes >= 2 && r.inc >= 5 && r.jobs.length === 3, r);
};
