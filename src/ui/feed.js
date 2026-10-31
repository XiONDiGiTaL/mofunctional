/**
 * The message feed: every toast and log line arrives as a text bubble in the corner of the
 * screen. Bubbles pop in, hang around long enough to read, and fade out of the way, but none
 * of them are thrown away — hover the feed (or click its handle to pin it) and the whole day
 * scrolls back up as a conversation you can read again.
 */
const SENDERS = {
  info: { who: 'The Day', mark: '☼' },
  good: { who: 'Small Win', mark: '✓' },
  bad: { who: 'Bad News', mark: '!' },
  gold: { who: 'The Fellowship', mark: '✝' },
  event: { who: 'Something Happened', mark: '✦' },
};
const KEEP = 140;
const LINGER = 6500;

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export class MessageFeed {
  constructor(root, game) {
    this.g = game;
    this.count = 0;
    this.lastWho = null;
    this.el = document.createElement('div');
    this.el.className = 'feed';
    this.el.innerHTML = `
      <div class="feed__list" role="log" aria-live="polite"></div>
      <button class="feed__handle" type="button" title="Message history (click to pin)">
        <i class="feed__dot"></i><span class="feed__label">Messages</span><b class="feed__count">0</b>
      </button>`;
    this.list = this.el.querySelector('.feed__list');
    this.countEl = this.el.querySelector('.feed__count');
    this.el.querySelector('.feed__handle').addEventListener('click', () => this.togglePinned());
    // opening the history jumps to the newest message, like any messaging app
    this.el.addEventListener('mouseenter', () => this.toBottom());
    root.appendChild(this.el);
  }

  stamp() {
    const s = this.g?.state;
    if (!s?.clock) return '';
    const m = s.clock.m;
    const day = Math.floor(m / 1440) + 1;
    const mod = ((m % 1440) + 1440) % 1440;
    return `D${day} · ${String(Math.floor(mod / 60)).padStart(2, '0')}:${String(mod % 60).padStart(2, '0')}`;
  }

  push(text, kind = 'info') {
    const from = SENDERS[kind] || SENDERS.info;
    const grouped = this.lastWho === kind; // consecutive texts from one sender share a header
    this.lastWho = kind;
    const node = document.createElement('div');
    node.className = `fb fb--${SENDERS[kind] ? kind : 'info'}${grouped ? ' fb--grouped' : ''}`;
    node.innerHTML = `
      <span class="fb__avatar">${from.mark}</span>
      <div class="fb__body">
        <div class="fb__head"><b>${esc(from.who)}</b><time>${this.stamp()}</time></div>
        <div class="fb__text">${esc(text)}</div>
      </div>`;
    this.append(node);
    setTimeout(() => node.classList.add('fb--old'), LINGER);
  }

  /** Log lines are the quiet ones: a centred timestamp row, like "Today 07:41" in a thread. */
  system(text) {
    this.lastWho = null;
    const node = document.createElement('div');
    node.className = 'fb fb--sys';
    node.innerHTML = `<span>${esc(text)}</span>`;
    this.append(node);
    setTimeout(() => node.classList.add('fb--old'), LINGER - 2000);
  }

  append(node) {
    const pinnedToBottom = this.list.scrollHeight - this.list.scrollTop - this.list.clientHeight < 40;
    this.list.appendChild(node);
    while (this.list.children.length > KEEP) this.list.firstElementChild.remove();
    this.count += 1;
    this.countEl.textContent = this.count > 99 ? '99+' : String(this.count);
    this.el.classList.remove('feed--ping');
    void this.el.offsetWidth; // restart the handle's ping animation
    this.el.classList.add('feed--ping');
    if (pinnedToBottom) this.toBottom();
  }

  toBottom() {
    const go = () => { this.list.scrollTop = this.list.scrollHeight; };
    requestAnimationFrame(go);
    // faded bubbles grow back over .6s when the history opens; land on the newest once they have
    setTimeout(go, 650);
  }

  togglePinned() {
    this.el.classList.toggle('feed--open');
    this.toBottom();
  }

  clear() {
    this.list.innerHTML = '';
    this.count = 0;
    this.lastWho = null;
    this.countEl.textContent = '0';
  }
}
