/** Random life events. Each one is a small mechanical decision. */
import { CONFIG } from '../core/config.js';
import { dayOf, minuteOfDay, chance, pick, money, clamp, randInt } from '../core/util.js';
import { addItem, removeItem, countItem, earn, spend, pushMessage, logLine } from '../core/state.js';
import { bump } from '../core/state.js';
import { billInfo, payBill } from './economy.js';
import * as scheduler from './scheduler.js';

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
          { label: 'Call Rae. Be honest. Feel 12 years old.', sub: 'free, costs dignity', effect: () => { bump(g.state, 'morale', -5); bump(g.state, 'stress', -6); g.advance(20); g.toast('Rae sends his nephew. His nephew is 14 and better at this than you.', 'info'); } },
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
        sms: true, from: 'DALE',
        body: 'hey. so. marcus is out and i need somebody for 4 hours. i know its short notice. i know.',
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
        sms: true, from: 'NIA',
        body: 'not checking up on you. mom asked so now im asking. are you eating? like actually eating? call me',
        choices: [
          { label: 'Call her. Talk properly.', sub: '+morale · -40 min', effect: () => { g.advance(40); bump(g.state, 'morale', 11); bump(g.state, 'stress', -7); g.state.npc.nia++; } },
          { label: '"im fine. eating."', sub: 'small +morale', effect: () => { g.advance(8); bump(g.state, 'morale', 3); g.state.npc.nia = Math.max(-4, g.state.npc.nia - 1); } },
          { label: 'Leave it on read.', sub: '-morale', effect: () => { bump(g.state, 'morale', -8); bump(g.state, 'stress', 5); } },
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
        sms: true, from: 'KEV',
        body: 'few of us going to the pit tonight. karaoke. marcus doing the sad one. u coming or what',
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
  {
    id: 'clinic_referral', weight: 4,
    when: (s) => s.stats.risk > 22 && !s.life?.counselor,
    run(g) {
      pushMessage(g, {
        from: 'KESTREL CLINIC',
        subject: 'Walk-in hours',
        body: 'We are the pale building at the east end of Kestrel Street, past Habib\'s. Walk-ins, no appointment, no judgement at the desk.\n\nFirst visit is a conversation. It costs money. It costs less than the alternative, which we are not going to describe in a text message.\n\n— Kestrel Clinic',
      });
      g.state.life = g.state.life || {};
      g.toast('A clinic card is wedged under your door. It has been there a while.', 'event');
    },
  },
  {
    id: 'park_invite', weight: 6,
    when: (s) => !s.flags.recovering && (s.npc?.kev ?? 0) > -3,
    run(g) {
      g.openModal({
        sms: true, from: 'KEV',
        body: 'at the park. half court is free. bring nothing. u look like u havent been outside since tuesday',
        choices: [
          {
            label: 'Go to the park.', sub: '15 min walk · +morale',
            effect: () => {
              g.advance(15);
              g.goTo('park', 'street');
              bump(g.state, 'morale', 7);
              bump(g.state, 'stress', -6);
            },
          },
          { label: 'Say you are busy.', sub: 'small -morale', effect: () => { bump(g.state, 'morale', -2); } },
        ],
      });
    },
  },
  {
    id: 'surprise_expense', weight: 4,
    run(g) {
      const cost = pick([12, 18, 26, 34]);
      g.openModal({
        kicker: 'THE WEEK',
        title: 'Something Broke',
        body: `The radiator has started a new noise, which is a noise with intent. The super says it is "a you problem" and hands you a card for a man who does not answer his phone.\n\nA part costs ${money(cost)}. Ignoring it is free and costs something else.`,
        choices: [
          { label: `Buy the part — ${money(cost)}.`, sub: 'fixes it · +morale', disabled: g.state.money < cost, effect: () => { spend(g, cost, 'Radiator part'); bump(g.state, 'morale', 4); bump(g.state, 'stress', -5); g.state.flags.pipeFixed = true; g.toast('The radiator stops making the noise. You sit in the silence like it is a rented room.', 'good'); } },
          { label: 'Put a towel on it and go out.', sub: '+stress, -hygiene over time', effect: () => { bump(g.state, 'stress', 8); bump(g.state, 'hygiene', -5); } },
        ],
      });
    },
  },
  {
    id: 'partner_nudge', weight: 5,
    when: (s) => !!s.romance?.liveIn || Object.values(s.romance?.partners || {}).some((p) => p && p.girlfriend),
    run(g) {
      const s = g.state;
      const id = s.romance?.liveIn || Object.keys(s.romance?.partners || {}).find((k) => s.romance.partners[k]?.girlfriend);
      const p = CONFIG.partners?.[id];
      if (!p) return;
      pushMessage(g, {
        from: p.name.toUpperCase(),
        subject: pick(['you okay?', 'hey', 'checking in']),
        body: pick([
          `"You have been quiet. I am not going to make it a thing. I am just saying I noticed."`,
          `"If today is a bad one, that is allowed. Eat something and text me one word."`,
          `"I put money in the envelope. Do not argue with me about it in your head."`,
        ]) + `\n\n— ${p.name[0]}.`,
      });
      bump(s, 'morale', 3);
    },
  },
  {
    id: 'street_music', weight: 5, repeat: true,
    when: (s) => (s.high?.level ?? 0) < 60,
    run(g) {
      const s = g.state;
      if (g.world?.areaId === 'park') {
        bump(s, 'morale', 5);
        bump(s, 'stress', -5);
        g.toast('Somebody is playing a tape for nobody in particular. It is exactly the right song.', 'good');
      } else {
        bump(s, 'morale', 3);
        bump(s, 'stress', -3);
        g.toast('A car goes past with the windows down and the song is somehow from your old apartment.', 'info');
      }
    },
  },
];

/*
 * Scheduling. Every event below now goes through systems/scheduler.js, which owns the dice, the
 * per-event cooldown, the time-of-day window, the once-only flag and the saved history. The
 * table here is only the extra policy: how rare each event is, and how long before it may come
 * back. Adding an event means adding it to EVENTS and giving it a line here.
 */
const POLICY = {
  found_money: { cooldownHours: 20 },
  pipe_leak: { cooldownHours: 72, once: true },
  food_theft: { cooldownHours: 30 },
  dale_overtime: { cooldownHours: 30 },
  nia_call: { cooldownHours: 44, maxPerDay: 1 },            // not every single day
  addison_flyer: { cooldownHours: 96, once: true },
  free_sample: { cooldownHours: 26 },
  bad_batch: { cooldownHours: 60, once: true },
  cat: { cooldownHours: 120, once: true },
  neighbor_music: { cooldownHours: 20 },
  bus_fare: { cooldownHours: 24 },
  invite_out: { cooldownHours: 30, window: [10 * 60, 21 * 60] },
  power_flicker: { cooldownHours: 36 },
  addison_knock: { cooldownHours: 48 },
  guitar_nostalgia: { cooldownHours: 30 },
  passing_gift: { cooldownHours: 40 },
  the_look: { cooldownHours: 26 },
  followers_spike: { cooldownHours: 24 },
  clinic_referral: { cooldownHours: 48, once: true },
  park_invite: { cooldownHours: 30, window: [9 * 60, 20 * 60] },
  surprise_expense: { cooldownHours: 36 },
  partner_nudge: { cooldownHours: 40, maxPerDay: 1 },
  street_music: { cooldownHours: 18, where: ['street', 'park'] },
};

for (const ev of EVENTS) {
  const policy = POLICY[ev.id] || {};
  ev.cooldownHours = ev.cooldownHours ?? policy.cooldownHours ?? 18;
  ev.window = ev.window ?? policy.window;
  ev.where = ev.where ?? policy.where;
  ev.once = ev.once ?? policy.once ?? false;
  ev.maxPerDay = ev.maxPerDay ?? policy.maxPerDay;
  // the old `repeat` flag maps onto the scheduler's once-only rule
  if (ev.repeat === false) ev.once = true;
}

export function rollEvent(g, hours) {
  const chosen = scheduler.roll(g, hours, EVENTS);
  if (chosen) g.state.events.count = (g.state.events.count || 0) + 1;
  return chosen;
}

export function fireEvent(g, id) {
  const e = EVENTS.find((x) => x.id === id);
  if (e) scheduler.fire(g, e);
}

/** Every id, for the debug menu's "trigger a random event" list. */
export const EVENT_IDS = EVENTS.map((e) => e.id);
/** The live list, for the debug menu's trigger control. */
export const EVENTS_LIST = EVENTS;

export const EVENT_COUNT = EVENTS.length;
