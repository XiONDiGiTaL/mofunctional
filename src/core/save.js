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
    time: minuteLabel(data.clock.m),
    where: data.savedWhere || null,
    savedAt: data.savedAt ?? null,
    auto: slot === AUTOSAVE_SLOT,
    ending: data.ending ?? null,
    name: `Day ${Math.floor(data.clock.m / 1440) + 1} · $${Math.round(data.money)}`,
  };
}

const minuteLabel = (m) => {
  const mod = ((m % 1440) + 1440) % 1440;
  return `${String(Math.floor(mod / 60)).padStart(2, '0')}:${String(Math.floor(mod % 60)).padStart(2, '0')}`;
};

/** "just now" / "12 min ago" / "3 h ago" / "2 days ago" for a savedAt timestamp. */
export function saveAge(at, now = Date.now()) {
  if (!at) return 'unknown age';
  const min = Math.max(0, Math.round((now - at) / 60000));
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  if (min < 60 * 24) return `${Math.round(min / 60)} h ago`;
  const d = Math.round(min / 1440);
  return `${d} day${d === 1 ? '' : 's'} ago`;
}

/** One line for a slot: "Day 4 · 14:20 · Kestrel Street · $38 · saved 12 min ago". */
export function slotLine(info) {
  if (!info) return 'empty';
  return [`Day ${info.day}`, info.time, info.where, `$${Math.round(info.money)}`, `saved ${saveAge(info.savedAt)}`].filter(Boolean).join(' · ');
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
