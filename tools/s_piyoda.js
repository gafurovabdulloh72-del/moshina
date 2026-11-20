// Piyoda qahramon va kamera mayda detallari sinovi: animatsiya holati (sakrash/suzish), odamlar bilan to'qnashuv, devor oldida kamera (yaqin tekislik),
// virtual joystik tezligi, skameykadan turish, baland joydan yiqilish, suvga tushish, qiyalikda sirpanish. Ishlatish: npm run test:piyoda (avval npm run build). SHOTS=1 — skrinshotlar
export default async ({ page, shot }) => {
  await page.waitForFunction('window.__ready === true', null, { timeout: 180000 });
  const T = async (name, expr) => { let r; try { r = await page.evaluate(expr); } catch (e) { r = { ok: false, err: e.message }; } const ok = r && r.ok !== false; console.log(`TEST ${name} ${ok ? 'OK' : 'FAIL'}`, JSON.stringify(r).slice(0, 400)); return r; };
  const SH = !!process.env.SHOTS, snap = async (n) => { if (SH) await shot('piyoda_' + n); };
  await page.evaluate(() => { G.save = () => {}; G.live.dismount(true); G.sim(0.5);
    const K = (window.K = G.input.keys);
    window.walk = (code, secs, f) => { K.add(code); for (let i = 0; i < Math.round(secs * 60); i++) { G.sim(1 / 60); if (f) f(i); } K.delete(code); };
    window.free = (x, z) => { const pl = G.player; pl.lock = 0; pl.lockAnim = null; pl.sit = false; pl.emote = null; G.teleport(x, z, 0); pl.v[0] = pl.v[1] = pl.v[2] = 0; G.sim(0.3); };
    // ochiq tekis joy: atrofida 6 m da to'siq yo'q, suv yo'q
    window.openSpot = (cx, cz) => { for (let r = 0; r < 200; r += 7) for (let a = 0; a < 6.28; a += 0.5) { const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r, g0 = G.T.ground(x, z, 1e9).y; if (G.T.waterY(x, z) > g0 - 0.5) continue; let ok = G.COL.query(x, z, 6).length === 0; for (let k = 0; k < 8 && ok; k++) { const q = G.T.ground(x + Math.cos(k) * 5, z + Math.sin(k) * 5, 1e9).y; if (Math.abs(q - g0) > 0.6) ok = false; } if (ok) return [x, z]; } return null; };
  });

  // 1. animatsiyaga harakat holati uzatiladi (avval izoh ichida qolib ketgan edi: sakrashda ham "yerda" deb hisoblanardi)
  await T('animatsiya: sakrashda havoda ekani va tezligi uzatiladi', `(()=>{ const pl=G.player, h=G.site.places.uy.home, o=openSpot(h.x,h.z); free(o[0],o[1]); G.input.pressed.add('Space'); G.sim(1/60); let air=0, vy=0; for(let i=0;i<20;i++){ G.sim(1/60); if(!pl.ctl.grounded) air++; vy=Math.max(vy, pl.ctl.vy); } G.sim(1.5); return { ok: air>10 && vy>3 && pl.ctl.grounded===true && pl.ctl.camYaw!=null, air, vy }; })()`);

  // 2. aholi bilan yuzma-yuz — ichidan o'tib ketmaydi
  await T("odamlar: aholi ichidan o'tib bo'lmaydi", `(()=>{ const pl=G.player, n=G.live._dbg.npcs[0]; free(n.x+3, n.z); G.cam.heading=-Math.PI/2; G.cam.yawOff=0; let md=99; walk('KeyW', 2, ()=>{ G.cam.heading=-Math.PI/2; md=Math.min(md, Math.hypot(pl.p[0]-n.x, pl.p[2]-n.z)); }); return { ok: md>0.5, md:+md.toFixed(2) }; })()`);

  // 3. devor oldida kamera qahramonni kesib qo'ymaydi (yaqin tekislik masofaga moslanadi)
  await T('kamera: yaqinlashganda yaqin tekislik qahramondan oldinda', `(()=>{ const pl=G.player, h=G.site.places.uy.home; let w=null; for(const o of G.COL.list){ if(o.t!==1||o.dead||o.kind||o.y1-o.y0<4) continue; const L=Math.hypot(o.x2-o.x,o.z2-o.z); if(L<5) continue; const mx=(o.x+o.x2)/2, mz=(o.z+o.z2)/2; if(Math.hypot(mx-h.x,mz-h.z)<1500){ w={o,mx,mz,L}; break; } } if(!w) return {ok:false, err:'devor yo\\'q'};
    const o=w.o, nx=-(o.z2-o.z)/w.L, nz=(o.x2-o.x)/w.L, res=[]; for(const sd of [1,-1]){ const px=w.mx+nx*sd*(o.r+0.5), pz=w.mz+nz*sd*(o.r+0.5), yaw=Math.atan2(nx*sd,nz*sd); free(px,pz); pl.yaw=yaw; G.cam.heading=yaw; G.cam.yawOff=0; G.sim(1.5); const c=G.camera.position, hy=Math.min(pl.p[1]+1.75,Math.max(pl.p[1]+0.1,c.y)), d=Math.hypot(c.x-pl.p[0],c.y-hy,c.z-pl.p[2])-0.3; res.push({ d:+d.toFixed(2), near:+G.camera.near.toFixed(2) }); }
    return { ok: res.every(r=>r.near < r.d), res }; })()`);
  await snap('devor');

  // 4. virtual joystik: oz egilsa sekin, to'liq egilsa to'liq tezlik
  await T('joystik: egilishga qarab tezlik', `(()=>{ const pl=G.player, h=G.site.places.uy.home, o=openSpot(h.x,h.z); free(o[0],o[1]); const t=G.input.touch, sp=(jy)=>{ t.jy=jy; G.sim(1.2); const v=pl.speed; t.jy=0; G.sim(0.6); return +v.toFixed(2); }; const a=sp(-0.3), b=sp(-1); return { ok: a>0.5 && a<b*0.6 && b>3.3, a, b }; })()`);

  // 5. skameykada o'tirganda Probel — o'rnidan turadi, sakramaydi
  await T("skameyka: Probel o'rnidan turg'izadi", `(()=>{ const pl=G.player, h=G.site.places.uy.home, o=openSpot(h.x,h.z); free(o[0],o[1]); pl.sit=true; G.sim(0.5); G.input.pressed.add('Space'); G.sim(1/60); let air=0; for(let i=0;i<30;i++){ G.sim(1/60); if(!pl.grounded) air++; } return { ok: !pl.sit && air===0, sit:pl.sit, air }; })()`);

  // 6. baland joydan tushish: yiqilish harakati, kuch kamayadi; past joydan — oddiy qo'nish
  await T("tushish: balanddan — yiqiladi, pastdan — yo'q", `(()=>{ const pl=G.player, h=G.site.places.uy.home, o=openSpot(h.x,h.z); free(o[0],o[1]); const st=G.state; st.energy=80; pl.p[1]+=1.2; pl.grounded=false; let a1=null; for(let i=0;i<60;i++){ G.sim(1/60); if(pl.lockAnim) a1=pl.lockAnim; } st.energy=80; pl.p[1]+=9; pl.grounded=false; let a2=null, e1=null; for(let i=0;i<90;i++){ G.sim(1/60); if(pl.lockAnim&&!a2){ a2=pl.lockAnim; e1=st.energy; } } G.sim(2); return { ok: a1===null && a2==='fall' && e1<82, a1, a2, e1 }; })()`);

  // 7. suvga tushish: suzish holati, animatsiya suzish
  await T('suv: chuqur suvda suzadi', `(()=>{ const pl=G.player; let w=null; for(let r=0;r<400&&!w;r+=10) for(let a=0;a<6.28;a+=0.4){ const x=-1180+Math.cos(a)*r, z=2452+Math.sin(a)*r; if(G.T.ground(x,z,1e9).y < -3){ w=[x,z]; break; } } if(!w) return {ok:false, err:'suv topilmadi'}; free(w[0],w[1]); G.sim(1.5); return { ok: pl.swim && pl.ctl.swim && pl.anim==='swim', swim:pl.swim, anim:pl.anim }; })()`);
  await page.evaluate(() => { G.advance(0.05); }); await snap('suv');

  // 8. tik qiyalik: oldinga yurolmasa yonbag'ir bo'ylab sirpanadi, tik tomonga chiqib ketmaydi
  await T('qiyalik: tik joyga chiqmaydi, lekin yonbag\'ir bo\'ylab sirpanadi', `(()=>{ const pl=G.player; let best=null, sd=987; const rn=()=>((sd=(sd*1664525+1013904223)>>>0)/4294967296); const gr=(x,z)=>G.T.ground(x,z,1e9).y; for(let i=0;i<6000&&!best;i++){ const x=150+(rn()-0.5)*800, z=-450+(rn()-0.5)*800, g0=gr(x,z); if(G.T.waterY(x,z)>g0-1) continue; const gx=gr(x+0.5,z)-gr(x-0.5,z), gz=gr(x,z+0.5)-gr(x,z-0.5), s=Math.hypot(gx,gz); if(s<2.4) continue; const a=Math.atan2(gx,gz); let ok=true; for(let k=1;k<=4;k++){ if(gr(x+Math.sin(a)*k*0.6,z+Math.cos(a)*k*0.6)-gr(x+Math.sin(a)*(k-1)*0.6,z+Math.cos(a)*(k-1)*0.6) < 1.1) ok=false; } if(ok&&G.COL.query(x,z,4).length===0) best=[x,z,a]; } if(!best) return {ok:true, skip:'tik joy topilmadi'};
    free(best[0],best[1]); let worst=0, px=pl.p[0], pz=pl.p[2], py=pl.p[1]; const x0=px, z0=pz, h=best[2]+0.35; G.cam.heading=h; G.cam.yawOff=0; walk('KeyW', 1.5, ()=>{ G.cam.heading=h; const d=Math.hypot(pl.p[0]-px,pl.p[2]-pz); if(pl.grounded&&d>0.01) worst=Math.max(worst,(pl.p[1]-py-0.02)/d); px=pl.p[0]; pz=pl.p[2]; py=pl.p[1]; }); const moved=Math.hypot(pl.p[0]-x0,pl.p[2]-z0);
    return { ok: worst < 1.7 && moved > 0.8, worst:+worst.toFixed(2), moved:+moved.toFixed(2) }; })()`);

  // 9. yo'ldagi mashina ichidan o'tib bo'lmaydi
  await T("mashinalar: yo'ldagi mashina ichiga kirib bo'lmaydi", `(()=>{ const pl=G.player; G.sim(1); const c=G.life.cars.find(c=>c.placed&&c.m.root.visible); if(!c) return {ok:true, skip:"mashina yo'q"}; free(c.x+Math.cos(c.yaw)*(c.halfW+3), c.z-Math.sin(c.yaw)*(c.halfW+3)); pl.p[0]=c.x+Math.cos(c.yaw)*0.3; pl.p[2]=c.z-Math.sin(c.yaw)*0.3; pl.p[1]=c.y-c.com; G.sim(1/60);
    const fx=Math.sin(c.yaw), fz=Math.cos(c.yaw), dx=pl.p[0]-c.x, dz=pl.p[2]-c.z, lx=dx*fz-dz*fx, lz=dx*fx+dz*fz; return { ok: Math.abs(lx)>c.halfW+0.1 || Math.abs(lz)>c.half+0.1, lx:+lx.toFixed(2), lz:+lz.toFixed(2), hw:c.halfW }; })()`);

  // 10. [R] — yo'l uzoq bo'lsa xabar; tugmalar suzishda yashirin; telefonda durbin tugmasi
  await T("R: yo'l uzoqda bo'lsa xabar beradi", `(()=>{ const pl=G.player; let w=null; for(let i=0;i<3000&&!w;i++){ const x=(Math.random()-0.5)*6000, z=(Math.random()-0.5)*6000; if(G.T.nearestRoad(x,z,12).edge<0 && G.COL.query(x,z,2).length===0) w=[x,z]; } if(!w) return {ok:true, skip:"joy yo'q"}; free(w[0],w[1]); const n0=document.querySelectorAll('#toasts .toast').length; G.input.pressed.add('KeyR'); G.sim(1/60); const t=[...document.querySelectorAll('#toasts .toast')].map(e=>e.textContent).pop()||''; return { ok: /yo'l topilmadi/.test(t) && Math.hypot(pl.p[0]-w[0],pl.p[2]-w[1])<0.5, t }; })()`);
  await T("tugmalar: suzishda Sakrash/Yugurish yo'q, telefonda Durbin bor", `(()=>{ const pl=G.player; let w=null; for(let r=0;r<400&&!w;r+=10) for(let a=0;a<6.28;a+=0.4){ const x=-1180+Math.cos(a)*r, z=2452+Math.sin(a)*r; if(G.T.ground(x,z,1e9).y < -3){ w=[x,z]; break; } } free(w[0],w[1]); G.sim(1); const bar=()=>[...document.querySelectorAll('#h-bar [data-code]')].map(b=>b.textContent); G.ui.update(0.1); const sw=bar(); const h=G.site.places.uy.home, o=openSpot(h.x,h.z); free(o[0],o[1]); G.ui.hud.classList.add('touch'); G.ui.update(0.1); const ld=bar(); G.ui.hud.classList.remove('touch'); G.ui.update(0.1);
    return { ok: !sw.some(t=>/Sakrash|Yugurish/.test(t)) && ld.some(t=>/Sakrash/.test(t)) && ld.some(t=>/Durbin/.test(t)), sw, ld }; })()`);

  // 11. aholiga yuzlanish asta (keskin sakramaydi)
  await T('yuzlanish: gaplashganda asta buriladi', `(()=>{ const pl=G.player, h=G.site.places.uy.home, o=openSpot(h.x,h.z); free(o[0],o[1]); pl.yaw=0; pl.faceTo(Math.PI*0.9); G.sim(1/60); const y1=pl.yaw; G.sim(0.6); return { ok: Math.abs(y1)<1.2 && Math.abs(pl.yaw-Math.PI*0.9)<0.05, y1:+y1.toFixed(2), y2:+pl.yaw.toFixed(2) }; })()`);


  // 12. charchoq: kuch tugagach yetarlicha tiklanmaguncha yugurmaydi (uzilib-uzilib yugurmaslik)
  await T('charchoq: kuch tiklanmaguncha yugurmaydi', `(()=>{ const pl=G.player, st=G.state, h=G.site.places.uy.home, o=openSpot(h.x,h.z); free(o[0],o[1]); st.sat=100; st.energy=0.3; K.add('ShiftLeft'); let sw=0, prev=null, runT=0; walk('KeyW', 6, ()=>{ const r=pl.speed>4.6; if(prev!==null&&r!==prev) sw++; prev=r; if(r) runT++; }); K.delete('ShiftLeft'); return { ok: sw<=1 && st.energy>=0, sw, runT, e:+st.energy.toFixed(1) }; })()`);

};
