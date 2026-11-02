/**
 * Things that happen to you on Kestrel Street.
 *
 * Nothing here jumps in front of the player any more. A person with something to say is an actual
 * person: they come up the sidewalk, stop a step away and wait with a prompt over them (the man in
 * the long coat with a "Rolex", a panhandler with a cup), and the conversation is Mo walking over
 * and pressing F. Ignore them and they give up and go. Things Mo only sees (kids on a curb, an
 * argument over a stroller) are a line in the feed. Each encounter happens at most once a day,
 * never twice in a row, and the block goes quiet for a good while between them.
 */
import { CONFIG } from '../core/config.js';
import { money, chance, pick, randInt, dayOf, minuteOfDay } from '../core/util.js';
import { bump, addItem } from '../core/state.js';

const COOLDOWN_MINUTES = 150;   // a couple of hours of block between one thing and the next

/**
 * The encounters. `npc` ones walk up and wait to be talked to (run is the conversation); `feed`
 * ones are something Mo sees, told in a line. `when` limits them to the right hours or state.
 */
export const ENCOUNTERS = {
  panhandler: { npc: { kind: 'homeless', label: 'A man with a cup', sub: 'he has been watching you come up the block' }, run: (g) => panhandler(g) },
  watchGuy: { npc: { kind: 'drifter', label: 'The man in the long coat', sub: '"Rolex. Forty dollars."' }, run: (g) => watchGuy(g) },
  preacher: { npc: { kind: 'passer_m2', label: 'A man with a leaflet', sub: 'the paper has a gold border' }, run: (g) => preacher(g) },
  groceries: { npc: { kind: 'tenant_f', label: 'A woman with a split bag', sub: 'cans rolling toward the curb' }, run: (g) => spilledGroceries(g) },
  sample: { npc: { kind: 'clerk', label: 'A promo kid with a tray', sub: 'free samples, apparently' }, when: (s) => s.stats.hunger < 40, run: (g) => freeSample(g) },
  argument: { feed: ['Two people, one stroller, no baby. The argument is about a phone and has been for eleven minutes. The whole block is looking at the sky.', 'Somebody on a fire escape is yelling a list of things somebody else did in 1994. The list is long and specific.'] },
  skaters: { feed: ['Four kids and a curb. One is very good, one is going to be, one is filming. They do not ask you to take a turn, which is a mercy.', 'A kid lands a trick off the bodega step and does not look around to see who saw. Everybody saw.'] },
  alley: { feed: ['"Hey. Hey. You good?" comes out of the alley. It is not clear who is being asked. You do not stop to find out.', 'Something in the alley knocks over a can. It is either a cat or a decision. You keep walking.'], when: (s) => { const m = minuteOfDay(s.clock.m); return m > 20 * 60 || m < 5 * 60; } },
};

export function maybeStreetEvent(g) {
  const s = g.state;
  if (!g.world || g.world.areaId !== 'street') return;
  if (g.modalOpen || g.phoneOpen || g.paused || g.uiBusy) return;
  if (g.world.encounter) return;                       // somebody is already waiting on him
  const now = s.clock.m;
  const st = s.street || (s.street = { lastAt: -9999, seen: {}, last: null });
  st.seen = st.seen || {};
  if (now - st.lastAt < COOLDOWN_MINUTES) return;
  if (!chance(0.5)) { st.lastAt = now - COOLDOWN_MINUTES + 30; return; }
  const day = dayOf(now);
  const ids = Object.keys(ENCOUNTERS).filter((id) => st.seen[id] !== day && id !== st.last && (!ENCOUNTERS[id].when || ENCOUNTERS[id].when(s)));
  if (!ids.length) { st.lastAt = now; return; }
  const id = pick(ids);
  const ev = ENCOUNTERS[id];
  st.lastAt = now;
  st.seen[id] = day;
  st.last = id;
  if (ev.npc && g.world.spawnEncounter) g.world.spawnEncounter({ ...ev.npc, id }, () => ev.run(g));
  else if (ev.feed) g.toast(pick(ev.feed), 'info');
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

function spilledGroceries(g) {
  const s = g.state;
  g.openModal({
    kicker: 'KESTREL ST.',
    title: 'A Split Bag',
    body: 'The bottom went out of it right outside the bodega. Cans are heading for the curb at different speeds and she is trying to catch all of them with one hand.',
    choices: [
      { label: 'Help her pick it up.', sub: '12 min · +morale', effect: () => {
        g.advance(12);
        if (chance(0.5)) { addItem(s, pick(['eggs', 'beans', 'cereal']), 1); bump(s, 'morale', 3); g.toast('She gives you the carton that survived, and insists.', 'good'); }
        else { bump(s, 'morale', 2); g.toast('She says nothing, which is fine. You both know.', 'info'); }
      } },
      { label: 'Keep walking.', sub: '', effect: () => { bump(s, 'morale', -1); } },
    ],
  });
}

function freeSample(g) {
  const s = g.state;
  g.advance(4);
  addItem(s, 'bar', 1);
  bump(s, 'hunger', 2);
  g.toast('He hands you a protein brick and a coupon for more protein bricks. "Stay strong, king."', 'good');
}

export const STREET_EVENT_IDS = Object.keys(ENCOUNTERS);
