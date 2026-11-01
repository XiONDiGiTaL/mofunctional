/**
 * Nia, Mo's sister, as a person who comes over.
 *
 * She texts and calls (sms.js family replies, the nia_call event); how Mo answers is the bond,
 * `state.npc.nia`. Once it is good enough, every few days she asks if she can come by. If he says
 * yes she comes the next evening, 18:00-21:00, with food in a bag: she walks into Unit 3B, and
 * sitting down to eat with her is the best meal in the game. If he is not home she leaves the food
 * on the radiator and a text, and the bond takes a small hit. If he says no, a slightly bigger one.
 *
 * Headless; state in `state.sister`, created lazily.
 */
import { CONFIG } from '../core/config.js';
import { dayOf, minuteOfDay, pick } from '../core/util.js';
import { bump, pushMessage, addItem, logLine } from '../core/state.js';

const C = () => CONFIG.sister;

export function sisterState(s) {
  if (!s.sister) s.sister = { status: 'none', visitDay: 0, askedDay: 0, lastVisitDay: 0, visits: 0, ate: false };
  return s.sister;
}

export const bond = (s) => Number(s.npc?.nia) || 0;
export const bumpBond = (s, d) => { s.npc = s.npc || {}; s.npc.nia = Math.max(-6, Math.min(20, (Number(s.npc.nia) || 0) + d)); };

/** Every few days, if he has been decent to her, she asks to come over. */
export function sisterNewDay(g, day) {
  const s = g.state;
  const st = sisterState(s);
  if (st.status === 'asked' && day > st.askedDay + 1) st.status = 'none'; // he never answered
  if (st.status !== 'none') return;
  if (bond(s) < C().visitBond) return;
  if (st.lastVisitDay && day - st.lastVisitDay < C().cooldownDays) return;
  if (Math.random() > C().askChance) return;
  st.status = 'asked';
  st.askedDay = day;
  pushMessage(g, {
    from: 'NIA', subject: 'can i come by',
    body: pick(C().askLines),
    kind: 'nia_visit',
  });
}

/** The two answers to her text (sms.js routes the `nia_visit` message here). */
export function answerVisit(g, yes) {
  const s = g.state;
  const st = sisterState(s);
  if (st.status !== 'asked') return false;
  const day = dayOf(s.clock.m);
  if (yes) {
    st.status = 'coming';
    st.visitDay = day + 1;
    st.ate = false;
    bump(s, 'morale', 5);
    pushMessage(g, { from: 'NIA', subject: 're', body: '“ok. tomorrow, like 6. i\'m bringing food and you are going to eat it in front of me.”' });
  } else {
    st.status = 'none';
    bumpBond(s, -1);
    bump(s, 'morale', -3);
    pushMessage(g, { from: 'NIA', subject: 're', body: '“ok. another time. i\'m not going anywhere.”' });
  }
  return true;
}

/** Is she in Unit 3B right now? A schedule row for the world, like the partners'. */
export function sisterTarget(s) {
  const st = sisterState(s);
  if (st.status !== 'coming' && st.status !== 'here') return { away: true };
  const mod = minuteOfDay(s.clock.m);
  const { fromHour, toHour } = C().visit;
  if (dayOf(s.clock.m) !== st.visitDay || mod < fromHour * 60 || mod >= toHour * 60) return { away: true };
  return { area: 'apartment', x: -1.4, z: 1.7, note: st.ate ? 'washing your one pot' : 'unpacking a bag of food onto your counter' };
}

/**
 * Runs on the game clock: the visit window opening (she is "here") and closing. If it closes and
 * he was never home, the food waits on the radiator.
 */
export function sisterTick(g) {
  const s = g.state;
  const st = sisterState(s);
  if (st.status !== 'coming' && st.status !== 'here') return;
  const day = dayOf(s.clock.m);
  const mod = minuteOfDay(s.clock.m);
  const { fromHour, toHour } = C().visit;
  const inside = day === st.visitDay && mod >= fromHour * 60 && mod < toHour * 60;
  if (inside && st.status === 'coming') {
    st.status = 'here';
    st.metMo = g.world?.areaId === 'apartment';
    if (!st.metMo) pushMessage(g, { from: 'NIA', subject: '', body: '“i\'m at your door. it smells like a radiator in here. where are you”' });
  }
  if (g.world?.areaId === 'apartment' && st.status === 'here') st.metMo = true;
  const over = day > st.visitDay || (day === st.visitDay && mod >= toHour * 60);
  if (over) finishVisit(g);
}

function finishVisit(g) {
  const s = g.state;
  const st = sisterState(s);
  st.status = 'none';
  st.lastVisitDay = dayOf(s.clock.m);
  if (st.metMo) {
    st.visits += 1;
    bumpBond(s, 1);
    logLine(g, 'Nia came over.', 'good');
    if (!st.ate) {
      addItem(s, 'nia_meal', 1);
      pushMessage(g, { from: 'NIA', subject: '', body: '“you didn\'t eat. it\'s in your fridge. i\'m not mad. (i\'m a little mad.)”' });
    }
  } else {
    bumpBond(s, -1);
    addItem(s, 'nia_meal', 1);
    pushMessage(g, { from: 'NIA', subject: '', body: '“you weren\'t home. food is in a bag on your radiator. heat it up. call me back.”' });
    logLine(g, 'Nia came by. You were not home.', 'bad');
  }
}

/** Sitting down to eat what she brought: the best meal in the game, once per visit. */
export function eatWithNia(g) {
  const s = g.state;
  const st = sisterState(s);
  if (st.status !== 'here' || st.ate) return false;
  st.ate = true;
  const m = C().meal;
  g.advance(m.minutes, { social: true });
  bump(s, 'hunger', m.hunger);
  bump(s, 'energy', m.energy);
  bump(s, 'morale', m.morale);
  bump(s, 'stress', m.stress);
  s.counters.meals = (s.counters.meals || 0) + 1;
  bumpBond(s, 1);
  return true;
}

/** She goes home early (he asked, or it is late). */
export function sayGoodnight(g) {
  const st = sisterState(g.state);
  if (st.status !== 'here') return;
  st.visitDay = dayOf(g.state.clock.m) - 1; // the window is over
  finishVisit(g);
}
