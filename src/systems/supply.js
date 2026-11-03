/**
 * ROX on the street: Mo as the supplier.
 *
 *   Connections   three men who will move ROX for him on consignment (Benchy and Squeak at the
 *                 Kestrel Houses, Dex on Kestrel Street). He fronts them rocks in person; every
 *                 morning each one texts how it went and sends his cut to Shale Pay. The market
 *                 drifts day to day. When it is going too well, a man sometimes decides the money
 *                 is his now: Mo can text a threat, lean on him in person, or find him and put him
 *                 on the ground, and the money (and whatever else is in his pockets) comes back.
 *   Fiends        the people who actually smoke it. Out on the block, in the park and on the
 *                 platform after dark, swaying, and they pay well. They scatter the second a
 *                 uniform or a red beret is in sight. By day they are asleep in the Houses
 *                 stairwells: no sale then, but pockets, like anyone asleep.
 * Everything here is the game's own fiction: no prices, methods or places from the real world.
 */
import { CONFIG } from '../core/config.js';
import { bump, logLine, pushMessage, addItem } from '../core/state.js';
import { money, dayOf, pick, minuteOfDay, clamp } from '../core/util.js';

export const DEALERS = {
  benchy: { name: 'Benchy', kind: 'benchman', area: 'projects', where: 'the bench at the Kestrel Houses', cut: 0.6 },
  squeak: { name: 'Squeak', kind: 'squeak', area: 'projects', where: 'the dice game at the Kestrel Houses', cut: 0.55 },
  dex: { name: 'Dex', kind: 'dex', area: 'street', where: 'his corner on Kestrel Street', cut: 0.5 },
};
const KIND_TO_DEALER = Object.fromEntries(Object.entries(DEALERS).map(([id, d]) => [d.kind, id]));

export function supplyState(s) {
  if (!s.supply) s.supply = { market: 1, dealers: {}, earned: 0, fiendDay: {} };
  return s.supply;
}
const dealer = (s, id) => {
  const sp = supplyState(s);
  if (!sp.dealers[id]) sp.dealers[id] = { stock: 0, owed: 0, stiff: false, sold: 0, paid: 0, on: false };
  return sp.dealers[id];
};
const roxHeld = (s) => (s.inventory || []).find((i) => i.id === 'rox' && i.qty > 0)?.qty || 0;
const takeRox = (s, n) => {
  const e = s.inventory.find((i) => i.id === 'rox');
  if (!e) return 0;
  const k = Math.min(n, e.qty);
  e.qty -= k;
  if (e.qty <= 0) s.inventory = s.inventory.filter((i) => i !== e);
  return k;
};
/** Has Mo ever had ROX in his hands? The connections do not talk to him before that. */
export const inTheGame = (s) => !!(s.counters?.roxCooked || roxHeld(s) || Object.values(supplyState(s).dealers).some((d) => d.on));
const perRock = (s, id) => Math.round(CONFIG.substances.types.rox.price * DEALERS[id].cut * supplyState(s).market);

/* ------------------------------------------------------------------ connections, in person */

export function dealerMenu(g, id) {
  const s = g.state;
  const D = DEALERS[id];
  const d = dealer(s, id);
  const held = roxHeld(s);
  const front = (n) => {
    const k = takeRox(s, n);
    if (!k) return;
    d.stock += k;
    d.on = true;
    g.advance(10);
    bump(s, 'risk', 2);
    logLine(g, `Fronted ${k} ROX to ${D.name}.`, 'bad');
    g.toast(pick([
      `${D.name} weighs the bag in his palm like a man guessing a watermelon. "${k}? Aight. I text you in the morning. Do not call me, I call you. I mean I text you."`,
      `"${k} of them." ${D.name} pockets it without looking at it, which is how you know he has done this before. "You gonna be happy, Mo. Or I am. One of us."`,
    ]), 'event');
  };
  const choices = [];
  if (!d.on) {
    choices.push(
      { label: 'Front him three ROX.', sub: held >= 3 ? `about ${money(perRock(s, id))} a rock back to you, depending` : `you have ${held}`, disabled: held < 3, effect: () => front(3) },
      { label: `Front him everything (${held}).`, disabled: held < 1, effect: () => front(held) },
      { label: 'Just looking.', effect: () => {} },
    );
  } else {
    if (d.stiff) {
      choices.push(
        { label: `Lean on him for the ${money(d.owed)}.`, sub: 'he pays, or he does not', effect: () => leanOn(g, id) },
      );
    } else if (d.owed > 0) {
      choices.push({ label: `Collect the ${money(d.owed)} he is holding.`, effect: () => { g.earnMoney(d.owed, `ROX from ${D.name}`); g.toast(`He counts it out twice. ${money(d.owed)}. "Business."`, 'good'); d.owed = 0; } });
    }
    choices.push(
      { label: 'Front him more.', sub: held ? `you have ${held}` : 'you have none', disabled: !held || d.stiff, effect: () => front(Math.min(held, 4)) },
      { label: 'Cut him off.', sub: d.stock ? `he still has ${d.stock}` : '', effect: () => cutOff(g, id) },
      { label: 'Nothing. Just checking in.', effect: () => {} },
    );
  }
  g.openModal({
    kicker: `${D.where.toUpperCase()} · THE CONNECT`, title: d.on ? `${D.name}, on Your Payroll` : `${D.name}, Maybe`,
    body: d.on
      ? `He is holding ${d.stock} of yours. ${d.stiff ? `He also owes you ${money(d.owed)} and has decided not to know that.` : d.owed ? `He has ${money(d.owed)} of yours on him.` : 'He is square with you, for now.'}\n\nThe market this week is ${marketWord(s)}.`
      : `"You the one with the rocks?" ${D.name} does not look at you while he says it; he looks up and down the block. "I move it, I keep a little, you get the rest on your Shale. Every morning I text you how it went. You don't come around here asking."`,
    choices,
  });
}

function marketWord(s) {
  const m = supplyState(s).market;
  return m > 1.5 ? 'insane' : m > 1.15 ? 'hot' : m > 0.85 ? 'steady' : m > 0.65 ? 'slow' : 'dead';
}

function leanOn(g, id) {
  const s = g.state;
  const D = DEALERS[id];
  const d = dealer(s, id);
  g.advance(10);
  // the bigger Mo is in their heads, the likelier they pay: his fights, his reputation
  const odds = 0.45 + Math.min(0.3, (s.counters?.kos || 0) * 0.02);
  if (Math.random() < odds) {
    g.earnMoney(d.owed, `ROX from ${D.name}`);
    g.toast(`You do not raise your voice. You just stand closer than people stand. ${D.name} finds ${money(d.owed)} he did not have a minute ago. "Was gonna bring it. Swear."`, 'good');
    d.owed = 0;
    d.stiff = false;
    bump(s, 'stress', 3);
    return;
  }
  bump(s, 'stress', 6);
  g.toast(`${D.name} laughs, and the laugh has his whole crew in it. "Then come get it." He means it. So could you.`, 'bad');
}

function cutOff(g, id) {
  const s = g.state;
  const D = DEALERS[id];
  const d = dealer(s, id);
  const back = Math.random() < 0.5 ? d.stock : 0;
  if (back) addItem(s, 'rox', back);
  g.toast(back ? `${D.name} hands back ${back} without a word. Professional, in his way.` : `"What rocks?" ${D.name} says, with a straight face. ${d.stock} gone. That is the tuition.`, back ? 'info' : 'bad');
  d.stock = 0;
  d.on = false;
  d.stiff = false;
}

/** game3d calls this when Mo knocks somebody out: a connection who stiffed him pays, with interest. */
export function onKnockout(g, kind) {
  const id = KIND_TO_DEALER[kind];
  if (!id) return null;
  const s = g.state;
  const d = supplyState(s).dealers[id];
  if (!d || !d.stiff || d.owed <= 0) return null;
  const cash = d.owed;
  g.earnMoney(cash, `ROX from ${DEALERS[id].name}, the hard way`);
  const extra = pick(['rox', 'rox', 'static', 'mud', 'watch']);
  addItem(s, extra, extra === 'rox' ? Math.max(1, Math.min(3, d.stock)) : 1);
  if (extra === 'rox') d.stock = Math.max(0, d.stock - 3);
  d.owed = 0;
  d.stiff = false;
  logLine(g, `Collected ${money(cash)} from ${DEALERS[id].name} by force.`, 'bad');
  return `${money(cash)} of yours, out of his sock, plus ${CONFIG.items[extra]?.name || extra} for the trouble. When he gets up he will text you good morning tomorrow like nothing happened. That is the deal now.`;
}

/* ------------------------------------------------------------------ every morning */

export function supplyNewDay(g, day) {
  const s = g.state;
  const sp = supplyState(s);
  sp.market = clamp(sp.market + (Math.random() - 0.5) * 0.55 + (1 - sp.market) * 0.15, 0.45, 1.95);
  for (const [id, D] of Object.entries(DEALERS)) {
    const d = sp.dealers[id];
    if (!d?.on) continue;
    // sometimes the corner gets raided, and the rocks are evidence now
    if (d.stock > 0 && Math.random() < 0.05) {
      pushMessage(g, { from: D.name.toUpperCase(), subject: 'yo', body: `got picked up last nite. they took everything. ${d.stock} gone. im good tho. dont text me for a few days\n\n(the cops do not know your name. probably.)`, kind: 'supply' });
      d.stock = 0;
      bump(s, 'risk', 4);
      continue;
    }
    if (d.stock <= 0 && !d.stiff) continue;
    const sold = Math.min(d.stock, Math.max(0, Math.round(Math.random() * 3 * sp.market + (sp.market > 1.3 ? 1 : 0) - 0.4)));
    const cash = sold * perRock(s, id);
    d.stock -= sold;
    d.sold += sold;
    if (d.stiff) {
      d.owed += cash;
      pushMessage(g, { from: D.name.toUpperCase(), subject: 'about that', body: pick([
        `cant talk rn. busy. ill hit u later`,
        `who dis`,
        `bro the money is coming. its in the mail. like real mail`,
      ]) + `\n\n(${D.name} owes you ${money(d.owed)}. He is at ${D.where}.)`,
      choices: [{ label: 'Threaten him.', supply: 'threat', opt: id }, { label: 'Let it ride.', supply: 'ride', opt: id }], kind: 'supply' });
      continue;
    }
    // too good a day, and a man starts to think the money is his
    if (cash >= 70 && (sp.market > 1.35 || Math.random() < 0.18) && Math.random() < 0.4) {
      d.stiff = true;
      d.owed += cash;
      pushMessage(g, { from: D.name.toUpperCase(), subject: 'ROX', body: `YO its going CRAZY out here. sold ${sold}. people asking for it by name. ROX ROX ROX\n\nbut listen. im gonna hold onto the bread for a minute. reinvest. u know how it is\n\n(${D.name} is holding ${money(d.owed)} of yours. He does not plan to give it back.)`,
        choices: [{ label: 'Threaten him.', supply: 'threat', opt: id }, { label: 'Let it ride.', supply: 'ride', opt: id }], kind: 'supply' });
      continue;
    }
    if (sold > 0) {
      g.earnMoney(cash, `ROX via ${D.name}`);
      sp.earned += cash;
      pushMessage(g, { from: D.name.toUpperCase(), subject: 'ROX', body: pick([
        `moved ${sold}. ${marketWord(s)} out here. sent u ${money(cash)} on shale`,
        `${sold} gone. one guy paid in quarters. sent u ${money(cash)}`,
        `${sold} sold. a lady asked if its gluten free. i said yes. ${money(cash)} on ur shale`,
      ]) + (d.stock ? `\n\n(he has ${d.stock} left)` : '\n\nim dry. bring more'), kind: 'supply' });
    } else {
      pushMessage(g, { from: D.name.toUpperCase(), subject: 'ROX', body: pick([
        'dead out here today. cops on the corner all day eating sandwiches. nothing moved',
        'slow. its raining and fiends dont like rain. nobody likes rain',
      ]) + `\n\n(he has ${d.stock} left)`, kind: 'supply' });
    }
  }
}

/** A text reply: a threat, or letting it go for now. */
export function reply(g, what, id) {
  const s = g.state;
  const D = DEALERS[id];
  const d = D && supplyState(s).dealers[id];
  if (!d || !d.stiff) { g.toast('That is already settled.', 'info'); return; }
  if (what === 'ride') { g.toast('You let it ride. It rides away from you.', 'info'); return; }
  if (Math.random() < 0.35) {
    g.earnMoney(d.owed, `ROX from ${D.name}`);
    g.toast(`A minute later: "ok ok relax." Shale Pay pings. ${money(d.owed)}.`, 'good');
    d.owed = 0;
    d.stiff = false;
    return;
  }
  g.toast(`"lol." He leaves you on read. He is at ${D.where}. You know what he looks like.`, 'bad');
}

/* ------------------------------------------------------------------ fiends */

const FIEND_SPOTS = {
  street: [[-4.9, -4.3, 0.4], [9.2, -4.5, -0.3], [26, -4.2, 2.6]],
  park: [[5.5, -4.5, -1.2], [-5.5, 4.5, 2.4], [2.5, -6.5, 0.2]],
  subway: [[-9.5, -2.9, 0.1], [18, -2.9, -0.2]],
};
const isNight = (s) => { const m = minuteOfDay(s.clock.m); return m >= 21 * 60 || m < 5 * 60; };
const isDay = (s) => { const m = minuteOfDay(s.clock.m); return m >= 7 * 60 && m < 19 * 60; };

/** Called while an area loads (before its people are made): fiends out by night, asleep by day. */
export function addFiends(g, areaId, area) {
  const s = g.state;
  if (FIEND_SPOTS[areaId] && isNight(s)) {
    const day = dayOf(s.clock.m);
    FIEND_SPOTS[areaId].forEach(([x, z, rot], i) => {
      if ((day * 7 + i * 3 + areaId.length) % 5 === 0) return; // not every spot, every night
      const id = `fiend_${areaId}_${i}`;
      area.npcs.push({ kind: i % 3 === 1 ? 'fiend_f' : 'fiend', x, z, rot, still: true, act: 'fiend', fiend: true, talk: id });
      area.interactables.push({ id, label: 'The fiend', sub: 'swaying · looking at your pockets', x, z, radius: 1.2, action: (gg) => fiendMenu(gg, id) });
    });
  }
  // by day the ones with nowhere to be are asleep in the Houses stairwells
  if (areaId === 'pjtower' && isDay(s)) {
    const f = s.houses?.floor || 0;
    if (f > 0 && f % 2 === 1) area.npcs.push({ kind: f % 4 === 1 ? 'fiend' : 'fiend_f', x: f % 4 === 1 ? 0.9 : -0.9, z: -2.7, rot: 1.4, still: true, pose: 'sleep', fiend: true });
  }
}

export function fiendMenu(g, id) {
  const s = g.state;
  const sp = supplyState(s);
  const today = dayOf(s.clock.m);
  const held = roxHeld(s);
  if (sp.fiendDay[id] === today) { g.toast(pick(['"You again! My favourite guy." He has nothing left to spend and he is fine with that.', 'She is somewhere else entirely, smiling at a streetlight. Business is done here.']), 'info'); return; }
  const price = 55 + Math.round(Math.random() * 30);
  const sell = (n) => {
    if (g.world?.copSees?.(14)) { g.toast('Not with a uniform right there. The fiend agrees, and is already walking away very casually, which is not casual at all.', 'bad'); return; }
    const k = takeRox(s, n);
    if (!k) return;
    sp.fiendDay[id] = today;
    g.earnMoney(price * k, 'ROX on the street');
    bump(s, 'risk', 3 * k);
    bump(s, 'morale', -2);
    s.counters.roxSold = (s.counters.roxSold || 0) + k;
    g.advance(5);
    logLine(g, `Sold ${k} ROX to a fiend for ${money(price * k)}.`, 'bad');
    g.toast(pick([
      `Crumpled bills, a handshake that goes on too long, and a "God bless you" you did not earn. ${money(price * k)}.`,
      `${money(price * k)} in fives and ones, warm from somebody's sock. The fiend thanks you like you saved a life. You did the other thing.`,
      `"ROX? The real ROX?" ${money(price * k)}. They walk off doing a little dance that is half joy and half something else.`,
    ]), 'event');
  };
  g.openModal({
    kicker: 'AFTER DARK · A FIEND', title: 'Somebody Who Needs Something',
    body: held
      ? `Thin, swaying, eyes everywhere. "You holding? I heard about the ROX. Everybody heard about the ROX." They have ${money(price)} a rock and they are not going to haggle; they are going to beg, which is worse.`
      : '"You holding?" You are not. The fiend looks at you like you are a vending machine that ate their dollar.',
    choices: [
      { label: 'Sell one ROX.', sub: `${money(price)}`, disabled: held < 1, effect: () => sell(1) },
      { label: 'Sell three.', sub: `${money(price * 3)}`, disabled: held < 3, effect: () => sell(3) },
      { label: 'Keep walking.', effect: () => {} },
    ],
  });
}
