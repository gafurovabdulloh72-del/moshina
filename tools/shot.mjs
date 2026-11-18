// Ekransiz (headless) Chrome'da o'yinni ochib, ssenariy bajaradi va skrinshot oladi.
// Ishlatish: node tools/shot.mjs <ssenariy.js> [--w 1280 --h 720] [--file boshqa.html] [--logs]
// Muhit o'zgaruvchilari:
//   NO_TEST=1      — o'yin oddiy rejimda ochiladi (menyu, haqiqiy kadr sikli); busiz sinov rejimi (window.__TEST)
//   CHROME_PATH    — Chrome bajariluvchi fayli (ko'rsatilmasa tizimdagi Google Chrome qidiriladi)
//   SAFAR_GPU=1    — haqiqiy videokarta bilan (busiz dasturiy SwiftShader: sekin, lekin hamma joyda bir xil natija)
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
let chromium;
try { ({ chromium } = await import('playwright-core')); }
catch { ({ chromium } = createRequire('/opt/npm-tools/node_modules/')('playwright')); } // bulut muhitidagi umumiy o'rnatma

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const scenarioPath = args[0];
const getArg = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : d; };
const W = +getArg('w', 1280), H = +getArg('h', 720);
const file = path.resolve(getArg('file', path.join(root, 'dist/SAFAR.html')));
fs.mkdirSync(path.join(root, 'shots'), { recursive: true });

const exe = [process.env.CHROME_PATH, '/usr/bin/google-chrome', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  'C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => p && fs.existsSync(p));
const soft = process.env.SAFAR_GPU ? [] : ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
const browser = await chromium.launch({
  ...(exe ? { executablePath: exe } : { channel: 'chrome' }),
  headless: true,
  args: [...soft, '--ignore-gpu-blocklist', '--enable-webgl', '--no-sandbox', '--autoplay-policy=no-user-gesture-required', '--disable-dev-shm-usage'],
});
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
if (!process.env.NO_TEST) await ctx.addInitScript(() => { window.__TEST = true; });
const page = await ctx.newPage();
const logs = [];
let failed = false; // sahifa xatosi, ssenariy xatosi yoki "TEST ... FAIL" satri bo'lsa — chiqish kodi 1
const print = console.log;
console.log = (...a) => { if (/^TEST\b.*\bFAIL\b/.test(a.join(' '))) failed = true; print(...a); };
page.on('console', (m) => { const t = m.text(); logs.push(`[${m.type()}] ${t}`); if (m.type() === 'error' || m.type() === 'warning') console.log(`[${m.type()}] ${t}`); else if (t.startsWith('TEST')) console.log(t); });
page.on('pageerror', (e) => { failed = true; console.log('[pageerror]', e.message, '\n', (e.stack || '').split('\n').slice(0, 6).join('\n')); });

await page.goto(pathToFileURL(file).href);
const shot = async (name, opts = {}) => {
  const p = path.join(root, 'shots', name.endsWith('.jpg') || name.endsWith('.png') ? name : name + '.jpg');
  await page.screenshot({ path: p, type: p.endsWith('.png') ? 'png' : 'jpeg', quality: p.endsWith('.png') ? undefined : 82, timeout: 120000, ...opts });
  console.log('shot', p);
};
const scenario = (await import(pathToFileURL(path.resolve(scenarioPath)).href)).default;
try {
  await scenario({ page, shot, logs, W, H });
} catch (e) {
  failed = true;
  console.log('SCENARIO ERROR', e.message);
  try { await shot('error'); } catch {}
}
if (args.includes('--logs')) fs.writeFileSync(path.join(root, 'shots/console.log'), logs.join('\n'));
await browser.close();
process.exitCode = failed ? 1 : 0;
