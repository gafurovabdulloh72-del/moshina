// GET /api/config — o'yinga onlayn sozlamalar: Telegram bot nomi (kirish tugmasi uchun), bulut/reyting bormi, PeerJS brokeri va ICE (STUN/TURN) serverlari.
// Sir (token) qaytarilmaydi. Hech narsa sozlanmagan bo'lsa ham javob beradi — o'yin nima ishlamasligini shu yerdan biladi.
import { env, send, redisCfg, sessionSecret, wrap } from './_lib.js';

const STUN = ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302', 'stun:stun.cloudflare.com:3478', 'stun:global.stun.twilio.com:3478'];

export default wrap(async (req, res) => {
  const bot = env('TELEGRAM_BOT_USERNAME').replace(/^@/, '');
  const ice = [{ urls: STUN }];
  const turn = env('TURN_URLS'); // ixtiyoriy: "turn:host:3478,turns:host:5349" + TURN_USERNAME / TURN_CREDENTIAL
  if (turn) ice.push({ urls: turn.split(',').map((s) => s.trim()).filter(Boolean), username: env('TURN_USERNAME'), credential: env('TURN_CREDENTIAL') });
  let peer = null; // bo'sh — PeerJS'ning bepul ommaviy brokeri (0.peerjs.com)
  if (env('PEER_HOST')) peer = { host: env('PEER_HOST'), port: +env('PEER_PORT') || 443, path: env('PEER_PATH') || '/', secure: env('PEER_SECURE') !== '0', key: env('PEER_KEY') || 'peerjs' };
  const login = !!(bot && env('TELEGRAM_BOT_TOKEN') && sessionSecret()), cloud = !!redisCfg(), pass = !!(cloud && sessionSecret()); // pass — ism-parol akkaunti (bot shart emas)
  send(res, 200, { ok: true, v: 1, bot: bot || null, login, pass, save: cloud && (login || pass), top: cloud, peer, ice });
});
