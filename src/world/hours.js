/**
 * When places are open. One table, read by the doors (an "Unavailable: closed" prompt instead of
 * a door that opens onto nobody) and by the map (open now / closed, and when). Hours run past
 * midnight by going over 24 (Habib's closes at 26 = 02:00). Places not listed never close.
 */
import { minuteOfDay, hhmm } from '../core/util.js';

export const HOURS = {
  bodega: [6, 23],
  habibs: [11, 26],
  clinic: [8, 20],
  church: [8, 22],
  restaurant: [12, 23],
  laundromat: [6, 24],
};

const inside = ([a, b], h) => (b > 24 ? h >= a || h < b - 24 : h >= a && h < b);

/** Is `area` open at absolute minute `m`? Unlisted places are always open. */
export function openAt(area, m) {
  const hrs = HOURS[area];
  if (!hrs) return true;
  return inside(hrs, minuteOfDay(m) / 60);
}

/** "06:00–23:00", "24 hours". */
export function hoursLabel(area) {
  const hrs = HOURS[area];
  if (!hrs) return 'open 24 hours';
  return `${hhmm(hrs[0] * 60)}–${hhmm((hrs[1] % 24) * 60)}`;
}

/** For a door's prompt: null when open, otherwise the reason. */
export function closedReason(area, m) {
  if (openAt(area, m)) return null;
  return `Closed · opens ${hhmm(HOURS[area][0] * 60)}`;
}
