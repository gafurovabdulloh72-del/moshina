// Kundalik hayot 2: qishloq binolari — choyxona (menyu, ofitsiant, stolda ovqatlanish), kiyim do'koni (ko'zgu oldida kiyinish), sartaroshxona; qahramon ko'rinishi (kiyim, soch, soqol); ishlar va telefon — ish.js, ko'cha mayda narsalari — kocha.js
import * as THREE from 'three';
import * as T from './terrain.js';
import * as COL from './colliders.js';
import { GB, MAT } from './geo.js';
import { makeRig, poseRig, setHat, setTool, rigEnv, HAT_LIST, HAT_SHOP } from './rig.js';
import { clamp } from './util.js';
import { initIsh } from './ish.js';
import { initKocha } from './kocha.js';

// ichki makonlar (uy va do'kon yonida, dengiz ustida)
export const CAFE_O = [2950, 60, 2830], KIYIM_O = [2950, 60, 2770], SART_O = [2950, 60, 2710];
// choyxona menyusi: id, nom, belgi, narx, to'qlik, chanqoq, kuch, tavsif
export const MENU = [
  ['osh', 'Osh (palov)', '🍛', 45, 60, -6, 8, "Qozonda damlangan — sabzi, go'sht, mayiz"], ['somsa', 'Somsa (2 dona)', '🥟', 18, 30, -4, 4, "Tandirdan hozirgina uzildi, ichi go'shtli"],
  ['lagmon', "Lag'mon", '🍜', 38, 50, 12, 6, "Qo'lda cho'zilgan, qaynoq sho'rvali"], ['non', 'Issiq non', '🫓', 6, 20, -2, 2, 'Tandir non, kunjutli'],
  ['choy', "Ko'k choy (choynak)", '🍵', 6, 2, 45, 12, 'Piyolada, issiq — charchoqni oladi'], ['kompot', 'Olcha kompoti', '🥤', 10, 6, 40, 4, 'Muzdek, uy kompoti'],
];
const DRINKS = ['choy', 'kompot'];
export const SHIRTS = [[0xf0b83a, 'Sariq', 0], [0xf2f2ee, 'Oq', 60], [0xd8392b, 'Qizil', 80], [0x2f6fd0, "Ko'k", 80], [0x3f9a58, 'Yashil', 80], [0x22242a, 'Qora', 120], [0xff7ab8, 'Pushti', 90], [0x7a4ec8, 'Binafsha', 100], [0xff8a2a, "To'q sariq", 90], [0x7cc4e8, 'Havorang', 90]];
export const STYLES = [['kalta', 'Kalta yeng', 0, { sleeve: 0.42, vest: 0 }], ['uzun', 'Uzun yeng', 120, { sleeve: 1, vest: 0 }], ['jilet', 'Qora jilet', 150, { sleeve: 0.42, vest: 0x2a2c33 }], ['zarbof', 'Milliy jilet (zarbof)', 260, { sleeve: 1, vest: 0x8a2a3a }]];
export const PANTS = [[0x2f4a78, "Ko'k jinsi", 0], [0x1d1e22, 'Qora shim', 90], [0x6e4a30, 'Jigarrang', 90], [0x6b6e78, 'Kulrang', 80], [0xe8e2d4, 'Oq shim', 110], [0x5a6a3a, 'Xaki', 100]];
export const HAIRS = [['oddiy', 'Oddiy', 30, 0], ['kalta', 'Kalta', 40, 1], ['taqir', 'Taqir', 30, 2], ['qalin', 'Qalin turmak', 50, 3]];
export const HAIRC = [[0x2a1d16, "To'q jigarrang"], [0x15110e, 'Qora'], [0x8a5a2a, 'Malla'], [0xd8b060, 'Sariq'], [0xb8bcc4, 'Kumush']];
export const BEARDS = [['yoq', "Soqolsiz", 0, 0], ['moylov', "Mo'ylov", 1, 0], ['soqol', 'Soqol', 0, 1], ['ikkala', "Soqol va mo'ylov", 1, 1]];
const DEF_LOOK = { shirt: 0xf0b83a, style: 'kalta', pants: 0x2f4a78, hs: 0, hair: 0x2a1d16, beard: 'yoq' };
const som = (n) => Math.round(n).toLocaleString('ru-RU');
const hex = (n) => '#' + n.toString(16).padStart(6, '0');

export function initHayot2(game) {
  const { scene } = game, st = game.state, pl = game.player, L = game.live, HY = game.hayot, IN = game.interior, F = IN.F, LB = IN.lib;
  const H2 = { cafes: [], bld: [], order: [], dishes: [], pv: null };
  game.hayot2 = H2;
  const toast = (m, k) => game.toast(m, k), sfx = (n, k) => game.audio.sfx(n, k), fx = () => game.fx;

  // ================= QAHRAMON KO'RINISHI =================
  const lookOf = () => Object.assign({}, DEF_LOOK, st.look || {});
  const rigOpts = (lk) => { const sty = (STYLES.find((q) => q[0] === lk.style) || STYLES[0])[3], bd = BEARDS.find((q) => q[0] === lk.beard) || BEARDS[0];
    return { shirt: lk.shirt, pants: lk.pants, hair: lk.hair, skin: 0xdcae86, seed: 7, height: 1, build: 1, sleeve: sty.sleeve, vest: sty.vest || undefined, stache: !!bd[2], beard: !!bd[3], hairStyle: lk.hs, player: true }; };
  // qahramon modelini yangi kiyimda qayta quradi (ranglar teri uchlariga pishirilgan — boshqa yo'l yo'q); holati, shlyapasi, asbobi saqlanadi
  const restyle = (lk, hat = st.hat) => {
    const old = pl.rig, r = makeRig(rigOpts(lk)); r.root.visible = old.root.visible; r.root.position.copy(old.root.position); r.root.rotation.copy(old.root.rotation); scene.add(r.root);
    scene.remove(old.root); old.mesh.geometry.dispose(); old.mesh.skeleton.dispose(); pl.rig = r; rigEnv({ player: r }); setHat(r, hat); if (old.toolName) setTool(r, old.toolName); r.actDur = old.actDur;
    for (let i = 0; i < 40; i++) poseRig(r, pl.anim || 'idle', 1 / 30, 0, pl.ctl); H2.look = lk;
  };
  H2.restyle = restyle; H2.lookOf = lookOf;
  if (st.look) restyle(lookOf());

  // ================= TASHQI BINOLAR =================
  const signTex = (txt, bg, fg = '#fff') => { const c = document.createElement('canvas'); c.width = 512; c.height = 112; const x = c.getContext('2d'); x.fillStyle = bg; x.fillRect(0, 0, 512, 112); x.strokeStyle = 'rgba(255,255,255,.55)'; x.lineWidth = 6; x.strokeRect(8, 8, 496, 96); x.fillStyle = fg; x.font = 'bold 58px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(txt, 256, 60); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return new THREE.MeshBasicMaterial({ map: t, fog: true }); };
  const freeAt = (x, z, r) => { for (const o of COL.query(x, z, r)) { if (o.dead) continue; let qx = o.x, qz = o.z; if (o.t === 1) { const sx = o.x2 - o.x, sz = o.z2 - o.z, t = clamp(((x - o.x) * sx + (z - o.z) * sz) / (sx * sx + sz * sz || 1), 0, 1); qx = o.x + sx * t; qz = o.z + sz * t; } if (Math.hypot(x - qx, z - qz) < o.r + r) return false; } return true; };
  H2.freeAt = freeAt;
  // binoni qishloq e'lonlar taxtasi atrofida, yo'lga qaragan tekis joyga qo'yadi; c: ranglar, deco(g) — old tomondagi bezaklar
  const placeBld = (pid, kind, c, r0 = 16) => {
    const P = game.site.places[pid]; if (!P || !P.board) return null; const bx = P.board.x, bz = P.board.z, npcs = L._dbg.npcs;
    for (let rad = r0; rad < 75; rad += 3) for (let k = 0; k < 24; k++) {
      const a = k * 0.2618 + rad * 1.37 + c.seed, x = bx + Math.cos(a) * rad, z = bz + Math.sin(a) * rad, si = T.siteInfo(x, z); if (si.y < si.water + 1 || si.slope > 0.16 || si.roadD < 9 || si.roadD > 30) continue;
      let hmin = 1e9, hmax = -1e9; for (const [dx, dz] of [[-4, -4], [4, -4], [4, 4], [-4, 4], [0, 0], [0, -6], [0, 6]]) { const h = T.gridHeight(x + dx, z + dz); hmin = Math.min(hmin, h); hmax = Math.max(hmax, h); } if (hmax - hmin > 1.2) continue;
      if (!freeAt(x, z, 7) || npcs.some((o) => Math.hypot(o.x - x, o.z - z) < 8) || Math.hypot(x - bx, z - bz) < 10) continue;
      const nr = T.nearestRoad(x, z, 6); const yaw = nr.edge >= 0 ? Math.atan2(T.roads.x[nr.i] - x, T.roads.z[nr.i] - z) : 0;
      const y = hmin + 0.05, co = Math.cos(yaw), s = Math.sin(yaw), W = (lx, lz) => [x + lx * co + lz * s, z - lx * s + lz * co];
      const g = new GB(2101 + H2.bld.length); g.jit = 0.025; g.translate(x, y, z).rotY(yaw);
      g.color(0x9a948a).box(0, -0.6, 0.6, 7.4, 1.4, 6.6); g.color(c.wall).box(0, 1.65, 0, 6.4, 3.3, 5.2); g.color(c.roof).box(0, 3.4, 0, 6.8, 0.25, 5.6); g.color(c.trim).box(0, 3.6, 0, 6.6, 0.2, 5.4);
      g.color(c.trim).box(0, 0.12, 2.62, 6.4, 0.24, 0.04); g.color(0x6e4a30).box(0, 1.1, 2.61, 1.3, 2.2, 0.06); g.color(0x9fd0ff).box(0, 1.35, 2.645, 0.9, 1.4, 0.01); g.color(0xd8b860).box(0.45, 1.05, 2.66, 0.05, 0.25, 0.04);
      for (const sx of [-1, 1]) { g.color(0xf6f6f2).box(sx * 2.0, 1.55, 2.62, 1.8, 1.4, 0.05); g.color(0xbfe4f8).box(sx * 2.0, 1.55, 2.65, 1.6, 1.2, 0.01); }
      for (let i = 0; i < 9; i++) g.color(i % 2 ? c.awn[1] : c.awn[0]).push().translate(-3.2 + i * 0.8 + 0.4, 2.75, 3.15).rotX(0.35).box(0, 0, 0, 0.8, 0.06, 1.2).pop();
      if (c.deco) c.deco(g);
      const m = new THREE.Mesh(g.build(), MAT.flat); m.castShadow = true; m.receiveShadow = true; scene.add(m);
      const sg = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 0.66), signTex(c.sign, c.signBg)); const [sx2, sz2] = W(0, 2.72); sg.position.set(sx2, y + 2.95, sz2); sg.rotation.y = yaw; scene.add(sg);
      COL.addBox(x, z, 3.2, 2.6, yaw, y - 1, y + 3.6); if (c.cols) for (const [lx, lz, r] of c.cols) COL.addCircle(...W(lx, lz), r, y - 1, y + 1.2);
      const [dx, dz] = W(0, 3.5), b = { kind, x: dx, z: dz, yaw, out: [dx, dz, yaw], name: P.name, pid, W, y, cx: x, cz: z, dot: c.dot, label: c.label }; H2.bld.push(b); return b;
    }
    return null;
  };
  const cafeOut = placeBld('bogiston', 'cafe', { seed: 0.4, wall: 0xf2e2c4, roof: 0x2f6aa8, trim: 0x3d8ac8, awn: [0x2f6aa8, 0xf2f2ee], sign: 'CHOYXONA', signBg: '#2f6aa8', dot: '#ff9a3a', label: 'Choyxona',
    deco: (g) => { g.color(0x8a5a36).box(-2.4, 0.3, 4.3, 1.8, 0.12, 1.4); for (const [x, z] of [[-3.2, 3.7], [-1.6, 3.7], [-3.2, 4.9], [-1.6, 4.9]]) g.box(x, 0.12, z, 0.08, 0.24, 0.08); g.color(0xb83a2e).box(-2.4, 0.39, 4.3, 1.7, 0.05, 1.3); g.color(0xf0b83a).box(-2.4, 0.42, 4.3, 1.1, 0.02, 0.8); g.color(0xd8a040).cyl(10, 0.18, 0.22, 0.42, 0.95, { cap: true }).translate(0, 0, 0); g.color(0x6e4a30).box(2.6, 0.45, 3.4, 0.6, 0.9, 0.5); g.color(0xd8a050).cyl(10, 0.14, 0.16, 0.9, 1.3, { cap: true }); },
    cols: [[-2.4, 4.3, 1.0], [2.6, 3.4, 0.4]] });
  const kiyimOut = placeBld('bogiston', 'kiyim', { seed: 2.1, wall: 0xf6eef4, roof: 0x8a3a8a, trim: 0xb860b8, awn: [0x8a3a8a, 0xf6eef4], sign: 'KIYIM-KECHAK', signBg: '#8a3a8a', dot: '#c86aff', label: "Kiyim do'koni",
    deco: (g) => { for (const sx of [-1, 1]) { g.push().translate(sx * 2.0, 0, 3.15); g.color(0xb9bec8).cyl(8, 0.18, 0.18, 0, 0.04, { cap: true }).cyl(5, 0.025, 0.025, 0.04, 0.8); g.color(sx > 0 ? 0xd8392b : 0x2f6fd0).box(0, 1.22, 0, 0.42, 0.55, 0.24); g.color(sx > 0 ? 0x1d1e22 : 0xe8e2d4).box(-0.1, 0.72, 0, 0.17, 0.62, 0.18).box(0.1, 0.72, 0, 0.17, 0.62, 0.18); g.color(0xe8e2d8).cyl(6, 0.05, 0.05, 1.48, 1.56).blob(0.12, 1, { cy: 1.66, sy: 1.25 }); g.pop(); } },
    cols: [[-2.0, 3.15, 0.35], [2.0, 3.15, 0.35]] });
  const sartOut = placeBld('bogiston', 'sart', { seed: 4.7, wall: 0xf4f4f0, roof: 0xb83a3a, trim: 0x2f6fd0, awn: [0xd8392b, 0xf4f4f0], sign: 'SARTAROSH', signBg: '#b83a3a', dot: '#ff5a8a', label: 'Sartaroshxona',
    deco: (g) => { g.color(0xc8ccd4).cyl(8, 0.1, 0.1, 0, 0.3, { cap: true }); for (let i = 0; i < 8; i++) g.color([0xd8392b, 0xf4f4f0, 0x2f6fd0, 0xf4f4f0][i % 4]).push().translate(1.1, 1.0 + i * 0.16, 2.75).cyl(10, 0.09, 0.09, 0, 0.16).pop(); g.color(0xc8ccd4).push().translate(1.1, 0, 2.75).cyl(10, 0.11, 0.11, 2.28, 2.36, { cap: true }).cyl(10, 0.11, 0.11, 0.9, 1.0, { cap: true }).pop(); } });

  // ================= ICHKI MAKONLAR =================
  const mkI = (o) => ({ o, grp: new THREE.Group(), cols: [], spots: [], lampsW: [], rooms: [], patch: null, h: 3 });
  // --- CHOYXONA ---
  const C = (IN.X.cafe = mkI(CAFE_O)); scene.add(C.grp); C.grp.visible = false;
  const menuCan = document.createElement('canvas'); menuCan.width = 512; menuCan.height = 384;
  { const x = menuCan.getContext('2d'); x.fillStyle = '#2a3a2c'; x.fillRect(0, 0, 512, 384); x.strokeStyle = '#c8a060'; x.lineWidth = 10; x.strokeRect(6, 6, 500, 372); x.fillStyle = '#ffe08a'; x.font = 'bold 40px sans-serif'; x.textAlign = 'center'; x.fillText('MENYU', 256, 56);
    x.font = 'bold 28px sans-serif'; MENU.forEach((m, i) => { x.textAlign = 'left'; x.fillStyle = '#f2ead8'; x.fillText(m[1].replace(/ \(.*\)/, ''), 40, 108 + i * 46); x.textAlign = 'right'; x.fillStyle = '#ffd23a'; x.fillText(m[3] + " so'm", 472, 108 + i * 46); }); }
  const menuTex = new THREE.CanvasTexture(menuCan); menuTex.colorSpace = THREE.SRGBColorSpace;
  const TOP = 0.34; // topchan balandligi
  const buildCafe = () => {
    const I = C, o = I.o, g = LB.newGB(2201, o), gw = LB.newGB(2202, o), gl = LB.newGB(2203, o), h = 3.0; I.curtain = 0x2f6aa8;
    const rooms = [{ t: 'cafe', x0: -4, z0: -3.2, x1: 4, z1: 3.2, floor: 0x9a6a42 }], doors = [{ ax: 'z', c: -3.2, a: -0.6, b: 0.6, exit: 1 }];
    LB.buildShell(I, g, gw, gl, rooms, doors, h, 0xf2e2c4, 0xf8f0e0, o);
    // koshin (ko'k naqshli kafel) — devor pastida
    for (const [x, z, w, d] of [[0, 3.13, 7.8, 0.02], [-3.93, 0, 0.02, 6.2], [3.93, 0, 0.02, 6.2]]) { g.color(0x3d7ab8).box(x, 0.55, z, w, 1.1, d); g.color(0xf2f2ee).box(x, 1.12, z, w, 0.05, d); }
    for (let i = 0; i < 12; i++) g.color(i % 2 ? 0xf2f2ee : 0x2f5a98).box(-3.6 + i * 0.66, 0.55, 3.115, 0.26, 0.26, 0.01);
    // oshxona: peshtaxta, qozon (osh), samovar, non, javon
    LB.putF(I, g, gl, 0, 2.78, Math.PI, (q) => F.counter(q, 4.4, 0xd8d2c6, 0x7a4e2e), [2.2, 0.32, 1.1], o);
    LB.putF(I, g, gl, -1.3, 2.78, Math.PI, (q) => { q.color(0x2a2c33).cyl(14, 0.34, 0.24, 0.9, 1.18, { cap: true }); q.color(0xe89a3a).blob(0.3, 1, { cy: 1.2, sy: 0.32 }); q.color(0xd8602a); for (let i = 0; i < 7; i++) q.box(Math.sin(i * 2.3) * 0.16, 1.28, Math.cos(i * 2.3) * 0.16, 0.06, 0.02, 0.015); q.color(0x6a3a22); for (let i = 0; i < 4; i++) q.blob(0.04, 0, { cx: Math.sin(i * 1.7) * 0.1, cy: 1.29, cz: Math.cos(i * 1.7) * 0.1 }); }, null, o);
    LB.putF(I, g, gl, 1.4, 2.78, Math.PI, (q) => { q.color(0xd8a040).cyl(10, 0.13, 0.15, 0.91, 1.25, { cap: true }); q.cyl(10, 0.08, 0.12, 1.25, 1.36, { cap: true }); q.color(0x2a2c33).cyl(6, 0.03, 0.03, 1.36, 1.42, { cap: true }); q.color(0xd8a040).box(0, 1.0, 0.17, 0.03, 0.03, 0.1); q.color(0x3d74a6).push().translate(0, 1.42, 0).cyl(10, 0.07, 0.06, 0, 0.12, { cap: true }).pop(); }, null, o);
    LB.putF(I, g, gl, 0.3, 2.78, Math.PI, (q) => { q.color(0xe0a050); for (let i = 0; i < 5; i++) q.push().translate(-0.25 + (i % 3) * 0.25, 0.92 + Math.floor(i / 3) * 0.05, (i % 2) * 0.1).cyl(12, 0.12, 0.12, 0, 0.04, { cap: true }).pop(); }, null, o);
    LB.putF(I, g, gl, 0, 3.08, Math.PI, (q) => { q.color(0x7a4e2e); for (const y of [1.55, 2.0]) q.box(0, y, 0, 3.6, 0.04, 0.24); for (let i = 0; i < 14; i++) { q.push().translate(-1.6 + i * 0.25, 1.57, 0).color(0xf2f2ee).cyl(8, 0.06, 0.04, 0, 0.07, { cap: true }).color(0x2f5a98).cyl(8, 0.061, 0.055, 0.025, 0.045).pop(); q.push().translate(-1.6 + i * 0.25, 2.02, 0).color(i % 3 ? 0x3d74a6 : 0xf2f2ee).cyl(8, 0.06, 0.07, 0, 0.18, { cap: true }).pop(); } }, null, o);
    // menyu taxtasi (o'ng devorda)
    const mb = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.12), new THREE.MeshBasicMaterial({ map: menuTex, fog: false })); mb.position.set(o[0] + 3.92, o[1] + 1.95, o[2] - 0.3); mb.rotation.y = -Math.PI / 2; mb.frustumCulled = false; I.grp.add(mb);
    // topchanlar (chapda): platforma (ustiga chiqiladi), gilam, ko'rpacha, past stol
    I.seats = [];
    for (const zc of [-1.5, 0.9]) {
      LB.putF(I, g, gl, -3.05, zc, 0, (q) => { q.color(0x8a5a36).box(0, TOP / 2, 0, 1.7, TOP, 1.8); q.color(0x6e4a30); for (const [x, z] of [[-0.82, -0.86], [0.82, -0.86], [-0.82, 0.86], [0.82, 0.86]]) q.box(x, TOP / 2, z, 0.08, TOP, 0.08); q.box(0, TOP - 0.02, 0.9, 1.72, 0.06, 0.04); q.box(0.85, TOP - 0.02, 0, 0.04, 0.06, 1.82);
        q.color(0xb83a2e).box(0, TOP + 0.01, 0, 1.6, 0.02, 1.7); q.color(0xf0b83a).box(0, TOP + 0.022, 0, 1.2, 0.006, 1.3); q.color(0x2f5a98).box(0, TOP + 0.026, 0, 0.6, 0.006, 0.7);
        q.color(0x8a3a5a).box(-0.78, TOP + 0.3, 0, 0.14, 0.5, 1.6); // devorga suyanchiq yostiq
        q.color(0x6e4a30).box(0.2, TOP + 0.6, 0, 0.7, 0.05, 0.9); for (const [x, z] of [[-0.1, -0.38], [0.5, -0.38], [-0.1, 0.38], [0.5, 0.38]]) q.box(x, TOP + 0.3, z, 0.05, 0.6, 0.05);
        q.color(0xd8392b).box(-0.52, TOP + 0.19, 0, 0.42, 0.34, 0.6); q.color(0xf0b83a).box(-0.52, TOP + 0.365, 0, 0.42, 0.012, 0.6); q.color(0x2f5a98).box(-0.52, TOP + 0.1, 0, 0.43, 0.04, 0.61); }, null, o);
      COL.addBox(o[0] - 2.85, o[2] + zc, 0.36, 0.45, 0, o[1] + TOP - 0.2, o[1] + TOP + 0.65);
      T.addPatch(o[0] - 3.05, o[2] + zc, 0, 1.8, 1.7, o[1] + TOP, o[1] + TOP, T.SURF.WOOD);
      I.seats.push(LB.spot(I, 'csit', -3.57, zc, Math.PI / 2, { table: [-2.85, zc], top: TOP + 0.62, serve: [-1.8, zc], r: 2.0, topchan: 1 }));
    }
    // stollar (o'ngda), stullar
    for (const zc of [-1.5, 0.9]) {
      LB.putF(I, g, gl, 2.75, zc, 0, (q) => { F.table(q, 1.0, 0.85, 0x7a4e2e); q.color(0xf2ead8).box(0, 0.764, 0, 1.06, 0.006, 0.91); q.color(0x3d74a6).box(0, 0.768, 0, 1.07, 0.004, 0.25); }, [0.52, 0.45, 0.8], o);
      for (const [cz, yaw] of [[zc - 0.68, 0], [zc + 0.68, Math.PI]]) { LB.putF(I, g, gl, 2.75, cz, yaw, (q) => F.chair(q, 0x7a4e2e), null, o); I.seats.push(LB.spot(I, 'csit', 2.75, cz, yaw, { table: [2.75, zc], top: 0.77, serve: [1.85, zc], r: 0.9 })); }
    }
    // bezaklar: so'zana, o'simlik, gilam, chiroqlar
    LB.putF(I, g, gl, -3.93, -0.3, Math.PI / 2, (q) => { q.translate(0, 1.95, 0); q.color(0xf2ead8).box(0, 0, 0, 2.2, 1.0, 0.02); q.color(0xb83a2e); for (let i = 0; i < 5; i++) q.blob(0.14, 0, { cx: -0.8 + i * 0.4, cz: 0.01, sz: 0.1 }); q.color(0x3f7a4a); for (let i = 0; i < 4; i++) q.blob(0.08, 0, { cx: -0.6 + i * 0.4, cy: 0.28, cz: 0.012, sz: 0.1 }); q.color(0x2f5a98).box(0, -0.45, 0.012, 2.1, 0.06, 0.01); }, null, o);
    LB.putF(I, g, gl, 3.65, 2.85, 0, (q) => F.plant(q, true), [0.25, 0.25, 1], o); LB.putF(I, g, gl, 3.65, -2.85, 0, (q) => F.plant(q), [0.2, 0.2, 1], o);
    LB.putF(I, g, gl, 0, -0.3, 0, (q) => F.rug(q, 1.4, 4.2, 0xb83a2e, 0xf0b83a), null, o);
    const lamps = []; for (const [x, z] of [[-2.2, -1.2], [2.2, -1.2], [-2.2, 1.2], [2.2, 1.2]]) { LB.putF(I, g, gl, x, z, 0, (q, ql) => F.ceilLamp(ql, h), null, o); lamps.push([x, h - 0.3, z, 0.8]); }
    LB.spot(I, 'door', 0, -2.85, Math.PI); I.entry = [0, -2.5, 0];
    LB.finish(I, g, gw, gl, lamps, 1.0); I.rooms = rooms; I.grp.visible = false;
  };
  buildCafe();
  // ofitsiant va mijozlar
  const waiter = makeRig({ shirt: 0xf6f6f2, pants: 0x1d1e22, hair: 0x15110e, seed: 61, vest: 0x2a2c33, sleeve: 1, stache: true }); C.grp.add(waiter.root);
  const W0 = [0, 2.05]; const WT = { x: C.o[0] + W0[0], z: C.o[2] + W0[1], yaw: Math.PI, path: [], ph: 'idle', t: 0, carry: [], seat: null }; H2.waiter = WT;
  const guests = [[makeRig({ shirt: 0x3f7a4a, pants: 0x2a2c33, seed: 62, stache: true, hair: 0xb8bcc4 }), -3.57 + 0.1, 0.9, Math.PI / 2, TOP], [makeRig({ shirt: 0x8a54c8, pants: 0x3a3f4c, seed: 63, long: true }), 2.75, 0.9 + 0.68, Math.PI, 0]];
  for (const [r, x, z, yaw, y] of guests) { r.root.position.set(C.o[0] + x, C.o[1] + y, C.o[2] + z); r.root.rotation.y = yaw; C.grp.add(r.root); }
  C.seats = C.seats.filter((sp) => !guests.some((q) => Math.hypot(sp.lx - q[1], sp.lz - q[2]) < 0.6));
  // taomlar (stolga qo'yiladigan modellar)
  const DISH = {
    osh: (g) => { g.color(0xf2f2ee).cyl(14, 0.17, 0.12, 0, 0.03, { cap: true }); g.color(0x2f5a98).cyl(14, 0.171, 0.165, 0.02, 0.03); g.color(0xf0c060).blob(0.12, 1, { cy: 0.05, sy: 0.42 }); g.color(0xe8762a); for (let i = 0; i < 9; i++) g.box(Math.sin(i * 2.1) * 0.07, 0.085, Math.cos(i * 2.1) * 0.07, 0.04, 0.012, 0.01); g.color(0x6a3a22); for (let i = 0; i < 4; i++) g.blob(0.028, 0, { cx: Math.sin(i * 1.6) * 0.05, cy: 0.1, cz: Math.cos(i * 1.6) * 0.05 }); },
    somsa: (g) => { g.color(0xf2f2ee).cyl(12, 0.13, 0.1, 0, 0.02, { cap: true }); g.color(0xd89a48); for (const x of [-0.05, 0.06]) g.push().translate(x, 0.045, 0).rotY(x * 9).prism(3, 0.07, 0.07, -0.025, 0.025).pop(); g.color(0xf2e2b0); for (const x of [-0.05, 0.06]) g.blob(0.008, 0, { cx: x, cy: 0.07 }); },
    lagmon: (g) => { g.color(0xf2f2ee).cyl(12, 0.12, 0.07, 0, 0.09, { cap: true }); g.color(0x2f5a98).cyl(12, 0.122, 0.118, 0.07, 0.085); g.color(0xb8402a).cyl(12, 0.105, 0.105, 0.075, 0.08, { cap: true }); g.color(0xf2d890); for (let i = 0; i < 6; i++) g.box(Math.sin(i) * 0.04, 0.085, Math.cos(i * 1.3) * 0.04, 0.12, 0.008, 0.008); g.color(0x4f9e48); for (let i = 0; i < 3; i++) g.blob(0.018, 0, { cx: Math.sin(i * 2) * 0.05, cy: 0.09, cz: Math.cos(i * 2) * 0.05 }); },
    non: (g) => { g.color(0xd89040).cyl(14, 0.13, 0.13, 0, 0.035, { cap: true }); g.color(0xf0c070).cyl(12, 0.08, 0.08, 0.035, 0.04, { cap: true }); g.color(0x9a5a2a); for (let i = 0; i < 10; i++) g.box(Math.sin(i * 2.4) * 0.05, 0.042, Math.cos(i * 2.4) * 0.05, 0.008, 0.004, 0.008); },
    choy: (g) => { g.color(0xf2f2ee).cyl(10, 0.07, 0.06, 0, 0.12, { cap: true }); g.color(0x2f5a98).cyl(10, 0.071, 0.07, 0.05, 0.08); g.color(0xf2f2ee).cyl(8, 0.03, 0.035, 0.12, 0.15, { cap: true }); g.push().translate(0.08, 0.07, 0).rotZ(-0.8).cyl(5, 0.015, 0.01, 0, 0.08).pop(); g.push().translate(-0.14, 0, 0.06).color(0xf2f2ee).cyl(8, 0.04, 0.03, 0, 0.045, { cap: true }).color(0xb88a3a).cyl(8, 0.035, 0.035, 0.035, 0.04, { cap: true }).pop(); },
    kompot: (g) => { g.color(0xdfeef5).cyl(10, 0.06, 0.06, 0, 0.18, { cap: true }); g.color(0xb8203a).cyl(10, 0.055, 0.055, 0.01, 0.14, { cap: true }); g.push().translate(0.12, 0, 0.05).color(0xdfeef5).cyl(8, 0.035, 0.03, 0, 0.1, { cap: true }).color(0xb8203a).cyl(8, 0.031, 0.027, 0.01, 0.075, { cap: true }).pop(); },
  };
  const dishPool = {}; for (const id in DISH) dishPool[id] = [0, 1].map(() => { const g = new GB(2300); g.jit = 0; DISH[id](g); const m = new THREE.Mesh(g.build(), MAT.flat); m.visible = false; m.castShadow = true; C.grp.add(m); return m; });
  const takeDish = (id) => dishPool[id].find((m) => !m.visible) || null;
  const SLOTS = [[0, 0.16], [-0.24, 0.12], [0.24, 0.12], [0, -0.12]]; // stolda: o'tirgan tomonga yaqin (mahalliy: +z — o'tirgan tomon)
  const putDishes = (sp, ids) => { const [tx, tz] = [C.o[0] + sp.table[0], C.o[2] + sp.table[1]], dx = (pl.p[0] - tx) || Math.sin(sp.yaw + Math.PI), dz = (pl.p[2] - tz) || Math.cos(sp.yaw + Math.PI), a = Math.atan2(-Math.sin(sp.yaw), -Math.cos(sp.yaw)); void dx; void dz;
    for (const id of ids) { if (H2.dishes.length >= 4) break; const m = takeDish(id); if (!m) continue; const sl = SLOTS[H2.dishes.length], c = Math.cos(a), s = Math.sin(a); m.position.set(tx + sl[0] * c + sl[1] * s, C.o[1] + sp.top, tz - sl[0] * s + sl[1] * c); m.rotation.y = a + Math.PI; m.scale.setScalar(1); m.visible = true; H2.dishes.push({ id, m, sp }); } };
  const clearDishes = () => { for (const d of H2.dishes) d.m.visible = false; H2.dishes.length = 0; };
  H2.menu = MENU; H2.clearDishes = clearDishes;
  // buyurtma: pul olinadi, ofitsiant oshxonadan stolga olib keladi
  H2.order = (id) => { const m = MENU.find((q) => q[0] === id); const sp = HY.seat; if (!m || !sp || sp.k !== 'csit') return false; if (st.money < m[3]) { toast("Pul yetarli emas", 'bad'); return false; }
    if (H2.dishes.length + WT.carry.length >= 4) { toast("Stolga boshqa sig'maydi — avval yeb oling 🙂"); return false; }
    game.addMoney(-m[3], "Choyxona: " + m[1]); WT.carry.push(id); if (WT.ph === 'idle' || WT.ph === 'back') { WT.seat = sp; const s = sp.serve; WT.path = [[C.o[0], C.o[2] + s[1]], [C.o[0] + s[0], C.o[2] + s[1]]]; WT.ph = 'go'; } sfx('buy'); return true; };
  // stolda ovqatlanish: eng avval ovqat, keyin ichimlik
  const eatNext = () => { const d = H2.dishes.find((q) => !DRINKS.includes(q.id)) || H2.dishes[0]; if (!d) return; const m = MENU.find((q) => q[0] === d.id), drink = DRINKS.includes(d.id);
    const sp = HY.seat; pl.act(drink ? 'drink' : 'eat', drink ? 2.6 : 4.4, () => { d.m.visible = false; H2.dishes.splice(H2.dishes.indexOf(d), 1); pl.sit = true; HY.seat = sp; const a = st.sat;
      st.sat = clamp(st.sat + m[4], 0, 100); st.thirst = clamp(st.thirst + m[5], 0, 100); st.energy = Math.min(100, st.energy + m[6]); L.count('eat'); st.stats.cafe = (st.stats.cafe || 0) + 1; sfx(drink ? 'sip' : 'eat');
      toast(`${m[2]} ${m[1]} — ${drink ? 'rohat!' : 'juda mazali!'} · to'qlik ${Math.round(a)}% → ${Math.round(st.sat)}% · 💧 ${Math.round(st.thirst)}%`, 'good'); }, drink ? 'cup' : 'spoon'); pl.sit = true; HY.seat = sp; d.eating = true; };
  H2.eatNext = eatNext;
  const sitCafe = (sp) => { pl.p[0] = sp.x + Math.sin(sp.yaw) * 0.1; pl.p[2] = sp.z + Math.cos(sp.yaw) * 0.1; pl.p[1] = T.ground(pl.p[0], pl.p[2], pl.p[1] + 1).y; pl.yaw = sp.yaw; pl.v[0] = pl.v[2] = 0; pl.sit = true; pl.emote = null; HY.seat = sp;
    if (H2.dishes.length && H2.dishes[0].sp !== sp) clearDishes(); if (!H2.toldSit) { H2.toldSit = 1; toast("Ofitsiant: «Xush kelibsiz! Menyuni ko'rasizmi?» — [E]", 'gold'); } };

  // --- KIYIM DO'KONI ---
  const K = (IN.X.kiyim = mkI(KIYIM_O)); scene.add(K.grp); K.grp.visible = false;
  const buildKiyim = () => {
    const I = K, o = I.o, g = LB.newGB(2401, o), gw = LB.newGB(2402, o), gl = LB.newGB(2403, o), h = 3.0;
    const rooms = [{ t: 'shop', x0: -3.4, z0: -2.8, x1: 3.4, z1: 2.8, floor: 0xe8e0d6 }], doors = [{ ax: 'z', c: -2.8, a: -0.6, b: 0.6, exit: 1 }];
    LB.buildShell(I, g, gw, gl, rooms, doors, h, 0xf6eef4, 0xfdfaf8, o);
    g.color(0x8a3a8a).box(0, 2.62, 2.73, 6.6, 0.4, 0.02); g.color(0xb860b8).box(0, 2.4, 2.73, 6.6, 0.05, 0.02);
    // kiyim osilgan ilgichlar (chap va o'ng devor)
    for (const [x, yaw] of [[-3.05, Math.PI / 2], [3.05, -Math.PI / 2]]) LB.putF(I, g, gl, x, -0.2, yaw, (q) => { q.color(0xb9bec8).box(0, 1.75, 0.1, 3.2, 0.03, 0.03); for (const sx of [-1.55, 1.55]) q.box(sx, 0.88, 0.1, 0.04, 1.76, 0.04);
      for (let i = 0; i < 12; i++) { const c = (x < 0 ? SHIRTS : [...PANTS, ...PANTS])[i % (x < 0 ? SHIRTS.length : 6)][0]; q.color(c).box(-1.4 + i * 0.255, 1.36, 0.1, 0.22, x < 0 ? 0.62 : 0.8, 0.07); q.color(0xb9bec8).box(-1.4 + i * 0.255, 1.7, 0.1, 0.18, 0.02, 0.02); } }, [1.6, 0.2, 2], o);
    // peshtaxta va sotuvchi, buklangan kiyim stoli, manekenlar
    LB.putF(I, g, gl, 1.6, 2.15, Math.PI, (q) => { q.color(0x6e4a6e).box(0, 0.5, 0, 1.8, 1.0, 0.55); q.color(0xf6eef4).box(0, 1.02, 0, 1.9, 0.05, 0.6); q.color(0x2a2c33).box(0.5, 1.12, 0, 0.36, 0.18, 0.28); }, [0.95, 0.3, 1.2], o);
    LB.putF(I, g, gl, 0, 0.6, 0, (q) => { F.table(q, 1.4, 0.8, 0xd8c8b8, 0.8); for (let i = 0; i < 6; i++) q.color(SHIRTS[(i * 3) % SHIRTS.length][0]).box(-0.5 + (i % 3) * 0.5, 0.83 + Math.floor(i / 3) * 0.06, (i % 2) * 0.1 - 0.05, 0.36, 0.05, 0.3); }, [0.72, 0.42, 1], o);
    // katta ko'zgu (orqa devorda) — oldida turib kiyim tanlanadi
    LB.putF(I, g, gl, -1.4, 2.76, Math.PI, (q, ql) => { q.color(0xd8b860).box(0, 1.15, 0, 1.0, 2.1, 0.05); ql.color(0xd8e8f2).box(0, 1.15, -0.03, 0.88, 1.96, 0.01); }, null, o);
    LB.spot(I, 'kiyim', -1.4, 0.2, 0, { r: 1.2 }); LB.spot(I, 'kassa', 1.6, 1.4, 0, { r: 1.0 });
    // kiyinish xonachasi (parda)
    LB.putF(I, g, gl, -2.7, -2.1, 0, (q) => { q.color(0xb9bec8).box(0, 2.1, 0, 1.2, 0.03, 0.03); q.color(0x8a3a8a); for (let i = 0; i < 6; i++) q.box(-0.5 + i * 0.2, 1.15, (i % 2) * 0.04, 0.2, 1.9, 0.02); }, null, o);
    const lamps = []; for (const [x, z] of [[-1.6, -1.2], [1.6, -1.2], [-1.6, 1.2], [1.6, 1.2]]) { LB.putF(I, g, gl, x, z, 0, (q, ql) => ql.color(0xf6fbff).box(0, h - 0.04, 0, 1.2, 0.05, 0.2), null, o); lamps.push([x, h - 0.3, z, 0.85]); }
    LB.spot(I, 'door', 0, -2.45, Math.PI); I.entry = [0, -2.0, 0];
    LB.finish(I, g, gw, gl, lamps, 1.02); I.rooms = rooms; I.grp.visible = false;
  };
  buildKiyim();
  const seller = makeRig({ shirt: 0xb860b8, pants: 0x2a2c33, seed: 71, long: true, hair: 0x4a2a1a }); seller.root.position.set(K.o[0] + 1.6, K.o[1], K.o[2] + 2.6); seller.root.rotation.y = Math.PI; K.grp.add(seller.root);
  const manek = [[0xd8392b, 0x1d1e22, 0x2a2c33, -0.6], [0x2f6fd0, 0xe8e2d4, 0, 0.9]].map(([sh, pa, ve, x]) => { const r = makeRig({ shirt: sh, pants: pa, vest: ve || undefined, seed: 80, sleeve: 1, skin: 0xe8e2d8, hair: 0xe8e2d8, stache: false }); r.root.position.set(K.o[0] + x + (x < 0 ? -0.6 : 0.6), K.o[1], K.o[2] - 2.2); r.root.rotation.y = 0; K.grp.add(r.root); for (let i = 0; i < 20; i++) poseRig(r, 'idle', 1 / 30, 0); return r; });
  void manek;

  // --- SARTAROSHXONA ---
  const S2 = (IN.X.sart = mkI(SART_O)); scene.add(S2.grp); S2.grp.visible = false;
  const buildSart = () => {
    const I = S2, o = I.o, g = LB.newGB(2501, o), gw = LB.newGB(2502, o), gl = LB.newGB(2503, o), h = 2.9;
    const rooms = [{ t: 'shop', x0: -3.0, z0: -2.6, x1: 3.0, z1: 2.6, floor: 0xdcdcd4 }], doors = [{ ax: 'z', c: -2.6, a: -0.6, b: 0.6, exit: 1 }];
    LB.buildShell(I, g, gw, gl, rooms, doors, h, 0xf2f6f4, 0xfafcfb, o);
    for (let i = 0; i < 15; i++) for (let j = 0; j < 13; j++) if ((i + j) % 2) g.color(0x2a2c33).box(-2.8 + i * 0.4, 0.003, -2.4 + j * 0.4, 0.4, 0.004, 0.4); // shaxmat pol
    for (const cx of [-1.0, 1.0]) {
      // ko'zgu, javoncha, sartarosh kreslosi
      LB.putF(I, g, gl, cx, 2.55, Math.PI, (q, ql) => { q.color(0x2a2c33).box(0, 1.5, 0, 1.0, 1.1, 0.04); ql.color(0xd8e8f2).box(0, 1.5, -0.025, 0.9, 1.0, 0.01); q.color(0xf2f2ee).box(0, 0.85, -0.1, 1.1, 0.06, 0.3); q.color(0x4fb0ff).cyl(8, 0.04, 0.04, 0.88, 1.08, { cap: true }); q.color(0xff8a3a).push().translate(0.25, 0, 0).cyl(8, 0.03, 0.03, 0.88, 1.02, { cap: true }).pop(); q.color(0x2a2c33).push().translate(-0.25, 0, -0.05).box(0, 0.9, 0, 0.18, 0.04, 0.08).pop(); }, [0.55, 0.2, 1.2], o);
      LB.putF(I, g, gl, cx, 1.55, 0, (q) => { q.color(0xb9bec8).cyl(10, 0.28, 0.3, 0, 0.06, { cap: true }); q.cyl(6, 0.05, 0.05, 0.06, 0.38); q.color(0xb83a2e).box(0, 0.46, 0, 0.56, 0.12, 0.55); q.box(0, 0.85, -0.25, 0.56, 0.7, 0.1); q.box(0, 1.28, -0.27, 0.3, 0.18, 0.08); for (const sx of [-1, 1]) q.color(0x2a2c33).box(sx * 0.3, 0.62, 0, 0.06, 0.05, 0.5); q.color(0x2a2c33).box(0, 0.12, 0.42, 0.4, 0.04, 0.16); }, null, o);
    }
    LB.spot(I, 'sartarosh', -1.0, 1.55, 0, { r: 1.1, chair: 1 });
    // kutish skameykasi, plakatlar, lavabo
    LB.putF(I, g, gl, -2.0, -1.9, Math.PI / 2, (q) => F.sofa(q, 1.6, 0x3d74a6), [0.8, 0.42, 0.9], o);
    for (let i = 0; i < 3; i++) LB.putF(I, g, gl, -2.96, 0.0 + i * 0.75 - 0.4, Math.PI / 2, (q) => { q.translate(0, 1.7, 0); F.frame(q, 0.55, 0.7, [0x7cc4e8, 0xf0c070, 0xff8ab0][i]); q.color(0x2a1d16).blob(0.11, 1, { cy: 0.12, cz: 0.025, sz: 0.3 }); q.color(0xe2b48e).blob(0.08, 0, { cy: 0.02, cz: 0.025, sz: 0.3 }); }, null, o);
    LB.putF(I, g, gl, 2.4, -1.6, -Math.PI / 2, (q) => F.sink(q), [0.45, 0.3, 1], o); LB.putF(I, g, gl, 2.65, 0.6, 0, (q) => F.plant(q, true), [0.25, 0.25, 1], o);
    const lamps = []; for (const [x, z] of [[-1.0, 1.2], [1.0, 1.2], [0, -1.3]]) { LB.putF(I, g, gl, x, z, 0, (q, ql) => F.ceilLamp(ql, h), null, o); lamps.push([x, h - 0.3, z, 0.9]); }
    LB.spot(I, 'door', 0, -2.25, Math.PI); I.entry = [0, -1.8, 0];
    LB.finish(I, g, gw, gl, lamps, 1.02); I.rooms = rooms; I.grp.visible = false;
  };
  buildSart();
  const barber = makeRig({ shirt: 0xf6f6f2, pants: 0x2a2c33, seed: 91, hair: 0x15110e, stache: true, sleeve: 0.42 }); barber.root.position.set(S2.o[0] - 0.3, S2.o[1], S2.o[2] + 0.9); S2.grp.add(barber.root);
  const reader = makeRig({ shirt: 0x6a8a5a, pants: 0x3a3f4c, seed: 92 }); reader.root.position.set(S2.o[0] - 1.95, S2.o[1], S2.o[2] - 1.9); reader.root.rotation.y = Math.PI / 2; S2.grp.add(reader.root); setTool(reader, 'paper');
  const BR = { x: barber.root.position.x, z: barber.root.position.z, cut: null }; H2.barber = BR;

  // ================= KIRISH VA [E] TAKLIFLARI =================
  const NAMES = { cafe: 'Choyxona', kiyim: "Kiyim do'koni", sart: 'Sartaroshxona' };
  const GREET = { cafe: ['Ofitsiant Sobir aka: «Xush kelibsiz! Joy tanlang, menyu stolda»', "Ofitsiant: «Bugun osh juda zo'r chiqdi — qozondan yangi!»"], kiyim: ["Sotuvchi Nilufar: «Xush kelibsiz! Ko'zgu oldida bemalol kiyib ko'ring»", 'Sotuvchi: «Yangi kolleksiya keldi — jiletlar va shlyapalar!»'], sart: ["Sartarosh Akmal usta: «Keling, o'tiring! Qanday qilamiz?»", 'Sartarosh: «Soch ham, soqol ham — bir zumda!»'] };
  H2.enter = (b) => { IN.enter(b.kind, b.out); clearDishes(); WT.carry.length = 0; WT.ph = 'idle'; WT.path = []; WT.x = C.o[0] + W0[0]; WT.z = C.o[2] + W0[1]; H2.toldSit = 0; const gr = GREET[b.kind]; toast(gr[(Math.random() * gr.length) | 0], 'gold'); sfx('bell'); };
  const spotText = (sp) => { const sit = pl.sit && HY.seat === sp;
    switch (sp.k) {
      case 'csit': if (!sit) return sp.topchan ? "<kbd>E</kbd> Topchanga o'tirish 🧺" : "<kbd>E</kbd> Stolga o'tirish 🪑";
        if (H2.dishes.length && pl.lock <= 0) { const d = H2.dishes.find((q) => !DRINKS.includes(q.id)) || H2.dishes[0], m = MENU.find((q) => q[0] === d.id); return `<kbd>E</kbd> ${DRINKS.includes(d.id) ? 'Ichish' : 'Ovqatlanish'}: ${m[2]} ${m[1]}`; }
        return WT.carry.length ? 'Ofitsiant buyurtmani olib kelyapti… 🍽' : '<kbd>E</kbd> Menyu — buyurtma berish 📜';
      case 'kiyim': return "<kbd>E</kbd> Ko'zgu oldida kiyinish 👕";
      case 'kassa': return "<kbd>E</kbd> Sotuvchi — kiyimlar 🛍";
      case 'wardrobe': return "<kbd>E</kbd> Shkaf — kiyim almashtirish 👔";
      case 'sartarosh': return sit ? "<kbd>E</kbd> Soch turmagini tanlash ✂️" : "<kbd>E</kbd> Kresloga o'tirish 💈";
    } return null; };
  const spotAct = (sp) => { const sit = pl.sit && HY.seat === sp;
    switch (sp.k) {
      case 'csit': if (!sit) return sitCafe(sp); if (H2.dishes.length) return eatNext(); if (!WT.carry.length) return game.ui.open('choyxona'); return;
      case 'kiyim': case 'kassa': { const s = IN.cur().spots.find((q) => q.k === 'kiyim'); pl.p[0] = s.x; pl.p[2] = s.z; pl.yaw = s.yaw; pl.v[0] = pl.v[2] = 0; pl.sit = false; settle(); return game.ui.open('kiyim', { mode: 'shop' }); }
      case 'wardrobe': pl.yaw = sp.yaw + Math.PI; settle(); return game.ui.open('kiyim', { mode: 'own' });
      case 'sartarosh': if (BR.cut) return; if (!sit) { pl.p[0] = sp.x; pl.p[2] = sp.z + 0.05; pl.yaw = 0; pl.v[0] = pl.v[2] = 0; pl.sit = true; pl.emote = null; HY.seat = sp; return; } return game.ui.open('sartarosh');
    } };
  // ko'zgu oldiga ko'chirilgach oyoqlar eski joyda qolmasin: oyna ochilganda o'yin to'xtaydi, shuning uchun holatni darhol joyiga keltiramiz
  const settle = () => { const r = pl.rig; r.root.position.set(pl.p[0], pl.p[1], pl.p[2]); r.root.rotation.y = pl.yaw; pl.ctl.vx = pl.ctl.vz = 0; for (let i = 0; i < 45; i++) poseRig(r, 'idle', 1 / 30, 0, pl.ctl); };
  H2.spotAct = spotAct; H2.spotText = spotText; H2.spot = (k) => { const I = IN.cur(); return I && I.spots.find((s) => s.k === k); };
  const ex0 = L.extra;
  L.extra = (offer, px, pz, p) => { ex0(offer, px, pz, p); if (HY.dlg) return; const I = IN.cur();
    if (I) { for (const sp of I.spots) { const sit = pl.sit && HY.seat === sp, d = Math.hypot(sp.x - px, sp.z - pz); if (d > sp.r && !sit) continue; const tx = spotText(sp); if (tx) offer(sit ? -2 : d - 0.05, tx, () => spotAct(sp)); } }
    else for (const b of H2.bld) { const d = Math.hypot(b.x - px, b.z - pz); if (d < 2.3) offer(d - 0.1, `<kbd>E</kbd> ${NAMES[b.kind]}ga kirish ${b.kind === 'cafe' ? '🍵' : b.kind === 'kiyim' ? '👕' : '💈'}`, () => H2.enter(b)); } };

  // ================= KADR YANGILANISHI =================
  const up0 = L.update;
  L.update = (dt) => { up0(dt); const k = IN.inside;
    if (k && IN.X[k]) { game.curPlace = { name: NAMES[k] }; game.region = k === 'cafe' ? (HY.seat && HY.seat.k === 'csit' ? (HY.seat.topchan ? 'Topchanda' : 'Stol atrofida') : 'Ofitsiant Sobir aka') : k === 'kiyim' ? 'Sotuvchi Nilufar' : 'Akmal usta'; if (HY.seat && !pl.sit) { if (HY.seat.k === 'csit' && H2.dishes.length && pl.lock <= 0) clearDishes(); HY.seat = null; } }
    if (BR.cut) L.prompt = `✂️ Sartarosh ishlayapti… ${Math.min(100, Math.round(BR.cut.t / BR.cut.dur * 100))}%`;
    for (const b of H2.bld) L.dots.push([b.x, b.z, b.dot]); };
  // ofitsiant, mijozlar, sotuvchi, sartarosh — faqat ichkarida bo'lganda
  const stepTo = (o, tx, tz, v, dt) => { const dx = tx - o.x, dz = tz - o.z, d = Math.hypot(dx, dz); if (d < 0.05) return true; const s = Math.min(d, v * dt); o.x += dx / d * s; o.z += dz / d * s; o.yaw = Math.atan2(dx, dz); return d - s < 0.05; };
  game.hooks.push((dt) => {
    const k = IN.inside; if (!k || !IN.X[k]) return;
    if (k === 'cafe') {
      const w = WT; let an = 'idle', sp = 0;
      if (w.ph === 'go' || w.ph === 'back') { setTool(waiter, w.ph === 'go' ? 'tray' : null); if (w.path.length) { if (stepTo(w, w.path[0][0], w.path[0][1], 1.7, dt)) w.path.shift(); an = 'walk'; sp = 1.7; }
        if (!w.path.length) { if (w.ph === 'go') { w.ph = 'serve'; w.t = 0; const s = w.seat; w.yaw = Math.atan2(C.o[0] + s.table[0] - w.x, C.o[2] + s.table[1] - w.z); waiter.actDur = 1.2; } else { w.ph = 'idle'; w.yaw = Math.PI; } } }
      else if (w.ph === 'serve') { an = 'bend'; w.t += dt; if (w.t > 1.0) { setTool(waiter, null); if (HY.seat === w.seat) { putDishes(w.seat, w.carry); toast('Ofitsiant: «Yoqimli ishtaha! 😊» — [E] bilan yeng', 'gold'); sfx('pop'); } w.carry.length = 0; w.ph = 'back'; const s = w.seat.serve; w.path = [[C.o[0], C.o[2] + s[1]], [C.o[0] + W0[0], C.o[2] + W0[1]]]; } }
      else if (w.carry.length && HY.seat && HY.seat.k === 'csit') { w.seat = HY.seat; const s = w.seat.serve; w.path = [[C.o[0], C.o[2] + s[1]], [C.o[0] + s[0], C.o[2] + s[1]]]; w.ph = 'go'; }
      else if (Math.hypot(pl.p[0] - w.x, pl.p[2] - w.z) < 3) w.yaw = Math.atan2(pl.p[0] - w.x, pl.p[2] - w.z);
      waiter.root.position.set(w.x, C.o[1], w.z); waiter.root.rotation.y = w.yaw; poseRig(waiter, an, dt, sp);
      H2.gT = (H2.gT || 0) + dt; const [g1, g2] = guests; g1[0].actDur = 2.6; poseRig(g1[0], 'sit', dt, 0); g2[0].actDur = 4; poseRig(g2[0], H2.gT % 10 > 5 && H2.gT % 10 < 9 ? 'eat' : 'sit', dt, 0);
      if (g1[0].toolName !== (H2.gT % 9 < 2.6 ? 'cup' : null)) setTool(g1[0], H2.gT % 9 < 2.6 ? 'cup' : null); if (g2[0].toolName !== (H2.gT % 10 > 5 && H2.gT % 10 < 9 ? 'spoon' : null)) setTool(g2[0], H2.gT % 10 > 5 && H2.gT % 10 < 9 ? 'spoon' : null);
      for (const d of H2.dishes) if (d.eating) d.m.scale.setScalar(Math.max(0.35, d.m.scale.x - dt * 0.12));
    } else if (k === 'kiyim') { const r = seller.root.position; seller.root.rotation.y = Math.atan2(pl.p[0] - r.x, pl.p[2] - r.z); poseRig(seller, Math.hypot(pl.p[0] - r.x, pl.p[2] - r.z) < 2.4 ? 'wave' : 'idle', dt, 0); for (const r2 of manek) void r2; }
    else if (k === 'sart') {
      const c = BR.cut, sp = S2.spots.find((q) => q.k === 'sartarosh');
      if (c) { c.t += dt; const a = c.t * 1.6, tx = sp.x - 0.55 * Math.cos(a) * 0.9, tz = sp.z - 0.35 + Math.sin(a) * 0.25; stepTo(BR, tx, tz, 1.2, dt); barber.root.rotation.y = Math.atan2(sp.x - BR.x, sp.z - BR.z); barber.actDur = 1; poseRig(barber, 'cook', dt, 0); setTool(barber, 'spoon');
        c.snip -= dt; if (c.snip <= 0) { c.snip = 0.22 + Math.random() * 0.2; sfx('tick'); if (Math.random() < 0.5) fx().burst(2, sp.x, S2.o[1] + 1.25, sp.z, 0.4, 0.4, 0.05, c.lk.hair, 0.8, -0.6, 4, 0.4); }
        if (c.t >= c.dur) { BR.cut = null; setTool(barber, null); fadeQuick(); restyle(c.lk); st.look = c.lk; game.addMoney(-c.cost, 'Sartaroshxona'); st.stats.cuts = (st.stats.cuts || 0) + 1; sfx('medal'); toast(`Sartarosh: «Mana, tayyor! Juda yarashdi 😎» · ${som(c.cost)} so'm`, 'gold'); pl.lock = 0; pl.lockAnim = null; pl.sit = true; game.save(); } }
      else { stepTo(BR, S2.o[0] - 0.3, S2.o[2] + 0.9, 1.2, dt); barber.root.rotation.y = Math.atan2(pl.p[0] - BR.x, pl.p[2] - BR.z); poseRig(barber, Math.hypot(pl.p[0] - BR.x, pl.p[2] - BR.z) < 2.2 ? 'wave' : 'idle', dt, 0); }
      barber.root.position.set(BR.x, S2.o[1], BR.z); reader.actDur = 99; poseRig(reader, 'read', dt, 0);
    }
  });
  const fadeQuick = () => { const f = game.ui && game.ui.fade; if (!f) return; f.style.opacity = 0.8; setTimeout(() => { f.style.opacity = 0; }, 220); };

  // ================= KO'ZGU KAMERASI (kiyim/soch tanlanayotganda yuzdan) =================
  const camP = new THREE.Vector3(), lk = new THREE.Vector3();
  game.hooks.push(() => {
    const sn = game.ui && game.ui.screenName; if (H2.pv && sn !== 'kiyim' && sn !== 'sartarosh') { const pv = H2.pv; H2.pv = null; if (!pv.keep) restyle(lookOf()); }
    if (sn !== 'kiyim' && sn !== 'sartarosh') return; const I = IN.cur(); if (!I) return; const r = I.rooms[0], o = I.o, cam = game.camera, f = [Math.sin(pl.yaw), Math.cos(pl.yaw)], seat = sn === 'sartarosh';
    const d = seat ? 1.45 : 2.5, hy = seat ? 1.3 : 1.3, sh = seat ? 0.32 : 0.55; camP.set(clamp(pl.p[0] + f[0] * d, o[0] + r.x0 + 0.25, o[0] + r.x1 - 0.25), pl.p[1] + hy, clamp(pl.p[2] + f[1] * d, o[2] + r.z0 + 0.25, o[2] + r.z1 - 0.25));
    cam.position.copy(camP); lk.set(pl.p[0] + f[1] * sh, pl.p[1] + (seat ? 1.1 : 0.95), pl.p[2] - f[0] * sh); cam.lookAt(lk); // qahramon ekranning chap yarmida (o'ngda — oyna)
    if (cam.near !== 0.08) { cam.near = 0.08; cam.updateProjectionMatrix(); }
  });

  // ================= OYNALAR =================
  const tile = (sel, own, inner, a, sub) => `<div class="sw${sel ? ' on' : ''}" data-a="${a}">${inner}<span>${sub}</span>${own ? '<i>✓</i>' : ''}</div>`;
  const attach = (ui) => {
    ui.s_choyxona = function (w, d, btn, x) {
      x(); const render = () => { const sp = HY.seat;
        w.innerHTML = `<h1>🍵 Choyxona <small>💰 ${som(st.money)} so'm · 🍽 to'qlik ${Math.round(st.sat)}% · 💧 ${Math.round(st.thirst)}%</small></h1>
          <div class="card" style="margin-bottom:10px;flex-direction:row;align-items:center;gap:12px"><div style="font-size:34px">🧑‍🍳</div><div class="grow"><h4>Ofitsiant Sobir aka</h4><p>«${WT.carry.length ? `Buyurtmangiz: ${WT.carry.map((id) => MENU.find((q) => q[0] === id)[2]).join(' ')} — hozir olib kelaman!` : 'Nima olib kelay? Oshimiz bugun juda zo\'r!'}»</p></div></div>
          <div class="grid2">${[0, 1].map((c) => `<div>${MENU.slice(c * 3, c * 3 + 3).map((m) => `<div class="card menu-it" style="margin-bottom:6px;flex-direction:row;align-items:center;gap:10px"><b style="font-size:30px">${m[2]}</b><div class="grow"><h4>${m[1]}</h4><p>${m[7]} · 🍽 +${m[4]}${m[5] > 0 ? ` · 💧 +${m[5]}` : ''}</p></div><button data-a="ord:${m[0]}" ${st.money < m[3] || !sp ? 'disabled' : ''}>${m[3]} so'm</button></div>`).join('')}</div>`).join('')}</div>
          <p class="sub" style="margin-top:8px">Buyurtmani ofitsiant stolingizga olib keladi — keyin <kbd>E</kbd> bilan yeysiz. Bir vaqtda stolga 4 tagacha taom sig'adi.</p>`; };
      this.on({ ord: (id) => { if (H2.order(id)) { const m = MENU.find((q) => q[0] === id); toast(`${m[2]} ${m[1]} buyurtma qilindi`, 'good'); render(); } } }); render();
    };
    // kiyim: mode 'shop' — sotib olish mumkin; 'own' — uydagi shkaf (faqat bori)
    ui.s_kiyim = function (w, d, btn, x) {
      x(); const shop = !d || d.mode !== 'own'; const P = (H2.pv = { lk: lookOf(), hat: st.hat, tab: (H2.kTab || 0), keep: false });
      // egalik: narxi 0 bo'lsa — doim bor; aks holda st.clothes ichida 'tur:qiymat'
      const own = (cat, v, price) => !price || st.clothes.includes(cat + ':' + v), hOwn = (h) => h === '-' || st.hats.includes(h);
      const hats = [['-', 'Bosh kiyimsiz', 0], ...HAT_LIST, ...HAT_SHOP].filter((h) => shop || hOwn(h[0]));
      const items = () => { const sh = SHIRTS.find((q) => q[0] === P.lk.shirt) || SHIRTS[0], sy = STYLES.find((q) => q[0] === P.lk.style) || STYLES[0], pa = PANTS.find((q) => q[0] === P.lk.pants) || PANTS[0], ht = hats.find((h) => h[0] === (P.hat || '-')) || hats[0];
        return [['shirt', sh[0], sh[2]], ['style', sy[0], sy[2]], ['pants', pa[0], pa[2]], ['hat', ht[0], ht[2]]]; };
      const isOwn = ([c, v, p]) => (c === 'hat' ? hOwn(v) : own(c, v, p));
      const cost = () => items().filter((q) => !isOwn(q)).reduce((a, q) => a + q[2], 0);
      const lab = (nm, ow, p) => `${nm}${ow ? '' : ` · ${som(p)}`}`;
      const render = () => { const T0 = P.tab, c = cost();
        const opts = T0 === 0 ? SHIRTS.filter((q) => shop || own('shirt', q[0], q[2])).map((q) => tile(P.lk.shirt === q[0], own('shirt', q[0], q[2]), `<b class="col" style="background:${hex(q[0])}"></b>`, 'shirt:' + q[0], lab(q[1], own('shirt', q[0], q[2]), q[2])))
          : T0 === 1 ? STYLES.filter((q) => shop || own('style', q[0], q[2])).map((q, i) => tile(P.lk.style === q[0], own('style', q[0], q[2]), `<b class="ico">${['👕', '👔', '🦺', '🥻'][STYLES.indexOf(q)]}</b>`, 'style:' + q[0], lab(q[1], own('style', q[0], q[2]), q[2])))
          : T0 === 2 ? PANTS.filter((q) => shop || own('pants', q[0], q[2])).map((q) => tile(P.lk.pants === q[0], own('pants', q[0], q[2]), `<b class="col" style="background:${hex(q[0])}"></b>`, 'pants:' + q[0], lab(q[1], own('pants', q[0], q[2]), q[2])))
          : hats.map((h) => tile((P.hat || '-') === h[0], hOwn(h[0]), `<b class="ico">${{ '-': '🙂', somon: '👒', kepka: '🧢', doppi: '🎓', toj: '👑', qalpoq: '🧶', panama: '👒', shlyapa: '🎩' }[h[0]]}</b>`, 'hat:' + h[0], lab(h[1], hOwn(h[0]), h[2])));
        w.innerHTML = `<h1>${shop ? "👕 Kiyim do'koni" : '👔 Shkaf'} <small>💰 ${som(st.money)} so'm</small></h1><p class="sub">${shop ? "Ko'zguga qarang — tanlagan kiyim darhol egningizda. Sotib olinganlari uydagi shkafda ham turadi." : 'Sotib olgan kiyimlaringizdan tanlang.'}</p>
          <div class="tabs">${["Ko'ylak", 'Uslub', 'Shim', 'Bosh kiyim'].map((t, i) => `<button class="${i === T0 ? '' : 'sec'}" data-a="tab:${i}">${t}</button>`).join('')}</div>
          <div class="swg">${opts.join('')}</div>
          <div class="row" style="margin-top:12px;gap:8px"><button data-a="buy" ${st.money < c ? 'disabled' : ''}>${c ? `Sotib olish va kiyish — ${som(c)} so'm` : 'Kiyib olish ✓'}</button><button class="sec" data-a="reset">Avvalgisi</button></div>`; };
      const apply = () => restyle(P.lk, P.hat);
      this.on({ tab: (i) => { P.tab = H2.kTab = +i; render(); }, shirt: (v) => { P.lk.shirt = +v; apply(); render(); }, style: (v) => { P.lk.style = v; apply(); render(); }, pants: (v) => { P.lk.pants = +v; apply(); render(); }, hat: (v) => { P.hat = v === '-' ? null : v; apply(); render(); },
        reset: () => { P.lk = lookOf(); P.hat = st.hat; apply(); render(); },
        buy: () => { const c = cost(); if (c > st.money) return toast('Pul yetarli emas', 'bad');
          for (const q of items()) { if (isOwn(q)) continue; if (q[0] === 'hat') st.hats.push(q[1]); else st.clothes.push(q[0] + ':' + q[1]); }
          if (c) game.addMoney(-c, "Kiyim do'koni"); st.look = Object.assign({}, P.lk); st.hat = P.hat; pl.setHat(P.hat); P.keep = true; st.stats.outfits = (st.stats.outfits || 0) + 1; sfx(c ? 'buy' : 'click'); game.save();
          toast(c ? `Yangi kiyim! 😎 −${som(c)} so'm` : 'Kiyim almashtirildi 👕', 'good'); this.close(); } });
      render();
    };
    ui.s_sartarosh = function (w, d, btn, x) {
      x(); const cur = lookOf(), P = (H2.pv = { lk: Object.assign({}, cur), keep: false }); if (st.hat) restyle(cur, null); // shlyapa yechiladi — soch ko'rinsin
      const price = () => (P.lk.hs !== cur.hs ? HAIRS.find((q) => q[3] === P.lk.hs)[2] : 0) + (P.lk.hair !== cur.hair ? 60 : 0) + (P.lk.beard !== cur.beard ? 40 : 0);
      const render = () => { const c = price();
        w.innerHTML = `<h1>💈 Sartaroshxona <small>💰 ${som(st.money)} so'm</small></h1><p class="sub">Akmal usta: «Ko'zguga qarang — qaysi biri yoqsa, aytasiz.»</p>
          <h4 class="lbl">Soch turmagi</h4><div class="swg">${HAIRS.map((hh) => tile(P.lk.hs === hh[3], false, `<b class="ico">${['💇', '💇‍♂️', '🧑‍🦲', '🦁'][hh[3]]}</b>`, 'hs:' + hh[3], `${hh[1]} · ${hh[2]}`)).join('')}</div>
          <h4 class="lbl">Soch rangi <small>(60 so'm)</small></h4><div class="swg">${HAIRC.map((hc) => tile(P.lk.hair === hc[0], false, `<b class="col" style="background:${hex(hc[0])}"></b>`, 'hc:' + hc[0], hc[1])).join('')}</div>
          <h4 class="lbl">Soqol <small>(40 so'm)</small></h4><div class="swg">${BEARDS.map((bb) => tile(P.lk.beard === bb[0], false, `<b class="ico">${['🙂', '👨', '🧔', '🧔‍♂️'][BEARDS.indexOf(bb)]}</b>`, 'bd:' + bb[0], bb[1])).join('')}</div>
          <div class="row" style="margin-top:12px;gap:8px"><button data-a="cut" ${!c || st.money < c ? 'disabled' : ''}>${c ? `Soch oldirish — ${som(c)} so'm` : "O'zgarish tanlang"}</button><button class="sec" data-a="reset">Avvalgisi</button></div>`; };
      this.on({ hs: (v) => { P.lk.hs = +v; restyle(P.lk, null); render(); }, hc: (v) => { P.lk.hair = +v; restyle(P.lk, null); render(); }, bd: (v) => { P.lk.beard = v; restyle(P.lk, null); render(); }, reset: () => { P.lk = Object.assign({}, cur); restyle(P.lk, null); render(); },
        cut: () => { const c = price(); if (!c || st.money < c) return; P.keep = true; this.close(); restyle(cur); BR.cut = { t: 0, dur: 3.6, snip: 0, lk: Object.assign({}, P.lk), cost: c }; pl.lock = 3.7; pl.lockAnim = 'sit'; toast('✂️ Akmal usta ishga tushdi…'); } });
      render();
    };
  };
  let ok = false; game.hooks.push(() => { if (!ok && game.ui) { ok = true; attach(game.ui); } });
  initIsh(game); initKocha(game);
  return H2;
}
