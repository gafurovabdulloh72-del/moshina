// Chellenjlar ta'rifi: buyurtmalar, poygalar, zonalar, radarlar, tramplinlar
import * as T from './terrain.js';
import { mulberry32, clamp } from './util.js';
import * as COL from './colliders.js';

// [joy, tur, nom, tavsif, nishon, mukofot, qo'shimcha]
// tur: del (yetkazish), frag (mo'rt yuk), taxi (yo'lovchi), col (yig'ish), multi (bir necha manzil)
const JOBS = [
  ['bogiston', 'del', "Tegirmonga bug'doy", "Tegirmonchi kutyapti: 6 qop bug'doyni Shamol tegirmonlariga eltib bering.", 'tegirmon', 350],
  ['bogiston', 'col', "Qochgan qo'ylar", "Cho'ponning qo'ylari tarqab ketibdi. Qishloq atrofidan 8 tasini toping.", { n: 8, r: 300, icon: 'sheep' }, 450],
  ['bogiston', 'taxi', 'Mayoqqa sayohat', "Mehmonni Mayoq burniga olib boring. U chayqalishni yoqtirmaydi — ohista haydang!", 'mayoq', 600],
  ['mayoq', 'del', 'Baliqchilarga xat', "Mayoqchining shoshilinch xatini sohil yo'li orqali Bandargohga yetkazing.", 'bandargoh', 500],
  ['mayoq', 'frag', 'Shisha linza', "Mayoqning eski linzasini Oltin o'rmondagi ustaga eltish kerak. Sindirmang!", 'ormon', 750],
  ['mayoq', 'col', "Sohil chig'anoqlari", "Burun atrofidagi sohildan 10 ta noyob chig'anoq yig'ing.", { n: 10, r: 330, icon: 'shell' }, 500],
  ['bandargoh', 'del', 'Yangi baliq', "Baliq aynimasidan Bog'iston bozoriga yetkazing — vaqt ziq!", 'bogiston', 500, { tight: 0.82 }],
  ['bandargoh', 'taxi', "Baliqchi ko'lga otlandi", "Keksa baliqchini Ko'zgu ko'lga olib boring. Yo'l uzoq, bel og'riydi — silkitmang.", 'kol', 1100],
  ['bandargoh', 'multi', 'Tezkor pochta', "Uchta manzilga posilka: Bog'iston, Tegirmon va Mayoq. Ketma-ket yetkazing.", ['bogiston', 'tegirmon', 'mayoq'], 1000],
  ['ormon', 'del', "Lagerga o'tin", "Qorli lagerda o'tin tugabdi. Dovondan oshib, o'tin yetkazing.", 'lager', 800],
  ['ormon', 'col', "Qo'ziqorin terimi", "Kuzgi o'rmondan 10 ta oq qo'ziqorin toping. Daraxtlar orasida ehtiyot bo'ling.", { n: 10, r: 320, icon: 'mush' }, 550],
  ['ormon', 'frag', 'Portlovchi yuk', "Karyer uchun dinamit. Qattiq urilsa... yaxshisi urilmang.", 'karyer', 700],
  ['kol', 'taxi', 'Sokin sayr', "Rassom ayolni Oltin o'rmonga olib boring. U yo'lda rasm chizmoqchi.", 'ormon', 700],
  ['kol', 'col', "Yo'qolgan eshkaklar", "Bo'ron eshkaklarni qirg'oqqa sochib yuboribdi. 8 tasini toping.", { n: 8, r: 340, icon: 'oar' }, 500],
  ['kol', 'frag', 'Teleskop linzasi', "Rasadxona uchun linza — cho'qqigacha butun yetkazing. Uzoq va tik yo'l!", 'choqqi', 1500],
  ['lager', 'frag', 'Issiq choy', "Rasadxonadagi olimlarga termosda choy. To'kilmasin!", 'choqqi', 900],
  ['lager', 'col', 'Tungi qutqaruv', "Besh sayyoh qorda adashibdi. Signal chiroqlarini topib, ularni qutqaring.", { n: 5, r: 380, icon: 'flare', hour: 22.5 }, 800],
  ['lager', 'del', "Tog'dan cho'lga", "Dori-darmonni Karvonsaroyga tez yetkazing.", 'karvon', 700, { tight: 0.85 }],
  ['choqqi', 'del', 'Pastga xabar', "Bo'ron yaqinlashmoqda! Lagerni ogohlantiring — imkon qadar tez tushing.", 'lager', 800, { tight: 0.8 }],
  ['choqqi', 'taxi', 'Olimni kuzatish', "Professorni Bog'istonga olib boring. Uning qo'lida nozik asbob bor.", 'bogiston', 1600],
  ['choqqi', 'col', 'Meteorit parchalari', "Kechagi meteorit yomg'iridan 8 ta parcha qor ustida yotibdi.", { n: 8, r: 420, icon: 'rock' }, 800],
  ['karvon', 'del', "Karvon yo'li", "Gilamlarni Qizil daradagi qorovulxonaga yetkazing.", 'dara', 500],
  ['karvon', 'col', 'Qum ostidagi tangalar', "Qadimiy karvon tangalari barxanlar orasida. 12 tasini toping.", { n: 12, r: 420, icon: 'coin' }, 700],
  ['karvon', 'frag', 'Olimlar asbobi', "Seysmografni Olovtog' krateriga olib chiqing. Juda nozik!", 'vulqon', 1300],
  ['dara', 'del', 'Ehtiyot qismlar', "Samolyot ehtiyot qismlarini Eski aerodromga eltib bering.", 'aerodrom', 500],
  ['dara', 'taxi', 'Sayyohlar', "Sayyohlarni Karvonsaroyga olib boring — yo'lda manzarani tomosha qilishsin.", 'karvon', 800],
  ['dara', 'col', 'Oltin izlovchi', "Dara bo'ylab 9 ta oltin parchasi sochilgan.", { n: 9, r: 340, icon: 'gold' }, 650],
  ['aerodrom', 'del', 'Havo pochtasi', "Xatlarni Ko'hna qal'aga yetkazing.", 'qala', 400],
  ['aerodrom', 'frag', "Uchuvchining sandig'i", "Eski uchuvchining sandig'ini Bandargohga eltib bering. Ichida nima borligini so'ramang.", 'bandargoh', 1300],
  ['aerodrom', 'col', "Yo'lakni tozalash", "Uchish yo'lagida 12 ta begona buyum yotibdi. Tez yig'ib oling!", { n: 12, r: 0, icon: 'crate', runway: true }, 500],
  ['qala', 'del', "Qal'a xabarchisi", "Shoshilinch xabarni Bog'istonga yetkazing!", 'bogiston', 450, { tight: 0.82 }],
  ['qala', 'col', 'Qadimiy tangalar', "Qal'a atrofida 9 ta qadimiy tanga bor.", { n: 9, r: 280, icon: 'coin' }, 500],
  ['qala', 'taxi', "Tog' sayyohi", "Sayyohni Qorli lagerga olib chiqing.", 'lager', 1300],
  ['karyer', 'frag', 'Qimmatbaho toshlar', "Toshlarni Ko'zgu ko'ldagi ustaxonaga yetkazing. Tirnalsa narxi tushadi.", 'kol', 800],
  ['karyer', 'col', "Asboblarni yig'ish", "Ishchilar asboblarini karyerga sochib ketishgan. 10 tasini yig'ing.", { n: 10, r: 110, icon: 'tool' }, 400],
  ['karyer', 'del', "Qirg'oq ta'miri", "Sementni Mayoq burniga yetkazing. Uzoq yo'l — vaqtni boy bermang.", 'mayoq', 1200],
];

// [id, joy, nom, tavsif, marshrut, mukofot]
const RACES = [
  ['r1', 'bogiston', 'Vodiy sprinti', "Bog'istondan Oltin o'rmongacha — ochiq yo'l, yuqori tezlik.", { nodes: ['vil', 'mj', 'brj', 'ormon'] }, 900],
  ['r2', 'ormon', 'Oltin halqa', "O'rmon ichidan Ko'zgu ko'lgacha.", { nodes: ['ormon', 'karj', 'kol'] }, 700],
  ['r3', 'kol', 'Dovon hujumi', "Ko'ldan Qorli lagergacha tik ko'tarilish.", { nodes: ['kol', 'lager'] }, 700],
  ['r4', 'lager', "Qordan cho'lga", "Qorli dovondan issiq cho'lga tushish.", { nodes: ['lager', 'west', 'karvon'] }, 900],
  ['r5', 'karvon', "Cho'l va dara", "Barxanlar va qizil qoyalar orasidan.", { nodes: ['karvon', 'dara', 'sw'] }, 1000],
  ['r6', 'dara', 'Uyga qaytish', "Daradan Bog'istonga.", { nodes: ['dara', 'sw', 'vil'] }, 800],
  ['r7', 'lager', "Cho'qqiga!", "Oqtog' cho'qqisigacha ilon izi yo'l. 4,5 km tik ko'tarilish.", { nodes: ['lager', 'choqqi'] }, 1500, { track: true }],
  ['r8', 'choqqi', "Qor ko'chkisi", "Cho'qqidan lagergacha — tormozni unutmang.", { nodes: ['choqqi', 'lager'] }, 1500, { track: true }],
  ['r9', 'mayoq', 'Sohil rallisi', "Mayoqdan plyaj bo'ylab Bandargohgacha.", { edges: [['e2', true], ['t2', false]] }, 1000, { track: true }],
  ['r10', 'kol', "Shimoliy qirg'oq", "Tayga va qirg'oq bo'ylab uzoq ralli.", { nodes: ['kol', 'vj', 'karvon'] }, 1800, { track: true }],
  ['r11', 'vulqon', 'Vulqondan qochish', "Kraterdan pastga — spiral yo'l.", { edges: [['t6', true]] }, 1200, { track: true }],
  ['r12', 'qala', "Aerodrom yo'li", "Qal'adan savanna orqali g'arbiy chorrahagacha.", { nodes: ['qala', 'aero', 'west'] }, 800],
  ['r13', 'bandargoh', 'Port sprinti', "Bandargohdan Bog'istongacha.", { nodes: ['bandargoh', 'sw', 'vil'] }, 700],
  ['r14', 'aerodrom', "Uchish yo'lagi", "800 metr to'g'ri yo'lak. Kim tezroq?", { runway: true }, 600],
  ['r15', 'bogiston', 'KATTA SAFAR', "Butun orol bo'ylab 14 km halqa. Faqat haqiqiy sayyohlar uchun! (10 ta muhr kerak)", { nodes: ['vil', 'mj', 'brj', 'ormon', 'karj', 'kol', 'lager', 'west', 'karvon', 'dara', 'sw', 'vil'] }, 5000, { final: true }],
];
// [id, joy, tur, nom, tavsif, chegaralar, soniya, mukofot]
const ZONES = [
  ['z1', 'muzkol', 'drift', 'Muz drifti', "Muz ustida 50 soniyada imkon qadar ko'p drift ochkosi to'plang.", [2500, 5500, 9000], 50, 700],
  ['z2', 'aerodrom', 'drift', 'Asfalt drifti', "Uchish yo'lagida drift qiling. Qo'l tormozi (Probel) yordam beradi.", [1800, 4000, 6500], 50, 700],
  ['z3', 'karyer', 'drift', 'Karyer drifti', "Shag'al ustida drift.", [1800, 4000, 6500], 50, 700],
  ['z4', 'karyer', 'smash', "Buzg'unchi", "45 soniyada imkon qadar ko'p buyumni urib sindiring.", [8, 13, 18], 45, 600],
  ['z5', 'tegirmon', 'smash', 'Pichan bayrami', "Pichan g'aramlari va to'siqlarni 45 soniyada sindiring.", [8, 13, 18], 45, 600],
  ['z6', 'aerodrom', 'smash', 'Konuslar ovi', "Yo'lak bo'ylab konus va bochkalarni urib chiqing.", [12, 20, 28], 45, 600],
];
// Radarlar: [qirra, ulush, [bronza,kumush,oltin] km/soat]
export const RADARS = [['e1', 0.58, [85, 105, 122]], ['e3', 0.3, [85, 105, 122]], ['e3b', 0.55, [85, 105, 122]], ['e4b', 0.35, [80, 100, 118]], ['e5', 0.45, [60, 78, 95]], ['e6', 0.62, [85, 108, 128]], ['e7', 0.5, [85, 105, 122]], ['e8', 0.3, [85, 105, 122]], ['e8', 0.72, [80, 100, 118]], ['e9', 0.5, [85, 105, 122]], ['e10', 0.5, [85, 105, 122]], ['e11', 0.4, [80, 100, 118]], ['e11c', 0.5, [85, 105, 122]], ['e2', 0.5, [85, 105, 122]], ['t3', 0.5, [70, 90, 108]]];
// Yo'l yoqasidagi tramplinlar: [qirra, ulush, tomon]
export const ROAD_RAMPS = [['e1', 0.7, 1], ['e3b', 0.3, -1], ['e7', 0.3, 1], ['e8', 0.5, -1], ['e9', 0.3, 1], ['e10', 0.25, -1], ['e11b', 0.5, 1], ['e4', 0.5, 1], ['t2', 0.45, -1], ['t3', 0.3, 1], ['e6', 0.85, -1], ['e12', 0.5, 1]];

// Marshrut bo'yicha taxminiy eng yaxshi vaqt (tezlik profili: burilish, tezlanish, tormoz)
export function estimateTime(pts, vmax = 33, alat = 7.5) {
  const n = pts.length; if (n < 3) return 1;
  const v = new Float64Array(n), ds = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 2)], b = pts[i], c = pts[Math.min(n - 1, i + 2)];
    const a1 = Math.atan2(b[0] - a[0], b[1] - a[1]), a2 = Math.atan2(c[0] - b[0], c[1] - b[1]); let da = Math.abs(a2 - a1); if (da > Math.PI) da = 2 * Math.PI - da;
    const L = Math.hypot(c[0] - a[0], c[1] - a[1]) / 2 || 1; const k = da / L;
    v[i] = Math.min(vmax, k > 1e-4 ? Math.sqrt(alat / k) : vmax);
    if (i > 0) ds[i] = Math.hypot(b[0] - pts[i - 1][0], b[1] - pts[i - 1][1]);
  }
  v[0] = 0.5;
  for (let i = 1; i < n; i++) { const grade = pts[i][2] != null ? (pts[i][2] - pts[i - 1][2]) / (ds[i] || 1) : 0; const acc = Math.max(0.4, 3.4 * (1 - v[i - 1] / (vmax * 1.25)) - grade * 9.8); v[i] = Math.min(v[i], Math.sqrt(v[i - 1] * v[i - 1] + 2 * acc * ds[i])); }
  for (let i = n - 2; i >= 0; i--) v[i] = Math.min(v[i], Math.sqrt(v[i + 1] * v[i + 1] + 2 * 7 * ds[i + 1]));
  let t = 0; for (let i = 1; i < n; i++) t += ds[i] / Math.max(0.5, (v[i] + v[i - 1]) / 2);
  return t;
}
export function pathLen(pts) { let l = 0; for (let i = 1; i < pts.length; i++) l += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); return l; }

function edgePoint(key, f) { const e = T.roads.edges.find((q) => q.key === key); const i = e.start + clamp(Math.round(f * (e.count - 1)), 1, e.count - 2); return { x: T.roads.x[i], z: T.roads.z[i], y: T.roads.y[i], tx: T.roads.tx[i], tz: T.roads.tz[i], hw: e.hw }; }
export { edgePoint };

// Yig'iladigan buyumlar uchun joylar
export function scatterItems(cx, cz, r, n, seed) {
  const rg = mulberry32(seed), out = [];
  for (let k = 0; k < 4000 && out.length < n; k++) {
    const a = rg() * 6.283, d = r * (0.12 + 0.88 * Math.sqrt(rg())), x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
    const si = T.siteInfo(x, z);
    if (si.y < si.water + 0.6 || si.slope > 0.3 || si.y < 1.5) continue;
    if (COL.query(x, z, 2.5).length) continue;
    let ok = true; for (const o of out) if (Math.hypot(o.x - x, o.z - z) < r * 0.16) { ok = false; break; }
    if (ok) out.push({ x, z, y: T.ground(x, z, 1e9).y });
  }
  return out;
}

export function buildActs(site) {
  const acts = [], byPlace = {};
  const add = (a) => { acts.push(a); if (a.place) (byPlace[a.place] || (byPlace[a.place] = [])).push(a); return a; };
  const cnt = {};
  for (const j of JOBS) { const k = (cnt[j[0]] = (cnt[j[0]] || 0) + 1); add({ id: 'j_' + j[0] + k, cat: 'job', place: j[0], type: j[1], name: j[2], desc: j[3], target: j[4], reward: j[5], opt: j[6] || {}, order: k }); }
  for (const r of RACES) add({ id: r[0], cat: 'race', place: r[1], type: 'race', name: r[2], desc: r[3], route: r[4], reward: r[5], opt: r[6] || {} });
  for (const z of ZONES) add({ id: z[0], cat: 'zone', place: z[1], type: z[2], name: z[3], desc: z[4], thr: z[5], secs: z[6], reward: z[7] });
  RADARS.forEach((r, i) => { const p = edgePoint(r[0], r[1]); add({ id: 'rad' + (i + 1), cat: 'radar', type: 'radar', name: 'Radar №' + (i + 1), x: p.x, z: p.z, y: p.y, tx: p.tx, tz: p.tz, hw: p.hw, thr: r[2], reward: 250 }); });
  if (site.runway) { const rw = site.runway; add({ id: 'rad_run', cat: 'radar', type: 'radar', name: "Yo'lak radari", x: (rw.x0 + rw.x1) / 2 + 250, z: rw.z, y: rw.y, tx: 1, tz: 0, hw: rw.hw, thr: [120, 142, 160], reward: 400 }); }
  site.ramps.forEach((r, i) => add({ id: 'jmp' + (i + 1), cat: 'jump', type: 'jump', name: 'Tramplin №' + (i + 1), x: r.x, z: r.z, y: r.y, yaw: r.yaw, thr: r.thr || [14, 24, 36], reward: 250 }));
  return { acts, byPlace, byId: Object.fromEntries(acts.map((a) => [a.id, a])) };
}
