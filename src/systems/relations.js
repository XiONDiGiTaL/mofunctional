/**
 * Relationship context: what changed between Mo and the people in his life lately, and what is
 * waiting on him. Each morning takes a snapshot of what the player can already see (affection,
 * status) plus a coarse sense of the trust counters; the LoveLine tab compares now against a few
 * days ago and words it. Trust numbers stay hidden: only "warmer" or "cooler" comes out.
 *
 * `state.relSnaps` holds [{ day, partners: { id: { affection, girlfriend, liveIn, heartbroken } }, npc }].
 */
import { CONFIG } from '../core/config.js';
import { dayOf } from '../core/util.js';
import * as romance from './romance.js';
import * as dating from './dating.js';

const KEEP = 4;
const NPC_NAMES = { habib: 'Habib', rae: 'Rae', miguel: 'Miguel', addison: 'Addison', homeless: 'the man under the stairs' };

function snapshot(s) {
  const partners = {};
  for (const id of romance.PARTNER_KEYS) {
    const p = romance.partnerState(s, id);
    partners[id] = { affection: p.affection, girlfriend: p.girlfriend, liveIn: p.liveIn, heartbroken: p.heartbroken, met: p.met };
  }
  return { partners, npc: { ...(s.npc || {}) } };
}

/** Called at the turn of each day, before the day's decay runs. */
export function relationsNewDay(s, day) {
  s.relSnaps = (s.relSnaps || []).filter((x) => x.day < day);
  s.relSnaps.push({ day, ...snapshot(s) });
  while (s.relSnaps.length > KEEP) s.relSnaps.shift();
}

/** [{ who, text, tone: 'good'|'bad' }] comparing now against the oldest kept snapshot. */
export function recentChanges(s) {
  const base = (s.relSnaps || [])[0];
  if (!base) return [];
  const since = dayOf(s.clock.m) - base.day;
  const when = since <= 0 ? 'since this morning' : since === 1 ? 'since yesterday' : `in the last ${since} days`;
  const now = snapshot(s);
  const out = [];
  for (const id of romance.PARTNER_KEYS) {
    const a = base.partners[id], b = now.partners[id];
    if (!a || !b) continue;
    const name = CONFIG.partners[id].name;
    if (!a.met && b.met) out.push({ who: name, text: 'you met', tone: 'good' });
    if (!a.girlfriend && b.girlfriend) out.push({ who: name, text: 'became your girlfriend', tone: 'good' });
    if (!a.liveIn && b.liveIn) out.push({ who: name, text: 'moved in', tone: 'good' });
    if (a.liveIn && !b.liveIn) out.push({ who: name, text: 'moved out', tone: 'bad' });
    if (!a.heartbroken && b.heartbroken) out.push({ who: name, text: 'heartbroken', tone: 'bad' });
    const d = b.affection - a.affection;
    if (Math.abs(d) >= 3) out.push({ who: name, text: `affection ${d > 0 ? '+' : '−'}${Math.abs(d)} ${when}`, tone: d > 0 ? 'good' : 'bad' });
  }
  for (const id of new Set([...Object.keys(base.npc), ...Object.keys(now.npc)])) {
    const d = (now.npc[id] || 0) - (base.npc[id] || 0);
    if (!d) continue;
    out.push({ who: NPC_NAMES[id] || id, text: `${d > 0 ? 'warmer toward you' : 'cooler toward you'} ${when}`, tone: d > 0 ? 'good' : 'bad' });
  }
  return out;
}

/** [{ who, text, act?, arg? }]: unread texts from people, open asks, a present at home, people going quiet. */
export function waitingOnMo(s, groupOf) {
  const out = [];
  const today = dayOf(s.clock.m);
  const seen = new Set();
  for (const m of s.messages) {
    if (m.read || seen.has(m.from) || groupOf(m) !== 'social') continue;
    seen.add(m.from);
    out.push({ who: m.from, text: `texted: “${String(m.body || m.subject || '').slice(0, 60)}”`, act: 'go', arg: 'messages' });
  }
  for (const id of romance.PARTNER_KEYS) {
    const p = romance.partnerState(s, id);
    const name = CONFIG.partners[id].name;
    if (!p.met || p.blocked) continue;
    if (romance.canAskGirlfriend(s, id)) out.push({ who: name, text: 'would say yes to being your girlfriend' });
    if (p.girlfriend && !p.liveIn && romance.canAskMoveIn(s, id)) out.push({ who: name, text: 'is ready to move in, if you ask' });
    const quiet = today - (p.lastTalkDay || 0);
    if ((p.girlfriend || p.dates) && quiet >= 3) out.push({ who: name, text: `has not heard from you in ${quiet} days` });
  }
  if (romance.pendingGift(s)) out.push({ who: 'Home', text: 'someone left you something at the apartment' });
  for (const w of dating.hookupContacts(s)) {
    if (dating.hookupAvailable(s, w.id).ok) out.push({ who: w.name, text: 'is up tonight', act: 'openhearts' });
  }
  return out;
}
