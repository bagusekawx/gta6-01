// Synthesized sound: every noise is built with WebAudio oscillators and
// filtered noise — no audio files, no network. All calls are safe before
// the context exists (headless / no-gesture environments just stay silent).
export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.engineNodes = null;
    this.sirenNodes = null;
    this.musicTimer = null;
    this.musicStep = 0;
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.5;
      this.master.connect(this.ctx.destination);
    } catch { this.ctx = null; }
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.5;
  }

  _tone(freq, dur, type = 'sine', vol = 0.2, when = 0, slideTo = null) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + when;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  _noise(dur, vol = 0.3, cutoff = 1200, when = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + when;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = cutoff;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t);
  }

  blip() { this._tone(880, 0.08, 'sine', 0.15); }
  pickup() { this._tone(660, 0.1, 'sine', 0.2); this._tone(990, 0.14, 'sine', 0.2, 0.08); }
  shot() { this._noise(0.16, 0.5, 900); this._tone(140, 0.12, 'square', 0.25, 0, 60); }
  crash() { this._noise(0.3, 0.4, 500); this._tone(90, 0.25, 'sawtooth', 0.2, 0, 45); }
  damage() { this._tone(180, 0.15, 'sawtooth', 0.25, 0, 90); }
  jingle() { [523, 659, 784, 1047].forEach((f, i) => this._tone(f, 0.22, 'triangle', 0.22, i * 0.11)); }
  fail() { [392, 330, 262].forEach((f, i) => this._tone(f, 0.25, 'triangle', 0.2, i * 0.14)); }

  // Continuous engine hum while driving; speed01 in [0,1] sets the pitch.
  setEngine(speed01, on) {
    if (!this.ctx) return;
    if (!on) {
      if (this.engineNodes) {
        try { this.engineNodes.osc.stop(); } catch { /* already stopped */ }
        this.engineNodes = null;
      }
      return;
    }
    if (!this.engineNodes) {
      const o = this.ctx.createOscillator();
      const o2 = this.ctx.createOscillator();
      const f = this.ctx.createBiquadFilter();
      const g = this.ctx.createGain();
      o.type = 'sawtooth'; o2.type = 'square';
      f.type = 'lowpass'; f.frequency.value = 400;
      g.gain.value = 0.06;
      o.connect(f); o2.connect(f); f.connect(g).connect(this.master);
      o.start(); o2.start();
      this.engineNodes = { osc: o, osc2: o2, filter: f, gain: g };
    }
    const base = 55 + speed01 * 130;
    this.engineNodes.osc.frequency.setTargetAtTime(base, this.ctx.currentTime, 0.08);
    this.engineNodes.osc2.frequency.setTargetAtTime(base * 1.5, this.ctx.currentTime, 0.08);
    this.engineNodes.filter.frequency.setTargetAtTime(300 + speed01 * 900, this.ctx.currentTime, 0.1);
  }

  // Two-tone police siren while any cop car is near.
  setSiren(on) {
    if (!this.ctx) return;
    if (!on) {
      if (this.sirenNodes) {
        try { this.sirenNodes.osc.stop(); this.sirenNodes.lfo.stop(); } catch { /* stopped */ }
        this.sirenNodes = null;
      }
      return;
    }
    if (this.sirenNodes) return;
    const o = this.ctx.createOscillator();
    const lfo = this.ctx.createOscillator();
    const lg = this.ctx.createGain();
    const g = this.ctx.createGain();
    o.type = 'triangle'; o.frequency.value = 850;
    lfo.type = 'square'; lfo.frequency.value = 1.6;
    lg.gain.value = 220;
    lfo.connect(lg).connect(o.frequency);
    g.gain.value = 0.05;
    o.connect(g).connect(this.master);
    o.start(); lfo.start();
    this.sirenNodes = { osc: o, lfo };
  }

  // A quiet looping bassline + hats so the city never sits silent.
  startMusic() {
    if (!this.ctx || this.musicTimer) return;
    const bass = [55, 55, 65.4, 49];
    this.musicTimer = setInterval(() => {
      if (!this.ctx || this.muted) return;
      const f = bass[this.musicStep % bass.length];
      this._tone(f, 0.5, 'triangle', 0.12);
      if (this.musicStep % 2 === 0) this._noise(0.05, 0.05, 6000);
      this.musicStep++;
    }, 480);
  }
}
