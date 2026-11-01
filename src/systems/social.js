/**
 * FeedLove, the social side: who Mo follows, who follows him, and a timeline of everybody else's
 * lives going on without him.
 *
 * Accounts are the people he knows (Mom, Nia, Kev, Dale, Rae, Miguel, Habib, the Fellowship),
 * the block itself (the Quik-Stop, the bodega cat, the park), and — once he has met them —
 * Stephanie, Melanie and Diana. Each account posts on its own rhythm; a day's posts are seeded,
 * so the timeline is the same every time the app opens, and a post only appears once its time
 * has passed. Some posts carry a picture (ui/feedart.js draws them; `img` names the scene).
 *
 * Likes go both ways. Liking her post is worth a little affection once a day; when Mo posts,
 * the people who follow him may like it back, and her like is worth a little morale.
 *
 * Headless; state lives in `state.social` (followers count already existed), created lazily.
 */
import { CONFIG } from '../core/config.js';
import { dayOf, minuteOfDay, clamp } from '../core/util.js';
import { bump, logLine } from '../core/state.js';
import * as romance from './romance.js';

/* ------------------------------------------------------------------ accounts */

// kind: whose face is the avatar (render/faces kinds), or null for a brand/initial avatar
export const ACCOUNTS = {
  mom: {
    handle: 'momof2_blessed', name: 'Mom', kind: null, initial: 'M', color: '#c8a06a', rate: 0.9, hours: [6, 21], likesMo: 0.92,
    lines: ['Good morning to everyone except the man who took my parking spot', 'Made pernil. Nobody came. More for me', 'Praying for all my children (especially one)', 'Does anyone know how to make the letters bigger', 'Your cousin Danny got promoted. Just saying', 'Happy Tuesday!!! 🌻', 'Call your mother. This is a public reminder', 'The pastor said something today and I thought of you Mo'],
    imgs: ['food', 'flowers', null, null],
  },
  nia: {
    handle: 'nia.not.nina', name: 'Nia', kind: 'nia', rate: 0.7, hours: [9, 24], likesMo: 0.5,
    lines: ['mom asked me to ask mo to call her. mo call mom', 'night shift again. the vending machine knows my name', 'my brother is doing fine (source: i have not checked)', 'just found a $20 in my winter coat. best day of the year', 'nobody tell mom i dyed it', 'people who walk slow on the sidewalk are a hate crime'],
    imgs: ['selfie', 'coffee', 'skyline', null],
  },
  kev: {
    handle: 'kevlar_kev', name: 'Kev', kind: 'kev', rate: 0.85, hours: [7, 24], likesMo: 0.45,
    lines: ['dale said "no phones on the floor" so i am posting from the walk-in', 'RAISE THE ROOF (the roof at the quik-stop is leaking)', 'beat my own chess record. i was also my opponent', 'tall boy on the bench. this is the life they dont want you to have', 'who keeps buying all the cherry slushies. i will find you', 'lunch at the bus stop. the bus didnt come. the lunch did'],
    imgs: ['beer', 'store', 'selfie', null],
  },
  dale: {
    handle: 'dale_qs14_mgr', name: 'Dale', kind: 'dale', rate: 0.5, hours: [5, 21], likesMo: 0.15,
    lines: ['Reminder: the schedule is posted. It is posted for a reason.', 'Inventory day. If you are reading this and you work for me, come in.', 'Store #14 had zero incidents this week. Knock on wood (the wood is laminate)', 'Saw a hawk on the light pole. Majestic. Called corporate anyway.'],
    imgs: ['store', null],
  },
  rae: {
    handle: 'rae_vell_properties', name: 'Rae Vell', kind: 'rae', rate: 0.45, hours: [8, 22], likesMo: 0.2,
    lines: ['Rent is due on the 1st. It is also due on the 1st if you post about it.', 'The boiler at 1120 is being looked at. By me. I am looking at it.', 'Unit available soon. Quiet tenants only. You know who you are.', 'Contractors are just men who say "next week" for money'],
    imgs: ['building', null],
  },
  miguel: {
    handle: 'kestrel_bodega', name: "Miguel's Bodega", kind: 'miguel', rate: 0.8, hours: [6, 23], likesMo: 0.3,
    lines: ['BEC special all morning. The cat is not for sale', 'Fresh rolls. Fresh coffee. Same Miguel.', 'Cat update: he caught something. We are not discussing it', 'Lotto is up to 14 million. I am not quitting. I like it here', 'If you owe me money you know who you are. I know who you are'],
    imgs: ['cat', 'food', 'cat', null],
  },
  habib: {
    handle: 'habibs_corner_halal', name: "Habib's Corner", kind: 'habib', rate: 0.6, hours: [11, 24], likesMo: 0.3,
    lines: ['Chicken over rice. Extra white sauce. You are welcome', 'Open late. You are hungry. I am here. This is how it works', 'A man told me my rice changed his life. Free soda for him forever', 'Eat something. I am serious. Eat.'],
    imgs: ['food', 'food', null],
  },
  fellowship: {
    handle: 'goldenfellowship_official', name: 'The Golden Fellowship', kind: 'addison', rate: 0.7, hours: [7, 22], likesMo: 0.6,
    lines: ['Service Sunday 11:00. Coffee. Community. Commitment. 🙏✨', 'Pastor Addison: "Your bad habits are just good habits in the wrong hands." Tithe online.', 'Another soul brought home this week. Ask us how. (Ask us how.)', 'Gold is not a color. It is a promise.', 'New members get a free tote bag and a new life. Terms apply.'],
    imgs: ['church', 'church', null],
  },
  quikstop: {
    handle: 'quikstop14_kestrel', name: 'Quik-Stop #14', kind: null, initial: 'Q', color: '#e04a3a', rate: 0.6, hours: [0, 24], likesMo: 0.05,
    lines: ['2 for $3 tall boys. Corporate says to add: responsibly.', 'Coffee is $1.25. It has always been $1.25. Do not ask about the cream.', 'We are hiring. We are always hiring.', 'Slushie machine is back. It never left. It was just tired.'],
    imgs: ['store', 'coffee', null],
  },
  parks: {
    handle: 'kestrel_park_friends', name: 'Friends of Kestrel Park', kind: null, initial: 'K', color: '#4aa86a', rate: 0.4, hours: [8, 19], likesMo: 0.1,
    lines: ['Volunteer cleanup Saturday 9 AM. Bring gloves. Leave the needles to us.', 'The rim on the half-court has been reported to the city. Again.', 'Somebody planted tulips by the gate. We love you, mystery gardener', 'Please stop feeding the pigeons bagels. They are getting confident.'],
    imgs: ['park', 'park', null],
  },
  // the three, once met: their own days, in their own voices
  stephanie: {
    handle: 'steph.on.a.bench', name: 'Stephanie', kind: 'stephanie', partner: true, rate: 0.75, hours: [11, 25], likesMo: 0.7,
    lines: ['bench status: occupied (me)', 'reading magazines at the quik-stop i am never going to buy. a lifestyle', 'it is 1am and i am thinking about pizza in a serious way', 'no plans today. no plans tomorrow. booked solid with nothing', 'the stoop at 1120 has the best people-watching in brooklyn. fight me'],
    gfLines: ['someone made me laugh so hard i snorted. he will not be named', 'my guy brought me a slushie at 1am. that is love actually'],
    imgs: ['selfie', 'night', 'park', null],
  },
  melanie: {
    handle: 'ms_melanie_teaches', name: 'Melanie', kind: 'melanie', partner: true, rate: 0.8, hours: [7, 21], likesMo: 0.75,
    lines: ['grading 34 essays on the bench. 33 of them are about video games', 'chicken over rice at habibs. extra white sauce. self care', 'a student called me "mom" today and then wanted to die. same', 'it is 4pm and the park is golden and i am not grading for ten minutes', 'buttered roll and a coffee before first period. the bodega cat judged me'],
    gfLines: ['he showed up on time. i am noting it publicly so there is a record', 'park date. he lost at chess to a 9 year old. i have never been happier'],
    imgs: ['papers', 'food', 'park', 'selfie', null],
  },
  diana: {
    handle: 'diana.consistent', name: 'Diana', kind: 'diana', partner: true, rate: 0.7, hours: [6, 20], likesMo: 0.6,
    lines: ['5 miles before 7. you were asleep. i know you were', 'coffee, black, standing up. i do not have time to sit and neither do you', 'park slope office has a new printer. it is my nemesis now', 'consistency is attractive. say it with me', 'bus home. book. quiet. perfect'],
    gfLines: ['he made a plan. an actual plan with a time on it. i am impressed and annoyed', 'i do not post about men. this is not a post about a man. (it is)'],
    imgs: ['shoes', 'coffee', 'skyline', 'selfie', null],
  },
};

export const DEFAULT_FOLLOWING = ['mom', 'nia', 'kev', 'dale', 'rae', 'miguel'];
// the people who follow Mo back by default (everyone else is bots, and the count says so)
const DEFAULT_FOLLOWERS = ['mom', 'nia', 'kev', 'miguel', 'fellowship'];

export function socialState(s) {
  if (!s.social) s.social = { followers: 3 };
  const so = s.social;
  so.followers = Number(so.followers) || 0;
  if (!Array.isArray(so.following)) so.following = DEFAULT_FOLLOWING.slice();
  so.liked = so.liked && typeof so.liked === 'object' ? so.liked : {};
  so.likeDay = so.likeDay && typeof so.likeDay === 'object' ? so.likeDay : {};
  return so;
}

/** Can Mo see / follow this account yet? The three only after he has met them. */
export function accountVisible(s, id) {
  const a = ACCOUNTS[id];
  if (!a) return false;
  if (a.partner) return romance.partnerState(s, id).met;
  return true;
}

export const isFollowing = (s, id) => socialState(s).following.includes(id);

/** Does this account follow Mo? Family and friends do; she does once she likes him enough. */
export function followsMo(s, id) {
  const a = ACCOUNTS[id];
  if (!a) return false;
  if (a.partner) {
    const st = romance.partnerState(s, id);
    return st.met && isFollowing(s, id) && (st.girlfriend || st.affection >= CONFIG.social.followBackAffection);
  }
  return DEFAULT_FOLLOWERS.includes(id);
}

export function follow(g, id, on = true) {
  const so = socialState(g.state);
  if (!accountVisible(g.state, id)) return false;
  const has = so.following.includes(id);
  if (on && !has) so.following.push(id);
  if (!on && has) so.following = so.following.filter((x) => x !== id);
  if (on && ACCOUNTS[id].partner && followsMo(g.state, id)) {
    g.toast(`${ACCOUNTS[id].name} followed you back.`, 'good');
  }
  return true;
}

/** The named people following Mo, and how many of the rest are bots. */
export function followerList(s) {
  const so = socialState(s);
  const named = Object.keys(ACCOUNTS).filter((id) => accountVisible(s, id) && followsMo(s, id));
  return { named, others: Math.max(0, so.followers - named.length) };
}

/* ------------------------------------------------------------------ timeline */

function rng(seed) {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
const hashStr = (str) => { let h = 2166136261; for (const c of str) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };

/** One account's posts on one day (seeded). */
function postsFor(s, id, day) {
  const a = ACCOUNTS[id];
  const r = rng(hashStr(id) ^ (day * 2654435761));
  const out = [];
  const n = (r() < a.rate ? 1 : 0) + (r() < a.rate * 0.35 ? 1 : 0);
  const gf = a.partner && romance.isGirlfriend(s, id);
  for (let i = 0; i < n; i++) {
    const [h0, h1] = a.hours;
    const minute = Math.floor((h0 + r() * (h1 - h0)) * 60) % 1440;
    const pool = gf && a.gfLines && r() < 0.5 ? a.gfLines : a.lines;
    const text = pool[Math.floor(r() * pool.length)];
    const img = a.imgs[Math.floor(r() * a.imgs.length)];
    out.push({ id: `${id}-${day}-${i}`, author: id, day, minute, text, img, seed: Math.floor(r() * 1e9), likes: 2 + Math.floor(r() * (a.partner ? 40 : 25)) });
  }
  return out;
}

/** The timeline: everything posted by accounts Mo follows over the last few days, newest first. */
export function timeline(s, days = CONFIG.social.timelineDays) {
  const today = dayOf(s.clock.m);
  const now = minuteOfDay(s.clock.m);
  const so = socialState(s);
  const out = [];
  for (const id of so.following) {
    if (!accountVisible(s, id)) continue;
    // days before day 1 count too: everybody had a life before the game started
    for (let d = today - days + 1; d <= today; d++) {
      for (const p of postsFor(s, id, d)) {
        if (d === today && p.minute > now) continue;
        out.push(p);
      }
    }
  }
  return out.sort((a, b) => (b.day * 1440 + b.minute) - (a.day * 1440 + a.minute));
}

/** Like (or unlike) a post. Her post, the first like of the day: a little affection. */
export function likePost(g, post) {
  const s = g.state;
  const so = socialState(s);
  if (so.liked[post.id]) { delete so.liked[post.id]; return { liked: false }; }
  so.liked[post.id] = true;
  const a = ACCOUNTS[post.author];
  const day = dayOf(s.clock.m);
  if (a?.partner && so.likeDay[post.author] !== day) {
    so.likeDay[post.author] = day;
    const st = romance.partnerState(s, post.author);
    st.affection = clamp(st.affection + CONFIG.social.likeAffection, 0, 100);
  }
  return { liked: true };
}

/**
 * Who likes Mo's new post: the people who follow him, each on their own odds. Returns the list
 * of account ids; her like is worth a little morale and a toast.
 */
export function likesForMoPost(g) {
  const s = g.state;
  const out = [];
  for (const id of Object.keys(ACCOUNTS)) {
    if (!accountVisible(s, id) || !followsMo(s, id)) continue;
    const a = ACCOUNTS[id];
    let odds = a.likesMo;
    if (a.partner) odds = romance.isGirlfriend(s, id) ? 0.95 : odds * (romance.partnerState(s, id).affection / 100 + 0.3);
    if (Math.random() < odds) out.push(id);
  }
  for (const id of out) {
    if (!ACCOUNTS[id].partner) continue;
    bump(s, 'morale', CONFIG.social.partnerLikeMorale);
    g.toast(`${ACCOUNTS[id].name} liked your post.`, 'good');
    logLine(g, `${ACCOUNTS[id].name} liked your post on FeedLove.`, 'good');
  }
  return out;
}
