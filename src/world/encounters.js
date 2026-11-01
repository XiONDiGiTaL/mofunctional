/**
 * Running into one of the FeedLove women on the block. She is a real person standing in the bodega,
 * not a profile: she may remember turning him down, she may remember matching, and if she is one
 * of the few who are not looking for a boyfriend she may give him her number for later.
 * Nobody here can be dated; that is what Stephanie, Melanie and Diana are for.
 */
import { CONFIG } from '../core/config.js';
import { pick } from '../core/util.js';
import { bump } from '../core/state.js';
import { STRANGER_BY_ID } from '../core/strangers.js';
import * as dating from '../systems/dating.js';

const NO_LINES = [
  '"I have a boyfriend." She does not have a boyfriend. She has a reason to say that.',
  'She takes one earbud out, listens to the first four words, and puts it back in.',
  '"Not today, Quik-Stop." She has seen the vest.',
  '"Are you selling something?" You are not. It does not help.',
  'She smiles the smile people use on dogs that might bite, and leaves.',
];
const REMEMBER_NO = [
  '"You hearted me on FeedLove. I saw. Still no." She is not even mean about it, which is worse.',
  '"Oh. You. From the app." That is the whole conversation.',
];
const OPEN_HI = [
  'She looks you up and down like a menu she is not going to order from today. Then she laughs.',
  '"You are the guy from the app. You look more tired in person. It works for you."',
  'She asks if you live around here and does not wait for the answer.',
];

/** Her name if he has seen her in the app; otherwise she is just a woman by the counter. */
export function strangerLabel(s, id) {
  const w = STRANGER_BY_ID[id];
  const seen = dating.datingState(s).seen[id];
  return seen ? `Talk to ${w.name}` : 'Talk to the woman';
}

export function strangerMenu(g, id) {
  const s = g.state;
  const w = STRANGER_BY_ID[id];
  if (!w) return;
  const d = dating.datingState(s);
  const seen = d.seen[id];
  const contact = !!d.hookups[id] && !d.hookups[id].flaked;
  const intro = seen === 'hookup' || contact
    ? `${w.name}. From FeedLove. She recognises you before you recognise her.`
    : seen === 'reject' ? `${w.name}. The one who unmatched you. She knows it too.`
      : seen === 'met' ? `${w.name}. You said hi once. She remembers, roughly.`
      : seen ? `${w.name}, from the app. ${w.age}, ${w.hood}. In person she is mostly a raised eyebrow.`
        : 'You have seen her somewhere. Probably on your phone at 2 AM.';
  const choices = [];
  choices.push({
    label: 'Say hi.', sub: '5 min',
    effect: () => {
      g.advance(5, { social: true });
      if (!d.seen[id]) d.seen[id] = 'met';
      if (w.open && !d.hookups[id]?.flaked) {
        bump(s, 'morale', 3);
        const gave = !contact && Math.random() < CONFIG.dating.hookup.runInNumberChance;
        if (gave) dating.addHookupContact(g, id);
        g.openModal({
          kicker: w.name.toUpperCase(), title: gave ? 'A Number' : 'Hi',
          body: `${pick(OPEN_HI)}${gave ? `\n\nShe takes your phone, types her number, and hands it back. "After ${CONFIG.dating.hookup.fromHour}:00. Not a date."` : contact ? '\n\n"You have my number. Use it after dark, not in a bodega."' : '\n\n"Maybe some other time." It sounds like it means it, a little.'}`,
          choices: [{ label: 'Okay.', effect: () => {} }],
        });
        return;
      }
      bump(s, 'morale', -2);
      g.openModal({
        kicker: w.name.toUpperCase(), title: 'No',
        body: seen === 'reject' ? pick(REMEMBER_NO) : pick(NO_LINES),
        choices: [{ label: 'Fair.', effect: () => {} }],
      });
    },
  });
  if (contact) {
    const av = dating.hookupAvailable(s, id);
    choices.push({
      label: 'Ask if she wants to get out of here.', sub: av.ok ? 'a night · not a date' : av.reason,
      disabled: !av.ok,
      effect: () => dating.hookup(g, id),
    });
  }
  choices.push({ label: 'Leave her be.', sub: '', effect: () => {} });
  g.openModal({ kicker: 'SOMEBODY FROM THE APP', title: seen ? w.name : 'A Woman', body: intro, choices });
}
