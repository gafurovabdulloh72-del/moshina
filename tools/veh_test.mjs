// Har bir transport: tinch holat, tezlanish, eng yuqori tezlik, burilish, tormoz, tasodifiy barqarorlik
import { Car } from '../src/physics.js';
import { VEHICLES } from '../src/vehicles.js';
import { SURF } from '../src/terrain.js';
const mk = (surf = SURF.ROAD, bump = 0) => ({ ground: (x, z) => ({ y: bump ? Math.sin(x * 0.7) * Math.sin(z * 0.6) * bump : 0, surf, road: 1 }), waterY: () => -1e9 });
const DT = 1 / 120;
const run = (car, secs, f, log) => { const n = Math.round(secs / DT); for (let i = 0; i < n; i++) { car.step(DT, f(i * DT)); if (log) log(i * DT); } };
for (const v of VEHICLES) {
  const out = [v.id.padEnd(8)];
  { const c = new Car(mk(), v.spec); c.place(0, 0, 0); run(c, 3, () => ({})); out.push('restY ' + (c.p[1] - v.spec.com).toFixed(3), 'up ' + c.upY.toFixed(3), 'v ' + c.speed.toFixed(3)); }
  { const c = new Car(mk(), v.spec); c.place(0, 0, 0); let t60 = 0, t100 = 0; run(c, 45, () => ({ throttle: 1 }), (t) => { if (!t60 && c.fwd > 16.67) t60 = t; if (!t100 && c.fwd > 27.78) t100 = t; });
    out.push('0-60 ' + (t60 ? t60.toFixed(1) : '-'), '0-100 ' + (t100 ? t100.toFixed(1) : '-'), 'top ' + (c.fwd * 3.6).toFixed(0) + '/' + v.spec.top, 'up ' + c.upY.toFixed(2));
    const v0 = c.fwd, z0 = c.p[2]; run(c, 10, () => ({ brake: c.fwd > 1.2 ? 1 : 0 })); out.push('brk ' + (c.p[2] - z0).toFixed(0) + 'm'); }
  for (const sp of [8, 20]) { const c = new Car(mk(), v.spec); c.place(0, 0, 0); run(c, 12, () => ({ throttle: c.fwd < sp ? 1 : 0 })); let ya = 0, last = c.yaw, mr = 0; run(c, 4, () => ({ throttle: c.fwd < sp ? 0.8 : 0.1, steer: 1 }), () => { let d = c.yaw - last; if (d > 3) d -= 6.283; if (d < -3) d += 6.283; ya += d; last = c.yaw; mr = Math.max(mr, Math.abs(Math.asin(c.R[3]))); });
    out.push(`turn${sp}: R${(c.speed / Math.abs(ya / 4)).toFixed(0)} roll${(mr * 57.3).toFixed(0)} up${c.upY.toFixed(2)}`); }
  { const c = new Car(mk(SURF.GRASS, 0.12), v.spec); c.place(0, 0, 0); let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647; let inp = {}, bad = 0, flips = 0, minUp = 1;
    run(c, 240, (t) => { if (Math.round(t / DT) % 100 === 0) inp = { throttle: rnd() > 0.25 ? 1 : 0, brake: rnd() > 0.85 ? 1 : 0, steer: Math.round(rnd() * 2 - 1), handbrake: rnd() > 0.88, nitro: rnd() > 0.7 }; return inp; }, () => { if (!isFinite(c.p[0] + c.p[1] + c.v[0])) bad++; minUp = Math.min(minUp, c.upY); while (c.events.length) { if (c.events.shift().type === 'flip') flips++; } });
    out.push('rnd: bad' + bad + ' flips' + flips + ' minUp' + minUp.toFixed(2)); }
  console.log(out.join(' | '));
}
