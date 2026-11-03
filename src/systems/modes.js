/**
 * Game modes: the same neighbourhood, a different opening problem. A mode is applied once, to
 * a fresh state, between "New Game" and "Begin Monday"; it moves money, the job, the rent and the
 * people around, and leaves a text or two so the first thing on the phone explains the week.
 */
import { addOwe } from './owes.js';
import { CONFIG } from '../core/config.js';
import { pushMessage, bump } from '../core/state.js';

export const MODES = [
  { id: 'default', name: 'Default', note: 'The week as it comes. Rent on day 7, a job at the Quik-Stop, a tank that is never full.' },
  { id: 'fresh', name: 'Fresh Start', note: 'This week’s rent is covered. The job is not: Dale let you go on Friday. Find work before day 14.' },
  { id: 'final', name: 'Final Warning', note: 'Still employed, barely. One more strike at the Quik-Stop and you are done.' },
  { id: 'family', name: 'Family First', note: 'More money, less time. Nia needs you, and she has made a list.' },
  { id: 'bad', name: 'Bad Week', note: 'A plumber’s bill already paid, closing shifts all week, and a head start on stress.' },
  { id: 'easy', name: 'Getting By', note: 'A gentler week: rent covered, some money saved, and a little more breathing room.' },
];

export const modeById = (id) => MODES.find((m) => m.id === id) || MODES[0];

/** Apply a mode to a fresh run. `g` is the game (for the messages); state is g.state. */
export function applyMode(g, id) {
  const s = g.state;
  const m = modeById(id);
  s.mode = m.id;
  switch (m.id) {
    case 'fresh':
      s.bills.rent.paidCycle = Math.max(s.bills.rent.paidCycle, 0);
      s.job.employed = false;
      s.job.quit = false;
      s.job.fired = true;
      pushMessage(g, { from: 'DALE (QUIK-STOP #14)', subject: 'Friday', body: 'Mo. Corporate says we are "right-sizing." I said you are the right size. They said that is not what it means. Your last check covered the rent. Come by if you want to reapply. I will pretend I did not write this.' });
      pushMessage(g, { from: 'NIA', subject: 'rent', body: 'I put the rest of the rent in Rae’s box so do not say I never did anything. You have till next week to find something. Love you. Find something.' });
      break;
    case 'final':
      s.job.strikes = Math.max(0, (CONFIG.job.maxStrikes || 3) - 1);
      s.job.warned = true;
      pushMessage(g, { from: 'DALE (QUIK-STOP #14)', subject: 'last one', body: 'Mo. That was strike two. I like you. Corporate does not know you. One more and it is out of my hands, and my hands are small. Be on time. Be on time. Be on time.' });
      bump(s, 'stress', 8);
      break;
    case 'family':
      s.money += 150;
      s.npc = s.npc || {};
      s.npc.nia = Math.max(Number(s.npc.nia) || 0, 4);
      s.sister = { ...(s.sister || {}), status: 'coming', visitDay: 2, askedDay: 1, visits: s.sister?.visits || 0 };
      s.flags.familyFirst = true;
      addOwe(g, { who: 'nia', kind: 'help', hours: 2, note: 'moving her dresser', due: 6 });
      pushMessage(g, { from: 'NIA', subject: 'the list', body: 'Okay. Mom sent money so you are fine for now, that is the good news. The list: Tuesday I am coming over with food, be home at six. Thursday Mom wants a call. Saturday I need help moving a dresser. Sunday you are coming to Mom’s. This is not a request, this is family.' });
      break;
    case 'bad':
      s.money = Math.max(40, s.money - 85);
      s.job.shiftStart = 15 * 60;
      s.job.shiftEnd = 23 * 60;
      bump(s, 'stress', 12);
      bump(s, 'morale', -6);
      pushMessage(g, { from: 'RAE VELL (LANDLORD)', subject: 'plumber', body: 'The plumber came for your toilet. $85, which I took from what you owe the building, which means you owe the building $85. The toilet works. The plumber says "for now."' });
      pushMessage(g, { from: 'DALE (QUIK-STOP #14)', subject: 'schedule', body: 'Closing shifts all week, 3 to 11. Marcus is out. Do not ask me where. I do not know where.' });
      break;
    case 'easy':
      s.money += 200;
      s.bills.rent.paidCycle = Math.max(s.bills.rent.paidCycle, 0);
      s.stats.stress = 20;
      s.stats.morale = 60;
      s.stats.addiction = Math.max(0, s.stats.addiction - 10);
      pushMessage(g, { from: 'NIA', subject: 'breathe', body: 'Rent is handled this week and I left you a little extra. Do something nice. Something nice that is not that.' });
      break;
    default:
      break;
  }
  return m;
}
