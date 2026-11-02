/**
 * MO: FUNCTIONAL — entry point and game orchestrator.
 * Boots the 3D world, the HUD, the phone, saves, and the main loop.
 */
import { shouldPop } from './ui/notify.js';
import { wouldMiss } from './ui/today.js';
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
import { Laptop } from './ui/laptop.js';
import { Menu } from './ui/menu.js';
import { Threads } from './ui/threads.js';
import { ENDINGS } from './systems/endings.js';
import { InputSystem } from './core/input.js';
import { Soundtrack } from './systems/soundtrack.js';
import { tickDealer, completeOrder, cancelOrder, activeOrder } from './systems/dealer.js';
import { toggleMap, mapTitle } from './ui/map.js';
import { showOptions } from './ui/options.js';
import { setLang, savedLang, getLang } from './i18n/i18n.js';
import * as life from './systems/life.js';
import { migrate } from './systems/migrate.js';
import * as romance from './systems/romance.js';
import * as clinic from './systems/clinic.js';
import { installDebugMenu } from './ui/debug.js';

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
    this.laptop = new Laptop(this.uiEl, this);
    this.threads = new Threads(this.uiEl, this);
    this.menu = new Menu(this.uiEl, this);

    // the collapse fade lives above everything, in the UI layer
    this.fadeEl = document.createElement('div');
    this.fadeEl.className = 'fadeout';
    this.uiEl.appendChild(this.fadeEl);
    this.debugOpen = false;
    // full-screen UI that is not the Modal (shop board, fridge, map, fight, options), by name, so
    // closing one never clears another
    this.overlays = new Set();
    // things the world wanted to show while the player was busy in a menu; they wait their turn
    this.deferred = [];
    // ~ and the password: a testing tool, hidden in plain sight
    installDebugMenu(this);
    // the language is the player's, not the save's: it is remembered across runs
    setLang(savedLang());

    this.world.showMenu();
    this.menu.show();
    this.applyPresentation();

    this.bus.on('log', ({ text }) => this.hud.pushLog(`D${dayOf(this.state.clock.m)} · ${text}`));
    // every incoming message also surfaces as a HUD thread, with the sender's face on it
    // a text only pops up over the game if the player wants that kind (Tweaks → Notifications);
    // every text is still in Txtr either way
    this.bus.on('message', ({ from, body, id }) => {
      if (this.mode !== 'play') return;
      const m = this.state.messages.find((x) => x.id === id) || { from, body, subject: '' };
      if (shouldPop(this.state, m)) this.threads.push(from, body);
    });

    this.lastT = performance.now();
    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
    console.info('[MO: FUNCTIONAL] booted', CONFIG.meta.version);
  }

  // the laptop is the phone's engine in another body: either one being open pauses the world
  get phoneOpen() { return this.phone.isOpen || !!this.laptop?.isOpen; }
  // the shop board and the fridge door are modal too, they just are not the Modal
  get modalOpen() { return this.modal.isOpen || this.overlayOpen; }
  get overlayOpen() { return this.overlays.size > 0; }
  setOverlay(name, on) { if (on) this.overlays.add(name); else this.overlays.delete(name); }
  /** Anything on screen that the world must not talk over: a menu, the phone, a dialog, pause, debug. */
  get uiBusy() { return this.mode !== 'play' || this.paused || this.debugOpen || this.phoneOpen || this.modalOpen; }

  /**
   * Background code (the world, the dealer) calls this before opening anything. While the player
   * is in a menu it keeps the opener for later and says so; the loop runs it once the screen is
   * clear. Player-initiated opens never pass through here as background.
   */
  holdForUI(fn) {
    if (!this.inBackground || !this.uiBusy) return false;
    if (this.deferred.length < 3) this.deferred.push(fn);
    return true;
  }

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
      if (this.laptop?.isOpen) this.laptop.close();
      else if (this.phone.isOpen) this.phone.close();
      else if (this.modal.isOpen) this.modal.close();
      else if (this.mode === 'play') this.togglePause();
    }
    if (this.mode !== 'play' || this.phoneOpen || this.modalOpen) return;
    if (inp.take('interact')) this.world.tryInteract(this);
    if (inp.take('cycle')) this.world.cycleTarget?.();
    if (inp.take('today')) this.hud.toggleToday?.();
    if (inp.take('camreset')) this.setCamera('reset');
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

    if (this.mode === 'play' && !this.paused && !this.debugOpen && !this.phoneOpen && !this.modalOpen) {
      const perSecond = CONFIG.time.speeds[this.state.settings.speed] ?? 0;
      this.pendingMinutes += dt * perSecond;
      if (this.pendingMinutes >= 1) {
        const step = Math.floor(this.pendingMinutes);
        this.pendingMinutes -= step;
        simulate(this, step);
      }
    }

    if (this.mode === 'play') {
      this.inBackground = true;
      try {
        tickDealer(this);
        this.world.update(dt, this);
      } finally { this.inBackground = false; }
      // one held-back event per frame, and only once nothing is on screen
      if (this.deferred.length && !this.uiBusy) this.deferred.shift()();
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
    this.state.flags.recovering = false;
    this.world.collapse?.reset?.();
    this.fadeIn();
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
    // versioned migration first (and in-flight locks cleared), then the merge over a fresh state
    data = migrate(data);
    const fresh = createState();
    this.world.collapse?.reset?.();
    this.fadeIn();
    const merged = {
      ...fresh,
      ...data,
      stats: { ...fresh.stats, ...(data.stats || {}) },
      // in-flight animation locks are not state: a save made mid-use or mid-fall must not
      // reload with Mo frozen
      flags: { ...fresh.flags, ...(data.flags || {}), consuming: false, recovering: false },
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
    // speeding up with something due within the hour: say so, once
    if (n > 1 && this.mode === 'play') {
      const soon = wouldMiss(this, 60);
      if (soon.length) this.toast(`Heads up: ${soon.join(', ')} within the hour.`, 'bad');
    }
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
          { label: 'Options.', sub: 'sound · camera · controls and key remapping', effect: () => { setTimeout(() => showOptions(this), 0); } },
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
    if (this.laptop?.isOpen) { this.laptop.close(); return; }
    this.phone.toggle();
  }

  /** Put a destination on the map (from Today, or anywhere); optionally open the map to it. */
  navigateTo(id, openMap = false) {
    this.state.nav = id;
    if (openMap && this.mode === 'play' && !this.phoneOpen && !this.modal.isOpen) this.toggleMap?.();
  }

  openLaptop(app = null) {
    if (this.mode !== 'play' || this.phone.isOpen) return;
    this.laptop.open(app);
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
    // whatever sent him here, he leaves with empty hands: a phone or a dialog left open over the
    // new area is the reason a teleport could leave him standing still and unable to move
    if (this.phone.isOpen) this.phone.close();
    this.laptop?.close?.();
    if (this.modal.isOpen) this.modal.close();
    this.world.moveTarget = null;
    this.world.vel?.set(0, 0, 0);
    this.world.walking = false;
    this.advance(3);
    if (this.state.ending) return;
    this.world.loadArea(area, this, from);
    this.hud.setPrompt(null);
    this.audio.sfx('door');
    // the "where you are" lines can be switched off (Tweaks → Notifications)
    const announce = this.state.settings.placeToasts ?? true;
    if (!announce) { /* quiet */ } else if (area === 'street') this.toast('1120 Kestrel St. The neon is doing its best.', 'info');
    if (announce && area === 'church') this.toast('The Fellowship. It smells expensive in here.', 'gold');
    if (announce && area === 'apartment') this.toast('Unit 3B. Home, in the legal sense.', 'info');
    if (announce && area === 'bodega') this.toast('Kestrel Bodega. It smells like a grill and lottery tickets.', 'info');
    if (announce && area === 'quikstop') this.toast('Quik-Stop #14. The door chime plays half a song and gives up.', 'info');
    if (announce && area === 'habibs') this.toast("Habib's Corner. Warm, clean, and he is already asking if you ate.", 'info');
    if (announce && area === 'park') this.toast('Kestrel Park. Grass, a bent rim, and somebody else\'s music.', 'info');
    if (announce && area === 'clinic') this.toast('Kestrel Clinic. It smells like clean and paperwork.', 'info');
    if (announce && this.world.area?.enterToast) this.toast(this.world.area.enterToast, 'info');
  }

  /** The one that does not end with the clinic: a gun, and the run is over. */
  deathSequence(cause = 'shot') {
    const s = this.state;
    if (this.mode !== 'play' || s.ending) return;
    this.phone.close();
    this.modal.reset?.() ?? this.modal.close();
    this.world.haltMo?.();
    this.fadeOut(() => {
      this.world.haltMo?.();
      this.openModal({
        kicker: `D${dayOf(s.clock.m)} · ${hhmm(s.clock.m)}`,
        title: cause === 'shot' ? 'The Street Keeps Its Receipts' : 'You Do Not Get Up',
        body: cause === 'shot'
          ? 'There is a sound like a door closing in another apartment, and then the pavement is very close to your face and staying there.\n\nNobody in the courtyard is surprised. That is the part that follows you: nobody is surprised.\n\nThis is where this run ends. Load the last save, or close the book and start again.'
          : 'The ground comes up and the lights go out one at a time, politely, in order.\n\nThis run is over.',
        choices: [
          { label: 'Reload the last save.', effect: () => { this.fadeIn(); this.loadSlot(this.lastSlot || 1); } },
          { label: 'Back to the menu.', effect: () => { this.fadeIn(); this.quitToMenu?.(); } },
        ],
      });
      this.fadeIn();
    }, 700);
  }

  /* ------------------------------ collapse / fade ------------------------------ */

  fadeOut(cb, ms = 420) {
    if (!this.fadeEl) { if (cb) cb(); return; }
    this.fadeEl.classList.add('on');
    setTimeout(() => { if (cb) cb(); }, ms);
  }

  fadeIn() {
    if (!this.fadeEl) return;
    this.fadeEl.classList.remove('on');
  }

  /**
   * The collapse, in order: he falls, the screen goes black, the hours go, and he wakes up at home
   * or at the clinic. `flags.recovering` plus the recovery lock in needs.collapse() keep this from
   * re-entering itself on the way out, so there is no collapse/recovery loop.
   */
  collapseSequence(cause = 'collapse') {
    const s = this.state;
    if (this.mode !== 'play' || s.ending || s.flags.recovering) return;
    s.flags.recovering = true;
    this.phone.close();
    this.modal.reset?.() ?? this.modal.close();
    this.world.haltMo?.();
    const toClinic = clinic.shouldTakeHimIn(s, cause);
    const landed = () => {
      this.fadeOut(() => {
        const lost = cause === 'overdose' ? 9 * 60 : CONFIG.clinic.collapse.hoursLost * 60;
        this.advance(lost, { sleeping: true, noCollapse: true });
        if (s.ending) { s.flags.recovering = false; this.fadeIn(); return; }
        let report;
        if (toClinic) {
          const res = clinic.recoverHere(this, { cause });
          report = {
            where: 'clinic',
            title: 'You Wake Up Somewhere Clean',
            body: `${res.nurse} is writing on a chart before she notices you are awake. The ceiling is the colour of a hospital ceiling, which is its own colour.\n\nYou lost the night. ${res.fee > 0 ? `${money(res.fee)} for the cot and the blood-pressure cuff.` : res.fee < 0 ? `${money(-res.fee)} went on the hospital bill, because you did not have it.` : 'They did not charge you. Do not get used to it.'} Somebody from the block was called and came, which you will think about later.`,
          };
        } else {
          s.stats.energy = Math.max(s.stats.energy, 34);
          s.stats.stress = clamp(s.stats.stress + 8);
          s.stats.hygiene = Math.min(s.stats.hygiene, 44);
          bump(s, 'morale', -6);
          report = {
            where: 'home',
            title: 'The Floor Was Closer Than It Looked',
            body: 'You come round on the lino beside the bed with your cheek on something that is probably a sock. The radiator has been going the whole time, which is somehow rude.\n\nThe night is gone. Your back has opinions. Nobody was called, which is either luck or the other thing.',
          };
        }
        s.high.until = s.clock.m;
        s.high.level = 0;
        s.flags.recovering = false;
        s.flags.collapse = false;
        this.goTo(report.where, null);
        this.world.freeMo?.();
        this.fadeIn();
        this.openModal({
          kicker: `D${dayOf(s.clock.m)} · ${hhmm(s.clock.m)}`,
          title: report.title,
          body: `${report.body}\n\nEnergy ${Math.round(s.stats.energy)} · stress ${Math.round(s.stats.stress)} · risk ${Math.round(s.stats.risk)}.`,
          // getting up lets go of anything the fall left holding him
          choices: [{ label: 'Get up.', effect: () => this.world.freeMo?.() }],
        });
        this.toast('You were out for hours. The clock kept going.', 'bad');
      });
    };
    this.world.playCollapse(landed);
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
    if (this.holdForUI(() => this.openModal(opts))) return;
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
    this.state.savedWhere = mapTitle(this);
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
    this.state.savedWhere = mapTitle(this);
    doAutosave(this.state);
  }

  applyPresentation() {
    const s = this.state.settings;
    this.crtEl.classList.toggle('hidden', !s.crt);
    document.getElementById('app').classList.toggle('ratio43', !!s.ratio43);
    this.audio.setVolume(s.muted ? 0 : s.volume);
    this.audio.setSfxVolume(s.muted ? 0 : (s.sfxVolume ?? CONFIG.audio.sfxVolume));
    this.applyTheme();
  }

  /* ------------------------------ audio settings ------------------------------ */

  /**
   * The two buses are independent and take effect on the gain immediately — the track that is
   * playing keeps playing, it just gets quieter. Both live in state.settings, so they travel with
   * a save slot and come back on load.
   */
  setMusicVolume(v) {
    const s = this.state.settings;
    s.volume = clamp(Number(v) || 0, 0, 1);
    if (s.muted && s.volume > 0) s.muted = false;
    this.audio.setVolume(s.muted ? 0 : s.volume);
    this.saveAudioSoon();
  }

  setSfxVolume(v) {
    const s = this.state.settings;
    s.sfxVolume = clamp(Number(v) || 0, 0, 1);
    if (s.muted && s.sfxVolume > 0) s.muted = false;
    this.audio.setSfxVolume(s.muted ? 0 : s.sfxVolume);
    this.saveAudioSoon();
  }

  setMuted(on) {
    const s = this.state.settings;
    s.muted = !!on;
    this.audio.setVolume(s.muted ? 0 : s.volume);
    this.audio.setSfxVolume(s.muted ? 0 : (s.sfxVolume ?? CONFIG.audio.sfxVolume));
    this.audio.sfx(s.muted ? 'ui-back' : 'ui');
    this.saveAudioSoon();
  }

  /** A drag is a hundred input events: write the settings once it settles. */
  saveAudioSoon() {
    clearTimeout(this.audioSaveTimer);
    this.audioSaveTimer = setTimeout(() => this.autosave(), 600);
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
  /** Switch the interface language (English, Spanish, German). */
  async setLanguage(id) {
    await setLang(id);
    this.state.settings.lang = getLang();
    this.audio?.sfx?.('ui');
  }

  setCamera(key, value) {
    const s = this.state.settings;
    // reset: default distance and height, and the camera swung back round behind Mo
    if (key === 'reset') { s.camDist = 1; s.camHeight = 1; this.world?.resetCamera?.(); return; }
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
