/**
 * Things that happen to you on Kestrel Street.
 *
 * One encounter at a time, on a cooldown, never during a shift and never while a panel is
 * already open. Each one is a small decision with a stat or money consequence, and each one
 * leaves a line in the log so the day has texture when you look back at it.
 */
import { CONFIG } from '../core/config.js';
import { money, chance, pick, randInt, dayOf, minuteOfDay } from '../core/util.js';
import { bump, addItem } from '../core/state.js';

const COOLDOWN_MINUTES = 55;

export function maybeStreetEvent(g) {
  const s = g.state;
  if (!g.world || g.world.areaId !== 'street') return;
  if (g.modalOpen || g.phoneOpen || g.paused) return;
  const now = s.clock.m;
  if (s.street && now - s.street.lastAt < COOLDOWN_MINUTES) return;
  if (!chance(0.42)) { s.street = { lastAt: now - COOLDOWN_MINUTES + 12 }; return; }
  s.street = { lastAt: now };

  const mod = minuteOfDay(now);
  const pool = [panhandler, watchGuy, preacher, sidewalkArgument, spilledGroceries, skateKids];
  if (mod > 20 * 60 || mod < 5 * 60) pool.push(nightAlley, nightAlley);
  if (s.stats.hunger < 30) pool.push(freeSample);
  pick(pool)(g);
}

/* -------------------------------- encounters ------------------------------- */

function panhandler(g) {
  const s = g.state;
  const lines = [
    '“Spare anything? Anything at all. A quarter, a cigarette, a lie about my future.”',
    '“I’m not gonna lie to you, man. I’m just hungry.”',
  ];
  g.openModal({
    kicker: 'KESTREL ST. · THE SIDEWALK',
    title: 'A Man With A Cup',
    body: `${pick(lines)}\n\nHe is not performing. That is somehow worse.`,
    choices: [
      { label: 'Give him $5.', sub: '-$5 · +morale', disabled: s.money < 5, effect: () => { g.spendMoney(5, 'Panhandler'); bump(s, 'morale', 7); bump(s, 'stress', -3); g.toast('He says "God bless" and means about 60% of it.', 'good'); } },
      { label: 'Give him a cigarette.', sub: '-1 loosies', disabled: !s.inventory.some((i) => i.id === 'loosies'), effect: () => { addItem(s, 'loosies', -0); s.inventory.find((i) => i.id === 'loosies').qty -= 1; if (s.inventory.find((i) => i.id === 'loosies').qty <= 0) s.inventory = s.inventory.filter((i) => i.id !== 'loosies'); bump(s, 'morale', 3); bump(s, 'stress', -6); g.toast('He smokes it like it is the last one. It might be.', 'info'); } },
      { label: 'Say "sorry, man" and keep walking.', sub: '+stress', effect: () => { bump(s, 'stress', 4); bump(s, 'morale', -3); g.toast('You think about it for the rest of the block.', 'bad'); } },
    ],
  });
}

function watchGuy(g) {
  const s = g.state;
  g.openModal({
    kicker: 'KESTREL ST. · A COAT WITH TOO MANY POCKETS',
    title: '“Rolex. Forty dollars.”',
    body: 'It is not a Rolex. Both of you know it is not a Rolex. That is not really what is being sold here.',
    choices: [
      { label: 'Buy it for $20.', sub: '-$20 · resale gamble', disabled: s.money < 20, effect: () => {
        g.spendMoney(20, 'Watch guy');
        if (chance(0.35)) { addItem(s, 'watch', 1); g.toast('The back says SWISS MADE in a font that has never been to Switzerland. Still, it ticks.', 'good'); }
        else { bump(s, 'morale', -4); g.toast('It stops before you reach the corner. He is already gone.', 'bad'); }
      } },
      { label: '“I’m good.”', sub: '', effect: () => {} },
    ],
  });
}

function preacher(g) {
  const s = g.state;
  g.openModal({
    kicker: 'KESTREL ST. · CORNER',
    title: 'A Man With A Folding Table',
    body: '“You look like a man carrying something heavy.” He has a leaflet. The leaflet has a gold border, which you recognise.',
    choices: [
      { label: 'Take the leaflet.', sub: 'Fellowship pamphlet', effect: () => { s.fellowship.stage = Math.max(s.fellowship.stage, 1); g.toast('The Golden Fellowship. Sunday, 11:00. "Come as you are, leave as ours."', 'gold'); } },
      { label: 'Ask him how much the leaflet costs.', sub: '+morale', effect: () => { bump(s, 'morale', 5); g.toast('He laughs before he can stop himself. "Nothing. Today."', 'good'); } },
      { label: 'Keep walking.', sub: '', effect: () => { bump(s, 'stress', 2); } },
    ],
  });
}

function sidewalkArgument(g) {
  const s = g.state;
  g.openModal({
    kicker: 'KESTREL ST.',
    title: 'Two People, One Stroller, No Baby',
    body: 'The argument is about a phone. It has been about the phone for eleven minutes. Everyone on the block is pretending to look at the sky.',
    choices: [
      { label: 'Watch it happen.', sub: '-15 min · +morale', effect: () => { g.advance(15); bump(s, 'morale', 4); bump(s, 'stress', -2); g.toast('It resolves when someone says "aight" and walks away. The block exhales.', 'info'); } },
      { label: 'Cross the street.', sub: '', effect: () => { g.advance(3); } },
    ],
  });
}

function spilledGroceries(g) {
  const s = g.state;
  g.advance(12);
  if (chance(0.5)) {
    addItem(s, pick(['eggs', 'beans', 'cereal']), 1);
    bump(s, 'morale', 3);
    g.toast('A woman drops a bag outside the bodega. You help. She gives you the carton that survived.', 'good');
  } else {
    bump(s, 'morale', 2);
    g.toast('A woman drops a bag outside the bodega. You help. She says nothing, which is fine.', 'info');
  }
}

function skateKids(g) {
  const s = g.state;
  g.openModal({
    kicker: 'KESTREL ST.',
    title: 'Four Kids And A Curb',
    body: 'One of them is very good. One of them is going to be very good. One of them is filming. They ask if you want a turn and you say no before you have decided to.',
    choices: [
      { label: 'Take a turn.', sub: 'risk of embarrassment', effect: () => {
        g.advance(10);
        if (chance(0.4)) { bump(s, 'morale', 10); bump(s, 'stress', -6); bump(s, 'energy', -5); g.toast('You land it. Nobody claps, but somebody nods.', 'good'); }
        else { bump(s, 'energy', -6); bump(s, 'stress', 5); bump(s, 'morale', -2); g.toast('You do not land it. The filming kid has it on film forever.', 'bad'); }
      } },
      { label: 'Watch.', sub: '+morale', effect: () => { g.advance(8); bump(s, 'morale', 4); bump(s, 'stress', -3); } },
      { label: 'Keep moving.', sub: '', effect: () => {} },
    ],
  });
}

function freeSample(g) {
  const s = g.state;
  g.advance(4);
  addItem(s, 'bar', 1);
  bump(s, 'hunger', 2);
  g.toast('A promo kid hands you a free sample and vanishes before you can say no.', 'good');
}

function nightAlley(g) {
  const s = g.state;
  g.openModal({
    kicker: 'KESTREL ST. · NIGHT',
    title: 'The Alley Has A Voice',
    body: '“Hey. Hey. You good?” It is not clear who is being asked. It is not clear that anyone is there.',
    choices: [
      { label: 'Answer.', sub: 'risky', effect: () => {
        if (chance(0.5)) { bump(s, 'stress', 9); bump(s, 'morale', -5); g.toast('Nobody answers back. You walk faster than you meant to.', 'bad'); }
        else { const cash = randInt(6, 18); g.earnMoney(cash, 'Found in the alley'); g.toast(`A man steps out, apologises for scaring you, and hands you ${money(cash)} he says you dropped. You did not.`, 'event'); }
      } },
      { label: 'Do not answer. Keep walking.', sub: '+stress', effect: () => { bump(s, 'stress', 5); } },
    ],
  });
}

export const STREET_EVENT_IDS = ['panhandler', 'watchGuy', 'preacher', 'sidewalkArgument', 'spilledGroceries', 'skateKids', 'nightAlley'];
