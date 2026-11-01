/**
 * FeedLove's HEARTS tab: the dating side of the social app.
 *
 * Every day the app deals Mo a stack of profiles. Most are strangers from the five boroughs, and
 * most of them say no — that is the joke and the realism both. Three of the profiles are the
 * women he can actually build something with (Stephanie, Melanie, Diana): they answer, they swap
 * numbers, and from then on they are ordinary contacts in Txtr and go through the same romance
 * system as meeting them in the park — chatting, dates, everything.
 *
 * The strangers are a fixed cast of twenty (core/strangers.js), so the same faces come round
 * again. Most say no. A few (`open`) are not looking for a boyfriend but might be looking for
 * company: a heart can become a hookup contact — a night, a fade to black, no dates, no future —
 * and she can turn up in person on the block (world/schedules.js strangerRunIns).
 *
 * Headless: deterministic per day (a stranger's profile does not change if you reopen the app),
 * capped hearts per day, state in `state.dating`, created lazily.
 */
import { CONFIG } from '../core/config.js';
import { dayOf, minuteOfDay, hhmm } from '../core/util.js';
import { bump, logLine, pushMessage } from '../core/state.js';
import * as romance from './romance.js';
import { STRANGERS, STRANGER_BY_ID } from '../core/strangers.js';
import * as health from './health.js';

const D = CONFIG.dating;

export function datingState(s) {
  if (!s.dating) s.dating = { day: 0, hearts: 0, results: {}, matched: {}, swipes: 0 };
  const d = s.dating;
  d.results = d.results || {};
  d.matched = d.matched || {};
  d.seen = d.seen || {};        // stranger id -> what happened in the app: 'reject' | 'ghost' | 'hookup'
  d.hookups = d.hookups || {};  // stranger id -> { since, lastDay, count, flaked }
  d.hookupCount = Number(d.hookupCount) || 0;
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
  const out = [];
  // a seeded shuffle of the twenty; today's stack is the first few
  const deck = STRANGERS.slice();
  for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
  for (const w of deck.slice(0, D.strangersPerDay)) {
    out.push({ id: `d${day}-${w.id}`, name: w.name, age: w.age, hood: w.hood, bio: w.bio, face: w.id, partner: null });
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

  // strangers: mostly no. a rare match that goes nowhere. and a few who are not looking for a
  // boyfriend, which is not the same as not looking.
  const w = STRANGER_BY_ID[prof.face];
  const roll = Math.random() * 100 + (s.stats.hygiene - 50) * 0.05 + (s.stats.morale - 50) * 0.05;
  if (w?.open && !d.hookups[w.id]?.flaked && (d.hookups[w.id] || roll >= 100 - D.hookup.matchChance)) {
    d.results[profileId] = 'hookup';
    d.seen[w.id] = 'hookup';
    if (!d.hookups[w.id]) d.hookups[w.id] = { since: day, lastDay: 0, count: 0, flaked: false };
    bump(s, 'morale', 5);
    const line = pickLine(D.hookup.openers);
    pushMessage(g, { from: w.name.toUpperCase(), subject: 'FeedLove match', body: `${line}\n\nnot a date. not a boyfriend. text me after ${D.hookup.fromHour}:00.\n\n— ${w.name}` });
    logLine(g, `${w.name} matched on FeedLove. Not for dating.`, 'info');
    return { ok: true, result: 'hookup', line };
  }
  if (roll >= 100 - D.strangerGhostChance) {
    d.results[profileId] = 'ghost';
    if (w) d.seen[w.id] = 'ghost';
    bump(s, 'morale', 2);
    return { ok: true, result: 'ghost', line: pickLine(D.ghostLines) };
  }
  d.results[profileId] = 'reject';
  if (w) d.seen[w.id] = 'reject';
  bump(s, 'morale', -1);
  return { ok: true, result: 'reject', line: pickLine(D.rejectLines) };
}

/* ------------------------------------------------------------------ hookups */

/** The women he can text for a night: matched in the app or met on the block, not flaked. */
export function hookupContacts(s) {
  const d = datingState(s);
  return Object.keys(d.hookups).filter((id) => STRANGER_BY_ID[id] && !d.hookups[id].flaked).map((id) => STRANGER_BY_ID[id]);
}

/** Make her a hookup contact (a run-in that went well). */
export function addHookupContact(g, id) {
  const d = datingState(g.state);
  const w = STRANGER_BY_ID[id];
  if (!w || d.hookups[id]) return false;
  d.hookups[id] = { since: dayOf(g.state.clock.m), lastDay: 0, count: 0, flaked: false };
  d.seen[id] = 'hookup';
  pushMessage(g, { from: w.name.toUpperCase(), subject: 'the number', body: `it's ${w.name}. from earlier. after ${D.hookup.fromHour}:00, if you're around.` });
  return true;
}

/** { ok, reason } — late at night, once every few days with each of them. */
export function hookupAvailable(s, id) {
  const d = datingState(s);
  const h = d.hookups[id];
  if (!h || h.flaked) return { ok: false, reason: 'she is not answering' };
  const mod = minuteOfDay(s.clock.m);
  const from = D.hookup.fromHour * 60, to = D.hookup.toHour * 60;
  const late = from > to ? (mod >= from || mod < to) : (mod >= from && mod < to);
  if (!late) return { ok: false, reason: `after ${hhmm(from)}` };
  if (h.lastDay && dayOf(s.clock.m) - h.lastDay < D.hookup.cooldownDays) return { ok: false, reason: 'not again this soon' };
  if (s.stats.energy < D.hookup.minEnergy) return { ok: false, reason: 'too tired' };
  return { ok: true };
}

/**
 * The night. No dates, no affection meter, nothing explicit: a text, a train, a door, a fade to
 * black, and the ride home. She might flake instead. If Mo has a girlfriend, somebody might see.
 */
/** Where: her place (the long train home after), or his (she leaves before the radiator wakes up). */
export function hookupMenu(g, id) {
  const s = g.state;
  const w = STRANGER_BY_ID[id];
  const av = hookupAvailable(s, id);
  if (!w || !av.ok) { g.toast(`${w?.name || 'She'}: ${av.reason}.`, 'info'); return; }
  g.openModal({
    kicker: `${w.name.toUpperCase()} · ${w.hood.toUpperCase()}`, title: 'Tonight',
    body: `"${pickLine(['you up?', 'so. tonight?', 'i\'m bored. entertain me.', 'my roommate is out. or yours could be.'])}"\n\nNot a date. Not a boyfriend. Just tonight.`,
    choices: [
      { label: 'Go to hers.', sub: `${w.hood} · the train home after`, effect: () => hookup(g, id, 'hers') },
      { label: 'Invite her over.', sub: 'Unit 3B · she leaves early', effect: () => hookup(g, id, 'his') },
      { label: 'Not tonight.', sub: '', effect: () => {} },
    ],
  });
}

export function hookup(g, id, where = 'hers') {
  const s = g.state;
  const d = datingState(s);
  const w = STRANGER_BY_ID[id];
  const av = hookupAvailable(s, id);
  if (!w || !av.ok) { g.toast(`${w?.name || 'She'}: ${av.reason}.`, 'info'); return false; }
  const h = d.hookups[id];
  const H = D.hookup;
  if (Math.random() < H.flakeChance) {
    h.flaked = true;
    g.advance(30);
    bump(s, 'morale', -4);
    pushMessage(g, { from: w.name.toUpperCase(), subject: '', body: pickLine(H.flakeLines) });
    g.toast(`${w.name} stopped answering halfway through "where are you".`, 'bad');
    return { ok: true, result: 'flake' };
  }
  const finish = () => {
    g.advance(H.minutes, { noCollapse: true });
    h.lastDay = dayOf(s.clock.m);
    h.count += 1;
    d.hookupCount += 1;
    bump(s, 'morale', H.morale);
    bump(s, 'stress', H.stress);
    bump(s, 'energy', H.energy);
    bump(s, 'hygiene', H.hygiene);
    // a girlfriend on the block hears about it, sometimes
    const gf = romance.PARTNER_KEYS.find((pid) => romance.isGirlfriend(s, pid));
    let caught = '';
    if (gf && Math.random() < H.caughtChance) {
      const st = romance.partnerState(s, gf);
      st.affection = Math.max(0, st.affection - H.caughtAffection);
      bump(s, 'morale', -10);
      const p = CONFIG.partners[gf];
      pushMessage(g, { from: p.name.toUpperCase(), subject: '', body: 'somebody saw you get on the train with a girl from that app at midnight. do not text me today.' });
      caught = `\n\nYour phone buzzes on the ride home. It is ${p.name}. Somebody saw you.`;
    }
    // and sometimes she leaves him something to remember her by
    let souvenir = false;
    if (Math.random() < CONFIG.health.clapChance * (w.risky ? 2 : 1)) souvenir = health.infect(g, w.id);
    void souvenir;
    if (g.world && g.world.areaId !== 'apartment') g.goTo('apartment');
    g.fadeIn?.();
    const story = where === 'his'
      ? `She looks around Unit 3B like it is a museum of a man. She says the radiator is "a lot." The door closes.\n\nShe is gone before the radiator wakes up, and she has taken one of your good socks, which is a choice.`
      : `${pickLine(H.nightLines)}\n\nThe door closed. Later: the long train home, the car empty except for a man asleep on his own shoulder. ${w.name} did not ask you to stay and you did not ask to.`;
    if (where === 'his') bump(s, 'energy', 6); // no train home
    g.openModal({
      kicker: `${(where === 'his' ? 'UNIT 3B' : w.hood).toUpperCase()} · ${hhmm(s.clock.m)}`,
      title: w.name,
      body: `${story}${caught}`,
      choices: [{ label: 'Go to bed.', effect: () => {} }],
    });
    logLine(g, `A night with ${w.name}. Not a date.`, caught ? 'bad' : 'good');
  };
  if (g.fadeOut) g.fadeOut(finish, 420);
  else finish();
  return { ok: true, result: 'night' };
}

const pickLine = (arr) => arr[Math.floor(Math.random() * arr.length)];
