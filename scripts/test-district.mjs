/**
 * Checks for the downtown pass: hands, clothes, the line, the Basement and the Marcy Houses.
 * Headless — no renderer, no DOM, just the systems that decide what happens.
 */
import * as brawl from '../src/systems/brawl.js';
import * as wardrobe from '../src/systems/wardrobe.js';
import { CONFIG } from '../src/core/config.js';

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

function stub() {
  const s = {
    clock: { m: 22 * 60 }, money: 400, inventory: [], ledger: [], log: [],
    stats: { energy: 90, stress: 20, morale: 60, risk: 0 },
    high: { level: 0, until: 0 }, dog: { like: 80, name: 'Meatball' },
    brawl: {}, wardrobe: { owned: ['tee'], worn: 'tee' }, counters: {},
  };
  const g = {
    state: s,
    toast() {},
    bus: { emit() {} },
    spendMoney(n, label) { s.money = Math.round((s.money - n) * 100) / 100; s.ledger.push({ label, amount: -n }); },
    earnMoney(n) { s.money = Math.round((s.money + n) * 100) / 100; },
    audio: { sfx() {} },
  };
  return { s, g };
}

console.log('\nbrawl');
check('who is on the other end of it', () => {
  eq(brawl.classify('cop'), 'cop', 'cop');
  eq(brawl.classify('cop2'), 'cop', 'cop2');
  eq(brawl.classify('bike_kid'), 'kid', 'kid');
  eq(brawl.classify('dex'), 'dealer', 'dealer');
  eq(brawl.classify('thug', { tough: true }), 'tough', 'thug');
  eq(brawl.classify('passer_m'), 'civilian', 'civilian');
});

check('he will punch a cop and that is a decision with consequences', () => {
  const { s, g } = stub();
  const res = brawl.strike(g, { kind: 'cop' });
  eq(res.result, 'cop');
  eq(s.brawl.copPunches, 1);
  ok(s.stats.risk >= CONFIG.brawl.copRisk, 'risk rose');
});

check('he refuses to hit a child', () => {
  const { s, g } = stub();
  const res = brawl.strike(g, { kind: 'bike_kid' });
  eq(res.result, 'refused');
  eq(s.brawl.knockouts, 0);
  eq(s.brawl.punches, 1);
});

check('kicking the dog costs the affection that was built up', () => {
  const { s, g } = stub();
  const res = brawl.strike(g, { kind: 'dog' });
  eq(res.result, 'dog');
  eq(s.dog.like, 80 + CONFIG.brawl.dogLike);
  eq(s.brawl.dogPunches, 1);
});

check('a dealer takes a few and then can be searched exactly once', () => {
  const { s, g } = stub();
  let res;
  for (let i = 0; i < 6; i++) {
    s.clock.m += 2;
    res = brawl.strike(g, { kind: 'dex', key: 'dex' });
    if (res.result === 'ko') break;
  }
  eq(res.result, 'ko', 'eventually out');
  const first = brawl.loot(g, { kind: 'dex', key: 'dex' });
  ok(first.ok, 'first search works');
  const second = brawl.loot(g, { kind: 'dex', key: 'dex' });
  eq(second.ok, false);
  eq(second.reason, 'searched');
});

check('nobody folds on the first punch', () => {
  const { s, g } = stub();
  const first = brawl.strike(g, { kind: 'passer_m', key: 'a', label: 'a man' });
  eq(first.result, 'fight');
  ok(first.hp >= 1, 'still standing after one');
  ok(CONFIG.brawl.civilianHp >= 3, 'a civilian takes a few');
  ok(CONFIG.brawl.toughHp > CONFIG.brawl.dealerHp, 'a thug lasts longer than a dealer');
});

check('two people do not share one health pool', () => {
  const { s, g } = stub();
  const a = brawl.strike(g, { kind: 'passer_m', key: 'one' });
  const b = brawl.strike(g, { kind: 'passer_m', key: 'two' });
  eq(a.hp, b.hp, 'each starts fresh');
  eq(b.maxHp, a.maxHp);
});

check('a swing carries the running total, not the kind', () => {
  const { s, g } = stub();
  const first = brawl.strike(g, { kind: 'dex', key: 'dex' });
  eq(first.hp, CONFIG.brawl.dealerHp - 1);
  const second = brawl.strike(g, { kind: 'dex', key: 'dex', hp: first.hp, maxHp: first.maxHp });
  eq(second.hp, first.hp - 1);
});

check('a shopkeeper who is hit over and over calls the precinct', () => {
  const { s, g } = stub();
  ok(brawl.isImportant('nurse'), 'the nurse counts');
  ok(brawl.isImportant('passer_m', { talk: 'gus' }), 'anyone with a talk prompt counts');
  let called = false;
  for (let i = 0; i < CONFIG.brawl.reportAfter; i++) called = brawl.assault(g, 'dex').called || called;
  ok(called, 'the phone came out');
  ok(!!s.brawl.alert, 'an alert is outstanding');
});

check('the cruiser takes a few minutes, and one call is one cruiser', () => {
  const { s, g } = stub();
  for (let i = 0; i < CONFIG.brawl.reportAfter; i++) brawl.assault(g, 'dex');
  ok(!brawl.alertDue(s), 'not on the same minute');
  const again = brawl.assault(g, 'dex');
  eq(again.called, false, 'no second call while one is out');
  s.clock.m += CONFIG.brawl.alertMinutes[1] + 1;
  ok(brawl.alertDue(s), 'due now');
  brawl.clearAlert(s);
  ok(!brawl.alertDue(s), 'cleared once answered');
});

check('a new day forgets the grudge', () => {
  const { s, g } = stub();
  brawl.assault(g, 'dex');
  brawl.assault(g, 'dex');
  s.clock.m += 1440;
  eq(brawl.assault(g, 'dex').n, 1, 'counting starts again');
});

check('the gun is left where it fell', () => {
  ok(/Live by the gun/.test(brawl.GUN_REFUSAL), 'the line is the line');
});

console.log('\nwardrobe');
check('buying clothes costs money and adds them to the closet', () => {
  const { s, g } = stub();
  const id = CONFIG.outfits[2].id;
  const r = wardrobe.buy(g, id);
  ok(r.ok, 'bought');
  ok(s.wardrobe.owned.includes(id), 'owned');
  eq(s.money, Math.round((400 - CONFIG.outfits[2].price) * 100) / 100);
});

check('he cannot wear what he does not own, and can wear what he does', () => {
  const { s, g } = stub();
  eq(wardrobe.wear(g, 'lucky').ok, false);
  ok(wardrobe.wear(g, 'tee').ok, 'tee');
  eq(wardrobe.worn(s).id, 'tee');
});

check('every outfit is distinct and priced', () => {
  const ids = new Set();
  for (const o of CONFIG.outfits) {
    ok(!ids.has(o.id), `duplicate ${o.id}`);
    ids.add(o.id);
    ok(typeof o.shirt === 'number' && typeof o.pants === 'number', o.id);
  }
  ok(CONFIG.outfits.length >= 4, 'a few choices');
});

console.log('\nthe line and the districts');
check('the line has a fare, a timetable and a ride', () => {
  ok(CONFIG.subway.fare > 0, 'fare');
  ok(CONFIG.subway.everySeconds >= 20, 'trains come');
  ok(CONFIG.subway.dockSeconds >= 8, 'time to board');
  ok(CONFIG.subway.rideMinutes[1] > CONFIG.subway.rideMinutes[0], 'ride');
});

check('the Basement pays and the purse is real', () => {
  ok(CONFIG.club.payout[1] > CONFIG.club.payout[0], 'range');
  ok(CONFIG.club.payout[0] >= 50, 'worth going down there');
  ok(CONFIG.club.hp >= 3, 'a fight, not a formality');
});

check('the projects are lethal and say so', () => {
  ok(CONFIG.projects.gunDeathChance > 0.2 && CONFIG.projects.gunDeathChance < 0.9, 'a real risk');
});

console.log(`\n${pass}/${pass + fails.length} new checks passed.`);
if (fails.length) { for (const f of fails) console.log(`  - ${f}`); process.exit(1); }
