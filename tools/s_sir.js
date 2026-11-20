// Orol sirlari sinovi: mish-mish (suhbatda chiqadi, ochilmagan sandiqni ko'rsatadi, xarita doirasi, telefon daftari, rost chiqishi), aholi munosabati (tez yaqinlashsa sakraydi,
// drift — olqish, signal — norozilik, zebrada to'xtasangiz — rahmat, qishloqdan sekin o'tish), qazilma (ijara, qazish, cho'tka mini-o'yini — sekin: topilma, tez: sinadi, kunlik chegara,
// muzey javoni), oltin muhr (shartlar, ro'yxat, tekin tez sayohat), kun vaqti (tong baliq, tush chanqoq, tun do'kon yopiq va qo'ng'izlar, erta bozor, shomda choyxona gurungi), saqlov.
// Ishlatish: npm run test:sir (avval npm run build). SHOTS=1 — skrinshotlar (shots/sir_*.jpg)
export default async ({ page, shot: shot0 }) => {
  const SH = !!process.env.SHOTS, shot = async (n) => { if (!SH) return; for (let k = 0; ; k++) { try { return await shot0('sir_' + n); } catch (e) { if (k >= 3) throw e; } } };
  const ready = () => page.waitForFunction('window.__ready === true', null, { timeout: 120000 });
  const reload = async () => { await page.evaluate(() => { window.onbeforeunload = null; }); await page.reload(); await ready(); };
  const T = async (name, expr) => { let r; try { r = await page.evaluate(expr); } catch (e) { r = { ok: false, err: e.message }; } const ok = r && r.ok !== false; console.log(`TEST sir ${name} ${ok ? 'OK' : 'FAIL'}`, JSON.stringify(r).slice(0, 500)); return r; };
  await ready();
  await page.evaluate(() => { localStorage.clear(); }); await reload();
  const helpers = `window.press = (c) => { G.input.pressed.add(c); G.advance(1 / 60); }; window.go = (x, z, yaw = 0) => { G.player.place(x, z, yaw); G.sim(0.3); }; G.state.money = 50000; G.hour = 10; G.freezeTime = true; G.sim(0.2); 1`;
  await page.evaluate(helpers);

  // ---------- 1. Mish-mishlar ----------
  await T("mish-mish: suhbatda aytiladi", `(()=>{ const npcs=G.live._dbg.npcs, o=npcs.find(q=>q.role==='talk' && !(G.topshiriq.offerOf(q))&&q.place==='bogiston')||npcs.find(q=>q.role==='talk'); G.live.dismount(true); go(o.x+1.2,o.z+1.2); G.sir.forceNext=true; G.live.chat(o); const D=G.hayot.dlg, last=D&&D.lines[D.lines.length-1]; const txt=document.getElementById('dlg').textContent;
    const S=G.state.sir; window._npc=o; return { ok: !!D && /eshitdingizmi/.test(last) && /\\/\\d/.test(txt) && S.rumN===1 && S.rlog.length===1, last, n:S.rumN }; })()`);
  await page.evaluate(() => { const D = G.hayot.dlg; D.i = D.lines.length - 1; G.hayot.drawDlg(); const o = window._npc; G.cam.snap(); G.advance(0.3); }); await shot('rumour_dialog');
  await T("mish-mish: ochilmagan sandiqqa ishora, doira ichida", `(()=>{ while(G.hayot.dlg) G.hayot.nextDlg(); const S=G.state.sir; S.rum.length=0; const o=window._npc; const g=G.sir.add(G.sir.make(o.x,o.z,'chest'), o.name); const q=S.rum[S.rum.length-1], c=G.pick.chests[q.ref];
    return { ok: q.k==='chest' && !G.state.chests.includes(q.ref) && Math.hypot(c.x-q.x,c.z-q.z) <= q.r && /sandiq/.test(q.txt), ref:q.ref, d:Math.round(Math.hypot(c.x-q.x,c.z-q.z)), r:q.r, txt:q.txt }; })()`);
  await T("mish-mish: tanga, joy, tadbir, ob-havo turlari", `(()=>{ const o=window._npc, S=G.state.sir; const ks=['coins','place','event','weather','night'].map(k=>{ const g=G.sir.make(o.x,o.z,k); return g ? k+':'+(g.x!=null) : k+':-'; });
    const cl=G.sir.make(o.x,o.z,'coins'); const C=G.sir.clusters.find(c=>c.i===cl.ref); const inC=Math.hypot(C.x-cl.x,C.z-cl.z)<=cl.r && C.ids.some(i=>!G.state.coins.includes(i));
    const pl=G.sir.make(o.x,o.z,'place'); return { ok: inC && !!pl && !G.state.places[pl.ref] && ks.length===5 && !ks.includes('event:-') && !ks.includes('weather:-'), ks }; })()`);
  await T("mish-mish: ko'pi bilan 3 ta faol", `(()=>{ const o=window._npc, S=G.state.sir; for (let i=0;i<4;i++) G.sir.add(G.sir.make(o.x,o.z,'chest'), o.name); return { ok: S.rum.length===3 && S.rum.every(q=>q.k==='chest'), n:S.rum.length }; })()`);
  await T("mish-mish: xaritada doira va telefon daftari", `(()=>{ G.ui.open('map'); const lg=document.querySelector('.legend').textContent; G.ui.close(); G.phone.open('mish'); const t=document.querySelector('.ph-scr').textContent; const S=G.state.sir; return { ok: /Mish-mish/.test(lg) && t.includes(S.rum[0].txt.slice(0,30)) && /Daftar/.test(t) && /Hozir/.test(t), lg:lg.slice(-80) }; })()`);
  await page.evaluate(() => { G.ui.close(); G.ui.open('map'); }); await shot('rumour_map'); await page.evaluate(() => G.ui.close());
  await T("mish-mish: sandiq topilsa — rost chiqdi", `(()=>{ const S=G.state.sir, q=S.rum[S.rum.length-1], c=G.pick.chests[q.ref], m0=G.state.money, ok0=S.rumOk||0; G.live.mount(true); G.car.place(c.x,c.z,0); G.prevP=G.car.p.slice(); G.sim(0.3); G.sim(1.2); G.ui.close();
    return { ok: G.state.chests.includes(q.ref) && !S.rum.includes(q) && S.rumOk===ok0+1 && G.state.income.some(r=>r[1]==='Mish-mish rost chiqdi'), rumOk:S.rumOk }; })()`);

  // ---------- 2. Aholi munosabati ----------
  await T("munosabat: tez yaqinlashsa chetga sakraydi va baqiradi", `(()=>{ const npcs=G.live._dbg.npcs, o=npcs.find(q=>q.place==='karyer')||npcs[5]; const R=G.state.sir.react, s0=R.scared, h0=G.state.hurmat=5; G.live.mount(true);
    const yaw=0.7, dx=Math.sin(yaw), dz=Math.cos(yaw); G.car.place(o.x-dx*26,o.z-dz*26,yaw); G.prevP=G.car.p.slice(); G.cam.snap(); G.sim(0.2); G.car.v=[dx*17,0,dz*17]; let moved=0, bub=0;
    for (let i=0;i<40 && R.scared===s0;i++) G.sim(1/30); for(let i=0;i<8;i++){ G.advance(1/30); moved=Math.max(moved,Math.hypot(o.rig.root.position.x-o.x,o.rig.root.position.z-o.z)); bub=Math.max(bub,[...document.querySelectorAll('.sir-bub')].filter(e=>e.style.display==='block').length); }
    window._o=o; return { ok: R.scared===s0+1 && moved>0.3 && G.munosabat.last.kind==='bad' && G.state.hurmat<h0, moved:+moved.toFixed(2), say:G.munosabat.last.text, hurmat:G.state.hurmat, bub }; })()`);
  await page.evaluate(() => { const o = window._o; G.car.v = [0, 0, 0]; const R = G.state.sir.react; const p = G.munosabat.people().find((q) => q.o === o); G.munosabat.jump(p, 1, 0.4); G.munosabat.react(p, 'scared'); G.advance(0.12); const y = o.y; G.view(o.x + 7, y + 3, o.z + 6, o.x, y + 1.2, o.z); G.advance(0.05); G.view(o.x + 7, y + 3, o.z + 6, o.x, y + 1.2, o.z); }); await shot('reaction');
  await T("munosabat: drift tugasa — olqish", `(()=>{ const o=window._o, R=G.state.sir.react, c0=R.cheer; G.sim(6); G.car.place(o.x+14,o.z+8,0); G.prevP=G.car.p.slice(); G.sim(0.2); G.driftScore=640; G.sim(0.05); G.driftScore=0; G.sim(0.2); return { ok: R.cheer>c0 && G.munosabat.last.kind==='good', cheer:R.cheer-c0, say:G.munosabat.last.text }; })()`);
  await T("munosabat: signalni ko'p chalsangiz — norozilik", `(()=>{ const R=G.state.sir.react, f0=R.frown; G.sim(7); for(let i=0;i<5;i++){ G.audio.ready=G.audio.ready; G.munosabat.horn(); } G.sim(0.2); return { ok: R.frown>f0 && /quloq|Signal|Tinchlik|nima gap/i.test(G.munosabat.last.text), say:G.munosabat.last.text }; })()`);
  await T("munosabat: zebrada to'xtasangiz — rahmat", `(()=>{ const n=G.T.roads.nodeBy.vil; G.car.place(n.x-30,n.z+6,1.4); G.prevP=G.car.p.slice(); G.sim(1.5); const W=G.shahar.walkers.filter(w=>w.vis && w.rig.root.visible); if(!W.length) return {ok:false, none:1}; const w=W[0], R=G.state.sir.react, t0=R.thanks;
    G.car.place(w.x+9,w.z+4,0); G.prevP=G.car.p.slice(); G.car.v=[0,0,0]; w.cross={ax:w.x,az:w.z,bx:w.x+8,bz:w.z,len:8,t:0.2}; G.sim(0.3); return { ok: R.thanks>t0, thanks:R.thanks-t0, say:G.munosabat.last.text }; })()`);
  await T("munosabat: qishloqdan sekin o'tish — kuniga bir rahmat", `(()=>{ const S=G.state.sir, o=G.live._dbg.npcs.find(q=>q.place==='mayoq'); S.rep.slow=-1; const k0=G.state.karma; G.car.place(o.x-5,o.z-4,0.6); G.prevP=G.car.p.slice(); G.car.v=[2.5,0,3.5]; G.sim(0.25); const a=S.react.slow; G.car.v=[2.5,0,3.5]; G.sim(0.25);
    return { ok: S.rep.slow===G.state.dunyo.day && a>=1 && S.react.slow===a && G.state.karma>k0, slow:S.react.slow }; })()`);

  // ---------- 3. Qazilma maydoni ----------
  await T("qazilma: ijara va qazish", `(()=>{ const Q=G.qazilma, a=Q.arx.root.position; G.live.dismount(true); go(a.x+1.2,a.z+0.6); const pr=G.live.prompt; press('KeyE'); const scr=G.ui.screenName; const b=document.querySelector('[data-a="rent"]'); b.click(); const rented=Q.rented(); G.ui.close();
    const [x,z]=Q.cellXZ(0); go(x+0.4,z+0.3); const p2=G.live.prompt; press('KeyE'); G.sim(2.2); return { ok: /Nodira/.test(pr) && scr==='qazilma' && rented && /Qazish/.test(p2) && G.state.sir.dig.cells[0]===1 && Q.left()===3, pr, p2, left:Q.left() }; })()`);
  await T("qazilma: sekin silash — topilma butun", `(()=>{ const Q=G.qazilma, S=G.state.sir, k=Q.FINDS[Q.findOf(S.dig.layer,0)][0], n0=S.finds[k]||0; const p=G.live.prompt; press('KeyE'); const st=!!Q.brush; let n=0; while(Q.brush && n<30){ press('KeyE'); G.sim(0.7); n++; }
    return { ok: /Cho'tka/.test(p) && st && !Q.brush && S.finds[k]===n0+1 && S.dig.cells[0]===2 && !S.broken, k, strokes:n }; })()`);
  await page.evaluate(() => { const Q = G.qazilma, [x, z] = Q.cellXZ(6); Q.dig(6, true); go(x + 0.4, z + 0.5, 0); Q.startBrush(6); Q.stroke(); G.sim(0.7); Q.stroke(); G.sim(0.7); Q.stroke(); const y = G.T.ground(x, z, 1e9).y; G.view(x + 4.5, y + 3.2, z + 5, x, y + 0.5, z); }); await shot('dig');
  await T("qazilma: tez-tez silash — topilma sinadi", `(()=>{ const Q=G.qazilma, S=G.state.sir; let n=0; while(Q.brush && n<30){ Q.stroke(); n++; } return { ok: !Q.brush && S.broken===1 && S.dig.cells[6]===2, strokes:n, broken:S.broken }; })()`);
  await T("qazilma: kunlik chegara, devorlar ochiladi", `(()=>{ const Q=G.qazilma, S=G.state.sir, D=S.dig; Q.dig(12,true); Q.dig(13,true); const lim=!Q.dig(14,true) && Q.left()===0; D.day=-5; const nd=Q.left()===4; for(let i=0;i<25;i++) if(D.cells[i]!==2) D.cells[i]=2; D.cells[24]=1; Q.draw(); const [x4,z4]=Q.cellXZ(24); go(x4+0.3,z4+0.3);
    Q.startBrush(24); let n=0; while(Q.brush&&n<30){ Q.stroke(); G.sim(0.7); n++; } return { ok: lim && nd && D.layer===1 && D.cells.every(c=>c===0) && G.state.income.some(r=>r[1]==='Qazilma qatlami'), layer:D.layer }; })()`);
  await T("qazilma: muzey javoni", `(()=>{ const Q=G.qazilma, S=G.state.sir, k=Object.keys(S.finds).find(f=>S.finds[f]>0), m0=G.state.money, h0=G.state.hurmat; const m=Q.museum; go(m.x-2.2,m.z); const pr=G.live.prompt; press('KeyE'); const scr=G.ui.screenName; const b=document.querySelector('[data-a="don:'+k+'"]'); b.click(); G.ui.close();
    return { ok: /Muzey/.test(pr) && scr==='muzey' && S.museum[k]===1 && G.state.money>m0 && G.state.hurmat>h0, k, pr }; })()`);
  await T("qazilma: javon to'lsa — Arxeolog", `(()=>{ const Q=G.qazilma, S=G.state.sir; for (const f of Q.FINDS) { if (!S.museum[f[0]]) { S.finds[f[0]]=(S.finds[f[0]]||0)+1; Q.donate(f[0]); } } return { ok: S.arx===1 && Object.keys(S.museum).length===8 && G.state.income.some(r=>r[1]==="Muzey to'ldi") }; })()`);
  await page.evaluate(() => { const m = G.qazilma.museum, y = G.T.ground(m.x, m.z, 1e9).y; G.ui.close(); G.view(m.x - 5.5, y + 2, m.z + 1.5, m.x, y + 1.3, m.z); }); await shot('museum');

  // ---------- 4. Oltin muhr ----------
  await T("oltin muhr: shartlar va mukofot", `(()=>{ const R=G.sir, S=G.state.sir, id='muzkol', st=G.state, C=R.COLL[id]; st.places[id]=1; G.live.mount(true);
    for (const a of G.acts.byPlace[id]) if(a.cat!=='inf') st.stars[a.id]=3; const n1=R.need(id); for (const i of C.coins) { const c=G.pick.coins[i]; G.car.place(c.x,c.z,0); G.prevP=G.car.p.slice(); G.sim(0.05); } for (const i of C.chests) { const c=G.pick.chests[i]; G.car.place(c.x,c.z,0); G.prevP=G.car.p.slice(); G.sim(0.05); } G.ui.close();
    const n2=R.need(id), g0=R.checkGold().length; const E=G.topshiriq; E.cur={o:{place:id,name:'Sinov'}}; R.trackErr(); E.cur=null; st.errands.done=(st.errands.done||0)+1; R.trackErr(); const m0=st.money; const got=R.checkGold();
    return { ok: !n1.ok && n2.s3===n2.acts && n2.got===n2.tot && !n2.err && g0===0 && S.err[id]===1 && got[0]===id && st.money===m0+1500 && R.freeTravel(id) && R.goldN()===1, n2 }; })()`);
  await T("oltin muhr: ro'yxat va telefon", `(()=>{ G.ui.close(); G.ui.open('muhrlar'); const t=document.querySelector('#screen').textContent; const n=document.querySelectorAll('.sr-p.gold').length; G.ui.close(); G.phone.open('muhr'); const p=document.querySelector('.ph-scr').textContent; G.ui.close(); G.ui.open('progress'); const pb=[...document.querySelectorAll('#screen button')].some(b=>/Oltin muhrlar · 1\\//.test(b.textContent));
    return { ok: /1 \\/ 15/.test(t) && n===1 && /Muzko/.test(p) && pb && /Aholi topshirig/.test(t), n, pb }; })()`);
  await page.evaluate(() => { G.ui.close(); G.ui.open('muhrlar'); }); await shot('seal_list');
  await page.evaluate(() => { G.ui.close(); G.ui.open('map'); }); await shot('seal_map');
  await T("oltin muhr: tez sayohat tekin", `(()=>{ const id='muzkol', p=G.site.places[id], cv=document.getElementById('mapc'), r=cv.getBoundingClientRect(); const ev=new MouseEvent('click',{clientX:r.left+(p.x+G.T.HALF)/G.T.SIZE*r.width, clientY:r.top+(p.z+G.T.HALF)/G.T.SIZE*r.height, bubbles:true}); cv.dispatchEvent(ev);
    const b=[...document.querySelectorAll('#mapinfo button')].find(e=>/Tez sayohat/.test(e.textContent)); const t=b&&b.textContent; G.setWaypoint(null); G.ui.close(); return { ok: /tekin/.test(t||''), t }; })()`);

  // ---------- 5. Kun vaqti ----------
  await T("kun vaqti: davrlar va o'zgaruvchilar", `(()=>{ const R=G.sir; const ids=[6,10,13,17,19,23,3].map(h=>R.periodAt(h)[0]).join(','); const m6=R.mods(6), m13=R.mods(13), m23=R.mods(23), m19=R.mods(19);
    return { ok: ids==='tong,kun,tush,peshin,shom,tun,tun' && m6.fishK===0.5 && m13.thirstK>1 && !m23.shopsOpen && m23.fireflies && m19.rumK>1 && m13.shopsOpen, ids }; })()`);
  await T("kun vaqti: tongda baliq tez ilinadi", `(()=>{ const L=G.live, pl=G.player; G.live.dismount(true); G.hour=6; pl.emote='fish'; L.fishing={ph:0,t:4,w:{x:pl.p[0]+3,y:pl.p[1],z:pl.p[2]}}; G.sim(1/60); const t6=L.fishing&&L.fishing.t; L.fishing=null; pl.emote=null; G.hour=10; pl.emote='fish'; L.fishing={ph:0,t:4,w:{x:pl.p[0]+3,y:pl.p[1],z:pl.p[2]}}; G.sim(1/60); const t10=L.fishing&&L.fishing.t; L.fishing=null; pl.emote=null;
    return { ok: t6<2.1 && t10>3.9, t6:+t6.toFixed(2), t10:+t10.toFixed(2) }; })()`);
  await T("kun vaqti: tush jaziramasida cho'lda chanqoq tez", `(()=>{ const s=G.qazilma.site, st=G.state; go(s.x+30,s.z+30); G.hour=10; st.thirst=90; G.sim(10); const a=90-st.thirst; G.hour=13.5; st.thirst=90; G.sim(10); const b=90-st.thirst; return { ok: b>a*1.8, a:+a.toFixed(2), b:+b.toFixed(2) }; })()`);
  await T("kun vaqti: tunda do'kon yopiq, kunduzi ochiq", `(()=>{ const HY=G.hayot, sh=HY.shops[0]; G.hour=23.5; HY.enterShop(sh); const n=G.interior.inside; G.hour=10; HY.enterShop(sh); const d=G.interior.inside; G.interior.exit(); G.sim(0.2); return { ok: !n && d==='shop', n, d }; })()`);
  await T("kun vaqti: bozor tongda ochiladi", `(()=>{ const st=G.state, E=G.tadbir, d0=st.dunyo.day; let d=d0; while(!E.today(d).includes('bozor')||E.today(d).includes('navruz')) d++; st.dunyo.day=d; G.hour=5.5; const a=E.isActive('bozor'); G.hour=4.5; const b=E.isActive('bozor'); st.dunyo.day=d0; G.hour=10; return { ok: a && !b, d }; })()`);
  await T("kun vaqti: tunda yaltiroq qo'ng'izlar — tutish", `(()=>{ const h=G.site.places.uy.home; G.dunyo.set('ochiq'); go(h.x+40,h.z-30); G.hour=22; G.sim(0.5); const n=G.sir.flies.filter(f=>f.on).length; const f=G.sir.flies.find(f=>f.on); go(f.x+0.5,f.z+0.4); f.x=G.player.p[0]+0.6; f.z=G.player.p[2]+0.3; f.y=G.player.p[1]+1; G.sim(0.05); const pr=G.live.prompt; const f0=G.state.sir.fire; press('KeyE'); G.sim(0.9);
    return { ok: n>10 && /qo'ng'iz/.test(pr) && G.state.sir.fire===f0+1, n, pr }; })()`);
  await page.evaluate(() => { const p = G.player.p, f = G.sir.flies; for (let i = 0; i < f.length; i++) { const a = i * 0.9, d = 2 + (i % 7) * 1.2; f[i].x = p[0] + Math.cos(a) * d; f[i].z = p[2] + 4 + Math.sin(a) * d; f[i].y = G.T.ground(f[i].x, f[i].z, 1e9).y + 0.6 + (i % 4) * 0.35; f[i].on = true; } G.hour = 22.5; G.sim(0.1); const y = p[1]; G.view(p[0] - 3, y + 1.8, p[2] - 4, p[0], y + 1, p[2] + 4, 22.5); G.advance(0.05); G.view(p[0] - 3, y + 1.8, p[2] - 4, p[0], y + 1, p[2] + 4, 22.5); }); await shot('fireflies');
  await T("kun vaqti: shomda choyxonada gurung", `(()=>{ G.hour=10; G.sim(0.1); const b=G.hayot2.bld.find(q=>q.kind==='cafe'); go(b.x,b.z,b.yaw+Math.PI); G.hayot2.enter(b); G.sim(0.3); const ins=G.interior.inside; G.hour=19; G.player.sit=true; const n0=G.state.sir.rumN; G.sim(42); G.player.sit=true; G.sim(1); const n1=G.state.sir.rumN; G.player.sit=false; G.interior.exit(); G.sim(0.2); G.hour=10;
    return { ok: ins==='cafe' && n1>n0, ins, n0, n1 }; })()`);

  // ---------- 6. Saqlov ----------
  await T("saqlov: yoziladi", `(()=>{ G.save(); const s=JSON.parse(localStorage.getItem('safar_save_v2')).sir; window._snap=JSON.stringify([s.gold, s.museum, s.finds, s.dig.layer, s.dig.cells, s.fire, s.rum.length, s.rumN, s.react.scared, s.err]); return { ok: !!s && s.arx===1 && s.dig && Object.keys(s.gold).length===1 }; })()`);
  const snap = await page.evaluate(() => window._snap);
  await reload(); await page.evaluate(helpers);
  await T("saqlov: qayta yuklangach tiklanadi", `(()=>{ const s=G.state.sir; const now=JSON.stringify([s.gold, s.museum, s.finds, s.dig.layer, s.dig.cells, s.fire, s.rum.length, s.rumN, s.react.scared, s.err]); const vis=G.qazilma && Object.keys(s.museum).length===8;
    return { ok: now===${JSON.stringify(snap)} && vis && G.sir.goldN()===1 && G.sir.freeTravel('muzkol'), now:now.slice(0,200) }; })()`);
  await T("saqlov: eski saqlovda sir maydoni yo'q — standart", `(()=>{ G.save=()=>{}; const raw=JSON.parse(localStorage.getItem('safar_save_v2')); delete raw.sir; localStorage.setItem('safar_save_v2', JSON.stringify(raw)); return { ok:true }; })()`);
  await reload();
  await T("saqlov: eski saqlov ochiladi", `(()=>{ const s=G.state.sir; return { ok: Array.isArray(s.rum) && s.dig && s.dig.cells.length===25 && G.sir.goldN()===0 && typeof G.sir.need('bogiston').acts==='number' }; })()`);
};
