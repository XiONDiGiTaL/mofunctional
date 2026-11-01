/**
 * FeedLove's HEARTS tab: the dating side of the social app.
 *
 * Every day the app deals Mo a stack of profiles. Most are strangers from the five boroughs, and
 * most of them say no — that is the joke and the realism both. Three of the profiles are the
 * women he can actually build something with (Stephanie, Melanie, Diana): they answer, they swap
 * numbers, and from then on they are ordinary contacts in Txtr and go through the same romance
 * system as meeting them in the park — chatting, dates, everything.
 *
 * Headless: deterministic per day (a stranger's profile does not change if you reopen the app),
 * capped hearts per day, state in `state.dating`, created lazily.
 */
import { CONFIG } from '../core/config.js';
import { dayOf } from '../core/util.js';
import { bump, logLine, pushMessage } from '../core/state.js';
import * as romance from './romance.js';

const D = CONFIG.dating;

export function datingState(s) {
  if (!s.dating) s.dating = { day: 0, hearts: 0, results: {}, matched: {}, swipes: 0 };
  const d = s.dating;
  d.results = d.results || {};
  d.matched = d.matched || {};
  return d;
}

/** A small seeded random so a day's stack is the same every time the app opens. */
function rng(seed) {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/** Today's stack: strangers, and any of the three he has not matched with yet. */
export function profilesToday(s) {
  const day = dayOf(s.clock.m);
  const d = datingState(s);
  const r = rng(day * 9973 + 17);
  const pick = (arr) => arr[Math.floor(r() * arr.length)];
  const out = [];
  for (let i = 0; i < D.strangersPerDay; i++) {
    const name = pick(D.names);
    out.push({
      id: `d${day}-${i}`,
      name,
      age: 23 + Math.floor(r() * 22),
      hood: pick(D.hoods),
      bio: pick(D.bios),
      tint: D.tints[Math.floor(r() * D.tints.length)],
      partner: null,
    });
  }
  // the three show up in the stack until he has matched with them, one or two a day
  for (const id of romance.PARTNER_KEYS) {
    if (d.matched[id]) continue;
    if (r() < D.partnerShowChance || (day + id.length) % 3 === 0) {
      const p = CONFIG.partners[id];
      out.splice(Math.floor(r() * (out.length + 1)), 0, {
        id: `p-${id}`, name: p.name, age: p.age, hood: D.partnerHood[id] || 'Kestrel St.',
        bio: D.partnerBio[id] || p.blurb, tint: null, partner: id,
      });
    }
  }
  return out;
}

/** Send a heart. Returns { ok, result: 'reject'|'ghost'|'match', line }. Costs a few minutes. */
export function sendHeart(g, profileId) {
  const s = g.state;
  const d = datingState(s);
  const day = dayOf(s.clock.m);
  if (d.day !== day) { d.day = day; d.hearts = 0; }
  if (d.results[profileId]) return { ok: false, reason: 'already' };
  if (d.hearts >= D.heartsPerDay) {
    g.toast(`FeedLove: ${D.heartsPerDay} hearts a day. "Quality over quantity," says the app that sold your data.`, 'info');
    return { ok: false, reason: 'cap' };
  }
  const prof = profilesToday(s).find((p) => p.id === profileId);
  if (!prof) return { ok: false, reason: 'gone' };
  d.hearts += 1;
  d.swipes = (d.swipes || 0) + 1;
  g.advance(D.heartMinutes);

  if (prof.partner) {
    // the three answer: a match, a few lines, a number
    const id = prof.partner;
    const p = CONFIG.partners[id];
    d.results[profileId] = 'match';
    d.matched[id] = day;
    romance.meetPartner(g, id);
    const st = romance.partnerState(s, id);
    st.affection = Math.min(100, st.affection + D.matchAffection);
    bump(s, 'morale', 8);
    pushMessage(g, {
      from: p.name.toUpperCase(),
      subject: 'FeedLove match',
      body: `${D.partnerOpener[id] || 'hey.'}\n\nthis is my number. text me like a normal person.\n\n— ${p.name}`,
    });
    logLine(g, `Matched with ${p.name} on FeedLove.`, 'good');
    return { ok: true, result: 'match', line: D.partnerOpener[id] || '', partner: id };
  }

  // strangers: mostly no. a rare match that goes nowhere.
  const roll = Math.random() * 100 + (s.stats.hygiene - 50) * 0.05 + (s.stats.morale - 50) * 0.05;
  if (roll >= 100 - D.strangerGhostChance) {
    d.results[profileId] = 'ghost';
    bump(s, 'morale', 2);
    return { ok: true, result: 'ghost', line: pickLine(D.ghostLines) };
  }
  d.results[profileId] = 'reject';
  bump(s, 'morale', -1);
  return { ok: true, result: 'reject', line: pickLine(D.rejectLines) };
}

const pickLine = (arr) => arr[Math.floor(Math.random() * arr.length)];
