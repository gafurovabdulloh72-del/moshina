// Tryuklar va kombo, dvigatel ovozlari, poyga doirasi, transport medallari, kuboklar, «Sovrinlar» oynasi va javoni, saqlov
// Ishlatish: npm run test:tryuk  (avval npm run build). SHOTS=1 — skrinshotlar ham olinadi
const R = (name, ok, info) => console.log(`TEST ${name} ${ok ? 'OK' : 'FAIL'} ${info == null ? '' : typeof info === 'string' ? info : JSON.stringify(info)}`);
export default async ({ page, shot }) => {
  const ready = () => page.waitForFunction('window.__ready === true', null, { timeout: 120000 });
  await ready();
  await page.evaluate(() => { localStorage.removeItem('safar_save_v2'); window.onbeforeunload = null; });
  await page.reload(); await ready();
  const E = (f, a) => page.evaluate(f, a);

  // 1) har transport sinfining o'z dvigatel ovozi
  const eng = await E(() => { G.audio.init(); G.audio.setMusic(true, 0.5); const ids = ['velo', 'skuter', 'moto', 'kart', 'kvadro', 'traktor', 'yuk', 'avtobus', 'muskul', 'sedan', 'ralli', 'kupe', 'bolid', 'jip'], o = {};
    for (const id of ids) { G.pickVehicle(id); G.sim(0.05); const A = G.audio; o[id] = { n: A.engName, w: [A.o1.type, A.o2.type, A.o3.type].join('/'), q: +A.engF.Q.value.toFixed(2), ld: +A.lg.gain.value.toFixed(2), r: A.eng.r.join(','), lp: A.eng.lp[0] }; }
    G.pickVehicle('jip'); G.sim(0.05); return o; });
  const sig = (id) => JSON.stringify([eng[id].w, eng[id].q, eng[id].ld, eng[id].r, eng[id].lp]);
  const names = new Set(Object.values(eng).map((x) => x.n)), sigs = new Set(Object.keys(eng).map(sig));
  R('engine-classes', names.size >= 10 && sigs.size >= 10 && sig('traktor') !== sig('bolid') && sig('skuter') !== sig('avtobus') && sig('moto') !== sig('sedan') && eng.yuk.n === eng.traktor.n, { names: names.size, sigs: sigs.size, traktor: eng.traktor, bolid: eng.bolid, skuter: eng.skuter, avtobus: eng.avtobus });

  // 2) sun'iy tryuklar: salto, gir, kombo ko'paytuvchisi, ag'darilganda kombo kuyishi
  const t1 = await E(() => { const K = G.tryuk, T = Math.PI * 2; const a = K._air(T * 1.02, 0, 0, 1.6); const b = K._air(0, 0.1, T * 1.0, 1.4); const c = K._air(-T * 2, 0, 0.2, 2.2);
    const before = { n: K.combo.n, bank: K.combo.bank }; const d = K._air(T, 0, 0, 1.5, false, "Ag'darildingiz"); return { a: a.last, b: b.last, c: c.last, before, after: { n: K.combo.n, bank: K.combo.bank }, burn: K.lastBurn, pop: K.lastPopup, best: G.state.sovrin.best }; });
  R('trick-salto', t1.a.tricks[0].id === 'salto' && t1.a.mult === 1 && t1.a.gain === t1.a.pts, t1.a);
  R('trick-spin-combo', t1.b.tricks.some((x) => x.id === 'spin' && x.n === 360) && t1.b.mult === 2 && t1.b.gain === t1.b.pts * 2, t1.b);
  R('trick-double-back', t1.c.tricks[0].id === 'osalto' && t1.c.tricks[0].n === 2 && t1.c.mult === 3, t1.c.tricks);
  R('combo-burn', t1.before.n === 3 && t1.after.n === 0 && t1.after.bank === 0 && t1.burn.had && t1.pop.kind === 'bad', { before: t1.before, burn: t1.burn, pop: t1.pop });
  // kombo vaqti tugasa — pulga aylanadi, eng yaxshi kombo yoziladi
  const t2 = await E(() => { const K = G.tryuk, T = Math.PI * 2, m0 = G.state.money; K._air(T, 0, 0, 1.4); K._air(0, T, 0, 1.4); G.sim(1); const mid = K.combo.n; G.sim(4.5); return { mid, n: K.combo.n, gain: G.state.money - m0, pay: K.lastPay, best: G.state.sovrin.best, tricks: G.state.sovrin.tricks, tlog: G.state.sovrin.tlog }; });
  R('combo-payout', t2.mid === 2 && t2.n === 0 && t2.gain > 0 && t2.gain <= 600 && t2.pay.n === 2 && t2.best.n >= 2 && t2.tlog.roll === 1, t2);
  // haqiqiy fizika: havoda gir aylanish (jism o'zi aylanadi, qo'nish tekis) va salto aylanishining o'lchanishi
  const t3 = await E(() => { const K = G.tryuk, c = G.car, h = G.site.places.uy.home; G.teleport(h.park[0], h.park[1] + 40, 0); G.sim(1); K.combo.n = 0; K.lastTrick = null;
    c.p[1] += 26; c.v[0] = c.v[1] = c.v[2] = 0; const U = [c.R[1], c.R[4], c.R[7]], w = 5.5; c.w[0] = U[0] * w; c.w[1] = U[1] * w; c.w[2] = U[2] * w;
    let maxY = 0, t = 0; while (t < 6) { G.sim(1 / 60); t += 1 / 60; maxY = Math.max(maxY, Math.abs(K.air.y)); if (K.lastTrick) break; } const spin = { trick: K.lastTrick && K.lastTrick.tricks.map((x) => x.name).join('+'), maxDeg: Math.round(maxY * 57.3), up: +c.R[4].toFixed(2) };
    G.sim(5); c.p[1] += 30; c.v[0] = c.v[1] = c.v[2] = 0; const L = [c.R[0], c.R[3], c.R[6]], wf = 8; c.w[0] = L[0] * wf; c.w[1] = L[1] * wf; c.w[2] = L[2] * wf; let maxP = 0; t = 0;
    while (t < 2.2) { G.sim(1 / 60); t += 1 / 60; maxP = Math.max(maxP, Math.abs(K.air.p)); } G.sim(4); return { spin, flipDeg: Math.round(maxP * 57.3) }; });
  R('physics-spin', /Gir (180|360|540)/.test(t3.spin.trick || '') && t3.spin.up > 0.8, t3.spin);
  R('physics-flip-measured', t3.flipDeg >= 270, t3);
  // havoda boshqaruv: havoda bosilgan W — salto va toza qo'nish; uchishdan oldin bosib turilgan gaz ag'darmaydi
  const t4 = await E(() => { const K = G.tryuk, c = G.car, h = G.site.places.uy.home, run = (key, hold, dur) => { if (G.player.onFoot) G.live.mount(true); G.pickVehicle('jip'); G.teleport(h.park[0], h.park[1] + 40, 0); G.sim(1); K.combo.n = 0; const tr0 = K.lastTrick;
      if (hold) G.input.keys.add(key); c.p[1] += 14; c.v[0] = c.v[2] = 0; c.v[1] = 7; G.sim(0.4); G.input.keys.add(key); let t = 0, mx = 0; while (t < 5) { G.sim(1 / 60); t += 1 / 60; if (t > dur) G.input.keys.delete(key); if (K.air.on) mx = Math.max(mx, Math.abs(K.air.p)); if (c.onGround >= 2 && t > 0.5) break; } G.input.keys.clear(); G.sim(5);
      return { trick: K.lastTrick !== tr0 && K.lastTrick ? K.lastTrick.tricks.map((x) => x.id).join('+') : null, deg: Math.round(mx * 57.3), up: +c.R[4].toFixed(2) }; };
    return { w: run('KeyW', false, 1.1), s: run('KeyS', false, 1.1), held: run('KeyW', true, 3) }; });
  R('air-control-salto', t4.w.trick === 'salto' && t4.s.trick === 'osalto', t4);
  R('held-throttle-no-flip', !t4.held.trick && t4.held.deg < 90 && t4.held.up > 0.8, t4.held);

  // 3) transport medallari: bir xil natija — avtobusda yuqoriroq medal (og'ir toifa me'yori)
  const m1 = await E(() => { const K = G.tryuk, a = G.acts.acts.find((q) => q.cat === 'race' && !(q.opt && q.opt.final)); G.raceInfo(a); const t = +(a._t[2] * 1.12).toFixed(2), m0 = G.state.money;
    const rj = K.record(a, t, 'jip'), rb = K.record(a, t, 'avtobus'), rbo = K.record(a, t, 'bolid'); const again = K.record(a, t + 5, 'avtobus');
    return { id: a.id, t, thr: a._t.map((v) => +v.toFixed(1)), jip: rj.m, bus: rb.m, bolid: rbo.m, fac: { jip: K.vehFactor('jip'), bus: K.vehFactor('avtobus'), bolid: K.vehFactor('bolid'), velo: K.vehFactor('velo') }, cls: K.vehClass('avtobus'), keep: G.state.sovrin.rec[a.id].avtobus, againPay: again.pay, paid: G.state.money - m0 }; });
  R('medal-per-vehicle', m1.bus > m1.jip && m1.jip > m1.bolid && m1.keep[0] === m1.t && m1.keep[1] === m1.bus && m1.againPay === 0 && m1.paid > 0, m1);

  // 4) poyga: doira chalinadi, 1-o'rin — kubok, natija oynasida medal va kubok qatori
  const d1 = await E(() => { const a = G.acts.acts.find((q) => q.cat === 'race' && !(q.opt && q.opt.final)); G.pickVehicle('sedan'); G.startAct(a); G.sim(0.4); return { k: G.audio.raceK, on: G.audio.doira && G.audio.doira.on, hits: G.audio.doira ? G.audio.doira.hits : 0, state: G.act && G.act.state }; });
  await page.waitForTimeout(700);
  const d2 = await E(() => { G.sim(3.2); return { k: G.audio.raceK, on: G.audio.doira.on, hits: G.audio.doira.hits, state: G.act && G.act.state }; });
  R('doira-start', d1.on && d1.k > 0 && d2.on && d2.hits > d1.hits && d2.state === 'run', { d1, d2 });
  const kLast = await E(() => { const A = G.act; A.place = 1; A.cpi = A.cps.length - 1; G.sim(0.05); return G.audio.raceK; });
  R('doira-final-gate', kLast === 1, kLast);
  if (process.env.SHOTS) { await E(() => { G.cam.snap(); G.advance(0.05); }); await shot('tryuk_race'); }
  const r1 = await E(() => { const A = G.act, a = A.def, m0 = G.state.money; A.cpi = A.cps.length; A.t = +(a._t[2] * 0.95).toFixed(2); G.endAct(true, 'done', 3, `Vaqt: 1:00.0 · 1-o'rin`); const res = document.querySelector('.tk-res'); const out = { cups: G.state.sovrin.cups[a.id], cupTotal: G.tryuk.cupTotal(), res: res && res.textContent, rec: G.state.sovrin.rec[a.id].sedan, last: G.tryuk.lastCup, money: G.state.money - m0 }; G.sim(0.1); out.doiraOff = !G.audio.doira.on && G.audio.raceK === 0; return out; });
  R('cup-recorded', r1.cups === 1 && r1.last.first && /kubogi/.test(r1.res || '') && /medal/.test(r1.res || '') && r1.rec[1] >= 1 && r1.money >= 300, r1);
  R('doira-stop', r1.doiraOff, r1.doiraOff);
  const d3 = await E(() => { G.audio.setMusic(false); const a = G.acts.acts.find((q) => q.cat === 'race'); G.startAct(a); G.sim(0.4); const off = !G.audio.doira.on; G.endAct(false, 'cancel'); G.audio.setMusic(true); return off; });
  R('doira-music-off', d3, d3);
  // 15 ta poygada g'olib — «Chempion» bo'yog'i
  const ch = await E(() => { const K = G.tryuk, rs = G.acts.acts.filter((q) => q.cat === 'race'); for (const a of rs.slice(0, 13)) K.cup(a); const before = G.state.paints.includes('chempion'); K.cup(rs[0]); return { total: K.cupTotal(), races: K.cupRaces(), before, paint: G.state.paints.includes('chempion') }; });
  R('champion-paint', ch.total >= 15 && !ch.before && ch.paint, ch);

  // 5) «Sovrinlar» oynasi (pauza menyusi va telefon)
  const s1 = await E(() => { G.ui.open('pause'); const b = [...document.querySelectorAll('#screen button, .win button')].find((x) => /Sovrinlar/.test(x.textContent)); b && b.click(); const w = document.querySelector('.win'); const o = { name: G.ui.screenName, cups: w && w.querySelectorAll('.sv-cup.on').length, txt: w && /Tryuklar daftari/.test(w.textContent) };
    const vb = w && w.querySelector('[data-a="veh:avtobus"]'); vb && vb.click(); const w2 = document.querySelector('.win'); o.busRows = w2 && w2.querySelectorAll('.sv-tab tr').length; o.busCls = w2 && /Og'ir toifa/.test(w2.textContent); return o; });
  R('screen-sovrin', s1.name === 'sovrin' && s1.cups >= 13 && s1.txt && s1.busRows >= 2 && s1.busCls, s1);
  if (process.env.SHOTS) await shot('tryuk_sovrin');
  const s2 = await E(() => { G.ui.close(); G.ui.open('telefon'); const app = document.querySelector('[data-sovrin]'); const has = !!app; app && app.click(); return { has, name: G.ui.screenName }; });
  R('phone-app', s2.has && s2.name === 'sovrin', s2);
  await E(() => G.ui.close());

  // 6) javon to'ladi; saqlov qayta yuklanganda qoladi
  const sh = await E(() => { const K = G.tryuk; G.state.sovrin.best.n = Math.max(4, G.state.sovrin.best.n); return { on: K.refreshShelf(), vis: K.shelf.visible, kids: K.shelf.children.length }; });
  R('shelf', sh.on >= 8 && sh.vis && sh.kids === 4, sh);
  const before = await E(() => { G.save(); const s = G.state.sovrin; return JSON.stringify({ cups: s.cups, rec: s.rec, best: s.best, tricks: s.tricks, tlog: s.tlog, paint: G.state.paints.includes('chempion') }); });
  await E(() => { window.onbeforeunload = null; G.save = () => {}; });
  await page.reload(); await ready();
  const after = await E(() => { G.sim(0.2); const s = G.state.sovrin; return { j: JSON.stringify({ cups: s.cups, rec: s.rec, best: s.best, tricks: s.tricks, tlog: s.tlog, paint: G.state.paints.includes('chempion') }), shelf: G.tryuk.refreshShelf() }; });
  R('save-reload', after.j === before && after.shelf >= 8, { same: after.j === before, shelf: after.shelf });
  // eski saqlov (sovrin maydonisiz) ochiladi
  await E(() => { G.save = () => {}; const s = JSON.parse(localStorage.getItem('safar_save_v2')); delete s.sovrin; localStorage.setItem('safar_save_v2', JSON.stringify(s)); });
  await page.reload(); await ready();
  const old = await E(() => { G.sim(0.2); const s = G.state.sovrin; return { ok: !!s && typeof s.rec === 'object' && s.best.n === 0 && s.tricks === 0 }; });
  R('old-save', old.ok, old);

  if (process.env.SHOTS) {
    // javon (uy hovlisida)
    await E(() => { const K = G.tryuk, s = G.state.sovrin, rs = G.acts.acts.filter((q) => q.cat === 'race'); for (const a of rs.slice(0, 6)) K.cup(a); s.rec.x = { jip: [1, 3], sedan: [1, 2], moto: [1, 1] }; s.best.n = 5; G.state.home.lvl = 2; G.site.places.uy.home.setLevel(2); K.refreshShelf();
      const p = K.shelfAt(), fx = Math.sin(p.yaw), fz = Math.cos(p.yaw); G.view(p.x + fx * 4.2 + fz * 1.2, p.y + 2.1, p.z + fz * 4.2 - fx * 1.2, p.x, p.y + 1.15, p.z, 11); });
    await shot('tryuk_shelf');
    // havodagi tryuk yozuvi va kombo (o'yin ichidan)
    await E(() => { const K = G.tryuk, T = Math.PI * 2, h = G.site.places.uy.home; G.teleport(h.park[0], h.park[1] + 40, 0.6, 13); G.sim(0.5); const st = document.createElement('style'); st.textContent = '#tryuk.on{animation-delay:-0.45s!important;animation-play-state:paused!important}'; document.head.appendChild(st); K._air(T, 0, 0, 1.5); K._air(0, 0, T, 1.2); const c = G.car; c.p[1] += 7; c.v[1] = 2; const L = [c.R[0], c.R[3], c.R[6]]; c.w[0] = L[0] * 6; c.w[1] = L[1] * 6; c.w[2] = L[2] * 6; G.advance(0.55); });
    await shot('tryuk_air');
  }
};
