/**
 * Her place. Stephanie in 1B at 1120, Melanie in 3C at 1104, Diana on the top floor of a Park Slope
 * brownstone. A girlfriend who has not moved in still has a home, and Mo can be asked into it:
 * knock while she is home and, if she likes him enough, she lets him in. A girlfriend who is sure
 * of him gives him a key, and then her couch, her bed and her fridge are somewhere to chill, sleep
 * and eat even when she is out.
 *
 * Each of them has her thing:
 *   Stephanie  gets high with him on her couch (and on his, once she lives there): a scene, like
 *              the bench with Kev. Hers is the only place he can use anything at all.
 *   Melanie    dresses him: clothes off her rack that no store on the block sells.
 *   Diana      takes care of him: dinner, a bath, and an order to lie down; and as a live-in, a
 *              morning that starts better than his used to (systems: herNewDay below).
 *
 * One builder draws all three, styled per tenant; `state.visiting` says whose door he came through.
 */
import * as THREE from '../../vendor/three.module.js';
import { retroMaterial, box, plane } from '../render/retro.js';
import { tex } from '../render/textures.js';
import { CONFIG } from '../core/config.js';
import { bump, logLine, pushMessage } from '../core/state.js';
import { dayOf, minuteOfDay, pick, money } from '../core/util.js';
import * as romance from '../systems/romance.js';
import * as wardrobe from '../systems/wardrobe.js';
import { sleep } from '../systems/needs.js';
import { partnerTarget } from './schedules.js';
import { b1120 } from './hall.js';

const solid = (x, z, w, d, h = 2.4) => ({ x, z, w, d, h });

export const PLACES = {
  stephanie: { unit: '1B', bldg: '1120 KESTREL', back: (g) => { b1120(g.state).floor = 1; g.goTo('hall', 'herplace'); }, title: '1120 Kestrel · 1B · Stephanie\'s' },
  melanie: { unit: '3C', bldg: '1104 KESTREL', back: (g) => { if (g.state.walkup) g.state.walkup.floor = 2; g.goTo('walkup', 'herplace'); }, title: '1104 Kestrel · 3C · Melanie\'s' },
  diana: { unit: 'TOP FLOOR', bldg: '7TH AVE · PARK SLOPE', back: (g) => g.goTo('parkslope', 'herplace'), title: 'Park Slope · Diana\'s' },
};

/** Is she at home right now (by her own day, not the block's)? */
export function isHome(s, id) {
  if (romance.romanceState(s).liveIn === id) return false;
  const row = partnerTarget(id, minuteOfDay(s.clock.m));
  return !!row?.away && /home|asleep/.test(row.note || '');
}
const asleep = (s, id) => /asleep/.test(partnerTarget(id, minuteOfDay(s.clock.m))?.note || '');

/** At her door. */
export function knock(g, id) {
  const s = g.state;
  const p = CONFIG.partners[id];
  const P = PLACES[id];
  const st = romance.partnerState(s, id);
  g.advance(2);
  const kicker = `${P.bldg} · ${P.unit}`;
  if (romance.romanceState(s).liveIn === id) {
    g.openModal({ kicker, title: P.unit, body: `New names on the buzzer. ${p.name} lives with you now; this place is somebody else's problem.`, choices: [{ label: 'Right.', effect: () => {} }] });
    return;
  }
  if (!st.met) {
    g.openModal({ kicker, title: P.unit, body: 'Nobody you know lives here. Yet. The doormat says GO AWAY in a nice font.', choices: [{ label: 'Go away.', effect: () => {} }] });
    return;
  }
  const home = isHome(s, id);
  if (!home) {
    g.openModal({
      kicker, title: P.unit,
      body: `Nobody answers. ${p.name} is out.${st.key ? '\n\nYou have her key on your ring, the one with the little plastic tag she wrote your name on.' : ''}`,
      choices: [
        ...(st.key ? [{ label: 'Let yourself in.', sub: 'her couch · her bed · her fridge', effect: () => enter(g, id, false) }] : []),
        { label: 'Leave.', effect: () => {} },
      ],
    });
    return;
  }
  const invited = st.girlfriend || st.affection >= 55;
  if (!invited) {
    g.openModal({ kicker, title: p.name, body: `The chain stays on. "${pick(['It is late, Mo. Text first.', 'Not tonight. I like you. Not tonight.', 'You cannot just show up at a woman\'s door. Who taught you that?'])}"`, choices: [{ label: 'Fair.', effect: () => bump(s, 'morale', -1) }] });
    return;
  }
  g.openModal({
    kicker, title: p.name,
    body: {
      stephanie: 'She opens the door in a blanket, squinting. "You are lucky I like you." She steps back to let you in, already heading for the couch.',
      melanie: 'She opens the door with a pen behind her ear and a stack of essays under one arm. "You. Come in, take your shoes off, do not touch the plant."',
      diana: 'The door buzzes before you finish knocking. Three flights up she is waiting in the doorway, arms folded, smiling anyway. "You look tired. Get in here."',
    }[id],
    choices: [{ label: 'Go in.', effect: () => enter(g, id, true) }, { label: 'Another time.', effect: () => {} }],
  });
}

function enter(g, id, invited) {
  g.state.visiting = id;
  g.state.visitAwake = invited;
  g.goTo('herplace', id);
}

/** A girlfriend who is sure of him gives him a key; Diana, living with him, looks after him. */
export function herNewDay(g, day) {
  const s = g.state;
  const r = romance.romanceState(s);
  for (const id of Object.keys(PLACES)) {
    const st = romance.partnerState(s, id);
    if (!st.girlfriend || st.key || r.liveIn === id || st.affection < 70 || Math.random() > 0.3) continue;
    st.key = true;
    pushMessage(g, { from: CONFIG.partners[id].name, subject: 'a key', body: {
      stephanie: 'left a key under ur mat. its mine. dont make it weird. the couch is ur couch now too. the cereal is MY cereal',
      melanie: 'There is a key in your mailbox. It is for 3C. It is not a big deal. (It is a big deal.) Water the plant if you are there and I am not.',
      diana: 'I had a key cut for you. Top floor, the brass one. Use it. The fridge is full, the bed is better than yours, and I would rather you were there than wherever you are.',
    }[id] });
    logLine(g, `${CONFIG.partners[id].name} gave you a key.`, 'good');
  }
  // Diana at home with him: the morning is handled
  if (r.liveIn === 'diana') {
    const notes = [];
    if (s.stats.hunger < 70) { bump(s, 'hunger', 25); notes.push('a plate in the oven with a note: EAT THIS'); }
    bump(s, 'stress', -6);
    bump(s, 'morale', 4);
    if (s.stats.hygiene < 40) { bump(s, 'hygiene', 12); notes.push('a clean towel on the bed, folded, pointedly'); }
    if (Math.random() < 0.25) { const cash = 20 + Math.round(Math.random() * 30); g.earnMoney(cash, 'Diana, for the week'); notes.push(`${money(cash)} in an envelope that says "groceries, not anything else"`); }
    if (notes.length) pushMessage(g, { from: 'Diana', subject: 'morning', body: `Left for work. ${notes.join('; ')}. Drink water. I love you. Do not make me say it twice before coffee.` });
  }
}

/* ------------------------------------------------------------------ inside */

const LOOK = {
  stephanie: { wall: 0x4a3a5a, floor: 0x5a4a3a, sofa: 0x7a2a3a, bed: 0x3a2a4a, accent: 0xff7ad8, rug: 0x2a8a8a },
  melanie: { wall: 0xe8e0cc, floor: 0x9a6a42, sofa: 0x5a7a6a, bed: 0xe8e4dc, accent: 0xc8902a, rug: 0xb8503a },
  diana: { wall: 0xf2f0ea, floor: 0x7a4e2e, sofa: 0xd8d2c4, bed: 0xf4f2ee, accent: 0x2a4a6a, rug: 0x8a8a90 },
};

export function buildHerPlace(g, { partnerMenu } = {}) {
  const s = g.state;
  const id = PLACES[s.visiting] ? s.visiting : 'stephanie';
  const L = LOOK[id];
  const p = CONFIG.partners[id];
  const group = new THREE.Group();
  const W = 7, D = 7.5;
  group.add(plane(W, D, { name: `hp_floor_${id}`, map: tex('wood'), color: L.floor, repeat: [3, 3] }, [0, 0, 0], [-Math.PI / 2, 0, 0]));
  group.add(plane(W, D, { name: 'hp_ceil', map: tex('ceiling'), repeat: [2, 2] }, [0, 2.8, 0], [Math.PI / 2, 0, 0]));
  const wall = retroMaterial(`hp_wall_${id}`, { color: L.wall, ambient: 0.6 });
  group.add(box(0.14, 2.8, D, wall, [-W / 2, 1.4, 0]));
  group.add(box(0.14, 2.8, D, wall, [W / 2, 1.4, 0]));
  group.add(box(W, 2.8, 0.14, wall, [0, 1.4, -D / 2]));
  group.add(box(W, 2.8, 0.14, wall, [0, 1.4, D / 2]));
  group.add(box(1.0, 2.2, 0.1, retroMaterial('hp_door', { color: 0x5a3a24 }), [0, 1.1, D / 2 - 0.08]));
  // windows on the back wall, the city behind them
  for (const x of [-1.6, 1.6]) group.add(plane(1.2, 1.2, { name: `hp_win_${id}`, map: tex('window'), emissive: 0.4, unlit: true }, [x, 1.6, -D / 2 + 0.08]));
  // the couch and a rug, a coffee table
  const sofa = retroMaterial(`hp_sofa_${id}`, { color: L.sofa, ambient: 0.65 });
  group.add(box(0.9, 0.42, 2.3, sofa, [-W / 2 + 0.55, 0.21, 1.0]));
  group.add(box(0.22, 0.75, 2.3, sofa, [-W / 2 + 0.2, 0.55, 1.0]));
  for (const z of [-0.1, 2.1]) group.add(box(0.9, 0.6, 0.2, sofa, [-W / 2 + 0.55, 0.42, z]));
  group.add(plane(2.4, 2.0, { name: `hp_rug_${id}`, color: L.rug }, [-1.4, 0.01, 1.0], [-Math.PI / 2, 0, 0]));
  group.add(box(0.7, 0.36, 1.1, retroMaterial('hp_table', { map: tex('wood'), color: 0x8a6a4a }), [-1.6, 0.18, 1.0]));
  // the bed in the corner, the kitchen run along the right wall, a fridge
  const bed = retroMaterial(`hp_bed_${id}`, { color: L.bed, ambient: 0.7 });
  group.add(box(1.6, id === 'stephanie' ? 0.25 : 0.5, 2.1, bed, [-W / 2 + 1.0, id === 'stephanie' ? 0.125 : 0.25, -D / 2 + 1.25]));
  group.add(box(1.6, 0.12, 0.6, retroMaterial('hp_pillow', { color: 0xf8f6f0 }), [-W / 2 + 1.0, id === 'stephanie' ? 0.3 : 0.56, -D / 2 + 0.5]));
  if (id !== 'stephanie') group.add(box(1.7, 1.0, 0.1, retroMaterial(`hp_headboard_${id}`, { color: L.accent }), [-W / 2 + 1.0, 0.8, -D / 2 + 0.15]));
  group.add(box(0.6, 0.9, 3.0, retroMaterial(`hp_counter_${id}`, { color: id === 'diana' ? 0x2a2a2e : 0x8a7a6a }), [W / 2 - 0.35, 0.45, -1.4]));
  group.add(box(0.7, 1.8, 0.7, retroMaterial('hp_fridge', { color: id === 'diana' ? 0xc8ccd0 : 0xe8e6e0 }), [W / 2 - 0.4, 0.9, 0.6]));
  // her things
  if (id === 'stephanie') {
    // string lights, posters, an ashtray that is a whole ecosystem, pizza boxes, a beanbag
    for (let i = 0; i < 12; i++) group.add(box(0.06, 0.06, 0.06, retroMaterial(`hp_light${i % 3}`, { color: [0xff7ad8, 0x7ad8ff, 0xffe07a][i % 3], emissive: 1, unlit: true }), [-W / 2 + 0.12, 2.3 - Math.sin(i / 11 * Math.PI) * 0.25, -D / 2 + 0.6 + i * 0.55]));
    group.add(plane(0.8, 1.1, { name: 'hp_poster1', color: 0xd83a7a, emissive: 0.15 }, [W / 2 - 0.08, 1.7, 2.2], [0, -Math.PI / 2, 0]));
    group.add(box(0.5, 0.06, 0.5, retroMaterial('hp_pizza', { color: 0xc8a06a }), [1.2, 0.03, 2.4]));
    group.add(box(0.5, 0.06, 0.5, retroMaterial('hp_pizza', { color: 0xc8a06a }), [1.25, 0.09, 2.38], [0, 0.3, 0]));
    group.add(box(0.8, 0.5, 0.8, retroMaterial('hp_beanbag', { color: 0x2a8a5a }), [0.6, 0.25, -0.6]));
    group.add(box(0.16, 0.04, 0.16, retroMaterial('hp_ashtray', { color: 0x3a3a3a }), [-1.6, 0.38, 0.8]));
  } else if (id === 'melanie') {
    // a wall of books, plants, a desk with essays, and her clothes rack
    group.add(box(0.35, 2.2, 2.2, retroMaterial('hp_shelf', { map: tex('wood'), color: 0x6a4a30 }), [W / 2 - 0.25, 1.1, 2.4]));
    const spines = [0xa83a2a, 0x2a5a8a, 0xd8b03a, 0x3a7a4a, 0x6a3a6a];
    for (let r = 0; r < 4; r++) for (let c = 0; c < 8; c++) group.add(box(0.22, 0.4, 0.2, retroMaterial(`hp_book${(r + c) % 5}`, { color: spines[(r + c) % 5] }), [W / 2 - 0.3, 0.35 + r * 0.5, 1.5 + c * 0.24]));
    for (const [x, z] of [[1.6, -3.2], [-0.4, -3.2]]) { group.add(box(0.35, 0.4, 0.35, retroMaterial('hp_pot', { color: 0xb8603a }), [x, 0.2, z])); group.add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.4, 0), retroMaterial('hp_leaf', { color: 0x3a7a3a })).translateX(x).translateY(0.7).translateZ(z)); }
    group.add(box(1.2, 0.05, 0.6, retroMaterial('hp_desk', { map: tex('wood'), color: 0xa07a52 }), [0.7, 0.75, -2.9]));
    group.add(box(0.4, 0.06, 0.3, retroMaterial('hp_essays', { color: 0xf4f2ea }), [0.6, 0.8, -2.9]));
    // the rack: a steel rail and a row of garments in colours Mo does not own
    group.add(box(1.6, 0.04, 0.04, retroMaterial('hp_rail', { color: 0x9a9a9a }), [1.7, 1.65, 1.9]));
    for (const [i, c] of [0xb8925a, 0xe8e2d0, 0x1a1a1c, 0xe8dcc0, 0x6a2a3a, 0x2a4a6a].entries()) group.add(box(0.2, 0.9, 0.5, retroMaterial(`hp_garment${i}`, { color: c }), [1.05 + i * 0.26, 1.15, 1.9]));
  } else {
    // exposed brick, art, a big plant, a kitchen island, a reading chair
    group.add(box(0.08, 2.8, D, retroMaterial('hp_brick', { map: tex('brick'), color: 0xd88a6a }), [-W / 2 + 0.1, 1.4, 0]));
    for (const [z, c] of [[0.2, 0x2a4a6a], [1.8, 0xc8902a]]) group.add(plane(1.0, 0.8, { name: `hp_art${c}`, color: c, emissive: 0.1 }, [-W / 2 + 0.16, 1.75, z], [0, Math.PI / 2, 0]));
    group.add(box(1.4, 0.92, 0.7, retroMaterial('hp_island', { color: 0xe8e4dc }), [1.4, 0.46, -1.0]));
    group.add(box(0.5, 0.6, 0.5, retroMaterial('hp_pot', { color: 0x2a2a2e }), [2.9, 0.3, 2.9]));
    group.add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.6, 0), retroMaterial('hp_leaf', { color: 0x4a7a3a })).translateX(2.9).translateY(1.2).translateZ(2.9));
    group.add(box(0.8, 0.8, 0.8, retroMaterial('hp_chair', { color: 0x8a5a3a }), [1.6, 0.4, 2.4]));
  }
  group.add(box(1.2, 0.06, 0.24, retroMaterial('hp_lamp', { color: 0xfff2c4, emissive: 1, unlit: true }), [0, 2.76, 0]));

  // is she here, and awake?
  const here = isHome(s, id) || s.visitAwake;
  const awake = here && (s.visitAwake || !asleep(s, id));
  const npcs = here ? [awake
    ? { kind: id, x: -W / 2 + 0.6, z: 1.6, rot: Math.PI / 2, still: true, pose: 'sit', partner: true, talk: 'hp_her' }
    : { kind: id, x: -W / 2 + 1.0, z: -D / 2 + 1.3, y: id === 'stephanie' ? 0.28 : 0.52, rot: 0, still: true, pose: 'sleep', partner: true }] : [];

  const today = dayOf(s.clock.m);
  const st = romance.partnerState(s, id);
  const interactables = [
    { id: 'hp_out', label: 'Leave', sub: P(id).title, x: 0, z: D / 2 - 0.6, radius: 0.9, action: (gg) => { gg.state.visitAwake = false; PLACES[id].back(gg); } },
    { id: 'hp_couch', label: 'Sit on her couch', sub: '30 min · put your feet up', x: -W / 2 + 1.2, z: 0.4, radius: 0.9, seat: { x: -W / 2 + 0.6, z: 0.4, rot: Math.PI / 2 }, action: (gg) => { gg.advance(30); bump(gg.state, 'stress', -8); bump(gg.state, 'morale', 3); gg.toast(pick(['Her couch is better than yours, which is not saying much, and also it smells like her, which is.', 'You put your feet up. Nobody tells you to take them down. This is what a home is supposed to feel like.']), 'good'); } },
    { id: 'hp_bed', label: 'Sleep in her bed', sub: '7 h', x: -W / 2 + 2.0, z: -D / 2 + 1.3, radius: 0.9, action: (gg) => { sleep(gg, 7); bump(gg.state, 'stress', -6); gg.toast(awake ? 'She pulls the blanket over both of you and is asleep in a minute. You take longer, because you are listening to her breathe.' : 'Her sheets, her pillow, and the city through a window that is not yours. You sleep like a man with a key.', 'good'); } },
    { id: 'hp_fridge', label: 'Her fridge', sub: s.hpFridge?.[id] === today ? 'you already ate today' : 'a real meal', x: W / 2 - 1.0, z: 0.6, radius: 0.9, action: (gg) => {
      gg.state.hpFridge = gg.state.hpFridge || {};
      if (gg.state.hpFridge[id] === today) { gg.toast('You already ate her food today. Leave her the yogurt.', 'info'); return; }
      gg.state.hpFridge[id] = today;
      gg.advance(20);
      bump(gg.state, 'hunger', id === 'diana' ? 48 : id === 'melanie' ? 40 : 26);
      bump(gg.state, 'morale', 3);
      gg.toast({ stephanie: 'Cold pizza, half a burrito, a pickle jar with one pickle. A feast.', melanie: 'Labelled containers. Monday soup. You eat Thursday\'s and she will notice.', diana: 'Leftover roast chicken, rice, greens, and a note on the foil: "for you, obviously".' }[id], 'good');
    } },
    ...(awake ? [{ id: 'hp_her', label: `${p.name}`, sub: { stephanie: 'talk · get high on the couch', melanie: 'talk · let her dress you', diana: 'talk · let her look after you' }[id], x: -W / 2 + 1.25, z: 1.6, radius: 1.0, action: (gg) => herMenu(gg, id, partnerMenu) }] : []),
  ];
  return {
    group,
    bounds: { minX: -W / 2 + 0.3, maxX: W / 2 - 0.3, minZ: -D / 2 + 0.3, maxZ: D / 2 - 0.3 },
    solids: [solid(-W / 2 + 0.5, 1.0, 1.0, 2.4, 0.8), solid(-1.6, 1.0, 0.7, 1.1, 0.4), solid(-W / 2 + 1.0, -D / 2 + 1.25, 1.6, 2.1, 0.6), solid(W / 2 - 0.35, -1.4, 0.6, 3.0, 0.9), solid(W / 2 - 0.4, 0.6, 0.7, 0.7, 1.8),
      ...(id === 'diana' ? [solid(1.4, -1.0, 1.4, 0.7, 0.9), solid(1.6, 2.4, 0.8, 0.8, 0.8)] : []), ...(id === 'melanie' ? [solid(W / 2 - 0.25, 2.4, 0.35, 2.2, 2.2)] : [])],
    seats: [{ x: -W / 2 + 0.6, z: 0.4, rot: Math.PI / 2 }],
    spawn: { x: 0, z: D / 2 - 1.2, rot: Math.PI },
    spawnFor: () => ({ x: 0, z: D / 2 - 1.2, rot: Math.PI }),
    npcs, interactables,
    ambient: 'apartment',
    title: P(id).title,
    enterToast: here ? null : `${p.name} is out. Her place is quiet and yours for now.`,
  };
}
const P = (id) => PLACES[id];

function herMenu(g, id, partnerMenu) {
  const s = g.state;
  const p = CONFIG.partners[id];
  const st = romance.partnerState(s, id);
  const today = dayOf(s.clock.m);
  s.herDay = s.herDay || {};
  const done = s.herDay[id] === today;
  const hobby = {
    stephanie: { label: 'Get high on the couch with her.', sub: done ? 'once a day, she says, like a doctor' : '2 h · the two of you · -stress', effect: () => getHighWithSteph(g, 'herplace') },
    melanie: { label: 'Let her dress you.', sub: done ? 'she is still deciding what is next' : 'something off her rack', effect: () => melanieRack(g) },
    diana: { label: 'Let her take care of you.', sub: done ? 'she already did, and she will again tomorrow' : 'dinner · a bath · lie down', effect: () => dianaCare(g) },
  }[id];
  g.openModal({
    kicker: `${P(id).title.toUpperCase()}`, title: p.name,
    body: { stephanie: 'She is sideways on the couch with her feet in your lap before you sit all the way down. "Hi."', melanie: 'She looks up from the essays. "Give me two minutes, I am telling a fourteen-year-old his thesis is a vibe, not a thesis."', diana: 'She is reading, glasses on, one eyebrow up at you over them. "You ate today? Real food?"' }[id],
    choices: [
      { ...hobby, disabled: done },
      { label: 'Talk.', sub: 'her, the day, the two of you', effect: () => setTimeout(() => partnerMenu?.(g, id), 60) },
      { label: 'Not now.', effect: () => {} },
    ],
  });
}

/** Stephanie, a pipe, the couch: hers, or (living together) his. A scene, like Kev on the bench. */
export function getHighWithSteph(g, where) {
  const s = g.state;
  const W = 7;
  const seat = where === 'herplace' ? { x: -W / 2 + 0.6, z: 0.4, rot: Math.PI / 2 } : { x: -2.85, z: 2.0, rot: Math.PI / 2 };
  const partner = where === 'herplace' ? { x: -W / 2 + 0.6, z: 1.2 } : { x: -2.85, z: 2.8 };
  s.herDay = s.herDay || {};
  s.herDay.stephanie = dayOf(s.clock.m);
  g.world?.couchHigh?.(g, { kind: 'stephanie', seat, partner, done: () => {
    g.advance(120);
    bump(s, 'stress', -26);
    bump(s, 'morale', 12);
    bump(s, 'hunger', -12);
    bump(s, 'addiction', 3);
    bump(s, 'risk', 4);
    s.high.level = Math.max(s.high.level, 60);
    s.high.kind = 'mud';
    s.high.until = Math.max(s.high.until || 0, s.clock.m + 150);
    romance.partnerState(s, 'stephanie').affection = Math.min(100, romance.partnerState(s, 'stephanie').affection + 4);
    logLine(g, 'Got high with Stephanie on the couch.', 'bad');
    g.toast(pick([
      'Two hours of her laughing at the ceiling, you laughing at her laughing, and a long, serious conversation about whether a hot dog is a sandwich. It is not. She is wrong. You love her a little.',
      'She does the voices from the cartoon she grew up on, all of them, and you do not breathe right for ten minutes. The pipe goes cold on the table between you.',
    ]), 'good');
  } });
}

function melanieRack(g) {
  const s = g.state;
  const st = romance.partnerState(s, 'melanie');
  const w = wardrobe.wardrobeState(s);
  const hers = (CONFIG.outfits || []).filter((o) => o.exclusive === 'melanie' && !w.owned.includes(o.id));
  if (!hers.length) { g.toast('"I have nothing left to teach you," she says, and fixes your collar anyway.', 'info'); return; }
  g.openModal({
    kicker: 'MELANIE\'S RACK', title: 'Stand Still',
    body: '"I worked retail for six years before I taught," she says, holding things up against you and squinting. "Nobody on this block sells this. That is the point."',
    choices: [
      ...hers.map((o) => ({ label: o.name, sub: o.note || '', effect: () => {
        s.herDay = s.herDay || {};
        s.herDay.melanie = dayOf(s.clock.m);
        w.owned.push(o.id);
        wardrobe.wear(g, o.id);
        st.affection = Math.min(100, st.affection + 3);
        bump(s, 'morale', 8);
        g.advance(30);
        logLine(g, `Melanie gave you the ${o.name}.`, 'good');
        g.toast(`She steps back and looks. "Yes. Okay. Yes." The ${o.name} is yours. You look like somebody with a plan.`, 'good');
      } })),
      { label: 'Maybe later.', effect: () => {} },
    ],
  });
}

function dianaCare(g) {
  const s = g.state;
  s.herDay = s.herDay || {};
  s.herDay.diana = dayOf(s.clock.m);
  g.advance(90);
  bump(s, 'hunger', 45);
  bump(s, 'hygiene', 40);
  bump(s, 'energy', 20);
  bump(s, 'stress', -22);
  bump(s, 'morale', 10);
  const st = romance.partnerState(s, 'diana');
  st.affection = Math.min(100, st.affection + 3);
  logLine(g, 'Diana took care of you for an evening.', 'good');
  g.toast('Salmon and rice she will not let you help with, a bath she runs too hot on purpose, and then you are on the couch under a blanket with her hand in your hair and an order not to move. You do not move.', 'good');
}
