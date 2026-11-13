// Effektlar: zarrachalar (chang, tutun, qor, barglar, uchqun), parchalar, shina izlari
import * as THREE from 'three';
import * as T from './terrain.js';
import { MAT } from './geo.js';
import { hexLin, clamp } from './util.js';

const VS = `attribute float size; attribute float alpha; attribute vec3 pcolor; varying float vA; varying vec3 vC; uniform float uScale;
void main(){ vA = alpha; vC = pcolor; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * mv; gl_PointSize = size * uScale / max(0.5, -mv.z); }`;
const FS = `varying float vA; varying vec3 vC; void main(){ vec2 d = gl_PointCoord - 0.5; float r = dot(d,d)*4.0; if (r > 1.0) discard; float a = vA * (1.0 - r*r); gl_FragColor = vec4(vC, a);
#include <colorspace_fragment>
}`;

export class FX {
  constructor(scene, renderer) {
    this.scene = scene;
    const N = (this.N = 1800);
    this.pos = new Float32Array(N * 3); this.col = new Float32Array(N * 3); this.size = new Float32Array(N); this.alpha = new Float32Array(N);
    this.vel = new Float32Array(N * 3); this.life = new Float32Array(N); this.maxLife = new Float32Array(N); this.grow = new Float32Array(N); this.grav = new Float32Array(N); this.drag = new Float32Array(N); this.a0 = new Float32Array(N); this.s0 = new Float32Array(N);
    this.next = 0;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3)); g.setAttribute('pcolor', new THREE.BufferAttribute(this.col, 3)); g.setAttribute('size', new THREE.BufferAttribute(this.size, 1)); g.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1));
    this.uni = { uScale: { value: 600 } };
    this.mat = new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: FS, uniforms: this.uni, transparent: true, depthWrite: false });
    this.points = new THREE.Points(g, this.mat); this.points.frustumCulled = false; this.points.renderOrder = 6; scene.add(this.points);
    // parchalar
    const DN = (this.DN = 140);
    this.deb = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial(), DN); this.deb.frustumCulled = false; this.deb.castShadow = true; scene.add(this.deb);
    this.d = []; for (let i = 0; i < DN; i++) this.d.push({ life: 0, p: new THREE.Vector3(), v: new THREE.Vector3(), r: new THREE.Euler(), w: new THREE.Vector3(), s: new THREE.Vector3() });
    this.dNext = 0; this._o = new THREE.Object3D(); this._c = new THREE.Color();
    for (let i = 0; i < DN; i++) { this._o.position.set(0, -999, 0); this._o.scale.setScalar(0.001); this._o.updateMatrix(); this.deb.setMatrixAt(i, this._o.matrix); this.deb.setColorAt(i, this._c.setHex(0xffffff)); }
    this.loose = []; // mashinadan ajralgan qismlar
    // shina izlari
    const SN = (this.SN = 500);
    this.skPos = new Float32Array(SN * 18); const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(this.skPos, 3));
    this.skid = new THREE.Mesh(sg, new THREE.MeshBasicMaterial({ color: 0x15151a, transparent: true, opacity: 0.32, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
    this.skid.frustumCulled = false; this.skid.renderOrder = 1; scene.add(this.skid); this.skNext = 0; this.skLast = [null, null, null, null];
  }
  emit(x, y, z, vx, vy, vz, life, size, hex, alpha = 0.6, grow = 0, grav = 0, drag = 0) {
    const i = this.next; this.next = (this.next + 1) % this.N; const o = i * 3;
    this.pos[o] = x; this.pos[o + 1] = y; this.pos[o + 2] = z; this.vel[o] = vx; this.vel[o + 1] = vy; this.vel[o + 2] = vz;
    const c = typeof hex === 'number' ? hexLin(hex) : hex; this.col[o] = c[0]; this.col[o + 1] = c[1]; this.col[o + 2] = c[2];
    this.life[i] = life; this.maxLife[i] = life; this.size[i] = size; this.s0[i] = size; this.alpha[i] = alpha; this.a0[i] = alpha; this.grow[i] = grow; this.grav[i] = grav; this.drag[i] = drag;
  }
  burst(n, x, y, z, speed, life, size, hex, alpha = 0.7, up = 1, grav = 4, grow = 1) {
    for (let i = 0; i < n; i++) { const a = Math.random() * 6.283, s = speed * (0.3 + Math.random() * 0.7); this.emit(x + (Math.random() - 0.5) * 0.6, y + Math.random() * 0.4, z + (Math.random() - 0.5) * 0.6, Math.cos(a) * s, (0.3 + Math.random()) * speed * 0.6 * up, Math.sin(a) * s, life * (0.6 + Math.random() * 0.6), size * (0.6 + Math.random() * 0.8), hex, alpha, grow, grav, 1.5); }
  }
  debris(n, x, y, z, hex, speed = 6, size = 0.35, vx = 0, vz = 0) {
    for (let i = 0; i < n; i++) {
      const d = this.d[this.dNext]; const idx = this.dNext; this.dNext = (this.dNext + 1) % this.DN;
      d.life = 3.5 + Math.random() * 2; d.p.set(x + (Math.random() - 0.5) * 0.8, y + 0.3 + Math.random() * 0.8, z + (Math.random() - 0.5) * 0.8);
      const a = Math.random() * 6.283, s = speed * (0.3 + Math.random() * 0.8); d.v.set(Math.cos(a) * s + vx * 0.7, 2 + Math.random() * speed * 0.7, Math.sin(a) * s + vz * 0.7);
      d.w.set((Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12); d.r.set(Math.random() * 6, Math.random() * 6, 0);
      const k = size * (0.5 + Math.random()); d.s.set(k * (0.6 + Math.random()), k * (0.3 + Math.random() * 0.7), k * (0.6 + Math.random())); d.idx = idx;
      this.deb.setColorAt(idx, this._c.setHex(Array.isArray(hex) ? hex[(Math.random() * hex.length) | 0] : hex));
    }
    this.deb.instanceColor.needsUpdate = true;
  }
  // Mashina qismini uzib yuborish
  detach(part, car) {
    const m = part.mesh; m.updateWorldMatrix(true, false);
    this.scene.attach(m);
    this.loose.push({ m, part, v: new THREE.Vector3(car.v[0] * 0.6 + (Math.random() - 0.5) * 5, 3 + Math.random() * 3, car.v[2] * 0.6 + (Math.random() - 0.5) * 5), w: new THREE.Vector3((Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8), life: 14 });
  }
  reattach(root) { for (const l of this.loose) { root.add(l.m); l.m.position.copy(l.part.home); l.m.rotation.set(0, 0, 0); l.m.scale.setScalar(1); l.m.visible = true; l.part.on = true; } this.loose.length = 0; }
  skidMark(i, x, y, z, nx, nz, w) { // i: g'ildirak, (nx,nz): yon yo'nalish
    const L = this.skLast[i];
    const ax = x + nx * w, az = z + nz * w, bx = x - nx * w, bz = z - nz * w;
    if (L && Math.hypot(L[0] - ax, L[2] - az) < 3) {
      const o = this.skNext * 18; this.skNext = (this.skNext + 1) % this.SN; const p = this.skPos;
      p[o] = L[0]; p[o + 1] = L[1]; p[o + 2] = L[2]; p[o + 3] = ax; p[o + 4] = y; p[o + 5] = az; p[o + 6] = bx; p[o + 7] = y; p[o + 8] = bz;
      p[o + 9] = L[0]; p[o + 10] = L[1]; p[o + 11] = L[2]; p[o + 12] = bx; p[o + 13] = y; p[o + 14] = bz; p[o + 15] = L[3]; p[o + 16] = L[1]; p[o + 17] = L[4];
      this.skid.geometry.attributes.position.needsUpdate = true;
    }
    this.skLast[i] = [ax, y, az, bx, bz];
  }
  skidEnd(i) { this.skLast[i] = null; }
  update(dt, cam) {
    const N = this.N, pos = this.pos, vel = this.vel;
    for (let i = 0; i < N; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt; const o = i * 3;
      if (this.life[i] <= 0) { this.alpha[i] = 0; this.size[i] = 0; continue; }
      const dr = 1 - this.drag[i] * dt;
      vel[o] *= dr; vel[o + 2] *= dr; vel[o + 1] = vel[o + 1] * dr - this.grav[i] * dt;
      pos[o] += vel[o] * dt; pos[o + 1] += vel[o + 1] * dt; pos[o + 2] += vel[o + 2] * dt;
      const t = this.life[i] / this.maxLife[i];
      this.alpha[i] = this.a0[i] * Math.min(1, t * 2.2) * Math.min(1, (1 - t) * 8); this.size[i] = this.s0[i] * (1 + this.grow[i] * (1 - t));
    }
    const g = this.points.geometry; g.attributes.position.needsUpdate = true; g.attributes.size.needsUpdate = true; g.attributes.alpha.needsUpdate = true; g.attributes.pcolor.needsUpdate = true;
    // parchalar
    let any = false;
    for (let i = 0; i < this.DN; i++) {
      const d = this.d[i]; if (d.life <= 0) continue; any = true;
      d.life -= dt; d.v.y -= 16 * dt; d.p.addScaledVector(d.v, dt);
      const gy = T.gridHeight(d.p.x, d.p.z) + d.s.y * 0.5;
      if (d.p.y < gy) { d.p.y = gy; if (d.v.y < 0) d.v.y *= -0.35; d.v.x *= 0.7; d.v.z *= 0.7; d.w.multiplyScalar(0.6); }
      d.r.x += d.w.x * dt; d.r.y += d.w.y * dt; d.r.z += d.w.z * dt;
      const k = d.life < 0.6 ? Math.max(0.001, d.life / 0.6) : 1;
      this._o.position.copy(d.p); this._o.rotation.copy(d.r); this._o.scale.copy(d.s).multiplyScalar(k); this._o.updateMatrix(); this.deb.setMatrixAt(i, this._o.matrix);
    }
    if (any) this.deb.instanceMatrix.needsUpdate = true;
    for (let i = this.loose.length - 1; i >= 0; i--) {
      const l = this.loose[i]; l.life -= dt; l.v.y -= 16 * dt; l.m.position.addScaledVector(l.v, dt);
      const gy = T.gridHeight(l.m.position.x, l.m.position.z) + 0.25;
      if (l.m.position.y < gy) { l.m.position.y = gy; if (l.v.y < 0) l.v.y *= -0.3; l.v.x *= 0.75; l.v.z *= 0.75; l.w.multiplyScalar(0.7); }
      l.m.rotation.x += l.w.x * dt; l.m.rotation.y += l.w.y * dt; l.m.rotation.z += l.w.z * dt;
      if (l.life < 0) l.m.visible = false;
    }
  }
}
