/**
 * Trouble after dark. Late at night, in the park, the alley, the lot past the clinic or on a
 * quiet stretch of Kestrel, somebody steps out and wants his wallet.
 *
 * He can hand over a little, try to run (energy decides), or fight. A fight is a few exchanges:
 * the world shows a swing meter, and a swing in the green lands. Three that land and the other
 * guy is gone (sometimes leaving something). Every miss is a hit back: energy drops, and at zero
 * Mo goes down — robbed (cash and a few things from his pockets, food first) and waking up at the
 * clinic.
 *
 * Headless: the odds, the robbery and the outcomes live here; the world draws the meter.
 */
import { CONFIG } from '../core/config.js';
import { dayOf, minuteOfDay, pick, money } from '../core/util.js';
import { bump, logLine, removeItem, inventoryList } from '../core/state.js';

const C = () => CONFIG.fights;

export function fightState(s) {
  if (!s.fights) s.fights = { won: 0, lost: 0, robbed: 0, lastDay: 0, lastAt: -9999 };
  return s.fights;
}

/** Is this a place and an hour where somebody might try it? */
export function dangerous(s, areaId, x = 0) {
  const mod = minuteOfDay(s.clock.m);
  const late = mod >= C().fromHour * 60 || mod < C().toHour * 60;
  if (!late) return false;
  if (areaId === 'park') return true;
  if (areaId === 'street') return x < -2 || x > 24; // the alley end, the walk-up end, the lot
  if (areaId === 'avenue') return true;
  return false;
}

/** Rolled by the world every so often while Mo walks somewhere dangerous. */
export function shouldMug(s, areaId, x) {
  const f = fightState(s);
  if (!dangerous(s, areaId, x)) return false;
  if (s.clock.m - f.lastAt < C().cooldownHours * 60) return false;
  return Math.random() < C().chancePerCheck;
}

export const THUG_LINES = [
  '"Ay. Ay. Wallet. Don\'t make it a thing."',
  '"Nice night. Nicer if you empty your pockets."',
  '"You know how this goes, man. Let\'s not."',
  '"Hold up. Hold up. What you got?"',
];

export function startMugging(g) {
  const f = fightState(g.state);
  f.lastAt = g.state.clock.m;
  f.lastDay = dayOf(g.state.clock.m);
  return { hp: C().thugHits, line: pick(THUG_LINES) };
}

/** Meatball to the rescue: the mugger runs, nobody gets hurt, a dog gets a reputation. */
export function dogSave(g, name) {
  const s = g.state;
  const f = fightState(s);
  f.won += 1;
  f.dogSaves = (f.dogSaves || 0) + 1;
  bump(s, 'morale', 12);
  bump(s, 'stress', -4);
  logLine(g, `${name} ran a mugger off.`, 'good');
}

/** Hand over some cash. Smaller than being robbed; safer than a fight. */
export function payOff(g) {
  const s = g.state;
  const amount = Math.min(s.money, Math.max(5, Math.round(s.money * C().payOffShare)));
  if (amount > 0) g.spendMoney(amount, 'mugged (handed it over)');
  bump(s, 'stress', 8);
  bump(s, 'morale', -6);
  logLine(g, `Handed over ${money(amount)} to a guy in the dark.`, 'bad');
  return amount;
}

/** Run: it works if he has the legs for it tonight. */
export function tryRun(g) {
  const s = g.state;
  const odds = Math.min(0.9, 0.2 + s.stats.energy / 120 - (s.high?.level || 0) / 300 - s.stats.withdrawal / 300);
  const ok = Math.random() < odds;
  bump(s, 'energy', -10);
  bump(s, 'stress', ok ? 4 : 6);
  return ok;
}

/** One exchange: a swing that landed (true) or missed. Returns the fight's state after it. */
export function exchange(g, fight, landed) {
  const s = g.state;
  if (landed) {
    fight.hp -= 1;
    bump(s, 'stress', -1);
  } else {
    bump(s, 'energy', -C().hitEnergy);
    bump(s, 'stress', 4);
  }
  if (fight.hp <= 0) { fight.over = 'won'; win(g); }
  else if (s.stats.energy <= 0) { fight.over = 'lost'; }
  return fight;
}

function win(g) {
  const s = g.state;
  const f = fightState(s);
  f.won += 1;
  bump(s, 'morale', 10);
  bump(s, 'risk', 2);
  const loot = Math.random() < 0.5 ? 10 + Math.floor(Math.random() * 30) : 0;
  if (loot) g.earnMoney(loot, 'what he dropped');
  logLine(g, `Fought somebody off${loot ? ` (he dropped ${money(loot)})` : ''}.`, 'good');
  return loot;
}

/** He went down: cash and a few things from his pockets, food first. The world sends him to the clinic. */
export function robbed(g) {
  const s = g.state;
  const f = fightState(s);
  f.lost += 1;
  f.robbed += 1;
  const cash = Math.round(s.money * (C().robCashShare[0] + Math.random() * (C().robCashShare[1] - C().robCashShare[0])) * 100) / 100;
  if (cash > 0) s.money = Math.round((s.money - cash) * 100) / 100;
  const items = inventoryList(s)
    .filter((it) => it.def && it.def.kind !== 'doc')
    .sort((a, b) => (a.def.kind === 'food' ? -1 : 0) - (b.def.kind === 'food' ? -1 : 0));
  const taken = [];
  for (const it of items.slice(0, 1 + Math.floor(Math.random() * 3))) { removeItem(s, it.id, 1); taken.push(it.def.name); }
  bump(s, 'morale', -12);
  bump(s, 'stress', 14);
  logLine(g, `Robbed: ${money(cash)}${taken.length ? ` and ${taken.join(', ')}` : ''}.`, 'bad');
  return { cash, taken };
}
