/**
 * The camera's limits, as arithmetic.
 *
 * These used to be four expressions inline in the follow loop, which meant the one thing that
 * needed checking — "can the eye end up outside the room at these settings" — could only be
 * looked at with a browser. They are pure functions here so `npm test` can check every zoom
 * setting against every ceiling, and world/game3d.js just calls them.
 *
 * The rule they encode: the *arm* is the thing the player buys with the distance slider, and the
 * room gets to refuse it; the *eye height* is the thing that must never leave the room, because a
 * camera above the ceiling does not read as a wider shot, it reads as broken.
 */
import { clamp } from '../core/util.js';

/** Most rooms here were built 2.7 m to the ceiling; an area may say otherwise with `camCeil`. */
export const CEILING_DEFAULT = 2.7;

/** The highest the eye may sit in a place: under its ceiling, by a hand's width. */
export function ceilingFor(area) {
  const ceil = Number(area?.camCeil) || CEILING_DEFAULT;
  return clamp(ceil - 0.3, 1.8, 3.2);
}

/** The arm a place wants before any setting: the street's long lens, or most of a room's short side. */
export function armLength(interior, bounds) {
  if (!interior) return 4.1;
  if (!bounds) return 2.45;
  const short = Math.min(bounds.maxX - bounds.minX, bounds.maxZ - bounds.minZ);
  return clamp(short * 0.42, 1.8, 2.45);
}

/**
 * The longest arm the settings are allowed to ask for. Indoors that is 25% more than the room
 * wants — the arm then gets clipped by walls anyway, and asking for more only made the camera
 * press into them. Outdoors the distance slider keeps its full 0.7–1.4 range, as it always did.
 */
export function armMax(interior, roomArm, distMul) {
  return interior ? Math.min(roomArm * distMul, roomArm * 1.25) : roomArm * distMul;
}

/**
 * The resting eye height. Indoors, distance is spent mostly on the arm (40% of the change) and the
 * whole thing is capped by the ceiling: the old formula, 1.86 x height x distance, reached 3.7 m
 * in a 2.7 m apartment.
 */
export function eyeHeight(interior, heightMul, distMul, ceil) {
  const base = interior ? 1.86 : 2.62;
  const dist = interior ? 1 + (distMul - 1) * 0.4 : distMul;
  return Math.min(ceil, base * heightMul * dist);
}

/** How much a shortened arm lifts the eye. A room has less headroom to spend, so it lifts less. */
export function liftFor(interior, swinging) {
  return swinging ? 0.08 : interior ? 0.2 : 0.28;
}
