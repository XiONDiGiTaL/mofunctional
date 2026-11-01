/**
 * Kestrel Street as data: where each building stands, where its door is, where Mo comes out,
 * and the landmarks worth finding. The 3D street is built from these numbers and the map is
 * drawn from them, so the two can never disagree about where a door is.
 *
 * World axes: x runs along the street (west is negative), z runs from the building fronts
 * (about -6.5) out across the sidewalk (to the curb at 1.3) and the road beyond it.
 */
export const STREET = {
  // the block now runs east past Habib's to the clinic, so the walk is longer, not different
  // and west past the bodega to 1104, the walk-up
  // ...and east past the clinic to the vacant lot and the crosswalk to the park's east gate
  bounds: { minX: -25.4, maxX: 31.4, minZ: -5.6, maxZ: 1.4 },
  frontZ: -6.5,      // building faces
  curbZ: 1.3,
  roadZ: [1.5, 9.2],
  doorZ: -5.25,      // where a door's interaction point sits, just off the threshold
  outZ: -3.5,        // where Mo stands after coming out of a door (just outside its 1.6 m prompt)
};

/** Buildings along the back of the walk, west to east. `door` is the x of the entrance. */
export const BUILDINGS = [
  { id: 'walkup', name: '1104 Kestrel St.', short: '1104 WALK-UP', x0: -25.3, x1: -19.6, door: -22.4, area: 'walkup', color: '#6a5a6a', icon: 'home' },
  { id: 'bodega', name: 'Kestrel Bodega', short: 'BODEGA', x0: -19.1, x1: -13.9, door: -15.3, area: 'bodega', color: '#3f6b4a', icon: 'cart' },
  { id: 'apartment', name: '1120 Kestrel St.', short: 'HOME · 3B', x0: -13.1, x1: -6.5, door: -10.0, area: 'apartment', color: '#8a6a4a', icon: 'home' },
  { id: 'alley', name: 'The Alley', short: 'ALLEY', x0: -5.1, x1: -2.1, door: -3.6, area: null, color: '#3a4246', icon: 'alley', open: true },
  { id: 'quikstop', name: 'Quik-Stop #14', short: 'QUIK-STOP', x0: -1.6, x1: 4.6, door: 1.5, area: 'quikstop', color: '#2f6b5a', icon: 'work' },
  { id: 'church', name: 'The Golden Fellowship', short: 'FELLOWSHIP', x0: 8.8, x1: 14.2, door: 11.5, area: 'church', color: '#a8823a', icon: 'church' },
  { id: 'habibs', name: "Habib's Corner", short: "HABIB'S", x0: 14.6, x1: 19.1, door: 15.7, area: 'habibs', color: '#7a2a2a', icon: 'food' },
  { id: 'clinic', name: 'Kestrel Clinic', short: 'CLINIC', x0: 19.6, x1: 24.4, door: 21.6, area: 'clinic', color: '#5a7a86', icon: 'clinic' },
];

/**
 * Kestrel Park sits across the road from the block, east of the crosswalk. It is not a separate
 * map: it is a destination with a gate on Kestrel Street, so the map and the world agree.
 */
export const PARK = {
  name: 'Kestrel Park',
  x0: 4.2, x1: 13.4, z0: 4.2, z1: 9.4,
  gate: { x: 9.35, z: 3.2 },
  gateLabel: 'Cross to Kestrel Park',
};

/** Things on the walk worth a pin on the map. */
export const LANDMARKS = [
  { id: 'board', name: 'Job board', x: 5.0, z: -5.4, icon: 'board' },
  { id: 'busstop', name: 'Bus stop', x: 4.6, z: 0.4, icon: 'bus' },
  { id: 'bench', name: 'Bench', x: -7.5, z: 0.2, icon: 'bench' },
  { id: 'dumpster', name: 'Dumpster', x: -4.2, z: -5.2, icon: 'trash' },
  { id: 'payphone', name: 'Payphone', x: 12.9, z: -5.9, icon: 'phone' },
  { id: 'crosswalk', name: 'Crosswalk', x: 9.35, z: 4.6, icon: 'walk' },
  { id: 'parkgate', name: 'Kestrel Park', x: 9.35, z: 1.1, icon: 'park' },
  { id: 'clinic', name: 'Kestrel Clinic', x: 21.6, z: -5.2, icon: 'clinic' },
  { id: 'lot', name: 'The lot', x: 27.6, z: -3.6, icon: 'board' },
  { id: 'eastgate', name: 'Park · east gate', x: 28.4, z: 1.1, icon: 'park' },
];

/**
 * Kestrel's lanes: cars park along the near curb, traffic runs eastbound then westbound, and more
 * cars park along the far curb. Parked spots stay clear of both crosswalks; a HailMary car pulls
 * into a gap between them.
 */
export const ROAD = {
  parkNearZ: 2.35,
  laneEastZ: 4.4,
  laneWestZ: 6.7,
  parkFarZ: 8.35,
  parkedNear: [
    { x: -21.6, type: 'sedan', color: 0x5a6a78 }, { x: -16.4, type: 'compact', color: 0x7a1e1a },
    { x: -12.2, type: 'sedan', color: 0x8a8c90 }, { x: -4.6, type: 'compact', color: 0x2a4a5a },
    { x: 0.6, type: 'convertible', color: 0x1e3a6a }, { x: 15.4, type: 'sedan', color: 0xc8b070 },
    { x: 20.6, type: 'coupe', color: 0xc8121a }, { x: 25.0, type: 'compact', color: 0x2a2c30 },
  ],
  parkedFar: [
    { x: -18.5, type: 'compact', color: 0xa8a090 }, { x: -7.2, type: 'sedan', color: 0x3a5a3a },
    { x: 3.0, type: 'taxi' }, { x: 17.4, type: 'sedan', color: 0x6a4a3a }, { x: 22.6, type: 'gt', color: 0xf2f2f0 },
  ],
};

/** Where the dealer meets Mo: beside the apartment stoop, clear of both doors and the cart. */
export const MEET_SPOT = { x: -7.6, z: -4.2, label: 'the hydrant by the 1120 stoop' };

export const building = (id) => BUILDINGS.find((b) => b.id === id);

/** Where Mo stands on the street after leaving `from` (a building's area id). */
export function streetSpawn(from) {
  // off the B44, at the stop by the job board
  if (from === 'bus') return { x: 4.6, z: 0.9, rot: Math.PI };
  // back across the road from the park's east gate, at the lot's crosswalk
  if (from === 'eastgate') return { x: 28.4, z: -0.4, rot: Math.PI };
  // the park has no frontage on the block: Mo comes back through the gate by the crosswalk
  if (from === 'park') return { x: PARK.gate.x, z: -1.2, rot: Math.PI };
  const b = BUILDINGS.find((x) => x.area === from) || building('apartment');
  return { x: b.door, z: STREET.outZ, rot: Math.PI };
}
