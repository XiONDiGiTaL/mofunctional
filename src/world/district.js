/**
 * Downtown: the parts of the city that were always on the map and never on the block.
 *
 *   Kestrel St station   a long underground platform under Kestrel, entered from the street and
 *                        from Ashby Avenue. Trains come in, open, wait, and go. It is the only
 *                        way to Park Slope without a car nobody has.
 *   Park Slope           brownstones, a thrift, a diner, a stairwell down to the Basement, and a
 *                        path through to the Marcy Houses.
 *   The Basement         an underground fight club: one fight a night, paid in cash, and if he
 *                        goes down he wakes up in the clinic with the next day already started.
 *   The Marcy Houses     high risk, high reward: strong drugs, dangerous men, and some of them
 *                        are carrying. Loot them if he can. Do not touch the gun.
 *
 * Everything here is built from the same primitives as the rest of the world, so it costs no new
 * dependencies and the renderer's fog, CRT and camera work unchanged.
 */
import * as THREE from '../../vendor/three.module.js';
import { retroMaterial, box, plane } from '../render/retro.js';
import { tex } from '../render/textures.js';
import { signTex } from '../render/signs.js';
import { CONFIG } from '../core/config.js';
import { money, pick, dayOf, minuteOfDay, randInt } from '../core/util.js';
import { bump, logLine, addItem } from '../core/state.js';
import * as wardrobe from '../systems/wardrobe.js';
import { GUN_REFUSAL } from '../systems/brawl.js';

const solid = (x, z, w, d, h = 2.4) => ({ x, z, w, d, h });
const M = {
  tile: retroMaterial('dt_tile', { map: tex('tile') }),
  concrete: retroMaterial('dt_conc', { map: tex('concrete') }),
  metal: retroMaterial('dt_metal', { map: tex('metal') }),
  wood: retroMaterial('dt_wood', { map: tex('wood') }),
  brick: retroMaterial('dt_brick', { map: tex('brick') }),
  sidewalk: retroMaterial('dt_sw', { map: tex('sidewalk') }),
  asphalt: retroMaterial('dt_road', { map: tex('asphalt') }),
  lamp: retroMaterial('dt_lamp', { color: 0xfff2c4, emissive: 1.0, unlit: true }),
  dim: retroMaterial('dt_dim', { color: 0xd8c890, emissive: 0.55, unlit: true }),
  steel: retroMaterial('dt_steel', { color: 0x8a8f96 }),
  rust: retroMaterial('dt_rust', { color: 0x7a4a32 }),
  cloth: retroMaterial('dt_cloth', { color: 0x2a2a32 }),
  blood: retroMaterial('dt_blood', { color: 0x5a1a1a }),
};

/* ================================================================== THE SUBWAY */

/**
 * The way down, from the street: a stairwell cut into the sidewalk, railings either side, a lit
 * globe on each post and a band over the mouth with the station on it. Both stations used to be
 * an invisible trigger on the pavement, which is why nobody could find the trains.
 */
export function buildStationEntrance(x, z, { rot = 0, name = 'KESTREL ST' } = {}) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = rot;
  const rail = retroMaterial('st_rail', { color: 0x2f4a3a, ambient: 0.7 });
  const globe = retroMaterial('st_globe', { color: 0x8ad86a, emissive: 1, unlit: true });
  // steps going down and away, each with a dark riser behind it
  for (let i = 0; i < 5; i++) {
    g.add(box(2.5, 0.16, 0.38, M.concrete, [0, -0.02 - i * 0.17, -0.35 - i * 0.38]));
    g.add(box(2.44, 0.34, 0.06, retroMaterial(`st_riser${i}`, { color: 0x16181e }), [0, -0.2 - i * 0.17, -0.53 - i * 0.38]));
  }
  // a dark floor at the bottom, so it reads as a hole and not a bench
  g.add(plane(2.5, 2.2, { name: 'st_pit', color: 0x0e1014 }, [0, -0.92, -1.5], [-Math.PI / 2, 0, 0]));
  // side walls, handrails and their posts
  for (const sx of [-1, 1]) {
    g.add(box(0.22, 0.95, 2.5, M.concrete, [sx * 1.34, 0.47, -0.9]));
    g.add(box(0.09, 0.09, 2.5, rail, [sx * 1.34, 1.02, -0.9]));
    for (const zz of [-2.0, -0.9, 0.2]) g.add(box(0.11, 0.95, 0.11, rail, [sx * 1.34, 0.5, zz]));
    g.add(box(0.13, 2.5, 0.13, rail, [sx * 1.75, 1.25, 0.28]));
    g.add(box(0.36, 0.36, 0.36, globe, [sx * 1.75, 2.6, 0.28]));
  }
  // the band over the mouth, with the station on it
  g.add(box(2.9, 0.66, 0.14, retroMaterial('st_band', { color: 0x14243f }), [0, 2.06, 0.26]));
  g.add(plane(2.7, 0.54, {
    name: 'st_sign',
    map: signTex(`st_${name.replace(/\s/g, '')}`, [
      { text: name, color: '#ffffff', size: 9 },
      { text: 'DOWN TO THE TRAINS', color: '#a8c8ff', size: 5 },
    ], { w: 128, h: 26, bg: '#14243f' }),
    emissive: 0.9, unlit: true,
  }, [0, 2.06, 0.34]));
  // and the light it throws across the pavement
  g.add(plane(3.4, 3.0, { name: 'st_glow', color: 0x9adf86, opacity: 0.1, transparent: true, unlit: true }, [0, 0.014, 0.2], [-Math.PI / 2, 0, 0]));
  return g;
}



export function buildSubway(g) {
  const group = new THREE.Group();
  const L = 48;
  // platform and track bed
  group.add(plane(L, 9, { name: 'sb_floor', map: tex('tile'), repeat: [16, 3] }, [0, 0, 0.2], [-Math.PI / 2, 0, 0]));
  group.add(plane(L, 3.2, { name: 'sb_track', map: tex('asphalt'), repeat: [18, 2] }, [0, -0.42, -4.6], [-Math.PI / 2, 0, 0]));
  // rails
  for (const z of [-3.9, -5.3]) group.add(box(L, 0.08, 0.1, M.steel, [0, -0.34, z]));
  for (let x = -L / 2; x < L / 2; x += 2.4) group.add(box(0.4, 0.1, 1.7, M.rust, [x, -0.4, -4.6]));
  // platform edge: the yellow strip, and the drop
  group.add(box(L, 0.1, 0.28, retroMaterial('sb_edge', { color: 0xd8b13a, emissive: 0.25 }), [0, 0.03, -3.35]));
  group.add(box(L, 0.5, 0.16, M.concrete, [0, -0.25, -3.2]));
  // back wall with tile and posters
  group.add(box(L, 4.2, 0.2, M.tile, [0, 2.1, 4.6]));
  for (let x = -20; x <= 20; x += 5) {
    group.add(box(1.9, 1.3, 0.06, retroMaterial('sb_poster', { map: tex('window'), color: 0xd8cfae, emissive: 0.2, unlit: true }), [x, 2.2, 4.46]));
  }
  // pillars
  for (let x = -20; x <= 20; x += 5) {
    group.add(box(0.42, 4.2, 0.42, M.concrete, [x, 2.1, 1.6]));
    group.add(box(0.5, 0.12, 0.5, M.steel, [x, 0.06, 1.6]));
  }
  // ceiling
  group.add(plane(L, 11, { name: 'sb_ceil', color: 0x22242a }, [0, 4.2, 0], [Math.PI / 2, 0, 0]));
  for (let x = -21; x <= 21; x += 3.5) group.add(box(0.16, 0.16, 0.9, M.metal, [x, 3.9, 0.6]));
  for (let x = -18; x <= 18; x += 9) group.add(box(2.4, 0.06, 0.5, M.dim, [x, 3.86, -0.6]));
  // benches, trash, a token booth that has not sold a token since 1997
  for (const x of [-10, 4, 14]) {
    group.add(box(2.4, 0.1, 0.6, M.wood, [x, 0.46, 3.5]));
    group.add(box(2.4, 0.5, 0.08, M.wood, [x, 0.7, 3.78]));
    group.add(box(0.12, 0.46, 0.5, M.metal, [x - 1.1, 0.23, 3.5]));
    group.add(box(0.12, 0.46, 0.5, M.metal, [x + 1.1, 0.23, 3.5]));
  }
  group.add(box(0.8, 1.0, 0.8, M.metal, [-16, 0.5, 3.4]));
  group.add(box(0.7, 0.05, 0.7, retroMaterial('sb_trash', { color: 0x3a3a2e }), [-16, 1.01, 3.4]));
  group.add(box(3.4, 2.2, 1.2, retroMaterial('sb_booth', { color: 0x2a4a4a }), [18, 1.1, 3.4]));
  group.add(box(2.0, 1.0, 0.08, retroMaterial('sb_glass', { color: 0x9ac8c8, emissive: 0.2, unlit: true }), [18, 1.7, 2.78]));
  group.add(plane(2.6, 0.4, { name: 'sb_boothsign', map: signTex('signBooth', [{ text: 'TOKENS', color: '#e8d8a0', size: 10 }], { w: 64, h: 16, bg: '#1a2a2a' }), emissive: 0.8, unlit: true }, [18, 2.6, 2.78]));
  // stairs at both ends: west to Kestrel St, east to Ashby Avenue
  for (const [sx, rot] of [[-1, Math.PI / 2], [1, -Math.PI / 2]]) {
    group.add(box(2.6, 0.2, 2.2, M.concrete, [sx * 22.6, 0.1, 0.8]));
    for (let i = 0; i < 6; i++) group.add(box(2.4, 0.16, 0.34, M.concrete, [sx * 22.6, 0.08 + i * 0.16, 0.8 - i * 0.38]));
    group.add(plane(1.6, 0.5, { name: `sb_way${sx}`, map: signTex(`signWay${sx}`, [{ text: sx < 0 ? 'KESTREL ST' : 'ASHBY AVE', color: '#ffffff', size: 9 }], { w: 96, h: 24, bg: '#1a3a6a' }), emissive: 0.7, unlit: true }, [sx * 22.4, 2.4, 1.6], [0, rot, 0]));
  }

  /* ---- the train: three cars that arrive, open, wait, and leave ---- */
  const train = new THREE.Group();
  train.position.set(70, 0, -4.6);
  for (let c = 0; c < 3; c++) {
    const car = new THREE.Group();
    car.position.x = (c - 1) * 7.2;
    car.add(box(6.8, 2.6, 2.5, retroMaterial(`sb_car${c}`, { map: tex('metal'), color: 0xb8bcc2 }), [0, 1.3, 0]));
    car.add(box(6.4, 0.5, 2.52, retroMaterial(`sb_band${c}`, { color: 0x2a5a9a }), [0, 1.9, 0]));
    // windows along the side facing the platform
    for (let w = -2; w <= 2; w++) car.add(box(0.9, 0.6, 0.05, retroMaterial(`sb_win${c}${w}`, { color: 0xffe8a8, emissive: 0.7, unlit: true }), [w * 1.15, 1.55, 1.26]));
    // doors, one per car, that slide
    const doorL = box(0.7, 1.9, 0.06, M.steel, [-0.36, 1.0, 1.28]);
    const doorR = box(0.7, 1.9, 0.06, M.steel, [0.36, 1.0, 1.28]);
    car.add(doorL, doorR);
    car.userData.doors = [doorL, doorR];
    car.add(box(0.14, 0.14, 0.14, retroMaterial(`sb_head${c}`, { color: 0xfff0c0, emissive: 1, unlit: true }), [3.4, 1.2, 1.3]));
    train.add(car);
  }
  const trainLight = new THREE.PointLight(0xffe0a0, 0, 14);
  trainLight.position.set(0, 2.6, 0);
  train.add(trainLight);
  group.add(train);

  // the small life down here
  const rats = [];
  for (let i = 0; i < 5; i++) {
    const rat = new THREE.Group();
    rat.add(box(0.22, 0.13, 0.12, retroMaterial(`sb_rat${i}`, { color: 0x4a4640 }), [0, 0, 0]));
    rat.add(box(0.1, 0.06, 0.1, retroMaterial(`sb_rath${i}`, { color: 0x3a3630 }), [0.15, 0.02, 0]));
    rat.add(box(0.26, 0.02, 0.02, retroMaterial(`sb_ratt${i}`, { color: 0x5a5048 }), [-0.22, 0.02, 0]));
    rat.position.set(-20 + i * 8, 0.07, -2.2 + (i % 2) * 0.6);
    rat.userData = { dir: Math.random() < 0.5 ? -1 : 1, speed: 1.2 + Math.random() * 1.4, panic: 0 };
    group.add(rat);
    rats.push(rat);
  }
  const roaches = [];
  for (let i = 0; i < 8; i++) {
    const bug = box(0.09, 0.03, 0.06, retroMaterial(`sb_bug${i}`, { color: 0x2a2018 }), [-18 + i * 4.2, 0.02, 2.8 - (i % 3) * 0.7]);
    bug.userData = { t: Math.random() * 6 };
    group.add(bug);
    roaches.push(bug);
  }

  const trainState = { x: 70, phase: 'away', t: 14, doors: 0 };
  const station = { docked: false };

  const tick = (gg, dt) => {
    const st = trainState;
    st.t -= dt;
    if (st.phase === 'away' && st.t <= 0) { st.phase = 'in'; st.t = 0; }
    if (st.phase === 'in') {
      st.x += (0 - st.x) * Math.min(1, dt * 0.9) + 6 * dt;
      if (st.x > -1.2 && st.x < 1.2) { st.x = 0; st.phase = 'dock'; st.t = CONFIG.subway.dockSeconds; station.docked = true; }
    } else if (st.phase === 'dock') {
      st.doors = Math.min(1, st.doors + dt * 2);
      if (st.t <= 0) { st.phase = 'out'; station.docked = false; }
    } else if (st.phase === 'out') {
      st.doors = Math.max(0, st.doors - dt * 2);
      st.x -= 7 * dt;
      if (st.x < -70) { st.x = 70; st.phase = 'away'; st.t = CONFIG.subway.everySeconds; }
    }
    train.position.x = st.x;
    train.visible = st.x < 62;
    trainLight.intensity = st.phase === 'dock' ? 1.2 : 0.2;
    for (const car of train.children) {
      if (!car.userData?.doors) continue;
      car.userData.doors[0].position.x = -0.36 - st.doors * 0.66;
      car.userData.doors[1].position.x = 0.36 + st.doors * 0.66;
    }
    // rats run the platform edge and bolt when the train comes in
    const panic = st.phase === 'in' || st.phase === 'dock';
    for (const rat of rats) {
      const u = rat.userData;
      u.speed = panic ? 3.4 : 1.1 + (rat.position.x % 3) * 0.2;
      rat.position.x += u.dir * u.speed * dt;
      if (rat.position.x > 21) { rat.position.x = 21; u.dir = -1; }
      if (rat.position.x < -21) { rat.position.x = -21; u.dir = 1; }
      rat.position.y = 0.07 + Math.abs(Math.sin(gg.world.time * 14 + rat.position.x)) * 0.03;
      rat.rotation.y = u.dir > 0 ? 0 : Math.PI;
    }
    for (const bug of roaches) {
      const u = bug.userData;
      u.t += dt;
      if (u.t > 2.4) { u.t = 0; bug.position.x += (Math.random() - 0.5) * 1.6; bug.position.z += (Math.random() - 0.5) * 0.8; bug.rotation.y += Math.random(); }
    }
  };

  const s = g.state;
  const here = { value: 'street' };
  const interactables = [
    { id: 'sb_board', label: 'Get on the train', sub: 'it goes to Kestrel St, Ashby Ave and Park Slope', x: 0, z: -2.2, radius: 2.4, action: (gg) => {
      if (!station.docked) { gg.toast('The platform is empty. Somewhere in the dark, a train is being a train. Wait for it.', 'info'); return; }
      gg.openModal({
        kicker: 'THE PLATFORM · DOORS OPEN',
        title: 'Where To',
        body: `The doors do that sound they make. A man asleep on the bench does not move. A rat leaves with more purpose than anybody on this platform.\n\nFare: ${money(CONFIG.subway.fare)}.`,
        choices: [
          { label: 'Kestrel St.', sub: 'one stop · the block', effect: () => ride(gg, 'street', 'Kestrel Street') },
          { label: 'Ashby Ave.', sub: 'one stop · the avenue', effect: () => ride(gg, 'avenue', 'Ashby Avenue') },
          { label: 'Park Slope.', sub: 'two stops · brownstones, a thrift, the Basement', effect: () => ride(gg, 'parkslope', 'Park Slope') },
          { label: 'Stay on the platform.', effect: () => {} },
        ],
      });
    } },
    { id: 'sb_west', label: 'Up the stairs · Kestrel St.', sub: 'the block', x: -22.4, z: 0.8, radius: 1.8, action: (gg) => gg.goTo('street', 'subway') },
    { id: 'sb_east', label: 'Up the stairs · Ashby Ave.', sub: 'the avenue', x: 22.4, z: 0.8, radius: 1.8, action: (gg) => gg.goTo('avenue', 'subway') },
    { id: 'sb_booth', label: 'The token booth', sub: 'nobody in it', x: 18, z: 2.6, radius: 1.6, action: (gg) => gg.openModal({ kicker: 'THE PLATFORM', title: 'Token Booth', body: 'The glass has a hole in it the shape of a coin, and a sign that says EXACT FARE, and behind the glass a chair with nobody in it. It has been like this since before you were born, and the trains still come.', choices: [{ label: 'Step back.', effect: () => {} }] }) },
    { id: 'sb_bum', label: 'Talk to the man on the bench', sub: 'he has been here longer than the sign', x: -10, z: 3.0, radius: 1.6, action: (gg) => {
      gg.advance(6);
      bump(gg.state, 'morale', 2);
      gg.openModal({ kicker: 'THE PLATFORM', title: 'The Man On The Bench', body: pick([
        'He does not open his eyes. "You got a quarter for a man who has nowhere to be?" He has asked this before. He will ask it again. The train will come.',
        '"I used to work up there." He points at the ceiling, which is the street. "Now I work down here. Different shift."',
        'He is reading a newspaper from a day nobody remembers. He turns the page at the exact moment the train arrives, every time.',
      ]), choices: [{ label: 'Give him a dollar.', sub: '$1 · +morale', disabled: s.money < 1, effect: () => { gg.spendMoney(1, 'the man on the bench'); bump(gg.state, 'morale', 4); gg.toast('He nods, which is a whole conversation.', 'good'); } }, { label: 'Leave him to it.', effect: () => {} }] });
    } },
  ];

  const ride = (gg, area, name) => {
    const s2 = gg.state;
    if (s2.money < CONFIG.subway.fare) { gg.toast(`The fare is ${money(CONFIG.subway.fare)}. You have ${money(s2.money)}. You could walk, and you know what that costs.`, 'bad'); return; }
    gg.spendMoney(CONFIG.subway.fare, 'subway fare');
    station.docked = false;
    gg.advance(CONFIG.subway.rideMinutes[0] + Math.round(Math.random() * (CONFIG.subway.rideMinutes[1] - CONFIG.subway.rideMinutes[0])));
    gg.fadeOut?.(() => { gg.goTo(area, 'subway'); gg.fadeIn?.(); gg.toast(`You come up out of the ground at ${name}. The city is exactly where you left it.`, 'info'); }, 300);
  };
  void here;

  return {
    group,
    bounds: { minX: -23, maxX: 23, minZ: -3.0, maxZ: 4.3 },
    camBounds: { minX: -26, maxX: 26, minZ: -7, maxZ: 7 },
    solids: [
      solid(18, 3.4, 3.4, 1.3, 2.2), solid(-16, 3.4, 0.8, 0.8, 1.0),
      ...[-20, -15, -10, -5, 0, 5, 10, 15, 20].map((x) => solid(x, 1.6, 0.42, 0.42, 4)),
      ...[-10, 4, 14].map((x) => solid(x, 3.5, 2.4, 0.6, 0.9)),
    ],
    spawn: { x: 21.6, z: 0.8, rot: -Math.PI / 2 },
    spawnFor: (from) => (from === 'avenue' ? { x: 21.6, z: 0.8, rot: -Math.PI / 2 } : from === 'parkslope' ? { x: 0, z: 0.4, rot: 0 } : { x: -21.6, z: 0.8, rot: Math.PI / 2 }),
    npcs: [
      { kind: 'passer_m', x: -10, z: 2.2, rot: 0.2, still: true, act: 'sleep' },
      { kind: 'passer_m2', x: 7.5, z: 3.2, rot: -0.3, still: true },
      { kind: 'w3', x: 12.5, z: 0.4, rot: 2.4, still: true, act: 'wait' },
    ],
    interactables,
    tick,
    ambient: 'street',
    enterToast: 'The Kestrel St station. Warm air, tile, and the sound of something arriving in the dark.',
  };
}

/* ================================================================== PARK SLOPE */

export function buildParkSlope(g) {
  const group = new THREE.Group();
  const L = 40;
  group.add(plane(L, 8, { name: 'ps_sw', map: tex('sidewalk'), repeat: [12, 2] }, [0, 0, -1.6], [-Math.PI / 2, 0, 0]));
  group.add(plane(L, 8, { name: 'ps_road', map: tex('asphalt'), repeat: [12, 2] }, [0, -0.01, 5.2], [-Math.PI / 2, 0, 0]));
  group.add(box(L, 0.16, 0.3, M.concrete, [0, 0.08, 1.4]));
  // brownstones with stoops
  const brown = (x, w, h, col) => {
    group.add(box(w, h, 1.4, retroMaterial(`ps_brown${x}`, { map: tex('brick'), color: col }), [x, h / 2, -6.2]));
    for (let r = 1; r < Math.floor(h / 1.9); r++) for (let c = 0; c < Math.floor(w / 2.3); c++) {
      group.add(plane(1.0, 1.2, { name: 'ps_win', map: tex('window'), emissive: Math.random() < 0.3 ? 0.4 : 0.05, unlit: true }, [x - w / 2 + 1.15 + c * 2.3, 1.5 + r * 1.9, -5.48]));
    }
    group.add(box(1.8, 0.16, 1.4, M.concrete, [x, 0.16, -4.9]));
    group.add(box(1.8, 0.16, 0.3, M.concrete, [x, 0.32, -4.2]));
    group.add(box(0.9, 2.1, 0.14, M.wood, [x, 1.05, -5.45]));
  };
  brown(-14, 7, 9, 0x9a6a52);
  brown(-5, 7, 11, 0x8a5a48);
  brown(9, 8, 8, 0xa8825e);
  brown(18, 6, 10, 0x8e6a54);
  // trees, hydrant, lamp posts
  for (const x of [-10, 2, 14]) {
    group.add(box(0.24, 2.0, 0.24, M.rust, [x, 1.0, -3.2]));
    group.add(box(1.8, 1.1, 1.4, retroMaterial('ps_leaf', { color: 0x2f5a32, emissive: 0.05 }), [x, 2.5, -3.2]));
  }
  group.add(box(0.3, 0.6, 0.3, retroMaterial('ps_hydrant', { color: 0x8a2a26 }), [6, 0.3, 0.6]));
  for (const x of [-18, -8, 6, 16]) { group.add(box(0.1, 4.2, 0.1, M.metal, [x, 2.1, 1.0])); group.add(box(0.5, 0.1, 0.3, M.lamp, [x, 4.2, 0.8])); }
  // the thrift: a window of other people's coats
  group.add(box(4.2, 2.6, 0.14, retroMaterial('ps_thrift', { map: tex('window'), color: 0x2a2a30, emissive: 0.2, unlit: true }), [-9, 1.5, -5.4]));
  group.add(plane(3.6, 0.5, { name: 'ps_thriftsign', map: signTex('signThrift', [{ text: 'SECOND CHANCES', color: '#ffe08a', size: 9 }, { text: 'THRIFT · 2 FOR 1', color: '#c8b070', size: 6 }], { w: 128, h: 32, bg: '#2a2418' }), emissive: 0.8, unlit: true }, [-9, 3.1, -5.32]));
  // diner
  group.add(box(4.4, 2.2, 0.12, retroMaterial('ps_diner', { color: 0x8a2a26, emissive: 0.15 }), [4, 1.4, -5.4]));
  group.add(plane(2.6, 0.4, { name: 'ps_dinersign', map: signTex('signDiner', [{ text: 'SLOPE DINER', color: '#fff0c0', size: 10 }], { w: 96, h: 18, bg: '#5a1a16' }), emissive: 0.9, unlit: true }, [4, 2.7, -5.3]));
  // the stairwell down to the Basement, with a bouncer-shaped shadow
  group.add(box(2.2, 0.2, 1.6, M.concrete, [13, 0.1, -4.4]));
  for (let i = 0; i < 5; i++) group.add(box(2.0, 0.14, 0.3, M.concrete, [13, 0.07 + i * 0.14, -4.4 + i * 0.3]));
  group.add(plane(1.4, 0.4, { name: 'ps_clubsign', map: signTex('signClub', [{ text: 'THE BASEMENT', color: '#ff6a5a', size: 8 }], { w: 128, h: 26, bg: '#1a1414' }), emissive: 0.9, unlit: true }, [13, 2.2, -4.4]));
  // the path to the Marcy Houses, east end
  group.add(box(0.2, 2.6, 0.2, M.metal, [19.6, 1.3, -2.0]));
  group.add(plane(2.2, 0.5, { name: 'ps_mercysign', map: signTex('signMarcy', [{ text: 'MARCY HOUSES', color: '#e8e0c8', size: 8 }, { text: 'NO THROUGH TRAFFIC', color: '#c8a070', size: 5 }], { w: 128, h: 30, bg: '#2a2a26' }), emissive: 0.5, unlit: true }, [19.4, 2.7, -2.0]));

  const s = g.state;
  const interactables = [
    { id: 'ps_subway', label: 'Down to the station', sub: 'the Kestrel St line', x: -17.5, z: 0.6, radius: 1.7, action: (gg) => gg.goTo('subway', 'parkslope') },
    { id: 'ps_thrift', label: 'Second Chances thrift', sub: 'other people\'s clothes, cheap', x: -9, z: -4.6, radius: 1.6, action: (gg) => wardrobeMenu(gg) },
    { id: 'ps_diner', label: 'Slope Diner', sub: 'coffee and a plate · $9', x: 4, z: -4.6, radius: 1.6, action: (gg) => diner(gg) },
    { id: 'ps_club', label: 'Down the stairwell · The Basement', sub: 'fights · cash · one a night', x: 13, z: -3.7, radius: 1.5, action: (gg) => gg.goTo('basement', 'parkslope') },
    { id: 'ps_marcy', label: 'Through the gate · Marcy Houses', sub: 'the projects · do not go in stupid', x: 19.6, z: -1.4, radius: 1.8, action: (gg) => gg.goTo('projects', 'parkslope') },
    { id: 'ps_labor', label: 'Day labor pickup', sub: 'a guy in a van · $45 · 3 hours · once a day', x: -2.5, z: 0.2, radius: 1.5, action: (gg) => dayLabor(gg) },
  ];
  const npcs = [
    { kind: 'passer_m', x: -6, z: 0.2, walker: [-18, 18] },
    { kind: 'w14', x: 8, z: 0.8, walker: [-18, 18] },
    { kind: 'passer_m2', x: 2, z: -2.2, still: true, act: 'smoke' },
    { kind: 'w3', x: -12.5, z: -3.0, rot: 0.6, still: true, act: 'talk' },
    { kind: 'cop', x: 11.5, z: 0.4, walker: [-4, 18] },
    { kind: 'w8', x: 15.5, z: -2.6, rot: -0.4, still: true },
  ];

  const tick = (gg, dt) => {
    void dt;
    if (gg.modalOpen || gg.phoneOpen) return;
    if (Math.random() < 0.0025) {
      gg.toast(pick([
        'A stroller goes past with a dog in it. The dog is wearing a coat. The baby is not.',
        'Somebody is playing a cello badly through an open window, and then well, and then badly again.',
        '"Have a good one," says a man to nobody in particular, and means it.',
        'A car alarm goes off three blocks away and stops like it remembered something.',
      ]), 'info');
    }
  };

  return {
    group,
    bounds: { minX: -20, maxX: 20, minZ: -4.2, maxZ: 1.6 },
    camBounds: { minX: -22, maxX: 22, minZ: -7, maxZ: 9 },
    traffic: { lanes: [{ z: 4.0, dir: 1 }, { z: 6.6, dir: -1 }], x0: -24, x1: 24, rate: [3, 8], bus: 0.05 },
    solids: [
      ...[-14, -5, 9, 18].map((x) => solid(x, -4.9, 3, 1.4, 1.2)),
      ...[[-10, 2], [14, 2]].map(([x]) => solid(x, -3.2, 0.4, 0.4, 2)),
      solid(13, -4.2, 2.2, 1.4, 0.6), solid(-9, -5.2, 4.2, 0.5, 2.4), solid(4, -5.2, 4.4, 0.5, 2.4),
      solid(19.6, -2.0, 0.4, 0.4, 2.4),
    ],
    spawn: { x: -17.5, z: 0.4, rot: -Math.PI / 2 },
    spawnFor: (from) => (from === 'basement' ? { x: 13, z: -3.2, rot: 0 } : from === 'projects' ? { x: 19.0, z: -1.4, rot: -Math.PI / 2 } : from === 'street' ? { x: -17.5, z: 0.4, rot: -Math.PI / 2 } : { x: -17.5, z: 0.4, rot: -Math.PI / 2 }),
    npcs,
    interactables,
    tick,
    ambient: 'street',
    enterToast: 'Park Slope. Somebody waters flowers here on purpose.',
  };
}

/* ---------------------------------------------------------------- Park Slope menus */

function diner(g) {
  const s = g.state;
  const price = 9;
  if (s.money < price) { g.toast('Nine dollars for a plate. You have less than a plate.', 'bad'); return; }
  g.openModal({
    kicker: 'PARK SLOPE · SLOPE DINER', title: 'Counter',
    body: 'A man in an apron is doing three things at once and none of them to you. The special is on a card that has been rewritten so many times the paper is soft.',
    choices: [
      { label: 'Eggs, potatoes, coffee.', sub: `${money(price)} · +hunger, +morale`, effect: () => { g.spendMoney(price, 'Slope Diner'); g.advance(30); bump(s, 'hunger', 34); bump(s, 'morale', 7); bump(s, 'energy', 12); g.audio.sfx('eat'); g.toast('The potatoes have something on them that is not salt and he will not say what.', 'good'); } },
      { label: 'Just coffee.', sub: '$2 · +energy', disabled: s.money < 2, effect: () => { g.spendMoney(2, 'Slope Diner coffee'); g.advance(12); bump(s, 'energy', 10); g.toast('It is good coffee. That is the whole review.', 'good'); } },
      { label: 'Look at the card and leave.', effect: () => {} },
    ],
  });
}

function dayLabor(g) {
  const s = g.state;
  if (!s.labor) s.labor = { lastDay: 0 };
  const day = dayOf(s.clock.m);
  if (s.labor.lastDay === day) { g.toast('The van is gone. It came at six, it left at six-fifteen, and it will do it again tomorrow.', 'info'); return; }
  if (minuteOfDay(s.clock.m) < 7 * 60) { g.toast('Nobody is here yet. The van comes at seven and does not wait.', 'info'); return; }
  g.openModal({
    kicker: 'PARK SLOPE · A VAN WITH NO WINDOWS', title: 'Work Today?',
    body: 'A man leans out of the passenger side with a clipboard he is not reading. "Three hours. Forty-five. You get in the back, you don\'t ask where, you carry what I say."',
    choices: [
      { label: 'Get in the van.', sub: '$45 · 3 hours · energy', effect: () => {
        s.labor.lastDay = day;
        g.advance(180);
        bump(s, 'energy', -28); bump(s, 'hygiene', -14); bump(s, 'stress', 8);
        g.earnMoney(45, 'day labor');
        logLine(g, 'Three hours of somebody else\'s furniture for $45.', 'info');
        g.toast('Three hours. A dresser, a couch, a thing under a sheet that nobody explained. He counted out forty-five in a stairwell.', 'good');
      } },
      { label: 'Not today.', effect: () => {} },
    ],
  });
}

function wardrobeMenu(g) {
  const s = g.state;
  const w = wardrobe.wardrobeState(s);
  const rows = (CONFIG.outfits || []).map((o) => {
    const has = w.owned.includes(o.id);
    return `<div class="kv"><span>${o.name}</span><b>${has ? (w.worn === o.id ? 'WORN' : 'OWNED') : money(o.price)}</b></div>`;
  }).join('');
  g.openModal({
    kicker: 'PARK SLOPE · SECOND CHANCES', title: 'Other People\'s Clothes',
    html: `<div class="tiny mono-dim">Everything here has been worn by somebody with a different life. The rack smells like cedar and someone else's laundry.</div>${rows}<div class="tiny mono-dim">The face and the hair are yours. That is not for sale.</div>`,
    choices: [
      ...(CONFIG.outfits || []).filter((o) => !w.owned.includes(o.id)).slice(0, 3).map((o) => ({
        label: `Buy the ${o.name}.`, sub: money(o.price), disabled: s.money < o.price,
        effect: () => { const r = wardrobe.buy(g, o.id); if (r.ok) g.toast(`The ${o.name} is yours. Try it on at home, or right here, nobody is watching.`, 'good'); },
      })),
      ...(w.owned.length ? [{ label: 'Change into something you own.', sub: `${w.owned.length} pieces`, effect: () => closetMenu(g) }] : []),
      { label: 'Leave the rack alone.', effect: () => {} },
    ],
  });
}

export function closetMenu(g) {
  const w = wardrobe.wardrobeState(g.state);
  const defs = wardrobe.owned(g.state);
  g.openModal({
    kicker: 'UNIT 3B · THE CLOSET', title: 'What To Wear',
    body: 'A rail, four hangers, and a shelf with nothing on it. The mirror is a poster of a mirror.',
    choices: [
      ...defs.slice(0, 5).map((o) => ({
        label: `Wear the ${o.name}.`, sub: w.worn === o.id ? 'already on' : '', disabled: w.worn === o.id,
        effect: () => wardrobe.wear(g, o.id),
      })),
      { label: 'Close the closet.', effect: () => {} },
    ],
  });
}

/* ================================================================== THE BASEMENT */

export function buildBasement(g) {
  const group = new THREE.Group();
  group.add(plane(16, 12, { name: 'bs_floor', map: tex('concrete'), repeat: [5, 4] }, [0, 0, 0], [-Math.PI / 2, 0, 0]));
  group.add(box(16, 3.6, 0.2, M.brick, [0, 1.8, -6]));
  group.add(box(16, 3.6, 0.2, M.concrete, [0, 1.8, 6]));
  group.add(box(0.2, 3.6, 12, M.brick, [-8, 1.8, 0]));
  group.add(box(0.2, 3.6, 12, M.brick, [8, 1.8, 0]));
  group.add(plane(16, 12, { name: 'bs_ceil', color: 0x1a1a1e }, [0, 3.5, 0], [Math.PI / 2, 0, 0]));
  // one bulb, one ring
  group.add(box(0.1, 0.7, 0.1, M.metal, [0, 3.2, 0]));
  group.add(box(0.5, 0.16, 0.5, M.dim, [0, 2.8, 0]));
  group.add(box(6.4, 0.5, 6.4, retroMaterial('bs_ring', { map: tex('concrete'), color: 0x9a8a70 }), [0, 0.25, 0.4]));
  for (const z of [-2.6, 3.4]) group.add(box(6.4, 0.7, 0.14, M.rust, [0, 0.85, z]));
  for (const x of [-3.1, 3.1]) group.add(box(0.14, 0.7, 6.4, M.rust, [x, 0.85, 0.4]));
  // crowd, a coat rack, a cash box on a folding table
  group.add(box(2.0, 0.7, 0.8, M.wood, [5.4, 0.35, -3.6]));
  group.add(box(0.5, 0.3, 0.4, M.metal, [5.4, 0.85, -3.6]));
  group.add(box(0.2, 2.0, 0.2, M.metal, [-6.4, 1.0, -3.4]));
  for (let i = 0; i < 3; i++) group.add(box(0.5, 0.8, 0.2, M.cloth, [-6.4 + i * 0.18, 1.6, -3.4]));
  group.add(plane(4.0, 0.6, { name: 'bs_sign', map: signTex('signBasement', [{ text: 'FIGHT NIGHT', color: '#ff6a5a', size: 11 }, { text: 'WINNERS PAID CASH', color: '#e8d8a0', size: 6 }], { w: 128, h: 32, bg: '#141010' }), emissive: 0.85, unlit: true }, [0, 3.0, -5.85]));

  const s = g.state;
  const tick = (gg, dt) => {
    void dt;
    if (gg.modalOpen || gg.phoneOpen || Math.random() > 0.004) return;
    gg.toast(pick(['The crowd makes a sound like weather.', 'Somebody in the back is taking bets in a whisper that carries.', 'The bulb swings a little. Nobody touched it.']), 'info');
  };

  return {
    group,
    bounds: { minX: -7.4, maxX: 7.4, minZ: -5.4, maxZ: 5.4 },
    camBounds: { minX: -8, maxX: 8, minZ: -5.6, maxZ: 5.6 },
    solids: [solid(5.4, -3.6, 2.0, 0.8, 0.9), solid(-6.4, -3.4, 0.4, 0.4, 2.0), solid(0, -2.6, 6.4, 0.16, 1.2), solid(0, 3.4, 6.4, 0.16, 1.2), solid(-3.1, 0.4, 0.16, 6.4, 1.2), solid(3.1, 0.4, 0.16, 6.4, 1.2)],
    spawn: { x: 0, z: 4.6, rot: Math.PI },
    spawnFor: () => ({ x: 0, z: 4.6, rot: Math.PI }),
    npcs: [
      { kind: 'passer_m', x: 5.4, z: -3.9, rot: Math.PI, still: true, act: 'talk' },
      { kind: 'passer_m2', x: -5.6, z: 3.8, rot: -0.6, still: true },
      { kind: 'w0', x: 5.9, z: 3.9, rot: -2.2, still: true },
      { kind: 'w12', x: -5.9, z: 1.4, rot: 1.2, still: true },
    ],
    interactables: [
      { id: 'bs_book', label: 'Talk to the booker', sub: 'one fight a night · cash', x: 5.0, z: -2.9, radius: 1.5, action: (gg) => gg.world?.clubFightMenu?.(gg) },
      { id: 'bs_exit', label: 'Up the stairs', sub: 'back to Park Slope', x: 0, z: 5.1, radius: 1.4, action: (gg) => gg.goTo('parkslope', 'basement') },
      { id: 'bs_watch', label: 'Watch the fights', sub: '20 min · +morale, +stress', x: -6.0, z: 0.6, radius: 1.6, action: (gg) => { gg.advance(20); bump(gg.state, 'morale', 5); bump(gg.state, 'stress', 4); gg.toast('Two men who know each other very well hit each other for twenty minutes. Nobody in the crowd looks away.', 'info'); } },
    ],
    tick,
    ambient: 'street',
    enterToast: 'The Basement. It smells like wet concrete and other people\'s effort.',
  };
  void s;
}

/* ================================================================== MARCY HOUSES */

export function buildProjects(g) {
  const group = new THREE.Group();
  group.add(plane(24, 16, { name: 'pj_floor', map: tex('concrete'), repeat: [6, 4] }, [0, 0, 0], [-Math.PI / 2, 0, 0]));
  // three towers, close enough to touch
  for (const [x, z, h] of [[-9, -8, 18], [1, -9, 22], [11, -8, 16]]) {
    group.add(box(8, h, 7, retroMaterial(`pj_tower${x}`, { map: tex('brick'), color: 0x8a6a58 }), [x, h / 2, z]));
    for (let r = 1; r < h / 2.4; r++) for (let c = 0; c < 3; c++) {
      group.add(plane(0.9, 1.0, { name: 'pj_win', map: tex('window'), emissive: Math.random() < 0.25 ? 0.35 : 0.04, unlit: true }, [x - 2.4 + c * 2.4, 1.0 + r * 2.4, z + 3.55]));
    }
  }
  // the courtyard: benches, a broken hoop, a mural nobody asked the city about
  group.add(plane(6, 3, { name: 'pj_mural', map: signTex('signMural', [{ text: 'WE', color: '#e8c060', size: 22 }, { text: 'ARE', color: '#d84a3a', size: 22 }, { text: 'STILL', color: '#e8c060', size: 22 }, { text: 'HERE', color: '#d84a3a', size: 22 }], { w: 128, h: 96, bg: '#2a2a30' }), emissive: 0.3, unlit: true }, [0, 2.2, -5.2]));
  group.add(box(0.15, 3.2, 0.15, M.metal, [6.5, 1.6, 1.2]));
  group.add(box(1.0, 0.08, 1.2, retroMaterial('pz_hoop', { color: 0xc8552a }), [6.5, 3.0, 0.9]));
  for (const [x, z] of [[-4, 2], [3, 4.5], [-2, 5.2]]) {
    group.add(box(2.2, 0.1, 0.55, M.wood, [x, 0.45, z]));
    group.add(box(2.2, 0.4, 0.08, M.wood, [x - 0.0, 0.68, z - 0.24]));
  }
  group.add(box(0.7, 0.9, 0.7, M.metal, [8.6, 0.45, 4.4]));
  // the east stair back to Park Slope
  for (let i = 0; i < 4; i++) group.add(box(2.0, 0.14, 0.4, M.concrete, [10.6, 0.07 + i * 0.14, 5.9 - i * 0.3]));

  const s = g.state;
  const tick = (gg, dt) => {
    void dt;
    if (gg.modalOpen || gg.phoneOpen || Math.random() > 0.003) return;
    gg.toast(pick([
      'Somewhere upstairs a window closes hard enough to be a statement.',
      'A kid on a bike does a slow circle of the courtyard and leaves without a word.',
      'Two men on a bench are not talking, and it is a conversation anyway.',
      'The mural has been painted over twice and is still legible, which tells you something.',
    ]), 'info');
  };

  return {
    group,
    bounds: { minX: -11, maxX: 11, minZ: -4.8, maxZ: 6.2 },
    camBounds: { minX: -12, maxX: 12, minZ: -6, maxZ: 8 },
    solids: [
      solid(-9, -4.6, 8, 1.2, 3), solid(1, -4.6, 8, 1.2, 3), solid(11, -4.6, 8, 1.2, 3),
      solid(6.5, 1.2, 0.3, 0.3, 3),
      ...[[-4, 2], [3, 4.5], [-2, 5.2]].map(([x, z]) => solid(x, z, 2.2, 0.55, 0.9)),
      solid(8.6, 4.4, 0.7, 0.7, 1.0),
    ],
    spawn: { x: 10.2, z: 5.4, rot: Math.PI },
    spawnFor: () => ({ x: 10.2, z: 5.4, rot: Math.PI }),
    npcs: [
      { kind: 'passer_m', x: -3, z: 3.4, rot: 0.4, still: true },
      { kind: 'thug', x: 2.5, z: -1.5, rot: 2.8, still: true, tough: true, armed: true },
      { kind: 'thug', x: -6, z: 0.6, rot: 1.2, still: true, tough: true },
      { kind: 'dex', x: 7.0, z: 2.2, rot: -2.0, still: true, dealer: true },
      { kind: 'w19', x: -8.5, z: 3.8, rot: 0.9, still: true },
      { kind: 'passer_m2', x: 4.0, z: 5.0, rot: 0.2, still: true },
    ],
    interactables: [
      { id: 'pj_armed', label: 'Approach the man with the gun', sub: 'bad idea · he is not hiding it', x: 2.5, z: -0.6, radius: 1.7, action: (gg) => gg.world?.gunThug?.(gg) },
      { id: 'pj_thug', label: 'Start something with the big one', sub: 'he will fight you · no gun', x: -6, z: 1.4, radius: 1.7, action: (gg) => gg.world?.streetFight?.(gg, { kind: 'thug', name: 'the big one' }) },
      { id: 'pj_dealer', label: 'Buy from the man on the bench', sub: 'strong · cash · no questions', x: 7.0, z: 2.9, radius: 1.5, action: (gg) => projectsDealer(gg) },
      { id: 'pj_exit', label: 'Back through the gate', sub: 'Park Slope', x: 10.6, z: 5.9, radius: 1.6, action: (gg) => gg.goTo('parkslope', 'projects') },
    ],
    tick,
    ambient: 'street',
    enterToast: 'The Marcy Houses. The buildings are the same colour as the sky and about as friendly.',
  };
  void s;
}

function projectsDealer(g) {
  const s = g.state;
  const stock = [
    { id: 'bliss_x', price: 95, line: 'the one in the glass vial, no label, no thanks' },
    { id: 'static_x', price: 78, line: 'the one that makes the room go wide' },
    { id: 'mud_x', price: 62, line: 'the one nobody asks about' },
  ];
  g.openModal({
    kicker: 'MARCY HOUSES · THE BENCH', title: 'The Man With The Bag',
    body: 'He does not look up. "You came all the way over here. So you already know what I have and what it costs. Say a number or say nothing."\n\nHe has the good stuff. The good stuff is not good for you; it is just strong.',
    choices: [
      ...stock.map((it) => ({ label: `${CONFIG.items[it.id]?.name || it.id} — ${money(it.price)}`, sub: it.line, disabled: s.money < it.price, effect: () => {
        if (s.money < it.price) return;
        g.spendMoney(it.price, `Marcy Houses: ${CONFIG.items[it.id]?.name || it.id}`);
        addItem(s, it.id, 1);
        logLine(g, `Bought ${CONFIG.items[it.id]?.name || it.id} at the Marcy Houses for ${money(it.price)}.`, 'bad');
        g.toast('It goes into your pocket in a movement so small it barely happened. He is already looking past you.', 'info');
      } })),
      { label: 'Walk away.', effect: () => {} },
    ],
  });
}
