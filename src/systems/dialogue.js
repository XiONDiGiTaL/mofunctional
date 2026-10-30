/** All prose: NPC barks, Addison's sermons, ambient lines. */

export const ADDISON_TALK = {
  intro: `"You walked past this building four times this week. I counted. Not to frighten you — I count because I care, and caring is a kind of counting."\n\n"My name is Addison Octavius. This is not a church that asks you to be good. It asks you to be honest, and then it charges a modest fee for the honesty."`,
  invite: `"You came back. People who come back are my favourite kind of person, because they have already done the hard part once."\n\n"Sunday. Eleven. There is a seat that has your shape in it."`,
  regular: `"Mo. You have the look of someone who has been doing arithmetic in his head for a month. Rent. Food. The other thing. All of it subtracting."\n\n"We do not subtract here. We accept. We are extremely good at accepting."`,
  tither: `"You are one of us now, in the way that a person is one of us before they have agreed to anything. That is the beautiful part. The agreement is a formality."`,
  inner: `"There is a room behind the room behind this one. Very few people see it. You would like it. It has better chairs."\n\n"I want you to understand that I am offering you something real. And also that I am offering you something."`,
};

export const SERVICE_SERMONS = [
  {
    summary: 'The sermon was about gratitude. Specifically, the gratitude you owe to people who help you, and how gratitude can be paid in instalments.',
    line: '"Counting your blessings is the same motion as counting money. Do not be embarrassed by the resemblance."',
  },
  {
    summary: 'The sermon was about "the small, manageable sin" — the idea that a life is not ruined by one decision but by an unmanaged series of them, and that management can be outsourced.',
    line: '"You are not a bad man, friend. You are an unadministered man."',
  },
  {
    summary: 'The sermon was about the tenth. Addison called it "the rent you pay on your soul" and then pretended he had not said that.',
    line: '"A tenth is not a tax. A tenth is a reminder that the other nine tenths were never yours either."',
  },
  {
    summary: 'The sermon was about families — the ones that fail you, and the ones you choose. He looked at you for the word "choose" and did not look away for four seconds.',
    line: '"Blood is a coincidence. We are an arrangement."',
  },
  {
    summary: 'The sermon was about how everything you own can fit in a bag, and how freedom is really just a smaller bag.',
    line: '"You are so close to being free. Do not get sentimental about your furniture now."',
  },
];

export const NPC_BANTER = {
  rae: [
    '"Rent\'s due Friday. I\'m not chasing you, I\'m just telling you where Friday is."',
    '"The hallway light is your responsibility this month. I wrote it on the board. There is a board."',
    '"Your music is fine. It\'s the timing of your music that concerns me."',
    '"Fridge door again. Third time. I\'m not angry, I\'m documenting."',
  ],
  dale: [
    '"You look like a man who has not slept. I need a man who has slept."',
    '"Vest. Badge. Do not wear the vest outside. It frightens the neighbourhood."',
    '"If you\'re going to be late, be late on time. I need to know when."',
    '"Corporate is sending someone. Smile like you mean it. Or at least like you\'ve been paid."',
  ],
  dex: [
    '"Cash only. I\'m not a bank, I\'m a service."',
    '"You look like a spreadsheet that someone closed without saving."',
    '"Don\'t bring your problems here. Bring your money. The problems can wait outside."',
    '"New batch. Same price. Do the math and then don\'t."',
  ],
  kev: [
    '"Bro. Bro. You will not believe what Marcus did with the mop."',
    '"You free Friday? Don\'t say no, just say maybe, it\'s nicer."',
    '"You seem like a guy with a plan. Even if the plan is bad, that\'s still a plan."',
  ],
  chairman: [
    '"Chairman sits on the radiator. Chairman has decided the radiator is his."',
    '"Chairman has knocked your only glass off the counter. He is watching to see what you do."',
    '"Chairman purrs at a volume that suggests he is aware of your finances."',
  ],
  nia: [
    '"I\'m not judging. I\'m just standing here looking at you in a way that resembles judging."',
    '"Mom asks about you every Sunday. I\'ve started lying. I don\'t like how good I\'ve gotten."',
    '"You can come over and do nothing, you know. That\'s allowed."',
  ],
};

export function npcLine(id) {
  const lines = NPC_BANTER[id];
  if (!lines) return '"..."';
  return lines[Math.floor(Math.random() * lines.length)];
}

export const AMBIENT_LINES = [
  'Somewhere, a car alarm is inventing a rhythm.',
  'The streetlight outside stutters like it is reading aloud.',
  'A dog barks at nothing, twice, with authority.',
  'The radiators in 3B have opinions about the weather.',
  'Someone upstairs drops a fork. Then another fork. Then a drawer.',
  'A bus exhales. The whole block leans slightly.',
  'The neon sign across the street is missing one letter and advertising the wrong thing.',
  'Rain starts, gives up, starts again.',
  'The vending machine hums the same two notes it has hummed for nine years.',
  'A church bell rings in a rhythm that is very slightly wrong.',
];

export const TUTORIAL_HINTS = {
  0: { title: 'FIRST THINGS', text: 'Open your phone <kbd>[TAB]</kbd>. Check your money, read your messages, and see what is due.' },
  1: { title: 'EAT SOMETHING', text: 'The fridge is behind you. Interact with <kbd>[E]</kbd> and eat before you do anything else.' },
  2: { title: 'GO TO WORK', text: 'Shift is 09:00–17:00 at Quik-Stop #14. Go out the door, walk right, and clock in at the store.' },
  3: { title: 'PAY THE RENT', text: 'Rent is due on Day 7. Open Banking in your phone and pay it before Rae puts a notice on your door.' },
  4: { title: 'SELL SOMETHING', text: 'You have things you do not need. BidBay is in your phone. List them high, or list them sold.' },
  5: { title: 'STAY FUNCTIONAL', text: 'Survive 30 days. Rent paid. Job intact. Everything above zero.' },
};

export const INTRO_TEXT = [
  `You are Mo. It is Monday. It is 7:00 in the morning, and the radiator is making the sound of a man being patient.`,
  `You have a job at Quik-Stop #14 that starts at 9. You have an apartment with three days of food in it. You have $212.40 and a phone full of people who want things.`,
  `You also have a habit that has been quietly changing the arithmetic of your life while you were looking at other numbers.`,
  `Rent is due on Day 7. It is $420. You do not have $420.`,
  `Nobody is coming to fix this. That is not a tragedy; that is a schedule. You are quite good with schedules.`,
];

export const HELP_TEXT = `MO: FUNCTIONAL

WASD / arrows — move
E — interact (prompt appears at the bottom)
TAB — phone (pauses time)
1 / 2 / 3 — game speed
F — toggle 4:3
C — toggle CRT filter
ESC — pause menu

THE LOOP
Time only moves when you do. Almost every action costs minutes.
Your shift is 09:00–17:00, Monday–Friday. Miss it and you collect strikes.
Rent is due every 7 days. Power every 14. Phone every 7.
Sell things on BidBay. Eat before you are desperate. Sleep before energy hits zero.

BLISS / STATIC / MUD / DRIP are fictional substances that exist only in this game.
They raise risk. Risk at 100 is an ending, and not the flattering kind.
`;
