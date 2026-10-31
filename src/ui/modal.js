/** Choice modal used by events, shops and dialogue. */
import { el } from '../core/util.js';

export class Modal {
  constructor(root, game) {
    this.root = root;
    this.g = game;
    this.wrap = null;
  }

  get isOpen() { return !!this.wrap; }

  /** `html` is for bodies the game builds itself (the daily report table); text is escaped. */
  open({ kicker = '', title = '', body = '', html = '', choices = [], onClose = null }) {
    this.close();
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
    }
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
