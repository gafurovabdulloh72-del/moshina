// O'yin ichidagi reklama: "Kasb Egalari" platformasi — tramplinlarning orqa devorida va yo'l bo'yidagi shitlarda.
// Rasm kod bilan chiziladi (katak qog'oz uslubi), tashqi fayl yo'q.
import * as THREE from 'three';
import * as T from './terrain.js';
import { GB, MAT } from './geo.js';
import * as COL from './colliders.js';
import { ROAD_RAMPS, RADARS, edgePoint } from './acts.js';

const FONT = '"Arial Black", "Helvetica Neue", Arial, system-ui, sans-serif';
function adCanvas(variant) {
  const W = 1024, H = 512, c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
  // katak qog'oz
  x.fillStyle = '#f8f3e4'; x.fillRect(0, 0, W, H);
  x.strokeStyle = 'rgba(64,118,186,0.2)'; x.lineWidth = 2; x.beginPath(); for (let i = 0; i <= W; i += 32) { x.moveTo(i, 0); x.lineTo(i, H); } for (let j = 0; j <= H; j += 32) { x.moveTo(0, j); x.lineTo(W, j); } x.stroke();
  x.strokeStyle = 'rgba(64,118,186,0.34)'; x.lineWidth = 3; x.beginPath(); for (let i = 0; i <= W; i += 160) { x.moveTo(i, 0); x.lineTo(i, H); } for (let j = 0; j <= H; j += 160) { x.moveTo(0, j); x.lineTo(W, j); } x.stroke();
  x.fillStyle = '#1b1d24'; x.fillRect(0, 0, W, 14); x.fillRect(0, H - 14, W, 14); x.fillRect(0, 0, 14, H); x.fillRect(W - 14, 0, 14, H);
  const text = (s, px, py, size, col = '#16181f', align = 'left', weight = 900) => { x.font = `${weight} ${size}px ${FONT}`; x.textAlign = align; x.textBaseline = 'alphabetic'; x.fillStyle = col; x.fillText(s, px, py); return x.measureText(s).width; };
  const marker = (px, py, w, h, col = '#ffd23a') => { x.save(); x.translate(px, py); x.rotate(-0.018); x.fillStyle = col; x.beginPath(); x.roundRect(0, 0, w, h, 10); x.fill(); x.restore(); };
  const pill = (s, px, py, size, bg = '#16181f', fg = '#fff') => { x.font = `900 ${size}px ${FONT}`; const w = x.measureText(s).width + size * 1.1; x.fillStyle = bg; x.beginPath(); x.roundRect(px, py - size * 1.05, w, size * 1.5, size * 0.75); x.fill(); x.textAlign = 'left'; x.textBaseline = 'alphabetic'; x.fillStyle = fg; x.fillText(s, px + size * 0.55, py); return w; };
  const pin = (px, py, s, col = '#e2402f') => { x.fillStyle = 'rgba(0,0,0,0.16)'; x.beginPath(); x.ellipse(px, py + 4, s * 0.42, s * 0.14, 0, 0, 6.283); x.fill(); x.fillStyle = col; x.beginPath(); x.arc(px, py - s * 1.25, s * 0.62, Math.PI * 0.82, Math.PI * 0.18); x.lineTo(px, py); x.closePath(); x.fill(); x.fillStyle = '#fff'; x.beginPath(); x.arc(px, py - s * 1.25, s * 0.26, 0, 6.283); x.fill(); };
  const face = (px, py, r, col, ico) => { x.fillStyle = '#16181f'; x.beginPath(); x.arc(px, py, r + 5, 0, 6.283); x.fill(); x.fillStyle = col; x.beginPath(); x.arc(px, py, r, 0, 6.283); x.fill(); x.font = `${r * 1.05}px system-ui`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(ico, px, py + 3); };
  const handle = (px, py) => { const w = pill('   @kasb.egalari', px, py, 44); x.strokeStyle = '#fff'; x.lineWidth = 5; x.beginPath(); x.roundRect(px + 22, py - 37, 40, 40, 11); x.stroke(); x.beginPath(); x.arc(px + 42, py - 17, 9, 0, 6.283); x.stroke(); x.fillStyle = '#fff'; x.beginPath(); x.arc(px + 54, py - 29, 3, 0, 6.283); x.fill(); return w; };
  const route = () => { x.strokeStyle = '#16181f'; x.lineWidth = 5; x.setLineDash([4, 14]); x.lineCap = 'round'; x.beginPath(); x.moveTo(690, 400); x.bezierCurveTo(760, 300, 840, 420, 900, 250); x.stroke(); x.setLineDash([]); };
  if (variant === 0) {
    pill('KASB EGALARI', 52, 96, 34);
    marker(432, 132, 470, 108); text('Ijodkor', 50, 220, 108); text('kerakmi?', 446, 220, 108);
    text('Videograf · Montajor · Dizayner · Fotograf', 54, 296, 37, '#3a3f4c', 'left', 800);
    text('Xaritadan toping', 54, 392, 54, '#1f6fd8'); x.strokeStyle = '#1f6fd8'; x.lineWidth = 7; x.lineCap = 'round'; x.beginPath(); x.moveTo(56, 408); x.quadraticCurveTo(300, 424, 560, 404); x.stroke();
    route(); pin(900, 250, 56); face(690, 400, 34, '#ffd23a', '🎬'); face(800, 372, 28, '#8fd0ff', '🎨'); handle(54, 474);
  } else if (variant === 1) {
    marker(60, 210, 800, 44); text('KASB EGALARI', 56, 232, 112);
    text('Ijodkorlar platformasi', 60, 124, 46, '#1f6fd8');
    text("Videograf, montajor, dizayner, fotograf —", 60, 312, 36, '#3a3f4c', 'left', 800); text('hammasi bitta xaritada.', 60, 358, 36, '#3a3f4c', 'left', 800);
    pin(930, 200, 62); face(860, 330, 34, '#ffd23a', '📸'); face(948, 396, 28, '#ffb0c8', '✂️'); handle(60, 466);
  } else {
    pill('KASB EGALARI', 52, 96, 34);
    marker(46, 136, 760, 104, '#8fe0a0'); text('Ijodkormisiz?', 50, 222, 108);
    text('Profil oching — mijozlar sizni', 54, 298, 40, '#3a3f4c', 'left', 800); text('xaritadan topadi.', 54, 346, 40, '#3a3f4c', 'left', 800);
    marker(50, 368, 590, 50, '#ffd23a'); text('Cheklanmagan buyurtma', 56, 408, 44);
    pin(900, 300, 60, '#1f6fd8'); face(840, 400, 32, '#ffd23a', '🎬'); handle(640, 474);
  }
  return c;
}

export function buildAds(scene, site) {
  const mats = [0, 1, 2].map((v) => { const tex = new THREE.CanvasTexture(adCanvas(v)); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8; return new THREE.MeshLambertMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.05 }); });
  const add = (x, y, z, yaw, w, h, k) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mats[k % 3]); m.position.set(x, y, z); m.rotation.y = yaw; m.matrixAutoUpdate = false; m.updateMatrix(); scene.add(m); };
  // 1) tramplinlarning orqa devori
  site.ramps.forEach((r, i) => { if (!r.len) return; const w = Math.min(r.wid, r.h * 2) * 0.98, h = w / 2, d = r.len / 2 + 0.05; add(r.x + Math.sin(r.yaw) * d, r.y0 + r.h - h / 2 - 0.03, r.z + Math.cos(r.yaw) * d, r.yaw, w, h, i); });
  // 2) yo'l bo'yidagi shitlar
  const g = new GB(555); g.jit = 0.03; const avoid = ROAD_RAMPS.concat(RADARS).map(([k, f]) => edgePoint(k, f)), placed = [];
  for (const e of T.roads.edges) { if (e.type !== 0) continue; for (const f of [0.2, 0.5, 0.8]) {
    const p = edgePoint(e.key, f), off = p.hw + 7.5, x = p.x - p.tz * off, z = p.z + p.tx * off, si = T.siteInfo(x, z);
    if (si.slope > 0.3 || si.y < si.water + 1 || si.y < 3 || Math.abs(si.y - p.y) > 3.5) continue;
    if (avoid.some((a) => Math.hypot(a.x - x, a.z - z) < 70) || placed.some((a) => Math.hypot(a[0] - x, a[1] - z) < 420)) continue;
    if (T.PLACES.some((q) => (q.rect ? Math.abs(x - q.x) < q.rect.hl + 40 && Math.abs(z - q.z) < q.rect.hw + 40 : Math.hypot(x - q.x, z - q.z) < q.r + 30))) continue;
    if (COL.query(x, z, 6).length) continue;
    placed.push([x, z]); const nx = -p.tx + p.tz * 0.35, nz = -p.tz - p.tx * 0.35, yaw = Math.atan2(nx, nz), y = si.y, W = 9, H = 4.5, cy = 6.2;
    g.push().translate(x, y, z).rotY(yaw);
    g.color(0x4a4e58); for (const sx of [-1, 1]) g.box(sx * 3, cy / 2, -0.25, 0.34, cy + H / 2 + 2, 0.34); g.color(0x33353c).box(0, cy, -0.02 - 0.08, W + 0.5, H + 0.5, 0.16);
    g.color(0x2a2c33).box(0, cy + H / 2 + 0.45, 0.5, W * 0.9, 0.08, 0.1); for (const sx of [-0.33, 0, 0.33]) { g.color(0x2a2c33).box(sx * W, cy + H / 2 + 0.35, 0.3, 0.06, 0.06, 0.6); g.color(0xfff0c0).box(sx * W, cy + H / 2 + 0.3, 0.62, 0.3, 0.1, 0.2); }
    g.pop();
    const c = Math.cos(yaw), s = Math.sin(yaw), k = placed.length;
    add(x + s * 0.09, y + cy, z + c * 0.09, yaw, W, H, k); add(x - s * 0.2, y + cy, z - c * 0.2, yaw + Math.PI, W, H, k + 1);
    for (const sx of [-1, 1]) COL.addCircle(x + c * sx * 3 - s * 0.25, z - s * sx * 3 - c * 0.25, 0.3, y - 2, y + 9);
    site.lights.push({ x: x + s * 4, y: y + cy + 2, z: z + c * 4, hex: 0xfff0d0, power: 1.2 });
  } }
  if (g.count) { const m = new THREE.Mesh(g.build(), MAT.flat); m.castShadow = true; scene.add(m); }
  site.anim.push((dt, t, night) => { const v = 0.05 + 0.8 * night; for (const m of mats) m.emissiveIntensity = v; });
  return { count: placed.length, mats };
}
