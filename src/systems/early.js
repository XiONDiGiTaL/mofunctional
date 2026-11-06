/**
 * The first week's breadcrumbs: one text a morning from someone who already lives in the game,
 * each pointing at a system a new player would otherwise find late or never (the bus and the
 * train out to Ashby Ave, the clinic's slow course, the Fellowship on Sunday, FeedLove, BidBay,
 * and the men on the block who move ROX). Each fires once, and not at all if Mo has already
 * found the thing on his own.
 */
import { pushMessage } from '../core/state.js';

const HOOKS = [
  {
    key: 'ashby', day: 2, from: 'KEV', subject: 'get off the block',
    skip: (s) => s.flags.seen?.avenue || s.flags.seen?.subway,
    body: 'You been on Kestrel since you got here bro. The B44 stops right outside the bodega, a buck fifty to Ashby Ave. Or the K train under the street if you got patience. Different faces, different money. Just saying.',
  },
  {
    key: 'clinic', day: 2, from: 'KESTREL CLINIC', subject: 'We are around the corner',
    skip: (s) => (s.clinic?.visits || 0) > 0,
    body: 'Kestrel Clinic, on Kestrel Street. Walk-ins welcome. If something has a hold on you, we run an outpatient course: a few appointments, days apart, and the craving loosens a little each time. It is not free and it is not fast. It works.\n\nNurse Okafor',
  },
  {
    key: 'fellowship', day: 3, from: 'ADDISON OCTAVIUS', subject: 'A seat for you',
    skip: (s) => (s.fellowship?.stage || 0) > 0 || (s.fellowship?.visits || 0) > 0,
    body: 'We have never met, and yet here I am thinking of you. The Golden Fellowship gathers Sundays at 11:00. There is coffee, there is music, and there is a community that looks after its own. Come as you are.\n\nSalt & gold,\nAddison',
  },
  {
    key: 'feedlove', day: 4, from: 'FEEDLOVE', subject: 'Someone looked at you today',
    skip: (s) => (s.dating?.swipes || 0) > 0,
    body: 'Your FeedLove profile had 3 views this week. Open FeedLove on your phone, swipe, and spend a HEART on the ones you mean. Real people, real Brooklyn, real disappointment (optional).',
  },
  {
    key: 'bidbay', day: 5, from: 'BIDBAY', subject: 'Turn your stuff into rent',
    skip: (s) => (s.listings?.length || 0) > 0,
    body: 'That thing in your closet is somebody\'s treasure. List it on BidBay from your phone, set a starting price, and let Brooklyn fight over it.\n\nBidBay never asks where it came from. BidBay is not a bank.',
  },
  {
    key: 'rox', day: 6, from: 'DEX', subject: 'a word',
    skip: (s) => s.counters?.roxCooked || s.supply?.dealers && Object.values(s.supply.dealers).some((d) => d.on),
    body: 'heard you know your way round a kitchen. if you ever got product, me and the two at the Houses, Benchy and Squeak, we move it. you front, we sell, you get a cut every morning. no pressure. just know the door is there.',
  },
];

/** Once a morning: the first hook that is due, has not fired, and still has a point. */
export function earlyNewDay(g, d) {
  const s = g.state;
  if (d > 8) return;
  s.flags.early = s.flags.early || {};
  for (const h of HOOKS) {
    if (s.flags.early[h.key] || d < h.day) continue;
    s.flags.early[h.key] = d;
    if (h.skip(s)) continue;
    pushMessage(g, { from: h.from, subject: h.subject, body: h.body });
    return;
  }
}
