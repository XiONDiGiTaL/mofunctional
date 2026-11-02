/**
 * The comment sections on FeedLove, and the people in them.
 *
 * Every post has comments now: under the neighbours' posts they are seeded from the post id, so
 * the same post always has the same strangers under it; under Mo's they are rolled when he posts
 * and kept. The strangers are generated too (a handle, a face, a bio, a post count, a temper),
 * and a tap on a face opens their profile. From there, or from a comment, Mo can start an
 * argument: three rounds of picking a reply, the stranger answers each one, and it ends the way
 * these end, with nobody convinced and Mo's stress somewhere new.
 */
import { bump, logLine } from '../core/state.js';
import { pick } from '../core/util.js';

function rng(seed) {
  let t = seed >>> 0;
  return () => { t = (t + 0x6d2b79f5) >>> 0; let r = Math.imul(t ^ (t >>> 15), 1 | t); r ^= r + Math.imul(r ^ (r >>> 7), 61 | r); return ((r ^ (r >>> 14)) >>> 0) / 4294967296; };
}
const hashStr = (str) => { let h = 2166136261; for (const c of String(str)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
const rpick = (r, a) => a[Math.floor(r() * a.length)];

const KINDS = ['tenant_m', 'tenant_f', 'passer_m', 'passer_m2', 'drifter', 'hall_m', 'hall_f', 'newsman', 'benchman', 'boxer', 'transit', 'rasta', 'baller1', 'baller2', 'baller3', 'baller4', 'wg1', 'wg2', 'wg3', 'shopclerk', 'waiter', 'clerk'];
const FIRST = ['big', 'lil', 'real', 'xX', 'not', 'the', 'only', 'mr', 'ms', 'its', 'dj', 'saint', 'chef', 'kingsco', 'bklyn', 'ashby'];
const LAST = ['tony', 'dreamer', 'mike718', 'truthteller', 'carla_b', 'grindset', 'auntiepam', 'xXdarkangelXx', 'fitfam', 'boss_lady', 'nobodyknows', 'sneakerhead', 'cryptogod99', 'deacon_ray', 'tina', 'cheesesteak', 'mets_forever', 'ladybug', 'doctorofvibes', 'renaldo'];
const BIOS = [
  'entrepreneur · dm for rates · no time wasters', 'mother of 3, wife of 1, boss of 0', 'i say what everyone is thinking', 'god first. then the gym. then you.',
  'living my truth (it is a 2 bedroom in canarsie)', 'NOT a bot', 'opinions are mine and also correct', 'crypto · pyramids (the shape) · positivity', 'just here for the comments',
  'retired from everything except arguing', 'blessed and highly favored and highly caffeinated', 'ex-model (one catalog, 1994)', 'i will reply to you at 3am',
];
const TEMPERS = ['troll', 'nice', 'thirsty', 'preachy', 'grifter', 'auntie'];

const COMMENTS = {
  troll: ['ratio', 'who asked', 'bro posted this willingly', 'this is why your landlord texts you', 'L', 'unfollowed then followed again just to unfollow', 'nobody: / mo:', 'my grandma has more followers and she passed in 96'],
  nice: ['love this for you', 'proud of you fr', 'you got this king', 'this made my day ngl', 'keep going', 'hey stranger!! call me'],
  thirsty: ['hey handsome', 'u single?', 'dm me', 'the jawline tho', 'i would let you fix my sink', 'is that ur apartment? asking for me'],
  preachy: ['have you tried waking up at 4am', 'cut out sugar and this wont happen', 'this is what happens when you dont journal', 'the grind does not stop for feelings', 'pray on it'],
  grifter: ['CASHAPP ME 5 AND I WILL SEND 50 (LEGIT)', 'dm me to learn how i made $4,000 this week from my couch', 'great post! check my page for MLM opportunities (not an MLM)', 'invest in TRADEHARDER penny stocks w me'],
  auntie: ['are you eating?', 'call your mother', 'who is this I am going to tell your mother', 'you look thin', 'is that the hoodie from christmas', 'come to church sunday'],
};

/** A stranger, rebuilt from their handle every time: the same handle is the same person. */
export function stranger(handle) {
  const r = rng(hashStr(handle));
  return {
    handle,
    kind: rpick(r, KINDS),
    temper: rpick(r, TEMPERS),
    bio: rpick(r, BIOS),
    posts: 40 + Math.floor(r() * 3000),
    followers: Math.floor(r() * 900) + (r() < 0.1 ? 12000 : 0),
  };
}

function newHandle(r) {
  return `${rpick(r, FIRST)}${rpick(r, ['_', '.', ''])}${rpick(r, LAST)}`;
}

/** Comments for a post: seeded for the neighbours' posts, rolled once for Mo's. */
export function commentsFor(seed, n = 3, temperBias = null) {
  const r = rng(typeof seed === 'number' ? seed : hashStr(seed));
  const out = [];
  for (let i = 0; i < n; i++) {
    const p = stranger(newHandle(r));
    const temper = temperBias && r() < 0.5 ? temperBias : p.temper;
    out.push({ handle: p.handle, text: rpick(r, COMMENTS[temper] || COMMENTS.nice) });
  }
  return out;
}

/** Fresh comments for one of Mo's posts; a lip sync draws the trolls, a selfie the thirsty. */
export function rollMoComments(kind) {
  const n = 2 + Math.floor(Math.random() * 4);
  return commentsFor(Math.floor(Math.random() * 1e9), n, kind === 'video' ? 'troll' : kind === 'selfie' ? 'thirsty' : null);
}

/** What the stranger says back, by temper and round. */
const COMEBACKS = {
  troll: ['cope', 'not reading all that', 'ok and? we are all laughing at you in the group chat', 'imagine being this pressed on feedlove', 'blocked (not really i want to watch)'],
  nice: ['whoa ok sorry i was being nice??', 'wow. i literally said i was proud of you', 'ok you need a nap and a sandwich', 'praying for you (genuinely)'],
  thirsty: ['so is that a no on the date', 'feisty. i like that', 'ok but are you still single', 'i screenshotted this for my sister'],
  preachy: ['this is your scarcity mindset talking', 'read a book. specifically my ebook ($9.99)', 'champions do not argue in comments (posts four more comments)', 'you are proving my point'],
  grifter: ['ok but are you interested in the opportunity', 'that is what the haters said before i made $4,000', 'ill put you down for the starter pack'],
  auntie: ['dont you speak to me like that I knew your mother', 'I am telling your mother', 'this is why you are single', 'eat something and call me'],
};

/** The lines Mo can fire back with in an argument, each with a feel and a cost. */
export const RETORTS = [
  { id: 'facts', label: 'Correct them with a fact.', stress: 4, morale: 1, line: 'Mo types a long, correct paragraph with a source. Nobody has ever read a source.' },
  { id: 'caps', label: 'ALL CAPS.', stress: 7, morale: -1, line: 'Mo hits caps lock and becomes, briefly, his uncle.' },
  { id: 'gif', label: 'Post a dancing baby GIF.', stress: -3, morale: 2, line: 'The dancing baby loads in eleven seconds. It is the best thing Mo has done all week.' },
  { id: 'mom', label: '"Does your mother know you talk like this?"', stress: 2, morale: 2, line: 'Mo goes for the mother. The thread holds its breath.' },
  { id: 'agree', label: '"You know what? Fair."', stress: -5, morale: 0, line: 'Mo agrees. It is disorienting for everyone.' },
  { id: 'spell', label: 'Correct their spelling.', stress: 3, morale: 3, line: 'Mo corrects "your" to "you\'re" with the calm of a surgeon.' },
];

/**
 * Start an argument with a stranger. Returns a state the phone walks through: three rounds, a
 * comeback after each retort, and a verdict at the end.
 */
export function startArgument(handle) {
  return { handle, round: 0, log: [], stress: 0, morale: 0, done: false };
}

/** Mo fires a retort; the stranger answers. After the third round it is over. */
export function retort(g, arg, retortId) {
  if (!arg || arg.done) return arg;
  const t = RETORTS.find((x) => x.id === retortId) || RETORTS[0];
  const p = stranger(arg.handle);
  arg.log.push({ who: 'mo', text: t.label });
  arg.log.push({ who: 'them', text: pick(COMEBACKS[p.temper] || COMEBACKS.troll) });
  arg.stress += t.stress;
  arg.morale += t.morale;
  arg.round += 1;
  g.advance(6);
  if (arg.round >= 3) {
    arg.done = true;
    // the verdict: random, mostly, like the internet
    const won = Math.random() < (t.id === 'gif' || t.id === 'agree' ? 0.6 : 0.35);
    arg.verdict = won
      ? pick([`@${arg.handle} deleted their comment. Mo wins, which feels like nothing, which is the prize.`, `Three strangers liked Mo's reply. @${arg.handle} has gone quiet. Victory tastes like a cold radiator.`])
      : pick([`@${arg.handle} posted a screenshot of the whole thing to their 900 followers. Mo is content now.`, `Forty minutes later neither of them has changed their mind and both of them have changed their mood.`, `@${arg.handle} replied "k". There is no answer to "k".`]);
    bump(g.state, 'stress', arg.stress + (won ? -4 : 5));
    bump(g.state, 'morale', arg.morale + (won ? 4 : -4));
    logLine(g, `Argued with @${arg.handle} on FeedLove. ${won ? 'Won, sort of.' : 'Lost, sort of.'}`, won ? 'good' : 'bad');
  }
  return arg;
}
