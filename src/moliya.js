// Sarmoya: transportni ijaraga berish (o'yin soatlari davomida haq, ba'zan kichik ta'mir), bank omonati (kunlik foiz, xavfsiz), kooperativ ulushi (narx har kuni o'zgaradi, dividend — xavfli)
import { UI } from './ui.js';
import { vehById } from './vehicles.js';

const som = (n) => Math.round(n).toLocaleString('ru-RU');
const h32 = (a, b) => { let h = (a * 374761393 + b * 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };
const RENT_RATE = 0.0035, RENT_MAX = 3, RENT_H = [6, 12, 24]; // narxning ulushi / o'yin soati, bir vaqtda, muddatlar
const DEP_RATE = 0.012, DEP_MAX = 60000; // omonat: kunlik foiz, eng ko'p summa
const COOP_DIV = 0.008, COOP_MAX = 300, COOP_P0 = 100; // kooperativ: kunlik dividend (narxdan), eng ko'p ulush, boshlang'ich narx

export function initMoliya(game, D) {
  const st = game.state, S = D.S, K = game.kun;
  const toast = (m, k) => game.toast(m, k), sfx = (n, k) => game.audio.sfx(n, k);
  const vname = (id) => (vehById[id] || {}).name || id;

  // ================= IJARA =================
  D.rentRate = (id) => Math.max(4, Math.round((vehById[id] || { price: 0 }).price * RENT_RATE * (1 + 0.05 * D.lvl('ijara'))));
  D.canRent = (id) => (!st.veh.own.includes(id) ? "Bu transport sizniki emas" : id === st.veh.cur ? "Hozir minib turgan transportingizni ijaraga berib bo'lmaydi" : id === 'velo' ? 'Velosipedni hech kim ijaraga olmaydi 🙂' : S.rent[id] ? 'Allaqachon ijarada' : Object.keys(S.rent).length >= RENT_MAX ? `Bir vaqtda ${RENT_MAX} tagacha` : !(vehById[id] && vehById[id].price > 0) ? "Bu transportga talab yo'q" : null);
  D.rentOut = (id, h) => { const w = D.canRent(id); if (w) { toast(w, 'bad'); return false; } if (!RENT_H.includes(h)) h = 12; S.rent[id] = { left: h, h, earn: 0 }; sfx('buy'); toast(`🔑 ${vname(id)} ${h} soatga ijaraga berildi · ~${som(D.rentRate(id) * h)} so'm`, 'good'); game.save(); return true; };
  const rentDone = (id) => { const r = S.rent[id]; delete S.rent[id]; let n = r.earn, note = `${vname(id)} · ${r.h} soat`; if (Math.random() < 0.12) { const c = Math.round(n * 0.1); n -= c; note += ` (ta'mir −${som(c)})`; } D.pay('ijara', n, note, true); const s = D.stat('ijara'); s.n++; s.best = Math.max(s.best, Math.round(n)); D.addXp('ijara', 6); toast(`🔑 ${vname(id)} qaytarildi · +${som(n)} so'm`, 'gold'); };
  K.on((dh) => { for (const id of Object.keys(S.rent)) { const r = S.rent[id], s = Math.min(dh, r.left); r.earn += D.rentRate(id) * s; r.left -= s; if (r.left <= 1e-6) rentDone(id); } });
  const sv0 = game.setVehicle; game.setVehicle = (id, keep) => { if (S.rent[id] && id !== st.veh.cur) { toast(`🔑 ${vname(id)} hozir ijarada — ${Math.ceil(S.rent[id].left)} soatdan keyin qaytadi`, 'bad'); return; } return sv0(id, keep); };
  D.reg({ id: 'ijara', ic: '🔑', name: 'Transport ijarasi', cat: 'pul', place: 'bogiston', where: "telefon yoki istalgan ustaxona", boards: Object.values(game.site.places).filter((p) => p.garage).map((p) => p.id), pay: "soatiga narxning 0,35 % (superkar ~100 so'm/soat)", need: `o'zingizning transportingiz (${RENT_MAX} tagacha)`,
    desc: "Ishlatmayotgan transportingizni sayyohlarga ijaraga bering: o'yin soatlari o'tishi bilan (uxlaganda ham) haq yig'iladi va transport qaytganda bankka tushadi. Ijaradagi transportni minib bo'lmaydi; ba'zan kichik ta'mir puli ushlab qolinadi.",
    info: () => { const r = Object.keys(S.rent); return r.length ? `Ijarada: ${r.map((id) => `${vname(id)} (${Math.ceil(S.rent[id].left)} soat)`).join(', ')}` : `Ijaralar: ${D.stat('ijara').n} · jami ${som(D.stat('ijara').earn)} so'm`; }, open: () => game.ui.open('moliya', { tab: 'ijara' }) });

  // ================= OMONAT =================
  const day = () => st.dunyo.day;
  const bankTick = () => { const b = S.bank, d = day(); if (b.day < 0) { b.day = d; return; } if (d <= b.day) return; const n = Math.min(7, d - b.day); b.day = d; if (b.dep <= 0) return; const p = b.dep * DEP_RATE * n; b.earned += p; D.pay('omonat', p, `${n > 1 ? n + ' kunlik ' : 'kunlik '}foiz`, true); const s = D.stat('omonat'); s.n += n; };
  D.deposit = (n) => { n = Math.floor(Math.min(n, st.money, DEP_MAX - S.bank.dep)); if (n <= 0) { toast(S.bank.dep >= DEP_MAX ? `Omonat chegarasi ${som(DEP_MAX)} so'm` : "Pul yetarli emas", 'bad'); return 0; } if (S.bank.day < 0) S.bank.day = day(); S.bank.dep += n; D.transfer(-n, 'Omonatga qo\'yildi'); sfx('coin'); return n; };
  D.withdraw = (n) => { n = Math.floor(Math.min(n, S.bank.dep)); if (n <= 0) return 0; S.bank.dep -= n; D.transfer(n, 'Omonatdan yechildi'); sfx('coin'); return n; };
  D.reg({ id: 'omonat', ic: '🏦', name: 'Bank omonati', cat: 'pul', place: 'bogiston', where: 'telefon → Bank / Daromad', pay: `kuniga ${DEP_RATE * 100} % (${som(DEP_MAX)} so'mgacha)`, need: "bo'sh pul",
    desc: "Pulingizni Orol Bankka qo'ying: har yangi o'yin kunida foiz to'g'ridan-to'g'ri hisobingizga tushadi. Xavfsiz, lekin sekin. Istalgan payt yechib olasiz.",
    info: () => `Omonatda: ${som(S.bank.dep)} so'm · foiz jami ${som(S.bank.earned)} so'm`, open: () => game.ui.open('moliya', { tab: 'omonat' }) });

  // ================= KOOPERATIV =================
  const C = S.coop; if (!Array.isArray(C.hist)) C.hist = [];
  D.coopPrice = (d = day()) => { let p = COOP_P0; const h = C.hist; if (h.length && h[h.length - 1][0] === d) return h[h.length - 1][1]; const last = h.length ? h[h.length - 1] : [d - 1, COOP_P0]; p = last[1]; for (let k = last[0] + 1; k <= d && k - last[0] <= 30; k++) { const r = 0.004 + 0.075 * (h32(k, 77) * 2 - 1) + (h32(k, 91) < 0.06 ? -0.18 : 0); p = Math.max(35, Math.min(400, Math.round(p * (1 + r)))); h.push([k, p]); } while (h.length > 14) h.shift(); return p; };
  const coopTick = () => { const d = day(); D.coopPrice(d); if (C.day < 0) { C.day = d; return; } if (d <= C.day) return; const n = Math.min(7, d - C.day); C.day = d; if (C.n <= 0) return; const div = C.n * D.coopPrice(d) * COOP_DIV * n; C.earned += div; D.pay('coop', div, `${C.n} ulush dividendi`, true); };
  D.coopBuy = (n) => { const p = D.coopPrice(); n = Math.floor(Math.min(n, COOP_MAX - C.n, st.money / p)); if (n <= 0) { toast(C.n >= COOP_MAX ? `Eng ko'pi ${COOP_MAX} ulush` : 'Pul yetarli emas', 'bad'); return 0; } if (C.day < 0) C.day = day(); C.n += n; C.cost += n * p; D.transfer(-n * p, `Kooperativ: ${n} ulush olindi`); sfx('buy'); return n; };
  D.coopSell = (n) => { n = Math.floor(Math.min(n, C.n)); if (n <= 0) return 0; const p = D.coopPrice(), avg = C.n ? C.cost / C.n : 0, gain = (p - avg) * n; C.cost -= avg * n; C.n -= n; C.real = (C.real || 0) + gain; D.transfer(n * p, `Kooperativ: ${n} ulush sotildi`); sfx('coin'); toast(`📊 ${n} ulush sotildi: ${gain >= 0 ? 'foyda +' : 'zarar −'}${som(Math.abs(gain))} so'm`, gain >= 0 ? 'good' : 'bad'); return n * p; };
  D.reg({ id: 'coop', ic: '📊', name: 'Kooperativ ulushi', cat: 'pul', place: 'bogiston', where: 'telefon → Daromad', pay: `dividend kuniga ${COOP_DIV * 100} % · narx ±8 %`, need: `ulush narxi ~${COOP_P0} so'm (${COOP_MAX} tagacha)`,
    desc: "Orol fermerlar kooperativining ulushini oling: har o'yin kunida dividend to'lanadi, ulush narxi esa har kuni o'zgaradi — ko'tarilganda sotsangiz foyda, tushganda zarar. Ba'zan kooperativda «yomon kun» bo'ladi.",
    info: () => `${C.n} ulush · narx ${D.coopPrice()} so'm · dividend jami ${som(C.earned)} so'm`, open: () => game.ui.open('moliya', { tab: 'coop' }) });
  D.defs.omonat.bg = (() => { let t = 0; return (dt) => { if ((t -= dt) > 0) return; t = 1; bankTick(); coopTick(); }; })();
  D.bankTick = bankTick; D.coopTick = coopTick;

  // ================= OYNA =================
  UI.prototype.s_moliya = function (w, d, btn, x) { x(); const tab = (d && d.tab) || this._mlTab || 'ijara'; this._mlTab = tab; let body = '';
    if (tab === 'ijara') { const own = st.veh.own.filter((id) => id !== 'velo').sort((a, b) => (vehById[b] || {}).price - (vehById[a] || {}).price);
      body = `<p class="sub">Haq o'yin soatlari o'tishi bilan yig'iladi (1 o'yin soati ≈ 50 soniya) va transport qaytganda bankka tushadi. Bir vaqtda ${RENT_MAX} tagacha.</p><div class="pg-tab"><table class="dr-tbl"><tr><th>Transport</th><th>so'm/soat</th><th>Holat</th><th></th></tr>${own.map((id) => { const r = S.rent[id], w2 = D.canRent(id);
        return `<tr><td>${vname(id)}</td><td>${som(D.rentRate(id))}</td><td>${r ? `ijarada · ${Math.ceil(r.left)} soat qoldi · ${som(r.earn)} so'm` : id === st.veh.cur ? 'minib turibsiz' : 'garajda'}</td><td>${r ? '' : RENT_H.map((h) => `<button class="sec" data-a="rent:${id}-${h}" ${w2 ? 'disabled' : ''}>${h} soat</button>`).join(' ')}</td></tr>`; }).join('')}</table></div>`; }
    else if (tab === 'omonat') { bankTick(); body = `<div class="pg-big"><div><b>${som(S.bank.dep)}</b><small>omonatda (so'm)</small></div><div><b>${som(Math.round(S.bank.dep * DEP_RATE))}</b><small>ertangi foiz</small></div><div><b>${som(S.bank.earned)}</b><small>jami foiz</small></div></div>
      <p class="sub">Har yangi o'yin kunida ${DEP_RATE * 100} % foiz to'g'ridan-to'g'ri hisobingizga tushadi. Eng ko'pi ${som(DEP_MAX)} so'm. Hisobda: ${som(st.money)} so'm.</p><div class="row" style="gap:6px;flex-wrap:wrap">${[500, 2000, 10000].map((n) => `<button class="sec" data-a="dep:${n}">+${som(n)}</button>`).join('')}<button data-a="dep:${DEP_MAX}">Hammasini qo'yish</button><button class="sec" data-a="wd:${DEP_MAX}" ${S.bank.dep ? '' : 'disabled'}>Hammasini yechish</button></div>`; }
    else { coopTick(); const p = D.coopPrice(), h = C.hist.slice(-8), avg = C.n ? C.cost / C.n : 0, mx = Math.max(...h.map((q) => q[1]), 1);
      body = `<div class="pg-big"><div><b>${p}</b><small>bugungi narx (so'm)</small></div><div><b>${C.n}</b><small>ulushingiz${avg ? ` · o'rtacha ${som(avg)}` : ''}</small></div><div><b class="${p >= avg ? '' : 'dn'}">${C.n ? (p >= avg ? '+' : '') + som((p - avg) * C.n) : '—'}</b><small>hozir sotsangiz</small></div></div>
      <div style="display:flex;align-items:flex-end;gap:5px;height:80px;margin:4px 0 10px">${h.map((q, i) => `<div title="${q[0]}-kun: ${q[1]}" style="flex:1;height:${Math.round((q[1] / mx) * 100)}%;background:${i && q[1] < h[i - 1][1] ? '#ff8a7a' : '#7dffa0'};border-radius:5px 5px 0 0;opacity:.85"></div>`).join('')}</div>
      <p class="sub">Dividend: kuniga narxning ${COOP_DIV * 100} % (ulush boshiga ${(p * COOP_DIV).toFixed(1)} so'm). Jami olingan dividend: ${som(C.earned)} so'm · sotuvdan: ${(C.real || 0) >= 0 ? '+' : ''}${som(C.real || 0)} so'm.</p><div class="row" style="gap:6px;flex-wrap:wrap">${[10, 50].map((n) => `<button class="sec" data-a="cb:${n}">+${n} ulush</button>`).join('')}<button class="sec" data-a="cs:10" ${C.n ? '' : 'disabled'}>−10</button><button class="sec" data-a="cs:${COOP_MAX}" ${C.n ? '' : 'disabled'}>Hammasini sotish</button></div>`; }
    w.innerHTML = `<h1>💰 Sarmoya <small>passiv daromad · hisobda ${som(st.money)} so'm</small></h1><div class="pg-tabs">${[['ijara', '🔑 Ijara'], ['omonat', '🏦 Omonat'], ['coop', '📊 Kooperativ']].map(([k, n]) => `<button class="${k === tab ? '' : 'sec'}" data-a="tab:${k}">${n}</button>`).join('')}<button class="sec" data-a="all">💼 E'lonlar</button></div>${body}`;
    this.on({ tab: (k) => this.open('moliya', { tab: k }), all: () => this.open('elonlar'), rent: (v) => { const [id, h] = v.split('-'); D.rentOut(id, +h); this.open('moliya', { tab: 'ijara' }); }, dep: (n) => { D.deposit(+n); this.open('moliya', { tab: 'omonat' }); }, wd: (n) => { D.withdraw(+n); this.open('moliya', { tab: 'omonat' }); }, cb: (n) => { D.coopBuy(+n); this.open('moliya', { tab: 'coop' }); }, cs: (n) => { D.coopSell(+n); this.open('moliya', { tab: 'coop' }); } }); };
  // telefon bankida omonat qatori
  const PH = game.phone; if (PH) { const be = PH.bankExtra; PH.bankExtra = () => (be ? be() : '') + `<div class="ph-list"><div data-a="mlopen:omonat"><span>🏦 Omonat<small>kuniga ${DEP_RATE * 100} % · ${som(S.bank.dep)} so'm</small></span><b>›</b></div><div data-a="mlopen:coop"><span>📊 Kooperativ<small>${C.n} ulush · ${D.coopPrice()} so'm</small></span><b>›</b></div></div>`; PH.acts.mlopen = (t) => game.ui.open('moliya', { tab: t }); }
}
