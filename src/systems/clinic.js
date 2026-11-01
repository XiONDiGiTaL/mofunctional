/**
 * Kestrel Clinic: the actual building, its one nurse, and what recovery costs.
 *
 * This is the place the phone has been promising since the paramedics wrote a number on a
 * napkin. It is a real interior on Kestrel Street (world/areas.js → buildClinic), it is drawn on
 * the map because it is in world/plan.js like every other door, and everything it does goes
 * through this module so the phone, the collapse sequence and the room agree.
 *
 * Money: a treatment is paid in cash when Mo can; when he cannot, the fee is added to the
 * hospital debt that life.js already tracks and grows at 1%/day. It is never free and it is
 * never silently duplicated: each visit is stamped with the in-game minute.
 */
import { CONFIG } from '../core/config.js';
import { money, dayOf } from '../core/util.js';
import { bump, logLine, pushMessage } from '../core/state.js';
import * as life from './life.js';

const C = CONFIG.clinic;

export function clinicState(s) {
  if (!s.clinic) s.clinic = { visits: 0, lastVisitDay: 0, lastTreatAt: -99999, treatments: 0 };
  const c = s.clinic;
  c.visits = Number(c.visits) || 0;
  c.treatments = Number(c.treatments) || 0;
  c.lastTreatAt = Number(c.lastTreatAt) || -99999;
  return c;
}

/** What the nurse would do for him right now, and what it costs. */
export function treatmentInfo(g) {
  const s = g.state;
  const c = clinicState(s);
  const t = C.treatment;
  const needsIt = s.stats.risk > 18 || s.stats.withdrawal > 18 || s.stats.addiction > 30;
  const sameDay = dayOf(s.clock.m) === c.lastVisitDay && c.treatments > 0 && s.clock.m - c.lastTreatAt < 720;
  return {
    ...t,
    affordable: s.money >= t.cost,
    needsIt,
    alreadyToday: sameDay,
    canTreat: !sameDay,
    owed: !s.money || s.money < t.cost,
  };
}

/**
 * The treatment: an hour and a half, a blood-pressure cuff, a blood draw, a lecture that is
 * mostly kindness, and a real reduction in risk and withdrawal — not a reset to perfect.
 */
export function treat(g) {
  const s = g.state;
  const c = clinicState(s);
  const info = treatmentInfo(g);
  if (!info.canTreat) {
    g.toast(`${C.nurse} says come back tomorrow. She wrote it down.`, 'info');
    return false;
  }
  const cost = C.treatment.cost;
  let paid = 0;
  if (s.money >= cost) {
    g.spendMoney(cost, `${C.name} — treatment`);
    paid = cost;
  } else {
    // no cash: it goes on the bill that already finds him
    life.lifeState(s).debt.hospital = Math.round((life.lifeState(s).debt.hospital || 0) + cost);
    g.toast(`You cannot pay. It goes on the hospital bill (${money(cost)}).`, 'bad');
  }
  g.advance(C.treatment.minutes, { noCollapse: true });
  s.stats.risk = Math.max(0, s.stats.risk + C.treatment.risk);
  s.stats.withdrawal = Math.max(0, s.stats.withdrawal + C.treatment.withdrawal);
  s.stats.addiction = Math.max(0, s.stats.addiction + C.treatment.addiction);
  bump(s, 'morale', C.treatment.morale);
  bump(s, 'stress', C.treatment.stress);
  s.clinic.lastVisitDay = dayOf(s.clock.m);
  s.clinic.lastTreatAt = s.clock.m;
  s.clinic.treatments += 1;
  s.clinic.visits += 1;
  life.lifeState(s).counselor = true;
  logLine(g, `Treated at ${C.name}${paid ? ` (${money(paid)})` : ' (billed)'}.`, paid ? 'good' : 'info');
  g.audio.sfx('confirm');
  pushMessage(g, {
    from: 'KESTREL CLINIC',
    subject: 'After your visit',
    body: `${'You did the thing where you sat in a plastic chair and told the truth to a stranger with a clipboard.'}\n\nThe daily check-in line is open. One text a day does more than it sounds like it does.\n\n— ${C.nurse}`,
  });
  return { paid, owed: cost - paid };
}

/** The daily check-in, shared with the Txtr thread. Delegates to life.clinicCheckIn(). */
export function checkIn(g) {
  const ok = life.clinicCheckIn(g);
  if (ok) {
    const s = g.state;
    s.stats.risk = Math.max(0, s.stats.risk + C.checkIn.risk);
    clinicState(s).visits += 0; // a text is not a visit
    g.audio.sfx('phone');
  }
  return ok;
}

/**
 * The collapse route: he wakes up here instead of at home. Used by the collapse sequence when
 * the dice say the clinic, or when he has collapsed enough times that somebody calls it in.
 * Bil/recovery only — the falling, fading and travel are the world's job.
 */
export function recoverHere(g, { cause = 'collapse', free = false } = {}) {
  const s = g.state;
  const c = clinicState(s);
  c.visits += 1;
  c.lastVisitDay = dayOf(s.clock.m);
  s.counters.clinicRecoveries = (s.counters.clinicRecoveries || 0) + 1;
  let fee = 0;
  if (!free) {
    const cost = cause === 'overdose' ? C.treatment.cost * 2 : C.treatment.cost;
    if (s.money >= cost) {
      g.spendMoney(cost, `${C.name} — recovery`);
      fee = cost;
    } else {
      life.lifeState(s).debt.hospital = Math.round((life.lifeState(s).debt.hospital || 0) + cost);
      fee = -cost; // negative means it went on the bill
    }
  }
  s.stats.risk = Math.max(0, s.stats.risk - 26);
  s.stats.withdrawal = Math.max(0, s.stats.withdrawal - 45);
  s.stats.addiction = Math.max(0, s.stats.addiction - (cause === 'overdose' ? 6 : 2));
  s.stats.energy = Math.max(s.stats.energy, 52);
  s.stats.hunger = Math.max(s.stats.hunger, 48);
  s.stats.hygiene = Math.max(s.stats.hygiene, 55);
  s.stats.stress = Math.max(0, s.stats.stress - 18);
  bump(s, 'morale', cause === 'overdose' ? -8 : -3);
  life.lifeState(s).counselor = true;
  logLine(g, `Came round at ${C.name}.`, 'bad');
  return { fee, nurse: C.nurse };
}

/** Should this collapse go to the clinic rather than home? */
export function shouldTakeHimIn(s, cause = 'collapse') {
  if (!life.isHoused(s)) return true;              // no bed to send him to
  if (cause === 'overdose') return true;
  if ((s.counters.collapsed || 0) >= C.collapse.collapsesBeforeClinic) return true;
  return Math.random() < C.collapse.chance;
}

export const clinicName = C.name;
export const nurseName = C.nurse;
