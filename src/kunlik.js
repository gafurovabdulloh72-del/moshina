// Kunlik uchlik va yutuqlar daftari — sof hisob (three.js'siz, Node'da ham ishlaydi): kun raqami, kunning uchta topshirig'i, 60 ta yutuq va maqollar
import { mulberry32 } from './util.js';

// Haqiqiy (mahalliy) kun raqami — 2026-01-01 dan beri; yarim tunda almashadi
export const dayIndex = (d = new Date()) => Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - Date.UTC(2026, 0, 1)) / 864e5);
const c = (s, k) => (s.cnt && +s.cnt[k]) || 0;
const st_ = (s, k) => (s.stats && +s.stats[k]) || 0;
const job = (s, k) => (s.jobs && s.jobs[k] && +s.jobs[k].n) || 0;
// x — o'yindan olingan hisoblar (yutuq.js beradi): stars, maxStars, veh, vehN, places, placesN, coinN, chestN, stamps, level, jobs, haftaB, biz, album, albumN, streak, chests, guide, win, starsGot, visit
// Kunlik topshiriqlar: [id, guruh (0 — haydash, 1 — piyoda ish, 2 — yaxshilik), matn(goal), [min, max], hisoblagich(s, x), mavjudmi(s, x)]
export const DAILY = [
  ['km', 0, (n) => `${n} km yo'l bosing`, [3, 8], (s) => st_(s, 'dist') / 1000],
  ['coin', 0, (n) => `${n} ta tanga yig'ing`, [5, 12], (s) => c(s, 'coin')],
  ['win', 0, (n) => `${n} ta chellenjni yulduz bilan yakunlang`, [1, 2], (s, x) => x.win],
  ['drift', 0, (n) => `${n} so'mlik drift qiling`, [80, 200], (s) => c(s, 'driftc')],
  ['jump', 0, (n) => `${n} marta 15 metrdan uzun sakrang`, [1, 3], (s) => c(s, 'jump')],
  ['star', 0, (n) => `${n} ta yangi yulduz oling`, [1, 2], (s, x) => x.starsGot, (s, x) => x.stars < x.maxStars - 6],
  ['visit', 0, () => '', [1, 1], (s, x) => x.visit], // «Bugun … manziliga boring» — manzil kun bo'yicha tanlanadi
  ['non', 1, (n) => `${n} marta non yetkazing (novvoyxona)`, [1, 1], (s) => job(s, 'non')],
  ['dala', 1, (n) => `${n} marta dalada ishlang`, [1, 1], (s) => job(s, 'dala')],
  ['fish', 1, (n) => `${n} ta baliq tuting`, [2, 4], (s) => c(s, 'fish'), (s) => !!(s.tools && s.tools.rod)],
  ['shake', 1, (n) => `${n} ta daraxtni silkiting`, [3, 6], (s) => c(s, 'shake')],
  ['pull', 1, (n) => `${n} marta o't yuling`, [5, 10], (s) => c(s, 'pull')],
  ['plant', 1, (n) => `${n} ta gul eking`, [2, 5], (s) => c(s, 'plant')],
  ['wood', 1, (n) => `${n} ta o'tin yig'ing`, [3, 6], (s) => c(s, 'wood')],
  ['cook', 1, (n) => `${n} marta ovqat pishiring`, [1, 2], (s) => c(s, 'cook')],
  ['gift', 2, (n) => `${n} kishiga yaxshilik qiling`, [1, 2], (s) => c(s, 'gift')],
  ['litter', 2, (n) => `${n} ta axlatni yig'ishtiring`, [3, 6], (s) => c(s, 'litter')],
  ['stone', 2, (n) => `${n} ta toshni yo'ldan oling`, [2, 3], (s) => c(s, 'stone')],
  ['feed', 2, (n) => `${n} ta qo'yni boqing`, [2, 4], (s) => c(s, 'feed')],
  ['talk', 2, (n) => `${n} kishi bilan gaplashing`, [2, 4], (s) => c(s, 'talk')],
  ['hitch', 2, (n) => `${n} yo'lovchini manziliga eltib qo'ying`, [1, 2], (s) => c(s, 'hitch')],
  ['pet', 2, (n) => `${n} marta kuchukni erkalang`, [1, 2], (s) => c(s, 'pet'), (s) => s.home && s.home.lvl >= 1],
];
export const GROUPS = ['🚗 Haydash', '🧺 Piyoda ish', '❤ Yaxshilik'];
export const dailyDef = (id) => DAILY.find((d) => d[0] === id);
// Kunning uchta topshirig'i: kun raqamidan (bir xil kun — bir xil natija), har guruhdan bittadan. alt — almashtirilgan guruh (o'sha guruhda boshqasi)
export function dailyFor(day, s, x, alt = -1, not = null) {
  const out = [];
  for (let g = 0; g < 3; g++) {
    const rng = mulberry32(day * 7919 + g * 104729 + 17 + (g === alt ? 55001 : 0));
    const pool = DAILY.filter((d) => d[1] === g && (!d[5] || d[5](s, x)) && !(g === alt && d[0] === not));
    const d = pool[Math.floor(rng() * pool.length)], goal = d[3][0] + Math.round(rng() * (d[3][1] - d[3][0]));
    const t = { id: d[0], goal, rw: 70 + 20 * g + Math.round(rng() * 6) * 10 };
    if (d[0] === 'visit') { const pl = x.placeIds || []; t.place = pl[Math.floor(rng() * pl.length)] || 'bogiston'; }
    out.push(t);
  }
  return out;
}
export const chestReward = (day) => 400 + (((day % 5) + 5) % 5) * 100; // kun sandig'i: 400–800 so'm

// Yutuqlar: [id, belgi, nomi, sharti, qiymat(s, x), maqsad, mukofot, maqol, yashirin]
export const ACH_CATS = [['yol', "🚗 Yo'l"], ['piyoda', '🧺 Piyoda'], ['savob', '❤ Yaxshilik'], ['hayot', '🏠 Hayot'], ['odat', '📅 Odatlar']];
export const ACHS = [
  // yo'l
  ['km10', '🛣', 'Birinchi o\'n', "10 km yo'l bosing", (s) => st_(s, 'dist') / 1000, 10, 100, "Ming chaqirim yo'l bir qadamdan boshlanadi", 0, 'yol'],
  ['km100', '🗺', 'Yuz chaqirim', "100 km yo'l bosing", (s) => st_(s, 'dist') / 1000, 100, 400, "Ko'p yurgan ko'p bilar", 0, 'yol'],
  ['km500', '🌍', 'Orol bo\'ylab', "500 km yo'l bosing", (s) => st_(s, 'dist') / 1000, 500, 1000, "Yo'l yurgan yo'lni bilar, gap yurgan — so'zni", 0, 'yol'],
  ['top120', '💨', 'Shamol', '120 km/soat tezlikka chiqing', (s) => st_(s, 'top'), 120, 150, "Shamol qayoqqa essa, chang o'sha yoqqa uchar", 0, 'yol'],
  ['top180', '⚡', 'Chaqmoq', '180 km/soat tezlikka chiqing', (s) => st_(s, 'top'), 180, 500, "Tez yurgan tez charchar — lekin tez yetar", 0, 'yol'],
  ['jump30', '🦘', 'Uchar sayyoh', '30 metr sakrang', (s) => st_(s, 'jump'), 30, 150, "Sakramagan ariqdan o'tolmas", 0, 'yol'],
  ['jump80', '🚀', 'Qushdek', '80 metr sakrang', (s) => st_(s, 'jump'), 80, 600, "Qanot bo'lmasa ham ko'ngil uchadi", 0, 'yol'],
  ['drift10k', '🌀', 'Driftchi', "Jami 10 000 drift ochkosi to'plang", (s) => st_(s, 'drift'), 10000, 200, "Burilishni bilgan yo'ldan adashmas", 0, 'yol'],
  ['drift100k', '🔥', 'Drift qiroli', "Jami 100 000 drift ochkosi to'plang", (s) => st_(s, 'drift'), 100000, 800, "Tomchi-tomchi bo'lib ko'l bo'lur", 0, 'yol'],
  ['smash100', '💥', 'Sindirdim-ketdim', '100 ta buyum sindiring', (s) => st_(s, 'smashed'), 100, 200, "Sindirish oson, yasash qiyin", 0, 'yol'],
  ['stars30', '⭐', 'Yulduzcha', "30 ta yulduz to'plang", (s, x) => x.stars, 30, 300, "Sabr tagi — sariq oltin", 0, 'yol'],
  ['stars135', '🌟', 'Yulduzli osmon', "135 ta yulduz to'plang", (s, x) => x.stars, 135, 800, "Har bir yulduzning o'z yo'li bor", 0, 'yol'],
  ['starsAll', '👑', 'Yulduz ovchisi', "Barcha yulduzlarni to'plang", (s, x) => x.stars, (x) => x.maxStars, 1000, "Intilganga tole yor", 0, 'yol'],
  ['veh5', '🚙', 'Garaj egasi', '5 ta transportga ega bo\'ling', (s, x) => x.veh, 5, 300, "Otning yaxshisi — yo'lda bilinar", 0, 'yol'],
  ['vehAll', '🏎', 'Kolleksioner', 'Barcha transportlarni yig\'ing', (s, x) => x.veh, (x) => x.vehN, 1000, "Yig'ilgan — boylik, sochilgan — xorlik", 0, 'yol'],
  ['places', '🧭', 'Kashfiyotchi', 'Barcha manzillarni oching', (s, x) => x.places, (x) => x.placesN, 600, "Ming eshitgandan bir ko'rgan yaxshi", 0, 'yol'],
  ['coin100', '🪙', 'Tanga terimchi', "100 ta tanga yig'ing", (s) => (s.coins || []).length, 100, 250, "Tiyin-tiyin so'm bo'lur", 0, 'yol'],
  ['chests', '🗝', 'Xazinachi', 'Barcha yashirin sandiqlarni toping', (s) => (s.chests || []).length, (x) => x.chestN, 800, "Izlagan topar", 0, 'yol'],
  ['stamps', '📘', "Muhrlar to'plami", "Pasportga 10 ta muhr bosing", (s, x) => x.stamps, 10, 700, "Qadam-baqadam — manzilga", 0, 'yol'],
  ['crash100', '🤕', 'Temir peshona', '100 marta avariyaga uching', (s) => st_(s, 'crashes'), 100, 150, "Yiqilgan kurashga to'ymas", 1, 'yol'],
  ['air60', '🪂', 'Havoda yashovchi', 'Jami 60 soniya havoda uching', (s) => st_(s, 'air'), 60, 300, "Osmonga qarab yursang, oyog'ingga qara", 1, 'yol'],
  // piyoda
  ['walk5', '👟', 'Piyoda sayyoh', '5 km piyoda yuring', (s) => st_(s, 'walk') / 1000, 5, 200, "Piyoda yurgan — yer yuzini ko'rar", 0, 'piyoda'],
  ['plant10', '🌼', "Bog'bon", '10 ta gul eking', (s) => c(s, 'plant'), 10, 100, "Gul ekkan gul terar", 0, 'piyoda'],
  ['plant100', '🌻', 'Gulzor', '100 ta gul eking', (s) => c(s, 'plant'), 100, 500, "Bir gul bilan bahor kelmas", 0, 'piyoda'],
  ['tree5', '🌳', "Ko'chatchi", "5 ta ko'chat o'tqazing", (s) => c(s, 'tree'), 5, 300, "Daraxt ekkan soyasida o'tirar", 0, 'piyoda'],
  ['fish5', '🎣', 'Baliqchi', '5 ta baliq tuting', (s) => c(s, 'fish'), 5, 150, "Baliq suvsiz yashamas", 0, 'piyoda'],
  ['fish50', '🐟', 'Usta baliqchi', '50 ta baliq tuting', (s) => c(s, 'fish'), 50, 600, "Sabrli baliqchi quruq qaytmas", 0, 'piyoda'],
  ['shake30', '🍎', 'Meva terimchi', '30 ta daraxtni silkiting', (s) => c(s, 'shake'), 30, 150, "Daraxt mevasidan tanilar", 0, 'piyoda'],
  ['pull50', '🌾', "O'tchi", "50 marta o't yuling", (s) => c(s, 'pull'), 50, 150, "Begona o't yulinmasa, bog' buzilar", 0, 'piyoda'],
  ['wood30', '🪵', "O'tinchi", "30 ta o'tin yig'ing", (s) => c(s, 'wood'), 30, 150, "O'tin yig'gan qishda isinar", 0, 'piyoda'],
  ['cook10', '🍳', 'Oshpaz', '10 marta ovqat pishiring', (s) => c(s, 'cook'), 10, 200, "Oshni oshpaz pishirar, maqtovni mehmon qilar", 0, 'piyoda'],
  ['eat50', '🍽', 'Ishtahali', '50 marta ovqatlaning', (s) => c(s, 'eat'), 50, 150, "Non — rizq, uni ulug'la", 0, 'piyoda'],
  ['dance10', '💃', 'Raqqos', '10 marta raqs tushing', (s) => c(s, 'dance'), 10, 100, "Quvongan ko'ngil o'ynar", 0, 'piyoda'],
  ['music', '🪕', 'Dutorchi', "Dutor chalib 500 so'm ishlang", (s) => c(s, 'music'), 500, 250, "Kuy — ko'ngil darchasi", 0, 'piyoda'],
  ['dig5', '⛏', 'Xazina ovchisi', '5 marta yer qazing', (s) => c(s, 'dig'), 5, 200, "Yer qazigan — xazina topar", 0, 'piyoda'],
  ['album', '📷', "To'liq albom", 'Albomdagi barcha topilmalarni yig\'ing', (s, x) => x.album, (x) => x.albumN, 700, "Ko'rgan ko'z — bilgan ko'ngil", 0, 'piyoda'],
  // yaxshilik
  ['gift10', '🤝', 'Saxiy', '10 kishiga yaxshilik qiling', (s) => c(s, 'gift'), 10, 200, "Yaxshilik qil, daryoga tashla — baliq bilar", 0, 'savob'],
  ['gift50', '💝', 'Mehribon', '50 kishiga yaxshilik qiling', (s) => c(s, 'gift'), 50, 700, "Yaxshidan bog' qolar, yomondan — dog'", 0, 'savob'],
  ['litter30', '🧹', 'Ozoda orol', "30 ta axlatni yig'ishtiring", (s) => c(s, 'litter'), 30, 250, "Tozalik — sog'lik garovi", 0, 'savob'],
  ['stone20', '🪨', "Yo'l tozalovchi", "20 ta toshni yo'ldan oling", (s) => c(s, 'stone'), 20, 250, "Yo'ldagi toshni olgan — savob olar", 0, 'savob'],
  ['feed20', '🐑', "Cho'pon", "20 marta qo'y boqing", (s) => c(s, 'feed'), 20, 200, "Qo'yni bo'ri yemas, cho'pon hushyor bo'lsa", 0, 'savob'],
  ['hitch10', '🙋', 'Hamroh', "10 yo'lovchini manziliga eltib qo'ying", (s) => c(s, 'hitch'), 10, 300, "Hamrohi yaxshining yo'li qisqa", 0, 'savob'],
  ['talk30', '💬', 'Suhbatdosh', '30 kishi bilan gaplashing', (s) => c(s, 'talk'), 30, 200, "Yaxshi so'z — jon ozig'i", 0, 'savob'],
  ['karma200', '❤', 'Savobli', "200 yaxshilik ochkosi to'plang", (s) => +s.karma || 0, 200, 500, "Ko'ngil — oyna, sindirma", 0, 'savob'],
  ['errands10', '🏡', 'Qishloq yordamchisi', '10 ta qishloq topshirig\'ini bajaring', (s) => (s.errands && +s.errands.done) || 0, 10, 400, "Qo'shni haqqi — Tangri haqqi", 0, 'savob'],
  ['pet10', '🐶', 'Kuchukning do\'sti', '10 marta kuchukni erkalang', (s) => c(s, 'pet'), 10, 150, "It ham yaxshilikni unutmas", 1, 'savob'],
  // hayot
  ['jobs10', '💼', 'Mehnatkash', '10 marta ishga chiqing (non, taksi, dala)', (s, x) => x.jobs, 10, 250, "Mehnatning tagi — rohat", 0, 'hayot'],
  ['jobs50', '🧰', 'Ishbilarmon', '50 marta ishga chiqing', (s, x) => x.jobs, 50, 800, "Ishlagan tishlar", 0, 'hayot'],
  ['home4', '🏰', 'Villa egasi', 'Uyingizni Villagacha yaxshilang', (s) => (s.home && +s.home.lvl) || 0, 4, 1000, "Uy egasi bilan obod", 0, 'hayot'],
  ['biz1', '🏪', 'Tadbirkor', 'Birinchi biznesingizni oching', (s, x) => x.biz, 1, 400, "Savdo — boylik eshigi", 0, 'hayot'],
  ['money20k', '💰', 'Boyvachcha', "Hamyonda 20 000 so'm jamlang", (s) => +s.money || 0, 20000, 500, "Pulni pul topar", 0, 'hayot'],
  ['sleep10', '🛏', 'Uyquchi', '10 marta uyda uxlang', (s) => st_(s, 'sleeps'), 10, 100, "Erta turgan — rizq topar", 0, 'hayot'],
  ['cafe10', '🍵', 'Choyxona mehmoni', 'Choyxonada 10 marta ovqatlaning', (s) => st_(s, 'cafe'), 10, 200, "Choy — dilning ochqichi", 0, 'hayot'],
  ['level7', '🎓', 'Orol afsonasi', 'Eng yuqori darajaga yeting', (s, x) => x.level, 7, 1000, "Bilagi zo'r birni yiqar, bilimi zo'r — mingni", 0, 'hayot'],
  ['ice10', '🍦', 'Muzqaymoqxo\'r', '10 ta muzqaymoq yeng', (s) => st_(s, 'ice'), 10, 150, "Yozning shirinligi — muzqaymoqda", 1, 'hayot'],
  ['goals5', '⚽', 'Futbolchi', '5 ta gol uring', (s) => st_(s, 'goals'), 5, 200, "To'pni urgan — darvozani topar", 1, 'hayot'],
  // odatlar
  ['guide', '🧭', 'Birinchi safar', "O'rgatuvchi yo'lni oxirigacha o'ting", (s, x) => x.guide, 1, 100, "Bilmaganni so'rab o'rgangan olim", 0, 'odat'],
  ['daily1', '✅', 'Kunlik uchlik', 'Kunlik uchlikni bir marta to\'liq bajaring', (s, x) => x.chests, 1, 150, "Har kunning o'z rizqi bor", 0, 'odat'],
  ['streak7', '📆', 'Yetti kun', 'Kunlik uchlikni 7 kun ketma-ket bajaring', (s, x) => x.streak, 7, 800, "Oz-oz o'rganib dono bo'lur", 0, 'odat'],
  ['chest10', '🎁', 'Kunlik odat', "10 ta kun sandig'ini oching", (s, x) => x.chests, 10, 600, "Odat — ikkinchi tabiat", 0, 'odat'],
  ['hafta3', '📅', 'Nishondor', "3 ta haftalik nishon to'plang", (s, x) => x.haftaB, 3, 400, "Birlashgan o'zar, birlashmagan to'zar", 0, 'odat'],
];
export const achGoal = (a, x) => (typeof a[5] === 'function' ? a[5](x) : a[5]);
export const achValue = (a, s, x) => { const v = +a[4](s, x); return Number.isFinite(v) ? v : 0; };
