/** Choice modal used by events, shops and dialogue. */
import { el } from '../core/util.js';

export class Modal {
  constructor(root, game) {
    this.root = root;
    this.g = game;
    this.wrap = null;
    this.queue = [];
  }

  get isOpen() { return !!this.wrap; }

  /** `html` is for bodies the game builds itself (the daily report table); text is escaped. */
  /**
   * One dialog at a time, and none lost: opening while another is up queues the new one behind
   * it. (Before, the second simply replaced the first, so a random event could wipe the eviction
   * notice or the hospital off the screen before anyone read it.) A dialog opened from inside a
   * choice still appears at once, because the choice closes its own dialog first.
   */
  open(opts) {
    if (this.wrap) { this.queue.push(opts); return; }
    this.show(opts);
  }

  show({ kicker = '', title = '', body = '', html = '', choices = [], onClose = null }) {
    const wrap = el(`<div class="modal-wrap">
      <div class="panel modal">
        ${kicker ? `<div class="modal__kicker">${esc(kicker)}</div>` : ''}
        <h2 class="modal__title">${esc(title)}</h2>
        <div class="modal__body">${html || format(body)}</div>
        <div class="modal__choices"></div>
      </div>
    </div>`);
    const choicesEl = wrap.querySelector('.modal__choices');
    const opts = choices.length ? choices : [{ label: 'Close.' }];
    opts.forEach((c, i) => {
      const b = document.createElement('button');
      b.className = 'choice';
      b.innerHTML = `${esc(c.label)}${c.sub ? `<small>${esc(c.sub)}</small>` : ''}`;
      b.disabled = !!c.disabled;
      b.addEventListener('click', () => {
        if (b.disabled) return;
        this.close();
        try { c.effect?.(); } catch (e) { console.error('[modal choice]', e); }
        onClose?.();
      });
      choicesEl.appendChild(b);
    });
    this.root.appendChild(wrap);
    this.wrap = wrap;
    this.g.audio?.sfx?.('ui');
    this.g.onModalOpenChange?.(true);
  }

  close() {
    if (this.wrap) {
      this.wrap.remove();
      this.wrap = null;
      this.g.onModalOpenChange?.(false);
      // the next queued dialog waits for the current choice's effect to run first
      if (this.queue.length) setTimeout(() => { if (!this.wrap && this.queue.length) this.show(this.queue.shift()); }, 0);
    }
  }

  /** Drop everything, queued included (a new run, the main menu). */
  reset() {
    this.queue.length = 0;
    this.close();
  }
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function format(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"(.*?)"/g, '<em>"$1"</em>')
    .replace(/\n/g, '<br>');
}
