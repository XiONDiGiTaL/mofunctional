/**
 * The police. They walk the park some nights, stand outside the 84th Precinct on Ashby, and roll
 * down Kestrel in a patrol car (streetlife.js). Two things they do to Mo:
 *
 *   break it up   a mugging where a cop can see it ends before it starts: the guy in the hood
 *                 runs, and the cop looks at Mo instead.
 *   search        a cop who sees Mo high stops him and searches him (once a night). Clean, he gets
 *                 told to go home. Holding anything (any substance in his pockets), he is booked:
 *                 every substance confiscated, a $250 fine (or whatever he has), a night in holding,
 *                 and out the front door of the precinct on Ashby Avenue in the morning.
 *
 * Headless; state in `state.police`, created lazily.
 */
import { CONFIG } from '../core/config.js';
import { dayOf, money, pick } from '../core/util.js';
import { bump, logLine, inventoryList, removeItem } from '../core/state.js';

const C = () => CONFIG.police;

export function policeState(s) {
  if (!s.police) s.police = { searchedNight: 0, bookings: 0, warned: 0, fines: 0 };
  return s.police;
}

/** Night key: the night of day N runs from its evening into the next morning. */
const nightOf = (s) => dayOf(s.clock.m - 6 * 60);

export const isHigh = (s) => (s.high?.level || 0) > C().highLine;

export function holding(s) {
  return inventoryList(s).filter((it) => it.def?.kind === 'substance');
}

/** Has a cop already stopped him tonight? */
export const searchedTonight = (s) => policeState(s).searchedNight === nightOf(s);

/**
 * The stop. Returns { booked, items, fine } — the world shows it and, when booked, moves him to
 * the precinct.
 */
export function search(g) {
  const s = g.state;
  const p = policeState(s);
  p.searchedNight = nightOf(s);
  const items = holding(s);
  if (!items.length) {
    p.warned += 1;
    bump(s, 'stress', 8);
    bump(s, 'morale', -4);
    logLine(g, 'Stopped and searched. Clean.', 'info');
    return { booked: false };
  }
  return book(g, items);
}

/** Booked: everything confiscated, the fine (or all he has), a night in holding. */
export function book(g, items = holding(g.state)) {
  const s = g.state;
  const p = policeState(s);
  const took = [];
  for (const it of items) { took.push(`${it.qty}× ${it.def.name}`); removeItem(s, it.id, it.qty); }
  const fine = Math.min(s.money, C().fine);
  if (fine > 0) s.money = Math.round((s.money - fine) * 100) / 100;
  p.bookings += 1;
  p.fines += fine;
  bump(s, 'stress', 18);
  bump(s, 'morale', -14);
  bump(s, 'risk', -10);
  logLine(g, `Booked at the 84th Precinct: ${took.join(', ')} confiscated, fined ${money(fine)}.`, 'bad');
  return { booked: true, items: took, fine };
}

export const COP_LINES = {
  breakup: [
    'A flashlight hits you both. "HEY. HEY!" The guy in the hood is gone before the beam finds his face.',
    'Two cops come round the path at a jog. The guy in the hood remembers he has somewhere to be.',
  ],
  clean: [
    '"Turn around. Hands where I can see them." Pockets out, wallet out, shoes nearly off. Nothing. "Go home. Tonight. Now."',
    'He pats you down like he is mad at your jacket. Nothing. "You look like a problem. Be a problem somewhere else."',
  ],
  booked: [
    'He finds it in about four seconds. "Well, well." The cuffs are colder than you thought they would be.',
    '"What\'s this?" You do not have a good answer. Nobody has ever had a good answer.',
  ],
};
export const copLine = (k) => pick(COP_LINES[k]);
