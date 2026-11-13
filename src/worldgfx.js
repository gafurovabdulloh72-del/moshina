// Dunyoning ko'rinadigan qismi: silliq relyef (LOD bilan), yo'l lentalari, ko'priklar, suv
import * as THREE from 'three';
import * as T from './terrain.js';
import { GB, MAT } from './geo.js';
import { hexLin, mixRGB, lerp, clamp, smoothstep, noise } from './util.js';
import * as COL from './colliders.js';

const { N, NV, CELL, HALF } = T;
const CH = 50, STEPS = [1, 2, 5];

function lodIndex(step) {
  const n = CH / step, V = CH + 1, idx = [];
  const vi = (i, j) => j * step * V + i * step;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const a = vi(i, j), b = vi(i + 1, j), c = vi(i, j + 1), d = vi(i + 1, j + 1);
    idx.push(a, c, b, d, b, c);
  }
  // yubka (chetlardagi tirqishlarni yopadi): chet uchlari + pastga tushirilgan nusxalari
  const S0 = V * V; // yubka uchlari boshlanishi: tartib — tepa(j=0), past(j=CH), chap(i=0), o'ng(i=CH), har biri V tadan
  for (let k = 0; k < n; k++) {
    const k0 = k * step, k1 = (k + 1) * step;
    let a = k0, b = k1, sa = S0 + k0, sb = S0 + k1; idx.push(a, b, sb, a, sb, sa);                // tepa chet (z min): tashqariga -z
    a = CH * V + k0; b = CH * V + k1; sa = S0 + V + k0; sb = S0 + V + k1; idx.push(a, sb, b, a, sa, sb); // past chet
    a = k0 * V; b = k1 * V; sa = S0 + 2 * V + k0; sb = S0 + 2 * V + k1; idx.push(a, sb, b, a, sa, sb);   // chap chet
    a = k0 * V + CH; b = k1 * V + CH; sa = S0 + 3 * V + k0; sb = S0 + 3 * V + k1; idx.push(a, b, sb, a, sb, sa); // o'ng chet
  }
  return new THREE.BufferAttribute(new Uint16Array(idx), 1);
}

export function buildTerrain(scene) {
  const group = new THREE.Group();
  const h = T.grid.h, col = T.grid.col;
  const V = CH + 1;
  const lodIdx = STEPS.map(lodIndex);
  const chunks = [];
  for (let cj = 0; cj < N; cj += CH) for (let ci = 0; ci < N; ci += CH) {
    let maxH = -1e9, minH = 1e9;
    for (let j = 0; j <= CH; j += 5) for (let i = 0; i <= CH; i += 5) { const v = h[(cj + j) * NV + ci + i]; if (v > maxH) maxH = v; if (v < minH) minH = v; }
    if (maxH < -9) continue;
    const nv = V * V + 4 * V;
    const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), cl = new Float32Array(nv * 3);
    for (let j = 0; j <= CH; j++) for (let i = 0; i <= CH; i++) {
      const gi = ci + i, gj = cj + j, k = gj * NV + gi, o = (j * V + i) * 3;
      pos[o] = -HALF + gi * CELL; pos[o + 1] = h[k]; pos[o + 2] = -HALF + gj * CELL;
      const hl = h[gj * NV + Math.max(0, gi - 1)], hr = h[gj * NV + Math.min(N, gi + 1)], hu = h[Math.max(0, gj - 1) * NV + gi], hd = h[Math.min(N, gj + 1) * NV + gi];
      let nx = -(hr - hl) / (2 * CELL), nz = -(hd - hu) / (2 * CELL); const l = Math.hypot(nx, 1, nz);
      nor[o] = nx / l; nor[o + 1] = 1 / l; nor[o + 2] = nz / l;
      cl[o] = col[k * 3]; cl[o + 1] = col[k * 3 + 1]; cl[o + 2] = col[k * 3 + 2];
    }
    const S0 = V * V;
    const skirt = (dst, src) => { const d = (S0 + dst) * 3, s = src * 3; pos[d] = pos[s]; pos[d + 1] = pos[s + 1] - 14; pos[d + 2] = pos[s + 2]; nor[d] = nor[s]; nor[d + 1] = nor[s + 1]; nor[d + 2] = nor[s + 2]; cl[d] = cl[s]; cl[d + 1] = cl[s + 1]; cl[d + 2] = cl[s + 2]; };
    for (let k = 0; k < V; k++) { skirt(k, k); skirt(V + k, CH * V + k); skirt(2 * V + k, k * V); skirt(3 * V + k, k * V + CH); }
    const pa = new THREE.BufferAttribute(pos, 3), na = new THREE.BufferAttribute(nor, 3), ca = new THREE.BufferAttribute(cl, 3);
    const cx = -HALF + (ci + CH / 2) * CELL, cz = -HALF + (cj + CH / 2) * CELL;
    const sphere = new THREE.Sphere(new THREE.Vector3(cx, (maxH + minH) / 2, cz), Math.hypot(CH * CELL * 0.71, (maxH - minH) / 2 + 20));
    const geos = lodIdx.map((ix) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', pa); g.setAttribute('normal', na); g.setAttribute('color', ca); g.setIndex(ix); g.boundingSphere = sphere; return g; });
    const m = new THREE.Mesh(geos[0], MAT.terrain);
    m.receiveShadow = true; m.matrixAutoUpdate = false; m.updateMatrix();
    group.add(m);
    chunks.push({ mesh: m, geos, cx, cz, lod: 0 });
  }
  scene.add(group);
  const api = {
    group, chunks,
    update(cam) {
      const px = cam.position.x, pz = cam.position.z;
      for (let i = 0; i < chunks.length; i++) {
        const c = chunks[i]; const d = Math.hypot(c.cx - px, c.cz - pz);
        const lod = d < 800 ? 0 : d < 1900 ? 1 : 2;
        if (lod !== c.lod) { c.lod = lod; c.mesh.geometry = c.geos[lod]; }
      }
    },
  };
  return api;
}

// Yo'l rangi biom bo'yicha
const RC = [hexLin(0xb79d7a), hexLin(0xa88a68), hexLin(0x9d8c74), hexLin(0xcda468), hexLin(0xb06d4b), null, null, hexLin(0xc2a98a), hexLin(0xc4a36a), hexLin(0x6a6068)];
const RSNOW = hexLin(0xc6cfdf), RBEACH = hexLin(0xd9c58e);
const _zw = new Float32Array(T.NB);
export function roadColor(x, z, y) {
  const W = T.zoneWeights(x, z, _zw);
  let c = [0, 0, 0];
  for (let i = 0; i < T.NB; i++) { const w = W[i]; if (w > 0 && RC[i]) { c[0] += RC[i][0] * w; c[1] += RC[i][1] * w; c[2] += RC[i][2] * w; } }
  const sn = T.snowAt(x, z, y) * (1 - W[9]);
  if (sn > 0) c = mixRGB(c, RSNOW, sn);
  const be = smoothstep(4.2, 2.0, y); if (be > 0) c = mixRGB(c, RBEACH, be);
  return c;
}

export function buildRoads(scene) {
  const R = T.roads;
  const group = new THREE.Group();
  const wood = new GB(12); wood.jit = 0.08;
  for (const e of R.edges) {
    const lift = 0.02 + e.id * 0.003;
    const hw = e.hw;
    const strips = e.type === 0 ? [-hw - 1.4, -hw, -1.9, -0.9, 0.9, 1.9, hw, hw + 1.4] : [-hw - 1.2, -hw, -1.35, -0.6, 0.6, 1.35, hw, hw + 1.2];
    const shade = [0.9, 1.0, 0.91, 1.04, 0.91, 1.0, 0.9];
    const SEG = 48;
    for (let k0 = 0; k0 < e.count - 1; k0 += SEG) {
      const gb = new GB(11 + e.id); gb.jit = 0.012;
      let prev = null;
      const k1 = Math.min(e.count - 1, k0 + SEG);
      for (let k = k0; k <= k1; k++) {
        const i = e.start + k;
        const x = R.x[i], z = R.z[i], y = R.y[i] + lift, lx = R.tz[i], lz = -R.tx[i];
        const row = strips.map((o, q) => [x + lx * o, y - (q === 0 || q === strips.length - 1 ? 0.65 : 0), z + lz * o]);
        const c = roadColor(x, z, y);
        if (prev && !(R.bridge[i] && R.bridge[i - 1])) {
          for (let q = 0; q < strips.length - 1; q++) { gb.colorLin([c[0] * shade[q], c[1] * shade[q], c[2] * shade[q]]); gb.quad(prev[q], row[q], row[q + 1], prev[q + 1]); }
        }
        prev = row;
      }
      if (gb.count) { const mesh = new THREE.Mesh(gb.build(), MAT.flat); mesh.receiveShadow = true; mesh.matrixAutoUpdate = false; group.add(mesh); }
    }
    let k = 0;
    while (k < e.count) {
      if (!R.bridge[e.start + k]) { k++; continue; }
      let k1 = k; while (k1 + 1 < e.count && R.bridge[e.start + k1 + 1]) k1++;
      buildBridge(wood, e, k, k1, lift);
      k = k1 + 1;
    }
  }
  scene.add(group);
  const bm = new THREE.Mesh(wood.build(), MAT.flat); bm.receiveShadow = true; bm.castShadow = true; scene.add(bm);
  return group;
}

function buildBridge(gb, e, k0, k1, lift) {
  const R = T.roads, hw = e.hw;
  const plankA = 0xb8643e, plankB = 0xa85a38, beam = 0x7a4a30, rail = 0xc27048;
  for (let k = k0; k <= k1; k++) {
    const i = e.start + k;
    const x = R.x[i], z = R.z[i], y = R.y[i] + lift, yaw = Math.atan2(R.tx[i], R.tz[i]);
    if (k < k1) {
      const j = i + 1;
      const dx = R.x[j] - x, dz = R.z[j] - z, dy = R.y[j] - R.y[i], len = Math.hypot(dx, dz);
      const yw = Math.atan2(dx, dz), pitch = -Math.atan2(dy, len);
      gb.push().translate(x, y, z).rotY(yw).rotX(pitch);
      const np = 4;
      for (let q = 0; q < np; q++) { gb.color((q + k) % 2 ? plankA : plankB); gb.box(0, -0.11, (q + 0.5) * len / np, hw * 2 + 0.5, 0.2, len / np - 0.06); }
      gb.color(beam); gb.box(-hw + 0.5, -0.42, len / 2, 0.3, 0.4, len + 0.05); gb.box(hw - 0.5, -0.42, len / 2, 0.3, 0.4, len + 0.05);
      gb.color(rail);
      for (const sd of [-1, 1]) { gb.box(sd * (hw + 0.1), 1.0, len / 2, 0.14, 0.14, len + 0.05); gb.box(sd * (hw + 0.1), 0.55, len / 2, 0.1, 0.1, len + 0.05); }
      gb.pop();
      const lx = R.tz[i], lz = -R.tx[i], lx2 = R.tz[j], lz2 = -R.tx[j];
      for (const sd of [-1, 1]) COL.addSeg(x + lx * sd * (hw + 0.1), z + lz * sd * (hw + 0.1), R.x[j] + lx2 * sd * (hw + 0.1), R.z[j] + lz2 * sd * (hw + 0.1), 0.18, y - 0.5, y + 1.3);
    }
    gb.push().translate(x, y, z).rotY(yaw);
    gb.color(rail);
    for (const sd of [-1, 1]) gb.box(sd * (hw + 0.1), 0.5, 0, 0.2, 1.25, 0.2);
    if ((k - k0) % 2 === 0) {
      const gy = T.gridHeight(x, z);
      const depth = Math.max(1.2, y - gy + 1.2);
      gb.color(beam);
      for (const sd of [-1, 1]) { gb.push().translate(sd * (hw - 0.4), -depth, 0); gb.prism(6, 0.24, 0.2, 0, depth - 0.2); gb.pop(); }
      gb.box(0, -0.75, 0, hw * 2 + 0.6, 0.26, 0.26);
      if (depth > 3.2) gb.box(0, -depth * 0.55, 0, hw * 2 - 0.6, 0.18, 0.18);
    }
    gb.pop();
  }
}

// --- Suv ---
export function buildWater(scene) {
  const out = {};
  const uni = { uTime: { value: 0 } };
  const wave = (mat, amp) => {
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = uni.uTime;
      sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader
        .replace('#include <beginnormal_vertex>', `
          float wa = position.x*0.021 + uTime*0.8, wb = position.y*0.027 + uTime*1.05, wc = (position.x+position.y)*0.05 + uTime*1.5;
          vec3 objectNormal = normalize(vec3(-(cos(wa)*0.021*0.5 + cos(wc)*0.05*0.16)*${amp.toFixed(2)}, -(cos(wb)*0.027*0.4 + cos(wc)*0.05*0.16)*${amp.toFixed(2)}, 1.0));`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          transformed.z += (sin(wa)*0.5 + sin(wb)*0.4 + sin(wc)*0.16)*${amp.toFixed(2)};`);
    };
  };
  const seaMat = new THREE.MeshLambertMaterial({ color: 0x3aa6d8, transparent: true, opacity: 0.88 });
  wave(seaMat, 0.55);
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(9000, 9000, 180, 180), seaMat);
  sea.rotation.x = -Math.PI / 2; sea.position.y = 0; sea.renderOrder = 2; scene.add(sea);
  const far = new THREE.Mesh(new THREE.PlaneGeometry(60000, 60000), new THREE.MeshLambertMaterial({ color: 0x3aa6d8 }));
  far.rotation.x = -Math.PI / 2; far.position.y = -1.2; scene.add(far);
  out.sea = sea; out.uni = uni; out.seaMat = seaMat;

  const freshMat = new THREE.MeshLambertMaterial({ color: 0x4fb6e0, transparent: true, opacity: 0.86 });
  wave(freshMat, 0.12);
  const lake = new THREE.Mesh(new THREE.CircleGeometry(T.LAKE.r + 75, 48, 0, Math.PI * 2), freshMat);
  lake.rotation.x = -Math.PI / 2; lake.position.set(T.LAKE.x, T.LAKE.y, T.LAKE.z); lake.renderOrder = 2; scene.add(lake);
  // Daryo lentalari
  const rv = T.getRiver();
  const rMat = new THREE.MeshLambertMaterial({ color: 0x4fb6e0, transparent: true, opacity: 0.86 });
  const hw = T.RIVER.hw + 9;
  for (const part of rv.parts) {
    const pos = [], nor = [];
    let px0, pz0, px1, pz1, py;
    const a0 = part.start, b0 = part.start + part.count;
    for (let i = a0; i < b0; i += 2) {
      const a = Math.max(a0, i - 2), b = Math.min(b0 - 1, i + 2);
      let tx = rv.x[b] - rv.x[a], tz = rv.z[b] - rv.z[a]; const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l;
      const x0 = rv.x[i] + tz * hw, z0 = rv.z[i] - tx * hw, x1 = rv.x[i] - tz * hw, z1 = rv.z[i] + tx * hw, y = rv.y[i];
      if (i > a0) { pos.push(px0, py, pz0, x1, y, z1, x0, y, z0, px0, py, pz0, px1, py, pz1, x1, y, z1); for (let q = 0; q < 6; q++) nor.push(0, 1, 0); }
      px0 = x0; pz0 = z0; px1 = x1; pz1 = z1; py = y;
    }
    const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); rg.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    const riverMesh = new THREE.Mesh(rg, rMat); riverMesh.renderOrder = 2; scene.add(riverMesh);
  }
  out.fresh = freshMat;
  return out;
}
