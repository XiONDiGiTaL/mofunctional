/**
 * Mo's hands.
 *
 * One key throws a punch at whoever is closest. What happens next depends on who it is, and the
 * whole point is that the world answers back:
 *
 *   a cop        two punches and he stops asking questions: the chase starts and it ends in cuffs
 *   a kid        nothing. He will not do it, and the game says so. The bike kid is faster anyway.
 *   a dog        he can. He loses something for it, and the dog remembers.
 *   a dealer     they fight. Dealers are the ones who never run; they have a corner to keep.
 *   a thug       they fight, and if they are carrying, the fight is not a fistfight any more
 *   a civilian   most of them run. Somebody's uncle does not run, and he hits back.
 *
 * A knocked-out person can be searched once. Children are never knocked out and never searched.
 *
 * Headless: the odds and the loot are here; the world draws the arm and moves the people.
 */
import { CONFIG } from '../core/config.js';
import { dayOf, pick, money, randInt } from '../core/util.js';
import { bump, logLine, addItem, countItem } from '../core/state.js';

const C = () => CONFIG.brawl;

const COP_KINDS = new Set(['cop', 'cop2', 'patrol', 'sergeant']);
const KID_KINDS = new Set(['kid', 'kid_bike', 'bike_kid', 'child', 'boy', 'girl', 'schoolkid']);
const DOG_KINDS = new Set(['dog', 'meatball', 'stray']);
const DEALER_KINDS = new Set(['dex', 'dealer', 'pusher', 'squeak', 'corner']);
const TOUGH_KINDS = new Set(['thug', 'mugger', 'tough', 'goon', 'projects_thug', 'armed']);

export function brawlState(s) {
  if (!s.brawl) s.brawl = {};
  const b = s.brawl;
  b.punches = Number(b.punches) || 0;
  b.knockouts = Number(b.knockouts) || 0;
  b.copPunches = Number(b.copPunches) || 0;
  b.dogPunches = Number(b.dogPunches) || 0;
  b.searched = b.searched && typeof b.searched === 'object' ? b.searched : {};
  b.lastSwingAt = Number(b.lastSwingAt) || -9999;
  b.hp = b.hp && typeof b.hp === 'object' ? b.hp : {};
  return b;
}

/** What kind of person is on the other end of this. */
export function classify(kind = '', def = {}) {
  const k = String(kind || '').toLowerCase();
  if (def.cop || COP_KINDS.has(k)) return 'cop';
  if (def.kid || KID_KINDS.has(k)) return 'kid';
  if (def.dog || DOG_KINDS.has(k) || /dog/.test(k)) return 'dog';
  if (def.dealer || DEALER_KINDS.has(k) || /deal/.test(k)) return 'dealer';
  if (def.tough || TOUGH_KINDS.has(k) || /thug/.test(k)) return 'tough';
  return 'civilian';
}

const IMPORTANT_KINDS = new Set([
  'nurse', 'rae', 'dale', 'kev', 'dex', 'habib', 'gus', 'squeak', 'addison', 'nia',
  'clerk', 'shopkeeper', 'owner', 'cashier', 'barkeep', 'booker', 'priest', 'pastor', 'deacon',
]);

/** Somebody with a counter, a till or a job to lose: these are the ones who call it in. */
export function isImportant(kind = '', def = {}) {
  return !!(def.talk || def.important || IMPORTANT_KINDS.has(String(kind || '').toLowerCase()));
}

/**
 * A punch thrown at somebody who works here. Three in a day and the phone comes out; the cruiser
 * takes a few minutes to arrive, and then it is the ordinary arrest, with the ordinary fine.
 */
export function assault(g, id = 'somebody') {
  const s = g.state;
  const b = brawlState(s);
  const day = dayOf(s.clock.m);
  b.heat = b.heat && typeof b.heat === 'object' ? b.heat : {};
  const row = b.heat[id] && b.heat[id].day === day ? b.heat[id] : { n: 0, day };
  row.n += 1;
  b.heat[id] = row;
  if (row.n >= C().reportAfter && !b.alert) {
    const wait = randInt(C().alertMinutes[0], C().alertMinutes[1]);
    b.alert = { id, at: s.clock.m + wait };
    logLine(g, 'Behind the counter, somebody picks up the phone and turns their back to you.', 'bad');
    return { called: true, inMinutes: wait, n: row.n };
  }
  return { called: false, n: row.n, left: Math.max(0, C().reportAfter - row.n) };
}

/** The call has worked its way through: the cruiser is on the block. */
export function alertDue(s) {
  const b = brawlState(s);
  return !!b.alert && s.clock.m >= b.alert.at;
}

export function clearAlert(s) {
  const b = brawlState(s);
  const a = b.alert || null;
  b.alert = null;
  return a;
}

/** How many landed punches a kind of person takes before they go down. */
export function hpFor(target = {}) {
  const kind = classify(target.kind, target);
  if (kind === 'tough') return C().toughHp;
  if (kind === 'dealer') return C().dealerHp;
  return C().civilianHp;
}

/** Can he swing right now? The world also checks that somebody is in range. */
export function canSwing(s) {
  return s.clock.m - brawlState(s).lastSwingAt >= 1; // one swing a minute, in game time is too slow
}

/** Record a swing. Returns false if he is still recovering from the last one. */
export function beginSwing(s) {
  const b = brawlState(s);
  b.punches += 1;
  b.lastSwingAt = s.clock.m;
  bump(s, 'energy', -1);
  bump(s, 'stress', -1);
  return true;
}

/**
 * The arm lands. Returns what happened, so the world can animate and the UI can say it:
 *   { kind, result: 'refused'|'dog'|'cop'|'ko'|'hurt'|'fled'|'fight', hp, line }
 */
export function strike(g, target = {}) {
  const s = g.state;
  const b = brawlState(s);
  const kind = classify(target.kind, target);
  beginSwing(s);

  if (kind === 'kid') {
    bump(s, 'morale', C().kidMorale);
    return { kind, result: 'refused', line: 'You are not doing that. Not to a kid. He rides off anyway, one-handed, ringing a bell at you.' };
  }

  if (kind === 'dog') {
    b.dogPunches += 1;
    const dog = s.dog || (s.dog = { like: 0, name: 'Meatball' });
    const before = Number(dog.like) || 0;
    dog.like = Math.max(0, before + C().dogLike);
    bump(s, 'morale', -4);
    bump(s, 'stress', 3);
    logLine(g, `Kicked ${dog.name}. He yelps and goes under a car.`, 'bad');
    return { kind, result: 'dog', lost: before - dog.like, line: `${dog.name} yelps, gets low, and looks at you like a question you cannot answer. He keeps his distance now.` };
  }

  if (kind === 'cop') {
    b.copPunches += 1;
    bump(s, 'risk', C().copRisk);
    bump(s, 'stress', 10);
    logLine(g, 'Punched a cop.', 'bad');
    return { kind, result: 'cop', line: 'Your knuckles find the badge before the face. The radio is already at his mouth.' };
  }

  // Every punch is worth one, and everybody takes more than one: nobody folds on the first hit.
  // Health belongs to the person, not to their kind, so `key` must identify a body, and the
  // world hands the running total back in on the next swing.
  const maxHp = Number(target.maxHp) || hpFor(target);
  const id = target.key || target.kind || 'somebody';
  const label = target.label || (kind === 'civilian' ? 'somebody' : kind);
  const before = Number.isFinite(target.hp) ? Math.min(target.hp, maxHp) : b.hp[id] ?? maxHp;
  const hp = Math.max(0, before - 1);
  b.hp[id] = hp;

  if (hp <= 0) {
    delete b.hp[id];
    b.knockouts += 1;
    bump(s, 'risk', kind === 'civilian' ? 3 : 1);
    logLine(g, `Knocked out ${label}.`, 'bad');
    return { kind, result: 'ko', hp: 0, maxHp, line: pick(KO_LINES), lootable: true, id, label };
  }

  // somebody who has taken two thinks about the rest of their evening
  if (kind === 'civilian' && hp <= maxHp - 2 && Math.random() < C().fleeChance) {
    return { kind, result: 'fled', hp, maxHp, line: pick(FLEE_LINES) };
  }

  // they hit back: a civilian's uncle, a dealer with a ring on, a thug with everything to lose
  const back = kind === 'civilian' ? 4 : kind === 'dealer' ? 7 : 10;
  bump(s, 'energy', -back);
  bump(s, 'stress', 5);
  return { kind, result: 'fight', hp, maxHp, hitBack: back, line: pick(HIT_BACK[kind] || HIT_BACK.civilian) };
}

const KO_LINES = [
  'He goes down in stages, like a building being demolished in a documentary.',
  'One knee, then the other, then the pavement, which has been there the whole time.',
  'He sits down where he was standing, carefully, and then lies back.',
];
const FLEE_LINES = [
  'She is already moving. \"CRAZY!\" she says, to the whole block, not to you.',
  'He puts a parked car between you in under a second and keeps going.',
  'They run without a sound, which is worse than shouting.',
  'Somebody\'s grandmother raises her bag like a shield and retreats in good order.',
];
const HIT_BACK = {
  civilian: [
    'He swings back with more technique than a man in those shoes should have. It lands.',
    'Her purse catches your ear. It weighs more than it looks.',
    '\"YOU DON\'T KNOW ME!\" and then you find out that you do not.',
  ],
  dealer: [
    'He is not surprised, which is the worst part. The ring on his hand does the talking.',
    'His elbow finds your ribs, practised, bored, like he has a shift.',
    'He comes back with a hook and a sentence about disrespect.',
  ],
  tough: [
    'He takes it, smiles with blood in his teeth, and puts you into the wall.',
    'The second one does not come from your hands. It comes from his forehead.',
    'He is bigger in every direction and he has done this on purpose before.',
  ],
};

/** What was in their pockets. Once each; a knocked-out civilian is not a vending machine. */
export function loot(g, target = {}) {
  const s = g.state;
  const b = brawlState(s);
  const kind = classify(target.kind, target);
  const id = target.key || target.kind || 'somebody';
  if (kind === 'kid') return { ok: false, reason: 'no' };
  if (b.searched[id]) return { ok: false, reason: 'searched' };
  b.searched[id] = dayOf(s.clock.m);
  const found = [];
  let cash = 0;
  if (kind === 'dealer') { cash = 8 + Math.round(Math.random() * 42); if (Math.random() < 0.5) found.push(pick(['mud', 'static'])); }
  else if (kind === 'tough') { cash = 20 + Math.round(Math.random() * 90); if (Math.random() < 0.45) found.push(pick(['mud_x', 'static_x'])); if (Math.random() < 0.3) found.push(pick(['watch', 'chain'])); }
  else if (kind === 'cop') { cash = 0; }
  else { cash = Math.round(Math.random() * 14); if (Math.random() < 0.25) found.push('loosies'); }
  if (cash > 0) g.earnMoney(cash, 'somebody\'s pockets');
  for (const id2 of found) addItem(s, id2, 1);
  bump(s, 'morale', cash > 0 ? 2 : 0);
  logLine(g, `Searched a knocked-out ${kind === 'civilian' ? 'man' : kind}${cash ? `: ${money(cash)}` : ''}.`, 'bad');
  return { ok: true, cash, items: found };
}

/** The armed thug's gun: he will not carry it, and the refusal is the character beat. */
export const GUN_REFUSAL = 'Live by the gun, die by the gun, and I like living, so this is not for me. He leaves it where it fell, because touching it is a decision.';
