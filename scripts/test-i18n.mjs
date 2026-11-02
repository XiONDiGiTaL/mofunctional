/**
 * Checks for the language layer: the catalogs line up with the English, and lines translate
 * the way the interface will ask for them. Headless — the DOM half is checked in the browser.
 */
import { CATALOG } from '../src/i18n/catalog.js';
import es from '../src/i18n/es.js';
import de from '../src/i18n/de.js';
import { keyOf, tr, setLang, getLang } from '../src/i18n/i18n.js';

let pass = 0;
const fails = [];
function check(name, fn) {
  try { fn(); pass += 1; console.log(`  ok  ${name}`); }
  catch (e) { fails.push(`${name}: ${e.message}`); console.log(`FAIL  ${name}\n        ${e.message}`); }
}
function eq(a, b, msg = '') {
  if (a !== b) throw new Error(`${msg} expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}
function ok(v, msg = 'expected truthy') { if (!v) throw new Error(msg); }

const holes = (s) => (s.match(/\{\d+\}/g) || []).sort().join('');
const byKey = new Map(CATALOG.map((en) => [keyOf(en), en]));

console.log('\ncatalogs');
for (const [id, map] of [['es', es], ['de', de]]) {
  check(`${id}: every translation keeps the holes of its English line`, () => {
    const bad = Object.entries(map).filter(([k, v]) => byKey.has(k) && holes(byKey.get(k)) !== holes(v));
    eq(bad.length, 0, bad.slice(0, 3).map(([k]) => byKey.get(k)).join(' | '));
  });
  check(`${id}: covers most of the catalog`, () => {
    const n = CATALOG.filter((en) => map[keyOf(en)]).length;
    ok(n / CATALOG.length > 0.85, `${n}/${CATALOG.length}`);
  });
}
check('keys are stable', () => { eq(keyOf('Go to bed.'), 'q3608r'); });

console.log('\ntranslating');
await setLang('es');
check('a plain line', () => { eq(tr('Go to bed.'), 'Irse a la cama.'); });
check('a line with numbers in it', () => { eq(tr('Rent is already paid ahead through Day 9.'), 'El alquiler ya está pagado por adelantado hasta el día 9.'); });
check('whitespace around a line survives', () => { eq(tr('  Go to bed.\n'), '  Irse a la cama.\n'); });
check('several lines at once', () => { eq(tr('Go to bed.\nGo home.'), 'Irse a la cama.\nIrse a casa.'); });
check('something it does not know stays English', () => { eq(tr('Mo Functional_City.mp3 is not a sentence'), 'Mo Functional_City.mp3 is not a sentence'); });
await setLang('de');
check('switching language switches the answer', () => { eq(tr('Go to bed.'), 'Ins Bett gehen.'); eq(getLang(), 'de'); });
await setLang('en');
check('English is the source, untouched', () => { eq(tr('Go to bed.'), 'Go to bed.'); });
await setLang('xx');
check('an unknown language falls back to English', () => { eq(getLang(), 'en'); });

console.log(fails.length ? `\n${fails.length} failed, ${pass} passed.` : `\n${pass}/${pass} language checks passed.`);
if (fails.length) process.exit(1);
