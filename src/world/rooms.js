/**
 * Two small rooms with doors that lock from the inside.
 *
 *   buildBathroom  Unit 3B's bathroom: a toilet with a tank lid that lifts, a shower that has
 *                  not worked since before Mo moved in (which is why he washes at the sink), the
 *                  sink and its mirror. The tank is the one place in the flat a search does not
 *                  look: anything put in it stays out of his pockets until he takes it back.
 *   buildRestroom  Quik-Stop #14's public restroom: two stalls, a urinal, a sink with one tap
 *                  that works, a hand dryer that blows warm air on nothing, and the walls.
 */
import * as THREE from '../../vendor/three.module.js';
import { retroMaterial, box, plane } from '../render/retro.js';
import { tex } from '../render/textures.js';
import { signTex } from '../render/signs.js';
import { pick } from '../core/util.js';
import { bump, addItem, removeItem, inventoryList, countItem, itemDef } from '../core/state.js';
import * as okafor from '../systems/okafor.js';

const solid = (x, z, w, d, h = 2.4) => ({ x, z, w, d, h });

const M = {
  tile: () => retroMaterial('rm_tile', { map: tex('tile'), color: 0xe8e8e0 }),
  porcelain: () => retroMaterial('rm_porcelain', { color: 0xf2f2ee, ambient: 0.85 }),
  chrome: () => retroMaterial('rm_chrome', { color: 0xb8bcc0, ambient: 0.9 }),
  rust: () => retroMaterial('rm_rust', { color: 0x8a5a3a }),
};

/* ------------------------------------------------------------------ the toilet tank */

export function tankState(s) {
  if (!s.stash) s.stash = {};
  if (!s.stash.toilet) s.stash.toilet = {};
  return s.stash.toilet;
}

const itemName = (id) => itemDef(id)?.name || id;

/** Lift the lid: what is in there, and what he could put in or take out. */
export function tankMenu(g) {
  const s = g.state;
  const tank = tankState(s);
  const pocket = inventoryList(s).filter((i) => i.def.kind === 'substance');
  const inside = Object.entries(tank).filter(([, q]) => q > 0);
  g.openModal({
    kicker: 'UNIT 3B · THE BATHROOM',
    title: 'The Toilet Tank',
    body: `The lid comes up with a scrape of porcelain. A ziploc bag taped to the inside wall, above the waterline, where nobody who has ever searched an apartment on television thinks to look.\n\n${inside.length ? `In the bag: ${inside.map(([id, q]) => `${itemName(id)} x${q}`).join(', ')}.` : 'The bag is empty.'} Whatever is in here is not in your pockets.`,
    choices: [
      ...pocket.map((it) => ({
        label: `Stash the ${it.def.name} (x${it.qty}).`, sub: 'out of your pockets, into the tank',
        effect: () => { const q = countItem(s, it.id); removeItem(s, it.id, q); tank[it.id] = (tank[it.id] || 0) + q; g.toast(`The ${it.def.name} goes in the bag, the bag goes back on the wall, the lid goes back on.`, 'info'); },
      })),
      ...inside.map(([id, q]) => ({
        label: `Take out the ${itemName(id)} (x${q}).`, sub: 'back in your pockets',
        effect: () => { addItem(s, id, q); delete tank[id]; g.toast(`${itemName(id)}, damp at the corners. Back in your pocket.`, 'info'); },
      })),
      { label: 'Put the lid back.', sub: '', effect: () => {} },
    ],
  });
}

function wash(g, { minutes, hygiene, line }) {
  const s = g.state;
  g.advance(minutes);
  bump(s, 'hygiene', hygiene);
  bump(s, 'stress', -4);
  g.audio?.sfx?.('confirm');
  g.toast(line, 'good');
}

/* ------------------------------------------------------------------ Unit 3B's bathroom */

export function buildBathroom(g) {
  const group = new THREE.Group();
  const W = 2.6, D = 3.0;
  group.add(plane(W, D, { name: 'ba_floor', map: tex('tile'), color: 0xc8d0d0 }, [0, 0, 0], [-Math.PI / 2, 0, 0]));
  group.add(plane(W, D, { name: 'ba_ceil', map: tex('ceiling') }, [0, 2.5, 0], [Math.PI / 2, 0, 0]));
  const wall = retroMaterial('ba_wall', { map: tex('tile'), color: 0xb8c8c0 });
  group.add(box(0.12, 2.5, D, wall, [-W / 2, 1.25, 0]));
  group.add(box(0.12, 2.5, D, wall, [W / 2, 1.25, 0]));
  group.add(box(W, 2.5, 0.12, wall, [0, 1.25, -D / 2]));
  group.add(box(W, 2.5, 0.12, wall, [0, 1.25, D / 2]));
  // the door back out to the flat
  group.add(box(0.9, 2.1, 0.08, retroMaterial('ba_door', { map: tex('door') }), [0.6, 1.05, D / 2 - 0.08]));
  // the toilet: bowl, seat, and the tank with its lid
  const p = M.porcelain();
  group.add(box(0.42, 0.4, 0.55, p, [-0.75, 0.2, -1.0]));
  group.add(box(0.44, 0.04, 0.5, retroMaterial('ba_seat', { color: 0xe8e4d8 }), [-0.75, 0.42, -0.98]));
  group.add(box(0.5, 0.42, 0.2, p, [-0.75, 0.66, -1.3]));
  group.add(box(0.54, 0.05, 0.24, p, [-0.75, 0.89, -1.3]));
  group.add(box(0.08, 0.03, 0.03, M.chrome(), [-0.98, 0.8, -1.18]));
  // the shower: a tub-height tray, a curtain on a bent rail, a head that drips rust, and the sign
  group.add(box(0.95, 0.3, 1.1, p, [0.75, 0.15, -0.9]));
  group.add(box(0.85, 0.02, 1.0, M.rust(), [0.75, 0.31, -0.9]));
  group.add(box(0.03, 0.03, 1.1, M.chrome(), [0.27, 2.0, -0.9]));
  group.add(plane(1.1, 1.6, { name: 'ba_curtain', color: 0x8ac0c8, opacity: 0.8, transparent: true, doubleSide: true }, [0.28, 1.2, -0.9], [0, Math.PI / 2, 0]));
  group.add(box(0.12, 0.06, 0.12, M.chrome(), [0.75, 1.95, -1.38]));
  group.add(plane(0.55, 0.22, { name: 'ba_broken', map: signTex('baBroken', [{ text: 'BROKEN · USE SINK', color: '#c8281e', size: 7 }], { w: 64, h: 16, bg: '#f2f0e8', border: '#c8281e' }) }, [0.75, 1.45, -1.43]));
  // the sink and the mirror, the cabinet with nothing in it
  group.add(box(0.5, 0.16, 0.4, p, [-0.75, 0.82, 0.6]));
  group.add(box(0.12, 0.8, 0.12, p, [-0.75, 0.4, 0.6]));
  group.add(box(0.04, 0.12, 0.04, M.chrome(), [-0.75, 0.96, 0.44]));
  group.add(box(0.04, 0.7, 0.55, retroMaterial('ba_mirror', { color: 0xa8c0c8, emissive: 0.25 }), [-W / 2 + 0.08, 1.55, 0.6]));
  group.add(box(0.2, 0.06, 0.06, retroMaterial('ba_light', { color: 0xfff2c4, emissive: 1, unlit: true }), [-W / 2 + 0.1, 2.0, 0.6]));

  const interactables = [
    { id: 'ba_tank', label: 'Lift the toilet tank lid', sub: 'the one place a search does not look', x: -0.75, z: -0.45, radius: 0.75, action: (gg) => tankMenu(gg) },
    { id: 'ba_sink', label: 'Wash up at the sink', sub: '+hygiene · 25 min', x: -0.35, z: 0.6, radius: 0.75, action: (gg) => wash(gg, { minutes: 25, hygiene: 32, line: 'Pits, face, neck, a washcloth round the back. Clean enough to be trusted with a register.' }) },
    { id: 'ba_shower', label: 'Try the shower', sub: 'it says BROKEN', x: 0.75, z: -0.15, radius: 0.75, action: (gg) => { gg.advance(2); gg.toast(pick(['The handle turns all the way round and the pipes clear their throat. A drip of something brown. That is all.', 'You stand in the tray and pray. The showerhead coughs once, like it is sorry.', 'Rae said "next week" about the shower in March. It is not March.']), 'info'); } },
    { id: 'ba_exit', label: 'Back into the flat', sub: '', x: 0.6, z: D / 2 - 0.5, radius: 0.7, action: (gg) => gg.goTo('apartment', 'bathroom') },
  ];
  return {
    group,
    bounds: { minX: -W / 2 + 0.25, maxX: W / 2 - 0.25, minZ: -D / 2 + 0.3, maxZ: D / 2 - 0.25 },
    solids: [solid(-0.75, -1.1, 0.55, 0.75, 0.9), solid(0.75, -0.9, 1.0, 1.15, 0.35), solid(-0.75, 0.6, 0.5, 0.42, 0.9)],
    spawn: { x: 0.4, z: 0.7, rot: Math.PI },
    spawnFor: () => ({ x: 0.4, z: 0.7, rot: Math.PI }),
    npcs: [],
    interactables,
    ambient: 'apartment',
    title: 'Unit 3B · the bathroom',
  };
}

/* ------------------------------------------------------------------ Quik-Stop #14's restroom */

const STALL_LINES = [
  'On the stall door, in marker: "DALE WAS HERE." Under it, in different marker: "DALE IS ALWAYS HERE."',
  'Someone has carved a phone number and, very neatly, "FOR A GOOD TIME CALL YOUR MOTHER".',
  'A sticker for a lawyer who will fight for you. Even here.',
  'Somebody has written the whole first verse of a song you half know. The second verse is in a different pen and is worse.',
];

/**
 * The Kestrel Clinic's supply room: steel shelves of gauze and gloves, a cot, a small sink and a
 * mirror, the supply fridge humming. Mo comes round on the cot after his hour with Okafor; she is at
 * the mirror putting herself back together (systems/okafor.js backroomWake).
 */
export function buildClinicBack(g) {
  const group = new THREE.Group();
  const W = 3.6, D = 3.4;
  group.add(plane(W, D, { name: 'cb_floor', map: tex('tile'), color: 0xb8c4c0 }, [0, 0, 0], [-Math.PI / 2, 0, 0]));
  group.add(plane(W, D, { name: 'cb_ceil', map: tex('ceiling') }, [0, 2.6, 0], [Math.PI / 2, 0, 0]));
  const wall = retroMaterial('cb_wall', { color: 0x2a8a84 });
  group.add(box(0.12, 2.6, D, wall, [-W / 2, 1.3, 0]));
  group.add(box(0.12, 2.6, D, wall, [W / 2, 1.3, 0]));
  group.add(box(W, 2.6, 0.12, wall, [0, 1.3, -D / 2]));
  group.add(box(W, 2.6, 0.12, wall, [0, 1.3, D / 2]));
  group.add(box(0.95, 2.15, 0.08, retroMaterial('cb_door', { color: 0x8a9aa0 }), [1.0, 1.08, D / 2 - 0.07]));
  group.add(box(1.4, 0.06, 0.16, retroMaterial('cb_tube', { color: 0xf2f8ff, emissive: 1, unlit: true }), [0, 2.56, 0]));
  // shelves of boxes along the back wall
  const steel = retroMaterial('cb_steel', { color: 0x9aa0a4 });
  for (const y of [0.4, 0.95, 1.5, 2.05]) group.add(box(2.2, 0.04, 0.45, steel, [-0.4, y, -D / 2 + 0.3]));
  for (const x of [-1.5, 0.7]) group.add(box(0.04, 2.1, 0.45, steel, [x, 1.05, -D / 2 + 0.3]));
  const boxes = [0xf2f2ec, 0x6ab0e8, 0xe8e0c8, 0xf2f2ec, 0x8ac8a0];
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) group.add(box(0.4, 0.3, 0.36, retroMaterial(`cb_box${(r + c) % 5}`, { color: boxes[(r + c) % 5] }), [-1.25 + c * 0.55, 0.58 + r * 0.55, -D / 2 + 0.3]));
  // the cot, a pillow, a blanket half off it
  group.add(box(0.75, 0.4, 1.9, steel, [-1.25, 0.2, 0.55]));
  group.add(box(0.72, 0.1, 1.86, retroMaterial('cb_mattress', { color: 0xe8ecec }), [-1.25, 0.45, 0.55]));
  group.add(box(0.5, 0.1, 0.32, retroMaterial('cb_pillow', { color: 0xf8f8f4 }), [-1.25, 0.55, -0.2]));
  group.add(box(0.76, 0.05, 1.0, retroMaterial('cb_blanket', { color: 0x4a6a9a }), [-1.15, 0.52, 0.95], [0, 0, 0.15]));
  // the sink and the mirror on the right wall, the supply fridge in the corner
  group.add(box(0.5, 0.16, 0.4, M.porcelain(), [W / 2 - 0.3, 0.85, 0.2]));
  group.add(box(0.04, 0.7, 0.5, retroMaterial('cb_mirror', { color: 0xa8b8c0, emissive: 0.25 }), [W / 2 - 0.07, 1.5, 0.2]));
  group.add(box(0.6, 1.4, 0.6, retroMaterial('cb_fridge', { color: 0xe8ecec }), [W / 2 - 0.4, 0.7, -D / 2 + 0.4]));

  const interactables = [
    { id: 'cb_out', label: 'Back out to the clinic', sub: 'walk like you had a flu shot', x: 1.0, z: D / 2 - 0.55, radius: 0.8, action: (gg) => gg.goTo('clinic', 'clinicback') },
    { id: 'cb_sink', label: 'Wash up at the little sink', sub: '+hygiene · 5 min', x: W / 2 - 0.65, z: 0.2, radius: 0.7, action: (gg) => wash(gg, { minutes: 5, hygiene: 10, line: 'Surgical soap, which smells like a hospital and a little like her.' }) },
  ];
  return {
    group,
    bounds: { minX: -W / 2 + 0.25, maxX: W / 2 - 0.25, minZ: -D / 2 + 0.65, maxZ: D / 2 - 0.25 },
    solids: [solid(-1.25, 0.55, 0.8, 1.95, 0.55), solid(W / 2 - 0.3, 0.2, 0.5, 0.45, 0.9), solid(W / 2 - 0.4, -D / 2 + 0.4, 0.6, 0.6, 1.4)],
    spawn: { x: -0.6, z: 0.4, rot: Math.PI / 2 },
    spawnFor: () => ({ x: -0.6, z: 0.4, rot: Math.PI / 2 }),
    npcs: [{ kind: 'nurse', x: W / 2 - 0.55, z: 0.25, rot: Math.PI / 2, still: true, act: 'phone' }],
    interactables,
    ambient: 'clinic',
    tick: (gg) => okafor.backroomWake(gg),
    title: 'Kestrel Clinic · the supply room',
  };
}

export function buildRestroom(g) {
  const group = new THREE.Group();
  const W = 3.4, D = 3.6;
  group.add(plane(W, D, { name: 'rr_floor', map: tex('tile'), color: 0xa8b0a8 }, [0, 0, 0], [-Math.PI / 2, 0, 0]));
  group.add(plane(W, D, { name: 'rr_ceil', map: tex('ceiling') }, [0, 2.6, 0], [Math.PI / 2, 0, 0]));
  const wall = retroMaterial('rr_wall', { map: tex('tile'), color: 0xc8c8b8 });
  group.add(box(0.12, 2.6, D, wall, [-W / 2, 1.3, 0]));
  group.add(box(0.12, 2.6, D, wall, [W / 2, 1.3, 0]));
  group.add(box(W, 2.6, 0.12, wall, [0, 1.3, -D / 2]));
  group.add(box(W, 2.6, 0.12, wall, [0, 1.3, D / 2]));
  group.add(box(0.1, 2.2, 0.9, retroMaterial('rr_door', { color: 0x8a1e22 }), [W / 2 - 0.07, 1.1, 1.2]));
  group.add(box(1.4, 0.06, 0.16, retroMaterial('rr_tube', { color: 0xf2f8ff, emissive: 1, unlit: true }), [0, 2.56, 0]));
  // two stalls along the back wall: grey partitions, doors ajar, a toilet in each
  const part = retroMaterial('rr_partition', { color: 0x6a7470 });
  const p = M.porcelain();
  for (const [i, x] of [[0, -1.15], [1, -0.15]].map(([i, x]) => [i, x])) {
    group.add(box(0.05, 1.8, 1.3, part, [x - 0.5, 1.05, -1.1]));
    group.add(box(0.42, 0.4, 0.55, p, [x, 0.2, -1.4]));
    group.add(box(0.44, 0.05, 0.5, retroMaterial('rr_seat', { color: 0x2a2a2a }), [x, 0.42, -1.38]));
    group.add(box(0.5, 0.42, 0.18, p, [x, 0.66, -1.7]));
    // the door, swung half open
    const d = new THREE.Group();
    d.position.set(x - 0.48, 0, -0.45);
    d.rotation.y = -0.9 - i * 0.3;
    d.add(box(0.9, 1.7, 0.04, part, [0.45, 1.05, 0]));
    group.add(d);
  }
  group.add(box(0.05, 1.8, 1.3, part, [0.35, 1.05, -1.1]));
  // the urinal, the sink and its mirror, the dryer
  group.add(box(0.4, 0.6, 0.3, p, [0.95, 0.9, -1.6]));
  group.add(box(0.55, 0.16, 0.42, p, [1.35, 0.84, 0.9]));
  group.add(box(0.04, 0.8, 0.6, retroMaterial('rr_mirror', { color: 0x98a8b0, emissive: 0.2 }), [W / 2 - 0.07, 1.55, 0.2]));
  group.add(box(0.12, 0.28, 0.22, M.chrome(), [W / 2 - 0.08, 1.15, -0.5]));
  group.add(plane(0.6, 0.34, { name: 'rr_wash', map: signTex('rrWash', [{ text: 'EMPLOYEES MUST', color: '#1a1a1a', size: 5 }, { text: 'WASH HANDS', color: '#1a1a1a', size: 7 }], { w: 64, h: 28, bg: '#f2f0e8', border: '#1a1a1a' }) }, [W / 2 - 0.07, 1.6, 0.95], [0, -Math.PI / 2, 0]));
  group.add(plane(0.9, 0.5, { name: 'rr_tag', map: signTex('rrTag', [{ text: 'QS14 4EVA', color: '#2a6aff', size: 10 }], { w: 64, h: 28, bg: '#00000000', border: null }), alphaTest: 0.4 }, [-W / 2 + 0.07, 1.4, 0.8], [0, Math.PI / 2, 0]));

  const interactables = [
    { id: 'rr_stall', label: 'Use a stall', sub: '5 min · lock the door', x: -0.65, z: -0.3, radius: 0.8, action: (gg) => { gg.advance(5); bump(gg.state, 'stress', -2); gg.toast(pick(STALL_LINES), 'info'); } },
    { id: 'rr_sink', label: 'Wash up in the restroom', sub: '+hygiene · 15 min · one tap works', x: 1.0, z: 0.6, radius: 0.8, action: (gg) => wash(gg, { minutes: 15, hygiene: 18, line: 'Cold water, pink soap from a pump that fights you, paper towels that are mostly an idea. Better.' }) },
    { id: 'rr_dryer', label: 'The hand dryer', sub: '', x: 1.15, z: -0.5, radius: 0.6, action: (gg) => gg.toast('It roars for nine seconds and blows warm air on nothing in particular. Your hands remain wet.', 'info') },
    { id: 'rr_exit', label: 'Back into the store', sub: '', x: W / 2 - 0.55, z: 1.2, radius: 0.7, action: (gg) => gg.goTo('quikstop', 'restroom') },
  ];
  return {
    group,
    bounds: { minX: -W / 2 + 0.25, maxX: W / 2 - 0.25, minZ: -D / 2 + 0.3, maxZ: D / 2 - 0.25 },
    solids: [solid(-1.15, -1.45, 0.6, 0.8, 0.9), solid(-0.15, -1.45, 0.6, 0.8, 0.9), solid(0.95, -1.62, 0.5, 0.4, 1.2), solid(1.35, 0.9, 0.6, 0.5, 0.9),
      solid(-1.65, -1.1, 0.08, 1.3, 1.8), solid(-0.65, -1.1, 0.08, 1.3, 1.8), solid(0.35, -1.1, 0.08, 1.3, 1.8)],
    spawn: { x: 0.9, z: 1.2, rot: -Math.PI / 2 },
    spawnFor: () => ({ x: 0.9, z: 1.2, rot: -Math.PI / 2 }),
    npcs: [],
    interactables,
    ambient: 'street',
    title: 'Quik-Stop #14 · the restroom',
  };
}
