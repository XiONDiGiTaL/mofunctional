/**
 * The photo studio: every picture on the phone that shows a person (a LonelyFans picture, a
 * DialUpDelights thumbnail, a FeedLove selfie or post) is a shot of the game's own low-poly models,
 * posed in a little room built out of the same boxes as the world, lit by the same shader, and
 * rendered small on a second, offscreen renderer, then blown up with hard pixels, so it looks like
 * a screenshot from the game rather than a drawing from another one.
 *
 * Adult pictures keep the parody: the figure stays dressed, and a pixel mosaic goes over the chest
 * and the lap anyway, because the mosaic is the joke. HelloNurse69 never shows her face: the frame
 * stops at her chin.
 *
 * Every picture is drawn once per key and cached as a data URL.
 */
import * as THREE from '../../vendor/three.module.js';
import { retroMaterial, box, plane } from '../render/retro.js';
import { tex } from '../render/textures.js';
import { createNPC, createMo, createCat } from '../world/characters.js';

const cache = new Map();
let R = null;

function rng(seed) {
  let t = seed >>> 0;
  return () => { t = (t + 0x6d2b79f5) >>> 0; let r = Math.imul(t ^ (t >>> 15), 1 | t); r ^= r + Math.imul(r ^ (r >>> 7), 61 | r); return ((r ^ (r >>> 14)) >>> 0) / 4294967296; };
}
const pick = (r, a) => a[Math.floor(r() * a.length)];
const far = { fogNear: 300, fogFar: 600 };
const M = (name, color, extra = {}) => retroMaterial(`studio_${name}`, { color, ...far, ...extra });

function renderer() {
  if (R) return R;
  const r = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true, alpha: false });
  r.setPixelRatio(1);
  R = { r, out: document.createElement('canvas'), mos: document.createElement('canvas') };
  return R;
}

/** Render a scene at w×h and hand back a pixel-doubled JPEG data URL (with an optional mosaic). */
function shoot(scene, camera, w, h, { mosaic = [], scale = 2 } = {}) {
  const { r, out, mos } = renderer();
  r.setSize(w, h, false);
  r.setClearColor(scene.userData.bg ?? 0x202024, 1);
  r.render(scene, camera);
  out.width = w * scale; out.height = h * scale;
  const c = out.getContext('2d');
  c.imageSmoothingEnabled = false;
  c.drawImage(r.domElement, 0, 0, w * scale, h * scale);
  // the mosaic: each box is shrunk to a handful of pixels and blown back up
  for (const m of mosaic) {
    const bw = Math.max(4, Math.round(m.w * scale)), bh = Math.max(4, Math.round(m.h * scale));
    const x = Math.round(m.x * scale - bw / 2), y = Math.round(m.y * scale - bh / 2);
    mos.width = Math.max(2, Math.round(bw / 11)); mos.height = Math.max(2, Math.round(bh / 11));
    const mc = mos.getContext('2d');
    mc.imageSmoothingEnabled = false;
    mc.drawImage(out, x, y, bw, bh, 0, 0, mos.width, mos.height);
    c.drawImage(mos, 0, 0, mos.width, mos.height, x, y, bw, bh);
    // every cell a shade off its neighbours, so even a plain shirt reads as censored
    const cw = bw / mos.width, ch = bh / mos.height;
    for (let i = 0; i < mos.width; i++) for (let j = 0; j < mos.height; j++) {
      const k = ((i * 7 + j * 13) % 5) / 5;
      c.fillStyle = k < 0.5 ? `rgba(0,0,0,${0.06 + k * 0.2})` : `rgba(255,255,255,${(k - 0.4) * 0.25})`;
      c.fillRect(Math.round(x + i * cw), Math.round(y + j * ch), Math.ceil(cw), Math.ceil(ch));
    }
  }
  // a phone camera from 1999: a little murk at the corners
  const g = c.createRadialGradient(out.width / 2, out.height / 2, out.height * 0.35, out.width / 2, out.height / 2, out.height * 0.8);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.45)');
  c.fillStyle = g; c.fillRect(0, 0, out.width, out.height);
  return out.toDataURL('image/jpeg', 0.82);
}

/* ------------------------------------------------------------------ rooms */

const ROOMS = {
  bedroom(s, r) {
    wallsAndFloor(s, pick(r, [0xc8a8b8, 0xd8c8a8, 0x8aa8c8]), 0x7a5a3a);
    s.add(box(1.8, 0.45, 1.4, M('bed', pick(r, [0xe8e0f0, 0xf2e8e8, 0x3a2a4a])), [0.2, 0.22, -1.1]));
    s.add(box(1.8, 0.8, 0.1, M('headboard', 0x5a3a2a), [0.2, 0.6, -1.75]));
    s.add(plane(0.8, 0.8, { name: 'studio_win', map: tex('window'), emissive: 0.5, unlit: true, ...far }, [-1.1, 1.7, -1.78]));
  },
  bathroom(s) {
    wallsAndFloor(s, 0xc8e0e4, 0xd8e0e0, 'tile');
    s.add(box(0.9, 0.7, 0.05, M('mirror', 0xb8d0d8, { emissive: 0.3 }), [-0.6, 1.5, -1.75]));
    s.add(box(0.7, 0.18, 0.45, M('sink', 0xf2f2f0), [-0.6, 0.9, -1.55]));
  },
  neon(s, r) {
    wallsAndFloor(s, 0x1a1428, 0x141018);
    s.add(box(1.2, 0.08, 0.04, M('neon1', pick(r, [0xff3a9a, 0x3ad8ff, 0xc83aff]), { emissive: 1.2, unlit: true }), [-0.4, 1.9, -1.76]));
    s.add(box(0.08, 0.6, 0.04, M('neon2', 0xff7ad8, { emissive: 1.2, unlit: true }), [0.6, 1.6, -1.76]));
    s.userData.bg = 0x0a0812;
  },
  kitchen(s) {
    wallsAndFloor(s, 0xe8d8a8, 0x8a7a6a, 'tile');
    s.add(box(2.4, 0.9, 0.55, M('counter', 0x6a8a7a), [0, 0.45, -1.5]));
    s.add(box(2.4, 0.6, 0.35, M('cabinet', 0x6a8a7a), [0, 2.0, -1.62]));
    s.add(box(0.5, 0.3, 0.3, M('kettle', 0xc83a2a), [0.7, 1.05, -1.5]));
  },
  motel(s) {
    wallsAndFloor(s, 0xa89a6a, 0x5a3a2a, 'wallpaper');
    s.add(box(1.6, 0.4, 1.4, M('motelbed', 0x8a2a3a), [0.4, 0.2, -1.1]));
    s.add(box(0.3, 0.5, 0.3, M('lampshade', 0xfff0c0, { emissive: 0.8, unlit: true }), [-0.9, 0.95, -1.5]));
  },
  // the exam room at the Kestrel Clinic: teal wall, a muscle chart, crutches in the corner
  clinic(s) {
    wallsAndFloor(s, 0x1e9a90, 0xa07a50);
    s.add(plane(0.75, 1.0, { name: 'studio_chart', color: 0xf2eee4, ...far }, [0.65, 1.7, -1.78]));
    for (const x of [0.5, 0.8]) s.add(box(0.14, 0.62, 0.02, M('muscle', 0xc8463a), [x, 1.7, -1.765]));
    for (const dx of [0, 0.12]) s.add(box(0.03, 1.3, 0.03, M('crutch', 0xb8bcc0), [1.25 + dx, 0.65, -1.6], [0, 0, 0.08]));
    s.add(box(0.8, 0.9, 0.4, M('trolley', 0x8a9094), [-1.0, 0.45, -1.5]));
  },
  // Mo's own backdrops
  apartment(s) { wallsAndFloor(s, 0xd8d0c0, 0x7a4e2e); s.add(plane(0.9, 0.9, { name: 'studio_win2', map: tex('window'), emissive: 0.5, unlit: true, ...far }, [0.9, 1.6, -1.78])); },
  stoop(s) {
    s.userData.bg = 0x8ab0d0;
    s.add(plane(12, 8, { name: 'studio_pave', color: 0x7a7a80, ...far }, [0, 0, 0], [-Math.PI / 2, 0, 0]));
    s.add(box(6, 4, 0.3, M('brickwall', 0xc87a5a, { map: tex('brick') }), [0, 2, -2.2]));
    s.add(box(1.0, 2.1, 0.1, M('stoopdoor', 0x3a2a1e), [0.9, 1.05, -2.0]));
  },
  night(s, r) { city(s, r, 'night'); },
};

function wallsAndFloor(s, wall, floor, map = null) {
  s.add(plane(6, 6, { name: `studio_floor${floor}`, color: floor, ...(map === 'tile' ? { map: tex('tile') } : {}), ...far }, [0, 0, 0], [-Math.PI / 2, 0, 0]));
  s.add(box(6, 3, 0.1, M(`wall${wall}${map}`, wall, map ? { map: tex(map) } : {}), [0, 1.5, -1.85]));
  s.add(box(0.1, 3, 6, M(`wall${wall}${map}`, wall, map ? { map: tex(map) } : {}), [-2.2, 1.5, 0]));
}

function city(s, r, mood = 'day') {
  const sky = { day: pick(r, [0x7ab0d8, 0xd8a07a, 0x9ac0e0]), night: 0x10142a, rain: 0x2a3440 }[mood];
  s.userData.bg = sky;
  s.add(plane(60, 30, { name: 'studio_street', color: 0x4a4a50, ...far }, [0, 0, -8], [-Math.PI / 2, 0, 0]));
  for (let row = 0; row < 2; row++) {
    let x = -9;
    while (x < 9) {
      const w = 1.2 + r() * 1.8, h = 2 + r() * 6 + row * 3;
      const z = -6 - row * 5;
      s.add(box(w, h, 1.5, M(`bld${row}${Math.floor(r() * 4)}`, pick(r, [0x5a3a2e, 0x3a3a44, 0x6a4a3a, 0x2a2a34])), [x + w / 2, h / 2, z]));
      for (let wy = 0.6; wy < h - 0.4; wy += 0.7) for (let wx = x + 0.25; wx < x + w - 0.2; wx += 0.45) {
        if (r() < (mood === 'night' ? 0.45 : 0.15)) s.add(box(0.18, 0.26, 0.02, M('litwin', 0xffd77a, { emissive: 1, unlit: true }), [wx, wy, z + 0.76]));
      }
      x += w + 0.1;
    }
  }
  if (mood === 'night') s.add(new THREE.Mesh(new THREE.SphereGeometry(0.6, 8, 6), M('moon', 0xf2ecd0, { emissive: 1, unlit: true })).translateX(4).translateY(9).translateZ(-14));
  if (mood === 'rain') for (let i = 0; i < 90; i++) s.add(box(0.015, 0.4, 0.015, M('rain', 0x8ab0c8, { emissive: 0.4, unlit: true }), [(r() - 0.5) * 8, r() * 5, -1 - r() * 4], [0, 0, 0.25]));
}

/* ------------------------------------------------------------------ poses */

/** Arms and legs into a pin-up pose (the rig's joints, the same ones the world animates). */
function pose(rig, name, r) {
  const L = rig.armL, Rr = rig.armR;
  const set = (a, px, pz, ex) => { a.pivot.rotation.x = px; a.pivot.rotation.z = pz; a.elbow.rotation.x = ex; };
  set(L, 0, 0.12, -0.1); set(Rr, 0, -0.12, -0.1);
  if (name === 'selfie') { set(Rr, -2.3, -0.2, -0.5); rig.head.rotation.z = 0.12; rig.head.rotation.x = -0.1; }
  if (name === 'hips') { set(L, 0.1, -0.55, -1.5); set(Rr, 0.1, 0.55, -1.5); rig.hips.rotation.z = 0.08; rig.torso.rotation.z = -0.06; }
  if (name === 'peace') { set(Rr, -2.7, -0.15, -0.25); set(L, 0.1, -0.55, -1.5); rig.head.rotation.z = -0.12; }
  if (name === 'behind') { set(L, -2.9, 0.4, -2.1); set(Rr, -2.9, -0.4, -2.1); rig.torso.rotation.x = -0.08; }
  if (name === 'kiss') { set(Rr, -1.2, -0.3, -2.0); rig.head.rotation.x = 0.06; rig.head.rotation.z = 0.1; }
  if (name === 'cat') { set(L, -1.0, 0.35, -1.4); set(Rr, -1.0, -0.35, -1.4); }
  // weight on one leg
  if (rig.legL && r() < 0.6) { rig.legL.pivot.rotation.z = -0.08; rig.legL.pivot.rotation.x = -0.15; rig.legL.knee.rotation.x = 0.3; }
}

function project(obj, camera, w, h, dy = 0) {
  const v = new THREE.Vector3();
  obj.getWorldPosition(v);
  v.y += dy;
  v.project(camera);
  return { x: (v.x + 1) / 2 * w, y: (1 - v.y) / 2 * h };
}

/* ------------------------------------------------------------------ the shots */

/** A person in a room, posed: the LonelyFans and DialUpDelights pictures, and FeedLove selfies. */
export function personShot({ kind, room = 'bedroom', pose: p = 'hips', seed = 1, adult = false, noFace = false, w = 96, h = 128 }) {
  const key = `p|${kind}|${room}|${p}|${seed}|${adult}|${noFace}|${w}x${h}`;
  if (cache.has(key)) return cache.get(key);
  try {
    const r = rng(seed);
    const scene = new THREE.Scene();
    (ROOMS[room] || ROOMS.bedroom)(scene, r);
    const rig = kind === 'mo' ? createMo() : createNPC(kind);
    rig.root.rotation.y = (r() - 0.5) * 0.5;
    pose(rig, p, r);
    scene.add(rig.root);
    let cat = null;
    if (p === 'cat') { cat = createCat(); cat.root.scale.setScalar(0.9); cat.root.position.set(0, 0.95, 0.3); cat.root.rotation.y = 0; scene.add(cat.root); }
    if (p === 'selfie') rig.armR.elbow.add(box(0.07, 0.12, 0.015, M('phone', 0x1a1a22), [0, -0.33, 0.04]));
    const cam = new THREE.PerspectiveCamera(34, w / h, 0.05, 80);
    if (noFace) { cam.position.set(0.2, 0.78, 2.0); cam.lookAt(0, 0.72, 0); }
    else if (p === 'selfie') { cam.position.set(0.3, 1.58, 1.85); cam.lookAt(0, 1.15, 0); }
    else { cam.position.set((r() - 0.5) * 0.7, 1.15, 2.55); cam.lookAt(0, 0.98, 0); }
    scene.updateMatrixWorld(true);
    cam.updateMatrixWorld(true);
    const mosaic = adult && p !== 'cat' ? [
      { ...project(rig.torso, cam, w, h, 0.3), w: w * 0.36, h: h * 0.12 },
      { ...project(rig.hips, cam, w, h, -0.06), w: w * 0.32, h: h * 0.11 },
    ] : [];
    const url = shoot(scene, cam, w, h, { mosaic });
    cache.set(key, url);
    return url;
  } catch (e) {
    console.warn('[studio]', e);
    return '';
  }
}

/** A FeedLove post's picture with nobody in it: the city, a table with something on it, a cat, a park. */
export function sceneShot(id, seed = 1, w = 128, h = 80) {
  const key = `s|${id}|${seed}`;
  if (cache.has(key)) return cache.get(key);
  try {
    const r = rng(seed);
    const s = new THREE.Scene();
    const cam = new THREE.PerspectiveCamera(48, w / h, 0.05, 120);
    cam.position.set(0, 1.6, 4);
    cam.lookAt(0, 2.2, -6);
    const table = (top = pick(r, [0x8a5a3a, 0x3a4a5a, 0x6a4a2a])) => {
      s.userData.bg = pick(r, [0x3a2a24, 0x2a3440, 0x4a3a2a]);
      s.add(box(3, 0.1, 2, M(`table${top}`, top, { map: tex('wood') }), [0, 0.7, 0]));
      cam.position.set(0, 1.55, 1.1); cam.lookAt(0, 0.72, 0);
    };
    if (['skyline', 'building', 'church', 'store'].includes(id)) {
      city(s, r, 'day');
      if (id === 'church') { s.add(box(2.2, 3.4, 1.4, M('church', 0xd8d0b8), [0, 1.7, -3])); s.add(box(0.18, 0.9, 0.12, M('cross', 0xffd75a, { emissive: 0.8, unlit: true }), [0, 3.9, -2.3])); s.add(box(0.5, 0.12, 0.12, M('cross', 0xffd75a, { emissive: 0.8, unlit: true }), [0, 4.1, -2.3])); }
      if (id === 'store') { s.add(box(3, 2.4, 1, M('storefront', 0x2a6a4a), [0, 1.2, -2.6])); s.add(box(2.4, 0.4, 0.1, M('storesign', 0xffe23a, { emissive: 0.9, unlit: true }), [0, 2.2, -2.05])); s.add(box(1.8, 1.0, 0.05, M('storewin', 0xffe0a8, { emissive: 0.6, unlit: true }), [0, 1.0, -2.08])); }
      if (id === 'building') { s.add(box(3, 6, 1.6, M('mybld', 0x8a4a3a, { map: tex('brick') }), [0, 3, -3])); }
    } else if (id === 'night') city(s, r, 'night');
    else if (id === 'rain') city(s, r, 'rain');
    else if (id === 'park') {
      s.userData.bg = 0x8ac0e0;
      s.add(plane(40, 30, { name: 'studio_grass', color: 0x4a8a3a, ...far }, [0, 0, -6], [-Math.PI / 2, 0, 0]));
      for (let i = 0; i < 7; i++) {
        const x = (r() - 0.5) * 12, z = -3 - r() * 8;
        s.add(box(0.25, 1.6, 0.25, M('trunk', 0x5a3a24), [x, 0.8, z]));
        s.add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.9 + r() * 0.4, 0), M('leaf', pick(r, [0x3a7a3a, 0x4a8a3a, 0x5a7a2a]))).translateX(x).translateY(2.2).translateZ(z));
      }
      s.add(box(1.6, 0.1, 0.4, M('bench', 0x6a4a2a), [0.8, 0.45, -1.5]));
    } else if (id === 'cat') {
      wallsAndFloor(s, 0xc8b890, 0x6a5a4a);
      const c = createCat(); c.root.rotation.y = 0.6 + r(); s.add(c.root);
      cam.position.set(0.4, 0.7, 1.4); cam.lookAt(0, 0.25, 0);
    } else {
      table();
      const plate = () => s.add(new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.28, 0.04, 14), M('plate', 0xf2f2ec)).translateY(0.77));
      if (id === 'food') { plate(); s.add(box(0.3, 0.1, 0.22, M('food', pick(r, [0xd8a050, 0xc86a3a, 0xe8d8a0])), [0, 0.84, 0])); s.add(box(0.12, 0.08, 0.12, M('food2', 0x3a8a3a), [0.12, 0.84, 0.08])); }
      if (id === 'coffee') { s.add(new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.08, 0.2, 10), M('cup', 0xf2f2ec)).translateY(0.85)); s.add(new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.01, 10), M('coffee', 0x5a3a20)).translateY(0.95)); }
      if (id === 'beer') for (const x of [-0.15, 0.15]) s.add(new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.24, 10), M('can', pick(r, [0xc83a2a, 0x2a6ac8, 0xd8b03a]))).translateX(x).translateY(0.87));
      if (id === 'flowers') { s.add(new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.3, 10), M('vase', 0x6ab0c8)).translateY(0.9)); for (let i = 0; i < 6; i++) s.add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.07, 0), M(`bloom${i % 3}`, [0xe84a6a, 0xffd23a, 0xf2f2f2][i % 3])).translateX((r() - 0.5) * 0.3).translateY(1.15 + r() * 0.1).translateZ((r() - 0.5) * 0.2)); }
      if (id === 'papers') for (let i = 0; i < 4; i++) s.add(box(0.42, 0.01, 0.56, M('paper', 0xf4f2ea), [(r() - 0.5) * 0.4, 0.76 + i * 0.01, (r() - 0.5) * 0.3], [0, (r() - 0.5) * 0.6, 0]));
      if (id === 'shoes') for (const x of [-0.2, 0.2]) { const c = pick(r, [0xe8e8ec, 0x2a6aa8, 0xd83a2a]); s.add(box(0.16, 0.12, 0.38, M(`shoe${c}`, c), [x, 0.82, 0])); s.add(box(0.17, 0.03, 0.4, M('sole', 0xf4f4f4), [x, 0.765, 0])); }
    }
    s.updateMatrixWorld(true);
    cam.updateMatrixWorld(true);
    const url = shoot(s, cam, w, h);
    cache.set(key, url);
    return url;
  } catch (e) {
    console.warn('[studio]', e);
    return '';
  }
}
