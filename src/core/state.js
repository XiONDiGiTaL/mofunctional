/**
 * State shape + item/clock helpers. Systems receive `g` (the Game instance)
 * which exposes `g.state`; they never construct their own state.
 */
import { CONFIG } from './config.js';
import { clamp, dayOf, hhmm, minuteOfDay, uid } from './util.js';

export function createState() {
  const s = {
    v: 2,
    createdAt: Date.now(),
    clock: { m: CONFIG.time.startMinutes },
    money: CONFIG.economy.startMoney,
    stats: {
      energy: 64, hunger: 46, hygiene: 58, stress: 30, morale: 48,
      addiction: 22, tolerance: 8, risk: 10, withdrawal: 0,
    },
    high: { level: 0, until: 0, lastDose: -9999 },
    job: {
      employed: true,
      workedDay: 0,
      calledOutDay: 0,
      employer: CONFIG.job.employer,
      title: CONFIG.job.title,
      wage: CONFIG.job.wage,
      shiftStart: CONFIG.job.shiftStart,
      shiftEnd: CONFIG.job.shiftEnd,
      days: [...CONFIG.job.days],
      strikes: 0,
      warned: false,
      shiftsWorked: 0,
      lastShiftDay: 0,
      calledOut: false,
      quit: false,
      fired: false,
    },
    bills: {
      rent: { paidCycle: -1, missed: 0, lastPaid: 0, remindedDay: 0 },
      power: { paidCycle: -1, missed: 0, lastPaid: 0, remindedDay: 0 },
      phone: { paidCycle: -1, missed: 0, lastPaid: 0, remindedDay: 0 },
    },
    crp: { active: false, credit: 0, lastRecert: 0, applied: false, recertDue: 0 },
    fellowship: { stage: 0, joinedDay: 0, titheOwed: 0, lastAllowanceDay: 0, visits: 0, pledged: false },
    inventory: [
      { id: 'ramen', qty: 3 },
      { id: 'beans', qty: 2 },
      { id: 'eggs', qty: 1 },
      { id: 'id_card', qty: 1 },
      { id: 'lease', qty: 1 },
      { id: 'tv', qty: 1 },
      { id: 'guitar', qty: 1 },
      { id: 'watch', qty: 1 },
      { id: 'jacket', qty: 1 },
    ],
    listings: [],       // { uid, itemId, price, resolveAt, listedAt }
    deliveries: [],     // { at, items: [{id, qty}], label }
    messages: [],       // { id, from, subject, body, day, read, choices? }
    ledger: [],         // { day, label, amount }
    log: [],            // { day, minute, text, kind }
    flags: {
      intro: false,
      metAddison: false,
      metDex: true,
      tutorial: 0,           // 0 new, 1 phone, 2 eat, 3 work, 4 rent
      evictionNotice: false,
      powerCut: false,
      cat: false,
      badBatch: false,
      firstDose: false,
      collapse: false,
      rareEvents: 0,
      daySummaryShown: 0,
      tutorialDismissed: false,
    },
    npc: { addison: 0, rae: 0, dale: 0, nia: 0, dex: 0, kev: 0, chairman: 0 },
    counters: {
      daysSurvived: 1, doses: 0, meals: 0, shifts: 0, oddJobs: 0, sales: 0,
      sleepHours: 0, overdosesScares: 0, stressHighHours: 0, sundaysAttended: 0, moraleLowHours: 0,
      unitsSold: 0, moneyEarned: 0, collapsed: 0,
    },
    social: { followers: 12, lastPost: 0 },
    events: { lastAt: -999, today: 0, todaysDay: 1, count: 0 },
    seenEvents: [],
    ending: null,
    pendingSummary: null,
    settings: { speed: 1, crt: true, ratio43: false, volume: 0.7, muted: false },
    dayStart: { money: CONFIG.economy.startMoney, stats: null, day: 1 },
    deliverySeq: 0,
    idleStrikes: 0,
    lastSaveAt: 0,
  };
  s.dayStart.stats = { ...s.stats };
  return s;
}

/* ------------------------------ clock ------------------------------ */

export const clock = (s) => ({
  m: s.clock.m,
  day: dayOf(s.clock.m),
  mod: minuteOfDay(s.clock.m),
  hhmm: hhmm(s.clock.m),
  weekday: (dayOf(s.clock.m) - 1) % 7,
});

export function advance(s, minutes) {
  s.clock.m += minutes;
}

/* ------------------------------ items ------------------------------ */

export const itemDef = (id) => CONFIG.items[id];

export function countItem(s, id) {
  const e = s.inventory.find((i) => i.id === id);
  return e ? e.qty : 0;
}
export const hasItem = (s, id) => countItem(s, id) > 0;

export function addItem(s, id, qty = 1) {
  if (!itemDef(id)) return false;
  const e = s.inventory.find((i) => i.id === id);
  if (e) e.qty += qty;
  else s.inventory.push({ id, qty });
  return true;
}

export function removeItem(s, id, qty = 1) {
  const e = s.inventory.find((i) => i.id === id);
  if (!e || e.qty < qty) return false;
  e.qty -= qty;
  if (e.qty <= 0) s.inventory = s.inventory.filter((i) => i !== e);
  return true;
}

export function inventoryList(s) {
  return s.inventory
    .filter((e) => e.qty > 0)
    .map((e) => ({ ...e, def: itemDef(e.id) }))
    .filter((e) => e.def);
}

/* ------------------------------ money ------------------------------ */

export function earn(g, amount, label) {
  if (!amount) return;
  g.state.money = Math.round((g.state.money + amount) * 100) / 100;
  g.state.counters.moneyEarned += Math.max(0, amount);
  if (g.state.fellowship && g.state.fellowship.stage >= 3 && amount > 0) {
    g.state.fellowship.titheOwed = Math.round((g.state.fellowship.titheOwed + amount * CONFIG.fellowship.titheRate) * 100) / 100;
  }
  g.state.ledger.push({ day: dayOf(g.state.clock.m), label, amount });
  if (g.state.ledger.length > 80) g.state.ledger.shift();
}

export function spend(g, amount, label) {
  if (amount > g.state.money) return false;
  g.state.money = Math.round((g.state.money - amount) * 100) / 100;
  g.state.ledger.push({ day: dayOf(g.state.clock.m), label, amount: -amount });
  if (g.state.ledger.length > 80) g.state.ledger.shift();
  return true;
}

/* ------------------------------ logging ------------------------------ */

export function logLine(g, text, kind = 'info') {
  const s = g.state;
  s.log.push({ day: dayOf(s.clock.m), minute: s.clock.m, text, kind });
  if (s.log.length > 60) s.log.shift();
  g.bus.emit('log', { text, kind });
}

/* ------------------------------ stats ------------------------------ */

export function bump(s, key, delta) {
  if (!(key in s.stats)) return 0;
  const before = s.stats[key];
  s.stats[key] = clamp(before + delta);
  return s.stats[key] - before;
}

export const statPercent = (s, key) => Math.round(s.stats[key] ?? 0);

/* ------------------------------ messages ------------------------------ */

export function pushMessage(g, { from, subject, body, choices = null, id = uid() }) {
  g.state.messages.unshift({
    id, from, subject, body,
    day: dayOf(g.state.clock.m),
    read: false,
    choices,
  });
  if (g.state.messages.length > 40) g.state.messages.pop();
  g.bus.emit('message', { from, subject, body, id });
  return id;
}

export const unreadMessages = (s) => s.messages.filter((m) => !m.read).length;
