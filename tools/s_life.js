// Kundalik hayot sinovi: uyga kirish, uxlash, o'tirish/turish, pishirish va stolda ovqatlanish, suv ichish, do'kon, yoqilg'i quyish, bo'sh bak, NPC suhbati
export default async ({ page, shot }) => {
  await page.waitForFunction('window.__ready === true', null, { timeout: 120000 });
  const ev = (js) => page.evaluate(js), T_ = (n, ok, info) => console.log('TEST life', n, ok ? 'OK' : 'FAIL', JSON.stringify(info));
  await ev(`window.press = (c) => { G.input.pressed.add(c); G.advance(1 / 60); }; 1`);
  // 1. uyga kirish: eshik oldida [E]
  let r = await ev(`(() => { G.live.dismount(true); G.state.home.lvl = 2; G.live.applyHome(); const h = G.site.places.uy.home; G.player.place(h.door[0], h.door[1], 0); G.sim(0.5); const np = G.nearPoint && G.nearPoint.kind; press('KeyE'); G.sim(0.4); return { np, inside: G.interior.inside, room: G.region }; })()`);
  console.log('TEST life enter-home', r.inside === 'home' ? 'OK' : 'FAIL', JSON.stringify(r));
  await ev('G.advance(0.2)'); await shot('life_home');
  // 2. uxlash: kechqurun yotadi — budilnikkacha vaqt o'tadi, kuch 100
  r = await ev(`(() => { G.hour = 21.5; G.state.energy = 35; const s = G.hayot.spot('bed'); G.player.place(s.x, s.z, s.yaw); G.sim(0.3); press('KeyE'); G.sim(1.2); const lying = G.player.anim; G.sim(5); return { lying, hour: +G.hour.toFixed(2), energy: Math.round(G.state.energy), anim: G.player.anim }; })()`);
  T_('sleep', r.lying === 'lie' && Math.abs(r.hour - 6.5) < 0.01 && r.energy === 100, r);
  // 3. divanga o'tirish va [E] bilan turish
  r = await ev(`(() => { const s = G.interior.H.spots.find((q) => q.k === 'sit' && q.sofa); G.player.place(s.x + 0.3, s.z - 0.3, 0); G.sim(0.3); G.hayot.spotAct(s); G.sim(1); const sit = G.player.sit && G.player.anim === 'sit', pr = G.live.prompt; press('KeyE'); G.sim(0.5); return { sit, pr, after: G.player.sit }; })()`);
  T_('sit-stand', r.sit && r.after === false, r);
  // 4. pishirish (oshxona oynasi) va stolda ovqatlanish
  r = await ev(`(() => { G.state.inv.fish = 1; G.state.inv.friedfish = 0; G.state.sat = 50; const s = G.hayot.spot('stove'); G.player.place(s.x, s.z, s.yaw); G.sim(0.3); press('KeyE'); const scr = G.ui.screenName; const b = document.querySelector('[data-a="cook:friedfish"]'); if (b) b.click(); G.sim(1.5); const cooking = G.player.anim; G.sim(5); return { scr, cooking, dish: G.state.inv.friedfish, fish: G.state.inv.fish }; })()`);
  T_('cook', r.scr === 'oshxona' && r.cooking === 'cook' && r.dish === 1 && r.fish === 0, r);
  r = await ev(`(() => { const s = G.interior.H.spots.find((q) => q.k === 'sit' && q.table); G.player.place(s.x, s.z, s.yaw); G.sim(0.3); G.hayot.spotAct(s); G.sim(0.3); press('KeyE'); G.sim(1); const anim = G.player.anim; G.sim(4); return { anim, dish: G.state.inv.friedfish, sat: Math.round(G.state.sat) }; })()`);
  T_('eat-table', r.anim === 'eat' && r.dish === 0 && r.sat > 90, r);
  // 5. suv ichish (jo'mrak)
  r = await ev(`(() => { G.player.sit = false; G.state.thirst = 35; const s = G.hayot.spot('tap'); G.player.place(s.x, s.z, s.yaw); G.sim(0.3); press('KeyE'); G.sim(0.8); const anim = G.player.anim; G.sim(2.5); return { anim, thirst: Math.round(G.state.thirst) }; })()`);
  T_('drink', r.anim === 'drink' && r.thirst > 75, r);
  // 6. chiqish va do'kon: xarid
  r = await ev(`(() => { const s = G.hayot.spot('door'); G.player.place(s.x, s.z, s.yaw); G.sim(0.3); press('KeyE'); G.sim(0.3); const out = G.interior.inside; const sh = G.hayot.shops[0]; G.player.place(sh.x, sh.z, sh.yaw + Math.PI); G.sim(0.3); press('KeyE'); G.sim(0.3); const inShop = G.interior.inside; const c = G.hayot.spot('counter'); G.player.place(c.x, c.z, 0); G.sim(0.3); press('KeyE'); const scr = G.ui.screenName; const m0 = G.state.money, w0 = G.state.inv.water || 0; const b = document.querySelector('[data-a="buy:water"]'); if (b) b.click(); return { out, inShop, scr, money: [m0, G.state.money], water: [w0, G.state.inv.water] }; })()`);
  T_('shop', r.out === null && r.inShop === 'shop' && r.scr === 'dokon' && r.money[1] < r.money[0] && r.water[1] === r.water[0] + 1, r);
  await ev('G.ui.close(); G.advance(0.2)'); await shot('life_shop');
  // 7. yoqilg'i quyish
  r = await ev(`(() => { G.interior.exit(); G.live.mount(true); G.setVehicle('jip'); const s = G.fuel.stations[0], p = s.pumps[0], dx = p.x - s.x, dz = p.z - s.z, d = Math.hypot(dx, dz); G.car.place(p.x + dx / d * 2.2, p.z + dz / d * 2.2, s.yaw); G.prevP = G.car.p.slice(); G.cam.snap(); G.fuel.set(20); G.state.money = 1000; G.sim(1.5); const pr = G.live.prompt; press('KeyE'); G.sim(8); return { pr, fuel: Math.round(G.fuel.get()), money: G.state.money }; })()`);
  T_('refuel', r.fuel >= 99 && r.money < 1000 && r.money > 800, r);
  // 8. bo'sh bak: mashina faqat sudraladi
  r = await ev(`(() => { const run = (f) => { G.drive(['vil', 'mj'], 30); G.auto = null; G.fuel.set(f); G.car.place(G.car.p[0], G.car.p[2], G.car.yaw); G.prevP = G.car.p.slice(); G.input.keys.add('KeyW'); G.sim(10); G.input.keys.delete('KeyW'); return Math.round(G.car.speed * 3.6); }; const full = run(100), empty = run(0); return { full, empty }; })()`);
  T_('empty-tank', r.empty < 15 && r.full > 25 && r.full > r.empty * 2, r);
  // 9. NPC suhbati
  r = await ev(`(() => { G.live.dismount(true); const o = G.live._dbg.npcs[0]; o.role = 'talk'; o.cool = 999; G.player.place(o.x + 1.2, o.z, -Math.PI / 2); G.sim(0.4); press('KeyE'); const open = !!G.hayot.dlg, line = G.hayot.dlg && G.hayot.dlg.lines[0]; G.sim(0.5); return { open, line, n: G.hayot.dlg ? G.hayot.dlg.lines.length : 0 }; })()`);
  T_('npc-dialog', r.open && !!r.line, r);
  await ev('G.cam.snap(); G.advance(0.4)'); await shot('life_dialog');
  r = await ev(`(() => { for (let i = 0; i < 5 && G.hayot.dlg; i++) press('KeyE'); return { closed: !G.hayot.dlg }; })()`);
  T_('npc-dialog-close', r.closed, r);
};
