// /api/auth — kirish: Telegram yoki ism-parol (akkaunt).
//   POST  {Telegram Login Widget ma'lumoti}                    → imzo serverda tekshiriladi → { token (30 kunlik sessiya), user }
//   POST  {type:'pass', mode:'new'|'in', login, pass}          → ro'yxatdan o'tish yoki parol bilan kirish (bulut bazasi kerak) → { token, user }
//   GET   (Authorization: Bearer)                              → { user } — sessiya hali amal qiladimi
// Parol xeshi scrypt (node:crypto) bilan, akkaunt Redis'da `acc:<login>` xesh qatorida. Parolning o'zi hech qayerda saqlanmaydi.
import crypto from 'node:crypto';
import { env, send, fail, readBody, checkTelegram, cleanName, signToken, sessionSecret, authUser, redis, redisCfg, rateLimit, clientIp, wrap } from './_lib.js';

export default wrap(async (req, res) => {
  if (req.method === 'GET') { const u = authUser(req); return u ? send(res, 200, { ok: true, user: pub(u) }) : fail(res, 401, 'Sessiya tugagan'); }
  if (req.method !== 'POST') return fail(res, 405, 'Faqat POST');
  const d = await readBody(req, 4096);
  if (d && d.type === 'pass') return passAuth(req, res, d);
  const bot = env('TELEGRAM_BOT_TOKEN'), secret = sessionSecret();
  if (!bot || !secret) return fail(res, 503, 'Telegram orqali kirish hali sozlanmagan');
  if (!(await rateLimit('auth:' + clientIp(req), 20, 60))) return fail(res, 429, 'Juda ko\'p urinish, birozdan keyin qayta urining');
  const chk = checkTelegram(d, bot);
  if (!chk.ok) return fail(res, 401, chk.error);
  const name = cleanName(d.first_name) || cleanName(d.username) || 'Sayyoh';
  const photo = /^https:\/\/(t\.me|([a-z0-9-]+\.)*telegram\.(org|me)|([a-z0-9-]+\.)*telesco\.pe)\//i.test(String(d.photo_url || '')) ? String(d.photo_url).slice(0, 300) : '';
  const user = { sub: String(d.id), name, un: cleanName(d.username).replace(/[^A-Za-z0-9_]/g, ''), ph: photo };
  try { await redis(['HSET', 'names', user.sub, name]); } catch { /* reyting ismi keyin yoziladi */ }
  send(res, 200, { ok: true, token: signToken(user, secret), user: pub(user) });
});

// ---------- ism-parol akkaunti ----------
const scrypt = (pass, salt) => crypto.scryptSync(String(pass), salt, 32, { N: 16384, r: 8, p: 1 });
async function passAuth(req, res, d) {
  const secret = sessionSecret();
  if (!redisCfg() || !secret) return fail(res, 503, 'Akkaunt bilan kirish hali sozlanmagan (bulut bazasi kerak)');
  if (!(await rateLimit('authp:' + clientIp(req), 12, 60))) return fail(res, 429, 'Juda ko\'p urinish, birozdan keyin qayta urining');
  const raw = cleanName(d.login), login = raw.toLowerCase();
  const pass = String(d.pass || '');
  if (!/^[a-z0-9_]{3,20}$/.test(login)) return fail(res, 400, "Login 3–20 belgidan: lotin harf, raqam yoki _ (masalan: ali_2014)");
  if (pass.length < 4 || pass.length > 64) return fail(res, 400, 'Parol kamida 4 belgi bo\'lsin');
  const key = 'acc:' + login, sub = 'p:' + login;
  if (d.mode === 'new') {
    const salt = crypto.randomBytes(16).toString('hex');
    const made = await redis(['HSETNX', key, 'salt', salt]);
    if (!Number(made)) return fail(res, 409, 'Bu login band — boshqasini tanlang yoki parol bilan kiring');
    await redis(['HSET', key, 'hash', scrypt(pass, salt).toString('hex'), 'name', raw, 'ts', String(Date.now())], ['HSET', 'names', sub, raw]);
    return send(res, 200, { ok: true, token: signToken({ sub, name: raw, un: login }, secret), user: pub({ sub, name: raw, un: login }) });
  }
  const [salt, hash, name] = await redis(['HMGET', key, 'salt', 'hash', 'name']);
  if (!salt || !hash) return fail(res, 401, 'Bunday akkaunt topilmadi — avval ro\'yxatdan o\'ting');
  const want = Buffer.from(String(hash), 'hex'), got = scrypt(pass, String(salt));
  if (want.length !== got.length || !crypto.timingSafeEqual(got, want)) return fail(res, 401, 'Parol noto\'g\'ri');
  const nm = cleanName(name) || raw;
  send(res, 200, { ok: true, token: signToken({ sub, name: nm, un: login }, secret), user: pub({ sub, name: nm, un: login }) });
}
const pub = (u) => ({ id: u.sub, name: u.name, username: u.un || '', photo: u.ph || '' });
