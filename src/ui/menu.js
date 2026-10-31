/** Main menu (audio-reactive), settings, saves, intro and ending screens. */
import { CONFIG, DAY_NAMES } from '../core/config.js';
import { money, dayOf, el, esc } from '../core/util.js';
import { loadGame, allSlots } from '../core/save.js';
import { INTRO_TEXT, HELP_TEXT } from '../systems/dialogue.js';
import { ENDINGS } from '../systems/endings.js';
import { THEMES, SCALES } from './themes.js';

const TICKER = [
  'you don\'t have to get your life together. you just have to keep it together.',
  'now hiring: night stock. ask for dale. do not ask about the freezer.',
  'the golden fellowship invites you to coffee. the coffee is free. so is the first conversation.',
  'bidbay: sell what you can carry. keep what you cannot.',
  'municipal power reminds you that darkness is a billing state.',
  'chairman is not lost. chairman has chosen your hallway.',
  'this broadcast is brought to you by the civic relief program. provisions may vary.',
];

export class Menu {
  constructor(root, game) {
    this.root = root;
    this.g = game;
    this.el = null;
    this.overlays = [];
    this.tickerIndex = 0;
    this.tickerTimer = 0;
    this.bars = [];
    this.gate = null;
  }

  mount() {
    const menu = el(`<div class="menu">
      <div class="menu__left">
        <div class="menu__kicker">PUBLIC ACCESS · CH 03 · ${esc(CONFIG.meta.version)}</div>
        <h1 class="menu__title" data-text="MO: FUNCTIONAL">MO: <span class="glitch">FUNCTIONAL</span></h1>
        <div class="menu__tag"><em>You don't have to get your life together. You just have to keep it together.</em><br>
        A 90s-era dark comedy about rent, shifts, dependence, and the arithmetic of a Tuesday.</div>
      </div>
      <div class="menu__now">
        <div class="menu__eq"></div>
        <div>NOW PLAYING · <b>MAIN MENU THEME</b></div>
        <div>CH 03 · SIGNAL <b id="menu-signal">WEAK</b></div>
        <div id="menu-clock">DAY 1 · 07:00</div>
      </div>
      <div class="menu__list">
        <button class="menu__item" data-menu="new">NEW GAME <small>start Monday</small></button>
        <button class="menu__item" data-menu="continue">CONTINUE <small>autosave</small></button>
        <button class="menu__item" data-menu="load">LOAD GAME <small>slots</small></button>
        <button class="menu__item" data-menu="help">HOW TO PLAY <small>controls</small></button>
        <button class="menu__item" data-menu="settings">SETTINGS <small>crt · 4:3</small></button>
        <button class="menu__item" data-menu="credits">CREDITS <small>who did this</small></button>
      </div>
      <div class="menu__footer">
        FICTIONAL SUBSTANCES ONLY · NO REAL-WORLD INSTRUCTIONS · BUILT WITH THREE.JS<br>
        <span id="menu-ticker">${esc(TICKER[0])}</span>
      </div>
    </div>`);
    this.root.appendChild(menu);
    this.el = menu;
    this.eq = menu.querySelector('.menu__eq');
    for (let i = 0; i < 18; i++) {
      const bar = document.createElement('i');
      this.eq.appendChild(bar);
      this.bars.push(bar);
    }
    this.clockEl = menu.querySelector('#menu-clock');
    this.signalEl = menu.querySelector('#menu-signal');
    this.tickerEl = menu.querySelector('#menu-ticker');

    menu.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-menu]');
      if (!btn) return;
      this.g.audio.sfx('ui');
      switch (btn.dataset.menu) {
        case 'new': this.g.startNew(); break;
        case 'continue': this.continueGame(); break;
        case 'load': this.showLoad(); break;
        case 'help': this.showHelp(); break;
        case 'settings': this.showSettings(); break;
        case 'credits': this.showCredits(); break;
        default: break;
      }
    });
    this.refresh();
  }

  refresh() {
    if (!this.el) return;
    const cont = this.el.querySelector('[data-menu="continue"]');
    const auto = loadGame('auto');
    cont.disabled = !auto;
    cont.querySelector('small').textContent = auto ? `day ${dayOf(auto.clock.m)}` : 'no autosave';
  }

  show() {
    if (!this.el) this.mount();
    this.el.style.display = '';
    this.refresh();
    this.showGate();
  }

  hide() {
    if (this.el) this.el.style.display = 'none';
    this.clearOverlays();
  }

  showGate() {
    if (this.gate || this.g.audio.musicPlaying) return;
    const gate = el(`<div class="screen" style="background:rgba(3,6,4,.9)">
      <div style="text-align:center">
        <div class="menu__kicker" style="letter-spacing:.5em;color:#7e9a86">MO: FUNCTIONAL</div>
        <div style="font-size:clamp(22px,3.6vw,38px);letter-spacing:.12em;margin:14px 0 8px;color:#f0ffe8">PRESS START</div>
        <div class="tiny mono-dim">sound on · headphones recommended · fictional substances only</div>
        <div class="tiny mono-dim" style="margin-top:18px">click or press ENTER</div>
      </div>
    </div>`);
    const start = () => {
      // Never let audio hold the UI hostage: dismiss first, boot sound after.
      gate.remove();
      this.gate = null;
      window.removeEventListener('keydown', keyStart);
      Promise.resolve()
        .then(() => this.g.beginAudio())
        .catch((e) => console.warn('[menu] audio unavailable, continuing silently', e));
    };
    const keyStart = (e) => { if (e.code === 'Enter' || e.code === 'Space') { e.preventDefault(); start(); } };
    gate.addEventListener('click', start);
    window.addEventListener('keydown', keyStart);
    this.root.appendChild(gate);
    this.gate = gate;
  }

  update(dt) {
    if (!this.el || this.el.style.display === 'none') return;
    const bands = this.g.audio.bands(18);
    for (let i = 0; i < this.bars.length; i++) {
      const v = bands[i] ?? 0;
      this.bars[i].style.height = `${3 + v * 17}px`;
      this.bars[i].style.opacity = 0.28 + v * 0.7;
    }
    this.tickerTimer += dt;
    if (this.tickerTimer > 5.5) {
      this.tickerTimer = 0;
      this.tickerIndex = (this.tickerIndex + 1) % TICKER.length;
      if (this.tickerEl) this.tickerEl.textContent = TICKER[this.tickerIndex];
    }
    const auto = loadGame('auto');
    if (this.clockEl && auto) this.clockEl.textContent = `LAST RUN · DAY ${dayOf(auto.clock.m)} · ${money(auto.money)}`;
    if (this.signalEl) this.signalEl.textContent = this.g.audio.musicPlaying ? 'GOOD' : 'WEAK';
    const level = this.g.audio.level();
    this.el.style.setProperty('--level', level.toFixed(3));
  }

  continueGame() {
    const auto = loadGame('auto');
    if (!auto) { this.g.toast('No autosave. Start a new run.', 'bad'); return; }
    this.g.applyState(auto, true);
  }

  showLoad() {
    const slots = allSlots();
    const auto = loadGame('auto');
    const body = `
      ${auto ? `<div class="row row--between" style="padding:6px 0;border-bottom:1px dotted #223428">
        <span>Autosave <span class="tiny mono-dim">Day ${dayOf(auto.clock.m)} · ${money(auto.money)}</span></span>
        <button class="btn btn--sm btn--primary" data-slot="auto">LOAD</button>
      </div>` : ''}
      ${slots.map((s, i) => `<div class="row row--between" style="padding:6px 0;border-bottom:1px dotted #223428">
        <span>Slot ${i + 1} ${s ? `<span class="tiny mono-dim">Day ${s.day} · ${money(s.money)}</span>` : '<span class="tiny mono-dim">empty</span>'}</span>
        <button class="btn btn--sm" data-slot="${i + 1}" ${s ? '' : 'disabled'}>LOAD</button>
      </div>`).join('')}`;
    const overlay = el(`<div class="screen">
      <div class="panel" style="width:min(480px,92vw)">
        <div class="modal__kicker">SAVE SLOTS</div>
        <h2 class="modal__title">Load Game</h2>
        <div style="margin:10px 0">${body}</div>
        <button class="btn" data-close>BACK</button>
      </div>
    </div>`);
    overlay.addEventListener('click', (e) => {
      if (e.target.closest('[data-close]')) { overlay.remove(); return; }
      const b = e.target.closest('[data-slot]');
      if (!b) return;
      const slot = b.dataset.slot === 'auto' ? 'auto' : Number(b.dataset.slot);
      this.g.loadSlot(slot);
    });
    this.pushOverlay(overlay);
  }

  showHelp() {
    const overlay = el(`<div class="screen">
      <div class="panel" style="width:min(620px,94vw);max-height:88vh;overflow:auto">
        <div class="modal__kicker">HOW TO PLAY</div>
        <h2 class="modal__title">Keeping It Together</h2>
        <pre style="white-space:pre-wrap;font-size:12px;line-height:1.65;color:#bcd4c1;margin:0 0 14px">${esc(HELP_TEXT)}</pre>
        <button class="btn" data-close>BACK</button>
      </div>
    </div>`);
    overlay.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) overlay.remove(); });
    this.pushOverlay(overlay);
  }

  showSettings() {
    const s = this.g.state;
    const overlay = el(`<div class="screen">
      <div class="panel" style="width:min(460px,92vw)">
        <div class="modal__kicker">SETTINGS</div>
        <h2 class="modal__title">Presentation</h2>
        <div class="row row--between" style="padding:8px 0">
          <span>CRT scanlines</span><button class="btn btn--sm ${s.settings.crt ? 'btn--primary' : ''}" data-set="crt">${s.settings.crt ? 'ON' : 'OFF'}</button>
        </div>
        <div class="row row--between" style="padding:8px 0">
          <span>4:3 aspect</span><button class="btn btn--sm ${s.settings.ratio43 ? 'btn--primary' : ''}" data-set="ratio">${s.settings.ratio43 ? 'ON' : 'OFF'}</button>
        </div>
        <div class="row row--between" style="padding:8px 0">
          <span>Music volume</span><input type="range" min="0" max="100" value="${Math.round(s.settings.volume * 100)}" data-set="vol" />
        </div>
        <div class="row row--between" style="padding:8px 0">
          <span>Default speed</span>
          <span class="row">
            ${[1, 2, 3].map((n) => `<button class="btn btn--sm ${s.settings.speed === n ? 'btn--primary' : ''}" data-set="speed" data-arg="${n}">${n === 1 ? '1x' : n === 2 ? '2x' : '4x'}</button>`).join('')}
          </span>
        </div>
        <div class="hr"></div>
        <div class="app__h">Theme</div>
        <div class="theme-grid">
          ${THEMES.map((t) => `<button class="theme-swatch ${(s.settings.theme || 'functional') === t.id ? 'on' : ''}" data-set="theme" data-arg="${t.id}">
            <i style="background:${t.dot}"></i>
            <span><b>${t.label}</b><em>${t.note}</em></span>
          </button>`).join('')}
        </div>
        <div class="app__h">Interface scale</div>
        <div class="row">
          ${SCALES.map((sc) => `<button class="btn btn--sm ${Math.abs((s.settings.scale ?? 1) - sc.value) < 0.01 ? 'btn--primary' : ''}" data-set="scale" data-arg="${sc.value}">${sc.label}</button>`).join('')}
        </div>
        <div class="hr"></div>
        <div class="tiny mono-dim">Pixel height ${CONFIG.render.internalHeight}p · fog ${CONFIG.render.fogNear}–${CONFIG.render.fogFar} · affine mapping on</div>
        <button class="btn" data-close style="margin-top:12px">BACK</button>
      </div>
    </div>`);
    overlay.addEventListener('click', (e) => {
      const closeBtn = e.target.closest('[data-close]');
      if (closeBtn) { overlay.remove(); return; }
      const btn = e.target.closest('[data-set]');
      if (!btn) return;
      const key = btn.dataset.set;
      if (key === 'crt') { this.g.toggleCRT(); }
      if (key === 'ratio') { this.g.toggle43(); }
      if (key === 'speed') { this.g.state.settings.speed = Number(btn.dataset.arg); }
      if (key === 'theme') { this.g.setTheme?.(btn.dataset.arg); }
      if (key === 'scale') { this.g.setScale?.(Number(btn.dataset.arg)); }
      this.g.audio.sfx('ui');
      overlay.remove();
      this.showSettings();
    });
    overlay.addEventListener('input', (e) => {
      if (e.target.dataset.set === 'vol') {
        this.g.state.settings.volume = Number(e.target.value) / 100;
        this.g.audio.setVolume(this.g.state.settings.volume);
      }
    });
    this.pushOverlay(overlay);
  }

  showCredits() {
    const overlay = el(`<div class="screen">
      <div class="panel" style="width:min(560px,92vw);max-height:88vh;overflow:auto">
        <div class="modal__kicker">CREDITS</div>
        <h2 class="modal__title">MO: FUNCTIONAL</h2>
        <div style="font-size:12px;line-height:1.8;color:#bcd4c1">
          <p><b>Design, code, world, writing</b><br>Built in the Freebuff coding agent for XiØN.</p>
          <p><b>Engine</b><br>Three.js r169, hand-written 90s-era shader pass (affine UVs, vertex snapping, ordered dither, fog), procedural canvas textures, procedural audio.</p>
          <p><b>Music</b><br>"Mo Functional — Main Menu" supplied with the project, used as the menu theme.</p>
          <p><b>Character reference</b><br>Mo's face is reconstructed from the supplied reference image as a low-poly approximation. Addison Octavius is an original fictional character inspired by a wardrobe reference — no real person, organisation or affiliation.</p>
          <p><b>Content note</b><br>Addiction, poverty and housing insecurity are depicted as mechanical systems, in a dark comedy register. All substances are fictional. There are no instructions for anything.</p>
          <p><b>Home</b><br><a href="https://xiondigital.net" target="_blank" rel="noopener">xiondigital.net</a> &middot; <a href="https://xiondigital.net/arcade/" target="_blank" rel="noopener">the arcade</a></p>
          <p class="tiny mono-dim">${esc(CONFIG.meta.repo)}</p>
        </div>
        <button class="btn" data-close>BACK</button>
      </div>
    </div>`);
    overlay.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) overlay.remove(); });
    this.pushOverlay(overlay);
  }

  showIntro() {
    const overlay = el(`<div class="screen">
      <div class="panel intro">
        <div class="modal__kicker">MONDAY · 07:00 · UNIT 3B</div>
        <div class="big">You are Mo. The week has already started without asking.</div>
        ${INTRO_TEXT.map((p) => `<p>${esc(p)}</p>`).join('')}
        <div class="hr"></div>
        <div class="tiny mono-dim" style="line-height:1.7">
          WASD MOVE · E INTERACT · TAB PHONE · 1/2/3 SPEED · ESC PAUSE<br>
          Every action costs time. Time is the only resource that does not care how you feel.
        </div>
        <button class="btn btn--primary" data-begin style="margin-top:14px">BEGIN MONDAY →</button>
      </div>
    </div>`);
    overlay.querySelector('[data-begin]').addEventListener('click', () => {
      overlay.remove();
      this.g.beginRun();
    });
    this.pushOverlay(overlay);
  }

  showEnding(id, state) {
    const def = ENDINGS[id] || ENDINGS.functional;
    const stats = def.stats ? def.stats(state) : [];
    const overlay = el(`<div class="screen" style="background:rgba(3,5,4,.93)">
      <div class="panel ending ending--${def.tone || 'bad'}">
        <div class="ending__kicker">${esc(def.kicker)}</div>
        <h1 class="ending__title">${esc(def.title)}</h1>
        <div class="ending__body">${esc(def.body(state))}</div>
        <div class="ending__stats">
          ${stats.map(([k, v]) => `<div><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join('')}
        </div>
        <div class="row row--wrap">
          <button class="btn btn--primary" data-end="new">NEW RUN</button>
          <button class="btn" data-end="menu">MAIN MENU</button>
        </div>
      </div>
    </div>`);
    overlay.addEventListener('click', (e) => {
      const b = e.target.closest('[data-end]');
      if (!b) return;
      if (b.dataset.end === 'new') { this.clearOverlays(); this.g.startNew(); }
      if (b.dataset.end === 'menu') { this.clearOverlays(); this.g.quitToMenu(); }
    });
    this.pushOverlay(overlay);
  }

  pushOverlay(overlay) {
    this.root.appendChild(overlay);
    this.overlays.push(overlay);
  }

  clearOverlays() {
    for (const o of this.overlays) o.remove();
    this.overlays = [];
  }
}
