// Daromad sinovi: 19 ta yangi daromad yo'li — har biri boshlanadi, oldinga siljiydi, to'g'ri haq to'laydi, bankka manba nomi bilan yoziladi; ish e'lonlari, taxta, telefon «Daromad», obro' darajasi,
// iqtisod muvozanati (bitta ish uchun haq chegaralari), saqlov va qayta yuklash (eski saqlov ham). Ishlatish: npm run test:daromad (avval npm run build). SHOTS=1 — skrinshotlar
export default async ({ page, shot }) => {
  const ready = () => page.waitForFunction('window.__ready === true', null, { timeout: 180000 });
  const reload = async () => { await page.evaluate(() => { window.onbeforeunload = null; }); await page.reload({ timeout: 180000, waitUntil: 'commit' }); await ready(); await helpers(); };
  const T = async (name, expr) => { let r; try { r = await page.evaluate(expr); } catch (e) { r = { ok: false, err: e.message }; } const ok = r && r.ok !== false; console.log(`TEST ${name} ${ok ? 'OK' : 'FAIL'}`, JSON.stringify(r).slice(0, 600)); return r; };
  const SH = !!process.env.SHOTS, snap = async (n) => { if (SH) await shot('dr_' + n); };
  const helpers = () => page.evaluate(() => {
    const D = G.daromad;
    window.H = {
      veh(id) { const s = G.state; if (!s.veh.own.includes(id)) s.veh.own.push(id); if (G.player.onFoot) G.live.mount(); G.setVehicle(id); G.sim(0.05); },
      car(x, z, yaw = 0) { if (G.player.onFoot) G.live.mount(); G.car.place(x, z, yaw); G.prevP = G.car.p.slice(); G.sim(0.4); },
      near(x, z, r = 28) { const nr = G.T.nearestRoad(x, z, 4); if (nr.edge >= 0 && nr.d < r) { const R = G.T.roads; H.car(R.x[nr.i], R.z[nr.i], Math.atan2(R.tx[nr.i], R.tz[nr.i])); } else H.car(x + 6, z + 6); },
      foot(x, z) { if (!G.player.onFoot) G.live.dismount(true); G.player.place(x, z, 0); G.sim(0.1); },
      carE() { const J = D.cur; const a = J && J.def.carE && J.def.carE(J); if (!a) return false; a[1](); G.sim(0.05); return true; },
      offers() { const p = G.player.p, J = D.cur, o = []; if (J && J.def.extra) J.def.extra(J, (d, t, f) => o.push([t, f]), p[0], p[2]); for (const id of D.order) { const d = D.defs[id]; if (d.always) d.always((dd, t, f) => o.push([t, f]), p[0], p[2]); } return o; },
      doE(re) { const o = H.offers().find((q) => !re || re.test(q[0])); if (!o) return false; o[1](); G.sim(2.2); return true; },
      day(name) { return D.today()[name] || 0; },
      bank(name) { return G.state.income.filter((q) => q[1].startsWith(name) && q[2] > 0).reduce((a, q) => a + q[2], 0); },
      fresh() { if (D.cur) D.finish(false); if (G.ish.cur) G.ish.quit(); G.ui.close(); },
    };
  });
  await ready();
  await page.evaluate(() => { localStorage.clear(); }); await reload();
  await page.evaluate(() => { window._save = G.save; G.save = () => {}; G.state.money = 60000; G.mode = 'play'; window._d0 = G.state.dunyo.day; });

  await T('tuzilish: 19 daromad yo\'li, ish beruvchilar, ilgaklar', `(()=>{ const D=G.daromad, ids=D.order, cats={}; for(const id of ids){ const c=D.defs[id].cat; cats[c]=(cats[c]||0)+1; }
    const noG=ids.filter(id=>D.defs[id].cat!=='pul' && !D.givers[id]); const places=new Set(ids.map(id=>D.defs[id].place));
    return { ok: ids.length>=19 && noG.length===0 && cats.veh===8 && cats.foot>=6 && cats.pul>=4 && places.size>=11 && !!D.dbg2.clinic && !!D.dbg3.pen && !!D.dbg3.site && !!D.dbg4.api, n:ids.length, cats, noG, places:places.size }; })()`);

  // ---------- 1. Yuk tashish ----------
  await T('yuk: ortish → eltish → haq (sig\'im ×1,9, vaqtida +15 %)', `(()=>{ H.veh('yuk'); const D=G.daromad, y=D.dbg2.yard; H.car(y.x+2,y.z+1); const ok0=D.start('yuk',true), J=D.cur; const s0=J.stage; H.car(y.x,y.z); const l=H.carE(); const s1=J.stage;
    H.car(J.dst.x,J.dst.z); const want=Math.round((100+J.dist*0.26)*1.9*1.15); H.carE(); return { ok: ok0 && s0==='load' && l && s1==='go' && J.cap===3 && !D.cur && Math.abs(J.earn-want)<=2 && H.day('Yuk tashish')===J.earn && H.bank('Yuk tashish')===J.earn && J.earn>=500 && J.earn<=3200, earn:J.earn, want, dist:Math.round(J.dist) }; })()`);
  await T('yuk: velosipedda bo\'lmaydi, mo\'rt yuk urilishda arzonlashadi', `(()=>{ H.veh('velo'); const D=G.daromad, w=D.why('yuk'); H.veh('xetch'); const y=D.dbg2.yard; H.car(y.x,y.z); D.start('yuk',true); const J=D.cur; J.fragile=true; H.carE(); G.state.stats.crashes+=2; G.sim(0.1); H.car(J.dst.x,J.dst.z); const want=Math.round((100+J.dist*0.26)*1*1.6*0.5*(J.t>0?1.15:1)); H.carE();
    return { ok: !!w && J.cap===1 && J.hits===2 && Math.abs(J.earn-want)<=2, w, earn:J.earn, want }; })()`);

  // ---------- 2. Avtobus ----------
  await T('avtobus: bekatlarda to\'xtash, yo\'lovchilar, reys bonusi', `(()=>{ H.veh('sedan'); const D=G.daromad, w=D.why('avtobus'); H.veh('avtobus'); const g=D.givers.avtobus; H.car(g.x+3,g.z+3); D.start('avtobus',true); const J=D.cur, n=J.stops.length, log=[];
    for(let k=0;k<n && D.cur;k++){ const s=J.stops[J.k]; H.car(s.x,s.z,s.yaw); G.sim(1.4); log.push([J.k, J.pax]); }
    return { ok: !!w && n>=4 && n<=7 && !D.cur && J.done===n && J.earn>=500 && J.earn<=2000 && H.day('Avtobus marshruti')>=J.earn, n, earn:J.earn, log }; })()`);

  // ---------- 3. Kuryer ----------
  await T('kuryer: posilkalar uylarga, shoshilinchi ikki baravar, tezlik bonusi', `(()=>{ H.veh('skuter'); const D=G.daromad, g=D.givers.kuryer; H.car(g.x+3,g.z); const ok0=D.start('kuryer',true), J=D.cur, n=J.pts.length, ex=J.pts.find(p=>p.ex), pays=[];
    for(const p of J.pts.slice()){ H.foot(p.x,p.z); const e0=J.earn; const d=H.doE(/Posilka/); pays.push([d, Math.round(J.earn-e0), !!p.ex]); if(!D.cur) break; }
    const exPay=pays.find(q=>q[2]); return { ok: ok0 && n>=3 && !D.cur && J.done===n && pays.every(q=>q[0]) && exPay[1]>=100 && J.earn>=600 && J.earn<=2600, n, pays, earn:J.earn }; })()`);

  // ---------- 4. Evakuator ----------
  await T('evakuator: trosga ilish, uzilish (−15 %), ustaxonaga yetkazish', `(()=>{ H.veh('kart'); const D=G.daromad, w=D.why('evak'); H.veh('pikap'); const g=D.givers.evak; H.car(g.x+4,g.z); D.start('evak',true); const J=D.cur, wx=J.wx, wz=J.wz;
    H.car(wx+Math.sin(J.wy)*7, wz+Math.cos(J.wy)*7, J.wy); const h1=H.carE(), st1=J.stage; J.def.snap(J,'sinov'); const st2=J.stage; H.car(J.wx+3,J.wz+3,J.wy); H.carE(); const st3=J.stage;
    const tl=J.tl; H.car(J.gar.x+4,J.gar.z+4); G.sim(0.5); const want=Math.round((200+tl*0.3)*1.25*0.85);
    return { ok: !!w && h1 && st1==='tow' && st2==='go' && st3==='tow' && !D.cur && Math.abs(J.earn-want)<=2 && J.earn>=350 && J.earn<=1800, earn:J.earn, want, tl:Math.round(tl), gar:J.gar.name }; })()`);

  // ---------- 5. Tez yordam ----------
  await T('tez yordam: bemorni olish → tibbiyot punkti, qulaylik va vaqt', `(()=>{ H.veh('furgon'); const D=G.daromad, c=D.dbg2.clinic; H.car(c.door.x+5,c.door.z); D.start('tez',true); const J=D.cur, p=J.pt; H.car(p.x+Math.sin(p.yaw)*3,p.z+Math.cos(p.yaw)*3,p.yaw); const a=H.carE(), s1=J.stage; G.state.stats.crashes++; G.sim(0.05);
    H.car(c.door.x+(c.door.x-c.x)*0.6,c.door.z+(c.door.z-c.z)*0.6); G.sim(0.3); return { ok: a && s1==='back' && J.hits===1 && J.vm===1.25 && !D.cur && J.earn>=400 && J.earn<=2000 && H.day('Tez yordam')>=J.earn, earn:J.earn, back:Math.round(J.back) }; })()`);

  // ---------- 6. O't o'chirish ----------
  await T("o't o'chirish: olovlar o'chadi, bak sarflanadi, bonus", `(()=>{ H.veh('otochar'); const D=G.daromad, g=D.givers.ot; H.car(g.x+4,g.z); D.start('ot',true); const J=D.cur, n=J.fires.length, tanks=[];
    for(const f of J.fires){ if(!D.cur) break; J.tank=J.cap; const a=Math.atan2(G.car.p[0]-f.x, G.car.p[2]-f.z); H.car(f.x+Math.sin(a)*7, f.z+Math.cos(a)*7, a+Math.PI); for(let k=0;k<12 && f.hp>0;k++) G.sim(0.5); tanks.push([Math.round(f.hp), Math.round(J.tank)]); }
    return { ok: n>=3 && !D.cur && J.done===n && tanks.every(q=>q[0]<=0 && q[1]<100) && J.earn>=700 && J.earn<=2200, n, tanks, earn:J.earn }; })()`);
  await T("o't o'chirish: qarovsiz olov avj oladi, gidrantdan to'ldirish", `(()=>{ H.veh('pikap'); const D=G.daromad, g=D.givers.ot, h=D.dbg2.hyd; H.car(h.x+3,h.z); D.start('ot',true); const J=D.cur, f=J.fires[0]; f.hp=50; f.idle=10; G.sim(2); const grew=f.hp>50; J.tank=0; const a=J.def.carE(J); if(a) a[1]();
    const r={ ok: grew && J.cap===40 && J.range===8 && !!a && J.tank===40, hp:Math.round(f.hp), tank:J.tank }; D.quit(); return r; })()`);

  // ---------- 7. Qor tozalash ----------
  await T('qor: uyumlar ustidan sekin o\'tish, tez — tozalanmaydi, qor yog\'sa ×1,4', `(()=>{ H.veh('traktor'); G.dunyo.set('qor'); const D=G.daromad, g=D.givers.qor; H.car(g.x+4,g.z); D.start('qor',true); const J=D.cur, n=J.dr.length, q0=J.dr[0];
    H.car(q0.x+40,q0.z+40); G.car.place(q0.x,q0.z,q0.yaw); G.car.v[0]=Math.sin(q0.yaw)*20; G.car.v[2]=Math.cos(q0.yaw)*20; G.sim(0.02); const fast=!q0.ok;
    for(const q of J.dr){ if(!D.cur) break; H.car(q.x,q.z,q.yaw); } G.dunyo.set('ochiq'); const want=Math.round((45*n+220)*1.4*1.4);
    return { ok: n>=6 && fast && J.snow && !D.cur && J.done===n && Math.abs(J.earn-want)<=n+2 && J.earn<=2200, n, earn:J.earn, want }; })()`);

  // ---------- 8. Sayyohlarga gid ----------
  await T('gid: manzillar, hikoya oynasi, to\'g\'ri/xato javob, qaytish va baho', `(()=>{ H.veh('traktor'); const D=G.daromad, w=D.why('gid'); H.veh('limuzin'); const g=D.givers.gid; H.car(g.x+4,g.z); D.start('gid',true); const J=D.cur, n=J.sights.length;
    const s=J.sights[0]; H.near(s.x,s.z); const a=J.def.carE(J); a[1](); const win=G.ui.screenName==='gid' && document.querySelectorAll('.win button[data-a^="ans"]').length===3; document.querySelector('.win button[data-a^="ans:1"]').click(); const st1=J.stars;
    for(let k=1;k<n;k++){ const q=J.sights[J.k]; H.near(q.x,q.z); const b=J.def.carE(J); if(!b) return {ok:false, at:k}; D.defs.gid.answer(J, k%2===0); } const home=J.stage; H.car(g.x+5,g.z+5); G.sim(0.3);
    return { ok: !!w && win && st1===1 && home==='home' && !D.cur && J.vm===1.3 && J.earn>=900 && J.earn<=3200 && H.day('Sayyohlarga gid')>=J.earn, n, earn:J.earn, stars:J.stars }; })()`);
  await page.evaluate(() => G.ui.close());

  // ---------- 9. Yo'l ta'miri ----------
  await T("yo'l ta'miri: konuslar → shag'al → zichlash → konuslarni yig'ish", `(()=>{ H.fresh(); const D=G.daromad, g=D.givers.yol; H.foot(g.x+1.5,g.z); D.start('yol',true); const J=D.cur, log=[];
    for(const c of J.cones){ H.foot(c.x,c.z); log.push(H.doE(/Konus qo'yish/)); } const s1=J.stage, beforeCone=H.offers().length;
    for(const h of J.holes){ H.foot(h.x,h.z); log.push(H.doE(/Shag'al/)); log.push(H.doE(/zichlash/)); } const s2=J.stage;
    for(const c of J.cones){ H.foot(c.x,c.z); log.push(H.doE(/yig'ish/)); }
    return { ok: log.every(Boolean) && s1==='fix' && s2==='pick' && !D.cur && J.earn>=750 && J.earn<=1300 && H.day("Yo'l ta'miri")>=J.earn, log:log.length, earn:J.earn }; })()`);

  // ---------- 10. Qo'y boqish ----------
  await T("qo'y boqish: qo'ylar qochadi, yaylovda o'tlaydi, qo'raga qaytadi", `(()=>{ H.fresh(); const D=G.daromad, g=D.givers.qoy, pen=D.dbg3.pen; H.foot(g.x+1.5,g.z); D.start('qoy',true); const J=D.cur, s=J.sh[0];
    H.foot(s.x+2, s.z); const d0=Math.hypot(s.x-G.player.p[0], s.z-G.player.p[2]); G.sim(1.2); const d1=Math.hypot(s.x-G.player.p[0], s.z-G.player.p[2]); H.foot(J.pas.x+40, J.pas.z+40);
    for(const q of J.sh){ q.x=J.pas.x+(Math.random()-0.5)*4; q.z=J.pas.z+(Math.random()-0.5)*4; q.vx=q.vz=0; } G.sim(0.5); const st1=J.stage; J.graze=0.3; G.sim(0.6); const st2=J.stage;
    for(const q of J.sh){ q.x=pen.x+(Math.random()-0.5)*2; q.z=pen.z+(Math.random()-0.5)*2; q.vx=q.vz=0; } G.sim(0.3);
    return { ok: d1>d0+1 && st1==='graze' && st2==='home' && !D.cur && J.earn>=700 && J.earn<=1400 && H.day("Qo'y boqish")>=J.earn, d0:+d0.toFixed(1), d1:+d1.toFixed(1), earn:J.earn }; })()`);

  // ---------- 11. Quruvchi ----------
  await T("quruvchi: taxlamdan g'isht → devor (18 g'isht), tezlik bonusi", `(()=>{ H.fresh(); const D=G.daromad, g=D.givers.quruvchi, si=D.dbg3.site; H.foot(g.x+1.5,g.z); D.start('quruvchi',true); const J=D.cur; let trips=0;
    while(D.cur && trips<12){ H.foot(si.pal.x+1,si.pal.z); H.doE(/g'isht olish/); trips++; while(J.hand>0 && D.cur){ const q=D.dbg3.slot(J.n); H.foot(q.x+Math.sin(si.yaw)*1.2,q.z+Math.cos(si.yaw)*1.2); if(!H.doE(/terish/)) return {ok:false, n:J.n}; } }
    return { ok: !D.cur && J.n===J.total && trips===6 && J.earn===Math.round(40*J.total+200+(J.el<120?120:0)) && H.day('Quruvchi')>=J.earn, earn:J.earn, trips, el:Math.round(J.el) }; })()`);

  // ---------- 12. Fotograf ----------
  await T('fotograf: kamera manzilga qaragan bo\'lsa surat, sifat bo\'yicha haq', `(()=>{ H.fresh(); const D=G.daromad, g=D.givers.foto; H.foot(g.x+1.5,g.z); D.start('foto',true); const J=D.cur, res=[];
    for(const q of J.list){ const p=D.dbg3.subjPos(q.s), mid=(q.s[3]+q.s[4])/2, x=p.x+mid*0.7, z=p.z+mid*0.7; H.foot(x,z); const p2=D.dbg3.subjPos(q.s); G.camera.position.set(G.player.p[0],G.player.p[1]+1.7,G.player.p[2]); G.camera.lookAt(2*G.camera.position.x-p2.x, G.camera.position.y, 2*G.camera.position.z-p2.z); G.camera.updateMatrixWorld(); const bad=H.offers().some(o=>/Suratga/.test(o[0]));
      G.camera.lookAt(p2.x,p2.y,p2.z); G.camera.updateMatrixWorld(); const o=H.offers().find(o=>/Suratga/.test(o[0])); res.push([q.s[0], !bad, !!o]); if(o) o[1](); }
    return { ok: res.every(r=>r[1]&&r[2]) && !D.cur && J.earn>=900 && J.earn<=2400 && G.state.daromad.photo.n>=3, res, earn:J.earn }; })()`);

  // ---------- 13–16. Savdo, asal, hunar ----------
  await T("savdo: arzon joyda olish, qimmat joyda sotish — foyda, narx bosimi", `(()=>{ H.fresh(); H.veh('sedan'); const D=G.daromad, P=G.site.places, b1=P.karvon.board, b2=P.lager.board; const m0=G.state.money;
    H.near(b1.x,b1.z,14); const here=D.marketAt(), bp=D.buyP('ziravor','karvon'), n=D.buy('ziravor','karvon',20), spent=m0-G.state.money, cap=D.cargoCap();
    H.near(b2.x,b2.z,14); const at2=D.marketAt(), sp0=D.sellP('ziravor','lager'), m1=G.state.money; D.sell('ziravor','lager',n); const rev=G.state.money-m1, sp1=D.sellP('ziravor','lager');
    const asal=D.buyP('asal','karvon');
    return { ok: here==='karvon' && at2==='lager' && n===10 && cap===10 && sp0>bp*1.4 && rev>spent*1.3 && sp1<sp0 && asal===null && H.day('Savdogar')===rev && D.cargoN()===0, bp, sp0, sp1, spent, rev }; })()`);
  await T('asalarichilik: uya sotib olish, o\'yin vaqtida asal, yig\'ish va sotish', `(()=>{ const D=G.daromad, S=G.state.daromad, m0=G.state.money; D.buyHive(); D.buyHive(); const paid=m0-G.state.money; G.kun.pass(6); const h=S.hives[0].h; const api=D.dbg4.api, q=api.slots[0];
    H.foot(q.x+1,q.z); const e=H.doE(/Asal yig'ish/); const got=S.cargo.asal; G.kun.pass(30); const cap=S.hives[1].h;
    G.ui.open('asal'); const win=/Asalarichilik/.test(document.querySelector('.win').textContent); document.querySelector('.win button[data-a="sell"]').click(); G.ui.close();
    return { ok: paid===900 && Math.abs(h-3)<0.01 && e && got===3 && cap===4 && win && !S.cargo.asal && H.day('Asalarichilik')===Math.round(52*3), paid, h, got, cap, sold:H.day('Asalarichilik') }; })()`);
  await T("kulolchilik: charx o'yini (5 bosish) va sifat → idish", `(()=>{ const D=G.daromad, S=G.state.daromad, g=D.givers.kulol; H.foot(g.x+1.5,g.z); const a=D.craft('kulol',0.9), b=D.craft('kulol',0.5), c=D.craft('kulol',0.2); const n0=S.cargo.sopol||0;
    G.ui.open('hunar',{k:'kulol'}); document.querySelector('.win button[data-a="go"]').click(); const bar=!!document.querySelector('.dr-mg .bar'); for(let i=0;i<5;i++) document.dispatchEvent(new KeyboardEvent('keydown',{code:'Space',bubbles:true}));
    const back=!!document.querySelector('.win button[data-a="sell"]'), n1=S.cargo.sopol||0; document.querySelector('.win button[data-a="sell"]').click(); G.ui.close();
    return { ok: a===2 && b===1 && c===0 && n0===3 && bar && back && n1>=3 && !S.cargo.sopol && H.day('Kulolchilik')===102*n1, a,b,c,n0,n1 }; })()`);
  await T("gilamdo'zlik: naqsh o'yini va a'lo gilam mukofoti", `(()=>{ const D=G.daromad, S=G.state.daromad; const a=D.craft('gilam',1), b=D.craft('gilam',0.34); G.ui.open('hunar',{k:'gilam'}); const ok1=/Gilamdo/.test(document.querySelector('.win h1').textContent); document.querySelector('.win button[data-a="go"]').click(); const pal=document.querySelectorAll('.dr-mg .pal button').length; G.ui.close();
    return { ok: a===1 && b===0 && S.cargo.gilam===1 && ok1 && pal===4 && H.day("Gilamdo'zlik")===60, a, b, bonus:H.day("Gilamdo'zlik") }; })()`);

  // ---------- 17–19. Sarmoya ----------
  await T('ijara: transport ijarada — minib bo\'lmaydi, muddat tugasa haq', `(()=>{ const D=G.daromad, S=G.state.daromad; H.veh('sedan'); G.state.veh.own.push('super'); const w1=D.canRent('sedan'), ok=D.rentOut('super',6), rate=D.rentRate('super'); G.setVehicle('super'); const blocked=G.state.veh.cur==='sedan';
    G.kun.pass(3); const mid=!!S.rent.super; G.kun.pass(3.5); const got=H.day('Transport ijarasi'), full=rate*6;
    return { ok: !!w1 && ok && blocked && mid && !S.rent.super && (Math.abs(got-full)<=2 || Math.abs(got-Math.round(full*0.9))<=2) && rate<=110, rate, got, full }; })()`);
  await T('omonat: qo\'yish (daromad emas), kunlik foiz, yechish', `(()=>{ const D=G.daromad, S=G.state.daromad, m0=G.state.money, t0=H.day('Bank omonati'); D.deposit(10000); const m1=G.state.money; G.state.dunyo.day++; D.bankTick(); const fz=H.day('Bank omonati'); D.withdraw(99999); const m2=G.state.money;
    return { ok: m0-m1===10000 && fz===120 && t0===0 && S.bank.dep===0 && m2===m1+10000+120 && !D.today()['Omonatga qo\\'yildi'], fz, dep:S.bank.dep }; })()`);
  await T('kooperativ: ulush, kunlik dividend, narx o\'zgarishi, sotish', `(()=>{ const D=G.daromad, C=G.state.daromad.coop, p0=D.coopPrice(), n=D.coopBuy(50); G.state.dunyo.day++; D.coopTick(); const div=H.day('Kooperativ ulushi'), p1=D.coopPrice(); const prices=[]; for(let k=0;k<10;k++){ G.state.dunyo.day++; D.coopTick(); prices.push(D.coopPrice()); }
    const m0=G.state.money; D.coopSell(50); return { ok: n===50 && div>0 && div<=Math.round(50*p1*0.008)+1 && new Set(prices).size>4 && prices.every(p=>p>=35&&p<=400) && C.n===0 && G.state.money>m0, p0, p1, div, prices }; })()`);

  // ---------- Umumiy: e'lonlar, taxta, telefon, obro', to'qnashuv ----------
  await page.evaluate(() => { G.state.dunyo.day = window._d0; });
  await T("ish e'lonlari oynasi: hamma ish, filtr, yo'l ko'rsatish", `(()=>{ H.fresh(); G.ui.open('elonlar',{tab:'all'}); const n=document.querySelectorAll('.win .cards .card').length; document.querySelector('.win [data-a="tab:veh"]').click(); const nv=document.querySelectorAll('.win .cards .card').length; document.querySelector('.win [data-a="go:yuk"]').click(); const way=!!G.way; G.setWaypoint(null);
    return { ok: n===G.daromad.order.length && nv===8 && way && G.ui.screenName!=='elonlar', n, nv }; })()`);
  await page.evaluate(() => { G.ui.open('elonlar', { tab: 'all' }); G.advance(0.05); }); await snap('elonlar');
  await T("e'lonlar taxtasi: shu manzil ishlari va savdo rastasi", `(()=>{ G.ui.open('board','karyer'); const t=document.querySelector('.win').textContent; const kv=[...document.querySelectorAll('.win .card h4')].map(h=>h.textContent); G.ui.close(); G.ui.open('board','bandargoh'); const t2=document.querySelector('.win').textContent; G.ui.close();
    return { ok: /Yuk tashish/.test(t) && /Savdogar/.test(t) && /Kuryer/.test(t2) && /Sayyohlarga gid/.test(t2) && /Barcha ish/.test(t), kv:kv.slice(-3) }; })()`);
  await T("telefon: «Daromad» (bugun/hafta, manbalar) va «E'lonlar»", `(()=>{ G.phone.open('daromad'); G.advance(0.02); const t=document.querySelector('.phone').textContent; const rows=document.querySelectorAll('.phone .dr-src > div').length; G.phone.open('elon'); const t2=document.querySelector('.phone').textContent; G.ui.close();
    const td=G.daromad.today(), wk=G.daromad.week(); return { ok: /Bugun/.test(t) && /Yuk tashish/.test(t) && rows>=10 && /Avtobus/.test(t2) && Object.keys(wk).length>=15 && Object.values(wk).reduce((a,b)=>a+b,0)>=Object.values(td).reduce((a,b)=>a+b,0), rows, src:Object.keys(td).length }; })()`);
  await page.evaluate(() => { G.phone.open('daromad'); G.advance(0.05); }); await snap('telefon');
  await T("obro': daraja oshadi, haq +8 %, eski ishlar bilan to'qnashmaydi", `(()=>{ G.ui.close(); const D=G.daromad, l0=D.lvl('quruvchi'); G.state.daromad.rep.quruvchi=85; const l1=D.lvl('quruvchi'), m=D.mul('quruvchi'); G.ish.startNon(); const iscur=!!G.ish.cur; const b=D.start('quruvchi',true); G.ish.quit(); const ok2=D.start('quruvchi',true); const nonBlocked=(G.ish.startNon(), !G.ish.cur);
    const ax=G.T? true:true; D.quit(); return { ok: l0===0 && l1===2 && Math.abs(m-1.16)<1e-9 && iscur && !b && ok2 && nonBlocked && !D.cur, l0, l1 }; })()`);
  await T("iqtisod: bitta ishning haqi va daqiqasiga daromad me'yorda", `(()=>{ const D=G.daromad, rows=[]; let bad=[]; for(const id of D.order){ const d=D.defs[id], s=D.stat(id); if(d.cat==='pul' || !s.best || !d.mins) continue; const pm=s.best/d.mins; rows.push([id, s.best, Math.round(pm)]); if(s.best>3500 || pm>900) bad.push(id); }
    const ij=D.rentRate('bolid'); return { ok: rows.length>=10 && !bad.length && ij<=130, rows, bad, ij }; })()`);

  // ---------- Saqlov ----------
  await T('saqlov: yozish', `(()=>{ const S=G.state.daromad; S.cargo.qovun=4; G.state.veh.own.push('kupe'); G.daromad.rentOut('kupe',24); G.daromad.deposit(5000); G.daromad.coopBuy(10); window._save(); return { ok: !!localStorage.getItem('safar_save_v2') }; })()`);
  await reload();
  await T('saqlov: obro\', hisob, uyalar, yuk, ijara, omonat, ulushlar joyida', `(()=>{ const S=G.state.daromad, D=G.daromad; return { ok: S.rep.yuk===24 && S.jobs.yuk.n===2 && S.hives.length===2 && S.cargo.qovun===4 && S.rent.kupe && S.rent.kupe.left===24 && S.bank.dep===5000 && S.coop.n===10 && S.days.length>=1 && Object.keys(S.all).length>=15 && D.dbg4.api && G.daromad.order.length>=19, rep:S.rep }; })()`);
  await T('saqlov: eski saqlov (daromadsiz) ochiladi', `(()=>{ G.noSave=true; window.onbeforeunload=null; const o=JSON.parse(localStorage.getItem('safar_save_v2')); delete o.daromad; localStorage.setItem('safar_save_v2', JSON.stringify(o)); return { ok:true }; })()`);
  await reload();
  await T('saqlov: eski saqlovda standart qiymatlar', `(()=>{ const S=G.state.daromad, D=G.daromad; return { ok: S && Array.isArray(S.hives) && S.hives.length===0 && S.bank.dep===0 && S.coop.n===0 && typeof S.rent==='object' && D.lvl('yuk')===0 && D.start('quruvchi',true) && (D.quit(), true) }; })()`);
};
