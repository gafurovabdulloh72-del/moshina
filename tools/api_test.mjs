// Onlayn server funksiyalari (api/*.js) sinovi: soxta Redis + sinov bot tokeni bilan imzolangan soxta Telegram ma'lumoti.
// Ishlatish: npm run test:api   (node --test)
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { startFakeRedis } from './fake-redis.mjs';

const BOT = '7777777:TEST-token-for-unit-tests';
let R, L, auth, save, top, config;
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
  L = await import('../api/_lib.js'); auth = (await import('../api/auth.js')).default; save = (await import('../api/save.js')).default; top = (await import('../api/top.js')).default; config = (await import('../api/config.js')).default;
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

test('tezlik cheklovi va sozlanmagan muhit', async () => {
  let last; for (let i = 0; i < 22; i++) last = await call(auth, { method: 'POST', ip: '9.9.9.9', body: { id: 1 } });
  assert.equal(last.status, 429);
  const keep = process.env.TELEGRAM_BOT_TOKEN; delete process.env.TELEGRAM_BOT_TOKEN; const ss = process.env.SESSION_SECRET; delete process.env.SESSION_SECRET;
  try { assert.equal((await call(auth, { method: 'POST', body: {} })).status, 503); assert.equal((await call(config)).json.login, false); }
  finally { process.env.TELEGRAM_BOT_TOKEN = keep; process.env.SESSION_SECRET = ss; }
  const ku = process.env.KV_REST_API_URL; delete process.env.KV_REST_API_URL;
  try { const { token } = await login(4001, 'Nodir'); assert.equal((await call(save, { token })).status, 503); assert.equal((await call(config)).json.save, false); }
  finally { process.env.KV_REST_API_URL = ku; }
});
