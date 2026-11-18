// /api/save — bulutli saqlov (har Telegram foydalanuvchisiga bitta).
//   GET  → { save: {...} | null, meta: {money, stars, level, xp, time, t} | null }
//   PUT  { save: {...} } → { meta } ; saqlov "safar_save_v2" formatida (v: 2), 200 KB gacha
// Saqlanganda umumiy reytinglar (yulduzlar, daraja) ham yangilanadi — qiymatlarni server saqlovning o'zidan hisoblaydi.
import { send, fail, readBody, authUser, redis, redisCfg, rateLimit, saveMeta, SAVE_MAX, wrap } from './_lib.js';

export default wrap(async (req, res) => {
  const u = authUser(req); if (!u) return fail(res, 401, 'Avval Telegram orqali kiring');
  if (!redisCfg()) return fail(res, 503, 'Bulutli saqlash hali ulanmagan');
  const id = u.sub;
  if (req.method === 'GET') {
    const [s, m] = await redis(['GET', 'save:' + id], ['GET', 'savemeta:' + id]);
    let save = null, meta = null; try { save = s ? JSON.parse(s) : null; meta = m ? JSON.parse(m) : null; } catch { save = null; }
    return send(res, 200, { ok: true, save, meta: save ? meta || saveMeta(save) : null });
  }
  if (req.method !== 'PUT' && req.method !== 'POST') return fail(res, 405, 'Faqat GET yoki PUT');
  if (!(await rateLimit('save:' + id, 20, 60))) return fail(res, 429, 'Juda tez-tez saqlanyapti');
  const body = await readBody(req, SAVE_MAX + 1024), s = body && body.save;
  if (!s || typeof s !== 'object' || Array.isArray(s) || s.v !== 2 || typeof s.money !== 'number') return fail(res, 400, "Saqlov formati noto'g'ri");
  const json = JSON.stringify(s); if (json.length > SAVE_MAX) return fail(res, 413, 'Saqlov juda katta');
  const meta = Object.assign(saveMeta(s), { t: Date.now() });
  await redis(['SET', 'save:' + id, json], ['SET', 'savemeta:' + id, JSON.stringify(meta)], ['ZADD', 'top:stars', meta.stars, id], ['ZADD', 'top:level', meta.xp, id], ['HSET', 'names', id, u.name]);
  send(res, 200, { ok: true, meta });
});
