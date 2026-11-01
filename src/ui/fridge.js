/**
 * The fridge door: two shelves side by side, what is in the fridge and what is in Mo's pockets.
 * Food moves between them one at a time (store it for later, take it for the road) and either
 * side can be eaten from directly. Eating closes the door so you can watch him do it.
 */
import { CONFIG } from '../core/config.js';
import * as needs from '../systems/needs.js';
import { itemIcon } from './icons.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const edible = (def) => !!def && (def.kind === 'food' || def.kind === 'comfort');

let open = null;

function gains(def) {
  return [
    def.hunger ? `+${def.hunger} food` : '',
    def.energy ? `${def.energy > 0 ? '+' : ''}${def.energy} eng` : '',
    def.stress ? `${def.stress} stress` : '',
    def.morale ? `${def.morale > 0 ? '+' : ''}${def.morale} mood` : '',
  ].filter(Boolean).join(' · ');
}

function shelf(list, side) {
  const rows = list.map(({ id, qty }) => ({ id, qty, def: CONFIG.items[id] })).filter((r) => edible(r.def));
  if (!rows.length) {
    return `<div class="fridge__empty">${side === 'fridge' ? 'A jar of something and a light bulb.' : 'Nothing edible in your pockets.'}</div>`;
  }
  return rows.map(({ id, qty, def }) => `
    <div class="fridge__item">
      ${itemIcon(id, def.kind)}
      <div class="fridge__meta"><b>${esc(def.name)}${qty > 1 ? ` <em>×${qty}</em>` : ''}</b><span>${gains(def)}</span></div>
      <div class="fridge__btns">
        <button class="btn btn--sm btn--primary" data-eat="${id}" data-from="${side}">${def.kind === 'food' ? 'EAT' : id === 'loosies' ? 'SMOKE' : 'DRINK'}</button>
        <button class="btn btn--sm" data-move="${id}" data-to="${side === 'fridge' ? 'inventory' : 'fridge'}">${side === 'fridge' ? 'TAKE' : 'STORE'}</button>
        ${qty > 1 ? `<button class="btn btn--sm" data-move="${id}" data-to="${side === 'fridge' ? 'inventory' : 'fridge'}" data-all>ALL</button>` : ''}
      </div>
    </div>`).join('');
}

export function showFridge(g) {
  closeFridge(g);
  const root = document.getElementById('ui') || document.body;
  const wrap = document.createElement('div');
  wrap.className = 'fridge';
  const render = () => {
    const s = g.state;
    wrap.innerHTML = `
      <div class="fridge__door" role="dialog" aria-label="Fridge">
        <header class="fridge__head">
          <div><span class="fridge__kicker">UNIT 3B · THE FRIDGE</span><h2>Cold Storage</h2></div>
          <span class="fridge__hum">${s.flags.powerCut ? 'silent · power is out' : 'humming in B-flat'}</span>
          <button class="fridge__x" data-close aria-label="Close">×</button>
        </header>
        <div class="fridge__cols">
          <section class="fridge__col fridge__col--cold"><h3>In the fridge <em class="fridge__cap ${needs.fridgeCount(s) >= CONFIG.fridge.capacity ? 'full' : ''}">${needs.fridgeCount(s)} / ${CONFIG.fridge.capacity}</em></h3>${shelf(s.fridge || [], 'fridge')}</section>
          <section class="fridge__col"><h3>In your pockets</h3>${shelf(s.inventory, 'inventory')}</section>
        </div>
        <footer class="fridge__foot">
          <span>Store food here to keep it for later. Eat from either side.</span>
          <button class="btn btn--sm" data-storeall>Store all food</button>
          <button class="btn btn--sm" data-takeall>Take everything</button>
          <button class="btn btn--sm" data-pantry>Order groceries</button>
          <button class="btn btn--sm" data-close>Close the door</button>
        </footer>
      </div>`;
  };
  wrap.addEventListener('click', (e) => {
    if (e.target.closest('[data-close]') || e.target === wrap) { closeFridge(g); return; }
    if (e.target.closest('[data-pantry]')) { closeFridge(g); g.openPhone?.('pantry'); return; }
    const mv = e.target.closest('[data-move]');
    if (mv) {
      const ok = needs.moveFood?.(g, mv.dataset.move, mv.dataset.to, mv.hasAttribute('data-all') ? Infinity : 1);
      if (!ok && mv.dataset.to === 'fridge') g.toast(`The fridge is full (${CONFIG.fridge.capacity}). Eat something, it is right there.`, 'info');
      render();
      return;
    }
    if (e.target.closest('[data-storeall]')) {
      for (const it of [...g.state.inventory]) if (CONFIG.items[it.id]?.kind === 'food') needs.moveFood(g, it.id, 'fridge', Infinity);
      if (needs.fridgeCount(g.state) >= CONFIG.fridge.capacity) g.toast('The fridge is full. The rest stays in your pockets.', 'info');
      render();
      return;
    }
    if (e.target.closest('[data-takeall]')) {
      for (const it of [...(g.state.fridge || [])]) needs.moveFood(g, it.id, 'inventory', Infinity);
      render();
      return;
    }
    const eat = e.target.closest('[data-eat]');
    if (eat) {
      closeFridge(g);
      needs.eat(g, eat.dataset.eat, eat.dataset.from);
    }
  });
  const onKey = (e) => {
    if (e.key === 'Escape') { e.stopImmediatePropagation(); e.preventDefault(); closeFridge(g); }
  };
  window.addEventListener('keydown', onKey, true);
  render();
  root.appendChild(wrap);
  open = { wrap, onKey };
  g.audio?.sfx?.('door');
  g.overlayOpen = true;
  g.onModalOpenChange?.(true);
}

export function closeFridge(g) {
  if (!open) return;
  window.removeEventListener('keydown', open.onKey, true);
  open.wrap.remove();
  open = null;
  g.overlayOpen = false;
  g.onModalOpenChange?.(false);
}
