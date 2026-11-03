/**
 * The block gets bigger.
 *
 *   1104 Kestrel  — the walk-up west of the bodega. A lobby and four floors of narrow hallway:
 *                   a man asleep by the stairs, a couple who have been arguing since 1994,
 *                   Mrs. Petrakis and her soup, Squeak selling out of his coat, Stephanie in 5C,
 *                   and the roof. The stairs take real minutes. It is a place to lose an hour.
 *   The bus       — the stop on Kestrel goes to Ashby Avenue and back (and to the park, which
 *                   you could walk to, and everybody does say that).
 *   Ashby Avenue  — the avenue: people walking somewhere else, a newsstand, a pawn shop, a sax
 *                   player, and Lucia's.
 *   Lucia's       — a red-sauce restaurant with tablecloths: a meal you sit down for, and the
 *                   best date on the list (romance.js activity `lucias`).
 */
import * as music from '../systems/music.js';
import * as THREE from '../../vendor/three.module.js';
import { retroMaterial, box, plane } from '../render/retro.js';
import { tex } from '../render/textures.js';
import { signTex } from '../render/signs.js';
import { CONFIG } from '../core/config.js';
import { money, pick, dayOf, minuteOfDay, randInt } from '../core/util.js';
import { TRACKS } from '../systems/soundtrack.js';
import { playArcade, GAMES } from '../ui/arcade.js';
import { bump, addItem, removeItem, countItem, inventoryList, logLine } from '../core/state.js';
import * as romance from '../systems/romance.js';
import { partnerTarget } from './schedules.js';
import * as market from '../systems/market.js';
import { closedReason } from './hours.js';

import { buildStationEntrance } from './district.js';
const solid = (x, z, w, d, h = 2.4) => ({ x, z, w, d, h });
const M = {
  floor: retroMaterial('pl_floor', { map: tex('linoleum') }),
  tile: retroMaterial('pl_tile', { map: tex('tile') }),
  wall: retroMaterial('pl_wall', { map: tex('wallpaper') }),
  ceiling: retroMaterial('pl_ceil', { map: tex('ceiling') }),
  door: retroMaterial('pl_door', { map: tex('door') }),
  wood: retroMaterial('pl_wood', { map: tex('wood') }),
  metal: retroMaterial('pl_metal', { map: tex('metal') }),
  concrete: retroMaterial('pl_conc', { map: tex('concrete') }),
  sidewalk: retroMaterial('pl_sw', { map: tex('sidewalk') }),
  brick: retroMaterial('pl_brick', { map: tex('brick') }),
  lamp: retroMaterial('pl_lamp', { color: 0xfff2c4, emissive: 1.0, unlit: true }),
  dim: retroMaterial('pl_dim', { color: 0xd8c890, emissive: 0.6, unlit: true }),
  white: retroMaterial('pl_white', { color: 0xe8e6da }),
  red: retroMaterial('pl_red', { color: 0x8a2a26 }),
  cloth: retroMaterial('pl_cloth', { color: 0xe8e2d0 }),
  check: retroMaterial('pl_check', { color: 0xb8322a }),
};

/* ================================================================== 1104 KESTREL */

const FLOOR_NAMES = ['Lobby', '2nd floor', '3rd floor', '4th floor', '5th floor'];

/** Who is where in 1104, floor by floor: the lobby board and the elevator both read this. */
const DIRECTORY = [
  'Lobby · 1A · the mailboxes · somebody asleep under the stairs',
  '2nd · 2A Ray & Denise (arguing, in the hall) · 2B–2D',
  '3rd · 3B Mrs. Petrakis (soup) · 3A, 3C, 3D',
  '4th · 4A Squeak (in the hallway) · 4B–4D',
  '5th · 5C Stephanie · the roof, up the last flight',
];
export const walkupDirectory = () => DIRECTORY.slice();

export function walkupState(s) {
  if (!s.walkup) s.walkup = { floor: 0, knocked: {}, stockDay: 0, stock: {}, soupDay: 0 };
  s.walkup.knocked = s.walkup.knocked || {};
  s.walkup.stock = s.walkup.stock || {};
  return s.walkup;
}

/** Take the stairs: real minutes, a little energy, the next landing. */
function stairs(g, dir) {
  const s = g.state;
  const w = walkupState(s);
  const next = Math.max(0, Math.min(FLOOR_NAMES.length - 1, w.floor + dir));
  if (next === w.floor) return;
  const C = CONFIG.walkup;
  const slow = s.stats.withdrawal > 55 || s.stats.energy < 20 ? 2 : 1;
  g.advance(dir > 0 ? C.stairMinutes * slow : Math.max(1, C.stairMinutes - 1));
  if (dir > 0) bump(s, 'energy', C.stairEnergy * slow);
  w.floor = next;
  g.world?.loadArea('walkup', g, dir > 0 ? 'up' : 'down');
  g.hud?.setPrompt?.(null);
  g.toast(`1104 Kestrel · ${FLOOR_NAMES[next]}.${dir > 0 && slow > 1 ? ' The stairs are winning.' : ''}`, 'info');
}

/** The elevator: pick a floor. It stops where it likes on the way, which costs a minute or two. */
function elevator(g) {
  const s = g.state;
  const w = walkupState(s);
  g.openModal({
    kicker: '1104 KESTREL · THE ELEVATOR',
    title: 'Going Somewhere',
    body: 'A box the size of a phone booth. A sign: CAPACITY 4 PERSONS (2 ADULTS). Somebody has scratched "PRAY" into the brass next to the emergency button.\n\n' + DIRECTORY.join('\n'),
    choices: [
      ...FLOOR_NAMES.map((name, n) => ({
        label: n === w.floor ? `${name} (you are here)` : name,
        sub: n === w.floor ? '' : `${1 + Math.abs(n - w.floor)} min`,
        disabled: n === w.floor,
        effect: () => {
          g.advance(1 + Math.abs(n - w.floor));
          w.floor = n;
          g.world?.loadArea('walkup', g, 'elevator');
          g.hud?.setPrompt?.(null);
          g.toast(n === 0 ? 'The doors open on the lobby after thinking about it.' : `1104 Kestrel · ${name}. The elevator dings once, like it is surprised too.`, 'info');
        },
      })),
      { label: 'Take the stairs instead.', sub: '', effect: () => {} },
    ],
  });
}

/** Behind each door, something. Once per door per day; the rest of the time nobody answers. */
const KNOCKS = [
  { text: 'Nobody answers. A TV is on very loud. A game show. Somebody just won a car.' },
  { text: '"WHO IS IT." You say your name. "WHO." You leave.', morale: -1 },
  { text: 'A dog the size of a sound throws itself at the door. You leave.', stress: 3 },
  { text: 'A man in a robe asks if you are the guy about the couch. You are now. Thirty minutes of stairs later, he gives you $10.', minutes: 30, cash: 10, energy: -8 },
  { text: 'A kid opens the door, looks at you, and closes it. You hear "MA, IT\'S A GUY."' },
  { text: 'A woman asks if you have seen her cat. You have not. She describes the cat for six minutes.', minutes: 6 },
  { text: 'Somebody is cooking something incredible in there. They do not open the door. You stand there smelling it anyway.', morale: 2 },
  { text: 'An old man opens the door, says "Not today, Jehovah," and closes it.' },
];

function knock(g, floor, door) {
  const s = g.state;
  const w = walkupState(s);
  const key = `${floor}${door}`;
  const day = dayOf(s.clock.m);
  if (w.knocked[key] === day) { g.toast(`Nobody comes to ${door} again. Once a day is plenty.`, 'info'); return; }
  w.knocked[key] = day;
  g.advance(3);
  const seed = (day * 31 + key.charCodeAt(0) * 7 + key.charCodeAt(key.length - 1)) % KNOCKS.length;
  const k = KNOCKS[seed];
  if (k.minutes) g.advance(k.minutes);
  if (k.cash) g.earnMoney(k.cash, 'helped move a couch');
  if (k.morale) bump(s, 'morale', k.morale);
  if (k.stress) bump(s, 'stress', k.stress);
  if (k.energy) bump(s, 'energy', k.energy);
  g.openModal({ kicker: `1104 KESTREL · ${door}`, title: 'You Knock', body: k.text, choices: [{ label: 'Okay.', effect: () => {} }] });
}

/** Mrs. Petrakis, 3B: soup, once a day, if you sit and listen. */
function petrakis(g) {
  const s = g.state;
  const w = walkupState(s);
  const day = dayOf(s.clock.m);
  if (w.soupDay === day) {
    g.openModal({ kicker: '1104 KESTREL · 3B', title: 'Mrs. Petrakis', body: '"Again? You ate already. Go. Come back tomorrow, I make lentil."', choices: [{ label: 'Tomorrow.', effect: () => {} }] });
    return;
  }
  g.openModal({
    kicker: '1104 KESTREL · 3B', title: 'Mrs. Petrakis',
    body: 'A tiny woman in a housecoat opens the door before you knock. "You look thin. Come. Sit. I tell you about my husband, God rest him, and you eat."',
    choices: [
      { label: 'Sit down and listen.', sub: '40 min · soup · +morale', effect: () => {
        w.soupDay = day;
        g.advance(40, { social: true });
        bump(s, 'hunger', 34); bump(s, 'energy', 10); bump(s, 'morale', 9); bump(s, 'stress', -8);
        g.toast('Avgolemono and forty minutes about a man named Stavros who could fix anything except his temper. You feel looked after.', 'good');
      } },
      { label: 'Say you have somewhere to be.', sub: '', effect: () => { bump(s, 'morale', -1); } },
    ],
  });
}

/** Squeak: a few things out of his coat, at a markup, until he runs out for the day. */
function squeakStock(s) {
  const w = walkupState(s);
  const day = dayOf(s.clock.m);
  if (w.stockDay !== day) {
    w.stockDay = day;
    w.stock = {};
    const [lo, hi] = CONFIG.walkup.squeakStock;
    for (const id of ['bliss', 'static', 'mud', 'drip']) if (Math.random() < 0.6) w.stock[id] = randInt(lo, hi);
    if (!Object.keys(w.stock).length) w.stock.drip = lo;
  }
  return w.stock;
}

function squeakMenu(g) {
  const s = g.state;
  const stock = squeakStock(s);
  const types = CONFIG.substances.types;
  const ids = Object.keys(stock);
  const priceOf = (id) => Math.round(types[id].price * CONFIG.walkup.squeakMarkup * 100) / 100;
  g.openModal({
    kicker: '1104 KESTREL · 4TH FLOOR HALLWAY',
    title: 'Squeak',
    body: '"Hey. Hey. You\'re the guy from 1120. I know everybody. I got a little of this, a little of that. Hallway prices. Convenience is a service."\n\nHe is wearing a coat indoors and the coat has a lot of pockets.',
    choices: [
      ...ids.map((id) => ({
        label: `${types[id].name} — ${money(priceOf(id))}`,
        sub: stock[id] > 0 ? `${stock[id]} left today · risk +${types[id].risk}` : 'he is out',
        disabled: stock[id] <= 0 || s.money < priceOf(id),
        effect: () => {
          if (!g.spendMoney(priceOf(id), 'Squeak')) return;
          stock[id] -= 1;
          addItem(s, id, 1);
          g.toast(`Squeak hands it over like a magic trick nobody asked for. "${stock[id] ? 'Pleasure.' : 'That\'s the last one. Tell your friends. Don\'t tell your friends.'}"`, 'info');
        },
      })),
      { label: 'Not today, Squeak.', sub: '', effect: () => {} },
    ],
  });
}

/** The arguing couple on two. Stepping in is a choice with consequences. */
const FIGHT_LINES = [
  '"IT WAS ONE TIME, DENISE." "IT WAS FOUR TIMES, RAY."',
  '"Your MOTHER—" "Do NOT bring my mother into—" "—LIVES HERE, Ray. She LIVES here."',
  '"Who buys a boat. WHO BUYS A BOAT. We live on the second floor."',
  '"I did NOT eat your leftovers." "Then WHO, Ray. The GHOST?"',
  '"Fine. FINE. I\'ll sleep on the couch." "We don\'t HAVE a couch, you SOLD the couch."',
];

function coupleMenu(g) {
  const s = g.state;
  g.openModal({
    kicker: '1104 KESTREL · 2ND FLOOR', title: 'Ray & Denise',
    body: `${pick(FIGHT_LINES)}\n\nThey are arguing in the hallway because the apartment, Ray says, "has ears." They both turn and look at you.`,
    choices: [
      { label: 'Try to calm things down.', sub: '15 min · could go either way', effect: () => {
        g.advance(15, { social: true });
        if (Math.random() < 0.5) {
          bump(s, 'morale', 6);
          g.toast('You say something about how nobody needs a boat. They both laugh. Denise kisses Ray on the head. Ray gives you a tall boy.', 'good');
          addItem(s, 'tallboy', 1);
        } else {
          bump(s, 'stress', 6); bump(s, 'morale', -3);
          g.toast('Now they are both yelling at you. They agree on everything about you. It is the most unified they have been in years.', 'bad');
        }
      } },
      { label: 'Mind your business.', sub: '', effect: () => { g.toast('"THANK you," says Denise, to you, at volume.', 'info'); } },
    ],
  });
}

/** Stephanie's door, 5C. She is home when her day has her off the map. */
function stephanieDoor(g, partnerMenu) {
  const s = g.state;
  const row = partnerTarget('stephanie', minuteOfDay(s.clock.m));
  const st = romance.partnerState(s, 'stephanie');
  g.advance(2);
  if (!row?.away) {
    g.openModal({ kicker: '1104 KESTREL · 5C', title: '5C', body: `Nobody home. A note taped to the door in Sharpie: "OUT. OBVIOUSLY."${st.met ? `\n\n(She is ${row.area === 'street' ? 'out on the street' : `at ${row.area}`}: ${row.note}.)` : ''}`, choices: [{ label: 'Okay.', effect: () => {} }] });
    return;
  }
  if (!st.met) {
    romance.meetPartner(g, 'stephanie');
    g.openModal({
      kicker: '1104 KESTREL · 5C', title: 'Stephanie',
      body: 'A woman in a black zip hoodie opens the door with a spoon in her mouth. She takes it out. "You\'re the guy from 1120. I see you on the stoop. I\'m Stephanie. I\'m in the middle of cereal."',
      choices: [{ label: '"Mo. Sorry. Wrong — no, right door, actually."', effect: () => { bump(s, 'morale', 5); } }],
    });
    return;
  }
  if (!st.girlfriend && st.affection < 40) {
    g.openModal({ kicker: '1104 KESTREL · 5C', title: 'Stephanie', body: 'She opens the door four inches. "It is too early or too late for you to be at my door, Mo. Text first. Like a person."', choices: [{ label: 'Fair.', effect: () => { bump(s, 'morale', -1); } }] });
    return;
  }
  partnerMenu(g, 'stephanie');
}

/** The roof: tar paper, a lawn chair somebody left, the whole skyline for free. */
function roof(g) {
  const s = g.state;
  const mod = minuteOfDay(s.clock.m);
  const night = mod >= 20 * 60 || mod < 5 * 60;
  g.openModal({
    kicker: '1104 KESTREL · THE ROOF', title: 'The Roof',
    body: night
      ? 'The city at night from five floors up: a million windows, every one of them somebody else\'s problem. A helicopter goes over. Somebody on the next roof is playing the same song you were thinking of.'
      : 'Tar paper, a lawn chair with one good leg, pigeons with opinions. You can see the Fellowship\'s gold roof from here, and the park, and, if you squint, a version of the week where things go fine.',
    choices: [
      { label: 'Sit for a while.', sub: '45 min · +morale · -stress', effect: () => { g.advance(45); bump(s, 'morale', night ? 10 : 7); bump(s, 'stress', -10); g.toast(night ? 'You stay until the song ends.' : 'A pigeon sits next to you. You are both on break.', 'good'); } },
      ...(countItem(s, 'loosies') ? [{ label: 'Smoke a loosie up here.', sub: '15 min', effect: () => { removeItem(s, 'loosies', 1); g.advance(15); bump(s, 'stress', -8); bump(s, 'morale', 3); } }] : []),
      { label: 'Go back down.', sub: '', effect: () => {} },
    ],
  });
}

export function buildWalkup(g, { partnerMenu } = {}) {
  const s = g.state;
  const w = walkupState(s);
  const f = w.floor;
  const group = new THREE.Group();
  const W = 3.4, D = 12;
  const tint = [0xb8a888, 0xa8b0a0, 0xb0a0a8, 0xa8a090, 0x9aa0a8][f];
  group.add(plane(W, D, { name: `wu_floor${f}`, map: tex(f === 0 ? 'tile' : 'linoleum'), repeat: [2, 7] }, [0, 0, 0], [-Math.PI / 2, 0, 0]));
  group.add(plane(W, D, { name: 'wu_ceil', map: tex('ceiling'), repeat: [2, 6] }, [0, 2.8, 0], [Math.PI / 2, 0, 0]));
  const wallMat = retroMaterial(`wu_wall${f}`, { map: tex('wallpaper'), color: tint });
  group.add(box(0.16, 2.8, D, wallMat, [-W / 2, 1.4, 0]));
  group.add(box(0.16, 2.8, D, wallMat, [W / 2, 1.4, 0]));
  group.add(box(W, 2.8, 0.16, wallMat, [0, 1.4, D / 2]));
  group.add(box(W, 2.8, 0.16, wallMat, [0, 1.4, -D / 2]));
  // a dado rail and scuffed baseboards: a hallway that has been a hallway for a long time
  for (const sx of [-1, 1]) {
    group.add(box(0.04, 0.06, D, M.wood, [sx * (W / 2 - 0.09), 0.95, 0]));
    group.add(box(0.04, 0.14, D, retroMaterial('wu_base', { color: 0x3a2e24 }), [sx * (W / 2 - 0.09), 0.07, 0]));
  }
  // ceiling lights, one of them flickering (it is always one of them)
  for (const z of [3.6, -0.4, -4.2]) group.add(box(0.5, 0.06, 0.5, z === -0.4 && f % 2 ? M.dim : M.lamp, [0, 2.76, z]));

  // the stairs, up the north end on the east side, and the rail
  const stairX = 0.75;
  for (let i = 0; i < 8; i++) group.add(box(1.5, 0.18 + i * 0.18, 0.3, M.concrete, [stairX, (0.18 + i * 0.18) / 2, -3.7 - i * 0.28]));
  group.add(box(0.06, 0.9, 2.4, M.metal, [stairX - 0.78, 1.2, -4.7]));
  // the flight down, on the west side: a railed well with the first steps showing, and a sign
  if (f > 0) {
    group.add(plane(1.1, 1.6, { name: 'wu_well', color: 0x0a0a0c }, [-1.05, 0.006, -3.3], [-Math.PI / 2, 0, 0]));
    for (let i = 0; i < 4; i++) group.add(box(1.0, 0.06, 0.3, M.concrete, [-1.05, 0.02 - i * 0.002, -2.75 - i * 0.36]));
    group.add(box(0.05, 0.9, 1.6, M.metal, [-0.47, 0.45, -3.3]));
    group.add(box(1.1, 0.05, 0.05, M.metal, [-1.05, 0.9, -2.5]));
    group.add(plane(0.9, 0.3, { name: 'wu_downsign', map: signTex('wuDown', [{ text: 'STAIRS ▼ DOWN', color: '#ffe9a0', size: 8 }], { w: 64, h: 18, bg: '#2a2420', border: '#c8a050' }), emissive: 0.7, unlit: true }, [-1.6, 1.95, -3.3], [0, Math.PI / 2, 0]));
  }
  group.add(plane(0.9, 0.3, { name: 'wu_upsign', map: signTex('wuUp', [{ text: f < FLOOR_NAMES.length - 1 ? 'STAIRS ▲ UP' : 'ROOF ▲', color: '#ffe9a0', size: 8 }], { w: 64, h: 18, bg: '#2a2420', border: '#c8a050' }), emissive: 0.7, unlit: true }, [1.6, 1.95, -3.0], [0, -Math.PI / 2, 0]));
  // the elevator, at the north end: a brass panel, doors the colour of 1962, a floor dial
  group.add(box(1.0, 2.2, 0.1, retroMaterial('wu_elev', { color: 0x8a7a5a, emissive: 0.05 }), [-0.95, 1.1, -D / 2 + 0.12]));
  group.add(box(0.02, 2.1, 0.11, retroMaterial('wu_elevseam', { color: 0x2a2418 }), [-0.95, 1.05, -D / 2 + 0.13]));
  group.add(plane(0.5, 0.2, { name: `wu_elevdial${f}`, map: signTex(`wuElevDial${f}`, [{ text: `◀ ${f === 0 ? 'L' : f + 1} ▶`, color: '#ffb84a', size: 9 }], { w: 48, h: 16, bg: '#1a120a', border: '#8a6a3a' }), emissive: 0.9, unlit: true }, [-0.95, 2.4, -D / 2 + 0.18]));
  group.add(plane(1.0, 0.4, { name: `wu_floornum${f}`, map: signTex(`wuFloor${f}`, [{ text: f === 0 ? 'LOBBY' : `FLOOR ${f + 1}`, color: '#f2e8c8', size: 10 }], { w: 64, h: 24, bg: '#2a2420', border: '#8a7452' }), emissive: 0.6, unlit: true }, [-W / 2 + 0.1, 1.9, -3.4], [0, Math.PI / 2, 0]));

  const interactables = [];
  const npcs = [];
  const solids = [solid(stairX, -4.8, 1.6, 2.6), ...(f > 0 ? [solid(-1.05, -3.6, 1.1, 1.2, 0.9)] : [])];
  const door = (side, z, label, action, sub = '') => {
    const x = side * (W / 2 - 0.07);
    group.add(box(0.1, 2.2, 1.0, M.door, [x, 1.1, z]));
    group.add(plane(0.3, 0.16, { name: `wu_num${label}`, map: signTex(`wuNum${label}`, [{ text: label, color: '#e8d8a0', size: 9 }], { w: 32, h: 16, bg: '#3a2a1a', border: '#a8884a' }), emissive: 0.4, unlit: true }, [x - side * 0.07, 1.85, z], [0, -side * Math.PI / 2, 0]));
    interactables.push({ id: `wu_door_${label}`, label: `Knock on ${label}`, sub, x: side * (W / 2 - 0.55), z, radius: 1.0, action });
  };
  const fl = f + 1;

  if (f === 0) {
    // the street door, the mailboxes, the man asleep by the stairs
    group.add(box(1.2, 2.3, 0.12, M.door, [0, 1.15, D / 2 - 0.1]));
    group.add(box(0.4, 0.2, 0.06, retroMaterial('wu_exit', { color: 0xff3a2a, emissive: 1.2, unlit: true }), [0, 2.55, D / 2 - 0.12]));
    for (let r = 0; r < 4; r++) for (let c = 0; c < 5; c++) group.add(box(0.06, 0.2, 0.26, M.metal, [-W / 2 + 0.1, 1.0 + r * 0.24, 1.0 + c * 0.28]));
    interactables.push({ id: 'wu_exit', label: 'Out to Kestrel St.', sub: '', x: 0, z: D / 2 - 0.9, radius: 1.0, action: (gg) => gg.goTo('street', 'walkup') });
    interactables.push({ id: 'wu_mail', label: 'The building directory', sub: 'mailboxes · who lives on which floor', x: -W / 2 + 0.6, z: 1.5, radius: 1.0, action: (gg) => gg.openModal({ kicker: '1104 KESTREL · LOBBY', title: 'Directory', body: `Taped above the mailboxes, in three different handwritings:\n\n${DIRECTORY.join('\n')}\n\nStairs at the north end, up on the right and down on the left. The elevator is between them.`, choices: [{ label: 'Got it.', effect: () => {} }] }) });
    npcs.push({ kind: 'junkie', x: -0.9, z: -2.6, rot: 1.4, talk: 'wu_sleeper', still: true, pose: 'sleep' });
    interactables.push({ id: 'wu_sleeper', label: 'The man asleep by the stairs', sub: 'he is breathing, you checked', x: -0.9, z: -2.6, radius: 1.1, action: (gg) => gg.openModal({ kicker: '1104 KESTREL · LOBBY', title: 'Asleep by the Stairs', body: 'A man asleep on flattened boxes under the first flight, shoes tucked under his head so nobody takes them. Someone has left a sandwich next to him. Someone else has taken half of it.', choices: [
      { label: 'Leave a dollar by his hand.', sub: '$1', disabled: s.money < 1, effect: () => { gg.spendMoney(1, 'a dollar by the stairs'); bump(s, 'morale', 3); } },
      { label: 'Step over him quietly.', sub: '', effect: () => {} },
    ] }) });
    door(1, 1.6, '1A', (gg) => knock(gg, f, '1A'));
  } else {
    door(-1, 2.6, `${fl}A`, (gg) => knock(gg, f, `${fl}A`));
    door(1, 2.6, `${fl}B`, f === 2 ? (gg) => petrakis(gg) : (gg) => knock(gg, f, `${fl}B`), f === 2 ? 'Mrs. Petrakis' : '');
    door(-1, -0.6, `${fl}C`, f === 4 && partnerMenu ? (gg) => stephanieDoor(gg, partnerMenu) : (gg) => knock(gg, f, `${fl}C`), f === 4 ? 'a cartoon bench sticker' : '');
    door(1, 0.4, `${fl}D`, (gg) => knock(gg, f, `${fl}D`));
  }
  if (f === 1) {
    npcs.push({ kind: 'tenant_m', x: -0.5, z: 1.0, rot: 1.4, talk: 'wu_couple', still: true, act: 'argue', side: 0 });
    npcs.push({ kind: 'tenant_f', x: 0.5, z: 1.1, rot: -1.6, talk: null, still: true, act: 'argue', side: 1 });
    interactables.push({ id: 'wu_couple', label: 'Ray & Denise', sub: 'mid-argument (always)', x: 0, z: 1.05, radius: 1.3, action: (gg) => coupleMenu(gg) });
  }
  // late, at the far end of the third-floor hall by the stairs: two people who could not wait for
  // an apartment. A mosaic covers the part the game does not show.
  if (f === 2) {
    const m = minuteOfDay(s.clock.m);
    if (m >= 21 * 60 || m < 4 * 60) {
      npcs.push({ kind: 'hall_m', x: 1.42, z: -1.8, rot: -Math.PI / 2, still: true, act: 'lean', talk: 'wu_couple2' });
      npcs.push({ kind: 'hall_f', x: 0.86, z: -1.8, rot: Math.PI / 2, still: true, act: 'kneel' });
      interactables.push({ id: 'wu_couple2', label: 'The two by the stairs', sub: 'very busy', x: 1.0, z: -1.8, radius: 1.4, action: (gg) => gg.openModal({ kicker: '1104 KESTREL · 3RD FLOOR', title: 'No', body: 'This isn\'t my business.', choices: [{ label: 'Walk past, eyes on the ceiling.', effect: () => {} }] }) });
    }
  }
  if (f === 3) {
    npcs.push({ kind: 'squeak', x: -0.9, z: -2.2, rot: 0.6, talk: 'wu_squeak', still: true });
    interactables.push({ id: 'wu_squeak', label: 'Talk to Squeak', sub: 'the hallway, at hallway prices', x: -0.9, z: -2.2, radius: 1.2, action: (gg) => squeakMenu(gg) });
  }
  if (f === 4) {
    // the last flight goes to the roof door, at the top of the east stairs
    group.add(box(1.0, 2.0, 0.12, retroMaterial('wu_roofdoor', { color: 0x6a6a6a }), [stairX, 2.4, -D / 2 + 0.1]));
    group.add(plane(0.8, 0.22, { name: 'wu_roofsign', map: signTex('wuRoof', [{ text: 'ROOF · ALARM WILL SOUND', color: '#ff6a5a', size: 6 }], { w: 96, h: 16, bg: '#1a1a1a', border: '#5a5a5a' }), emissive: 0.6, unlit: true }, [1.6, 2.4, -2.6], [0, -Math.PI / 2, 0]));
    interactables.push({ id: 'wu_roof', label: 'Up the last flight to the roof', sub: 'the alarm has not worked since 1989', x: stairX - 0.2, z: -3.2, radius: 0.9, action: (gg) => roof(gg) });
  }
  if (f < FLOOR_NAMES.length - 1) interactables.push({ id: 'wu_up', label: `Up to the ${FLOOR_NAMES[f + 1]}`, sub: `${CONFIG.walkup.stairMinutes} min · the stairs`, x: stairX - 0.2, z: -3.2, radius: 0.9, action: (gg) => stairs(gg, 1) });
  if (f > 0) interactables.push({ id: 'wu_down', label: `Stairs down to the ${FLOOR_NAMES[f - 1]}`, sub: 'the west stairwell', x: -1.05, z: -2.4, radius: 1.0, action: (gg) => stairs(gg, -1) });
  interactables.push({ id: 'wu_elev', label: 'Take the elevator', sub: 'any floor · it is slow · it is not safe', x: -0.95, z: -D / 2 + 0.9, radius: 1.0, action: (gg) => elevator(gg) });

  // overheard through the doors, now and then
  let timer = 6 + Math.random() * 6;
  const tick = (gg, dt) => {
    timer -= dt;
    if (timer > 0 || gg.modalOpen || gg.phoneOpen) return;
    timer = 14 + Math.random() * 10;
    const lines = f === 1 ? FIGHT_LINES : [
      'Through a door: a baby, a TV, and a man saying "I KNOW" to all of it.',
      'Somebody upstairs drops something heavy and then, after a pause, something heavier.',
      'A radio in one of the apartments is playing a Mets game from what sounds like 1986.',
      'The smell of somebody\'s dinner fills the hallway. It is not yours. It is never yours.',
    ];
    gg.toast(pick(lines), 'info');
  };

  return {
    group,
    bounds: { minX: -W / 2 + 0.25, maxX: W / 2 - 0.25, minZ: -D / 2 + 0.3, maxZ: D / 2 - 0.3 },
    solids,
    spawn: { x: 0, z: D / 2 - 1.6, rot: Math.PI },
    // up the stairs: at the top of the east flight; down them: at the foot of the west well;
    // out of the elevator: in front of its doors
    spawnFor: (from) => (from === 'up' ? { x: stairX - 0.2, z: -2.4, rot: 0 } : from === 'down' ? { x: -0.95, z: -1.7, rot: 0 } : from === 'elevator' ? { x: -0.95, z: -D / 2 + 1.5, rot: 0 } : { x: 0, z: D / 2 - 1.6, rot: Math.PI }),
    npcs,
    interactables,
    tick,
    ambient: 'street',
    title: `1104 Kestrel · ${FLOOR_NAMES[f]} · ${f + 1}/${FLOOR_NAMES.length}`,
    enterToast: f === 0 ? (market.owns(s, 'walkup') ? '1104 Kestrel. Your building. The lobby still smells like a hundred years of dinners, but now they are your dinners.' : '1104 Kestrel. The lobby smells like a hundred years of dinners.') : null,
  };
}

/* ================================================================== THE BUS */

const STOPS = {
  street: { name: 'Kestrel St.', area: 'street', spawn: 'bus' },
  avenue: { name: 'Ashby Avenue', area: 'avenue', spawn: 'bus' },
  park: { name: 'Kestrel Park', area: 'park', spawn: null },
};

export function busMenu(g, here) {
  const s = g.state;
  const T = CONFIG.transit;
  const dests = Object.entries(STOPS).filter(([id]) => id !== here);
  g.openModal({
    kicker: `B44 · ${STOPS[here].name.toUpperCase()}`,
    title: 'The Bus Stop',
    body: `A pole, a schedule nobody believes, a bench with a lawyer\'s face on it. The B44 runs "every twelve minutes."\n\nFare ${money(T.fare)}.`,
    choices: [
      ...dests.map(([id, d]) => ({
        label: `Ride to ${d.name}.`, sub: `${money(T.fare)} · a wait, then about ${T.ride} min`,
        disabled: s.money < T.fare,
        effect: () => ride(g, id, d),
      })),
      ...dests.filter(([id]) => id !== 'park').map(([id, d]) => ({
        label: `Walk to ${d.name}.`, sub: `free · ${T.walk} min · tiring`,
        effect: () => { g.advance(T.walk); bump(s, 'energy', T.walkEnergy); go(g, d); g.toast('You walk it. Your feet file a complaint.', 'info'); },
      })),
      { label: 'Never mind.', sub: '', effect: () => {} },
    ],
  });
}

function ride(g, id, d) {
  const s = g.state;
  const T = CONFIG.transit;
  if (!g.spendMoney(T.fare, 'bus fare')) return;
  const wait = randInt(T.wait[0], T.wait[1]);
  g.advance(wait + T.ride);
  bump(s, 'stress', wait > 15 ? 3 : -1);
  go(g, d);
  g.toast(pick([
    `${wait} minutes for the bus. A man on it is eating a whole rotisserie chicken. Nobody says anything.`,
    `The bus came after ${wait} minutes. The driver has a radio on with the game. You get a seat.`,
    `${wait} minutes, then standing room only. Somebody\'s bag is on your foot for ${T.ride} minutes.`,
  ]), 'info');
}

function go(g, d) {
  g.goTo(d.area, d.spawn);
}

/* ================================================================== ASHBY AVENUE */

export function buildAvenue(g) {
  const group = new THREE.Group();
  const L = 34;
  // the avenue's pavement, cut around the station stair for the same reason as Kestrel
  const slab = (w, d, cx, cz) => plane(w, d, { name: 'av_sw', map: tex('sidewalk'), repeat: [Math.max(1, w * 0.29), Math.max(1, d * 0.33)] }, [cx, 0, cz], [-Math.PI / 2, 0, 0]);
  const AH = { x0: 12.95, x1: 15.85, z0: -2.6, z1: 1.3 };
  group.add(slab(L, AH.z0 - (-6.5), 0, (-6.5 + AH.z0) / 2));
  group.add(slab(L, 2.5 - AH.z1, 0, (AH.z1 + 2.5) / 2));
  group.add(slab(AH.x0 - (-17), AH.z1 - AH.z0, (-17 + AH.x0) / 2, (AH.z0 + AH.z1) / 2));
  group.add(slab(17 - AH.x1, AH.z1 - AH.z0, (AH.x1 + 17) / 2, (AH.z0 + AH.z1) / 2));
  group.add(plane(L, 9, { name: 'av_road', map: tex('asphalt'), repeat: [12, 3] }, [0, -0.01, 6.0], [-Math.PI / 2, 0, 0]));
  group.add(box(L, 0.18, 0.4, M.concrete, [0, 0.09, 1.5]));
  // the avenue's own skyline: taller, louder, more signs than Kestrel
  const facade = (x, w, h, color) => {
    group.add(box(w, h, 1.2, retroMaterial(`av_fac${x}`, { map: tex('brick'), color }), [x, h / 2, -7.0]));
    for (let r = 1; r < Math.floor(h / 1.7); r++) for (let c = 0; c < Math.floor(w / 2.2); c++) {
      group.add(plane(0.9, 1.0, { name: 'av_win', map: tex('window'), emissive: Math.random() < 0.4 ? 0.45 : 0.08, unlit: true }, [x - w / 2 + 1.1 + c * 2.2, 1.4 + r * 1.7, -6.38]));
    }
  };
  void 0; // the 84th Precinct stands at -12.5 (built below)
  facade(-4.5, 7, 9, 0x9a5a4a);
  facade(3.0, 7, 14, 0xc8c0b0);
  facade(10.5, 7, 10, 0x8a8478);
  // Lucia's: green awning, a lit script sign, a menu in the window
  group.add(box(6.0, 0.16, 1.2, retroMaterial('av_awning', { color: 0x2a5a3a }), [-4.5, 3.0, -5.9]));
  group.add(box(1.2, 2.3, 0.12, retroMaterial('av_ldoor', { color: 0x5a2a1a }), [-4.5, 1.15, -6.32]));
  group.add(plane(3.2, 0.7, { name: 'av_lsign', map: signTex('signLucias', [{ text: "Lucia's", color: '#ffe9b0', size: 16 }, { text: 'TRATTORIA · SINCE 1961', color: '#e8c070', size: 6 }], { w: 128, h: 32, bg: '#3a1a12', border: '#c8a050' }), emissive: 1, unlit: true }, [-4.5, 3.6, -6.3]));
  group.add(plane(2.6, 2.0, { name: 'av_lpool', color: 0xffd9a0, opacity: 0.16, transparent: true, unlit: true }, [-4.5, 0.035, -5.0], [-Math.PI / 2, 0, 0]));
  // the 84th Precinct: a stone front, two green lamps by the door, a cop or two on the steps
  group.add(box(7.6, 9.0, 1.3, retroMaterial('av_pct', { color: 0x8a8a84, map: tex('concrete') }), [-12.5, 4.5, -7.0]));
  group.add(box(1.4, 2.4, 0.12, retroMaterial('av_pctdoor', { color: 0x2a2a30 }), [-12.5, 1.2, -6.32]));
  for (const x of [-13.6, -11.4]) {
    group.add(box(0.12, 0.6, 0.12, M.metal, [x, 2.2, -6.2]));
    group.add(box(0.32, 0.36, 0.32, retroMaterial('av_pctlamp', { color: 0x4ae07a, emissive: 1.2, unlit: true }), [x, 2.65, -6.2]));
  }
  group.add(plane(3.2, 0.6, { name: 'av_pctsign', map: signTex('signPct', [{ text: '84TH PRECINCT', color: '#f2f2f0', size: 11 }, { text: 'POLICE · COURTESY · PROFESSIONALISM · PAPERWORK', color: '#b8c8e8', size: 5 }], { w: 160, h: 28, bg: '#1e2a4a', border: '#b8c8e8' }), emissive: 0.9, unlit: true }, [-12.5, 3.0, -6.3]));
  for (let i = 0; i < 3; i++) group.add(box(2.4 - i * 0.3, 0.12, 0.4, M.concrete, [-12.5, 0.06 + i * 0.12, -5.9 + i * 0.3]));
  // Dee's Wash & Fold: a wide lit window full of machines, a sign in blue script
  group.add(box(1.2, 2.3, 0.12, retroMaterial('av_lmdoor', { color: 0x4a6a8a }), [5.0, 1.15, -6.32]));
  group.add(box(2.8, 1.6, 0.06, retroMaterial('av_lmwin', { color: 0xbfe0f0, emissive: 0.6, unlit: true }), [2.4, 1.4, -6.33]));
  group.add(plane(3.6, 0.6, { name: 'av_lmsign', map: signTex('signLaundry', [{ text: "DEE'S WASH & FOLD", color: '#bfe8ff', size: 10 }, { text: 'COIN OP · DROP OFF · OPEN 6AM-MIDNIGHT', color: '#ffffff', size: 5 }], { w: 160, h: 28, bg: '#1a3a5a', border: '#bfe8ff' }), emissive: 1, unlit: true }, [3.6, 2.8, -6.3]));
  // the pawn shop, gold letters on black
  group.add(box(1.1, 2.3, 0.12, M.door, [10.5, 1.15, -6.32]));
  group.add(plane(3.0, 0.6, { name: 'av_psign', map: signTex('signPawn', [{ text: 'ASHBY PAWN & GOLD', color: '#ffd23a', size: 10 }, { text: 'WE BUY ANYTHING (ALMOST)', color: '#e8e0c0', size: 6 }], { w: 128, h: 28, bg: '#0e0e0e', border: '#ffd23a' }), emissive: 1, unlit: true }, [10.5, 3.0, -6.3]));
  // ---- the newsstand. An open stall rather than a green cube: a counter with a ledge, a roof, a
  // striped awning, the papers stacked where you can read the front page from the street, a rack
  // of magazines, and a man standing behind it who is actually in the scene (see the seller NPC
  // below). Everything is boxes and planes in the same palette as the rest of the avenue.
  const NEWS = {
    body: retroMaterial('av_kiosk', { color: 0x2a5a3a }),
    trim: retroMaterial('av_kiosk_trim', { color: 0x16331f }),
    counter: retroMaterial('av_kiosk_counter', { color: 0x5a3f28, map: tex('wood') }),
    paper: retroMaterial('av_papers', { color: 0xe8e0c8 }),
    paper2: retroMaterial('av_papers2', { color: 0xd6cdb0 }),
    brass: retroMaterial('av_kiosk_brass', { color: 0xc8a050, ambient: 0.95 }),
    lamp: retroMaterial('av_kiosk_lamp', { color: 0xfff2c4, emissive: 1.1, unlit: true }),
  };
  group.add(box(2.3, 1.0, 0.62, NEWS.body, [3.0, 0.5, -3.12]));          // counter front
  group.add(box(2.42, 0.08, 0.74, NEWS.counter, [3.0, 1.04, -3.08]));    // ledge
  group.add(box(2.42, 0.06, 0.06, NEWS.brass, [3.0, 1.08, -2.73]));      // brass edge
  group.add(box(2.3, 0.14, 0.62, NEWS.trim, [3.0, 0.07, -3.12]));        // kick plate
  group.add(box(2.3, 2.2, 0.12, NEWS.body, [3.0, 1.12, -3.98]));         // back wall
  for (const x of [1.92, 4.08]) group.add(box(0.12, 2.2, 1.0, NEWS.body, [x, 1.12, -3.5]));
  group.add(box(2.46, 0.12, 1.14, NEWS.trim, [3.0, 2.26, -3.5]));        // roof
  // the awning: eight stripes, tipped out over the counter
  for (let i = 0; i < 8; i++) {
    const stripe = box(0.31, 0.05, 0.72, retroMaterial(`av_awning${i % 2}`, { color: i % 2 ? 0xe8e0c8 : 0x2a5a3a }), [1.94 + i * 0.303, 2.12, -3.02]);
    stripe.rotation.x = -0.2;
    group.add(stripe);
  }
  group.add(plane(2.3, 0.42, { name: 'av_newsign', map: signTex('signNews', [{ text: 'NEWSSTAND', color: '#f4efdc', size: 15 }, { text: 'PAPERS · MAGAZINES · SCRATCH-OFFS', color: '#cfd8c8', size: 5 }], { w: 160, h: 32, bg: '#16331f', border: '#cfd8c8' }), emissive: 0.9, unlit: true }, [3.0, 2.55, -3.1]));
  group.add(box(0.16, 0.10, 0.16, NEWS.lamp, [3.0, 2.18, -3.06]));       // bulb under the lip
  // the papers: stacks on the ledge with the top copy face-up, so the headlines are readable
  const PAGES = [
    ['THE KESTREL DISPATCH', 'METS LOSE AGAIN; FANS "NOT SURPRISED, JUST TIRED"'],
    ['THE KESTREL DISPATCH', 'CITY VOWS TO FIX POTHOLES "BY 2000"; POTHOLES UNMOVED'],
    ['THE ASHBY LEDGER', 'Y2K: EXPERTS SAY ELEVATORS "PROBABLY FINE"'],
    ['THE ASHBY LEDGER', 'GOLDEN FELLOWSHIP BUYS SECOND THEATER'],
  ];
  [2.16, 2.58, 3.42, 3.84].forEach((x, i) => {
    group.add(box(0.34, 0.12 + (i % 2) * 0.05, 0.28, i % 2 ? NEWS.paper2 : NEWS.paper, [x, 1.14 + (i % 2) * 0.02, -3.06]));
    const [head, sub] = PAGES[i];
    group.add(plane(0.31, 0.25, {
      name: `av_page${i}`,
      map: signTex(`newsPage${i}`, [{ text: head, color: '#1a1a1a', size: 7 }, { text: sub, color: '#3a3a3a', size: 4 }], { w: 96, h: 76, bg: '#efe9d8', border: '#b8b0a0' }),
      emissive: 0.55, unlit: true,
    }, [x, 1.205 + (i % 2) * 0.02, -3.06], [-Math.PI / 2, 0, 0]));
  });
  // the magazine rack on the back wall: coloured covers, all facing out
  const COVERS = [0xc8322a, 0x2a4a8a, 0xd8b93a, 0x8a2a8a, 0x2a7a5a, 0xc86a2a];
  COVERS.forEach((c, i) => {
    group.add(box(0.24, 0.32, 0.03, retroMaterial(`av_mag${i}`, { color: c }), [2.24 + i * 0.27, 1.52, -3.9]));
    group.add(box(0.20, 0.05, 0.032, NEWS.paper, [2.24 + i * 0.27, 1.62, -3.905]));
  });
  // clutter: a crate of spare papers, a thermos, a radio, a stool, and a hand-written sign
  group.add(box(0.46, 0.34, 0.36, NEWS.counter, [4.22, 0.17, -2.95]));
  group.add(box(0.40, 0.10, 0.30, NEWS.paper, [4.22, 0.39, -2.95]));
  group.add(box(0.10, 0.24, 0.10, retroMaterial('av_thermos', { color: 0x8a8a86 }), [3.98, 1.16, -3.2]));
  group.add(box(0.28, 0.16, 0.14, retroMaterial('av_radio', { color: 0x2a2a2e }), [2.02, 1.16, -3.2]));
  group.add(box(0.05, 0.18, 0.02, NEWS.brass, [3.62, 1.19, -2.96]));
  group.add(plane(0.34, 0.16, { name: 'av_nochange', map: signTex('signNoChange', [{ text: 'NO CHANGE', color: '#2a2a2a', size: 9 }, { text: 'EXACT PLEASE', color: '#5a5a5a', size: 5 }], { w: 64, h: 32, bg: '#e8e0c0', border: '#a89870' }), unlit: true }, [3.62, 1.30, -2.96]));
  // the parts that make it a stall someone has run for years rather than a green cube
  // a roll-up shutter, rolled, in its housing under the roof lip
  const shutter = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 2.3, 8), retroMaterial('av_shutter', { color: 0x8a8e88 }));
  shutter.rotation.z = Math.PI / 2;
  shutter.position.set(3.0, 1.98, -2.62);
  group.add(shutter);
  group.add(box(2.36, 0.14, 0.05, NEWS.trim, [3.0, 2.04, -2.5]));
  // rounded corner posts
  for (const x of [1.88, 4.12]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.24, 8), NEWS.trim);
    post.position.set(x, 1.12, -2.86);
    group.add(post);
  }
  // a wire under the awning with magazines pegged to it, turning slightly in the breeze
  group.add(box(2.2, 0.012, 0.012, NEWS.brass, [3.0, 1.9, -2.62]));
  [0xd8b93a, 0x2a4a8a, 0xc8322a, 0x8a2a8a, 0x2a7a5a].forEach((c, i) => {
    const mag = box(0.22, 0.29, 0.015, retroMaterial(`av_hang${i}`, { color: c }), [2.2 + i * 0.4, 1.73, -2.6]);
    mag.rotation.y = (i % 2 ? 0.15 : -0.12);
    group.add(mag);
    group.add(box(0.16, 0.05, 0.017, NEWS.paper, [2.2 + i * 0.4, 1.81, -2.6]));
    group.add(box(0.03, 0.05, 0.03, NEWS.brass, [2.2 + i * 0.4, 1.88, -2.61]));
  });
  // racks on the outside walls: three tilted shelves of covers each side
  for (const sx of [-1, 1]) {
    const wx = 3.0 + sx * 1.2;
    for (let r = 0; r < 3; r++) {
      group.add(box(0.06, 0.03, 0.9, NEWS.trim, [wx + sx * 0.1, 0.62 + r * 0.42, -3.5]));
      for (let k = 0; k < 3; k++) {
        const cover = box(0.025, 0.3, 0.24, retroMaterial(`av_side${(r * 3 + k + (sx > 0 ? 4 : 0)) % 6}`, { color: COVERS[(r * 3 + k + (sx > 0 ? 2 : 0)) % 6] }), [wx + sx * 0.14, 0.78 + r * 0.42, -3.82 + k * 0.3]);
        cover.rotation.z = sx * 0.22;
        group.add(cover);
      }
    }
  }
  // a candy rack on the end of the counter: three tiers of bright little boxes
  for (let tier = 0; tier < 3; tier++) {
    group.add(box(0.42, 0.03, 0.14, NEWS.trim, [2.0 + 0.22, 1.14 + tier * 0.11, -2.92 - tier * 0.09]));
    for (let k = 0; k < 4; k++) group.add(box(0.08, 0.07, 0.06, retroMaterial(`av_candy${(tier + k) % 4}`, { color: [0xe8463a, 0xf2c03a, 0x3f8f3a, 0x2f6fd6][(tier + k) % 4] }), [2.07 + k * 0.1, 1.19 + tier * 0.11, -2.92 - tier * 0.09]));
  }
  // the morning delivery: two bundles of papers tied with twine on the pavement
  const twine = retroMaterial('av_twine', { color: 0xc8a86a });
  for (const [bx, bz, ry, h] of [[4.75, -2.25, 0.2, 0.28], [4.8, -2.25, -0.15, 0.56]]) {
    const bundle = new THREE.Group();
    bundle.position.set(bx, 0, bz);
    bundle.rotation.y = ry;
    bundle.add(box(0.44, 0.26, 0.32, NEWS.paper2, [0, h - 0.13, 0]));
    bundle.add(box(0.46, 0.02, 0.03, twine, [0, h - 0.13, 0]));
    bundle.add(box(0.03, 0.27, 0.34, twine, [0, h - 0.13, 0]));
    group.add(bundle);
  }
  // the price card in the corner of the glass and a fluorescent tube under the roof
  group.add(box(1.9, 0.04, 0.04, retroMaterial('av_kiosk_tube', { color: 0xf4fbff, emissive: 1.2, unlit: true }), [3.0, 2.14, -3.9]));

  // the bus stop and its shelter
  group.add(box(0.12, 2.6, 0.12, M.metal, [12.5, 1.3, 0.6]));
  group.add(box(1.2, 0.5, 0.08, retroMaterial('av_bussign', { color: 0x2a4a6a, emissive: 0.15 }), [12.5, 2.5, 0.6]));
  group.add(box(2.4, 0.1, 1.0, M.metal, [13.6, 2.4, 0.0]));
  // streetlights
  for (const x of [-14, -6, 2, 10]) {
    group.add(box(0.12, 4.0, 0.12, M.metal, [x, 2.0, 1.1]));
    group.add(box(0.6, 0.1, 0.3, M.lamp, [x, 4.0, 0.9]));
  }
  // people going somewhere else
  const npcs = [
    { kind: 'passer_m', x: -10, z: -1.6, walker: [-15, 15] },
    { kind: 'w14', x: 6, z: -0.6, walker: [-15, 15] },
    { kind: 'passer_m2', x: 0, z: -2.6, walker: [-15, 15] },
    // Brooklyn foot traffic: men from Williamsburg on the way somewhere, and, some days, a pair of
    // Guardian Angles walking a patrol nobody asked for
    ...((minuteOfDay(g.state.clock.m) >= 420 && minuteOfDay(g.state.clock.m) < 1200) && Math.random() < 0.55 ? [{ kind: pick(['hasid', 'hasid2']), x: -6, z: -1.8, walker: [-15, 15] }] : []),
    ...(Math.random() < 0.35 ? [{ kind: 'angel_m', x: 4, z: -2.2, walker: [-15, 15] }, { kind: 'angel_f', x: 5.1, z: -2.2, walker: [-15, 15] }] : []),
    { kind: pick(['w0', 'w3', 'w8', 'w12', 'w19']), x: -2, z: -1.0, walker: [-15, 15] },
    // the sax player: an older Jamaican man, big, slow, locks under a tam, shades on day and night
    { kind: 'rasta', x: 7.5, z: -4.4, rot: 0, talk: 'av_sax', still: true, sax: true },
    { kind: 'passer_m2', x: -9.5, z: -5.0, rot: 0.2, still: true, act: 'smoke' },
    { kind: 'cop', x: -13.9, z: -5.0, rot: 0.3, still: true, act: 'talk' },
    { kind: 'cop2', x: -11.0, z: -5.2, rot: -0.4, still: true },
    // the paper seller: a person behind the counter, not a voice inside a box. `talk` points at
    // the newsstand prompt, so the prompt follows him and the papers are bought from him.
    { kind: 'newsman', x: 3.0, z: -3.55, rot: 0, still: true, talk: 'av_news', act: 'talk' },
  ];
  const s = g.state;
  const interactables = [
    ...(music.musicState(g.state).cds ? [{ id: 'av_cds', label: 'Sell demo CDs by the bus stop', sub: '1 h · $3 each', x: 1.5, z: -0.8, radius: 1.2, action: (gg) => music.sellCDs(gg) }] : []),
    ...(music.musicState(g.state).offer ? [{ id: 'av_studio', label: 'Ashby Sound', sub: music.studioNow(g.state) ? 'your studio time · now' : 'by appointment', x: 8.6, z: -5.2, radius: 1.2, action: (gg) => music.studio(gg) }] : []),
    { id: 'av_lucias', label: "Enter Lucia's", sub: 'tablecloths · red sauce · a waiter in a vest', x: -4.5, z: -5.2, radius: 1.5, unavailable: (gg) => closedReason('restaurant', gg.state.clock.m), action: (gg) => gg.goTo('restaurant', 'avenue') },
    { id: 'av_precinct', label: 'Enter the 84th Precinct', sub: 'the desk sergeant has seen everything', x: -12.5, z: -5.2, radius: 1.5, action: (gg) => gg.goTo('precinct', 'avenue') },
    { id: 'av_laundry', label: "Enter Dee's Wash & Fold", sub: 'laundry · vending machines · a TV', x: 5.0, z: -5.2, radius: 1.4, unavailable: (gg) => closedReason('laundromat', gg.state.clock.m), action: (gg) => gg.goTo('laundromat', 'avenue') },
    { id: 'av_pawn', label: 'Ashby Pawn & Gold', sub: 'buy · sell · not food, not drugs', x: 10.5, z: -5.2, radius: 1.5,
      unavailable: (gg) => { const m = minuteOfDay(gg.state.clock.m); return m < 10 * 60 || m > 20 * 60 ? 'closed · grate down till 10:00' : null; },
      action: (gg) => gg.goTo('pawn', 'avenue') },
    { id: 'av_news', label: 'Buy a paper from the man in the box', sub: `papers · scratch-offs · ${money(0.5)}`, x: 3.0, z: -2.95, radius: 1.7, action: (gg) => newsstand(gg) },
    { id: 'av_sax', label: 'The sax player', sub: 'he takes requests · a dollar in the case', x: 7.5, z: -4.0, radius: 1.3, action: (gg) => saxMenu(gg) },
    { id: 'av_bus', label: 'The bus stop', sub: 'B44 back to Kestrel', x: 12.5, z: 0.0, radius: 1.5, action: (gg) => busMenu(gg, 'avenue') },
    { id: 'av_subway', label: 'Down to the Ashby Ave station', sub: 'east end of the avenue · Kestrel St, Park Slope', x: 14.35, z: -0.4, radius: 1.1, action: (gg) => gg.goTo('subway', 'avenue') },
  ];
  let timer = 10;
  const tick = (gg, dt) => {
    timer -= dt;
    if (timer > 0 || gg.modalOpen || gg.phoneOpen) return;
    timer = 18 + Math.random() * 14;
    // the man in the box calls out when Mo is near enough to be a customer; otherwise the
    // avenue's own ambience carries on as before
    const pos = gg.world?.mo?.root?.position;
    if (pos && Math.hypot(pos.x - 3.0, pos.z + 2.95) < 4.5 && Math.random() < 0.5) {
      gg.toast(pick([
        '"Paper! Paper! Mets lose again!" He says it in the flat voice of a man who has said it eleven thousand times.',
        'The man in the box taps the stack twice, which is how you know it is today\'s.',
        '"Scratch-offs are behind the counter. Everything is behind the counter. That is what a counter is."',
        'He turns the radio down for you, which is the closest thing to a welcome on this avenue.',
      ]), 'info');
      return;
    }
    gg.toast(pick([
      'A cab leans on its horn for a full block for no reason anyone can see.',
      'Somebody walks past on a phone the size of a brick, yelling "SELL" into it.',
      'Two kids on one bike. The one on the handlebars is steering.',
      'A man is selling batteries out of a duffel bag. "Double A, triple A, quadruple A."',
      'The smell from Lucia\'s door reaches the bus stop. It is garlic. It is a lot of garlic.',
    ]), 'info');
  };
  // the way down to the trains, east end of the avenue, clear of the bus stop
  group.add(buildStationEntrance(15.3, -0.4, { name: 'ASHBY AV', painted: true, rot: -Math.PI / 2 }));
  return {
    group,
    bounds: { minX: -15.5, maxX: 15.5, minZ: -5.6, maxZ: 1.3 },
    camBounds: { minX: -17, maxX: 17, minZ: -5.6, maxZ: 9 },
    traffic: { lanes: [{ z: 4.4, dir: 1 }, { z: 6.8, dir: -1 }], x0: -19, x1: 19, rate: [2, 6], bus: 0.12 },
    solids: [solid(3.0, -3.66, 2.36, 1.62), solid(12.5, 0.6, 0.3, 0.3), solid(16.95, -0.4, 3.9, 3.0, 1.1)],
    spawn: { x: 12.0, z: -0.6, rot: Math.PI },
    spawnFor: (from) => (from === 'restaurant' ? { x: -4.5, z: -3.6, rot: 0 } : from === 'precinct' ? { x: -12.5, z: -4.0, rot: 0 } : from === 'laundromat' ? { x: 5.0, z: -4.2, rot: 0 } : from === 'pawn' ? { x: 10.5, z: -4.2, rot: 0 } : from === 'subway' ? { x: 14.1, z: -0.4, rot: -Math.PI / 2 } : { x: 12.0, z: -0.6, rot: -Math.PI / 2 }),
    npcs,
    interactables,
    tick,
    ambient: 'street',
    enterToast: 'Ashby Avenue. Louder than Kestrel, and everybody is going somewhere.',
  };
}

function newsstand(g) {
  const s = g.state;
  const HEADLINES = [
    'METS LOSE AGAIN; FANS "NOT SURPRISED, JUST TIRED"',
    'CITY VOWS TO FIX POTHOLES "BY 2000"; POTHOLES UNMOVED',
    'Y2K: EXPERTS SAY ELEVATORS "PROBABLY FINE"',
    'GOLDEN FELLOWSHIP BUYS SECOND THEATER; CONGREGANTS ASKED TO "GIVE GENEROUSLY, THEN AGAIN"',
    'SUBWAY FARE "WILL NOT GO UP," SAYS MAN WHO RAISED SUBWAY FARE',
    'LOCAL BODEGA CAT CELEBRATES 9TH BIRTHDAY; DECLINES INTERVIEW',
  ];
  g.openModal({
    kicker: 'ASHBY AVE. · NEWSSTAND', title: 'The Paper',
    body: `The man in the box has a radio, a cigar he is not smoking, and every paper in the city. The awning has been the same two greens since 1987 and he will tell you that without being asked.\n\nToday: "${pick(HEADLINES)}"`,
    choices: [
      { label: 'Buy a paper and read it.', sub: `${money(0.5)} · 20 min · +morale`, disabled: s.money < 0.5, effect: () => { if (!g.spendMoney(0.5, 'newspaper')) return; g.advance(20); bump(s, 'morale', 4); bump(s, 'stress', -3); g.toast('You read the whole thing, including the horoscope. Yours says "a door opens." It does not say which.', 'good'); } },
      { label: 'Scratch-off ticket.', sub: `${money(2)} · probably not`, disabled: s.money < 2, effect: () => {
        if (!g.spendMoney(2, 'scratch-off')) return;
        const r = Math.random();
        const win = r < 0.01 ? 500 : r < 0.05 ? 20 : r < 0.2 ? 2 : 0;
        if (win) g.earnMoney(win, 'scratch-off');
        g.toast(win ? `$${win}! The man in the box says "huh."` : 'Nothing. Silver dust on your thumb. Same as always.', win ? 'good' : 'info');
      } },
      { label: s.flags.jaysCatalog ? "Leaf through Jay's catalog again." : "Buy Mr. Jay's clothing catalog.", sub: s.flags.jaysCatalog ? 'you own one · call it in from Phone' : `${money(1)} · phone orders, delivered to your closet`, disabled: !s.flags.jaysCatalog && s.money < 1, effect: () => {
        if (s.flags.jaysCatalog) { g.toast("Page 6 is the red flannel. Page 7 is a man in the red flannel looking at a horse. Order line in the back: dial Jay's from Contacts.", 'info'); return; }
        if (!g.spendMoney(1, "Jay's catalog")) return;
        s.flags.jaysCatalog = true;
        g.toast("Mr. Jay's Fall Catalog, glossy, smells of perfume strips. The order line is in Contacts now. Jay ships next morning, for a fee, like everybody.", 'good');
      } },
      { label: s.flags.decorGuide ? "Flip through the Home Decorator's Guide." : "Buy the Home Decorator's Guide.", sub: s.flags.decorGuide ? 'you own it · fix up Unit 3B from home' : `${money(3)} · unlocks the nicer upgrades at home`, disabled: !s.flags.decorGuide && s.money < 3, effect: () => {
        if (s.flags.decorGuide) { g.toast('Chapter 4: "Your Lamp Is Your Personality." You have read it twice. You do not have a lamp.', 'info'); return; }
        if (!g.spendMoney(3, "Home Decorator's Guide")) return;
        s.flags.decorGuide = true;
        g.toast("THE HOME DECORATOR'S GUIDE, 1997 edition. A woman on the cover is very happy about a throw pillow. Fix up the place from home now: wallpaper, a rug, a real TV.", 'good');
      } },
      { label: 'Just look at the headlines.', sub: '', effect: () => {} },
    ],
  });
}

/** Sell a valuable for a fraction of what BidBay would get, but right now. */
/**
 * The sax player is the avenue's jukebox: stand and listen and he plays the next tune in his
 * book, which is the game's own soundtrack, round and round. Ashby holds that song while he plays.
 */
const SAX_BOOK = ['ashby', 'city', 'park', 'habib', 'restaurant', 'bodega', 'church', 'laundromat', 'apartment', 'clinic', 'lost', 'menu'];
function saxMenu(g) {
  const s = g.state;
  if (!s.sax) s.sax = { next: 0 };
  const id = SAX_BOOK[s.sax.next % SAX_BOOK.length];
  const title = TRACKS[id]?.title || 'something old';
  g.openModal({
    kicker: 'ASHBY AVE.', title: 'The Sax Player',
    body: `An old man with locks piled under a red, gold and green tam, shades on at any hour, rocking on his heels like the pavement is a boat. His case has four dollars and a subway token in it. "Every tune in the book, bredren. In order. No skipping."

Next in the book: "${title}".`,
    choices: [
      { label: 'Stand and listen for a song.', sub: `10 min · "${title}" · +morale -stress`, effect: () => {
        s.sax.next += 1;
        g.soundtrack?.cue?.(id, 75, 'avenue');
        g.advance(10);
        bump(s, 'morale', 3);
        bump(s, 'stress', -4);
        g.toast(pick([`He closes his eyes and plays "${title}" like it is the last song anybody will ever need.`, `"${title}." Two people stop walking. One of them is you.`, `He nods you in and goes into "${title}". The bus goes by and he plays over it, and wins.`]), 'good');
      } },
      { label: 'Drop a dollar in the case.', sub: '$1 · +morale', disabled: s.money < 1, effect: () => { g.spendMoney(1, 'sax player'); bump(s, 'morale', 5); bump(s, 'stress', -3); g.toast('He nods without stopping. "Bless up." That is the deal.', 'good'); } },
      { label: 'Keep walking.', sub: '', effect: () => {} },
    ],
  });
}

function pawnMenu(g) {
  const s = g.state;
  const goods = inventoryList(s).filter((it) => CONFIG.items[it.id]?.kind === 'valuable' || CONFIG.items[it.id]?.kind === 'gift');
  const offer = (id) => Math.max(1, Math.round((CONFIG.items[id].value || 0) * 0.45));
  g.openModal({
    kicker: 'ASHBY PAWN & GOLD', title: 'Pawn',
    body: goods.length
      ? 'A man behind bulletproof glass looks at your things like a doctor looks at an X-ray. "Cash today. Less than it\'s worth. That\'s what pawn means."'
      : 'The man behind the glass looks at you, then at your empty hands. "Come back with something. Or don\'t."',
    choices: [
      ...goods.slice(0, 6).map((it) => ({
        label: `${CONFIG.items[it.id].name} — ${money(offer(it.id))}`, sub: `you have ${it.qty}`,
        effect: () => { removeItem(s, it.id, 1); g.earnMoney(offer(it.id), 'pawned'); g.advance(10); logLine(g, `Pawned ${CONFIG.items[it.id].name}.`, 'info'); },
      })),
      { label: 'Leave.', sub: '', effect: () => {} },
    ],
  });
}

/* ================================================================== LUCIA'S */

const MENU = [
  { id: 'spaghetti', name: 'Spaghetti & meatballs', price: 13, hunger: 55, energy: 14, morale: 9 },
  { id: 'parm', name: 'Chicken parm', price: 16, hunger: 62, energy: 16, morale: 11 },
  { id: 'garlic', name: 'Garlic bread', price: 4, hunger: 18, energy: 4, morale: 4 },
  { id: 'cannoli', name: 'A cannoli', price: 5, hunger: 10, energy: 6, morale: 8 },
  { id: 'espresso', name: 'Espresso', price: 3, hunger: 0, energy: 18, morale: 2 },
];

function luciasMenu(g) {
  const s = g.state;
  g.openModal({
    kicker: "LUCIA'S · ASHBY AVE.", title: 'A Table',
    body: 'The waiter (vest, pencil behind the ear, has worked here since before you were born) puts down bread you did not order. "For the table. Lucia insists."',
    choices: [
      ...MENU.map((d) => ({
        label: `${d.name} — ${money(d.price)}`, sub: `${d.hunger ? `+${d.hunger} food · ` : ''}+${d.energy} energy`,
        disabled: s.money < d.price,
        effect: () => {
          if (!g.spendMoney(d.price, "Lucia's")) return;
          g.advance(d.hunger > 30 ? 40 : 15);
          bump(s, 'hunger', d.hunger); bump(s, 'energy', d.energy); bump(s, 'morale', d.morale); bump(s, 'stress', -4);
          s.counters.meals = (s.counters.meals || 0) + (d.hunger > 30 ? 1 : 0);
          g.world?.playEat?.('sandwich', (name) => g.audio?.sfx?.(name));
          g.toast(d.id === 'espresso' ? 'It is the size of a thimble and it hits like a truck.' : 'It tastes like somebody\'s grandmother is in the kitchen. Somebody\'s grandmother is in the kitchen.', 'good');
        },
      })),
      { label: 'Just the bread, thanks.', sub: 'free · the waiter sighs', effect: () => { bump(s, 'hunger', 6); g.advance(10); } },
    ],
  });
}

export function buildRestaurant(g) {
  const group = new THREE.Group();
  const W = 9, D = 8;
  group.add(plane(W, D, { name: 'lu_floor', map: tex('wood'), repeat: [5, 4] }, [0, 0, 0], [-Math.PI / 2, 0, 0]));
  group.add(plane(W, D, { name: 'lu_ceil', map: tex('ceiling'), repeat: [2, 2] }, [0, 2.9, 0], [Math.PI / 2, 0, 0]));
  const wall = retroMaterial('lu_wall', { color: 0x8a3a2a });
  group.add(box(W, 2.9, 0.16, wall, [0, 1.45, -D / 2]));
  group.add(box(W, 2.9, 0.16, wall, [0, 1.45, D / 2]));
  group.add(box(0.16, 2.9, D, wall, [-W / 2, 1.45, 0]));
  group.add(box(0.16, 2.9, D, wall, [W / 2, 1.45, 0]));
  // wainscot, framed photos of people who ate here once, a Chianti bottle on every table
  for (const sx of [-1, 1]) group.add(box(0.06, 1.0, D, M.wood, [sx * (W / 2 - 0.1), 0.5, 0]));
  for (let i = 0; i < 5; i++) group.add(box(0.5, 0.6, 0.04, retroMaterial(`lu_photo${i}`, { color: [0xd8c8a0, 0xb8a888, 0xc8b898][i % 3] }), [-3.6 + i * 1.8, 1.9, -D / 2 + 0.1]));
  const tables = [[-2.6, -1.4], [0, -1.4], [2.6, -1.4], [-2.6, 1.4], [2.6, 1.4]];
  for (const [x, z] of tables) {
    group.add(box(1.1, 0.75, 1.1, M.cloth, [x, 0.375, z]));
    group.add(box(1.14, 0.02, 1.14, M.check, [x, 0.76, z]));
    group.add(box(0.12, 0.34, 0.12, retroMaterial('lu_chianti', { color: 0x3a5a2a }), [x, 0.94, z]));
    group.add(box(0.1, 0.12, 0.1, retroMaterial('lu_candle', { color: 0xffd9a0, emissive: 1.0, unlit: true }), [x + 0.3, 0.83, z + 0.2]));
    for (const dz of [-0.8, 0.8]) group.add(box(0.5, 0.48, 0.5, M.wood, [x, 0.24, z + dz]));
  }
  // the kitchen pass at the back, with the bell
  group.add(box(3.0, 1.1, 0.6, M.wood, [0, 0.55, -D / 2 + 0.5]));
  group.add(box(3.0, 0.5, 0.1, retroMaterial('lu_pass', { color: 0xfff2c4, emissive: 0.6, unlit: true }), [0, 1.8, -D / 2 + 0.2]));
  for (const x of [-2.4, 0, 2.4]) group.add(box(0.5, 0.06, 0.5, M.lamp, [x, 2.86, 0]));
  group.add(box(1.1, 2.3, 0.14, retroMaterial('lu_door', { color: 0x5a2a1a }), [0, 1.15, D / 2 - 0.1]));

  const interactables = [
    { id: 'lu_table', label: 'Sit down and order', sub: 'pasta · chicken parm · espresso', x: 0, z: 0.6, radius: 1.4, seat: { x: 0, z: -0.6, rot: Math.PI }, action: (gg) => luciasMenu(gg) },
    { id: 'lu_openmic', label: 'Open mic', sub: music.openMicNow(g.state) ? 'tonight · the sign-up sheet is on the piano' : 'Thursdays, 20:00', x: -2.6, z: -2.4, radius: 1.2, action: (gg) => music.openMic(gg) },
    { id: 'lu_waiter', label: 'Talk to the waiter', sub: 'Sal (not that Sal)', x: 1.4, z: -2.6, radius: 1.2, action: (gg) => gg.openModal({ kicker: "LUCIA'S", title: 'Sal', body: '"Forty-one years. Sinatra ate here. He had the veal. He was rude to me and I have told everybody, every day, since." He refills your water without looking.', choices: [{ label: 'Tip him a dollar for the story.', sub: '$1', disabled: gg.state.money < 1, effect: () => { gg.spendMoney(1, 'tip'); bump(gg.state, 'morale', 3); } }, { label: 'Thank him.', effect: () => {} }] }) },
    { id: 'lu_exit', label: 'Back out to Ashby Avenue', sub: '', x: 0, z: D / 2 - 0.8, radius: 1.0, action: (gg) => gg.goTo('avenue', 'restaurant') },
  ];
  return {
    group,
    bounds: { minX: -W / 2 + 0.3, maxX: W / 2 - 0.3, minZ: -D / 2 + 0.3, maxZ: D / 2 - 0.3 },
    solids: [...tables.map(([x, z]) => solid(x, z, 1.2, 1.2, 0.8)), solid(0, -D / 2 + 0.5, 3.0, 0.7, 1.1)],
    spawn: { x: 0, z: D / 2 - 1.5, rot: Math.PI },
    npcs: [{ kind: 'waiter', x: 1.4, z: -2.6, rot: 0.3, talk: 'lu_waiter', roam: 1.2 }],
    interactables,
    ambient: 'street',
    enterToast: "Lucia's. Tablecloths, candles in bottles, Sinatra on the speaker, and a waiter who has seen everything.",
  };
}

/* ================================================================== THE 84TH PRECINCT */

/**
 * The front room of the 84th: a high front desk with a sergeant behind it, desks with cops doing
 * paperwork, cops walking through, a cop taking a statement from somebody who is still upset about
 * it, and at the back, behind a glass partition, inmates on the wall phones talking to the people
 * who came to see them.
 */
export function buildPrecinct(g) {
  const group = new THREE.Group();
  const W = 12, D = 10;
  group.add(plane(W, D, { name: 'pct_floor', map: tex('tile'), repeat: [6, 5] }, [0, 0, 0], [-Math.PI / 2, 0, 0]));
  group.add(plane(W, D, { name: 'pct_ceil', map: tex('ceiling'), repeat: [3, 3] }, [0, 3.0, 0], [Math.PI / 2, 0, 0]));
  const wall = retroMaterial('pct_wall', { color: 0xa8b8a8 });
  group.add(box(W, 3.0, 0.16, wall, [0, 1.5, -D / 2]));
  group.add(box(W, 3.0, 0.16, wall, [0, 1.5, D / 2]));
  group.add(box(0.16, 3.0, D, wall, [-W / 2, 1.5, 0]));
  group.add(box(0.16, 3.0, D, wall, [W / 2, 1.5, 0]));
  for (const x of [-3.5, 0, 3.5]) group.add(box(1.2, 0.06, 0.3, M.lamp, [x, 2.96, 0]));
  // the front desk, high, with the sergeant behind it
  group.add(box(3.6, 1.25, 0.8, M.wood, [-3.2, 0.62, 2.0]));
  group.add(box(3.7, 0.08, 0.9, retroMaterial('pct_desktop', { color: 0x3a2a1a }), [-3.2, 1.28, 2.0]));
  // three desks, chairs, typewriters, the paperwork that never ends
  const desks = [[1.4, 0.2], [3.8, 0.2], [3.8, 2.4]];
  for (const [x, z] of desks) {
    group.add(box(1.4, 0.75, 0.8, M.wood, [x, 0.375, z]));
    group.add(box(0.4, 0.18, 0.3, retroMaterial('pct_type', { color: 0x2a2c30 }), [x, 0.85, z - 0.1]));
    group.add(box(0.3, 0.05, 0.4, M.white, [x + 0.45, 0.78, z]));
    group.add(box(0.5, 0.45, 0.5, M.metal, [x, 0.225, z + 0.75]));
  }
  // the glass partition at the back, the booths, the wall phones
  group.add(box(W - 0.4, 1.0, 0.2, M.concrete, [0, 0.5, -2.6]));
  group.add(box(W - 0.4, 1.7, 0.04, { name: 'pct_glass', color: 0x9fc0c8, opacity: 0.3, transparent: true, unlit: true }, [0, 1.85, -2.6]));
  for (let i = 0; i < 4; i++) {
    const x = -4.2 + i * 2.8;
    group.add(box(0.06, 2.7, 1.0, M.metal, [x - 1.4, 1.35, -2.6]));
    group.add(box(0.14, 0.24, 0.08, retroMaterial('pct_phone', { color: 0x1a1a1a }), [x + 0.5, 1.4, -2.48]));
    group.add(box(0.14, 0.24, 0.08, retroMaterial('pct_phone', { color: 0x1a1a1a }), [x + 0.5, 1.4, -2.72]));
    for (const z of [-1.9, -3.3]) group.add(box(0.45, 0.45, 0.45, M.metal, [x, 0.22, z]));
  }
  group.add(plane(2.4, 0.4, { name: 'pct_sign', map: signTex('pctVisit', [{ text: 'VISITATION · 15 MIN · NO CONTACT', color: '#f2f2f0', size: 7 }], { w: 128, h: 18, bg: '#1e2a4a', border: '#b8c8e8' }), emissive: 0.8, unlit: true }, [0, 2.8, -2.5]));
  group.add(plane(1.0, 1.3, { name: 'pct_wanted', map: tex('poster') }, [W / 2 - 0.1, 1.7, 1.0], [0, -Math.PI / 2, 0]));
  group.add(box(1.2, 2.3, 0.12, retroMaterial('pct_door', { color: 0x2a2a30 }), [0, 1.15, D / 2 - 0.1]));
  group.add(box(2.2, 0.45, 0.5, M.wood, [3.6, 0.22, D / 2 - 0.6]));

  const npcs = [
    { kind: 'cop', x: -3.2, z: 1.3, rot: Math.PI, still: true, talk: 'pct_sgt' },
    { kind: 'cop2', x: 1.4, z: 0.95, rot: Math.PI, still: true, pose: 'sit' },
    { kind: 'cop', x: 3.8, z: 0.95, rot: Math.PI, still: true, pose: 'sit' },
    { kind: 'cop2', x: 3.8, z: 3.15, rot: Math.PI, still: true, act: 'talk' },
    { kind: 'tenant_f', x: 3.8, z: 3.9, rot: 0, still: true, act: 'argue', side: 1 },
    { kind: 'cop', x: -2, z: -1.4, walker: [-5, 5] },
    // the visit: inmates on the far side of the glass, family on this side
    { kind: 'inmate', x: -4.2, z: -3.3, rot: 0, still: true, pose: 'sit', act: 'phone' },
    { kind: 'w12', x: -4.2, z: -1.9, rot: Math.PI, still: true, pose: 'sit', act: 'phone' },
    { kind: 'inmate', x: 1.4, z: -3.3, rot: 0, still: true, pose: 'sit', act: 'phone' },
    { kind: 'tenant_m', x: 1.4, z: -1.9, rot: Math.PI, still: true, pose: 'sit', act: 'phone' },
    { kind: 'junkie', x: 3.3, z: 4.4, rot: Math.PI, still: true, pose: 'sit' },
  ];
  const interactables = [
    { id: 'pct_sgt', label: 'The desk sergeant', sub: 'he is busy (he is not busy)', x: -3.2, z: 2.9, radius: 1.4, action: (gg) => sergeant(gg) },
    { id: 'pct_visit', label: 'The visiting booths', sub: 'phones, glass, fifteen minutes', x: -1.0, z: -1.5, radius: 1.5, action: (gg) => gg.openModal({ kicker: '84TH PRECINCT', title: 'Visiting', body: 'A woman with her hand flat on the glass is telling a man in orange that the baby said "dada." He says "for real?" three times. Nobody else in the room is talking.', choices: [{ label: 'Give them the room.', effect: () => { bump(gg.state, 'morale', -2); } }] }) },
    { id: 'pct_bench', label: 'Sit on the bench', sub: 'everybody waits here', x: 3.6, z: 4.0, radius: 1.2, seat: { x: 3.6, z: 4.0, rot: Math.PI }, action: (gg) => { gg.advance(20); bump(gg.state, 'stress', -2); gg.toast('Twenty minutes on the bench. A man next to you is "just waiting for his cousin." He has been waiting since Tuesday.', 'info'); } },
    { id: 'pct_exit', label: 'Out to Ashby Avenue', sub: '', x: 0, z: D / 2 - 0.9, radius: 1.0, action: (gg) => gg.goTo('avenue', 'precinct') },
  ];
  return {
    group,
    bounds: { minX: -W / 2 + 0.3, maxX: W / 2 - 0.3, minZ: -2.3, maxZ: D / 2 - 0.3 },
    solids: [solid(-3.2, 2.0, 3.6, 0.8, 1.3), ...desks.map(([x, z]) => solid(x, z, 1.4, 0.8, 0.8)), solid(3.6, D / 2 - 0.6, 2.2, 0.5, 0.5)],
    spawn: { x: 0, z: D / 2 - 1.6, rot: Math.PI },
    npcs,
    interactables,
    ambient: 'street',
    enterToast: 'The 84th Precinct. Fluorescent light, a typewriter going, and a smell of coffee that has been on since 1986.',
  };
}

function sergeant(g) {
  const s = g.state;
  const booked = s.police?.bookings || 0;
  g.openModal({
    kicker: '84TH PRECINCT · THE DESK', title: 'Sergeant Lombardi',
    body: booked
      ? `He does not look up. "Your property? Confiscated means confiscated. You want it back, become a different person and ask again." He has ${booked > 1 ? 'a file on you now. It is getting thicker.' : 'your name on a form, misspelled.'}`
      : '"You reporting something or turning yourself in? Because the line for both is that bench."',
    choices: [
      { label: 'Ask about the neighbourhood.', sub: '10 min', effect: () => { g.advance(10); g.toast(pick(['"The alley on Kestrel? We know. Everybody knows. The guy is only there after six, like a vampire with a pager."', '"The park at night is a bad idea with good lighting. Go home."', '"Golden Fellowship? Not a crime to sell tote bags. Yet."']), 'info'); } },
      { label: 'Never mind.', sub: '', effect: () => {} },
    ],
  });
}

/* ================================================================== DEE'S WASH & FOLD */

const VENDING = [
  { id: 'soda', price: 1.0 }, { id: 'water', price: 1.0 }, { id: 'tallboy', price: 2.75 }, { id: 'chips', price: 0.75 },
];

function vending(g) {
  const s = g.state;
  g.openModal({
    kicker: "DEE'S WASH & FOLD", title: 'The Machines',
    body: 'Two vending machines that hum in different keys. One of them takes dollar bills if you smooth them out like you are apologising to them. The tall boys are in the second one, behind the water, like a secret everybody knows.',
    choices: [
      ...VENDING.map((v) => ({
        label: `${CONFIG.items[v.id].name} — ${money(v.price)}`, sub: '', disabled: s.money < v.price,
        effect: () => {
          if (!g.spendMoney(v.price, 'vending machine')) return;
          if (Math.random() < 0.07) { g.toast('The machine takes your money, thinks about it, and keeps it. You hit it once. Nothing. Twice. A can drops. Not the one you picked.', 'info'); addItem(s, 'soda', 1); return; }
          addItem(s, v.id, 1);
          g.toast(`${CONFIG.items[v.id].name}, with a thunk. It's in your pocket.`, 'good');
        },
      })),
      { label: 'Walk away.', sub: '', effect: () => {} },
    ],
  });
}

function washers(g) {
  const s = g.state;
  s.laundry = s.laundry || {};
  const day = dayOf(s.clock.m);
  if (s.laundry.checkDay === day) { g.toast('You already went through the machines today. Dee is watching you now.', 'info'); return; }
  s.laundry.checkDay = day;
  g.advance(6);
  const r = Math.random();
  let body;
  if (r < 0.45) { const c = Math.round((0.25 + Math.random() * 2.5) * 100) / 100; g.earnMoney(c, 'in the washers'); body = `${money(c)} in quarters, under a drum and in the lint trap of number 7. Laundromat money.`; }
  else if (r < 0.6) { const vals = Object.values(CONFIG.items).filter((x) => x.kind === 'valuable'); const it = pick(vals); addItem(s, it.id, 1); bump(s, 'risk', 1); body = `Stuck in the gasket of a front-loader: a ${it.name}. Somebody is going to miss that. Not today.`; }
  else if (r < 0.8) body = 'One sock. Somebody\'s, in every machine, always one. You leave the socks.';
  else body = 'Nothing but warm air and a dryer sheet. Dee clears her throat from behind the counter.';
  g.openModal({ kicker: "DEE'S WASH & FOLD", title: 'The Machines', body, choices: [{ label: 'Okay.', effect: () => {} }] });
}

function doLaundry(g) {
  const s = g.state;
  const L = CONFIG.laundromat;
  g.openModal({
    kicker: "DEE'S WASH & FOLD", title: 'Do a Load',
    body: `${money(L.washCost)} for a wash and a dry. ${L.washMinutes} minutes of watching your three shirts go round with the TV on a game show nobody chose.`,
    choices: [
      { label: `Wash and dry — ${money(L.washCost)}`, sub: `${L.washMinutes} min · clean clothes · +hygiene`, disabled: s.money < L.washCost, effect: () => {
        if (!g.spendMoney(L.washCost, 'laundry')) return;
        g.advance(L.washMinutes);
        bump(s, 'hygiene', 18); bump(s, 'morale', 5); bump(s, 'stress', -4);
        g.toast('Warm clothes out of the dryer. You stand there holding them against your face for a second longer than a grown man should.', 'good');
      } },
      { label: 'Not today.', sub: '', effect: () => {} },
    ],
  });
}

/** A quarter in the slot, and the cabinet takes over the screen until he walks away. */
function playCabinet(g, id) {
  const s = g.state;
  if (s.money < 0.25) { g.toast('Not even a quarter. The cabinet plays its attract loop at you, mockingly.', 'bad'); return; }
  g.spendMoney(0.25, `arcade: ${GAMES[id].name}`);
  g.audio?.sfx?.('cash');
  const was = g.paused;
  g.paused = true; // the block waits while he plays; the minutes are charged when he walks away
  playArcade(g, id, (score, best, record) => {
    g.paused = was;
    g.advance(Math.max(5, Math.min(40, Math.round(score / 40))));
    bump(s, 'stress', -4);
    bump(s, 'morale', record ? 8 : 3);
    g.toast(record ? `New high score on ${GAMES[id].name}: ${best}. You type in MO. Dee says "nice" without looking up, which from Dee is a parade.` : `${score} points. The cabinet asks for another quarter. It always asks for another quarter.`, record ? 'good' : 'info');
  });
}

/**
 * Dee's: a long room of washers down one wall and dryers stacked down the other, a folding table,
 * two vending machines, plastic chairs, a TV in the corner, Dee behind the counter. Mothers
 * folding, kids running the aisle. If Mo owns it, the door behind the counter is his.
 */
export function buildLaundromat(g) {
  const s = g.state;
  const group = new THREE.Group();
  const W = 10, D = 8;
  group.add(plane(W, D, { name: 'lm_floor', map: tex('tile'), repeat: [6, 5] }, [0, 0, 0], [-Math.PI / 2, 0, 0]));
  group.add(plane(W, D, { name: 'lm_ceil', map: tex('ceiling'), repeat: [3, 3] }, [0, 2.9, 0], [Math.PI / 2, 0, 0]));
  const wall = retroMaterial('lm_wall', { color: 0xb8d0d8 });
  group.add(box(W, 2.9, 0.16, wall, [0, 1.45, -D / 2]));
  group.add(box(W, 2.9, 0.16, wall, [0, 1.45, D / 2]));
  group.add(box(0.16, 2.9, D, wall, [-W / 2, 1.45, 0]));
  group.add(box(0.16, 2.9, D, wall, [W / 2, 1.45, 0]));
  for (const x of [-3, 0, 3]) group.add(box(1.4, 0.06, 0.3, M.lamp, [x, 2.86, 0]));
  // washers down the west wall (round doors), dryers stacked down the east wall
  const white = retroMaterial('lm_washer', { color: 0xe8ecec });
  const door = retroMaterial('lm_door', { color: 0x4a5a6a, emissive: 0.15 });
  for (let i = 0; i < 6; i++) {
    const z = -3.0 + i * 1.0;
    group.add(box(0.8, 0.9, 0.85, white, [-4.45, 0.45, z]));
    group.add(box(0.04, 0.42, 0.42, door, [-4.03, 0.55, z]));
    for (const y of [0.55, 1.5]) {
      group.add(box(0.8, 0.85, 0.85, white, [4.45, y, z]));
      group.add(box(0.04, 0.42, 0.42, door, [4.03, y, z]));
    }
  }
  // the folding table down the middle, a laundry basket, two plastic chairs
  group.add(box(3.4, 0.85, 1.0, retroMaterial('lm_table', { color: 0xd8d4c8 }), [0, 0.42, -0.4]));
  group.add(box(0.5, 0.35, 0.4, retroMaterial('lm_basket', { color: 0x4a8ac8 }), [-1.0, 1.02, -0.4]));
  for (let i = 0; i < 3; i++) group.add(box(0.36, 0.06, 0.3, retroMaterial(`lm_fold${i}`, { color: [0xe8e0d0, 0x8a2a3a, 0x2a4a8a][i] }), [0.6 + i * 0.4, 0.88 + i * 0.03, -0.4]));
  for (const x of [-1.6, -0.9]) group.add(box(0.45, 0.45, 0.45, retroMaterial('lm_chair', { color: 0xe86a2a }), [x, 0.22, 2.6]));
  // vending machines by the door, the TV up in the corner, Dee's counter at the back
  group.add(box(0.9, 1.9, 0.75, retroMaterial('lm_vend1', { color: 0xc8121a, emissive: 0.2 }), [2.9, 0.95, 3.4]));
  group.add(box(0.9, 1.9, 0.75, retroMaterial('lm_vend2', { color: 0x1a4a8a, emissive: 0.2 }), [3.9, 0.95, 3.4]));
  for (const x of [2.9, 3.9]) group.add(box(0.6, 1.0, 0.04, retroMaterial('lm_vendglass', { color: 0xbfe0f0, emissive: 0.6, unlit: true }), [x, 1.2, 3.02]));
  group.add(box(0.7, 0.5, 0.5, retroMaterial('lm_tv', { color: 0x1a1a1a }), [-4.4, 2.4, 3.4]));
  group.add(box(0.5, 0.36, 0.04, retroMaterial('lm_tvscreen', { map: tex('static'), emissive: 0.6, unlit: true }), [-4.4, 2.4, 3.12]));
  group.add(box(2.4, 1.05, 0.7, M.wood, [0, 0.52, -3.4]));
  group.add(box(1.0, 2.2, 0.08, M.door, [2.4, 1.1, -3.92]));
  group.add(plane(0.8, 0.2, { name: 'lm_private', map: signTex('lmPrivate', [{ text: 'PRIVATE', color: '#ff6a5a', size: 8 }], { w: 48, h: 14, bg: '#1a1a1a', border: '#5a5a5a' }), emissive: 0.6, unlit: true }, [2.4, 2.35, -3.85]));
  group.add(box(1.1, 2.3, 0.12, M.door, [0, 1.15, D / 2 - 0.1]));

  // the arcade corner, back left: three cabinets, a marquee each, and the attract screens going
  const CABS = [['snake', 'EVICTION SNAKE', '#3aff8a'], ['pac', 'PAC-MO', '#ffd23a'], ['roach', 'ROACH INVADERS', '#ff6a3a']];
  CABS.forEach(([id, title, color], i) => {
    const x = -3.3 + i * 0.85;
    const body = retroMaterial(`lm_cab${i}`, { color: [0x1a2a4a, 0x3a1a4a, 0x4a1a1a][i] });
    group.add(box(0.72, 1.7, 0.7, body, [x, 0.85, -3.45]));
    group.add(box(0.72, 0.3, 0.42, body, [x, 1.95, -3.32]));
    group.add(plane(0.66, 0.24, { name: `lm_marq${id}`, map: signTex(`lmMarq${id}`, [{ text: title, color, size: title.length > 10 ? 6 : 9 }], { w: 64, h: 20, bg: '#0a0a12', border: color }), emissive: 1.1, unlit: true }, [x, 1.95, -3.1]));
    group.add(plane(0.5, 0.4, { name: `lm_scr${id}`, map: signTex(`lmScr${id}`, [{ text: 'INSERT', color: '#e8f4ff', size: 8 }, { text: 'COIN', color, size: 10 }], { w: 48, h: 40, bg: '#05060a', border: '#1a2a3a' }), emissive: 1, unlit: true }, [x, 1.38, -3.08], [-0.2, 0, 0]));
    group.add(box(0.7, 0.08, 0.3, retroMaterial('lm_cabpanel', { color: 0x1a1a1a }), [x, 1.05, -3.05]));
    group.add(box(0.05, 0.12, 0.05, retroMaterial('lm_stick', { color: 0xc8281e }), [x - 0.12, 1.14, -3.0]));
    for (const bx of [0.05, 0.15]) group.add(box(0.06, 0.03, 0.06, retroMaterial(`lm_btn${bx}`, { color: bx < 0.1 ? 0xffd23a : 0x3a8aff }), [x + bx, 1.1, -3.02]));
  });

  const owner = market.owns(s, 'laundromat');
  const npcs = [
    { kind: 'tenant_f', x: 0, z: -2.8, rot: 0, still: true, talk: 'lm_dee' },
    { kind: 'w10', x: -0.6, z: 0.3, rot: Math.PI, still: true, act: 'fold' },
    { kind: 'w7', x: 0.9, z: 0.3, rot: Math.PI, still: true, act: 'fold' },
    // the kids, running the aisle between the machines and the table
    { kind: 'passer_m', x: -2.5, z: 1.4, walker: [-3.4, 3.4], scale: 0.58 },
    { kind: 'w3', x: 2.0, z: 1.9, walker: [-3.4, 3.4], scale: 0.55 },
    { kind: 'passer_m2', x: -1.25, z: 2.6, rot: Math.PI, still: true, pose: 'sit' },
  ];
  const interactables = [
    { id: 'lm_dee', label: 'Talk to Dee', sub: owner ? 'she works for you now' : 'she runs the place', x: 0, z: -2.4, radius: 1.3, action: (gg) => gg.openModal({ kicker: "DEE'S WASH & FOLD", title: 'Dee', body: owner ? '"Boss." She says it like a joke and also not. "Number four is making the noise again. I put a sign on it. The sign says NO. People still use it."' : '"Quarters are in the machine by the door. The change machine does not give change, it takes it. And do not sit on the folding table."', choices: [{ label: 'Got it.', effect: () => {} }] }) },
    { id: 'lm_vend', label: 'Vending machines', sub: 'soda · water · tall boys · chips', x: 3.4, z: 2.7, radius: 1.3, action: (gg) => vending(gg) },
    { id: 'lm_wash', label: 'Do a load of laundry', sub: `${money(CONFIG.laundromat.washCost)} · ${CONFIG.laundromat.washMinutes} min · +hygiene`, x: -3.6, z: -1.0, radius: 1.3, action: (gg) => doLaundry(gg) },
    { id: 'lm_check', label: 'Check the machines for change', sub: 'once a day · people leave things', x: 3.6, z: -1.0, radius: 1.3, action: (gg) => washers(gg) },
    ...['snake', 'pac', 'roach'].map((id, i) => ({
      id: `lm_arcade_${id}`, label: `Play ${GAMES[id].name}`, sub: `$0.25 · ${GAMES[id].blurb}`, x: -3.3 + i * 0.85, z: -2.5, radius: 0.6,
      action: (gg) => playCabinet(gg, id),
    })),
    { id: 'lm_tv', label: 'Sit and watch the TV', sub: '20 min', x: -1.3, z: 2.4, radius: 1.2, seat: { x: -1.6, z: 2.6, y: 0.45, rot: -1.32 }, action: (gg) => { gg.advance(20); bump(gg.state, 'stress', -4); bump(gg.state, 'morale', 2); gg.toast('A game show. A woman wins a jet ski. She lives in Queens. Everybody in the laundromat claps a little, including you.', 'info'); } },
    ...(owner ? [{ id: 'lm_back', label: 'The back room', sub: 'yours · the books, the computer', x: 2.4, z: -3.2, radius: 1.1, action: (gg) => gg.goTo('laundry_back', 'laundromat') }] : []),
    { id: 'lm_exit', label: 'Out to Ashby Avenue', sub: '', x: 0, z: D / 2 - 0.9, radius: 1.0, action: (gg) => gg.goTo('avenue', 'laundromat') },
  ];
  return {
    group,
    seats: [{ x: -0.9, z: 2.6, y: 0.45, rot: -1.32, label: 'Sit in a plastic chair' }],
    // the two machines take a punch (game3d.punchVending): a clang, and sometimes a can on the floor
    punchables: [{ kind: 'vending', x: 2.9, z: 3.4, r: 0.45, out: -0.7 }, { kind: 'vending', x: 3.9, z: 3.4, r: 0.45, out: -0.7 }],
    bounds: { minX: -W / 2 + 0.3, maxX: W / 2 - 0.3, minZ: -D / 2 + 0.3, maxZ: D / 2 - 0.3 },
    solids: [solid(-4.45, -0.5, 0.9, 6.0, 1.0), solid(4.45, -0.5, 0.9, 6.0, 2.0), solid(0, -0.4, 3.4, 1.0, 0.9), solid(0, -3.4, 2.4, 0.7, 1.1), solid(3.4, 3.4, 2.0, 0.8, 2.0), solid(-2.45, -3.45, 2.5, 0.75, 1.9)],
    spawn: { x: 0, z: D / 2 - 1.5, rot: Math.PI },
    spawnFor: (from) => (from === 'laundry_back' ? { x: 2.4, z: -2.5, rot: 0 } : { x: 0, z: D / 2 - 1.5, rot: Math.PI }),
    npcs,
    interactables,
    ambient: 'street',
    enterToast: owner ? "Dee's Wash & Fold. Yours. It smells like dryer sheets and a business plan." : "Dee's Wash & Fold. Warm air, dryer sheets, a TV nobody chose, and every machine going.",
  };
}

/** The back room, for the owner: a desk, the computer, the safe, the books. */
export function buildLaundryBack(g) {
  const group = new THREE.Group();
  const W = 4.5, D = 4;
  group.add(plane(W, D, { name: 'lb_floor', map: tex('linoleum'), repeat: [2, 2] }, [0, 0, 0], [-Math.PI / 2, 0, 0]));
  group.add(plane(W, D, { name: 'lb_ceil', map: tex('ceiling') }, [0, 2.7, 0], [Math.PI / 2, 0, 0]));
  const wall = retroMaterial('lb_wall', { color: 0x8a9a8a });
  group.add(box(W, 2.7, 0.16, wall, [0, 1.35, -D / 2]));
  group.add(box(W, 2.7, 0.16, wall, [0, 1.35, D / 2]));
  group.add(box(0.16, 2.7, D, wall, [-W / 2, 1.35, 0]));
  group.add(box(0.16, 2.7, D, wall, [W / 2, 1.35, 0]));
  group.add(box(0.5, 0.06, 0.5, M.lamp, [0, 2.66, 0]));
  group.add(box(1.6, 0.75, 0.8, M.wood, [-1.0, 0.375, -1.4]));
  group.add(box(0.5, 0.42, 0.42, retroMaterial('lb_crt', { color: 0xd8d4c8 }), [-1.2, 0.96, -1.5]));
  group.add(box(0.36, 0.28, 0.04, retroMaterial('lb_screen', { color: 0x2a6aa8, emissive: 0.7, unlit: true }), [-1.2, 0.98, -1.28]));
  group.add(box(0.8, 1.0, 0.7, retroMaterial('lb_safe', { color: 0x3a3d42 }), [1.5, 0.5, -1.4]));
  group.add(box(0.3, 0.3, 0.02, retroMaterial('lb_dial', { color: 0xb8bcc2 }), [1.5, 0.6, -1.04]));
  for (let i = 0; i < 4; i++) group.add(box(0.5, 0.36, 0.4, retroMaterial('lb_box', { color: 0xb08a5a }), [1.6, 0.18 + (i % 2) * 0.36, 1.2 - Math.floor(i / 2) * 0.45]));
  group.add(box(1.0, 2.2, 0.1, M.door, [0, 1.1, D / 2 - 0.08]));
  const interactables = [
    { id: 'lb_pc', label: 'Use the computer', sub: 'everything the laptop does', x: -1.1, z: -0.6, radius: 1.1, action: (gg) => gg.openLaptop() },
    { id: 'lb_books', label: 'The books and the safe', sub: 'wash money into your properties', x: 1.4, z: -0.6, radius: 1.1, action: (gg) => launderMenu(gg) },
    { id: 'lb_exit', label: 'Back out front', sub: '', x: 0, z: D / 2 - 0.8, radius: 1.0, action: (gg) => gg.goTo('laundromat', 'laundry_back') },
  ];
  return {
    group,
    bounds: { minX: -W / 2 + 0.3, maxX: W / 2 - 0.3, minZ: -D / 2 + 0.3, maxZ: D / 2 - 0.3 },
    solids: [solid(-1.0, -1.4, 1.6, 0.8, 0.8), solid(1.5, -1.4, 0.8, 0.7, 1.0), solid(1.6, 1.0, 0.6, 0.9, 0.8)],
    spawn: { x: 0, z: D / 2 - 1.2, rot: Math.PI },
    npcs: [],
    interactables,
    ambient: 'street',
    enterToast: 'The back room. A desk, a beige computer, a safe older than Dee, and the hum of twenty machines through the wall.',
  };
}

/** Wash cash through the machines and into a property's improvements: a level at a time. */
function launderMenu(g) {
  const s = g.state;
  const L = CONFIG.laundromat;
  const owned = Object.keys(market.marketState(s).properties);
  g.openModal({
    kicker: 'THE BACK ROOM', title: 'The Books',
    body: `Cash goes in the machines on one side of the books and comes out the other side as "renovations." The machines keep ${Math.round(L.washFee * 100)}%. Every level adds ${Math.round(L.upgradeBoost * 100)}% to a property's weekly take.\n\nThere is always a small chance somebody from the city reads the books.`,
    choices: [
      ...owned.map((id) => {
        const own = market.marketState(s).properties[id];
        const lvl = own.level || 0;
        const cost = L.upgradeCosts[lvl];
        const total = cost ? Math.round(cost * (1 + L.washFee)) : 0;
        return {
          label: `${market.PROPERTIES[id].name} — level ${lvl}${cost ? ` → ${lvl + 1}` : ' (maxed)'}`,
          sub: cost ? `${money(total)} washed in` : 'nothing left to renovate',
          disabled: !cost || s.money < total,
          effect: () => {
            const r = market.launder(g, id);
            if (r?.audit) g.openModal({ kicker: 'CITY DEPARTMENT OF FINANCE', title: 'Somebody Read the Books', body: `A man in a short-sleeved shirt and a tie asks about "these renovations." The renovations happen anyway; so does a fine of ${money(r.fine)}.`, choices: [{ label: 'Pay it.', effect: () => {} }] });
            else if (r) g.toast(`${market.PROPERTIES[id].name}: renovated to level ${r.level}. The books look beautiful. Nobody has ever looked at books this clean.`, 'good');
          },
        };
      }),
      { label: 'Close the books.', sub: '', effect: () => {} },
    ],
  });
}
