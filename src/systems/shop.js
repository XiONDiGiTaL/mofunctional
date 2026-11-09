/**
 * Amazin': the online store. Anything he has sold on BidBay, lost to a mugger or never had —
 * electronics, a guitar, a watch, gifts, food that keeps — ordered on the phone or the laptop and
 * delivered to Unit 3B the next morning (a box by the door). Prices are retail, which is to say
 * more than BidBay paid him for the same thing. Shipping is $4.99. Nobody is ever home for it.
 *
 * Headless; orders in `state.shop.orders`, delivered on the new day.
 */
import * as ashby from './ashby.js';
import { CONFIG } from '../core/config.js';
import { dayOf, money } from '../core/util.js';
import { addItem, spend, pushMessage, logLine } from '../core/state.js';

export function shopState(s) {
  if (!s.shop) s.shop = { orders: [], spent: 0 };
  s.shop.orders = s.shop.orders || [];
  return s.shop;
}

/** What is for sale: every valuable, gift and keepable food, at a retail markup. */
export function catalog() {
  return Object.values(CONFIG.items)
    .filter((it) => ['valuable', 'gift', 'comfort', 'supply', 'tool'].includes(it.kind) || (it.kind === 'food' && ['beans', 'ramen', 'bar', 'cereal'].includes(it.id)))
    .filter((it) => it.id !== 'nia_meal')
    .map((it) => ({ id: it.id, name: it.name, kind: it.kind, price: retail(it) }));
}

export function retail(it) {
  const base = it.kind === 'valuable' || it.kind === 'gift' ? (it.value || it.price || 10) * CONFIG.shop.markup : (it.price || 2) * 1.6;
  return Math.max(1, Math.round(base * 100) / 100);
}

export function order(g, id, qty = 1) {
  const s = g.state;
  const it = CONFIG.items[id];
  if (!it) return false;
  const total = Math.round((retail(it) * qty + CONFIG.shop.shipping) * 100) / 100;
  if (s.money < total) { g.toast(`Amazin': ${money(total)} with shipping. You do not have it.`, 'bad'); return false; }
  spend(g, total, `Amazin': ${it.name}`);
  const sh = shopState(s);
  sh.orders.push({ id, qty, day: dayOf(s.clock.m) });
  sh.spent += total;
  g.advance(5);
  g.toast(`Ordered: ${it.name}. Arrives tomorrow morning. You will not be home. It will be by the door.`, 'good');
  return true;
}

/** New day: yesterday's orders are by the door. */
export function shopNewDay(g, day) {
  const s = g.state;
  const sh = shopState(s);
  const due = sh.orders.filter((o) => o.day < day);
  if (!due.length) return;
  sh.orders = sh.orders.filter((o) => o.day >= day);
  const names = due.map((o) => CONFIG.items[o.id]?.name || o.id).join(', ');
  // where it goes: the PO box, the post office (the address on file is 3B and he lives on 7th
  // Avenue now), or the stoop, where somebody sometimes gets to it first (systems/ashby.js)
  const route = ashby.parcelRoute(s);
  if (route !== 'door') {
    for (const o of due) ashby.holdParcel(s, o.id, o.qty);
    logLine(g, `Amazin' parcel at the post office: ${names}.`, 'info');
    pushMessage(g, { from: 'AMAZIN\'', subject: 'delivered', body: route === 'box' ? `Delivered to PO Box 1418, Ashby Station: ${names}. Pick it up at the window, Mon–Sat 8 to 5.` : `We could not deliver to the address on file (1120 Kestrel, 3B): ${names}. It is being held at Ashby Station Post Office. Change your address so this stops happening.` });
    return;
  }
  if (Math.random() < CONFIG.ashby.parcelTheft) {
    logLine(g, `An Amazin' parcel was stolen off the stoop: ${names}.`, 'bad');
    pushMessage(g, { from: 'AMAZIN\'', subject: 'delivered', body: `Your order was left by the door at 9:12 AM: ${names}. (It is not there. Gloria saw a kid in a red hoodie. Gloria sees everything and stops nothing. A PO box at Ashby Station would have kept it.)` });
    return;
  }
  for (const o of due) addItem(s, o.id, o.qty);
  logLine(g, `Amazin' delivered: ${names}.`, 'good');
  pushMessage(g, { from: 'AMAZIN\'', subject: 'delivered', body: `Your order was left by the door: ${names}. A neighbour signed for it. The neighbour is Gloria. Gloria has opinions about your order.` });
}
