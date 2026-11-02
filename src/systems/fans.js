/**
 * LonelyFans — the app nobody admits to having.
 *
 * A parody of the subscription sites, and a joke about what people buy at two in the morning.
 * Nothing here is explicit: the pictures are described, never shown, and the models are a
 * fictional cast with handles, prices and a sales pitch.
 *
 * The rules, so the joke has teeth:
 *   - The app is locked until Mo pays for it. $2 a day, charged at the day rollover, and it can
 *     be left on Shale Pay AutoPay so it renews itself while he is thinking about something else.
 *   - A picture lowers stress and lowers morale. That trade is the whole point of the app.
 *   - If his morale is already on the floor, the app refuses to sell him anything and says so
 *     out loud: "have some dignity man, hit the pipe or something instead!"
 *   - Some models offer more than pictures, for a sum with three digits in it. Still nothing
 *     explicit: a door, a night, a fade to black, and a lighter wallet.
 *
 * Headless; state in `state.fans`, created lazily.
 */
import { CONFIG } from '../core/config.js';
import { dayOf, money, pick, clamp } from '../core/util.js';
import { bump, logLine, pushMessage, spend } from '../core/state.js';

const F = () => CONFIG.fans;

/** The cast. Handles, prices, and one line of why anybody pays. */
export const MODELS = [
  {
    id: 'velvet', name: 'Velvet Kade', handle: '@velvetkade', tag: 'late shifts · longer nails',
    price: 12, cheeks: false,
    pitch: '"you look like you had a day. i have a whole folder of days."',
    selfies: [
      'A mirror, a phone over her face, the bathroom light of an apartment nicer than his.',
      'Her feet up on a windowsill, city out of focus behind them, one sock on.',
      'A photo of her hand on a bedsheet and nothing else in frame, and it is somehow the most.',
    ],
  },
  {
    id: 'cherry', name: 'Cherry Delacroix', handle: '@cherrydelacroix', tag: 'no face, all attitude',
    price: 18, cheeks: true,
    pitch: '"i do not do dinner. i do not do texts. i do this."',
    selfies: [
      'A red light, a shoulder, a chipped nail against a lip. She knows exactly what she is doing.',
      'A dressing screen, one leg out, a heel hanging off two toes.',
      'The camera pointed at the ceiling, and her laughing off frame. It is worse than a picture.',
    ],
  },
  {
    id: 'mona', name: 'Mona Reyes', handle: '@monareyes', tag: 'your ex, but nice about it',
    price: 9, cheeks: false,
    pitch: '"you seem normal. that is rare on here. do not ruin it."',
    selfies: [
      'A hoodie that used to belong to somebody, sleeves over her hands, one eye in frame.',
      'Coffee, an unmade bed, a smirk that has been on this app before.',
      'A Polaroid of a Polaroid. The second one is worse quality and it works better.',
    ],
  },
  {
    id: 'jade', name: 'Jade Okafor', handle: '@jadeokafor', tag: 'gym at 5 · unbothered by 6',
    price: 22, cheeks: true,
    pitch: '"i am not your girlfriend. i am a subscription."',
    selfies: [
      'A gym mirror, a towel, an expression that says she has already forgotten his name.',
      'A shower door fogged to exactly the wrong amount of fog.',
      'A hotel room, two glasses, one of them used, and a caption that is only a time of night.',
    ],
  },
];

export const modelById = (id) => MODELS.find((m) => m.id === id) || null;

/** What she types under the picture, by pose. */
const CAPTIONS = {
  selfie: ['for u. dont show ur friends. u dont have friends, thats why i like u', 'new phone who dis (its me. the phone is new)', 'took 40 of these. this is the one. the other 39 are for someone richer'],
  hips: ['rate me 1-10 and if u say anything under 11 i keep the money', 'this is my "landlord is at the door" pose', 'standing like this burns 3 calories. u owe me 3 calories'],
  peace: ['peace and love and $12', 'peace sign bc i am at peace with ur credit card', 'v for very expensive'],
  behind: ['hands behind my head bc i have nothing to hide (except everything, see mosaic)', 'stretching. it is a whole lifestyle', 'my arms are tired from counting ur money'],
  cat: ['mr. buttons says hi. mr. buttons is the only one who gets to see everything', 'meet my manager', 'the cat is censoring me. the cat is a prude. take it up with the cat'],
  kiss: ['mwah. that will be $12', 'blowing u a kiss. it is non refundable', 'this kiss has been to 4 other phones tonight but it meant it with u'],
};

export function fansState(s) {
  if (!s.fans) s.fans = {};
  const f = s.fans;
  f.subscribed = !!f.subscribed;
  f.sinceDay = Number(f.sinceDay) || 0;
  f.paidDay = Number(f.paidDay) || 0;
  f.autopay = !!f.autopay;
  f.lapsedDay = Number(f.lapsedDay) || 0;
  f.spent = Math.round((Number(f.spent) || 0) * 100) / 100;
  f.models = f.models && typeof f.models === 'object' ? f.models : {};
  for (const m of MODELS) {
    const r = f.models[m.id] = f.models[m.id] || {};
    r.bought = Number(r.bought) || 0;
    r.spent = Math.round((Number(r.spent) || 0) * 100) / 100;
    r.lastDay = Number(r.lastDay) || 0;
    r.lastCheeksDay = Number(r.lastCheeksDay) || 0;
    r.cheeks = Number(r.cheeks) || 0;
  }
  f.count = Number(f.count) || 0;
  return f;
}

export const isSubscribed = (s) => fansState(s).subscribed;

/** The app is on the home screen but the door is locked until it is paid for. */
export function subscribe(g) {
  const s = g.state;
  const f = fansState(s);
  const cost = F().daily;
  if (f.subscribed) return { ok: false, reason: 'already' };
  if (s.money < cost) { g.toast(`LonelyFans: ${money(cost)} today, ${money(s.money)} in the account. The app is very polite about it.`, 'bad'); return { ok: false, reason: 'short' }; }
  spend(g, cost, 'LonelyFans subscription');
  f.subscribed = true;
  f.sinceDay = dayOf(s.clock.m);
  f.paidDay = dayOf(s.clock.m);
  f.spent = Math.round((f.spent + cost) * 100) / 100;
  logLine(g, 'Subscribed to LonelyFans. $2 a day. The card is on file.', 'info');
  g.toast(`LonelyFans: ${F().subscribeLine} $${cost.toFixed(2)} today, and every day.`, 'info');
  pushMessage(g, {
    from: 'LONELYFANS',
    subject: 'Welcome, Mo',
    body: `Your subscription is active at ${money(cost)} a day.\n\nTip: the models can tell when you are sad. That is not a feature, it is just true.\n\nYou can leave AutoPay on in Shale Pay and never think about this again, which is the business model.`,
    kind: 'fans',
  });
  return { ok: true, cost };
}

export function unsubscribe(g, { silent = false } = {}) {
  const s = g.state;
  const f = fansState(s);
  if (!f.subscribed) return { ok: false, reason: 'not subscribed' };
  f.subscribed = false;
  f.lapsedDay = dayOf(s.clock.m);
  logLine(g, 'Cancelled LonelyFans.', 'info');
  if (!silent) g.toast('Subscription cancelled. The models will pretend not to notice.', 'info');
  return { ok: true };
}

/**
 * The daily $2. Runs at the day rollover: charged if the app is on AutoPay or he kept it going;
 * otherwise the subscription lapses with a text that sounds like every subscription ever.
 */
export function onNewDay(g, day) {
  const s = g.state;
  const f = fansState(s);
  if (!f.subscribed) return { charged: false };
  const cost = F().daily;
  if (s.money >= cost) {
    spend(g, cost, 'LonelyFans subscription');
    f.paidDay = day;
    f.spent = Math.round((f.spent + cost) * 100) / 100;
    return { charged: true, cost };
  }
  f.subscribed = false;
  f.lapsedDay = day;
  pushMessage(g, {
    from: 'LONELYFANS',
    subject: 'Payment failed',
    body: `We could not charge ${money(cost)} today.\n\nYour subscription is paused. The models have been told you are "going through something". They send their thoughts.`,
    kind: 'fans',
  });
  logLine(g, 'LonelyFans lapsed: no money for the subscription.', 'bad');
  return { charged: false, lapsed: true };
}

/** The dignity gate: the app will not sell to a man this far down. */
export const blocksForDignity = (s) => s.stats.morale < F().dignityMorale;

/**
 * Buy a picture. Lowers stress, lowers morale, and refuses at the bottom of the barrel.
 */
export function buySelfie(g, modelId) {
  const s = g.state;
  const f = fansState(s);
  const m = modelById(modelId);
  if (!m) return { ok: false, reason: 'nobody' };
  if (!f.subscribed) { g.toast('LonelyFans: subscribe first. The door is the door.', 'info'); return { ok: false, reason: 'locked' }; }
  if (blocksForDignity(s)) {
    g.openModal({
      kicker: 'LONELYFANS', title: 'Not Tonight',
      body: `You have ${Math.round(s.stats.morale)} morale and ${money(s.money)} in the account, and you are looking at a woman you will never meet.\n\nSomewhere in the back of your head, in your own voice: "${F().dignityLine}"`,
      choices: [{ label: 'Close the app.', effect: () => {} }],
    });
    return { ok: false, reason: 'dignity' };
  }
  if (s.money < m.price) { g.toast(`LonelyFans: $${m.price.toFixed(2)} and you have ${money(s.money)}. She is not running a sale.`, 'bad'); return { ok: false, reason: 'short' }; }
  spend(g, m.price, `LonelyFans — ${m.name}`);
  const r = f.models[m.id];
  r.bought += 1;
  r.spent = Math.round((r.spent + m.price) * 100) / 100;
  r.lastDay = dayOf(s.clock.m);
  f.spent = Math.round((f.spent + m.price) * 100) / 100;
  f.count += 1;
  const S = F().selfie;
  bump(s, 'stress', S.stress);
  bump(s, 'morale', S.morale);
  g.advance(S.minutes);
  logLine(g, `Bought a picture from ${m.handle} (${money(m.price)}). Stress down, morale down.`, 'info');
  // she sends it as a text: the picture is in the thread, to open again whenever he likes
  const POSES = m.id === 'cherry' ? ['selfie', 'hips', 'kiss', 'behind', 'peace'] : ['selfie', 'hips', 'peace', 'behind', 'cat', 'kiss'];
  const pose = POSES[(r.bought + Math.floor(Math.random() * POSES.length)) % POSES.length];
  pushMessage(g, { from: m.name, subject: 'pic', body: pick(m.captions?.[pose] ? [m.captions[pose]] : CAPTIONS[pose]), pic: { model: m.id, pose, seed: Math.floor(Math.random() * 1e9) } });
  return { ok: true, price: m.price, stress: S.stress, morale: S.morale, texted: m.name };
}

/** Would she? Some of them, some nights, for a number with three digits in it. */
export function cheeksOffer(s, modelId) {
  const f = fansState(s);
  const m = modelById(modelId);
  if (!m || !m.cheeks || !f.subscribed) return null;
  const K = F().cheeks;
  const r = f.models[m.id];
  if (r.lastCheeksDay && dayOf(s.clock.m) - r.lastCheeksDay < K.cooldownDays) return null;
  return { price: K.price, affordable: s.money >= K.price };
}

export function buyCheeks(g, modelId) {
  const s = g.state;
  const m = modelById(modelId);
  const off = cheeksOffer(s, modelId);
  if (!m || !off) { g.toast('She is not offering that tonight.', 'info'); return { ok: false, reason: 'no offer' }; }
  if (!off.affordable) { g.toast(`${m.name} wants ${money(off.price)}. You have ${money(s.money)}. She is not embarrassed for you, which is worse.`, 'bad'); return { ok: false, reason: 'short' }; }
  spend(g, off.price, `LonelyFans — ${m.name}, in person`);
  const f = fansState(s);
  const r = f.models[m.id];
  r.lastCheeksDay = dayOf(s.clock.m);
  r.cheeks += 1;
  r.spent = Math.round((r.spent + off.price) * 100) / 100;
  f.spent = Math.round((f.spent + off.price) * 100) / 100;
  const K = F().cheeks;
  bump(s, 'stress', K.stress);
  bump(s, 'morale', K.morale);
  bump(s, 'energy', K.energy);
  g.advance(K.minutes);
  g.fadeIn?.();
  logLine(g, `Paid ${m.name} ${money(off.price)}. It was a transaction, and it felt like one.`, 'bad');
  g.openModal({
    kicker: `LONELYFANS · ${m.handle}`,
    title: 'The Door Closed',
    body: `A hotel on Ashby with a buzzer that does not work. She is taller in person and less interested in person. The door closes.\n\nLater, the walk home, the money gone, and the specific silence of having paid for company and received exactly that.\n\n$${off.price.toFixed(2)}. Nothing explicit happened, and nothing has to.`,
    choices: [{ label: 'Walk home.', effect: () => {} }],
  });
  return { ok: true, price: off.price };
}

/** For the phone: what she has sent, and what it cost him all together. */
export const spentTotal = (s) => fansState(s).spent;
export const summary = (s) => {
  const f = fansState(s);
  return {
    subscribed: f.subscribed,
    daily: F().daily,
    autopay: f.autopay && !!s.autopay?.on,
    spent: f.spent,
    bought: f.count,
    cheapest: MODELS.reduce((a, m) => Math.min(a, m.price), Infinity),
  };
};

export const clampMood = (v) => clamp(v, 0, 100);
