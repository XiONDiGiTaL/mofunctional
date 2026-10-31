/**
 * The counter menu board: one card per item with its art, a price tag, chips for what it does
 * to Mo, and the owner's note. Click a card to buy; the card stamps "BAGGED" and the cash
 * readout ticks down without closing the board, so a breakfast run is three clicks, not three
 * modals. Escape, the × or "step outside" puts it away.
 */
import { itemIcon } from './icons.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const cash = (n) => `$${Number(n || 0).toFixed(2)}`;

let open = null;

/**
 * shop: the SHOPS entry; items: [{ id, def, price, note, gains: [[label, tone]] }];
 * buy(id) performs the purchase and returns true when it went through.
 */
export function showShopMenu(g, { shop, items, portrait, buy }) {
  closeShopMenu(g);
  const root = document.getElementById('ui') || document.body;
  const line = shop.voice[Math.floor(Math.random() * shop.voice.length)].replace(/[“”]/g, '');
  const wrap = document.createElement('div');
  wrap.className = `shopmenu shopmenu--${shop.id}`;
  wrap.innerHTML = `
    <div class="shopmenu__board" role="dialog" aria-label="${esc(shop.name)} menu">
      <header class="shopmenu__head">
        <img class="shopmenu__owner" src="${portrait}" alt="" />
        <div class="shopmenu__title">
          <span class="shopmenu__kicker">${esc(shop.kicker)}</span>
          <h2>${esc(shop.name)}</h2>
          <p class="shopmenu__say"><b>${esc(shop.owner)}:</b> “${esc(line)}”</p>
        </div>
        <div class="shopmenu__cash"><em>Cash</em><b data-cash>${cash(g.state.money)}</b></div>
        <button class="shopmenu__x" data-close aria-label="Close">×</button>
      </header>
      <p class="shopmenu__blurb">${esc(shop.blurb)}${shop.sellsPork ? '' : ' <span class="shopmenu__halal">HALAL · NO PORK · NO LOOSIES</span>'}</p>
      <div class="shopmenu__grid">
        ${items.map((it) => `
          <button class="menucard" data-buy="${it.id}" style="--tilt:${(Math.random() * 2 - 1).toFixed(2)}deg">
            <span class="menucard__price">${cash(it.price)}</span>
            ${itemIcon(it.id, it.def.kind)}
            <b class="menucard__name">${esc(it.def.name)}</b>
            <span class="menucard__note">${esc(it.note)}</span>
            <span class="menucard__chips">${it.gains.map(([t, tone]) => `<i class="chip chip--${tone}">${esc(t)}</i>`).join('')}</span>
            <span class="menucard__stamp">BAGGED</span>
          </button>`).join('')}
      </div>
      <footer class="shopmenu__foot">
        <span>Click an item to buy it. Everything goes straight in your pocket.</span>
        <button class="btn btn--sm" data-close>Step back outside</button>
      </footer>
    </div>`;

  const refresh = () => {
    wrap.querySelector('[data-cash]').textContent = cash(g.state.money);
    for (const card of wrap.querySelectorAll('[data-buy]')) {
      const it = items.find((x) => x.id === card.dataset.buy);
      card.classList.toggle('menucard--broke', g.state.money < it.price);
    }
  };
  wrap.addEventListener('click', (e) => {
    if (e.target.closest('[data-close]') || e.target === wrap) { closeShopMenu(g); return; }
    const card = e.target.closest('[data-buy]');
    if (!card || card.classList.contains('menucard--broke')) return;
    if (buy(card.dataset.buy)) {
      card.classList.remove('menucard--bagged');
      void card.offsetWidth;
      card.classList.add('menucard--bagged');
    } else {
      card.classList.add('menucard--nope');
      setTimeout(() => card.classList.remove('menucard--nope'), 400);
    }
    refresh();
  });
  const onKey = (e) => {
    if (e.key === 'Escape') { e.stopImmediatePropagation(); e.preventDefault(); closeShopMenu(g); }
  };
  window.addEventListener('keydown', onKey, true);
  root.appendChild(wrap);
  refresh();
  open = { wrap, onKey };
  g.audio?.sfx?.('ui');
  g.overlayOpen = true;
  g.onModalOpenChange?.(true);
}

export function closeShopMenu(g) {
  if (!open) return;
  window.removeEventListener('keydown', open.onKey, true);
  open.wrap.remove();
  open = null;
  g.overlayOpen = false;
  g.onModalOpenChange?.(false);
}
