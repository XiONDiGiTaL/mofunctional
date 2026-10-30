/** Endings. Multiple, distinct, and reachable. */
import { CONFIG } from '../core/config.js';
import { dayOf, money } from '../core/util.js';
import { billInfo } from './economy.js';

export const ENDING_IDS = [
  'overdose', 'evicted', 'terminated', 'pledge', 'empty', 'snapped', 'withered',
  'functional', 'steady', 'lucid', 'quiet',
];

export const ENDINGS = {
  overdose: {
    id: 'overdose', kicker: 'CAUSE OF DEATH (PROVISIONAL)', tone: 'bad',
    title: 'Everything At Once',
    body: (s) => `The room gets very far away and then very close and then it is not a room.

You are found on a Tuesday. The television is still on. The fridge is making a sound like it has been trying to tell you something for weeks.

You were, by every measure on your phone, going to sort this out. Next week. When you had the money. When you were less tired.

The city does not hold the space. Somebody rents 3B by the end of the month and paints over the marks on the wall.

You had ${money(s.money)} on you. It went to the state.`,
    stats: (s) => [
      ['Days survived', s.counters.daysSurvived],
      ['Doses', s.counters.doses],
      ['Peak risk', `${Math.round(s.stats.risk)}%`],
      ['Bills unpaid', ['rent', 'power', 'phone'].filter((k) => billInfo({ state: s }, k).owedCycles > 0).length],
    ],
  },
  evicted: {
    id: 'evicted', kicker: 'NOTICE TO VACATE', tone: 'bad',
    title: 'Unit 3B',
    body: (s) => `The lock is changed at 9:40 in the morning, while you are out.

Everything you own fits into two laundry bags if you are willing to fold the guitar. You are not willing to fold the guitar.

Rae watches from the stairwell. She does not say anything mean. That is somehow worse. She says she hopes you land somewhere, and she means it, and it does not help at all.

You have ${money(s.money)} and a guitar and no address. Addresses turn out to be the whole trick.`,
    stats: (s) => [
      ['Days survived', s.counters.daysSurvived],
      ['Rent cycles missed', billInfo({ state: s }, 'rent').owedCycles],
      ['Doses', s.counters.doses],
    ],
  },
  terminated: {
    id: 'terminated', kicker: 'EMPLOYMENT STATUS: REMOVED', tone: 'bad',
    title: 'Not A Fit',
    body: (s) => `Dale did the paperwork quickly, because he had it ready.

No job, no rent, no plan. The schedule that used to organize your entire week becomes a blank grid — not freedom. A blank grid looks a lot like a bill.

You keep waking up at 8:45 out of habit. That is the cruelest part. The habit outlives the job.`,
    stats: (s) => [
      ['Days survived', s.counters.daysSurvived],
      ['Shifts worked', s.counters.shifts],
      ['Strikes', s.job.strikes],
    ],
  },
  pledge: {
    id: 'pledge', kicker: 'THE GOLDEN FELLOWSHIP — INNER CIRCLE', tone: 'gold',
    title: 'A Perfectly White Suit',
    body: (s) => `You sign the pledge with a gold pen that is heavier than it looks.

Addison puts both hands on your shoulders and says your name like it is a title. The room claps. Somebody has been clapping the whole time, actually, and nobody knows who.

They take a tenth of everything. They take a bit more than a tenth, but they call the extra "fellowship". You have a bed, three meals, a role, and a schedule that is not yours. You are, technically, functional. You are, technically, kept.

Mo — the one with the jokes, the guitar, the awful timing — is asked to hold a candle and stand where the camera can see him.`,
    stats: (s) => [
      ['Days survived', s.counters.daysSurvived],
      ['Tithe owed', money(s.fellowship.titheOwed)],
      ['Services attended', s.counters.sundaysAttended],
    ],
  },
  empty: {
    id: 'empty', kicker: 'MOOD: FLATLINE', tone: 'bad',
    title: 'A Very Long Tuesday',
    body: (s) => `Nothing happens. That is the thing about it — nothing happens.

You stop answering. You stop going. You stop noticing that you stopped. The phone fills up with messages that all begin with "hey so" and end without asking a question, because people learn.

The week closes over you like water. There is no dramatic scene. Just a person getting quieter in a room until the room is the only thing in it.`,
    stats: (s) => [
      ['Days survived', s.counters.daysSurvived],
      ['Meals eaten', s.counters.meals],
      ['Final morale', Math.round(s.stats.morale)],
    ],
  },
  snapped: {
    id: 'snapped', kicker: 'OCCUPATIONAL STRESS — TERMINAL', tone: 'bad',
    title: 'The Sound',
    body: (s) => `It is not one big break. It is a small crack, repeated, until the whole thing is cracks.

You are standing in the Quik-Stop at 4 in the morning holding a box of the same 12 granola bars you have stocked nine hundred times, and you cannot remember which shelf, and you start laughing, and then you cannot stop, and then Dale is there.

You get three weeks off. Unpaid. The apartment does not offer unpaid time off.`,
    stats: (s) => [
      ['Days survived', s.counters.daysSurvived],
      ['Hours at redline', Math.round(s.counters.stressHighHours)],
      ['Shifts worked', s.counters.shifts],
    ],
  },
  withered: {
    id: 'withered', kicker: 'BODY: OUT OF SERVICE', tone: 'bad',
    title: 'Collapse, Repeatedly',
    body: (s) => `You fall down four times before anyone calls it a pattern.

The body keeps a ledger even when you do not: no sleep, no food, no water, a chemical schedule instead of a life. It calls in the debt all at once, in a stairwell, in front of a neighbour who will tell the story at parties for years.

The hospital keeps you two days. You wake up owing money and owing sleep and owing everyone an explanation.`,
    stats: (s) => [
      ['Days survived', s.counters.daysSurvived],
      ['Collapses', s.counters.collapsed],
      ['Meals eaten', s.counters.meals],
    ],
  },
  functional: {
    id: 'functional', kicker: 'THIRTY DAYS — SURVIVED', tone: 'good',
    title: 'Kept It Together',
    body: (s) => `Thirty days. Rent paid, mostly. Job intact, barely. You are still here, which was the entire assignment.

Nothing is fixed. The ceiling still has that stain. Your body is a rental car with the check-engine light on. But you have a fridge with food in it and a schedule you more or less showed up for, and there is a version of this where that is enough.

You make a cup of the cheap coffee and stand by the window watching the street do its morning thing. Somewhere a church bell rings in a rhythm that is slightly wrong.

You are functional. It is not a compliment. It is a survival.`,
    stats: (s) => [
      ['Days survived', s.counters.daysSurvived],
      ['Money', money(s.money)],
      ['Addiction', `${Math.round(s.stats.addiction)}%`],
      ['Risk', `${Math.round(s.stats.risk)}%`],
      ['Shifts worked', s.counters.shifts],
    ],
  },
  steady: {
    id: 'steady', kicker: 'THIRTY DAYS — HELD', tone: 'good',
    title: 'A Smaller, Better Tuesday',
    body: (s) => `Thirty days, and something underneath the numbers actually changed.

You sleep at night. You eat before you are desperate. The craving is still there — it lives in the same building, it just does not have keys to every room. You still go to the store and buy food with money instead of nerves.

You call Nia back. She talks for forty minutes about nothing and you listen to all of it, and when she asks how you are you say "better", and it is not a lie you are telling to end a conversation.

The apartment is small and the job is small and your life is small. It is yours, though. You keep it.`,
    stats: (s) => [
      ['Days survived', s.counters.daysSurvived],
      ['Money', money(s.money)],
      ['Addiction', `${Math.round(s.stats.addiction)}%`],
      ['Morale', `${Math.round(s.stats.morale)}%`],
      ['Meals eaten', s.counters.meals],
    ],
  },
  lucid: {
    id: 'lucid', kicker: 'THIRTY DAYS — CLEAR', tone: 'good',
    title: 'The Long Way Around',
    body: (s) => `Thirty days clean-ish, housed, employed, and — this is the strange part — awake.

You still flinch at the corner. You still count the money twice. The craving shows up on schedule like a bus you no longer take, and you watch it go past, and you feel smug for about six seconds, and then you go to work.

You buy a plant. It dies. You buy another one. It lives. You take this as data.

Tonight the phone rings and it is somebody asking if you are coming out, and you say no thanks, and you mean it, and you make a sandwich, and the sandwich is good. That's it. That's the whole ending. It's enough.`,
    stats: (s) => [
      ['Days survived', s.counters.daysSurvived],
      ['Addiction', `${Math.round(s.stats.addiction)}%`],
      ['Doses used', s.counters.doses],
      ['Morale', `${Math.round(s.stats.morale)}%`],
    ],
  },
  quiet: {
    id: 'quiet', kicker: 'THIRTY DAYS — UNREMARKABLE', tone: 'good',
    title: 'Nobody Noticed',
    body: (s) => `Thirty days pass and nothing dramatic happens, which is the rarest outcome available to you.

You go to work. You pay the rent, or most of it. You eat. You sleep at strange hours. You talk to Addison twice and do not sign anything. You sell a television on BidBay and immediately regret it and then stop caring.

You are not well. You are not dead. You are a person in a city, doing the paperwork of being alive.

The credits would roll here, except the rent is due again on Friday.`,
    stats: (s) => [
      ['Days survived', s.counters.daysSurvived],
      ['Money', money(s.money)],
      ['Stress', `${Math.round(s.stats.stress)}%`],
      ['Owed to Fellowship', money(s.fellowship.titheOwed)],
    ],
  },
};

export function checkEndings(g) {
  const s = g.state;
  if (s.ending) return true;

  const finish = (id) => {
    if (s.ending) return true;
    g.finishEnding?.(id);
    return true;
  };

  if (s.fellowship.stage >= 5 || s.fellowship.pledged) return finish('pledge');
  if (s.stats.risk >= CONFIG.substances.risk.overdoseAt) return finish('overdose');
  if (s.flags.evictionNotice && billInfo(g, 'rent').owedCycles >= CONFIG.economy.evictionAfterMissedCycles) return finish('evicted');
  if (!s.job.employed && s.job.fired && billInfo(g, 'rent').owedCycles >= 1 && s.money < 60) return finish('terminated');
  if (s.stats.morale <= 1 && s.counters.moraleLowHours > 10) return finish('empty');
  if (s.counters.stressHighHours >= 52) return finish('snapped');
  if (s.counters.collapsed >= 4) return finish('withered');
  if (s.counters.daysSurvived > CONFIG.time.targetDays) {
    const st = s.stats;
    if (st.addiction <= 22 && st.morale >= 55 && st.risk < 30) return finish('lucid');
    if (st.addiction <= 42 && st.morale >= 48) return finish('steady');
    if (billInfo(g, 'rent').owedCycles === 0 && s.job.employed) return finish('functional');
    if (billInfo(g, 'rent').owedCycles === 0) return finish('quiet');
    return finish('functional');
  }
  return false;
}
