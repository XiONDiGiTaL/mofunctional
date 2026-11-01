/**
 * Save migration.
 *
 * Saves carry `v`. Every system added since v2 (life, Rolo's orders, romance, the event
 * scheduler, the clinic and its course, rent history) creates its own state lazily, so a v2 save
 * already loads; this makes that explicit and versioned, so the next breaking change has a real
 * place to go. The defaults are not restated here: each system's own state constructor fills them
 * in, which keeps one source of truth per system.
 *
 * Runs on every load, before the save is merged over a fresh state:
 *   any version  in-flight locks are cleared (they belong to a moment, not to a save)
 *   v2 → v3      every lazily-created block is created now, with its defaults
 */
import { lifeState } from './life.js';
import { dealerState } from './dealer.js';
import { romanceState } from './romance.js';
import { schedulerState } from './scheduler.js';
import { clinicState, programState } from './clinic.js';

export const SAVE_VERSION = 3;

export function migrate(data) {
  if (!data || typeof data !== 'object') return data;
  const s = data;
  const from = Number(s.v) || 1;

  // A save made mid-payment, mid-dose or mid-fall must never reload locked: these are released
  // by a timer or an animation callback that does not exist after a reload.
  s.rentLock = false;
  s.flags = { ...(s.flags || {}), consuming: false, recovering: false };

  if (from < 3) {
    lifeState(s);
    dealerState(s);
    romanceState(s);
    schedulerState(s);
    clinicState(s);
    programState(s);
    s.fridge = Array.isArray(s.fridge) ? s.fridge : [];
    s.npc = s.npc || {};
    s.counters = s.counters || {};
    s.counters.rentPaid = Number(s.counters.rentPaid) || 0;
    s.counters.rentPaidTotal = Number(s.counters.rentPaidTotal) || 0;
    if (s.bills?.rent) s.bills.rent.history = Array.isArray(s.bills.rent.history) ? s.bills.rent.history : [];
  }

  s.v = SAVE_VERSION;
  return s;
}
