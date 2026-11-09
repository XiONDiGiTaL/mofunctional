/**
 * The police. They walk the park some nights, stand outside the 84th Precinct on Ashby, and roll
 * down Kestrel in a patrol car (streetlife.js). Four things they do to Mo:
 *
 *   break it up   a mugging where a cop can see it ends before it starts: the guy in the hood
 *                 runs, and the cop looks at Mo instead.
 *   search        a cop who sees Mo high stops him and searches him (once a night). Clean, he gets
 *                 told to go home. Holding anything (any substance in his pockets), he is booked:
 *                 every substance confiscated, a $250 fine (or whatever he has), a night in holding,
 *                 and out the front door of the precinct on Ashby Avenue in the morning.
 *   bribe         before the search, while he is high and holding: $50 or $100 to be somebody
 *                 else's problem. It is a roll, not a purchase. A refused bribe goes on the
 *                 report as "attempted bribery" and costs him more than the search would have.
 *   the deal      the other kind of cop: one a night, if Mo is high and near a patrol, a cop
 *                 offers him something out of the evidence room at a discount. He is not a
 *                 recurring character. That is the point of him.
 *
 * Headless; state in `state.police`, created lazily.
 */
import * as ashby from './ashby.js';
import { CONFIG } from '../core/config.js';
import { dayOf, money, pick, hhmm, minuteOfDay } from '../core/util.js';
import { bump, logLine, inventoryList, removeItem, addItem } from '../core/state.js';

const C = () => CONFIG.police;

export function policeState(s) {
  if (!s.police) s.police = {};
  const p = s.police;
  p.searchedNight = Number(p.searchedNight) || 0;
  p.bookings = Number(p.bookings) || 0;
  p.warned = Number(p.warned) || 0;
  p.fines = Number(p.fines) || 0;
  p.bribes = Number(p.bribes) || 0;
  p.bribeFails = Number(p.bribeFails) || 0;
  p.bribed = Number(p.bribed) || 0;          // taken, in dollars
  p.crookedNight = Number(p.crookedNight) || 0;
  p.crookedDeals = Number(p.crookedDeals) || 0;
  return p;
}

/** Night key: the night of day N runs from its evening into the next morning. */
const nightOf = (s) => dayOf(s.clock.m - 6 * 60);

export const isHigh = (s) => (s.high?.level || 0) > C().highLine;

export function holding(s) {
  return inventoryList(s).filter((it) => it.def?.kind === 'substance' && !it.def.legal); // Herb is legal in New York
}

/** Has a cop already stopped him tonight? */
export const searchedTonight = (s) => policeState(s).searchedNight === nightOf(s);

/** High, holding, and with enough cash to be interesting: the bribe is on the table. */
export function canBribe(s) {
  return isHigh(s) && holding(s).length > 0 && s.money >= C().bribe.low;
}

/**
 * The stop. Returns { booked, items, fine } — the world shows it and, when booked, moves him to
 * the precinct.
 */
export function search(g) {
  const s = g.state;
  const p = policeState(s);
  p.searchedNight = nightOf(s);
  const items = holding(s);
  // a bench warrant: clean pockets or not, he is going in (systems/ashby.js)
  if (ashby.hasWarrant(s)) { ashby.serveWarrant(g); return book(g, items, { warrant: true }); }
  if (!items.length) {
    p.warned += 1;
    bump(s, 'stress', 8);
    bump(s, 'morale', -4);
    logLine(g, 'Stopped and searched. Clean.', 'info');
    return { booked: false };
  }
  return book(g, items);
}

/**
 * Offer the money. Returns { ok, outcome: 'bribe'|'refused'|'short', cost }.
 * A bribe that is taken ends the stop: the pockets stay full and the night goes on.
 */
export function bribe(g, amount) {
  const s = g.state;
  const p = policeState(s);
  const B = C().bribe;
  const cost = Number(amount) >= B.high ? B.high : B.low;
  if (s.money < cost) {
    g.toast(`You go for your wallet and find ${money(s.money)}. He notices. That is worse.`, 'bad');
    return { ok: false, outcome: 'short', cost };
  }
  s.money = Math.round((s.money - cost) * 100) / 100;
  p.bribed = Math.round((p.bribed + cost) * 100) / 100;
  const odds = cost >= B.high ? B.highChance : B.lowChance;
  const taken = Math.random() < odds;
  if (taken) {
    p.bribes += 1;
    p.searchedNight = nightOf(s);
    bump(s, 'stress', -4);
    logLine(g, `Bribed a cop: ${money(cost)}. The pockets stay full.`, 'info');
    return { ok: true, outcome: 'bribe', cost, line: pick(bribeLines()) };
  }
  p.bribeFails += 1;
  bump(s, 'morale', B.failMorale);
  logLine(g, `Tried to bribe a cop (${money(cost)}). It did not work.`, 'bad');
  const items = holding(s);
  const res = book(g, items, { extraFine: B.failFineExtra, bribe: cost });
  return { ok: false, outcome: 'refused', cost, booked: res };
}

const bribeLines = () => [
  '"I did not see anything." He is already walking. Your heart is doing something new.',
  'He takes it without looking at it, which is somehow worse than if he had counted it. "Get inside, man. Go."',
  '"This is a warning, not a service." The money is gone anyway.',
];

/** Booked: everything confiscated, the fine (or all he has), a night in holding. */
export function book(g, items = holding(g.state), { extraFine = 0, bribe = 0, warrant = false } = {}) {
  const s = g.state;
  const p = policeState(s);
  const took = [];
  for (const it of items) { took.push(`${it.qty}× ${it.def.name}`); removeItem(s, it.id, it.qty); }
  // the fine is a ticket with a court date now: pay it, fight it or work it off on Ashby West.
  // Picked up on a warrant, the old ticket stands and no new one is written.
  const fine = warrant ? 0 : C().fine + extraFine;
  const ticket = warrant ? ashby.openCases(s)[0] : ashby.openTicket(g, fine);
  p.bookings += 1;
  p.fines += fine;
  bump(s, 'stress', 18);
  bump(s, 'morale', -14);
  bump(s, 'risk', -10);
  const note = bribe ? ` Attempted bribery: ${money(bribe)}.` : '';
  logLine(g, `Booked at the 84th Precinct${warrant ? ' on a bench warrant' : ''}: ${took.join(', ') || 'nothing'} confiscated, ${warrant ? 'the old ticket still open' : `a ${money(fine)} ticket`}.${note}`, 'bad');
  return { booked: true, items: took, fine, bribe, warrant, ticketText: ashby.ticketLine(s, ticket) };
}

/* ------------------------------------------------------------ the crooked cop */

/** Has the fixer already found him tonight? */
export const crookedTonight = (s) => policeState(s).crookedNight === nightOf(s);

/**
 * Would tonight's crooked cop speak to him? High, not in the precinct, nobody has been bought
 * off him yet. `dt` keeps the roll honest whatever the frame rate.
 */
export function crookedRoll(s, dt) {
  if (crookedTonight(s) || !isHigh(s)) return false;
  // he works nights, like the rest of them
  const mod = minuteOfDay(s.clock.m);
  if (!(mod >= 21 * 60 || mod < 5 * 60)) return false;
  return Math.random() < C().crooked.chance * Math.max(0, Math.min(dt, 0.1));
}

/** What is on offer: the good stuff, at a bent-cop price. */
export function crookedOffer(s) {
  const C_ = C().crooked;
  const pool = ['bliss_x', 'mud_x', 'static_x', 'bliss', 'static', 'mud'];
  const product = pick(pool);
  const def = CONFIG.items[product] || CONFIG.items.mud;
  const price = Math.max(4, Math.round(def.price * (1 - C_.discount) * 100) / 100);
  return { product, name: def.name, price, affordable: s.money >= price, line: pick(C_.lines) };
}

/** Take the deal. The night's cop is spent either way. */
export function crookedDeal(g, product) {
  const s = g.state;
  const p = policeState(s);
  const off = crookedOffer(s);
  const id = product || off.product;
  const def = CONFIG.items[id];
  if (!def) return { ok: false, reason: 'nothing' };
  const price = Math.max(4, Math.round(def.price * (1 - C().crooked.discount) * 100) / 100);
  p.crookedNight = nightOf(s);
  if (s.money < price) { g.toast(`You have ${money(s.money)}. He laughs, not unkindly, and keeps walking.`, 'bad'); return { ok: false, reason: 'short' }; }
  s.money = Math.round((s.money - price) * 100) / 100;
  s.ledger.push({ day: dayOf(s.clock.m), label: 'A cop, of all people', amount: -price });
  addItem(s, id, 1);
  p.crookedDeals += 1;
  bump(s, 'stress', -3);
  logLine(g, `Bought ${def.name} from a cop for ${money(price)}. At ${hhmm(s.clock.m)}. On a street.`, 'bad');
  return { ok: true, item: def.name, price };
}

/** He said no, or walked away: the offer does not come twice tonight. */
export function crookedDecline(g) {
  const p = policeState(g.state);
  p.crookedNight = nightOf(g.state);
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
  offer: [
    '"Before we do this." He says it quietly, hand still on the radio. "How much is your night worth?"',
    '"I could search you." A pause with a price in it. "Or we could both be somewhere else."',
  ],
};
export const copLine = (k) => pick(COP_LINES[k]);
