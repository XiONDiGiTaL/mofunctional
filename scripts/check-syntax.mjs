#!/usr/bin/env node
/**
 * Zero-dependency syntax check for every ES module in src/.
 * `node --check` only accepts CommonJS file extensions, so each file is copied
 * to a temporary .mjs and parsed.
 */
import { readdirSync, readFileSync, writeFileSync, unlinkSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = new URL('..', import.meta.url).pathname;
const srcDir = join(ROOT, 'src');
const tmp = join(ROOT, '.syntax-check.mjs');

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (entry.endsWith('.js')) out.push(full);
  }
  return out;
}

const files = walk(srcDir);
let failed = 0;
for (const file of files) {
  writeFileSync(tmp, readFileSync(file));
  try {
    execFileSync(process.execPath, ['--check', tmp], { stdio: 'pipe' });
    console.log(`  ok  ${relative(ROOT, file)}`);
  } catch (err) {
    failed++;
    console.error(`FAIL  ${relative(ROOT, file)}`);
    console.error(String(err.stderr || err.message).split('\n').slice(0, 5).join('\n'));
  }
}
try { unlinkSync(tmp); } catch { /* ignore */ }
console.log(`\n${files.length - failed}/${files.length} modules parsed.`);
process.exit(failed ? 1 : 0);
