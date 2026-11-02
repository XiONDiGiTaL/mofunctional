/**
 * MoPhone's app catalog: every phone screen is a parody of an app you already have, with its
 * own name, tagline, brand colours and icon. Icons are inline SVG (24 unit grid, white stroke)
 * so they stay crisp at any interface scale and recolour with nothing but CSS.
 */
const svg = (body, extra = '') => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${body}</svg>`;

export const APPS = {
  messages: {
    name: 'Txtr', tag: 'read receipts are a cry for help', a: '#5bf27c', b: '#13a83d',
    icon: svg('<path d="M4 5.5h16a1.5 1.5 0 0 1 1.5 1.5v8.5A1.5 1.5 0 0 1 20 17H10l-4.5 3.5V17H4A1.5 1.5 0 0 1 2.5 15.5V7A1.5 1.5 0 0 1 4 5.5z"/><path d="M7 10.5h.01M12 10.5h.01M17 10.5h.01" stroke-width="2.6"/>'),
  },
  call: {
    name: 'Phone', tag: 'contacts · keypad · somebody might pick up', a: '#5bf27c', b: '#0e8a3a',
    icon: svg('<path d="M6.5 3.5h3l1.5 4.5-2 1.5a11 11 0 0 0 5.5 5.5l1.5-2 4.5 1.5v3a2 2 0 0 1-2 2A16.5 16.5 0 0 1 4.5 5.5a2 2 0 0 1 2-2z"/>'),
  },
  bank: {
    name: 'Shale Pay', tag: 'your money, briefly', a: '#2bd2c4', b: '#0d3550',
    icon: svg('<rect x="2.5" y="5.5" width="19" height="13" rx="2.2"/><path d="M2.5 10h19"/><path d="M6 14.5h4"/>'),
  },
  jobs: {
    name: 'LinkedOut', tag: 'open to work · open to anything', a: '#3d9bff', b: '#0a4fa3',
    icon: svg('<rect x="3" y="7.5" width="18" height="12" rx="2"/><path d="M8.5 7.5V6a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v1.5"/><path d="M3 12.5h18"/>'),
  },
  bidbay: {
    name: 'BidBay', tag: 'sell it before it sells you', a: '#ffffff', b: '#e6e8ee', light: true,
    icon: svg('<path d="M3.5 12.5 11 5h8v8l-7.5 7.5z"/><circle cx="15.5" cy="8.5" r="1.4"/>'),
  },
  calendar: {
    name: 'iDread', tag: 'every day is due', a: '#ffffff', b: '#f1f1f4', light: true, dated: true,
    icon: '',
  },
  pantry: {
    name: 'GrubHope', tag: 'hunger, delivered eventually', a: '#ffae3d', b: '#ff4d2e',
    icon: svg('<path d="M3.5 11h17a8.5 8.5 0 0 1-17 0z"/><path d="M8 7.5c0-1.5 1.5-1.5 1.5-3M12 7.5c0-1.5 1.5-1.5 1.5-3M16 7.5c0-1.5 1.5-1.5 1.5-3"/>'),
  },
  inventory: {
    name: 'Pocket Lint', tag: 'everything you own, sorted by regret', a: '#d6a66c', b: '#7a4e25',
    icon: svg('<path d="M6 8.5h12l-1 11.5H7z"/><path d="M9 8.5V7a3 3 0 0 1 6 0v1.5"/><path d="M9.5 13h5"/>'),
  },
  bills: {
    name: 'Landlordly', tag: 'the smart home that knows you owe', a: '#ff7a59', b: '#b3261e',
    icon: svg('<path d="M3.5 11 12 4l8.5 7"/><path d="M5.5 9.5V20h13V9.5"/><path d="M13.6 12.4c-.4-.6-1-.9-1.7-.9-1 0-1.7.6-1.7 1.3 0 1.8 3.6.9 3.6 2.8 0 .8-.8 1.4-1.9 1.4-.8 0-1.5-.4-1.9-1M12 10.6v1M12 17v1"/>'),
  },
  // a heart, not a camera: FeedLove is social media and love, and it should not look like anyone's logo
  social: {
    name: 'FeedLove', tag: 'be seen, briefly · be loved, rarely', a: '#ff6a86', b: '#a3123a', ring: true,
    icon: svg('<path d="M12 20.5s-7.5-4.6-7.5-10.1A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.5 2.8c0 5.5-7.5 10.1-7.5 10.1z" fill="currentColor" stroke="none"/><path d="M8.6 9.6a2 2 0 0 1 2-1.6" stroke="#ffd0da" stroke-width="1.4"/>'),
  },
  fellowship: {
    name: 'Blessed+', tag: 'salvation, now ad-supported', a: '#ffd86b', b: '#6a2bb0',
    icon: svg('<ellipse cx="12" cy="5" rx="5" ry="1.6"/><path d="M12 9v11M8 13h8"/>'),
  },
  rolo: {
    name: "Rolo's Line", tag: 'wap 1.1 · we dont keep logs (we keep logs)', a: '#9bbc0f', b: '#0f380f',
    icon: svg('<rect x="6.5" y="2.5" width="11" height="19" rx="2"/><path d="M9 6h6v5H9z"/><path d="M9 14h.01M12 14h.01M15 14h.01M9 17h.01M12 17h.01M15 17h.01" stroke-width="2.4"/>'),
  },
  dates: {
    name: 'LoveLine', tag: 'somebody on the block', a: '#ff6b8a', b: '#8a1f4a',
    icon: svg('<path d="M12 20.5S3.5 15 3.5 9.5A4.5 4.5 0 0 1 12 6.8a4.5 4.5 0 0 1 8.5 2.7c0 5.5-8.5 11-8.5 11z"/>'),
  },
  // a parody of the trading apps, and real estate when he can afford it
  invest: {
    name: 'TradeHarder', tag: 'buy high, sell low, repeat', a: '#5ae07a', b: '#0a3a2a',
    icon: svg('<path d="M3.5 18.5 9 12l4 3.5 7.5-9"/><path d="M15.5 6.5h5v5"/>'),
  },
  // the car service
  ride: {
    name: 'HailMary', tag: 'a ride and a prayer', a: '#ff6ab0', b: '#1a1a22',
    icon: svg('<path d="M3.5 15.5 5.5 10h13l2 5.5v3h-17z"/><path d="M7 10l1.5-3.5h7L17 10"/><circle cx="7.5" cy="16.5" r="1.2" fill="currentColor"/><circle cx="16.5" cy="16.5" r="1.2" fill="currentColor"/>'),
  },
  // the online store
  shop: {
    name: "Amazin'", tag: 'everything, eventually, by the door', a: '#ffae3d', b: '#2a2a3a',
    icon: svg('<path d="M4 7.5h16l-1.5 12h-13z"/><path d="M8.5 7.5a3.5 3.5 0 0 1 7 0"/><path d="M8 14c2.5 2 5.5 2 8 0"/>'),
  },
  // the laptop's sites
  tube: { name: 'MeTube', tag: 'broadcast yourself (please don\'t)', a: '#ff4a4a', b: '#3a0a0a', icon: svg('<rect x="3" y="6" width="18" height="12" rx="3"/><path d="m10.5 9.5 4 2.5-4 2.5z" fill="currentColor"/>') },
  board: { name: 'Kestrel Underground', tag: 'anon bbs · est. 1997', a: '#9aa3ad', b: '#141820', icon: svg('<path d="M4 5h16v10H9l-5 4z"/>') },
  xxx: { name: 'DialUpDelights', tag: '18+ · loading 4%', a: '#ff5ab0', b: '#2a0a2a', icon: svg('<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M4 9h16M4 14h16M9 4v16M14 4v16"/>') },
  // a parody of the betting apps: slots, blackjack, a wheel. the house is real
  casino: {
    name: 'HardLuck Bet', tag: 'the house always wins · you are a guest', a: '#ffd23a', b: '#5a1a8a',
    icon: svg('<rect x="3.5" y="3.5" width="17" height="17" rx="3.5"/><circle cx="8.5" cy="8.5" r="1.3" fill="currentColor"/><circle cx="15.5" cy="15.5" r="1.3" fill="currentColor"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/><circle cx="15.5" cy="8.5" r="1.3" fill="currentColor"/><circle cx="8.5" cy="15.5" r="1.3" fill="currentColor"/>'),
  },
  // the neighbourhood board: lore, a daily notice board, and who was seen where
  block: {
    name: 'NextStoop', tag: 'your neighbours, unfortunately', a: '#8fd06a', b: '#2a5a3a',
    icon: svg('<path d="M3 20.5h18"/><path d="M5 20.5v-9l7-5.5 7 5.5v9"/><path d="M9.5 20.5v-5h5v5"/><path d="M8 8.2V4.5h2.5v1.8"/>'),
  },
  clinic: {
    name: 'Clinic', tag: 'walk-ins · no judgement', a: '#8fd0e0', b: '#26424e',
    icon: svg('<rect x="3" y="3" width="18" height="18" rx="2.5"/><path d="M12 7.5v9M7.5 12h9"/>'),
  },
  // the subscription app. locked until it is paid for; nothing on it is explicit
  fans: {
    name: 'LonelyFans', tag: 'somebody is thinking about you (for $2 a day)', a: '#ff77c8', b: '#3a0a2a',
    icon: svg('<path d="M12 20.5S3.5 15 3.5 9.5A4.5 4.5 0 0 1 12 6.8a4.5 4.5 0 0 1 8.5 2.7c0 5.5-8.5 11-8.5 11z" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="2.2" fill="#3a0a2a" stroke="none"/><path d="M18.5 5.5 20 4M19.5 8h1.8" stroke-width="1.5"/>'),
  },
  system: {
    name: 'Tweaks', tag: 'settings for a life you can’t adjust', a: '#9aa3ad', b: '#3c434b',
    icon: svg('<circle cx="12" cy="12" r="3.2"/><path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M5.5 18.5l1.7-1.7M16.8 7.2l1.7-1.7"/>'),
  },
};

/**
 * Senders that are companies, not people: their texts wear the app's icon instead of a face.
 * Values are an APPS id, or a one-off brand for services that have no app on the phone.
 */
const SERVICES = {
  'BIDBAY': 'bidbay',
  'THE GOLDEN FELLOWSHIP': 'fellowship',
  'GOLDEN FELLOWSHIP': 'fellowship',
  'SHALE BANK': 'bank',
  'SHALE PAY': 'bank',
  'FEEDLOVE': 'social',
  'LANDLORDLY': 'bills',
  'GRUBHOPE': 'pantry',
  'HAILMARY': 'ride',
  'LONELYFANS': 'fans',
  "AMAZIN'": 'shop',
  'CIVIC RELIEF PROGRAM': {
    a: '#7fd1ae', b: '#1d5c48',
    icon: svg('<path d="M12 3 4.5 6v5.5c0 4.4 3.2 8.2 7.5 9.5 4.3-1.3 7.5-5.1 7.5-9.5V6z"/><path d="m8.8 12.2 2.2 2.2 4.4-4.6"/>'),
  },
  'SHALE MOBILE': {
    a: '#ffcf6b', b: '#9c5a12',
    icon: svg('<path d="M5 18.5h2M9 18.5V15M13 18.5v-7M17 18.5V8M21 18.5V4.5"/>'),
  },
  'MUNICIPAL POWER': {
    a: '#ffe066', b: '#c27a00',
    icon: svg('<path d="M13 2.5 5.5 13.5H11l-1 8 7.5-11H12z"/>'),
  },
  'KESTREL CLINIC': {
    a: '#8fd0e0', b: '#26424e',
    icon: svg('<rect x="3" y="3" width="18" height="18" rx="2.5"/><path d="M12 7.5v9M7.5 12h9"/>'),
  },
  'KINGS COUNTY BILLING': {
    a: '#e8e2d0', b: '#5a5446',
    icon: svg('<path d="M6 2.5h9l4 4v15H6z"/><path d="M15 2.5v4h4"/><path d="M9 11h7M9 14.5h7M9 18h4"/>'),
  },
  'HARDLUCK BET': {
    a: '#ff5a6a', b: '#5a0a1a',
    icon: svg('<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8.5 8.5h.01M15.5 15.5h.01M12 12h.01M15.5 8.5h.01M8.5 15.5h.01" stroke-width="2.6"/>'),
  },
  'STEWARDSHIP OFFICE': 'fellowship',
  'KESTREL DISPATCH': {
    a: '#d8d0b8', b: '#3a3428',
    icon: svg('<rect x="3.5" y="4.5" width="17" height="15" rx="1.5"/><path d="M7 8.5h10M7 12h10M7 15.5h6"/>'),
  },
  'TRADEHARDER': 'invest',
  'NEXTSTOOP': 'block',
  'LINKEDOUT': 'jobs',
  'QUIK-STOP #14': {
    a: '#4ac86a', b: '#1a5a2a',
    icon: svg('<path d="M4 9.5 5.5 4.5h13L20 9.5"/><path d="M5 9.5v10h14v-10"/><path d="M10 19.5v-5h4v5"/>'),
  },
  'KINGS COUNTY HOSPITAL': {
    a: '#c8d8e8', b: '#2d4258',
    icon: svg('<rect x="3" y="3" width="18" height="18" rx="2.5"/><path d="M12 7.5v9M7.5 12h9"/>'),
  },
};

// people who happen to text in capitals keep their faces
const PEOPLE_CAPS = new Set(['MO', 'MOM', 'NIA', 'DALE', 'KEV', 'DEX', 'ROLO', 'RAE', 'GUS', 'HABIB', 'MIGUEL', 'ADDISON', 'ADDISON OCTAVIUS', 'RAE VELL', 'SQUEAK', 'STEPHANIE', 'MELANIE', 'DIANA', 'UNKNOWN']);
const norm = (name = '') => String(name).toUpperCase().replace(/\(.*?\)/g, '').trim();

/** The brand for a sender, or null when it is a person. */
export function serviceFor(name) {
  const key = norm(name);
  // a company signs its texts in capitals; one with no brand of its own gets a plain badge
  // with its initials, not the face of whoever the name table falls back to (which was Mo)
  const hit = SERVICES[key] || SERVICES[key.split(/ [·—-] /)[0]];
  if (!hit) {
    if (/^[A-Z0-9 #&'.·—-]{4,}$/.test(key) && /[A-Z]{3}/.test(key) && !PEOPLE_CAPS.has(key)) {
      const initials = key.replace(/[^A-Z0-9 ]/g, '').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('');
      return { id: 'service', a: '#9aa4b0', b: '#2e3640', icon: `<span class="svcavatar__initials">${initials}</span>` };
    }
    return null;
  }
  if (typeof hit === 'string') return { id: hit, ...APPS[hit] };
  return { id: 'service', ...hit };
}

/** A round avatar for a service sender, sized by the caller's class (chat__face, bubble__face). */
export function serviceAvatar(name, cls = '') {
  const s = serviceFor(name);
  if (!s) return '';
  const glyph = s.id === 'bidbay' ? '<span class="appicon__bid"><i>b</i><i>i</i><i>d</i></span>' : s.icon;
  return `<span class="svcavatar ${cls}${s.light ? ' svcavatar--light' : ''}" style="--a:${s.a};--b:${s.b}" title="${s.name || name}">${glyph}</span>`;
}

/**
 * The home screen is shelves now, not one endless grid: the phone keeps growing and a single
 * scroll of twenty-odd icons stops being a phone and starts being a spreadsheet. Each shelf is a
 * tab; every app is on exactly one shelf; the dock stays where it is.
 */
export const APP_SHELVES_OLD = [
  { id: 'street', name: 'The Street', apps: ['messages', 'ride', 'jobs', 'block', 'social', 'rolo'] },
  { id: 'money', name: 'Money', apps: ['bank', 'bills', 'bidbay', 'shop', 'invest', 'casino'] },
  { id: 'life', name: 'Life', apps: ['pantry', 'inventory', 'calendar', 'clinic', 'fellowship'] },
  { id: 'late', name: 'After Dark', apps: ['fans'] },
];

/**
 * The whole home screen on one page: every app in a five-wide grid, in the order people reach
 * for them. The shelves had become tabs, and the tabs hid half the phone behind a scroll.
 */
export const APP_SHELVES = [
  { id: 'all', name: 'Apps', apps: ['call', 'ride', 'jobs', 'social', 'block', 'bills', 'bidbay', 'shop', 'inventory', 'calendar', 'clinic', 'fellowship', 'rolo', 'invest', 'casino', 'fans', 'system'] },
];
/** Every app on the home screen, in order (kept for anything that wants a flat list). */
export const HOME_GRID = APP_SHELVES.flatMap((s) => s.apps);

// Rolo's text thread lives inside Txtr, so it wears Txtr's brand
APPS.dealer = { ...APPS.messages };
export const DOCK = ['messages', 'call', 'bank', 'pantry'];

/** An app icon tile. `day` feeds iDread's live date; `badge` is the red notification count. */
export function appIcon(id, { day = 1, weekday = 'MON', badge = 0, label = true } = {}) {
  const a = APPS[id];
  if (!a) return '';
  const glyph = a.dated
    ? `<span class="appicon__date"><em>${weekday}</em><b>${day}</b></span>`
    : id === 'bidbay'
      ? '<span class="appicon__bid"><i>b</i><i>i</i><i>d</i></span>'
      : a.icon;
  return `<button class="appicon appicon--${id}${a.light ? ' appicon--light' : ''}" data-act="go" data-arg="${id}" style="--a:${a.a};--b:${a.b}">
    <span class="appicon__tile">${glyph}${badge ? `<span class="appicon__badge">${badge > 9 ? '9+' : badge}</span>` : ''}</span>
    ${label ? `<span class="appicon__name">${a.name}</span>` : ''}
  </button>`;
}
