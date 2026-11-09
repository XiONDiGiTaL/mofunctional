/**
 * Ashby Ave West: past the precinct the avenue keeps going, and this is where the city keeps its
 * offices. Walk west off Ashby Avenue and the block is, east to west:
 *
 *   Joe's Barber · 99¢ Dreams · Ashby Check Cashing   a one-storey shop row
 *   Spin City Records                                  the corner shop
 *   Ashby Station Post Office                          limestone, a flag, two blue boxes
 *   The Ashby Diner                                    chrome, open 24 hours
 *   St. Agnes                                          the church; the Tuesday group is downstairs
 *   Ashby Courthouse                                   the civil clerk and the Housing Part
 *   Kings Public Library, Ashby Branch                 the cast-iron loft
 *   The handball wall                                  at the west end, by the fence
 *
 * The buildings are Polyfork's NYC City kit (render/models.js) with the block's own signs on them.
 * Six of the doors open onto rooms (post office, courthouse, the basement, library, diner, Joe's);
 * the rest are counters at the door. What each place does lives in systems/ashby.js.
 */
import * as THREE from '../../vendor/three.module.js';
import { retroMaterial, box, plane } from '../render/retro.js';
import { tex } from '../render/textures.js';
import { signTex } from '../render/signs.js';
import { model } from '../render/models.js';
import { minuteOfDay, pick } from '../core/util.js';
import { CONFIG } from '../core/config.js';
import { bump } from '../core/state.js';
import { openShop } from './shops.js';
import { streetMouth } from './vistas.js';
import { oddJobMenu } from './areas.js';
import * as ashby from '../systems/ashby.js';
import * as music from '../systems/music.js';

const solid = (x, z, w, d, h = 2.4) => ({ x, z, w, d, h });
const M = (n, color, extra = {}) => retroMaterial(`aw_${n}`, { color, ...extra });
const sign = (key, lines, w, h, bg, border) => signTex(key, lines, { w, h, bg, border });
const FRONT = -6.4;        // the building line
const X0 = -50, X1 = 40;   // the walkable block, west to east

/** A sign board flat on a facade. */
function board(group, key, x, y, w, h, lines, bg = '#141414', border = '#e8c83a', z = FRONT + 0.25) {
  group.add(plane(w, h, { name: `aw_sign_${key}`, map: sign(`aw${key}`, lines, Math.round(w * 40), Math.round(h * 40), bg, border), emissive: 0.75, unlit: true }, [x, y, z]));
}

/** A shop door on a facade, with its prompt. */
function door(ctx, { id, x, label, sub, hours, area, action, color = 0x2a2a2e, glass = true }) {
  const { group, interactables } = ctx;
  group.add(box(1.3, 2.3, 0.1, M(`door${color}`, color), [x, 1.15, FRONT + 0.12]));
  if (glass) group.add(box(1.0, 1.3, 0.04, M('doorglass', 0xffe2a8, { emissive: 0.45, unlit: true }), [x, 1.45, FRONT + 0.18]));
  interactables.push({
    id: `aw_${id}`, label, sub, x, z: FRONT + 1.2, radius: 1.3,
    unavailable: hours ? (gg) => ashby.awClosed(hours, gg.state) : undefined,
    action: action || ((gg) => gg.goTo(area, 'ashbywest')),
  });
}

export function buildAshbyWest(g) {
  const s = g.state;
  const m = minuteOfDay(s.clock.m);
  const night = m >= 20 * 60 || m < 6 * 60;
  const group = new THREE.Group();
  const solids = [];
  const interactables = [];
  const npcs = [];
  const ctx = { group, solids, interactables };
  const L = X1 - X0, cx = (X0 + X1) / 2;

  // the ground: sidewalk, curb, road, and the far side of the avenue across it
  group.add(plane(L + 4, 9, { name: 'aw_sw', map: tex('sidewalk'), repeat: [30, 3] }, [cx, 0, -2.0], [-Math.PI / 2, 0, 0]));
  group.add(plane(L + 4, 9, { name: 'aw_road', map: tex('asphalt'), repeat: [34, 3] }, [cx, -0.01, 6.0], [-Math.PI / 2, 0, 0]));
  group.add(box(L + 4, 0.18, 0.4, M('curb', 0x8a8a84), [cx, 0.09, 1.5]));
  group.add(plane(L + 4, 2.4, { name: 'aw_farsw', map: tex('sidewalk'), repeat: [30, 1] }, [cx, 0.012, 11.0], [-Math.PI / 2, 0, 0]));
  for (let x = X0; x < X1; x += 9) {
    const h = 7 + ((x * 7) % 5 + 5) % 5;
    group.add(box(8.6, h, 1.2, M(`across${x % 3}`, [0x7a4a3a, 0x8a6a4a, 0x5a5a62][((x / 9) % 3 + 3) % 3], { map: tex('brick') }), [x + 4.5, h / 2, 12.8]));
    for (let wy = 2.2; wy < h - 0.6; wy += 1.7) for (let wx = -3; wx <= 3; wx += 2) group.add(plane(0.8, 0.9, { name: 'aw_win', map: tex('window'), emissive: ((x + wx + wy * 3) % 5 + 5) % 5 < 2 ? 0.5 : 0.08, unlit: true }, [x + 4.5 + wx, wy, 12.18], [0, Math.PI, 0]));
  }

  /* ------------------------------------------------ the shop row: Joe's, 99¢, check cashing */
  group.add(model('shopRow', { x: 32.5, z: FRONT - 4.46 }));
  board(group, 'joes', 28.5, 3.35, 3.6, 0.6, [{ text: "JOE'S BARBER", color: '#ffffff', size: 11 }, { text: 'CUTS · SHAVES · OPINIONS', color: '#e8d8a8', size: 5 }], '#1a2a5a', '#e8e8e8');
  board(group, 'nn', 32.5, 3.35, 3.6, 0.6, [{ text: '99¢ DREAMS', color: '#ffe23a', size: 11 }, { text: 'EVERYTHING 99¢ · ALMOST', color: '#ffffff', size: 5 }], '#c81e2a', '#ffe23a');
  board(group, 'checks', 36.5, 3.35, 3.6, 0.6, [{ text: 'CHECKS CASHED', color: '#3aff6a', size: 10 }, { text: 'PAYDAY ADVANCES · MONEY ORDERS', color: '#ffffff', size: 5 }], '#101810', '#3aff6a');
  // the barber pole, turning
  const pole = new THREE.Group();
  pole.add(new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.8, 10), retroMaterial('aw_pole', { map: tex('neon'), color: 0xffffff, emissive: 0.6, unlit: true })));
  pole.position.set(27.0, 2.2, FRONT + 0.35);
  group.add(pole);
  door(ctx, { id: 'barber', x: 28.5, label: "Enter Joe's Barber", sub: 'a cut · a shave · the regulars', hours: 'barber', area: 'barber' });
  door(ctx, { id: '99', x: 32.5, label: '99¢ Dreams', sub: 'noodles · chips · a gallon of water', hours: 'ninetynine', action: (gg) => openShop(gg, 'ninetynine') });
  door(ctx, { id: 'checks', x: 36.5, label: 'Ashby Check Cashing', sub: 'payday advances · pay a bill', hours: 'checks', action: (gg) => ashby.checkCashing(gg) });
  solids.push(solid(32.5, FRONT - 4.4, 12, 8.8, 5));

  /* ------------------------------------------------ Spin City Records, on the corner */
  group.add(model('cornerShop', { x: 21, z: FRONT - 4.42 }));
  board(group, 'records', 21, 3.2, 4.4, 0.7, [{ text: 'SPIN CITY RECORDS', color: '#ff7ad8', size: 11 }, { text: 'VINYL · CDs · LOCAL DEMOS BY THE REGISTER', color: '#ffffff', size: 5 }], '#1a0a2a', '#ff7ad8');
  door(ctx, { id: 'records', x: 21, label: 'Spin City Records', sub: 'buy records · sell records · your demo', hours: 'records', action: (gg) => recordsMenu(gg) });
  solids.push(solid(21, FRONT - 4.4, 8.85, 8.8, 7));

  /* ------------------------------------------------ Ashby Station Post Office: limestone, a flag */
  {
    const stone = M('limestone', 0xd8d0bc, { map: tex('concrete') });
    group.add(box(8, 7.5, 1.2, stone, [12, 3.75, FRONT - 0.6]));
    for (const dx of [-3, -1.6, 1.6, 3]) group.add(box(0.5, 4.2, 0.4, M('column', 0xe8e2d0), [12 + dx, 2.1, FRONT + 0.2]));
    group.add(box(8.2, 0.6, 0.6, M('cornice', 0xc8c0aa), [12, 4.5, FRONT + 0.2]));
    board(group, 'po', 12, 5.4, 6.4, 0.6, [{ text: 'ASHBY STATION · POST OFFICE', color: '#1a2a4a', size: 10 }], '#e8e2d0', '#1a2a4a');
    for (let i = 0; i < 2; i++) group.add(box(4.6 - i * 0.6, 0.15, 0.6, stone, [12, 0.075 + i * 0.15, FRONT + 0.6 + (1 - i) * 0.3]));
    for (const dx of [-2.8, 2.8]) for (let wy = 0; wy < 2; wy++) group.add(plane(1.0, 1.3, { name: 'aw_powin', map: tex('window'), emissive: night ? 0.1 : 0.4, unlit: true }, [12 + dx, 1.6 + wy * 3.2, FRONT + 0.02]));
    // the flag, off a pole over the door
    const fp = box(0.06, 0.06, 2.0, M('flagpole', 0xd8d8dc), [12, 4.9, FRONT + 0.9]);
    fp.rotation.x = -0.5;
    group.add(fp);
    const flag = new THREE.Group();
    for (let i = 0; i < 7; i++) flag.add(box(1.3, 0.11, 0.02, M(i % 2 ? 'stripew' : 'striper', i % 2 ? 0xf2f2ec : 0xc81e2a), [0.65, -i * 0.11, 0]));
    flag.add(box(0.55, 0.44, 0.025, M('canton', 0x1a2a6a), [0.28, -0.17, 0.005]));
    flag.position.set(12.05, 5.35, FRONT + 1.75);
    flag.rotation.y = -Math.PI / 2;
    group.add(flag);
    group.add(model('mailbox', { x: 9.6, z: FRONT + 1.0, height: 1.15 }));
    group.add(model('mailbox', { x: 14.4, z: FRONT + 1.0, height: 1.15, rot: 0.1 }));
    door(ctx, { id: 'po', x: 12, label: 'Enter the post office', sub: 'PO boxes · parcels · money orders', hours: 'postoffice', area: 'postoffice', color: 0x3a3a3e });
    solids.push(solid(12, FRONT - 0.6, 8, 1.4, 7), solid(9.6, FRONT + 1.0, 0.6, 0.6, 1.2), solid(14.4, FRONT + 1.0, 0.6, 0.6, 1.2));
  }

  /* ------------------------------------------------ the Ashby Diner, open all night */
  group.add(model('diner', { x: 2.5, z: FRONT - 2.0 }));
  board(group, 'diner', 2.5, 4.9, 4.4, 0.7, [{ text: 'ASHBY DINER', color: '#ff3a3a', size: 12 }, { text: 'OPEN 24 HOURS · BREAKFAST ALL DAY', color: '#ffffff', size: 5 }], '#101820', '#ff3a3a', FRONT + 0.1);
  door(ctx, { id: 'diner', x: 2.5, label: 'Enter the Ashby Diner', sub: 'coffee · pie · open all night', area: 'diner' });
  solids.push(solid(2.5, FRONT - 2.0, 8, 4, 5));

  /* ------------------------------------------------ St. Agnes, and the stairs down to the basement */
  group.add(model('church', { x: -8, z: FRONT - 6 }));
  board(group, 'agnes', -8, 2.8, 2.8, 0.45, [{ text: 'ST. AGNES', color: '#f2e6c8', size: 10 }], '#3a2a1a', '#f2e6c8', FRONT + 0.3);
  group.add(box(1.0, 0.9, 0.06, M('basementrail', 0x1a1a1a), [-2.7, 0.45, FRONT + 1.3]));
  board(group, 'basement', -2.75, 1.9, 1.3, 0.9, [{ text: 'BASEMENT', color: '#ffffff', size: 8 }, { text: 'TUESDAYS 7 PM', color: '#e8c83a', size: 7 }, { text: 'ALL WELCOME', color: '#ffffff', size: 6 }, { text: 'COFFEE IS FREE', color: '#cfe8ff', size: 5 }], '#1a2a3a', '#e8c83a', FRONT + 0.3);
  interactables.push({ id: 'aw_basement', label: 'Down to the basement', sub: 'the Tuesday group · 19:00', x: -2.75, z: FRONT + 1.2, radius: 1.0,
    unavailable: (gg) => (ashby.meetingOpen(gg.state) ? null : 'locked · Tuesdays, 7 PM'), action: (gg) => gg.goTo('meetings', 'ashbywest') });
  solids.push(solid(-8, FRONT - 6, 8, 12, 9));

  /* ------------------------------------------------ Ashby Courthouse */
  group.add(model('civic', { x: -20, z: FRONT - 6 }));
  board(group, 'court', -20, 6.6, 7.2, 0.7, [{ text: 'ASHBY COURTHOUSE', color: '#1a1a1a', size: 12 }, { text: 'CIVIL CLERK · HOUSING PART · ROOM 104', color: '#3a3a3a', size: 5 }], '#e8e2d0', '#1a1a1a', FRONT + 0.1);
  door(ctx, { id: 'court', x: -20, label: 'Enter the courthouse', sub: 'tickets · Housing Court · community service', hours: 'court', area: 'court', color: 0x3a2a1a });
  solids.push(solid(-20, FRONT - 6, 12, 12, 10));

  /* ------------------------------------------------ the library */
  group.add(model('loft', { x: -33, z: FRONT - 4.48 }));
  board(group, 'lib', -33, 4.4, 6.4, 0.7, [{ text: 'KINGS PUBLIC LIBRARY', color: '#f2e6c8', size: 11 }, { text: 'ASHBY BRANCH · FREE · ALL ARE WELCOME', color: '#ffffff', size: 5 }], '#1e3a2a', '#f2e6c8', FRONT + 0.1);
  door(ctx, { id: 'library', x: -33, label: 'Enter the library', sub: 'free · warm · quiet · the job listings', hours: 'library', area: 'library', color: 0x2a3a2a });
  solids.push(solid(-33, FRONT - 4.5, 12, 9, 10));

  /* ------------------------------------------------ the handball wall */
  {
    group.add(plane(9, 6.6, { name: 'aw_court', map: tex('court'), color: 0x8a9a8a, repeat: [2, 2] }, [-45, 0.006, -2.4], [-Math.PI / 2, 0, 0]));
    group.add(box(8, 5, 0.5, M('hbwall', 0xb8b4aa, { map: tex('concrete') }), [-45, 2.5, -5.9]));
    group.add(box(8, 0.06, 0.02, M('hbline', 0xf2f2ec), [-45, 0.9, -5.64]));
    group.add(box(0.06, 0.02, 5.6, M('hbline2', 0xf2f2ec), [-45, 0.01, -2.6]));
    group.add(box(8, 0.02, 0.06, M('hbline3', 0xf2f2ec), [-45, 0.01, -3.4]));
    const fence = retroMaterial('aw_fence', { map: tex('chainlink'), color: 0x9aa0a4, transparent: true, opacity: 0.9, doubleSide: true });
    group.add(box(0.05, 3.2, 6.4, fence, [-49.3, 1.6, -2.6]));
    group.add(model('bench', { x: -41.4, z: -1.0, height: 0.9, rot: -Math.PI / 2 }));
    interactables.push({ id: 'aw_handball', label: 'The handball wall', sub: 'free · burn some stress · a game for $5', x: -45, z: -3.0, radius: 1.8, action: (gg) => ashby.handball(gg) });
    solids.push(solid(-45, -5.9, 8, 0.6, 5));
    npcs.push({ kind: 'passer_m', x: -46.2, z: -3.8, rot: 0, still: true, act: 'watch' }, { kind: 'hall_m', x: -43.6, z: -3.6, rot: 0.3, still: true, act: 'talk' });
  }

  /* ------------------------------------------------ the street furniture */
  for (const x of [-38, -26, -14, -2, 10, 22, 34]) group.add(model('streetLamp', { x, z: 1.1, height: 4.4, rot: Math.PI }));
  for (const x of [-30, -16, 7, 26]) { group.add(model('streetTree', { x, z: 0.2, height: 5.2 })); solids.push(solid(x, 0.2, 0.5, 0.5, 2)); }
  for (const x of [-23, 17, 30]) group.add(model('meter', { x, z: 0.9, height: 1.3, rot: Math.PI }));
  group.add(model('hydrant', { x: -11.5, z: 0.8, height: 0.82, rot: Math.PI }));
  group.add(model('trashcan', { x: 5.6, z: 0.6, height: 0.92 }));
  group.add(model('newsbox', { x: -1.0, z: 0.5, height: 0.98, rot: Math.PI }));
  group.add(model('payphone', { x: -27.5, z: FRONT + 0.6, height: 2.1 }));
  group.add(model('bikeRack', { x: -36.5, z: 0.4, height: 0.8 }));

  // the ends: Ashby Ave back east, and the avenue on toward Flatbush
  streetMouth(group, { x: X1 + 0.4, dir: 1, look: 'avenue', title: 'ASHBY AVE', sub: "BACK EAST · LUCIA'S · THE PRECINCT", seed: 47 });
  streetMouth(group, { x: X0 - 0.4, dir: -1, look: 'avenue', title: 'ASHBY AVE', sub: 'ON TOWARD FLATBUSH', seed: 49 });
  interactables.push({ id: 'aw_east', label: 'Back east on Ashby Ave', sub: "the precinct · Lucia's · the bus", x: X1 - 1.2, z: -1.6, radius: 1.6, action: (gg) => gg.goTo('avenue', 'ashbywest') });

  // people: going somewhere, and a few who are already there
  npcs.push(
    { kind: 'passer_m', x: 10, z: -1.2, walker: [X0 + 2, X1 - 2] },
    { kind: 'w12', x: -12, z: -0.6, walker: [X0 + 2, X1 - 2] },
    { kind: 'passer_m2', x: 20, z: -2.4, walker: [X0 + 2, X1 - 2] },
    { kind: pick(['w0', 'w3', 'w8', 'w19']), x: -30, z: -1.8, walker: [X0 + 2, X1 - 2] },
    { kind: 'tenant_m', x: 26.6, z: FRONT + 0.9, rot: 0.4, still: true, act: 'smoke' },
    ...(m >= 9 * 60 && m < 17 * 60 ? [{ kind: 'cop_f', x: -22.4, z: FRONT + 1.1, rot: 0.2, still: true, act: 'talk' }] : []),
    ...(ashby.meetingOpen(s) ? [{ kind: 'newsman', x: -3.6, z: FRONT + 1.4, rot: 0.5, still: true, act: 'smoke' }] : []),
  );

  return {
    group,
    bounds: { minX: X0 + 0.5, maxX: X1 - 0.5, minZ: -5.6, maxZ: 1.3 },
    camBounds: { minX: X0 - 2, maxX: X1 + 2, minZ: -5.6, maxZ: 9 },
    traffic: { lanes: [{ z: 4.4, dir: 1 }, { z: 6.8, dir: -1 }], x0: X0 - 4, x1: X1 + 4, rate: [2, 6], bus: 0.1 },
    solids,
    spawn: { x: X1 - 2, z: -1.6, rot: -Math.PI / 2 },
    spawnFor: (from) => ({
      avenue: { x: X1 - 2, z: -1.6, rot: -Math.PI / 2 },
      postoffice: { x: 12, z: FRONT + 1.6, rot: 0 },
      court: { x: -20, z: FRONT + 1.6, rot: 0 },
      meetings: { x: -2.75, z: FRONT + 1.8, rot: 0 },
      library: { x: -33, z: FRONT + 1.6, rot: 0 },
      diner: { x: 2.5, z: FRONT + 1.6, rot: 0 },
      barber: { x: 28.5, z: FRONT + 1.6, rot: 0 },
    }[from] || { x: X1 - 2, z: -1.6, rot: -Math.PI / 2 }),
    npcs,
    interactables,
    tick: (gg, dt) => { pole.rotation.y += dt * 1.6; },
    ambient: 'street',
    title: 'Ashby Ave West',
    enterToast: 'Ashby Avenue, the west end: the courthouse, the post office, a diner that never closes, and a wall the old men own.',
  };
}

/** Spin City: buy (the shelf) or sell (Ozzie pays half). */
function recordsMenu(g) {
  const s = g.state;
  const mine = (s.inventory || []).filter((i) => i.id.startsWith('rec_') && i.qty > 0);
  g.openModal({
    kicker: 'ASHBY WEST · SPIN CITY RECORDS', title: 'Spin City Records',
    body: 'Milk crates on every surface and a listening booth with a curtain. Ozzie puts a record on before you ask, and it is the right one.',
    choices: [
      { label: 'Flip through the crates.', sub: 'records for the stereo · $8 to $11', effect: () => openShop(g, 'records') },
      ...mine.map((r) => ({ label: `Sell ${(CONFIG.items[r.id]?.name || r.id).replace('Record: ', '')}.`, sub: `Ozzie pays half · you have ${r.qty}`, effect: () => {
        const price = Math.round(((CONFIG.items[r.id]?.price || 8) / 2) * 100) / 100;
        s.inventory = s.inventory.map((i) => (i === r ? { ...i, qty: i.qty - 1 } : i)).filter((i) => i.qty > 0);
        g.earnMoney(price, 'sold a record');
        g.toast(`He slides it back into a crate like it never left. ${'$'}${price.toFixed(2)}.`, 'info');
      } })),
      ...(music.musicState(s).cds ? [{ label: 'Leave your demo CDs by the register.', sub: `up to 10 · ${'$'}4 each, Ozzie keeps ${'$'}1`, effect: () => music.consign(g) }] : []),
      { label: 'Just listen for a while.', sub: '20 min · free · Ozzie\'s pick', effect: () => { g.advance(20); bump(s, 'stress', -5); bump(s, 'morale', 3); g.toast(pick(['Ozzie plays you a Fania side you have never heard and watches your face the whole time, like a doctor.', 'A 12" from 1988 with a break so clean three customers stop flipping and nod.']), 'good'); } },
      { label: 'Leave.', effect: () => {} },
    ],
  });
}

/* ================================================================== the rooms */

/** Walls, floor, ceiling, light and the way out: everything the six rooms share. */
function room(id, { W, D, H = 3.0, floor = 'linoleum', floorColor = 0xffffff, wall = 'wall', wallColor = 0xd8d4c4, lights = 0xf2f8ff, title, toast, exit = 'Back out to Ashby Ave' }, build) {
  const group = new THREE.Group();
  group.add(plane(W, D, { name: `aw_${id}_floor`, map: tex(floor), color: floorColor, repeat: [W / 2, D / 2] }, [0, 0, 0], [-Math.PI / 2, 0, 0]));
  group.add(plane(W, D, { name: `aw_${id}_ceil`, map: tex('ceiling') }, [0, H, 0], [Math.PI / 2, 0, 0]));
  const wm = retroMaterial(`aw_${id}_wall`, { map: tex(wall), color: wallColor });
  group.add(box(0.16, H, D, wm, [-W / 2, H / 2, 0]), box(0.16, H, D, wm, [W / 2, H / 2, 0]), box(W, H, 0.16, wm, [0, H / 2, -D / 2]), box(W, H, 0.16, wm, [0, H / 2, D / 2]));
  group.add(box(1.2, 2.3, 0.12, M('rdoor', 0x3a3a3e), [0, 1.15, D / 2 - 0.1]));
  group.add(box(0.5, 0.18, 0.05, M('exit', 0xff3a2a, { emissive: 1.2, unlit: true }), [0, 2.6, D / 2 - 0.12]));
  for (const x of [-W / 4, W / 4]) group.add(box(0.18, 0.06, D * 0.7, M(`tube${lights}`, lights, { emissive: 1.1, unlit: true }), [x, H - 0.06, 0]));
  const ctx = { group, W, D, H, solids: [], interactables: [], npcs: [] };
  build(ctx);
  ctx.interactables.push({ id: `${id}_exit`, label: exit, sub: 'Ashby Ave West', x: 0, z: D / 2 - 0.6, radius: 1.1, action: (gg) => gg.goTo('ashbywest', id) });
  return {
    group,
    bounds: { minX: -W / 2 + 0.3, maxX: W / 2 - 0.3, minZ: -D / 2 + 0.4, maxZ: D / 2 - 0.3 },
    solids: ctx.solids,
    spawn: { x: 0, z: D / 2 - 1.4, rot: Math.PI },
    npcs: ctx.npcs,
    interactables: ctx.interactables,
    ambient: 'street',
    title,
    enterToast: toast,
  };
}
const wallSign = (ctx, key, x, y, z, w, h, lines, bg = '#1a2a4a', border = '#e8e2d0', ry = 0) => ctx.group.add(plane(w, h, { name: `aw_ws_${key}`, map: sign(`awws${key}`, lines, Math.round(w * 40), Math.round(h * 40), bg, border), emissive: 0.6, unlit: true }, [x, y, z], [0, ry, 0]));
const counter = (ctx, z, w, color = 0x6a5a4a, glass = true) => {
  ctx.group.add(box(w, 1.1, 0.6, M(`ctr${color}`, color, { map: tex('wood') }), [0, 0.55, z]));
  if (glass) ctx.group.add(box(w, 1.1, 0.04, retroMaterial('aw_ctrglass', { color: 0xc8e0e8, opacity: 0.3, transparent: true, unlit: true }), [0, 1.65, z]));
  ctx.solids.push(solid(0, z, w, 0.7, 1.1));
};
const chair = (group, x, z, rot, color = 0x6a6a72) => {
  const c = new THREE.Group();
  c.add(box(0.44, 0.05, 0.42, M(`chair${color}`, color), [0, 0.45, 0]));
  c.add(box(0.44, 0.45, 0.05, M(`chair${color}`, color), [0, 0.7, -0.2]));
  for (const [dx, dz] of [[-0.19, -0.18], [0.19, -0.18], [-0.19, 0.18], [0.19, 0.18]]) c.add(box(0.03, 0.45, 0.03, M('chairleg', 0x3a3a3e), [dx, 0.22, dz]));
  c.position.set(x, 0, z);
  c.rotation.y = rot;
  group.add(c);
};

/* ------------------------------------------------ Ashby Station Post Office */
export function buildPostOffice(g) {
  return room('postoffice', { W: 10, D: 8, floor: 'tile', floorColor: 0xd8d4c8, wall: 'wall', wallColor: 0xe0dccc, title: 'Ashby Station Post Office', toast: 'Ashby Station. A line, a flag, a poster about a stamp from 1994, and a clock that is right twice a day if you are lucky.' }, (ctx) => {
    const { group, W, D } = ctx;
    counter(ctx, -1.6, 7, 0x5a4a3a);
    // the PO boxes: a wall of little brass doors
    for (let r = 0; r < 7; r++) for (let c = 0; c < 10; c++) group.add(box(0.04, 0.2, 0.26, M(r % 2 === c % 2 ? 'pobox' : 'pobox2', r % 2 === c % 2 ? 0xc8a24a : 0xb8923a, { ambient: 0.9 }), [-W / 2 + 0.11, 0.6 + r * 0.24, -0.8 + c * 0.3]));
    wallSign(ctx, 'poboxes', -W / 2 + 0.12, 2.5, 0.55, 2.2, 0.35, [{ text: 'PO BOXES · 1400–1469', color: '#1a2a4a', size: 7 }], '#e8e2d0', '#1a2a4a', Math.PI / 2);
    // stanchions and the rope that makes a line out of people
    for (const x of [-2, -0.5, 1, 2.5]) group.add(box(0.06, 0.95, 0.06, M('stanchion', 0xc8a24a, { ambient: 1 }), [x, 0.48, 0.6]));
    group.add(box(4.5, 0.04, 0.04, M('rope', 0x8a1a2a), [0.25, 0.88, 0.6]));
    wallSign(ctx, 'window', 0, 2.55, -1.55, 3.0, 0.4, [{ text: 'WINDOW 2 · NEXT CUSTOMER', color: '#ffffff', size: 8 }], '#1a2a4a', '#e8e2d0');
    wallSign(ctx, 'stamp', 3.6, 1.8, -D / 2 + 0.1, 1.2, 1.4, [{ text: 'NEW!', color: '#c81e2a', size: 9 }, { text: 'THE', color: '#1a2a4a', size: 6 }, { text: 'BROOKLYN', color: '#1a2a4a', size: 8 }, { text: 'BRIDGE', color: '#1a2a4a', size: 8 }, { text: '32¢', color: '#c81e2a', size: 10 }], '#f2ecd8', '#1a2a4a');
    group.add(model('mailbox', { x: W / 2 - 0.6, z: 2.4, height: 1.15, rot: -Math.PI / 2 }));
    ctx.npcs.push({ kind: 'tenant_f', x: 0, z: -2.5, rot: 0, still: true, talk: 'po_window', act: 'talk' }, { kind: 'hall_m', x: 1.5, z: 1.4, rot: Math.PI, still: true, act: 'phone' });
    ctx.interactables.push(
      { id: 'po_window', label: 'Window 2: Mrs. Ocasio', sub: 'PO box · parcels · money orders', x: 0, z: -0.9, radius: 1.3, action: (gg) => ashby.postOffice(gg) },
      { id: 'po_boxes', label: 'Your PO box', sub: 'Box 1418', x: -W / 2 + 0.9, z: 0.6, radius: 1.0, action: (gg) => {
        const a = ashby.ashbyState(gg.state);
        if ((a.poBox || 0) < Math.floor(gg.state.clock.m / 1440)) { gg.toast('You do not have a box. Box 1418 is somebody else\'s problem.', 'info'); return; }
        if (a.held.length) ashby.pickUp(gg); else gg.toast('A tiny brass door, a little key, and nothing inside but a flyer for a pizza place that closed.', 'info');
      } },
    );
  });
}

/* ------------------------------------------------ Ashby Courthouse */
export function buildCourt(g) {
  return room('court', { W: 12, D: 10, H: 3.6, floor: 'tile', floorColor: 0xc8c0b0, wall: 'wallpaper', wallColor: 0xb8b0a0, title: 'Ashby Courthouse', toast: 'Ashby Courthouse. A metal detector, a court officer who has heard every excuse, and a hallway of people holding pink forms.' }, (ctx) => {
    const { group, W, D } = ctx;
    // the metal detector, just inside the door
    for (const dx of [-0.6, 0.6]) group.add(box(0.2, 2.1, 0.4, M('detector', 0xd8d8d0), [dx, 1.05, 2.6]));
    group.add(box(1.4, 0.2, 0.4, M('detector', 0xd8d8d0), [0, 2.15, 2.6]));
    ctx.solids.push(solid(-0.6, 2.6, 0.25, 0.45, 2), solid(0.6, 2.6, 0.25, 0.45, 2));
    // the back counter: two windows behind glass
    counter(ctx, -3.6, W - 1, 0x4a3a2a);
    wallSign(ctx, 'civil', -3.2, 2.7, -D / 2 + 0.1, 3.2, 0.45, [{ text: 'CIVIL CLERK · TICKETS', color: '#ffffff', size: 8 }], '#2a1a12', '#e8d8a8');
    wallSign(ctx, 'housing', 3.2, 2.7, -D / 2 + 0.1, 3.2, 0.45, [{ text: 'HOUSING PART · WINDOW 6', color: '#ffffff', size: 8 }], '#2a1a12', '#e8d8a8');
    wallSign(ctx, 'room104', -W / 2 + 0.1, 2.4, 0.6, 2.2, 0.4, [{ text: 'ROOM 104 · COMMUNITY SERVICE', color: '#1a1a1a', size: 6 }], '#e8e2d0', '#1a1a1a', Math.PI / 2);
    group.add(box(0.1, 2.3, 1.2, M('104door', 0x5a3a22), [-W / 2 + 0.1, 1.15, 0.6]));
    // benches for the people waiting, which is everybody
    for (const [x, z] of [[-3, 0.2], [3, 0.2], [-3, -1.4], [3, -1.4]]) group.add(model('bench', { x, z, height: 0.9 }));
    ctx.npcs.push(
      { kind: 'cop', x: 1.4, z: 2.9, rot: -0.6, still: true, act: 'talk' },
      { kind: 'tenant_f', x: -3.2, z: -4.3, rot: 0, still: true, talk: 'ct_clerk' },
      { kind: 'hall_m', x: 3.2, z: -4.3, rot: 0, still: true, talk: 'ct_housing' },
      { kind: 'passer_m2', x: -3.4, z: 0.2, rot: 0, still: true, pose: 'sit' },
      { kind: 'w14', x: 2.6, z: -1.4, rot: 0, still: true, pose: 'sit' },
    );
    ctx.interactables.push(
      { id: 'ct_clerk', label: 'The civil clerk', sub: 'pay · contest · a payment plan', x: -3.2, z: -2.9, radius: 1.3, action: (gg) => ashby.courtClerk(gg) },
      { id: 'ct_housing', label: 'Housing Part, window 6', sub: 'a case against the landlord', x: 3.2, z: -2.9, radius: 1.3, action: (gg) => ashby.housingPart(gg) },
      { id: 'ct_service', label: 'Room 104: community service', sub: 'work a ticket off · weekday crews', x: -W / 2 + 0.9, z: 0.6, radius: 1.1, action: (gg) => {
        const c = ashby.openCases(gg.state)[0];
        if (!c) { gg.toast('"You do not owe the city anything. Enjoy it. It does not last."', 'info'); return; }
        ashby.serviceDesk(gg, c);
      } },
    );
  });
}

/* ------------------------------------------------ St. Agnes basement: the Tuesday group */
export function buildMeetings(g) {
  const s = g.state;
  const live = ashby.meetingOpen(s);
  return room('meetings', { W: 10, D: 9, H: 2.7, floor: 'linoleum', floorColor: 0xc8c0a8, wall: 'concrete', wallColor: 0xd8d4c4, lights: 0xfff2d8, title: 'St. Agnes · the basement', toast: 'Down the stairs, past the boiler: folding chairs, a coffee urn, a banner somebody painted in 1987, and people who saved you a seat.', exit: 'Up the stairs to Ashby Ave' }, (ctx) => {
    const { group, D } = ctx;
    const N = 10;
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2;
      chair(group, Math.sin(a) * 2.3, -0.6 + Math.cos(a) * 2.0, a + Math.PI);
    }
    group.add(box(1.6, 0.75, 0.7, M('urntable', 0x8a7a5a, { map: tex('wood') }), [3.6, 0.38, -D / 2 + 0.6]));
    group.add(new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.5, 10), M('urn', 0xc8ccd0, { ambient: 1 })).translateX(3.3).translateY(1.0).translateZ(-D / 2 + 0.6));
    for (let i = 0; i < 6; i++) group.add(box(0.07, 0.09, 0.07, M('cup', 0xf2f2ec), [3.7 + (i % 3) * 0.12, 0.8, -D / 2 + 0.5 + Math.floor(i / 3) * 0.14]));
    group.add(box(0.5, 0.03, 0.3, M('cookies', 0xc8903a), [4.1, 0.78, -D / 2 + 0.7]));
    ctx.solids.push(solid(3.6, -D / 2 + 0.6, 1.6, 0.7, 0.9));
    wallSign(ctx, 'easy', 0, 2.0, -D / 2 + 0.1, 3.4, 0.5, [{ text: 'EASY DOES IT', color: '#1a2a4a', size: 11 }], '#f2ecd8', '#1a2a4a');
    wallSign(ctx, 'sched', -3.6, 1.6, -D / 2 + 0.1, 1.4, 1.0, [{ text: 'TUESDAY GROUP', color: '#1a1a1a', size: 7 }, { text: '7:00 PM', color: '#c81e2a', size: 9 }, { text: 'no dues · no fees', color: '#1a1a1a', size: 5 }, { text: 'just come back', color: '#1a1a1a', size: 5 }], '#f2ecd8', '#1a1a1a');
    if (live) {
      const kinds = ['newsman', 'tenant_f', 'passer_m', 'hall_f', 'tenant_m', 'w16'];
      kinds.forEach((k, j) => {
        const i = [0, 2, 3, 5, 7, 8][j];
        const a = (i / N) * Math.PI * 2;
        ctx.npcs.push({ kind: k, x: Math.sin(a) * 2.3, z: -0.6 + Math.cos(a) * 2.0, rot: a + Math.PI, still: true, pose: 'sit', ...(k === 'newsman' ? { talk: 'mt_group' } : {}) });
      });
    }
    ctx.interactables.push({ id: 'mt_group', label: live ? 'Dennis, and an empty chair' : 'The stacked chairs', sub: live ? 'the Tuesday group · 19:00 · free' : 'Tuesdays, 7 PM', x: 0, z: 1.2, radius: 1.6, action: (gg) => ashby.meeting(gg) });
  });
}

/* ------------------------------------------------ Kings Public Library, Ashby Branch */
export function buildLibrary(g) {
  return room('library', { W: 12, D: 10, H: 3.4, floor: 'carpet', floorColor: 0x8a6a5a, wall: 'wallpaper', wallColor: 0xd8ccb0, lights: 0xfff6e0, title: 'Kings Public Library · Ashby Branch', toast: 'The library. Radiators that work, chairs nobody makes you leave, and a sign that says QUIET that everybody actually obeys.' }, (ctx) => {
    const { group, W, D } = ctx;
    const bookCols = [0x8a2a2a, 0x2a4a7a, 0x3a6a3a, 0xc8a24a, 0x5a3a6a, 0xd8d0c0, 0x2a2a2a];
    const shelf = (x, z, w, rot) => {
      const sh = new THREE.Group();
      sh.add(box(w, 2.2, 0.4, M('shelf', 0x5a3a22, { map: tex('wood') }), [0, 1.1, 0]));
      for (let r = 0; r < 4; r++) for (let i = 0; i < Math.floor(w / 0.09); i++) sh.add(box(0.07, 0.36 + ((i * 7 + r) % 4) * 0.03, 0.3, M(`book${bookCols[(i * 3 + r) % 7]}`, bookCols[(i * 3 + r) % 7]), [-w / 2 + 0.06 + i * 0.09, 0.3 + r * 0.5, 0.06]));
      sh.position.set(x, 0, z);
      sh.rotation.y = rot;
      group.add(sh);
    };
    shelf(-3, -D / 2 + 0.3, 5, 0); shelf(3, -D / 2 + 0.3, 5, 0);
    shelf(-W / 2 + 0.3, -1.5, 4, Math.PI / 2); shelf(W / 2 - 0.3, -1.5, 4, -Math.PI / 2);
    ctx.solids.push(solid(0, -D / 2 + 0.3, W, 0.5, 2.2), solid(-W / 2 + 0.3, -1.5, 0.5, 4, 2.2), solid(W / 2 - 0.3, -1.5, 0.5, 4, 2.2));
    // reading tables with green lamps, and the computers along the right
    for (const x of [-2.4, 2.4]) {
      group.add(box(2.4, 0.75, 1.1, M('libtable', 0x6a4a2a, { map: tex('wood') }), [x, 0.38, 0.2]));
      group.add(box(0.2, 0.3, 0.2, M('greenlamp', 0x1e6a3a, { emissive: 0.4 }), [x, 0.9, 0.2]));
      chair(group, x - 0.6, 1.0, Math.PI, 0x5a3a22); chair(group, x + 0.6, -0.6, 0, 0x5a3a22);
      ctx.solids.push(solid(x, 0.2, 2.4, 1.1, 0.8));
    }
    for (let i = 0; i < 3; i++) {
      group.add(box(0.5, 0.42, 0.42, M('crt', 0xd8d4c4), [W / 2 - 1.0, 1.0, 1.0 + i * 0.9]));
      group.add(box(0.02, 0.32, 0.36, M('crtscreen', 0x3a7a6a, { emissive: 0.7, unlit: true }), [W / 2 - 1.26, 1.02, 1.0 + i * 0.9]));
    }
    group.add(box(0.8, 0.75, 2.8, M('comptable', 0x6a4a2a), [W / 2 - 0.9, 0.38, 1.9]));
    ctx.solids.push(solid(W / 2 - 0.9, 1.9, 0.8, 2.8, 0.8));
    // the paper rack and the big chair by the radiator
    group.add(box(0.9, 1.4, 0.3, M('rack', 0x5a3a22), [-W / 2 + 0.7, 0.7, 2.6]));
    for (let i = 0; i < 4; i++) group.add(box(0.6, 0.5, 0.02, M('paper', 0xe8e4d8), [-W / 2 + 0.7, 0.6 + i * 0.22, 2.78]));
    group.add(box(0.9, 0.5, 0.9, M('armchair', 0x7a2a2a), [-W / 2 + 1.2, 0.25, 0.6]));
    group.add(box(0.9, 0.6, 0.2, M('armchair', 0x7a2a2a), [-W / 2 + 0.85, 0.75, 0.6]));
    group.add(box(0.2, 0.7, 1.2, M('radiator', 0xd8d4c4), [-W / 2 + 0.2, 0.35, 0.6]));
    wallSign(ctx, 'quiet', 0, 2.7, -D / 2 + 0.55, 1.6, 0.4, [{ text: 'QUIET PLEASE', color: '#1a1a1a', size: 9 }], '#f2ecd8', '#1a1a1a');
    group.add(box(1.8, 1.0, 0.6, M('libdesk', 0x6a4a2a, { map: tex('wood') }), [-3.6, 0.5, 3.0]));
    ctx.solids.push(solid(-3.6, 3.0, 1.8, 0.6, 1.0));
    ctx.npcs.push({ kind: 'hall_f', x: -3.6, z: 2.4, rot: Math.PI, still: true, talk: 'lb_desk' }, { kind: 'tenant_m', x: 2.4 + 0.6, z: -0.6, rot: 0, still: true, pose: 'sit' }, { kind: 'w18', x: W / 2 - 1.8, z: 1.0, rot: -Math.PI / 2, still: true, act: 'phone' });
    ctx.interactables.push(
      { id: 'lb_paper', label: 'The newspaper rack', sub: '30 min · free · the papers on poles', x: -W / 2 + 1.2, z: 2.4, radius: 1.0, action: (gg) => ashby.library(gg, 'paper') },
      { id: 'lb_quiet', label: 'The big chair by the radiator', sub: '1 h · free · -stress, a little rest', x: -W / 2 + 1.6, z: 0.6, radius: 1.0, action: (gg) => ashby.library(gg, 'quiet') },
      { id: 'lb_comp', label: 'The public computers', sub: 'the job listings · free · 30 min', x: W / 2 - 1.7, z: 1.9, radius: 1.2, action: (gg) => { gg.advance(30); oddJobMenu(gg); } },
      { id: 'lb_desk', label: 'The librarian', sub: 'a library card · a recommendation', x: -3.6, z: 3.7, radius: 1.0, action: (gg) => gg.toast(pick(['"A card is free. Overdue is ten cents a day. I will find you." She smiles. She will.', '"You want something to read, or somewhere to sit? Both are allowed. Both are free. That is the whole idea."', '"The computers time out after thirty minutes. Print the job listings. The printer is ten cents a page and it is worth it."']), 'info') },
    );
  });
}

/* ------------------------------------------------ the Ashby Diner */
export function buildDiner(g) {
  return room('diner', { W: 10, D: 7, H: 3.0, floor: 'tile', floorColor: 0xe8e4dc, wall: 'tile', wallColor: 0xd8e8e4, lights: 0xfff2e0, title: 'The Ashby Diner', toast: 'The Ashby Diner. Red vinyl, a chrome counter, a pie case under a light, and Rita, who has already poured you a coffee.' }, (ctx) => {
    const { group, W, D } = ctx;
    group.add(box(W - 2, 1.05, 0.7, M('dcounter', 0xc8ccd0, { ambient: 1 }), [-0.5, 0.52, -1.6]));
    group.add(box(W - 2, 0.06, 0.8, M('dtop', 0xd83a3a), [-0.5, 1.07, -1.6]));
    ctx.solids.push(solid(-0.5, -1.6, W - 2, 0.8, 1.1));
    for (let i = 0; i < 6; i++) {
      const x = -4 + i * 1.2;
      group.add(new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.1, 10), M('stool', 0xd83a3a)).translateX(x).translateY(0.7).translateZ(-0.9));
      group.add(box(0.06, 0.65, 0.06, M('stoolpost', 0xc8ccd0), [x, 0.33, -0.9]));
    }
    // the pie case, turning under its light
    group.add(box(0.7, 0.6, 0.6, retroMaterial('aw_piecase', { color: 0xc8e0e8, opacity: 0.4, transparent: true, unlit: true }), [3.2, 1.4, -1.6]));
    for (let i = 0; i < 3; i++) group.add(box(0.4, 0.06, 0.4, M('pie', 0xd8a050), [3.2, 1.2 + i * 0.16, -1.6]));
    group.add(box(W - 0.4, 0.6, 0.1, M('backsplash', 0xc8ccd0, { ambient: 1 }), [0, 1.6, -D / 2 + 0.1]));
    wallSign(ctx, 'menu', -1.5, 2.3, -D / 2 + 0.12, 4.2, 0.7, [{ text: 'BREAKFAST ALL DAY', color: '#ffffff', size: 9 }, { text: 'COFFEE 1.50 · PIE 3.50 · THE SPECIAL 7.50', color: '#ffe23a', size: 6 }], '#1a1a1a', '#d83a3a');
    // booths along the window, and the jukebox
    for (const x of [-3.4, 3.2]) { group.add(model('dinerBooth', { x, z: D / 2 - 1.4, height: 1.15, rot: Math.PI })); ctx.solids.push(solid(x, D / 2 - 1.4, 2.0, 1.3, 1.1)); }
    group.add(model('jukebox', { x: W / 2 - 0.6, z: 0.2, height: 1.5, rot: -Math.PI / 2 }));
    ctx.solids.push(solid(W / 2 - 0.6, 0.2, 0.8, 0.8, 1.5));
    ctx.npcs.push({ kind: 'tenant_f', x: 0, z: -2.4, rot: 0, still: true, talk: 'dn_counter', act: 'talk' }, { kind: 'hall_m', x: -2.8, z: -0.9, rot: Math.PI, still: true, act: 'phone' }, { kind: 'newsman', x: 2.0, z: -0.9, rot: Math.PI, still: true });
    ctx.interactables.push(
      { id: 'dn_counter', label: 'Rita at the counter', sub: 'coffee · pie · the special', x: 0, z: -0.8, radius: 1.4, action: (gg) => openShop(gg, 'diner') },
      { id: 'dn_booth', label: 'Take a booth by the window', sub: '30 min · watch the avenue · -stress', x: -3.4, z: D / 2 - 2.3, radius: 1.2, action: (gg) => { gg.advance(30); bump(gg.state, 'stress', -7); bump(gg.state, 'morale', 3); gg.toast(pick(['Thirty minutes in a booth watching Ashby go by: a bus, a fight about a parking spot, a man walking a cat. Rita refills your coffee without asking.', 'The booth has a crack in the vinyl shaped like Florida. You trace it with your thumb and nobody needs anything from you.']), 'good'); } },
      { id: 'dn_jukebox', label: 'The jukebox', sub: '25¢ · a song from before you were born', x: W / 2 - 1.3, z: 0.2, radius: 1.0, action: (gg) => { if (!gg.spendMoney(0.25, 'jukebox')) return; bump(gg.state, 'morale', 3); gg.audio?.sfx?.('coin'); gg.toast(pick(['B7. Something with strings and a man who means every word. Rita sings the harmony without looking up.', 'You pick a song for its name. It turns out to be about a train, like every song in a diner.']), 'good'); } },
    );
  });
}

/* ------------------------------------------------ Joe's Barber */
export function buildBarber(g) {
  return room('barber', { W: 7, D: 6, H: 2.9, floor: 'tile', floorColor: 0xf2f2ec, wall: 'wall', wallColor: 0xb8d8e8, title: "Joe's Barber", toast: "Joe's. The clippers, the radio, the game on mute, and four men who are not waiting for a haircut." }, (ctx) => {
    const { group, W, D } = ctx;
    group.add(box(W - 1, 1.2, 0.04, M('mirror', 0xd8e8f0, { emissive: 0.3, ambient: 1 }), [0, 1.6, -D / 2 + 0.1]));
    group.add(box(W - 1, 0.8, 0.4, M('station', 0x2a2a2e), [0, 0.4, -D / 2 + 0.3]));
    ctx.solids.push(solid(0, -D / 2 + 0.3, W - 1, 0.4, 0.8));
    for (const x of [-1.4, 1.4]) {
      group.add(box(0.7, 0.5, 0.7, M('bchair', 0xb81e2a), [x, 0.55, -D / 2 + 1.3]));
      group.add(box(0.7, 0.7, 0.12, M('bchair', 0xb81e2a), [x, 1.05, -D / 2 + 1.62]));
      group.add(new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 0.3, 10), M('bchrome', 0xc8ccd0, { ambient: 1 })).translateX(x).translateY(0.15).translateZ(-D / 2 + 1.3));
      ctx.solids.push(solid(x, -D / 2 + 1.3, 0.7, 0.7, 1.0));
    }
    for (let i = 0; i < 4; i++) chair(group, -W / 2 + 0.6 + i * 0.6, D / 2 - 1.0, Math.PI, 0x2a2a2e);
    group.add(box(0.8, 0.5, 0.1, M('btv', 0x1a1a1e), [W / 2 - 0.2, 2.3, 0], [0, -Math.PI / 2, 0]));
    group.add(box(0.02, 0.4, 0.66, M('btvscreen', 0x3a8a4a, { emissive: 0.8, unlit: true }), [W / 2 - 0.26, 2.3, 0]));
    ctx.npcs.push(
      { kind: 'hall_m', x: -1.4, z: -D / 2 + 2.0, rot: Math.PI, still: true, talk: 'bb_chair', act: 'talk' },
      { kind: 'tenant_m', x: -W / 2 + 0.6, z: D / 2 - 1.0, rot: Math.PI, still: true, pose: 'sit', act: 'talk' },
      { kind: 'newsman', x: -W / 2 + 1.8, z: D / 2 - 1.0, rot: Math.PI, still: true, pose: 'sit' },
    );
    ctx.interactables.push({ id: 'bb_chair', label: 'Joe, and the empty chair', sub: 'a cut · a shave · or just sit', x: 1.4, z: -D / 2 + 2.2, radius: 1.3, action: (gg) => ashby.barber(gg) });
  });
}
