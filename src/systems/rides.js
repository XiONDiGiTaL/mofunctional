/**
 * HailMary: "a ride and a prayer". Call a car on the phone; a black town car pulls up at the curb
 * out front a few minutes later; walk up to it and get in; pick where to go.
 *
 * The driver (Sal's cousin Vinnie, or somebody who says he is) has opinions. Ask for somewhere on
 * the same block and he will not start the engine: "It's up the road, idiot. Just walk." He
 * charges anyway, a little, for the stop. Everywhere else is a real ride: game minutes, a fare,
 * and a drop at the door.
 *
 * If Mo does not come out within the wait, the car leaves and the app keeps a no-show fee.
 * Headless: state in `state.ride`; the world draws the car (world/ridecar.js).
 */
import { CONFIG } from '../core/config.js';
import { money, pick } from '../core/util.js';
import { pushMessage, logLine } from '../core/state.js';
import { building, STREET, PARK, ROAD } from '../world/plan.js';
import { openAt } from '../world/hours.js';

/** On Kestrel the car pulls into the nearest gap between parked cars. */
function freeCurbX(x) {
  const clear = (cx) => ROAD.parkedNear.every((p) => Math.abs(p.x - cx) > 4.6);
  for (let d = 0; d < 20; d += 0.5) {
    if (clear(x + d)) return x + d;
    if (clear(x - d)) return x - d;
  }
  return x;
}

const C = () => CONFIG.rides;

/** Where he can go. `area` + `from` is the goTo; `group` decides what counts as "up the road". */
export const DESTINATIONS = [
  { id: 'home', name: '1120 Kestrel St. (home)', area: 'street', from: 'apartment', group: 'kestrel', x: () => building('apartment').door },
  { id: 'walkup', name: '1104 Kestrel St.', area: 'street', from: 'walkup', group: 'kestrel', x: () => building('walkup').door },
  { id: 'quikstop', name: 'Quik-Stop #14', area: 'street', from: 'quikstop', group: 'kestrel', x: () => building('quikstop').door },
  { id: 'bodega', name: "Miguel's bodega", area: 'street', from: 'bodega', group: 'kestrel', x: () => building('bodega').door },
  { id: 'habibs', name: "Habib's Corner", area: 'street', from: 'habibs', group: 'kestrel', x: () => building('habibs').door },
  { id: 'church', name: 'The Golden Fellowship', area: 'street', from: 'church', group: 'kestrel', x: () => building('church').door },
  { id: 'clinic', name: 'Kestrel Clinic', area: 'street', from: 'clinic', group: 'kestrel', x: () => building('clinic').door },
  { id: 'park', name: 'Kestrel Park', area: 'park', from: null, group: 'kestrel' },
  { id: 'avenue', name: 'Ashby Avenue', area: 'avenue', from: 'bus', group: 'ashby' },
  { id: 'lucias', name: "Lucia's on Ashby", area: 'restaurant', from: 'avenue', group: 'ashby' },
  { id: 'precinct', name: 'The 84th Precinct', area: 'avenue', from: 'precinct', group: 'ashby' },
  { id: 'laundromat', name: "Dee's Wash & Fold", area: 'avenue', from: 'laundromat', group: 'ashby' },
];

// which block an area is on, for "it's up the road"
const AREA_GROUP = {
  street: 'kestrel', apartment: 'kestrel', walkup: 'kestrel', quikstop: 'kestrel', bodega: 'kestrel', habibs: 'kestrel',
  church: 'kestrel', clinic: 'kestrel', park: 'kestrel', avenue: 'ashby', restaurant: 'ashby', precinct: 'ashby', laundromat: 'ashby', laundry_back: 'ashby',
};

export function rideState(s) {
  if (!s.ride) s.ride = { status: 'none', area: null, x: 0, arriveAt: 0, leaveAt: 0, rides: 0, spent: 0 };
  return s.ride;
}

/**
 * Where the car pulls up: at Mo's own spot on the curb if he is outside, or at the curb in front of
 * the door of wherever he is (the park and Kestrel buildings come out onto Kestrel; Lucia's onto
 * Ashby).
 */
export function pickupFor(g) {
  const area = g.world?.areaId || 'street';
  const mx = g.world?.mo?.root?.position?.x ?? 0;
  if (area === 'street') return { area: 'street', x: freeCurbX(Math.max(STREET.bounds.minX + 2, Math.min(STREET.bounds.maxX - 2, mx))) };
  if (area === 'avenue') return { area: 'avenue', x: Math.max(-13, Math.min(13, mx)) };
  if (area === 'restaurant') return { area: 'avenue', x: -4.5 };
  if (area === 'precinct') return { area: 'avenue', x: -12.5 };
  if (area === 'laundromat' || area === 'laundry_back') return { area: 'avenue', x: 5.0 };
  if (area === 'park') return { area: 'street', x: freeCurbX(PARK.gate.x) };
  const b = building(area);
  return { area: 'street', x: freeCurbX(b ? b.door : building('apartment').door) };
}

export function callRide(g) {
  const s = g.state;
  const r = rideState(s);
  if (r.status !== 'none') { g.toast('HailMary: your driver is already on the way. "Patience is a virtue," says the app, which has none.', 'info'); return false; }
  if (s.money < C().base) { g.toast(`HailMary: you need at least ${money(C().base)} on the card.`, 'bad'); return false; }
  const p = pickupFor(g);
  const eta = C().eta[0] + Math.floor(Math.random() * (C().eta[1] - C().eta[0] + 1));
  Object.assign(r, { status: 'coming', area: p.area, x: p.x, arriveAt: s.clock.m + eta, leaveAt: 0, driver: pick(C().drivers) });
  pushMessage(g, { from: 'HAILMARY', subject: 'ride', body: `${r.driver} is on the way in a black ${pick(['Lincoln', 'Town Car', 'Crown Vic', 'Cadillac'])}. ${eta} min. Meet at the curb ${p.area === 'avenue' ? 'on Ashby' : 'on Kestrel'}.` });
  return { eta, pickup: p };
}

export function cancelRide(g) {
  const s = g.state;
  const r = rideState(s);
  if (r.status === 'none') return false;
  r.status = 'none';
  g.spendMoney?.(Math.min(s.money, C().cancelFee), 'HailMary cancel fee');
  return true;
}

/** Game-time upkeep: the car arrives, waits, and gives up on him. */
export function tickRide(g) {
  const s = g.state;
  const r = rideState(s);
  if (r.status === 'coming' && s.clock.m >= r.arriveAt) {
    r.status = 'waiting';
    r.leaveAt = s.clock.m + C().waitMinutes;
    pushMessage(g, { from: 'HAILMARY', subject: 'ride', body: `Your driver has arrived. Black car at the curb. ${r.driver} waits ${C().waitMinutes} minutes, and he means it.` });
  }
  if (r.status === 'waiting' && s.clock.m >= r.leaveAt) {
    r.status = 'none';
    const fee = Math.min(s.money, C().cancelFee);
    if (fee > 0) s.money = Math.round((s.money - fee) * 100) / 100;
    pushMessage(g, { from: 'HAILMARY', subject: 'ride', body: `Your driver left. No-show fee: ${money(C().cancelFee)}. ${r.driver} has left you a one-star rating.` });
  }
}

/** The fare to a destination from here: base, plus a per-block hop when it is across town. */
export function fareTo(g, dest) {
  const here = AREA_GROUP[g.world?.areaId] || 'kestrel';
  return Math.round((C().base + (dest.group === here ? 0 : C().crossTown)) * 100) / 100;
}

/** Is this an "up the road" ask? Same block as where he is getting in. */
export function tooClose(g, dest) {
  const here = AREA_GROUP[g.world?.areaId] || 'kestrel';
  return dest.group === here;
}

/**
 * Get in and go. Same block: the driver will not drive it, keeps a stop fee, and Mo is still on
 * the curb. Otherwise: the ride, the fare, the door.
 */
export function ride(g, destId) {
  const s = g.state;
  const r = rideState(s);
  const dest = DESTINATIONS.find((d) => d.id === destId);
  if (!dest || r.status !== 'waiting') return null;
  if (tooClose(g, dest)) {
    g.spendMoney?.(Math.min(s.money, C().stopFee), 'HailMary stop fee');
    return { refused: true, line: pick(C().pushback) };
  }
  const fare = fareTo(g, dest);
  if (s.money < fare) return { broke: true };
  g.spendMoney(fare, `HailMary to ${dest.name}`);
  r.status = 'none';
  r.rides += 1;
  r.spent += fare;
  g.advance(C().minutes);
  logLine(g, `HailMary to ${dest.name} (${money(fare)}).`, 'info');
  // a closed place: he is dropped at its door outside, not let into a dark room
  if (!openAt(dest.area, s.clock.m)) g.goTo(dest.area === 'restaurant' ? 'avenue' : 'street', dest.area);
  else g.goTo(dest.area, dest.from);
  return { fare, dest, line: pick(C().rideLines) };
}
