/**
 * The brownstone on 7th Avenue, Park Slope: bought through the Properties app, and once it is his,
 * somewhere to live. The parlour floor is white walls and old wood: a long beige sofa under a big
 * framed print, a black glass coffee table, two white armchairs, recessed lights, a kitchen along
 * the back wall, stairs up to the bedroom, a bathroom in subway tile with black fixtures. Sliding
 * glass doors open onto the yard: stone pavers, a cedar fence, a green bistro table, a planter.
 *
 * In the yard he can sit, smoke, and have people over (a girlfriend, Nia, Kev); and the brownstone
 * has its own catalogue for the yard and the parlour: string lights, a grill, a fire pit, a hammock,
 * a record player, a real piece of art, a hot tub.
 *
 * Moving in makes it home (`home.residence`): the morning after, the walk home after a date, a
 * reload all land here, and Unit 3B's lease can be given up.
 */
import * as THREE from '../../vendor/three.module.js';
import { retroMaterial, box, plane } from '../render/retro.js';
import { tex } from '../render/textures.js';
import { CONFIG } from '../core/config.js';
import { bump, logLine, addItem, removeItem, pushMessage } from '../core/state.js';
import { model } from '../render/models.js';
import { openTv } from '../ui/tv.js';
import * as music from '../systems/music.js';
import { dayOf, pick, money } from '../core/util.js';
import { sleep } from '../systems/needs.js';
import { homeState } from '../systems/home.js';
import * as romance from '../systems/romance.js';
import { showFridge } from '../ui/fridge.js';

const solid = (x, z, w, d, h = 2.4) => ({ x, z, w, d, h });

export const BS_UPGRADES = [
  { id: 'lights', name: 'String lights over the yard', price: 80, note: 'warm bulbs on a zigzag wire · evenings in the yard are better' },
  { id: 'grill', name: 'A charcoal grill', price: 150, note: 'cook out back · a real meal, and the smell over the fence' },
  { id: 'firepit', name: 'A fire pit', price: 220, note: 'a steel bowl and a stack of wood · nights out back' },
  { id: 'hammock', name: 'A hammock', price: 120, note: 'strung between the fence posts · a nap that counts' },
  { id: 'records', name: 'A record player and a crate of records', price: 180, note: 'on the sideboard · the parlour sounds like 1974' },
  { id: 'art', name: 'A real piece of art', price: 260, note: 'from a gallery on 5th · over the sofa, where the print was' },
  { id: 'hottub', name: 'A hot tub', price: 900, note: 'in the corner of the yard · the neighbours have opinions' },
  // each of these earns its keep every day: a use, a cost in time, a benefit
  { id: 'tv', name: 'A flatscreen TV', price: 340, note: 'the nine channels, big · an hour on the sofa, alone or with somebody' },
  { id: 'stereo', name: 'A real stereo with speakers', price: 420, needs: 'records', note: 'your records, your demo, for a guest · needs the record player' },
  { id: 'kitchen', name: 'A six-burner stove', price: 650, note: 'a $2 pot of rice and beans that feeds you for two days' },
  { id: 'washer', name: 'A washer-dryer in the basement', price: 560, note: 'stop paying Dee\'s · an hour, clean clothes, free' },
  { id: 'spareroom', name: 'Fix up the spare room for a tenant', price: 900, note: '$160 a week from a tenant · who is sometimes late' },
  { id: 'studio', name: 'A home studio corner', price: 480, note: 'record demos with nobody vacuuming upstairs' },
  { id: 'safe', name: 'A floor safe', price: 380, note: 'under the stairs · keep the stash and the cash at home, not in your pockets' },
];

export function bsState(s) {
  if (!s.brownstone) s.brownstone = { owned: [], guest: null, uses: {} };
  s.brownstone.owned = s.brownstone.owned || [];
  s.brownstone.uses = s.brownstone.uses || {};
  return s.brownstone;
}
const hasUp = (s, id) => bsState(s).owned.includes(id);
const usedToday = (s, id) => bsState(s).uses[id] === dayOf(s.clock.m);
const use = (s, id) => { bsState(s).uses[id] = dayOf(s.clock.m); };

export function buildBrownstone(g) {
  const s = g.state;
  const b = bsState(s);
  const group = new THREE.Group();
  const M = (n, c, extra = {}) => retroMaterial(`bs_${n}`, { color: c, ...extra });
  const white = M('wall', 0xf4f2ee, { ambient: 0.75 });

  /* ---------------------------------------------- the parlour floor */
  group.add(plane(10, 8, { name: 'bs_floor', map: tex('wood'), color: 0xc8925a, repeat: [5, 4] }, [0, 0, -2], [-Math.PI / 2, 0, 0]));
  group.add(plane(10, 8, { name: 'bs_ceil', color: 0xf8f8f4 }, [0, 2.9, -2], [Math.PI / 2, 0, 0]));
  for (const [x, z] of [[-3, -4], [0, -4], [3, -4], [-3, -1], [0, -1], [3, -1], [-3, 1.2], [0, 1.2]]) group.add(new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.02, 10), M('can', 0xfffaf0, { emissive: 1, unlit: true })).translateX(x).translateY(2.88).translateZ(z));
  group.add(box(0.14, 2.9, 8, white, [-5, 1.45, -2]));
  group.add(box(0.14, 2.9, 8, white, [5, 1.45, -2]));
  group.add(box(10, 2.9, 0.14, white, [0, 1.45, -6]));
  // the back wall: glass doors onto the yard between two pieces of wall
  group.add(box(4.0, 2.9, 0.14, white, [-3.0, 1.45, 2]));
  group.add(box(1.6, 2.9, 0.14, white, [4.2, 1.45, 2]));
  group.add(box(5.0, 0.4, 0.14, white, [1.0, 2.7, 2]));
  for (const x of [-1.0, 0.9, 3.4]) group.add(box(0.08, 2.5, 0.12, M('frame', 0xf2f2ec), [x, 1.25, 2]));
  group.add(plane(1.8, 2.4, { name: 'bs_glassL', color: 0xb8d8e8, opacity: 0.25, transparent: true, emissive: 0.2 }, [2.2, 1.2, 2.0]));
  // the front door, north
  group.add(box(1.0, 2.2, 0.1, M('door', 0x2a2a2e), [0.5, 1.1, -5.92]));
  group.add(plane(0.5, 0.3, { name: 'bs_transom', map: tex('window'), emissive: 0.4, unlit: true }, [0.5, 2.45, -5.92]));

  // living: the sofa along the west wall facing east, the big print over it, the side table and lamp
  const linen = M('linen', 0xc8b89a, { ambient: 0.7 });
  group.add(box(0.9, 0.42, 2.8, linen, [-4.35, 0.32, -2.2]));
  group.add(box(0.25, 0.6, 2.8, linen, [-4.75, 0.6, -2.2]));
  for (const z of [-3.6, -0.8]) group.add(box(0.9, 0.5, 0.25, linen, [-4.35, 0.45, z]));
  for (const [z, c] of [[-2.9, 0x5a5a32], [-2.3, 0x141414], [-1.6, 0x4a5a3a]]) group.add(box(0.15, 0.32, 0.38, M(`pillow${c}`, c), [-4.55, 0.68, z]));
  group.add(box(0.04, 0.12, 2.9, M('sofafeet', 0x5a3a24), [-4.35, 0.06, -2.2]));
  if (hasUp(s, 'art')) {
    group.add(box(0.06, 1.5, 2.0, M('artframe', 0xc8a050), [-4.92, 1.9, -2.2]));
    group.add(plane(1.9, 1.4, { name: 'bs_art2', color: 0x2a4a8a, emissive: 0.15 }, [-4.88, 1.9, -2.2], [0, Math.PI / 2, 0]));
    group.add(new THREE.Mesh(new THREE.CircleGeometry(0.45, 10), M('artsun', 0xe8902a, { emissive: 0.2 })).rotateY(Math.PI / 2).translateZ(0).translateX(0.2).translateY(1.95).translateZ(4.86));
  } else {
    group.add(box(0.05, 1.3, 1.7, M('printframe', 0x141414), [-4.92, 1.85, -2.2]));
    group.add(plane(1.55, 1.15, { name: 'bs_print', color: 0xe8d8c0, emissive: 0.1 }, [-4.88, 1.85, -2.2], [0, Math.PI / 2, 0]));
    group.add(new THREE.Mesh(new THREE.CircleGeometry(0.4, 9), M('printblob', 0x2a2a2e)).rotateY(Math.PI / 2).translateY(1.85).translateZ(4.87).translateX(2.2));
  }
  group.add(new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.02, 14), M('glass', 0xc8d8dc, { opacity: 0.5, transparent: true })).translateX(-4.3).translateY(0.62).translateZ(0.2));
  group.add(box(0.05, 0.6, 0.05, M('sideleg', 0xd8d8d4), [-4.3, 0.31, 0.2]));
  group.add(new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.16, 0.4, 8), M('lampbase', 0xc8c4bc)).translateX(-4.3).translateY(0.82).translateZ(0.2));
  group.add(new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.28, 12), M('lampshade', 0xfffaf0, { emissive: 0.6 })).translateX(-4.3).translateY(1.15).translateZ(0.2));
  // the rug, the black glass table, the two white armchairs facing the sofa
  group.add(plane(3.4, 3.0, { name: 'bs_rug', color: 0xd8c8a8 }, [-2.6, 0.01, -2.2], [-Math.PI / 2, 0, 0]));
  group.add(plane(3.4, 0.3, { name: 'bs_rugband', color: 0x141414 }, [-2.6, 0.012, -0.85], [-Math.PI / 2, 0, 0]));
  group.add(box(1.0, 0.04, 1.4, M('blackglass', 0x141418, { emissive: 0.05 }), [-3.0, 0.4, -2.2]));
  for (const z of [-2.8, -1.6]) group.add(box(0.9, 0.38, 0.04, M('blackglass', 0x141418), [-3.0, 0.2, z]));
  for (const z of [-3.4, -1.0]) {
    group.add(box(0.8, 0.36, 0.8, M('chair', 0xf2efe6), [-1.35, 0.36, z]));
    group.add(box(0.15, 0.7, 0.8, M('chair', 0xf2efe6), [-0.95, 0.7, z]));
    for (const dz of [-0.4, 0.4]) group.add(box(0.85, 0.03, 0.03, M('chairframe', 0x141414), [-1.3, 0.55, z + dz]));
  }
  // kitchen along the north wall, west of the door
  group.add(box(3.6, 0.9, 0.6, M('counter', 0x2a2a2e), [-3.0, 0.45, -5.6]));
  group.add(box(3.62, 0.05, 0.62, M('countertop', 0xe8e4dc), [-3.0, 0.92, -5.6]));
  group.add(box(0.7, 1.9, 0.7, M('fridge', 0xc8ccd0), [-0.8, 0.95, -5.55]));
  // the stairs, east, climbing north, a black rail
  for (let i = 0; i < 9; i++) group.add(box(0.9, 0.16 * (i + 1), 0.3, M('stair', 0xb08a5a), [4.4, 0.08 * (i + 1), 0.4 - i * 0.3]));
  group.add(box(0.04, 1.0, 2.8, M('rail', 0x141414), [3.92, 1.4, -0.8], [0.4, 0, 0]));
  // the bathroom: northeast, walled, subway tile, a tub with a glass screen, black fixtures
  const tile = M('tile', 0xf4f4f2, { map: tex('tile') });
  group.add(box(0.1, 2.9, 1.4, white, [2.2, 1.45, -5.3]));
  group.add(box(2.8, 2.9, 0.1, white, [3.6, 1.45, -3.6]));
  group.add(box(2.7, 1.4, 0.04, tile, [3.6, 0.7, -5.9]));
  group.add(box(1.7, 0.55, 0.75, M('tub', 0xf8f8f6), [3.9, 0.28, -5.5]));
  group.add(plane(0.9, 1.4, { name: 'bs_screen', color: 0xc8e0e8, opacity: 0.3, transparent: true }, [3.4, 1.25, -5.1]));
  group.add(box(0.7, 0.18, 0.45, M('marble', 0xf2f0ec), [2.8, 0.85, -4.0]));
  group.add(box(0.04, 0.8, 0.04, M('blackframe', 0x141414), [2.5, 0.42, -4.0]));
  group.add(box(0.04, 0.8, 0.04, M('blackframe', 0x141414), [3.1, 0.42, -4.0]));
  group.add(box(0.55, 0.65, 0.03, M('mirror', 0xa8c0c8, { emissive: 0.25 }), [2.8, 1.6, -3.66]));

  /* ---------------------------------------------- the yard */
  group.add(plane(10, 6.8, { name: 'bs_pavers', map: tex('concrete'), color: 0xc8c4bc, repeat: [5, 3] }, [0, 0.005, 5.4], [-Math.PI / 2, 0, 0]));
  const cedar = M('cedar', 0xb8683a, { ambient: 0.7 });
  for (let x = -5; x <= 5; x += 0.25) group.add(box(0.24, 2.0, 0.05, cedar, [x, 1.0, 8.8]));
  for (let z = 2.1; z <= 8.8; z += 0.25) { group.add(box(0.05, 2.0, 0.24, cedar, [-5, 1.0, z])); group.add(box(0.05, 2.0, 0.24, cedar, [5, 1.0, z])); }
  // buildings behind the fence, a tree leaning over it
  for (const [x, h, c] of [[-3, 9, 0xd8d4c8], [2.5, 11, 0x8a4a3a], [7, 8, 0xa87a5a]]) {
    group.add(box(5, h, 3, M(`back${c}`, c, { map: tex('brick') }), [x, h / 2, 13]));
    for (let wy = 3; wy < h - 1; wy += 2) for (const dx of [-1.4, 0, 1.4]) group.add(plane(0.8, 1.1, { name: 'bs_backwin', map: tex('window'), emissive: 0.3, unlit: true }, [x + dx, wy, 11.48], [0, Math.PI, 0]));
  }
  group.add(box(0.3, 3.2, 0.3, M('trunk', 0x5a3a24), [-4.4, 1.6, 9.6]));
  group.add(new THREE.Mesh(new THREE.IcosahedronGeometry(2.2, 0), M('leaves', 0x3a7a3a)).translateX(-3.6).translateY(4.2).translateZ(9.2));
  // the bistro table and four chairs, the planter, a pot
  const green = M('green', 0x5a8a5a, { ambient: 0.7 });
  group.add(new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.04, 14), green).translateX(0.6).translateY(0.74).translateZ(5.2));
  group.add(box(0.06, 0.72, 0.06, green, [0.6, 0.36, 5.2]));
  for (const [dx, dz] of [[-0.75, 0], [0.75, 0], [0, -0.75], [0, 0.75]]) {
    group.add(box(0.42, 0.04, 0.42, green, [0.6 + dx, 0.45, 5.2 + dz]));
    group.add(box(dx ? 0.04 : 0.42, 0.45, dz ? 0.04 : 0.42, green, [0.6 + dx * 1.3, 0.68, 5.2 + dz * 1.3]));
  }
  group.add(box(0.3, 0.3, 0.3, M('pot', 0xc8704a), [0.6, 0.9, 5.2]));
  group.add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.25, 0), M('potleaf', 0x7aba3a)).translateX(0.6).translateY(1.2).translateZ(5.2));
  group.add(box(2.6, 0.4, 0.8, M('planter', 0x6a4a30), [2.8, 0.2, 8.2]));
  group.add(box(2.5, 0.05, 0.7, M('soil', 0x2a1e14), [2.8, 0.41, 8.2]));

  // the catalogue's things, where they go
  if (hasUp(s, 'lights')) for (let i = 0; i < 16; i++) group.add(box(0.07, 0.07, 0.07, M('bulb', 0xffe8a0, { emissive: 1, unlit: true }), [-4.6 + i * 0.6, 2.6 - Math.abs(Math.sin(i * 0.8)) * 0.4, 3 + (i % 2) * 4.5]));
  if (hasUp(s, 'grill')) { group.add(new THREE.Mesh(new THREE.SphereGeometry(0.35, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), M('grill', 0x141414)).rotateX(Math.PI).translateX(-3.8).translateY(-0.9).translateZ(-3.6)); group.add(box(0.05, 0.8, 0.05, M('grilleg', 0x2a2a2a), [-3.8, 0.4, 3.6])); }
  if (hasUp(s, 'firepit')) { group.add(new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.4, 0.3, 12), M('pit', 0x3a3a3e)).translateX(-2.6).translateY(0.15).translateZ(6.6)); group.add(box(0.5, 0.15, 0.5, M('embers', 0xff6a2a, { emissive: 0.9, unlit: true }), [-2.6, 0.3, 6.6])); }
  if (hasUp(s, 'hammock')) group.add(box(0.8, 0.1, 2.4, M('hammock', 0xe8d8a8), [4.2, 0.9, 5.2], [0, 0, 0.15]));
  if (hasUp(s, 'records')) { group.add(box(0.5, 0.6, 1.2, M('sideboard', 0x6a4a30), [-0.3, 0.3, -5.5])); group.add(box(0.4, 0.1, 0.4, M('turntable', 0x2a2a2e), [-0.3, 0.65, -5.5])); }
  if (hasUp(s, 'hottub')) { group.add(box(1.8, 0.8, 1.8, M('hottub', 0x8a6a4a), [-3.6, 0.4, 3.4])); group.add(box(1.6, 0.05, 1.6, M('hotwater', 0x5ad8e8, { emissive: 0.3 }), [-3.6, 0.78, 3.4])); }
  if (hasUp(s, 'tv')) { group.add(box(0.45, 0.5, 1.5, M('tvstand', 0x2a2a2e), [1.6, 0.25, -2.2])); group.add(model('tv', { x: 1.6, y: 0.5, z: -2.2, height: 0.85, rot: -Math.PI / 2 })); }
  if (hasUp(s, 'stereo')) for (const dx of [-1.0, 0.4]) { group.add(box(0.36, 0.95, 0.34, M('speaker', 0x1a1a1e), [-0.3 + dx, 0.48, -5.6])); group.add(new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.02, 12), M('cone', 0x3a3a3e)).rotateX(Math.PI / 2).translateX(-0.3 + dx).translateY(-5.42).translateZ(-0.6)); }
  if (hasUp(s, 'kitchen')) { group.add(box(0.9, 0.93, 0.64, M('stove', 0x8a8e94, { ambient: 0.9 }), [-4.35, 0.465, -5.6])); for (let i = 0; i < 6; i++) group.add(new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.02, 10), M('burner', 0x1a1a1a)).translateX(-4.6 + (i % 3) * 0.25).translateY(0.94).translateZ(-5.75 + Math.floor(i / 3) * 0.3)); }
  if (hasUp(s, 'studio')) { group.add(box(1.3, 0.75, 0.6, M('studiodesk', 0x2a2a2e), [1.6, 0.38, 1.4])); for (const dx of [-0.45, 0.45]) group.add(box(0.2, 0.3, 0.2, M('monitor', 0x141414), [1.6 + dx, 0.9, 1.5])); group.add(box(0.03, 1.4, 0.03, M('micstand', 0x1a1a1a), [0.7, 0.7, 1.0])); group.add(box(0.07, 0.14, 0.07, M('mic', 0x8a8e94), [0.7, 1.45, 1.0])); group.add(box(0.5, 0.05, 0.3, M('keys', 0xf2f2ec), [1.6, 0.78, 1.25])); }
  if (hasUp(s, 'safe')) { group.add(box(0.6, 0.6, 0.55, M('safe', 0x2a2e2a), [2.8, 0.3, -3.1])); group.add(new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.03, 12), M('dial', 0xc8ccd0)).rotateX(Math.PI / 2).translateX(2.8).translateY(-2.81).translateZ(-0.36)); }

  // somebody over?
  const npcs = [];
  const guest = b.guest && b.guest.day === dayOf(s.clock.m) ? b.guest.id : null;
  if (guest) npcs.push({ kind: guest, x: 1.35, z: 5.2, rot: -Math.PI / 2, still: true, pose: 'sit', partner: CONFIG.partners?.[guest] ? true : undefined, act: guest === 'kev' ? 'smoke' : 'talk', talk: 'bs_guest' });

  const residence = homeState(s).residence === 'brownstone';
  const interactables = [
    { id: 'bs_out', label: 'Out to 7th Avenue', sub: 'the stoop · Park Slope', x: 0.5, z: -5.3, radius: 0.9, action: (gg) => gg.goTo('parkslope', 'brownstone') },
    { id: 'bs_sofa', label: 'The sofa', sub: '30 min · the good kind of sitting', x: -3.7, z: -2.2, radius: 1.0, seat: { x: -4.3, z: -2.2, rot: Math.PI / 2 }, action: (gg) => { gg.advance(30); bump(gg.state, 'stress', -10); bump(gg.state, 'morale', 4); gg.toast(pick(['A sofa that does not sag in the middle. You did not know they made those for people like you.', 'Recessed lights, a quiet street, a clock you can hear. You sit until you forget to be tense.']), 'good'); } },
    { id: 'bs_fridge', label: 'The fridge', sub: 'eat · store food', x: -0.8, z: -4.8, radius: 0.9, action: (gg) => showFridge(gg) },
    { id: 'bs_bath', label: 'A bath', sub: '+hygiene · -stress · 30 min · the water is actually hot', x: 3.2, z: -4.6, radius: 0.9, action: (gg) => { gg.advance(30); bump(gg.state, 'hygiene', 50); bump(gg.state, 'stress', -10); gg.toast('Hot water that stays hot. Subway tile. Black taps. You sit in it until your fingers prune, which has never once happened at 1120.', 'good'); } },
    { id: 'bs_bed', label: 'Upstairs to bed', sub: '7 h · the best sleep on the map', x: 4.4, z: 0.8, radius: 0.9, action: (gg) => { sleep(gg, 7); bump(gg.state, 'energy', 12); bump(gg.state, 'stress', -8); gg.toast('Upstairs, a real bed, a window onto the yard, and no radiator banging out Morse code. You sleep like a man with a mortgage.', 'good'); } },
    { id: 'bs_guide', label: 'The brownstone catalogue', sub: 'string lights · a grill · a fire pit · a hot tub', x: -2.6, z: -2.2, radius: 0.8, action: (gg) => catalogue(gg) },
    { id: 'bs_home', label: residence ? 'Home' : 'Make this home', sub: residence ? 'you live here · 3B is the past' : 'move in · mornings start here', x: 1.6, z: -5.0, radius: 0.8, action: (gg) => moveIn(gg) },
    { id: 'bs_table', label: 'Sit out back', sub: '30 min · the yard · the fence · the sky', x: 0.6, z: 4.3, radius: 1.0, seat: { x: -0.15, z: 5.2, rot: Math.PI / 2 }, action: (gg) => { gg.advance(30); bump(gg.state, 'stress', hasUp(gg.state, 'lights') ? -14 : -10); bump(gg.state, 'morale', 5); gg.toast(pick(['Your own yard. A cat on the fence that is not your cat. A plane going over, very slowly.', 'The neighbours are grilling. You are not invited. You do not need to be: you have a yard.']), 'good'); } },
    { id: 'bs_smoke', label: 'Smoke out back', sub: 'a loosie, the fence, the quiet', x: 2.4, z: 6.8, radius: 0.9, action: (gg) => { const has = (gg.state.inventory || []).some((i) => i.id === 'loosies' && i.qty > 0); if (!has) { gg.toast('Nothing to smoke. The bodega is a train ride away now. That is the price of a yard.', 'info'); return; } gg.world?.playEat?.('loosies', (n) => gg.audio?.sfx?.(n)); const e = gg.state.inventory.find((i) => i.id === 'loosies'); e.qty -= 1; if (e.qty <= 0) gg.state.inventory = gg.state.inventory.filter((i) => i !== e); bump(gg.state, 'stress', -8); gg.advance(8); } },
    { id: 'bs_invite', label: 'Have somebody over', sub: guest ? 'somebody is already here' : 'a girlfriend · Nia · Kev', x: -0.6, z: 3.0, radius: 0.9, action: (gg) => invite(gg) },
    ...(guest ? [{ id: 'bs_guest', label: `Hang out with ${guestName(guest)}`, sub: 'the yard · an hour or two', x: 1.35, z: 5.2, radius: 1.0, action: (gg) => hang(gg, guest) }] : []),
    ...(hasUp(s, 'grill') ? [{ id: 'bs_grill', label: 'Fire up the grill', sub: usedToday(s, 'grill') ? 'already did today' : '1 h · a real meal', x: -3.8, z: 4.2, radius: 0.9, action: (gg) => { if (usedToday(gg.state, 'grill')) return gg.toast('The coals are still warm from earlier.', 'info'); use(gg.state, 'grill'); gg.advance(60); bump(gg.state, 'hunger', 50); bump(gg.state, 'morale', 10); gg.toast('Burgers, an onion, the smoke going over the fence. Next door somebody says "that smells good" to nobody. It does.', 'good'); } }] : []),
    ...(hasUp(s, 'firepit') ? [{ id: 'bs_fire', label: 'Sit by the fire', sub: '1 h · -stress', x: -2.6, z: 5.8, radius: 0.9, action: (gg) => { gg.advance(60); bump(gg.state, 'stress', -18); bump(gg.state, 'morale', 6); gg.toast('The fire pops and settles. You watch it like it is television. It is better than the television.', 'good'); } }] : []),
    ...(hasUp(s, 'hammock') ? [{ id: 'bs_hammock', label: 'The hammock', sub: '1 h nap · +energy', x: 4.0, z: 4.2, radius: 0.9, action: (gg) => { gg.advance(60); bump(gg.state, 'energy', 18); bump(gg.state, 'stress', -8); gg.toast('You wake up with a net pattern on your cheek and no idea what day it is. Perfect.', 'good'); } }] : []),
    ...(hasUp(s, 'records') ? [{ id: 'bs_records', label: 'Put a record on', sub: '+morale', x: -0.3, z: -4.8, radius: 0.8, action: (gg) => { gg.advance(20); bump(gg.state, 'morale', 8); bump(gg.state, 'stress', -6); gg.toast(pick(['A soul record with a scratch in the second song that you start waiting for, fondly.', 'Side B, which is the good side. Everybody knows that.']), 'good'); } }] : []),
    ...(hasUp(s, 'tv') ? [{ id: 'bs_tv', label: guest ? `Watch TV with ${guestName(guest)}` : 'Watch TV', sub: guest ? '1 h · the sofa · a night in together' : '1 h · nine channels, big', x: 0.6, z: -2.2, radius: 0.9, action: (gg) => watchTv(gg, guest) }] : []),
    ...(hasUp(s, 'stereo') ? [{ id: 'bs_stereo', label: 'The stereo', sub: 'a record · your demo · for a guest', x: -0.3, z: -4.9, radius: 0.9, action: (gg) => stereo(gg, guest) }] : []),
    ...(hasUp(s, 'kitchen') ? [{ id: 'bs_stove', label: 'Cook a batch on the stove', sub: usedToday(s, 'stove') ? 'already cooked today' : `1 h · ${money(2)} · rice and beans for two days`, x: -4.35, z: -4.9, radius: 0.8, action: (gg) => cook(gg) }] : []),
    ...(hasUp(s, 'washer') ? [{ id: 'bs_washer', label: 'Down to the basement: the washer-dryer', sub: usedToday(s, 'washer') ? 'the load is done' : '1 h · free · clean clothes', x: 3.0, z: -1.6, radius: 0.8, action: (gg) => wash(gg) }] : []),
    ...(hasUp(s, 'spareroom') ? [{ id: 'bs_tenant', label: 'Knock on the spare room', sub: b.tenant ? `${b.tenant.name} · $160 a week` : 'nobody yet · tomorrow', x: 4.4, z: 1.6, radius: 0.8, action: (gg) => tenantMenu(gg) }] : []),
    ...(hasUp(s, 'studio') ? [{ id: 'bs_studio', label: 'The studio corner', sub: 'record a demo · 2 h · no vacuum upstairs', x: 1.6, z: 0.6, radius: 0.9, action: (gg) => music.recordAtHome(gg) }] : []),
    ...(hasUp(s, 'safe') ? [{ id: 'bs_safe', label: 'The floor safe', sub: 'the stash · the cash', x: 2.8, z: -2.5, radius: 0.8, action: (gg) => safeMenu(gg) }] : []),
    ...(hasUp(s, 'hottub') ? [{ id: 'bs_tub', label: 'Get in the hot tub', sub: '45 min · -stress', x: -3.6, z: 4.5, radius: 1.0, action: (gg) => { gg.advance(45); bump(gg.state, 'stress', -25); bump(gg.state, 'hygiene', 10); gg.toast('Steam, stars (four of them, it is Brooklyn), and the neighbour\'s window going dark in protest.', 'good'); } }] : []),
  ];

  return {
    group,
    bounds: { minX: -4.7, maxX: 4.7, minZ: -5.7, maxZ: 8.5 },
    solids: [
      solid(-3.0, 2, 4.0, 0.2, 2.9), solid(4.2, 2, 1.6, 0.2, 2.9), solid(3.4, 2, 0.3, 0.2, 2.5),
      solid(-4.4, -2.2, 1.0, 2.9, 0.8), solid(-3.0, -2.2, 1.0, 1.4, 0.45), solid(-1.3, -3.4, 0.9, 0.9, 0.8), solid(-1.3, -1.0, 0.9, 0.9, 0.8),
      solid(-3.0, -5.6, 3.6, 0.6, 0.95), solid(-0.8, -5.55, 0.7, 0.7, 1.9), solid(2.2, -5.3, 0.15, 1.4, 2.9), solid(3.6, -3.6, 2.8, 0.15, 2.9),
      solid(4.4, -0.8, 0.9, 2.8, 1.5), solid(-4.3, 0.2, 0.9, 0.9, 0.7),
      solid(0.6, 5.2, 1.0, 1.0, 0.8), solid(2.8, 8.2, 2.6, 0.8, 0.45),
      ...(hasUp(s, 'hottub') ? [solid(-3.6, 3.4, 1.8, 1.8, 0.8)] : []), ...(hasUp(s, 'firepit') ? [solid(-2.6, 6.6, 1.1, 1.1, 0.3)] : []),
      ...(hasUp(s, 'tv') ? [solid(1.6, -2.2, 0.45, 1.5, 1.4)] : []), ...(hasUp(s, 'studio') ? [solid(1.6, 1.4, 1.3, 0.6, 0.9)] : []), ...(hasUp(s, 'safe') ? [solid(2.8, -3.1, 0.6, 0.55, 0.6)] : []),
    ],
    spawn: { x: 0.5, z: -4.8, rot: Math.PI },
    spawnFor: () => ({ x: 0.5, z: -4.8, rot: Math.PI }),
    npcs, interactables,
    ambient: 'apartment',
    title: '7th Avenue · the brownstone',
  };
}

/* ---------------------------------------------- the upgrades that earn their keep */

function watchTv(g, guest) {
  const s = g.state;
  if (!guest) { openTv(g); return; }
  if (usedToday(s, 'tvtogether')) { g.toast('You already did the TV night. Twice is just two people not talking.', 'info'); return; }
  use(s, 'tvtogether');
  g.advance(60);
  bump(s, 'stress', -12);
  bump(s, 'morale', 8);
  const p = CONFIG.partners?.[guest] ? romance.partnerState(s, guest) : null;
  if (p) p.affection = Math.min(100, (p.affection || 0) + 6);
  g.toast(pick({
    nia: ['Nia takes the remote and does not give it back. A cooking show. She critiques every single dish. You have never been happier to be wrong about food.'],
    kev: ['Wrestling. Kev stands up for every finisher. At one point he puts you in a headlock "to show you." It is a good night.'],
  }[guest] || ['Her feet in your lap, a soap opera neither of you admits to following, and an argument about who the landlord really is. A whole date for the price of the electric bill.']), 'good');
}

function stereo(g, guest) {
  const s = g.state;
  const m = music.musicState(s);
  const recs = (s.inventory || []).filter((i) => i.id.startsWith('rec_') && i.qty > 0);
  const played = usedToday(s, 'stereo');
  const line = { soul: 'Brooklyn soul fills the parlour like somebody opened a window in 1971.', salsa: 'The horns hit and your shoulders move before you decide anything. The neighbour bangs on the wall in time.', jazz: 'A live set, the room on the record clapping in the room you are in. You close your eyes for the bass solo.', 'boom bap': 'The break every producer on Kestrel sampled, as loud as the speakers go. The windows hum.' };
  g.openModal({
    kicker: '7TH AVENUE · THE STEREO', title: 'The Stereo',
    body: `Two speakers taller than a hydrant and a turntable on the sideboard.${recs.length ? ` ${recs.length} record${recs.length === 1 ? '' : 's'} of your own from Spin City.` : ' Only the crate that came with the record player. Spin City on Ashby West has more.'}${m.demo ? ` Your demo on a CD: ${m.demo}/10.` : ''}`,
    choices: [
      ...recs.map((r) => ({ label: `Play ${(CONFIG.items[r.id]?.name || r.id).replace('Record: ', '')}.`, sub: played ? 'once a day it counts · 20 min' : `20 min · +morale · -stress${guest ? ' · with company' : ''}`, effect: () => {
        g.advance(20);
        if (!played) { use(s, 'stereo'); bump(s, 'morale', 9 + Math.min(4, recs.length)); bump(s, 'stress', -8); }
        if (guest && CONFIG.partners?.[guest]) romance.partnerState(s, guest).affection = Math.min(100, (romance.partnerState(s, guest).affection || 0) + 3);
        g.toast(line[CONFIG.items[r.id]?.genre] || 'Side B. The good side.', 'good');
      } })),
      ...(m.demo ? [{ label: guest ? `Play your demo for ${guestName(guest)}.` : 'Play your demo back, loud.', sub: guest ? 'a real reaction · nervous' : '15 min · hear it like a stranger would', effect: () => {
        g.advance(15);
        if (!guest) { bump(s, 'morale', m.demo >= 6 ? 6 : 2); g.toast(m.demo >= 6 ? 'On real speakers it sounds like a record. Like somebody. Like you, if you were somebody.' : 'Real speakers are honest. You hear every place the vacuum was. Next take.', 'info'); return; }
        const good = m.demo + Math.random() * 4 >= 7;
        if (good) { m.fans = (m.fans || 0) + 1; bump(s, 'morale', 12); if (CONFIG.partners?.[guest]) romance.partnerState(s, guest).affection = Math.min(100, (romance.partnerState(s, guest).affection || 0) + 6); }
        else bump(s, 'morale', -2);
        g.toast(good ? `${guestName(guest)} stops talking at the hook and makes you play it again. "That is you? Mo. That is YOU?"` : `${guestName(guest)} nods along politely. "It is really... long." You will fix the second verse.`, good ? 'good' : 'info');
      } }] : []),
      ...(!recs.length ? [{ label: 'Put on the old crate.', sub: played ? '20 min' : '20 min · +morale', effect: () => { g.advance(20); if (!played) { use(s, 'stereo'); bump(s, 'morale', 7); bump(s, 'stress', -6); } g.toast('The crate that came with the turntable: a lot of Christmas records and one perfect Al Green.', 'good'); } }] : []),
      { label: 'Turn it off.', effect: () => {} },
    ],
  });
}

function cook(g) {
  const s = g.state;
  if (usedToday(s, 'stove')) { g.toast('There is already a pot in the fridge. Eat it before you make another.', 'info'); return; }
  if (!g.spendMoney(2, 'groceries for a batch')) { g.toast('Two dollars for rice, beans, an onion and a can of tomatoes. You do not have two dollars.', 'bad'); return; }
  use(s, 'stove');
  g.advance(60);
  addItem(s, 'batch_meal', 4);
  bump(s, 'morale', 4);
  bump(s, 'stress', -3);
  g.toast('Rice, beans, an onion, sofrito from a jar and an hour. Four portions in containers that do not match. That is two days of eating like somebody who has his life together.', 'good');
}

function wash(g) {
  const s = g.state;
  if (usedToday(s, 'washer')) { g.toast('The load is already folded. Badly, but folded.', 'info'); return; }
  use(s, 'washer');
  g.advance(60);
  bump(s, 'hygiene', 18);
  bump(s, 'morale', 5);
  bump(s, 'stress', -4);
  g.toast(`Your own machines in your own basement. No quarters, no game show, no stranger's sock in your load. You stand there holding warm clothes and think about Dee, a little.`, 'good');
}

function tenantMenu(g) {
  const s = g.state;
  const b = bsState(s);
  if (!b.tenant) { g.toast('The room is ready: a bed, a dresser, a window onto the yard. The ad went up on the board at the laundromat. Somebody will call.', 'info'); return; }
  const t = b.tenant;
  g.openModal({
    kicker: '7TH AVENUE · THE SPARE ROOM', title: t.name,
    body: `${t.name} rents the spare room: a nurse on nights, a cat called Gerald, and a schedule that means you mostly see each other in the kitchen at 7 a.m. $160 a week, due every ${['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][((t.dueDay - 1) % 7 + 7) % 7]}.${t.late ? `

She is ${t.late} day${t.late === 1 ? '' : 's'} late.` : ''}

Paid so far: ${money(t.paid || 0)}.`,
    choices: [
      ...(t.late ? [{ label: 'Remind her about the rent.', sub: 'politely', effect: () => { if (Math.random() < 0.6) { payRent(g, t, true); } else g.toast('"Friday. I swear on Gerald." Gerald looks unconvinced.', 'info'); } }] : []),
      { label: 'Say hi in the kitchen.', sub: '10 min', effect: () => { g.advance(10); bump(s, 'morale', 2); g.toast(pick(['She is eating cereal standing up, still in scrubs. "Twelve hours. A man swallowed a key. Do not ask." You do not ask.', 'Gerald the cat is on your counter. She says he is not allowed. Gerald disagrees.']), 'info'); } },
      { label: 'Leave her be.', effect: () => {} },
    ],
  });
}

function payRent(g, t, late) {
  const amt = late ? 170 : 160;
  t.paid = (t.paid || 0) + amt;
  t.late = 0;
  t.dueDay += 7;
  g.earnMoney(amt, `rent from ${t.name}`);
  if (late) g.toast(`${t.name} pays, with ten on top "for the stress." ${money(amt)}.`, 'good');
}

/** Each morning at the brownstone: the tenant moves in, and the rent comes in (or does not). */
export function brownstoneNewDay(g, d) {
  const s = g.state;
  const b = bsState(s);
  if (!b.owned.includes('spareroom')) return;
  if (!b.tenant) {
    b.tenant = { name: 'Lena', since: d, dueDay: d + 7, paid: 0, late: 0 };
    pushMessage(g, { from: 'LENA (SPARE ROOM)', subject: 'the room', body: 'Hi, this is Lena from the laundromat board. I saw the room and I love the window. I work nights at Kings County, I am quiet, I have one cat who is also quiet (lie). I can move in today. $160 a week works.' });
    return;
  }
  const t = b.tenant;
  if (d < t.dueDay) return;
  if (t.late === 0 && Math.random() < 0.22) {
    t.late = 1;
    pushMessage(g, { from: 'LENA (SPARE ROOM)', subject: 'rent', body: pick(['rent is coming, payroll messed up AGAIN. two days max. sorry sorry sorry', 'I am so sorry, the cat had a vet thing. Can I pay you Friday? I will add something.']) });
    return;
  }
  if (t.late > 0 && t.late < 3 && Math.random() < 0.4) { t.late += 1; return; }
  payRent(g, t, t.late > 0);
  if (t.late === 0) logLine(g, `${t.name} paid the week's rent: ${money(160)}.`, 'good');
}

/** The floor safe: substances and cash at home, where no cop and no mugger gets to them. */
function safeMenu(g) {
  const s = g.state;
  const b = bsState(s);
  b.safe = b.safe || { cash: 0, items: {} };
  const sf = b.safe;
  const pocket = (s.inventory || []).filter((i) => CONFIG.items[i.id]?.kind === 'substance' && i.qty > 0);
  const inside = Object.entries(sf.items).filter(([, q]) => q > 0);
  g.openModal({
    kicker: '7TH AVENUE · UNDER THE STAIRS', title: 'The Safe',
    body: `A floor safe bolted under the stairs, a dial that clicks like a cricket. Inside: ${money(sf.cash)}${inside.length ? ` and ${inside.map(([id, q]) => `${q}× ${CONFIG.items[id]?.name || id}`).join(', ')}` : ', and nothing else'}.

What is in here is not in your pockets: no cop takes it and no man in a hood gets to it.`,
    choices: [
      ...(pocket.length ? [{ label: 'Put the stash in the safe.', sub: pocket.map((i) => `${i.qty}× ${CONFIG.items[i.id].name}`).join(', '), effect: () => { for (const i of pocket) { sf.items[i.id] = (sf.items[i.id] || 0) + i.qty; removeItem(s, i.id, i.qty); } g.advance(2); g.toast('In the safe. The dial spins. Your pockets feel like somebody else\'s.', 'info'); } }] : []),
      ...inside.map(([id, q]) => ({ label: `Take out one ${CONFIG.items[id]?.name || id}.`, sub: `${q} in here`, effect: () => { sf.items[id] -= 1; addItem(s, id, 1); g.advance(1); } })),
      ...(s.money >= 50 ? [{ label: 'Put cash in the safe.', sub: `keep ${money(20)} on you · ${money(Math.floor(s.money - 20))} in`, effect: () => { const k = Math.floor(s.money - 20); s.money = Math.round((s.money - k) * 100) / 100; sf.cash += k; g.toast(`${money(k)} in the safe. ${money(20)} in your pocket, which is what a man walking around Brooklyn should have.`, 'info'); } }] : []),
      ...(sf.cash > 0 ? [{ label: 'Take the cash out.', sub: money(sf.cash), effect: () => { s.money = Math.round((s.money + sf.cash) * 100) / 100; g.toast(`${money(sf.cash)} back in your pocket.`, 'info'); sf.cash = 0; } }] : []),
      { label: 'Close it.', effect: () => {} },
    ],
  });
}

const guestName = (id) => CONFIG.partners?.[id]?.name || { nia: 'Nia', kev: 'Kev' }[id] || id;

function invite(g) {
  const s = g.state;
  const b = bsState(s);
  if (b.guest && b.guest.day === dayOf(s.clock.m)) { g.toast(`${guestName(b.guest.id)} is already out back.`, 'info'); return; }
  const who = [
    ...Object.keys(CONFIG.partners || {}).filter((id) => { const st = romance.partnerState(s, id); return st.met && (st.girlfriend || st.affection >= 40); }),
    ...((s.sister?.visits || 0) >= 1 || (Number(s.npc?.nia) || 0) >= 2 ? ['nia'] : []),
    'kev',
  ];
  g.openModal({
    kicker: 'THE BROWNSTONE · THE YARD', title: 'Have Somebody Over',
    body: 'A text, an address in Park Slope, and the specific pleasure of saying "come by my place" about a place like this.',
    choices: [
      ...who.map((id) => ({ label: guestName(id), sub: id === 'kev' ? '"say less"' : id === 'nia' ? 'she will bring food, she always brings food' : 'she has never been', effect: () => {
        g.advance(45);
        b.guest = { id, day: dayOf(s.clock.m) };
        g.toast(`${guestName(id)} rings the bell forty-five minutes later${id === 'kev' ? ', looks up at the house, and says "whose is this" four times' : id === 'nia' ? ' with a foil tray and the face she makes when she is proud and does not want to say it' : ', looks around the parlour, and says "okay, Mo," like it is a whole sentence'}.`, 'good');
        g.world?.loadArea?.('brownstone', g);
      } })),
      { label: 'Not tonight.', effect: () => {} },
    ],
  });
}

function hang(g, id) {
  const s = g.state;
  g.advance(90);
  bump(s, 'stress', -16);
  bump(s, 'morale', 12);
  if (CONFIG.partners?.[id]) { const st = romance.partnerState(s, id); st.affection = Math.min(100, st.affection + 5); }
  if (id === 'kev') { s.high.level = Math.max(s.high.level, 25); s.high.until = Math.max(s.high.until || 0, s.clock.m + 80); }
  if (id === 'nia') bump(s, 'hunger', 40);
  logLine(g, `An evening in the yard with ${guestName(id)}.`, 'good');
  g.toast({
    kev: 'Kev in a green chair with his feet on the planter, a joint, and a long theory about how the yard is "basically a park you own." He is not wrong.',
    nia: 'Nia\'s arroz con pollo on the bistro table, the two of you talking about your mother until the lights come on next door. She says the place suits you. You almost cry. You do not, technically.',
  }[id] || `${guestName(id)} in the green chair with her shoes off, a glass of something, the fence and the sky. She stays till the street goes quiet.`, 'good');
}

function catalogue(g) {
  const s = g.state;
  const b = bsState(s);
  g.openModal({
    kicker: 'THE BROWNSTONE · THE CATALOGUE', title: 'For the Yard and the Parlour',
    body: 'A thick catalogue that came with the deed, full of people laughing at fire pits.',
    choices: [
      ...BS_UPGRADES.map((u) => ({ label: `${u.name} · ${money(u.price)}`, sub: b.owned.includes(u.id) ? 'already have it' : u.needs && !b.owned.includes(u.needs) ? 'needs the record player first' : u.note, disabled: b.owned.includes(u.id) || s.money < u.price || (u.needs && !b.owned.includes(u.needs)), effect: () => {
        g.spendMoney(u.price, `brownstone: ${u.name}`);
        b.owned.push(u.id);
        g.advance(30);
        bump(s, 'morale', 6);
        logLine(g, `Brownstone: ${u.name}.`, 'good');
        g.toast(`${u.name}, delivered and set up. The house is a little more yours.`, 'good');
        g.world?.loadArea?.('brownstone', g);
      } })),
      { label: 'Close it.', effect: () => {} },
    ],
  });
}

function moveIn(g) {
  const s = g.state;
  const h = homeState(s);
  if (h.residence === 'brownstone') {
    g.openModal({
      kicker: 'THE BROWNSTONE', title: 'Home',
      body: `You live here now.${s.home.leaseGiven ? ' Unit 3B is somebody else\'s problem.' : ' Unit 3B is still on the lease, rent and all.'}`,
      choices: [
        ...(!s.home.leaseGiven ? [{ label: 'Give up the lease on 3B.', sub: 'no more rent to Rae · 3B goes to somebody else', effect: () => { s.home.leaseGiven = true; logLine(g, 'Gave up the lease on Unit 3B.', 'info'); g.toast('You text Rae. He texts back "ok." Then, a minute later, "the radiator was always fine." It was never fine.', 'info'); } }] : []),
        { label: 'Good.', effect: () => {} },
      ],
    });
    return;
  }
  h.residence = 'brownstone';
  bump(s, 'morale', 15);
  logLine(g, 'Moved into the brownstone.', 'good');
  g.toast('You carry in one bag. That is everything. The house is too big for it, and it does not care.', 'good');
  g.world?.loadArea?.('brownstone', g);
}
