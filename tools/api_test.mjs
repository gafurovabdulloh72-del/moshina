// Onlayn server funksiyalari (api/*.js) sinovi: soxta Redis + sinov bot tokeni bilan imzolangan soxta Telegram ma'lumoti.
// Ishlatish: npm run test:api   (node --test)
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { startFakeRedis } from './fake-redis.mjs';

const BOT = '7777777:TEST-token-for-unit-tests';
let R, L, auth, save, top, config, hafta, HW;
const now = () => Math.floor(Date.now() / 1000);
// Telegram widget ma'lumotini sinov tokeni bilan imzolash (haqiqiy Telegram qanday imzolasa, shunday)
export function tgSign(d, bot = BOT) { const dcs = Object.keys(d).sort().map((k) => `${k}=${d[k]}`).join('\n'); const sec = crypto.createHash('sha256').update(bot).digest(); return Object.assign({}, d, { hash: crypto.createHmac('sha256', sec).update(dcs).digest('hex') }); }
// Vercel uslubidagi req/res taqlidi
async function call(fn, { method = 'GET', body, query = {}, token, ip = '1.2.3.4' } = {}) {
  const headers = { 'x-forwarded-for': ip }; if (token) headers.authorization = 'Bearer ' + token;
  const req = { method, headers, body, query, url: '/' }; let out = '';
  const res = { statusCode: 200, headersSent: false, h: {}, setHeader(k, v) { this.h[k.toLowerCase()] = v; }, end(s) { out = s; this.headersSent = true; } };
  await fn(req, res); return { status: res.statusCode, json: JSON.parse(out || '{}'), headers: res.h };
}
const login = async (id, first_name, extra = {}) => (await call(auth, { method: 'POST', body: tgSign({ id, first_name, auth_date: now(), ...extra }) })).json;

test.before(async () => {
  R = await startFakeRedis();
  Object.assign(process.env, { KV_REST_API_URL: R.url, KV_REST_API_TOKEN: R.token, TELEGRAM_BOT_TOKEN: BOT, TELEGRAM_BOT_USERNAME: '@safar_test_bot', SESSION_SECRET: 's3cret' });
  L = await import('../api/_lib.js'); auth = (await import('../api/auth.js')).default; save = (await import('../api/save.js')).default; top = (await import('../api/top.js')).default; config = (await import('../api/config.js')).default; hafta = (await import('../api/hafta.js')).default; HW = await import('../src/haftalik.js');
});
test.after(async () => { await R.close(); });

test('Telegram imzosi: to\'g\'ri, buzilgan, eski, boshqa token', () => {
  const d = tgSign({ id: 42, first_name: 'Ali', username: 'ali', auth_date: now() });
  assert.equal(L.checkTelegram(d, BOT).ok, true);
  assert.equal(L.checkTelegram({ ...d, first_name: 'Vali' }, BOT).ok, false);
  assert.equal(L.checkTelegram(d, '1:other').ok, false);
  assert.equal(L.checkTelegram(tgSign({ id: 42, first_name: 'Ali', auth_date: now() - 90000 }), BOT).ok, false);
  assert.equal(L.checkTelegram({ ...d, hash: 'zz' }, BOT).ok, false);
});

test('sessiya tokeni (HS256): imzo, muddat, buzish', () => {
  const t = L.signToken({ sub: '5', name: 'A' }, 'k');
  assert.equal(L.verifyToken(t, 'k').sub, '5');
  assert.equal(L.verifyToken(t, 'boshqa'), null);
  const p = t.split('.'); const body = JSON.parse(Buffer.from(p[1], 'base64url')); body.sub = '6';
  assert.equal(L.verifyToken(p[0] + '.' + Buffer.from(JSON.stringify(body)).toString('base64url') + '.' + p[2], 'k'), null);
  assert.equal(L.verifyToken(L.signToken({ sub: '5' }, 'k', -1), 'k'), null);
  // alg: none hujumi
  assert.equal(L.verifyToken(Buffer.from('{"alg":"none"}').toString('base64url') + '.' + p[1] + '.', 'k'), null);
});

test('/api/config — sir qaytarmaydi', async () => {
  const r = await call(config);
  assert.equal(r.status, 200); assert.equal(r.json.bot, 'safar_test_bot'); assert.equal(r.json.login, true); assert.equal(r.json.save, true);
  assert.ok(!JSON.stringify(r.json).includes(BOT)); assert.ok(Array.isArray(r.json.ice) && r.json.ice[0].urls.length >= 2);
});

test('/api/auth — kirish, rad etish, sessiyani tekshirish', async () => {
  const j = await login(1001, 'Jasur', { username: 'jasur_uz', photo_url: 'https://t.me/i/userpic/320/x.jpg' });
  assert.equal(j.ok, true); assert.equal(j.user.name, 'Jasur'); assert.equal(j.user.id, '1001'); assert.ok(j.user.photo.startsWith('https://t.me/'));
  assert.equal((await call(auth, { token: j.token })).json.user.name, 'Jasur');
  assert.equal((await call(auth, { token: j.token + 'x' })).status, 401);
  const bad = tgSign({ id: 1001, first_name: 'Jasur', auth_date: now() }); bad.first_name = 'Admin';
  assert.equal((await call(auth, { method: 'POST', body: bad })).status, 401);
  assert.equal(R.hs.get('names').get('1001'), 'Jasur');
  // ismdagi HTML tozalanadi
  assert.equal((await login(1002, '<b>Ko\'k</b>')).user.name, "bKo'k/b");
});

test('/api/auth — ism-parol akkaunti: ochish, band login, kirish, xato parol', async () => {
  const pa = (body, ip = '9.9.9.9') => call(auth, { method: 'POST', body: Object.assign({ type: 'pass' }, body), ip });
  const r1 = (await pa({ mode: 'new', login: 'Ali_2014', pass: 'sirli4' })).json; // katta harf kichraytiriladi
  assert.equal(r1.ok, true); assert.equal(r1.user.id, 'p:ali_2014'); assert.equal(r1.user.username, 'ali_2014'); assert.equal(r1.user.name, 'Ali_2014');
  assert.equal((await call(auth, { token: r1.token })).json.user.id, 'p:ali_2014'); // sessiya ishlaydi
  assert.equal((await pa({ mode: 'new', login: 'ali_2014', pass: 'boshqa' })).status, 409); // login band
  assert.equal((await pa({ mode: 'in', login: 'ali_2014', pass: 'xato' })).status, 401); // parol xato
  const r2 = (await pa({ mode: 'in', login: 'ALI_2014', pass: 'sirli4' })).json; assert.equal(r2.ok, true); assert.equal(r2.user.id, 'p:ali_2014');
  assert.equal((await pa({ mode: 'in', login: 'yoq_odam', pass: 'sirli4' })).status, 401); // akkaunt yo'q
  assert.equal((await pa({ mode: 'new', login: 'ab', pass: 'sirli4' })).status, 400); // login qisqa
  assert.equal((await pa({ mode: 'new', login: 'to g ri', pass: 'sirli4' })).status, 400); // bo'shliq mumkin emas
  assert.equal((await pa({ mode: 'new', login: 'parolsiz', pass: '12' })).status, 400); // parol qisqa
  assert.equal(R.hs.get('names').get('p:ali_2014'), 'Ali_2014'); // reyting ismi yozildi
  // shu akkaunt bilan bulutga saqlash ham ishlaydi
  const p = await call(save, { method: 'PUT', token: r2.token, body: { save: { v: 2, money: 77, xp: 10, stars: {}, stats: { time: 60 } } } });
  assert.equal(p.status, 200); assert.equal((await call(save, { token: r2.token })).json.save.money, 77);
  // config endi pass bayrog'ini beradi
  assert.equal((await call(config)).json.pass, true);
});

test('/api/save — saqlash, o\'qish, cheklovlar', async () => {
  const { token } = await login(2001, 'Malika');
  assert.equal((await call(save)).status, 401);
  assert.equal((await call(save, { token })).json.save, null);
  const s = { v: 2, money: 4321, xp: 900, stars: { r1: 3, j_bogiston1: 2, x: 9 }, stats: { time: 600 } };
  const p = await call(save, { method: 'PUT', token, body: { save: s } });
  assert.equal(p.status, 200); assert.equal(p.json.meta.stars, 8); assert.equal(p.json.meta.level, 3); assert.equal(p.json.meta.money, 4321);
  const g = await call(save, { token }); assert.deepEqual(g.json.save, s); assert.equal(g.json.meta.stars, 8);
  assert.equal((await call(save, { method: 'PUT', token, body: { save: { v: 1, money: 1 } } })).status, 400);
  assert.equal((await call(save, { method: 'PUT', token, body: { save: [] } })).status, 400);
  const big = { v: 2, money: 1, junk: 'x'.repeat(210 * 1024) };
  assert.equal((await call(save, { method: 'PUT', token, body: { save: big } })).status, 413);
  assert.equal(R.zs.get('top:stars').get('2001'), 8);
});

test('/api/top — natija yuborish, chegaralar, tartib', async () => {
  const a = await login(3001, 'Aziz'), b = await login(3002, 'Bek'), c = await login(3003, 'Cho\'lpon');
  await call(top, { method: 'POST', token: a.token, body: { results: [{ id: 'r1', value: 95.5 }, { id: 'z1', value: 4000 }, { id: 'rad3', value: 130 }, { id: 'jmp2', value: 33 }] } });
  await call(top, { method: 'POST', token: b.token, body: { results: [{ id: 'r1', value: 88.25 }, { id: 'z1', value: 7000 }] } });
  const r = await call(top, { method: 'POST', token: c.token, body: { results: [{ id: 'r1', value: 3 }, { id: 'r1', value: 120 }, { id: 'z1', value: 9e9 }, { id: 'xyz', value: 5 }, { id: 'rad3', value: 999 }] } });
  assert.deepEqual(r.json.accepted, ['r1']); // 3 soniya va 9e9 ochko — aqlga sig'maydi; noma'lum id rad etiladi
  // yomonroq natija eskisini almashtirmaydi
  await call(top, { method: 'POST', token: a.token, body: { results: [{ id: 'r1', value: 140 }, { id: 'z1', value: 100 }] } });
  const g = await call(top, { query: { id: 'r1' }, token: a.token });
  assert.deepEqual(g.json.rows.map((x) => [x.name, x.value]), [['Bek', 88.25], ['Aziz', 95.5], ["Cho'lpon", 120]]);
  assert.equal(g.json.asc, true); assert.deepEqual(g.json.me, { rank: 2, value: 95.5 }); assert.equal(g.json.rows[1].me, true);
  const z = await call(top, { query: { id: 'z1' } });
  assert.deepEqual(z.json.rows.map((x) => x.value), [7000, 4000]); assert.equal(z.json.me, null);
  assert.equal((await call(top, { query: { id: 'nope' } })).status, 404);
  assert.equal((await call(top, { method: 'POST', body: { results: [] } })).status, 401);
  const st = await call(top, { query: { id: 'stars' } }); assert.ok(st.json.rows.some((x) => x.name === 'Malika' && x.value === 8));
  const lv = await call(top, { query: { id: 'level' } }); assert.ok(lv.json.rows.some((x) => x.name === 'Malika' && x.value === 3));
});

test('haftalik.js — hafta raqami va chellenj hamma joyda bir xil', () => {
  assert.equal(HW.weekIndex(new Date(2026, 10, 16)), HW.weekIndex(new Date(2026, 10, 22, 23, 59))); // dushanba..yakshanba — bitta hafta
  assert.equal(HW.weekIndex(new Date(2026, 10, 23)), HW.weekIndex(new Date(2026, 10, 22)) + 1);
  assert.deepEqual(HW.weekLabel(HW.weekIndex(new Date(2026, 10, 19))), { n: 47, y: 2026, from: '16.11', to: '22.11' });
  assert.equal(HW.weekLabel(HW.weekIndex(new Date(2027, 0, 1))).n, 53); // 2026-yil 53 haftali
  const seen = new Set(); let prev = null;
  for (let w = 3000; w < 3020; w++) { const id = HW.weeklyId(w); assert.notEqual(id, prev); prev = id; seen.add(id); assert.ok(['race', 'drift', 'smash'].includes(HW.weeklyKind(w))); }
  assert.equal(seen.size, 20); // 20 haftada hovuzdagi hamma chellenj bir martadan
  assert.ok(![...seen].includes('r15')); // yakuniy poyga haftalikka tushmaydi
});

test('/api/hafta — natija, chegaralar, eng yaxshisi, jadval', async () => {
  const w = HW.weekIndexUTC(), kind = HW.weeklyKind(w), asc = kind === 'race', [lo, hi] = HW.CH_LIM[kind];
  const good = asc ? 150.5 : Math.min(hi, 4000), better = asc ? 120.25 : Math.min(hi, 5000), worse = asc ? 200 : 100;
  const a = await login(5001, 'Akmal'), b = await login(5002, 'Barno'), c = await login(5003, 'Sardor');
  assert.equal((await call(hafta, { method: 'POST', body: { w, ch: good } })).status, 401);
  let r = await call(hafta, { method: 'POST', token: a.token, body: { w, ch: good, s: { money: 2500, km: 42000, jobs: 4, wins: 1 } } });
  assert.equal(r.status, 200); assert.deepEqual(r.json.accepted, { ch: good, money: 2500, km: 42000, jobs: 4, wins: 1 });
  await call(hafta, { method: 'POST', token: b.token, body: { w, ch: better, s: { money: 1200, km: 90000, jobs: 1 } } });
  // yomonroq natija va kichikroq ko'rsatkich eskisini almashtirmaydi
  await call(hafta, { method: 'POST', token: a.token, body: { w, ch: worse, s: { money: 10, km: 5 } } });
  // aqlga sig'maydigan qiymatlar: chellenj — rad, ko'rsatkich — hafta boshidan o'tgan vaqtga qarab qirqiladi
  r = await call(hafta, { method: 'POST', token: c.token, body: { w, ch: asc ? 3 : hi * 10, s: { money: 9e15, km: 'ko\'p', jobs: -5, wins: 9e9, xyz: 1 } } });
  assert.equal(r.status, 200); assert.equal(r.json.accepted.ch, undefined); assert.equal(r.json.accepted.km, undefined); assert.equal(r.json.accepted.jobs, undefined); assert.equal(r.json.accepted.xyz, undefined);
  const secs = (Date.now() - HW.weekStartMs(w)) / 1000 + 14 * 3600;
  assert.ok(r.json.accepted.money <= 5e6 && r.json.accepted.money <= HW.statCap('money', secs + 2) && r.json.accepted.money >= HW.statCap('money', secs - 60));
  assert.ok(r.json.accepted.wins <= HW.statCap('wins', secs + 2) && r.json.accepted.wins < 20000);
  // boshqa hafta qabul qilinmaydi
  assert.equal((await call(hafta, { method: 'POST', token: a.token, body: { w: w - 5, ch: good } })).status, 400);
  assert.equal((await call(hafta, { method: 'POST', token: a.token, body: { w: 'x', ch: good } })).status, 400);
  assert.equal((await call(hafta, { query: { t: 'ch', w: String(w + 9) } })).status, 400);
  // jadvallar
  const g = await call(hafta, { query: { t: 'ch' }, token: a.token });
  assert.equal(g.json.ch, HW.weeklyId(w)); assert.equal(g.json.kind, kind); assert.equal(g.json.asc, asc);
  assert.deepEqual(g.json.rows.map((x) => [x.name, x.value]), [['Barno', better], ['Akmal', good]]);
  assert.deepEqual(g.json.me, { rank: 2, value: good }); assert.equal(g.json.rows[1].me, true);
  const km = await call(hafta, { query: { t: 'km' } });
  assert.deepEqual(km.json.rows.map((x) => [x.name, x.value]), [['Barno', 90000], ['Akmal', 42000]]); assert.equal(km.json.me, null); assert.equal(km.json.asc, false);
  const mo = await call(hafta, { query: { t: 'money' }, token: c.token });
  assert.equal(mo.json.rows[0].name, 'Sardor'); assert.equal(mo.json.rows[1].value, 2500); assert.equal(mo.json.me.rank, 1);
  assert.equal((await call(hafta, { query: { t: 'nope' } })).status, 404);
  assert.equal((await call(hafta, { method: 'PUT', token: a.token, body: {} })).status, 405);
  assert.ok(R.log.includes('EXPIRE'));
});

test('tezlik cheklovi va sozlanmagan muhit', async () => {
  let last; for (let i = 0; i < 22; i++) last = await call(auth, { method: 'POST', ip: '9.9.9.9', body: { id: 1 } });
  assert.equal(last.status, 429);
  const keep = process.env.TELEGRAM_BOT_TOKEN; delete process.env.TELEGRAM_BOT_TOKEN; const ss = process.env.SESSION_SECRET; delete process.env.SESSION_SECRET;
  try { assert.equal((await call(auth, { method: 'POST', body: {} })).status, 503); assert.equal((await call(config)).json.login, false); }
  finally { process.env.TELEGRAM_BOT_TOKEN = keep; process.env.SESSION_SECRET = ss; }
  const ku = process.env.KV_REST_API_URL; delete process.env.KV_REST_API_URL;
  try { const { token } = await login(4001, 'Nodir'); assert.equal((await call(save, { token })).status, 503); assert.equal((await call(hafta, { query: { t: 'ch' } })).status, 503); assert.equal((await call(config)).json.save, false); }
  finally { process.env.KV_REST_API_URL = ku; }
});
