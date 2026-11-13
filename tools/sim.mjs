// Haqiqiy dunyoda avtopilot bilan barcha yo'llarni haydab chiqish + poyga vaqtlarini solishtirish
import * as T from '../src/terrain.js';
import { Car, Autopilot } from '../src/physics.js';
import { estimateTime, pathLen } from '../src/acts.js';
T.initWorld();
const world = { ground: T.ground, waterY: T.waterY };
const DT = 1 / 120;
function run(name, pts3, maxSpeed, power) {
  const pts = pts3.map((q) => [q[0], q[1]]);
  const car = new Car(world); if (power) car.power = power;
  car.place(pts[0][0], pts[0][1], Math.atan2(pts[3][0] - pts[0][0], pts[3][1] - pts[0][1]));
  const ap = new Autopilot(pts, { maxSpeed }); let t = 0, ev = {}, stuck = 0, maxV = 0, bad = '';
  while (!ap.done && t < 1500) { car.step(DT, ap.input(car)); t += DT; maxV = Math.max(maxV, car.speed);
    while (car.events.length) { const e = car.events.shift(); ev[e.type] = (ev[e.type] || 0) + 1; if (e.type === 'sunk' || e.type === 'flip') { bad += ` ${e.type}@${car.p.map((v) => v.toFixed(0)).join(',')}`; if (e.type === 'sunk') t = 1e9; } }
    if (car.speed < 0.5) { stuck += DT; if (stuck > 6) { bad += ` STUCK@${car.p.map((v) => v.toFixed(0)).join(',')} i=${ap.i}/${pts.length}`; break; } } else stuck = 0; }
  const est = estimateTime(pts3, 33);
  console.log(name.padEnd(12), ap.done ? 'OK  ' : 'FAIL', 'len', pathLen(pts).toFixed(0).padStart(6), 'bot', t.toFixed(0).padStart(4) + 's', 'est', est.toFixed(0).padStart(4) + 's', 'max', (maxV * 3.6).toFixed(0), JSON.stringify(ev), bad);
}
for (const e of T.roads.edges) { run(e.key + ' fwd', T.pathByEdges([[e.key, false]]), e.type ? 20 : 30); run(e.key + ' rev', T.pathByEdges([[e.key, true]]), e.type ? 20 : 30); }
run('ring', T.pathByNodes(['vil', 'mj', 'brj', 'ormon', 'karj', 'kol', 'lager', 'west', 'karvon', 'dara', 'sw', 'vil']), 33);
