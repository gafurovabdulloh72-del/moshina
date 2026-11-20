// Mebel va do'konlar sinovi: o'tirish yo'nalishi, turish joyi, dush, shkaf kamerasi, kirish nuqtasi, manzil nomi, choyxona (qaytim, taom ko'chishi), shoxobcha do'konchasi, mizg'ib olish
export default async ({ page, shot }) => {
  await page.waitForFunction('window.__ready === true', null, { timeout: 120000 });
  const ev = (js) => page.evaluate(js), T_ = (n, ok, info) => console.log('TEST mebel', n, ok ? 'OK' : 'FAIL', JSON.stringify(info));
  await ev(`window.press = (c) => { G.input.pressed.add(c); G.advance(1 / 60); }; window.click = (a) => { const b = document.querySelector('[data-a="' + a + '"]'); if (b) b.click(); return !!b; };
    window.home = (lvl) => { G.player.sit = false; G.interior.exit(); G.state.home.lvl = lvl; G.live.applyHome(); G.interior.rebuildHome(true); const h = G.site.places.uy.home; G.player.place(h.door[0], h.door[1], 0); G.sim(0.3); G.hayot.enterHome(); G.sim(0.3); };
    window.bld = (k) => { G.player.sit = false; G.interior.exit(); const c = G.hayot2.bld.find((q) => q.kind === k); G.player.place(c.x, c.z, 0); G.sim(0.3); G.hayot2.enter(c); G.sim(0.4); }; G.live.dismount(true); 1`);
  // 1. chodir: kursida qutiga (stolga) qarab o'tiradi, taom quti ustida
  let r = await ev(`(() => { home(0); G.state.inv.bread = 2; const s = G.interior.H.spots.find((q) => q.k === 'sit'), o = G.interior.H.o; G.player.place(s.x + 0.3, s.z - 0.3, 0); G.sim(0.2); G.hayot.spotAct(s); G.sim(0.3); G.hayot.spotAct(s); G.sim(1);
    const f = [Math.sin(G.player.yaw), Math.cos(G.player.yaw)], tx = o[0] + s.table[0] - G.player.p[0], tz = o[2] + s.table[1] - G.player.p[2], dot = (f[0] * tx + f[1] * tz) / Math.hypot(tx, tz);
    const plate = G.scene.children.find((m) => m.isMesh && m.visible && Math.abs(m.position.x - (o[0] + s.table[0])) < 0.5 && Math.abs(m.position.z - (o[2] + s.table[1])) < 0.5 && m.position.y > o[1] + 0.3 && m.position.y < o[1] + 1);
    return { dot: +dot.toFixed(2), anim: G.player.anim, plateY: plate ? +(plate.position.y - o[1]).toFixed(2) : null }; })()`);
  T_('tent-stool', r.dot > 0.8 && r.anim === 'eat' && r.plateY != null && r.plateY < 0.6, r);
  await ev('G.sim(5); 1');
  // 2. kirish nuqtasi: kirgan zahoti [E] tashqariga chiqarmaydi
  r = await ev(`(() => { const out = []; home(2); out.push(G.live.prompt); for (const k of ['cafe', 'kiyim', 'sart']) { bld(k); out.push(G.live.prompt); } G.interior.exit(); const sh = G.hayot.shops[0]; G.player.place(sh.x, sh.z, 0); G.sim(0.2); G.hayot.enterShop(sh); G.sim(0.4); out.push(G.live.prompt); return out; })()`);
  T_('entry-no-exit', r.every((p) => !/Tashqariga/.test(p || '')), r);
  // 3. oshxona stulidan turish — stol ichiga emas, yonga
  r = await ev(`(() => { home(2); for (const k of ['kabob', 'dimlama', 'friedfish', 'soup', 'omlet', 'salad', 'bread', 'sweets', 'snack', 'fruit', 'veg', 'berry']) G.state.inv[k] = 0; const I = G.interior.H, o = I.o, s = I.spots.find((q) => q.k === 'sit' && q.table); G.player.place(s.x, s.z, 0); G.sim(0.2); G.hayot.spotAct(s); G.sim(0.5); const pr0 = G.live.prompt; press('KeyE'); G.sim(0.6);
    const tx = o[0] + s.table[0], tz = o[2] + s.table[1], p = G.player.p, side = Math.sign((p[2] - tz) * (s.z - tz) || 1); return { pr0, sit: G.player.sit, dTable: +Math.hypot(p[0] - tx, p[2] - tz).toFixed(2), dSeat: +Math.hypot(p[0] - s.x, p[2] - s.z).toFixed(2), side }; })()`);
  T_('stand-from-table', !r.sit && r.dTable > 0.75 && r.dSeat < 1.0 && r.side > 0, r);
  // 4. dush: kabina ichida, to'qlikni bepul oshirmaydi
  r = await ev(`(() => { G.sim(5); const s = G.hayot.spot('shower'); G.player.place(s.x + 0.6, s.z + 0.7, 0); G.state.sat = 40; G.state.tetik = 50; G.sim(0.2); G.hayot.spotAct(s); G.sim(0.5); const d = +Math.hypot(G.player.p[0] - s.x, G.player.p[2] - s.z).toFixed(2); G.sim(5); return { d, sat: Math.round(G.state.sat), tetik: Math.round(G.state.tetik) }; })()`);
  T_('shower', r.d < 0.3 && r.sat <= 40 && r.tetik >= 60, r);
  // 5. shkaf: kiyim oynasi kamerasi qahramon turgan xonada, shkaf ichida emas (yotoqxona va mehmon xonasi)
  r = await ev(`(() => { G.state.home2.guest = 1; home(2); const I = G.interior.H, res = []; for (const s of I.spots.filter((q) => q.k === 'wardrobe')) { G.player.place(s.x, s.z, 0); G.sim(0.2); G.hayot2.spotAct(s); G.advance(0.02); const c = G.camera.position, pr = G.interior.roomAt(G.player.p[0], G.player.p[2]), cr = G.interior.roomAt(c.x, c.z), dw = Math.hypot(c.x - s.x, c.z - s.z), fx = Math.sin(G.player.yaw), fz = Math.cos(G.player.yaw); res.push({ pr, cr, dw: +dw.toFixed(2), ahead: +(((c.x - G.player.p[0]) * fx + (c.z - G.player.p[2]) * fz)).toFixed(2) }); G.ui.close(); G.sim(0.1); } return res; })()`);
  T_('wardrobe-cam', r.length >= 2 && r.every((q) => q.pr === q.cr && q.ahead > 1.0), r);
  // 6. manzil nomi: binodan chiqqach qotib qolmaydi, manzil banneri qayta chiqmaydi
  r = await ev(`(() => { bld('kiyim'); G.sim(0.3); const inName = G.curPlace && G.curPlace.name; G.interior.exit(); G.sim(0.3); const b1 = document.querySelector('#banner') && document.querySelector('#banner').textContent; const back = G.curPlace && G.curPlace.name; const s = G.kocha.stop.seat; G.player.place(s.x + 1, s.z, 0); G.sim(0.5); return { inName, back, stop: G.curPlace && G.curPlace.name }; })()`);
  T_('place-name', r.inName === "Kiyim do'koni" && r.back !== "Kiyim do'koni" && !r.stop, r);
  // 7. choyxona: buyurtma kelmasdan chiqilsa — pul qaytadi; turib ketilsa taom stolda qoladi, boshqa joyga o'tilsa ko'chadi
  r = await ev(`(() => { bld('cafe'); G.state.money = 500; const S = G.interior.X.cafe.seats, s = S[0]; G.player.place(s.x + 1.2, s.z, 0); G.sim(0.2); G.hayot2.spotAct(s); G.sim(0.3); G.hayot2.order('osh'); const m1 = G.state.money; G.player.sit = false; G.interior.exit(); const m2 = G.state.money; return { m1, m2 }; })()`);
  T_('cafe-refund', r.m1 === 455 && r.m2 === 500, r);
  r = await ev(`(() => { bld('cafe'); const S = G.interior.X.cafe.seats, s = S[0], s2 = S[S.length - 1]; G.player.place(s.x + 1.2, s.z, 0); G.sim(0.2); G.hayot2.spotAct(s); G.sim(0.3); G.hayot2.order('choy'); G.runUntil(() => G.hayot2.dishes.length > 0, 30); G.player.sit = false; G.sim(0.5); const after = G.hayot2.dishes.length; G.player.place(s2.x + 0.8, s2.z, 0); G.sim(0.2); G.hayot2.spotAct(s2); G.sim(0.3); const moved = G.hayot2.dishes.length && G.hayot2.dishes[0].sp === s2; return { after, moved: !!moved, pr: G.live.prompt }; })()`);
  T_('cafe-dishes-stay', r.after === 1 && r.moved && /Ichish/.test(r.pr || ''), r);
  await ev('G.sim(3); 1');
  // 8. sartaroshxona: ikkinchi kreslo va kutish divaniga o'tirish
  r = await ev(`(() => { bld('sart'); const sp = G.interior.X.sart.spots.filter((q) => q.k === 'sit'), res = []; for (const s of sp) { G.player.place(s.x + 0.5, s.z + 0.1, 0); G.sim(0.2); G.hayot.spotAct(s); G.sim(0.6); res.push(G.player.sit && G.player.anim === 'sit'); press('KeyE'); G.sim(0.3); } return { n: sp.length, res }; })()`);
  T_('sart-seats', r.n === 2 && r.res.every(Boolean), r);
  // 9. shoxobcha do'konchasi
  r = await ev(`(() => { G.player.sit = false; G.interior.exit(); const s = G.fuel.stations[0]; G.player.place(s.kiosk[0], s.kiosk[1], 0); G.sim(0.4); const pr = G.live.prompt; press('KeyE'); const scr = G.ui.screenName, h = document.querySelector('.panel h1, h1'); const t = (document.querySelector('#scr h1') || {}).textContent || [...document.querySelectorAll('h1')].map((e) => e.textContent).join('|'); const m0 = G.state.money; click('buy:water'); const m1 = G.state.money; G.ui.close(); void h; return { pr, scr, t, paid: m0 - m1 }; })()`);
  T_('kiosk', /do'konchasi/.test(r.pr || '') && r.scr === 'dokon' && /shoxobchasi do'konchasi/.test(r.t) && r.paid === 10, r);
  // 10. kunduzi (charchamagan) — 2 soat mizg'ib olish; charchaganda — tonggacha
  r = await ev(`(() => { home(2); const s = G.hayot.spot('bed'); G.hour = 12; G.state.tetik = 80; G.player.place(s.x, s.z, s.yaw); G.sim(0.3); const pr = G.live.prompt; press('KeyE'); G.sim(6); const h1 = +G.hour.toFixed(2); G.hour = 13; G.state.tetik = 20; G.player.place(s.x, s.z, s.yaw); G.sim(0.3); press('KeyE'); G.sim(6); return { pr, h1, h2: +G.hour.toFixed(2) }; })()`);
  T_('nap', /Mizg'ib/.test(r.pr || '') && Math.abs(r.h1 - 14) < 0.01 && Math.abs(r.h2 - 6.5) < 0.01, r);
};
