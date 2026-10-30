/** Addison Octavius and The Golden Fellowship: a recruitment pipeline with good coffee. */
import { CONFIG } from '../core/config.js';
import { dayOf, minuteOfDay, money, hhmm } from '../core/util.js';
import { earn, spend, logLine, pushMessage } from '../core/state.js';
import { bump } from '../core/state.js';
import { SERVICE_SERMONS, ADDISON_TALK } from './dialogue.js';

const F = CONFIG.fellowship;

export function serviceWindow(g) {
  const s = g.state;
  const weekday = (dayOf(s.clock.m) - 1) % 7;
  const mod = minuteOfDay(s.clock.m);
  const start = F.serviceStart;
  const end = F.serviceStart + F.serviceMinutes;
  const isSunday = weekday === F.serviceDay;
  return {
    isSunday,
    inWindow: isSunday && mod >= start - 30 && mod <= end,
    startsIn: isSunday ? Math.max(0, start - mod) : null,
    label: 'Sunday 11:00 AM',
  };
}

export function visitFellowship(g) {
  const s = g.state;
  const mod = minuteOfDay(s.clock.m);
  if (mod < 8 * 60 || mod > 21 * 60) {
    g.toast('The Fellowship doors are shut. A sign says "BACK SUNDAY".', 'info');
    return false;
  }
  const win = serviceWindow(g);
  const stage = s.fellowship.stage;
  s.fellowship.visits++;

  if (stage === 0) {
    g.openModal({
      kicker: 'THE GOLDEN FELLOWSHIP',
      title: 'A Man In White',
      body: `${ADDISON_TALK.intro}\n\nHe is holding a cup of coffee he has not drunk from. He offers it to you. It is still warm. He has been holding it for a while.`,
      choices: [
        { label: 'Take the coffee. Listen.', sub: 'Fellowship: Invited', effect: () => { s.fellowship.stage = 1; s.flags.metAddison = true; bump(s, 'morale', 4); g.advance(20); } },
        { label: 'Say you are just looking at the building.', sub: 'no commitment', effect: () => { g.advance(5); bump(s, 'morale', -1); } },
      ],
    });
    return true;
  }

  const titheBlocked = stage >= 3 && s.fellowship.titheOwed > 0.5;
  const canAttend = win.inWindow && stage >= 1 && stage < 5;
  const attendLabel = titheBlocked
    ? `Attend the service. (Tithe of ${money(s.fellowship.titheOwed)} outstanding)`
    : stage >= 2
      ? `Attend the service. (${F.serviceMinutes} min · allowance ${money(F.allowance)})`
      : `Attend the service. (${F.serviceMinutes} min)`;

  const body = stage === 1
    ? `${ADDISON_TALK.invite}\n\nThe hall smells like lemon cleaner and expensive wool. There is a seat with your name on a card. Your name is spelled wrong.`
    : stage === 2
      ? `${ADDISON_TALK.regular}\n\nThe room has started nodding when you speak. That is new. That has never happened at the Quik-Stop.`
      : stage === 3
        ? `${ADDISON_TALK.tither}\n\nA man with a clipboard smiles at you and says "we can take it from your pay if that's easier", and everyone laughs, and nobody is joking.`
        : `${ADDISON_TALK.inner}\n\nThe candles have been moved closer to the door. Addison is holding a pen.`;

  g.openModal({
    kicker: 'THE GOLDEN FELLOWSHIP',
    title: stage >= 4 ? 'The Inner Circle' : 'Shepherd Addison',
    body: `${body}\n\n${win.inWindow ? 'The service is happening right now.' : `Service is ${F.serviceStart === 660 ? 'Sunday at 11:00 AM' : win.label}.`}${titheBlocked ? `\n\nAddison: "Before we pray — the tenth. It is not about the money. It is about the ordering of the heart."` : ''}`,
    choices: [
      canAttend ? {
        label: attendLabel,
        sub: titheBlocked ? 'Your tithe is unpaid — attendance will not advance' : '+morale · -stress',
        effect: () => attendService(g),
      } : null,
      stage >= 3 ? {
        label: `Settle your tithe (${money(s.fellowship.titheOwed)}).`,
        sub: s.money >= s.fellowship.titheOwed ? 'Cash on hand' : 'You do not have it',
        disabled: s.fellowship.titheOwed <= 0 || s.money < s.fellowship.titheOwed,
        effect: () => settleTithe(g),
      } : null,
      stage >= 4 ? {
        label: 'Sign the pledge.',
        sub: 'This is an ending. There is no undo.',
        effect: () => offerPledge(g),
      } : null,
      { label: 'Just talk. Twenty minutes.', sub: '+morale, -20 min', effect: () => { g.advance(20); bump(s, 'morale', 3); bump(s, 'stress', -3); } },
      { label: 'Leave.', sub: '', effect: () => {} },
    ].filter(Boolean),
  });
  return true;
}

function attendService(g) {
  const s = g.state;
  const titheBlocked = s.fellowship.stage >= 3 && s.fellowship.titheOwed > 0.5;
  g.advance(F.serviceMinutes);
  s.counters.sundaysAttended++;
  s.fellowship.lastServiceDay = dayOf(s.clock.m);
  const sermon = SERVICE_SERMONS[Math.min(SERVICE_SERMONS.length - 1, s.counters.sundaysAttended - 1)];
  bump(s, 'morale', titheBlocked ? 2 : 7);
  bump(s, 'stress', titheBlocked ? -2 : -10);
  bump(s, 'hunger', -8);
  logLine(g, 'Attended a Fellowship service.', 'event');

  if (titheBlocked) {
    g.toast('A hand rests gently on your shoulder for the entire closing prayer.', 'bad');
    pushMessage(g, { from: 'THE GOLDEN FELLOWSHIP', subject: 'A gentle accounting', body: `Outstanding tithe: ${money(s.fellowship.titheOwed)}.\n\nWe do not chase. We simply notice, and we are very good at noticing.\n\n— Stewardship Office` });
    return;
  }

  if (s.fellowship.stage >= 2) {
    earn(g, F.allowance, 'Fellowship allowance');
    bump(s, 'morale', 3);
    g.toast(`The service ends. An envelope finds your hand: ${money(F.allowance)} "travel allowance".`, 'gold');
    s.fellowship.lastAllowanceDay = dayOf(s.clock.m);
  }

  const newStage = Math.min(4, 1 + s.counters.sundaysAttended);
  if (newStage > s.fellowship.stage) {
    s.fellowship.stage = newStage;
    const label = F.stages[newStage].label;
    g.toast(`Fellowship: you are now "${label}".`, 'gold');
    logLine(g, `Fellowship stage: ${label}.`, 'event');
    pushMessage(g, {
      from: 'ADDISON OCTAVIUS',
      subject: `Welcome to ${label}`,
      body: `${sermon.summary}\n\nYou are seen, friend. Specifically. By name. By several people at once.\n\nSalt & gold,\nAddison`,
    });
    if (newStage === 4) bump(s, 'stress', 8);
  }
  g.audio.sfx('confirm');
}

function settleTithe(g) {
  const s = g.state;
  const owed = s.fellowship.titheOwed;
  if (owed <= 0 || s.money < owed) return;
  spend(g, owed, 'Fellowship tithe');
  s.fellowship.titheOwed = 0;
  bump(s, 'stress', -4);
  bump(s, 'morale', 4);
  logLine(g, 'Settled the Fellowship tithe.', 'event');
  g.toast('The tithe is settled. Your name goes in a book, in gold ink.', 'gold');
  g.audio.sfx('cash');
}

function offerPledge(g) {
  const s = g.state;
  g.openModal({
    kicker: 'THE INNER CIRCLE',
    title: 'The Pledge',
    body: 'The pen is heavier than it looks. It is not a metaphor; it is a heavy pen.\n\n"I am not asking you to give up your life," Addison says. "I am asking you to give up the management of it. Look at you. You are exhausted from managing it."\n\nBehind him, the candles lean all in one direction, which is not how candles work.',
    choices: [
      {
        label: 'Sign it.',
        sub: 'Ending: A Perfectly White Suit',
        effect: () => {
          s.fellowship.stage = 5;
          s.fellowship.pledged = true;
          s.fellowship.pledgedDay = dayOf(s.clock.m);
          bump(s, 'morale', 10);
          bump(s, 'stress', -25);
          g.audio.sfx('sting');
          logLine(g, 'Signed the Fellowship pledge.', 'event');
        },
      },
      {
        label: 'Put the pen down. Walk out.',
        sub: 'They will remember. (+stress, +morale)',
        effect: () => {
          s.fellowship.stage = 5;
          s.fellowship.refused = true;
          s.fellowship.pledged = false;
          s.flags.refusedPledge = true;
          g.state.fellowship.stage = 4;
          bump(s, 'stress', 14);
          bump(s, 'morale', 12);
          g.toast('You walk out. Two people follow you to the door with their hands open.', 'event');
          // Refusal marks the path as closed, but does not end the run.
          s.flags.fellowshipClosed = true;
        },
      },
    ],
  });
}

export function fellowshipNewDay(g, day) {
  const s = g.state;
  const weekday = (day - 1) % 7;
  if (weekday === F.serviceDay && s.fellowship.stage >= 1 && s.fellowship.stage < 5) {
    pushMessage(g, {
      from: 'THE GOLDEN FELLOWSHIP',
      subject: 'Today, 11:00 AM',
      body: `A seat is saved. ${s.fellowship.stage >= 3 ? `Tithe outstanding: ${money(s.fellowship.titheOwed)}.` : 'Coffee is free. Coffee is always free.'}\n\nWe will not ask twice. We will simply be here, forever, asking.`,
    });
    g.toast('Sunday. The Fellowship is expecting you at 11:00.', 'event');
  }
  if (s.fellowship.stage >= 3 && s.fellowship.titheOwed > 0) {
    bump(s, 'stress', 4);
  }
}

export const fellowshipStage = (s) => F.stages[s.fellowship.stage] || F.stages[0];
