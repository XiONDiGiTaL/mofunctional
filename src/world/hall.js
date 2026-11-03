/**
 * 1120 Kestrel, inside: the lobby and three floors of hallway between the street and Unit 3B.
 *
 *   Lobby     the front door, marble-ish tile, gold sconces, a chandelier, the mailboxes, a
 *             shopping cart and a kid's bike, and 1A, which is Rae's: the landlord lives on the
 *             only lobby unit
 *   1st       1A the Hendersons, 1B Stephanie, 1C Mr. Lu
 *   2nd       2A Kev, 2B the Okoyes, 2C a man who plays the trumpet badly
 *   3rd       3A Mrs. Pryce, 3B Mo, 3C the Delgados, 3D Marcus, the bulletin board where the
 *             building gets organized (systems/tenants.js), and the last flight to the roof
 *
 * Stairs at the north end (a couple of real minutes a flight), and an elevator on the west wall
 * that goes anywhere in a minute: the fast way through the building. The floor Mo is on is
 * `s.b1120.floor`.
 */
import { retroMaterial, box, plane } from '../render/retro.js';
import { tex } from '../render/textures.js';
import { signTex } from '../render/signs.js';
import * as THREE from '../../vendor/three.module.js';
import { minuteOfDay, pick } from '../core/util.js';
import { bump } from '../core/state.js';
import * as tenants from '../systems/tenants.js';

const solid = (x, z, w, d, h = 2.4) => ({ x, z, w, d, h });
export const FLOORS_1120 = ['Lobby', '1st floor', '2nd floor', '3rd floor'];

export function b1120(s) {
  if (!s.b1120) s.b1120 = { floor: 3 };
  return s.b1120;
}

/** Move between floors: by the stairs (minutes, a little energy) or the elevator (a minute). */
export function toFloor(g, f, how = 'stairs') {
  const b = b1120(g.state);
  const from = b.floor;
  if (f === from) return;
  const flights = Math.abs(f - from);
  if (how === 'stairs') {
    const slow = g.state.stats.energy < 20 || g.state.stats.withdrawal > 55 ? 2 : 1;
    g.advance(flights * 2 * slow);
    if (f > from) bump(g.state, 'energy', -flights * slow);
  } else g.advance(1);
  b.floor = f;
  g.world?.loadArea('hall', g, how === 'elevator' ? 'elevator' : f > from ? 'up' : 'down');
  g.toast(`1120 Kestrel · ${FLOORS_1120[f]}.`, 'info');
}

function elevatorMenu(g) {
  const b = b1120(g.state);
  g.openModal({
    kicker: '1120 KESTREL · THE ELEVATOR', title: 'Which Floor',
    body: 'A brass panel with four buttons and an inspection certificate from 1991. It smells like somebody’s dinner. It is slow, but it is faster than you.',
    choices: [
      ...FLOORS_1120.map((name, n) => ({ label: n === b.floor ? `${name} (you are here)` : name, sub: n === 3 ? 'home · and the roof stairs' : n === 2 ? 'Kev' : n === 1 ? 'Stephanie' : 'the lobby · Rae · out to the street', disabled: n === b.floor, effect: () => toFloor(g, n, 'elevator') })),
      { label: 'Never mind.', effect: () => {} },
    ],
  });
}

/** A neighbour's door that is not part of a storyline. */
function knock(g, unit, lines) {
  g.advance(2);
  g.toast(`${unit}: ${pick(lines)}`, 'info');
}

export function buildHall(g, { partnerMenu, stephanieDoor, raeTalk, kevDoor } = {}) {
  const s = g.state;
  const f = b1120(s).floor;
  const group = new THREE.Group();
  const W = 3.2, D = 11;
  const lobby = f === 0;
  const wall = retroMaterial(`h3_wall${f}`, lobby ? { color: 0xf0ece4 } : { map: tex('wallpaper'), color: [0xb8aa8a, 0xa8b0a0, 0xb0a8a0, 0xb8aa8a][f] });
  const wood = retroMaterial('h3_wood', { map: tex('wood'), color: 0x6a4a32 });
  const door = retroMaterial(lobby ? 'h3_doorL' : 'h3_door', { color: lobby ? 0x4a5058 : 0x5a3a2a });
  const metal = retroMaterial('h3_metal', { color: 0x6a6e72 });
  const gold = retroMaterial('h3_gold', { color: 0xd8b04a, emissive: 0.4 });
  group.add(plane(W, D, { name: `h3_floor${f}`, map: tex(lobby ? 'tile' : 'linoleum'), color: lobby ? 0xe8dcc8 : 0xffffff, repeat: [2, 6] }, [0, 0, 0], [-Math.PI / 2, 0, 0]));
  group.add(plane(W, D, { name: 'h3_ceil', map: tex('ceiling'), repeat: [2, 6] }, [0, 2.8, 0], [Math.PI / 2, 0, 0]));
  group.add(box(0.16, 2.8, D, wall, [-W / 2, 1.4, 0]));
  group.add(box(0.16, 2.8, D, wall, [W / 2, 1.4, 0]));
  group.add(box(W, 2.8, 0.16, wall, [0, 1.4, D / 2]));
  group.add(box(W, 2.8, 0.16, wall, [0, 1.4, -D / 2]));
  for (const sx of [-1, 1]) group.add(box(0.04, lobby ? 0.6 : 0.14, D, retroMaterial(lobby ? 'h3_marble' : 'h3_base', { color: lobby ? 0xd8d0c4 : 0x3a2e24 }), [sx * (W / 2 - 0.09), lobby ? 0.3 : 0.07, 0]));
  if (lobby) for (const sx of [-1, 1]) group.add(box(0.05, 0.12, D, retroMaterial('h3_crown', { color: 0xd8c08a }), [sx * (W / 2 - 0.1), 2.72, 0]));
  // the lights: three on a hall floor (one that cannot decide), a chandelier and sconces in the lobby
  if (lobby) {
    group.add(box(0.7, 0.04, 0.7, gold, [0, 2.45, 0.5]));
    for (let i = 0; i < 6; i++) group.add(box(0.06, 0.12, 0.06, retroMaterial('h3_bulb', { color: 0xfff2c4, emissive: 1, unlit: true }), [Math.cos(i) * 0.32, 2.53, 0.5 + Math.sin(i) * 0.32]));
    group.add(box(0.02, 0.32, 0.02, gold, [0, 2.64, 0.5]));
    for (const [x, z] of [[-W / 2 + 0.12, -1.5 + 4], [-W / 2 + 0.12, 3.6], [W / 2 - 0.12, -0.2]]) group.add(box(0.08, 0.22, 0.16, retroMaterial('h3_sconce', { color: 0xfff2c4, emissive: 0.9, unlit: true }), [x, 1.9, z]));
  } else {
    for (const z of [3.4, -0.2, -3.6]) group.add(box(0.5, 0.06, 0.5, retroMaterial(z === -0.2 ? 'h3_dim' : 'h3_lamp', { color: z === -0.2 ? 0x8a8268 : 0xfff2c4, emissive: z === -0.2 ? 0.3 : 1, unlit: true }), [0, 2.76, z]));
  }
  // the south end: the front door in the lobby; upstairs, a small high window and the radiator
  if (lobby) {
    group.add(box(1.2, 2.3, 0.08, retroMaterial('h3_front', { color: 0x141416 }), [0, 1.15, D / 2 - 0.1]));
    group.add(plane(0.9, 1.9, { name: 'h3_frontglass', color: 0xbfd6e8, emissive: 0.5, unlit: true }, [0, 1.2, D / 2 - 0.15], [0, Math.PI, 0]));
    group.add(plane(0.5, 0.18, { name: 'h3_num', map: signTex('h3Num1120', [{ text: '1120', color: '#f2e8c8', size: 11 }], { w: 40, h: 14, bg: '#141416' }), emissive: 0.7, unlit: true }, [0, 2.5, D / 2 - 0.15], [0, Math.PI, 0]));
  } else {
    group.add(plane(0.7, 0.45, { name: 'h3_win', map: tex('window'), emissive: 0.4, unlit: true }, [0.9, 2.3, D / 2 - 0.09], [0, Math.PI, 0]));
    for (let i = 0; i < 8; i++) group.add(box(0.06, 0.6, 0.16, metal, [-0.4 + i * 0.12, 0.4, D / 2 - 0.2]));
  }
  // the stairs up (east side, north end), and the well going down (west)
  const solids = [];
  for (let i = 0; i < 6; i++) group.add(box(1.2, 0.18 + i * 0.18, 0.3, retroMaterial(lobby ? 'h3_stepL' : 'h3_step', { map: tex('concrete'), color: lobby ? 0x8a5a3a : 0xffffff }), [0.9, (0.18 + i * 0.18) / 2, -3.4 - i * 0.3]));
  group.add(box(0.05, 0.9, 1.9, retroMaterial(lobby ? 'h3_railL' : 'h3_rail', { color: lobby ? 0xf2f2ec : 0x6a6e72 }), [0.27, 1.1, -4.2]));
  group.add(plane(1.0, 0.3, { name: `h3_up${f}`, map: signTex(`h3Up${f}`, [{ text: f === 3 ? 'ROOF ▲' : 'STAIRS ▲ UP', color: '#ffe9a0', size: 8 }], { w: 64, h: 18, bg: '#2a2420', border: '#c8a050' }), emissive: 0.7, unlit: true }, [0.9, 2.3, -D / 2 + 0.1]));
  solids.push(solid(0.9, -4.3, 1.3, 1.9, 0.9));
  if (!lobby) {
    group.add(plane(1.0, 1.4, { name: 'h3_well', color: 0x0a0a0c }, [-1.0, 0.006, -4.4], [-Math.PI / 2, 0, 0]));
    for (let i = 0; i < 3; i++) group.add(box(0.9, 0.06, 0.3, retroMaterial('h3_stepd', { map: tex('concrete') }), [-1.0, 0.02, -3.85 - i * 0.36]));
    group.add(box(0.05, 0.9, 1.4, metal, [-0.47, 0.45, -4.4]));
    group.add(plane(0.9, 0.26, { name: 'h3_downsign', map: signTex('h3Down', [{ text: 'STAIRS ▼ DOWN', color: '#ffe9a0', size: 8 }], { w: 64, h: 18, bg: '#2a2420', border: '#c8a050' }), emissive: 0.7, unlit: true }, [-W / 2 + 0.1, 2.0, -4.4], [0, Math.PI / 2, 0]));
    solids.push(solid(-1.0, -4.4, 1.0, 1.4, 0.9));
  }
  // the elevator, on the west wall: brass doors, a floor dial
  group.add(box(0.1, 2.2, 1.0, retroMaterial('h3_elev', { color: 0x9a8a5a, emissive: 0.05 }), [-W / 2 + 0.1, 1.1, -1.4]));
  group.add(box(0.11, 2.1, 0.02, retroMaterial('h3_elevseam', { color: 0x2a2418 }), [-W / 2 + 0.11, 1.05, -1.4]));
  group.add(plane(0.5, 0.2, { name: `h3_elevdial${f}`, map: signTex(`h3ElevDial${f}`, [{ text: `◀ ${f === 0 ? 'L' : f} ▶`, color: '#ffb84a', size: 9 }], { w: 48, h: 16, bg: '#1a120a', border: '#8a6a3a' }), emissive: 0.9, unlit: true }, [-W / 2 + 0.17, 2.4, -1.4], [0, Math.PI / 2, 0]));
  group.add(plane(1.0, 0.4, { name: `h3_floornum${f}`, map: signTex(`h3Floor${f}`, [{ text: f === 0 ? 'LOBBY' : `FLOOR ${f}`, color: '#f2e8c8', size: 10 }], { w: 64, h: 24, bg: '#2a2420', border: '#8a7452' }), emissive: 0.6, unlit: true }, [W / 2 - 0.1, 1.9, -2.6], [0, -Math.PI / 2, 0]));

  const interactables = [];
  const doorAt = (side, z, label, action, sub = '', name = null) => {
    const x = side * (W / 2 - 0.07);
    group.add(box(0.1, 2.2, 1.0, door, [x, 1.1, z]));
    group.add(plane(0.3, 0.16, { name: `h3_num${label}${f}`, map: signTex(`h3Num${label}${f}`, [{ text: label, color: '#e8e8e0', size: 9 }], { w: 32, h: 16, bg: '#2a2a2a', border: '#c8a050' }), emissive: 0.4, unlit: true }, [x - side * 0.07, 1.85, z], [0, -side * Math.PI / 2, 0]));
    group.add(box(0.05, 0.12, 0.06, gold, [x - side * 0.07, 1.05, z + 0.3]));
    interactables.push({ id: `h3_${label}`, label: name || `Knock on ${label}`, sub, x: side * (W / 2 - 0.55), z, radius: 1.0, action });
  };
  const npcs = [];
  const m = minuteOfDay(s.clock.m);
  const t = tenants.tenantsState(s);

  if (lobby) {
    // Rae lives here, in 1A, the only unit on the lobby floor; the mailboxes; a cart and a bike
    doorAt(1, 2.2, '1A', (gg) => (raeTalk ? raeTalk(gg) : gg.toast('Rae is not answering. Rae is always home. Rae is not answering.', 'info')), 'Rae Vell · landlord', 'Knock on 1A (Rae)');
    group.add(plane(0.5, 0.2, { name: 'h3_raesign', map: signTex('h3RaeSign', [{ text: 'MGMT · 1A', color: '#1a1a1a', size: 8 }], { w: 48, h: 18, bg: '#f2f0e4', border: '#8a2a2a' }), emissive: 0.4 }, [W / 2 - 0.14, 2.2, 1.4], [0, -Math.PI / 2, 0]));
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) group.add(box(0.05, 0.18, 0.22, retroMaterial(`h3_mailbox${(r + c) % 5 === 0 ? 'x' : ''}`, { color: (r + c) % 5 === 0 ? 0x5a5e62 : 0xb8bcc0 }), [-W / 2 + 0.1, 1.0 + r * 0.22, 0.9 + c * 0.25]));
    group.add(box(0.05, 0.6, 0.8, retroMaterial('h3_notices', { color: 0xf2f0e4 }), [-W / 2 + 0.1, 1.85, 1.3]));
    group.add(box(0.5, 0.6, 0.4, retroMaterial('h3_cart', { color: 0x2a2a2a }), [1.2, 0.4, -1.8]));
    group.add(box(0.06, 0.5, 0.9, retroMaterial('h3_bike', { color: 0xc8281e }), [1.3, 0.35, -0.9]));
    for (const dz of [-0.4, 0.4]) group.add(box(0.04, 0.42, 0.42, retroMaterial('h3_wheel', { color: 0x141416 }), [1.32, 0.22, -0.9 + dz]));
    solids.push(solid(1.2, -1.4, 0.6, 1.6, 0.8));
    interactables.push(
      { id: 'h3_mail', label: 'The mailboxes', sub: 'who lives where · notices', x: -0.9, z: 1.3, radius: 1.0, action: (gg) => gg.openModal({ kicker: '1120 KESTREL · LOBBY', title: 'Mailboxes', body: 'Taped over the boxes, in Rae’s handwriting and three others:\n\n1A  R. VELL (MGMT)\n1st  Hendersons · S. (1B) · Lu\n2nd  K. (2A) · Okoye · "TRUMPET"\n3rd  Pryce · MO (3B) · Delgado · Marcus\n\nA notice: TENANTS AND THEIR GUESTS ONLY. NO TRESPASSING. Under it, in pen: "or what"', choices: [{ label: 'Check your box.', effect: () => { gg.advance(1); gg.toast(pick(['A menu from Habib’s, a menu from a place that closed in 1997, and a bill.', 'Empty, except for a flyer about a church that is not the Fellowship.', 'Somebody else’s magazine. You read it. You put it back.']), 'info'); } }, { label: 'Close it.', effect: () => {} }] }) },
      { id: 'h3_out', label: 'Out to Kestrel Street', sub: 'the front door', x: 0, z: D / 2 - 0.9, radius: 1.1, action: (gg) => gg.goTo('street', 'apartment') },
    );
    if (m >= 8 * 60 && m < 20 * 60 && Math.random() < 0.6) npcs.push({ kind: 'tenant_f', x: -0.5, z: 2.6, rot: 2.4, still: true, act: 'talk' });
  } else if (f === 1) {
    doorAt(-1, 1.6, '1A', (gg) => knock(gg, '1A', ['A TV turned up to a game show answers instead of a person.', 'Mrs. Henderson opens the door with a spoon in her hand and says "not today, baby" before you say anything.']), 'the Hendersons');
    doorAt(-1, 3.8, '1B', (gg) => (stephanieDoor ? stephanieDoor(gg, partnerMenu, '1B', '1120 KESTREL') : null), 'Stephanie · a cartoon bench sticker');
    doorAt(1, 1.6, '1C', (gg) => knock(gg, '1C', ['Mr. Lu opens the door, looks at you, nods once and closes it. It feels like approval.', 'Through the door: a radio playing the news in Cantonese and a kettle starting to sing.']), 'Mr. Lu');
    if (m >= 17 * 60 && m < 23 * 60 && Math.random() < 0.4) npcs.push({ kind: 'hall_m', x: 0.6, z: 0.6, rot: -1.4, still: true, act: 'phone' });
  } else if (f === 2) {
    doorAt(-1, 1.6, '2A', (gg) => (kevDoor ? kevDoor(gg) : null), 'Kev · a Mets pennant on the door');
    doorAt(-1, 3.8, '2B', (gg) => knock(gg, '2B', ['Mrs. Okoye says the kids are asleep, finally, and if you wake them you are babysitting.', 'The smell of jollof under the door. Nobody answers. The smell answers.']), 'the Okoyes');
    doorAt(1, 1.6, '2C', (gg) => knock(gg, '2C', ['A trumpet plays three notes of a song you almost know, badly, and stops.', 'He opens the door with the trumpet still in his hand. "Practice," he says. "For what?" you ask. He closes the door.']), 'a trumpet, sometimes');
    group.add(plane(0.3, 0.2, { name: 'h3_pennant', map: signTex('h3Pennant', [{ text: 'METS', color: '#ff8a1e', size: 9 }], { w: 32, h: 18, bg: '#1a3a8a' }), emissive: 0.3 }, [-W / 2 + 0.14, 1.5, 1.6], [0, Math.PI / 2, 0]));
  } else {
    // the third floor: home, the neighbours, the bulletin board, the roof stairs
    group.add(box(0.06, 0.9, 1.2, wood, [W / 2 - 0.1, 1.5, -0.4]));
    group.add(plane(1.1, 0.8, { name: 'h3_cork', color: 0xa8784a }, [W / 2 - 0.14, 1.5, -0.4], [0, -Math.PI / 2, 0]));
    for (let i = 0; i < 2 + Object.keys(t.complaints).length; i++) group.add(plane(0.22, 0.28, { name: `h3_paper${i}`, color: i === 0 ? 0xf2f0e4 : 0xe8e0b0 }, [W / 2 - 0.15, 1.45 + (i % 2) * 0.22, -0.8 + i * 0.22], [0, -Math.PI / 2, (i % 3 - 1) * 0.1]));
    doorAt(-1, 1.6, '3A', (gg) => tenants.knock(gg, '3A'), t.complaints['3A'] ? 'Mrs. Pryce · on the list' : 'Mrs. Pryce');
    doorAt(-1, 3.8, '3B', (gg) => (gg.state.home?.leaseGiven ? gg.toast('A new name on the door: R. OKONKWO. The lock still sticks, you can hear it from here. Not your problem any more.', 'info') : gg.goTo('apartment', 'hall')), s.home?.leaseGiven ? 'not yours any more' : 'your door · the lock sticks', s.home?.leaseGiven ? 'Unit 3B' : 'Unit 3B · home');
    doorAt(1, 1.6, '3C', (gg) => tenants.knock(gg, '3C'), t.complaints['3C'] ? 'the Delgados · on the list' : 'the Delgados');
    doorAt(1, 3.8, '3D', (gg) => tenants.knock(gg, '3D'), t.complaints['3D'] ? 'Marcus · on the list' : 'Marcus');
    interactables.push(
      { id: 'h3_board', label: 'The bulletin board', sub: t.meeting && !t.meeting.held ? `meeting day ${t.meeting.day}, 19:00` : 'repairs · the heat · a meeting', x: 0.9, z: -0.4, radius: 1.0, action: (gg) => tenants.boardMenu(gg) },
      { id: 'h3_radiator', label: 'The radiator', sub: s.flags?.heatFixed ? 'warm, for once' : 'cold, as usual', x: -0.4, z: D / 2 - 0.9, radius: 0.9, action: (gg) => gg.toast(gg.state.flags?.heatFixed ? 'Warm. Actually warm. You stand next to it longer than you need to.' : pick(['Cold. It knocks twice to let you know it heard you, and does nothing.', 'You put your hand on it. It is the temperature of a decision Rae made in 1994.']), 'info') },
    );
    if (m >= 9 * 60 && m < 19 * 60 && Math.random() < 0.5) npcs.push({ kind: 'tenant_f', x: -0.6, z: 1.0, rot: 1.2, still: true, act: 'talk', talk: 'h3_3A' });
    if ((m >= 19 * 60 || m < 2 * 60) && Math.random() < 0.4) npcs.push({ kind: 'passer_m', x: 0.7, z: 3.0, rot: -1.8, still: true, act: 'phone', talk: 'h3_3D' });
    if (t.meeting?.held === false && t.meeting.day === Math.floor(s.clock.m / 1440) + 1 && m >= 19 * 60 && m < 22 * 60) {
      for (const [kind, x, z, rot] of [['tenant_f', -0.7, -0.6, 1.2], ['hall_m', 0.7, 0.4, -1.4], ['passer_m', 0.2, 0.6, Math.PI], ['hall_f', -0.3, 0.9, 2.6]]) npcs.push({ kind, x, z, rot, still: true, act: 'talk' });
    }
  }
  // getting around: up (to the roof from the third), down, the elevator
  interactables.push({ id: 'h3_up', label: f === 3 ? 'Up the last flight to the roof' : `Up to the ${FLOORS_1120[f + 1]}`, sub: f === 3 ? 'the door alarm never worked · Rae never fixed it' : '2 min · the stairs', x: 0.9, z: -2.9, radius: 0.9, action: (gg) => { if (f === 3) { gg.state.roofOf = '1120'; gg.advance(2); gg.goTo('roof', 'hall'); } else toFloor(gg, f + 1); } });
  if (!lobby) interactables.push({ id: 'h3_down', label: `Down to the ${FLOORS_1120[f - 1]}`, sub: 'the stairs', x: -1.0, z: -3.4, radius: 0.9, action: (gg) => toFloor(gg, f - 1) });
  interactables.push({ id: 'h3_elev', label: 'Take the elevator', sub: 'any floor · a minute', x: -0.9, z: -1.4, radius: 0.9, action: (gg) => elevatorMenu(gg) });

  return {
    group, title: `1120 Kestrel · ${FLOORS_1120[f]}`,
    bounds: { minX: -W / 2 + 0.3, maxX: W / 2 - 0.3, minZ: -D / 2 + 0.4, maxZ: D / 2 - 0.4 },
    solids,
    spawn: { x: 0, z: D / 2 - 1.4, rot: Math.PI },
    spawnFor: (from) => (from === 'apartment' || from === 'herplace' ? { x: -0.6, z: 3.8, rot: Math.PI / 2 }
      : from === 'elevator' ? { x: -0.7, z: -1.4, rot: Math.PI / 2 }
        : from === 'up' ? { x: -0.4, z: -2.8, rot: Math.PI }
          : from === 'down' || from === 'roof' ? { x: 0.4, z: -2.6, rot: Math.PI }
            : { x: 0, z: D / 2 - 1.4, rot: Math.PI }),
    npcs,
    interactables,
  };
}
