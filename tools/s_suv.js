// Suv va havo sinovi (suv.js, qayiq.js, deltaplan.js): eshkakli qayiq suzadi va quruqlikka chiqmaydi, tushish (qirg'oqqa), yelkanli qayiq tezligi shamol burchagiga bog'liq,
// Cho'qqidan deltaplan asta pastlaydi va NaN'siz qo'nadi (mukofot), havoda tushib bo'lmaydi, HUD shamol o'qi, qayiqdan baliq ovi, saqlovda o'tirgan joy. SHOTS=0 — skrinshotsiz
export default async ({ page, shot: shot0 }) => {
  const shots = process.env.SHOTS !== '0';
  const shot = async (n) => { if (!shots) return; for (let k = 0; ; k++) { try { return await shot0(n); } catch (e) { if (k >= 3) throw e; console.log('skrinshot sekin, qayta:', n); } } };
  await page.waitForFunction('window.__ready === true', null, { timeout: 120000 });
  const ev = (js) => page.evaluate(js), T_ = (n, ok, info) => console.log('TEST suv', n, ok ? 'OK' : 'FAIL', JSON.stringify(info));
  await ev(`window.press = (c) => { G.input.pressed.add(c); G.advance(1 / 60); }; window.S = G.suv; window.fin = (a) => a.every((v) => Number.isFinite(v)); G.state.money = 5000; G.live.dismount(true); G.hour = 11; G.freezeTime = true; G.sim(0.2); 1`);

  // 1. eshkakli qayiq: iskaladan [E] — ijara (60 so'm), W bilan suzadi, suvda turadi
  let r = await ev(`(() => { const b = G.boat; G.player.place(b.x + Math.cos(b.yaw) * 3.4, b.z - Math.sin(b.yaw) * 3.4, b.yaw); G.sim(0.4);
    const pr = G.live.prompt, m0 = G.state.money; press('KeyE'); const on = S.cur === b, paid = m0 - G.state.money; const x0 = b.x, z0 = b.z;
    S.auto = [1, 0]; G.sim(12); const d = Math.hypot(b.x - x0, b.z - z0), v = b.v; S.auto = null; G.sim(0.2);
    return { pr, on, paid, d: +d.toFixed(1), v: +v.toFixed(2), y: +G.player.p[1].toFixed(2), wy: b.wy, depth: +G.T.waterY(b.x, b.z).toFixed(2) - +G.T.gridHeight(b.x, b.z).toFixed(2), riding: !!G.suv.cur, foot: G.player.onFoot, bar: [...document.querySelectorAll('#h-bar kbd')].map((k) => k.textContent).join('') }; })()`);
  T_('row-move', /ijarasi/.test(r.pr) && r.on && r.paid === 60 && r.d > 18 && r.v > 2.4 && r.v < 4.5 && r.depth > 0.3 && Math.abs(r.y - r.wy - 0.3) < 0.01 && !/Q|G|V/.test(r.bar), r);
  await ev(`(() => { S.auto = [1, 0.3]; G.sim(1.5); S.auto = [0.8, 0.3]; G.advance(0.4); })()`); await shot('suv_row');
  await ev(`(() => { const b = G.boat, c = Math.cos(b.yaw), s = Math.sin(b.yaw); G.view(b.x - s * 5 + c * 6, b.wy + 2.6, b.z - c * 5 - s * 6, b.x, b.wy + 0.6, b.z); })()`); await shot('suv_row_close');

  // 2. qirg'oqqa qarab 70 s eshkak eshsa ham quruqlikka chiqmaydi; tushganda — quruqlikda turadi
  r = await ev(`(() => { const b = G.boat, T = G.T; let best = null; // eng yaqin haqiqiy qirg'oq (iskala/to'siqsiz yo'nalish)
    for (let a = 0; a < 6.28; a += 0.1) for (let r = 2; r < 300; r += 2) { const x = b.x + Math.sin(a) * r, z = b.z + Math.cos(a) * r, raw = T.waterY(x, z) - T.gridHeight(x, z); if (raw < 0) { if (!best || r < best.r) best = { a, r }; break; } if (S.depthAt(x, z, b.extra) < 0) break; }
    b.yaw = best.a; const P = { x: b.x + Math.sin(best.a) * best.r, z: b.z + Math.cos(best.a) * best.r }; S.auto = [1, 0]; let minD = 99, nan = false;
    for (let i = 0; i < 70; i++) { G.sim(1); const d = G.T.waterY(b.x, b.z) - G.T.gridHeight(b.x, b.z); minD = Math.min(minD, d); if (!fin([b.x, b.z, b.v])) nan = true; }
    S.auto = null; const v = Math.abs(b.v), beach = b.beach, toLand = Math.hypot(P.x - b.x, P.z - b.z); press('KeyF'); G.sim(0.5); const p = G.player.p;
    return { minD: +minD.toFixed(2), v: +v.toFixed(2), beach, toLand: +toLand.toFixed(0), off: !S.cur, foot: G.player.onFoot, py: +p[1].toFixed(2), swim: G.player.swim, gy: +G.T.ground(p[0], p[2], 1e9).y.toFixed(2), nan }; })()`);
  T_('row-shore', r.minD > 0.15 && r.v < 0.3 && r.off && r.foot && !r.swim && r.gy > 0.05 && !r.nan, r);
  await ev(`G.sim(0.5); G.advance(0.2)`); await shot('suv_row_beach');
  // qayiq shu yerda kutadi — qayta o'tirish bepul; 350 m dan uzoqlashsa — iskalaga qaytadi
  r = await ev(`(() => { const b = G.boat; G.player.place(b.x + 2.5, b.z, 0); G.sim(0.3); const pr = G.live.prompt, m0 = G.state.money; const ok = S.enter(b); const paid = m0 - G.state.money; S.off(); G.sim(0.2);
    G.player.place(b.home[0] + 600, b.home[1], 0); G.sim(0.5); const back = b.x === b.home[0] && b.z === b.home[1] && !b.paid; return { pr, ok, paid, back }; })()`);
  T_('row-rent', /qayiqqa o'tirish/.test(r.pr) && r.ok && r.paid === 0 && r.back, r);

  // 3. qayiqdan baliq ovi (qarmoq bilan)
  r = await ev(`(() => { const b = G.boat; G.state.tools.rod = 1; S.enter(b, true); b.x = b.home[0]; b.z = b.home[1]; G.sim(0.3); const t0 = S.eText(); press('KeyE'); let got = 0; const f0 = (G.state.inv.fish || 0) + (G.state.inv.bigfish || 0) + (G.state.inv.gem || 0);
    for (let i = 0; i < 600 && !got; i++) { G.sim(0.05); if (S.fish && S.fish.ph === 1) { press('KeyE'); got = 1; } }
    const f1 = (G.state.inv.fish || 0) + (G.state.inv.bigfish || 0) + (G.state.inv.gem || 0); S.off(); return { t0, got, caught: f1 - f0, cnt: G.state.suv.fish }; })()`);
  T_('boat-fish', r.t0 === 'Qarmoq tashlash' && r.got && r.caught === 1 && r.cnt >= 1, r);

  // 4. yelkanli qayiq: tezlik shamol burchagiga bog'liq (yon shamol > orqa shamol > shamolga qarshi ≈ 0)
  r = await ev(`(() => { const b = G.sailboat, P = G.T.placeBy.bandargoh, a = Math.atan2(P.x, P.z); let x0 = b.home[0] + Math.sin(a) * 500, z0 = b.home[1] + Math.cos(a) * 500;
    const depth = G.T.waterY(x0, z0) - G.T.gridHeight(x0, z0); S.windSet(0, 7); // shamol +z tomonga esadi (−z dan keladi)
    const run = (yaw) => { if (S.cur) S.off(); b.x = x0; b.z = z0; b.yaw = yaw; b.v = 0; b.sail = 0.6; S.enter(b, true); S.auto = [1, 0]; G.sim(30); const v = b.v; S.auto = null; return +v.toFixed(2); };
    const beam = run(Math.PI / 2), up = run(Math.PI), run2 = run(0), close = run(Math.PI - 1.0);
    return { depth: +depth.toFixed(1), beam, up, run: run2, close, eff: +b.eff.toFixed(2) }; })()`);
  T_('sail-wind', r.depth > 5 && r.beam > 6 && r.up < 0.6 && r.run > 2.5 && r.run < r.beam && r.close > 2 && r.close < r.beam, r);
  // tack: shamolga qarshi burilib o'tish — tezlik saqlanib, boshqa bortga o'tadi
  r = await ev(`(() => { const b = G.sailboat, ad = (x) => { let d = (x - Math.PI) % (2 * Math.PI); if (d > Math.PI) d -= 2 * Math.PI; if (d < -Math.PI) d += 2 * Math.PI; return d; };
    b.yaw = Math.PI - 1.05; b.v = 6; S.auto = [1, 1]; let minV = 99, t = 0; while (t < 14) { G.sim(0.25); t += 0.25; minV = Math.min(minV, b.v); if (ad(b.yaw) > 0.95) break; }
    const yaw = ad(b.yaw); S.auto = [1, 0]; G.sim(15); const v = b.v; S.auto = null; return { t, yaw: +yaw.toFixed(2), minV: +minV.toFixed(2), v: +v.toFixed(2), boom: +b.boom.toFixed(2) }; })()`);
  T_('sail-tack', r.t < 12 && r.minV > 0.8 && r.v > 3, r);
  r = await ev(`(() => { const b = G.sailboat; b.yaw = Math.PI / 2 + 0.3; S.auto = [1, 0]; G.sim(6); S.auto = [1, 0]; G.advance(0.2); const h = document.getElementById('suv-hud'), arr = document.getElementById('suv-arr'); return { vis: h && getComputedStyle(h).display !== 'none', txt: h && h.textContent, rot: arr && arr.getAttribute('transform') }; })()`);
  T_('sail-hud', r.vis && /shamol/.test(r.txt) && /yelkan/.test(r.txt) && /rotate/.test(r.rot), r);
  await shot('suv_sail');
  await ev(`(() => { const b = G.sailboat, c = Math.cos(b.yaw), s = Math.sin(b.yaw); G.view(b.x + c * 12 + s * 4, b.wy + 3.5, b.z - s * 12 + c * 4, b.x, b.wy + 2.6, b.z); })()`); await shot('suv_sail_close');
  await ev(`(() => { S.auto = null; S.off(); S.windSet(null); G.sim(0.3); })()`);

  // 5. deltaplan: Cho'qqidagi ijara joyida [E] — 150 so'm, asta pastlaydi, havoda [F] ishlamaydi, NaN'siz qo'nadi va mukofot
  r = await ev(`(() => { const k = G.glider.kiosk; G.player.place(k[0] + 2.2, k[1] + 1.2, 0); G.sim(0.4); const pr = G.live.prompt, m0 = G.state.money; press('KeyE'); const on = S.cur === G.glider, paid = m0 - G.state.money, gl = G.glider, y0 = gl.y, x0 = gl.x, z0 = gl.z;
    S.windSet(1.0, 1); S.auto = [0, 0]; G.sim(20); const dy = gl.y - y0, dx = Math.hypot(gl.x - x0, gl.z - z0), agl = gl.y - G.T.ground(gl.x, gl.z, gl.y).y; press('KeyF'); const still = S.cur === gl;
    return { pr, on, paid, dy: +dy.toFixed(1), dx: +dx.toFixed(0), agl: +agl.toFixed(0), still, v: +gl.v.toFixed(1), fin: fin([gl.x, gl.y, gl.z, gl.v, gl.vy]) }; })()`);
  T_('glide-launch', /Deltaplan/.test(r.pr) && r.on && r.paid === 150 && r.dy < -3 && r.dy > -70 && r.dx > 150 && r.agl > 20 && r.still && r.fin, r);
  await ev(`(() => { S.auto = [0, 0.25]; G.sim(2); G.advance(0.3); })()`); await shot('suv_glide');
  await ev(`(() => { const gl = G.glider, c = Math.cos(gl.yaw), s = Math.sin(gl.yaw); G.view(gl.x - s * 9 + c * 7, gl.y + 2.5, gl.z - c * 9 - s * 7, gl.x + s * 30, gl.y - 20, gl.z + c * 30); })()`); await shot('suv_glide_view');
  // W — tezlashadi (balandlik hisobiga), S — sekinlashadi
  r = await ev(`(() => { const gl = G.glider; S.auto = [1, 0]; G.sim(4); const vf = gl.v; S.auto = [-1, 0]; G.sim(5); const vs = gl.v; S.auto = [0, 0]; return { vf: +vf.toFixed(1), vs: +vs.toFixed(1) }; })()`);
  T_('glide-pitch', r.vf > 14 && r.vs < 9, r);
  r = await ev(`(() => { const gl = G.glider, m0 = G.state.money, b0 = G.state.suv.best; let t = 0, nan = false, minY = 1e9; S.auto = [0, 0]; while (S.cur === gl && t < 600) { G.sim(1); t++; if (!fin([gl.x, gl.y, gl.z, gl.v])) nan = true; } S.auto = null; G.sim(0.5);
    const p = G.player.p; return { t, landed: !!gl.landed, water: gl.landed && gl.landed.water, foot: G.player.onFoot && !S.cur, nan, pfin: fin(p), last: S.last, gl: gl.landed, pp: G.player.p.map(Math.round), got: G.state.money - m0, best: G.state.suv.best, cnt: G.state.suv.glide }; })()`);
  T_('glide-land', r.last && r.foot && !r.nan && r.pfin && r.t > 40 && r.got >= 100 && r.best > 1000 && r.cnt === 1, r);
  // qattiq qo'nish: jazo yo'q — faqat yiqilib turadi; yumshoq — +50 bonus
  r = await ev(`(() => { const gl = G.glider, k = gl.kiosk; G.player.place(k[0] + 2.2, k[1] + 1.2, 0); G.sim(0.3); S.enter(gl, true); gl.v = 18; gl.vy = -5; const a = S.land(false); G.sim(0.1); const hard = G.player.lockAnim;
    G.player.lock = 0; G.player.lockAnim = null; S.enter(gl, true); gl.v = 10; gl.vy = -1; const b = S.land(false); return { hard: !a.soft, anim: hard, soft: b.soft, pb: b.pay - Math.min(300, Math.floor(b.d / 100) * 10) }; })()`);
  T_('glide-hard-soft', r.hard && r.anim === 'fall' && r.soft && r.pb === 50, r);

  // 6. saqlov: qayiqda saqlansa — o'tirgan joy yoziladi (suv ustida emas)
  r = await ev(`(() => { G.player.lock = 0; G.player.lockAnim = null; const b = G.boat; G.player.place(b.x + 2.5, b.z, 0); G.sim(0.3); const from = G.player.p.slice(); S.enter(b, true); S.auto = [1, 0]; G.sim(5); S.auto = null; G.noSave = false; G.save(); const sv = JSON.parse(localStorage.getItem('safar_save_v2')); const atBoat = G.player.p[0] === b.x; S.off(); return { foot: sv.foot, from, atBoat, suv: sv.suv }; })()`);
  T_('save', r.foot && Math.abs(r.foot[0] - r.from[0]) < 0.01 && r.atBoat && r.suv && r.suv.row >= 1, r);
};
