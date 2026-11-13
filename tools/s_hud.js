// Tezlik/holat paneli haydash paytida har qanday oyna o'lchamida ko'rinishini tekshiradi (NO_TEST=1 bilan)
export default async ({ page, shot }) => {
  await page.waitForFunction('window.__ready === true', null, { timeout: 90000 });
  const k = page.keyboard, wait = (ms) => page.waitForTimeout(ms), ev = (js) => page.evaluate(js);
  const probe = () => ev(`(() => {
    const vis = (id) => {
      const e = document.getElementById(id); if (!e) return { id, missing: true };
      let shown = true, op = 1;
      for (let n = e; n && n.nodeType === 1; n = n.parentElement) { const cs = getComputedStyle(n); if (cs.display === 'none' || cs.visibility === 'hidden') shown = false; op *= parseFloat(cs.opacity); }
      const r = e.getBoundingClientRect();
      const inside = r.width > 20 && r.height > 20 && r.left >= 0 && r.top >= 0 && r.right <= innerWidth + 0.5 && r.bottom <= innerHeight + 0.5;
      return { id, shown, op: +op.toFixed(2), inside, rect: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)] };
    };
    const ov = (a, b) => { const A = document.getElementById(a).getBoundingClientRect(), B = document.getElementById(b).getBoundingClientRect(); return !(A.right <= B.left || B.right <= A.left || A.bottom <= B.top || B.bottom <= A.top); };
    return { vw: innerWidth, vh: innerHeight, foot: G.player.onFoot, hud: G.hudOn, kmh: Math.round(G.car.speed * 3.6), spd: vis('h-spd'), dmg: vis('h-dmgp'), mini: vis('mini'), overlapMini: ov('h-dmgp', 'mini') };
  })()`);
  const line = (tag, o) => {
    const ok = !o.foot && o.hud && o.spd.shown && o.spd.inside && o.spd.op > 0.9 && o.dmg.shown && o.dmg.inside && o.dmg.op > 0.9 && !o.overlapMini;
    console.log('TEST', tag, ok ? 'OK ' : 'FAIL', `${o.vw}x${o.vh} kmh=${o.kmh} spd=${JSON.stringify(o.spd.rect)} dmg=${JSON.stringify(o.dmg.rect)} mini=${JSON.stringify(o.mini.rect)}` + (ok ? '' : ' ' + JSON.stringify(o)));
    return ok;
  };
  await wait(1200);
  await page.click('[data-a=play]'); await wait(900);
  await k.down('KeyW'); await wait(2500);
  line('start', await probe());
  const sizes = [[1920, 1080], [1440, 900], [1280, 620], [1024, 560], [900, 480], [760, 420], [700, 900], [844, 390], [390, 844]];
  for (const [w, h] of sizes) {
    await page.setViewportSize({ width: w, height: h }); await wait(700);
    line('size', await probe());
    if ((w === 900 && h === 480) || (w === 700 && h === 900) || (w === 844 && h === 390)) await shot(`hud_${w}x${h}`);
  }
  await page.setViewportSize({ width: 1280, height: 720 }); await wait(500);
  // dialoglar ochilib-yopilgandan keyin ham panel joyida turadimi
  for (const key of ['Tab', 'KeyM', 'KeyI', 'Escape']) { await k.press(key); await wait(450); const scr = await ev('G.ui.screenName'); await k.press('Escape'); await wait(450); const o = await probe(); line('after ' + key + ' (' + scr + ')', o); }
  // P: surat rejimi — yozuv ko'rinadi, panel o'zi qaytadi
  await k.press('KeyP'); await wait(400);
  const ph = await ev(`({ hud: G.hudOn, badge: getComputedStyle(document.getElementById('photo')).display, text: document.getElementById('photo').textContent })`);
  console.log('TEST photo', JSON.stringify(ph)); await shot('hud_photo');
  await wait(20600);
  line('auto-restore', await probe());
  await k.press('KeyP'); await wait(300); await k.press('KeyP'); await wait(300);
  line('P twice', await probe());
  await k.up('KeyW');
  await shot('hud_drive');
};
