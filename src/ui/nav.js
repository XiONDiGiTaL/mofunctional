/**
 * Navigation: the places Mo can go, grouped, with where their door is and whether they are open.
 * Selecting one marks it on the map and the minimap and draws a walking route on Kestrel; it never
 * moves him. Getting there is still his walk, his bus fare, his ride.
 *
 * `state.nav` holds the selected destination id.
 */
import { BUILDINGS, LANDMARKS, PARK, building, STREET } from '../world/plan.js';
import { openAt, hoursLabel } from '../world/hours.js';

// Ashby Avenue, in its own coordinates: reached by bus, HailMary, or a 45-minute walk
const ASHBY = [
  { id: 'lucias', name: "Lucia's", cat: 'Food', map: 'avenue', x: -4.5, z: -5.2, hours: 'restaurant', blurb: 'red sauce · a date' },
  { id: 'laundromat', name: "Dee's Wash & Fold", cat: 'Services', map: 'avenue', x: 5.0, z: -5.2, hours: 'laundromat', blurb: 'laundry · vending' },
  { id: 'precinct', name: '84th Precinct', cat: 'Services', map: 'avenue', x: -12.5, z: -5.2, blurb: 'police' },
  { id: 'pawn', name: 'Ashby Pawn & Gold', cat: 'Money', map: 'avenue', x: 10.5, z: -5.2, blurb: 'sell fast, cheap' },
  { id: 'newsstand', name: 'The newsstand', cat: 'Fun', map: 'avenue', x: 3.0, z: -2.5, blurb: 'papers · scratch-offs' },
];

const CAT = {
  apartment: 'Home', walkup: 'Home', bodega: 'Food', habibs: 'Food', quikstop: 'Work', church: 'Services', clinic: 'Services', alley: 'After dark',
};

/** Every destination: { id, name, cat, map: 'street'|'avenue'|'park', x, z, hours?, blurb } */
export function destinations() {
  const out = [];
  for (const b of BUILDINGS) {
    out.push({ id: b.id, name: b.name, cat: CAT[b.id] || 'Kestrel', map: 'street', x: b.door, z: STREET.doorZ, hours: b.area, floors: b.id === 'walkup' ? 5 : b.id === 'apartment' ? 'Unit 3B' : null, blurb: { quikstop: 'work · 24 hours', alley: 'Dex, after dark', apartment: 'home', walkup: 'five floors' }[b.id] || '' });
  }
  out.push({ id: 'park', name: 'Kestrel Park', cat: 'Fun', map: 'street', x: PARK.gate.x, z: 0.9, blurb: 'across the road · the crosswalk' });
  for (const l of LANDMARKS) {
    if (['clinic', 'parkgate', 'crosswalk'].includes(l.id)) continue;
    out.push({ id: l.id, name: l.name, cat: l.id === 'busstop' ? 'Travel' : l.id === 'board' ? 'Work' : 'Kestrel', map: 'street', x: l.x, z: l.z, blurb: { busstop: 'B44 to Ashby', board: 'odd jobs', payphone: 'coin return · Dex', lot: 'dice after dark', bench: 'sit', dumpster: 'no judgement' }[l.id] || '' });
  }
  for (const a of ASHBY) out.push(a);
  return out;
}

/** The pins of the room Mo is in (the fridge, the staff door): the map's list puts them under "Here". */
let HERE = [];
export function setHere(list) { HERE = list; }
export const destById = (id) => destinations().find((d) => d.id === id) || HERE.find((d) => d.id === id) || null;

/** "open now" / "closed · opens 06:00" / null for places that never close. */
export function accessLabel(d, m) {
  if (!d?.hours) return null;
  if (hoursLabel(d.hours) === 'open 24 hours') return 'open 24 hours';
  const open = openAt(d.hours, m);
  return open ? `open now · ${hoursLabel(d.hours)}` : `closed · ${hoursLabel(d.hours)}`;
}
export const isOpen = (d, m) => !d?.hours || openAt(d.hours, m);

/**
 * One line for the minimap: which way and how far, or what to do first.
 *   on Kestrel, target on Kestrel     → "Quik-Stop #14 · 12 m east"
 *   inside somewhere                  → "Quik-Stop #14 · exit first"
 *   target on Ashby, Mo on Kestrel    → "Lucia's · B44 from the bus stop, or HailMary"
 */
export function heading(g) {
  const d = destById(g.state?.nav);
  if (!d) return null;
  const area = g.world?.areaId;
  const mo = g.world?.mo?.root?.position;
  const onMap = (area === 'street' && d.map === 'street') || (area === 'avenue' && d.map === 'avenue') || (d.here && d.map === area);
  if (!onMap) {
    if (d.map === 'avenue' && area === 'street') return { text: `${d.name} · B44 from the bus stop, or HailMary`, dir: null };
    if (d.map === 'street' && area === 'avenue') return { text: `${d.name} · B44 back to Kestrel, or HailMary`, dir: null };
    return { text: `${d.name} · exit first`, dir: null };
  }
  const dx = d.x - mo.x, dz = d.z - mo.z;
  const dist = Math.hypot(dx, dz);
  if (dist < 2) return { text: `${d.name} · you are here`, dir: null, here: true };
  const ew = Math.abs(dx) > Math.abs(dz) ? (dx > 0 ? 'east' : 'west') : dz < 0 ? 'toward the buildings' : 'toward the road';
  return { text: `${d.name} · ${Math.round(dist)} m ${ew}`, dir: Math.atan2(dx, dz), dist };
}
