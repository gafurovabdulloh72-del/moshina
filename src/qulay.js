// Qulayliklar: «Birinchi safar» yo'riqnomasi, vaziyatga qarab bir martalik maslahatlar, yulduz chegaralari, chellenjni tezkor qayta boshlash, interfeys o'lchami, saqlovni fayl/kod qilib ko'chirish, avtomatik zaxira
import { fmtTime } from './game.js';
import { summary } from './net.js';

const KEY = 'safar_save_v2', ZKEY = 'safar_zaxira_v1'; // zaxiralar saqlovdan alohida kalitda (saqlov formati o'zgarmaydi)
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const som = (n) => Math.round(n).toLocaleString('ru-RU');
const OYLAR = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'];
const p2 = (n) => (n < 10 ? '0' : '') + n;
const when = (t) => { const d = new Date(t); return `${d.getDate()}-${OYLAR[d.getMonth()]} ${p2(d.getHours())}:${p2(d.getMinutes())}`; };
const vaqt = (s) => { s = Math.round(s || 0); const h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60; return h ? `${h} soat ${m} daq` : `${m} daq`; };
export const UI_SCALES = [80, 90, 100, 115, 130, 150];
// --- kodlash: crc32, base64, siqish (brauzerning o'zida — internet kerak emas) ---
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
export const crc32 = (s) => { const u = new TextEncoder().encode(s); let c = 0xffffffff; for (let i = 0; i < u.length; i++) c = CRC[(c ^ u[i]) & 255] ^ (c >>> 8); return ((c ^ 0xffffffff) >>> 0).toString(16).padStart(8, '0'); };
const b64e = (u) => { let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); };
const b64d = (s) => { const b = atob(s), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; };
const pipe = async (u, tr) => new Uint8Array(await new Response(new Blob([u]).stream().pipeThrough(tr)).arrayBuffer());
const zip = async (str) => { const u = new TextEncoder().encode(str); if (typeof CompressionStream !== 'undefined') try { return 'z' + b64e(await pipe(u, new CompressionStream('deflate-raw'))); } catch (e) { /* siqib bo'lmadi — oddiy */ } return 'j' + b64e(u); };
const unzip = async (s) => { const u = b64d(s.slice(1)); return new TextDecoder().decode(s[0] === 'z' ? await pipe(u, new DecompressionStream('deflate-raw')) : u); };

export function initQulay(game) {
  const st = game.state, ui = game.ui, TEST = !!window.__TEST;
  const Q = (game.qulay = { live: !TEST }); // live — kartalar, maslahatlar va avtomatik zaxira ishlaydi (sinov rejimida o'chiq; G.qulay.live = true bilan yoqiladi)
  const D = () => ({ guide: 0, tips: {}, tipsOff: false, ach: {}, achInit: 0, day: null, streak: 0, last: -1, chests: 0, win: 0 });
  if (!st.qulay || typeof st.qulay !== 'object') st.qulay = D();
  { const d = D(), q = st.qulay; for (const k in d) if (q[k] == null || (d[k] != null && typeof q[k] !== typeof d[k])) q[k] = d[k]; }
  const q = st.qulay, sfx = (n) => game.audio.sfx(n), toast = (m, k) => game.toast(m, k);
  const foot = () => game.player.onFoot, cnt = (k) => +st.cnt[k] || 0;
  if (!UI_SCALES.includes(st.set.ui)) st.set.ui = 100;

  // ================= USLUBLAR =================
  const css = el('style'); css.textContent = `
:root{--uz:1}#hud,#screen,#photo{zoom:var(--uz)}
html.uz .winwrap,html.uz .win{width:min(980px,calc(94vw / var(--uz)));max-height:calc(90vh / var(--uz))}html.uz .winwrap{width:min(1040px,calc(94vw / var(--uz)))}html.uz .winwrap.small,html.uz .win.small{width:min(520px,calc(94vw / var(--uz)))}html.uz .winwrap>.win{width:100%}
html.uz #mapc{width:min(100%,calc(90vh / var(--uz) - 112px))}html.uz .bcol{width:calc(100vw / var(--uz) - 600px)}html.uz .keys2{max-width:min(560px,calc(60vw / var(--uz)))}
html.uz #screen.telefon .win{width:340px;height:min(640px,calc(88vh / var(--uz)))}html.uz #screen.kiyim .winwrap,html.uz #screen.sartarosh .winwrap{width:min(470px,calc(94vw / var(--uz)))}
html.uz #screen.saqlov .winwrap,html.uz #screen.zaxira .winwrap{width:min(680px,calc(94vw / var(--uz)))}html.uz #screen.yutuqlar .winwrap{width:min(940px,calc(94vw / var(--uz)))}html.uz .on.pause .winwrap{width:min(680px,calc(94vw / var(--uz)))}
@media(max-width:1100px){html.uz .bcol{width:calc(100vw / var(--uz) - 520px)}}@media(max-width:820px){html.uz .bcol{width:calc(100vw / var(--uz) - 380px)}}
html.uz #hud.touch .bcol{width:calc(100vw / var(--uz) - 470px)}@media(max-width:520px){html.uz #hud.touch .bcol{width:calc(100vw / var(--uz) - 24px)}}
.q-cards{left:16px;top:64px;width:min(310px,calc(100vw / var(--uz) - 32px));display:flex;flex-direction:column;gap:8px;pointer-events:none}
.q-card{pointer-events:auto;padding:10px 13px 11px;border-radius:14px;background:rgba(14,18,30,.84);border:1px solid var(--bd);border-left:4px solid var(--ac);backdrop-filter:blur(8px);font-size:13.5px;line-height:1.42;animation:tin .25s ease-out;box-shadow:0 8px 24px rgba(0,0,0,.3)}
.q-card.tip{border-left-color:var(--blue)}.q-card .q-k{font-size:11px;font-weight:800;color:var(--mut);letter-spacing:.4px;text-transform:uppercase}
.q-card h5{margin:2px 0 3px;font-size:15px;color:var(--ac)}.q-card.tip h5{color:#9fd4ff}.q-card p{margin:0;color:#e6eaf4}
.q-card kbd,.q-meter kbd{display:inline-block;min-width:20px;padding:0 6px;border-radius:6px;background:#fff;color:#141824;font:800 12px ui-monospace,monospace;text-align:center;box-shadow:0 2px 0 #9aa3b5}
.q-card .q-row{display:flex;align-items:center;gap:8px;margin-top:8px}.q-card .q-row span{flex:1}
.q-card button{padding:5px 11px;font-size:12.5px;border-radius:9px;min-height:30px}
.q-dots i{display:inline-block;width:8px;height:8px;border-radius:50%;background:rgba(255,255,255,.18);margin-right:4px}.q-dots i.on{background:var(--ac)}.q-dots i.cur{background:#fff}
@media(max-width:1000px){.q-cards.act{top:auto;bottom:160px}}@media(max-width:520px){.q-cards{top:112px}}
html.touch .q-cards{left:50%;transform:translateX(-50%);top:64px}html.touch .q-cards.act{top:auto;bottom:118px}
@media(max-width:520px){html.touch .q-cards,html.touch .q-cards.act{left:12px;transform:none;top:auto;bottom:334px;width:calc(100vw / var(--uz) - 24px)}}
.q-meter{margin-top:6px;text-align:left}.q-mb{position:relative;height:12px;border-radius:7px;background:rgba(255,255,255,.14);margin:16px 2px 4px}
.q-mb>i{position:absolute;left:0;top:0;bottom:0;border-radius:7px;background:var(--good)}.q-mb>i.warn{background:var(--ac)}.q-mb>i.bad{background:var(--bad)}
.q-mb>b{position:absolute;top:-17px;transform:translateX(-50%);font-size:11px;font-weight:900;color:#ffe88a;white-space:nowrap;text-shadow:0 1px 2px #000}.q-mb>b.lost{color:#7c8494;text-decoration:line-through}
.q-mb>b::after{content:'';position:absolute;left:50%;top:15px;width:2px;height:14px;margin-left:-1px;background:rgba(255,255,255,.75)}
.q-mt{font-size:12.5px;font-weight:700;color:#e6eaf4;text-align:center}.q-mt .st{color:var(--ac);letter-spacing:1px}.q-mt .st i{color:#5a6070;font-style:normal}
#screen.saqlov .winwrap,#screen.zaxira .winwrap{width:min(680px,94vw)}
.q-sec{padding:13px 14px;border-radius:14px;background:rgba(255,255,255,.06);border:1px solid var(--bd);margin-top:10px}
.q-sec h4{margin:0 0 6px;font-size:16px}.q-sec p{margin:4px 0;font-size:13.5px;color:#cfd6e6}
.q-sec .row{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px}.q-sec .row button{flex:1 1 180px}
.q-sec textarea{width:100%;height:84px;margin-top:8px;resize:vertical;border-radius:10px;border:1px solid var(--bd);background:rgba(0,0,0,.35);color:var(--tx);font:12px ui-monospace,monospace;padding:8px;-webkit-user-select:text;user-select:text;word-break:break-all}
.q-msg{min-height:20px;font-size:13.5px;font-weight:700;margin-top:6px}.q-msg.bad{color:var(--bad)}.q-msg.good{color:var(--good)}
.q-ok{border-color:var(--ac);background:rgba(255,200,58,.09)}
.q-bk{display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid rgba(255,255,255,.08)}.q-bk>div{flex:1;min-width:0}.q-bk b{display:block;font-size:14.5px}.q-bk small{color:var(--mut);font-size:12.5px}
.q-bk .q-bb{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end}.q-bk button{padding:7px 12px;font-size:13px}
.q-seg{display:flex;flex-wrap:wrap;gap:6px;margin:4px 0 6px}.q-seg button{flex:1 1 60px;padding:8px 6px;font-size:13.5px}.q-seg button.on{background:var(--ac);color:#141824}
@media(max-width:520px){.q-bk{flex-wrap:wrap}.q-bk .q-bb{width:100%;justify-content:stretch}.q-bk .q-bb button{flex:1}}
`;
  document.head.appendChild(css);
  Q.applyScale = () => { const h = document.documentElement; h.style.setProperty('--uz', String((st.set.ui || 100) / 100)); h.classList.toggle('uz', (st.set.ui || 100) !== 100); }; // html.uz — vw/vh o'lchamlari ham kattalashib ketmasin (zoom ularni ham ko'paytiradi)
  Q.applyScale();

  // ================= KARTALAR (yo'riqnoma va maslahat) =================
  const box = el('div', 'q-cards'); ui.hud.appendChild(box);
  const gCard = el('div', 'q-card'), tCard = el('div', 'q-card tip'); gCard.style.display = tCard.style.display = 'none'; box.appendChild(gCard); box.appendChild(tCard);
  box.addEventListener('click', (e) => { const b = e.target.closest('[data-q]'); if (!b) return; e.stopPropagation(); sfx('click'); const a = b.dataset.q;
    if (a === 'skip') Q.skipGuide(); else if (a === 'tipok') Q.closeTip(); else if (a === 'tipoff') { q.tipsOff = true; Q.closeTip(); toast("Maslahatlar o'chirildi — Sozlamalarda qayta yoqish mumkin"); } });
  box.addEventListener('pointerdown', (e) => e.stopPropagation());

  // ================= 1. BIRINCHI SAFAR =================
  // guide: 0 — hali aniqlanmagan, 1..N — joriy qadam, 99 — tugatilgan, -1 — eski saqlov (ko'rsatilmaydi), -2 — o'tkazib yuborilgan
  const progress = () => game.totalStars() > 0 || st.stats.dist > 1500 || st.stats.time > 300 || st.veh.own.length > 2 || st.home.lvl > 0 || Object.keys(st.places).length > 1 || st.money > 1200;
  if (q.guide === 0) q.guide = progress() ? -1 : 1;
  const homeBoard = () => { const h = game.site.places.uy, hm = h.home || h; let best = null, bd = 1e18; for (const p of game.points) if (p.kind === 'board') { const d = (p.x - hm.x) ** 2 + (p.z - hm.z) ** 2; if (d < bd) { bd = d; best = p; } } return best; };
  const boardName = (b) => (b && game.site.places[b.place] ? game.site.places[b.place].name : 'qishloq');
  const pdist = (x, z) => { const p = foot() ? game.player.p : game.car.p; return Math.hypot(p[0] - x, p[2] - z); };
  const STEPS = [
    { t: "Yo'lga chiqing", d: () => (foot() ? "Avval <kbd>F</kbd> bilan transportga chiqing, keyin " : '') + "<kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> bilan biroz hayding. <kbd>Probel</kbd> — qo'l tormozi.", b: () => ({ d: st.stats.dist }), ok: (b) => !foot() && st.stats.dist - b.d > 60 },
    { t: 'Xaritani oching', d: () => "<kbd>M</kbd> — orol xaritasi. Unda istalgan joyni bossangiz, GPS yo'l ko'rsatadi.", ok: () => ui.screenName === 'map' },
    { t: 'Qishloqqa boring', d: () => `Sariq belgi — e'lonlar taxtasi. GPS <b>${boardName(homeBoard())}</b>ga yo'l ko'rsatdi — moviy chiziq bo'ylab hayding.`, b: () => { const bd = homeBoard(); if (bd && !game.act && pdist(bd.x, bd.z) > 25) game.setWaypoint(bd.x, bd.z); return { bd }; }, ok: (b) => !b.bd || pdist(b.bd.x, b.bd.z) < 25 },
    { t: "E'lonlar taxtasini oching", d: () => "Taxta yonida <kbd>E</kbd> bosing. Unda buyurtmalar, poygalar va drift bor.", ok: () => ui.screenName === 'board' },
    { t: 'Birinchi pulingizni ishlang', d: () => "Taxtadan buyurtma tanlang va bajaring. Har chellenj pul, yulduz va tajriba beradi.", b: () => ({ w: q.win }), ok: (b) => q.win > b.w },
    { t: 'Transportdan tushing', d: () => "<kbd>F</kbd> — tushish. Piyoda ham ish ko'p: terim, baliq, suhbat…", ok: () => foot() },
    { t: 'Piyoda ishlang', d: () => "<kbd>E</kbd> — daraxtni silkitish, <kbd>Q</kbd> — o't yulish, <kbd>G</kbd> — gul ekish. Bittasini bajaring.", b: () => ({ n: cnt('shake') + cnt('pull') + cnt('plant') + cnt('wood') + cnt('berry') }), ok: (b) => cnt('shake') + cnt('pull') + cnt('plant') + cnt('wood') + cnt('berry') > b.n },
    { t: 'Transportga qayting', d: () => "Transport yonida <kbd>F</kbd>. Uzoqda qolgan bo'lsa — <kbd>V</kbd> bilan chaqiring.", ok: () => !foot() },
  ];
  Q.STEPS = STEPS;
  let gb = null, gKey = '';
  Q.guideOn = () => q.guide >= 1 && q.guide <= STEPS.length;
  const drawGuide = () => {
    if (!Q.guideOn() || !Q.live) { if (gKey) { gKey = ''; gCard.style.display = 'none'; } return; }
    const i = q.guide, s = STEPS[i - 1], d = s.d(), k = i + d; if (k === gKey) return; gKey = k;
    gCard.innerHTML = `<div class="q-k">🧭 Birinchi safar · ${i}/${STEPS.length}</div><h5>${s.t}</h5><p>${d}</p><div class="q-row"><span class="q-dots">${STEPS.map((_, j) => `<i class="${j + 1 < i ? 'on' : j + 1 === i ? 'cur' : ''}"></i>`).join('')}</span><button class="sec" data-q="skip">O'tkazib yuborish</button></div>`;
    gCard.style.display = '';
  };
  const guideTick = () => {
    if (!Q.guideOn()) { drawGuide(); return; }
    const s = STEPS[q.guide - 1]; if (!gb) gb = (s.b && s.b()) || {};
    if (s.ok(gb)) {
      gb = null; q.guide++; sfx('check');
      if (q.guide > STEPS.length) { q.guide = 99; game.addMoney(300, 'Birinchi safar'); st.xp += 60; game.banner('Birinchi safar yakunlandi!', "+300 so'm · Endi orol sizniki: <b>9</b> — yutuqlar daftari, <b>0</b> — kunlik uchlik", 'gold'); sfx('win'); game.save(); }
      else toast('✔ ' + s.t, 'good');
    }
    drawGuide();
  };
  Q.skipGuide = () => { if (!Q.guideOn()) return; q.guide = -2; gb = null; drawGuide(); toast("Yo'riqnoma o'tkazib yuborildi — Sozlamalarda qayta boshlash mumkin"); game.save(); };
  Q.restartGuide = () => { q.guide = 1; gb = null; gKey = ''; };

  // ================= 2. BIR MARTALIK MASLAHATLAR =================
  const np = (k) => game.nearPoint && game.nearPoint.kind === k;
  const TIPS = [
    ['act', '⏱ Chellenj boshlandi', "Panelda 1–3 yulduz chegaralari ko'rinadi. Xato qildingizmi? <kbd>⌫</kbd> — darrov qayta boshlash, <kbd>X</kbd> — bekor qilish.", () => !!game.act && game.act.state === 'run' && game.act.t > 1.5],
    ['fuel', "⛽ Yoqilg'i kam", "Bak 20% dan kam qoldi. Yoqilg'i shoxobchasiga boring yoki sumkadagi kanistrdan quying. Velosiped benzin so'ramaydi!", () => !foot() && game.fuel && game.fuel.uses() && game.fuel.get() < 20],
    ['night', '🌙 Tun kirdi', "Transportda <kbd>L</kbd> — faralar, piyoda <kbd>L</kbd> — fonar. Uyda uxlasangiz, tong otadi va kuch tiklanadi.", () => game.sky.night > 0.6],
    ['rain', "🌧 Yomg'ir yog'yapti", "Yo'l sirpanchiq: oldinroq tormoz bosing, burilishda sekinlang. Telefon → Ob-havo — prognoz.", () => !!game.dunyo && ['yomgir', 'dovul', 'qor'].includes(game.dunyo.type)],
    ['dmg', '🔧 Transport shikastlandi', "Ko'k belgi — ustaxona: ta'mir shu yerda. Telefon (<kbd>4</kbd>) → Kontaktlar → mexanik joyida tuzatadi.", () => !foot() && game.damage.health < 80],
    ['tyre', '🛞 Balon yorildi', "To'xtang, <kbd>F</kbd> bilan tushing va g'ildirak yonida <kbd>E</kbd> — balonni almashtiring.", () => game.damage.tires.some(Boolean)],
    ['board', "📋 E'lonlar taxtasi", "Buyurtma, poyga va drift shu yerda. Bajarsangiz pul, yulduz va pasportga muhr olasiz — <kbd>E</kbd>.", () => np('board') && !game.act],
    ['garage', '🔵 Ustaxona', "Ta'mir, tyuning, bo'yoq va yangi transportlar. Yonida <kbd>E</kbd> bosing.", () => np('garage')],
    ['shop', "🛒 Do'kon", "Ichkarida non, suv, urug' va asboblar sotiladi. Sotuvchi oldida <kbd>E</kbd>.", () => foot() && /do.kon/i.test(game.live.prompt || '')],
    ['hitch', "🙋 Yo'lovchi", "Qo'l ko'targan odamni manziliga eltib qo'ying — pul va savob. Yonida <kbd>E</kbd>.", () => /yo.lovchi/i.test(game.live.prompt || '')],
    ['energy', '⚡ Kuch tugayapti', "<kbd>Y</kbd> — sumkadagi ovqatni yeyish. Uyda uxlasangiz kuch to'liq tiklanadi.", () => foot() && (st.energy < 25 || st.sat < 20)],
    ['thirst', '💧 Chanqadingiz', "Do'kondan suv yoki sharbat oling, uyda — bir stakan suv. Ichimlik ham <kbd>Y</kbd> bilan.", () => st.thirst < 25],
    ['tetik', '😴 Charchadingiz', "Tetiklik kam: uyga borib uxlang yoki choyxonada choy iching. Telefon (<kbd>7</kbd>) — bugungi reja.", () => st.tetik < 25],
    ['swim', '🏊 Suvdasiz', "Qirg'oqqa suzing. Transportni <kbd>V</kbd> bilan chaqirish mumkin.", () => foot() && !!game.player.swim],
    ['money', "💰 Pul yig'ildi", "Ustaxonada tyuning qiling yoki uyingizni yaxshilang (uy oldida <kbd>E</kbd>). <kbd>0</kbd> — kunlik uchlik, <kbd>9</kbd> — yutuqlar.", () => st.money >= 1500],
  ];
  Q.TIPS = TIPS;
  let tipCur = null, tipT = 0, tipGap = 6;
  const showTip = (t) => { tipCur = t[0]; tipT = 16; q.tips[t[0]] = 1; tCard.innerHTML = `<div class="q-k">💡 Maslahat</div><h5>${t[1]}</h5><p>${t[2]}</p><div class="q-row"><span></span><button class="sec" data-q="tipoff">Boshqa ko'rsatmang</button><button data-q="tipok">Tushunarli</button></div>`; tCard.style.display = ''; sfx('click'); };
  Q.closeTip = () => { tipCur = null; tCard.style.display = 'none'; tipGap = 20; };
  Q.showTip = (id) => { const t = TIPS.find((x) => x[0] === id); if (t) showTip(t); return !!t; };
  const tipTick = (dt) => {
    if (tipCur) { if ((tipT -= dt) <= 0) Q.closeTip(); return; }
    if (q.tipsOff || !Q.live || (tipGap -= dt) > 0 || ui.screenName || game.mode !== 'play') return;
    for (const t of TIPS) { if (q.tips[t[0]]) continue; let ok = false; try { ok = t[3](); } catch (e) { /* tekshirib bo'lmadi */ } if (ok) { showTip(t); return; } }
  };

  // ================= 3. YULDUZ CHEGARALARI =================
  // Chellenj panelida: shkala, 1/2/3 yulduz belgilari va «3 yulduz uchun yana …»
  const SC = { del: [0.7, 0.88], multi: [0.7, 0.88], col: [0.65, 0.85] }; // vaqt ulushi: shu ulushdan oldin yetsangiz 3 / 2 yulduz (game.js qoidasi bilan bir xil)
  Q.stars = (A) => {
    const a = A && A.def; if (!a || A.state === 'count' && a.type !== 'race') return null;
    const sv = (n) => `<span class="st">${'★'.repeat(n)}<i>${'★'.repeat(3 - n)}</i></span>`;
    let marks, v, now, text, cls = '';
    if (a.type === 'race' && a._t) { const [b1, b2, b3] = a._t, t = A.state === 'count' ? 0 : A.t, lo = b3 * 0.5, mx = b1 * 1.05, P = (x) => (x - lo) / (mx - lo); v = P(t); marks = [[P(b3), 3, t > b3], [P(b2), 2, t > b2], [P(b1), 1, t > b1]]; now = t <= b3 ? 3 : t <= b2 ? 2 : t <= b1 ? 1 : 0; const nx = now ? [0, b1, b2, b3][now] : 0; text = now ? `${now === 3 ? 'Oltin' : now === 2 ? 'Kumush' : 'Bronza'} uchun yana <b>${fmtTime(nx - t)}</b>` : 'Bronza vaqti o\'tdi — yetib boring'; cls = now === 3 ? '' : now ? 'warn' : 'bad'; }
    else if (SC[a.type] && A.limit) { const [k3, k2] = SC[a.type], L = A.limit, t = A.t, P = (x) => (x - 0.35) / 0.65; v = P(t / L); marks = [[P(k3), 3, t > k3 * L], [P(k2), 2, t > k2 * L], [1, 1, t > L]]; now = t <= k3 * L ? 3 : t <= k2 * L ? 2 : 1; const nx = [0, L, k2 * L, k3 * L][now]; text = `${now} yulduz uchun yana <b>${fmtTime(nx - t)}</b>`; cls = now === 3 ? '' : now === 2 ? 'warn' : 'bad'; }
    else if (a.type === 'frag' || a.type === 'taxi') { const val = a.type === 'frag' ? A.cargo : A.comfort, th = a.type === 'frag' ? [82, 45] : [75, 40]; v = val / 100; marks = [[th[1] / 100, 2, val < th[1]], [th[0] / 100, 3, val < th[0]]]; now = val >= th[0] ? 3 : val >= th[1] ? 2 : 1; text = `${a.type === 'frag' ? 'Yuk' : 'Qulaylik'} <b>${Math.round(val)}%</b> · ` + (now === 3 ? `3 yulduz uchun <b>${th[0]}%</b> dan tushirmang` : now === 2 ? `2 yulduz uchun <b>${th[1]}%</b> dan tushirmang` : "ehtiyot bo'ling!"); cls = now === 3 ? '' : now === 2 ? 'warn' : 'bad'; }
    else if ((a.type === 'drift' || a.type === 'smash') && a.thr) { const val = a.type === 'drift' ? Math.round(A.score) : A.count, th = a.thr, mx = th[2] * 1.1; v = Math.min(1, val / mx); marks = th.map((x, i) => [x / mx, i + 1, false]); now = val >= th[2] ? 3 : val >= th[1] ? 2 : val >= th[0] ? 1 : 0; const u = a.type === 'drift' ? ' ochko' : ' ta'; text = now >= 3 ? 'Oltin olindi! Rekord uchun davom eting' : `${now + 1} yulduz uchun yana <b>${som(th[now] - val)}${u}</b>`; cls = now >= 2 ? '' : now ? 'warn' : 'bad'; }
    else return null;
    return { v: Math.max(0, Math.min(1, v)), marks, now, text, cls, html: `<div class="q-meter"><div class="q-mb"><i class="${cls}" style="width:${(Math.max(0, Math.min(1, v)) * 100).toFixed(1)}%"></i>${marks.map(([p, n, lost]) => `<b class="${lost ? 'lost' : ''}" style="left:${(p * 100).toFixed(1)}%">${n}★</b>`).join('')}</div><div class="q-mt">Hozir: ${sv(now)} · ${text}</div></div>` };
  };
  // radar va tramplinga 250 m qolganda: oltin chegara va rekordingiz
  const spots = game.acts.acts.filter((a) => a.cat === 'radar' || a.cat === 'jump');
  const spotTick = () => {
    if (!Q.live || foot() || game.act || game.mode !== 'play') return; const p = game.car.p, fx = Math.sin(game.car.yaw), fz = Math.cos(game.car.yaw);
    for (const r of spots) { const dx = r.x - p[0], dz = r.z - p[2], d = Math.hypot(dx, dz); if (d > 420) { r._qs = 0; continue; } if (r._qs || d > 250 || d < 30 || (dx * fx + dz * fz) / d < 0.6) continue; r._qs = 1;
      const best = st.best[r.id], s = st.stars[r.id] || 0; toast(`${r.cat === 'radar' ? '📸' : '🛫'} ${r.name} · oltin ${r.thr[2]} ${r.cat === 'radar' ? 'km/soat' : 'm'} · rekordingiz ${best ? best + (r.cat === 'radar' ? ' km/soat' : ' m') : '—'} ${'★'.repeat(s)}${'☆'.repeat(3 - s)}`, 'gold'); }
  };

  // ================= 4. CHELLENJNI TEZKOR QAYTA BOSHLASH =================
  Q.canRestart = () => !!game.act && !game.coopRace && !(game.coop && game.coop.room && game.act.def.cat === 'race');
  let quiet = false; const t0 = game.toast; game.toast = (m, k) => { if (quiet && m === 'Chellenj bekor qilindi') return; t0(m, k); };
  Q.restart = () => {
    if (!Q.canRestart()) return false; const a = game.act.def;
    if (ui.screenName) ui.close();
    quiet = true; try { game.retry(a); } finally { quiet = false; }
    if (game.act) { toast('↺ Chellenj qayta boshlandi', 'good'); Q.restarts = (Q.restarts || 0) + 1; }
    return !!game.act;
  };
  // muvaffaqiyatli chellenjlar soni (yo'riqnoma va kunlik uchlik uchun)
  const ea = game.endAct;
  game.endAct = (ok, why, stars = 0, ...rest) => { if (game.act && ok && stars > 0) q.win++; return ea(ok, why, stars, ...rest); };

  // ================= 6–7. SAQLOV: KOD, FAYL, ZAXIRA =================
  const lsGet = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  Q.raw = () => { if (!game.noSave) game.save(); return lsGet(KEY) || JSON.stringify(st); };
  Q.info = (s) => { const m = summary(s); return m ? `${m.level}-daraja · ${som(m.money)} so'm · ★ ${m.stars} · o'yin vaqti ${vaqt(m.time)}` : ''; };
  // saqlovni tekshirish: buzilgan yoki begona ma'lumot ochilmaydi
  Q.validate = (o) => {
    if (!o || typeof o !== 'object' || Array.isArray(o)) return 'Bu SAFAR saqlovi emas';
    if (o.v !== 2) return "Saqlov versiyasi noma'lum";
    if (!Number.isFinite(o.money) || o.money < 0 || !Number.isFinite(+o.xp || 0)) return "Pul yoki tajriba qiymati noto'g'ri";
    for (const k of ['stars', 'stats', 'set', 'inv']) if (o[k] != null && (typeof o[k] !== 'object' || Array.isArray(o[k]))) return `«${k}» bo'limi buzilgan`;
    if (o.veh != null && (typeof o.veh !== 'object' || !Array.isArray(o.veh.own))) return "Transportlar ro'yxati buzilgan";
    for (const k of ['coins', 'chests', 'flowers', 'trees', 'tasks']) if (o[k] != null && !Array.isArray(o[k])) return `«${k}» ro'yxati buzilgan`;
    return null;
  };
  Q.exportCode = async () => { const raw = Q.raw(); return `SAFAR:1:${crc32(raw)}:${await zip(raw)}`; };
  // kod yoki JSON matnini o'qish → { ok, obj, raw, why }
  Q.decode = async (text) => {
    const s = String(text || '').trim(); if (!s) return { ok: false, why: "Kod yoki fayl bo'sh" };
    let raw = null;
    if (s[0] === '{') raw = s;
    else { const m = /^SAFAR:1:([0-9a-f]{8}):([zj][A-Za-z0-9+/=\s]+)$/.exec(s); if (!m) return { ok: false, why: 'Bu SAFAR saqlov kodi emas (kod «SAFAR:1:» bilan boshlanadi)' };
      try { raw = await unzip(m[2].replace(/\s+/g, '')); } catch (e) { return { ok: false, why: "Kod buzilgan yoki to'liq nusxalanmagan" }; }
      if (crc32(raw) !== m[1]) return { ok: false, why: "Kod buzilgan yoki to'liq nusxalanmagan (nazorat yig'indisi mos emas)" }; }
    if (raw.length > 4e6) return { ok: false, why: 'Fayl juda katta' };
    let obj; try { obj = JSON.parse(raw); } catch (e) { return { ok: false, why: "Fayl buzilgan — JSON o'qilmadi" }; }
    const why = Q.validate(obj); if (why) return { ok: false, why };
    return { ok: true, obj, raw, info: Q.info(obj) };
  };
  Q.download = () => { const raw = Q.raw(), d = new Date(), a = el('a'); a.href = URL.createObjectURL(new Blob([raw], { type: 'application/json' })); a.download = `safar-saqlov-${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}.json`; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500); return a.download; };
  // zaxiralar: oxirgi 5 ta avtomatik + 3 ta maxsus (ochishdan / yangi o'yindan / tiklashdan oldin)
  const ZW = { auto: 'avtomatik', import: 'saqlov ochilishidan oldin', reset: "«Yangi o'yin»dan oldin", restore: 'tiklashdan oldin', hand: "qo'lda olingan" };
  Q.backups = () => { try { const l = JSON.parse(lsGet(ZKEY) || '[]'); return Array.isArray(l) ? l.filter((e) => e && typeof e.d === 'string') : []; } catch (e) { return []; } };
  const store = (l) => { for (let i = 0; i < 6; i++) { try { localStorage.setItem(ZKEY, JSON.stringify(l)); return true; } catch (e) { const j = l.map((x, k) => [x, k]).filter(([x]) => x.why === 'auto').pop(); if (l.length <= 1) break; l.splice(j ? j[1] : l.length - 1, 1); } } return false; };
  let lastAuto = 0;
  Q.backup = async (why = 'auto', force = false) => {
    const raw = Q.raw(); if (!raw) return null; let o; try { o = JSON.parse(raw); } catch (e) { return null; }
    const k = crc32(raw), l = Q.backups();
    if (!force && l.some((e) => e.k === k)) return null; // xuddi shunday nusxa bor
    if (why === 'auto' && !force && Date.now() - lastAuto < 4 * 60000) return null;
    if (why === 'auto') lastAuto = Date.now();
    const m = summary(o) || {}, ent = { t: Date.now(), why, k, money: m.money, stars: m.stars, level: m.level, time: m.time, d: await zip(raw) };
    l.unshift(ent); let na = 0, ns = 0; const keep = l.filter((e) => (e.why === 'auto' ? ++na <= 5 : ++ns <= 3));
    while (keep.length > 1 && JSON.stringify(keep).length > 1.6e6) keep.pop(); // hajm: ~1,6 MB dan oshmaydi
    return store(keep) ? ent : null;
  };
  Q.backupSize = () => (lsGet(ZKEY) || '').length;
  // yangi saqlovni yozib, o'yinni qayta yuklash (avval hozirgisi zaxiraga olinadi)
  Q.apply = async (obj, why = 'import', reload = true) => {
    const e = Q.validate(obj); if (e) return e;
    await Q.backup(why === 'restore' ? 'restore' : 'import', true);
    game.noSave = true; try { localStorage.setItem(KEY, JSON.stringify(obj)); } catch (er) { game.noSave = false; return "Brauzer xotirasi to'lgan — saqlov yozilmadi"; }
    game.banner(why === 'restore' ? 'Zaxiradan tiklanmoqda' : 'Saqlov ochilmoqda', "O'yin qayta yuklanadi…", 'gold');
    if (reload && !Q.noReload) setTimeout(() => location.reload(), 700);
    return null;
  };
  Q.restore = async (t) => { const e = Q.backups().find((x) => x.t === +t); if (!e) return 'Zaxira topilmadi'; let r; try { r = await Q.decode(`SAFAR:1:${e.k}:${e.d}`); } catch (er) { r = { ok: false }; } if (!r.ok) return r.why || 'Zaxira buzilgan'; return Q.apply(r.obj, 'restore'); };
  const r0 = game.resetSave; game.resetSave = () => { Q.backup('reset', true).catch(() => {}).finally(() => r0()); };

  // --- «Saqlovni ko'chirish» oynasi ---
  ui.s_saqlov = function (w, d, btn, x) {
    d = d || {}; const back = d.back || 'pause'; x();
    let pend = d.pending || null, code = '';
    const draw = (msg = '', mk = '') => {
      w.innerHTML = `<h1>Saqlovni ko'chirish</h1><p class="sub">O'yiningizni boshqa brauzer, kompyuter yoki telefonga olib o'ting — internet kerak emas. Bulutli saqlov (onlayn) bundan alohida ishlaydi.</p>
        <div class="q-sec"><h4>⬆ Saqlab olish</h4><p>Hozirgi o'yin: <b>${Q.info(st)}</b></p><div class="row"><button data-a="file">⬇ Faylni yuklab olish</button><button class="sec" data-a="code">📋 Kodni nusxalash</button></div>${code ? `<textarea readonly id="q-code">${code}</textarea><p style="font-size:12px">Kodni o'zingizga xabar qilib yuboring yoki daftarga saqlang (${som(code.length)} belgi).</p>` : ''}</div>
        <div class="q-sec${pend ? ' q-ok' : ''}"><h4>⬇ Saqlovni ochish</h4>${pend ? `<p>Shu o'yinni ochasizmi?</p><p style="font-size:15px"><b>${Q.info(pend)}</b></p><p>Hozirgi o'yin avval zaxiraga olinadi — kerak bo'lsa «Zaxiradan tiklash»dan qaytarasiz.</p><div class="row"><button data-a="yes">Ha, shu o'yinni ochish</button><button class="sec" data-a="no">Bekor qilish</button></div>`
          : `<p>Faylni tanlang (yoki o'yin oynasiga sudrab tashlang) yoki saqlov kodini qo'ying.</p><div class="row"><button class="sec" data-a="pick">📂 Faylni tanlash</button></div><textarea id="q-in" placeholder="SAFAR:1:… kodini shu yerga qo'ying"></textarea><div class="row"><button data-a="check">Tekshirish</button></div>`}<div class="q-msg ${mk}">${msg}</div></div>`;
      const b = el('button', 'sec', '← Orqaga'); b.style.marginTop = '12px'; b.onclick = () => { sfx('click'); this.open('settings', { back }); }; w.appendChild(b);
    };
    const take = async (text) => { const r = await Q.decode(text); if (!r.ok) { draw(r.why, 'bad'); sfx('fail'); return; } pend = r.obj; draw(); };
    const inp = el('input'); inp.type = 'file'; inp.accept = '.json,.safar,.txt,application/json,text/plain';
    inp.onchange = () => { const f = inp.files && inp.files[0]; if (!f) return; f.text().then(take, () => draw("Faylni o'qib bo'lmadi", 'bad')); inp.value = ''; };
    this.on({ file: () => { const n = Q.download(); draw(`Fayl yuklab olindi: ${n}`, 'good'); },
      code: async () => { code = await Q.exportCode(); draw('Kod tayyor — nusxalandi', 'good'); const ta = w.querySelector('#q-code'); try { await navigator.clipboard.writeText(code); } catch (e) { try { ta.select(); document.execCommand('copy'); } catch (e2) { draw('Kodni belgilab, o\'zingiz nusxalang (Ctrl+C)', 'bad'); } } },
      pick: () => inp.click(), check: () => take((w.querySelector('#q-in') || {}).value),
      yes: async () => { const e = await Q.apply(pend, 'import'); if (e) draw(e, 'bad'); else draw("Saqlov yozildi — o'yin qayta yuklanmoqda…", 'good'); },
      no: () => { pend = null; draw(); } });
    draw();
  };
  // --- «Zaxiradan tiklash» oynasi ---
  ui.s_zaxira = function (w, d, btn, x) {
    d = d || {}; const back = d.back || 'pause'; x(); let ask = null;
    const draw = (msg = '', mk = '') => { const l = Q.backups();
      w.innerHTML = `<h1>Zaxiradan tiklash</h1><p class="sub">O'yin ochilganda va har 10 daqiqada o'zi zaxira oladi (oxirgi 5 tasi), saqlov ochish va «Yangi o'yin»dan oldin ham. Hammasi shu brauzerda saqlanadi.</p>
        <div class="q-sec">${l.length ? l.map((e) => `<div class="q-bk"><div><b>${when(e.t)} · ${ZW[e.why] || e.why}</b><small>${e.level || 1}-daraja · ${som(e.money || 0)} so'm · ★ ${e.stars || 0} · ${vaqt(e.time)}</small></div><div class="q-bb">${ask === e.t ? `<button data-a="yes:${e.t}">Ha, tiklash</button><button class="sec" data-a="no">Yo'q</button>` : `<button class="sec" data-a="ask:${e.t}">Tiklash</button>`}</div></div>`).join('') : "<p>Hali zaxira yo'q — o'ynay boshlasangiz o'zi paydo bo'ladi.</p>"}
        <div class="row"><button class="sec" data-a="now">💾 Hozir zaxira olish</button></div><p style="font-size:12px">Zaxiralar hajmi: ${Math.max(1, Math.round(Q.backupSize() / 1024))} KB</p><div class="q-msg ${mk}">${msg}</div></div>`;
      const b = el('button', 'sec', '← Orqaga'); b.style.marginTop = '12px'; b.onclick = () => { sfx('click'); this.open('settings', { back }); }; w.appendChild(b); };
    this.on({ ask: (t) => { ask = +t; draw(ask && Q.backups().length ? 'Hozirgi o\'yin ham zaxiraga olinadi, keyin tanlangani ochiladi' : ''); }, no: () => { ask = null; draw(); },
      yes: async (t) => { const e = await Q.restore(t); if (e) draw(e, 'bad'); else draw("Tiklanmoqda — o'yin qayta yuklanadi…", 'good'); },
      now: async () => { const e = await Q.backup('hand', true); draw(e ? 'Zaxira olindi' : "Zaxira olinmadi (brauzer xotirasi to'lgan bo'lishi mumkin)", e ? 'good' : 'bad'); } });
    draw();
  };
  // faylni o'yin oynasiga sudrab tashlash
  addEventListener('dragover', (e) => { if (e.dataTransfer && [...e.dataTransfer.types].includes('Files')) e.preventDefault(); });
  addEventListener('drop', (e) => { const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]; if (!f) return; e.preventDefault();
    f.text().then(async (t) => { const r = await Q.decode(t); const back = game.mode === 'menu' || ui.screenName === 'menu' || (ui.screenData && ui.screenData.back === 'menu') ? 'menu' : 'pause'; if (r.ok) ui.open('saqlov', { back, pending: r.obj }); else toast(r.why, 'bad'); }); });

  // ================= 5. SOZLAMALAR, PAUZA, PASPORT =================
  const s0 = ui.s_settings;
  ui.s_settings = function (w, d, btn) {
    s0.call(this, w, d, btn); d = d || {}; const done = w.lastElementChild, back = d.back || 'pause';
    const add = (n) => w.insertBefore(n, done);
    const lab = el('div', '', "Interfeys o'lchami <small style=\"color:var(--mut)\">— yozuv va tugmalar</small>"); lab.style.marginTop = '12px'; add(lab);
    const seg = el('div', 'q-seg'); add(seg);
    const drawSeg = () => { seg.innerHTML = UI_SCALES.map((v) => `<button class="sec${st.set.ui === v ? ' on' : ''}" data-ui="${v}">${v}%</button>`).join(''); };
    seg.onclick = (e) => { const b = e.target.closest('[data-ui]'); if (!b) return; sfx('click'); st.set.ui = +b.dataset.ui; Q.applyScale(); drawSeg(); }; drawSeg();
    const row = (label, node) => { const r = el('div', 'row'); r.style.margin = '10px 0'; r.appendChild(el('div', 'grow', label)); r.appendChild(node); add(r); };
    const tb = btn(q.tipsOff ? "O'chirilgan" : 'Yoqilgan', () => { q.tipsOff = !q.tipsOff; if (!q.tipsOff) tipGap = 3; tb.textContent = q.tipsOff ? "O'chirilgan" : 'Yoqilgan'; }, 'sec'); row('Maslahatlar (bir martalik)', tb);
    const gbn = btn(Q.guideOn() ? 'Davom etmoqda' : 'Qayta boshlash', () => { Q.restartGuide(); gbn.textContent = 'Davom etmoqda'; toast("🧭 Birinchi safar qayta boshlandi"); }, 'sec'); row("«Birinchi safar» yo'riqnomasi", gbn);
    const r2 = el('div', 'row'); r2.style.cssText = 'margin:12px 0;gap:8px;flex-wrap:wrap'; add(r2);
    const b1 = btn("💾 Saqlovni ko'chirish", () => this.open('saqlov', { back }), 'sec'), b2 = btn('🕘 Zaxiradan tiklash', () => this.open('zaxira', { back }), 'sec');
    b1.style.flex = b2.style.flex = '1 1 200px'; r2.appendChild(b1); r2.appendChild(b2);
  };
  const p0 = ui.s_pause;
  ui.s_pause = function (w, d, btn, x) {
    p0.call(this, w, d, btn, x); const col = w.querySelector('div[style*="flex-direction"]'); if (!col) return;
    if (Q.canRestart()) col.insertBefore(btn('↺  Chellenjni qayta boshlash  [⌫]', () => Q.restart()), col.children[1] || null);
    if (game.yutuq) { const hb = [...col.children].find((b) => /Haftalik/.test(b.textContent)); col.insertBefore(btn('✅ Kunlik uchlik va 📖 yutuqlar daftari', () => this.open('yutuqlar'), 'sec'), hb ? hb.nextSibling : null); }
  };

  // ================= KADR SIKLI =================
  let saveAcc = 0, firstBk = 6;
  game.hooks.push((dt) => {
    dt = dt || 0;
    if (Q.live && (game.mode === 'play' || game.mode === 'ui')) guideTick(); else drawGuide();
    tipTick(dt); spotTick(); const ia = !!game.act; if (box._a !== ia) { box._a = ia; box.classList.toggle('act', ia); } // chellenj paytida kartalar chellenj panelini to'smasin (tor ekranda pastga tushadi)
    // avtomatik zaxira: o'yin ochilgandan ~6 soniya keyin va har 10 daqiqada
    if (Q.live && !game.noSave && game.mode !== 'menu') { if (firstBk > 0 && (firstBk -= dt) <= 0) Q.backup('auto').catch(() => {}); if ((saveAcc += dt) > 600) { saveAcc = 0; Q.backup('auto').catch(() => {}); } }
  });
  return Q;
}
