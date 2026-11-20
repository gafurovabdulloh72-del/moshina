// Yulduz yo'li (har 15 yulduzda sovg'a, eski saqlovlarda ham ochiladi) va transport mahorati (har transportda 5 nishon, «Usta» belgisi); «Poygalar» oynasidagi ikki bo'lim, ustaxona kartalari, HUD belgisi
import { UI } from './ui.js';
import { UPG } from './game.js';
import { VEHICLES, vehById } from './vehicles.js';
import { PAINTS } from './carmodel.js';
import { HAT_LIST, HAT_SHOP } from './rig.js';

const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const som = (n) => Math.round(n).toLocaleString('ru-RU');
export const STEP = 15; // har necha yulduzda sovg'a
// Yulduz yo'li sovg'alari: [tur, qiymat, zaxira pul (bosh kiyim allaqachon bo'lsa yoki tyuning to'la bo'lsa)]
export const ROAD = [['money', 300], ['kit', 1], ['money', 600], ['hat', 'kepka', 300], ['tune', 1, 900], ['money', 900], ['paint', 'yulduz'], ['kit', 2], ['money', 1200], ['hat', 'doppi', 500],
  ['tune', 1, 1500], ['money', 1500], ['paint', 'samoviy'], ['kit', 3], ['money', 2000], ['tune', 1, 2200], ['money', 2500], ['hat', 'toj', 3000]];
const HATN = Object.fromEntries([...HAT_LIST, ...HAT_SHOP].map((h) => [h[0], h[1]]));
export const rewardText = (r) => (r[0] === 'money' ? `${som(r[1])} so'm` : r[0] === 'kit' ? `${r[1]} ta ta'mir to'plami` : r[0] === 'hat' ? `${HATN[r[1]] || r[1]} (bosh kiyim)` : r[0] === 'paint' ? `«${(PAINTS.find((p) => p.id === r[1]) || {}).name.replace(/ \(.*\)$/, '')}» bo'yog'i` : 'Tekin tyuning bosqichi');
const RICON = { money: '💰', kit: '🧰', hat: '🎩', paint: '🎨', tune: '🔧' };
// Mahorat nishonlari: [id, belgi, nom, tavsif]
export const BADGES = [['km', '🛣', "10 km yo'l", "Shu transportda 10 km yuring"], ['medal', '🏅', 'Chellenj medali', 'Shu transportda biror chellenjda medal oling (Sovrinlar)'],
  ['tryuk', '🌀', 'Drift yoki tryuk', "Bir driftda 3 000 ochko yoki havoda toza tryuk"], ['toza', '🛡', 'Shikastsiz safar', "Urilmasdan ketma-ket 3 km yuring"], ['tez', '⚡', 'Tezlik chegarasi', "O'z eng yuqori tezligining 90 foiziga chiqing"]];
export const BADGE_PAY = 100, USTA_PAY = 400, USTA_PAINT = 5; // nishon puli, «Usta» puli, «Usta zumradi» bo'yog'i uchun Usta transportlar

export function initMahorat(game) {
  const st = game.state, ui = game.ui, car = game.car, K = game.tryuk, P = game.poyga;
  const D = () => ({ yy: [], veh: {} });
  if (!st.mahorat || typeof st.mahorat !== 'object') st.mahorat = D();
  { const d = D(), s = st.mahorat; if (!Array.isArray(s.yy)) s.yy = d.yy; if (!s.veh || typeof s.veh !== 'object') s.veh = d.veh; }
  const M = st.mahorat, toast = game.toast, sfx = (n) => game.audio.sfx(n);
  const H = (game.mahorat = { ROAD, STEP, BADGES });

  // ================= YULDUZ YO'LI =================
  H.stars = () => game.totalStars();
  H.open = () => Math.min(ROAD.length, Math.floor(H.stars() / STEP)); // ochilgan sovg'alar soni
  H.claimable = () => { let n = 0; for (let i = 0; i < H.open(); i++) if (!M.yy.includes(i)) n++; return n; };
  H.next = () => { const o = H.open(); return o >= ROAD.length ? null : { i: o, need: (o + 1) * STEP - H.stars() }; };
  const tuneFree = () => { let best = null; for (const u of UPG) { const lv = st.up[u.id] || 0; if (lv < u.max && (!best || u.cost[lv] < best[1])) best = [u, u.cost[lv]]; } return best && best[0]; };
  H.claim = (i) => {
    if (i < 0 || i >= H.open() || M.yy.includes(i)) return null;
    const r = ROAD[i]; let text = rewardText(r);
    if (r[0] === 'money') game.addMoney(r[1], "Yulduz yo'li");
    else if (r[0] === 'kit') st.inv.kit = (st.inv.kit || 0) + r[1];
    else if (r[0] === 'hat') { if (st.hats.includes(r[1])) { game.addMoney(r[2], "Yulduz yo'li"); text = `${som(r[2])} so'm (${HATN[r[1]]} allaqachon bor)`; } else st.hats.push(r[1]); }
    else if (r[0] === 'paint') { if (!st.paints.includes(r[1])) st.paints.push(r[1]); }
    else if (r[0] === 'tune') { const u = tuneFree(); if (u) { st.up[u.id]++; game.applyUpgrades(); text = `Tekin tyuning: ${u.name} ${st.up[u.id]}-daraja`; } else { game.addMoney(r[2], "Yulduz yo'li"); text = `${som(r[2])} so'm (tyuning to'la)`; } }
    M.yy.push(i); st.xp += 30; yyT = 0; sfx('win'); game.save();
    toast(`🎁 Yulduz yo'li · ${(i + 1) * STEP} ★ — ${text}`, 'gold');
    H.last = { i, text }; return H.last;
  };
  H.claimAll = () => { const out = []; for (let i = 0; i < H.open(); i++) if (!M.yy.includes(i)) out.push(H.claim(i)); return out; };
  // HUD: «🎁 2» — olinmagan sovg'a bo'lsa
  const chip = el('div', 'chip'); chip.id = 'h-yy'; chip.style.display = 'none'; chip.title = "Yulduz yo'li — sovg'alar"; chip.onclick = () => { sfx('click'); if (game.mode === 'play') ui.open('poyga', { tab: 'yy' }); };
  const tl = ui.hud.querySelector('.tl'); if (tl) tl.appendChild(chip);
  let yyT = 0, seen = H.open(), hello = 8;
  const yyTick = (dt) => {
    if ((yyT -= dt) > 0) return; yyT = 1;
    const o = H.open(), n = H.claimable(), s = n ? `🎁 <b>${n}</b>` : ''; if (chip.innerHTML !== s) chip.innerHTML = s; chip.style.display = n ? '' : 'none';
    if (o > seen && game.mode === 'play') { game.banner("Yulduz yo'li: yangi sovg'a!", `${o * STEP} yulduz — ${rewardText(ROAD[o - 1])}. «Poygalar» [1] yoki 🎁 belgisi`, 'gold'); sfx('medal'); }
    seen = Math.max(seen, o);
    if (hello > 0 && game.mode === 'play' && (hello -= 1) <= 0 && n) toast(`🎁 Yulduz yo'li: ${n} ta sovg'a sizni kutyapti — «Poygalar» [1]`, 'gold'); // eski saqlov: allaqachon yig'ilgan yulduzlar uchun
  };

  // ================= TRANSPORT MAHORATI =================
  const rec = (id) => M.veh[id] || (M.veh[id] = { km: 0, dr: 0, top: 0, trip: 0, tb: 0, tr: 0, b: 0, u: 0 });
  H.rec = rec;
  const medals = (id) => { if (!K || !K.vehCounts) return 0; const c = K.vehCounts(id); return c[1] + c[2] + c[3]; };
  const done = (id, k) => { const m = M.veh[id] || rec(id), v = vehById[id] || vehById.jip; return k === 'km' ? m.km >= 10000 : k === 'medal' ? medals(id) >= 1 : k === 'tryuk' ? m.dr >= 3000 || m.tr >= 1 : k === 'toza' ? m.tb >= 3000 : m.top >= Math.floor(v.spec.top * 0.9); };
  H.prog = (id, k) => { const m = M.veh[id] || { km: 0, dr: 0, top: 0, tb: 0, tr: 0 }, v = vehById[id] || vehById.jip; return k === 'km' ? `${(Math.min(m.km, 10000) / 1000).toFixed(1)}/10 km` : k === 'medal' ? `${medals(id)} medal` : k === 'tryuk' ? `drift ${som(m.dr)}/3 000${m.tr ? ` · ${m.tr} tryuk` : ''}` : k === 'toza' ? `${(Math.min(m.tb, 3000) / 1000).toFixed(1)}/3 km` : `${m.top}/${Math.floor(v.spec.top * 0.9)} km/soat`; };
  H.count = (id) => { const m = M.veh[id]; let n = 0; if (m) for (let i = 0; i < BADGES.length; i++) if (m.b & (1 << i)) n++; return n; };
  H.ustaN = () => Object.keys(M.veh).filter((id) => M.veh[id].u).length;
  H.check = (id = st.veh.cur) => {
    const m = rec(id), vn = (vehById[id] || {}).name, got = [];
    BADGES.forEach(([k, ic, n], i) => { if (m.b & (1 << i) || !done(id, k)) return; m.b |= 1 << i; got.push(k); game.addMoney(BADGE_PAY, 'Transport mahorati'); st.xp += 15; toast(`${ic} Mahorat nishoni — ${vn}: ${n} · +${BADGE_PAY} so'm (${H.count(id)}/5)`, 'gold'); sfx('medal'); });
    if (got.length && H.count(id) === BADGES.length && !m.u) {
      m.u = 1; game.addMoney(USTA_PAY, '«Usta» belgisi'); st.xp += 60;
      const paint = H.ustaN() >= USTA_PAINT && !st.paints.includes('usta'); if (paint) st.paints.push('usta');
      game.banner(`Usta: ${vn}!`, `Beshala mahorat nishoni yig'ildi · +${USTA_PAY} so'm${paint ? ` · ${USTA_PAINT} ta «Usta» — ustaxonada «Usta zumradi» bo'yog'i ochildi` : ''}`, 'gold'); sfx('win');
    }
    if (got.length) { H.lastGot = { id, got }; game.save(); }
    return got;
  };
  // kuzatuv: masofa, shikastsiz yo'l, eng yuqori tezlik, drift, tryuk (faqat o'zi haydaganda)
  let lastId = null, lp = null, c0 = st.stats.crashes, ds0 = 0, trick0 = K ? K.lastTrick : null, chkT = 0;
  const mTick = (dt) => {
    const ok = game.mode === 'play' && !game.player.onFoot && !(game.suv && game.suv.cur) && !(game.coop && game.coop.ride) && !(game.interior && game.interior.inside);
    const id = st.veh.cur, p = car.p;
    if (!ok) { lp = null; return; }
    const m = rec(id); if (id !== lastId) { lastId = id; m.trip = 0; lp = null; c0 = st.stats.crashes; ds0 = game.driftScore || 0; }
    if (lp) { const dd = Math.hypot(p[0] - lp[0], p[2] - lp[1]); if (dd < 5) { m.km += dd; m.trip += dd; if (m.trip > m.tb) m.tb = m.trip; } }
    lp = [p[0], p[2]];
    if (st.stats.crashes > c0) { m.trip = 0; c0 = st.stats.crashes; }
    const kmh = Math.round(Math.abs(car.speed) * 3.6); if (kmh > m.top && car.onGround >= 2) m.top = kmh;
    const ds = game.driftScore || 0; if (ds > ds0 && ds > m.dr) m.dr = Math.round(ds); ds0 = ds;
    if (K && K.lastTrick !== trick0) { trick0 = K.lastTrick; if (trick0) m.tr++; }
    if ((chkT -= dt) <= 0) { chkT = 0.5; H.check(id); }
  };
  game.hooks.push((dt) => { yyTick(dt); mTick(dt); });

  // ustaxona: transport kartasida mahorat
  const pips = (id) => BADGES.map(([k, ic, n], i) => `<i class="${(M.veh[id] && M.veh[id].b & (1 << i)) ? 'on' : ''}" title="${n}: ${H.prog(id, k)}">${ic}</i>`).join('');
  H.pips = pips;
  const vc = ui.vehCard;
  ui.vehCard = function (v, ...rest) { const h = vc.call(this, v, ...rest), m = M.veh[v.id]; const line = `<div class="mh-line"><span>Mahorat ${H.count(v.id)}/5${m && m.u ? ' · <b>Usta</b>' : ''}</span><span class="mh-pips">${pips(v.id)}</span></div>`; const i = h.lastIndexOf('<button'); return i < 0 ? h : h.slice(0, i) + line + h.slice(i); };
  // pasportda: keyingi sovg'agacha
  const pr0 = ui.s_progress;
  ui.s_progress = function (w, d, btn, x) { pr0.call(this, w, d, btn, x); const nx = H.next(), n = H.claimable(); const b = btn(`🎁 Yulduz yo'li · ${H.open()}/${ROAD.length} sovg'a${n ? ` · ${n} ta olinmagan` : nx ? ` · keyingisigacha ${nx.need} ★` : ''}`, () => this.open('poyga', { tab: 'yy' }), n ? '' : 'sec'); b.style.marginTop = '8px'; w.appendChild(b); };

  // «Poygalar» oynasidagi bo'limlar: [id, nom, tana, telefon xulosasi, tugmalar]
  if (P && P.tabs) {
    P.tabs.push(['yy', "🎁 Yulduz yo'li", function () {
      const s = H.stars(), o = H.open(), nx = H.next(), n = H.claimable(), pct = Math.min(100, (s / (ROAD.length * STEP)) * 100);
      return `<div class="pg-big"><div><b>★ ${s}</b><small>jami yulduz (${game.maxStars} dan)</small></div><div><b>${M.yy.length}/${ROAD.length}</b><small>olingan sovg'alar</small></div><div><b>${nx ? nx.need + ' ★' : '✔'}</b><small>${nx ? "keyingi sovg'agacha" : "hammasi ochildi"}</small></div></div>
        <p class="sub">Har ${STEP} yulduzda bitta sovg'a: pul, ta'mir to'plami, tekin tyuning, sovrinli bo'yoq yoki bosh kiyim. Yulduzlar chellenjlardan keladi (pasport). Oldin yig'ilgan yulduzlar ham hisoblanadi.</p>
        ${n ? `<button data-a="yyall" style="margin-bottom:10px">🎁 Hammasini olish (${n})</button>` : ''}
        <div class="yy-bar"><i style="width:${pct.toFixed(1)}%"></i></div>
        <div class="yy-road">${ROAD.map((r, i) => { const got = M.yy.includes(i), open = i < o; return `<div class="yy-n ${got ? 'got' : open ? 'open' : ''}"><em>${(i + 1) * STEP}★</em><i>${RICON[r[0]]}</i><span>${rewardText(r)}</span>${got ? '<small>✔ olindi</small>' : open ? `<button data-a="yy:${i}">Olish</button>` : `<small>yana ${(i + 1) * STEP - s} ★</small>`}</div>`; }).join('')}</div>`;
    }, () => { const n = H.claimable(), nx = H.next(); return n ? `${n} ta sovg'a olinmagan` : nx ? `keyingisigacha ${nx.need} ★` : 'hammasi olindi'; },
    function () { return { yy: (i) => { H.claim(+i); this.open('poyga', { tab: 'yy' }); }, yyall: () => { H.claimAll(); this.open('poyga', { tab: 'yy' }); } }; }]);
    P.tabs.push(['mah', '🎖 Transport mahorati', function () {
      const tot = VEHICLES.reduce((s, v) => s + H.count(v.id), 0), own = st.veh.own;
      return `<div class="pg-big"><div><b>${tot}/${VEHICLES.length * BADGES.length}</b><small>mahorat nishonlari</small></div><div><b>${H.ustaN()}</b><small>«Usta» transportlar</small></div><div><b>${VEHICLES.filter((v) => own.includes(v.id)).length}/${VEHICLES.length}</b><small>garajingizda</small></div></div>
        <p class="sub">Har transportning besh nishoni: ${BADGES.map((b) => `${b[1]} ${b[2].toLowerCase()} (${b[3].toLowerCase()})`).join(', ')}. Har nishon +${BADGE_PAY} so'm, beshtasi — «Usta» belgisi (+${USTA_PAY} so'm); ${USTA_PAINT} ta «Usta» — «Usta zumradi» bo'yog'i.</p>
        <div class="pg-tab mh-tab"><table><tr><th>Transport</th>${BADGES.map((b) => `<th title="${b[3]}">${b[1]}</th>`).join('')}<th></th></tr>${VEHICLES.map((v) => { const m = M.veh[v.id], has = own.includes(v.id); return `<tr class="${v.id === st.veh.cur ? 'cur' : ''}${has ? '' : ' no'}"><td>${v.name}${m && m.u ? ' <b class="mh-u">Usta</b>' : ''}</td>${BADGES.map(([k, , n], i) => { const on = m && m.b & (1 << i); return `<td class="${on ? 'on' : ''}" title="${n}">${on ? '✔' : `<small>${has ? H.prog(v.id, k) : '—'}</small>`}</td>`; }).join('')}<td>${H.count(v.id)}/5</td></tr>`; }).join('')}</table></div>`;
    }, () => `${VEHICLES.reduce((s, v) => s + H.count(v.id), 0)}/${VEHICLES.length * BADGES.length} nishon · ${H.ustaN()} Usta`]);
  }

  const css = el('style'); css.textContent = `
#h-yy{pointer-events:auto;cursor:pointer;border-color:var(--ac);animation:yyp 1.6s ease-in-out infinite}@keyframes yyp{50%{box-shadow:0 0 14px rgba(255,200,58,.55)}}
.yy-bar{height:8px;border-radius:5px;background:rgba(255,255,255,.12);overflow:hidden;margin:4px 0 10px}.yy-bar i{display:block;height:100%;background:linear-gradient(90deg,#ffd23a,#ff9a3a);border-radius:5px}
.yy-road{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:7px}
.yy-n{position:relative;display:flex;flex-direction:column;align-items:center;gap:3px;padding:9px 8px 8px;border-radius:12px;background:rgba(255,255,255,.04);border:1px solid var(--bd);text-align:center;font-size:12.5px;line-height:1.25;opacity:.62}
.yy-n em{font-style:normal;font-weight:900;color:var(--mut);font-size:12px}.yy-n i{font-style:normal;font-size:24px;filter:grayscale(1)}.yy-n small{color:var(--mut)}
.yy-n.open{opacity:1;border-color:var(--ac);background:rgba(255,200,58,.12)}.yy-n.open i,.yy-n.got i{filter:none}.yy-n.open em{color:var(--ac)}.yy-n button{min-height:30px;padding:3px 14px;font-size:12.5px;margin-top:2px}
.yy-n.got{opacity:.9;background:rgba(80,200,120,.1)}.yy-n.got small{color:var(--good)}
.mh-line{display:flex;justify-content:space-between;align-items:center;margin:6px 0 2px;font-size:12.5px;color:var(--mut)}.mh-line b{color:var(--ac)}
.mh-pips i{font-style:normal;margin-left:3px;filter:grayscale(1);opacity:.35}.mh-pips i.on{filter:none;opacity:1}
.mh-tab td{text-align:center}.mh-tab td:first-child,.mh-tab th:first-child{text-align:left}.mh-tab th{text-align:center}.mh-tab td.on{color:var(--good);font-weight:900}.mh-tab td small{color:var(--mut);font-size:11px}
.mh-tab tr.cur td:first-child{color:var(--ac);font-weight:800}.mh-tab tr.no{opacity:.5}.mh-u{color:var(--ac);font-size:11px;border:1px solid var(--ac);border-radius:6px;padding:0 4px}`;
  document.head.appendChild(css);
  return H;
}
