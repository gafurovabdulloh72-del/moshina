// Haftalik chellenj, hafta statistikasi, nishonlar va bank tarixi sinovi (sinov rejimi, G.sim bilan). Ishlatish: npm run test:hafta (avval npm run build)
export default async ({ page, shot }) => {
  await page.waitForFunction('window.__ready === true', null, { timeout: 120000 });
  const T = async (name, expr) => { const r = await page.evaluate(expr); const ok = r && r.ok !== false; console.log(`TEST ${name} ${ok ? 'OK' : 'FAIL'}`, JSON.stringify(r)); return r; };
  await page.evaluate(() => { G.save = () => {}; G.sim(0.1); });

  await T("holat va hafta raqami", `(()=>{ const h=G.state.hafta, d=new Date(), wi=Math.floor((Date.UTC(d.getFullYear(),d.getMonth(),d.getDate())-Date.UTC(1970,0,5))/604800000); return { ok: h.w===wi && !!G.hafta.def() && G.hafta.def().id===G.hafta.id(), w:h.w, id:G.hafta.id(), kind:G.hafta.kind() }; })()`);
  await T("[6] tugmasi yuqori qatorda", `(()=>{ const b=[...document.querySelectorAll('#h-top .ab')].map(e=>e.textContent); return { ok: b.some(t=>t.includes('Hafta')), b }; })()`);

  // bank: sababli har bir tushum/xarajat tarixda; chellenj mukofoti ham
  await T("bank: sabab bilan", `(()=>{ const s=G.state, m0=s.hafta.s.money; G.addMoney(500,'Sinov tushumi'); G.addMoney(-40,'Sinov xaridi'); return { ok: s.income[1][1]==='Sinov tushumi' && s.income[0][1]==='Sinov xaridi' && s.hafta.s.money-m0===500, inc:s.income.slice(0,2), d:s.hafta.s.money-m0 }; })()`);
  await T("bank: chellenj mukofoti", `(()=>{ const a=G.acts.acts.find(q=>q.cat==='job'), s=G.state; G.startAct(a); G.endAct(true,'done',3,'sinov'); G.ui.close(); const r=s.income.find(q=>q[1]==='Chellenj: '+a.name); return { ok: !!r && r[2]>0 && s.hafta.s.jobs>=1, r, jobs:s.hafta.s.jobs }; })()`);
  await T("bank: chiqimlar ham (evakuator, bozor)", `(()=>{ const s=G.state; s.money+=1000; G.tow(); const t=s.income.find(q=>q[1]==='Evakuator'); return { ok: !!t && t[2]<0, t }; })()`);

  // haftalik poyga: shu haftaning o'rniga poyga tushgan haftani tanlaymiz (natija har kimda bir xil — faqat hafta raqamidan)
  const race = await T("haftalik poyga: boshlash", `(()=>{ const H=G.hafta; let w=G.state.hafta.w; while(G.hafta && (H.wOverride=w, H.roll(), H.kind()!=='race')) w++; const ok=H.start(); return { ok: ok && G.act && G.act.def.id===H.id() && G.act.def.type==='race', w, id:H.id(), state:G.act&&G.act.state }; })()`);
  await T("haftalik poyga: natija, mukofot, g'alaba", `(()=>{ const s=G.state, h=s.hafta, m0=s.money, A=G.act; A.state='run'; A.cpi=A.cps.length; A.t=101.25; G.endAct(true,'done',2,"Vaqt: 1:41.3 · 1-o'rin"); const res=document.querySelector('.hf-res'); const pay=s.income.find(q=>q[1]==='Hafta chellenji'); return { ok: h.best===101.25 && h.stars===2 && h.paid===600 && !!pay && pay[2]===600 && h.s.wins===1 && !!res && h.badges.ilk>0, best:h.best, stars:h.stars, paid:h.paid, wins:h.s.wins, res: res&&res.textContent, money:s.money-m0 }; })()`);
  await shot('hafta_result');
  await T("haftalik poyga: yomonroq natija rekordni almashtirmaydi", `(()=>{ G.ui.close(); const h=G.state.hafta; G.hafta.start(); const A=G.act; A.state='run'; A.cpi=A.cps.length; A.t=140; G.endAct(true,'done',1,"Vaqt: 2:20.0 · 3-o'rin"); G.ui.close(); return { ok: h.best===101.25 && h.stars===2 && h.paid===600 && h.tries===2 && h.s.wins===1, best:h.best, tries:h.tries, paid:h.paid }; })()`);
  await T("haftalik poyga: 3 yulduz — farqi to'lanadi", `(()=>{ const h=G.state.hafta; G.hafta.start(); const A=G.act; A.state='run'; A.cpi=A.cps.length; A.t=90; G.endAct(true,'done',3,"Vaqt: 1:30.0 · 1-o'rin"); G.ui.close(); return { ok: h.best===90 && h.stars===3 && h.paid===1000 && h.badges.oltin>0 && h.weeks===1, best:h.best, paid:h.paid, weeks:h.weeks }; })()`);

  // haftalik drift/sindirish: o'sha manzilga ko'chadi
  await T("haftalik zona: manzilga ko'chish va ochko", `(()=>{ const H=G.hafta; let w=G.state.hafta.w+1; while((H.wOverride=w, H.roll(), H.kind()==='race')) w++; const a=H.def(), p=G.site.places[a.place]; const ok=H.start(), d=Math.hypot(G.car.p[0]-p.x, G.car.p[2]-p.z); const A=G.act; if (a.type==='drift') A.score=6100; else A.count=15; G.endAct(true,'done',2,'sinov'); G.ui.close(); const h=G.state.hafta; return { ok: ok && d < p.r + 150 && h.best===(a.type==='drift'?6100:15) && h.hist.length>=1 && h.hist[0].best===90, kind:H.kind(), d:Math.round(d), best:h.best, hist:h.hist.length }; })()`);

  // yo'l va ishlar (ish.js hisobidan)
  await T("hafta: km va ishlar", `(()=>{ const s=G.state, h=s.hafta, k0=h.s.km, j0=h.s.jobs; G.sim(0.05); s.stats.dist+=320; s.jobs.non=s.jobs.non||{n:0,best:0,earn:0}; s.jobs.non.n++; G.sim(0.05); return { ok: Math.round(h.s.km-k0)>=320 && h.s.jobs===j0+1, km:Math.round(h.s.km-k0), jobs:h.s.jobs-j0 }; })()`);
  // nishon va xabar
  await T("nishon: xabar chiqadi", `(()=>{ const h=G.state.hafta; h.s.money=12000; G.hafta.check(); const q=G.hafta.pending.length; G.sim(0.05); const b=document.getElementById('banner'); return { ok: h.badges.boy>0 && q>=1 && /nishon/i.test(b.textContent), banner:b.textContent }; })()`);

  // oyna: chellenj, ko'rsatkichlar, nishonlar; faylda onlayn reyting "faqat sayt orqali"
  await page.evaluate(() => { G.hafta.wOverride = null; G.hafta.roll(); G.ui.open('hafta'); });
  await T("oyna: tarkibi", `(()=>{ const t=document.querySelector('#screen .win').textContent; return { ok: /Hafta/.test(t) && /Nishonlar/.test(t) && /sayt orqali/.test(t) && document.querySelectorAll('.hf-b').length===8 && !!document.querySelector('.hf-ch button'), len:t.length }; })()`);
  await shot('hafta_window');
  // telefon ilovasi
  await page.evaluate(() => { G.ui.close(); G.phone.open(); });
  await T("telefon: Hafta ilovasi", `(()=>{ const i=document.querySelector('.ph-app[data-hafta]'); if (!i) return { ok:false }; i.click(); return { ok: G.ui.screenName==='hafta' }; })()`);
  await page.evaluate(() => { G.ui.close(); G.phone.open(); document.querySelector('[data-a="app:bank"]').click(); });
  await T("telefon: bankda hafta mukofoti", `(()=>{ const t=document.querySelector('.ph-list').textContent; return { ok: /Hafta chellenji/.test(t) && /Chellenj:/.test(t), t:t.slice(0,160) }; })()`);
  await shot('hafta_bank');
  // saqlash va qayta yuklash
  await page.evaluate(() => { G.ui.close(); G.hafta.wOverride = null; G.hafta.roll(); G.state.hafta.best = 77; localStorage.setItem('safar_save_v2', JSON.stringify(G.state)); window.onbeforeunload = null; });
  await page.reload(); await page.waitForFunction('window.__ready === true', null, { timeout: 120000 });
  await T("saqlov: hafta holati tiklanadi", `(()=>{ const h=G.state.hafta; return { ok: h.best===77 && h.badges.ilk>0 && h.badges.boy>0, best:h.best, badges:Object.keys(h.badges) }; })()`);
};
