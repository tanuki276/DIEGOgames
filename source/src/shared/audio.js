import { loadSettings, saveSettings } from './storage.js';

// Cheerful upbeat pentatonic melody notes (Hz) for light procedural BGM
const BGM_MELODY = [
  523.25, 659.25, 783.99, 659.25, 880.0, 783.99, 659.25, 587.33,
  523.25, 587.33, 659.25, 783.99, 659.25, 587.33, 523.25, 0,
  587.33, 698.46, 880.0, 698.46, 783.99, 659.25, 523.25, 587.33,
  659.25, 783.99, 880.0, 1046.5, 880.0, 783.99, 659.25, 0,
];

const BGM_BASS = [
  130.81, 0, 196.0, 0, 174.61, 0, 196.0, 0,
  130.81, 0, 164.81, 0, 146.83, 0, 196.0, 0,
  146.83, 0, 220.0, 0, 196.0, 0, 164.81, 0,
  174.61, 0, 196.0, 0, 130.81, 0, 196.0, 0,
];

class SoundEngine {
  constructor() {
    this.ctx = null;
    this.settings = loadSettings();
    this.bgmMaster = null;
    this.seMaster = null;
    this.bgmInterval = null;
    this.bgmStep = 0;
    this.bgmWanted = false;
    this.listeners = new Set();

    window.addEventListener('storage', (e) => {
      if (e.key === 'diegogames_settings_v1') {
        this.settings = loadSettings();
        this._applyGains();
        this._notify();
      }
    });
  }

  onChange(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  _notify() {
    for (const fn of this.listeners) fn({ ...this.settings });
  }

  getSettings() {
    return { ...this.settings };
  }

  updateSettings(partial) {
    this.settings = saveSettings({ ...this.settings, ...partial });
    this._applyGains();
    this._notify();
    return { ...this.settings };
  }

  toggleMute() {
    return this.updateSettings({ muted: !this.settings.muted });
  }

  _applyGains() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const bgmVol = this.settings.muted ? 0 : this.settings.bgm * 0.24;
    const seVol = this.settings.muted ? 0 : this.settings.se;
    if (this.bgmMaster) this.bgmMaster.gain.setTargetAtTime(bgmVol, now, 0.03);
    if (this.seMaster) this.seMaster.gain.setTargetAtTime(seVol, now, 0.02);
  }

  unlock(startBgm = false) {
    if (startBgm) this.bgmWanted = true;
    try {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        this.bgmMaster = this.ctx.createGain();
        this.seMaster = this.ctx.createGain();
        this.bgmMaster.connect(this.ctx.destination);
        this.seMaster.connect(this.ctx.destination);
        this._applyGains();
      }
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      if (this.bgmWanted && !this.bgmInterval) {
        this._startBgmLoop();
      }
    } catch {
      // Ignore in headless/restricted browsers
    }
  }

  _startBgmLoop() {
    if (this.bgmInterval) return;
    this.bgmInterval = window.setInterval(() => {
      if (!this.ctx || this.ctx.state !== 'running' || this.settings.muted || this.settings.bgm <= 0.005) {
        return;
      }
      const idx = this.bgmStep % BGM_MELODY.length;
      this.bgmStep++;
      const mel = BGM_MELODY[idx];
      const bass = BGM_BASS[idx];
      const now = this.ctx.currentTime;

      if (mel > 0) {
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(mel, now);
        g.gain.setValueAtTime(0.0001, now);
        g.gain.linearRampToValueAtTime(0.28, now + 0.015);
        g.gain.exponentialRampToValueAtTime(0.0001, now + 0.19);
        osc.connect(g);
        g.connect(this.bgmMaster);
        osc.start(now);
        osc.stop(now + 0.21);
      }

      if (bass > 0) {
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(bass, now);
        g.gain.setValueAtTime(0.0001, now);
        g.gain.linearRampToValueAtTime(0.32, now + 0.015);
        g.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);
        osc.connect(g);
        g.connect(this.bgmMaster);
        osc.start(now);
        osc.stop(now + 0.27);
      }
    }, 215);
  }

  _seTone(freqStart, freqEnd, duration, type = 'sine', gainPeak = 0.15, delay = 0) {
    if (this.settings.muted || this.settings.se <= 0.005 || !this.ctx || this.ctx.state !== 'running') return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freqStart, t0);
    if (freqEnd !== freqStart) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), t0 + duration);
    }
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.linearRampToValueAtTime(gainPeak, t0 + Math.min(0.014, duration * 0.2));
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(gain);
    gain.connect(this.seMaster);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  }

  jump() {
    this._seTone(280, 580, 0.13, 'sine', 0.14);
    this._seTone(420, 700, 0.09, 'triangle', 0.07, 0.02);
  }

  land(intensity = 0.5) {
    const vol = Math.min(0.15, 0.04 + intensity * 0.09);
    this._seTone(150, 72, 0.09, 'sine', vol);
  }

  bounce() {
    this._seTone(220, 780, 0.22, 'sine', 0.18);
    this._seTone(330, 1020, 0.18, 'triangle', 0.1, 0.03);
  }

  geyser() {
    this._seTone(160, 620, 0.26, 'sawtooth', 0.09);
    this._seTone(280, 880, 0.22, 'triangle', 0.13, 0.02);
  }

  bonk() {
    this._seTone(240, 105, 0.17, 'triangle', 0.18);
    this._seTone(180, 85, 0.13, 'sawtooth', 0.07, 0.01);
  }

  flag() {
    this._seTone(523.25, 523.25, 0.12, 'triangle', 0.14, 0);
    this._seTone(659.25, 659.25, 0.12, 'triangle', 0.14, 0.08);
    this._seTone(783.99, 783.99, 0.22, 'triangle', 0.16, 0.16);
  }

  click() {
    this._seTone(520, 680, 0.06, 'sine', 0.1);
  }

  win() {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((n, i) => {
      this._seTone(n, n, i === 3 ? 0.5 : 0.14, 'triangle', 0.17, i * 0.1);
      this._seTone(n * 0.5, n * 0.5, i === 3 ? 0.5 : 0.14, 'sine', 0.09, i * 0.1);
    });
  }
}

export const sound = new SoundEngine();
