/** Random life events. Each one is a small mechanical decision. */
import { CONFIG } from '../core/config.js';
import { dayOf, minuteOfDay, chance, pick, money, clamp, randInt } from '../core/util.js';
import { addItem, removeItem, countItem, earn, spend, pushMessage, logLine } from '../core/state.js';
import { bump } from '../core/state.js';
import { billInfo, payBill } from './economy.js';

const EVENTS = [
  {
    id: 'found_money', weight: 7, repeat: true,
    run(g) {
      const amount = pick([5, 10, 20, 20, 40]);
      earn(g, amount, 'Found money');
      g.toast(`Found ${money(amount)} in a coat pocket you do not remember wearing.`, 'good');
    },
  },
  {
    id: 'pipe_leak', weight: 5,
    when: (s) => !s.flags.pipeFixed,
    run(g) {
      g.openModal({
        kicker: 'THE APARTMENT',
        title: 'A Sound Like Ticking',
        body: 'Under the sink, a pipe has decided it is done. Water is doing that thing where it looks slow and is not.\n\nThe landlord will fix it in "three to five business days", which you have learned is a unit of time that does not exist.',
        choices: [
          { label: 'Fix it yourself with tape and optimism.', sub: '-$18, 45 min', effect: () => { spend(g, 18, 'Pipe tape'); bump(g.state, 'stress', 7); g.advance(45); g.state.flags.pipeFixed = true; } },
          { label: 'Put a bucket under it and go to bed.', sub: '+stress, -hygiene over time', effect: () => { bump(g.state, 'stress', 15); g.state.stats.hygiene = clamp(g.state.stats.hygiene - 10); g.state.flags.pipeBucket = true; } },
          { label: 'Call Rae. Be honest. Feel 12 years old.', sub: 'free, costs dignity', effect: () => { bump(g.state, 'morale', -5); bump(g.state, 'stress', -6); g.advance(20); g.toast('Rae sends her nephew. Her nephew is 14 and better at this than you.', 'info'); } },
        ],
      });
    },
  },
  {
    id: 'food_theft', weight: 5,
    when: (s) => s.inventory.some((i) => CONFIG.items[i.id]?.kind === 'food'),
    run(g) {
      const food = g.state.inventory.find((i) => CONFIG.items[i.id]?.kind === 'food');
      if (!food) return;
      removeItem(g.state, food.id, 1);
      g.toast(`Someone ate your ${CONFIG.items[food.id].name}. There is no suspect. There is only a fork.`, 'bad');
      bump(g.state, 'morale', -4);
    },
  },
  {
    id: 'dale_overtime', weight: 6,
    when: (s) => s.job.employed && minuteOfDay(s.clock.m) > 6 * 60 && minuteOfDay(s.clock.m) < 20 * 60,
    run(g) {
      g.openModal({
        kicker: 'DALE — QUIK-STOP #14',
        title: 'A Small Favour',
        body: '"Hey. So. Marcus is out and I need somebody for four hours. I know it\'s short notice. I know."\n\nDale is holding a clipboard like it is a shield. He has already decided you will say yes.',
        choices: [
          { label: 'Take the overtime.', sub: '4h · +$46 · energy hit', effect: () => { g.advance(240, { working: true }); earn(g, 46, 'Overtime'); bump(g.state, 'energy', -14); bump(g.state, 'stress', 9); bump(g.state, 'morale', 4); } },
          { label: 'Decline. You have a body to attend to.', sub: '+morale, -relationship', effect: () => { bump(g.state, 'morale', 5); bump(g.state, 'stress', -4); g.state.npc.dale = Math.max(-5, g.state.npc.dale - 1); } },
        ],
      });
    },
  },
  {
    id: 'nia_call', weight: 7, repeat: true,
    run(g) {
      g.openModal({
        kicker: 'INCOMING CALL — NIA',
        title: 'Your Sister, Calling',
        body: '"I\'m not checking up on you. I\'m just — Mom asked. So now I\'m asking. Are you eating? Like actually eating?"\n\nThe clock on the microwave is wrong by four minutes. You have been staring at it for the whole first half of the call.',
        choices: [
          { label: 'Talk to her properly. 40 minutes.', sub: '+morale · -40 min', effect: () => { g.advance(40); bump(g.state, 'morale', 11); bump(g.state, 'stress', -7); g.state.npc.nia++; } },
          { label: 'Say you\'re fine. Short call.', sub: 'small +morale', effect: () => { g.advance(8); bump(g.state, 'morale', 3); g.state.npc.nia = Math.max(-4, g.state.npc.nia - 1); } },
          { label: 'Let it ring. Then stare at the wall.', sub: '-morale', effect: () => { bump(g.state, 'morale', -8); bump(g.state, 'stress', 5); } },
        ],
      });
    },
  },
  {
    id: 'addison_flyer', weight: 6,
    when: (s) => s.fellowship.stage === 0 && !s.flags.metAddison,
    run(g) {
      g.state.flags.metAddison = true;
      g.state.fellowship.stage = Math.max(g.state.fellowship.stage, 1);
      pushMessage(g, {
        from: 'THE GOLDEN FELLOWSHIP',
        subject: 'YOU WERE SEEN (IN A GOOD WAY)',
        body: 'Friend,\n\nYou have the look of someone carrying something too heavy without asking for help. That is not weakness. That is a lack of correct sponsorship.\n\nCome by the Fellowship on Sunday. There is coffee. There is a seat. There is a version of you that is already here.\n\n— Addison Octavius, Shepherd',
      });
      g.toast('A gold envelope is wedged in your door. It smells like cologne.', 'event');
    },
  },
  {
    id: 'free_sample', weight: 5, repeat: true,
    run(g) {
      addItem(g.state, pick(['bar', 'ramen', 'cereal']), 1);
      g.toast('A promo kid hands you a free sample and vanishes before you can say no.', 'good');
    },
  },
  {
    id: 'bad_batch', weight: 4,
    when: (s) => s.stats.addiction > 30,
    run(g) {
      g.state.flags.badBatch = true;
      g.toast('Your usual is "a little different tonight". That is not reassuring.', 'event');
      pushMessage(g, { from: 'DEX', subject: 'fyi', body: 'Not the usual batch. Just so you know.\n\nOr don\'t. Free country.' });
    },
  },
  {
    id: 'cat', weight: 3,
    when: (s) => !s.flags.cat,
    run(g) {
      g.openModal({
        kicker: 'THE HALLWAY',
        title: 'A Cat Has Chosen',
        body: 'There is a cat in the hallway. It is not lost. It has the expression of a landlord inspecting a property.\n\nIt sits down in front of your door, which is, in cat, a signed lease.',
        choices: [
          { label: 'Let it in. Name it Chairman.', sub: '+morale · costs $12/wk in food', effect: () => { g.state.flags.cat = true; bump(g.state, 'morale', 14); g.toast('Chairman inspects the apartment. Approves the radiator. Rejects the cooking.', 'good'); } },
          { label: 'Shut the door gently.', sub: 'nothing happens (it will remember)', effect: () => { bump(g.state, 'morale', -2); g.toast('You hear it sit down outside. It waits eleven minutes.', 'info'); } },
        ],
      });
    },
  },
  {
    id: 'neighbor_music', weight: 5, repeat: true,
    when: (s) => minuteOfDay(s.clock.m) > 22 * 60 || minuteOfDay(s.clock.m) < 6 * 60,
    run(g) {
      bump(g.state, 'stress', 8);
      bump(g.state, 'energy', -4);
      g.toast('Next door is playing the same 14 seconds of a song. On purpose. Forever.', 'bad');
    },
  },
  {
    id: 'bus_fare', weight: 4, repeat: true,
    when: (s) => s.money < 40,
    run(g) {
      g.openModal({
        kicker: 'THE STREET',
        title: 'Fare Inspectors',
        body: 'Two inspectors board at once, like a magic trick. Your card is empty. Everyone on the bus is suddenly very interested in their shoes.',
        choices: [
          { label: 'Pay the fare you owe.', sub: '-$6', effect: () => { spend(g, 6, 'Bus fare'); bump(g.state, 'stress', 3); } },
          { label: 'Get off at the next stop and walk.', sub: '-25 min', effect: () => { g.advance(25); bump(g.state, 'energy', -4); bump(g.state, 'hygiene', -3); } },
          { label: 'Pretend to be asleep.', sub: 'risky', effect: () => { if (chance(0.5)) { g.toast('The inspector wakes you. You pay $6 and everybody stares.', 'bad'); spend(g, 6, 'Bus fare'); bump(g.state, 'stress', 9); } else g.toast('You are miraculously unbothered.', 'good'); } },
        ],
      });
    },
  },
  {
    id: 'invite_out', weight: 5, repeat: true,
    when: (s) => s.npc.kev > -3,
    run(g) {
      g.openModal({
        kicker: 'KEV — COWORKER, ALLEGEDLY',
        title: 'You Coming Out Or What',
        body: '"Few of us are going to The Pit. Nothing crazy. Karaoke. Marcus is going to do the sad one. You should come, man."\n\nKev is already walking backwards toward the door, waving, certain he has won.',
        choices: [
          { label: 'Go out. 3 hours. Karaoke.', sub: '-3h · +morale · -$22', effect: () => { spend(g, 22, 'Night out'); g.advance(180); bump(g.state, 'morale', 13); bump(g.state, 'stress', -9); bump(g.state, 'energy', -10); bump(g.state, 'hygiene', -6); g.state.npc.kev++; } },
          { label: 'Say you have to be up early.', sub: 'small -morale', effect: () => { bump(g.state, 'morale', -3); g.state.npc.kev = Math.max(-5, g.state.npc.kev - 1); } },
        ],
      });
    },
  },
  {
    id: 'power_flicker', weight: 4,
    when: (s) => billInfo({ state: s }, 'power').overdue,
    run(g) {
      g.state.flags.powerCut = true;
      bump(g.state, 'stress', 12);
      g.toast('The fridge stops. The apartment gets a specific kind of quiet.', 'bad');
    },
  },
  {
    id: 'addison_knock', weight: 4,
    when: (s) => s.fellowship.stage >= 1 && s.fellowship.stage <= 3,
    run(g) {
      bump(g.state, 'stress', 6);
      pushMessage(g, {
        from: 'ADDISON OCTAVIUS',
        subject: 'A small window of my attention',
        body: 'Friend,\n\nI was in the neighbourhood. I am told you were not at the door. That is alright.\n\nPerhaps you would prefer a private conversation. I am told I am very easy to speak to. I am also told I have a way of making the truth sound like an invitation.\n\nSalt & gold,\nAddison',
      });
      g.toast('Someone has been standing outside your door. Recently.', 'event');
    },
  },
  {
    id: 'guitar_nostalgia', weight: 4,
    when: (s) => countItem(s, 'guitar') > 0 && s.stats.morale < 55,
    run(g) {
      g.openModal({
        kicker: 'UNIT 3B',
        title: 'The Guitar',
        body: 'You pick it up without meaning to. Five minutes of the same song you only ever knew half of. Your fingers remember the half.\n\nYou are not good. That was never the point.',
        choices: [
          { label: 'Play for a while.', sub: '-30 min · +morale', effect: () => { g.advance(30); bump(g.state, 'morale', 12); bump(g.state, 'stress', -12); } },
          { label: 'Put it back in the corner.', sub: '+$0', effect: () => { bump(g.state, 'morale', -3); } },
        ],
      });
    },
  },
  {
    id: 'passing_gift', weight: 2,
    run(g) {
      const amount = randInt(3, 15);
      earn(g, amount, 'A stranger paid it forward');
      g.toast(`A stranger pays for your coffee and leaves before you can thank them. ${money(amount)} saved.`, 'good');
      bump(g.state, 'morale', 6);
    },
  },
  {
    id: 'the_look', weight: 4, repeat: true,
    when: (s) => s.stats.withdrawal > 30,
    run(g) {
      bump(g.state, 'stress', 9);
      bump(g.state, 'morale', -6);
      g.toast('Someone in the street looks at you for a half-second too long. You compose a whole argument about it.', 'bad');
    },
  },
  {
    id: 'followers_spike', weight: 3, repeat: true,
    when: (s) => s.social.followers > 10,
    run(g) {
      const n = randInt(3, 22);
      g.state.social.followers += n;
      bump(g.state, 'morale', 5);
      g.toast(`FeedLove: +${n} followers for no reason you can identify.`, 'good');
    },
  },
];

export function rollEvent(g, hours) {
  const s = g.state;
  const cfg = CONFIG.events;
  const day = dayOf(s.clock.m);
  if (s.events.todaysDay !== day) {
    s.events.todaysDay = day;
    s.events.today = 0;
  }
  if (s.events.today >= cfg.maxPerDay) return;
  if (s.clock.m - s.events.lastAt < cfg.minMinutesBetween) return;
  const p = cfg.chancePerHour * Math.max(0.15, hours);
  if (!chance(p)) return;
  const pool = EVENTS.filter((e) => {
    if (!e.repeat && s.seenEvents.includes(e.id)) return false;
    if (e.when && !e.when(s)) return false;
    return true;
  });
  if (!pool.length) return;
  const chosen = pick(pool);
  s.seenEvents.push(chosen.id);
  s.events.today++;
  s.events.lastAt = s.clock.m;
  s.events.count++;
  g.audio.sfx('event');
  setTimeout(() => chosen.run(g), 60);
}

export function fireEvent(g, id) {
  const e = EVENTS.find((x) => x.id === id);
  if (e) e.run(g);
}

export const EVENT_COUNT = EVENTS.length;
