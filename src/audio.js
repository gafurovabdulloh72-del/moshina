// Ovoz: hammasi WebAudio'da sintez qilinadi (fayl yo'q). Dvigatel, shina, shamol, effektlar, generativ musiqa, muhit.
// Musiqa shu yerda kod bilan yaratiladi — mualliflik da'vosi (Content ID) bo'lmaydi.
import { clamp, lerp } from './util.js';

const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);
export class Sound {
  constructor() { this.ctx = null; this.vol = 0.8; this.musicVol = 0.5; this.musicOn = true; this.ready = false; this.t = 0; this.nextBar = 0; this.bar = 0; this.amb = 0; }
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    const c = (this.ctx = new AC());
    const comp = c.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4; comp.connect(c.destination);
    this.master = c.createGain(); this.master.gain.value = this.vol; this.master.connect(comp);
    // shovqin buferi
    const nb = c.createBuffer(1, c.sampleRate * 2, c.sampleRate), d = nb.getChannelData(0); let b0 = 0;
    for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; b0 = 0.98 * b0 + 0.02 * w; d[i] = w * 0.6 + b0 * 4; }
    this.noiseBuf = nb;
    const noise = (type, f, q) => { const s = c.createBufferSource(); s.buffer = nb; s.loop = true; const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q; const g = c.createGain(); g.gain.value = 0; s.connect(fl); fl.connect(g); g.connect(this.master); s.start(); return { f: fl, g }; };
    // dvigatel
    const eg = (this.engG = c.createGain()); eg.gain.value = 0; const ef = (this.engF = c.createBiquadFilter()); ef.type = 'lowpass'; ef.frequency.value = 400; ef.Q.value = 1.2;
    const o1 = (this.o1 = c.createOscillator()); o1.type = 'sawtooth'; const o2 = (this.o2 = c.createOscillator()); o2.type = 'square'; const o3 = (this.o3 = c.createOscillator()); o3.type = 'sawtooth';
    const g1 = c.createGain(); g1.gain.value = 0.5; const g2 = c.createGain(); g2.gain.value = 0.35; const g3 = c.createGain(); g3.gain.value = 0.2;
    o1.connect(g1); o2.connect(g2); o3.connect(g3); g1.connect(ef); g2.connect(ef); g3.connect(ef);
    const am = (this.am = c.createGain()); am.gain.value = 0.75; const lfo = (this.lfo = c.createOscillator()); lfo.type = 'sine'; const lg = c.createGain(); lg.gain.value = 0.25; lfo.connect(lg); lg.connect(am.gain);
    ef.connect(am); am.connect(eg); eg.connect(this.master); o1.start(); o2.start(); o3.start(); lfo.start();
    this.road = noise('lowpass', 420, 0.5); this.wind = noise('bandpass', 700, 0.7); this.skid = noise('bandpass', 1900, 2.5); this.nitro = noise('highpass', 1800, 0.5); this.ambN = noise('lowpass', 500, 0.4);
    // musiqa shinasi + aks-sado
    this.mus = c.createGain(); this.mus.gain.value = this.musicOn ? this.musicVol * 0.5 : 0; this.mus.connect(this.master);
    const dl = c.createDelay(1.5); dl.delayTime.value = 0.39; const fb = c.createGain(); fb.gain.value = 0.32; const df = c.createBiquadFilter(); df.type = 'lowpass'; df.frequency.value = 2200;
    this.send = c.createGain(); this.send.gain.value = 0.5; this.send.connect(dl); dl.connect(df); df.connect(fb); fb.connect(dl); df.connect(this.mus);
    this.ready = true; this.nextBar = c.currentTime + 0.3;
  }
  setVol(v) { this.vol = v; if (this.master) this.master.gain.value = v; }
  setMusic(on, vol) { this.musicOn = on; if (vol != null) this.musicVol = vol; if (this.mus) this.mus.gain.setTargetAtTime(on ? this.musicVol * 0.5 : 0, this.ctx.currentTime, 0.3); }
  tone(f, t0, dur, type = 'sine', vol = 0.2, dest = null, attack = 0.005, slide = 0) {
    const c = this.ctx; const o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t0); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, f * slide), t0 + dur);
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(vol, t0 + attack); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(dest || this.master); o.start(t0); o.stop(t0 + dur + 0.05); return g;
  }
  burst(t0, dur, type, f, q, vol, slide = 1) {
    const c = this.ctx; const s = c.createBufferSource(); s.buffer = this.noiseBuf; const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(f, t0); if (slide !== 1) fl.frequency.exponentialRampToValueAtTime(f * slide, t0 + dur); fl.Q.value = q;
    const g = c.createGain(); g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur); s.connect(fl); fl.connect(g); g.connect(this.master); s.start(t0, Math.random()); s.stop(t0 + dur + 0.05);
  }
  sfx(name, k = 1) {
    if (!this.ready) return; const t = this.ctx.currentTime;
    switch (name) {
      case 'coin': this.tone(1318, t, 0.12, 'triangle', 0.16); this.tone(1976, t + 0.07, 0.22, 'triangle', 0.16); break;
      case 'check': this.tone(880, t, 0.1, 'square', 0.08); this.tone(1320, t + 0.08, 0.18, 'square', 0.08); break;
      case 'click': this.tone(660, t, 0.05, 'triangle', 0.1); break;
      case 'start': for (let i = 0; i < 3; i++) this.tone(523, t + i * 0.18, 0.12, 'square', 0.09); this.tone(1046, t + 0.54, 0.4, 'square', 0.1); break;
      case 'medal': [523, 659, 784, 1046, 1318].forEach((f, i) => this.tone(f, t + i * 0.09, 0.35, 'triangle', 0.17)); break;
      case 'win': [392, 523, 659, 784, 1046, 784, 1046, 1318].forEach((f, i) => this.tone(f, t + i * 0.11, 0.4, 'triangle', 0.16)); break;
      case 'fail': this.tone(330, t, 0.25, 'sawtooth', 0.09, null, 0.005, 0.6); this.tone(220, t + 0.2, 0.45, 'sawtooth', 0.09, null, 0.005, 0.6); break;
      case 'hit': this.burst(t, 0.22, 'lowpass', 900 * k + 300, 0.7, 0.5 * k); this.tone(90, t, 0.18, 'sine', 0.4 * k, null, 0.002, 0.5); break;
      case 'crash': this.burst(t, 0.5, 'lowpass', 1400, 0.6, 0.8); this.burst(t + 0.03, 0.35, 'bandpass', 3200, 2, 0.35, 0.4); this.tone(70, t, 0.35, 'sine', 0.6, null, 0.002, 0.4); break;
      case 'smash': this.burst(t, 0.2, 'bandpass', 1500, 1.2, 0.35); this.tone(180, t, 0.1, 'square', 0.1, null, 0.002, 0.5); break;
      case 'land': this.burst(t, 0.2, 'lowpass', 500, 0.6, 0.5 * k); this.tone(60, t, 0.2, 'sine', 0.5 * k, null, 0.002, 0.5); break;
      case 'splash': this.burst(t, 0.7, 'bandpass', 1300, 0.8, 0.5, 0.4); break;
      case 'pour': this.burst(t, 1.1, 'bandpass', 1700, 1.4, 0.22, 0.9); this.burst(t + 0.15, 0.9, 'bandpass', 2300, 2, 0.12, 0.8); break; // suv/yoqilg'i quyilishi
      case 'sizzle': this.burst(t, 1.4, 'highpass', 4200, 0.6, 0.12, 1.2); break; // qozonda jizillash
      case 'alarm': for (let i = 0; i < 6; i++) this.tone(i % 2 ? 1760 : 1568, t + i * 0.14, 0.1, 'square', 0.07); break; // budilnik
      case 'sip': this.burst(t, 0.12, 'lowpass', 900, 1.2, 0.25); this.burst(t + 0.3, 0.12, 'lowpass', 800, 1.2, 0.22); break;
      case 'horn': this.tone(392, t, 0.45, 'square', 0.1); this.tone(494, t, 0.45, 'square', 0.1); break;
      case 'repair': for (let i = 0; i < 4; i++) this.burst(t + i * 0.12, 0.06, 'bandpass', 2600, 4, 0.25); this.tone(784, t + 0.5, 0.3, 'triangle', 0.15); break;
      case 'buy': this.tone(784, t, 0.1, 'triangle', 0.15); this.tone(1175, t + 0.08, 0.1, 'triangle', 0.15); this.tone(1568, t + 0.16, 0.3, 'triangle', 0.15); break;
      case 'tick': this.tone(1200, t, 0.04, 'square', 0.05); break;
      case 'pop': this.tone(500, t, 0.1, 'sine', 0.2, null, 0.002, 2.2); break;
      case 'tire': this.burst(t, 0.5, 'highpass', 900, 0.6, 0.5, 0.3); this.tone(120, t, 0.25, 'sine', 0.4, null, 0.002, 0.4); break;
      case 'cough': this.burst(t, 0.12, 'lowpass', 500, 0.8, 0.5); this.burst(t + 0.16, 0.1, 'lowpass', 380, 0.8, 0.4); this.tone(55, t, 0.2, 'sawtooth', 0.2, null, 0.002, 0.6); break;
      case 'step': this.burst(t, 0.06, k === 0 || k === 8 || k === 5 ? 'bandpass' : 'lowpass', k === 3 ? 2400 : k === 0 || k === 8 ? 1100 : 600, 0.9, 0.09); break;
      case 'jump': this.tone(260, t, 0.12, 'sine', 0.1, null, 0.004, 1.8); break;
      case 'pluck': this.burst(t, 0.14, 'bandpass', 2200, 1.5, 0.3, 0.5); break;
      case 'rustle': this.burst(t, 0.5, 'highpass', 2600, 0.7, 0.28, 0.7); this.burst(t + 0.25, 0.4, 'highpass', 3200, 0.7, 0.2, 0.7); break;
      case 'pick': this.tone(880, t, 0.06, 'triangle', 0.12); this.tone(1320, t + 0.05, 0.1, 'triangle', 0.12); break;
      case 'eat': for (let i = 0; i < 3; i++) this.burst(t + i * 0.14, 0.07, 'bandpass', 1300 + i * 200, 2, 0.3); break;
      case 'bark': this.tone(420, t, 0.09, 'sawtooth', 0.16, null, 0.004, 0.6); this.tone(460, t + 0.16, 0.1, 'sawtooth', 0.16, null, 0.004, 0.6); break;
      case 'baa': { const g = this.tone(330, t, 0.5, 'sawtooth', 0.09, null, 0.03, 0.85); for (let i = 0; i < 6; i++) g.gain.setValueAtTime(0.09 * (i % 2 ? 0.5 : 1), t + 0.06 + i * 0.06); break; }
      case 'cast': this.burst(t, 0.3, 'highpass', 3000, 0.7, 0.2, 0.5); this.tone(700, t + 0.3, 0.08, 'sine', 0.12, null, 0.002, 0.5); break;
      case 'bite': this.tone(1500, t, 0.07, 'square', 0.1); this.tone(1900, t + 0.09, 0.07, 'square', 0.1); this.burst(t, 0.2, 'bandpass', 1500, 1, 0.25); break;
      case 'whistle': this.tone(1900, t, 0.16, 'sine', 0.16, null, 0.01, 1.35); this.tone(2500, t + 0.2, 0.3, 'sine', 0.16, null, 0.01, 0.8); break;
      case 'door': this.burst(t, 0.09, 'lowpass', 700, 0.8, 0.5); this.tone(110, t, 0.09, 'sine', 0.3, null, 0.002, 0.6); break;
      case 'fire': this.burst(t, 0.6, 'bandpass', 900, 0.6, 0.4, 2.5); break;
      case 'bell': this.tone(2100, t, 0.5, 'sine', 0.14); this.tone(2640, t, 0.4, 'sine', 0.08); this.tone(2100, t + 0.2, 0.5, 'sine', 0.14); break;
      case 'siren': for (let i = 0; i < 4; i++) { this.tone(660, t + i * 0.5, 0.26, 'sawtooth', 0.07, null, 0.02, 1.4); this.tone(920, t + i * 0.5 + 0.25, 0.26, 'sawtooth', 0.07, null, 0.02, 0.72); } break;
    }
  }
  // dutor notasi (kod bilan sintez qilinadi)
  note(n, dur = 0.4) { if (!this.ready) return; const t = this.ctx.currentTime, f = midi(n); const g = this.tone(f, t, dur, 'triangle', 0.16, null, 0.004); g.connect(this.send); this.tone(f * 2, t, dur * 0.5, 'sine', 0.05, null, 0.004); this.burst(t, 0.03, 'bandpass', 2200, 2, 0.12); }
  update(dt, car, env) {
    if (!this.ready) return; const c = this.ctx, t = c.currentTime;
    const ek = env.eng == null ? 1 : env.eng, rpm = car.rpm, thr = env.foot ? 0 : car.throttle, sp = env.foot ? 0 : Math.abs(car.fwd);
    const f0 = (30 + rpm * 82) * (ek || 1);
    this.o1.frequency.setTargetAtTime(f0, t, 0.03); this.o2.frequency.setTargetAtTime(f0 * 0.5, t, 0.03); this.o3.frequency.setTargetAtTime(f0 * 1.51, t, 0.03); this.lfo.frequency.setTargetAtTime(f0 * 0.25, t, 0.05);
    this.engF.frequency.setTargetAtTime(260 + rpm * 1500 + thr * 700, t, 0.05);
    this.engG.gain.setTargetAtTime(env.mute || env.foot || !ek ? 0 : (0.055 + thr * 0.075 + rpm * 0.03) * (env.dead ? 0.25 : 1) * (ek > 1.3 ? 0.8 : 1), t, 0.06);
    const rough = env.surf === 0 || env.surf === 8 ? 0.6 : env.surf === 7 ? 0.3 : 1;
    this.road.g.gain.setTargetAtTime(env.mute ? 0 : Math.min(0.2, sp * 0.0045) * rough * (car.onGround ? 1 : 0) * (ek ? 1 : 0.5), t, 0.1); this.road.f.frequency.setTargetAtTime(280 + sp * 14, t, 0.1);
    this.wind.g.gain.setTargetAtTime(env.mute ? 0 : Math.min(0.16, sp * sp * 0.00011), t, 0.2); this.wind.f.frequency.setTargetAtTime(500 + sp * 18, t, 0.2);
    this.skid.g.gain.setTargetAtTime(env.mute || env.foot ? 0 : Math.min(0.14, (car.slip || 0) * 0.16) * (sp > 3 ? 1 : 0) * (env.surf === 0 || env.surf === 8 || env.surf === 5 ? 1 : 0.35), t, 0.05);
    this.nitro.g.gain.setTargetAtTime(car.nitroOn && !env.mute && !env.foot ? 0.09 : 0, t, 0.08);
    // muhit: dengiz/shamol
    this.ambN.g.gain.setTargetAtTime(env.mute ? 0 : (env.sea * 0.07 + env.snow * 0.05) * (0.7 + 0.3 * Math.sin(this.t * 0.5)), t, 0.4); this.ambN.f.frequency.setTargetAtTime(env.snow > 0.5 ? 900 : 420, t, 0.5);
    this.t += dt; this.amb -= dt;
    if (this.amb <= 0 && !env.mute) {
      this.amb = 0.6 + Math.random() * 2.6;
      if (env.night > 0.6 && env.green) { const f = 4200 + Math.random() * 600; for (let i = 0; i < 4; i++) this.tone(f, t + i * 0.07, 0.04, 'sine', 0.018); }
      else if (env.night < 0.4 && env.green && sp < 26) { const f = 2200 + Math.random() * 1800; const n = 2 + ((Math.random() * 3) | 0); for (let i = 0; i < n; i++) this.tone(f * (1 + i * 0.06), t + i * 0.11, 0.09, 'sine', 0.022, null, 0.01, 1.25); }
      if (env.fire) for (let i = 0; i < 3; i++) this.burst(t + Math.random() * 0.5, 0.03, 'bandpass', 2400 + Math.random() * 1500, 3, 0.1 * env.fire);
    }
    if (this.musicOn) this.music(env);
  }
  // --- generativ musiqa ---
  music(env) {
    const c = this.ctx; if (c.currentTime < this.nextBar - 0.25) return;
    const night = env.night > 0.5, bpm = night ? 66 : 78, beat = 60 / bpm, t0 = this.nextBar; this.nextBar += beat * 4;
    const prog = night ? [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]] : [[48, 52, 55], [57, 60, 64], [53, 57, 60], [55, 59, 62]];
    const scale = night ? [57, 60, 62, 64, 67, 69, 72, 74, 76] : [60, 62, 64, 67, 69, 72, 74, 76, 79];
    const ch = prog[this.bar % 4]; this.bar++;
    const pad = (n, v) => { for (const det of [-5, 6]) { const o = c.createOscillator(); o.type = 'triangle'; o.frequency.value = midi(n); o.detune.value = det; const g = c.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(v, t0 + beat * 1.2); g.gain.linearRampToValueAtTime(v * 0.7, t0 + beat * 3.2); g.gain.linearRampToValueAtTime(0.0001, t0 + beat * 4.6); const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900; o.connect(f); f.connect(g); g.connect(this.mus); o.start(t0); o.stop(t0 + beat * 4.8); } };
    for (const n of ch) pad(n, 0.05); pad(ch[0] - 12, 0.06);
    this.tone(midi(ch[0] - 24), t0, beat * 1.8, 'sine', 0.16, this.mus, 0.02); this.tone(midi(ch[0] - 24), t0 + beat * 2.5, beat * 1.2, 'sine', 0.11, this.mus, 0.02);
    // arpejio / kuy
    if (this._n == null) this._n = 4;
    const dens = env.calm ? 0.42 : 0.62;
    for (let i = 0; i < 8; i++) {
      if (Math.random() > dens && i % 4 !== 0) continue;
      this._n = clamp(this._n + ((Math.random() * 5) | 0) - 2, 0, scale.length - 1);
      let n = scale[this._n]; if (i % 4 === 0) { const tones = ch.map((q) => q + 12); n = tones[(Math.random() * 3) | 0]; }
      const tt = t0 + i * beat * 0.5 + (i % 2 ? 0.012 : 0);
      const g = this.tone(midi(n), tt, beat * 1.1, 'triangle', 0.075, this.mus, 0.006); g.connect(this.send);
      if (Math.random() < 0.18) this.tone(midi(n + 12), tt + beat * 0.25, beat * 0.6, 'sine', 0.03, this.send, 0.006);
    }
  }
}
