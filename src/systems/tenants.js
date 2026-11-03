/**
 * The building as a shared problem. Mo's floor of 1120 Kestrel has four doors and one broken
 * boiler, and organizing it is a small storyline of its own:
 *
 *   1. knock on doors and collect repair complaints (some neighbours need convincing)
 *   2. document the broken heat (three nights, written down, photographed)
 *   3. call a meeting in the hall and spend an evening on it instead of earning
 *   4. go to Rae, alone or together
 *
 * The rewards are a repaired building, people who wave in the hall, and a more manageable
 * arrangement with Rae: not owning anything, not winning, just better.
 *
 *   s.tenants = { complaints: { [unit]: true }, heatDocs, heatDay, meeting: { day, held, came },
 *                 support, outcome, knocked: { [unit]: day } }
 */
import { bump, logLine, pushMessage } from '../core/state.js';
import { dayOf, minuteOfDay, pick } from '../core/util.js';
import * as home from './home.js';

export const UNITS = {
  '3A': { name: 'Mrs. Pryce', kind: 'tenant_f', reluctant: false, line: '"The heat, baby. I sleep in my coat. I am seventy-three years old and I sleep in my coat."', complaint: 'no heat, a window that will not close' },
  '3C': { name: 'the Delgados', kind: 'hall_m', reluctant: true, line: '"We do not want trouble. We have the kids. Rae knows our names." He keeps the chain on the door.', complaint: 'mice, the heat, the bathroom ceiling' },
  '3D': { name: 'Marcus', kind: 'passer_m', reluctant: true, line: '"I work nights, man. I am never here. Why would I care about the heat." He is wearing a hat indoors.', complaint: 'the heat, the hallway light, the front door lock' },
};

export function tenantsState(s) {
  if (!s.tenants) s.tenants = {};
  const t = s.tenants;
  t.complaints = t.complaints || {};
  t.knocked = t.knocked || {};
  t.meeting = t.meeting || null;
  t.heatDocs = t.heatDocs || 0;
  t.support = t.support || 0;
  return t;
}
export const complaintCount = (s) => Object.keys(tenantsState(s).complaints).length + 1; // Mo's own counts

/** Knocking on a neighbour's door in the hall. */
export function knock(g, unit) {
  const s = g.state;
  const t = tenantsState(s);
  const u = UNITS[unit];
  const day = dayOf(s.clock.m);
  if (t.knocked[unit] === day) { g.toast(`${u.name} already answered once today. Twice is a sales pitch.`, 'info'); return; }
  t.knocked[unit] = day;
  g.advance(10);
  const m = minuteOfDay(s.clock.m);
  if (unit === '3D' && m >= 9 * 60 && m < 17 * 60) { g.toast('Nobody answers 3D. Marcus is asleep, or at work, or both.', 'info'); return; }
  if (t.complaints[unit]) {
    g.openModal({ kicker: `1120 KESTREL · ${unit}`, title: u.name, body: `${u.name} already gave you their list. ${t.meeting && !t.meeting.held ? `"I will be at the meeting. Day ${t.meeting.day}, seven o'clock. Right?"` : 'They nod at you in a way that means you are a thing in this building now.'}`, choices: [{ label: 'See you around.', effect: () => {} }] });
    return;
  }
  g.openModal({
    kicker: `1120 KESTREL · ${unit}`, title: u.name,
    body: `${u.line}\n\nYou explain: the heat, the repairs, a list, all of you together.`,
    choices: [
      { label: 'Listen first. Ask what is broken in their place.', sub: 'it takes time', effect: () => convince(g, unit, u.reluctant ? 0.75 : 1, 'listen') },
      { label: '"If we all sign, Rae has to fix it."', sub: 'the argument', effect: () => convince(g, unit, u.reluctant ? 0.5 : 0.95, 'argue') },
      { label: '"Do it for Mrs. Pryce. She sleeps in her coat."', sub: unit === '3A' ? 'she is Mrs. Pryce' : 'the neighbour angle', disabled: unit === '3A', effect: () => convince(g, unit, 0.7, 'pryce') },
      { label: 'Never mind. Sorry to bother you.', effect: () => {} },
    ],
  });
}

function convince(g, unit, odds, how) {
  const s = g.state;
  const t = tenantsState(s);
  const u = UNITS[unit];
  g.advance(how === 'listen' ? 30 : 10);
  if (Math.random() < odds) {
    t.complaints[unit] = true;
    t.support += 1;
    s.npc = s.npc || {};
    s.npc[`t${unit}`] = (s.npc[`t${unit}`] || 0) + 2;
    bump(s, 'morale', 4);
    logLine(g, `${u.name} (${unit}) added their complaints: ${u.complaint}.`, 'good');
    g.toast(`${u.name} writes it down: ${u.complaint}. ${complaintCount(s) >= 3 && !t.meeting ? 'That is enough for a meeting. The bulletin board by the stairs.' : ''}`, 'good');
  } else {
    bump(s, 'stress', 3);
    g.toast(`${u.name} says "let me think about it" and closes the door slowly, which is a no that wants to be a yes later. Try again another day.`, 'info');
  }
}

/** The bulletin board by the stairs: the list, the heat log, and calling the meeting. */
export function boardMenu(g) {
  const s = g.state;
  const t = tenantsState(s);
  const day = dayOf(s.clock.m);
  const night = minuteOfDay(s.clock.m) >= 20 * 60 || minuteOfDay(s.clock.m) < 6 * 60;
  const meetingNow = t.meeting && !t.meeting.held && day === t.meeting.day && minuteOfDay(s.clock.m) >= 19 * 60 && minuteOfDay(s.clock.m) < 22 * 60;
  g.openModal({
    kicker: '1120 KESTREL · 3RD FLOOR', title: 'The Bulletin Board',
    body: `A cork board with a NO SMOKING sign, a lost cat from 1996, and now a sheet in your handwriting: REPAIRS · 3RD FLOOR.\n\nUnits on the list: ${complaintCount(s)} of 4 (3B is yours). Heat logged: ${t.heatDocs} of 3 nights.${t.meeting ? (t.meeting.held ? `\nThe meeting: ${t.meeting.came} came.` : `\nMeeting: day ${t.meeting.day}, 19:00, here in the hall.`) : ''}${t.outcome ? `\n\nWith Rae: ${t.outcome}.` : ''}`,
    choices: [
      { label: 'Log the heat tonight.', sub: night ? '20 min · thermometer, a photo, the time' : 'it has to be at night, when it is cold', disabled: !night || t.heatDay === day || t.heatDocs >= 3, effect: () => { g.advance(20); t.heatDocs += 1; t.heatDay = day; bump(s, 'stress', 2); g.toast(`Fifty-one degrees at ${String(Math.floor(minuteOfDay(s.clock.m) / 60)).padStart(2, '0')}:00. You write it down and take a photo of the thermometer next to the newspaper with the date on it, like a hostage.`, 'info'); } },
      { label: 'Call a meeting in the hall.', sub: complaintCount(s) >= 3 ? 'tomorrow, 19:00 · put up a sign' : 'get more neighbours on the list first', disabled: complaintCount(s) < 3 || !!t.meeting, effect: () => { t.meeting = { day: day + 1, held: false, came: 0 }; g.advance(10); g.toast('A sign in marker: TENANT MEETING · TOMORROW 7PM · HERE · BRING YOUR LIST. Somebody has already drawn a heart on it.', 'good'); } },
      { label: 'Hold the meeting.', sub: meetingNow ? '2 h · tonight is the night' : 'not now', disabled: !meetingNow, effect: () => holdMeeting(g) },
      { label: 'Go to Rae.', sub: t.outcome ? 'you already did' : t.meeting?.held ? 'alone, or with the building' : 'alone, for now', disabled: !!t.outcome, effect: () => setTimeout(() => confront(g), 60) },
      { label: 'Read the lost cat poster again.', effect: () => g.toast('MISSING: MITTENS. ANSWERS TO "MITTENS" (DOES NOT ANSWER). REWARD. The phone number has one digit too few.', 'info') },
    ],
  });
}

function holdMeeting(g) {
  const s = g.state;
  const t = tenantsState(s);
  g.advance(120);
  const came = Object.keys(t.complaints).length + (t.support >= 4 ? 2 : 0);
  t.meeting.held = true;
  t.meeting.came = came;
  t.support += 2;
  bump(s, 'morale', 10);
  bump(s, 'stress', -5);
  bump(s, 'energy', -6);
  logLine(g, `Tenant meeting in the hall: ${came} neighbours came.`, 'good');
  g.toast(`${came} neighbours in the hallway on folding chairs, Mrs. Pryce's coffee, Marcus in his hat. Two hours of everybody talking at once, and then a list everybody signs. It is the first time this hall has felt like a building.`, 'good');
}

/** Rae: alone, or with the building behind you. */
export function confront(g) {
  const s = g.state;
  const t = tenantsState(s);
  const together = t.meeting?.held;
  g.openModal({
    kicker: 'RAE VELL · THE OFFICE IN 1A', title: 'Rae',
    body: `${together ? `You and ${t.meeting.came} neighbours in the doorway of 1A. Rae counts you with his eyes and puts down his coffee.` : 'Just you, in the doorway of 1A. Rae does not put down his coffee.'}\n\nYou have: ${complaintCount(s)} units' complaints, ${t.heatDocs} nights of heat logged.`,
    choices: [
      ...(together ? [{ label: 'Speak for the building.', sub: 'all of you, together', effect: () => outcome(g, 'together') }] : []),
      { label: 'Ask for your own repairs.', sub: 'just 3B', effect: () => outcome(g, 'alone') },
      { label: 'Not yet.', effect: () => {} },
    ],
  });
}

function outcome(g, how) {
  const s = g.state;
  const t = tenantsState(s);
  s.npc = s.npc || {};
  const docs = t.heatDocs >= 2;
  const units = complaintCount(s);
  const owned = home.homeState(s).owned;
  if (how === 'together' && docs && units >= 3) {
    t.outcome = 'the heat fixed, the shower fixed, a payment plan for anybody behind';
    s.flags.heatFixed = true;
    if (!owned.includes('shower')) owned.push('shower');
    home.homeState(s).leak = 0;
    s.npc.rae = (Number(s.npc.rae) || 0) - 1;
    bump(s, 'morale', 16);
    bump(s, 'stress', -10);
    pushMessage(g, { from: 'RAE VELL (LANDLORD)', subject: 'boiler', body: 'The boiler guy comes Monday. The shower in 3B too. And anybody on the third floor who is behind, come see me about a plan. Do not make a habit of this. Of the meetings.' });
    g.toast('Rae looks at the heat log for a long time. "Fine." The boiler is fixed by Tuesday. The hallway smells like warm dust, which is the smell of winning, a little.', 'good');
  } else if (how === 'together') {
    t.outcome = 'the heat fixed, eventually, and nothing else';
    s.flags.heatFixed = true;
    s.npc.rae = (Number(s.npc.rae) || 0) - 1;
    bump(s, 'morale', 8);
    g.toast('"Without paperwork it is your word against the boiler." He fixes the heat anyway, eight days later, like it was his idea.', 'info');
  } else {
    t.outcome = docs ? 'the shower in 3B fixed, and a look' : 'a promise, which is a Rae word';
    if (docs && !owned.includes('shower')) owned.push('shower');
    s.npc.rae = (Number(s.npc.rae) || 0) - 2;
    bump(s, 'morale', docs ? 4 : -2);
    g.toast(docs ? 'He fixes your shower so you will stop. It works. The heat does not. You are one unit, and he knows it.' : '"I\'ll get right on that." You can hear him not writing it down.', docs ? 'good' : 'info');
  }
  logLine(g, `Went to Rae ${how === 'together' ? 'with the building' : 'alone'}: ${t.outcome}.`, 'event');
}
