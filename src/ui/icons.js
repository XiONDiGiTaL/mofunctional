/**
 * Item art, in the game's own look: small low-poly objects lit from the upper left, each face in
 * one of three tones (lit top, mid front, dark side), a dark outline and a soft shadow underneath,
 * so a can reads as a can on a shop board, a phone list and an inventory tile alike. Drawn on a
 * 64 unit grid from a handful of solids (box, can, cup, lying cylinder) plus a few hand paths.
 * Unknown items fall back to their kind.
 */
const O = '#1d1712'; // outline

/** Lighten (k > 0) or darken (k < 0) a #rrggbb colour. */
function tone(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.round(k > 0 ? v + (255 - v) * k : v * (1 + k)));
  return `#${ch.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}
const lit = (c) => tone(c, 0.3);
const dim = (c) => tone(c, -0.32);

const svg = (body, shadow = 21) => `<svg viewBox="0 0 64 64" aria-hidden="true" stroke="${O}" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"><ellipse cx="32" cy="57" rx="${shadow}" ry="4" fill="#000" fill-opacity=".28" stroke="none"/>${body}</svg>`;
const txt = (x, y, size, fill, t, rot = 0) => `<text x="${x}" y="${y}" font-size="${size}" font-family="'Arial Black',Impact,sans-serif" font-weight="900" text-anchor="middle" fill="${fill}" stroke="none"${rot ? ` transform="rotate(${rot} ${x} ${y})"` : ''}>${t}</text>`;
const shine = (x, y, w, h) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${w / 2}" fill="#fff" fill-opacity=".55" stroke="none"/>`;

/** A box seen from the front-left: front face, lit top, dark right side. d = depth. */
function box({ x, y, w, h, d = 8, c, top, side }) {
  const dx = d * 0.7, dy = -d * 0.55;
  return `<path d="M${x} ${y}l${dx} ${dy}h${w}l${-dx} ${-dy}z" fill="${top || lit(c)}"/>`
    + `<path d="M${x + w} ${y}l${dx} ${dy}v${h}l${-dx} ${-dy}z" fill="${side || dim(c)}"/>`
    + `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c}"/>`;
}

/** An upright cylinder (a can, a cup with straight sides). */
function can({ cx = 32, top, h, rx, ry = rx * 0.32, c, lid = '#cfd5db' }) {
  const l = cx - rx, r = cx + rx, b = top + h;
  return `<path d="M${l} ${top}v${h}a${rx} ${ry} 0 0 0 ${2 * rx} 0v${-h}z" fill="${c}"/>`
    + `<path d="M${r - rx * 0.42} ${top + ry * 0.9}v${h}a${rx} ${ry} 0 0 0 ${rx * 0.42} ${-ry * 0.95}v${-h}z" fill="${dim(c)}" stroke="none" fill-opacity=".8"/>`
    + shine(l + rx * 0.3, top + ry + 2, rx * 0.22, h - ry - 4)
    + `<path d="M${l} ${top}v${h}a${rx} ${ry} 0 0 0 ${2 * rx} 0v${-h}" fill="none"/>`
    + `<ellipse cx="${cx}" cy="${top}" rx="${rx}" ry="${ry}" fill="${lid}"/>`
    + `<ellipse cx="${cx}" cy="${top}" rx="${rx * 0.72}" ry="${ry * 0.62}" fill="none" stroke="${dim(lid)}" stroke-width="1.1"/>`
    + `<path d="M${l} ${b - 3}a${rx} ${ry} 0 0 0 ${2 * rx} 0" fill="none" stroke="${dim(c)}" stroke-width="1"/>`;
}

/** A label band wrapped round a can. */
function band({ cx = 32, y, h, rx, ry = rx * 0.32, c }) {
  return `<path d="M${cx - rx} ${y}a${rx} ${ry} 0 0 0 ${2 * rx} 0v${h}a${rx} ${ry} 0 0 1 ${-2 * rx} 0z" fill="${c}"/>`
    + `<path d="M${cx + rx * 0.58} ${y + ry * 0.8}a${rx} ${ry} 0 0 0 ${rx * 0.42} ${-ry * 0.8}v${h}a${rx} ${ry} 0 0 1 ${-rx * 0.42} ${ry * 0.8}z" fill="${dim(c)}" stroke="none" fill-opacity=".75"/>`;
}

/** A cup wider at the top than the bottom. */
function cup({ cx = 32, top, h, rt, rb, c, ry = rt * 0.3, rim = '#f4efe2', fillTop = null }) {
  const b = top + h;
  return `<path d="M${cx - rt} ${top}L${cx - rb} ${b}a${rb} ${ry * rb / rt} 0 0 0 ${2 * rb} 0L${cx + rt} ${top}z" fill="${c}"/>`
    + `<path d="M${cx + rt * 0.55} ${top + ry}L${cx + rb * 0.55} ${b + ry * 0.7}a${rb} ${ry * rb / rt} 0 0 0 ${rb * 0.45} ${-ry * 0.7}L${cx + rt} ${top}z" fill="${dim(c)}" stroke="none" fill-opacity=".7"/>`
    + `<path d="M${cx - rt * 0.62} ${top + ry + 2}L${cx - rb * 0.62} ${b - 2}" stroke="#fff" stroke-opacity=".55" stroke-width="2.4"/>`
    + `<ellipse cx="${cx}" cy="${top}" rx="${rt}" ry="${ry}" fill="${rim}"/>`
    + (fillTop ? `<ellipse cx="${cx}" cy="${top + 0.6}" rx="${rt - 2.4}" ry="${ry - 1.2}" fill="${fillTop}"/>` : '');
}

/** A cylinder lying on its side from x1 to x2 (a cigarette, a roll of mints, a battery). */
function roll({ x1, x2, cy, r, c, end = null }) {
  return `<path d="M${x1} ${cy - r}H${x2}a${r * 0.45} ${r} 0 0 1 0 ${2 * r}H${x1}z" fill="${c}"/>`
    + `<rect x="${x1 + 1}" y="${cy - r * 0.6}" width="${x2 - x1 - 2}" height="${r * 0.35}" fill="#fff" fill-opacity=".5" stroke="none"/>`
    + `<rect x="${x1 + 1}" y="${cy + r * 0.35}" width="${x2 - x1 - 2}" height="${r * 0.5}" fill="${dim(c)}" fill-opacity=".6" stroke="none"/>`
    + `<ellipse cx="${x1}" cy="${cy}" rx="${r * 0.45}" ry="${r}" fill="${end || lit(c)}"/>`;
}

const steam = (xs, y = 12) => xs.map((x) => `<path d="M${x} ${y + 8}c-3-3 3-5 0-8s3-5 0-8" fill="none" stroke="#e8e8e8" stroke-opacity=".8" stroke-width="2"/>`).join('');
const paper = (c = '#b98c5a') => `<path d="M8 46l20-10 28 6-20 12z" fill="${c}"/><path d="M8 46l28 8 20-12" fill="none" stroke="${dim(c)}" stroke-width="1"/>`;
const foam = (x, y, w, h, d) => box({ x, y, w, h, d, c: '#e9e6dd', top: '#f8f6f0', side: '#c9c4b6' });

const ART = {
  /* ---------------------------------------------------------------- food */
  ramen: svg(cup({ top: 20, h: 30, rt: 15, rb: 11, c: '#f4efe2', fillTop: '#f2cc6a' })
    + `<path d="M17.6 30h28.8l-1 8H18.6z" fill="#d9362b" stroke="none"/><path d="M18.6 38h26.8l-.8 5H19.4z" fill="#f2b632" stroke="none"/>`
    + `<path d="M20 20c2-2 3 1 5-1s3 1 5-1 3 1 5-1 3 1 5-1" fill="none" stroke="#d9a23e" stroke-width="1.4"/>`
    + `<path d="M36 18l8-12M40 19l7-11" stroke="#c99a5b" stroke-width="2.2"/>` + steam([24, 30])),
  beans: svg(can({ top: 14, h: 36, rx: 13, c: '#c9d1d7' }) + band({ y: 20, h: 22, rx: 13, c: '#3f8f3a' })
    + txt(31, 30, 5.6, '#fff', 'BEANS') + `<ellipse cx="31" cy="36.5" rx="7" ry="3.6" fill="#a34f22"/><circle cx="28.5" cy="36" r="1.3" fill="#d8834a" stroke="none"/><circle cx="32.5" cy="37" r="1.3" fill="#d8834a" stroke="none"/>`),
  eggs: svg(`<path d="M10 30l7-12h34l-6 12z" fill="#b7a07c"/>`
    + box({ x: 8, y: 32, w: 40, h: 14, d: 9, c: '#cdb48d' })
    + [14, 23, 32, 41].map((x, i) => `<ellipse cx="${x + 2}" cy="${29 - (i % 2)}" rx="4.6" ry="5.8" fill="#fbf4e6"/><ellipse cx="${x + 0.6}" cy="${26.5 - (i % 2)}" rx="1.4" ry="2" fill="#fff" stroke="none"/>`).join('')
    + `<path d="M12 39h34" stroke="${dim('#cdb48d')}" stroke-width="1"/>`),
  sandwich: svg(paper('#c8a06a')
    + `<path d="M14 42L36 16l8 6-22 26z" fill="#e7c48b"/><path d="M36 16l14 22-6 6-22-22z" fill="${lit('#e7c48b')}"/>`
    + `<path d="M22 48l28-10v4L22 52z" fill="#d9a066"/><path d="M14 42l8 6v4l-8-6z" fill="#b8844e"/>`
    + `<path d="M17 43l25-14M19 45.5l26-13" stroke="#7cc35a" stroke-width="2.6"/><path d="M18 44.5l26-14" stroke="#e8758a" stroke-width="2"/>`),
  bar: svg(`<g transform="rotate(-14 32 34)">${box({ x: 8, y: 28, w: 44, h: 14, d: 10, c: '#b9c0c8' })}`
    + `<rect x="14" y="28" width="30" height="14" fill="#c4202a"/>${txt(29, 37.6, 5.4, '#fff', 'PROTEIN')}`
    + `<path d="M8 28v14M52 28v14" stroke="${dim('#b9c0c8')}" stroke-dasharray="1.5 1.5"/></g>`),
  nia_meal: svg(`<path d="M12 30L18 10h32l-4 20z" fill="#f2efe8"/><path d="M16 27l4-14h26l-3 14z" fill="#e2ddd2" stroke="none"/>`
    + foam(8, 32, 42, 14, 10)
    + `<path d="M12 32c4-3 10-4 18-3l12 1 8-4" fill="#f2c94c"/>`
    + `<path d="M30 25c5-3 11-1 11 3s-5 6-11 4c-2 2-5 2-6 0 1-2 3-3 6-7z" fill="#b5652f"/><circle cx="25" cy="31" r="1.8" fill="#f4efe2"/>`
    + `<circle cx="18" cy="29" r="1.6" fill="#7cc35a" stroke="none"/><circle cx="22" cy="31" r="1.4" fill="#e8463a" stroke="none"/>`
    + `<path d="M48 44l8-6" stroke="#dfe3e8" stroke-width="2.6"/><ellipse cx="57" cy="37" rx="2.6" ry="1.8" fill="#dfe3e8"/>`),
  cereal: svg(box({ x: 16, y: 12, w: 26, h: 40, d: 9, c: '#e2392c', top: '#f07a5c', side: '#a9261d' })
    + `<rect x="18" y="16" width="22" height="10" fill="#f2c03a"/>${txt(29, 23.2, 3.1, '#c4202a', 'OFF-BRAND')}${txt(29, 32, 4.8, '#fff', 'CEREAL')}`
    + `<path d="M20 40h18a9 6 0 0 1-18 0z" fill="#f4efe2"/><ellipse cx="29" cy="40" rx="9" ry="2.6" fill="#f2c94c"/><circle cx="26" cy="39.5" r="1.2" fill="#c98a12" stroke="none"/><circle cx="31" cy="40" r="1.2" fill="#e8463a" stroke="none"/>`),
  pizza_slice: svg(`<path d="M12 18l40-4-18 40z" fill="#f2c84a"/><path d="M12 18l40-4 1 6-40 4z" fill="#c8823a"/><circle cx="30" cy="24" r="3" fill="#c83a2a"/><circle cx="38" cy="30" r="3" fill="#c83a2a"/><circle cx="32" cy="38" r="2.6" fill="#c83a2a"/>`),
  pizza_pie: svg(box({ x: 10, y: 26, w: 44, h: 8, d: 10, c: '#f2efe4', top: '#f8f6ee', side: '#d8d2c0' }) + txt(32, 33, 6, '#c83a2a', "SAL'S") + `<ellipse cx="32" cy="21" rx="20" ry="7" fill="#c8823a"/><ellipse cx="32" cy="21" rx="17" ry="5.6" fill="#f2c84a"/><circle cx="26" cy="20" r="2" fill="#c83a2a"/><circle cx="36" cy="22" r="2" fill="#c83a2a"/><circle cx="33" cy="18" r="2" fill="#c83a2a"/>`),
  italian_ice: svg(cup({ top: 28, h: 22, rt: 13, rb: 10, c: '#f4f2ee', rim: '#f4f2ee' }) + `<path d="M19 28q13-18 26 0z" fill="#e84a6a"/><path d="M38 10l-4 18" stroke="#e8e8e8" stroke-width="2.4"/>`),
  bagel_cc: svg(`<ellipse cx="32" cy="36" rx="22" ry="12" fill="#c8883a"/><ellipse cx="32" cy="32" rx="22" ry="11" fill="#d8a05a"/><ellipse cx="32" cy="32" rx="16" ry="7" fill="#f4f2ea"/><ellipse cx="32" cy="32" rx="5" ry="2.4" fill="#c8883a"/>`),
  piragua: svg(`<path d="M22 30h20l-6 26h-8z" fill="#f4f2ee"/><path d="M20 30q12-24 24 0z" fill="#e83a5a"/><path d="M24 22q8-8 16 0" fill="none" stroke="#3ad8a0" stroke-width="3"/>`),
  beef_patty: svg(`<path d="M10 40q22-26 44 0z" fill="#e8b03a"/><path d="M12 40h40" stroke="#c8902a" stroke-width="2"/><path d="M18 36l3-4M26 30l3-4M36 30l3-4M44 36l3-4" stroke="#c8902a" stroke-width="1.4"/>`),
  coco_bread: svg(`<path d="M8 42q24-28 48 0z" fill="#f2e2c0"/><path d="M14 40q18-14 36 0z" fill="#e8b03a"/><path d="M8 42h48" stroke="#d8c8a0" stroke-width="2"/>`),
  jerk_chicken: svg(`<ellipse cx="32" cy="40" rx="24" ry="9" fill="#f4f1ea"/><path d="M16 38q6-12 16-10q4 6 0 12z" fill="#7a3a1a"/><path d="M32 36q8-10 16-4q0 8-8 8z" fill="#8a4a1e"/><rect x="18" y="40" width="10" height="3" fill="#c8a050" stroke="none"/><circle cx="44" cy="40" r="2" fill="#3a8a3a" stroke="none"/>`),
  pretzel: svg(`<path d="M20 44q-14-6-4-20q10-8 16 10q6-18 16-10q10 14-4 20q-12 4-24 0z" fill="none" stroke="#a8602a" stroke-width="6"/><circle cx="24" cy="26" r="1.2" fill="#fff" stroke="none"/><circle cx="40" cy="30" r="1.2" fill="#fff" stroke="none"/><circle cx="32" cy="42" r="1.2" fill="#fff" stroke="none"/>`),
  knish: svg(box({ x: 16, y: 24, w: 32, h: 20, d: 10, c: '#d8a050', top: '#e8b86a', side: '#b8823a' }) + `<path d="M22 30h20" stroke="#b8823a" stroke-width="1.4"/>`),
  kebab: svg(`<path d="M8 50L56 14" stroke="#b8b8bc" stroke-width="2.4"/><rect x="16" y="36" width="9" height="9" fill="#a8682a" transform="rotate(-37 20 40)"/><rect x="26" y="29" width="9" height="9" fill="#3a8a3a" transform="rotate(-37 30 33)"/><rect x="34" y="23" width="9" height="9" fill="#a8682a" transform="rotate(-37 38 27)"/><rect x="42" y="17" width="8" height="8" fill="#c83a2a" transform="rotate(-37 46 21)"/>`),
  doner: svg(`<path d="M14 46q18-34 36 0z" fill="#f2e2c0"/><path d="M20 42q12-20 24 0z" fill="#a8682a"/><path d="M22 36h20" stroke="#3a8a3a" stroke-width="3"/><path d="M24 32h14" stroke="#c83a2a" stroke-width="2"/>`),
  hotdog: svg(`<path d="M8 38q24 14 48 0l-2-6q-22 10-44 0z" fill="#e8c890"/><rect x="6" y="30" width="52" height="7" rx="3.5" fill="#b84a2a"/><path d="M12 32q4-3 8 0t8 0 8 0 8 0 8 0" fill="none" stroke="#f2c81a" stroke-width="1.6"/>`),
  bec: svg(`<path d="M8 40c4-12 14-18 26-18 10 0 18 5 22 12l-6 12H14z" fill="#e8e3d6"/><path d="M14 46l-6-6 4-2z" fill="#c9c4b6"/>`
    + `<path d="M16 34c2-6 9-9 17-9s14 3 16 9z" fill="#d9954a"/><path d="M16 34h33l-1 2H17z" fill="#f2c03a"/>`
    + `<path d="M17 36h31l-2 3H19z" fill="#b8432e"/><path d="M18 39h29c-1 4-7 6-14.5 6S19 43 18 39z" fill="#d9954a"/>`
    + `<path d="M20 31c3-1 5-1 7 0M30 29c3-1 5-1 7 0" stroke="${lit('#d9954a')}" stroke-width="1.4"/>`, 23),
  chopped: svg(paper('#b98c5a') + `<path d="M10 38c0-6 4-9 10-9h26c6 0 9 3 9 7l-2 3H12z" fill="#e2a85c"/>`
    + `<path d="M12 39h41l-1 3H13z" fill="#6b3420"/><path d="M14 38l4 2 4-3 4 3 4-3 4 3 4-3 4 3 4-3 4 2" fill="none" stroke="#7cc35a" stroke-width="2.4"/>`
    + `<path d="M14 42h38" stroke="#f2c03a" stroke-width="2.4"/><path d="M12 43h41c0 4-4 6-9 6H20c-5 0-8-2-8-6z" fill="#cf9550"/>`
    + `<path d="M18 32c3-1 6-1 9 0M32 31c3-1 6-1 9 0" stroke="${lit('#e2a85c')}" stroke-width="1.4"/>`),
  hero: svg(`<path d="M8 44l12-8h30l6 6-12 8H14z" fill="#e8e3d6"/>`
    + `<path d="M12 36c0-5 4-8 9-8h26c5 0 8 3 8 7l-2 2H13z" fill="#e7b46b"/><path d="M13 37h41l-1 3H14z" fill="#e8758a"/><path d="M13 40h40" stroke="#7cc35a" stroke-width="2.6"/>`
    + `<path d="M14 41h39c-1 4-5 5-9 5H22c-5 0-8-1-8-5z" fill="#d49a52"/><path d="M20 31l5-2M30 30l5-1M40 30l5 0" stroke="${lit('#e7b46b')}" stroke-width="1.6"/>`),
  loosies: svg(`<rect x="10" y="40" width="44" height="10" rx="1" fill="#e9e4d8" transform="rotate(-6 32 45)"/>`
    + `<g transform="rotate(-16 32 30)">${roll({ x1: 12, x2: 44, cy: 30, r: 2.8, c: '#f8f6f0' })}${roll({ x1: 44, x2: 52, cy: 30, r: 2.8, c: '#e3a256', end: '#e3a256' })}</g>`
    + `<g transform="rotate(10 32 40)">${roll({ x1: 14, x2: 46, cy: 38, r: 2.8, c: '#f8f6f0' })}${roll({ x1: 46, x2: 54, cy: 38, r: 2.8, c: '#e3a256', end: '#e3a256' })}</g>`, 22),
  tallboy: svg(can({ top: 8, h: 44, rx: 11, c: '#b9c0c8', lid: '#dfe3e8' }) + band({ y: 20, h: 18, rx: 11, c: '#c9ced4' })
    + txt(31, 32, 5.6, '#2a4d8f', 'TALL') + `<path d="M28 6h6" stroke-width="2"/>`, 15),
  falafel: svg(`<path d="M20 52L10 22c8-6 26-8 38 0L36 52z" fill="#efe1bb"/><path d="M36 52L48 22c3 2 5 4 6 6L42 52z" fill="${dim('#efe1bb')}"/>`
    + [[22, 24], [32, 21], [41, 25], [27, 30], [37, 31]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="5" fill="#6f8a2e"/><circle cx="${x - 1.6}" cy="${y - 1.6}" r="1.4" fill="${lit('#6f8a2e')}" stroke="none"/>`).join('')
    + `<path d="M16 22c3 2 5 2 8 1M38 20c3 0 5 1 7 3" stroke="#f4efe2" stroke-width="2.2"/><path d="M14 32l26 0" stroke="${dim('#efe1bb')}" stroke-width="1"/>`, 16),
  halal_plate: svg(`<path d="M12 30L18 12h32l-4 18z" fill="#f2efe8"/>` + foam(8, 32, 44, 13, 10)
    + `<path d="M12 32c6-4 14-4 22-3l14-1 8-4" fill="#f4e4a6"/><path d="M14 31c4-2 8-2 12-1" stroke="#e8d07a" stroke-width="1.4"/>`
    + [[34, 26], [40, 25], [45, 28], [38, 30]].map(([x, y]) => `<path d="M${x - 3} ${y}l3-3 4 1 1 3-3 3-4-1z" fill="#c07a32"/>`).join('')
    + `<path d="M20 29c4 1 8 1 12-1" stroke="#fff" stroke-width="2.4"/>`),
  chicken_rice: svg(box({ x: 10, y: 34, w: 40, h: 10, d: 10, c: '#c7ccd2', top: '#e6e9ec', side: '#9aa1a8' })
    + `<path d="M12 33l6-5h33l-5 5z" fill="#f2c94c"/>`
    + [[20, 30], [27, 29], [34, 30], [41, 29], [30, 32]].map(([x, y]) => `<path d="M${x - 3} ${y}l3-2.6 4 .6 1 3-3 2.4-4-.6z" fill="#b5652f"/>`).join('')
    + `<path d="M18 31c6 1 14 1 22-1" stroke="#fff" stroke-width="1.8"/><path d="M24 33c4 0 7 0 10-1" stroke="#e8463a" stroke-width="1.4"/>`),
  lentil: svg(cup({ top: 26, h: 22, rt: 17, rb: 12, c: '#e9e3d4', fillTop: '#c87a2a' })
    + `<circle cx="27" cy="26" r="1" fill="#e9a65a" stroke="none"/><circle cx="35" cy="27" r="1" fill="#e9a65a" stroke="none"/>` + steam([24, 32, 40], 8)),
  baklava: svg(`<ellipse cx="32" cy="44" rx="25" ry="9" fill="#f4f1ea"/><ellipse cx="32" cy="43" rx="19" ry="6" fill="none" stroke="#dcd6c8" stroke-width="1"/>`
    + [[22, 0], [40, 0]].map(([x]) => `<path d="M${x - 9} 38l9-7 9 7-9 7z" fill="#e0a547"/><path d="M${x - 9} 38v4l9 7v-4z" fill="#b97a26"/><path d="M${x + 9} 38v4l-9 7v-4z" fill="#a5691d"/><path d="M${x - 2} 35l2 2 2-2" stroke="#5f9e3a" stroke-width="2"/>`).join(''), 24),
  chips: svg(`<path d="M14 12l36-2-2 6 4 34-36 2 2-6z" fill="#f2a01e"/><path d="M48 16l4 34-4 2-4-34z" fill="#c97c10"/>`
    + `<path d="M14 12l2 6-2 34" fill="none" stroke="#c97c10"/><path d="M15 12l2 4h32l1-4" stroke="#c97c10" stroke-dasharray="2 1.5"/>`
    + txt(31, 33, 7.6, '#c4202a', 'CHIPS', -6) + `<path d="M24 40c4-3 9-3 12 0-3 3-8 3-12 0z" fill="#f8d36a"/>`),

  /* ---------------------------------------------------------------- drinks and comfort */
  mint_tea: svg(cup({ top: 18, h: 32, rt: 12, rb: 9, c: '#e8f1e4', rim: '#f6faf4', fillTop: '#b8762a' })
    + `<path d="M21 30l22 0-2 18H23z" fill="#c4842e" fill-opacity=".7" stroke="none"/><path d="M30 18c-2-7 4-10 9-9-1 6-5 9-9 9z" fill="#5fbf6b"/><path d="M30 18l6-6" stroke="#3f8f3a" stroke-width="1"/>`),
  coffee: svg(cup({ top: 18, h: 32, rt: 13, rb: 10, c: '#2f5fb3', rim: '#f4efe2' })
    + `<path d="M19 14h26l1 4H18z" fill="#f4efe2"/><ellipse cx="32" cy="14" rx="12" ry="3" fill="#fbf8f0"/>`
    + `<path d="M21 26h22l-1.4 13H22.4z" fill="#f4efe2" stroke="none"/>${txt(32, 31, 3.2, '#2f5fb3', 'WE ARE')}${txt(32, 36, 3.2, '#2f5fb3', 'HAPPY')}`
    + `<path d="M24 43h16" stroke="#f4efe2" stroke-width="2" stroke-dasharray="3 2"/>`),
  soda: svg(can({ top: 14, h: 38, rx: 12, c: '#d4252a', lid: '#dfe3e8' }) + txt(31, 37, 6.8, '#fff', 'SODA') + `<path d="M22 44c6 3 14 3 20 0" stroke="#fff" stroke-width="1.6" fill="none"/>`, 16),
  water: svg(`<path d="M26 8h12v5l4 6v30a3 3 0 0 1-3 3H25a3 3 0 0 1-3-3V19l4-6z" fill="#bfe3f7" fill-opacity=".9"/>`
    + `<path d="M38 13l4 6v30a3 3 0 0 1-3 3h-2V19z" fill="#8fc6e6" stroke="none"/><rect x="26" y="4" width="12" height="5" rx="1" fill="#2f6fd6"/>`
    + `<rect x="22" y="26" width="20" height="10" fill="#2f6fd6"/>${txt(32, 33.2, 4, '#fff', 'WATER')}${shine(25, 20, 2.2, 26)}`, 14),

  /* ---------------------------------------------------------------- the fictional substances */
  rox: svg(`<path d="M14 44l6-9 9 2 4 9-8 5z" fill="#efe4b8"/><path d="M20 35l9 2-3 4-7-1z" fill="#fbf4d6"/>`
    + `<path d="M30 40l7-10 10 3 3 10-9 6z" fill="#e6d79c"/><path d="M37 30l10 3-4 4-8-2z" fill="#f8efc8"/>`
    + `<path d="M42 47l6-5 7 3-1 6-8 1z" fill="#ead9a0"/><path d="M24 26l5-5 6 3-2 5-6 1z" fill="#f2e6b4"/>`
    + `<g fill="#fffbe8" stroke="none" fill-opacity=".8"><circle cx="18" cy="49" r="1.2"/><circle cx="34" cy="51" r="1"/><circle cx="52" cy="40" r="1"/><circle cx="27" cy="33" r=".9"/><circle cx="46" cy="52" r=".8"/></g>`, 24),
  epipen: svg(`<rect x="14" y="27" width="38" height="11" rx="5" fill="#f2c21a"/><rect x="14" y="27" width="10" height="11" rx="3" fill="#2a6ad8"/><rect x="44" y="28.5" width="8" height="8" rx="2" fill="#e8501a"/><rect x="27" y="29.5" width="14" height="6" fill="#fff6e0" stroke="none"/>` + txt(34, 34.5, 5, '#c81e1e', 'EPI')),
  baking_soda: svg(box({ x: 18, y: 16, w: 26, h: 34, d: 8, c: '#f0a020', top: '#ffc04a', side: '#b8761a' })
    + `<rect x="21" y="24" width="20" height="14" fill="#fff6e0" stroke="none"/>` + txt(31, 33, 7, '#c03a1a', 'SODA')
    + `<path d="M24 44h14" stroke="#c03a1a" stroke-width="2"/>`),
  bliss: svg(`<rect x="27" y="8" width="10" height="7" rx="1.5" fill="#a87a4a"/><path d="M26 15h12v28a6 6 0 0 1-12 0z" fill="#dff1ff" fill-opacity=".9"/>`
    + `<path d="M26.6 26h10.8v17a5.4 5.4 0 0 1-10.8 0z" fill="#3f8cff"/><path d="M33 26h4.4v17a5.4 5.4 0 0 1-3 4.8z" fill="#2a64c4" stroke="none"/>${shine(28.5, 18, 2, 24)}`, 12),
  static: svg(`<g transform="rotate(-10 32 34)">${box({ x: 12, y: 22, w: 36, h: 22, d: 5, c: '#c9d2dc', top: '#eef2f6', side: '#9aa6b2' })}`
    + [[19, 28], [29, 28], [39, 28], [19, 38], [29, 38]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="4" ry="3" fill="#f4f7fa"/><ellipse cx="${x}" cy="${y}" rx="2.6" ry="1.8" fill="#7fb6e6" stroke="none"/>`).join('')
    + `<ellipse cx="39" cy="38" rx="4" ry="3" fill="#dfe6ee"/></g><ellipse cx="50" cy="49" rx="4" ry="2.4" fill="#f4f7fa"/><path d="M47 49h6" stroke-width="1"/>`),
  mud: svg(cup({ top: 14, h: 36, rt: 13, rb: 11, c: '#c9ccd0', rim: '#dfe3e8', fillTop: '#3a2a1c' })
    + `<path d="M19.4 24h25.2l-1.2 16H20.6z" fill="#6b4a2f" stroke="none"/><path d="M26 30c2-3 7-3 9 0s-3 6-6 4" fill="#2d241d"/>`),
  drip: svg(`<path d="M16 18h32l2 32H14z" fill="#e9f2ee" fill-opacity=".85"/><path d="M16 18h32v5H16z" fill="#c4202a"/><path d="M16 23h32" stroke-width="1"/>`
    + `<path d="M16 40c6-4 12-2 16-3s10-3 16 1l2 12H14z" fill="#e8f0e2"/><circle cx="24" cy="44" r="1.2" fill="#9cc4a8" stroke="none"/><circle cx="34" cy="46" r="1.2" fill="#9cc4a8" stroke="none"/><circle cx="40" cy="43" r="1" fill="#c9c09a" stroke="none"/>`
    + shine(19, 26, 2, 12)),
  bliss_x: svg(`<path d="M32 6l9 14-3 26h-12l-3-26z" fill="#4aa8ff"/><path d="M32 6l9 14-9 4z" fill="#a6d8ff"/><path d="M41 20l-3 26-6-22z" fill="#2a6fd6"/>`
    + `<path d="M18 26l8-6 1 26-8 2z" fill="#6fc0ff"/><path d="M44 28l6-4 2 22-8 2z" fill="#3a8ff0"/><path d="M26 24l6 0" stroke="#fff" stroke-opacity=".7"/>`, 18),
  static_x: svg(box({ x: 12, y: 24, w: 36, h: 22, d: 8, c: '#e7d9bf', top: '#f6eedd', side: '#bfae8c' })
    + `<path d="M18 33a6 6 0 0 1 6-6h12a6 6 0 0 1 0 12H24a6 6 0 0 1-6-6z" fill="#aeb6c0"/><path d="M30 27v12" stroke="#7c8692"/>${shine(21, 29, 7, 2)}`),
  mud_x: svg(can({ top: 12, h: 40, rx: 13, c: '#2f4a2a', lid: '#4a4f45' }) + band({ y: 22, h: 18, rx: 13, c: '#c9b08c' })
    + `<path d="M24 31c3-4 9-4 12 0s-5 6-8 4" fill="#1a1411"/>`),
  drip_x: svg(`<path d="M14 16h36l2 34H12z" fill="#f4f8fa" fill-opacity=".85"/><path d="M14 16h36v5H14z" fill="#2f6fd6"/>`
    + `<path d="M13 36c8-5 14-3 19-4s12-4 19 1l1 17H12z" fill="#fbfdff"/><path d="M18 42c6-2 12-1 16-2" stroke="#dde6ec" stroke-width="1.2"/>${shine(17, 24, 2, 10)}`),

  /* ---------------------------------------------------------------- valuables */
  tv: svg(box({ x: 10, y: 20, w: 38, h: 30, d: 10, c: '#7a756c', top: '#a29d93', side: '#56514a' })
    + `<rect x="14" y="24" width="24" height="20" rx="3" fill="#2e4a5a"/><path d="M17 27l7 5" stroke="#8fd8ff" stroke-width="1.8"/>`
    + `<circle cx="43" cy="29" r="2" fill="#ddd"/><circle cx="43" cy="36" r="2" fill="#ddd"/><path d="M41 42h4" />`
    + `<path d="M28 16l-8-12M32 16l10-11" stroke-width="1.6"/><ellipse cx="30" cy="16" rx="5" ry="2" fill="#56514a"/>`),
  guitar: svg(`<path d="M38 24l14-16 4 3-14 17" fill="#5a3a1e"/><path d="M50 6l6 5-2 2-6-5z" fill="#2d241d"/>`
    + `<path d="M30 22c-5-3-13-2-16 4-2 4 1 7 0 10-2 5 0 12 8 13 7 1 11-3 13-8 1-3 5-4 7-7 3-6-5-11-12-12z" fill="#b5652f"/>`
    + `<path d="M24 26c-4 2-6 6-4 9" stroke="${lit('#b5652f')}" stroke-width="2"/><circle cx="29" cy="35" r="3.4" fill="${O}" stroke="none"/>`
    + `<path d="M20 44l12-12" stroke="#f4efe2" stroke-width="1"/><rect x="18" y="40" width="10" height="3" rx="1" fill="#2d241d" transform="rotate(-45 23 41)"/>`),
  watch: svg(`<path d="M24 6h14l-1 14H25zM25 44h12l1 14H24z" fill="#7a5530"/><path d="M34 6h4l-1 14h-3zM34 44h3l1 14h-4z" fill="#5a3d22" stroke="none"/>`
    + `<circle cx="31" cy="32" r="13" fill="#d8b04a"/><circle cx="31" cy="32" r="10" fill="#fff8e6"/><path d="M31 25v7l5 3" stroke-width="1.8"/>`
    + `<rect x="43" y="30" width="3" height="4" fill="#d8b04a"/>${shine(24, 25, 2, 7)}`, 14),
  ring: svg(box({ x: 14, y: 34, w: 32, h: 14, d: 10, c: '#3a3f4a', top: '#5a6170', side: '#262a33' })
    + `<path d="M14 34l7-5.5h32" fill="none"/><path d="M18 32l5-4h26l-5 4z" fill="#7a2a3a"/>`
    + `<ellipse cx="34" cy="26" rx="8" ry="9" fill="none" stroke="#dfe3e8" stroke-width="3.6"/><ellipse cx="34" cy="26" rx="8" ry="9" fill="none"/><ellipse cx="34" cy="26" rx="4.4" ry="5.4" fill="none"/>`
    + `<path d="M31 16l3-4 3 4-3 3z" fill="#bfefff"/>`),
  console: svg(box({ x: 8, y: 26, w: 38, h: 12, d: 14, c: '#b9bcc2', top: '#d9dce0', side: '#8a8e96' })
    + `<path d="M14 21l6-5h20l-6 5z" fill="#9a9ea6"/><circle cx="15" cy="32" r="2" fill="#4a4f58"/><rect x="34" y="30" width="8" height="3" rx="1" fill="#4a4f58"/>`
    + `<path d="M18 46c0-4 4-5 8-5h10c4 0 8 1 8 5s-3 6-6 4l-3-2h-8l-3 2c-3 2-6 0-6-4z" fill="#a9adb4"/><circle cx="23" cy="45" r="1.4" fill="#4a4f58"/><circle cx="39" cy="45" r="1.4" fill="#c4202a"/>`
    + `<path d="M44 46c4 0 8-2 10-6" stroke="#4a4f58" fill="none"/>`),
  jacket: svg(`<path d="M22 8l10 5 10-5 10 6 4 22-6 2-2-12v28H16V26l-2 12-6-2 4-22z" fill="#2e2622"/>`
    + `<path d="M42 8l10 6 4 22-6 2-2-12v28h-6z" fill="#1d1714" stroke="none"/><path d="M32 13v39" stroke="#8a8f96" stroke-width="1.6"/>`
    + `<path d="M26 10l6 10 6-10" fill="#3e3430"/><path d="M21 30h7M36 30h7" stroke="#555" stroke-width="1.2"/>${shine(19, 26, 2, 18)}`, 22),
  tools: svg(box({ x: 10, y: 28, w: 40, h: 20, d: 10, c: '#d4252a', top: '#ec5a52', side: '#9a1a1e' })
    + `<path d="M10 34h40" stroke="#9a1a1e"/><rect x="27" y="32" width="6" height="4" fill="#dfe3e8"/>`
    + `<path d="M22 20c0-4 22-4 22 0v3" fill="none" stroke-width="2.6"/><path d="M20 22l14-4 3 2-14 4z" fill="#a9b0b8"/><circle cx="19" cy="22" r="3.6" fill="#a9b0b8"/><circle cx="19" cy="22" r="1.4" fill="#d4252a" stroke="none"/>`),
  necklace: svg(box({ x: 12, y: 36, w: 36, h: 12, d: 9, c: '#c7a777', top: '#e2c99d', side: '#9a7c50' })
    + `<path d="M14 34l6-14h32l-6 14z" fill="#e2c99d"/><path d="M18 31l4-9h26l-4 9z" fill="#2a2a33" stroke="none"/>`
    + `<path d="M22 24c2 8 8 10 12 10s10-3 12-10" fill="none" stroke="#e8c04a" stroke-width="1.8" stroke-dasharray="1.6 1"/><path d="M34 34l-2 3 2 3 2-3z" fill="#e8c04a"/>`),
  perfume: svg(`<rect x="27" y="10" width="10" height="9" rx="1.5" fill="#d8b04a"/><path d="M31 10h2v9h-2z" fill="${lit('#d8b04a')}" stroke="none"/>`
    + box({ x: 18, y: 22, w: 26, h: 28, d: 8, c: '#f1d8a6', top: '#fbecc8', side: '#cfae6e' })
    + `<rect x="22" y="30" width="18" height="12" rx="1" fill="#fbf4e6"/><path d="M25 36h12" stroke="#c9a24a" stroke-width="1"/>${shine(20, 25, 2, 20)}`, 16),

  /* ---------------------------------------------------------------- gifts */
  flowers: svg(`<path d="M24 54L14 26h36L40 54z" fill="#8fd16a"/><path d="M40 54l10-28h4L44 54z" fill="#5fa040" stroke="none"/><path d="M28 54l-8-26M36 54l6-26" stroke="#5fa040" stroke-width="1"/>`
    + [[22, 20, '#e8463a'], [32, 16, '#f2a6c4'], [42, 20, '#f2c03a'], [27, 25, '#c94ad6'], [38, 25, '#e8463a']].map(([x, y, c]) => `<path d="M${x} ${y - 6}l4 3 1 5-5 3-5-3 1-5z" fill="${c}"/><path d="M${x} ${y - 6}l4 3-4 3z" fill="${lit(c)}" stroke="none"/>`).join(''), 16),
  chocolates: svg(`<path d="M32 54L10 34c-6-6-2-18 8-18 6 0 10 4 14 9 4-5 8-9 14-9 10 0 14 12 8 18z" fill="#c4202a"/>`
    + `<path d="M32 54l22-20c3-3 4-7 3-11L32 48z" fill="#8f141c" stroke="none"/><path d="M32 25v29M14 30c6 2 12 2 18 0M50 30c-6 2-12 2-18 0" stroke="#f2a6c4" stroke-width="2.4"/>`
    + `<path d="M32 25c-6-8-12-6-10-2s8 3 10 2c2 1 8 2 10-2s-4-6-10 2z" fill="#f2a6c4"/>`, 22),
  mixtape: svg(box({ x: 8, y: 22, w: 46, h: 28, d: 6, c: '#3a3a40', top: '#5a5a62', side: '#24242a' })
    + `<rect x="12" y="25" width="38" height="13" rx="1" fill="#f4efe2"/>${txt(31, 33, 4.4, '#c4202a', 'MIXTAPE')}`
    + `<rect x="18" y="40" width="26" height="7" rx="3.5" fill="#1d1712"/><circle cx="23" cy="43.5" r="2.4" fill="#f4efe2"/><circle cx="39" cy="43.5" r="2.4" fill="#f4efe2"/>`),
  candle: svg(cup({ top: 26, h: 24, rt: 12, rb: 12, c: '#f4e8d0', rim: '#fbf4e6', fillTop: '#f8eedb' })
    + `<path d="M20 34h24v8H20z" fill="#d9a066" stroke="none" fill-opacity=".6"/><path d="M32 26v-5" stroke-width="1.4"/>`
    + `<path d="M32 10c4 5 4 9 0 11-4-2-4-6 0-11z" fill="#ffb13a"/><path d="M32 14c2 3 2 5 0 6-2-1-2-3 0-6z" fill="#fff3b0" stroke="none"/>`, 16),
  breath_mints: svg(`<g transform="rotate(-20 32 34)">${roll({ x1: 10, x2: 52, cy: 34, r: 7, c: '#dfeee6', end: '#f4faf6' })}`
    + `<rect x="20" y="27" width="22" height="14" fill="#4aa86a"/>${txt(31, 36.2, 4.6, '#fff', 'MINTS')}</g>`),
  soup_can: svg(can({ top: 14, h: 36, rx: 13, c: '#dfe3e8' }) + band({ y: 18, h: 13, rx: 13, c: '#c4202a' }) + band({ y: 31, h: 14, rx: 13, c: '#f4efe2' })
    + txt(31, 27.6, 5.8, '#fff', 'SOUP') + `<circle cx="31" cy="39" r="3.4" fill="#e8c04a"/>`),
  batteries: svg(box({ x: 10, y: 16, w: 40, h: 34, d: 4, c: '#e9eef2', top: '#f8fafb', side: '#bcc5cc' })
    + `<rect x="10" y="16" width="40" height="7" fill="#c4202a"/>`
    + [17, 25, 33, 41].map((x) => `<rect x="${x - 3}" y="27" width="6" height="19" rx="1.5" fill="#2a2a30"/><rect x="${x - 3}" y="27" width="6" height="5" fill="#d8b04a"/><rect x="${x - 1.2}" y="25" width="2.4" height="2" fill="#a9b0b8"/>`).join('')),

  /* ---------------------------------------------------------------- papers and the rest */
  id_card: svg(`<g transform="rotate(-6 32 34)">${box({ x: 8, y: 20, w: 46, h: 28, d: 3, c: '#e9eef5', top: '#ffffff', side: '#b9c3d0' })}`
    + `<rect x="8" y="20" width="46" height="6" fill="#3f6fc4"/>${txt(31, 25, 3.8, '#fff', 'STATE ID')}`
    + `<rect x="12" y="29" width="13" height="15" rx="1" fill="#8c5f40"/><circle cx="18.5" cy="34" r="3.2" fill="#6a4630"/>`
    + `<path d="M29 31h20M29 35h20M29 39h14" stroke="#7d8aa0" stroke-width="1.4"/><path d="M38 44h12" stroke="#c4202a" stroke-width="1.4"/></g>`),
  lease: svg(`<path d="M18 8h26l4 6v40H22l-4-4z" fill="#f2e6c4"/><path d="M44 8l4 6h-4z" fill="#d9c79a"/><path d="M18 50l4 4v-4z" fill="#d9c79a"/>`
    + `<path d="M23 18h20M23 23h20M23 28h20M23 33h14" stroke="#9a8f74" stroke-width="1.4"/>${txt(32, 14.6, 3.4, '#5a4a2a', 'LEASE 3B')}`
    + `<circle cx="40" cy="44" r="4.6" fill="#c4202a"/><path d="M38 48l-2 5M42 48l2 5" stroke="#c4202a" stroke-width="2"/><path d="M24 44c3-3 5 1 8-2" stroke="#2c5fb8" stroke-width="1.4"/>`, 16),
  // a plastic container of rice and beans, lid half on
  batch_meal: svg(`<path d="M12 30h40l-4 22H16z" fill="#e8ecef" opacity=".85"/><ellipse cx="32" cy="30" rx="20" ry="5" fill="#f2f0e4"/>`
    + `<ellipse cx="32" cy="31" rx="17" ry="4" fill="#efe6c8"/><circle cx="26" cy="30" r="1.6" fill="#7a2e22"/><circle cx="33" cy="31" r="1.6" fill="#7a2e22"/><circle cx="38" cy="29.5" r="1.6" fill="#7a2e22"/>`
    + `<path d="M10 22l40-6 2 5-40 6z" fill="#c8d8e0" opacity=".9"/>`, 16),
  // the Guardian Angles' tri-fold: red, white wings, an eye, and a lot of exclamation marks
  angle_pamphlet: svg(`<path d="M12 14l14-4v42l-14 4z" fill="#c01e1a"/><path d="M26 10l14 4v42l-14-4z" fill="#f2f2ec"/><path d="M40 14l14-4v42l-14 4z" fill="#c01e1a"/>`
    + `<path d="M15 26l4-3 4 3M15 30l4-3 4 3" stroke="#f2f2ec" stroke-width="1.6"/><circle cx="33" cy="24" r="3.4" fill="#c01e1a"/><circle cx="33" cy="24" r="1.3" fill="#141416"/>`
    + `<path d="M29 32h8M29 36h8M29 40h6" stroke="#9a9a94" stroke-width="1.3"/><path d="M47 22v12M47 38v2" stroke="#f2f2ec" stroke-width="2.2"/>`, 16),
  grab_bag: svg(box({ x: 14, y: 22, w: 30, h: 30, d: 10, c: '#c9a26b', top: '#e2c38e', side: '#a07c48' })
    + `<path d="M14 22l4-6h30l3 2" fill="#d9b67e"/><path d="M18 16l3 6M26 16l-1 6M34 16l2 6" stroke="#a07c48" stroke-width="1"/>`
    + txt(29, 44, 16, '#fff', '?') + `<path d="M22 28h14" stroke="#a07c48" stroke-width="1"/>`),
};

const BY_KIND = {
  food: ART.sandwich, comfort: ART.mint_tea, substance: ART.drip, valuable: ART.watch, doc: ART.lease, mystery: ART.grab_bag, gift: ART.flowers,
};

/** The icon for an item id, wrapped in a tile; `kind` picks the fallback for unknown ids. */
export function itemIcon(id, kind = '') {
  const art = ART[id] || ART[String(id).replace(/_x$/, '')] || BY_KIND[kind] || ART.grab_bag;
  return `<span class="itemicon itemicon--${id}">${art}</span>`;
}

/** Every id with its own art (the tests check each item in CONFIG has one). */
export const ICON_IDS = Object.keys(ART);
