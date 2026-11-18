// Do'stlar bilan birga o'ynash (2–4 kishi): PeerJS (WebRTC) orqali to'g'ridan-to'g'ri ulanish, xona kodi va taklif havolasi, boshqa o'yinchilarning transporti va qahramoni,
// chat va tez emojilar, birga poyga, umumiy kun vaqti, do'st oldiga ko'chish. Xona egasi (host) — umumiy narsalar uchun hakam; u chiqsa, keyingi o'yinchi egalikni oladi.
// Har o'yinchi o'z transportini o'zi hisoblaydi va soniyasiga 15 marta qisqa holat yuboradi; boshqalar uni silliq oraliqlab (interpolatsiya) chizadi. Bitta o'yinchi fizikasi o'zgarmaydi.
import * as THREE from 'three';
import { Peer } from 'peerjs';
import * as T from './terrain.js';
import { buildVehicle, syncWheels, vehById } from './vehicles.js';
import { makeRig, poseRig, setHat, HAT_LIST } from './rig.js';
import { fmtTime } from './game.js';

export const MAX_PLAYERS = 4;
const RATE = 1 / 15, DELAY = 0.12, ALPH = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789', PFX = 'safarxona-';
export const SLOT_COLORS = ['#ffd23a', '#4fb0ff', '#ff6aa0', '#6ee07a'];
const SHIRTS = [0xf0b83a, 0x2f7fd0, 0xd8406a, 0x3f9a58], EMOJI = ['👋', '😂', '👍', '🔥', '😎', '🏁', '❤️', '😮'];
const HATS = new Set(HAT_LIST.map((h) => h[0]));
export const QUICK_EMOJI = EMOJI;
export const roomPeerId = (code) => PFX + code.toLowerCase();
export function newCode() { const a = new Uint8Array(6); (globalThis.crypto || window.crypto).getRandomValues(a); return [...a].map((x) => ALPH[x % ALPH.length]).join(''); }
// Kiritilgan kod yoki butun havola (…?xona=ABC123) → toza kod
export function normCode(s) { s = String(s || ''); const m = /[?&]xona=([A-Za-z0-9]+)/.exec(s); if (m) s = m[1]; s = s.toUpperCase().replace(/[^A-Z0-9]/g, ''); return [...s].filter((c) => ALPH.includes(c)).join('').slice(0, 6); }
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const cleanName = (s) => String(s || '').replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim().slice(0, 24) || 'Sayyoh';
const r2 = (v) => Math.round(v * 100) / 100, r3 = (v) => Math.round(v * 1000) / 1000;
const hashStr = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };
const num = (a, n) => Array.isArray(a) && a.length >= n && a.every((v) => typeof v === 'number' && Number.isFinite(v));

// ---------- boshqa o'yinchi (ko'rinish) ----------
class Remote {
  constructor(game, m) {
    this.g = game; this.m = m; this.buf = []; this.veh = null; this.model = null; this.paint = null; this.hat = null; this.foot = false;
    this.pos = new THREE.Vector3(); this.q = new THREE.Quaternion(); this.fpos = new THREE.Vector3(); this.fyaw = 0; this.shown = false; this.anim = 'idle';
    this.fake = { wheels: [0, 1, 2, 3].map(() => ({ len: 0, spin: 0, ly: 0 })), steer: 0, fwd: 0 };
    this.rig = makeRig({ seed: 300 + (hashStr(m.pid) % 5000), shirt: SHIRTS[m.slot % 4], height: 1, build: 1 }); this.rig.root.visible = false; game.scene.add(this.rig.root);
    this.ctl = { vx: 0, vz: 0, vy: 0, grounded: true, swim: false, energy: 100, moveYaw: null, camYaw: 0 };
    this.tagC = document.createElement('canvas'); this.tagC.width = 512; this.tagC.height = 128; this.tagTex = new THREE.CanvasTexture(this.tagC); this.tagTex.colorSpace = THREE.SRGBColorSpace;
    this.tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.tagTex, transparent: true, depthWrite: false, depthTest: false, sizeAttenuation: false, fog: false, toneMapped: false }));
    this.tag.scale.set(0.26, 0.065, 1); this.tag.renderOrder = 999; this.tag.visible = false; game.scene.add(this.tag); this.drawTag();
  }
  drawTag(emoji) {
    const c = this.tagC.getContext('2d'), m = this.m, col = SLOT_COLORS[m.slot % 4]; c.clearRect(0, 0, 512, 128);
    const txt = (emoji ? emoji + ' ' : '') + m.name; c.font = '800 52px system-ui, sans-serif'; const w = Math.min(500, c.measureText(txt).width + 56), x = 256 - w / 2;
    c.fillStyle = 'rgba(12,16,28,.78)'; c.beginPath(); c.roundRect(x, 20, w, 80, 40); c.fill(); c.lineWidth = 6; c.strokeStyle = col; c.stroke();
    c.fillStyle = '#fff'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(txt, 256, 62, 470); this.tagTex.needsUpdate = true;
  }
  emote(e) { this.drawTag(e); clearTimeout(this._et); this._et = setTimeout(() => this.drawTag(), 4000); }
  setVeh(id, paint) {
    if (!vehById[id]) id = 'jip';
    if (id !== this.veh) {
      if (this.model) { this.g.scene.remove(this.model.root); }
      const m = buildVehicle(id, { lite: true }); m.root.remove(m.spot); m.root.remove(m.spot.target); // chiroqlar soni o'zgarmasin (sheyderlar qayta kompilyatsiya bo'lmasin)
      m.root.visible = false; this.g.scene.add(m.root); this.model = m; this.veh = id; this.paint = null; const sp = m.spec;
      this.fake.wheels.forEach((w, k) => { w.len = sp.free - sp.sag; w.ly = (k < 2 ? sp.rF : sp.rR) + (sp.free - sp.sag) - sp.com; });
    }
    if (paint !== this.paint && typeof paint === 'number') { this.paint = paint; this.model.paintMat.color.setHex(paint); }
  }
  push(d, now) {
    if (!num(d.c, 12)) return;
    if (d.h && !num(d.h, 9)) d.h = 0;
    this.setVeh(String(d.v || 'jip'), d.k);
    if (typeof d.hat === 'string' || d.hat === null) { const h = HATS.has(d.hat) ? d.hat : null; if (h !== this.hat) { this.hat = h; setHat(this.rig, h); } }
    this.anim = typeof d.a === 'string' && /^[a-z]{2,12}$/.test(d.a) ? d.a : 'idle';
    this.rp = +d.rp || 0; this.lastPkt = d;
    const b = this.buf; if (b.length && now - b[b.length - 1].t < 0.005) b.pop(); b.push({ t: now, c: d.c, h: d.h || null, f: d.f | 0 }); if (b.length > 40) b.shift();
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
    const s = this.sample(now - DELAY); if (!s || !this.model) return;
    const { A, B, k, ex } = s, a = A.c, b = B.c, m = this.model;
    const tx = a[0] + (b[0] - a[0]) * k + b[7] * ex, ty = a[1] + (b[1] - a[1]) * k + b[8] * ex * 0.5, tz = a[2] + (b[2] - a[2]) * k + b[9] * ex;
    _qa.set(a[3], a[4], a[5], a[6]).normalize(); _qb.set(b[3], b[4], b[5], b[6]).normalize(); _qa.slerp(_qb, k);
    const jump = !this.shown || this.pos.distanceToSquared(_v.set(tx, ty, tz)) > 900; // uzoqqa ko'chdi (teleport) — silliqlamasdan
    const sk = jump ? 1 : 1 - Math.exp(-dt * 18);
    this.pos.x += (tx - this.pos.x) * sk; this.pos.y += (ty - this.pos.y) * sk; this.pos.z += (tz - this.pos.z) * sk; if (jump) this.q.copy(_qa); else this.q.slerp(_qa, sk);
    this.shown = true;
    const foot = !!(B.f & 4); this.foot = foot;
    m.root.visible = true; m.root.position.copy(this.pos); m.root.quaternion.copy(this.q);
    const f = this.fake; f.steer = a[10] + (b[10] - a[10]) * k; f.fwd = foot ? 0 : a[11] + (b[11] - a[11]) * k;
    for (let w = 0; w < 4; w++) f.wheels[w].spin += (f.fwd * dt) / ((w < 2 ? m.spec.rF : m.spec.rR) || 0.4);
    syncWheels(m, f);
    if (m.rider) m.rider.visible = !foot;
    const lit = !!(B.f & 1), brk = !!(B.f & 2);
    if (m.headMat) { if (lit) m.headMat.color.setRGB(2.6, 2.4, 1.9); else m.headMat.color.setHex(0xb8b8b0); }
    if (m.tailMat) { if (brk) m.tailMat.color.setRGB(2.4, 0.22, 0.12); else m.tailMat.color.setHex(lit ? 0xa81810 : 0x6a1410); }
    // piyoda qahramon
    const rig = this.rig; rig.root.visible = foot && !!B.h;
    if (foot && B.h) {
      const ha = A.h || B.h, hb = B.h, hx = ha[0] + (hb[0] - ha[0]) * k + hb[4] * ex, hy = ha[1] + (hb[1] - ha[1]) * k, hz = ha[2] + (hb[2] - ha[2]) * k + hb[5] * ex;
      const fj = !this.fshown || this.fpos.distanceToSquared(_v.set(hx, hy, hz)) > 400, fk = fj ? 1 : 1 - Math.exp(-dt * 16);
      this.fpos.x += (hx - this.fpos.x) * fk; this.fpos.y += (hy - this.fpos.y) * fk; this.fpos.z += (hz - this.fpos.z) * fk; this.fshown = true;
      let dy = hb[3] - this.fyaw; while (dy > Math.PI) dy -= 2 * Math.PI; while (dy < -Math.PI) dy += 2 * Math.PI; this.fyaw += dy * (fj ? 1 : fk);
      rig.root.position.copy(this.fpos); rig.root.rotation.y = this.fyaw;
      const C = this.ctl; C.vx = hb[4]; C.vz = hb[5]; C.vy = hb[6]; C.grounded = !!hb[7]; C.swim = !!hb[8];
      poseRig(rig, this.anim, dt, Math.hypot(hb[4], hb[5]), C);
    } else this.fshown = false;
    // ism yorlig'i
    const tp = foot && B.h ? this.fpos : this.pos, hh = foot ? 2.25 : (m.spec.hgt || 1.6) + 1.1, cam = this.g.camera.position, d = cam.distanceTo(tp);
    this.tag.visible = d < 900; this.tag.position.set(tp.x, tp.y + hh - (foot ? 0 : m.spec.com || 0), tp.z);
  }
  // xaritada ko'rsatish uchun joriy joy
  where() { return this.foot && this.fshown ? [this.fpos.x, this.fpos.z] : [this.pos.x, this.pos.z]; }
  yaw() { _e.setFromQuaternion(this.q, 'YXZ'); return this.foot ? this.fyaw : _e.y; }
  dispose() { const sc = this.g.scene; if (this.model) sc.remove(this.model.root); sc.remove(this.rig.root); sc.remove(this.tag); this.tag.material.map.dispose(); this.tag.material.dispose(); clearTimeout(this._et); }
}
const _qa = new THREE.Quaternion(), _qb = new THREE.Quaternion(), _v = new THREE.Vector3(), _e = new THREE.Euler();

// ---------- xona ----------
export function initCoop(game) {
  const net = game.net;
  const C = (game.coop = { room: null, members: new Map(), status: 'idle', msg: '', chat: [], listeners: new Set(), race: null });
  let peer = null, hostPeer = null, acc = 0, hourT = 0, lastPing = 0, joinTimer = null;
  const changed = () => { for (const f of C.listeners) { try { f(); } catch (e) { console.error(e); } } };
  C.onChange = (f) => { C.listeners.add(f); return () => C.listeners.delete(f); };
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
  const hello = () => ({ t: 'hi', pid: peer.id, name: C.myName(), uid: net.user ? net.user.id : '', slot: C.room ? C.room.slot : null, code: C.room ? C.room.code : null, v: 1 });

  // ---- ulanishni sozlash (kiruvchi ham, chiquvchi ham) ----
  function setupConn(conn) {
    conn.on('open', () => { try { conn.send(hello()); } catch { /* */ } });
    conn.on('data', (d) => { try { onData(conn, d); } catch (e) { console.error(e); } });
    conn.on('close', () => onClose(conn));
    conn.on('error', () => onClose(conn));
  }
  function connectTo(pid) { if (!peer || peer.destroyed || pid === peer.id) return; const c = peer.connect(pid, { reliable: true, serialization: 'json', metadata: { room: C.room && C.room.code } }); setupConn(c); }
  const memberOf = (conn) => { for (const m of C.members.values()) if (m.conn === conn) return m; return null; };
  function addMember(conn, d) {
    const pid = String(d.pid || conn.peer); let m = C.members.get(pid);
    if (m && m.conn !== conn) { if (m.conn && m.conn.open) { try { conn.close(); } catch { /* */ } return null; } m.conn = conn; return m; }
    if (!m) { m = { pid, name: cleanName(d.name), uid: String(d.uid || '').slice(0, 20), slot: d.slot | 0, conn, last: performance.now(), remote: null, ping: 0 }; C.members.set(pid, m); m.remote = new Remote(game, m); }
    return m;
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
        sendTo(m, { t: 'wel', slot: s, host: peer.id, code: C.room.code, roster: roster(), hour: game.hour });
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
    }
  }
  function applyRoster(list) {
    if (!Array.isArray(list)) return;
    for (const r of list.slice(0, MAX_PLAYERS)) { const pid = String(r.pid); if (pid === peer.id) { C.room.slot = r.slot | 0; continue; } const m = C.members.get(pid); if (m) { m.slot = r.slot | 0; m.name = cleanName(r.name); m.remote.drawTag(); } else if (peer.id > pid) connectTo(pid); }
  }
  function onClose(conn) {
    const m = memberOf(conn); if (!m || m.conn !== conn) return;
    C.members.delete(m.pid); m.remote.dispose();
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
    if (next.pid === peer.id) { C.room.isHost = true; sysMsg('Endi siz xona egasisiz'); claimRoom(0); bcast({ t: 'ros', host: peer.id, roster: roster() }); }
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
      p.on('connection', (c) => setupConn(c));
      p.on('error', (e) => { if (e.type === 'unavailable-id' && ++tries < 4 && !C.room) { p.destroy(); attempt(); return; } if (!C.room) { fail(PEER_ERR[e.type] || 'Ulanishda xatolik'); resolve(false); } });
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
    p.on('connection', (c) => setupConn(c));
    p.on('error', (e) => { if (C.status === 'room') return; /* xonadamiz: bitta ulanish xatosi xonani buzmaydi */ fail(PEER_ERR[e.type] || 'Ulanishda xatolik'); resolve(false); });
    p.on('disconnected', () => { if (C.room && !p.destroyed) setTimeout(() => { try { p.reconnect(); } catch { /* */ } }, 1500); });
  });
  function teardown() {
    clearTimeout(joinTimer);
    for (const m of C.members.values()) { try { m.conn.close(); } catch { /* */ } m.remote.dispose(); }
    C.members.clear(); C.room = null; C.race = null; game.coopRace = null;
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
  // chat oynasi (HUD ustida): [K] — yozish, Enter — yuborish, Esc — yopish
  const box = document.createElement('div'); box.id = 'chat';
  box.innerHTML = `<div class="feed"></div><form class="in" autocomplete="off"><input maxlength="160" placeholder="Xabar… (Enter — yuborish, Esc — yopish)"><div class="emo">${EMOJI.map((e) => `<button type="button" data-e="${e}">${e}</button>`).join('')}</div></form>`;
  (document.getElementById('ui') || document.body).appendChild(box);
  const feed = box.querySelector('.feed'), form = box.querySelector('form'), input = box.querySelector('input');
  form.onsubmit = (e) => { e.preventDefault(); C.say(input.value); input.value = ''; C.closeChat(); };
  input.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Escape') C.closeChat(); });
  box.querySelector('.emo').onclick = (e) => { const b = e.target.closest('[data-e]'); if (b) { C.emoji(b.dataset.e); C.closeChat(); } };
  C.openChat = () => { if (!C.room) { game.toast('Chat faqat xonada ishlaydi — [O] Onlayn'); return; } box.classList.add('open'); input.focus(); renderChat(); };
  C.closeChat = () => { box.classList.remove('open'); input.blur(); game.input.keys.clear(); renderChat(); };
  function renderChat() {
    const open = box.classList.contains('open'), now = Date.now();
    const list = C.chat.filter((c) => open || now - c.t < 14000).slice(-8);
    feed.innerHTML = list.map((c) => c.sys ? `<div class="sys">${esc(c.text)}</div>` : `<div><b style="color:${SLOT_COLORS[(c.slot | 0) % 4]}">${esc(c.name)}</b> <span class="${c.big ? 'big' : ''}">${esc(c.text)}</span></div>`).join('');
    box.style.display = C.room || open ? '' : 'none';
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

  // ---- do'st oldiga ko'chish ----
  C.teleportTo = (pid) => {
    const m = C.members.get(pid); if (!m || !m.remote.shown) return false;
    if (game.act) { game.toast('Avval chellenjni tugating yoki bekor qiling ([X])', 'bad'); return false; }
    const [x, z] = m.remote.where(), yaw = m.remote.yaw(), pl = game.player;
    if (pl.onFoot) pl.place(x - Math.sin(yaw) * 2.5 + Math.cos(yaw) * 1.5, z - Math.cos(yaw) * 2.5 - Math.sin(yaw) * 1.5, yaw);
    else { game.car.place(x - Math.sin(yaw) * 9, z - Math.cos(yaw) * 9, yaw); game.prevP = game.car.p.slice(); }
    game.cam.snap(); game.toast(`${m.name} yoniga ko'chdingiz`, 'good'); return true;
  };

  // ---- har kadr ----
  const flags = () => { const g = game, foot = g.player.onFoot, s = g.input.state, m = g.carModel; let f = 0; if (m.spot && m.spot.intensity > 0) f |= 1; if (!foot && ((s.brake > 0.1 && g.car.fwd > 1) || s.handbrake)) f |= 2; if (foot) f |= 4; if (g.car.nitroOn) f |= 8; return f; };
  function packet() {
    const g = game, c = g.car, pl = g.player, foot = pl.onFoot, a = g.act;
    const d = { t: 's', c: [r2(c.p[0]), r2(c.p[1]), r2(c.p[2]), r3(c.q[0]), r3(c.q[1]), r3(c.q[2]), r3(c.q[3]), r2(c.v[0]), r2(c.v[1]), r2(c.v[2]), r3(c.steer || 0), r2(c.fwd || 0)], f: flags(), v: g.carModel.id, k: g.carModel.paintMat.color.getHex(), hat: g.state.hat || null };
    if (foot) { d.h = [r2(pl.p[0]), r2(pl.p[1]), r2(pl.p[2]), r3(pl.yaw), r2(pl.v[0]), r2(pl.v[2]), r2(pl.v[1]), pl.grounded ? 1 : 0, pl.swim ? 1 : 0]; d.a = pl.anim || 'idle'; }
    if (g.coopRace && a && a.def.type === 'race') d.rp = (a.my || 0) + a.cpi * 0.001;
    return d;
  }
  // boshqa o'yinchilar transporti bilan yumshoq to'qnashuv (faqat o'z transportimiz suriladi)
  function bump() {
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
    if (game.mode === 'play' || game.mode === 'ui') bump();
    // xaritadagi nuqtalar va poygadagi o'rin
    const dots = []; for (const m of C.members.values()) if (m.remote.shown) { const [x, z] = m.remote.where(); dots.push([x, z, SLOT_COLORS[m.slot % 4], m.name, m.pid]); } game.netDots = dots;
    if (game.coopRace && game.act && C.race) { const a = game.act, my = (a.my || 0) + a.cpi * 0.001; let ahead = 0; for (const p of C.race.pids) { if (p === peer.id) continue; const m = C.members.get(p); if (C.race.fin[p] != null) ahead++; else if (m && m.remote.rp > my) ahead++; } game.coopRace.place = 1 + ahead; }
    if (!n || !peer) return;
    acc += dt; if (acc >= RATE) { acc = Math.min(acc - RATE, RATE); const d = packet(); bcast(d); }
    if (C.room.isHost && (hourT += dt) > 3) { hourT = 0; bcast({ t: 'h', h: game.act && game.act.hourBak != null ? game.act.hourBak : game.hour }); }
  });
  // aloqa nazorati kadr siklidan tashqarida: brauzer varag'i yashirilganda (kadrlar to'xtaydi) ham ping ketadi va aloqa uzilmaydi; 45 soniya jim qolgan o'yinchi — chiqib ketgan
  setInterval(() => {
    if (!C.room || !peer) return; const ms = performance.now();
    if (ms - lastPing > 3000) { lastPing = ms; bcast({ t: 'pi', x: ms }); }
    for (const m of [...C.members.values()]) if (ms - m.last > 45000) { try { m.conn.close(); } catch { /* */ } onClose(m.conn); }
  }, 1000);

  // taklif havolasi: ?xona=KOD — sahifa ochilganda xonaga qo'shilish taklif qilinadi
  C.inviteCode = (() => { try { return normCode(new URLSearchParams(location.search).get('xona') || ''); } catch { return ''; } })();
  return C;
}
