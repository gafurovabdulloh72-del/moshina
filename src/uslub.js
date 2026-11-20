// Uy uslubi: zamonaviy yoki an'anaviy hovli (paxsa devor, firuza eshik va derazalar, o'ymakor ustunli ayvon, tekis loy tom, paxsa hovli devori) — 2-darajadan (hovli uy) boshlab
// Uy ichi ham o'zgaradi (ganch devor, yog'och shift, qizil gilam — interior.js). Uslub uy holatining bir qismi (st.home.style): onlayn mehmon ham egasining uslubini ko'radi (coop.js hm.h.st).
export const STYLE_COST = 1500;
export const STYLES = [{ id: 0, name: 'Zamonaviy', icon: '🏡', d: "Qiya cherepitsa tom, oq devorlar, ko'k romlar" }, { id: 1, name: "An'anaviy hovli", icon: '🕌', d: "Paxsa devor, o'ymakor ustunli ayvon, firuza eshik, tekis tom" }];

export function initUslub(game) {
  const st = game.state, L = game.live, home = game.site.places.uy.home;
  if (st.home.style !== 1) st.home.style = 0; // eski saqlov
  const U = (game.uslub = { STYLES, cost: STYLE_COST });
  // uy ko'rinishi har safar st.home bo'yicha (o'z uyi yoki onlayn mehmonda — egasining uyi) qayta qo'yilganda uslub ham olinadi
  const ah = L.applyHome; L.applyHome = () => { home.style = (st.home.style | 0) === 1 ? 1 : 0; ah(); };
  L.applyHome();
  U.can = () => st.home.lvl >= 2 && !(game.visit && game.visit.on);
  U.set = (v) => {
    v = v === 1 ? 1 : 0; if (!U.can() || (st.home.style | 0) === v) return false;
    if (st.money < STYLE_COST) { game.toast(`Pul yetarli emas (${STYLE_COST} so'm)`, 'bad'); return false; }
    game.addMoney(-STYLE_COST, 'Uy uslubi'); st.home.style = v; L.applyHome(); if (game.interior && game.interior.rebuildHome) game.interior.rebuildHome();
    const pl = game.player; if (pl.onFoot && Math.hypot(pl.p[0] - home.x, pl.p[2] - home.z) < 30 && !(game.interior && game.interior.inside)) pl.place(home.gate[0], home.gate[1], home.yaw + Math.PI); // yangi devorlar ichida qolmasin
    game.audio.sfx('win'); game.banner('Uy uslubi o\'zgardi!', STYLES[v].name, 'gold'); if (game.coop && game.coop.sendHome) game.coop.sendHome(true); game.save(); return true;
  };
  // «Mening uyim» oynasidagi karta (ui.js)
  U.html = () => { const lv = st.home.lvl, cur = st.home.style | 0;
    return `<h4 style="margin:12px 0 6px">Uy uslubi <small style="font-weight:600;color:var(--mut)">(almashtirish ${STYLE_COST} so'm · hovli uydan boshlab)</small></h4><div class="row" style="flex-wrap:wrap">${STYLES.map((q) => `<div class="card" style="flex:1;min-width:150px"><h4>${q.icon} ${q.name}${cur === q.id ? ' <small style="color:var(--good)">✓</small>' : ''}</h4><p>${q.d}</p><button data-a="sty:${q.id}" class="${cur === q.id ? 'sec' : ''}" ${cur === q.id || lv < 2 || st.money < STYLE_COST ? 'disabled' : ''}>${cur === q.id ? 'Hozirgi uslub' : lv < 2 ? 'Hovli uy kerak' : `Tanlash — ${STYLE_COST} so'm`}</button></div>`).join('')}</div>`; };
  return U;
}
