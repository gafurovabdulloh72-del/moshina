// /api/auth — Telegram orqali kirish.
//   POST  {Telegram Login Widget ma'lumoti}  → imzo serverda tekshiriladi → { token (30 kunlik sessiya), user }
//   GET   (Authorization: Bearer)            → { user } — sessiya hali amal qiladimi
import { env, send, fail, readBody, checkTelegram, cleanName, signToken, sessionSecret, authUser, redis, redisCfg, rateLimit, clientIp, wrap } from './_lib.js';

export default wrap(async (req, res) => {
  if (req.method === 'GET') { const u = authUser(req); return u ? send(res, 200, { ok: true, user: pub(u) }) : fail(res, 401, 'Sessiya tugagan'); }
  if (req.method !== 'POST') return fail(res, 405, 'Faqat POST');
  const bot = env('TELEGRAM_BOT_TOKEN'), secret = sessionSecret();
  if (!bot || !secret) return fail(res, 503, 'Telegram orqali kirish hali sozlanmagan');
  if (!(await rateLimit('auth:' + clientIp(req), 20, 60))) return fail(res, 429, 'Juda ko\'p urinish, birozdan keyin qayta urining');
  const d = await readBody(req, 4096);
  const chk = checkTelegram(d, bot);
  if (!chk.ok) return fail(res, 401, chk.error);
  const name = cleanName(d.first_name) || cleanName(d.username) || 'Sayyoh';
  const photo = /^https:\/\/(t\.me|([a-z0-9-]+\.)*telegram\.(org|me)|([a-z0-9-]+\.)*telesco\.pe)\//i.test(String(d.photo_url || '')) ? String(d.photo_url).slice(0, 300) : '';
  const user = { sub: String(d.id), name, un: cleanName(d.username).replace(/[^A-Za-z0-9_]/g, ''), ph: photo };
  if (redisCfg()) { try { await redis(['HSET', 'names', user.sub, name]); } catch { /* reyting ismi keyin yoziladi */ } }
  send(res, 200, { ok: true, token: signToken(user, secret), user: pub(user) });
});
const pub = (u) => ({ id: u.sub, name: u.name, username: u.un || '', photo: u.ph || '' });
