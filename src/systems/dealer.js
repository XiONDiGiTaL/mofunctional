/**
 * Rolo: the dealer on Mo's phone. One order system, two ways in.
 *
 *   Txtr thread  a real text conversation whose replies are generated from the order state
 *   Rolo's Line  a crude WAP-era app with the catalog, a quantity, the total and the status
 *
 * Both call the functions below and nothing else, so they share the catalog, the prices, the
 * validation and the order itself. Everything lives in `state.dealer`, so it saves and loads
 * with the run like the rest of the game.
 *
 * An order's life:
 *   pending    placed and confirmed by text; Rolo is on his way (MEET_MINUTES of game time)
 *   waiting    Rolo is standing at the meet spot on Kestrel St. until the order expires
 *   completed  cash changed hands once, the goods are in Mo's pockets
 *   cancelled  Mo called it off, or was short at the handoff (nothing is charged)
 *   expired    Mo never showed (nothing is charged)
 *
 * Money moves exactly once, at the handoff, inside completeOrder(), after the status has been
 * flipped to `completed`; a second call finds a finished order and does nothing. Ordering
 * checks the balance up front, the handoff checks it again, and only one order can be open at
 * a time, so double clicks, a reload mid-deal or walking away can never charge twice or deliver
 * twice. The substances are the game's own fictional ones (see CONFIG.substances).
 */
import { CONFIG } from '../core/config.js';
import { addItem, bump, logLine } from '../core/state.js';
import { MEET_SPOT } from '../world/plan.js';

export const DEALER = {
  name: 'ROLO',
  app: "Rolo's Line",
  fee: 4,                 // the walk over is not free
  maxQty: 3,
  meetMinutes: 20,        // game minutes from "bet" to him standing at the hydrant
  waitMinutes: 180,       // how long he waits before the order is dead
  products: ['drip', 'mud', 'static', 'bliss'],
};

const OPEN = new Set(['pending', 'waiting']);
// Rolo is typing: kept out of the save on purpose, so a reload can never leave the thread locked
let typing = false;
export const isTyping = () => typing;
const T = () => CONFIG.substances.types;

/** The catalog both interfaces show: one entry per product, priced once, here. */
export function catalog() {
  return DEALER.products.map((id) => {
    const t = T()[id];
    return { id, name: t.name, unit: t.price + DEALER.fee, flavor: t.flavor, risk: t.risk, addiction: t.addiction };
  });
}
export const product = (id) => catalog().find((p) => p.id === id) || null;
export const quote = (id, qty) => {
  const p = product(id);
  return p ? Math.round(p.unit * qty * 100) / 100 : 0;
};

export function dealerState(s) {
  if (!s.dealer) s.dealer = { seq: 0, orders: [], log: [], convo: { step: 'idle', product: null, qty: 1 }, unread: 0 };
  const d = s.dealer;
  d.orders = d.orders || [];
  d.log = d.log || [];
  d.convo = d.convo || { step: 'idle', product: null, qty: 1 };
  return d;
}

export const activeOrder = (s) => dealerState(s).orders.find((o) => OPEN.has(o.status)) || null;
export const lastOrder = (s) => { const o = dealerState(s).orders; return o[o.length - 1] || null; };

/* ------------------------------------------------------------------ the thread */

function say(g, from, text) {
  const d = dealerState(g.state);
  d.log.push({ from, text, at: g.state.clock.m });
  if (d.log.length > 60) d.log.splice(0, d.log.length - 60);
  if (from === 'rolo') {
    d.unread = (d.unread || 0) + 1;
    g.audio?.sfx?.('phone');
    // surfaces as a HUD text like any other sender, unless the thread is already open
    if (!(g.phone?.isOpen && g.phone.app === 'dealer')) g.threads?.push?.(DEALER.name, text);
  }
  g.onDealerChange?.();
}

const money = (n) => `$${Number(n).toFixed(2).replace(/\.00$/, '')}`;
const minuteText = (m) => {
  const mod = ((m % 1440) + 1440) % 1440;
  return `${String(Math.floor(mod / 60)).padStart(2, '0')}:${String(mod % 60).padStart(2, '0')}`;
};

/** Rolo's side of the conversation, written from the state rather than from a script. */
function roloLine(g, kind, extra = {}) {
  const d = dealerState(g.state);
  const c = d.convo;
  const p = c.product ? product(c.product) : null;
  const o = activeOrder(g.state);
  switch (kind) {
    case 'menu':
      return `whats good. menu:\n${catalog().map((x, i) => `${i + 1}) ${x.name} ${money(x.unit)}`).join('\n')}\nprices got the walk in em`;
    case 'qty':
      return `${p.name}. how many? max ${DEALER.maxQty}`;
    case 'confirm':
      return `${c.qty}x ${p.name} = ${money(quote(c.product, c.qty))} cash. u good?`;
    case 'placed':
      return `bet. order ${o.id}. ${o.qty}x ${o.name}, ${money(o.total)} cash on me.\nmeet at ${MEET_SPOT.label}. ~${minuteText(o.meetAt)}. come alone, exact if u can`;
    case 'short':
      return `u got ${money(g.state.money)}. thats ${money(extra.total)}. come back when the math works`;
    case 'busy':
      return o ? `u already got ${o.id} open. ${o.status === 'waiting' ? 'im outside' : 'im on my way'}` : 'one thing at a time';
    case 'cancelled':
      return 'aight. cancelled. dont make it a habit';
    case 'nevermind':
      return 'k';
    case 'where':
      if (!o) return 'where whats? u didnt order nothing';
      return o.status === 'waiting' ? `outside. ${MEET_SPOT.label}. hoodie` : `on my way. ${MEET_SPOT.label} ~${minuteText(o.meetAt)}`;
    case 'arrived':
      return `here. ${MEET_SPOT.label}. dont keep me standing`;
    case 'done':
      return 'pleasure. delete this';
    case 'expired':
      return `waited. u never came. ${extra.id} is dead`;
    case 'hello':
    default:
      return 'yo';
  }
}

/** Quick replies Mo can send, derived from where the conversation is. */
export function smsOptions(s) {
  const d = dealerState(s);
  const o = activeOrder(s);
  if (o) return [{ key: 'where', label: 'where u at?' }, { key: 'cancel', label: 'cancel the order' }];
  switch (d.convo.step) {
    case 'menu':
      return [...catalog().map((p) => ({ key: `p:${p.id}`, label: `${p.name} (${money(p.unit)})` })), { key: 'nevermind', label: 'nvm' }];
    case 'qty':
      return [...Array.from({ length: DEALER.maxQty }, (_, i) => ({ key: `q:${i + 1}`, label: String(i + 1) })), { key: 'nevermind', label: 'nvm' }];
    case 'confirm':
      return [{ key: 'confirm', label: 'bet, send it' }, { key: 'nevermind', label: 'nah cancel' }];
    default:
      return [{ key: 'hello', label: 'yo u around?' }];
  }
}

/**
 * Mo sends one of the quick replies. His text lands at once; Rolo answers a beat later. While
 * an answer is pending the thread ignores further taps, which is what keeps a double click on
 * "bet, send it" from ever reaching placeOrder twice.
 */
export function smsSend(g, key) {
  const d = dealerState(g.state);
  if (typing) return false;
  const opt = smsOptions(g.state).find((o) => o.key === key);
  if (!opt) return false;
  say(g, 'mo', opt.label);
  typing = true;
  const reply = () => {
    typing = false;
    const c = d.convo;
    if (key === 'hello') { c.step = 'menu'; say(g, 'rolo', roloLine(g, 'menu')); return; }
    if (key === 'nevermind') { c.step = 'idle'; c.product = null; say(g, 'rolo', roloLine(g, 'nevermind')); return; }
    if (key.startsWith('p:')) { c.product = key.slice(2); c.qty = 1; c.step = 'qty'; say(g, 'rolo', roloLine(g, 'qty')); return; }
    if (key.startsWith('q:')) { c.qty = Number(key.slice(2)); c.step = 'confirm'; say(g, 'rolo', roloLine(g, 'confirm')); return; }
    if (key === 'confirm') { placeOrder(g, c.product, c.qty, 'sms'); return; }
    if (key === 'where') { say(g, 'rolo', roloLine(g, 'where')); return; }
    if (key === 'cancel') { cancelOrder(g, 'Mo called it off'); }
  };
  setTimeout(reply, 650 + Math.random() * 600);
  g.onDealerChange?.();
  return true;
}

/* ------------------------------------------------------------------ the order */

/**
 * The one way an order is made, from either interface. Returns { ok, order?, reason? }.
 * Rolo's text about it is sent from here too, so the thread always matches the app.
 */
export function placeOrder(g, productId, qty, via = 'app') {
  const s = g.state;
  const d = dealerState(s);
  const p = product(productId);
  const n = Math.floor(Number(qty));
  if (!p || !CONFIG.items[productId]) return { ok: false, reason: 'unknown product' };
  if (!(n >= 1 && n <= DEALER.maxQty)) return { ok: false, reason: 'bad quantity' };
  if (activeOrder(s)) {
    say(g, 'rolo', roloLine(g, 'busy'));
    return { ok: false, reason: 'an order is already open' };
  }
  const total = quote(productId, n);
  if (s.money < total) {
    d.convo.step = 'menu';
    say(g, 'rolo', roloLine(g, 'short', { total }));
    return { ok: false, reason: 'not enough money' };
  }
  d.seq = (d.seq || 0) + 1;
  const order = {
    id: `R-${String(d.seq).padStart(3, '0')}${Math.random().toString(36).slice(2, 4).toUpperCase()}`,
    product: productId, name: p.name, qty: n, unit: p.unit, total,
    status: 'pending', via,
    placedAt: s.clock.m,
    meetAt: s.clock.m + DEALER.meetMinutes,
    expiresAt: s.clock.m + DEALER.meetMinutes + DEALER.waitMinutes,
    spot: { ...MEET_SPOT },
  };
  d.orders.push(order);
  if (d.orders.length > 20) d.orders.splice(0, d.orders.length - 20);
  d.convo = { step: 'idle', product: null, qty: 1 };
  if (via === 'app') say(g, 'mo', `order: ${n}x ${p.name}`);
  say(g, 'rolo', roloLine(g, 'placed'));
  logLine(g, `Ordered ${n}x ${p.name} from Rolo (${order.id}).`, 'event');
  g.autosave?.();
  return { ok: true, order };
}

export function cancelOrder(g, why = 'cancelled') {
  const o = activeOrder(g.state);
  if (!o) return false;
  o.status = 'cancelled';
  o.closedAt = g.state.clock.m;
  o.note = why;
  say(g, 'rolo', roloLine(g, 'cancelled'));
  g.autosave?.();
  return true;
}

/**
 * The handoff, when Mo reaches Rolo on the street. Status flips first, then money and goods
 * move; anything that is not a waiting order is refused, so this cannot run twice.
 */
export function completeOrder(g) {
  const s = g.state;
  const o = activeOrder(s);
  if (!o || o.status !== 'waiting') return { ok: false, reason: 'no order waiting' };
  if (s.money < o.total) {
    o.status = 'cancelled';
    o.closedAt = s.clock.m;
    o.note = 'short at the handoff';
    say(g, 'rolo', roloLine(g, 'short', { total: o.total }));
    g.autosave?.();
    return { ok: false, reason: 'short' };
  }
  o.status = 'completed';
  o.closedAt = s.clock.m;
  const paid = g.spendMoney ? g.spendMoney(o.total, `Rolo — ${o.qty}x ${o.name}`) : true;
  if (paid === false) { // spendMoney refused after all: undo, nothing moved
    o.status = 'waiting';
    return { ok: false, reason: 'payment refused' };
  }
  addItem(s, o.product, o.qty);
  bump(s, 'risk', 2); // a handoff on the street is not nothing
  logLine(g, `Picked up ${o.qty}x ${o.name} from Rolo.`, 'event');
  say(g, 'rolo', roloLine(g, 'done'));
  g.audio?.sfx?.('cash');
  g.autosave?.();
  return { ok: true, order: o };
}

/** Game-time upkeep: pending orders arrive, waiting orders expire. Cheap; called often. */
export function tickDealer(g) {
  const s = g.state;
  if (!s?.dealer) return;
  const o = activeOrder(s);
  if (!o) return;
  const now = s.clock.m;
  if (o.status === 'pending' && now >= o.meetAt) {
    o.status = 'waiting';
    say(g, 'rolo', roloLine(g, 'arrived'));
  }
  if (o.status === 'waiting' && now >= o.expiresAt) {
    o.status = 'expired';
    o.closedAt = now;
    say(g, 'rolo', roloLine(g, 'expired', { id: o.id }));
    g.autosave?.();
  }
}
