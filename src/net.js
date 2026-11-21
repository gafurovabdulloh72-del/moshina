// Onlayn xizmatlar (faqat sayt orqali ochilganda): sozlamalar, Telegram orqali kirish, bulutli saqlov va reyting. Yuklab olingan faylda (file://) yoki internetsiz — "mavjud emas" deb ko'rsatiladi, o'yin o'zi to'liq ishlayveradi
import { actKinds } from './acts.js';

const SKEY = 'safar_session', SYNC = 'safar_sync', SAVE = 'safar_save_v2', SENT = 'safar_top_sent:';
const UP_EVERY = 45000; // bulutga avtomatik yuklash oralig'i (ms)
const KINDS = actKinds();
export const topKind = (id) => KINDS[id] || (/^rad(\d{1,2}|_run)$/.test(id) ? 'radar' : /^jmp\d{1,2}$/.test(id) ? 'jump' : null);
const ls = { get: (k) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* xotira yo'q */ } }, del: (k) => { try { localStorage.removeItem(k); } catch { /* */ } } };
const jparse = (s, d) => { try { return s ? JSON.parse(s) : d; } catch { return d; } };
// Saqlovdan qisqa ma'lumot (tanlash oynasi uchun) — server ham xuddi shunday hisoblaydi (api/_lib.js saveMeta)
export function summary(s) {
  if (!s) return null; let stars = 0; for (const k in s.stars || {}) { const v = +s.stars[k]; if (v > 0) stars += Math.min(3, Math.floor(v)); }
  const xp = Math.max(0, +s.xp || 0); return { money: Math.round(+s.money || 0), stars, xp: Math.round(xp), level: Math.min(7, Math.floor(Math.sqrt(xp / 220)) + 1), time: Math.round((s.stats && s.stats.time) || 0) };
}

export function initNet(game) {
  const net = (game.net = { status: 'wait', why: '', cfg: null, user: null, token: null, cloud: 'off', cloudMsg: '', listeners: new Set() });
  const changed = () => { for (const f of net.listeners) { try { f(); } catch (e) { console.error(e); } } };
  net.onChange = (f) => { net.listeners.add(f); return () => net.listeners.delete(f); };

  // so'rov: vaqt chegarasi bilan, sessiya tokeni bilan
  net.api = async (path, { method = 'GET', body, raw, timeout = 9000, keepalive } = {}) => {
    const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null, tm = ctl && setTimeout(() => ctl.abort(), timeout);
    const headers = {}; if (net.token) headers.Authorization = 'Bearer ' + net.token; if (body !== undefined || raw !== undefined) headers['Content-Type'] = 'application/json';
    try {
      const r = await fetch(path, { method, headers, body: raw !== undefined ? raw : body !== undefined ? JSON.stringify(body) : undefined, signal: ctl && ctl.signal, keepalive: !!keepalive, cache: 'no-store' });
      let j = null; try { j = await r.json(); } catch { j = null; }
      if (!r.ok || !j || j.ok === false) { const e = new Error((j && j.error) || 'Server javob bermadi (' + r.status + ')'); e.status = r.status; throw e; }
      return j;
    } catch (e) { if (e.name === 'AbortError') { const x = new Error('Server javob bermadi'); x.status = 0; throw x; } if (e.status == null) e.status = 0; throw e; }
    finally { if (tm) clearTimeout(tm); }
  };

  // ---------- ishga tushish ----------
  net.start = async () => {
    if (location.protocol === 'file:') { net.status = 'file'; net.why = "Onlayn rejim faqat sayt orqali ishlaydi. Yuklab olingan faylda o'yin to'liq ishlaydi — faqat do'stlar bilan o'ynash, bulutli saqlov va reyting yo'q."; changed(); return; }
    try { net.cfg = await net.api('/api/config', { timeout: 7000 }); net.status = 'ok'; }
    catch (e) { net.status = 'off'; net.why = typeof navigator !== 'undefined' && navigator.onLine === false ? "Internet yo'q — onlayn imkoniyatlar vaqtincha ishlamaydi. O'yinni oddiy rejimda davom ettirishingiz mumkin." : "Onlayn server javob bermadi. Keyinroq qayta urinib ko'ring — oddiy o'yin ishlayveradi."; changed(); return; }
    const tok = ls.get(SKEY);
    if (tok && (net.cfg.login || net.cfg.pass)) {
      net.token = tok; net.user = jparse(ls.get(SKEY + ':user'), null);
      try { const r = await net.api('/api/auth'); net.user = r.user; ls.set(SKEY + ':user', JSON.stringify(r.user)); changed(); await net.syncSave(); }
      catch (e) { if (e.status === 401) net.logout(true); else changed(); }
    }
    changed();
  };
  net.retry = () => { net.status = 'wait'; changed(); return net.start(); };

  // ---------- Telegram orqali kirish ----------
  // Telegram Login Widget skripti faqat kirish oynasi ochilganda yuklanadi (o'yinning o'zi tashqi skriptsiz)
  net.widget = (box) => {
    if (!net.cfg || !net.cfg.bot) return;
    window.__safarTgAuth = (u) => { net.login(u).catch((e) => game.toast('Kirish amalga oshmadi: ' + e.message, 'bad')); };
    const s = document.createElement('script'); s.async = true; s.src = 'https://telegram.org/js/telegram-widget.js?22';
    s.setAttribute('data-telegram-login', net.cfg.bot); s.setAttribute('data-size', 'large'); s.setAttribute('data-radius', '10'); s.setAttribute('data-userpic', 'false'); s.setAttribute('data-onauth', '__safarTgAuth(user)');
    s.onerror = () => { box.textContent = "Telegram bilan bog'lanib bo'lmadi. Internetni tekshiring."; };
    box.appendChild(s);
  };
  net.login = async (payload) => {
    const r = await net.api('/api/auth', { method: 'POST', body: payload });
    net.token = r.token; net.user = r.user; ls.set(SKEY, r.token); ls.set(SKEY + ':user', JSON.stringify(r.user));
    game.toast(`Xush kelibsiz, ${r.user.name}! Hisobingiz ulandi`, 'good'); changed();
    await net.syncSave(); return r.user;
  };
  net.logout = (silent) => { net.token = null; net.user = null; net.cloud = 'off'; net.cloudMsg = ''; ls.del(SKEY); ls.del(SKEY + ':user'); if (!silent) game.toast("Hisobdan chiqdingiz. O'yin shu qurilmada saqlanib turadi"); changed(); };

  // ---------- bulutli saqlov ----------
  const progress = (st) => game.totalStars() > 0 || (st.stats && (st.stats.time > 180 || st.stats.dist > 1500)) || st.veh.own.length > 2 || st.home.lvl > 0;
  let lastUp = 0, upTimer = null, dirty = false, uploading = null;
  net.syncSave = async () => {
    if (!net.token || !net.cfg || !net.cfg.save) return;
    net.cloud = 'sync'; net.cloudMsg = 'Bulut bilan solishtirilmoqda…'; changed();
    let r; try { r = await net.api('/api/save'); } catch (e) { net.cloud = 'err'; net.cloudMsg = 'Bulutga ulanib bo\'lmadi: ' + e.message; changed(); return; }
    const uid = net.user.id, sync = jparse(ls.get(SYNC), {}), st = game.state;
    game.save(); const local = jparse(ls.get(SAVE), null), ls1 = summary(local), cs = summary(r.save);
    if (!r.save) { net.cloud = 'ok'; await net.upload(true); net.cloudMsg = 'Saqlov bulutga yuklandi — endi istalgan qurilmada davom ettirasiz'; game.toast(net.cloudMsg, 'good'); changed(); return; }
    const same = ls1 && cs && ls1.money === cs.money && ls1.stars === cs.stars && ls1.xp === cs.xp;
    if (same || (sync.uid === uid && r.meta && sync.t === r.meta.t)) { net.cloud = 'ok'; net.cloudMsg = 'Bulut bilan bir xil'; ls.set(SYNC, JSON.stringify({ uid, t: r.meta && r.meta.t })); if (!same) await net.upload(true); changed(); return; }
    if (!progress(st)) { net.adopt(r.save, r.meta); return; }
    // ikkalasida ham yutuq bor — o'yinchi tanlaydi
    net.cloud = 'choice'; net.cloudMsg = 'Qaysi saqlovni davom ettirishni tanlang'; net.pending = { local: ls1, cloud: Object.assign({}, cs, r.meta || {}), save: r.save, meta: r.meta }; changed();
    if (game.ui) game.ui.open('cloud', { back: game.ui.screenName === 'online' ? game.ui.screenData && game.ui.screenData.back : null });
  };
  // bulutdagini olish: shu qurilmadagi saqlov almashtiriladi va o'yin qayta yuklanadi
  net.adopt = (save, meta) => {
    game.noSave = true; ls.set(SAVE, JSON.stringify(save)); ls.set(SYNC, JSON.stringify({ uid: net.user.id, t: meta && meta.t }));
    net.cloud = 'ok'; net.cloudMsg = 'Bulutdagi saqlov yuklanmoqda…'; changed();
    if (game.banner) game.banner('Bulutdagi saqlov', "O'yiningiz yuklanmoqda…", 'gold');
    if (!net.noReload) setTimeout(() => location.reload(), 700);
  };
  net.choose = async (which) => { const p = net.pending; net.pending = null; if (!p) return; if (which === 'cloud') net.adopt(p.save, p.meta); else { net.cloud = 'ok'; await net.upload(true); net.cloudMsg = 'Shu qurilmadagi saqlov bulutga yozildi'; game.toast(net.cloudMsg, 'good'); changed(); } };
  net.upload = async (now) => {
    if (!net.token || net.cloud !== 'ok' || game.noSave) return;
    if (uploading) { dirty = true; return uploading; }
    const raw = ls.get(SAVE); if (!raw) return;
    dirty = false; lastUp = Date.now();
    uploading = net.api('/api/save', { method: 'PUT', raw: '{"save":' + raw + '}', keepalive: now === 'exit' && raw.length < 60000 })
      .then((r) => { ls.set(SYNC, JSON.stringify({ uid: net.user && net.user.id, t: r.meta.t })); net.cloudT = r.meta.t; net.submitTop(); })
      .catch((e) => { dirty = true; if (e.status === 401) net.logout(true); else if (e.status === 413) net.cloudMsg = 'Saqlov juda katta — bulutga yozilmadi'; })
      .finally(() => { uploading = null; changed(); });
    return uploading;
  };
  // har saqlashdan keyin: bulutga ko'pi bilan 45 soniyada bir marta
  net.queue = () => {
    if (!net.token || net.cloud !== 'ok') return; dirty = true;
    const wait = UP_EVERY - (Date.now() - lastUp);
    if (wait <= 0) net.upload(); else if (!upTimer) upTimer = setTimeout(() => { upTimer = null; if (dirty) net.upload(); }, wait);
  };
  const flush = () => { if (dirty && net.token && net.cloud === 'ok') net.upload('exit'); };
  addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') { game.save(); flush(); } });

  // ---------- reyting ----------
  // shaxsiy rekordlar (state.best) o'zgarganda serverga yuboriladi; nima yuborilgani eslab qolinadi
  let topBusy = false;
  net.submitTop = async () => {
    if (!net.token || !net.cfg || !net.cfg.top || topBusy) return;
    const key = SENT + net.user.id, sent = jparse(ls.get(key), {}), best = game.state.best || {}, list = [];
    for (const id in best) if (topKind(id) && best[id] !== sent[id] && Number.isFinite(+best[id])) list.push({ id, value: +best[id] });
    if (!list.length) return; topBusy = true;
    try { await net.api('/api/top', { method: 'POST', body: { results: list.slice(0, 100) } }); for (const r of list.slice(0, 100)) sent[r.id] = r.value; ls.set(key, JSON.stringify(sent)); }
    catch (e) { if (e.status === 401) net.logout(true); }
    finally { topBusy = false; }
  };
  net.top = (id) => net.api('/api/top?id=' + encodeURIComponent(id));
  setInterval(() => { if (net.token && game.mode === 'play') net.submitTop(); }, 20000);

  // ---------- hafta reytingi (hafta.js: haftalik chellenj natijasi va hafta ko'rsatkichlari) ----------
  // faqat kirgan o'yinchida; o'zgarmagan bo'lsa qayta yuborilmaydi
  let wkBusy = false;
  net.submitWeek = async () => {
    if (!net.token || !net.cfg || !net.cfg.top || wkBusy || !game.hafta) return;
    const p = game.hafta.payload(), sig = JSON.stringify(p), key = SENT + 'hafta:' + net.user.id; if (ls.get(key) === sig) return;
    wkBusy = true;
    try { await net.api('/api/hafta', { method: 'POST', body: p }); ls.set(key, sig); }
    catch (e) { if (e.status === 401) net.logout(true); }
    finally { wkBusy = false; }
  };
  net.week = (t, w) => net.api('/api/hafta?t=' + encodeURIComponent(t) + '&w=' + encodeURIComponent(w));

  // o'yin saqlanganda bulutni ham yangilash
  const save0 = game.save; game.save = () => { save0(); if (!game.noSave) net.queue(); };
  return net;
}
