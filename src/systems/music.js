/**
 * The scrappy music route: a notebook, a cheap mic, a recording made between the neighbours'
 * noises, ten burned CDs, an open mic at Lucia's on Thursday, and whatever comes of it. The
 * rewards stay small and real: twenty dollars, a contact, confidence, a dozen people who remember
 * his name. And sometimes the good thing is at three in the afternoon on a shift day.
 *
 *   s.music = { verses, songs, gear: { mic, tape }, demo: 0..10, cds, sold, fans, gigs, contacts,
 *               offer: { day, from, to } | null }
 */
import { bump, logLine, pushMessage } from '../core/state.js';
import { money, pick, dayOf, minuteOfDay } from '../core/util.js';

export function musicState(s) {
  if (!s.music) s.music = { verses: 0, songs: 0, gear: {}, demo: 0, cds: 0, sold: 0, fans: 0, gigs: 0, contacts: 0, offer: null };
  return s.music;
}

const OPEN_MIC = { weekday: 4, from: 20 * 60, to: 23 * 60 }; // Thursday night at Lucia's
export const openMicNow = (s) => ((dayOf(s.clock.m) - 1) % 7) + 1 === OPEN_MIC.weekday && minuteOfDay(s.clock.m) >= OPEN_MIC.from && minuteOfDay(s.clock.m) < OPEN_MIC.to;

/** The notebook and the mic, at home. */
export function musicMenu(g) {
  const s = g.state;
  const m = musicState(s);
  const hasMic = m.gear.mic || m.gear.tape;
  g.openModal({
    kicker: 'UNIT 3B · THE NOTEBOOK', title: 'Something Of Your Own',
    body: `A spiral notebook with a Quik-Stop receipt for a bookmark. ${m.songs ? `${m.songs} finished song${m.songs === 1 ? '' : 's'}` : 'No finished songs yet'}${m.verses % 3 ? `, and ${m.verses % 3} verse${m.verses % 3 === 1 ? '' : 's'} toward the next` : ''}.${m.demo ? `\n\nThe demo: ${m.demo}/10. ${m.cds ? `${m.cds} CDs in a shoebox.` : 'No CDs yet.'}` : ''}${m.fans ? `\n\n${m.fans} people know your name now. Some of them say it right.` : ''}\n\nOpen mic: Thursdays at Lucia's, 20:00.`,
    choices: [
      { label: 'Write.', sub: '1 h · energy · three verses make a song', effect: () => write(g) },
      { label: 'Borrow Kev\'s four-track and his beat tape.', sub: 'free · Kev will want it back', disabled: !!m.gear.tape, effect: () => { m.gear.tape = true; g.toast('Kev hands over a four-track with a cracked lid and a tape labelled BEATZ (DO NOT TAPE OVER). "If you tape over it I will know."', 'good'); } },
      { label: 'Buy a cheap mic.', sub: `${money(15)} · from the pawn shop window`, disabled: !!m.gear.mic || s.money < 15, effect: () => { g.spendMoney(15, 'a cheap microphone'); m.gear.mic = true; g.toast('A mic from Ashby Pawn that somebody once loved. It hums when it is near the fridge. Everything does.', 'good'); } },
      { label: 'Record.', sub: !hasMic ? 'you need a mic or a four-track' : !m.songs ? 'write a song first' : 'between the neighbours', disabled: !hasMic || !m.songs, effect: () => setTimeout(() => record(g), 60) },
      { label: 'Burn ten demo CDs.', sub: !m.demo ? 'record something first' : `${money(12)} · blanks and sleeves`, disabled: !m.demo || s.money < 12, effect: () => { g.spendMoney(12, 'blank CDs'); g.advance(60); m.cds += 10; g.toast('Ten CDs, burned one at a time, Sharpie on the front: MO. Just MO. You thought about it for an hour.', 'good'); } },
      { label: 'Close the notebook.', effect: () => {} },
    ],
  });
}

function write(g) {
  const s = g.state;
  const m = musicState(s);
  g.advance(60);
  bump(s, 'energy', -6);
  bump(s, 'stress', -4);
  m.verses += 1;
  if (m.verses % 3 === 0) {
    m.songs += 1;
    bump(s, 'morale', 8);
    logLine(g, `Finished a song. That is ${m.songs}.`, 'good');
    g.toast(pick(['A song. A whole one, with a hook that keeps coming back while you brush your teeth.', 'You read it out loud to the radiator. The radiator does not knock once. That is a yes.']), 'good');
  } else g.toast(pick(['A verse about the B44 at 6 a.m. It is better than it has any right to be.', 'Sixteen bars, eleven of them good. You keep the eleven.', 'A line about the bodega cat that you will either keep forever or burn.']), 'info');
}

/** Recording: three takes, each interrupted by the building in its own way. */
const NOISES = [
  { t: 'Upstairs, the vacuum starts. It is 26 minutes before it stops, every day. You have 26 minutes after that.', a: ['Wait it out.', 'wait', 1], b: ['Record over it. It is texture.', 'over', -1] },
  { t: 'The radiator knocks, twice, in time. Almost in time.', a: ['Keep it. Percussion.', 'keep', 1], b: ['Stop and start again.', 'again', 0] },
  { t: 'A siren goes past, long and wavering, right at the hook.', a: ['Sing over it, louder.', 'louder', 0], b: ['Let it pass, take it again.', 'again', 1] },
  { t: 'Rae is hammering something in the hall. He is not fixing anything. He is just hammering.', a: ['Bang on the wall.', 'bang', -1], b: ['Record in the closet, between the coats.', 'closet', 1] },
  { t: 'The neighbour’s baby starts crying, then stops, then starts again, in the exact key of your song.', a: ['Wait for the nap.', 'wait', 1], b: ['Keep going. The baby is a feature now.', 'keep', 0] },
];

function record(g) {
  const s = g.state;
  const m = musicState(s);
  const takes = [...NOISES].sort(() => Math.random() - 0.5).slice(0, 3);
  let q = 3 + Math.min(3, m.songs) + (m.gear.mic && m.gear.tape ? 1 : 0);
  const step = (i) => {
    if (i >= takes.length) {
      g.advance(30);
      const demo = Math.max(1, Math.min(10, q + Math.floor(Math.random() * 2)));
      m.demo = Math.max(m.demo, demo);
      bump(s, 'morale', 6);
      logLine(g, `Recorded a demo: ${demo}/10.`, 'good');
      g.toast(`Done. You play it back on the four-track. It sounds like a man in an apartment, which is what it is, and that is the good part. Demo: ${demo}/10.`, 'good');
      return;
    }
    const n = takes[i];
    g.advance(25);
    g.openModal({
      kicker: `RECORDING · TAKE ${i + 1} OF 3`, title: 'The Building Joins In', body: n.t,
      choices: [n.a, n.b].map(([label, , dq]) => ({ label, effect: () => { q += dq; if (dq > 0) g.advance(15); setTimeout(() => step(i + 1), 60); } })),
    });
  };
  step(0);
}

/* ------------------------------------------------------------------ music as income */

/** Saturday, 20:45 to 22:30, when there is a booking for today. */
export const gigNow = (s) => {
  const b = musicState(s).booking;
  const mm = minuteOfDay(s.clock.m);
  return !!(b && b.day === dayOf(s.clock.m) && mm >= 20.75 * 60 && mm < 22.5 * 60);
};

/** The paid set at Lucia's: the fee, the jar, the CDs on the table by the door. */
export function playGig(g) {
  const s = g.state;
  const m = musicState(s);
  const b = m.booking;
  if (!gigNow(s)) return;
  g.advance(90);
  const nerves = s.stats.stress > 75 ? -2 : s.high.level > 30 ? -1 : 0;
  const score = Math.min(10, Math.max(1, Math.round((m.demo || 3) * 0.5 + Math.min(4, m.songs) + Math.min(3, m.gigs) + nerves + Math.random() * 3)));
  const tips = Math.round(score * (2 + Math.random() * 2));
  const sold = Math.min(m.cds, Math.round(score / 2 + Math.random() * 3));
  m.cds -= sold;
  m.sold += sold;
  const fans = Math.round(score * 1.6 + Math.random() * 4);
  m.fans += fans;
  m.paidGigs = (m.paidGigs || 0) + 1;
  m.gigs += 1;
  g.earnMoney(b.pay + tips + sold * 3, 'paid set at Lucia\'s');
  bump(s, 'morale', 12 + Math.floor(score / 2));
  bump(s, 'stress', -8);
  bump(s, 'energy', -10);
  logLine(g, `Played a paid set at Lucia's: ${money(b.pay + tips + sold * 3)}.`, 'good');
  m.booking = null;
  // play well, keep the slot: every other Saturday, booked by itself
  if (score >= 6 && m.fans >= 20) {
    m.booking = { day: dayOf(s.clock.m) + 14, pay: Math.min(140, b.pay + 10) };
    pushMessage(g, { from: 'ASHBY SOUND', subject: 'again', body: `Sal wants you every other Saturday. ${'$'}${m.booking.pay} now. Do not let it go to your head, it is a restaurant.` });
  }
  g.openModal({
    kicker: "LUCIA'S · SATURDAY LATE SET", title: score >= 7 ? 'A Room That Came For You' : 'Forty Minutes, Paid',
    body: `${score >= 7 ? 'Half the tables are people who came because of Thursday. They know the hook. They sing the hook. Sal turns the espresso machine off for the slow one, which he has never done for anyone.' : 'A Saturday crowd that came for the veal and stayed for you, mostly. The jar fills slower than the room does, but it fills.'}

The fee: ${money(b.pay)} · the jar: ${money(tips)}${sold ? ` · ${sold} CD${sold === 1 ? '' : 's'}` : ''}. ${fans} more people know your name.`,
    choices: [{ label: 'Count it twice on the walk home.', effect: () => {} }],
  });
}

/** The K platform: busking. Rush hour pays; three in the morning pays in experience. */
export function busk(g) {
  const s = g.state;
  const m = musicState(s);
  if (!m.songs) { g.toast('You need at least one song of your own to stand there with. Write one: the notebook, at home.', 'info'); return; }
  const day = dayOf(s.clock.m);
  m.busked = m.busked?.day === day ? m.busked : { day, n: 0 };
  if (m.busked.n >= 2) { g.toast('Your voice is a rumour by now. Tomorrow.', 'info'); return; }
  if (s.stats.energy < 12) { g.toast('Too tired to sing over a train.', 'bad'); return; }
  m.busked.n += 1;
  const mm = minuteOfDay(s.clock.m) / 60;
  const rush = (mm >= 7 && mm < 9.5) || (mm >= 17 && mm < 19.5);
  const dead = mm >= 23 || mm < 6;
  const guitar = (s.inventory || []).some((i) => i.id === 'guitar' && i.qty > 0);
  g.advance(60);
  bump(s, 'energy', -8);
  bump(s, 'stress', -4);
  let take = (2 + Math.min(5, m.songs) * 1.2 + (m.demo || 0) * 0.6 + Math.min(10, m.fans / 5) + (guitar ? 4 : 0)) * (rush ? 1.7 : dead ? 0.35 : 1) * (0.6 + Math.random() * 0.9);
  const movedOn = Math.random() < 0.15;
  if (movedOn) take *= 0.4;
  take = Math.round(take * 100) / 100;
  const sold = m.cds ? Math.min(m.cds, Math.floor(Math.random() * (rush ? 3 : 2))) : 0;
  m.cds -= sold;
  m.sold += sold;
  m.busks = (m.busks || 0) + 1;
  if (take + sold * 3 > 0) g.earnMoney(take + sold * 3, 'busking on the K platform');
  if (Math.random() < 0.4) m.fans += 1;
  bump(s, 'morale', take > 12 ? 7 : 3);
  logLine(g, `Busked on the platform: ${money(take + sold * 3)}.`, 'good');
  g.toast(movedOn
    ? `Twenty minutes in, a transit cop with a clipboard says you need a permit you have never heard of. ${money(take)} in the hat and you are moved along to the stairs.`
    : rush
      ? `Rush hour: a river of people who cannot stop, and some of them throw something in anyway. ${money(take)}${sold ? ` and ${sold} CD${sold === 1 ? '' : 's'}` : ''}. A kid films you. You will never see it.`
      : dead
        ? `Three people, two of them asleep. One gives you a dollar and some advice. ${money(take)}.`
        : `An hour between trains with ${guitar ? 'the guitar' : 'your voice and the tiles'}. ${money(take)}${sold ? ` and ${sold} CD${sold === 1 ? '' : 's'}` : ''}. The tiles sound better than any studio.`, 'good');
}

/** Spin City: Ozzie keeps a stack by the register and sells them on consignment. */
export function consign(g) {
  const s = g.state;
  const m = musicState(s);
  const k = Math.min(m.cds, 10 - (m.consign || 0));
  if (k <= 0) { g.toast(m.cds ? 'Ozzie already has ten of yours by the register. "Let them breathe."' : 'No CDs to leave. Burn some at home.', 'info'); return; }
  m.cds -= k;
  m.consign = (m.consign || 0) + k;
  g.toast(`${k} CDs in a stack by the register with a card in Ozzie's handwriting: LOCAL. GOOD. ${'$'}4. "I keep a dollar. I play one in the store. That is the deal."`, 'good');
}

/** Each morning: Ozzie's sales, and a booking somebody did not show up for. */
export function musicNewDay(g, d) {
  const s = g.state;
  const m = musicState(s);
  if (m.consign) {
    const sold = Math.min(m.consign, Math.floor(Math.random() * (1.5 + Math.min(3, m.fans / 15) + (m.demo || 0) / 5)));
    if (sold) {
      m.consign -= sold;
      m.sold += sold;
      g.earnMoney(sold * 3, 'CDs at Spin City');
      logLine(g, `Spin City sold ${sold} of your CDs: ${money(sold * 3)}.`, 'good');
      if (Math.random() < 0.5) m.fans += 1;
    }
  }
  if (m.booking && m.booking.day < d) {
    m.booking = null;
    m.fans = Math.max(0, m.fans - 3);
    pushMessage(g, { from: 'ASHBY SOUND', subject: 'Saturday', body: 'You did not show. Sal put the ukulele lady on. I am not mad, I am busy. Do another open mic and we will see.' });
  }
}

/** The brownstone's studio corner: no vacuum, no radiator, no Rae. Two hours, a better take. */
export function recordAtHome(g) {
  const s = g.state;
  const m = musicState(s);
  if (!m.songs) { g.toast('Nothing to record yet. Write a song first: the notebook, an hour, three verses.', 'info'); return; }
  if (m.homeTake === dayOf(s.clock.m)) { g.toast('Your voice is done for today. It told you so on the last take.', 'info'); return; }
  m.homeTake = dayOf(s.clock.m);
  g.advance(120);
  bump(s, 'energy', -8);
  const q = 5 + Math.min(3, m.songs) + (m.gear.mic ? 1 : 0) + Math.floor(Math.random() * 2);
  const demo = Math.min(10, q);
  m.demo = Math.max(m.demo, demo);
  bump(s, 'morale', 8);
  bump(s, 'stress', -4);
  logLine(g, `Recorded a demo in the studio corner: ${demo}/10.`, 'good');
  g.toast(`Two hours, three takes, and nobody upstairs. You play it back on the monitors and it sounds like a record somebody would put on on purpose. Demo: ${m.demo}/10.`, 'good');
}

/** Thursday at Lucia's: the open mic. */
export function openMic(g) {
  const s = g.state;
  const m = musicState(s);
  if (!openMicNow(s)) { g.toast('Open mic is Thursdays, 20:00. The sign-up sheet is on the piano, with a pen on a string.', 'info'); return; }
  if (m.lastGig === dayOf(s.clock.m)) { g.toast('You already went up tonight. Sal says "once is brave, twice is a residency."', 'info'); return; }
  if (!m.songs) { g.toast('You sign up, then look at your empty hands, then cross your name out. Write something first.', 'bad'); return; }
  g.openModal({
    kicker: "LUCIA'S · OPEN MIC", title: 'Your Name Is Next',
    body: `A spoken-word guy, a woman with a ukulele, and then Sal reads your name off the sheet wrong. Twenty-two people, a candle on every table, and the espresso machine going like a train.\n\n${m.cds ? `You have ${m.cds} CDs in your jacket.` : 'You have nothing to sell but the song.'}`,
    choices: [
      { label: 'Go up and do it.', sub: 'nerves · stress', effect: () => perform(g) },
      { label: 'Not tonight.', effect: () => { bump(s, 'morale', -2); g.toast('You watch the ukulele woman do three songs and promise yourself next Thursday.', 'info'); } },
    ],
  });
}

function perform(g) {
  const s = g.state;
  const m = musicState(s);
  m.lastGig = dayOf(s.clock.m);
  m.gigs += 1;
  g.advance(40);
  const nerves = s.stats.stress > 70 ? -2 : s.high.level > 30 ? -1 : 0;
  const roll = Math.floor(Math.random() * 4);
  const score = Math.min(10, Math.max(0, Math.round((m.demo || 3) * 0.5 + m.songs + m.gigs + nerves + roll)));
  const tips = Math.round(score * (1.5 + Math.random()));
  const fans = Math.max(0, Math.round(score * 1.3 + Math.random() * 3));
  const sold = Math.min(m.cds, Math.max(0, Math.round(score / 2 + Math.random() * 2 - 1)));
  m.cds -= sold;
  m.sold += sold;
  m.fans += fans;
  g.earnMoney(tips + sold * 3, 'open mic');
  bump(s, 'morale', score >= 6 ? 14 : score >= 3 ? 7 : -3);
  bump(s, 'stress', score >= 3 ? -8 : 6);
  const contact = score >= 7 && Math.random() < 0.6;
  if (contact) m.contacts += 1;
  logLine(g, `Played the open mic at Lucia's: ${fans} people will remember your name.`, 'good');
  g.openModal({
    kicker: "LUCIA'S · OPEN MIC", title: score >= 7 ? 'They Clapped On The Two And The Four' : score >= 4 ? 'People Listened' : 'It Was A Room',
    body: `${score >= 7 ? 'Somebody at the back says "AY" at the second verse and it carries you through. The room goes quiet at the bridge, which is the best kind of loud.' : score >= 4 ? 'Most of the room listens. A couple at the front holds hands for the slow part. A man by the door nods once, which counts.' : 'Your voice cracks on the first line. You finish anyway, which is the bravest thing anybody does in here tonight.'}\n\nTip jar: ${money(tips)}${sold ? ` · ${sold} CD${sold === 1 ? '' : 's'} at $3` : ''}. ${fans} people know your name now.${contact ? '\n\nA woman with a lanyard gives you a card: "Ashby Sound, studio time sometimes. Call me."' : ''}`,
    choices: [{ label: 'Walk home with your hands still shaking.', effect: () => {} }],
  });
  // a good night gets you paid next time: a Saturday late set at Lucia's
  if (score >= 6 && !m.booking) {
    const today = dayOf(s.clock.m);
    const toSat = (((6 - ((today - 1) % 7)) + 7) % 7) || 7;
    m.booking = { day: today + toSat, pay: 30 + score * 6 };
    pushMessage(g, { from: 'ASHBY SOUND', subject: 'a paid set', body: `Renée again. Lucia's wants you for the Saturday late set, ${'$'}${m.booking.pay} flat plus the jar, 9 PM, forty minutes. Sal says do not be late, and Sal has never once been wrong about anything, ask him.` });
  }
  // a good night brings an offer, and offers come at the wrong time
  if (contact && !m.offer) {
    const day = dayOf(s.clock.m) + 1;
    m.offer = { day, from: 14 * 60, to: 17 * 60 };
    pushMessage(g, { from: 'ASHBY SOUND', subject: 'studio time', body: `This is Renée from the open mic. Free studio time tomorrow, 2 to 5, Ashby Ave, the door next to the pawn shop. Real mics. Real engineer. If you are not there by 3 I give it to the ukulele lady.` });
  }
}

/** The studio session, if there is one today (the door next to the pawn shop on Ashby). */
export const studioNow = (s) => {
  const o = musicState(s).offer;
  return !!(o && dayOf(s.clock.m) === o.day && minuteOfDay(s.clock.m) >= o.from && minuteOfDay(s.clock.m) < 15 * 60);
};

export function studio(g) {
  const s = g.state;
  const m = musicState(s);
  if (!studioNow(s)) { g.toast('The door next to the pawn shop is locked. A sign says ASHBY SOUND · BY APPOINTMENT.', 'info'); return; }
  m.offer = null;
  g.advance(150);
  m.demo = Math.min(10, m.demo + 3);
  m.contacts += 1;
  bump(s, 'morale', 14);
  bump(s, 'stress', -6);
  logLine(g, `Recorded at Ashby Sound. Demo: ${m.demo}/10.`, 'good');
  g.toast(`Three hours in a room with foam on the walls and a man named Theo who says "one more" like a prayer. The demo is ${m.demo}/10 now. It sounds like somebody.`, 'good');
}

/** Sell CDs on the avenue: an hour by the bus stop with a shoebox. */
export function sellCDs(g) {
  const s = g.state;
  const m = musicState(s);
  if (!m.cds) { g.toast('No CDs in the shoebox. Burn some at home first.', 'info'); return; }
  g.advance(60);
  const sold = Math.min(m.cds, Math.floor(Math.random() * (2 + Math.min(4, m.fans / 10))));
  m.cds -= sold;
  m.sold += sold;
  m.fans += sold;
  if (sold) g.earnMoney(sold * 3, 'demo CDs');
  bump(s, 'morale', sold ? 4 : -2);
  g.toast(sold ? `${sold} CD${sold === 1 ? '' : 's'} at three dollars. One guy asks you to sign it. You do not know how to sign your name like that. You do it anyway.` : 'An hour. Forty people walk past. One of them asks if the CDs are blank. Technically, no.', sold ? 'good' : 'info');
}
