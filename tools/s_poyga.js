// Poygalar sinovi: cheksiz poyga (darvoza yo'lda, vaqt to'ladi, tugaydi, rekord), yo'l egasi (bo'lak vaqti va rekord saqlanadi), aylanma poyga (aylanalar sanaladi, marra, kubok),
// Yulduz yo'li (eski yulduzlar bilan ham ochiladi, olinadi), transport mahorati (nishon, «Usta»), oynalar va saqlov. Ishlatish: npm run test:poyga (avval npm run build). SHOTS=1 — skrinshotlar
export default async ({ page, shot }) => {
  const ready = () => page.waitForFunction('window.__ready === true', null, { timeout: 120000 });
  const reload = async () => { await page.evaluate(() => { window.onbeforeunload = null; }); await page.reload(); await ready(); };
  const T = async (name, expr) => { let r; try { r = await page.evaluate(expr); } catch (e) { r = { ok: false, err: e.message }; } const ok = r && r.ok !== false; console.log(`TEST ${name} ${ok ? 'OK' : 'FAIL'}`, JSON.stringify(r).slice(0, 500)); return r; };
  const SH = !!process.env.SHOTS, snap = async (n) => { if (SH) await shot('pg_' + n); };
  await ready();
  await page.evaluate(() => { localStorage.clear(); }); await reload();
  await page.evaluate(() => { window._save = G.save; G.save = () => {}; G.state.money = 5000; G.mode = 'play'; });

  await T('tuzilish: 5 aylanma, 50 bo\'lak, ilgaklar', `(()=>{ const P=G.poyga, H=G.mahorat; return { ok: !!P && !!H && P.circs.length===5 && P.segs.length===50 && P.circs.every(a=>a._p.length>200 && a.lapEnd.length===a.laps && a.lapEnd[a.laps-1]===a._p.length-1) && G.maxStars===270, laps:P.circs.map(a=>[a.id,a.laps,Math.round(a.lapLen)]) }; })()`);

  // ---------- 1. Cheksiz poyga ----------
  await T('cheksiz: boshlanadi, darvoza yo\'lda', `(()=>{ const R=G.T.roads, e=R.edges.find(q=>q.key==='e1'), i=e.start+60; G.car.place(R.x[i],R.z[i],Math.atan2(R.tx[i],R.tz[i])); G.prevP=G.car.p.slice(); G.sim(0.1);
    const ok0=G.poyga.startInf(), A=G.act, g=A.g0, nr={d:G.T.nearestRoad(g.x,g.z,2).d}, d0=Math.hypot(g.x-G.car.p[0],g.z-G.car.p[2]); G.sim(3.6);
    return { ok: ok0 && A.def.cat==='cheksiz' && A.state==='run' && nr.d<1 && d0>150 && d0<330 && A.limit===32 && A.g1 && Math.hypot(A.g1.x-g.x,A.g1.z-g.z)>100, d0:Math.round(d0), road:nr.d }; })()`);
  await page.evaluate(() => { const A = G.act, q = A.g0.pts, a = q[Math.max(0, q.length - 16)], b = q[Math.max(1, q.length - 12)]; G.car.place(a[0], a[1], Math.atan2(b[0] - a[0], b[1] - a[1])); G.prevP = G.car.p.slice(); G.cam.snap(); G.ui.bannerEl.className = ''; G.advance(0.6); }); await snap('inf');
  await T('cheksiz: darvoza vaqtni to\'ldiradi', `(()=>{ const A=G.act, res=[]; for(let k=0;k<10;k++){ const g=A.g0; A.limit=A.t+20; G.car.place(g.x,g.z,Math.atan2(g.tx,g.tz)); G.prevP=G.car.p.slice(); G.sim(0.1); res.push([A.gates, G.poyga.lastGate.add]); const gg=A.g0; if(G.T.nearestRoad(gg.x,gg.z,2).d>1) return {ok:false, off:k}; }
    return { ok: A.gates===10 && res.every(r=>r[1]>=6 && r[1]<=45) && A.dist>2500 && document.querySelector('.tc .q-meter') && /Darvozalar/.test(document.querySelector('.tc').textContent), res, dist:Math.round(A.dist) }; })()`);
  await T('cheksiz: qayta boshlash [⌫] — start joyidan', `(()=>{ const s=G.poyga.infDef.start, n0=G.act.gates; G.qulay.restart(); const A=G.act, R=G.T.roads, i=R.edges[s.e].start+s.k; return { ok: !!A && A.def.cat==='cheksiz' && A.gates===0 && n0===10 && Math.hypot(G.car.p[0]-R.x[i],G.car.p[2]-R.z[i])<3, n0 }; })()`);
  await T('cheksiz: haqiqiy haydashda vaqt yetadi (avtopilot, 4 darvoza)', `(()=>{ G.sim(3.6); const A=G.act, left=[]; for(let k=0;k<4;k++){ const n0=A.gates; G.autoPts(A.g0.pts.map(q=>[q[0],q[1]]),26); G.runUntil(()=>!G.act || A.gates>n0, 90); left.push(+(A.limit-A.t).toFixed(1)); if(G.act!==A) break; } G.auto=null;
    return { ok: G.act===A && A.gates===4 && left.every(x=>x>3), left, gates:A.gates }; })()`);
  await T('cheksiz: vaqt tugaydi, natija va rekord', `(()=>{ const A=G.act; for(let k=0;k<5;k++){ const g=A.g0; G.car.place(g.x,g.z,Math.atan2(g.tx,g.tz)); G.prevP=G.car.p.slice(); G.sim(0.1); } const m0=G.state.money; A.limit=A.t+0.3; G.car.v[0]=G.car.v[2]=0; G.sim(1);
    const r=G.lastResult, b=G.state.poyga.inf[G.state.veh.cur]; return { ok: !G.act && r && r.def.cat==='cheksiz' && r.ok && r.stars===1 && /Darvozalar: 9/.test(r.info) && b && b[0]===9 && G.state.money>m0 && !G.state.stars.cheksiz, info:r&&r.info, b, rw:r&&r.reward }; })()`);

  // ---------- 2. Yo'l egasi ----------
  const drive = (key, rev, spd, mx = 120) => `(()=>{ const P=G.poyga; G.ui.close(); G.mode='play'; P.seg.last=null; const pts=G.T.pathByEdges([['${key}',${rev}]]), p0=pts[0], p3=pts[4]; G.car.place(p0[0],p0[1],Math.atan2(p3[0]-p0[0],p3[1]-p0[1])); G.prevP=G.car.p.slice(); G.car.v[0]=G.car.v[2]=0; G.sim(0.5);
    G.autoPts(pts.map(q=>[q[0],q[1]]),${spd}); const t=G.runUntil(()=>!!G.poyga.seg.last, ${mx}); G.auto=null; return { t, last:P.seg.last }; })()`;
  await T("yo'l egasi: bo'lak vaqti yoziladi", `(()=>{ const r=${drive('e13', false, 16)}, L=r.last, rec=G.state.poyga.seg['e13>'], chip=document.getElementById('pg-seg'); return { ok: !!L && L.key==='e13>' && L.t>5 && rec && rec[0]===L.t && rec[1]===G.state.veh.cur && /Bo'lak:/.test(chip.textContent) && /Tegirmonlar/.test(chip.textContent), L, txt:chip.textContent }; })()`);
  await page.evaluate(() => { G.advance(0.05); }); await snap('seg');
  await T("yo'l egasi: sekinroq o'tilsa rekord saqlanadi", `(()=>{ const b0=G.state.poyga.seg['e13>'][0]; const r=${drive('e13', false, 7)}, L=r.last, rec=G.state.poyga.seg['e13>']; return { ok: !!L && L.key==='e13>' && L.t>b0 && rec[0]===b0 && !L.rec && /rekord/.test(document.getElementById('pg-seg').textContent), b0, t:L&&L.t }; })()`);
  await T("yo'l egasi: teskari yo'nalish alohida, chellenj paytida sanalmaydi", `(()=>{ const r=${drive('e13', true, 16)}, L=r.last; const ok1=!!L && L.key==='e13<' && !!G.state.poyga.seg['e13<'];
    const a=G.acts.acts.find(x=>x.cat==='job'&&x.type==='del'); G.startAct(a); const r2=${drive('e13', false, 16, 20)}; G.endAct(false,'cancel'); return { ok: ok1 && !r2.last, L, r2:r2.last }; })()`);
  await T("yo'l egasi: me'yordan tez — «sizniki» va +100 so'm", `(()=>{ const P=G.poyga, k='e13>', m0=G.state.money; let p0; G.state.poyga.seg[k][2]=0; p0=P.par; P.par=(key)=>999; const r=${drive('e13', false, 16)}, rec=G.state.poyga.seg[k]; P.par=p0; return { ok: r.last && r.last.newOwn && rec[2]===1 && G.state.money-m0===100 && G.poyga.owned()>=1 && /sizniki/.test(document.getElementById('pg-seg').textContent), rec }; })()`);

  // ---------- 3. Aylanma poyga ----------
  await T('aylanma: boshlanadi, raqiblar, aylana nazoratlari', `(()=>{ G.poyga.startCirc('h1'); const A=G.act, a=A.def; return { ok: a.id==='h1' && a.type==='race' && A.state==='count' && G.rivals.every(r=>r.active) && a.lapEnd.every(L=>A.cps.includes(L)) && A.lapCp.length===2 && A.cps[A.cps.length-1]===a._p.length-1, cps:A.cps.length, lapCp:A.lapCp }; })()`);
  await page.evaluate(() => { G.sim(3.4); G.sim(2.5); G.ui.bannerEl.className = ''; G.advance(0.05); }); await snap('circ');
  await T('aylanma: aylanalar sanaladi va marra', `(()=>{ const A=G.act, a=A.def, P=G.poyga, s0=G.totalStars(), lapsSeen=[], cups0=G.state.sovrin.cups.h1||0; let n=0;
    while(G.act===A && n<400){ const i=A.cps[A.cpi], q=a._p[i]; G.car.place(q[0],q[1],G.car.yaw); G.prevP=G.car.p.slice(); G.car.v[0]=G.car.v[2]=0; G.sim(0.05); if(G.act===A) lapsSeen.push(A.lapTimes.length); n++; }
    const r=G.lastResult, o=G.state.poyga.circ.h1, lc=P.lastCirc; return { ok: !G.act && r && r.def.id==='h1' && r.ok && r.stars===3 && lc.fin && lc.laps.length===2 && lapsSeen.includes(1) && o.n===1 && o.s===3 && o.lap>0 && o.best>0 && G.totalStars()===s0 && !G.state.stars.h1 && !G.state.best.h1 && (G.state.sovrin.cups.h1||0)===cups0+1 && /eng tez aylana/.test(r.info), info:r&&r.info, o, laps:lc&&lc.laps }; })()`);
  await T('aylanma: qayta poygada mukofot kamayadi, yulduz saqlanadi', `(()=>{ G.ui.close(); G.poyga.startCirc('h1'); const A=G.act; G.sim(3.4); A.t=1e5; let n=0; while(G.act===A && n<400){ const q=A.def._p[A.cps[A.cpi]]; G.car.place(q[0],q[1],0); G.prevP=G.car.p.slice(); G.sim(0.05); n++; } const r=G.lastResult; return { ok: r && r.def.id==='h1' && !r.ok && r.why==='slow' && G.state.poyga.circ.h1.s===3 && G.state.poyga.circ.h1.n===2, why:r&&r.why }; })()`);

  // ---------- 4. Yulduz yo'li ----------
  await T("yulduz yo'li: eski yulduzlar bilan ochiladi va olinadi", `(()=>{ G.ui.close(); const s=G.state, H=G.mahorat; let k=0; for(const a of G.acts.acts){ if(a.cat==='inf') continue; s.stars[a.id]=3; if((k+=3)>=48) break; } const m0=s.money, kit0=s.inv.kit||0;
    const o=H.open(), n=H.claimable(); G.sim(1.1); const chip=document.getElementById('h-yy'); const a=H.claim(0), b=H.claim(1), c=H.claim(3), d=H.claim(0), e=H.claim(5);
    return { ok: o===3 && n===3 && chip.style.display!=='none' && /3/.test(chip.textContent) && a && b && !c && !d && !e && s.money-m0===300 && s.inv.kit===kit0+1 && s.mahorat.yy.length===2 && H.claimable()===1 && H.next().need===12, o, n, money:s.money-m0 }; })()`);
  await T("yulduz yo'li: bosh kiyim, bo'yoq, tekin tyuning", `(()=>{ const s=G.state, H=G.mahorat; let k=G.totalStars(); for(const a of G.acts.acts){ if(a.cat==='inf'||s.stars[a.id]) continue; s.stars[a.id]=3; if((k+=3)>=120) break; } const up0=JSON.stringify(s.up); const r=H.claimAll();
    return { ok: H.open()===8 && r.length===6 && s.hats.includes('kepka') && s.paints.includes('yulduz') && JSON.stringify(s.up)!==up0 && H.claimable()===0, got:r.map(x=>x.text) }; })()`);
  await page.evaluate(() => { G.ui.open('poyga', { tab: 'yy' }); G.advance(0.05); }); await snap('yy');

  // ---------- 5. Transport mahorati ----------
  await T('mahorat: masofa nishoni (haydab)', `(()=>{ G.ui.close(); G.mode='play'; const H=G.mahorat, id=G.state.veh.cur, m=H.rec(id); m.km=9985; const b0=m.b, m0=G.state.money; const r=${drive('e1', false, 18)}; return { ok: (m.b & 1) && !(b0 & 1) && m.km>=10000 && G.state.money-m0>=100 && H.count(id)>=1, km:Math.round(m.km), b:m.b, top:m.top, tb:Math.round(m.tb) }; })()`);
  await T('mahorat: medal nishoni Sovrinlardan, «Usta» belgisi', `(()=>{ const H=G.mahorat, id=G.state.veh.cur, m=H.rec(id); const rad=G.acts.acts.find(x=>x.cat==='radar'); G.tryuk.record(rad, 400, id); const g1=H.check(id); m.dr=3200; m.tb=3100; m.top=999; const m0=G.state.money; const g2=H.check(id);
    return { ok: (m.b & 2) && H.count(id)===5 && m.u===1 && G.state.money-m0>=2*100+400 && /Usta/.test(document.getElementById('banner').textContent), g1, g2 }; })()`);
  await T('mahorat: ustaxona kartasida va oynada', `(()=>{ const pt=G.points.find(p=>p.kind==='garage'); G.ui.gtab=1; G.ui.open('garage', pt); const c=document.querySelector('#screen .mh-line'); const t1=c && c.textContent, sel=document.querySelector('#screen .card.veh.sel .mh-line'); G.ui.open('poyga',{tab:'mah'}); const rows=document.querySelectorAll('.mh-tab tr').length; G.advance(0.05);  return { ok: !!c && /Mahorat/.test(t1) && !!sel && /5\\/5/.test(sel.textContent) && /Usta/.test(sel.textContent) && rows===23, t1, sel:sel&&sel.textContent, rows }; })()`);
  await snap('mah');

  // ---------- 6. Oynalar va tugmalar ----------
  await T("oynalar: taxta, pauza, telefon, [1]", `(()=>{ const out={}; for(const t of ['inf','circ','seg','yy','mah']){ G.ui.open('poyga',{tab:t}); out[t]=document.querySelectorAll('#screen .pg-tabs button').length; }
    G.ui.open('board','bogiston'); const bd=document.querySelector('#screen').textContent; G.ui.open('pause'); const pz=/Poygalar/.test(document.querySelector('#screen').textContent); G.ui.close(); G.mode='play';
    G.phone.open(); const app=document.querySelector('[data-a="app:poyga"]'); if(app) app.click(); const ph=document.querySelector('.ph-scr') && document.querySelector('.ph-scr').textContent; G.ui.close();
    return { ok: Object.values(out).every(n=>n===5) && /Cheksiz poyga/.test(bd) && /Sohil halqasi/.test(bd) && /G'arbiy halqa/.test(bd) && pz && /Yo'l egasi/.test(ph||''), out, ph:(ph||'').slice(0,80) }; })()`);
  await page.keyboard.press('Digit1');
  await T('[1] transportda Poygalar oynasini ochadi', `(()=>{ G.advance(0.02); const r={ ok: G.ui.screenName==='poyga' }; G.ui.close(); return r; })()`);
  await page.evaluate(() => { G.ui.open('poyga', { tab: 'seg' }); G.advance(0.05); }); await snap('segs');

  // ---------- 7. Saqlov ----------
  await T('saqlov: qayta yuklashdan keyin hammasi joyida', `(()=>{ G.ui.close(); window._save(); return { ok: !!localStorage.getItem('safar_save_v2') }; })()`);
  await reload();
  await T('saqlov: rekordlar, aylanma, sovg\'alar, mahorat', `(()=>{ const s=G.state, p=s.poyga, m=s.mahorat, id=s.veh.cur; return { ok: p.inf[id] && p.inf[id][0]===9 && p.seg['e13>'] && p.seg['e13>'][2]===1 && p.seg['e13<'] && p.circ.h1.s===3 && p.circ.h1.n===2 && m.yy.length===8 && m.veh[id].u===1 && m.veh[id].b===31 && G.mahorat.count(id)===5 && G.poyga.circBy.h1.own()===3 && s.paints.includes('yulduz') }; })()`);
  await T("saqlov: eski saqlov (yangi maydonlarsiz) ochiladi", `(()=>{ G.noSave=true; window.onbeforeunload=null; const o=JSON.parse(localStorage.getItem('safar_save_v2')); delete o.poyga; delete o.mahorat; localStorage.setItem('safar_save_v2', JSON.stringify(o)); return { ok:true }; })()`);
  await reload();
  await T("saqlov: eski saqlovda standart qiymatlar, sovg'alar qayta hisoblanadi", `(()=>{ const s=G.state; return { ok: s.poyga && typeof s.poyga.seg==='object' && Array.isArray(s.mahorat.yy) && s.mahorat.yy.length===0 && G.mahorat.claimable()===8 && G.totalStars()>=120 }; })()`);
};
