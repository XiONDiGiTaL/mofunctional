/** localStorage persistence with 3 slots + autosave. */
import { CONFIG } from './config.js';

const keyFor = (slot) => `${CONFIG.save.key}.s${slot}`;

export function saveGame(slot, state) {
  try {
    const payload = JSON.stringify({ ...state, savedAt: Date.now() });
    localStorage.setItem(keyFor(slot), payload);
    return true;
  } catch (e) {
    console.warn('[save] failed', e);
    return false;
  }
}

export function loadGame(slot) {
  try {
    const raw = localStorage.getItem(keyFor(slot));
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || !data.clock) return null;
    return data;
  } catch (e) {
    console.warn('[load] failed', e);
    return null;
  }
}

export function slotInfo(slot) {
  const data = loadGame(slot);
  if (!data) return null;
  return {
    slot,
    day: Math.floor(data.clock.m / 1440) + 1,
    money: data.money,
    savedAt: data.savedAt ?? null,
    ending: data.ending ?? null,
    name: `Day ${Math.floor(data.clock.m / 1440) + 1} · $${Math.round(data.money)}`,
  };
}

export function deleteSlot(slot) {
  try { localStorage.removeItem(keyFor(slot)); return true; } catch { return false; }
}

export function allSlots() {
  return Array.from({ length: CONFIG.save.slots }, (_, i) => slotInfo(i + 1));
}

export const AUTOSAVE_SLOT = 'auto';

export function autosave(state) {
  return saveGame(AUTOSAVE_SLOT, state);
}

export function loadAutosave() {
  return loadGame(AUTOSAVE_SLOT);
}
