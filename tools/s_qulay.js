// Qulayliklar sinovi: «Birinchi safar» (yangi saqlovda bor, eskisida yo'q), bir martalik maslahat, yulduz chegaralari, tezkor qayta boshlash, interfeys o'lchami,
// saqlov kodi/fayli (aylanma, buzilgan kod rad etiladi), zaxira va tiklash, kunlik uchlik, yutuqlar. Ishlatish: npm run test:qulay (avval npm run build). SHOTS=1 — skrinshotlar
import fs from 'node:fs';
export default async ({ page, shot }) => {
  const ready = () => page.waitForFunction('window.__ready === true', null, { timeout: 120000 });
  const reload = async () => { await page.evaluate(() => { window.onbeforeunload = null; }); await page.reload(); await ready(); };
  const T = async (name, expr) => { let r; try { r = await page.evaluate(expr); } catch (e) { r = { ok: false, err: e.message }; } const ok = r && r.ok !== false; console.log(`TEST ${name} ${ok ? 'OK' : 'FAIL'}`, JSON.stringify(r).slice(0, 400)); return r; };
  const SH = !!process.env.SHOTS, snap = async (n) => { if (SH) await shot('q_' + n); };
  await ready();
  await page.evaluate(() => { G.save = () => {}; localStorage.clear(); }); await reload();

  // ---------- 1. Birinchi safar: yangi saqlovda ----------
  await T('yo\'riqnoma: yangi saqlovda yoqiladi', `(()=>{ const q=G.state.qulay; G.qulay.live=true; G.sim(0.1); const c=document.querySelector('.q-card:not(.tip)'); return { ok: q.guide===1 && c && c.style.display!=='none' && /Birinchi safar · 1\\/8/.test(c.textContent), guide:q.guide, txt:c&&c.textContent.slice(0,60) }; })()`);
  await page.evaluate(() => { G.advance(0.1); }); await snap('guide');
  await T("yo'riqnoma: qadamlar bajarilganda o'tadi", `(()=>{ const s=G.state, q=s.qulay, path=[]; const m0=s.money;
    s.stats.dist+=120; G.sim(0.05); path.push(q.guide);                          // 1 → 2 (haydash)
    G.ui.open('map'); G.sim(0.05); path.push(q.guide);                            // 2 → 3 (xarita)
    G.sim(0.05); const way=!!G.way; const b=G.points.filter(p=>p.kind==='board').sort((a,c)=>Math.hypot(a.x-G.site.places.uy.home.x,a.z-G.site.places.uy.home.z)-Math.hypot(c.x-G.site.places.uy.home.x,c.z-G.site.places.uy.home.z))[0];
    G.car.place(b.x+8,b.z+8,0); G.prevP=G.car.p.slice(); G.sim(0.05); path.push(q.guide); // 3 → 4 (qishloq)
    G.ui.open('board', b.place); G.sim(0.05); path.push(q.guide);                 // 4 → 5 (taxta)
    const a=G.acts.acts.find(x=>x.cat==='job'); G.startAct(a); G.endAct(true,'done',2,'sinov'); G.ui.close(); G.sim(0.05); path.push(q.guide); // 5 → 6 (pul)
    G.live.dismount(true); G.sim(0.05); path.push(q.guide);                      // 6 → 7 (tushish)
    G.live.count('shake'); G.sim(0.05); path.push(q.guide);                      // 7 → 8 (piyoda ish)
    G.live.mount(true); G.sim(0.05); path.push(q.guide);                         // 8 → tugadi
    const c=document.querySelector('.q-card:not(.tip)'); const inc=s.income.find(r=>r[1]==='Birinchi safar');
    return { ok: path.join(',')==='2,3,4,5,6,7,8,99' && way && !!inc && inc[2]===300 && c.style.display==='none', path, way, inc }; })()`);

  // ---------- 2. Maslahat: bir marta ----------
  await T('maslahat: bir marta chiqadi va eslab qolinadi', `(()=>{ const q=G.state.qulay; q.tipsOff=false; for (const t of G.qulay.TIPS) q.tips[t[0]]=1; delete q.tips.money; G.state.money=2500; G.sim(7); const c=document.querySelector('.q-card.tip'), shown=c.style.display!=='none' && /Pul yig/.test(c.textContent);
    c.querySelector('[data-q=tipok]').click(); G.sim(25); const again=c.style.display!=='none'; return { ok: shown && !again && q.tips.money===1, shown, again }; })()`);
  await page.evaluate(() => { G.qulay.showTip('night'); G.advance(0.05); }); await snap('tip');
  await T("maslahat: sozlamada o'chiriladi", `(()=>{ const q=G.state.qulay; G.qulay.closeTip(); q.tipsOff=true; delete q.tips.money; G.sim(30); const c=document.querySelector('.q-card.tip'); const r={ ok: c.style.display==='none' && !q.tips.money }; q.tipsOff=false; q.tips.money=1; return r; })()`);

  // ---------- 3. Yulduz chegaralari ----------
  await T('yulduz chegaralari: poyga', `(()=>{ const a=G.acts.acts.find(x=>x.cat==='race'&&!x.opt.final); G.startAct(a); G.act.state='run'; G.act.t=5; G.sim(0.05); const m=document.querySelector('.tc .q-meter'); const r={ ok: !!m && m.querySelectorAll('.q-mb>b').length===3 && /Oltin uchun yana/.test(m.textContent), t:m&&m.textContent }; return r; })()`);
  await page.evaluate(() => { G.advance(0.05); }); await snap('stars_race');
  await T('yulduz chegaralari: yetkazish (vaqt bo\'yicha)', `(()=>{ G.endAct(false,'cancel'); const a=G.acts.acts.find(x=>x.cat==='job'&&x.type==='del'); G.retry(a); G.sim(1); const s=G.qulay.stars(G.act), m=document.querySelector('.tc .q-meter'); return { ok: !!m && s.now===3 && s.marks.length===3 && /3 yulduz uchun yana/.test(m.textContent), t:m&&m.textContent }; })()`);
  await T('yulduz chegaralari: mo\'rt yuk (daraja bo\'yicha)', `(()=>{ G.endAct(false,'cancel'); const a=G.acts.acts.find(x=>x.cat==='job'&&x.type==='frag'); if(!a) return {ok:true, skip:1}; G.retry(a); G.act.cargo=60; G.sim(0.05); const s=G.qulay.stars(G.act); return { ok: s.now===2 && s.marks.length===2 && /Yuk/.test(s.text), text:s.text }; })()`);
  await T('yulduz chegaralari: drift (ochko bo\'yicha)', `(()=>{ G.endAct(false,'cancel'); const a=G.acts.acts.find(x=>x.type==='drift'), pl=G.site.places[a.place]; G.car.place(pl.x+4,pl.z+4,0); G.prevP=G.car.p.slice(); G.startAct(a); G.act.score=a.thr[1]+10; G.sim(0.05); const s=G.qulay.stars(G.act); const old=[...document.querySelectorAll('.tc .ln')].some(e=>/^★ /.test(e.textContent)); return { ok: s.now===2 && /3 yulduz uchun yana/.test(s.text) && !old, text:s.text }; })()`);
  await page.evaluate(() => { G.advance(0.05); }); await snap('stars_drift');

  // ---------- 4. Tezkor qayta boshlash ----------
  await page.evaluate(() => { G.endAct(false, 'cancel'); const a = G.acts.acts.find((x) => x.cat === 'job' && x.type === 'del'); G.retry(a); G.sim(4); window._rs = { id: a.id, t: G.act.t }; });
  await T('qayta boshlash: tugma ekranda', `(()=>{ const b=[...document.querySelectorAll('#h-bar .ab')].find(e=>/Qayta boshlash/.test(e.textContent)); return { ok: !!b && b.dataset.code==='Backspace' }; })()`);
  await page.keyboard.press('Backspace');
  await T('qayta boshlash: [⌫] chellenjni boshidan boshlaydi', `(()=>{ G.sim(0.05); const A=G.act; return { ok: !!A && A.def.id===window._rs.id && A.t<0.5 && window._rs.t>3 && G.qulay.restarts===1, t:A&&A.t }; })()`);
  await T('qayta boshlash: pauza menyusida', `(()=>{ G.ui.open('pause'); const b=[...document.querySelectorAll('#screen button')].find(e=>/qayta boshlash/i.test(e.textContent)); b.click(); const r={ ok: !!G.act && G.qulay.restarts===2 && !G.ui.screenName }; G.endAct(false,'cancel'); return r; })()`);

  // ---------- 8. Kunlik uchlik ----------
  const bump = `const bump=(t)=>{ const s=G.state, q=s.qulay, n=t.goal; if(t.id==='km') s.stats.dist+=n*1000+10; else if(t.id==='win') q.win+=n; else if(t.id==='star'){ let k=0; for(const a of G.acts.acts){ if(k>=n) break; if(a.cat!=='inf' && !(s.stars[a.id]>0)){ s.stars[a.id]=1; k++; } } } else if(t.id==='visit') q.day.vis=1; else if(t.id==='non'||t.id==='dala'){ s.jobs[t.id]=s.jobs[t.id]||{n:0,best:0,earn:0}; s.jobs[t.id].n+=n; } else { const k={drift:'driftc'}[t.id]||t.id; s.cnt[k]=(s.cnt[k]||0)+n; } };`;
  await T('kunlik uchlik: kun bo\'yicha bir xil', `(()=>{ const Y=G.yutuq, q=G.state.qulay; Y.dayOverride=500; q.day=null; const a=JSON.stringify(Y.day().list.map(t=>[t.id,t.goal,t.rw,t.place])); q.day=null; const b=JSON.stringify(Y.day().list.map(t=>[t.id,t.goal,t.rw,t.place])); Y.dayOverride=501; q.day=null; const c=JSON.stringify(Y.day().list.map(t=>[t.id,t.goal,t.rw,t.place])); Y.dayOverride=500; q.day=null; Y.day(); return { ok: a===b && a!==c && Y.day().list.length===3, a, c }; })()`);
  await T('kunlik uchlik: bajariladi, sandiq va ketma-ketlik', `(()=>{ ${bump} const Y=G.yutuq, s=G.state, q=s.qulay; q.last=-1; q.streak=0; const m0=s.money, g0=s.inv.gem||0; const D=Y.day(); D.list.forEach(bump); G.sim(1.2); const ok1=D.list.every(t=>t.done) && D.chest===1 && q.streak===1 && (s.inv.gem||0)===g0+1;
    Y.dayOverride=501; q.day=null; const D2=Y.day(); D2.list.forEach(bump); G.sim(1.2); return { ok: ok1 && D2.chest===1 && q.streak===2 && q.chests>=2 && s.money>m0+800, streak:q.streak, money:s.money-m0, list:D.list.map(t=>t.id) }; })()`);
  await T('kunlik uchlik: almashtirish kuniga bir marta', `(()=>{ const Y=G.yutuq, q=G.state.qulay; Y.dayOverride=502; q.day=null; const D=Y.day(), id0=D.list[1].id; const a=Y.swap(1), b=Y.swap(2); return { ok: a && !b && D.list[1].id!==id0 && D.swap===1, id0, id1:D.list[1].id }; })()`);
  await T('kunlik uchlik: telefonda va HUDda', `(()=>{ G.ui.close(); G.phone.open(); const app=document.querySelector('[data-a="app:kun3"]'); app.click(); const t=document.querySelector('.ph-scr').textContent; G.ui.close(); G.sim(1.1); const chip=document.getElementById('h-kun'); return { ok: /Kunlik uchlik/.test(t) && /sandi/.test(t) && chip && /\\/3/.test(chip.textContent), chip:chip&&chip.textContent }; })()`);

  // ---------- 9. Yutuqlar ----------
  await T('yutuq: shart bajarilganda ochiladi', `(()=>{ const s=G.state, q=s.qulay; delete q.ach.plant10; s.cnt.plant=10; const m0=s.money; const n=G.yutuq.check(); G.sim(0.05); const b=document.getElementById('banner').textContent; return { ok: q.ach.plant10>0 && n.some(a=>a[0]==='plant10') && s.money-m0>=100 && /Bog'bon|yutuq/i.test(b), banner:b }; })()`);
  await page.keyboard.press('Digit9');
  await T('yutuqlar daftari: [9] oynasi', `(()=>{ G.advance(0.02); return { ok: G.ui.screenName==='yutuqlar', n:document.querySelectorAll('.yt-a').length }; })()`);
  await T('yutuqlar daftari: 60+ nishon, maqol, yashirinlar', `(()=>{ G.ui.open('yutuqlar',{tab:'ach'}); const n=document.querySelectorAll('.yt-a').length, on=document.querySelectorAll('.yt-a.on em').length, hid=[...document.querySelectorAll('.yt-a')].filter(e=>/Yashirin/.test(e.textContent)).length; return { ok: n>=60 && on>=1 && hid>=3, n, on, hid }; })()`);
  await page.evaluate(() => { G.advance(0.05); }); await snap('book');
  await page.evaluate(() => { G.ui.open('yutuqlar', { tab: 'kun' }); G.advance(0.05); }); await snap('daily');

  // ---------- 5. Interfeys o'lchami ----------
  await T("interfeys o'lchami: sozlamada tanlanadi", `(()=>{ G.ui.open('settings',{back:'pause'}); document.querySelector('[data-ui="130"]').click(); const z=getComputedStyle(document.getElementById('hud')).zoom; return { ok: G.state.set.ui===130 && Math.abs(parseFloat(z)-1.3)<0.01, z }; })()`);
  await page.evaluate(() => { G.advance(0.05); }); await snap('settings130');
  await page.evaluate(() => { G.ui.close(); G.sim(0.05); G.advance(0.05); }); await snap('hud130');
  await page.evaluate(() => { G.save(); }); await reload();
  await T("interfeys o'lchami: qayta yuklangandan keyin saqlanadi", `(()=>{ return { ok: G.state.set.ui===130 && Math.abs(parseFloat(getComputedStyle(document.getElementById('hud')).zoom)-1.3)<0.01 && G.state.qulay.guide===99, ui:G.state.set.ui, guide:G.state.qulay.guide }; })()`);
  await page.evaluate(() => { G.state.set.ui = 100; G.qulay.applyScale(); G.save(); });

  // ---------- 6. Saqlovni ko'chirish ----------
  await T("saqlov kodi: eksport → import bir xil holat", `(async()=>{ const raw=G.qulay.raw(); const code=await G.qulay.exportCode(); const r=await G.qulay.decode(code); const r2=await G.qulay.decode(raw); return { ok: /^SAFAR:1:[0-9a-f]{8}:z/.test(code) && r.ok && r.raw===raw && JSON.stringify(r.obj)===raw && r2.ok && r2.raw===raw && code.length<raw.length, len:code.length, raw:raw.length }; })()`);
  await T("saqlov kodi: buzilgani rad etiladi", `(async()=>{ const Q=G.qulay, code=await Q.exportCode(); const i=code.length-30; const bad=code.slice(0,i)+(code[i]==='A'?'B':'A')+code.slice(i+1);
    const a=await Q.decode(bad), b=await Q.decode(code.slice(0,code.length-40)), c=await Q.decode('salom dunyo'), d=await Q.decode('{"v":3,"money":5}'), e=await Q.decode('{"v":2,"money":-5}'), f=await Q.decode('SAFAR:1:00000000:'+code.split(':')[3]), g=await Q.decode('{"v":2,"money":5,"veh":{"own":"x"}}');
    return { ok: [a,b,c,d,e,f,g].every(x=>!x.ok && x.why), why:[a,b,c,d,e,f,g].map(x=>x.why) }; })()`);
  // fayl: oynadagi tugma yuklab beradi, tarkibi saqlovning o'zi
  await page.evaluate(() => { G.ui.open('saqlov', { back: 'pause' }); });
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 15000 }), page.click('#screen [data-a=file]')]);
  const fp = await dl.path(), ftxt = fp ? fs.readFileSync(fp, 'utf8') : '';
  await T("saqlov fayli: yuklab olinadi va o'qiladi", `(async()=>{ const raw=localStorage.getItem('safar_save_v2'); const r=await G.qulay.decode(${JSON.stringify(ftxt)}); return { ok: ${JSON.stringify(/^safar-saqlov-\d{4}-\d\d-\d\d\.json$/.test(dl.suggestedFilename()))} && r.ok && r.raw===raw, name:${JSON.stringify(dl.suggestedFilename())} }; })()`);
  await page.evaluate(() => { document.querySelector('#screen [data-a=code]').click(); }); await page.waitForTimeout(300);
  await T("saqlov oynasi: kod ko'rinadi, yaroqsiz kod xabari", `(async()=>{ const ta=document.getElementById('q-code'); const ok1=!!ta && ta.value.startsWith('SAFAR:1:'); const inp=document.getElementById('q-in'); inp.value='SAFAR:1:12345678:zAAAA'; document.querySelector('#screen [data-a=check]').click(); await new Promise(r=>setTimeout(r,200)); const m=document.querySelector('.q-msg.bad'); return { ok: ok1 && !!m && /buzilgan/.test(m.textContent), msg:m&&m.textContent }; })()`);
  await page.evaluate(async () => { const r = await G.qulay.decode(G.qulay.raw()); G.ui.open('saqlov', { back: 'pause', pending: r.obj }); G.advance(0.05); }); await snap('export');
  // import: boshqa holat yoziladi va o'yin qayta yuklanadi — hozirgisi zaxiraga tushadi
  const before = await page.evaluate(async () => { localStorage.removeItem('safar_zaxira_v1'); const s = G.state; s.money = 4321; s.xp = 777; G.save(); const code = await G.qulay.exportCode(); window._code = code; s.money = 99999; G.save(); return { code, raw: localStorage.getItem('safar_save_v2') }; });
  await Promise.all([page.waitForEvent('load', { timeout: 90000 }), page.evaluate(async (code) => { const r = await G.qulay.decode(code); await G.qulay.apply(r.obj, 'import'); }, before.code)]); await ready();
  await T("saqlov import: o'yin ochiladi, oldingisi zaxirada", `(()=>{ const s=G.state, l=G.qulay.backups(); return { ok: s.money===4321 && s.xp===777 && l.length>=1 && l[0].why==='import' && l[0].money===99999, money:s.money, bk:l.map(e=>[e.why,e.money]) }; })()`);

  // ---------- 7. Zaxira ----------
  await T('zaxira: olinadi, takrori yozilmaydi, hajm cheklangan', `(async()=>{ const Q=G.qulay; const a=await Q.backup('auto',true); const n1=Q.backups().length; const b=await Q.backup('auto'); G.state.money=5555; for(let i=0;i<7;i++){ G.state.xp+=1; await Q.backup('auto',true); } const l=Q.backups(); return { ok: !!a && !b && l.filter(e=>e.why==='auto').length===5 && l.length<=8 && Q.backupSize()<1.7e6, n1, n:l.length, size:Q.backupSize() }; })()`);
  await page.evaluate(() => { G.ui.open('zaxira', { back: 'pause' }); document.querySelector('#screen [data-a^="ask:"]').click(); G.advance(0.05); }); await snap('backups');
  const tgt = await page.evaluate(() => { const l = G.qulay.backups(), e = l.find((x) => x.why === 'import'); return e && e.t; });
  await Promise.all([page.waitForEvent('load', { timeout: 90000 }), page.evaluate((t) => G.qulay.restore(t), tgt)]); await ready();
  await T('zaxira: tiklanadi', `(()=>{ const s=G.state, l=G.qulay.backups(); return { ok: s.money===99999 && l.some(e=>e.why==='restore' && e.money===5555), money:s.money, bk:l.map(e=>[e.why,e.money]) }; })()`);

  // ---------- 1b. Eski saqlov: yo'riqnoma chiqmaydi ----------
  await page.evaluate(() => { const o = { v: 2, money: 7300, xp: 900, stars: { j_bogiston_1: 3 }, best: {}, up: { engine: 2, nitro: 1, tires: 0, susp: 1, armor: 0, brake: 0 }, paint: 'qizil', paints: ['qizil'], coins: [1, 2], chests: [], places: { bogiston: 1, uy: 1 }, stats: { dist: 15200, top: 131, jump: 31, smashed: 22, crashes: 9, time: 2400, drift: 0, air: 0 }, set: { vol: 0.5, music: false, gfx: 2, damage: true }, hour: 14.2, fresh: false }; localStorage.setItem('safar_save_v2', JSON.stringify(o)); G.save = () => {}; });
  await reload();
  await T("yo'riqnoma: eski saqlovda ko'rsatilmaydi", `(()=>{ const q=G.state.qulay; G.qulay.live=true; G.sim(0.5); const c=document.querySelector('.q-card:not(.tip)'); return { ok: q.guide===-1 && c.style.display==='none' && G.state.set.ui===100, guide:q.guide }; })()`);

  // ---------- telefon o'lchami: yangi oynalar sig'adimi ----------
  await page.setViewportSize({ width: 390, height: 844 });
  const fit = async (name, js) => { await page.evaluate(js); await page.waitForTimeout(150);
    return T(`telefon 390px: ${name} sig'adi`, `(()=>{ const w=document.querySelector('#screen .win'), r=w.getBoundingClientRect(); const over=[...w.querySelectorAll('*')].filter(e=>{ const b=e.getBoundingClientRect(); return b.width>0 && (b.right>innerWidth+1 || b.left<-1); }).length; return { ok: r.left>=0 && r.right<=innerWidth+1 && over===0 && document.documentElement.scrollWidth<=innerWidth, r:[r.left,r.right].map(Math.round), over }; })()`); };
  await fit('saqlov', `G.ui.open('saqlov',{back:'pause'})`); await page.evaluate(() => G.advance(0.02)); await snap('phone_saqlov');
  await fit('zaxira', `G.ui.open('zaxira',{back:'pause'})`);
  await fit('kunlik', `G.ui.open('yutuqlar',{tab:'kun'})`); await page.evaluate(() => G.advance(0.02)); await snap('phone_daily');
  await fit('yutuqlar', `G.ui.open('yutuqlar',{tab:'ach'})`);
  await fit('sozlamalar', `G.ui.open('settings',{back:'pause'})`);
};
