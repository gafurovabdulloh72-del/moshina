// Haqiqiy foydalanuvchi oqimi: menyu -> o'yin -> haydash -> tushish -> piyoda harakatlar -> oynalar (NO_TEST=1 bilan)
export default async ({ page, shot }) => {
  await page.waitForFunction('window.__ready === true', null, { timeout: 90000 });
  const k = page.keyboard, wait = (ms) => page.waitForTimeout(ms), ev = (js) => page.evaluate(js);
  const info = async (tag) => console.log('TEST', tag, JSON.stringify(await ev(`({mode:G.mode,screen:G.ui.screenName,foot:G.player.onFoot,p:(G.player.onFoot?G.player.p:G.car.p).map(v=>+v.toFixed(1)),kmh:Math.round(G.car.speed*3.6),money:G.state.money,hud:G.hudOn,inv:[G.state.inv.hay,G.state.inv.seed,G.state.flowers.length],pr:G.live.prompt.replace(/<[^>]+>/g,'')})`)));
  await wait(1500); await shot('r_menu'); await info('menu');
  await page.click('[data-a=play]'); await wait(800); await info('play');
  await k.down('KeyW'); await wait(4000); await k.down('KeyA'); await wait(700); await k.up('KeyA'); await wait(800); await k.up('KeyW'); await info('drove'); await shot('r_drive');
  await k.press('KeyP'); await wait(300); await info('photo'); await shot('r_photo'); await k.press('KeyP'); await wait(200);
  await k.down('KeyS'); await wait(2500); await k.up('KeyS'); await wait(600); await info('stopped');
  await k.press('KeyF'); await wait(700); await info('exit');
  await k.down('KeyW'); await k.down('ShiftLeft'); await wait(1800); await k.up('ShiftLeft'); await k.up('KeyW'); await wait(300); await shot('r_foot'); await info('walked');
  await k.press('KeyQ'); await wait(1600); await info('pulled'); await k.press('KeyG'); await wait(1600); await info('planted');
  await k.press('Space'); await wait(900);
  await k.press('KeyB'); await wait(400); await info('wheel'); await shot('r_wheel'); await k.press('Escape'); await wait(300);
  await k.press('KeyI'); await wait(400); await info('bag'); await k.press('Escape'); await wait(300);
  await k.press('Tab'); await wait(400); await info('passport'); await page.click('.winwrap > .x'); await wait(300); await info('passport closed');
  await k.press('KeyM'); await wait(400); await info('map'); await k.press('Escape'); await wait(300);
  await k.press('Digit1'); await wait(1200); await info('dance'); await shot('r_dance');
  await k.press('KeyV'); await wait(2200); await k.press('KeyF'); await wait(600); await info('mounted');
  await k.press('Escape'); await wait(400); await info('pause'); await shot('r_pause'); await k.press('Escape'); await wait(300); await info('end');
};
