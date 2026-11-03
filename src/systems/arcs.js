/**
 * Short stories that take a few days: Kev in trouble and pretending not to be, Nia with a
 * problem of her own, Habib thinking about closing earlier, Gloria in 4B facing eviction, and
 * Dale offering Mo more at exactly the wrong time. Each is a handful of texts across several days,
 * and each ends in one of a few ways, most of them imperfect and humane. There is no best ending.
 *
 * Choices are stored as { arc, opt } (not functions), so a story survives a save; sms.js resolves
 * them through choose().
 *
 *   s.arcs = { [id]: { stage, next, picks: {}, done, ending } }
 */
import { pushMessage, bump, logLine } from '../core/state.js';
import { dayOf, money, pick } from '../core/util.js';
import { addOwe } from './owes.js';
import * as home from './home.js';

const msg = (g, from, subject, body, a, opts) => pushMessage(g, { from, subject, body, choices: opts.map(([label, opt]) => ({ label, arc: a.id, opt })) });
const npc = (s, id, d) => { s.npc = s.npc || {}; s.npc[id] = Math.max(-6, Math.min(20, (Number(s.npc[id]) || 0) + d)); };

export const ARCS = {
  kev: {
    name: 'Kev is fine',
    start: (s, day) => day >= 4,
    stages: [
      (g, a) => msg(g, 'KEV', 'random q', 'lol totally random question. how much is a u-haul. like for a day. asking for a friend. the friend is fine', a, [['Kev. What is going on?', 'ask'], ['Like forty bucks I think.', 'shrug']]),
      (g, a) => msg(g, 'KEV', 're', a.picks[0] === 'ask'
        ? 'ok. the guy i rent the room from is selling the house. i got till sunday. i didnt want to make it a thing. its a thing'
        : 'cool cool. unrelated: the guy i rent from is selling the house and i have to be out by sunday. anyway forty bucks thanks', a,
        [['Crash on my couch for a few nights.', 'couch'], ['I will help you move Saturday.', 'move'], ['I can lend you fifty.', 'lend'], ['You will figure it out, man.', 'figure']]),
      (g, a) => {
        const s = g.state;
        const p = a.picks[1];
        let body;
        if (p === 'couch') { body = home.has(s, 'couch') ? 'three nights on your couch. you snore. i snore worse. found a room in bushwick, a real one with a door. i owe you forever, which is a long time' : 'three nights on your floor. you dont have a couch. it was fine. found a room in bushwick. i owe u'; bump(s, 'hygiene', -6); npc(s, 'kev', 4); }
        else if (p === 'move') {
          const owed = (s.owes || []).find((o) => o.who === 'kev' && o.kind === 'help' && o.note === 'moving Kev');
          if (owed && !owed.settled) { owed.settled = dayOf(s.clock.m); body = 'you said saturday. you didnt come. its ok. my cousin came with his van and we did it in four trips. i am not mad. i am a little mad'; npc(s, 'kev', -1); }
          else { body = 'saturday was the worst day of my life and you were there for all of it. the room in bushwick has a door. thank you. i mean it, which is weird for me'; npc(s, 'kev', 3); }
        }
        else if (p === 'lend') { body = 'the fifty got me the first week at a room in bushwick. i WILL pay you back. probably in installments of two dollars'; npc(s, 'kev', 2); }
        else { body = 'figured it out. my cousin in canarsie. its fine. its fine. anyway see u at work'; npc(s, 'kev', -1); }
        pushMessage(g, { from: 'KEV', subject: 'update', body });
        return true;
      },
    ],
    effects: { move: (g) => addOwe(g, { who: 'kev', kind: 'help', hours: 3, note: 'moving Kev', due: dayOf(g.state.clock.m) + 3 }), lend: (g) => { if (g.state.money >= 50) { g.spendMoney(50, 'lent Kev'); addOwe(g, { who: 'kev', dir: 'them', kind: 'cash', amount: 50, due: 999 }); } else g.toast('You do not have fifty. You tell him so. He says "same."', 'info'); } },
    gaps: [1, 3],
  },
  nia: {
    name: 'Nia’s Thursday',
    start: (s, day) => day >= 5 && (Number(s.npc?.nia) || 0) >= 1,
    stages: [
      (g, a) => msg(g, 'NIA', 'thursday', 'can you watch Jayden thursday night 6 to 10. my manager moved my class and if i miss another one they drop me. never mind. forget it. you have your own stuff', a, [['I will be there.', 'yes'], ['What time again?', 'yes'], ['I cannot. I am sorry.', 'no']]),
      (g, a) => {
        if (a.picks[0] === 'no') { pushMessage(g, { from: 'NIA', subject: 're', body: 'its ok. i asked mom. she said yes and also said a lot of other things. its fine. i love you' }); npc(g.state, 'nia', -1); return true; }
        return msg(g, 'NIA', 'tonight', 'tonight, 6. Jayden eats at 7. no sugar. he will ask for sugar. he will tell you mom lets him. mom does not let him', a, [['Go to Nia’s (4 hours).', 'go'], ['Go, but late.', 'late'], ['Something came up.', 'bail']]);
      },
      (g, a) => {
        const s = g.state;
        const p = a.picks[1];
        if (p === 'go') { g.advance(240); bump(s, 'morale', 10); bump(s, 'energy', -8); npc(s, 'nia', 4); pushMessage(g, { from: 'NIA', subject: 'thank you', body: 'i passed the quiz. Jayden says you are "the fun one" and that you let him have sugar. we will discuss that. thank you, for real' }); }
        else if (p === 'late') { g.advance(180); bump(s, 'morale', 3); npc(s, 'nia', 1); pushMessage(g, { from: 'NIA', subject: 'thanks', body: 'i missed the first half hour. it is ok. you came. that counts. next time, 6 means 6' }); }
        else { npc(s, 'nia', -3); bump(s, 'morale', -6); pushMessage(g, { from: 'NIA', subject: '.', body: 'ok' }); }
        return true;
      },
    ],
    gaps: [2, 0],
  },
  habib: {
    name: 'Habib’s hours',
    start: (s, day) => day >= 6,
    stages: [
      (g, a) => msg(g, 'HABIB', 'my friend', 'My friend, business is slow since the place with the lights opened on Fulton. I am thinking I close at midnight now, not two. My feet would be happy. My wallet would not.', a, [['I will tell everybody about the chicken over rice.', 'post'], ['I will eat there more this week.', 'eat'], ['Your feet matter too, Habib.', 'feet']]),
      (g, a) => {
        const s = g.state;
        const p = a.picks[0];
        const keep = p === 'post' ? (s.feedPosts || []).length > a.posts0 : p === 'eat' ? (s.counters?.meals || 0) - a.meals0 >= 3 : false;
        if (keep) { npc(s, 'habib', 3); pushMessage(g, { from: 'HABIB', subject: 'good news', body: 'Busier this week. Three people said "Mo sent me." I stay open until two. Your next plate is free and I will not discuss it.' }); s.flags.habibFree = true; }
        else if (p === 'feet') { s.flags.habibShortHours = true; npc(s, 'habib', 2); pushMessage(g, { from: 'HABIB', subject: 'midnight', body: 'I close at midnight now. My wife says thank you to you specifically. I sleep. It is strange. It is good.' }); }
        else { s.flags.habibShortHours = true; pushMessage(g, { from: 'HABIB', subject: 'midnight', body: 'It was not enough, my friend, but thank you for trying. Midnight now. Come before eleven and I will make it the way you like.' }); }
        return true;
      },
    ],
    onPick: { post: (s, a) => { a.posts0 = (s.feedPosts || []).length; }, eat: (s, a) => { a.meals0 = s.counters?.meals || 0; } },
    gaps: [4],
  },
  gloria: {
    name: 'Gloria in 4B',
    start: (s, day) => day >= 8,
    stages: [
      (g, a) => msg(g, 'HECTOR', 'Gloria', 'Gloria in 4B got a notice on her door. Fourteen days. Rae says she is behind; Gloria says Rae never cashed the money order. She is 81. She has the receipt somewhere, she says, in a tin.', a, [['Help her find the receipt and write to housing court.', 'court'], ['Give her twenty dollars.', 'cash'], ['Get the building together about it.', 'tenants'], ['It is not my business.', 'out']]),
      (g, a) => {
        const s = g.state;
        const p = a.picks[0];
        if (p === 'court') pushMessage(g, { from: 'HECTOR', subject: 'Gloria', body: 'The judge gave her sixty days and told Rae to find the money order. It is not over. It is time, which at 81 is the same as money.' });
        else if (p === 'tenants') { s.tenants = s.tenants || {}; s.tenants.support = (s.tenants.support || 0) + 2; pushMessage(g, { from: 'HECTOR', subject: 'Gloria', body: 'Eleven of us were in the hall when Rae came up. He did not say much. He said "let us talk about a payment plan." Gloria made coffee for everybody.' }); }
        else if (p === 'cash') pushMessage(g, { from: 'HECTOR', subject: 'Gloria', body: 'She used your twenty for the cab to housing court. She says the cab driver was rude and the judge was nice. She has thirty more days.' });
        else pushMessage(g, { from: 'HECTOR', subject: 'Gloria', body: 'Her nephew from Jersey came for her. The apartment is empty. Somebody new moves in next week, at twice the rent.' });
        if (p !== 'out') { bump(s, 'morale', 6); npc(s, 'gloria', 3); } else bump(s, 'morale', -4);
        return true;
      },
    ],
    effects: { court: (g) => { g.advance(90); }, cash: (g) => { if (g.state.money >= 20) g.spendMoney(20, 'Gloria'); }, tenants: (g) => { g.advance(60); } },
    gaps: [5],
  },
  dale: {
    name: 'More responsibility',
    start: (s, day) => day >= 9 && s.job?.employed && (s.job.shiftsWorked || 0) >= 3,
    stages: [
      (g, a) => msg(g, 'DALE (QUIK-STOP #14)', 'a thing', `Mo. Assistant manager. A dollar fifty more an hour, the keys, the closing count, and you are the one corporate calls when the slushie machine dies. Starts Monday.${g.state.clinic?.course?.active || g.state.stats.stress > 70 ? ' I know the timing is not great. It never is.' : ''}`, a, [['Yes. I will take it.', 'yes'], ['Not right now.', 'no'], ['Let me think about it.', 'think']]),
      (g, a) => {
        const s = g.state;
        const p = a.picks[0];
        if (p === 'think') return msg(g, 'DALE (QUIK-STOP #14)', 'well?', 'It has been two days. Corporate is asking. I said you were "deliberating." They said "who."', a, [['Yes.', 'yes'], ['No. Thank you, though.', 'no']]);
        return finishDale(g, p);
      },
      (g, a) => finishDale(g, a.picks[1]),
    ],
    gaps: [2, 0],
  },
};

function finishDale(g, p) {
  const s = g.state;
  if (p === 'yes') {
    s.job.wage = Math.round((s.job.wage + 1.5) * 100) / 100;
    s.job.title = 'Assistant Manager';
    s.job.shiftEnd += 60;
    npc(s, 'dale', 2);
    bump(s, 'stress', 6);
    bump(s, 'morale', 8);
    pushMessage(g, { from: 'DALE (QUIK-STOP #14)', subject: 'keys', body: 'Keys are on the hook. Your shift runs an hour later now, for the count. Welcome to management. It is the same job but you get yelled at by more people.' });
  } else {
    npc(s, 'dale', -1);
    bump(s, 'stress', -4);
    pushMessage(g, { from: 'DALE (QUIK-STOP #14)', subject: 'ok', body: 'Ok. Marcus will take it. Marcus. Think about that. No hard feelings. Some feelings.' });
  }
  return true;
}

export function arcsState(s) { if (!s.arcs) s.arcs = {}; return s.arcs; }

/** A choice from one of the story texts. */
export function choose(g, id, opt) {
  const s = g.state;
  const a = arcsState(s)[id];
  const def = ARCS[id];
  if (!a || a.done || !def) return;
  const idx = a.stage - 1;
  if (a.picks[idx] !== undefined) { g.toast('You already answered that.', 'info'); return; }
  a.picks[idx] = opt;
  def.effects?.[opt]?.(g);
  def.onPick?.[opt]?.(s, a);
  a.next = dayOf(s.clock.m) + (def.gaps[idx] ?? 1);
  if (a.next === dayOf(s.clock.m)) fire(g, id);
}

function fire(g, id) {
  const s = g.state;
  const a = arcsState(s)[id];
  const def = ARCS[id];
  const stage = def.stages[a.stage];
  a.id = id;
  a.stage += 1;
  a.next = null;
  const r = stage(g, a);
  if (r === true || a.stage >= def.stages.length) { a.done = true; logLine(g, `${def.name}: that story is over, for now.`, 'event'); }
}

/** Each morning: a new story, sometimes; the next text of any story that is waiting. */
export function arcsNewDay(g, day) {
  const s = g.state;
  const st = arcsState(s);
  for (const [id, a] of Object.entries(st)) if (!a.done && a.next != null && day >= a.next) fire(g, id);
  const running = Object.values(st).filter((a) => !a.done).length;
  if (running >= 2 || Math.random() > 0.3) return;
  const ready = Object.keys(ARCS).filter((id) => !st[id] && ARCS[id].start(s, day));
  if (!ready.length) return;
  const id = pick(ready);
  st[id] = { stage: 0, next: null, picks: {}, done: false };
  fire(g, id);
}
