// Qadamlar ro'yxati: STEPS='[["nom","JS ifoda"],...]' — nom bo'sh bo'lmasa skrinshot olinadi
import fs from 'node:fs';
export default async ({ page, shot }) => {
  await page.waitForFunction('window.__ready === true', null, { timeout: 90000 });
  const steps = process.env.STEPS_FILE ? JSON.parse(fs.readFileSync(process.env.STEPS_FILE, 'utf8')) : JSON.parse(process.env.STEPS || '[]');
  for (const [name, js] of steps) {
    const r = await page.evaluate(js);
    if (r !== undefined && r !== null) console.log(name || '-', JSON.stringify(r));
    if (name) await shot(name);
  }
};
