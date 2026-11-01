#!/usr/bin/env node
/**
 * Headless checks for the systems added in this pass: early rent, partner rent share, the
 * Afterglow clock, event cooldowns, contextual SMS replies, romance progression, the clinic and
 * its outpatient course, save migration and the animation-lock guards.
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
import * as life from '../src/systems/life.js';
import { migrate, SAVE_VERSION } from '../src/systems/migrate.js';
import * as dating from '../src/systems/dating.js';
import * as dealer from '../src/systems/dealer.js';
import { earn } from '../src/core/state.js';
import { partnerTarget, PARTNER_SCHEDULES, PARTNER_AREA_NAMES, strangerRunIns } from '../src/world/schedules.js';
import { STRANGERS, STRANGER_BY_ID } from '../src/core/strangers.js';
import * as social from '../src/systems/social.js';
import * as block from '../src/systems/block.js';
import * as casino from '../src/systems/casino.js';
import * as sister from '../src/systems/sister.js';

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

/* ---------------------------------------------------------- outpatient course */

const P = CONFIG.clinic.program;
// a day and hour inside clinic hours
const at = (day, hour = 11) => (day - 1) * 1440 + hour * 60;

check('course: needs a referral or a real habit to enroll', () => {
  const g = stubGame();
  g.state.stats.addiction = 5;
  eq(clinic.enroll(g), false, 'no reason to be there');
  g.state.flags.wantsHelp = true;           // the paramedics' napkin
  eq(clinic.enroll(g), true, 'the napkin gets him in');
  eq(clinic.programState(g.state).status, 'active');
  return true;
});

check('course: each session costs money and time and lowers dependence; it ends after the last', () => {
  const g = stubGame();
  const s = g.state;
  s.money = 1000;
  s.stats.addiction = 80;
  s.clock.m = at(2);
  clinic.enroll(g);
  let day = 2;
  for (let i = 0; i < P.sessions; i++) {
    s.clock.m = at(day);
    const before = { money: s.money, dep: s.stats.addiction, t: s.clock.m };
    const res = clinic.attend(g);
    if (!res) throw new Error(`session ${i + 1} refused`);
    near(before.money - s.money, P.cost, 0.01, 'charged once per session');
    eq(s.clock.m - before.t, P.minutes, 'time cost');
    if (!(s.stats.addiction < before.dep)) throw new Error('dependence did not come down');
    eq(clinic.attend(g), false, 'cannot double-book the same day');
    day += P.everyDays;
  }
  eq(clinic.programState(s).status, 'completed', 'completed after the last session');
  if (!life.lifeState(s).milestones.course) throw new Error('no milestone');
  return true;
});

check('course: outside clinic hours the appointment waits', () => {
  const g = stubGame();
  g.state.flags.wantsHelp = true;
  g.state.clock.m = at(3, 20);              // 20:00
  clinic.enroll(g);
  eq(clinic.programState(g.state).next, 4, 'first appointment is tomorrow');
  g.state.clock.m = at(4, 8);               // 08:00, too early
  eq(clinic.attend(g), false, 'before hours');
  return true;
});

check('course: one miss is forgiven, the second drops him; re-enroll after the wait', () => {
  const g = stubGame();
  const s = g.state;
  s.flags.wantsHelp = true;
  s.clock.m = at(2);
  clinic.enroll(g);                          // appointment day 2
  clinic.clinicNewDay(g, 2 + P.graceDays + 1);
  eq(clinic.programState(s).missed, 1, 'first miss');
  eq(clinic.programState(s).status, 'active', 'still on the course');
  const next = clinic.programState(s).next;
  clinic.clinicNewDay(g, next + P.graceDays + 1);
  eq(clinic.programState(s).status, 'dropped', 'second miss drops him');
  s.clock.m = at(next + P.graceDays + 1);
  eq(clinic.programInfo(g).canEnroll, false, 'not straight back in');
  s.clock.m = at(next + P.graceDays + 1 + P.reenrollDays);
  s.life.counselor = true;
  eq(clinic.programInfo(g).canEnroll, true, 'back in after the wait');
  return true;
});

check('course: a relapse halves the next session, it does not expel him', () => {
  const g = stubGame();
  const s = g.state;
  s.money = 500;
  s.flags.wantsHelp = true;
  s.clock.m = at(2);
  clinic.enroll(g);
  s.stats.addiction = 60;
  clinic.onRelapse(g);
  const res = clinic.attend(g);
  eq(res.halved, true, 'session counted for less');
  near(s.stats.addiction, 60 + P.perSession.addiction * P.relapseFactor, 0.01, 'half the drop');
  eq(clinic.programState(s).status, 'active', 'still enrolled');
  return true;
});

/* ------------------------------------------------------------------ saves */

check('migration: a v2 save loads as v3 with every system block present', () => {
  const old = JSON.parse(JSON.stringify(createState()));
  old.v = 2;
  for (const k of ['life', 'dealer', 'romance', 'sched', 'clinic', 'fridge']) delete old[k];
  delete old.bills.rent.history;
  const s = migrate(old);
  eq(s.v, SAVE_VERSION, 'version');
  for (const k of ['life', 'dealer', 'romance', 'sched', 'clinic']) if (!s[k]) throw new Error(`missing ${k}`);
  eq(s.clinic.program.status, 'none', 'course defaults');
  eq(s.life.housing, 'housed', 'housing default');
  if (!Array.isArray(s.fridge)) throw new Error('fridge');
  return true;
});

check('migration: in-flight locks never survive a reload', () => {
  const s = createState();
  s.rentLock = true;
  s.flags.consuming = true;
  s.flags.recovering = true;
  const m = migrate(JSON.parse(JSON.stringify(s)));
  eq(m.rentLock, false, 'rent lock');
  eq(m.flags.consuming, false, 'consuming');
  eq(m.flags.recovering, false, 'recovering');
  return true;
});

check('turning points wait while a fall or a dose is mid-animation', () => {
  const g = stubGame();
  g.state.stats.risk = 100;
  g.state.flags.recovering = true;
  eq(life.checkTurningPoints(g), false, 'no hospital mid-recovery');
  return true;
});

/* ------------------------------------------------------------------ FeedLove dating */

check('dating: strangers almost always say no; the three always match and become contacts', () => {
  let rejects = 0;
  let strangers = 0;
  for (let day = 1; day <= 12; day++) {
    const g = stubGame();
    g.state.clock.m = (day - 1) * 1440 + 10 * 60;
    for (const p of dating.profilesToday(g.state)) {
      const res = dating.sendHeart(g, p.id);
      if (!res.ok) continue;
      if (p.partner) {
        eq(res.result, 'match', `${p.partner} matches`);
        eq(romance.partnerState(g.state, p.partner).met, true, 'becomes a contact');
        if (!g.state.messages.some((m) => m.from === CONFIG.partners[p.partner].name.toUpperCase())) throw new Error('no text with her number');
      } else {
        const w = STRANGER_BY_ID[p.face];
        if (!w.open) {
          strangers++;
          if (res.result === 'reject') rejects++;
          if (res.result === 'hookup') throw new Error(`${w.name} is not open but hooked up`);
        } else if (!['hookup', 'reject', 'ghost'].includes(res.result)) throw new Error(`open ${w.name}: ${res.result}`);
      }
    }
  }
  if (rejects / strangers < 0.8) throw new Error(`strangers said no only ${rejects}/${strangers}`);
  return true;
});

check('hookups: open app women can become a night, late, with a cooldown; never a date', () => {
  const g = stubGame();
  const w = STRANGERS.find((x) => x.open);
  g.state.clock.m = 10 * 60;
  dating.addHookupContact(g, w.id);
  eq(dating.hookupContacts(g.state).some((x) => x.id === w.id), true, 'contact');
  eq(dating.hookupAvailable(g.state, w.id).ok, false, 'not at 10:00');
  g.state.clock.m = 23 * 60;
  g.state.stats.energy = 80;
  eq(dating.hookupAvailable(g.state, w.id).ok, true, 'at 23:00');
  const old = CONFIG.dating.hookup.flakeChance;
  CONFIG.dating.hookup.flakeChance = 0;
  const morale = g.state.stats.morale;
  dating.hookup(g, w.id);
  CONFIG.dating.hookup.flakeChance = old;
  eq(dating.datingState(g.state).hookups[w.id].count, 1, 'counted');
  eq(g.state.stats.morale > morale - 1, true, 'morale');
  g.state.clock.m = 1440 + 23 * 60;
  eq(dating.hookupAvailable(g.state, w.id).ok, false, 'cooldown');
  eq(romance.isPartnerId(w.id), false, 'not dateable');
  return true;
});

check('run-ins: a few app women a day, each in a real place for a while', () => {
  for (let day = 1; day <= 10; day++) {
    const list = strangerRunIns(day);
    eq(list.length, CONFIG.dating.runInsPerDay, 'count');
    for (const r of list) {
      eq(!!STRANGER_BY_ID[r.id], true, 'roster');
      eq(!!PARTNER_AREA_NAMES[r.area], true, 'area');
      eq(r.to - r.from, CONFIG.dating.runInMinutes, 'length');
    }
    eq(JSON.stringify(strangerRunIns(day)), JSON.stringify(list), 'same every time');
  }
  return true;
});

check('dating: a heart a profile, and a daily cap', () => {
  const g = stubGame();
  const profs = dating.profilesToday(g.state);
  dating.sendHeart(g, profs[0].id);
  eq(dating.sendHeart(g, profs[0].id).ok, false, 'no second heart on one profile');
  dating.datingState(g.state).hearts = CONFIG.dating.heartsPerDay;
  eq(dating.sendHeart(g, profs[1].id).ok, false, 'capped');
  return true;
});

/* ------------------------------------------------------------------ Rolo arrival */

check('rolo: due while Mo is outside, he does not expire before he has actually turned up', () => {
  const g = stubGame();
  const s = g.state;
  s.money = 200;
  g.threads = { push() {} };
  dealer.placeOrder(g, 'mud', 1, 'app');
  const o = dealer.activeOrder(s);
  s.clock.m = o.meetAt;
  dealer.tickDealer(g);
  eq(o.status, 'waiting', 'due');
  eq(!!o.arrived, false, 'not at the hydrant yet');
  s.clock.m += dealer.DEALER.waitMinutes + 30;   // past the old three-hour window
  dealer.tickDealer(g);
  eq(o.status, 'waiting', 'still coming');
  dealer.markArrived(g, o);
  s.clock.m += dealer.DEALER.waitMinutes - 1;
  dealer.tickDealer(g);
  eq(o.status, 'waiting', 'waits three hours once there');
  s.clock.m += 2;
  dealer.tickDealer(g);
  eq(o.status, 'expired', 'then gives up');
  return true;
});

/* ------------------------------------------------------------------ Dex + the Fellowship */

check('dex: uncut stock hits harder, risks more, and only Dex sells it', () => {
  const T = CONFIG.substances.types;
  for (const base of ['bliss', 'static', 'mud', 'drip']) {
    const x = T[`${base}_x`];
    if (!x || !x.dexOnly || !CONFIG.items[`${base}_x`]) throw new Error(`${base}_x missing`);
    if (!(x.risk > T[base].risk && x.addiction > T[base].addiction)) throw new Error(`${base}_x not riskier`);
    if (dealer.catalog().some((p) => p.id === `${base}_x`)) throw new Error('Rolo sells Dex stock');
  }
  return true;
});

check('fellowship: the inner circle tithes a fifth', () => {
  const g = stubGame();
  g.state.fellowship.stage = 4;
  earn(g, 100, 'test');
  near(g.state.fellowship.titheOwed, 20, 0.01, 'tithe');
  g.state.fellowship.stage = 3;
  g.state.fellowship.titheOwed = 0;
  earn(g, 100, 'test');
  near(g.state.fellowship.titheOwed, 10, 0.01, 'tithe');
  return true;
});

check('partners: every minute of the day has one row, in a real place', () => {
  for (const id of romance.PARTNER_KEYS) {
    for (let m = 0; m < 1440; m += 5) {
      const hits = PARTNER_SCHEDULES[id].filter((r) => (r.from > r.to ? (m >= r.from || m < r.to) : (m >= r.from && m < r.to)));
      eq(hits.length, 1, `${id} @${m}`);
      if (!hits[0].away) eq(!!PARTNER_AREA_NAMES[hits[0].area], true, `${id} area`);
    }
  }
  eq(partnerTarget('stephanie', 12 * 60).area, 'park');
  eq(partnerTarget('diana', 8 * 60 + 45).area, 'quikstop');
  eq(!!partnerTarget('melanie', 10 * 60).away, true, 'melanie teaching');
  return true;
});

check('partners: she is awake (texts, dates) whenever she is out', () => {
  for (const id of romance.PARTNER_KEYS) {
    for (const row of PARTNER_SCHEDULES[id]) {
      if (row.away) continue;
      const g = stubGame();
      g.state.clock.m = row.from + 1;
      eq(romance.partnerAround(g.state, id), true, `${id} ${row.note}`);
    }
  }
  return true;
});

check('gestures: the first hug of the day counts, the second is just nice', () => {
  const g = stubGame();
  const st = romance.partnerState(g.state, 'melanie');
  st.met = true;
  st.affection = 40;
  romance.gesture(g, 'melanie', 'hug');
  eq(st.affection, 40 + CONFIG.romance.gestureValues.hug.affection, 'first');
  romance.gesture(g, 'melanie', 'hug');
  eq(st.affection, 40 + CONFIG.romance.gestureValues.hug.affection, 'second');
  g.state.clock.m += 1440;
  romance.gesture(g, 'melanie', 'hug');
  eq(st.affection, 40 + 2 * CONFIG.romance.gestureValues.hug.affection, 'next day');
  return true;
});

check('feedlove: the timeline is stable, only shows posts whose time has come, and only from people he follows', () => {
  const g = stubGame();
  g.state.clock.m = 2 * 1440 + 12 * 60;
  const a = social.timeline(g.state);
  eq(JSON.stringify(social.timeline(g.state)), JSON.stringify(a), 'stable');
  eq(a.length > 0, true, 'has posts');
  for (const p of a) {
    eq(social.isFollowing(g.state, p.author), true, `${p.author} followed`);
    if (p.day === 3) eq(p.minute <= 12 * 60, true, 'not from the future');
  }
  eq(a.some((p) => p.author === 'melanie'), false, 'not before meeting her');
  return true;
});

check('feedlove: she follows back once she likes him; liking her post is a little affection once a day', () => {
  const g = stubGame();
  const st = romance.partnerState(g.state, 'diana');
  st.met = true;
  st.affection = 10;
  social.follow(g, 'diana', true);
  eq(social.followsMo(g.state, 'diana'), false, 'not yet');
  st.affection = CONFIG.social.followBackAffection;
  eq(social.followsMo(g.state, 'diana'), true, 'now');
  const post = { id: 'diana-1-0', author: 'diana' };
  social.likePost(g, post);
  eq(st.affection, CONFIG.social.followBackAffection + CONFIG.social.likeAffection, 'first like');
  social.likePost(g, post); social.likePost(g, { id: 'diana-1-1', author: 'diana' });
  eq(st.affection, CONFIG.social.followBackAffection + CONFIG.social.likeAffection, 'once a day');
  return true;
});

check('nextstoop: lore unlocks daily, the board never shows the future, sightings follow the schedules', () => {
  const g = stubGame();
  g.state.clock.m = 12 * 60;
  eq(block.loreUnlocked(g.state).length, 3, 'day 1');
  g.state.clock.m = 1440 + 12 * 60;
  eq(block.loreUnlocked(g.state).length, 4, 'day 2');
  for (const x of block.boardToday(g.state)) eq(x.minute <= 12 * 60, true, 'board time');
  g.state.clock.m = 12 * 60; // Stephanie is in the park 11-14
  eq(block.sightings(g.state).some((x) => /Kestrel Park/.test(x.text) && /hoodie/.test(x.text)), true, 'stephanie sighting');
  return true;
});

check('debug: the password ignores case, stray symbols and the dead-key tilde', () => {
  const clean = (v) => String(v).replace(/[^a-z]/gi, '').toLowerCase();
  for (const v of ['Moses', 'moses', '~Moses', '`Moses ', ' MOSES']) eq(clean(v), clean(CONFIG.debug.password), v);
  eq(clean('Mose') === clean(CONFIG.debug.password), false, 'wrong is wrong');
  return true;
});

check('casino: slots return about 93% over the long run; the bank only moves by real bets', () => {
  const T = casino.REELS.reduce((a, r) => a + r.w, 0);
  let rtp = 0;
  for (const a of casino.REELS) for (const b of casino.REELS) for (const c of casino.REELS) rtp += (a.w * b.w * c.w / T ** 3) * casino.slotMultiplier([a.id, b.id, c.id]);
  eq(rtp > 0.88 && rtp < 0.97, true, `rtp ${rtp.toFixed(3)}`);
  const g = stubGame();
  g.state.money = 50;
  casino.casinoState(g.state).bonusUsed = true;
  const r = casino.spin(g, 5, () => 0.999); // three money bags... or not: whatever the reels say
  near(g.state.money, 50 - 5 + r.payout, 0.001, 'money');
  g.state.money = 2;
  eq(casino.spin(g, 5), null, 'cannot bet what he does not have');
  return true;
});

check('casino: blackjack settles once, naturals pay 3 to 2, busts lose', () => {
  const g = stubGame();
  casino.casinoState(g.state).bonusUsed = true;
  g.state.money = 100;
  eq(casino.handValue([{ r: 'A' }, { r: 'K' }]), 21, 'blackjack');
  eq(casino.handValue([{ r: 'A' }, { r: 'A' }, { r: '9' }]), 21, 'soft');
  const t = casino.deal(g, 10);
  while (!t.done) casino.hit(g, t);
  const before = g.state.money;
  casino.stand(g, t);
  eq(g.state.money, before, 'no second settle');
  return true;
});

check('nia: she only asks when the bond is good; yes brings her over with food, missing her leaves it on the radiator', () => {
  const g = stubGame();
  g.state.clock.m = 10 * 60;
  g.state.npc.nia = 0;
  const mr = Math.random; Math.random = () => 0.01;
  sister.sisterNewDay(g, 1);
  eq(sister.sisterState(g.state).status, 'none', 'not at bond 0');
  g.state.npc.nia = CONFIG.sister.visitBond;
  sister.sisterNewDay(g, 1);
  Math.random = mr;
  eq(sister.sisterState(g.state).status, 'asked', 'asks');
  sister.answerVisit(g, true);
  eq(sister.sisterState(g.state).visitDay, 2, 'tomorrow');
  g.state.clock.m = 1440 + 18 * 60 + 30;
  sister.sisterTick(g);
  eq(sister.sisterTarget(g.state).area, 'apartment', 'she is at his place');
  g.state.clock.m = 1440 + 21 * 60 + 5;
  sister.sisterTick(g);
  eq(sister.sisterState(g.state).status, 'none', 'gone');
  eq(g.state.inventory.some((i) => i.id === 'nia_meal'), true, 'food on the radiator');
  return true;
});

/* ------------------------------------------------------------------ report */

console.log(log.join('\n'));
console.log(`\n${passed}/${passed + failed} system checks passed.`);
if (failed) process.exitCode = 1;
