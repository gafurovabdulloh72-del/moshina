// Sensorli ekran tekshiruvi: telefon emulyatsiyasida (iPhone 13, Pixel 7 — tik va yotiq) HUD va oynalarni suratga oladi va o'lchaydi:
// 44 px dan kichik tugmalar, bir-birini to'sgan tugmalar/panellar, ekrandan chiqib ketganlar, kesilgan yozuvlar.
// Ishlatish: node tools/touch.mjs [chiqish_papkasi] [--dev "iPhone 13,Pixel 7"] [--only hud_car,phone]   (avval npm run build)
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
let pw;
try { pw = await import('playwright-core'); } catch { pw = createRequire('/opt/npm-tools/node_modules/')('playwright'); }
const { chromium, devices } = pw;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2), arg = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : d; };
const out = path.resolve(args[0] && !args[0].startsWith('--') ? args[0] : path.join(root, 'shots/touch')); fs.mkdirSync(out, { recursive: true });
const DEV = arg('dev', 'iPhone 13,iPhone 13 landscape,Pixel 7,Pixel 7 landscape').split(',').map((s) => s.trim());
const ONLY = arg('only', '') ? arg('only').split(',') : null;
const exe = [process.env.CHROME_PATH, '/usr/bin/google-chrome'].find((p) => p && fs.existsSync(p));
const browser = await chromium.launch({ ...(exe ? { executablePath: exe } : { channel: 'chrome' }), headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox', '--disable-dev-shm-usage'] });
// sahnalar: [nom, o'yinda bajariladigan kod]
const SCENES = [
  ['hud_car', 'G.ui.close(); if (G.player.onFoot) G.live.mount(false); G.ui.toast("Sinov xabari: +120 so\'m", "good")'],
  ['hud_foot', 'G.ui.close(); G.live.dismount(true)'],
  ['hud_race', 'G.ui.close(); G.live.mount(false); G.startAct(G.acts.acts.find(a=>a.id==="r1")); G.sim(4); G.ui.close()'],
  ['phone', 'G.endAct(false,"cancel"); G.ui.close(); G.phone.open()'],
  ['phone_bank', 'G.ui.close(); G.phone.open(); document.querySelector(\'[data-a="app:bank"]\').click()'],
  ['online', 'G.ui.open("online")'],
  ['choyxona', 'G.ui.open("choyxona")'],
  ['kiyim', 'G.ui.open("kiyim", { mode: "own" })'],
  ['ishlar', 'G.ui.open("ishlar", { focus: "non" })'],
  ['hafta', 'G.ui.open("hafta")'],
  ['pause', 'G.ui.open("pause")'],
];
// o'lchash: tugmalar o'lchami, to'sish, ekrandan chiqish, kesilgan yozuv
const audit = () => {
  const vw = innerWidth, vh = innerHeight, vis = (e) => { const r = e.getBoundingClientRect(); if (r.width < 2 || r.height < 2) return null; for (let p = e; p; p = p.parentElement) { const s = getComputedStyle(p); if (s.display === 'none' || s.visibility === 'hidden' || +s.opacity === 0) return null; } return r; };
  const name = (e) => (e.id ? '#' + e.id : '') + (e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\s+/).slice(0, 2).join('.') : '') + (e.dataset && e.dataset.a ? `[${e.dataset.a}]` : '') + ' «' + (e.textContent || e.title || '').trim().replace(/\s+/g, ' ').slice(0, 18) + '»';
  const scr = document.querySelector('#screen.on');
  const tapSel = 'button,select,input,[data-a],[data-code],.tb,.joy,.ph-app,.card[style*="pointer"]';
  const taps = [...document.querySelectorAll(tapSel)].filter((e) => (scr ? scr.contains(e) : !e.closest('#screen')) && !e.closest('[data-code]')?.parentElement?.closest('[data-code]')).map((e) => [e, vis(e)]).filter((q) => q[1] && !q[0].parentElement.closest(tapSel));
  const hudSel = '#hud .tl .chip,#hud .clock,#hud .panel:not(.bc),#mini,#hud .loc,#toasts .toast';
  const blocks = scr ? [] : [...document.querySelectorAll(hudSel)].map((e) => [e, vis(e)]).filter((q) => q[1]);
  const small = taps.filter(([, r]) => Math.min(r.width, r.height) < 44).map(([e, r]) => `${name(e)} ${Math.round(r.width)}×${Math.round(r.height)}`);
  const all = taps.concat(blocks), over = [];
  for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) {
    const [a, r] = all[i], [b, s] = all[j]; if (a.contains(b) || b.contains(a)) continue;
    const ox = Math.min(r.right, s.right) - Math.max(r.left, s.left), oy = Math.min(r.bottom, s.bottom) - Math.max(r.top, s.top);
    if (ox > 3 && oy > 3) over.push(`${name(a)} ⨯ ${name(b)} (${Math.round(ox)}×${Math.round(oy)})`);
  }
  const off = all.filter(([, r]) => r.left < -1 || r.top < -1 || r.right > vw + 1 || r.bottom > vh + 1).map(([e, r]) => `${name(e)} [${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.right)},${Math.round(r.bottom)}]`);
  const clip = [...document.querySelectorAll(scr ? '#screen.on *' : '#hud *')].filter((e) => { if (!e.childNodes.length || ![...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) return false; const s = getComputedStyle(e); if (s.overflowX === 'visible' && s.textOverflow !== 'ellipsis') return false; return vis(e) && e.scrollWidth > e.clientWidth + 2; }).map((e) => `${name(e)} ${e.scrollWidth}>${e.clientWidth}`);
  const win = scr && scr.querySelector('.win'), wr = win && win.getBoundingClientRect();
  return { vw, vh, taps: taps.length, small, over, off, clip, win: wr ? [Math.round(wr.left), Math.round(wr.top), Math.round(wr.width), Math.round(wr.height), win.scrollHeight > win.clientHeight + 2 ? 'scroll' : ''] : null };
};
const report = {};
for (const dn of DEV) {
  const d = devices[dn]; if (!d) { console.log('qurilma topilmadi:', dn); continue; }
  const ctx = await browser.newContext({ ...d, deviceScaleFactor: 1 });
  await ctx.addInitScript(() => { window.__TEST = true; });
  const page = await ctx.newPage(); page.setDefaultTimeout(180000);
  page.on('pageerror', (e) => console.log(`[${dn} pageerror]`, e.message));
  await page.goto(pathToFileURL(path.join(root, 'dist/SAFAR.html')).href);
  await page.waitForFunction('window.__ready === true', null, { timeout: 180000 });
  await page.evaluate(() => { G.save = () => {}; G.state.money = 5000; G.ui.touchOn(); G.sim(0.2); });
  const tag = dn.replace(/\s+/g, '_');
  for (const [sn, js] of SCENES) {
    if (ONLY && !ONLY.includes(sn)) continue;
    try { await page.evaluate(js); await page.evaluate(() => { G.advance(0.25); }); } catch (e) { console.log(dn, sn, 'XATO', e.message); continue; }
    const r = await page.evaluate(audit); report[tag + '/' + sn] = r;
    const f = path.join(out, `${tag}_${sn}.jpg`); await page.screenshot({ path: f, type: 'jpeg', quality: 80, timeout: 180000 });
    console.log(`${dn} · ${sn}: ${r.taps} tugma, kichik ${r.small.length}, to'sish ${r.over.length}, chetda ${r.off.length}, kesilgan ${r.clip.length}${r.win ? ' · oyna ' + r.win.join(' ') : ''}`);
  }
  await ctx.close();
}
fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 1));
console.log('hisobot', path.join(out, 'report.json'));
await browser.close();
