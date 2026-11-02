/**
 * Languages: English (the source), Spanish and German.
 *
 * Nothing in the game is written against translation keys. Every line is authored in English,
 * and this layer translates the interface as it reaches the screen: a MutationObserver watches
 * the UI and swaps each text node (and the placeholder, title and aria-label attributes) for its
 * translation. The 3D world is drawn on a canvas, so the street signs, shop signs and posters stay
 * as they are; only the interface, messages, menus and dialogue change.
 *
 * Catalogs (es.js, de.js) map a short hash of the English text to the translation:
 *   - plain lines are matched exactly;
 *   - lines that were template literals keep their holes as {0}, {1}...: "Rent {0} due in {1}"
 *     is matched as a pattern and the captured values are put back into the translation.
 * `npm run i18n` rebuilds the English catalog from the source and reports what is untranslated.
 * Anything without a translation is simply left in English.
 */
let CATALOG = null;     // the English lines, loaded with the first non-English language

const LANGS = {
  en: { name: 'English', native: 'English' },
  es: { name: 'Spanish', native: 'Español' },
  de: { name: 'German', native: 'Deutsch' },
};
export const LANGUAGES = Object.entries(LANGS).map(([id, l]) => ({ id, ...l }));

const loaded = { en: {} };
let lang = 'en';
let table = null;       // { exact: Map, patterns: [{ re, out, literal }] } for the current language
const cache = new Map(); // english text -> translated (or null), per language
const STORE = 'mof.lang';

/** 32-bit FNV-1a, base 36: the key a line is filed under in the catalogs. */
export function keyOf(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(36);
}

const norm = (s) => s.replace(/\s+/g, ' ').trim();
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Build lookup tables for a language from the English catalog and that language's map. */
function build(map) {
  const exact = new Map();
  const patterns = [];
  for (const en of CATALOG) {
    const tr = map[keyOf(en)];
    if (!tr) continue;
    if (/\{\d+\}/.test(en)) {
      const pieces = en.split(/(\{\d+\})/);
      const order = [];
      let src = '^';
      for (const p of pieces) {
        const m = p.match(/^\{(\d+)\}$/);
        if (m) { order.push(Number(m[1])); src += '(.+?)'; } else src += escapeRe(p);
      }
      src += '$';
      const literal = en.replace(/\{\d+\}/g, '').length;
      if (literal < 3) continue; // nothing to anchor on: "{0} {1}" would match everything
      patterns.push({ re: new RegExp(src, 's'), out: tr, order, literal, head: en.split(/\{\d+\}/)[0] });
    } else exact.set(en, tr);
  }
  patterns.sort((a, b) => b.literal - a.literal);
  return { exact, patterns };
}

/** Translate one line of English. Returns the line unchanged if there is no translation. */
export function tr(text) {
  if (lang === 'en' || !table || !text) return text;
  // a block of several lines (the help screen, a <pre>) is several catalog lines
  if (text.trim().includes('\n')) return text.split('\n').map((l) => tr(l)).join('\n');
  const lead = text.match(/^\s*/)[0];
  const tail = text.match(/\s*$/)[0];
  const key = norm(text);
  if (!key || !/[A-Za-z]/.test(key)) return text;
  if (cache.has(key)) { const c = cache.get(key); return c == null ? text : lead + c + tail; }
  let out = table.exact.get(key) ?? null;
  if (out == null) {
    for (const p of table.patterns) {
      if (p.head && !key.startsWith(p.head)) continue;
      const m = key.match(p.re);
      if (!m) continue;
      const vals = p.order.map((_, i) => m[i + 1]);
      // values that are themselves English lines (an item name inside a sentence) translate too
      out = p.out.replace(/\{(\d+)\}/g, (_, n) => { const v = vals[p.order.indexOf(Number(n))] ?? ''; return v.length < key.length ? tr(v) : v; });
      break;
    }
  }
  if (cache.size > 6000) cache.clear();
  cache.set(key, out);
  return out == null ? text : lead + out + tail;
}

/* ------------------------------------------------------------------ the DOM */

const original = new WeakMap(); // text node -> its English; element -> { attr: English }
const written = new WeakMap();  // text node -> what we last wrote, to ignore our own mutations
const ATTRS = ['placeholder', 'title', 'aria-label'];
const SKIP = new Set(['SCRIPT', 'STYLE', 'TEXTAREA']);

function skipNode(el) {
  for (let e = el; e; e = e.parentElement) {
    if (SKIP.has(e.tagName)) return true;
    if (e.isContentEditable || e.hasAttribute?.('data-i18n-skip')) return true;
  }
  return false;
}

function doText(node) {
  const cur = node.data;
  if (written.get(node) === cur) return;          // our own write coming back round
  original.set(node, cur);
  const out = tr(cur);
  if (out !== cur) { written.set(node, out); node.data = out; } else written.delete(node);
}

function doAttrs(el) {
  let o = original.get(el);
  for (const a of ATTRS) {
    if (!el.hasAttribute(a)) continue;
    const v = el.getAttribute(a);
    if (o?.[`w_${a}`] === v) continue;
    o = o || {};
    o[a] = v;
    const out = tr(v);
    if (out !== v) { o[`w_${a}`] = out; el.setAttribute(a, out); }
    original.set(el, o);
  }
}

function walk(root) {
  if (root.nodeType === 3) { if (!skipNode(root.parentElement)) doText(root); return; }
  if (root.nodeType !== 1 || skipNode(root)) return;
  doAttrs(root);
  const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  let n = tw.nextNode();
  while (n) {
    if (n.nodeType === 1) { if (SKIP.has(n.tagName) || n.hasAttribute('data-i18n-skip')) { n = tw.nextSibling() || nextOutside(tw, root); continue; } doAttrs(n); }
    else if (n.data.trim()) doText(n);
    n = tw.nextNode();
  }
}
function nextOutside(tw, root) {
  let p = tw.currentNode;
  while (p && p !== root) { if (p.nextSibling) { tw.currentNode = p.nextSibling; return p.nextSibling; } p = p.parentNode; }
  return null;
}

let observer = null;
function observe() {
  if (observer || typeof MutationObserver === 'undefined') return;
  observer = new MutationObserver((list) => {
    if (lang === 'en') return;
    for (const m of list) {
      if (m.type === 'characterData') { if (!skipNode(m.target.parentElement)) doText(m.target); }
      else if (m.type === 'attributes') doAttrs(m.target);
      else for (const n of m.addedNodes) walk(n);
    }
  });
  observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
}

/** Put every node back to English, then (for another language) translate it again. */
function retranslate() {
  const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  let n = tw.nextNode();
  while (n) {
    if (n.nodeType === 3) {
      const o = original.get(n);
      if (o != null && written.get(n) === n.data) { n.data = o; written.delete(n); }
    } else {
      const o = original.get(n);
      if (o) for (const a of ATTRS) if (o[a] != null && o[`w_${a}`] === n.getAttribute(a)) { n.setAttribute(a, o[a]); delete o[`w_${a}`]; }
    }
    n = tw.nextNode();
  }
  if (lang !== 'en') walk(document.body);
}

async function load(id) {
  if (id !== 'en' && !CATALOG) CATALOG = (await import('./catalog.js')).CATALOG;
  if (loaded[id]) return loaded[id];
  const mod = id === 'es' ? await import('./es.js') : id === 'de' ? await import('./de.js') : { default: {} };
  loaded[id] = mod.default || {};
  return loaded[id];
}

export const getLang = () => lang;

/** Switch language (and remember it, for the title screen too). */
export async function setLang(id) {
  if (!LANGS[id]) id = 'en';
  const map = await load(id);
  lang = id;
  table = id === 'en' ? null : build(map);
  cache.clear();
  try { localStorage.setItem(STORE, id); } catch { /* private window */ }
  if (typeof document !== 'undefined') {
    document.documentElement.lang = id;
    observe();
    retranslate();
  }
  return id;
}

/** The language the player picked last time (before any save is loaded), or English. */
export function savedLang() {
  try { return localStorage.getItem(STORE) || 'en'; } catch { return 'en'; }
}

/** For tests: install a map directly. */
export function _useMap(id, map, catalog) { if (catalog) CATALOG = catalog; loaded[id] = map; lang = id; table = id === 'en' ? null : build(map); cache.clear(); }
