// Eski (v1) saqlangan o'yin bilan mosligi va yangi holatning saqlanib-tiklanishi
export default async ({ page }) => {
  await page.waitForFunction('window.__ready === true', null, { timeout: 90000 });
  const old = { v: 2, money: 7300, xp: 900, stars: { j_bogiston_1: 3, r1: 2 }, best: { r1: 190.2 }, up: { engine: 2, nitro: 1, tires: 0, susp: 1, armor: 0, brake: 0 }, paint: 'kok', paints: ['qizil', 'kok'], coins: [1, 2, 3, 40, 41], chests: [0], places: { bogiston: 1, mayoq: 1 },
    stats: { dist: 15200, top: 131, jump: 31, smashed: 22, crashes: 9, time: 2400, drift: 0, air: 0 }, set: { vol: 0.5, music: false, quality: 1, damage: true }, hour: 14.2, pos: [-380, 1900, 0.4], dmg: { z: { front: 55, rear: 100, left: 62, right: 100 }, e: 71, t: [0, 0, 0, 0] }, fresh: false };
  await page.evaluate((o) => { localStorage.setItem('safar_save_v2', JSON.stringify(o)); window.onbeforeunload = null; }, old);
  await page.evaluate('G.save = () => {}');
  await page.reload(); await page.waitForFunction('window.__ready === true', null, { timeout: 90000 });
  console.log('TEST old-save', JSON.stringify(await page.evaluate(`(()=>{const s=G.state; G.sim(0.5); return {money:s.money, veh:s.veh, hp:G.damage.health, zone:G.damage.zone.front, paint:G.carModel.paintMat.color.getHexString(), pos:G.car.p.map(v=>Math.round(v)), hour:s.hour, gfx:s.set.gfx, vol:s.set.vol, inv:s.inv.seed, tasks:s.tasks.length, home:s.home.lvl, power:Math.round(G.car.power), stars:G.totalStars(), coins:s.coins.length}})()`)));
  console.log('TEST new-state', JSON.stringify(await page.evaluate(`(()=>{const s=G.state; G.buyVehicle('sedan'); G.pickVehicle('sedan'); G.damage.hit(15,0,0,2,'hit'); G.live.upgradeHome(); G.live.dismount(true); G.sim(0.3); G.live.doAction('plant'); G.sim(1.5); s.inv.fruit=5; s.tools.rod=1; s.hat='doppi'; s.hats.push('doppi'); G.save(); return {money:s.money, cur:s.veh.cur, own:s.veh.own, hp:G.damage.health, home:s.home.lvl, foot:s.foot&&s.foot.map(v=>Math.round(v)), flowers:s.flowers.length}})()`)));
  await page.evaluate('G.save = () => {}');
  await page.reload(); await page.waitForFunction('window.__ready === true', null, { timeout: 90000 });
  console.log('TEST reloaded', JSON.stringify(await page.evaluate(`(()=>{const s=G.state; G.sim(0.5); return {money:s.money, cur:s.veh.cur, model:G.carModel.id, hp:G.damage.health, home:s.home.lvl, homeVis:G.site.places.uy.home.lvl, foot:G.player.onFoot, p:G.player.p.map(v=>Math.round(v)), flowers:s.flowers.length, fruit:s.inv.fruit, rod:s.tools.rod, hat:G.player.rig.hat, jipDmg:JSON.stringify(s.veh.dmg.jip&&s.veh.dmg.jip.z.front)}})()`)));
};
