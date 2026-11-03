/**
 * Television, and MeTube: short looping animations drawn on a small canvas, the same drawings for
 * Unit 3B's screen in the world (a CanvasTexture, redrawn while the TV is on), the TV overlay
 * with its channel buttons, and the MeTube player. Every clip is a few seconds of something
 * stupid, on a loop, at 96 x 54, which is what television was.
 */
import * as THREE from '../../vendor/three.module.js';
import { bump } from '../core/state.js';
import { pick } from '../core/util.js';
import { homeState } from '../systems/home.js';

const W = 96, H = 54;
const px = (c, x, y, w, h, col) => { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
const txt = (c, s, x, y, col, size = 6, align = 'left') => { c.fillStyle = col; c.font = `bold ${size}px monospace`; c.textAlign = align; c.textBaseline = 'top'; c.fillText(s, x, y); };
const person = (c, x, y, shirt, skin = '#c8946a', s = 1) => {
  px(c, x - 4 * s, y - 14 * s, 8 * s, 8 * s, skin);
  px(c, x - 6 * s, y - 6 * s, 12 * s, 10 * s, shirt);
  px(c, x - 5 * s, y + 4 * s, 4 * s, 7 * s, '#2a2a3a');
  px(c, x + 1 * s, y + 4 * s, 4 * s, 7 * s, '#2a2a3a');
};

const TICKER = 'PIGEON ELECTED TO COMMUNITY BOARD · MAN SURPRISED BY OWN RENT · LOCAL CAT DECLINES INTERVIEW · Y2K "PROBABLY FINE" SAYS EXPERT · METS LOSE AGAIN · ';

/** Every clip: a name and a draw(c, t) for t in seconds. Channels and MeTube both use these. */
export const CLIPS = {
  news: { name: 'KESTREL 11 NEWS', draw(c, t) {
    px(c, 0, 0, W, H, '#1a2a5a'); px(c, 0, 34, W, 20, '#0a1430');
    person(c, 30, 30, '#2a2a3a', '#d8a888', 1.4);
    px(c, 26, 18 + (Math.sin(t * 9) > 0.6 ? 1 : 0), 8, 1, '#5a2a2a');
    px(c, 52, 8, 38, 22, '#3a5a9a'); txt(c, 'LIVE', 55, 10, '#ff4a4a', 6); txt(c, 'BREAKING', 55, 18, '#ffffff', 6);
    px(c, 0, 44, W, 10, '#c81e1e');
    const off = (t * 22) % (TICKER.length * 4);
    txt(c, TICKER + TICKER, 2 - off, 46, '#ffffff', 6);
  } },
  shop: { name: 'HOME SHOPPING', draw(c, t) {
    px(c, 0, 0, W, H, '#3a0a4a');
    const a = t * 3;
    px(c, 28 + Math.cos(a) * 8, 14, 6 + Math.abs(Math.sin(a)) * 18, 22, '#40c8e8');
    px(c, 30, 36, 20, 4, '#e8e8e8');
    txt(c, 'MIRACLE MOP', 60, 8, '#ffe23a', 6); txt(c, '$19.99', 60, 18, Math.floor(t * 3) % 2 ? '#ffffff' : '#ff5ab0', 9);
    txt(c, 'CALL NOW!!!', 60, 34, '#3aff8a', 6); txt(c, '1-800-MOP-IT', 58, 44, '#ffffff', 5);
  } },
  nature: { name: 'ANIMAL PLANNET', draw(c, t) {
    px(c, 0, 0, W, H, '#8ab0d8'); px(c, 0, 36, W, 18, '#6a6a6a');
    const x = ((t * 14) % (W + 20)) - 10;
    const hop = Math.abs(Math.sin(t * 8)) * 2;
    px(c, x, 26 - hop, 12, 8, '#8a8a92'); px(c, x + 9, 22 - hop, 6, 6, '#6a6a7a'); px(c, x + 15, 24 - hop, 3, 2, '#e8a03a');
    px(c, x + 3, 34 - hop, 1, 3, '#e8a03a'); px(c, x + 7, 34 - hop, 1, 3, '#e8a03a');
    px(c, 0, 44, W, 10, 'rgba(0,0,0,.6)'); txt(c, '"The urban pigeon. Fearless. Rude."', 48, 46, '#ffffff', 5, 'center');
  } },
  cook: { name: 'CHEF PEPE COOKS', draw(c, t) {
    px(c, 0, 0, W, H, '#e8d8b0'); px(c, 0, 38, W, 16, '#8a5a3a');
    px(c, 30, 34, 36, 4, '#2a2a2a'); px(c, 64, 35, 18, 2, '#2a2a2a');
    const y = 30 - Math.abs(Math.sin(t * 2.4)) * 24, flip = Math.sin(t * 2.4 * 2);
    px(c, 40, y, 14, 4 + flip * 2, '#ffffff'); px(c, 45, y + 1, 4, 3, '#ffc82a');
    person(c, 16, 28, '#ffffff', '#c8946a', 1.2); px(c, 11, 6, 10, 6, '#ffffff');
    txt(c, Math.floor(t) % 4 < 2 ? 'BAM!' : 'OLE!', 72, 10, '#c81e1e', 9);
  } },
  wrestling: { name: 'MONDAY MAYHEM', draw(c, t) {
    px(c, 0, 0, W, H, '#0a0a12'); px(c, 8, 30, 80, 16, '#2a6ac8'); for (const y of [24, 28]) px(c, 8, y, 80, 1, '#e8e8e8');
    const ph = (t * 1.2) % 2;
    const jump = ph < 1 ? Math.sin(ph * Math.PI) * 20 : 0;
    person(c, 34, 30 - jump, '#c81e1e', '#c8946a', 1.2);
    person(c, 60, 30 - (ph >= 1 ? 0 : 0), '#1a1a1a', '#8a5a3a', 1.2);
    if (ph > 0.95 && ph < 1.15) txt(c, 'SLAM!!', 48, 4, '#ffe23a', 10, 'center');
    txt(c, 'MAIN EVENT', 4, 46, '#ffffff', 5);
  } },
  cartoon: { name: 'ROACH & MOUSE', draw(c, t) {
    px(c, 0, 0, W, H, '#ffd85a'); px(c, 0, 40, W, 14, '#c86a3a');
    const x = ((t * 30) % (W + 40)) - 20;
    px(c, x, 34, 8, 5, '#5a3a1a'); px(c, x + 8, 35, 3, 3, '#3a2a1a');
    px(c, x - 20, 30, 12, 9, '#9a9a9a'); px(c, x - 10, 28, 5, 5, '#b8b8b8'); px(c, x - 22, 34, 3, 1, '#9a9a9a');
    if (Math.floor(t * 4) % 2) txt(c, '!!', x - 16, 18, '#c81e1e', 7);
  } },
  soap: { name: 'ALL MY RENT', draw(c, t) {
    px(c, 0, 0, W, H, '#5a2a3a');
    const z = 1 + (t % 4) * 0.08;
    person(c, 30, 34, '#e8c8d8', '#e0b090', 1.3 * z);
    person(c, 66, 34, '#2a2a3a', '#9a6a48', 1.3 * z);
    px(c, 0, 44, W, 10, 'rgba(0,0,0,.6)');
    txt(c, ['"You... are my landlord?"', '"I have always been your landlord."', '"*dramatic music*"'][Math.floor(t / 1.6) % 3], 48, 46, '#ffffff', 5, 'center');
  } },
  church: { name: 'BLESSED+ TV', draw(c, t) {
    px(c, 0, 0, W, H, '#3a2a0a');
    for (let i = 0; i < 6; i++) px(c, i * 18 + ((t * 10) % 18), 0, 2, H, 'rgba(255,215,90,.15)');
    person(c, 48, 32, '#f2f2ec', '#c8946a', 1.5);
    txt(c, 'GIVE NOW', 4, 4, '#ffd85a', 6); txt(c, `1-900-GOLD · $${(19.99 + Math.floor(t) * 10).toFixed(2)}`, 4, 46, '#ffffff', 5);
  } },
  static: { name: 'CHANNEL 3', draw(c) {
    for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) { const v = Math.random() * 200 + 30 | 0; px(c, x, y, 2, 2, `rgb(${v},${v},${v})`); }
  } },
  // MeTube clips
  baby: { name: 'dancing baby', draw(c, t) {
    px(c, 0, 0, W, H, '#3a3a6a'); const b = Math.sin(t * 8);
    px(c, 42 + b * 3, 12, 12, 12, '#e8b890'); px(c, 40 + b * 2, 24, 16, 14, '#f2f2f2');
    px(c, 34 + b * 6, 24 - b * 4, 6, 3, '#e8b890'); px(c, 56 + b * 6, 24 + b * 4, 6, 3, '#e8b890');
    px(c, 42, 38, 4, 8, '#e8b890'); px(c, 50, 38 - Math.max(0, b) * 4, 4, 8, '#e8b890');
  } },
  cat: { name: 'cat vs TV', draw(c, t) {
    px(c, 0, 0, W, H, '#c8b890'); px(c, 52, 20, 30, 22, '#2a2a2a'); px(c, 55, 23, 24, 15, '#4a7ab8');
    const ph = t % 3; const fall = ph > 1.8 ? (ph - 1.8) * 30 : 0;
    px(c, 58 + fall * 0.4, 12 + fall, 14, 8, '#e8862a'); px(c, 70 + fall * 0.4, 10 + fall, 6, 6, '#e8862a');
    if (ph > 2.3) txt(c, 'NOOO', 20, 10, '#c81e1e', 8);
  } },
  subway: { name: 'man vs subway doors', draw(c, t) {
    px(c, 0, 0, W, H, '#9a9aa0'); const ph = t % 3; const gap = ph < 1.5 ? 24 - ph * 14 : 3;
    px(c, 24, 8, 24 - gap / 2, 40, '#c8c8cc'); px(c, 48 + gap / 2, 8, 24 - gap / 2, 40, '#c8c8cc');
    person(c, 48, 34, '#2a6ac8', '#9a6a48', 1.1);
    if (ph > 1.5) txt(c, 'CLONK', 48, 2, '#c81e1e', 7, 'center');
  } },
  pigeon: { name: 'pigeon steals a bagel', draw(c, t) {
    px(c, 0, 0, W, H, '#8ab0d8'); px(c, 0, 38, W, 16, '#7a7a7a');
    const x = (t * 20) % (W + 30) - 20;
    px(c, x, 30, 12, 8, '#8a8a92'); px(c, x + 9, 26, 6, 6, '#6a6a7a');
    px(c, x + 14, 26, 14, 10, '#d8a050'); px(c, x + 19, 29, 4, 4, '#8ab0d8');
  } },
  hamster: { name: 'hampster dance', draw(c, t) {
    px(c, 0, 0, W, H, '#ff9ad0');
    for (let i = 0; i < 4; i++) { const b = Math.sin(t * 10 + i); px(c, 8 + i * 22, 22 + b * 4, 14, 12, '#e0b06a'); px(c, 10 + i * 22, 20 + b * 4, 3, 3, '#e0b06a'); px(c, 18 + i * 22, 20 + b * 4, 3, 3, '#e0b06a'); }
    txt(c, 'DO DO DEE DO', 48, 42, '#ffffff', 6, 'center');
  } },
  slushie: { name: 'Kev tries every slushie', draw(c, t) {
    px(c, 0, 0, W, H, '#2f6a4a'); person(c, 40, 34, '#4a4e44', '#b98a6c', 1.3);
    const col = ['#e04a8a', '#3a8ae8', '#3ae88a', '#e8e83a'][Math.floor(t) % 4];
    px(c, 48, 18, 6, 10, col); px(c, 51, 12, 1, 6, '#ffffff');
    if (t % 1 > 0.7) txt(c, 'BRAIN FREEZE', 66, 6, '#ffffff', 5, 'center');
  } },
};
export const CHANNELS = ['news', 'shop', 'nature', 'cook', 'wrestling', 'cartoon', 'soap', 'church', 'static'];
/** MeTube's thumbnail families → a clip. */
export const TUBE_CLIP = { baby: 'baby', cat: 'cat', vcr: 'shop', bunker: 'news', subway: 'subway', hamster: 'hamster', church: 'church', slushie: 'slushie', base: 'static', pigeon: 'pigeon', boat: 'soap' };

/* ------------------------------------------------------------------ the TV in the world */

let screen = null;
export function tvTexture(g) {
  if (!screen) {
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const t = new THREE.CanvasTexture(cv);
    t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter;
    t.colorSpace = THREE.SRGBColorSpace;
    screen = { cv, ctx: cv.getContext('2d'), tex: t, time: 0, acc: 0 };
  }
  drawScreen(g);
  return screen.tex;
}

function drawScreen(g) {
  const h = homeState(g.state);
  const c = screen.ctx;
  if (!h.tvOn) { px(c, 0, 0, W, H, '#0e1214'); px(c, 8, 6, 30, 3, 'rgba(255,255,255,.06)'); }
  else CLIPS[CHANNELS[h.tvCh || 0]].draw(c, screen.time);
  screen.tex.needsUpdate = true;
}

/** Called by Unit 3B's tick: the picture moves while the TV is on (at about 12 frames a second). */
export function tvTick(g, dt) {
  if (!screen || !homeState(g.state).tvOn) return;
  screen.time += dt;
  screen.acc += dt;
  if (screen.acc < 0.08) return;
  screen.acc = 0;
  drawScreen(g);
}

/* ------------------------------------------------------------------ the TV overlay, and MeTube */

function player(game, { title, clip, channels = false, onWatch }) {
  const root = document.getElementById('ui') || document.body;
  const h = homeState(game.state);
  const ov = document.createElement('div');
  ov.className = 'screen tvov';
  ov.innerHTML = `<div class="tvov__set ${channels ? '' : 'tvov__set--tube'}">
      <div class="tvov__bar"><b data-name></b><span data-ch></span></div>
      <canvas class="tvov__screen" width="${W}" height="${H}"></canvas>
      <div class="tvov__controls">
        ${channels ? '<button data-t="power">⏻ POWER</button><button data-t="prev">◀ CH</button><button data-t="next">CH ▶</button><button data-t="watch">WATCH AN HOUR</button>' : '<button data-t="replay">↻ LOOP</button>'}
        <button data-t="close">CLOSE</button>
      </div>
    </div>`;
  root.appendChild(ov);
  game.arcadeOpen = true;
  const cv = ov.querySelector('canvas');
  const c = cv.getContext('2d');
  let t = 0, last = performance.now(), raf = 0, acc = 0;
  const label = () => {
    const id = channels ? CHANNELS[h.tvCh || 0] : clip;
    ov.querySelector('[data-name]').textContent = channels ? (h.tvOn ? CLIPS[id].name : 'OFF') : title;
    ov.querySelector('[data-ch]').textContent = channels ? (h.tvOn ? `CH ${(h.tvCh || 0) + 2}` : '') : 'MeTube · RealPlayer';
  };
  const frame = (now) => {
    const dt = Math.min(0.1, (now - last) / 1000); last = now; t += dt; acc += dt;
    if (acc > 0.08) {
      acc = 0;
      if (channels && !h.tvOn) { px(c, 0, 0, W, H, '#0e1214'); }
      else CLIPS[channels ? CHANNELS[h.tvCh || 0] : clip].draw(c, t);
    }
    raf = requestAnimationFrame(frame);
  };
  const close = () => {
    cancelAnimationFrame(raf);
    ov.remove();
    window.removeEventListener('keydown', key, true);
    game.arcadeOpen = false;
    game.lastT = performance.now();
  };
  const key = (e) => { if (e.code === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); } };
  window.addEventListener('keydown', key, true);
  ov.addEventListener('click', (e) => {
    const b = e.target.closest('[data-t]');
    if (!b) return;
    const a = b.dataset.t;
    game.audio?.sfx?.('ui');
    if (a === 'close') return close();
    if (a === 'power') { h.tvOn = !h.tvOn; t = 0; }
    if (a === 'next' || a === 'prev') {
      if (!h.tvOn) h.tvOn = true;
      h.tvCh = ((h.tvCh || 0) + (a === 'next' ? 1 : CHANNELS.length - 1)) % CHANNELS.length;
      t = 0;
      game.audio?.sfx?.('phone');
    }
    if (a === 'replay') t = 0;
    if (a === 'watch') onWatch?.();
    label();
    if (screen) drawScreen(game);
  });
  label();
  raf = requestAnimationFrame(frame);
}

/** Unit 3B's TV: power, channels, and an hour gone. */
export function openTv(game) {
  const s = game.state;
  const h = homeState(s);
  if (!h.tvOn) { h.tvOn = true; h.tvCh = h.tvCh || 0; }
  player(game, {
    channels: true,
    onWatch: () => {
      game.advance(60);
      const flat = (h.owned || []).includes('tv_flat');
      bump(s, 'morale', flat ? 8 : 6);
      bump(s, 'stress', flat ? -11 : -9);
      bump(s, 'energy', -3);
      game.toast(pick({
        news: ['The pigeon on the community board gives its first speech. It is better than the last guy.'],
        shop: ['You almost buy the mop. You do not own a floor that deserves the mop.'],
        nature: ['A whole hour about pigeons. You will never look at one the same way, which is to say you will look at them now.'],
        cook: ['Chef Pepe flips the egg forty times. You make toast in your head and it helps.'],
        wrestling: ['The masked man wins. Then he loses. Then there is a chair. You are on your feet.'],
        cartoon: ['The roach wins. The roach always wins. You find this comforting for reasons you do not want to examine.'],
        soap: ['It turns out he was her landlord the whole time. You saw it coming. You still gasped.'],
        church: ['Addison asks for gold eleven times in an hour. You count. It is the most engaged you have been in church.'],
        static: ['An hour of static. Somehow it is the most relaxed you have felt all week.'],
      }[CHANNELS[h.tvCh || 0]] || ['An hour goes.']), 'good');
    },
  });
}

/** MeTube: the clip loops until he closes it. */
export function playTube(game, title, family) {
  player(game, { title, clip: TUBE_CLIP[family] || 'cat' });
}
