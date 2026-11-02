/**
 * Three doors that used to be menus, now rooms you walk into.
 *
 *   buildPawnShop    Ashby Pawn & Gold: glass cases of rings and watches, guitars on the wall,
 *                    televisions stacked to the ceiling, and Benny behind the long case in a shirt
 *                    with palm trees on it. He buys and sells anything but food and drugs.
 *   buildJays        Mr. Jay's, Downtown: racks down the middle, a sneaker wall, folded denim on
 *                    the tables, a mirror, and Jay at the register with a tape round his neck.
 *   buildReliefOffice  the Civic Relief Program's food-credit office: rows of plastic chairs, every
 *                    one of them taken, three windows, and lines that move one person at a time.
 *                    The third window is the one Mo can use, once the people ahead of him are seen.
 */
import * as THREE from '../../vendor/three.module.js';
import { retroMaterial, box, plane } from '../render/retro.js';
import { tex } from '../render/textures.js';
import { signTex } from '../render/signs.js';
import { CONFIG } from '../core/config.js';
import { money, pick, minuteOfDay, dayOf } from '../core/util.js';
import { addItem, removeItem, inventoryList, logLine } from '../core/state.js';
import { createNPC, animateNPC } from './characters.js';
import { recertCRP, applyForCRP } from '../systems/economy.js';

const solid = (x, z, w, d, h = 2.4) => ({ x, z, w, d, h });

/** Four walls, a floor, a ceiling and the front door. */
function room(group, W, D, { floor = 'linoleum', floorColor = 0xffffff, wall = 'wall', wallColor = 0xd8d4c4, H = 3.0, door = 0x3a3a3e } = {}) {
  group.add(plane(W, D, { name: `sf_floor_${floor}${floorColor}`, map: tex(floor), color: floorColor }, [0, 0, 0], [-Math.PI / 2, 0, 0]));
  group.add(plane(W, D, { name: 'sf_ceil', map: tex('ceiling') }, [0, H, 0], [Math.PI / 2, 0, 0]));
  const wm = retroMaterial(`sf_wall_${wall}${wallColor}`, { map: tex(wall), color: wallColor });
  group.add(box(0.16, H, D, wm, [-W / 2, H / 2, 0]));
  group.add(box(0.16, H, D, wm, [W / 2, H / 2, 0]));
  group.add(box(W, H, 0.16, wm, [0, H / 2, -D / 2]));
  group.add(box(W, H, 0.16, wm, [0, H / 2, D / 2]));
  group.add(box(1.2, 2.3, 0.12, retroMaterial(`sf_door${door}`, { color: door }), [0, 1.15, D / 2 - 0.1]));
  group.add(box(0.5, 0.18, 0.05, retroMaterial('sf_exit', { color: 0xff3a2a, emissive: 1.2, unlit: true }), [0, 2.6, D / 2 - 0.12]));
}

const tubes = (group, xs, z0, z1) => { for (const x of xs) group.add(box(0.18, 0.06, z1 - z0, retroMaterial('sf_tube', { color: 0xf2f8ff, emissive: 1.1, unlit: true }), [x, 2.94, (z0 + z1) / 2])); };

/* ================================================================== Ashby Pawn & Gold */

const PAWN_SELLS = ['watch', 'ring', 'necklace', 'guitar', 'tv', 'console', 'jacket', 'tools', 'perfume'];
const sellable = (id) => ['valuable', 'gift'].includes(CONFIG.items[id]?.kind);

function pawnStock(s) {
  if (!s.pawn) s.pawn = {};
  const day = dayOf(s.clock.m);
  if (s.pawn.day !== day) {
    // the cases turn over overnight: five things, whatever came in yesterday
    const ids = [...PAWN_SELLS].sort(() => Math.random() - 0.5).slice(0, 5);
    s.pawn = { day, stock: ids.map((id) => ({ id, price: Math.round((CONFIG.items[id].value || 20) * (1.1 + Math.random() * 0.3)) })) };
  }
  return s.pawn.stock;
}

export function bennyMenu(g) {
  const s = g.state;
  g.openModal({
    kicker: 'ASHBY PAWN & GOLD', title: 'Benny',
    body: '"Buying or selling? Not food. Not anything that came out of a baggie. I got a cousin in the 84th and he visits." He rests both forearms on the glass like he is guarding it with his body, which he is.',
    choices: [
      { label: 'Sell him something.', sub: 'cash today · less than it is worth', effect: () => pawnSell(g) },
      { label: 'Look in the cases.', sub: 'whatever came in yesterday', effect: () => pawnBuy(g) },
      { label: 'Just looking.', sub: '', effect: () => {} },
    ],
  });
}

function pawnSell(g) {
  const s = g.state;
  const goods = inventoryList(s).filter((it) => sellable(it.id));
  const offer = (id) => Math.max(1, Math.round((CONFIG.items[id].value || 0) * 0.45));
  g.openModal({
    kicker: 'ASHBY PAWN & GOLD', title: 'Pawn',
    body: goods.length
      ? 'Benny turns each thing over under the lamp like a doctor reading an X-ray. "Cash today. Less than it\'s worth. That\'s what pawn means."'
      : 'Benny looks at you, then at your empty hands. "Come back with something. Or don\'t. Either way, wipe your feet."',
    choices: [
      ...goods.slice(0, 7).map((it) => ({
        label: `${CONFIG.items[it.id].name} · ${money(offer(it.id))}`, sub: `you have ${it.qty}`,
        effect: () => { removeItem(s, it.id, 1); g.earnMoney(offer(it.id), 'pawned'); g.advance(10); logLine(g, `Pawned ${CONFIG.items[it.id].name}.`, 'info'); g.toast(`Benny counts out ${money(offer(it.id))} in twenties and a five, and puts your ${CONFIG.items[it.id].name.toLowerCase()} in the case with a tag on it before you are out the door.`, 'info'); },
      })),
      { label: 'Never mind.', sub: '', effect: () => {} },
    ],
  });
}

function pawnBuy(g) {
  const s = g.state;
  const stock = pawnStock(s);
  g.openModal({
    kicker: 'ASHBY PAWN & GOLD', title: 'The Cases',
    body: 'Rings on velvet, watches with the tags still tied on, a guitar somebody played once. "Everything is legal," Benny says, which is the kind of thing people only say about things that are not.',
    choices: [
      ...stock.map((row, i) => ({
        label: `${CONFIG.items[row.id].name} · ${money(row.price)}`, sub: row.sold ? 'sold' : 'pawned, never collected',
        disabled: !!row.sold || s.money < row.price,
        effect: () => {
          if (!g.spendMoney(row.price, `Ashby Pawn: ${CONFIG.items[row.id].name}`)) return;
          addItem(s, row.id, 1);
          stock[i].sold = true;
          g.toast(`"Good choice." Benny wraps it in yesterday's Ledger. "No returns. No questions. That's the deal."`, 'good');
        },
      })),
      { label: 'Close the case.', sub: '', effect: () => {} },
    ],
  });
}

export function buildPawnShop(g) {
  const group = new THREE.Group();
  const W = 10, D = 8;
  room(group, W, D, { floor: 'linoleum', floorColor: 0xb8a888, wall: 'wallpaper', wallColor: 0x9aa8a0 });
  tubes(group, [-2.5, 2.5], -3.4, 2.4);
  const glass = retroMaterial('pw_glass', { color: 0xc8e0e8, opacity: 0.32, transparent: true, unlit: true });
  const caseBase = retroMaterial('pw_case', { map: tex('wood'), color: 0x4a3426 });
  const velvet = retroMaterial('pw_velvet', { color: 0x5a1a2a });
  const gold = retroMaterial('pw_gold', { color: 0xe0b23a, emissive: 0.25, ambient: 1 });
  const silver = retroMaterial('pw_silver', { color: 0xd8dce0, emissive: 0.15, ambient: 1 });
  // a display case: wood base, velvet bed, things on it, a glass box over the top
  const showcase = (x, z, w, d, rot = 0) => {
    const c = new THREE.Group();
    c.position.set(x, 0, z);
    c.rotation.y = rot;
    c.add(box(w, 0.85, d, caseBase, [0, 0.42, 0]));
    c.add(box(w - 0.08, 0.02, d - 0.08, velvet, [0, 0.86, 0]));
    for (let i = 0; i < Math.floor(w / 0.32); i++) {
      const px = -w / 2 + 0.22 + i * 0.32;
      if (i % 3 === 0) c.add(new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.012, 4, 10), gold).translateX(px).translateY(0.885).rotateX(Math.PI / 2));
      else if (i % 3 === 1) { c.add(box(0.07, 0.02, 0.1, silver, [px, 0.885, -0.05])); c.add(box(0.03, 0.02, 0.18, retroMaterial('pw_strap', { color: 0x2a2a2a }), [px, 0.88, 0.05])); }
      else c.add(new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.008, 3, 14), gold).translateX(px).translateY(0.874).rotateX(Math.PI / 2));
    }
    c.add(box(w, 0.42, d, glass, [0, 1.08, 0]));
    group.add(c);
  };
  // the long case across the back with Benny behind it, two short ones on the floor
  showcase(0, -1.6, 5.2, 0.7);
  showcase(-3.0, 1.0, 2.0, 0.7, Math.PI / 2);
  showcase(3.0, 1.0, 2.0, 0.7, Math.PI / 2);
  // the wall behind Benny: guitars on hooks, a stack of TVs, a bike hung up, a gold-on-black sign
  for (let i = 0; i < 4; i++) {
    const x = -4.2 + i * 0.7;
    group.add(box(0.36, 0.5, 0.08, retroMaterial(`pw_guitar${i % 2}`, { color: i % 2 ? 0x8a3a1a : 0xd8a24a }), [x, 1.3, -3.85]));
    group.add(box(0.07, 0.65, 0.05, retroMaterial('pw_neck', { color: 0x3a2a1a }), [x, 1.85, -3.85]));
  }
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
    group.add(box(0.7, 0.55, 0.5, retroMaterial('pw_tv', { color: 0x2a2a2a }), [1.9 + c * 0.75, 0.3 + r * 0.57, -3.6]));
    group.add(plane(0.52, 0.38, { name: 'pw_tvscreen', map: tex('static'), emissive: (r + c) % 2 ? 0.6 : 0.1, unlit: true }, [1.9 + c * 0.75, 0.32 + r * 0.57, -3.34]));
  }
  group.add(plane(3.0, 0.6, { name: 'pw_sign', map: signTex('pwInSign', [{ text: 'WE BUY GOLD', color: '#ffd23a', size: 12 }], { w: 128, h: 24, bg: '#0e0e0e', border: '#ffd23a' }), emissive: 1, unlit: true }, [0, 2.45, -3.9]));
  group.add(plane(1.4, 0.8, { name: 'pw_rules', map: signTex('pwRules', [{ text: 'NO FOOD', color: '#c8281e', size: 9 }, { text: 'NO DRUGS', color: '#c8281e', size: 9 }, { text: 'NO STORIES', color: '#1a1a1a', size: 7 }], { w: 64, h: 40, bg: '#f2f0e8', border: '#1a1a1a' }), emissive: 0.2 }, [-W / 2 + 0.1, 1.7, -1.6], [0, Math.PI / 2, 0]));
  group.add(box(1.4, 0.06, 0.6, retroMaterial('pw_bike', { color: 0xc8281e }), [-3.2, 2.5, 1.0]));

  const npcs = [{ kind: 'pawnbroker', x: 0, z: -2.45, rot: 0, still: true, talk: 'pw_benny' }];
  const interactables = [
    { id: 'pw_benny', label: 'Talk to Benny', sub: 'buy · sell · not food, not drugs', x: 0, z: -0.85, radius: 1.3, action: (gg) => bennyMenu(gg) },
    { id: 'pw_caseL', label: 'Look in the case', sub: 'rings · watches · chains', x: -2.3, z: 1.0, radius: 0.9, action: (gg) => pawnBuy(gg) },
    { id: 'pw_caseR', label: 'Look in the case', sub: 'rings · watches · chains', x: 2.3, z: 1.0, radius: 0.9, action: (gg) => pawnBuy(gg) },
    { id: 'pw_exit', label: 'Back out to Ashby Avenue', sub: '', x: 0, z: D / 2 - 0.8, radius: 1.0, action: (gg) => gg.goTo('avenue', 'pawn') },
  ];
  return {
    group,
    bounds: { minX: -W / 2 + 0.3, maxX: W / 2 - 0.3, minZ: -D / 2 + 0.4, maxZ: D / 2 - 0.3 },
    solids: [solid(0, -1.6, 5.3, 0.8, 1.3), solid(-3.0, 1.0, 0.8, 2.1, 1.3), solid(3.0, 1.0, 0.8, 2.1, 1.3), solid(2.65, -3.6, 2.4, 0.6, 1.8)],
    spawn: { x: 0, z: D / 2 - 1.5, rot: Math.PI },
    npcs,
    interactables,
    ambient: 'street',
    title: 'Ashby Pawn & Gold',
    enterToast: 'Ashby Pawn & Gold. Everything in here used to be somebody\'s, and the man behind the glass would like it to be yours.',
  };
}

/* ================================================================== Mr. Jay's */

export function buildJays(g, clothingMenu) {
  const group = new THREE.Group();
  const W = 11, D = 9;
  room(group, W, D, { floor: 'wood', floorColor: 0x8a7a6a, wall: 'wall', wallColor: 0xf2f0e8, door: 0x1a1a1e });
  tubes(group, [-3, 0, 3], -3.8, 3.6);
  const chrome = retroMaterial('jy_chrome', { color: 0xc8ccd0, ambient: 0.9 });
  const clothes = retroMaterial('jy_clothes', { map: tex('clothes'), color: 0xffffff, ambient: 0.8, doubleSide: true });
  const pine = retroMaterial('jy_pine', { map: tex('wood'), color: 0xe8d2a8 });
  // racks: a chrome bar on two uprights with shirts hanging off it, seen as a wall of colours
  const rack = (x, z, len, rot = 0) => {
    const r = new THREE.Group();
    r.position.set(x, 0, z);
    r.rotation.y = rot;
    r.add(box(len, 0.04, 0.04, chrome, [0, 1.45, 0]));
    for (const sx of [-1, 1]) { r.add(box(0.04, 1.45, 0.04, chrome, [sx * len / 2, 0.72, 0])); r.add(box(0.05, 0.04, 0.5, chrome, [sx * len / 2, 0.04, 0])); }
    r.add(plane(len - 0.1, 0.95, clothes, [0, 0.95, 0.05]));
    r.add(plane(len - 0.1, 0.95, clothes, [0, 0.95, -0.05], [0, Math.PI, 0]));
    group.add(r);
  };
  rack(-2.0, -0.6, 2.4); rack(-2.0, 1.4, 2.4); rack(1.4, -0.6, 2.4); rack(1.4, 1.4, 2.4);
  // the sneaker wall down the left side, and a NIKE-style wall sign that is not a NIKE sign
  group.add(plane(6.0, 2.2, { name: 'jy_sneakers', map: tex('sneakers'), color: 0xffffff }, [-W / 2 + 0.1, 1.4, -0.2], [0, Math.PI / 2, 0]));
  group.add(plane(2.4, 0.4, { name: 'jy_kicks', map: signTex('jyKicks', [{ text: 'KICKS · ALL SIZES', color: '#ffffff', size: 9 }], { w: 96, h: 18, bg: '#1a1a1e', border: '#ffd23a' }), emissive: 0.7, unlit: true }, [-W / 2 + 0.1, 2.7, -0.2], [0, Math.PI / 2, 0]));
  // the tables with folded denim and hoodies, the way the photos have them
  for (const [x, z] of [[-3.6, 3.0], [3.4, 3.0]]) {
    group.add(box(1.6, 0.7, 0.8, pine, [x, 0.35, z]));
    for (let i = 0; i < 4; i++) for (let h = 0; h < 3; h++) group.add(box(0.34, 0.06, 0.3, retroMaterial(`jy_fold${(i + h) % 3}`, { color: [0x2a3a6a, 0x3a5a8a, 0x8a2a2a][(i + h) % 3] }), [x - 0.55 + i * 0.37, 0.73 + h * 0.065, z]));
  }
  // shelves of folded shirts on the back wall, a mirror, the register with Jay behind it
  for (let r = 0; r < 4; r++) group.add(box(4.0, 0.04, 0.4, pine, [0.5, 0.7 + r * 0.45, -D / 2 + 0.3]));
  for (let r = 0; r < 4; r++) for (let i = 0; i < 9; i++) group.add(box(0.36, 0.14, 0.3, retroMaterial(`jy_shelf${(r + i) % 5}`, { color: [0xe8e4dc, 0x1a1a1e, 0x8a2a2a, 0x3a5a3a, 0xd8a24a][(r + i) % 5] }), [-1.25 + i * 0.44, 0.8 + r * 0.45, -D / 2 + 0.3]));
  group.add(box(0.06, 1.9, 0.8, retroMaterial('jy_mirror', { color: 0xb8c8d0, emissive: 0.25 }), [W / 2 - 0.1, 1.3, 1.6]));
  group.add(box(1.8, 1.0, 0.7, retroMaterial('jy_counter', { color: 0x1a1a1e }), [3.8, 0.5, -2.6]));
  group.add(box(0.34, 0.24, 0.3, retroMaterial('jy_till', { color: 0x2a2a28 }), [3.6, 1.12, -2.6]));
  group.add(plane(3.6, 0.6, { name: 'jy_sign', map: signTex('jyInSign', [{ text: "MR. JAY'S", color: '#ffd23a', size: 14 }], { w: 128, h: 24, bg: '#1a1a1e', border: '#ffd23a' }), emissive: 1, unlit: true }, [0.5, 2.6, -D / 2 + 0.1]));

  const npcs = [
    { kind: 'shopclerk', x: 3.8, z: -3.3, rot: 0, still: true, talk: 'jy_jay' },
    { kind: pick(['w4', 'w9', 'w14']), x: -0.3, z: 0.4, rot: -1.4, still: true, act: 'fold' },
    { kind: 'passer_m', x: -4.2, z: -1.8, rot: -Math.PI / 2, still: true, act: 'watch' },
  ];
  const menu = (gg) => clothingMenu(gg);
  const interactables = [
    { id: 'jy_jay', label: 'Talk to Jay', sub: 'whole outfits · bagged · wear it out', x: 3.8, z: -1.7, radius: 1.1, action: menu },
    { id: 'jy_rack1', label: 'Go through the rack', sub: 'tees · flannels · hoodies', x: -2.0, z: 0.4, radius: 0.9, action: menu },
    { id: 'jy_rack2', label: 'Go through the rack', sub: 'jackets · tracksuits', x: 1.4, z: 0.4, radius: 0.9, action: menu },
    { id: 'jy_kicks', label: 'The sneaker wall', sub: 'every colour, one of each', x: -4.6, z: -0.2, radius: 1.0, action: menu },
    { id: 'jy_mirror', label: 'Look in the mirror', sub: '', x: 4.6, z: 1.6, radius: 0.8, action: (gg) => gg.toast(pick(['You look like a man who is trying. That is most of it.', 'The mirror is tilted so everybody looks a little taller. Jay says that is not a trick, it is customer service.', 'Under the store lights you look like an ad for yourself.']), 'info') },
    { id: 'jy_exit', label: 'Back out to Fulton St', sub: '', x: 0, z: D / 2 - 0.8, radius: 1.0, action: (gg) => gg.goTo('downtown', 'jays') },
  ];
  return {
    group,
    bounds: { minX: -W / 2 + 0.3, maxX: W / 2 - 0.3, minZ: -D / 2 + 0.6, maxZ: D / 2 - 0.3 },
    solids: [
      solid(-2.0, -0.6, 2.5, 0.5, 1.5), solid(-2.0, 1.4, 2.5, 0.5, 1.5), solid(1.4, -0.6, 2.5, 0.5, 1.5), solid(1.4, 1.4, 2.5, 0.5, 1.5),
      solid(-3.6, 3.0, 1.7, 0.9, 0.9), solid(3.4, 3.0, 1.7, 0.9, 0.9), solid(3.8, -2.6, 1.9, 0.8, 1.0), solid(0.5, -D / 2 + 0.3, 4.1, 0.5, 2.2),
    ],
    spawn: { x: 0, z: D / 2 - 1.5, rot: Math.PI },
    npcs,
    interactables,
    ambient: 'street',
    title: "Mr. Jay's · Downtown",
    enterToast: "Mr. Jay's. The music is loud, the lights are louder, and every shirt in here is looking at you.",
  };
}

/* ================================================================== the relief office */

/**
 * The queues are the room's own rigs, not the world's: each window has a line, the person at the
 * front is seen, walks out past the chairs, and the line shuffles up. Windows one and two never
 * run out of people. Window three is the one the sign says is for recertification, and its line
 * is the one Mo has to wait out.
 */
class Lines {
  constructor(group, windows) {
    this.group = group;
    this.windows = windows.map((w) => ({ ...w, queue: [], timer: 4 + Math.random() * 4 }));
    this.leaving = [];
    this.kinds = ['tenant_f', 'passer_m', 'hall_f', 'drifter', 'w3', 'w8', 'w12', 'w16', 'hall_m', 'homeless', 'passer_m2', 'tenant_m'];
    for (const w of this.windows) for (let i = 0; i < w.start; i++) w.queue.push(this.person(w, i));
    this.serving = 41 + Math.floor(Math.random() * 20);
  }

  person(w, i) {
    const rig = createNPC(pick(this.kinds));
    rig.root.position.set(w.x, 0, w.z + 0.9 + i * 0.8);
    rig.root.rotation.y = Math.PI;
    this.group.add(rig.root);
    return rig;
  }

  update(dt) {
    for (const w of this.windows) {
      // shuffle up to your place in line
      w.queue.forEach((rig, i) => {
        const tz = w.z + 0.9 + i * 0.8;
        const p = rig.root.position;
        const d = tz - p.z;
        const moving = Math.abs(d) > 0.04 || Math.abs(p.x - w.x) > 0.04;
        if (moving) { p.z += Math.sign(d) * Math.min(Math.abs(d), 1.1 * dt); p.x += (w.x - p.x) * Math.min(1, dt * 3); rig.root.rotation.y = Math.PI; }
        animateNPC(rig, dt, { walking: moving });
      });
      w.timer -= dt;
      if (w.timer <= 0 && w.queue.length) {
        w.timer = w.serve * (0.7 + Math.random() * 0.6);
        const done = w.queue.shift();
        this.serving += 1;
        this.leaving.push(done);
        if (w.refill) w.queue.push(this.person(w, w.queue.length + 1));
      }
    }
    // the seen walk out down the middle aisle and are gone
    for (const rig of this.leaving) {
      const p = rig.root.position;
      const tx = 0;
      const dx = tx - p.x;
      if (Math.abs(dx) > 0.1) { p.x += Math.sign(dx) * 1.3 * dt; rig.root.rotation.y = Math.sign(dx) * Math.PI / 2; } else { p.z += 1.3 * dt; rig.root.rotation.y = 0; }
      animateNPC(rig, dt, { walking: true });
      if (p.z > 4.2) { rig.root.visible = false; rig.gone = true; }
    }
    this.leaving = this.leaving.filter((r) => !r.gone);
  }

  ahead(i) { return this.windows[i].queue.length; }
}

export function buildReliefOffice(g) {
  const group = new THREE.Group();
  const W = 12, D = 10;
  room(group, W, D, { floor: 'linoleum', floorColor: 0xc8c8b8, wall: 'wall', wallColor: 0xc8ccd0, door: 0x4a5a6a });
  tubes(group, [-4, 0, 4], -4.4, 4.4);
  // three windows in the back wall: a counter, plexiglass to the ceiling, a slot, a number
  const glass = retroMaterial('rf_glass', { color: 0xc8e0e8, opacity: 0.3, transparent: true, unlit: true });
  const counter = retroMaterial('rf_counter', { color: 0x8a8e92 });
  const windows = [{ x: -3.6, z: -3.7, start: 3, serve: 9, refill: true }, { x: 0, z: -3.7, start: 3, serve: 11, refill: true }, { x: 3.6, z: -3.7, start: 2, serve: 10, refill: false }];
  windows.forEach((w, i) => {
    group.add(box(2.6, 1.05, 0.6, counter, [w.x, 0.52, -3.9]));
    group.add(box(2.6, 1.6, 0.04, glass, [w.x, 1.85, -3.62]));
    group.add(box(0.06, 2.6, 1.3, counter, [w.x - 1.33, 1.3, -4.35]));
    group.add(plane(0.7, 0.36, { name: `rf_win${i}`, map: signTex(`rfWin${i}`, [{ text: `WINDOW ${i + 1}`, color: '#ffffff', size: 8 }], { w: 48, h: 16, bg: i === 2 ? '#2a6a3a' : '#2a3a5a', border: '#ffffff' }), emissive: 0.7, unlit: true }, [w.x, 2.75, -D / 2 + 0.78]));
  });
  group.add(plane(2.2, 0.4, { name: 'rf_recert', map: signTex('rfRecert', [{ text: 'RECERTIFICATION → WINDOW 3', color: '#1a1a1a', size: 7 }], { w: 128, h: 18, bg: '#f2e8a0', border: '#1a1a1a' }), emissive: 0.3 }, [3.6, 2.3, -D / 2 + 0.78]));
  group.add(plane(3.4, 0.5, { name: 'rf_title', map: signTex('rfTitle', [{ text: 'CIVIC RELIEF PROGRAM · FOOD CREDIT', color: '#ffffff', size: 8 }], { w: 160, h: 20, bg: '#2a3a5a', border: '#ffffff' }), emissive: 0.6, unlit: true }, [-W / 2 + 0.1, 2.4, 0], [0, Math.PI / 2, 0]));
  // the number board that never seems to get to yours
  const board = new THREE.Group();
  board.position.set(W / 2 - 0.1, 2.3, -1.0);
  board.rotation.y = -Math.PI / 2;
  group.add(board);
  let boardFor = -1;
  let boardMesh = null;
  const drawBoard = (n) => {
    if (n === boardFor) return;
    boardFor = n;
    if (boardMesh) board.remove(boardMesh);
    boardMesh = plane(1.4, 0.5, { name: `rf_board${n}`, map: signTex(`rfBoard${n}`, [{ text: 'NOW SERVING', color: '#ff5a3a', size: 6 }, { text: String(n), color: '#ff5a3a', size: 12 }], { w: 64, h: 28, bg: '#0e0a08', border: '#5a2a1a' }), emissive: 1, unlit: true });
    board.add(boardMesh);
  };
  // rows of plastic chairs, almost all of them taken
  const chair = retroMaterial('rf_chair', { color: 0x3a6a8a });
  const npcs = [];
  const seatKinds = ['tenant_f', 'w1', 'w6', 'w10', 'hall_f', 'passer_m', 'homeless', 'junkie', 'w15', 'tenant_m', 'drifter', 'w2', 'hall_m', 'w19', 'passer_m2', 'w7'];
  let k = 0;
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 8; c++) {
      if (c === 3 || c === 4) continue; // the aisle down the middle
      const x = -4.6 + c * 1.3 - (c > 4 ? -0.0 : 0);
      const z = 0.6 + r * 1.2;
      group.add(box(0.5, 0.06, 0.48, chair, [x, 0.44, z]));
      group.add(box(0.5, 0.5, 0.06, chair, [x, 0.72, z + 0.22]));
      group.add(box(0.06, 0.44, 0.06, retroMaterial('rf_leg', { color: 0x2a2a2a }), [x, 0.22, z]));
      // kids on laps, kids on the floor between the chairs, an empty seat here and there
      if ((r * 8 + c) % 7 === 5) continue; // an empty seat, here and there
      npcs.push({ kind: seatKinds[k++ % seatKinds.length], x, z: z + 0.04, rot: Math.PI, still: true, pose: 'sit' });
      if ((r + c) % 5 === 0) npcs.push({ kind: 'kid', x: x + 0.45, z: z - 0.1, rot: Math.PI - 0.3, still: true, scale: 0.78, pose: 'ground' });
    }
  }
  // a stroller in the aisle and a woman pacing with a baby on her shoulder
  group.add(box(0.5, 0.6, 0.8, retroMaterial('rf_stroller', { color: 0x2a2a3a }), [-0.3, 0.4, 3.6]));
  npcs.push({ kind: 'w11', x: 4.8, z: 2.0, walker: [3.2, 5.2] });
  // the caseworkers behind the glass
  for (const [x, kind] of [[-3.6, 'caseworker'], [0, 'clerk'], [3.6, 'caseworker']]) {
    npcs.push({ kind, x, z: -4.55, rot: 0, still: true, pose: 'sit' });
    group.add(box(0.45, 0.45, 0.45, retroMaterial('rf_stool', { color: 0x2a2a2a }), [x, 0.22, -4.6]));
  }

  const s = g.state;
  // booked by phone: window 3 is waiting for you, and the line is somebody else's problem today
  if (s.flags?.reliefAppt === dayOf(s.clock.m)) windows[2].start = 0;
  const lines = new Lines(group, windows);
  const interactables = [
    {
      id: 'rf_window3', label: 'Window 3 · recertify', sub: 'ID and lease · originals', x: 3.6, z: -2.75, radius: 0.9,
      unavailable: () => (lines.ahead(2) ? `${lines.ahead(2) === 1 ? 'one person' : `${lines.ahead(2)} people`} ahead of you` : null),
      action: (gg) => gg.openModal({
        kicker: 'CIVIC RELIEF PROGRAM · WINDOW 3', title: s.crp?.active ? 'Recertification' : 'A New Application',
        body: s.crp?.active
          ? '"ID. Lease. Originals." She does not look up until both are on the counter, and then only at them. Behind her, a printer is printing something that is not yours.'
          : '"You are not in the system. That is fine. Everybody starts not in the system." She slides a form under the glass that is four pages long and asks for your mother\'s maiden name twice.',
        choices: [
          s.crp?.active
            ? { label: 'Hand over your ID and lease.', sub: `${CONFIG.economy.crp.recertMinutes} min`, effect: () => recertCRP(gg) }
            : { label: 'Fill in the form and apply.', sub: 'ID and lease · the line was the hard part', effect: () => applyForCRP(gg) },
          { label: 'Never mind.', sub: '', effect: () => {} },
        ],
      }),
    },
    { id: 'rf_window1', label: 'Window 1 · new applications', sub: 'the line is the line', x: -3.6, z: -0.7, radius: 0.9, action: (gg) => gg.openModal({ kicker: 'CIVIC RELIEF PROGRAM', title: 'Window 1', body: 'The line for window 1 is three people deep and goes nowhere fast. A man at the front is explaining, for the third time, that he is not the same person as the man with the same name in Queens.', choices: [{ label: 'Apply in the Pantry app instead.', sub: 'on your phone', effect: () => gg.openPhone?.('pantry') }, { label: 'Leave it.', effect: () => {} }] }) },
    { id: 'rf_exit', label: 'Back out to Fulton St', sub: '', x: 0, z: D / 2 - 0.8, radius: 1.0, action: (gg) => gg.goTo('downtown', 'relief') },
  ];
  const tick = (gg, dt) => {
    lines.update(dt);
    drawBoard(lines.serving);
  };
  drawBoard(lines.serving);
  return {
    group,
    bounds: { minX: -W / 2 + 0.3, maxX: W / 2 - 0.3, minZ: -3.2, maxZ: D / 2 - 0.3 },
    solids: [
      ...windows.map((w) => solid(w.x, -3.9, 2.7, 0.7, 1.1)),
      ...[0, 1, 2].flatMap((r) => [solid(-3.3, 0.6 + r * 1.2, 3.2, 0.6, 0.9), solid(3.3, 0.6 + r * 1.2, 3.2, 0.6, 0.9)]),
      solid(-0.3, 3.6, 0.55, 0.85, 0.7),
    ],
    spawn: { x: 0, z: D / 2 - 1.5, rot: Math.PI },
    npcs,
    interactables,
    tick,
    ambient: 'clinic',
    title: 'Civic Relief Program · Fulton St',
    enterToast: 'The Civic Relief office. Every chair is taken, every child is awake, and the number board is on a different number than yours.',
  };
}
