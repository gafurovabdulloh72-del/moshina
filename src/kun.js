// Kundalik tartib: o'yin soati hisobi, tetiklik (charchoq) va uyqu, ish jadvali (ertalabki non va h.k.), telefondagi «Bugungi reja» ilovasi
import { clamp } from './util.js';
import { JOBS } from './ish.js';
import { ACTIONS } from './controls.js';

const hm = (h) => { h = ((h % 24) + 24) % 24; const a = Math.floor(h), m = Math.floor((h - a) * 60); return `${a < 10 ? '0' : ''}${a}:${m < 10 ? '0' : ''}${m}`; };
// ish jadvali: [boshlanish, tugash, izoh] — vaqtida kelsangiz to'lov +30% (vaqtidan tashqarida ham ishlash mumkin, faqat bonussiz)
export const SCHED = { non: [6, 11, "Ertalab — non issiqligida"], taksi: [7, 22, 'Kunduzi va kechqurun'], dala: [8, 18, 'Kunduzi, quyosh botguncha'] };
export const SCHED_BONUS = 0.3;
const inSpan = (h, a, b) => h >= a && h < b;

export function initKun(game) {
  const st = game.state, pl = game.player, HY = game.hayot, L = game.live, IS = game.ish, PH = game.phone, IN = game.interior;
  const K = { last: null, subs: [], yawnT: 25, blinkT: 0, st: 0 }; game.kun = K;
  const toast = (m, k) => game.toast(m, k);
  if (typeof st.tetik !== 'number') st.tetik = 100;

  // ================= O'YIN SOATI =================
  // K.pass(soat) — o'tgan o'yin vaqti (uyqu ham) tinglovchilarga tarqatiladi: biznes daromadi, hovli hosili va h.k.
  K.on = (f) => K.subs.push(f);
  K.pass = (dh) => { if (!(dh > 0)) return; st.soat = (st.soat || 0) + dh; for (const f of K.subs) f(dh); };
  K.now = () => st.soat || 0;
  K.since = (t) => K.now() - (t || 0);

  // ================= TETIKLIK =================
  // uyg'oq vaqtda asta kamayadi (20 o'yin soatida 100 → 0), yugursangiz tezroq, o'tirsangiz biroz tiklanadi; uxlash — to'liq
  K.low = () => (st.tetik < 25 ? (25 - st.tetik) / 25 : 0); // 0 — tetik, 1 — juda charchagan
  const wake0 = HY.wake; HY.wake = () => { const S = HY.sleep, was = S && !S.done; wake0(); if (was) { st.tetik = S.nap ? Math.min(100, st.tetik + 35) : 100; K.bad = 0; setTimeout(() => toast(`😊 ${S.nap ? 'Mizg\'ib oldingiz' : 'Yaxshi uxladingiz'} — tetiklik ${Math.round(st.tetik)}%`, 'good'), 1600); } };
  const sleep0 = L.sleep; L.sleep = (h) => { sleep0(h); st.tetik = 100; };
  // choy va boshqa iliq ichimlik (piyola bilan) biroz tetiklashtiradi
  const act0 = pl.act.bind(pl); pl.act = (anim, dur, cb, tool) => act0(anim, dur, anim === 'drink' && tool === 'cup' ? () => { st.tetik = Math.min(100, st.tetik + 6); if (cb) cb(); } : cb, tool);
  // transportda: juda charchaganda rul biroz kechikib va yumshoqroq javob beradi (faqat kiritish — fizika o'zgarmaydi)
  const poll0 = game.input.poll.bind(game.input);
  game.input.poll = () => { const s = poll0(), k = K.low(); if (k <= 0) { K.st = s.steer; return s; } K.st += (s.steer * (1 - 0.12 * k) - K.st) * (1 - 0.4 * k); return Object.assign({}, s, { steer: K.st }); };
  // ko'z qovoqlari: chetlari qorayadi, ba'zan bir lahza yumiladi
  const veil = document.createElement('div'); veil.id = 'tired'; veil.style.cssText = 'position:fixed;inset:0;pointer-events:none;opacity:0;background:radial-gradient(ellipse at center,rgba(0,0,0,0) 42%,rgba(14,10,24,.55) 78%,rgba(8,6,16,.92) 100%)';
  const lid = document.createElement('div'); lid.style.cssText = 'position:fixed;inset:0;pointer-events:none;opacity:0;background:linear-gradient(rgba(8,6,16,.95),rgba(8,6,16,.35) 50%,rgba(8,6,16,.95));transition:opacity .18s';
  const uiEl = document.getElementById('ui'); document.body.insertBefore(veil, uiEl); document.body.insertBefore(lid, uiEl); // kanvas ustida, interfeys ostida
  const YAWN = ['😪 Esnadingiz… Ko\'zingiz yumilyapti — uyga borib uxlang', '😴 Charchadingiz — karavotda uxlasangiz tetiklik tiklanadi', '🥱 Uyqu bosyapti… Bir piyola choy ichib oling yoki dam oling'];
  K.update = (dt) => {
    let dh = K.last == null ? 0 : game.hour - K.last; if (dh < -12) dh += 24; K.last = game.hour; // birinchi kadrda (saqlovdan soat yuklangach) sakrash hisoblanmaydi
    if (dh > 0) { K.pass(dh); if (dh < 2 && game.mode === 'play' && !HY.sleep) { const run = pl.onFoot && pl.speed > 4.6, rate = pl.sit ? -3 : run ? 8 : !pl.onFoot ? 5.5 : 5; st.tetik = clamp(st.tetik - rate * dh, 0, 100); } }
    const k = K.low(), play = game.mode === 'play' && !(game.ui && game.ui.screenName);
    pl.speedMul = 1 - 0.18 * k;
    veil.style.opacity = play ? (k * 0.75).toFixed(2) : 0;
    if (k > 0.35 && play) { K.blinkT -= dt; if (K.blinkT <= 0) { K.blinkT = 6 + Math.random() * 8 * (1.2 - k); lid.style.opacity = 1; setTimeout(() => { lid.style.opacity = 0; }, 260 + 200 * k); } }
    if (k > 0 && play && !HY.sleep) { K.yawnT -= dt; if (K.yawnT <= 0) { K.yawnT = 70 - 30 * k; toast(`${YAWN[(K.yi = ((K.yi || 0) + 1)) % YAWN.length]} (tetiklik ${Math.round(st.tetik)}%)`, 'bad'); game.audio.sfx('click'); } }
    else if (!k) K.yawnT = 25;
  };

  // ================= ISH JADVALI =================
  K.jobOpen = (id, h = game.hour) => { const s = SCHED[id]; return !!s && inSpan(h, s[0], s[1]); };
  const NAME = { non: 'Karim aka', taksi: 'Lola opa', dala: 'Bobur aka' };
  for (const [fn, id] of [['startNon', 'non'], ['startTaksi', 'taksi'], ['startDala', 'dala']]) {
    const f0 = IS[fn]; IS[fn] = (...a) => { const r = f0(...a); const J = IS.cur; if (J && J.id === id && !J.schedSeen) { J.schedSeen = 1; const s = SCHED[id];
      if (K.jobOpen(id)) { J.sched = true; setTimeout(() => toast(`⏰ Ish vaqti (${hm(s[0])}–${hm(s[1])}) — to'lov +${Math.round(SCHED_BONUS * 100)}%`, 'gold'), 1200); }
      else setTimeout(() => toast(`${NAME[id]}: «Mayli, bugun ham qilaylik. Lekin ${hm(s[0])} dan ${hm(s[1])} gacha kelsangiz, ko'proq to'layman»`, ''), 1200); } return r; };
  }
  // vaqtida bajarilgan ish uchun qo'shimcha to'lov (ish hisobi J.earn o'zgarmaydi)
  const am0 = game.addMoney;
  game.addMoney = (n, why) => { am0(n, why); const J = IS.cur; if (n > 0 && J && J.sched && why && why.startsWith(JOBS[J.id][1])) { const b = Math.round(n * SCHED_BONUS); if (b > 0) { am0(b, 'Ish vaqti bonusi'); J.bonus = (J.bonus || 0) + b; } } };

  // ================= TELEFON: BUGUNGI REJA =================
  const next = (a, h) => { const d = a - h; return d >= 0 ? `bugun ${hm(a)} da` : `ertaga ${hm(a)} da`; };
  K.plan = () => { const h = game.hour, rows = [];
    for (const id of ['non', 'taksi', 'dala']) { const s = SCHED[id], on = inSpan(h, s[0], s[1]), cur = IS.cur && IS.cur.id === id, n = IS.pts[id];
      rows.push({ id: 'job:' + id, ic: JOBS[id][0], t: `${JOBS[id][1]} · ${hm(s[0])}–${hm(s[1])}`, s: cur ? 'Hozir bajarilmoqda ⏱' : on ? `Hozir vaqti — to'lov +${Math.round(SCHED_BONUS * 100)}%` : `${s[2]} · ${next(s[0], h)}`, ok: on, go: n ? [n.x, n.z] : null }); }
    if (inSpan(h, 12, 14.5)) rows.push({ id: 'lunch', ic: '🍵', t: 'Tushlik — choyxonada osh', s: 'Hozir tushlik vaqti', ok: true, go: (() => { const b = game.hayot2.bld.find((q) => q.kind === 'cafe'); return b ? [b.x, b.z] : null; })() });
    if (K.extraPlan) for (const r of K.extraPlan()) rows.push(r);
    const tired = st.tetik < 35, night = h >= 22 || h < 5;
    rows.push({ id: 'sleep', ic: '🛏', t: night ? 'Uxlash vaqti bo\'ldi' : 'Uyqu — 22:00 dan keyin', s: tired ? `Tetiklik ${Math.round(st.tetik)}% — dam olish kerak` : `Budilnik ${hm(st.alarm || 6.5)} · karavotda uxlang`, ok: night || tired, go: (() => { const hh = game.site.places.uy.home; return [hh.x, hh.z]; })() });
    return rows; };
  const bar = (v, col) => `<div style="height:8px;border-radius:5px;background:rgba(255,255,255,.15);overflow:hidden;margin-top:4px"><i style="display:block;height:100%;width:${Math.round(v)}%;background:${col}"></i></div>`;
  PH.apps.push(['kun', '📅', 'Bugungi reja', '#e0a030']);
  PH.ext.kun = (head) => { const h = game.hour, t = st.tetik, part = ['Tun', 'Tong', 'Kunduz', 'Shom'][h < 5 ? 0 : h < 10 ? 1 : h < 18 ? 2 : h < 21 ? 3 : 0];
    return head('📅 Bugungi reja') + `<div class="ph-card" style="background:linear-gradient(135deg,#e0a030,#d8602a)"><small>${part} · ${hm(h)}</small><b>${t < 25 ? '😴' : t < 50 ? '🥱' : '😊'} Tetiklik ${Math.round(t)}%</b>${bar(t, t < 25 ? '#ff5a4a' : '#fff')}<small style="margin-top:4px">🤝 Hurmat ${Math.floor(st.hurmat || 0)} · 💰 ${Math.round(st.money).toLocaleString('ru-RU')} so'm</small></div>
      <div class="ph-list">${K.plan().map((r) => `<div data-a="kgo:${r.id}"><span>${r.ic} ${r.t}<small style="display:block;opacity:.75;font-weight:600;color:${r.ok ? '#7fe08a' : 'inherit'}">${r.s}</small></span><b>${r.go ? '📍' : ''}</b></div>`).join('')}</div><p class="ph-empty">📍 — xaritada yo'l ko'rsatadi · <kbd>7</kbd> — shu ilovani ochadi</p>`; };
  PH.acts.kgo = (id) => { const r = K.plan().find((q) => q.id === id); if (!r || !r.go) return; game.setWaypoint(r.go[0], r.go[1]); game.ui.close(); toast(`📍 ${r.t} — yo'l ko'rsatildi`); };
  ACTIONS.splice(ACTIONS.findIndex((a) => a.key === 'N'), 0, { key: '7', codes: ['Digit7', 'Numpad7'], run: (g) => g.phone && g.phone.open('kun') }); // kun rejasi (telefon)

  // ================= HUD: tetiklik (piyoda panel, suv ostida) =================
  let hudOk = false;
  game.hooks.push((dt) => { if (game.mode === 'menu') return; K.update(dt);
    if (!game.ui) return; const $ = (id) => document.getElementById(id);
    if (!hudOk) { const th = $('h-thirst'); if (!th) return; hudOk = true; th.parentElement.insertAdjacentHTML('afterend', `<div class="fl">😴 Tetiklik</div><div class="bar"><i id="h-tetik" style="background:#f0c040"></i></div>`); }
    const v = Math.round(st.tetik); if (K._v !== v) { K._v = v; const e = $('h-tetik'); if (e) { e.style.width = v + '%'; e.style.background = v < 25 ? 'var(--bad)' : '#f0c040'; } } });
  void IN;
  return K;
}
