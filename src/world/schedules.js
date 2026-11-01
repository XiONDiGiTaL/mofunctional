/**
 * Where everyone is, by minute of the day.
 *
 * Each entry is a window [from, to) in minutes and a spot on Kestrel Street. The world walks an
 * NPC to the current window's spot and lets them idle there, so the block has a rhythm: Dale
 * outside the store before opening, Kev on his break, Dex in the alley after dark, the man on
 * the cardboard by the bodega all day, the corner junkie drifting between the alley and the
 * bench, Rae doing the walk-around he calls an inspection.
 */
import { CONFIG } from '../core/config.js';
import { STRANGERS } from '../core/strangers.js';

export const STREET_SCHEDULES = {
  dale: [
    { from: 6 * 60, to: 9 * 60, x: 3.6, z: -4.4, note: 'unlocking the store' },
    { from: 9 * 60, to: 17 * 60, x: 1.4, z: -5.2, note: 'behind the counter' },
    { from: 17 * 60, to: 20 * 60, x: 5.0, z: -4.6, note: 'smoking by the board' },
    { from: 20 * 60, to: 6 * 60, x: 3.6, z: -4.4, note: 'gone home' },
  ],
  kev: [
    { from: 7 * 60, to: 12 * 60, x: -1.2, z: -1.2, note: 'loud, early' },
    { from: 12 * 60, to: 13 * 60, x: 6.6, z: -4.8, note: 'lunch at the bus stop' },
    { from: 13 * 60, to: 19 * 60, x: 1.4, z: -4.2, note: 'working' },
    { from: 19 * 60, to: 23 * 60, x: -6.4, z: -2.6, note: 'drinking a tall boy on the bench' },
    { from: 23 * 60, to: 7 * 60, x: -1.2, z: -1.2, note: 'home' },
  ],
  rae: [
    { from: 8 * 60, to: 10 * 60, x: -11.8, z: -3.6, note: 'doing his rounds' },
    { from: 10 * 60, to: 16 * 60, x: -8.6, z: -3.2, note: 'arguing with a contractor' },
    { from: 16 * 60, to: 22 * 60, x: -11.8, z: -3.6, note: 'watching the building' },
    { from: 22 * 60, to: 8 * 60, x: -12.0, z: -2.4, note: 'inside' },
  ],
  // Dex is only out after dark (his alley trade is 18:00-04:00); by day he is not on the block
  dex: [
    { from: 18 * 60, to: 4 * 60, x: -4.2, z: -4.2, note: 'the alley' },
    { from: 4 * 60, to: 18 * 60, x: -4.2, z: -4.2, note: 'gone', away: true },
  ],
  // Gus lies down only on his cardboard (pose 'sleep'); everywhere else he is on his feet
  homeless: [
    { from: 0, to: 7 * 60, x: -9.5, z: 0.25, note: 'asleep on the cardboard', pose: 'sleep' },
    { from: 7 * 60, to: 9 * 60, x: -13.7, z: -3.6, note: 'waiting outside the bodega' },
    { from: 9 * 60, to: 18 * 60, x: -9.0, z: -1.4, note: 'asking, politely' },
    { from: 18 * 60, to: 22 * 60, x: -12.2, z: -3.0, note: 'sorting cans' },
    { from: 22 * 60, to: 24 * 60, x: -9.5, z: 0.25, note: 'bedding down', pose: 'sleep' },
  ],
  junkie: [
    { from: 0, to: 6 * 60, x: -12.4, z: -4.2, note: 'leaning on the cart' },
    { from: 6 * 60, to: 14 * 60, x: -6.4, z: -2.6, note: 'on the bench' },
    { from: 14 * 60, to: 21 * 60, x: -3.8, z: -3.6, note: 'the alley mouth' },
    { from: 21 * 60, to: 24 * 60, x: -12.4, z: -4.2, note: 'shaking by the cart' },
  ],
};

export const KIND_NOTES = {
  dale: 'Dale · boss', kev: 'Kev · coworker', rae: 'Rae · landlord',
  dex: 'Dex · the corner', homeless: 'A man named Gus', junkie: 'Someone you nod at',
};

/** The current spot for a character, or null if they have no schedule. */
export function scheduleTarget(kind, minuteOfDay) {
  const rows = STREET_SCHEDULES[kind];
  if (!rows) return null;
  for (const row of rows) {
    const wraps = row.from > row.to;
    const inside = wraps ? (minuteOfDay >= row.from || minuteOfDay < row.to) : (minuteOfDay >= row.from && minuteOfDay < row.to);
    if (inside) return row;
  }
  return rows[0];
}

/**
 * Stephanie, Melanie and Diana keep their own days, all over the block: the park, the Quik-Stop,
 * the bodega, Habib's and Kestrel Street itself. Each row names the area and a spot inside it
 * (that area's own coordinates); `away` rows are work, school or sleep, off the map. The world
 * shows a woman only in the area her current row names, and she walks in or out through the
 * door when the row changes while Mo is there.
 */
export const PARTNER_SCHEDULES = {
  // the morning person: a run, a coffee, work in Park Slope, then the bus home
  diana: [
    { from: 7 * 60, to: 8 * 60 + 30, area: 'park', x: -1.0, z: -3.4, note: 'cooling down after a run' },
    { from: 8 * 60 + 30, to: 9 * 60 + 30, area: 'quikstop', x: 2.7, z: -0.4, note: 'coffee, black, standing up' },
    { from: 9 * 60 + 30, to: 17 * 60, away: true, note: 'at work in Park Slope' },
    { from: 17 * 60, to: 19 * 60, area: 'street', x: 7.8, z: -4.2, note: 'off the bus, by the stop' },
    { from: 19 * 60, to: 7 * 60, away: true, note: 'home, early night' },
  ],
  // the teacher: a roll before school, grading in the park, dinner at Habib's
  melanie: [
    { from: 7 * 60, to: 8 * 60, area: 'bodega', x: -0.8, z: -1.2, note: 'a buttered roll before school' },
    { from: 8 * 60, to: 15 * 60, away: true, note: 'teaching' },
    { from: 15 * 60, to: 18 * 60, area: 'park', x: 4.4, z: 3.6, note: 'grading papers by the bench' },
    { from: 18 * 60, to: 20 * 60, area: 'habibs', x: 1.8, z: 0.6, note: 'chicken over rice, extra white sauce' },
    { from: 20 * 60, to: 21 * 60, area: 'street', x: 7.6, z: -2.2, note: 'walking home past the park' },
    { from: 21 * 60, to: 7 * 60, away: true, note: 'home' },
  ],
  // the night owl: up late, out late, no plans
  stephanie: [
    { from: 1 * 60, to: 11 * 60, away: true, note: 'asleep' },
    { from: 11 * 60, to: 14 * 60, area: 'park', x: -4.4, z: 2.6, note: 'on the bench, doing nothing on purpose' },
    { from: 14 * 60, to: 16 * 60, area: 'quikstop', x: -0.5, z: 1.2, note: 'reading magazines she is not buying' },
    { from: 16 * 60, to: 19 * 60, area: 'street', x: -9.0, z: -3.4, note: 'on the 1120 stoop' },
    { from: 19 * 60, to: 21 * 60, area: 'habibs', x: -2.4, z: 0.6, note: 'dinner, if the line is short' },
    { from: 21 * 60, to: 1 * 60, area: 'street', x: -6.8, z: 1.0, note: 'by the bench, people-watching' },
  ],
};

export const PARTNER_AREA_NAMES = {
  street: 'Kestrel St.', park: 'Kestrel Park', quikstop: 'the Quik-Stop', bodega: "Miguel's bodega", habibs: "Habib's",
};

const inWindow = (row, m) => (row.from > row.to ? (m >= row.from || m < row.to) : (m >= row.from && m < row.to));

/** Where one of the three is at a minute of the day: a schedule row (never null for them). */
export function partnerTarget(kind, minuteOfDay) {
  const rows = PARTNER_SCHEDULES[kind];
  if (!rows) return null;
  return rows.find((row) => inWindow(row, minuteOfDay)) || rows[0];
}

/** "Kestrel Park · grading papers by the bench", or "teaching" when she is off the map. */
export function partnerWhereabouts(kind, minuteOfDay) {
  const row = partnerTarget(kind, minuteOfDay);
  if (!row) return '';
  return row.away ? row.note : `${PARTNER_AREA_NAMES[row.area] || row.area} · ${row.note}`;
}

/* ------------------------------------------------------------------ app women, in person */

/**
 * A few of the twenty FeedLove women turn up on the block each day: one at the bus stop, one in
 * the park, one buying coffee. Same for a given day every time (seeded), never on a spot the
 * three use, an hour and a half each, starting between 09:00 and 21:15.
 */
const RUN_IN_SPOTS = {
  street: [[2.8, -2.4, 'waiting for somebody who is late'], [-5.6, -2.0, 'on the payphone to somebody she is mad at'], [11.5, -3.0, 'smoking, looking at nothing'], [4.6, -1.4, 'walking a dog that is walking her']],
  park: [[2.0, -2.2, 'on her phone by the path'], [-3.0, 4.4, 'reading on the grass'], [5.6, 1.0, 'watching the hoops, not the players']],
  quikstop: [[2.6, 1.8, 'reading the back of a cereal box']],
  bodega: [[1.0, -2.0, 'waiting on a sandwich']],
  habibs: [[0.4, 1.8, 'eating standing up']],
};

function seeded(seed) {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

const runInCache = new Map();
/** Today's run-ins: [{ id, area, x, z, note, from, to }] (minutes of the day). */
export function strangerRunIns(day) {
  if (runInCache.has(day)) return runInCache.get(day);
  const r = seeded(day * 7919 + 3);
  const pool = STRANGERS.slice();
  const areas = Object.keys(RUN_IN_SPOTS);
  const used = new Set();
  const out = [];
  const n = CONFIG.dating.runInsPerDay;
  const len = CONFIG.dating.runInMinutes;
  while (out.length < n && pool.length) {
    const w = pool.splice(Math.floor(r() * pool.length), 1)[0];
    const area = areas[Math.floor(r() * areas.length)];
    const spots = RUN_IN_SPOTS[area].filter((_, i) => !used.has(`${area}${i}`));
    if (!spots.length) continue;
    const k = Math.floor(r() * spots.length);
    const [x, z, note] = spots[k];
    used.add(`${area}${RUN_IN_SPOTS[area].indexOf(spots[k])}`);
    const from = 9 * 60 + Math.floor(r() * 50) * 15; // 09:00-21:15, so it never crosses midnight
    out.push({ id: w.id, area, x, z, note, from, to: from + len });
  }
  if (runInCache.size > 8) runInCache.clear();
  runInCache.set(day, out);
  return out;
}

/** Where one of them is right now: a row like a partner's, or { away: true }. */
export function strangerTarget(id, day, minuteOfDay) {
  const hit = strangerRunIns(day).find((x) => x.id === id && minuteOfDay >= x.from && minuteOfDay < x.to);
  return hit || { away: true };
}
