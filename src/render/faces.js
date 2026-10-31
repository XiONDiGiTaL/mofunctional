/**
 * Portraits for the HUD, phone and text threads.
 *
 * Portraits are RENDERED, not painted: each one is a close-up of the character's actual
 * low-poly head (render/heads.js wrap texture on the skull from world/characters.js), shot
 * through the same retro shader as the game, with a soft key light and faint scanlines.
 * The face in the corner of the screen is literally the face walking around the street.
 * Moods (tired, stressed, high, sick, angry) are painted over the render at the projected
 * eye and mouth positions.
 */
import * as THREE from '../../vendor/three.module.js';
import { retroUniforms } from './retro.js';
import { headTexture, faceSpec, landmark, paintPortrait } from './heads.js';
import { createMo, createAddison, createNPC, castShirt } from '../world/characters.js';
import { MO_MOODS } from './mo_moods_data.js';
import { NPC_FACES } from './npc_faces_data.js';

const PW = 96;
const PH = 128;

let renderer = null;
let scene = null;
let camera = null;
const busts = new Map();
const urlCache = new Map();

function ensure() {
  if (renderer) return;
  const canvas = document.createElement('canvas');
  canvas.width = PW; canvas.height = PH;
  renderer = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true, alpha: false });
  renderer.setPixelRatio(1);
  renderer.setSize(PW, PH, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(30, PW / PH, 0.05, 20);
}

function bust(kind) {
  if (busts.has(kind)) return busts.get(kind);
  const rig = kind === 'mo' ? createMo() : kind === 'addison' ? createAddison() : createNPC(kind);
  rig.root.visible = false;
  scene.add(rig.root);
  busts.set(kind, rig);
  return rig;
}

/** Studio light for portraits: warm key from the upper left, cool fill, neutral sky. */
const STUDIO = {
  keyTint: [1.0, 0.9, 0.76], fillTint: [0.28, 0.32, 0.42], skyTint: [0.62, 0.6, 0.56], groundTint: [0.26, 0.22, 0.2],
  headTint: [0.26, 0.25, 0.24], lightDir: [-0.55, 0.55, 0.65], fog: 0x101412,
};

function withStudio(fn) {
  const U = retroUniforms;
  const saved = {
    key: U.keyTint.value.clone(), fill: U.fillTint.value.clone(), sky: U.skyTint.value.clone(), ground: U.groundTint.value.clone(),
    head: U.headTint.value.clone(), dir: U.lightDir.value.clone(), fog: U.fogColor.value.clone(), time: U.time.value,
  };
  U.keyTint.value.setRGB(...STUDIO.keyTint); U.fillTint.value.setRGB(...STUDIO.fillTint);
  U.skyTint.value.setRGB(...STUDIO.skyTint); U.groundTint.value.setRGB(...STUDIO.groundTint);
  U.headTint.value.setRGB(...STUDIO.headTint); U.lightDir.value.set(...STUDIO.lightDir).normalize();
  U.fogColor.value.set(STUDIO.fog); U.time.value = 0;
  try { fn(); } finally {
    U.keyTint.value.copy(saved.key); U.fillTint.value.copy(saved.fill); U.skyTint.value.copy(saved.sky);
    U.groundTint.value.copy(saved.ground); U.headTint.value.copy(saved.head); U.lightDir.value.copy(saved.dir);
    U.fogColor.value.copy(saved.fog); U.time.value = saved.time;
  }
}

/** (Kept for tooling) Render the 3D bust and return {canvas, eyes:[{x,y}], mouth:{x,y}, scale} in canvas pixels. */
export function renderBust(kind) {
  ensure();
  busts.forEach((r) => { r.root.visible = false; });
  const rig = bust(kind);
  rig.root.visible = true;
  rig.root.position.set(0, 0, 0);
  rig.root.rotation.set(0, -0.12, 0); // a touch of three-quarter, like a character-select screen
  rig.root.updateMatrixWorld(true);
  const headGroup = rig.head.children[0];
  const hh = rig.headH;
  const toWorld = (p) => headGroup.localToWorld(new THREE.Vector3(p[0] * hh, p[1] * hh, p[2] * hh));
  const eyeL = toWorld(landmark('eyeL')), eyeR = toWorld(landmark('eyeR'));
  const mouth = toWorld(landmark('mouth'));
  const centre = toWorld([0, 0.46, 0]);
  camera.position.set(centre.x + 0.04, centre.y + 0.02, centre.z + 0.7);
  camera.lookAt(centre.x, centre.y - 0.012, centre.z);
  camera.updateMatrixWorld(true);

  const bg = new THREE.Color(0x2a2c2a);
  renderer.setClearColor(bg, 1);
  withStudio(() => renderer.render(scene, camera));
  rig.root.visible = false;

  const out = document.createElement('canvas');
  out.width = PW; out.height = PH;
  const ctx = out.getContext('2d');
  // backdrop: a dim concrete corridor tone, like the reference portrait
  const g = ctx.createLinearGradient(0, 0, PW, PH);
  g.addColorStop(0, '#4a4b48'); g.addColorStop(1, '#1d1e1c');
  ctx.fillStyle = g; ctx.fillRect(0, 0, PW, PH);
  // composite the render, keying out the clear colour
  const tmp = document.createElement('canvas');
  tmp.width = PW; tmp.height = PH;
  const tctx = tmp.getContext('2d');
  tctx.drawImage(renderer.domElement, 0, 0);
  const img = tctx.getImageData(0, 0, PW, PH);
  const bgImg = ctx.getImageData(0, 0, PW, PH);
  const br = Math.round(bg.r * 255), bgG = Math.round(bg.g * 255), bb = Math.round(bg.b * 255);
  for (let i = 0; i < img.data.length; i += 4) {
    const isBg = Math.abs(img.data[i] - br) < 3 && Math.abs(img.data[i + 1] - bgG) < 3 && Math.abs(img.data[i + 2] - bb) < 3;
    if (!isBg) { bgImg.data[i] = img.data[i]; bgImg.data[i + 1] = img.data[i + 1]; bgImg.data[i + 2] = img.data[i + 2]; }
  }
  ctx.putImageData(bgImg, 0, 0);

  const project = (v) => { const p = v.clone().project(camera); return { x: (p.x * 0.5 + 0.5) * PW, y: (-p.y * 0.5 + 0.5) * PH }; };
  const eL = project(eyeL), eR = project(eyeR);
  return { canvas: out, eyes: [eL, eR], mouth: project(mouth), scale: Math.abs(eR.x - eL.x) / 2 };
}

function scanlines(ctx) {
  ctx.fillStyle = 'rgba(0,0,0,0.16)';
  for (let y = 0; y < PH; y += 2) ctx.fillRect(0, y, PW, 1);
}

/* ------------------------------- moods ------------------------------- */

const MOOD_DRAW = {
  content() {},
  tired(ctx, f) {
    const s = f.scale;
    f.eyes.forEach((e) => {
      ctx.fillStyle = 'rgba(70,45,30,.8)'; // heavy lids
      ctx.fillRect(e.x - s * 0.5, e.y - s * 0.32, s, s * 0.3);
      ctx.fillStyle = 'rgba(40,25,30,.5)'; // bags
      ctx.fillRect(e.x - s * 0.45, e.y + s * 0.22, s * 0.9, s * 0.18);
    });
  },
  stressed(ctx, f) {
    const s = f.scale;
    ctx.strokeStyle = 'rgba(20,12,8,.8)'; ctx.lineWidth = Math.max(1, s * 0.12);
    f.eyes.forEach((e, i) => {
      const sd = i ? -1 : 1;
      ctx.beginPath(); ctx.moveTo(e.x - sd * s * 0.55, e.y - s * 0.62); ctx.lineTo(e.x + sd * s * 0.4, e.y - s * 0.48); ctx.stroke();
    });
    ctx.fillStyle = 'rgba(150,210,255,.75)';
    const e = f.eyes[1];
    ctx.fillRect(e.x + s * 0.9, e.y - s * 0.3, Math.max(1, s * 0.16), s * 0.4);
  },
  high(ctx, f) {
    const s = f.scale;
    f.eyes.forEach((e) => {
      ctx.fillStyle = 'rgba(210,40,30,.65)';
      ctx.fillRect(e.x - s * 0.5, e.y - s * 0.12, s, s * 0.26);
      ctx.fillStyle = 'rgba(70,40,30,.8)'; // half-lidded
      ctx.fillRect(e.x - s * 0.5, e.y - s * 0.3, s, s * 0.2);
    });
    ctx.fillStyle = 'rgba(210,120,200,.08)';
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  },
  sick(ctx, f) {
    const s = f.scale;
    ctx.fillStyle = 'rgba(120,170,140,.18)'; ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    f.eyes.forEach((e) => {
      ctx.fillStyle = 'rgba(30,20,25,.45)';
      ctx.fillRect(e.x - s * 0.5, e.y + s * 0.2, s, s * 0.22);
    });
    ctx.fillStyle = 'rgba(150,210,255,.7)';
    ctx.fillRect(f.eyes[0].x - s * 0.9, f.eyes[0].y - s * 0.6, Math.max(1, s * 0.15), s * 0.45);
    ctx.fillRect(f.eyes[1].x + s * 0.8, f.eyes[1].y - s * 0.1, Math.max(1, s * 0.15), s * 0.4);
  },
  angry(ctx, f) {
    const s = f.scale;
    ctx.strokeStyle = 'rgba(15,8,5,.9)'; ctx.lineWidth = Math.max(1, s * 0.16);
    f.eyes.forEach((e, i) => {
      const sd = i ? -1 : 1;
      ctx.beginPath(); ctx.moveTo(e.x - sd * s * 0.6, e.y - s * 0.62); ctx.lineTo(e.x + sd * s * 0.35, e.y - s * 0.32); ctx.stroke();
    });
    ctx.fillStyle = 'rgba(160,30,20,.08)'; ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  },
};

/* ------------------------------- exports ------------------------------- */

const baseCache = new Map();

/** A portrait canvas (96x120) of the character's 3D head with a mood painted over it. */
export function portraitCanvas(kind = 'mo', mood = 'content') {
  if (kind === 'mo') {
    // Mo's six moods are the owner's painted sheet, drawn as soon as the image decodes
    const c = document.createElement('canvas');
    c.width = 180; c.height = 240;
    const img = new Image();
    img.onload = () => c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    img.src = MO_MOODS[mood] || MO_MOODS.content;
    return c;
  }
  if (NPC_FACES[kind]) {
    const c = document.createElement('canvas');
    c.width = 180; c.height = 240;
    const img = new Image();
    img.onload = () => {
      const ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0);
      const ey = 240 * 0.47; // bank portraits put the eye line just below the middle
      (MOOD_DRAW[mood] || MOOD_DRAW.content)(ctx, { eyes: [{ x: 66, y: ey }, { x: 114, y: ey }], scale: 12 });
    };
    img.src = NPC_FACES[kind].portrait;
    return c;
  }
  // fallback: a painted portrait in the same style and framing as Mo's sheet
  if (!baseCache.has(kind)) baseCache.set(kind, paintPortrait(kind, castShirt(kind)));
  const f = baseCache.get(kind);
  const c = document.createElement('canvas');
  c.width = f.canvas.width; c.height = f.canvas.height;
  const ctx = c.getContext('2d');
  ctx.drawImage(f.canvas, 0, 0);
  (MOOD_DRAW[mood] || MOOD_DRAW.content)(ctx, f);
  return c;
}

/** Cached data URL, safe to drop straight into an <img> or a CSS background. */
export function portraitURL(kind = 'mo', mood = 'content') {
  if (kind === 'mo') return MO_MOODS[mood] || MO_MOODS.content;
  // the cast's faces come straight from the owner's reference bank
  if (NPC_FACES[kind] && (mood === 'content' || !MOOD_DRAW[mood])) return NPC_FACES[kind].portrait;
  const key = `${kind}|${mood}`;
  if (!urlCache.has(key)) urlCache.set(key, portraitCanvas(kind, mood).toDataURL());
  return urlCache.get(key);
}

/** The wrap-around head texture for a kind (kept for callers that want the raw face). */
export function npcFaceTexture(kind = 'kev') { return headTexture(kind); }

/** Base skin colour of a kind, as a CSS hex string. */
export function faceSkin(kind) { return faceSpec(kind).skin; }

export const MOODS = Object.keys(MOOD_DRAW);
