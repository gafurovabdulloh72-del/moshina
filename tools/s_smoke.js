// Eng oddiy tekshiruv: o'yin yuklanadi, bir necha soniya ishlaydi, xatosiz skrinshot olinadi
export default async ({ page, shot }) => {
  await page.waitForFunction('window.__ready === true', null, { timeout: 90000 });
  const r = await page.evaluate(() => { const p = G.sim(3); return { mode: G.mode, veh: G.carModel.id, pos: p.slice(0, 3), acts: G.acts.acts.length, stars: G.maxStars }; });
  console.log('TEST smoke', r.acts === 90 && r.stars === 270 ? 'OK' : 'FAIL', JSON.stringify(r));
  await page.evaluate(() => G.advance(0.2));
  await shot('smoke');
};
