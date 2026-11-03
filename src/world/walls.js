/**
 * The walls. Every outdoor area has places paint goes: brick between doors, the tile behind the
 * subway benches, the tunnel wall across the tracks, the low wall at the Houses, roof bulkheads,
 * shop shutters after closing, the utility boxes on the curb. Each spot holds a record in
 * `state.graffiti[areaKey]`, and the records change over a run:
 *
 *   - writers paint at night (world/incidents.js), over whatever was there;
 *   - every morning some walls pick up something new that nobody saw go up;
 *   - the city's buff crew rolls grey paint over a piece now and then (sometimes while Mo watches),
 *     and a grey patch is an invitation: the next piece usually lands right on top of it;
 *   - and everything fades, a little every day.
 *
 * The art is drawn on small canvases with nearest filtering, in the game's low-res look: throw-ups,
 * full-colour pieces with drop shadows, quick tags, stencils, stickers and photocopied posters, all
 * for invented crews and invented events. No real-world crews, gangs or artists.
 */
import * as THREE from '../../vendor/three.module.js';
import { retroMaterial, box, plane } from '../render/retro.js';
import { dayOf } from '../core/util.js';

/* ------------------------------------------------------------------ where paint goes */

// [x, z, y, rotY, w, h, kind]  kind: 'big' (pieces, throw-ups), 'small' (tags, stickers, posters,
// stencils), 'shutter' (a roll-down shutter over a closed door)
export const SPOTS = {
  street: [[-7.8, -6.42, 1.5, 0, 2.4, 1.0, 'big'], [6.6, -6.42, 1.6, 0, 2.4, 1.0, 'big'], [26.5, -6.42, 1.5, 0, 2.6, 1.1, 'big'], [-23.8, -6.42, 1.4, 0, 2.2, 1.0, 'big'],
    [-5.6, -6.42, 1.2, 0, 0.8, 0.5, 'small'], [14.4, -6.42, 1.3, 0, 0.6, 0.6, 'small'], [19.3, -6.42, 1.6, 0, 0.7, 0.5, 'small'], [-19.4, -6.42, 1.3, 0, 0.6, 0.8, 'small']],
  row: [[-16.8, -6.36, 1.5, 0, 2.4, 1.0, 'big'], [0.6, -6.36, 1.6, 0, 2.4, 1.0, 'big'], [11.0, -6.36, 1.4, 0, 2.4, 1.0, 'big'], [21.4, -6.36, 1.5, 0, 2.4, 1.0, 'big'],
    [-7.2, -6.36, 1.2, 0, 0.7, 0.5, 'small'], [4.2, -6.36, 1.3, 0, 0.6, 0.8, 'small'], [13.6, -6.36, 1.2, 0, 0.7, 0.5, 'small']],
  avenue: [[-8.0, -6.36, 1.5, 0, 2.4, 1.0, 'big'], [1.0, -6.36, 1.5, 0, 2.4, 1.0, 'big'], [-2.4, -6.36, 1.2, 0, 0.6, 0.8, 'small']],
  subway: [[-21, -3.58, 1.5, 0, 2.0, 0.8, 'big'], [-9, -3.58, 1.5, 0, 2.0, 0.8, 'big'], [3, -3.58, 1.5, 0, 2.0, 0.8, 'big'], [14, -3.58, 1.5, 0, 2.0, 0.8, 'big'],
    [-6, 8.84, 0.5, Math.PI, 3.6, 1.4, 'big'], [10, 8.84, 0.5, Math.PI, 3.6, 1.4, 'big'], [24, 8.84, 0.6, Math.PI, 3.6, 1.4, 'big'], [-5.2, -3.58, 1.3, 0, 0.6, 0.8, 'small'], [20.5, -3.58, 1.2, 0, 0.7, 0.5, 'small']],
  projects: [[-9, 8.44, 0.6, Math.PI, 2.6, 0.9, 'big'], [6, 8.44, 0.6, Math.PI, 2.6, 0.9, 'big'], [11.5, 8.44, 0.6, Math.PI, 1.0, 0.7, 'small']],
  roof1120: [[-3.38, 2.8, 1.4, Math.PI / 2, 1.8, 1.0, 'big'], [3.4, -2.18, 0.95, 0, 0.7, 0.55, 'small'], [2.0, -4.83, 0.42, 0, 2.2, 0.6, 'big']],
  roof1104: [[-3.38, 2.8, 1.4, Math.PI / 2, 1.8, 1.0, 'big'], [3.4, -2.18, 0.95, 0, 0.7, 0.55, 'small'], [-2.0, 4.83, 0.42, Math.PI, 2.2, 0.6, 'big']],
};

/** The key a wall list is kept under: the two roofs are one area id with two walls. */
export const areaKey = (s, id) => (id === 'roof' ? `roof${s.roofOf === '1104' ? '1104' : '1120'}` : id);

/* ------------------------------------------------------------------ the art */

const CREWS = ['KROME', 'SNEAK9', 'DUSTER', 'ZEPH', 'WAKE', 'TOMO', 'LUXE', 'DREAMR', 'KSB', 'NITE', 'RUBIX', 'OWLS', 'SOFA', 'MILKO', 'BENT', 'QUIZ'];
const PALETTE = [['#ff3a6a', '#ffe23a'], ['#3ad8ff', '#2a2aa8'], ['#7aff5a', '#1a6a2a'], ['#ff8a2a', '#8a1e1e'], ['#c85aff', '#ffe0ff'], ['#f2f2f2', '#1a1a1a'], ['#ffd23a', '#2a1a6a'], ['#5af2c8', '#1a3a4a']];
const POSTERS = [
  ['LOST CAT', 'ANSWERS TO "SIR"', 'REWARD: GRATITUDE'],
  ['ROOM 4 RENT', 'NO PETS NO SMOKERS', 'NO DRAMA · ASK RAE'],
  ['BLOCK PARTY', 'SAT · LOU ON THE GRILL', 'BRING A CHAIR'],
  ['OPEN MIC', "THURSDAYS · LUCIA'S", 'NO KAZOOS (AGAIN)'],
  ['MAKE $$$ FROM HOME', 'NO EXPERIENCE NEEDED', 'NO QUESTIONS PLEASE'],
  ['DJ MOOKIE', 'LIVE · FRI 10PM', 'THE BASEMENT · $5'],
  ['HAVE YOU SEEN', 'MY BICYCLE', 'IT IS BLUE · I AM SAD'],
];

function rng(seed) {
  let t = seed >>> 0;
  return () => { t = (t + 0x6d2b79f5) >>> 0; let r = Math.imul(t ^ (t >>> 15), 1 | t); r ^= r + Math.imul(r ^ (r >>> 7), 61 | r); return ((r ^ (r >>> 14)) >>> 0) / 4294967296; };
}
const rpick = (r, a) => a[Math.floor(r() * a.length)];

/** Which style a seed paints in a spot of this kind. */
export function styleFor(seed, kind) {
  const r = rng(seed * 3 + 1)();
  if (kind === 'small') return r < 0.35 ? 'sticker' : r < 0.65 ? 'poster' : r < 0.85 ? 'stencil' : 'tag';
  if (kind === 'shutter') return r < 0.6 ? 'throw' : 'piece';
  return r < 0.4 ? 'piece' : r < 0.75 ? 'throw' : r < 0.9 ? 'tag' : 'stencil';
}

/** Paint one piece onto a canvas. `age` (days) fades it into the wall. */
export function paintArt(seed, style, age = 0) {
  const r = rng(seed);
  const cv = document.createElement('canvas');
  const big = style === 'piece' || style === 'throw' || style === 'tag';
  cv.width = big ? 192 : 64;
  cv.height = big ? 80 : 64;
  const c = cv.getContext('2d');
  const W = cv.width, H = cv.height;
  const name = rpick(r, CREWS);
  const [fill, out] = rpick(r, PALETTE);
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.lineJoin = 'round';
  if (style === 'piece') {
    // a full-colour piece: a cloud behind, fat letters with a stepped 3D shadow, a gradient fill,
    // highlights, an arrow and a star
    c.fillStyle = rpick(r, ['#2a2a6a', '#1a4a3a', '#5a1a3a', '#2a2a2a']);
    c.beginPath();
    for (let i = 0; i < 9; i++) c.arc(20 + i * 19, 40 + Math.sin(i * 1.7) * 10, 22 + r() * 8, 0, Math.PI * 2);
    c.fill();
    c.font = `900 ${46 + Math.floor(r() * 8)}px Impact, "Arial Black", sans-serif`;
    c.save(); c.translate(W / 2, H / 2); c.rotate((r() - 0.5) * 0.12);
    for (let d = 6; d > 0; d--) { c.fillStyle = '#111'; c.fillText(name, d, d); }
    c.lineWidth = 6; c.strokeStyle = out; c.strokeText(name, 0, 0);
    const gr = c.createLinearGradient(0, -24, 0, 24);
    gr.addColorStop(0, fill); gr.addColorStop(0.55, '#ffffff'); gr.addColorStop(0.56, fill); gr.addColorStop(1, out);
    c.fillStyle = gr; c.fillText(name, 0, 0);
    c.restore();
    c.strokeStyle = out; c.lineWidth = 4;
    c.beginPath(); c.moveTo(150, 66); c.lineTo(182, 50); c.lineTo(176, 62); c.moveTo(182, 50); c.lineTo(170, 48); c.stroke();
    c.fillStyle = '#ffe23a'; c.font = '900 18px sans-serif'; c.fillText('✦', 18, 14);
  } else if (style === 'throw') {
    // a throw-up: two colours, fast, round, a few drips
    c.font = `900 ${44 + Math.floor(r() * 10)}px Impact, "Arial Black", sans-serif`;
    c.save(); c.translate(W / 2, H / 2 - 2); c.rotate((r() - 0.5) * 0.18);
    c.lineWidth = 12; c.strokeStyle = '#111'; c.strokeText(name, 0, 0);
    c.lineWidth = 7; c.strokeStyle = out; c.strokeText(name, 0, 0);
    c.fillStyle = fill; c.fillText(name, 0, 0);
    c.fillStyle = 'rgba(255,255,255,.55)'; c.fillRect(-70, -14, 140, 3);
    c.restore();
    c.fillStyle = fill;
    for (let i = 0; i < 6; i++) c.fillRect(30 + r() * 130, 58, 2, 6 + r() * 14);
  } else if (style === 'tag') {
    c.font = `italic 700 ${30 + Math.floor(r() * 8)}px "Brush Script MT", "Comic Sans MS", cursive`;
    c.fillStyle = fill === '#f2f2f2' ? '#1a1a1a' : fill;
    c.save(); c.translate(W / 2, H / 2 - 4); c.rotate(-0.12); c.fillText(`${name.toLowerCase()}${Math.floor(r() * 99)}`, 0, 0); c.restore();
    c.strokeStyle = c.fillStyle; c.lineWidth = 3;
    c.beginPath(); c.moveTo(40, 62); c.quadraticCurveTo(100, 48, 160, 60); c.stroke();
  } else if (style === 'stencil') {
    // one colour through a cut card: a rat, a crown, an eye, or a pigeon
    c.fillStyle = rpick(r, ['#141414', '#c81e1e', '#f2f2f2', '#2a2a8a']);
    const motif = rpick(r, ['rat', 'crown', 'eye', 'pigeon']);
    if (motif === 'rat') { c.beginPath(); c.ellipse(30, 40, 16, 9, 0, 0, Math.PI * 2); c.ellipse(48, 36, 7, 6, 0, 0, Math.PI * 2); c.fill(); c.fillRect(6, 40, 12, 2); c.beginPath(); c.arc(46, 29, 3, 0, Math.PI * 2); c.fill(); }
    if (motif === 'crown') { c.beginPath(); c.moveTo(10, 46); c.lineTo(14, 18); c.lineTo(24, 34); c.lineTo(32, 14); c.lineTo(40, 34); c.lineTo(50, 18); c.lineTo(54, 46); c.closePath(); c.fill(); }
    if (motif === 'eye') { c.beginPath(); c.ellipse(32, 32, 26, 13, 0, 0, Math.PI * 2); c.fill(); c.fillStyle = '#d8d0c0'; c.beginPath(); c.arc(32, 32, 8, 0, Math.PI * 2); c.fill(); }
    if (motif === 'pigeon') { c.beginPath(); c.ellipse(30, 38, 16, 11, -0.2, 0, Math.PI * 2); c.arc(46, 24, 7, 0, Math.PI * 2); c.fill(); c.fillRect(24, 48, 2, 8); c.fillRect(32, 48, 2, 8); }
    c.font = 'bold 9px monospace'; c.fillText(name, 32, 58);
  } else if (style === 'sticker') {
    // HELLO MY NAME IS, a tag inside it, slapped on crooked
    c.save(); c.translate(32, 32); c.rotate((r() - 0.5) * 0.5);
    c.fillStyle = '#f4f4f0'; c.fillRect(-26, -18, 52, 36);
    c.fillStyle = rpick(r, ['#c81e1e', '#2a5ad8', '#1e8a3a']); c.fillRect(-26, -18, 52, 12);
    c.fillStyle = '#ffffff'; c.font = 'bold 6px sans-serif'; c.fillText('HELLO MY NAME IS', 0, -12);
    c.fillStyle = '#111'; c.font = 'italic bold 14px cursive'; c.fillText(name.toLowerCase(), 0, 6);
    c.restore();
  } else {
    // a photocopied poster, taped, one corner torn off
    const lines = rpick(r, POSTERS);
    c.save(); c.translate(32, 32); c.rotate((r() - 0.5) * 0.12);
    c.fillStyle = '#f2eedc'; c.fillRect(-24, -30, 48, 60);
    c.fillStyle = '#d8d0b8'; c.beginPath(); c.moveTo(24, 30); c.lineTo(10, 30); c.lineTo(24, 16); c.fill();
    c.fillStyle = '#111'; c.font = 'bold 8px monospace'; c.fillText(lines[0], 0, -20);
    c.fillRect(-14, -12, 28, 18);
    c.font = '5px monospace'; c.fillText(lines[1], 0, 14); c.fillText(lines[2], 0, 22);
    c.restore();
  }
  // weather: the older it is, the more the wall comes back through it
  const fade = Math.min(0.55, age * 0.025);
  if (fade > 0) { c.globalCompositeOperation = 'destination-out'; c.fillStyle = `rgba(0,0,0,${fade})`; c.fillRect(0, 0, W, H); c.globalCompositeOperation = 'source-over'; }
  return { cv, name };
}

/** A grey buff patch: the roller marks of the city's paint over what was there. */
function buffCanvas(seed) {
  const r = rng(seed + 7);
  const cv = document.createElement('canvas');
  cv.width = 64; cv.height = 32;
  const c = cv.getContext('2d');
  const g = 120 + Math.floor(r() * 30);
  c.fillStyle = `rgb(${g},${g - 4},${g - 10})`;
  c.fillRect(2, 2, 60, 28);
  for (let i = 0; i < 7; i++) { c.fillStyle = `rgba(0,0,0,${0.04 + r() * 0.06})`; c.fillRect(2 + i * 9, 2, 6, 28); }
  return cv;
}

function canvasTex(cv) {
  const t = new THREE.CanvasTexture(cv);
  t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/**
 * A spot's paint in the world: the buff patch (if any) and the piece over it, revealed left to
 * right by `set(progress)`, and grown over by the roller with `buff(progress)`.
 */
export function wallArt(root, spot, rec, day) {
  const [x, z, y, rot = 0, w = 2.4, h = 1.0, kind = 'big'] = spot;
  const nx = Math.sin(rot), nz = Math.cos(rot);
  const group = new THREE.Group();
  root.add(group);
  const out = { group, name: null, set() {}, buff() {} };
  if (rec.patch || rec.buffed) {
    const pm = plane(w * 1.05, h * 1.1, retroMaterial(`buff_${rec.seed}`, { map: canvasTex(buffCanvas(rec.seed)), ambient: 0.8 }), [x + nx * 0.025, y, z + nz * 0.025], [0, rot, 0]);
    group.add(pm);
  }
  if (rec.buffed) return out;
  const style = rec.style || styleFor(rec.seed, kind);
  const { cv, name } = paintArt(rec.seed, style, Math.max(0, (day ?? 0) - (rec.day ?? day ?? 0)) + (rec.age0 || 0));
  out.name = name;
  const show = document.createElement('canvas');
  show.width = cv.width; show.height = cv.height;
  const t = canvasTex(show);
  const mesh = plane(w, h, retroMaterial(`graf_${rec.seed}_${rec.day || 0}`, { map: t, transparent: true, alphaTest: 0.05, ambient: 0.8 }), [x + nx * 0.045, y, z + nz * 0.045], [0, rot, 0]);
  group.add(mesh);
  out.set = (v) => {
    const c = show.getContext('2d');
    c.clearRect(0, 0, show.width, show.height);
    const ww = Math.max(0, Math.min(1, v)) * cv.width;
    if (ww > 0) c.drawImage(cv, 0, 0, ww, cv.height, 0, 0, ww, cv.height);
    t.needsUpdate = true;
  };
  // the roller: a grey band growing across, in front of the piece
  let roller = null;
  out.buff = (v) => {
    if (!roller) {
      roller = plane(1, h * 1.1, retroMaterial(`buffing_${rec.seed}`, { map: canvasTex(buffCanvas(rec.seed)), ambient: 0.8 }), [0, y, 0], [0, rot, 0]);
      group.add(roller);
    }
    const ww = Math.max(0.01, Math.min(1, v)) * w * 1.05;
    roller.scale.x = ww;
    // grows from the left edge as you face the wall
    const left = -w * 0.525 + ww / 2;
    roller.position.set(x + nx * 0.06 + Math.cos(rot) * left, y, z + nz * 0.06 - Math.sin(rot) * left);
  };
  out.set(rec.p ?? 1);
  return out;
}

/* ------------------------------------------------------------------ a run's walls */

/** The wall list for an area, seeded the first time with old, faded pieces on about half the spots. */
export function wallList(s, key) {
  s.graffiti = s.graffiti || {};
  const spots = SPOTS[key];
  if (!spots) return null;
  let list = s.graffiti[key];
  // older saves kept two pieces per area with only { i, seed, p }: they carry on as they are
  if (!list) {
    const r = rng(key.length * 7919 + key.charCodeAt(0));
    list = s.graffiti[key] = [];
    spots.forEach((sp, i) => { if (r() < 0.7) list.push({ i, seed: Math.floor(r() * 1e9), p: 1, day: 0, age0: 6 + Math.floor(r() * 14) }); });
  }
  return list;
}

/** Overnight, the walls change on their own: new paint, the buff, grey patches painted over. */
export function wallsNewDay(g, day) {
  const s = g.state;
  for (const key of Object.keys(SPOTS)) {
    const list = wallList(s, key);
    const spots = SPOTS[key];
    // a buffed patch sits a few days, then somebody takes the invitation
    for (const rec of list) if (rec.buffed && day - (rec.day || 0) > 2 && Math.random() < 0.35) Object.assign(rec, { buffed: false, patch: true, seed: Math.floor(Math.random() * 1e9), p: 1, day, age0: 0, style: null });
    // something new went up in the night that nobody saw
    if (Math.random() < 0.3) {
      const i = Math.floor(Math.random() * spots.length);
      const old = list.findIndex((r) => r.i === i);
      const rec = { i, seed: Math.floor(Math.random() * 1e9), p: 1, day, age0: 0 };
      if (old >= 0) { rec.patch = !!list[old].patch; list.splice(old, 1, rec); } else list.push(rec);
    }
    // the city got to one
    if (Math.random() < 0.12) {
      const live = list.filter((r) => !r.buffed);
      const rec = live[Math.floor(Math.random() * live.length)];
      if (rec) Object.assign(rec, { buffed: true, day });
    }
  }
}

/* ------------------------------------------------------------------ shutters and boxes */

/**
 * A roll-down shutter over a closed door, corrugated, and on most of them paint: shop owners on
 * this block stopped buffing their shutters in about 1991.
 */
export function shutter(group, x, z, w = 1.6, h = 2.4, seed = 1, rot = 0) {
  const steel = retroMaterial('shutter', { color: 0x8a8e92, ambient: 0.7 });
  const nx = Math.sin(rot), nz = Math.cos(rot);
  group.add(box(rot ? 0.04 : w, h, rot ? w : 0.04, steel, [x + nx * 0.02, h / 2, z + nz * 0.02]));
  for (let i = 0; i < Math.floor(h / 0.12); i++) group.add(box(rot ? 0.05 : w, 0.015, rot ? w : 0.05, retroMaterial('shutterRib', { color: 0x6a6e72 }), [x + nx * 0.03, 0.06 + i * 0.12, z + nz * 0.03]));
  group.add(box(rot ? 0.2 : w + 0.1, 0.2, rot ? w + 0.1 : 0.2, retroMaterial('shutterBox', { color: 0x5a5e62 }), [x + nx * 0.08, h + 0.1, z + nz * 0.08]));
  wallArt(group, [x, z + nz * 0.01, h * 0.55, rot, w * 0.95, h * 0.55, 'shutter'], { seed, p: 1, day: 0, age0: 4 + (seed % 9) }, 0);
}

/** A grey utility box on the curb, tagged on the street side. Returns its solid. */
export function utilityBox(group, x, z, seed = 1) {
  group.add(box(0.55, 1.1, 0.38, retroMaterial('ubox', { color: 0x6a7a6e, ambient: 0.7 }), [x, 0.55, z]));
  group.add(box(0.6, 0.05, 0.42, retroMaterial('uboxTop', { color: 0x4a5a4e }), [x, 1.12, z]));
  wallArt(group, [x, z + 0.19, 0.62, 0, 0.5, 0.42, 'small'], { seed, p: 1, day: 0, age0: 3 + (seed % 7) }, 0);
  return { x, z, w: 0.6, d: 0.42, h: 1.2 };
}

export const today = (s) => dayOf(s.clock.m);
