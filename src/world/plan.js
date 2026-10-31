/**
 * Kestrel Street as data: where each building stands, where its door is, where Mo comes out,
 * and the landmarks worth finding. The 3D street is built from these numbers and the map is
 * drawn from them, so the two can never disagree about where a door is.
 *
 * World axes: x runs along the street (west is negative), z runs from the building fronts
 * (about -6.5) out across the sidewalk (to the curb at 1.3) and the road beyond it.
 */
export const STREET = {
  bounds: { minX: -19.2, maxX: 19.2, minZ: -5.6, maxZ: 1.4 },
  frontZ: -6.5,      // building faces
  curbZ: 1.3,
  roadZ: [1.5, 9.2],
  doorZ: -5.25,      // where a door's interaction point sits, just off the threshold
  outZ: -3.5,        // where Mo stands after coming out of a door (just outside its 1.6 m prompt)
};

/** Buildings along the back of the walk, west to east. `door` is the x of the entrance. */
export const BUILDINGS = [
  { id: 'bodega', name: 'Kestrel Bodega', short: 'BODEGA', x0: -19.1, x1: -13.9, door: -15.3, area: 'bodega', color: '#3f6b4a', icon: 'cart' },
  { id: 'apartment', name: '1120 Kestrel St.', short: 'HOME · 3B', x0: -13.1, x1: -6.5, door: -10.0, area: 'apartment', color: '#8a6a4a', icon: 'home' },
  { id: 'alley', name: 'The Alley', short: 'ALLEY', x0: -5.1, x1: -2.1, door: -3.6, area: null, color: '#3a4246', icon: 'alley', open: true },
  { id: 'quikstop', name: 'Quik-Stop #14', short: 'QUIK-STOP', x0: -1.6, x1: 4.6, door: 1.5, area: null, color: '#2f6b5a', icon: 'work' },
  { id: 'church', name: 'The Golden Fellowship', short: 'FELLOWSHIP', x0: 8.8, x1: 14.2, door: 11.5, area: 'church', color: '#a8823a', icon: 'church' },
  { id: 'habibs', name: "Habib's Corner", short: "HABIB'S", x0: 14.6, x1: 19.1, door: 15.7, area: 'habibs', color: '#7a2a2a', icon: 'food' },
];

/** Things on the walk worth a pin on the map. */
export const LANDMARKS = [
  { id: 'board', name: 'Job board', x: 5.0, z: -5.4, icon: 'board' },
  { id: 'busstop', name: 'Bus stop', x: 6.6, z: -5.2, icon: 'bus' },
  { id: 'bench', name: 'Bench', x: -7.5, z: 0.2, icon: 'bench' },
  { id: 'dumpster', name: 'Dumpster', x: -4.2, z: -5.2, icon: 'trash' },
  { id: 'payphone', name: 'Payphone', x: 12.9, z: -5.9, icon: 'phone' },
  { id: 'crosswalk', name: 'Crosswalk', x: 9.35, z: 4.6, icon: 'walk' },
];

/** Where the dealer meets Mo: beside the apartment stoop, clear of both doors and the cart. */
export const MEET_SPOT = { x: -7.6, z: -4.2, label: 'the hydrant by the 1120 stoop' };

export const building = (id) => BUILDINGS.find((b) => b.id === id);

/** Where Mo stands on the street after leaving `from` (a building's area id). */
export function streetSpawn(from) {
  const b = BUILDINGS.find((x) => x.area === from) || building('apartment');
  return { x: b.door, z: STREET.outZ, rot: Math.PI };
}
