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
import { openShop, shopPrice } from './shops.js';
import { showFridge } from '../ui/fridge.js';
import { STREET, BUILDINGS, building, streetSpawn } from './plan.js';
import { partnerTarget } from './schedules.js';
import { signTex } from '../render/signs.js';
import * as life from '../systems/life.js';
import * as romance from '../systems/romance.js';
import * as clinic from '../systems/clinic.js';

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

  // ---- someone lives here now. She is in the room, not in a menu.
  const liveIn = g.state.romance?.liveIn;
  const liveDef = liveIn && partnerTarget(liveIn, minuteOfDay(g.state.clock.m))?.away ? CONFIG.partners?.[liveIn] : null;
  if (liveIn && liveDef) {
    interactables.push({
      id: 'partner', label: `Talk to ${liveDef.name}`, sub: 'girlfriend · lives here', x: -1.9, z: 1.5,
      action: (gg) => partnerMenu(gg, liveIn),
    });
  }
  const gift = g.state.romance?.apartmentGift;
  if (gift) {
    const fromName = CONFIG.partners[gift.from]?.name;
    interactables.push({
      id: 'gift', label: `Open ${fromName ? `${fromName}'s` : 'the'} present`, sub: 'left on the counter', x: 1.9, z: 1.6,
      action: (gg) => openGiftMenu(gg),
    });
    // the parcel itself: brown paper and too much tape, on the counter
    group.add(box(0.34, 0.24, 0.28, retroMaterial('parcel', { color: 0xb08a5a }), [1.9, 0.95, 1.6]));
    group.add(box(0.35, 0.03, 0.1, retroMaterial('parcelribbon', { color: 0xd8d0b8 }), [1.9, 1.06, 1.6]));
  }

  const npcs = [];
  if (g.state.flags.cat) npcs.push({ kind: 'cat', x: 0.9, z: 1.9, rot: -0.6 });
  if (liveIn && liveDef) npcs.push({ kind: liveIn, x: -1.9, z: 1.5, rot: 0.9, talk: liveIn, roam: 1.1 });

  return {
    group,
    bounds: { minX: -3.2, maxX: 3.2, minZ: -4.1, maxZ: 4.0 },
    solids: [
      solid(-2.4, -2.4, 1.3, 2.1, 0.6), solid(2.7, -3.5, 0.9, 0.85, 1.8), solid(1.1, -3.6, 2.5, 0.8, 0.9),
      solid(-0.8, -3.6, 1.0, 0.8, 0.9), solid(1.4, -0.2, 1.2, 0.9, 0.9), solid(-2.6, 1.6, 0.9, 0.7, 1.15),
      solid(2.9, 2.6, 0.6, 0.6, 0.6), solid(-3.0, 2.4, 0.6, 0.5, 0.35),
    ],
    spawn: { x: 0, z: 1.15, rot: Math.PI },
    npcs,
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

  // ---- Kestrel Clinic, east end past Habib's: pale tile, a red cross, a ramp, no attitude
  const cli = building('clinic');
  const cliC = (cli.x0 + cli.x1) / 2;
  facade(cliC, 4.8, 6.2, 0xc2ccce);
  group.add(box(4.4, 3.0, 0.34, retroMaterial('clinicfront', { color: 0xd8e2e2 }), [cliC, 1.5, -6.48]));
  group.add(plane(2.8, 1.1, { name: 'clinicwin', map: tex('window'), emissive: 0.5, unlit: true }, [cliC + 0.9, 1.7, -6.3]));
  group.add(box(4.6, 0.14, 1.1, retroMaterial('clinicawn', { color: 0x9aa8aa }), [cliC, 3.1, -5.95]));
  group.add(plane(3.6, 0.6, { name: 'clinicsign', map: signTex('signClinic', [{ text: 'KESTREL CLINIC', color: '#f2fbff', size: 13 }, { text: 'WALK-INS · NO APPOINTMENT NEEDED', color: '#bfe6ff', size: 6 }], { w: 160, h: 30, bg: '#26424e', border: '#8fd0e0' }), emissive: 1.0, unlit: true }, [cliC, 3.6, -6.3]));
  group.add(box(0.5, 0.5, 0.06, retroMaterial('cliniccross', { color: 0xff4a4a, emissive: 0.9, unlit: true }), [cliC - 1.7, 2.3, -6.28]));
  group.add(box(0.14, 0.36, 0.07, retroMaterial('cliniccross2', { color: 0xffffff, emissive: 0.9, unlit: true }), [cliC - 1.7, 2.3, -6.26]));
  group.add(box(0.36, 0.14, 0.07, retroMaterial('cliniccross2', { color: 0xffffff, emissive: 0.9, unlit: true }), [cliC - 1.7, 2.3, -6.26]));
  entrance(cli.door, { door: 0x6a8a90, trim: 0xcfe0e0, light: 0xdff4ff });
  // the wheelchair ramp beside the step
  group.add(box(1.6, 0.08, 1.9, M.concrete, [cli.door + 1.5, 0.06, -5.2], [0.09, 0, 0]));
  group.add(plane(2.4, 1.8, { name: 'clinicpool', color: 0xdff4ff, opacity: 0.14, transparent: true, unlit: true }, [cli.door, 0.035, -5.1], [-Math.PI / 2, 0, 0]));

  // ---- the park gate: a gap in the kerb opposite the crosswalk, with a sign that says so
  group.add(box(3.2, 0.16, 0.5, M.concrete, [9.35, 0.08, 1.5]));
  for (const gx of [7.9, 10.8]) {
    group.add(box(0.16, 1.5, 0.16, M.metal, [gx, 0.75, 1.4]));
  }
  group.add(plane(2.6, 0.5, { name: 'parksign', map: signTex('signPark', [{ text: 'KESTREL PARK', color: '#e9f6d8', size: 13 }, { text: 'OPEN DAWN TO DUSK · NO BALLPLAY AFTER DARK', color: '#b8d8a0', size: 5 }], { w: 160, h: 30, bg: '#1e3a26', border: '#8fc07a' }), emissive: 0.9, unlit: true }, [9.35, 1.6, 1.35]));
  group.add(plane(3.4, 1.4, { name: 'parkglow', color: 0xbfe0b0, opacity: 0.12, transparent: true, unlit: true }, [9.35, 0.04, 1.0], [-Math.PI / 2, 0, 0]));

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
    { kind: 'homeless', x: -9.6, z: 0.4, rot: 1.2, talk: 'homeless' },
    { kind: 'junkie', x: -12.4, z: -4.2, rot: 2.2, talk: 'junkie' },
  ];

  const interactables = [
    { id: 'apartmentDoor', label: 'Enter 1120 Kestrel St.', sub: 'Unit 3B · upstairs, allegedly', x: apt.door, z: STREET.doorZ, radius: 1.6, action: (gg) => apartmentDoor(gg) },
    { id: 'store', label: 'Enter Quik-Stop #14', sub: 'open 24 hrs · shop · clock in at the back', x: 1.5, z: STREET.doorZ, radius: 1.6, action: (gg) => gg.goTo('quikstop', 'street') },
    { id: 'alley', label: 'Step into the alley', sub: 'Dex is usually here', x: -3.6, z: -2.4, action: (gg) => dexMenu(gg) },
    { id: 'church', label: 'Enter The Golden Fellowship', sub: 'Sunday 11:00 · coffee', x: building('church').door, z: STREET.doorZ, radius: 1.7, action: (gg) => gg.goTo('church', 'street') },
    { id: 'bodega', label: 'Enter Kestrel Bodega', sub: 'Miguel · BEC · loosies', x: bod.door, z: STREET.doorZ, radius: 1.6, action: (gg) => gg.goTo('bodega', 'street') },
    { id: 'habibs', label: "Enter Habib's Corner", sub: 'halal · chicken over rice', x: hab.door, z: STREET.doorZ, radius: 1.6, action: (gg) => gg.goTo('habibs', 'street') },
    { id: 'homelessMan', label: 'Talk to Gus', sub: 'the man on the cardboard', x: -9.6, z: 0.4, action: (gg) => talk(gg, 'homeless') },
    { id: 'board', label: 'Read the job board', sub: 'odd jobs · cash today', x: 5.0, z: -5.4, action: (gg) => oddJobMenu(gg) },
    { id: 'dumpster', label: 'Look in the dumpster', sub: 'no judgement (some judgement)', x: -4.2, z: -4.4, action: (gg) => dumpster(gg) },
    { id: 'bench', label: 'The bench', sub: 'sit · or sleep, if it comes to that', x: -7.5, z: 0.4, action: (gg) => benchMenu(gg) },
    { id: 'busstop', label: 'Wait at the bus stop', sub: 'nothing will happen', x: 6.6, z: -4.8, action: (gg) => { gg.advance(20); gg.toast('The bus is late. You watch three people decide not to wait.', 'info'); } },
    { id: 'rae', label: 'Talk to Rae', sub: 'landlord · human', x: -11.8, z: -3.6, action: (gg) => talk(gg, 'rae') },
    { id: 'dale', label: 'Talk to Dale', sub: 'boss · tired', x: 3.6, z: -4.4, action: (gg) => talk(gg, 'dale') },
    { id: 'kev', label: 'Talk to Kev', sub: 'coworker · loud', x: -1.2, z: -1.2, action: (gg) => talk(gg, 'kev') },
    { id: 'dex', label: 'Talk to Dex', sub: 'the corner · cash only', x: -3.4, z: -3.4, action: (gg) => dexMenu(gg) },
    { id: 'clinicDoor', label: 'Enter Kestrel Clinic', sub: 'walk-ins · the nurse is in', x: building('clinic').door, z: STREET.doorZ, radius: 1.6, action: (gg) => gg.goTo('clinic', 'street') },
    { id: 'parkGate', label: 'Cross to Kestrel Park', sub: 'benches · hoops · people', x: 9.35, z: 0.9, radius: 1.7, action: (gg) => gg.goTo('park', 'street') },
  ];

  return {
    group,
    bounds: { ...STREET.bounds },
    // Mo walks the sidewalk, but the camera may hang out over the road (and a little past the
    // block's ends): the curb is not a wall. Treating it as one collapsed the arm whenever he
    // stood near the street and set off the sideways swing.
    camBounds: { minX: STREET.bounds.minX - 2, maxX: STREET.bounds.maxX + 2, minZ: STREET.bounds.minZ, maxZ: STREET.roadZ[1] - 0.2 },
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

function storeMenu(g, { staff = false } = {}) {
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
  if (!staff) choices.push({
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
    body: `"Evening."\n\nHe does not look up. He is doing something with a bag that is not your business.\n\n"The phone guy sells the cut stuff. This is before it gets cut. Night only. You want safe, go to church."\n\n${CONFIG.substances.note}\n\nAll of it raises risk; the uncut raises it a lot, and sometimes the batch is wrong.`,
    choices: [
      ...['bliss_x', 'static_x', 'mud_x', 'drip_x', 'bliss', 'static', 'mud', 'drip'].map((id) => ({
        label: `Buy ${types[id].name} — ${money(types[id].price)}`,
        sub: `${types[id].dexOnly ? 'UNCUT · Dex only · ' : ''}risk +${types[id].risk} · addiction +${types[id].addiction}${types[id].badBatch ? ' · bad batches happen' : ''}`,
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
const GUS_STORIES = [
  'Gus tells you about the blackout of 1977, when the whole avenue went dark and Kestrel was the only block where nobody broke a window. "Nothing worth taking," he says. "Also, Miguel\'s father with a bat."',
  'Gus tells you the hydrant by 1120 has been painted gold four times. "The church does it. The city undoes it. Like a marriage."',
  'Gus tells you about calling a man out at second base in 1981. The man is a dentist now. Gus still gets a Christmas card. "He was out," Gus says. "He knows it."',
  'Gus tells you the Fellowship building was a movie theater. The last picture it showed was a kung fu movie. "Best night that place ever had."',
  'Gus tells you which window on the third floor of 1120 used to be his. He does not say why it is not anymore. You do not ask.',
];

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
  } else if (id === 'homeless') {
    // Gus: a dollar, a story, or leave him be. Asleep, he is asleep.
    const mod = minuteOfDay(s.clock.m);
    if (mod < 7 * 60 || mod >= 22 * 60) {
      g.openModal({
        kicker: 'GUS', title: 'Asleep',
        body: 'He is asleep on the cardboard with one arm over his face and the other around a bag he would fight you for. He says something without waking up. It sounds like "strike three."',
        choices: [{ label: 'Let him sleep.', effect: () => {} }],
      });
      return;
    }
    g.openModal({
      kicker: 'GUS · KESTREL ST.',
      title: 'Gus',
      body: `${npcLine('homeless')}

He knows every name on the block. He says yours like he has been waiting to.`,
      choices: [
        { label: 'Give him a dollar.', sub: '$1 · +morale', disabled: s.money < 1, effect: () => { g.spendMoney(1, 'Gus'); bump(s, 'morale', 4); life.trust(s, 'homeless', 1); g.toast('"God bless. Or whoever is on shift."', 'good'); } },
        { label: 'Ask him about the block.', sub: '20 min · a story · +morale', effect: () => { g.advance(20); bump(s, 'morale', 6); bump(s, 'stress', -5); g.toast(pick(GUS_STORIES), 'good'); } },
        { label: 'Nod and keep walking.', sub: '', effect: () => {} },
      ],
    });
  } else if (id === 'junkie') {
    g.openModal({
      kicker: 'THE CORNER',
      title: 'Someone You Nod At',
      body: `${npcLine('junkie')}

His hands do not stop moving. He is wearing two jackets in a way that means he owns two jackets.`,
      choices: [
        { label: 'Give him a dollar for a coffee.', sub: '$1', disabled: s.money < 1, effect: () => { g.spendMoney(1, 'coffee money'); bump(s, 'morale', 2); g.toast('He actually buys a coffee. You watch him do it.', 'good'); } },
        { label: 'Nod.', sub: '', effect: () => {} },
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
    { id: 'habcase', label: 'Look in the hot case', sub: 'it is all still warm', x: -1.6, z: -0.05, radius: 1.2, action: (gg) => openShop(gg, 'habibs') },
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

/* ------------------------------ KESTREL PARK ------------------------------ */

/**
 * Across the road from the crosswalk: grass, a path, benches that face each other so people can
 * talk, a half-court with a bent rim, a playground nobody maintains, a chess table with a
 * missing knight, and a boombox somebody left on a crate. Late-90s municipal park, no budget.
 */
export function buildPark(g) {
  const group = new THREE.Group();
  const S = 17;
  const grass = retroMaterial('parkgrass', { color: 0x37502f });
  const pathMat = retroMaterial('parkpath', { color: 0x8f8974 });
  group.add(plane(S, S, { name: 'parkfloor', color: 0x37502f }, [0, 0, 0], [-Math.PI / 2, 0, 0]));
  // the path: a T, so there is a reason to walk in three directions
  group.add(plane(2.2, S, { name: 'parkpath', color: 0x9a9480 }, [0, 0.01, 0], [-Math.PI / 2, 0, 0]));
  group.add(plane(S, 1.8, { name: 'parkpath2', color: 0x9a9480 }, [0, 0.012, 0.4], [-Math.PI / 2, 0, 0]));
  void grass; void pathMat;

  // trees in a rough ring, each with a low planter that reads as a collider
  const tree = (tx, tz, scale = 1) => {
    group.add(box(0.9 * scale, 0.3 * scale, 0.9 * scale, M.concrete, [tx, 0.15 * scale, tz]));
    group.add(box(0.22 * scale, 2.2 * scale, 0.22 * scale, retroMaterial('parktrunk', { color: 0x40301f }), [tx, 1.2 * scale, tz]));
    for (let i = 0; i < 3; i++) {
      group.add(box((1.7 - i * 0.45) * scale, 0.9 * scale, (1.7 - i * 0.45) * scale,
        retroMaterial(`parkleaf${i}`, { color: i % 2 ? 0x3d5832 : 0x2e4a2a }), [tx, (2.2 + i * 0.75) * scale, tz], [0, i * 0.6, 0]));
    }
  };
  tree(-6.8, -3.2); tree(6.6, -1.6); tree(-6.2, 5.4); tree(5.8, 6.0); tree(0.2, -4.6, 0.9);

  // benches, facing the path
  const bench = (bx, bz, rot = 0) => {
    const grp = new THREE.Group();
    grp.add(box(1.9, 0.09, 0.52, M.wood, [0, 0.5, 0]));
    grp.add(box(1.9, 0.5, 0.09, M.wood, [0, 0.75, -0.24]));
    grp.add(box(0.09, 0.5, 0.5, M.metal, [-0.86, 0.25, 0]));
    grp.add(box(0.09, 0.5, 0.5, M.metal, [0.86, 0.25, 0]));
    grp.position.set(bx, 0, bz);
    grp.rotation.y = rot;
    group.add(grp);
  };
  bench(-4.4, 1.8, 0.2);
  bench(4.4, 3.0, -0.3);
  bench(-1.6, -2.6, Math.PI * 0.05);

  // half-court: asphalt, a bent rim, a backboard with no net
  group.add(plane(6.4, 5.2, { name: 'court', map: tex('asphalt'), repeat: [2, 2] }, [5.2, 0.015, -4.6], [-Math.PI / 2, 0, 0]));
  group.add(box(0.16, 3.2, 0.16, M.metal, [5.2, 1.6, -6.6]));
  group.add(box(1.8, 1.1, 0.08, retroMaterial('backboard', { color: 0xd8d8cc }), [5.2, 3.1, -6.6]));
  group.add(box(0.06, 0.06, 0.1, retroMaterial('rim', { color: 0xd8622a, emissive: 0.15 }), [5.2, 2.65, -6.35]));
  group.add(box(0.5, 0.02, 0.04, retroMaterial('rim2', { color: 0xd8622a }), [5.2, 2.62, -6.3], [0, 0, 0.12]));

  // playground: a sandbox, a slide, a swing frame, all slightly wrong
  group.add(plane(3.6, 3.0, { name: 'sand', color: 0x9a8a62 }, [-5.6, 0.02, -5.6], [-Math.PI / 2, 0, 0]));
  group.add(box(0.12, 1.8, 0.12, M.metal, [-6.9, 0.9, -6.6]));
  group.add(box(0.12, 1.8, 0.12, M.metal, [-4.5, 0.9, -6.6]));
  group.add(box(2.5, 0.1, 0.1, M.metal, [-5.7, 1.78, -6.6]));
  group.add(box(0.4, 0.06, 0.28, M.metal, [-6.2, 1.2, -6.6]));
  group.add(box(0.4, 0.06, 0.28, M.metal, [-5.0, 1.2, -6.6]));
  group.add(box(0.9, 0.08, 1.9, retroMaterial('slide', { color: 0xb5b8b0 }), [-4.4, 0.85, -5.4], [0.35, 0, 0]));

  // chess table with a missing knight; the boombox on a crate by the path
  group.add(box(0.9, 0.08, 0.9, retroMaterial('chesstable', { color: 0x4a4a3c }), [-2.4, 0.72, -1.2]));
  group.add(box(0.12, 0.72, 0.12, M.metal, [-2.4, 0.36, -1.2]));
  for (const [cx, cz] of [[-3.1, -1.2], [-1.7, -1.2]]) group.add(box(0.42, 0.42, 0.42, M.wood, [cx, 0.21, cz]));
  group.add(box(0.5, 0.3, 0.34, retroMaterial('boombox', { color: 0x2a2c30 }), [1.9, 0.62, 0.9]));
  group.add(box(0.14, 0.14, 0.02, retroMaterial('boomboxspk', { color: 0x111214 }), [1.76, 0.64, 1.07]));
  group.add(box(0.14, 0.14, 0.02, retroMaterial('boomboxspk2', { color: 0x111214 }), [2.04, 0.64, 1.07]));
  group.add(box(0.56, 0.34, 0.4, M.wood, [1.9, 0.17, 0.9]));

  // lamps, a bin, and the gate back to the street
  for (const lx of [-3.0, 4.2]) {
    group.add(box(0.14, 3.4, 0.14, M.metal, [lx, 1.7, 6.4]));
    group.add(box(0.5, 0.1, 0.3, M.lamp, [lx, 3.45, 6.2]));
    group.add(plane(2.6, 2.0, { name: 'parklamp', color: 0xfff2c4, opacity: 0.14, transparent: true, unlit: true }, [lx, 0.03, 6.2], [-Math.PI / 2, 0, 0]));
  }
  group.add(box(0.6, 0.9, 0.6, retroMaterial('parkbin', { color: 0x39443c }), [2.9, 0.45, 6.2]));
  group.add(box(1.5, 2.3, 0.14, M.door, [0, 1.15, 8.4]));
  group.add(box(0.12, 2.4, 0.2, M.white, [-0.8, 1.2, 8.36]));
  group.add(box(0.12, 2.4, 0.2, M.white, [0.8, 1.2, 8.36]));
  group.add(box(1.7, 0.12, 0.2, M.white, [0, 2.4, 8.36]));
  group.add(plane(2.6, 0.45, { name: 'parkgate', map: signTex('signParkGate', [{ text: 'KESTREL PARK', color: '#e9f6d8', size: 12 }], { w: 128, h: 24, bg: '#1e3a26', border: '#8fc07a' }), emissive: 0.8, unlit: true }, [0, 2.7, 8.3]));

  // ---- people. The three women come and go on their own schedules (world/schedules.js, placed
  // by the world, not here); Kev is just here.
  const npcs = [
    { kind: 'kev', x: -2.4, z: -0.2, rot: 2.6, talk: 'kev' },
  ];

  const interactables = [
    { id: 'parkbench1', label: 'Sit on the bench', sub: 'watch the park happen', x: -4.4, z: 1.8, radius: 1.5, action: (gg) => parkSit(gg) },
    { id: 'parkbench2', label: 'Sit on the bench', sub: 'the other one', x: 4.4, z: 3.0, radius: 1.5, action: (gg) => parkSit(gg) },
    { id: 'hoops', label: 'Shoot around on the half-court', sub: '45 min · the rim is bent', x: 5.2, z: -4.6, radius: 2.0, action: (gg) => parkHoops(gg) },
    { id: 'chess', label: 'Play chess at the table', sub: 'the knight is a bottle cap', x: -2.4, z: -0.6, radius: 1.5, action: (gg) => parkChess(gg) },
    { id: 'boombox', label: 'The boombox on the crate', sub: 'somebody left a tape in it', x: 1.9, z: 1.1, radius: 1.5, action: (gg) => parkMusic(gg) },
    { id: 'parkmate', label: 'Talk to Kev', sub: 'he is losing at chess to himself', x: -2.4, z: 0.2, radius: 1.5, action: (gg) => { gg.advance(8); bump(gg.state, 'morale', 4); gg.openModal({ kicker: 'KEV · KESTREL PARK', title: 'Park Kev', body: `${npcLine('kev')}\n\nHe has set up a chess board with no opponent and is losing anyway.`, choices: [{ label: 'Sit with him for a bit.', effect: () => { bump(gg.state, 'morale', 5); bump(gg.state, 'stress', -4); gg.advance(15); } }, { label: 'Leave him to it.', effect: () => {} }] }); } },
    { id: 'parkexit', label: 'Back to Kestrel Street', sub: 'through the gate', x: 0, z: 7.9, radius: 1.1, action: (gg) => gg.goTo('street', 'park') },
  ];

  return {
    group,
    bounds: { minX: -8.2, maxX: 8.2, minZ: -8.0, maxZ: 8.2 },
    solids: [
      solid(-6.8, -3.2, 1.0, 1.0), solid(6.6, -1.6, 1.0, 1.0), solid(-6.2, 5.4, 1.0, 1.0),
      solid(5.8, 6.0, 1.0, 1.0), solid(0.2, -4.6, 0.9, 0.9),
      solid(-4.4, 1.8, 2.0, 0.7, 0.9), solid(4.4, 3.0, 2.0, 0.7, 0.9), solid(-1.6, -2.6, 2.0, 0.7, 0.9),
      solid(5.2, -6.6, 0.4, 0.4), solid(-5.6, -5.6, 3.6, 3.0, 0.5), solid(-2.4, -1.2, 1.2, 1.2, 0.85),
      solid(1.9, 0.9, 0.8, 0.6, 0.85), solid(2.9, 6.2, 0.7, 0.7, 0.9),
      solid(-3.0, 6.4, 0.4, 0.4), solid(4.2, 6.4, 0.4, 0.4),
    ],
    // a step inside the gate, past the exit's prompt (arriving inside it made F walk him back out)
    spawn: { x: 0, z: 6.5, rot: Math.PI },
    npcs,
    interactables,
    ambient: 'park',
  };
}

/* ------------------------------ KESTREL CLINIC ------------------------------ */

/** Walk-ins, a plastic chair, a scale nobody stands on, and a nurse who has heard it all. */
export function buildClinic(g) {
  const group = new THREE.Group();
  const W = 8, D = 8;
  group.add(plane(W, D, { name: 'cliflor', map: tex('tile'), repeat: [4, 4] }, [0, 0, 0], [-Math.PI / 2, 0, 0]));
  group.add(box(W, 2.9, 0.16, { name: 'cliwall', color: 0xd8e2df }, [0, 1.45, -D / 2]));
  group.add(box(W, 2.9, 0.16, { name: 'cliwall2', color: 0xd8e2df }, [0, 1.45, D / 2]));
  group.add(box(0.16, 2.9, D, { name: 'cliwall3', color: 0xcfdad7 }, [-W / 2, 1.45, 0]));
  group.add(box(0.16, 2.9, D, { name: 'cliwall4', color: 0xcfdad7 }, [W / 2, 1.45, 0]));
  group.add(plane(W, D, { name: 'cliceil', map: tex('ceiling'), repeat: [2, 2] }, [0, 2.9, 0], [Math.PI / 2, 0, 0]));

  // reception counter along the left wall
  group.add(box(0.9, 1.0, 3.0, retroMaterial('clicounter', { color: 0x8a9a96 }), [-2.9, 0.5, -0.4]));
  group.add(box(0.96, 0.06, 3.06, M.white, [-2.9, 1.03, -0.4]));
  group.add(box(0.5, 0.3, 0.4, retroMaterial('clipc', { color: 0x2a2e2c }), [-2.9, 1.2, 0.4]));
  // a poster of a spine and a hand-washing poster, both very old
  group.add(plane(1.0, 1.3, { name: 'clispine', color: 0x9ab8c2, emissive: 0.2, unlit: true }, [-2.0, 1.8, -3.55]));
  group.add(plane(0.9, 1.1, { name: 'cliwash', map: tex('poster') }, [2.4, 1.8, -3.55]));
  // the examination bay: a curtain rail, a bed, a stool
  group.add(box(0.06, 2.2, 0.06, M.metal, [1.0, 1.1, 2.4]));
  group.add(box(0.06, 2.2, 0.06, M.metal, [3.4, 1.1, 2.4]));
  group.add(box(2.4, 0.06, 0.06, M.metal, [2.2, 2.2, 2.4]));
  group.add(box(0.05, 1.9, 1.9, retroMaterial('curtain', { color: 0xa8c4c0, opacity: 0.55, transparent: true }), [1.05, 1.15, 1.5]));
  group.add(box(1.9, 0.14, 0.8, retroMaterial('clibed', { color: 0xdfe6e4 }), [3.0, 0.62, 3.0]));
  group.add(box(0.16, 0.6, 0.7, M.metal, [2.15, 0.3, 3.0]));
  group.add(box(0.44, 0.44, 0.44, M.metal, [2.0, 0.22, 2.0]));
  // waiting chairs
  for (let i = 0; i < 3; i++) {
    group.add(box(0.48, 0.08, 0.48, retroMaterial(`clichair${i}`, { color: 0x7a8a88 }), [-0.6 + i * 0.9, 0.46, 1.0]));
    group.add(box(0.48, 0.5, 0.07, retroMaterial(`clichairb${i}`, { color: 0x7a8a88 }), [-0.6 + i * 0.9, 0.72, 1.24]));
    group.add(box(0.07, 0.46, 0.46, M.metal, [-0.85 + i * 0.9, 0.23, 1.0]));
    group.add(box(0.07, 0.46, 0.46, M.metal, [-0.35 + i * 0.9, 0.23, 1.0]));
  }
  // water cooler, notice board, lights
  group.add(box(0.44, 2.0, 0.44, retroMaterial('cooler2', { color: 0xd8e0e2 }), [3.4, 1.0, -1.2]));
  group.add(box(0.34, 0.4, 0.34, retroMaterial('waterjug', { color: 0x9fd8e0, unlit: true, emissive: 0.15 }), [3.4, 1.9, -1.2]));
  group.add(plane(1.6, 1.0, { name: 'cliboard', color: 0xe8e4d2 }, [-2.6, 1.7, -3.5]));
  for (const x of [-1.8, 1.8]) group.add(box(2.0, 0.06, 0.24, M.lamp, [x, 2.8, 0]));
  // the door out
  group.add(box(1.2, 2.3, 0.14, retroMaterial('clidoor', { color: 0x6a8a90 }), [0, 1.15, 3.7]));
  group.add(box(0.12, 2.4, 0.2, M.white, [-0.7, 1.2, 3.66]));
  group.add(box(0.12, 2.4, 0.2, M.white, [0.7, 1.2, 3.66]));
  group.add(box(1.5, 0.12, 0.2, M.white, [0, 2.4, 3.66]));

  const interactables = [
    { id: 'nurse', label: `Speak to ${clinic.nurseName}`, sub: 'treatment · costs money or a bill', x: -1.6, z: -1.2, action: (gg) => clinicMenu(gg) },
    { id: 'clinicreception', label: 'Reception', sub: 'check in · ask what it costs', x: -2.4, z: 0.2, action: (gg) => clinicReception(gg) },
    { id: 'clinicchair', label: 'Sit in a waiting chair', sub: '20 min · calm down', x: 0.3, z: 1.0, action: (gg) => { gg.advance(20); bump(gg.state, 'stress', -6); bump(gg.state, 'morale', 1); gg.toast('The chair is plastic and the clock is loud. It helps anyway.', 'info'); } },
    { id: 'clinicexit', label: 'Back out to Kestrel St.', sub: '', x: 0, z: 3.1, radius: 1.1, action: (gg) => gg.goTo('street', 'clinic') },
  ];

  return {
    group,
    bounds: { minX: -3.6, maxX: 3.6, minZ: -3.6, maxZ: 3.6 },
    solids: [
      solid(-2.9, -0.4, 1.0, 3.1, 1.25), solid(2.2, 2.7, 2.6, 1.2, 0.9),
      solid(3.4, -1.2, 0.5, 0.5, 1.9), solid(1.0, 2.4, 0.2, 0.2),
      solid(-0.6, 1.0, 0.5, 0.5, 0.8), solid(0.3, 1.0, 0.5, 0.5, 0.8), solid(1.2, 1.0, 0.5, 0.5, 0.8),
    ],
    // inside the door but clear of every prompt (it used to land in the exit's, so F walked him out)
    spawn: { x: -1.3, z: 1.9, rot: Math.PI },
    npcs: [{ kind: 'nurse', x: -1.6, z: -1.9, rot: 0.2, talk: 'nurse' }],
    interactables,
    ambient: 'clinic',
  };
}

/* ------------------------------ shared menus ------------------------------ */

/** The park bench: sit, watch, breathe. */
function parkSit(g) {
  const s = g.state;
  g.advance(CONFIG.park.sitMinutes);
  bump(s, 'morale', CONFIG.park.sitMorale);
  bump(s, 'stress', -6);
  bump(s, 'energy', 2);
  bump(s, 'hygiene', -2);
  g.toast('You sit. A dog investigates your shoe and moves on.', 'good');
  if (chance(0.4)) g.toast(pick(AMBIENT_LINES), 'info');
}

/** Basketball with a bent rim and no net. */
function parkHoops(g) {
  const s = g.state;
  g.advance(CONFIG.park.hoopsMinutes, { working: true });
  const good = chance(0.55 + (s.stats.energy - 50) * 0.002);
  bump(s, 'morale', good ? CONFIG.park.hoopsMorale : 3);
  bump(s, 'stress', good ? -9 : -2);
  bump(s, 'energy', -14);
  bump(s, 'hygiene', -8);
  g.audio.sfx(good ? 'confirm' : 'ui');
  g.toast(good
    ? 'Three in a row. A kid on the next court says "aight" which is the highest honour available.'
    : 'The rim is bent and so is everything you throw at it. You still needed the air.', good ? 'good' : 'info');
}

/** Chess, against whoever is sitting there, with a bottle cap for a knight. */
function parkChess(g) {
  const s = g.state;
  const opp = pick(['an old man', 'a teenager on a bike', 'Kev']);
  g.advance(CONFIG.park.chessMinutes);
  const won = chance(0.35);
  bump(s, 'morale', won ? CONFIG.park.chessMorale + 3 : CONFIG.park.chessMorale);
  bump(s, 'stress', -7);
  g.toast(won
    ? `You beat ${opp}. They take it badly. You take it for the rest of the week.`
    : `${opp} beats you and explains the whole game afterwards. You are not sure that is allowed.`, won ? 'good' : 'info');
}

/** The boombox: listen, or dance like it is 1999 because it is. */
function parkMusic(g) {
  const s = g.state;
  g.openModal({
    kicker: 'KESTREL PARK · THE BOOMBOX',
    title: 'Side A',
    body: 'A tape with somebody\'s handwriting on it. The handwriting says "SUMMER" and nothing else. The track has been playing for four bars and it is already good.',
    choices: [
      {
        label: 'Dance. Actually dance.', sub: `${CONFIG.park.danceMinutes} min · +morale · -stress`,
        effect: () => {
          g.world?.playDance?.(9);
          g.advance(CONFIG.park.danceMinutes);
          bump(s, 'morale', CONFIG.park.danceMorale);
          bump(s, 'stress', CONFIG.park.danceStress);
          bump(s, 'hygiene', -3);
          bump(s, 'energy', -4);
          g.audio.sfx('confirm');
          g.toast('You dance. Two people join in. One of them is better than you and knows it.', 'good');
          s.flags.danced = (s.flags.danced || 0) + 1;
        },
      },
      {
        label: 'Just listen.', sub: `${CONFIG.park.musicMinutes} min · +morale`,
        effect: () => {
          g.advance(CONFIG.park.musicMinutes);
          bump(s, 'morale', CONFIG.park.musicMorale);
          bump(s, 'stress', -9);
          g.toast('You stand next to a boombox for twenty minutes and nobody asks you anything.', 'good');
        },
      },
      { label: 'Leave it playing.', sub: '', effect: () => {} },
    ],
  });
}

/** The one menu every partner conversation grows out of (park and apartment). */
export function partnerMenu(g, id) {
  const p = CONFIG.partners[id];
  if (!p) return;
  const s = g.state;
  const st = romance.partnerState(s, id);
  if (!st.met) romance.meetPartner(g, id);
  const atHome = g.world?.areaId === 'apartment' && s.romance?.liveIn === id;
  const choices = [
    {
      label: 'Talk to her.', sub: '+affection · 10 min',
      effect: () => {
        const r = romance.chat(g, id);
        if (r) {
          bump(s, 'morale', 2);
          g.openModal({ kicker: p.name.toUpperCase(), title: 'The Conversation', body: `${r.line}\n\nAffection ${st.affection}/100.${st.girlfriend ? ' She is your girlfriend.' : ''}`, choices: [{ label: 'Yeah.', effect: () => {} }] });
        }
      },
    },
    {
      label: 'Flirt.', sub: 'she decides how it lands',
      effect: () => {
        const r = romance.flirt(g, id);
        if (r?.ok) g.openModal({ kicker: p.name.toUpperCase(), title: r.delta >= 5 ? 'That Landed' : r.delta > 0 ? 'Polite' : r.delta === 0 ? 'Flat' : 'Not That', body: `${r.line}\n\nAffection ${r.affection}/100.`, choices: [{ label: 'Okay.', effect: () => {} }] });
      },
    },
    {
      label: 'Ask her on a date.', sub: 'costs money and time',
      effect: () => dateMenu(g, id),
    },
  ];
  // the close stuff: offered once she likes him enough (always, once she is his girlfriend)
  const close = (type) => st.girlfriend || st.affection >= CONFIG.romance.gestures[type];
  const world = g.world;
  const holding = !!world?.holdingHands?.(id);
  if (close('hug')) {
    choices.push({ label: 'Hug her.', sub: romance.gestureSub(s, id, 'hug'), effect: () => { world?.playAffection?.('hug', id); romance.gesture(g, id, 'hug'); } });
  }
  if (close('kiss')) {
    choices.push({ label: 'Lean in.', sub: `she kisses your cheek · ${romance.gestureSub(s, id, 'kiss')}`, effect: () => { world?.playAffection?.('kiss', id); romance.gesture(g, id, 'kiss'); } });
  }
  if (holding) {
    choices.push({ label: 'Let go of her hand.', sub: '', effect: () => world?.holdHands?.(id, false) });
  } else if (close('hand') && g.world?.areaId !== 'apartment') {
    choices.push({ label: 'Take her hand.', sub: `walk around together · ${romance.gestureSub(s, id, 'hand')}`, effect: () => { if (world?.holdHands?.(id)) romance.gesture(g, id, 'hand'); } });
  }
  if (st.girlfriend) {
    choices.push({
      label: 'Spend the evening in.', sub: 'free · +morale · +affection',
      effect: () => {
        g.advance(90, { social: true });
        romance.partnerState(s, id).affection = Math.min(100, st.affection + 4);
        bump(s, 'morale', 9);
        bump(s, 'stress', -8);
        g.toast(`You and ${p.name} do nothing together, competently.`, 'good');
      },
    });
    if (romance.cheeksAvailable(s, id)) {
      choices.push({ label: 'Ask her to stay.', sub: 'fade to black · the next morning', effect: () => romance.cheeks(g, id) });
    }
    if (atHome) {
      choices.push({ label: 'Talk about the household.', sub: 'money, food, the radiator', effect: () => householdMenu(g, id) });
    }
    if (romance.canAskMoveIn(s, id)) {
      choices.push({ label: 'Ask her to move in.', sub: 'she would pay her share', effect: () => romance.askMoveIn(g, id) });
    }
  } else if (romance.canAskGirlfriend(s, id)) {
    choices.push({ label: 'Ask her to be your girlfriend.', sub: `${st.dates} dates · affection ${st.affection}`, effect: () => romance.askGirlfriend(g, id) });
  }
  choices.push({ label: 'Step away.', sub: '', effect: () => {} });

  const status = st.girlfriend
    ? (s.romance?.liveIn === id ? 'She lives with you.' : 'She is your girlfriend.')
    : st.dates > 0 ? `${st.dates} date${st.dates === 1 ? '' : 's'} so far.` : 'You have not been anywhere together yet.';
  g.openModal({
    kicker: p.name.toUpperCase(),
    title: p.name,
    body: `${p.blurb}\n\n${st.girlfriend ? p.chat[1] : p.chat[0]}\n\nAffection ${st.affection}/100. ${status}`,
    choices,
  });
}

/** Pick where to take her. One planner, in systems/romance.js, used by every interaction. */
function dateMenu(g, id) {
  romance.openDateMenu(g, id);
}

/** At home, with money and food and a radiator between you. */
function householdMenu(g, id) {
  const s = g.state;
  const p = CONFIG.partners[id];
  const share = Math.round(p.rentShare * 100);
  g.openModal({
    kicker: 'UNIT 3B',
    title: 'Household',
    body: `${p.name} pays ${share}% of the rent (${money(CONFIG.economy.rent.amount * p.rentShare)} a cycle).\n\nHer habits: ${p.household.eatsFood ? `eats roughly ${p.household.eatsFood} thing(s) of yours a day. ` : ''}${p.household.restocks ? 'Restocks the fridge. ' : ''}${p.household.sells ? 'Sells her own things and leaves the cash. ' : ''}${p.giftNote}`,
    choices: [
      { label: 'Ask her to cover more of the rent.', sub: 'she will not love this', effect: () => { bump(s, 'morale', -2); bump(s, 'stress', 3); romance.partnerState(s, id).affection = Math.max(0, romance.partnerState(s, id).affection - 3); g.toast(`${p.name} says the share is the share. She is right and you both know it.`, 'bad'); } },
      { label: 'Say thank you.', sub: '+affection', effect: () => { romance.partnerState(s, id).affection = Math.min(100, romance.partnerState(s, id).affection + 2); bump(s, 'morale', 3); g.toast('She says "obviously" and does not look up. It counts.', 'good'); } },
      { label: 'End the conversation.', sub: '', effect: () => {} },
    ],
  });
}

function openGiftMenu(g) {
  const res = romance.openGift(g);
  if (!res) return;
  g.openModal({
    kicker: 'UNIT 3B · THE COUNTER',
    title: 'A Present',
    body: `${res.from} left you a ${res.name}.\n\nThere is no card. There is a drawing on the bag. You put the drawing on the fridge.`,
    choices: [{ label: 'Put it away.', effect: () => { bump(g.state, 'morale', 3); } }],
  });
}

function clinicMenu(g) {
  const s = g.state;
  const info = clinic.treatmentInfo(g);
  g.openModal({
    kicker: `KESTREL CLINIC · ${clinic.nurseName.toUpperCase()}`,
    title: 'Walk-In',
    body: `${clinic.nurseName} does not look up from the clipboard until she is finished with it. Then she looks at you properly, which is worse.\n\n"Sit. I have twenty minutes and you have a pulse. That is the whole triage system."\n\nRisk ${Math.round(s.stats.risk)}% · withdrawal ${Math.round(s.stats.withdrawal)}% · dependence ${Math.round(s.stats.addiction)}%${info.alreadyToday ? '\n\nShe has already seen you today. She will not do it twice.' : ''}`,
    choices: [
      {
        label: `Get treatment — ${money(info.cost)}`, sub: `${info.minutes} min · risk and withdrawal come down · ${info.affordable ? 'cash' : 'on the hospital bill'}`,
        disabled: !info.canTreat,
        effect: () => {
          const res = clinic.treat(g);
          if (!res) return;
          g.openModal({
            kicker: 'KESTREL CLINIC',
            title: 'After',
            body: `A blood-pressure cuff, a blood draw, a lecture that is mostly kindness.\n\n${res.paid ? `${money(res.paid)} paid.` : `${money(res.owed)} on the bill.`} She writes a number on a card: the daily check-in line. "Text it every day. That is the whole program."`,
            choices: [{ label: 'Take the card.', effect: () => { clinic.checkIn(g); } }],
          });
        },
      },
      ...programChoices(g),
      { label: 'Check in on the line instead.', sub: 'free · 10 min · slows withdrawal', effect: () => { clinic.checkIn(g); } },
      { label: 'Ask what it costs.', sub: '', effect: () => { g.toast(`Treatment is ${money(info.cost)}. If you cannot pay, it goes on the bill and the bill grows.`, 'info'); } },
      { label: 'Leave.', sub: '', effect: () => {} },
    ],
  });
}

/** The outpatient course at the clinic counter: sign up, or keep today's appointment. */
function programChoices(g) {
  const p = clinic.programInfo(g);
  const hours = `${String(p.window[0] / 60).padStart(2, '0')}:00-${String(p.window[1] / 60).padStart(2, '0')}:00`;
  if (p.status === 'active') {
    return [{
      label: `Keep your appointment — session ${p.done + 1} of ${p.sessions}`,
      sub: p.canAttend ? `${p.minutes} min · ${money(p.cost)} · dependence comes down${p.relapsePending ? ' (half, after the slip)' : ''}`
        : p.dueToday ? `appointments are ${hours}` : `next one is day ${p.next}`,
      disabled: !p.canAttend,
      effect: () => {
        const res = clinic.attend(g);
        if (!res) return;
        g.openModal({
          kicker: 'KESTREL CLINIC · OUTPATIENT',
          title: res.completed ? 'The Last Plastic Chair' : `Session ${res.done} of ${res.sessions}`,
          body: res.completed
            ? 'Okafor closes the file, then opens it again to write one more line. "Finished. Not fixed. Finished." She shakes your hand like she has decided to.'
            : `Two hours. A circle of chairs, a man who talks about his dog the whole time, and ten minutes alone with Okafor where you say a true thing out loud.${res.halved ? '\n\nShe knows about the slip. She does not make a speech. It just counts for less today.' : ''}\n\nNext: day ${clinic.programInfo(g).next}.`,
          choices: [{ label: 'Walk out into the afternoon.', effect: () => {} }],
        });
      },
    }];
  }
  return [{
    label: 'Sign up for the outpatient course',
    sub: p.canEnroll ? `${p.sessions} sessions · every 2 days · ${hours} · ${money(p.cost)} each` : p.status === 'dropped' ? `day ${p.waitUntil} at the earliest` : 'needs a referral, or a real habit',
    disabled: !p.canEnroll,
    effect: () => { clinic.enroll(g); },
  }];
}

function clinicReception(g) {
  const s = g.state;
  const l = life.lifeState(s);
  g.openModal({
    kicker: 'KESTREL CLINIC · RECEPTION',
    title: 'Sign-In Sheet',
    body: 'A clipboard on a string. Your name is already on it, in somebody else\'s handwriting.\n\nA notice taped to the glass: WALK-INS WELCOME · NO INSURANCE · NO JUDGEMENT · NO EXCEPTIONS.',
    choices: [
      { label: 'Check in for today.', sub: 'free · 10 min', effect: () => { clinic.checkIn(g); } },
      { label: 'Ask about the hospital bill.', sub: l.debt.hospital ? money(l.debt.hospital) : 'nothing on file', effect: () => { g.toast(l.debt.hospital ? `Kings County has you down for ${money(l.debt.hospital)}. It grows about 1% a day.` : 'Nothing outstanding. Enjoy it.', 'info'); } },
      { label: 'Sit back down.', sub: '', effect: () => {} },
    ],
  });
}

/* ------------------------------ QUIK-STOP #14 ------------------------------ */

/**
 * The store Mo works at, as a store: two gondola aisles, the coolers along the back, a coffee
 * station, the register by the door with a clerk behind it, a door marked EMPLOYEES ONLY with
 * the time clock behind it. Open all night. Customers drift the aisles; Dale is in the back
 * during the day. Everything sold here goes through the same menu board as the corner shops,
 * at convenience-store markup.
 */
export function buildQuikStop(g) {
  const group = new THREE.Group();
  const W = 9, D = 8;
  group.add(plane(W, D, { name: 'qsfloor', map: tex('tile'), repeat: [5, 4] }, [0, 0, 0], [-Math.PI / 2, 0, 0]));
  group.add(box(W, 3.0, 0.16, { name: 'qswall', color: 0xd8d4c4 }, [0, 1.5, -D / 2]));
  group.add(box(W, 3.0, 0.16, { name: 'qswall2', color: 0xd8d4c4 }, [0, 1.5, D / 2]));
  group.add(box(0.16, 3.0, D, { name: 'qswall3', color: 0xd8d4c4 }, [-W / 2, 1.5, 0]));
  group.add(box(0.16, 3.0, D, { name: 'qswall4', color: 0xd8d4c4 }, [W / 2, 1.5, 0]));
  group.add(plane(W, D, { name: 'qsceil', map: tex('ceiling'), repeat: [3, 3] }, [0, 3.0, 0], [Math.PI / 2, 0, 0]));
  // the green stripe every store in the chain has at hip height
  for (const z of [-D / 2 + 0.1, D / 2 - 0.1]) group.add(box(W - 0.2, 0.18, 0.02, M.green, [0, 1.1, z]));
  for (const x of [-W / 2 + 0.1, W / 2 - 0.1]) group.add(box(0.02, 0.18, D - 0.2, M.green, [x, 1.1, 0]));
  // fluorescent strips: the whole lighting design
  for (const x of [-2.4, 0, 2.4]) group.add(box(0.2, 0.06, 5.6, M.lamp, [x, 2.94, -0.4]));

  // two gondola aisles, low enough to see over, stocked in chain-store colours
  for (const ax of [-1.6, 0.8]) {
    group.add(box(0.6, 1.45, 3.2, M.metal, [ax, 0.72, -1.0]));
    for (let tier = 0; tier < 3; tier++) {
      for (let i = 0; i < 6; i++) {
        const c = [0xd9502e, 0xf2b632, 0x2f6fb5, 0x7cc35a, 0xe8463a, 0xf4f1ea][(i + tier) % 6];
        for (const side of [-1, 1]) group.add(box(0.12, 0.26, 0.42, retroMaterial(`qsgood${c}`, { color: c }), [ax + side * 0.33, 0.35 + tier * 0.45, -2.35 + i * 0.54]));
      }
    }
  }
  // the coolers along the back, lit from inside
  group.add(box(4.8, 2.2, 0.55, retroMaterial('qscooler', { color: 0x2e3a3c }), [1.3, 1.1, -3.65]));
  for (let i = 0; i < 4; i++) {
    group.add(plane(1.05, 1.8, { name: 'qscoolerglass', color: 0x9fd8ff, emissive: 0.4, unlit: true, opacity: 0.55, transparent: true }, [-0.5 + i * 1.2, 1.15, -3.36]));
  }
  // coffee station on the right wall
  group.add(box(0.7, 1.0, 1.6, M.wood, [3.95, 0.5, 0.6]));
  group.add(box(0.4, 0.5, 0.35, retroMaterial('qscoffee', { color: 0x2a2a28 }), [4.0, 1.25, 0.3]));
  group.add(box(0.3, 0.28, 0.28, retroMaterial('qspot', { color: 0x6b4a2f, emissive: 0.1 }), [3.95, 1.14, 0.9]));
  group.add(plane(1.2, 0.36, { name: 'qscoffeesign', map: signTex('signQsCoffee', [{ text: 'COFFEE · $1.69', color: '#ffe36a', size: 12 }], { w: 96, h: 24, bg: '#2a1a10' }), emissive: 0.9, unlit: true }, [4.33, 1.9, 0.6], [0, -Math.PI / 2, 0]));
  // the register by the door: counter, till, lotto, the wall of cigarettes behind
  group.add(box(2.8, 1.0, 0.8, M.wood, [-2.6, 0.5, 2.2]));
  group.add(box(2.84, 0.06, 0.84, M.tile, [-2.6, 1.03, 2.2]));
  group.add(box(0.4, 0.26, 0.34, retroMaterial('qstill', { color: 0x2a2a28 }), [-2.0, 1.19, 2.2]));
  group.add(box(0.5, 0.32, 0.4, retroMaterial('qslotto', { color: 0x223a5a, emissive: 0.15 }), [-3.4, 1.22, 2.2]));
  group.add(box(2.6, 1.3, 0.24, retroMaterial('qssmokes', { color: 0x5a2a22 }), [-2.6, 1.9, 3.82]));
  // the front: glass door, windows, the sign seen backwards from inside
  group.add(box(1.2, 2.3, 0.1, { name: 'qsdoor', color: 0x9fb8b0, opacity: 0.55, transparent: true, unlit: true }, [1.2, 1.15, 3.92]));
  group.add(box(0.12, 2.4, 0.2, M.green, [0.55, 1.2, 3.88]));
  group.add(box(0.12, 2.4, 0.2, M.green, [1.85, 1.2, 3.88]));
  group.add(box(0.6, 0.2, 0.06, retroMaterial('exitsign', { color: 0xff3a2a, emissive: 1.2, unlit: true }), [1.2, 2.68, 3.84]));
  group.add(plane(2.0, 1.3, { name: 'qswinfront', map: tex('window'), emissive: 0.4, unlit: true }, [3.2, 1.6, 3.9], [0, Math.PI, 0]));
  // staff door, back left: EMPLOYEES ONLY, and the time clock beside it
  group.add(box(0.12, 2.2, 1.0, M.door, [-4.38, 1.1, -2.5]));
  group.add(plane(1.0, 0.26, { name: 'qsstaff', map: signTex('signQsStaff', [{ text: 'EMPLOYEES ONLY', color: '#ffffff', size: 10 }], { w: 80, h: 18, bg: '#8a1e22' }), emissive: 0.8, unlit: true }, [-4.3, 2.5, -2.5], [0, Math.PI / 2, 0]));
  group.add(box(0.08, 0.36, 0.26, retroMaterial('qsclock', { color: 0x3a3f42, emissive: 0.1 }), [-4.38, 1.4, -1.6]));

  const mod = minuteOfDay(g.state.clock.m);
  const dayShift = mod >= 8 * 60 && mod < 17 * 60;
  const npcs = [
    { kind: 'clerk', x: -2.6, z: 3.0, rot: Math.PI, talk: null },
    // customers: somebody in the aisles at most hours, more of them in the evening rush
    { kind: mod >= 16 * 60 && mod < 21 * 60 ? 'kev' : 'nia', x: -0.4, z: -1.6, rot: 0.6 },
    ...(mod >= 6 * 60 && mod < 23 * 60 ? [{ kind: 'junkie', x: 2.4, z: -2.2, rot: -0.4 }] : []),
    ...(dayShift ? [{ kind: 'dale', x: -3.6, z: -2.0, rot: 1.3, talk: 'dale' }] : []),
  ];

  const interactables = [
    { id: 'qsregister', label: 'Pay at the register', sub: 'coffee · food · tall boys · loosies', x: -2.6, z: 1.3, action: (gg) => openShop(gg, 'quikstop') },
    { id: 'qsaisle', label: 'Browse the aisles', sub: 'noodles, cans, cereal', x: -0.4, z: -0.4, radius: 1.4, action: (gg) => openShop(gg, 'quikstop') },
    { id: 'qscooler', label: 'Open the coolers', sub: 'eggs · sandwiches · tall boys', x: 1.3, z: -2.9, action: (gg) => openShop(gg, 'quikstop') },
    { id: 'qscoffee', label: 'Pour a coffee', sub: `${money(shopPrice('quikstop', 'coffee'))} · +energy · drink it here`, x: 3.0, z: 0.6, action: (gg) => quikCoffee(gg) },
    { id: 'qsstaff', label: 'Staff door · time clock', sub: 'clock in, call out, talk to Dale', x: -3.3, z: -2.4, action: (gg) => storeMenu(gg, { staff: true }) },
    ...(dayShift ? [{ id: 'dale', label: 'Talk to Dale', sub: 'boss · tired', x: -3.6, z: -2.0, action: (gg) => talk(gg, 'dale') }] : []),
    { id: 'qsexit', label: 'Back out to Kestrel St.', sub: '', x: 1.2, z: 3.2, radius: 1.05, action: (gg) => gg.goTo('street', 'quikstop') },
  ];

  return {
    group,
    bounds: { minX: -4.1, maxX: 4.1, minZ: -3.4, maxZ: 3.4 },
    solids: [
      solid(-2.6, 2.2, 2.8, 0.9, 1.0),
      solid(-1.6, -1.0, 0.7, 3.4, 1.45), solid(0.8, -1.0, 0.7, 3.4, 1.45),
      solid(1.3, -3.6, 4.8, 0.7),
      solid(3.95, 0.6, 0.7, 1.6, 1.0),
    ],
    spawn: { x: 1.2, z: 1.7, rot: Math.PI },
    npcs,
    interactables,
    ambient: 'street',
  };
}

/** A coffee at the station: bought and drunk on the spot, through the same eat path as the fridge. */
function quikCoffee(g) {
  const price = shopPrice('quikstop', 'coffee');
  if (g.state.money < price) { g.toast('Not enough for coffee. Not even the bad coffee.', 'bad'); return; }
  g.spendMoney(price, 'Quik-Stop coffee');
  addItem(g.state, 'coffee', 1);
  g.audio.sfx('cash');
  eat(g, 'coffee');
}
