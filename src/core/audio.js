/** Audio: menu theme through WebAudio (for an analyser), plus synthesized retro SFX. */
import { CONFIG } from './config.js';

export class Audio {
  constructor() {
    this.ctx = null;
    this.musicEl = null;
    this.musicGain = null;
    this.analyser = null;
    this.freq = null;
    this.sfxGain = null;
    this.ready = false;
    this.musicPlaying = false;
    this._level = 0;
    this._vol = CONFIG.audio.musicVolume;
  }

  async init() {
    if (this.ready) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { console.warn('[audio] WebAudio unavailable; running silent.'); return; }
    try {
      this.ctx = new AC();
    } catch (e) {
      console.warn('[audio] AudioContext could not start; running silent.', e);
      this.ctx = null;
      return;
    }
    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = CONFIG.audio.sfxVolume;
    this.sfxGain.connect(this.ctx.destination);

    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = this._vol;
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 256;
    this.analyser.smoothingTimeConstant = 0.72;
    this.freq = new Uint8Array(this.analyser.frequencyBinCount);
    this.musicGain.connect(this.analyser);
    this.analyser.connect(this.ctx.destination);
    this.ready = true;
  }

  async playMusic(src, { loop = true } = {}) {
    try { await this.init(); } catch (e) { console.warn('[audio] init failed', e); }
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') {
      try { await Promise.race([this.ctx.resume(), new Promise((r) => setTimeout(r, 600))]); } catch { /* ignore */ }
    }
    if (!this.musicEl) {
      const el = new window.Audio(src);
      el.loop = loop;
      el.crossOrigin = 'anonymous';
      el.preload = 'auto';
      try {
        const node = this.ctx.createMediaElementSource(el);
        node.connect(this.musicGain);
      } catch (e) {
        // Fallback: unconnected element still plays on its own.
        el.volume = this._vol;
      }
      this.musicEl = el;
      el.addEventListener('ended', () => { this.musicPlaying = false; });
    }
    try {
      await Promise.race([this.musicEl.play(), new Promise((r) => setTimeout(r, 1200))]);
      this.musicPlaying = !this.musicEl.paused;
      if (!this.musicPlaying) console.info('[audio] music did not start (autoplay or no output device)');
    } catch (e) {
      console.warn('[audio] music blocked', e);
    }
  }

  stopMusic() {
    if (this.musicEl) {
      this.musicEl.pause();
      this.musicPlaying = false;
    }
  }

  setVolume(v) {
    this._vol = Math.max(0, Math.min(1, Number(v) || 0));
    if (this.musicGain) this.musicGain.gain.value = this._vol;
    if (this.musicEl) this.musicEl.volume = this._vol;
  }

  /** 0..1 rms of the current music frame, smoothed. */
  level() {
    if (!this.analyser) return 0;
    this.analyser.getByteFrequencyData(this.freq);
    let sum = 0;
    for (let i = 0; i < this.freq.length; i++) sum += this.freq[i];
    const avg = sum / this.freq.length / 255;
    this._level += (avg - this._level) * 0.24;
    return Math.min(1, this._level * 2.6);
  }

  bands(n = 16) {
    if (!this.analyser) return new Array(n).fill(0);
    this.analyser.getByteFrequencyData(this.freq);
    const out = [];
    const step = Math.floor(this.freq.length / n) || 1;
    for (let i = 0; i < n; i++) {
      let s = 0;
      for (let j = 0; j < step; j++) s += this.freq[i * step + j] || 0;
      out.push(Math.min(1, (s / step / 255) * 1.9));
    }
    return out;
  }

  /* ---------------- synthesized sfx ---------------- */
  blip(freq = 660, dur = 0.05, type = 'square', vol = 0.16) {
    if (!this.ctx || this.ctx.state === 'suspended') return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  sweep(from = 200, to = 900, dur = 0.25, type = 'sawtooth', vol = 0.1) {
    if (!this.ctx || this.ctx.state === 'suspended') return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, t);
    osc.frequency.exponentialRampToValueAtTime(to, t + dur);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(this.sfxGain);
    osc.start(t); osc.stop(t + dur + 0.02);
  }

  noise(dur = 0.25, vol = 0.12, filterFreq = 900) {
    if (!this.ctx || this.ctx.state === 'suspended') return;
    const rate = this.ctx.sampleRate;
    const buf = this.ctx.createBuffer(1, Math.max(1, rate * dur), rate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const bq = this.ctx.createBiquadFilter();
    bq.type = 'bandpass';
    bq.frequency.value = filterFreq;
    const gain = this.ctx.createGain();
    gain.gain.value = vol;
    src.connect(bq).connect(gain).connect(this.sfxGain);
    src.start();
  }

  /**
   * The grown-up voice from the cartoons: a muted, nasal mumble with no words in it.
   * One sawtooth per syllable through a narrow bandpass, pitch drifting down — reads as
   * speech through a wall, which is all an NPC conversation needs to be.
   */
  mumble(text = '', { pitch = 1, volume = 0.09 } = {}) {
    if (!this.ctx || this.ctx.state === 'suspended') return;
    const raw = String(text).replace(/["“”'.,!?\n]/g, ' ').trim();
    const words = raw ? raw.split(/\s+/).length : 4;
    const n = Math.max(3, Math.min(16, words));
    const t0 = this.ctx.currentTime + 0.02;
    const base = 132 * pitch;
    for (let i = 0; i < n; i++) {
      const at = t0 + i * (0.075 + (i % 3) * 0.012);
      const dur = 0.052 + (i % 2) * 0.018;
      const osc = this.ctx.createOscillator();
      osc.type = 'sawtooth';
      const f0 = base * (0.88 + ((i * 7) % 5) * 0.06);
      osc.frequency.setValueAtTime(f0, at);
      osc.frequency.linearRampToValueAtTime(f0 * 1.22, at + dur * 0.75);
      osc.frequency.linearRampToValueAtTime(f0 * 0.92, at + dur);

      const formant = this.ctx.createBiquadFilter();
      formant.type = 'bandpass';
      formant.frequency.setValueAtTime(430 + ((i * 3) % 4) * 120, at);
      formant.Q.value = 6;

      const nasal = this.ctx.createBiquadFilter();
      nasal.type = 'lowpass';
      nasal.frequency.value = 1250;

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(volume, at + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);

      osc.connect(formant).connect(nasal).connect(gain).connect(this.sfxGain);
      osc.start(at);
      osc.stop(at + dur + 0.03);
    }
  }

  sfx(name) {
    switch (name) {
      case 'ui': return this.blip(720, 0.04, 'square', 0.1);
      case 'ui-back': return this.blip(420, 0.05, 'square', 0.1);
      case 'confirm': return this.sweep(420, 900, 0.14, 'square', 0.12);
      case 'deny': return this.sweep(300, 120, 0.2, 'sawtooth', 0.13);
      case 'cash': this.blip(1180, 0.05, 'square', 0.11); setTimeout(() => this.blip(1560, 0.06, 'square', 0.1), 60); return;
      case 'work': this.noise(0.4, 0.07, 500); return;
      case 'step': return this.noise(0.07, 0.045, 320);
      case 'door': this.noise(0.22, 0.1, 220); setTimeout(() => this.blip(160, 0.1, 'sine', 0.08), 120); return;
      case 'dose': return this.sweep(900, 140, 0.9, 'sine', 0.12);
      case 'high': return this.sweep(200, 1200, 0.6, 'triangle', 0.08);
      case 'bad': this.sweep(180, 60, 0.5, 'sawtooth', 0.16); return;
      case 'alarm': this.blip(980, 0.12, 'square', 0.14); setTimeout(() => this.blip(760, 0.12, 'square', 0.13), 150); return;
      case 'sting': this.sweep(1200, 90, 0.7, 'sawtooth', 0.14); return;
      case 'phone': this.blip(1320, 0.05, 'square', 0.09); return;
      default: return this.blip(600, 0.04);
    }
  }
}
