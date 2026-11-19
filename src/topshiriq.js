// Qishloq topshiriqlari: aholi yordam so'raydi (sumka, xat, echki, tovuqlar, suv, to'siq, bozorga olib borish, non, o'tin, baliq) — mukofot: pul va hurmat
import * as THREE from 'three';
import * as T from './terrain.js';
import * as COL from './colliders.js';
import { GB, MAT } from './geo.js';
import * as BK from './blocks.js';
import { ACTIONS } from './controls.js';
import { clamp, angDiff } from './util.js';

const som = (n) => Math.round(n).toLocaleString('ru-RU');
// tur: [belgi, nom, NPC taklif so'zi, mukofot (so'm), hurmat]
export const ERR = {
  sumka: ['👜', "Sumkani uyga olib borish", "Sumkam og'ir, ko'tarishib yuborasizmi?", 50, 2],
  xat: ['✉️', 'Xat yetkazish', 'Bir iltimosim bor edi — xat bor…', 70, 2],
  echki: ['🐐', 'Qochgan echkini topish', 'Echkim qochib ketdi!', 90, 3],
  tovuq: ['🐔', 'Tovuqlarni ushlash', 'Tovuqlarim hovlidan chiqib ketdi!', 65, 2],
  suv: ['🪣', 'Quduqdan suv olib kelish', "Bir chelak suv kerak edi…", 45, 2],
  devor: ['🔨', "To'siqni tuzatish", "Shamol to'sig'imni yiqitib ketdi", 75, 3],
  bozor: ['🚗', "Bozorga olib borish", "Bozorga borishim kerak edi…", 60, 3],
  non: ['🫓', 'Non olib kelish', 'Uyda non qolmabdi…', 35, 2],
  otin: ['🪵', "O'tin olib kelish", "O'tinim tugab qoldi…", 55, 2],
  baliq: ['🐟', 'Baliq tutib kelish', 'Bitta baliq kerak edi…', 70, 2],
};
const TYPES = Object.keys(ERR);
export const TITLES = [[0, 'Yangi kelgan'], [5, "Yaxshi qo'shni"], [15, 'Hurmatli inson'], [30, "Mahallaning g'ururi"], [60, 'Oqsoqol']];
export const titleOf = (h) => { let t = TITLES[0][1]; for (const [n, s] of TITLES) if (h >= n) t = s; return t; };

export function initTopshiriq(game) {
  const { scene, car } = game, st = game.state, pl = game.player, L = game.live, HY = game.hayot, IN = game.interior, IS = game.ish;
  const npcs = L._dbg.npcs, places = game.site.places;
  const E = { cur: null }; game.topshiriq = E;
  const toast = (m, k) => game.toast(m, k), sfx = (n, k) => game.audio.sfx(n, k), fx = () => game.fx;
  const rnd = Math.random, pick = (a) => a[(rnd() * a.length) | 0];
  st.errands = st.errands || {}; if (typeof st.hurmat !== 'number') st.hurmat = 0;
  const gy = (x, z) => T.ground(x, z, 1e9).y;
  const freeSpot = (x, z, r = 0.6) => { const si = T.siteInfo(x, z); if (si.roadD < 2 || si.slope > 0.32 || si.y < si.water + 0.4) return false; for (const o of COL.query(x, z, r + 1.5)) { if (o.dead) continue; let qx = o.x, qz = o.z; if (o.t === 1) { const sx = o.x2 - o.x, sz = o.z2 - o.z, t = clamp(((x - o.x) * sx + (z - o.z) * sz) / (sx * sx + sz * sz || 1), 0, 1); qx = o.x + sx * t; qz = o.z + sz * t; } if (Math.hypot(x - qx, z - qz) < o.r + r) return false; } return true; };
  const scatter = (cx, cz, r0, r1, n, gap = 3) => { const out = []; for (let t = 0; t < 200 && out.length < n; t++) { const a = rnd() * 6.283, d = r0 + rnd() * (r1 - r0), x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d; if (freeSpot(x, z) && !out.some((p) => Math.hypot(p.x - x, p.z - z) < gap)) out.push({ x, z, y: gy(x, z), a }); } return out; };

  // ================= MODELLAR =================
  const mesh = (g) => { const m = new THREE.Mesh(g.build(), MAT.flat); m.castShadow = true; return m; };
  // echki: o'tda ko'rinsin — kattaroq, jigarrang-oq ola, qora bosh va qizil bo'yinbog' (qo'ng'iroqcha)
  const goat = (() => { const g = new GB(3301); g.jit = 0.02; g.color(0xf2ece0).blob(0.32, 1, { cy: 0.62, sx: 0.8, sz: 1.5, shade: 0.12 }); g.color(0x8a5a32).blob(0.2, 1, { cx: 0.1, cy: 0.74, cz: -0.12, sx: 0.85, sz: 1.3 }).blob(0.15, 1, { cx: -0.12, cy: 0.7, cz: 0.18, sz: 1.2 });
    g.color(0x3a2e26).push().translate(0, 0.86, 0.44).rotX(-0.5).blob(0.13, 1, { sz: 1.45 }).pop(); g.color(0xd8c8a8); for (const sx of [-0.06, 0.06]) g.push().translate(sx, 1.0, 0.4).rotX(-0.9).cyl(5, 0.02, 0.008, 0, 0.2).pop();
    g.color(0x3a2e26).blob(0.04, 0, { cx: 0, cy: 0.7, cz: 0.62, sy: 1.6 }); g.color(0xd8392b).push().translate(0, 0.8, 0.36).rotX(-0.9).cyl(10, 0.12, 0.12, -0.025, 0.025, { cap: true }).pop(); g.color(0xf0c040).blob(0.04, 0, { cy: 0.66, cz: 0.46 });
    g.color(0x4a3a2c); for (const [x, z] of [[-0.12, -0.3], [0.12, -0.3], [-0.12, 0.3], [0.12, 0.3]]) g.box(x, 0.24, z, 0.06, 0.48, 0.06); g.color(0xf2ece0).box(0, 0.7, -0.5, 0.05, 0.12, 0.05);
    const m = mesh(g); m.scale.setScalar(1.45); const r = new THREE.Group(); r.add(m); r.visible = false; scene.add(r); return r; })();
  // topshiriq hayvonlari ustidagi yashil ko'rsatkich (uzoqdan ham ko'rinadi: masofaga qarab kattalashadi)
  const markMat = new THREE.MeshBasicMaterial({ color: 0x7fe08a, fog: false }), markGeo = (() => { const g = new GB(3302); g.jit = 0; g.color(0xffffff).push().rotX(Math.PI).cyl(4, 0.2, 0, -0.22, 0.12, { cap: true }).pop().box(0, 0.24, 0, 0.09, 0.2, 0.09); return g.build(); })();
  const marks = [0, 1, 2].map(() => { const m = new THREE.Mesh(markGeo, markMat); m.visible = false; scene.add(m); return m; });
  const placeMark = (m, x, y, z, h, t, i) => { const d = Math.hypot(x - game.camera.position.x, z - game.camera.position.z), k = clamp(d / 14, 1.2, 5); m.visible = true; m.scale.setScalar(k); m.position.set(x, y + h + 0.35 * k + Math.sin(t * 3 + i) * 0.12 * k, z); m.rotation.y = t * 2; };
  const hens = [0, 1, 2].map((i) => { const g = new GB(3311 + i); g.jit = 0.02; const c = [0xf2ead8, 0xb86a2a, 0x3a2a22][i]; g.color(c).blob(0.17, 1, { cy: 0.24, sz: 1.3, shade: 0.1 }); g.color(c).blob(0.09, 1, { cy: 0.42, cz: 0.14 }); g.color(0xd8392b).box(0, 0.53, 0.14, 0.025, 0.06, 0.08); g.color(0xf0b83a).box(0, 0.42, 0.24, 0.03, 0.03, 0.06); g.color(c).push().translate(0, 0.3, -0.2).rotX(0.7).box(0, 0.08, 0, 0.12, 0.16, 0.04).pop(); g.color(0xe0a040); for (const sx of [-0.05, 0.05]) g.box(sx, 0.06, 0, 0.02, 0.12, 0.02); const m = mesh(g); m.geometry.scale(1.35, 1.35, 1.35); m.visible = false; scene.add(m); return m; });
  const fences = [0, 1, 2].map((i) => { const g = new GB(3321 + i); g.jit = 0.03; g.color(0x8a6a44); for (const sx of [-0.8, 0.8]) g.box(sx, 0.55, 0, 0.1, 1.1, 0.1); for (const y of [0.35, 0.8]) g.box(0, y, 0, 1.8, 0.08, 0.05); g.color(0x6e5232); for (let k = 0; k < 5; k++) g.box(-0.6 + k * 0.3, 0.55, 0.04, 0.08, 0.9, 0.03); const r = new THREE.Group(); const m = mesh(g); m.position.y = 0; r.add(m); r.inner = m; r.visible = false; scene.add(r); return r; });
  const carry = { sumka: (g) => { g.color(0x8a3a5a).blob(0.16, 1, { sy: 1.0, sz: 0.6 }); g.color(0x5a2a3a).push().translate(0, 0.15, 0).rotX(Math.PI / 2).cyl(8, 0.1, 0.1, -0.015, 0.015).pop(); g.color(0x3f9a58).blob(0.07, 0, { cy: 0.17, cz: 0.02 }); },
    suv: (g) => { g.color(0x3d74a6).cyl(10, 0.14, 0.11, -0.16, 0.12, { cap: true }); g.color(0x9fd8ff).cyl(10, 0.13, 0.13, 0.1, 0.11, { cap: true }); g.color(0x8a909c).push().translate(0, 0.12, 0).rotZ(Math.PI / 2).cyl(6, 0.008, 0.008, -0.14, 0.14).pop(); },
    xat: (g) => { g.color(0xf2ead8).box(0, 0, 0, 0.2, 0.13, 0.01); g.color(0xd8392b).box(0, 0, 0.006, 0.04, 0.04, 0.005); },
    tovuq: (g) => { g.color(0xb88a4a).cyl(10, 0.18, 0.13, -0.1, 0.06, { cap: true }); g.color(0xf2ead8).blob(0.09, 1, { cy: 0.08, cx: -0.05 }); g.color(0xb86a2a).blob(0.08, 1, { cy: 0.08, cx: 0.07 }); g.color(0xd8392b).box(0.07, 0.17, 0.05, 0.02, 0.04, 0.05); } };
  const carryM = {}; for (const k in carry) { const g = new GB(3330); g.jit = 0.01; carry[k](g); const m = mesh(g); m.position.set(0.02, 0.0, 0.2); carryM[k] = m; }
  const wear = (k) => { for (const id in carryM) { const m = carryM[id], on = id === k && pl.onFoot; if (on && m.parent !== pl.rig.chest) pl.rig.chest.add(m); else if (!on && m.parent) m.parent.remove(m); } };
  // nishon nuri (yashil) va topshiriq beruvchilar ustidagi «!» belgisi
  const beamMat = new THREE.MeshBasicMaterial({ color: 0x7fe08a, transparent: true, opacity: 0.38, depthWrite: false, fog: false });
  const beam = new THREE.Group(); { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 34, 10, 1, true), beamMat); b.position.y = 17; beam.add(b); const rg = new THREE.Mesh(new THREE.RingGeometry(0.8, 1.05, 24), new THREE.MeshBasicMaterial({ color: 0x7fe08a, transparent: true, opacity: 0.75, depthWrite: false, fog: false, side: THREE.DoubleSide })); rg.rotation.x = -Math.PI / 2; rg.position.y = 0.08; beam.add(rg); beam.visible = false; scene.add(beam); }
  const bangMat = new THREE.MeshBasicMaterial({ color: 0xffd23a, fog: false }), bangGeo = (() => { const g = new GB(3340); g.jit = 0; g.color(0xffffff).box(0, 0.16, 0, 0.07, 0.24, 0.07); g.box(0, -0.03, 0, 0.07, 0.07, 0.07); return g.build(); })();
  const bang = (o) => { if (!o.bang) { o.bang = new THREE.Mesh(bangGeo, bangMat); o.bang.position.y = 2.42; o.rig.root.add(o.bang); } return o.bang; };
  const showBeam = (x, z) => { if (x == null) { beam.visible = false; return; } beam.visible = true; beam.position.set(x, gy(x, z), z); };

  // ================= TAKLIFLAR (kim nima so'raydi) =================
  const houseDoors = () => game.site.houses.map((h) => { const dd = h.hz + 1.4; return { x: h.x + Math.sin(h.yaw) * dd, z: h.z + Math.cos(h.yaw) * dd }; });
  const wells = () => BK.SPOTS.filter((s) => s.k === 'well'), stalls = () => BK.SPOTS.filter((s) => s.k === 'stall');
  const placeName = (id) => (places[id] && places[id].name) || 'qishloq';
  // har tur uchun shu odam yonida bajarsa bo'ladimi (kerakli joy topiladimi)
  const feasible = (type, o) => {
    if (type === 'sumka') return houseDoors().some((p) => { const d = Math.hypot(p.x - o.x, p.z - o.z); return d > 35 && d < 260; });
    if (type === 'xat') return npcs.some((q) => q !== o && q.place !== o.place && Math.hypot(q.x - o.x, q.z - o.z) < 1600);
    if (type === 'suv') return wells().some((w) => Math.hypot(w.x - o.x, w.z - o.z) < 700);
    if (type === 'bozor') return stalls().some((s) => { const d = Math.hypot(s.x - o.x, s.z - o.z); return d > 160 && d < 2200; }) || Object.values(places).some((p) => p.board && p.id !== o.place && Math.hypot(p.board.x - o.x, p.board.z - o.z) > 300);
    return true;
  };
  const assign = (o, i) => { const pool = TYPES.filter((t) => feasible(t, o)); o.err = pool.length ? pool[(i == null ? (rnd() * pool.length) | 0 : (i * 7 + 3) % pool.length)] : null; };
  // boshida har ikkinchi odamda topshiriq bor (birinchisida yo'q — oddiy suhbat), qolganlarida vaqt o'tib paydo bo'ladi; bir vaqtda 7 tagacha
  npcs.forEach((o, i) => { o.err = null; o.errCool = 0; if (i > 0 && i % 2 === 0) assign(o, i); else o.errCool = 120 + i * 17; });
  const MAXOFF = 7, offers = () => npcs.reduce((n, o) => n + (o.err ? 1 : 0), 0);
  E.offerOf = (o) => (o.err && o.role === 'talk' && !(o.errCool > 0) ? o.err : null);

  // ================= SUHBAT MATNLARI =================
  const lines = (type, o, D) => ({
    sumka: ['Voy, bolam, yaxshi keldingiz!', "Bozordan qaytuvdim, sumkam og'ir — oyog'im og'riyapti.", "Uyimgacha ko'tarishib yuborolmaysizmi? Eshigi oldida yashil nur yonib turibdi."],
    xat: ['Assalomu alaykum! Bir iltimosim bor edi.', `${D.who ? D.who.name : 'Qarindoshim'} ${placeName(D.who && D.who.place)}da turadi — telefoni yo'q, xat yozdim.`, "Shuni unga yetkazib bersangiz, duo qilaman!"],
    echki: ['Echkim arqonini uzib qochib ketdi!', "Shu atrofda o'tlab yurgan bo'lsa kerak — uzoqqa ketmagan.", "Topib, yetaklab kelsangiz, xursand bo'lardim."],
    tovuq: ["Katakning eshigini ochiq qoldiribman…", "Uchta tovuqim hovlidan chiqib ketdi — atrofda yugurib yuribdi.", "Ushlab berolmaysizmi? Men yugurolmayman-da."],
    suv: ['Bolam, bugun havo issiq, quduq esa uzoqda.', "Mana shu chelakni quduqdan to'ldirib kelsangiz.", "Choy qo'yaman, sizga ham bir piyola quyib beraman!"],
    devor: ["Kecha shamol to'sig'imni yiqitib ketdi.", "Uch joyi qiyshayib qoldi — mollar chiqib ketmasin deb qo'rqaman.", "Tuzatib qo'yolmaysizmi? Ish ko'p emas."],
    bozor: ['Bozorga borishim kerak edi, avtobus esa hali kelmayapti…', `${D.destName || 'Bozor'}gacha mashinangizda olib borolmaysizmi?`, "Yo'lkirasini beraman, xafa qilmayman!"],
    non: ["Nevaralar mehmonga keladi, uyda non qolmabdi.", "Do'kondan yoki tandirdan ikkita issiq non olib kelib berolmaysizmi?", "Pulini o'zim qaytaraman, ustiga rahmat ham aytaman!"],
    otin: ["Kechalari salqin bo'lyapti, o'tinim tugab qoldi.", "To'rtta o'tin topib kelsangiz — tandirni yoqardim.", "O'rmonda quruq shoxlar ko'p, daraxtni silkitsangiz ham tushadi."],
    baliq: ["Kampirim baliq sho'rva qilaman deb turibdi.", "Bitta baliq tutib kelsangiz — o'g'lim bugun qaytmaydi.", "Qarmog'ingiz bo'lsa, ko'l yoki daryodan tez tutasiz."],
  }[type]);
  const THANKS = { sumka: "Rahmat, bolam! Ilohim, umringiz uzoq bo'lsin!", xat: 'Voy, singlimdan xat! Rahmat sizga, katta rahmat!', echki: "Ana, qochoqni topibsiz-ku! Barakalla, yigit!", tovuq: "Hammasi joyida! Endi katak eshigini yopib qo'yaman 😄", suv: 'Rahmat! Choy damlay qolay — kelib turing!', devor: "Zo'r bo'libdi! Usta ekansiz-ku!", bozor: "Yetib keldik! Rahmat, yaxshi odam ekansiz.", non: "Issiqqina non! Nevaralar xursand bo'ladi — rahmat!", otin: "Endi kechasi ham issiq bo'ladi. Rahmat!", baliq: "Qanday chiroyli baliq! Kampirim xursand bo'ladi." };

  // ================= TOPSHIRIQNI BOSHLASH =================
  const prep = (type, o) => { // tur bo'yicha ma'lumot (manzil, buyumlar) tayyorlanadi
    const D = { type, o, t: 0, rw: ERR[type][3], h: ERR[type][4] };
    if (type === 'sumka') { const c = houseDoors().filter((p) => { const d = Math.hypot(p.x - o.x, p.z - o.z); return d > 35 && d < 260; }); if (!c.length) return null; D.dest = pick(c); D.rw += Math.round(Math.hypot(D.dest.x - o.x, D.dest.z - o.z) * 0.12); }
    else if (type === 'xat') { const c = npcs.filter((q) => q !== o && q.place !== o.place && Math.hypot(q.x - o.x, q.z - o.z) < 1600); if (!c.length) return null; D.who = pick(c); D.rw += Math.round(Math.hypot(D.who.x - o.x, D.who.z - o.z) * 0.06); }
    else if (type === 'echki') { const p = scatter(o.x, o.z, 45, 110, 1)[0]; if (!p) return null; D.goat = p; }
    else if (type === 'tovuq') { const p = scatter(o.x, o.z, 9, 32, 3, 4); if (p.length < 3) return null; D.hens = p.map((q) => Object.assign(q, { got: 0 })); }
    else if (type === 'suv') { const w = wells().filter((q) => Math.hypot(q.x - o.x, q.z - o.z) < 700).sort((a, b) => Math.hypot(a.x - o.x, a.z - o.z) - Math.hypot(b.x - o.x, b.z - o.z))[0]; if (!w) return null; D.well = w; D.full = 0; }
    else if (type === 'devor') { const p = scatter(o.x, o.z, 5, 14, 3, 2.6); if (p.length < 3) return null; D.fence = p.map((q) => Object.assign(q, { ok: 0 })); }
    else if (type === 'bozor') { const s = stalls().filter((q) => { const d = Math.hypot(q.x - o.x, q.z - o.z); return d > 160 && d < 2200; }); let dst = s.length ? pick(s) : null, nm = 'Bozor';
      if (dst) { let bp = null, bd = 1e9; for (const id in places) { const p = places[id]; if (!p.board) continue; const d = Math.hypot(p.board.x - dst.x, p.board.z - dst.z); if (d < bd) { bd = d; bp = p; } } if (bp) nm = bp.name; }
      else { const c = Object.values(places).filter((p) => p.board && p.id !== o.place && Math.hypot(p.board.x - o.x, p.board.z - o.z) > 300); if (!c.length) return null; const p = pick(c); dst = { x: p.board.x + 5, z: p.board.z + 5 }; nm = p.name; }
      D.dest = { x: dst.x, z: dst.z }; D.destName = nm; D.stage = 'pick'; D.rw += Math.round(Math.hypot(dst.x - o.x, dst.z - o.z) * 0.05); }
    return D; };
  E.offer = (o) => { const type = E.offerOf(o); if (!type) return null; if (!o.draft || o.draft.type !== type) o.draft = prep(type, o); if (!o.draft) { assign(o); return null; } return o.draft; };
  const showModels = (D) => { const ty = D.type; // topshiriq buyumlarini joyiga qo'yish (boshlanganda va saqlovdan tiklanganda)
    if (ty === 'echki') { goat.visible = true; goat.position.set(D.goat.x, D.goat.y, D.goat.z); goat.rotation.y = D.goat.a; }
    if (ty === 'tovuq') D.hens.forEach((p, i) => { const m = hens[i]; m.visible = !p.got; m.position.set(p.x, p.y, p.z); m.rotation.y = p.a; });
    if (ty === 'devor') D.fence.forEach((p, i) => { const f = fences[i]; f.visible = true; f.position.set(p.x, p.y, p.z); f.rotation.y = p.a; f.inner.rotation.z = p.ok ? 0 : 0.75; }); };
  E.start = (o) => { const D = E.offer(o); if (!D) return false; if (E.cur) { toast('Avval joriy topshiriqni bajaring yoki voz keching [X]', 'bad'); return false; }
    E.cur = D; o.draft = null; o.waveT = 1.5; sfx('start'); D.tied = false; showModels(D);
    const ty = D.type;
    game.banner(`${ERR[ty][0]} ${ERR[ty][1]}`, `${o.name} · mukofot ~${som(D.rw)} so'm · 🤝 +${D.h}`, 'gold'); route(); return true; };
  const clearModels = () => { for (const m of marks) m.visible = false; goat.visible = false; for (const m of hens) m.visible = false; for (const f of fences) f.visible = false; wear(null); showBeam(null); game.setWaypoint(null); };
  E.quit = () => { const D = E.cur; if (!D) return; if (D.type === 'bozor' && D.stage === 'ride') D.o.ride = false; E.cur = null; clearModels(); D.o.errCool = 30; toast(`${D.o.name}: «Mayli, boshqa safar…» — topshiriqdan voz kechdingiz`); drawHud(); };
  // keyingi nishon: nur, GPS va xaritadagi nuqta
  const target = () => { const D = E.cur; if (!D) return null; const o = D.o;
    switch (D.type) {
      case 'sumka': return D.dest; case 'xat': return D.who;
      case 'echki': return D.tied ? o : D.goat; case 'tovuq': { const h = D.hens.find((q) => !q.got); return h || o; }
      case 'suv': return D.full ? o : D.well; case 'devor': return D.fence.find((q) => !q.ok) || o;
      case 'bozor': return D.stage === 'pick' ? o : D.dest; default: return o; } };
  const o0 = (D) => D.o;
  const route = () => { const p = target(); if (!p) return; showBeam(p.x, p.z); game.setWaypoint(p.x, p.z, true); };
  const done = (msg) => { const D = E.cur, o = D.o; E.cur = null; clearModels(); const old = Math.floor(st.hurmat / 10);
    game.addMoney(D.rw, `Yordam: ${ERR[D.type][1]}`); st.hurmat += D.h; st.errands.done = (st.errands.done || 0) + 1; st.errands[D.type] = (st.errands[D.type] || 0) + 1; if (L.karma) L.karma(1); L.count && L.count('gift');
    o.errCool = 200 + rnd() * 160; o.err = null; o.waveT = 2.2; sfx('medal'); fx().burst(14, o.x, o.y + 2.0, o.z, 1.2, 1.4, 0.3, 0xff6a8a, 0.9, 1.2, 2, 0.2);
    toast(`${o.name}: «${msg || THANKS[D.type]}» +${som(D.rw)} so'm · 🤝 hurmat +${D.h}`, 'gold');
    if (Math.floor(st.hurmat / 10) > old) { const gift = 100 * Math.floor(st.hurmat / 10); game.addMoney(gift, 'Hurmat sovg\'asi'); game.banner(`🤝 Hurmat: ${Math.floor(st.hurmat)}`, `«${titleOf(st.hurmat)}» — mahalla sizni hurmat qiladi · sovg'a +${som(gift)} so'm`, 'gold'); }
    drawHud(); game.save(); };
  E.done = done;

  // ================= [E] TAKLIFLARI =================
  const near = (p, px, pz, r) => p && Math.hypot(p.x - px, p.z - pz) < r;
  const ex0 = L.extra;
  L.extra = (offer, px, pz, p) => { ex0(offer, px, pz, p); if (IN.inside || HY.dlg) return; const D = E.cur;
    for (const o of npcs) { const d = Math.hypot(o.x - px, o.z - pz); if (d > 2.4 || o.ride) continue;
      if (D && D.o === o) { const tx = giverText(D); if (tx) offer(d - 0.02, tx[0], tx[1]); continue; }
      if (D && D.type === 'xat' && D.who === o) { offer(d - 0.02, `<kbd>E</kbd> Xatni ${o.name}ga topshirish ✉️`, () => { pl.yaw = Math.atan2(o.x - pl.p[0], o.z - pl.p[2]); pl.act('bend', 0.8, () => done(`${D.o.name}dan xat? Voy, rahmat! Unga salom ayting!`)); }); continue; }
      const ty = E.offerOf(o); if (ty && !D) offer(d - 0.01, `<kbd>E</kbd> ${o.name}: «${ERR[ty][2]}» 🙏`, () => { pl.yaw = Math.atan2(o.x - pl.p[0], o.z - pl.p[2]); o.waveT = 999; game.ui.open('topshiriq', { o }); }); }
    if (!D) return;
    if (D.type === 'sumka' && near(D.dest, px, pz, 2.8)) offer(-0.2, "<kbd>E</kbd> Sumkani eshik oldiga qo'yish 👜", () => pl.act('bend', 0.9, () => done()));
    if (D.type === 'echki' && !D.tied && near(D.goat, px, pz, 2.2)) offer(-0.2, "<kbd>E</kbd> Echkini arqonga bog'lash 🐐", () => pl.act('bend', 1.1, () => { D.tied = true; sfx('baa'); toast("🐐 Echki bo'ysundi — egasiga yetaklab boring"); route(); }));
    if (D.type === 'tovuq') for (const h of D.hens) if (!h.got && near(h, px, pz, 1.8)) { offer(-0.2, "<kbd>E</kbd> Tovuqni ushlash 🐔", () => pl.act('bend', 0.8, () => { h.got = 1; hens[D.hens.indexOf(h)].visible = false; sfx('pick'); const n = D.hens.filter((q) => q.got).length; toast(`🐔 Ushlandi! ${n}/3`, 'good'); route(); })); break; }
    if (D.type === 'suv' && !D.full && near(D.well, px, pz, 2.8)) offer(-0.2, "<kbd>E</kbd> Chelakni quduqdan to'ldirish 🪣", () => pl.act('bend', 1.3, () => { D.full = 1; sfx('splash', 0.3); toast("🪣 Chelak to'ldi — egasiga olib boring", 'good'); route(); }));
    if (D.type === 'devor') for (const f of D.fence) if (!f.ok && near(f, px, pz, 1.9)) { offer(-0.2, "<kbd>E</kbd> To'siqni tuzatish 🔨", () => { pl.yaw = Math.atan2(f.x - pl.p[0], f.z - pl.p[2]); pl.act('swing', 1.4, () => { f.ok = 1; fences[D.fence.indexOf(f)].inner.rotation.z = 0; sfx('hit', 0.4); fx().burst(6, f.x, f.y + 0.6, f.z, 1, 0.6, 0.2, 0x8a6a44, 0.7, 1, 4, 0.2); const n = D.fence.filter((q) => q.ok).length; toast(`🔨 Tuzatildi ${n}/3`, 'good'); if (n >= 3) setTimeout(() => toast(`${D.o.name} oldiga qaytib, xabar bering`), 900); route(); }, 'pick'); }); break; }
  };
  const giverText = (D) => { const o = D.o;
    switch (D.type) {
      case 'echki': return D.tied && near(goat.position, o.x, o.z, 4.5) ? ['<kbd>E</kbd> Echkini egasiga topshirish 🐐', () => done()] : [`${o.name}: «Echkimni topdingizmi?»`, () => {}];
      case 'tovuq': return D.hens.every((q) => q.got) ? ['<kbd>E</kbd> Tovuqlarni qaytarish 🐔', () => pl.act('bend', 0.9, () => done())] : [`${o.name}: «Yana ${D.hens.filter((q) => !q.got).length} ta qoldi!»`, () => {}];
      case 'suv': return D.full ? ['<kbd>E</kbd> Chelakni berish 🪣', () => pl.act('bend', 0.9, () => done())] : [`${o.name}: «Quduq ana u yerda — yashil nur»`, () => {}];
      case 'devor': return D.fence.every((q) => q.ok) ? ["<kbd>E</kbd> «Tuzatib qo'ydim!»", () => done()] : [`${o.name}: «Yana ${D.fence.filter((q) => !q.ok).length} joyi qoldi»`, () => {}];
      case 'non': return st.inv.bread >= 2 ? ['<kbd>E</kbd> Ikkita non berish 🫓', () => pl.act('bend', 0.8, () => { st.inv.bread -= 2; D.rw += 24; done(); })] : [`${o.name}: «Non topdingizmi? (sizda ${st.inv.bread || 0}/2)»`, () => {}];
      case 'otin': return st.inv.wood >= 4 ? ["<kbd>E</kbd> To'rtta o'tin berish 🪵", () => pl.act('bend', 0.9, () => { st.inv.wood -= 4; done(); })] : [`${o.name}: «O'tin kerak — sizda ${st.inv.wood || 0}/4»`, () => {}];
      case 'baliq': { const id = st.inv.fish > 0 ? 'fish' : st.inv.bigfish > 0 ? 'bigfish' : null; return id ? ['<kbd>E</kbd> Baliqni berish 🐟', () => pl.act('bend', 0.8, () => { st.inv[id]--; if (id === 'bigfish') D.rw += 60; done(); })] : [`${o.name}: «Baliq tutdingizmi?»`, () => {}]; }
      case 'bozor': return D.stage === 'pick' ? [`${o.name}: «Mashinangizni olib keling — yoningizga o'tiraman»`, () => {}] : null;
      default: return [`${o.name}: «Kutyapman, bolam»`, () => {}]; } };
  // transportda: yo'lovchini olish (bozorga)
  const carAct = () => { const D = E.cur; if (!D || D.type !== 'bozor' || pl.onFoot || car.speed > 3) return null; if (D.stage === 'pick' && Math.hypot(D.o.x - car.p[0], D.o.z - car.p[2]) < 11) return [`<kbd>E</kbd> ${D.o.name}ni mashinaga olish 🚗`, () => {
    if (game.carModel.bike || game.carModel.id === 'velo') return toast("Bu transportda yo'lovchiga joy yo'q — mashina oling", 'bad'); D.stage = 'ride'; D.o.ride = true; sfx('door'); toast(`${D.o.name}: «Rahmat! ${D.destName}ga, iltimos»`, 'gold'); route(); }]; return null; };
  const ue0 = L.useE; L.useE = () => { const a = carAct(); if (a && !HY.dlg) return a[1](); ue0(); };

  // ================= HUD =================
  const hud = document.createElement('div'); hud.className = 'panel tc jobhud'; hud.style.display = 'none';
  const line = (D) => { switch (D.type) {
    case 'sumka': return `Sumkani ${D.o.name}ning uyiga olib boring (yashil nur) · <kbd>E</kbd>`; case 'xat': return `Xatni ${D.who.name}ga yetkazing · ${placeName(D.who.place)}`;
    case 'echki': return D.tied ? `Echkini ${D.o.name}ga yetaklab boring` : 'Echkini toping (yashil nur) va arqonga bog\'lang';
    case 'tovuq': return D.hens.every((q) => q.got) ? `Tovuqlarni ${D.o.name}ga qaytaring` : `Tovuqlarni ushlang: ${D.hens.filter((q) => q.got).length}/3`;
    case 'suv': return D.full ? `Chelakni ${D.o.name}ga olib boring` : "Quduqdan chelakni to'ldiring";
    case 'devor': return D.fence.every((q) => q.ok) ? `${D.o.name}ga xabar bering` : `To'siqni tuzating: ${D.fence.filter((q) => q.ok).length}/3`;
    case 'bozor': return D.stage === 'pick' ? `Mashinada ${D.o.name} yoniga boring va <kbd>E</kbd>` : `${D.destName}ga olib boring — yetib to'xtang`;
    case 'non': return `Ikkita non olib keling (${Math.min(2, st.inv.bread || 0)}/2) — do'kon yoki tandir`; case 'otin': return `To'rtta o'tin olib keling (${Math.min(4, st.inv.wood || 0)}/4)`;
    case 'baliq': return `Bitta baliq tutib keling (${st.inv.fish || st.inv.bigfish ? '✓' : '0/1'})`; } return ''; };
  const drawHud = () => { const D = E.cur; if (!hud.parentNode && game.ui) game.ui.hud.appendChild(hud); if (!D || game.act) { hud.style.display = 'none'; return; } hud.style.display = '';
    hud.style.top = IS && IS.cur ? '112px' : ''; const k = line(D) + D.type + (IS && IS.cur ? 1 : 0); if (hud._k === k) return; hud._k = k;
    hud.innerHTML = `<h3>${ERR[D.type][0]} ${ERR[D.type][1]} · ${D.o.name}</h3><div class="ln">${line(D)}</div><div class="ln" style="opacity:.7;font-size:12px">mukofot ~${som(D.rw)} so'm · 🤝 +${D.h}${IS && IS.cur ? '' : ' · <kbd>X</kbd> — voz kechish'}</div>`; };
  ACTIONS.splice(ACTIONS.findIndex((a) => a.key === 'T'), 0, { key: 'X', codes: ['KeyX'], ok: (g) => !g.act && !(g.ish && g.ish.cur) && !!(g.topshiriq && g.topshiriq.cur), bar: () => 'Topshiriqdan voz kechish', run: (g) => g.topshiriq.quit() });

  // ================= KADR =================
  const up0 = L.update;
  L.update = (dt) => { up0(dt); const D = E.cur, t = game.time, foot = pl.onFoot;
    for (const o of npcs) { const ty = E.offerOf(o), vis = o.rig.root.visible; if (o.errCool > 0) { o.errCool -= dt; if (o.errCool <= 0 && !o.err) { if (offers() < MAXOFF) assign(o); else o.errCool = 60; } }
      if (o.ride) o.rig.root.visible = false;
      if (o.away && !o.ride) { o.away.t -= dt; if (o.away.t <= 0 && Math.hypot(o.x - pl.p[0], o.z - pl.p[2]) > 160) { const a = o.away; o.x = a.x; o.y = a.y; o.z = a.z; o.yaw0 = a.yaw; o.rig.root.position.set(a.x, a.y, a.z); o.away = null; } }
      const show = !!ty && !D && vis; if (show || o.bang) { const b = bang(o); b.visible = show; if (show) { b.rotation.y = t * 2.4; b.position.y = 2.42 + Math.sin(t * 3 + o.x) * 0.07; } }
      if (ty && !D && o.role === 'talk' && Math.hypot(o.x - pl.p[0], o.z - pl.p[2]) < 500) L.dots.push([o.x, o.z, '#ffd23a']); }
    if (D) {
      D.t += dt; const tg = target(); if (tg) { L.dots.push([tg.x, tg.z, '#7fe08a']); const ani = (D.type === 'echki' && !D.tied && tg === D.goat) || (D.type === 'tovuq' && tg !== o0(D)), pd = foot ? Math.hypot(tg.x - pl.p[0], tg.z - pl.p[2]) : 99; beam.visible = !(ani && pd < 40); // yaqinda hayvonni nur bo'yamasin — yashil ko'rsatkich yetarli
        if (beam.visible) { beam.position.set(tg.x, gy(tg.x, tg.z), tg.z); beamMat.opacity = 0.3 + 0.1 * Math.sin(t * 4); } if (game.way && Math.hypot(game.way.x - tg.x, game.way.z - tg.z) > 3 && game.way.auto) game.setWaypoint(tg.x, tg.z, true); }
      wear(D.type === 'sumka' ? 'sumka' : D.type === 'suv' && D.full ? 'suv' : D.type === 'xat' ? 'xat' : D.type === 'tovuq' && D.hens.some((q) => q.got) ? 'tovuq' : null);
      if (D.type === 'echki' && goat.visible) { const gp = goat.position; let mv = 0;
        if (D.tied) { const me = foot ? pl.p : car.p, yaw = foot ? pl.yaw : car.yaw, tx = me[0] - Math.sin(yaw) * (foot ? 1.5 : 4), tz = me[2] - Math.cos(yaw) * (foot ? 1.5 : 4), dx = tx - gp.x, dz = tz - gp.z, d = Math.hypot(dx, dz);
          if (d > 30) { gp.x = tx; gp.z = tz; } else if (d > 0.4) { const s = Math.min(d, (2 + d * 1.6) * dt); gp.x += dx / d * s; gp.z += dz / d * s; goat.rotation.y += angDiff(Math.atan2(dx, dz), goat.rotation.y) * Math.min(1, dt * 6); mv = s / dt; } }
        else { goat.rotation.y += Math.sin(t * 0.7) * dt * 0.3; } gp.y = gy(gp.x, gp.z) + Math.abs(Math.sin(t * 9)) * 0.05 * Math.min(1, mv); goat.children[0].rotation.x = mv > 0.3 ? 0 : Math.sin(t * 1.5) * 0.06; }
      for (const m of marks) m.visible = false;
      if (D.type === 'echki' && goat.visible && !D.tied) placeMark(marks[0], goat.position.x, goat.position.y, goat.position.z, 1.5, t, 0);
      if (D.type === 'tovuq') D.hens.forEach((h, i) => { if (!h.got) placeMark(marks[i], hens[i].position.x, hens[i].position.y, hens[i].position.z, 0.75, t, i); });
      if (D.type === 'tovuq') D.hens.forEach((h, i) => { if (h.got) return; const m = hens[i]; m.position.x = h.x + Math.sin(t * 1.3 + i) * 0.6; m.position.z = h.z + Math.cos(t * 1.1 + i * 2) * 0.6; m.position.y = gy(m.position.x, m.position.z) + Math.abs(Math.sin(t * 7 + i)) * 0.04; m.rotation.y = t * 1.2 + i; });
      if (D.type === 'bozor') { if (D.stage === 'pick') { const o = D.o; o.waveT = Math.hypot(o.x - car.p[0], o.z - car.p[2]) < 60 ? 1 : o.waveT; }
        else if (!foot && car.speed < 3 && Math.hypot(D.dest.x - car.p[0], D.dest.z - car.p[2]) < 16) { const o = D.o; o.ride = false; if (!o.away) o.away = { x: o.x, y: o.y, z: o.z, yaw: o.yaw0, t: 300 }; const nx = car.p[0] + Math.cos(car.yaw) * 2.6, nz = car.p[2] - Math.sin(car.yaw) * 2.6; o.x = nx; o.z = nz; o.y = gy(nx, nz); o.rig.root.position.set(nx, o.y, nz); o.rig.root.visible = true; done(); } }
      if (!foot) { const a = carAct(); if (a) L.prompt = a[0]; }
    }
    drawHud(); };

  // ================= OYNA: topshiriq taklifi =================
  const attach = (ui) => {
    ui.s_topshiriq = function (w, d, btn, x) {
      x(); const o = d && d.o, D = o && E.offer(o); if (!D) { w.innerHTML = '<h1>🙂</h1><p class="sub">Hozircha yordam kerak emas ekan.</p>'; return; } const ty = D.type, ls = lines(ty, o, D);
      w.innerHTML = `<h1>${ERR[ty][0]} ${ERR[ty][1]} <small>${o.name} · 🤝 sizning hurmatingiz: ${Math.floor(st.hurmat)} («${titleOf(st.hurmat)}»)</small></h1>
        <div class="card" style="flex-direction:row;gap:14px;align-items:flex-start"><div style="font-size:40px;line-height:1">🧓</div><div class="grow">${ls.map((q) => `<p style="margin:2px 0 6px;font-size:15.5px">«${q}»</p>`).join('')}</div></div>
        <div class="card" style="margin-top:8px"><h4>Mukofot</h4><p>~${som(D.rw)} so'm · 🤝 hurmat +${D.h}${ty === 'bozor' ? " · mashina kerak (velosiped emas)" : ty === 'non' ? " · non pulini qaytaradi" : ''}</p></div>
        <div class="row" style="margin-top:12px;gap:8px"><button data-a="ok" ${E.cur ? 'disabled' : ''}>${E.cur ? 'Avval joriy topshiriqni tugating' : 'Albatta, yordam beraman!'}</button><button class="sec" data-a="no">Hozir vaqtim yo'q</button></div>`;
      this.on({ ok: () => { this.close(); E.start(o); o.waveT = 1.5; }, no: () => { this.close(); o.waveT = 0; o.errCool = 20; toast(`${o.name}: «Mayli, bolam, keyinroq bo'lsa ham…»`); } });
    };
  };
  let ok = false; game.hooks.push(() => { if (!ok && game.ui) { ok = true; attach(game.ui); } });
  // telefon «Bugungi reja»ga: joriy topshiriq yoki yordam so'rayotganlar
  E.planRows = () => { const D = E.cur; if (D) { const tg = target(); return [{ id: 'err', ic: ERR[D.type][0], t: `Topshiriq: ${ERR[D.type][1]}`, s: line(D).replace(/<[^>]+>/g, ''), ok: true, go: tg ? [tg.x, tg.z] : null }]; }
    let best = null, bd = 1e9, n = 0; for (const o of npcs) if (E.offerOf(o)) { n++; const d = Math.hypot(o.x - pl.p[0], o.z - pl.p[2]); if (d < bd) { bd = d; best = o; } }
    return n ? [{ id: 'err', ic: '🤝', t: `${n} kishi yordam so'ramoqda`, s: `Eng yaqini — ${best.name} (${Math.round(bd)} m) · sariq «!» belgi`, ok: false, go: [best.x, best.z] }] : []; };
  // ================= SAQLOV: bajarilayotgan topshiriq (st.errCur) — qayta yuklanganda davom etadi =================
  const r2 = (v) => Math.round(v * 100) / 100, pt = (p) => { const o = { x: r2(p.x), z: r2(p.z) }; if (p.y != null) o.y = r2(p.y); if (p.a != null) o.a = r2(p.a); return o; };
  const ser = () => { const D = E.cur; if (!D) return null; const o = { type: D.type, oi: npcs.indexOf(D.o), on: D.o.name, rw: D.rw, h: D.h, t: Math.round(D.t) };
    if (D.dest) o.dest = pt(D.dest); if (D.destName) o.destName = D.destName; if (D.stage) o.stage = D.stage;
    if (D.who) { o.wi = npcs.indexOf(D.who); o.wn = D.who.name; }
    if (D.goat) { o.goat = pt(D.goat); o.tied = D.tied ? 1 : 0; if (D.tied) o.gp = pt(goat.position); }
    if (D.hens) o.hens = D.hens.map((q) => Object.assign(pt(q), { got: q.got ? 1 : 0 }));
    if (D.well) { o.well = pt(D.well); o.full = D.full ? 1 : 0; }
    if (D.fence) o.fence = D.fence.map((q) => Object.assign(pt(q), { ok: q.ok ? 1 : 0 }));
    return o; };
  const sv0 = game.save; game.save = () => { try { st.errCur = ser(); } catch (e) { st.errCur = null; } sv0(); };
  E.ser = ser;
  const npcOf = (i, nm) => { const q = npcs[i]; if (q && q.name === nm) return q; return npcs.find((n) => n.name === nm) || null; };
  const P = (p) => (p && isFinite(p.x) && isFinite(p.z) ? { x: p.x, z: p.z, y: isFinite(p.y) ? p.y : gy(p.x, p.z), a: isFinite(p.a) ? p.a : 0 } : null);
  const rebuild = (S, o) => { const ty = S.type, D = { type: ty, o, t: +S.t || 0, rw: isFinite(S.rw) ? S.rw : ERR[ty][3], h: isFinite(S.h) ? S.h : ERR[ty][4] };
    if (ty === 'sumka') { D.dest = P(S.dest); return D.dest && D; }
    if (ty === 'xat') { D.who = npcOf(S.wi, S.wn); return D.who && D.who !== o && D; }
    if (ty === 'echki') { D.goat = P(S.goat); D.tied = !!S.tied; return D.goat && D; }
    if (ty === 'tovuq' || ty === 'devor') { const a = ty === 'tovuq' ? S.hens : S.fence, k = ty === 'tovuq' ? 'got' : 'ok'; if (!Array.isArray(a) || a.length !== 3) return null; const L2 = a.map((q) => { const p = P(q); if (p) p[k] = q[k] ? 1 : 0; return p; }); if (L2.some((q) => !q)) return null; D[ty === 'tovuq' ? 'hens' : 'fence'] = L2; return D; }
    if (ty === 'suv') { const w0 = P(S.well); if (!w0) return null; D.well = wells().find((w) => Math.hypot(w.x - w0.x, w.z - w0.z) < 4); D.full = S.full ? 1 : 0; return D.well && D; }
    if (ty === 'bozor') { D.dest = P(S.dest); D.destName = S.destName || 'Bozor'; D.stage = S.stage === 'ride' && !st.foot ? 'ride' : 'pick'; return D.dest && D; }
    return D; }; // non, otin, baliq — faqat beruvchi kerak
  let restMsg = null;
  { const S = st.errCur; st.errCur = null;
    if (S && typeof S === 'object' && ERR[S.type]) { const o = npcOf(S.oi, S.on), D = o && rebuild(S, o);
      if (D) { E.cur = D; o.err = D.type; o.errCool = 0; o.draft = null; showModels(D);
        if (D.type === 'echki' && D.tied) { const g0 = P(S.gp) || D.goat; goat.position.set(g0.x, gy(g0.x, g0.z), g0.z); }
        if (D.type === 'bozor' && D.stage === 'ride') o.ride = true; else if (S.stage === 'ride') restMsg = [`${ERR[D.type][0]} ${o.name} sizni kutyapti — mashinada oldiga boring`, ''];
        route(); restMsg = restMsg || [`${ERR[D.type][0]} Topshiriq davom etmoqda: ${ERR[D.type][1]}`, ''];
      } else { if (o) { o.err = S.type; o.errCool = 0; o.draft = null; } // tiklab bo'lmadi: beruvchi topshiriqni qayta taklif qiladi, hech narsa yo'qolmaydi
        restMsg = [`${ERR[S.type][0]} «${ERR[S.type][1]}» topshirig'ini davom ettirib bo'lmadi${o ? ` — ${o.name} uni yana so'raydi (sariq «!»)` : ''}. Hech narsa yo'qotmadingiz`, 'bad']; } } }
  game.hooks.push(() => { if (restMsg && game.ui && game.mode === 'play') { toast(restMsg[0], restMsg[1]); restMsg = null; drawHud(); } });
  return E;
}
