/**
 * Today: what matters before the day runs out, in one short list.
 *
 *   rent      when it is due and how much (overdue in red)
 *   shift     today's shift at Quik-Stop #14: when to be there, late, done, or no job
 *   bills     power and phone, when they are due soon or overdue
 *   odd jobs  what is on the board today (they are gone tomorrow)
 *   the rest  the clinic session, Rolo outside, a HailMary car at the curb, Nia coming over,
 *             the Fellowship on Sunday morning
 *   goals     the player's own pinned goals (state.goals, edited in iDread)
 *
 * Every row carries an action: open a phone app, or put a destination on the map. Nothing here
 * does anything for him; it only says what is coming and where it is.
 */
import { CONFIG } from '../core/config.js';
import { dayOf, minuteOfDay, hhmm, money } from '../core/util.js';
import { billInfo } from '../systems/economy.js';
import { shiftInfo, oddJobsAvailable } from '../systems/jobs.js';
import { tr } from '../i18n/i18n.js';
import { serviceWindow } from '../systems/fellowship.js';
import * as clinic from '../systems/clinic.js';
import * as dealer from '../systems/dealer.js';
import * as rides from '../systems/rides.js';
import * as sister from '../systems/sister.js';

export function goals(s) {
  if (!Array.isArray(s.goals)) s.goals = [];
  return s.goals;
}

const inDays = (d) => (d <= 0 ? 'today' : d === 1 ? 'tomorrow' : `in ${d} days`);

/** The list, most urgent first. Each: { id, icon, text, sub, level: 'urgent'|'soon'|'info', act } */
export function todayItems(g) {
  const s = g.state;
  const day = dayOf(s.clock.m);
  const mod = minuteOfDay(s.clock.m);
  const out = [];

  // rent
  const rent = billInfo(g, 'rent');
  if (rent.owedCycles > 0) out.push({ id: 'rent', icon: '⌂', text: `Rent overdue · ${money(rent.owed)}`, sub: 'Shale Pay or Landlordly', level: 'urgent', act: { phone: 'bank' } });
  else out.push({ id: 'rent', icon: '⌂', text: `Rent ${money(rent.perCycle ?? rent.base)} due ${inDays(rent.nextDueDay - day)}`, sub: `Day ${rent.nextDueDay}`, level: rent.nextDueDay - day <= 1 ? 'soon' : 'info', act: { phone: 'bank' } });

  // the shift
  if (!s.job?.employed) out.push({ id: 'shift', icon: '▣', text: 'No job', sub: 'ask Dale, the board, or LinkedOut', level: 'info', act: { map: 'quikstop' } });
  else {
    const sh = shiftInfo(g);
    if (sh.today && !sh.worked) {
      const label = sh.state === 'before' || sh.state === 'on-time' ? `Shift ${hhmm(sh.start)}–${hhmm(sh.end)} · be there by ${hhmm(sh.start + CONFIG.job.lateGraceMinutes)}`
        : sh.state === 'missed' ? 'Shift missed' : `Shift started ${hhmm(sh.start)} · you are late`;
      out.push({ id: 'shift', icon: '▣', text: label, sub: 'Quik-Stop #14 · the staff door', level: sh.state === 'before' ? (sh.minutesToStart < 90 ? 'soon' : 'info') : 'urgent', act: { map: 'quikstop' } });
    } else if (sh.worked) out.push({ id: 'shift', icon: '▣', text: 'Shift done', sub: 'paid', level: 'done', act: null });
    else out.push({ id: 'shift', icon: '▣', text: 'No shift today', sub: '', level: 'info', act: null });
  }

  // the other bills
  for (const key of ['power', 'phone']) {
    const b = billInfo(g, key);
    if (b.owedCycles > 0) out.push({ id: key, icon: '$', text: `${b.name} overdue · ${money(b.owed)}`, sub: 'pay in Shale Pay', level: 'urgent', act: { phone: 'bank' } });
    else if (b.nextDueDay - day <= 2) out.push({ id: key, icon: '$', text: `${b.name} ${money(b.base)} due ${inDays(b.nextDueDay - day)}`, sub: '', level: 'soon', act: { phone: 'bank' } });
  }

  // things with a time on them
  const prog = clinic.programInfo(g);
  if (prog.dueToday) out.push({ id: 'clinic', icon: '+', text: `Clinic session today · ${hhmm(prog.window[0])}–${hhmm(prog.window[1])}`, sub: `Kestrel Clinic · ${prog.minutes} min`, level: prog.inHours ? 'soon' : 'info', act: { map: 'clinic' } });
  const o = dealer.activeOrder(s);
  if (o) out.push({ id: 'rolo', icon: '●', text: o.status === 'waiting' ? (o.arrived ? `Rolo is outside · until ${hhmm(o.expiresAt)}` : 'Rolo is close · go in, come back out') : `Rolo · due ${hhmm(o.meetAt)}`, sub: 'the hydrant by 1120', level: o.status === 'waiting' ? 'soon' : 'info', act: { map: 'apartment' } });
  const ride = rides.rideState(s);
  if (ride.status === 'waiting') out.push({ id: 'ride', icon: '◆', text: `Your HailMary car is at the curb · until ${hhmm(ride.leaveAt)}`, sub: ride.area === 'avenue' ? 'Ashby Avenue' : 'Kestrel St.', level: 'soon', act: { phone: 'ride' } });
  else if (ride.status === 'coming') out.push({ id: 'ride', icon: '◆', text: `HailMary arriving ${hhmm(ride.arriveAt)}`, sub: '', level: 'info', act: { phone: 'ride' } });
  const sis = sister.sisterState(s);
  if ((sis.status === 'coming' || sis.status === 'here') && sis.visitDay === day) out.push({ id: 'nia', icon: '♥', text: sis.status === 'here' ? 'Nia is at your place' : `Nia comes over ${hhmm(CONFIG.sister.visit.fromHour * 60)}–${hhmm(CONFIG.sister.visit.toHour * 60)}`, sub: 'be home · she is bringing food', level: 'soon', act: { map: 'apartment' } });
  else if (sis.status === 'coming') out.push({ id: 'nia', icon: '♥', text: `Nia comes over tomorrow, ${hhmm(CONFIG.sister.visit.fromHour * 60)}`, sub: '', level: 'info', act: null });
  const svc = serviceWindow(g);
  if (svc.isSunday && svc.startsIn !== null && (svc.startsIn > 0 || svc.inWindow)) out.push({ id: 'service', icon: '✝', text: svc.inWindow ? 'Fellowship service now' : `Fellowship service ${hhmm(CONFIG.fellowship.serviceStart)}`, sub: 'The Golden Fellowship', level: 'info', act: { map: 'church' } });

  // the board
  const jobs = oddJobsAvailable(g);
  if (jobs.length) out.push({ id: 'odd', icon: '☰', text: `${jobs.length} odd job${jobs.length === 1 ? '' : 's'} on the board · today only`, sub: jobs.map((j) => `${tr(j.name).split(' —')[0]} $${j.pay}`).join(' · '), level: 'info', act: { map: 'board' } });

  // his own
  for (const goal of goals(s)) if (!goal.done) out.push({ id: `goal_${goal.id}`, icon: '★', text: goal.text, sub: 'your goal', level: 'goal', act: { phone: 'calendar' } });

  const rank = { urgent: 0, soon: 1, goal: 2, info: 3, done: 4 };
  return out.sort((a, b) => rank[a.level] - rank[b.level]);
}

/**
 * What would be missed by letting `minutes` go by from now (sleeping, a long action): the shift,
 * the clinic session, Rolo, the car, Nia. Used to warn before committing.
 */
export function wouldMiss(g, minutes) {
  const s = g.state;
  const now = s.clock.m;
  const end = now + minutes;
  const day = dayOf(now);
  const out = [];
  if (s.job?.employed) {
    const sh = shiftInfo(g);
    const startAbs = (day - 1) * 1440 + sh.start;
    if (sh.today && !sh.worked && startAbs + CONFIG.job.lateGraceMinutes > now && startAbs < end) out.push(`your shift at ${hhmm(sh.start)}`);
    // tomorrow's shift, for a long sleep
    const tomorrowStart = day * 1440 + sh.start;
    if (tomorrowStart < end && tomorrowStart > now) out.push(`tomorrow's shift at ${hhmm(sh.start)}`);
  }
  const prog = clinic.programInfo(g);
  if (prog.dueToday) {
    const closeAbs = (day - 1) * 1440 + prog.window[1];
    if (closeAbs > now && closeAbs < end) out.push(`the clinic session (closes ${hhmm(prog.window[1])})`);
  }
  const o = dealer.activeOrder(s);
  if (o?.status === 'waiting' && o.expiresAt < end) out.push('Rolo, who will not wait');
  const ride = rides.rideState(s);
  if (ride.status !== 'none' && (ride.leaveAt || ride.arriveAt + CONFIG.rides.waitMinutes) < end) out.push('your HailMary car');
  const sis = sister.sisterState(s);
  if ((sis.status === 'coming' || sis.status === 'here')) {
    const visitEnd = (sis.visitDay - 1) * 1440 + CONFIG.sister.visit.toHour * 60;
    const visitStart = (sis.visitDay - 1) * 1440 + CONFIG.sister.visit.fromHour * 60;
    if (visitStart < end && visitEnd > now && g.world?.areaId !== 'apartment') out.push("Nia's visit");
  }
  return out;
}

/**
 * Sleep, but say first what it would cost: if `hours` would run through the shift, the clinic,
 * Rolo, the car or Nia, ask. Otherwise just sleep.
 */
export function confirmSleep(g, hours, doSleep) {
  const miss = wouldMiss(g, hours * 60);
  if (!miss.length) { doSleep(); return; }
  g.openModal({
    kicker: 'BEFORE YOU SLEEP', title: 'You Would Miss Something',
    body: `Sleeping ${hours} hours from ${hhmm(g.state.clock.m)} runs to ${hhmm(g.state.clock.m + hours * 60)}. You would miss ${miss.join(', ')}.`,
    choices: [
      { label: `Sleep ${hours} hours anyway.`, sub: 'it will still be there, or it will not', effect: () => doSleep() },
      { label: 'Stay up.', sub: '', effect: () => {} },
    ],
  });
}

/** Pin, finish or drop a goal. */
export function addGoal(s, text) {
  const t = String(text || '').replace(/\s+/g, ' ').trim().slice(0, 60);
  if (!t) return false;
  const list = goals(s);
  if (list.filter((x) => !x.done).length >= 6) return false;
  list.push({ id: Date.now().toString(36) + Math.floor(Math.random() * 1e4), text: t, done: false });
  return true;
}
