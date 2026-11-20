// Boshqaruv jadvali: har bir tugma (klaviatura) nima qilishi va ekrandagi tugmalar — ikkalasi ham shu bitta ro'yxatdan
import * as T from './terrain.js';

// Har bir amal:
//   key   — ekranda ko'rinadigan tugma nomi;  codes — klaviatura kodlari (birinchisi ekrandagi tugma bosilganda yuboriladi)
//   on    — 'foot' piyoda, 'car' transportda, yo'q bo'lsa — har doim;  ok(g) — hozir ishlaydimi (klaviatura ham shunga bo'ysunadi)
//   run(g)— bajariladigan ish;  hold — tugma bosib turiladi va boshqa joyda o'qiladi (yugurish, nitro, qo'l tormozi, durbin)
//   bar(g)— ekrandagi tugma yozuvi (null/yo'q — tugma chiqmaydi);  top — yuqori o'ngdagi kichik tugmalar qatori
//   one   — piyoda harakatlari guruhi: bir kadrda faqat bittasi bajariladi
const near = (g) => { const c = g.car.p, p = g.player.p; return Math.hypot(c[0] - p[0], c[2] - p[2]) < g.car.spec.len / 2 + 2.4; };
const counting = (g) => g.act && g.act.state === 'count';
const free = (g) => g.player.lock <= 0;
const outdoor = (g) => free(g) && !(g.interior && g.interior.inside); // uy/do'kon ichida tashqi harakat tugmalari chiqmaydi
const riding = (g) => !!(g.coop && g.coop.ride) || !!(g.suv && g.suv.cur);
const wrestling = (g) => !!(g.kurash && g.kurash.on); // kurash davrasida (kurash.js): A/D/W/S/Probel — kurash harakatlari, piyoda tugmalari ishlamaydi // onlayn: do'st mashinasida yo'lovchi (coop.js) yoki qayiq/deltaplanda (suv.js) — piyoda tugmalari ishlamaydi
export const ACTIONS = [
  // --- umumiy (yuqori o'ngdagi qator) ---
  { key: 'M', codes: ['KeyM'], top: 1, bar: () => 'Xarita', run: (g) => g.ui.open('map') },
  { key: 'I', codes: ['KeyI'], top: 1, bar: () => 'Sumka', run: (g) => g.ui.open('bag') },
  { key: 'Tab', codes: ['Tab', 'KeyJ'], top: 1, bar: () => 'Pasport', run: (g) => g.ui.open('progress') },
  { key: 'C', codes: ['KeyC'], top: 1, bar: () => 'Kamera', run: (g) => { g.cam.next(); g.toast('Kamera: ' + g.cam.modeName); } },
  { key: 'P', codes: ['KeyP'], top: 1, bar: () => 'Surat', run: (g) => g.ui.setHud(!g.hudOn) },
  { key: 'O', codes: ['KeyO'], top: 1, bar: () => 'Onlayn', run: (g) => g.ui.open('online') },
  { key: '4', codes: ['Digit4', 'Numpad4'], top: 1, bar: () => 'Telefon', run: (g) => g.phone && g.phone.open() }, // telefon (ish.js)
  { key: '6', codes: ['Digit6', 'Numpad6'], top: 1, bar: () => 'Hafta', run: (g) => g.hafta && g.hafta.open() }, // haftalik chellenj, reyting, nishonlar (hafta.js)
  { key: 'U', codes: ['KeyU'], ok: (g) => !!(g.coop && g.coop.room), bar: () => 'Chat', run: (g) => g.coop.openChat() }, // onlayn xonada chat
  // onlayn xonada ovozli chat: [4] — yoqish, keyin mikrofonni o'chirish/yoqish; "bosib gapirish" rejimida — bosib turilganda gapiradi (barcha harf tugmalari band)
  { key: '5', codes: ['Digit5', 'Numpad5'], ok: (g) => !!(g.coop && g.coop.room && !(g.coop.voice.on && g.coop.voice.ptt)), bar: (g) => (g.coop.voice.on ? (g.coop.voice.mute ? 'Mikrofon 🔇' : 'Mikrofon 🎙') : null), run: (g) => g.coop.voice.key() },
  { key: '5', codes: ['Digit5', 'Numpad5'], ok: (g) => !!(g.coop && g.coop.room && g.coop.voice.on && g.coop.voice.ptt), hold: 1, bar: () => 'Gapirish 🎙' },
  { key: '8', codes: ['Digit8', 'Numpad8'], ok: (g) => !!(g.coop && g.coop.room), bar: () => 'Shu yerga kel 📍', run: (g) => g.coop.ping() }, // onlayn: do'stlarga xaritada belgi
  { key: 'N', codes: ['KeyN'], run: (g) => { const s = g.state.set; s.music = !s.music; g.audio.setMusic(s.music); g.toast(s.music ? 'Musiqa yoqildi' : "Musiqa o'chirildi"); } },
  // --- vaziyatga qarab ---
  { key: 'X', codes: ['KeyX'], ok: (g) => wrestling(g), bar: () => 'Taslim bo\'lish', run: (g) => g.kurash.quit() },
  { key: 'X', codes: ['KeyX'], ok: (g) => !!g.act && !wrestling(g), bar: () => 'Bekor qilish', run: (g) => g.endAct(false, 'cancel') },
  { key: 'X', codes: ['KeyX'], ok: (g) => !g.act && !!(g.ish && g.ish.cur), bar: () => 'Ishni tugatish', run: (g) => g.ish.quit() }, // non/taksi/dala ishi (ish.js)
  { key: 'X', codes: ['KeyX'], ok: (g) => !g.act && !(g.ish && g.ish.cur) && !!(g.coop && g.coop.job && !g.coop.job.own), bar: () => 'Ishdan chiqish', run: (g) => g.coop.jobLeave() }, // do'stning ishida (coop.js)
  { key: '⌫', codes: ['Backspace'], ok: (g) => !!(g.qulay && g.qulay.canRestart()), bar: () => 'Qayta boshlash', run: (g) => g.qulay.restart() }, // chellenjni darrov boshidan (qulay.js)
  { key: '9', codes: ['Digit9', 'Numpad9'], ok: (g) => !!g.yutuq, run: (g) => g.yutuq.open('ach') }, // yutuqlar daftari (yutuq.js)
  { key: '0', codes: ['Digit0', 'Numpad0'], ok: (g) => !!g.yutuq, run: (g) => g.yutuq.open('kun') }, // kunlik uchlik
  { key: 'T', codes: ['KeyT'], ok: (g) => g.damage.wrecked, bar: (g) => (g.player.onFoot ? null : 'Evakuator'), run: (g) => g.tow() },
  { key: 'E', codes: ['KeyE', 'Enter'], ok: (g) => !riding(g) && !wrestling(g), run: (g) => { // [E] — yaqindagi narsaga mos harakat (yozuvi pastdagi katta tugmada)
    const pt = g.nearPoint && !(g.nearPoint.kind === 'board' && g.player.onFoot && g.live.ctxD < 1.2) ? g.nearPoint : null, ui = g.ui; // yonidagi aniq harakat taxtadan ustun
    if (pt && g.player.lock <= 0) { if (pt.kind === 'board') { if (!g.act) ui.open('board', pt.place); } else if (pt.kind === 'garage') ui.open('garage', pt); else if (pt.kind === 'home') { if (g.player.onFoot && g.hayot) g.hayot.enterHome(); else ui.open('home'); } }
    else g.live.useE(); } },
  { key: 'F', codes: ['KeyF'], ok: (g) => !counting(g) && !riding(g) && !wrestling(g), bar: (g) => (g.player.onFoot ? (near(g) ? 'Transportga chiqish' : null) : 'Tushish'), run: (g) => { if (g.player.onFoot) g.live.tryMount(); else g.live.dismount(); } },
  { key: 'F', codes: ['KeyF'], ok: (g) => riding(g), bar: (g) => (g.suv && g.suv.cur ? (g.suv.cur.kind === 'glide' ? null : 'Qayiqdan tushish') : 'Tushish'), run: (g) => (g.suv && g.suv.cur ? g.suv.off() : g.coop.rideOff()) }, // do'st mashinasidan / qayiqdan tushish
  { key: 'E', codes: ['KeyE', 'Enter'], ok: (g) => !!(g.suv && g.suv.cur && g.suv.eText()), bar: (g) => g.suv.eText(), run: (g) => g.suv.useE() }, // qayiqdan baliq ovi (suv.js)
  // kurash davrasida — ekran tugmalari ham shu tugmalarni yuboradi (kurash.js o'zi o'qiydi)
  { key: 'A', codes: ['KeyA'], ok: wrestling, bar: () => '◀ Tortish', run: () => {} },
  { key: 'D', codes: ['KeyD'], ok: wrestling, bar: () => 'Tortish ▶', run: () => {} },
  { key: 'W', codes: ['KeyW'], ok: wrestling, bar: () => '▲ Itarish', run: () => {} },
  { key: 'S', codes: ['KeyS'], ok: wrestling, bar: () => '▼ Qaytarish', run: () => {} },
  { key: 'Probel', codes: ['Space'], ok: wrestling, bar: () => 'Otish!', run: () => {} },
  // --- piyoda ---
  { key: 'V', codes: ['KeyV'], on: 'foot', one: 1, ok: outdoor, bar: (g) => (near(g) ? null : 'Chaqirish'), run: (g) => g.live.doAction('whistle') },
  { key: 'Q', codes: ['KeyQ'], on: 'foot', one: 1, ok: outdoor, bar: () => "O't yulish", run: (g) => g.live.doAction('pull') },
  { key: 'G', codes: ['KeyG'], on: 'foot', one: 1, ok: outdoor, bar: (g) => (g.state.inv.seed > 0 ? `Gul ekish · ${g.state.inv.seed}` : null), run: (g) => g.live.doAction('plant') },
  { key: 'Y', codes: ['KeyY'], on: 'foot', one: 1, ok: free, bar: () => 'Yeyish', run: (g) => g.live.doAction('eat') },
  { key: 'K', codes: ['KeyK'], on: 'foot', one: 1, ok: outdoor, run: (g) => g.live.doAction('sapling') },
  { key: '1', codes: ['Digit1'], on: 'foot', one: 1, ok: free, run: (g) => g.live.doAction('dance') },
  { key: '2', codes: ['Digit2'], on: 'foot', one: 1, ok: free, run: (g) => g.live.doAction('dutor') },
  { key: '3', codes: ['Digit3'], on: 'foot', one: 1, ok: free, run: (g) => g.live.doAction('wave') },
  { key: 'B', codes: ['KeyB'], on: 'foot', bar: () => 'Harakatlar', run: (g) => g.ui.open('wheel') },
  { key: 'Shift', codes: ['ShiftLeft', 'ShiftRight'], on: 'foot', hold: 1, bar: (g) => (g.player.swim || g.player.sit ? null : 'Yugurish') }, // suzayotganda yugurish/sakrash ishlamaydi — tugmasi ham chiqmaydi
  { key: 'Probel', codes: ['Space'], on: 'foot', hold: 1, bar: (g) => (g.player.swim ? null : g.player.sit ? (g.hayot && g.hayot.seat ? null : 'Turish') : 'Sakrash') }, // skameykada — o'rnidan turish (mebeldan turish [E] bilan)
  { key: 'L', codes: ['KeyL'], on: 'foot', bar: (g) => (g.sky.night > 0.35 ? (g.player.lampOn ? "Fonarni o'chirish" : 'Fonar') : null),
    run: (g) => { const pl = g.player; pl.lampOn = !pl.lampOn; g.toast(pl.lampOn ? 'Fonar yoqildi 🔦' : "Fonar o'chirildi"); g.audio.sfx('click'); } },
  { key: 'Z', codes: ['KeyZ'], on: 'foot', hold: 1, bar: (g) => (g.ui && g.ui.hud && g.ui.hud.classList.contains('touch') && !g.player.swim && !(g.interior && g.interior.inside) ? 'Durbin' : null) }, // durbin — bosib turiladi; telefonda klaviatura yo'q — ekranda tugma bo'lib chiqadi
  // uy/do'kon ichida ishlamaydi (ichki makondan ko'chaga "teleport" bo'lib qolmasin); yo'l uzoq bo'lsa — jimgina hech narsa qilmaslik o'rniga sababini aytadi
  { key: 'R', codes: ['KeyR'], on: 'foot', ok: outdoor, run: (g) => { const pl = g.player, nr = T.nearestRoad(pl.p[0], pl.p[2], 12); if (nr.edge >= 0) { pl.place(T.roads.x[nr.i], T.roads.z[nr.i], pl.yaw); g.cam.snap(); g.toast("Yo'lga qaytdingiz"); } else g.toast("Yaqin atrofda yo'l topilmadi — xaritani oching [M]"); } },
  // --- transportda ---
  { key: 'Shift', codes: ['ShiftLeft', 'ShiftRight'], on: 'car', hold: 1, bar: () => 'Nitro' },
  { key: 'Probel', codes: ['Space'], on: 'car', hold: 1, bar: () => "Qo'l tormozi" },
  { key: 'R', codes: ['KeyR'], on: 'car', ok: (g) => !counting(g), bar: () => "Yo'lga qaytish", run: (g) => g.respawn() },
  { key: 'H', codes: ['KeyH'], on: 'car', bar: () => 'Signal', run: (g) => g.audio.sfx(g.carModel.id === 'otochar' ? 'siren' : g.carModel.id === 'velo' ? 'bell' : 'horn') },
  { key: 'L', codes: ['KeyL'], on: 'car', bar: (g) => (g.sky.night > 0.25 || g.lightsForced ? (g.lightsForced ? 'Faralar: avto' : 'Faralar') : null), run: (g) => { g.lightsForced = !g.lightsForced; g.toast(g.lightsForced ? 'Faralar yoqildi' : 'Faralar avtomatik'); } },
  { key: 'Esc', codes: ['Escape'], top: 1, bar: () => 'Menyu' }, // Escape — har qanday rejimda (pastda alohida)
];

const fits = (a, g) => (!a.on || ((a.on === 'foot') === g.player.onFoot && !(a.on === 'foot' && (riding(g) || wrestling(g))))) && (!a.ok || a.ok(g));
// Kadrdagi klaviatura (va ekran tugmalari) bosishlarini bajaradi
export function runKeys(g) {
  const inp = g.input, ui = g.ui;
  if (inp.hit('Escape')) { if (ui.screenName && ui.screenName !== 'menu' && ui.screenName !== 'result') ui.close(); else if (g.mode === 'play') ui.open('pause'); }
  if (g.mode !== 'play') return;
  let one = false;
  for (const a of ACTIONS) {
    if (!a.run || !inp.hit(...a.codes) || !fits(a, g)) continue;
    if (a.one) { if (one) continue; one = true; }
    a.run(g);
    if (g.mode !== 'play') break; // oyna ochildi — qolgan bosishlar oynaga tegishli emas
  }
  g.zoomView = g.player.onFoot && inp.down('KeyZ');
}
// Ekranda hozir ko'rinadigan tugmalar: [{ key, code, text, hold }]
export function barItems(g, top) {
  const out = [];
  for (const a of ACTIONS) {
    if (!a.bar || !!a.top !== !!top || !fits(a, g)) continue;
    const text = a.bar(g); if (text) out.push({ key: a.key, code: a.codes[0], text, hold: !!a.hold });
  }
  return out;
}
// Ekrandagi yozuvdagi tugma nomi ("E", "F", "T") → klaviatura kodi
export const codeOf = (key) => { const a = ACTIONS.find((q) => q.key === key); return a ? a.codes[0] : null; };
