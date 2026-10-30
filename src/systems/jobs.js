/** Employment, shifts and odd jobs. */
import { CONFIG } from '../core/config.js';
import { dayOf, minuteOfDay, money, clamp } from '../core/util.js';
import { earn, logLine, pushMessage, clock } from '../core/state.js';
import { bump } from '../core/state.js';

const J = CONFIG.job;

export function isShiftDay(s, day = dayOf(s.clock.m)) {
  if (!s.job.employed) return false;
  return s.job.days.includes((day - 1) % 7);
}

export function shiftInfo(g) {
  const s = g.state;
  const day = dayOf(s.clock.m);
  const mod = minuteOfDay(s.clock.m);
  const today = isShiftDay(s, day);
  const start = s.job.shiftStart;
  const end = s.job.shiftEnd;
  const worked = s.job.workedDay === day;
  let state = 'off';
  if (today) {
    if (worked) state = 'done';
    else if (mod < start - 60) state = 'before';
    else if (mod < start + J.lateGraceMinutes) state = 'on-time';
    else if (mod < end - 60) state = 'late';
    else if (mod < end) state = 'almost-over';
    else state = 'missed';
  }
  return {
    today, worked, state, start, end,
    minutesToStart: Math.max(0, start - mod),
    minutesLeft: Math.max(0, end - mod),
    shiftHours: (end - start) / 60,
    late: state === 'late' || state === 'almost-over',
    canClockIn: today && !worked && ['on-time', 'late', 'almost-over'].includes(state),
  };
}

export function workShift(g) {
  const s = g.state;
  const info = shiftInfo(g);
  if (!s.job.employed) { g.toast('You do not work there. Not anymore.', 'bad'); return false; }
  if (!info.canClockIn) {
    if (!info.today) g.toast('Not a shift day. The store does not want you here for free.', 'info');
    else if (info.worked) g.toast('Shift already worked. Go home.', 'info');
    else if (info.state === 'before') g.toast(`Too early. Shift starts at ${fmt(info.start)}.`, 'info');
    else g.toast('You missed the window. The shift is gone.', 'bad');
    g.audio.sfx('deny');
    return false;
  }
  const minutesRemaining = Math.max(30, info.minutesLeft);
  const latePenalty = info.late ? 0.82 : 1;
  const startStats = { energy: s.stats.energy, stress: s.stats.stress };

  g.advance(minutesRemaining, { working: true });
  if (s.ending) return false;

  const gross = (minutesRemaining / 60) * s.job.wage * latePenalty;
  const net = Math.max(0, gross - J.transportCost);
  earn(g, net, `Shift — ${s.job.employer}`);
  s.job.shiftsWorked++;
  s.job.workedDay = dayOf(s.clock.m);
  s.job.strikes = Math.max(0, s.job.strikes - 1);
  s.counters.shifts++;
  bump(s, 'morale', info.late ? -6 : 2);
  bump(s, 'hygiene', -6);
  logLine(g, `Worked a shift at ${s.job.employer}.`, 'good');
  g.audio.sfx('cash');
  g.toast(`Shift complete. +${money(net)}${info.late ? ' (docked for lateness)' : ''}`, 'good');

  if (s.flags.tutorial === 2) { s.flags.tutorial = 3; g.bus.emit('tutorial'); }
  const exhausted = s.stats.energy - startStats.energy < -48;
  if (exhausted) g.toast('You worked the whole shift on fumes. Everything hurts.', 'bad');
  return true;
}

export function callOut(g) {
  const s = g.state;
  const info = shiftInfo(g);
  if (!s.job.employed) return false;
  if (!info.today || info.worked) { g.toast('Nothing to call out of.', 'info'); return false; }
  if (s.job.calledOutDay === dayOf(s.clock.m)) { g.toast('You already called out today.', 'info'); return false; }
  g.advance(10);
  s.job.calledOutDay = dayOf(s.clock.m);
  s.job.strikes++;
  bump(s, 'stress', -4);
  bump(s, 'morale', 2);
  logLine(g, 'Called out of work.', 'info');
  g.toast(`Called out. Strike ${s.job.strikes}/${J.maxStrikes}. Dale sounded tired.`, 'bad');
  g.audio.sfx('phone');
  if (s.job.strikes >= J.maxStrikes) fireJob(g);
  return true;
}

function fireJob(g) {
  const s = g.state;
  if (s.job.fired) return;
  s.job.fired = true;
  s.job.employed = false;
  bump(s, 'stress', 22);
  bump(s, 'morale', -18);
  logLine(g, 'Fired from Quik-Stop.', 'bad');
  g.audio.sfx('bad');
  g.toast('Dale meets you by the mop bucket. You are "not a fit".', 'bad');
  pushMessage(g, {
    from: 'DALE (QUIK-STOP #14)',
    subject: 'Schedule update',
    body: `Effective immediately, you have been removed from the schedule.\n\nPlease return your vest. Please return your badge. Please do not return.\n\n— Dale`,
  });
  s.flags.fired = true;
}

export function missShift(g) {
  const s = g.state;
  if (!s.job.employed) return;
  s.job.strikes++;
  bump(s, 'stress', 10);
  bump(s, 'morale', -8);
  logLine(g, 'Missed a shift.', 'bad');
  g.toast(`You did not show. Strike ${s.job.strikes}/${J.maxStrikes}.`, 'bad');
  pushMessage(g, {
    from: 'DALE (QUIK-STOP #14)',
    subject: 'No call, no show',
    body: `You were scheduled. You were not here.\n\nI covered your shift. I am 54 years old and I covered your shift.\n\nStrike ${s.job.strikes} of ${J.maxStrikes}.`,
  });
  if (s.job.strikes >= J.maxStrikes) fireJob(g);
}

export function quitJob(g) {
  const s = g.state;
  if (!s.job.employed) return false;
  s.job.employed = false;
  s.job.quit = true;
  bump(s, 'stress', -12);
  bump(s, 'morale', -6);
  logLine(g, 'Quit Quik-Stop.', 'info');
  g.toast('You quit. Dale says "okay" before you finish the sentence.', 'info');
  g.audio.sfx('ui-back');
  return true;
}

export function applyForJob(g) {
  const s = g.state;
  if (s.job.employed) { g.toast('You already work there. Sort of.', 'info'); return false; }
  g.advance(35);
  s.job.employed = true;
  s.job.fired = false;
  s.job.quit = false;
  s.job.strikes = 0;
  s.job.lastShiftDay = dayOf(s.clock.m);
  bump(s, 'morale', 8);
  logLine(g, 'Rehired at Quik-Stop #14.', 'good');
  g.toast('Dale sighs and hands you a vest. "Same rate."', 'good');
  g.audio.sfx('confirm');
  return true;
}

export function oddJobsAvailable(g) {
  const s = g.state;
  const day = dayOf(s.clock.m);
  if (!s.oddJobsToday || s.oddJobsToday.day !== day) s.oddJobsToday = { day, ids: [] };
  return CONFIG.oddJobs.filter((job) => !s.oddJobsToday.ids.includes(job.id));
}

export function doOddJob(g, jobId) {
  const s = g.state;
  const job = CONFIG.oddJobs.find((j) => j.id === jobId);
  if (!job) return false;
  if (!s.oddJobsToday || s.oddJobsToday.day !== dayOf(s.clock.m)) s.oddJobsToday = { day: dayOf(s.clock.m), ids: [] };
  if (s.oddJobsToday.ids.includes(job.id)) { g.toast('Already worked that one today.', 'info'); return false; }
  if (s.stats.energy < job.minEnergy) { g.toast('You are too worn out for that. Sleep first.', 'bad'); return false; }
  const mod = minuteOfDay(s.clock.m);
  if (mod >= 22 * 60) { g.toast('Too late — that job closed for the night.', 'info'); return false; }
  g.advance(job.hours * 60, { working: true });
  if (s.ending) return false;
  earn(g, job.pay, job.name);
  bump(s, 'energy', -job.energy);
  bump(s, 'hygiene', -job.hygiene);
  bump(s, 'stress', job.stress);
  bump(s, 'morale', job.morale);
  s.oddJobsToday.ids.push(job.id);
  s.counters.oddJobs++;
  logLine(g, `Odd job: ${job.name}.`, 'good');
  g.toast(`${job.name}: +${money(job.pay)}. Your body files a complaint.`, 'good');
  g.audio.sfx('cash');
  return true;
}

const fmt = (m) => {
  const h = Math.floor(m / 60) % 24;
  const mm = m % 60;
  return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
};

export function onNewDayJob(g, prevDay) {
  const s = g.state;
  if (!s.job.employed) return;
  const worked = s.job.workedDay === prevDay || s.job.lastShiftDay === prevDay;
  const calledOut = s.job.calledOutDay === prevDay;
  if (isShiftDay(s, prevDay) && !worked && !calledOut) {
    missShift(g);
  }
  if (s.job.employed) {
    s.job.calledOut = false;
  }
}
