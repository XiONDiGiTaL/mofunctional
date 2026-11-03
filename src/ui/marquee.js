/**
 * The marquee: while something is happening on the block (systems/happenings.js), a strip runs
 * across the top of the screen saying what, until when, and what it means. It reads the state
 * once a second; it never decides anything.
 */
import { marqueeLine } from '../systems/happenings.js';

export function startMarquee(g) {
  const el = document.createElement('div');
  el.className = 'marquee';
  el.hidden = true;
  el.innerHTML = '<div class="marquee__track"><span></span><span aria-hidden="true"></span></div>';
  document.body.appendChild(el);
  let last = null;
  setInterval(() => {
    const s = g.state;
    const line = s && g.mode === 'play' ? marqueeLine(s) : null;
    if (line === last) return;
    last = line;
    el.hidden = !line;
    if (line) el.querySelectorAll('span').forEach((sp) => { sp.textContent = `${line}     ·     `; });
  }, 1000);
  return el;
}
