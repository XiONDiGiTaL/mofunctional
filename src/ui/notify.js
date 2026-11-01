/**
 * Notifications, grouped by what they ask of Mo:
 *
 *   urgent   rent, bills, the clinic, the police, the job: something with a consequence
 *   social   people: family, friends, the women, the dealers
 *   info     everything that is a service talking: listings, receipts, feeds, apps
 *
 * The phone's home screen shows the three groups with unread counts and the newest line of each,
 * each linking to its thread; the HUD only pops up the kinds the player asked for (Tweaks).
 */
import * as sms from '../systems/sms.js';

const URGENT = new Set(['landlord', 'bill', 'clinic', 'employer']);
const SOCIAL = new Set(['personal', 'romantic', 'family', 'dealer']);

/** 'urgent' | 'social' | 'info' for a message. */
export function groupOf(m) {
  const cat = sms.identityFor(m.from).category;
  if (URGENT.has(cat) || /overdue|past due|insufficient|eviction|notice|shift|police|booked/i.test(`${m.subject} ${m.body}`)) return 'urgent';
  if (SOCIAL.has(cat)) return 'social';
  return 'info';
}

/** { urgent: { unread, latest }, social: {...}, info: {...} } over the inbox. */
export function groups(s) {
  const out = { urgent: { unread: 0, latest: null }, social: { unread: 0, latest: null }, info: { unread: 0, latest: null } };
  for (const m of s.messages) { // newest first
    const g = out[groupOf(m)];
    if (!m.read) g.unread += 1;
    if (!g.latest && !m.read) g.latest = m;
  }
  return out;
}

/** Should this text pop up over the game, under the player's setting? */
export function shouldPop(s, m) {
  const mode = s.settings?.textPopups || 'important';
  if (mode === 'off') return false;
  if (mode === 'all') return true;
  return groupOf(m) !== 'info';
}
