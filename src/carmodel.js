// Sayohat jipi (o'z dizaynimiz): silliq kesimli korpus uslubi, tom bagaji, yuklar, shnorkel, zaxira g'ildirak; bo'yoqlar ro'yxati
import { wheelInto } from './carkit.js';

export const PAINTS = [
  { id: 'qizil', name: 'Olov qizil', hex: 0xd8392b, cost: 0 },
  { id: 'kok', name: "Moviy ko'l", hex: 0x2f7fd0, cost: 600 },
  { id: 'yashil', name: "Archa yashil", hex: 0x3f9a58, cost: 600 },
  { id: 'sariq', name: 'Qum sariq', hex: 0xf0b83a, cost: 800 },
  { id: 'oq', name: 'Qor oq', hex: 0xf2f2ee, cost: 800 },
  { id: 'qora', name: 'Tun qora', hex: 0x2a2c33, cost: 1000 },
  { id: 'binafsha', name: 'Shafaq binafsha', hex: 0x8a54c8, cost: 1200 },
  { id: 'firuza', name: 'Firuza', hex: 0x24b8b0, cost: 1200 },
  { id: 'oltin', name: 'Oltin (Katta Safar sovrini)', hex: 0xe8b23a, cost: -1 },
  { id: 'chempion', name: 'Chempion (15 ta kubok sovrini)', hex: 0xb3122e, cost: -1 },
];

// Jip korpusi: tik old oyna, qutisimon salon, orqasi tik (orqa eshikda zaxira g'ildirak)
export const JEEP = {
  cowl: 0.74, rf: 0.55, rr: -1.9, top: [[2.0, 0.56], [1.95, 0.72, 0.05], [1.82, 0.76, 0.1], [0.74, 0.82, 0.06], [0.55, 1.38, 0.1], [-1.9, 1.39, 0.08], [-2.0, 1.2]], belt: [[2.0, 0.7], [0.74, 0.82], [-2.0, 0.84]],
  bot: [[2.0, 0.26], [1.72, 0.05, 0.2], [-1.72, 0.05, 0.2], [-2.0, 0.26]], roofY: 1.39, hoodY: 0.82, tumble: 0.93, hoodX: 0.9, pF: 6, rcR: 0.1, side: [0.998, 1, 0.998, 0.99], crown: 0.035,
  win: [[0.72, -0.42], [-0.5, -1.16], [-1.24, -1.84]], doors: [0.7, -0.46, -1.2], handles: [-0.3, -1.08], hoodSeam: true, clad: 0.17, flare: 0.04, gap: 0.06,
  bump: 'sep', bumpC: 0x2d2f34, bumpH: 0.22, bumpHR: 0.24, head: [0.56, 0.86, 0.47, 0.66], roundLamp: true, tail: [0.84, 0.98, 0.44, 0.74], grille: [0.46, 0.34, 0.68], noIntake: true, plateF: 0.24, plateR: 0.6,
  prof: 'off', ww: 0.3, rim: 0x8e939b, wstyle: 'y', spokes: 6, seatZ: -0.1,
};
// Jipga xos qo'shimchalar: H — vehicles.js yordamchilari (flares, bullBar, rearPanes, lightBar)
export function jeepExtras(c, H) {
  const { B, body, W, Y, hl } = c, T = B.trim;
  H.flares(c, 0.09); H.bullBar(c);
  H.rearPanes(c, [[0.82, -0.82, 0.9, 1.3]]);
  // tom bagaji: ikki relsli rama, ko'ndalang to'sinlar, tirgaklar
  const yr = Y(1.39), z0 = 0.42, z1 = -1.82; T.mat(0x1d1e22, 0.45, 0.6);
  for (const sd of [1, -1]) { T.tube([[sd * W * 0.84, yr + 0.12, z0], [sd * W * 0.84, yr + 0.12, z1]], 0.022, 6); T.tube([[sd * W * 0.84, yr + 0.2, z0 + 0.04], [sd * W * 0.84, yr + 0.2, z1 + 0.04]], 0.018, 6); }
  for (let i = 0; i <= 4; i++) { const z = z0 + (z1 - z0) * (i / 4); T.tube([[-W * 0.84, yr + 0.11, z], [W * 0.84, yr + 0.11, z]], 0.016, 6); for (const sd of [1, -1]) { T.rod([sd * W * 0.84, yr + 0.01, z], [sd * W * 0.84, yr + 0.2, z], 0.014, 0.014, 6); } }
  // yuklar (qism: tom urilganda uchadi)
  const lg = B.P(12), ly = yr + 0.13;
  lg.mat(0x2f6fb8, 0.5, 0.1).rbox(-0.3, ly + 0.15, -0.35, 0.72, 0.3, 0.8, 0.04, 2); lg.mat(0x26589a, 0.5, 0.1).rbox(-0.3, ly + 0.31, -0.35, 0.74, 0.03, 0.82, 0.012, 1);
  lg.mat(0x3f6a44, 0.95, 0).rbox(0.36, ly + 0.12, -0.2, 0.5, 0.24, 0.5, 0.1, 2);
  lg.mat(0xd8d2c2, 0.95, 0).tube([[-0.6, ly + 0.14, -1.05], [0.6, ly + 0.14, -1.05]], 0.14, 10, { cap: true });
  lg.mat(0xb0802e, 0.9, 0).tube([[-0.5, ly + 0.13, -1.42], [0.5, ly + 0.13, -1.42]], 0.12, 10, { cap: true });
  lg.mat(0x2a2c31, 0.6, 0).rbox(0.0, ly + 0.15, -1.05, 0.04, 0.3, 0.3, 0.01, 1);
  lg.mat(0xa83a2c, 0.45, 0.2).rbox(0.42, ly + 0.17, -0.75, 0.26, 0.34, 0.4, 0.025, 1);
  lg.mat(0x7a5232, 0.9, 0).rbox(-0.42, ly + 0.1, -1.72, 0.5, 0.2, 0.36, 0.01, 1);
  B.parts.luggage = [lg, 'top', 22];
  // shnorkel (o'ng old ustun bo'ylab)
  const xs = -(W + 0.03), zs = 0.86; T.mat(0x18191c, 0.6, 0);
  T.tube([[xs, Y(0.6), zs + 0.02], [xs, Y(0.84), zs], [xs + 0.02, Y(1.0), zs - 0.06], [xs + 0.03, Y(1.42), zs - 0.2], [xs + 0.03, Y(1.52), zs - 0.24]], 0.045, 8);
  T.rbox(xs + 0.03, Y(1.56), zs - 0.22, 0.11, 0.1, 0.17, 0.03, 1);
  // zaxira g'ildirak (orqa eshikda)
  const sp = B.P(13), zsp = body.endZ(0, Y(0.62), -1) - 0.13; sp.push().translate(0, Y(0.62), zsp).rotY(-Math.PI / 2); wheelInto(sp, 0.4, 0.24, { prof: 'off', rim: 0x8e939b, style: 'steel', lite: true }); sp.pop();
  B.parts.spare = [sp, 'rear', 30];
  // tom chiroqlari va antenna
  H.lightBar(c);
  T.mat(0x18191c, 0.5, 0.3).rod([W * 0.8, Y(0.82), 1.0], [W * 0.8, Y(1.8), 0.98], 0.008, 0.004, 4);
}
