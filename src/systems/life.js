/**
 * Mo's life as a trajectory, not a countdown.
 *
 * Nothing here ends the run. What used to be a game-over is a turning point: something that
 * happens to Mo, costs him (time, money, trust, a night somewhere worse), changes what the next
 * days look like, and leaves the game running. The run only ends if the player closes the book.
 *
 *   overdose / collapse   the ER: he wakes up the next morning, detoxed, owing the hospital
 *   eviction              locked out: arrears become debt, he sleeps where he can, he can get back in
 *   stress breaking point a scene: he snaps at someone, and they remember
 *   morale floor          a low day: the morning is gone, and whoever trusts him most checks in
 *   fired                 no ending: odd jobs, and a way back if Dale's trust allows
 *
 * Every day closes with a life index (0-100) built from the overlapping pressures — a roof, the
 * rent, the job, dependence, body, mind, the people around him, debt — and the trajectory is the
 * change in that index. Rock bottom is a state with its own texts and options; climbing out of it
 * is a run of milestones. Neither is quick.
 */
import { CONFIG } from '../core/config.js';
import { bump, logLine, pushMessage, spend, clock } from '../core/state.js';
import { billInfo } from './economy.js';

const clamp = (v, a = 0, b = 100) => Math.max(a, Math.min(b, v));
const money = (n) => `$${Number(n).toFixed(2)}`;

export const LIFE = {
  erBill: 480,             // an overdose admission, billed after the fact
  collapseBill: 220,       // a collapse that ends in an ambulance
  deposit: 200,            // getting back into Unit 3B: arrears plus this
  debtInterest: 0.01,      // per day on what he owes the hospital and the landlord
  rockBottom: 24,          // life index under this is rock bottom
  rehireDays: 4,           // days after being fired before Dale will even listen
};

/** Lazily filled so older saves gain the new state without losing anything. */
export function lifeState(s) {
  if (!s.life) s.life = {};
  const l = s.life;
  l.housing = l.housing || 'housed';         // 'housed' | 'evicted'
  l.debt = l.debt || { hospital: 0, rent: 0 };
  l.milestones = l.milestones || {};
  l.index = l.index ?? null;
  l.history = l.history || [];               // [{ day, index }]
  l.turning = l.turning || [];               // [{ day, id, text }]
  l.overdoses = l.overdoses || 0;
  l.lastDoseDay = l.lastDoseDay ?? 0;
  l.rockBottom = !!l.rockBottom;
  l.lowestIndex = l.lowestIndex ?? 100;
  l.counselor = !!l.counselor;
  l.checkinDay = l.checkinDay ?? -1;
  return l;
}

export const totalDebt = (s) => { const d = lifeState(s).debt; return Math.round(((d.hospital || 0) + (d.rent || 0)) * 100) / 100; };
export const isHoused = (s) => lifeState(s).housing === 'housed';

/** Trust between Mo and someone (−10..10). The game already kept counters in state.npc. */
export function trust(s, id, delta = 0) {
  s.npc = s.npc || {};
  if (delta) s.npc[id] = Math.max(-10, Math.min(10, (s.npc[id] || 0) + delta));
  return s.npc[id] || 0;
}

function turningPoint(g, id, text) {
  const l = lifeState(g.state);
  const day = clock(g.state).day;
  l.turning.push({ day, id, text });
  if (l.turning.length > 30) l.turning.shift();
  logLine(g, text, 'bad');
}

/* ------------------------------------------------------------------ turning points */

/** Risk hit the ceiling, or his body gave out once too often: an ambulance, not an ending. */
export function hospitalize(g, cause = 'overdose') {
  const s = g.state;
  const l = lifeState(s);
  if (l.inHospital) return;
  l.inHospital = true;
  const od = cause === 'overdose';
  if (od) l.overdoses++;
  const bill = od ? LIFE.erBill : LIFE.collapseBill;
  turningPoint(g, cause, od ? 'Overdosed. Woke up at Kings County.' : 'Collapsed. Woke up at Kings County.');
  g.world?.haltMo?.();
  g.audio?.sfx?.('sting');
  // the night is gone: 06:30 the next morning, give or take the paperwork
  const now = s.clock.m;
  const nextMorning = (Math.floor(now / 1440) + 1) * 1440 + 6.5 * 60;
  const minutes = Math.max(8 * 60, nextMorning - now);
  g.advance(minutes, { sleeping: true, noCollapse: true });
  s.stats.risk = od ? 32 : clamp(s.stats.risk - 20);
  s.stats.withdrawal = 0;
  s.stats.addiction = clamp(s.stats.addiction - (od ? 8 : 3));
  s.stats.energy = 44;
  s.stats.hunger = Math.max(s.stats.hunger, 40);
  bump(s, 'morale', -16);
  bump(s, 'stress', 10);
  s.counters.collapsed = 0;
  s.high.until = s.clock.m;
  s.high.level = 0;
  l.debt.hospital = (l.debt.hospital || 0) + bill;
  l.counselor = true;
  l.inHospital = false;
  if (g.world?.areaId !== 'street' && g.world?.areaId !== 'apartment') g.goTo?.(isHoused(s) ? 'apartment' : 'street');
  else if (isHoused(s)) g.goTo?.('apartment');
  g.openModal?.({
    kicker: od ? 'KINGS COUNTY HOSPITAL · ER' : 'KINGS COUNTY HOSPITAL',
    title: od ? 'You Are Still Here' : 'The Floor Was Closer Than It Looked',
    body: od
      ? `You come to under a light that does not care about you. A nurse says your name like she has said it a few times already.\n\nThey kept you overnight. They gave you something that made the inside of your head very loud and then very quiet. On your way out, a social worker presses a card into your hand: KESTREL CLINIC — OUTPATIENT. "Text the number. Every day. That is the whole program."\n\nThe bill: ${money(bill)}. It will find you.`
      : `Somebody called it in. You remember the ceiling of the ambulance better than anything else this week.\n\nThey patch you up, feed you a sandwich wrapped in plastic, and discharge you at dawn with a pamphlet and a bill for ${money(bill)}.`,
    choices: [{ label: 'Walk out into the morning.', effect: () => {} }],
  });
  pushMessage(g, {
    from: 'KESTREL CLINIC',
    subject: 'Outpatient check-in',
    body: 'This is your daily check-in line. Reply once a day. Some days that will be the only thing you do right, and it still counts.\n\n— Kestrel Clinic, outpatient',
  });
  nudgeFromFriend(g, od ? 'They heard about the hospital.' : 'Word gets around.');
}

/** Two missed rent cycles and the notice on the door: the lock gets changed. */
export function evict(g) {
  const s = g.state;
  const l = lifeState(s);
  if (l.housing === 'evicted') return;
  const info = billInfo(g, 'rent');
  l.debt.rent = (l.debt.rent || 0) + info.owed;
  l.housing = 'evicted';
  l.evictedDay = clock(s).day;
  s.flags.evictionNotice = false;
  // the lease is over: rent stops accruing, and the fridge stays with the unit
  s.bills.rent.paidCycle = rentCycleNow(g);
  s.fridge = [];
  trust(s, 'rae', -2);
  bump(s, 'morale', -18);
  bump(s, 'stress', 16);
  turningPoint(g, 'evicted', 'Evicted from Unit 3B.');
  g.audio?.sfx?.('bad');
  if (g.world?.areaId === 'apartment') g.goTo?.('street', 'apartment');
  g.openModal?.({
    kicker: 'UNIT 3B · NOTICE',
    title: 'The Lock Is New',
    body: `Your key goes in and stops halfway, like it is embarrassed for you.\n\nA note on the door, Rae's handwriting: "I held it as long as I could. Your things are in the hall closet. When you have ${money(l.debt.rent)} plus a ${money(LIFE.deposit)} deposit, we can talk. I mean that."\n\nYou still have your phone, your pockets and the clothes you are in. The bench on Kestrel is free. The Fellowship has cots, and Addison has a way of mentioning it.`,
    choices: [{ label: 'Stand on the stoop for a while.', effect: () => {} }],
  });
}

/** What it costs to get back into Unit 3B, and the way to pay it. */
export const rehouseCost = (s) => Math.round(((lifeState(s).debt.rent || 0) + LIFE.deposit) * 100) / 100;

export function rehouse(g) {
  const s = g.state;
  const l = lifeState(s);
  if (l.housing !== 'evicted') return false;
  const cost = rehouseCost(s);
  if (s.money < cost) { g.toast(`You need ${money(cost)}. You have ${money(s.money)}.`, 'bad'); return false; }
  spend(g, cost, 'Rae Vell — arrears + deposit');
  l.debt.rent = 0;
  l.housing = 'housed';
  l.rehousedDay = clock(s).day;
  s.bills.rent.paidCycle = rentCycleNow(g);
  s.bills.rent.missed = 0;
  trust(s, 'rae', 2);
  bump(s, 'morale', 18);
  bump(s, 'stress', -12);
  logLine(g, 'Got the key to Unit 3B back.', 'good');
  g.audio?.sfx?.('confirm');
  g.toast('Rae hands you a new key and does not make a speech about it. That is the speech.', 'good');
  return true;
}

function rentCycleNow(g) {
  const r = CONFIG.economy.rent;
  const day = clock(g.state).day;
  return Math.max(-1, Math.floor((day - r.firstDueDay) / r.periodDays));
}

/** Stress held at the top for too long comes out on somebody. */
function aScene(g) {
  const s = g.state;
  const area = g.world?.areaId;
  const who = area === 'bodega' ? 'miguel' : area === 'habibs' ? 'habib' : area === 'church' ? 'addison' : s.job.employed ? 'dale' : 'kev';
  const names = { miguel: 'Miguel', habib: 'Habib', addison: 'Addison', dale: 'Dale', kev: 'Kev' };
  trust(s, who, -3);
  if (who === 'dale' && s.job.employed) { s.job.strikes++; }
  s.stats.stress = 58;
  bump(s, 'morale', -10);
  s.counters.stressHighHours = 0;
  turningPoint(g, 'snapped', `Snapped at ${names[who]}.`);
  g.openModal?.({
    kicker: 'A SCENE',
    title: 'It Comes Out Sideways',
    body: `${names[who]} says something ordinary and you hear something else, and then you are saying things in a voice you do not use. People look. Someone stops pretending not to.\n\nAfterwards the shaking goes, mostly. ${names[who]} will remember this longer than you will.${who === 'dale' && s.job.employed ? `\n\nDale writes it down. Strike ${s.job.strikes} of ${CONFIG.job.maxStrikes}.` : ''}`,
    choices: [{ label: 'Walk it off.', effect: () => {} }],
  });
}

/** Morale on the floor for too long: the morning disappears, and someone notices. */
function aLowDay(g) {
  const s = g.state;
  s.counters.moraleLowHours = 0;
  turningPoint(g, 'lowday', 'Lost a morning to the ceiling.');
  g.advance(5 * 60, { sleeping: true, noCollapse: true });
  s.stats.morale = Math.max(s.stats.morale, 16);
  g.openModal?.({
    kicker: 'A LOW DAY',
    title: 'The Ceiling Has A Crack In It',
    body: 'You do not get up. You know exactly how to get up and you do not. The light moves across the wall like it is looking for someone else.\n\nAt some point your phone buzzes, and buzzes again.',
    choices: [{ label: 'Look at the phone.', effect: () => {} }],
  });
  nudgeFromFriend(g, 'They have not heard from you.');
}

/** Whoever trusts Mo most reaches out. If nobody does, Addison always will. */
function nudgeFromFriend(g, why) {
  const s = g.state;
  const lines = {
    kev: 'yo. you alive? you good? dont answer that just come get a slice',
    habib: 'My friend. I made too much rice again. This is not charity, it is bad planning. Come eat.',
    miguel: 'Papi you good? Come by, I got a BEC with your name on it. On the house this one time.',
    nia: 'Hey. Just checking. You don\'t have to say anything. I\'m around.',
    rae: 'Hallway light\'s been on all night. If that\'s you, I\'m not mad. I\'m checking.',
    addison: 'Friend — the door is open, the coffee is warm, and I have been praying for you specifically. Come Sunday. Or tonight. I am always here.',
  };
  const best = ['kev', 'habib', 'miguel', 'nia', 'rae'].map((id) => [id, trust(s, id)]).sort((a, b) => b[1] - a[1])[0];
  const from = best && best[1] > 0 ? best[0] : 'addison';
  const names = { kev: 'KEV', habib: 'HABIB', miguel: 'MIGUEL', nia: 'NIA', rae: 'RAE', addison: 'ADDISON OCTAVIUS' };
  pushMessage(g, { from: names[from], subject: why, body: lines[from] });
  if (from === 'habib') s.flags.habibMeal = true;
  if (from === 'miguel') s.flags.miguelBec = true;
}

/** The clinic line: one text a day. Doing it is the program. */
export function clinicCheckIn(g) {
  const s = g.state;
  const l = lifeState(s);
  const day = clock(s).day;
  if (!l.counselor) return false;
  if (l.checkinDay === day) { g.toast('Already checked in today. That counts.', 'info'); return false; }
  l.checkinDay = day;
  l.checkins = (l.checkins || 0) + 1;
  g.advance(10);
  bump(s, 'morale', 5);
  bump(s, 'stress', -6);
  // the honest part: it takes the edge off withdrawal, it does not remove it
  s.stats.withdrawal = clamp(s.stats.withdrawal - 10);
  logLine(g, 'Checked in with the clinic.', 'good');
  return true;
}

/* ------------------------------------------------------------------ the daily ledger */

const daysClean = (s) => {
  const last = s.high?.lastDose;
  if (last == null) return 0;
  return Math.max(0, Math.floor((s.clock.m - last) / 1440));
};

/**
 * 0-100: how Mo's life is going, from the things that actually press on it. Weights are not a
 * morality score: a roof and the rent matter more than mood, and a debt drags on everything.
 */
export function lifeIndex(g) {
  const s = g.state;
  const l = lifeState(s);
  const st = s.stats;
  const rent = billInfo(g, 'rent');
  const roof = l.housing === 'housed' ? 18 : 0;
  const rentOk = l.housing !== 'housed' ? 0 : rent.owedCycles === 0 ? 12 : rent.owedCycles === 1 ? 5 : 0;
  const work = s.job.employed ? (s.job.strikes === 0 ? 14 : 14 - s.job.strikes * 3) : 0;
  const dep = 16 * (1 - st.addiction / 100) - (st.withdrawal > 50 ? 3 : 0);
  const body = 12 * ((st.energy + st.hunger + st.hygiene) / 300);
  const mind = 12 * ((st.morale + (100 - st.stress)) / 200);
  const people = ['kev', 'habib', 'miguel', 'rae', 'dale', 'nia'].reduce((n, id) => n + clamp(trust(s, id), -5, 5), 0);
  const ppl = clamp(6 + people * 0.4, 0, 10);
  const cash = clamp(s.money / 40, 0, 6);
  const debt = Math.min(12, totalDebt(s) / 90);
  return Math.round(clamp(roof + rentOk + work + dep + body + mind + ppl + cash - debt));
}

export function trajectory(s) {
  const h = lifeState(s).history;
  if (h.length < 2) return { label: 'FINDING ITS LEVEL', arrow: '•', delta: 0 };
  const now = h[h.length - 1].index;
  // two days back: recent enough that a bad couple of days reads as a slide, not a climb
  const back = h[Math.max(0, h.length - 3)].index;
  const delta = now - back;
  if (delta >= 4) return { label: 'CLIMBING', arrow: '▲', delta };
  if (delta <= -4) return { label: 'SLIDING', arrow: '▼', delta };
  return { label: 'HOLDING', arrow: '▶', delta };
}

const MILESTONES = [
  { id: 'clean3', text: 'Three days without using.', test: (g, s) => daysClean(s) >= 3 },
  { id: 'clean7', text: 'A week without using.', test: (g, s) => daysClean(s) >= 7 },
  { id: 'clean14', text: 'Two weeks clean. The mornings are different.', test: (g, s) => daysClean(s) >= 14 },
  { id: 'rentpaid', text: 'Paid rent on time.', test: (g, s) => (s.counters.rentPaidOnTime || 0) >= 1 },
  { id: 'saved100', text: 'A hundred dollars that is not already spoken for.', test: (g, s) => s.money >= 100 && billInfo(g, 'rent').owedCycles === 0 },
  { id: 'debtfree', text: 'Paid off the hospital.', test: (g, s) => (lifeState(s).debtPaid || 0) > 0 && totalDebt(s) === 0 },
  { id: 'rehoused', text: 'Got the key back.', test: (g, s) => !!lifeState(s).rehousedDay },
  { id: 'rehired', text: 'Back on the schedule.', test: (g, s) => !!s.flags.rehired && s.job.employed },
  { id: 'checkins7', text: 'Seven check-ins with the clinic.', test: (g, s) => (lifeState(s).checkins || 0) >= 7 },
  { id: 'climb', text: 'Out of the hole. Not out of the woods.', test: (g, s) => lifeState(s).rockBottomDays > 0 && !lifeState(s).rockBottom },
];

/** Called once per new day: interest, the index, rock bottom, milestones. */
export function lifeNewDay(g, day) {
  const s = g.state;
  const l = lifeState(s);
  // debt grows a little every day, and collections remember
  for (const k of ['hospital', 'rent']) {
    if (l.debt[k] > 0) l.debt[k] = Math.round(l.debt[k] * (1 + LIFE.debtInterest) * 100) / 100;
  }
  if (totalDebt(s) > 0 && day % 3 === 0) {
    pushMessage(g, {
      from: l.debt.hospital > 0 ? 'KINGS COUNTY BILLING' : 'RAE VELL (LANDLORD)',
      subject: 'Balance outstanding',
      body: `You owe ${money(totalDebt(s))}. Any amount helps. Payments through Shale Pay.\n\nThis balance grows by about one percent a day.`,
    });
  }
  const index = lifeIndex(g);
  l.index = index;
  l.history.push({ day, index });
  if (l.history.length > 30) l.history.shift();
  l.lowestIndex = Math.min(l.lowestIndex, index);
  const wasBottom = l.rockBottom;
  l.rockBottom = index < LIFE.rockBottom;
  if (l.rockBottom) l.rockBottomDays = (l.rockBottomDays || 0) + 1;
  if (l.rockBottom && !wasBottom) {
    turningPoint(g, 'rockbottom', 'Rock bottom.');
    nudgeFromFriend(g, 'Thinking about you.');
  }
  for (const m of MILESTONES) {
    if (l.milestones[m.id]) continue;
    try {
      if (m.test(g, s)) {
        l.milestones[m.id] = day;
        bump(s, 'morale', 6);
        logLine(g, `Milestone: ${m.text}`, 'good');
        g.toast(`Milestone — ${m.text}`, 'good');
      }
    } catch { /* a milestone that cannot evaluate yet just waits */ }
  }
}

/**
 * Replaces the old game-over check. Returns true only if something took over the moment (a
 * modal), so the caller stops advancing time for this tick.
 */
export function checkTurningPoints(g) {
  const s = g.state;
  if (s.ending) return true;
  const l = lifeState(s);
  if (l.inHospital) return false;
  // within a point of the ceiling counts: the healthy-hours decay shaves a fraction off every
  // tick, and an exact >= 100 let a maxed-out risk slip under the line before it was checked
  if (s.stats.risk >= CONFIG.substances.risk.overdoseAt - 1) { hospitalize(g, 'overdose'); return true; }
  if (s.counters.collapsed >= 4) { hospitalize(g, 'collapse'); return true; }
  if (l.housing === 'housed' && s.flags.evictionNotice && billInfo(g, 'rent').owedCycles >= CONFIG.economy.evictionAfterMissedCycles) { evict(g); return true; }
  if (s.counters.stressHighHours >= 52) { aScene(g); return true; }
  if (s.stats.morale <= 1 && s.counters.moraleLowHours > 10) { aLowDay(g); return true; }
  return false;
}

/** Pay toward what he owes (hospital first, it is the one that calls). */
export function payDebt(g, amount) {
  const s = g.state;
  const l = lifeState(s);
  const owe = totalDebt(s);
  const pay = Math.min(amount, owe, s.money);
  if (pay <= 0) return false;
  if (!spend(g, pay, 'Debt payment')) return false;
  let left = pay;
  for (const k of ['hospital', 'rent']) {
    const p = Math.min(left, l.debt[k] || 0);
    l.debt[k] = Math.round(((l.debt[k] || 0) - p) * 100) / 100;
    left -= p;
  }
  l.debtPaid = (l.debtPaid || 0) + pay;
  bump(s, 'stress', -3);
  logLine(g, `Paid ${money(pay)} toward debt.`, 'good');
  return true;
}

/**
 * Sleeping somewhere that is not a bed: the bench, a Fellowship cot. The body gets less back,
 * the street takes its share, and the cot comes with Addison.
 */
export function roughSleep(g, where = 'bench', hours = 6) {
  const s = g.state;
  const before = s.money;
  g.advance(hours * 60, { sleeping: true, noCollapse: true });
  if (where === 'bench') {
    // the body does not rest on slats: hand back a third of what the sleep restored
    bump(s, 'energy', -hours * 4);
    bump(s, 'hygiene', -10);
    bump(s, 'stress', 8);
    bump(s, 'morale', -6);
    // Gus keeps an eye out for people he likes; otherwise the street helps itself
    const watched = trust(s, 'homeless') >= 2;
    if (!watched && before > 5 && Math.random() < 0.3) {
      const took = Math.round(before * 0.4 * 100) / 100;
      spend(g, took, 'Taken while you slept');
      g.toast(`You wake up lighter. ${money(took)} lighter.`, 'bad');
    } else {
      g.toast(watched ? 'Gus sat up with you. Nobody came close.' : 'You wake up stiff, cold, and still in possession of everything. Today, anyway.', watched ? 'good' : 'info');
    }
    logLine(g, `Slept ${hours}h on the bench.`, 'bad');
  } else {
    bump(s, 'stress', -4);
    s.fellowship.titheOwed = (s.fellowship.titheOwed || 0) + 12;
    trust(s, 'addison', 1);
    logLine(g, `Slept ${hours}h on a Fellowship cot.`, 'info');
    g.toast('A cot, a blanket that smells of other people\'s laundry, and $12 added to your tithe. "A gift," he says.', 'event');
  }
  s.counters.sleeps = (s.counters.sleeps || 0) + 1;
}

/** Washing up somewhere that lets you. */
export function washUp(g, where) {
  const s = g.state;
  g.advance(20);
  bump(s, 'hygiene', where === 'church' ? 30 : 24);
  bump(s, 'morale', 3);
  g.toast(where === 'church' ? 'The Fellowship restroom has good soap. Of course it does.' : 'Habib hands you a towel and pretends to restock the shelf.', 'good');
}

export { daysClean };
