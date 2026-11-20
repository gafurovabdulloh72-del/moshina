// Mashina mayda detallari sinovi: tushish joyi (o'rindiq tomoni, boshqa mashina, ko'prik sathi, joy band), piyoda va yo'l harakati, minish (sath, asbob), ovozlar,
// avariya chirog'i, qulf, salon kamerasi, traktor haydovchisi, tozalagich. Ishlatish: npm run test:mashina (avval npm run build). SHOTS=1 — skrinshotlar
export default async ({ page, shot }) => {
  const T = async (name, expr) => { let r; try { r = await page.evaluate(expr); } catch (e) { r = { ok: false, err: e.message }; } const ok = r && r.ok !== false; console.log(`TEST ${name} ${ok ? 'OK' : 'FAIL'}`, JSON.stringify(r).slice(0, 400)); return r; };
  const SH = !!process.env.SHOTS;
  await page.waitForFunction('window.__ready === true', null, { timeout: 120000 });
  // umumiy yordamchilar: yo'l nuqtasiga transport qo'yish, ovozlarni yozib olish
  await page.evaluate(() => { G.save = () => {}; window._road = (k) => { const T = G.T, i = Math.floor(T.roads.n * k); return [T.roads.x[i], T.roads.z[i], Math.atan2(T.roads.tx[i], T.roads.tz[i])]; };
    window._put = (id, k = 0.5) => { if (G.player.onFoot) G.live.mount(false); G.pickVehicle(id); const [x, z, y] = _road(k); G.car.place(x, z, y); G.prevP = G.car.p.slice(); G.sim(0.6); };
    window._snd = []; const s0 = G.audio.sfx.bind(G.audio); G.audio.sfx = (n, k) => { _snd.push(n); return s0(n, k); };
    window._loc = (x, z) => { const c = G.car, R = c.R, dx = x - c.p[0], dz = z - c.p[2]; return [dx * R[0] + dz * R[6], dx * R[2] + dz * R[8]]; }; });

  await T('animatsiya holati: sakrash, kuch va qarash yo\'nalishi rigga yetadi', `(()=>{ _put('jip'); G.live.dismount(true); G.sim(0.3); G.state.energy = 12; G.player.v[1] = 6; G.player.grounded = false; G.sim(0.05); const C = G.player.ctl;
    return { ok: C.grounded === false && C.vy > 0 && Math.abs(C.energy - G.state.energy) < 1 && C.camYaw != null, C: { g: C.grounded, vy: +C.vy.toFixed(2), e: +C.energy.toFixed(1) } }; })()`);

  await T("tushish: haydovchi tomonidan, o'rindiq qatorida", `(()=>{ _put('sedan'); _snd.length = 0; G.live.dismount(); const p = G.player.p, [lx, lz] = _loc(p[0], p[2]), o = G.carModel._rd;
    return { ok: G.player.onFoot && lx > 0.9 && Math.abs(lz - o.hip[2]) < 0.6 && _snd.includes('doorOut'), lx: +lx.toFixed(2), lz: +lz.toFixed(2), seat: o.hip[2], snd: _snd }; })()`);

  await T("tushish: avtobusdan — old eshikdan (o'ng tomon)", `(()=>{ _put('avtobus'); G.live.dismount(); const p = G.player.p, [lx, lz] = _loc(p[0], p[2]); return { ok: G.player.onFoot && lx < -1 && lz > 3, lx: +lx.toFixed(2), lz: +lz.toFixed(2) }; })()`);

  await T('tushish: eshik yonida boshqa mashina turgan bo\'lsa — ichiga emas', `(()=>{ _put('sedan', 0.3); const c = G.life.cars.find((q) => q.placed) || G.life.cars[0], bk = { x: c.x, z: c.z, yaw: c.yaw, placed: c.placed, y: c.y };
    const R = G.car.R, s = G.car.spec, sz = G.carModel._rd.hip[2]; c.placed = true; c.x = G.car.p[0] + R[0] * (s.wid / 2 + 1.6) + R[2] * sz; c.z = G.car.p[2] + R[6] * (s.wid / 2 + 1.6) + R[8] * sz; c.yaw = G.car.yaw; c.y = G.car.p[1];
    G.live.dismount(true); const p = G.player.p, fx = Math.sin(c.yaw), fz = Math.cos(c.yaw), dx = p[0] - c.x, dz = p[2] - c.z, inside = Math.abs(dx * fz - dz * fx) < c.halfW + 0.2 && Math.abs(dx * fx + dz * fz) < c.half + 0.2;
    // piyoda unga qarab yursa ham ichiga kirmaydi
    G.player.place(c.x + Math.cos(c.yaw) * (c.halfW + 1.5), c.z - Math.sin(c.yaw) * (c.halfW + 1.5), c.yaw - Math.PI / 2); for (let i = 0; i < 90; i++) { G.player.v[0] = -Math.cos(c.yaw) * 4; G.player.v[2] = Math.sin(c.yaw) * 4; G.player.update(1 / 60, null, 0, G.state); }
    const q = G.player.p, ex = q[0] - c.x, ez = q[2] - c.z, lat = Math.abs(ex * fz - ez * fx); Object.assign(c, bk);
    return { ok: !inside && lat > c.halfW, inside, lat: +lat.toFixed(2), halfW: c.halfW }; })()`);

  await T("tushish: joy band bo'lsa ruxsat yo'q (majburiy — baribir)", `(()=>{ _put('jip'); const pl = G.player, f0 = pl.exitSpot; pl.exitSpot = function (...a) { const r = f0.apply(this, a); this.exitOk = false; return r; };
    G.live.dismount(); const a = pl.onFoot; G.live.dismount(true); const b = pl.onFoot; pl.exitSpot = f0; return { ok: !a && b, a, b }; })()`);

  await T("tushish: ko'prik ostida — ko'prik ustiga emas, yerga", `(()=>{ const T = G.T; let bi = -1; for (let i = 0; i < T.roads.n; i++) if (T.roads.bridge[i] && T.roads.y[i] - T.gridHeight(T.roads.x[i], T.roads.z[i]) > 4) { bi = i; break; } if (bi < 0) return { ok: true, skip: 1 };
    _put('jip'); const x = T.roads.x[bi], z = T.roads.z[bi], gy = T.gridHeight(x, z); G.car.p[0] = x; G.car.p[2] = z; G.car.p[1] = gy + G.car.spec.com; const [, , y] = G.player.exitSpot(G.car, 0, 1);
    return { ok: Math.abs(y - gy) < 1.5, y: +y.toFixed(2), ground: +gy.toFixed(2), bridge: +T.roads.y[bi].toFixed(2) }; })()`);

  await T("minish: boshqa sathdagi transportga chiqib bo'lmaydi, asbob qo'ldan olinadi", `(()=>{ _put('jip'); G.live.dismount(true); const pl = G.player; pl.p[1] -= 6; G.live.tryMount(); const a = pl.onFoot; pl.p[1] += 6;
    G.THREE && pl.setEmote('play', 'dutor'); const t0 = pl.rig.toolName; G.live.tryMount(); const b = !pl.onFoot; G.live.dismount(true); return { ok: a && b && t0 === 'dutor' && !pl.rig.toolName, a, b, t0, t1: pl.rig.toolName }; })()`);

  await T('ovoz: eshikli — eshik + starter, velosiped/mototsikl — egar', `(()=>{ const r = {}; for (const id of ['sedan', 'velo', 'moto']) { _put(id); G.live.dismount(true); _snd.length = 0; G.live.mount(); r[id] = _snd.slice(); }
    return { ok: r.sedan.includes('doorIn') && r.sedan.includes('starter') && r.velo.includes('saddle') && !r.velo.includes('starter') && r.moto.includes('saddle') && !r.moto.includes('doorIn'), r }; })()`);
  for (const [id, want] of [['sedan', 'horn'], ['moto', 'beep'], ['yuk', 'airhorn'], ['velo', 'bell'], ['otochar', 'siren']]) {
    await page.evaluate((id) => { _put(id); _snd.length = 0; }, id); await page.keyboard.press('KeyH');
    await T(`signal: ${id} — ${want}`, `(()=>{ G.sim(0.02); return { ok: _snd.includes('${want}'), snd: _snd }; })()`);
  }
  await page.evaluate(() => { _put('sedan'); G.hazard = false; }); await page.keyboard.press('KeyZ');
  await T("avariya chirog'i: [Z] ikkala chiroqni miltillatadi", `(()=>{ G.sim(0.02); const m = G.carModel; let on = 0; for (let i = 0; i < 12; i++) { G.advance(0.03); if (m.sigLMat.color.r > 2 && m.sigRMat.color.r > 2) on++; } const r = { ok: G.hazard && on > 2, on }; G.hazard = false; return r; })()`);
  if (SH) { await page.evaluate(() => { G.hazard = true; G.cam.mode = 1; G.cam.snap(); G.cam.yawOff = 2.6; G.time = 0.05; G.advance(0.02); }); await shot('m_hazard'); await page.evaluate(() => { G.hazard = false; G.cam.mode = 0; }); }

  await T('qulf: uzoqlashganda qulflanadi, o\'tirganda ochiladi', `(()=>{ _put('sedan'); G.live.dismount(); _snd.length = 0; const pl = G.player, a0 = G.live.locked; pl.place(pl.p[0] + Math.sin(G.car.yaw) * 12, pl.p[2] + Math.cos(G.car.yaw) * 12, 0); G.sim(0.1);
    const a1 = G.live.locked, bl = G.lockBlink > G.time; G.player.place(G.car.p[0] + 2, G.car.p[2], 0); G.live.tryMount(); return { ok: !a0 && a1 && bl && !G.live.locked && _snd.includes('lock') && _snd.includes('unlock'), a0, a1, bl, snd: _snd }; })()`);

  await T("salon kamerasi: sedanda haydovchi ko'zidan, mototsiklda yo'q", `(()=>{ _put('sedan'); G.cam.mode = 4; G.cam.snap(); G.advance(0.05); const c = G.camera.position, [lx, lz] = _loc(c.x, c.z), s = G.car.spec, inCar = Math.abs(lx) < s.wid / 2 && Math.abs(lz) < s.len / 2;
    const hid = !G.carModel.rider.visible, near = G.camera.near; _put('moto'); G.advance(0.05); const m2 = G.cam.mode; G.cam.mode = 0;
    return { ok: inCar && lx > 0.1 && hid && near < 0.2 && m2 === 0, lx: +lx.toFixed(2), lz: +lz.toFixed(2), hid, near, m2 }; })()`);
  if (SH) { await page.evaluate(() => { _put('sedan'); G.cam.mode = 4; G.cam.snap(); G.advance(0.05); }); await shot('m_salon'); await page.evaluate(() => { G.cam.mode = 0; }); }

  await T('traktor: tushgandan keyin kabinada haydovchi qolmaydi', `(()=>{ _put('traktor'); const a = G.carModel.rider.visible; G.live.dismount(true); G.advance(0.02); const b = G.carModel.rider.visible; G.live.mount(); return { ok: a && !b, a, b }; })()`);

  await T("tozalagich: oynasiz transportda (karting) chiqmaydi", `(()=>{ G.dunyo.set('yomgir'); const w = document.getElementById('wiper'); _put('kart'); G.cam.mode = 2; G.advance(0.1); const a = w.style.display; _put('sedan'); G.cam.mode = 2; G.advance(0.1); const b = w.style.display; G.cam.mode = 0; G.dunyo.set(null); G.advance(0.05);
    return { ok: a === 'none' && b === 'block', a, b }; })()`);
};
