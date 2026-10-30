/**
 * Where everyone is, by minute of the day.
 *
 * Each entry is a window [from, to) in minutes and a spot on Kestrel Street. The world walks an
 * NPC to the current window's spot and lets them idle there, so the block has a rhythm: Dale
 * outside the store before opening, Kev on his break, Dex in the alley after dark, the man on
 * the cardboard by the bodega all day, the corner junkie drifting between the alley and the
 * bench, Rae doing the walk-around she calls an inspection.
 */

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
    { from: 8 * 60, to: 10 * 60, x: -10.2, z: -4.6, note: 'doing her rounds' },
    { from: 10 * 60, to: 16 * 60, x: -8.6, z: -3.2, note: 'arguing with a contractor' },
    { from: 16 * 60, to: 22 * 60, x: -10.2, z: -4.6, note: 'watching the building' },
    { from: 22 * 60, to: 8 * 60, x: -14.4, z: -4.8, note: 'inside' },
  ],
  dex: [
    { from: 20 * 60, to: 4 * 60, x: -4.2, z: -4.2, note: 'the alley' },
    { from: 4 * 60, to: 20 * 60, x: -3.4, z: -3.4, note: 'gone' },
  ],
  homeless: [
    { from: 0, to: 7 * 60, x: -9.6, z: 0.4, note: 'asleep on the cardboard' },
    { from: 7 * 60, to: 9 * 60, x: -13.4, z: -4.6, note: 'waiting outside the bodega' },
    { from: 9 * 60, to: 18 * 60, x: -9.0, z: -1.4, note: 'asking, politely' },
    { from: 18 * 60, to: 22 * 60, x: -12.2, z: -3.0, note: 'sorting cans' },
    { from: 22 * 60, to: 24 * 60, x: -9.6, z: 0.4, note: 'bedding down' },
  ],
  junkie: [
    { from: 0, to: 6 * 60, x: -11.6, z: -4.4, note: 'leaning on the cart' },
    { from: 6 * 60, to: 14 * 60, x: -6.4, z: -2.6, note: 'on the bench' },
    { from: 14 * 60, to: 21 * 60, x: -3.8, z: -3.6, note: 'the alley mouth' },
    { from: 21 * 60, to: 24 * 60, x: -11.6, z: -4.4, note: 'shaking by the cart' },
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
