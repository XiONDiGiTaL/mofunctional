/**
 * Generic dating-app thumbnails for the strangers in FeedLove HEARTS: Mo never meets them, so
 * they get a small painted bust instead of a face from the reference sheets. Each one is built
 * from the profile id (same face every time you look), with a skin tone, a hair shape and colour,
 * a top and a background from short palettes, and a face that is only a suggestion: two eyes, a
 * mouth, no likeness of anyone.
 */
const SKIN = ['#f1c9a8', '#e0ac88', '#c98e66', '#a8704a', '#8a5636', '#6a3f26'];
const HAIR = ['#1a1412', '#3a2418', '#5a3a22', '#8a6038', '#c99a52', '#6a1e22', '#2a2a30'];
const TOPS = ['#2a2c34', '#7a2a3a', '#2e5a6a', '#d8d4cc', '#5a4a78', '#3a5a3a', '#a85a2a'];
const BACK = ['#3a2a40', '#203040', '#40302a', '#2a3a30', '#402a30', '#30303a'];

function seedOf(str) {
  let h = 2166136261;
  for (const c of String(str)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  return () => { h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return ((h ^= h >>> 16) >>> 0) / 4294967296; };
}
const pickR = (r, a) => a[Math.floor(r() * a.length)];

/** An SVG data URL, 64x64. */
export function strangerThumb(id) {
  const r = seedOf(id);
  const skin = pickR(r, SKIN), hair = pickR(r, HAIR), top = pickR(r, TOPS), back = pickR(r, BACK);
  const style = Math.floor(r() * 4);
  const behind = [
    '<path d="M14 30c0-14 8-22 18-22s18 8 18 22v22H14z"/>',            // long
    '<path d="M17 28c0-12 6-19 15-19s15 7 15 19v8H17z"/>',              // shoulder length
    '<circle cx="32" cy="24" r="17"/><circle cx="18" cy="34" r="8"/><circle cx="46" cy="34" r="8"/>', // curls
    '<path d="M19 26c0-10 6-16 13-16s13 6 13 16v2H19z"/><circle cx="32" cy="9" r="6"/>', // bun
  ][style];
  const fringe = style === 3 ? '<path d="M21 23c3-7 19-9 22 0-6-3-15-3-22 0z"/>' : '<path d="M20 25c2-9 22-11 24 0-7-5-17-5-24 0z"/>';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
<rect width="64" height="64" fill="${back}"/>
<g fill="${hair}">${behind}</g>
<path d="M10 64c2-10 10-14 22-14s20 4 22 14z" fill="${top}"/>
<rect x="28" y="40" width="8" height="10" fill="${skin}"/>
<ellipse cx="32" cy="30" rx="11" ry="13" fill="${skin}"/>
<g fill="${hair}">${fringe}</g>
<rect x="26" y="29" width="3" height="2" fill="#241812"/><rect x="35" y="29" width="3" height="2" fill="#241812"/>
<rect x="29" y="37" width="6" height="1.6" fill="#8a4a44"/>
</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
