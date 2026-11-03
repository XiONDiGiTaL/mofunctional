/**
 * Who owes who. Not a debt meter: a short list of what Mo owes people (fifteen dollars, a
 * replacement lighter, two hours moving a dresser, an apology, a shift covered by Friday) and
 * what they owe him. Each can be settled in full, in part, by doing the thing, or talked about;
 * and sometimes the person says the thing that matters more than the money.
 *
 *   s.owes = [{ id, who, dir: 'mo' | 'them', kind: 'cash' | 'item' | 'help' | 'apology' | 'shift',
 *               amount, item, hours, due, note, made, settled }]
 */
import { bump, logLine, pushMessage, hasItem, removeItem } from '../core/state.js';
import { dayOf, money, pick } from '../core/util.js';

const WHO = { kev: 'Kev', nia: 'Nia', mom: 'Mom', dale: 'Dale', miguel: 'Miguel', habib: 'Habib', hector: 'Hector', lou: 'Lou', gloria: 'Gloria' };
const FROM = { kev: 'KEV', nia: 'NIA', mom: 'MOM', dale: 'DALE (QUIK-STOP #14)', miguel: 'MIGUEL', habib: 'HABIB', hector: 'HECTOR', lou: 'LOU', gloria: 'GLORIA (4B)' };
export const whoName = (id) => WHO[id] || id;

export function owesState(s) {
  if (!Array.isArray(s.owes)) s.owes = [];
  return s.owes;
}
export const open = (s) => owesState(s).filter((o) => !o.settled);

/** Put something on the list. Returns the entry. */
export function addOwe(g, o) {
  const s = g.state;
  const day = dayOf(s.clock.m);
  const entry = { id: Math.random().toString(36).slice(2, 8), dir: 'mo', made: day, due: day + 5, ...o };
  owesState(s).push(entry);
  logLine(g, entry.dir === 'mo' ? `You owe ${whoName(entry.who)}: ${describe(entry)}.` : `${whoName(entry.who)} owes you: ${describe(entry)}.`, 'info');
  return entry;
}

export function describe(o) {
  switch (o.kind) {
    case 'cash': return money(o.amount);
    case 'item': return `a ${o.item}`;
    case 'help': return `${o.hours} hours ${o.note || 'helping out'}`;
    case 'apology': return 'an apology';
    case 'shift': return `a shift covered${o.note ? ` ${o.note}` : ''}`;
    default: return o.note || 'something';
  }
}

const settle = (g, o, line, bond = 1) => {
  o.settled = dayOf(g.state.clock.m);
  g.state.npc = g.state.npc || {};
  g.state.npc[o.who] = Math.min(20, (Number(g.state.npc[o.who]) || 0) + bond);
  bump(g.state, 'stress', -4);
  bump(g.state, 'morale', 3);
  g.toast(line, 'good');
};

/** Pay all of a cash debt, or `part` of it. */
export function pay(g, id, part = null) {
  const s = g.state;
  const o = owesState(s).find((x) => x.id === id);
  if (!o || o.settled || o.kind !== 'cash') return false;
  const amt = Math.min(o.amount, part ?? o.amount);
  if (s.money < amt) { g.toast(`${money(amt)}, and you have ${money(s.money)}.`, 'bad'); return false; }
  g.spendMoney(amt, `paid back ${whoName(o.who)}`);
  o.amount = Math.round((o.amount - amt) * 100) / 100;
  if (o.amount <= 0.009) settle(g, o, pick([`${whoName(o.who)} takes it and says "we're good." You are good.`, `Paid. ${whoName(o.who)} looks surprised, which says something about the last guy.`]));
  else { g.state.npc[o.who] = (Number(g.state.npc?.[o.who]) || 0) + 0.5; g.toast(`${money(amt)} down, ${money(o.amount)} to go. "Every little bit," says ${whoName(o.who)}, and means it.`, 'info'); }
  return true;
}

/** Do the thing: the hours, the shift, the apology, the replacement. */
export function doIt(g, id) {
  const s = g.state;
  const o = owesState(s).find((x) => x.id === id);
  if (!o || o.settled) return false;
  if (o.kind === 'help') { g.advance(o.hours * 60); bump(s, 'energy', -6 * o.hours); settle(g, o, `${o.hours} hours ${o.note || 'helping'}. Your back files a complaint. ${whoName(o.who)} buys you a soda, which is the receipt.`, 2); return true; }
  if (o.kind === 'apology') { g.advance(10); settle(g, o, pick([`You say it, all of it, without the "but." ${whoName(o.who)} is quiet for a second and then says "okay." It is a big okay.`, `"I'm sorry." ${whoName(o.who)} says "I know," which is better than "it's fine," because it is true.`]), 2); return true; }
  if (o.kind === 'shift') { settle(g, o, `You cover the shift. Dale writes it on the board in marker, which in this store is a medal.`, 2); g.advance(4 * 60); bump(s, 'energy', -14); g.earnMoney(4 * (s.job?.wage || 9), 'covered shift'); return true; }
  if (o.kind === 'item') {
    if (o.itemId && hasItem(s, o.itemId)) { removeItem(s, o.itemId, 1); settle(g, o, `You hand ${whoName(o.who)} the ${o.item}. "Same brand and everything." Square.`); return true; }
    const cost = o.value || 5;
    if (s.money < cost) { g.toast(`A new ${o.item} is about ${money(cost)}. You do not have it.`, 'bad'); return false; }
    g.spendMoney(cost, `replacement ${o.item}`);
    settle(g, o, `A new ${o.item}, still in the plastic. ${whoName(o.who)} says you did not have to. You did.`);
    return true;
  }
  return false;
}

/** Ask for more time, or less. Sometimes they say the thing. */
export function renegotiate(g, id) {
  const s = g.state;
  const o = owesState(s).find((x) => x.id === id);
  if (!o || o.settled) return false;
  g.advance(10);
  const bond = Number(s.npc?.[o.who]) || 0;
  const r = Math.random();
  if (o.renegotiated) { g.toast(`${whoName(o.who)}: "We already talked about this, Mo."`, 'bad'); bump(s, 'stress', 3); return false; }
  o.renegotiated = true;
  if (o.kind === 'cash' && r < 0.25 + bond * 0.03) {
    // the thing that matters more than money
    o.kind = 'help';
    o.hours = 2;
    o.note = 'showing up';
    o.amount = 0;
    pushMessage(g, { from: FROM[o.who] || o.who.toUpperCase(), subject: 'about the money', body: '"Keep the money. Just show up this time." That is the whole text. You read it four times.' });
    bump(s, 'morale', 4);
    return true;
  }
  o.due += 4;
  if (o.kind === 'cash' && o.amount > 10 && r < 0.6) { o.amount = Math.round(o.amount * 0.8 * 100) / 100; g.toast(`${whoName(o.who)} knocks it down to ${money(o.amount)} and gives you till day ${o.due}. "Do not make me ask again."`, 'info'); }
  else g.toast(`${whoName(o.who)} gives you till day ${o.due}. "Okay. But day ${o.due} means day ${o.due}."`, 'info');
  return true;
}

/** They owe him: call it in, or let it go (which is worth something too). */
export function collect(g, id, forgive = false) {
  const s = g.state;
  const o = owesState(s).find((x) => x.id === id);
  if (!o || o.settled || o.dir !== 'them') return false;
  o.settled = dayOf(s.clock.m);
  s.npc = s.npc || {};
  if (forgive) { s.npc[o.who] = (Number(s.npc[o.who]) || 0) + 2; bump(s, 'morale', 5); g.toast(`"Forget it," you tell ${whoName(o.who)}. You can hear them smile through the phone.`, 'good'); return true; }
  if (o.kind === 'cash') { g.earnMoney(o.amount, `${whoName(o.who)} paid you back`); g.toast(`${whoName(o.who)} pays you back ${money(o.amount)}, with a face like it hurt.`, 'good'); }
  else if (o.kind === 'shift') { s.flags.coverOwed = true; g.toast(`${whoName(o.who)} will cover your next shift if you call out. No strike.`, 'good'); }
  else g.toast(`${whoName(o.who)} comes through: ${describe(o)}.`, 'good');
  return true;
}

/** Each morning: reminders, and what being late on a promise costs. */
export function owesNewDay(g, day) {
  const s = g.state;
  for (const o of open(s)) {
    if (o.dir !== 'mo') continue;
    if (day === o.due) pushMessage(g, { from: FROM[o.who] || o.who.toUpperCase(), subject: 'today', body: pick([`Hey. Today was the day for the ${describe(o)}. Just saying.`, `Not trying to be that person. But: ${describe(o)}. Today.`]) });
    if (day === o.due + 3) {
      s.npc = s.npc || {};
      s.npc[o.who] = (Number(s.npc[o.who]) || 0) - 2;
      bump(s, 'stress', 4);
      logLine(g, `${whoName(o.who)} has stopped mentioning the ${describe(o)}. That is worse.`, 'bad');
    }
  }
}
