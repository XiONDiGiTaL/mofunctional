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
import * as THREE from '../../vendor/three.module.js';
import { retroMaterial, box, plane } from '../render/retro.js';
import { tex } from '../render/textures.js';
import { signTex } from '../render/signs.js';
import { CONFIG } from '../core/config.js';
import { money, pick, dayOf, minuteOfDay, randInt } from '../core/util.js';
import { bump, addItem, removeItem, countItem, inventoryList, logLine } from '../core/state.js';
import * as romance from '../systems/romance.js';
import { partnerTarget } from './schedules.js';
import * as market from '../systems/market.js';

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
    body: 'A box the size of a phone booth. A sign: CAPACITY 4 PERSONS (2 ADULTS). Somebody has scratched "PRAY" into the brass next to the emergency button.',
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
    interactables.push({ id: 'wu_mail', label: 'Read the mailboxes', sub: 'names, tape, one that says DO NOT', x: -W / 2 + 0.6, z: 1.5, radius: 1.0, action: (gg) => gg.openModal({ kicker: '1104 KESTREL · LOBBY', title: 'The Mailboxes', body: '2A RAY & DENISE (DENISE crossed out, written back in). 3B PETRAKIS. 4A — no name, just a drawing of a squeaky toy. 5C S. — a sticker of a cartoon bench. 5D VACANT, which is a lie: you can hear a radio.', choices: [{ label: 'Huh.', effect: () => {} }] }) });
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
    npcs.push({ kind: 'tenant_m', x: -0.5, z: 1.0, rot: 1.4, talk: 'wu_couple', still: true });
    npcs.push({ kind: 'tenant_f', x: 0.5, z: 1.1, rot: -1.6, talk: null, still: true });
    interactables.push({ id: 'wu_couple', label: 'Ray & Denise', sub: 'mid-argument (always)', x: 0, z: 1.05, radius: 1.3, action: (gg) => coupleMenu(gg) });
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
  group.add(plane(L, 9, { name: 'av_sw', map: tex('sidewalk'), repeat: [10, 3] }, [0, 0, -2.0], [-Math.PI / 2, 0, 0]));
  group.add(plane(L, 9, { name: 'av_road', map: tex('asphalt'), repeat: [12, 3] }, [0, -0.01, 6.0], [-Math.PI / 2, 0, 0]));
  group.add(box(L, 0.18, 0.4, M.concrete, [0, 0.09, 1.5]));
  // the avenue's own skyline: taller, louder, more signs than Kestrel
  const facade = (x, w, h, color) => {
    group.add(box(w, h, 1.2, retroMaterial(`av_fac${x}`, { map: tex('brick'), color }), [x, h / 2, -7.0]));
    for (let r = 1; r < Math.floor(h / 1.7); r++) for (let c = 0; c < Math.floor(w / 2.2); c++) {
      group.add(plane(0.9, 1.0, { name: 'av_win', map: tex('window'), emissive: Math.random() < 0.4 ? 0.45 : 0.08, unlit: true }, [x - w / 2 + 1.1 + c * 2.2, 1.4 + r * 1.7, -6.38]));
    }
  };
  facade(-12.5, 8, 12, 0xb0a48c);
  facade(-4.5, 7, 9, 0x9a5a4a);
  facade(3.0, 7, 14, 0xc8c0b0);
  facade(10.5, 7, 10, 0x8a8478);
  // Lucia's: green awning, a lit script sign, a menu in the window
  group.add(box(6.0, 0.16, 1.2, retroMaterial('av_awning', { color: 0x2a5a3a }), [-4.5, 3.0, -5.9]));
  group.add(box(1.2, 2.3, 0.12, retroMaterial('av_ldoor', { color: 0x5a2a1a }), [-4.5, 1.15, -6.32]));
  group.add(plane(3.2, 0.7, { name: 'av_lsign', map: signTex('signLucias', [{ text: "Lucia's", color: '#ffe9b0', size: 16 }, { text: 'TRATTORIA · SINCE 1961', color: '#e8c070', size: 6 }], { w: 128, h: 32, bg: '#3a1a12', border: '#c8a050' }), emissive: 1, unlit: true }, [-4.5, 3.6, -6.3]));
  group.add(plane(2.6, 2.0, { name: 'av_lpool', color: 0xffd9a0, opacity: 0.16, transparent: true, unlit: true }, [-4.5, 0.035, -5.0], [-Math.PI / 2, 0, 0]));
  // the pawn shop, gold letters on black
  group.add(box(1.1, 2.3, 0.12, M.door, [10.5, 1.15, -6.32]));
  group.add(plane(3.0, 0.6, { name: 'av_psign', map: signTex('signPawn', [{ text: 'ASHBY PAWN & GOLD', color: '#ffd23a', size: 10 }, { text: 'WE BUY ANYTHING (ALMOST)', color: '#e8e0c0', size: 6 }], { w: 128, h: 28, bg: '#0e0e0e', border: '#ffd23a' }), emissive: 1, unlit: true }, [10.5, 3.0, -6.3]));
  // the newsstand: a green box with a man inside it
  group.add(box(2.2, 2.2, 1.4, retroMaterial('av_kiosk', { color: 0x2a5a3a }), [3.0, 1.1, -3.8]));
  group.add(box(2.0, 0.5, 0.2, retroMaterial('av_papers', { color: 0xe8e0c8 }), [3.0, 1.0, -3.0]));
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
    { kind: pick(['w0', 'w3', 'w8', 'w12', 'w19']), x: -2, z: -1.0, walker: [-15, 15] },
    { kind: 'passer_m', x: 7.5, z: -4.4, rot: 0, talk: 'av_sax', still: true },
  ];
  const s = g.state;
  const interactables = [
    { id: 'av_lucias', label: "Enter Lucia's", sub: 'tablecloths · red sauce · a waiter in a vest', x: -4.5, z: -5.2, radius: 1.5, action: (gg) => gg.goTo('restaurant', 'avenue') },
    { id: 'av_pawn', label: 'Ashby Pawn & Gold', sub: 'sell something, fast and cheap', x: 10.5, z: -5.2, radius: 1.5, action: (gg) => pawnMenu(gg) },
    { id: 'av_news', label: 'The newsstand', sub: `a paper · ${money(0.5)}`, x: 3.0, z: -2.5, radius: 1.3, action: (gg) => newsstand(gg) },
    { id: 'av_sax', label: 'The sax player', sub: 'plays one song very well', x: 7.5, z: -4.0, radius: 1.3, action: (gg) => gg.openModal({ kicker: 'ASHBY AVE.', title: 'The Sax Player', body: 'He plays the same song every day and every day it is better than it needs to be. His case has four dollars and a subway token in it.', choices: [
      { label: 'Drop a dollar in the case.', sub: '$1 · +morale', disabled: s.money < 1, effect: () => { gg.spendMoney(1, 'sax player'); bump(s, 'morale', 5); bump(s, 'stress', -3); gg.toast('He nods without stopping. That is the deal.', 'good'); } },
      { label: 'Stand and listen for a song.', sub: '10 min', effect: () => { gg.advance(10); bump(s, 'morale', 3); bump(s, 'stress', -4); } },
      { label: 'Keep walking.', sub: '', effect: () => {} },
    ] }) },
    { id: 'av_bus', label: 'The bus stop', sub: 'B44 back to Kestrel', x: 12.5, z: 0.0, radius: 1.5, action: (gg) => busMenu(gg, 'avenue') },
  ];
  let timer = 10;
  const tick = (gg, dt) => {
    timer -= dt;
    if (timer > 0 || gg.modalOpen || gg.phoneOpen) return;
    timer = 18 + Math.random() * 14;
    gg.toast(pick([
      'A cab leans on its horn for a full block for no reason anyone can see.',
      'Somebody walks past on a phone the size of a brick, yelling "SELL" into it.',
      'Two kids on one bike. The one on the handlebars is steering.',
      'A man is selling batteries out of a duffel bag. "Double A, triple A, quadruple A."',
      'The smell from Lucia\'s door reaches the bus stop. It is garlic. It is a lot of garlic.',
    ]), 'info');
  };
  return {
    group,
    bounds: { minX: -15.5, maxX: 15.5, minZ: -5.6, maxZ: 1.3 },
    camBounds: { minX: -17, maxX: 17, minZ: -5.6, maxZ: 9 },
    solids: [solid(3.0, -3.8, 2.2, 1.4), solid(12.5, 0.6, 0.3, 0.3)],
    spawn: { x: 12.0, z: -0.6, rot: Math.PI },
    spawnFor: (from) => (from === 'restaurant' ? { x: -4.5, z: -3.6, rot: 0 } : { x: 12.0, z: -0.6, rot: -Math.PI / 2 }),
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
    body: `The man in the box has a radio, a cigar he is not smoking, and every paper in the city.\n\nToday: "${pick(HEADLINES)}"`,
    choices: [
      { label: 'Buy a paper and read it.', sub: `${money(0.5)} · 20 min · +morale`, disabled: s.money < 0.5, effect: () => { if (!g.spendMoney(0.5, 'newspaper')) return; g.advance(20); bump(s, 'morale', 4); bump(s, 'stress', -3); g.toast('You read the whole thing, including the horoscope. Yours says "a door opens." It does not say which.', 'good'); } },
      { label: 'Scratch-off ticket.', sub: `${money(2)} · probably not`, disabled: s.money < 2, effect: () => {
        if (!g.spendMoney(2, 'scratch-off')) return;
        const r = Math.random();
        const win = r < 0.01 ? 500 : r < 0.05 ? 20 : r < 0.2 ? 2 : 0;
        if (win) g.earnMoney(win, 'scratch-off');
        g.toast(win ? `$${win}! The man in the box says "huh."` : 'Nothing. Silver dust on your thumb. Same as always.', win ? 'good' : 'info');
      } },
      { label: 'Just look at the headlines.', sub: '', effect: () => {} },
    ],
  });
}

/** Sell a valuable for a fraction of what BidBay would get, but right now. */
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
    { id: 'lu_table', label: 'Sit down and order', sub: 'pasta · chicken parm · espresso', x: 0, z: 0.6, radius: 1.4, action: (gg) => luciasMenu(gg) },
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
