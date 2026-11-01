/**
 * One scheduler for everything that happens "occasionally".
 *
 * Random life events, family calls, street encounters and relationship invitations all go
 * through here so that frequency is set in one place instead of being re-invented per system.
 *
 * An event is a plain object:
 *
 *   {
 *     id: 'nia_call',
 *     weight: 7,                 // relative chance when it is eligible
 *     cooldownHours: 40,         // minimum gap between two of THIS event
 *     minGapHours: 0,            // extra minimum gap from the last event of any kind
 *     window: [8*60, 21*60],     // optional time-of-day window (minutes, may wrap)
 *     where: ['street'],         // optional area restriction
 *     when: (s) => bool,         // optional player-state requirement
 *     once: false,               // fire at most once per run
 *     maxPerDay: 1,              // cap for this event per in-game day
 *     run: (g) => void,
 *   }
 *
 * The history is saved with the run (`state.sched.log`), so cooldowns survive a save/load and
 * reloading a save cannot farm an event. The log is capped; nothing grows without bound.
 */
import { CONFIG } from '../core/config.js';
import { dayOf, minuteOfDay, chance } from '../core/util.js';

const LOG_LIMIT = 140;

export function schedulerState(s) {
  if (!s.sched) s.sched = { log: [], lastAt: -9999, day: 1, today: 0, counts: {} };
  const d = s.sched;
  d.log = d.log || [];
  d.counts = d.counts || {};
  if (typeof d.lastAt !== 'number') d.lastAt = -9999;
  return d;
}

/** The most recent time this event fired, or -Infinity. */
export function lastFired(s, id) {
  const d = schedulerState(s);
  for (let i = d.log.length - 1; i >= 0; i--) if (d.log[i].id === id) return d.log[i].at;
  return -Infinity;
}

export const minutesSince = (s, id) => s.clock.m - lastFired(s, id);

/** Minutes until this event may fire again (0 when it is available now). */
export function cooldownLeft(s, ev) {
  const hours = ev.cooldownHours ?? 18;
  if (!hours) return 0;
  const since = minutesSince(s, ev.id);
  return Math.max(0, Math.round(hours * 60 - since));
}

function inWindow(win, mod) {
  if (!win) return true;
  const [from, to] = win;
  return from <= to ? mod >= from && mod < to : mod >= from || mod < to;
}

/** Everything an event can require, in one test. */
export function isEligible(g, ev) {
  const s = g.state;
  const d = schedulerState(s);
  if (!ev || typeof ev.run !== 'function') return false;
  if (ev.where && ev.where.length) {
    const area = g.world?.areaId;
    if (!area || !ev.where.includes(area)) return false;
  }
  if (!inWindow(ev.window, minuteOfDay(s.clock.m))) return false;
  if (ev.when) {
    try { if (!ev.when(s)) return false; } catch { return false; }
  }
  if (ev.once && d.log.some((e) => e.id === ev.id)) return false;
  if (cooldownLeft(s, ev) > 0) return false;
  const day = dayOf(s.clock.m);
  if (ev.maxPerDay) {
    const key = `${ev.id}|${day}`;
    if ((d.counts[key] || 0) >= ev.maxPerDay) return false;
  }
  if (ev.minGapHours && s.clock.m - d.lastAt < ev.minGapHours * 60) return false;
  return true;
}

/** Record it and run it (on the next tick, so the frame that rolled it can finish). */
export function fire(g, ev) {
  const s = g.state;
  const d = schedulerState(s);
  const at = s.clock.m;
  const day = dayOf(at);
  d.log.push({ id: ev.id, at, day, cat: ev.cat || 'event' });
  if (d.log.length > LOG_LIMIT) d.log.splice(0, d.log.length - LOG_LIMIT);
  d.lastAt = at;
  if (d.day !== day) { d.day = day; d.today = 0; }
  d.today = (d.today || 0) + 1;
  const key = `${ev.id}|${day}`;
  d.counts[key] = (d.counts[key] || 0) + 1;
  // trim the day counters so a long run does not accumulate a key per event per day
  const keys = Object.keys(d.counts);
  if (keys.length > 200) for (const k of keys.slice(0, keys.length - 200)) delete d.counts[k];
  g.audio?.sfx?.('event');
  setTimeout(() => {
    try { ev.run(g); } catch (e) { console.error('[scheduler]', ev.id, e); }
  }, 60);
  return ev;
}

/**
 * The rolling chance. `hours` is how much game time just passed (simulate() calls this in
 * ten-minute steps), so the per-hour rate is scaled to the step rather than rolled per tick —
 * otherwise a fast-forward would multiply the number of events.
 */
export function roll(g, hours, events, opts = {}) {
  const s = g.state;
  const cfg = CONFIG.events;
  const d = schedulerState(s);
  const day = dayOf(s.clock.m);
  if (d.day !== day) { d.day = day; d.today = 0; }
  if ((d.today || 0) >= (opts.maxPerDay ?? cfg.maxPerDay)) return null;
  if (s.clock.m - d.lastAt < (opts.minMinutesBetween ?? cfg.minMinutesBetween)) return null;
  if (g.modalOpen || g.phoneOpen) return null;
  const p = (opts.chancePerHour ?? cfg.chancePerHour) * Math.max(0.15, hours);
  if (!chance(p)) return null;
  const pool = events.filter((ev) => isEligible(g, ev));
  if (!pool.length) return null;
  const total = pool.reduce((n, ev) => n + Math.max(0.01, ev.weight ?? 1), 0);
  let ticket = Math.random() * total;
  let chosen = pool[pool.length - 1];
  for (const ev of pool) {
    ticket -= Math.max(0.01, ev.weight ?? 1);
    if (ticket <= 0) { chosen = ev; break; }
  }
  return fire(g, chosen);
}

/** Fire one by id, ignoring the dice (the debug menu uses this). */
export function trigger(g, id, events) {
  const ev = events.find((e) => e.id === id);
  if (!ev) return null;
  return fire(g, ev);
}

/** Debug: forget every cooldown, so events can be tested in a row. */
export function clearCooldowns(g) {
  const d = schedulerState(g.state);
  d.log = [];
  d.counts = {};
  d.lastAt = -9999;
  d.today = 0;
}

/** The last few things that happened, newest first, for the debug panel and the devlog. */
export function recent(s, n = 6) {
  const d = schedulerState(s);
  return d.log.slice(-n).reverse();
}
