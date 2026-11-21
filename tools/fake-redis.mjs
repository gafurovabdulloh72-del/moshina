// Sinov uchun xotiradagi soxta Upstash Redis (REST): POST / [buyruq] va POST /pipeline [[...]] — api/ funksiyalari ishlatadigan buyruqlargina.
// Ishlatish: const r = await startFakeRedis(); process.env.KV_REST_API_URL = r.url; process.env.KV_REST_API_TOKEN = r.token; ... await r.close();
import http from 'node:http';

export async function startFakeRedis({ token = 'fake-token', port = 0 } = {}) {
  const kv = new Map(), zs = new Map(), hs = new Map(); const log = [];
  const Z = (k) => zs.get(k) || (zs.set(k, new Map()), zs.get(k)), H = (k) => hs.get(k) || (hs.set(k, new Map()), hs.get(k));
  const sorted = (k) => [...(zs.get(k) || new Map())].sort((a, b) => a[1] - b[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  const range = (arr, a, b) => { const n = arr.length; a = +a; b = +b; if (a < 0) a += n; if (b < 0) b += n; return arr.slice(Math.max(0, a), Math.min(n - 1, b) + 1); };
  const fmt = (list, ws) => (ws ? list.flatMap(([m, s]) => [m, String(s)]) : list.map(([m]) => m));
  function run(c) {
    const [cmd0, ...a] = c; const cmd = String(cmd0).toUpperCase(); log.push(cmd);
    switch (cmd) {
      case 'GET': return kv.has(a[0]) ? kv.get(a[0]) : null;
      case 'SET': kv.set(a[0], String(a[1])); return 'OK';
      case 'DEL': { let n = 0; for (const k of a) { if (kv.delete(k) || zs.delete(k) || hs.delete(k)) n++; } return n; }
      case 'INCR': { const v = (+(kv.get(a[0]) || 0)) + 1; kv.set(a[0], String(v)); return v; }
      case 'EXPIRE': return 1;
      case 'ZADD': { let i = 0, lt = false, gt = false; while (/^(LT|GT|NX|XX|CH)$/i.test(String(a[i + 1]))) { const f = String(a[++i]).toUpperCase(); if (f === 'LT') lt = true; if (f === 'GT') gt = true; } const z = Z(a[0]); let n = 0;
        for (i = i + 1; i < a.length; i += 2) { const s = +a[i], m = String(a[i + 1]), old = z.get(m); if (old == null) { z.set(m, s); n++; } else if ((lt && s < old) || (gt && s > old) || (!lt && !gt)) z.set(m, s); } return n; }
      case 'ZRANGE': return fmt(range(sorted(a[0]), a[1], a[2]), a.some((x) => String(x).toUpperCase() === 'WITHSCORES'));
      case 'ZREVRANGE': return fmt(range(sorted(a[0]).reverse(), a[1], a[2]), a.some((x) => String(x).toUpperCase() === 'WITHSCORES'));
      case 'ZRANK': { const i = sorted(a[0]).findIndex(([m]) => m === String(a[1])); return i < 0 ? null : i; }
      case 'ZREVRANK': { const i = sorted(a[0]).reverse().findIndex(([m]) => m === String(a[1])); return i < 0 ? null : i; }
      case 'ZSCORE': { const z = zs.get(a[0]); return z && z.has(String(a[1])) ? String(z.get(String(a[1]))) : null; }
      case 'HSET': { const h = H(a[0]); let n = 0; for (let i = 1; i < a.length; i += 2) { if (!h.has(String(a[i]))) n++; h.set(String(a[i]), String(a[i + 1])); } return n; }
      case 'HSETNX': { const h = H(a[0]); if (h.has(String(a[1]))) return 0; h.set(String(a[1]), String(a[2])); return 1; }
      case 'HGET': { const h = hs.get(a[0]); return h && h.has(String(a[1])) ? h.get(String(a[1])) : null; }
      case 'HMGET': { const h = hs.get(a[0]); return a.slice(1).map((f) => (h && h.has(String(f)) ? h.get(String(f)) : null)); }
      default: throw new Error('ERR unknown command ' + cmd);
    }
  }
  const srv = http.createServer((req, res) => {
    let body = ''; req.on('data', (c) => (body += c)); req.on('end', () => {
      res.setHeader('Content-Type', 'application/json');
      if (req.headers.authorization !== 'Bearer ' + token) { res.statusCode = 401; return res.end(JSON.stringify({ error: 'Unauthorized' })); }
      let j; try { j = JSON.parse(body); } catch { res.statusCode = 400; return res.end('{"error":"bad json"}'); }
      const one = (c) => { try { return { result: run(c) }; } catch (e) { return { error: e.message }; } };
      res.end(JSON.stringify(req.url.startsWith('/pipeline') ? j.map(one) : one(j)));
    });
  });
  await new Promise((ok) => srv.listen(port, '127.0.0.1', ok));
  const url = `http://127.0.0.1:${srv.address().port}`;
  return { url, token, kv, zs, hs, log, close: () => new Promise((ok) => srv.close(ok)) };
}
