// Transport bilan ishlar: yuk tashish (karyer), avtobus marshruti (Bog'iston), kuryer (bandargoh pochtasi), evakuator (aerodrom ustaxonasi), tez yordam (Bog'iston tibbiyot punkti), o't o'chirish (Oltin o'rmon), qor tozalash (Qorli lager), sayyohlarga gid (bandargoh)
import * as THREE from 'three';
import * as T from './terrain.js';
import * as COL from './colliders.js';
import { GB, MAT } from './geo.js';
import { makeRig, poseRig } from './rig.js';
import { vehById } from './vehicles.js';
import { UI } from './ui.js';
import { clamp, angDiff } from './util.js';

const som = (n) => Math.round(n).toLocaleString('ru-RU');
const pick = (a) => a[(Math.random() * a.length) | 0];
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
// transport toifasi bo'yicha imkoniyat: yuk sig'imi (quti), yo'lovchi o'rni
const CAP = { truck: 3, tractor: 2, van: 2, bus: 2, jeep: 1, car: 1, open: 1 };
const SEATS = { car: 3, jeep: 4, van: 6, bus: 12 };
// sayyohlarga hikoya: manzil → [savol, [to'g'ri, xato, xato]]
const QUIZ = {
  mayoq: ["Mayoq burnidagi minora nima uchun kerak?", ['Kechasi kemalarga yo\'l ko\'rsatadi', 'Shamol tegirmoni bo\'lgan', 'Qo\'riqchilar uyi']],
  qala: ["Ko'hna qal'a devorlari nimadan qurilgan?", ['Pishgan g\'isht va toshdan', 'Muzdan', 'Bambukdan']],
  tegirmon: ['Shamol tegirmonlari nima qilgan?', ['Bug\'doyni un qilgan', 'Suv isitgan', 'Musiqa chalgan']],
  bogiston: ["Bog'iston qishlog'ining bozor kunlari qachon?", ['Chorshanba va yakshanba', 'Faqat tunda', 'Yilda bir marta']],
  aerodrom: ['Eski aerodromda nima qilish mumkin?', ['Uchish yo\'lagida poyga va sakrash', 'Baliq ovlash', 'Chang\'i uchish']],
  dara: ['Qizil daraga rangini nima beradi?', ['Temirli qizil qoyalar', 'Lolazor', 'Bo\'yoq zavodi']],
  karvon: ['Karvonsaroy qadim zamonda nima bo\'lgan?', ['Savdo karvonlari tunaydigan joy', 'Kema bandargohi', 'Rasadxona']],
  kol: ["Ko'zgu ko'l nega shunday ataladi?", ['Suvi tiniq, tog\'lar aksi ko\'rinadi', 'Tubida ko\'zgu bor', 'Unda ko\'zgu yasaladi']],
  ormon: ["Oltin o'rmon nega «oltin»?", ['Kuzda barglari sarg\'ayib yaltiraydi', 'Oltin koni bor', 'Daraxtlari sun\'iy']],
  choqqi: ["Cho'qqida nima bor?", ['Yulduzlarni kuzatadigan rasadxona', 'Suv ombori', 'Paxta dalasi']],
};

export function initIshlar2(game, D) {
  const { scene, car } = game, st = game.state, pl = game.player, L = game.live;
  const toast = (m, k) => game.toast(m, k), sfx = (n, k) => game.audio.sfx(n, k), fx = () => game.fx, gy = D.gy, places = game.site.places;
  const cls = () => D.cls(), vid = () => D.vid(), vn = () => (vehById[vid()] || {}).name || 'transport';
  const at = (p, r, v = 2) => !pl.onFoot && car.speed < v && Math.hypot(p.x - car.p[0], p.z - car.p[2]) < r;
  const rlen = (x0, z0, x1, z1) => { const r = T.route(x0, z0, x1, z1); return r ? r.len : Math.hypot(x1 - x0, z1 - z0) * 1.4; };
  const mesh = (g) => { const m = new THREE.Mesh(g.build(), MAT.flat); m.castShadow = true; m.receiveShadow = true; return m; };
  const addG = (g) => { const m = mesh(g); scene.add(m); return m; };
  const crashes = () => st.stats.crashes;
  const giverAt = (id, pid, seed, name, look, r0 = 8, r1 = 45) => { const b = places[pid] && (places[pid].board || places[pid]); if (!b) return null; const p = D.spotNear(b.x, b.z, r0, r1, null, seed); if (!p) return null; const g = D.giver(id, p.x, p.z, D.roadYaw(p.x, p.z), name, look); return g; };
  const doors = () => game.site.houses.map((h) => { const dd = h.hz + 1.4; return { x: h.x + Math.sin(h.yaw) * dd, z: h.z + Math.cos(h.yaw) * dd, yaw: h.yaw }; }).filter((p) => { const si = T.siteInfo(p.x, p.z); return si.y > si.water + 0.5; });
  const bdPlaces = () => Object.values(places).filter((p) => p.board && p.id !== 'uy');
  // transportga yuk (qutilar) — modelning ustiga
  const crateG = (() => { const g = new GB(4101); g.jit = 0.02; g.color(0xb8864a).box(0, 0.3, 0, 0.6, 0.6, 0.6); g.color(0x8a5a32).box(0, 0.3, 0.305, 0.62, 0.08, 0.02).box(0, 0.3, -0.305, 0.62, 0.08, 0.02).box(0.305, 0.3, 0, 0.02, 0.08, 0.62); return g.build(); })();
  const load = new THREE.Group(); for (let i = 0; i < 3; i++) { const m = new THREE.Mesh(crateG, MAT.flat); m.castShadow = true; m.position.set((i - 1) * 0.66, 0, 0); load.add(m); }
  // qutilar qo'yiladigan joy: modelning orqa qismida o'rta chiziq bo'ylab eng baland yuza (kuzov tagi, tom yoki furgon usti) — uchburchaklar bo'yicha tik nur, model uchun bir marta
  const loadTop = (m, host, sp) => { if (m._ld) return m._ld; host.updateMatrixWorld(true); const inv = new THREE.Matrix4().copy(host.matrixWorld).invert(), M = new THREE.Matrix4(), a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), hit = new THREE.Vector3(), ray = new THREE.Ray(), down = new THREE.Vector3(0, -1, 0), zs = [-0.36, -0.26, -0.16].map((k) => k * sp.len), ys = zs.map(() => -9);
    m.root.traverse((o) => { if (!o.isMesh || !o.visible || !o.geometry || o === load || load.children.includes(o)) return; const P = o.geometry.attributes.position, I = o.geometry.index, n = I ? I.count : P.count; M.multiplyMatrices(inv, o.matrixWorld);
      for (let t = 0; t + 2 < n; t += 3) { const i0 = I ? I.getX(t) : t, i1 = I ? I.getX(t + 1) : t + 1, i2 = I ? I.getX(t + 2) : t + 2; a.fromBufferAttribute(P, i0).applyMatrix4(M); b.fromBufferAttribute(P, i1).applyMatrix4(M); c.fromBufferAttribute(P, i2).applyMatrix4(M);
        if (Math.min(a.x, b.x, c.x) > 0 || Math.max(a.x, b.x, c.x) < 0) continue; zs.forEach((z, k) => { if (Math.min(a.z, b.z, c.z) > z || Math.max(a.z, b.z, c.z) < z) return; ray.set(hit.set(0, 20, z), down); if (ray.intersectTriangle(a, b, c, false, hit)) ys[k] = Math.max(ys[k], hit.y); }); } });
    const y = Math.max(...ys); return (m._ld = [y > -9 ? y + 0.01 : sp.hgt * 0.6, zs[1]]); };
  const showLoad = (n) => { const m = game.carModel; if (!n) { if (load.parent) load.parent.remove(load); return; } const sp = car.spec, host = m.tilt || m.root; if (load.parent !== host) host.add(load); load.children.forEach((c, i) => (c.visible = i < n)); const top = loadTop(m, host, sp); load.position.set(0, top[0], top[1]); load.rotation.set(0, Math.PI / 2, 0); };
  const rigPool = [0, 1, 2, 3].map((i) => { const r = makeRig({ seed: 4200 + i * 11, shirt: [0x3d74a6, 0xd8602a, 0x8a54c8, 0x3f9a58][i], pants: 0x2a2c33, long: i % 2 === 1, hair: [0x2a1d16, 0x6a4a30, 0x1d1612, 0xb8bcc4][i] }); r.root.visible = false; scene.add(r.root); return r; });
  const putRig = (r, x, z, yaw) => { r.root.position.set(x, gy(x, z), z); r.root.rotation.y = yaw; r.root.visible = true; };
  const hideRigs = () => rigPool.forEach((r) => (r.root.visible = false));

  // ================= 1. YUK TASHISH =================
  const yg = giverAt('yuk', 'karyer', 0.4, 'Ombor mudiri Sherzod', { shirt: 0xe2902a, pants: 0x3a3f4c, vest: 0xffd23a, stache: true });
  let yard = null; if (yg) { const b = D.spotNear(yg.x, yg.z, 6, 30, (x, z, si) => si.roadD > 2 && si.roadD < 12, 1.7, 4); if (b) { yard = b; const g = new GB(4102); g.jit = 0.02; for (let i = 0; i < 7; i++) { const lx = (i % 3) * 0.66 - 0.66 + 4, lz = Math.floor(i / 3) * 0.66, ly = i === 6 ? 0.6 : 0; g.push().translate(yard.x + lx, yard.y + ly, yard.z + lz); g.color(0xb8864a).box(0, 0.3, 0, 0.6, 0.6, 0.6); g.color(0x8a5a32).box(0, 0.3, 0.305, 0.62, 0.08, 0.02); g.pop(); } addG(g); COL.addCircle(yard.x + 4, yard.z + 0.4, 1.2, yard.y - 1, yard.y + 1.4); yard.x -= 1; } }
  D.reg({ id: 'yuk', ic: '🚚', name: 'Yuk tashish', cat: 'veh', place: 'karyer', mins: 4, xp: 12, pay: "500–2 500 so'm", need: "yuk mashinasi ×3, traktor/furgon/pikap ×2, oddiy mashina ×1; mo'rt yukda urilmang",
    desc: "Karyer omboridan qutilarni boshqa manzilga eltish. Masofa va sig'imga qarab to'lanadi, vaqtida yetkazsangiz +15 %. Tajribali haydovchiga mo'rt (shisha) yuk — 1,6 baravar qimmat.",
    rules: () => "Transportda omborga (to'q sariq nur) to'xtab <kbd>E</kbd> — yuk ortiladi. Keyin manzil e'lonlar taxtasi yonidagi nurga borib to'xtang va <kbd>E</kbd>. Mo'rt yukda har urilish −25 %.",
    why: () => { const c = cls(); return c === 'bike' || vid() === 'kart' || vid() === 'bolid' ? `${vn()}ga yuk sig'maydi — boshqa transport oling` : null; },
    start(J) { if (!yard) return false; const cap = vid() === 'pikap' ? 2 : CAP[cls()] || 1, lvl = J.lvl; const far = lvl >= 2 ? 99999 : 3200; const c = bdPlaces().filter((p) => p.id !== 'karyer').map((p) => ({ p, d: rlen(yard.x, yard.z, p.board.x, p.board.z) })).filter((q) => q.d < far);
      const q = pick(c.length ? c : bdPlaces().filter((p) => p.id !== 'karyer').map((p) => ({ p, d: rlen(yard.x, yard.z, p.board.x, p.board.z) }))); const b = q.p.board, dst = D.spotNear(b.x, b.z, 8, 40, (x, z, si) => si.roadD < 8, 2.1, 1.5) || { x: b.x + 6, z: b.z + 6 };
      Object.assign(J, { cap, dist: q.d, dst, dname: q.p.name, stage: 'load', fragile: lvl >= 1 && Math.random() < 0.45, hits: 0, intro: `${q.p.name}ga ${cap} quti${lvl >= 1 ? '' : ''} · ${(q.d / 1000).toFixed(1)} km. Avval omborga to'xtab yukni oring [E].` });
      J.t = Math.round(q.d / 11 + 120); D.marks([yard]); game.setWaypoint(yard.x, yard.z, true); },
    carE(J) { if (J.stage === 'load' && at(yard, 11)) return ['<kbd>E</kbd> Yukni ortish 📦', () => { J.stage = 'go'; J.c0 = crashes(); showLoad(J.cap); sfx('door'); toast(`📦 ${J.cap} quti ortildi${J.fragile ? ' — 🍶 MO\'RT! Ehtiyot bo\'ling' : ''}. ${J.dname}ga!`, 'gold'); D.marks([J.dst]); game.setWaypoint(J.dst.x, J.dst.z, true); }];
      if (J.stage === 'go' && at(J.dst, 13)) return ['<kbd>E</kbd> Yukni tushirish 📦', () => { const capM = [1, 1, 1.45, 1.9][J.cap], fr = J.fragile ? 1.6 * Math.max(0.2, 1 - 0.25 * J.hits) : 1, ontime = J.t > 0 ? 1.15 : 1, n = (100 + J.dist * 0.26) * capM * fr * ontime; J.done = 1; showLoad(0);
        D.pay('yuk', n, `${J.cap} quti → ${J.dname}${J.fragile ? ' (mo\'rt)' : ''}`); D.finish(true, `${J.dname}: «Rahmat, yuk butun yetdi!»${J.fragile && J.hits ? ` · urilishlar: ${J.hits}` : ''}${ontime > 1 ? ' · vaqtida +15 %' : ''} · ${som(J.earn)} so'm`); }];
      return null; },
    tick(J) { if (J.stage === 'go') { const c = crashes() - J.c0; if (c > J.hits) { J.hits = c; if (J.fragile) toast(`🍶 Jaranglagan ovoz… mo'rt yuk shikastlandi (−25 %) · ${J.hits}`, 'bad'); } showLoad(pl.onFoot ? 0 : J.cap); } },
    timeout(J) { J.t = 0.001; J.late = 1; J.t = null; toast('⏰ Vaqt o\'tdi — vaqtida bonusi yo\'q, lekin yukni yetkazing', 'bad'); },
    meter: (J) => (J.fragile && J.stage === 'go' ? ['🍶 Mo\'rt yuk', Math.max(0.2, 1 - 0.25 * J.hits)] : null),
    line: (J) => (J.stage === 'load' ? `Omborga borib to'xtang · <kbd>E</kbd> — yuk ortish` : `${J.dname}ga eltish · ${J.cap} quti${J.fragile ? ' · 🍶 mo\'rt' : ''} · ${Math.round(Math.hypot(J.dst.x - car.p[0], J.dst.z - car.p[2]))} m`),
    end() { showLoad(0); } });

  // ================= 2. AVTOBUS MARSHRUTI =================
  const ag = giverAt('avtobus', 'bogiston', 2.2, 'Dispetcher Komil aka', { shirt: 0x2f6fd0, pants: 0x2a2c33, vest: 0x1d2a44, hair: 0x6a6a6a, stache: true }, 10, 60);
  const ROUTES = ['tegirmon', 'bandargoh', 'qala', 'uy', 'mayoq'];
  D.reg({ id: 'avtobus', ic: '🚌', name: 'Avtobus marshruti', cat: 'veh', place: 'bogiston', mins: 5, xp: 14, pay: "700–1 600 so'm", need: 'avtobus (yoki furgon/limuzin — kamroq o\'rin, ×0,6)',
    desc: "Bog'istondan qo'shni manzilgacha yo'nalish: har bekatda (sariq nur) to'xtang — yo'lovchilar tushadi va chiqadi. Jadvalga rioya qilsangiz va silliq haydasangiz, ko'proq to'lanadi.",
    rules: () => "Bekat nuriga 7 m ichida to'xtab turing — eshik o'zi ochiladi. Har bekat: 60 so'm + har chiqqan yo'lovchi 15 so'm, jadvaldan ±25 s ichida kelsangiz +40. Oxirgi bekatda bonus 300 × qulaylik (urilish −15 %).",
    why: () => (['avtobus', 'furgon', 'limuzin'].includes(vid()) ? null : "Avtobus kerak (furgon yoki limuzin ham bo'ladi) — ustaxonadan oling"),
    start(J) { if (!ag) return false; const bus = vid() === 'avtobus', dest = pick(ROUTES.filter((id) => places[id])), b = dest === 'uy' ? places.uy.home : places[dest].board, r = T.route(ag.x, ag.z, b.x, b.z); if (!r || r.pts.length < 10) return false;
      const pts = r.pts, len = D.pathLen(pts), n = clamp(Math.round(len / 420), 4, 7), stops = []; let acc = 0, nx = len / n;
      for (let i = 1; i < pts.length; i++) { acc += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); if (acc >= nx || i === pts.length - 1) { const nr = T.nearestRoad(pts[i][0], pts[i][1], 2); if (nr.edge >= 0) { const q = D.roadPt(nr.i, nr.hw * 0.55); q.due = acc / 10.5 + stops.length * 14 + 25; q.wait = 1 + ((Math.random() * 3) | 0); stops.push(q); } nx += len / n; if (stops.length >= n) break; } }
      Object.assign(J, { stops, k: 0, pax: 0, seats: bus ? 30 : 8, mul: bus ? 1 : 0.6, hits: 0, c0: crashes(), stopT: 0, dname: dest === 'uy' ? 'Mening uyim' : places[dest].name, intro: `${dest === 'uy' ? 'Uy' : places[dest].name} yo'nalishi · ${stops.length} bekat · ${(len / 1000).toFixed(1)} km` });
      this.showStop(J); },
    showStop(J) { const s = J.stops[J.k]; D.marks([Object.assign({ c: 0xffd23a }, s)]); game.setWaypoint(s.x, s.z, true); hideRigs(); for (let i = 0; i < Math.min(s.wait, 3); i++) putRig(rigPool[i], s.x - Math.cos(s.yaw) * (3.5 + i * 0.8), s.z + Math.sin(s.yaw) * (3.5 + i * 0.8), s.yaw + Math.PI / 2); },
    tick(J, dt) { const c = crashes() - J.c0; if (c > J.hits) { J.hits = c; toast('😣 Yo\'lovchilar: «Ehtiyot bo\'ling!» (qulaylik −15 %)', 'bad'); }
      const s = J.stops[J.k]; if (!s) return; for (let i = 0; i < 3; i++) if (rigPool[i].root.visible) poseRig(rigPool[i], Math.hypot(s.x - car.p[0], s.z - car.p[2]) < 40 ? 'wave' : 'idle', dt, 0);
      if (at(s, 7.5, 1.5)) { J.stopT += dt; if (J.stopT > 1.2) this.arrive(J); } else J.stopT = 0; },
    arrive(J) { const s = J.stops[J.k], last = J.k === J.stops.length - 1, off = last ? J.pax : Math.round(J.pax * Math.random() * 0.6), on = last ? 0 : Math.min(J.seats - (J.pax - off), s.wait); J.pax += on - off; J.stopT = 0; hideRigs(); sfx('door');
      const ontime = Math.abs(J.el - s.due) < 25, n = (60 + 15 * on + (ontime ? 40 : 0)) * J.mul; D.pay('avtobus', n, `${J.k + 1}-bekat`); J.done++; toast(`🚌 ${J.k + 1}-bekat: ${off} tushdi, ${on} chiqdi${ontime ? ' · jadval bo\'yicha ✓' : ''}`, 'good');
      if (last) { const q = Math.max(0.3, 1 - 0.15 * J.hits); D.pay('avtobus', 300 * q * J.mul, 'reys bonusi'); D.finish(true, `${J.dname} — oxirgi bekat! Qulaylik ${Math.round(q * 100)} % · jami ${som(J.earn)} so'm`); } else { J.k++; this.showStop(J); } },
    meter: (J) => ['😊 Qulaylik', Math.max(0.3, 1 - 0.15 * J.hits)],
    line: (J) => { const s = J.stops[J.k]; if (!s) return ''; const late = Math.round(J.el - s.due); return `${J.k + 1}/${J.stops.length}-bekat → ${J.dname} · yo'lovchi ${J.pax} · ${late > 25 ? `⏰ ${late} s kechikish` : late < -25 ? `jadvaldan ${-late} s oldin` : 'jadval ✓'}`; },
    end() { hideRigs(); } });

  // ================= 3. KURYER (POCHTA) =================
  const kg = giverAt('kuryer', 'bandargoh', 3.1, 'Pochtachi Zuhra opa', { shirt: 0x3a6ab8, pants: 0x2a2c33, long: true, hair: 0x2a1d16 });
  D.reg({ id: 'kuryer', ic: '📦', name: 'Kuryer (pochta)', cat: 'veh', place: 'bandargoh', mins: 5, xp: 12, pay: "600–1 500 so'm", need: 'har qanday transport (velosiped, skuter ham)',
    desc: "Pochtadan 4–5 ta posilkani orolning turli uylariga eltish. Tartibni o'zingiz tanlaysiz. Bittasi — shoshilinch: o'z vaqtida yetsa haqi ikki baravar.",
    rules: () => "Posilkalar — to'q sariq nurli eshiklar, shoshilinchi — qizil. Transportda eshik yoniga to'xtab <kbd>E</kbd> (derazadan) yoki piyoda eshik oldida <kbd>E</kbd>. Har posilka: 50 so'm + masofaga qarab, hammasi tez yetsa — bonus (300 gacha).",
    start(J) { if (!kg) return false; const n = J.lvl >= 2 ? 5 : 4, c = shuffle(doors().filter((p) => { const d = Math.hypot(p.x - kg.x, p.z - kg.z); return d > 300 && d < 2600; })); const pts = []; for (const p of c) { if (pts.some((q) => Math.hypot(q.x - p.x, q.z - p.z) < 120)) continue; pts.push(Object.assign({}, p)); if (pts.length >= n) break; }
      if (pts.length < 3) return false; pts.forEach((p) => { p.d = Math.hypot(p.x - kg.x, p.z - kg.z); }); const ex = pts[(Math.random() * pts.length) | 0]; ex.ex = 1; ex.c = 0xff4a4a; ex.dl = rlen(kg.x, kg.z, ex.x, ex.z) / 12 + 50;
      Object.assign(J, { pts, intro: `${pts.length} posilka · shoshilinchi (qizil) — ${Math.round(ex.dl)} s ichida` }); J.t = Math.round(pts.reduce((a, p) => a + p.d, 0) / 9 + 150); D.marks(pts); },
    give(J, p) { p.ok = 1; J.done++; const ex = p.ex && J.el < p.dl, n = (50 + p.d * 0.12) * (ex ? 2 : 1); D.pay('kuryer', n, ex ? 'shoshilinch, vaqtida!' : p.ex ? 'shoshilinch (kech)' : 'posilka'); sfx('pop'); fx().burst(8, p.x, gy(p.x, p.z) + 1.5, p.z, 1.6, 1.1, 0.35, 0xffb24a, 0.9, 1.6, 2, 0.2);
      const left = J.pts.filter((q) => !q.ok); D.marks(left); if (!left.length) { const b = Math.min(300, Math.round(J.t * 0.6)); if (b > 0) D.pay('kuryer', b, 'tezlik bonusi'); D.finish(true, `Barcha posilkalar egasida! · jami ${som(J.earn)} so'm`); } },
    carE(J) { if (car.speed > 3) return null; for (const p of J.pts) if (!p.ok && Math.hypot(p.x - car.p[0], p.z - car.p[2]) < 9) return ['<kbd>E</kbd> Posilkani derazadan uzatish 📦', () => this.give(J, p)]; return null; },
    extra(J, offer, px, pz) { for (const p of J.pts) { if (p.ok) continue; const d = Math.hypot(p.x - px, p.z - pz); if (d < 2.8) offer(d - 0.3, '<kbd>E</kbd> Posilkani topshirish 📦', () => pl.act('bend', 0.8, () => this.give(J, p))); } },
    tick(J) { const left = J.pts.filter((q) => !q.ok); if (!game.way && left.length) { let b = left[0], bd = 1e9; const q = D.pos(); for (const p of left) { const d = Math.hypot(p.x - q[0], p.z - q[2]) - (p.ex && J.el < p.dl ? 600 : 0); if (d < bd) { bd = d; b = p; } } game.setWaypoint(b.x, b.z, true); } },
    line: (J) => { const ex = J.pts.find((p) => p.ex && !p.ok); return `Yetkazildi ${J.done}/${J.pts.length}${ex ? ` · 🔴 shoshilinch: ${J.el < ex.dl ? Math.ceil(ex.dl - J.el) + ' s' : 'kech'}` : ''}`; } });

  // ================= 4. EVAKUATOR =================
  const eg = giverAt('evak', 'aerodrom', 4.2, 'Usta Farhod', { shirt: 0x3a4a5a, pants: 0x2a2c33, vest: 0xe2572f, hair: 0x2a1d16 }, 10, 70);
  const wreck = (() => { const g = new GB(4111); g.jit = 0.02; g.color(0x7a8a9a).box(0, 0.62, 0, 1.7, 0.55, 4.0); g.color(0x5a6a7a).box(0, 1.1, -0.2, 1.5, 0.5, 2.0); g.color(0x9fc8e8).box(0, 1.1, 0.82, 1.4, 0.4, 0.04);
    g.color(0x1d1e22); for (const [x, z] of [[-0.85, 1.3], [0.85, 1.3], [-0.85, -1.3], [0.85, -1.3]]) g.push().translate(x, 0.34, z).rotZ(Math.PI / 2).cyl(10, 0.34, 0.34, -0.12, 0.12, { cap: true }).pop(); g.color(0xf2f2ee).box(0, 1.37, -0.2, 0.3, 0.02, 0.6);
    const grp = new THREE.Group(); grp.add(mesh(g)); const hz = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.1, 0.1), new THREE.MeshBasicMaterial({ color: 0xffa020, fog: true })); hz.position.set(0, 0.8, -2.02); grp.add(hz); grp.hz = hz; grp.visible = false; scene.add(grp); return grp; })();
  const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1, 5), new THREE.MeshBasicMaterial({ color: 0x2a2c33 })); rope.visible = false; scene.add(rope);
  const garages = () => Object.values(places).filter((p) => p.garage).map((p) => ({ x: p.garage.x, z: p.garage.z, name: p.name }));
  D.reg({ id: 'evak', ic: '🛻', name: 'Evakuator', cat: 'veh', place: 'aerodrom', mins: 4, xp: 12, pay: "450–1 300 so'm", need: "to'rt g'ildirakli transport (yuk/pikap/traktor ×1,25)",
    desc: "Yo'lda buzilib qolgan mashinani trosga ilib, eng yaqin ustaxonaga sudrab borish. 80 km/soatdan oshsangiz tros uziladi!",
    rules: () => "Buzilgan mashina — to'q sariq nur va avariya chirog'i. Yoniga to'xtab <kbd>E</kbd> — trosga ilinadi. Ustaxonaga (yashil nur) olib borib to'xtang. 80 km/soatdan tez yursangiz yoki qattiq urilsangiz tros uziladi — qaytib qayta iling (−15 %).",
    why: () => (['bike', 'open'].includes(cls()) ? `${vn()} bilan sudrab bo'lmaydi — mashina oling` : null),
    start(J) { if (!eg) return false; const R = T.roads; let p = null; for (let k = 0; k < 60 && !p; k++) { const i = (Math.random() * R.n) | 0, d = Math.hypot(R.x[i] - eg.x, R.z[i] - eg.z); if (d < 450 || d > 1600 || R.bridge[i]) continue; const q = D.roadPt(i, R.hw[i] + 1.4); if (rlen(eg.x, eg.z, q.x, q.z) > 2400) continue;
        const gs = garages().map((g) => Object.assign(g, { sd: Math.hypot(g.x - q.x, g.z - q.z) })).filter((g) => g.sd < 2200).sort((a, b) => a.sd - b.sd).slice(0, 2); let b = null, bd = 1e9; for (const g of gs) { const d = rlen(q.x, q.z, g.x, g.z); if (d < bd) { bd = d; b = g; } } if (b && bd > 250 && bd < 2400) { p = q; J.gar = b; J.tl = bd; } }
      if (!p) return false; Object.assign(J, { w: p, stage: 'go', snaps: 0, hits: 0, wx: p.x, wz: p.z, wy: p.yaw, vm: ['truck', 'tractor'].includes(cls()) || vid() === 'pikap' ? 1.25 : 1, intro: `Buzilgan mashina ${Math.round(Math.hypot(p.x - eg.x, p.z - eg.z))} m nariroqda — trosga iling va ustaxonaga olib boring` });
      wreck.visible = true; wreck.position.set(p.x, gy(p.x, p.z), p.z); wreck.rotation.y = p.yaw + 0.2; D.marks([p]); game.setWaypoint(p.x, p.z, true); J.t = Math.round(Math.hypot(p.x - car.p[0], p.z - car.p[2]) / 8 + 240); },
    hook(J) { J.stage = 'tow'; J.c0 = crashes(); J.fast = 0; const b = J.gar; sfx('door'); toast(`🛻 Trosga ilindi! ${b.name} ustaxonasiga · 80 km/soatdan oshmang`, 'gold'); D.marks([Object.assign({ c: 0x5fd38a }, b)]); game.setWaypoint(b.x, b.z, true); },
    snap(J, why) { J.stage = 'go'; J.snaps++; rope.visible = false; sfx('hit'); toast(`💥 Tros uzildi${why ? ' — ' + why : ''}! Qaytib qayta iling (−15 %)`, 'bad'); D.marks([{ x: J.wx, z: J.wz }]); game.setWaypoint(J.wx, J.wz, true); },
    carE(J) { if (J.stage === 'go' && at({ x: J.wx, z: J.wz }, 10)) return ['<kbd>E</kbd> Mashinani trosga ilish 🪝', () => this.hook(J)]; return null; },
    tick(J, dt) { wreck.hz.material.color.setHex(Math.sin(game.time * 8) > 0 ? 0xffa020 : 0x553300);
      if (J.stage !== 'tow') return; if (pl.onFoot) return; const fw = [Math.sin(car.yaw), Math.cos(car.yaw)], back = car.spec.len / 2 + 3.2, tx = car.p[0] - fw[0] * back, tz = car.p[2] - fw[1] * back, dx = tx - J.wx, dz = tz - J.wz, d = Math.hypot(dx, dz);
      if (d > 0.2) { const s = Math.min(d, (car.speed + 2 + d * 2) * dt); J.wx += dx / d * s; J.wz += dz / d * s; } J.wy += angDiff(Math.atan2(car.p[0] - J.wx, car.p[2] - J.wz), J.wy) * Math.min(1, dt * 3);
      wreck.position.set(J.wx, gy(J.wx, J.wz), J.wz); wreck.rotation.y = J.wy; const ax = car.p[0] - fw[0] * car.spec.len / 2, az = car.p[2] - fw[1] * car.spec.len / 2, ay = car.p[1] - 0.2, bx = J.wx + Math.sin(J.wy) * 2, bz = J.wz + Math.cos(J.wy) * 2, by = wreck.position.y + 0.5;
      rope.visible = true; rope.position.set((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2); rope.scale.set(1, Math.hypot(ax - bx, ay - by, az - bz), 1); rope.lookAt(bx, by, bz); rope.rotateX(Math.PI / 2);
      if (car.speed > 22.2) { J.fast += dt; if (J.fast > 1.4) return this.snap(J, 'juda tez'); } else J.fast = Math.max(0, J.fast - dt); const c = crashes() - J.c0; if (c > J.hits) { J.hits = c; if (c >= 2) return this.snap(J, 'qattiq urildi'); toast('⚠️ Ehtiyot bo\'ling — yana urilsangiz tros uziladi', 'bad'); }
      if (at(J.gar, 15)) { const n = (200 + J.tl * 0.3) * J.vm * Math.max(0.3, 1 - 0.15 * J.snaps); J.done = 1; D.pay('evak', n, `${Math.round(J.tl)} m sudraldi`); D.finish(true, `${J.gar.name} ustaxonasi: «Barakalla, butun olib keldingiz!» · ${som(J.earn)} so'm`); } },
    meter: (J) => (J.stage === 'tow' ? ['🪝 Tezlik', clamp(1 - car.speed / 22.2, 0, 1), `${Math.round(car.speed * 3.6)}/80`] : null),
    line: (J) => (J.stage === 'tow' ? `Ustaxonaga sudrang: ${J.gar.name} · ${Math.round(Math.hypot(J.gar.x - car.p[0], J.gar.z - car.p[2]))} m${J.snaps ? ` · uzilish ${J.snaps}` : ''}` : `Buzilgan mashinaga boring va to'xtab <kbd>E</kbd> · ${Math.round(Math.hypot(J.wx - car.p[0], J.wz - car.p[2]))} m`),
    end() { wreck.visible = false; rope.visible = false; } });

  // ================= 5. TEZ YORDAM =================
  const vb = places.bogiston.board; let clinic = D.spotNear(vb.x, vb.z, 40, 130, (x, z, si) => si.roadD > 3 && si.roadD < 12 && si.slope < 0.15, 5.3, 4);
  if (clinic) { const yaw = D.roadYaw(clinic.x, clinic.z), g = new GB(4121); g.jit = 0.02; g.translate(clinic.x, clinic.y, clinic.z).rotY(yaw); g.color(0xf2f2ee).box(0, 1.4, -1.5, 5.2, 2.8, 3.6); g.color(0xd8d2c6).box(0, 2.9, -1.5, 5.6, 0.25, 4.0); g.color(0x9fc8e8).box(-1.5, 1.6, 0.31, 1.0, 0.8, 0.05).box(1.5, 1.6, 0.31, 1.0, 0.8, 0.05); g.color(0x3a6ab8).box(0, 1.05, 0.31, 1.0, 2.1, 0.05);
    g.color(0xe8342a).box(0, 3.6, -0.4, 0.9, 0.25, 0.08).box(0, 3.6, -0.4, 0.25, 0.9, 0.08); g.color(0x6b6e78).box(0, 3.1, -0.4, 0.08, 0.5, 0.08); addG(g); COL.addBox(clinic.x - Math.sin(yaw) * 1.5, clinic.z - Math.cos(yaw) * 1.5, 2.6, 1.8, yaw, clinic.y - 1, clinic.y + 3); clinic.door = { x: clinic.x + Math.sin(yaw) * 3, z: clinic.z + Math.cos(yaw) * 3 }; }
  const tg = clinic ? D.giver('tez', clinic.x + Math.sin(D.roadYaw(clinic.x, clinic.z) + 0.6) * 3.4, clinic.z + Math.cos(D.roadYaw(clinic.x, clinic.z) + 0.6) * 3.4, D.roadYaw(clinic.x, clinic.z), 'Doktor Malika', { shirt: 0xf6f6f2, pants: 0xe8e2d4, long: true, hair: 0x2a1d16, vest: 0xf6f6f2 }) : null;
  D.reg({ id: 'tez', ic: '🚑', name: 'Tez yordam', cat: 'veh', place: 'bogiston', where: "Bog'iston tibbiyot punkti", mins: 4, xp: 13, pay: "450–1 200 so'm", need: 'mashina (furgon — ×1,25); silliq haydang',
    desc: "Bemorni uyidan tibbiyot punktiga tez va ehtiyotkorlik bilan olib kelish. Har urilish va sakrash bemorga og'ir — haq kamayadi.",
    rules: () => "Bemor — to'q sariq nur (yonida qarindoshi qo'l silkitadi). Yoniga to'xtab <kbd>E</kbd>, so'ng tibbiyot punktiga (qizil xoch) tez qayting. To'lov: 250 + masofa × qulaylik + qolgan vaqt uchun bonus (250 gacha).",
    why: () => (['bike', 'open', 'tractor'].includes(cls()) ? `${vn()}da bemorni olib bo'lmaydi — mashina oling` : null),
    start(J) { if (!clinic) return false; const c = doors().filter((p) => { const d = Math.hypot(p.x - clinic.x, p.z - clinic.z); return d > 380 && d < 1700; }); if (!c.length) return false; const p = pick(c);
      Object.assign(J, { pt: p, stage: 'go', hits: 0, air: 0, c0: crashes(), vm: cls() === 'van' ? 1.25 : 1, intro: `Bemor ${Math.round(Math.hypot(p.x - clinic.x, p.z - clinic.z))} m nariroqda — tezroq!` }); J.t = Math.round(rlen(car.p[0], car.p[2], p.x, p.z) / 11 + rlen(p.x, p.z, clinic.x, clinic.z) / 11 + 70);
      putRig(rigPool[0], p.x, p.z, p.yaw); putRig(rigPool[1], p.x + Math.cos(p.yaw) * 1.4, p.z - Math.sin(p.yaw) * 1.4, p.yaw); D.marks([p]); game.setWaypoint(p.x, p.z, true); },
    carE(J) { if (J.stage === 'go' && at(J.pt, 11)) return ['<kbd>E</kbd> Bemorni mashinaga olish 🚑', () => { J.stage = 'back'; J.c0 = crashes(); J.back = rlen(J.pt.x, J.pt.z, clinic.x, clinic.z); hideRigs(); putRig(rigPool[1], J.pt.x, J.pt.z, J.pt.yaw); J.byeT = 4; sfx('door'); toast('🚑 Bemor mashinada. Tibbiyot punktiga — tez, lekin silliq!', 'gold'); D.marks([Object.assign({ c: 0xff4a4a }, clinic.door)]); game.setWaypoint(clinic.door.x, clinic.door.z, true); }]; return null; },
    tick(J, dt) { if (J.stage === 'go') { poseRig(rigPool[0], 'lie', dt, 0); poseRig(rigPool[1], 'wave', dt, 0); return; } if (J.byeT > 0 && (J.byeT -= dt) <= 0) hideRigs(); else if (J.byeT > 0) poseRig(rigPool[1], 'wave', dt, 0);
      const c = crashes() - J.c0; if (c > J.hits) { J.hits = c; toast('🤕 Bemor: «Voy… sekinroq!» (−20 %)', 'bad'); } if (car.airTime > 0.45 && !J.inAir) { J.inAir = 1; J.air++; toast('😵 Sakrash bemorga yoqmadi (−10 %)', 'bad'); } else if (car.airTime === 0) J.inAir = 0;
      if (at(clinic.door, 12)) { const q = Math.max(0.25, 1 - 0.2 * J.hits - 0.1 * J.air), n = (250 + J.back * 0.25) * q * J.vm + Math.min(250, Math.max(0, J.t) * 2); J.done = 1; D.pay('tez', n, `bemor yetkazildi · ${Math.round(q * 100)} %`); D.finish(true, `Doktor Malika: «O'z vaqtida keldingiz — bemor yaxshi bo'ladi!» · ${som(J.earn)} so'm`); } },
    meter: (J) => (J.stage === 'back' ? ['🩺 Bemor holati', Math.max(0.25, 1 - 0.2 * J.hits - 0.1 * J.air)] : null),
    timeout(J) { J.t = null; J.late = 1; toast('⏰ Kechikdingiz — baribir olib boring!', 'bad'); },
    line: (J) => (J.stage === 'go' ? `Bemorga boring · ${Math.round(Math.hypot(J.pt.x - car.p[0], J.pt.z - car.p[2]))} m · to'xtab <kbd>E</kbd>` : `Tibbiyot punktiga · ${Math.round(Math.hypot(clinic.door.x - car.p[0], clinic.door.z - car.p[2]))} m`),
    end() { hideRigs(); } });

  // ================= 6. O'T O'CHIRISH =================
  const og = giverAt('ot', 'ormon', 5.7, "O'rmon qo'riqchisi Botir", { shirt: 0x5a6a3a, pants: 0x3a3a2a, vest: 0xd8392b, hair: 0x2a1d16, stache: true });
  let hyd = null; if (og) { hyd = D.spotNear(og.x, og.z, 4, 20, (x, z, si) => si.roadD > 1.5 && si.roadD < 9, 0.9, 1.2); if (hyd) { const g = new GB(4131); g.jit = 0.02; g.translate(hyd.x, hyd.y, hyd.z); g.color(0xd8392b).cyl(10, 0.2, 0.2, 0, 0.8, { cap: true }).blob(0.22, 1, { cy: 0.85, sy: 0.6 }).push().translate(0, 0.55, 0).rotZ(Math.PI / 2).cyl(8, 0.08, 0.08, -0.32, 0.32, { cap: true }).pop(); g.color(0x8a909c).cyl(8, 0.06, 0.06, 0.95, 1.05, { cap: true }); addG(g); COL.addCircle(hyd.x, hyd.z, 0.3, hyd.y - 1, hyd.y + 1); } }
  const FL = 6, fireIM = new THREE.InstancedMesh(new THREE.ConeGeometry(0.7, 2.2, 7, 1, true), new THREE.MeshBasicMaterial({ color: 0xff7a1a, transparent: true, opacity: 0.85, depthWrite: false, fog: true, side: THREE.DoubleSide }), 4 * FL); fireIM.count = 0; fireIM.frustumCulled = false; scene.add(fireIM);
  const coreIM = new THREE.InstancedMesh(new THREE.ConeGeometry(0.4, 1.4, 6, 1, true), new THREE.MeshBasicMaterial({ color: 0xffe05a, transparent: true, opacity: 0.9, depthWrite: false, fog: true }), 4 * FL); coreIM.count = 0; coreIM.frustumCulled = false; scene.add(coreIM);
  const ashG = (() => { const g = new GB(4132); g.jit = 0.05; g.color(0x2a2420).cyl(12, 3.2, 3.4, 0, 0.06, { cap: true }); return g.build(); })(); const ashIM = new THREE.InstancedMesh(ashG, MAT.flat, 4); ashIM.count = 0; ashIM.frustumCulled = false; ashIM.receiveShadow = true; scene.add(ashIM);
  const dm = new THREE.Object3D();
  const drawFires = (J) => { let n = 0, a = 0; const t = game.time; if (J) J.fires.forEach((f, k) => { dm.position.set(f.x, f.y + 0.02, f.z); dm.rotation.set(0, k, 0); dm.scale.setScalar(1); dm.updateMatrix(); ashIM.setMatrixAt(a++, dm.matrix); if (f.hp <= 0) return; const s = 0.35 + f.hp / 100 * 0.9;
      for (let i = 0; i < FL; i++) { const ang = i * 1.047 + k, r = i ? 1.6 * s : 0, h = s * (1 + 0.25 * Math.sin(t * 9 + i * 2.1 + k)); dm.position.set(f.x + Math.cos(ang) * r, f.y + h * 1.1, f.z + Math.sin(ang) * r); dm.rotation.set(Math.sin(t * 5 + i) * 0.08, t * 2 + i, 0); dm.scale.set(s * (i ? 0.8 : 1.3), h * (i ? 0.9 : 1.4), s * (i ? 0.8 : 1.3)); dm.updateMatrix(); fireIM.setMatrixAt(n, dm.matrix); dm.position.y = f.y + h * 0.7; dm.scale.multiplyScalar(0.8); dm.updateMatrix(); coreIM.setMatrixAt(n, dm.matrix); n++; } });
    fireIM.count = coreIM.count = n; ashIM.count = a; fireIM.instanceMatrix.needsUpdate = coreIM.instanceMatrix.needsUpdate = ashIM.instanceMatrix.needsUpdate = true; };
  D.reg({ id: 'ot', ic: '🔥', name: "O't o'chirish", cat: 'veh', place: 'ormon', mins: 5, xp: 14, pay: "700–1 600 so'm", need: "o't o'chirish mashinasi (boshqa mashina — kichik bochka, ×0,75)",
    desc: "O'rmonda yong'in! Yonayotgan joylarga yetib borib, to'xtab suv sepasiz. Bak tugasa — gidrant yoki ko'l. Qarovsiz olov yana avj oladi.",
    rules: () => "Olov yoniga (o't o'chirish mashinasida 16 m, boshqasida 8 m) borib sekinlang — suv o'zi sepiladi. Bak: 100 (o't o'chirish mashinasi) yoki 40 litr; to'ldirish — qo'riqchi yonidagi gidrant [E] yoki suvga kirish. Har olov 260 so'm, hammasi — bonus 250.",
    why: () => (['bike', 'open'].includes(cls()) ? `${vn()} bilan o't o'chirib bo'lmaydi — mashina oling` : null),
    start(J) { if (!og) return false; const R = T.roads, fires = [], n = J.lvl >= 2 ? 4 : 3; for (let k = 0; k < 400 && fires.length < n; k++) { const i = (Math.random() * R.n) | 0, d = Math.hypot(R.x[i] - og.x, R.z[i] - og.z); if (d < 220 || d > 950) continue; const a = Math.random() * 6.283, off = 14 + Math.random() * 30, x = R.x[i] + Math.cos(a) * off, z = R.z[i] + Math.sin(a) * off, si = T.siteInfo(x, z);
        if (si.y < si.water + 0.6 || si.slope > 0.35 || si.roadD < 4 || fires.some((f) => Math.hypot(f.x - x, f.z - z) < 140)) continue; fires.push({ x, z, y: si.y, hp: 70 + Math.random() * 30, idle: 0 }); }
      if (fires.length < 2) return false; const fire = vid() === 'otochar'; Object.assign(J, { fires, tank: fire ? 100 : 40, cap: fire ? 100 : 40, range: fire ? 16 : 8, pw: fire ? 24 : 12, vm: fire ? 1 : 0.75, jetT: 0, intro: `${fires.length} joyda yong'in! ${fire ? "Sirenani yoqing [H] — oldinga!" : "Kichik bochka bilan — ehtiyot bo'ling"}` }); J.t = 300 + fires.length * 30; D.marks(fires.map((f) => Object.assign({ c: 0xff5a2a }, f))); drawFires(J); },
    carE(J) { if (hyd && Math.hypot(hyd.x - car.p[0], hyd.z - car.p[2]) < 12 && car.speed < 3 && J.tank < J.cap - 1) return ['<kbd>E</kbd> Bakni gidrantdan to\'ldirish 🚰', () => { J.tank = J.cap; sfx('splash', 0.3); toast('🚰 Bak to\'ldi', 'good'); }]; return null; },
    tick(J, dt, foot) { const t = game.time; if (!foot && car.inWater && J.tank < J.cap) { J.tank = Math.min(J.cap, J.tank + 30 * dt); }
      let tgt = null, td = 1e9; for (const f of J.fires) { if (f.hp <= 0) continue; const d = Math.hypot(f.x - car.p[0], f.z - car.p[2]); if (d < td) { td = d; tgt = f; } f.idle += dt; if (f.idle > 4) f.hp = Math.min(100, f.hp + 1.5 * dt); if ((f.sm = (f.sm || 0) - dt) <= 0 && Math.hypot(f.x - car.p[0], f.z - car.p[2]) < 400) { f.sm = 0.35; fx().burst(2, f.x, f.y + 2.5, f.z, 0.8, 3.2, 1.6, 0x4a4440, 0.45, 1.6, -0.6, 2.2); } }
      J.spray = false; if (tgt && !foot && td < J.range && car.speed < 4 && J.tank > 0) { J.spray = true; tgt.idle = 0; tgt.hp -= J.pw * dt; J.tank = Math.max(0, J.tank - 7 * dt); if ((J.jetT -= dt) <= 0) { J.jetT = 0.06; const k = 0.3 + Math.random() * 0.7; fx().burst(3, car.p[0] + (tgt.x - car.p[0]) * k, car.p[1] + 1.6 + Math.sin(k * 3.14) * 2, car.p[2] + (tgt.z - car.p[2]) * k, 1.4, 0.6, 0.3, 0xcfeaff, 0.8, 0.3, 6, 0.4); }
        if (tgt.hp <= 0) { tgt.hp = 0; J.done++; sfx('splash', 0.5); fx().burst(20, tgt.x, tgt.y + 1, tgt.z, 2, 2.4, 1.2, 0xe8e8e8, 0.6, 2, -0.5, 1.5); D.pay('ot', 260 * J.vm, `olov o'chdi ${J.done}/${J.fires.length}`); D.marks(J.fires.filter((f) => f.hp > 0).map((f) => Object.assign({ c: 0xff5a2a }, f)));
          if (J.fires.every((f) => f.hp <= 0)) { D.pay('ot', (250 + Math.min(200, Math.max(0, J.t))) * J.vm, "o'rmon saqlandi"); return D.finish(true, `Botir aka: «O'rmonni saqlab qoldingiz!» · ${som(J.earn)} so'm`); } } }
      if (J.tank <= 0 && !J.emptyMsg) { J.emptyMsg = 1; toast('🪣 Bak bo\'sh! Gidrant (qo\'riqchi yonida) yoki ko\'l/daryoga kiring', 'bad'); } if (J.tank > 5) J.emptyMsg = 0;
      if (!game.way || (tgt && Math.hypot(game.way.x - tgt.x, game.way.z - tgt.z) > 3 && game.way.auto)) { const w = J.tank <= 0 && hyd ? hyd : tgt; if (w) game.setWaypoint(w.x, w.z, true); } drawFires(J); },
    meter: (J) => ['💧 Bak', J.tank / J.cap, `${Math.round(J.tank)} l${J.spray ? ' · sepilmoqda' : ''}`],
    line: (J) => { const f = J.fires.filter((q) => q.hp > 0); let d = 1e9; for (const q of f) d = Math.min(d, Math.hypot(q.x - car.p[0], q.z - car.p[2])); return `O'chirildi ${J.done}/${J.fires.length}${f.length ? ` · eng yaqin olov ${Math.round(d)} m` : ''}`; },
    timeout(J) { D.finish(J.done > 0, `Vaqt tugadi — o't o'chiruvchilar yetib keldi. ${som(J.earn)} so'm`); },
    end(J) { J.fires = []; drawFires(null); } });

  // ================= 7. QOR TOZALASH =================
  const qg = giverAt('qor', 'lager', 6.6, "Lager boshlig'i Anvar", { shirt: 0x3a6ab8, pants: 0x2a2c33, vest: 0xd8392b, hair: 0x2a1d16, stache: true });
  const driftG = (() => { const g = new GB(4141); g.jit = 0.08; g.color(0xf4f8ff).blob(1.2, 1, { sx: 2.6, sy: 0.38, sz: 1.3, cy: 0.1 }).blob(0.7, 1, { cx: 1.1, sy: 0.5, cy: 0.15 }).blob(0.6, 1, { cx: -1.2, cz: 0.3, sy: 0.45, cy: 0.12 }); return g.build(); })();
  const driftIM = new THREE.InstancedMesh(driftG, MAT.flat, 16); driftIM.count = 0; driftIM.frustumCulled = false; driftIM.receiveShadow = true; scene.add(driftIM);
  const drawDrifts = (J) => { let n = 0; if (J) for (const q of J.dr) { if (q.ok) continue; dm.position.set(q.x, q.y, q.z); dm.rotation.set(0, q.yaw + Math.PI / 2, 0); dm.scale.setScalar(1); dm.updateMatrix(); driftIM.setMatrixAt(n++, dm.matrix); } driftIM.count = n; driftIM.instanceMatrix.needsUpdate = true; };
  D.reg({ id: 'qor', ic: '❄️', name: 'Qor tozalash', cat: 'veh', place: 'lager', mins: 4, xp: 12, pay: "550–1 400 so'm", need: 'traktor ×1,4, yuk mashinasi ×1,3, pikap/jip ×1,15; qor yog\'sa ×1,4',
    desc: "Tog' yo'lidagi qor uyumlarini tozalash: uyum ustidan sekin (50 km/soatgacha) o'ting. Juda tez yursangiz qor sachraydi-yu, yo'l tozalanmaydi.",
    rules: () => "6–12 ta uyum lagerdan chiquvchi yo'lda — ko'k nur bilan belgilangan. Har uyum 45 so'm, hammasi — bonus 220. Qor yog'ayotgan bo'lsa haq 1,4 baravar.",
    why: () => (cls() === 'bike' ? `${vn()} bilan qor tozalab bo'lmaydi` : null),
    start(J) { if (!qg) return false; const R = T.roads, st0 = T.nearestRoad(qg.x, qg.z, 6); if (st0.edge < 0) return false; const dr = [];
      const walk = (ei, from, dir, left) => { const e = R.edges[ei]; for (let k = from; k >= 0 && k < e.count && left > 0; k += dir) { const i = e.start + k; if (k !== from && (k - from) % (dir * 14) === 0 && !R.bridge[i]) { const p = D.roadPt(i, (dr.length % 2 ? 1 : -1) * R.hw[i] * 0.3); p.y = gy(p.x, p.z); dr.push(p); left--; } } return left; };
      const e0 = R.edge[st0.i], k0 = R.idx[st0.i]; let left = 12; left = walk(e0, k0, 1, 6); left = walk(e0, k0, -1, 12 - dr.length); if (dr.length < 6) return false;
      const snow = game.dunyo && game.dunyo.type === 'qor', vm = (cls() === 'tractor' ? 1.4 : cls() === 'truck' ? 1.3 : ['pikap', 'jip'].includes(vid()) ? 1.15 : 1) * (snow ? 1.4 : 1);
      Object.assign(J, { dr, vm, snow, cool: 0, intro: `${dr.length} ta qor uyumi${snow ? ' · qor yog\'yapti — haq ×1,4' : ''}. Sekin o'ting!` }); J.t = 150 + dr.length * 14; drawDrifts(J); D.marks(dr.slice(0, 12).map((q) => Object.assign({ c: 0x9fd8ff }, q))); },
    tick(J, dt, foot) { if (J.cool > 0) J.cool -= dt; if (!foot) for (const q of J.dr) { if (q.ok) continue; const d = Math.hypot(q.x - car.p[0], q.z - car.p[2]); if (d > 3.4) continue;
        if (car.speed > 13.9) { if (J.cool <= 0) { J.cool = 1.2; toast('💨 Juda tez — qor sachradi, uyum qoldi! (50 km/soatgacha)', 'bad'); fx().burst(10, q.x, q.y + 0.5, q.z, 4, 0.8, 0.4, 0xffffff, 0.8, 1.5, 6, 0.2); } continue; }
        q.ok = 1; J.done++; sfx('rustle'); fx().burst(16, q.x, q.y + 0.6, q.z, 3, 1, 0.5, 0xffffff, 0.9, 1.8, 5, 0.3); D.pay('qor', 45 * J.vm, `uyum ${J.done}/${J.dr.length}`); drawDrifts(J); D.marks(J.dr.filter((r) => !r.ok).map((r) => Object.assign({ c: 0x9fd8ff }, r)));
        if (J.dr.every((r) => r.ok)) { D.pay('qor', 220 * J.vm, "yo'l ochildi"); return D.finish(true, `Anvar aka: «Endi yo'l ochiq — rahmat!» · ${som(J.earn)} so'm`); } }
      if (!game.way || game.way.auto) { let b = null, bd = 1e9; for (const q of J.dr) if (!q.ok) { const d = Math.hypot(q.x - car.p[0], q.z - car.p[2]); if (d < bd) { bd = d; b = q; } } if (b && (!game.way || Math.hypot(game.way.x - b.x, game.way.z - b.z) > 2)) game.setWaypoint(b.x, b.z, true); } },
    meter: () => ['🚜 Tezlik', clamp(1 - car.speed / 13.9, 0, 1), `${Math.round(car.speed * 3.6)}/50`],
    line: (J) => `Tozalandi ${J.done}/${J.dr.length}${J.snow ? ' · ❄ ×1,4' : ''}`,
    end(J) { J.dr = []; drawDrifts(null); } });

  // ================= 8. SAYYOHLARGA GID =================
  const gg = giverAt('gid', 'bandargoh', 7.4, 'Sayyohlik agenti Laylo', { shirt: 0xf0b83a, pants: 0x2f4a78, long: true, hair: 0x6a4a30 }, 12, 60);
  const seatOf = () => (vid() === 'avtobus' ? 12 : vid() === 'limuzin' ? 6 : SEATS[cls()] || 0);
  D.reg({ id: 'gid', ic: '🧭', name: 'Sayyohlarga gid', cat: 'veh', place: 'bandargoh', mins: 7, xp: 16, pay: "900–2 500 so'm", need: 'mashina, furgon (×1,1), limuzin (VIP ×1,3) yoki avtobus (×1,5)',
    desc: "Sayyohlarni orolning diqqatga sazovor joylariga olib borib, har birida hikoya qilib berasiz (savolga to'g'ri javob — yulduz). Silliq haydang — sayyohlar baho qo'yadi.",
    rules: () => "Har manzilga yetib to'xtang va <kbd>E</kbd> — hikoya: to'g'ri faktni tanlang. Oxirida bandargohga qayting. To'lov: har manzil 320 + har to'g'ri hikoya 150 + qaytish 200, qulaylik (urilish −15 %, sakrash −8 %) va o'rinlar soni bo'yicha.",
    why: () => (seatOf() && !['traktor', 'yuk', 'otochar', 'monstr'].includes(vid()) ? null : `${vn()}da sayyohlarga joy yo'q — mashina, furgon, limuzin yoki avtobus kerak`),
    start(J) { if (!gg) return false; const n = J.lvl >= 2 ? 4 : 3; let pool = Object.keys(QUIZ).filter((id) => places[id] && places[id].board && Math.hypot(places[id].board.x - gg.x, places[id].board.z - gg.z) < (J.lvl >= 1 ? 4200 : 3000)); shuffle(pool); pool = pool.slice(0, n);
      const out = [], cx = [gg.x, gg.z]; while (pool.length) { pool.sort((a, b) => Math.hypot(places[a].board.x - cx[0], places[a].board.z - cx[1]) - Math.hypot(places[b].board.x - cx[0], places[b].board.z - cx[1])); const id = pool.shift(), b = places[id].board; out.push({ id, x: b.x, z: b.z, name: places[id].name }); cx[0] = b.x; cx[1] = b.z; }
      const s = seatOf(), vm = vid() === 'avtobus' ? 1.5 : vid() === 'limuzin' ? 1.3 : cls() === 'van' ? 1.1 : 0.9; Object.assign(J, { sights: out, k: 0, stars: 0, hits: 0, air: 0, c0: crashes(), seats: s, vm, stage: 'go', intro: `${Math.min(s, 12)} sayyoh · ${out.map((q) => q.name).join(' → ')}` });
      J.t = 200 + out.length * 130; this.next(J); },
    next(J) { const s = J.sights[J.k]; if (s) { D.marks([s]); game.setWaypoint(s.x, s.z, true); } else { J.stage = 'home'; const h = { x: gg.x, z: gg.z }; D.marks([Object.assign({ c: 0x5fd38a }, h)]); game.setWaypoint(h.x, h.z, true); } },
    carE(J) { const s = J.sights[J.k]; if (J.stage === 'go' && s && at(s, 32, 1.5)) return [`<kbd>E</kbd> Sayyohlarga hikoya: ${s.name} 🧭`, () => game.ui.open('gid', { s })]; return null; },
    answer(J, ok) { const s = J.sights[J.k]; J.stars += ok ? 1 : 0; J.done++; D.pay('gid', 320 * J.vm * this.q(J), s.name); if (ok) { D.pay('gid', 150 * J.vm, 'ajoyib hikoya'); toast('📸 Sayyohlar: «Qanday qiziq!» — suratga tushishmoqda', 'good'); } else toast('🤔 Sayyohlar bir-biriga qarab qo\'yishdi… (hikoya chalkash)', 'bad'); J.k++; this.next(J); },
    q: (J) => Math.max(0.4, 1 - 0.15 * J.hits - 0.08 * J.air),
    tick(J) { const c = crashes() - J.c0; if (c > J.hits) { J.hits = c; toast('😨 Sayyohlar qo\'rqib ketdi (qulaylik −15 %)', 'bad'); } if (car.airTime > 0.45 && !J.inAir) { J.inAir = 1; J.air++; toast('🎢 Sayyohlar: «Bu attraksionmi?» (−8 %)', 'bad'); } else if (car.airTime === 0) J.inAir = 0;
      if (J.stage === 'home' && at({ x: gg.x, z: gg.z }, 25, 2)) { D.pay('gid', 200 * J.vm * this.q(J), 'safar yakuni'); const st5 = Math.max(1, Math.round((J.stars / J.sights.length) * 3 + this.q(J) * 2)); J.xpb = st5 * 2; D.finish(true, `Sayyohlar bahosi: ${'★'.repeat(st5)}${'☆'.repeat(5 - st5)} · jami ${som(J.earn)} so'm`); } },
    meter: (J) => ['😊 Qulaylik', J.def.q(J)],
    timeout(J) { J.t = null; toast('⏰ Sayyohlar charchadi — tezroq qaytaylik', 'bad'); J.hits++; },
    line: (J) => (J.stage === 'home' ? `Bandargohga qayting · ${Math.round(Math.hypot(gg.x - car.p[0], gg.z - car.p[2]))} m` : `${J.k + 1}/${J.sights.length}: ${J.sights[J.k].name} · ${Math.round(Math.hypot(J.sights[J.k].x - car.p[0], J.sights[J.k].z - car.p[2]))} m · ★ ${J.stars}`) });
  UI.prototype.s_gid = function (w, d, btn, x) { x(); const J = D.cur, s = d && d.s; if (!J || J.id !== 'gid' || !s) { w.innerHTML = '<p class="sub">Hozir sayohat yo\'q.</p>'; return; } const q = QUIZ[s.id], opts = shuffle(q[1].map((t, i) => [t, i === 0]));
    w.innerHTML = `<h1>🧭 ${s.name} <small>sayyohlar sizni tinglamoqda</small></h1><div class="card"><p style="font-size:16px">«${q[0]}»</p><p class="sub">To'g'ri faktni tanlab hikoya qiling:</p></div><div style="display:flex;flex-direction:column;gap:8px;margin-top:10px">${opts.map((o, i) => `<button class="sec" data-a="ans:${o[1] ? 1 : 0}${i}">${o[0]}</button>`).join('')}</div>`;
    this.on({ ans: (v) => { this.close(); D.defs.gid.answer(J, v[0] === '1'); } }); };
  D.QUIZ = QUIZ; D.dbg2 = { yard, clinic, hyd, garages, wreck, drawFires };
}
