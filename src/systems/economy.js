/** Money: bills, groceries, BidBay, relief programs. */
import { CONFIG } from '../core/config.js';
import { dayOf, rand, chance, pick, uid, money, clamp } from '../core/util.js';
import {
  addItem, removeItem, countItem, hasItem, earn, spend, logLine, pushMessage,
} from '../core/state.js';
import { bump } from '../core/state.js';

/* ------------------------------ bills ------------------------------ */

export function billInfo(g, key) {
  const s = g.state;
  const def = CONFIG.economy[key];
  if (!def) {
    // Fail soft: an unknown bill key must never take the whole UI down.
    console.error(`[economy] unknown bill key "${key}"`);
    return { key, name: key, base: 0, reached: -1, paidCycle: -1, owedCycles: 0, owed: 0, dueDay: 0, nextDueDay: 0, daysLeft: 0, overdue: false };
  }
  const st = s.bills[key] || (s.bills[key] = { paidCycle: -1, missed: 0, lastPaid: 0, remindedDay: 0 });
  const day = dayOf(s.clock.m);
  const first = def.firstDueDay;
  const period = def.periodDays;
  const reached = day < first ? -1 : Math.floor((day - first) / period);
  const owedCycles = Math.max(0, reached - st.paidCycle);
  const nextCycle = Math.max(0, reached + (owedCycles > 0 ? 0 : 1));
  const nextDueDay = first + nextCycle * period;
  return {
    key,
    name: def.name,
    base: def.amount,
    reached,
    paidCycle: st.paidCycle,
    owedCycles,
    owed: owedCycles * def.amount,
    dueDay: reached >= 0 ? first + reached * period : first,
    nextDueDay,
    daysLeft: Math.max(0, nextDueDay - day),
    overdue: owedCycles > 0,
  };
}

export function payBill(g, key) {
  const s = g.state;
  const info = billInfo(g, key);
  if (info.owedCycles <= 0) {
    g.toast(`${info.name}: already settled for this cycle.`, 'info');
    return false;
  }
  if (s.money < info.owed) {
    g.toast(`You need ${money(info.owed - s.money)} more for ${info.name}.`, 'bad');
    g.audio.sfx('deny');
    return false;
  }
  spend(g, info.owed, info.name);
  s.bills[key].paidCycle = info.reached;
  s.bills[key].missed = 0;
  g.audio.sfx('cash');
  logLine(g, `Paid ${info.name} (${money(info.owed)}).`, 'good');
  g.toast(`Paid ${info.name}. ${money(info.owed)} gone.`, 'good');
  if (key === 'rent' && s.flags.tutorial === 3) { s.flags.tutorial = 4; g.bus.emit('tutorial'); }
  if (key === 'rent' && s.flags.evictionNotice) {
    s.flags.evictionNotice = false;
    g.toast('The eviction notice comes down off the door. For now.', 'good');
  }
  if (key === 'power' && s.flags.powerCut) {
    s.flags.powerCut = false;
    g.toast('The lights come back on. The fridge sighs.', 'good');
  }
  g.bus.emit('bills');
  return true;
}

export function onNewDay(g, day, prevDay) {
  const s = g.state;
  s.events.today = 0;
  s.social.lastPost = s.social.lastPost || 0;

  for (const key of ['rent', 'power', 'phone']) {
    const info = billInfo(g, key);
    const st = s.bills[key];
    if (info.owedCycles > 0) {
      if (st.remindedDay !== day) {
        st.remindedDay = day;
        const def = CONFIG.economy[key];
        pushMessage(g, {
          from: key === 'rent' ? 'RAE VELL (LANDLORD)' : key === 'power' ? 'MUNICIPAL POWER' : 'SHALE MOBILE',
          subject: `${def.name} — ${info.owedCycles} cycle${info.owedCycles > 1 ? 's' : ''} past due`,
          body: `Amount outstanding: ${money(info.owed)}.\n\nThis is a courtesy reminder. The next one is not a courtesy.\n\n— Billing`,
        });
        g.toast(`${info.name} is ${money(info.owed)} overdue.`, 'bad');
        g.audio.sfx('alarm');
      }
      if (key === 'rent' && info.owedCycles >= CONFIG.economy.evictionAfterMissedCycles) {
        s.flags.evictionNotice = true;
      }
      if (key === 'power' && info.owedCycles >= CONFIG.economy.powerCutAfterMissedCycles) {
        s.flags.powerCut = true;
      }
    }
  }

  // CRP weekly credit / recertification
  if (s.crp.active) {
    const weeks = Math.floor((day - (s.crp.appliedDay || day)) / 7);
    if (weeks > (s.crp.paidWeeks || 0)) {
      s.crp.paidWeeks = weeks;
      s.crp.credit = clamp(s.crp.credit + CONFIG.economy.crp.weeklyCredit, 0, 400);
      pushMessage(g, {
        from: 'CIVIC RELIEF PROGRAM',
        subject: 'Food credit loaded',
        body: `${money(CONFIG.economy.crp.weeklyCredit)} has been added to your Pantry credit.\n\nRecertification required every 7 days. Missing it suspends the credit, not the hunger.`,
      });
      logLine(g, 'CRP food credit loaded.', 'good');
    }
    if (day - (s.crp.lastRecert || day) >= CONFIG.economy.crp.recertDays) {
      s.crp.suspended = true;
    }
  }

  // Phone service nag
  if (CONFIG.economy.phone && billInfo(g, 'phone').owedCycles > 0) {
    s.flags.phoneLate = true;
  } else {
    s.flags.phoneLate = false;
  }

  g.bus.emit('newday', day);
}

/* ------------------------------ food ------------------------------ */

export const GROCERY = ['ramen', 'beans', 'eggs', 'sandwich', 'bar', 'cereal'];

export function buyFood(g, itemId, qty = 1, useCredit = false) {
  const s = g.state;
  const def = CONFIG.items[itemId];
  if (!def || def.kind !== 'food') return false;
  const cost = def.price * qty;
  if (useCredit) {
    if (!s.crp.active) { g.toast('No relief credit on this account.', 'bad'); return false; }
    if (s.crp.suspended) { g.toast('Your CRP credit is suspended. Recertify first.', 'bad'); return false; }
    if (s.crp.credit < cost) { g.toast('Not enough food credit.', 'bad'); return false; }
    s.crp.credit = Math.round((s.crp.credit - cost) * 100) / 100;
  } else {
    if (s.money < cost) { g.toast('Not enough money.', 'bad'); g.audio.sfx('deny'); return false; }
    spend(g, cost, `Groceries — ${def.name}${qty > 1 ? ` x${qty}` : ''}`);
  }
  addItem(s, itemId, qty);
  logLine(g, `Bought ${def.name}${qty > 1 ? ` x${qty}` : ''}.`, 'info');
  g.audio.sfx('cash');
  g.toast(`+${qty} ${def.name}`, 'good');
  return true;
}

export function applyForCRP(g) {
  const s = g.state;
  const need = CONFIG.economy.crp.minDocRequired;
  const missing = need.filter((d) => !hasItem(s, d));
  if (missing.length) {
    g.toast(`Application refused — missing ${missing.map((m) => CONFIG.items[m].name).join(', ')}.`, 'bad');
    return false;
  }
  if (s.crp.applied) {
    g.toast('Already in the system. Recertify instead.', 'info');
    return false;
  }
  g.advance(CONFIG.economy.crp.recertMinutes);
  s.crp.applied = true;
  s.crp.active = true;
  s.crp.appliedDay = dayOf(s.clock.m);
  s.crp.lastRecert = dayOf(s.clock.m);
  s.crp.suspended = false;
  s.crp.credit = clamp(s.crp.credit + CONFIG.economy.crp.weeklyCredit, 0, 400);
  bump(s, 'stress', -8);
  logLine(g, 'Enrolled in the Civic Relief Program.', 'good');
  g.toast(`CRP approved. ${money(CONFIG.economy.crp.weeklyCredit)} food credit loaded.`, 'good');
  g.audio.sfx('confirm');
  pushMessage(g, {
    from: 'CIVIC RELIEF PROGRAM',
    subject: 'You are approved (provisionally)',
    body: 'Your household has been found eligible for food credit.\n\nRecertify every 7 days in the Pantry app. Bring your ID and lease. Bring patience. Bring a pen, because ours are all out.',
  });
  return true;
}

export function recertCRP(g) {
  const s = g.state;
  if (!s.crp.active) return false;
  const missing = CONFIG.economy.crp.minDocRequired.filter((d) => !hasItem(s, d));
  if (missing.length) { g.toast('Recertification refused — documents missing.', 'bad'); return false; }
  g.advance(CONFIG.economy.crp.recertMinutes);
  s.crp.lastRecert = dayOf(s.clock.m);
  s.crp.suspended = false;
  bump(s, 'stress', 4);
  g.toast('Recertified. The line was 40 minutes and nobody made eye contact.', 'good');
  g.audio.sfx('confirm');
  return true;
}

export function claimUtilityGrant(g) {
  const s = g.state;
  if (s.crp.utilityGrant) { g.toast('The emergency grant is a one-time thing.', 'info'); return false; }
  const info = billInfo(g, 'power');
  if (!info.overdue) { g.toast('Power is not overdue. The grant requires a shutoff notice.', 'info'); return false; }
  g.advance(60);
  s.crp.utilityGrant = true;
  s.bills.power.paidCycle = info.reached;
  s.flags.powerCut = false;
  g.toast('Emergency utility relief applied directly to the account.', 'good');
  logLine(g, 'Emergency utility grant received.', 'good');
  g.audio.sfx('confirm');
  return true;
}

/* ------------------------------ BidBay ------------------------------ */

export function listItem(g, itemId, price) {
  const s = g.state;
  const def = CONFIG.items[itemId];
  if (!def) return false;
  const entry = s.inventory.find((i) => i.id === itemId && i.qty > 0);
  if (!entry) { g.toast('You do not own that.', 'bad'); return false; }
  if (def.kind === 'doc') { g.toast('You cannot sell your documents. You need those.', 'bad'); return false; }
  price = Math.max(1, Math.round(price * 100) / 100);
  removeItem(s, itemId, 1);
  const window = CONFIG.bidbay.listingMinutes;
  s.listings.push({
    id: uid(),
    itemId,
    name: def.name,
    price,
    value: def.value || def.price || 1,
    listedAt: s.clock.m,
    resolveAt: s.clock.m + rand(window[0], window[1]),
  });
  logLine(g, `Listed ${def.name} on BidBay for ${money(price)}.`, 'info');
  g.toast(`Listed ${def.name} at ${money(price)}.`, 'good');
  g.audio.sfx('ui');
  return true;
}

export function cancelListing(g, id) {
  const s = g.state;
  const idx = s.listings.findIndex((l) => l.id === id);
  if (idx < 0) return false;
  const l = s.listings[idx];
  addItem(s, l.itemId, 1);
  s.listings.splice(idx, 1);
  g.toast('Listing pulled. The thing is yours again.', 'info');
  g.audio.sfx('ui-back');
  return true;
}

export function bidbayTick(g) {
  const s = g.state;
  const now = s.clock.m;
  for (const l of [...s.listings]) {
    if (now < l.resolveAt) continue;
    s.listings = s.listings.filter((x) => x !== l);
    const ratio = l.price / Math.max(1, l.value);
    let chanceToSell =
      ratio <= CONFIG.bidbay.undercutFactor ? 0.95 :
      ratio <= 1.0 ? 0.7 :
      ratio <= 1.15 ? 0.42 :
      ratio <= CONFIG.bidbay.greedyFactor ? 0.17 : 0.05;
    if (chance(chanceToSell)) {
      earn(g, l.price, `BidBay — ${l.name}`);
      s.counters.sales++;
      s.counters.unitsSold++;
      g.toast(`SOLD: ${l.name} for ${money(l.price)}.`, 'good');
      logLine(g, `Sold ${l.name} on BidBay.`, 'good');
      g.audio.sfx('cash');
      pushMessage(g, {
        from: 'BIDBAY',
        subject: `Your item sold — ${l.name}`,
        body: `Sold for ${money(l.price)}. Funds are available immediately, because we are not a bank and we do not want to be responsible for you.\n\nBuyer rating: ★★★☆☆ ("smells like a apartment")`,
      });
      if (s.flags.tutorial === 4) s.flags.tutorial = 5;
    } else {
      addItem(s, l.itemId, 1);
      g.toast(`${l.name} did not sell. Too greedy, or too niche.`, 'bad');
      logLine(g, `${l.name} did not sell at ${money(l.price)}.`, 'info');
      pushMessage(g, {
        from: 'BIDBAY',
        subject: `Listing expired — ${l.name}`,
        body: `No buyers at ${money(l.price)}.\n\nBidBay suggestion: price it like you need the money.\n\n(We know.)`,
      });
    }
    g.bus.emit('bidbay');
  }

  // deliveries
  for (const d of [...s.deliveries]) {
    if (now < d.at) continue;
    s.deliveries = s.deliveries.filter((x) => x !== d);
    if (d.kind === 'grab_bag') {
      const pool = ['jacket', 'console', 'watch', 'tools', 'tv', 'guitar'];
      const got = pick(pool);
      addItem(s, got, 1);
      g.toast(`Delivery: ${CONFIG.items[got].name}. Worth maybe ${money(CONFIG.items[got].value)}.`, 'good');
      logLine(g, `Grab bag arrived: ${CONFIG.items[got].name}.`, 'info');
    } else if (d.kind === 'substances') {
      for (const it of d.items) addItem(s, it.id, it.qty);
      g.toast('A delivery arrives in a bag that says "GROCERIES".', 'event');
      logLine(g, 'Courier delivery arrived.', 'info');
    }
    g.audio.sfx('door');
  }
}

export function buyGrabBag(g) {
  const s = g.state;
  const cost = CONFIG.items.grab_bag.price;
  if (!spend(g, cost, 'BidBay — Grab Bag')) { g.toast('Not enough money.', 'bad'); return false; }
  s.deliveries.push({ kind: 'grab_bag', at: s.clock.m + CONFIG.bidbay.deliveryMinutes, label: 'Grab Bag' });
  g.toast('Grab Bag purchased. Delivery in ~30 minutes.', 'good');
  g.audio.sfx('cash');
  return true;
}

export function orderDelivery(g, cart) {
  const s = g.state;
  let total = 0;
  for (const c of cart) total += (CONFIG.substances.types[c.id]?.price || 0) * c.qty;
  if (total <= 0) return false;
  if (!spend(g, total, 'Courier order')) { g.toast('Not enough money. Cash only, obviously.', 'bad'); return false; }
  s.deliveries.push({
    kind: 'substances',
    at: s.clock.m + 45 + Math.floor(rand(0, 45)),
    items: cart.map((c) => ({ id: c.id, qty: c.qty })),
    label: 'Courier',
  });
  g.toast(`Order placed — ${money(total)}. Courier is on the way.`, 'event');
  logLine(g, 'Placed a courier order.', 'bad');
  g.audio.sfx('cash');
  return true;
}

export function sellToDex(g, itemId) {
  const s = g.state;
  const def = CONFIG.items[itemId];
  if (!def || def.kind !== 'valuable') return false;
  if (!removeItem(s, itemId, 1)) return false;
  const offer = Math.round((def.value || 10) * 0.42);
  earn(g, offer, `Sold to Dex — ${def.name}`);
  s.counters.sales++;
  g.toast(`Dex takes ${def.name}. Hands you ${money(offer)}. No eye contact.`, 'good');
  g.audio.sfx('cash');
  return true;
}
