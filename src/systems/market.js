/**
 * TradeHarder: stocks, and later, real estate.
 *
 * STOCKS — nine tickers from 1999's imagination, each with a drift and a volatility. Prices move
 * once a day on a seeded random walk (the same run of prices every time you reopen the app, the
 * same for a given save), so it is a real market: dot-coms that go up like rockets and come down
 * like rocks, a bank that does nothing, a church that is somehow publicly traded, and a Y2K
 * survival company that spikes toward the end of the year. A $1 fee per trade.
 *
 * PROPERTY — with enough money Mo can buy things on the block. 1104 Kestrel (the walk-up) is the
 * big one: eight units of rent, every week, enough to never clock in again — and eight tenants,
 * who fall behind, move out, and in one case offer to pay in product. The lot past the clinic is
 * the small one: a weekend flea market's rent.
 *
 * Headless; state in `state.market`, created lazily.
 */
import { CONFIG } from '../core/config.js';
import { dayOf, money, pick } from '../core/util.js';
import { bump, earn, spend, pushMessage, logLine, addItem } from '../core/state.js';

/* ------------------------------------------------------------------ stocks */

export const STOCKS = [
  { sym: 'FEED', name: 'FeedLove Inc.', p0: 42, drift: 0.012, vol: 0.09, blurb: 'a heart, a feed, no revenue' },
  { sym: 'BIDB', name: 'BidBay Inc.', p0: 58, drift: 0.008, vol: 0.075, blurb: 'sell it before it sells you' },
  { sym: 'DIAL', name: 'DialUp Online', p0: 23, drift: -0.002, vol: 0.06, blurb: 'you\'ve got mail (you have bills)' },
  { sym: 'QSTP', name: 'Quik-Stop Holdings', p0: 14, drift: 0.001, vol: 0.02, blurb: 'fourteen stores, one of them yours' },
  { sym: 'SHLE', name: 'Shale Bank', p0: 31, drift: 0.0015, vol: 0.012, blurb: 'your money, briefly' },
  { sym: 'GOLD', name: 'Golden Fellowship Media', p0: 19, drift: 0.006, vol: 0.05, blurb: 'tithe-backed securities' },
  { sym: 'Y2KS', name: 'Y2K Survival Supply', p0: 6, drift: 0.02, vol: 0.11, blurb: 'canned water, bunkers, panic' },
  { sym: 'FLSH', name: 'Flashbulb Film Co.', p0: 37, drift: -0.006, vol: 0.03, blurb: 'film is forever (film is not forever)' },
  { sym: 'MTRO', name: 'Metro Transit Bonds', p0: 100, drift: 0.0008, vol: 0.004, blurb: 'boring on purpose' },
];
export const STOCK_BY = Object.fromEntries(STOCKS.map((x) => [x.sym, x]));

function rng(seed) {
  let t = seed >>> 0;
  return () => { t = (t + 0x6d2b79f5) >>> 0; let r = Math.imul(t ^ (t >>> 15), 1 | t); r ^= r + Math.imul(r ^ (r >>> 7), 61 | r); return ((r ^ (r >>> 14)) >>> 0) / 4294967296; };
}
const gauss = (r) => { let u = 0, v = 0; while (!u) u = r(); while (!v) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };

export function marketState(s) {
  if (!s.market) s.market = { seed: Math.floor(Math.random() * 1e9), holdings: {}, trades: 0, realized: 0, properties: {}, lastRentDay: 0 };
  const m = s.market;
  m.holdings = m.holdings || {};
  m.properties = m.properties || {};
  return m;
}

const priceCache = new Map();
/** Price history of a ticker from day 1 to `day` (inclusive), seeded per save. */
export function history(s, sym, day) {
  const m = marketState(s);
  const st = STOCK_BY[sym];
  const key = `${m.seed}|${sym}`;
  let arr = priceCache.get(key);
  if (!arr) { arr = [st.p0]; priceCache.set(key, arr); }
  if (arr.length < day) {
    const r = rng(m.seed ^ (sym.charCodeAt(0) * 7919 + sym.charCodeAt(1) * 104729));
    for (let i = 1; i < arr.length; i++) { r(); r(); } // advance the stream to where the cache stops
    while (arr.length < day) {
      const prev = arr[arr.length - 1];
      // a crash or a spike now and then, on top of the walk
      const shock = r() < 0.03 ? (r() < 0.5 ? -0.25 : 0.22) * (st.vol * 6) : 0;
      const next = prev * Math.exp(st.drift + st.vol * gauss(r) + shock);
      arr.push(Math.max(0.25, Math.round(next * 100) / 100));
    }
  }
  return arr.slice(0, day);
}
export const priceOf = (s, sym, day = dayOf(s.clock.m)) => history(s, sym, day)[day - 1];

export function buy(g, sym, qty) {
  const s = g.state;
  const m = marketState(s);
  const p = priceOf(s, sym);
  const cost = Math.round((p * qty + CONFIG.market.fee) * 100) / 100;
  if (qty <= 0 || s.money < cost) return false;
  spend(g, cost, `TradeHarder: ${qty} ${sym}`);
  const h = m.holdings[sym] = m.holdings[sym] || { qty: 0, cost: 0 };
  h.cost += p * qty;
  h.qty += qty;
  m.trades += 1;
  g.advance(2);
  return true;
}

export function sell(g, sym, qty) {
  const s = g.state;
  const m = marketState(s);
  const h = m.holdings[sym];
  if (!h || qty <= 0 || h.qty < qty) return false;
  const p = priceOf(s, sym);
  const avg = h.cost / h.qty;
  const proceeds = Math.round((p * qty - CONFIG.market.fee) * 100) / 100;
  earn(g, proceeds, `TradeHarder: sold ${qty} ${sym}`);
  const gain = (p - avg) * qty;
  m.realized += gain;
  h.qty -= qty;
  h.cost -= avg * qty;
  if (h.qty <= 0) delete m.holdings[sym];
  m.trades += 1;
  g.advance(2);
  bump(s, 'morale', gain > 0 ? Math.min(10, 2 + gain / 200) : -Math.min(8, 1 + -gain / 200));
  return { proceeds, gain };
}

export function portfolioValue(s) {
  const m = marketState(s);
  return Object.entries(m.holdings).reduce((a, [sym, h]) => a + priceOf(s, sym) * h.qty, 0);
}

/* ------------------------------------------------------------------ property */

export const PROPERTIES = {
  walkup: { id: 'walkup', name: '1104 Kestrel St.', blurb: 'five-floor walk-up, eight units, one Squeak', price: 100000, units: 8, rent: 165, upkeep: 220 },
  lot: { id: 'lot', name: 'The lot past the clinic', blurb: 'chain-link, a Buick, a weekend flea market', price: 30000, units: 0, rent: 0, flat: 260, upkeep: 30 },
  // a home, not an investment: world/brownstone.js
  brownstone: { id: 'brownstone', name: 'The brownstone on 7th Ave, Park Slope', blurb: 'a parlour floor, a bathroom in subway tile, stairs to a real bedroom, and a yard', price: 185000, units: 0, rent: 0, flat: 0, upkeep: 160, home: true },
  laundromat: { id: 'laundromat', name: "Dee's Wash & Fold", blurb: 'twenty machines, two vending machines, Dee, and a back room', price: 60000, units: 0, rent: 0, flat: 780, upkeep: 190 },
};

const TENANTS = ['Ray & Denise (2A)', 'Mr. Okafor (2B)', 'Mrs. Petrakis (3B)', 'Lenny (3A)', 'Squeak (4A)', 'The Nguyens (4D)', 'The Ortizes (5C)', 'Teresa R. (5A)'];

export function owns(s, id) { return !!marketState(s).properties[id]; }

export function buyProperty(g, id) {
  const s = g.state;
  const p = PROPERTIES[id];
  const m = marketState(s);
  if (!p || m.properties[id] || s.money < p.price) return false;
  spend(g, p.price, `bought ${p.name}`);
  m.properties[id] = {
    since: dayOf(s.clock.m),
    lastPaidDay: dayOf(s.clock.m),
    units: p.units ? TENANTS.map((name) => ({ name, status: 'paying', behind: 0 })) : [],
    income: 0,
  };
  bump(s, 'morale', 25);
  logLine(g, `Bought ${p.name}.`, 'good');
  if (id === 'brownstone') pushMessage(g, { from: 'SLOPE REALTY', subject: 'Congratulations', body: 'The keys to the brownstone on 7th Avenue are under the mat, which we are told is not how keys work in Park Slope. Welcome to the neighbourhood. The neighbour on the left has already called about your fence.' });
  if (id === 'walkup') {
    pushMessage(g, { from: 'HECTOR (SUPER, 1104)', subject: '', body: '"So you\'re the new owner. Okay. The boiler is older than both of us and Squeak in 4A pays in \'other ways\' sometimes. Welcome to the family, boss."' });
  }
  return true;
}

/**
 * Once a week (every 7 days from purchase): rent comes in from the units that pay, upkeep goes
 * out, and the building has its week — somebody falls behind, somebody moves out, the boiler.
 * Returns a short report.
 */
export function propertyNewDay(g, day) {
  const s = g.state;
  const m = marketState(s);
  for (const [id, own] of Object.entries(m.properties)) {
    const p = PROPERTIES[id];
    if (day - own.lastPaidDay < 7) continue;
    own.lastPaidDay = day;
    let rent = p.flat || 0;
    for (const u of own.units) {
      if (u.status === 'paying') rent += p.rent;
      else if (u.status === 'behind') u.behind += 1;
      else if (u.status === 'product') addItem(s, pick(['bliss', 'static', 'mud', 'drip']), 2);
    }
    // renovations (laundered in from the back room) lift the week's take
    rent = Math.round(rent * (1 + (own.level || 0) * CONFIG.laundromat.upgradeBoost));
    // the laundromat's week: a machine goes down now and then and Dee calls the repair guy
    let repair = 0;
    if (id === 'laundromat' && Math.random() < 0.3) {
      repair = 90 + Math.floor(Math.random() * 120);
      pushMessage(g, { from: 'DEE (LAUNDROMAT)', subject: '', body: `"Number ${4 + Math.floor(Math.random() * 12)} died. The repair guy came, looked at it, said 'oh no,' fixed it, and charged ${money(repair)}. It's out of this week's take."` });
    }
    const net = rent - p.upkeep - repair;
    if (net >= 0) earn(g, net, `${p.name}: the week's rent`);
    else spend(g, Math.min(s.money, -net), `${p.name}: upkeep`);
    own.income += net;
    // the week's trouble
    if (own.units.length) weekTrouble(g, own);
    if (id === 'walkup') pushMessage(g, { from: 'HECTOR (SUPER, 1104)', subject: '', body: `"Week's done, boss. ${money(rent)} came in, ${money(p.upkeep)} went out on the boiler and the hallway lights.${own.units.some((u) => u.status === 'behind') ? ' Somebody\'s behind — check the app.' : ''}"`, kind: 'property' });
    else if (id === 'laundromat') pushMessage(g, { from: 'DEE (LAUNDROMAT)', subject: '', body: `"Week's take: ${money(rent)} in quarters, ${money(p.upkeep)} out for soap, the gas bill and the guy who fixes the change machine. ${net >= 0 ? 'We\'re fine.' : 'We\'re not fine.'}"`, kind: 'property' });
  }
}

function weekTrouble(g, own) {
  const r = Math.random();
  const paying = own.units.filter((u) => u.status === 'paying');
  if (r < 0.35 && paying.length) {
    const u = pick(paying);
    u.status = 'behind';
    u.behind = 1;
    pushMessage(g, { from: 'HECTOR (SUPER, 1104)', subject: '', body: `"${u.name} is short this week. Says next week. They always say next week. Your call, boss — give 'em a chance or start the paperwork."` });
  } else if (r < 0.45 && paying.length) {
    const u = pick(paying);
    u.status = 'vacant';
    pushMessage(g, { from: 'HECTOR (SUPER, 1104)', subject: '', body: `"${u.name} moved out. Left a lamp and a smell. Unit's empty — list it when you want."` });
  } else if (r < 0.55) {
    const sq = own.units.find((u) => u.name.startsWith('Squeak'));
    if (sq && sq.status === 'paying') {
      sq.status = 'offer';
      pushMessage(g, { from: 'HECTOR (SUPER, 1104)', subject: '', body: '"Squeak in 4A wants to \'renegotiate.\' He says instead of rent he can give you, quote, a little of this and a little of that. I said I would ask. I am asking."' });
    }
  }
}

/** The landlord's decisions, from the app. */
export function tenantAction(g, unitIndex, action) {
  const s = g.state;
  const own = marketState(s).properties.walkup;
  const u = own?.units[unitIndex];
  if (!u) return false;
  if (action === 'chance') { u.status = Math.random() < 0.6 ? 'paying' : 'behind'; bump(s, 'morale', 2); g.toast(u.status === 'paying' ? `${u.name} catches up. "Thank you. Really."` : `${u.name} promises again. You believe them, mostly.`, 'info'); }
  if (action === 'evict') { u.status = 'vacant'; u.behind = 0; bump(s, 'stress', 4); bump(s, 'morale', -4); g.toast(`You start the paperwork on ${u.name}. Hector does it. Nobody looks at you in the hallway for a week.`, 'bad'); }
  if (action === 'list') {
    if (!g.spendMoney(CONFIG.market.listingCost, 'listing a unit')) return false;
    u.name = `${pick(['A nurse', 'Two students', 'A retired cop', 'A guy named Tony', 'A drummer (quiet, he says)', 'A family of four'])} (${u.name.match(/\((.*)\)/)?.[1] || 'unit'})`;
    u.status = 'paying';
    g.toast('New tenant signed. Hector says they "seem fine," which from Hector is a rave.', 'good');
  }
  if (action === 'accept') { u.status = 'product'; bump(s, 'risk', 4); g.toast('Squeak shakes your hand for a long time. Rent in 4A is now paid in kind. This is a business decision.', 'info'); }
  if (action === 'refuse') { u.status = 'paying'; g.toast('Squeak pays in cash, grudgingly, mostly in quarters.', 'info'); }
  return true;
}

export const weeklyIncome = (s) => Object.entries(marketState(s).properties).reduce((a, [id, own]) => {
  const p = PROPERTIES[id];
  const gross = ((p.flat || 0) + own.units.filter((u) => u.status === 'paying').length * p.rent) * (1 + (own.level || 0) * CONFIG.laundromat.upgradeBoost);
  return a + Math.round(gross) - p.upkeep;
}, 0);

/**
 * The back room: wash cash through the laundromat's books and into a property's renovations, one
 * level at a time (costs in CONFIG.laundromat.upgradeCosts, plus the machines' cut). Every level
 * adds to that property's weekly take. Now and then the city reads the books: the renovation
 * stands, and there is a fine. Only the laundromat's owner gets a back room.
 */
export function launder(g, id) {
  const s = g.state;
  const L = CONFIG.laundromat;
  const m = marketState(s);
  const own = m.properties[id];
  if (!own || !m.properties.laundromat) return null;
  const lvl = own.level || 0;
  const cost = L.upgradeCosts[lvl];
  if (!cost) return null;
  const total = Math.round(cost * (1 + L.washFee));
  if (s.money < total) return null;
  spend(g, total, `renovations: ${PROPERTIES[id].name}`);
  own.level = lvl + 1;
  g.advance(30);
  logLine(g, `${PROPERTIES[id].name} renovated to level ${own.level}.`, 'good');
  if (Math.random() < L.auditChance) {
    const fine = Math.min(s.money, L.auditFine);
    spend(g, fine, 'City Department of Finance');
    bump(s, 'stress', 12);
    return { level: own.level, audit: true, fine };
  }
  bump(s, 'morale', 4);
  return { level: own.level };
}
