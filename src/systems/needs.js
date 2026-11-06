/**
 * Needs simulation: the clock, body, dependence and risk.
 * `simulate()` is the single place time moves. Everything else calls it
 * through Game.advance().
 */
import { CONFIG } from '../core/config.js';
import { clamp, dayOf, hhmm } from '../core/util.js';
import { bump, logLine, clock, spend } from '../core/state.js';
import { onNewDay } from './economy.js';
import { checkTurningPoints, lifeNewDay } from './life.js';
import { rollEvent } from './events.js';
import { bidbayTick } from './economy.js';
import { onNewDayJob } from './jobs.js';
import { fellowshipNewDay } from './fellowship.js';
import { applyAfterglow, partnerNewDay } from './romance.js';
import { relationsNewDay } from './relations.js';
import { clinicNewDay, onRelapse } from './clinic.js';
import { sisterNewDay, sisterTick } from './sister.js';
import { healthTick } from './health.js';
import { propertyNewDay } from './market.js';
import { shopNewDay } from './shop.js';
import { tickRide } from './rides.js';
import { homeNewDay, sleepBonus } from './home.js';
import { owesNewDay } from './owes.js';
import { arcsNewDay } from './arcs.js';
import { recoveryNewDay } from './recovery.js';
import { happeningsNewDay, happeningsTick, heatSleepPenalty } from './happenings.js';
import { supplyNewDay } from './supply.js';
import { herNewDay } from '../world/herplace.js';
import { raeNewDay } from './rae.js';
import { wallsNewDay } from '../world/walls.js';
import { earlyNewDay } from './early.js';

const N = CONFIG.needs;
const S = CONFIG.substances;

export function simulate(g, minutes, ctx = {}) {
  const s = g.state;
  if (!s || s.ending) return;
  if (minutes <= 0) return;
  const totalHours = minutes / 60;
  let remaining = minutes;
  const stepSize = 10;
  let guard = 0;
  while (remaining > 0 && !s.ending && guard++ < 4000) {
    const step = Math.min(stepSize, remaining);
    remaining -= step;
    applyRates(g, step / 60, ctx);
    s.clock.m += step;

    const d = dayOf(s.clock.m);
    if (d !== s.counters.daysSurvived) {
      const prev = s.counters.daysSurvived;
      s.counters.daysSurvived = d;
      onNewDay(g, d, prev);
      onNewDayJob(g, prev);
      fellowshipNewDay(g, d);
      lifeNewDay(g, d);
      relationsNewDay(s, d);
      partnerNewDay(g, d);
      clinicNewDay(g, d);
      sisterNewDay(g, d);
      propertyNewDay(g, d);
      shopNewDay(g, d);
      homeNewDay(g, d);
      owesNewDay(g, d);
      arcsNewDay(g, d);
      recoveryNewDay(g, d);
      happeningsNewDay(g, d);
      supplyNewDay(g, d);
      herNewDay(g, d);
      raeNewDay(g, d);
      wallsNewDay(g, d);
      earlyNewDay(g, d);
      g.bus.emit('newday', d);
    }
    rollEvent(g, step / 60);
    happeningsTick(g, step / 60);
    bidbayTick(g);
    sisterTick(g);
    healthTick(g, step / 60);
    tickRide(g);
    // nothing ends the run any more; a turning point takes the moment and the day goes on
    if (checkTurningPoints(g)) return;
    // Day summary at the configurable hour
    if (clock(s).mod >= CONFIG.time.summaryAtHour * 60 && clock(s).mod < CONFIG.time.summaryAtHour * 60 + Math.max(step, 4 * 60) && s.flags.daySummaryShown !== d) {
      s.flags.daySummaryShown = d;
      g.onDaySummary?.();
    }
  }
  // Autosave
  if (s.clock.m - (s.lastSaveAt || 0) >= CONFIG.save.autosaveMinutes) {
    s.lastSaveAt = s.clock.m;
    g.autosave?.();
  }
}

function applyRates(g, hours, ctx) {
  const s = g.state;
  // the debug panel's freeze: hold the body still while a system is being tested. Time, events,
  // rides and bills all keep moving; only the need/high/withdrawal rates are held
  if (g.debugNoDrain) return;
  const st = s.stats;
  const working = !!ctx.working;
  const sleeping = !!ctx.sleeping;

  // --- energy ---
  // Running is charged here, with every other need, against the time that actually passed: the
  // frame loop only reports that he is running, so a sprint costs him hours, not ticks.
  const pounding = !!s.flags.running && !sleeping && !working;
  if (sleeping) bump(s, 'energy', -N.energy.sleeping * hours); // sleeping rate is negative => recovers
  else if (working) bump(s, 'energy', -N.energy.working * hours);
  else bump(s, 'energy', -(N.energy.awake + (pounding ? N.energy.running : 0)) * hours);

  // --- hunger ---
  const hungerRate = sleeping ? N.hunger.sleeping : working ? N.hunger.working : N.hunger.awake;
  bump(s, 'hunger', -hungerRate * hours);

  // --- hygiene ---
  const hygRate = sleeping ? N.hygiene.sleeping : working ? N.hygiene.working : N.hygiene.awake;
  bump(s, 'hygiene', -hygRate * hours);

  // --- stress ---
  let stress = N.stress.base + (working ? N.stress.working : 0);
  stress += (100 - st.energy) * N.stress.perMissingEnergy;
  stress += (100 - st.hunger) * N.stress.perMissingHunger;
  stress += (100 - st.hygiene) * N.stress.perMissingHygiene;
  if (sleeping) stress = -N.stress.soberRelief * 1.6;
  else if (st.hunger > 55 && st.energy > 45 && st.hygiene > 35) stress -= N.stress.soberRelief;
  if (s.money < 25) stress += N.stress.lowMoney;
  if (working && workingStressBonus(s) > 0) stress += workingStressBonus(s);
  bump(s, 'stress', stress * hours);

  // --- morale ---
  let morale = N.morale.base;
  if (st.stress < 35) morale += N.morale.lowStress;
  if (s.money < 20) morale += N.morale.lowFunds;
  if (working) morale += N.morale.working;
  if (sleeping) morale += 1.2;
  if (st.addiction > 55) morale -= 0.7;
  bump(s, 'morale', morale * hours);

  // --- high / dependence ---
  const now = s.clock.m;
  const sinceDose = (now - (s.high.lastDose ?? -9999)) / 60;
  if (s.high.until > now) {
    s.high.level = clamp(((s.high.until - now) / S.highDurationMinutes) * 100, 0, 100);
  } else {
    s.high.level = Math.max(0, s.high.level - 32 * hours);
  }

  const depends = st.addiction > 18;
  const threshold = S.withdrawal.startsAfterMinutes / 60 + st.tolerance * S.withdrawal.toleranceHours;
  if (depends && sinceDose > threshold) {
    // asleep, it creeps instead of climbs, and the stress waits until he is awake to feel it
    const w = 11.5 * hours * (0.55 + st.addiction / 110) * (sleeping ? 0.35 : 1);
    st.withdrawal = clamp(st.withdrawal + w);
    bump(s, 'energy', S.withdrawal.energyPerHour * hours);
    if (!sleeping) bump(s, 'stress', S.withdrawal.stressPerHour * hours * (0.5 + st.withdrawal / 140));
    bump(s, 'morale', S.withdrawal.moralePerHour * hours);
    if (st.withdrawal > S.withdrawal.collapseAt && !s.flags.collapse) {
      s.flags.collapse = true;
      collapse(g);
    }
  } else {
    st.withdrawal = clamp(st.withdrawal - 9 * hours);
    s.flags.collapse = false;
  }

  // --- overdose risk ---
  let riskDrift = 0;
  const healthy = st.hunger > 40 && st.energy > 30 && st.hygiene > 25 && st.stress < 80;
  riskDrift -= healthy ? S.risk.decayHealthy : S.risk.decayPoor;
  if (st.withdrawal > 40 && st.addiction > 55) riskDrift += S.risk.riseWithdrawal;
  if (st.hunger <= 1 || st.energy <= 1) riskDrift += S.risk.neglectRise;
  st.risk = clamp(st.risk + riskDrift * hours);

  // --- afterglow: 24 in-game hours of being unreasonably fine ---
  applyAfterglow(s);

  // --- counters ---
  if (st.stress >= N.thresholds.highStress) s.counters.stressHighHours += hours;
  if (st.morale <= 3) s.counters.moraleLowHours = (s.counters.moraleLowHours || 0) + hours;
  else s.counters.moraleLowHours = Math.max(0, (s.counters.moraleLowHours || 0) - hours * 0.5);
  if (sleeping) s.counters.sleepHours += hours;
  if (st.energy <= 0 && !sleeping && !ctx.noCollapse) {
    s.flags.collapse = true;
    collapse(g);
  }
}

function workingStressBonus(s) {
  const job = s.job;
  if (!job.employed) return 0;
  return job.strikes >= 2 ? 1.4 : job.strikes >= 1 ? 0.6 : 0;
}

function collapse(g) {
  const s = g.state;
  if (s.ending) return;
  if (s.flags.recovering) return;
  // a recovery lock: without it, a body at zero energy collapsed, woke up, and collapsed again
  // on the next tick for the rest of the night
  if (s.clock.m < (s.collapseLockUntil || 0)) return;
  s.counters.collapsed++;
  s.collapseLockUntil = s.clock.m + CONFIG.clinic.collapse.lockHours * 60;
  logLine(g, 'You black out where you stand.', 'bad');
  // the world plays the fall, fades, moves him and hands control back (src/main.js)
  if (g.collapseSequence) { g.collapseSequence('collapse'); return; }
  // headless fallback (tests, or a build without a world)
  g.toast('You black out. Somewhere, a floor accepts you.', 'bad');
  g.audio.sfx('bad');
  g.advance(4 * 60, { sleeping: true, noCollapse: true });
  if (s.ending) return;
  s.stats.energy = Math.max(s.stats.energy, 26);
  s.stats.stress = clamp(s.stats.stress + 8);
  g.toast('Four hours gone. Your back hates you.', 'bad');
}

/* ------------------------------ actions ------------------------------ */

/** Things Mo can put in his mouth that are not the fictional substances: food, drinks, smokes. */
export const isEdible = (def) => !!def && (def.kind === 'food' || def.kind === 'comfort');

/**
 * Eat (or drink, or smoke) one of `itemId`, from his pockets or from the fridge. The stats land
 * at once and the HUD bars ease up to them while the world plays him eating it.
 */
export function eat(g, itemId, from = 'inventory') {
  const s = g.state;
  const def = CONFIG.items[itemId];
  if (!isEdible(def)) return false;
  const shelf = from === 'fridge' ? (s.fridge = s.fridge || []) : s.inventory;
  const entry = shelf.find((i) => i.id === itemId && i.qty > 0);
  if (!entry) { g.toast(from === 'fridge' ? 'That shelf is empty now.' : 'Nothing left in your pockets.', 'bad'); return false; }
  entry.qty -= 1;
  if (entry.qty <= 0) {
    const rest = shelf.filter((i) => i !== entry);
    if (from === 'fridge') s.fridge = rest; else s.inventory = rest;
  }
  bump(s, 'hunger', def.hunger || 0);
  bump(s, 'energy', def.energy || 0);
  bump(s, 'morale', def.morale || 0);
  bump(s, 'hygiene', def.hygiene || 0);
  bump(s, 'stress', def.stress || 0);
  if (def.kind === 'food') s.counters.meals++;
  const verb = def.kind === 'food' ? 'Ate' : itemId === 'loosies' ? 'Smoked' : 'Drank';
  logLine(g, `${verb} ${def.name}.`, 'good');
  // a smoke is worth watching: the phone goes in the pocket first
  if (itemId === 'loosies' && g.phone?.isOpen) g.phone.close();
  g.world?.playEat?.(itemId, (name) => g.audio?.sfx?.(name));
  g.advance(def.kind === 'food' ? 15 : 8);
  if (def.kind === 'food' && s.flags.tutorial === 1) { s.flags.tutorial = 2; g.bus.emit('tutorial'); }
  return true;
}

/** Move one of `itemId` between his pockets and the fridge (to: 'fridge' | 'inventory'). */
export const fridgeCount = (s) => (s.fridge || []).reduce((n, i) => n + i.qty, 0);

/** Move one (or `qty`, or everything with qty = Infinity) between pockets and fridge. */
export function moveFood(g, itemId, to = 'fridge', qty = 1) {
  let moved = 0;
  while (moved < qty && moveOne(g, itemId, to)) moved += 1;
  return moved > 0;
}

function moveOne(g, itemId, to) {
  const s = g.state;
  s.fridge = s.fridge || [];
  // the fridge holds what a fridge holds
  if (to === 'fridge' && fridgeCount(s) >= CONFIG.fridge.capacity) return false;
  const src = to === 'fridge' ? s.inventory : s.fridge;
  const entry = src.find((i) => i.id === itemId && i.qty > 0);
  if (!entry) return false;
  entry.qty -= 1;
  const dst = to === 'fridge' ? s.fridge : s.inventory;
  const have = dst.find((i) => i.id === itemId);
  if (have) have.qty += 1; else dst.push({ id: itemId, qty: 1 });
  if (to === 'fridge') s.inventory = s.inventory.filter((i) => i.qty > 0);
  else s.fridge = s.fridge.filter((i) => i.qty > 0);
  g.audio?.sfx?.('ui');
  return true;
}

/**
 * Use one of the fictional substances. The animation comes first and the numbers come after it,
 * from inside the animation's completion callback — so the player sees Mo take it, and the item
 * is taken out of his pockets exactly once, before anything can be interrupted.
 */
export function useSubstance(g, itemId) {
  const s = g.state;
  const type = S.types[itemId];
  if (!type) return false;
  if (s.flags.consuming) { g.toast('One thing at a time.', 'info'); return false; }
  if (s.flags.recovering) { g.toast('Not now. Your hands are not listening.', 'bad'); return false; }
  if (g.world?.areaId === 'herplace' && s.visiting !== 'stephanie') { g.toast(s.visiting === 'diana' ? 'Not in Diana\'s home. She would know. She would always know.' : 'Not at Melanie\'s. She has a nose like a sniffer dog and a lease with her name on it.', 'bad'); return false; }
  const entry = s.inventory.find((i) => i.id === itemId && i.qty > 0);
  if (!entry) { g.toast('You are out. That is a fact and it is loud.', 'bad'); return false; }
  entry.qty -= 1;
  if (entry.qty <= 0) s.inventory = s.inventory.filter((i) => i !== entry);

  const style = S.useAnim?.[itemId] || 'pill';
  // the phone and any dialog go away first: the whole point is seeing him do it
  if (g.phoneOpen) g.phone?.close?.();
  if (g.modalOpen) g.modal?.close?.();
  const finish = () => { applySubstance(g, itemId); if (!type.legal) g.world?.witnessed?.(g); };
  if (g.world?.playSubstance) {
    // put the phone (or the laptop) away first, so the player watches it happen
    if (g.laptop?.isOpen) g.laptop.close();
    if (g.phone?.isOpen) g.phone.close();
    s.flags.consuming = true;
    g.world.playSubstance(itemId, style, () => { s.flags.consuming = false; finish(); });
    return true;
  }
  finish();
  return true;
}

/** Medicine: the EpiPen puts everything back at once. */
export function useMedicine(g, itemId) {
  const s = g.state;
  const entry = s.inventory.find((i) => i.id === itemId && i.qty > 0);
  if (!entry) return false;
  entry.qty -= 1;
  if (entry.qty <= 0) s.inventory = s.inventory.filter((i) => i !== entry);
  s.stats.energy = 100;
  s.stats.stress = 0;
  bump(s, 'morale', 6);
  g.advance(2);
  logLine(g, 'Used an EpiPen.', 'good');
  g.toast('Click, a sting in the thigh, and your heart kicks like a mule. Every light in the world comes on at once. Energy: all of it. Stress: none of it.', 'good');
  return true;
}

/** The effects, applied once, after the animation (or immediately when there is no world). */
function applySubstance(g, itemId) {
  const s = g.state;
  const type = S.types[itemId];
  if (!type) return false;
  if (!type.legal) onRelapse(g);
  // Dex's uncut stock: every so often the batch is wrong, on top of everything else
  if (type.badBatch && Math.random() < type.badBatch) {
    const b = S.badBatch || { risk: 12, stress: 10, morale: -6 };
    bump(s, 'risk', b.risk);
    bump(s, 'stress', b.stress);
    bump(s, 'morale', b.morale);
    logLine(g, `${type.name}: a bad batch.`, 'bad');
    g.toast('Something in it was wrong. Your heart says so, loudly.', 'bad');
  }

  const toleranceCut = clamp(1 - s.stats.tolerance * S.toleranceEffects.effectCutPerPoint, 0.35, 1);
  for (const [k, v] of Object.entries(type.effects)) {
    bump(s, k, v * (v > 0 ? toleranceCut : 1));
  }
  const riskMul = 1 + s.stats.tolerance * S.toleranceEffects.riskMultiplierPerPoint;
  bump(s, 'addiction', type.addiction * 0.9);
  bump(s, 'tolerance', type.tolerance);
  bump(s, 'risk', type.risk * riskMul);
  s.stats.withdrawal = Math.max(0, s.stats.withdrawal - (type.relief ?? 38));
  s.high.lastDose = s.clock.m;
  s.high.until = s.clock.m + S.highDurationMinutes;
  s.high.level = 100;
  s.high.kind = itemId;
  if (!type.legal) { s.counters.doses++; s.flags.firstDose = true; }
  logLine(g, type.legal ? `Smoked some ${type.name}.` : `Used ${type.name}.`, type.legal ? 'info' : 'bad');
  if (s.life) s.life.lastDoseDay = dayOf(s.clock.m);
  g.toast(`${type.name}. ${type.flavor}`, 'event');
  g.audio.sfx('dose');
  g.advance(6);

  if (s.stats.risk >= S.risk.hospitalAt && !s.flags.odScare) {
    s.flags.odScare = true;
    s.counters.overdosesScares++;
    s.stats.risk = clamp(s.stats.risk - 26);
    s.stats.energy = clamp(s.stats.energy - 20);
    g.openModal?.({
      kicker: 'PARAMEDICS',
      title: 'A Bad Fifteen Minutes',
      body: 'Your heart files a complaint. The room folds up like a chair. You come to on the bathroom floor with a boot near your head and someone asking your name twice, slowly.\n\nThey do not take you anywhere. They do not have to. The bill arrives anyway.',
      choices: [
        { label: 'Say you are fine. Everyone nods in a way that means they do not believe you.', effect: () => { bump(s, 'morale', -10); spend(g, Math.min(58, Math.max(0, s.money)), 'Paramedic call'); } },
        { label: 'Ask for help. A number gets written on a napkin.', effect: () => { bump(s, 'morale', 6); s.stats.addiction = clamp(s.stats.addiction - 6); s.flags.wantsHelp = true; } },
      ],
    });
  }
  return true;
}

export function sleep(g, hours = 7) {
  const s = g.state;
  const start = s.clock.m;
  g.advance(hours * 60, { sleeping: true, noCollapse: true });
  s.counters.sleeps = (s.counters.sleeps || 0) + 1;
  bump(s, 'energy', 4 + (sleepBonus(s) - heatSleepPenalty(s)) * hours);
  if (heatSleepPenalty(s)) g.toast('The heat sits on you all night like a second blanket. A fan would have helped.', 'bad');
  bump(s, 'stress', -6);
  logLine(g, `Slept ${hours}h.`, 'info');
  const woke = hhmm(s.clock.m);
  g.toast(`You sleep. It is ${woke}.`, 'good');
  return { start, woke };
}

export function soberUp(g) {
  const s = g.state;
  s.high.until = Math.min(s.high.until, s.clock.m);
  s.high.level = 0;
  bump(s, 'stress', 6);
  bump(s, 'morale', -4);
  g.advance(45);
  g.toast('You drink water and stare at a wall until the wall loses.', 'info');
}
