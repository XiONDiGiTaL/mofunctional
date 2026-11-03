/**
 * The Phone app's other half: calling people.
 *
 * Contacts are the people Mo knows (his mother, Nia, Dale, Kev, Rae, the women he has met, Rolo,
 * Dex) and the places that pick up (the clinic, the relief office, Miguel's and Habib's for
 * delivery, 911). Each call is a short conversation in the call screen, costs a few minutes, and
 * can do what the person could do in person: Nia can be asked over, Dale asked about the
 * schedule, the women asked out, Kev talked into a joint in the park. The keypad also takes any
 * number, and a few of them are worth dialling.
 */
import * as recovery from './recovery.js';
import * as owes from './owes.js';
import { CONFIG } from '../core/config.js';
import { money, pick, dayOf, minuteOfDay, hhmm } from '../core/util.js';
import { bump, pushMessage, logLine } from '../core/state.js';
import { sisterState, bond, bumpBond } from './sister.js';
import { partnerState, openDateMenu } from './romance.js';
import { shiftInfo, callOut, quitJob, applyForJob } from './jobs.js';
import { billInfo } from './economy.js';
import * as delivery from './delivery.js';
import { mailOrder, wardrobeState, CATALOG_SHIPPING } from './wardrobe.js';

const mins = (g, n) => g.advance(n);

/** Everybody with a number Mo has. `known(s)` decides who shows up in Contacts. */
export function contacts(s) {
  const rows = [
    { id: 'mom', name: 'Mom', kind: 'tenant_f', sub: 'she always picks up' },
    { id: 'nia', name: 'Nia', kind: 'nia', sub: 'your sister' },
    { id: 'kev', name: 'Kev', kind: 'kev', sub: 'coworker · always free' },
    { id: 'dale', name: 'Dale', kind: 'dale', sub: 'Quik-Stop #14' },
    { id: 'rae', name: 'Rae Vell', kind: 'rae', sub: 'landlord' },
  ];
  for (const id of Object.keys(CONFIG.partners || {})) {
    const p = partnerState(s, id);
    if (p.met && !p.blocked) rows.push({ id: `partner_${id}`, name: CONFIG.partners[id].name, kind: id, sub: p.girlfriend ? 'your girlfriend' : 'from the block' });
  }
  rows.push(
    { id: 'rolo', name: 'Rolo', kind: 'rolo', sub: 'texts only, apparently' },
    { id: 'dex', name: 'Dex', kind: 'dex', sub: 'the alley' },
    { id: 'miguel', name: "Miguel's Bodega", kind: 'miguel', sub: 'delivery · BEC · loosies' },
    { id: 'habib', name: "Habib's Corner", kind: 'habib', sub: 'delivery · chicken over rice' },
    ...(s.flags.jaysCatalog ? [{ id: 'jays', name: "Mr. Jay's Order Line", service: "MR. JAY'S", sub: 'catalog · next-morning delivery' }] : []),
    { id: 'clinic', name: 'Kestrel Clinic', service: 'KESTREL CLINIC', sub: 'appointments' },
    { id: 'relief', name: 'Civic Relief Program', service: 'CIVIC RELIEF PROGRAM', sub: 'book a recertification slot' },
    { id: 'fellowship', name: 'The Golden Fellowship', service: 'THE GOLDEN FELLOWSHIP', sub: 'Stewardship Office' },
    ...(s.recovery?.contact ? [{ id: 'dennis', name: 'Dennis', kind: 'newsman', sub: 'Tuesday group · any hour, mostly' }] : []),
    { id: '911', name: '911', service: '911', sub: 'police · they come, eventually' },
  );
  return rows;
}

/** Start a call to a contact id. The phone is closed by the caller; this opens the call screen. */
export function call(g, id) {
  const s = g.state;
  if (s.flags.phoneLate) { g.toast('Shale Mobile: outgoing calls are suspended until the bill is paid. Incoming calls are, too, out of spite.', 'bad'); return; }
  if (id.startsWith('partner_')) return callPartner(g, id.slice(8));
  const fn = CALLS[id];
  if (fn) fn(g); else noAnswer(g, id);
}

const screen = (g, who, body, choices) => g.openModal({ kicker: `CALLING · ${who.toUpperCase()}`, title: who, body, choices: [...choices] });
const hangUp = { label: 'Hang up.', sub: '', effect: () => {} };

function noAnswer(g, who) {
  mins(g, 1);
  screen(g, who, 'It rings, and rings, and goes to a voicemail that is just the sound of a room.', [hangUp]);
}

const MOM_LINES = [
  '"Are you eating? You sound thin. You can sound thin, I am your mother, I can hear it."',
  '"Your aunt asked about you. I said you are doing very well. Do not make me a liar on the phone."',
  '"I saw a man on the news who looked like you. It was not you. I checked. I check every time."',
  '"Your father would have liked to hear your voice. He never said so. That is how I know."',
  '"I made pernil. Some of it is yours. Nia is bringing it, so be home, and be nice to her."',
];

const CALLS = {
  mom(g) {
    const s = g.state;
    mins(g, 2);
    screen(g, 'Mom', `She picks up on the first ring, like she always does, like she has been sitting next to it.\n\n${pick(MOM_LINES)}`, [
      { label: 'Tell her you are fine.', sub: '10 min · she knows', effect: () => { mins(g, 10); bump(s, 'morale', 3); g.toast('"Fine." She lets it go, which is the most generous thing she does.', 'info'); } },
      { label: 'Tell her the truth.', sub: '25 min · +morale -stress', effect: () => { mins(g, 25); bump(s, 'morale', 9); bump(s, 'stress', -8); g.toast('She does not interrupt once. At the end she says "okay", and then "okay" again, softer, and then she asks if you have eaten.', 'good'); } },
      { label: 'Ask her for a little money.', sub: '$40 · you will pay her back', disabled: (s.owes || []).some((o) => !o.settled && o.who === 'mom'), effect: () => { mins(g, 10); g.earnMoney(40, 'Mom'); owes.addOwe(g, { who: 'mom', kind: 'cash', amount: 40, due: dayOf(s.clock.m) + 10 }); bump(s, 'morale', -2); g.toast('"Of course." She sends it before you finish asking. That is somehow the worst part.', 'info'); } },
      { label: 'Ask about home.', sub: '15 min', effect: () => { mins(g, 15); bump(s, 'morale', 4); g.toast(pick(['The neighbour\'s dog died. The neighbour got a new dog. It has the same name. Nobody is allowed to mention it.', 'The building got new mailboxes. Hers sticks. She has written to three people about it.', 'Church is the same. The pastor is the same. The coffee is worse.']), 'info'); } },
      hangUp,
    ]);
  },

  nia(g) {
    const s = g.state;
    const st = sisterState(s);
    const day = dayOf(s.clock.m);
    mins(g, 2);
    const warm = bond(s) >= CONFIG.sister.visitBond;
    const busy = st.status === 'coming' || st.status === 'here';
    screen(g, 'Nia', warm ? '"Hey. You called me. Who died." She is smiling, you can hear it.' : '"...hi." A pause long enough to park a car in. "What do you need."', [
      { label: 'Just talk.', sub: '15 min · +morale', effect: () => { mins(g, 15); bumpBond(s, 1); bump(s, 'morale', 5); g.toast('She tells you about her manager, her landlord and a pigeon that lives on her AC unit. You listen to all of it.', 'good'); } },
      {
        label: 'Ask her to come over.', sub: busy ? 'she is already coming' : warm ? 'she brings food' : 'she is not there yet with you',
        disabled: busy || !warm || (st.lastVisitDay && day - st.lastVisitDay < CONFIG.sister.cooldownDays),
        effect: () => {
          const tonight = minuteOfDay(s.clock.m) < CONFIG.sister.visit.fromHour * 60 - 30;
          st.status = 'coming';
          st.visitDay = tonight ? day : day + 1;
          st.ate = false;
          bump(s, 'morale', 5);
          pushMessage(g, { from: 'NIA', subject: 're', body: tonight ? '“tonight then. 6ish. i\'m bringing food and you are going to eat it in front of me.”' : '“tomorrow, like 6. i\'m bringing food. be home.”' });
          g.toast(`"${tonight ? 'Tonight' : 'Tomorrow'}. Six. Be home, and have a fork."`, 'good');
        },
      },
      hangUp,
    ]);
  },

  kev(g) {
    const s = g.state;
    const m = minuteOfDay(s.clock.m);
    mins(g, 1);
    screen(g, 'Kev', '"YO. Mo. Okay, okay, I have a theory, but first: what are you doing. Right now. Because I am doing nothing, aggressively."', [
      { label: 'Hang out in the park.', sub: m < 9 * 60 ? 'too early for Kev' : '2 h · a joint · the park', disabled: m < 9 * 60, effect: () => hangWithKev(g) },
      { label: 'Hear the theory.', sub: '20 min', effect: () => { mins(g, 20); bump(s, 'morale', 3); g.toast(pick(['The theory is that the freezer at work is a portal. The evidence is that things go in and do not come out the same. You cannot argue with it.', 'The theory is that pigeons are run by the city. He has a pigeon\'s name. He will not tell you how.', 'The theory is about Dale\'s mustache and the year 1994. It is weirdly convincing.']), 'info'); } },
      hangUp,
    ]);
  },

  dale(g) {
    const s = g.state;
    mins(g, 1);
    if (!s.job.employed) {
      screen(g, 'Dale', '"Quik-Stop, this is Dale." Then, when he hears it is you: "...Mo."', [
        { label: 'Ask for your job back.', sub: 'he will think about it', effect: () => applyForJob(g) },
        hangUp,
      ]);
      return;
    }
    const sh = shiftInfo(g);
    const sched = sh.today ? `"You are on today, ${String(Math.floor(sh.start / 60)).padStart(2, '0')}:00 to ${String(Math.floor(sh.end / 60)).padStart(2, '0')}:00.${sh.worked ? ' You already did it. Go home.' : ''}"` : '"You are not on today. You are on tomorrow, if tomorrow is a weekday, which I do not have time to check for you."';
    screen(g, 'Dale', `"Quik-Stop, this is Dale." He sounds like a man standing in a walk-in freezer, because he is.\n\n${sched}`, [
      { label: 'Call out today.', sub: 'it is a strike if you do it too often', disabled: !sh.today || sh.worked, effect: () => callOut(g) },
      { label: 'Quit.', sub: 'over the phone, like a coward', effect: () => quitJob(g) },
      hangUp,
    ]);
  },

  rae(g) {
    const s = g.state;
    const rent = billInfo(g, 'rent');
    mins(g, 2);
    screen(g, 'Rae Vell', `"Rae." Hammering in the background. Rae is always hammering something that is not yours.\n\nRent: ${rent.owedCycles > 0 ? `${rent.owedCycles} cycle${rent.owedCycles > 1 ? 's' : ''} behind.` : `due in ${rent.daysLeft} day${rent.daysLeft === 1 ? '' : 's'}.`}`, [
      { label: 'Complain about the shower.', sub: 'it has never worked', effect: () => { mins(g, 5); bump(s, 'stress', 2); g.toast('"I\'ll get right on that." He hangs up so fast the line clicks twice.', 'info'); } },
      { label: 'Complain about the radiator.', sub: 'it makes the noise', effect: () => { mins(g, 5); bump(s, 'stress', 2); g.toast('"I\'ll get right on that." You can hear him not writing it down.', 'info'); } },
      {
        label: 'Promise to pay Friday.', sub: '+stress · +relationship', disabled: s.flags.raePromiseDay === dayOf(s.clock.m),
        effect: () => { s.flags.raePromiseDay = dayOf(s.clock.m); bump(s, 'stress', 5); s.npc = s.npc || {}; s.npc.rae = (s.npc.rae || 0) + 1; g.toast('"Friday." He says it back to you like he is writing it on your forehead.', 'info'); },
      },
      hangUp,
    ]);
  },

  rolo(g) {
    mins(g, 1);
    screen(g, 'Rolo', 'It rings once and goes to a voicemail that says, in his voice, flat: "Do not call this number. Text, or use the app. Bye."', [hangUp]);
  },

  dex(g) {
    mins(g, 1);
    screen(g, 'Dex', 'He picks up and does not say hello. "I don\'t do phones. I\'m out at night. You know the spot." Click.', [hangUp]);
  },

  jays(g) {
    const s = g.state;
    mins(g, 3);
    const w = wardrobeState(s);
    const pending = new Set((w.orders || []).map((o) => o.id));
    const rows = (CONFIG.outfits || []).filter((o) => o.price > 0 && !w.owned.includes(o.id));
    screen(g, "Mr. Jay's", `"Jay's order line, this is Jay, I am also the order line." A pen clicks. "Page number and size. Shipping is ${money(CATALOG_SHIPPING)}, it comes tomorrow by ten, it goes in your closet. Your super has a key. Everybody's super has a key."`, [
      ...rows.map((o) => ({
        label: pending.has(o.id) ? `${o.name} (on its way)` : `Order the ${o.name}.`,
        sub: pending.has(o.id) ? 'arrives tomorrow 10:00' : `${money(o.price + CATALOG_SHIPPING)} with shipping${o.note ? ' · ' + o.note : ''}`,
        disabled: pending.has(o.id) || s.money < o.price + CATALOG_SHIPPING,
        effect: () => {
          const r = mailOrder(g, o.id);
          if (r.ok) g.toast(`"The ${o.name}. Good choice, I would wear it, I am wearing it." Tomorrow at ten, in the closet.`, 'good');
          else if (r.reason === 'short') g.toast(`"That is ${money(r.price)}. Call me back when it is ${money(r.price)}."`, 'bad');
        },
      })),
      ...(rows.length ? [] : [{ label: 'You already own everything in the book.', sub: 'Jay is moved', disabled: true, effect: () => {} }]),
      hangUp,
    ]);
  },

  dennis(g) { recovery.callSupport(g); },
  miguel(g) { deliveryCall(g, 'bodega'); },
  habib(g) { deliveryCall(g, 'habibs'); },

  clinic(g) {
    const s = g.state;
    mins(g, 4);
    screen(g, 'Kestrel Clinic', '"Kestrel Clinic, please hold." The hold music is a song you used to like. Then: "Thank you for holding. How can I help?"', [
      {
        label: 'Book an appointment for tomorrow.', sub: '10:00 · walk in, skip the wait', disabled: s.flags.clinicAppt === dayOf(s.clock.m) + 1,
        effect: () => {
          s.flags.clinicAppt = dayOf(s.clock.m) + 1;
          pushMessage(g, { from: 'KESTREL CLINIC', subject: 'Appointment', body: `Your appointment is tomorrow (day ${dayOf(s.clock.m) + 1}) at 10:00. Walk in through the front door on Kestrel Street and ask for ${'Nurse Okafor'}. If you cannot make it, do not call. Nobody calls.` });
          g.toast('"Ten o\'clock. Tomorrow. We will see you, or we will not." That is the most honest booking you have ever made.', 'good');
        },
      },
      { label: 'Ask what treatment costs.', sub: '', effect: () => g.toast(`"Walk-ins are free to check in. Treatment is ${money(CONFIG.clinic?.treatment?.cost ?? 60)}, or on the bill. We do not turn people away. We just bill them."`, 'info') },
      hangUp,
    ]);
  },

  relief(g) {
    const s = g.state;
    mins(g, 12);
    const day = dayOf(s.clock.m);
    const forDay = minuteOfDay(s.clock.m) < 15 * 60 ? day : day + 1;
    screen(g, 'Civic Relief Program', 'Eleven minutes of hold music and a recording that thanks you for your patience in two languages. Then a real person, tired, kind: "Relief office, how can I help?"', [
      {
        label: `Book a slot at window 3 ${forDay === day ? 'today' : 'tomorrow'}.`, sub: 'skip the line · ID and lease', disabled: s.flags.reliefAppt === forDay,
        effect: () => {
          s.flags.reliefAppt = forDay;
          pushMessage(g, { from: 'CIVIC RELIEF PROGRAM', subject: 'Your appointment', body: `Window 3, ${forDay === day ? 'today' : 'tomorrow'}, before 17:00. Fulton St, Downtown. Bring your ID and lease. Originals. With an appointment you go straight to the window, which the people in the chairs will have opinions about.` });
          g.toast('"You\'re booked. Window 3. Do not lose your ID between now and then. People do."', 'good');
        },
      },
      hangUp,
    ]);
  },

  fellowship(g) {
    mins(g, 2);
    screen(g, 'The Golden Fellowship', '"You have reached the Stewardship Office of the Golden Fellowship. Shepherd Addison is in prayer, in a meeting, or both. Your call is a blessing. Your tithe is a bigger one. Press one to give. There is no two."', [
      { label: 'Press one.', sub: 'opens the giving page', effect: () => g.openPhone?.('fellowship') },
      hangUp,
    ]);
  },

  '911'(g) {
    mins(g, 2);
    const area = g.world?.areaId;
    screen(g, '911', '"911, what is your emergency?" A woman who has heard every sentence ever spoken waits for yours.', [
      {
        label: 'Ask for a patrol here.', sub: 'a cop walks the area for a couple of minutes · he will look at you too',
        effect: () => {
          const ok = g.world?.callCops?.(g);
          g.toast(ok ? '"Officer\'s on the way. Stay where you are." Somewhere a siren starts and decides it is not worth it, and then a cruiser turns the corner anyway.' : `"We don't send cars ${area === 'apartment' ? 'for a radiator' : 'in there'}, sir." She hangs up on you, politely.`, ok ? 'info' : 'bad');
        },
      },
      { label: 'Hang up without saying anything.', sub: 'they call back', effect: () => { g.toast('The phone rings ten seconds later. "Sir, we got a call from this number." You say it was the cat. You do not have a cat, probably.', 'info'); } },
    ]);
  },
};

/** The women he has met: talk, or ask her out (the same planner as in person). */
function callPartner(g, id) {
  const s = g.state;
  const p = partnerState(s, id);
  const def = CONFIG.partners[id];
  mins(g, 2);
  const cold = p.heartbroken || p.affection < 15;
  screen(g, def.name, cold ? '"...what." She lets you hear her deciding whether to hang up.' : pick([`"Hey you." ${def.name} sounds like she is smiling at something that is not you, and then it is you.`, '"I was literally just about to text you. Literally. Okay, maybe not literally."', '"Make it quick, I\'m on the bus and a man is eating a whole chicken."']), [
    { label: 'Ask her out.', sub: 'the same plans as in person', disabled: cold, effect: () => openDateMenu(g, id) },
    { label: 'Just talk.', sub: '20 min · +affection', disabled: cold, effect: () => { mins(g, 20); p.affection = Math.min(100, p.affection + 3); bump(s, 'morale', 4); g.toast(`You and ${def.name} talk about nothing for twenty minutes, which is the whole point.`, 'good'); } },
    hangUp,
  ]);
}

/** Kev, a bench, a joint passed back and forth, and the walk home that you do not remember. */
export function hangWithKev(g) {
  const s = g.state;
  g.fadeOut(() => {
    g.goTo('park', null);
    g.fadeIn();
    g.world?.kevHang?.(g, () => {
      g.fadeOut(() => {
        g.advance(120);
        bump(s, 'stress', -18);
        bump(s, 'morale', 10);
        bump(s, 'hunger', -14);
        bump(s, 'energy', -6);
        s.high.level = Math.max(s.high.level, 22);
        s.high.until = Math.max(s.high.until || 0, s.clock.m + 90);
        logLine(g, 'Two hours in the park with Kev.', 'good');
        g.goTo('apartment', null);
        g.fadeIn();
        g.toast('You remember the bench, the joint, and Kev explaining the freezer theory with diagrams in the air. You do not remember the walk home. You are home, though.', 'good');
      }, 700);
    });
  }, 600);
}

/* ------------------------------------------------------------------ delivery */

function deliveryCall(g, shopId) {
  const s = g.state;
  const d = delivery.deliveryState(s);
  const who = shopId === 'habibs' ? "Habib's Corner" : "Miguel's Bodega";
  mins(g, 1);
  if (d.status !== 'none') {
    screen(g, who, `"Your order is ${d.status === 'enroute' ? 'on the way' : d.status === 'waiting' ? 'outside your building right now, my friend' : 'at your door'}. One at a time. Go get it."`, [hangUp]);
    return;
  }
  const m = minuteOfDay(s.clock.m);
  if (m < 7 * 60 || m > 23 * 60) { screen(g, who, 'It rings out. The sign in the window says closed, and the phone agrees with it.', [hangUp]); return; }
  orderBuilder(g, shopId, {});
}

function orderBuilder(g, shopId, cart) {
  const s = g.state;
  const shop = delivery.shopFor(shopId);
  const who = shopId === 'habibs' ? "Habib's Corner" : "Miguel's Bodega";
  const lines = Object.entries(cart).filter(([, q]) => q > 0);
  const total = delivery.orderTotal(shopId, cart);
  const fee = CONFIG.delivery?.fee ?? 3;
  screen(g, who, `${shopId === 'habibs' ? '"Habib\'s, yes, hello, what are we eating?"' : '"Yo, Miguel\'s. Talk to me."'}\n\n${lines.length ? `So far: ${lines.map(([id, q]) => `${CONFIG.items[id].name} x${q}`).join(', ')}.\nTotal ${money(total)} with the ${money(fee)} delivery.` : `Delivery is ${money(fee)} on top. Say what you want.`}`, [
    ...shop.stock.filter((x) => CONFIG.items[x.id]).map((x) => ({
      label: `+ ${CONFIG.items[x.id].name} · ${money(delivery.priceOf(shopId, x.id))}`, sub: cart[x.id] ? `x${cart[x.id]} so far` : x.note,
      disabled: (cart[x.id] || 0) >= 4,
      effect: () => orderBuilder(g, shopId, { ...cart, [x.id]: (cart[x.id] || 0) + 1 }),
    })),
    { label: 'Bring it. I will pay at the door.', sub: lines.length ? `${money(total)} · cash at the handoff · he waits an hour` : 'order something first', disabled: !lines.length,
      effect: () => delivery.placeOrder(g, shopId, cart, false) },
    { label: 'Leave it at the door. Pay now.', sub: lines.length ? `${money(total)} now · it sits outside 1120 until you get it` : 'order something first', disabled: !lines.length || s.money < total,
      effect: () => delivery.placeOrder(g, shopId, cart, true) },
    { label: 'Never mind.', sub: '', effect: () => {} },
  ]);
}

/* ------------------------------------------------------------------ the keypad */

const NUMBERS = {
  '911': (g) => CALLS['911'](g),
  '411': (g) => screen(g, '411', '"Information, what city?" You say Brooklyn. "Sir, everybody says Brooklyn." She waits for a better answer.', [hangUp]),
  '311': (g) => { g.advance(9); screen(g, '311', 'Nine minutes of menus later: "Your complaint about the hydrant has been logged as complaint number four million, eight hundred eighty-one thousand, two hundred and three. Thank you for keeping the city beautiful."', [hangUp]); },
  '8675309': (g) => screen(g, 'Jenny', 'A woman picks up, hears your breathing, and says "No. Not Jenny. Never Jenny. Stop calling." She has said this many, many times.', [hangUp]),
  '5550199': (g) => screen(g, 'MovieFoam', '"Hello, and welcome to MovieFoam! Showing tonight at the Loew\'s Kestrel: nothing, since 1994. Press one if you miss it. We all do."', [hangUp]),
  '5552368': (g) => screen(g, '555-2368', '"Who you gonna call? Not us. We are a dry cleaner. We get this every day."', [hangUp]),
  '18004653': (g) => { screen(g, 'Golden Prayer Line', '"You have reached the Golden Fellowship Prayer Line. Every prayer is heard. Gold-tier prayers are heard first. Stay on the line to upgrade."', [{ label: 'Stay on the line.', sub: '$3 · a prayer, upgraded', disabled: g.state.money < 3, effect: () => { g.spendMoney(3, 'Golden Prayer Line'); bump(g.state, 'stress', -3); g.toast('A recording of Addison prays for you, by name, mispronounced, for exactly forty seconds.', 'info'); } }, hangUp]); },
  '7770777': (g) => screen(g, 'Madame Oksana', '"Madame Oksana sees all. Madame Oksana sees you are calling from Brooklyn. It is $2.99 a minute. Madame Oksana also sees that you will pay it."', [{ label: 'Hear your future.', sub: '$3', disabled: g.state.money < 3, effect: () => { g.spendMoney(3, 'Madame Oksana'); g.toast(pick(['"A door will open. Do not walk through it. Or do. Madame Oksana is not your mother."', '"I see money. I see it leaving. I see it leaving faster."', '"A woman with a cat. Be kind to the cat. The woman, we will see."']), 'info'); } }, hangUp]),
  '5550120': (g) => screen(g, 'Mo', 'You call your own number. It is busy. It is always busy. That is the most accurate thing your phone has ever told you.', [hangUp]),
  '0': (g) => screen(g, 'Operator', '"Operator." A long, judging silence. "Sir, it is 1999, there is a phone book chained to every booth on Ashby."', [hangUp]),
};

/** Dial whatever was typed on the keypad. */
export function dialNumber(g, digits) {
  const n = String(digits).replace(/\D/g, '');
  if (!n) return;
  if (g.state.flags.phoneLate && n !== '911') { g.toast('Shale Mobile: outgoing calls are suspended until the bill is paid. Except 911. Even Shale Mobile has a lawyer.', 'bad'); return; }
  const fn = NUMBERS[n] || NUMBERS[n.replace(/^1/, '')];
  if (fn) { g.advance(1); fn(g); return; }
  g.advance(1);
  screen(g, n.length > 7 ? `(${n.slice(-10, -7)}) ${n.slice(-7, -4)}-${n.slice(-4)}` : n, pick([
    'Three rising tones. "The number you have dialed is not in service. Please check the number, and your life, and try again."',
    'A man answers, says "Gary?", hears that you are not Gary, and hangs up with real disappointment.',
    'A fax machine screams at you. You scream back. Neither of you wins.',
    'It rings forever. Somewhere a phone is ringing in an empty kitchen, and you feel bad for it.',
  ]), [hangUp]);
}

export { hhmm };

/** Kev's door, 2A in 1120: home in the evenings and on his days off, at the store otherwise. */
export function kevDoor(g) {
  const s = g.state;
  const m = minuteOfDay(s.clock.m);
  const wd = ((dayOf(s.clock.m) - 1) % 7) + 1;
  const atWork = wd <= 5 && m >= 9 * 60 && m < 17 * 60;
  g.advance(1);
  if (atWork || m < 8 * 60) { g.toast(atWork ? 'Nobody answers 2A. Kev is at the Quik-Stop, or he is supposed to be.' : 'A snore through the door like a truck in low gear. Kev is asleep.', 'info'); return; }
  g.openModal({
    kicker: '1120 KESTREL · 2A', title: 'Kev',
    body: 'Kev opens the door in a Mets jersey and one sock. Behind him: a TV, a beanbag that has seen things, and a tank with a turtle named Dale (not after Dale. Mostly after Dale).',
    choices: [
      { label: 'Come in for a beer and a game.', sub: '45 min · +morale -stress', effect: () => { g.advance(45); bump(s, 'morale', 7); bump(s, 'stress', -6); g.toast(pick(['The Mets lose in the ninth. Kev takes it personally. You take a second beer.', 'Kev explains his fantasy team for forty minutes. You understand none of it. It is the best part of your day.']), 'good'); } },
      { label: 'Hang out in the park.', sub: m < 9 * 60 ? 'too early for Kev' : '2 h · a joint · the park', disabled: m < 9 * 60, effect: () => hangWithKev(g) },
      { label: 'Just saying hi.', effect: () => g.toast('"Hi," Kev says, and then, "that is it? Okay. Respect."', 'info') },
    ],
  });
}
