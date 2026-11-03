/**
 * Somebody else's apartment, entered with a set of lockpicks. Every unit shares one floor plan
 * (a one-bedroom: the bedroom and its closet up the left, the bath up the right, a laundry nook, the
 * front door on the right, the kitchen island and the living room along the bottom), and every unit
 * is styled by its own seed: the bachelor, the grandmother, the painter, the gamer, the plant
 * person, the neat freak.
 *
 * Who is home is rolled per unit per day (`state.flats[key]`): nobody (most of the time), somebody
 * asleep, somebody who tells him to get out, somebody already dialling 911, somebody who fights, or
 * somebody who could not care less. One unit in 1104 has a man on the floor who is not going to
 * wake up: Mo can go through his pockets, or call it in; once the body is gone he can clean the place
 * out, and if he owns 1104, list it.
 *
 * Nine places to search, once each per unit: some cash, sometimes something worth pawning,
 * occasionally a bag of something, and a lot of things nobody would ever steal.
 */
import * as THREE from '../../vendor/three.module.js';
import { retroMaterial, box, plane } from '../render/retro.js';
import { tex } from '../render/textures.js';
import { CONFIG } from '../core/config.js';
import { bump, addItem, logLine, pushMessage } from '../core/state.js';
import { dayOf, minuteOfDay, pick, money } from '../core/util.js';
import { bark } from './crowd.js';
import { FightMeter } from '../ui/fight.js';
import { removeItem } from '../core/state.js';

const solid = (x, z, w, d, h = 2.4) => ({ x, z, w, d, h });
const W = 7, D = 9;

function rng(seed) {
  let t = seed >>> 0;
  return () => { t = (t + 0x6d2b79f5) >>> 0; let r = Math.imul(t ^ (t >>> 15), 1 | t); r ^= r + Math.imul(r ^ (r >>> 7), 61 | r); return ((r ^ (r >>> 14)) >>> 0) / 4294967296; };
}
const hash = (s) => [...s].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 7);

const STYLES = {
  bachelor: { wall: 0xb8b0a0, floor: 'linoleum', floorCol: 0x9a9080, sofa: 0x3a3a40, bed: 0x2a3a5a, note: 'pizza boxes, a weight bench, one fork' },
  grandma: { wall: 0xe8d8c0, floor: 'wood', floorCol: 0x8a5a3a, sofa: 0xc8a888, bed: 0xe8c8d0, note: 'plastic on the sofa, a saint on every wall' },
  artist: { wall: 0xf2f0ea, floor: 'wood', floorCol: 0x9a6a42, sofa: 0x8a3a3a, bed: 0xe8e2d0, note: 'canvases, turpentine, ambition' },
  gamer: { wall: 0x3a3a4a, floor: 'linoleum', floorCol: 0x5a5a62, sofa: 0x1a1a1e, bed: 0x2a2a3a, note: 'a CRT, three consoles, energy cans' },
  plants: { wall: 0xdce8d8, floor: 'wood', floorCol: 0xa07a52, sofa: 0x5a7a6a, bed: 0xe8e4dc, note: 'a jungle in a one-bedroom' },
  neat: { wall: 0xf4f4f0, floor: 'wood', floorCol: 0xb08a5a, sofa: 0xd8d8d0, bed: 0xf4f4f0, note: 'nothing on any surface, ever' },
};
const KINDS = ['tenant_m', 'tenant_f', 'hall_m', 'hall_f', 'passer_m', 'w3', 'w11', 'w14', 'viejo', 'drifter'];

const FINDS = [
  'a jar of pennies sorted by year, with a note: "1983 IS MISSING"',
  'a binder of signed headshots of a man named Lenny, all signed by Lenny',
  'forty-two ketchup packets and a fork from a restaurant that closed in 1994',
  'a hoodie from an ex, tags still on, with a Post-it that just says "NO"',
  'a VHS tape labelled DO NOT TAPE OVER, taped over',
  'a manual for a microwave they do not own',
  'a framed photo of a dog wearing a different dog as a hat',
  'a lottery ticket that won two dollars in 1997, never cashed, kept as a warning',
  'eleven remote controls and no TV that matches any of them',
  'a notebook of screenplays, all titled "COP DAD"',
  'a wig on a styrofoam head named Brenda (the head is named Brenda)',
  'a bag of bread ties, organised by colour',
];

export function flatsState(s) { return (s.flats = s.flats || {}); }

/** Who is home today in this unit (rolled once a day). */
export function occupant(s, key) {
  const f = flatsState(s)[key] = flatsState(s)[key] || { looted: {} };
  const day = dayOf(s.clock.m);
  if (key === '1104_4D' && !f.bodyGone) return (f.occ = 'dead');
  // after EMS: nobody lives there until somebody cleans it and it is let again
  if (key === '1104_4D' && !f.cleaned) return (f.occ = 'empty');
  if (f.day !== day) {
    f.day = day;
    f.looted = {};
    const m = minuteOfDay(s.clock.m);
    const night = m >= 23 * 60 || m < 7 * 60;
    const r = Math.random();
    f.occ = night ? (r < 0.45 ? 'sleep' : r < 0.6 ? 'leave' : r < 0.7 ? 'cops' : r < 0.78 ? 'fight' : r < 0.85 ? 'chill' : 'empty')
      : (r < 0.5 ? 'empty' : r < 0.6 ? 'sleep' : r < 0.72 ? 'leave' : r < 0.82 ? 'cops' : r < 0.91 ? 'fight' : 'chill');
    f.kind = pick(KINDS);
  }
  return f.occ;
}

export function buildFlat(g) {
  const s = g.state;
  const b = s.breakin || { key: 'x', unit: '?', bldg: '' };
  const r = rng(hash(b.key));
  const styleId = Object.keys(STYLES)[Math.floor(r() * 6)];
  const St = STYLES[styleId];
  const f = flatsState(s)[b.key] || { looted: {} };
  const occ = occupant(s, b.key);
  const group = new THREE.Group();
  const M = (n, c, extra = {}) => retroMaterial(`fl_${n}_${c}`, { color: c, ...extra });

  // the shell
  group.add(plane(W, D, { name: `fl_floor_${styleId}`, map: tex(St.floor), color: St.floorCol, repeat: [3, 4] }, [0, 0, 0], [-Math.PI / 2, 0, 0]));
  group.add(plane(W, D, { name: 'fl_ceil', map: tex('ceiling'), repeat: [2, 2] }, [0, 2.7, 0], [Math.PI / 2, 0, 0]));
  const wall = M('wall', St.wall, { ambient: 0.6 });
  group.add(box(0.12, 2.7, D, wall, [-W / 2, 1.35, 0]));
  group.add(box(0.12, 2.7, D, wall, [W / 2, 1.35, 0]));
  group.add(box(W, 2.7, 0.12, wall, [0, 1.35, -D / 2]));
  group.add(box(W, 2.7, 0.12, wall, [0, 1.35, D / 2]));
  // inside walls: bedroom (top left), bath (top right), with doorways
  group.add(box(3.0, 2.7, 0.1, wall, [-2.0, 1.35, -0.6]));          // bedroom / living, closet behind
  group.add(box(0.1, 2.7, 2.6, wall, [0.2, 1.35, -3.2]));           // bedroom / bath
  group.add(box(1.4, 2.7, 0.1, wall, [0.9, 1.35, -1.9]));           // bath front, left of its door
  group.add(box(1.1, 2.7, 0.1, wall, [2.95, 1.35, -1.9]));          // bath front, right of its door
  // the front door
  group.add(box(0.08, 2.1, 1.0, M('door', 0x5a3a24), [W / 2 - 0.08, 1.05, 1.4]));
  for (const [x, z] of [[-1.6, 2.4], [-1.6, -2.8], [1.8, 2.6]]) group.add(box(0.5, 0.05, 0.5, M('lamp', 0xfff2c4, { emissive: 1, unlit: true }), [x, 2.66, z]));
  // windows down the left wall
  for (const z of [-3.2, 1.6, 3.4]) group.add(plane(1.0, 1.1, { name: 'fl_win', map: tex('window'), emissive: 0.4, unlit: true }, [-W / 2 + 0.07, 1.5, z], [0, Math.PI / 2, 0]));

  // bedroom: bed against the top wall, two nightstands, the closet along the wall below
  group.add(box(1.6, 0.45, 2.0, M('bed', St.bed), [-1.6, 0.23, -3.4]));
  group.add(box(1.6, 0.12, 0.5, M('pillow', 0xf4f2ee), [-1.6, 0.52, -4.15]));
  group.add(box(1.7, 0.9, 0.1, M('headboard', 0x5a3a24), [-1.6, 0.6, -4.42]));
  for (const x of [-2.75, -0.45]) group.add(box(0.45, 0.55, 0.4, M('nightstand', 0x6a4a30), [x, 0.28, -4.2]));
  group.add(box(2.4, 2.2, 0.5, M('closet', 0xd8d0c0), [-1.95, 1.1, -0.9]));
  // bath: toilet, sink, tub along the right wall
  group.add(box(0.45, 0.45, 0.6, M('toilet', 0xf4f4f2), [0.75, 0.23, -4.1]));
  group.add(box(0.6, 0.85, 0.45, M('sink', 0xf4f4f2), [2.0, 0.43, -4.2]));
  group.add(box(0.5, 0.7, 0.04, M('mirror', 0xa8c0c8, { emissive: 0.25 }), [2.0, 1.55, -4.42]));
  group.add(box(0.8, 0.6, 1.8, M('tub', 0xf4f4f2), [3.05, 0.3, -3.3]));
  // laundry nook: the washer and the dryer
  for (const z of [-1.3, -0.4]) { group.add(box(0.7, 0.9, 0.7, M('machine', 0xe8e8e4), [3.1, 0.45, z])); group.add(new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.02, 12), M('machineglass', 0x3a4a5a)).rotateZ(Math.PI / 2).translateX(0.46).translateY(-2.75).translateZ(z)); }
  // living: the sofa facing the TV on the bottom wall, a coffee table
  const sofa = M('sofa', St.sofa, { ambient: 0.65 });
  group.add(box(2.1, 0.42, 0.8, sofa, [-1.9, 0.21, 1.4]));
  group.add(box(2.1, 0.75, 0.2, sofa, [-1.9, 0.55, 1.05]));
  if (styleId === 'grandma') group.add(box(2.15, 0.02, 0.85, M('plastic', 0xe8f4ff, { opacity: 0.4, transparent: true }), [-1.9, 0.43, 1.4]));
  group.add(box(1.0, 0.35, 0.55, M('ctable', 0x5a3a24), [-1.9, 0.18, 2.6]));
  group.add(box(1.4, 0.5, 0.4, M('tvstand', 0x3a2a1e), [-1.9, 0.25, 4.2]));
  group.add(box(styleId === 'gamer' ? 0.8 : 1.0, 0.6, 0.12, M('tv', 0x141416), [-1.9, 0.82, 4.25]));
  // kitchen: the island with a sink, three stools, the stove and a counter on the bottom wall, the fridge
  group.add(box(1.0, 0.9, 2.3, M('island', 0x8a7a6a), [1.05, 0.45, 3.0]));
  group.add(box(1.05, 0.05, 2.35, M('islandtop', 0xe8e4dc), [1.05, 0.92, 3.0]));
  for (const z of [2.2, 3.0, 3.8]) group.add(box(0.35, 0.65, 0.35, M('stool', 0x2a2a2e), [0.25, 0.33, z]));
  group.add(box(1.7, 0.9, 0.6, M('counter', 0x8a7a6a), [2.6, 0.45, 4.15]));
  group.add(box(0.6, 0.06, 0.55, M('stove', 0x1a1a1a), [2.3, 0.93, 4.15]));
  group.add(box(0.7, 1.8, 0.7, M('fridge', 0xe8e8e4), [3.1, 0.9, 3.1]));

  // the style's clutter
  const add = (fn) => fn();
  if (styleId === 'bachelor') add(() => { for (let i = 0; i < 4; i++) group.add(box(0.45, 0.05, 0.45, M('pizzabox', 0xd8c8a0), [-0.4, 0.03 + i * 0.05, 3.6], [0, i * 0.4, 0])); group.add(box(1.2, 0.4, 0.4, M('bench', 0x1a1a1a), [-0.2, 0.2, -2.6])); });
  if (styleId === 'grandma') add(() => { group.add(box(0.25, 0.35, 0.03, M('saint', 0xd8b03a), [-W / 2 + 0.08, 1.7, 0.3], [0, Math.PI / 2, 0])); group.add(box(0.3, 0.25, 0.4, M('cat', 0xc87a3a), [-2.4, 0.55, 1.4])); });
  if (styleId === 'artist') add(() => { for (let i = 0; i < 3; i++) group.add(box(0.7, 0.9, 0.05, M(`canvas${i}`, [0xe84a6a, 0x3a8ae8, 0xf2c81a][i]), [-0.5 + i * 0.25, 0.45, -1.0 + i * 0.1], [0, 0.3, 0.1])); group.add(box(0.05, 1.6, 0.05, M('easel', 0x8a5a3a), [-0.3, 0.8, 0.3])); });
  if (styleId === 'gamer') add(() => { for (let i = 0; i < 6; i++) group.add(box(0.07, 0.14, 0.07, M('can', 0x3ad84a), [-1.6 + i * 0.12, 0.42, 2.6])); group.add(box(0.4, 0.08, 0.3, M('console', 0x2a2a2e), [-1.9, 0.54, 4.1])); });
  if (styleId === 'plants') add(() => { for (const [x, z] of [[-3.0, 0.2], [-0.2, 0.2], [-3.0, 4.0], [-0.2, 4.0], [1.0, 1.4], [-3.0, -2.0]]) { group.add(box(0.35, 0.4, 0.35, M('pot', 0xb8603a), [x, 0.2, z])); group.add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.4, 0), M('leaf', 0x3a7a3a)).translateX(x).translateY(0.75).translateZ(z)); } });

  // who is here
  const npcs = [];
  const kind = f.kind || pick(KINDS);
  if (occ === 'sleep') npcs.push({ kind, x: -1.6, z: -3.5, y: 0.5, rot: 0, still: true, pose: 'sleep' });
  else if (occ === 'dead') npcs.push({ kind: 'fiend', x: -0.6, z: 3.0, y: 0, rot: 1.2, still: true, pose: 'sleep', dead: true });
  else if (occ !== 'empty') npcs.push({ kind, x: -1.6, z: 1.5, rot: Math.PI, still: true, pose: occ === 'chill' ? 'sit' : null, act: occ === 'chill' ? 'watch' : null, flatResident: occ });

  // the places worth a look
  const spots = [
    ['nightstand', 'The nightstand', -2.75, -3.75], ['closet', 'The closet', -1.95, -0.25], ['dresser', 'Under the mattress', -0.5, -3.0],
    ['cabinet', 'The bathroom cabinet', 2.0, -3.7], ['laundry', 'The washer', 2.6, -0.85], ['cushions', 'The sofa cushions', -1.9, 2.0],
    ['drawer', 'The kitchen drawer', 1.75, 2.4], ['fridge', 'The fridge', 2.55, 3.1], ['tv', 'Behind the TV', -1.9, 3.7],
  ];
  const interactables = spots.map(([id, label, x, z]) => ({
    id: `fl_${id}`, label, sub: f.looted?.[id] ? 'already been through it' : 'have a look', x, z, radius: 0.8,
    action: (gg) => search(gg, id),
  }));
  interactables.push({ id: 'fl_out', label: 'Leave', sub: `back out to the ${b.bldgName || 'hall'}`, x: 2.9, z: 1.4, radius: 0.9, action: (gg) => leave(gg) });
  if (occ === 'dead') interactables.push({ id: 'fl_body', label: 'The man on the floor', sub: 'he is not asleep', x: -0.6, z: 3.0, radius: 1.2, action: (gg) => bodyMenu(gg) });
  if (key1104(b.key) && f.bodyGone && !f.cleaned) interactables.push({ id: 'fl_clean', label: 'Clean the place out', sub: `${money(120)} · 3 h · bags, bleach, the window open`, x: -1.0, z: 3.4, radius: 1.2, action: (gg) => cleanOut(gg) });

  // what the resident does about him, once he is through the door
  let t = 0;
  let stage = 0;
  const tick = (gg, dt) => {
    const rig = gg.world?.npcRigs?.find((x) => x.npcDef?.flatResident);
    if (!rig || rig.down || gg.uiBusy) return;
    t += dt;
    const res = rig.npcDef.flatResident;
    if (stage === 0 && t > 0.8) {
      stage = 1;
      rig.root.rotation.y = Math.atan2(gg.world.mo.root.position.x - rig.root.position.x, gg.world.mo.root.position.z - rig.root.position.z);
      if (res === 'leave') bark(rig, pick(['Who the— GET OUT! OUT!', 'Excuse me?! This is my HOME!', 'Get out before I call somebody!']), 3);
      if (res === 'cops') { bark(rig, pick(['I am calling the police. I am calling them RIGHT NOW.', 'Yes, hello, 911? There is a man in my kitchen.']), 3); rig.npcDef.act = 'phone'; }
      if (res === 'chill') bark(rig, pick(['Shoes off. The fridge is not for you.', 'Rent is due Friday, if you are staying.', 'Oh. Hi. The good stuff is not here, man.']), 3);
      if (res === 'fight') {
        bark(rig, pick(['Oh, you picked the WRONG door.', 'You think you can just walk in here?!']), 2.5);
        gg.world.duel?.start(gg, { rig, hp: 3, name: 'the tenant', hit: 9,
          onWin: () => { gg.toast('They go down on their own rug. You have about a minute before the neighbours decide this was loud.', 'bad'); flatsState(gg.state)[b.key].heat = true; },
          onLose: () => { gg.toast('Thrown out of somebody else\'s apartment, by its owner. On the stairs, you reflect.', 'bad'); gg.collapseSequence?.('beaten'); },
          onRun: () => leave(gg) });
      }
    }
    // told to leave and still here: now they call
    if (res === 'leave' && stage === 1 && t > 12) { stage = 2; bark(rig, 'That is it. I am calling the cops.', 3); rig.npcDef.act = 'phone'; flatsState(gg.state)[b.key].heat = true; }
    if (res === 'cops' && stage === 1 && t > 3) { stage = 2; flatsState(gg.state)[b.key].heat = true; }
  };

  return {
    group,
    bounds: { minX: -W / 2 + 0.3, maxX: W / 2 - 0.3, minZ: -D / 2 + 0.3, maxZ: D / 2 - 0.3 },
    solids: [
      solid(-2.0, -0.6, 3.0, 0.15, 2.7), solid(0.2, -3.2, 0.15, 2.6, 2.7), solid(0.9, -1.9, 1.4, 0.15, 2.7), solid(2.95, -1.9, 1.1, 0.15, 2.7),
      solid(-1.6, -3.4, 1.6, 2.0, 0.5), solid(-1.95, -0.9, 2.4, 0.5, 2.2), solid(0.75, -4.1, 0.45, 0.6, 0.5), solid(2.0, -4.2, 0.6, 0.45, 0.9),
      solid(3.05, -3.3, 0.8, 1.8, 0.6), solid(3.1, -0.85, 0.7, 1.6, 0.9), solid(-1.9, 1.3, 2.1, 1.0, 0.6), solid(-1.9, 2.6, 1.0, 0.55, 0.4),
      solid(-1.9, 4.2, 1.4, 0.4, 0.6), solid(1.05, 3.0, 1.0, 2.3, 0.95), solid(2.6, 4.15, 1.7, 0.6, 0.95), solid(3.1, 3.1, 0.7, 0.7, 1.8),
    ],
    spawn: { x: 2.7, z: 1.4, rot: -Math.PI / 2 },
    spawnFor: () => ({ x: 2.7, z: 1.4, rot: -Math.PI / 2 }),
    npcs, interactables, tick,
    ambient: 'apartment',
    title: `${b.bldg || 'Somebody'} · ${b.unit}`,
    enterToast: occ === 'empty' ? `${b.unit}. Nobody home. It smells like ${pick(['fabric softener and regret', 'a candle called "Linen"', 'onions, from a week ago', 'cat, but there is no cat'])}. (${St.note})` : null,
  };
}

const key1104 = (key) => key === '1104_4D';

/* ------------------------------------------------------------------ searching */

function search(g, id) {
  const s = g.state;
  const b = s.breakin;
  const f = flatsState(s)[b.key];
  if (f.looted[id]) { g.toast('You already went through that. It did not get better.', 'info'); return; }
  f.looted[id] = true;
  g.advance(3);
  bump(s, 'risk', 1);
  const r = Math.random();
  const valuables = Object.values(CONFIG.items).filter((x) => x.kind === 'valuable');
  if (id === 'fridge') {
    const food = pick(['beans', 'eggs', 'sandwich', 'ramen', 'pizza_slice', 'soda']);
    if (r < 0.7 && CONFIG.items[food]) { addItem(s, food, 1); g.toast(`${CONFIG.items[food].name}, a jar of something green, and a note on the milk: "THIS IS MEASURED." You take the ${CONFIG.items[food].name.toLowerCase()}.`, 'info'); }
    else g.toast('A lemon. Mustard. Film canisters. Nothing a man would steal and keep his dignity.', 'info');
    return;
  }
  if (r < 0.32) {
    const cash = 3 + Math.round(Math.random() * (id === 'dresser' || id === 'closet' ? 70 : 30));
    g.earnMoney(cash, 'somebody else\'s apartment');
    g.toast(pick([`${money(cash)} folded inside a birthday card from "Aunt Bev". Sorry, Aunt Bev.`, `${money(cash)} in an envelope that says RENT. It is not your rent.`, `${money(cash)} in a coffee can, under a layer of actual coffee.`]), 'bad');
    logLine(g, `Took ${money(cash)} from ${b.unit}.`, 'bad');
  } else if (r < 0.45 && (id === 'closet' || id === 'nightstand' || id === 'dresser' || id === 'tv')) {
    const it = pick(valuables);
    addItem(s, it.id, 1);
    g.toast(`${it.name}. You put it in your jacket. It is heavier than it is.`, 'bad');
    logLine(g, `Took a ${it.name} from ${b.unit}.`, 'bad');
  } else if (r < 0.52 && (id === 'cabinet' || id === 'nightstand')) {
    const sub = pick(['static', 'mud', 'drip']);
    addItem(s, sub, 1);
    g.toast(`A pill bottle with somebody else's name on it, and inside, ${CONFIG.items[sub].name}. Everybody has something.`, 'bad');
  } else {
    bump(s, 'morale', 1);
    g.toast(`Inside: ${pick(FINDS)}. You leave it. Some things are not yours in a deeper way.`, 'info');
  }
}

/* ------------------------------------------------------------------ the man on the floor */

function bodyMenu(g) {
  const s = g.state;
  const f = flatsState(s)['1104_4D'];
  g.openModal({
    kicker: '1104 KESTREL · 4D', title: 'The Man on the Floor',
    body: 'He is on his back between the sofa and the TV, one shoe off. A spoon on the coffee table, a lighter, the rest of it. He is cold. He has been cold a while.\n\nThe TV is on with the sound down. A man on it is selling a mop.',
    choices: [
      { label: 'Go through his pockets.', sub: f.pockets ? 'you already did' : 'he will not mind · you will', disabled: !!f.pockets, effect: () => {
        f.pockets = true;
        const cash = 6 + Math.round(Math.random() * 30);
        g.earnMoney(cash, 'a dead man\'s pockets');
        addItem(s, pick(['drip', 'mud', 'rox']), 1);
        bump(s, 'morale', -8);
        bump(s, 'stress', 6);
        logLine(g, 'Went through a dead man\'s pockets in 4D.', 'bad');
        g.toast(`${money(cash)}, a bus transfer, and what killed him, in a little bag. You take all three. You will think about this.`, 'bad');
      } },
      { label: 'Call 911.', sub: 'it is the right thing · they will ask how you got in', effect: () => {
        f.bodyGone = true;
        bump(s, 'morale', 6);
        bump(s, 'risk', 2);
        g.advance(90);
        logLine(g, 'Called 911 about the man in 4D.', 'good');
        pushMessage(g, { from: 'HECTOR (SUPER, 1104)', subject: '4D', body: '"EMS took him out the back. Nobody knew his name, boss. The cops asked who found him and I said a guy from the block. That is you. You owe me a coffee.\n\nThe place is a mess. Somebody needs to clean it before anybody lives in it again."' });
        g.toast('Two EMTs, a stretcher, a cop with a notebook who asks how the door was open. You say it was open. He writes it down without believing it. When they are gone, 4D is very quiet.', 'info');
        g.world?.loadArea?.('flat', g);
      } },
      { label: 'Leave him.', effect: () => bump(s, 'stress', 4) },
    ],
  });
}

function cleanOut(g) {
  const s = g.state;
  const f = flatsState(s)['1104_4D'];
  if (s.money < 120) { g.toast('Bags, bleach, a rented carpet cleaner: $120. You do not have it.', 'bad'); return; }
  g.spendMoney(120, 'cleaning out 4D');
  g.advance(180);
  bump(s, 'energy', -14);
  bump(s, 'hygiene', -10);
  bump(s, 'morale', 6);
  f.cleaned = true;
  const own = s.market?.properties?.walkup;
  const unit = own?.units?.find((u) => /\(4D\)/.test(u.name));
  if (unit) {
    unit.name = 'New tenant (4D)';
    unit.status = 'paying';
    pushMessage(g, { from: 'HECTOR (SUPER, 1104)', subject: '4D', body: '"You cleaned it yourself? Boss. Okay. I listed it. A nurse from the clinic took it the same afternoon, says the light is good. Rent starts this week."' });
    g.toast('Six bags to the curb, the window open all afternoon, the floor scrubbed twice. It is your building, so it is your unit: Hector lists it and it rents by evening.', 'good');
  } else {
    g.toast('Six bags to the curb, the window open all afternoon, the floor scrubbed twice. It is not your building; Hector thanks you like it is.', 'good');
  }
  g.world?.loadArea?.('flat', g);
}

function leave(g) {
  const b = g.state.breakin;
  if (!b) return;
  g.goTo(b.backArea, 'flat');
}

/** Three pins, set one at a time in the green; three slips and the lock wins (and maybe the picks). */
export function pickLock(g, b) {
  const s = g.state;
  const w = g.world;
  if (!w.fightMeter) w.fightMeter = new FightMeter(document.getElementById('ui') || document.body, g);
  const fight = { hp: 3, over: null };
  let slips = 0;
  w.fightMeter.open({
    hp: 3, title: 'PICK THE LOCK', foe: 'Pins', zone: 0.2,
    onSwing: (landed) => {
      if (landed) fight.hp -= 1;
      else { slips += 1; bump(s, 'stress', 2); }
      if (fight.hp <= 0) fight.over = 'won';
      else if (slips >= 3) fight.over = 'lost';
      return fight;
    },
    done: (res) => {
      if (res === 'won') {
        s.breakin = b;
        g.advance(4);
        bump(s, 'risk', 2);
        logLine(g, `Picked the lock on ${b.unit}.`, 'bad');
        g.goTo('flat', b.backArea);
        return;
      }
      bump(s, 'risk', 2);
      if (Math.random() < 0.25) { removeItem(s, 'lockpicks', 1); g.toast('The tension wrench snaps off inside the lock with a sound like a tiny gunshot. That is the picks gone. Behind the door, a TV goes quiet.', 'bad'); return; }
      g.toast('A pin binds, the pick slips, and something inside the lock goes "tink" in a way that sounds expensive. Behind the door, a TV goes quiet.', 'bad');
    },
  });
}
