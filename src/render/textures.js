/** Procedural 90s-era textures, generated at low resolution with nearest filtering. */
import * as THREE from '../../vendor/three.module.js';

const cache = new Map();
let seed = 1337;
const rnd = () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};

function make(name, w, h, draw, opts = {}) {
  if (cache.has(name)) return cache.get(name);
  // painted at 2x the design size: same patterns and palette, cleaner edges and a fine grain
  // layer, so surfaces hold up at the higher internal resolution without losing the 90s look
  const S = opts.scale ?? 2;
  const c = document.createElement('canvas');
  c.width = w * S; c.height = h * S;
  const ctx = c.getContext('2d');
  ctx.save();
  ctx.scale(S, S);
  draw(ctx, w, h);
  ctx.restore();
  if (S > 1 && !opts.flat) {
    for (let i = 0; i < w * h * S * 0.9; i++) {
      const v = rnd() > 0.5 ? 255 : 0;
      ctx.fillStyle = `rgba(${v},${v},${v},0.045)`;
      ctx.fillRect(Math.floor(rnd() * w * S), Math.floor(rnd() * h * S), 1, 1);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.wrapS = t.wrapT = opts.wrap || THREE.RepeatWrapping;
  if (opts.repeat) t.repeat.set(opts.repeat[0], opts.repeat[1]);
  t.colorSpace = THREE.SRGBColorSpace;
  cache.set(name, t);
  return t;
}

function noise(ctx, w, h, amount, alpha = 0.18) {
  for (let i = 0; i < w * h * amount; i++) {
    const x = Math.floor(rnd() * w), y = Math.floor(rnd() * h);
    const v = Math.floor(rnd() * 255);
    ctx.fillStyle = `rgba(${v},${v},${v},${alpha})`;
    ctx.fillRect(x, y, 1, 1);
  }
}

function stains(ctx, w, h, color, count = 14) {
  for (let i = 0; i < count; i++) {
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.1 + rnd() * 0.22;
    const r = 2 + rnd() * (w / 6);
    ctx.beginPath();
    ctx.ellipse(rnd() * w, rnd() * h, r, r * (0.4 + rnd()), rnd() * 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

export const textures = {
  concrete: () => make('concrete', 64, 64, (c, w, h) => {
    c.fillStyle = '#6a6f66'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 90; i++) {
      c.fillStyle = rnd() > 0.5 ? '#757a70' : '#5f645c';
      const s = 1 + rnd() * 5;
      c.fillRect(rnd() * w, rnd() * h, s, s);
    }
    noise(c, w, h, 0.9, 0.09);
    stains(c, w, h, '#3c423a', 9);
    c.strokeStyle = 'rgba(40,45,40,.4)';
    c.beginPath(); c.moveTo(0, 32.5); c.lineTo(w, 32.5); c.stroke();
  }),

  wall: () => make('wall', 64, 64, (c, w, h) => {
    c.fillStyle = '#8d8a76'; c.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 4) {
      c.fillStyle = y % 8 === 0 ? 'rgba(120,116,98,.35)' : 'rgba(160,155,130,.15)';
      c.fillRect(0, y, w, 1);
    }
    stains(c, w, h, '#6d5b3f', 16);
    noise(c, w, h, 0.7, 0.1);
  }),

  wallpaper: () => make('wallpaper', 64, 64, (c, w, h) => {
    c.fillStyle = '#7c8271'; c.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 8) {
      for (let x = 0; x < w; x += 8) {
        c.fillStyle = (x + y) % 16 === 0 ? 'rgba(150,150,120,.22)' : 'rgba(90,96,84,.18)';
        c.fillRect(x + 2, y + 2, 4, 4);
      }
    }
    stains(c, w, h, '#5a4a2c', 12);
  }),

  linoleum: () => make('linoleum', 64, 64, (c, w, h) => {
    c.fillStyle = '#b9b39f'; c.fillRect(0, 0, w, h);
    for (let y = 0; y < 4; y++) {
      for (let x = 0; x < 4; x++) {
        c.fillStyle = (x + y) % 2 === 0 ? '#c3bda7' : '#a9a38f';
        c.fillRect(x * 16, y * 16, 16, 16);
      }
    }
    stains(c, w, h, '#6b5b45', 20);
    noise(c, w, h, 0.8, 0.1);
  }),

  carpet: () => make('carpet', 64, 64, (c, w, h) => {
    c.fillStyle = '#4d4436'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 500; i++) {
      c.fillStyle = rnd() > 0.5 ? '#5a5040' : '#413a2e';
      c.fillRect(rnd() * w, rnd() * h, 1, 2);
    }
    stains(c, w, h, '#2f2a21', 18);
  }),

  wood: () => make('wood', 64, 64, (c, w, h) => {
    c.fillStyle = '#6d5334'; c.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 16) {
      c.fillStyle = '#5a4329'; c.fillRect(x, 0, 2, h);
      for (let i = 0; i < 30; i++) {
        c.fillStyle = `rgba(${70 + rnd() * 40},${50 + rnd() * 30},${25 + rnd() * 20},.6)`;
        c.fillRect(x + 2 + rnd() * 13, rnd() * h, 1, 3 + rnd() * 8);
      }
    }
    noise(c, w, h, 0.5, 0.12);
  }),

  sidewalk: () => make('sidewalk', 64, 64, (c, w, h) => {
    c.fillStyle = '#8e9088'; c.fillRect(0, 0, w, h);
    c.strokeStyle = '#6e7068'; c.lineWidth = 2;
    c.strokeRect(0, 0, w, h);
    c.beginPath(); c.moveTo(0, 32); c.lineTo(w, 32); c.stroke();
    stains(c, w, h, '#4a4c46', 12);
    noise(c, w, h, 0.9, 0.08);
  }),

  asphalt: () => make('asphalt', 64, 64, (c, w, h) => {
    c.fillStyle = '#3a3d3b'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 400; i++) {
      c.fillStyle = rnd() > 0.5 ? '#454846' : '#303331';
      c.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 2, 1);
    }
    c.fillStyle = 'rgba(190,180,120,.5)';
    for (let x = 4; x < w; x += 22) c.fillRect(x, 30, 12, 2);
  }),

  brick: () => make('brick', 64, 64, (c, w, h) => {
    c.fillStyle = '#3f3330'; c.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 8) {
      const off = (y / 8) % 2 ? 8 : 0;
      for (let x = -8; x < w; x += 16) {
        c.fillStyle = `rgb(${96 + rnd() * 30},${58 + rnd() * 20},${48 + rnd() * 16})`;
        c.fillRect(x + off + 1, y + 1, 14, 6);
      }
    }
    stains(c, w, h, '#231c1a', 10);
  }),

  door: () => make('door', 64, 64, (c, w, h) => {
    c.fillStyle = '#5d4a33'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#4a3a26'; c.fillRect(3, 3, w - 6, h - 6);
    c.strokeStyle = '#33281a'; c.lineWidth = 2;
    c.strokeRect(8, 8, w - 16, 22);
    c.strokeRect(8, 36, w - 16, 20);
    c.fillStyle = '#c9b06a'; c.fillRect(48, 32, 4, 4);
    noise(c, w, h, 0.6, 0.1);
  }),

  ceiling: () => make('ceiling', 64, 64, (c, w, h) => {
    c.fillStyle = '#a8a596'; c.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 16) {
      for (let x = 0; x < w; x += 16) {
        c.fillStyle = rnd() > 0.5 ? '#b3b0a1' : '#9c9a8b';
        c.fillRect(x + 1, y + 1, 14, 14);
      }
    }
    stains(c, w, h, '#6b5a3c', 10);
  }),

  tile: () => make('tile', 64, 64, (c, w, h) => {
    c.fillStyle = '#c9d3c9'; c.fillRect(0, 0, w, h);
    c.strokeStyle = '#9fae9f'; c.lineWidth = 1;
    for (let y = 0; y < h; y += 8) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); }
    for (let x = 0; x < w; x += 8) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke(); }
    stains(c, w, h, '#6f7a68', 14);
  }),

  metal: () => make('metal', 32, 32, (c, w, h) => {
    c.fillStyle = '#7d848a'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 60; i++) {
      c.fillStyle = rnd() > 0.5 ? 'rgba(255,255,255,.12)' : 'rgba(0,0,0,.16)';
      c.fillRect(rnd() * w, rnd() * h, 2, 1);
    }
  }),

  suitWhite: () => make('suitWhite', 32, 32, (c, w, h) => {
    c.fillStyle = '#eee9dc'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 160; i++) {
      c.fillStyle = rnd() > 0.5 ? 'rgba(200,192,170,.5)' : 'rgba(255,255,248,.6)';
      c.fillRect(rnd() * w, rnd() * h, 1, 2);
    }
    c.fillStyle = 'rgba(180,170,140,.22)'; c.fillRect(0, 0, w, 2);
  }),

  gold: () => make('gold', 32, 32, (c, w, h) => {
    c.fillStyle = '#d8ab34'; c.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 4) {
      c.fillStyle = y % 8 === 0 ? 'rgba(255,240,170,.5)' : 'rgba(140,100,20,.35)';
      c.fillRect(0, y, w, 1);
    }
  }),

  shirt: () => make('shirt', 32, 32, (c, w, h) => {
    c.fillStyle = '#e4e2d8'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 120; i++) {
      c.fillStyle = rnd() > 0.5 ? 'rgba(190,188,176,.4)' : 'rgba(250,250,244,.5)';
      c.fillRect(rnd() * w, rnd() * h, 2, 1);
    }
  }),

  denim: () => make('denim', 32, 32, (c, w, h) => {
    c.fillStyle = '#3d4a5c'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 200; i++) {
      c.fillStyle = rnd() > 0.5 ? 'rgba(80,96,116,.5)' : 'rgba(30,38,50,.5)';
      c.fillRect(rnd() * w, rnd() * h, 2, 1);
    }
  }),

  skin: () => make('skin', 16, 16, (c, w, h) => {
    c.fillStyle = '#a97c56'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 40; i++) {
      c.fillStyle = rnd() > 0.5 ? 'rgba(140,96,64,.5)' : 'rgba(196,148,110,.4)';
      c.fillRect(rnd() * w, rnd() * h, 1, 1);
    }
  }),

  faceMo: () => make('faceMo', 64, 64, (c, w, h) => {
    c.fillStyle = '#a97c56'; c.fillRect(0, 0, w, h);
    // forehead shading + hairline
    c.fillStyle = '#8f6444'; c.fillRect(0, 0, w, 12);
    c.fillStyle = '#2a2118'; c.fillRect(6, 0, w - 12, 9);
    c.fillStyle = '#241c14'; c.fillRect(4, 8, 6, 4); c.fillRect(w - 10, 8, 6, 4);
    // brows
    c.fillStyle = '#241c14'; c.fillRect(14, 22, 14, 3); c.fillRect(36, 22, 14, 3);
    // eyes
    c.fillStyle = '#e8e3d5'; c.fillRect(16, 26, 11, 5); c.fillRect(37, 26, 11, 5);
    c.fillStyle = '#3a2a1c'; c.fillRect(20, 27, 4, 3); c.fillRect(40, 27, 4, 3);
    c.fillStyle = '#120e0a'; c.fillRect(21, 27, 2, 3); c.fillRect(41, 27, 2, 3);
    // nose
    c.fillStyle = '#8d6142'; c.fillRect(30, 30, 5, 12);
    c.fillStyle = '#7a5237'; c.fillRect(29, 40, 8, 3);
    // moustache + goatee
    c.fillStyle = '#1d1710'; c.fillRect(20, 45, 24, 4);
    c.fillRect(26, 49, 12, 3);
    c.fillStyle = '#241c14'; c.fillRect(24, 53, 16, 8);
    c.fillStyle = '#8f6444'; c.fillRect(28, 55, 8, 3);
    // mouth
    c.fillStyle = '#5f3a2c'; c.fillRect(26, 49, 12, 2);
    // cheek shading
    c.fillStyle = 'rgba(120,74,48,.35)'; c.fillRect(9, 31, 5, 10); c.fillRect(50, 31, 5, 10);
  }),

  faceAddison: () => make('faceAddison', 64, 64, (c, w, h) => {
    c.fillStyle = '#c9a887'; c.fillRect(0, 0, w, h);
    // grey hair + beard
    c.fillStyle = '#b9b6ad'; c.fillRect(4, 0, w - 8, 12);
    c.fillStyle = '#a9a69d'; c.fillRect(2, 10, 8, 10); c.fillRect(w - 10, 10, 8, 10);
    // brows
    c.fillStyle = '#8e8b82'; c.fillRect(14, 21, 14, 4); c.fillRect(36, 21, 14, 4);
    // eyes
    c.fillStyle = '#e9e5d8'; c.fillRect(17, 26, 10, 5); c.fillRect(37, 26, 10, 5);
    c.fillStyle = '#4a3a26'; c.fillRect(20, 27, 4, 3); c.fillRect(40, 27, 4, 3);
    c.fillStyle = '#0f0c08'; c.fillRect(21, 27, 2, 3); c.fillRect(41, 27, 2, 3);
    // nose
    c.fillStyle = '#b0906f'; c.fillRect(30, 31, 5, 11);
    // moustache + full beard
    c.fillStyle = '#b3b0a7'; c.fillRect(20, 44, 24, 5);
    c.fillRect(16, 47, 32, 12);
    c.fillStyle = '#8f8c83'; c.fillRect(22, 58, 20, 6);
    // mouth
    c.fillStyle = '#6b4536'; c.fillRect(27, 49, 10, 2);
    // crow's feet
    c.fillStyle = 'rgba(140,110,86,.4)'; c.fillRect(12, 29, 4, 2); c.fillRect(48, 29, 4, 2);
  }),

  poster: () => make('poster', 32, 48, (c, w, h) => {
    c.fillStyle = '#1d2a22'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#d8c14a'; c.fillRect(3, 3, w - 6, 12);
    c.fillStyle = '#0f1512'; c.font = 'bold 7px monospace'; c.fillText('LIVE', 5, 12);
    c.fillStyle = '#9fc9a8'; c.fillRect(3, 18, w - 6, 2);
    c.fillStyle = '#c9d8c9'; c.font = '4px monospace';
    c.fillText('THE PIT', 5, 26); c.fillText('KARAOKE', 5, 32); c.fillText('FRI 9PM', 5, 38);
    c.fillStyle = '#6b7a6b'; c.fillRect(3, 41, w - 6, 4);
  }),

  neon: () => make('neon', 64, 32, (c, w, h) => {
    c.fillStyle = '#0a0f0c'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#ff5a4a'; c.font = 'bold 15px monospace'; c.fillText('QUIK', 3, 15);
    c.fillStyle = '#5ad1ff'; c.font = 'bold 15px monospace'; c.fillText('STOP', 3, 29);
    c.fillStyle = 'rgba(255,255,255,.06)'; c.fillRect(0, 0, w, h);
  }),

  cross: () => make('cross', 32, 48, (c, w, h) => {
    c.fillStyle = '#1a1410'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#e0c169'; c.fillRect(w / 2 - 3, 6, 6, 34); c.fillRect(w / 2 - 12, 15, 24, 6);
    c.fillStyle = 'rgba(255,220,120,.25)'; c.fillRect(0, 0, w, h);
  }),

  window: () => make('window', 32, 32, (c, w, h) => {
    c.fillStyle = '#243844'; c.fillRect(0, 0, w, h);
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#4a6a78'); g.addColorStop(0.6, '#2b4048'); g.addColorStop(1, '#161f24');
    c.fillStyle = g; c.fillRect(2, 2, w - 4, h - 4);
    c.fillStyle = 'rgba(240,220,160,.35)';
    for (let i = 0; i < 6; i++) c.fillRect(4 + rnd() * 24, 6 + rnd() * 20, 1, 1);
    c.strokeStyle = '#5d5142'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(16, 2); c.lineTo(16, 30); c.moveTo(2, 16); c.lineTo(30, 16); c.stroke();
  }),

  static: () => make('static', 32, 32, (c, w, h) => {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const v = Math.floor(rnd() * 90 + 40);
        c.fillStyle = `rgb(${v},${v + 6},${v})`;
        c.fillRect(x, y, 1, 1);
      }
    }
  }),
};

export function tex(name) {
  const fn = textures[name];
  return fn ? fn() : textures.concrete();
}

let moFaceTex = null;
/**
 * Mo's actual face, taken from the art the repo supplies in assets/assets.js
 * (base64, so the texture is never CORS-tainted). Centre-cropped to a square and
 * nearest-filtered so it still reads as a 90s-era face texture.
 */
export function moFaceTexture() {
  if (moFaceTex) return moFaceTex;
  const src = (typeof window !== 'undefined' && window.MO && window.MO.ASSETS && window.MO.ASSETS.moFace) || null;
  if (!src) return tex('faceMo');
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 104; // the supplied art is a head-and-jaw crop; keep its native aspect
  const ctx = c.getContext('2d');
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.wrapS = THREE.ClampToEdgeWrapping;
  t.wrapT = THREE.ClampToEdgeWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  const img = new Image();
  img.onload = () => {
    ctx.clearRect(0, 0, 64, 104);
    // trim to the head and jaw; this texture is now the front face of the skull itself
    ctx.drawImage(img, 5, 0, img.width - 10, Math.round(img.height * 0.94), 0, 0, 64, 104);
    t.needsUpdate = true;
  };
  img.src = src;
  moFaceTex = t;
  return t;
}
