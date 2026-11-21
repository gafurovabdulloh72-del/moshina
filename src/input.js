// Kiritish: klaviatura, geympad, sensorli ekran
export class Input {
  constructor() {
    this.keys = new Set();
    this.pressed = new Set(); // shu kadrda bosilganlar
    this.touch = { steer: 0, gas: 0, brake: 0, hand: false, nitro: false, jx: 0, jy: 0 }; // jx/jy — virtual joystik (o'ngga/pastga musbat)
    this.mouse = { dx: 0, dy: 0, wheel: 0, down: false };
    this.state = { throttle: 0, brake: 0, steer: 0, handbrake: false, nitro: false };
    this.enabled = true;
    this.padButtons = [];
    addEventListener('keydown', (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
      if (!e.repeat) this.pressed.add(e.code);
      this.keys.add(e.code);
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());
    const c = document.getElementById('c');
    c.addEventListener('mousedown', (e) => { this.mouse.down = true; });
    addEventListener('mouseup', () => { this.mouse.down = false; });
    addEventListener('mousemove', (e) => { if (this.mouse.down) { this.mouse.dx += e.movementX; this.mouse.dy += e.movementY; } });
    c.addEventListener('wheel', (e) => { this.mouse.wheel += Math.sign(e.deltaY); e.preventDefault(); }, { passive: false });
    c.addEventListener('contextmenu', (e) => e.preventDefault());
    // sensorli ekran: bo'sh joyda barmoq surilsa kamera aylanadi (avval faqat sichqoncha bilan — telefonda kamerani burib bo'lmasdi). Joystik va tugmalar o'z teginishini o'zi ushlaydi
    const tp = new Map();
    c.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'touch') return; tp.set(e.pointerId, [e.clientX, e.clientY]); this.mouse.down = true; });
    c.addEventListener('pointermove', (e) => { const q = tp.get(e.pointerId); if (!q) return; this.mouse.dx += (e.clientX - q[0]) * 1.5; this.mouse.dy += (e.clientY - q[1]) * 1.2; q[0] = e.clientX; q[1] = e.clientY; });
    const tEnd = (e) => { if (!tp.delete(e.pointerId)) return; if (!tp.size) this.mouse.down = false; };
    c.addEventListener('pointerup', tEnd); c.addEventListener('pointercancel', tEnd);
  }
  down(...codes) { for (const c of codes) if (this.keys.has(c)) return true; return false; }
  hit(...codes) { for (const c of codes) if (this.pressed.has(c)) return true; return false; }
  endFrame() { this.pressed.clear(); this.mouse.dx = 0; this.mouse.dy = 0; this.mouse.wheel = 0; }
  poll() {
    const s = this.state, t = this.touch;
    let thr = this.down('KeyW', 'ArrowUp') ? 1 : 0, brk = this.down('KeyS', 'ArrowDown') ? 1 : 0;
    let st = (this.down('KeyA', 'ArrowLeft') ? 1 : 0) - (this.down('KeyD', 'ArrowRight') ? 1 : 0);
    let hb = this.down('Space'), ni = this.down('ShiftLeft', 'ShiftRight');
    // geympad
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const p of pads) {
      if (!p || !p.connected) continue;
      const ax = p.axes[0] || 0;
      if (Math.abs(ax) > 0.12) st = -ax;
      const b = (i) => (p.buttons[i] ? p.buttons[i].value : 0);
      thr = Math.max(thr, b(7)); brk = Math.max(brk, b(6));
      if (b(0) > 0.5) hb = true; if (b(2) > 0.5 || b(5) > 0.5) ni = true;
      const map = { 3: 'KeyC', 1: 'KeyR', 9: 'Escape', 8: 'KeyM', 4: 'KeyH', 12: 'KeyE', 13: 'KeyE' };
      for (const k in map) { const v = b(+k) > 0.5; if (v && !this.padButtons[k]) this.pressed.add(map[k]); this.padButtons[k] = v; }
      break;
    }
    if (t.gas) thr = Math.max(thr, t.gas); if (t.brake) brk = Math.max(brk, t.brake);
    if (t.auto && !brk) thr = Math.max(thr, 1); // avto-gaz (telefon, sozlamalardan): tormoz bosilmaganda gaz o'zi bosiladi
    if (t.steer) st = t.steer; if (t.hand) hb = true; if (t.nitro) ni = true;
    if (t.jx) st = -t.jx; if (t.jy < 0) thr = Math.max(thr, -t.jy); if (t.jy > 0) brk = Math.max(brk, t.jy);
    if (!this.enabled) { thr = 0; brk = 0; st = 0; hb = false; ni = false; }
    s.throttle = thr; s.brake = brk; s.steer = st; s.handbrake = hb; s.nitro = ni;
    return s;
  }
}
