// Bosh menyu rasmi (ulashish uchun og.jpg) — NO_TEST=1 bilan
export default async ({ page, shot }) => {
  await page.waitForFunction('window.__ready === true', null, { timeout: 90000 });
  await page.evaluate('G.hour = 17.9; G.freezeTime = true; 1'); await page.waitForTimeout(6000);
  await shot('og');
};
