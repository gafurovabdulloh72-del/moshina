// Rulni qo'yib yuborgandan keyin mashina qancha vaqtda to'g'rilanadi?
import { Car } from '../src/physics.js';
import { SURF } from '../src/terrain.js';
const mk = (surf) => ({ ground: () => ({ y: 0, surf, road: 1 }), waterY: () => -1e9 });
const DT = 1 / 120;
for (const surf of [SURF.ROAD, SURF.GRASS]) for (const sp of [6, 12, 20, 28]) for (const bias of [0, 0.06]) {
  const car = new Car(mk(surf)); car.place(0, 0, 0); car.steerBias = bias;
  for (let i = 0; i < 120 * 8; i++) car.step(DT, { throttle: car.fwd < sp ? 1 : 0.15 });
  for (let i = 0; i < 120 * 1.5; i++) car.step(DT, { throttle: car.fwd < sp ? 1 : 0.15, steer: 1 });
  const w0 = car.w[1]; let tSteer = -1, tYaw = -1, t = 0;
  for (let i = 0; i < 120 * 4; i++) { car.step(DT, { throttle: car.fwd < sp ? 0.6 : 0.1, steer: 0 }); t += DT; if (tSteer < 0 && Math.abs(car.steer - bias) < 0.01) tSteer = t; if (tYaw < 0 && Math.abs(car.w[1]) < 0.06) tYaw = t; }
  console.log('surf', surf, 'v', sp, 'bias', bias, '| yawRate0', w0.toFixed(2), 'steerReturn', tSteer.toFixed(2) + 's', 'yawSettle', tYaw < 0 ? '>4s (w=' + car.w[1].toFixed(2) + ')' : tYaw.toFixed(2) + 's', 'slip', (car.slipAng * 57).toFixed(0));
}
