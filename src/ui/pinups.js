/**
 * The pictures the women on LonelyFans text Mo, and the thumbnails on DialUpDelights: a flat,
 * cartoon figure in a pose (a selfie at arm's length, hands on hips, a peace sign, hands behind
 * the head, a cat held up like a shield), in a room, shot on a phone from 1999. The face is
 * always in frame; the chest and the lap are always under a pixel mosaic, because this is a
 * parody and the mosaic is the joke. Everything is an SVG drawn from a seed, so a picture looks
 * the same every time it is opened again.
 */

function rng(seed) {
  let t = seed >>> 0;
  return () => { t = (t + 0x6d2b79f5) >>> 0; let r = Math.imul(t ^ (t >>> 15), 1 | t); r ^= r + Math.imul(r ^ (r >>> 7), 61 | r); return ((r ^ (r >>> 14)) >>> 0) / 4294967296; };
}
const pick = (r, a) => a[Math.floor(r() * a.length)];

export const POSES = ['selfie', 'hips', 'peace', 'behind', 'cat', 'kiss'];
const ROOMS = ['bedroom', 'bathroom', 'neon', 'kitchen', 'motel'];
const SKINS = ['#f2c9a8', '#e0a87e', '#c08458', '#9a6440', '#6e4428', '#f6d8c0'];
const HAIRS = ['#1a1210', '#3a2418', '#6a3a1e', '#c89a4a', '#e8d090', '#8a1e1e', '#d83a8a', '#2a2a3a'];
const STYLES = ['long', 'bun', 'bob', 'curls', 'pony'];

/** The LonelyFans women, so their pictures look like the same woman every time. */
export const LOOKS = {
  velvet: { skin: '#c08458', hair: '#1a1210', style: 'long', lips: '#8a1e3a', room: 'bedroom' },
  cherry: { skin: '#f2c9a8', hair: '#8a1e1e', style: 'bob', lips: '#d81e2a', room: 'neon' },
  mona: { skin: '#e0a87e', hair: '#3a2418', style: 'curls', lips: '#c84a5a', room: 'kitchen' },
  jade: { skin: '#6e4428', hair: '#1a1210', style: 'pony', lips: '#a83a4a', room: 'bathroom' },
};

/** A random woman for the adult site: same seed, same woman. */
export function randomLook(seed) {
  const r = rng(seed * 7 + 3);
  return { skin: pick(r, SKINS), hair: pick(r, HAIRS), style: pick(r, STYLES), lips: pick(r, ['#c8283a', '#a83a5a', '#d84a6a', '#8a1e3a']), room: pick(r, ROOMS) };
}

function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const c = (v) => Math.max(0, Math.min(255, Math.round(v * f)));
  return `rgb(${c(n >> 16)},${c((n >> 8) & 255)},${c(n & 255)})`;
}

function room(r, id) {
  switch (id) {
    case 'bathroom': {
      let t = '<rect width="120" height="160" fill="#bcd4d8"/>';
      for (let y = 0; y < 160; y += 10) for (let x = (y / 10) % 2 ? 5 : 0; x < 120; x += 10) t += `<rect x="${x}" y="${y}" width="9" height="9" fill="#c8e0e4"/>`;
      return t + '<rect x="78" y="8" width="36" height="46" fill="#9ab8c0" stroke="#e8e8e8" stroke-width="2"/><rect x="0" y="130" width="120" height="30" fill="#e8e8ec"/>';
    }
    case 'neon':
      return `<defs><linearGradient id="nb" x2="0" y2="1"><stop stop-color="#2a0a3a"/><stop offset="1" stop-color="#6a1a5a"/></linearGradient></defs><rect width="120" height="160" fill="url(#nb)"/>
        <text x="96" y="30" font-family="monospace" font-size="11" font-weight="bold" fill="#ff5ab8" text-anchor="middle">${pick(r, ['OPEN', 'XOXO', 'LOVE', '24HR'])}</text><rect x="74" y="20" width="44" height="14" fill="none" stroke="#ff5ab8" stroke-width="1.5" opacity=".8"/>`;
    case 'kitchen':
      return '<rect width="120" height="160" fill="#e8d8a8"/><rect x="0" y="0" width="120" height="40" fill="#d8c898"/><rect x="6" y="6" width="30" height="26" fill="#8ab0d0" stroke="#fff" stroke-width="2"/><rect x="0" y="118" width="120" height="42" fill="#8a5a3a"/><rect x="0" y="116" width="120" height="4" fill="#d8d8d8"/><rect x="92" y="96" width="10" height="20" fill="#e8e8e8"/>';
    case 'motel':
      return '<rect width="120" height="160" fill="#7a6a4a"/><rect x="0" y="0" width="120" height="160" fill="url(#mp)" opacity=".3"/><defs><pattern id="mp" width="12" height="12" patternUnits="userSpaceOnUse"><circle cx="6" cy="6" r="2" fill="#c8a85a"/></pattern></defs><rect x="0" y="120" width="120" height="40" fill="#5a2a2a"/><rect x="84" y="10" width="28" height="20" fill="#3a6a5a" stroke="#c8a85a" stroke-width="2"/>';
    default: // bedroom
      return `<rect width="120" height="160" fill="${pick(r, ['#c8a8c8', '#a8b8d8', '#d8b8a8', '#b8c8a8'])}"/><rect x="0" y="112" width="120" height="48" fill="${pick(r, ['#e8e8f0', '#d84a6a', '#4a5a8a'])}"/><rect x="0" y="108" width="120" height="8" fill="#f4f4f4"/><rect x="96" y="70" width="18" height="40" fill="#6a4a2a"/><path d="M96 70l9-14 9 14z" fill="#f2e0a0"/>`;
  }
}

/** Arms per pose: [elbow, hand] for the left and the right, in the 120 x 160 frame. */
const ARMS = {
  selfie: [[[38, 78], [50, 92]], [[90, 48], [96, 26]]],
  hips: [[[36, 76], [49, 92]], [[84, 76], [71, 92]]],
  peace: [[[42, 80], [44, 100]], [[88, 62], [78, 32]]],
  behind: [[[30, 36], [50, 22]], [[90, 36], [70, 22]]],
  cat: [[[40, 84], [54, 94]], [[80, 84], [66, 94]]],
  kiss: [[[42, 80], [44, 100]], [[84, 60], [72, 42]]],
};

function hairBack(look) {
  const h = look.hair;
  switch (look.style) {
    case 'long': return `<path d="M44 30q16-24 32 0l6 40q-22 8-44 0z" fill="${h}"/>`;
    case 'curls': return [[46, 30], [74, 30], [42, 44], [78, 44], [44, 56], [76, 56], [60, 20]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="10" fill="${h}"/>`).join('');
    case 'pony': return `<path d="M72 26q20 6 14 40q-4-18-14-26z" fill="${h}"/>`;
    case 'bun': return `<circle cx="60" cy="16" r="8" fill="${h}"/>`;
    default: return `<path d="M45 30q15-22 30 0v18h-30z" fill="${h}"/>`;
  }
}

function face(r, look, pose) {
  const wink = r() < 0.3;
  const eyeL = '<ellipse cx="55" cy="34" rx="2" ry="2.4" fill="#1a1a2a"/><path d="M52 31l-2-2M54 30.5l-1-2.5" stroke="#1a1a2a" stroke-width=".8"/>';
  const eyeR = wink ? '<path d="M63 34q2.5 2 5 0" stroke="#1a1a2a" stroke-width="1.2" fill="none"/>' : '<ellipse cx="65" cy="34" rx="2" ry="2.4" fill="#1a1a2a"/><path d="M68 31l2-2M66 30.5l1-2.5" stroke="#1a1a2a" stroke-width=".8"/>';
  const mouth = pose === 'kiss' ? `<circle cx="60" cy="42" r="2.4" fill="${look.lips}"/>` : r() < 0.5 ? `<path d="M56 41q4 4 8 0" stroke="${look.lips}" stroke-width="2" fill="none" stroke-linecap="round"/>` : `<ellipse cx="60" cy="42" rx="3.4" ry="1.8" fill="${look.lips}"/>`;
  const fringe = { bob: `<path d="M46 32q4-14 14-14t14 14q-8-6-14-6t-14 6z" fill="${look.hair}"/>`, curls: '', bun: `<path d="M47 28q13-14 26 0q-13-6-26 0z" fill="${look.hair}"/>` }[look.style]
    ?? `<path d="M46 32q2-16 14-16t14 16q-6-10-14-8t-14 8z" fill="${look.hair}"/>`;
  return `<ellipse cx="60" cy="34" rx="13" ry="14" fill="${look.skin}"/>${fringe}
    <path d="M52 29.5h5M63 29.5h5" stroke="${shade(look.hair, 0.9)}" stroke-width="1.2"/>${eyeL}${eyeR}
    <circle cx="52" cy="39" r="2.4" fill="#ff7a8a" opacity=".35"/><circle cx="68" cy="39" r="2.4" fill="#ff7a8a" opacity=".35"/>${mouth}`;
}

/** The censor: a block of chunky pixels the colour of skin, just enough pink to be a joke. */
function mosaic(r, look, x, y, w, h) {
  const cell = 5;
  let out = '';
  for (let cy = y; cy < y + h; cy += cell) for (let cx = x; cx < x + w; cx += cell) {
    const f = 0.62 + r() * 0.62;
    out += `<rect x="${cx}" y="${cy}" width="${cell}" height="${cell}" fill="${r() < 0.2 ? pick(r, ['#e88a9a', '#d86a7a', '#f4b0b8']) : shade(look.skin, f)}"/>`;
  }
  return out;
}

function cat(r) {
  const fur = pick(r, ['#e8862a', '#2a2a2a', '#9a9aa0', '#f2f2ec', '#6a4a2a']);
  const eye = pick(r, ['#8ad83a', '#e8c83a', '#3aa8e8']);
  return `<ellipse cx="60" cy="96" rx="24" ry="26" fill="${fur}"/>
    <circle cx="60" cy="68" r="15" fill="${fur}"/><path d="M47 60l2-14 9 8zM73 60l-2-14-9 8z" fill="${fur}"/>
    <ellipse cx="54" cy="67" rx="2.6" ry="3.4" fill="${eye}"/><ellipse cx="66" cy="67" rx="2.6" ry="3.4" fill="${eye}"/>
    <rect x="53.5" y="65" width="1.2" height="4.4" fill="#111"/><rect x="65.5" y="65" width="1.2" height="4.4" fill="#111"/>
    <path d="M58 72h4l-2 2z" fill="#e88a9a"/><path d="M48 74h-8M48 76l-7 2M72 74h8M72 76l7 2" stroke="#eee" stroke-width=".6"/>
    <path d="M82 110q14 0 12-22" stroke="${fur}" stroke-width="6" fill="none" stroke-linecap="round"/>`;
}

/** The SVG body of a picture: the room, her, the censor, the phone-camera timestamp. */
function picture({ look, pose, seed }) {
  const r = rng(seed);
  const sk = look.skin;
  const dark = shade(sk, 0.85);
  const [L, R] = ARMS[pose] || ARMS.hips;
  const arm = ([e, h], s) => `<path d="M${s[0]} ${s[1]}L${e[0]} ${e[1]}L${h[0]} ${h[1]}" stroke="${dark}" stroke-width="7" fill="none" stroke-linecap="round" stroke-linejoin="round"/><circle cx="${h[0]}" cy="${h[1]}" r="4" fill="${sk}"/>`;
  const legs = pose === 'behind' || r() < 0.5
    ? `<path d="M54 100L50 128L52 158M66 100L72 128L68 158" stroke="${dark}" stroke-width="9" fill="none" stroke-linecap="round"/>`
    : `<path d="M54 100L54 130L50 158M66 100L58 128L64 158" stroke="${dark}" stroke-width="9" fill="none" stroke-linecap="round"/>`;
  const torso = `<path d="M46 54Q60 50 74 54L70 80Q74 92 74 102L46 102Q46 92 50 80Z" fill="${sk}"/><rect x="56" y="46" width="8" height="10" fill="${dark}"/>`;
  const phone = pose === 'selfie' ? '<rect x="92" y="14" width="9" height="15" rx="1.5" fill="#1a1a22" stroke="#555"/>' : '';
  const peace = pose === 'peace' ? `<path d="M76 30l-3-9M80 30l2-9" stroke="${sk}" stroke-width="2.4" stroke-linecap="round"/>` : '';
  const kiss = pose === 'kiss' ? '<path d="M76 42q8-6 14-2" stroke="#ff7aa8" stroke-width="1" fill="none" stroke-dasharray="2 2"/><text x="94" y="38" font-size="9" fill="#ff5a8a">♥</text>' : '';
  const censor = pose === 'cat' ? cat(r) : mosaic(r, look, 44, 56, 32, 20) + mosaic(r, look, 46, 90, 28, 15);
  const time = `${(r() < 0.5 ? 11 : 1) + Math.floor(r() * 2)}:${String(Math.floor(r() * 60)).padStart(2, '0')} PM`;
  return `${room(r, look.room)}${hairBack(look)}${legs}${torso}${arm(L, [48, 56])}${arm(R, [72, 56])}${censor}${face(r, look, pose)}${phone}${peace}${kiss}
    <text x="4" y="155" font-family="monospace" font-size="7" fill="#ffa83a" opacity=".85">${time}</text>
    <rect width="120" height="160" fill="url(#pvg)" opacity=".4"/><defs><radialGradient id="pvg"><stop offset=".6" stop-opacity="0"/><stop offset="1" stop-color="#000"/></radialGradient></defs>`;
}

const url = (body) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 160" shape-rendering="crispEdges">${body}</svg>`)}`;

/** A picture as a data URL: `look` is a LOOKS entry or a randomLook(seed). */
export function pinupURL(look, pose = 'hips', seed = 1) {
  return url(picture({ look, pose, seed }));
}

/** A LonelyFans model's picture by id. */
export function modelPicURL(modelId, pose, seed) {
  return pinupURL(LOOKS[modelId] || randomLook(seed), pose, seed);
}

/** For messages: pick a pose for a new picture, avoiding the cat for the ones who would never. */
export function randomPose(r = Math.random) {
  return POSES[Math.floor(r() * POSES.length)];
}

/** Any message picture: { model, pose, seed } for a LonelyFans woman, { seed, pose } for a stranger. */
export function picURL(pic) {
  if (!pic) return '';
  return pic.model ? modelPicURL(pic.model, pic.pose, pic.seed) : pinupURL(randomLook(pic.seed), pic.pose, pic.seed);
}
