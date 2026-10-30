/**
 * MO: FUNCTIONAL — entry point and game orchestrator.
 * Boots the 3D world, the HUD, the phone, saves, and the main loop.
 */
import { CONFIG } from './core/config.js';
import { Audio } from './core/audio.js';
import { createState, clock, logLine, bump, spend, earn } from './core/state.js';
import { saveGame, loadGame, slotInfo, autosave as doAutosave } from './core/save.js';
import { money, dayOf, clamp, hhmm, minuteOfDay } from './core/util.js';
import { simulate } from './systems/needs.js';
import { payBill as payBillFn, billInfo } from './systems/economy.js';
import { visitFellowship } from './systems/fellowship.js';
import { World } from './world/game3d.js';
import { HUD } from './ui/hud.js';
import { Modal } from './ui/modal.js';
import { Phone } from './ui/phone.js';
import { Menu } from './ui/menu.js';
import { ENDINGS } from './systems/endings.js';

class Bus {
  constructor() { this.map = new Map(); }
  on(k, cb) {
    if (!this.map.has(k)) this.map.set(k, new Set());
    this.map.get(k).add(cb);
    return () => this.map.get(k).delete(cb);
  }
  emit(k, v) {
    const set = this.map.get(k);
    if (!set) return;
    for (const cb of set) {
      try { cb(v); } catch (e) { console.error('[bus]', k, e); }
    }
  }
}

class Game {
  constructor() {
    this.bus = new Bus();
    this.audio = new Audio();
    this.input = { keys: new Set() };
    this.state = createState();
    this.mode = 'menu';
    this.paused = false;
    this.pendingMinutes = 0;
    this.saveAt = 0;

    this.stageEl = document.getElementById('stage');
    this.uiEl = document.getElementById('ui');
    this.crtEl = document.getElementById('crt');

    this.world = new World(this.stageEl);
    this.hud = new HUD(this.uiEl, this);
    this.hud.show(false);
    this.modal = new Modal(this.uiEl, this);
    this.phone = new Phone(this.uiEl, this);
    this.menu = new Menu(this.uiEl, this);

    this.world.showMenu();
    this.menu.show();
    this.applyPresentation();

    this.bus.on('log', ({ text }) => this.hud.pushLog(`D${dayOf(this.state.clock.m)} · ${text}`));
    this.bindInput();

    this.lastT = performance.now();
    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
    console.info('[MO: FUNCTIONAL] booted', CONFIG.meta.version);
  }

  get phoneOpen() { return this.phone.isOpen; }
  get modalOpen() { return this.modal.isOpen; }

  /* ------------------------------ boot / audio ------------------------------ */

  async beginAudio() {
    await this.audio.init();
    this.audio.setVolume(this.state.settings.volume);
    await this.audio.playMusic('assets/audio/menu_theme.mp3');
  }

  bindInput() {
    window.addEventListener('keydown', (e) => {
      const code = e.code;
      if (['Tab', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(code)) e.preventDefault();
      if (code === 'Tab') { this.togglePhone(); return; }
      if (code === 'Escape') {
        if (this.phone.isOpen) { this.phone.close(); return; }
        if (this.modal.isOpen) { this.modal.close(); return; }
        if (this.mode === 'play') this.togglePause();
        return;
      }
      if (this.mode === 'play' && !this.phoneOpen && !this.modalOpen) {
        if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(code)) {
          this.input.keys.add(code);
        }
        if (code === 'KeyE') { this.world.tryInteract(this); return; }
        if (code === 'KeyF') this.toggle43();
        if (code === 'KeyC') this.toggleCRT();
        if (code === 'Digit1') this.setSpeed(1);
        if (code === 'Digit2') this.setSpeed(2);
        if (code === 'Digit3') this.setSpeed(3);
      }
      if (this.mode === 'menu' && code === 'Enter') {
        const gate = document.querySelector('.screen');
        if (gate) gate.click();
      }
    });
    window.addEventListener('keyup', (e) => this.input.keys.delete(e.code));
    window.addEventListener('blur', () => this.input.keys.clear());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.input.keys.clear();
    });
  }

  /* ------------------------------ main loop ------------------------------ */

  loop(t) {
    const dt = Math.min(0.05, Math.max(0, (t - this.lastT) / 1000));
    this.lastT = t;

    if (this.mode === 'play' && !this.paused && !this.phoneOpen && !this.modalOpen) {
      const perSecond = CONFIG.time.speeds[this.state.settings.speed] ?? 0;
      this.pendingMinutes += dt * perSecond;
      if (this.pendingMinutes >= 1) {
        const step = Math.floor(this.pendingMinutes);
        this.pendingMinutes -= step;
        simulate(this, step);
      }
    }

    if (this.mode === 'play') {
      this.world.update(dt, this);
      this.hud.update();
    } else if (this.mode === 'menu') {
      this.world.update(dt, this);
      this.menu.update(dt);
    } else if (this.mode === 'ending') {
      this.world.update(dt, this);
    }

    this.world.render();
    requestAnimationFrame(this.loop);
  }

  /* ------------------------------ state / flow ------------------------------ */

  startNew() {
    this.state = createState();
    this.applyPresentation();
    this.mode = 'play';
    this.paused = true;
    this.modal.close();
    this.phone.close();
    this.menu.hide();
    this.hud.show(true);
    this.world.loadArea('apartment', this);
    this.state.flags.tutorial = 0;
    this.hud.update();
    this.menu.showIntro();
    this.audio.sfx('confirm');
  }

  beginRun() {
    this.paused = false;
    this.lastT = performance.now();
    this.toast('Open your phone with TAB. That is where your life is kept.', 'info');
    this.bus.emit('run-start');
  }

  applyState(data, fromMenu = false) {
    const fresh = createState();
    const merged = {
      ...fresh,
      ...data,
      stats: { ...fresh.stats, ...(data.stats || {}) },
      flags: { ...fresh.flags, ...(data.flags || {}) },
      settings: { ...fresh.settings, ...(data.settings || {}) },
      bills: { ...fresh.bills, ...(data.bills || {}) },
      job: { ...fresh.job, ...(data.job || {}) },
      crp: { ...fresh.crp, ...(data.crp || {}) },
      fellowship: { ...fresh.fellowship, ...(data.fellowship || {}) },
      counters: { ...fresh.counters, ...(data.counters || {}) },
      high: { ...fresh.high, ...(data.high || {}) },
    };
    this.state = merged;
    this.applyPresentation();
    this.mode = 'play';
    this.paused = false;
    this.modal.close();
    this.phone.close();
    this.menu.hide();
    this.hud.show(true);
    this.world.loadArea('apartment', this);
    this.hud.update();
    this.audio.sfx('confirm');
    if (fromMenu) this.toast(`Loaded. Day ${dayOf(this.state.clock.m)}. ${money(this.state.money)}.`, 'good');
  }

  quitToMenu() {
    this.mode = 'menu';
    this.paused = false;
    this.phone.close();
    this.modal.close();
    this.hud.show(false);
    this.world.showMenu();
    this.menu.show();
    this.menu.refresh();
  }

  finishEnding(id) {
    if (this.state.ending) return;
    const day = dayOf(this.state.clock.m);
    this.state.ending = { id, day, at: Date.now() };
    this.mode = 'ending';
    this.phone.close();
    this.modal.close();
    this.input.keys.clear();
    this.hud.show(false);
    this.audio.sfx('sting');
    this.audio.setVolume(Math.max(0, this.state.settings.volume * 0.25));
    if (id === 'overdose' || id === 'withered') this.world.startRagdoll(4200);
    const def = ENDINGS[id] || ENDINGS.functional;
    setTimeout(() => this.menu.showEnding(id, this.state), 700);
    console.info('[MO: FUNCTIONAL] ending:', id, def.title);
    this.bus.emit('ending', { id });
  }

  /* ------------------------------ time / actions ------------------------------ */

  advance(minutes, ctx = {}) {
    if (this.mode !== 'play' || this.state.ending) return;
    simulate(this, minutes, ctx);
  }

  setSpeed(n) {
    this.state.settings.speed = clamp(n, 1, 3);
    this.audio.sfx('ui');
  }

  togglePause() {
    if (this.mode !== 'play') return;
    if (this.modal.isOpen) { this.modal.close(); return; }
    this.paused = !this.paused;
    this.audio.sfx('ui');
    if (this.paused) {
      this.modal.open({
        kicker: 'PAUSED',
        title: 'Held',
        body: `Day ${dayOf(this.state.clock.m)} · ${hhmm(this.state.clock.m)} · ${money(this.state.money)}\n\nThe clock is stopped. It will start again when you close this.`,
        choices: [
          { label: 'Resume.', effect: () => { this.paused = false; } },
          { label: `Save to slot 1.`, sub: 'overwrites slot 1', effect: () => { this.saveSlot(1); this.paused = false; } },
          { label: 'How to play.', effect: () => { this.menu.showHelp(); this.paused = true; } },
          { label: 'Quit to main menu.', effect: () => { this.quitToMenu(); } },
        ],
        onClose: () => { this.paused = false; },
      });
    }
  }

  togglePhone() {
    if (this.mode !== 'play') return;
    if (this.modal.isOpen) return;
    this.phone.toggle();
  }

  openPhone(app = null) {
    if (this.mode !== 'play') return;
    this.phone.open(app);
  }

  onPhoneOpenChange(open) {
    if (open) {
      if (this.state.flags.tutorial === 0) {
        this.state.flags.tutorial = 1;
        this.bus.emit('tutorial');
      }
      this.input.keys.clear();
    }
    this.hud.update();
  }

  onModalOpenChange(open) {
    if (open) this.input.keys.clear();
    this.hud.update();
  }

  goTo(area, from = null) {
    if (this.mode !== 'play') return;
    if (this.modal.isOpen) this.modal.close();
    this.advance(3);
    if (this.state.ending) return;
    this.world.loadArea(area, this, from);
    this.hud.setPrompt(null);
    this.audio.sfx('door');
    if (area === 'street') this.toast('1120 Kestrel St. The neon is doing its best.', 'info');
    if (area === 'church') this.toast('The Fellowship. It smells expensive in here.', 'gold');
    if (area === 'apartment') this.toast('Unit 3B. Home, in the legal sense.', 'info');
  }

  /* ------------------------------ helpers used by systems ------------------------------ */

  toast(text, kind = 'info') {
    this.hud.toast(text, kind);
  }

  openModal(opts) {
    this.modal.open(opts);
  }

  spendMoney(amount, label) {
    const ok = spend(this, amount, label);
    if (!ok) this.toast('Not enough money.', 'bad');
    return ok;
  }

  earnMoney(amount, label) {
    earn(this, amount, label);
    return true;
  }

  payBill(key) {
    return payBillFn(this, key);
  }

  visitFellowship() {
    return visitFellowship(this);
  }

  onDaySummary() {
    const s = this.state;
    const prev = s.dayStart || { money: s.money, stats: s.stats, day: dayOf(s.clock.m) };
    const now = dayOf(s.clock.m);
    const pct = (a) => `${Math.round(a)}%`;
    const d = (k) => {
      const delta = Math.round(s.stats[k] - (prev.stats?.[k] ?? s.stats[k]));
      const sign = delta > 0 ? '+' : '';
      return `${sign}${delta}`;
    };
    const spentDay = Math.round((prev.money - s.money) * 100) / 100;
    const rows = [
      ['Day', `${prev.day} → ${now}`],
      ['Money', `${money(prev.money)} → ${money(s.money)} (${spentDay >= 0 ? '-' : '+'}${money(Math.abs(spentDay))})`],
      ['Energy', `${pct(prev.stats?.energy ?? s.stats.energy)} → ${pct(s.stats.energy)} (${d('energy')})`],
      ['Hunger', `${pct(prev.stats?.hunger ?? s.stats.hunger)} → ${pct(s.stats.hunger)} (${d('hunger')})`],
      ['Stress', `${pct(prev.stats?.stress ?? s.stats.stress)} → ${pct(s.stats.stress)} (${d('stress')})`],
      ['Dependence', `${pct(prev.stats?.addiction ?? s.stats.addiction)} → ${pct(s.stats.addiction)}`],
      ['Risk', `${pct(prev.stats?.risk ?? s.stats.risk)} → ${pct(s.stats.risk)}`],
      ['Shifts', `${s.counters.shifts}`,],
      ['Next rent', `Day ${billInfo(this, 'rent').nextDueDay} · ${money(billInfo(this, 'rent').base)}`],
    ];
    this.modal.open({
      kicker: `DAY ${prev.day} CLOSED · ${hhmm(s.clock.m)}`,
      title: 'The Daily Report',
      body: `<div>${rows.map(([k, v]) => `<div class="summary__row"><span class="mono-dim">${k}</span><b>${v}</b></div>`).join('')}</div>`,
      choices: [{ label: 'Start the next day.', effect: () => {} }],
    });
    s.dayStart = { money: s.money, stats: { ...s.stats }, day: now };
    if (s.flags.cat) {
      this.advance(5);
    }
  }

  /* ------------------------------ saves / presentation ------------------------------ */

  saveSlot(n) {
    const ok = saveGame(n, this.state);
    this.toast(ok ? `Saved to slot ${n}.` : 'Save failed (storage blocked).', ok ? 'good' : 'bad');
    this.audio.sfx(ok ? 'confirm' : 'deny');
  }

  loadSlot(slot) {
    const data = loadGame(slot);
    if (!data) { this.toast('That slot is empty.', 'bad'); return; }
    this.applyState(data, true);
  }

  slotInfo(n) { return slotInfo(n); }

  autosave() {
    if (this.mode !== 'play') return;
    doAutosave(this.state);
  }

  applyPresentation() {
    const s = this.state.settings;
    this.crtEl.classList.toggle('hidden', !s.crt);
    document.getElementById('app').classList.toggle('ratio43', !!s.ratio43);
    this.audio.setVolume(s.muted ? 0 : s.volume);
  }

  toggleCRT() {
    this.state.settings.crt = !this.state.settings.crt;
    this.crtEl.classList.toggle('hidden', !this.state.settings.crt);
    this.audio.sfx('ui');
  }

  toggle43() {
    this.state.settings.ratio43 = !this.state.settings.ratio43;
    document.getElementById('app').classList.toggle('ratio43', this.state.settings.ratio43);
    this.world.resize();
    this.audio.sfx('ui');
  }
}

function boot() {
  if (window.MOF) return; // guard against double boot (module can run pre- or post-DOMContentLoaded)
  window.MOF = new Game();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
