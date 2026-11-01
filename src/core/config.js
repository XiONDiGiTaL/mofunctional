/**
 * MO: FUNCTIONAL — CONFIG
 * Every tunable balance value lives here. Gameplay code must never hardcode
 * costs, rates, wages or thresholds; read them from CONFIG instead.
 */

export const CONFIG = {
  meta: {
    title: 'MO: FUNCTIONAL',
    version: '0.9.0-m1',
    tagline: "You don't have to get your life together. You just have to keep it together.",
    repo: 'https://github.com/XiONDiTaL/mofunctional',
    contentNote: 'Fictional substances only. No real-world consumption detail.',
  },

  save: { key: 'mofunctional.save.v2', slots: 3, autosaveMinutes: 60 },

  time: {
    startMinutes: 7 * 60,       // 07:00 on Day 1
    dayMinutes: 1440,
    targetDays: 30,             // survive this long to reach a daytime ending
    speeds: [0, 2.0, 4.5, 9.0], // in-game minutes per real second; index = HUD speed
    defaultSpeed: 1,
    summaryAtHour: 3,           // daily report shown at 03:00
    maxAwakeHoursBeforeCollapse: 26,
  },

  needs: {
    energy: { awake: 3.4, working: 6.2, sleeping: -13.0 }, // per in-game hour
    hunger: { awake: 3.0, working: 4.2, sleeping: 1.7 },
    hygiene: { awake: 1.3, working: 2.2, sleeping: 0.3 },
    stress: {
      base: 1.15,
      perMissingEnergy: 0.035,
      perMissingHunger: 0.04,
      perMissingHygiene: 0.022,
      working: 3.1,
      soberRelief: 0.55,        // per hour when needs are met and obedience is high
      lowMoney: 0.9,            // per hour when broke & overdue
    },
    morale: {
      base: -0.85,
      lowStress: 0.45,
      lowFunds: -0.6,
      working: -0.5,
      bed: 0,
    },
    thresholds: { starve: 0, collapse: 0, highStress: 85 },
  },

  substances: {
    // 100% fictional compounds. Mechanics only — no real-world instructions.
    note: 'BLISS, STATIC, MUD and DRIP are invented substances that exist only in this game.',
    types: {
      bliss: {
        id: 'bliss', name: 'Bliss Vial', price: 35, addiction: 11, risk: 9,
        tolerance: 4, effects: { energy: 18, hunger: -6, morale: 16, stress: -17, hygiene: -3 },
        flavor: 'The expensive kind of bad idea.',
      },
      static: {
        id: 'static', name: 'Static (pills)', price: 22, addiction: 8, risk: 7,
        tolerance: 3, effects: { energy: 26, hunger: -9, morale: 6, stress: 5, hygiene: -4 },
        flavor: 'Turns the lights on with somebody else\'s electricity.',
      },
      mud: {
        id: 'mud', name: 'Mud', price: 18, addiction: 9, risk: 10,
        tolerance: 4, effects: { energy: -8, hunger: -8, morale: 10, stress: -24, hygiene: -5 },
        flavor: 'A blanket that costs money.',
      },
      drip: {
        id: 'drip', name: 'Drip (cut)', price: 9, addiction: 6, risk: 17,
        tolerance: 2, effects: { energy: 6, hunger: -10, morale: 2, stress: -6, hygiene: -6 },
        flavor: 'Mostly powdered headache with a hint of regret.',
      },
    },
    highDurationMinutes: 150,
    highEnergyBonus: 8,
    // How each invented substance is taken, for the on-screen use animation. Never real
    // instructions: these are the game's own props (a vial, two pills, a pipe, a dropper).
    useAnim: { bliss: 'vial', static: 'pill', mud: 'pipe', drip: 'drop' },
    useDurationSeconds: { vial: 3.2, pill: 3.6, pipe: 4.2, drop: 3.0 },
    withdrawal: {
      startsAfterMinutes: 10 * 60,
      toleranceHours: 0.35,      // withdrawal starts later as tolerance grows
      riskPerHour: 0.9,
      moralePerHour: -2.4,
      stressPerHour: 2.6,
      energyPerHour: -1.8,
      shakesAt: 35,              // withdrawal level that makes movement wobble
      collapseAt: 92,
    },
    risk: {
      decayHealthy: 1.15,        // per hour while rested + fed + clean
      decayPoor: 0.25,
      riseWithdrawal: 0.55,      // per hour when withdrawal is high & addicted
      neglectRise: 0.5,          // per hour with hunger or energy at zero
      overdoseAt: 100,
      hospitalAt: 76,            // a scare converts into money loss + ending check
    },
    toleranceEffects: { riskMultiplierPerPoint: 0.012, effectCutPerPoint: 0.006 },
  },

  items: {
    ramen:   { id: 'ramen',   name: 'Instant Ramen',  kind: 'food', price: 1.4, hunger: 18, energy: 2,  morale: -1, hygiene: 0,  value: 0.5 },
    beans:   { id: 'beans',   name: 'Can of Beans',   kind: 'food', price: 2.2, hunger: 27, energy: 4,  morale: -2, hygiene: 0,  value: 0.8 },
    eggs:    { id: 'eggs',    name: 'Half-Dozen Eggs', kind: 'food', price: 3.5, hunger: 30, energy: 8, morale: 3,  hygiene: 0,  value: 1.5 },
    sandwich:{ id: 'sandwich',name: 'Bodega Sandwich', kind: 'food', price: 5.5, hunger: 36, energy: 6, morale: 5,  hygiene: 0,  value: 2 },
    bar:     { id: 'bar',     name: 'Protein Brick',  kind: 'food', price: 2.8, hunger: 15, energy: 12, morale: 0,  hygiene: 0,  value: 1 },
    cereal:  { id: 'cereal',  name: 'Off-Brand Cereal', kind: 'food', price: 3.2, hunger: 24, energy: 5, morale: 1,  hygiene: 0,  value: 1.2 },
    // ---- Bodega and Habib's stock. Same neighbourhood, two different counters.
    bec:          { id: 'bec',          name: 'Bacon, Egg & Cheese', kind: 'food', price: 4.5, hunger: 44, energy: 16, morale: 7, hygiene: 0, value: 2.0, hot: true },
    chopped:      { id: 'chopped',      name: 'Chopped Cheese', kind: 'food', price: 6.5, hunger: 58, energy: 22, morale: 11, hygiene: 0, value: 2.8, hot: true },
    hero:         { id: 'hero',         name: 'Bodega Hero', kind: 'food', price: 5.0, hunger: 40, energy: 12, morale: 6, hygiene: 0, value: 2.2 },
    loosies:      { id: 'loosies',      name: 'Loosies (2)', kind: 'comfort', price: 1.5, stress: -9, energy: -2, value: 0.4 },
    tallboy:      { id: 'tallboy',      name: 'Tall Boy', kind: 'comfort', price: 2.75, stress: -12, morale: 5, energy: -3, hygiene: -1, value: 0.5 },
    falafel:      { id: 'falafel',      name: 'Falafel Wrap', kind: 'food', price: 4.0, hunger: 36, energy: 14, morale: 6, hygiene: 0, value: 1.8 },
    halal_plate:  { id: 'halal_plate',  name: 'Halal Combo Plate', kind: 'food', price: 10.5, hunger: 62, energy: 27, morale: 9, hygiene: 0, value: 4.0, hot: true },
    chicken_rice: { id: 'chicken_rice', name: 'Chicken Over Rice', kind: 'food', price: 9.5, hunger: 60, energy: 26, morale: 8, hygiene: 0, value: 3.5, hot: true },
    lentil:       { id: 'lentil',       name: 'Lentil Soup', kind: 'food', price: 3.5, hunger: 30, energy: 10, morale: 4, hygiene: 0, value: 1.2, hot: true },
    baklava:      { id: 'baklava',      name: 'Baklava', kind: 'food', price: 2.5, hunger: 14, energy: 6, morale: 8, hygiene: 0, value: 1.0 },
    mint_tea:     { id: 'mint_tea',     name: 'Mint Tea', kind: 'comfort', price: 1.5, stress: -5, morale: 3, value: 0.4 },
    coffee:       { id: 'coffee',       name: 'Quik-Stop Coffee', kind: 'comfort', price: 1.25, energy: 9, stress: 2, morale: 1, value: 0.2 },
    bliss:   { id: 'bliss',   name: 'Bliss Vial',     kind: 'substance', price: 35, value: 12 },
    static:  { id: 'static',  name: 'Static (pills)', kind: 'substance', price: 22, value: 8 },
    mud:     { id: 'mud',     name: 'Mud',            kind: 'substance', price: 18, value: 6 },
    drip:    { id: 'drip',    name: 'Drip (cut)',     kind: 'substance', price: 9,  value: 3 },
    tv:      { id: 'tv',      name: '22" CRT Television', kind: 'valuable', value: 95,  weight: 5 },
    guitar:  { id: 'guitar',  name: 'Bolt-On Guitar', kind: 'valuable', value: 150, weight: 4 },
    watch:   { id: 'watch',   name: "Grandad's Watch", kind: 'valuable', value: 60,  weight: 1 },
    ring:    { id: 'ring',    name: 'Silver Ring',    kind: 'valuable', value: 130, weight: 1 },
    console: { id: 'console', name: 'Region-Locked Console', kind: 'valuable', value: 70, weight: 3 },
    jacket:  { id: 'jacket',  name: 'Faux-Leather Jacket', kind: 'valuable', value: 45, weight: 2 },
    tools:   { id: 'tools',   name: 'Borrowed Toolbox', kind: 'valuable', value: 55, weight: 4 },
    id_card: { id: 'id_card', name: 'State ID (expired-ish)', kind: 'doc', value: 0 },
    lease:   { id: 'lease',   name: 'Lease — Unit 3B', kind: 'doc', value: 0 },
    grab_bag:{ id: 'grab_bag',name: 'Grab Bag',       kind: 'mystery', price: 20, value: 20 },
    // ---- gifts. Kinds are 'gift' (given, not eaten) or 'valuable' (Diana's better presents).
    flowers:      { id: 'flowers',      name: 'Bodega Flowers', kind: 'gift', price: 9, value: 4, morale: 3 },
    chocolates:   { id: 'chocolates',   name: 'Chocolate Box',  kind: 'gift', price: 7, value: 3, morale: 4 },
    mixtape:      { id: 'mixtape',      name: 'Handmade Mixtape', kind: 'gift', price: 0, value: 2 },
    candle:       { id: 'candle',       name: 'Scented Candle', kind: 'gift', price: 6, value: 3, morale: 2 },
    breath_mints: { id: 'breath_mints', name: 'Roll of Mints',  kind: 'gift', price: 2, value: 1 },
    soup_can:     { id: 'soup_can',     name: 'Good Soup',      kind: 'gift', price: 4, value: 2, hunger: 12 },
    batteries:    { id: 'batteries',    name: 'Pack of Batteries', kind: 'gift', price: 5, value: 2 },
    necklace:     { id: 'necklace',     name: 'Thin Gold Necklace', kind: 'valuable', value: 120 },
    perfume:      { id: 'perfume',      name: 'Small Perfume',  kind: 'valuable', value: 65 },
  },

  bidbay: {
    seller: 'BidBay',
    listingMinutes: [420, 1560],   // how long a listing runs before resolving
    fee: 0,
    greedyFactor: 1.35,            // price above market*this rarely sells
    undercutFactor: 0.75,          // price below market*this sells fast
    shillChance: 0.12,             // fake bid that extends the listing
    deliveryMinutes: 30,           // grab bag delivery
  },

  job: {
    employer: 'Quik-Stop #14',
    title: 'Night Stock Associate',
    wage: 11.5,
    shiftStart: 9 * 60,
    shiftEnd: 17 * 60,
    days: [1, 2, 3, 4, 5],         // 1 = Monday
    lateGraceMinutes: 30,
    maxStrikes: 3,
    transportCost: 6,
    breakMinutes: 30,
    callOutMinutes: 10,
  },

  oddJobs: [
    { id: 'moving', name: 'Moving Gig — Rae\'s Storage', hours: 4, pay: 74, energy: 22, hygiene: 18, stress: 16, morale: -4, minEnergy: 25, blurb: 'Carry a stranger\'s life up three flights.' },
    { id: 'dishpit', name: 'Dish Pit — The Pit', hours: 3, pay: 47, energy: 16, hygiene: 26, stress: 12, morale: -6, minEnergy: 18, blurb: 'Steam, grease, and a radio stuck on one station.' },
    { id: 'flyers', name: 'Flyer Run', hours: 2, pay: 26, energy: 12, hygiene: 8, stress: 6, morale: -3, minEnergy: 12, blurb: 'Put 400 pieces of paper on 400 windshields.' },
    { id: 'sign', name: 'Sign Spinner — Grand Opening', hours: 2, pay: 22, energy: 10, hygiene: 4, stress: 10, morale: -8, minEnergy: 10, blurb: 'Dance for a mattress store. In daylight. Where people can see you.' },
    { id: 'catsit', name: 'Cat Sitting — Mrs. Vell', hours: 3, pay: 38, energy: 6, hygiene: 2, stress: -8, morale: 8, minEnergy: 5, blurb: 'The cat is named Chairman. He has opinions.' },
  ],

  economy: {
    startMoney: 212.4,
    rent: { id: 'rent', name: 'Rent — Unit 3B', amount: 420, periodDays: 7, firstDueDay: 7 },
    power: { id: 'power', name: 'Municipal Power', amount: 64, periodDays: 14, firstDueDay: 5 },
    phone: { id: 'phone', name: 'Shale Mobile', amount: 35, periodDays: 7, firstDueDay: 4 },
    evictionAfterMissedCycles: 2,
    powerCutAfterMissedCycles: 1,
    crp: { name: 'Civic Relief Program', weeklyCredit: 95, recertMinutes: 45, recertDays: 7, cashGrant: 0, minDocRequired: ['id_card', 'lease'] },
    utilityGrant: { name: 'Emergency Utility Relief', amount: 64, once: true },
    sleepCostPerHourEnergy: 1,
  },

  fellowship: {
    name: 'The Golden Fellowship',
    leader: 'Addison Octavius',
    allowance: 55,
    titheRate: 0.10,
    serviceMinutes: 150,
    serviceStart: 11 * 60,        // Sunday
    serviceDay: 0,                // 0 = Sunday
    stages: [
      { id: 0, label: 'Stranger', note: 'You have not been invited yet.' },
      { id: 1, label: 'Invited', note: 'A pamphlet is burning a hole in your pocket.' },
      { id: 2, label: 'Attendee', note: 'You attend services. There is an allowance.' },
      { id: 3, label: 'Tither', note: 'A tenth of everything, and a smile.' },
      { id: 4, label: 'Inner Circle', note: 'They know your name. They say it a lot.' },
      { id: 5, label: 'Signed', note: 'The pledge. The end of the sentence.' },
    ],
    recruitChancePerVisit: 0.5,
  },

  social: {
    postMinutes: 10,
    postMorale: 4,
    postFollowers: [1, 4],
    backlashChance: 0.28,
    backlashMorale: -7,
    donationChance: 0.10,
    donationAmount: 12,
  },

  events: {
    minMinutesBetween: 95,
    chancePerHour: 0.42,
    maxPerDay: 3,
  },

  /* ------------------------------------------------------------------ rent */
  /** Early rent: one cycle may be paid ahead, and a live-in partner's share is applied once. */
  rent: {
    payAheadCycles: 1,          // how many future cycles may be settled in advance
    historyLimit: 16,
  },

  /* -------------------------------------------------- romantic characters */
  /**
   * Stephanie, Melanie and Diana: three adults in the neighbourhood, three personalities, three
   * ways of living in the same one-bedroom. Nothing here is explicit; the interface stays a
   * dark comedy about time, money and people.
   *
   * rentShare is the only place a partner's rent contribution is expressed. It is read once,
   * by economy.rentPerCycle(), and can never stack: only one partner can be live-in.
   */
  partners: {
    stephanie: {
      id: 'stephanie', name: 'Stephanie', short: 'STEPH', age: 31,
      rentShare: 0.15, difficulty: 0.34,
      blurb: 'Relaxed, low-maintenance, allergic to plans. Dates are easy; the fridge empties.',
      likes: ['park', 'coffee', 'walk'], dislikes: ['dinner'],
      chat: [
        '"Honestly? I was going to stay in tonight, and now I am outside. That is basically my whole personality."',
        '"You overthink things. I can tell because you are doing it right now, at me."',
        '"I do not need a plan. I need a bench and somebody who does not narrate the weather."',
      ],
      flirt: { base: 62, low: '"You are cute when you are nervous. You are nervous a lot, huh?"', gift: 'He arts and crafts. A mixtape, a note, half a bagel.' },
      giftPool: ['mixtape', 'chocolates', 'flowers', 'breath_mints'],
      giftNote: 'She leaves it on the counter with a drawing on the bag.',
      household: { eatsFood: 2, restocks: 0, sells: 0, giftChance: 0.14 },
      moveInLine: '"Fine. But I am not folding anything, and your TV is mine now."',
      cheekLine: '"Come on. Bring the good blanket."',
    },
    melanie: {
      id: 'melanie', name: 'Melanie', short: 'MEL', age: 34,
      rentShare: 0.25, difficulty: 0.55,
      blurb: 'Warm, funny, particular. She notices when you tried and when you did not.',
      likes: ['coffee', 'movie', 'park', 'dinner'], dislikes: ['walk'],
      chat: [
        '"I had a whole speech about how I am not looking for anything. Then you knocked on the door with a coffee."',
        '"You do the thing where you disappear for two days and then act normal. I clocked it."',
        '"Listen. I like you. That is not a small thing for me, so do not make it weird."',
      ],
      flirt: { base: 48, low: '"That was almost charming. Almost is a B-minus, so."', gift: 'She brings something useful: a can opener, batteries, soup.' },
      giftPool: ['soup_can', 'batteries', 'candle', 'chocolates'],
      giftNote: 'She says it was on sale. It was not on sale.',
      household: { eatsFood: 1, restocks: 0, sells: 0, giftChance: 0.24 },
      moveInLine: '"Three drawers. I am serious about the three drawers."',
      cheekLine: '"Stay. Do not say anything clever about it."',
    },
    diana: {
      id: 'diana', name: 'Diana', short: 'DI', age: 36,
      rentShare: 0.5, difficulty: 0.82,
      blurb: 'Independent, exacting, generous once you have earned it. She does not do half-measures.',
      likes: ['dinner', 'movie', 'park'], dislikes: ['coffee'],
      chat: [
        '"I am not hard to please. I am hard to convince. There is a difference and it is that one takes effort."',
        '"You cancelled. I am not upset. I am filing it, because I pay attention to patterns."',
        '"If we are doing this, we are doing it properly. That is the only version of me that shows up."',
      ],
      flirt: { base: 34, low: '"Flattery is a first draft. Come back with the real thing."', gift: 'She sells a watch she never wore and puts the cash in the rent envelope.' },
      giftPool: ['necklace', 'perfume', 'flowers', 'watch'],
      giftNote: 'She wraps things properly. It is very annoying and very nice.',
      household: { eatsFood: 0, restocks: 2, sells: 0.2, giftChance: 0.32 },
      moveInLine: '"I will pay half. I will not be a guest in a place I live in."',
      cheekLine: '"Come here. And put the phone down, for once."',
    },
  },

  romance: {
    flirtCooldownMinutes: 120,        // you cannot work a room in one afternoon
    chatMinutes: 10,
    giftCostMinutes: 25,
    dateMinutes: 20,                  // the walk/get-ready time around the activity
    girlfriendDates: 3,               // completed successful dates before she is asked
    girlfriendAffection: 40,
    moveInDays: 7,
    moveInAffection: 55,
    cheekAffection: { stephanie: 42, melanie: 58, diana: 72 },
    cheekCooldownMinutes: 24 * 60,
    afterglowHours: 24,
    giftCooldownDays: 3,
    activities: {
      coffee: { id: 'coffee', name: 'Coffee at the bodega', where: 'bodega', cost: 6, minutes: 45, affection: 9, morale: 5, stress: -3, energy: -2 },
      dinner: { id: 'dinner', name: 'Dinner at Habib\'s', where: 'habibs', cost: 28, minutes: 90, affection: 16, morale: 10, stress: -6, energy: 4 },
      park: { id: 'park', name: 'An afternoon in the park', where: 'park', cost: 0, minutes: 75, affection: 12, morale: 9, stress: -9, energy: 3 },
      walk: { id: 'walk', name: 'A walk down Kestrel Street', where: 'street', cost: 0, minutes: 40, affection: 7, morale: 5, stress: -5, energy: -1 },
      movie: { id: 'movie', name: 'A movie at home', where: 'apartment', cost: 4, minutes: 110, affection: 13, morale: 8, stress: -7, energy: -3 },
    },
  },

  /* --------------------------------------------------------------- clinic */
  clinic: {
    name: 'Kestrel Clinic',
    nurse: 'Nurse Okafor',
    treatment: { cost: 60, minutes: 90, risk: -22, withdrawal: -30, addiction: -4, morale: 3, stress: -10 },
    checkIn: { minutes: 10, risk: -4, withdrawal: -10, morale: 5, stress: -6 },
    collapse: {
      collapsesBeforeClinic: 2,   // after this many, they take him in rather than leave him home
      chance: 0.5,                // otherwise it is a coin toss once he is past the first
      feeIfBroke: 40,             // added to hospital debt when he cannot pay cash
      hoursLost: 7,
      lockHours: 5,               // no collapse again straight away (stops the loop)
    },
    // The outpatient course: the slow way down. Several paid appointments, days apart, inside
    // clinic hours — which overlap Quik-Stop shifts, so recovery competes with work for the day.
    program: {
      sessions: 5,
      everyDays: 2,               // one appointment every other day
      window: [10 * 60, 16 * 60], // appointments are 10:00-16:00 at the clinic
      minutes: 120,
      cost: 35,                   // per session; on the hospital bill if he cannot pay
      perSession: { addiction: -6, withdrawal: -25, risk: -8, stress: -8, morale: 4 },
      relapseFactor: 0.5,         // the session after a relapse does half as much
      graceDays: 1,               // a day late is still the same appointment
      missAllowance: 1,           // one missed appointment is forgiven; the next drops him
      reenrollDays: 3,            // after dropping out, how long before they take him back
      completion: { addiction: -10, tolerance: -2, morale: 15, stress: -10 },
      eligibleDependence: 30,     // without a referral, this much dependence gets him in
    },
  },

  /* ----------------------------------------------------------- park + social */
  park: {
    name: 'Kestrel Park',
    danceMinutes: 25,
    danceMorale: 9,
    danceStress: -8,
    sitMinutes: 30,
    sitMorale: 6,
    hoopsMinutes: 45,
    hoopsMorale: 11,
    chessMinutes: 40,
    chessMorale: 7,
    musicMinutes: 20,
    musicMorale: 8,
    meetChance: 0.34,             // a friend is around, some of the time
  },

  /* ------------------------------------------------------------- debug menu */
  debug: {
    password: 'Moses',
    moneyPerClick: 1000,
  },

  render: {
    internalHeight: 336,
    fogNear: 4.5,
    fogFar: 30,
    wobble: 0.6,
    snapGrid: 170,
    dither: 0.4,
    ambient: 0.88,
    lightDir: [-0.55, 0.72, 0.46],
    colors: { fog: 0x121d18, sky: 0x141d19 },
  },

  audio: { musicVolume: 0.62, sfxVolume: 0.5 },
};

export const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
