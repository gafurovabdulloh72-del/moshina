// Onlayn rejimning brauzer sinovi: mahalliy "Vercel" (tools/dev-server.mjs: api/ + soxta Redis + mahalliy PeerJS brokeri) va ekransiz Chrome'da bir nechta o'yinchi.
// Tekshiradi: Telegram orqali kirish (sinov tokeni bilan imzolangan ma'lumot), bulutli saqlov (yuklash, boshqa qurilmada olish, tanlov oynasi), reyting,
// xona ochish va kod bilan qo'shilish, mehmon xona egasining uyida yashashi (hissa, bezak, poliz, o'z uyi tiklanishi), bir-birini ko'rish (skrinshot), chat, birga poyga va natija, xona egasi chiqib ketganda egalik o'tishi, yuklab olingan faylda "mavjud emas".
// Ishlatish: npm run build && npm run test:online      (skrinshotlar: shots/online_*.jpg)
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { startDev, TEST_BOT_TOKEN } from './dev-server.mjs';
import { startFakeRedis } from './fake-redis.mjs';
let chromium;
try { ({ chromium } = await import('playwright-core')); } catch { ({ chromium } = createRequire('/opt/npm-tools/node_modules/')('playwright')); }

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
fs.mkdirSync(path.join(root, 'shots'), { recursive: true });
let failed = 0; const ok = (cond, name, extra = '') => { console.log(`TEST online ${name} ${cond ? 'OK' : 'FAIL'} ${extra}`); if (!cond) failed++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const tg = (id, first_name) => { const d = { id, first_name, username: first_name.toLowerCase(), auth_date: Math.floor(Date.now() / 1000) }; const dcs = Object.keys(d).sort().map((k) => `${k}=${d[k]}`).join('\n'); return Object.assign(d, { hash: crypto.createHmac('sha256', crypto.createHash('sha256').update(TEST_BOT_TOKEN).digest()).update(dcs).digest('hex') }); };

const redis = await startFakeRedis(); Object.assign(process.env, { KV_REST_API_URL: redis.url, KV_REST_API_TOKEN: redis.token });
const dev = await startDev({ port: 0, peerPort: 0, quiet: true });
const exe = [process.env.CHROME_PATH, '/usr/bin/google-chrome', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', 'C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => p && fs.existsSync(p));
const launch = () => chromium.launch({ ...(exe ? { executablePath: exe } : { channel: 'chrome' }), headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox', '--disable-dev-shm-usage', '--disable-features=WebRtcHideLocalIpsWithMdns', '--autoplay-policy=no-user-gesture-required'] });
const browser = await launch(), browsers = [browser];
const pages = [];
// har o'yinchi — alohida brauzer jarayoni: dasturiy videokarta (SwiftShader) bitta GPU jarayonida yangi ochilgan sahifaning sheyderlarini kompilyatsiya qilayotganda
// boshqa sahifalar o'nlab soniya qotib qolardi (45 soniyalik jimlik nazorati ulanishni uzardi) — haqiqiy kompyuterlarda bunday umumiy jarayon yo'q
async function player(name, { save } = {}) {
  const br = await launch(); browsers.push(br);
  const ctx = await br.newContext({ viewport: { width: 960, height: 540 }, deviceScaleFactor: 1 });
  await ctx.addInitScript(() => { window.__TEST = true; });
  if (save) await ctx.addInitScript((s) => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('safar_save_v2', s); sessionStorage.setItem('seeded', '1'); } }, JSON.stringify(save));
  const page = await ctx.newPage(); page.tag = name; page.setDefaultTimeout(120000); // ekransiz Chrome dasturiy chizadi: bir nechta sahifa birga sekin
  page.on('pageerror', (e) => { failed++; console.log(`[${name} pageerror]`, e.message); });
  page.on('console', (m) => { if (m.type() === 'error' && !/ERR_|Failed to load|net::|stun|ICE|telegram/i.test(m.text())) console.log(`[${name} ${m.type()}]`, m.text()); });
  await page.goto(dev.url + '/'); await page.waitForFunction(() => window.__ready === true && window.G.net.status !== 'wait', null, { timeout: 120000 });
  pages.push(page); return page;
}
// o'yinni oldinga yuritish (sinov rejimida kadr sikli to'xtagan) — tarmoq xabarlari orada keladi
const run = async (secs, ...ps) => { for (let t = 0; t < secs; t += 0.2) { for (const p of ps) await p.evaluate(() => G.advance(0.2, 1 / 30)); await sleep(30); } };
const until = async (p, fn, arg, secs = 20, ...others) => { const t0 = Date.now(); while (Date.now() - t0 < secs * 1000) { if (await p.evaluate(fn, arg)) return true; await run(0.4, p, ...others); } return false; };
const shot = async (p, name) => { const f = path.join(root, 'shots', name + '.jpg'); await p.screenshot({ path: f, type: 'jpeg', quality: 82 }); console.log('shot', f); };

try {
  // ---------- 1. Hisob va bulutli saqlov ----------
  const A = await player('A');
  ok(await A.evaluate(() => G.net.status === 'ok' && G.net.cfg.login && G.net.cfg.save), 'config');
  await A.evaluate((d) => G.net.login(d), tg(1001, 'Jasur'));
  ok(await until(A, () => G.net.cloud === 'ok'), 'login A + bulutga yuklash', await A.evaluate(() => G.net.user.name + ' / ' + G.net.cloudMsg));
  ok(!!redis.kv.get('save:1001'), 'redis save:1001');
  // A biroz o'ynaydi: pul va rekord
  await A.evaluate(() => { G.state.money = 7777; G.state.best.r1 = 101.25; G.state.best.jmp3 = 41; G.save(); return G.net.upload(true); });
  await A.evaluate(() => G.net.submitTop());
  const top = await A.evaluate(() => G.net.top('r1'));
  ok(top.rows.length === 1 && top.rows[0].name === 'Jasur' && top.rows[0].value === 101.25, 'reyting r1', JSON.stringify(top.rows));
  ok(JSON.parse(redis.kv.get('save:1001')).money === 7777, 'bulutdagi pul yangilandi');

  // boshqa qurilma (yangi o'yin) shu hisobga kiradi — bulutdagi saqlov olinadi (noldan boshlanmaydi)
  const A2 = await player('A2');
  ok(await A2.evaluate(() => G.state.money === 300), 'A2 yangi o\'yin');
  await A2.evaluate((d) => G.net.login(d).catch(() => 0), tg(1001, 'Jasur'));
  await A2.waitForFunction(() => window.__ready === true && window.G && G.state.money === 7777, null, { timeout: 120000 }).then(() => ok(true, 'A2 bulutdagi saqlovni oldi (7777 so\'m)'), () => ok(false, 'A2 bulutdagi saqlovni oldi'));
  await A2.context().close();

  // B: shu qurilmada yutuqlari bor + hisobida boshqa saqlov → tanlov oynasi
  const bSave = { v: 2, money: 5200, xp: 2000, stars: { r2: 3, r3: 2 }, stats: { time: 900, dist: 9000 }, veh: { own: ['jip', 'velo', 'sedan'], cur: 'jip', dmg: {}, paint: {} }, home: { lvl: 1 }, fresh: false };
  redis.kv.set('save:2002', JSON.stringify({ v: 2, money: 999, xp: 50, stars: {}, stats: { time: 300 } })); redis.kv.set('savemeta:2002', JSON.stringify({ money: 999, stars: 0, xp: 50, level: 1, time: 300, t: 1 }));
  const B = await player('B', { save: bSave });
  ok(await B.evaluate(() => G.state.money === 5200), 'B mahalliy saqlov');
  await B.evaluate((d) => G.net.login(d), tg(2002, 'Malika'));
  ok(await until(B, () => G.ui.screenName === 'cloud'), 'B tanlov oynasi');
  await B.evaluate(() => G.advance(0.05)); await shot(B, 'online_cloud_choice');
  await B.evaluate(() => G.net.choose('local'));
  ok(await until(B, () => G.net.cloud === 'ok'), 'B mahalliyni tanladi');
  ok(JSON.parse(redis.kv.get('save:2002')).money === 5200, 'B bulutga yozildi (5200)');
  await B.evaluate(() => G.ui.close());

  // ---------- 2. Xona: ochish, qo'shilish, bir-birini ko'rish ----------
  // A ning uyi — hovli uy (2-daraja); B ning o'z uyi — kulba (1-daraja)
  await A.evaluate(() => { G.state.home.lvl = 2; G.live.applyHome(); G.save(); });
  const code = await A.evaluate(async () => { await G.coop.create(); return G.coop.room && G.coop.room.code; });
  ok(/^[A-Z2-9]{6}$/.test(code || ''), 'xona ochildi', code);
  const joined = await B.evaluate((c) => G.coop.join(c), code);
  ok(joined, 'B kod bilan qo\'shildi');
  ok(await until(A, () => { const m = [...G.coop.members.values()][0]; return m && m.remote.shown; }, null, 60, B), 'A B ni ko\'radi');
  ok(await until(B, () => { const m = [...G.coop.members.values()][0]; return m && m.remote.shown && m.name === 'Jasur'; }, null, 20, A), 'B A ni ko\'radi (Jasur)');

  // ---------- 2b. Mehmon xona egasining uyida ----------
  ok(await until(B, () => G.visit.on && G.visit.owner === 'Jasur', null, 15, A), 'B Jasurning uyida mehmon');
  const bAt = await B.evaluate(() => { const h = G.site.places.uy.home, p = G.player.onFoot ? G.player.p : G.car.p; return Math.hypot(p[0] - h.x, p[2] - h.z); });
  ok(bAt < 40, 'B xona egasining uyi oldida paydo bo\'ldi', bAt.toFixed(1) + ' m');
  ok(await B.evaluate(() => G.state.home.lvl === 2 && G.site.places.uy.home.lvl === 2), 'B egasining uyini ko\'radi (2-daraja, o\'ziniki 1)');
  ok(await B.evaluate(() => JSON.parse(localStorage.getItem('safar_save_v2')).home.lvl === 1), 'B saqlovida o\'z uyi (1) qoldi');
  // skrinshot: mehmon egasining uyi oldida
  await B.evaluate(() => { const h = G.site.places.uy.home; G.view(h.x + Math.sin(h.yaw) * 26 + Math.cos(h.yaw) * 10, h.y + 9, h.z + Math.cos(h.yaw) * 26 - Math.sin(h.yaw) * 10, h.x, h.y + 2, h.z); G.ui.open('home'); });
  await shot(B, 'online_guest_home_window'); await B.evaluate(() => G.ui.close());
  await B.evaluate(() => { const h = G.site.places.uy.home, p = G.car.p; G.view(p[0] + Math.sin(h.yaw) * 14 - 6, h.y + 6, p[2] + Math.cos(h.yaw) * 14, h.x, h.y + 2, h.z); G.gfx.render(); });
  await shot(B, 'online_guest_at_host_home');
  // hissa: 500 so'm — egasining jamg'armasiga, mehmon pulidan egasi tasdiqlagach olinadi
  const mB0 = await B.evaluate(() => G.state.money);
  await B.evaluate(() => G.visit.contribute(500));
  ok(await until(A, () => (G.state.home.fund | 0) === 500 && G.coop.chat.some((c) => c.text === "Malika uyingizga 500 so'm qo'shdi"), null, 15, B), 'A ning uyiga 500 so\'m qo\'shildi (A saqlovida)');
  ok(await until(B, (m0) => G.state.money === m0 - 500 && G.state.home.fund === 500, mB0, 10, A), 'B puli 500 ga kamaydi, jamg\'arma ko\'rinadi');
  // egasidagi xabar (skrinshot): yana 100 so'm — xabar paydo bo'lishi bilan suratga olinadi
  await B.evaluate(() => G.visit.contribute(100));
  for (let i = 0; i < 100 && !(await A.evaluate(() => document.body.innerText.includes("Malika uyingizga 100 so'm qo'shdi"))); i++) await sleep(100);
  await A.evaluate(() => { G.gfx.render(); }); await shot(A, 'online_host_contribution_toast');
  ok(await until(B, (m0) => G.state.money === m0 - 600 && G.state.home.fund === 600, mB0, 10, A), 'ikkinchi hissa (100) ham hisoblandi');
  // bezak sovg'asi va poliz
  await B.evaluate(() => G.visit.decor('gulzor'));
  ok(await until(A, () => G.state.home.decor.gulzor === 1 && JSON.parse(localStorage.getItem('safar_save_v2')).home.decor.gulzor === 1, null, 15, B), 'gulzor A ning saqlovida');
  ok(await until(B, (m0) => G.state.money === m0 - 1100 && G.state.home.decor.gulzor === 1, mB0, 10, A), 'B gulzor uchun to\'ladi va uni ko\'radi');
  const seed0 = await B.evaluate(() => G.state.inv.seed);
  await B.evaluate(() => G.visit.act('bed', { i: 0 }, () => { G.state.inv.seed--; }));
  ok(await until(A, () => G.state.home.beds[0] > 0, null, 15, B), 'B ekkan urug\' A ning polizida');
  ok(await until(B, (s0) => G.state.inv.seed === s0 - 1 && G.state.home.beds[0] > 0, seed0, 10, A), 'B urug\'i sarflandi, jo\'yak ko\'rinadi');
  // noto'g'ri so'rov rad etiladi
  await B.evaluate(() => { const m = [...G.coop.members.values()][0]; m.conn.send({ t: 'ha', id: 999, k: 'boom' }); m.conn.send({ t: 'ha', id: 998, k: 'fund', n: -50 }); });
  await run(1, A, B);
  ok(await A.evaluate(() => (G.state.home.fund | 0) === 600 && G.state.home.lvl === 2), 'noto\'g\'ri so\'rovlar uyni o\'zgartirmadi');
  ok(await B.evaluate(() => { G.save(); const s = JSON.parse(localStorage.getItem('safar_save_v2')); return s.home.lvl === 1 && !s.home.decor.gulzor && !s.home.beds[0]; }), 'B saqlovi: o\'z uyi o\'zgarmagan');
  // B do'sti yoniga ko'chadi, keyin ikkalasi yonma-yon haydaydi
  const apid = await A.evaluate(() => G.coop.myId());
  await B.evaluate((p) => G.coop.teleportTo(p), apid);
  await run(1.5, A, B);
  const dist = await A.evaluate(() => { const m = [...G.coop.members.values()][0]; return Math.hypot(m.remote.pos.x - G.car.p[0], m.remote.pos.z - G.car.p[2]); });
  ok(dist > 4 && dist < 20, 'B A ning yonida', dist.toFixed(1) + ' m');
  // A tushib piyoda yuradi (B uni piyoda ko'rishi kerak)
  await A.evaluate(() => { G.live.dismount(); });
  ok(await until(B, () => { const m = [...G.coop.members.values()][0]; return m && m.remote.foot && m.remote.rig.root.visible; }, null, 60, A), 'B A ni piyoda ko\'radi');
  // skrinshotlar: har ikki ekranda — do'st transporti/qahramoni va ism yorlig'i
  for (const [p, name] of [[A, 'online_A_sees_B'], [B, 'online_B_sees_A']]) {
    await p.evaluate(() => { const m = [...G.coop.members.values()][0], w = m.remote.where(), me = G.player.onFoot ? G.player.p : G.car.p; const dx = w[0] - me[0], dz = w[1] - me[2], d = Math.hypot(dx, dz) || 1; const y = G.T.ground(me[0], me[2], 1e9).y; G.view(me[0] - dx / d * 7 + dz / d * 3, y + 3.2, me[2] - dz / d * 7 - dx / d * 3, (me[0] + w[0]) / 2, y + 1, (me[2] + w[1]) / 2); });
    await shot(p, name);
  }
  await A.evaluate(() => G.live.mount(false));
  // xaritada do'st nuqtasi
  ok(await A.evaluate(() => (G.netDots || []).length === 1 && G.netDots[0][3] === 'Malika'), 'A xaritasida Malika');
  await A.evaluate(() => { G.ui.open('online'); G.advance(0.05); }); await shot(A, 'online_room_window'); await A.evaluate(() => G.ui.close());

  // ---------- 3. Chat ----------
  await A.evaluate(() => { G.coop.say('Salom, poygaga tayyormisan?'); G.coop.emoji('🔥'); });
  ok(await until(B, () => G.coop.chat.some((c) => c.text === 'Salom, poygaga tayyormisan?' && c.name === 'Jasur') && G.coop.chat.some((c) => c.text === '🔥'), null, 10, A), 'chat xabari va emoji yetib keldi');
  await B.evaluate(() => { G.coop.say("Ha! <b>ketdik</b>"); G.coop.openChat(); G.advance(0.05); }); await shot(B, 'online_chat');
  await B.evaluate(() => G.coop.closeChat());
  ok(await until(A, () => G.coop.chat.some((c) => c.text === 'Ha! <b>ketdik</b>') && !document.querySelector('#chat .feed b b'), null, 10, B), 'chat matni HTML sifatida bajarilmaydi');

  // ---------- 4. Birga poyga ----------
  ok(await A.evaluate(() => G.coop.startRace('r13')), 'A poygani boshladi');
  ok(await until(B, () => G.act && G.act.def.id === 'r13' && G.coopRace, null, 10, A), 'B ham poygada (r13)');
  const grid = await A.evaluate(() => [G.car.p[0], G.car.p[2], G.act.state, (G.rivals || []).filter((r) => r.active).length]);
  const gridB = await B.evaluate(() => [G.car.p[0], G.car.p[2]]);
  ok(grid[2] === 'count' && grid[3] === 0, 'start sanog\'i, sun\'iy raqiblar yo\'q');
  ok(Math.hypot(grid[0] - gridB[0], grid[1] - gridB[1]) > 3, 'start chizig\'ida turli joylar', Math.hypot(grid[0] - gridB[0], grid[1] - gridB[1]).toFixed(1) + ' m');
  await run(1.0, A, B); await shot(B, 'online_race_start');
  // marra: A 61,5 s, B 64,2 s (natija yuborish yo'lini sinash uchun marra holati qo'lda chaqiriladi)
  await A.evaluate(() => { G.act.state = 'run'; G.act.t = 61.5; G.endAct(true, 'done', 3, 'sinov'); G.ui.close(); });
  ok(await until(B, () => G.coopRace && G.coopRace.done === 1, null, 10, A), 'B A marraga yetganini bildi');
  await B.evaluate(() => { G.act.state = 'run'; G.act.t = 64.2; G.endAct(true, 'done', 2, 'sinov'); G.ui.close(); });
  ok(await until(A, () => G.ui.screenName === 'coopres', null, 15, B), 'A da natija oynasi');
  ok(await until(B, () => G.ui.screenName === 'coopres', null, 15, A), 'B da natija oynasi');
  const res = await B.evaluate(() => G.coop.lastResults.rows.map((r) => r.name + ':' + r.time));
  ok(res.join(',') === 'Jasur:61.5,Malika:64.2', 'natija tartibi', res.join(','));
  await shot(B, 'online_race_result');
  await A.evaluate(() => G.ui.close()); await B.evaluate(() => G.ui.close());

  // ---------- 5. Uchinchi o'yinchi, egasi chiqib ketishi ----------
  const C3 = await player('C');
  let cj = false; for (let i = 0; i < 4 && !cj; i++) { cj = await C3.evaluate((c) => G.coop.join(c), code); if (!cj) { console.log('C urinish', i + 1, await C3.evaluate(() => G.coop.msg + ' ' + JSON.stringify(G.coop.errs.slice(-4)))); await run(1.5, A, B); } }
  ok(cj, 'C qo\'shildi (mehmon)');
  ok(await until(B, () => G.coop.members.size === 2, null, 60, A, C3), 'B C ni ham ko\'radi (to\'r)', await B.evaluate(() => JSON.stringify(G.coop.errs.slice(-6))));
  await A.evaluate(() => G.coop.leave());
  ok(await until(B, () => G.coop.members.size === 1 && (G.coop.room.isHost || G.coop.room.hostPid !== null), null, 15, C3), 'A chiqdi');
  const hostOk = await until(B, () => { const r = G.coop.room; return r && r.hostPid && (r.isHost ? 1 : 0) + 0 >= 0; }, null, 5, C3);
  const hosts = [await B.evaluate(() => G.coop.room.isHost), await C3.evaluate(() => G.coop.room.isHost)];
  ok(hostOk && hosts.filter(Boolean).length === 1, 'egalik bitta o\'yinchiga o\'tdi', JSON.stringify(hosts));
  // eski kod bilan yangi o'yinchi kira oladi (yangi ega kodni qayta egallaydi)
  await sleep(1500);
  const D = await player('D');
  let dj = false; for (let i = 0; i < 6 && !dj; i++) { dj = await D.evaluate((c) => G.coop.join(c), code); if (!dj) await run(1.5, B, C3); }
  ok(dj, 'egasi almashgandan keyin ham kod ishlaydi');
  ok(await until(D, () => G.coop.members.size === 2, null, 60, B, C3), 'D ikkalasini ko\'radi', await D.evaluate(() => JSON.stringify(G.coop.errs.slice(-6))));
  ok(await B.evaluate(() => G.coop.room.isHost ? !G.visit.on && G.state.home.lvl === 1 : G.visit.on && G.state.home.lvl === 0), 'egasi almashgach B ko\'rinishi to\'g\'ri (o\'z uyi yoki yangi egasining uyi)');
  await D.evaluate(() => G.coop.leave()); await C3.evaluate(() => G.coop.leave()); await B.evaluate(() => G.coop.leave());
  ok(await until(B, () => !G.visit.on && G.state.home.lvl === 1 && !G.state.home.decor.gulzor && G.site.places.uy.home.lvl === 1, null, 10), 'B xonadan chiqdi — o\'z uyi qaytdi');

  // ---------- 6. Yuklab olingan fayl: onlayn "mavjud emas", o'yin ishlaydi ----------
  const fctx = await browser.newContext({ viewport: { width: 960, height: 540 } }); await fctx.addInitScript(() => { window.__TEST = true; });
  const F = await fctx.newPage(); F.on('pageerror', (e) => { failed++; console.log('[file pageerror]', e.message); });
  await F.goto(pathToFileURL(path.join(root, 'dist/SAFAR.html')).href); await F.waitForFunction(() => window.__ready === true, null, { timeout: 120000 });
  ok(await F.evaluate(() => G.net.status === 'file'), 'faylda onlayn o\'chiq');
  await F.evaluate(() => { G.ui.open('online'); G.advance(0.05); }); await shot(F, 'online_file_unavailable');
  ok(await F.evaluate(async () => { const r = await G.coop.create(); return r === false && G.coop.status === 'error'; }), 'faylda xona ochilmaydi (xatosiz)');
  ok(await F.evaluate(() => /Davom etish|O'yinni boshlash/.test(document.body.innerText) || G.mode === 'ui'), 'o\'yin ishlayapti');
  await fctx.close();
} catch (e) { failed++; console.log('SCENARIO ERROR', e.stack || e.message); }
for (const b of browsers) await b.close().catch(() => {}); await dev.close(); await redis.close();
console.log(failed ? `TEST online FAIL (${failed})` : 'TEST online ALL OK');
process.exit(failed ? 1 : 0);
