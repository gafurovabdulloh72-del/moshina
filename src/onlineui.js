// Onlayn oynalar (o'zbek tilida): hisob (Telegram), bulutli saqlov tanlovi, xona (birga o'ynash), reyting, birga poyga natijalari. UI sinfiga s_* usullari qo'shiladi
import { UI } from './ui.js';
import { fmtTime } from './game.js';
import { MAX_PLAYERS, SLOT_COLORS } from './coop.js';
import { JOBS } from './ish.js';
import { topKind } from './net.js';

const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const som = (n) => Math.round(n).toLocaleString('ru-RU');
const hm = (s) => { s = Math.round(s || 0); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60); return h ? `${h} soat ${m} daq` : `${m} daq`; };
export const SITE = 'https://cargame-self.vercel.app';

// UI ga qo'shimchalar: HUD'dagi onlayn belgisi, tugmalar ([O] onlayn, [U] chat) controls.js da
export function initOnlineUI(game) {
  const ui = game.ui, C = game.coop, net = game.net;
  const chip = el('div', 'chip netchip'); chip.style.display = 'none'; ui.hud.querySelector('.tl').appendChild(chip);
  const VC = C.voice;
  const upd = () => { const r = C.room; chip.style.display = r ? '' : 'none'; if (r) chip.innerHTML = `🌐 <b>${esc(r.code)}</b> <small>${C.members.size + 1}/${MAX_PLAYERS}</small>${VC.on ? `<span class="vmic${VC.micLive() ? '' : ' off'}" data-vpid="me">${VC.micLive() ? '🎙' : '🔇'}</span>` : ''}`; };
  C.onChange(upd); upd();
  // gapirayotgan belgisi (HUD belgisi va xona ro'yxatida): faqat class almashadi, 7 marta/s
  let vlast = 0; setInterval(() => {
    if (!C.room || !VC.on) { if (vlast) { vlast = 0; for (const e of document.querySelectorAll('.vmic.talk')) e.classList.remove('talk'); } return; } vlast = 1; upd.mic !== VC.micLive() && ((upd.mic = VC.micLive()), upd());
    for (const e of document.querySelectorAll('[data-vpid]')) { const id = e.dataset.vpid, m = id === 'me' ? null : C.members.get(id); e.classList.toggle('talk', id === 'me' ? VC.talk : !!(m && m.vtalk && !m.vmute)); }
  }, 140);
  // ochiq onlayn oynani yangilash (hisob yoki xona holati o'zgarganda)
  const refresh = () => { if (ui._onl && ui.screenName === 'online') ui._onl(); else if (ui.screenName === 'cloud' && net.cloud !== 'choice') ui.close(); };
  net.onChange(refresh); C.onChange(refresh);
  // taklif havolasi bilan ochilgan: config kelgach onlayn oynasi ochiladi va kod tayyor turadi
  if (C.inviteCode) { const off = net.onChange(() => { if (net.status === 'wait') return; off(); if (game.ui && (game.mode === 'menu' || game.mode === 'play')) ui.open('online', { back: game.mode === 'menu' ? 'menu' : null, auto: net.status === 'ok' }); }); }
}

const P = UI.prototype;
P.s_online = function (w, d, btn, x) {
  const g = this.g, net = g.net, C = g.coop, VC = C.voice; d = d || {};
  if (d.back !== 'menu') x();
  w.innerHTML = `<h1>Onlayn <small>do'stlar bilan birga</small></h1><p class="sub">Telegram orqali kiring — yutuqlaringiz bulutda saqlanadi. Xona oching va do'stlaringizni kod yoki havola bilan chaqiring (2–4 kishi): birga sayohat, birga poyga, chat.<br>Do'stingiz havolasi orqali kirsangiz — uning uyida yashaysiz va uni birga rivojlantirasiz.</p>`;
  const grid = el('div', 'onl'); w.appendChild(grid);
  const acct = el('div', 'card onl-acct'), room = el('div', 'card onl-room'); grid.appendChild(acct); grid.appendChild(room);
  const foot = el('div', 'row'); foot.style.marginTop = '14px'; w.appendChild(foot);
  foot.appendChild(btn('🏆 Reyting', () => this.open('top', { back: ['online', d] }), 'sec'));
  if (d.back !== 'menu') foot.appendChild(btn('📅 Hafta reytingi', () => this.open('hafta'), 'sec'));
  if (d.back === 'menu') foot.appendChild(btn('Orqaga', () => this.open('menu'), 'sec')); else foot.appendChild(btn('Yopish', () => this.close(), 'sec'));
  let codeVal = C.inviteCode || '';
  const renderAcct = () => {
    acct.innerHTML = '<h4>👤 Hisob</h4>';
    if (net.status === 'wait') { acct.appendChild(el('p', '', 'Onlayn serverga ulanilmoqda…')); return; }
    if (net.status !== 'ok') {
      acct.appendChild(el('p', '', esc(net.why)));
      if (net.status === 'file') acct.appendChild(el('p', 'onl-site', `Sayt: <b>${SITE.replace('https://', '')}</b>`));
      else acct.appendChild(btn('Qayta urinish', () => net.retry(), 'sec'));
      return;
    }
    if (net.user) {
      const u = net.user, row = el('div', 'onl-user');
      row.innerHTML = `${u.photo ? `<img src="${esc(u.photo)}" alt="" referrerpolicy="no-referrer">` : `<i>${esc((u.name || '?')[0])}</i>`}<div><b>${esc(u.name)}</b>${u.username ? `<small>@${esc(u.username)}</small>` : ''}<small>Telegram orqali kirgan</small></div>`;
      acct.appendChild(row);
      const cl = { ok: '☁️ ', sync: '⏳ ', err: '⚠️ ', choice: '❓ ', off: '' }[net.cloud] || '';
      acct.appendChild(el('p', 'onl-cloud', net.cfg.save ? cl + esc(net.cloudMsg || 'Bulutli saqlov yoqilgan') : "Bulutli saqlov hali ulanmagan — o'yin shu qurilmada saqlanadi"));
      const r = el('div', 'row'); r.style.flexWrap = 'wrap';
      if (net.cfg.save && net.cloud === 'ok') r.appendChild(btn('Bulutga hozir saqlash', () => { g.save(); net.upload(true).then(() => g.toast('Bulutga saqlandi', 'good')); }, 'sec'));
      if (net.cloud === 'choice') r.appendChild(btn('Saqlovni tanlash', () => this.open('cloud', { back: d.back })));
      if (net.cloud === 'err') r.appendChild(btn('Qayta urinish', () => net.syncSave(), 'sec'));
      r.appendChild(btn('Chiqish', () => net.logout(), 'sec')); acct.appendChild(r);
      return;
    }
    if (!net.cfg.login) { acct.appendChild(el('p', '', "Telegram orqali kirish hali sozlanmagan (sayt egasi botni ulashi kerak). Do'stlar bilan mehmon sifatida o'ynash mumkin.")); return; }
    acct.appendChild(el('p', '', "Telegram orqali kiring: hozirgi o'yiningiz <b>yo'qolmaydi</b> — u hisobingizga biriktiriladi va boshqa qurilmada ham davom etadi."));
    const box = el('div', 'onl-tg'); acct.appendChild(box); net.widget(box);
    acct.appendChild(el('p', 'onl-note', 'Tugma chiqmasa — sahifani yangilang yoki Telegram ilovasida tasdiqlang.'));
  };
  const renderRoom = () => {
    room.innerHTML = '<h4>🌐 Birga o\'ynash</h4>';
    if (net.status !== 'ok') { room.appendChild(el('p', '', net.status === 'wait' ? 'Kutilmoqda…' : "Onlayn rejim hozir mavjud emas. Bitta o'yinchi rejimi to'liq ishlaydi.")); return; }
    if (!C.room) {
      room.appendChild(el('p', '', `Ismingiz: <b>${esc(C.myName())}</b>${net.user ? '' : ' <small>(Telegram orqali kirsangiz — haqiqiy ismingiz)</small>'}`));
      if (C.status === 'connecting' || C.status === 'error') room.appendChild(el('p', C.status === 'error' ? 'onl-err' : 'onl-wait', esc(C.msg)));
      const busy = C.status === 'connecting';
      const mk = btn("＋ Xona ochish", () => C.create().then((ok) => ok && C.enterPlay())); mk.disabled = busy; room.appendChild(mk);
      const jr = el('form', 'row onl-join'); jr.innerHTML = `<input class="onl-code" maxlength="40" placeholder="Xona kodi, masalan K7MP2Q" value="${esc(codeVal)}" autocomplete="off"><button type="submit">Qo'shilish</button>`; room.appendChild(jr);
      const inp = jr.querySelector('input'); inp.oninput = () => { codeVal = inp.value; }; inp.addEventListener('keydown', (e) => e.stopPropagation());
      jr.querySelector('button').disabled = busy;
      jr.onsubmit = (e) => { e.preventDefault(); g.audio.sfx('click'); C.join(inp.value); };
      room.appendChild(el('p', 'onl-note', `Ko'pi bilan ${MAX_PLAYERS} kishi. Ulanish to'g'ridan-to'g'ri (WebRTC) — ba'zi ish/maktab tarmoqlarida ishlamasligi mumkin.`));
      if (d.auto && codeVal && !busy && C.status === 'idle') { d.auto = false; setTimeout(() => C.join(codeVal), 50); }
      return;
    }
    const R = C.room;
    const top = el('div', 'onl-code-big'); top.innerHTML = `<span>Xona kodi</span><b>${esc(R.code)}</b>`; room.appendChild(top);
    const sh = el('div', 'row'); sh.style.flexWrap = 'wrap'; room.appendChild(sh);
    sh.appendChild(btn('🔗 Havolani nusxalash', () => { const link = C.inviteLink(); const done = () => g.toast('Taklif havolasi nusxalandi — do\'stingizga yuboring', 'good'); if (navigator.clipboard) navigator.clipboard.writeText(link).then(done, () => prompt('Havola:', link)); else prompt('Havola:', link); }, 'sec'));
    sh.appendChild(btn('✈️ Telegram\'da yuborish', () => window.open('https://t.me/share/url?url=' + encodeURIComponent(C.inviteLink()) + '&text=' + encodeURIComponent(`SAFAR'da birga o'ynaymiz! Xona kodi: ${R.code}`), '_blank', 'noopener'), 'sec'));
    const list = el('div', 'onl-players'); room.appendChild(list);
    for (const p of C.roster()) {
      const me = p.pid === C.myId(), host = p.pid === R.hostPid, m = C.members.get(p.pid), row = el('div', 'onl-pl');
      const von = me ? VC.on : !!(m && m.vr && VC.on), vic = von ? `<span class="vmic${(me ? !VC.micLive() : m.vmute) ? ' off' : ''}" data-vpid="${me ? 'me' : esc(p.pid)}" title="Ovozli chatda">${(me ? !VC.micLive() : m.vmute) ? '🔇' : '🎙'}</span>` : m && m.vr ? '<small title="Ovozli chatda — eshitish uchun siz ham yoqing">🎙</small>' : '';
      row.innerHTML = `<i style="background:${SLOT_COLORS[p.slot % 4]}"></i><b>${esc(p.name)}</b>${vic}${me ? '<small>(siz)</small>' : ''}${host ? '<small title="Xona egasi">👑</small>' : ''}<span class="grow"></span>${m && m.ping ? `<small>${m.ping} ms</small>` : ''}`;
      if (!me && m && von) { const b = btn(m.vmute ? '🔈 Eshitish' : '🔇 Ovozsiz', () => VC.muteFriend(p.pid), 'sec'); b.title = m.vmute ? "Do'stingiz ovozini qayta yoqish" : "Faqat siz uchun do'stingiz ovozini o'chirish"; row.appendChild(b); }
      if (!me && m) { const b = btn('Yoniga borish', () => { if (C.teleportTo(p.pid)) this.close(); }, 'sec'); b.disabled = !m.remote.shown; row.appendChild(b); }
      if (!me && m) { const b = btn('💸', () => this.open('pulot', { pid: p.pid, back: d }), 'sec'); b.title = "Do'stga pul o'tkazish"; row.appendChild(b); }
      list.appendChild(row);
    }
    if (!C.members.size) list.appendChild(el('p', 'onl-note', "Hozircha yolg'izsiz. Kodni yoki havolani do'stingizga yuboring."));
    else list.appendChild(el('p', 'onl-note', g.visit && g.visit.on ? `🏠 Siz ${esc(g.visit.owner)}ning uyida yashayapsiz — uy belgisida [E] bilan uni birga rivojlantiring` : "🏠 Do'stlaringiz sizning uyingizda yashaydi va uni siz bilan birga rivojlantiradi"));
    // birga: yo'lovchi, birga ish, belgi
    if (C.members.size) room.appendChild(birgaCard(this, g, d, btn));
    // ovozli chat
    const vc = el('div', 'onl-voice'); room.appendChild(vc); vc.innerHTML = '<b>🎙 Ovozli chat</b>';
    if (!VC.on) {
      const why = VC.canUse(), vb = btn(VC.busy ? 'Mikrofon so\'ralmoqda…' : '🎙 Ovozli chatni yoqish', () => VC.start(), 'sec'); vb.disabled = VC.busy || !!why; vc.appendChild(vb);
      vc.appendChild(el('p', VC.err || why ? 'onl-err' : 'onl-note', esc(VC.err || why || "Mikrofon faqat shu tugmani bosganingizda so'raladi. Ovozli chatni yoqqan do'stlar bir-birini eshitadi; uzoqdagi do'st ovozi pastroq.")));
    } else {
      const r1 = el('div', 'row'); r1.style.flexWrap = 'wrap'; vc.appendChild(r1);
      if (!VC.ptt) r1.appendChild(btn(VC.mute ? '🔇 Mikrofon o\'chiq (5)' : '🎙 Mikrofon yoniq (5)', () => VC.setMute(!VC.mute), VC.mute ? 'bad' : 'sec'));
      r1.appendChild(btn("Ovozli chatni o'chirish", () => VC.stop(), 'sec'));
      const ck = (txt, val, set, tip) => { const l = el('label', 'onl-ck', `<input type="checkbox"${val ? ' checked' : ''}> ${txt}`); l.title = tip; l.querySelector('input').onchange = (e) => set(e.target.checked); vc.appendChild(l); };
      ck('Bosib gapirish — [5] ni bosib turing', VC.ptt, VC.setPtt, "Yoqilsa mikrofon faqat [5] tugmasi bosib turilganda ochiq bo'ladi");
      ck('Hamma eshitsin (masofasiz)', VC.all, VC.setAll, "O'chiq bo'lsa do'st ovozi masofaga qarab pasayadi: 15 m gacha to'liq, 150 m dan uzoqda 25%");
    }
    const rc = el('div', 'onl-race'); room.appendChild(rc);
    if (R.isHost) {
      rc.innerHTML = `<b>🏁 Birga poyga</b><div class="row"><select class="onl-sel">${C.races().map((a) => `<option value="${a.id}">${esc(a.name)}</option>`).join('')}</select></div>`;
      const go = btn('Poygani boshlash', () => { const id = rc.querySelector('select').value; if (C.startRace(id)) this.close(); }); go.disabled = !C.members.size; rc.querySelector('.row').appendChild(go);
      if (!C.members.size) rc.appendChild(el('p', 'onl-note', "Poyga uchun kamida bitta do'st kerak"));
    } else rc.innerHTML = `<b>🏁 Birga poyga</b><p class="onl-note">Poygani xona egasi (👑) tanlaydi — hamma bir vaqtda start chizig'iga ko'chadi.</p>`;
    const br = el('div', 'row'); br.style.marginTop = '10px'; br.style.flexWrap = 'wrap'; room.appendChild(br);
    br.appendChild(btn('💬 Chat (U)', () => { this.close(); C.openChat(); }, 'sec'));
    br.appendChild(btn('Xonadan chiqish', () => C.leave(), 'bad'));
  };
  this._onl = () => { renderAcct(); renderRoom(); };
  this._onl();
};

P.s_cloud = function (w, d, btn) {
  const g = this.g, net = g.net, p = net.pending;
  if (!p) { w.innerHTML = '<h1>Bulutli saqlov</h1><p class="sub">Tanlash kerak emas.</p>'; w.appendChild(btn('Yopish', () => (d && d.back === 'menu' ? this.open('menu') : this.close()))); return; }
  w.innerHTML = `<h1>Qaysi o'yinni davom ettiramiz?</h1><p class="sub">Hisobingizda (bulutda) boshqa saqlov bor, bu qurilmada ham o'yin bor. Birini tanlang — ikkinchisi almashtiriladi.</p>`;
  const cards = el('div', 'cards'); w.appendChild(cards);
  const card = (title, s, act, label, cls) => { const c = el('div', 'card'); c.innerHTML = `<h4>${title}</h4><div class="stat"><span>💰 Pul</span><b>${som(s.money)} so'm</b></div><div class="stat"><span>★ Yulduzlar</span><b>${s.stars}</b></div><div class="stat"><span>Daraja</span><b>${s.level}</b></div><div class="stat"><span>O'ynalgan vaqt</span><b>${hm(s.time)}</b></div>${s.t > 1e12 ? `<div class="stat"><span>Saqlangan</span><b>${new Date(s.t).toLocaleString('ru-RU')}</b></div>` : ''}`; c.appendChild(btn(label, act, cls)); cards.appendChild(c); };
  card('☁️ Bulutdagi (hisobdagi)', p.cloud, () => net.choose('cloud'), 'Bulutdagini olish');
  card('💻 Shu qurilmadagi', p.local, () => { net.choose('local'); d && d.back === 'menu' ? this.open('menu') : this.close(); }, 'Shu qurilmadagini saqlash', 'sec');
};

P.s_top = function (w, d, btn, x) {
  const g = this.g, net = g.net; x();
  w.innerHTML = '<h1>Reyting <small>eng yaxshi 20 sayyoh</small></h1>';
  const back = d && d.back;
  if (net.status !== 'ok' || !net.cfg.top) { w.appendChild(el('p', 'sub', net.status !== 'ok' ? esc(net.why || 'Onlayn server bilan aloqa yo\'q') : 'Reyting hali ulanmagan (sayt egasi bulut bazasini ulashi kerak).')); if (back) w.appendChild(btn('Orqaga', () => this.open(...back), 'sec')); return; }
  const acts = g.acts.acts.filter((a) => topKind(a.id));
  const opts = [['stars', '★ Yulduzlar'], ['level', 'Daraja (tajriba)']].concat(acts.map((a) => [a.id, (a.cat === 'race' ? '🏁 ' : a.cat === 'zone' ? '🎯 ' : a.cat === 'radar' ? '📸 ' : '🛫 ') + a.name]));
  const bar = el('div', 'row'); bar.innerHTML = `<select class="onl-sel">${opts.map(([v, t]) => `<option value="${v}">${esc(t)}</option>`).join('')}</select>`; w.appendChild(bar);
  const sel = bar.querySelector('select'); sel.value = this._topSel || 'stars';
  const body = el('div', 'onl-top'); w.appendChild(body);
  if (!net.user) w.appendChild(el('p', 'onl-note', "Natijangiz reytingga tushishi uchun Telegram orqali kiring (Onlayn oynasi)."));
  if (back) { const r = el('div', 'row'); r.style.marginTop = '12px'; r.appendChild(btn('Orqaga', () => this.open(...back), 'sec')); w.appendChild(r); }
  const fmt = (kind, v) => (kind === 'race' ? fmtTime(v) : kind === 'radar' ? `${v} km/soat` : kind === 'jump' ? `${v} m` : kind === 'level' ? `${v}-daraja` : kind === 'stars' ? `★ ${v}` : `${som(v)} ochko`);
  const load = () => {
    const id = (this._topSel = sel.value); body.innerHTML = '<p class="sub">Yuklanmoqda…</p>';
    net.top(id).then((r) => {
      if (sel.value !== id) return; const kind = r.kind;
      if (!r.rows.length) { body.innerHTML = '<p class="sub">Hali hech kim natija qayd etmagan — birinchi bo\'ling!</p>'; return; }
      body.innerHTML = `<table><tr><th>#</th><th>Sayyoh</th><th>Natija</th></tr>${r.rows.map((x) => `<tr class="${x.me ? 'me' : ''}"><td>${x.rank <= 3 ? ['🥇', '🥈', '🥉'][x.rank - 1] : x.rank}</td><td>${esc(x.name)}</td><td>${esc(fmt(kind, x.value))}</td></tr>`).join('')}</table>${r.me && r.me.rank > 20 ? `<p class="onl-note">Sizning o'rningiz: ${r.me.rank} (${esc(fmt(kind, r.me.value))})</p>` : ''}`;
    }).catch((e) => { body.innerHTML = `<p class="onl-err">Yuklab bo'lmadi: ${esc(e.message)}</p>`; });
  };
  sel.onchange = load; load();
};

P.s_coopres = function (w, r, btn, x) {
  x(); w.innerHTML = `<h1>🏁 ${esc(r.name)} <small>birga poyga natijasi</small></h1>`;
  const t = el('div', 'onl-top'); w.appendChild(t);
  t.innerHTML = `<table><tr><th>O'rin</th><th>Sayyoh</th><th>Vaqt</th></tr>${r.rows.map((x, i) => `<tr><td>${x.time != null ? ['🥇', '🥈', '🥉', '4'][i] || i + 1 : '—'}</td><td>${esc(x.name)}</td><td>${x.time != null ? fmtTime(x.time) : x.left ? 'chiqib ketdi' : 'marraga yetmadi'}</td></tr>`).join('')}</table>`;
  const row = el('div', 'row'); row.style.marginTop = '14px'; w.appendChild(row);
  row.appendChild(btn('Yopish', () => this.close())); if (this.g.coop.room && this.g.coop.room.isHost) row.appendChild(btn('Yana poyga', () => this.open('online'), 'sec'));
};

// Xona oynasidagi "Birga" bo'limi: yo'lovchi holati, birga ish (chaqirish / qo'shilish / chiqish), "Shu yerga kel" belgilari
function birgaCard(ui, g, d, btn) {
  const C = g.coop, IS = g.ish, box = el('div', 'onl-birga'); box.style.marginTop = '10px'; box.innerHTML = "<b>🤝 Birga</b>";
  const line = (html, ...bs) => { const r = el('div', 'row'); r.style.flexWrap = 'wrap'; r.style.alignItems = 'center'; r.style.marginTop = '6px'; r.appendChild(el('span', 'grow', html)); for (const b of bs) r.appendChild(b); box.appendChild(r); };
  if (C.ride) { const m = C.members.get(C.ride.pid); line(`🚗 ${esc(m ? m.name : '')}ning mashinasidasiz`, btn('Tushish (F)', () => C.rideOff(), 'sec')); }
  else if (C.pax.size) line(`🚗 Mashinangizda: ${[...C.pax.keys()].map((p) => esc((C.members.get(p) || {}).name || '')).join(', ')}`);
  else line("🚗 Do'st mashinasiga yo'lovchi bo'lib o'tirish — mashinasi yonida [E]");
  const cur = IS && IS.cur, J = C.job;
  if (J && !J.own) line(`${JOBS[J.id][0]} ${esc(J.oname)}ning «${JOBS[J.id][1]}» ishidasiz · ulushingiz ${som(J.got)} so'm`, btn('Ishdan chiqish', () => { C.jobLeave(); ui.open('online', d); }, 'sec'));
  else if (cur) { const team = J && J.own ? [...J.team.values()] : []; line(`${JOBS[cur.id][0]} «${JOBS[cur.id][1]}»${team.length ? ` — jamoa: ${team.map(esc).join(', ')} (daromad teng bo'linadi)` : ''}`, btn("👥 Do'stlarni chaqirish", () => C.jobInvite(), 'sec')); }
  else if (C.jobInv && performance.now() - C.jobInv.t < 120000 && C.members.get(C.jobInv.pid)) { const m = C.members.get(C.jobInv.pid); line(`🤝 ${esc(m.name)} sizni «${JOBS[C.jobInv.id][1]}» ishiga chaqiryapti`, btn("Qo'shilish", () => { if (C.jobJoin(m.pid)) ui.close(); })); }
  else line("💼 Ish boshlang (non, taksi, dala) va do'stlarni chaqiring — daromad teng bo'linadi");
  line('📍 Do\'stlarga xaritada belgi', btn('Shu yerga kel (8)', () => { if (C.ping()) ui.close(); }, 'sec'));
  for (const p of C.pingList()) line(`<i style="display:inline-block;width:10px;height:10px;border-radius:5px;background:${SLOT_COLORS[p.slot % 4]}"></i> ${esc(p.name)}: «Shu yerga kel» · ${p.ago} s oldin`, ...(p.me ? [] : [btn("Yo'l ko'rsat", () => { if (C.goPing(p.pid)) ui.close(); }, 'sec')]));
  return box;
}

// Do'stga pul o'tkazish: summa → tasdiqlash. Pul darhol olinadi; do'st qabul qilmasa yoki javob bermasa — qaytadi. Ikkala bankda yoziladi
P.s_pulot = function (w, d, btn, x) {
  x(); const g = this.g, C = g.coop, m = C.members.get(d.pid), money = g.visit && g.visit.on ? g.visit.money() : g.state.money;
  const back = () => this.open('online', d.back || {});
  if (!m) { w.innerHTML = "<h1>Pul o'tkazish</h1><p class=\"sub\">Do'stingiz xonada emas.</p>"; w.appendChild(btn('Orqaga', back, 'sec')); return; }
  if (d.n) {
    w.innerHTML = `<h1>💸 Tasdiqlang</h1><p class="sub"><b>${esc(m.name)}</b>ga <b>${som(d.n)} so'm</b> o'tkazilsinmi? Sizda: ${som(money)} so'm. Ikkala bankda yoziladi.</p>`;
    const r = el('div', 'row'); r.style.marginTop = '12px'; w.appendChild(r);
    r.appendChild(btn("Ha, o'tkazish", () => { if (C.sendMoney(m.pid, d.n)) back(); }));
    r.appendChild(btn('Bekor qilish', () => this.open('pulot', { pid: d.pid, back: d.back }), 'sec')); return;
  }
  w.innerHTML = `<h1>💸 Do'stga pul o'tkazish <small>${esc(m.name)} · sizda 💰 ${som(money)} so'm</small></h1><p class="sub">Bitta o'tkazma — 50 000 so'mgacha. Pul do'stingiz banki tarixida ham ko'rinadi.</p>`;
  const r = el('div', 'row'); r.style.flexWrap = 'wrap'; r.style.marginTop = '10px'; w.appendChild(r);
  for (const n of [100, 500, 1000, 5000, 10000]) { const b = btn(`${som(n)} so'm`, () => this.open('pulot', { pid: d.pid, back: d.back, n }), 'sec'); b.disabled = money < n; r.appendChild(b); }
  const f = el('form', 'row onl-join'); f.style.marginTop = '10px'; f.innerHTML = `<input class="onl-code" type="number" min="1" max="50000" placeholder="Boshqa summa" autocomplete="off"><button type="submit">Davom etish</button>`; w.appendChild(f);
  const inp = f.querySelector('input'); inp.addEventListener('keydown', (e) => e.stopPropagation());
  f.onsubmit = (e) => { e.preventDefault(); const n = Math.floor(+inp.value); if (!(n >= 1 && n <= 50000)) return g.toast("1 dan 50 000 so'mgacha", 'bad'); if (n > money) return g.toast('Pul yetmaydi', 'bad'); this.open('pulot', { pid: d.pid, back: d.back, n }); };
  const r2 = el('div', 'row'); r2.style.marginTop = '12px'; w.appendChild(r2); r2.appendChild(btn('Orqaga', back, 'sec'));
};
