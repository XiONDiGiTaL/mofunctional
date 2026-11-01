/**
 * Rent: paying it early, paying it once, and knowing what was paid.
 *
 * The schedule itself still lives in CONFIG.economy.rent and the cycle arithmetic still lives in
 * economy.billInfo() — this module adds the two things the game was missing:
 *
 *   1. Paying ahead. If nothing is outstanding, Mo can settle the NEXT cycle in advance. The
 *      payment is recorded against that cycle (`paidCycle`), so when its due date arrives
 *      billInfo() already sees it as settled and nothing is charged twice. Only one cycle may be
 *      paid ahead (CONFIG.rent.payAheadCycles), which keeps the eviction clock honest.
 *   2. A history. Every payment lands in `state.bills.rent.history` with the day, the amount,
 *      which cycle it covered, and the partner contribution that was applied at the time.
 *
 * A live-in girlfriend's share is applied inside economy.billInfo()/rentPerCycle() — one place,
 * read from CONFIG.partners[id].rentShare, and only ever for the single live-in partner. This
 * module never applies it a second time; it only reports it.
 *
 * Double payment: `state.rentLock` is set for the duration of a payment and released on a short
 * timer. Rapid repeat interactions (a double-click, a queued modal choice) find the lock and do
 * nothing. Because paidCycle is also written synchronously before the lock clears, a second call
 * after the lock sees `owedCycles === 0` and `paidAhead >= 1`, and still does nothing.
 */
import { CONFIG } from '../core/config.js';
import { money, dayOf } from '../core/util.js';
import { spend, logLine } from '../core/state.js';
import { billInfo, payBill, rentPerCycle, rentShare } from './economy.js';

export const RENT_MAX_AHEAD = CONFIG.rent?.payAheadCycles ?? 1;

/** Newest first, trimmed. Old saves simply have no history. */
export function rentHistory(s) {
  const h = s.bills?.rent?.history || [];
  return h.slice(-(CONFIG.rent?.historyLimit ?? 16)).reverse();
}

export function recordRentPayment(g, { amount, cycles, forDay, ahead = false }) {
  const s = g.state;
  const rent = s.bills.rent;
  rent.history = rent.history || [];
  rent.history.push({
    day: dayOf(s.clock.m),
    amount: Math.round(amount * 100) / 100,
    cycles,
    forDay,
    ahead: !!ahead,
    share: rentShare(s),
  });
  const limit = CONFIG.rent?.historyLimit ?? 16;
  if (rent.history.length > limit) rent.history.splice(0, rent.history.length - limit);
  s.counters.rentPaid = (s.counters.rentPaid || 0) + 1;
  s.counters.rentPaidTotal = Math.round(((s.counters.rentPaidTotal || 0) + amount) * 100) / 100;
}

/**
 * Everything the interface needs, in one object: what is owed, what is already paid, when the
 * next cycle falls due, the partner contribution, and the history.
 */
export function rentStatus(g) {
  const s = g.state;
  const info = billInfo(g, 'rent');
  const perCycle = rentPerCycle(s);
  const share = rentShare(s);
  const contribution = Math.round(CONFIG.economy.rent.amount * share * 100) / 100;
  const paidAhead = Math.max(0, (info.paidCycle ?? -1) - (info.reached ?? -1));
  return {
    ...info,
    perCycle,
    share,
    contribution,
    paidAhead,
    alreadyPaid: info.owedCycles <= 0,
    canPayNow: info.owedCycles > 0 && s.money >= info.owed,
    canPayAhead: info.owedCycles <= 0 && paidAhead < RENT_MAX_AHEAD && s.money >= perCycle,
    aheadCost: perCycle,
    aheadForDay: info.nextDueDay,
    history: rentHistory(s),
    locked: !!s.rentLock,
  };
}

/**
 * Pay what is owed (all outstanding cycles), or — with `ahead` — settle the next cycle early.
 * Returns { ok, paid, ahead, reason }.
 */
export function payRent(g, { ahead = false } = {}) {
  const s = g.state;
  if (s.ending) return { ok: false, reason: 'over' };
  if (s.rentLock) return { ok: false, reason: 'busy' };
  const info = billInfo(g, 'rent');
  if (info.noLease) {
    g.toast('There is no lease to pay. Rae has the keys.', 'bad');
    return { ok: false, reason: 'no lease' };
  }

  // Something is outstanding: settle it through the one bill path (it owns the flags,
  // the tutorial step and the eviction notice coming down).
  if (info.owedCycles > 0) {
    s.rentLock = true;
    try {
      // payBill() owns the receipt for a due cycle (it appends to bills.rent.history itself),
      // so this branch must not write a second one
      const paid = payBill(g, 'rent');
      if (!paid) return { ok: false, reason: 'refused' };
      g.bus.emit('rent', { paid: info.owed, ahead: false });
      return { ok: true, paid: info.owed, ahead: false, forDay: info.dueDay };
    } finally {
      releaseLock(s);
    }
  }

  if (!ahead) {
    g.toast(`${info.name}: this cycle is settled. Next due Day ${info.nextDueDay}.`, 'info');
    return { ok: false, reason: 'nothing due' };
  }

  const paidAhead = Math.max(0, (info.paidCycle ?? -1) - (info.reached ?? -1));
  if (paidAhead >= RENT_MAX_AHEAD) {
    g.toast(`Rent is already paid ahead through Day ${info.nextDueDay}.`, 'info');
    return { ok: false, reason: 'already ahead' };
  }

  const cost = rentPerCycle(s);
  if (s.money < cost) {
    g.toast(`You need ${money(cost - s.money)} more to pay rent early.`, 'bad');
    g.audio.sfx('deny');
    return { ok: false, reason: 'short' };
  }

  s.rentLock = true;
  try {
    const forDay = info.nextDueDay;
    if (!spend(g, cost, `${info.name} — early for Day ${forDay}`)) return { ok: false, reason: 'short' };
    // The cycle is marked paid BEFORE anything else, so the due date finds it settled.
    s.bills.rent.paidCycle = Math.max(s.bills.rent.paidCycle, info.reached) + 1;
    s.bills.rent.missed = 0;
    if (s.flags.evictionNotice) {
      s.flags.evictionNotice = false;
      g.toast('The eviction notice comes down off the door. For now.', 'good');
    }
    recordRentPayment(g, { amount: cost, cycles: 1, forDay, ahead: true });
    logLine(g, `Paid rent early for Day ${forDay} (${money(cost)}).`, 'good');
    g.toast(`Rent paid early — Day ${forDay} is covered. ${money(cost)} gone.`, 'good');
    g.audio.sfx('cash');
    if (s.flags.tutorial === 3) { s.flags.tutorial = 4; g.bus.emit('tutorial'); }
    g.bus.emit('bills');
    g.bus.emit('rent', { paid: cost, ahead: true, forDay });
    return { ok: true, paid: cost, ahead: true, forDay };
  } finally {
    releaseLock(s);
  }
}

/** Short lock: long enough to swallow a double click, short enough to never be noticed. */
function releaseLock(s) {
  setTimeout(() => { s.rentLock = false; }, 300);
}

/** Debug/testing: force the rent state without going through the money. */
export function debugSetRent(g, { paidAhead = 0, clearHistory = false } = {}) {
  const s = g.state;
  const info = billInfo(g, 'rent');
  s.bills.rent.paidCycle = (info.reached ?? -1) + Math.max(0, paidAhead);
  if (clearHistory) s.bills.rent.history = [];
  s.rentLock = false;
  g.bus.emit('bills');
  return billInfo(g, 'rent');
}
