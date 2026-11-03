/**
 * The rest of recovery: the parts that happen outside the clinic's plastic chairs.
 *
 *   a support contact    Dennis, from the Tuesday group, in Contacts once Mo is on the course;
 *                        he picks up at any hour except the ones he does not, and calls back
 *   evening routines     things to do with a hard evening instead of the other thing: a walk,
 *                        tea and the TV, the notebook, a call, bed early; each takes the edge
 *                        off the craving a little, and they get easier the more he does them
 *   invitations          a party, a "chill night", a cousin's thing: go, decline, or go and
 *                        leave early; the evening is the risk, not the people
 *   the way back         a setback does not erase anything: the days he had are still his,
 *                        and Okafor's door is a check-in, not a lecture, a couple of days later
 *   noticing             people say something small when the days add up, not a speech
 *
 *   s.recovery = { contact, routines: { [id]: n }, lastRoutine, invite: { day, opt, done },
 *                  returnOffered, best, noticed: { [n]: true } }
 */
import { sleep } from './needs.js';
import { bump, logLine, pushMessage } from '../core/state.js';
import { dayOf, minuteOfDay, pick } from '../core/util.js';
import { programState } from './clinic.js';

export function recoveryState(s) {
  if (!s.recovery) s.recovery = { routines: {}, noticed: {} };
  const r = s.recovery;
  r.routines = r.routines || {};
  r.noticed = r.noticed || {};
  return r;
}

/** Days since he last used: the count that matters, and the one a setback restarts. */
export const cleanDays = (s) => Math.max(0, dayOf(s.clock.m) - dayOf(s.high?.lastDose ?? 0));
export const inRecovery = (s) => ['active', 'completed', 'dropped'].includes(programState(s).status);

export const ROUTINES = [
  { id: 'walk', label: 'Walk around the block twice.', sub: '30 min · air, legs, the bodega cat', minutes: 30, line: 'Twice around the block. The bodega cat watches you go past both times like it is keeping count. It is.' },
  { id: 'tea', label: 'Tea and whatever is on channel 11.', sub: '45 min · something warm, something dumb', minutes: 45, line: 'Mint tea and a rerun of a show you have seen eleven times. You know every line. That is the point.' },
  { id: 'write', label: 'Write it down.', sub: '30 min · the notebook', minutes: 30, line: 'A page about nothing, then a page about something. The craving is on the page now instead of in your hands.' },
  { id: 'call', label: 'Call Dennis.', sub: '20 min · the support contact', minutes: 20, needsContact: true, line: '"Tell me about the worst part of the day." You do. He says "yeah" in the right places. He has been where you are and he is not there anymore.' },
  { id: 'bed', label: 'Go to bed early.', sub: 'sleep through the worst hours', minutes: 0, line: 'Lights off at nine like a child, like a monk. The worst of it happens while you sleep, which is the cheat code.' },
];

/** One evening routine: takes the edge off, and gets a little stronger every time he does it. */
export function doRoutine(g, id) {
  const s = g.state;
  const r = recoveryState(s);
  const rt = ROUTINES.find((x) => x.id === id);
  if (!rt) return false;
  if (rt.needsContact && !r.contact) { g.toast('You do not have anybody to call for this yet. The clinic has a list.', 'info'); return false; }
  const day = dayOf(s.clock.m);
  if (r.lastRoutine === day && id !== 'bed') { g.toast('You already did one tonight. It counted. Go easy.', 'info'); return false; }
  r.lastRoutine = day;
  r.routines[id] = (r.routines[id] || 0) + 1;
  const practice = Math.min(1.6, 1 + (r.routines[id] - 1) * 0.1);
  if (rt.minutes) g.advance(rt.minutes);
  s.stats.withdrawal = Math.max(0, s.stats.withdrawal - 8 * practice);
  bump(s, 'stress', -8 * practice);
  bump(s, 'morale', 3);
  logLine(g, `Got through the evening: ${rt.label.toLowerCase()}`, 'good');
  g.toast(rt.line, 'good');
  if (id === 'bed') sleep(g, 9);
  return true;
}

/** Dennis: the support contact, once the course has started. */
export function callSupport(g) {
  const s = g.state;
  const r = recoveryState(s);
  const m = minuteOfDay(s.clock.m);
  g.advance(2);
  if (m >= 2 * 60 && m < 6 * 60 && Math.random() < 0.5) {
    r.callback = dayOf(s.clock.m);
    g.toast('Voicemail: "This is Dennis. If it is bad, call the line on the card. If it is just late, I will call you in the morning." He does.', 'info');
    return;
  }
  doRoutine(g, 'call');
}

/** Each morning: the invitation, the noticing, the way back after a setback. */
export function recoveryNewDay(g, day) {
  const s = g.state;
  const r = recoveryState(s);
  const p = programState(s);
  // the contact comes with the course
  if (!r.contact && p.status === 'active') {
    r.contact = true;
    pushMessage(g, { from: 'KESTREL CLINIC', subject: 'a number', body: 'Dennis, from the Tuesday group, said I could give you his number. He is in your contacts now. Call him on a bad night. That is what the number is for.\n\n— Nurse Okafor' });
  }
  if (r.callback === day - 1) { r.callback = null; pushMessage(g, { from: 'DENNIS', subject: 'morning', body: 'saw you called. you good? you made it to morning, so you are at least that good. call me at lunch if you want' }); }
  const clean = cleanDays(s);
  if (clean > (r.best || 0)) r.best = clean;
  // people notice, a little, at the right moments
  const NOTICE = {
    3: ['NIA', 'you sound different on the phone. like you are actually on the phone. its nice'],
    7: ['KEV', 'yo you been mad on time all week. who are you. (good)'],
    14: ['MOM', 'Your sister says you are doing well. I am not going to make a big deal. I made a pernil. That is the big deal.'],
    30: ['DENNIS', 'thirty days. i am not going to say congratulations. i am going to say: you did today. do tomorrow'],
  };
  if (inRecovery(s) && NOTICE[clean] && !r.noticed[clean]) { r.noticed[clean] = true; pushMessage(g, { from: NOTICE[clean][0], subject: '', body: NOTICE[clean][1] }); }
  // a setback: the days he had are still his
  if (inRecovery(s) && clean === 0 && (r.best || 0) >= 3 && r.setbackSeen !== day) {
    r.setbackSeen = day;
    pushMessage(g, { from: r.contact ? 'DENNIS' : 'KESTREL CLINIC', subject: 'hey', body: `${r.best} days is still ${r.best} days. a bad night does not take them back. what are you doing tonight. lets plan tonight, not forever` });
  }
  // dropped from the course: a check-in, not a lecture, a couple of days later
  if (p.status === 'dropped' && !r.returnOffered && day >= (p.endedDay || 0) + 2) {
    r.returnOffered = true;
    pushMessage(g, { from: 'KESTREL CLINIC', subject: 'a check-in', body: 'No lecture. Come in for a check-in this week, and if you want back on the course, we start again from where you are, not from zero.\n\n— Nurse Okafor', choices: [{ label: 'I will come in this week.', recov: 'return' }, { label: 'Not yet.', recov: 'notyet' }] });
  }
  // invitations, while he is trying
  if (inRecovery(s) && !r.invite?.open && Math.random() < 0.18) {
    const inv = pick([
      ['KEV', 'my cousin is having a thing tonight. there will be "stuff" there. you know. come anyway, its mostly food'],
      ['STEPHANIE', 'a few of us are going to the roof on Garnet tonight. bring yourself. some people are bringing other things, just so you know'],
      ['KEV', 'dominoes at Lou’s tonight. low key. Lou’s brother will be there and Lou’s brother is always "holding," so'],
    ]);
    r.invite = { day, open: true };
    pushMessage(g, { from: inv[0], subject: 'tonight', body: inv[1], choices: [{ label: 'I will come.', recov: 'go' }, { label: 'I will come for an hour.', recov: 'early' }, { label: 'Not tonight. Next time.', recov: 'decline' }] });
  }
}

/** The answer to an invitation, or to Okafor. */
export function answer(g, opt) {
  const s = g.state;
  const r = recoveryState(s);
  if (opt === 'return') {
    s.flags.returnEarly = true;
    g.toast('"Good. Thursday." The course will take you back now, from where you are.', 'good');
    return;
  }
  if (opt === 'notyet') { g.toast('"The door is the door," she says. It stays open.', 'info'); return; }
  if (!r.invite?.open) { g.toast('That night already happened.', 'info'); return; }
  r.invite.open = false;
  if (opt === 'decline') { bump(s, 'stress', 3); bump(s, 'morale', -1); g.toast('"next time then." There will be a next time. You will decide again then.', 'info'); return; }
  const craving = s.stats.withdrawal + s.stats.addiction * 0.4;
  g.advance(opt === 'early' ? 60 : 180);
  bump(s, 'morale', opt === 'early' ? 6 : 10);
  bump(s, 'stress', -6);
  const risk = (opt === 'early' ? 0.08 : 0.3) * Math.min(1.5, craving / 60);
  if (Math.random() < risk) {
    s.flags.setbackTonight = dayOf(s.clock.m);
    bump(s, 'stress', 8);
    logLine(g, 'Went to the thing, and the thing went the way it goes.', 'bad');
    g.toast('It was a good night until it was not. Somebody offered and you were tired of saying no. Tomorrow is still tomorrow.', 'bad');
    s.high.lastDose = s.clock.m;
    return;
  }
  g.toast(opt === 'early' ? 'An hour, a plate, two good conversations, and you left while it was still good. That is a skill. You are getting it.' : 'A whole night with people, and you went home on your own feet with nothing in your pockets. That happened.', 'good');
}
