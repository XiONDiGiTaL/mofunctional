/**
 * Shop and door signs: short lines of text painted on a low-resolution canvas, nearest-filtered
 * like every other texture in the game, so a storefront name reads from across the street but
 * still sits in the same chunky 90s frame.
 */
import * as THREE from '../../vendor/three.module.js';

const cache = new Map();

/**
 * lines: [{ text, color, size, font }] top to bottom. w/h are the design size in texels; the
 * canvas is painted at 2x for clean edges, and the plane it lands on sets the world size.
 */
export function signTex(id, lines, { w = 128, h = 32, bg = '#101410', border = null, glow = null } = {}) {
  if (cache.has(id)) return cache.get(id);
  const S = 2;
  const c = document.createElement('canvas');
  c.width = w * S; c.height = h * S;
  const x = c.getContext('2d');
  x.scale(S, S);
  x.fillStyle = bg;
  x.fillRect(0, 0, w, h);
  if (border) {
    x.strokeStyle = border;
    x.lineWidth = 2;
    x.strokeRect(2, 2, w - 4, h - 4);
  }
  const total = lines.reduce((n, l) => n + (l.size || 14) * 1.12, 0);
  let y = (h - total) / 2;
  x.textAlign = 'center';
  x.textBaseline = 'top';
  for (const l of lines) {
    const size = l.size || 14;
    x.font = `${l.weight || 'bold'} ${size}px ${l.font || '"Arial Black", Impact, sans-serif'}`;
    if (glow || l.glow) {
      x.shadowColor = l.glow || glow;
      x.shadowBlur = 6;
    }
    x.fillStyle = l.color || '#f2e6c0';
    x.fillText(l.text, w / 2, y, w - 8);
    x.shadowBlur = 0;
    y += size * 1.12;
  }
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.colorSpace = THREE.SRGBColorSpace;
  cache.set(id, t);
  return t;
}
