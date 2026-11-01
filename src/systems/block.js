/**
 * NextStoop: the neighbourhood app. Three things, all for the block rather than for Mo:
 *
 *   - Seen around the block: what neighbours are posting right now about who is where. It is
 *     built from the real schedules, so it is useful: the teacher grading by the park bench, the
 *     man in the alley after dark, a woman reading on the grass in Kestrel Park around two.
 *   - The board: a day's worth of neighbour posts (lost and found, safety, free stuff, complaints).
 *     Seeded per day, so it does not change while you read it.
 *   - Kestrel History: the lore of the block, one more entry unlocked every day.
 *
 * Headless; nothing here is saved, it is all read off the day and the clock.
 */
import { CONFIG } from '../core/config.js';
import { dayOf, minuteOfDay, hhmm } from '../core/util.js';
import { partnerTarget, scheduleTarget, strangerRunIns, PARTNER_AREA_NAMES } from '../world/schedules.js';
import * as romance from './romance.js';
import { STRANGER_BY_ID } from '../core/strangers.js';

/* ------------------------------------------------------------------ the people posting */

const NEIGHBORS = [
  { name: 'Gloria (4B)', tag: 'Kestrel St.' },
  { name: 'Mr. Okafor', tag: 'Kestrel St.' },
  { name: 'Concerned Resident', tag: 'Kestrel St.' },
  { name: 'Dee from the laundromat', tag: 'Ashby Ave.' },
  { name: 'Pat (block association)', tag: 'Kestrel St.' },
  { name: 'Lenny', tag: 'Kestrel St.' },
  { name: 'Teresa R.', tag: 'Garnet Pl.' },
  { name: 'anonymous', tag: 'nearby' },
];

const BOARD = {
  'Lost & found': [
    'FOUND: one (1) left shoe, size 11, outside the bodega. It has seen things. Claim it.',
    'LOST: grey cat, answers to "Biscuit" (does not answer to "Biscuit").',
    'Whoever took the shopping cart from the Quik-Stop, Dale is "not mad, just disappointed."',
    'LOST: my patience, around 3 AM, to whoever plays the trumpet on Garnet Pl.',
  ],
  'Crime & safety': [
    'Somebody keeps ringing every buzzer at 1120 at 4 AM. Rae says it is "being handled."',
    'Car alarm on Ashby went off for forty minutes. Nobody checked. Nobody ever checks.',
    'Cops were by the alley again. They asked nobody anything and left.',
    'Reminder: lock your bikes. Lock your bikes to something that is not also a bike.',
  ],
  'Recommendations': [
    'Habib\'s chicken over rice is the only consistent thing in my life. Extra white sauce.',
    'Need a plumber? Do not call the number on the lamp post. That is not a plumber.',
    'Miguel will make you a BEC at 6 AM without you saying a word. Respect that man.',
    'Kestrel Clinic took my walk-in in under an hour. The chairs are still terrible.',
  ],
  'Free stuff': [
    'FREE: a couch. On the curb. It is raining. It was free before it rained, too.',
    'FREE: box of VHS tapes, mostly aerobics. One is labelled "DO NOT".',
    'FREE: a microwave that works if you hold the door. Do not ask how I know.',
  ],
  'Complaints': [
    'The boombox in the park plays the same tape. The SAME tape. For a year.',
    'Who is putting Golden Fellowship flyers under every door. They are gold foil. It is a waste of foil.',
    'The pigeons on Kestrel have unionized. They will not move for anyone.',
    'Can the Quik-Stop please fix the flickering sign. It says QUIK-STO_ and it is upsetting my mother.',
  ],
  'Events': [
    'Block cleanup Saturday 9 AM. Gloves provided. Opinions not required.',
    'Hoops at the half-court, Sunday, no refs. Bring your own rim.',
    'The Golden Fellowship is doing a "free coffee and a conversation" on Sunday. The coffee is free.',
  ],
};

/* ------------------------------------------------------------------ the lore */

export const LORE = [
  { title: 'The block', body: 'Kestrel Street runs four blocks between Ashby Avenue and the park. Everybody calls it "the block" anyway. The city calls it "under review".' },
  { title: '1120 Kestrel', body: 'Built in 1926 as a button factory. Converted to apartments in 1971 by a man named Vell, who installed the radiators himself. Rae is his son. The radiators remember.' },
  { title: 'Quik-Stop #14', body: 'There were thirteen Quik-Stops before it and none after. Store #14 has been open 24 hours a day since 1984, except for one night in 1996 nobody will talk about.' },
  { title: 'Miguel\'s bodega', body: 'Opened by Miguel\'s father in 1979. The cat is the fourth cat. All four have been named "Gato". Miguel says the cat runs the store and he only works there.' },
  { title: 'The Golden Fellowship', body: 'Moved into the old Loew\'s cinema on Kestrel in 1994. The marquee still has the last movie title behind the gold paint if you stand in the right light. Addison Octavius bought the building in cash.' },
  { title: 'Kestrel Park', body: 'Six acres, one bent rim, two benches that face each other like they are arguing. The tulips by the gate appear every spring. Nobody admits to planting them.' },
  { title: 'The alley', body: 'The alley between the Quik-Stop and the church has had a name on city maps since 1931: Kestrel Mews. Nobody has ever called it that. People who work there at night do not have names either.' },
  { title: 'Habib\'s Corner', body: 'Habib drove a cab for eleven years and saved every dollar for a grill. He says the white sauce recipe came from his mother. His mother says it came from a jar.' },
  { title: 'The hydrant by 1120', body: 'Painted gold in 1998 by somebody from the Fellowship "as a blessing." The city painted it red again. It was gold again by Friday.' },
  { title: 'The 1977 blackout', body: 'Old-timers say the block was the only one on the avenue where nobody broke a window. Gloria in 4B says that is because nobody on Kestrel had anything worth taking. Both are true.' },
  { title: 'Kestrel Clinic', body: 'A storefront clinic since 1989, run on grants and one nurse who has never taken a sick day. The scale in the waiting room has been wrong by four pounds the whole time.' },
  { title: 'Ashby Avenue', body: 'The bus that "comes every twelve minutes" has been studied by a graduate student from Columbia. Her thesis is titled "Sometimes".' },
  { title: 'Gus', body: 'The man on the cardboard by the bodega was a merchant marine, a cook, and for one year a minor-league umpire. He knows every name on the block. Ask him sometime.' },
  { title: 'The bench', body: 'The bench on Kestrel was donated "in memory of Sal, who sat here." Sal is not dead. Sal sits there on Thursdays and finds the plaque very funny.' },
];

/** Entries unlocked by day N: three to start, one more every day. */
export const loreUnlocked = (s) => LORE.slice(0, Math.min(LORE.length, 2 + dayOf(s.clock.m)));

/* ------------------------------------------------------------------ the board */

function rng(seed) {
  let t = seed >>> 0;
  return () => { t = (t + 0x6d2b79f5) >>> 0; let r = Math.imul(t ^ (t >>> 15), 1 | t); r ^= r + Math.imul(r ^ (r >>> 7), 61 | r); return ((r ^ (r >>> 14)) >>> 0) / 4294967296; };
}

/** Today's board: a handful of posts, seeded by the day. */
export function boardToday(s) {
  const day = dayOf(s.clock.m);
  const r = rng(day * 4111 + 7);
  const cats = Object.keys(BOARD);
  const out = [];
  const used = new Set();
  const n = 4 + Math.floor(r() * 3);
  for (let i = 0; i < n * 3 && out.length < n; i++) {
    const cat = cats[Math.floor(r() * cats.length)];
    const text = BOARD[cat][Math.floor(r() * BOARD[cat].length)];
    if (used.has(text)) continue;
    used.add(text);
    const who = NEIGHBORS[Math.floor(r() * NEIGHBORS.length)];
    out.push({ cat, text, who: who.name, where: who.tag, minute: Math.floor((6 + r() * 16) * 60), replies: Math.floor(r() * 14) });
  }
  // only what has been posted so far today
  const now = minuteOfDay(s.clock.m);
  return out.filter((x) => x.minute <= now).sort((a, b) => b.minute - a.minute);
}

/* ------------------------------------------------------------------ seen around the block */

const PARTNER_SIGHTINGS = {
  stephanie: 'the girl with the black hoodie',
  melanie: 'the teacher with the curls',
  diana: 'the lady who runs at 7 AM',
};

/**
 * Live sightings from the real schedules: where the three are, whether the alley is open, and
 * which of the app women were spotted where (now, or later today). Useful on purpose.
 */
export function sightings(s) {
  const mod = minuteOfDay(s.clock.m);
  const day = dayOf(s.clock.m);
  const out = [];
  for (const id of romance.PARTNER_KEYS) {
    const row = partnerTarget(id, mod);
    if (!row || row.away) continue;
    const who = romance.partnerState(s, id).met ? CONFIG.partners[id].name : PARTNER_SIGHTINGS[id];
    out.push({ text: `${cap(who)} is at ${PARTNER_AREA_NAMES[row.area]} right now, ${row.note}.`, who: 'Lenny' });
  }
  const dex = scheduleTarget('dex', mod);
  out.push(dex && !dex.away
    ? { text: 'Somebody is in the alley again. Same guy. Do not make eye contact, he does not like it.', who: 'Concerned Resident' }
    : { text: 'Alley is empty for once. Whoever is usually there comes back after six.', who: 'Concerned Resident' });
  for (const run of strangerRunIns(day)) {
    const w = STRANGER_BY_ID[run.id];
    if (mod >= run.to) continue;
    const when = mod >= run.from ? 'right now' : `around ${hhmm(run.from)}`;
    out.push({ text: `Saw a woman at ${PARTNER_AREA_NAMES[run.area]} ${when}, ${run.note}. Pretty sure she is on FeedLove. (${w.hood} girl.)`, who: 'anonymous' });
  }
  return out;
}

const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);
