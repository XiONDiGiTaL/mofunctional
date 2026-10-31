/**
 * MO: FUNCTIONAL — entry point and game orchestrator.
 * Boots the 3D world, the HUD, the phone, saves, and the main loop.
 */
import { CONFIG } from './core/config.js';
import { Audio } from './core/audio.js';
import { createState, clock, logLine, bump, spend, earn, pushMessage } from './core/state.js';
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
import { Threads } from './ui/threads.js';
import { ENDINGS } from './systems/endings.js';
import { InputSystem } from './core/input.js';
import { Soundtrack } from './systems/soundtrack.js';
import { tickDealer, completeOrder, cancelOrder, activeOrder } from './systems/dealer.js';
import { toggleMap } from './ui/map.js';
import * as life from './systems/life.js';

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
    this.soundtrack = new Soundtrack(this);
    this.input = new InputSystem(this);
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
    this.threads = new Threads(this.uiEl, this);
    this.menu = new Menu(this.uiEl, this);

    this.world.showMenu();
    this.menu.show();
    this.applyPresentation();

    this.bus.on('log', ({ text }) => this.hud.pushLog(`D${dayOf(this.state.clock.m)} · ${text}`));
    // every incoming message also surfaces as a HUD thread, with the sender's face on it
    this.bus.on('message', ({ from, body }) => {
      if (this.mode === 'play') this.threads.push(from, body);
    });

    this.lastT = performance.now();
    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
    console.info('[MO: FUNCTIONAL] booted', CONFIG.meta.version);
  }

  get phoneOpen() { return this.phone.isOpen; }
  // the shop board and the fridge door are modal too, they just are not the Modal
  get modalOpen() { return this.modal.isOpen || !!this.overlayOpen; }

  /* ------------------------------ boot / audio ------------------------------ */

  async beginAudio() {
    await this.audio.init();
    this.audio.setVolume(this.state.settings.volume);
    // the director picks the score from here on (menu now, then one track per place)
    this.soundtrack.update(0, true);
  }

  /** One-shot actions queued by the keyboard or a gamepad button, drained once per frame. */
  handleInputEvents() {
    const inp = this.input;
    if (inp.take('phone')) { this.togglePhone(); }
    // the map is its own overlay; it closes itself on M or ESC
    if (inp.take('map') && this.mode === 'play' && !this.phoneOpen && !this.modal.isOpen) this.toggleMap();
    if (inp.take('pause')) {
      if (this.phone.isOpen) this.phone.close();
      else if (this.modal.isOpen) this.modal.close();
      else if (this.mode === 'play') this.togglePause();
    }
    if (this.mode !== 'play' || this.phoneOpen || this.modalOpen) return;
    if (inp.take('interact')) this.world.tryInteract(this);
    if (inp.take('crt')) this.toggleCRT();
    if (inp.take('ratio')) this.toggle43();
    if (inp.take('speed1')) this.setSpeed(1);
    if (inp.take('speed2')) this.setSpeed(2);
    if (inp.take('speed3')) this.setSpeed(3);
  }

  /* ------------------------------ main loop ------------------------------ */

  loop(t) {
    const dt = Math.min(0.05, Math.max(0, (t - this.lastT) / 1000));
    this.lastT = t;

    this.input.poll(dt);
    this.handleInputEvents();

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
      tickDealer(this);
      this.world.update(dt, this);
      this.hud.update();
    } else if (this.mode === 'menu') {
      this.world.update(dt, this);
      this.menu.update(dt);
    } else if (this.mode === 'ending') {
      this.world.update(dt, this);
    }

    this.soundtrack.update(dt);
    this.world.render();
    requestAnimationFrame(this.loop);
  }

  /* ------------------------------ state / flow ------------------------------ */

  startNew() {
    this.state = createState();
    this.applyPresentation();
    this.mode = 'play';
    this.paused = true;
    this.modal.reset?.() ?? this.modal.close();
    this.phone.close();
    this.menu.hide();
    this.hud.feed?.clear();
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
    this.modal.reset?.() ?? this.modal.close();
    this.phone.close();
    this.menu.hide();
    this.hud.feed?.clear();
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
    this.modal.reset?.() ?? this.modal.close();
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
    this.input.clear();
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
      this.input.clear();
      this.world.haltMo?.();
    }
    this.hud.update();
  }

  onModalOpenChange(open) {
    if (open) { this.input.clear(); this.world.haltMo?.(); }
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
    if (area === 'bodega') this.toast('Kestrel Bodega. It smells like a grill and lottery tickets.', 'info');
    if (area === 'habibs') this.toast("Habib's Corner. Warm, clean, and he is already asking if you ate.", 'info');
  }

  /* ------------------------------ helpers used by systems ------------------------------ */

  toast(text, kind = 'info') {
    this.hud.toast(text, kind);
  }

  /** A line of dialogue from a character, posted into the HUD thread with their face on it. */
  broadcast({ from, text }) {
    if (this.mode === 'play') this.threads.push(from, text);
  }

  openModal(opts) {
    // sms: true renders the same choice list as a phone thread instead of a panel
    if (opts.sms) {
      this.threads.ask({ from: opts.from || 'KEV', text: opts.body || '', choices: opts.choices || [], subtitle: opts.subtitle });
      return;
    }
    this.modal.open(opts);
  }

  /** Store Mo's side of a thread so it is still there when he opens Messages. */
  recordReply(from, text, subject = null) {
    const s = this.state;
    const key = String(from).toUpperCase();
    const last = s.messages.find((m) => String(m.from).toUpperCase() === key || m.subject === subject);
    if (last) {
      last.replies = last.replies || [];
      last.replies.push({ text, day: dayOf(s.clock.m) });
    } else {
      pushMessage(this, { from: key, subject: 'Sent', body: text });
      const m = s.messages[0];
      m.read = true;
      m.outgoing = true;
    }
  }

  toggleMap() { toggleMap(this); }

  /** Rolo's thread or app is on screen: keep it current as the order moves. */
  onDealerChange() {
    if (this.phone?.isOpen && (this.phone.app === 'dealer' || this.phone.app === 'rolo')) this.phone.render();
  }

  /** Mo walks up to Rolo on the street: the exchange itself. */
  dealerHandoff() {
    const o = activeOrder(this.state);
    if (!o || o.status !== 'waiting') return;
    const short = this.state.money < o.total;
    this.openModal({
      kicker: `ROLO · ORDER ${o.id}`,
      title: 'The Handoff',
      body: `He does not take his hands out of the hoodie until you are close.\n\n"${o.qty}x ${o.name}. $${o.total.toFixed(2)}. Cash."\n\nYou have $${this.state.money.toFixed(2)}.${short ? ' It is not enough, and he can count.' : ''}\n\nA fictional substance that exists only in this game. Using it raises dependence and risk.`,
      choices: [
        {
          label: `Hand him $${o.total.toFixed(2)}.`, sub: `${o.qty}x ${o.name} into your pocket`, disabled: short,
          effect: () => {
            const res = completeOrder(this);
            if (res.ok) {
              this.world.playHandoff?.();
              this.toast(`${o.qty}x ${o.name}. It goes in your pocket like it was always there.`, 'event');
            }
          },
        },
        { label: 'Back out.', sub: 'cancel the order · nothing is charged', effect: () => cancelOrder(this, 'Mo backed out at the meet') },
        { label: 'Not yet.', sub: 'he waits until the order expires', effect: () => {} },
      ],
    });
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
    ];
    // the trajectory: the same overlapping pressures every night, so the player can see the slope
    const L = life.lifeState?.(s);
    if (L) {
      const tr = life.trajectory(s);
      const index = L.index ?? life.lifeIndex(this);
      const rent = billInfo(this, 'rent');
      rows.unshift(['Trajectory', `<span class="traj traj--${tr.label.toLowerCase().replace(/[^a-z]/g, '')}">${tr.arrow} ${tr.label}</span> · life ${index}/100${tr.delta ? ` (${tr.delta > 0 ? '+' : ''}${tr.delta})` : ''}`]);
      rows.push(['Housing', L.housing === 'housed' ? (rent.owedCycles ? `Unit 3B · rent ${rent.owedCycles} cycle${rent.owedCycles > 1 ? 's' : ''} behind${s.flags.evictionNotice ? ' · NOTICE ON THE DOOR' : ''}` : `Unit 3B · next rent Day ${rent.nextDueDay} (${money(rent.base)})`) : `none · back in for ${money(life.rehouseCost(s))}`]);
      rows.push(['Days clean', `${life.daysClean(s)}`]);
      if (life.totalDebt(s) > 0) rows.push(['Debt', `${money(life.totalDebt(s))} (+1%/day)`]);
      if (L.rockBottom) rows.push(['Rock bottom', 'yes. people have noticed.']);
      const today = Object.entries(L.milestones).filter(([, d]) => d === now).map(([id]) => id);
      if (today.length) rows.push(['Milestones', today.length === 1 ? 'one today' : `${today.length} today`]);
    }
    this.modal.open({
      kicker: `DAY ${prev.day} CLOSED · ${hhmm(s.clock.m)}`,
      title: 'The Daily Report',
      html: `<div class="summary">${rows.map(([k, v]) => `<div class="summary__row"><span class="mono-dim">${k}</span><b>${v}</b></div>`).join('')}</div>`,
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
    this.applyTheme();
  }

  /** Themes are pure CSS variables on :root; the scale zooms the in-game UI layers. */
  applyTheme() {
    const s = this.state.settings;
    document.documentElement.dataset.theme = s.theme || 'functional';
    const scale = clamp(Number(s.scale) || 1, 0.85, 1.3);
    document.documentElement.style.setProperty('--ui-scale', String(scale));
  }

  setTheme(id) {
    this.state.settings.theme = id;
    this.applyTheme();
    this.audio.sfx?.('ui');
    this.autosave();
  }

  setScale(v) {
    this.state.settings.scale = clamp(Number(v) || 1, 0.85, 1.3);
    this.applyTheme();
    this.audio.sfx?.('ui');
    this.autosave();
  }

  /** Follow-camera rig, set from the phone's System app. Values are multipliers on the arm. */
  setCamera(key, value) {
    const s = this.state.settings;
    if (key === 'reset') { s.camDist = 1; s.camHeight = 1; return; }
    const pct = clamp(Number(value) || 100, 50, 160) / 100;
    if (key === 'dist') s.camDist = clamp(pct, 0.7, 1.4);
    if (key === 'height') s.camHeight = clamp(pct, 0.8, 1.35);
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
