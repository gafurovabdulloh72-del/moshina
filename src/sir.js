// Orol sirlari: mish-mishlar (aholi yashirin sandiq, tangalar, noma'lum joy, tadbir va ob-havo haqida aytadi; xaritada doira, telefonda daftar), oltin muhr (manzilni oxirigacha zabt etish), kun vaqtining ahamiyati (tong, tush, shom, tun — yaltiroq qo'ng'izlar); haydashga munosabat (munosabat.js) va qazilma maydoni (qazilma.js) shu yerdan ulanadi
import * as THREE from 'three';
import * as T from './terrain.js';
import { EV } from './tadbir.js';
import { WX, WEEK } from './obhavo.js';
import { initMunosabat } from './munosabat.js';
import { initQazilma } from './qazilma.js';

const som = (n) => Math.round(n).toLocaleString('ru-RU');
const hm = (h) => `${String(Math.floor(h) % 24).padStart(2, '0')}:${String(Math.floor((h % 1) * 60)).padStart(2, '0')}`;
// kun vaqtlari: id, belgi, nom, boshlanish, tugash (soat), nima o'zgaradi
export const PERIODS = [
  ['tong', '🌅', 'Tong', 5, 8, ['Baliq ikki baravar tez ilinadi', 'Bozor kunlari rastalar soat 05:00 da ochiladi', 'Salqin — chanqoq sekinroq']],
  ['kun', '☀️', 'Kunduz', 8, 12, ['Hamma joy ochiq, ishlar vaqti']],
  ['tush', '🔆', 'Tush jaziramasi', 12, 16, ['Chanqoq tezroq (cho\'l, dara va savannada ikki baravar) — suv olib yuring', 'Cho\'lda havo jimirlaydi']],
  ['peshin', '🌤', 'Peshin', 16, 18, ['Kun salqinlashmoqda']],
  ['shom', '🌇', 'Shom', 18, 22, ["Choyxonada gurung: o'tirsangiz mish-mish eshitasiz", "Odamlar suhbatga moyil — mish-mish ko'proq aytiladi"]],
  ['tun', '🌙', 'Tun', 22, 5, ["Do'kon, kiyim do'koni va sartaroshxona yopiq (o'zingizniki bo'lsa — ochiq)", "Ko'chada odam kam", "Yaltiroq qo'ng'izlar uchadi — piyoda tutib oling", 'Chigirtka chirillaydi, boyo\'g\'li uhlaydi']],
];
export const periodAt = (h) => { h = ((h % 24) + 24) % 24; for (const p of PERIODS) if (p[3] < p[4] ? h >= p[3] && h < p[4] : h >= p[3] || h < p[4]) return p; return PERIODS[1]; };
export const DIRS = ["sharq", "janubi-sharq", "janub", "janubi-g'arb", "g'arb", "shimoli-g'arb", "shimol", "shimoli-sharq"];
export const dirOf = (dx, dz) => DIRS[((Math.round(Math.atan2(dz, dx) / (Math.PI / 4)) % 8) + 8) % 8]; // xaritada +z — janub
export const GOLD_RW = 1500, RUM_MAX = 3, RUM_R = 160;
const HOT = { 3: 1, 4: 1, 8: 1 }; // cho'l, dara, savanna
const GLOW = { 0: 1, 1: 1, 2: 1, 7: 1 }; // yaltiroq qo'ng'izlar: yashil vodiy, oltin o'rmon, tayga, sakura

export function initSir(game) {
  const { scene } = game, st = game.state, ui = game.ui, pl = game.player, L = game.live, HY = game.hayot, IN = game.interior, A = game.acts;
  const D0 = { rum: [], rlog: [], rumN: 0, rumOk: 0, gold: {}, err: {}, fire: 0, finds: {}, museum: {}, broken: 0, found: 0, arx: 0, dig: null, react: null, rep: null, tod: '' };
  const S = (st.sir = Object.assign(D0, st.sir || {}));
  for (const k of ['rum', 'rlog']) if (!Array.isArray(S[k])) S[k] = [];
  for (const k of ['gold', 'err', 'finds', 'museum']) if (!S[k] || typeof S[k] !== 'object') S[k] = {};
  const R = (game.sir = { PERIODS, periodAt });
  const toast = (m, k) => game.toast(m, k), sfx = (n) => game.audio.sfx(n);
  const places = game.site.places, boards = Object.keys(places).filter((id) => id !== 'uy' && places[id].board);
  const pick = game.pick, Wd = game.dunyo, Ev = game.tadbir;
  // tun: ko'chada odam kam — piyodalarning yarmi yashiriladi (shahar.js ularni kunduzi o'zi qayta ko'rsatadi); munosabat.js dan oldin ishlaydi
  game.hooks.push(() => { if (game.shahar && R.mods().few) for (const w of game.shahar.walkers) if (w.i % 2 && w.rig.root.visible) w.rig.root.visible = false; });
  initMunosabat(game);
  const Q = initQazilma(game);

  // ================= KUN VAQTI =================
  R.period = () => periodAt(game.hour);
  R.mods = (h = game.hour) => { const p = periodAt(h)[0]; return { p, fishK: p === 'tong' ? 0.5 : 1, thirstK: p === 'tush' ? 1.6 : p === 'tong' ? 0.8 : 1, rumK: p === 'shom' ? 1.5 : 1, shopsOpen: !(h >= 22 || h < 6), cafeOpen: h >= 5.5, fireflies: h >= 21 || h < 4.5, few: h >= 23 || h < 5 }; };
  EV.bozor[3] = 5; // bozor kuni tongda ochiladi (tadbir.js jadvali)
  const ownBiz = (id) => !!(st.biz && st.biz[id] && st.biz[id].lvl > 0);
  const closed = (what, open) => { toast(`🌙 ${what} yopiq — ertalab ${open} da ochiladi`, 'bad'); sfx('door'); };
  { const es = HY.enterShop; HY.enterShop = (sh) => { if (!R.mods().shopsOpen && !ownBiz('dokon')) return closed("Do'kon", '06:00'); es(sh); }; }
  { const H2 = game.hayot2, en = H2.enter; H2.enter = (b) => { const m = R.mods(); if (b.kind === 'cafe' ? !m.cafeOpen && !ownBiz('choyxona') : !m.shopsOpen && !ownBiz(b.kind === 'kiyim' ? 'kiyim' : 'sartarosh')) return closed(b.kind === 'cafe' ? 'Choyxona' : b.kind === 'kiyim' ? "Kiyim do'koni" : 'Sartaroshxona', b.kind === 'cafe' ? '05:30' : '06:00'); en(b); }; }

  // yaltiroq qo'ng'izlar (InstancedMesh, yangi chiroqsiz — yorqin rang + bloom)
  const NF = 28, fIM = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.075, 0), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 2.8, 0.7) }), NF);
  fIM.frustumCulled = false; fIM.count = 0; scene.add(fIM);
  const flies = []; for (let i = 0; i < NF; i++) flies.push({ x: 0, z: 0, y: 0, ph: Math.random() * 6.283, on: false });
  const fd = new THREE.Object3D();
  let swarm = null; // { x, z } — joriy to'da markazi
  R.flies = flies;
  const spawnFly = (f, cx, cz) => { const a = Math.random() * 6.283, d = 3 + Math.random() * 16; f.x = cx + Math.cos(a) * d; f.z = cz + Math.sin(a) * d; f.y = T.ground(f.x, f.z, 1e9).y + 0.7 + Math.random() * 1.2; f.ph = Math.random() * 6.283; f.on = true; };
  R.swarmAt = (x, z) => { swarm = { x, z }; for (const f of flies) spawnFly(f, x, z); fIM.count = NF; };
  R.catchFly = (f) => { if (!f || !f.on) return false; f.on = false; S.fire = (S.fire || 0) + 1; game.addMoney(6, "Yaltiroq qo'ng'iz"); sfx('pick'); game.fx.burst(8, f.x, f.y, f.z, 1.5, 0.5, 0.3, 0xe8ff80, 1, 0.6, 3, 0);
    if (S.fire % 10 === 0) { game.addMoney(60, "Qo'ng'izlar bankasi"); game.banner("✨ Bankada " + S.fire + " ta yaltiroq qo'ng'iz", "Kechasi chiroqdek nur sochadi · +60 so'm · ertalab qo'yib yuboring 🙂", 'gold'); } else toast(`✨ Yaltiroq qo'ng'iz tutildi (${S.fire}) · +6 so'm`, 'good');
    setTimeout(() => { if (swarm) spawnFly(f, swarm.x, swarm.z); }, 9000); return true; };
  const updFlies = (dt, px, pz, foot) => { const m = R.mods(), wet = Wd && Wd.cur && Wd.cur.rain > 0.2;
    if (!m.fireflies || wet || (IN && IN.inside)) { if (fIM.count) { fIM.count = 0; swarm = null; } return; }
    if (!swarm || Math.hypot(swarm.x - px, swarm.z - pz) > 70) { if (GLOW[T.biomeAt(px, pz)] && T.siteInfo(px, pz).roadD > 4 && !boards.some((id) => Math.hypot(places[id].x - px, places[id].z - pz) < 90)) R.swarmAt(px + (Math.random() - 0.5) * 14, pz + (Math.random() - 0.5) * 14); else { fIM.count = 0; swarm = null; return; } }
    const t = game.time; flies.forEach((f, i) => { const k = f.on ? (0.5 + 0.5 * Math.sin(t * 2.3 + f.ph * 3)) ** 2 : 0; f.x += Math.sin(t * 0.7 + f.ph) * dt * 0.6; f.z += Math.cos(t * 0.6 + f.ph * 1.3) * dt * 0.6; fd.position.set(f.x, f.y + Math.sin(t * 1.4 + f.ph) * 0.3, f.z); fd.scale.setScalar(0.25 + 0.95 * k); fd.updateMatrix(); fIM.setMatrixAt(i, fd.matrix); });
    fIM.instanceMatrix.needsUpdate = true; };
  // tungi tovushlar: chigirtka va boyo'g'li (sintez)
  let crT = 0, owlT = 8;
  const nightSounds = (dt, px, pz) => { const a = game.audio; if (!a.ready || game.mode !== 'play' || (IN && IN.inside) || !(game.hour >= 21 || game.hour < 4.8)) return; const b = T.biomeAt(px, pz); if (b === 5 || b === 6) return;
    if ((crT -= dt) <= 0) { crT = 0.35 + Math.random() * 0.9; const t = a.ctx.currentTime, f = 4200 + Math.random() * 500; for (let i = 0; i < 3; i++) a.tone(f, t + i * 0.055, 0.035, 'sine', 0.012); }
    if (GLOW[b] && (owlT -= dt) <= 0) { owlT = 14 + Math.random() * 16; const t = a.ctx.currentTime; a.tone(390, t, 0.32, 'sine', 0.05, null, 0.06, 0.88); a.tone(370, t + 0.5, 0.55, 'sine', 0.045, null, 0.08, 0.85); } };

  // ================= MISH-MISHLAR =================
  const near = (x, z) => { let b = null, bd = 1e9; for (const id of boards) { const p = places[id], d = Math.hypot(p.x - x, p.z - z); if (d < bd) { bd = d; b = p; } } return b; };
  const off = (x, z, r) => { const a = Math.random() * 6.283, d = Math.random() * r * 0.55; return [x + Math.cos(a) * d, z + Math.sin(a) * d]; };
  const has = (k, ref) => S.rum.some((q) => q.k === k && q.ref === ref);
  const where = (x, z) => { const p = near(x, z), d = Math.hypot(x - p.x, z - p.z); return d < 120 ? `${p.name} yonida` : `${p.name}dan ${dirOf(x - p.x, z - p.z)} tomonda, taxminan ${d > 950 ? (d / 1000).toFixed(1) + ' km' : Math.round(d / 50) * 50 + ' metr'} narida`; };
  // to'da tangalar (yo'ldan uzoqda, 5 tadan) — markazi va indekslari
  const clusters = (() => { const out = [], cs = pick.coins; for (let i = 0; i + 4 < cs.length; i++) { const a = cs[i], b = cs[i + 4]; if (Math.hypot(a.x - b.x, a.z - b.z) < 12 && Math.hypot(cs[i + 1].x - a.x, cs[i + 1].z - a.z) < 8 && T.siteInfo(a.x, a.z).roadD > 15) { out.push({ i, x: (a.x + b.x) / 2, z: (a.z + b.z) / 2, ids: [i, i + 1, i + 2, i + 3, i + 4] }); i += 4; } } return out; })();
  R.clusters = clusters;
  const gotCl = (c) => c.ids.filter((k) => st.coins.includes(k)).length;
  // rumour quruvchilari: har biri {k, txt, x, z, r, ref} yoki null qaytaradi
  const GEN = {
    chest: (sx, sz) => { let best = -1, bd = 1e9; pick.chests.forEach((c, i) => { if (st.chests.includes(i) || has('chest', i)) return; const d = Math.hypot(c.x - sx, c.z - sz) * (0.6 + Math.random() * 0.8); if (d < bd) { bd = d; best = i; } }); if (best < 0) return null; const c = pick.chests[best], [x, z] = off(c.x, c.z, RUM_R);
      return { k: 'chest', ref: best, x, z, r: RUM_R, txt: `${where(c.x, c.z)} qadimgi sandiq ko'mib qo'yilgan emish. Bobom aytardi, yaltirab turarmish…` }; },
    coins: (sx, sz) => { const l = clusters.filter((c) => gotCl(c) < 3 && !has('coins', c.i)); if (!l.length) return null; l.sort((a, b) => Math.hypot(a.x - sx, a.z - sz) - Math.hypot(b.x - sx, b.z - sz)); const c = l[Math.min(l.length - 1, (Math.random() * 3) | 0)], [x, z] = off(c.x, c.z, 110);
      return { k: 'coins', ref: c.i, x, z, r: 110, txt: `Cho'ponlar ${where(c.x, c.z)} tangalar sochilib yotganini ko'rishibdi. Kim tushirib qoldirgan ekan-a?` }; },
    place: (sx, sz) => { const l = boards.filter((id) => !st.places[id] && !has('place', id)); if (!l.length) return null; const id = l[(Math.random() * l.length) | 0], p = places[id], [x, z] = off(p.x, p.z, 220), q = near(sx, sz);
      return { k: 'place', ref: id, x, z, r: 220, txt: `${q.name}dan ${dirOf(p.x - q.x, p.z - q.z)} tomonda siz hali bormagan bir joy bor deyishadi — u yerda ham e'lonlar taxtasi bor emish.` }; },
    dig: () => { if (S.found || Q.doneN() || Q.rented() || has('dig', 'q')) return null; const s = Q.site;
      return { k: 'dig', ref: 'q', x: s.x, z: s.z, r: 70, txt: `Karvonsaroy yonidagi qumdan qadimiy shahar qoldiqlari chiqibdi! Arxeolog Nodira opa yordamchi qidiryapti.` }; },
    event: () => { const u = Ev && Ev.upcoming ? Ev.upcoming(4).filter((e) => e.in > 0 || EV[e.k][3] > game.hour)[0] : null; if (!u) return null; const ev = EV[u.k], day = u.in === 0 ? 'Bugun' : u.in === 1 ? 'Ertaga' : `${WEEK[Wd.weekday(u.d)]} kuni`;
      return { k: 'event', txt: `${day} Bog'istonda ${ev[0].toLowerCase()} ${ev[1]} bo'larkan — soat ${String(ev[3]).padStart(2, '0')}:00 dan boshlanadi. ${u.k === 'toy' ? 'Osh tortiladi, hammani chaqirishyapti!' : u.k === 'bozor' ? 'Erta borsangiz, yangi mevalar sizniki!' : 'Sumalak pishiriladi!'}` }; },
    weather: () => { if (!Wd || !Wd.forecast) return null; const fc = Wd.forecast(6), bad = fc.find((f) => f.t !== 'ochiq' && f.t !== 'bulut');
      return { k: 'weather', txt: bad ? `Tizzam og'riyapti — soat ${String(bad.h).padStart(2, '0')}:00 larga ${WX[bad.t][1].toLowerCase()} ${WX[bad.t][0]} bo'ladi, ko'rasiz.` : "Osmon tiniq, shamol jim — yaqin orada yomg'ir yo'q, bemalol yo'lga chiqavering ☀️" }; },
    night: () => (S.fire ? null : { k: 'night', txt: "Kechasi soat 9 dan keyin o'rmon va yaylovlarda yaltiroq qo'ng'izlar uchadi — bolalar ularni bankaga tutishadi ✨" }),
  };
  const W8 = [['chest', 4], ['dig', 3], ['coins', 2], ['place', 2], ['event', 1.5], ['weather', 1.2], ['night', 0.8]];
  R.make = (sx, sz, only) => { const list = only ? [[only, 1]] : W8.slice(); for (let t = 0; t < 8 && list.length; t++) { const tot = list.reduce((s, q) => s + q[1], 0); let r = Math.random() * tot, k = 0; for (; k < list.length - 1; k++) if ((r -= list[k][1]) <= 0) break; const g = GEN[list[k][0]](sx, sz); if (g) return g; list.splice(k, 1); } return null; };
  R.add = (g, who) => { if (!g) return null; g.who = who || 'Kimdir'; g.day = st.dunyo.day; S.rumN = (S.rumN || 0) + 1; S.rlog.unshift({ txt: g.txt, who: g.who, k: g.k, day: g.day }); if (S.rlog.length > 12) S.rlog.length = 12;
    if (g.x != null) { S.rum.push({ k: g.k, ref: g.ref, x: Math.round(g.x), z: Math.round(g.z), r: g.r, txt: g.txt, who: g.who, day: g.day }); while (S.rum.length > RUM_MAX) S.rum.shift(); }
    toast(`🗣 Mish-mish: ${g.who} — ${g.x != null ? 'xaritada taxminiy doira belgilandi' : 'telefondagi «Mish-mishlar»ga yozildi'}`, 'gold'); return g; };
  R.rumourFor = (o, force) => { if (!force) { if ((o._rumT || -1e9) > game.time) return null; const ch = Math.min(0.85, 0.5 * R.mods().rumK); if (Math.random() > ch) return null; } o._rumT = game.time + 120; return R.add(R.make(o.x, o.z), o.name); };
  // suhbat oynasiga mish-mish qatori qo'shiladi (hayot.js dialogi)
  { const chat0 = L.chat; L.chat = (o) => { chat0(o); const Dg = HY.dlg; if (!Dg || Dg.o !== o) return; const g = R.rumourFor(o, R.forceNext); R.forceNext = false; if (g) { Dg.lines.push('🤫 Aytgancha, eshitdingizmi? ' + g.txt); if (HY.drawDlg) HY.drawDlg(); } }; }
  // mish-mish rost chiqdimi
  const ok = (q) => (q.k === 'chest' ? st.chests.includes(q.ref) : q.k === 'coins' ? (() => { const c = clusters.find((c) => c.i === q.ref); return !c || gotCl(c) >= 3; })() : q.k === 'place' ? !!st.places[q.ref] : q.k === 'dig' ? S.found > 0 || Q.rented() : false);
  R.check = () => { for (let i = S.rum.length - 1; i >= 0; i--) { const q = S.rum[i]; if (ok(q)) { S.rum.splice(i, 1); S.rumOk = (S.rumOk || 0) + 1; game.addMoney(30, 'Mish-mish rost chiqdi'); const lg = S.rlog.find((l) => l.txt === q.txt); if (lg) lg.ok = 1; toast(`📜 Mish-mish rost chiqdi! ${q.who} to'g'ri aytgan ekan · +30 so'm`, 'gold'); } else if (st.dunyo.day - q.day > 6) S.rum.splice(i, 1); } };
  // shomda choyxonada o'tirsangiz — qo'shni stoldan gurung
  let cafeT = 20;
  const cafeTalk = (dt) => { if (!(IN && IN.inside === 'cafe' && pl.sit && R.period()[0] === 'shom')) { cafeT = Math.min(cafeT, 20); return; } if ((cafeT -= dt) > 0) return; cafeT = 40; R.add(R.make(pl.p[0] + (Math.random() - 0.5) * 3000, pl.p[2] + (Math.random() - 0.5) * 3000), "Qo'shni stoldagi choyxo'rlar"); };

  // ================= OLTIN MUHR =================
  const owner = (x, z) => { let b = null, bd = 300; for (const id of boards) { const p = places[id], d = Math.hypot(p.x - x, p.z - z); if (d < bd) { bd = d; b = id; } } return b; };
  const COLL = {}; for (const id of boards) COLL[id] = { coins: [], chests: [] };
  pick.coins.forEach((c, i) => { const o = owner(c.x, c.z); if (o) COLL[o].coins.push(i); });
  pick.chests.forEach((c, i) => { const o = owner(c.x, c.z); if (o) COLL[o].chests.push(i); });
  const hasNpc = {}; for (const o of L._dbg.npcs) hasNpc[o.place] = 1;
  R.COLL = COLL;
  R.need = (id) => { const acts = (A.byPlace[id] || []).filter((a) => a.cat !== 'inf'), s3 = acts.filter((a) => (st.stars[a.id] || 0) >= 3).length, C = COLL[id], cs = new Set(st.coins), ch = new Set(st.chests);
    const got = C.coins.filter((i) => cs.has(i)).length + C.chests.filter((i) => ch.has(i)).length, tot = C.coins.length + C.chests.length, err = !hasNpc[id] || (S.err[id] || 0) > 0;
    return { acts: acts.length, s3, got, tot, chestsLeft: C.chests.filter((i) => !ch.has(i)).length, err, errNeed: !!hasNpc[id], ok: s3 >= acts.length && got >= tot && err }; };
  R.goldN = () => boards.filter((id) => S.gold[id]).length;
  R.freeTravel = (id) => !!S.gold[id];
  R.checkGold = () => { const out = []; for (const id of boards) { if (S.gold[id] || !st.places[id]) continue; if (!R.need(id).ok) continue; S.gold[id] = Math.round(st.stats.time) || 1; out.push(id); game.addMoney(GOLD_RW, 'Oltin muhr');
      game.banner(`🏅 Oltin muhr: ${places[id].name}!`, `Manzil oxirigacha zabt etildi · +${som(GOLD_RW)} so'm · bu yerga tez sayohat endi tekin · ${R.goldN()}/${boards.length}`, 'gold'); sfx('win'); }
    if (out.length) game.save(); return out; };
  // topshiriq qaysi manzil aholisidan olingani (topshiriq.js beruvchisi) — bajarilganda shu manzilga yoziladi
  let lastErr = null, lastDone = (st.errands && st.errands.done) || 0;
  const trackErr = () => { const E = game.topshiriq, cur = E && E.cur, n = (st.errands && st.errands.done) || 0; if (n > lastDone && lastErr && lastErr.o && lastErr.o.place) S.err[lastErr.o.place] = (S.err[lastErr.o.place] || 0) + 1; lastDone = n; lastErr = cur || null; };
  R.trackErr = trackErr;

  // ================= XARITA =================
  game.mapExtra = game.mapExtra || [];
  game.mapExtra.push((c, P, k) => {
    c.save(); c.setLineDash([22, 14]); for (const q of S.rum) { const r = Math.max(24, q.r * k); c.beginPath(); c.arc(P(q.x), P(q.z), r, 0, 6.283); c.fillStyle = 'rgba(255,150,40,.28)'; c.fill(); c.lineWidth = 8; c.strokeStyle = '#ff8a1a'; c.stroke(); c.font = '900 44px system-ui'; c.textAlign = 'center'; c.lineWidth = 7; c.strokeStyle = 'rgba(10,14,24,.85)'; c.strokeText('?', P(q.x), P(q.z) + 15); c.fillStyle = '#ffd08a'; c.fillText('?', P(q.x), P(q.z) + 15); }
    c.setLineDash([]); for (const id of boards) { if (!S.gold[id]) continue; const p = places[id]; c.beginPath(); c.arc(P(p.x), P(p.z), 24, 0, 6.283); c.lineWidth = 8; c.strokeStyle = '#ffd23a'; c.stroke(); c.font = '900 38px system-ui'; c.textAlign = 'center'; c.lineWidth = 6; c.strokeStyle = 'rgba(10,14,24,.85)'; c.strokeText('★', P(p.x), P(p.z) + 62); c.fillStyle = '#ffd23a'; c.fillText('★', P(p.x), P(p.z) + 62); }
    const s = Q.site; c.font = '34px system-ui'; c.textAlign = 'center'; c.fillText('⛏', P(s.x), P(s.z) + 7); c.restore(); });
  { const m0 = ui.s_map; ui.s_map = function (...a) { m0.apply(this, a); const lg = this.screen.querySelector('.legend'); if (lg) lg.insertAdjacentHTML('beforeend', `<div><i style="background:#ffaa3c"></i>Mish-mish (taxminiy doira)</div><div><i style="background:#ffd23a"></i>Oltin muhr ★ (tez sayohat tekin)</div><div><i style="background:#e0a050"></i>Qazilma maydoni ⛏</div>`); }; }

  // ================= OYNALAR VA TELEFON =================
  const css = document.createElement('style'); css.textContent = `
.sr-g{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:9px;margin-top:10px}.sr-p{padding:10px 12px;border-radius:13px;background:rgba(255,255,255,.05);border:1px solid var(--bd);font-size:13px}
.sr-p.gold{border-color:#ffd23a;background:rgba(255,210,58,.1)}.sr-p b{font-size:15px}.sr-p .r{display:flex;justify-content:space-between;margin-top:4px}.sr-p .r span.y{color:var(--good)}.sr-p .r span.n{color:#ffb0a0}
.sr-tod{padding:10px 12px;border-radius:13px;background:linear-gradient(135deg,rgba(255,180,80,.18),rgba(80,120,255,.12));margin:6px 0 10px;font-size:13px}.sr-tod ul{margin:4px 0 0 18px;padding:0}`;
  document.head.appendChild(css);
  const needRows = (id) => { const n = R.need(id); return `<div class="r"><span>★★★ chellenjlar</span><span class="${n.s3 >= n.acts ? 'y' : 'n'}">${n.s3}/${n.acts}</span></div><div class="r"><span>Tangalar va sandiqlar (300 m)</span><span class="${n.got >= n.tot ? 'y' : 'n'}">${n.got}/${n.tot}${n.chestsLeft ? ` · 📦 ${n.chestsLeft}` : ''}</span></div><div class="r"><span>Aholi topshirig'i</span><span class="${n.err ? 'y' : 'n'}">${n.errNeed ? (n.err ? '✔ bajarildi' : 'hali yo\'q') : '—'}</span></div>`; };
  ui.s_muhrlar = function (w, d, btn, x) { x(); w.innerHTML = `<h1>🏅 Oltin muhrlar <small>${R.goldN()} / ${boards.length}</small></h1><p class="sub">Manzilni oxirigacha zabt eting: e'lonlar taxtasidagi barcha chellenjlar 3 yulduzga, atrofidagi (300 m) tanga va sandiqlarning hammasi va shu yer aholisining bitta topshirig'i. Mukofot — ${som(GOLD_RW)} so'm, xaritada oltin ★ va o'sha manzilga tekin tez sayohat.</p>
    <div class="sr-g">${boards.map((id) => { const known = !!st.places[id], g = S.gold[id]; return `<div class="sr-p${g ? ' gold' : ''}"><b>${g ? '🏅 ' : ''}${known ? places[id].name : "? Noma'lum manzil"}</b>${known ? needRows(id) : '<div class="r"><span>Avval bu manzilni toping</span></div>'}</div>`; }).join('')}</div>`; };
  { const pr0 = ui.s_progress; ui.s_progress = function (w, d, btn, x) { pr0.call(this, w, d, btn, x); const b = btn(`🏅 Oltin muhrlar · ${R.goldN()}/${boards.length}`, () => this.open('muhrlar'), 'sec'); b.style.marginTop = '12px'; b.style.marginLeft = '8px'; w.appendChild(b); }; }
  const todHtml = () => { const p = R.period(); return `<div class="sr-tod"><b>${p[1]} Hozir: ${p[2]}</b> <small>(${hm(game.hour)})</small><ul>${p[5].map((t) => `<li>${t}</li>`).join('')}</ul></div>`; };
  R.todHtml = todHtml;
  const PH = game.phone;
  if (PH && PH.apps) {
    PH.apps.push(['mish', '🗣', 'Mish-mishlar', '#c0703a'], ['muhr', '🏅', 'Muhrlar', '#d8a020']);
    PH.ext.mish = (head) => head('🗣 Mish-mishlar') + todHtml() + `<div class="ph-list">${S.rum.map((q, i) => `<div data-a="rumgo:${i}"><span>📍 ${q.txt}<small>${q.who} · ${q.r} m doira · bosing — xaritada yo'l</small></span><b>?</b></div>`).join('') || '<p class="ph-empty">Hozircha faol mish-mish yo\'q — aholi bilan gaplashing (E)</p>'}</div><p class="ph-empty" style="text-align:left;margin:8px 14px 2px"><b>Daftar</b> · eshitilgan: ${S.rumN || 0} · rost chiqqan: ${S.rumOk || 0}</p><div class="ph-list">${S.rlog.map((l) => `<div><span>${l.ok ? '✔ ' : ''}${l.txt}<small>${l.who} · ${l.day}-kun</small></span></div>`).join('')}</div>`;
    PH.acts.rumgo = (i) => { const q = S.rum[+i]; if (!q) return; game.setWaypoint(q.x, q.z); ui.close(); toast("📍 Mish-mish doirasiga yo'l ko'rsatildi — atrofni qidiring"); };
    PH.ext.muhr = (head) => head('🏅 Oltin muhrlar') + `<div class="ph-card" style="background:linear-gradient(135deg,#d8a020,#a8661a)"><small>Zabt etilgan manzillar</small><b>${R.goldN()} / ${boards.length}</b><small>Har biri ${som(GOLD_RW)} so'm va tekin tez sayohat</small></div><div class="ph-list">${boards.filter((id) => st.places[id]).map((id) => { const n = R.need(id); return `<div data-a="muhrw"><span>${S.gold[id] ? '🏅 ' : ''}${places[id].name}<small>★★★ ${n.s3}/${n.acts} · 🪙 ${n.got}/${n.tot} · topshiriq ${n.err ? '✔' : '✗'}</small></span><b>${S.gold[id] ? '✔' : '›'}</b></div>`; }).join('') || '<p class="ph-empty">Avval manzillarni oching</p>'}</div>`;
    PH.acts.muhrw = () => ui.open('muhrlar');
  }

  // ================= [E] (yaltiroq qo'ng'iz tutish) =================
  const ex0 = L.extra;
  L.extra = (offer, px, pz, p) => { if (ex0) ex0(offer, px, pz, p); if (!fIM.count) return; let b = null, bd = 1.5; for (const f of flies) { if (!f.on || Math.abs(f.y - p[1]) > 2.6) continue; const d = Math.hypot(f.x - px, f.z - pz); if (d < bd) { bd = d; b = f; } }
    if (b) offer(bd + 1.2, "<kbd>E</kbd> Yaltiroq qo'ng'izni tutish ✨", () => pl.act('wave', 0.6, () => R.catchFly(b))); };

  // ================= KADR =================
  let acc = 0, lastFish = null, lastP = R.period()[0];
  game.hooks.push((dt) => {
    if (game.mode !== 'play' && game.mode !== 'ui') return;
    const foot = pl.onFoot, p = foot ? pl.p : game.car.p, px = p[0], pz = p[2], m = R.mods();
    // tong: baliq tez ilinadi
    if (L.fishing && L.fishing !== lastFish) { lastFish = L.fishing; if (L.fishing.ph === 0) L.fishing.t *= m.fishK; }
    // tush jaziramasi / tong salqini — chanqoq (hayot.js asosiy sarfi ustiga)
    if (foot && !(IN && IN.inside) && game.mode === 'play') { const k = m.thirstK > 1 && HOT[T.biomeAt(px, pz)] ? 2.4 : m.thirstK; if (k !== 1) st.thirst = Math.max(0, Math.min(100, st.thirst - 0.06 * (k - 1) * dt)); }
    updFlies(dt, px, pz, foot); nightSounds(dt, px, pz); cafeTalk(dt);
    if ((acc += dt) < 1) return; acc = 0;
    trackErr(); R.check(); R.checkGold();
    const np = R.period()[0]; if (np !== lastP) { lastP = np; S.tod = np; const P = R.period(); if (game.mode === 'play' && !game.act) toast(`${P[1]} ${P[2]}: ${P[5][0]}`, 'gold'); }
  });
  return R;
}
