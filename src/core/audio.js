/** Audio: the soundtrack through WebAudio (crossfades, one analyser), plus synthesized retro SFX. */
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
    // srcs whose file would not load. The director reads this so a broken track is asked for
    // once, not every time the room is re-checked.
    this.failed = new Set();
    this._level = 0;
    this._vol = CONFIG.audio.musicVolume;
    this._sfx = CONFIG.audio.sfxVolume;
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
    this.sfxGain.gain.value = this._sfx;
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

  /**
   * The soundtrack: one <audio> element per track, each through its own gain into the shared
   * music bus (so the analyser and the volume setting still see everything). Changing track
   * crossfades: the old one ramps out and pauses once silent, the new one ramps in. Asking for
   * the track that is already playing does nothing, so walking between rooms that share a score
   * never restarts it; a track left mid-way keeps its position and picks up from there when it
   * comes back, unless `restart` asks for the top.
   *
   * The files are played exactly as delivered. Their low bitrate, hiss and crunch are the sound
   * of the game; nothing here filters or normalises them.
   */
  async playTrack(src, { fade = 1.6, restart = false, loop = true, fallback = null } = {}) {
    // never re-open a file that already failed: go straight to what should be heard instead
    if (fallback && this.failed.has(src)) return this.playTrack(fallback, { fade, loop });
    try { await this.init(); } catch (e) { console.warn('[audio] init failed', e); }
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') {
      try { await Promise.race([this.ctx.resume(), new Promise((r) => setTimeout(r, 600))]); } catch { /* ignore */ }
    }
    this.tracks = this.tracks || new Map();
    const want = this.tracks.get(src);
    if (want && this.current === want && !want.el.paused && !restart) return;

    let t = want;
    if (!t) {
      const el = new window.Audio(src);
      el.loop = loop;
      el.crossOrigin = 'anonymous';
      el.preload = 'auto';
      const gain = this.ctx.createGain();
      gain.gain.value = 0;
      gain.connect(this.musicGain);
      t = { src, el, gain, wired: false, stopTimer: 0 };
      try {
        this.ctx.createMediaElementSource(el).connect(gain);
        t.wired = true;
      } catch (e) {
        el.volume = 0; // unwired fallback: fade the element itself
      }
      // a missing file is not a crash: remember it, and hand the room the fallback track
      el.addEventListener('error', () => {
        console.warn('[audio] could not load', src);
        this.failed.add(src);
        if (fallback && fallback !== src && this.current === t) {
          this.current = null;
          this.playTrack(fallback, { fade, loop });
        }
      });
      this.tracks.set(src, t);
    }

    const now = this.ctx.currentTime;
    const ramp = (track, to) => {
      clearInterval(track.fadeTimer);
      if (track.wired) {
        const g = track.gain.gain;
        g.cancelScheduledValues(now);
        g.setValueAtTime(g.value, now);
        g.linearRampToValueAtTime(to, now + fade);
      } else {
        const from = track.el.volume;
        const target = to * this._vol;
        const t0 = performance.now();
        track.fadeTimer = setInterval(() => {
          const k = Math.min(1, (performance.now() - t0) / (fade * 1000));
          track.el.volume = Math.max(0, Math.min(1, from + (target - from) * k));
          if (k >= 1) clearInterval(track.fadeTimer);
        }, 50);
      }
    };

    // everything else fades out and stops once it is silent: one score at a time
    for (const other of this.tracks.values()) {
      if (other === t || other.el.paused) continue;
      ramp(other, 0);
      clearTimeout(other.stopTimer);
      other.stopTimer = setTimeout(() => { if (this.current !== other) other.el.pause(); }, fade * 1000 + 120);
    }

    clearTimeout(t.stopTimer);
    if (restart) t.el.currentTime = 0;
    this.current = t;
    this.musicEl = t.el;
    ramp(t, 1);
    try {
      await Promise.race([t.el.play(), new Promise((r) => setTimeout(r, 1200))]);
      this.musicPlaying = !t.el.paused;
      if (!this.musicPlaying) console.info('[audio] music did not start (autoplay or no output device)');
    } catch (e) {
      console.warn('[audio] music blocked', e);
    }
  }

  /** Kept for older callers: a single track is just the soundtrack with one entry. */
  async playMusic(src, { loop = true } = {}) {
    return this.playTrack(src, { loop, fade: 0.6 });
  }

  stopMusic(fade = 1.2) {
    if (!this.current || !this.ctx) return;
    const t = this.current;
    this.current = null;
    this.musicPlaying = false;
    if (t.wired) {
      const now = this.ctx.currentTime;
      t.gain.gain.cancelScheduledValues(now);
      t.gain.gain.setValueAtTime(t.gain.gain.value, now);
      t.gain.gain.linearRampToValueAtTime(0, now + fade);
    }
    clearTimeout(t.stopTimer);
    t.stopTimer = setTimeout(() => t.el.pause(), fade * 1000 + 120);
  }

  /** Music bus level. Never restarts a track: it is a gain, and the track keeps its position. */
  setVolume(v) {
    this._vol = Math.max(0, Math.min(1, Number(v) || 0));
    if (this.musicGain) this.musicGain.gain.value = this._vol;
    // wired tracks take their level from the bus; an unwired fallback carries it itself
    if (this.current && !this.current.wired) this.current.el.volume = this._vol;
  }

  /**
   * Everything the game synthesises goes through sfxGain — footsteps, doors, eating, the phone,
   * voices — so one slider covers all of it without touching the soundtrack on the music bus.
   */
  setSfxVolume(v) {
    this._sfx = Math.max(0, Math.min(1, Number(v) || 0));
    if (this.sfxGain) this.sfxGain.gain.value = this._sfx;
  }

  /** Read back for the settings UI (before the context exists, the stored value is all there is). */
  get volumes() {
    return { music: this._vol, sfx: this._sfx };
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

  /**
   * Out of breath, as a rate rather than a switch: `spent` 0 is a man who has just dipped under
   * the gate — one short, quiet pull — and 1 is a man with nothing left, two deep ones. The point
   * is that the sound tracks the bar: near the gate it is barely there, and it grows as he keeps
   * asking the body for a run it cannot pay for.
   */
  pant(spent = 1) {
    if (!this.ctx || this.ctx.state === 'suspended') return;
    const k = Math.max(0, Math.min(1, spent));
    const dur = 0.09 + 0.11 * k;          // 90 ms near the gate, 200 ms empty
    const vol = 0.032 + 0.062 * k;        // a third as loud near the gate
    this.noise(dur, vol, 760 + 120 * k);
    setTimeout(() => this.noise(dur * 0.8, vol * 0.7, 620), 210 + 60 * k);
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
      case 'pant': return this.pant(1);
      case 'door': this.noise(0.22, 0.1, 220); setTimeout(() => this.blip(160, 0.1, 'sine', 0.08), 120); return;
      case 'dose': return this.sweep(900, 140, 0.9, 'sine', 0.12);
      case 'high': return this.sweep(200, 1200, 0.6, 'triangle', 0.08);
      case 'bad': this.sweep(180, 60, 0.5, 'sawtooth', 0.16); return;
      case 'alarm': this.blip(980, 0.12, 'square', 0.14); setTimeout(() => this.blip(760, 0.12, 'square', 0.13), 150); return;
      case 'sting': this.sweep(1200, 90, 0.7, 'sawtooth', 0.14); return;
      case 'phone': this.blip(1320, 0.05, 'square', 0.09); return;
      // eating: a crunchy bite then two softer chews; a drink is a low gulp; a drag is breath
      case 'munch': this.noise(0.06, 0.11, 1900); setTimeout(() => this.noise(0.05, 0.07, 1300), 120); setTimeout(() => this.noise(0.05, 0.06, 1100), 250); return;
      case 'gulp': this.sweep(240, 120, 0.16, 'sine', 0.14); setTimeout(() => this.sweep(220, 110, 0.14, 'sine', 0.11), 260); return;
      case 'puff': return this.noise(0.5, 0.05, 700);
      // a car horn: two flat, slightly sour tones on top of each other
      case 'honk': this.blip(392, 0.32, 'square', 0.1); this.blip(466, 0.32, 'square', 0.08); return;
      // a dog's yelp: two high, short cries
      // a rifle: a crack and the echo off the buildings
      case 'gunshot': this.noise(0.12, 0.3, 900); setTimeout(() => this.noise(0.3, 0.1, 400), 90); return;
      // an open hand, very hard
      case 'smack': this.noise(0.06, 0.32, 3200); this.sweep(220, 70, 0.18, 'square', 0.14); return;
      case 'yelp': this.sweep(900, 1500, 0.09, 'square', 0.12); setTimeout(() => this.sweep(1300, 700, 0.14, 'square', 0.1), 110); return;
      // an angry cat: up, wavering, down
      case 'yowl': this.sweep(420, 1100, 0.25, 'sawtooth', 0.12); setTimeout(() => this.sweep(1100, 380, 0.35, 'sawtooth', 0.11), 250); return;
      // metal: a hard hit with a ring after it
      case 'clang': this.noise(0.05, 0.16, 2400); this.blip(880, 0.3, 'square', 0.07); this.blip(1320, 0.22, 'triangle', 0.05); return;
      case 'honk2': this.blip(392, 0.12, 'square', 0.1); setTimeout(() => { this.blip(392, 0.14, 'square', 0.1); this.blip(466, 0.14, 'square', 0.08); }, 170); return;
      default: return this.blip(600, 0.04);
    }
  }
}
