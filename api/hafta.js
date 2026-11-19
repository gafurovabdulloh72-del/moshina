// /api/hafta — haftalik chellenj va hafta statistikasi reytingi.
//   GET  ?t=ch | money | km | jobs | wins  [&w=<hafta raqami>]  → { w, ch, kind, asc, rows: [{rank, name, value, me}], me }  (eng yaxshi 20 ta)
//   POST { w, ch: natija | null, s: { money, km, jobs, wins } } (sessiya bilan) → har ko'rsatkich bo'yicha eng yaxshisi saqlanadi
// Haftaning chellenji va uning turi serverda hisoblanadi (src/haftalik.js) — mijoz yuborgan id/tur qabul qilinmaydi. Faqat joriy (±1) hafta;
// ko'rsatkichlar "hafta boshidan o'tgan real vaqt × o'sish + zaxira" chegarasi bilan qirqiladi, chellenj natijasi aqlga sig'maydigan bo'lsa — rad etiladi.
import { send, fail, readBody, authUser, redis, pipe, redisCfg, rateLimit, query, clientIp, wrap } from './_lib.js';
import { weekIndexUTC, weekStartMs, weeklyId, weeklyKind, CH_LIM, STATS, statCap } from '../src/haftalik.js';

const TTL = 45 * 86400; // hafta jadvallari 45 kundan keyin o'chadi
const TYPES = ['ch'].concat(STATS.map((s) => s[0]));
const key = (w, t) => 'hw:' + w + ':' + t;
// joriy hafta (yoki undan bitta oldingi/keyingi — soat mintaqasi farqi)
const weekOk = (w) => Number.isInteger(w) && Math.abs(w - weekIndexUTC()) <= 1;

export default wrap(async (req, res) => {
  if (!redisCfg()) return fail(res, 503, 'Reyting hali ulanmagan');
  if (req.method === 'GET') {
    if (!(await rateLimit('hwg:' + clientIp(req), 120, 60))) return fail(res, 429, "Juda ko'p so'rov");
    const q = query(req), t = String(q.t || 'ch'), w = q.w == null || q.w === '' ? weekIndexUTC() : Number(q.w);
    if (!TYPES.includes(t)) return fail(res, 404, "Bunday reyting yo'q");
    if (!weekOk(w)) return fail(res, 400, 'Faqat joriy hafta reytingi');
    const kind = weeklyKind(w), asc = t === 'ch' && CH_LIM[kind][2], k = key(w, t), u = authUser(req);
    const cmds = [asc ? ['ZRANGE', k, 0, 19, 'WITHSCORES'] : ['ZREVRANGE', k, 0, 19, 'WITHSCORES']];
    if (u) cmds.push([asc ? 'ZRANK' : 'ZREVRANK', k, u.sub], ['ZSCORE', k, u.sub]);
    const out = await pipe(cmds), flat = out[0] || [], ids = [], vals = [];
    for (let i = 0; i < flat.length; i += 2) { ids.push(String(flat[i])); vals.push(Number(flat[i + 1])); }
    const names = ids.length ? (await redis(['HMGET', 'names', ...ids])) || [] : [];
    const rows = ids.map((x, i) => ({ rank: i + 1, name: names[i] || 'Sayyoh', value: vals[i], me: !!u && x === u.sub }));
    const me = u && out[1] != null ? { rank: Number(out[1]) + 1, value: Number(out[2]) } : null;
    return send(res, 200, { ok: true, w, t, ch: weeklyId(w), kind, asc, rows, me });
  }
  if (req.method !== 'POST') return fail(res, 405, 'Faqat GET yoki POST');
  const u = authUser(req); if (!u) return fail(res, 401, 'Avval Telegram orqali kiring');
  if (!(await rateLimit('hwp:' + u.sub, 20, 60))) return fail(res, 429, "Juda ko'p natija");
  const body = (await readBody(req, 4096)) || {}, w = Number(body.w);
  if (!weekOk(w)) return fail(res, 400, 'Hafta mos emas');
  const cmds = [], acc = {};
  // chellenj natijasi
  if (body.ch != null) {
    const kind = weeklyKind(w), [lo, hi, asc] = CH_LIM[kind], v = Number(body.ch);
    if (Number.isFinite(v) && v >= lo && v <= hi) { const sc = kind === 'race' ? +v.toFixed(2) : Math.round(v); cmds.push(['ZADD', key(w, 'ch'), asc ? 'LT' : 'GT', sc, u.sub]); acc.ch = sc; }
  }
  // ko'rsatkichlar: hafta boshidan (14 soat zaxira — sharqdagi soat mintaqalari uchun) o'tgan real vaqtga qarab qirqiladi
  const secs = (Date.now() - weekStartMs(w) + 14 * 3600e3) / 1000, s = body.s && typeof body.s === 'object' ? body.s : {};
  for (const [k] of STATS) {
    const v = Math.floor(Number(s[k])); if (!Number.isFinite(v) || v <= 0) continue;
    const nv = Math.min(v, statCap(k, secs)); if (nv <= 0) continue;
    cmds.push(['ZADD', key(w, k), 'GT', nv, u.sub]); acc[k] = nv;
  }
  if (cmds.length) { for (const t of TYPES) if (acc[t] != null) cmds.push(['EXPIRE', key(w, t), TTL]); cmds.push(['HSET', 'names', u.sub, u.name]); await redis(...cmds); }
  send(res, 200, { ok: true, w, accepted: acc });
});
