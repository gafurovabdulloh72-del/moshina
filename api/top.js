// /api/top — reyting.
//   GET  ?id=stars | level | <chellenj id>   → { rows: [{rank, name, value, me}], me: {rank, value} | null }  (eng yaxshi 20 ta)
//   POST { results: [{ id, value }] } (sessiya bilan) → har chellenj bo'yicha eng yaxshi natija saqlanadi
// Chellenj turi va chegaralar serverda (mijoz yuborgan tur qabul qilinmaydi): poyga — vaqt (kam = yaxshi), qolganlari — ko'p = yaxshi.
import { send, fail, readBody, authUser, redis, pipe, redisCfg, rateLimit, query, clientIp, wrap } from './_lib.js';
import { actKinds } from '../src/acts.js';

const KINDS = actKinds();
// tur: [eng kichik, eng katta, kamaygani yaxshimi]
const LIM = { race: [20, 7200, true], drift: [1, 300000, false], smash: [1, 1000, false], radar: [1, 450, false], jump: [1, 800, false] };
export const kindOf = (id) => KINDS[id] || (/^rad(\d{1,2}|_run)$/.test(id) ? 'radar' : /^jmp\d{1,2}$/.test(id) ? 'jump' : null);

export default wrap(async (req, res) => {
  if (!redisCfg()) return fail(res, 503, 'Reyting hali ulanmagan');
  if (req.method === 'GET') {
    if (!(await rateLimit('topg:' + clientIp(req), 120, 60))) return fail(res, 429, "Juda ko'p so'rov");
    const id = String(query(req).id || 'stars'), kind = id === 'stars' || id === 'level' ? id : kindOf(id);
    if (!kind) return fail(res, 404, 'Bunday reyting yo\'q');
    const key = kind === 'stars' || kind === 'level' ? 'top:' + kind : 'top:act:' + id, asc = !!(LIM[kind] && LIM[kind][2]);
    const u = authUser(req);
    const cmds = [asc ? ['ZRANGE', key, 0, 19, 'WITHSCORES'] : ['ZREVRANGE', key, 0, 19, 'WITHSCORES']];
    if (u) cmds.push([asc ? 'ZRANK' : 'ZREVRANK', key, u.sub], ['ZSCORE', key, u.sub]);
    const out = await pipe(cmds), flat = out[0] || [], ids = [], vals = [];
    for (let i = 0; i < flat.length; i += 2) { ids.push(String(flat[i])); vals.push(Number(flat[i + 1])); }
    const names = ids.length ? (await redis(['HMGET', 'names', ...ids])) || [] : [];
    const conv = (v) => (kind === 'level' ? Math.min(7, Math.floor(Math.sqrt(v / 220)) + 1) : v);
    const rows = ids.map((x, i) => ({ rank: i + 1, name: names[i] || 'Sayyoh', value: conv(vals[i]), me: !!u && x === u.sub }));
    const me = u && out[1] != null ? { rank: Number(out[1]) + 1, value: conv(Number(out[2])) } : null;
    return send(res, 200, { ok: true, id, kind, asc, rows, me });
  }
  if (req.method !== 'POST') return fail(res, 405, 'Faqat GET yoki POST');
  const u = authUser(req); if (!u) return fail(res, 401, 'Avval Telegram orqali kiring');
  if (!(await rateLimit('topp:' + u.sub, 30, 60))) return fail(res, 429, "Juda ko'p natija");
  const body = await readBody(req, 16384), list = Array.isArray(body && body.results) ? body.results.slice(0, 120) : [];
  const cmds = [], acc = [];
  for (const r of list) {
    const id = String((r && r.id) || ''), kind = kindOf(id), v = Number(r && r.value);
    if (!kind || !Number.isFinite(v)) continue;
    const [lo, hi, asc] = LIM[kind]; if (v < lo || v > hi) continue; // aqlga sig'maydigan natija — rad etiladi
    cmds.push(['ZADD', 'top:act:' + id, asc ? 'LT' : 'GT', kind === 'race' ? +v.toFixed(2) : Math.round(v), u.sub]); acc.push(id);
  }
  if (cmds.length) { cmds.push(['HSET', 'names', u.sub, u.name]); await redis(...cmds); }
  send(res, 200, { ok: true, accepted: acc });
});
