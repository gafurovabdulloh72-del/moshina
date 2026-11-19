// Haftalik chellenj va hafta statistikasining umumiy (sof) hisoblari: hafta raqami, haftaning chellenji, ko'rsatkichlar chegaralari — o'yin (hafta.js) ham, server (api/hafta.js) ham shundan foydalanadi
import { actKinds, weeklyPool } from './acts.js';

export const WEEK_MS = 604800000, DAY_MS = 86400000;
const EPOCH = Date.UTC(1970, 0, 5); // dushanba — 0-hafta boshi
// Mahalliy sana bo'yicha hafta raqami (hafta dushanba 00:00 da almashadi) — internetsiz ham hamma do'stda bir xil
export const weekIndex = (d = new Date()) => Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - EPOCH) / WEEK_MS);
// Server: UTC vaqt bo'yicha (o'yinchi soat mintaqasi farqi uchun ±1 hafta qabul qilinadi)
export const weekIndexUTC = (ms = Date.now()) => Math.floor((ms - EPOCH) / WEEK_MS);
export const weekStartMs = (wi) => EPOCH + wi * WEEK_MS; // dushanba 00:00 (UTC)
// ISO hafta raqami va sanalar: { n: 47, y: 2026, from: '16.11', to: '22.11' }
export function weekLabel(wi) {
  const m = weekStartMs(wi), th = new Date(m + 3 * DAY_MS), y = th.getUTCFullYear(), n = Math.floor((th - Date.UTC(y, 0, 1)) / DAY_MS / 7) + 1;
  const dd = (t) => { const d = new Date(t); return `${String(d.getUTCDate()).padStart(2, '0')}.${String(d.getUTCMonth() + 1).padStart(2, '0')}`; };
  return { n, y, from: dd(m), to: dd(m + 6 * DAY_MS) };
}
// Haftaning chellenji: hovuzdagi o'rni hafta raqamidan (o'zaro tub qadam bilan aylanadi — hammasi navbat bilan keladi, ketma-ket ikki hafta bir xil bo'lmaydi)
export function weeklyId(wi) {
  const P = weeklyPool(), n = P.length, gcd = (a, b) => (b ? gcd(b, a % b) : a), step = [7, 11, 13, 3, 1].find((k) => gcd(k, n) === 1);
  return P[(((wi * step + 5) % n) + n) % n];
}
const KINDS = actKinds();
export const weeklyKind = (wi) => KINDS[weeklyId(wi)]; // 'race' | 'drift' | 'smash'
// natija chegaralari: [eng kichik, eng katta, kamaygani yaxshimi]
export const CH_LIM = { race: [20, 7200, true], drift: [1, 300000, false], smash: [1, 1000, false] };
// Hafta ko'rsatkichlari: [kalit, belgi, nomi, reyting sarlavhasi, eng katta qiymat, real soniyadagi o'sish chegarasi, boshlang'ich zaxira]
// Server qiymatni "haftaning boshidan o'tgan real vaqt × o'sish + zaxira" bilan cheklaydi (aqlga sig'maydigan sakrash qabul qilinmaydi)
export const STATS = [
  ['money', '💰', 'Topilgan pul', "Kim ko'p pul topdi", 5e6, 60, 8000],
  ['km', '🛣', "Bosilgan yo'l", "Kim ko'p yo'l bosdi", 2e7, 100, 5000], // metrda
  ['jobs', '💼', 'Bajarilgan ishlar', "Kim ko'p ish bajardi", 3000, 1 / 15, 3],
  ['wins', '🏁', "Poyga g'alabalari", "Kim ko'p poyga yutdi", 3000, 1 / 20, 3],
];
export const statCap = (k, secs) => { const s = STATS.find((q) => q[0] === k); return s ? Math.min(s[4], Math.floor(s[5] * Math.max(0, secs) + s[6])) : 0; };
