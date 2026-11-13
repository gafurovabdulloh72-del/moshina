// Fizika sinovi: tekis yer, tezlanish, burilish, tormoz, qiyalik
import { Car } from '../src/physics.js';
import { SURF } from '../src/terrain.js';
const mk = (slope = 0, surf = SURF.ROAD) => ({ ground: (x, z) => ({ y: z * slope, surf, road: 1 }), waterY: () => -1e9 });
const DT = 1 / 120;
function run(car, secs, inpFn, log) { const n = Math.round(secs / DT); for (let i = 0; i < n; i++) { car.step(DT, inpFn(i * DT)); if (log) log(i * DT); } }
// 1. Tinch holat
{ const car = new Car(mk()); car.place(0, 0, 0); run(car, 3, () => ({}));
  console.log('rest: y', car.p[1].toFixed(3), 'comp', car.wheels.map(w => w.comp.toFixed(3)).join(','), 'v', car.speed.toFixed(4), 'upY', car.upY.toFixed(4)); }
// 2. Tezlanish
for (const surf of [SURF.ROAD, SURF.GRASS, SURF.SNOW]) { const car = new Car(mk(0, surf)); car.place(0, 0, 0); let t60 = 0, t100 = 0;
  run(car, 40, () => ({ throttle: 1 }), (t) => { if (!t60 && car.fwd > 16.67) t60 = t; if (!t100 && car.fwd > 27.78) t100 = t; });
  console.log('accel surf', surf, '0-60:', t60.toFixed(1), 's 0-100:', t100.toFixed(1), 's top:', (car.fwd * 3.6).toFixed(0), 'km/h', 'pitch', Math.asin(car.R[5]).toFixed(3)); }
// 3. Nitro
{ const car = new Car(mk()); car.place(0, 0, 0); run(car, 30, () => ({ throttle: 1, nitro: true })); console.log('nitro top', (car.fwd * 3.6).toFixed(0)); }
// 4. Tormoz
{ const car = new Car(mk()); car.place(0, 0, 0); run(car, 12, () => ({ throttle: 1 })); const v0 = car.fwd, z0 = car.p[2]; let t = 0; run(car, 8, () => ({ brake: car.fwd > 1.2 ? 1 : 0 }), () => { if (car.fwd > 0.3) t += DT; });
  console.log('brake from', (v0 * 3.6).toFixed(0), 'km/h: dist', (car.p[2] - z0).toFixed(1), 'm time', t.toFixed(1), 'end v', car.fwd.toFixed(2)); }
// 5. Burilish
for (const sp of [8, 15, 22, 30]) for (const surf of [SURF.ROAD, SURF.SNOW]) { const car = new Car(mk(0, surf)); car.place(0, 0, 0);
  run(car, 10, () => ({ throttle: car.fwd < sp ? 1 : 0 }));
  let maxRoll = 0; const yaw0 = car.yaw; let yawAcc = 0, last = yaw0, maxSlip = 0;
  run(car, 4, () => ({ throttle: car.fwd < sp ? 0.8 : 0.1, steer: 1 }), () => { maxRoll = Math.max(maxRoll, Math.abs(Math.asin(car.R[3]))); let d = car.yaw - last; if (d > 3) d -= 6.283; if (d < -3) d += 6.283; yawAcc += d; last = car.yaw; maxSlip = Math.max(maxSlip, Math.abs(car.slipAng)); });
  const yr = yawAcc / 4; console.log('turn v', sp, 'surf', surf, 'yawRate', yr.toFixed(2), 'rad/s radius', (car.speed / Math.abs(yr)).toFixed(1), 'latG', (car.speed * Math.abs(yr) / 9.81).toFixed(2), 'maxRoll', (maxRoll * 57.3).toFixed(1), 'deg slipAng', (maxSlip * 57.3).toFixed(0), 'upY', car.upY.toFixed(2), 'v', car.speed.toFixed(1)); }
// 6. Qiyalik
for (const g of [0.15, 0.25, 0.35, 0.5]) for (const surf of [SURF.ROAD, SURF.SNOW]) { const car = new Car(mk(g, surf)); car.place(0, 0, 0); run(car, 2, () => ({})); const hold = car.speed; run(car, 12, () => ({ throttle: 1 }));
  console.log('climb', (g * 100) + '%', 'surf', surf, 'hold v', hold.toFixed(2), 'speed', (car.fwd * 3.6).toFixed(0), 'km/h'); }
// 7. Tushish (sakrash)
{ const car = new Car(mk()); car.setPose(0, 4, 0, 0); car.v[2] = 20; let ev = []; run(car, 4, () => ({}), () => { while (car.events.length) ev.push(car.events.shift().type); }); console.log('drop 3m: y', car.p[1].toFixed(2), 'upY', car.upY.toFixed(3), 'events', ev.join(',')); }
// 8. Handbrake drift
{ const car = new Car(mk()); car.place(0, 0, 0); run(car, 6, () => ({ throttle: 1 })); let ms = 0; run(car, 2.5, (t) => ({ throttle: 0.6, steer: 1, handbrake: t < 1.2 }), () => { ms = Math.max(ms, Math.abs(car.slipAng)); }); console.log('handbrake: max slip angle', (ms * 57.3).toFixed(0), 'v', car.speed.toFixed(1), 'upY', car.upY.toFixed(2)); }
// 9. Tasodifiy kiritishlar — barqarorlik
{ const car = new Car(mk(0.05, SURF.GRASS)); car.place(0, 0, 0); let seed = 1; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647; let inp = {}; let bad = 0, flips = 0;
  run(car, 300, (t) => { if (Math.round(t / DT) % 90 === 0) inp = { throttle: rnd() > 0.3 ? 1 : 0, brake: rnd() > 0.8 ? 1 : 0, steer: Math.round(rnd() * 2 - 1), handbrake: rnd() > 0.85, nitro: rnd() > 0.7 }; return inp; }, () => { if (!isFinite(car.p[0] + car.p[1] + car.v[0])) bad++; while (car.events.length) { if (car.events.shift().type === 'flip') flips++; } });
  console.log('random 300s: bad', bad, 'flips', flips, 'pos', car.p.map(v => v.toFixed(0)).join(','), 'upY', car.upY.toFixed(2)); }
