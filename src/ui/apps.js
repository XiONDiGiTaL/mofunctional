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
  social: {
    name: 'FeedLove', tag: 'be seen, briefly', a: '#ffcf4a', b: '#d6249f', ring: true,
    icon: svg('<rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="4"/><path d="M17 7h.01" stroke-width="2.6"/>'),
  },
  fellowship: {
    name: 'Blessed+', tag: 'salvation, now ad-supported', a: '#ffd86b', b: '#6a2bb0',
    icon: svg('<ellipse cx="12" cy="5" rx="5" ry="1.6"/><path d="M12 9v11M8 13h8"/>'),
  },
  rolo: {
    name: "Rolo's Line", tag: 'wap 1.1 · we dont keep logs (we keep logs)', a: '#9bbc0f', b: '#0f380f',
    icon: svg('<rect x="6.5" y="2.5" width="11" height="19" rx="2"/><path d="M9 6h6v5H9z"/><path d="M9 14h.01M12 14h.01M15 14h.01M9 17h.01M12 17h.01M15 17h.01" stroke-width="2.4"/>'),
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
};

const norm = (name = '') => String(name).toUpperCase().replace(/\(.*?\)/g, '').trim();

/** The brand for a sender, or null when it is a person. */
export function serviceFor(name) {
  const hit = SERVICES[norm(name)];
  if (!hit) return null;
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

/** The home-screen layout: the grid, then the dock. */
export const HOME_GRID = ['jobs', 'bidbay', 'calendar', 'inventory', 'bills', 'social', 'fellowship', 'rolo'];

// Rolo's text thread lives inside Txtr, so it wears Txtr's brand
APPS.dealer = { ...APPS.messages };
export const DOCK = ['messages', 'bank', 'pantry', 'system'];

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
