class SoundEngine {
  constructor() {
    this.ctx = null;
    this.muted = false;
  }

  unlock() {
    if (this.muted) return;
    try {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (AC) this.ctx = new AC();
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
    } catch {
      // Ignore audio errors in headless/restricted environments
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    return this.muted;
  }

  _tone(freqStart, freqEnd, duration, type = 'sine', gainPeak = 0.14, delay = 0) {
    if (this.muted || !this.ctx || this.ctx.state !== 'running') return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freqStart, t0);
    if (freqEnd !== freqStart) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), t0 + duration);
    }
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.linearRampToValueAtTime(gainPeak, t0 + Math.min(0.015, duration * 0.2));
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  }

  jump() {
    this._tone(270, 560, 0.13, 'sine', 0.12);
    this._tone(400, 680, 0.09, 'triangle', 0.06, 0.02);
  }

  land(intensity = 0.5) {
    const vol = Math.min(0.14, 0.04 + intensity * 0.08);
    this._tone(150, 75, 0.09, 'sine', vol);
  }

  bounce() {
    this._tone(220, 760, 0.22, 'sine', 0.16);
    this._tone(330, 990, 0.18, 'triangle', 0.09, 0.03);
  }

  bonk() {
    this._tone(240, 110, 0.16, 'triangle', 0.16);
    this._tone(180, 90, 0.12, 'sawtooth', 0.06, 0.01);
  }

  flag() {
    this._tone(523.25, 523.25, 0.12, 'triangle', 0.12, 0);
    this._tone(659.25, 659.25, 0.12, 'triangle', 0.12, 0.08);
    this._tone(783.99, 783.99, 0.22, 'triangle', 0.14, 0.16);
  }

  win() {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((n, i) => {
      this._tone(n, n, i === 3 ? 0.45 : 0.14, 'triangle', 0.15, i * 0.1);
      this._tone(n * 0.5, n * 0.5, i === 3 ? 0.45 : 0.14, 'sine', 0.08, i * 0.1);
    });
  }
}

export const sound = new SoundEngine();
