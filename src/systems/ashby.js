/**
 * Ashby Ave West: the civic end of the avenue, and the places on it that do a job.
 *
 *   Post office     a PO box (parcels wait safely instead of sitting on the stoop), parcels held
 *                   for pickup, money orders (pay a bill in person, send Mom money), and the
 *                   change of address once he lives at the brownstone
 *   Courthouse      the booking fine is a ticket with a date now: pay it in person, contest it
 *                   (and usually lose, with costs), pay part and get a week, or work it off in
 *                   community service. Miss the date and it is a bench warrant. The Housing Part
 *                   is where the third floor's paperwork goes when Rae will not listen.
 *   Meetings        the Tuesday group in St. Agnes' basement, 19:00, Dennis in person: free,
 *                   costs an evening, and it is the honest rival to the Fellowship's Sunday
 *   Library         free and warm: the papers, a quiet corner, the computers (the job listings)
 *   Diner           coffee and pie at 3 a.m., and a date that is not Lucia's prices
 *   Joe's Barber    a cut, a shave, and the regulars talking
 *   Handball wall   free, loud, and the fastest way to burn stress off
 *   Check cashing   an advance on the next paycheck (the trap is the point), money orders
 *   Record store    records to buy and sell (the brownstone stereo plays them)
 *
 *   s.ashby = { poBox, coa, held: [{ id, qty }], cases: [...], warrant, hp, advance, ... }
 */
import { CONFIG } from '../core/config.js';
import { bump, logLine, pushMessage, addItem, countItem, removeItem } from '../core/state.js';
import { money, dayOf, minuteOfDay, pick } from '../core/util.js';
import { billInfo, payBill } from './economy.js';
import { tenantsState, complaintCount } from './tenants.js';
import * as home from './home.js';
import { recoveryState, cleanDays } from './recovery.js';

const A = () => CONFIG.ashby;

export function ashbyState(s) {
  if (!s.ashby) s.ashby = {};
  const a = s.ashby;
  a.held = a.held || [];
  a.cases = a.cases || [];
  a.uses = a.uses || {};
  return a;
}
const today = (s) => dayOf(s.clock.m);
/** 0 = Monday … 6 = Sunday (Day 1 is a Monday). */
export const weekday = (s, d = today(s)) => (((d - 1) % 7) + 7) % 7;
const WD = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
export const dayName = (s, d) => `${WD[weekday(s, d)]} (Day ${d})`;
const once = (s, key) => { const a = ashbyState(s); if (a.uses[key] === today(s)) return false; a.uses[key] = today(s); return true; };
const usedToday = (s, key) => ashbyState(s).uses[key] === today(s);

/* ================================================================== hours */

/** Why a door on Ashby West is shut right now, or null. */
export function awClosed(id, s) {
  const m = minuteOfDay(s.clock.m) / 60;
  const wd = weekday(s);
  const H = A().hours[id];
  if (!H) return null;
  if (H.days && !H.days.includes(wd)) return `closed today · ${H.note}`;
  const [a, b] = H.open;
  if (m < a || m >= b) return `closed · ${H.note}`;
  return null;
}

/* ================================================================== parcels (systems/shop.js asks) */

/**
 * Where an Amazin' parcel goes: 'box' (the PO box, safe), 'held' (the post office, because the
 * address on file is a place he does not live any more), or 'door' (the stoop, and the stoop has
 * a thief some mornings).
 */
export function parcelRoute(s) {
  const a = ashbyState(s);
  if ((a.poBox || 0) >= today(s)) return 'box';
  if (home.homeState(s).residence === 'brownstone' && !a.coa) return 'held';
  return 'door';
}
export function holdParcel(s, id, qty) {
  const a = ashbyState(s);
  const e = a.held.find((h) => h.id === id);
  if (e) e.qty += qty; else a.held.push({ id, qty });
}

/* ================================================================== the post office */

export function postOffice(g) {
  const s = g.state;
  const a = ashbyState(s);
  const P = A().post;
  const boxed = (a.poBox || 0) >= today(s);
  const bills = ['rent', 'power', 'phone'].map((k) => billInfo(g, k)).filter((b) => b.owed > 0);
  const moved = home.homeState(s).residence === 'brownstone';
  g.openModal({
    kicker: 'ASHBY STATION · WINDOW 2', title: 'The Post Office',
    body: `Bulletproof glass with a brass tray under it, a line that moves when it feels like it, and a clerk named Mrs. Ocasio who has seen every kind of envelope there is.${a.held.length ? `\n\nShe has ${a.held.reduce((n, h) => n + h.qty, 0)} parcel(s) with your name on them.` : ''}${boxed ? `\n\nYour PO box is paid through Day ${a.poBox}.` : ''}`,
    choices: [
      ...(a.held.length ? [{ label: 'Pick up your parcels.', sub: '10 min · ID, a signature', effect: () => pickUp(g) }] : []),
      { label: boxed ? 'Renew the PO box.' : 'Rent a PO box.', sub: `${money(P.box)} · ${P.boxDays} days · parcels wait here, nobody walks off with them`, disabled: s.money < P.box, effect: () => {
        if (!g.spendMoney(P.box, 'PO box')) return;
        a.poBox = Math.max(a.poBox || 0, today(s)) + P.boxDays;
        g.advance(15);
        g.toast(`Box 1418. A tiny brass door and a key on a ring. Your parcels come here through Day ${a.poBox}, and nobody on the stoop gets to them first.`, 'good');
      } },
      ...bills.map((b) => ({ label: `Money order: ${b.name}.`, sub: `${money(b.owed)} + ${money(P.moFee)} fee · 15 min · paid in person, no phone needed`, disabled: s.money < b.owed + P.moFee, effect: () => {
        if (!g.spendMoney(P.moFee, 'money order fee')) return;
        g.advance(15);
        payBill(g, b.key);
      } })),
      { label: 'Send Mom some money.', sub: `${money(P.mom)} + ${money(P.moFee)} · a money order in a card`, disabled: s.money < P.mom + P.moFee || usedToday(s, 'mom'), effect: () => {
        if (!g.spendMoney(P.mom + P.moFee, 'money order to Mom')) return;
        once(s, 'mom');
        a.momSent = (a.momSent || 0) + 1;
        a.momReply = today(s) + 1;
        g.advance(20);
        bump(s, 'morale', 6);
        logLine(g, `Sent Mom ${money(P.mom)} by money order.`, 'good');
        g.toast('A card with a bodega rose on it, the money order folded inside, "for the gas bill, do not argue" on the back. Mrs. Ocasio stamps it like she means it.', 'good');
      } },
      ...(moved && !a.coa ? [{ label: 'Change your address to the brownstone.', sub: '15 min · a form in triplicate · mail follows you home', effect: () => {
        a.coa = true;
        g.advance(15);
        g.toast('Form 3575, three copies, a pen on a chain. From tomorrow the mail goes to 7th Avenue. Unit 3B gets nothing but Rae now.', 'good');
      } }] : []),
      { label: 'Buy a book of stamps.', sub: `${money(P.stamps)} · for the letters you keep meaning to write`, disabled: s.money < P.stamps, effect: () => { if (!g.spendMoney(P.stamps, 'stamps')) return; bump(s, 'morale', 1); g.toast('Twenty stamps with a flag on them. You will use two. You will feel organised for a week.', 'info'); } },
      { label: 'Step out of line.', effect: () => {} },
    ],
  });
}

export function pickUp(g) {
  const s = g.state;
  const a = ashbyState(s);
  const names = [];
  for (const h of a.held) { addItem(s, h.id, h.qty); names.push(`${h.qty > 1 ? `${h.qty}× ` : ''}${CONFIG.items[h.id]?.name || h.id}`); }
  a.held = [];
  g.advance(10);
  logLine(g, `Picked up at the post office: ${names.join(', ')}.`, 'good');
  g.toast(`"Sign here. And here. And here, that one is for me." ${names.join(', ')}, in boxes that have been through something.`, 'good');
}

/* ================================================================== the courthouse */

/** A ticket from a booking: the fine, a date, and a pink form. Called by systems/police.js. */
export function openTicket(g, amount) {
  const s = g.state;
  const a = ashbyState(s);
  const c = { id: `t${Date.now() % 1e7}`, kind: 'fine', owed: Math.round(amount * 100) / 100, day: today(s) + A().court.daysToDate, status: 'open' };
  a.cases.push(c);
  return c;
}
export const openCases = (s) => ashbyState(s).cases.filter((c) => c.status === 'open');
export const ticketLine = (s, c) => (c ? `A pink form: ${money(c.owed)}, Ashby Courthouse, ${dayName(s, c.day)}, between 9 and 5. Pay it, fight it, or work it off. Do not forget it.` : '');

/** The bench warrant: a cop who runs his name takes him in (systems/police.js reads this). */
export const hasWarrant = (s) => !!ashbyState(s).warrant;
/** Booked on the warrant: it is served, and the case gets a new date. */
export function serveWarrant(g) {
  const s = g.state;
  const a = ashbyState(s);
  a.warrant = false;
  for (const c of openCases(s)) if (c.missed) { c.day = today(s) + A().court.daysToDate; c.missed = false; }
}

export function courtClerk(g) {
  const s = g.state;
  const C = A().court;
  const cases = openCases(s);
  const c = cases[0];
  const hp = ashbyState(s).hp;
  g.openModal({
    kicker: 'ASHBY COURTHOUSE · CIVIL CLERK', title: 'The Clerk\'s Window',
    body: c ? `"Docket number?" You slide the pink form under the glass. ${money(c.owed)}, due ${dayName(s, c.day)}.${ashbyState(s).warrant ? '\n\nShe looks at her screen, then at you. "There is a warrant on this. You walked in on your own, so I am going to pretend that counts." It does: the warrant is lifted.' : ''}`
      : `"Next." The clerk has a cardigan, a fan, and a sign that says THE COURT IS NOT A BANK. You have nothing open with her.${hp ? `\n\nYour Housing Part case is on for ${dayName(s, hp.day)}.` : ''}`,
    choices: c ? [
      { label: 'Pay it in full.', sub: `${money(c.owed)} · 10 min · done`, disabled: s.money < c.owed, effect: () => { if (!g.spendMoney(c.owed, 'court fine')) return; close(g, c, 'paid'); g.advance(10); g.toast('Stamped PAID in red. You get a receipt you will keep in a drawer for nine years.', 'good'); } },
      { label: 'Pay part of it.', sub: `${money(C.partial)} now · a week more for the rest`, disabled: s.money < C.partial || c.owed <= C.partial, effect: () => { if (!g.spendMoney(C.partial, 'court fine, part')) return; c.owed = Math.round((c.owed - C.partial) * 100) / 100; c.day = Math.max(c.day, today(s)) + 7; liftWarrant(s); g.advance(15); g.toast(`${money(c.owed)} left, due ${dayName(s, c.day)}. "A plan is a plan," she says, and means it is not a favour.`, 'info'); } },
      { label: 'Contest it in front of the judge.', sub: `2 h · ${Math.round(C.dismiss * 100)}% it goes away · otherwise ${money(C.costs)} in costs`, effect: () => contest(g, c) },
      { label: 'Work it off: community service.', sub: `${money(C.perHour)} an hour · the desk down the hall`, effect: () => serviceDesk(g, c) },
      { label: 'Not today.', effect: () => {} },
    ] : [
      { label: 'Back to the hallway.', effect: () => {} },
    ],
  });
  if (c) liftWarrant(s);
}
function liftWarrant(s) { const a = ashbyState(s); if (a.warrant) { a.warrant = false; for (const c of openCases(s)) c.missed = false; } }
function close(g, c, how) {
  c.status = how;
  logLine(g, how === 'paid' ? 'Paid the court fine.' : how === 'served' ? 'Worked off the court fine in community service.' : 'The ticket was dismissed.', 'good');
}

function contest(g, c) {
  const s = g.state;
  const C = A().court;
  g.advance(120);
  bump(s, 'stress', 6);
  if (Math.random() < C.dismiss) {
    close(g, c, 'dismissed');
    bump(s, 'morale', 12);
    g.toast('The officer who wrote it is not here. The judge looks at the empty chair, at you, at the clock. "Dismissed." You walk out before anybody changes their mind.', 'good');
    return;
  }
  c.owed = Math.round((c.owed + C.costs) * 100) / 100;
  c.day = Math.max(c.day, today(s) + 3);
  bump(s, 'morale', -6);
  logLine(g, `Contested the ticket and lost: ${money(C.costs)} in costs.`, 'bad');
  g.toast(`Two hours on a wooden bench, four minutes in front of her. "Upheld, plus costs." ${money(c.owed)} now, due ${dayName(s, c.day)}.`, 'bad');
}

export function serviceDesk(g, c) {
  const s = g.state;
  const C = A().court;
  const hoursLeft = Math.ceil(c.owed / C.perHour);
  const m = minuteOfDay(s.clock.m);
  const can = m >= 9 * 60 && m <= 13 * 60 && weekday(s) < 5;
  g.openModal({
    kicker: 'ASHBY COURTHOUSE · ROOM 104', title: 'Community Service',
    body: `A man with a clipboard and an orange vest that is your size whether you like it or not. ${money(C.perHour)} an hour off what you owe: ${hoursLeft} hour${hoursLeft === 1 ? '' : 's'} for ${money(c.owed)}. Crews go out weekday mornings at nine, ten, eleven and one: the park, the Row, the lots under the el.`,
    choices: [
      { label: 'Take a four-hour crew.', sub: can ? '4 h · picking up the park · tiring, honest' : 'crews go out weekdays, 9:00 to 13:00', disabled: !can, effect: () => {
        g.advance(240);
        bump(s, 'energy', -22);
        bump(s, 'hunger', -14);
        bump(s, 'stress', 2);
        bump(s, 'hygiene', -8);
        bump(s, 'morale', 3);
        c.owed = Math.max(0, Math.round((c.owed - C.perHour * 4) * 100) / 100);
        c.served = (c.served || 0) + 4;
        if (c.owed <= 0) { close(g, c, 'served'); g.toast('The last bag tied, the vest handed back. "You are done. Do not come back." He says it nicely, for him.', 'good'); return; }
        c.day = Math.max(c.day, today(s) + 2);
        g.toast(`Four hours of the park in an orange vest. People look at you the way you used to look at the people in orange vests. ${money(c.owed)} left.`, 'info');
      } },
      { label: 'Not today.', effect: () => {} },
    ],
  });
}

/** The Housing Part: the tenants' case against Rae, once the third floor has organised. */
export function housingPart(g) {
  const s = g.state;
  const a = ashbyState(s);
  const t = tenantsState(s);
  const H = A().court;
  const ready = !!t.meeting?.held;
  const hp = a.hp;
  const hearingNow = hp && !hp.done && today(s) === hp.day && minuteOfDay(s.clock.m) >= 9 * 60 && minuteOfDay(s.clock.m) < 15 * 60;
  g.openModal({
    kicker: 'ASHBY COURTHOUSE · HOUSING PART', title: 'Housing Court',
    body: hp?.done ? `Your case is closed: ${hp.result}.`
      : hp ? `Tenants of 1120 Kestrel, 3rd floor, against Rae Vell. On for ${dayName(s, hp.day)}, between 9 and 3.${hearingNow ? '\n\nThey are calling the 1120 case now.' : ''}`
        : `Window 6, where a building goes when its landlord will not listen. A case needs a building behind it: the complaints, the heat log, a meeting.\n\nYou have: ${complaintCount(s)} of 4 units, ${t.heatDocs} of 3 nights of heat logged, ${ready ? 'a meeting held' : 'no meeting yet'}.`,
    choices: [
      ...(!hp ? [{ label: 'File a repair case against Rae.', sub: ready ? `${money(H.hpFee)} filing fee · 20 min · a date in ${H.hpDays} days` : 'hold a tenants\' meeting first (the board on your floor)', disabled: !ready || s.money < H.hpFee, effect: () => {
        if (!g.spendMoney(H.hpFee, 'housing court filing fee')) return;
        a.hp = { day: today(s) + H.hpDays, done: false };
        g.advance(20);
        logLine(g, 'Filed a repair case against Rae in Housing Court.', 'event');
        pushMessage(g, { from: 'RAE VELL (LANDLORD)', subject: 'court', body: 'Got a letter from the court. With your name on it. We could have talked about this. (We could not have, I know. Still.)' });
        g.toast(`Stamped, copied, a date: ${dayName(s, a.hp.day)}. Rae gets a letter tomorrow. You would pay a lot to see his face. You did pay ${money(H.hpFee)}.`, 'good');
      } }] : []),
      ...(hearingNow ? [{ label: 'Go in for the hearing.', sub: '2 h · the paperwork does the talking', effect: () => hearing(g) }] : []),
      { label: 'Leave.', effect: () => {} },
    ],
  });
}

function hearing(g) {
  const s = g.state;
  const a = ashbyState(s);
  const t = tenantsState(s);
  g.advance(120);
  const strong = t.heatDocs >= 3 && complaintCount(s) >= 3;
  s.npc = s.npc || {};
  if (strong) {
    const refund = Math.round(CONFIG.economy.rent.amount * A().court.abatement);
    a.hp.result = `repairs ordered, the heat and the shower, and ${money(refund)} back for the cold weeks`;
    s.flags.heatFixed = true;
    const owned = home.homeState(s).owned;
    if (!owned.includes('shower')) owned.push('shower');
    home.homeState(s).leak = 0;
    t.outcome = t.outcome || 'the court ordered the repairs';
    s.npc.rae = (Number(s.npc.rae) || 0) - 2;
    g.earnMoney(refund, 'rent abatement, Housing Court');
    bump(s, 'morale', 18);
    bump(s, 'stress', -12);
    pushMessage(g, { from: 'GLORIA (4B)', subject: 'the court', body: 'Mrs. Pryce told the whole building. She is calling you "the lawyer." Do not correct her, it is the happiest she has been since 1991.' });
    g.toast(`Rae's lawyer asks for an adjournment. The judge reads the heat log, the photos, the four signatures, and does not give him one. Repairs in fourteen days and ${money(refund)} back.`, 'good');
  } else {
    a.hp.result = 'adjourned for lack of paperwork';
    bump(s, 'morale', -6);
    g.toast('"Where is the heat log? Where are the other tenants?" Adjourned. Come back with a building, not a feeling.', 'bad');
  }
  a.hp.done = true;
  logLine(g, `Housing Court: ${a.hp.result}.`, strong ? 'good' : 'bad');
}

/* ================================================================== the Tuesday group */

/** Is the basement door open: Tuesday, 18:30 to 21:30. */
export const meetingOpen = (s) => weekday(s) === 1 && minuteOfDay(s.clock.m) >= 18.5 * 60 && minuteOfDay(s.clock.m) < 21.5 * 60;

export function meeting(g) {
  const s = g.state;
  const a = ashbyState(s);
  const r = recoveryState(s);
  const m = minuteOfDay(s.clock.m);
  const live = weekday(s) === 1 && m >= 18.75 * 60 && m < 20.5 * 60;
  const attended = a.lastMeeting === today(s);
  const clean = cleanDays(s);
  const tag = [[90, 'a red one, for ninety days'], [60, 'a green one, sixty days'], [30, 'an orange one, thirty days'], [1, 'a white one, for the first day']].find(([d]) => clean >= d && !(a.tags || {})[d]);
  g.openModal({
    kicker: 'ST. AGNES · THE BASEMENT', title: 'The Tuesday Group',
    body: live ? `Folding chairs in a circle, a coffee urn that has been on since the Carter administration, a plate of cookies somebody's aunt made. Dennis waves you over like he saved you a seat. He did.\n\nNobody asks for money. Nobody sings. People say their name and how many days, and then they say the true thing.`
      : 'The chairs are stacked against the wall and the urn is cold. A sheet on the door: TUESDAYS 7 PM · ALL WELCOME · COFFEE IS FREE.',
    choices: live && !attended ? [
      { label: 'Sit in the back and listen.', sub: '90 min · free · the craving loosens', effect: () => attend(g, false, tag) },
      { label: 'Say your name, and the true thing.', sub: '90 min · harder · it does more', effect: () => attend(g, true, tag) },
      { label: 'Not tonight.', effect: () => {} },
    ] : [{ label: attended ? 'You were here tonight. Go home easy.' : 'Come back Tuesday.', effect: () => {} }],
  });
  void r;
}

function attend(g, share, tag) {
  const s = g.state;
  const a = ashbyState(s);
  const r = recoveryState(s);
  a.lastMeeting = today(s);
  a.meetings = (a.meetings || 0) + 1;
  g.advance(90);
  const k = share ? 1.4 : 1;
  s.stats.withdrawal = Math.max(0, s.stats.withdrawal - 18 * k);
  s.stats.addiction = Math.max(0, s.stats.addiction - (share ? 3 : 2));
  bump(s, 'stress', -14 * k);
  bump(s, 'morale', share ? 9 : 5);
  bump(s, 'hunger', 6);
  if (share) bump(s, 'energy', -6);
  r.lastRoutine = today(s); // it counts as tonight's way through the evening
  r.routines.meeting = (r.routines.meeting || 0) + 1;
  const first = !r.contact;
  r.contact = true;
  let line = share ? '"My name is Mo." Your voice does something you did not plan. Nobody claps. Somebody says "thanks, Mo," and it lands somewhere it has never been.'
    : 'You listen to a bus driver, a grandmother and a kid younger than Nia say the true thing. None of it is your story. All of it is.';
  if (first) line += ' After, Dennis writes his number on a napkin. "Call me on a bad night. That is what it is for."';
  if (tag) { a.tags = { ...(a.tags || {}), [tag[0]]: true }; bump(s, 'morale', 6); line += ` Then they hand you a keytag: ${tag[1]}. People clap for that one. You put it on your keys and keep touching it.`; }
  logLine(g, `Went to the Tuesday group${share ? ' and shared' : ''}.`, 'good');
  g.toast(line, 'good');
}

/* ================================================================== the library */

export function library(g, which) {
  const s = g.state;
  if (which === 'paper') {
    if (!once(s, 'libpaper')) { g.toast('You have read every paper in the rack, including the one in Polish.', 'info'); return; }
    g.advance(30); bump(s, 'stress', -6); bump(s, 'morale', 3);
    g.toast(pick(['The Post, the News and a Spanish paper, all free, all on wooden poles like flags. You read the sports twice.', 'The crossword is half done in pen by somebody confident and wrong. You fix it. Nobody will ever know. You will.']), 'good');
    return;
  }
  if (which === 'quiet') {
    if (!once(s, 'libquiet')) { g.toast('The librarian gives you a look that means once a day is a visit and twice is a residence.', 'info'); return; }
    g.advance(60); bump(s, 'stress', -14); bump(s, 'energy', 5); bump(s, 'morale', 4);
    g.toast('An hour in the big chair by the radiator. Nobody wants anything from you. You forgot that was a thing a room could be.', 'good');
  }
}

/* ================================================================== Joe's Barber */

export function barber(g) {
  const s = g.state;
  const B = A().barber;
  const cutRecent = (ashbyState(s).cutDay || -99) > today(s) - 5;
  g.openModal({
    kicker: "ASHBY AVE · JOE'S BARBER", title: "Joe's",
    body: `Three chairs, two working. A TV in the corner with the game on mute, a radio with a different game on loud, and four men who are not waiting for a haircut. Joe has the clippers in one hand and an opinion in the other.\n\n"${pick(B.talk)}"`,
    choices: [
      { label: 'A cut.', sub: `${money(B.cut)} · 40 min · ${cutRecent ? 'clean, again' : '+hygiene · +morale · people notice'}`, disabled: s.money < B.cut, effect: () => {
        if (!g.spendMoney(B.cut, "Joe's Barber")) return;
        g.advance(40); bump(s, 'hygiene', 14); bump(s, 'morale', cutRecent ? 3 : 10); bump(s, 'stress', -4);
        ashbyState(s).cutDay = today(s);
        g.toast(pick(['A shape-up so sharp you check it in every car window on the way home.', 'Joe turns you to the mirror like a magician. "Now you look like somebody who pays his rent." You do not, yet.']), 'good');
      } },
      { label: 'A hot-towel shave.', sub: `${money(B.shave)} · 20 min`, disabled: s.money < B.shave, effect: () => {
        if (!g.spendMoney(B.shave, "Joe's Barber")) return;
        g.advance(20); bump(s, 'hygiene', 7); bump(s, 'stress', -6); bump(s, 'morale', 3);
        g.toast('A hot towel over your face and the world goes away for six minutes. Joe hums something from 1974.', 'good');
      } },
      { label: 'Sit and listen to the regulars.', sub: '30 min · free · the block\'s news', disabled: usedToday(s, 'barbertalk'), effect: () => {
        once(s, 'barbertalk');
        g.advance(30); bump(s, 'stress', -4); bump(s, 'morale', 2);
        g.toast(`"${pick(B.talk)}" "${pick(B.talk)}" Nobody agrees on anything and everybody leaves happy.`, 'info');
      } },
      { label: 'Leave.', effect: () => {} },
    ],
  });
}

/* ================================================================== the handball wall */

export function handball(g) {
  const s = g.state;
  const Hb = A().handball;
  const tired = s.stats.energy < 15;
  g.openModal({
    kicker: 'ASHBY WEST · THE WALL', title: 'Handball',
    body: 'A concrete wall with a painted line, a cracked court, and the sound a pink rubber ball makes against both, all day long. Two men in their sixties are beating two men in their twenties and talking about it the whole time.',
    choices: [
      { label: 'Hit the ball against the wall.', sub: `40 min · free · burn stress, burn energy`, disabled: tired, effect: () => { g.advance(40); bump(s, 'stress', -15); bump(s, 'energy', -12); bump(s, 'hunger', -6); bump(s, 'morale', 4); g.toast('Forty minutes of slapping a ball as hard as you can at a wall that does not care. It is the best therapy on the avenue and it is free.', 'good'); } },
      { label: `Play one of the old men for ${money(Hb.bet)}.`, sub: tired ? 'too tired' : '30 min · he has done this since 1971', disabled: tired || s.money < Hb.bet, effect: () => {
        g.advance(30); bump(s, 'stress', -8); bump(s, 'energy', -10);
        const win = Math.random() < Hb.winChance + (s.stats.energy - 50) / 400;
        if (win) { g.earnMoney(Hb.bet, 'handball'); bump(s, 'morale', 8); g.toast('21 to 19. He pays you like it hurts him physically and asks for a rematch Thursday.', 'good'); }
        else { g.spendMoney(Hb.bet, 'handball'); bump(s, 'morale', -2); g.toast('21 to 6. He never moved more than a step. "Come back when your knees are older," he says.', 'bad'); }
      } },
      { label: 'Watch for a while.', effect: () => { g.advance(15); bump(s, 'stress', -3); } },
    ],
  });
}

/* ================================================================== check cashing */

export function checkCashing(g) {
  const s = g.state;
  const a = ashbyState(s);
  const C = A().checks;
  const adv = a.advance;
  const bills = ['rent', 'power', 'phone'].map((k) => billInfo(g, k)).filter((b) => b.owed > 0);
  g.openModal({
    kicker: 'ASHBY CHECK CASHING · OPEN 8 TO 8', title: 'Checks Cashed',
    body: `A long counter behind thick plastic, a carousel slot for the money, lottery, MoneyGram, and a sign in red: PAYDAY ADVANCES · NO CREDIT CHECK · WALK OUT WITH CASH.${adv ? `\n\nYou owe them ${money(adv.owed)}. It comes out of your next paycheck before you see it.` : ''}`,
    choices: [
      { label: `An advance on your next paycheck: ${money(C.advance)} now.`, sub: s.job?.employed ? `they take ${money(C.payback)} from your next shift` : 'you need a job they can call', disabled: !s.job?.employed || !!adv, effect: () => {
        a.advance = { owed: C.payback, day: today(s) };
        g.earnMoney(C.advance, 'payday advance');
        g.advance(15);
        logLine(g, `Took a payday advance: ${money(C.advance)} now, ${money(C.payback)} from the next shift.`, 'bad');
        g.toast(`Two forms, a photocopy of your Quik-Stop stub, and ${money(C.advance)} through the carousel. "${money(C.payback)} on payday, papi." The math is on the wall in very small letters.`, 'info');
      } },
      ...bills.slice(0, 2).map((b) => ({ label: `Pay ${b.name} here.`, sub: `${money(b.owed)} + ${money(C.billFee)} fee`, disabled: s.money < b.owed + C.billFee, effect: () => { if (!g.spendMoney(C.billFee, 'bill payment fee')) return; g.advance(10); payBill(g, b.key); } })),
      { label: 'Leave.', effect: () => {} },
    ],
  });
}

/** After a shift is paid (systems/jobs.js): the advance comes off the top. Returns what was taken. */
export function takeAdvance(g, net) {
  const s = g.state;
  const a = ashbyState(s);
  if (!a.advance) return 0;
  const k = Math.min(a.advance.owed, Math.max(0, s.money), net);
  if (k <= 0) return 0;
  s.money = Math.round((s.money - k) * 100) / 100;
  a.advance.owed = Math.round((a.advance.owed - k) * 100) / 100;
  logLine(g, `Ashby Check Cashing took ${money(k)} of the shift.`, 'bad');
  if (a.advance.owed <= 0.005) { a.advance = null; g.toast('The advance is paid off. They will see you next month. They always do.', 'info'); }
  return k;
}

/* ================================================================== the daily turn */

export function ashbyNewDay(g, d) {
  const s = g.state;
  const a = ashbyState(s);
  // Mom writes back
  if (a.momReply === d) pushMessage(g, { from: 'MOM', subject: 'the card', body: pick(['I got the card. You did not have to. I am keeping it for the gas bill like you said, and the card is on the fridge next to your sister.', 'Your money order came. Mrs. Lopez at the window said "your son?" and I said yes. That is all. Eat something.']) });
  // a court date tomorrow, and a court date missed
  for (const c of openCases(s)) {
    if (c.day === d) pushMessage(g, { from: 'ASHBY COURTHOUSE', subject: 'today', body: `Reminder: your matter is on today, ${dayName(s, d)}, between 9:00 and 17:00, Civil Clerk, Ashby Courthouse, Ashby Ave West. Amount: ${money(c.owed)}.` });
    if (c.day < d && !c.missed && !a.warrant) {
      c.missed = true;
      c.owed = Math.round((c.owed + A().court.warrantFee) * 100) / 100;
      a.warrant = true;
      logLine(g, 'Missed a court date. A bench warrant is out.', 'bad');
      pushMessage(g, { from: 'ASHBY COURTHOUSE', subject: 'failure to appear', body: `You did not appear. A bench warrant has been issued and ${money(A().court.warrantFee)} added. Any officer who runs your name will bring you in. Walk in on your own and the clerk will lift it.` });
    }
  }
  // the advance, with no job to take it from: they take it from the account
  if (a.advance && !s.job?.employed && d - a.advance.day >= 7) {
    const k = Math.min(a.advance.owed + 15, Math.max(0, s.money));
    s.money = Math.round((s.money - k) * 100) / 100;
    pushMessage(g, { from: 'ASHBY CHECK CASHING', subject: 'your advance', body: `No paycheck came through, so we processed it from your account with a $15.00 late fee: ${money(k)}. Thank you for choosing Ashby Check Cashing.` });
    a.advance = null;
  }
}
