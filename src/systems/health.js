/**
 * Things a hookup can leave behind. One of them, specifically: the clap.
 *
 * A night with one of the FeedLove women can come with it (dating.js rolls). It shows up the next
 * day ("it burns"), then drains him by the hour — energy, morale, a little stress — until he walks
 * into Kestrel Clinic and pays for the antibiotics (or puts them on the hospital bill). Once it
 * shows, he knows who it was: he can text her about it, or post about it on NextStoop.
 *
 * Headless; state in `state.health`, created lazily.
 */
import { CONFIG } from '../core/config.js';
import { dayOf, money, pick } from '../core/util.js';
import { bump, pushMessage, logLine } from '../core/state.js';
import { STRANGER_BY_ID } from '../core/strangers.js';
import * as life from './life.js';

const C = () => CONFIG.health;

export function healthState(s) {
  if (!s.health) s.health = { clap: null, cured: 0 };
  return s.health;
}

export const hasClap = (s) => !!healthState(s).clap;
export const clapSymptomatic = (s) => !!healthState(s).clap?.symptomatic;
export const clapFrom = (s) => healthState(s).clap?.from || null;

export function infect(g, fromId) {
  const h = healthState(g.state);
  if (h.clap) return false;
  h.clap = { from: fromId, day: dayOf(g.state.clock.m), symptomatic: false, accused: false, posted: false };
  return true;
}

/** By the hour: the morning after, it shows; after that it drains him until it is treated. */
export function healthTick(g, hours) {
  const s = g.state;
  const h = healthState(s);
  if (!h.clap) return;
  if (!h.clap.symptomatic && dayOf(s.clock.m) > h.clap.day) {
    h.clap.symptomatic = true;
    const w = STRANGER_BY_ID[h.clap.from];
    logLine(g, 'Something is wrong. It burns.', 'bad');
    g.toast(`It burns. It burns in a specific, educational way. ${w ? `You think about ${w.name}.` : ''} Kestrel Clinic does walk-ins.`, 'bad');
  }
  if (!h.clap.symptomatic) return;
  const d = C().clapDrainPerHour;
  bump(s, 'energy', d.energy * hours);
  bump(s, 'morale', d.morale * hours);
  bump(s, 'stress', d.stress * hours);
}

/** At the clinic: antibiotics. Cash if he has it, the hospital bill if he does not. */
export function treatClap(g) {
  const s = g.state;
  const h = healthState(s);
  if (!h.clap) return false;
  const cost = C().clapCureCost;
  if (s.money >= cost) g.spendMoney(cost, 'clinic: antibiotics');
  else {
    const l = life.lifeState(s);
    l.debt.hospital = (l.debt.hospital || 0) + cost;
  }
  g.advance(40);
  h.clap = null;
  h.cured += 1;
  bump(s, 'morale', 6);
  bump(s, 'stress', -8);
  logLine(g, `Treated for the clap (${money(cost)}).`, 'info');
  return true;
}

/** Text her about it. She denies it, loudly, and is gone from his phone. */
export function accuse(g) {
  const s = g.state;
  const h = healthState(s);
  if (!h.clap?.symptomatic || h.clap.accused) return false;
  const w = STRANGER_BY_ID[h.clap.from];
  if (!w) return false;
  h.clap.accused = true;
  const hk = s.dating?.hookups?.[w.id];
  if (hk) hk.flaked = true;
  bump(s, 'stress', -3);
  pushMessage(g, { from: w.name.toUpperCase(), subject: '', body: pick([
    '"WOW. ok first of all no. second of all it was probably YOU. third of all lose my number"',
    '"that is NOT from me. i have a doctor. do you have a doctor? exactly. blocked"',
    '"…which clinic. asking for a friend. the friend is me. ok. sorry. bye forever"',
  ]) });
  return true;
}

/**
 * Post about her on NextStoop. Petty, satisfying, public. Sometimes the block takes his side;
 * sometimes she posts back about him, and the block takes hers.
 */
export function postAboutHer(g) {
  const s = g.state;
  const h = healthState(s);
  if (!h.clap?.symptomatic || h.clap.posted) return null;
  const w = STRANGER_BY_ID[h.clap.from];
  if (!w) return null;
  h.clap.posted = true;
  const backfire = Math.random() < C().postBackfire;
  const post = {
    who: 'Mo (1120)', text: `PSA for anybody on FeedLove: ${w.name}, ${w.age}, ${w.hood}. Get checked. That is all I am saying. (That is not all I am saying.)`,
    replies: backfire
      ? [`${w.name}: "this man has a radiator problem AND a hygiene problem and he knows which one i mean"`, 'Gloria (4B): "there are CHILDREN on this app, Mo."', 'Lenny: "lmao"']
      : ['Lenny: "thank you for your service"', 'Dee from the laundromat: "she did my cousin like that too"', 'Gloria (4B): "there are CHILDREN on this app, Mo."'],
    day: dayOf(s.clock.m),
  };
  s.stoopPosts = s.stoopPosts || [];
  s.stoopPosts.unshift(post);
  if (backfire) {
    bump(s, 'morale', -6);
    bump(s, 'stress', 5);
    if (s.social) s.social.followers = Math.max(0, s.social.followers - 3);
  } else {
    bump(s, 'morale', 5);
  }
  const hk = s.dating?.hookups?.[w.id];
  if (hk) hk.flaked = true;
  return { post, backfire };
}
