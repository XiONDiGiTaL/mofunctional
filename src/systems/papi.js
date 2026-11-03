/**
 * Papi: seventy-something, white tank top, the domino table outside the bodega every day the
 * weather allows and several it does not. He knows everybody, everything, and most of what is
 * about to happen. He is the game's encyclopedia: ask him about a person, a place, or what is
 * going on, and he tells you a little, in his own way, which is the only way he tells anything.
 *
 * The "what is going on" page reads the run (a happening on the way, a story in progress, the
 * dog, the building) so his gossip is always about this week.
 */
import { recentIncident } from '../world/incidents.js';
import { pick, dayOf } from '../core/util.js';

const PEOPLE = [
  ['Kev', 'Works the Quik-Stop with you. Good heart, bad timing, theories about everything. His mother calls me to ask if he is eating. I tell her yes. I do not know.'],
  ['Nia', 'Your sister. She is the strong one in that family, and she knows it, and it tires her out. Call her before she calls you. It means more.'],
  ['Dale', 'Runs the Quik-Stop. Fifty-one years old and he has been "about to quit" since he was thirty. Fair, if you are on time. A wall, if you are not.'],
  ['Rae Vell', 'Your landlord. Lives in 1A like a spider in the middle of his web. He fixes things the way the city fixes potholes: eventually, badly, with a speech. In a group he listens. Alone, never.'],
  ['Miguel', 'The bodega. Bacon, egg and cheese since 1989. He will put you on the book if he likes you. The cat is named after nobody. The cat is the real owner.'],
  ['Habib', 'Chicken over rice, the white sauce is a secret even from his wife. He works too hard. If business is slow, buy a plate. He remembers who did.'],
  ['Yusuf', 'Outside Habib\'s with the hookah. A gentle man. Do not test that. I have seen one fool test that. He ran so fast he lost a shoe, and Yusuf never even stood all the way up.'],
  ['Dex', 'The alley, at night. He sells what he sells. He is polite about it, which is worse. Do not owe him.'],
  ['Rolo', 'Texts only, an app from 1999, delivers like a pizza place. Never met him. Nobody has met him. Maybe he is three people.'],
  ['Stephanie', 'First floor of your building, 1B. Hoodie, sharp mouth, kind underneath if you get that far. She likes people who do what they said.'],
  ['Melanie', 'Tank tops in January. Comes through the park. Laughs loud. Does not suffer fools; has met you.'],
  ['Diana', 'Runs. Every morning, the park, like the bills are chasing her. Maybe they are. Smart girl. Ask her a real question.'],
  ['Shepherd Addison', 'The gold church. White suit, a voice like warm butter. Takes ten percent of your heart and the other ninety in cash. Some people it helps. Watch your wallet in there, and watch his.'],
  ['Gus', 'On his cardboard by the bodega. He was a merchant marine. He has seen eleven countries and now he sees Kestrel Street. Give him a dollar, he will give you a story worth five.'],
  ['Meatball', 'The brown dog. One ear up. Feed him and he is yours forever. Kick him and he never forgets. Same as people, but honest about it.'],
  ['Chairman', 'The cat, if you took him in. A cat is a landlord you pay in tuna. He will sit on your chest at 4 a.m. That is love, they say.'],
  ['Hector', 'The super at 1104. Has a wrench for everything and an opinion for more than everything. He will tell you about the leak before it is a leak.'],
  ['Mrs. Pryce', '3A, your floor. Seventy-three, sleeps in her coat because the heat is a rumour. Get her on your side and the whole hall follows.'],
  ['Gloria', '4B at 1104. Eighty-one, a tin full of receipts, and a landlord who says she owes. She does not owe. Somebody should help her prove it.'],
  ['Lou', 'Runs the grill at every block party since the Mets were good. Pays in cash and plates. Mostly plates.'],
  ['The old man at the chess table', 'Kestrel Park. He has been waiting for an opponent since about 1971. He will beat you. Play him anyway. Losing to him teaches more than winning at most things.'],
  ['Sal', 'Two Sals. Sal at Lucia\'s, forty-one years a waiter, Sinatra was rude to him. Sal the plumber, eleven minutes of work, an hour on the bill. Know which Sal you are calling.'],
  ['Dee', 'The laundromat. She sees everything over that magazine. She will not tell you. That is why everybody tells her things.'],
  ['Jay', 'Downtown, the clothing store, and the catalog. Every outfit he sells, he is wearing. I do not know how.'],
  ['The pigeon lady', 'In the park with her bread. Every pigeon is Gerald. Do not argue with her about this. I tried. She was right.'],
  ['Dennis', 'The Tuesday group at the clinic. If you ever need him, he picks up. I know because once, a long time ago, somebody gave me a number like that too.'],
  ['Nurse Okafor', 'The clinic. Strict like a mother is strict. She closes the file, never the door.'],
  ['The Guardian Angles', 'Red berets. They mean well, at an angle. Knock down a lot of innocent people fast and they come for you. Five, six. They count.'],
  ['The cops', 'Mostly they drive by. They come for what they see with their own eyes, not what somebody tells them. So: do not do anything in front of them. You did not hear that from me.'],
  ['The men in the black hats', 'From Williamsburg, walking to somewhere. Good neighbours. They nod, I nod. Forty years. That is a relationship.'],
  ['The women in the towers', 'Kestrel Houses, after five. Three floors, two towers. The mailboxes in the lobby have their names, and the old lady in the lawn chair has everything else.'],
];

const PLACES = [
  ['The Quik-Stop', 'Where you work. Open twenty-four hours, coffee ninety-nine cents, and the lotto machine broke twice this year. Dale knows every can on every shelf.'],
  ['The bodega', 'Miguel\'s. The cat on the lotto machine. Loosies, two for a dollar fifty, but you did not hear the price from me.'],
  ['Habib\'s Corner', 'Halal, late. Until two, unless business is slow, then midnight. Yusuf outside, Habib inside, the white sauce a mystery.'],
  ['1120 Kestrel', 'Your building. Rae in 1A, Stephanie on the first, Kev on the second, you and your neighbours on the third. The elevator works. The roof door alarm does not. That is the best thing about the building.'],
  ['1104 Kestrel', 'The walk-up next door. Five floors, a soup lady on the third, Squeak selling out of his coat on the fourth, the roof at the top. That roof alarm is real, the sign says. The sign lies.'],
  ['The roof', 'Up there you can see the whole problem at once, and somehow it gets smaller. Go when the day is too loud.'],
  ['Kestrel Park', 'Benches, a bent rim, a chess table, a boombox somebody leaves. After dark, watch the paths. Bring the dog if the dog likes you.'],
  ['The Golden Fellowship', 'The gold church. Sunday at eleven. Free coffee. Nothing else is free.'],
  ['Kestrel Clinic', 'They take walk-ins and they take the bill. Five sessions, every other day, if you want the course.'],
  ['Ashby Avenue', 'The other side of the train. Lucia\'s, the laundromat with the arcade, the pawn shop, the newsstand. Thursday nights, the open mic at Lucia\'s.'],
  ['Downtown', 'Fulton Street. Jay\'s, the relief office, and traffic that will hit you if you stand in the road like a fool. I have seen it.'],
  ['Kestrel Houses', 'The projects. The man on the bench, the half-court, the towers. Go in daylight unless you know somebody.'],
  ['The Basement', 'Under the street. Fights for money. You will win some. Your face will remember all of them.'],
  ['Dee\'s laundromat', 'Washers, the TV, three arcade machines. Punch the vending machine right and a soda falls out. Punch it wrong and Dee falls out.'],
  ['The newsstand', 'Papers, scratch-offs, Jay\'s catalog, the decorating guide. The man in the box knows almost as much as me. Almost.'],
];

function goingOn(g) {
  const s = g.state;
  const out = [];
  const h = s.happening;
  const day = dayOf(s.clock.m);
  const hap = { blackout: 'the power is going out', heatwave: 'it is going to be hot like a frying pan', transit: 'the K train is going to be down', party: 'there is a block party coming, Lou is buying charcoal', inspection: 'the city is inspecting your building, Rae is painting over everything' };
  if (h && !h.done) out.push(h.day > day ? `I hear ${hap[h.id] || 'something is coming'}, day ${h.day}. Get ready, do not get surprised.` : `Today ${hap[h.id] || 'something is happening'}. You see it. Everybody sees it.`);
  const arcs = s.arcs || {};
  if (arcs.kev && !arcs.kev.done) out.push('Kev is moving boxes and pretending he is not. Ask him straight. He will tell you straight, the second time.');
  if (arcs.nia && !arcs.nia.done) out.push('Your sister has a class she cannot miss and a boy who cannot be alone. You know what to do.');
  if (arcs.habib && !arcs.habib.done) out.push('Habib is counting his receipts twice. Eat there this week. Tell people.');
  if (arcs.gloria && !arcs.gloria.done) out.push('Gloria at 1104 got a paper on her door. The receipt is in the tin. Somebody needs to find the tin.');
  if (arcs.dale && !arcs.dale.done) out.push('Dale wants to give you keys. Keys are heavy, Mo. Decide if your pocket can hold them.');
  if ((s.dog?.like || 0) >= 100) out.push(`${s.dog.name || 'The dog'} follows you like a shadow now. Even to the park. Good. A shadow with teeth.`);
  else if ((s.dog?.like || 0) > 0) out.push(`${s.dog.name || 'The dog'} is warming up to you. Food. Patience. Same as anybody.`);
  if (s.tenants?.outcome) out.push(`Your floor went to Rae together. ${s.tenants.outcome}. Not bad. Not everything. Not bad.`);
  else if (s.tenants && Object.keys(s.tenants.complaints || {}).length) out.push('I hear your floor is making a list. Good. A list is a thing a landlord cannot hang up on.');
  if ((s.music?.fans || 0) >= 10) out.push(`People say your name at Lucia's on Thursdays. ${s.music.fans} people. That is a block's worth. Keep going.`);
  if (s.flags?.addisonRobbed) out.push('Somebody knocked the Shepherd down in his own church and went through his robes. I am not saying who. I am looking at who.');
  const inc = recentIncident(s);
  if (inc) out.push(inc);
  // the new money on the block, and the new manners
  if (Object.values(s.supply?.dealers || {}).some((d) => d.on)) out.push('There is a new thing on the corners. ROX, they call it. Benchy has new sneakers. Dex is smiling, which is worse. Somebody is cooking it, and that somebody should be careful, because I can smell a pot from here.');
  else if (s.counters?.roxSold) out.push('The ones who walk at night are talking about rocks. Little white rocks. Mo, when the night people know a thing, the police know it a week later.');
  if (s.rae?.kos) out.push(`Rae Vell crosses the street when he sees you now. Rent went down for you, I hear${s.rae.cut ? ` (${Math.round(s.rae.cut * 100)}%)` : ''}. For the rest of us it went up. Think about that.`);
  if (s.okafor?.deal) out.push('Okafor at the clinic is in a good mood lately. Okafor is never in a good mood. I do not ask. I am old, not stupid.');
  if (s.romance?.liveIn === 'diana') out.push('Diana makes you eat breakfast. I see it in your face. Marry that woman before she comes to her senses.');
  if (!out.length) out.push(pick(['Quiet week. I do not trust a quiet week. Something is coming, it always is.', 'Nothing new. Tito lost again. That is not news, that is weather.', 'Same block. Same people. You look a little different, that is the only news.']));
  return out;
}

const list = (g, title, rows, back) => {
  g.openModal({
    kicker: 'PAPI · THE DOMINO TABLE', title,
    body: 'He lays a bone down without looking at it. "Ask."',
    choices: [
      ...rows.map(([name, line]) => ({ label: name, effect: () => setTimeout(() => entry(g, title, name, line, rows, back), 60) })),
      { label: 'Back.', effect: () => setTimeout(() => back(g), 60) },
    ],
  });
};

function entry(g, title, name, line, rows, back) {
  g.advance(3);
  g.openModal({
    kicker: `PAPI · ${title.toUpperCase()}`, title: name,
    body: `"${line}"`,
    choices: [
      { label: 'Ask about somebody else.', effect: () => setTimeout(() => list(g, title, rows, back), 60) },
      { label: 'Thank him.', effect: () => {} },
    ],
  });
}

/** Papi's menu: people, places, and what is going on this week. */
export function papiMenu(g) {
  const s = g.state;
  g.openModal({
    kicker: 'OUTSIDE THE BODEGA · DOMINOES', title: 'Papi',
    body: 'White tank top, a gold chain with a saint on it, forty years on this corner. He does not look up from the bones. "You want to know something. Everybody who stops wants to know something. Sit, or ask standing, I do not charge."',
    choices: [
      { label: 'Ask about somebody.', sub: `${PEOPLE.length} people`, effect: () => setTimeout(() => list(g, 'People', PEOPLE, papiMenu), 60) },
      { label: 'Ask about a place.', sub: `${PLACES.length} places`, effect: () => setTimeout(() => list(g, 'Places', PLACES, papiMenu), 60) },
      { label: '"What is going on, Papi?"', sub: 'this week on the block', effect: () => { g.advance(5); g.openModal({ kicker: 'PAPI · THE BLOCK', title: 'What Is Going On', body: goingOn(g).map((l) => `"${l}"`).join('\n\n'), choices: [{ label: 'Thanks, Papi.', effect: () => {} }] }); } },
      { label: 'Play a hand with them.', sub: '30 min · you will lose', effect: () => { g.advance(30); s.stats.stress = Math.max(0, s.stats.stress - 6); s.stats.morale = Math.min(100, s.stats.morale + 4); g.toast(pick(['Papi lets you win one hand so you will stay for six. You stay for six.', '"Capicúa," Papi says, softly, like a prayer, and the game is over. Tito throws his bones in the air.', 'You lose three hands and learn more about the block than in a month of walking it.']), 'good'); } },
      { label: 'Leave them to it.', effect: () => {} },
    ],
  });
}

export const PAPI_PEOPLE = PEOPLE.length;
