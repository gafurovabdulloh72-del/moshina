// Interfeys: HUD, mini-xarita, bosh menyu, e'lonlar taxtasi, ustaxona va salon, uy, bozor, sumka, harakatlar (o'zbek tilida)
import * as T from './terrain.js';
import { UPG, fmtTime, fmtDist } from './game.js';
import { PAINTS } from './carmodel.js';
import { VEHICLES, vehById, vehStats } from './vehicles.js';
import { ITEMS, SHOP, TOOLS } from './living.js';
import { HOME_LEVELS, DECOR } from './home.js';
import { HAT_LIST } from './rig.js';
import { clamp } from './util.js';
import { barItems, codeOf } from './controls.js';

const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const stars = (n, max = 3) => `<span class="stars">${'★'.repeat(n)}<i>${'★'.repeat(max - n)}</i></span>`;
const TYPE = { del: 'Yetkazish', frag: "Mo'rt yuk", taxi: "Yo'lovchi", col: "Yig'ish", multi: 'Pochta', race: 'Poyga', drift: 'Drift', smash: 'Sindirish', radar: 'Radar', jump: 'Sakrash' };
const WHY = { time: 'Vaqt tugadi', cargo: 'Yuk sindi', comfort: "Yo'lovchi tushib ketdi", wreck: 'Transport ishdan chiqdi', sunk: 'Suvga botdingiz', slow: 'Bronza vaqtiga yetmadi', low: "Ochko yetarli bo'lmadi", left: 'Maydonni tark etdingiz' };
const VICON = { velo: '🚲', skuter: '🛵', kart: '🏎', moto: '🏍', kvadro: '🛺', xetch: '🚗', traktor: '🚜', sedan: '🚘', pikap: '🛻', jip: '🚙', furgon: '🚐', bagi: '🏜', ralli: '🏁', yuk: '🚚', avtobus: '🚌', kupe: '🚗', otochar: '🚒', muskul: '💪', limuzin: '🎩', monstr: '👹', super: '⚡', bolid: '🏎' };
const MPX = 0.25; // xarita: 1 m = 0.25 px (1600 px)
const som = (n) => Math.round(n).toLocaleString('ru-RU');
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export class UI {
  constructor(game) {
    this.g = game; this.root = document.getElementById('ui'); this.screenName = null; this.cache = {}; this.gtab = 0;
    this.buildMap(); this.buildHud();
    this.photo = el('div', '', '📷 Surat rejimi — interfeysni qaytarish: <kbd>P</kbd> yoki shu yerni bosing'); this.photo.id = 'photo'; this.photo.style.display = 'none'; this.photo.onpointerdown = () => this.setHud(true); this.root.appendChild(this.photo);
    this.screen = el('div'); this.screen.id = 'screen'; this.root.appendChild(this.screen);
    this.screen.addEventListener('mousedown', (e) => { if (e.target === this.screen && this.screenName !== 'menu' && this.screenName !== 'result' && this.screenName !== 'confirm' && this.screenName !== 'cloud' && !(this.screenData && this.screenData.back === 'menu')) this.close(); });
  }
  // ---------- xarita rasmi ----------
  buildMap() {
    const N = T.N, NV = T.NV, h = T.grid.h, col = T.grid.col;
    const c0 = document.createElement('canvas'); c0.width = c0.height = N; const x0 = c0.getContext('2d'); const im = x0.createImageData(N, N), d = im.data;
    const l2s = (c) => 255 * (c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const k = j * NV + i, o = (j * N + i) * 4; let r = col[k * 3], g = col[k * 3 + 1], b = col[k * 3 + 2];
      const sh = clamp(1 + (h[k] - h[k + NV + 1]) * 0.05, 0.6, 1.4); r *= sh; g *= sh; b *= sh;
      const hh = h[k];
      if (hh < 0.2 || (hh < 60 && hh < T.waterY(-T.HALF + i * T.CELL, -T.HALF + j * T.CELL))) { const dp = hh < 0.2 ? clamp(-hh / 8, 0, 1) : 0.6; r = 0.045 + 0.02 * (1 - dp); g = 0.3 - 0.1 * dp; b = 0.62 - 0.14 * dp; }
      d[o] = l2s(Math.min(1, r)); d[o + 1] = l2s(Math.min(1, g)); d[o + 2] = l2s(Math.min(1, b)); d[o + 3] = 255;
    }
    x0.putImageData(im, 0, 0);
    const S = (this.mapSize = T.SIZE * MPX), mc = (this.mapCanvas = document.createElement('canvas')); mc.width = mc.height = S; const x = mc.getContext('2d');
    x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high'; x.drawImage(c0, 0, 0, S, S);
    const R = T.roads, P = (v) => (v + T.HALF) * MPX;
    for (const pass of [0, 1]) for (const e of R.edges) {
      x.beginPath(); for (let k = 0; k < e.count; k += 2) { const i = e.start + Math.min(k, e.count - 1); if (k) x.lineTo(P(R.x[i]), P(R.z[i])); else x.moveTo(P(R.x[i]), P(R.z[i])); } const le = e.start + e.count - 1; x.lineTo(P(R.x[le]), P(R.z[le]));
      x.lineCap = x.lineJoin = 'round'; x.strokeStyle = pass ? (e.type ? '#e9d9b6' : '#fff6de') : 'rgba(60,40,20,.75)'; x.lineWidth = (e.type ? 2.2 : 3.6) + (pass ? 0 : 2); x.setLineDash(e.type && pass ? [5, 4] : []); x.stroke();
    }
    x.setLineDash([]);
  }
  // ---------- HUD ----------
  buildHud() {
    const hud = (this.hud = el('div')); hud.id = 'hud'; this.root.appendChild(hud);
    const tl = el('div', 'tl'); tl.innerHTML = `<div class="chip">💰 <b id="h-money">0</b> <small>so'm</small></div><div class="chip">★ <b id="h-stars">0</b></div><div class="chip">❤ <b id="h-karma">0</b></div><div class="chip" id="h-lvl"></div>`; hud.appendChild(tl);
    const tr = el('div', 'tr'); tr.innerHTML = `<div class="clock" id="h-clock"></div><div class="keys2" id="h-top"></div>`; hud.appendChild(tr);
    this.actP = el('div', 'tc panel'); this.actP.style.display = 'none'; hud.appendChild(this.actP);
    const bl = el('div', 'bl'); bl.innerHTML = `<canvas id="mini" width="424" height="424"></canvas><div class="loc"><span id="h-loc"></span><small id="h-reg"></small></div>`; hud.appendChild(bl);
    const br = el('div', 'br'); br.innerHTML = `<div class="dmg panel" id="h-dmgp"><canvas id="h-dmg" width="128" height="184"></canvas><span id="h-hp">100%</span></div><div class="speedo panel" id="h-spd" style="position:relative"><div class="g" id="h-gear">1</div><div class="v" id="h-speed">0</div><div class="u">KM/SOAT</div><div class="bar rpm"><i id="h-rpm"></i></div><div class="bar nitro" id="h-nb"><i id="h-nitro"></i></div><div class="vn" id="h-vn"></div></div>
      <div class="foot panel" id="h-foot" style="display:none"><div class="fl">⚡ Kuch</div><div class="bar"><i id="h-en"></i></div><div class="fl">🍽 To'qlik</div><div class="bar"><i id="h-sat" style="background:var(--ac)"></i></div><div class="inv" id="h-inv"></div></div>`; hud.appendChild(br);
    // pastki markaz: vaziyatga qarab katta tugma (masalan [E] Hosilni yig'ish) va uning ostida amal tugmalari qatori
    const bc = el('div', 'bcol'); hud.appendChild(bc);
    this.prompt = el('div', 'bc panel'); this.prompt.style.display = 'none'; bc.appendChild(this.prompt);
    this.abar = el('div', 'abar'); this.abar.id = 'h-bar'; bc.appendChild(this.abar);
    this.driftEl = el('div'); this.driftEl.id = 'drift'; hud.appendChild(this.driftEl);
    this.toasts = el('div'); this.toasts.id = 'toasts'; hud.appendChild(this.toasts);
    this.bannerEl = el('div'); this.bannerEl.id = 'banner'; hud.appendChild(this.bannerEl);
    this.countEl = el('div'); this.countEl.id = 'count'; hud.appendChild(this.countEl);
    for (const id of ['speedfx', 'flash', 'fade']) { const e = el('div'); e.id = id; hud.appendChild(e); this[id] = e; }
    this.mini = document.getElementById('mini').getContext('2d'); this.dmgC = document.getElementById('h-dmg').getContext('2d');
    this.$ = (id) => this.cache[id] || (this.cache[id] = document.getElementById(id));
    // Ekrandagi tugmalar klaviaturaning o'zini bosadi: bosilganda tugma kodi kiritishga qo'shiladi, qo'yib yuborilganda olinadi —
    // shuning uchun tugma va klavisha AYNAN bir xil ishlaydi (controls.js jadvali)
    const inp = this.g.input, held = new Map();
    const vDown = (e) => { const b = e.target.closest('[data-code]'); if (!b || e.button > 0) return; e.preventDefault(); e.stopPropagation(); const c = b.dataset.code; if (!c) return; inp.keys.add(c); inp.pressed.add(c); held.set(e.pointerId, [c, b]); b.classList.add('act'); this.g.audio.init(); };
    const vUp = (e) => { const h = held.get(e.pointerId); if (!h) return; held.delete(e.pointerId); if (![...held.values()].some((q) => q[0] === h[0])) inp.keys.delete(h[0]); h[1].classList.remove('act'); };
    for (const box of [this.abar, this.prompt, this.$('h-top')]) box.addEventListener('pointerdown', vDown);
    addEventListener('pointerup', vUp); addEventListener('pointercancel', vUp);
    // sensorli ekran: chapda virtual joystik (yurish / rul, gaz va tormoz), o'ngda pedallar (transportda)
    const tc = (this.touch = el('div')); tc.id = 'touch'; this.root.appendChild(tc);
    const t = inp.touch;
    const tb = (txt, cls, style, on, off) => { const b = el('div', 'tb ' + cls, txt); b.style.cssText = style; const dn = (e) => { e.preventDefault(); b.classList.add('act'); on(); }, up = (e) => { e.preventDefault(); b.classList.remove('act'); off(); }; b.addEventListener('pointerdown', dn); b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('pointerleave', up); tc.appendChild(b); };
    tb('▲', 'pedal', 'right:22px', () => (t.gas = 1), () => (t.gas = 0)); tb('▼', 'pedal', 'right:112px', () => (t.brake = 1), () => (t.brake = 0));
    const joy = el('div', 'joy'), knob = el('i'); joy.appendChild(knob); tc.appendChild(joy);
    let jid = null, jx = 0, jy = 0;
    const jmove = (e) => { const r = joy.getBoundingClientRect(), R = r.width / 2; let dx = e.clientX - r.left - R, dy = e.clientY - r.top - R; const l = Math.hypot(dx, dy); if (l > R) { dx *= R / l; dy *= R / l; }
      knob.style.transform = `translate(${dx}px,${dy}px)`; const k = Math.hypot(dx, dy) / R < 0.18 ? 0 : 1; t.jx = (dx / R) * k; t.jy = (dy / R) * k; };
    joy.addEventListener('pointerdown', (e) => { e.preventDefault(); jid = e.pointerId; joy.setPointerCapture(jid); joy.classList.add('act'); jmove(e); });
    joy.addEventListener('pointermove', (e) => { if (e.pointerId === jid) jmove(e); });
    const jend = (e) => { if (e.pointerId !== jid) return; jid = null; t.jx = t.jy = 0; knob.style.transform = ''; joy.classList.remove('act'); };
    joy.addEventListener('pointerup', jend); joy.addEventListener('pointercancel', jend);
    this.touchOn = () => { tc.classList.add('on'); hud.classList.add('touch'); };
    addEventListener('touchstart', this.touchOn, { once: true, passive: true });
  }
  // Interfeysni yashirish (surat rejimi) — hech qachon "yo'qolib qolmaydi": yozuv turadi va 20 soniyadan keyin o'zi qaytadi
  setHud(on) { const g = this.g; g.hudOn = on; this.hud.classList.toggle('hide', !on); this.photo.style.display = on ? 'none' : ''; clearTimeout(this._ht); if (!on) this._ht = setTimeout(() => { this.setHud(true); this.toast('Interfeys qaytarildi'); }, 20000); }
  set(id, v) { const e = this.$(id); if (e && e._v !== v) { e._v = v; e.textContent = v; } }
  toast(msg, kind = '') { const t = el('div', 'toast ' + kind, msg); this.toasts.appendChild(t); while (this.toasts.children.length > 5) this.toasts.firstChild.remove(); setTimeout(() => { t.style.transition = 'opacity .5s'; t.style.opacity = 0; setTimeout(() => t.remove(), 500); }, 3800); }
  banner(a, b = '', kind = '') { const e = this.bannerEl; e.className = 'on ' + kind; e.innerHTML = `<h2>${a}</h2>${b ? `<p>${b}</p>` : ''}`; clearTimeout(this._bt); this._bt = setTimeout(() => (e.className = kind), kind === 'place' ? 1800 : 3600); }
  update(dt) {
    const g = this.g, car = g.car, st = g.state, pl = g.player, foot = pl.onFoot;
    const kmh = Math.round(Math.abs(car.speed) * 3.6);
    this.set('h-money', som(st.money)); this.set('h-stars', g.totalStars() + '/' + g.maxStars); this.set('h-karma', Math.floor(st.karma));
    const lv = g.level(); if (this._lv !== lv) { if (this._lv && lv > this._lv) { this.banner('Yangi daraja!', g.levelName(), 'gold'); g.audio.sfx('win'); } this._lv = lv; this.$('h-lvl').innerHTML = `<small>${lv}-daraja</small> ${g.levelName()}`; }
    if (this._foot !== foot) { this._foot = foot; this.$('h-spd').style.display = this.$('h-dmgp').style.display = foot ? 'none' : ''; this.$('h-foot').style.display = foot ? '' : 'none'; this.touch.classList.toggle('foot', foot); }
    if (foot) { this.$('h-en').style.width = Math.round(st.energy) + '%'; this.$('h-sat').style.width = Math.round(st.sat) + '%'; const iv = st.inv, s = `🌱${iv.seed} 🍎${iv.fruit + iv.berry} 🌾${iv.hay} 🪵${iv.wood}`; this.set('h-inv', s); }
    else { this.set('h-speed', kmh); this.set('h-gear', car.reverse ? 'R' : car.bike && g.carModel.v.eng === 0 ? '·' : car.gear); this.set('h-vn', g.carModel.v.name);
      this.$('h-rpm').style.width = Math.round(car.rpm * 100) + '%'; this.$('h-nitro').style.width = Math.round(g.nitro * 100) + '%'; this.$('h-nb').className = 'bar nitro' + (car.nitroOn ? ' on' : ''); this.drawDmg(); }
    const hr = g.hour, hh = Math.floor(hr), mm = Math.floor((hr - hh) * 60); this.set('h-clock', `${g.sky.night > 0.5 ? '🌙' : '☀️'} ${hh < 10 ? '0' : ''}${hh}:${mm < 10 ? '0' : ''}${mm}`);
    this.set('h-loc', g.curPlace ? g.curPlace.name : ''); this.set('h-reg', g.region || '');
    this.speedfx.style.opacity = foot ? 0 : clamp((kmh - 95) / 80, 0, 0.9) + (car.nitroOn ? 0.25 : 0); this.flash.style.opacity = g.damage.flash * 0.9;
    const ds = !foot && g.driftScore > 60 ? `DRIFT <b>${Math.round(g.driftScore)}</b>` : ''; if (this._ds !== ds) { this._ds = ds; this.driftEl.innerHTML = ds; }
    // chellenj paneli
    const a = g.act;
    if (a) {
      const low = a.def.type !== 'race' && a.timer < 10;
      const html = `<h3>${a.def.name}</h3><div class="timer${low ? ' low' : ''}">${fmtTime(a.timer || 0)}</div>${(a.lines || []).filter(Boolean).map((l) => `<div class="ln">${l}</div>`).join('')}${a.bar ? `<div class="ln">${a.bar.label}</div><div class="bar"><i style="width:${Math.round(a.bar.v * 100)}%;background:${a.bar.v > 0.5 ? 'var(--good)' : a.bar.v > 0.25 ? 'var(--ac)' : 'var(--bad)'}"></i></div>` : ''}<div class="ln" style="opacity:.6;font-size:11.5px;margin-top:4px">[X] — bekor qilish</div>`;
      if (this._ah !== html) { this._ah = html; this.actP.innerHTML = html; } this.actP.style.display = '';
      this.countEl.textContent = a.state === 'count' ? (a.count3 > 0.25 ? Math.ceil(a.count3 - 0.2) : 'OLG\'A!') : (a.def.type === 'race' && a.t < 0.9 ? "OLG'A!" : '');
    } else { if (this._ah) { this._ah = null; this.actP.style.display = 'none'; } this.countEl.textContent = ''; }
    // [E] taklifi
    let pr = '';
    const np = g.nearPoint;
    if (g.damage.wrecked && !foot) pr = '<kbd>T</kbd> Evakuator chaqirish (ustaxonaga)';
    else if (np && np.kind === 'home') pr = '<kbd>E</kbd> Uyga kirish';
    else if (np && !a) pr = np.kind === 'board' ? "<kbd>E</kbd> E'lonlar taxtasi" : '<kbd>E</kbd> Ustaxona va transport saloni';
    else if (np && a && np.kind === 'garage') pr = '<kbd>E</kbd> Ustaxona';
    else pr = g.live.prompt || '';
    // katta tugma: yozuv [X] bilan boshlansa — bosiladi (shu klavisha kodi), aks holda faqat ma'lumot
    const pk = (/^<kbd>([^<]+)<\/kbd>/.exec(pr) || [])[1], pcode = pk ? codeOf(pk) : null;
    if (this._pr !== pr) { this._pr = pr; this.prompt.innerHTML = pr; this.prompt.style.display = pr ? '' : 'none'; this.prompt.dataset.code = pcode || ''; this.prompt.classList.toggle('go', !!pcode); }
    this.drawBar(this.abar, barItems(g).filter((b) => b.key !== pk), '_bk'); this.drawBar(this.$('h-top'), barItems(g, true), '_tk');
    this.drawMini();
  }
  // tugmalar qatorini chizish (faqat tarkib o'zgarganda)
  drawBar(box, items, key) {
    const sig = items.map((b) => b.code + b.text).join('|'); if (this[key] === sig) return; this[key] = sig;
    box.innerHTML = items.map((b) => `<button tabindex="-1" class="ab${b.hold ? ' hold' : ''}" data-code="${b.code}" title="${b.text} (${b.key})"><kbd>${b.key}</kbd><span>${b.text}</span></button>`).join('');
  }
  drawDmg() {
    const d = this.g.damage, key = `${Math.round(d.zone.front / 4)},${Math.round(d.zone.rear / 4)},${Math.round(d.zone.left / 4)},${Math.round(d.zone.right / 4)},${Math.round(d.engine / 4)},${d.tires.join('')}`;
    if (key === this._dk) return; this._dk = key;
    const c = this.dmgC, col = (v) => (v > 70 ? '#5fd38a' : v > 40 ? '#ffc83a' : v > 15 ? '#ff8a3a' : '#ff4a3a');
    c.clearRect(0, 0, 128, 184);
    const rr = (x, y, w, h, r, f) => { c.fillStyle = f; c.beginPath(); c.roundRect(x, y, w, h, r); c.fill(); };
    for (const [i, x, y] of [[0, 14, 36], [1, 96, 36], [2, 14, 124], [3, 96, 124]]) rr(x, y, 18, 34, 6, d.tires[i] ? '#ff4a3a' : '#3a3f4c');
    rr(30, 10, 68, 44, [16, 16, 4, 4], col(d.zone.front)); rr(30, 130, 68, 44, [4, 4, 16, 16], col(d.zone.rear)); rr(30, 58, 32, 68, 4, col(d.zone.right)); rr(66, 58, 32, 68, 4, col(d.zone.left));
    c.fillStyle = 'rgba(10,14,24,.75)'; c.beginPath(); c.arc(64, 34, 12, 0, 6.283); c.fill(); c.fillStyle = col(d.engine); c.font = '900 15px system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('⚙', 64, 35);
    const hp = d.health; this.set('h-hp', hp + '%'); this.$('h-hp').style.color = col(hp);
  }
  drawMini() {
    const g = this.g, c = this.mini, car = g.car, pl = g.player, foot = pl.onFoot, W = 424, R = W / 2, px = foot ? pl.p[0] : car.p[0], pz = foot ? pl.p[2] : car.p[2], yaw = foot ? g.cam.heading + g.cam.yawOff : car.yaw;
    const sc = foot ? 1.1 : 0.64, vr = 300 / sc; // px (2x) per metr
    c.save(); c.clearRect(0, 0, W, W); c.beginPath(); c.arc(R, R, R - 3, 0, 6.283); c.clip();
    c.fillStyle = '#2f89c0'; c.fillRect(0, 0, W, W);
    c.translate(R, R); c.rotate(Math.PI + yaw);
    c.scale(sc, sc); c.translate(-px, -pz);
    c.imageSmoothingEnabled = true;
    const k = 1 / MPX; c.drawImage(this.mapCanvas, -T.HALF, -T.HALF, this.mapSize * k, this.mapSize * k);
    const dot = (x, z, r, f, s) => { c.beginPath(); c.arc(x, z, r / sc, 0, 6.283); c.fillStyle = f; c.fill(); if (s) { c.lineWidth = 2.5 / sc; c.strokeStyle = s; c.stroke(); } };
    if (g.routePts) { c.beginPath(); const rp = g.routePts; c.moveTo(px, pz); for (let i = 0; i < rp.length; i += 2) c.lineTo(rp[i][0], rp[i][1]); if (g.way) c.lineTo(g.way.x, g.way.z); c.strokeStyle = '#35e0ff'; c.lineWidth = 7 / sc; c.lineJoin = 'round'; c.globalAlpha = 0.85; c.stroke(); c.globalAlpha = 1; }
    const a = g.act;
    if (!a || a.def.type !== 'race') for (const p of g.points) { if (Math.abs(p.x - px) > vr || Math.abs(p.z - pz) > vr || p.kind === 'home') continue; dot(p.x, p.z, 9, p.kind === 'board' ? '#ffc83a' : '#4fb0ff', '#141824'); }
    for (const q of g.acts.acts) { if (q.cat !== 'radar' && q.cat !== 'jump') continue; if (Math.abs(q.x - px) > vr || Math.abs(q.z - pz) > vr) continue; dot(q.x, q.z, 5.5, q.cat === 'radar' ? '#ff6a55' : '#b07cff', '#fff'); }
    for (const k2 of g.pick.kits) if (k2.cd <= 0 && Math.abs(k2.x - px) < vr && Math.abs(k2.z - pz) < vr) dot(k2.x, k2.z, 4.5, '#fff', '#e03a2a');
    for (const d of g.live.dots) if (Math.abs(d[0] - px) < vr && Math.abs(d[1] - pz) < vr) dot(d[0], d[1], d[3] ? 10 : 6, d[2], d[3] ? '#fff' : '#141824');
    if (foot) dot(car.p[0], car.p[2], 8, '#d8392b', '#fff');
    if (g.netDots) for (const d of g.netDots) dot(d[0], d[1], 11, d[2], '#141824'); // onlayn do'stlar
    if (a) {
      if (a.items) for (const it of a.items) if (!it.got) dot(it.x, it.z, 8, '#fff', '#ff5aa0');
      if (a.path) { const ci = a.cps[a.cpi]; if (ci != null) dot(a.path[ci][0], a.path[ci][1], 11, '#ffe14a', '#141824'); }
      for (const r of g.rivals) if (r.active) dot(r.car.p[0], r.car.p[2], 7, '#ff5a4a', '#fff');
    }
    c.restore();
    // maqsad chetda ko'rsatkich
    const tg = (a && a.tgt) || g.way;
    if (tg) { const dx = tg.x - px, dz = tg.z - pz, d = Math.hypot(dx, dz); const lx = dx * Math.cos(yaw) - dz * Math.sin(yaw), lz = dx * Math.sin(yaw) + dz * Math.cos(yaw); const ang = Math.atan2(-lx, lz);
      const rr = Math.min(R - 20, d * sc); const x = R + Math.sin(ang) * rr, y = R - Math.cos(ang) * rr; c.beginPath(); c.arc(x, y, 12, 0, 6.283); c.fillStyle = '#ffe14a'; c.fill(); c.lineWidth = 4; c.strokeStyle = '#141824'; c.stroke(); }
    // o'yinchi belgisi
    c.save(); c.translate(R, R); if (foot) { c.rotate(yaw - pl.yaw); c.beginPath(); c.arc(0, 0, 10, 0, 6.283); c.fillStyle = '#ffd23a'; c.fill(); c.lineWidth = 4; c.strokeStyle = '#141824'; c.stroke(); c.beginPath(); c.moveTo(0, -17); c.lineTo(6, -9); c.lineTo(-6, -9); c.closePath(); c.fillStyle = '#141824'; c.fill(); }
    else { c.beginPath(); c.moveTo(0, -17); c.lineTo(12, 13); c.lineTo(0, 6); c.lineTo(-12, 13); c.closePath(); c.fillStyle = '#fff'; c.fill(); c.lineWidth = 4; c.strokeStyle = '#d8392b'; c.stroke(); } c.restore();
    c.beginPath(); c.arc(R, R, R - 4, 0, 6.283); c.lineWidth = 7; c.strokeStyle = 'rgba(255,255,255,.9)'; c.stroke();
    // shimol
    const nx = R - Math.sin(yaw) * (R - 8), ny = R + Math.cos(yaw) * (R - 8);
    c.beginPath(); c.arc(nx, ny, 13, 0, 6.283); c.fillStyle = '#d8392b'; c.fill(); c.fillStyle = '#fff'; c.font = '900 16px system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('N', nx, ny + 1);
  }
  // ---------- oynalar ----------
  open(name, data) {
    const g = this.g; this.screenName = name; this.screenData = data; g.mode = name === 'menu' ? 'menu' : 'ui'; this.screen.className = 'on ' + name; this.screen.innerHTML = '';
    this.hud.style.visibility = name === 'menu' ? 'hidden' : '';
    const small = ['pause', 'settings', 'result', 'rest', 'confirm', 'coopres'].includes(name);
    // ✕ tugmasi oynaning o'zida emas, o'ramida turadi — oyna ichi qayta chizilganda ham o'chib ketmaydi
    const wrap = el('div', 'winwrap' + (small ? ' small' : '')), w = el('div', 'win'); wrap.appendChild(w);
    if (name !== 'menu') this.screen.appendChild(wrap);
    const closeBtn = () => { if (wrap.querySelector(':scope > .x')) return; const b = el('button', 'x', '✕'); b.title = 'Yopish (Esc)'; b.onclick = (e) => { e.stopPropagation(); g.audio.sfx('click'); this.close(); }; wrap.appendChild(b); };
    const btn = (txt, fn, cls = '') => { const b = el('button', cls, txt); b.onclick = () => { g.audio.sfx('click'); fn(); }; return b; };
    // data-a="buyruq:argument" atributli tugmalar uchun umumiy ishlov
    this.on = (map) => { w.onclick = (e) => { const b = e.target.closest('[data-a]'); if (!b || b.disabled) return; const [a, arg] = b.dataset.a.split(':'); if (map[a]) { g.audio.sfx('click'); map[a](arg, b); } }; };
    this['s_' + name](w, data, btn, closeBtn);
  }
  close() { if (this.screenName === 'menu') return; this.screenName = null; this.screen.className = ''; this.screen.innerHTML = ''; this.g.mode = 'play'; this.hud.style.visibility = ''; this.g.input.keys.clear(); if (!this.g.hudOn) this.setHud(true); }
  confirm(title, text, yes, fn, back) { this.open('confirm', { title, text, yes, fn, back }); }
  s_confirm(w, d, btn) {
    w.style.textAlign = 'center'; w.innerHTML = `<h1>${d.title}</h1><p class="sub" style="font-size:15px">${d.text}</p>`;
    const r = el('div', 'row'); r.style.justifyContent = 'center'; w.appendChild(r);
    r.appendChild(btn(d.yes, d.fn, 'bad')); r.appendChild(btn('Bekor qilish', () => (d.back ? this.open(d.back) : this.close()), 'sec'));
  }
  s_menu() {
    const g = this.g, st = g.state, fresh = st.fresh, m = el('div', 'menu2'); this.screen.appendChild(m);
    const own = st.veh.own.length;
    m.innerHTML = `<div class="m-bar t"></div><div class="m-bar b"></div>
      <div class="m-left"><div class="m-kicker">OROL BO'YLAB KATTA SAYOHAT</div><h1 class="m-title">SAFAR</h1><div class="m-line"></div>
        <p class="m-sub">Hayda. Kashf et. Yasha. — 22 transport · 16 manzil · ${g.acts.acts.length} chellenj · piyoda 50 ta imkoniyat</p>
        <div class="m-btns">
          <button data-a="play" class="m-main"><span>▶</span>${fresh ? "O'yinni boshlash" : 'Davom etish'}</button>
          ${fresh ? '' : `<button data-a="new" class="sec"><span>↺</span>Yangi o'yin</button>`}
          <button data-a="online" class="sec"><span>🌐</span>Onlayn — do'stlar bilan</button>
          <button data-a="help" class="sec"><span>⌨</span>Boshqaruv</button>
          <button data-a="set" class="sec"><span>⚙</span>Sozlamalar</button>
          <button data-a="full" class="sec"><span>⛶</span>To'liq ekran</button>
        </div></div>
      ${fresh ? '' : `<div class="m-card"><h4>${g.levelName()} <small>${g.level()}-daraja</small></h4>
        <div class="stat"><span>💰 Pul</span><b>${som(st.money)} so'm</b></div><div class="stat"><span>★ Yulduzlar</span><b>${g.totalStars()}/${g.maxStars}</b></div>
        <div class="stat"><span>🚗 Transportlar</span><b>${own}/${VEHICLES.length}</b></div><div class="stat"><span>🏠 Uy</span><b>${HOME_LEVELS[st.home.lvl].name}</b></div><div class="stat"><span>❤ Yaxshilik</span><b>${Math.floor(st.karma)}</b></div></div>`}
      <div class="m-foot">v2.0 · W A S D — haydash · F — tushish/chiqish · Probel — drift · Shift — nitro</div>`;
    m.onclick = (e) => { const b = e.target.closest('[data-a]'); if (!b) return; g.audio.init(); g.audio.sfx('click'); const a = b.dataset.a;
      if (a === 'play') { st.fresh = false; this.screenName = null; this.close(); g.startPlay(); }
      else if (a === 'new') this.confirm("Yangi o'yin", "Barcha yutuqlar, pul, transportlar va uy o'chiriladi. Rostdan ham boshidan boshlaysizmi?", "Ha, yangidan boshlash", () => g.resetSave(), 'menu');
      else if (a === 'online') this.open('online', { back: 'menu' });
      else if (a === 'help') this.open('help', { back: 'menu' }); else if (a === 'set') this.open('settings', { back: 'menu' });
      else if (a === 'full') { const d = document; if (d.fullscreenElement) d.exitFullscreen(); else d.documentElement.requestFullscreen && d.documentElement.requestFullscreen().catch(() => {}); } };
  }
  s_pause(w, d, btn, x) {
    const g = this.g; x(); w.innerHTML = `<h1>Pauza</h1><p class="sub">${g.levelName()} · ★ ${g.totalStars()}/${g.maxStars} · Muhrlar ${g.stampCount()}/${Object.keys(g.stamps()).length} · ❤ ${Math.floor(g.state.karma)}</p>`;
    const col = el('div'); col.style.cssText = 'display:flex;flex-direction:column;gap:8px'; w.appendChild(col);
    col.appendChild(btn('▶  Davom etish', () => this.close()));
    col.appendChild(btn("🌐 Onlayn — do'stlar bilan", () => this.open('online'), 'sec'));
    col.appendChild(btn('Xarita', () => this.open('map'), 'sec')); col.appendChild(btn('Sumka va topshiriqlar', () => this.open('bag'), 'sec')); col.appendChild(btn('Sayohat pasporti', () => this.open('progress'), 'sec'));
    col.appendChild(btn('Vaqtni almashtirish (dam olish)', () => this.open('rest'), 'sec'));
    col.appendChild(btn("Ustaxonaga evakuatsiya (200 so'm)", () => { this.close(); g.tow(); }, 'sec'));
    col.appendChild(btn('Boshqaruv', () => this.open('help', { back: 'pause' }), 'sec')); col.appendChild(btn('Sozlamalar', () => this.open('settings', { back: 'pause' }), 'sec'));
    col.appendChild(btn('Bosh menyu', () => { g.save(); this.open('menu'); g.cam.mode = 3; }, 'sec'));
    col.appendChild(btn("Yangi o'yin (boshidan boshlash)", () => this.confirm("Yangi o'yin", "Barcha yutuqlar, pul, transportlar va uy o'chiriladi. Rostdan ham boshidan boshlaysizmi?", "Ha, yangidan boshlash", () => g.resetSave(), 'pause'), 'sec'));
  }
  s_help(w, d, btn, x) {
    const K = (a) => a.map((k) => `<kbd>${k}</kbd>`).join(' ');
    const rows = (list) => list.map(([k, t]) => `<div>${K(k)}</div><div>${t}</div>`).join('');
    w.innerHTML = `<h1>Boshqaruv</h1><div class="grid2"><div><h4 style="margin:8px 0 2px">Transportda</h4><div class="keys">${rows([[['W', 'S'], 'Gaz / tormoz va orqaga'], [['A', 'D'], 'Burilish'], [['Probel'], "Qo'l tormozi — drift"], [['Shift'], 'Nitro'], [['F'], 'Transportdan tushish'], [['R'], "Yo'lga qaytarish"], [['H', 'L'], 'Signal · faralar'], [['T'], 'Evakuator (motor o\'chganda)'], [['E'], "Taxta / ustaxona / yo'lovchi olish"]])}</div></div>
      <div><h4 style="margin:8px 0 2px">Piyoda</h4><div class="keys">${rows([[['W', 'A', 'S', 'D'], 'Yurish'], [['Shift'], 'Yugurish'], [['Probel'], 'Sakrash'], [['F'], 'Transportga chiqish'], [['V'], 'Transportni chaqirish'], [['E'], 'Harakat (silkitish, gaplashish, terish…)'], [['Q', 'G', 'Y'], "O't yulish · gul ekish · yeyish"], [['B'], 'Harakatlar menyusi'], [['1', '2', '3'], 'Raqs · dutor · salom'], [['L', 'Z'], 'Fonar · durbin']])}</div></div></div>
      <div class="keys" style="margin-top:10px">${rows([[['M'], 'Xarita va GPS'], [['I'], 'Sumka, topshiriqlar, albom'], [['Tab'], 'Sayohat pasporti'], [['C'], 'Kamera · sichqoncha bilan aylantirish'], [['X'], 'Chellenjni bekor qilish'], [['N', 'P'], 'Musiqa · surat rejimi'], [['O', 'U'], 'Onlayn (do\'stlar bilan) · chat'], [['Esc'], 'Pauza']])}</div>
      <p class="sub" style="margin-top:12px">Geympad ham ishlaydi: RT/LT — gaz/tormoz, chap stik — rul, A — qo'l tormozi, X — nitro.</p>`;
    w.appendChild(btn('Orqaga', () => this.open(d.back)));
  }
  s_settings(w, d, btn) {
    const g = this.g, s = g.state.set; w.innerHTML = '<h1>Sozlamalar</h1>';
    const row = (label, node) => { const r = el('div', 'row'); r.style.margin = '12px 0'; r.appendChild(el('div', 'grow', label)); r.appendChild(node); w.appendChild(r); };
    const vol = el('input'); vol.type = 'range'; vol.min = 0; vol.max = 1; vol.step = 0.05; vol.value = s.vol; vol.oninput = () => { s.vol = +vol.value; g.audio.setVol(s.vol); }; row('Ovoz balandligi', vol);
    const tgl = (get, set) => { const b = btn(get() ? 'Yoqilgan' : "O'chirilgan", () => { set(!get()); b.textContent = get() ? 'Yoqilgan' : "O'chirilgan"; }, 'sec'); return b; };
    row('Musiqa', tgl(() => s.music, (v) => { s.music = v; g.audio.setMusic(v); }));
    row('Transport shikastlanishi', tgl(() => s.damage !== false, (v) => { s.damage = v; g.applyUpgrades(); }));
    const QN = ['Past (tez)', "O'rta", 'Yuqori (eng chiroyli)'];
    const q = btn(QN[s.gfx], () => { s.gfx = (s.gfx + 1) % 3; q.textContent = QN[s.gfx]; g.applyQuality(); }, 'sec'); row('Grafika sifati', q);
    w.appendChild(el('p', 'sub', "O'yin sekinlashsa, grafika sifatini pasaytiring. Aniqlik avtomatik moslashadi."));
    w.appendChild(btn('Tayyor', () => { g.save(); this.open(d.back); }));
  }
  s_rest(w, d, btn, x) {
    const g = this.g; x(); w.innerHTML = '<h1>Dam olish</h1><p class="sub">Kunning qaysi vaqtida uyg\'onasiz? Kuch va to\'qlik to\'liq tiklanadi.</p>';
    const r = el('div', 'cards'); w.appendChild(r);
    for (const [n, h, e] of [['Tong', 6.4, '🌅'], ['Kunduz', 12, '☀️'], ['Shom', 18.3, '🌇'], ['Tun', 22, '🌙']]) { const c = el('div', 'card', `<h4>${e} ${n}</h4>`); c.style.cursor = 'pointer'; c.onclick = () => { this.fade.style.opacity = 1; setTimeout(() => { g.live.sleep(h); this.close(); this.fade.style.opacity = 0; }, 380); }; r.appendChild(c); }
  }
  actCard(a, onStart) {
    const g = this.g, s = g.starsFor(a), un = g.unlocked(a);
    const c = el('div', 'card' + (un ? '' : ' lock'));
    let extra = '';
    if (a.cat === 'race') { g.raceInfo(a); extra = `<div class="meta"><span>${fmtDist(a._len)} · oltin ${fmtTime(a._t[2])}</span><span>${g.state.best[a.id] ? 'Rekord ' + fmtTime(g.state.best[a.id]) : ''}</span></div>`; }
    if (a.cat === 'zone') extra = `<div class="meta"><span>★ ${a.thr[0]} · ★★ ${a.thr[1]} · ★★★ ${a.thr[2]}</span><span>${g.state.best[a.id] ? 'Rekord ' + g.state.best[a.id] : ''}</span></div>`;
    c.innerHTML = `<h4><span class="tag ${a.cat}">${TYPE[a.type]}</span>${a.name}</h4><p>${a.desc}</p>${extra}<div class="meta"><span>💰 ${a.reward} so'm</span>${a.cat === 'inf' ? '<span class="stars">♾ cheksiz</span>' : stars(s)}</div>`;
    const b = el('button', '', un ? (s ? 'Qayta bajarish' : 'Boshlash') : a.opt && a.opt.final ? `🔒 10 ta muhr kerak (${g.stampCount()}/10)` : '🔒 Avval oldingisini bajaring'); b.disabled = !un; b.onclick = () => { g.audio.sfx('click'); onStart(a); }; c.appendChild(b);
    return c;
  }
  s_board(w, pid, btn, x) {
    const g = this.g, p = g.site.places[pid]; x();
    const list = g.acts.byPlace[pid] || [];
    w.innerHTML = `<h1>${p.name} <small>e'lonlar taxtasi</small></h1><p class="sub">Buyurtmalarni bajaring, poygalarda qatnashing — yulduz va so'm to'plang. Uchala buyurtma bajarilsa, pasportga muhr bosiladi. ♾ belgili buyurtma har safar yangilanadi — cheksiz.</p>`;
    const cards = el('div', 'cards'); w.appendChild(cards);
    const start = (q) => { this.close(); g.startAct(q); };
    for (const a of list) cards.appendChild(this.actCard(a, start));
    if (!this._inf || this._inf.place !== pid) this._inf = g.infJob(pid); cards.appendChild(this.actCard(this._inf, (q) => { this._inf = null; start(q); }));
    const r = el('div', 'row'); r.style.marginTop = '14px'; r.appendChild(btn('🛒 Bozor (sotish va xarid)', () => this.open('shop', { back: ['board', pid] }))); r.appendChild(btn('Dam olish', () => this.open('rest'), 'sec')); r.appendChild(btn('Xarita', () => this.open('map'), 'sec')); w.appendChild(r);
  }
  vehCard(v, own, cur, canBuy) {
    const s = vehStats(v), bar = (n, val) => `<div class="sb"><span>${n}</span><div class="bar"><i style="width:${Math.round(val * 100)}%"></i></div></div>`;
    return `<div class="card veh${cur ? ' sel' : ''}"><h4>${VICON[v.id] || '🚗'} ${v.name}${cur ? ' <small style="color:var(--good)">✓ tanlangan</small>' : ''}</h4><p>${v.desc}</p>
      ${bar('Tezlik', s.speed)}${bar('Tezlanish', s.accel)}${bar("Yo'l tutishi", s.grip)}${bar("Yo'lsizlik", s.offroad)}${bar('Mustahkamlik', s.strong)}
      <div class="meta"><span>${v.spec.top} km/soat</span><span>${own ? '' : '💰 ' + som(v.price) + " so'm"}</span></div>
      <button data-a="${own ? 'pick' : 'buy'}:${v.id}" ${cur || (!own && !canBuy) ? 'disabled' : ''} class="${own ? 'sec' : ''}">${cur ? 'Hozir shu transportdasiz' : own ? 'Tanlash' : canBuy ? 'Sotib olish' : 'Pul yetarli emas'}</button></div>`;
  }
  s_garage(w, pt, btn, x) {
    const g = this.g, st = g.state, d = g.damage; x();
    const spot = pt && pt.x != null ? [pt.x, pt.z, 0] : null;
    const render = () => {
      const hp = d.health, cost = Math.round(((100 - hp) * 9 + d.tires.reduce((a, b) => a + b, 0) * 60) * Math.max(0.4, Math.sqrt(g.car.mass / 1500)));
      let h = `<h1>Ustaxona <small>💰 ${som(st.money)} so'm · ${g.carModel.v.name}</small></h1><div class="tabs"><button data-a="tab:0" class="${this.gtab === 0 ? '' : 'sec'}">🔧 Ta'mir va tyuning</button><button data-a="tab:1" class="${this.gtab === 1 ? '' : 'sec'}">🚗 Transport saloni (${st.veh.own.length}/${VEHICLES.length})</button></div>`;
      if (this.gtab === 1) h += `<p class="sub">Pul yig'ib yangi transport oling. Sotib olingani sizda qoladi — istalgan ustaxonada yoki uyingizda almashtirasiz.</p><div class="cards">${VEHICLES.map((v) => this.vehCard(v, st.veh.own.includes(v.id), st.veh.cur === v.id, st.money >= v.price)).join('')}</div>`;
      else {
        const ok = hp >= 100 && !d.tires.some(Boolean);
        h += `<div class="grid2"><div><div class="card"><h4>Ta'mirlash</h4><p>Holat: <b style="color:${hp > 70 ? 'var(--good)' : hp > 40 ? 'var(--ac)' : 'var(--bad)'}">${hp}%</b> · dvigatel ${Math.round(d.engine)}% ${d.tires.some(Boolean) ? '· yorilgan balon bor' : ''}${d.wrecked ? ' · <b style="color:var(--bad)">motor ishlamayapti</b>' : ''}</p><button data-a="fix" ${ok ? 'disabled' : ''}>${ok ? 'Transport soz ✓' : `To'liq ta'mirlash — ${som(Math.min(cost, st.money))} so'm`}</button></div>
          <h4 style="margin:14px 0 0">Bo'yoq</h4><div class="paints" style="margin-bottom:26px">${PAINTS.filter((p) => p.cost >= 0 || st.paints.includes(p.id)).map((p) => `<div class="paint${st.paint === p.id ? ' sel' : ''}" data-a="paint:${p.id}" title="${p.name}" style="background:#${p.hex.toString(16).padStart(6, '0')}"><span>${st.paints.includes(p.id) ? '' : som(p.cost) + " so'm"}</span></div>`).join('')}</div></div>
          <div><h4 style="margin:0 0 6px">Tyuning <small style="font-weight:600;color:var(--mut)">(barcha transportlarga ta'sir qiladi)</small></h4>${UPG.map((u) => { const lv = st.up[u.id], mx = lv >= u.max, c = mx ? 0 : u.cost[lv]; return `<div class="card" style="margin-bottom:8px"><div class="meta"><h4>${u.name}</h4><span class="pips">${Array.from({ length: u.max }, (_, i) => `<i class="${i < lv ? 'on' : ''}"></i>`).join('')}</span></div><p>${u.desc}</p><button data-a="up:${u.id}" class="${mx ? 'sec' : ''}" ${mx || st.money < c ? 'disabled' : ''}>${mx ? 'Eng yuqori daraja' : `Yaxshilash — ${som(c)} so'm`}</button></div>`; }).join('')}</div></div>`;
      }
      w.innerHTML = h;
      this.on({ tab: (a) => { this.gtab = +a; render(); }, fix: () => { const hp2 = d.health, c2 = Math.round(((100 - hp2) * 9 + d.tires.reduce((a, b) => a + b, 0) * 60) * Math.max(0.4, Math.sqrt(g.car.mass / 1500))); g.addMoney(-Math.min(c2, st.money)); d.repair(100); g.audio.sfx('repair'); g.save(); render(); },
        paint: (id) => { const p = PAINTS.find((q) => q.id === id), own = st.paints.includes(id); if (!own) { if (st.money < p.cost) return g.toast('Pul yetarli emas', 'bad'); g.addMoney(-p.cost); st.paints.push(id); g.audio.sfx('buy'); } g.setPaint(id); g.save(); render(); },
        up: (id) => { const u = UPG.find((q) => q.id === id), c = u.cost[st.up[id]]; if (st.money < c) return; g.addMoney(-c); st.up[id]++; g.applyUpgrades(); g.audio.sfx('buy'); g.save(); render(); },
        buy: (id) => { if (g.buyVehicle(id)) { g.pickVehicle(id, spot); render(); } }, pick: (id) => { g.pickVehicle(id, spot); g.audio.sfx('buy'); render(); } });
    };
    render();
  }
  s_home(w, d, btn, x) {
    const g = this.g, st = g.state, L = g.live, hm = g.site.places.uy.home; x();
    if (g.visit && g.visit.on) return this.homeVisit(w, btn);
    const render = () => {
      const lv = st.home.lvl, cur = HOME_LEVELS[lv], nx = HOME_LEVELS[lv + 1], inc = L.income();
      w.innerHTML = `<h1>🏠 Mening uyim <small>${lv + 1}/5 · ${cur.name} · 💰 ${som(st.money)} so'm</small></h1>
        <div class="grid2"><div>
          <div class="card"><h4>${nx ? `Keyingi daraja: ${nx.name}` : 'Uyingiz eng yuqori darajada! 🏆'}</h4><p>${nx ? nx.desc : cur.desc}</p>${nx ? `<div class="meta"><span>Daromad: ${nx.inc} so'm/daq</span><span>💰 ${som(nx.cost)} so'm</span></div><button data-a="upg" ${st.money < nx.cost ? 'disabled' : ''}>${st.money < nx.cost ? `Yana ${som(nx.cost - st.money)} so'm kerak` : 'Uyni yaxshilash'}</button>` : ''}</div>
          <div class="card" style="margin-top:8px"><h4>Hosil va ijara daromadi</h4><p>${cur.inc ? `Har daqiqada ${cur.inc} so'm yig'iladi (1 soatgacha).` : "Chodirda daromad yo'q — kulba quring."}</p><button data-a="inc" ${inc > 0 ? '' : 'disabled'}>${inc > 0 ? `Olish: ${som(inc)} so'm` : "Hozircha yig'ilmadi"}</button></div>
          <div class="card" style="margin-top:8px"><h4>Uxlash va ovqatlanish</h4><p>Kuch ${Math.round(st.energy)}% · to'qlik ${Math.round(st.sat)}%</p><div class="row" style="flex-wrap:wrap">${[['Tong', 6.4, '🌅'], ['Kunduz', 12, '☀️'], ['Shom', 18.3, '🌇'], ['Tun', 22, '🌙']].map(([n, h, e]) => `<button class="sec" data-a="sleep:${h}">${e} ${n}</button>`).join('')}</div>
            <div class="row" style="flex-wrap:wrap;margin-top:6px">${['fruit', 'berry', 'veg', 'bread'].map((id) => `<button class="sec" data-a="eat:${id}" ${st.inv[id] > 0 ? '' : 'disabled'}>${ITEMS[id][1]} ${ITEMS[id][0]} (${st.inv[id]})</button>`).join('')}</div></div>
          <div class="row" style="margin-top:10px"><button data-a="shop">🛒 Bozor</button><button class="sec" data-a="bag">🎒 Sumka</button></div>
        </div><div>
          <h4 style="margin:0 0 6px">Garaj — transportni tanlang</h4><div class="vlist">${st.veh.own.map((id) => `<button class="${st.veh.cur === id ? '' : 'sec'}" data-a="veh:${id}">${VICON[id] || '🚗'} ${vehById[id].name}</button>`).join('')}</div>
          <p class="sub" style="margin:6px 0 12px">Yangi transportlar ustaxonadagi salonda sotiladi (${st.veh.own.length}/${VEHICLES.length}).</p>
          <h4 style="margin:0 0 6px">Hovli bezaklari</h4>${DECOR.map((q) => `<div class="card" style="margin-bottom:6px;flex-direction:row;align-items:center"><div class="grow"><h4>${q.name}</h4><p>${q.desc}</p></div><button data-a="dec:${q.id}" class="${st.home.decor[q.id] ? 'sec' : ''}" ${st.home.decor[q.id] || st.money < q.cost || lv < 1 ? 'disabled' : ''}>${st.home.decor[q.id] ? '✓ Bor' : lv < 1 ? 'Kulba kerak' : som(q.cost) + " so'm"}</button></div>`).join('')}
        </div></div>`;
      this.on({ upg: () => { if (L.upgradeHome()) render(); }, inc: () => { const n = L.collectIncome(); if (n) g.toast(`Daromad olindi: +${som(n)} so'm`, 'gold'); render(); }, sleep: (h) => { this.fade.style.opacity = 1; setTimeout(() => { L.sleep(+h); this.close(); this.fade.style.opacity = 0; }, 380); },
        eat: (id) => { L.eat(id); render(); }, shop: () => this.open('shop', { back: ['home'] }), bag: () => this.open('bag'), dec: (id) => { if (L.buyDecor(id)) render(); },
        veh: (id) => { g.pickVehicle(id, [hm.park[0], hm.park[1], hm.parkYaw]); g.audio.sfx('buy'); g.toast(`${vehById[id].name} uy oldida turibdi`, 'good'); render(); } });
    };
    render();
  }
  // onlayn xonada mehmon: xona egasining uyi — hissa qo'shish (egasi tasdiqlagach pulingizdan olinadi), bezak sovg'a qilish, dam olish
  homeVisit(w, btn) {
    const g = this.g, st = g.state, V = g.visit, L = g.live, h = st.home, lv = h.lvl, cur = HOME_LEVELS[lv], nx = HOME_LEVELS[lv + 1], fund = h.fund || 0, money = V.money(), need = nx ? Math.max(0, nx.cost - fund) : 0;
    const amt = nx ? [100, 500, 1000, 5000].filter((n) => n < need) : [];
    w.innerHTML = `<h1>🏠 ${esc(V.owner)}ning uyi <small>${lv + 1}/5 · ${cur.name} · sizda 💰 ${som(money)} so'm</small></h1>
      <p class="sub">Siz mehmonsiz: bu uyda yashaysiz va uni egasi bilan birga rivojlantirasiz. Qo'shgan pulingiz va sovg'alaringiz ${esc(V.owner)}ning saqlovida qoladi; o'z uyingiz o'zgarmaydi.</p>
      <div class="grid2"><div>
        <div class="card"><h4>${nx ? `Keyingi daraja: ${nx.name}` : 'Uy eng yuqori darajada! 🏆'}</h4><p>${nx ? nx.desc : cur.desc}</p>${nx ? `<div class="meta"><span>Jamg'arma: ${som(fund)} / ${som(nx.cost)} so'm</span></div>
          <div class="row" style="flex-wrap:wrap">${amt.map((n) => `<button class="sec" data-a="fund:${n}" ${money < n ? 'disabled' : ''}>+${som(n)}</button>`).join('')}<button data-a="fund:${need}" ${money < need || need < 1 ? 'disabled' : ''}>${money < need ? `Qolgani: ${som(need)} so'm` : `Qolganini to'lash: ${som(need)} so'm`}</button></div>` : ''}</div>
        <div class="card" style="margin-top:8px"><h4>Dam olish va ovqatlanish</h4><p>Kuch ${Math.round(st.energy)}% · to'qlik ${Math.round(st.sat)}% · kun vaqtini xona egasi boshqaradi</p><button class="sec" data-a="rest">😴 Dam olish</button>
          <div class="row" style="flex-wrap:wrap;margin-top:6px">${['fruit', 'berry', 'veg', 'bread'].map((id) => `<button class="sec" data-a="eat:${id}" ${st.inv[id] > 0 ? '' : 'disabled'}>${ITEMS[id][1]} ${ITEMS[id][0]} (${st.inv[id]})</button>`).join('')}</div></div>
        <div class="row" style="margin-top:10px"><button data-a="shop">🛒 Bozor</button><button class="sec" data-a="bag">🎒 Sumka</button></div>
      </div><div>
        <h4 style="margin:0 0 6px">Hovliga sovg'a</h4>${DECOR.map((q) => `<div class="card" style="margin-bottom:6px;flex-direction:row;align-items:center"><div class="grow"><h4>${q.name}</h4><p>${q.desc}</p></div><button data-a="dec:${q.id}" class="${h.decor[q.id] ? 'sec' : ''}" ${h.decor[q.id] || money < q.cost || lv < 1 ? 'disabled' : ''}>${h.decor[q.id] ? '✓ Bor' : lv < 1 ? 'Kulba kerak' : som(q.cost) + " so'm"}</button></div>`).join('')}
        <p class="sub" style="margin-top:8px">Polizga urug' ekish, sug'orish va hosil yig'ish, hovliga gul ekish — piyoda borib [E] / [G]. Tuxum va pochtani uy egasi oladi.</p>
      </div></div>`;
    this.on({ fund: (n) => V.contribute(+n), dec: (id) => V.decor(id), rest: () => { this.fade.style.opacity = 1; setTimeout(() => { L.sleep(12); this.close(); this.fade.style.opacity = 0; }, 380); },
      eat: (id) => { L.eat(id); this.open('home'); }, shop: () => this.open('shop', { back: ['home'] }), bag: () => this.open('bag') });
  }
  s_shop(w, d, btn, x) {
    const g = this.g, st = g.state, L = g.live; x();
    const render = () => {
      const sell = Object.keys(ITEMS).filter((id) => ITEMS[id][2] > 0 && st.inv[id] > 0), total = L.sellValue();
      w.innerHTML = `<h1>🛒 Bozor <small>💰 ${som(st.money)} so'm</small></h1><div class="grid2"><div><h4 style="margin:0 0 6px">Sotish</h4>
        ${sell.length ? sell.map((id) => `<div class="stat"><span>${ITEMS[id][1]} ${ITEMS[id][0]} × ${st.inv[id]}</span><b>${som(st.inv[id] * ITEMS[id][2])} so'm</b></div>`).join('') : '<p class="sub">Sotadigan narsa yo\'q. Qo\'ziqorin, chig\'anoq, baliq, meva, hosil yig\'ib keling.</p>'}
        <div class="row" style="margin-top:10px;flex-wrap:wrap"><button data-a="sell:1" ${total > 0 ? '' : 'disabled'}>Sotish (yegulikdan tashqari)</button><button class="sec" data-a="sell:0" ${total > 0 ? '' : 'disabled'}>Hammasini sotish — ${som(total)} so'm</button></div>
        <h4 style="margin:16px 0 6px">Bosh kiyimlar</h4><div class="row" style="flex-wrap:wrap">${HAT_LIST.map(([id, n, c]) => { const own = st.hats.includes(id); return `<button class="${st.hat === id ? '' : 'sec'}" data-a="hat:${id}" ${!own && st.money < c ? 'disabled' : ''}>${n}${own ? (st.hat === id ? ' ✓' : '') : ' — ' + som(c)}</button>`; }).join('')}</div></div>
        <div><h4 style="margin:0 0 6px">Xarid</h4>${SHOP.map(([id, n, c]) => `<div class="card" style="margin-bottom:6px;flex-direction:row;align-items:center"><div class="grow"><h4>${ITEMS[id][1]} ${n}</h4><p>Sizda: ${st.inv[id] || 0}</p></div><button data-a="buy:${id}" ${st.money < c ? 'disabled' : ''}>${c} so'm</button></div>`).join('')}
        <h4 style="margin:12px 0 6px">Asboblar</h4>${TOOLS.map(([id, n, c, ds]) => `<div class="card" style="margin-bottom:6px;flex-direction:row;align-items:center"><div class="grow"><h4>${n}</h4><p>${ds}</p></div><button data-a="tool:${id}" class="${st.tools[id] ? 'sec' : ''}" ${st.tools[id] || st.money < c ? 'disabled' : ''}>${st.tools[id] ? '✓ Bor' : c + " so'm"}</button></div>`).join('')}</div></div>`;
      if (d && d.back) { const b = btn('← Orqaga', () => this.open(d.back[0], d.back[1]), 'sec'); b.style.marginTop = '10px'; w.appendChild(b); }
      this.on({ sell: (k) => { const n = L.sellAll(k === '1'); if (n) g.toast(`Sotildi: +${som(n)} so'm`, 'gold'); g.save(); render(); },
        buy: (id) => { const it = SHOP.find((q) => q[0] === id); if (st.money < it[2]) return; g.addMoney(-it[2]); st.inv[id] = (st.inv[id] || 0) + it[3]; g.audio.sfx('buy'); render(); },
        tool: (id) => { const it = TOOLS.find((q) => q[0] === id); if (st.tools[id] || st.money < it[2]) return; g.addMoney(-it[2]); st.tools[id] = 1; g.audio.sfx('buy'); g.toast(`${it[1]} sotib olindi!`, 'good'); g.save(); render(); },
        hat: (id) => { const it = HAT_LIST.find((q) => q[0] === id); if (!st.hats.includes(id)) { if (st.money < it[2]) return; g.addMoney(-it[2]); st.hats.push(id); g.audio.sfx('buy'); } st.hat = st.hat === id ? null : id; g.player.setHat(st.hat); g.save(); render(); } });
    };
    render();
  }
  s_bag(w, d, btn, x) {
    const g = this.g, st = g.state, L = g.live; x();
    const render = () => {
      const have = Object.keys(ITEMS).filter((id) => st.inv[id] > 0), tl = Object.keys(st.tools).filter((k) => st.tools[k]);
      w.innerHTML = `<h1>🎒 Sumka <small>⚡ ${Math.round(st.energy)}% · 🍽 ${Math.round(st.sat)}% · ❤ ${Math.floor(st.karma)}</small></h1><div class="grid2"><div>
        <div class="invg">${have.length ? have.map((id) => `<div class="it" ${ITEMS[id][3] ? `data-a="eat:${id}" title="Yeyish"` : ''}><b>${ITEMS[id][1]}</b><span>${ITEMS[id][0]}</span><i>${st.inv[id]}</i>${ITEMS[id][3] ? '<u>yeyish</u>' : ''}</div>`).join('') : '<p class="sub">Sumka bo\'sh. Transportdan tushib [F], atrofdan narsa yig\'ing!</p>'}</div>
        <p class="sub" style="margin-top:10px">Asboblar: ${tl.length ? tl.map((k) => TOOLS.find((q) => q[0] === k)[1]).join(', ') : "yo'q (bozordan oling)"}</p>
        <div class="stat"><span>📒 Albom (topilmalar)</span><b>${Object.keys(st.seen).length}/${L.albumTotal}</b></div><div class="stat"><span>🌸 Ekilgan gullar</span><b>${st.cnt.plant || 0}</b></div><div class="stat"><span>🌳 Ekilgan daraxtlar</span><b>${st.trees.length}</b></div><div class="stat"><span>🚕 Eltilgan yo'lovchilar</span><b>${st.cnt.hitch || 0}</b></div><div class="stat"><span>🎁 Qilingan yaxshiliklar</span><b>${(st.cnt.gift || 0) + (st.cnt.feed || 0) + (st.cnt.stone || 0) + (st.cnt.litter || 0)}</b></div><div class="stat"><span>🚶 Piyoda yurilgan</span><b>${(st.stats.walk / 1000).toFixed(1)} km</b></div></div>
        <div><h4 style="margin:0 0 6px">Topshiriqlar <small style="color:var(--mut);font-weight:600">bajarilgani: ${st.cnt.tasks || 0}</small></h4>${st.tasks.map((t) => `<div class="card" style="margin-bottom:8px"><div class="meta"><h4>${L.taskText(t)}</h4><span>💰 ${t.rw}</span></div><div class="bar"><i style="width:${Math.min(100, Math.round(t.n / t.goal * 100))}%"></i></div><p>${Math.min(t.goal, Math.floor(t.n))} / ${t.goal}</p></div>`).join('')}
        <p class="sub">Topshiriq bajarilishi bilan mukofot beriladi va yangisi keladi — cheksiz.</p></div></div>`;
      this.on({ eat: (id) => { if (L.eat(id)) g.toast(`${ITEMS[id][1]} yedingiz`, 'good'); render(); } });
    };
    render();
  }
  s_wheel(w, d, btn, x) {
    const g = this.g, L = g.live; x();
    w.innerHTML = `<h1>Harakatlar <small>piyoda qahramon nima qila oladi</small></h1><div class="wheel">${L.actions().map(([id, ic, n, ds, ok]) => `<button class="${ok ? '' : 'sec'}" data-a="do:${id}" ${ok ? '' : 'disabled'}><b>${ic}</b><span>${n}</span><small>${ds}</small></button>`).join('')}</div>
      <p class="sub" style="margin-top:12px">Yana: <kbd>E</kbd> — daraxt silkitish, rezavor terish, gaplashish, baliq ovlash, qazish, hayvonlarni boqish va boshqalar (yaqinlashganda taklif chiqadi).</p>`;
    this.on({ do: (id) => { this.close(); L.doAction(id); } });
  }
  s_result(w, r, btn) {
    const g = this.g, a = r.def;
    w.style.textAlign = 'center';
    w.innerHTML = r.ok ? `<h1>${a.name}</h1><div class="res-stars">${'★'.repeat(r.stars)}<i>${'★'.repeat(3 - r.stars)}</i></div><p style="font-size:17px;font-weight:700">${r.info}</p><p style="font-size:22px;font-weight:900;color:var(--ac)">+${r.reward} so'm</p>${r.stars > r.prev && r.prev > 0 ? '<p class="sub">Yangi rekord!</p>' : ''}`
      : `<h1 style="color:var(--bad)">${WHY[r.why] || 'Bajarilmadi'}</h1><p class="sub" style="font-size:16px">${a.name}${r.info ? ' · ' + r.info : ''}</p>`;
    const row = el('div', 'row'); row.style.justifyContent = 'center'; row.style.marginTop = '12px'; w.appendChild(row);
    row.appendChild(btn('Davom etish', () => { this.close(); const sc = g.stampCount(); if (r.ok && a.cat === 'job' && g.stamps()[a.place] && !g.state['st_' + a.place]) { g.state['st_' + a.place] = 1; g.addMoney(500); this.banner('Pasportga muhr bosildi!', `${g.site.places[a.place].name} · +500 so'm · ${sc}/12`, 'gold'); g.audio.sfx('win'); g.save(); } if (r.ok && a.opt && a.opt.final && !g.state.paints.includes('oltin')) { g.state.paints.push('oltin'); g.setPaint('oltin'); this.banner('KATTA SAFAR yakunlandi!', "Tabriklaymiz! Oltin bo'yoq sizniki. Sayohat davom etadi…", 'gold'); } }));
    if (a.cat !== 'inf') row.appendChild(btn('Qayta urinish', () => { this.close(); g.retry(a); }, 'sec'));
  }
  s_progress(w, d, btn, x) {
    const g = this.g, st = g.state, A = g.acts.acts; x();
    const cat = (c) => { const l = A.filter((a) => a.cat === c); return [l.reduce((s, a) => s + (st.stars[a.id] || 0), 0), l.length * 3]; };
    const stamps = g.stamps(), np = Object.keys(g.site.places).length;
    w.innerHTML = `<h1>Sayohat pasporti <small>${g.level()}-daraja · ${g.levelName()}</small></h1><p class="sub">Har bir manzildagi 3 ta buyurtmani bajaring — muhr oling. 10 ta muhr «KATTA SAFAR» poygasini ochadi.</p>
      <div>${Object.keys(stamps).map((id) => `<div class="stamp ${stamps[id] ? 'on' : ''}"><b>${stamps[id] ? '✔' : st.places[id] ? '○' : '?'}</b>${st.places[id] ? g.site.places[id].name : 'Noma\'lum'}</div>`).join('')}</div>
      <div class="grid2" style="margin-top:14px"><div><h4 style="margin:6px 0">Chellenjlar</h4>${[['job', 'Buyurtmalar'], ['race', 'Poygalar'], ['zone', 'Drift va sindirish'], ['radar', 'Tezlik radarlari'], ['jump', 'Tramplinlar']].map(([c, n]) => { const [a, b] = cat(c); return `<div class="stat"><span>${n}</span><b>★ ${a}/${b}</b></div>`; }).join('')}
      <div class="stat"><span>Tangalar</span><b>${st.coins.length}/${g.coinTotal}</b></div><div class="stat"><span>Yashirin sandiqlar</span><b>${st.chests.length}/${g.chestTotal}</b></div><div class="stat"><span>Ochilgan manzillar</span><b>${Object.keys(st.places).filter((k) => g.site.places[k]).length}/${np}</b></div><div class="stat"><span>Transportlar</span><b>${st.veh.own.length}/${VEHICLES.length}</b></div></div>
      <div><h4 style="margin:6px 0">Statistika</h4><div class="stat"><span>Bosib o'tilgan yo'l</span><b>${(st.stats.dist / 1000).toFixed(1)} km</b></div><div class="stat"><span>Eng yuqori tezlik</span><b>${st.stats.top} km/soat</b></div><div class="stat"><span>Eng uzun sakrash</span><b>${st.stats.jump} m</b></div><div class="stat"><span>Drift ochkolari</span><b>${som(st.stats.drift)}</b></div><div class="stat"><span>Sindirilgan buyumlar</span><b>${st.stats.smashed}</b></div><div class="stat"><span>Avariyalar</span><b>${st.stats.crashes}</b></div><div class="stat"><span>Yaxshilik ochkosi</span><b>❤ ${Math.floor(st.karma)}</b></div><div class="stat"><span>O'yin vaqti</span><b>${Math.floor(st.stats.time / 3600)} soat ${Math.floor(st.stats.time / 60) % 60} daq</b></div></div></div>`;
  }
  s_map(w, d, btn, x) {
    const g = this.g, st = g.state, pl = g.player, me = pl.onFoot ? pl.p : g.car.p, myYaw = pl.onFoot ? pl.yaw : g.car.yaw; x();
    w.innerHTML = `<h1>Xarita <small>bosib GPS belgilang</small></h1>`;
    const grid = el('div'); grid.style.cssText = 'display:grid;grid-template-columns:minmax(0,1fr) 230px;gap:16px'; w.appendChild(grid);
    const cv = el('canvas'); cv.id = 'mapc'; cv.width = cv.height = 1200; grid.appendChild(cv);
    const side = el('div'); grid.appendChild(side);
    side.innerHTML = `<div class="legend"><div><i style="background:#ffc83a"></i>E'lonlar taxtasi</div><div><i style="background:#4fb0ff"></i>Ustaxona va salon</div><div><i style="background:#5fd38a"></i>Mening uyim</div><div><i style="background:#ff6a55"></i>Tezlik radari</div><div><i style="background:#b07cff"></i>Tramplin</div><div><i style="background:#ffe14a"></i>Yo'lovchi kutmoqda</div><div><i style="background:#ff8a3a"></i>Mening bayrog'im</div><div><i style="background:#35e0ff"></i>GPS marshruti</div></div><div id="mapinfo" style="margin-top:12px"></div>`;
    const info = side.querySelector('#mapinfo');
    const c = cv.getContext('2d'), S = 1200, k = S / T.SIZE, P = (v) => (v + T.HALF) * k;
    const draw = () => {
      c.drawImage(this.mapCanvas, 0, 0, S, S);
      const dot = (x, z, r, f, s2) => { c.beginPath(); c.arc(P(x), P(z), r, 0, 6.283); c.fillStyle = f; c.fill(); if (s2) { c.lineWidth = 2; c.strokeStyle = s2; c.stroke(); } };
      if (g.routePts) { c.beginPath(); g.routePts.forEach((q, i) => (i ? c.lineTo(P(q[0]), P(q[1])) : c.moveTo(P(q[0]), P(q[1])))); c.strokeStyle = '#35e0ff'; c.lineWidth = 4; c.stroke(); }
      for (const q of g.acts.acts) if (q.cat === 'radar' || q.cat === 'jump') dot(q.x, q.z, 4.5, q.cat === 'radar' ? '#ff6a55' : '#b07cff', (st.stars[q.id] || 0) >= 3 ? '#ffe14a' : '#fff');
      for (const p of g.points) dot(p.x, p.z, p.kind === 'home' ? 9 : 6.5, p.kind === 'board' ? '#ffc83a' : p.kind === 'home' ? '#5fd38a' : '#4fb0ff', p.kind === 'home' ? '#fff' : '#141824');
      for (const q of g.live.dots) if (!q[3]) dot(q[0], q[1], 5, q[2], '#141824');
      c.font = '800 15px system-ui'; c.textAlign = 'center';
      // nomlar bir-birining ustiga tushmasin: band bo'lsa nuqta ostiga yoki yon tomonga suriladi
      const boxes = [];
      for (const id in g.site.places) { const p = g.site.places[id]; const nm = st.places[id] || id === 'uy' ? p.name : '?'; const tw = c.measureText(nm).width + 6, px = P(p.x), pz = P(p.z);
        let ly = pz - 13, lx = px; for (const [ox, oy] of [[0, -13], [0, 27], [tw / 2 + 12, 5], [-tw / 2 - 12, 5], [0, -31], [0, 45]]) { const bx = px + ox, by = pz + oy; if (!boxes.some((b) => Math.abs(b[0] - bx) < (b[2] + tw) / 2 && Math.abs(b[1] - by) < 17)) { lx = bx; ly = by; break; } }
        boxes.push([lx, ly, tw]); c.lineWidth = 4; c.strokeStyle = 'rgba(10,14,24,.85)'; c.strokeText(nm, lx, ly); c.fillStyle = st.places[id] ? '#fff' : '#ffd0a0'; c.fillText(nm, lx, ly); }
      if (g.way) dot(g.way.x, g.way.z, 8, '#35e0ff', '#141824');
      if (pl.onFoot) dot(g.car.p[0], g.car.p[2], 6, '#d8392b', '#fff');
      if (g.netDots) for (const d of g.netDots) { dot(d[0], d[1], 9, d[2], '#141824'); c.lineWidth = 4; c.strokeStyle = 'rgba(10,14,24,.85)'; c.strokeText(d[3], P(d[0]), P(d[1]) - 14); c.fillStyle = d[2]; c.fillText(d[3], P(d[0]), P(d[1]) - 14); }
      c.save(); c.translate(P(me[0]), P(me[2])); c.rotate(Math.PI - myYaw); c.beginPath(); c.moveTo(0, -13); c.lineTo(9, 10); c.lineTo(0, 5); c.lineTo(-9, 10); c.closePath(); c.fillStyle = '#fff'; c.fill(); c.lineWidth = 3; c.strokeStyle = '#d8392b'; c.stroke(); c.restore();
    };
    draw();
    const travel = (fn) => { this.fade.style.opacity = 1; setTimeout(() => { fn(); this.close(); this.fade.style.opacity = 0; }, 380); };
    const showInfo = (pl2, wx, wz) => {
      info.innerHTML = '';
      if (pl2) { const acts = g.acts.byPlace[pl2.id] || []; const got = acts.reduce((s, a) => s + (st.stars[a.id] || 0), 0); const known = st.places[pl2.id] || pl2.id === 'uy'; info.innerHTML = `<h4 style="margin:0 0 4px">${known ? pl2.name : "Noma'lum manzil"}</h4><p class="sub">${pl2.id === 'uy' ? 'Sizning uyingiz' : `${acts.length} chellenj · ★ ${got}/${acts.length * 3}`}<br>Masofa: ${fmtDist(Math.hypot(pl2.x - me[0], pl2.z - me[2]))}</p>`;
        if (pl2.id === 'uy' && !g.act) { const b = btn('Uyga qaytish — bepul', () => travel(() => g.goHome()), ''); b.style.marginTop = '6px'; info.appendChild(b); }
        else if (st.places[pl2.id] && pl2.board && !g.act) { const b = btn(`Tez sayohat — 120 so'm`, () => { if (st.money < 120) { g.toast('Pul yetarli emas', 'bad'); return; } g.addMoney(-120); travel(() => { g.car.place(pl2.board.x + 6, pl2.board.z + 6, 0); g.respawn(); if (pl.onFoot) g.live.mount(false); }); }, 'sec'); b.style.marginTop = '6px'; info.appendChild(b); } }
      else info.innerHTML = `<p class="sub">GPS belgilandi.<br>Masofa: ${fmtDist(Math.hypot(wx - me[0], wz - me[2]))}</p>`;
      const cl = btn('GPS ni tozalash', () => { g.setWaypoint(null); draw(); info.innerHTML = ''; }, 'sec'); cl.style.marginTop = '6px'; info.appendChild(cl);
    };
    cv.onclick = (e) => {
      const r = cv.getBoundingClientRect(); const wx = (e.clientX - r.left) / r.width * T.SIZE - T.HALF, wz = (e.clientY - r.top) / r.height * T.SIZE - T.HALF;
      let pl2 = null, bd = 130; for (const id in g.site.places) { const p = g.site.places[id]; const dd = Math.hypot(p.x - wx, p.z - wz); if (dd < bd) { bd = dd; pl2 = p; } }
      if ((g.act && g.act.tgt && g.way && g.way.auto) || g.live.fare) { showInfo(pl2, wx, wz); return; }
      if (pl2) g.setWaypoint(pl2.board ? pl2.board.x : pl2.x, pl2.board ? pl2.board.z : pl2.z); else g.setWaypoint(wx, wz);
      g.audio.sfx('click'); const rt = T.route(me[0], me[2], g.way.x, g.way.z); g.routePts = rt ? rt.pts : null; draw(); showInfo(pl2, wx, wz);
    };
  }
  result(r) { this.open('result', r); }
}
