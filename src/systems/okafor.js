/**
 * Nurse Okafor's other job. On LonelyFans she is HelloNurse69: never her face, always the exam
 * room at the Kestrel Clinic behind her (the teal wall, the muscle chart, the crutches in the
 * corner). Buy a picture or two and Mo recognises the room. Ask her about it at the clinic and she
 * pulls him into the supply room: keep it quiet and he is looked after. Gerba whenever he comes by
 * (energy, mood), and treatment on the house.
 *
 * Anything more is not part of that deal and is never a price for silence: it is there only once
 * she likes him (flirting, showing up, keeping his word), and it is her yes, said like she means
 * it. Then the supply room door, a fade to black, and Mo coming round on the cot in the back with
 * her at the mirror putting herself back together before they walk out front like nothing happened.
 *
 * Headless; state in `state.okafor`.
 */
import { bump, logLine, pushMessage } from '../core/state.js';
import { dayOf, pick } from '../core/util.js';

export function okaforState(s) {
  if (!s.okafor) s.okafor = { knows: false, asked: false, deal: false, like: 0, flirtDay: 0, gerbaDay: 0, cheeksDay: 0, cheeks: 0, pics: 0 };
  return s.okafor;
}

/** A HelloNurse69 picture was bought: the second time, he knows the room. */
export function onPic(g) {
  const o = okaforState(g.state);
  o.pics += 1;
  if (o.knows || o.pics < 2) return;
  o.knows = true;
  pushMessage(g, {
    from: 'LONELYFANS', subject: '@HelloNurse69',
    body: 'You look at it a second time, and then you stop looking at her and look at the room.\n\nThe teal wall. The muscle chart with the man who has no skin. Two crutches in the corner, one taller than the other. You have sat in that room with a blood-pressure cuff on.\n\nThat is the exam room at the Kestrel Clinic. And that, from the neck down, is Nurse Okafor.',
    kind: 'fans',
  });
  logLine(g, 'Worked out who HelloNurse69 is.', 'info');
}

/** Extra lines in the clinic menu, depending on where the two of them stand. */
export function clinicChoices(g, reopen) {
  const s = g.state;
  const o = okaforState(s);
  const today = dayOf(s.clock.m);
  if (!o.knows) return [];
  if (!o.deal) {
    return [{ label: 'Ask her about HelloNurse69.', sub: 'quietly', effect: () => setTimeout(() => ask(g), 60) }];
  }
  return [
    { label: 'Flirt with her.', sub: o.flirtDay === today ? 'you already did today' : '+morale', disabled: o.flirtDay === today, effect: () => flirt(g) },
    { label: 'Gerba.', sub: o.gerbaDay === today ? 'tomorrow, she says' : 'the supply room · +energy · +mood', disabled: o.gerbaDay === today, effect: () => gerba(g) },
    { label: 'Ask if she wants to.', sub: o.like < 3 ? 'she is not there yet' : today - o.cheeksDay < 2 ? 'not two days running' : 'her call', disabled: o.like < 3 || today - o.cheeksDay < 2, effect: () => setTimeout(() => proposition(g), 60) },
  ];
}

function ask(g) {
  const s = g.state;
  const o = okaforState(s);
  o.asked = true;
  g.openModal({
    kicker: 'KESTREL CLINIC · THE SUPPLY ROOM', title: 'HelloNurse69',
    body: 'You say it under your breath. She does not drop the clipboard. She puts it down, very carefully, takes your elbow, and walks you into the supply room like you are a patient who fainted, and shuts the door.\n\n"Rent is rent," she says. "Nursing school was ninety thousand dollars. The clinic pays what the clinic pays." She looks at you over her glasses. "Nobody on this block hears about it. Not Papi. Especially not Papi."\n\nThen, softer: "Keep it quiet and you are taken care of. You come by, I fix you up. Gerba, any time you like. And you do not pay for treatment here again."',
    choices: [
      { label: 'Your secret is safe with me.', effect: () => {
        o.deal = true;
        o.like += 1;
        bump(s, 'morale', 6);
        logLine(g, 'Made a quiet deal with Nurse Okafor.', 'info');
        g.toast('"Good man." She straightens your collar, which did not need it, and opens the door. "Next!"', 'good');
      } },
      { label: 'I would never say anything anyway.', sub: 'and mean it', effect: () => {
        o.deal = true;
        o.like += 2;
        bump(s, 'morale', 8);
        g.toast('She looks at you for a second longer than a nurse looks at a patient. "Huh," she says. "Okay. The offer stands anyway."', 'good');
      } },
    ],
  });
}

function flirt(g) {
  const s = g.state;
  const o = okaforState(s);
  o.flirtDay = dayOf(s.clock.m);
  const clean = s.stats.hygiene > 30 && s.high.level < 30;
  o.like += clean ? 1 : 0.5;
  bump(s, 'morale', 4);
  g.advance(10);
  g.toast(pick([
    '"Your blood pressure is up," she says, pen on her lip. "I wonder why." She writes something on your chart that is definitely not medical.',
    'You tell her the uniform suits her. "This one?" She looks down at the scrubs. "You have seen the other one." She lets that sit there.',
    '"You keep coming in healthy," she says. "People will talk." She does not sound like she minds.',
    ...(clean ? [] : ['"You smell like a bus stop," she says, but she is smiling. "Shower, then flirt. That is the order of operations."']),
  ]), 'good');
}

function gerba(g) {
  const s = g.state;
  const o = okaforState(s);
  o.gerbaDay = dayOf(s.clock.m);
  o.like += 0.5;
  const run = () => {
    g.advance(20);
    bump(s, 'energy', 30);
    bump(s, 'morale', 10);
    bump(s, 'stress', -12);
    logLine(g, 'Gerba in the supply room.', 'good');
    s.flags.clinicBackScene = 'gerba';
    g.goTo('clinicback', 'clinic');
  };
  if (g.sceneCut) g.sceneCut({ caption: 'The supply room. The radio up loud.', run });
  else run();
}

function proposition(g) {
  const s = g.state;
  const o = okaforState(s);
  g.openModal({
    kicker: 'KESTREL CLINIC · AFTER HOURS', title: 'Her Call',
    body: 'You ask. Not as part of the deal; the deal is the deal. You ask like a man asking.\n\nShe takes off her glasses, folds them, and puts them in her pocket. "I was wondering when you would." She is already locking the front door. "I am on the pill. Supply room. Do not knock anything over, the inventory is Tuesday."',
    choices: [
      { label: 'Follow her.', effect: () => {
        o.cheeksDay = dayOf(s.clock.m);
        o.cheeks += 1;
        o.like += 1;
        g.advance(45);
        bump(s, 'stress', -22);
        bump(s, 'morale', 14);
        bump(s, 'energy', -8);
        logLine(g, 'An hour in the clinic supply room with Nurse Okafor.', 'good');
        s.flags.clinicBackScene = 'cheeks';
        const go = () => g.goTo('clinicback', 'clinic');
        if (g.sceneCut) g.sceneCut({ caption: 'The supply room. The inventory is Tuesday.', run: go }); else go();
      } },
      { label: 'Another time.', effect: () => g.toast('"Another time," she agrees, and puts the glasses back on. "My offer does not expire. Neither does yours."', 'info') },
    ],
  });
}

/** Mo comes round on the cot in the back; she is at the mirror. Called when the room loads. */
export function backroomWake(g) {
  const kind = g.state.flags.clinicBackScene;
  if (!kind) return;
  g.state.flags.clinicBackScene = false;
  if (kind === 'gerba') {
    g.toast(pick([
      'The supply room. She is at the little mirror tugging the uniform straight and re-pinning the cap. "Lollipop on the way out," she says. "You were very brave."',
      'She checks her lipstick in the mirror, smooths the skirt down, and hangs the CLEANING sign back on the hook. "Out front. Walk normal. Normal, Mo."',
    ]), 'good');
    return;
  }
  g.toast(pick([
    'You come round on the cot under a shelf of gauze. She is at the little mirror by the sink, pinning the cap back on, fixing her lipstick with one finger. "Out front in two minutes," she says without turning round. "Walk like you had a flu shot."',
    'The cot, the hum of the supply fridge, a box of tongue depressors on its side. She is at the mirror putting herself back in order, humming. "You did not see me," she says. "I did not see you. Out you go."',
  ]), 'good');
}
