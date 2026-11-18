// SAFAR — bosh fayl: yuklash, asosiy sikl, boshqaruv tugmalari
import * as THREE from 'three';
import * as T from './terrain.js';
import { initMaterials, MAT, WIND } from './geo.js';
import { Sky } from './sky.js';
import { buildTerrain, buildRoads } from './worldgfx.js';
import { Car, Autopilot } from './physics.js';
import { ChaseCam } from './camera.js';
import { Input } from './input.js';
import { buildProps, buildDetail } from './props.js';
import { buildPlaces } from './places.js';
import { FX } from './fx.js';
import { Damage } from './damage.js';
import { Sound } from './audio.js';
import { initGame } from './game.js';
import { UI } from './ui.js';
import { buildLife } from './life.js';
import { syncWheels } from './vehicles.js';
import { Player } from './player.js';
import { initLiving } from './living.js';
import { buildAds } from './ads.js';
import { initGfx } from './gfx.js';
import { bakeTextures, rebakeTextures } from './tex.js';
import { initLook, LOOK } from './look.js';
import * as COLL from './colliders.js';
import { runKeys } from './controls.js';
import { initNet } from './net.js';
import { initCoop } from './coop.js';
import { initOnlineUI } from './onlineui.js';

const FIXED = 1 / 120, TEST = !!window.__TEST;
const game = (window.G = { T, THREE, Autopilot, COL: COLL, mode: 'menu', time: 0, hour: 9.5, dayLen: 20 * 60, hooks: [], subN: 2, hudOn: true });
const tick = () => new Promise((r) => setTimeout(r, 0));

async function boot() {
  const bar = document.querySelector('#load .bar i'), msg = document.querySelector('#load p');
  const step = async (f, text) => { if (bar) bar.style.width = f * 100 + '%'; if (msg) msg.textContent = text; await tick(); await tick(); };
  const canvas = document.getElementById('c');
  const renderer = (game.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' }));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  game.tex = bakeTextures(renderer); // umumiy shovqin teksturalari (tex.js)
  const scene = (game.scene = new THREE.Scene());
  const camera = (game.camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 1.2, 14000));
  const resize = () => { renderer.setPixelRatio(game.pr || 1); renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); if (game.fx) game.fx.uni.uScale.value = innerHeight * (game.pr || 1) * 0.9; if (game.gfx) game.gfx.resize();
    // kanvas o'lchami o'rnatilganda (hatto o'sha o'lchamga) uning tasviri tozalanadi — darhol qayta chizamiz, aks holda keyingi kadr
    // kechiksa (sheyder kompilyatsiyasi, og'ir kadr) ekran qora bo'lib turadi
    if (game.ready && !game.ctxLost) game.gfx.render(); };
  game.resize = resize; addEventListener('resize', resize);
  initLook(game); // umumiy uniformlar, atmosfera tumani, materiallar yamog'i (initMaterials'dan oldin)

  await step(0.05, 'Orol relyefi yaratilmoqda…');
  T.initWorld();
  await step(0.36, "Tog'lar va vodiylar…");
  initMaterials();
  game.sky = new Sky(scene);
  game.terrain = buildTerrain(scene);
  await step(0.5, "Yo'llar va daryolar…");
  buildRoads(scene);
  await step(0.58, 'Manzillar va uyingiz qurilmoqda…');
  game.site = buildPlaces(scene, game);
  await step(0.7, "O'rmonlar ekilmoqda, toshlar terilmoqda…");
  game.props = buildProps(scene, game); game.detail = buildDetail(scene);
  await step(0.84, 'Transportlar tayyorlanmoqda…');
  game.world = { ground: T.ground, waterY: T.waterY };
  const car = (game.car = new Car(game.world));
  game.fx = new FX(scene, renderer);
  game.cam = new ChaseCam(camera);
  game.input = new Input();
  game.audio = new Sound();
  game.damage = new Damage(game);
  game.carPos = new THREE.Vector3(); game.footPos = new THREE.Vector3();
  initGame(game);
  const st = game.state, home = game.site.places.uy.home;
  game.player = new Player(game); game.player.setHat(st.hat);
  game.life = buildLife(scene, game);
  await step(0.92, 'Aholi, hayvonlar va reklama shitlari…');
  game.ads = buildAds(scene, game.site);
  initLiving(game);
  game.gfx = initGfx(game);
  game.localLight = new THREE.PointLight(0xffe4c4, 0, 26, 2); scene.add(game.localLight);
  // boshlang'ich joy: yangi o'yin — uy oldida
  if (st.pos && !st.fresh) { car.place(st.pos[0], st.pos[1], st.pos[2]); game.hour = st.hour || 9.5; }
  else car.place(home.park[0], home.park[1], home.parkYaw);
  game.prevP = car.p.slice(); game.carPos.fromArray(car.p); game.acc = 0;
  if (st.foot && !st.fresh) { game.live.dismount(true); game.player.place(st.foot[0], st.foot[1], st.foot[2]); }
  game.ui = new UI(game);
  initNet(game); initCoop(game); initOnlineUI(game); // onlayn rejim (faqat saytda; faylda — "mavjud emas")
  game.applyQuality('boot'); resize();
  game.gfx.precompile(); // barcha sheyderlar yuklash paytida tayyorlanadi
  // videokarta konteksti yo'qolsa (drayver qayta ishga tushdi va h.k.) — kutamiz va qaytganda hammasini qayta tiklaymiz
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); game.ctxLost = true; console.warn('WebGL konteksti yo\'qoldi'); });
  canvas.addEventListener('webglcontextrestored', () => { game.ctxLost = false; game.tex = rebakeTextures(renderer); game.gfx.envRefresh(); resize(); console.warn('WebGL konteksti tiklandi'); });
  game.sky.setHour(game.hour);
  await step(1, 'Tayyor!');
  const ld = document.getElementById('load'); if (ld) ld.remove();
  game.ready = true; window.__ready = true;
  if (TEST) { game.mode = 'play'; game.freezeTime = true; game.paused = true; }
  else { game.ui.open('menu'); game.cam.mode = 3; }
  const unlock = () => { game.audio.init(); game.audio.setVol(st.set.vol); game.audio.setMusic(st.set.music); };
  addEventListener('pointerdown', unlock); addEventListener('keydown', unlock);
  addEventListener('beforeunload', () => game.save());
  requestAnimationFrame(frame);
  game.net.start();
}

// mode: (bo'sh) — o'yinchi Sozlamalarda o'zgartirdi; 'boot' — o'yin ochilishi;
// true — o'yin o'zi (sinov tariqasida) o'zgartiryapti: joriy aniqlik saqlanadi, taqiqlar tozalanmaydi
game.applyQuality = (mode) => {
  const set = game.state.set, q = set.gfx, dpr = Math.min(devicePixelRatio || 1, 2), auto = mode === true;
  LOOK.U.uQ.value = q; // sheyder sifat shoxlari (qayta kompilyatsiyasiz)
  // eng yuqori sifatda ekrandan ko'proq piksel (silliqroq qirralar); sekinlashsa adapt() o'zi pasaytiradi
  game.prCap = [Math.min(dpr, 1), Math.min(dpr, 1.5), Math.min(2, Math.max(1, dpr) * 1.5)][q]; game.pr = auto ? Math.min(game.pr || game.prCap, game.prCap) : game.prCap;
  qT = 0; ftAvg = 16; ftSum = 0; ftN = 0; ftT = 0; goodN = 0; calmN = 0; upAge = 99; prCeil = Infinity; ceilT = 0; desc = null; settle = 2;
  if (!auto) {
    ceilN = 0; lockT = 0; lockN = 0; qLock = false; qTry = null; upTry = null; upTries = 0;
    if (mode !== 'boot' || !(set.gfxAuto > q)) { delete set.gfxAuto; delete set.gfxUpFail; } // o'yinchining o'z tanlovi — eslab qolingan avtomatik pasaytirish bekor
  }
  game.sky.setShadowQuality([1024, 2048, 2048][q]);
  game.props.far = [900, 1400, 1800][q]; game.props.hiD = [230, 310, 380][q]; game.detail.dens = [0.45, 0.8, 1][q];
  if (game.gfx) game.gfx.setQuality(q);
  if (game.terrain && game.terrain.setQuality) game.terrain.setQuality(q); // yer va yo'l sheyderi: 0-darajada arzon yo'l
  if (game.fx && game.fx.setQuality) game.fx.setQuality(q);
  game.resize && game.resize();
};
game.startPlay = () => {
  const first = game.totalStars() === 0 && game.state.stats.dist < 300;
  game.mode = 'play'; game.cam.mode = 0; game.cam.snap(); game.audio.init(); game.state.fresh = false; game.ui.setHud(true);
  if (first) {
    game.banner('Xush kelibsiz, sayyoh!', "Bu chodir — sizning uyingiz. Yo'l bo'ylab qishloqqa boring: sariq belgi — e'lonlar taxtasi", 'gold');
    const tips = ["<b>W A S D</b> — haydash · <b>Probel</b> — qo'l tormozi (drift) · <b>Shift</b> — nitro", '<b>F</b> — transportdan tushish/chiqish. Piyoda: <b>Q</b> o\'t yulish · <b>G</b> gul ekish · <b>E</b> daraxt silkitish · <b>Y</b> yeyish', '<b>B</b> — harakatlar menyusi · <b>I</b> — sumka va topshiriqlar · <b>M</b> — xarita', "Ko'k belgi — ustaxona: ta'mir, tyuning va 22 xil transport saloni", "Sakrash, drift va yaxshiliklar uchun tanga beriladi. Pul yig'ib uyingizni yaxshilang!", "Ehtiyot bo'ling: qattiq urilsangiz mashina pachoqlanadi va motor o'chib qoladi"];
    tips.forEach((t, i) => setTimeout(() => game.mode !== 'menu' && game.toast(t, i === 5 ? 'bad' : 'gold'), 5000 + i * 9000));
  }
  game.save();
};
game.retry = (a) => { if (a.place && a.cat !== 'race' && a.cat !== 'zone') { const pl = game.site.places[a.place]; game.car.place(pl.board.x + 6, pl.board.z + 6, 0); game.respawn(); } game.startAct(a); };
// Transportni tanlash: ustaxona yoki uy oldiga qo'yiladi
game.pickVehicle = (id, at) => { game.setVehicle(id); if (at) { game.car.place(at[0], at[1], at[2] || 0); game.prevP = game.car.p.slice(); } game.cam.snap(); game.save(); };
game.goHome = () => { const h = game.site.places.uy.home; game.car.place(h.park[0], h.park[1], h.parkYaw); game.prevP = game.car.p.slice(); if (game.player.onFoot) game.live.mount(false); game.cam.snap(); };

function syncCar(alpha) {
  const car = game.car, m = game.carModel, p = car.p, pp = game.prevP, dm = game.damage, foot = game.player.onFoot;
  game.carPos.set(pp[0] + (p[0] - pp[0]) * alpha, pp[1] + (p[1] - pp[1]) * alpha, pp[2] + (p[2] - pp[2]) * alpha);
  m.root.position.copy(game.carPos); m.root.quaternion.set(car.q[0], car.q[1], car.q[2], car.q[3]);
  syncWheels(m, car, dm.tires);
  const night = game.sky.night;
  // faralar oldi qattiq urilgandagina so'nadi (butunlay o'chmaydi — tunda yo'l ko'rinmay qolardi); xira bo'lsa biroz miltillaydi
  const on = ((night > 0.3 && !foot) || game.lightsForced) && !(dm.wrecked && m.v.eng > 0), fr = dm.zone.front;
  m.spot.intensity = on ? 560 * (fr < 12 ? 0.45 * (0.85 + 0.15 * Math.sin(game.time * 23)) : fr < 35 ? 0.75 : 1) : 0;
  if (on) m.headMat.color.setRGB(2.6, 2.4, 1.9); else m.headMat.color.setHex(0xb8b8b0);
  const braking = !foot && ((game.input.state.brake > 0.1 && car.fwd > 1) || game.input.state.handbrake);
  if (braking) m.tailMat.color.setRGB(2.4, 0.22, 0.12); else m.tailMat.color.setHex(on ? 0xa81810 : 0x6a1410);
}

const ZERO = { throttle: 0, brake: 0, steer: 0, handbrake: false, nitro: false }, PARK = { throttle: 0, brake: 0, steer: 0, handbrake: true, nitro: false };
const _wh = new THREE.Color(1, 1, 1); // mahalliy chiroq rangini oqqa yaqinlashtirish uchun
let ftAvg = 16, ftSum = 0, ftN = 0, ftT = 0, qT = 0, longN = 0, settle = 0, goodN = 0, calmN = 0, upAge = 99, prCeil = Infinity, ceilT = 0, ceilN = 0;
let desc = null, lockT = 0, lockN = 0, qTry = null, qLock = false, upTry = null, upTries = 0;
function update(dt) {
  const g = game, car = g.car, pl = g.player;
  runKeys(game); // klaviatura va ekran tugmalari — controls.js jadvali bo'yicha
  const playing = g.mode === 'play' || g.mode === 'menu', foot = pl.onFoot;
  let inp = foot ? PARK : ZERO;
  if (g.mode === 'play' && !foot) { inp = g.auto ? g.auto.input(car) : g.input.poll(); if (g.auto && g.auto.done) g.auto = null; if (g.act && g.act.state === 'count') inp = ZERO; if (inp.nitro && g.nitro < 0.03) inp = Object.assign({}, inp, { nitro: false }); }
  let alpha = 1;
  if (playing) {
    g.acc += dt; let n = 0;
    while (g.acc >= FIXED && n < 6) { g.prevP[0] = car.p[0]; g.prevP[1] = car.p[1]; g.prevP[2] = car.p[2]; car.step(FIXED, inp); g.acc -= FIXED; n++; }
    if (n === 6) g.acc = 0; g.subN = n; alpha = g.acc / FIXED;
    g.time += dt; WIND.value = g.time;
    if (g.mode === 'play' && foot) pl.update(dt, g.ui.screenName ? null : g.input, g.cam.heading + g.cam.yawOff, g.state);
    if (!g.freezeTime && g.mode === 'play' && !(g.act && g.act.hourBak != null)) g.hour = (g.hour + (dt / g.dayLen) * 24) % 24;
    g.life.update(dt, g.time, g.mode === 'play' && !(g.act && g.act.def.type === 'race'));
    if (g.mode === 'play') g.updateGame(dt); else car.events.length = 0;
  }
  LOOK.U.uQ.value = g.state.set.gfx; g.sky.setHour(g.hour);
  syncCar(alpha);
  const night = g.sky.night, focus = foot ? g.footPos.set(pl.p[0], pl.p[1], pl.p[2]) : g.carPos;
  { const k = 0.25 + 1.5 * night; MAT.glow.color.setRGB(k, k * (0.9 + 0.1 * night), k * (0.75 + 0.25 * (1 - night))); for (const a of g.site.anim) a(dt, g.time, night); }
  // eng yaqin chiroq/gulxan yorug'ligi
  { const L = g.localLight; let best = null, bd = 80 * 80; if (night > 0.25) for (const l of g.site.lights) { if (l.on === false) continue; const d = (l.x - focus.x) ** 2 + (l.z - focus.z) ** 2; if (d < bd) { bd = d; best = l; } }
    if (best) { L.position.set(best.x, best.y, best.z); L.color.setHex(best.hex).lerp(_wh, 0.45); L.intensity += (best.power * 34 * night * (0.9 + 0.1 * Math.sin(g.time * 9)) - L.intensity) * Math.min(1, dt * 4); } else L.intensity *= 0.9; }
  g.camera.near = g.cam.mode === 2 && !foot ? 0.3 : g.zoomView ? 0.6 : 1.2;
  const sp = car.spec;
  g.cam.update(dt, foot ? pl : car, focus, g.mode === 'play' ? g.input : null, { water: T.waterY(g.camera.position.x, g.camera.position.z), freeze: g.mode === 'menu', foot, zoom: g.zoomView, len: sp.len, hgt: sp.hgt });
  g.sky.update(dt, g.camera, focus);
  g.terrain.update(g.camera); g.props.update(g.camera); g.detail.update(g.camera);
  { let dh = Math.abs(g.hour - (g._envH == null ? -99 : g._envH)); if (dh > 12) dh = 24 - dh; const envF = g.state.set.gfx > 0 && dh > 0.1; if (envF) g._envH = g.hour; g.gfx.update(dt, envF); } // osmon yoritishi (PMREM) ~5 s da bir yangilanadi (0-darajada — gfx.js'ning o'z siyrak jadvali)
  g.fx.update(dt, g.camera);
  const surf = car.wheels[2].surf, bio = T.biomeAt(focus.x, focus.z);
  let fire = 0; if (g.site.fires) for (const f of g.site.fires) { const d = Math.hypot(f.x - focus.x, f.z - focus.z); if (d < 30) fire = Math.max(fire, 1 - d / 30); }
  g.audio.update(dt, car, { night, surf, mute: g.mode === 'ui', dead: g.damage.wrecked || car.cut, sea: bio === T.BIOME.BEACH ? 1 : 0, snow: bio === T.BIOME.SNOW ? 1 : 0, green: bio === 0 || bio === 1 || bio === 2 || bio === 7 || bio === 8, fire, calm: !g.act, foot, eng: g.carModel.v.eng });
  if (g.mode !== 'menu') g.ui.update(dt);
  for (const h of g.hooks) h(dt);
  g.input.endFrame();
}

let last = 0;
function frame(t) {
  requestAnimationFrame(frame);
  const raw = (t - last) / 1000 || 0.016; last = t;
  const dt = Math.min(0.05, raw);
  if (!game.ready || game.paused) return;
  update(dt);
  if (game.ctxLost) return;
  game.gfx.render();
  adapt(raw);
}

// Moslashuvchan grafika. Qoidalar:
//  1) kadr sekinlashsa — piksel zichligini kamaytiramiz, ravonlashsa — asta-sekin qaytaramiz
//     (kadr vaqti ekran chastotasidan tez bo'lolmaydi, shuning uchun "ravon" chegarasi 60 Gs ekranda ham bajariladi);
//  2) boshqa oynaga o'tib qaytgandagi uzilish sekinlik hisoblanmaydi;
//  3) kamaytirish FOYDA BERMASA (brauzer quvvat tejash rejimida kadrni 30 ga cheklagan va h.k.) — hammasini
//     joyiga qaytaramiz va tasvirni bekorga xiralashtirmaymiz;
//  4) sifat pog'onasi avtomatik tushirilgan bo'lsa-yu, keyin o'yin bemalol ravon ishlasa — uni qayta ko'tarib ko'ramiz.
function adapt(raw) {
  if (raw > 0.25 && ++longN < 6) { settle = 1; return; }
  if (raw <= 0.25) longN = 0;
  if (settle > 0) { settle -= raw; return; }
  ftSum += Math.min(raw, 0.25); ftN++; ftT += raw;
  if (ftT < 2.5) return;
  ftAvg = (ftSum / ftN) * 1000; ftSum = 0; ftN = 0; ftT = 0; upAge++; qT += 2.5; // oxirgi 2,5 soniyaning o'rtacha kadr vaqti (ms)
  if (ceilT > 0 && (ceilT -= 2.5) <= 0) prCeil = Infinity;
  if (lockT > 0) lockT -= 2.5;
  const set = game.state.set, pr = game.pr, cap = Math.min(game.prCap, prCeil), slow = ftAvg > 24, play = game.mode === 'play';

  // Sifat pog'onasini tushirish sinovi: 10 soniyadan keyin tezlashmagan bo'lsa — sabab grafikada emas, qaytaramiz
  if (qTry) {
    if ((qTry.t += 2.5) < 10) return;
    const t = qTry; qTry = null;
    if (ftAvg < t.ft * 0.9) {
      if (set.gfxAuto == null) set.gfxAuto = t.from; set.gfxUpFail = 0; lockT = 0; lockN = 0; desc = null; calmN = 0;
      game.toast('Kompyuter qiynalmasligi uchun grafika sifati pasaytirildi (Sozlamalarda o\'zgartirish mumkin)');
    } else { set.gfx = t.from; qLock = true; game.applyQuality(true); game.pr = Math.min(t.pr, game.prCap); game.resize(); }
    return;
  }
  // Sifat pog'onasini qayta ko'tarish sinovi: 10 soniyadan keyin sekinlashgan bo'lsa — orqaga
  if (upTry) {
    if ((upTry.t += 2.5) < 10) return;
    upTry = null;
    if (slow) { set.gfx--; upTries = 9; set.gfxUpFail = (set.gfxUpFail || 0) + 1; if (set.gfxUpFail >= 2) delete set.gfxAuto; game.applyQuality(true); }
    else { if (set.gfx >= set.gfxAuto) { delete set.gfxAuto; delete set.gfxUpFail; } game.toast('Grafika sifati qayta ko\'tarildi'); }
    return;
  }

  if (slow && lockT <= 0) {
    goodN = 0;
    if (upAge <= 2 && pr > 0.6) {
      // hozirgina ko'targan edik — demak shu kompyuterning chegarasi shu: orqaga qaytamiz va bir muddat urinmaymiz
      game.pr = Math.max(0.6, pr - 0.1); prCeil = game.pr; ceilT = Math.min(600, 90 * 2 ** ceilN++); desc = null;
    } else {
      if (!desc) desc = { pr, ft: ftAvg, n: 0 };
      const floor = pr <= 0.6;
      if ((desc.n >= 4 || (floor && desc.n > 0)) && ftAvg > desc.ft * 0.9) {
        // ancha kamaytirdik — foydasi yo'q: sekinlik sababi aniqlikda emas. Joyiga qaytaramiz
        game.pr = desc.pr; lockT = [300, 900, 3600][Math.min(2, lockN++)]; desc = null;
      } else if (!floor) { game.pr = Math.max(0.6, pr - (ftAvg > 45 ? 0.3 : 0.15)); desc.n++; } // juda sekin bo'lsa — kattaroq qadam
    }
  } else if (!slow) {
    desc = null;
    if (ftAvg < 20.5 && pr < cap) { if (++goodN >= 2) { game.pr = Math.min(cap, pr + 0.1); goodN = 0; upAge = 0; } } else goodN = 0;
  }
  if (game.pr !== pr) game.resize();

  // Aniqlik eng pastga tushib qolgan (yoki u foyda bermayapti) va hali ham sekin — sifat pog'onasini sinab ko'ramiz
  if (!qLock && set.gfx > 0 && qT > 10 && play && game.pr === pr && ((pr <= 0.75 && ftAvg > 20.5) || (lockT > 0 && ftAvg > 30))) {
    qTry = { ft: ftAvg, from: set.gfx, pr, t: 0 }; set.gfx--; game.applyQuality(true); return;
  }
  // Avval avtomatik tushirilgan, endi esa to'liq aniqlikda 45 soniya bemalol ravon — bir pog'ona ko'tarib ko'ramiz
  if (set.gfxAuto > set.gfx && upTries < 2 && play && ftAvg < 20.5 && game.pr === pr && pr >= game.prCap) {
    if (++calmN >= 18) { upTries++; upTry = { t: 0 }; set.gfx++; game.applyQuality(true); }
  } else calmN = 0;
}

// --- sinov uchun ilgaklar ---
const P = () => (game.player.onFoot ? game.player.p : game.car.p);
game._adapt = (raw, n = 1) => { for (let i = 0; i < n; i++) adapt(raw); return { pr: +game.pr.toFixed(2), cap: game.prCap, ft: +ftAvg.toFixed(1), ceil: prCeil, gfx: game.state.set.gfx, lock: lockT, qLock, trial: !!qTry || !!upTry, auto: game.state.set.gfxAuto }; };
game.advance = (secs, step = 1 / 60) => { const n = Math.round(secs / step); for (let i = 0; i < n; i++) update(step); game.gfx.render(); return P().map((v) => +v.toFixed(1)).concat([+(game.car.speed * 3.6).toFixed(0)]); };
game.teleport = (x, z, yaw = 0, hour) => { if (game.player.onFoot) game.player.place(x, z, yaw); else { game.car.place(x, z, yaw); game.prevP = game.car.p.slice(); } if (hour != null) { game.hour = hour; game.freezeTime = true; } game.cam.snap(); return game.advance(0.5); };
game.drive = (keys2, maxSpeed = 22) => { const pts = T.pathByNodes(keys2); game.car.place(pts[0][0], pts[0][1], Math.atan2(pts[3][0] - pts[0][0], pts[3][1] - pts[0][1])); game.prevP = game.car.p.slice(); game.cam.snap(); game.auto = new Autopilot(pts, { maxSpeed }); };
game.view = (x, y, z, tx, ty, tz, hour) => { game.camera.position.set(x, y, z); game.camera.lookAt(tx, ty, tz); if (hour != null) { game.hour = hour; game.sky.setHour(hour); } game.sky.update(0, game.camera, new THREE.Vector3(tx, ty, tz)); game.terrain.update(game.camera); game.props.update(game.camera); game.detail.update(game.camera, true); game.gfx.update(0.016, true); game.gfx.render(); const i = game.renderer.info.render; return i.triangles + ' tris ' + i.calls + ' calls'; };
// renderlamasdan oldinga yurgizish (sinov uchun tez)
game.sim = (secs) => { const n = Math.round(secs * 60); for (let i = 0; i < n; i++) { update(1 / 60); if (game.ui.screenName) game.ui.close(); } return P().map((v) => +v.toFixed(1)).concat([+(game.car.speed * 3.6).toFixed(0)]); };
game.autoPts = (pts, maxSpeed = 22) => { game.auto = new Autopilot(pts, { maxSpeed }); };
game.autoTo = (x, z, maxSpeed = 24) => { const p = game.car.p; const r = T.route(p[0], p[2], x, z); if (!r) return 0; const pts = r.pts.map((q) => [q[0], q[1]]); pts.push([x, z]); game.auto = new Autopilot(pts, { maxSpeed }); return pts.length; };
// shart bajarilguncha yoki vaqt tugaguncha oldinga yurgizish (natija oynasini avtomatik yopadi)
game.runUntil = (cond, maxSecs = 300) => { let t = 0; const f = typeof cond === 'string' ? new Function('G', 'return ' + cond) : cond; while (t < maxSecs) { update(1 / 60); t += 1 / 60; if (game.ui.screenName) { game.ui.close(); if (f(game)) break; } if (f(game)) break; } game.gfx.render(); return +t.toFixed(1); };
boot().catch((e) => { console.error(e); const m = document.querySelector('#load p'); if (m) m.textContent = 'Xatolik: ' + e.message; });
