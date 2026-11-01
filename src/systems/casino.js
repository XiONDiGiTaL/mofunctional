/**
 * HardLuck Bet: an online casino in Mo's pocket. Slots, blackjack and a roulette wheel, for real
 * money out of the same balance that pays the rent.
 *
 * The house edge is real and the numbers are honest (slots return about 93%, blackjack is played
 * straight, roulette is an American wheel). Winning feels good, a losing day piles on stress, and
 * every bet takes a minute or two of game time, so an evening can disappear into it. Winnings are
 * income like any other (the Fellowship takes its tithe from those too).
 *
 * Headless: functions take `g` and an optional random source; the phone draws the tables.
 */
import { CONFIG } from '../core/config.js';
import { dayOf } from '../core/util.js';
import { bump, earn, spend, logLine } from '../core/state.js';

export function casinoState(s) {
  if (!s.casino) s.casino = { wagered: 0, won: 0, bets: 0, bigWin: 0, day: 0, dayNet: 0, bonusUsed: false };
  return s.casino;
}

const C = () => CONFIG.casino;

/** Can he cover this bet? (The free first bet is on the house.) */
export function canBet(s, amount) {
  return amount > 0 && (s.money >= amount || (!casinoState(s).bonusUsed && amount <= C().freeBet));
}

/** Take the stake. Returns false if he cannot cover it. */
function stake(g, amount) {
  const s = g.state;
  const cs = casinoState(s);
  const day = dayOf(s.clock.m);
  if (cs.day !== day) { cs.day = day; cs.dayNet = 0; }
  if (!cs.bonusUsed && amount <= C().freeBet) {
    cs.bonusUsed = true;
    g.toast(`HardLuck Bet: your first $${C().freeBet} bet is on us. (It is never on us again.)`, 'event');
  } else {
    if (s.money < amount) { g.toast('Insufficient funds. HardLuck Bet suggests depositing more. HardLuck Bet always suggests that.', 'bad'); return false; }
    spend(g, amount, 'HardLuck Bet');
    cs.dayNet -= amount;
  }
  cs.wagered += amount;
  cs.bets += 1;
  return true;
}

/** Pay out (0 = a loss) and do the feelings. */
function settle(g, bet, payout, minutes) {
  const s = g.state;
  const cs = casinoState(s);
  if (payout > 0) {
    earn(g, payout, 'HardLuck Bet');
    cs.won += payout;
    cs.dayNet += payout;
  }
  g.advance(minutes);
  const net = payout - bet;
  if (net > 0) {
    bump(s, 'morale', Math.min(12, 2 + Math.round(net / Math.max(1, bet))));
    bump(s, 'stress', -2);
    if (net >= bet * 10) {
      cs.bigWin = Math.max(cs.bigWin, net);
      logLine(g, `HardLuck Bet: won $${net}.`, 'good');
    }
  } else if (net < 0) {
    bump(s, 'stress', cs.dayNet < -C().chaseLine ? 3 : 1);
    if (cs.dayNet < -C().chaseLine) bump(s, 'morale', -2);
  }
}

/* ------------------------------------------------------------------ slots */

export const REELS = [
  { id: 'cherry', glyph: '🍒', w: 30 },
  { id: 'lemon', glyph: '🍋', w: 28 },
  { id: 'bell', glyph: '🔔', w: 18 },
  { id: 'bar', glyph: 'BAR', w: 12 },
  { id: 'seven', glyph: '7', w: 7 },
  { id: 'bag', glyph: '💰', w: 3 },
];
const TOTAL = REELS.reduce((a, r) => a + r.w, 0);
// returns about 92.8% over the long run (scripts/test-systems.mjs checks it)
export const SLOT_PAYS = { bag: 180, seven: 70, bar: 30, bell: 15, lemon: 8, cherry: 6 };

const spinReel = (rand) => {
  let x = rand() * TOTAL;
  for (const r of REELS) { if ((x -= r.w) < 0) return r.id; }
  return REELS[0].id;
};

/** The multiplier for three reels: three of a kind, or any two cherries pays the stake back. */
export function slotMultiplier(reels) {
  const [a, b, c] = reels;
  if (a === b && b === c) return SLOT_PAYS[a];
  if (reels.filter((r) => r === 'cherry').length === 2) return 2;
  return 0;
}

export function spin(g, bet, rand = Math.random) {
  if (!stake(g, bet)) return null;
  const reels = [spinReel(rand), spinReel(rand), spinReel(rand)];
  const mult = slotMultiplier(reels);
  settle(g, bet, bet * mult, 1);
  return { reels, mult, payout: bet * mult };
}

/* ------------------------------------------------------------------ roulette */

/** American wheel: 0, 00 and 1-36. Red/black pay 1:1; green (0 or 00) pays 17:1. */
const RED = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
export function roulette(g, bet, color, rand = Math.random) {
  if (!stake(g, bet)) return null;
  const n = Math.floor(rand() * 38); // 36 = 0, 37 = 00
  const pocket = n === 36 ? '0' : n === 37 ? '00' : String(n + 1);
  const landed = n >= 36 ? 'green' : RED.has(n + 1) ? 'red' : 'black';
  const payout = landed === color ? (color === 'green' ? bet * 18 : bet * 2) : 0;
  settle(g, bet, payout, 2);
  return { pocket, landed, payout };
}

/* ------------------------------------------------------------------ blackjack */

const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const SUITS = ['♠', '♥', '♦', '♣'];

export function handValue(cards) {
  let v = 0, aces = 0;
  for (const c of cards) {
    if (c.r === 'A') { aces++; v += 11; } else v += ['J', 'Q', 'K'].includes(c.r) ? 10 : Number(c.r);
  }
  while (v > 21 && aces) { v -= 10; aces--; }
  return v;
}

function draw(hand, rand) {
  hand.push({ r: RANKS[Math.floor(rand() * 13)], s: SUITS[Math.floor(rand() * 4)] });
}

/** Deal a hand. Returns the table state (kept by the phone), or null if he cannot cover it. */
export function deal(g, bet, rand = Math.random) {
  if (!stake(g, bet)) return null;
  const t = { bet, player: [], dealer: [], done: false, result: '' };
  draw(t.player, rand); draw(t.dealer, rand); draw(t.player, rand); draw(t.dealer, rand);
  if (handValue(t.player) === 21) finish(g, t, rand); // a natural settles at once
  return t;
}

export function hit(g, t, rand = Math.random) {
  if (!t || t.done) return t;
  draw(t.player, rand);
  if (handValue(t.player) >= 21) finish(g, t, rand);
  return t;
}

export function stand(g, t, rand = Math.random) {
  if (!t || t.done) return t;
  finish(g, t, rand);
  return t;
}

/** Double down: one more card, twice the stake. */
export function double(g, t, rand = Math.random) {
  if (!t || t.done || t.player.length !== 2) return t;
  if (!stake(g, t.bet)) return t;
  t.bet *= 2;
  draw(t.player, rand);
  finish(g, t, rand);
  return t;
}

function finish(g, t, rand) {
  const p = handValue(t.player);
  const natural = p === 21 && t.player.length === 2;
  if (p <= 21 && !natural) while (handValue(t.dealer) < 17) draw(t.dealer, rand);
  const d = handValue(t.dealer);
  const dNatural = d === 21 && t.dealer.length === 2;
  let payout = 0;
  if (p > 21) t.result = 'Bust.';
  else if (natural && !dNatural) { payout = t.bet * 2.5; t.result = 'Blackjack! Pays 3 to 2.'; }
  else if (d > 21) { payout = t.bet * 2; t.result = 'Dealer busts. You win.'; }
  else if (p > d) { payout = t.bet * 2; t.result = 'You win.'; }
  else if (p === d) { payout = t.bet; t.result = 'Push. Stake back.'; }
  else t.result = 'Dealer wins.';
  t.done = true;
  settle(g, t.bet, payout, 2);
}
