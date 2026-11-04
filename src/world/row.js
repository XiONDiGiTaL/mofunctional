/**
 * Myrtle Row: the side street between Kestrel and Ashby Avenue. Walk west past the 1104 walk-up
 * and the block turns into it; walk to the far end and it lets out onto the Ave. It is the overhead
 * street the map never drew, and it is where the block eats:
 *
 * The ends are laid out so that walking through is a walk, not a turn back on yourself: both
 * neighbours keep their Myrtle Row corner at their own west end, so the Row's Kestrel end is its
 * east end and its Ashby end is its west end. Come in from Kestrel and you are facing west, down
 * the Row toward Ashby; come in from the Ave and you are facing east, back toward Kestrel.
 *
 *   Sal's Famous     a pizzeria with a window onto the sidewalk: slices, whole pies, sodas, ices
 *   Piraguas         Don Cheo pushes his cart up and down the Row; walk up to him to buy
 *   Irie Grill       Desmond's oil-drum grill under an awning strung with flags: patties, coco
 *                    bread, jerk chicken
 *   The Last Honest Wiener, and Pretzel Palace   two carts, dogs and pretzels
 *   Mendel's Knishes a folding table of boxes
 *   Istanbul Grill   a booth with a döner turning on the spit, kebabs, baklava, tea
 *
 * Plus people: walkers with their hands full (world/crowd.js), a few regulars standing at the stalls
 * eating, and a pair on the stoop. Every stall is an ordinary shop menu (world/shops.js).
 */
import * as THREE from '../../vendor/three.module.js';
import { retroMaterial, box, plane } from '../render/retro.js';
import { tex } from '../render/textures.js';
import { signTex } from '../render/signs.js';
import { minuteOfDay, pick } from '../core/util.js';
import { openShop } from './shops.js';
import { block } from './underground.js';
import { bark } from './crowd.js';
import { shutter, utilityBox } from './walls.js';
import { streetMouth } from './vistas.js';

const solid = (x, z, w, d, h = 2.4) => ({ x, z, w, d, h });
const L = 48;
const M = (n, color, extra = {}) => retroMaterial(`row_${n}`, { color, ...extra });
const sign = (key, lines, w, h, bg, border) => signTex(key, lines, { w, h, bg, border });

export function buildRow(g) {
  const s = g.state;
  const m = minuteOfDay(s.clock.m);
  const open = (a, b) => (a < b ? m >= a * 60 && m < b * 60 : m >= a * 60 || m < b * 60);
  const { group, door } = block('row', [
    { x: -19, w: 9, h: 7, color: 0x7a4a3a },
    { x: -9.5, w: 9, h: 9, color: 0xc8a878, tex: 'brick' },
    { x: 0, w: 9, h: 7, color: 0x5a6a7a },
    { x: 9.5, w: 9, h: 8, color: 0x8a5a3a },
    { x: 19, w: 9, h: 7, color: 0x6a4a5a },
  ], { L });
  const solids = [];
  const interactables = [];
  const npcs = [];

  // the ends: the Ave to the west, Kestrel to the east, a street sign at each
  for (const [x, label] of [[-L / 2 + 1.0, '◀ ASHBY AVE'], [L / 2 - 1.0, 'KESTREL ST ▶']]) {
    group.add(box(0.1, 3.0, 0.1, M('signpole', 0x2a5a3a), [x, 1.5, 0.9]));
    group.add(plane(1.6, 0.34, { name: `row_end${x}`, map: sign(`rowEnd${x}`, [{ text: label, color: '#ffffff', size: 9 }], 96, 20, '#1e6a3a', '#ffffff'), emissive: 0.4, unlit: true }, [x, 2.9, 0.9]));
  }
  interactables.push(
    { id: 'row_west', label: 'On to Ashby Avenue', sub: 'the precinct · the laundromat · the pawn shop', x: -L / 2 + 1.0, z: -1.6, radius: 1.6, action: (gg) => gg.goTo('avenue', 'row') },
    { id: 'row_east', label: 'Back to Kestrel St.', sub: 'past the walk-up · home', x: L / 2 - 1.0, z: -1.6, radius: 1.6, action: (gg) => gg.goTo('street', 'row') },
  );

  // storefronts that are only for looking at
  // closed for the night: the shutters come down, and the shutters are where the paint lives
  for (const [x, a, b] of [[-21, 9, 21], [-2.5, 10, 19], [6.5, 9, 20]]) if (!open(a, b)) shutter(group, x, -6.26, 1.7, 2.4, Math.round(x * 131 + 7) >>> 0);
  solids.push(utilityBox(group, -8.0, 0.65, 4411), utilityBox(group, 9.4, 0.65, 977));
  // each end opens onto the next street: the Ave to the west, Kestrel to the east
  streetMouth(group, { x: -L / 2, dir: -1, look: 'avenue', title: 'ASHBY AVE', sub: "THE PRECINCT · DEE'S WASH · THE PAWN SHOP · LUCIA'S", seed: 31 });
  streetMouth(group, { x: L / 2, dir: 1, look: 'kestrel', title: 'KESTREL ST', sub: 'HOME · THE BODEGA · THE STATION · THE CLINIC', seed: 21 });
  door(-21, '99¢ DREAMS', 'EVERYTHING · SOME THINGS · NOTHING OVER 99¢*', 0x8a2a2a, '#ffe23a', '#2a1a1a');
  door(-2.5, 'BOTANICA LA FE', 'CANDLES · HERBS · SPIRITUAL ADVICE · NOTARY', 0x2a4a3a, '#c8e8a0', '#1a2a1a');
  door(6.5, "JOE'S BARBER", 'NO APPOINTMENT · NO GUARANTEE', 0x2a3a6a, '#ff5a5a', '#14142a');

  /* ---------------------------------------------------- Sal's Famous: the window */
  const salX = -11;
  door(-13.5, "SAL'S FAMOUS", 'PIZZA · SLICES · PIES · ITALIAN ICES', 0x8a1e1e, '#f2e6c8', '#1e6a3a');
  // the order window: a lit opening in the facade with a steel ledge, a stack of boxes, the pies
  group.add(box(2.6, 1.2, 0.1, M('salwin', 0xfff0c0, { emissive: 0.7, unlit: true }), [salX, 1.55, -6.3]));
  group.add(box(2.8, 0.08, 0.5, M('salledge', 0xb8bcc0), [salX, 0.95, -5.6]));
  group.add(box(2.8, 0.95, 0.12, M('salbelow', 0x1e6a3a), [salX, 0.47, -5.45]));
  for (const dx of [-1.4, 1.4]) group.add(box(0.12, 2.3, 0.9, M('salside', 0x8a1e1e), [salX + dx, 1.15, -5.85]));
  group.add(box(2.92, 0.3, 0.9, M('salside', 0x8a1e1e), [salX, 2.15, -5.85]));
  group.add(plane(2.6, 0.3, { name: 'row_salmenu', map: sign('rowSalMenu', [{ text: 'SLICE $3 · PIE $18 · ICES $2.50', color: '#1a1a1a', size: 7 }], 160, 18, '#f2e6c8', '#c81e1e'), emissive: 0.5, unlit: true }, [salX, 2.3, -6.24]));
  for (let i = 0; i < 4; i++) group.add(box(0.42, 0.06, 0.42, M('pizzabox', 0xf2efe4), [salX + 1.0, 1.02 + i * 0.065, -5.6]));
  for (const dx of [-0.8, -0.1]) {
    group.add(new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.03, 14), M('pie', 0xf2c84a)).translateX(salX + dx).translateY(1.0).translateZ(-5.6));
    group.add(new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.02, 14), M('crust', 0xc8823a)).translateX(salX + dx).translateY(0.985).translateZ(-5.6));
  }
  const salOpen = open(10, 2);
  if (salOpen) npcs.push({ kind: 'sal', x: salX + 0.3, z: -6.0, rot: 0, still: true, act: 'talk' });
  else shutter(group, salX, -5.37, 2.9, 2.35, 22311);
  interactables.push({ id: 'row_sal', label: "Sal's window", sub: 'slices · a whole pie · ices · soda', x: salX, z: -4.6, radius: 1.5,
    unavailable: () => (open(10, 2) ? null : 'closed · the window opens at 10'), action: (gg) => openShop(gg, 'pizzeria') });
  solids.push(solid(salX, -5.7, 3.0, 0.8, 1.0));
  // somebody at the window eating a slice, folded, leaning over so it drips on the sidewalk
  if (salOpen) npcs.push({ kind: pick(['passer_m', 'tenant_m', 'w5']), x: salX - 2.1, z: -4.7, rot: Math.PI * 0.9, still: true, act: 'eat' });

  /* ---------------------------------------------------- Irie Grill */
  const jx = -4.5;
  const awning = new THREE.Group();
  for (let i = 0; i < 6; i++) awning.add(box(0.5, 0.06, 2.4, M(`awn${i % 2}`, i % 2 ? 0xf2f2ec : 0x2a8a4a), [-1.25 + i * 0.5, 0, 0]));
  awning.position.set(jx, 2.5, -4.6);
  awning.rotation.x = -0.12;
  group.add(awning);
  for (const [dx, dz] of [[-1.4, -3.5], [1.4, -3.5], [-1.4, -5.8], [1.4, -5.8]]) group.add(box(0.06, 2.5, 0.06, M('awnpole', 0x8a8a8e), [jx + dx, 1.25, dz]));
  // bunting: little flags in green, gold and black along the front
  for (let i = 0; i < 12; i++) {
    const f = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.2, 3), M(`flag${i % 3}`, [0x1e8a3a, 0xf2c81a, 0x141414][i % 3]));
    f.position.set(jx - 1.4 + i * 0.25, 2.25 - Math.sin(i / 11 * Math.PI) * 0.12, -3.45);
    f.rotation.x = Math.PI;
    group.add(f);
  }
  // the drum grill: half an oil drum on legs, coals glowing, chicken on the grate
  group.add(box(1.6, 0.5, 0.7, M('drum', 0x2a2a2e), [jx + 0.3, 0.75, -4.4]));
  const jerkOpen = open(11, 23);
  group.add(box(1.5, 0.04, 0.6, jerkOpen ? M('coals', 0xff6a2a, { emissive: 0.9, unlit: true }) : M('coalsCold', 0x2a2624), [jx + 0.3, 0.98, -4.4]));
  if (jerkOpen) for (let i = 0; i < 8; i++) group.add(box(0.16, 0.06, 0.12, M('jerk', 0x7a3a1a), [jx - 0.3 + (i % 4) * 0.35, 1.04, -4.55 + Math.floor(i / 4) * 0.28]));
  for (const dx of [-0.4, 1.0]) group.add(box(0.06, 0.5, 0.06, M('drumleg', 0x3a3a3e), [jx + dx, 0.25, -4.4]));
  group.add(box(1.0, 0.8, 0.6, M('jtable', 0xe8e4dc), [jx - 1.0, 0.4, -5.4]));
  group.add(box(0.5, 0.4, 0.4, M('pot', 0xc8c8cc), [jx - 1.2, 1.0, -5.4]));
  group.add(plane(2.4, 0.4, { name: 'row_irie', map: sign('rowIrie', [{ text: 'IRIE GRILL', color: '#f2c81a', size: 10 }, { text: 'JERK · PATTIES · COCO BREAD', color: '#ffffff', size: 5 }], 120, 26, '#1e6a2a', '#f2c81a'), emissive: 0.6, unlit: true }, [jx, 2.35, -3.4]));
  if (jerkOpen) npcs.push({ kind: 'jerkman', x: jx + 0.3, z: -5.15, rot: 0, still: true, act: 'grill' });
  else group.add(box(1.7, 0.6, 0.8, M('tarp', 0x2a5a3a), [jx + 0.3, 0.85, -4.4]));
  interactables.push({ id: 'row_jerk', label: 'Irie Grill', sub: 'jerk chicken · beef patties · coco bread', x: jx + 0.3, z: -3.4, radius: 1.5,
    unavailable: () => (open(11, 23) ? null : 'the drum is cold · opens at 11'), action: (gg) => openShop(gg, 'jerk') });
  solids.push(solid(jx + 0.3, -4.4, 1.7, 0.8, 1.0), solid(jx - 1.0, -5.4, 1.0, 0.6, 0.9));

  /* ---------------------------------------------------- carts: dogs, pretzels */
  const cart = (x, z, body, umbrella, label) => {
    const c = new THREE.Group();
    c.add(box(1.4, 0.8, 0.7, M(`cart${body}`, body), [0, 0.6, 0]));
    c.add(box(1.45, 0.06, 0.75, M('cartsteel', 0xb8bcc0), [0, 1.02, 0]));
    c.add(box(0.06, 1.2, 0.06, M('cartsteel', 0xb8bcc0), [0, 1.6, 0]));
    const umb = new THREE.Mesh(new THREE.ConeGeometry(1.0, 0.4, 8), M(`umb${umbrella}`, umbrella));
    umb.position.y = 2.3;
    c.add(umb);
    for (const dx of [-0.55, 0.55]) c.add(new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.06, 10), M('wheel', 0x1a1a1a)).rotateX(Math.PI / 2).translateX(dx).translateY(0.16).translateZ(0.38));
    c.add(plane(1.3, 0.5, { name: `row_cart${label}`, map: sign(`rowCart${label}`, [{ text: label, color: '#ffffff', size: 7 }], 96, 32, '#c81e1e', '#ffe23a'), emissive: 0.4, unlit: true }, [0, 0.62, 0.36]));
    c.position.set(x, 0, z);
    group.add(c);
    solids.push(solid(x, z, 1.5, 0.8, 1.1));
  };
  // the carts never close: Gary and Rosa have the day, Luis and Ray the night
  const dayShift = open(6, 18);
  cart(2.0, -2.2, 0xd8d8dc, 0x2a6ac8, 'THE LAST HONEST WIENER');
  npcs.push({ kind: dayShift ? 'pretzelman' : 'cartnight', x: 2.0, z: -3.0, rot: 0, still: true, act: 'talk' });
  interactables.push({ id: 'row_glizzy', label: 'The Last Honest Wiener', sub: dayShift ? 'hot dogs · pretzels · soda · Gary' : 'hot dogs · pretzels · soda · Luis, nights', x: 2.0, z: -1.2, radius: 1.4, action: (gg) => openShop(gg, open(6, 18) ? 'glizzy' : 'glizzy_night') });
  cart(12.0, -2.2, 0xf2c84a, 0xc81e1e, 'PRETZEL PALACE');
  npcs.push({ kind: dayShift ? 'pretzelwoman' : 'passer_m2', x: 12.0, z: -3.0, rot: 0, still: true, act: 'talk' });
  interactables.push({ id: 'row_pretzel', label: 'Pretzel Palace', sub: dayShift ? 'pretzels, warm, enormous · Rosa' : 'pretzels, warm, enormous · Ray, nights', x: 12.0, z: -1.2, radius: 1.4, action: (gg) => openShop(gg, open(6, 18) ? 'pretzels' : 'pretzels_night') });

  /* ---------------------------------------------------- Mendel's Knishes */
  const kx = 7.0;
  const knishOpen = open(9, 19);
  if (!knishOpen) group.add(box(1.3, 0.9, 0.08, M('ktable', 0xc8a050), [kx + 1.0, 0.45, -6.2], [0, 0, 0.08]));
  if (knishOpen) group.add(box(2.6, 0.06, 0.9, M('ktable', 0xc8a050), [kx, 0.85, -5.3]));
  if (knishOpen) for (const dx of [-1.2, 1.2]) group.add(box(0.06, 0.85, 0.85, M('kleg', 0x8a8a8e), [kx + dx, 0.42, -5.3]));
  if (knishOpen) for (let i = 0; i < 5; i++) {
    group.add(box(0.46, 0.12, 0.6, M('kbox', 0xf4f2ee), [kx - 1.0 + i * 0.5, 0.94, -5.3]));
    for (let j = 0; j < 4; j++) group.add(box(0.1, 0.06, 0.1, M('knish', 0xd8a050), [kx - 1.15 + i * 0.5 + (j % 2) * 0.16, 1.02, -5.45 + Math.floor(j / 2) * 0.22]));
  }
  if (knishOpen) group.add(plane(2.0, 0.3, { name: 'row_mendel', map: sign('rowMendel', [{ text: "MENDEL'S KNISHES", color: '#1a2a6a', size: 9 }], 112, 18, '#f2efe4', '#1a2a6a'), emissive: 0.4, unlit: true }, [kx, 1.3, -4.85]));
  if (knishOpen) npcs.push({ kind: 'hasid', x: kx, z: -6.1, rot: 0, still: true, act: 'talk' });
  interactables.push({ id: 'row_knish', label: "Mendel's Knishes", sub: 'potato · kasha · a better question', x: kx, z: -4.2, radius: 1.4,
    unavailable: () => (open(9, 19) ? null : 'packed up · back tomorrow at 9'), action: (gg) => openShop(gg, 'knish') });
  if (knishOpen) solids.push(solid(kx, -5.3, 2.6, 0.9, 1.0));

  /* ---------------------------------------------------- Istanbul Grill: the döner */
  const tx = 16.5;
  group.add(box(3.0, 2.6, 0.8, M('booth', 0x2a5a9a), [tx, 1.3, -6.0]));
  for (const dx of [-1.45, 1.45]) group.add(box(0.1, 2.6, 1.1, M('booth', 0x2a5a9a), [tx + dx, 1.3, -5.05]));
  group.add(box(3.0, 0.35, 1.1, M('booth', 0x2a5a9a), [tx, 2.43, -5.05]));
  group.add(box(2.6, 1.1, 0.06, M('boothwin', 0xfff0c8, { emissive: 0.5, unlit: true }), [tx, 1.55, -5.58]));
  group.add(box(3.0, 0.08, 0.5, M('boothledge', 0xb8bcc0), [tx, 1.0, -4.5]));
  group.add(box(2.9, 0.95, 0.1, M('booth', 0x2a5a9a), [tx, 0.47, -4.3]));
  group.add(plane(3.0, 0.45, { name: 'row_istanbul', map: sign('rowIstanbul', [{ text: 'ISTANBUL GRILL', color: '#ffffff', size: 10 }, { text: 'DÖNER · KEBAB · BAKLAVA · ÇAY', color: '#ffe23a', size: 5 }], 128, 26, '#c81e1e', '#ffffff'), emissive: 0.7, unlit: true }, [tx, 2.4, -4.48]));
  // the spit: a fat cone of meat on a pole, in front of a glowing element, turning
  const spit = new THREE.Group();
  spit.add(new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.13, 0.75, 9), M('doner', 0xa8682a)));
  spit.add(box(0.03, 1.0, 0.03, M('spitpole', 0xb8bcc0), [0, 0, 0]));
  spit.position.set(tx + 0.85, 1.55, -5.2);
  const turkOpen = open(11, 1);
  if (turkOpen) group.add(spit);
  else shutter(group, tx, -4.22, 3.0, 2.25, 17713);
  group.add(box(0.1, 0.8, 0.4, M('element', 0xff7a2a, { emissive: 1, unlit: true }), [tx + 1.2, 1.55, -5.5]));
  if (turkOpen) npcs.push({ kind: 'doner', x: tx + 0.2, z: -5.0, rot: 0, still: true, act: 'carve' });
  interactables.push({ id: 'row_turk', label: 'Istanbul Grill', sub: 'döner · kebab · baklava · tea', x: tx, z: -3.4, radius: 1.5,
    unavailable: () => (open(11, 1) ? null : 'shutter down · opens at 11'), action: (gg) => openShop(gg, 'turkish') });
  solids.push(solid(tx, -5.2, 3.0, 2.0, 2.6));

  /* ---------------------------------------------------- Don Cheo's piragua cart, on the move */
  const piragua = open(11, 21);
  if (piragua) {
    npcs.push({ kind: 'piraguero', x: -6, z: -1.4, walker: [-18, 18], speed: 0.45, carry: 'pcart', talk: 'row_piragua' });
    interactables.push({ id: 'row_piragua', label: 'Don Cheo, the piragua man', sub: 'shaved ice · coco · tamarindo · frambuesa', x: -6, z: -1.4, radius: 1.6, action: (gg) => openShop(gg, 'piragua') });
  }

  /* ---------------------------------------------------- people */
  const day = m >= 7 * 60 && m < 22 * 60;
  const walkers = day ? ['tenant_f', 'passer_m', 'w3', 'w11', 'passer_m2', 'tenant_m', 'w14', 'hall_m', 'w18', 'viejo'] : ['passer_m', 'w11', 'hall_m'];
  walkers.forEach((kind, i) => npcs.push({ kind, x: -20 + i * 4.2, z: -2.6 - (i % 3) * 0.9, walker: [-22, 22] }));
  if (day) {
    npcs.push({ kind: 'w7', x: -18.5, z: -5.6, rot: 0.6, still: true, act: 'talk' });
    npcs.push({ kind: 'chessman', x: -17.6, z: -5.5, rot: -2.4, still: true, act: 'talk' });
    if (turkOpen) npcs.push({ kind: pick(['w2', 'w16']), x: 14.4, z: -3.6, rot: Math.PI * 0.9, still: true, act: 'eat' });
    if (jerkOpen) npcs.push({ kind: 'tenant_m', x: -3.0, z: -3.0, rot: -0.4, still: true, act: 'eat' });
  }

  // a little life: the spit turns, the grill smokes, vendors call out
  let call = 6;
  const tick = (gg, dt) => {
    spit.rotation.y += dt * 0.8;
    call -= dt;
    if (call > 0) return;
    call = 9 + Math.random() * 10;
    const rigs = gg.world?.npcRigs || [];
    const who = pick(rigs.filter((r) => ['sal', 'jerkman', 'pretzelman', 'doner', 'piraguero', 'hasid'].includes(r.npcDef?.kind)));
    if (!who) return;
    const lines = {
      sal: ['Slices! Hot slices!', 'Fold it, my friend!', 'Ices! Lemon, cherry!'],
      jerkman: ['Jerk chicken! Fresh off the drum!', 'Patties hot hot hot!', 'Coco bread, come get the hug!'],
      pretzelman: ['Dogs! Pretzels! Dogs!', 'Get your pretzel here!', 'Last honest wiener in Brooklyn!'],
      doner: ['Döner! Fresh döner!', 'Baklava! Forty layers!', 'Tea is free if you are polite!'],
      piraguero: ['¡Piragua! ¡Piragua!', 'Coco! Tamarindo! Cold cold!', 'Piragua, the cure for August!'],
      hasid: ['Knishes! Hot knishes!', 'Potato, kasha, who is hungry?', 'A knish is a meal, my friend!'],
    }[who.npcDef.kind];
    bark(who, pick(lines), 2.4);
  };

  return {
    group, title: 'Myrtle Row',
    bounds: { minX: -L / 2 + 0.4, maxX: L / 2 - 0.4, minZ: -5.6, maxZ: 1.3 },
    camBounds: { minX: -L / 2 - 1, maxX: L / 2 + 1, minZ: -5.6, maxZ: 9 },
    solids,
    // in from Kestrel (its east end) facing west down the Row; in from the Ave (west end) facing east
    spawn: { x: L / 2 - 2.2, z: -1.6, rot: -Math.PI / 2 },
    spawnFor: (from) => (from === 'avenue' ? { x: -L / 2 + 2.2, z: -1.6, rot: Math.PI / 2 } : { x: L / 2 - 2.2, z: -1.6, rot: -Math.PI / 2 }),
    npcs, interactables, tick,
    doors: [[-21, -5.6], [-13.5, -5.6], [-2.5, -5.6], [6.5, -5.6]],
    ambient: 'street',
    enterToast: 'Myrtle Row. Smoke off a drum grill, a döner turning, a man shouting "piragua" like it is a prayer.',
  };
}
