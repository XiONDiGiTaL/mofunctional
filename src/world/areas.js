/** World geometry + every interactable. Areas: apartment, street, church, menu. */
import * as THREE from '../../vendor/three.module.js';
import { retroMaterial, box, plane } from '../render/retro.js';
import { tex } from '../render/textures.js';
import { CONFIG } from '../core/config.js';
import { countItem, inventoryList, addItem, removeItem, hasItem } from '../core/state.js';
import { bump } from '../core/state.js';
import { money, chance, pick, clamp, randInt, minuteOfDay, dayOf } from '../core/util.js';
import { eat, sleep, useSubstance, soberUp } from '../systems/needs.js';
import { visitFellowship, serviceWindow } from '../systems/fellowship.js';
import { workShift, callOut, quitJob, applyForJob, doOddJob, oddJobsAvailable, shiftInfo } from '../systems/jobs.js';
import { buyFood, sellToDex, buyGrabBag, billInfo } from '../systems/economy.js';
import { npcLine, AMBIENT_LINES } from '../systems/dialogue.js';
import { openShop } from './shops.js';
import { showFridge } from '../ui/fridge.js';
import { STREET, BUILDINGS, building, streetSpawn } from './plan.js';
import { signTex } from '../render/signs.js';
import * as life from '../systems/life.js';

const M = {
  floor: retroMaterial('floor', { map: tex('linoleum') }),
  wall: retroMaterial('wallA', { map: tex('wallpaper') }),
  concrete: retroMaterial('conc', { map: tex('concrete') }),
  ceiling: retroMaterial('ceil', { map: tex('ceiling') }),
  wood: retroMaterial('woodA', { map: tex('wood') }),
  metal: retroMaterial('metalA', { map: tex('metal') }),
  brick: retroMaterial('brickA', { map: tex('brick') }),
  sidewalk: retroMaterial('sw', { map: tex('sidewalk') }),
  asphalt: retroMaterial('asph', { map: tex('asphalt') }),
  carpet: retroMaterial('carpetA', { map: tex('carpet') }),
  tile: retroMaterial('tileA', { map: tex('tile') }),
  door: retroMaterial('doorA', { map: tex('door') }),
  goldDoor: retroMaterial('goldDoor', { color: 0xd8b063, emissive: 0.1 }),
  fabric: retroMaterial('fabricA', { color: 0x6a5a4a }),
  mattress: retroMaterial('mattress', { color: 0xb9b3a0 }),
  white: retroMaterial('whiteA', { color: 0xe8e6da }),
  green: retroMaterial('greenA', { color: 0x2f6b4a }),
  dark: retroMaterial('darkA', { color: 0x141a16 }),
  tvStatic: retroMaterial('tvstatic', { map: tex('static'), emissive: 0.55, unlit: true }),
  neon: retroMaterial('neonA', { map: tex('neon'), emissive: 1.0, unlit: true, transparent: true, alphaTest: 0.1 }),
  window: retroMaterial('windowA', { map: tex('window'), emissive: 0.35, unlit: true }),
  poster: retroMaterial('posterA', { map: tex('poster'), emissive: 0.1 }),
  cross: retroMaterial('crossA', { map: tex('cross'), emissive: 0.35, unlit: true }),
  candle: retroMaterial('candleA', { color: 0xffd9a0, emissive: 0.9, unlit: true }),
  red: retroMaterial('redA', { color: 0x7a2a26 }),
  lamp: retroMaterial('lampA', { color: 0xfff2c4, emissive: 1.0, unlit: true }),
};

// h: how tall it stands. Anything under ~1.5 m is below the camera's eye and does not stop the
// follow camera (a bed, a counter, a bench); taller things (shelves, the fridge, trees) do.
const solid = (x, z, w, d, h = 2.4) => ({ x, z, w, d, h });

/* ------------------------------ APARTMENT ------------------------------ */

export function buildApartment(g) {
  const group = new THREE.Group();
  const W = 7, D = 9;
  const floor = plane(W, D, { name: 'apfloor', map: tex('linoleum'), repeat: [3, 4] }, [0, 0, 0], [-Math.PI / 2, 0, 0]);
  group.add(floor);

  // walls
  group.add(box(W, 2.7, 0.16, { name: 'apwall', map: tex('wallpaper') }, [0, 1.35, -D / 2]));
  group.add(box(W, 2.7, 0.16, { name: 'apwall2', map: tex('wallpaper') }, [0, 1.35, D / 2]));
  group.add(box(0.16, 2.7, D, { name: 'apwall3', map: tex('wallpaper') }, [-W / 2, 1.35, 0]));
  group.add(box(0.16, 2.7, D, { name: 'apwall4', map: tex('wallpaper') }, [W / 2, 1.35, 0]));
  group.add(plane(W, D, { name: 'apceil', map: tex('ceiling'), repeat: [2, 3] }, [0, 2.7, 0], [Math.PI / 2, 0, 0]));

  // window (front wall) with a view that is just a wall
  group.add(plane(1.5, 1.2, { name: 'apwin', map: tex('window'), emissive: 0.4, unlit: true }, [1.6, 1.6, -D / 2 + 0.09]));

  // bed
  group.add(box(1.1, 0.22, 2.0, M.metal, [-2.4, 0.24, -2.4]));
  group.add(box(1.0, 0.16, 1.9, M.mattress, [-2.4, 0.42, -2.4]));
  group.add(box(1.0, 0.06, 0.5, M.white, [-2.4, 0.53, -3.1]));
  group.add(box(1.0, 0.05, 1.2, retroMaterial('blanket', { color: 0x4a5560 }), [-2.4, 0.52, -2.1]));
  group.add(box(0.08, 0.5, 1.9, M.metal, [-3.0, 0.6, -2.4]));

  // fridge
  group.add(box(0.8, 1.8, 0.75, retroMaterial('fridge', { color: 0xc9c9bd }), [2.7, 0.9, -3.5]));
  group.add(box(0.02, 1.6, 0.03, M.dark, [2.7, 0.9, -3.11]));
  group.add(box(0.06, 0.4, 0.04, M.metal, [2.5, 1.15, -3.09]));

  // counter + sink
  group.add(box(2.4, 0.85, 0.7, M.wood, [1.1, 0.43, -3.6]));
  group.add(box(2.4, 0.06, 0.72, M.tile, [1.1, 0.87, -3.6]));
  group.add(box(0.55, 0.12, 0.45, M.metal, [1.1, 0.9, -3.6]));
  group.add(box(0.05, 0.3, 0.05, M.metal, [1.1, 1.05, -3.75]));
  // stove-ish thing with two dials
  group.add(box(0.9, 0.86, 0.68, retroMaterial('stove', { color: 0xa8a89c }), [-0.8, 0.43, -3.6]));

  // table + laptop
  group.add(box(1.0, 0.06, 0.7, M.wood, [1.4, 0.72, -0.2]));
  for (const [x, z] of [[0.95, -0.5], [1.85, -0.5], [0.95, 0.1], [1.85, 0.1]]) {
    group.add(box(0.06, 0.72, 0.06, M.wood, [x, 0.36, z]));
  }
  group.add(box(0.42, 0.03, 0.3, M.dark, [1.4, 0.76, -0.2]));
  group.add(box(0.4, 0.24, 0.02, retroMaterial('laptop', { map: tex('static'), emissive: 0.5, unlit: true }), [1.4, 0.88, -0.34], [-0.5, 0, 0]));
  // chair
  group.add(box(0.5, 0.06, 0.5, M.fabric, [1.4, 0.45, 0.55]));
  group.add(box(0.5, 0.55, 0.06, M.fabric, [1.4, 0.72, 0.79]));

  // tv
  group.add(box(0.8, 0.5, 0.6, M.wood, [-2.6, 0.25, 1.6]));
  group.add(box(0.75, 0.6, 0.62, retroMaterial('crt', { color: 0x3a3a38 }), [-2.6, 0.85, 1.6]));
  group.add(plane(0.56, 0.42, { name: 'tvscreen', map: tex('static'), emissive: 0.7, unlit: true }, [-2.6, 0.88, 1.29]));

  // door
  group.add(box(1.0, 2.2, 0.12, M.door, [0, 1.1, D / 2 - 0.05]));
  group.add(box(0.08, 0.08, 0.06, M.goldDoor, [0.35, 1.05, D / 2 - 0.12]));

  // poster + stains
  group.add(plane(0.6, 0.9, { name: 'apposter', map: tex('poster'), emissive: 0.05 }, [-3.0, 1.6, -1.0], [0, Math.PI / 2, 0]));
  group.add(box(1.2, 0.4, 0.02, retroMaterial('stainwall', { color: 0x6d5b3f, opacity: 0.55, transparent: true }), [0.6, 2.2, -D / 2 + 0.1]));

  // ceiling bulb
  group.add(box(0.24, 0.06, 0.24, M.lamp, [0, 2.62, 0.6]));
  group.add(box(0.03, 0.1, 0.03, M.dark, [0, 2.7, 0.6]));

  // trash + bag
  group.add(box(0.45, 0.6, 0.45, M.dark, [2.9, 0.3, 2.6]));
  group.add(box(0.5, 0.35, 0.4, retroMaterial('bag', { color: 0x2a2a26 }), [-3.0, 0.18, 2.4]));

  const interactables = [
    { id: 'bed', label: 'Sleep in the bed', sub: 'rest · costs hours', x: -2.4, z: -1.9, action: (gg) => bedMenu(gg) },
    { id: 'fridge', label: 'Open the fridge', sub: 'eat · store food for later', x: 2.7, z: -2.9, action: (gg) => showFridge(gg) },
    { id: 'sink', label: 'Shower in the sink-room', sub: '+hygiene · 25 min', x: 1.1, z: -3.0, action: (gg) => shower(gg) },
    { id: 'tv', label: 'Turn on the TV', sub: 'waste time productively', x: -2.6, z: 1.0, action: (gg) => tvMenu(gg) },
    { id: 'laptop', label: 'Use the laptop', sub: 'open BidBay', x: 1.4, z: 0.1, action: (gg) => gg.openPhone('bidbay') },
    { id: 'bag', label: 'Check your bag', sub: 'the drawer, sort of', x: -3.0, z: 2.4, action: (gg) => stashMenu(gg) },
    { id: 'door', label: 'Leave the apartment', sub: 'go outside', x: 0, z: 3.9, action: (gg) => gg.goTo('street', 'apartment') },
  ];
  if (g.state.flags.cat) {
    interactables.push({ id: 'cat', label: 'Pet Chairman', sub: '+morale', x: 0.9, z: 1.9, action: (gg) => { bump(gg.state, 'morale', 6); bump(gg.state, 'stress', -4); gg.advance(5); gg.toast(npcLine('chairman'), 'good'); } });
  }

  return {
    group,
    bounds: { minX: -3.2, maxX: 3.2, minZ: -4.1, maxZ: 4.0 },
    solids: [
      solid(-2.4, -2.4, 1.3, 2.1, 0.6), solid(2.7, -3.5, 0.9, 0.85, 1.8), solid(1.1, -3.6, 2.5, 0.8, 0.9),
      solid(-0.8, -3.6, 1.0, 0.8, 0.9), solid(1.4, -0.2, 1.2, 0.9, 0.9), solid(-2.6, 1.6, 0.9, 0.7, 1.15),
      solid(2.9, 2.6, 0.6, 0.6, 0.6), solid(-3.0, 2.4, 0.6, 0.5, 0.35),
    ],
    spawn: { x: 0, z: 1.15, rot: Math.PI },
    npcs: g.state.flags.cat ? [{ kind: 'cat', x: 0.9, z: 1.9, rot: -0.6 }] : [],
    interactables,
    ambient: 'apartment',
  };
}

function bedMenu(g) {
  const s = g.state;
  const mod = minuteOfDay(s.clock.m);
  g.openModal({
    kicker: 'THE BED',
    title: 'Horizontal, For A While',
    body: `It is ${String(Math.floor(mod / 60)).padStart(2, '0')}:${String(mod % 60).padStart(2, '0')}. The mattress has a shape in it that you did not put there.\n\nSleep restores energy. It also skips the clock forward. You cannot sleep through a shift and keep the shift.`,
    choices: [
      { label: 'Sleep 4 hours.', sub: 'quick · partial recovery', effect: () => sleep(g, 4) },
      { label: 'Sleep 7 hours.', sub: 'the responsible option', effect: () => sleep(g, 7) },
      { label: 'Sleep 9 hours.', sub: 'grief nap, basically', effect: () => sleep(g, 9) },
      { label: 'Lie down for an hour.', sub: '+energy, still awake-ish', effect: () => { g.advance(60, { sleeping: true }); bump(s, 'energy', 4); bump(s, 'stress', -3); } },
      { label: 'Get up.', sub: '', effect: () => {} },
    ],
  });
}

function shower(g) {
  const s = g.state;
  if (s.flags.powerCut) {
    g.advance(20);
    bump(s, 'hygiene', 12);
    bump(s, 'stress', 9);
    bump(s, 'energy', -4);
    g.toast('Cold shower. Every hair on your body files a separate complaint.', 'bad');
    return;
  }
  g.advance(25);
  bump(s, 'hygiene', 34);
  bump(s, 'stress', -7);
  bump(s, 'morale', 2);
  g.audio.sfx('confirm');
  g.toast('Clean. The world is 4% more negotiable.', 'good');
}

function tvMenu(g) {
  const s = g.state;
  g.openModal({
    kicker: 'THE TELEVISION',
    title: 'Whatever Is On',
    body: 'A show about people buying storage units. A commercial for a mattress. The news, briefly, and then not the news.',
    choices: [
      { label: 'Watch for an hour.', sub: '-1h · +morale · -stress', effect: () => { g.advance(60); bump(s, 'morale', 6); bump(s, 'stress', -9); bump(s, 'energy', -3); g.toast('You laugh once, genuinely, at a commercial.', 'good'); } },
      { label: 'Watch until you hate yourself.', sub: '-3h · +morale then -morale', effect: () => { g.advance(180); bump(s, 'morale', 4); bump(s, 'stress', -6); bump(s, 'energy', -9); bump(s, 'hygiene', -3); g.toast('Three hours. You could describe the plot of nothing that happened.', 'bad'); } },
      { label: 'Turn it off.', sub: '', effect: () => {} },
    ],
  });
}

function stashMenu(g) {
  const s = g.state;
  const subs = inventoryList(s).filter((i) => i.def.kind === 'substance');
  if (!subs.length) {
    g.toast('Nothing in the drawer but a lighter and an old receipt.', 'info');
    bump(s, 'stress', 3);
    return;
  }
  g.openModal({
    kicker: 'THE DRAWER',
    title: 'The Arithmetic',
    body: `Addiction: ${Math.round(s.stats.addiction)}% · Tolerance: ${Math.round(s.stats.tolerance)}% · Risk: ${Math.round(s.stats.risk)}%\n\nEverything in this drawer raises your risk. Risk at 100 is the end of the game.`,
    choices: [
      ...subs.map((it) => ({
        label: `Use ${it.def.name} (x${it.qty}).`,
        sub: `risk +${CONFIG.substances.types[it.id]?.risk ?? '?'} · addict +${CONFIG.substances.types[it.id]?.addiction ?? '?'}`,
        effect: () => useSubstance(g, it.id),
      })),
      { label: 'Drink water. Go outside. Do not.', sub: '+stress, -addiction risk later', effect: () => soberUp(g) },
      { label: 'Close the drawer.', sub: '', effect: () => {} },
    ],
  });
}

/* ------------------------------ STREET ------------------------------ */

export function buildStreet(g) {
  const group = new THREE.Group();
  const L = 46, D = 16;
  group.add(plane(L, D, { name: 'streetsw', map: tex('sidewalk'), repeat: [14, 5] }, [0, 0, -1.4], [-Math.PI / 2, 0, 0]));
  group.add(plane(L, 8, { name: 'streetasph', map: tex('asphalt'), repeat: [16, 3] }, [0, -0.01, 5.2], [-Math.PI / 2, 0, 0]));
  // curb
  group.add(box(L, 0.18, 0.4, M.concrete, [0, 0.09, 1.3]));

  // building facades along the back
  const facade = (x, w, h, tint) => {
    group.add(box(w, h, 1.2, { name: 'facade', map: tex('brick'), color: tint }, [x, h / 2, -7.2]));
    const rows = Math.floor(h / 1.6);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < Math.max(1, Math.floor(w / 2.4)); c++) {
        const wx = x - w / 2 + 1.0 + c * 2.4;
        const wy = 1.2 + r * 1.6;
        if (wx > x - w / 2 + 0.3 && wx < x + w / 2 - 0.3) {
          group.add(plane(0.9, 1.0, { name: 'win', map: tex('window'), emissive: chance(0.35) ? 0.45 : 0.08, unlit: true }, [wx, wy, -6.58]));
        }
      }
    }
  };
  facade(-9.8, 6.6, 7.5, 0xc8c0b4);   // 1120 Kestrel: the tall walk-up
  facade(-16.5, 5.2, 4.6, 0x9c8a76);  // the bodega's own low building, darker brick
  facade(1.5, 9, 6.2, 0xd8cfc0);
  facade(11.5, 5.4, 8.5, 0xe4d6b0);
  facade(-3.6, 3.0, 5.0, 0x9a9088);
  facade(16.85, 4.5, 6.4, 0xb8b8aa);
  // the seam between the bodega and the walk-up: a drainpipe and a shadow, so they read as two
  group.add(box(0.6, 7.6, 0.4, retroMaterial('seam', { color: 0x1a1d1e }), [-13.5, 3.8, -6.9]));
  group.add(box(0.12, 7.4, 0.12, M.metal, [-13.5, 3.7, -6.6]));

  /**
   * An entrance you can find: a recessed door in a pale frame, a step, a mat, a lamp over it
   * and the pool of light it throws on the walk, and a lit sign above. Every door on the block
   * is built the same way, so once you have found one you can find them all.
   */
  const entrance = (x, { w = 1.15, h = 2.35, door = 0x3a2f26, trim = 0xd8d0b8, light = 0xffd9a0, sign = null, signW = 2.4, signH = 0.6, signY = null }) => {
    const trimMat = retroMaterial(`trim${trim}`, { color: trim, ambient: 0.7 });
    group.add(box(w + 0.5, h + 0.3, 0.1, retroMaterial('recess', { color: 0x0e1012 }), [x, (h + 0.3) / 2, -6.32]));
    group.add(box(w, h, 0.12, retroMaterial(`door${door}`, { color: door }), [x, h / 2, -6.26]));
    group.add(box(w * 0.6, h * 0.34, 0.03, retroMaterial('doorpane', { color: 0xbfd6c8, emissive: 0.45, unlit: true }), [x, h * 0.66, -6.19]));
    group.add(box(0.14, h + 0.18, 0.26, trimMat, [x - w / 2 - 0.08, (h + 0.18) / 2, -6.2]));
    group.add(box(0.14, h + 0.18, 0.26, trimMat, [x + w / 2 + 0.08, (h + 0.18) / 2, -6.2]));
    group.add(box(w + 0.46, 0.18, 0.26, trimMat, [x, h + 0.09, -6.2]));
    group.add(box(0.06, 0.26, 0.07, M.goldDoor, [x + w / 2 - 0.17, 1.05, -6.16]));
    group.add(box(w + 0.7, 0.1, 0.55, M.concrete, [x, 0.05, -5.98]));
    group.add(box(w * 0.92, 0.025, 0.5, retroMaterial('doormat', { color: 0x40302a }), [x, 0.11, -5.72]));
    group.add(box(0.42, 0.14, 0.24, retroMaterial(`lamp${light}`, { color: light, emissive: 1.1, unlit: true }), [x, h + 0.36, -6.1]));
    group.add(plane(2.6, 2.1, { name: `pool${light}`, color: light, opacity: 0.17, transparent: true, unlit: true }, [x, 0.035, -5.25], [-Math.PI / 2, 0, 0]));
    if (sign) {
      group.add(plane(signW, signH, { name: `sign${x}`, map: sign, emissive: 1.0, unlit: true }, [x, signY ?? h + 0.95, -6.12]));
    }
  };

  // 1120 Kestrel: the stoop Mo lives up
  const apt = building('apartment');
  entrance(apt.door, {
    door: 0x4a3b2a, trim: 0xe0d6c0, light: 0xffe0a8, signW: 1.5, signH: 0.5,
    sign: signTex('sign1120', [{ text: '1120', color: '#f6e8c2', size: 18 }, { text: 'KESTREL ST', color: '#bfae86', size: 7 }], { w: 64, h: 32, bg: '#1d1712', border: '#8a7452' }),
  });
  for (let i = 0; i < 2; i++) group.add(box(1.9 - i * 0.3, 0.12, 0.4, M.concrete, [apt.door, 0.06 + i * 0.12, -5.62 + i * 0.32]));

  // Quik-Stop storefront
  group.add(box(6.2, 3.0, 0.3, retroMaterial('storefront', { color: 0x2a3a30 }), [1.5, 1.5, -6.5]));
  group.add(plane(4.6, 1.4, { name: 'storewin', map: tex('window'), emissive: 0.5, unlit: true }, [1.5, 1.6, -6.32]));
  group.add(plane(2.4, 1.0, { name: 'storesign', map: tex('neon'), emissive: 0.9, unlit: true }, [1.5, 3.5, -6.3]));
  group.add(box(6.4, 0.16, 1.2, M.green, [1.5, 3.1, -6.0]));
  group.add(plane(2.6, 0.5, { name: 'qssign', map: signTex('signQuik', [{ text: 'QUIK-STOP #14', color: '#ffe36a', size: 13 }, { text: 'OPEN 24 HRS · COFFEE · LOTTO', color: '#9fe3ff', size: 6 }], { w: 128, h: 32, bg: '#0f1a14', border: '#2f6b4a' }), emissive: 1, unlit: true }, [1.5, 2.5, -6.28]));
  group.add(plane(2.8, 2.2, { name: 'qspool', color: 0xbfe8ff, opacity: 0.14, transparent: true, unlit: true }, [1.5, 0.035, -5.2], [-Math.PI / 2, 0, 0]));
  // awning stripes
  for (let i = 0; i < 6; i++) {
    group.add(box(1.05, 0.18, 1.15, i % 2 ? M.white : retroMaterial('awningRed', { color: 0x8a3a32 }), [1.5 - 2.65 + i * 1.06, 3.02, -5.9]));
  }

  // Fellowship: gold doors, cross
  group.add(box(5.4, 4.4, 0.3, retroMaterial('churchfront', { color: 0xd8cba8 }), [11.5, 2.2, -6.5]));
  group.add(box(1.8, 3.0, 0.25, M.goldDoor, [11.5, 1.5, -6.4]));
  group.add(box(0.1, 2.4, 0.05, retroMaterial('doorseam', { color: 0x7a5c1e }), [11.5, 1.5, -6.27]));
  group.add(plane(1.2, 1.8, { name: 'churchcross', map: tex('cross'), emissive: 0.5, unlit: true }, [11.5, 4.9, -6.3]));
  group.add(plane(3.4, 0.5, { name: 'churchsign', map: signTex('signChurch', [{ text: 'THE GOLDEN FELLOWSHIP', color: '#ffe08a', size: 10, font: 'Georgia, serif' }, { text: 'ALL ARE WELCOME · SUNDAY 11:00', color: '#d8c08a', size: 6 }], { w: 160, h: 28, bg: '#2a2014', border: '#c9a24a' }), emissive: 0.9, unlit: true }, [11.5, 3.45, -6.33]));
  group.add(plane(3.0, 2.4, { name: 'churchpool', color: 0xffe0a0, opacity: 0.16, transparent: true, unlit: true }, [11.5, 0.035, -5.2], [-Math.PI / 2, 0, 0]));
  group.add(box(0.4, 0.16, 0.4, M.candle, [10.2, 0.3, -5.9]));
  group.add(box(0.4, 0.16, 0.4, M.candle, [12.8, 0.3, -5.9]));

  // alley
  group.add(box(3.0, 0.05, 8, retroMaterial('alleyfloor', { color: 0x24282a }), [-3.6, 0.02, -2.5]));
  group.add(box(1.4, 0.9, 0.9, retroMaterial('dumpster', { color: 0x2e4a34 }), [-4.2, 0.45, -5.2]));
  group.add(box(1.45, 0.1, 0.95, retroMaterial('dumpsterlid', { color: 0x253a2a }), [-4.2, 0.95, -5.2], [0, 0, 0.1]));
  group.add(box(0.5, 0.7, 0.5, M.dark, [-2.6, 0.35, -3.6]));
  group.add(box(0.3, 1.2, 0.3, M.metal, [-5.2, 0.6, -2.0]));
  // puddle
  group.add(plane(1.6, 1.2, { name: 'puddle', color: 0x3a4a52, opacity: 0.6, transparent: true, unlit: true }, [-3.6, 0.03, -1.4], [-Math.PI / 2, 0, 0]));

  // street furniture
  const lamp = (x) => {
    group.add(box(0.14, 3.4, 0.14, M.metal, [x, 1.7, 0.6]));
    group.add(box(0.5, 0.1, 0.3, M.lamp, [x, 3.45, 0.35]));
    group.add(plane(0.6, 0.02, { name: 'lampglow', color: 0xfff2c4, opacity: 0.25, transparent: true, unlit: true }, [x, 0.05, 0.5], [-Math.PI / 2, 0, 0]));
  };
  [-8, 0, 8.5, 17].forEach(lamp);
  // bench
  group.add(box(1.8, 0.08, 0.5, M.wood, [-7.5, 0.5, 0.2]));
  group.add(box(1.8, 0.5, 0.08, M.wood, [-7.5, 0.75, -0.05]));
  group.add(box(0.08, 0.5, 0.5, M.metal, [-8.35, 0.25, 0.2]));
  group.add(box(0.08, 0.5, 0.5, M.metal, [-6.65, 0.25, 0.2]));
  // bus stop
  group.add(box(2.2, 2.2, 0.08, { name: 'glass', color: 0x8fb0b8, opacity: 0.35, transparent: true, unlit: true }, [6.5, 1.2, -5.8]));
  group.add(box(0.1, 2.4, 0.1, M.metal, [5.4, 1.2, -5.8]));
  group.add(box(0.1, 2.4, 0.1, M.metal, [7.6, 1.2, -5.8]));
  group.add(box(1.2, 0.5, 0.08, retroMaterial('bussign', { color: 0x2a4a6a, emissive: 0.15 }), [7.6, 2.6, -5.8]));
  // job board
  group.add(box(1.0, 1.4, 0.1, M.wood, [5.0, 0.9, -6.2]));
  group.add(plane(0.85, 1.2, { name: 'jobposter', map: tex('poster') }, [5.0, 0.95, -6.13]));
  group.add(box(0.1, 0.9, 0.1, M.wood, [4.6, 0.45, -6.2]));
  group.add(box(0.1, 0.9, 0.1, M.wood, [5.4, 0.45, -6.2]));
  // trash cans
  group.add(box(0.6, 0.9, 0.6, retroMaterial('trash', { color: 0x39443c }), [9.5, 0.45, -5.6]));
  group.add(box(0.6, 0.9, 0.6, retroMaterial('trash2', { color: 0x39443c }), [-13.5, 0.45, -5.7]));
  // road markings + hydrant
  group.add(box(0.6, 0.02, 44, retroMaterial('line', { color: 0xb0a262 }), [0, 0.02, 5.2]));
  group.add(box(0.3, 0.6, 0.3, retroMaterial('hydrant', { color: 0x8a3a32 }), [-5.0, 0.3, 0.9]));
  group.add(box(0.4, 0.1, 0.4, retroMaterial('hydrantTop', { color: 0x6a2a24 }), [-5.0, 0.62, 0.9]));

  // ---- Miguel's bodega, west end, on its own lot: a lit sign, an OPEN light, a framed door
  const bod = building('bodega');
  const bodC = (bod.x0 + bod.x1) / 2;
  group.add(box(bod.x1 - bod.x0 - 0.2, 3.2, 0.3, retroMaterial('bodfront', { color: 0x2c3d33 }), [bodC, 1.6, -6.5]));
  group.add(plane(2.4, 1.4, { name: 'bodwin', map: tex('window'), emissive: 0.5, unlit: true }, [bodC - 1.1, 1.65, -6.32]));
  group.add(plane(0.9, 0.36, { name: 'bodopen', map: signTex('signOpen', [{ text: 'OPEN', color: '#ff4a6a', size: 18, glow: '#ff4a6a' }], { w: 64, h: 24, bg: '#140a0c' }), emissive: 1.2, unlit: true }, [bodC - 1.6, 2.05, -6.3]));
  group.add(box(bod.x1 - bod.x0, 0.18, 1.3, retroMaterial('bodawning', { color: 0x2f5b3c }), [bodC, 3.35, -5.95]));
  for (let i = 0; i < 9; i++) {
    group.add(box(0.56, 0.2, 1.25, i % 2 ? retroMaterial('bodawn2', { color: 0xe0d8bd }) : retroMaterial('bodawning', { color: 0x2f5b3c }),
      [bod.x0 + 0.3 + i * 0.57, 3.25, -5.9]));
  }
  group.add(plane(4.4, 0.75, { name: 'bodsign', map: signTex('signBodega', [{ text: 'KESTREL BODEGA', color: '#ffd23f', size: 15 }, { text: 'DELI · GROCERY · LOTTO · ATM', color: '#ffffff', size: 7 }], { w: 160, h: 32, bg: '#8a1e22', border: '#ffd23f' }), emissive: 1.0, unlit: true }, [bodC, 3.95, -6.3]));
  entrance(bod.door, { door: 0x39302a, trim: 0xffd23f, light: 0xfff0b0 });
  // fruit stand under the window, clear of the door
  group.add(box(1.0, 0.5, 0.9, M.wood, [bod.x0 + 0.9, 0.26, -5.3]));
  group.add(box(0.5, 0.2, 0.4, retroMaterial('plantain', { color: 0x4a6a2a }), [bod.x0 + 0.9, 0.6, -5.3]));
  group.add(box(1.0, 0.5, 0.9, M.wood, [bod.x0 + 2.0, 0.26, -5.3]));
  group.add(box(0.5, 0.2, 0.4, retroMaterial('orange', { color: 0xc9822a }), [bod.x0 + 2.0, 0.6, -5.3]));

  // ---- Habib's halal corner, east end: green sign, hot-case glow, a bench outside
  const hab = building('habibs');
  const habC = (hab.x0 + hab.x1) / 2;
  group.add(box(hab.x1 - hab.x0 - 0.2, 3.0, 0.3, retroMaterial('habfront', { color: 0x7a2a2a }), [habC, 1.5, -6.5]));
  group.add(plane(2.2, 1.4, { name: 'habwin', map: tex('window'), emissive: 0.55, unlit: true }, [habC + 1.0, 1.6, -6.32]));
  group.add(box(hab.x1 - hab.x0, 0.16, 1.1, retroMaterial('habawning', { color: 0x25482f }), [habC, 3.0, -5.95]));
  group.add(plane(4.0, 0.7, { name: 'habsign2', map: signTex('signHabib', [{ text: "HABIB'S CORNER", color: '#f4f0d0', size: 14 }, { text: 'HALAL · CHICKEN OVER RICE · FALAFEL', color: '#9fe3b0', size: 6 }], { w: 160, h: 30, bg: '#1f4a30', border: '#d8c07a' }), emissive: 0.95, unlit: true }, [habC, 3.55, -6.3]));
  entrance(hab.door, { door: 0x2e2a24, trim: 0xd8c07a, light: 0xffe6b0 });
  group.add(box(1.7, 0.08, 0.45, M.wood, [18.0, 0.5, 0.1]));
  group.add(box(1.7, 0.45, 0.08, M.wood, [18.0, 0.72, -0.15]));
  group.add(box(0.07, 0.5, 0.45, M.metal, [17.2, 0.25, 0.1]));
  group.add(box(0.07, 0.5, 0.45, M.metal, [18.8, 0.25, 0.1]));

  // ---- street life: cardboard, a shopping cart, a sleeping bag that is somebady's home
  group.add(box(1.3, 0.04, 0.9, retroMaterial('cardboard', { color: 0x8a7452 }), [-9.4, 0.02, 0.2]));
  group.add(box(0.8, 0.9, 0.6, retroMaterial('cart', { color: 0x6a6a62 }), [-12.6, 0.45, -5.0]));
  group.add(box(0.86, 0.06, 0.66, M.metal, [-12.6, 0.9, -5.0]));
  group.add(box(1.0, 0.18, 0.7, retroMaterial('sleepingbag', { color: 0x394a5c }), [-9.6, 0.09, 0.4]));

  // ================= CITY PASS =================
  // Behind the shopfront row: a skyline, so the street reads as one block of a city rather
  // than a corridor with wallpaper. Fog does the rest of the depth work for free.
  const skyline = [[-19.5, 13, 9], [-13, 17, 7.5], [-6.5, 11.5, 10], [0.5, 15, 8], [7.5, 12, 9], [14, 17.5, 7], [21, 12.5, 10], [27.5, 15.5, 8]];
  for (const [sx, sh, sw] of skyline) {
    const sz = -12.5 - (sw % 3);
    group.add(box(sw, sh, 6, retroMaterial(`sky${sx}`, { color: 0x171e24 }), [sx, sh / 2, sz]));
    for (let r = 0; r < Math.floor(sh / 2.2); r++) {
      for (let c = 0; c < 3; c++) {
        if (!chance(0.24)) continue;
        group.add(plane(0.46, 0.66, { name: 'skywin', color: 0x9a9c74, emissive: 0.42, unlit: true },
          [sx - 1.3 + c * 1.3, 2.2 + r * 2.2, sz + 3.03]));
      }
    }
  }

  // fire escapes: the reason every building in this city looks tired
  const fireEscape = (fx, y0, floors) => {
    for (let f = 0; f < floors; f++) {
      const y = y0 + f * 1.62;
      group.add(box(2.1, 0.06, 0.72, M.metal, [fx, y, -6.2]));
      group.add(box(2.1, 0.42, 0.05, retroMaterial('rail', { color: 0x3a3f42 }), [fx, y + 0.26, -5.88]));
      group.add(box(0.5, 1.62, 0.05, retroMaterial('rail2', { color: 0x363b3e }), [fx + (f % 2 ? 0.62 : -0.62), y + 0.81, -6.05], [0, 0, f % 2 ? 0.5 : -0.5]));
    }
  };
  fireEscape(-11.9, 2.9, 3);
  fireEscape(1.5, 2.4, 2);
  fireEscape(11.5, 3.2, 3);

  // rooftop machinery: a water tower, a few AC boxes, an aerial forest
  group.add(box(2.0, 1.9, 2.0, retroMaterial('tank', { color: 0x4a3f33 }), [-12.8, 8.6, -7.4]));
  group.add(box(2.3, 0.18, 2.3, retroMaterial('tankcap', { color: 0x39302a }), [-12.8, 9.6, -7.4]));
  for (const [ax, ay] of [[-8.6, 7.9], [-1.2, 6.5], [11.0, 8.8], [13.4, 8.8], [19.0, 7.1]]) {
    group.add(box(0.9, 0.55, 0.7, retroMaterial('ac', { color: 0x9aa0a0 }), [ax, ay, -7.0]));
  }
  for (const [mx, mh] of [[-14.6, 9.2], [4.2, 7.6], [17.8, 8.4]]) {
    group.add(box(0.04, mh, 0.04, retroMaterial('aerial', { color: 0x5a6064 }), [mx, mh / 2, -7.2]));
    for (let a = 0; a < 3; a++) group.add(box(mh * 0.5, 0.03, 0.03, retroMaterial('aerial2', { color: 0x5a6064 }), [mx, mh * 0.55 + a * 0.35, -7.2], [0, 0, 0]));
  }

  // vertical neon blades: the street's colour comes from its signage, not its sun
  const blade = (bx, by, bh, tint) => {
    group.add(box(0.72, bh, 0.08, retroMaterial(`bladebox${bx}`, { color: 0x1b1f22 }), [bx, by, -6.5]));
    group.add(plane(0.56, bh - 0.24, { name: `blade${bx}`, color: tint, emissive: 1.15, unlit: true }, [bx, by, -6.44]));
    group.add(plane(1.5, bh * 0.9, { name: `halo${bx}`, color: tint, opacity: 0.09, transparent: true, unlit: true }, [bx, by, -6.4]));
  };
  blade(-8.4, 4.4, 2.8, 0xff8a6a);
  blade(4.6, 4.2, 2.4, 0x8fd8a0);
  blade(13.2, 4.6, 3.0, 0xffc46a);
  blade(-1.6, 3.6, 1.8, 0x9fd8ff);

  // marquee bulbs over the store door
  for (let i = 0; i < 12; i++) {
    group.add(box(0.1, 0.1, 0.1, M.lamp, [1.5 - 2.4 + i * 0.44, 2.86, -5.72]));
  }

  // crosswalk + traffic light
  for (let i = 0; i < 7; i++) {
    group.add(box(0.52, 0.02, 6.4, retroMaterial('zebra', { color: 0xa8a492 }), [6.2 + i * 1.05, 0.02, 4.6]));
  }
  group.add(box(0.16, 3.2, 0.16, M.metal, [4.2, 1.6, 1.1]));
  group.add(box(0.32, 0.86, 0.3, retroMaterial('tlight', { color: 0x20262a }), [4.2, 3.1, 1.1]));
  group.add(box(0.13, 0.13, 0.03, retroMaterial('tred', { color: 0xff5a4a, emissive: 1, unlit: true }), [4.2, 3.36, 0.93]));
  group.add(box(0.13, 0.13, 0.03, retroMaterial('tgrn', { color: 0x2a3a2a }), [4.2, 3.02, 0.93]));

  // parked cars: the first thing that makes a street look inhabited
  const car = (cx, cz, tint, nose) => {
    const bodyMat = retroMaterial(`carbody${tint}`, { color: tint });
    group.add(box(3.7, 0.64, 1.72, bodyMat, [cx, 0.52, cz]));
    group.add(box(2.0, 0.5, 1.5, retroMaterial(`carcab${tint}`, { color: 0x232a30 }), [cx - nose * 0.25, 1.05, cz]));
    group.add(box(1.78, 0.3, 1.54, { name: 'carglass', color: 0x6f8a96, opacity: 0.5, transparent: true, unlit: true }, [cx - nose * 0.25, 1.09, cz]));
    for (const dx of [-1.28, 1.24]) {
      for (const dz of [-0.84, 0.84]) group.add(box(0.28, 0.54, 0.54, M.dark, [cx + dx, 0.3, cz + dz]));
    }
    group.add(box(0.08, 0.15, 0.42, M.lamp, [cx + nose * 1.84, 0.6, cz - 0.52]));
    group.add(box(0.08, 0.15, 0.42, M.lamp, [cx + nose * 1.84, 0.6, cz + 0.52]));
    group.add(box(0.08, 0.13, 0.4, retroMaterial(`cartail${tint}`, { color: 0x8a2a22, emissive: 0.5, unlit: true }), [cx - nose * 1.84, 0.62, cz - 0.52]));
    group.add(box(0.08, 0.13, 0.4, retroMaterial(`cartail2${tint}`, { color: 0x8a2a22, emissive: 0.5, unlit: true }), [cx - nose * 1.84, 0.62, cz + 0.52]));
  };
  car(-7.2, 3.4, 0x5a6a78, 1);
  car(9.6, 3.6, 0x6a4a3a, -1);

  // street trees in planters, mailbox, news box, wall phone
  const tree = (tx, tz) => {
    group.add(box(0.92, 0.34, 0.92, M.concrete, [tx, 0.17, tz]));
    group.add(box(0.2, 1.9, 0.2, retroMaterial('trunk', { color: 0x463726 }), [tx, 1.2, tz]));
    for (let i = 0; i < 3; i++) {
      group.add(box(1.5 - i * 0.42, 0.86, 1.5 - i * 0.42, retroMaterial(`leaf${i}`, { color: i % 2 ? 0x3d5832 : 0x2d4629 }), [tx, 2.2 + i * 0.72, tz], [0, i * 0.55, 0]));
    }
  };
  tree(-6.2, -4.7); tree(8.8, -4.7); tree(17.6, -4.7);
  group.add(box(0.5, 0.9, 0.46, retroMaterial('mailbox', { color: 0x27466e }), [7.2, 0.45, -4.9]));
  group.add(box(0.44, 0.86, 0.4, retroMaterial('newsbox', { color: 0x8a3a32 }), [-6.6, 0.43, -4.9]));
  group.add(box(0.34, 0.62, 0.28, retroMaterial('payphone', { color: 0x282d31 }), [12.9, 1.0, -6.1]));

  // steam vent + the wet patch it makes, and a neon reflection on the walk
  group.add(box(0.92, 0.02, 0.92, retroMaterial('grate', { color: 0x272b2d }), [-2.4, 0.03, 0.6]));
  for (let i = 0; i < 3; i++) {
    group.add(plane(0.9 + i * 0.55, 1.0 + i * 0.5, { name: 'steam', color: 0xc2d2cc, opacity: 0.1 - i * 0.02, transparent: true, unlit: true },
      [-2.4, 0.7 + i * 0.62, 0.6], [0, 0.25, 0]));
  }
  group.add(plane(3.4, 1.7, { name: 'wetwalk', color: 0x2f4240, opacity: 0.32, transparent: true, unlit: true }, [1.4, 0.035, 0.1], [-Math.PI / 2, 0, 0]));
  group.add(plane(3.4, 1.7, { name: 'wetwalk2', color: 0x3a4a3a, opacity: 0.18, transparent: true, unlit: true }, [1.4, 0.04, 0.1], [-Math.PI / 2, 0, 0]));
  // trash bag pile by the cans
  for (let i = 0; i < 4; i++) {
    group.add(box(0.42 - i * 0.03, 0.34, 0.38, retroMaterial(`bagp${i}`, { color: 0x24261f }), [9.5 + (i % 2) * 0.45 - 0.2, 0.17 + (i > 1 ? 0.28 : 0), -4.85 + (i > 1 ? 0.1 : 0)]));
  }

  const npcs = [
    { kind: 'rae', x: -11.8, z: -3.6, rot: 0.4, talk: 'rae' },
    { kind: 'dale', x: 3.6, z: -4.4, rot: 2.5, talk: 'dale' },
    { kind: 'kev', x: -1.2, z: -1.2, rot: -1.2, talk: 'kev' },
    { kind: 'dex', x: -3.4, z: -3.4, rot: 1.4, talk: 'dex', live: true },
    { kind: 'homeless', x: -9.6, z: 0.4, rot: 1.2, talk: 'homeless', sit: true },
    { kind: 'junkie', x: -12.4, z: -4.2, rot: 2.2, talk: 'junkie' },
  ];

  const interactables = [
    { id: 'apartmentDoor', label: 'Enter 1120 Kestrel St.', sub: 'Unit 3B · upstairs, allegedly', x: apt.door, z: STREET.doorZ, radius: 1.6, action: (gg) => apartmentDoor(gg) },
    { id: 'store', label: 'Enter Quik-Stop #14', sub: 'clock in · buy snacks', x: 1.5, z: -5.6, action: (gg) => storeMenu(gg) },
    { id: 'alley', label: 'Step into the alley', sub: 'Dex is usually here', x: -3.6, z: -2.4, action: (gg) => dexMenu(gg) },
    { id: 'church', label: 'Enter The Golden Fellowship', sub: 'Sunday 11:00 · coffee', x: building('church').door, z: STREET.doorZ, radius: 1.7, action: (gg) => gg.goTo('church', 'street') },
    { id: 'bodega', label: 'Enter Kestrel Bodega', sub: 'Miguel · BEC · loosies', x: bod.door, z: STREET.doorZ, radius: 1.6, action: (gg) => gg.goTo('bodega', 'street') },
    { id: 'habibs', label: "Enter Habib's Corner", sub: 'halal · chicken over rice', x: hab.door, z: STREET.doorZ, radius: 1.6, action: (gg) => gg.goTo('habibs', 'street') },
    { id: 'homelessMan', label: 'Talk to the man on the cardboard', sub: 'he is awake', x: -9.6, z: 0.4, action: (gg) => talk(gg, 'homeless') },
    { id: 'board', label: 'Read the job board', sub: 'odd jobs · cash today', x: 5.0, z: -5.4, action: (gg) => oddJobMenu(gg) },
    { id: 'dumpster', label: 'Look in the dumpster', sub: 'no judgement (some judgement)', x: -4.2, z: -4.4, action: (gg) => dumpster(gg) },
    { id: 'bench', label: 'The bench', sub: 'sit · or sleep, if it comes to that', x: -7.5, z: 0.4, action: (gg) => benchMenu(gg) },
    { id: 'busstop', label: 'Wait at the bus stop', sub: 'nothing will happen', x: 6.6, z: -4.8, action: (gg) => { gg.advance(20); gg.toast('The bus is late. You watch three people decide not to wait.', 'info'); } },
    { id: 'rae', label: 'Talk to Rae', sub: 'landlord · human', x: -11.8, z: -3.6, action: (gg) => talk(gg, 'rae') },
    { id: 'dale', label: 'Talk to Dale', sub: 'boss · tired', x: 3.6, z: -4.4, action: (gg) => talk(gg, 'dale') },
    { id: 'kev', label: 'Talk to Kev', sub: 'coworker · loud', x: -1.2, z: -1.2, action: (gg) => talk(gg, 'kev') },
    { id: 'dex', label: 'Talk to Dex', sub: 'the corner · cash only', x: -3.4, z: -3.4, action: (gg) => dexMenu(gg) },
  ];

  return {
    group,
    bounds: { ...STREET.bounds },
    solids: [
      solid(-4.2, -5.2, 1.5, 1.0, 1.0), solid(-7.5, 0.2, 2.0, 0.7, 0.9), solid(6.5, -5.8, 2.3, 0.4),
      solid(9.5, -5.6, 0.7, 0.7, 0.9), solid(-13.5, -5.7, 0.7, 0.7, 0.9), solid(5.0, -6.2, 1.1, 0.4), solid(-12.6, -5.0, 0.8, 0.6, 0.95),
      solid(-5.0, 0.9, 0.5, 0.5, 0.65),
      solid(-6.2, -4.7, 0.9, 0.9), solid(8.8, -4.7, 0.9, 0.9), solid(17.6, -4.7, 0.9, 0.9),
      solid(7.2, -4.9, 0.5, 0.5, 0.9), solid(-6.6, -4.9, 0.5, 0.5, 0.9), solid(4.2, 1.1, 0.3, 0.3),
    ],
    spawn: streetSpawn('apartment'),
    // out of whichever door he came through, a step clear of its prompt
    spawnFor: (from) => streetSpawn(from),
    npcs,
    interactables,
    ambient: 'street',
  };
}

function storeMenu(g) {
  g.soundtrack?.cue?.('quikstop', 25);
  const s = g.state;
  const info = shiftInfo(g);
  const mod = minuteOfDay(s.clock.m);
  const choices = [];
  if (s.job.employed) {
    choices.push({
      label: info.canClockIn ? `Clock in and work (${Math.round(info.minutesLeft / 60 * 10) / 10}h).` : 'Clock in — not available right now.',
      sub: info.canClockIn ? `+${money((info.minutesLeft / 60) * s.job.wage - CONFIG.job.transportCost)}` : (info.worked ? 'shift already worked today' : info.today ? 'shift window closed' : 'not a shift day'),
      disabled: !info.canClockIn,
      effect: () => workShift(g),
    });
    choices.push({ label: 'Call out of your shift.', sub: '+1 strike · no pay', disabled: !info.today || info.worked, effect: () => callOut(g) });
    choices.push({ label: 'Quit. Hand over the vest.', sub: 'no job, less stress', effect: () => { quitJob(g); } });
  } else {
    choices.push({ label: 'Ask Dale for your job back.', sub: '35 min', effect: () => applyForJob(g) });
  }
  choices.push({
    label: 'Buy something from the shelves.',
    sub: 'convenience-store prices',
    effect: () => {
      g.openModal({
        kicker: 'QUIK-STOP #14',
        title: 'Aisle Food, Loosely',
        body: 'Everything here costs more than the grocery store and less than a restaurant. That is the entire business model.',
        choices: [
          ...['ramen', 'bar', 'sandwich', 'cereal'].map((id) => ({
            label: `${CONFIG.items[id].name} — ${money(CONFIG.items[id].price * 1.35)}`,
            sub: `+${CONFIG.items[id].hunger} hunger`,
            effect: () => {
              const price = Math.round(CONFIG.items[id].price * 1.35 * 100) / 100;
              if (g.state.money < price) { g.toast('Not enough money.', 'bad'); return; }
              g.spendMoney(price, 'Quik-Stop');
              addItem(g.state, id, 1);
              g.audio.sfx('cash');
              g.toast(`Bought ${CONFIG.items[id].name}.`, 'good');
            },
          })),
          { label: 'Leave the aisle.', sub: '', effect: () => {} },
        ],
      });
    },
  });
  choices.push({ label: 'Step back outside.', sub: '', effect: () => {} });
  g.openModal({
    kicker: 'QUIK-STOP #14',
    title: `It is ${String(Math.floor(mod / 60)).padStart(2, '0')}:${String(mod % 60).padStart(2, '0')}`,
    body: `Fluorescent light, a smell like cold hot dogs, and the specific dignity of the night shift.\n\n${s.job.employed ? `Shift: 09:00–17:00 · ${money(s.job.wage)}/hr · strikes ${s.job.strikes}/${CONFIG.job.maxStrikes}` : 'Dale is at the counter. He has already seen you.'}`,
    choices,
  });
}

function oddJobMenu(g) {
  const jobs = oddJobsAvailable(g);
  g.openModal({
    kicker: 'JOB BOARD — CASH TODAY',
    title: 'Odd Jobs',
    body: 'Hand-written cards, pinned with a thumbtack through somebody else\'s card. Cash at the end. No forms.',
    choices: [
      ...jobs.map((j) => ({
        label: `${j.name} — ${money(j.pay)}`,
        sub: `${j.hours}h · ${j.blurb} · needs ${j.minEnergy} energy`,
        disabled: g.state.stats.energy < j.minEnergy,
        effect: () => doOddJob(g, j.id),
      })),
      { label: 'Stop reading the board.', sub: '', effect: () => {} },
    ],
  });
}

function dexMenu(g) {
  const s = g.state;
  const mod = minuteOfDay(s.clock.m);
  if (mod < 18 * 60 && mod > 4 * 60) {
    g.toast('The alley is empty. Dex works nights. Obviously.', 'info');
    return;
  }
  const types = CONFIG.substances.types;
  g.openModal({
    kicker: 'DEX — THE ALLEY',
    title: 'Cash Only',
    body: `"Evening."\n\nHe does not look up. He is doing something with a bag that is not your business.\n\n${CONFIG.substances.note}\n\nAll of it raises risk. Risk at 100 ends the run.`,
    choices: [
      ...['bliss', 'static', 'mud', 'drip'].map((id) => ({
        label: `Buy ${types[id].name} — ${money(types[id].price)}`,
        sub: `risk +${types[id].risk} · addiction +${types[id].addiction}`,
        disabled: s.money < types[id].price,
        effect: () => {
          if (s.money < types[id].price) return;
          g.spendMoney(types[id].price, `Dex — ${types[id].name}`);
          addItem(s, id, 1);
          g.toast(`${types[id].name}. It goes in the drawer with the others.`, 'event');
          g.audio.sfx('cash');
        },
      })),
      {
        label: 'Sell him something instead.',
        sub: 'he pays 42% of value',
        effect: () => {
          const valuables = inventoryList(s).filter((i) => i.def.kind === 'valuable');
          if (!valuables.length) { g.toast('You have nothing left he wants.', 'bad'); return; }
          g.openModal({
            kicker: 'DEX',
            title: 'What Have You Got',
            body: 'He turns each object over once, like he is reading a page.',
            choices: [
              ...valuables.map((v) => ({ label: `${v.def.name} (x${v.qty}) — ${money(Math.round(v.def.value * 0.42))}`, sub: `BidBay might get ${money(v.def.value)}`, effect: () => sellToDex(g, v.id) })),
              { label: 'Never mind.', sub: '', effect: () => {} },
            ],
          });
        },
      },
      { label: 'Leave the alley.', sub: '', effect: () => {} },
    ],
  });
}

function dumpster(g) {
  const s = g.state;
  g.advance(15);
  bump(s, 'hygiene', -9);
  bump(s, 'stress', 4);
  const roll = Math.random();
  if (roll < 0.34) {
    const id = pick(['beans', 'ramen', 'cereal', 'bar']);
    addItem(s, id, 1);
    g.toast(`You find a sealed ${CONFIG.items[id].name}. It is fine. It is probably fine.`, 'good');
  } else if (roll < 0.55) {
    const amount = randInt(2, 9);
    g.earnMoney(amount, 'Dumpster deposit');
    g.toast(`Bottles. ${money(amount)} in deposit returns.`, 'good');
  } else if (roll < 0.7) {
    if (!s.flags.foundTools) {
      addItem(s, 'tools', 1);
      s.flags.foundTools = true;
      g.toast('A toolbox, fully stocked. Someone moved out in a hurry.', 'good');
    } else {
      g.toast('A chair with one leg. You consider it. You decline.', 'info');
    }
  } else {
    g.toast('A bag of something wet. You decide not to investigate further.', 'bad');
    bump(s, 'morale', -3);
  }
}

/** 1120's door: home, or a new lock and a note from Rae. */
function apartmentDoor(g) {
  const s = g.state;
  if (life.isHoused?.(s) !== false) { g.goTo('apartment', 'street'); return; }
  const cost = life.rehouseCost(s);
  g.openModal({
    kicker: '1120 KESTREL ST. · UNIT 3B',
    title: 'The Lock Is Still New',
    body: `Rae's note is still taped to the door, a little curled now.\n\nGetting back in: ${money(cost)} — what you owed, plus a deposit. You have ${money(s.money)}.`,
    choices: [
      { label: `Call Rae and pay ${money(cost)}.`, sub: 'arrears + deposit · the key back', disabled: s.money < cost, effect: () => { if (life.rehouse(g)) g.goTo('apartment', 'street'); } },
      { label: 'Step back onto the walk.', sub: '', effect: () => {} },
    ],
  });
}

/** The bench: a sit, or a night if there is nowhere else. */
function benchMenu(g) {
  const s = g.state;
  const mod = minuteOfDay(s.clock.m);
  const late = mod >= 21 * 60 || mod < 5 * 60;
  g.openModal({
    kicker: 'KESTREL ST. · THE BENCH',
    title: 'Slats, Mostly',
    body: life.isHoused?.(s) === false ? 'It is not a bed. It is the bed you have.' : 'You have a bed. This is a bench. Still.',
    choices: [
      { label: 'Sit for a while.', sub: '45 min · +energy · -stress', effect: () => bench(g) },
      { label: 'Sleep here.', sub: late ? '6 hours · rough · watch your pockets' : 'better after dark', disabled: !late, effect: () => life.roughSleep(g, 'bench', 6) },
      { label: 'Get up.', sub: '', effect: () => {} },
    ],
  });
}

/** A Fellowship cot: the warmest bed on the block and the most expensive gift. */
function cotMenu(g) {
  const s = g.state;
  const mod = minuteOfDay(s.clock.m);
  const late = mod >= 20 * 60 || mod < 6 * 60;
  const welcome = s.fellowship.stage >= 1 || s.fellowship.pledged;
  g.openModal({
    kicker: 'THE GOLDEN FELLOWSHIP',
    title: 'The Back Room',
    body: welcome
      ? 'Six cots under a painting of Addison looking at something just past you. A volunteer writes your name on a list that already had your name on it.'
      : '"Cots are for members of the Fellowship," the volunteer says, kindly, sliding a brochure across the table.',
    choices: [
      { label: 'Take a cot for the night.', sub: '7 hours · +$12 to your tithe', disabled: !welcome || !late, effect: () => life.roughSleep(g, 'cot', 7) },
      { label: 'Not tonight.', sub: '', effect: () => {} },
    ],
  });
}

/** Habib's counter: the menu board, unless he has decided you are eating for free today. */
function habibCounter(g) {
  const s = g.state;
  if (s.flags.habibMeal) {
    s.flags.habibMeal = false;
    life.trust(s, 'habib', 1);
    addItem(s, 'chicken_rice', 1);
    g.toast('Habib puts a chicken over rice in your hands and refuses your money with his whole face.', 'good');
    return;
  }
  if (life.trust(s, 'habib') >= 2 && s.stats.hygiene < 40) {
    g.openModal({
      kicker: "HABIB'S CORNER",
      title: 'He Looks At You Properly',
      body: '"The sink in the back works. There is a towel. Go. Then we talk about food."',
      choices: [
        { label: 'Wash up in the back.', sub: '20 min · +hygiene', effect: () => life.washUp(g, 'habibs') },
        { label: 'Just the menu, thanks.', sub: '', effect: () => openShop(g, 'habibs') },
      ],
    });
    return;
  }
  openShop(g, 'habibs');
}

/** Miguel's counter: the board, or the BEC he promised you. */
function miguelCounter(g) {
  const s = g.state;
  if (s.flags.miguelBec) {
    s.flags.miguelBec = false;
    life.trust(s, 'miguel', 1);
    addItem(s, 'bec', 1);
    g.toast('"On the house. This one time. Don\'t tell nobody." Miguel wraps it like it matters.', 'good');
    return;
  }
  openShop(g, 'bodega');
}

function bench(g) {
  const s = g.state;
  g.advance(45);
  bump(s, 'energy', 5);
  bump(s, 'stress', -6);
  bump(s, 'hygiene', -3);
  g.toast('You sit. The city continues without asking you anything.', 'good');
  if (chance(0.4)) g.toast(pick(AMBIENT_LINES), 'info');
}

const NPC_VOICE = { rae: 1.2, dale: 0.82, dex: 0.72, kev: 1.3, nia: 1.36, addison: 0.9, chairman: 1.7 };

/** Every spoken line comes out as wordless mumble — the words live in the text. */
function speak(g, id, words = 10) {
  g.audio?.mumble?.('word '.repeat(Math.max(3, words)), { pitch: NPC_VOICE[id] ?? 1 });
}

function talk(g, id) {
  const s = g.state;
  speak(g, id, 8);
  g.advance(10);
  bump(s, 'morale', 3);
  // Showing up and talking builds trust, once a day per person: you cannot fix a week of
  // letting Dale down in one afternoon of small talk, but you can by showing up every day.
  s.talkedDay = s.talkedDay || {};
  const today = dayOf(s.clock.m);
  if (s.talkedDay[id] !== today) {
    s.talkedDay[id] = today;
    // high or filthy, the conversation does not land the way you think it does
    const good = s.high.level < 25 && s.stats.hygiene > 25;
    life.trust(s, id, good ? 1 : 0);
  }
  if (id === 'rae') {
    const info = billInfo(g, 'rent');
    const rentLine = info.owedCycles > 0
      ? '"Rent\'s ' + money(info.owed) + '. You\'re ' + info.owedCycles + ' cycle behind. I\'ve been patient. I\'m running out of patient."'
      : '"Rent\'s ' + money(info.base) + ', due Day ' + info.nextDueDay + '. I\'m not chasing you. I\'m just telling you where Friday is."';
    g.openModal({
      kicker: 'RAE VELL — LANDLORD',
      title: 'The Stairwell Conversation',
      body: npcLine('rae') + '\n\n' + rentLine + '\n\nHe is holding a clipboard with your name on it. Just your name. Nothing else.',
      choices: [
        { label: 'Pay what you owe.', sub: `${money(info.owed)}`, disabled: info.owedCycles <= 0 || s.money < info.owed, effect: () => { g.payBill('rent'); } },
        { label: 'Promise him Friday.', sub: '+stress, +relationship', effect: () => { bump(s, 'stress', 5); s.npc.rae++; g.toast('He writes something on the clipboard. It is not "no".', 'info'); } },
        { label: 'Say nothing and go upstairs.', sub: '-morale', effect: () => { bump(s, 'morale', -5); s.npc.rae = Math.max(-5, s.npc.rae - 1); } },
      ],
    });
  } else if (id === 'dale') {
    g.openModal({
      kicker: 'DALE — QUIK-STOP #14',
      title: 'Counter Talk',
      body: `${npcLine('dale')}\n\nHe has a coffee cup with a bite mark on the rim. It is not his bite mark. Nobody mentions it.`,
      choices: [
        { label: 'Ask about extra hours.', sub: 'possible overtime', effect: () => { g.advance(15); if (shiftInfo(g).today) g.toast('"Come in early. I\'ll find something."', 'good'); else g.toast('"Nothing right now. Check the board."', 'info'); } },
        { label: 'Nod and leave.', sub: '', effect: () => {} },
      ],
    });
  } else if (id === 'kev') {
    g.openModal({
      kicker: 'KEV',
      title: 'Kev Has A Theory',
      body: `${npcLine('kev')}\n\nHe is eating a sandwich he did not pay for and will not acknowledge.`,
      choices: [
        { label: 'Listen to the whole theory.', sub: '-15 min · +morale', effect: () => { g.advance(15); bump(s, 'morale', 7); g.toast('The theory is about the store freezer and the government. It has structure.', 'good'); } },
        { label: 'Say you have to go.', sub: '', effect: () => { bump(s, 'morale', -1); } },
      ],
    });
  }
}

/* ------------------------------ CHURCH ------------------------------ */

export function buildChurch(g) {
  const group = new THREE.Group();
  const W = 11, D = 15;
  group.add(plane(W, D, { name: 'chfloor', map: tex('carpet'), repeat: [4, 5] }, [0, 0, 0], [-Math.PI / 2, 0, 0]));
  group.add(box(W, 5, 0.2, { name: 'chwall', map: tex('brick') }, [0, 2.5, -D / 2]));
  group.add(box(W, 5, 0.2, { name: 'chwall2', map: tex('brick') }, [0, 2.5, D / 2]));
  group.add(box(0.2, 5, D, { name: 'chwall3', map: tex('brick') }, [-W / 2, 2.5, 0]));
  group.add(box(0.2, 5, D, { name: 'chwall4', map: tex('brick') }, [W / 2, 2.5, 0]));
  // ceiling beams
  for (let i = -3; i <= 3; i++) group.add(box(W, 0.2, 0.3, M.wood, [0, 4.6, i * 2]));
  group.add(plane(W, D, { name: 'chceil', color: 0x2a2620 }, [0, 4.7, 0], [Math.PI / 2, 0, 0]));

  // altar
  group.add(box(4.0, 0.9, 1.0, retroMaterial('altar', { color: 0xd8cba8 }), [0, 0.45, -6.0]));
  group.add(box(4.2, 0.1, 1.1, M.goldDoor, [0, 0.95, -6.0]));
  group.add(box(1.6, 2.2, 0.1, { name: 'backdrop', map: tex('cross'), emissive: 0.4, unlit: true }, [0, 2.4, -6.9]));

  // pews
  for (let r = 0; r < 5; r++) {
    for (const side of [-1, 1]) {
      const x = side * 2.6;
      const z = -2.4 + r * 1.8;
      group.add(box(2.0, 0.12, 0.5, M.wood, [x, 0.46, z]));
      group.add(box(2.0, 0.55, 0.1, M.wood, [x, 0.72, z + 0.2]));
    }
  }

  // candles
  for (let i = -4; i <= 4; i++) {
    if (i === 0) continue;
    group.add(box(0.12, 0.5, 0.12, M.candle, [i * 0.75, 0.25, -5.4]));
    group.add(box(0.2, 0.04, 0.2, M.goldDoor, [i * 0.75, 0.02, -5.4]));
  }
  // donation box
  group.add(box(0.7, 0.9, 0.5, M.goldDoor, [-2.6, 0.45, -5.0]));
  group.add(box(0.3, 0.06, 0.1, retroMaterial('slot', { color: 0x2a2118 }), [-2.6, 0.9, -5.0]));
  // exit
  group.add(box(1.6, 2.6, 0.16, M.door, [0, 1.3, D / 2 - 0.1]));
  group.add(box(0.1, 0.1, 0.06, M.goldDoor, [0.6, 1.2, D / 2 - 0.2]));
  // windows
  for (const side of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      group.add(plane(0.9, 2.0, { name: 'chwin', map: tex('window'), emissive: 0.35, unlit: true }, [side * (W / 2 - 0.11), 2.6, -3.5 + i * 3], [0, side * Math.PI / 2, 0]));
    }
  }

  // two side doors near the entrance: the back room with the cots, and the restroom
  for (const [sx, text] of [[1, 'BACK ROOM'], [-1, 'RESTROOM']]) {
    group.add(box(0.12, 2.2, 1.0, M.door, [sx * 5.36, 1.1, 3.0]));
    group.add(box(0.14, 0.12, 1.2, M.goldDoor, [sx * 5.34, 2.26, 3.0]));
    group.add(plane(1.0, 0.28, { name: `chdoor${sx}`, map: signTex(`signChurch${sx}`, [{ text, color: '#ffe08a', size: 9, font: 'Georgia, serif' }], { w: 64, h: 18, bg: '#2a2014' }), emissive: 0.8, unlit: true }, [sx * 5.28, 2.6, 3.0], [0, -sx * Math.PI / 2, 0]));
  }

  const interactables = [
    { id: 'addison', label: 'Speak with Addison Octavius', sub: 'he is expecting you', x: 0, z: -4.6, action: (gg) => visitFellowship(gg) },
    { id: 'donate', label: 'Put money in the donation box', sub: '$10 · +morale, +favour', x: -2.6, z: -4.4, action: (gg) => { if (gg.state.money < 10) { gg.toast('You cannot donate what you do not have. He would understand.', 'bad'); return; } gg.spendMoney(10, 'Fellowship donation'); bump(gg.state, 'morale', 4); gg.state.npc.addison++; gg.toast('The box makes a sound like a swallow.', 'event'); } },
    { id: 'candle', label: 'Light a candle', sub: '10 min · +morale', x: 1.5, z: -5.0, action: (gg) => { gg.advance(10); bump(gg.state, 'morale', 4); bump(gg.state, 'stress', -5); gg.toast('You light one. You do not know who it is for. That is fine.', 'good'); } },
    { id: 'cot', label: 'Ask about a cot', sub: 'a night here · it is never free', x: 4.4, z: 3.0, action: (gg) => cotMenu(gg) },
    { id: 'restroom', label: 'Wash up in the restroom', sub: '20 min · +hygiene', x: -4.4, z: 3.0, action: (gg) => life.washUp?.(gg, 'church') },
    { id: 'exit', label: 'Leave the Fellowship', sub: 'back to the street', x: 0, z: 7.1, action: (gg) => gg.goTo('street', 'church') },
  ];

  const npcs = [
    { kind: 'addison', x: 0, z: -3.6, rot: 0, special: true },
    { kind: 'rae', x: -2.6, z: 2.4, rot: 0.4, talk: 'rae' },
  ];

  return {
    group,
    bounds: { minX: -5, maxX: 5, minZ: -6.6, maxZ: 7.2 },
    solids: [
      solid(-2.6, -2.4, 2.2, 0.7, 1.0), solid(2.6, -2.4, 2.2, 0.7, 1.0), solid(-2.6, 1.2, 2.2, 0.7, 1.0),
      solid(2.6, 1.2, 2.2, 0.7, 1.0), solid(0, -6.0, 4.2, 1.2, 1.2), solid(-2.6, -5.0, 0.9, 0.7, 0.9),
    ],
    spawn: { x: 0, z: 3.9, rot: Math.PI },
    npcs,
    interactables,
    ambient: 'church',
  };
}

/* ------------------------------ MENU SCENE ------------------------------ */

export function buildMenuWorld() {
  const group = new THREE.Group();
  const D = 26;
  // corridor floor & walls, concrete, oppressive
  group.add(plane(6, D, { name: 'mfloor', map: tex('concrete'), repeat: [2, 8] }, [0, 0, -D / 2 + 4], [-Math.PI / 2, 0, 0]));
  group.add(plane(6, D, { name: 'mceil', map: tex('concrete'), repeat: [2, 8] }, [0, 3.2, -D / 2 + 4], [Math.PI / 2, 0, 0]));
  group.add(box(0.2, 3.2, D, { name: 'mwallL', map: tex('concrete') }, [-3, 1.6, -D / 2 + 4]));
  group.add(box(0.2, 3.2, D, { name: 'mwallR', map: tex('concrete') }, [3, 1.6, -D / 2 + 4]));
  group.add(box(6, 3.2, 0.2, { name: 'mback', map: tex('concrete') }, [0, 1.6, -D + 4]));

  // doorway frames receding into fog
  for (let i = 0; i < 5; i++) {
    const z = -2 - i * 4.4;
    group.add(box(0.3, 3.2, 0.5, { name: 'frame', color: 0x4a4f46 }, [-2.2, 1.6, z]));
    group.add(box(0.3, 3.2, 0.5, { name: 'frame2', color: 0x3e433c }, [2.2, 1.6, z]));
  }
  // flickering fluorescent tubes
  for (let i = 0; i < 4; i++) {
    group.add(box(1.4, 0.06, 0.24, { name: 'tube', color: 0xdfffe0, emissive: 1.0, unlit: true }, [0, 3.05, -1 - i * 5.2]));
  }
  // a small tv on a crate, playing static
  group.add(box(0.8, 0.6, 0.7, M.wood, [2.0, 0.3, 1.2]));
  group.add(box(0.7, 0.55, 0.6, retroMaterial('menucrt', { color: 0x2e2e2c }), [2.0, 0.85, 1.2]));
  group.add(plane(0.5, 0.4, { name: 'menutv', map: tex('static'), emissive: 0.8, unlit: true }, [2.0, 0.87, 0.88]));
  // water stain on the wall
  group.add(box(1.6, 0.9, 0.02, { name: 'mstain', color: 0x2a2a24, opacity: 0.7, transparent: true }, [1.8, 2.0, -0.8]));

  return {
    group,
    bounds: { minX: -2.6, maxX: 2.6, minZ: -6, maxZ: 2.4 },
    spawn: { x: 0, z: -0.4, rot: 0 },
    solids: [solid(2.0, 1.2, 0.9, 0.8)],
    npcs: [],
    interactables: [],
  };
}

/* ------------------------------ BODEGA ------------------------------ */

/** Miguel's: narrow, over-lit, a grill at the back and a cat asleep on the lottery machine. */
export function buildBodega(g) {
  const group = new THREE.Group();
  const W = 8, D = 8;
  group.add(plane(W, D, { name: 'bodfloor', map: tex('linoleum'), repeat: [4, 4] }, [0, 0, 0], [-Math.PI / 2, 0, 0]));
  group.add(box(W, 3.0, 0.16, { name: 'bodwall', map: tex('wallpaper') }, [0, 1.5, -D / 2]));
  group.add(box(W, 3.0, 0.16, { name: 'bodwall2', map: tex('wallpaper') }, [0, 1.5, D / 2]));
  group.add(box(0.16, 3.0, D, { name: 'bodwall3', map: tex('wallpaper') }, [-W / 2, 1.5, 0]));
  group.add(box(0.16, 3.0, D, { name: 'bodwall4', map: tex('wallpaper') }, [W / 2, 1.5, 0]));
  group.add(plane(W, D, { name: 'bodceil', map: tex('ceiling'), repeat: [2, 2] }, [0, 3.0, 0], [Math.PI / 2, 0, 0]));

  // shelves against the left wall, stocked with coloured boxes
  for (let s = 0; s < 4; s++) {
    group.add(box(0.5, 0.06, 5.4, M.metal, [-3.1, 0.5 + s * 0.55, -0.6]));
    for (let i = 0; i < 9; i++) {
      const c = [0xb5533f, 0xc9a24a, 0x4f7a58, 0x8a6a9a, 0xd0d0c0][i % 5];
      group.add(box(0.4, 0.3, 0.34, retroMaterial(`bodgood${s}${i}`, { color: c }), [-3.05, 0.68 + s * 0.55, -2.9 + i * 0.56]));
    }
  }
  // back cooler with a glow
  group.add(box(2.4, 2.2, 0.5, retroMaterial('cooler', { color: 0x2e3a3c }), [1.9, 1.1, -3.6]));
  group.add(plane(2.1, 1.8, { name: 'coolerglass', color: 0x9fd8ff, emissive: 0.35, unlit: true, opacity: 0.55, transparent: true }, [1.9, 1.15, -3.34]));

  // The counter runs along the right wall with Miguel behind it and the grill at his back, so
  // the customer side is the open floor by the door. (It used to sit across the front of the
  // room, and Mo arrived on the wrong side of it, boxed in between the counter and the grill.)
  group.add(box(0.9, 1.0, 3.0, M.wood, [2.5, 0.5, 0.2]));
  group.add(box(0.96, 0.06, 3.06, M.tile, [2.5, 1.03, 0.2]));
  group.add(box(0.8, 0.7, 1.2, retroMaterial('grill', { color: 0x3a3a36 }), [3.55, 0.35, -2.0]));
  group.add(box(0.7, 0.05, 1.0, retroMaterial('grilltop', { color: 0x1a1a18 }), [3.55, 0.72, -2.0]));
  group.add(box(0.5, 0.3, 0.4, retroMaterial('lottery', { color: 0x223a5a, emissive: 0.12 }), [2.5, 1.22, 1.3]));
  group.add(box(0.36, 0.22, 0.3, retroMaterial('register', { color: 0x2a2a28 }), [2.5, 1.17, -0.6]));
  // fluorescent strips
  for (const x of [-2, 2]) group.add(box(1.8, 0.06, 0.2, M.lamp, [x, 2.9, 0]));
  // the way out: a framed door in the front wall with a lit EXIT over it
  group.add(box(1.1, 2.3, 0.14, M.door, [0.6, 1.15, 3.9]));
  group.add(box(0.12, 2.4, 0.2, M.white, [0.0, 1.2, 3.86]));
  group.add(box(0.12, 2.4, 0.2, M.white, [1.2, 1.2, 3.86]));
  group.add(box(1.32, 0.12, 0.2, M.white, [0.6, 2.4, 3.86]));
  group.add(box(0.6, 0.2, 0.06, retroMaterial('exitsign', { color: 0xff3a2a, emissive: 1.2, unlit: true }), [0.6, 2.68, 3.84]));
  group.add(plane(1.6, 1.2, { name: 'bodexitpool', color: 0xfff0c0, opacity: 0.12, transparent: true, unlit: true }, [0.6, 0.02, 3.3], [-Math.PI / 2, 0, 0]));

  const interactables = [
    { id: 'bodcounter', label: 'Order from Miguel', sub: 'BEC · chopped cheese · loosies', x: 1.75, z: 0.2, action: (gg) => miguelCounter(gg) },
    { id: 'bodcooler', label: 'Open the cooler', sub: 'cold things', x: 1.9, z: -2.9, action: (gg) => openShop(gg, 'bodega') },
    { id: 'bodshelf', label: 'Browse the shelves', sub: 'shelf food', x: -2.5, z: -0.6, action: (gg) => openShop(gg, 'bodega') },
    { id: 'bodexit', label: 'Back out to Kestrel St.', sub: '', x: 0.6, z: 3.2, radius: 1.05, action: (gg) => gg.goTo('street', 'bodega') },
  ];

  return {
    group,
    bounds: { minX: -3.4, maxX: 3.4, minZ: -3.4, maxZ: 3.4 },
    solids: [
      solid(-3.1, -0.6, 0.7, 5.6), solid(1.9, -3.6, 2.6, 0.7),
      solid(2.5, 0.2, 1.0, 3.1, 1.25), solid(3.55, -2.0, 0.8, 1.3, 0.75),
    ],
    // just inside the door, facing the shop, a step outside the exit's prompt
    spawn: { x: 0.6, z: 1.6, rot: Math.PI },
    npcs: [
      { kind: 'miguel', x: 3.15, z: 0.2, rot: -Math.PI / 2, talk: 'miguel' },
      { kind: 'cat', x: -1.6, z: 1.2, rot: 0.4 },
    ],
    interactables,
    ambient: 'street',
  };
}

/* ------------------------------ HABIB'S ------------------------------ */

/** Halal corner store: cleaner, warmer light, a hot case and a man who insists you eat. */
export function buildHabibs(g) {
  const group = new THREE.Group();
  const W = 7.5, D = 7.5;
  group.add(plane(W, D, { name: 'habfloor', map: tex('tile'), repeat: [4, 4] }, [0, 0, 0], [-Math.PI / 2, 0, 0]));
  group.add(box(W, 2.9, 0.16, { name: 'habwall', color: 0xb9a888 }, [0, 1.45, -D / 2]));
  group.add(box(W, 2.9, 0.16, { name: 'habwall2', color: 0xb9a888 }, [0, 1.45, D / 2]));
  group.add(box(0.16, 2.9, D, { name: 'habwall3', color: 0xb9a888 }, [-W / 2, 1.45, 0]));
  group.add(box(0.16, 2.9, D, { name: 'habwall4', color: 0xb9a888 }, [W / 2, 1.45, 0]));
  group.add(plane(W, D, { name: 'habceil', map: tex('ceiling'), repeat: [2, 2] }, [0, 2.9, 0], [Math.PI / 2, 0, 0]));

  // hot case on a counter across the back half; Habib stands behind it, the door is in front
  group.add(box(3.4, 1.0, 0.9, retroMaterial('habcounter', { color: 0x6a5744 }), [-0.4, 0.5, -0.8]));
  group.add(box(3.4, 0.08, 0.94, M.tile, [-0.4, 1.04, -0.8]));
  group.add(box(1.6, 0.5, 0.7, retroMaterial('hotcase', { color: 0x8a8a80, emissive: 0.1 }), [-1.4, 1.3, -0.9]));
  for (let i = 0; i < 3; i++) {
    group.add(box(0.34, 0.16, 0.4, retroMaterial(`tray${i}`, { color: [0xc98a3a, 0xb5533f, 0xd8c07a][i] }), [-1.9 + i * 0.5, 1.6, -0.9]));
  }
  // display shelves, tidy rows
  for (let s = 0; s < 3; s++) {
    group.add(box(2.2, 0.06, 0.5, M.wood, [2.2, 0.7 + s * 0.6, -2.4]));
    for (let i = 0; i < 5; i++) {
      group.add(box(0.3, 0.22, 0.3, retroMaterial(`habgood${s}${i}`, { color: [0xc9a24a, 0x6a8a5a, 0xb58a5a][i % 3] }), [1.3 + i * 0.42, 0.84 + s * 0.6, -2.4]));
    }
  }
  // wall sign
  group.add(plane(2.0, 0.7, { name: 'habsign', color: 0x2a5a3a, emissive: 0.35, unlit: true }, [0, 2.2, -3.55]));
  group.add(plane(0.9, 1.2, { name: 'habposter', map: tex('poster') }, [-3.0, 1.6, -1.4], [0, Math.PI / 2, 0]));
  // warm lamps
  for (const x of [-1.6, 1.6]) group.add(box(0.9, 0.06, 0.18, M.lamp, [x, 2.8, 0.4]));
  // the door out, framed, with a lit EXIT
  group.add(box(1.1, 2.3, 0.14, M.door, [-1.2, 1.15, 3.66]));
  group.add(box(0.12, 2.4, 0.2, M.white, [-1.8, 1.2, 3.62]));
  group.add(box(0.12, 2.4, 0.2, M.white, [-0.6, 1.2, 3.62]));
  group.add(box(1.32, 0.12, 0.2, M.white, [-1.2, 2.4, 3.62]));
  group.add(box(0.6, 0.2, 0.06, retroMaterial('exitsign', { color: 0xff3a2a, emissive: 1.2, unlit: true }), [-1.2, 2.66, 3.6]));

  const interactables = [
    { id: 'habcounter', label: 'Order from Habib', sub: 'chicken over rice · falafel', x: -0.4, z: -0.05, action: (gg) => habibCounter(gg) },
    { id: 'habcase', label: 'Look in the hot case', sub: 'it is all still warm', x: -1.6, z: -0.05, action: (gg) => openShop(gg, 'habibs') },
    { id: 'habshelf', label: 'Browse the shelves', sub: 'no pork, never', x: 2.4, z: -1.6, action: (gg) => openShop(gg, 'habibs') },
    { id: 'habexit', label: 'Back out to Kestrel St.', sub: '', x: -1.2, z: 2.95, radius: 1.05, action: (gg) => gg.goTo('street', 'habibs') },
  ];

  return {
    group,
    bounds: { minX: -3.2, maxX: 3.2, minZ: -3.2, maxZ: 3.2 },
    solids: [
      solid(-0.4, -0.8, 3.6, 1.0, 1.55), solid(2.2, -2.4, 2.4, 0.7),
    ],
    spawn: { x: -1.2, z: 1.4, rot: Math.PI },
    npcs: [{ kind: 'habib', x: -0.4, z: -1.65, rot: 0, talk: 'habib' }],
    interactables,
    ambient: 'street',
  };
}

