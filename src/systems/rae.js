/**
 * Rae Vell, on the ground. The landlord who has not fixed the shower since the Clinton
 * administration, knocked out on his own sidewalk (or in his own lobby), is a man suddenly open to
 * renegotiating. Mo can cut the rent (up to 30% off, for as long as Rae remembers), make him fix
 * what is broken in 3B on his own dime, or just go through his pockets, which on rent week are
 * full. Rae is somebody with a counter to lose, so the precinct hears about it either way
 * (brawl.assault already calls it in); and the fear wears off, a little every week.
 *
 * Afterwards, at the stairwell conversation, Mo can remind him how it went last time.
 * Headless; state in `state.rae`.
 */
import { CONFIG } from '../core/config.js';
import { bump, logLine, pushMessage, addItem } from '../core/state.js';
import { dayOf, money, pick } from '../core/util.js';
import * as brawl from './brawl.js';
import { homeState } from './home.js';

export function raeState(s) {
  if (!s.rae) s.rae = { cut: 0, fear: 0, kos: 0, lastDeal: -99, fixed: 0 };
  return s.rae;
}

/** What is broken in 3B that is his job to fix. */
function broken(s) {
  const h = homeState(s);
  return [
    ...(h.leak ? ['the leak'] : []),
    ...(!h.owned.includes('shower') ? ['the shower'] : []),
    ...(!h.owned.includes('fridge') ? ['the fridge seal'] : []),
  ];
}

/** The world calls this when Rae goes down; it opens the conversation instead of the usual one. */
export function knockedOut(g, key) {
  const s = g.state;
  const r = raeState(s);
  r.kos += 1;
  r.fear = Math.min(100, r.fear + 60);
  bump(s, 'risk', 4);
  logLine(g, 'Knocked out Rae Vell, the landlord.', 'bad');
  const fixes = broken(s);
  const week = dayOf(s.clock.m) - r.lastDeal < 7;
  g.openModal({
    kicker: '1120 KESTREL · THE LANDLORD IS DOWN', title: 'Renegotiation',
    body: `Rae Vell is on the pavement holding his clipboard to his chest like it can still protect him. "Okay," he says, from the ground. "Okay, okay, okay. What do you want."\n\nRent is ${money(CONFIG.economy.rent.amount * (1 - r.cut))} a cycle right now${r.cut ? ` (already ${Math.round(r.cut * 100)}% off)` : ''}.${fixes.length ? ` Still broken in 3B: ${fixes.join(', ')}.` : ''}`,
    choices: [
      { label: 'The rent just went down.', sub: week ? 'you already did this week' : r.cut >= 0.3 ? 'it is as low as he will go' : '15% off · for as long as he remembers', disabled: week || r.cut >= 0.3, effect: () => {
        r.cut = Math.min(0.3, Math.round((r.cut + 0.15) * 100) / 100);
        r.lastDeal = dayOf(s.clock.m);
        bump(s, 'stress', 4);
        pushMessage(g, { from: 'RAE VELL (LANDLORD)', subject: 'Lease amendment', body: `Effective immediately, rent for Unit 3B is ${money(CONFIG.economy.rent.amount * (1 - r.cut))} per cycle.\n\nThis amendment was entered into freely by both parties.\n\nR. Vell` });
        g.toast(`"Fine. Fine! ${Math.round(r.cut * 100)}% off." He writes it on the clipboard with a shaking hand and initials it. It is legally meaningless. It will hold anyway.`, 'good');
      } },
      { label: 'Fix my apartment. On you.', sub: fixes.length ? fixes.join(' · ') : 'nothing left to fix', disabled: !fixes.length, effect: () => {
        const h = homeState(s);
        h.leak = 0;
        for (const id of ['shower', 'fridge']) if (!h.owned.includes(id)) h.owned.push(id);
        r.fixed += 1;
        r.lastDeal = dayOf(s.clock.m);
        bump(s, 'morale', 8);
        logLine(g, 'Rae fixed 3B, under protest.', 'good');
        g.toast('By the afternoon there is a plumber in 3B who will not look you in the eye, a new washer in the shower and a new seal on the fridge. The invoice says "courtesy". Rae says nothing, from very far away.', 'good');
      } },
      { label: 'Go through his pockets.', sub: 'it is rent week somewhere', effect: () => {
        const loot = brawl.loot(g, { kind: 'rae', key: key || 'rae' });
        if (!loot.ok) { g.toast('You already did. Once is once.', 'info'); return; }
        const rent = 60 + Math.round(Math.random() * 140);
        g.earnMoney(rent, "Rae's rent envelope");
        g.toast(`${money(rent + (loot.cash || 0))}: a fat envelope with five tenants' names on it, and his own wallet. Somebody else's rent is now yours. Sleep on that.`, 'bad');
      } },
      { label: 'Leave him there.', effect: () => g.toast('"Thank you," he says, which is the strangest thing anybody has said to you this year.', 'info') },
    ],
  });
}

/** In the stairwell, later: the memory of the pavement still works on him while it is fresh. */
export function stairwellChoices(g) {
  const s = g.state;
  const r = raeState(s);
  if (!r.kos || r.fear < 20) return [];
  const fixes = broken(s);
  return [{
    label: 'Remind him how it went last time.', sub: fixes.length ? `${fixes.join(' · ')} · he fixes it` : 'nothing to fix · he gets nervous anyway',
    effect: () => {
      r.fear = Math.max(0, r.fear - 25);
      if (fixes.length && Math.random() < r.fear / 100 + 0.35) {
        const h = homeState(s);
        h.leak = 0;
        for (const id of ['shower', 'fridge']) if (!h.owned.includes(id)) h.owned.push(id);
        g.toast('He goes pale, nods a lot, and a plumber is on the third floor within the hour. "Courtesy," the invoice says again.', 'good');
      } else {
        bump(s, 'stress', 3);
        g.toast(pick(['He takes a step back up the stairs. "We are good. We are good, Mo." He does not fix anything, but he looks at you like weather.', '"I have a lawyer now," he says. He does not have a lawyer. He has a nephew who watched a lawyer show.']), 'info');
      }
    },
  }];
}

/** Fear fades: a little each day. */
export function raeNewDay(g) {
  const r = raeState(g.state);
  r.fear = Math.max(0, r.fear - 4);
}
