// Onlayn rejim serveri uchun umumiy yordamchilar: muhit, JSON javob, so'rov tanasi, sessiya (HS256 JWT), Telegram imzosi, Upstash Redis (REST), tezlik cheklovi.
// "_" bilan boshlangan fayl Vercel'da alohida manzil bo'lmaydi — faqat boshqa funksiyalar import qiladi. Tashqi kutubxona ishlatilmaydi (node:crypto + fetch).
import crypto from 'node:crypto';

export const env = (k) => String(process.env[k] || '').trim();
export const SAVE_MAX = 200 * 1024; // bulutli saqlovning eng katta hajmi (bayt)
const SESSION_DAYS = 30;

// ---------- javob ----------
export function send(res, status, obj) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(obj));
}
export const fail = (res, status, error) => send(res, status, { ok: false, error });

// So'rov tanasi: Vercel o'zi o'qigan bo'lsa (req.body) — shuni, aks holda oqimdan (cheklangan hajm bilan)
export async function readBody(req, limit) {
  let raw;
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === 'object' && !Buffer.isBuffer(req.body)) { raw = JSON.stringify(req.body); if (raw.length > limit) throw httpErr(413, "Ma'lumot juda katta"); return req.body; }
    raw = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : String(req.body);
  } else {
    raw = await new Promise((ok, no) => {
      const parts = []; let n = 0;
      req.on('data', (c) => { n += c.length; if (n > limit) { no(httpErr(413, "Ma'lumot juda katta")); req.destroy(); } else parts.push(c); });
      req.on('end', () => ok(Buffer.concat(parts).toString('utf8'))); req.on('error', no);
    });
  }
  if (raw.length > limit) throw httpErr(413, "Ma'lumot juda katta");
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { throw httpErr(400, "Noto'g'ri JSON"); }
}
export function httpErr(status, msg) { const e = new Error(msg); e.status = status; return e; }
export function query(req) { if (req.query) return req.query; const u = new URL(req.url, 'http://x'); return Object.fromEntries(u.searchParams); }
export function clientIp(req) { const h = req.headers || {}; const xf = String(h['x-forwarded-for'] || '').split(',')[0].trim(); return xf || String(h['x-real-ip'] || '') || (req.socket && req.socket.remoteAddress) || '0'; }

// ---------- base64url va sessiya tokeni (HS256 JWT) ----------
const b64u = (buf) => Buffer.from(buf).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
const unb64u = (s) => Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
// SESSION_SECRET berilmagan bo'lsa — bot tokenidan hosil qilinadi (egasi uchun bitta qadam kamroq); ikkalasi ham bo'lmasa — kirish o'chiq
export function sessionSecret() {
  const s = env('SESSION_SECRET'); if (s) return s;
  const bt = env('TELEGRAM_BOT_TOKEN'); return bt ? crypto.createHmac('sha256', 'safar-session-v1').update(bt).digest('hex') : '';
}
export function signToken(payload, secret, days = SESSION_DAYS) {
  const now = Math.floor(Date.now() / 1000), body = Object.assign({}, payload, { iat: now, exp: now + days * 86400 });
  const head = b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT' })), data = head + '.' + b64u(JSON.stringify(body));
  return data + '.' + b64u(crypto.createHmac('sha256', secret).update(data).digest());
}
export function verifyToken(token, secret) {
  if (!token || !secret || typeof token !== 'string' || token.length > 2048) return null;
  const p = token.split('.'); if (p.length !== 3) return null;
  let head; try { head = JSON.parse(unb64u(p[0]).toString('utf8')); } catch { return null; }
  if (!head || head.alg !== 'HS256') return null;
  const want = crypto.createHmac('sha256', secret).update(p[0] + '.' + p[1]).digest(), got = unb64u(p[2]);
  if (got.length !== want.length || !crypto.timingSafeEqual(got, want)) return null;
  let body; try { body = JSON.parse(unb64u(p[1]).toString('utf8')); } catch { return null; }
  if (!body || typeof body.exp !== 'number' || body.exp < Date.now() / 1000 || !body.sub) return null;
  return body;
}
// So'rovdagi sessiya (Authorization: Bearer <token>) — foydalanuvchi yoki null
export function authUser(req) { const h = String((req.headers || {}).authorization || ''); const m = /^Bearer\s+(.+)$/i.exec(h); return m ? verifyToken(m[1].trim(), sessionSecret()) : null; }

// ---------- Telegram Login Widget imzosi ----------
// https://core.telegram.org/widgets/login#checking-authorization : hash = HMAC_SHA256(data_check_string, SHA256(bot_token))
export const TG_MAX_AGE = 86400; // imzo 1 sutkadan eski bo'lsa — qabul qilinmaydi
export function checkTelegram(data, botToken, nowSec = Math.floor(Date.now() / 1000)) {
  if (!data || typeof data !== 'object' || !botToken) return { ok: false, error: "Ma'lumot yo'q" };
  const hash = String(data.hash || '');
  if (!/^[0-9a-f]{64}$/i.test(hash)) return { ok: false, error: 'Imzo yo\'q' };
  const keys = Object.keys(data).filter((k) => k !== 'hash' && data[k] != null && data[k] !== '').sort();
  if (keys.length > 12 || keys.some((k) => !/^[a-z_]{1,24}$/.test(k))) return { ok: false, error: "Noto'g'ri maydonlar" };
  const dcs = keys.map((k) => `${k}=${data[k]}`).join('\n');
  const secret = crypto.createHash('sha256').update(botToken).digest();
  const want = crypto.createHmac('sha256', secret).update(dcs).digest(), got = Buffer.from(hash, 'hex');
  if (!crypto.timingSafeEqual(got, want)) return { ok: false, error: "Imzo noto'g'ri" };
  const ad = Number(data.auth_date);
  if (!Number.isFinite(ad) || nowSec - ad > TG_MAX_AGE || ad - nowSec > 300) return { ok: false, error: 'Kirish muddati o\'tgan — qaytadan kiring' };
  if (!/^\d{1,16}$/.test(String(data.id))) return { ok: false, error: "Noto'g'ri foydalanuvchi" };
  return { ok: true };
}
// Ko'rinadigan ism: boshqaruv belgilari va ortiqcha bo'shliqlarsiz, 32 belgigacha
export const cleanName = (s) => String(s || '').replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 32);

// ---------- Upstash Redis (REST) ----------
// Vercel → Storage → Upstash ulanganda KV_REST_API_URL / KV_REST_API_TOKEN beriladi; to'g'ridan-to'g'ri Upstash'da UPSTASH_REDIS_REST_URL / _TOKEN
export function redisCfg() {
  const url = env('KV_REST_API_URL') || env('UPSTASH_REDIS_REST_URL'), token = env('KV_REST_API_TOKEN') || env('UPSTASH_REDIS_REST_TOKEN');
  return url && token ? { url: url.replace(/\/+$/, ''), token } : null;
}
// redis(['GET','k']) — bitta buyruq natijasi; redis(['A'],['B']) — bir nechta (pipeline), natijalar massivi
export async function redis(...cmds) {
  const c = redisCfg(); if (!c) throw httpErr(503, 'Bulutli saqlash ulanmagan');
  const one = cmds.length === 1;
  const r = await fetch(one ? c.url : c.url + '/pipeline', { method: 'POST', headers: { Authorization: 'Bearer ' + c.token, 'Content-Type': 'application/json' }, body: JSON.stringify(one ? cmds[0] : cmds) });
  let j; try { j = await r.json(); } catch { j = null; }
  if (!r.ok || !j) throw httpErr(502, 'Bulut javob bermadi');
  if (one) { if (j.error) throw httpErr(502, 'Bulut xatosi'); return j.result; }
  return j.map((x) => (x && !x.error ? x.result : null));
}
// Har doim massiv qaytaradi (buyruqlar soni 1 bo'lsa ham)
export const pipe = async (cmds) => (cmds.length === 1 ? [await redis(cmds[0])] : redis(...cmds));
// Oddiy tezlik cheklovi: oynada (soniya) ko'pi bilan max so'rov. Redis yo'q yoki xato bo'lsa — cheklamaydi (o'yin to'xtamasin)
export async function rateLimit(key, max, windowSec) {
  if (!redisCfg()) return true;
  try { const k = 'rl:' + key + ':' + Math.floor(Date.now() / 1000 / windowSec); const [n] = await redis(['INCR', k], ['EXPIRE', k, windowSec + 5]); return n <= max; } catch { return true; }
}
// Saqlovdan reyting ko'rsatkichlari (server o'zi hisoblaydi — mijozga ishonmaydi)
export function saveMeta(s) {
  let stars = 0; if (s.stars && typeof s.stars === 'object') for (const k in s.stars) { const v = Number(s.stars[k]); if (v > 0) stars += Math.min(3, Math.floor(v)); }
  const xp = Math.max(0, Math.min(1e8, Number(s.xp) || 0));
  return { money: Math.max(0, Math.round(Number(s.money) || 0)), stars: Math.min(stars, 300), xp: Math.round(xp), level: Math.min(7, Math.floor(Math.sqrt(xp / 220)) + 1), time: Math.round(Number(s.stats && s.stats.time) || 0) };
}
// Umumiy ishlov: xatolarni JSON qilib qaytaradi
export const wrap = (fn) => async (req, res) => { try { await fn(req, res); } catch (e) { if (!res.headersSent) fail(res, e.status || 500, e.status ? e.message : 'Server xatosi'); if (!e.status) console.error(e); } };
