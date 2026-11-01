/**
 * Txtr's brain: who is actually texting, and what it makes sense to say back.
 *
 * The old reply chips were four generic lines ("can we not do this right now") shown for every
 * message, including BidBay's automated listing notices. This module gives every sender a
 * category — a person, a sister, a girlfriend, an auction house, the landlord, the boss, the
 * clinic, the relief office, a bill — and a reply set that belongs to that category. It also
 * names the sender's identity so the UI can put the right face or the right business icon on the
 * thread (threads.js / apps.js read this instead of guessing).
 *
 * Everything here is headless: it returns data and small effects, never markup.
 */
import { CONFIG } from '../core/config.js';
import { money, dayOf, clamp } from '../core/util.js';
import { bump, pushMessage, logLine } from '../core/state.js';
import { billInfo, payBill, setAutopay } from './economy.js';
import * as rent from './rent.js';
import * as romance from './romance.js';
import * as clinic from './clinic.js';
import * as life from './life.js';
import { STRANGERS } from '../core/strangers.js';
import * as sister from './sister.js';
import * as health from './health.js';

/** Senders that are people, with the face the UI should draw. */
const PEOPLE = {
  NIA: { category: 'family', kind: 'nia', name: 'Nia' },
  MOM: { category: 'family', kind: 'nia', name: 'Mom' },
  KEV: { category: 'personal', kind: 'kev', name: 'Kev' },
  MIGUEL: { category: 'personal', kind: 'miguel', name: 'Miguel' },
  HABIB: { category: 'personal', kind: 'habib', name: 'Habib' },
  ADDISON: { category: 'personal', kind: 'addison', name: 'Addison' },
  'ADDISON OCTAVIUS': { category: 'personal', kind: 'addison', name: 'Addison Octavius' },
  DEX: { category: 'dealer', kind: 'dex', name: 'Dex' },
  ROLO: { category: 'dealer', kind: 'rolo', name: 'Rolo' },
  'RAE': { category: 'landlord', kind: 'rae', name: 'Rae Vell' },
  'RAE VELL': { category: 'landlord', kind: 'rae', name: 'Rae Vell' },
  'RAE VELL (LANDLORD)': { category: 'landlord', kind: 'rae', name: 'Rae Vell' },
  DALE: { category: 'employer', kind: 'dale', name: 'Dale' },
  'DALE (QUIK-STOP #14)': { category: 'employer', kind: 'dale', name: 'Dale' },
  STEPHANIE: { category: 'romantic', kind: 'stephanie', name: 'Stephanie', partner: 'stephanie' },
  MELANIE: { category: 'romantic', kind: 'melanie', name: 'Melanie', partner: 'melanie' },
  DIANA: { category: 'romantic', kind: 'diana', name: 'Diana', partner: 'diana' },
};

/** Companies, services and automated lines: they wear their own brand, not a face. */
const BUSINESS = {
  BIDBAY: { category: 'auction', service: 'BIDBAY', name: 'BidBay' },
  LANDLORDLY: { category: 'landlord', service: 'LANDLORDLY', name: 'Landlordly' },
  'CIVIC RELIEF PROGRAM': { category: 'marketplace', service: 'CIVIC RELIEF PROGRAM', name: 'Civic Relief Program' },
  GRUBHOPE: { category: 'marketplace', service: 'GRUBHOPE', name: 'GrubHope' },
  'KESTREL CLINIC': { category: 'clinic', service: 'KESTREL CLINIC', name: 'Kestrel Clinic' },
  'KINGS COUNTY BILLING': { category: 'clinic', service: 'KINGS COUNTY HOSPITAL', name: 'Kings County Billing' },
  'KINGS COUNTY HOSPITAL': { category: 'clinic', service: 'KINGS COUNTY HOSPITAL', name: 'Kings County Hospital' },
  'MUNICIPAL POWER': { category: 'bill', service: 'MUNICIPAL POWER', name: 'Municipal Power' },
  'SHALE MOBILE': { category: 'bill', service: 'SHALE MOBILE', name: 'Shale Mobile' },
  'SHALE PAY': { category: 'bill', service: 'SHALE PAY', name: 'Shale Pay' },
  'SHALE BANK': { category: 'bill', service: 'SHALE BANK', name: 'Shale Bank' },
  'THE GOLDEN FELLOWSHIP': { category: 'service', service: 'THE GOLDEN FELLOWSHIP', name: 'The Golden Fellowship' },
  'GOLDEN FELLOWSHIP': { category: 'service', service: 'THE GOLDEN FELLOWSHIP', name: 'The Golden Fellowship' },
  FEEDLOVE: { category: 'service', service: 'FEEDLOVE', name: 'FeedLove' },
  HAILMARY: { category: 'service', service: 'HAILMARY', name: 'HailMary' },
  LONELYFANS: { category: 'service', service: 'LONELYFANS', name: 'LonelyFans' },
  "AMAZIN'": { category: 'service', service: "AMAZIN'", name: "Amazin'" },
  'HECTOR': { category: 'personal', kind: 'tenant_m', name: 'Hector (super, 1104)' },
  'DEE': { category: 'personal', kind: 'tenant_f', name: "Dee (Wash & Fold)" },
};

const norm = (name = '') => String(name).toUpperCase().replace(/\(.*?\)/g, '').trim();

/** The identity behind a sender string: category, face kind, service brand, display name. */
export function identityFor(from) {
  const key = String(from || '').trim();
  if (PEOPLE[key]) return { from: key, ...PEOPLE[key] };
  const n = norm(key);
  if (PEOPLE[n]) return { from: key, ...PEOPLE[n] };
  if (BUSINESS[n]) return { from: key, ...BUSINESS[n] };
  // the FeedLove women who gave Mo their number: their own face, their own thread
  const w = STRANGERS.find((x) => x.name.toUpperCase() === n);
  if (w) return { from: key, category: 'personal', kind: w.id, name: w.name };
  // a raw phone number, or a name nobody saved
  return { from: key, category: 'unknown', kind: 'unknown', name: key || 'Unknown number' };
}

export const categoryOf = (from) => identityFor(from).category;

/* ------------------------------------------------------------------ replies */

const SETS = {
  family: [
    { act: 'talk', label: 'Talk properly for a while.' },
    { act: 'reassure', label: '“I’m fine. I’ll call Sunday.”' },
    { act: 'honest', label: 'Tell her the truth.' },
    { act: 'decline', label: 'Not right now.' },
  ],
  personal: [
    { act: 'chat', label: 'Yeah — what’s up?' },
    { act: 'joke', label: 'Say something stupid.' },
    { act: 'busy', label: 'Working. Call you later.' },
  ],
  romantic: [
    { act: 'sweet', label: 'Thinking about you.' },
    { act: 'date', label: 'Let me take you out.' },
    { act: 'busy', label: 'Not tonight — but soon.' },
  ],
  auction: [
    { act: 'sold', label: 'What sold?' },
    { act: 'lower', label: 'Price my listings lower.' },
    { act: 'pull', label: 'Pull my listings.' },
  ],
  dealer: [
    { act: 'order', label: 'Open the line.' },
    { act: 'where', label: 'Where are you at?' },
  ],
  landlord: [
    { act: 'pay', label: 'Pay the rent now.' },
    { act: 'maintenance', label: 'Something in the unit needs fixing.' },
    { act: 'promise', label: 'I need a few more days.' },
  ],
  employer: [
    { act: 'hours', label: 'Can I pick up extra hours?' },
    { act: 'schedule', label: 'What’s the schedule?' },
    { act: 'off', label: 'I need a day off.' },
  ],
  clinic: [
    { act: 'checkin', label: 'Checking in for today.' },
    { act: 'book', label: 'Book a treatment.' },
    { act: 'cost', label: 'What does it cost?' },
  ],
  marketplace: [
    { act: 'recert', label: 'Recertify my food credit.' },
    { act: 'docs', label: 'What do I need to bring?' },
    { act: 'stop', label: 'Stop the messages.' },
  ],
  bill: [
    { act: 'paybill', label: 'Pay this bill.' },
    { act: 'extension', label: 'I need an extension.' },
  ],
  service: [
    { act: 'open', label: 'Open the app.' },
    { act: 'stop', label: 'STOP' },
  ],
  unknown: [
    { act: 'who', label: 'Who is this?' },
    { act: 'wrong', label: 'Wrong number.' },
    { act: 'block', label: 'Do not text this again.' },
  ],
  // she ended it badly. These are the only two chips a heartbroken man actually has.
  heartbroken: [
    { act: 'beg', label: 'Please. Talk to me.' },
    { act: 'space', label: 'Give her space.' },
  ],
};

/**
 * Which app a service's "open" chip opens. It used to open the social feed for every one of
 * them, which is how a Fellowship text ended up in FeedLove.
 */
const APP_FOR = {
  BIDBAY: 'bidbay',
  FEEDLOVE: 'social',
  'THE GOLDEN FELLOWSHIP': 'fellowship',
  'GOLDEN FELLOWSHIP': 'fellowship',
  "AMAZIN'": 'shop',
  HAILMARY: 'ride',
  LONELYFANS: 'fans',
  'CIVIC RELIEF PROGRAM': 'pantry',
  GRUBHOPE: 'pantry',
  'KESTREL CLINIC': 'clinic',
  'KINGS COUNTY BILLING': 'bills',
  'SHALE PAY': 'bank',
  'SHALE BANK': 'bank',
  'SHALE MOBILE': 'bills',
  'MUNICIPAL POWER': 'bills',
  LANDLORDLY: 'bills',
};

/**
 * Replies that belong to this specific message rather than to the sender's category: a bill
 * notice gets bill chips, a Fellowship notice gets church chips, an AutoPay receipt gets the
 * switch that turns AutoPay off. This is what keeps Mo's side of a thread answering the text
 * that is actually on the screen.
 */
function contextFor(id, message) {
  const text = `${message?.subject || ''} ${message?.body || ''}`;
  const out = [];
  const add = (act, label) => { if (!out.some((o) => o.act === act)) out.push({ act, label }); };
  if (message?.kind === 'autopay' && /autopay/i.test(text)) add('autopayoff', 'Turn AutoPay off.');
  if (id.category === 'service' && /service|sunday|gather|prayer|pew|meeting|pledge/i.test(text)) {
    add('pray', 'When is the next service?');
    add('pledge', 'Ask about the pledge.');
  }
  if ((id.category === 'service' || id.category === 'bill') && /bill|due|outstanding|payment|balance/i.test(text)) {
    add('extension', 'I need a few more days.');
  }
  if (id.category === 'auction' && /expired|sold|watching|ended|relisted/i.test(text)) add('sold', 'What sold?');
  if (id.category === 'clinic' && /appointment|slots?|course|session/i.test(text)) add('book', 'Book a treatment.');
  return out;
}

/**
 * The chips for a message. A message that carries its own choices (an authored event opened as a
 * text) keeps them; everything else gets its category's set, filtered to what is possible right
 * now (no "pay the rent" when it is paid, no "book a treatment" when the clinic is closed).
 */
export function replyOptions(message, s) {
  if (message?.choices?.length) {
    return message.choices.map((c) => ({ act: null, label: c.label, effect: c.effect }));
  }
  const id = identityFor(message?.from);
  // the woman who gave him the clap: he knows, now, and he can say so
  const clapFrom = health.clapFrom(s);
  if (clapFrom && health.clapSymptomatic(s) && !health.healthState(s).clap.accused) {
    const w = STRANGERS.find((x) => x.id === clapFrom);
    if (w && identityFor(message?.from).name === w.name) {
      return [
        { act: 'accuse', label: 'You gave me the clap.', category: 'personal', sender: w.name },
        ...SETS.personal.map((o) => ({ ...o, category: 'personal', sender: w.name })),
      ];
    }
  }
  // Nia asking to come over: yes or no, once
  if (message?.kind === 'nia_visit') {
    if (sister.sisterState(s).status !== 'asked' || message.replies?.length) return [];
    return [
      { act: 'nia_yes', label: 'Yeah. Come by. I\'ll be home.', category: 'family', sender: id.name },
      { act: 'nia_no', label: 'Not this week.', category: 'family', sender: id.name },
    ];
  }
  // she ended it badly: begging or giving her space, nothing else
  if (id.partner && romance.isHeartbroken(s, id.partner)) {
    const blocked = romance.isBlocked(s, id.partner);
    return SETS.heartbroken.map((o) => ({
      ...o,
      label: o.act === 'beg' && blocked ? 'Beg her to unblock you.' : o.label,
      category: 'romantic', partner: id.partner, sender: id.name, blocked,
    }));
  }
  const base = SETS[id.category] || SETS.unknown;
  const extra = contextFor(id, message).filter((o) => !base.some((b) => b.act === o.act));
  return [...base, ...extra].filter((opt) => {
    if (id.category === 'landlord' && opt.act === 'pay') return billInfo({ state: s }, 'rent').owedCycles > 0;
    if (id.category === 'bill' && opt.act === 'paybill') {
      return ['power', 'phone'].some((k) => billInfo({ state: s }, k).owedCycles > 0);
    }
    if (id.category === 'marketplace' && opt.act === 'recert') return !!s.crp?.active;
    if (id.category === 'romantic' && opt.act === 'date') {
      return !!id.partner && romance.partnerState(s, id.partner)?.met;
    }
    return true;
  }).map((o) => ({ ...o, category: id.category, partner: id.partner || null, sender: id.name }));
}

/* ------------------------------------------------------------------ sending */

/**
 * Send option `index` of a message. Returns the text that went out, or null.
 * The reply is appended to the message (so the thread reads like a conversation), the message is
 * marked read, and the effect runs once.
 */
export function sendReply(g, message, index) {
  if (!message) return null;
  const options = replyOptions(message, g.state);
  const opt = options[index];
  if (!opt) return null;
  const day = dayOf(g.state.clock.m);
  const who = identityFor(message.from);
  // blocked: nothing leaves the phone, and the thread says so in the ugliest way it can
  if (who.partner && romance.isBlocked(g.state, who.partner)) {
    message.replies = message.replies || [];
    message.replies.push({ text: opt.label, day, failed: true });
    message.replies.push({ text: 'NOT DELIVERED', day, failed: true, system: true });
    message.read = true;
    g.audio?.sfx?.('deny');
    g.toast('*She blocked you dude, yikes..*', 'bad');
    logLine(g, `${who.name} did not receive that.`, 'bad');
    return opt.label;
  }
  message.replies = message.replies || [];
  message.replies.push({ text: opt.label, day });
  message.read = true;
  g.audio?.sfx?.('phone');
  if (opt.effect) {
    try { opt.effect(g, message); } catch (e) { console.error('[sms] reply effect', e); }
    return opt.label;
  }
  try { applyAct(g, message, opt); } catch (e) { console.error('[sms] reply', opt.act, e); }
  return opt.label;
}

function followUp(g, from, subject, body) {
  pushMessage(g, { from, subject, body });
}

function applyAct(g, message, opt) {
  const s = g.state;
  const id = identityFor(message.from);
  const name = id.name;
  const partnerId = id.partner || opt.partner;

  switch (opt.act) {
    /* ---- family ---- */
    case 'talk':
      g.advance(40);
      bump(s, 'morale', 10);
      bump(s, 'stress', -6);
      s.npc.nia = (s.npc.nia || 0) + 1;
      followUp(g, message.from, 'ok', '“Okay. That was nice. Mom says hi. I said you were asleep, which is technically a lie with good manners.”');
      return;
    case 'reassure':
      g.advance(6);
      bump(s, 'morale', 2);
      followUp(g, message.from, 'fine', '“Fine. You say fine like a door closing. But okay.”');
      return;
    case 'honest':
      g.advance(20);
      bump(s, 'morale', 6);
      bump(s, 'stress', -8);
      s.npc.nia = (s.npc.nia || 0) + 2;
      life.lifeState(s).counselor = true;
      followUp(g, message.from, 'thank you', '“That is the first true thing you have said to me in a year. I am not going to make it a whole thing. I love you. Eat something.”');
      return;
    case 'accuse':
      health.accuse(g);
      return;
    case 'nia_yes':
      sister.answerVisit(g, true);
      return;
    case 'nia_no':
      sister.answerVisit(g, false);
      return;
    case 'decline':
      bump(s, 'morale', -4);
      bump(s, 'stress', 3);
      if (id.name === 'Nia') sister.bumpBond(s, -1);
      followUp(g, message.from, 'ok', '“Alright. I am here. That is all I was going to say.”');
      return;

    /* ---- people he knows ---- */
    case 'chat': {
      g.advance(10);
      bump(s, 'morale', 5);
      const lines = {
        kev: '“so anyway the freezer is making the noise again. THE noise. i have a theory”',
        miguel: '“Come by. I got a BEC with your name on it. Do not tell Habib.”',
        habib: '“You are welcome here any time, my friend. Bring nothing. Eat something.”',
        addison: '“I am glad you wrote. Come Sunday. There is a seat with your shape in it.”',
      };
      followUp(g, message.from, 're', lines[id.kind] || '“ha. ok. later.”');
      return;
    }
    case 'joke':
      g.advance(5);
      bump(s, 'morale', 7);
      followUp(g, message.from, 'lol', '“That was terrible. I am going to think about it all day.”');
      return;
    case 'busy':
      g.advance(3);
      bump(s, 'morale', -1);
      return;

    /* ---- her ---- */
    case 'beg': {
      if (!partnerId) return;
      const res = romance.beg(g, partnerId);
      if (!res.ok) {
        g.toast(res.reason === 'blocked' ? '*She blocked you dude, yikes..*' : `${name} is not answering that today.`, 'bad');
        return;
      }
      if (res.outcome === 'meet') {
        pushMessage(g, { from: message.from, subject: '', body: res.line });
        g.toast(`${name} will see you. Once.`, 'good');
      } else if (res.outcome === 'blocked') {
        g.toast('*She blocked you dude, yikes..*', 'bad');
      } else {
        g.toast('Read. No reply. The typing bubble appears twice and gives up both times.', 'info');
      }
      return;
    }
    case 'space':
      g.advance(2);
      bump(s, 'morale', -2);
      if (partnerId) romance.partnerState(s, partnerId).mood = Math.min(100, (romance.partnerState(s, partnerId).mood ?? 50) + 2);
      return;
    case 'sweet':
      if (partnerId && romance.partnerState(s, partnerId).met) {
        const st = romance.partnerState(s, partnerId);
        const gain = Math.round(2 + (1 - CONFIG.partners[partnerId].difficulty) * 3);
        st.affection = clamp(st.affection + gain);
        st.lastTalkDay = dayOf(s.clock.m);
        bump(s, 'morale', 6);
        followUp(g, message.from, 're', pickLine(partnerId, [
          '“You are being nice. Suspicious. Continue.”',
          '“I was just thinking about you. Do not tell anyone I said that.”',
          '“Come over later. Bring nothing. Do not bring the rent up.”',
        ]));
        logLine(g, `${name} liked that.`, 'good');
      }
      return;
    case 'date':
      bump(s, 'morale', 3);
      g.toast('Open the dating app to plan the date properly.', 'info');
      if (g.openPhone) g.openPhone('dates');
      return;
    case 'busy':
      bump(s, 'morale', 1);
      if (partnerId) {
        const st = romance.partnerState(s, partnerId);
        st.affection = clamp(st.affection - 1);
      }
      followUp(g, message.from, 'k', '“Alright. Do not disappear.”');
      return;

    /* ---- BidBay ---- */
    case 'sold':
      g.advance(5);
      if (g.openPhone) g.openPhone('bidbay');
      g.toast('BidBay: active listings are on the app.', 'info');
      return;
    case 'lower':
      g.advance(5);
      {
        const listings = s.listings || [];
        for (const l of listings) l.price = Math.max(1, Math.round(l.price * 0.9));
      }
      followUp(g, 'BIDBAY', 'Listings repriced', 'We lowered every active listing by 10%.\n\nThis is the only customer service we offer, and we only offer it because you asked politely.');
      return;
    case 'pull':
      g.advance(5);
      if (g.openPhone) g.openPhone('bidbay');
      g.toast('Pull a listing from the BidBay app.', 'info');
      return;

    /* ---- Rolo ---- */
    case 'order':
      g.advance(3);
      if (g.openPhone) g.openPhone('dealer');
      return;
    case 'where':
      g.advance(3);
      if (g.openPhone) g.openPhone('dealer');
      return;

    /* ---- landlord ---- */
    case 'pay': {
      const res = rent.payRent(g, { ahead: false });
      if (!res.ok) followUp(g, message.from, 'Rent', `No payment came through. The amount outstanding is ${money(billInfo(g, 'rent').owed)}.`);
      else followUp(g, message.from, 'Received', `Payment received. ${money(res.paid)}. See, that was not so painful.`);
      return;
    }
    case 'maintenance':
      g.advance(12);
      bump(s, 'morale', 2);
      followUp(g, message.from, 'Maintenance', 'I will send my nephew. He is fourteen and better at this than the contractor. Do not pay him, he will take it.');
      return;
    case 'promise':
      g.advance(6);
      bump(s, 'stress', 6);
      s.npc.rae = (s.npc.rae || 0) - 0;
      followUp(g, message.from, 'Alright', 'A few days. I wrote it on the clipboard. The clipboard is nearly full with you.');
      return;

    /* ---- employer ---- */
    case 'hours':
      g.advance(10);
      followUp(g, message.from, 'Hours', s.job.employed ? 'Maybe Thursday. Ask me Thursday. Bring the vest.' : 'You do not work here. Come by and we will talk.');
      return;
    case 'schedule': {
      g.advance(5);
      const info = billInfo(g, 'rent');
      followUp(g, message.from, 'Schedule', `Shift is 09:00–17:00, Mon–Fri. You are on it. Rent is due Day ${info.nextDueDay}, which is not my department but Dale has noticed.`);
      return;
    }
    case 'off':
      g.advance(8);
      followUp(g, message.from, 'Day off', 'Text me the day before next time. I covered your shift once already this month.');
      return;

    /* ---- clinic ---- */
    case 'checkin':
      g.advance(2);
      if (!clinic.checkIn(g)) g.toast('The clinic line says you already checked in today.', 'info');
      return;
    case 'book':
      g.advance(5);
      followUp(g, message.from, 'Appointment', `${clinic.nurseName} has a slot. Walk in through the front door on Kestrel and talk to her. It costs ${money(CONFIG.clinic.treatment.cost)}; if you cannot pay, it goes on the bill.`);
      g.toast('Walk to the clinic on Kestrel Street and speak to the nurse.', 'info');
      return;
    case 'cost':
      g.advance(2);
      followUp(g, message.from, 'What it costs', `A treatment is ${money(CONFIG.clinic.treatment.cost)} and about ${CONFIG.clinic.treatment.minutes} minutes. The daily check-in is free. You cannot afford neither, which is why we keep saying it.`);
      return;

    /* ---- Civic Relief ---- */
    case 'recert':
      g.advance(CONFIG.economy.crp.recertMinutes);
      g.toast('Recertification done at the office. Bring your ID next time for real.', 'good');
      return;
    case 'docs':
      g.advance(3);
      followUp(g, message.from, 'Required documents', 'State ID and your lease for Unit 3B. Originals. The photocopier is broken and has been for eleven years.');
      return;
    case 'stop': {
      // the sender answers, not BidBay. This used to say "BidBay" to the Fellowship.
      g.advance(2);
      const brand = identityFor(message.from).name;
      followUp(g, message.from, 'Unsubscribed (mostly)', `You have been taken off ${brand}'s marketing list.\n\nYou will still receive transactional messages, because those are not marketing, they are consequences.`);
      g.toast(`${brand}: STOP received. They will be in touch anyway.`, 'info');
      return;
    }

    /* ---- bills ---- */
    case 'paybill': {
      const key = ['power', 'phone'].find((k) => billInfo(g, k).owedCycles > 0);
      if (key) payBill(g, key);
      else g.toast('Nothing is overdue. This is a rare sentence.', 'good');
      return;
    }
    case 'extension':
      g.advance(10);
      bump(s, 'stress', 4);
      followUp(g, message.from, 'Extension requested', 'A payment arrangement has been noted on your account. It will not stop the notice. It is a nice note.');
      return;

    /* ---- services ---- */
    case 'open':
      g.advance(2);
      if (g.openPhone) g.openPhone(APP_FOR[norm(message.from)] || 'home');
      return;
    case 'pray':
      g.advance(4);
      followUp(g, message.from, 'Service times', 'Sunday at 10:00 and Wednesday at 19:00. The Wednesday one is smaller and the coffee is better. Nobody has ever said that out loud in the hall.');
      return;
    case 'pledge':
      g.advance(4);
      followUp(g, message.from, 'The pledge', 'It is not a contract. It is a promise, written down, which is a contract with better lighting.\n\nYou can come and read it any time. You can also come and not read it.');
      return;
    case 'autopayoff':
      g.advance(2);
      if (s.autopay?.on) setAutopay(g, false);
      followUp(g, message.from, 'AutoPay off', 'AutoPay is off. Every bill is yours again, personally, one at a time, at the worst possible moment.');
      return;

    /* ---- unknown ---- */
    case 'who':
      g.advance(3);
      followUp(g, message.from, 'read 3:41 PM', 'This number is no longer in service.');
      return;
    case 'wrong':
      g.advance(2);
      bump(s, 'stress', 2);
      return;
    case 'block':
      g.advance(2);
      bump(s, 'morale', 1);
      g.toast('Blocked. The phone is quieter by exactly one unknown number.', 'good');
      return;
    default:
      g.advance(3);
      bump(s, 'morale', 1);
  }
}

const pickLine = (id, lines) => lines[Math.floor(Math.random() * lines.length)];

/** Convenience: what a fresh, absurdly polite automated line should look like. */
export function senderLabel(from) {
  const id = identityFor(from);
  return id.name || from;
}
