/**
 * Pictures for FeedLove posts, drawn on the spot: flat, low-poly, a little murky, like a photo
 * taken on a 1999 phone camera and then posted anyway. Each scene takes a seed so two posts of the
 * same thing still look like two different days (a different sky, a different plate). A selfie is
 * the author's own portrait in a frame.
 */
import { portraitURL } from '../render/faces.js';
import { personShot, sceneShot } from './studio.js';

function rng(seed) {
  let t = seed >>> 0;
  return () => { t = (t + 0x6d2b79f5) >>> 0; let r = Math.imul(t ^ (t >>> 15), 1 | t); r ^= r + Math.imul(r ^ (r >>> 7), 61 | r); return ((r ^ (r >>> 14)) >>> 0) / 4294967296; };
}
const pick = (r, a) => a[Math.floor(r() * a.length)];
const svgURL = (body) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 100" shape-rendering="crispEdges">${body}<rect width="160" height="100" fill="url(#vg)" opacity=".35"/><defs><radialGradient id="vg"><stop offset=".6" stop-opacity="0"/><stop offset="1" stop-color="#000"/></radialGradient></defs></svg>`)}`;

function skylineRow(r, y, h, col, lit) {
  let x = 0, out = '';
  while (x < 160) {
    const w = 12 + Math.floor(r() * 18), bh = h * (0.4 + r() * 0.6);
    out += `<rect x="${x}" y="${y - bh}" width="${w}" height="${bh + 40}" fill="${col}"/>`;
    for (let wy = y - bh + 4; wy < y - 4; wy += 6) for (let wx = x + 2; wx < x + w - 3; wx += 5) if (r() < lit) out += `<rect x="${wx}" y="${wy}" width="2" height="3" fill="#ffd77a"/>`;
    x += w + 1;
  }
  return out;
}

const SCENES = {
  skyline(r) {
    const sky = pick(r, [['#ff9a5a', '#5a2a5a'], ['#7ab0d8', '#d8e4ec'], ['#2a1a3a', '#ff7a4a'], ['#1a2238', '#3a4a6a']]);
    return `<defs><linearGradient id="sk" x2="0" y2="1"><stop stop-color="${sky[1]}"/><stop offset="1" stop-color="${sky[0]}"/></linearGradient></defs>
      <rect width="160" height="100" fill="url(#sk)"/>${skylineRow(r, 80, 50, '#2a2a34', 0.15)}${skylineRow(r, 100, 30, '#14141a', 0.25)}`;
  },
  night(r) {
    return `<rect width="160" height="100" fill="#10142a"/><circle cx="${110 + r() * 30}" cy="${18 + r() * 10}" r="9" fill="#f2ecd0"/>
      ${Array.from({ length: 14 }, () => `<rect x="${r() * 160}" y="${r() * 40}" width="1" height="1" fill="#fff"/>`).join('')}${skylineRow(r, 100, 45, '#0a0a12', 0.3)}`;
  },
  food(r) {
    const plate = pick(r, ['rice', 'bec', 'pernil', 'roll']);
    const bg = pick(r, ['#6a4a2a', '#8a2a2a', '#3a4a5a', '#5a5a4a']);
    const items = {
      rice: '<ellipse cx="80" cy="52" rx="32" ry="16" fill="#f2e6b0"/><ellipse cx="72" cy="48" rx="14" ry="7" fill="#c8823a"/><ellipse cx="90" cy="50" rx="12" ry="6" fill="#b8722a"/><path d="M60 46q20-8 40 4" stroke="#fff" stroke-width="3" fill="none"/><rect x="95" y="56" width="6" height="3" fill="#d83a2a"/>',
      bec: '<ellipse cx="80" cy="52" rx="26" ry="14" fill="#d8a85a"/><rect x="58" y="47" width="44" height="5" fill="#f4d23a"/><rect x="60" y="51" width="40" height="3" fill="#a83a2a"/><ellipse cx="80" cy="46" rx="24" ry="7" fill="#e0b46a"/>',
      pernil: '<ellipse cx="72" cy="52" rx="20" ry="11" fill="#8a4a2a"/><ellipse cx="96" cy="54" rx="14" ry="8" fill="#f2e6b0"/><ellipse cx="96" cy="54" rx="6" ry="3" fill="#7a3a1a"/>',
      roll: '<ellipse cx="80" cy="50" rx="24" ry="13" fill="#e0b46a"/><rect x="58" y="49" width="44" height="3" fill="#f4e4a0"/><rect x="104" y="36" width="14" height="22" fill="#f4f0e4"/><rect x="104" y="36" width="14" height="5" fill="#2a6aa8"/>',
    };
    return `<rect width="160" height="100" fill="${bg}"/><ellipse cx="80" cy="54" rx="48" ry="24" fill="#e8e6e0"/><ellipse cx="80" cy="54" rx="40" ry="19" fill="#d4d2cc"/>${items[plate]}`;
  },
  coffee(r) {
    return `<rect width="160" height="100" fill="${pick(r, ['#3a2a1e', '#2a3038', '#5a3a2a'])}"/><rect y="70" width="160" height="30" fill="#6a5040"/>
      <path d="M62 40h36l-4 40h-28z" fill="${pick(r, ['#f4f0e4', '#2a6aa8', '#e8e0c8'])}"/><rect x="62" y="40" width="36" height="5" fill="#1e1e22"/>
      <path d="M72 34q-4-8 2-14M84 34q-4-8 2-14" stroke="#ddd" stroke-width="2" fill="none" opacity=".7"/>`;
  },
  cat(r) {
    const fur = pick(r, ['#3a3630', '#c8823a', '#d8d4cc', '#1e1e1e']);
    return `<rect width="160" height="100" fill="#4a3a2a"/>
      ${Array.from({ length: 6 }, (_, i) => `<rect x="${4 + i * 26}" y="18" width="20" height="26" fill="${pick(r, ['#c83a2a', '#e0b030', '#3a7ac8', '#4aa86a', '#e8e0c8'])}"/>`).join('')}
      <rect y="44" width="160" height="6" fill="#6a5a44"/><ellipse cx="82" cy="70" rx="30" ry="16" fill="${fur}"/><circle cx="104" cy="58" r="12" fill="${fur}"/>
      <path d="M95 50l3-9 5 6M108 47l4-8 3 9" fill="${fur}"/><rect x="100" y="56" width="3" height="3" fill="#cfe86a"/><rect x="108" y="56" width="3" height="3" fill="#cfe86a"/>
      <path d="M54 72q-14 -2 -12 -16" stroke="${fur}" stroke-width="5" fill="none"/>`;
  },
  park(r) {
    return `<rect width="160" height="100" fill="${pick(r, ['#9ac8e8', '#e8b07a', '#c8d8e0'])}"/><rect y="60" width="160" height="40" fill="#4a7a3a"/>
      <rect x="${20 + r() * 20}" y="30" width="6" height="34" fill="#5a3a22"/><circle cx="${23 + r() * 20}" cy="30" r="18" fill="#2e5a2a"/>
      <rect x="90" y="62" width="44" height="4" fill="#7a5a3a"/><rect x="92" y="66" width="3" height="8" fill="#555"/><rect x="128" y="66" width="3" height="8" fill="#555"/>
      <path d="M0 84 Q80 70 160 86 V100 H0z" fill="#c8b890"/>`;
  },
  store(r) {
    return `<rect width="160" height="100" fill="#1a1a22"/><rect x="10" y="20" width="140" height="80" fill="#d8d4cc"/>
      <rect x="10" y="20" width="140" height="16" fill="#d83a2a"/><text x="80" y="32" font-family="monospace" font-size="10" fill="#fff" text-anchor="middle">QUIK-STOP #14</text>
      <rect x="22" y="44" width="50" height="40" fill="#8ac8e8" opacity=".8"/><rect x="88" y="44" width="50" height="56" fill="#2a3a4a"/>
      <text x="47" y="66" font-family="monospace" font-size="7" fill="#d83a2a" text-anchor="middle">${pick(r, ['2/$3', 'HIRING', 'ATM', 'LOTTO'])}</text>`;
  },
  beer(r) {
    return `<rect width="160" height="100" fill="#2a2e38"/><rect y="66" width="160" height="34" fill="#4a4a50"/>
      <rect x="66" y="26" width="26" height="54" rx="3" fill="${pick(r, ['#c8a03a', '#d83a2a', '#2a6aa8'])}"/><rect x="66" y="40" width="26" height="14" fill="#f4f0e4"/>
      <rect x="62" y="22" width="34" height="62" fill="#7a5a3a" opacity=".55"/><text x="79" y="50" font-family="monospace" font-size="6" fill="#222" text-anchor="middle">24oz</text>`;
  },
  church(r) {
    return `<rect width="160" height="100" fill="${pick(r, ['#2a1a3a', '#f2d070'])}"/><path d="M40 100V44l40-26 40 26v56z" fill="#e8c860"/>
      <rect x="76" y="4" width="8" height="22" fill="#fff2b0"/><rect x="70" y="10" width="20" height="6" fill="#fff2b0"/>
      <rect x="68" y="66" width="24" height="34" fill="#6a3a1a"/><circle cx="80" cy="50" r="7" fill="#fff8d8"/>`;
  },
  building(r) {
    return `<rect width="160" height="100" fill="#8aa8c0"/><rect x="30" y="8" width="100" height="92" fill="#8a4a3a"/>
      ${Array.from({ length: 12 }, (_, i) => `<rect x="${40 + (i % 4) * 22}" y="${16 + Math.floor(i / 4) * 22}" width="12" height="14" fill="${r() < 0.3 ? '#ffd77a' : '#2a3038'}"/>`).join('')}
      <rect x="68" y="80" width="24" height="20" fill="#3a2a1e"/><text x="80" y="78" font-family="monospace" font-size="6" fill="#eee" text-anchor="middle">1120</text>`;
  },
  flowers(r) {
    return `<rect width="160" height="100" fill="#e8e0d0"/><rect x="62" y="56" width="36" height="40" fill="#5a8ac8"/>
      ${Array.from({ length: 7 }, () => { const x = 60 + r() * 40, y = 20 + r() * 30; return `<path d="M80 58 L${x} ${y}" stroke="#4a7a3a" stroke-width="2"/><circle cx="${x}" cy="${y}" r="6" fill="${pick(r, ['#f4d23a', '#e04a6a', '#f4a03a', '#fff'])}"/>`; }).join('')}`;
  },
  papers(r) {
    return `<rect width="160" height="100" fill="#4a7a3a"/>
      ${Array.from({ length: 6 }, (_, i) => `<rect x="${40 + i * 3 + r() * 4}" y="${20 + i * 2}" width="70" height="60" fill="#f8f4ea" transform="rotate(${(r() - 0.5) * 12} 80 50)"/>`).join('')}
      <path d="M58 40h40M58 48h36M58 56h40" stroke="#555" stroke-width="1.5"/><text x="96" y="74" font-family="monospace" font-size="14" fill="#d83a2a">${pick(r, ['B-', 'C+', 'A', 'see me'])}</text>`;
  },
  shoes(r) {
    return `<rect width="160" height="100" fill="#c8c0b0"/><rect y="70" width="160" height="30" fill="#8a8478"/>
      <path d="M30 62q20-20 46-6l14 8v8H30z" fill="${pick(r, ['#e8e8ec', '#2a6aa8', '#d83a2a'])}"/><rect x="30" y="70" width="60" height="5" fill="#f4f4f4"/>
      <path d="M86 66q20-20 46-6l14 8v8H86z" fill="${pick(r, ['#e8e8ec', '#2a6aa8', '#d83a2a'])}"/><rect x="86" y="74" width="60" height="5" fill="#f4f4f4"/>`;
  },
  rain(r) {
    return `<rect width="160" height="100" fill="#2a3440"/>${skylineRow(r, 100, 50, '#1a2028', 0.2)}
      ${Array.from({ length: 40 }, () => { const x = r() * 160, y = r() * 100; return `<path d="M${x} ${y}l-3 9" stroke="#8ab0c8" stroke-width="1" opacity=".7"/>`; }).join('')}`;
  },
};

/** An <img> for a post's picture, or '' when it has none. */
export function postImage(post, authorKind) {
  if (!post.img) return '';
  if (post.img === 'selfie') {
    if (!authorKind) return '';
    const shot = personShot({ kind: authorKind, room: ['bedroom', 'kitchen', 'stoop', 'apartment'][(post.seed || 1) % 4], pose: 'selfie', seed: post.seed || 1, w: 96, h: 96 });
    return `<div class="fpost__img fpost__img--selfie"><img src="${shot || portraitURL(authorKind, 'content')}" alt="" /></div>`;
  }
  const scene = SCENES[post.img];
  if (!scene) return '';
  const shot = sceneShot(post.img, post.seed || 1);
  return `<div class="fpost__img"><img src="${shot || svgURL(scene(rng(post.seed || 1)))}" alt="" /></div>`;
}

export const SCENE_IDS = Object.keys(SCENES);

/** Backdrops for Mo's own pictures: his bathroom, his room, the stoop, the block at night. */
const MO_SCENES = {
  bath: () => '<rect width="160" height="100" fill="#bcd4d8"/>' + Array.from({ length: 50 }, (_, i) => `<rect x="${(i % 10) * 16 + (Math.floor(i / 10) % 2) * 8}" y="${Math.floor(i / 10) * 16}" width="15" height="15" fill="#c8e0e4"/>`).join('') + '<rect x="10" y="6" width="140" height="70" fill="none" stroke="#e8e8e8" stroke-width="3"/><path d="M20 10l30 30M100 8l40 50" stroke="#fff" stroke-width="1" opacity=".6"/>',
  room: () => '<rect width="160" height="100" fill="#8a7a6a"/><rect x="100" y="10" width="44" height="34" fill="#6a8ab0" stroke="#e8e0d0" stroke-width="3"/><rect x="0" y="78" width="160" height="22" fill="#5a4a3a"/><rect x="12" y="20" width="24" height="30" fill="#c8a85a" opacity=".6"/>',
  stoop: (r) => skylineRow(r, 70, 40, '#3a3a44', 0.1).replace(/^/, '<rect width="160" height="100" fill="#8ab0d0"/>') + '<rect x="0" y="70" width="160" height="30" fill="#6a6a70"/>',
  night: (r) => SCENES.night(r),
};

/** One of Mo's own posts: him, in front of somewhere, and a play button if it is a lip sync. */
export function moPostImage(p) {
  // Mo himself, in the game's model, in front of the place he posted from
  const shot = personShot({ kind: 'mo', room: { bath: 'bathroom', room: 'apartment', stoop: 'stoop', night: 'night' }[p.scene] || 'apartment', pose: p.snap === 'video' ? 'peace' : 'selfie', seed: p.seed || 1, w: 128, h: 80 });
  if (shot) {
    return `<div class="fpost__img fpost__img--mo3d${p.snap === 'video' ? ' fpost__img--video' : ''}"><img src="${shot}" alt="" />
    ${p.snap === 'video' ? `<span class="fpost__play">▶</span><span class="fpost__dur">0:${String(12 + (p.seed % 40)).padStart(2, '0')}</span>` : ''}</div>`;
  }
  const r = rng(p.seed || 1);
  const bg = svgURL((MO_SCENES[p.scene] || MO_SCENES.room)(r));
  const tilt = ((p.seed % 9) - 4) * 1.5;
  return `<div class="fpost__img fpost__img--mo${p.snap === 'video' ? ' fpost__img--video' : ''}" style="background-image:url('${bg}')">
    <img src="${portraitURL('mo', p.mood || 'content')}" alt="" style="transform:rotate(${tilt}deg)" />
    ${p.snap === 'video' ? `<span class="fpost__play">▶</span><span class="fpost__dur">0:${String(12 + (p.seed % 40)).padStart(2, '0')}</span>` : ''}
  </div>`;
}
