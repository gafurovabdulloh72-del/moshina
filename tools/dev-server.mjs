// Mahalliy "Vercel": dist/vercel/ ni statik beradi, /api/* so'rovlarini api/*.js funksiyalariga yo'naltiradi.
// Muhit berilmagan bo'lsa sinov qiymatlari qo'yiladi: soxta Redis (xotirada), sinov bot tokeni va mahalliy PeerJS brokeri (npm "peer").
// Ishlatish: node tools/dev-server.mjs [--port 8787] [--peer 9000]    (avval: npm run build)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { startFakeRedis } from './fake-redis.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const TEST_BOT_TOKEN = '1234567:TEST-safar-bot-token';
const MIME = { '.html': 'text/html; charset=utf-8', '.jpg': 'image/jpeg', '.json': 'application/json', '.txt': 'text/plain; charset=utf-8', '.js': 'text/javascript' };

export async function startDev({ port = 8787, peerPort = 9000, quiet = false } = {}) {
  const stop = [];
  if (!process.env.KV_REST_API_URL && !process.env.UPSTASH_REDIS_REST_URL) { const r = await startFakeRedis(); process.env.KV_REST_API_URL = r.url; process.env.KV_REST_API_TOKEN = r.token; stop.push(r.close); }
  if (!process.env.TELEGRAM_BOT_TOKEN) { process.env.TELEGRAM_BOT_TOKEN = TEST_BOT_TOKEN; process.env.TELEGRAM_BOT_USERNAME = process.env.TELEGRAM_BOT_USERNAME || 'safar_sinov_bot'; }
  if (!process.env.SESSION_SECRET) process.env.SESSION_SECRET = 'dev-session-secret';
  if (peerPort && !process.env.PEER_HOST) {
    const { PeerServer } = await import('peer');
    const ps = PeerServer({ port: peerPort, path: '/', allow_discovery: false });
    await new Promise((ok) => setTimeout(ok, 200));
    Object.assign(process.env, { PEER_HOST: '127.0.0.1', PEER_PORT: String(peerPort), PEER_PATH: '/', PEER_SECURE: '0' });
    stop.push(() => new Promise((ok) => { try { ps._server ? ps._server.close(ok) : ps.close ? ps.close(ok) : ok(); } catch { ok(); } setTimeout(ok, 300); }));
  }
  const fnCache = {};
  const srv = http.createServer(async (req, res) => {
    const u = new URL(req.url, 'http://x');
    if (u.pathname.startsWith('/api/')) {
      const name = u.pathname.slice(5).replace(/\/$/, '');
      if (!/^[a-z]+$/.test(name) || !fs.existsSync(path.join(root, 'api', name + '.js'))) { res.statusCode = 404; return res.end('{"ok":false}'); }
      try { const fn = fnCache[name] || (fnCache[name] = (await import(pathToFileURL(path.join(root, 'api', name + '.js')).href)).default); req.query = Object.fromEntries(u.searchParams); await fn(req, res); }
      catch (e) { console.error(e); if (!res.headersSent) { res.statusCode = 500; res.end('{"ok":false}'); } }
      if (!quiet) console.log(req.method, u.pathname, res.statusCode);
      return;
    }
    let f = path.join(root, 'dist/vercel', decodeURIComponent(u.pathname));
    if (u.pathname === '/' || !path.extname(f)) f = path.join(root, 'dist/vercel/index.html');
    if (!f.startsWith(path.join(root, 'dist/vercel')) || !fs.existsSync(f)) { res.statusCode = 404; return res.end('topilmadi'); }
    res.setHeader('Content-Type', MIME[path.extname(f)] || 'application/octet-stream'); fs.createReadStream(f).pipe(res);
  });
  await new Promise((ok) => srv.listen(port, '127.0.0.1', ok));
  const url = `http://127.0.0.1:${srv.address().port}`;
  if (!quiet) console.log('dev server', url, 'peer', process.env.PEER_HOST + ':' + process.env.PEER_PORT);
  return { url, close: async () => { await new Promise((ok) => srv.close(ok)); for (const s of stop) await s(); } };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const a = process.argv.slice(2), g = (n, d) => { const i = a.indexOf('--' + n); return i >= 0 ? +a[i + 1] : d; };
  await startDev({ port: g('port', 8787), peerPort: g('peer', 9000) });
}
