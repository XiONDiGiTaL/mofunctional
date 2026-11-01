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
 *   v3 → v4      LonelyFans and the bribes/crooked-cop bookkeeping, plus the partner fields the
 *                heartbreak rules read. Additive only: an old save keeps every relationship it
 *                had, and a partner who was never heartbroken stays that way.
 */
import { lifeState } from './life.js';
import { dealerState } from './dealer.js';
import { romanceState, PARTNER_KEYS } from './romance.js';
import { schedulerState } from './scheduler.js';
import { clinicState, programState } from './clinic.js';
import { policeState } from './police.js';
import { fansState } from './fans.js';

export const SAVE_VERSION = 4;

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

  if (from < 4) {
    fansState(s);
    policeState(s);
    // one live-in, as it always was; nobody becomes heartbroken retroactively
    const r = romanceState(s);
    for (const id of PARTNER_KEYS) {
      const p = r.partners[id];
      p.heartbroken = !!p.heartbroken;
      p.blocked = !!p.blocked;
      p.reconciling = !!p.reconciling;
      if (!Number.isFinite(Number(p.mood)) || p.mood === undefined) p.mood = p.heartbroken ? 10 : 50;
    }
    s.fans = s.fans || {};
    s.police = s.police || {};
  }

  s.v = SAVE_VERSION;
  return s;
}
