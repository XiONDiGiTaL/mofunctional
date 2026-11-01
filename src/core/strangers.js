/**
 * The twenty women on FeedLove HEARTS who are not Stephanie, Melanie or Diana.
 *
 * Their faces are the owner's app sheet (assets/ref/app_women_bank.png, baked as w0..w19 by
 * scripts/bake-npc-faces.py, in reading order). They are the same people every day, so a face Mo
 * hearted on Monday can be the face that walks past him at the bodega on Thursday.
 *
 * `open`: she is not looking for a boyfriend, but she might be looking for company. The rest are a
 * polite no, a rude no, or a match that goes nowhere. None of them can be dated; that is what the
 * three are for.
 *
 * `look` paints the back of her head and builds her body: hair colours and style (styles are
 * characters.js HAIR_SHELLS / hangingHair), clothes, height. Pure data: render and world code
 * reads it, systems/dating.js reads the rest.
 */
const L = (skin, hair, light, dark, style, shirt, pants, extra = {}) => ({ skin, hair, hairLight: light, hairDark: dark, style, shirt, pants, ...extra });

export const STRANGERS = [
  { id: 'w0', name: 'Jen', age: 33, hood: 'Park Slope', open: false, bio: 'just here to see who from high school got fat',
    look: L('#d8b09a', '#4a3220', '#6e4a30', '#2a1a10', 'shoulder', 0x6a7a8a, 0x2e3440, { hairLen: 0.9 }) },
  { id: 'w1', name: 'Marisol', age: 29, hood: 'Sunset Park', open: true, bio: 'not looking for a boyfriend. not NOT looking for something.',
    look: L('#c8987a', '#1e1410', '#3a2a20', '#0c0806', 'bun', 0x8a2a3a, 0x24252b) },
  { id: 'w2', name: 'Keisha', age: 31, hood: 'Crown Heights', open: false, bio: 'no broke men. no men with "projects." no men.',
    look: L('#7a4a30', '#1a120c', '#36261a', '#0a0604', 'dread', 0x3a5a3a, 0x2a2c30, { longSleeves: true }) },
  { id: 'w3', name: 'Priya', age: 30, hood: 'Jackson Heights', open: false, bio: 'nurse. 12 hour shifts. do not waste my 4 free minutes.',
    look: L('#9a6a4a', '#120c0a', '#2a201a', '#060403', 'bun', 0x2e5a6a, 0x2a2c34) },
  { id: 'w4', name: 'Kim', age: 27, hood: 'Flushing', open: false, bio: 'fluent in sarcasm. allergic to cheap dates.',
    look: L('#e0c0a4', '#0e0c0c', '#262222', '#050404', 'bun', 0xd8d4cc, 0x30343e) },
  { id: 'w5', name: 'Grace', age: 26, hood: 'Astoria', open: true, bio: 'i work nights. i am up at 2am. that is a hint.',
    look: L('#dcc2a2', '#0c0a0c', '#262226', '#040304', 'shag', 0x19191c, 0x24252b, { longSleeves: true, hairLen: 1.2 }) },
  { id: 'w6', name: 'Gina', age: 35, hood: 'Bensonhurst', open: true, bio: 'divorced. thriving. not doing dinners. ask me what i AM doing.',
    look: L('#c4967a', '#2a1a10', '#4a3020', '#140c06', 'curls', 0x7a2a3a, 0x2a2c34) },
  { id: 'w7', name: 'Danielle', age: 32, hood: 'Flatbush', open: false, bio: 'want someone who has their life together (be honest)',
    look: L('#9a6a48', '#120c0a', '#2a201a', '#060403', 'shoulder', 0xd0c8b8, 0x3a3a44, { hairLen: 1.35 }) },
  { id: 'w8', name: 'Tasha', age: 28, hood: 'Bed-Stuy', open: false, bio: 'if you can\'t cook don\'t message me',
    look: L('#5e3a26', '#0e0a08', '#2a201a', '#040302', 'braids', 0xd8d4cc, 0x2a2c34) },
  { id: 'w9', name: 'Lisa', age: 34, hood: 'Chinatown', open: false, bio: 'looking for my future husband (has dental)',
    look: L('#d6b496', '#0e0c0c', '#262222', '#050404', 'bun', 0x5a4a78, 0x2e3238, { longSleeves: true }) },
  { id: 'w10', name: 'Yolanda', age: 38, hood: 'Harlem', open: false, bio: 'my ex is on this app. hi derek.',
    look: L('#5a3622', '#141a2a', '#26304a', '#0a0e18', 'crop', 0xa85a2a, 0x2a2c30) },
  { id: 'w11', name: 'Nicole', age: 31, hood: 'Williamsburg', open: true, bio: 'bartender. bad decisions after 2am are my cardio.',
    look: L('#d0a88e', '#2a1a12', '#4a3020', '#140c08', 'shoulder', 0xd8d4cc, 0x3a4a66, { hairLen: 1.3 }) },
  { id: 'w12', name: 'Carmen', age: 29, hood: 'the Bronx', open: false, bio: 'looking for a man with a car AND a plan',
    look: L('#a8724e', '#1e140c', '#3e2a1a', '#0c0806', 'curls', 0x2e5a6a, 0x24252b) },
  { id: 'w13', name: 'Mei', age: 25, hood: 'Sunset Park', open: false, bio: 'if your pics are in a bathroom mirror, keep scrolling',
    look: L('#e6ceb2', '#0c0a0a', '#242020', '#040303', 'shag', 0x4a4e44, 0x2a2c30, { hairLen: 1.45 }) },
  { id: 'w14', name: 'Angela', age: 33, hood: 'Elmhurst', open: false, bio: 'gemini. that is the whole bio.',
    look: L('#c8a07e', '#0c0a0a', '#242020', '#040303', 'shoulder', 0xd8d4cc, 0x30343e, { hairLen: 1.35 }) },
  { id: 'w15', name: 'Rosa', age: 30, hood: 'Bushwick', open: false, bio: 'abuela says i am too picky. abuela is right. still no.',
    look: L('#9e6c48', '#120c0a', '#2a201a', '#060403', 'bun', 0x3a5a3a, 0x2a2c34) },
  { id: 'w16', name: 'Dana', age: 36, hood: 'Bay Ridge', open: true, bio: 'just moved here. do not know anyone. let\'s fix that, once.',
    look: L('#e0c0aa', '#b08a4a', '#d4ae6a', '#7a5a2a', 'shoulder', 0x8a2a3a, 0x3a4a66, { hairLen: 0.95 }) },
  { id: 'w17', name: 'Monique', age: 27, hood: 'East New York', open: false, bio: '6ft or don\'t bother. i am 5\'1.',
    look: L('#5e3a26', '#0e0a08', '#2a201a', '#040302', 'knots', 0xa85a2a, 0x24252b) },
  { id: 'w18', name: 'Brianna', age: 24, hood: 'Washington Heights', open: true, bio: 'too young for you probably. say something that makes me wrong.',
    look: L('#a8784e', '#0e0a08', '#2a201a', '#040302', 'shoulder', 0x19191c, 0x2a2c30, { hairLen: 1.4 }) },
  { id: 'w19', name: 'Shanice', age: 29, hood: 'Red Hook', open: false, bio: '"you look like you owe somebody money" is what i will say. so.',
    look: L('#8e5434', '#0e0a08', '#2a201a', '#040302', 'shoulder', 0x2e3a4a, 0x24252b, { hairLen: 1.45, longSleeves: true }) },
];

export const STRANGER_BY_ID = Object.fromEntries(STRANGERS.map((w) => [w.id, w]));
export const isStranger = (kind) => !!STRANGER_BY_ID[kind];
