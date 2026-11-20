// Bo'yoq ustaxonasi (istalgan rang, qoplama: yaltiroq/mat/metallik/sadaf/xrom, ikki rangli kuzov) va shina to'plamlari (yo'l, yo'ltanlamas, qishki, drift) — har transportga alohida
// Bo'yoq mavjud materialning sonli parametrlari va uniformlari bilan beriladi: yangi material yaratilmaydi, sheyder qayta yig'ilmaydi, chiroqlar soni o'zgarmaydi.
// Shina — physics.js dagi car.surfMu (yuza bo'yicha ko'paytuvchilar); standart shinada null — fizika aynan avvalgidek (npm test jadvali o'zgarmaydi).
import * as THREE from 'three';
import { PAINTS } from './carmodel.js';
import { VEHICLES, vehById } from './vehicles.js';
import * as COL from './colliders.js';

// m — metallik, r — g'adir-budurlik, cc — lak qatlami (doim > 0: 0 bo'lsa sheyder qayta yig'iladi), ccr — lak g'adirligi, p — sadaf (chetda tus o'zgarishi)
export const FINISH = [
  { id: 'yal', name: 'Yaltiroq', icon: '✨', cost: 0, d: 'Odatdagi zavod laki', m: 0.12, r: 0.38, cc: 1, ccr: 0.04, p: 0 },
  { id: 'mat', name: 'Mat', icon: '🧱', cost: 500, d: "Yaltiramaydigan, baxmaldek yuza", m: 0.02, r: 0.86, cc: 0.03, ccr: 1, p: 0 },
  { id: 'met', name: 'Metallik', icon: '🔩', cost: 900, d: "Ichida metall uchqunlari — quyoshda yarqiraydi", m: 0.72, r: 0.3, cc: 1, ccr: 0.05, p: 0 },
  { id: 'sadaf', name: 'Sadaf', icon: '🐚', cost: 1500, d: "Qaralgan burchakka qarab tusi o'zgaradi", m: 0.3, r: 0.22, cc: 1, ccr: 0.03, p: 0.62 },
  { id: 'xrom', name: 'Xrom', icon: '🪞', cost: 2000, d: "Ko'zgudek — atrofni aks ettiradi", m: 1, r: 0.07, cc: 1, ccr: 0.02, p: 0 },
];
const FIN = Object.fromEntries(FINISH.map((f) => [f.id, f]));
export const COLOR_COST = 1500, TONE_COST = 800;
export const PALETTE = [0xd8392b, 0xe8572f, 0xf08a2a, 0xf0b83a, 0xf2d45a, 0xc8d84a, 0x7ac04a, 0x3f9a58, 0x1f6a48, 0x24b8b0, 0x2a9ad8, 0x2f7fd0, 0x2a4aa8, 0x1d2a5a, 0x8a54c8, 0xc84a9a, 0xff7ab8, 0xf2c8b8,
  0xf2f2ee, 0xc8ccd2, 0x8a909c, 0x4a4e58, 0x2a2c33, 0x121316, 0x8a5a36, 0x6e3a22, 0xb8905e, 0xd8c8a0, 0x6a7a4a, 0xb3122e];
//          yuza: ROAD  GRASS SAND  SNOW  ROCK  WOOD  WATER ICE   ASPHALT
export const TYRES = [
  { id: '', name: 'Standart', icon: '⚪', cost: 0, d: "Zavod shinasi: hamma joyda o'rtacha", mu: null, rear: 1 },
  { id: 'yol', name: "Yo'l shinasi", icon: '🛣', cost: 600, d: "Asfalt va tekis yo'lda mahkam, o't va qumda sirpanadi", mu: [1.1, 0.9, 0.85, 0.8, 0.96, 1.06, 1, 0.82, 1.12], rear: 1 },
  { id: 'yolsiz', name: "Yo'ltanlamas", icon: '⛰', cost: 1200, d: "Yirik naqsh: o't, qum va toshloqda tutadi, asfaltda biroz sekin", mu: [0.96, 1.18, 1.26, 1.12, 1.16, 1, 1, 1, 0.94], rear: 1 },
  { id: 'qish', name: 'Qishki (tikanli)', icon: '❄', cost: 1600, d: "Qor va muzda ishonchli, yomg'irda ham kam sirpanadi", mu: [0.97, 1.02, 1, 1.5, 1, 1, 1, 2.2, 0.95], rear: 1, wet: 0.45 },
  { id: 'drift', name: 'Drift shinasi', icon: '💨', cost: 2400, d: "Silliq: orqa g'ildiraklar oson sirpanadi — drift ochkosi oson", mu: [0.9, 0.86, 0.86, 0.8, 0.88, 0.9, 1, 0.8, 0.92], rear: 0.78 },
];
const TY = Object.fromEntries(TYRES.map((t) => [t.id, t]));
const hx = (n) => '#' + (n >>> 0).toString(16).padStart(6, '0');
const som = (n) => Math.round(n).toLocaleString('ru-RU');

// modelga bo'yoq: asosiy rang, qoplama, ikkinchi rang (kapot, oynalar, bamperlar — painted qismlar); onlayn do'st modeli ham shundan (coop.js)
export function paintModel(m, hex, finId, tone) {
  if (!m || !m.paintMat) return; const F = FIN[finId] || FIN.yal, pm = m.paintMat, pp = m._partPaint;
  pm.color.setHex(hex);
  if (pp) { if (tone != null) { if (pp.color === pm.color) pp.color = new THREE.Color(); pp.color.setHex(tone); } else pp.color = pm.color; }
  for (const mt of pp ? [pm, pp] : [pm]) {
    mt.metalness = F.m; mt.roughness = F.r; mt.clearcoat = F.cc; mt.clearcoatRoughness = F.ccr;
    const U = mt.userData.seam; if (U && U.uPearl) { U.uPearl.value = F.p; U.uPearlC.value.copy(mt.color).offsetHSL(0.16, 0.05, 0.22); }
  }
}
export const finishIndex = (id) => Math.max(0, FINISH.findIndex((f) => f.id === id));
export const finishId = (i) => (FINISH[i | 0] || FINISH[0]).id;

export function initBoyoq(game) {
  const st = game.state, car = game.car, V = st.veh;
  for (const k of ['col', 'fin', 'tone', 'tyre', 'tyres']) if (!V[k] || typeof V[k] !== 'object') V[k] = {}; // eski saqlov
  const B = (game.boyoq = { draft: null, FINISH, TYRES, PALETTE });
  const toast = (m, k) => game.toast(m, k), sfx = (n) => game.audio.sfx(n);
  // saqlangan bo'yoq: o'z rangi > tayyor bo'yoq (st.veh.paint) > transport rangi
  B.saved = (id) => { const v = vehById[id] || vehById.jip, pid = V.paint[id], pp = pid && PAINTS.find((q) => q.id === pid); return { hex: V.col[id] != null ? V.col[id] : pp ? pp.hex : v.hex, fin: FIN[V.fin[id]] ? V.fin[id] : 'yal', tone: V.tone[id] != null ? V.tone[id] : null }; };
  game.applyPaint = (m, id) => { const s = B.saved(id); paintModel(m, s.hex, s.fin, s.tone); };
  // shina: standartda surfMu = null (fizika o'zgarmaydi)
  B.tyre = (id = V.cur) => TY[V.tyre[id]] || TY[''];
  B.applyTyre = () => { const t = B.tyre(); car.surfMu = t.mu ? t.mu.slice() : null; car.surfRear = t.mu ? t.rear : 1; };
  const sv0 = game.setVehicle; game.setVehicle = (id, keep) => { sv0(id, keep); game.applyPaint(game.carModel, V.cur); B.applyTyre(); };
  // tayyor bo'yoq (ustaxonaning birinchi tabi) tanlansa — o'z rangi, qoplamasi va ikkinchi rangi bekor bo'ladi
  const sp0 = game.setPaint; game.setPaint = (id) => { delete V.col[V.cur]; delete V.fin[V.cur]; delete V.tone[V.cur]; sp0(id); game.applyPaint(game.carModel, V.cur); };
  game.applyPaint(game.carModel, V.cur); B.applyTyre();
  // qishki shina yomg'ir/qordagi sirpanishni kamaytiradi (obhavo.js har kadr car.wetGrip ni yozadi — undan keyin)
  game.hooks.push(() => { const t = B.tyre(); if (t.wet && car.wetGrip < 1) car.wetGrip = 1 - (1 - car.wetGrip) * t.wet; });

  // ---------- shinalar (ustaxona → «Shinalar» tabi, ui.js) ----------
  B.tyreHtml = () => { const id = V.cur, own = V.tyres[id] || [], cur = B.tyre(id).id, v = vehById[id];
    return `<p class="sub">Har transportga alohida: ${v.name} uchun shina tanlang. Sotib olingan to'plam shu transportda qoladi — keyin bepul almashtirasiz.</p><div class="cards">${TYRES.map((t) => { const has = !t.id || own.includes(t.id), sel = cur === t.id;
      return `<div class="card${sel ? ' sel' : ''}"><h4>${t.icon} ${t.name}${sel ? ' <small style="color:var(--good)">✓ o\'rnatilgan</small>' : ''}</h4><p>${t.d}</p>${t.mu ? `<div class="meta"><span>Yo'l ${pct(t.mu[8])} · O't ${pct(t.mu[1])} · Qum ${pct(t.mu[2])} · Qor ${pct(t.mu[3])} · Muz ${pct(t.mu[7])}${t.rear < 1 ? ' · orqa ' + pct(t.rear) : ''}</span></div>` : ''}<button data-a="tyre:${t.id || '-'}" class="${has ? 'sec' : ''}" ${sel || (!has && st.money < t.cost) ? 'disabled' : ''}>${sel ? 'O\'rnatilgan' : has ? "O'rnatish" : st.money < t.cost ? `Pul yetarli emas (${som(t.cost)} so'm)` : `Sotib olish — ${som(t.cost)} so'm`}</button></div>`; }).join('')}</div>`; };
  const pct = (k) => (k >= 1 ? '+' : '−') + Math.round(Math.abs(k - 1) * 100) + '%';
  B.fitTyre = (tid, vid = V.cur) => { tid = tid === '-' ? '' : tid; const t = TY[tid]; if (!t) return false; const own = (V.tyres[vid] = V.tyres[vid] || []);
    if (t.id && !own.includes(t.id)) { if (st.money < t.cost) { toast('Pul yetarli emas', 'bad'); return false; } game.addMoney(-t.cost, 'Ustaxona: ' + t.name); own.push(t.id); sfx('buy'); } else sfx('repair');
    if (t.id) V.tyre[vid] = t.id; else delete V.tyre[vid]; if (vid === V.cur) B.applyTyre();
    toast(`${t.icon} ${vehById[vid].name}: ${t.name} o'rnatildi`, 'good'); game.save(); return true; };

  // ---------- bo'yoq ustaxonasi oynasi: o'ng tomonda, mashina chap tomonda aylanib ko'rinadi ----------
  const preview = (d) => { paintModel(game.carModel, d.hex, d.fin, d.tone); };
  const revert = () => { if (!B.draft) return; B.draft = null; game.applyPaint(game.carModel, V.cur); };
  B.cost = (d) => { const s = B.saved(V.cur); let c = 0; if (d.hex !== s.hex) c += COLOR_COST; if (d.fin !== s.fin) c += FIN[d.fin].cost; if (d.tone !== s.tone && d.tone != null) c += TONE_COST; return c; };
  B.pay = () => { const d = B.draft; if (!d) return false; const c = B.cost(d); if (c > st.money) { toast('Pul yetarli emas', 'bad'); return false; }
    if (c > 0) game.addMoney(-c, "Bo'yoq ustaxonasi"); const id = V.cur; V.col[id] = d.hex; V.fin[id] = d.fin; if (d.tone != null) V.tone[id] = d.tone; else delete V.tone[id];
    B.draft = null; game.applyPaint(game.carModel, id); sfx(c ? 'buy' : 'click'); game.banner("Yangi bo'yoq!", `${vehById[id].name} · ${FIN[d.fin].name}${d.tone != null ? ' · ikki rangli' : ''}`, 'gold'); game.save(); return true; };
  B.set = (k, v) => { const s = B.saved(V.cur); if (!B.draft) B.draft = { hex: s.hex, fin: s.fin, tone: s.tone }; B.draft[k] = v; preview(B.draft); return B.draft; };
  B.open = (spot) => { if (game.ui) game.ui.open('boyoq', spot); };
  const ui = game.ui;
  ui.s_boyoq = function (w, spot, btn, x) {
    x(); const g = game;
    const render = () => {
      const s = B.saved(V.cur), d = B.draft || { hex: s.hex, fin: s.fin, tone: s.tone }, c = B.cost(d), v = vehById[V.cur];
      const sw = (hex, act, sel) => `<div class="bq-sw${sel ? ' sel' : ''}" data-a="${act}:${hex}" style="background:${hx(hex)}"></div>`;
      w.innerHTML = `<h1>🎨 Bo'yoq ustaxonasi</h1>
        <p class="sub">Rang va qoplamani tanlang — o'zgarish mashinaning o'zida ko'rinadi. To'lamaguningizcha hech narsa saqlanmaydi. Sizda 💰 ${som(st.money)} so'm.</p>
        <div class="bq-veh">${V.own.map((id) => `<button data-a="veh:${id}" class="${id === V.cur ? '' : 'sec'}">${vehById[id].name}</button>`).join('')}</div>
        <h4 class="lbl">Asosiy rang <small>(${som(COLOR_COST)} so'm)</small></h4>
        <div class="bq-pal">${PALETTE.map((h) => sw(h, 'col', d.hex === h)).join('')}<label class="bq-pick" title="O'zim tanlayman"><input type="color" value="${hx(d.hex)}" data-k="col">🎯</label></div>
        <h4 class="lbl">Qoplama</h4>
        <div class="bq-fin">${FINISH.map((f) => `<button data-a="fin:${f.id}" class="${d.fin === f.id ? '' : 'sec'}" title="${f.d}">${f.icon} ${f.name}<small>${f.cost ? som(f.cost) + " so'm" : 'bepul'}</small></button>`).join('')}</div>
        <p class="sub" style="margin:6px 0 0">${FIN[d.fin].d}</p>
        <h4 class="lbl">Ikki rangli <small>(kapot, oynalar va bamperlar · ${som(TONE_COST)} so'm)</small></h4>
        <div class="bq-pal small"><div class="bq-sw none${d.tone == null ? ' sel' : ''}" data-a="tone:-" title="Bir rangli">✕</div>${PALETTE.filter((_, i) => i % 2 === 0 || i > 17).map((h) => sw(h, 'tone', d.tone === h)).join('')}<label class="bq-pick" title="O'zim tanlayman"><input type="color" value="${hx(d.tone == null ? 0xffffff : d.tone)}" data-k="tone">🎯</label></div>
        <div class="bq-sum"><span>${v.name}: <b>${hx(d.hex).toUpperCase()}</b> · ${FIN[d.fin].name}${d.tone != null ? ' + ' + hx(d.tone).toUpperCase() : ''}</span><span>Jami: <b>${som(c)} so'm</b></span></div>`;
      const r = document.createElement('div'); r.className = 'row'; r.style.marginTop = '10px';
      const pay = btn(c ? `To'lash va saqlash — ${som(c)} so'm` : 'Saqlash', () => { if (B.pay()) render(); }); pay.disabled = !B.draft || c > st.money; r.appendChild(pay);
      r.appendChild(btn('Asl holiga', () => { revert(); render(); }, 'sec')); r.appendChild(btn('← Ustaxona', () => { revert(); g.ui.open('garage', spot); }, 'sec')); w.appendChild(r);
      for (const inp of w.querySelectorAll('input[type=color]')) inp.oninput = () => { const n = parseInt(inp.value.slice(1), 16); B.set(inp.dataset.k === 'tone' ? 'tone' : 'hex', n); clearTimeout(inp._t); inp._t = setTimeout(render, 250); };
      g.ui.on({ col: (h) => { B.set('hex', +h); render(); }, tone: (h) => { B.set('tone', h === '-' ? null : +h); render(); }, fin: (id) => { B.set('fin', id); render(); },
        veh: (id) => { if (id === V.cur) return; revert(); g.pickVehicle(id, spot && spot.x != null ? [spot.x, spot.z, 0] : null); render(); } });
    };
    render();
  };
  // oyna yopilsa — to'lanmagan namuna bekor; ochiq turganda kamera mashina atrofida aylanadi (oyna o'ngda, mashina ekranning chap yarmida)
  let orb = 0; const cp = new THREE.Vector3(), tg = new THREE.Vector3();
  game.hooks.push((dt) => {
    const open = game.ui && game.ui.screenName === 'boyoq';
    if (!open) { if (B.draft) revert(); orb = 0; return; }
    const m = game.carModel, s = m.spec, p = m.root.position, R = Math.max(6.4, s.len * 1.55), cam = game.camera;
    if (B._snap || B._a0 == null) B._a0 = clearAngle(p, R); orb += dt * 0.3; const a = B._a0 + 0.55 * Math.sin(orb);
    tg.set(p.x + Math.sin(a) * R, p.y + 1.3 + s.hgt * 0.45, p.z + Math.cos(a) * R); if (B._snap) cp.copy(tg); else cp.lerp(tg, Math.min(1, dt * 6)); B._snap = false; cam.position.copy(cp); // o'z silliq nuqtamiz (main.js kamerasi har kadr qayta qo'yadi)
    const rx = Math.cos(a), rz = -Math.sin(a), off = R * 0.36; tg.set(p.x + rx * off, p.y + 0.35, p.z + rz * off); cam.lookAt(tg);
  });
  // devor/bino orqasiga tushmaydigan eng ochiq tomon (to'qnashuv jismlari bo'yicha) — kamera shu atrofida tebranadi
  const clearAngle = (p, R) => { let best = car.yaw + 0.9, bs = -1;
    for (let i = 0; i < 24; i++) { const a = car.yaw + 0.9 + (i / 24) * 6.2832; let free = 0;
      for (let d = 1.6; d <= R + 1.2; d += 0.5) { const x = p.x + Math.sin(a) * d, z = p.z + Math.cos(a) * d; if (COL.query(x, z, 0.6).some((o) => !o.dead && o.y1 > p.y + 0.3 && (o.t === 1 ? segD(o, x, z) < o.r + 0.6 : Math.hypot(o.x - x, o.z - z) < o.r + 0.6))) break; free = d; }
      const sc = free - i * 0.001; if (sc > bs) { bs = sc; best = a; } }
    return best; };
  const segD = (o, x, z) => { const sx = o.x2 - o.x, sz = o.z2 - o.z, t = Math.max(0, Math.min(1, ((x - o.x) * sx + (z - o.z) * sz) / (sx * sx + sz * sz || 1))); return Math.hypot(x - o.x - sx * t, z - o.z - sz * t); };
  const op0 = ui.open; ui.open = function (name, data) { if (name === 'boyoq' && this.screenName !== 'boyoq') B._snap = true; return op0.call(this, name, data); };
  return B;
}
