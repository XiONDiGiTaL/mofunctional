/**
 * Things that happen to the whole block at once: a blackout, a heat wave, the trains down, a block
 * party, a building inspection. Each changes several systems for a while (shops, the fridge,
 * sleep, the commute, the street), and each is usually seen coming: it is scheduled a day or two
 * ahead and foreshadowed with a text that carries the ways to get ready, and while it is on, a
 * marquee runs across the top of the screen. Getting ready matters more than the surprise.
 *
 *   s.happening = { id, day, from, to, told, prepared: {...}, done }
 */
import { pushMessage, bump, logLine, addItem } from '../core/state.js';
import { dayOf, minuteOfDay, money, pick, hhmm } from '../core/util.js';
import { setClosedOverride } from '../world/hours.js';
import * as home from './home.js';

export const HAPPENINGS = {
  blackout: {
    name: 'Blackout', icon: '⚡', from: 18 * 60, to: 23 * 60, days: 1,
    marquee: 'BLACKOUT · {T} · SHOPS CLOSED · KEEP THE FRIDGE SHUT · EVERYBODY IS ON THE STOOP',
    warn: { from: 'MUNICIPAL POWER', subject: 'Planned outage', body: 'Kestrel / Ashby grid maintenance tomorrow, {T}. We apologise for any inconvenience. We do not apologise for the maintenance.' },
    prep: [
      { id: 'ice', label: 'Buy a bag of ice for the fridge.', sub: '$3 · the food keeps', cost: 3, line: 'A bag of ice from Miguel, into the fridge. The fridge is a cooler now. It always kind of was.' },
      { id: 'eatup', label: 'Plan to eat the fridge first.', sub: 'nothing spoils if nothing is left', line: 'Tonight’s menu: everything in the fridge, in order of how bad it smells.' },
    ],
  },
  heatwave: {
    name: 'Heat Wave', icon: '☀', from: 9 * 60, to: 21 * 60, days: 2,
    marquee: 'HEAT WAVE · 98°F · DRINK WATER · SLEEP IS A RUMOUR · {T}',
    warn: { from: 'NEXTSTOOP', subject: 'Heat advisory', body: 'Heat advisory starting tomorrow. Two days, high 90s. Check on your elderly neighbours. Gloria in 4B says she is fine. Gloria is not fine.' },
    prep: [
      { id: 'fan', label: 'Buy a box fan.', sub: '$20 · sleep through it', cost: 20, line: 'A box fan from the hardware store on Ashby. It sounds like a small plane and it is the best twenty dollars you have spent.' },
      { id: 'water', label: 'Stock up on water.', sub: '$4 · four bottles', cost: 4, item: ['water', 4], line: 'Four bottles of water, in the fridge, for when the tap runs warm.' },
    ],
  },
  transit: {
    name: 'Train Trouble', icon: '🚇', from: 6 * 60, to: 13 * 60, days: 1,
    marquee: 'K TRAIN SUSPENDED · SHUTTLE BUSES · ALLOW EXTRA TIME · {T}',
    warn: { from: 'NEXTSTOOP', subject: 'K train tomorrow', body: 'Heads up: no K trains tomorrow morning, signal work. Shuttle buses "every few minutes." So, every forty minutes. Plan ahead.' },
    prep: [
      { id: 'dale', label: 'Text Dale that the trains are down.', sub: 'lateness forgiven tomorrow', line: 'You text Dale. He texts back "k." From Dale that is a signed agreement.' },
      { id: 'early', label: 'Plan to leave early.', sub: 'set an alarm', line: 'You set the alarm for an hour early, which is a promise you are making to a man you will be very angry at tomorrow.' },
    ],
  },
  party: {
    name: 'Block Party', icon: '♫', from: 14 * 60, to: 23 * 60, days: 1,
    marquee: 'BLOCK PARTY ON KESTREL ST · {T} · $2 PLATES · DJ · DOMINOES · COME THROUGH',
    warn: { from: 'NEXTSTOOP', subject: 'Block party!!', body: 'Kestrel Street block party tomorrow, {T}. Bring a chair, a dish, or a good attitude. Lou is doing the grill. Somebody is doing the DJ. It is not Kev.' },
    prep: [
      { id: 'dish', label: 'Make something to bring.', sub: '$5 · neighbours remember', cost: 5, line: 'You make a tray of something with rice in it. It counts. Everybody remembers who brought something.' },
      { id: 'help', label: 'Offer to help Lou with the grill.', sub: 'paid in cash and plates', line: 'Lou says "be there at two, wear something you hate." You are hired.' },
    ],
  },
  inspection: {
    name: 'Building Inspection', icon: '📋', from: 10 * 60, to: 16 * 60, days: 1,
    marquee: 'CITY INSPECTION · 1120 KESTREL ST · {T} · THE INSPECTOR IS IN THE BUILDING',
    warn: { from: 'HECTOR', subject: 'inspector tomorrow', body: 'The city is inspecting the building tomorrow. Rae is running around with a paint roller. If you have problems in your unit, tomorrow is the day somebody official has to write them down. Or you hide them. Up to you.' },
    prep: [
      { id: 'list', label: 'Write down everything that is broken.', sub: 'the inspector will see it', line: 'A list on the back of a Quik-Stop receipt: the shower, the heat, the leak, the window. It is a long receipt.' },
      { id: 'neighbors', label: 'Knock on doors: tell the neighbours.', sub: '1 h · the building shows up together', minutes: 60, line: 'Gloria, Lenny, Ray and Denise, Teresa. By the end of the hall everybody has a list. Gloria has two.' },
    ],
  },
};

export function happeningState(s) { return s.happening || null; }

/** Is one on right now, and which. */
export function active(s) {
  const h = s.happening;
  if (!h || h.done) return null;
  const d = dayOf(s.clock.m);
  const m = minuteOfDay(s.clock.m);
  const def = HAPPENINGS[h.id];
  if (d < h.day || d >= h.day + def.days) return null;
  return m >= def.from && m < def.to ? h : null;
}
export const isActive = (s, id) => active(s)?.id === id;
const timeLabel = (def) => `${hhmm(def.from)}–${hhmm(def.to)}`;

/** Each morning: maybe schedule one; maybe it is today; tidy the last one. */
export function happeningsNewDay(g, day) {
  const s = g.state;
  const h = s.happening;
  if (h && !h.done && day >= h.day + HAPPENINGS[h.id].days) finish(g);
  if (s.happening && !s.happening.done) {
    if (day === s.happening.day) {
      const def = HAPPENINGS[s.happening.id];
      g.toast(`${def.icon} Today: ${def.name}, ${timeLabel(def)}.`, 'gold');
    }
    return;
  }
  if (day < 3 || Math.random() > 0.2) return;
  const ids = Object.keys(HAPPENINGS).filter((id) => id !== s.lastHappening);
  // a block party wants a weekend
  const pickId = pick(ids);
  const ahead = pickId === 'party' ? Math.max(1, (6 - ((day - 1) % 7) + 7) % 7 || 7) : 1 + Math.floor(Math.random() * 2);
  schedule(g, pickId, day + Math.min(ahead, 3), Math.random() < 0.8);
}

/** Put one on the calendar; `warn` sends the heads-up text with the ways to get ready. */
export function schedule(g, id, day, warn = true) {
  const s = g.state;
  const def = HAPPENINGS[id];
  s.happening = { id, day, told: warn, prepared: {}, done: false };
  if (!warn) return;
  const T = `${day === dayOf(s.clock.m) + 1 ? 'tomorrow' : `day ${day}`}, ${timeLabel(def)}`;
  pushMessage(g, {
    from: def.warn.from, subject: def.warn.subject,
    body: def.warn.body.replace('{T}', T),
    choices: def.prep.map((p) => ({ label: p.label, prep: p.id })),
  });
}

export function prepare(g, prepId) {
  const s = g.state;
  const h = s.happening;
  if (!h || h.done) { g.toast('That already came and went.', 'info'); return false; }
  const p = HAPPENINGS[h.id].prep.find((x) => x.id === prepId);
  if (!p || h.prepared[prepId]) return false;
  if (p.cost && s.money < p.cost) { g.toast(`That is ${money(p.cost)}. You have ${money(s.money)}.`, 'bad'); return false; }
  if (p.cost) g.spendMoney(p.cost, `ready for the ${HAPPENINGS[h.id].name.toLowerCase()}`);
  if (p.item) addItem(s, p.item[0], p.item[1]);
  if (p.minutes) g.advance(p.minutes);
  if (prepId === 'fan') home.homeState(s).owned.includes('fan') || home.homeState(s).owned.push('fan');
  h.prepared[prepId] = true;
  bump(s, 'stress', -2);
  g.toast(p.line, 'good');
  return true;
}

/** Called on every simulation step: the things a happening does while it is on. */
export function happeningsTick(g, hours) {
  const s = g.state;
  const h = active(s);
  // the power: off for a blackout, back after (unless the bill cut it, which is the bill's business)
  if (h?.id === 'blackout' && !s.flags.powerCut) { s.flags.powerCut = true; s.flags.powerCutByBlackout = true; }
  if (h?.id !== 'blackout' && s.flags.powerCutByBlackout) { s.flags.powerCut = false; s.flags.powerCutByBlackout = false; afterBlackout(g); }
  if (!h) return;
  if (h.id === 'heatwave' && !h.prepared.water) { bump(s, 'energy', -0.8 * hours); bump(s, 'hygiene', -0.8 * hours); }
  if (!h.started) {
    h.started = true;
    const def = HAPPENINGS[h.id];
    logLine(g, `${def.name}: ${timeLabel(def)}.`, 'event');
    if (h.id === 'inspection') inspectionKnock(g);
  }
}

function afterBlackout(g) {
  const s = g.state;
  const h = s.happening;
  if (!h || h.id !== 'blackout' || h.fridgeChecked) return;
  h.fridgeChecked = true;
  const fridge = s.fridge || [];
  const saved = h.prepared.ice || h.prepared.eatup || home.has(s, 'fridge');
  if (!saved && fridge.length) {
    const lost = fridge.reduce((n, i) => n + Math.ceil(i.qty / 2), 0);
    s.fridge = fridge.map((i) => ({ ...i, qty: Math.floor(i.qty / 2) })).filter((i) => i.qty > 0);
    bump(s, 'morale', -5);
    g.toast(`The power is back. Half the fridge is not: ${lost} thing${lost === 1 ? '' : 's'} went warm and then went bad.`, 'bad');
  } else g.toast('The power comes back with a clunk and a hum. The fridge made it.', 'good');
  bump(s, 'morale', 3);
}

/** Does the heat wave cost him sleep tonight? (extra energy lost per hour slept) */
export const heatSleepPenalty = (s) => {
  const h = s.happening;
  if (!h || h.id !== 'heatwave') return 0;
  const d = dayOf(s.clock.m);
  if (d < h.day || d > h.day + HAPPENINGS.heatwave.days) return 0;
  return home.has(s, 'fan') ? 0 : 1.6;
};

/** Late for the shift because the trains were down, and Dale was told: it does not count. */
export const latenessForgiven = (s) => {
  const h = s.happening;
  return !!(h && h.id === 'transit' && h.prepared.dale && dayOf(s.clock.m) === h.day);
};

function finish(g) {
  const s = g.state;
  const h = s.happening;
  if (!h) return;
  h.done = true;
  s.lastHappening = h.id;
}

/** The inspector at the door: show it all, hide it, or bring the whole hall. */
function inspectionKnock(g) {
  const s = g.state;
  const h = s.happening;
  const problems = [!home.has(s, 'shower') && 'the shower', home.homeState(s).leak && 'the leak', 'the heat', 'the window that does not close'].filter(Boolean);
  pushMessage(g, {
    from: 'HECTOR', subject: 'inspector is here',
    body: `The inspector is on your floor now. Her clipboard is very full. Your unit: ${problems.join(', ')}.${h.prepared.neighbors ? ' Everybody in the hall has their lists out. Gloria made copies.' : ''}`,
    choices: [
      { label: 'Show her everything.', inspect: 'show' },
      { label: 'Hide it. Do not make trouble with Rae.', inspect: 'hide' },
    ],
  });
}

export function inspectionResult(g, how) {
  const s = g.state;
  const h = s.happening;
  if (!h || h.inspected) return;
  h.inspected = true;
  s.npc = s.npc || {};
  if (how === 'hide') {
    s.npc.rae = (Number(s.npc.rae) || 0) + 1;
    g.toast('"Everything is fine," you tell her, standing in front of the shower. Rae nods at you in the hall like you are on the same team. You are not.', 'info');
    return;
  }
  const strong = h.prepared.list || h.prepared.neighbors;
  const together = !!h.prepared.neighbors;
  s.npc.rae = (Number(s.npc.rae) || 0) - 2;
  if (strong) {
    // the city writes it down, so Rae has to fix it
    const owned = home.homeState(s).owned;
    if (!owned.includes('shower')) owned.push('shower');
    home.homeState(s).leak = 0;
    s.tenants = s.tenants || {};
    s.tenants.inspectionWin = true;
    if (together) s.tenants.support = (s.tenants.support || 0) + 2;
    bump(s, 'morale', 10);
    logLine(g, 'The inspector wrote it all down. Rae has thirty days to fix the shower and the leak.', 'good');
    g.toast(`She writes it all down. Thirty days, the violation says. Rae fixes the shower in four.${together ? ' The hall cheers in the hallway, which is a new sound for this building.' : ''}`, 'good');
  } else {
    bump(s, 'morale', 3);
    g.toast('She writes down the shower and "heat (tenant reports)." Without a list it is your word, and your word is in pencil. Rae glares at you anyway.', 'info');
  }
}

/** The line for the marquee, or null. */
export function marqueeLine(s) {
  const h = active(s);
  if (!h) return null;
  const def = HAPPENINGS[h.id];
  return `${def.icon}  ${def.marquee.replace('{T}', timeLabel(def))}  ${def.icon}`;
}

/** Shops close for a blackout; the block party has Kestrel Street. */
export function installHappenings(g) {
  setClosedOverride((area, m) => {
    const s = g.state;
    if (!s) return null;
    if (isActive(s, 'blackout') && ['bodega', 'habibs', 'laundromat', 'restaurant', 'pawn', 'jays'].includes(area)) return 'Closed · blackout, no power';
    // Habib closes at midnight now, if that is how his week went (systems/arcs.js)
    if (area === 'habibs' && s.flags?.habibShortHours && minuteOfDay(m) < 11 * 60) return 'Closed · opens 11:00 (closes at midnight now)';
    return null;
  });
}
