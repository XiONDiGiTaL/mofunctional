/**
 * Delivery from Miguel's or Habib's, ordered by phone.
 *
 * One order at a time. The courier turns up outside 1120 about twenty-five minutes later and
 * texts. Pay-at-the-door orders wait an hour; then he eats the cost and leaves. Leave-at-the-door
 * orders are paid up front and sit by the stoop until Mo collects them, and the longer they sit,
 * the more of the block takes an interest in them.
 *
 *   status: none → enroute → waiting (courier at the door) | door (package on the stoop) → none
 */
import { CONFIG } from '../core/config.js';
import { money, pick, dayOf } from '../core/util.js';
import { addItem, pushMessage, logLine } from '../core/state.js';
import { SHOPS, shopPrice } from '../world/shops.js';

const D = () => CONFIG.delivery || { fee: 3, minutes: 25, waitMinutes: 60, theftPerHour: 0.06 };

export function deliveryState(s) {
  if (!s.delivery) s.delivery = { status: 'none' };
  return s.delivery;
}

export const shopFor = (id) => SHOPS[id] || SHOPS.bodega;
export const priceOf = (shopId, itemId) => shopPrice(shopId, itemId);

export function orderTotal(shopId, cart) {
  const sub = Object.entries(cart).reduce((n, [id, q]) => n + priceOf(shopId, id) * q, 0);
  return Math.round((sub + D().fee) * 100) / 100;
}

const sender = (shopId) => (shopId === 'habibs' ? 'HABIB' : 'MIGUEL');
const itemsLine = (items) => Object.entries(items).filter(([, q]) => q > 0).map(([id, q]) => `${CONFIG.items[id]?.name || id} x${q}`).join(', ');

export function placeOrder(g, shopId, cart, prepaid) {
  const s = g.state;
  const d = deliveryState(s);
  if (d.status !== 'none') return false;
  const total = orderTotal(shopId, cart);
  if (prepaid) {
    if (s.money < total) { g.toast('Not enough on you to pay ahead.', 'bad'); return false; }
    g.spendMoney(total, `${shopFor(shopId).name}: delivery`);
  }
  Object.assign(d, { status: 'enroute', shop: shopId, items: { ...cart }, total, prepaid: !!prepaid, eta: s.clock.m + D().minutes, arrivedAt: 0, checked: 0 });
  g.toast(prepaid ? `"Paid. We leave it at your door, 1120, 3B. Twenty-five minutes."` : `"Twenty-five minutes. Cash at the door. Do not make my guy wait, he has other people."`, 'good');
  logLine(g, `Ordered from ${shopFor(shopId).name}: ${itemsLine(cart)}.`, 'info');
  return true;
}

/** Called every frame from the main loop: arrivals, the hour he waits, and the stoop. */
export function tickDelivery(g) {
  const s = g.state;
  const d = s.delivery;
  if (!d || d.status === 'none') return;
  const now = s.clock.m;
  if (d.status === 'enroute' && now >= d.eta) {
    d.status = d.prepaid ? 'door' : 'waiting';
    d.arrivedAt = now;
    d.checked = now;
    pushMessage(g, {
      from: sender(d.shop), subject: 'delivery',
      body: d.prepaid
        ? '“left it outside 3B at 1120. bag with a knot on it. get it before somebody else does.”'
        : `“outside 1120. ${money(d.total)}. i'm here for an hour, then i'm gone and it's your problem.”`,
    });
    g.toast(d.prepaid ? 'Your delivery is outside your door, 3B.' : 'The delivery guy is upstairs outside 3B with your order.', 'info');
    return;
  }
  if (d.status === 'waiting' && now - d.arrivedAt > D().waitMinutes) {
    pushMessage(g, { from: sender(d.shop), subject: 'delivery', body: '“waited an hour. he ate the fries. don\'t call for a week.”' });
    g.toast('The delivery guy gave up and left with your order.', 'bad');
    s.delivery = { status: 'none', blockedUntil: dayOf(now) };
    return;
  }
  // a bag on a stoop is an invitation; every half hour after the first, somebody may accept it
  if (d.status === 'door' && now - d.checked >= 30) {
    d.checked = now;
    const hours = (now - d.arrivedAt) / 60;
    if (hours > 1 && Math.random() < D().theftPerHour * hours * 0.5) {
      const ids = Object.keys(d.items).filter((id) => d.items[id] > 0);
      if (!ids.length) return;
      if (Math.random() < 0.3) { for (const id of ids) d.items[id] = 0; d.robbed = 'all'; }
      else { const id = pick(ids); d.items[id] -= 1; d.robbed = 'some'; }
    }
  }
}

/** At the door: pay (if not paid) and take it. Returns false if there was nothing to take. */
export function collect(g) {
  const s = g.state;
  const d = deliveryState(s);
  if (d.status !== 'waiting' && d.status !== 'door') return false;
  if (d.status === 'waiting') {
    if (s.money < d.total) { g.toast(`"${money(d.total)}. You have ${money(s.money)}. I'll wait. Not long."`, 'bad'); return false; }
    g.spendMoney(d.total, `${shopFor(d.shop).name}: delivery`);
  }
  const got = Object.entries(d.items).filter(([, q]) => q > 0);
  for (const [id, q] of got) addItem(s, id, q);
  g.audio?.sfx?.('cash');
  const robbed = d.robbed;
  const wasWaiting = d.status === 'waiting';
  s.delivery = { status: 'none' };
  if (!got.length) { g.toast('The bag is there. The bag is empty. Somebody tied the knot back, which is the cruellest part.', 'bad'); return true; }
  g.toast(robbed === 'some' ? `${itemsLine(Object.fromEntries(got))}. Something is missing and there is a bite out of the bag.` : wasWaiting ? `"Enjoy." ${itemsLine(Object.fromEntries(got))}, still warm.` : `${itemsLine(Object.fromEntries(got))}. Still there. Still mostly warm.`, 'good');
  return true;
}
