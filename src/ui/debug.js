/**
 * The hidden debug menu.
 *
 *   ~  → password prompt → `Moses` → the panel
 *
 * A wrong password closes the prompt with no error and no hint: it does not exist, which is the
 * point. Everything in the panel calls the same systems the game does — simulate(), rent.js,
 * romance.js, clinic.js, scheduler.js, the collapsing sequence, the real animations — so a
 * change here is a change to the actual run, not to a label.
 *
 * It is a testing tool, not security. It pauses the clock while open (nothing drains behind the
 * panel) and writes an autosave after destructive actions only once, on close.
 */
import { CONFIG } from '../core/config.js';
import { clamp, money, hhmm, dayOf, minuteOfDay } from '../core/util.js';
import { bump, addItem } from '../core/state.js';
import { billInfo } from '../systems/economy.js';
import * as rent from '../systems/rent.js';
import * as romance from '../systems/romance.js';
import * as clinic from '../systems/clinic.js';
import * as scheduler from '../systems/scheduler.js';
import * as events from '../systems/events.js';
import * as rides from '../systems/rides.js';
import { useSubstance } from '../systems/needs.js';
import { STRANGERS } from '../core/strangers.js';

/* ------------------------------------------------------------------ prefs */

/**
 * The freeze cheat is a testing preference, not part of the run, so it does not ride in a save
 * slot: it sits in one key of its own beside the slots and comes back on the next boot. That way
 * a long test keeps its settings across a reload without putting "needs frozen" into a save the
 * player might later load to actually play. Clicking it off writes `noDrain: false` straight back.
 */
const PREFS_KEY = CONFIG.debug.storeKey;

function readPrefs() {
  try { return JSON.parse(localStorage.getItem(PREFS_KEY) || '{}') || {}; } catch { return {}; }
}

function writePrefs(g) {
  try { localStorage.setItem(PREFS_KEY, JSON.stringify({ noDrain: !!g.debugNoDrain })); } catch { /* private window: memory only */ }
}

/** Put the remembered testing toggles back on `g`. Called at boot and again after a save loads. */
export function applyDebugPrefs(g) {
  const prefs = readPrefs();
  if (typeof prefs.noDrain === 'boolean') g.debugNoDrain = prefs.noDrain;
}

/* ------------------------------------------------------------------ the state dump */

/** The last `n` of a list, or an empty list if it is not one. */
const tail = (arr, n) => (Array.isArray(arr) ? arr.slice(-n) : []);

/**
 * The state as a dump carries it.
 *
 * A dump is a bug report, not an archive: it needs where the run is now and what just happened,
 * not 150 messages and three days of ledger. Every system block goes in whole — nothing is rebuilt
 * by allowlist, so a system added later still reports itself — and only the bulk lists are cut to
 * their tails, with message bodies dropped (they are prose, and the bodies are what make a dump
 * long). What the trim leaves out comes back as the game's own default on load, not as undefined.
 */
export function trimState(s) {
  // a dump is a snapshot, not a window on the run: without the copy, every nested block would stay
  // a live reference and a diff of two dumps would compare the state with itself
  const c = JSON.parse(JSON.stringify(s || {}));
  return {
    ...c,
    log: tail(c.log, 8),
    ledger: tail(c.ledger, 6),
    seenEvents: tail(c.seenEvents, 5),
    messages: tail(c.messages, 2).map((m) => ({ id: m.id, from: m.from, subject: m.subject, day: m.day, read: m.read })),
    life: { ...c.life, history: tail(c.life?.history, 3), turning: tail(c.life?.turning, 3) },
    dealer: { ...c.dealer, log: tail(c.dealer?.log, 3), orders: tail(c.dealer?.orders, 3) },
  };
}

/**
 * A pasted dump back into a state, or null if it is not one. Accepts the whole dump with its
 * header, or a bare state: all it insists on is a clock, because a run without one is not a run.
 */
export function parseDump(text) {
  let obj;
  try { obj = JSON.parse(String(text || '').trim()); } catch { return null; }
  if (!obj || typeof obj !== 'object') return null;
  const st = obj.state && typeof obj.state === 'object' ? obj.state : obj.clock ? obj : null;
  if (!st || !st.clock || !Number.isFinite(Number(st.clock.m))) return null;
  return st;
}

/* ------------------------------------------------------------------ what changed */

/**
 * Every primitive in the state as a dotted path, and every list as its length. Deep enough for the
 * shape the game has (bills.rent.paidAhead, life.turning, dealer.log) and shallow enough that a
 * diff of two of them is a handful of lines instead of a second dump.
 */
function flattenState(obj, prefix = '', out = {}, depth = 0) {
  for (const [k, v] of Object.entries(obj || {})) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (Array.isArray(v)) out[path] = v.length;
    else if (v && typeof v === 'object') { if (depth < 2) flattenState(v, path, out, depth + 1); }
    else if (v !== undefined) out[path] = v;
  }
  return out;
}

// what a reader checks first, in the order they check it
const DIFF_FIRST = ['clock.m', 'money', 'savedWhere', 'life.housing', 'job.id'];

function pathRank(path) {
  const i = DIFF_FIRST.indexOf(path);
  if (i >= 0) return i;
  if (path.startsWith('stats.')) return 10;
  if (path.startsWith('life.')) return 20;
  if (path.startsWith('flags.')) return 30;
  if (path.startsWith('counters.')) return 40;
  return 25;
}

function shortValue(v) {
  if (v === null) return 'null';
  if (typeof v === 'string') return `"${v.length > 32 ? `${v.slice(0, 32)}…` : v}"`;
  return String(v);
}

/** Two clock readings as the distance a player would say out loud. */
function clockDelta(from, to) {
  const mins = Math.round(Number(to) - Number(from));
  if (!Number.isFinite(mins) || !mins) return 'no change';
  const abs = Math.abs(mins);
  const parts = [abs >= 60 ? `${Math.floor(abs / 60)}h` : '', abs % 60 ? `${abs % 60}m` : ''].filter(Boolean);
  return `${mins > 0 ? '+' : '−'}${parts.join(' ')}`;
}

/**
 * What moved between two states, as short lines — the last stretch of a run, not a diff of every
 * field. Sorted so the things a bug report is about (the clock, the money, where he is, what the
 * needs did) come first, and capped so a report stays readable: a run that has changed in eighty
 * places has changed in eighty places whether or not all eighty are listed.
 */
export function diffStates(prev, cur, limit = 12) {
  if (!prev || !cur) return [];
  const a = flattenState(prev);
  const b = flattenState(cur);
  const rows = [];
  for (const path of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const had = path in a;
    const has = path in b;
    if (had && !has) { rows.push({ path, line: `${path}: gone` }); continue; }
    if (!had && has) { rows.push({ path, line: `${path}: new` }); continue; }
    if (a[path] === b[path]) continue;
    if (path === 'clock.m') rows.push({ path, line: `clock: ${clockDelta(a[path], b[path])}` });
    else if (path === 'money') rows.push({ path, line: `money: ${money(a[path])} → ${money(b[path])}` });
    else rows.push({ path, line: `${path}: ${shortValue(a[path])} → ${shortValue(b[path])}` });
  }
  rows.sort((x, y) => pathRank(x.path) - pathRank(y.path) || x.path.localeCompare(y.path));
  const lines = rows.map((r) => r.line);
  if (lines.length > limit) lines.splice(limit, lines.length - limit, `… ${rows.length - limit} more changed`);
  return lines;
}

/**
 * The first frames of a stack: where it broke, not every frame, and not the message — the record
 * already carries that. Handles V8's `at fn (f.js:1:2)` and the `fn@f.js:1:2` form other engines
 * use; a stack with no recognisable frame is kept as it came rather than emptied.
 */
const stackLines = (stack) => {
  const lines = String(stack || '').split('\n').map((l) => l.trim()).filter(Boolean);
  const frames = lines.filter((l) => /^at\s|^[^@]*@/.test(l));
  return (frames.length ? frames : lines).slice(0, 4).map((l) => l.slice(0, 160));
};

/** How long ago a kept dump was written, in the terms a report uses. */
function ago(iso) {
  const ms = Date.now() - Date.parse(iso);
  if (!Number.isFinite(ms)) return 'unknown when';
  const min = Math.round(ms / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  return `${Math.floor(min / 60)}h ${min % 60}m ago`;
}

const STATS = [
  ['energy', 'Energy'], ['hunger', 'Food'], ['hygiene', 'Hygiene'],
  ['stress', 'Stress'], ['morale', 'Morale'], ['addiction', 'Dependence'],
  ['tolerance', 'Tolerance'], ['risk', 'Risk'], ['withdrawal', 'Withdrawal'],
];

const PLACES = [
  ['apartment', 'Unit 3B'], ['street', 'Kestrel St.'], ['quikstop', 'Quik-Stop'], ['bodega', "Miguel's"],
  ['habibs', "Habib's"], ['church', 'Fellowship'], ['park', 'Kestrel Park'], ['clinic', 'Clinic'],
];

// the NPC kinds the world knows how to build, and which ones the panel's pickers have chosen
const NPC_KINDS = ['kev', 'rae', 'dale', 'dex', 'nia', 'miguel', 'habib', 'homeless', 'junkie', 'clerk', 'rolo', 'stephanie', 'melanie', 'diana', ...STRANGERS.map((w) => w.id)];
const debugSel = {};

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function installDebugMenu(g) {
  if (g.__debugInstalled) return;
  g.__debugInstalled = true;
  applyDebugPrefs(g);
  const ui = document.getElementById('ui') || document.body;
  let panel = null;
  let prompt = null;
  let dumpText = '';
  let pasteOpen = false;
  let pasteText = '';
  let kept = null;               // the dump storage holds: the run as of the last minute of play
  let lastError = null;          // the last uncaught error, which the next dump names

  const close = () => {
    if (panel) { panel.remove(); panel = null; }
    g.debugOpen = false;
    g.autosave?.();
    g.hud?.update?.();
  };

  const closePrompt = () => { if (prompt) { prompt.remove(); prompt = null; } };

  const open = () => {
    closePrompt();
    if (panel) { close(); return; }
    panel = document.createElement('div');
    panel.className = 'debug';
    panel.innerHTML = `<div class="debug__panel" role="dialog" aria-label="Debug menu">
      <header class="debug__head"><b>MO: FUNCTIONAL · DEBUG</b><span>~ closes</span>
        <button class="debug__x" data-dact="close">&times;</button></header>
      <div class="debug__body"></div>
    </div>`;
    ui.appendChild(panel);
    kept = readKept() || kept;   // another tab may have kept a newer one since this panel opened
    g.debugOpen = true;
    render();
    panel.addEventListener('click', onClick);
  };

  const showPrompt = () => {
    if (prompt) { closePrompt(); return; }
    if (panel) return;
    prompt = document.createElement('div');
    prompt.className = 'debug-prompt';
    prompt.innerHTML = `<div class="debug-prompt__box">
      <label for="dbg-pass">PASSWORD</label>
      <input id="dbg-pass" type="password" autocomplete="off" spellcheck="false" maxlength="24" />
    </div>`;
    ui.appendChild(prompt);
    const input = prompt.querySelector('input');
    input.focus();
    // the key that opened the prompt can land in it: on layouts where ~ is a dead key it arrives
    // as "~" in front of the first letter, so clear it once the opening keystroke is done
    setTimeout(() => { if (/^[~`]+$/.test(input.value)) input.value = ''; }, 0);
    const submit = () => {
      // letters only, any case: "~Moses", "moses " and "Moses" are all the password
      const clean = (v) => String(v).replace(/[^a-z]/gi, '').toLowerCase();
      // wrong: it simply was not there. no message, no shake, no clue.
      if (clean(input.value) !== clean(CONFIG.debug.password)) { closePrompt(); return; }
      open();
    };
    input.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') { e.preventDefault(); submit(); }
      if (e.key === 'Escape') { e.preventDefault(); closePrompt(); }
    });
    // clicking away closes it, silently
    prompt.addEventListener('click', (e) => { if (e.target === prompt) closePrompt(); });
  };

  window.addEventListener('keydown', (e) => {
    if (e.code !== 'Backquote' && e.key !== '~' && e.key !== '`') return;
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    e.preventDefault();
    e.stopPropagation();
    if (panel) close(); else showPrompt();
  }, true);

  /* ------------------------------------------------------------ actions */

  function act(name, arg) {
    const s = g.state;
    switch (name) {
      case 'close': return close();

      /* ---- condition ---- */
      case 'heal':
        for (const [k] of STATS) s.stats[k] = ['stress', 'addiction', 'tolerance', 'risk', 'withdrawal'].includes(k) ? 0 : 100;
        g.toast('Debug: all needs replenished.', 'good');
        break;
      case 'resetintox':
        s.high.level = 0;
        s.high.until = s.clock.m;
        s.stats.tolerance = 0;
        s.stats.withdrawal = 0;
        g.toast('Debug: intoxication, tolerance and withdrawal cleared.', 'good');
        break;
      case 'sober':
        s.stats.addiction = Math.min(s.stats.addiction, 4);
        s.stats.risk = Math.min(s.stats.risk, 6);
        s.flags.odScare = false;
        g.toast('Debug: dependence and risk reset.', 'good');
        break;
      case 'stat': {
        const [key, delta] = String(arg).split(':');
        if (key in s.stats) bump(s, key, Number(delta));
        break;
      }

      /* ---- money ---- */
      case 'money': {
        // the buttons carry their own amount; anything without one keeps the configured click
        const asked = Number(arg);
        const amount = Number.isFinite(asked) && asked > 0 ? asked : CONFIG.debug.moneyPerClick;
        g.earnMoney(amount, 'Debug');
        g.toast(`Debug: +${money(amount)} (${money(s.money)}).`, 'good');
        break;
      }
      case 'setmoney':
        s.money = Math.max(0, Math.round((Number(arg) || 0) * 100) / 100);
        g.toast(`Debug: balance set to ${money(s.money)}.`, 'good');
        break;
      case 'broke':
        s.money = 0;
        g.toast('Debug: balance zeroed.', 'bad');
        break;

      /* ---- time ---- */
      case 'hour': {
        const target = Number(arg);
        const dayStart = Math.floor(s.clock.m / 1440) * 1440;
        const delta = (dayStart + target * 60) - s.clock.m;
        g.advance(delta > 0 ? delta : 1440 + delta, { noCollapse: true });
        break;
      }
      case 'skip':
        g.advance(Number(arg) * 60, { noCollapse: true });
        break;
      case 'newday':
        g.advance(1440, { noCollapse: true });
        break;
      case 'pause':
        g.paused = !g.paused;
        g.toast(g.paused ? 'Debug: clock paused.' : 'Debug: clock resumed.', 'info');
        break;

      /* ---- world ---- */
      case 'tp':
        g.goTo(String(arg), null);
        break;
      case 'event':
        scheduler.trigger(g, String(arg), events.EVENTS_LIST);
        break;
      case 'setday': {
        // forward only: the bills, the life history and every cooldown are keyed to the day, and
        // rewinding the clock under them would corrupt the run rather than test it
        const target = Math.floor(Number(arg));
        const today = dayOf(s.clock.m);
        if (!(target > today)) { g.toast(`Debug: day ${today} or later only (time only runs forward).`, 'bad'); break; }
        const minutes = (target - today) * 1440;
        g.advance(minutes, { noCollapse: true });
        g.toast(`Debug: it is day ${dayOf(s.clock.m)}.`, 'info');
        break;
      }
      case 'npcspawn':
        if (g.world?.debugSpawnNPC?.(arg)) g.toast(`Debug: ${arg} is here.`, 'info');
        break;
      case 'npcdespawn':
        g.toast(g.world?.debugDespawnNPC?.(arg) ? `Debug: removed the nearest ${arg}.` : `Debug: no ${arg} in this area.`, 'info');
        break;
      case 'npcreset':
        g.toast(`Debug: ${g.world?.resetNPCs?.(g) ?? 0} NPCs put back on schedule.`, 'info');
        break;
      case 'cooldowns':
        scheduler.clearCooldowns(g);
        g.toast('Debug: event cooldowns cleared.', 'good');
        break;

      /* ---- testing cheats ---- */
      case 'nodrain':
        // needs.js reads this before it applies any rate; the clock, events and rides keep running
        g.debugNoDrain = !g.debugNoDrain;
        writePrefs(g);
        g.toast(g.debugNoDrain ? 'Debug: needs frozen. The clock still runs.' : 'Debug: needs running again.', 'info');
        break;
      case 'fastclock':
        g.setSpeed((s.settings.speed || 1) >= 3 ? 1 : 3);
        g.toast(`Debug: clock at ${s.settings.speed}x.`, 'info');
        break;
      case 'ride': {
        // the real call, then the arrival pulled forward to this minute: no waiting out the ETA
        if (!rides.callRide(g)) break;
        rides.rideState(s).arriveAt = s.clock.m;
        rides.tickRide(g);
        g.toast('Debug: the car is at the curb.', 'good');
        break;
      }
      case 'rehire':
        Object.assign(s.job, { employed: true, fired: false, quit: false, strikes: 0, warned: false, calledOut: false });
        g.toast('Debug: back on the Quik-Stop schedule.', 'good');
        break;
      case 'housed':
        s.life.housing = 'housed';
        s.flags.evictionNotice = false;
        s.flags.powerCut = false;
        rent.debugSetRent(g, { paidAhead: 0 });
        g.toast('Debug: housed again, this rent cycle settled.', 'good');
        break;
      case 'debtfree':
        s.life.debt = { hospital: 0, rent: 0 };
        g.toast('Debug: debts cleared.', 'good');
        break;
      case 'tutorial':
        Object.assign(s.flags, { tutorial: 4, guided: true, intro: true });
        g.toast('Debug: intro and tutorial marked done.', 'info');
        break;
      case 'allitems': {
        const ids = ['bliss', 'static', 'mud', 'drip'];
        const given = ids.filter((id) => addItem(s, id, 3)).length;
        g.toast(`Debug: ${given} substances x3.`, given ? 'good' : 'bad');
        break;
      }
      case 'save1':
        g.saveSlot(1);
        break;
      case 'dump':
        doDump();
        break;
      case 'dumpcopy':
        copyDump();
        break;
      case 'dumpclear':
        dumpText = '';
        break;
      case 'dumpkept':
        if (!kept) { g.toast('Debug: no kept dump yet — one is written every minute of play.', 'bad'); break; }
        dumpText = JSON.stringify(kept, null, 2);
        copyDump();
        break;
      case 'errclear':
        lastError = null;
        // drop the carried-over copy as well, or it comes back on the next read of storage
        if (kept?.error) {
          kept = { ...kept, error: null };
          try { localStorage.setItem(CONFIG.debug.dumpKey, JSON.stringify(kept)); } catch { /* nothing kept */ }
        }
        g.toast('Debug: last error cleared.', 'info');
        break;
      case 'dumpforget':
        try { localStorage.removeItem(CONFIG.debug.dumpKey); } catch { /* nothing kept to forget */ }
        kept = null;
        g.toast('Debug: kept dump forgotten.', 'info');
        break;
      case 'dumppaste':
        pasteOpen = !pasteOpen;
        break;
      case 'dumpcancel':
        pasteOpen = false;
        pasteText = '';
        break;
      case 'dumpload':
        loadDump();
        break;

      /* ---- relationships ---- */
      case 'aff': {
        const [id, delta] = String(arg).split(':');
        const st = romance.partnerState(s, id);
        st.affection = clamp(st.affection + Number(delta));
        st.met = true;
        break;
      }
      case 'girlfriend': {
        const st = romance.partnerState(s, arg);
        st.met = true;
        st.girlfriend = true;
        st.sinceDay = st.sinceDay || dayOf(s.clock.m);
        st.affection = Math.max(st.affection, 60);
        g.toast(`Debug: ${CONFIG.partners[arg].name} is your girlfriend.`, 'good');
        break;
      }
      case 'livein': {
        const st = romance.partnerState(s, arg);
        st.met = true;
        st.girlfriend = true;
        st.sinceDay = st.sinceDay || dayOf(s.clock.m);
        st.affection = Math.max(st.affection, 70);
        s.romance.liveIn = arg;
        romance.romanceState(s);
        g.toast(`Debug: ${CONFIG.partners[arg].name} lives in Unit 3B.`, 'good');
        break;
      }
      case 'gift': {
        const r = romance.romanceState(s);
        r.apartmentGift = null;
        const ok = romance.spawnGift(g, arg);
        g.toast(ok ? 'Debug: a present is waiting at home.' : 'Debug: no gift pool for her, or one is already pending.', ok ? 'good' : 'bad');
        break;
      }
      case 'romreset':
        romance.debugReset(g);
        g.toast('Debug: relationship state reset.', 'info');
        break;

      /* ---- gameplay testing ---- */
      case 'collapse':
        g.collapseSequence?.('collapse');
        break;
      case 'clinicrecover':
        clinic.recoverHere(g, { cause: 'collapse', free: true });
        g.goTo?.('clinic', null);
        break;
      case 'rent':
        rent.payRent(g, { ahead: true });
        break;
      case 'rentpaid':
        rent.debugSetRent(g, { paidAhead: 0 });
        g.toast('Debug: rent marked paid for this cycle.', 'good');
        break;
      case 'date': {
        const [id, activity] = String(arg).split(':');
        romance.startDate(g, id, activity || 'park');
        break;
      }
      case 'cheeks': {
        romance.partnerState(s, arg).affection = 100;
        s.romance.afterglowUntil = 0;
        romance.cheeks(g, arg);
        break;
      }
      case 'afterglow':
        romance.startAfterglow(g);
        g.toast('Debug: Afterglow started (24 in-game hours).', 'good');
        break;
      case 'dance':
        g.world?.playDance?.(8);
        break;
      case 'use':
        if (s.inventory.find((i) => i.id === arg)) useSubstance(g, arg);
        else g.toast(`Debug: no ${arg} in the inventory.`, 'bad');
        break;
      case 'give':
        // through the real inventory: one stack per item, not a new row per click
        if (!addItem(s, arg, 1)) g.toast(`Debug: no item called ${arg}.`, 'bad');
        break;
      case 'phone':
        g.togglePhone();
        break;
      case 'summary':
        g.onDaySummary?.();
        break;
      default:
        console.warn('[debug] unknown action', name);
    }
    render();
    g.hud?.update?.();
  }

  /** Replace this run with a pasted one. The run being replaced goes to the autosave first. */
  function loadDump() {
    const st = parseDump(pasteText);
    if (!st) { g.toast('Debug: not a state dump — paste the whole JSON, or a bare state.', 'bad'); return; }
    // whatever is running now lands in the autosave slot, so "continue" can bring it back if the
    // pasted run was not the one that was meant
    try { g.autosave?.(); } catch { /* storage blocked: nothing to fall back on */ }
    try {
      // the same load path a slot uses, minus its "Loaded" toast: this one says what it did below
      g.applyState?.(st);
    } catch (err) {
      console.warn('[debug] dump load failed', err);
      g.toast('Debug: that dump would not load — this run was left as it was.', 'bad');
      return;
    }
    pasteOpen = false;
    pasteText = '';
    g.toast(`Debug: run restored — day ${dayOf(g.state.clock.m)} · ${money(g.state.money)}.`, 'good');
  }

  function readKept() {
    try { return JSON.parse(localStorage.getItem(CONFIG.debug.dumpKey) || 'null'); } catch { return null; }
  }

  /** A dump of this moment, plus the short diff against `prev` — the state of the last kept dump. */
  function buildDump(prev) {
    const s = g.state;
    const st = trimState(s);
    return {
      dump: 'mo:functional state',
      version: CONFIG.meta.version,
      at: new Date().toISOString(),
      trimmed: { messages: 2, log: 8, ledger: 6, seenEvents: 5, lifeHistory: 3 },
      changes: diffStates(prev, st),
      // a report that names the exception names the bug: it rides with the run, not beside it
      error: recentError(),
      runtime: {
        mode: g.mode,
        paused: !!g.paused,
        speed: s.settings?.speed ?? 1,
        place: s.savedWhere || null,
        needsFrozen: !!g.debugNoDrain,
        slot: g.lastSlot ?? null,
        overlays: [...(g.overlays || [])],
      },
      state: st,
    };
  }

  /**
   * Write the kept dump: this run, now, with what moved since the one before it. One goes out a
   * minute of play, so a crash or a stuck bug leaves the minute it happened in storage even though
   * the panel was never opened — and the diff in the dump says what that minute did.
   */
  function keepDump(opts = {}) {
    if (!g.state?.clock) return null;
    // an error is kept wherever it happens; a routine one only while the game is actually playing
    if (!opts.force && g.mode !== 'play') return null;
    if (!opts.force && typeof document !== 'undefined' && document.hidden) return null; // a background tab is not playing
    const dump = buildDump(kept?.state || null);
    try {
      localStorage.setItem(CONFIG.debug.dumpKey, JSON.stringify(dump));
      kept = dump;
    } catch { /* full or blocked storage: the panel still makes dumps on demand */ }
    return dump;
  }

  /* ---- the last exception ---- */

  /** The error a report should name: the one just caught, or a recent one a reload did not lose. */
  function recentError() {
    if (lastError) return lastError;
    const carried = kept?.error;
    if (carried?.at && Date.now() - Date.parse(carried.at) < 15 * 60000) return carried;
    return null;
  }

  /**
   * Keep an uncaught error with the run it happened in.
   *
   * The handler never calls preventDefault, so the error still reaches the console and the browser's
   * own reporting; this only makes sure a dump exists that names it. Nothing in here may throw — a
   * handler that throws loses the error it was called for — and a crash looping every frame bumps a
   * count instead of rewriting storage each time.
   */
  function noteError(kind, err) {
    const now = Date.now();
    const message = String(err?.message || 'unknown error').slice(0, 300);
    const where = err?.where ? String(err.where).slice(0, 200) : null;
    if (lastError && lastError.message === message && lastError.where === where && now - Date.parse(lastError.at) < 10000) {
      lastError.count += 1;
      lastError.at = new Date(now).toISOString();
      return;
    }
    const s = g.state;
    lastError = {
      at: new Date(now).toISOString(),
      kind,
      message,
      where,
      count: 1,
      // where in the run it happened, so a report can be lined up against the day
      day: s?.clock ? dayOf(s.clock.m) : null,
      clock: s?.clock ? hhmm(minuteOfDay(s.clock.m)) : null,
      stack: stackLines(err?.stack),
    };
    keepDump({ force: true });
    if (panel) render();
  }

  window.addEventListener('error', (e) => {
    try {
      noteError('error', { message: e.message, where: [e.filename, e.lineno, e.colno].filter(Boolean).join(':'), stack: e.error?.stack });
    } catch { /* an error handler that throws is worse than the error */ }
  });
  window.addEventListener('unhandledrejection', (e) => {
    try {
      const r = e.reason;
      noteError('rejection', { message: r?.message || String(r), stack: r?.stack });
    } catch { /* ignore */ }
  });

  /** The last exception as a row and a line: the first thing to read, above the run itself. */
  function errorRows() {
    const e = recentError();
    if (!e) return '';
    return `<div class="debug__row"><span>Last error</span><small>${e.kind === 'rejection' ? 'unhandled rejection' : 'uncaught'}${e.count > 1 ? ` ×${e.count}` : ''} · day ${e.day ?? '?'} ${e.clock ?? ''} · ${ago(e.at)}</small><button data-dact="errclear">Clear</button></div>
      <div class="debug__note debug__note--err">${esc(e.message)}${e.where ? ` · ${esc(e.where)}` : ''}</div>`;
  }

  /** What moved between the last two kept dumps, as lines: the part of a report that is the story. */
  function changesBlock() {
    const lines = Array.isArray(kept?.changes) ? kept.changes : null;
    if (!lines) return '';
    if (!lines.length) return '<div class="debug__note">Nothing changed between the last two kept dumps.</div>';
    return `<div class="debug__dump">
      <div class="debug__row"><span>Since the last dump</span><small>${kept.state?.clock ? `day ${dayOf(kept.state.clock.m)} · ${ago(kept.at)}` : ''}</small></div>
      <ol class="debug__changes">${lines.map((l) => `<li>${esc(l)}</li>`).join('')}</ol>
    </div>`;
  }

  // a debug nicety must never break a frame: whatever goes wrong in here stays in here
  kept = readKept();
  setInterval(() => { try { keepDump(); } catch { /* ignore */ } }, CONFIG.debug.keepDumpMs);

  /** The run as text, for pasting into a bug report — and back into the panel. */
  function doDump() {
    dumpText = JSON.stringify(buildDump(kept?.state || null), null, 2);
    copyDump();
  }

  async function copyDump() {
    if (!dumpText) return;
    try {
      await navigator.clipboard.writeText(dumpText);
      g.toast(`Debug: state copied (${dumpText.length} chars) — Load dump takes it back.`, 'good');
    } catch {
      // a browser that refuses the write, or the page on plain http: the text is, either way,
      // sitting in the panel below, selected, so ctrl+c still gets it out
      g.toast('Debug: clipboard blocked — the dump is selected below, ctrl+c.', 'bad');
      setTimeout(() => panel?.querySelector('.debug__dump textarea')?.select(), 0);
    }
  }

  function onClick(e) {
    const btn = e.target.closest('[data-dact]');
    if (!btn) return;
    e.preventDefault();
    act(btn.dataset.dact, btn.dataset.arg);
  }

  function render() {
    if (!panel) return;
    const body = panel.querySelector('.debug__body');
    const s = g.state;
    if (!s) { body.innerHTML = '<div class="debug__note">No run is loaded.</div>'; return; }
    const now = s.clock.m;
    const r = s.romance || {};
    const rentInfo = billInfo(g, 'rent');
    const statRows = STATS.map(([key, label]) => `<div class="debug__row">
      <span>${label}</span><b>${Math.round(s.stats[key] ?? 0)}</b>
      <button data-dact="stat" data-arg="${key}:-10">−</button>
      <button data-dact="stat" data-arg="${key}:10">+</button>
    </div>`).join('');

    const partnerRows = romance.PARTNER_KEYS.map((id) => {
      const p = CONFIG.partners[id];
      const st = romance.partnerState(s, id);
      return `<div class="debug__row debug__row--wide">
        <span>${esc(p.name)}</span><b>${st.affection}</b>
        <small>${st.liveIn ? 'live-in' : st.girlfriend ? 'girlfriend' : st.dates ? `${st.dates} dates` : 'met'}</small>
        <button data-dact="aff" data-arg="${id}:10">+aff</button>
        <button data-dact="aff" data-arg="${id}:-10">−aff</button>
        <button data-dact="girlfriend" data-arg="${id}">gf</button>
        <button data-dact="livein" data-arg="${id}">live-in</button>
        <button data-dact="gift" data-arg="${id}">gift</button>
        <button data-dact="date" data-arg="${id}:park">date</button>
        <button data-dact="cheeks" data-arg="${id}">cheeks</button>
      </div>`;
    }).join('');

    const sel = (debugSel.event = debugSel.event || (events.EVENT_IDS || [])[0] || '');
    const eventOpts = (events.EVENT_IDS || []).map((id) => `<option value="${id}" ${id === sel ? 'selected' : ''}>${id}</option>`).join('');
    const npcSel = (debugSel.npc = debugSel.npc || NPC_KINDS[0]);
    const npcOpts = NPC_KINDS.map((id) => `<option value="${id}" ${id === npcSel ? 'selected' : ''}>${id}</option>`).join('');

    body.innerHTML = `
      <div class="debug__grid">
        <section>
          <h4>Condition</h4>
          ${statRows}
          <div class="debug__row"><button data-dact="heal">Replenish all</button><button data-dact="resetintox">Reset intoxication</button></div>
          <div class="debug__row"><button data-dact="sober">Reset dependence + risk</button><button data-dact="afterglow">Start Afterglow</button></div>
          <div class="debug__row"><button data-dact="dance">Dance animation</button><button data-dact="collapse">Trigger collapse</button></div>
        </section>

        <section>
          <h4>Money</h4>
          <div class="debug__row"><span>Balance</span><b>${money(s.money)}</b></div>
          <div class="debug__row"><button data-dact="money" data-arg="1000">+$1,000</button><button data-dact="money" data-arg="10000">+$10,000</button><button data-dact="money" data-arg="100000">+$100,000</button><button data-dact="broke">Set $0</button></div>
          <div class="debug__row"><span>Set cash</span><input class="debug__num" type="number" min="0" step="100" value="5000" data-dact-input="setmoney" /><button data-dact="setmoney" data-arg="5000" data-input-source="setmoney">Set</button><button data-dact="debtfree">Clear debt</button></div>
          <div class="debug__row"><button data-dact="rentpaid">Mark rent paid</button><button data-dact="rent">Pay rent early</button><span class="debug__note">owed ${money(rentInfo.owed)} · due D${rentInfo.nextDueDay}</span></div>

          <h4>Time</h4>
          <div class="debug__row"><span>Clock</span><b>D${dayOf(now)} · ${hhmm(now)}</b></div>
          <div class="debug__row">${[6, 9, 12, 15, 18, 21, 2].map((h) => `<button data-dact="hour" data-arg="${h}">${String(h).padStart(2, '0')}:00</button>`).join('')}</div>
          <div class="debug__row"><button data-dact="skip" data-arg="1">+1h</button><button data-dact="skip" data-arg="4">+4h</button><button data-dact="newday">+1 day</button><button data-dact="pause">${g.paused ? 'Resume' : 'Pause'} clock</button></div>
          <div class="debug__row"><span>Set day</span><input class="debug__num" type="number" min="${dayOf(now) + 1}" value="${dayOf(now) + 1}" data-dact-input="setday" /><button data-dact="setday" data-arg="${dayOf(now) + 1}" data-input-source="setday">Go</button></div>

          <h4>World</h4>
          <div class="debug__row">${PLACES.map(([id, label]) => `<button data-dact="tp" data-arg="${id}">${label}</button>`).join('')}</div>
          <div class="debug__row"><select data-dact-select="event">${eventOpts}</select><button data-dact="event" data-arg="${sel}" data-select-source="event">Trigger event</button><button data-dact="cooldowns">Clear cooldowns</button></div>
          <div class="debug__row"><select data-dact-select="npc">${npcOpts}</select><button data-dact="npcspawn" data-arg="${npcSel}" data-select-source="npc">Spawn</button><button data-dact="npcdespawn" data-arg="${npcSel}" data-select-source="npc">Despawn</button><button data-dact="npcreset">Reset schedules</button></div>
        </section>

        <section>
          <h4>Relationships</h4>
          ${partnerRows}
          <div class="debug__row"><button data-dact="romreset">Reset all relationship state</button></div>

          <h4>Cheats</h4>
          <div class="debug__row">
            <button data-dact="nodrain" class="${g.debugNoDrain ? 'on' : ''}">Needs frozen · ${g.debugNoDrain ? 'ON' : 'OFF'}</button>
            <button data-dact="fastclock">Clock ${(s.settings.speed || 1) >= 3 ? '3x &rarr; 1x' : '1x &rarr; 3x'}</button>
            <button data-dact="ride">Car now</button>
          </div>
          <div class="debug__row">
            <button data-dact="rehire">Rehire</button>
            <button data-dact="housed">Restore housing</button>
            <button data-dact="tutorial">Skip tutorial</button>
            <button data-dact="allitems">All substances &times;3</button>
            <button data-dact="save1">Save slot 1</button>
            <button data-dact="dump">State dump</button>
            <button data-dact="dumppaste">Load dump</button>
          </div>
          <div class="debug__note">Needs frozen is remembered until you switch it off, reloads included — it is kept outside the saves, not in them. The clock buttons are the same 1x/3x the speed keys use. A dump carries the systems and the last few lines of history, not the whole run; paste one into Load dump to reproduce it. The game also keeps its own dump every minute of play, with a short list of what changed since the one before — a crash can be reported without the panel ever having been open.</div>
          <div class="debug__row">
            <span>Kept dump</span><small>${kept?.state?.clock ? `day ${dayOf(kept.state.clock.m)} · ${ago(kept.at)}` : 'none yet — one is kept every minute of play'}</small>
            ${kept?.state?.clock ? '<button data-dact="dumpkept">Copy kept</button><button data-dact="dumpforget">Forget</button>' : ''}
          </div>
          ${errorRows()}
          ${changesBlock()}
          ${pasteOpen ? `<div class="debug__dump">
            <div class="debug__row"><span>Load dump</span><small>replaces this run · it goes to the autosave first</small>
              <button data-dact="dumpload">Load</button><button data-dact="dumpcancel">Cancel</button></div>
            <textarea spellcheck="false" rows="6" autocomplete="off" data-dact-input="paste" placeholder="paste a state dump…">${esc(pasteText)}</textarea>
          </div>` : ''}
          ${dumpText ? `<div class="debug__dump">
            <div class="debug__row"><span>State dump</span><small>${dumpText.length} chars</small>
              <button data-dact="dumpcopy">Copy again</button><button data-dact="dumpclear">Hide</button></div>
            <textarea readonly spellcheck="false" rows="6">${esc(dumpText)}</textarea>
          </div>` : ''}

          <h4>Testing</h4>
          <div class="debug__row"><button data-dact="clinicrecover">Clinic recovery</button><button data-dact="clinicrecover">Test clinic</button><button data-dact="phone">Phone</button><button data-dact="summary">Daily report</button></div>
          <div class="debug__row">${['bliss', 'static', 'mud', 'drip'].map((id) => `<button data-dact="give" data-arg="${id}">+${id}</button>`).join('')}</div>
          <div class="debug__row">${['bliss', 'static', 'mud', 'drip'].map((id) => `<button data-dact="use" data-arg="${id}">use ${id}</button>`).join('')}</div>
          <div class="debug__note">Afterglow: ${r.afterglowUntil > s.clock.m ? `${romance.afterglowLabel(s)}` : 'off'} · live-in: ${r.liveIn || 'none'} · collapses: ${s.counters.collapsed || 0} · events today: ${scheduler.schedulerState(s).today || 0}</div>
        </section>
      </div>`;
    // the <select>s feed the buttons next to them, so one click can use the chosen id
    for (const select of body.querySelectorAll('[data-dact-select]')) {
      select.addEventListener('change', () => {
        debugSel[select.dataset.dactSelect] = select.value;
        for (const btn of body.querySelectorAll(`[data-select-source="${select.dataset.dactSelect}"]`)) btn.dataset.arg = select.value;
      });
    }
    for (const input of body.querySelectorAll('[data-dact-input]')) {
      input.addEventListener('keydown', (e) => e.stopPropagation()); // typing a number is not a hotkey
      // the paste box holds its text in the closure, so a re-render (an action, a clock tick) does
      // not wipe what is being pasted; the number fields hand their value to the button beside them
      if (input.dataset.dactInput === 'paste') {
        input.addEventListener('input', () => { pasteText = input.value; });
        continue;
      }
      input.addEventListener('input', () => {
        const btn = body.querySelector(`[data-input-source="${input.dataset.dactInput}"]`);
        if (btn) btn.dataset.arg = input.value;
      });
    }
  }
}
