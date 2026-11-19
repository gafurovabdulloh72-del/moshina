// Haftalik chellenj, hafta statistikasi va nishonlar: «Hafta» oynasi ([6], telefon ilovasi, pauza menyusi), mahalliy rekordlar; kirgan o'yinchida — hafta reytingi (tarmoq faqat net.js orqali)
import { UI } from './ui.js';
import { fmtTime } from './game.js';
import { weekIndex, weekLabel, weeklyId, weeklyKind, weekStartMs, CH_LIM, STATS } from './haftalik.js';

const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const som = (n) => Math.round(n).toLocaleString('ru-RU');
export const TIERS = [0, 300, 600, 1000]; // haftalik chellenj mukofoti: yulduzlar soniga qarab, hafta davomida farqi bir marta to'lanadi
const GOAL = { money: 5000, km: 50000, jobs: 5, wins: 2 }; // «Hafta yulduzi» nishoni uchun maqsadlar
const TYPE = { race: 'Poyga', drift: 'Drift', smash: 'Sindirish' };
// Nishonlar: [id, belgi, nomi, sharti, tekshiruv(h — state.hafta)]. Bir marta olinadi va hamisha qoladi
export const BADGES = [
  ['ilk', '🎯', 'Ilk qadam', 'Haftalik chellenjni birinchi marta yulduz bilan yakunlang', (h) => h.done >= 1],
  ['oltin', '🥇', 'Oltin hafta', 'Haftalik chellenjda 3 yulduz oling', (h) => h.stars >= 3],
  ['boy', '💰', 'Boyvachcha', "Bir haftada 10 000 so'm ishlab toping", (h) => h.s.money >= 10000],
  ['yol', '🛣', "Uzoq yo'l", "Bir haftada 100 km yo'l bosing", (h) => h.s.km >= 100000],
  ['mehnat', '💼', 'Mehnatkash', 'Bir haftada 10 ta ish yoki buyurtma bajaring', (h) => h.s.jobs >= 10],
  ['poyga', '🏁', 'Poyga ustasi', "Bir haftada 5 ta poygada g'olib bo'ling", (h) => h.s.wins >= 5],
  ['yulduz', '⭐', 'Hafta yulduzi', "Bir haftada hammasi: 5 000 so'm, 50 km, 5 ish, 2 g'alaba", (h) => STATS.every(([k]) => h.s[k] >= GOAL[k])],
  ['doimiy', '📅', 'Doimiy sayyoh', '3 xil haftada haftalik chellenjni bajaring', (h) => h.weeks >= 3],
];
const fmtStat = (k, v) => (k === 'money' ? `${som(v)} so'm` : k === 'km' ? `${(v / 1000).toFixed(1)} km` : k === 'jobs' ? `${v} ta` : `${v} ta`);
const fmtCh = (kind, v) => (v == null ? '—' : kind === 'race' ? fmtTime(v) : kind === 'drift' ? `${som(v)} ochko` : `${v} ta`);
const left = (wi) => { const ms = Math.max(0, weekStartMs(wi + 1) + new Date().getTimezoneOffset() * 60000 - Date.now()), d = Math.floor(ms / 86400000), h = Math.floor((ms % 86400000) / 3600000); return d ? `${d} kun ${h} soat` : `${h} soat ${Math.floor((ms % 3600000) / 60000)} daq`; };

export function initHafta(game) {
  const st = game.state, ui = game.ui;
  const H = (game.hafta = { wOverride: null, pending: [] });
  // saqlovdagi holat (eski saqlovda yoki buzilgan bo'lsa — standart qiymatlar bilan to'ldiriladi)
  const D = () => ({ w: -1, best: null, stars: 0, paid: 0, tries: 0, s: { money: 0, km: 0, jobs: 0, wins: 0 }, hist: [], badges: {}, done: 0, weeks: 0 });
  if (!st.hafta || typeof st.hafta !== 'object') st.hafta = D();
  { const d = D(), h = st.hafta; for (const k in d) if (d[k] != null && (h[k] == null || typeof h[k] !== typeof d[k])) h[k] = d[k]; if (h.best != null && !Number.isFinite(+h.best)) h.best = null; h.s = Object.assign(d.s, h.s); if (!Array.isArray(h.hist)) h.hist = []; }
  H.week = () => (H.wOverride != null ? H.wOverride : weekIndex());
  // hafta almashsa: o'tgan hafta tarixga yoziladi, ko'rsatkichlar nolga tushadi
  const roll = () => { const w = H.week(), h = st.hafta; if (h.w === w) return; const s = h.s;
    if (h.w >= 0 && (h.tries || s.money || s.km || s.jobs || s.wins)) { h.hist.unshift({ w: h.w, id: weeklyId(h.w), best: h.best, stars: h.stars, s: Object.assign({}, s) }); if (h.hist.length > 8) h.hist.length = 8; }
    Object.assign(h, { w, best: null, stars: 0, paid: 0, tries: 0, s: { money: 0, km: 0, jobs: 0, wins: 0 } }); };
  roll();
  H.roll = roll;
  H.id = () => weeklyId(st.hafta.w);
  H.kind = () => weeklyKind(st.hafta.w);
  H.def = () => game.acts.acts.find((a) => a.id === H.id());
  H.payload = () => { const h = st.hafta; return { w: h.w, ch: h.best, s: { money: Math.floor(h.s.money), km: Math.floor(h.s.km), jobs: h.s.jobs, wins: h.s.wins } }; };
  const note = (title, text, kind) => H.pending.push([title, text, kind]);
  // nishonlarni tekshirish (yangi olinganida — xabar navbatga)
  H.check = () => { const h = st.hafta; for (const [id, ic, name, desc, ok] of BADGES) if (!h.badges[id] && ok(h)) { h.badges[id] = Math.round(st.stats.time) || 1; note(`${ic} Yangi nishon: ${name}`, desc, 'gold'); } };

  // --- pul: har bir tushum hafta statistikasiga (bank tarixini ish.js yozadi) ---
  const am = game.addMoney;
  game.addMoney = (n, why) => { const m0 = st.money; am(n, why); const d = st.money - m0; if (d > 0) { roll(); st.hafta.s.money += d; } };

  // --- chellenj tugashi: g'alaba, buyurtma, haftalik natija ---
  const jobsSum = () => { let n = 0; for (const k in st.jobs) n += (st.jobs[k] && st.jobs[k].n) || 0; return n; };
  H._res = null;
  const ea = game.endAct;
  game.endAct = (ok, why, stars = 0, info = '', ...rest) => {
    const A = game.act;
    if (A && why !== 'cancel') {
      roll(); const a = A.def, h = st.hafta;
      if (a.type === 'race' && ok && /(^|\s)1-o'rin/.test(info)) h.s.wins++;
      if (ok && (a.cat === 'job' || a.cat === 'inf')) h.s.jobs++;
      if (a.id === H.id()) {
        const kind = H.kind(), asc = CH_LIM[kind][2]; let v = null;
        if (a.type === 'race' && A.cps && A.cpi >= A.cps.length) v = +A.t.toFixed(2);
        else if (a.type === 'drift' && (why === 'done' || why === 'low')) v = Math.round(A.score);
        else if (a.type === 'smash' && (why === 'done' || why === 'low')) v = A.count;
        h.tries++; const lines = [];
        if (v != null && (h.best == null || (asc ? v < h.best : v > h.best))) { lines.push(h.best == null ? `Hafta natijangiz: <b>${fmtCh(kind, v)}</b>` : `Yangi hafta rekordi: <b>${fmtCh(kind, v)}</b>`); h.best = v; }
        const s = ok ? stars : 0; if (s > 0) h.done++;
        if (s > h.stars) { if (!h.stars) h.weeks++; h.stars = s; }
        const due = TIERS[h.stars] - h.paid; if (due > 0) { h.paid += due; game.addMoney(due, 'Hafta chellenji'); lines.push(`Hafta mukofoti: <b>+${som(due)} so'm</b>`); }
        H._res = lines.length ? { id: a.id, lines } : null;
      }
      H.check();
    }
    return ea(ok, why, stars, info, ...rest);
  };
  // natija oynasiga haftalik qator qo'shiladi
  const sr = ui.s_result;
  ui.s_result = function (w, r, btn) { sr.call(this, w, r, btn); const x = H._res; if (x && r.def && r.def.id === x.id) { H._res = null; const p = el('div', 'hf-res', `📅 Haftalik chellenj · ${x.lines.join(' · ')}`); const row = w.querySelector('.row'); w.insertBefore(p, row); } };

  // --- har kadr: yo'l, ishlar (ish.js), hafta almashishi, xabarlar ---
  let lastDist = st.stats.dist, lastJobs = jobsSum(), acc = 0;
  game.hooks.push((dt) => {
    const h = st.hafta, dd = st.stats.dist - lastDist; lastDist = st.stats.dist; if (dd > 0 && dd < 500) h.s.km += dd;
    const js = jobsSum(); if (js > lastJobs) h.s.jobs += js - lastJobs; lastJobs = js;
    if ((acc += dt || 0) > 2) { acc = 0; roll(); H.check(); }
    if (H.pending.length && !ui.screenName && game.mode === 'play') { const [a, b, k] = H.pending.shift(); ui.banner(a, b, k); ui.toast(a, k); game.audio.sfx('medal'); }
  });

  // --- haftalik chellenjni boshlash (poyga — start chizig'iga ko'chadi; zona — o'sha manzilga) ---
  H.start = () => {
    const a = H.def(); if (!a) return false;
    if (game.act) { game.toast('Avval joriy chellenjni tugating — [X]', 'bad'); return false; }
    if (game.interior && game.interior.inside) { game.toast('Avval tashqariga chiqing 🙂', 'bad'); return false; }
    if (game.ish && game.ish.cur) { game.toast('Avval ishni tugating — [X]', 'bad'); return false; }
    if (ui.screenName) ui.close();
    if (a.cat === 'zone') { const p = game.site.places[a.place], b = p.board || p; if (game.player.onFoot) game.live.mount(true); game.car.place(b.x + 6, b.z + 6, 0); game.respawn(); }
    game.startAct(a); return !!game.act;
  };
  // [6] tugmasi va telefondagi «Hafta» ilovasi
  H.open = () => { if (game.mode === 'play') ui.open('hafta'); };
  let wrapped = false;
  game.hooks.push(() => {
    if (wrapped || !ui.s_telefon || !Object.prototype.hasOwnProperty.call(ui, 's_telefon')) return; wrapped = true;
    const tel = ui.s_telefon, add = (w) => { const g = w.querySelector('.ph-apps'); if (g && !g.querySelector('[data-hafta]')) g.appendChild(el('div', 'ph-app', `<i style="background:#c8457a">📅</i><span>Hafta</span>`)).dataset.hafta = 1; };
    ui.s_telefon = function (w, d, btn, x) { tel.call(this, w, d, btn, x); add(w); new MutationObserver(() => add(w)).observe(w, { childList: true, subtree: true });
      w.addEventListener('click', (e) => { if (e.target.closest('[data-hafta]')) { game.audio.sfx('click'); ui.open('hafta'); } }); };
  });
  // onlayn: kirgan bo'lsa natijalar net.js orqali yuboriladi (u o'zi tekshiradi)
  setInterval(() => { if (game.net && game.net.submitWeek && game.mode === 'play') game.net.submitWeek(); }, 60000);

  // uslublar (faqat shu oyna uchun)
  const css = el('style'); css.textContent = `
.hf-grid{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(0,1fr);gap:12px}
.hf-ch .meta{margin-top:6px}.hf-ch .hf-big{font-size:22px;font-weight:900;color:var(--ac);margin:6px 0 2px}
.hf-tiers{display:flex;gap:6px;flex-wrap:wrap;margin:8px 0}.hf-tiers span{padding:4px 9px;border-radius:999px;background:rgba(255,255,255,.1);font-size:12.5px;font-weight:800}.hf-tiers span.on{background:var(--ac);color:#141824}
.hf-ch button{min-height:44px;width:100%;margin-top:8px;font-size:15px}
.hf-st .stat b{white-space:nowrap}
.hf-tabs{display:flex;gap:6px;flex-wrap:wrap;margin:6px 0 8px}.hf-tabs button{min-height:40px;padding:6px 12px;font-size:13px}.hf-tabs button.on{background:var(--ac);color:#141824}
.hf-badges{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px}
.hf-b{display:flex;gap:9px;align-items:center;padding:8px 10px;border-radius:12px;background:rgba(255,255,255,.06);border:1px solid var(--bd);font-size:12px;line-height:1.25}
.hf-b i{font-style:normal;font-size:26px;filter:grayscale(1);opacity:.45}.hf-b b{display:block;font-size:13px}.hf-b small{color:var(--mut)}
.hf-b.on{border-color:var(--ac);background:rgba(255,200,58,.12)}.hf-b.on i{filter:none;opacity:1}
.hf-top table{width:100%;border-collapse:collapse;font-size:14px}.hf-top td,.hf-top th{padding:6px 8px;text-align:left;border-bottom:1px solid rgba(255,255,255,.08)}.hf-top tr.me td{color:var(--ac);font-weight:800}
.hf-hist{font-size:13px;color:var(--mut)}.hf-hist div{display:flex;justify-content:space-between;gap:8px;padding:4px 0;border-bottom:1px solid rgba(255,255,255,.06)}
.hf-res{margin:10px auto 0;padding:8px 12px;border-radius:12px;background:rgba(255,200,58,.14);border:1px solid var(--ac);font-weight:700;font-size:15px;max-width:520px}
.win h4.hf-h{margin:16px 0 8px}
@media(max-width:820px){.hf-grid{grid-template-columns:1fr}}`;
  document.head.appendChild(css);
  return H;
}

// ---------- «Hafta» oynasi ----------
UI.prototype.s_hafta = function (w, d, btn, x) {
  const g = this.g, st = g.state, H = g.hafta, net = g.net, C = g.coop; x(); H.roll(); H.check();
  const h = st.hafta, L = weekLabel(h.w), a = H.def(), kind = H.kind(), lim = CH_LIM[kind];
  if (a && a.cat === 'race') g.raceInfo(a);
  const thr = a ? (a.cat === 'race' ? a._t.map((t) => fmtTime(t)) : a.thr.map((v) => fmtCh(kind, v))) : [];
  w.innerHTML = `<h1>📅 Hafta <small>${L.n}-hafta · ${L.from}–${L.to}</small></h1><p class="sub">Har dushanba yangi chellenj — barcha do'stlarda bir xil (internetsiz ham). Yangisigacha: <b>${left(h.w)}</b>.</p>`;
  const grid = el('div', 'hf-grid'); w.appendChild(grid);
  const ch = el('div', 'card hf-ch');
  ch.innerHTML = a ? `<h4><span class="tag ${a.cat}">${TYPE[kind]}</span>${esc(a.name)} <small style="color:var(--mut)">· ${esc((g.site.places[a.place] || {}).name || '')}</small></h4><p>${esc(a.desc)}</p>
    <div class="meta"><span>Hafta rekordingiz</span><span>${h.tries ? `${h.tries} urinish` : 'hali urinmagansiz'}</span></div><div class="hf-big">${fmtCh(kind, h.best)}</div>
    <div class="meta"><span>★ ${thr[0]} · ★★ ${thr[1]} · ★★★ ${thr[2]}</span><span>${lim[2] ? 'kam vaqt — yaxshi' : "ko'p — yaxshi"}</span></div>
    <div class="hf-tiers">${[1, 2, 3].map((s) => `<span class="${h.stars >= s ? 'on' : ''}">${'★'.repeat(s)} ${som(TIERS[s])} so'm</span>`).join('')}</div>
    <button data-a="go">${h.tries ? 'Yana urinish' : 'Boshlash'} ${a.cat === 'race' ? "(start chizig'iga)" : "(o'sha manzilga)"}</button>` : '<p>Bu hafta chellenj topilmadi.</p>';
  grid.appendChild(ch);
  const sc = el('div', 'card hf-st');
  sc.innerHTML = `<h4>Hafta ko'rsatkichlaringiz</h4>${STATS.map(([k, ic, name]) => `<div class="stat"><span>${ic} ${name}</span><b>${fmtStat(k, Math.floor(h.s[k]))}</b></div>`).join('')}<p class="onl-note" style="margin-top:8px">Pul — har qanday tushum; ish — non/taksi/dala va e'lon buyurtmalari; g'alaba — poygada 1-o'rin.</p>`;
  grid.appendChild(sc);
  // reyting (faqat kirgan o'yinchi — tarmoq so'rovi faqat shunda)
  w.appendChild(el('h4', 'hf-h', '🏆 Hafta reytingi'));
  const top = el('div', 'card hf-top'); w.appendChild(top);
  const online = net && net.status === 'ok' && net.user && net.cfg && net.cfg.top;
  if (!online) {
    top.appendChild(el('p', '', !net || net.status === 'file' ? "Do'stlar bilan hafta reytingi faqat sayt orqali ishlaydi. Mahalliy rekordlaringiz shu yerda saqlanadi." : net.status !== 'ok' ? esc(net.why || "Onlayn server bilan aloqa yo'q") : !net.cfg.top ? 'Reyting hali ulanmagan.' : "Do'stlaringiz bilan solishtirish uchun Telegram orqali kiring — natijalaringiz o'zi yuboriladi."));
    if (net && net.status === 'ok' && !net.user && net.cfg && net.cfg.login) top.appendChild(btn('🌐 Onlayn — kirish', () => this.open('online', { back: null }), 'sec'));
  } else {
    const tabs = [['ch', '📅 Chellenj']].concat(STATS.map(([k, ic, , title]) => [k, ic + ' ' + title]));
    const bar = el('div', 'hf-tabs'); bar.innerHTML = tabs.map(([k, t]) => `<button class="sec" data-t="${k}">${esc(t)}</button>`).join(''); top.appendChild(bar);
    const body = el('div'); top.appendChild(body);
    const friends = new Set(C && C.room ? C.roster().map((p) => p.name) : []);
    const load = (t) => {
      this._hfTab = t; for (const b of bar.children) b.classList.toggle('on', b.dataset.t === t); body.innerHTML = '<p class="sub">Yuklanmoqda…</p>';
      const fmt = (v) => (t === 'ch' ? fmtCh(kind, v) : fmtStat(t, v));
      net.week(t, h.w).then((r) => {
        if (this._hfTab !== t || this.screenName !== 'hafta') return;
        if (!r.rows.length) { body.innerHTML = "<p class=\"sub\">Bu hafta hali hech kim natija yubormagan — birinchi bo'ling!</p>"; return; }
        body.innerHTML = `<table><tr><th>#</th><th>Sayyoh</th><th>Natija</th></tr>${r.rows.map((q) => `<tr class="${q.me ? 'me' : ''}"><td>${q.rank <= 3 ? ['🥇', '🥈', '🥉'][q.rank - 1] : q.rank}</td><td>${esc(q.name)}${friends.has(q.name) && !q.me ? ' <small title="Xonadagi do\'stingiz">👥</small>' : ''}</td><td>${esc(fmt(q.value))}</td></tr>`).join('')}</table>${r.me && r.me.rank > 20 ? `<p class="onl-note">Sizning o'rningiz: ${r.me.rank} (${esc(fmt(r.me.value))})</p>` : ''}`;
      }).catch((e) => { body.innerHTML = `<p class="onl-err">Yuklab bo'lmadi: ${esc(e.message)}</p>`; });
    };
    bar.onclick = (e) => { const b = e.target.closest('[data-t]'); if (b) { g.audio.sfx('click'); load(b.dataset.t); } };
    Promise.resolve(net.submitWeek && net.submitWeek()).finally(() => load(this._hfTab || 'ch'));
  }
  // nishonlar
  const got = BADGES.filter((b) => h.badges[b[0]]).length;
  w.appendChild(el('h4', 'hf-h', `🏅 Nishonlar <small style="color:var(--mut)">${got}/${BADGES.length}</small>`));
  w.appendChild(el('div', 'hf-badges', BADGES.map(([id, ic, name, desc]) => `<div class="hf-b${h.badges[id] ? ' on' : ''}"><i>${ic}</i><div><b>${name}</b><small>${desc}</small></div></div>`).join('')));
  // o'tgan haftalar
  if (h.hist.length) {
    w.appendChild(el('h4', 'hf-h', "O'tgan haftalar"));
    w.appendChild(el('div', 'hf-hist', h.hist.slice(0, 4).map((q) => { const k = weeklyKind(q.w), dd = g.acts.acts.find((z) => z.id === q.id); return `<div><span>${weekLabel(q.w).n}-hafta · ${esc(dd ? dd.name : q.id)} · ${fmtCh(k, q.best)} ${'★'.repeat(q.stars || 0)}</span><span>💰 ${som(q.s.money)} · 🛣 ${(q.s.km / 1000).toFixed(1)} km · 💼 ${q.s.jobs} · 🏁 ${q.s.wins}</span></div>`; }).join('')));
  }
  const row = el('div', 'row'); row.style.marginTop = '14px'; w.appendChild(row); row.appendChild(btn('Yopish', () => this.close(), 'sec'));
  this.on({ go: () => H.start() });
};
