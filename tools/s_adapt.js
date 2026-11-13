// Moslashuvchan grafika boshqaruvchisini sun'iy kadr vaqtlari bilan sinaydi (render o'chirilgan — faqat mantiq).
export default async ({ page }) => {
  await page.waitForFunction('window.__ready === true', null, { timeout: 90000 });
  const res = await page.evaluate(() => {
    const out = [];
    G.sim(0.3);
    Object.defineProperty(window, 'devicePixelRatio', { value: 2, configurable: true });
    const real = { resize: G.resize, render: G.gfx.render, setQ: G.gfx.setQuality, toast: G.toast, shadow: G.sky.setShadowQuality };
    let toasts = 0;
    G.resize = () => {}; G.gfx.render = () => {}; G.gfx.setQuality = () => {}; G.sky.setShadowQuality = () => {}; G.toast = () => { toasts++; };
    // model(pr, q, t) -> kadr vaqti (soniya). cont=true — "keyingi seans": sozlama va eslab qolingan belgi saqlanadi.
    const run = (name, model, secs, expect, cont) => {
      if (cont) G.applyQuality('boot'); else { G.state.set.gfx = 2; G.applyQuality(); }
      toasts = 0;
      let t = 0, changes = 0, prev = G.pr, minPr = 9, minQ = 9, r;
      while (t < secs) { const ft = model(G.pr, G.state.set.gfx, t); r = G._adapt(ft); t += ft; if (G.pr !== prev) { changes++; prev = G.pr; } minPr = Math.min(minPr, G.pr); minQ = Math.min(minQ, G.state.set.gfx); }
      const ok = expect(r, { changes, minPr, minQ, toasts });
      out.push(`${ok ? 'OK  ' : 'FAIL'} ${name}: pr=${r.pr}/${r.cap} gfx=${r.gfx} ft=${r.ft}ms prChanges=${changes} minPr=${minPr.toFixed(2)} minGfx=${minQ} toasts=${toasts} lock=${r.lock > 0} qLock=${r.qLock} auto=${r.auto}`);
    };
    const vs = (ms) => Math.max(1000 / 60, ms) / 1000; // 60 Gs ekran: kadr 16.7 ms dan tez bo'lmaydi
    run('kuchli kompyuter, 60 Gs, 120 s', () => vs(6), 120, (r, s) => r.pr === 1.75 && r.gfx === 2 && s.changes === 0);
    run('boshqa oynaga o\'tib qaytish (30 s uzilishlar), 400 s', (pr, q, t) => (Math.floor(t / 50) !== Math.floor((t - 0.02) / 50) && t > 1 ? 30 : vs(6)), 400, (r, s) => r.pr === 1.75 && r.gfx === 2 && s.changes === 0);
    run('GPU chegarasi (12·pr² ms), 180 s', (pr, q) => vs([5, 8, 12][q] * pr * pr), 180, (r, s) => r.gfx === 2 && s.minQ === 2 && r.pr >= 1.3 && r.pr <= 1.45 && r.ft < 24.5);
    run('brauzer 30 kadrga cheklagan, 200 s', () => 1 / 30, 200, (r, s) => r.pr === 1.75 && r.gfx === 2 && s.toasts === 0 && r.qLock);
    run('brauzer 30 kadrga cheklagan, 30 daqiqa', () => 1 / 30, 1800, (r, s) => r.pr === 1.75 && r.gfx === 2 && s.toasts === 0);
    run('protsessor chegarasi (sifatga bog\'liq: 22/30/40 ms), 200 s', (pr, q) => [22, 30, 40][q] / 1000, 200, (r, s) => r.gfx === 1 && r.pr === 1.25 && s.toasts === 1);
    run('kuchsiz GPU (14/30/60·pr² ms), 300 s', (pr, q) => vs([14, 30, 60][q] * pr * pr), 300, (r, s) => r.gfx === 1 && r.pr >= 0.7 && r.ft < 24.5 && s.toasts === 1);
    run('juda kuchsiz GPU (40/80/160·pr² ms), 400 s', (pr, q) => vs([40, 80, 160][q] * pr * pr), 400, (r, s) => r.gfx === 0 && r.ft < 24.5 && s.toasts === 2);
    run('hech narsa yordam bermaydi (250 ms), 200 s', () => 0.25, 200, (r, s) => r.gfx === 2 && r.pr === 1.75 && s.toasts === 0);
    run('20 s lik vaqtinchalik sekinlik (GPU), keyin ravon, 240 s', (pr, q, t) => (t > 20 && t < 40 ? vs(14 * pr * pr) : vs(6)), 240, (r, s) => r.gfx === 2 && s.minQ === 2 && r.pr === 1.75);
    run('120 Gs ekran, 100 kadr/s', () => 0.01, 120, (r, s) => r.pr === 1.75 && r.gfx === 2 && s.changes === 0);
    // noto'g'ri pasaytirish o'zi tuzalishi: sekinlik aynan sinov paytida tugaydi -> sifat tushadi -> 45 s ravon -> qayta ko'tariladi
    run('vaqtinchalik sekinlik sinovga to\'g\'ri kelgan (o\'zi tuzaladi), 300 s', (pr, q, t) => (t > 3 && t < 24 ? 0.045 : vs(6)), 300, (r, s) => r.gfx === 2 && r.pr === 1.75 && r.auto === undefined && s.minQ === 1 && s.toasts === 2);
    // 2-sifatni ko'tara olmaydigan kompyuter: 1-seans tushiradi, ko'tarib ko'radi, qaytaradi; 2-seans yana bir marta; 3-seans tinch
    const heavy2 = (pr, q) => (q === 2 ? 0.04 : vs(8));
    run('2-sifat og\'ir kompyuter, 1-seans, 200 s', heavy2, 200, (r, s) => r.gfx === 1 && r.pr === 1.25 && r.auto === 2 && s.toasts === 1);
    run('   ... 2-seans, 200 s', heavy2, 200, (r, s) => r.gfx === 1 && r.pr === 1.25 && r.auto === undefined && s.toasts === 0, true);
    run('   ... 3-seans, 200 s', heavy2, 200, (r, s) => r.gfx === 1 && r.pr === 1.25 && s.changes === 0 && s.minQ === 1 && s.toasts === 0, true);
    // haqiqiy resize/render bilan qisqa tekshiruv (xato chiqmasligi kerak)
    G.resize = real.resize; G.gfx.render = real.render; G.gfx.setQuality = real.setQ; G.sky.setShadowQuality = real.shadow; G.toast = real.toast;
    Object.defineProperty(window, 'devicePixelRatio', { value: 1, configurable: true });
    G.state.set.gfx = 2; G.applyQuality();
    let r = G._adapt(0.05, 500); out.push(`real (dpr 1) slow 25s: pr=${r.pr} gfx=${r.gfx} trial=${r.trial}`);
    r = G._adapt(1 / 60, 6000); out.push(`real recover 100s: pr=${r.pr} gfx=${r.gfx} auto=${r.auto}`);
    G.state.set.gfx = 2; G.applyQuality(); G.advance(0.2);
    return out;
  });
  for (const l of res) console.log('TEST', l);
};
