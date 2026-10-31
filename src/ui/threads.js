/**
 * Text threads: the HUD version of a conversation.
 *
 * Incoming messages slide into the corner as a phone thread with the sender's face on their
 * bubbles and Mo's face on his replies. When a message carries choices, the thread stays open
 * until Mo answers, and the answer is posted into the thread as a sent bubble — the same reply
 * that then lands in the Messages app.
 */
import { el } from '../core/util.js';
import { portraitURL } from '../render/faces.js';
import { serviceAvatar } from './apps.js';

const NAME_TO_KIND = {
  'ADDISON OCTAVIUS': 'addison',
  'ADDISON': 'addison',
  'RAE': 'rae',
  'RAE VELL': 'rae',
  'DALE': 'dale',
  'KEV': 'kev',
  'DEX': 'dex',
  'NIA': 'nia',
  'MIGUEL': 'miguel',
  'HABIB': 'habib',
  'MOM': 'nia',
  'MO': 'mo',
  'ROLO': 'rolo',
};

// "DALE (QUIK-STOP #14)" is still Dale: the bracketed part is where he texts from, not who he is
export const kindForName = (name = '') => NAME_TO_KIND[String(name).toUpperCase().replace(/\(.*?\)/g, '').trim()] || 'kev';

export class Threads {
  constructor(root, game) {
    this.root = root;
    this.g = game;
    this.wrap = null;
    this.lines = [];
    this.pending = null;
    this.hideTimer = 0;
  }

  get isOpen() { return !!this.wrap; }

  ensure(name, subtitle = '') {
    if (this.wrap) {
      if (this.wrap.dataset.name !== name) {
        this.lines = [];
        this.wrap.querySelector('.thread__body').innerHTML = '';
      }
      this.wrap.dataset.name = name;
      this.wrap.querySelector('.thread__name').textContent = name;
      this.wrap.querySelector('.thread__sub').textContent = subtitle || 'now';
      return;
    }
    const kind = kindForName(name);
    this.wrap = el(`<div class="thread" data-name="${escapeAttr(name)}">
      <div class="thread__head">
        ${serviceAvatar(name, 'thread__face') || `<img class="thread__face" src="${portraitURL(kind, 'content')}" alt="" />`}
        <div class="thread__who"><b class="thread__name">${escapeHtml(name)}</b><span class="thread__sub">${escapeHtml(subtitle || 'now')}</span></div>
        <button class="thread__close" data-thread="close" aria-label="close">×</button>
      </div>
      <div class="thread__body"></div>
      <div class="thread__choices"></div>
    </div>`);
    this.wrap.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-thread]');
      if (btn) { this.dismiss(); return; }
      const choice = e.target.closest('[data-choice]');
      if (choice) this.choose(Number(choice.dataset.choice));
    });
    this.root.appendChild(this.wrap);
    this.lines = [];
  }

  /** A message arrives from someone. */
  push(from, text, { mood = 'content', delay = 0 } = {}) {
    this.ensure(from, 'SMS · now');
    clearTimeout(this.hideTimer);
    const post = () => {
      this.addBubble('in', text, kindForName(from), mood, from);
      this.g.audio?.sfx?.('phone');
      if (!this.pending) this.queueDismiss(9000);
    };
    if (delay) setTimeout(post, delay);
    else post();
  }

  /** Mo's side of the conversation. */
  reply(text, { echoOnly = false } = {}) {
    this.ensure(this.wrap?.dataset.name || 'KEV', 'SMS · now');
    this.addBubble('out', text, 'mo', this.g.hud?.mood?.id || 'content');
    if (!echoOnly) {
      this.body().scrollTop = this.body().scrollHeight;
      this.queueDismiss(7000);
    }
  }

  addBubble(side, text, kind, mood, from = '') {
    const body = this.body();
    const row = el(`<div class="bubble bubble--${side}">
      ${side === 'in' ? serviceAvatar(from, 'bubble__face') || `<img class="bubble__face" src="${portraitURL(kind, mood)}" alt="" />` : ''}
      <div class="bubble__text">${escapeHtml(text)}</div>
      ${side === 'out' ? `<img class="bubble__face" src="${portraitURL('mo', mood)}" alt="" />` : ''}
    </div>`);
    body.appendChild(row);
    while (body.children.length > 6) body.firstElementChild.remove();
    body.scrollTop = body.scrollHeight;
    this.lines.push({ side, text });
  }

  /** A message that needs an answer: the thread stays until one of the choices is taken. */
  ask({ from, text, choices, subtitle = '' }) {
    this.ensure(from, subtitle || 'SMS · needs a reply');
    clearTimeout(this.hideTimer);
    if (text) this.addBubble('in', text, kindForName(from), 'content', from);
    this.pending = { from, choices };
    const box = this.wrap.querySelector('.thread__choices');
    box.innerHTML = choices.map((c, i) => `<button class="thread__choice" data-choice="${i}">${escapeHtml(c.label)}</button>`).join('');
    this.wrap.classList.add('thread--active');
  }

  choose(i) {
    if (!this.pending) return;
    const choice = this.pending.choices[i];
    if (!choice) return;
    const { from } = this.pending;
    this.pending = null;
    this.wrap.querySelector('.thread__choices').innerHTML = '';
    this.wrap.classList.remove('thread--active');
    this.addBubble('out', choice.label, 'mo', this.g.hud?.mood?.id || 'content');
    this.g.audio?.sfx?.('ui');
    // keep a copy in the Messages app, exactly as the HUD showed it
    this.g.recordReply?.(from, choice.label);
    try { choice.effect?.(); } catch (e) { console.error('[thread choice]', e); }
    this.queueDismiss(6000);
  }

  queueDismiss(ms) {
    clearTimeout(this.hideTimer);
    this.hideTimer = setTimeout(() => this.dismiss(), ms);
  }

  body() {
    return this.wrap.querySelector('.thread__body');
  }

  dismiss() {
    if (!this.wrap) return;
    this.wrap.classList.add('out');
    const w = this.wrap;
    this.wrap = null;
    this.pending = null;
    setTimeout(() => w.remove(), 220);
    this.g.onThreadClose?.();
  }
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function escapeAttr(s) {
  return escapeHtml(s);
}
