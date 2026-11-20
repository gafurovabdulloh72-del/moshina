// Kunlik uchlik (har haqiqiy kuni 3 ta topshiriq, kun sandig'i, ketma-ketlik) va yutuqlar daftari (61 nishon, maqollar): tekshiruv, mukofot, oyna ([9]/[0]), telefon ilovasi, HUD belgisi
import { dayIndex, GROUPS, dailyDef, dailyFor, chestReward, ACHS, ACH_CATS, achGoal, achValue } from './kunlik.js';
import { VEHICLES } from './vehicles.js';
import { BADGES } from './hafta.js';

const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const som = (n) => Math.round(n).toLocaleString('ru-RU');
const fmtN = (v, goal) => (goal >= 1000 ? som(v) : goal < 20 && v % 1 ? v.toFixed(1) : String(Math.floor(v)));

export function initYutuq(game) {
  const st = game.state, ui = game.ui, q = st.qulay, Q = game.qulay;
  const Y = (game.yutuq = { dayOverride: null, pending: [] });
  const placeIds = Object.keys(game.site.places).filter((id) => id !== 'uy' && game.site.places[id].board);
  // o'yindan olinadigan hisoblar (kunlik.js qoidalari uchun)
  Y.ctx = () => { let jobs = 0; for (const k in st.jobs) jobs += (st.jobs[k] && st.jobs[k].n) || 0;
    return { stars: game.totalStars(), maxStars: game.maxStars, veh: st.veh.own.length, vehN: VEHICLES.length, places: Object.keys(st.places).filter((k) => game.site.places[k]).length, placesN: Object.keys(game.site.places).length,
      chestN: game.chestTotal, stamps: game.stampCount(), level: game.level(), jobs, haftaB: Object.keys((st.hafta && st.hafta.badges) || {}).length, biz: Object.keys(st.biz || {}).filter((k) => st.biz[k] && st.biz[k].lvl > 0).length,
      album: Object.keys(st.seen || {}).length, albumN: (game.live && game.live.albumTotal) || 25, streak: Y.streak(), chests: q.chests, guide: q.guide === 99 ? 1 : 0, win: q.win, starsGot: game.totalStars(), visit: q.day && q.day.vis ? 1 : 0, placeIds }; };

  // ================= KUNLIK UCHLIK =================
  Y.today = () => (Y.dayOverride != null ? Y.dayOverride : dayIndex());
  Y.streak = () => (q.last >= Y.today() - 1 ? q.streak : 0);
  const counter = (t, X) => (t.id === 'visit' ? (q.day && q.day.vis ? 1 : 0) : +dailyDef(t.id)[4](st, X) || 0);
  const mk = (t, X) => ({ id: t.id, goal: t.goal, rw: t.rw, place: t.place, base: t.id === 'visit' ? 0 : counter(t, X), done: 0 });
  Y.day = () => { const d = Y.today(); if (q.day && q.day.d === d && Array.isArray(q.day.list) && q.day.list.length === 3) return q.day; const X = Y.ctx(); q.day = { d, swap: 0, chest: 0, vis: 0, list: [] }; q.day.list = dailyFor(d, st, X).map((t) => mk(t, X)); return q.day; };
  Y.prog = (t, X = Y.ctx()) => (t.done ? t.goal : Math.max(0, Math.min(t.goal, counter(t, X) - t.base)));
  Y.text = (t) => (t.id === 'visit' ? `${(game.site.places[t.place] || { name: 'Manzil' }).name} manziliga boring` : dailyDef(t.id)[2](t.goal));
  Y.swap = (i) => { const D = Y.day(), t = D.list[i]; if (!t || D.swap || t.done) return false; const X = Y.ctx(), n = dailyFor(D.d, st, X, i, t.id)[i]; D.list[i] = mk(n, X); D.swap = 1; game.audio.sfx('click'); return true; };
  Y.checkDaily = () => {
    const D = Y.day(), X = Y.ctx(); let got = 0;
    for (const t of D.list) { if (t.id === 'visit' && game.curPlace && game.curPlace.id === t.place) D.vis = 1; }
    for (const t of D.list) { if (t.done || Y.prog(t, X) < t.goal) continue; t.done = 1; got++; game.addMoney(t.rw, 'Kunlik uchlik'); st.xp += 15; game.toast(`✅ Kunlik: ${Y.text(t)} · +${t.rw} so'm`, 'gold'); game.audio.sfx('medal'); }
    if (!D.chest && D.list.every((t) => t.done)) {
      D.chest = 1; q.streak = q.last === D.d - 1 ? q.streak + 1 : q.last === D.d ? q.streak : 1; q.last = D.d; q.chests++;
      const rw = chestReward(D.d) + 50 * Math.min(6, q.streak - 1); game.addMoney(rw, "Kun sandig'i"); st.inv.gem = (st.inv.gem || 0) + 1; st.xp += 40;
      Y.pending.push(["🎁 Kun sandig'i ochildi!", `+${som(rw)} so'm · 💎 qimmatbaho tosh · ketma-ket ${q.streak} kun`, 'gold']); game.save();
    } else if (got) game.save();
    return got;
  };

  // ================= YUTUQLAR =================
  Y.list = ACHS;
  Y.unlocked = () => Object.keys(q.ach).filter((k) => ACHS.some((a) => a[0] === k)).length;
  Y.check = (quiet = false) => {
    const X = Y.ctx(), now = []; for (const a of ACHS) if (!q.ach[a[0]] && achValue(a, st, X) >= achGoal(a, X)) { q.ach[a[0]] = Math.round(st.stats.time) || 1; now.push(a); }
    if (!now.length) return now; const sum = now.reduce((s, a) => s + a[6], 0); game.addMoney(sum, 'Yutuqlar');
    if (quiet || now.length > 3) Y.pending.push([`📖 ${now.length} ta yutuq ochildi!`, `+${som(sum)} so'm · Yutuqlar daftari — <b>9</b>`, 'gold']);
    else for (const a of now) Y.pending.push([`${a[1]} Yutuq: ${a[2]}`, `«${a[7]}» · +${som(a[6])} so'm`, 'gold']);
    game.save(); return now;
  };
  // birinchi ishga tushishda (eski saqlov) — avval qo'lga kiritilganlar bitta xabar bilan
  if (!q.achInit) { q.achInit = 1; if (Q.live) Y.check(true); }

  // ================= OYNA: kunlik uchlik + yutuqlar daftari =================
  const css = el('style'); css.textContent = `
#screen.yutuqlar .winwrap{width:min(940px,94vw)}
.yt-tabs{display:flex;gap:6px;margin:4px 0 12px;flex-wrap:wrap}.yt-tabs button{padding:8px 14px;font-size:14px}.yt-tabs button.on{background:var(--ac);color:#141824}
.yt-day{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
.yt-t{padding:12px 13px;border-radius:14px;background:rgba(255,255,255,.06);border:1px solid var(--bd);display:flex;flex-direction:column;gap:6px}
.yt-t.done{border-color:var(--good);background:rgba(95,211,138,.1)}.yt-t small{color:var(--mut);font-weight:800;font-size:11.5px;letter-spacing:.3px}
.yt-t b{font-size:15px}.yt-t .bar{margin:2px 0 0}.yt-t .m{display:flex;justify-content:space-between;align-items:center;font-size:13px;font-weight:800}.yt-t button{padding:5px 10px;font-size:12.5px}
.yt-chest{margin-top:12px;padding:12px 14px;border-radius:14px;border:1px dashed var(--ac);display:flex;gap:12px;align-items:center;font-size:14px}.yt-chest.on{border-style:solid;background:rgba(255,200,58,.1)}.yt-chest i{font-size:30px;font-style:normal}
.yt-sum{display:flex;align-items:center;gap:12px;margin:2px 0 8px;font-size:14px;font-weight:800}.yt-sum .bar{flex:1;margin:0;height:10px}.yt-sum .bar i{background:var(--ac)}
.yt-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:9px}
.yt-a{display:flex;gap:10px;padding:10px 11px;border-radius:13px;background:rgba(255,255,255,.05);border:1px solid var(--bd)}.yt-a>i{font-style:normal;font-size:28px;line-height:1.1;width:34px;text-align:center}
.yt-a>div{flex:1;min-width:0}.yt-a b{display:block;font-size:14.5px}.yt-a p{margin:2px 0 0;font-size:12.5px;color:#cfd6e6;line-height:1.35}.yt-a em{display:block;margin-top:4px;font-size:12.5px;color:#ffe9a8}
.yt-a.on{border-color:rgba(255,200,58,.55);background:rgba(255,200,58,.08)}.yt-a.off>i{filter:grayscale(1);opacity:.45}.yt-a .bar{height:6px;margin-top:5px}.yt-a .bar i{background:var(--blue)}.yt-a small{color:var(--mut);font-size:11.5px;font-weight:700}
.yt-hb{display:flex;flex-wrap:wrap;gap:6px;margin-top:12px;align-items:center;font-size:13px}.yt-hb span{padding:4px 9px;border-radius:999px;background:rgba(255,255,255,.08)}.yt-hb span.on{background:rgba(255,200,58,.2)}
@media(max-width:720px){.yt-day{grid-template-columns:1fr}}
#h-kun{pointer-events:auto;cursor:pointer}
`;
  document.head.appendChild(css);
  const dayHtml = (compact) => { const D = Y.day(), X = Y.ctx(), sk = Y.streak();
    const cards = D.list.map((t, i) => { const p = Y.prog(t, X), g = t.goal, def = dailyDef(t.id);
      return `<div class="yt-t${t.done ? ' done' : ''}"><small>${GROUPS[def ? def[1] : i]}</small><b>${Y.text(t)}</b><div class="bar"><i style="width:${Math.round(p / g * 100)}%"></i></div><div class="m"><span>${t.done ? '✔ Bajarildi' : `${fmtN(p, g)} / ${g}`}</span><span>+${t.rw} so'm</span></div>${!t.done && !D.swap && !compact ? `<button class="sec" data-a="swap:${i}">↻ Almashtirish (kuniga 1 marta)</button>` : ''}</div>`; }).join('');
    return `<div class="yt-day">${cards}</div><div class="yt-chest${D.chest ? ' on' : ''}"><i>${D.chest ? '🎁' : '🧰'}</i><div><b>Kun sandig'i</b> — ${D.chest ? 'bugun ochildi!' : `uchalasini bajaring: ${som(chestReward(D.d))} so'm + 💎`}<br><small style="color:var(--mut)">Ketma-ket: <b style="color:var(--ac)">${sk} kun</b> (har kun +50 so'm, 7 kungacha) · jami sandiqlar: ${q.chests} · topshiriqlar yarim tunda yangilanadi</small></div></div>`; };
  Y.dayHtml = dayHtml;
  const achHtml = (cat) => { const X = Y.ctx(), n = Y.unlocked(), list = ACHS.filter((a) => !cat || a[9] === cat);
    const cards = list.map((a) => { const on = !!q.ach[a[0]], goal = achGoal(a, X), v = Math.min(goal, achValue(a, st, X));
      if (!on && a[8]) return `<div class="yt-a off"><i>❓</i><div><b>Yashirin yutuq</b><p>Sharti sir — o'ynab, o'zingiz toping.</p><small>+${som(a[6])} so'm</small></div></div>`;
      return `<div class="yt-a ${on ? 'on' : 'off'}"><i>${a[1]}</i><div><b>${a[2]}</b><p>${a[3]}</p>${on ? `<em>«${a[7]}»</em><small>✔ Olingan · +${som(a[6])} so'm</small>` : `<div class="bar"><i style="width:${Math.round(v / goal * 100)}%"></i></div><small>${fmtN(v, goal)} / ${som(goal)} · +${som(a[6])} so'm</small>`}</div></div>`; }).join('');
    const hb = st.hafta && st.hafta.badges ? st.hafta.badges : {};
    return `<div class="yt-sum"><span>📖 ${n} / ${ACHS.length}</span><div class="bar"><i style="width:${Math.round(n / ACHS.length * 100)}%"></i></div></div><div class="yt-tabs">${[['', 'Hammasi'], ...ACH_CATS].map(([k, t]) => `<button class="sec${(cat || '') === k ? ' on' : ''}" data-a="cat:${k}">${t}</button>`).join('')}</div><div class="yt-grid">${cards}</div>
      <div class="yt-hb"><b>📅 Haftalik nishonlar:</b>${BADGES.map(([id, ic, nm]) => `<span class="${hb[id] ? 'on' : ''}" title="${nm}">${ic} ${nm}</span>`).join('')}<button class="sec" data-a="hafta" style="padding:5px 10px;font-size:12.5px">Hafta oynasi ›</button></div>`; };
  ui.s_yutuqlar = function (w, d, btn, x) {
    x(); d = d || {}; let tab = d.tab || 'kun', cat = '';
    const draw = () => { w.innerHTML = `<h1>${tab === 'kun' ? '✅ Kunlik uchlik' : '📖 Yutuqlar daftari'} <small>${tab === 'kun' ? `bugun: ${Y.day().list.filter((t) => t.done).length}/3` : `${Y.unlocked()} / ${ACHS.length}`}</small></h1><div class="yt-tabs"><button class="sec${tab === 'kun' ? ' on' : ''}" data-a="tab:kun">✅ Kunlik uchlik <kbd style="margin-left:4px">0</kbd></button><button class="sec${tab === 'ach' ? ' on' : ''}" data-a="tab:ach">📖 Yutuqlar daftari <kbd style="margin-left:4px">9</kbd></button></div>${tab === 'kun' ? dayHtml() : achHtml(cat)}`; };
    this.on({ tab: (t) => { tab = t; draw(); }, cat: (c) => { cat = c; draw(); }, swap: (i) => { if (Y.swap(+i)) game.save(); draw(); }, hafta: () => this.open('hafta') });
    draw();
  };
  // pasportga havola
  const pr0 = ui.s_progress;
  ui.s_progress = function (w, d, btn, x) { pr0.call(this, w, d, btn, x); const b = btn(`📖 Yutuqlar daftari · ${Y.unlocked()}/${ACHS.length}`, () => this.open('yutuqlar', { tab: 'ach' }), 'sec'); b.style.marginTop = '12px'; w.appendChild(b); };
  // telefon ilovasi
  const PH = game.phone;
  if (PH && PH.apps) {
    PH.apps.push(['kun3', '✅', 'Kunlik uchlik', '#3a9a5a']);
    PH.ext.kun3 = (head) => { const D = Y.day(), X = Y.ctx(); return head('✅ Kunlik uchlik') + `<div class="ph-list">${D.list.map((t, i) => `<div${!t.done && !D.swap ? ` data-a="k3swap:${i}"` : ''}><span>${t.done ? '✔ ' : ''}${Y.text(t)}<small>${t.done ? 'Bajarildi' : `${fmtN(Y.prog(t, X), t.goal)} / ${t.goal}${!D.swap ? ' · bosing — almashtirish' : ''}`}</small></span><b>+${t.rw}</b></div>`).join('')}</div><p class="ph-empty">🎁 Kun sandig'i: ${D.chest ? 'ochildi' : som(chestReward(D.d)) + " so'm + 💎"} · ketma-ket ${Y.streak()} kun</p><button class="sec" data-a="k3book" style="margin:6px 14px">📖 Yutuqlar daftari · ${Y.unlocked()}/${ACHS.length}</button>`; };
    PH.acts.k3swap = (i, b, render) => { if (Y.swap(+i)) game.save(); render(); };
    PH.acts.k3book = () => ui.open('yutuqlar', { tab: 'ach' });
  }
  Y.open = (tab) => { if (game.mode === 'play') ui.open('yutuqlar', { tab }); };
  // HUD: «✅ 1/3» belgisi (bosilsa — oyna)
  const chip = el('div', 'chip'); chip.id = 'h-kun'; chip.style.display = 'none'; chip.title = 'Kunlik uchlik [0]'; chip.onclick = () => { game.audio.sfx('click'); Y.open('kun'); };
  const tl = ui.hud.querySelector('.tl'); if (tl) tl.appendChild(chip);
  let chipV = '';
  const drawChip = () => { const D = Y.day(), n = D.list.filter((t) => t.done).length, v = Q.live ? `✅ <b>${n}/3</b>` : ''; if (v !== chipV) { chipV = v; chip.innerHTML = v; chip.style.display = v ? '' : 'none'; } };

  // ================= KADR SIKLI =================
  let acc = 0;
  game.hooks.push((dt) => {
    const hid = !!game.act; if (chip._h !== hid) { chip._h = hid; chip.style.visibility = hid ? 'hidden' : ''; } // chellenj panelining ostida qolmasin
    if ((acc += dt || 0) > 1) { acc = 0; if (Q.live) { Y.checkDaily(); Y.check(); } drawChip(); }
    if (Y.pending.length && !ui.screenName && game.mode === 'play') { const [a, b, k] = Y.pending.shift(); ui.banner(a, b, k); ui.toast(a, k); game.audio.sfx('medal'); }
  });
  return Y;
}
