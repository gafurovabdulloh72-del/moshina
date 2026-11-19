// Do'stlar bilan birga o'ynash (2–4 kishi): PeerJS (WebRTC) orqali to'g'ridan-to'g'ri ulanish, xona kodi va taklif havolasi, boshqa o'yinchilarning transporti va qahramoni,
// chat va tez emojilar, birga poyga, umumiy kun vaqti, do'st oldiga ko'chish. Xona egasi (host) — umumiy narsalar uchun hakam; u chiqsa, keyingi o'yinchi egalikni oladi.
// Har o'yinchi o'z transportini o'zi hisoblaydi va qisqa holat yuboradi (harakatda 20, turganda 5 marta/s) — alohida tez kanal orqali (tartibsiz, qayta yuborilmaydi:
// bitta yo'qolgan paket keyingilarini ushlab turmaydi); boshqalar uni yuboruvchi vaqt tamg'asi bo'yicha moslashuvchan kechikish bilan silliq oraliqlab chizadi.
// Taklif havolasi/kod bilan kirgan mehmon xona egasining uyida yashaydi: uy holati egasidan keladi, uy amallari egasiga yuboriladi va egasi o'z saqlovida bajaradi.
// Bitta o'yinchi fizikasi o'zgarmaydi.
import * as THREE from 'three';
import { Peer } from 'peerjs';
import * as T from './terrain.js';
import { buildVehicle, syncWheels, vehById } from './vehicles.js';
import { makeRig, makeRider, poseRig, setHat, HAT_LIST, HAT_SHOP } from './rig.js';
import { lookRigOpts, STYLES, BEARDS, MENU } from './hayot2.js';
import { GB, MAT } from './geo.js';
import { JOBS } from './ish.js';
import { YARD } from './uy2.js';
import { fmtTime } from './game.js';
import { HOME_LEVELS, DECOR } from './home.js';

export const MAX_PLAYERS = 4;
const RATE_MOVE = 1 / 20, RATE_IDLE = 1 / 5, FAST_ID = 1001, HOME_R = 48, ALPH = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789', PFX = 'safarxona-';
export const SLOT_COLORS = ['#ffd23a', '#4fb0ff', '#ff6aa0', '#6ee07a'];
const SHIRTS = [0xf0b83a, 0x2f7fd0, 0xd8406a, 0x3f9a58], EMOJI = ['👋', '😂', '👍', '🔥', '😎', '🏁', '❤️', '😮'];
const HATS = new Set([...HAT_LIST, ...HAT_SHOP].map((h) => h[0]));
// kiyim-soch ko'rinishi tarmoqda ixcham: [ko'ylak, uslub №, shim, soch turmagi, soch rangi, soqol №] (hayot2.js)
const lookCode = (lk) => (lk ? [lk.shirt | 0, Math.max(0, STYLES.findIndex((q) => q[0] === lk.style)), lk.pants | 0, lk.hs | 0, lk.hair | 0, Math.max(0, BEARDS.findIndex((q) => q[0] === lk.beard))] : null);
const lookFrom = (a) => (num(a, 6) && a.length === 6 ? { shirt: a[0] & 0xffffff, style: (STYLES[a[1] | 0] || STYLES[0])[0], pants: a[2] & 0xffffff, hs: Math.max(0, Math.min(3, a[3] | 0)), hair: a[4] & 0xffffff, beard: (BEARDS[a[5] | 0] || BEARDS[0])[0] } : null);
export const QUICK_EMOJI = EMOJI;
export const roomPeerId = (code) => PFX + code.toLowerCase();
export function newCode() { const a = new Uint8Array(6); (globalThis.crypto || window.crypto).getRandomValues(a); return [...a].map((x) => ALPH[x % ALPH.length]).join(''); }
// Kiritilgan kod yoki butun havola (…?xona=ABC123) → toza kod
export function normCode(s) { s = String(s || ''); const m = /[?&]xona=([A-Za-z0-9]+)/.exec(s); if (m) s = m[1]; s = s.toUpperCase().replace(/[^A-Z0-9]/g, ''); return [...s].filter((c) => ALPH.includes(c)).join('').slice(0, 6); }
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const cleanName = (s) => String(s || '').replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim().slice(0, 24) || 'Sayyoh';
const r2 = (v) => Math.round(v * 100) / 100, r3 = (v) => Math.round(v * 1000) / 1000;
const hashStr = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };
const som = (n) => Math.round(n).toLocaleString('ru-RU').replace(/,/g, ' ');
const num = (a, n) => Array.isArray(a) && a.length >= n && a.every((v) => typeof v === 'number' && Number.isFinite(v));

// ---------- boshqa o'yinchi (ko'rinish) ----------
class Remote {
  constructor(game, m) {
    this.g = game; this.m = m; this.buf = []; this.veh = null; this.model = null; this.paint = null; this.hat = null; this.foot = false;
    this.pos = new THREE.Vector3(); this.q = new THREE.Quaternion(); this.fpos = new THREE.Vector3(); this.fyaw = 0; this.shown = false; this.anim = 'idle';
    this.seq = 0; this.off = null; this.jit = 0; this.gap = RATE_MOVE; this.dl = 0.11; this.lastMs = null; this.lod = -1; // vaqt tamg'asi, tebranish, kechikish, ko'rinish darajasi
    this.fake = { wheels: [0, 1, 2, 3].map(() => ({ len: 0, spin: 0, ly: 0 })), steer: 0, fwd: 0 };
    this.rig = makeRig({ seed: 300 + (hashStr(m.pid) % 5000), shirt: SHIRTS[m.slot % 4], height: 1, build: 1 }); this.rig.root.visible = false; game.scene.add(this.rig.root);
    this.ctl = { vx: 0, vz: 0, vy: 0, grounded: true, swim: false, energy: 100, moveYaw: null, camYaw: 0 };
    this.tagC = document.createElement('canvas'); this.tagC.width = 512; this.tagC.height = 128; this.tagTex = new THREE.CanvasTexture(this.tagC); this.tagTex.colorSpace = THREE.SRGBColorSpace;
    this.tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.tagTex, transparent: true, depthWrite: false, depthTest: false, sizeAttenuation: false, fog: false, toneMapped: false }));
    this.tag.scale.set(0.26, 0.065, 1); this.tag.renderOrder = 999; this.tag.visible = false; game.scene.add(this.tag); this.drawTag();
  }
  // ism yorlig'i: emoji (4 s) + ism; ovozli chatda chap tomonda mikrofon belgisi (kulrang — jim, yashil va "nafas oladi" — gapiryapti)
  drawTag() {
    const c = this.tagC.getContext('2d'), m = this.m, col = SLOT_COLORS[m.slot % 4], vt = this.vt | 0, emoji = this._em; c.clearRect(0, 0, 512, 128);
    const txt = (emoji ? emoji + ' ' : '') + m.name; c.font = '800 52px system-ui, sans-serif'; const mic = vt ? 64 : 0, w = Math.min(500, c.measureText(txt).width + 56 + mic), x = 256 - w / 2;
    c.fillStyle = 'rgba(12,16,28,.78)'; c.beginPath(); c.roundRect(x, 20, w, 80, 40); c.fill(); c.lineWidth = 6; c.strokeStyle = col; c.stroke();
    if (vt) { const cx = x + 44, r = vt === 1 ? 24 : vt === 2 ? 27 : 33; c.fillStyle = vt === 1 ? 'rgba(150,160,180,.45)' : vt === 2 ? '#3ccf6e' : '#5ef08c'; c.beginPath(); c.arc(cx, 60, r, 0, 6.283); c.fill();
      c.fillStyle = '#fff'; c.beginPath(); c.roundRect(cx - 7, 42, 14, 24, 7); c.fill(); c.strokeStyle = '#fff'; c.lineWidth = 4; c.beginPath(); c.arc(cx, 56, 13, 0.15, Math.PI - 0.15); c.stroke(); c.beginPath(); c.moveTo(cx, 69); c.lineTo(cx, 77); c.stroke(); }
    c.fillStyle = '#fff'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(txt, 256 + mic / 2, 62, 470 - mic); this.tagTex.needsUpdate = true;
  }
  emote(e) { this._em = e; this.drawTag(); clearTimeout(this._et); this._et = setTimeout(() => { this._em = null; this.drawTag(); }, 4000); }
  // do'stning kiyimi va sochi: o'zgarganda model qayta quriladi (shapka, joy saqlanadi)
  setLook(lk) {
    if (!lk) return; const key = JSON.stringify(lk); if (key === this.lkK) return; this.lkK = key; const old = this.rig, r = makeRig(lookRigOpts(lk));
    this.look = lk; r.root.visible = old.root.visible; r.root.position.copy(old.root.position); r.root.rotation.copy(old.root.rotation); this.g.scene.add(r.root); this.g.scene.remove(old.root); old.mesh.geometry.dispose(); old.mesh.skeleton.dispose();
    this.rig = r; setHat(r, this.hat); this.lod = -1;
  }
  setVoice(vt) { if (vt !== (this.vt | 0)) { this.vt = vt; this.drawTag(); } } // 0 — ovozli chatda emas, 1 — jim, 2/3 — gapiryapti (navbatma-navbat — "nafas")
  setVeh(id, paint) {
    if (!vehById[id]) id = 'jip';
    if (id !== this.veh) {
      if (this.model) { this.g.scene.remove(this.model.root); }
      const m = buildVehicle(id, { lite: true }); m.root.remove(m.spot); m.root.remove(m.spot.target); // chiroqlar soni o'zgarmasin (sheyderlar qayta kompilyatsiya bo'lmasin)
      m.root.traverse((o) => { if (o.isMesh) o.userData.sh0 = o.castShadow; }); this.lod = -1;
      m.root.visible = false; this.g.scene.add(m.root); this.model = m; this.veh = id; this.paint = null; const sp = m.spec;
      this.fake.wheels.forEach((w, k) => { w.len = sp.free - sp.sag; w.ly = (k < 2 ? sp.rF : sp.rR) + (sp.free - sp.sag) - sp.com; });
    }
    if (paint !== this.paint && typeof paint === 'number') { this.paint = paint; this.model.paintMat.color.setHex(paint); }
  }
  // ko'rinish darajasi: 0 — yaqin (soya, g'ildirak, chiroqlar), 1 — o'rtacha (soyasiz), 2 — uzoq (model yashirin, faqat ism yorlig'i)
  setLod(l) { if (l === this.lod) return; const sh = l === 0; this.lod = l; this.model.root.traverse((o) => { if (o.isMesh) o.castShadow = sh && !!o.userData.sh0; }); this.rig.root.traverse((o) => { if (o.isMesh) o.castShadow = sh; }); }
  push(d, now) {
    if (!num(d.c, 12)) return;
    const n = d.n | 0; if (n > 0) { if (n <= this.seq) return; this.seq = n; } // tez kanal tartibsiz: eskirgan paket tashlanadi
    if (d.h && !num(d.h, 9)) d.h = 0;
    // yuboruvchi vaqti → mahalliy vaqt: eng kichik (eng tez kelgan) farq asos, kechikib kelganlar tebranishni (jitter) bildiradi
    let t = now; if (typeof d.ms === 'number' && Number.isFinite(d.ms)) { const sm = d.ms / 1000, o = now - sm;
      if (this.off == null || o < this.off) this.off = o; else this.off += Math.min(o - this.off, 0.0002);
      this.jit += (Math.min(0.3, o - this.off) - this.jit) * 0.08; t = sm + this.off;
      if (this.lastMs != null && !d.i && !this.lastIdle) { const gp = sm - this.lastMs; if (gp > 0 && gp < 0.5) this.gap += (gp - this.gap) * 0.1; } this.lastMs = sm; this.lastIdle = !!d.i; }
    if (d.v != null || !this.veh) this.setVeh(String(d.v || 'jip'), d.k);
    if (typeof d.hat === 'string' || d.hat === null) { const h = HATS.has(d.hat) ? d.hat : null; if (h !== this.hat) { this.hat = h; setHat(this.rig, h); } }
    if (d.lk) this.setLook(lookFrom(d.lk));
    this.anim = typeof d.a === 'string' && /^[a-z]{2,12}$/.test(d.a) ? d.a : 'idle';
    this.rp = +d.rp || 0; this.lastPkt = d;
    this.ri = typeof d.ri === 'string' && d.ri.length < 80 ? d.ri : null; this.se = Math.max(0, Math.min(2, d.se | 0)); // yo'lovchi: qaysi do'st mashinasida, qaysi o'rindiqda
    const b = this.buf; if (b.length && t - b[b.length - 1].t < 0.005) b.pop(); b.push({ t, c: d.c, h: d.h || null, f: d.f | 0 }); if (b.length > 40) b.shift();
  }
  // oraliqlangan holat: ikki paket orasida chiziqli/sferik, oxirgisidan keyin tezlik bo'yicha (ko'pi bilan 0,35 s)
  sample(rt) {
    const b = this.buf; if (!b.length) return null;
    let i = b.length - 1; while (i > 0 && b[i - 1].t > rt) i--;
    const B = b[i], A = i > 0 ? b[i - 1] : null;
    if (A && rt <= B.t) { const k = Math.max(0, Math.min(1, (rt - A.t) / Math.max(1e-3, B.t - A.t))); return { A, B, k, ex: 0 }; }
    return { A: B, B, k: 0, ex: Math.max(0, Math.min(0.35, rt - B.t)) };
  }
  update(dt, now) {
    // moslashuvchan kechikish: paketlar oralig'i + tebranish (yaxshi tarmoqda ~70 ms, yomonida 300 ms gacha)
    const want = Math.max(0.06, Math.min(0.3, this.gap * 1.25 + this.jit * 2.5 + 0.012)); this.dl += (want - this.dl) * Math.min(1, dt * (want > this.dl ? 4 : 0.7));
    const s = this.sample(now - this.dl); if (!s || !this.model) return;
    const { A, B, k, ex } = s, a = A.c, b = B.c, m = this.model;
    const tx = a[0] + (b[0] - a[0]) * k + b[7] * ex, ty = a[1] + (b[1] - a[1]) * k + b[8] * ex * 0.5, tz = a[2] + (b[2] - a[2]) * k + b[9] * ex;
    _qa.set(a[3], a[4], a[5], a[6]).normalize(); _qb.set(b[3], b[4], b[5], b[6]).normalize(); _qa.slerp(_qb, k);
    const jump = !this.shown || this.pos.distanceToSquared(_v.set(tx, ty, tz)) > 900; // uzoqqa ko'chdi (teleport) — silliqlamasdan
    const sk = jump ? 1 : 1 - Math.exp(-dt * 18);
    this.pos.x += (tx - this.pos.x) * sk; this.pos.y += (ty - this.pos.y) * sk; this.pos.z += (tz - this.pos.z) * sk; if (jump) this.q.copy(_qa); else this.q.slerp(_qa, sk);
    this.shown = true;
    const foot = !!(B.f & 4); this.foot = foot;
    const cam = this.g.camera.position, cd = cam.distanceTo(this.pos), lod = cd < 90 ? 0 : cd < 450 ? 1 : 2; this.setLod(lod);
    m.root.visible = lod < 2; m.root.position.copy(this.pos); m.root.quaternion.copy(this.q);
    const f = this.fake; f.steer = a[10] + (b[10] - a[10]) * k; f.fwd = foot ? 0 : a[11] + (b[11] - a[11]) * k;
    for (let w = 0; w < 4; w++) f.wheels[w].spin += (f.fwd * dt) / ((w < 2 ? m.spec.rF : m.spec.rR) || 0.4);
    if (lod < 2) syncWheels(m, f);
    if (m.rider) m.rider.visible = !foot;
    const lit = !!(B.f & 1), brk = !!(B.f & 2);
    if (m.headMat) { if (lit) m.headMat.color.setRGB(2.6, 2.4, 1.9); else m.headMat.color.setHex(0xb8b8b0); }
    if (m.tailMat) { if (brk) m.tailMat.color.setRGB(2.4, 0.22, 0.12); else m.tailMat.color.setHex(lit ? 0xa81810 : 0x6a1410); }
    // piyoda qahramon
    const rig = this.rig; rig.root.visible = foot && !!B.h && cam.distanceTo(this.fpos) < 300 && !this.riding(); // yo'lovchi — haydovchi mashinasidagi o'rindiqda chiziladi
    if (foot && B.h) {
      const ha = A.h || B.h, hb = B.h, hx = ha[0] + (hb[0] - ha[0]) * k + hb[4] * ex, hy = ha[1] + (hb[1] - ha[1]) * k, hz = ha[2] + (hb[2] - ha[2]) * k + hb[5] * ex;
      const fj = !this.fshown || this.fpos.distanceToSquared(_v.set(hx, hy, hz)) > 400, fk = fj ? 1 : 1 - Math.exp(-dt * 16);
      this.fpos.x += (hx - this.fpos.x) * fk; this.fpos.y += (hy - this.fpos.y) * fk; this.fpos.z += (hz - this.fpos.z) * fk; this.fshown = true;
      let dy = hb[3] - this.fyaw; while (dy > Math.PI) dy -= 2 * Math.PI; while (dy < -Math.PI) dy += 2 * Math.PI; this.fyaw += dy * (fj ? 1 : fk);
      rig.root.position.copy(this.fpos); rig.root.rotation.y = this.fyaw;
      const C = this.ctl; C.vx = hb[4]; C.vz = hb[5]; C.vy = hb[6]; C.grounded = !!hb[7]; C.swim = !!hb[8];
      if (rig.root.visible) poseRig(rig, this.anim, dt, Math.hypot(hb[4], hb[5]), C);
    } else this.fshown = false;
    // ism yorlig'i
    const tp = foot && B.h ? this.fpos : this.pos, hh = foot ? 2.25 : (m.spec.hgt || 1.6) + 1.1, d = cam.distanceTo(tp);
    this.tag.visible = d < 900; this.tag.position.set(tp.x, tp.y + hh - (foot ? 0 : m.spec.com || 0), tp.z);
  }
  riding() { const C = this.g.coop; return !!this.ri && !!C && (this.ri === C.myId() || C.members.has(this.ri)); }
  // xaritada ko'rsatish uchun joriy joy
  where() { return this.foot && this.fshown ? [this.fpos.x, this.fpos.z] : [this.pos.x, this.pos.z]; }
  yaw() { _e.setFromQuaternion(this.q, 'YXZ'); return this.foot ? this.fyaw : _e.y; }
  dispose() { const sc = this.g.scene; if (this.model) sc.remove(this.model.root); sc.remove(this.rig.root); sc.remove(this.tag); this.tag.material.map.dispose(); this.tag.material.dispose(); clearTimeout(this._et); }
}
const _qa = new THREE.Quaternion(), _qb = new THREE.Quaternion(), _v = new THREE.Vector3(), _e = new THREE.Euler();

// ---------- xona ----------
export function initCoop(game) {
  const net = game.net;
  const C = (game.coop = { room: null, members: new Map(), status: 'idle', msg: '', chat: [], listeners: new Set(), race: null, errs: [] }); // errs — tashxis uchun oxirgi ulanish xatolari
  let peer = null, hostPeer = null, acc = 0, hourT = 0, lastPing = 0, joinTimer = null, seq = 0, metaN = 0, metaK = '', homeT = 0;
  const changed = () => { for (const f of C.listeners) { try { f(); } catch (e) { console.error(e); } } };
  C.onChange = (f) => { C.listeners.add(f); return () => C.listeners.delete(f); };
  game.bgRender = () => !!C.room && C.members.size > 0 && typeof document.hasFocus === 'function' && !document.hasFocus();
  C.available = () => net && net.status === 'ok';
  C.myName = () => { if (net.user) return cleanName(net.user.name); let n = null; try { n = localStorage.getItem('safar_guest'); } catch { /* */ } if (!n) { n = 'Sayyoh-' + (1000 + Math.floor(Math.random() * 9000)); try { localStorage.setItem('safar_guest', n); } catch { /* */ } } return n; };
  C.myId = () => (peer ? peer.id : null);
  C.inviteLink = () => C.room ? location.origin + location.pathname + '?xona=' + C.room.code : '';
  const peerOpts = () => { const o = Object.assign({ debug: 0 }, (net.cfg && net.cfg.peer) || {}); o.config = { iceServers: (net.cfg && net.cfg.ice) || [{ urls: ['stun:stun.l.google.com:19302'] }] }; return o; };
  const PEER_ERR = { 'unavailable-id': 'Xona kodi band', 'peer-unavailable': 'Bunday xona topilmadi (kod noto\'g\'ri yoki xona yopilgan)', network: "Onlayn serverga ulanib bo'lmadi", 'server-error': "Onlayn server javob bermadi", 'socket-error': "Onlayn serverga ulanib bo'lmadi", 'socket-closed': 'Ulanish uzildi', 'browser-incompatible': "Brauzeringiz to'g'ridan-to'g'ri ulanishni qo'llamaydi (WebRTC)", webrtc: 'Ulanishda xatolik (WebRTC)' };
  const fail = (msg) => { C.status = 'error'; C.msg = msg; teardown(); changed(); };
  const roster = () => { const r = [{ pid: peer.id, name: C.myName(), slot: C.room.slot, uid: net.user ? net.user.id : '' }]; for (const m of C.members.values()) r.push({ pid: m.pid, name: m.name, slot: m.slot, uid: m.uid }); return r.sort((a, b) => a.slot - b.slot); };
  C.roster = () => (C.room ? roster() : []);
  const sendTo = (m, d) => { try { if (m.conn && m.conn.open) m.conn.send(d); } catch { /* ulanish yopilgan */ } };
  const bcast = (d) => { for (const m of C.members.values()) sendTo(m, d); };
  const hello = () => ({ t: 'hi', pid: peer.id, name: C.myName(), uid: net.user ? net.user.id : '', slot: C.room ? C.room.slot : null, code: C.room ? C.room.code : null, v: 2, vo: VC.on ? 1 : 0 });
  // holat paketlari uchun qo'shimcha kanal o'sha WebRTC ulanishida (kelishilgan id — qo'shimcha signal kerak emas): tartibsiz va qayta yuborilmaydi.
  // Ikkala tomondan xabar kelgandan keyingina ishlatiladi; ishlamasa (eski versiya, tarmoq) holat asosiy ishonchli kanaldan ketadi.
  function openFast(conn) {
    const pc = conn.peerConnection; if (!pc || conn._fast || typeof pc.createDataChannel !== 'function') return;
    try { const ch = pc.createDataChannel('safar-s', { negotiated: true, id: FAST_ID, ordered: false, maxRetransmits: 0 }); conn._fast = ch;
      ch.onmessage = (e) => { let d; try { d = JSON.parse(e.data); } catch { return; } const m = memberOf(conn); if (!m || !d || typeof d !== 'object') return; const ms = performance.now(); m.fastIn = ms; m.last = ms; if (d.t === 's') m.remote.push(d, ms / 1000); };
    } catch (e) { (C.errs.length > 30 && C.errs.shift(), C.errs).push('fast: ' + (e && e.message)); }
  }
  const fastOk = (m) => { const ch = m.conn && m.conn._fast; return !!(ch && ch.readyState === 'open' && m.v >= 2 && m.fastIn && performance.now() - m.fastIn < 4000 && ch.bufferedAmount < 32768); };
  const sendState = (m, d, str) => { if (fastOk(m)) { try { m.conn._fast.send(str); return; } catch { /* ishonchli kanalga */ } } sendTo(m, d); };

  // ---- ulanishni sozlash (kiruvchi ham, chiquvchi ham) ----
  function setupConn(conn) {
    conn.on('open', () => { try { conn.send(hello()); } catch { /* */ } openFast(conn); });
    conn.on('data', (d) => { try { onData(conn, d); } catch (e) { console.error(e); } });
    conn.on('close', () => { (C.errs.length > 30 && C.errs.shift(), C.errs).push('yopildi: ' + conn.peer); onClose(conn); });
    conn.on('error', (e) => { (C.errs.length > 30 && C.errs.shift(), C.errs).push('conn ' + conn.peer + ': ' + (e && e.message)); onClose(conn); });
  }
  function connectTo(pid) { if (!peer || peer.destroyed || pid === peer.id) return; const c = peer.connect(pid, { reliable: true, serialization: 'json', metadata: { room: C.room && C.room.code } }); setupConn(c); }
  const memberOf = (conn) => { for (const m of C.members.values()) if (m.conn === conn) return m; return null; };
  function addMember(conn, d) {
    const pid = String(d.pid || conn.peer); let m = C.members.get(pid);
    if (m && m.conn !== conn) { if (m.conn && m.conn.open && !m.lost) { try { conn.close(); } catch { /* */ } return null; } const old = m.conn; m.conn = conn; m.last = performance.now(); if (m.lost) { m.lost = 0; (C.errs.length > 30 && C.errs.shift(), C.errs).push('tiklandi: ' + pid); } if (old && old !== conn) { try { old.close(); } catch { /* */ } } return m; }
    if (!m) { m = { pid, name: cleanName(d.name), uid: String(d.uid || '').slice(0, 20), slot: d.slot | 0, conn, last: performance.now(), remote: null, ping: 0, v: d.v | 0 }; C.members.set(pid, m); m.remote = new Remote(game, m); }
    m.v = d.v | 0; m.vr = !!d.vo; setTimeout(() => reconcile(m), 0); return m;
  }
  function onData(conn, d) {
    if (!d || typeof d !== 'object' || typeof d.t !== 'string') return;
    let m = memberOf(conn); const now = performance.now() / 1000;
    if (d.t === 'hi') {
      if (C.room && d.code && d.code !== C.room.code) { try { conn.close(); } catch { /* */ } return; }
      if (C.room && C.room.isHost && !C.members.has(String(d.pid))) {
        if (C.members.size + 1 >= MAX_PLAYERS) { try { conn.send({ t: 'full' }); } catch { /* */ } setTimeout(() => conn.close(), 300); return; }
        const used = new Set([C.room.slot, ...[...C.members.values()].map((x) => x.slot)]); let s = 0; while (used.has(s)) s++;
        d.slot = s; m = addMember(conn, d); if (!m) return;
        sendTo(m, { t: 'wel', slot: s, host: peer.id, code: C.room.code, roster: roster(), hour: game.hour }); sendTo(m, homeSnap());
        bcast({ t: 'ros', host: peer.id, roster: roster() }); sysMsg(`${m.name} xonaga qo'shildi`); game.audio.sfx('check'); changed(); return;
      }
      m = addMember(conn, d); if (m) { if (d.slot != null) m.slot = d.slot | 0; changed(); } return;
    }
    if (d.t === 'full') { fail("Xona to'la (ko'pi bilan 4 kishi)"); return; }
    if (!m) return;
    m.last = performance.now();
    switch (d.t) {
      case 's': m.remote.push(d, now); break;
      case 'wel': { if (!C.room || C.room.joining !== true) break; clearTimeout(joinTimer); C.room.joining = false; C.room.slot = d.slot | 0; C.room.hostPid = String(d.host); if (typeof d.hour === 'number') game.hour = d.hour;
        applyRoster(d.roster); C.status = 'room'; C.msg = ''; sysMsg(`Xonaga qo'shildingiz: ${C.room.code}`); game.audio.sfx('check'); C.enterPlay(); changed(); break; }
      case 'ros': if (String(d.host) === m.pid || m.pid === C.room.hostPid) { C.room.hostPid = String(d.host); applyRoster(d.roster); changed(); } break;
      case 'c': { const txt = String(d.m || '').replace(/[\u0000-\u001f]/g, ' ').slice(0, 160).trim(); if (txt) addChat(m.name, txt, m.slot); break; }
      case 'e': if (EMOJI.includes(d.e)) { addChat(m.name, d.e, m.slot, true); m.remote.emote(d.e); } break;
      case 'h': if (m.pid === C.room.hostPid && typeof d.h === 'number' && d.h >= 0 && d.h < 24 && !(game.act && game.act.hourBak != null)) { let dh = d.h - game.hour; if (dh > 12) dh -= 24; if (dh < -12) dh += 24; if (Math.abs(dh) > 0.04) game.hour = d.h; } break;
      case 'pi': sendTo(m, { t: 'po', x: d.x }); break;
      case 'po': if (typeof d.x === 'number') m.ping = Math.round(performance.now() - d.x); break;
      case 'rs': if (m.pid === C.room.hostPid) startRaceLocal(d); break;
      case 'rf': onFinish(m.pid, d); break;
      case 'rr': if (m.pid === C.room.hostPid) showResults(d); break;
      case 'bye': m.bye = true; break;
      case 'vo': m.vr = !!d.on; reconcile(m); changed(); break; // do'st ovozli chatni yoqdi/o'chirdi
      case 'hm': if (!C.room.isHost && m.pid === C.room.hostPid) visitApply(d); break; // xona egasining uyi
      case 'ha': if (C.room.isHost) hostAct(m, d); break; // mehmon uyda biror narsa qildi
      case 'hr': if (m.pid === C.room.hostPid) visitDone(d.id | 0, d); break; // egasining javobi
      default: birgaData(m, d); // yo'lovchi, birga ish, choyxona, o'tkazma, belgi (pastda)
    }
  }
  function applyRoster(list) {
    if (!Array.isArray(list)) return;
    for (const r of list.slice(0, MAX_PLAYERS)) { const pid = String(r.pid); if (pid === peer.id) { C.room.slot = r.slot | 0; continue; } const m = C.members.get(pid); if (m) { m.slot = r.slot | 0; m.name = cleanName(r.name); m.remote.drawTag(); } else if (peer.id > pid) connectTo(pid); }
  }
  // Kutilmagan uzilish (Wi-Fi uzilib qoldi, kompyuter qotdi): darhol chiqarib yubormaymiz — 12 soniya qayta ulanishga urinamiz (kattaroq id'li tomon ulanadi)
  function onClose(conn) {
    const m = memberOf(conn); if (!m || m.conn !== conn) return;
    if (!m.bye && C.room && !C.room.joining && peer && !peer.destroyed) { if (!m.lost) { m.lost = performance.now(); retry(m); } return; }
    drop(m);
  }
  function retry(m) {
    if (!m.lost || C.members.get(m.pid) !== m || !C.room) return;
    if (m.conn && m.conn.open) { m.lost = 0; return; }
    if (performance.now() - m.lost > 12000) { drop(m); return; }
    if (peer.id > m.pid) connectTo(m.pid);
    setTimeout(() => retry(m), 3000);
  }
  function drop(m) {
    if (C.members.get(m.pid) !== m) return;
    birgaDrop(m); C.members.delete(m.pid); endCall(m); m.remote.dispose();
    if (C.room) sysMsg(`${m.name} ${m.bye ? 'xonadan chiqdi' : 'bilan aloqa uzildi'}`);
    if (C.room && C.room.joining) { fail("Xonaga ulanib bo'lmadi"); return; }
    if (C.room && m.pid === C.room.hostPid) migrate();
    else if (C.room && C.room.isHost) bcast({ t: 'ros', host: peer.id, roster: roster() });
    if (C.race) checkRaceDone();
    changed();
  }
  // xona egasi chiqib ketdi — eng kichik raqamli o'yinchi egalikni oladi, xona kodi saqlanib qoladi
  function migrate() {
    const all = roster(), next = all[0];
    C.room.hostPid = next.pid;
    if (next.pid === peer.id) { C.room.isHost = true; sysMsg('Endi siz xona egasisiz — hamma sizning uyingizda'); visitEnd(); claimRoom(0); bcast({ t: 'ros', host: peer.id, roster: roster() }); sendHome(true); }
    else sysMsg(`${next.name} endi xona egasi`);
  }
  function claimRoom(n) {
    if (!C.room || !C.room.isHost || (hostPeer && !hostPeer.destroyed)) return;
    const hp = new Peer(roomPeerId(C.room.code), peerOpts()); hostPeer = hp;
    hp.on('connection', (c) => setupConn(c));
    hp.on('error', (e) => { if (e.type === 'unavailable-id' && n < 12) { hp.destroy(); hostPeer = null; setTimeout(() => claimRoom(n + 1), 3000); } });
  }

  // ---- xona ochish / qo'shilish / chiqish ----
  C.create = () => new Promise((resolve) => {
    if (!C.available()) { fail(net.why || 'Onlayn rejim mavjud emas'); return resolve(false); }
    teardown(); C.status = 'connecting'; C.msg = 'Xona ochilmoqda…'; changed();
    let tries = 0;
    const attempt = () => {
      const code = newCode(); const p = new Peer(roomPeerId(code), peerOpts()); peer = p;
      p.on('open', () => { C.room = { code, isHost: true, slot: 0, hostPid: p.id, joining: false }; C.status = 'room'; C.msg = ''; sysMsg(`Xona ochildi. Kod: ${code}`); game.audio.sfx('check'); changed(); resolve(true); });
      p.on('connection', (c) => setupConn(c)); p.on('call', (c) => onCall(c));
      p.on('error', (e) => { (C.errs.length > 30 && C.errs.shift(), C.errs).push(e.type + ': ' + e.message); if (e.type === 'unavailable-id' && ++tries < 4 && !C.room) { p.destroy(); attempt(); return; } if (!C.room) { fail(PEER_ERR[e.type] || 'Ulanishda xatolik'); resolve(false); } });
      p.on('disconnected', () => { if (C.room && !p.destroyed) setTimeout(() => { try { p.reconnect(); } catch { /* */ } }, 1500); });
    };
    attempt();
  });
  C.join = (input) => new Promise((resolve) => {
    const code = normCode(input);
    if (code.length !== 6) { C.status = 'error'; C.msg = 'Xona kodi 6 belgidan iborat'; changed(); return resolve(false); }
    if (!C.available()) { fail(net.why || 'Onlayn rejim mavjud emas'); return resolve(false); }
    teardown(); C.status = 'connecting'; C.msg = `${code} xonasiga ulanilmoqda…`; changed();
    const p = new Peer(peerOpts()); peer = p;
    p.on('open', () => {
      C.room = { code, isHost: false, slot: -1, hostPid: roomPeerId(code), joining: true };
      const c = p.connect(roomPeerId(code), { reliable: true, serialization: 'json', metadata: { room: code } }); setupConn(c);
      joinTimer = setTimeout(() => { if (C.room && C.room.joining) { fail("Xona javob bermadi. Kodni tekshiring yoki qayta urining"); resolve(false); } }, 15000);
      const off = C.onChange(() => { if (C.status === 'room') { off(); resolve(true); } else if (C.status === 'error') { off(); resolve(false); } });
    });
    p.on('connection', (c) => setupConn(c)); p.on('call', (c) => onCall(c));
    p.on('error', (e) => { (C.errs.length > 30 && C.errs.shift(), C.errs).push(e.type + ': ' + e.message); if (C.status === 'room') return; /* xonadamiz: bitta ulanish xatosi xonani buzmaydi */ fail(PEER_ERR[e.type] || 'Ulanishda xatolik'); resolve(false); });
    p.on('disconnected', () => { if (C.room && !p.destroyed) setTimeout(() => { try { p.reconnect(); } catch { /* */ } }, 1500); });
  });
  function teardown() {
    clearTimeout(joinTimer); voiceOff(true); birgaReset();
    for (const m of C.members.values()) { endCall(m); try { m.conn.close(); } catch { /* */ } m.remote.dispose(); }
    C.members.clear(); C.room = null; C.race = null; game.coopRace = null; visitEnd();
    for (const p of [hostPeer, peer]) if (p && !p.destroyed) { try { p.destroy(); } catch { /* */ } }
    peer = hostPeer = null; game.netDots = null;
  }
  C.leave = () => { if (!C.room && !peer) return; bcast({ t: 'bye' }); setTimeout(() => { teardown(); C.status = 'idle'; C.msg = ''; changed(); }, 120); C.chat.length = 0; renderChat(); game.toast('Xonadan chiqdingiz'); };
  addEventListener('beforeunload', () => { if (C.room) bcast({ t: 'bye' }); });
  // bosh menyudan xonaga kirilganda — o'yin boshlanadi
  C.enterPlay = () => { const ui = game.ui; if (!ui) return; const fromMenu = game.mode === 'menu' || (ui.screenData && ui.screenData.back === 'menu'); if (fromMenu && game.startPlay) { ui.screenName = null; ui.close(); game.startPlay(); } };

  // ---- chat ----
  C.say = (text) => { text = String(text || '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, 160); if (!text || !C.room) return; bcast({ t: 'c', m: text }); addChat(C.myName(), text, C.room.slot); };
  C.emoji = (e) => { if (!EMOJI.includes(e) || !C.room) return; bcast({ t: 'e', e }); addChat(C.myName(), e, C.room.slot, true); };
  function addChat(name, text, slot, big) { C.chat.push({ name, text, slot, big, t: Date.now() }); if (C.chat.length > 40) C.chat.shift(); renderChat(); if (slot !== (C.room && C.room.slot)) game.audio.sfx('click'); }
  function sysMsg(text) { C.chat.push({ name: '', text, sys: true, t: Date.now() }); if (C.chat.length > 40) C.chat.shift(); renderChat(); game.toast(text); }
  // chat oynasi (HUD ustida): [U] — yozish, Enter — yuborish, Esc — yopish
  const box = document.createElement('div'); box.id = 'chat';
  box.innerHTML = `<div class="feed"></div><form class="in" autocomplete="off"><input maxlength="160" placeholder="Xabar… (Enter — yuborish, Esc — yopish)"><div class="emo">${EMOJI.map((e) => `<button type="button" data-e="${e}">${e}</button>`).join('')}</div></form>`;
  (document.getElementById('ui') || document.body).appendChild(box);
  let feedHtml = null; const feed = box.querySelector('.feed'), form = box.querySelector('form'), input = box.querySelector('input');
  form.onsubmit = (e) => { e.preventDefault(); C.say(input.value); input.value = ''; C.closeChat(); };
  input.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Escape') C.closeChat(); });
  box.querySelector('.emo').onclick = (e) => { const b = e.target.closest('[data-e]'); if (b) { C.emoji(b.dataset.e); C.closeChat(); } };
  C.openChat = () => { if (!C.room) { game.toast('Chat faqat xonada ishlaydi — [O] Onlayn'); return; } box.classList.add('open'); input.focus(); renderChat(); };
  C.closeChat = () => { box.classList.remove('open'); input.blur(); game.input.keys.clear(); renderChat(); };
  function renderChat() {
    const open = box.classList.contains('open'), now = Date.now();
    const list = C.chat.filter((c) => open || now - c.t < 14000).slice(-8);
    const html = list.map((c) => c.sys ? `<div class="sys">${esc(c.text)}</div>` : `<div><b style="color:${SLOT_COLORS[(c.slot | 0) % 4]}">${esc(c.name)}</b> <span class="${c.big ? 'big' : ''}">${esc(c.text)}</span></div>`).join(''), disp = C.room || open ? '' : 'none';
    if (html !== feedHtml) { feedHtml = html; feed.innerHTML = html; } if (box.style.display !== disp) box.style.display = disp; // DOM faqat o'zgarganda (kanvas ustidagi qatlam har 2 s qayta chizilmasin)
  }
  setInterval(renderChat, 2000);

  // ---- birga poyga ----
  C.races = () => game.acts.acts.filter((a) => a.cat === 'race');
  C.startRace = (id) => {
    if (!C.room || !C.room.isHost) return false; const a = game.acts.byId[id]; if (!a || a.cat !== 'race') return false;
    const slots = {}; for (const r of roster()) slots[r.pid] = r.slot;
    const d = { t: 'rs', id, slots }; bcast(d); startRaceLocal(d); return true;
  };
  function startRaceLocal(d) {
    const a = game.acts.byId[d.id]; if (!a || a.cat !== 'race' || !d.slots) return;
    const pids = Object.keys(d.slots).filter((p) => p === peer.id || C.members.has(p)).sort((x, y) => d.slots[x] - d.slots[y]);
    if (!pids.includes(peer.id)) return;
    if (game.act) game.endAct(false, 'cancel');
    if (C.ride) C.rideOff();
    const names = {}; for (const p of pids) names[p] = p === peer.id ? C.myName() : C.members.get(p).name;
    C.race = { id: d.id, pids, names, fin: {}, t0: performance.now(), firstFin: 0, done: false };
    if (game.ui && game.ui.screenName) { game.ui.screenName === 'menu' ? C.enterPlay() : game.ui.close(); }
    game.coopRace = { grid: pids.indexOf(peer.id), n: pids.length, place: 1, done: 0 };
    game.startAct(a); sysMsg(`Birga poyga: ${a.name}! ${pids.length} ishtirokchi`);
  }
  // natija: vaqt (soniya) yoki null (chiqib ketdi / bekor qildi)
  function onFinish(pid, d) {
    const R = C.race; if (!R || d.id !== R.id || !R.pids.includes(pid) || pid in R.fin) return;
    const t = typeof d.time === 'number' && d.time > 0 && d.time < 7200 ? d.time : null; R.fin[pid] = t;
    if (t != null) { if (!R.firstFin) R.firstFin = performance.now(); if (game.coopRace) game.coopRace.done++; if (pid !== peer.id) game.toast(`🏁 ${R.names[pid]} marraga yetdi — ${fmtTime(t)}`, 'gold'); }
    checkRaceDone();
  }
  function checkRaceDone() {
    const R = C.race; if (!R || R.done || !C.room || !C.room.isHost) return;
    const live = R.pids.filter((p) => p === peer.id || C.members.has(p));
    const timeout = R.firstFin && performance.now() - R.firstFin > 150000;
    if (!live.every((p) => p in R.fin) && !timeout) return;
    const rows = R.pids.map((p) => ({ name: R.names[p], time: p in R.fin ? R.fin[p] : null, left: !live.includes(p) })).sort((a, b) => (a.time == null) - (b.time == null) || (a.time || 0) - (b.time || 0));
    const d = { t: 'rr', id: R.id, rows }; bcast(d); showResults(d);
  }
  function showResults(d) {
    const R = C.race; if (R) R.done = true; C.race = null;
    const a = game.acts.byId[d.id]; C.lastResults = { name: a ? a.name : 'Poyga', rows: (Array.isArray(d.rows) ? d.rows : []).slice(0, MAX_PLAYERS).map((r) => ({ name: cleanName(r.name), time: typeof r.time === 'number' ? r.time : null, left: !!r.left })) };
    C.pendingResults = true;
  }
  // chellenj tugaganda (marra, bekor qilish, halokat) — natijani hammaga yuboramiz
  const endAct0 = game.endAct;
  game.endAct = (ok, why, ...rest) => {
    const act = game.act, R = C.race, coop = !!(game.coopRace && act && R && act.def.id === R.id), t = act ? act.t : 0;
    endAct0(ok, why, ...rest);
    if (coop) { game.coopRace = null; const time = why === 'done' || why === 'slow' ? +t.toFixed(2) : null; const d = { t: 'rf', id: R.id, time }; bcast(d); onFinish(peer.id, d); }
  };

  // ---- do'st uyida yashash ----
  // Kod yoki taklif havolasi bilan kirgan mehmon xona egasining uyida yashaydi: egasi uy holatini (daraja, bezaklar, poliz, jamg'arma, hovlidagi gullar) yuboradi,
  // mehmonda u vaqtinchalik "mehmon ko'rinishi" bo'lib turadi (o'z saqlovidagi uy tegilmaydi va xonadan chiqqanda qaytadi). Mehmonning uy amallari egasiga
  // so'rov bo'lib boradi, egasi tekshirib o'z saqlovida bajaradi va hammaga yangi holatni yuboradi; pul/urug' mehmondan faqat egasi tasdiqlagach olinadi.
  const hm = () => game.site.places.uy.home, nearHome = (x, z) => Math.hypot(x - hm().x, z - hm().z) < HOME_R;
  const HOME_ACTS = new Set(['fund', 'dec', 'bed', 'wat', 'harv', 'fl+', 'fl-']);
  const V = (game.visit = { on: false, owner: '', oid: null, own: null, ownIn: null, lvl: -1, pend: new Map(), seq: 0, reserved: 0, near: nearHome });
  V.money = () => Math.max(0, game.state.money - V.reserved); // tasdiq kutilayotgan to'lovlar band
  V.act = (k, a, done, cost = 0) => {
    const host = C.room && C.members.get(C.room.hostPid); if (!V.on || !host) { game.toast('Xona egasi bilan aloqa yo\'q', 'bad'); return false; }
    if (cost > V.money()) { game.toast(`Pul yetmaydi (${som(cost)} so'm kerak)`, 'bad'); return false; }
    const id = ++V.seq; V.pend.set(id, { done, cost, t: performance.now() }); V.reserved += cost; sendTo(host, Object.assign({}, a, { t: 'ha', id, k })); return true;
  };
  function visitDone(id, d) {
    const p = V.pend.get(id); if (!p) return; V.pend.delete(id); V.reserved = Math.max(0, V.reserved - p.cost);
    if (d.ok) { try { p.done(d); } catch (e) { console.error(e); } game.save(); } else game.toast(String(d.why || 'Bajarilmadi').slice(0, 80), 'bad');
  }
  V.contribute = (n) => { n = Math.floor(n); const nx = HOME_LEVELS[game.state.home.lvl + 1]; if (!nx || n < 1) return false; return V.act('fund', { n }, (r) => { const u = Math.max(0, Math.min(n, r.n | 0)); game.addMoney(-u, 'Do\'st uyiga hissa'); game.audio.sfx('coin'); game.toast(r.up ? `Uy yaxshilandi! ${V.owner}ning uyiga ${som(u)} so'm qo'shdingiz 🏠` : `${V.owner}ning uyiga ${som(u)} so'm qo'shdingiz`, r.up ? 'gold' : 'good'); }, n); };
  V.decor = (id) => { const q = DECOR.find((x) => x.id === id), h = game.state.home; if (!q || h.decor[id] || h.lvl < 1) return false; return V.act('dec', { q: id }, () => { game.addMoney(-q.cost, 'Do\'st uyi bezagi'); game.audio.sfx('buy'); game.toast(`«${q.name}» ${V.owner}ning hovlisiga o'rnatildi`, 'good'); }, q.cost); };
  // xona egasi: uy holati (vaqtlar egasining o'yin vaqtida; mehmon o'zinikiga o'tkazadi)
  const homeSnap = () => { const st = game.state, h = st.home; return { t: 'hm', o: peer.id, n: C.myName(), ht: Math.round(st.stats.time), h: { lvl: h.lvl | 0, decor: Object.assign({}, h.decor), beds: h.beds.slice(0, 6), wat: h.wat.slice(0, 6), fund: h.fund | 0 }, fl: st.flowers.filter((f) => nearHome(f[0], f[1])).slice(-120).map((f) => [f[0], f[1], f[2] | 0, f[3] | 0, f[4] ? 1 : 0]), h2: h2Snap() }; };
  // uy kengaytmalari (uy2.js): mehmon xonasi, oshxona, garaj (va undagi transport), hovli jihozlari — ixcham: [bayroqlar, hovli id ro'yxati]
  const h2Snap = () => { const H = game.state.home2 || {}, y = H.yard || {}; return { g: H.guest ? 1 : 0, k: H.kitchen ? 1 : 0, gr: H.garage ? 1 : 0, y: YARD.filter((q) => y[q.id]).map((q) => q.id), gv: H.garage && H.gVeh && vehById[H.gVeh] ? H.gVeh : null }; };
  let homeSig = '';
  function sendHome(force) { if (!C.room || !C.room.isHost || !peer || !C.members.size) return; const d = homeSnap(), sig = JSON.stringify([d.h, d.fl, d.h2]); if (!force && sig === homeSig) return; homeSig = sig; bcast(d); }
  C.sendHome = sendHome;
  function hostAct(m, d) {
    const st = game.state, h = st.home, L = game.live, no = (why) => sendTo(m, { t: 'hr', id: d.id | 0, ok: 0, why });
    if (!HOME_ACTS.has(d.k)) return no("Noma'lum amal");
    const ms = performance.now(); m.hq = (m.hq || []).filter((t) => ms - t < 3000); if (m.hq.length >= 8) return no('Juda tez — biroz kuting'); m.hq.push(ms);
    let r = {}, msg = '', kind = 'good';
    if (d.k === 'fund') {
      const nx = HOME_LEVELS[h.lvl + 1], n = Math.floor(+d.n); if (!nx) return no('Uy eng yuqori darajada'); if (!(n >= 1 && n <= 100000)) return no("Noto'g'ri summa");
      const use = Math.min(n, Math.max(0, nx.cost - (h.fund || 0))); if (use < 1) return no('Jamg\'arma to\'lgan'); h.fund = (h.fund || 0) + use; r.n = use; msg = `${m.name} uyingizga ${som(use)} so'm qo'shdi`; kind = 'gold';
      if (h.fund >= nx.cost) { h.fund -= nx.cost; h.lvl++; L.applyHome(); r.up = 1; game.banner('Uy yaxshilandi!', `${nx.name} — ${m.name} yordamida`, 'gold'); game.audio.sfx('win'); const pl = game.player; if (pl.onFoot && nearHome(pl.p[0], pl.p[2])) pl.place(hm().gate[0], hm().gate[1], hm().yaw + Math.PI); }
    } else if (d.k === 'dec') {
      const q = DECOR.find((x) => x.id === d.q); if (!q || h.decor[q.id] || h.lvl < 1) return no("Bu bezakni o'rnatib bo'lmaydi"); h.decor[q.id] = 1; L.applyHome(); msg = `${m.name} hovlingizga «${q.name}» sovg'a qildi`; kind = 'gold';
    } else if (d.k === 'bed' || d.k === 'wat' || d.k === 'harv') {
      const i = d.i; if (h.lvl < 2 || !Number.isInteger(i) || i < 0 || i > 5) return no("Jo'yak topilmadi"); const t0 = h.beds[i], T0 = st.stats.time;
      if (d.k === 'bed') { if (t0) return no("Jo'yak band"); h.beds[i] = Math.max(1, Math.round(T0)); h.wat[i] = 0; msg = `${m.name} polizga urug' ekdi 🌱`; }
      else if (d.k === 'wat') { if (!t0 || h.wat[i]) return no("Sug'orish shart emas"); h.wat[i] = 1; msg = `${m.name} polizni sug'ordi 💧`; }
      else { if (!t0 || T0 - t0 < L.BEDT(i)) return no('Hosil hali pishmagan'); r.n = h.wat[i] ? 3 : 2; h.beds[i] = 0; h.wat[i] = 0; msg = `${m.name} polizdan hosil yig'di 🥕`; }
      L.drawBeds();
    } else if (d.k === 'fl+') {
      const x = +d.x, z = +d.z; if (!Number.isFinite(x) || !Number.isFinite(z) || !nearHome(x, z)) return no("Bu yerga gul ekib bo'lmaydi");
      if (st.flowers.filter((f) => nearHome(f[0], f[1])).length >= 120) return no("Hovlida joy qolmadi"); if (st.flowers.length >= 300) st.flowers.shift();
      st.flowers.push([+x.toFixed(1), +z.toFixed(1), Math.abs(d.c | 0) % 6, Math.round(st.stats.time), 1]); L.drawFlowers(); msg = `${m.name} hovlingizga gul ekdi 🌸`;
    } else if (d.k === 'fl-') {
      const i = st.flowers.findIndex((f) => f[4] && Math.abs(f[0] - d.x) < 0.25 && Math.abs(f[1] - d.z) < 0.25); if (i < 0) return no("Faqat mehmonlar ekkan gulni olib tashlash mumkin");
      st.flowers.splice(i, 1); L.drawFlowers(); msg = `${m.name} hovlidagi bir gulni olib tashladi`;
    }
    sendTo(m, Object.assign({ t: 'hr', id: d.id | 0, ok: 1 }, r)); game.toast(msg, kind); if (C.room) addLog(msg); game.save(); sendHome(true);
    if (game.ui && game.ui.screenName === 'home') game.ui.open('home');
  }
  const addLog = (text) => { C.chat.push({ name: '', text, sys: true, t: Date.now() }); if (C.chat.length > 40) C.chat.shift(); renderChat(); };
  // mehmon: egasining uyi ko'rinishi
  function visitApply(d) {
    const H = d && d.h; if (!H || typeof H !== 'object') return; const st = game.state, L = game.live, first = !V.on, swap = V.on && V.oid !== String(d.o);
    if (first) { V.own = st.home; V.ownIn = st.flowers.filter((f) => nearHome(f[0], f[1])); st.flowers = st.flowers.filter((f) => !nearHome(f[0], f[1])); V.on = true; }
    V.oid = String(d.o); V.owner = cleanName(d.n);
    const off = st.stats.time - (Number.isFinite(+d.ht) ? +d.ht : st.stats.time), tm = (t) => (+t > 0 ? Math.max(1, +t + off) : 0), arr = (a) => [0, 1, 2, 3, 4, 5].map((i) => (Array.isArray(a) && typeof a[i] === 'number' ? a[i] : 0));
    const lvl = Math.max(0, Math.min(HOME_LEVELS.length - 1, H.lvl | 0)), decor = {}; if (H.decor && typeof H.decor === 'object') for (const q of DECOR) if (H.decor[q.id]) decor[q.id] = 1;
    st.home = { lvl, decor, beds: arr(H.beds).map(tm), wat: arr(H.wat).map((v) => (v ? 1 : 0)), eggT: st.stats.time, mailT: st.stats.time, incT: st.stats.time, fund: Math.max(0, H.fund | 0) };
    const fl = (Array.isArray(d.fl) ? d.fl.slice(0, 120) : []).filter((f) => num(f, 4) && nearHome(f[0], f[1])).map((f) => [f[0], f[1], Math.abs(f[2] | 0) % 6, tm(f[3]), f[4] ? 1 : 0]);
    st.flowers = st.flowers.filter((f) => !nearHome(f[0], f[1])).concat(fl);
    if (game.uy2) { const h2 = d.h2 && typeof d.h2 === 'object' ? d.h2 : {}, yard = {}; if (Array.isArray(h2.y)) for (const id of h2.y.slice(0, 12)) if (YARD.some((q) => q.id === id)) yard[id] = 1; // egasining kengaytmalari (uy2.js U.vh — faqat ko'rinish)
      game.uy2.vh = { guest: h2.g ? 1 : 0, kitchen: h2.k ? 1 : 0, garage: h2.gr ? 1 : 0, yard, gVeh: typeof h2.gv === 'string' && vehById[h2.gv] ? h2.gv : null }; }
    const lvUp = !first && V.lvl !== lvl; V.lvl = lvl; L.applyHome(); L.drawFlowers();
    const pl = game.player; if (lvUp && pl.onFoot && Math.hypot(pl.p[0] - hm().x, pl.p[2] - hm().z) < 30) pl.place(hm().gate[0], hm().gate[1], hm().yaw + Math.PI); // yangi devorlar ichida qolmasin
    if (first) { V.spawnPending = true; trySpawn(); }
    if (swap) { V.pend.clear(); V.reserved = 0; sysMsg(`Endi ${V.owner}ning uyidasiz`); }
    if (game.ui && game.ui.screenName === 'home') game.ui.open('home');
    changed();
  }
  // mehmon xonaga kirganda — egasining uyi oldida paydo bo'ladi
  function trySpawn() {
    if (!V.spawnPending || game.mode === 'menu') return; V.spawnPending = false; const h = hm(), pl = game.player;
    if (game.act) { game.toast(`${V.owner}ning uyi xaritada yashil belgi bilan — chellenjdan keyin boring`); return; }
    const k = 4.6 * ([1, 1, -1, 2][C.room ? C.room.slot & 3 : 1]); // egasining mashinasi bilan bir joyga tushmasin — yonma-yon
    if (pl.onFoot) pl.place(h.gate[0] + Math.cos(h.yaw) * k * 0.4, h.gate[1] - Math.sin(h.yaw) * k * 0.4, h.yaw + Math.PI); else { game.car.place(h.park[0] + Math.cos(h.parkYaw) * k, h.park[1] - Math.sin(h.parkYaw) * k, h.parkYaw); game.prevP = game.car.p.slice(); }
    game.cam.snap(); game.banner(`${V.owner}ning uyidasiz`, "Bu yerda yashang va uyni birga rivojlantiring: uy belgisida [E] — hissa qo'shish, bezak, poliz", 'gold');
  }
  // xonadan chiqqanda (yoki o'zim ega bo'lsam) — o'z uyim qaytadi
  function visitEnd() {
    if (!V.on) return; const st = game.state, L = game.live;
    st.home = V.own; st.flowers = st.flowers.filter((f) => !nearHome(f[0], f[1])).concat(V.ownIn || []);
    V.on = false; V.own = V.ownIn = null; V.oid = null; V.lvl = -1; V.pend.clear(); V.reserved = 0; V.spawnPending = false; if (game.uy2) game.uy2.vh = null;
    L.applyHome(); L.drawFlowers(); game.save();
    if (game.ui && game.ui.screenName === 'home') game.ui.open('home');
  }
  function visitTick(ms) { for (const [id, p] of V.pend) if (ms - p.t > 10000) visitDone(id, { ok: 0, why: 'Xona egasi javob bermadi' }); if (V.spawnPending) trySpawn(); }
  // saqlov har doim o'yinchining O'Z uyini yozadi (mehmon ko'rinishi saqlanmaydi)
  const save1 = game.save;
  game.save = () => {
    if (!V.on) return save1(); const st = game.state, vh = st.home, vf = st.flowers;
    st.home = V.own; st.flowers = vf.filter((f) => !nearHome(f[0], f[1])).concat(V.ownIn || []);
    try { save1(); } finally { st.home = vh; st.flowers = vf; }
  };
  // ism yorlig'i sheyderi yuklanishda tayyor bo'lsin (do'st qo'shilganda o'yin qotmasin): yashirin namuna, precompile uni ham kompilyatsiya qiladi
  { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(document.createElement('canvas')), transparent: true, depthWrite: false, depthTest: false, sizeAttenuation: false, fog: false, toneMapped: false })); sp.visible = false; sp.position.set(0, -500, 0); game.scene.add(sp); }
  // ---- ovozli chat ----
  // Mikrofon faqat o'yinchi o'zi yoqqanda so'raladi. Ovoz yoqqanlar orasida PeerJS media qo'ng'iroqlari (har kim har kim bilan; kattaroq id'li tomon qo'ng'iroq qiladi,
  // o'chirsa — {t:'vo'} xabari va qo'ng'iroq yopiladi). Do'st ovozi WebAudio'da: MediaStreamSource → Gain (masofa: 15 m gacha to'liq, 150 m va undan uzoqda 25%;
  // "hamma eshitsin" — masofasiz) → karnay; Analyser — gapirayotgan belgisi. Chrome'da WebRTC ovozi WebAudio'ga oqishi uchun oqim ovozsiz <audio> ga ham ulanadi.
  const VC = (C.voice = { on: false, busy: false, mute: false, ptt: false, pttDown: false, all: false, stream: null, err: '', lvl: 0, talk: false, proc: true }); // proc — aks-sado/shovqin/balandlik ishlovi (sinovda o'chiriladi: soxta mikrofon ohangi shovqin deb o'chirilmasin)
  const VNEAR = 15, VFAR = 150, VFLOOR = 0.25, VTALK = 0.012;
  const vErr = (e) => { const n = e && e.name; return n === 'NotAllowedError' || n === 'SecurityError' ? "Mikrofonga ruxsat berilmadi — brauzer manzil satridagi 🔒 belgisidan ruxsat bering" : n === 'NotFoundError' || n === 'OverconstrainedError' ? 'Mikrofon topilmadi — ulang va qayta urining' : n === 'NotReadableError' || n === 'AbortError' ? "Mikrofon band (boshqa dastur ishlatyapti) yoki ishlamayapti" : 'Mikrofonni yoqib bo\'lmadi'; };
  VC.canUse = () => (window.isSecureContext === false ? "Ovozli chat faqat xavfsiz (https) sayt orqali ishlaydi" : !(navigator.mediaDevices && navigator.mediaDevices.getUserMedia) ? "Brauzeringiz mikrofonni qo'llamaydi" : typeof RTCPeerConnection !== 'function' ? "Brauzeringiz ovozli ulanishni qo'llamaydi (WebRTC)" : '');
  const micOn = () => VC.on && (VC.ptt ? VC.pttDown : !VC.mute);
  const applyMic = () => { if (VC.stream) for (const t of VC.stream.getAudioTracks()) t.enabled = micOn(); };
  VC.micLive = micOn;
  VC.start = async () => {
    if (VC.on || VC.busy || !C.room) return VC.on;
    const why = VC.canUse(); if (why) { VC.err = why; game.toast(why, 'bad'); changed(); return false; }
    VC.busy = true; VC.err = ''; changed(); try { game.audio.init(); } catch { /* */ }
    let s = null; try { s = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: VC.proc, noiseSuppression: VC.proc, autoGainControl: VC.proc }, video: false }); } catch (e) { VC.err = vErr(e); }
    VC.busy = false;
    if (!s || !C.room) { if (s) s.getTracks().forEach((t) => t.stop()); if (VC.err) game.toast(VC.err, 'bad'); changed(); return false; }
    VC.stream = s; VC.on = true; VC.pttDown = false;
    for (const t of s.getAudioTracks()) t.onended = () => { if (VC.stream === s) { voiceOff(); game.toast('Mikrofon uzildi — ovozli chat o\'chdi', 'bad'); } };
    const ctx = game.audio.ctx; if (ctx) { try { VC.src = ctx.createMediaStreamSource(s); VC.an = ctx.createAnalyser(); VC.an.fftSize = 2048; VC.src.connect(VC.an); } catch { VC.src = VC.an = null; } }
    applyMic(); bcast({ t: 'vo', on: 1 }); for (const m of C.members.values()) reconcile(m);
    game.toast(VC.ptt ? 'Ovozli chat yoqildi — gapirish uchun [5] ni bosib turing' : 'Ovozli chat yoqildi 🎙 — [5] mikrofonni o\'chiradi/yoqadi', 'good'); changed(); return true;
  };
  function voiceOff(silent) {
    if (!VC.on && !VC.stream) return; VC.on = false; VC.talk = false; VC.lvl = 0;
    for (const m of C.members.values()) endCall(m);
    if (VC.stream) VC.stream.getTracks().forEach((t) => { t.onended = null; t.stop(); }); VC.stream = null;
    if (VC.src) { try { VC.src.disconnect(); } catch { /* */ } } VC.src = VC.an = null;
    if (!silent && C.room) bcast({ t: 'vo', on: 0 }); changed();
  }
  VC.stop = () => { voiceOff(); game.toast("Ovozli chat o'chirildi"); };
  VC.toggle = () => (VC.on ? (VC.stop(), Promise.resolve(false)) : VC.start());
  VC.setMute = (b) => { VC.mute = !!b; applyMic(); changed(); };
  VC.key = () => { if (!VC.on) { VC.start(); return; } VC.setMute(!VC.mute); game.toast(VC.mute ? "Mikrofon o'chirildi 🔇" : 'Mikrofon yoqildi 🎙'); };
  VC.setPtt = (b) => { VC.ptt = !!b; VC.pttDown = false; applyMic(); changed(); };
  VC.setAll = (b) => { VC.all = !!b; changed(); };
  VC.muteFriend = (pid, b) => { const m = C.members.get(pid); if (!m) return; m.vmute = b == null ? !m.vmute : !!b; changed(); };
  // do'st ovozining balandligi masofaga qarab (0,25…1)
  VC.volOf = (pid) => { const m = C.members.get(pid); if (!m) return 0; if (VC.all || !m.remote.shown) return 1; const [x, z] = m.remote.where(), p = game.player.onFoot ? game.player.p : game.car.p, d = Math.hypot(x - p[0], z - p[2]);
    return d <= VNEAR ? 1 : d >= VFAR ? VFLOOR : 1 - (1 - VFLOOR) * (d - VNEAR) / (VFAR - VNEAR); };
  function reconcile(m) {
    if (C.members.get(m.pid) !== m) return; const want = VC.on && !!VC.stream && m.vr;
    if (!want) { if (m.call) endCall(m); return; }
    if (!m.call && peer && !peer.destroyed && peer.id > m.pid) { let call = null; try { call = peer.call(m.pid, VC.stream, { metadata: { room: C.room && C.room.code } }); } catch (e) { (C.errs.length > 30 && C.errs.shift(), C.errs).push('call: ' + (e && e.message)); } if (call) hookCall(m, call); }
  }
  function hookCall(m, call) {
    m.call = call; m.callT = performance.now();
    call.on('stream', (s) => attachVoice(m, call, s));
    const gone = () => { if (m.call !== call) return; m.call = null; detachVoice(m); setTimeout(() => reconcile(m), 2000); };
    call.on('close', gone); call.on('error', (e) => { (C.errs.length > 30 && C.errs.shift(), C.errs).push('ovoz: ' + (e && e.type)); gone(); });
  }
  // kiruvchi qo'ng'iroq: faqat xonadagi do'stdan va ovozli chat yoqilgan bo'lsa (do'st ma'lumoti hali kelmagan bo'lsa — biroz kutamiz)
  function onCall(call, n = 0) {
    const m = C.members.get(call.peer);
    if (!m && n < 6 && C.room) { setTimeout(() => onCall(call, n + 1), 600); return; }
    if (!m || !VC.on || !VC.stream) { try { call.close(); } catch { /* */ } return; }
    if (m.call && m.call !== call) { const old = m.call; m.call = null; detachVoice(m); try { old.close(); } catch { /* */ } }
    m.vr = true; try { call.answer(VC.stream); } catch { try { call.close(); } catch { /* */ } return; } hookCall(m, call);
  }
  function attachVoice(m, call, s) {
    if (m.call !== call || m.vs === s) return; detachVoice(m); m.vs = s;
    const a = new Audio(); a.muted = true; a.autoplay = true; a.srcObject = s; a.play().catch(() => {}); m.au = a; // Chrome: busiz WebRTC ovozi WebAudio'ga kelmaydi
    const ctx = game.audio.ctx;
    if (!ctx) { a.muted = false; return; } // WebAudio yo'q — oddiy ijro (masofasiz)
    try { m.vsrc = ctx.createMediaStreamSource(s); m.vg = ctx.createGain(); m.vg.gain.value = 0; m.van = ctx.createAnalyser(); m.van.fftSize = 2048; m.vsrc.connect(m.van); m.vsrc.connect(m.vg); m.vg.connect(ctx.destination); if (ctx.state === 'suspended') ctx.resume().catch(() => {}); } catch { a.muted = false; }
    changed();
  }
  function detachVoice(m) {
    if (m.au) { try { m.au.pause(); m.au.srcObject = null; } catch { /* */ } m.au = null; }
    for (const k of ['vsrc', 'vg', 'van']) if (m[k]) { try { m[k].disconnect(); } catch { /* */ } m[k] = null; }
    m.vs = null; m.vlvl = 0; m.vtalk = false; if (m.remote) m.remote.setVoice(m.vr && VC.on ? 1 : 0);
  }
  function endCall(m) { const c = m.call; m.call = null; detachVoice(m); if (c) { try { c.close(); } catch { /* */ } } }
  const vbuf = new Float32Array(2048), rms = (an) => { an.getFloatTimeDomainData(vbuf); let s = 0; for (let i = 0; i < vbuf.length; i++) s += vbuf[i] * vbuf[i]; return Math.sqrt(s / vbuf.length); };
  // ovoz darajasi, gapirish belgisi va masofa — kadr siklidan tashqarida (yashirin varaqda ham), 10 marta/s
  setInterval(() => {
    if (!C.room) return; const ms = performance.now(), ctx = game.audio.ctx, pulse = 2 + ((ms / 260) & 1);
    if (VC.an) { const l = micOn() ? rms(VC.an) : 0; VC.lvl = l; if (l > VTALK) VC.talkT = ms; VC.talk = micOn() && ms - (VC.talkT || 0) < 350; } else { VC.lvl = 0; VC.talk = false; }
    for (const m of C.members.values()) {
      if (m.van) { const l = rms(m.van); m.vlvl = l; m.vpk = Math.max(l, (m.vpk || 0) * 0.97); if (l > VTALK) m.vtalkT = Math.max(m.vtalkT || 0, ms); } else m.vlvl = 0;
      m.vtalk = !!m.van && ms - (m.vtalkT || 0) < 350;
      if (m.vg && ctx) m.vg.gain.setTargetAtTime(m.vmute ? 0 : VC.volOf(m.pid) * (game.audio.vol == null ? 1 : game.audio.vol), ctx.currentTime, 0.12);
      m.remote.setVoice(m.vr && VC.on ? (m.vtalk && !m.vmute ? pulse : 1) : 0);
      if (m.call && !m.vs && ms - m.callT > 20000) { endCall(m); reconcile(m); } // qo'ng'iroq ulanmay qoldi — qaytadan
    }
  }, 100);
  // bosib gapirish: [5] (yoki ekrandagi tugma) bosib turilganda mikrofon ochiq
  game.hooks.push(() => { if (!VC.on || !VC.ptt) return; const d = game.mode === 'play' && game.input.down('Digit5'); if (d !== VC.pttDown) { VC.pttDown = d; applyMic(); } });
  // sinov va tashxis uchun: har do'st bo'yicha ovoz holati; qabul qilingan baytlar — WebRTC statistikasidan
  VC.info = () => [...C.members.values()].map((m) => ({ pid: m.pid, vr: !!m.vr, call: !!m.call, live: !!(m.vs && m.vs.getAudioTracks().some((t) => t.readyState === 'live')), lvl: m.vlvl || 0, pk: m.vpk || 0, talk: !!m.vtalk, vol: m.vg ? m.vg.gain.value : null, mute: !!m.vmute }));
  VC.bytesIn = async (pid) => { const m = C.members.get(pid), pc = m && m.call && m.call.peerConnection; if (!pc) return 0; let b = 0; (await pc.getStats()).forEach((r) => { if (r.type === 'inbound-rtp' && (r.kind === 'audio' || r.mediaType === 'audio')) b += r.bytesReceived || 0; }); return b; };
  // ---- do'st oldiga ko'chish ----
  C.teleportTo = (pid) => {
    const m = C.members.get(pid); if (!m || !m.remote.shown) return false;
    if (game.act) { game.toast('Avval chellenjni tugating yoki bekor qiling ([X])', 'bad'); return false; }
    if (C.ride) { game.toast('Avval mashinadan tushing [F]', 'bad'); return false; }
    const [x, z] = m.remote.where(), yaw = m.remote.yaw(), pl = game.player;
    if (pl.onFoot) pl.place(x - Math.sin(yaw) * 2.5 + Math.cos(yaw) * 1.5, z - Math.cos(yaw) * 2.5 - Math.sin(yaw) * 1.5, yaw);
    else { game.car.place(x - Math.sin(yaw) * 9, z - Math.cos(yaw) * 9, yaw); game.prevP = game.car.p.slice(); }
    game.cam.snap(); game.toast(`${m.name} yoniga ko'chdingiz`, 'good'); return true;
  };

  // ======================= BIRGA O'YNASH: yo'lovchi, birga ish, choyxona, pul o'tkazish, "Shu yerga kel" =======================
  // Hamma amal — so'rov/javob: kim egasi bo'lsa (haydovchi, ish egasi, pul oluvchi), o'sha tekshiradi. Pul faqat o'z saqlovida o'zgaradi va bankka yoziladi.
  const pl = game.player, IN = game.interior, IS = () => game.ish, H2 = () => game.hayot2, N = (m) => esc(m.name), toast = (t, k) => game.toast(t, k);
  const rl = (o, key, n, ms) => { const t = performance.now(), q = (o[key] = (o[key] || []).filter((x) => t - x < ms)); if (q.length >= n) return false; q.push(t); return true; }; // tezlik chegarasi
  const gift = (n, why) => { game.noWeek = true; try { game.addMoney(n, why); } finally { game.noWeek = false; } }; // o'tkazma/qaytarilgan pul — hafta daromadiga kirmaydi
  const myPos = () => (IN.inside && IN.ret ? [IN.ret[0], IN.ret[1]] : pl.onFoot ? [pl.p[0], pl.p[2]] : [game.car.p[0], game.car.p[2]]);
  const MAXT = 50000; // bitta o'tkazma chegarasi (so'm)
  // nur ustunlari: do'st ishidagi manzillar va do'stlar belgisi (chiroq emas — sahnadagi chiroqlar soni o'zgarmaydi)
  const beamGeo = new THREE.CylinderGeometry(0.45, 0.45, 40, 10, 1, true);
  const mkBeam = (col) => { const b = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.38, depthWrite: false, fog: false })); b.visible = false; b.frustumCulled = false; game.scene.add(b); return b; };
  const jobBeams = [0, 1, 2, 3, 4, 5].map(() => mkBeam(0xffd23a)), pingBeams = SLOT_COLORS.map((c) => mkBeam(new THREE.Color(c)));
  const beamAt = (b, x, z) => { b.visible = true; b.position.set(x, T.ground(x, z, 1e9).y + 20, z); };

  // ---------- 1. Do'st mashinasida yo'lovchi ----------
  // Yo'lovchi piyoda qoladi, lekin harakatsiz: joyi har kadr haydovchi mashinasidagi o'rindiqqa qo'yiladi, kamera o'sha mashinaga ergashadi (main.js → C.rideCam).
  // Hamma o'yinchida yo'lovchi haydovchi modelidagi o'rindiqda (rig.js makeRider — haydovchi kabi poza, yo'lovchining kiyimida) chiziladi.
  const NOSEAT = new Set(['velo', 'kart', 'bolid']), REAR = new Set(['xetch', 'sedan', 'ralli', 'limuzin', 'jip']);
  const seatsOf = (md) => (!md || !md._rd || NOSEAT.has(md.id) ? 0 : Math.abs(md._rd.x || 0) > 0.1 ? (REAR.has(md.id) ? 3 : 1) : 1);
  C.seatsOf = seatsOf;
  function seatPose(md, s) { // o'rindiq: x — modeldagi joy, d — makeRider ma'lumoti (son, qo'l, oyoq)
    const o = md._rd, hy = o.hip[1], hz = o.hip[2], fy = o.foot[1], fz = o.foot[2];
    if (Math.abs(o.x || 0) > 0.1) { const rear = s > 0, z = rear ? hz - 0.9 : hz, x = rear ? (s === 1 ? -o.x : o.x) * 0.9 : -o.x;
      return { x, d: { hip: [0, hy, z], lean: o.lean || -0.15, hand: [0.17, hy + 0.12, z + 0.34], foot: [0.16, fy, rear ? z + Math.min(0.55, fz - hz) : fz], knee: 0.16 } }; }
    const z = hz - 0.42; return { x: 0, d: { hip: [0, hy + 0.06, z], lean: o.lean || 0.1, hand: [0.2, hy + 0.3, z + 0.3], foot: [Math.max(0.16, o.foot[0] || 0), fy + 0.04, z + 0.12], knee: 0.18 } };
  }
  const paxModels = new Set();
  function paxRig(md, s, look, hat) { const P = seatPose(md, s), r = makeRider(P.d, lookRigOpts(look)); if (hat) setHat(r, hat); const w = new THREE.Group(); w.position.x = P.x; w.add(r.root); md.tilt.add(w); return { w, r }; }
  function dropPax(o) { if (o.w.parent) o.w.parent.remove(o.w); o.r.mesh.geometry.dispose(); if (o.r.mesh.skeleton) o.r.mesh.skeleton.dispose(); }
  // har kadr: qaysi mashinada kim o'tiribdi (yo'lovchining o'z paketidagi ri/se bo'yicha) — modellarga o'rindiq qo'shiladi/olinadi
  function syncPax() {
    if (rideReq && performance.now() - rideReq.t > 8000) rideReq = null; // haydovchi javob bermadi
    const want = new Map(), me = C.myId();
    const add = (drv, pid, s, look, hat) => { const dm = drv === me ? null : C.members.get(drv), md = drv === me ? game.carModel : dm && dm.remote.shown ? dm.remote.model : null; if (!md || s >= seatsOf(md)) return;
      let w = want.get(md); if (!w) want.set(md, (w = new Map())); for (const v of w.values()) if (v.s === s) return; w.set(pid, { s, look, hat, key: s + '|' + JSON.stringify(look || null) + '|' + (hat || '') }); };
    for (const m of C.members.values()) { const R = m.remote; if (R.ri && R.shown && R.foot) add(R.ri, m.pid, R.se, R.look, R.hat); }
    if (C.ride) add(C.ride.pid, me, C.ride.seat, game.state.look, game.state.hat);
    for (const md of want.keys()) paxModels.add(md);
    for (const md of [...paxModels]) { const cur = md._pax || (md._pax = new Map()), w = want.get(md);
      for (const [pid, o] of cur) { const n = w && w.get(pid); if (!n || n.key !== o.key) { dropPax(o); cur.delete(pid); } }
      if (w) for (const [pid, n] of w) if (!cur.has(pid)) cur.set(pid, Object.assign(paxRig(md, n.s, n.look, n.hat), { key: n.key }));
      if (!cur.size) paxModels.delete(md); }
  }
  C.ride = null; C.pax = new Map(); let rideReq = null; // pax — men haydovchiman: yo'lovchi → o'rindiq
  const pu = pl.update; pl.update = function (...a) { if (C.ride) return; return pu.apply(this, a); }; // yo'lovchi o'zi yurmaydi
  C.rideReq = (pid) => {
    const m = C.members.get(pid), R = m && m.remote;
    if (!R || !R.shown || R.foot || !R.model) { toast("Do'stingiz hozir transportda emas", 'bad'); return false; }
    if (C.ride || !pl.onFoot || pl.lock > 0 || IN.inside || game.act || (IS() && IS().cur && !(C.job && !C.job.own))) { toast("Hozir o'tirib bo'lmaydi", 'bad'); return false; }
    if (!seatsOf(R.model)) { toast(`${R.model.v.name}da yo'lovchi o'rni yo'q`, 'bad'); return false; }
    if (Math.hypot(R.pos.x - pl.p[0], R.pos.z - pl.p[2]) > R.model.spec.len / 2 + 4) { toast('Mashinaga yaqinroq boring', 'bad'); return false; }
    rideReq = { pid, t: performance.now() }; sendTo(m, { t: 'rq' }); return true;
  };
  function onRideReq(m) { // haydovchi: o'rin beramizmi
    const no = (why) => sendTo(m, { t: 'ra', ok: 0, why }), car = game.car;
    if (!rl(m, 'rqq', 4, 5000)) return no('Juda tez — biroz kuting');
    if (pl.onFoot) return no(`${C.myName()} hozir transportda emas`); if (game.act) return no('Haydovchi chellenjda');
    const n = seatsOf(game.carModel); if (!n) return no(`${game.carModel.v.name}da yo'lovchi o'rni yo'q`);
    const [x, z] = m.remote.where(); if (!m.remote.foot || Math.hypot(x - car.p[0], z - car.p[2]) > car.spec.len / 2 + 5) return no('Mashinaga yaqinroq keling');
    if (car.speed > 4) return no("Mashina to'xtaganda o'tiring");
    let s = C.pax.has(m.pid) ? C.pax.get(m.pid) : -1; if (s < 0) { const used = new Set(C.pax.values()); for (let i = 0; i < n; i++) if (!used.has(i)) { s = i; break; } }
    if (s < 0) return no("Bo'sh o'rin qolmadi");
    C.pax.set(m.pid, s); m.paxT = performance.now(); sendTo(m, { t: 'ra', ok: 1, s }); toast(`${N(m)} mashinangizga o'tirdi 🚗`, 'good'); game.audio.sfx('door'); changed();
  }
  function onRideAns(m, d) {
    if (!rideReq || rideReq.pid !== m.pid) return; rideReq = null;
    C.rideMsg = String(d.why || '').slice(0, 80); if (!d.ok) { toast(esc(C.rideMsg || "O'tirib bo'lmadi"), 'bad'); return; }
    const s = d.s | 0; if (s < 0 || s > 2 || C.ride || !pl.onFoot || IN.inside || game.act) { sendTo(m, { t: 'rx' }); return; }
    C.ride = { pid: m.pid, seat: s, footT: 0 }; pl.lock = 1e9; pl.lockAnim = 'sit'; pl.lockFn = null; pl.sit = false; pl.emote = null; pl.v[0] = pl.v[1] = pl.v[2] = 0; pl.rig.root.visible = false; pl.lamp.intensity = 0;
    game.cam.snap(); game.audio.sfx('door'); toast(`${N(m)}ning mashinasidasiz — [F] tushish`, 'good'); changed();
  }
  C.rideOff = (why) => {
    const R = C.ride; if (!R) return; C.ride = null; const m = C.members.get(R.pid), md = m && m.remote.model;
    pl.lock = 0; pl.lockAnim = null; pl.rig.root.visible = true; let x = pl.p[0], z = pl.p[2], yaw = pl.yaw;
    if (md && m.remote.shown) { const P = seatPose(md, R.seat), sd = P.x >= 0 ? 1 : -1; md.root.updateWorldMatrix(true, false); _v.set(P.x + sd * (md.spec.wid / 2 + 0.9), 0, P.d.hip[2]); md.root.localToWorld(_v); x = _v.x; z = _v.z; yaw = m.remote.yaw(); }
    pl.place(x, z, yaw); game.cam.snap(); game.audio.sfx('door'); if (m) sendTo(m, { t: 'rx' }); toast(why ? esc(why) : 'Mashinadan tushdingiz'); changed();
  };
  // yo'lovchi kamerasi uchun haydovchi mashinasi (camera.js kutgan maydonlar)
  const RT = { fwd: 0, speed: 0, v: [0, 0, 0], yaw: 0, R: new Float64Array(9), nitroOn: false, rpm: 0, spec: null }, _m4 = new THREE.Matrix4();
  C.rideCam = () => {
    const m = C.ride && C.members.get(C.ride.pid), Rm = m && m.remote; if (!Rm || !Rm.model || !Rm.shown) return null; const c = Rm.lastPkt && Rm.lastPkt.c, e = _m4.makeRotationFromQuaternion(Rm.q).elements;
    RT.v[0] = c ? c[7] : 0; RT.v[1] = c ? c[8] : 0; RT.v[2] = c ? c[9] : 0; RT.speed = Math.hypot(RT.v[0], RT.v[2]); RT.fwd = c ? c[11] : 0; RT.yaw = Rm.yaw(); RT.spec = Rm.model.spec;
    const M = RT.R; M[0] = e[0]; M[1] = e[4]; M[2] = e[8]; M[3] = e[1]; M[4] = e[5]; M[5] = e[9]; M[6] = e[2]; M[7] = e[6]; M[8] = e[10];
    return { tgt: RT, cp: Rm.pos, len: Rm.model.spec.len, hgt: Rm.model.spec.hgt };
  };
  function rideFrame(dt) {
    const R = C.ride; if (!R) return; const m = C.members.get(R.pid);
    if (!pl.onFoot) { C.ride = null; pl.lock = 0; pl.lockAnim = null; if (m) sendTo(m, { t: 'rx' }); changed(); return; } // boshqa yo'l bilan o'z transportiga o'tirdi
    if (!m) return C.rideOff('Haydovchi bilan aloqa uzildi');
    const Rm = m.remote; if (Rm.foot) { R.footT += dt; if (R.footT > 0.6) return C.rideOff(`${m.name} mashinadan tushdi — siz ham tushdingiz`); } else R.footT = 0;
    if (!Rm.model || R.seat >= seatsOf(Rm.model)) return C.rideOff("Bu transportda o'rin yo'q");
    const px = Rm.model._pax && Rm.model._pax.get(C.myId()); if (px) { px.r.root.updateWorldMatrix(true, false); px.r.root.getWorldPosition(_v); } else _v.copy(Rm.pos);
    pl.p[0] = _v.x; pl.p[1] = _v.y; pl.p[2] = _v.z; pl.yaw = Rm.yaw(); pl.v[0] = pl.v[1] = pl.v[2] = 0; pl.anim = 'sit'; pl.rig.root.visible = false; pl.lamp.intensity = 0;
  }
  function paxFrame() { // haydovchi: tushib qolsam — yo'lovchilar ham tushadi; ketgan yo'lovchi o'rni bo'shaydi
    if (!C.pax.size) return; const now = performance.now(), me = C.myId();
    for (const [pid] of C.pax) { const m = C.members.get(pid); if (!m || (m.remote.ri !== me && now - (m.paxT || 0) > 3000)) C.pax.delete(pid); }
    if (pl.onFoot || seatsOf(game.carModel) < 1) { for (const pid of C.pax.keys()) { const m = C.members.get(pid); if (m) sendTo(m, { t: 'rk' }); } C.pax.clear(); changed(); }
  }

  // ---------- 2. Birga ish (non yetkazish, taksi, dalada o'rim — ish.js) ----------
  // Ish egasi hakam: jamoa (ko'pi bilan 3 do'st), har soniyada holat (manzillar, vaqt, bajarilgan), do'stlar amalini tekshiradi; har to'lov teng bo'linadi (ish.js pay → IS.split).
  C.job = null; C.jobInv = null; let jobSig = '', jobT = 0, jobLast = null;
  const stripTags = (h) => String(h || '').replace(/<[^>]*>/g, '').slice(0, 120);
  const ownJob = (id) => (C.job = { own: true, id, team: new Map(), carry: new Set(), inv: new Map() });
  const jobTeam = () => (C.job && C.job.own ? [...C.job.team.keys()].filter((p) => C.members.has(p)) : []);
  if (game.ish) game.ish.split = (n, why) => {
    const J = C.job, cur = game.ish.cur; if (!J || !J.own || !cur || cur.id !== J.id) return n; const team = jobTeam(); if (!team.length) return n;
    const k = team.length + 1, sh = Math.floor(n / k); if (sh < 1) return n;
    for (const p of team) sendTo(C.members.get(p), { t: 'jp', n: sh, why: String(why || JOBS[J.id][1]).slice(0, 40) });
    return n - sh * (k - 1);
  };
  function jobState() {
    const J0 = IS().cur, D = IS().dbg, pts = []; let cut = null, ld = 0;
    if (J0.id === 'non') for (const q of J0.pts) if (!q.ok) pts.push([r2(q.x), r2(q.z)]);
    if (J0.id === 'dala') { for (const q of J0.pick) pts.push([r2(q.x), r2(q.z), 0, q.k]); if (D.field.cart) pts.push([r2(D.field.cart.x), r2(D.field.cart.z), 1]); cut = D.field.clumps.filter((q) => q.cut).map((q) => q.k); ld = J0.done; }
    if (J0.id === 'taksi') { const tg = J0.stage === 'pick' ? J0.a : J0.b; if (tg) pts.push([r2(tg.x), r2(tg.z)]); }
    const team = jobTeam(); return { t: 'js', id: J0.id, team, line: stripTags(J0.line()), tm: J0.t != null ? Math.round(J0.t) : null, done: J0.done, pts: pts.slice(0, 8), cut, ld, open: team.length < 3 ? 1 : 0 };
  }
  function ownerJobFrame(dt) {
    const cur = IS() && IS().cur;
    if (jobLast && (!cur || cur.id !== jobLast)) { bcast({ t: 'je', id: jobLast }); if (C.job && C.job.own) C.job = null; jobLast = null; jobSig = ''; changed(); }
    if (!cur || !C.members.size || (C.job && !C.job.own)) return; jobLast = cur.id; if (C.job && C.job.own && C.job.id !== cur.id) C.job = null;
    jobT += dt; if (jobT < 0.25) return; const s = jobState(), sig = JSON.stringify(s); if (sig !== jobSig || jobT > 1.5) { jobSig = sig; jobT = 0; bcast(s); }
  }
  C.jobInvite = () => {
    const cur = IS() && IS().cur; if (!cur || !C.members.size) { toast('Avval ish boshlang — keyin do\'stlarni chaqiring', 'bad'); return false; }
    if (!C.job || !C.job.own || C.job.id !== cur.id) ownJob(cur.id); const t = performance.now(); for (const m of C.members.values()) if (!C.job.team.has(m.pid)) C.job.inv.set(m.pid, t);
    bcast({ t: 'ji', id: cur.id }); toast(`Do'stlar «${JOBS[cur.id][1]}» ishiga chaqirildi 🤝`, 'good'); return true;
  };
  C.jobJoin = (pid) => {
    const m = C.members.get(pid); if (!m || !m.job) { toast("Do'stingizda hozir ish yo'q", 'bad'); return false; }
    if (IS().cur) { toast("Avval o'z ishingizni tugating [X]", 'bad'); return false; } if (game.act) { toast('Avval chellenjni tugating', 'bad'); return false; } if (C.job) { toast('Siz allaqachon birga ishdasiz', 'bad'); return false; }
    sendTo(m, { t: 'jq', id: m.job.id }); return true;
  };
  C.jobLeave = () => { const J = C.job; if (!J || J.own) return; const m = C.members.get(J.owner); if (m) sendTo(m, { t: 'jl' }); jobEnd(`Ishdan chiqdingiz · ulushingiz ${som(J.got)} so'm`); };
  C.jobAct = (k, a) => { const J = C.job, m = J && !J.own && C.members.get(J.owner); if (!m) return false; sendTo(m, Object.assign({ t: 'ja', k }, a || {})); return true; };
  function jobEnd(msg) { const J = C.job; if (!J || J.own) return; C.job = null; for (const b of jobBeams) b.visible = false; if (game.way && game.way.coop) game.setWaypoint(null); game.banner('Birga ish tugadi', esc(msg), J.got ? 'gold' : ''); game.audio.sfx(J.got ? 'win' : 'click'); changed(); }
  function onJobReq(m, d) {
    const no = (why) => sendTo(m, { t: 'jw', ok: 0, why }), J0 = IS().cur;
    if (!rl(m, 'jqq', 4, 5000)) return no('Juda tez — biroz kuting');
    if (!J0 || J0.id !== d.id) return no('Bu ish allaqachon tugagan'); if (game.act) return no('Ish egasi chellenjda');
    const J = C.job && C.job.own && C.job.id === J0.id ? C.job : ownJob(J0.id);
    if (J.team.has(m.pid)) return sendTo(m, { t: 'jw', ok: 1, id: J.id });
    if (J.team.size >= 3) return no("Jamoa to'la (4 kishi)");
    const inv = J.inv.get(m.pid), [x, z] = m.remote.where(), [mx, mz] = myPos();
    if (!(inv && performance.now() - inv < 120000) && !(m.remote.shown && Math.hypot(x - mx, z - mz) < 25)) return no('Ish egasi yoniga boring yoki taklifni kuting');
    J.team.set(m.pid, m.name); sendTo(m, { t: 'jw', ok: 1, id: J.id }); jobSig = ''; jobT = 1; toast(`${N(m)} ishingizga qo'shildi — daromad teng bo'linadi 🤝`, 'good'); game.audio.sfx('check'); changed();
  }
  function onJobWel(m, d) {
    if (!d.ok) { toast(esc(String(d.why || "Qo'shilib bo'lmadi").slice(0, 80)), 'bad'); return; }
    if (!JOBS[d.id] || IS().cur || (C.job && C.job.owner !== m.pid)) { sendTo(m, { t: 'jl' }); return; }
    if (!C.job) { C.job = { own: false, id: d.id, owner: m.pid, oname: m.name, st: null, got: 0, carry: false }; C.jobInv = null; game.banner(`${JOBS[d.id][0]} Birga ish`, `${esc(m.name)} bilan «${JOBS[d.id][1]}» — daromad teng bo'linadi`, 'gold'); game.audio.sfx('start'); changed(); }
  }
  const okPts = (a) => (Array.isArray(a) ? a.slice(0, 8).filter((p) => num(p, 2) && Math.abs(p[0]) < 3300 && Math.abs(p[1]) < 3300) : []);
  function onJobState(m, d) {
    if (!JOBS[d.id]) return; const team = Array.isArray(d.team) ? d.team.slice(0, 4).map(String) : [];
    m.job = { id: d.id, open: !!d.open, t: performance.now() };
    const J = C.job; if (!J || J.own || J.owner !== m.pid) return;
    if (!team.includes(C.myId()) || d.id !== J.id) return jobEnd(`${m.name} ishidan chiqarildingiz`);
    J.st = { id: d.id, line: String(d.line || '').slice(0, 120), tm: typeof d.tm === 'number' && Number.isFinite(d.tm) ? d.tm : null, done: d.done | 0, pts: okPts(d.pts), n: team.length + 1 };
    if (d.id === 'dala' && !IS().cur && Array.isArray(d.cut)) { const D = IS().dbg, f = D.field, set = new Set(d.cut.slice(0, 200).map((k) => k | 0)); let ch = false; for (const q of f.clumps) { const c = set.has(q.k) ? 1 : 0; if (q.cut !== c) { q.cut = c; ch = true; } } if (ch && f.draw) f.draw(); D.drawLoad(Math.max(0, Math.min(6, d.ld | 0))); }
  }
  function onJobInv(m, d) { if (!JOBS[d.id] || !rl(m, 'jiq', 3, 10000) || C.job) return; C.jobInv = { pid: m.pid, id: d.id, t: performance.now() }; toast(`🤝 ${N(m)} sizni «${JOBS[d.id][1]}» ishiga chaqiryapti — [O] → Qo'shilish yoki yoniga borib [E]`, 'gold'); game.audio.sfx('check'); changed(); }
  function onJobAct(m, d) {
    const J = C.job, J0 = IS().cur, D = IS().dbg, no = (why) => sendTo(m, { t: 'jr', ok: 0, why });
    if (!J || !J.own || !J.team.has(m.pid) || !J0 || J0.id !== J.id) return no('Ish topilmadi');
    if (!rl(m, 'jaq', 6, 3000)) return no('Juda tez');
    const [x, z] = m.remote.where(), near = (px, pz, r) => m.remote.shown && Math.hypot(x - px, z - pz) < r;
    if (d.k === 'non' && J0.id === 'non') { const q = J0.pts.find((p) => !p.ok && Math.abs(p.x - d.x) < 1 && Math.abs(p.z - d.z) < 1); if (!q) return no('Bu uyga non allaqachon berilgan'); if (!near(q.x, q.z, 11)) return no('Uyga yaqinroq boring');
      sendTo(m, { t: 'jr', ok: 1, k: 'non' }); toast(`🍞 ${N(m)} nonni topshirdi`, 'good'); D.deliver(q); }
    else if (d.k === 'reap' && J0.id === 'dala') { const q = J0.pick.find((p) => p.k === (d.i | 0)); if (!q) return no("Bu bug'doy allaqachon o'rilgan"); if (J.carry.has(m.pid)) return no("Avval bog'ni aravaga olib boring"); if (!near(q.x, q.z, 4)) return no("Bug'doyga yaqinroq boring");
      q.cut = 1; D.field.draw(); J0.pick.splice(J0.pick.indexOf(q), 1); J.carry.add(m.pid); if (!J0.carry) D.showMarks(J0.pick); sendTo(m, { t: 'jr', ok: 1, k: 'reap' }); }
    else if (d.k === 'load' && J0.id === 'dala') { const c = D.field.cart; if (!J.carry.has(m.pid)) return no("Qo'lingizda bog' yo'q"); if (!c || !near(c.x, c.z, 4.5)) return no('Aravaga yaqinroq boring');
      J.carry.delete(m.pid); J0.done++; D.drawLoad(J0.done); const n = 18; J0.earn += n; sendTo(m, { t: 'jr', ok: 1, k: 'load' }); D.pay(n, "Dalada o'rim"); toast(`🌾 ${N(m)} bog'ni aravaga ortdi · ${J0.done}/${J0.goal}`, 'good');
      if (J0.done >= J0.goal) { const b = 70; J0.earn += b; D.pay(b, "Dalada o'rim — bonus"); D.finish(true, `Hosil birga yig'ildi! +${b} · jami ${som(J0.earn)} so'm`); } }
    else return no("Noma'lum amal");
    jobSig = ''; jobT = 1;
  }
  function onJobRes(m, d) {
    const J = C.job; if (!J || J.own || J.owner !== m.pid) return;
    C.jobMsg = String(d.why || '').slice(0, 80); if (!d.ok) { toast(esc(C.jobMsg || 'Bajarilmadi'), 'bad'); return; }
    if (d.k === 'non') { game.audio.sfx('pop'); toast("🍞 Non topshirildi! «Rahmat, bolam!»", 'good'); } else if (d.k === 'reap') { J.carry = true; game.audio.sfx('rustle'); toast("Bog'ni aravaga olib boring 🌾"); } else if (d.k === 'load') { J.carry = false; toast("🌾 Bog' aravada!", 'good'); }
  }
  function onJobPay(m, d) {
    const J = C.job, n = d.n; if (!J || J.own || J.owner !== m.pid || !Number.isInteger(n) || n < 1 || n > 600 || J.got + n > 3000) return; // ulush: aqlga sig'adigan chegara
    J.got += n; game.addMoney(n, String(d.why || JOBS[J.id][1]).replace(/[\u0000-\u001f<>]/g, '').slice(0, 40) + ' (birga)'); game.audio.sfx('coin'); toast(`+${n} so'm — ulushingiz (${N(m)} bilan) 🤝`, 'good');
  }
  function onJobEnd(m, d) { m.job = null; const J = C.job; if (J && !J.own && J.owner === m.pid) jobEnd(`${m.name} bilan ish tugadi · ulushingiz ${som(J.got)} so'm`); }
  // do'st ishidagi manzillar (nur, xarita nuqtasi, yo'l ko'rsatkich) va HUD
  const jh = document.createElement('div'); jh.className = 'panel tc jobhud'; jh.style.display = 'none';
  function memberJobFrame() {
    const J = C.job, st = J && !J.own ? J.st : null, mine = IS() && IS().cur;
    if (st && mine) { C.jobLeave(); return; } // o'z ishini boshladi — do'st ishidan chiqadi
    if (!jh.parentNode && game.ui) game.ui.hud.appendChild(jh);
    const show = !!st && !game.act; if (jh.style.display !== (show ? '' : 'none')) jh.style.display = show ? '' : 'none';
    jobBeams.forEach((b, i) => { const p = show && st.pts[i]; if (p && !(st.id === 'dala' && (J.carry ? !p[2] : p[2]))) beamAt(b, p[0], p[1]); else b.visible = false; });
    if (!show) return;
    const L = game.live, [mx, mz] = myPos(); let best = null, bd = 1e9; for (const p of st.pts) { if (st.id === 'dala' && (J.carry ? !p[2] : p[2])) continue; L.dots.push([p[0], p[1], '#ffd23a']); const dd = Math.hypot(p[0] - mx, p[1] - mz); if (dd < bd) { bd = dd; best = p; } }
    if (best && (!game.way || (game.way.coop && (game.way.x !== best[0] || game.way.z !== best[1])))) { game.setWaypoint(best[0], best[1], true); game.way.coop = 1; }
    const k = JSON.stringify([st.tm, st.done, st.line, J.got, J.carry]); if (jh._k === k) return; jh._k = k;
    const mm = st.tm != null ? `${Math.floor(Math.max(0, st.tm) / 60)}:${String(Math.max(0, st.tm) % 60).padStart(2, '0')}` : '';
    jh.innerHTML = `<h3>${JOBS[st.id][0]} ${JOBS[st.id][1]} · birga</h3>${mm ? `<div class="timer${st.tm < 20 ? ' low' : ''}">${mm}</div>` : ''}<div class="ln">${J.carry ? "Bog'ni aravaga olib boring 🌾" : esc(st.line)}</div><div class="ln" style="opacity:.75;font-size:12px">${esc(J.oname)} bilan (${st.n} kishi) · ulushingiz ${som(J.got)} so'm · <kbd>X</kbd> — chiqish</div>`;
  }
  // do'st ishida [E] amallari (piyoda) va transportda nonni derazadan uzatish
  function jobOffers(offer, px, pz) {
    const J = C.job, st = J && !J.own && J.st; if (!st || IS().cur) return;
    if (st.id === 'non') for (const p of st.pts) { const d = Math.hypot(p[0] - px, p[1] - pz); if (d < 2.8) offer(d - 0.3, "<kbd>E</kbd> Nonni topshirish 🍞 (birga)", () => { pl.yaw = Math.atan2(p[0] - pl.p[0], p[1] - pl.p[2]); pl.act('bend', 0.9, () => C.jobAct('non', { x: p[0], z: p[1] }), 'basket'); }); }
    if (st.id === 'dala') for (const p of st.pts) { const d = Math.hypot(p[0] - px, p[1] - pz) - (p[2] ? 1 : 0);
      if (!J.carry && !p[2] && d < 2.2) offer(d - 0.3, "<kbd>E</kbd> Bug'doyni o'rish 🌾 (birga)", () => { pl.yaw = Math.atan2(p[0] - pl.p[0], p[1] - pl.p[2]); pl.act('swing', 1.3, () => C.jobAct('reap', { i: p[3] | 0 }), 'sickle'); });
      if (J.carry && p[2] && d < 2.2) offer(d - 0.3, "<kbd>E</kbd> Bog'ni aravaga ortish", () => pl.act('bend', 0.8, () => C.jobAct('load'))); }
  }
  const carJob = () => { const J = C.job, st = J && !J.own && J.st; if (!st || st.id !== 'non' || pl.onFoot || game.car.speed > 3 || IS().cur) return null; const c = game.car.p; for (const p of st.pts) if (Math.hypot(p[0] - c[0], p[1] - c[2]) < 8) return p; return null; };

  // ---------- 3. Choyxona: bir stolda — bir-birini va taomlarni ko'rish, "Men to'layman" ----------
  // Har kim o'z stoli (stol kaliti), o'rindig'i, stoldagi taomlari va hisobini (shu stolda buyurtma qilgani) yuboradi; to'lovchi do'stlarning hisobini qoplaydi:
  // to'lovchidan pul darhol olinadi, do'st tekshiradi (hisob mos, shu stolda) va o'z buyurtmasi pulini qaytarib oladi; rad etilsa yoki javob kelmasa — to'lovchiga qaytadi.
  const tab = { k: null, s: null, sum: 0, sig: '', t: 0 }, xfer = new Map(), xdone = new Map(); let xseq = (Math.random() * 1e9) | 0; // xdone: qabul qilingan so'rovlar javobi (takror kelsa pul ikki marta tushmaydi)
  const kOf = (a, b) => Math.round(a * 10) + ':' + Math.round(b * 10), KRE = /^-?\d{1,4}:-?\d{1,4}$/;
  const seatTab = (sp) => { if (IN.inside !== 'cafe' || !sp || sp.k !== 'csit' || !sp.table) return; const k = kOf(sp.table[0], sp.table[1]); if (tab.k && k !== tab.k) tab.sum = 0; tab.k = k; tab.s = kOf(sp.lx, sp.lz); };
  { const o0 = H2().order; H2().order = (id, ...r) => { const ok = o0(id, ...r); if (ok) { seatTab(game.hayot && game.hayot.seat); const it = MENU.find((q) => q[0] === id); if (it && tab.k) tab.sum = Math.min(5000, tab.sum + it[3]); } return ok; }; }
  function cafeFrame(dt) {
    const HY = game.hayot, sp = HY && HY.seat, inCafe = IN.inside === 'cafe';
    if (!inCafe) { tab.k = tab.s = null; tab.sum = 0; } else seatTab(sp);
    const ds = inCafe ? H2().dishes.map((q) => q.id).slice(0, 4) : [], sig = JSON.stringify([tab.k, tab.s, ds, tab.sum]); tab.t += dt;
    if (C.members.size && (sig !== tab.sig || (tab.k && tab.t > 3))) { tab.sig = sig; tab.t = 0; bcast({ t: 'tb', k: tab.k, s: tab.s, ds, sum: tab.sum }); }
    // do'stlarning stoldagi taomlari (faqat choyxona ichida, do'st haqiqatan shu o'rindiq yonida bo'lsa)
    const Cf = IN.X.cafe;
    for (const m of C.members.values()) { const tb = m.tb, R = m.remote; let n = 0;
      const sp2 = inCafe && Cf && tb && tb.s && R.foot && R.fshown ? Cf.seats.find((q) => q.k === 'csit' && kOf(q.lx, q.lz) === tb.s) : null;
      if (sp2 && Math.hypot(R.fpos.x - sp2.x, R.fpos.z - sp2.z) < 1.6) { const tx = Cf.o[0] + sp2.table[0], tz = Cf.o[2] + sp2.table[1], a = Math.atan2(-Math.sin(sp2.yaw), -Math.cos(sp2.yaw)), c = Math.cos(a), s = Math.sin(a);
        for (const id of tb.ds) { const mesh = dishFor(m, n, id), sl = SLOTS[n]; mesh.position.set(tx + sl[0] * c + sl[1] * s, Cf.o[1] + sp2.top, tz - sl[0] * s + sl[1] * c); mesh.rotation.y = a + Math.PI; mesh.visible = true; n++; } }
      if (m.dm) for (let i = n; i < m.dm.length; i++) if (m.dm[i]) m.dm[i].m.visible = false; }
  }
  const SLOTS = [[0, 0.16], [-0.24, 0.12], [0.24, 0.12], [0, -0.12]];
  function dishFor(m, i, id) { m.dm = m.dm || []; let o = m.dm[i]; if (o && o.id !== id) { if (o.m.parent) o.m.parent.remove(o.m); o.m.geometry.dispose(); o = null; }
    if (!o) { const g = new GB(2300); g.jit = 0; H2().DISH[id](g); const mesh = new THREE.Mesh(g.build(), MAT.flat); mesh.castShadow = true; IN.X.cafe.grp.add(mesh); o = m.dm[i] = { id, m: mesh }; } return o.m; }
  function onTab(m, d) {
    const k = typeof d.k === 'string' && KRE.test(d.k) ? d.k : null, s = typeof d.s === 'string' && KRE.test(d.s) ? d.s : null, sum = Number.isInteger(d.sum) && d.sum >= 0 && d.sum <= 5000 ? d.sum : 0;
    const ds = Array.isArray(d.ds) ? d.ds.slice(0, 4).filter((id) => typeof id === 'string' && MENU.some((q) => q[0] === id) && H2().DISH[id]) : [];
    const was = m.tb && m.tb.k; m.tb = { k, s, ds, sum };
    if (k && k !== was && k === tab.k && IN.inside === 'cafe') toast(`🍵 ${N(m)} stolingizga o'tirdi — menyuda «Men to'layman»`, 'good');
  }
  C.tableMates = () => (tab.k && IN.inside === 'cafe' ? [...C.members.values()].filter((m) => m.tb && m.tb.k === tab.k) : []);
  C.tab = tab;
  C.payTable = () => {
    const list = C.tableMates().filter((m) => m.tb.sum > 0), tot = list.reduce((a, m) => a + m.tb.sum, 0);
    if (!list.length) { toast("Do'stlaringiz hali hech narsa buyurtma qilmagan", 'bad'); return false; }
    if (V.money() < tot) { toast(`Pul yetmaydi (${som(tot)} so'm kerak)`, 'bad'); return false; }
    for (const m of list) { const n = m.tb.sum, id = ++xseq; game.addMoney(-n, `Choyxona: ${m.name} uchun`); const q = { t: 'tq', id, n, k: tab.k }; xfer.set(id, { n, pid: m.pid, t: performance.now(), kind: 'tab', q, tr: 0 }); sendTo(m, q); m.tb.sum = 0; }
    game.audio.sfx('buy'); toast(`Stol hisobini siz to'ladingiz — ${som(tot)} so'm 🍵`, 'gold'); changed(); return true;
  };
  function onTabPay(m, d) {
    const n = d.n, id = d.id | 0, no = (why) => sendTo(m, { t: 'tr', id, ok: 0, why }); if (again(m, id)) return;
    if (!rl(m, 'tqq', 6, 10000)) return no('Juda tez');
    if (IN.inside !== 'cafe' || !tab.k || d.k !== tab.k) return no(`${C.myName()} boshqa stolda`);
    if (!Number.isInteger(n) || n < 1 || n > 5000 || n !== tab.sum) return no("Hisob o'zgardi — qayta urining");
    tab.sum = 0; gift(n, `Choyxona: ${m.name} to'ladi`); okTo(m, { t: 'tr', id, ok: 1, n }); game.audio.sfx('coin'); toast(`🍵 ${N(m)} stol hisobini to'ladi — ${som(n)} so'm qaytdi`, 'gold');
  }

  // ---------- 4. Do'stga pul o'tkazish ----------
  C.sendMoney = (pid, n) => {
    const m = C.members.get(pid); n = Math.floor(+n); if (!m) return false;
    if (!(n >= 1 && n <= MAXT)) { toast(`O'tkazma 1 dan ${som(MAXT)} so'mgacha`, 'bad'); return false; }
    if (V.money() < n) { toast('Pul yetmaydi', 'bad'); return false; }
    if (!rl(C, 'mtq', 5, 60000)) { toast("Juda tez — bir daqiqada ko'pi bilan 5 ta o'tkazma", 'bad'); return false; }
    const id = ++xseq; game.addMoney(-n, `O'tkazma → ${m.name}`); const q = { t: 'mt', id, n }; xfer.set(id, { n, pid, t: performance.now(), kind: 'mt', q, tr: 0 }); sendTo(m, q); game.audio.sfx('coin'); toast(`💸 ${N(m)}ga ${som(n)} so'm yuborilmoqda…`); changed(); return true;
  };
  function onMoney(m, d) {
    const n = d.n, id = d.id | 0; if (again(m, id)) return; if (!Number.isInteger(n) || n < 1 || n > MAXT || !rl(m, 'mtr', 6, 60000)) return sendTo(m, { t: 'mr', id, ok: 0, why: "O'tkazma qabul qilinmadi" });
    gift(n, `O'tkazma ← ${m.name}`); okTo(m, { t: 'mr', id, ok: 1, n }); game.audio.sfx('coin'); toast(`💸 ${N(m)} sizga ${som(n)} so'm o'tkazdi`, 'gold'); addLog(`${m.name} sizga ${som(n)} so'm o'tkazdi`);
  }
  // qabul qiluvchi: muvaffaqiyatli javob 2 daqiqa eslab qolinadi — javob yo'qolib so'rov qayta kelsa, pul qayta qo'shilmaydi, o'sha javob qayta yuboriladi
  const xkey = (m, id) => `${m.pid}:${id}`, okTo = (m, r) => { xdone.set(xkey(m, r.id), { r, t: performance.now() }); sendTo(m, r); };
  const again = (m, id) => { const o = xdone.get(xkey(m, id)); if (!o) return false; sendTo(m, o.r); return true; };
  function onXferRes(m, d) { // o'tkazma yoki stol hisobi javobi
    const id = d.id | 0, p = xfer.get(id); if (!p || p.pid !== m.pid) return; xfer.delete(id);
    if (d.ok) toast(p.kind === 'mt' ? `✓ ${N(m)}ga ${som(p.n)} so'm o'tkazildi` : `${N(m)}: «Rahmat!» 🍵`, 'good');
    else { gift(p.n, p.kind === 'mt' ? "O'tkazma qaytdi" : 'Choyxona: qaytarildi'); toast(`${esc(String(d.why || 'Rad etildi').slice(0, 80))} — ${som(p.n)} so'm qaytdi`, 'bad'); }
    changed();
  }
  // yuboruvchi: javob kelmasa so'rov 4 s da qayta yuboriladi (do'st onlayn bo'lsa, 3 martagacha); pul faqat do'st chiqib ketsa yoki umuman javob bermasa qaytadi
  setInterval(() => { const t = performance.now(); for (const [k, o] of xdone) if (t - o.t > 120000) xdone.delete(k);
    for (const [id, p] of xfer) { if (t - p.t < 4000) continue; const m = C.members.get(p.pid); if (m && m.conn && m.conn.open && p.tr < 3) { p.tr++; p.t = t; sendTo(m, p.q); continue; } xfer.delete(id); gift(p.n, p.kind === 'mt' ? "O'tkazma qaytdi" : 'Choyxona: qaytarildi'); toast(`Do'stingiz javob bermadi — ${som(p.n)} so'm qaytdi`, 'bad'); changed(); } }, 1000);

  // ---------- 5. "Shu yerga kel" belgisi ([8]) ----------
  const pings = new Map(); // pid → { x, z, t }
  C.ping = () => {
    if (!C.room) return false; if (!rl(C, 'pgq', 1, 2500)) { toast('Biroz kuting'); return false; }
    const [x, z] = myPos(), d = { t: 'pg', x: r2(x), z: r2(z) }; bcast(d); pings.set(C.myId(), { x: d.x, z: d.z, t: performance.now() });
    game.audio.sfx('check'); toast("📍 Do'stlarga «Shu yerga kel!» belgisi yuborildi"); changed(); return true;
  };
  function onPing(m, d) {
    if (!num([d.x, d.z], 2) || Math.abs(d.x) > 3300 || Math.abs(d.z) > 3300 || !rl(m, 'pgr', 3, 5000)) return;
    pings.set(m.pid, { x: d.x, z: d.z, t: performance.now() }); game.audio.sfx('check'); toast(`📍 ${N(m)}: «Shu yerga kel!» — xaritada belgi`, 'gold');
    if (!game.way && !game.act && !(IS() && IS().cur) && !C.job) { game.setWaypoint(d.x, d.z); game.way.ping = 1; } changed();
  }
  C.pingList = () => { const t = performance.now(), out = []; for (const [pid, p] of pings) { const me = pid === C.myId(), m = C.members.get(pid); if (!me && !m) continue; out.push({ pid, me, name: me ? C.myName() : m.name, slot: me ? C.room.slot : m.slot, x: p.x, z: p.z, ago: Math.round((t - p.t) / 1000) }); } return out; };
  C.goPing = (pid) => { const p = pings.get(pid); if (!p) return false; game.setWaypoint(p.x, p.z); game.way.ping = 1; toast('Yo\'l ko\'rsatildi 📍', 'good'); return true; };
  function pingDots(dots) {
    const t = performance.now(); let i = 0;
    for (const [pid, p] of pings) { if (t - p.t > 90000) { pings.delete(pid); continue; } const me = pid === C.myId(), m = C.members.get(pid); if (!me && !m) { pings.delete(pid); continue; }
      const slot = me ? C.room.slot : m.slot, nm = me ? 'Siz' : m.name; dots.push([p.x, p.z, SLOT_COLORS[slot % 4], '📍 ' + nm, pid]); if (i < pingBeams.length) { const b = pingBeams[slot % 4]; beamAt(b, p.x, p.z); b._used = true; } i++; }
    for (const b of pingBeams) { if (!b._used) b.visible = false; b._used = false; }
  }

  // ---------- umumiy: xabarlar, chiqish, kadr ----------
  function birgaData(m, d) {
    switch (d.t) {
      case 'rq': onRideReq(m); break; case 'ra': onRideAns(m, d); break;
      case 'rx': if (C.pax.delete(m.pid)) { toast(`${N(m)} mashinadan tushdi`); changed(); } break;
      case 'rk': if (C.ride && C.ride.pid === m.pid) C.rideOff(`${m.name} mashinadan tushdi — siz ham tushdingiz`); break;
      case 'ji': onJobInv(m, d); break; case 'jq': onJobReq(m, d); break; case 'jw': onJobWel(m, d); break; case 'js': onJobState(m, d); break;
      case 'ja': onJobAct(m, d); break; case 'jr': onJobRes(m, d); break; case 'jp': onJobPay(m, d); break; case 'je': onJobEnd(m, d); break;
      case 'jl': if (C.job && C.job.own && C.job.team.delete(m.pid)) { C.job.carry.delete(m.pid); toast(`${N(m)} ishdan chiqdi`); jobSig = ''; changed(); } break;
      case 'tb': onTab(m, d); break; case 'tq': onTabPay(m, d); break; case 'tr': case 'mr': onXferRes(m, d); break; case 'mt': onMoney(m, d); break;
      case 'pg': onPing(m, d); break;
    }
  }
  function birgaDrop(m) { // do'st chiqdi / aloqa uzildi
    if (C.ride && C.ride.pid === m.pid) C.rideOff(`${m.name} bilan aloqa uzildi — mashinadan tushdingiz`);
    if (rideReq && rideReq.pid === m.pid) rideReq = null; C.pax.delete(m.pid); pings.delete(m.pid);
    if (C.job && C.job.own) { C.job.team.delete(m.pid); C.job.carry.delete(m.pid); } else if (C.job && C.job.owner === m.pid) jobEnd(`${m.name} chiqib ketdi — birga ish tugadi · ulushingiz ${som(C.job.got)} so'm`);
    if (C.jobInv && C.jobInv.pid === m.pid) C.jobInv = null;
    if (m.dm) for (const o of m.dm) if (o) { if (o.m.parent) o.m.parent.remove(o.m); o.m.geometry.dispose(); } m.dm = null;
  }
  function birgaReset() { // xonadan chiqish
    if (C.ride) C.rideOff(); rideReq = null; C.pax.clear(); if (C.job && !C.job.own) jobEnd('Xonadan chiqdingiz'); C.job = null; C.jobInv = null; jobLast = null; pings.clear();
    for (const b of [...jobBeams, ...pingBeams]) b.visible = false; jh.style.display = 'none'; tab.sig = '';
    for (const md of paxModels) { if (md._pax) { for (const o of md._pax.values()) dropPax(o); md._pax.clear(); } } paxModels.clear();
  }
  let sitShift = false;
  function birgaFrame(dt) {
    syncPax(); rideFrame(dt); paxFrame(); ownerJobFrame(dt); cafeFrame(dt);
    // bir joyga (topchan, divan) ikki kishi o'tirsa — kattaroq id'li biroz yonga suriladi (ustma-ust tushmasin)
    if (pl.onFoot && pl.sit && !C.ride) { if (!sitShift) for (const m of C.members.values()) { const R = m.remote; if (m.pid > C.myId() || !R.foot || !R.fshown) continue;
      if (Math.hypot(R.fpos.x - pl.p[0], R.fpos.z - pl.p[2]) < 0.45 && Math.abs(R.fpos.y - pl.p[1]) < 1) { pl.p[0] += Math.cos(pl.yaw) * 0.62; pl.p[2] -= Math.sin(pl.yaw) * 0.62; sitShift = true; break; } } } else sitShift = false;
  }
  // [E] takliflari va kadr (living.js L.extra / L.useE / L.update — eng tashqi o'ram)
  { const L = game.live, ex0 = L.extra, ue0 = L.useE, up0 = L.update;
    L.extra = (offer, px, pz, p) => { if (C.ride) return; ex0(offer, px, pz, p); if (!C.room || IN.inside) return;
      if (pl.onFoot) for (const m of C.members.values()) { const R = m.remote; if (!R.shown || R.foot || !R.model || !seatsOf(R.model)) continue; const d = Math.hypot(R.pos.x - px, R.pos.z - pz) - R.model.spec.len / 2; if (d < 2.2) offer(d + 0.05, `<kbd>E</kbd> ${N(m)}ning mashinasiga o'tirish 🚗`, () => C.rideReq(m.pid)); }
      if (!C.job && !(IS() && IS().cur)) for (const m of C.members.values()) { const j = m.job; if (!j || !j.open || performance.now() - j.t > 4000) continue; const [x, z] = m.remote.where(), d = Math.hypot(x - px, z - pz); if (d < 3) offer(d, `<kbd>E</kbd> ${N(m)}ning «${JOBS[j.id][1]}» ishiga qo'shilish 🤝`, () => C.jobJoin(m.pid)); }
      jobOffers(offer, px, pz); };
    L.useE = () => { if (C.ride) return; const p = carJob(); if (p) { C.jobAct('non', { x: p[0], z: p[1] }); return; } ue0(); };
    L.update = (dt) => { up0(dt); if (!C.room) return; memberJobFrame();
      if (C.ride) { const m = C.members.get(C.ride.pid); L.prompt = `<kbd>F</kbd> ${m ? N(m) + 'ning mashinasidan' : 'Mashinadan'} tushish`; } else if (!L.prompt && carJob()) L.prompt = '<kbd>E</kbd> Nonni derazadan uzatish 🍞 (birga)'; };
  }
  // choyxona menyusiga "Do'stlar stolingizda" kartasi (oyna qayta chizilsa ham qoladi)
  game.hooks.push(function wrapCafe() {
    const ui = game.ui; if (!ui || !ui.s_choyxona || ui.s_choyxona._coop) return; const s0 = ui.s_choyxona;
    ui.s_choyxona = function (w, d, btn, x) { s0.call(this, w, d, btn, x); if (!C.room) return; const card = document.createElement('div'); card.className = 'card coop-tab'; card.style.marginTop = '10px';
      const draw = () => { const ms = C.tableMates(); if (!ms.length) { card.innerHTML = `<h4>👥 Do'stlar bilan</h4><p class="sub">Do'stingiz shu stolga o'tirsa, uning hisobini ham to'lay olasiz.</p>`; return; }
        const tot = ms.reduce((a, m) => a + m.tb.sum, 0);
        card.innerHTML = `<h4>👥 Stolingizda: ${ms.map((m) => esc(m.name)).join(', ')}</h4><p>${ms.map((m) => `${esc(m.name)}: ${m.tb.ds.map((id) => MENU.find((q) => q[0] === id)[2]).join(' ') || '—'} · hisob ${som(m.tb.sum)} so'm`).join('<br>')}</p>`;
        const b = document.createElement('button'); b.textContent = tot ? `Men to'layman — ${som(tot)} so'm` : "Men to'layman"; b.disabled = !tot || V.money() < tot; b.onclick = () => { if (C.payTable()) draw(); }; card.appendChild(b); };
      const keep = () => { if (!w.contains(card)) w.appendChild(card); }; draw(); keep(); new MutationObserver(keep).observe(w, { childList: true }); const iv = setInterval(() => { if (!w.isConnected) return clearInterval(iv); draw(); }, 1500); };
    ui.s_choyxona._coop = true;
  });

  // ---- har kadr ----
  const flags = () => { const g = game, foot = g.player.onFoot, s = g.input.state, m = g.carModel; let f = 0; if (m.spot && m.spot.intensity > 0) f |= 1; if (!foot && ((s.brake > 0.1 && g.car.fwd > 1) || s.handbrake)) f |= 2; if (foot) f |= 4; if (g.car.nitroOn) f |= 8; return f; };
  // n — tartib raqami, ms — yuboruvchi vaqti, i — turibdi (siyrak paketlar); transport/rang/shapka — o'zgarganda va har 10-paketda
  function packet(idle) {
    const g = game, c = g.car, pl = g.player, foot = pl.onFoot, a = g.act;
    const d = { t: 's', n: ++seq, ms: Math.round(performance.now()), c: [r2(c.p[0]), r2(c.p[1]), r2(c.p[2]), r3(c.q[0]), r3(c.q[1]), r3(c.q[2]), r3(c.q[3]), r2(c.v[0]), r2(c.v[1]), r2(c.v[2]), r3(c.steer || 0), r2(c.fwd || 0)], f: flags() };
    if (idle) d.i = 1;
    const v = g.carModel.id, k = g.carModel.paintMat.color.getHex(), hat = g.state.hat || null, lk = lookCode(g.state.look), mk = v + k + hat + lk; if (mk !== metaK || ++metaN >= 10) { metaK = mk; metaN = 0; d.v = v; d.k = k; d.hat = hat; if (lk) d.lk = lk; }
    if (foot) { d.h = [r2(pl.p[0]), r2(pl.p[1]), r2(pl.p[2]), r3(pl.yaw), r2(pl.v[0]), r2(pl.v[2]), r2(pl.v[1]), pl.grounded ? 1 : 0, pl.swim ? 1 : 0]; d.a = pl.anim || 'idle'; }
    if (g.coopRace && a && a.def.type === 'race') d.rp = (a.my || 0) + a.cpi * 0.001;
    if (C.ride) { d.ri = C.ride.pid; d.se = C.ride.seat; } // do'st mashinasida yo'lovchi
    return d;
  }
  // boshqa o'yinchilar transporti bilan yumshoq to'qnashuv (faqat o'z transportimiz suriladi)
  function bump() {
    if (C.ride) return; // yo'lovchi do'st mashinasi ichida
    const g = game, car = g.car, pl = g.player, foot = pl.onFoot, mr = car.spec.wid * 0.5 + 0.35;
    for (const m of C.members.values()) {
      const R = m.remote; if (!R.shown || !R.model) continue; const rr = R.model.spec.wid * 0.5 + 0.35;
      if (!foot) { const p = car.p, dx = p[0] - R.pos.x, dz = p[2] - R.pos.z, d = Math.hypot(dx, dz), lim = mr + rr;
        if (d < lim && d > 0.01 && Math.abs(p[1] - R.pos.y) < 2.2) { const nx = dx / d, nz = dz / d, pen = lim - d; p[0] += nx * pen; p[2] += nz * pen; g.prevP[0] += nx * pen; g.prevP[2] += nz * pen;
          const rv = car.v[0] * nx + car.v[2] * nz - ((R.lastPkt && R.lastPkt.c[7]) || 0) * nx - ((R.lastPkt && R.lastPkt.c[9]) || 0) * nz; if (rv < 0) { car.v[0] -= nx * rv * 1.3; car.v[2] -= nz * rv * 1.3; if (-rv > 4) g.audio.sfx('hit', 0.5); } } }
      else { const p = pl.p, dx = p[0] - R.pos.x, dz = p[2] - R.pos.z, d = Math.hypot(dx, dz), lim = rr + 0.4; if (d < lim && d > 0.01 && Math.abs(p[1] - (R.pos.y - (R.model.spec.com || 0))) < 2) { p[0] += (dx / d) * (lim - d); p[2] += (dz / d) * (lim - d); } }
    }
  }
  game.hooks.push((dt) => {
    if (C.pendingResults && !(game.ui && game.ui.screenName)) { C.pendingResults = false; game.ui.open('coopres', C.lastResults); }
    if (!C.room) { if (game.netDots) game.netDots = null; return; }
    const now = performance.now() / 1000, n = C.members.size;
    for (const m of C.members.values()) m.remote.update(dt, now);
    birgaFrame(dt); // yo'lovchilar o'rindiqda, yo'lovchi kamerasi joyi, birga ish, choyxona, belgilar
    if (game.mode === 'play' || game.mode === 'ui') bump();
    // xaritadagi nuqtalar va poygadagi o'rin
    const dots = []; for (const m of C.members.values()) if (m.remote.shown) { const [x, z] = m.remote.where(); dots.push([x, z, SLOT_COLORS[m.slot % 4], m.name, m.pid]); } pingDots(dots); game.netDots = dots;
    if (game.coopRace && game.act && C.race) { const a = game.act, my = (a.my || 0) + a.cpi * 0.001; let ahead = 0; for (const p of C.race.pids) { if (p === peer.id) continue; const m = C.members.get(p); if (C.race.fin[p] != null) ahead++; else if (m && m.remote.rp > my) ahead++; } game.coopRace.place = 1 + ahead; }
    if (!n || !peer) return;
    { const g = game, pl = g.player, idle = (pl.onFoot ? Math.hypot(pl.v[0], pl.v[1], pl.v[2]) < 0.05 && !pl.emote && (pl.lock || 0) <= 0 : Math.hypot(g.car.v[0], g.car.v[1], g.car.v[2]) < 0.05), R = idle ? RATE_IDLE : RATE_MOVE;
      acc += dt; if (acc >= R || (!idle && acc >= RATE_MOVE)) { acc = 0; const d = packet(idle), str = JSON.stringify(d); let old = null; for (const m of C.members.values()) { if (m.v < 2) sendTo(m, old || (old = Object.assign({ v: g.carModel.id, k: g.carModel.paintMat.color.getHex(), hat: g.state.hat || null }, d))); else sendState(m, d, str); } } } // eski versiya (v1) har paketda transportni kutadi
    if (C.room.isHost && (homeT += dt) > 2) { homeT = 0; sendHome(false); }
    if (C.room.isHost && (hourT += dt) > 3) { hourT = 0; bcast({ t: 'h', h: game.act && game.act.hourBak != null ? game.act.hourBak : game.hour }); }
  });
  // aloqa nazorati kadr siklidan tashqarida: brauzer varag'i yashirilganda (kadrlar to'xtaydi) ham ping ketadi va aloqa uzilmaydi; 45 soniya jim qolgan o'yinchi — chiqib ketgan
  setInterval(() => {
    if (!C.room || !peer) return; const ms = performance.now();
    if (ms - lastPing > 3000) { lastPing = ms; bcast({ t: 'pi', x: ms }); }
    for (const m of C.members.values()) { const ch = m.conn && m.conn._fast; if (ch && ch.readyState === 'open' && m.v >= 2 && !fastOk(m)) { try { ch.send('{"t":"fp"}'); } catch { /* */ } } } // tez kanalni tekshirish
    visitTick(ms);
    for (const m of [...C.members.values()]) if (!m.lost && ms - m.last > 45000) { (C.errs.length > 30 && C.errs.shift(), C.errs).push('jim: ' + m.pid); try { m.conn.close(); } catch { /* */ } onClose(m.conn); }
  }, 1000);

  // taklif havolasi: ?xona=KOD — sahifa ochilganda xonaga qo'shilish taklif qilinadi
  C.inviteCode = (() => { try { return normCode(new URLSearchParams(location.search).get('xona') || ''); } catch { return ''; } })();
  return C;
}
