/** Small shared helpers. */

export const clamp = (v, min = 0, max = 100) => Math.min(max, Math.max(min, v));
export const clamp01 = (v) => Math.min(1, Math.max(0, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const rand = (a = 0, b = 1) => a + Math.random() * (b - a);
export const randInt = (a, b) => Math.floor(rand(a, b + 1));
export const chance = (p) => Math.random() < p;
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

export function weighted(list, weightKey = 'weight') {
  const total = list.reduce((s, it) => s + (it[weightKey] ?? 1), 0);
  let roll = Math.random() * total;
  for (const it of list) {
    roll -= it[weightKey] ?? 1;
    if (roll <= 0) return it;
  }
  return list[list.length - 1];
}

export const money = (n) => {
  const neg = n < 0;
  const v = Math.abs(n);
  const s = v.toFixed(2);
  return `${neg ? '-' : ''}$${s}`;
};

export const moneyShort = (n) => `${n < 0 ? '-' : ''}$${Math.abs(Math.round(n))}`;

export function hhmm(absMinutes) {
  const m = ((absMinutes % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60);
  const mm = Math.floor(m % 60);
  return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

export function hourLabel(absMinutes) {
  const m = ((absMinutes % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60);
  const suffix = h < 12 ? 'AM' : 'PM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  const mm = Math.floor(m % 60);
  return `${h12}:${String(mm).padStart(2, '0')} ${suffix}`;
}

export const dayOf = (absMinutes) => Math.floor(absMinutes / 1440) + 1;
export const minuteOfDay = (absMinutes) => ((absMinutes % 1440) + 1440) % 1440;

export const duration = (minutes) => {
  const m = Math.max(0, Math.round(minutes));
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest ? `${h}h ${rest}m` : `${h}h`;
};

export function daysUntil(day, dueDay, period) {
  if (day <= dueDay) return dueDay - day;
  const k = Math.ceil((day - dueDay) / period);
  return dueDay + k * period - day;
}

export function uid() {
  return Math.random().toString(36).slice(2, 9);
}

export function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

export function oneOf(n, ...opts) { return opts[Math.min(opts.length - 1, Math.floor(n * opts.length))]; }
