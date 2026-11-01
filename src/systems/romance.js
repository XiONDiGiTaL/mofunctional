/**
 * Stephanie, Melanie and Diana — the dating and household system.
 *
 * Everything lives in `state.romance`, so it saves and loads with the run:
 *
 *   partners[id]  met, affection (0-100), successful dates, failed dates, girlfriend, live-in,
 *                 the last day he spoke to her, when the last date was, gift/pending flags
 *   liveIn        the one partner who lives in Unit 3B (null when nobody does)
 *   afterglowUntil  absolute in-game minute the Afterglow status ends
 *
 * Rules that keep it honest:
 *   - Only adults, and nothing explicit: a date ends in dialogue, a fade to black, and the next
 *     morning. The Afterglow is a 24-IN-GAME-HOUR status on the existing clock.
 *   - Dates cost money up front and are not refunded when they go badly.
 *   - She is asked to be his girlfriend after CONFIG.romance.girlfriendDates successful dates
 *     (cancelled and failed dates do not count), and to move in after moveInDays as a couple.
 *   - One live-in partner, ever. Her rent share is read once, by economy.rentPerCycle().
 *   - Every money/stock/gift effect is stamped with the in-game day, so reloading a save cannot
 *     pay twice, restock twice, or deliver the same present again.
 */
import { CONFIG } from '../core/config.js';
import { clamp, chance, pick, money, dayOf, minuteOfDay, hhmm, uid } from '../core/util.js';
import { bump, logLine, pushMessage, addItem, countItem, earn, spend } from '../core/state.js';

export const PARTNER_KEYS = ['stephanie', 'melanie', 'diana'];
export const partner = (id) => (PARTNER_KEYS.includes(id) ? CONFIG.partners[id] : null);
export const isPartnerId = (id) => PARTNER_KEYS.includes(id);

/** Hours each of them is around the block. Diana is a morning person; that is the joke. */
const AVAILABILITY = {
  stephanie: [[10 * 60, 23 * 60]],
  melanie: [[9 * 60, 21 * 60]],
  diana: [[7 * 60, 19 * 60]],
};

export function romanceState(s) {
  if (!s.romance) s.romance = {};
  const r = s.romance;
  r.partners = r.partners || {};
  for (const id of PARTNER_KEYS) {
    const p = r.partners[id] = r.partners[id] || {};
    p.met = !!p.met;
    p.affection = clamp(Number(p.affection) || 0, 0, 100);
    p.dates = Number(p.dates) || 0;
    p.failed = Number(p.failed) || 0;
    p.girlfriend = !!p.girlfriend;
    p.liveIn = !!p.liveIn;
    p.lastTalkDay = Number(p.lastTalkDay) || 0;
    p.lastDateDay = Number(p.lastDateDay) || 0;
    p.lastFlirtAt = Number(p.lastFlirtAt) || -99999;
    p.lastCheeksAt = Number(p.lastCheeksAt) || -99999;
    p.lastGiftDay = Number(p.lastGiftDay) || 0;
    p.householdDay = Number(p.householdDay) || 0;
  }
  r.liveIn = PARTNER_KEYS.includes(r.liveIn) ? r.liveIn : null;
  // repair: a live-in flag must match the one live-in partner and her rent share must see it
  for (const id of PARTNER_KEYS) r.partners[id].liveIn = r.liveIn === id;
  r.afterglowUntil = Number(r.afterglowUntil) || 0;
  r.cheeks = Number(r.cheeks) || 0;
  r.dates = Array.isArray(r.dates) ? r.dates : [];
  r.apartmentGift = r.apartmentGift || null;
  r.giftSeq = Number(r.giftSeq) || 0;
  r.lastInviteDay = Number(r.lastInviteDay) || 0;
  return r;
}

export const partnerState = (s, id) => romanceState(s).partners[id];
export const liveInPartner = (s) => { const r = romanceState(s); return r.liveIn ? CONFIG.partners[r.liveIn] : null; };
export const isGirlfriend = (s, id) => !!romanceState(s).partners[id]?.girlfriend;

/* ------------------------------------------------------------------ time */

/** The Afterglow runs on the game clock: 24 in-game hours from the moment it starts. */
export const afterglowActive = (s) => romanceState(s).afterglowUntil > s.clock.m;
export const afterglowLeft = (s) => Math.max(0, romanceState(s).afterglowUntil - s.clock.m);
export function afterglowLabel(s) {
  const left = afterglowLeft(s);
  if (!left) return '';
  return `${Math.floor(left / 60)}h ${left % 60}m of Afterglow left`;
}

function isAwakeWindow(id, mod) {
  const wins = AVAILABILITY[id] || [[9 * 60, 22 * 60]];
  return wins.some(([a, b]) => mod >= a && mod < b);
}

export const partnerAround = (s, id) => isAwakeWindow(id, minuteOfDay(s.clock.m));

/* ------------------------------------------------------------------ meeting */

/** Put a partner in the world for the first time (the park, or a first approach). */
export function meetPartner(g, id) {
  const p = partner(id);
  if (!p) return false;
  const st = partnerState(g.state, id);
  if (st.met) return false;
  st.met = true;
  st.affection = Math.max(st.affection, 6);
  st.metDay = dayOf(g.state.clock.m);
  logLine(g, `Met ${p.name}.`, 'good');
  g.toast(`You meet ${p.name}. ${p.blurb}`, 'event');
  pushMessage(g, {
    from: p.name.toUpperCase(),
    subject: 'nice meeting you',
    body: `${p.chat[0].replace(/["“”]/g, '')}\n\n— ${p.name}`,
  });
  return true;
}

/* ------------------------------------------------------------------ flirting */

/**
 * Mo tries it. The outcome is hers to decide: personality, how she already feels, how he
 * looks right now, and whether he has been a stranger for a week.
 */
export function flirt(g, id) {
  const p = partner(id);
  if (!p) return { ok: false, reason: 'nobody' };
  const s = g.state;
  const r = romanceState(s);
  const st = r.partners[id];
  if (!st.met) meetPartner(g, id);
  if (!partnerAround(s, id)) {
    g.toast(`${p.name} is not around at this hour.`, 'info');
    return { ok: false, reason: 'not around' };
  }
  if (s.clock.m - st.lastFlirtAt < CONFIG.romance.flirtCooldownMinutes) {
    g.toast(`Give ${p.name} a minute. You are not a telemarketer.`, 'info');
    return { ok: false, reason: 'cooldown' };
  }
  st.lastFlirtAt = s.clock.m;
  g.advance(8);
  let roll = p.flirt.base * (1 - p.difficulty * 0.55);
  roll += (s.stats.hygiene - 45) * 0.32;
  roll += (s.stats.morale - 45) * 0.22;
  if (s.high.level > 45) roll -= 16;
  if (s.stats.withdrawal > 45) roll -= 12;
  if (st.affection > 25) roll += 10;
  if (st.girlfriend) roll += 30;
  roll += (Math.random() - 0.5) * 22;
  roll = clamp(roll, 0, 100);
  let delta;
  let line;
  if (roll >= 62) {
    delta = 7 + Math.round(p.difficulty * 4);
    line = pick([
      `"Okay. That was smooth. Do not let it go to your head."`,
      `"Hm. Say that again on a day I am not busy."`,
      `"You are trouble. I like trouble with a job."`,
    ]);
  } else if (roll >= 38) {
    delta = 3;
    line = `"You are alright, ${'Mo'}. Do not push it."`;
  } else if (roll >= 20) {
    delta = 0;
    line = p.flirt.low;
  } else {
    delta = -3;
    line = pick([
      `"I am going to pretend that did not happen for both of us."`,
      `"Wow. Okay. Anyway."`,
      `"You smell like the hallway. Come back another day."`,
    ]);
  }
  st.affection = clamp(st.affection + delta);
  bump(s, 'morale', delta >= 5 ? 6 : delta > 0 ? 2 : -3);
  logLine(g, `${p.name}: ${delta >= 5 ? 'warm' : delta > 0 ? 'polite' : delta === 0 ? 'flat' : 'cold'} to a compliment.`, delta >= 5 ? 'good' : 'info');
  return { ok: true, roll, delta, line, name: p.name, affection: st.affection };
}

/** A conversation (no money, small time): builds a little affection and a lot of character. */
export function chat(g, id) {
  const p = partner(id);
  if (!p) return false;
  const s = g.state;
  const st = partnerState(s, id);
  if (!st.met) meetPartner(g, id);
  if (!partnerAround(s, id)) { g.toast(`${p.name} is not around at this hour.`, 'info'); return false; }
  g.advance(CONFIG.romance.chatMinutes);
  const fresh = st.lastTalkDay !== dayOf(s.clock.m);
  st.lastTalkDay = dayOf(s.clock.m);
  const gain = fresh ? Math.max(1, Math.round(3 - p.difficulty * 2)) : 0;
  st.affection = clamp(st.affection + gain);
  bump(s, 'morale', 4);
  bump(s, 'stress', -3);
  return { name: p.name, line: pick(p.chat), gain };
}

/* ------------------------------------------------------------------ dating */

export function dateOptions(s, id) {
  const p = partner(id);
  if (!p) return [];
  return Object.values(CONFIG.romance.activities).map((a) => ({
    ...a,
    liked: p.likes.includes(a.id),
    disliked: p.dislikes.includes(a.id),
    affordable: s.money >= a.cost,
  }));
}

function dateScore(g, id, activity) {
  const s = g.state;
  const p = partner(id);
  const st = partnerState(s, id);
  let score = activity.affection;
  if (p.likes.includes(activity.id)) score += 7;
  if (p.dislikes.includes(activity.id)) score -= 6;
  score += (s.stats.hygiene - 50) * 0.09;
  score += (s.stats.energy - 50) * 0.06;
  score += (s.stats.morale - 50) * 0.1;
  if (s.stats.stress > 70) score -= 5;
  if (s.stats.withdrawal > 55) score -= 7;
  if (s.money < 20) score -= 5;
  // attentive: a date in the last three days reads as interest; a fortnight of silence does not
  const gap = dayOf(s.clock.m) - (st.lastDateDay || 0);
  if (st.lastDateDay && gap <= 3) score += 3;
  if (st.lastDateDay && gap >= 10) score -= 4;
  score -= p.difficulty * 8;
  score += (st.affection / 100) * 6;
  score += (Math.random() - 0.5) * 10;
  return score;
}

/**
 * Take her somewhere. The money leaves when the date starts and does not come back if it goes
 * badly; the time is spent; the outcome is hers.
 */
export function startDate(g, id, activityId) {
  const p = partner(id);
  const activity = CONFIG.romance.activities[activityId];
  if (!p || !activity) return { ok: false, reason: 'unknown date' };
  const s = g.state;
  const r = romanceState(s);
  if (r.dating) return { ok: false, reason: 'busy' };
  if (s.flags.recovering) { g.toast('Not now. Your body has other plans.', 'bad'); return { ok: false, reason: 'recovering' }; }
  if (!partnerAround(s, id)) {
    g.toast(`${p.name} is not free at this hour.`, 'info');
    return { ok: false, reason: 'not around' };
  }
  if (p.difficulty > 0.7 && partnerState(s, id).affection < 20) {
    g.toast(`${p.name} says she does not know you well enough for that. Talk to her first.`, 'bad');
    return { ok: false, reason: 'too soon' };
  }
  if (s.money < activity.cost) {
    g.toast(`That costs ${money(activity.cost)}. You have ${money(s.money)}.`, 'bad');
    g.audio.sfx('deny');
    return { ok: false, reason: 'short' };
  }
  // the expense is real and non-refundable
  if (activity.cost > 0) spend(g, activity.cost, `${p.name} — ${activity.name}`);

  r.dating = true;
  const st = partnerState(s, id);
  st.lastDateDay = dayOf(s.clock.m);
  st.lastTalkDay = dayOf(s.clock.m);

  // go there, spend the time, then let her react
  if (g.world && g.world.areaId !== activity.where) g.goTo(activity.where);
  g.advance((activity.minutes + CONFIG.romance.dateMinutes) * 1, { social: true });

  const score = dateScore(g, id, activity);
  const outcome = score >= 20 ? 'great' : score >= 12 ? 'good' : score >= 5 ? 'ok' : 'bad';
  const base = activity.affection;
  const delta = outcome === 'great' ? Math.round(base * 1.4)
    : outcome === 'good' ? Math.round(base)
    : outcome === 'ok' ? Math.round(base * 0.35)
    : -Math.round(base * 0.6);
  st.affection = clamp(st.affection + delta);
  bump(s, 'morale', activity.morale * (outcome === 'bad' ? -0.4 : 1));
  bump(s, 'stress', activity.stress * (outcome === 'bad' ? -0.3 : 1));
  bump(s, 'energy', activity.energy);
  if (outcome === 'great' || outcome === 'good') st.dates += 1;
  else if (outcome === 'bad') st.failed += 1;
  r.dates.push({ id: uid(), partner: id, activity: activityId, outcome, day: dayOf(s.clock.m), cost: activity.cost, delta });
  if (r.dates.length > 30) r.dates.shift();
  r.dating = false;

  logLine(g, `${activity.name} with ${p.name}: ${outcome}.`, outcome === 'bad' ? 'bad' : 'good');
  return { ok: true, outcome, delta, score, name: p.name, activity, cost: activity.cost, affection: st.affection };
}

/** The prose for an outcome. Kept here so the phone, the park and the apartment agree. */
export function dateReport(g, id, result) {
  const p = partner(id);
  const a = result.activity;
  const lines = {
    great: [
      `The evening does the thing where it stops being an evening and becomes a memory while it is still happening.`,
      `${p.name} laughs at something you said before you finish saying it.`,
    ],
    good: [
      `${a.name} went well. Not a story you will tell, but a story you will keep.`,
      `She touched your arm twice and pretended not to notice either time.`,
    ],
    ok: [
      `It was fine. Fine is a real word with real weight.`,
      `There were two silences. Neither was fatal.`,
    ],
    bad: [
      `It does not land. She checks her phone, then checks it again, then says she should get going.`,
      `You talk about the rent for nine minutes. Nine. She is very kind about it.`,
    ],
  };
  return pick(lines[result.outcome] || lines.ok);
}

/**
 * The date planner, shared by the phone, the park and the apartment so the same invitation,
 * the same prices and the same outcomes are behind all three.
 */
export function openDateMenu(g, id) {
  const p = partner(id);
  if (!p) return;
  const s = g.state;
  const options = dateOptions(s, id);
  const likes = p.likes.map((x) => CONFIG.romance.activities[x]?.name.toLowerCase() || x).join(', ');
  g.openModal({
    kicker: `${p.name.toUpperCase()} · A DATE`,
    title: 'Where To',
    body: `You have ${money(s.money)}. She likes ${likes}.\n\nA date costs the money up front, whether or not it goes well, and takes the evening with it.`,
    choices: [
      ...options.map((a) => ({
        label: `${a.name} — ${a.cost ? money(a.cost) : 'free'}`,
        sub: `${a.minutes} min${a.liked ? ' · she likes this' : ''}${a.disliked ? ' · not really her thing' : ''}`,
        disabled: !a.affordable,
        effect: () => openDateResult(g, id, a.id),
      })),
      { label: 'Not right now.', sub: '', effect: () => {} },
    ],
  });
}

export function openDateResult(g, id, activityId) {
  const res = startDate(g, id, activityId);
  if (!res.ok) return null;
  const s = g.state;
  const report = dateReport(g, id, res);
  const canCheek = (res.outcome === 'great' || res.outcome === 'good') && cheeksAvailable(s, id);
  const choices = [];
  if (canCheek) choices.push({ label: 'Walk her home.', sub: 'Cheeks · the door closes · fade to black', effect: () => cheeks(g, id) });
  choices.push({ label: 'Say goodnight.', sub: '', effect: () => {} });
  g.openModal({
    kicker: `${res.name.toUpperCase()} · ${res.outcome.toUpperCase()}`,
    title: res.activity.name,
    body: `${report}\n\nAffection ${res.affection}/100 · ${money(res.cost)} spent${res.cost ? ' (not refundable)' : ''}.${res.outcome === 'bad' ? '\n\nShe is already putting her coat on.' : ''}`,
    choices,
  });
  return res;
}

/* ------------------------------------------------------------------ girlfriend */

export function canAskGirlfriend(s, id) {
  const st = partnerState(s, id);
  const p = partner(id);
  if (!p || st.girlfriend) return false;
  return st.dates >= CONFIG.romance.girlfriendDates && st.affection >= CONFIG.romance.girlfriendAffection;
}

export function askGirlfriend(g, id) {
  const p = partner(id);
  if (!p) return false;
  const s = g.state;
  const st = partnerState(s, id);
  if (st.girlfriend) { g.toast(`${p.name} is already your girlfriend.`, 'info'); return false; }
  if (st.dates < CONFIG.romance.girlfriendDates) {
    g.toast(`You have been on ${st.dates} date${st.dates === 1 ? '' : 's'} with ${p.name}. That is not enough to ask that.`, 'info');
    return false;
  }
  g.advance(15);
  const chanceOfYes = clamp((st.affection - CONFIG.romance.girlfriendAffection) / 28 + 0.45, 0.1, 0.95);
  if (!chance(chanceOfYes)) {
    st.affection = clamp(st.affection - 4);
    bump(s, 'morale', -8);
    logLine(g, `${p.name} said not yet.`, 'bad');
    g.openModal({
      kicker: p.name.toUpperCase(),
      title: 'Not Yet',
      body: `"I like you. I am not going to pretend I do not. But I have done the version of this where I say yes because it is a nice night, and I am not doing that again."\n\nShe is not angry. That is the part that stays with you.`,
      choices: [{ label: 'Nod. Try again when it is true.', effect: () => {} }],
    });
    return false;
  }
  st.girlfriend = true;
  st.sinceDay = dayOf(s.clock.m);
  st.affection = clamp(st.affection + 8);
  bump(s, 'morale', 16);
  bump(s, 'stress', -10);
  logLine(g, `${p.name} is your girlfriend.`, 'good');
  pushMessage(g, {
    from: p.name.toUpperCase(),
    subject: 'so',
    body: `"So that is a thing now. Do not make me regret saying it out loud."\n\n— ${p.name[0]}.`,
  });
  g.openModal({
    kicker: 'UNIT 3B · SOMETHING CHANGED',
    title: `${p.name}`,
    body: `She says yes in the middle of a sentence about something else, which is how you know she means it.\n\nYou are somebody's boyfriend. The lease does not mention this. The lease mentions very little.`,
    choices: [{ label: 'Walk her home. Take the long way.', effect: () => { g.advance(20); bump(s, 'morale', 5); } }],
  });
  return true;
}

export function canAskMoveIn(s, id) {
  const st = partnerState(s, id);
  const p = partner(id);
  if (!p || !st.girlfriend || romanceState(s).liveIn) return false;
  const days = dayOf(s.clock.m) - (st.sinceDay || dayOf(s.clock.m));
  return days >= CONFIG.romance.moveInDays && st.affection >= CONFIG.romance.moveInAffection;
}

export function askMoveIn(g, id) {
  const p = partner(id);
  if (!p) return false;
  const s = g.state;
  const r = romanceState(s);
  const st = partnerState(s, id);
  if (r.liveIn) { g.toast(`${CONFIG.partners[r.liveIn].name} already lives here.`, 'info'); return false; }
  if (!st.girlfriend) { g.toast('Ask her to be your girlfriend first. One thing at a time.', 'info'); return false; }
  const days = dayOf(s.clock.m) - (st.sinceDay || dayOf(s.clock.m));
  if (days < CONFIG.romance.moveInDays) {
    g.toast(`${p.name} wants a week of this first. It has been ${days} day${days === 1 ? '' : 's'}.`, 'info');
    return false;
  }
  if (st.affection < CONFIG.romance.moveInAffection) {
    g.toast(`${p.name} says the apartment is a lot to take on. So is she, apparently.`, 'bad');
    return false;
  }
  g.advance(30);
  r.liveIn = id;
  st.liveIn = true;
  st.affection = clamp(st.affection + 6);
  bump(s, 'morale', 14);
  bump(s, 'stress', -8);
  logLine(g, `${p.name} moved into Unit 3B.`, 'good');
  const share = Math.round(p.rentShare * 100);
  g.openModal({
    kicker: 'UNIT 3B',
    title: 'Two Toothbrushes',
    body: `${p.moveInLine}\n\nHer things arrive in four bags and one box she does not let you carry. Rent is ${share}% hers from the next cycle. The bathroom shelf is now a negotiation.`,
    choices: [{ label: 'Make room.', effect: () => { bump(s, 'morale', 4); } }],
  });
  pushMessage(g, {
    from: 'RAE VELL (LANDLORD)',
    subject: 'Occupancy change, Unit 3B',
    body: `Heard there is another name on the mailbox. That is fine. That is not fine, legally, but it is fine.\n\nHer share comes off the rent from the next cycle. Do not make me regret being reasonable.\n\n— Rae`,
  });
  return true;
}

export function breakUp(g, id) {
  const p = partner(id);
  if (!p) return false;
  const s = g.state;
  const r = romanceState(s);
  const st = partnerState(s, id);
  if (!st.girlfriend) return false;
  st.girlfriend = false;
  st.liveIn = false;
  st.affection = clamp(st.affection - 35);
  if (r.liveIn === id) r.liveIn = null;
  bump(s, 'morale', -22);
  bump(s, 'stress', 18);
  logLine(g, `Broke up with ${p.name}.`, 'bad');
  g.toast(`${p.name} takes her things and does not slam the door, which is worse.`, 'bad');
  return true;
}

/* ------------------------------------------------------------------ Cheeks */

export function cheeksAvailable(s, id) {
  const p = partner(id);
  const st = partnerState(s, id);
  if (!p) return false;
  const need = CONFIG.romance.cheekAffection[id] ?? 60;
  if (st.affection < need) return false;
  if (s.clock.m - st.lastCheeksAt < CONFIG.romance.cheekCooldownMinutes) return false;
  if (afterglowActive(s)) return false;
  return true;
}

/**
 * The non-explicit intimacy beat: she agrees, they go home, the door closes, the screen fades,
 * and the next morning arrives with a 24-in-game-hour Afterglow. Nothing explicit is shown.
 */
export function cheeks(g, id) {
  const p = partner(id);
  if (!p) return false;
  const s = g.state;
  const r = romanceState(s);
  const st = partnerState(s, id);
  if (!cheeksAvailable(s, id)) {
    g.toast(`${p.name} is not there yet.`, 'info');
    return false;
  }
  st.lastCheeksAt = s.clock.m;
  r.cheeks += 1;
  st.affection = clamp(st.affection + 6);
  g.advance(20);
  const finish = () => {
    const now = s.clock.m;
    const nextMorning = (Math.floor(now / 1440) + 1) * 1440 + 7 * 60;
    const minutes = Math.max(5 * 60, nextMorning - now);
    g.advance(minutes, { sleeping: true, noCollapse: true });
    startAfterglow(g);
    if (g.world && g.world.areaId !== 'apartment') g.goTo('apartment');
    g.fadeIn?.();
    g.openModal({
      kicker: 'UNIT 3B · MORNING',
      title: 'Afterglow',
      body: `${p.cheekLine}\n\nThe door closed. The city kept going. Somewhere a car alarm gave up.\n\nYou wake up at ${hhmm(s.clock.m)} with the specific smugness of a man whose radiator is still broken but who is, for the next ${CONFIG.romance.afterglowHours} hours, doing fine.`,
      choices: [{ label: 'Enjoy it.', effect: () => { bump(s, 'morale', 6); } }],
    });
    logLine(g, `A night with ${p.name}. Afterglow for ${CONFIG.romance.afterglowHours}h.`, 'good');
  };
  if (g.fadeOut) g.fadeOut(finish, 420);
  else finish();
  return true;
}

/** The Afterglow: mood maxed, needs topped up, stress down — until the clock says otherwise. */
export function startAfterglow(g) {
  const s = g.state;
  const r = romanceState(s);
  const until = s.clock.m + CONFIG.romance.afterglowHours * 60;
  r.afterglowUntil = Math.max(r.afterglowUntil, until);
  s.stats.morale = 100;
  s.stats.stress = Math.min(s.stats.stress, 8);
  s.stats.energy = Math.max(s.stats.energy, 90);
  s.stats.hunger = Math.max(s.stats.hunger, 80);
  s.stats.hygiene = Math.max(s.stats.hygiene, 80);
  g.bus?.emit('afterglow', { until });
}

/** Called from the simulation each tick: holds the bonus while it lasts, ends it once. */
export function applyAfterglow(s) {
  const r = romanceState(s);
  if (!r.afterglowUntil) return;
  if (s.clock.m < r.afterglowUntil) {
    s.stats.morale = 100;
    s.stats.stress = Math.min(s.stats.stress, 12);
    s.stats.energy = Math.max(s.stats.energy, 82);
    s.stats.hunger = Math.max(s.stats.hunger, 65);
    s.stats.hygiene = Math.max(s.stats.hygiene, 65);
  } else if (r.afterglowUntil && !r.afterglowEnded) {
    r.afterglowEnded = true;
    r.afterglowUntil = 0;
  }
}

/* ------------------------------------------------------------------ gifts */

export function pendingGift(s) {
  const r = romanceState(s);
  return r.apartmentGift || null;
}

/** Leave a present in the apartment. Guarded: one pending gift, one per partner per 3 days. */
export function spawnGift(g, id, itemId = null) {
  const p = partner(id);
  if (!p) return false;
  const s = g.state;
  const r = romanceState(s);
  if (r.apartmentGift) return false;
  const st = partnerState(s, id);
  // `0` means she has never left one; without this the very first gift would be blocked until
  // the cooldown had elapsed from Day 0
  const lastGift = st.lastGiftDay || 0;
  if (lastGift && dayOf(s.clock.m) - lastGift < CONFIG.romance.giftCooldownDays) return false;
  const item = itemId || pick(p.giftPool.filter((x) => CONFIG.items[x]));
  if (!item) return false;
  r.giftSeq += 1;
  r.apartmentGift = { seq: r.giftSeq, item, from: id, day: dayOf(s.clock.m), opened: false };
  st.lastGiftDay = dayOf(s.clock.m);
  pushMessage(g, {
    from: p.name.toUpperCase(),
    subject: 'left you something',
    body: `${p.giftNote}\n\nIt is on your counter. Do not pretend you did not see it.\n\n— ${p.name[0]}.`,
  });
  logLine(g, `${p.name} left a present at the apartment.`, 'good');
  return true;
}

/** Open it. The item goes into his pockets exactly once. */
export function openGift(g) {
  const s = g.state;
  const r = romanceState(s);
  const gift = r.apartmentGift;
  if (!gift || gift.opened) { g.toast('Nothing there but a ring in the dust.', 'info'); return false; }
  gift.opened = true;
  addItem(s, gift.item, 1);
  const def = CONFIG.items[gift.item];
  const p = partner(gift.from);
  bump(s, 'morale', 8);
  r.apartmentGift = null;
  logLine(g, `Opened ${p ? p.name + "'s" : 'a'} present: ${def.name}.`, 'good');
  g.audio.sfx('confirm');
  return { item: gift.item, name: def.name, from: p ? p.name : 'someone' };
}

/* ------------------------------------------------------------------ the day */

/**
 * Once per in-game day: household behaviour, a message from her, and the odd invitation.
 * Every effect is stamped with the day, so a reload cannot repeat it.
 */
export function partnerNewDay(g, day) {
  const s = g.state;
  const r = romanceState(s);
  // the Afterglow's end is announced exactly once
  if (r.afterglowUntil && s.clock.m >= r.afterglowUntil) {
    r.afterglowUntil = 0;
    g.toast('The Afterglow wears off. The radiator is still broken.', 'info');
  }
  const id = r.liveIn;
  if (id) {
    const p = CONFIG.partners[id];
    const st = r.partners[id];
    if (st.householdDay !== day) {
      st.householdDay = day;
      // she eats what is in the fridge (Stephanie, mostly)
      const eats = p.household.eatsFood || 0;
      if (eats > 0) {
        let taken = 0;
        const fridge = s.fridge || (s.fridge = []);
        for (const entry of [...fridge]) {
          const def = CONFIG.items[entry.id];
          if (!def || def.kind !== 'food') continue;
          if (taken >= eats) break;
          entry.qty -= 1;
          taken += 1;
          bump(s, 'morale', 1);
          if (entry.qty <= 0) s.fridge = s.fridge.filter((x) => x !== entry);
        }
        s.fridge = (s.fridge || []).filter((x) => x.qty > 0);
        if (taken) {
          g.toast(`${p.name} ate something out of the fridge. She did not mention it.`, 'info');
        }
      }
      // she restocks it (Diana)
      const restocks = p.household.restocks || 0;
      if (restocks > 0) {
        const pool = ['eggs', 'beans', 'cereal', 'ramen'];
        for (let i = 0; i < restocks; i++) {
          const item = pick(pool);
          const shelf = s.fridge || (s.fridge = []);
          const have = shelf.find((x) => x.id === item);
          if (have) have.qty += 1; else shelf.push({ id: item, qty: 1 });
        }
        g.toast(`${p.name} did the shopping. The fridge has opinions again, and food.`, 'good');
      }
      // she sells something of her own and puts the money in the envelope (Diana)
      if (p.household.sells && day % 2 === 0) {
        const amount = 18 + Math.floor(Math.random() * 24);
        earn(g, amount, `${p.name} — sold a thing online`);
        g.toast(`${p.name} sold something of hers online and left ${money(amount)} on the table.`, 'good');
      }
      // a present now and then
      if (chance(p.household.giftChance)) spawnGift(g, id);
    }
    // she checks in
    if (chance(0.55)) {
      const lines = [
        `"The radiator is doing the thing again. I put a cup under it. You are welcome."`,
        `"I am making food. Actual food. Be home or do not, but be warned."`,
        `"Your side of the bed is cold. That is a complaint and also an invitation."`,
      ];
      pushMessage(g, { from: p.name.toUpperCase(), subject: 'home', body: pick(lines) });
    }
  }

  // an invitation from somebody he is seeing, occasionally
  if (chance(0.3) && day - (r.lastInviteDay || 0) >= 2) {
    const candidates = PARTNER_KEYS.filter((k) => {
      const st = r.partners[k];
      return st.met && !(st.lastInviteDay === day);
    });
    if (candidates.length) {
      const who = pick(candidates);
      const st = r.partners[who];
      st.lastInviteDay = day;
      r.lastInviteDay = day;
      const pp = CONFIG.partners[who];
      pushMessage(g, {
        from: pp.name.toUpperCase(),
        subject: pick(['you around?', 'plans?', 'hey']),
        body: pick([
          `"I am going to be near the park later. If you are not doing anything. Which you are not."`,
          `"Coffee. You, me, forty minutes, no talk about rent. Think about it."`,
          `"There is a thing at the park. Come stand near me at it."`,
        ]) + `\n\n— ${pp.name[0]}.`,
      });
    }
  }
}

/* ------------------------------------------------------------------ debug */

export function debugSet(g, id, patch = {}) {
  const s = g.state;
  const r = romanceState(s);
  const st = r.partners[id] || (r.partners[id] = {});
  Object.assign(st, patch);
  if (patch.liveIn === true && !r.liveIn) r.liveIn = id;
  if (patch.liveIn === false && r.liveIn === id) r.liveIn = null;
  romanceState(s);
  g.bus?.emit('romance');
  return st;
}

export function debugReset(g) {
  const s = g.state;
  s.romance = null;
  romanceState(s);
  g.bus?.emit('romance');
}
