/**
 * Kestrel Clinic: the actual building, its one nurse, and what recovery costs.
 *
 * This is the place the phone has been promising since the paramedics wrote a number on a
 * napkin. It is a real interior on Kestrel Street (world/areas.js → buildClinic), it is drawn on
 * the map because it is in world/plan.js like every other door, and everything it does goes
 * through this module so the phone, the collapse sequence and the room agree.
 *
 * Money: a treatment is paid in cash when Mo can; when he cannot, the fee is added to the
 * hospital debt that life.js already tracks and grows at 1%/day. It is never free and it is
 * never silently duplicated: each visit is stamped with the in-game minute.
 */
import { CONFIG } from '../core/config.js';
import { money, dayOf } from '../core/util.js';
import { bump, logLine, pushMessage } from '../core/state.js';
import * as life from './life.js';

const C = CONFIG.clinic;

export function clinicState(s) {
  if (!s.clinic) s.clinic = { visits: 0, lastVisitDay: 0, lastTreatAt: -99999, treatments: 0 };
  const c = s.clinic;
  c.visits = Number(c.visits) || 0;
  c.treatments = Number(c.treatments) || 0;
  c.lastTreatAt = Number(c.lastTreatAt) || -99999;
  return c;
}

/** What the nurse would do for him right now, and what it costs. */
export function treatmentInfo(g) {
  const s = g.state;
  const c = clinicState(s);
  const t = C.treatment;
  const needsIt = s.stats.risk > 18 || s.stats.withdrawal > 18 || s.stats.addiction > 30;
  const sameDay = dayOf(s.clock.m) === c.lastVisitDay && c.treatments > 0 && s.clock.m - c.lastTreatAt < 720;
  return {
    ...t,
    affordable: s.money >= t.cost,
    needsIt,
    alreadyToday: sameDay,
    canTreat: !sameDay,
    owed: !s.money || s.money < t.cost,
  };
}

/**
 * The treatment: an hour and a half, a blood-pressure cuff, a blood draw, a lecture that is
 * mostly kindness, and a real reduction in risk and withdrawal — not a reset to perfect.
 */
export function treat(g) {
  const s = g.state;
  const c = clinicState(s);
  const info = treatmentInfo(g);
  if (!info.canTreat) {
    g.toast(`${C.nurse} says come back tomorrow. She wrote it down.`, 'info');
    return false;
  }
  const cost = C.treatment.cost;
  let paid = 0;
  if (s.money >= cost) {
    g.spendMoney(cost, `${C.name} — treatment`);
    paid = cost;
  } else {
    // no cash: it goes on the bill that already finds him
    life.lifeState(s).debt.hospital = Math.round((life.lifeState(s).debt.hospital || 0) + cost);
    g.toast(`You cannot pay. It goes on the hospital bill (${money(cost)}).`, 'bad');
  }
  g.advance(C.treatment.minutes, { noCollapse: true });
  s.stats.risk = Math.max(0, s.stats.risk + C.treatment.risk);
  s.stats.withdrawal = Math.max(0, s.stats.withdrawal + C.treatment.withdrawal);
  s.stats.addiction = Math.max(0, s.stats.addiction + C.treatment.addiction);
  bump(s, 'morale', C.treatment.morale);
  bump(s, 'stress', C.treatment.stress);
  s.clinic.lastVisitDay = dayOf(s.clock.m);
  s.clinic.lastTreatAt = s.clock.m;
  s.clinic.treatments += 1;
  s.clinic.visits += 1;
  life.lifeState(s).counselor = true;
  logLine(g, `Treated at ${C.name}${paid ? ` (${money(paid)})` : ' (billed)'}.`, paid ? 'good' : 'info');
  g.audio.sfx('confirm');
  pushMessage(g, {
    from: 'KESTREL CLINIC',
    subject: 'After your visit',
    body: `${'You did the thing where you sat in a plastic chair and told the truth to a stranger with a clipboard.'}\n\nThe daily check-in line is open. One text a day does more than it sounds like it does.\n\n— ${C.nurse}`,
  });
  return { paid, owed: cost - paid };
}

/** The daily check-in, shared with the Txtr thread. Delegates to life.clinicCheckIn(). */
export function checkIn(g) {
  const ok = life.clinicCheckIn(g);
  if (ok) {
    const s = g.state;
    s.stats.risk = Math.max(0, s.stats.risk + C.checkIn.risk);
    clinicState(s).visits += 0; // a text is not a visit
    g.audio.sfx('phone');
  }
  return ok;
}

/**
 * The collapse route: he wakes up here instead of at home. Used by the collapse sequence when
 * the dice say the clinic, or when he has collapsed enough times that somebody calls it in.
 * Bil/recovery only — the falling, fading and travel are the world's job.
 */
export function recoverHere(g, { cause = 'collapse', free = false } = {}) {
  const s = g.state;
  const c = clinicState(s);
  c.visits += 1;
  c.lastVisitDay = dayOf(s.clock.m);
  s.counters.clinicRecoveries = (s.counters.clinicRecoveries || 0) + 1;
  let fee = 0;
  if (!free) {
    const cost = cause === 'overdose' ? C.treatment.cost * 2 : C.treatment.cost;
    if (s.money >= cost) {
      g.spendMoney(cost, `${C.name} — recovery`);
      fee = cost;
    } else {
      life.lifeState(s).debt.hospital = Math.round((life.lifeState(s).debt.hospital || 0) + cost);
      fee = -cost; // negative means it went on the bill
    }
  }
  s.stats.risk = Math.max(0, s.stats.risk - 26);
  s.stats.withdrawal = Math.max(0, s.stats.withdrawal - 45);
  s.stats.addiction = Math.max(0, s.stats.addiction - (cause === 'overdose' ? 6 : 2));
  s.stats.energy = Math.max(s.stats.energy, 52);
  s.stats.hunger = Math.max(s.stats.hunger, 48);
  s.stats.hygiene = Math.max(s.stats.hygiene, 55);
  s.stats.stress = Math.max(0, s.stats.stress - 18);
  bump(s, 'morale', cause === 'overdose' ? -8 : -3);
  life.lifeState(s).counselor = true;
  logLine(g, `Came round at ${C.name}.`, 'bad');
  return { fee, nurse: C.nurse };
}

/** Should this collapse go to the clinic rather than home? */
export function shouldTakeHimIn(s, cause = 'collapse') {
  if (!life.isHoused(s)) return true;              // no bed to send him to
  if (cause === 'overdose') return true;
  if (cause === 'beaten') return true;   // somebody called it in
  if ((s.counters.collapsed || 0) >= C.collapse.collapsesBeforeClinic) return true;
  return Math.random() < C.collapse.chance;
}

/* ------------------------------------------------------------------ the outpatient course */

const P = C.program;

/** The course's state, created on first use so old saves load without it. */
export function programState(s) {
  const c = clinicState(s);
  if (!c.program) c.program = { status: 'none', enrolledDay: 0, next: 0, done: 0, missed: 0, relapses: 0, relapsePending: false, endedDay: 0 };
  return c.program;
}

/** Where Mo stands with the course, as the clinic, the phone and the calendar all read it. */
export function programInfo(g) {
  const s = g.state;
  const p = programState(s);
  const day = dayOf(s.clock.m);
  const mod = ((s.clock.m % 1440) + 1440) % 1440;
  const inHours = mod >= P.window[0] && mod < P.window[1];
  const referred = !!(life.lifeState(s).counselor || s.flags.wantsHelp);
  const eligible = referred || s.stats.addiction >= P.eligibleDependence;
  // a check-in after a setback brings him back sooner: from where he is, not from zero (recovery.js)
  const waitUntil = p.status === 'dropped' && !s.flags.returnEarly ? p.endedDay + P.reenrollDays : 0;
  return {
    ...p,
    sessions: P.sessions,
    cost: P.cost,
    minutes: P.minutes,
    window: P.window,
    day,
    inHours,
    eligible,
    canEnroll: (p.status === 'none' || p.status === 'completed' || (p.status === 'dropped' && day >= waitUntil)) && eligible,
    waitUntil,
    dueToday: p.status === 'active' && day >= p.next,
    canAttend: p.status === 'active' && day >= p.next && inHours,
  };
}

/** Sign up. The first appointment is today if it is still clinic hours, otherwise tomorrow. */
export function enroll(g) {
  const s = g.state;
  const info = programInfo(g);
  if (!info.canEnroll) {
    if (!info.eligible) g.toast(`${C.nurse}: "Come back when you mean it. Or when someone sends you."`, 'info');
    else if (info.status === 'active') g.toast('You are already on the course.', 'info');
    else g.toast(`${C.nurse}: "Day ${info.waitUntil}. Not before."`, 'info');
    return false;
  }
  const p = programState(s);
  Object.assign(p, {
    status: 'active', enrolledDay: info.day, next: info.inHours ? info.day : info.day + 1,
    done: 0, missed: 0, relapses: 0, relapsePending: false, endedDay: 0,
  });
  life.lifeState(s).counselor = true;
  s.flags.wantsHelp = false;
  s.flags.returnEarly = false;
  logLine(g, 'Enrolled in the Kestrel Clinic outpatient course.', 'good');
  pushMessage(g, {
    from: 'KESTREL CLINIC',
    subject: 'Your course',
    body: `${P.sessions} appointments, every ${P.everyDays} days, between ${hm(P.window[0])} and ${hm(P.window[1])}. ${money(P.cost)} each, or on the bill. First one: day ${p.next}.

Miss one and I will call you. Miss two and I will stop calling.

— ${C.nurse}`,
  });
  return true;
}

/**
 * One appointment. Two hours of a plastic chair and honesty; dependence actually comes down.
 * Stamped by day, so it can only happen once per appointment.
 */
export function attend(g) {
  const s = g.state;
  const info = programInfo(g);
  if (info.status !== 'active') return false;
  if (!info.dueToday) { g.toast(`Your next appointment is day ${info.next}.`, 'info'); return false; }
  if (!info.inHours) { g.toast(`Appointments are ${hm(P.window[0])}-${hm(P.window[1])}.`, 'info'); return false; }
  const p = programState(s);
  if (s.money >= P.cost) g.spendMoney(P.cost, `${C.name} — course session`);
  else {
    const l = life.lifeState(s);
    l.debt.hospital = Math.round((l.debt.hospital || 0) + P.cost);
    g.toast(`No cash. ${money(P.cost)} goes on the bill.`, 'bad');
  }
  g.advance(P.minutes, { noCollapse: true });
  const k = p.relapsePending ? P.relapseFactor : 1;
  const e = P.perSession;
  s.stats.addiction = Math.max(0, s.stats.addiction + e.addiction * k);
  s.stats.withdrawal = Math.max(0, s.stats.withdrawal + e.withdrawal * k);
  s.stats.risk = Math.max(0, s.stats.risk + e.risk * k);
  bump(s, 'stress', e.stress);
  bump(s, 'morale', e.morale);
  p.relapsePending = false;
  p.done += 1;
  p.next = dayOf(s.clock.m) + P.everyDays;
  const c = clinicState(s);
  c.visits += 1;
  c.lastVisitDay = dayOf(s.clock.m);
  g.audio?.sfx?.('confirm');
  if (p.done >= P.sessions) {
    p.status = 'completed';
    p.endedDay = dayOf(s.clock.m);
    const done = P.completion;
    s.stats.addiction = Math.max(0, s.stats.addiction + done.addiction);
    s.stats.tolerance = Math.max(0, s.stats.tolerance + done.tolerance);
    bump(s, 'morale', done.morale);
    bump(s, 'stress', done.stress);
    life.lifeState(s).milestones.course = p.endedDay;
    logLine(g, 'Finished the outpatient course.', 'good');
    g.toast('Milestone — finished the course. Okafor shakes your hand like she means it.', 'good');
  } else {
    logLine(g, `Course session ${p.done} of ${P.sessions}.`, 'good');
  }
  return { done: p.done, sessions: P.sessions, completed: p.status === 'completed', halved: k < 1 };
}

/** Using while on the course: it does not throw him out, it costs him the next session's worth. */
export function onRelapse(g) {
  const p = programState(g.state);
  if (p.status !== 'active') return;
  p.relapses += 1;
  p.relapsePending = true;
}

/** New day: an appointment that slid past its grace day is a miss; two misses end the course. */
export function clinicNewDay(g, day) {
  const s = g.state;
  const p = programState(s);
  if (p.status !== 'active') return;
  if (day <= p.next + P.graceDays) return;
  p.missed += 1;
  if (p.missed > P.missAllowance) {
    p.status = 'dropped';
    p.endedDay = day;
    logLine(g, 'Dropped from the outpatient course.', 'bad');
    pushMessage(g, {
      from: 'KESTREL CLINIC',
      subject: 'Your course',
      body: `Two missed. I have closed the file, not the door. Day ${day + P.reenrollDays}, if you want to start again.

— ${C.nurse}`,
    });
    return;
  }
  p.next = day;
  pushMessage(g, {
    from: 'KESTREL CLINIC',
    subject: 'You missed your appointment',
    body: `You were on my list and you were not in my chair. Come in today, ${hm(P.window[0])}-${hm(P.window[1])}. That is the one I forgive.

— ${C.nurse}`,
  });
}

const hm = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

export const clinicName = C.name;
export const nurseName = C.nurse;
