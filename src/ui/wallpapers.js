/**
 * MoPhone wallpapers and Snapz, the camera roll.
 *
 * Three kinds of picture can sit behind the home screen:
 *   def:<id>    the phone's own (gradients and a skyline, drawn here)
 *   mem:<id>    memories, unlocked by what happens in the run: Chairman moving in, Meatball
 *               deciding he is Mo's, a girlfriend, the first shift, Nia as a kid, a cloud of
 *               smoke, a mugshot, a suit
 *   photo:<id>  anything Mo took with the camera (the game's own frame, cropped to the phone)
 *
 * Memories are drawn as SVG around the portraits the HUD already uses (data URLs, so they embed),
 * which keeps them in the art style and costs nothing in the save. Photos are small JPEGs kept in
 * `s.phone.photos`, nine at most.
 */
import { CONFIG } from '../core/config.js';
import { portraitURL } from '../render/faces.js';
import { partnerState } from '../systems/romance.js';
import { dogState } from '../world/streetlife.js';

export const MAX_PHOTOS = 9;

export function phoneState(s) {
  if (!s.phone) s.phone = {};
  const p = s.phone;
  p.photos = Array.isArray(p.photos) ? p.photos : [];
  p.memSeen = Array.isArray(p.memSeen) ? p.memSeen : [];
  return p;
}

const enc = (body, w = 180, h = 320) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid slice">${body}</svg>`)}`;
const grad = (id, a, b, vertical = true) => `<defs><linearGradient id="${id}" x1="0" y1="0" x2="${vertical ? 0 : 1}" y2="${vertical ? 1 : 0}"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs>`;
const img = (href, x, y, w, h, extra = '') => `<image href="${href}" xlink:href="${href}" x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid slice" ${extra}/>`;
const caption = (text, y = 300, color = '#fff') => `<text x="90" y="${y}" font-family="monospace" font-size="10" font-weight="bold" fill="${color}" text-anchor="middle" letter-spacing="1">${text}</text>`;
const frame = (x, y, w, h, href, rot = 0, extra = '') => `<g transform="rotate(${rot} ${x + w / 2} ${y + h / 2})"><rect x="${x - 5}" y="${y - 5}" width="${w + 10}" height="${h + 22}" fill="#f4f0e4"/>${img(href, x, y, w, h, extra)}</g>`;
const skyline = (y, col, seed = 1) => {
  let x = 0, out = '', r = seed;
  const rnd = () => { r = (r * 9301 + 49297) % 233280; return r / 233280; };
  while (x < 180) { const w = 14 + rnd() * 20, h = 30 + rnd() * 70; out += `<rect x="${x}" y="${y - h}" width="${w}" height="${h + 200}" fill="${col}"/>`; for (let wy = y - h + 6; wy < y; wy += 9) for (let wx = x + 3; wx < x + w - 3; wx += 6) if (rnd() < 0.3) out += `<rect x="${wx}" y="${wy}" width="2" height="3" fill="#ffd77a"/>`; x += w + 2; }
  return out;
};

/** The phone's own wallpapers. */
const DEFAULTS = {
  // a real photo, stylized to the game's look: Mo's first day at Quik-Stop, with his mother. Every run
  // starts with it.
  mom: { name: 'Day One, with Ma', url: 'assets/img/wallpapers/firstday_mom.jpg' },
  dusk: { name: 'Kestrel Dusk', draw: () => `${grad('g', '#ff8a5a', '#2a1a4a')}<rect width="180" height="320" fill="url(#g)"/>${skyline(320, '#1a1424', 3)}` },
  neon: { name: 'Bodega Neon', draw: () => `${grad('g', '#120a24', '#3a0a3a')}<rect width="180" height="320" fill="url(#g)"/><rect x="30" y="110" width="120" height="44" rx="8" fill="none" stroke="#ff5ab8" stroke-width="3"/><text x="90" y="141" font-family="monospace" font-size="20" font-weight="bold" fill="#ff8ad0" text-anchor="middle">OPEN 24</text><rect x="40" y="170" width="100" height="6" fill="#5af2ff" opacity=".6"/>` },
  static: { name: 'Channel 3', draw: () => { let o = '<rect width="180" height="320" fill="#222"/>'; let r = 7; for (let i = 0; i < 900; i++) { r = (r * 9301 + 49297) % 233280; const v = Math.floor((r / 233280) * 200) + 30; o += `<rect x="${(i * 37) % 180}" y="${Math.floor(i / 5) * 1.8}" width="4" height="2" fill="rgb(${v},${v},${v})"/>`; } return o; } },
  bridge: { name: 'The Bridge', draw: () => `${grad('g', '#7ab0d8', '#e8d0b0')}<rect width="180" height="320" fill="url(#g)"/><rect y="230" width="180" height="90" fill="#3a5a7a"/><path d="M0 200 L180 200" stroke="#4a4a52" stroke-width="5"/><path d="M50 200 V90 M130 200 V90" stroke="#5a5a62" stroke-width="10"/><path d="M0 170 Q50 90 50 90 Q90 160 130 90 Q180 170 180 170" stroke="#4a4a52" stroke-width="2" fill="none"/>` },
  plain: { name: 'Shale Grey', draw: () => `${grad('g', '#3a3e44', '#16181c')}<rect width="180" height="320" fill="url(#g)"/>` },
};

/** Memories: when each one unlocks, and what it looks like. */
const MO = (mood = 'content') => portraitURL('mo', mood);
const MEMORIES = [
  {
    id: 'cat', name: 'Me and Chairman', when: (s) => !!s.flags?.cat,
    draw: () => `${grad('g', '#e8b878', '#7a4a2a')}<rect width="180" height="320" fill="url(#g)"/>${frame(30, 50, 120, 160, MO('content'), -3)}
      <g transform="translate(52 196) scale(1.5)"><ellipse cx="28" cy="34" rx="34" ry="24" fill="#3a3630"/><circle cx="28" cy="8" r="17" fill="#3a3630"/><path d="M14 0 l3-14 9 8z M42 0 l-3-14-9 8z" fill="#3a3630"/><circle cx="21" cy="7" r="3" fill="#c8e83a"/><circle cx="35" cy="7" r="3" fill="#c8e83a"/><path d="M26 14h4l-2 2z" fill="#e88a9a"/></g>${caption('ME AND CHAIRMAN')}`,
  },
  {
    id: 'dog', name: 'Good boy', when: (s) => dogState(s).like >= 100,
    draw: (s) => `${grad('g', '#8ac0e8', '#5a8a4a')}<rect width="180" height="320" fill="url(#g)"/><rect y="230" width="180" height="90" fill="#4a7a3a"/>${frame(28, 40, 124, 166, MO('content'), 2)}
      <g transform="translate(40 200)"><ellipse cx="50" cy="40" rx="42" ry="22" fill="#9a7448"/><circle cx="96" cy="22" r="18" fill="#9a7448"/><path d="M84 10 l-6 18 8-4z" fill="#4f3a24"/><circle cx="102" cy="19" r="2.5" fill="#111"/><circle cx="114" cy="26" r="4" fill="#111"/><path d="M8 40 q-14 -16 -6 -26" stroke="#9a7448" stroke-width="6" fill="none"/><ellipse cx="80" cy="6" rx="14" ry="8" fill="#8c5f40"/></g>${caption(`${String(dogState(s).name || 'MEATBALL').toUpperCase()} · GOOD BOY`)}`,
  },
  ...Object.keys(CONFIG.partners || {}).map((id) => ({
    id: `gf_${id}`, name: `Us (${CONFIG.partners[id].name})`, when: (s) => !!partnerState(s, id)?.girlfriend,
    draw: () => {
      const hues = { stephanie: ['#ff8aa8', '#5a1a3a'], melanie: ['#ffb05a', '#3a1a1a'], diana: ['#8ad0ff', '#1a2a5a'] }[id] || ['#ff8aa8', '#3a1a3a'];
      const hearts = Array.from({ length: 9 }, (_, i) => `<text x="${(i * 47) % 170 + 5}" y="${30 + ((i * 71) % 260)}" font-size="${14 + (i % 3) * 6}" fill="#fff" opacity=".35">♥</text>`).join('');
      return `${grad('g', hues[0], hues[1])}<rect width="180" height="320" fill="url(#g)"/>${hearts}${frame(14, 70, 92, 124, MO('content'), -6)}${frame(76, 92, 92, 124, portraitURL(id, 'content'), 5)}${caption(`ME + ${CONFIG.partners[id].name.toUpperCase()} ♥`, 280)}`;
    },
  })),
  {
    id: 'work', name: 'Day one', when: (s) => (s.counters?.shifts || 0) >= 1,
    draw: () => `${grad('g', '#2f6a4a', '#123a26')}<rect width="180" height="320" fill="url(#g)"/><rect x="0" y="20" width="180" height="26" fill="#e8c83a"/><text x="90" y="39" font-family="monospace" font-size="14" font-weight="bold" fill="#2f6a4a" text-anchor="middle">QUIK-STOP #14</text>
      ${img(MO('content'), 20, 70, 140, 186)}<path d="M28 256 Q90 214 152 256 L160 320 L20 320 Z" fill="#2f6a4a"/><path d="M80 224 L90 244 L100 224" stroke="#e8e8e0" stroke-width="4" fill="none"/><rect x="110" y="250" width="22" height="8" fill="#e8c83a"/><text x="140" y="120" font-size="34">👍</text>${caption('DAY ONE. PROUD. TIRED.', 306, '#e8c83a')}`,
  },
  {
    id: 'nia', name: 'Ashby Ave, 1986', when: (s) => (s.sister?.visits || 0) >= 1 || (Number(s.npc?.nia) || 0) >= 3,
    draw: () => `<defs><filter id="sep"><feColorMatrix type="matrix" values=".39 .77 .19 0 0 .35 .69 .17 0 0 .27 .53 .13 0 0 0 0 0 1 0"/></filter></defs><rect width="180" height="320" fill="#5a4a3a"/>
      <g filter="url(#sep)">${frame(24, 70, 132, 150, '', -2)}${img(MO('content'), 32, 96, 64, 86)}${img(portraitURL('nia', 'content'), 86, 106, 58, 78)}<rect x="24" y="190" width="132" height="30" fill="#8a7a5a"/></g>
      <text x="90" y="248" font-family="cursive, serif" font-size="11" fill="#e8dcc0" text-anchor="middle">Mo &amp; Nia · Ashby Ave · 1986</text><text x="90" y="264" font-family="cursive, serif" font-size="9" fill="#c8b898" text-anchor="middle">(she bit him right after this)</text>`,
  },
  {
    id: 'smoke', name: 'Cloud nine', when: (s) => (s.counters?.doses || 0) >= 1 || !!s.flags?.kevHung,
    draw: () => `${grad('g', '#1a2a3a', '#0a0a12')}<rect width="180" height="320" fill="url(#g)"/>${img(MO('high'), 20, 110, 140, 186)}
      ${[[60, 90, 26], [100, 70, 34], [140, 96, 22], [80, 40, 30], [130, 30, 24], [40, 50, 18]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#d8e2dc" opacity=".55"/>`).join('')}${caption('CLOUD NINE (AND TEN)', 28, '#d8e2dc')}`,
  },
  {
    id: 'mugshot', name: 'Booking photo', when: (s) => (s.police?.bookings || 0) >= 1,
    draw: () => `<rect width="180" height="320" fill="#c8ccc8"/>${Array.from({ length: 12 }, (_, i) => `<path d="M0 ${40 + i * 20}h180" stroke="#7a7e7a" stroke-width="1"/><text x="4" y="${38 + i * 20}" font-family="monospace" font-size="7" fill="#5a5e5a">${7 - Math.floor(i / 2)}'${i % 2 ? '6' : '0'}"</text>`).join('')}
      ${img(MO('sick'), 25, 60, 130, 174)}<rect x="40" y="236" width="100" height="40" fill="#141416"/><text x="90" y="252" font-family="monospace" font-size="9" fill="#fff" text-anchor="middle">KINGS CO · 84 PCT</text><text x="90" y="268" font-family="monospace" font-size="10" fill="#fff" text-anchor="middle">0451-1999</text>`,
  },
  {
    id: 'suit', name: 'Looking like a loan approval', when: (s) => (s.wardrobe?.owned || []).includes('sunday') || (s.counters?.sundaysAttended || 0) >= 1,
    draw: () => `${grad('g', '#3a5a8a', '#0e1a2e')}<rect width="180" height="320" fill="url(#g)"/><circle cx="90" cy="130" r="80" fill="#fff" opacity=".08"/>${img(MO('content'), 20, 60, 140, 186)}
      <path d="M22 246 Q90 210 158 246 L166 320 L14 320 Z" fill="#141418"/><path d="M78 222 L90 250 L102 222 Z" fill="#f2f2ec"/><path d="M86 228 L90 262 L94 228 Z" fill="#a8181e"/><path d="M60 236 L80 226 L84 270 Z M120 236 L100 226 L96 270 Z" fill="#22222a"/>${caption('LOOKING LIKE A LOAN APPROVAL', 306, '#e8e8f0')}`,
  },
];

export const defaultWallpapers = () => Object.entries(DEFAULTS).map(([id, d]) => ({ key: `def:${id}`, name: d.name }));
export const unlockedMemories = (s) => MEMORIES.filter((m) => { try { return m.when(s); } catch { return false; } });

const cache = new Map();
/** The picture for a wallpaper key, as a URL; unknown keys fall back to the first default. */
export function wallpaperURL(s, key) {
  const [kind, id] = String(key || 'def:dusk').split(':');
  if (kind === 'photo') return phoneState(s).photos.find((p) => p.id === id)?.url || wallpaperURL(s, 'def:dusk');
  if (kind === 'mem') {
    const m = MEMORIES.find((x) => x.id === id);
    if (!m) return wallpaperURL(s, 'def:dusk');
    const k = `mem:${id}:${m.id === 'dog' ? dogState(s).name : ''}`;
    if (!cache.has(k)) cache.set(k, enc(m.draw(s)));
    return cache.get(k);
  }
  const d = DEFAULTS[id] || DEFAULTS.dusk;
  if (d.url) return d.url;
  if (!cache.has(`def:${id}`)) cache.set(`def:${id}`, enc(d.draw()));
  return cache.get(`def:${id}`);
}

/** Memories that unlocked since he last looked; marks them seen. */
export function newMemories(s) {
  const p = phoneState(s);
  const fresh = unlockedMemories(s).filter((m) => !p.memSeen.includes(m.id));
  for (const m of fresh) p.memSeen.push(m.id);
  return fresh;
}

/** Keep a photo (newest first), nine at most. */
export function addPhoto(s, url, selfie) {
  const p = phoneState(s);
  const photo = { id: Math.random().toString(36).slice(2, 8), url, selfie: !!selfie, day: Math.floor((s.clock?.m || 0) / 1440) + 1 };
  p.photos.unshift(photo);
  while (p.photos.length > MAX_PHOTOS) p.photos.pop();
  return photo;
}

export function deletePhoto(s, id) {
  const p = phoneState(s);
  p.photos = p.photos.filter((x) => x.id !== id);
  if (s.settings?.wallpaper === `photo:${id}`) s.settings.wallpaper = 'def:dusk';
}

export const memoryName = (id) => MEMORIES.find((m) => m.id === id)?.name || id;
