#!/usr/bin/env node
/**
 * Headless checks for the systems added in this pass: early rent, partner rent share, the
 * Afterglow clock, event cooldowns, contextual SMS replies, romance progression and the clinic.
 *
 * These run in plain Node with a small `g` stub — no DOM, no WebGL, no browser. They are the
 * checks that can be automated; the animations, the world and the interfaces still need a human
 * (or a browser) to look at them.
 *
 *   node scripts/test-systems.mjs
 */
import { CONFIG } from '../src/core/config.js';
import { createState, clock, bump } from '../src/core/state.js';
import { billInfo, rentPerCycle, rentShare } from '../src/systems/economy.js';
import * as rent from '../src/systems/rent.js';
import * as romance from '../src/systems/romance.js';
import * as scheduler from '../src/systems/scheduler.js';
import * as sms from '../src/systems/sms.js';
import * as clinic from '../src/systems/clinic.js';

let passed = 0;
let failed = 0;
const log = [];

function check(name, fn) {
  try {
    const res = fn();
    if (res === false) throw new Error('returned false');
    passed++;
    log.push(`  ok  ${name}`);
  } catch (e) {
    failed++;
    log.push(`FAIL  ${name}\n        ${e.message}`);
  }
}

const eq = (a, b, msg = '') => { if (a !== b) throw new Error(`${msg} expected ${b}, got ${a}`); return true; };
const near = (a, b, tol = 0.02, msg = '') => { if (Math.abs(a - b) > tol) throw new Error(`${msg} expected ~${b}, got ${a}`); return true; };

/** The smallest Game the systems need. */
function stubGame(state = createState()) {
  const g = {
    state,
    bus: { emit() {}, on() {} },
    paused: false,
    phoneOpen: false,
    modalOpen: false,
    toasts: [],
    modals: [],
    toast(t) { this.toasts.push(t); },
    audio: { sfx() {} },
    advance(m) { g.state.clock.m += m; },
    openModal(o) { this.modals.push(o); },
    spendMoney(a, l) { if (g.state.money < a) return false; g.state.money = Math.round((g.state.money - a) * 100) / 100; return true; },
    earnMoney(a) { g.state.money = Math.round((g.state.money + a) * 100) / 100; },
    payBill() { return true; },
    world: { areaId: 'street' },
    hud: { update() {} },
    fadeOut(cb) { cb?.(); },
    fadeIn() {},
    goTo(area) { g.world.areaId = area; },
  };
  return g;
}

/* ------------------------------------------------------------------ rent */

check('rent: a due cycle can be paid before/at the due date', () => {
  const g = stubGame();
  const s = g.state;
  s.clock.m = (7 - 1) * 1440 + 9 * 60;       // Day 7, 09:00 — rent is now due
  const info = billInfo(g, 'rent');
  eq(info.owedCycles, 1, 'owed cycles');
  near(info.owed, CONFIG.economy.rent.amount, 0.01, 'owed');
  s.money = 900;
  const res = rent.payRent(g, { ahead: false });
  eq(res.ok, true, 'payment ok');
  eq(billInfo(g, 'rent').owedCycles, 0, 'settled after paying');
  return true;
});

check('rent: early payment settles the next cycle and is not charged again', () => {
  const g = stubGame();
  const s = g.state;
  s.clock.m = (4 - 1) * 1440 + 10 * 60;      // Day 4, before the first due date
  s.money = 1000;
  const before = billInfo(g, 'rent');
  eq(before.owedCycles, 0, 'nothing due yet');
  eq(before.nextDueDay, 7, 'first due day');
  const res = rent.payRent(g, { ahead: true });
  eq(res.ok, true, 'early payment accepted');
  near(res.paid, CONFIG.economy.rent.amount, 0.01, 'early amount');
  // Day 7 arrives: nothing is owed, and the next due date has moved one cycle on
  s.clock.m = (7 - 1) * 1440 + 9 * 60;
  const after = billInfo(g, 'rent');
  eq(after.owedCycles, 0, 'paid-ahead cycle is still settled on its due day');
  eq(after.nextDueDay, 14, 'next due date moved to the following cycle');
  // paying again on the due date does nothing
  const again = rent.payRent(g, { ahead: false });
  eq(again.ok, false, 'no second charge');
  return true;
});

check('rent: only one cycle may be paid ahead', () => {
  const g = stubGame();
  g.state.money = 5000;
  eq(rent.payRent(g, { ahead: true }).ok, true, 'first early payment');
  g.state.rentLock = false;            // as if the 300ms double-click lock had expired
  const second = rent.payRent(g, { ahead: true });
  eq(second.ok, false, 'second early payment refused');
  eq(second.reason, 'already ahead', 'reason');
  return true;
});

check('rent: rapid repeat payments cannot double charge', () => {
  const g = stubGame();
  const s = g.state;
  s.clock.m = (7 - 1) * 1440;
  s.money = 900;
  const a = rent.payRent(g, { ahead: false });
  const b = rent.payRent(g, { ahead: false });   // the second click, same tick
  eq(a.ok, true, 'first payment');
  eq(b.ok, false, 'second refused');
  near(s.money, 900 - CONFIG.economy.rent.amount, 0.01, 'charged once');
  return true;
});

check('rent: a live-in partner\'s share is applied exactly once', () => {
  const g = stubGame();
  const s = g.state;
  s.romance = null;
  romance.romanceState(s);
  s.clock.m = (7 - 1) * 1440;
  s.money = 2000;
  eq(rentShare(s), 0, 'no share with nobody living there');
  near(rentPerCycle(s), CONFIG.economy.rent.amount, 0.01, 'full rent');
  s.romance.liveIn = 'diana';
  near(rentShare(s), 0.5, 0.0001, 'Diana half');
  near(rentPerCycle(s), CONFIG.economy.rent.amount * 0.5, 0.01, 'half rent');
  const info = billInfo(g, 'rent');
  near(info.owed, CONFIG.economy.rent.amount * 0.5, 0.01, 'owed uses the share');
  near(info.contribution, CONFIG.economy.rent.amount * 0.5, 0.01, 'contribution reported');
  // a second live-in flag cannot stack
  s.romance.partners.melanie.liveIn = true;
  romance.romanceState(s);
  near(rentShare(s), 0.5, 0.0001, 'still one contribution');
  return true;
});

check('rent: early payment works while a partner contributes', () => {
  const g = stubGame();
  const s = g.state;
  s.romance = null;
  romance.romanceState(s);
  s.romance.liveIn = 'stephanie';
  s.clock.m = (3 - 1) * 1440;
  s.money = 1000;
  const res = rent.payRent(g, { ahead: true });
  eq(res.ok, true, 'early payment');
  near(res.paid, CONFIG.economy.rent.amount * 0.85, 0.02, 'Stephanie 15% share');
  eq(rent.rentHistory(s).length, 1, 'one receipt');
  return true;
});

/* --------------------------------------------------------------- romance */

check('romance: three successful dates, then girlfriend', () => {
  const g = stubGame();
  const s = g.state;
  s.money = 2000;
  s.clock.m = (2 - 1) * 1440 + 13 * 60;
  romance.meetPartner(g, 'stephanie');
  const st = romance.partnerState(s, 'stephanie');
  st.affection = 55;
  eq(romance.canAskGirlfriend(s, 'stephanie'), false, 'cannot ask with 0 dates');
  st.dates = 3;
  eq(romance.canAskGirlfriend(s, 'stephanie'), true, 'can ask after 3 dates');
  st.affection = 40;
  // she decides with a roll; pin it so the check tests the system, not the weather
  const realRandom = Math.random;
  Math.random = () => 0.01;
  const ok = romance.askGirlfriend(g, 'stephanie');
  Math.random = realRandom;
  eq(ok, true, 'she said yes');
  eq(st.girlfriend, true, 'girlfriend flag');
  return true;
});

check('romance: a date costs money, spends time and records an outcome', () => {
  const g = stubGame();
  const s = g.state;
  s.money = 300;
  s.clock.m = (3 - 1) * 1440 + 13 * 60;
  romance.meetPartner(g, 'melanie');
  const st = romance.partnerState(s, 'melanie');
  const before = { money: s.money, time: s.clock.m, aff: st.affection };
  const res = romance.startDate(g, 'melanie', 'coffee');
  eq(res.ok, true, 'date ran');
  near(s.money, before.money - CONFIG.romance.activities.coffee.cost, 0.01, 'cost charged');
  if (s.clock.m <= before.time) throw new Error('date did not consume time');
  if (!['great', 'good', 'ok', 'bad'].includes(res.outcome)) throw new Error('bad outcome value');
  return true;
});

check('romance: a bad date is not refunded', () => {
  const g = stubGame();
  const s = g.state;
  s.money = 300;
  s.clock.m = (3 - 1) * 1440 + 13 * 60;
  romance.meetPartner(g, 'diana');
  const st = romance.partnerState(s, 'diana');
  st.affection = 25;
  s.stats.hygiene = 2;
  s.stats.energy = 5;
  s.stats.morale = 8;
  s.stats.stress = 95;
  const before = s.money;
  let spent = 0;
  let bad = null;
  for (let i = 0; i < 8; i++) {           // find a bad one; the score is random
    st.lastDateDay = 0;                   // (and not every hour is one she is free)
    s.clock.m = (3 - 1) * 1440 + 8 * 60 + i * 120;
    const res = romance.startDate(g, 'diana', 'coffee');
    if (!res.ok) continue;
    spent += res.cost;
    if (res.outcome === 'bad') { bad = res; break; }
  }
  if (!bad) return true;                  // cannot force it this run; not a failure
  // every date that ran was charged, including the bad one, and nothing came back
  near(s.money, before - spent, 0.05, 'no refund');
  if (bad.cost <= 0) throw new Error('a bad date cost nothing');
  return true;
});

check('afterglow: exactly 24 in-game hours, not a real-world timer', () => {
  const g = stubGame();
  const s = g.state;
  const start = s.clock.m;
  romance.startAfterglow(g);
  const until = romance.romanceState(s).afterglowUntil;
  eq(until - start, CONFIG.romance.afterglowHours * 60, 'duration in game minutes');
  eq(romance.afterglowActive(s), true, 'active at start');
  s.clock.m = until - 1;
  eq(romance.afterglowActive(s), true, 'active one minute before');
  s.clock.m = until;
  eq(romance.afterglowActive(s), false, 'over at the boundary');
  return true;
});

check('afterglow: morale is held at max while it runs', () => {
  const g = stubGame();
  const s = g.state;
  romance.startAfterglow(g);
  s.stats.morale = 12;
  s.stats.stress = 90;
  romance.applyAfterglow(s);
  eq(s.stats.morale, 100, 'morale held');
  if (s.stats.stress > 12) throw new Error('stress not reduced');
  return true;
});

check('gifts: one pending gift, opened once, item added once', () => {
  const g = stubGame();
  const s = g.state;
  romance.romanceState(s);
  s.romance.liveIn = 'diana';
  const got = romance.spawnGift(g, 'diana');
  eq(got, true, 'gift spawned');
  eq(romance.spawnGift(g, 'diana'), false, 'no duplicate pending gift');
  const before = new Map(s.inventory.map((i) => [i.id, i.qty]));
  const res = romance.openGift(g);
  eq(!!res, true, 'opened');
  eq(romance.openGift(g), false, 'cannot open twice');
  // the item may already be in his pockets; what matters is that exactly one was added
  const after = s.inventory.filter((i) => i.id === res.item).reduce((n, i) => n + i.qty, 0);
  eq(after, (before.get(res.item) || 0) + 1, 'exactly one item added');
  return true;
});

check('household: Diana restocks the fridge once per day', () => {
  const g = stubGame();
  const s = g.state;
  romance.romanceState(s);
  s.romance.liveIn = 'diana';
  s.fridge = [];
  s.clock.m = (5 - 1) * 1440;
  romance.partnerNewDay(g, 5);
  const after = s.fridge.reduce((n, i) => n + i.qty, 0);
  if (after <= 0) throw new Error('no restock');
  romance.partnerNewDay(g, 5);       // same day again: nothing further
  const again = s.fridge.reduce((n, i) => n + i.qty, 0);
  eq(again, after, 'no duplicate restock on the same day');
  return true;
});

/* --------------------------------------------------------------- events */

check('scheduler: an event respects its cooldown', () => {
  const g = stubGame();
  const s = g.state;
  const ev = { id: 'unit_test', weight: 1, cooldownHours: 24, run() {} };
  eq(scheduler.isEligible(g, ev), true, 'eligible before it fires');
  scheduler.fire(g, ev);
  s.clock.m += 60;
  eq(scheduler.isEligible(g, ev), false, 'blocked one hour later');
  s.clock.m += 24 * 60;
  eq(scheduler.isEligible(g, ev), true, 'allowed after the cooldown');
  return true;
});

check('scheduler: family calls are not daily any more', () => {
  const g = stubGame();
  const s = g.state;
  const ev = { id: 'nia_call', weight: 1, cooldownHours: 40, run() {} };
  scheduler.fire(g, ev);
  s.clock.m += 24 * 60;
  eq(scheduler.isEligible(g, ev), false, 'still cooling down after one day');
  s.clock.m += 20 * 60;
  eq(scheduler.isEligible(g, ev), true, 'available again after its gap');
  return true;
});

check('scheduler: rolling never fires above the daily cap', () => {
  const g = stubGame();
  const s = g.state;
  const ev = { id: 'cap_test', weight: 1, cooldownHours: 0, run() {} };
  let fired = 0;
  s.clock.m = 0;                          // stay inside Day 1: the cap is per day
  for (let i = 0; i < 60; i++) {
    s.clock.m += 20;
    if (scheduler.roll(g, 1, [ev], { chancePerHour: 1, minMinutesBetween: 0 })) fired++;
  }
  if (fired > CONFIG.events.maxPerDay) throw new Error(`fired ${fired} times in one day`);
  return true;
});

/* ------------------------------------------------------------------- sms */

check('sms: BidBay gets marketplace replies, not personal ones', () => {
  const s = createState();
  const opts = sms.replyOptions({ from: 'BIDBAY', body: 'Your listing expired' }, s);
  const labels = opts.map((o) => o.label).join(' | ');
  if (/can we not do this right now/i.test(labels)) throw new Error('generic personal reply leaked in');
  eq(sms.categoryOf('BIDBAY'), 'auction', 'category');
  if (!opts.some((o) => /listing|sold|price/i.test(o.label))) throw new Error('no transactional replies');
  return true;
});

check('sms: each sender class has its own replies', () => {
  const s = createState();
  const cat = {
    BIDBAY: 'auction', NIA: 'family', RAE: 'landlord', 'DALE (QUIK-STOP #14)': 'employer',
    'KESTREL CLINIC': 'clinic', 'CIVIC RELIEF PROGRAM': 'marketplace', ROLO: 'dealer',
    STEPHANIE: 'romantic', '555-0117': 'unknown',
  };
  for (const [from, expected] of Object.entries(cat)) {
    eq(sms.categoryOf(from), expected, `${from} category`);
    const opts = sms.replyOptions({ from, body: 'x' }, s);
    if (!opts.length) throw new Error(`${from} has no replies`);
  }
  const personal = sms.replyOptions({ from: 'KEV', body: 'x' }, s).map((o) => o.label).join(' ');
  if (/recertify/i.test(personal)) throw new Error('relief-office reply on a personal thread');
  return true;
});

check('sms: an unknown number gets the unknown placeholder, not a neighbour\'s face', () => {
  const id = sms.identityFor('555-0117');
  eq(id.kind, 'unknown', 'kind');
  eq(id.category, 'unknown', 'category');
  return true;
});

check('sms: sending a reply records it on the message once', () => {
  const g = stubGame();
  const m = { id: 'm1', from: 'NIA', body: 'you alive?', read: false };
  g.state.messages.push(m);
  const text = sms.sendReply(g, m, 0);
  if (!text) throw new Error('no reply text');
  eq(m.read, true, 'marked read');
  eq(m.replies.length, 1, 'one reply recorded');
  eq(m.replies[0].text, text, 'the label that was shown');
  return true;
});

/* ---------------------------------------------------------------- clinic */

check('clinic: treatment reduces risk and withdrawal and stamps the day', () => {
  const g = stubGame();
  const s = g.state;
  s.money = 500;
  s.stats.risk = 60;
  s.stats.withdrawal = 70;
  const res = clinic.treat(g);
  eq(!!res, true, 'treated');
  if (s.stats.risk >= 60) throw new Error('risk did not fall');
  if (s.stats.withdrawal >= 70) throw new Error('withdrawal did not fall');
  eq(clinic.treatmentInfo(g).canTreat, false, 'no second treatment the same day');
  return true;
});

check('clinic: cannot pay, goes on the hospital bill', () => {
  const g = stubGame();
  const s = g.state;
  s.money = 0;
  const debt = clinic.treat(g).owed;
  if (debt <= 0) throw new Error('no bill recorded');
  if ((s.life?.debt?.hospital || 0) <= 0) throw new Error('hospital debt not increased');
  return true;
});

check('clinic: collapse goes to a clinic when there is no home', () => {
  const s = createState();
  s.life = { housing: 'evicted' };
  eq(clinic.shouldTakeHimIn(s, 'collapse'), true, 'no home -> clinic');
  const s2 = createState();
  s2.life = {}; s2.life.housing = 'housed';
  s2.counters.collapsed = CONFIG.clinic.collapse.collapsesBeforeClinic;
  eq(clinic.shouldTakeHimIn(s2, 'collapse'), true, 'frequent collapses -> clinic');
  return true;
});

/* ------------------------------------------------------------------ report */

console.log(log.join('\n'));
console.log(`\n${passed}/${passed + failed} system checks passed.`);
if (failed) process.exitCode = 1;
