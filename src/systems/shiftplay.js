/**
 * A Quik-Stop shift you play instead of skip: four things happen at the counter, drawn from a
 * pool, and how Mo handles them is the shift's score. The score nudges the pay, Dale's trust
 * and Kev's, and at worst earns one warning; it never fires anybody on its own. "Work normally"
 * is still there for anybody who has seen enough coupons for one life.
 */
import { bump, logLine } from '../core/state.js';
import { pick, money } from '../core/util.js';
import { workShift } from './jobs.js';

const npc = (s, id, d) => { s.npc = s.npc || {}; s.npc[id] = Math.max(-6, Math.min(10, (Number(s.npc[id]) || 0) + d)); };

/** Each situation: a title, a body, and choices that return { score, line } (and may touch state). */
const SITUATIONS = [
  {
    id: 'short', title: 'The Drawer Is Short',
    body: 'Mid-shift count: the register is twelve dollars short. Nobody has touched it but you, Kev, and a man who asked for change for a twenty and left with a very confident face.',
    choices: (g) => [
      { label: 'Count it again. Slowly.', sub: 'takes a minute · might find it', effect: () => (Math.random() < 0.65 ? { score: 2, line: 'A ten and two singles, folded inside the receipt roll. The drawer is whole. So are you.' } : { score: 0, line: 'Still twelve short. You counted it so slowly that a line formed behind the line.' }) },
      { label: 'Cover it from your own pocket.', sub: '$12 · Dale never knows', disabled: g.state.money < 12, effect: () => { g.spendMoney(12, 'covered the drawer'); npc(g.state, 'dale', 1); return { score: 1, line: 'You put in twelve of your own. The drawer balances. Your pocket does not.' }; } },
      { label: 'Tell Dale straight.', sub: 'honest', effect: () => { npc(g.state, 'dale', 1); return { score: 1, line: 'Dale sighs the sigh of a man who has been twelve dollars short since 1991. "Thanks for telling me." He means it.' }; } },
      { label: 'Shrug. Drawers are short.', sub: 'risky', effect: () => (Math.random() < 0.5 ? { score: -2, line: 'At close Dale counts it himself and looks at you for a long time.' } : { score: 0, line: 'Nobody notices. You notice. That is enough.' }) },
    ],
  },
  {
    id: 'coupon', title: 'Basically Money',
    body: 'A woman in a church hat slides a coupon across the counter. Fifty cents off a two-liter. It expired in 1997. "It is basically money," she says, and she is not asking.',
    choices: (g) => [
      { label: 'Honor it. It is fifty cents.', sub: '+morale · Dale would not', effect: () => { bump(g.state, 'morale', 3); return { score: 0, line: '"God bless you." She means it so hard you almost feel blessed. The drawer is fifty cents lighter and the day is a little better.' }; } },
      { label: 'Explain, kindly, that it expired.', sub: 'by the book', effect: () => (Math.random() < 0.6 ? { score: 1, line: 'She takes it well. She takes the coupon, too, back into her purse, for the next store.' } : { score: 1, line: '"Your mother would be ashamed." She pays full price. Your mother would, honestly, be fine with it.' }) },
      { label: 'Call Dale over.', sub: 'make it his problem', effect: () => { npc(g.state, 'dale', -1); return { score: -1, line: 'Dale walks over from the back, reads the date, looks at you, and honors it. "You called me out of the freezer for this."' }; } },
    ],
  },
  {
    id: 'delivery', title: 'Delivery, Now',
    body: 'The Frito-Lay guy is at the side door with nine boxes and a clipboard. The line at the register is six deep and growing, and the man at the front is paying in nickels.',
    choices: (g) => [
      { label: 'Ring the line out first.', sub: 'customers first', effect: () => (Math.random() < 0.5 ? { score: 1, line: 'You clear the line. The Frito-Lay guy left the boxes in the doorway and a note that says "SIGN THIS" in a tone.' } : { score: 0, line: 'You clear the line. The Frito-Lay guy is gone, and so is the delivery. It is tomorrow\'s problem now. Dale makes it today\'s.' }) },
      { label: 'Sign for it, then ring.', sub: 'the line waits', effect: () => { bump(g.state, 'stress', 3); return { score: 0, line: 'You sign. The line watches you sign. A man says "unbelievable" in a voice that carries.' }; } },
      { label: 'Yell for Kev to take the delivery.', sub: 'if he is around', effect: () => { if (Math.random() < 0.55) { npc(g.state, 'kev', 1); return { score: 2, line: '"GOT IT." Kev appears from nowhere, signs, stacks, and is gone again. Teamwork, for once.' }; } return { score: -1, line: 'Silence from the back. Kev is not around. Kev is never around when there are boxes.' }; } },
    ],
  },
  {
    id: 'kev', title: 'Watch The Counter',
    body: '"Watch the counter for two minutes," Kev says, already untying his apron. That was forty minutes ago. Dale is coming in from the back and asks where Kev is.',
    choices: (g) => [
      { label: 'Cover for him. "Bathroom."', sub: '+Kev · a small lie', effect: () => { npc(g.state, 'kev', 2); return { score: 0, line: '"For forty minutes?" Dale lets it go. Kev comes back eating a chopped cheese and mouths "I owe you." He does.' }; } },
      { label: 'Tell Dale the truth.', sub: '+Dale · -Kev', effect: () => { npc(g.state, 'dale', 1); npc(g.state, 'kev', -2); return { score: 1, line: 'Dale writes something down. When Kev comes back, he does not say anything to you for the rest of the shift, which for Kev is a speech.' }; } },
      { label: 'Text him: "where r u"', sub: 'buys time', effect: () => (Math.random() < 0.5 ? { score: 1, line: 'Kev texts back "2 min" and is back in two minutes, which is the first time that has ever happened.' } : { score: -1, line: 'Kev texts back a photo of a pigeon. No words. Dale is still waiting for an answer.' }) },
    ],
  },
  {
    id: 'thief', title: 'Somebody Is Walking Out',
    body: 'A kid in a puffer jacket is walking out with two bags of chips and a honey bun under his coat. He looks maybe fifteen. He looks hungry. He looks at you.',
    choices: (g) => [
      { label: 'Stop him at the door.', sub: 'energy · Dale would', effect: () => { bump(g.state, 'energy', -6); npc(g.state, 'dale', 1); return { score: 1, line: 'You get between him and the door. He puts everything back on the counter, one item at a time, and leaves without a word.' }; } },
      { label: 'Let it go.', sub: 'not your store', effect: () => ({ score: 0, line: 'The door chimes. Shrinkage, the corporate manual calls it. A kid, you call it.' }) },
      { label: '"Take it. Go."', sub: '+morale · if Dale sees…', effect: () => { bump(g.state, 'morale', 4); if (Math.random() < 0.3) { npc(g.state, 'dale', -1); return { score: -2, line: 'He nods and goes. Dale saw it from the back. "That comes out of somebody\'s check, Mo. Guess whose."' }; } return { score: 0, line: 'He nods once and is gone. You ring up the honey bun on your own dollar. Nobody needs to know.' }; } },
    ],
  },
  {
    id: 'lotto', title: 'The Lottery Rush',
    body: 'The jackpot is up to nine million and the whole block wants a ticket at once. The terminal is slow. One man wants his numbers "exactly how I said them last week."',
    choices: (g) => [
      { label: 'Work the terminal fast.', sub: 'stress · tips', effect: () => { bump(g.state, 'stress', 4); return { score: 2, line: 'Forty tickets in twenty minutes. A woman tips you a scratch-off. It is a loser. It is the thought.' }; } },
      { label: 'Ask for patience.', sub: 'calm', effect: () => ({ score: 0, line: 'The line is not patient. The line has never been patient. The line has nine million reasons.' }) },
    ],
  },
  {
    id: 'key', title: 'The Bathroom Key',
    body: 'A man who has clearly been somewhere since noon wants the bathroom key. The key is attached to a hubcap so nobody steals it. He is looking at the hubcap like it owes him money.',
    choices: (g) => [
      { label: 'Give him the key.', sub: 'kindness · cleanup', effect: () => { bump(g.state, 'hygiene', -3); return { score: 0, line: 'He brings the hubcap back twenty minutes later and thanks you formally. You do not go in there for the rest of the shift.' }; } },
      { label: '"Customers only."', sub: 'policy', effect: () => ({ score: 1, line: 'He buys a pack of gum to become a customer. Fair. You hand over the hubcap.' }) },
    ],
  },
];

/**
 * Play the shift: four situations, then the clock and the pay (jobs.workShift with the score).
 * Returns false if he cannot clock in at all.
 */
export function playShift(g) {
  const pool = [...SITUATIONS].sort(() => Math.random() - 0.5).slice(0, 4);
  const res = { score: 0, lines: [] };
  const step = (i) => {
    if (i >= pool.length) return finish(g, res);
    const sit = pool[i];
    g.openModal({
      kicker: `QUIK-STOP #14 · YOUR SHIFT · ${i + 1} OF ${pool.length}`, title: sit.title, body: sit.body,
      choices: sit.choices(g).map((c) => ({
        ...c,
        effect: () => {
          const r = c.effect() || { score: 0, line: '' };
          res.score += r.score;
          if (r.line) res.lines.push(r.line);
          g.toast(r.line, r.score > 0 ? 'good' : r.score < 0 ? 'bad' : 'info');
          setTimeout(() => step(i + 1), 60);
        },
      })),
    });
  };
  step(0);
  return true;
}

function finish(g, res) {
  const s = g.state;
  const ok = workShift(g, { played: true, score: res.score });
  if (!ok) return;
  s.job.bestShift = Math.max(s.job.bestShift ?? -99, res.score);
  logLine(g, `Played a shift at the Quik-Stop: ${res.score >= 3 ? 'a good one' : res.score <= -2 ? 'a rough one' : 'an ordinary one'}.`, res.score >= 3 ? 'good' : res.score <= -2 ? 'bad' : 'info');
  g.openModal({
    kicker: 'QUIK-STOP #14 · CLOCKING OUT', title: res.score >= 3 ? 'A Good Shift' : res.score <= -2 ? 'A Rough Shift' : 'A Shift',
    body: `${res.score >= 3 ? `Dale catches you at the door and slides you ${money(8)} "for the lottery thing, or whatever." From Dale that is a parade.` : res.score <= -2 ? 'Dale says "we will talk about it" in the voice that means a warning is already written down.' : 'Nobody says anything, which at the Quik-Stop is a good review.'}\n\nShift score: ${res.score > 0 ? '+' : ''}${res.score}.`,
    choices: [{ label: 'Go home.', effect: () => {} }],
  });
}

export const SHIFT_SITUATIONS = SITUATIONS.map((x) => x.id);
