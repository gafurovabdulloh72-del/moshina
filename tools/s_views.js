// Bir nechta ko'rinishdan skrinshot: node tools/shot.mjs tools/s_views.js
export default async ({ page, shot }) => {
  await page.waitForFunction('window.__ready === true', null, { timeout: 60000 });
  const views = JSON.parse(process.env.VIEWS || '[]');
  for (const v of views) {
    const info = await page.evaluate((v) => window.G.view(...v.slice(1)), v);
    console.log(v[0], info);
    await shot(v[0]);
  }
};
