/**
 * The map: Kestrel Street, or the room Mo is standing in, drawn from the same data the world is
 * built from (world/plan.js for the street, the live area's bounds, colliders and interactions
 * for an interior), so a door on the map is where the door is.
 *
 * Two sizes from one renderer: the full map (M, or click the minimap) and a strip minimap under
 * the HUD panel. The look is a late-90s in-car/PDA map: muted blocks, chunky outlines, high-
 * contrast labels on plates, a dither of scanlines, no photographic anything.
 */
import { STREET, BUILDINGS, LANDMARKS, MEET_SPOT, building } from '../world/plan.js';
import * as dealer from '../systems/dealer.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** 16-unit glyphs, drawn in currentColor. */
const GLYPH = {
  home: '<path d="M2 8 8 3l6 5v6H2z" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M6.5 14v-4h3v4" fill="currentColor"/>',
  cart: '<path d="M1.5 3h2.3l1.7 7.5h7.2l1.6-5.5H4.6" fill="none" stroke="currentColor" stroke-width="1.7"/><circle cx="6.5" cy="13" r="1.3" fill="currentColor"/><circle cx="11.5" cy="13" r="1.3" fill="currentColor"/>',
  work: '<rect x="2" y="5.5" width="12" height="8" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M6 5.5V3.5h4v2M2 9h12" fill="none" stroke="currentColor" stroke-width="1.5"/>',
  church: '<path d="M8 1.5v13M4 5.5h8" stroke="currentColor" stroke-width="2.2"/>',
  food: '<path d="M4 2v5a2 2 0 0 0 4 0V2M6 2v12M11.5 2c-1.5 1-2 3-2 5h2v7" fill="none" stroke="currentColor" stroke-width="1.6"/>',
  alley: '<path d="M8 14V3M4 6.5 8 2.5l4 4" fill="none" stroke="currentColor" stroke-width="1.9"/>',
  board: '<rect x="2.5" y="2.5" width="11" height="8" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M5 13.5 6 10.5M11 13.5 10 10.5M5 5.5h6M5 7.8h4" stroke="currentColor" stroke-width="1.3"/>',
  bus: '<rect x="3" y="2" width="10" height="10" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M3 7.5h10M5 14v-2M11 14v-2" stroke="currentColor" stroke-width="1.6"/>',
  bench: '<path d="M2 7h12M2 10h12M4 10v4M12 10v4" stroke="currentColor" stroke-width="1.7"/>',
  trash: '<path d="M3.5 4.5h9l-1 9.5h-7zM2.5 4.5h11M6 2.5h4" fill="none" stroke="currentColor" stroke-width="1.6"/>',
  phone: '<path d="M4.5 2h7v12h-7z" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M7 11.5h2" stroke="currentColor" stroke-width="1.6"/>',
  walk: '<path d="M2 4h12M2 8h12M2 12h12" stroke="currentColor" stroke-width="1.8" stroke-dasharray="2 1.5"/>',
  door: '<path d="M4 14V2h8v12M9.5 8h.5" fill="none" stroke="currentColor" stroke-width="1.8"/>',
  rolo: '<circle cx="8" cy="5" r="3" fill="currentColor"/><path d="M2.5 15c.5-4 2.5-6 5.5-6s5 2 5.5 6z" fill="currentColor"/>',
  spot: '<circle cx="8" cy="8" r="3.4" fill="currentColor"/>',
};
const glyph = (id, x, y, size = 14, color = '#fff') =>
  `<svg x="${(x - size / 2).toFixed(1)}" y="${(y - size / 2).toFixed(1)}" width="${size}" height="${size}" viewBox="0 0 16 16" style="color:${color}" overflow="visible">${GLYPH[id] || GLYPH.spot}</svg>`;

/** A label on a dark plate, the way old nav screens kept text legible over anything. */
function plate(x, y, text, { size = 10, color = '#f2ecd6', bg = 'rgba(8,10,12,.82)', anchor = 'middle', weight = 700 } = {}) {
  const w = Math.max(14, text.length * size * 0.62 + 8);
  const x0 = anchor === 'middle' ? x - w / 2 : anchor === 'end' ? x - w : x;
  return `<g class="mapplate"><rect x="${x0.toFixed(1)}" y="${(y - size * 0.82).toFixed(1)}" width="${w.toFixed(1)}" height="${(size * 1.32).toFixed(1)}" rx="2" fill="${bg}"/>`
    + `<text x="${(x0 + w / 2).toFixed(1)}" y="${(y + size * 0.3).toFixed(1)}" text-anchor="middle" font-size="${size}" font-weight="${weight}" fill="${color}">${esc(text)}</text></g>`;
}

function moArrow(px, py, rot, s) {
  // forward is (sin rot, cos rot) in world x/z; on the map +x is right and +z is down
  const ang = (Math.atan2(Math.cos(rot), Math.sin(rot)) * 180) / Math.PI;
  return `<g transform="translate(${px.toFixed(1)} ${py.toFixed(1)})">
    <circle r="${(s * 1.25).toFixed(1)}" fill="none" stroke="#ffd24a" stroke-width="1.5" class="mapping"/>
    <g transform="rotate(${ang.toFixed(1)})"><path d="M ${s} 0 L ${-s * 0.75} ${s * 0.68} L ${-s * 0.35} 0 L ${-s * 0.75} ${-s * 0.68} Z" fill="#ffd24a" stroke="#1a1408" stroke-width="1.2"/></g>
  </g>`;
}

/* ------------------------------------------------------------------ Kestrel Street */

function streetSVG(g, { mini = false, highlight = null } = {}) {
  const S = mini ? 7.2 : 21;               // pixels per metre
  const pad = mini ? 3 : 18;
  const minX = STREET.bounds.minX - 0.6, maxX = STREET.bounds.maxX + 0.6;
  const zTop = -9.6, zBot = mini ? 3.2 : 9.8;
  const W = (maxX - minX) * S + pad * 2, H = (zBot - zTop) * S + pad * 2;
  const X = (x) => (x - minX) * S + pad;
  const Y = (z) => (z - zTop) * S + pad;
  const out = [];
  out.push(`<svg class="mapsvg" viewBox="0 0 ${W.toFixed(0)} ${H.toFixed(0)}" xmlns="http://www.w3.org/2000/svg" font-family="'Chakra Petch', 'Courier New', monospace">`);
  out.push(`<defs><pattern id="mapscan${mini ? 'm' : 'f'}" width="4" height="4" patternUnits="userSpaceOnUse"><rect width="4" height="2" fill="rgba(255,255,255,.025)"/></pattern></defs>`);
  out.push(`<rect width="100%" height="100%" fill="#121619"/>`);
  // road, curb, the yellow line, the crosswalk
  out.push(`<rect x="${X(minX)}" y="${Y(STREET.roadZ[0])}" width="${(maxX - minX) * S}" height="${(Math.min(zBot, STREET.roadZ[1]) - STREET.roadZ[0]) * S}" fill="#24272a"/>`);
  if (!mini) out.push(`<line x1="${X(minX)}" y1="${Y(5.2)}" x2="${X(maxX)}" y2="${Y(5.2)}" stroke="#a89648" stroke-width="2" stroke-dasharray="14 10"/>`);
  for (let i = 0; i < 7; i++) {
    const zx = 6.2 + i * 1.05;
    out.push(`<rect x="${X(zx - 0.26)}" y="${Y(1.45)}" width="${0.52 * S}" height="${(Math.min(zBot, 7.8) - 1.45) * S}" fill="#5c5a50"/>`);
  }
  out.push(`<rect x="${X(minX)}" y="${Y(STREET.curbZ) - 1.5}" width="${(maxX - minX) * S}" height="3" fill="#8a8a80"/>`);
  // the walk: where Mo can actually go
  out.push(`<rect x="${X(STREET.bounds.minX)}" y="${Y(-6.2)}" width="${(STREET.bounds.maxX - STREET.bounds.minX) * S}" height="${(STREET.curbZ - -6.2) * S}" fill="#3a3d3c"/>`);
  out.push(`<rect x="${X(STREET.bounds.minX)}" y="${Y(STREET.bounds.minZ)}" width="${(STREET.bounds.maxX - STREET.bounds.minX) * S}" height="${(STREET.bounds.maxZ - STREET.bounds.minZ) * S}" fill="none" stroke="rgba(255,255,255,.07)" stroke-dasharray="3 4"/>`);
  // buildings: a block per lot, its door cut into the frontage with a light in front of it
  for (const b of BUILDINGS) {
    const hot = highlight === b.id;
    const bx = X(b.x0), bw = (b.x1 - b.x0) * S, by = Y(zTop + 0.2), bh = (-6.35 - (zTop + 0.2)) * S;
    out.push(`<rect x="${bx}" y="${by}" width="${bw}" height="${bh}" fill="${b.open ? '#1c2024' : b.color}" opacity="${b.open ? 1 : hot ? 1 : 0.78}" stroke="${hot ? '#ffd24a' : '#0a0c0d'}" stroke-width="${hot ? 3 : 2}"/>`);
    if (!b.open) out.push(`<rect x="${bx}" y="${by}" width="${bw}" height="${bh}" fill="url(#mapscan${mini ? 'm' : 'f'})"/>`);
    const dx = X(b.door);
    const enter = b.area || b.id === 'quikstop';
    if (enter) {
      out.push(`<rect x="${dx - 0.6 * S}" y="${Y(-6.5)}" width="${1.2 * S}" height="${(mini ? 0.5 : 0.45) * S}" fill="#f6e2a0"/>`);
      if (!mini) out.push(`<path d="M ${dx} ${Y(-5.0)} l -5 6 h 10 z" fill="#f6e2a0" opacity=".85"/>`);
    }
    if (mini) {
      out.push(glyph(b.icon, X((b.x0 + b.x1) / 2), Y(-8.1), 11, hot ? '#ffd24a' : '#f2ecd6'));
    } else {
      out.push(glyph(b.icon, X((b.x0 + b.x1) / 2), Y(-8.55), 18, '#f2ecd6'));
      out.push(plate(X((b.x0 + b.x1) / 2), Y(-7.15), b.short, { size: 11, color: hot ? '#ffd24a' : '#f2ecd6' }));
      if (enter) out.push(plate(dx, Y(-4.1), b.area ? 'DOOR' : 'COUNTER', { size: 8, color: '#1a1408', bg: '#f6e2a0' }));
    }
  }
  if (!mini) {
    for (const l of LANDMARKS) {
      if (l.z > zBot) continue;
      out.push(`<circle cx="${X(l.x)}" cy="${Y(l.z)}" r="9" fill="#1c2226" stroke="#8fb0b8" stroke-width="1.4"><title>${esc(l.name)}</title></circle>`);
      out.push(glyph(l.icon, X(l.x), Y(l.z), 12, '#cfe3e8'));
    }
    out.push(plate(X(0), Y(7.2), 'KESTREL ST', { size: 13, color: '#8a8a7a', bg: 'transparent' }));
  }
  // Rolo, if there is an order: the spot, and him on it once he is there
  const o = g?.state ? dealer.activeOrder(g.state) : null;
  if (o) {
    const waiting = o.status === 'waiting';
    out.push(`<circle cx="${X(MEET_SPOT.x)}" cy="${Y(MEET_SPOT.z)}" r="${mini ? 5 : 13}" fill="none" stroke="#9bbc0f" stroke-width="2" stroke-dasharray="${waiting ? '0' : '4 3'}" class="${waiting ? 'mapping' : ''}"/>`);
    out.push(glyph(waiting ? 'rolo' : 'spot', X(MEET_SPOT.x), Y(MEET_SPOT.z), mini ? 8 : 15, '#9bbc0f'));
    if (!mini) out.push(plate(X(MEET_SPOT.x), Y(MEET_SPOT.z) + 26, waiting ? `ROLO · ${o.id}` : `MEET ${o.id}`, { size: 9, color: '#0f380f', bg: '#9bbc0f' }));
  }
  // Mo
  const w = g?.world;
  if (w?.areaId === 'street' && w.mo) {
    const p = w.mo.root.position;
    out.push(moArrow(X(p.x), Y(p.z), w.mo.root.rotation.y, mini ? 6 : 11));
    if (!mini) out.push(plate(X(p.x), Y(p.z) + 26, 'YOU', { size: 9, color: '#1a1408', bg: '#ffd24a' }));
  }
  out.push('</svg>');
  return out.join('');
}

/* ------------------------------------------------------------------ an interior */

const AREA_NAMES = { apartment: 'Unit 3B · 1120 Kestrel St.', bodega: 'Kestrel Bodega', habibs: "Habib's Corner", church: 'The Golden Fellowship' };
const AREA_BUILDING = { apartment: 'apartment', bodega: 'bodega', habibs: 'habibs', church: 'church' };

function shortLabel(label) {
  return String(label || '')
    .replace(/^(Open|Enter|Talk to|Order from|Look in|Browse|Sit on|Read|Use|Take|Lie on|Check|Step into|Back out to|Leave)\s+(the\s+)?/i, '')
    .replace(/\.$/, '')
    .slice(0, 18);
}

function interiorSVG(g, { mini = false } = {}) {
  const w = g.world;
  const area = w.area;
  if (!area?.bounds) return '';
  const b = area.bounds;
  const S = mini ? 9 : 44;
  const pad = mini ? 6 : 34;
  const minX = b.minX - 0.6, maxX = b.maxX + 0.6, minZ = b.minZ - 0.6, maxZ = b.maxZ + 0.6;
  const Wd = (maxX - minX) * S + pad * 2, Ht = (maxZ - minZ) * S + pad * 2;
  const X = (x) => (x - minX) * S + pad;
  const Y = (z) => (z - minZ) * S + pad;
  const out = [`<svg class="mapsvg" viewBox="0 0 ${Wd.toFixed(0)} ${Ht.toFixed(0)}" xmlns="http://www.w3.org/2000/svg" font-family="'Chakra Petch', 'Courier New', monospace">`];
  out.push(`<rect width="100%" height="100%" fill="#121619"/>`);
  out.push(`<rect x="${X(minX + 0.15)}" y="${Y(minZ + 0.15)}" width="${(maxX - minX - 0.3) * S}" height="${(maxZ - minZ - 0.3) * S}" fill="#0a0c0d"/>`);
  out.push(`<rect x="${X(b.minX - 0.2)}" y="${Y(b.minZ - 0.2)}" width="${(b.maxX - b.minX + 0.4) * S}" height="${(b.maxZ - b.minZ + 0.4) * S}" fill="#3e3a33"/>`);
  for (const sd of area.solids || []) {
    out.push(`<rect x="${X(sd.x - sd.w / 2)}" y="${Y(sd.z - sd.d / 2)}" width="${sd.w * S}" height="${sd.d * S}" fill="#6a5e4c" stroke="#1a1612" stroke-width="${mini ? 1 : 2}"/>`);
  }
  for (const it of w.interactables || []) {
    const exit = /exit|door|leave/i.test(it.id) || /Back out|Leave/i.test(it.label);
    const col = exit ? '#f6e2a0' : it.id === 'dealer' ? '#9bbc0f' : '#8fd8a0';
    out.push(`<circle cx="${X(it.x)}" cy="${Y(it.z)}" r="${mini ? 2.6 : 7}" fill="${col}" stroke="#0a0c0d" stroke-width="1.5"/>`);
    if (!mini) out.push(plate(X(it.x), Y(it.z) - 13, exit ? 'EXIT' : shortLabel(it.label), { size: 9, color: exit ? '#1a1408' : '#e9f6ec', bg: exit ? '#f6e2a0' : 'rgba(8,10,12,.85)' }));
  }
  const p = w.mo.root.position;
  out.push(moArrow(X(p.x), Y(p.z), w.mo.root.rotation.y, mini ? 5 : 12));
  out.push('</svg>');
  return out.join('');
}

/* ------------------------------------------------------------------ the overlay + minimap */

let overlay = null;

export function mapTitle(g) {
  const id = g.world?.areaId;
  return id === 'street' ? 'Kestrel Street' : AREA_NAMES[id] || 'Somewhere';
}

export function renderMinimap(g) {
  const id = g.world?.areaId;
  if (!id || g.mode !== 'play') return '';
  const body = id === 'street' ? streetSVG(g, { mini: true }) : interiorSVG(g, { mini: true });
  return `<div class="minimap__head"><b>${esc(mapTitle(g))}</b><span>M · MAP</span></div>${body}`;
}

export function toggleMap(g) {
  if (overlay) { closeMap(g); return; }
  if (g.mode !== 'play') return;
  const root = document.getElementById('ui') || document.body;
  const wrap = document.createElement('div');
  wrap.className = 'mapview';
  const draw = () => {
    const id = g.world?.areaId;
    const inside = id !== 'street';
    const o = dealer.activeOrder(g.state);
    wrap.innerHTML = `
      <div class="mapview__panel" role="dialog" aria-label="Map">
        <header class="mapview__head">
          <div><span class="mapview__kicker">KESTREL NAV · v0.98</span><h2>${esc(mapTitle(g))}</h2></div>
          <button class="mapview__x" data-close aria-label="Close">×</button>
        </header>
        <div class="mapview__main">${inside ? interiorSVG(g) : streetSVG(g)}</div>
        ${inside ? `<div class="mapview__inset"><span>YOU ARE INSIDE · ${esc(building(AREA_BUILDING[id])?.short || '')}</span>${streetSVG(g, { mini: true, highlight: AREA_BUILDING[id] })}</div>` : ''}
        <footer class="mapview__legend">
          <span><i class="lg lg--mo"></i>You</span>
          <span><i class="lg lg--door"></i>Door / counter</span>
          <span><i class="lg lg--spot"></i>Point of interest</span>
          ${o ? `<span><i class="lg lg--rolo"></i>Rolo ${o.status === 'waiting' ? 'is waiting' : 'meet spot'}</span>` : ''}
          <span class="mapview__hint">M or ESC to close</span>
        </footer>
      </div>`;
  };
  draw();
  wrap.addEventListener('click', (e) => { if (e.target.closest('[data-close]') || e.target === wrap) closeMap(g); });
  const onKey = (e) => {
    if (e.key === 'Escape' || e.code === 'KeyM') { e.stopImmediatePropagation(); e.preventDefault(); closeMap(g); }
  };
  window.addEventListener('keydown', onKey, true);
  root.appendChild(wrap);
  overlay = { wrap, onKey };
  g.overlayOpen = true;
  g.onModalOpenChange?.(true);
  g.audio?.sfx?.('ui');
}

export function closeMap(g) {
  if (!overlay) return;
  window.removeEventListener('keydown', overlay.onKey, true);
  overlay.wrap.remove();
  overlay = null;
  g.overlayOpen = false;
  g.onModalOpenChange?.(false);
  g.audio?.sfx?.('ui-back');
}
