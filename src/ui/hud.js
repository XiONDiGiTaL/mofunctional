/** HUD: clock, money, needs, prompt, toasts, objective, speed controls. */
import { CONFIG, DAY_NAMES } from '../core/config.js';
import { money, hhmm, dayOf, minuteOfDay, clamp } from '../core/util.js';
import { clock } from '../core/state.js';
import { billInfo } from '../systems/economy.js';
import { shiftInfo } from '../systems/jobs.js';
import { TUTORIAL_HINTS } from '../systems/dialogue.js';
import { el } from '../core/util.js';
import { portraitURL } from '../render/faces.js';
import { MessageFeed } from './feed.js';
import { renderMinimap } from './map.js';

export class HUD {
  constructor(root, game) {
    this.root = root;
    this.g = game;
    this.el = null;
    this.toastWrap = null;
    this.logEl = null;
    this.build();
  }

  build() {
    this.el = el(`<div class="hud">
      <div class="hud__top">
        <div class="hud__face" data-mood="content">
          <img class="hud__faceimg" alt="Mo" />
          <div class="hud__facemeta">
            <span class="hud__mood">CONTENT</span>
            <span class="hud__moodsub">Mo · Unit 3B</span>
            <span class="hud__moodnote"></span>
          </div>
        </div>
        <div class="hud__clockrow">
          <span class="hud__time">07:00</span>
          <span class="hud__day">MON · DAY 1</span>
          <span class="hud__money">$0.00</span>
        </div>
        <div class="hud__stats"></div>
        <button class="minimap" data-hud="map" title="Open the map (M)"></button>
      </div>
      <div class="hud__right">
        <div class="hud__btns">
          <button class="hud__btn" data-hud="map">MAP [M]</button>
          <button class="hud__btn hud__phone" data-hud="phone">PHONE [TAB]</button>
        </div>
        <div class="hud__btns">
          <button class="hud__btn" data-hud="pause">II [ESC]</button>
          <button class="hud__btn on" data-speed="1">1x</button>
          <button class="hud__btn" data-speed="2">2x</button>
          <button class="hud__btn" data-speed="3">4x</button>
          <button class="hud__btn" data-hud="crt">CRT</button>
          <button class="hud__btn" data-hud="ratio">4:3</button>
        </div>
        <div class="hud__objective"></div>
      </div>
      <div class="hud__prompt"></div>
      <div class="hud__hint">WASD move · Q/E orbit · F interact · TAB phone · M map · 1/2/3 speed · ESC pause · pad supported</div>
      <div class="hud__log"></div>
      <div class="hud__toasts"></div>
    </div>`);
    this.root.appendChild(this.el);
    this.faceEl = this.el.querySelector('.hud__face');
    this.faceImg = this.el.querySelector('.hud__faceimg');
    this.moodEl = this.el.querySelector('.hud__mood');
    this.moodNoteEl = this.el.querySelector('.hud__moodnote');
    this.mood = null;
    this.timeEl = this.el.querySelector('.hud__time');
    this.dayEl = this.el.querySelector('.hud__day');
    this.moneyEl = this.el.querySelector('.hud__money');
    this.statsEl = this.el.querySelector('.hud__stats');
    this.promptEl = this.el.querySelector('.hud__prompt');
    this.objectiveEl = this.el.querySelector('.hud__objective');
    this.logEl = this.el.querySelector('.hud__log');
    this.toastWrap = this.el.querySelector('.hud__toasts');
    this.feed = new MessageFeed(this.el, this.g);
    this.minimapEl = this.el.querySelector('.minimap');
    this.miniT = 0;

    this.el.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-hud],[data-speed]');
      if (!btn) return;
      const g = this.g;
      if (btn.dataset.speed) {
        g.setSpeed(Number(btn.dataset.speed));
        return;
      }
      switch (btn.dataset.hud) {
        case 'phone': g.togglePhone(); break;
        case 'map': g.toggleMap?.(); break;
        case 'pause': g.togglePause(); break;
        case 'crt': g.toggleCRT(); break;
        case 'ratio': g.toggle43(); break;
        default: break;
      }
    });

    this.statDefs = [
      ['energy', 'ENG'], ['hunger', 'FOOD'], ['stress', 'STRESS'],
      ['morale', 'MORALE'], ['addiction', 'DEP'], ['risk', 'RISK'],
    ];
    this.statsEl.innerHTML = this.statDefs.map(([k, label]) => `
      <div class="stat stat--${k}" data-stat="${k}">
        <span class="stat__label">${label}</span>
        <span class="stat__bar"><i class="stat__fill"></i></span>
        <span class="stat__num">0</span>
      </div>`).join('');
    this.statEls = {};
    for (const [k] of this.statDefs) {
      const node = this.statsEl.querySelector(`[data-stat="${k}"]`);
      this.statEls[k] = { fill: node.querySelector('.stat__fill'), num: node.querySelector('.stat__num'), node };
    }
    this.money = 0;
    this.logLines = [];
  }

  /**
   * Mo's face, driven by the same stats as everything else. The portrait is repainted only when
   * the mood changes, so this is cheap to call every frame.
   */
  updateFace(s) {
    const mood = moodFor(s);
    if (mood === this.mood) return;
    this.mood = mood;
    this.faceEl.dataset.mood = mood.id;
    this.faceImg.src = portraitURL('mo', mood.id);
    this.moodEl.textContent = mood.label;
    this.moodNoteEl.textContent = mood.note;
  }

  update() {
    const g = this.g;
    const s = g.state;
    if (!s) return;
    const c = clock(s);
    this.timeEl.textContent = c.hhmm;
    const weekday = DAY_NAMES[(c.day - 1) % 7].slice(0, 3).toUpperCase();
    const shift = shiftInfo(g);
    this.dayEl.textContent = `${weekday} · DAY ${c.day}${shift.today && !shift.worked ? ' · SHIFT' : ''}`;
    const rent = billInfo(g, 'rent');
    const rentWarn = rent.owedCycles > 0 ? ' debt' : '';
    this.moneyEl.textContent = money(s.money);
    this.moneyEl.className = `hud__money ${s.money < 20 ? 'bad' : ''}`;
    this.updateFace(s);

    for (const [k] of this.statDefs) {
      const v = clamp(s.stats[k] ?? 0);
      const st = this.statEls[k];
      st.fill.style.width = `${v}%`;
      st.num.textContent = Math.round(v);
      const danger = (k === 'stress' || k === 'risk' || k === 'addiction') ? v > 70 : v < 25;
      st.node.classList.toggle('flash', danger);
      const colors = { energy: '#8fd8ff', hunger: '#ffc46b', stress: '#ff8f7a', morale: '#b992ff', addiction: '#d8d8a0', risk: '#ff5e5e' };
      st.node.style.setProperty('--c', danger ? 'var(--bad)' : colors[k]);
    }

    // the minimap redraws a few times a second, not every frame
    const now = performance.now();
    if (this.minimapEl && now - this.miniT > 180) {
      this.miniT = now;
      this.minimapEl.innerHTML = renderMinimap(g);
    }

    const hint = TUTORIAL_HINTS[Math.min(5, s.flags.tutorial)] || TUTORIAL_HINTS[5];
    let extra = '';
    if (rent.owedCycles > 0) extra = `<span class="bad">Rent overdue: ${money(rent.owed)}</span>`;
    else if (rent.daysLeft <= 2) extra = `<span class="warn">Rent due in ${rent.daysLeft}d (${money(rent.base)})</span>`;
    this.objectiveEl.innerHTML = `<b>${hint.title}</b>${extra ? `${extra}<br>` : ''}${hint.text}`;

    for (const btn of this.el.querySelectorAll('[data-speed]')) {
      btn.classList.toggle('on', Number(btn.dataset.speed) === s.settings.speed);
    }
    const phoneBtn = this.el.querySelector('[data-hud="phone"]');
    phoneBtn.classList.toggle('on', g.phoneOpen);
    this.el.querySelector('[data-hud="crt"]').classList.toggle('on', s.settings.crt);
    this.el.querySelector('[data-hud="ratio"]').classList.toggle('on', s.settings.ratio43);
    this.el.querySelector('[data-hud="pause"]').classList.toggle('on', g.paused);
    this.el.querySelector('[data-hud="pause"]').textContent = g.paused ? '▶ [ESC]' : 'II [ESC]';
  }

  setPrompt(prompt) {
    if (!prompt) {
      this.promptEl.classList.remove('show');
      return;
    }
    this.promptEl.innerHTML = `<kbd>F</kbd>${escapeHtml(prompt.label)}${prompt.sub ? `<small>${escapeHtml(prompt.sub)}</small>` : ''}`;
    this.promptEl.classList.add('show');
  }

  toast(text, kind = 'info') {
    if (this.feed) { this.feed.push(text, kind); return; }
    if (!this.toastWrap) return;
    const t = el(`<div class="toast toast--${kind}">${escapeHtml(text)}</div>`);
    this.toastWrap.appendChild(t);
    while (this.toastWrap.children.length > 4) this.toastWrap.firstElementChild.remove();
    setTimeout(() => {
      t.classList.add('out');
      setTimeout(() => t.remove(), 320);
    }, 4600);
  }

  pushLog(text) {
    if (this.feed) { this.feed.system(text); return; }
    this.logLines.push(text);
    if (this.logLines.length > 5) this.logLines.shift();
    if (this.logEl) this.logEl.innerHTML = this.logLines.slice(-4).map((l) => `<div>${escapeHtml(l)}</div>`).join('');
  }

  show(visible) {
    this.el.style.display = visible ? '' : 'none';
  }
}

function moodFor(s) {
  const st = s.stats;
  if (st.risk > 72 || st.withdrawal > 62) return { id: 'sick', label: 'SICK', note: 'shaking, sweating, jaw tight' };
  if (s.high.level > 12) return { id: 'high', label: 'HIGH', note: 'eyes red, mouth doing that thing' };
  if (st.stress > 72) return { id: 'stressed', label: 'STRESSED', note: 'shoulders up around his ears' };
  if (st.morale < 25) return { id: 'angry', label: 'SEETHING', note: 'quiet in the wrong way' };
  if (st.energy < 26) return { id: 'tired', label: 'WRECKED', note: 'running on fumes and tap water' };
  return { id: 'content', label: 'CONTENT', note: 'holding, more or less' };
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
