#!/usr/bin/env node
/**
 * Merge translation files into src/i18n/<lang>.js.
 *
 *   node scripts/i18n-merge.mjs es path/to/es-*.tsv ...
 *
 * Each .tsv line is `key<TAB>translation` (the key from i18n-todo-<lang>.tsv). New lines are added
 * to what <lang>.js already has; a translation that dropped or invented a {n} placeholder is
 * rejected and reported, so a pattern can never put the wrong value in the wrong place.
 */
import fs from 'node:fs';
import { keyOf } from '../src/i18n/i18n.js';
import { CATALOG } from '../src/i18n/catalog.js';

const [lang, ...files] = process.argv.slice(2);
if (!lang || !files.length) { console.error('usage: i18n-merge.mjs <lang> <files...>'); process.exit(1); }
const byKey = new Map(CATALOG.map((en) => [keyOf(en), en]));
let map = {};
try { map = (await import(`../src/i18n/${lang}.js?${Date.now()}`)).default; } catch { /* first run */ }
const holes = (s) => (s.match(/\{\d+\}/g) || []).sort().join(',');
let added = 0;
const bad = [];
for (const f of files) {
  for (const line of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
    if (!line.trim()) continue;
    const tab = line.indexOf('\t');
    if (tab < 0) continue;
    const key = line.slice(0, tab).trim();
    const text = line.slice(tab + 1).trim();
    const en = byKey.get(key);
    if (!en || !text) continue;
    if (holes(en) !== holes(text)) { bad.push(`${key}: "${en}" -> "${text}"`); continue; }
    if (text === en) continue;
    if (!map[key]) added += 1;
    map[key] = text;
  }
}
const keys = Object.keys(map).filter((k) => byKey.has(k)).sort();
const body = keys.map((k) => `  ${JSON.stringify(k)}: ${JSON.stringify(map[k])},`).join('\n');
fs.writeFileSync(`src/i18n/${lang}.js`, `/** ${lang === 'es' ? 'Spanish' : lang === 'de' ? 'German' : lang} translations, keyed by i18n.keyOf(English). Built by scripts/i18n-merge.mjs. */\nexport default {\n${body}\n};\n`);
console.log(`${lang}: +${added} (total ${keys.length}/${CATALOG.length})`);
if (bad.length) console.log(`rejected ${bad.length} (placeholder mismatch):\n${bad.slice(0, 20).join('\n')}`);
