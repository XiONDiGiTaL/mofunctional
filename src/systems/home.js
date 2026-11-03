/**
 * Unit 3B as a record of how the run is going.
 *
 * Repairs and practical upgrades are always on the list (fix the shower, a new mattress, the
 * fridge, a hot plate, a secondhand couch, and the leak when there is one). The nicer things (a
 * flatscreen on the wall, a desktop, a real bed, wallpaper, a rug, a plant) need the Home
 * Decorator's Guide from the newsstand first, which is the joke and also the gate.
 *
 * What is installed lives in `s.home.owned`; areas.buildApartment reads it and draws it, so the
 * flat looks the way the run has gone. The effects are small and practical: a shorter shower, a
 * better night, less spoiled food, a little morale every morning from a place worth waking up in.
 */
import { CONFIG } from '../core/config.js';
import { bump, logLine, pushMessage, addItem } from '../core/state.js';
import { money, dayOf, pick } from '../core/util.js';

export const UPGRADES = [
  // repairs and practical things: no guide needed
  { id: 'shower', name: 'Fix the shower', price: 60, kind: 'repair', note: 'a plumber, a washer, an afternoon · showers take 15 min and do more', comfort: 1 },
  { id: 'mattress', name: 'A new mattress', price: 90, kind: 'repair', note: 'secondhand, but somebody else’s shape is gone · better rest per hour', comfort: 1 },
  { id: 'fridge', name: 'Fix the fridge', price: 45, kind: 'repair', note: 'a new seal and a kick in the right place · food keeps longer', comfort: 1 },
  { id: 'hotplate', name: 'A hot plate', price: 25, kind: 'repair', note: 'two burners, one works · cook a cheap batch at the stove', comfort: 0 },
  { id: 'couch', name: 'A secondhand couch', price: 70, kind: 'repair', note: 'from the curb on Garnet, mostly clean · sit, nap, have people over', comfort: 2 },
  // decor: the Home Decorator's Guide unlocks these
  { id: 'tv_flat', name: 'Flatscreen TV, wall-mounted', price: 240, kind: 'decor', note: 'the CRT goes to the curb · TV evenings are better', comfort: 2 },
  { id: 'computer', name: 'A desktop computer', price: 320, kind: 'decor', note: 'a tower, a big monitor, a modem that screams less · the internet costs less time', comfort: 1 },
  { id: 'bed_new', name: 'A real bed', price: 260, kind: 'decor', note: 'queen, a headboard, sheets that match · the best rest in the borough', comfort: 3, needs: 'mattress' },
  { id: 'wallpaper', name: 'New wallpaper', price: 60, kind: 'decor', note: 'over the stains, mostly · the room feels like a choice', comfort: 2 },
  { id: 'rug', name: 'A rug', price: 55, kind: 'decor', note: 'over the linoleum, where your feet go first', comfort: 1 },
  { id: 'floors', name: 'Refinish the floors', price: 120, kind: 'decor', note: 'the linoleum comes up, there is wood under it, of course there is', comfort: 2 },
  { id: 'drapes', name: 'Drapes for the windows', price: 30, kind: 'decor', note: 'two windows, four panels, any colour you want after', comfort: 1 },
  { id: 'mirror', name: 'A tall mirror', price: 45, kind: 'decor', note: 'leaning by the door, the way they do in magazines', comfort: 1 },
  { id: 'plant', name: 'A plant', price: 18, kind: 'decor', note: 'a pothos, unkillable, which is the point', comfort: 1 },
  { id: 'lamp', name: 'A floor lamp', price: 35, kind: 'decor', note: 'warm light that is not the ceiling bulb', comfort: 1 },
];
export const upgradeById = (id) => UPGRADES.find((u) => u.id === id) || null;

export function homeState(s) {
  if (!s.home) s.home = {};
  const h = s.home;
  h.owned = Array.isArray(h.owned) ? h.owned : [];
  return h;
}
export const has = (s, id) => homeState(s).owned.includes(id);
export const comfort = (s) => homeState(s).owned.reduce((n, id) => n + (upgradeById(id)?.comfort || 0), 0);

/** What is on the list right now: everything practical, and the decor once he has the guide. */
export function available(s) {
  const guide = !!s.flags?.decorGuide;
  return UPGRADES.filter((u) => (u.kind === 'repair' || guide) && (!u.needs || has(s, u.needs)));
}

export function buy(g, id) {
  const s = g.state;
  const u = upgradeById(id);
  if (!u || has(s, id)) return { ok: false, reason: 'owned' };
  if (s.money < u.price) return { ok: false, reason: 'short' };
  g.spendMoney(u.price, `home: ${u.name}`);
  homeState(s).owned.push(id);
  g.advance(id === 'shower' || id === 'computer' || id === 'tv_flat' ? 90 : 30);
  bump(s, 'morale', 3 + (u.comfort || 0) * 2);
  logLine(g, `Unit 3B: ${u.name} (${money(u.price)}).`, 'good');
  return { ok: true, u };
}

/** The leak: it starts on its own, and it costs more the longer it is a bucket. */
export function homeNewDay(g, day) {
  const s = g.state;
  const h = homeState(s);
  // a little morale every morning from a place worth waking up in
  const c = comfort(s);
  if (c > 0) bump(s, 'morale', Math.min(6, c * 0.6));
  if (h.leak) {
    const age = day - h.leak;
    if (h.leakRaeDay && day >= h.leakRaeDay) {
      h.leak = 0; h.leakRaeDay = 0;
      pushMessage(g, { from: 'RAE VELL (LANDLORD)', subject: 'the leak', body: 'Sent a guy. Leak is fixed. He says it was "a whole thing." It was a washer. You are welcome.' });
    } else if (age === 3) {
      const dmg = 60;
      s.money = Math.max(0, Math.round((s.money - Math.min(dmg, s.money)) * 100) / 100);
      bump(s, 'stress', 10);
      bump(s, 'morale', -6);
      logLine(g, `The leak got into the floor. ${money(dmg)} in damage out of your pocket.`, 'bad');
      pushMessage(g, { from: 'RAE VELL (LANDLORD)', subject: 'the floor', body: `The unit below says your ceiling is now their ceiling problem. That is ${money(dmg)} from you. Should have said something.` });
    }
  } else if (!h.owned.includes('leakproof') && Math.random() < 0.06 && day > 3) {
    h.leak = day;
    pushMessage(g, { from: 'HECTOR', subject: 'your ceiling', body: 'Mo, you have a drip by the window. I heard it through the wall. Put a pot under it. Tell Rae, or fix it yourself, but do not wait, these things grow.' });
  }
}

/** Fix the leak now: pay a plumber, do it yourself (time, a chance), or tell Rae (free, slow). */
export function leakMenu(g) {
  const s = g.state;
  const h = homeState(s);
  if (!h.leak) { g.toast('The ceiling is dry. Enjoy it while it lasts.', 'info'); return; }
  const day = dayOf(s.clock.m);
  g.openModal({
    kicker: 'UNIT 3B', title: 'The Leak',
    body: `A drip by the window, into a pot, all day and all night. It started on day ${h.leak}. If it is still going on day ${h.leak + 3}, it goes through the floor and becomes the downstairs neighbour's problem, which becomes yours.${h.leakRaeDay ? `\n\nRae says he will send a guy on day ${h.leakRaeDay}. Rae says a lot of things.` : ''}`,
    choices: [
      { label: 'Call a plumber.', sub: `${money(35)} · fixed today`, disabled: s.money < 35, effect: () => { g.spendMoney(35, 'plumber'); h.leak = 0; h.leakRaeDay = 0; g.advance(60); g.toast('A man named Sal fixes it in eleven minutes and charges for an hour. The drip stops. The silence is enormous.', 'good'); } },
      { label: 'Fix it yourself.', sub: '1 h · it might hold', effect: () => { g.advance(60); bump(s, 'energy', -6); if (Math.random() < 0.6) { h.leak = 0; h.leakRaeDay = 0; bump(s, 'morale', 5); g.toast('Tape, a wrench from Hector and a lot of swearing. It holds. You are, briefly, a man who fixes things.', 'good'); } else g.toast('You make it worse, then about the same. The pot is still under it.', 'bad'); } },
      { label: 'Tell Rae.', sub: 'free · he says two days', disabled: !!h.leakRaeDay, effect: () => { h.leakRaeDay = day + 2; g.toast('"I\'ll get right on that." Two days, he says. Keep the pot where it is.', 'info'); } },
      { label: 'Leave the pot under it.', effect: () => {} },
    ],
  });
}

/** The fix-up list, from the apartment. */
export function fixUpMenu(g) {
  const s = g.state;
  const list = available(s);
  const owned = homeState(s).owned;
  g.openModal({
    kicker: 'UNIT 3B · FIXING IT UP', title: 'What The Place Needs',
    body: `${s.flags?.decorGuide ? 'The Home Decorator\'s Guide is open on the table at a page with a lamp on it.' : 'Repairs and the practical things. (The nicer stuff, a guide at the newsstand swears it can teach you.)'}\n\nInstalled: ${owned.length ? owned.map((id) => upgradeById(id)?.name).filter(Boolean).join(', ') : 'nothing yet, which you can tell by looking'}.`,
    choices: [
      ...list.filter((u) => !owned.includes(u.id)).map((u) => ({
        label: `${u.name} · ${money(u.price)}`, sub: u.note, disabled: s.money < u.price,
        effect: () => {
          const r = buy(g, u.id);
          if (r.ok) { g.toast(`${u.name}. The place looks like somebody lives here on purpose.`, 'good'); g.world?.loadArea?.('apartment', g); }
        },
      })),
      ...(homeState(s).leak ? [{ label: 'Deal with the leak.', sub: `since day ${homeState(s).leak}`, effect: () => setTimeout(() => leakMenu(g), 60) }] : []),
      { label: 'Not today.', effect: () => {} },
    ],
  });
}

/** Cook a batch on the hot plate: three cheap meals for the fridge. */
export function cookBatch(g) {
  const s = g.state;
  if (!has(s, 'hotplate')) { g.toast('The stove has two dials and no opinion. A hot plate would help.', 'info'); return; }
  if (s.money < 6) { g.toast('Rice and beans for three is six dollars. You do not have six dollars.', 'bad'); return; }
  g.spendMoney(6, 'groceries for a batch');
  g.advance(45);
  addItem(s, 'batch_meal', 3);
  bump(s, 'morale', 4);
  logLine(g, 'Cooked a batch: three meals of rice and beans.', 'good');
  g.toast('Rice, beans, an onion, the last of the hot sauce. Three containers. Your mother would say it needs salt. It needs salt.', 'good');
}

/** What could go in the pot: every substance he is holding except ROX itself. */
function cookable(s) {
  return (s.inventory || []).filter((i) => i.qty > 0 && i.id !== 'rox' && CONFIG.substances.types[i.id]);
}
const holds = (s, id) => (s.inventory || []).some((i) => i.id === id && i.qty > 0);
const takeOne = (s, id) => {
  const e = s.inventory.find((i) => i.id === id && i.qty > 0);
  if (!e) return;
  e.qty -= 1;
  if (e.qty <= 0) s.inventory = s.inventory.filter((i) => i !== e);
};

/** The hot plate: dinner, or the other thing. */
export function stoveMenu(g) {
  const s = g.state;
  const sub = cookable(s);
  const ready = holds(s, 'baking_soda') && holds(s, 'water') && sub.length;
  const missing = [!holds(s, 'baking_soda') && 'baking soda', !holds(s, 'water') && 'a bottle of water', !sub.length && 'something to start with'].filter(Boolean);
  g.openModal({
    kicker: 'UNIT 3B · THE HOT PLATE', title: 'Two Burners, One Works',
    body: 'Dinner for three days, or an afternoon you will not describe to anyone. The hot plate does not judge. The smoke detector would, if it had a battery.',
    choices: [
      { label: 'Cook a batch of rice and beans.', sub: `${money(6)} · 45 min · three meals`, effect: () => cookBatch(g) },
      { label: 'Cook up some ROX.', sub: ready ? `2 h · baking soda, water and one ${sub[0] && CONFIG.items[sub[0].id]?.name}` : `needs ${missing.join(', ')}`, disabled: !ready, effect: () => setTimeout(() => cookRox(g), 60) },
      { label: 'Leave it off.', effect: () => {} },
    ],
  });
}

/**
 * ROX: baking soda, water, any substance he is holding, and two hours with the window open.
 * Nothing here is a recipe; the game just takes the three things and the time, and gives back rocks.
 */
export function cookRox(g) {
  const s = g.state;
  const sub = cookable(s)[0];
  if (!sub || !holds(s, 'baking_soda') || !holds(s, 'water')) { g.toast('Something is missing. Probably your judgment, but also an ingredient.', 'bad'); return; }
  takeOne(s, 'baking_soda');
  takeOne(s, 'water');
  takeOne(s, sub.id);
  g.advance(120);
  const strong = /_x$/.test(sub.id);
  const n = strong ? 4 : 3;
  addItem(s, 'rox', n);
  bump(s, 'risk', 4);
  bump(s, 'hygiene', -6);
  bump(s, 'stress', 4);
  s.counters.roxCooked = (s.counters.roxCooked || 0) + n;
  logLine(g, `Cooked ${n} ROX on the hot plate.`, 'bad');
  g.toast(pick([
    `Two hours, a towel under the door, and a smell that will outlive the lease. ${n} little off-white rocks. They look like the gravel of a very sad aquarium.`,
    `The pot hisses, the hot plate clicks, the radiator bangs once in solidarity. ${n} ROX. Mrs. Pryce knocks to ask if you are making popcorn. You say yes. She does not believe you.`,
    `${n} ROX. You put the pot in the sink and decide never to eat out of it again. Then you remember it is your only pot.`,
  ]), 'event');
}

/** Drape colours: free to change once they are up. */
export const DRAPES = {
  cream: { name: 'cream', hex: 0xe8dcc0 }, rust: { name: 'rust', hex: 0xb8502a }, navy: { name: 'navy', hex: 0x22305a },
  sage: { name: 'sage', hex: 0x7a9a6a }, mustard: { name: 'mustard', hex: 0xd0a030 }, plum: { name: 'plum', hex: 0x6a2a5a }, black: { name: 'black-out', hex: 0x18181a },
};

export function drapesMenu(g) {
  const s = g.state;
  const h = homeState(s);
  g.openModal({
    kicker: 'UNIT 3B · THE WINDOWS', title: 'The Drapes',
    body: `Right now they are ${DRAPES[h.drapes || 'cream'].name}. The guide says drapes "set the emotional temperature of a room." The guide says a lot of things.`,
    choices: [
      ...Object.entries(DRAPES).map(([id, d]) => ({ label: d.name[0].toUpperCase() + d.name.slice(1), disabled: (h.drapes || 'cream') === id, effect: () => { h.drapes = id; g.advance(10); g.world?.loadArea?.('apartment', g); g.toast(`${d.name[0].toUpperCase() + d.name.slice(1)}. The room takes it personally, in a good way.`, 'good'); } })),
      { label: 'Leave them.', effect: () => {} },
    ],
  });
}

/** How much better a night's sleep is in this bed (extra energy per hour slept). */
/** (and a building with working heat, after the tenants got it fixed, sleeps a little better too) */
export const sleepBonus = (s) => (has(s, 'bed_new') ? 2.4 : has(s, 'mattress') ? 1.4 : 0) + (s.flags?.heatFixed ? 0.6 : 0);
export const showerMinutes = (s) => (has(s, 'shower') ? 15 : 25);
