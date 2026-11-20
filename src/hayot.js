// Kundalik hayot: chanqoq va suv, uy ichida (uxlash, o'tirish, oshxona, muzlatkich, dush, TV, gazeta, budilnik, chiroq), do'kon, NPC suhbatlari, yoqilg'i, HUD ko'rsatkichlari
import * as THREE from 'three';
import * as T from './terrain.js';
import * as COL from './colliders.js';
import { GB, MAT } from './geo.js';
import { ITEMS } from './living.js';
import { initInterior, ROOM_NAME } from './interior.js';
import { initFuel } from './fuel.js';
import { clamp, angDiff } from './util.js';

// yangi buyumlar: nom, belgi, sotuv narxi (0 — sotilmaydi), to'qlik
const NEW_ITEMS = { water: ['Suv', '💧', 0, 1], juice: ['Sharbat', '🧃', 0, 6], sweets: ['Shirinlik', '🍬', 0, 12], snack: ['Pista', '🥜', 0, 14], canister: ["Yoqilg'i kanistri", '⛽', 0, 0],
  friedfish: ['Qovurilgan baliq', '🍤', 0, 55], kabob: ['Baliq kabob', '🍢', 0, 80], soup: ["Qo'ziqorin sho'rva", '🍲', 0, 50], omlet: ['Quymoq', '🍳', 0, 40], salad: ['Meva salati', '🥗', 0, 30], dimlama: ['Sabzavot dimlama', '🥘', 0, 55], tea: ["Ko'k choy", '🍵', 0, 2] };
const DRINK = { water: 40, juice: 32, tea: 30, soup: 15, salad: 8, sweets: -4, snack: -6 }; // chanqoqqa ta'siri (+ — qondiradi)
const DISHES = ['kabob', 'dimlama', 'friedfish', 'soup', 'omlet', 'salad'];
export const RECIPES = [['friedfish', { fish: 1 }, 5], ['kabob', { bigfish: 1 }, 6], ['soup', { mush: 2 }, 6], ['omlet', { egg: 2 }, 4], ['salad', { fruit: 2 }, 3], ['dimlama', { veg: 2 }, 6]];
export const SHOP2 = [['water', 'Suv (0,5 l)', 10], ['juice', 'Olma sharbati', 18], ['bread', 'Issiq non', 12], ['sweets', 'Shirinlik (konfet)', 15], ['snack', "Pista (sho'r)", 12], ['canister', "Yoqilg'i kanistri (+35%)", 120]];
const GREET = ['Assalomu alaykum! Xush kelibsiz, nima kerak?', 'Yangi non hozirgina keldi — hali issiq!', 'Muzdek suv va sharbat bor, oling!', "Yo'lga chiqyapsizmi? Kanistr olib qo'ying, bak bo'shab qolsa asqotadi."];
const KIOSK_GREET = ['Yo\'l uzoqmi? Muzdek suv va kanistr shu yerda!', 'Benzin quydingizmi? Yo\'lga pista oling — zerikmaysiz.', 'Kanistr olib qo\'ying, bak bo\'shab qolsa asqotadi.'];
const FOODISH = ['fruit', 'berry', 'veg', 'bread', 'mush', 'fish', 'bigfish', 'egg', 'water', 'juice', 'sweets', 'snack', ...DISHES, 'tea'];
const som = (n) => Math.round(n).toLocaleString('ru-RU');
const hm = (h) => { const a = Math.floor(h), m = Math.round((h - a) * 60); return `${a < 10 ? '0' : ''}${a}:${m < 10 ? '0' : ''}${m}`; };
// NPC xarakterlari: [belgi, kim, suhbatlar (har biri 2–4 qator)]
const PERS = [
  ['🧓', 'qishloq keksasi', [["Assalomu alaykum, bolam! Yo'l bo'lsin?", "Bizning orolda shoshilgan — yo'lda qoladi, deyishadi.", "Mashinangizga qarang: yo'l bo'yidagi qizil soyabonli shoxobchada yoqilg'i quyiladi."],
    ["Yoshligimda bu yerlarda yo'l ham yo'q edi…", "Endi qarang: do'kon, ustaxona, hatto televizor!", "Uyingizga kirib dam oling — karavotda uxlasangiz ertalabgacha kuch to'ladi."], ["Qo'ylarim ochqab qoldi-yov.", "Pichaningiz bo'lsa, boqib qo'ying — savob bo'ladi."]]],
  ['🧒', 'qiziquvchan bola', [["Voy, sizning mashinangiz zo'r ekan!", "Men katta bo'lsam poyga bolidini olaman!", "Bilasizmi, tramplindan uzoq sakrasangiz pul berishadi!"], ["Do'kondagi konfet juda shirin!", "Lekin oyim ko'p yema deydi… chanqatadi.", "Siz suv ichib turing, bo'lmasa tez charchaysiz!"], ["Kecha kapalak tutdim!", "Albomingizga yangi topilma qo'shilsa, 40 so'm berishadi, bilarmidingiz?"]]],
  ['🧑‍🌾', 'fermer', [["Bugun hosil yaxshi bo'ldi, xudoga shukur.", "Sabzavotingiz bo'lsa — uyda dimlama pishiring, juda to'yimli.", "Pichoqqa ehtiyot bo'ling, oshxonada ham!"], ["Qo'ziqorinni o'rmondan teraman.", "Ikki dona qo'ziqorindan zo'r sho'rva chiqadi — plitada pishiring."], ["Tovuq boqing, tuxum qo'yadi.", "Ikki tuxumdan nonushtaga quymoq — tayyor!"]]],
  ['🧳', 'sayyoh', [["Salom! Men ham orolni aylanyapman.", "Cho'qqiga chiqqanmisiz? U yerdan hamma narsa ko'rinadi.", "Faqat suvni unutmang — chanqoq bo'lsa yugurolmaysiz."], ["Kecha Ko'zgu ko'lda tunadim.", "Chodir bilan istalgan joyda dam olish mumkin.", "Lekin uyda, yumshoq karavotda uxlash boshqacha-da!"], ["Xaritada sariq belgi — e'lonlar taxtasi.", "U yerdan ish topsangiz, yaxshi pul topasiz."]]],
  ['🧑', 'savdogar', [["Assalomu alaykum! Savdo qalay?", "Baliq, chig'anoq, ruda — bozorda hammasining narxi bor.", "Yoqutni topsangiz — boyib ketasiz!"], ["Bog'istondagi do'konga kirib ko'ring.", "Muzdek sharbat, issiq non, kanistr — hammasi bor."], ["Benzin narxi arzon, 1 foizi 2 so'm.", "Uzoq yo'lga to'liq bak bilan chiqing!"]]],
];

export function initHayot(game) {
  const { scene, car } = game, st = game.state, pl = game.player, L = game.live;
  Object.assign(ITEMS, NEW_ITEMS);
  const IN = initInterior(game), FU = initFuel(game);
  const HY = { dlg: null, cook: null, sleep: null, shops: [] };
  game.hayot = HY;
  const toast = (m, k) => game.toast(m, k), sfx = (n, k) => game.audio.sfx(n, k), fx = () => game.fx;
  const give = (id, n = 1) => { st.inv[id] = (st.inv[id] || 0) + n; };

  // ================= DO'KON BINOSI (qishloqda) =================
  const signCan = document.createElement('canvas'); signCan.width = 256; signCan.height = 64; { const x = signCan.getContext('2d'); x.fillStyle = '#2f8a50'; x.fillRect(0, 0, 256, 64); x.fillStyle = '#fff'; x.font = 'bold 40px sans-serif'; x.textAlign = 'center'; x.fillText("DO'KON", 128, 46); }
  const signTex = new THREE.CanvasTexture(signCan); signTex.colorSpace = THREE.SRGBColorSpace; const signMat = new THREE.MeshBasicMaterial({ map: signTex, fog: true });
  const freeAt = (x, z, r) => { for (const o of COL.query(x, z, r)) { if (o.dead) continue; let qx = o.x, qz = o.z; if (o.t === 1) { const sx = o.x2 - o.x, sz = o.z2 - o.z, t = clamp(((x - o.x) * sx + (z - o.z) * sz) / (sx * sx + sz * sz || 1), 0, 1); qx = o.x + sx * t; qz = o.z + sz * t; } if (Math.hypot(x - qx, z - qz) < o.r + r) return false; } return true; };
  const placeShop = (pid) => {
    const P = game.site.places[pid]; if (!P || !P.board) return; const bx = P.board.x, bz = P.board.z, npcs = L._dbg.npcs;
    for (let rad = 16; rad < 60; rad += 3) for (let k = 0; k < 24; k++) {
      const a = k * 0.2618 + rad, x = bx + Math.cos(a) * rad, z = bz + Math.sin(a) * rad, si = T.siteInfo(x, z); if (si.y < si.water + 1 || si.slope > 0.16 || si.roadD < 9 || si.roadD > 30) continue;
      let hmin = 1e9, hmax = -1e9; for (const [dx, dz] of [[-4, -4], [4, -4], [4, 4], [-4, 4], [0, 0], [0, -6]]) { const h = T.gridHeight(x + dx, z + dz); hmin = Math.min(hmin, h); hmax = Math.max(hmax, h); } if (hmax - hmin > 1.2) continue;
      if (!freeAt(x, z, 6.5) || npcs.some((o) => Math.hypot(o.x - x, o.z - z) < 8) || Math.hypot(x - bx, z - bz) < 10) continue;
      const nr = T.nearestRoad(x, z, 6); const yaw = nr.edge >= 0 ? Math.atan2(T.roads.x[nr.i] - x, T.roads.z[nr.i] - z) : 0; // old tomoni yo'lga qaraydi
      const y = hmin + 0.05, c = Math.cos(yaw), s = Math.sin(yaw), W = (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c];
      const g = new GB(1801 + HY.shops.length); g.jit = 0.025; g.translate(x, y, z).rotY(yaw);
      g.color(0x9a948a).box(0, -0.6, 0.6, 7.4, 1.4, 6.6); // poydevor
      g.color(0xf2ead8).box(0, 1.65, 0, 6.4, 3.3, 5.2); g.color(0x3f9a58).box(0, 3.4, 0, 6.8, 0.25, 5.6); g.color(0xe8e2d4).box(0, 3.6, 0, 6.6, 0.2, 5.4);
      g.color(0x6e4a30).box(0, 1.1, 2.61, 1.3, 2.2, 0.06); g.color(0x9fd0ff).box(0, 1.35, 2.645, 0.9, 1.4, 0.01); g.color(0xd8b860).box(0.45, 1.05, 2.66, 0.05, 0.25, 0.04);
      for (const sx of [-1, 1]) { g.color(0xf6f6f2).box(sx * 2.0, 1.55, 2.62, 1.8, 1.4, 0.05); g.color(0xbfe4f8).box(sx * 2.0, 1.55, 2.65, 1.6, 1.2, 0.01); for (let i = 0; i < 6; i++) g.color([0xd8392b, 0xf0b83a, 0x4fb0ff, 0x3f9a58, 0xff8a3a, 0x8a54c8][i]).box(sx * 2.0 - 0.6 + i * 0.24, 1.08, 2.66, 0.14, 0.24 + (i % 3) * 0.06, 0.02); }
      // soyabon (yo'l-yo'l)
      for (let i = 0; i < 9; i++) g.color(i % 2 ? 0xf2f2ee : 0x3f9a58).push().translate(-3.2 + i * 0.8 + 0.4, 2.75, 3.15).rotX(0.35).box(0, 0, 0, 0.8, 0.06, 1.2).pop();
      g.color(0x8a5a36).box(-2.5, 0.25, 3.4, 1.2, 0.5, 0.6); g.color(0xf0b83a).box(-2.5, 0.6, 3.4, 1.1, 0.2, 0.5); g.color(0xd8392b).box(2.6, 0.45, 3.3, 0.5, 0.9, 0.4); g.color(0xf2f2ee).box(2.6, 0.95, 3.3, 0.5, 0.1, 0.4);
      const m = new THREE.Mesh(g.build(), MAT.flat); m.castShadow = true; m.receiveShadow = true; scene.add(m);
      const sg = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.65), signMat); const [sx2, sz2] = W(0, 2.72); sg.position.set(sx2, y + 2.95, sz2); sg.rotation.y = yaw; scene.add(sg);
      COL.addBox(x, z, 3.2, 2.6, yaw, y - 1, y + 3.6); COL.addCircle(...W(-2.5, 3.4), 0.6, y - 1, y + 0.8); COL.addCircle(...W(2.6, 3.3), 0.3, y - 1, y + 1);
      const [dx, dz] = W(0, 3.5); HY.shops.push({ x: dx, z: dz, yaw, out: [dx, dz, yaw], name: P.name, pid }); return;
    }
  };
  placeShop('bogiston'); placeShop('bandargoh');

  // do'kon ichida narxlar taxtasi (peshtaxta ortidagi devorda) — oynani ochmasdan ham narxlar ko'rinadi
  { const c = document.createElement('canvas'); c.width = 512; c.height = 352; const x = c.getContext('2d'); x.fillStyle = '#24402c'; x.fillRect(0, 0, 512, 352); x.strokeStyle = '#d8b860'; x.lineWidth = 10; x.strokeRect(5, 5, 502, 342);
    x.fillStyle = '#ffe08a'; x.font = 'bold 38px sans-serif'; x.textAlign = 'center'; x.fillText('NARXLAR', 256, 50); x.font = 'bold 27px sans-serif';
    SHOP2.forEach(([id, n, c2], i) => { x.textAlign = 'left'; x.fillStyle = '#f2ead8'; x.fillText(n.replace(/ \(.*\)/, ''), 30, 98 + i * 44); x.textAlign = 'right'; x.fillStyle = '#ffd23a'; x.fillText(c2 + " so'm", 482, 98 + i * 44); void id; });
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; const S = IN.S, m = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.825), new THREE.MeshBasicMaterial({ map: t, fog: false }));
    m.position.set(S.o[0] + 0.85, S.o[1] + 1.75, S.o[2] + 2.535); m.rotation.y = Math.PI; m.frustumCulled = false; S.grp.add(m); }

  // ================= KIRISH/CHIQISH, SAQLASH =================
  const save0 = game.save;
  game.save = () => { if (IN.inside && IN.ret) { const p = pl.p, b = p.slice(), y = pl.yaw; p[0] = IN.ret[0]; p[2] = IN.ret[1]; pl.yaw = IN.ret[2]; try { save0(); } finally { p[0] = b[0]; p[1] = b[1]; p[2] = b[2]; pl.yaw = y; } } else save0(); };
  HY.enterHome = () => { const h = game.site.places.uy.home; let x = pl.p[0], z = pl.p[2]; IN.enter('home', [x, z, Math.atan2(x - h.x, z - h.z)]); toast(`🏠 Uyingizga xush kelibsiz! ${['Chodir', 'Kulba', 'Hovli uy', 'Ikki qavatli uy', 'Villa'][st.home.lvl]} — [E] bilan narsalardan foydalaning`, 'good'); };
  HY.enterShop = (sh) => { IN.enter('shop', sh.out); IN.talkT = 2.5; toast(`Sotuvchi: «${GREET[(Math.random() * GREET.length) | 0]}»`, 'gold'); sfx('bell'); };
  // uy ichida tashqi harakatlar mumkin emas
  const da0 = L.doAction; const OUTDOOR = ['fire', 'tent', 'snow', 'flag', 'sapling', 'plant', 'pull', 'whistle'];
  L.doAction = (id) => { if (IN.inside && OUTDOOR.includes(id)) return toast('Bu ishni tashqarida qiling 🙂'); if (id === 'eat') return eatSmart(); return da0(id); };

  // ================= YEYISH, ICHISH =================
  const eat0 = L.eat;
  L.eat = (id) => { const ok = eat0(id); if (ok) { const d = DRINK[id]; if (d) st.thirst = clamp(st.thirst + d, 0, 100); if (d > 0 && !ITEMS[id][3]) sfx('sip'); } return ok; };
  const drinkItem = (id) => { if (!(st.inv[id] > 0)) return false; pl.act('drink', 1.8, () => { st.inv[id]--; st.thirst = clamp(st.thirst + DRINK[id], 0, 100); if (ITEMS[id][3]) { st.sat = Math.min(100, st.sat + ITEMS[id][3]); } sfx('sip'); toast(`${ITEMS[id][1]} ${ITEMS[id][0]} ichdingiz · 💧 ${Math.round(st.thirst)}%`, 'good'); L.count('eat'); }, 'bottle'); return true; };
  HY.drinkItem = drinkItem;
  // [Y]: chanqagan bo'lsa — avval ichimlik; aks holda pishgan ovqat, so'ng xom yegulik
  const eatSmart = () => { if (!pl.onFoot) return toast('Avval transportdan tushing [F]');
    if (st.thirst < 70) for (const id of ['water', 'juice', 'tea']) if (st.inv[id] > 0) return drinkItem(id);
    for (const id of [...DISHES, 'sweets', 'snack']) if (st.inv[id] > 0 && L.eat(id)) { sfx('eat'); return toast(`${ITEMS[id][1]} ${ITEMS[id][0]} yedingiz · to'qlik ${Math.round(st.sat)}%`, 'good'); }
    return L.eatAny(); };

  // ================= UY ICHIDAGI HARAKATLAR =================
  const W = (I, lx, lz) => [I.o[0] + lx, I.o[2] + lz];
  const plate = (() => { const g = new GB(1900); g.jit = 0; g.color(0xf6f6f2).cyl(12, 0.13, 0.11, 0, 0.02, { cap: true }); g.color(0xe2a050).blob(0.08, 1, { cy: 0.035, sy: 0.45 }); g.color(0x5aa83a).blob(0.03, 0, { cx: 0.05, cy: 0.05 }); g.color(0xdfeef5).push().translate(0.2, 0, 0.05).cyl(8, 0.035, 0.04, 0, 0.11, { cap: true }).pop();
    const m = new THREE.Mesh(g.build(), MAT.flat); m.visible = false; scene.add(m); return m; })();
  const sitAt = (sp) => { const f = sp.sofa ? 0.22 : sp.table ? 0.1 : 0.08; pl.p[0] = sp.x + Math.sin(sp.yaw) * f; pl.p[2] = sp.z + Math.cos(sp.yaw) * f; pl.yaw = sp.yaw; pl.v[0] = pl.v[2] = 0; pl.sit = true; pl.emote = null; HY.seat = sp; };
  // turish: stol oldidagi o'rindiqdan — yon tomonga (avval stol ichiga turib, to'siq qarama-qarshi tomonga itarib yuborardi); bo'sh joy tanlanadi
  const stand = () => { pl.sit = false; const sp = HY.seat; HY.seat = null; if (!sp) return; const fx = Math.sin(sp.yaw), fz = Math.cos(sp.yaw), C = sp.table ? [[fz * 0.62, -fx * 0.62], [-fz * 0.62, fx * 0.62], [-fx * 0.6, -fz * 0.6]] : [[fx * 0.55, fz * 0.55], [fz * 0.62, -fx * 0.62], [-fz * 0.62, fx * 0.62]];
    const c = C.find((q) => freeAt(sp.x + q[0], sp.z + q[1], 0.3)) || C[0]; pl.p[0] = sp.x + c[0]; pl.p[2] = sp.z + c[1]; };
  const bestDish = () => DISHES.find((id) => st.inv[id] > 0) || ['bread', 'sweets', 'snack', 'fruit', 'veg', 'berry'].find((id) => st.inv[id] > 0);
  const eatAtTable = (sp) => { const id = bestDish(); if (!id) return toast("Yegulik yo'q — avval plitada ovqat pishiring 🍳", 'bad');
    sitAt(sp); const [tx, tz] = W(IN.cur(), sp.table[0], sp.table[1]); plate.position.set(tx + (pl.p[0] - tx) * 0.45, IN.cur().o[1] + (sp.th || 0.76) + 0.01, tz + (pl.p[2] - tz) * 0.45); plate.rotation.y = pl.yaw; plate.visible = true;
    pl.act('eat', 4.2, () => { plate.visible = false; pl.sit = true; const a = st.sat; if (L.eat(id)) { st.energy = Math.min(100, st.energy + 10); sfx('eat'); toast(`${ITEMS[id][1]} ${ITEMS[id][0]} — mazali! Stolda ovqatlandingiz · to'qlik ${Math.round(a)}% → ${Math.round(st.sat)}%`, 'good'); } }, 'spoon'); pl.sit = true; };
  HY.eatAtTable = eatAtTable;
  // uxlash: karavotga yotadi, ekran qorayadi, vaqt budilnikkacha o'tadi, kuch tiklanadi, o'yin saqlanadi
  const sleep = (sp) => {
    const I = IN.cur(), b = sp.bed, [bx, bz] = W(I, b[0], b[1]), yaw = b[2]; HY.sleep = { t: 0, done: false, sp, bed: [bx, bz, yaw], nap: napNow() };
    pl.p[0] = bx + Math.sin(yaw) * -0.12; pl.p[2] = bz + Math.cos(yaw) * -0.12; pl.yaw = yaw; pl.v[0] = pl.v[2] = 0; pl.sit = false;
    pl.act('lie', 5.2, () => { HY.sleep = null; pl.p[0] = sp.x; pl.p[2] = sp.z; pl.yaw = sp.yaw; }); toast('Yotdingiz… 😴', '');
  };
  const napNow = () => game.hour >= 9 && game.hour < 18 && (st.tetik == null ? 100 : st.tetik) > 40; // kunduzi, charchamagan — 2 soat mizg'ib olish (ertangi tonggacha uxlab, kun yo'qolmaydi)
  HY.wake = () => { const S = HY.sleep; if (!S || S.done) return; S.done = true; const from = game.hour, nap = S.nap, to = nap ? from + 2 : st.alarm || 6.5; let dh = to - from; if (dh <= 0.25) dh += 24;
    game.hour = to; game.sky.setHour(to); st.energy = 100; if (nap) { st.thirst = clamp(st.thirst - 4, 15, 100); game.save(); game.banner('Mizg\'ib oldingiz 😌', `${hm(to)} · 2 soat dam oldingiz`, 'gold'); sfx('alarm'); return; } st.sat = 100; st.thirst = clamp(st.thirst - 12, 15, 100); st.stats.sleeps = (st.stats.sleeps || 0) + 1; game.save();
    game.banner('Xayrli tong! ☀️', `${hm(to)} · ${Math.round(dh)} soat uxladingiz · kuch 100%`, 'gold'); sfx('alarm'); };
  const headlines = () => { const p = game.totalStars(), lv = game.levelName(), hs = ['Chodir', 'Kulba', 'Hovli uy', 'Ikki qavatli uy', 'Villa'][st.home.lvl];
    return [`«Orol xabarlari»: yangi sayyoh ${p} ta yulduz to'pladi — unvoni «${lv}»!`, `Mahalliy yangilik: «${hs}» egasi mahalladagilarga yordam berdi (❤ ${Math.floor(st.karma)})`, `Ob-havo: bugun ${['quyoshli', 'iliq', 'salqin', 'shamolli'][Math.floor(game.hour / 6) % 4]}, yo'llar ochiq. Shoxobchalarda yoqilg'i 2 so'm/1%`, `E'lon: Bog'iston do'konida issiq non va muzdek sharbat!`, `Sport: aerodromda poyga — eng yaxshi natija ${st.stats.top} km/soat`]; };
  const TV_CH = ['Yangiliklar', 'Multfilm', 'Ob-havo'];
  const spotAct = (sp) => {
    const I = IN.cur();
    switch (sp.k) {
      case 'door': return IN.exit();
      case 'bed': return sleep(sp);
      case 'sit': if (pl.sit && HY.seat === sp && sp.table) return eatAtTable(sp); sitAt(sp); if (sp.sofa && IN.tvOn) toast(`📺 ${TV_CH[IN.tvCh % 3]} — dam olyapsiz`, ''); return;
      case 'stove': return game.ui.open('oshxona');
      case 'fridge': return game.ui.open('muzlatkich');
      case 'tap': pl.yaw = sp.yaw; sfx('pour'); return pl.act('drink', 2.2, () => { st.thirst = clamp(st.thirst + 45, 0, 100); sfx('sip'); toast(`Bir stakan muzdek suv 💧 ${Math.round(st.thirst)}%`, 'good'); }, 'cup');
      case 'sink': pl.yaw = sp.yaw; sfx('pour'); return pl.act('wash', 2.6, () => { st.energy = Math.min(st.sat, st.energy + 4); toast("Qo'llaringiz top-toza ✨", 'good'); });
      case 'mirror': { pl.yaw = sp.yaw; const own = st.hats; let msg = "Ko'zgudagi o'zingizga qo'l silkidingiz 😄"; if (own.length) { const i = own.indexOf(st.hat), nx = i + 1 < own.length ? own[i + 1] : null; st.hat = nx; pl.setHat(nx); msg = nx ? 'Yangi bosh kiyim yarashdi! 😎' : "Bosh kiyimsiz ham chiroyli ko'rinasiz 🙂"; } return pl.act('wave', 1.6, () => toast(msg, 'good')); }
      case 'shower': pl.yaw = sp.yaw; sfx('pour'); HY.showerT = 4.6; return pl.act('shower', 4.6, () => { st.energy = Math.min(st.sat, st.energy + 20); st.tetik = Math.min(100, (st.tetik == null ? 100 : st.tetik) + 15); toast(`Dushdan keyin tetik bo'ldingiz! 🚿 Tetiklik ${Math.round(st.tetik)}%`, 'good'); });
      case 'tv': { if (!IN.tvOn) { IN.tvOn = true; IN.tvCh = 0; } else if (IN.tvCh < 2) IN.tvCh++; else IN.tvOn = false; sfx('click'); return toast(IN.tvOn ? `📺 ${TV_CH[IN.tvCh]} — divanga o'tirib tomosha qiling` : "📺 Televizor o'chirildi"); }
      case 'radio': { const s = st.set; s.music = !s.music; game.audio.setMusic(s.music); return toast(s.music ? '📻 Radio yoqildi — kuy chalinmoqda' : "📻 Radio o'chirildi"); }
      case 'kettle': pl.yaw = sp.yaw; sfx('pour'); return pl.act('cook', 2.6, () => { pl.act('drink', 2.2, () => { st.thirst = clamp(st.thirst + 30, 0, 100); st.energy = Math.min(100, st.energy + 10); toast(`Issiq ko'k choy 🍵 · 💧 ${Math.round(st.thirst)}% · kuch +10`, 'good'); sfx('sip'); }, 'cup'); });
      case 'paper': { const H = headlines(), a = (HY.paperI = (HY.paperI || 0) + 1); pl.yaw = sp.yaw; return pl.act('read', 5, () => { for (let i = 0; i < 2; i++) setTimeout(() => toast('📰 ' + H[(a * 2 + i) % H.length], ''), i * 1400); }, 'paper'); }
      case 'alarm': { const A = [5.5, 6.5, 7.5, 9, 12], i = A.indexOf(st.alarm); st.alarm = A[(i + 1) % A.length]; sfx('tick'); return toast(`⏰ Budilnik: ${hm(st.alarm)} da uyg'otadi`); }
      case 'desk': return game.ui.open('home');
      case 'switch': IN.lights = !IN.lights; sfx('click'); return toast(IN.lights ? '💡 Chiroq yoqildi' : "Chiroq o'chirildi");
      case 'counter': IN.talkT = 2; return game.ui.open('dokon');
      case 'cooler': IN.talkT = 2; return game.ui.open('dokon');
    }
    void I;
  };
  const spotText = (sp) => {
    switch (sp.k) {
      case 'door': return '<kbd>E</kbd> Tashqariga chiqish';
      case 'bed': return napNow() ? "<kbd>E</kbd> Mizg'ib olish (2 soat) 🛏" : `<kbd>E</kbd> Uxlash (budilnik ${hm(st.alarm || 6.5)}) 🛏`;
      case 'sit': if (pl.sit && HY.seat === sp) return sp.table ? (bestDish() ? `<kbd>E</kbd> Ovqatlanish (${ITEMS[bestDish()][1]} ${ITEMS[bestDish()][0]})` : "Yegulik yo'q — plitada pishiring") : null; return sp.sofa ? "<kbd>E</kbd> Divanga o'tirish" : "<kbd>E</kbd> O'tirish";
      case 'stove': return '<kbd>E</kbd> Ovqat pishirish 🍳';
      case 'fridge': return `<kbd>E</kbd> ${st.home.lvl < 2 ? 'Salqin quti' : 'Muzlatkich'} 🧊`;
      case 'tap': return '<kbd>E</kbd> Bir stakan suv ichish 💧';
      case 'sink': return "<kbd>E</kbd> Qo'l yuvish 🧼";
      case 'mirror': return "<kbd>E</kbd> Ko'zguga qarash 🪞";
      case 'shower': return '<kbd>E</kbd> Dush qabul qilish 🚿';
      case 'tv': return IN.tvOn ? (IN.tvCh < 2 ? `<kbd>E</kbd> Kanal: ${TV_CH[IN.tvCh + 1]} 📺` : "<kbd>E</kbd> Televizorni o'chirish") : '<kbd>E</kbd> Televizorni yoqish 📺';
      case 'radio': return st.set.music ? "<kbd>E</kbd> Radioni o'chirish 📻" : '<kbd>E</kbd> Radioni yoqish 📻';
      case 'kettle': return "<kbd>E</kbd> Choy damlash 🍵";
      case 'paper': return "<kbd>E</kbd> Gazeta o'qish 📰";
      case 'alarm': return `<kbd>E</kbd> Budilnik: ${hm(st.alarm || 6.5)} ⏰`;
      case 'desk': return '<kbd>E</kbd> Uy daftari (yaxshilash, garaj) 📒';
      case 'switch': return IN.lights ? "<kbd>E</kbd> Chiroqni o'chirish 💡" : '<kbd>E</kbd> Chiroqni yoqish 💡';
      case 'counter': return "<kbd>E</kbd> Sotuvchi — xarid qilish 🛒";
      case 'cooler': return '<kbd>E</kbd> Muzdek ichimliklar 🧃';
    }
    return null;
  };
  HY.spotAct = spotAct; HY.spotText = spotText;
  HY.spot = (k) => { const I = IN.cur(); return I && I.spots.find((s) => s.k === k); };

  // [E] takliflari (living.js findCtx → L.extra): uy/do'kon ichidagi narsalar, do'kon eshigi, kanistr, o'rnidan turish
  L.extra = (offer, px, pz) => {
    if (HY.dlg) return;
    const I = IN.cur();
    if (I) { for (const sp of I.spots) { const d = Math.hypot(sp.x - px, sp.z - pz); if (d > sp.r && !(pl.sit && HY.seat === sp)) continue; const tx = spotText(sp); if (tx) offer(pl.sit && HY.seat === sp ? -1 : d, tx, () => spotAct(sp)); } }
    else { for (const sh of HY.shops) { const d = Math.hypot(sh.x - px, sh.z - pz); if (d < 2.2) offer(d, `<kbd>E</kbd> Do'konga kirish 🛒`, () => HY.enterShop(sh)); }
      for (const s of FU.stations) { if (!s.kiosk || !pl.onFoot) continue; const d = Math.hypot(s.kiosk[0] - px, s.kiosk[1] - pz); if (d < 1.9) offer(d, `<kbd>E</kbd> Shoxobcha do'konchasi 🏪`, () => { pl.yaw = Math.atan2(s.x - px, s.z - pz) + Math.PI; game.ui.open('dokon', { kiosk: s.name }); }); }
      if (st.inv.canister > 0 && FU.uses() && FU.get() < 99) { const d = Math.hypot(car.p[0] - px, car.p[2] - pz) - car.spec.len / 2; if (d < 2.2) offer(d + 0.6, `<kbd>E</kbd> Kanistrdan yoqilg'i quyish ⛽ (${Math.round(FU.get())}%)`, () => pl.act('bend', 2.2, () => FU.canister())); } }
    if (pl.sit) offer(0, "<kbd>E</kbd> O'rnidan turish", stand);
  };

  // ================= NPC SUHBATI (o'yin to'xtamaydi) =================
  const dlgEl = document.createElement('div'); dlgEl.id = 'dlg'; dlgEl.className = 'panel'; dlgEl.style.display = 'none';
  const openDlg = (o) => {
    const k = L._dbg.npcs.indexOf(o), P = PERS[(k < 0 ? 0 : k) % PERS.length], set = P[2][(o.tip = (o.tip || 0) + 1) % P[2].length];
    HY.dlg = { o, P, lines: set.slice(), i: 0 }; o.waveT = 999; pl.yaw = Math.atan2(o.x - pl.p[0], o.z - pl.p[2]); pl.emote = 'talk'; pl.sit = false; sfx('click'); drawDlg();
  };
  const drawDlg = () => { const D = HY.dlg; if (!D) { dlgEl.style.display = 'none'; return; } if (!dlgEl.parentNode && game.ui) game.ui.hud.appendChild(dlgEl);
    dlgEl.innerHTML = `<div class="dp">${D.P[0]}</div><div class="dt"><b>${D.o.name}</b> <small>${D.P[1]}</small><p>${D.lines[D.i]}</p><i>${D.i + 1}/${D.lines.length} · <kbd>E</kbd> ${D.i + 1 < D.lines.length ? 'davom etish' : 'xayr'}</i></div>`; dlgEl.style.display = ''; };
  const closeDlg = (done) => { const D = HY.dlg; if (!D) return; HY.dlg = null; D.o.waveT = 1.2; if (pl.emote === 'talk') pl.emote = null; drawDlg();
    if (done) { L.count('talk'); if (Math.random() < 0.18) { give('seed'); toast(`${D.o.name}: «Mana, sizga urug'» 🌱 +1`, 'good'); } } };
  HY.nextDlg = () => { const D = HY.dlg; if (!D) return; sfx('click'); if (++D.i >= D.lines.length) closeDlg(true); else drawDlg(); };
  HY.openDlg = openDlg; HY.closeDlg = closeDlg; HY.drawDlg = drawDlg; // drawDlg — sir.js mish-mish qatorini qo'shgach qayta chizadi
  L.chat = (o) => openDlg(o); // living.js: oddiy suhbatdosh NPC → dialog

  // ================= [E] VA KADR YANGILANISHI =================
  const useE0 = L.useE;
  L.useE = () => { if (HY.dlg) return HY.nextDlg(); if (!pl.onFoot && FU.prompt() && !FU.fill && FU.pumpNear(car.p[0], car.p[2])) { FU.start(); return; } if (!pl.onFoot && FU.fill) return FU.stop("to'xtatildi"); useE0(); };
  const up0 = L.update;
  let thW = 0;
  L.update = (dt) => {
    up0(dt);
    const foot = pl.onFoot;
    // chanqoq: yurish/yugurish ko'proq, haydash va uyda kamroq
    const run = foot && pl.speed > 4.6, rate = !foot ? 0.035 : IN.inside ? 0.03 : run ? 0.12 : pl.speed > 0.4 ? 0.06 : 0.045;
    st.thirst = Math.max(0, st.thirst - rate * dt);
    if (st.thirst < 30) st.energy = Math.min(st.energy, 32 + st.thirst * 2.3); // chanqagan — yugurish kuchi kamayadi
    thW -= dt; if (thW <= 0 && st.thirst < 25) { thW = 90; toast(`💧 Chanqadingiz (${Math.round(st.thirst)}%) — suv iching: uyda jo'mrak, quduq yoki do'kon. Chanqoqda tez charchaysiz`, 'bad'); }
    FU.update(dt);
    if (IN.inside) { const I = IN.cur(), ri = IN.roomAt(pl.p[0], pl.p[2]); game.curPlace = IN.inside === 'home' ? game.site.places.uy : { name: "Do'kon" }; game.region = ri == null ? '' : IN.inside === 'home' ? (I.rooms[ri].t === 'all' ? 'Chodir ichi' : ROOM_NAME[I.rooms[ri].t]) : "Sotuvchi Hamid aka"; }
    // dialog: uzoqlashsa yopiladi
    if (HY.dlg) { const o = HY.dlg.o; if (!foot || Math.hypot(o.x - pl.p[0], o.z - pl.p[2]) > 3.6) closeDlg(false); else o.waveT = 999; }
    // ovqat pishirish jarayoni
    if (HY.cook) { const c = HY.cook; c.t += dt; c.fx -= dt; if (c.fx <= 0) { c.fx = 0.3; fx().burst(2, c.x, c.y, c.z, 0.25, 1.1, 0.35, 0xf6f6f2, 0.45, 1.2, -0.6, 2); } c.sz -= dt; if (c.sz <= 0) { c.sz = 1.5; sfx('sizzle'); }
      if (pl.lockAnim !== 'cook') { if (c.t >= c.dur - 0.05) { give(c.id); toast(`${ITEMS[c.id][1]} ${ITEMS[c.id][0]} tayyor! Stolga o'tirib yeng [E] yoki keyin [Y]`, 'gold'); sfx('medal'); } HY.cook = null; } }
    // dush suvi
    if (HY.showerT > 0) { HY.showerT -= dt; const s = HY.spot('shower'); if (s && Math.random() < 0.7) fx().burst(3, s.x - 0.3, IN.cur().o[1] + 2.0, s.z - 0.3, 0.3, 0.6, 0.12, 0xbfe6ff, 0.5, -1.5, 9, 0.5); }
    // uyqu: ekran qorayadi → vaqt o'tadi → yorishadi
    if (HY.sleep) { const S = HY.sleep, f = game.ui && game.ui.fade; S.t += dt; if (f) f.style.opacity = S.t > 1.0 && S.t < 3.4 ? 1 : 0; if (S.t > 2.2 && !S.done) HY.wake(); }
    // [E] taklifi (eng so'nggi so'z — shu yerda)
    if (HY.dlg) L.prompt = '<kbd>E</kbd> ' + (HY.dlg.i + 1 < HY.dlg.lines.length ? 'Davom etish' : 'Xayr');
    else if (HY.cook) L.prompt = `🍳 ${ITEMS[HY.cook.id][0]} pishmoqda… ${Math.min(100, Math.round(HY.cook.t / HY.cook.dur * 100))}%`;
    else if (HY.sleep) L.prompt = HY.sleep.done ? 'Uyg\'onmoqda…' : 'Uxlayapsiz… 💤';
    else if (!foot) { const fp = FU.prompt(); if (fp) L.prompt = fp; }
    // xarita belgilari
    for (const s of FU.stations) L.dots.push([s.x, s.z, '#ffb030']); for (const s of HY.shops) L.dots.push([s.x, s.z, '#3fd070']);
  };
  // signal (H) — yaqindagi aholi qo'l silkiydi
  let honkT = 0;
  game.hooks.push((dt) => {
    honkT -= dt;
    if (game.mode === 'play' && !pl.onFoot && game.input.hit('KeyH') && honkT <= 0) { let n = 0; for (const o of L._dbg.npcs) if (Math.hypot(o.x - car.p[0], o.z - car.p[2]) < 30) { o.waveT = 1.8; n++; } if (n) { honkT = 8; toast(`👋 ${n} kishi sizga qo'l silkidi`, ''); } }
    if (IN.inside) { IN.update(dt); IN.camera(dt); if (HY.dlg) closeDlg(false); }
    hud();
  });

  // ================= OYNALAR: oshxona, muzlatkich, do'kon =================
  const card = (left, right) => `<div class="card" style="margin-bottom:6px;flex-direction:row;align-items:center"><div class="grow">${left}</div>${right}</div>`;
  const attachUI = (ui) => {
  ui.s_oshxona = function (w, d, btn, x) {
    x(); const have = (r) => Object.entries(r[1]).every(([k, n]) => (st.inv[k] || 0) >= n);
    w.innerHTML = `<h1>🍳 Oshxona <small>plitada ovqat pishirish · to'qlik ${Math.round(st.sat)}% · 💧 ${Math.round(st.thirst)}%</small></h1>
      <div class="grid2"><div>${RECIPES.map((r) => card(`<h4>${ITEMS[r[0]][1]} ${ITEMS[r[0]][0]}</h4><p>Kerak: ${Object.entries(r[1]).map(([k, n]) => `${ITEMS[k][1]} ${ITEMS[k][0].toLowerCase()} ×${n} <small>(sizda ${st.inv[k] || 0})</small>`).join(', ')} · to'qlik +${ITEMS[r[0]][3]}</p>`, `<button data-a="cook:${r[0]}" ${have(r) ? '' : 'disabled'}>Pishirish · ${r[2]} s</button>`)).join('')}</div>
      <div><div class="card"><h4>Qanday?</h4><p>Masalliq — tabiatdan: baliq (qarmoq bilan), qo'ziqorin (o'rmon), tuxum (tovuq katagi), meva (daraxtni silkiting), sabzavot (poliz). Tayyor ovqatni oshxona stoliga o'tirib yeysiz — kuch ham qo'shiladi.</p></div>
      <div class="card" style="margin-top:8px"><h4>Tayyor ovqatlar</h4><p>${DISHES.filter((id) => st.inv[id] > 0).map((id) => `${ITEMS[id][1]} ${ITEMS[id][0]} ×${st.inv[id]}`).join(' · ') || "Hozircha yo'q"}</p></div></div></div>`;
    this.on({ cook: (id) => { const r = RECIPES.find((q) => q[0] === id); if (!r || !have(r)) return; for (const [k, n] of Object.entries(r[1])) st.inv[k] -= n; this.close(); startCook(id, r[2]); } });
  };
  };
  const startCook = (id, dur) => { const sp = HY.spot('stove'), I = IN.cur(); if (sp) { pl.p[0] = sp.x; pl.p[2] = sp.z; pl.yaw = sp.yaw; }
    const sx = sp ? sp.x + Math.sin(sp.yaw) * 0.6 : pl.p[0], sz = sp ? sp.z + Math.cos(sp.yaw) * 0.6 : pl.p[2];
    HY.cook = { id, dur, t: 0, fx: 0, sz: 0, x: sx, y: (I ? I.o[1] : pl.p[1]) + 1.0, z: sz }; pl.act('cook', dur, null, 'spoon'); sfx('sizzle'); toast(`🍳 ${ITEMS[id][0]} pishirilmoqda…`); };
  HY.startCook = startCook;
  const attachUI2 = (ui) => {
  ui.s_muzlatkich = function (w, d, btn, x) {
    x(); const fr = st.fridge, nm = st.home.lvl < 2 ? 'Salqin quti' : 'Muzlatkich';
    const render = () => { const inBag = FOODISH.filter((id) => st.inv[id] > 0), inFr = FOODISH.filter((id) => fr[id] > 0);
      w.innerHTML = `<h1>🧊 ${nm} <small>ovqat saqlanadi, buzilmaydi</small></h1><div class="grid2"><div><h4 style="margin:0 0 6px">Sumkada</h4><div class="invg">${inBag.map((id) => `<div class="it" data-a="put:${id}" title="Qo'yish"><b>${ITEMS[id][1]}</b><span>${ITEMS[id][0]}</span><i>${st.inv[id]}</i><u>qo'yish →</u></div>`).join('') || '<p class="sub">Yegulik yo\'q</p>'}</div>
        <button class="sec" data-a="putall" style="margin-top:8px" ${inBag.length ? '' : 'disabled'}>Hammasini qo'yish</button></div>
        <div><h4 style="margin:0 0 6px">${nm}da</h4><div class="invg">${inFr.map((id) => `<div class="it" data-a="take:${id}" title="Olish"><b>${ITEMS[id][1]}</b><span>${ITEMS[id][0]}</span><i>${fr[id]}</i><u>← olish</u></div>`).join('') || '<p class="sub">Bo\'sh</p>'}</div>
        <button class="sec" data-a="takeall" style="margin-top:8px" ${inFr.length ? '' : 'disabled'}>Hammasini olish</button></div></div>`; };
    const mv = (id, a, b) => { if (!(a[id] > 0)) return; a[id]--; b[id] = (b[id] || 0) + 1; sfx('pick'); };
    this.on({ put: (id) => { mv(id, st.inv, fr); render(); }, take: (id) => { mv(id, fr, st.inv); render(); }, putall: () => { for (const id of FOODISH) while (st.inv[id] > 0) mv(id, st.inv, fr); render(); }, takeall: () => { for (const id of FOODISH) while (fr[id] > 0) mv(id, fr, st.inv); render(); } });
    render();
  };
  HY.buy = (id) => { const it = SHOP2.find((q) => q[0] === id); if (!it || st.money < it[2]) return false; game.addMoney(-it[2], 'Do\'kon: ' + it[1]); give(id); sfx('buy'); return true; };
  ui.s_dokon = function (w, d, btn, x) {
    x(); const ki = d && d.kiosk, gr = ki ? KIOSK_GREET[(HY.greetI = ((HY.greetI || 0) + 1)) % KIOSK_GREET.length] : GREET[(HY.greetI = ((HY.greetI || 0) + 1)) % GREET.length];
    const render = () => { w.innerHTML = `<h1>${ki ? `🏪 ${ki} do'konchasi` : "🛒 Do'kon"} <small>💰 ${som(st.money)} so'm · 💧 ${Math.round(st.thirst)}% · ⛽ ${FU.uses() ? Math.round(FU.get()) + '%' : '—'}</small></h1>
      <div class="card" style="margin-bottom:10px;flex-direction:row;align-items:center;gap:12px"><div style="font-size:34px">${ki ? '🧑‍🔧' : '🧔'}</div><div class="grow"><h4>${ki ? 'Kassir Jasur' : 'Sotuvchi Hamid aka'}</h4><p>«${gr}»</p></div></div>
      <div class="grid2"><div>${SHOP2.slice(0, 3).map(([id, n, c]) => card(`<h4>${ITEMS[id][1]} ${n}</h4><p>Sizda: ${st.inv[id] || 0}${DRINK[id] > 0 ? ` · 💧 +${DRINK[id]}` : ''}${ITEMS[id][3] > 1 ? ` · 🍽 +${ITEMS[id][3]}` : ''}</p>`, `<button data-a="buy:${id}" ${st.money < c ? 'disabled' : ''}>${c} so'm</button>`)).join('')}</div>
      <div>${SHOP2.slice(3).map(([id, n, c]) => card(`<h4>${ITEMS[id][1]} ${n}</h4><p>Sizda: ${st.inv[id] || 0}${ITEMS[id][3] > 1 ? ` · 🍽 +${ITEMS[id][3]}` : ''}${id === 'canister' ? ' · istalgan joyda bakka quyiladi' : ''}</p>`, `<button data-a="buy:${id}" ${st.money < c ? 'disabled' : ''}>${c} so'm</button>`)).join('')}</div></div>
      <p class="sub" style="margin-top:8px">Ichimlikni <kbd>Y</kbd> bilan ichasiz (chanqagan bo'lsangiz avval ichimlik tanlanadi). Kanistr — transport yonida <kbd>E</kbd>.</p>`; };
    this.on({ buy: (id) => { if (HY.buy(id)) { toast(`${ITEMS[id][1]} ${ITEMS[id][0]} sotib olindi`, 'good'); render(); } } });
    render();
  };
  };

  // ================= HUD: chanqoq (piyoda) va yoqilg'i (transportda) =================
  let hudOk = false;
  const hud = () => {
    if (!game.ui || game.mode === 'menu') return; const $ = (id) => document.getElementById(id);
    if (!hudOk) { const sat = $('h-sat'), spd = $('h-spd'); if (!sat || !spd) return; hudOk = true; attachUI(game.ui); attachUI2(game.ui);
      const b = sat.parentElement; b.insertAdjacentHTML('afterend', `<div class="fl">💧 Suv</div><div class="bar"><i id="h-thirst" style="background:var(--blue)"></i></div>`);
      spd.insertAdjacentHTML('beforeend', `<div class="fuelg" id="h-fuelg"><span>⛽</span><div class="bar"><i id="h-fuel"></i></div><b id="h-fuelp">100</b></div>`); }
    const th = Math.round(st.thirst); if (HY._th !== th) { HY._th = th; const e = $('h-thirst'); e.style.width = th + '%'; e.style.background = th < 25 ? 'var(--bad)' : 'var(--blue)'; }
    const uses = FU.uses(), f = Math.round(FU.get()); const key = uses ? f : -1; if (HY._fu !== key) { HY._fu = key; $('h-fuelg').style.display = uses ? '' : 'none'; if (uses) { const e = $('h-fuel'); e.style.width = f + '%'; e.style.background = f < 15 ? 'var(--bad)' : f < 35 ? 'var(--ac)' : 'var(--good)'; $('h-fuelp').textContent = f; } }
  };
  return HY;
}
