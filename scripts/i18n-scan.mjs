// Walk src/ and pull out every string a player could read. A small JS tokenizer: comments,
// quotes, template literals (with ${} nesting), and regex literals are told apart, so code is
// not mistaken for prose. Template literals keep their shape: each ${...} becomes {0}, {1}...
// and each literal is split on HTML tags into the text segments the DOM will actually hold.
import fs from 'node:fs';
import path from 'node:path';

export function walkFiles(dir) {
  const out = [];
  (function walk(d) {
    for (const f of fs.readdirSync(d)) {
      const p = path.join(d, f);
      if (fs.statSync(p).isDirectory()) walk(p);
      else if (p.endsWith('.js')) out.push(p);
    }
  })(dir);
  return out;
}

/** Yields { kind: 'str'|'tpl', text, parts? } for each literal in a JS source. */
export function literals(src) {
  const out = [];
  let i = 0;
  const n = src.length;
  let prev = ''; // last significant char, to tell a regex from a division
  const readTemplate = () => {
    // at src[i] === '`'
    i++;
    const parts = [''];
    const exprs = [];
    while (i < n) {
      const c = src[i];
      if (c === '\\') { parts[parts.length - 1] += src.slice(i, i + 2); i += 2; continue; }
      if (c === '`') { i++; break; }
      if (c === '$' && src[i + 1] === '{') {
        i += 2;
        let depth = 1;
        const start = i;
        while (i < n && depth > 0) {
          const d = src[i];
          if (d === '`') { const inner = readTemplate(); out.push(inner); continue; }
          if (d === '"' || d === "'") { const s = readQuoted(d); out.push(s); continue; }
          if (d === '{') depth++;
          else if (d === '}') { depth--; if (depth === 0) break; }
          i++;
        }
        exprs.push(src.slice(start, i));
        i++; // the closing }
        parts.push('');
        continue;
      }
      parts[parts.length - 1] += c;
      i++;
    }
    return { kind: 'tpl', parts, exprs };
  };
  const readQuoted = (q) => {
    i++;
    let s = '';
    while (i < n && src[i] !== q) {
      if (src[i] === '\\') { s += src.slice(i, i + 2); i += 2; continue; }
      if (src[i] === '\n') break;
      s += src[i++];
    }
    i++;
    return { kind: 'str', text: s };
  };
  while (i < n) {
    const c = src[i];
    if (c === '/' && src[i + 1] === '/') { while (i < n && src[i] !== '\n') i++; continue; }
    if (c === '/' && src[i + 1] === '*') { i = src.indexOf('*/', i + 2); i = i < 0 ? n : i + 2; continue; }
    if (c === '"' || c === "'") { out.push(readQuoted(c)); prev = 'a'; continue; }
    if (c === '`') { out.push(readTemplate()); prev = 'a'; continue; }
    if (c === '/' && /[(,=:[!&|?{};+\-*%<>~^]|^$|return|typeof/.test(prev)) {
      // a regex literal: skip it
      i++;
      let cls = false;
      while (i < n) {
        const d = src[i];
        if (d === '\\') { i += 2; continue; }
        if (d === '[') cls = true;
        else if (d === ']') cls = false;
        else if (d === '/' && !cls) { i++; break; }
        else if (d === '\n') break;
        i++;
      }
      while (/[a-z]/.test(src[i] || '')) i++;
      prev = 'a';
      continue;
    }
    if (!/\s/.test(c)) {
      if (/[A-Za-z0-9_$]/.test(c)) {
        let w = '';
        while (i < n && /[A-Za-z0-9_$]/.test(src[i])) w += src[i++];
        prev = (w === 'return' || w === 'typeof') ? w : 'a';
        continue;
      }
      prev = c;
    }
    i++;
  }
  return out;
}

const unescape = (s) => s.replace(/\\n/g, '\n').replace(/\\'/g, "'").replace(/\\"/g, '"').replace(/\\`/g, '`').replace(/\\\\/g, '\\').replace(/\\u([0-9a-f]{4})/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));

/** Is this something a player reads (prose, a label), rather than an id, a class, a selector or CSS? */
export function isProse(t) {
  const s = t.trim();
  if (s.length < 2) return false;
  if (!/[A-Za-z]{2}/.test(s)) return false;
  if (/^[a-z0-9_\-.:#/]+$/.test(s)) return false;                 // ids, keys, paths, classes
  if (/^[a-z][a-zA-Z0-9]*$/.test(s)) return false;                // camelCase identifiers
  if (/^(rgba?|#|url\(|translate|rotate|scale|calc\()/.test(s)) return false;
  if (/[;{}]\s*$/.test(s) && /:/.test(s) && !/ [a-z]+ [a-z]+ [a-z]+/.test(s)) return false; // CSS
  if (/^[\w-]+\s*:\s*[^ ]+;?$/.test(s)) return false;
  if (/^(\.|#)?[a-z][\w-]*(\s+[.#]?[a-z][\w-]*)*$/.test(s) && !/[A-Z]/.test(s) && s.split(' ').length < 4 && /-|_/.test(s)) return false;
  if (/^(Key|Digit|Arrow|Numpad)[A-Z0-9]/.test(s)) return false;
  if (/^[A-Z_]+$/.test(s) && s.length > 1 && /_/.test(s)) return false;
  if (/^(sans-serif|monospace|serif|Arial)/.test(s)) return false;
  if (/^(application|image|text)\//.test(s)) return false;
  if (/^https?:/.test(s)) return false;
  return true;
}

/** Text segments as the DOM will hold them: split on tags, whitespace collapsed. */
export function segments(text) {
  return text.split(/<[^>]*>/).map((p) => p.replace(/\s+/g, ' ').trim()).filter(Boolean);
}

/** Every catalog entry in a source: plain strings and template patterns ({0} for each ${}). */
export function entries(src) {
  const out = [];
  for (const lit of literals(src)) {
    if (lit.kind === 'str') {
      const t = unescape(lit.text);
      for (const block of t.split('\n')) for (const seg of segments(block)) if (isProse(seg)) out.push(seg);
    } else {
      let k = 0;
      const joined = lit.parts.map((p, idx) => unescape(p) + (idx < lit.parts.length - 1 ? `{${k++}}` : '')).join('');
      for (const block of joined.split('\n')) {
        for (const seg of segments(block)) {
          const bare = seg.replace(/\{\d+\}/g, '').trim();
          if (bare.length < 2 || !isProse(bare)) continue;
          // renumber so each segment's placeholders start at {0}
          let j = 0;
          out.push(seg.replace(/\{\d+\}/g, () => `{${j++}}`));
        }
      }
    }
  }
  return out;
}
