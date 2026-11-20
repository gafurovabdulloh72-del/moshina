// Savdo va hunar: manzillar orasida savdo (har joyda va har kuni boshqa narx, transport sig'imi), asalarichilik (Oltin o'rmon — uyalar o'yin vaqtida asal yig'adi), kulolchilik (Ko'hna qal'a — charx, aniq bosish o'yini), gilamdo'zlik (Karvonsaroy — naqshni eslab qolish o'yini)
import * as THREE from 'three';
import * as T from './terrain.js';
import * as COL from './colliders.js';
import { GB, MAT } from './geo.js';
import { UI } from './ui.js';
import { vehById } from './vehicles.js';
import { clamp } from './util.js';

const som = (n) => Math.round(n).toLocaleString('ru-RU');
// tovarlar: [belgi, nom, asosiy narx, arzon joylar, qimmat joylar]
export const GOODS = {
  qovun: ['🍈', 'Qovun', 40, ['bogiston', 'tegirmon'], ['lager', 'choqqi', 'muzkol', 'mayoq']],
  qoq: ['🐟', 'Baliq qoqi', 55, ['bandargoh', 'mayoq'], ['karvon', 'dara', 'lager', 'qala']],
  tuz: ['🧂', 'Tuz', 30, ['karvon', 'dara'], ['bandargoh', 'ormon', 'kol', 'lager']],
  ziravor: ['🌶', 'Ziravor', 70, ['karvon', 'aerodrom'], ['lager', 'mayoq', 'ormon', 'kol']],
  yongoq: ['🌰', "Yong'oq", 50, ['ormon', 'kol'], ['karvon', 'bandargoh', 'aerodrom', 'dara']],
  asal: ['🍯', 'Asal', 65, ['ormon'], ['karvon', 'lager', 'bandargoh', 'aerodrom']],
  sopol: ['🏺', 'Sopol idish', 120, ['qala'], ['bandargoh', 'mayoq', 'aerodrom', 'lager']],
  gilam: ['🧶', 'Gilam', 280, ['karvon'], ['mayoq', 'bandargoh', 'lager', 'bogiston']],
};
const ONLY = { asal: 'asalarichilik', sopol: 'kulolchilik', gilam: 'gilamdo\'zlik' }; // bozorda faqat sotiladi (o'zingiz tayyorlaysiz)
const CARGO = { bike: 4, open: 6, car: 10, jeep: 12, tractor: 14, van: 18, bus: 24, truck: 30 };
const h32 = (a, b, c) => { let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };

export function initSavdo(game, D) {
  const { scene, car } = game, st = game.state, pl = game.player, S = D.S, K = game.kun;
  const toast = (m, k) => game.toast(m, k), sfx = (n, k) => game.audio.sfx(n, k), fx = () => game.fx, gy = D.gy, places = game.site.places;
  const mesh = (g) => { const m = new THREE.Mesh(g.build(), MAT.flat); m.castShadow = true; m.receiveShadow = true; return m; };
  const giverAt = (id, pid, seed, name, look, r0 = 8, r1 = 45) => { const b = places[pid] && (places[pid].board || places[pid]); if (!b) return null; const p = D.spotNear(b.x, b.z, r0, r1, null, seed); return p ? D.giver(id, p.x, p.z, D.roadYaw(p.x, p.z), name, look) : null; };
  S.press = S.press || {}; // narx bosimi: {tovar: {manzil: birlik}} — ko'p sotilsa narx tushadi, vaqt o'tib tiklanadi
  const ids = Object.keys(GOODS), mkts = () => Object.values(places).filter((p) => p.board && p.id !== 'uy').map((p) => p.id);
  const cargoN = () => Object.values(S.cargo).reduce((a, b) => a + b, 0);
  D.cargoCap = () => CARGO[D.cls()] || 10; D.cargoN = cargoN;
  const base = (g, pid, day = st.dunyo.day) => { const G = GOODS[g], m = G[3].includes(pid) ? 0.62 : G[4].includes(pid) ? 1.45 : 1, n = 0.88 + 0.24 * h32(day, ids.indexOf(g) + 7, mkts().indexOf(pid) + 3), pr = (S.press[g] && S.press[g][pid]) || 0; return G[2] * m * n * clamp(1 - 0.03 * pr, 0.55, 1.3); };
  D.buyP = (g, pid) => (ONLY[g] ? null : Math.max(1, Math.round(base(g, pid) * 1.08)));
  D.sellP = (g, pid) => Math.max(1, Math.round(base(g, pid) * 0.92 * (1 + 0.04 * D.lvl('savdo'))));
  const press = (g, pid, n) => { S.press[g] = S.press[g] || {}; S.press[g][pid] = ((S.press[g][pid]) || 0) + n; };
  K.on((dh) => { for (const g in S.press) for (const p in S.press[g]) { const v = S.press[g][p]; S.press[g][p] = v > 0 ? Math.max(0, v - dh * 1.2) : Math.min(0, v + dh * 1.2); if (Math.abs(S.press[g][p]) < 0.01) delete S.press[g][p]; } });
  // pul ko'chirish (xarid narxi) — bank tarixiga yoziladi, lekin «daromad» hisobiga kirmaydi
  const hm = (h) => { const a = Math.floor(h), m = Math.floor((h - a) * 60); return `${a < 10 ? '0' : ''}${a}:${m < 10 ? '0' : ''}${m}`; };
  D.transfer = (n, label) => { n = Math.round(n); st.money = Math.max(0, st.money + n); st.income.unshift([hm(game.hour), label, n, st.stats.time]); if (st.income.length > 30) st.income.length = 30; };
  D.buy = (g, pid, n = 1) => { const p = D.buyP(g, pid); if (!p) return 0; n = Math.min(n, D.cargoCap() - cargoN(), Math.floor(st.money / p)); if (n <= 0) { toast(cargoN() >= D.cargoCap() ? `Yuk joyi to'la (${D.cargoCap()} dona) — kattaroq transport oling` : "Pul yetarli emas", 'bad'); return 0; }
    let cost = 0; for (let i = 0; i < n; i++) { cost += D.buyP(g, pid); press(g, pid, -0.67); } D.transfer(-cost, `Savdo: ${GOODS[g][1]} ×${n} olindi`); S.cargo[g] = (S.cargo[g] || 0) + n; S.cost = S.cost || {}; S.cost[g] = (S.cost[g] || 0) + cost; sfx('buy'); return n; };
  D.sell = (g, pid, n = 1) => { const have = S.cargo[g] || 0; n = Math.min(n, have); if (n <= 0) return 0; let rev = 0; for (let i = 0; i < n; i++) { rev += D.sellP(g, pid); press(g, pid, 1); } const avg = S.cost && S.cost[g] && have ? S.cost[g] / have : 0, profit = rev - avg * n;
    if (S.cost && S.cost[g]) S.cost[g] = Math.max(0, S.cost[g] - avg * n); S.cargo[g] = have - n; if (!S.cargo[g]) delete S.cargo[g];
    D.pay('savdo', rev, `${GOODS[g][1]} ×${n} · ${D.placeName(pid)}`, true); if (profit > 0) D.addXp('savdo', Math.min(12, Math.round(profit / 60))); const s = D.stat('savdo'); s.n++; s.best = Math.max(s.best, Math.round(profit)); S.profit = (S.profit || 0) + profit; return rev; };
  D.marketAt = () => { const q = D.pos(); for (const id of mkts()) { const b = places[id].board; if (Math.hypot(b.x - q[0], b.z - q[2]) < 16) return id; } return null; };
  D.bestSell = (g) => { let b = null, bp = 0; for (const id of mkts()) { const p = D.sellP(g, id); if (p > bp) { bp = p; b = id; } } return [b, bp]; };
  D.reg({ id: 'savdo', ic: '⚖️', name: 'Savdogar', cat: 'pul', place: 'bogiston', where: "har bir e'lonlar taxtasi (rasta)", pay: "har reys 300–1 500 so'm foyda", need: 'yuk joyi transportga bog\'liq (piyoda/velosiped 4 … yuk mashinasi 30)', boards: mkts(),
    desc: "Arzon joydan olib, qimmat joyda soting: har manzilda va har o'yin kunida narx boshqa. Ko'p sotsangiz narx tushadi, vaqt o'tib tiklanadi. Asal, sopol va gilamni o'zingiz tayyorlaysiz.",
    info: () => `Yukda: ${cargoN()}/${D.cargoCap()} · jami foyda ${som(S.profit || 0)} so'm`, open: () => game.ui.open('savdo', { pid: D.marketAt() }), boardOpen: (pid) => game.ui.open('savdo', { pid }) });
  UI.prototype.s_savdo = function (w, d, btn, x) { x(); const pid = (d && d.pid) || D.marketAt(), here = pid && places[pid], cap = D.cargoCap();
    const rows = ids.map((g) => { const G = GOODS[g], b = here ? D.buyP(g, pid) : null, s = here ? D.sellP(g, pid) : null, [bp, bv] = D.bestSell(g), have = S.cargo[g] || 0, avg = have && S.cost && S.cost[g] ? S.cost[g] / have : 0;
      return `<tr><td>${G[0]} ${G[1]}${ONLY[g] ? `<br><small style="color:var(--mut)">${ONLY[g]}</small>` : ''}</td><td>${b ? som(b) : '—'}</td><td class="${s && avg ? (s > avg ? 'up' : 'dn') : ''}">${s ? som(s) : '—'}</td><td>${have}${avg ? ` <small style="color:var(--mut)">(${som(avg)})</small>` : ''}</td><td><small>${D.placeName(bp)}: ${som(bv)}</small></td><td>${here ? `${b ? `<button class="sec" data-a="b:${g}-1">+1</button><button class="sec" data-a="b:${g}-5">+5</button>` : ''}${have ? `<button data-a="s:${g}-${have}">Sotish</button>` : ''}` : ''}</td></tr>`; }).join('');
    w.innerHTML = `<h1>⚖️ Savdo ${here ? `<small>${here.name} rastasi · ${st.dunyo.day}-kun narxlari</small>` : '<small>narxlar jadvali</small>'}</h1><p class="sub">${here ? '' : "Savdo qilish uchun istalgan e'lonlar taxtasi oldiga boring (rasta). "}Yuk joyi: <b>${cargoN()}/${cap}</b> (${(vehById[st.veh.cur] || {}).name || ''}) · 💰 ${som(st.money)} so'm · savdogar obro'si: ${D.lvl('savdo') ? `+${D.lvl('savdo') * 4} % sotuv narxi` : 'yangi'}</p>
      <div class="pg-tab" style="overflow-x:auto"><table class="dr-tbl"><tr><th>Tovar</th><th>Olish</th><th>Sotish</th><th>Yukda (o'rtacha)</th><th>Eng qimmat</th><th></th></tr>${rows}</table></div>${here && cargoN() ? '<div class="row" style="margin-top:10px"><button data-a="all">Hammasini sotish</button></div>' : ''}`;
    this.on({ b: (v) => { const [g, n] = v.split('-'); if (D.buy(g, pid, +n)) this.open('savdo', { pid }); }, s: (v) => { const [g, n] = v.split('-'); D.sell(g, pid, +n); this.open('savdo', { pid }); }, all: () => { for (const g of Object.keys(S.cargo)) D.sell(g, pid, S.cargo[g]); this.open('savdo', { pid }); } }); };

  // ================= ASALARICHILIK =================
  const ag = giverAt('asal', 'ormon', 8.1, 'Asalarichi Hamida opa', { shirt: 0xf0d070, pants: 0x5a4a32, long: true, hair: 0xd8d8d8 }, 14, 70);
  let api = null; if (ag) { api = D.spotNear(ag.x, ag.z, 6, 30, (x, z, si) => si.slope < 0.18 && si.roadD > 4, 2.6, 5); if (api) { api.yaw = D.roadYaw(api.x, api.z); api.slots = []; for (let i = 0; i < 6; i++) { const lx = (i % 3 - 1) * 2.2, lz = Math.floor(i / 3) * 2.4, c = Math.cos(api.yaw), s = Math.sin(api.yaw), x = api.x + lx * c + lz * s, z = api.z - lx * s + lz * c; api.slots.push({ x, z, y: gy(x, z) }); } } }
  const hiveG = (() => { const g = new GB(4301); g.jit = 0.02; g.color(0x6e4a30).box(0, 0.15, 0, 0.6, 0.3, 0.6); g.color(0xf0c860).box(0, 0.5, 0, 0.56, 0.4, 0.56).box(0, 0.86, 0, 0.56, 0.3, 0.56); g.color(0xd8a840).box(0, 0.7, 0.285, 0.5, 0.02, 0.02); g.color(0x8a5a36).box(0, 1.05, 0, 0.7, 0.08, 0.7); g.color(0x2a1d16).box(0, 0.36, 0.29, 0.22, 0.05, 0.02); return g.build(); })();
  const hiveIM = new THREE.InstancedMesh(hiveG, MAT.flat, 6); hiveIM.count = 0; hiveIM.frustumCulled = false; hiveIM.castShadow = true; scene.add(hiveIM); const dm = new THREE.Object3D();
  const HIVE_P = 450, MAXH = 6, hcap = () => (D.lvl('asal') >= 3 ? 6 : 4);
  const drawHives = () => { if (!api) return; let n = 0; for (let i = 0; i < S.hives.length && i < MAXH; i++) { const q = api.slots[i]; dm.position.set(q.x, q.y, q.z); dm.rotation.set(0, api.yaw, 0); dm.updateMatrix(); hiveIM.setMatrixAt(n++, dm.matrix); if (!q.col) { q.col = 1; COL.addCircle(q.x, q.z, 0.4, q.y - 1, q.y + 1.1); } } hiveIM.count = n; hiveIM.instanceMatrix.needsUpdate = true; };
  K.on((dh) => { const r = 0.5 * (D.lvl('asal') >= 1 ? 1.15 : 1); for (const h of S.hives) h.h = Math.min(hcap(), (h.h || 0) + r * dh); });
  D.buyHive = () => { if (S.hives.length >= MAXH) return toast('Hamma joy band (6 uya)', 'bad'), false; if (st.money < HIVE_P) return toast(`Pul yetarli emas (${HIVE_P} so'm)`, 'bad'), false; D.transfer(-HIVE_P, 'Asalari uyasi sotib olindi'); S.hives.push({ h: 0 }); drawHives(); sfx('buy'); game.save(); return true; };
  D.collectHive = (i) => { const h = S.hives[i]; if (!h) return 0; const n = Math.min(Math.floor(h.h), D.cargoCap() - cargoN()); if (n <= 0) { toast(h.h < 1 ? "🐝 Asal hali yig'ilmagan" : "Yuk joyi to'la — asalni sotib keling", 'bad'); return 0; } h.h -= n; S.cargo.asal = (S.cargo.asal || 0) + n; S.cost = S.cost || {}; D.addXp('asal', n * 2); const s = D.stat('asal'); s.n += n; sfx('pick'); toast(`🍯 +${n} banka asal (yukda ${S.cargo.asal})`, 'good'); return n; };
  D.reg({ id: 'asal', ic: '🐝', name: 'Asalarichilik', cat: 'pul', place: 'ormon', pay: "uya ~12 banka/kun · banka 40–95 so'm", need: `uya ${HIVE_P} so'm (6 tagacha)`,
    desc: "Oltin o'rmondagi asalxonada uya sotib oling: asalarilar o'yin vaqtida (uxlaganingizda ham) asal yig'adi. Uyadan piyoda yig'ib olasiz va rastalarda sotasiz — eng qimmati uzoq manzillarda.",
    info: () => `Uyalar: ${S.hives.length}/${MAXH} · tayyor: ${Math.floor(S.hives.reduce((a, h) => a + (h.h || 0), 0))} banka · yig'ilgan ${D.stat('asal').n}`, open: () => game.ui.open('asal') });
  D.defs.asal.always = (offer, px, pz) => { if (!api) return; S.hives.forEach((h, i) => { const q = api.slots[i], d = Math.hypot(q.x - px, q.z - pz); if (d < 1.9) offer(d - 0.3, h.h >= 1 ? `<kbd>E</kbd> Asal yig'ish 🍯 (${Math.floor(h.h)} banka)` : `🐝 Uya: asal yig'ilmoqda ${Math.round((h.h % 1) * 100)} %`, () => { if (h.h < 1) return; pl.yaw = Math.atan2(q.x - pl.p[0], q.z - pl.p[2]); pl.act('bend', 1.3, () => { D.collectHive(i); fx().burst(10, q.x, q.y + 1, q.z, 1.2, 1.4, 0.06, 0xffd23a, 1, 0.6, 0, 0); }); }); }); };
  D.defs.asal.bg = (dt) => { if (!api || !S.hives.length) return; const p = D.pos(); if (Math.hypot(api.x - p[0], api.z - p[2]) > 60) return; api.bt = (api.bt || 0) - dt; if (api.bt <= 0) { api.bt = 0.4; const q = api.slots[(Math.random() * S.hives.length) | 0]; fx().burst(2, q.x, q.y + 1.1, q.z, 0.8, 1.6, 0.05, 0x2a2010, 1, 0.3, 0, 0); } };
  UI.prototype.s_asal = function (w, d, btn, x) { x(); const near = ag && D.dist(ag) < 45, ready = S.hives.reduce((a, h) => a + Math.floor(h.h || 0), 0), sp = Math.round(GOODS.asal[2] * 0.8);
    w.innerHTML = `<h1>🐝 Asalarichilik <small>Hamida opa · Oltin o'rmon</small></h1><p class="sub">Har uya o'yin soatiga ~0,5 banka asal yig'adi (sig'imi ${hcap()} banka — vaqtida yig'ing). Asalni yuk joyiga olasiz va rastalarda sotasiz: ${GOODS.asal[4].map((p) => D.placeName(p)).join(', ')}da qimmat.</p>
      <div class="cards">${S.hives.map((h, i) => `<div class="card"><h4>Uya ${i + 1}</h4><div class="dr-meter"><span>🍯</span><i><b style="width:${Math.round((h.h || 0) / hcap() * 100)}%"></b></i><span>${Math.floor(h.h || 0)}/${hcap()}</span></div></div>`).join('') || '<p class="sub">Hali uya yo\'q.</p>'}</div>
      <div class="row" style="margin-top:10px;gap:8px"><button data-a="buy" ${!near || S.hives.length >= MAXH ? 'disabled' : ''}>${near ? `Uya sotib olish — ${HIVE_P} so'm` : 'Asalxonaga boring'}</button><button class="sec" data-a="sell" ${!near || !S.cargo.asal ? 'disabled' : ''}>Hamida opaga sotish (${sp} so'm/banka)</button><button class="sec" data-a="go">📍 Yo'l</button></div><p class="sub" style="margin-top:6px">Tayyor: ${ready} banka · yukda ${S.cargo.asal || 0} · yig'ish — uya oldida <kbd>E</kbd></p>`;
    this.on({ buy: () => { D.buyHive(); this.open('asal'); }, sell: () => { const n = S.cargo.asal || 0; if (!n) return; const have = n, avg = S.cost && S.cost.asal ? S.cost.asal / have : 0; delete S.cargo.asal; if (S.cost) delete S.cost.asal; void avg; D.pay('asal', sp * n, `${n} banka`, true); this.open('asal'); }, go: () => { game.setWaypoint(ag.x, ag.z); this.close(); } }); };
  drawHives();

  // ================= HUNARMANDCHILIK: kulolchilik va gilamdo'zlik =================
  const kg = giverAt('kulol', 'qala', 6.2, 'Usta kulol Abdulla', { shirt: 0xc8a27a, pants: 0x5a4a32, vest: 0x8a5a36, hair: 0xd8d8d8, stache: true }, 10, 60);
  const gg = giverAt('gilam', 'karvon', 2.8, "Gilamdo'z Oysha", { shirt: 0xb8342a, pants: 0x3a2a4a, long: true, hair: 0x1d1612 }, 10, 60);
  const prop = (gv, seed, fn) => { if (!gv) return; const a = gv.yaw + 2.2, x = gv.x + Math.sin(a) * 1.8, z = gv.z + Math.cos(a) * 1.8, y = gy(x, z), g = new GB(seed); g.jit = 0.02; g.translate(x, y, z).rotY(gv.yaw); fn(g); scene.add(mesh(g)); COL.addCircle(x, z, 0.6, y - 1, y + 1.2); };
  prop(kg, 4311, (g) => { g.color(0x8a5a36).box(0, 0.35, 0, 0.9, 0.7, 0.9); g.color(0x6e4a30).cyl(14, 0.38, 0.38, 0.7, 0.78, { cap: true }); g.color(0xb86a3a).cyl(10, 0.16, 0.2, 0.78, 1.0, { cap: true }).cyl(10, 0.2, 0.1, 1.0, 1.18); for (let i = 0; i < 4; i++) g.color(0xc8784a).push().translate(0.8 + i * 0.32, 0, 0.3).cyl(8, 0.12, 0.09, 0, 0.36, { cap: true }).pop(); });
  prop(gg, 4312, (g) => { g.color(0x6e4a30); for (const sx of [-0.8, 0.8]) g.box(sx, 0.7, 0, 0.08, 1.4, 0.08); g.box(0, 1.38, 0, 1.7, 0.08, 0.08).box(0, 0.2, 0, 1.7, 0.08, 0.08); const C = [0xb8342a, 0x2a4a8a, 0xf0c860, 0x3f7a4a]; for (let r = 0; r < 8; r++) for (let c = 0; c < 6; c++) g.color(C[(r + c * 3) % 4]).box(-0.62 + c * 0.25, 0.3 + r * 0.13, 0.01, 0.25, 0.13, 0.02); });
  const CLAY = 25, YARN = 60;
  D.reg({ id: 'kulol', ic: '🏺', name: 'Kulolchilik', cat: 'foot', place: 'qala', pay: "bitta idish 100–175 so'm (rastada)", need: `loy ${CLAY} so'm`, xp: 3, mins: 1,
    desc: "Abdulla usta charxida sopol idish yasaysiz: aylanayotgan ko'rsatkich yashil joyga kelganda bosing (5 marta). Sifatga qarab 1 yoki 2 ta idish chiqadi — ustaga sotasiz yoki qimmat manzilga eltasiz.",
    info: () => `Yasalgan: ${D.stat('kulol').n} · yukda ${S.cargo.sopol || 0}`, open: () => (kg && D.dist(kg) < 25 ? game.ui.open('hunar', { k: 'kulol' }) : (game.setWaypoint(kg.x, kg.z), toast("📍 Ko'hna qal'adagi kulol — yo'l ko'rsatildi"))) });
  D.reg({ id: 'gilam', ic: '🧶', name: "Gilamdo'zlik", cat: 'foot', place: 'karvon', pay: "bitta gilam 240–400 so'm (rastada)", need: `ip ${YARN} so'm`, xp: 4, mins: 1,
    desc: "Oysha opaning dastgohida gilam to'qiysiz: naqsh ranglari ketma-ket yonadi — xuddi shu tartibda takrorlang. Uch qatordan ikkitasi to'g'ri bo'lsa, gilam tayyor.",
    info: () => `To'qilgan: ${D.stat('gilam').n} · yukda ${S.cargo.gilam || 0}`, open: () => (gg && D.dist(gg) < 25 ? game.ui.open('hunar', { k: 'gilam' }) : (game.setWaypoint(gg.x, gg.z), toast("📍 Karvonsaroydagi gilamdo'z — yo'l ko'rsatildi"))) });
  // natija: sifat (0–1) → buyum; sinov uchun ham ochiq
  D.craft = (k, q) => { const s = D.stat(k); let n = 0, msg; if (k === 'kulol') { n = q >= 0.85 ? 2 : q >= 0.45 ? 1 : 0; msg = n === 2 ? "Ajoyib! Ikki ko'za chiqdi" : n ? 'Chiroyli ko\'za' : "Loy qiyshayib ketdi…"; } else { n = q >= 0.66 ? 1 : 0; msg = q >= 0.99 ? "A'lo gilam! Oysha opa: «Qo'lingiz gul ekan!»" : n ? "Gilam tayyor" : "Naqsh chalkashib ketdi…"; }
    const g = k === 'kulol' ? 'sopol' : 'gilam', room = D.cargoCap() - cargoN(), keep = Math.min(n, room); if (keep) S.cargo[g] = (S.cargo[g] || 0) + keep; s.n += n; if (n > keep) { D.pay(k, Math.round(GOODS[g][2] * 0.85) * (n - keep), 'ustaga sotildi (yuk to\'la)', true); }
    if (k === 'gilam' && q >= 0.99) D.pay('gilam', 60, "a'lo naqsh mukofoti"); D.addXp(k, n ? 4 : 1); toast(`${k === 'kulol' ? '🏺' : '🧶'} ${msg}${n ? ` · +${n} ${GOODS[g][1].toLowerCase()}` : ''}`, n ? 'good' : 'bad'); sfx(n ? 'medal' : 'click'); game.save(); return n; };
  UI.prototype.s_hunar = function (w, d, btn, x) { x(); const k = (d && d.k) || 'kulol', kul = k === 'kulol', g = kul ? 'sopol' : 'gilam', price = kul ? CLAY : YARN, sp = Math.round(GOODS[g][2] * 0.85), self = this;
    const head = `<h1>${kul ? '🏺 Kulolchilik' : "🧶 Gilamdo'zlik"} <small>${kul ? 'Usta kulol Abdulla' : "Gilamdo'z Oysha"} · ${(D.defs[k] && ['Shogird', 'Ishchi', 'Tajribali', 'Usta', 'Mohir', 'Afsona'][D.lvl(k)]) || ''}</small></h1>`;
    const cd = D.hcd || (D.hcd = {}), CD = kul ? 25000 : 20000, left = () => Math.max(0, Math.ceil(((cd[k] || 0) - performance.now()) / 1000)), rest = () => { cd[k] = performance.now() + CD; }; // keyingi ishgacha dam (daqiqasiga daromad me'yorda qolsin)
    const menu = () => { const wl = left(); if (wl > 0) setTimeout(() => { if (w.isConnected && w.querySelector('button[data-a="go"]')) menu(); }, Math.min(wl, 5) * 1000); w.innerHTML = head + `<p class="sub">${D.defs[k].desc}</p><div class="card"><p>Yukda: ${S.cargo[g] || 0} ${GOODS[g][1].toLowerCase()} · yuk joyi ${cargoN()}/${D.cargoCap()} · eng qimmati: ${GOODS[g][4].map((p) => D.placeName(p)).join(', ')}</p></div>
      <div class="row" style="margin-top:10px;gap:8px"><button data-a="go" ${st.money < price || wl > 0 ? 'disabled' : ''}>${wl > 0 ? `${kul ? 'Loy pishmoqda' : 'Ip tayyorlanmoqda'}… ${wl} s` : `Boshlash (${kul ? 'loy' : 'ip'} ${price} so'm)`}</button><button class="sec" data-a="sell" ${!S.cargo[g] ? 'disabled' : ''}>Ustaga sotish (${sp} so'm/dona)</button><button class="sec" data-a="no">Yopish</button></div>`;
      self.on({ go: () => { if (left() > 0 || st.money < price) return; D.transfer(-price, `${kul ? 'Loy' : 'Ip'} sotib olindi`); kul ? wheel() : loom(); }, sell: () => { const n = S.cargo[g]; delete S.cargo[g]; if (S.cost) delete S.cost[g]; D.pay(k, sp * n, `${n} dona ustaga`, true); menu(); }, no: () => self.close() }); };
    // charx: 5 marta bosish, yashil zona torayadi
    const wheel = () => { let r = 0, q = 0, ph = Math.random() * 6, zw = 0.22 - D.lvl(k) * 0 - 0, raf = 0, t0 = performance.now(); const zones = [0.24, 0.21, 0.18, 0.15, 0.12].map((z) => [0.1 + Math.random() * (0.8 - z), z]);
      w.innerHTML = head + `<div class="dr-mg"><p class="sub">Ko'rsatkich yashil joyga kelganda <kbd>Probel</kbd> / <kbd>E</kbd> yoki tugmani bosing</p><div class="bar"><div class="zone"></div><div class="ndl"></div></div><b class="mg-r">1/5</b><button data-a="hit" style="min-width:200px">To'xtat!</button></div>`;
      const zEl = w.querySelector('.zone'), nEl = w.querySelector('.ndl'), rEl = w.querySelector('.mg-r'); const setZ = () => { zEl.style.left = zones[r][0] * 100 + '%'; zEl.style.width = zones[r][1] * 100 + '%'; }; setZ(); void zw;
      const pos = () => 0.5 + 0.5 * Math.sin(ph + (performance.now() - t0) / 1000 * (2.2 + r * 0.45));
      const loop = () => { if (!nEl.isConnected) return; nEl.style.left = pos() * 100 + '%'; raf = requestAnimationFrame(loop); }; loop();
      const hit = () => { const p = pos(), [a, b] = zones[r], c = a + b / 2, inZ = p >= a && p <= a + b; q += inZ ? 0.12 + 0.08 * (1 - Math.abs(p - c) / (b / 2)) : 0; sfx(inZ ? 'pop' : 'click'); r++; if (r >= 5) { cancelAnimationFrame(raf); document.removeEventListener('keydown', kd, true); D.craft('kulol', q); rest(); return menu(); } rEl.textContent = `${r + 1}/5 · ${inZ ? '✓' : '✗'}`; setZ(); };
      const kd = (e) => { if (!nEl.isConnected) { document.removeEventListener('keydown', kd, true); cancelAnimationFrame(raf); return; } if (e.code === 'Space' || e.code === 'KeyE') { e.preventDefault(); e.stopPropagation(); hit(); } }; document.addEventListener('keydown', kd, true); self.on({ hit }); };
    // dastgoh: rang ketma-ketligini takrorlash
    const loom = () => { const C = [['#b8342a', 'Qizil'], ['#2a4a8a', "Ko'k"], ['#f0c860', 'Sariq'], ['#3f7a4a', 'Yashil']], L0 = 4 + Math.min(1, D.lvl(k) >> 1); let row = 0, ok = 0, seq = [], inp = [], busy = true;
      w.innerHTML = head + `<div class="dr-mg"><p class="sub mg-t">Naqshni eslab qoling…</p><div class="seq"></div><div class="pal">${C.map((c, i) => `<button data-a="c:${i}" style="background:${c[0]}" title="${c[1]}"></button>`).join('')}</div><b class="mg-r">1/3-qator</b></div>`;
      const bs = [...w.querySelectorAll('.pal button')], tEl = w.querySelector('.mg-t'), sEl = w.querySelector('.seq'), rEl = w.querySelector('.mg-r');
      const show = () => { busy = true; inp = []; seq = Array.from({ length: L0 + row }, () => (Math.random() * 4) | 0); sEl.innerHTML = ''; tEl.textContent = 'Naqshni eslab qoling…'; let i = 0; const step = () => { if (!w.isConnected || !bs[0].isConnected) return; bs.forEach((b) => b.classList.remove('lit')); if (i >= seq.length) { busy = false; tEl.textContent = 'Endi takrorlang!'; return; } setTimeout(() => { bs[seq[i]].classList.add('lit'); sfx('pop'); i++; setTimeout(step, 420); }, 160); }; step(); };
      const done = (good) => { ok += good ? 1 : 0; row++; rEl.textContent = `${Math.min(row + 1, 3)}/3-qator · to'g'ri ${ok}`; if (row >= 3) { D.craft('gilam', ok / 3); rest(); return menu(); } setTimeout(show, 500); };
      self.on({ c: (i) => { if (busy) return; i = +i; inp.push(i); sEl.innerHTML += `<i style="background:${C[i][0]}"></i>`; sfx('click'); if (inp[inp.length - 1] !== seq[inp.length - 1]) { busy = true; tEl.textContent = "✗ Adashdingiz — keyingi qator"; return done(false); } if (inp.length === seq.length) { busy = true; tEl.textContent = '✓ Qator tayyor!'; done(true); } } }); show(); };
    menu(); };
  D.dbg4 = { api, drawHives, base, GOODS };
}
