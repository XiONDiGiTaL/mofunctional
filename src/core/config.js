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
      // Dex's stock, and nobody else's: uncut. More effect for the money than anything Rolo sells,
      // much more risk and dependence, and sometimes a bad batch. Only in the alley, only at night.
      bliss_x: {
        id: 'bliss_x', name: 'Uncut Bliss', price: 46, addiction: 15, risk: 16, dexOnly: true, badBatch: 0.15,
        tolerance: 5, effects: { energy: 29, hunger: -9, morale: 26, stress: -27, hygiene: -5 },
        flavor: 'What Bliss is before somebody makes it safe enough to sell.',
      },
      static_x: {
        id: 'static_x', name: 'Static (double-stack)', price: 29, addiction: 11, risk: 13, dexOnly: true, badBatch: 0.15,
        tolerance: 4, effects: { energy: 42, hunger: -14, morale: 10, stress: 8, hygiene: -6 },
        flavor: 'Two lightning bolts pressed into one pill. Your heart counts both.',
      },
      mud_x: {
        id: 'mud_x', name: 'Black Mud', price: 24, addiction: 12, risk: 18, dexOnly: true, badBatch: 0.15,
        tolerance: 5, effects: { energy: -13, hunger: -13, morale: 16, stress: -38, hygiene: -8 },
        flavor: 'The heavy blanket. Hard to get out from under.',
      },
      drip_x: {
        id: 'drip_x', name: 'Drip (pure)', price: 12, addiction: 8, risk: 30, dexOnly: true, badBatch: 0.15,
        tolerance: 3, effects: { energy: 10, hunger: -16, morale: 3, stress: -10, hygiene: -9 },
        flavor: 'Cheap because the risk is the price.',
      },
    },
    // a bad batch from Dex: on top of the dose
    badBatch: { risk: 12, stress: 10, morale: -6 },
    highDurationMinutes: 150,
    highEnergyBonus: 8,
    // How each invented substance is taken, for the on-screen use animation. Never real
    // instructions: these are the game's own props (a vial, two pills, a pipe, a dropper).
    useAnim: { bliss: 'vial', static: 'pill', mud: 'pipe', drip: 'drop', bliss_x: 'vial', static_x: 'pill', mud_x: 'pipe', drip_x: 'drop' },
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
    // Nia's cooking, left behind when he missed her or did not eat: still the best thing in the fridge
    nia_meal:{ id: 'nia_meal',name: "Nia's Arroz con Pollo", kind: 'food', price: 0, hunger: 48, energy: 24, morale: 10, hygiene: 0, stress: -8, value: 0 },
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
    bliss_x: { id: 'bliss_x', name: 'Uncut Bliss',            kind: 'substance', price: 46, value: 16 },
    static_x:{ id: 'static_x',name: 'Static (double-stack)',  kind: 'substance', price: 29, value: 10 },
    mud_x:   { id: 'mud_x',   name: 'Black Mud',              kind: 'substance', price: 24, value: 8 },
    drip_x:  { id: 'drip_x',  name: 'Drip (pure)',            kind: 'substance', price: 12, value: 4 },
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
    // The extortion, and the cure that comes with it. The deeper Mo goes, the more Addison takes
    // (the tithe on everything he earns rises with his stage) and the less Mo uses: the schedule,
    // the watching and the people do what the clinic does, at a price. Going all the way in ends
    // the game — clean, housed, employed, more than functional, and no longer his own.
    titheByStage: { 3: 0.10, 4: 0.20 },
    recovery: {
      perService: { 2: { addiction: -4, withdrawal: -15 }, 3: { addiction: -6, withdrawal: -20, tolerance: -1 }, 4: { addiction: -9, withdrawal: -25, tolerance: -1 } },
      dailyWithdrawal: { 3: -6, 4: -10 },   // the routine itself, every day once he tithes
    },
  },

  // FeedLove's HEARTS tab (systems/dating.js): most strangers say no; the three answer
  dating: {
    strangersPerDay: 7,
    heartsPerDay: 10,
    heartMinutes: 4,
    strangerGhostChance: 7,     // percent: a "match" that never writes back
    partnerShowChance: 0.55,    // each of the three, per day, until matched
    matchAffection: 6,
    names: ['Tasha', 'Marisol', 'Jen', 'Keisha', 'Danielle', 'Yolanda', 'Brianna', 'Nicole', 'Carmen', 'Lisa', 'Monique', 'Gina', 'Tiffany', 'Rosa', 'Kim', 'Angela', 'Shanice', 'Dana'],
    hoods: ['Bed-Stuy', 'Bushwick', 'Crown Heights', 'Flatbush', 'Sunset Park', 'the Bronx', 'Jackson Heights', 'Astoria', 'Harlem', 'Red Hook'],
    bios: [
      'looking for a man with a car AND a plan',
      'no broke men. no men with "projects." no men.',
      "if you can't cook don't message me",
      'fluent in sarcasm. allergic to cheap dates.',
      'just here to see who from high school got fat',
      "6ft or don't bother. i am 5'1.",
      'my ex is in this app. hi derek.',
      'want someone who has their life together (be honest)',
      'gemini. that is the whole bio.',
      'nurse. 12 hour shifts. do not waste my 4 free minutes.',
      'looking for my future husband (has dental)',
      'if your pics are in a bathroom mirror, keep scrolling',
    ],
    tints: ['#c86a8a', '#7a6ac8', '#c8a06a', '#6ac8a8', '#c86a6a', '#6a9ac8'],
    // the few app women who are not looking for a boyfriend (core/strangers.js `open`)
    hookup: {
      matchChance: 45,        // percent, on a heart, for an open one
      fromHour: 22, toHour: 3,
      cooldownDays: 3,
      minEnergy: 20,
      flakeChance: 0.15,
      runInNumberChance: 0.5,   // an open one met on the block gives him her number
      minutes: 180,
      morale: 14, stress: -12, energy: -10, hygiene: -10,
      caughtChance: 0.3, caughtAffection: 25,
      openers: [
        'ok you are funny looking in a way i am into. that is all you get.',
        'i do not date. i do not do brunch. i do sometimes do this.',
        'you look like trouble that knows how to leave in the morning.',
        'one rule: do not fall in love with me. you will want to. do not.',
      ],
      flakeLines: [
        'something came up. something being my ex. sorry not sorry',
        'actually never mind. delete my number',
        'my roommate says you look like a cop. not risking it',
      ],
      nightLines: [
        'Her apartment is a fourth-floor walk-up with a radiator worse than yours, which feels like a sign.',
        'She has a cat that watches the entire time. Not the entire time. The door closes on the cat.',
        'She puts on a record before she says anything. It is a good record. You do not ask what it is.',
        'She lives above a laundromat. Everything smells like dryer sheets and decisions.',
      ],
    },
    // app women who turn up on the block: how many a day, and for how long
    runInsPerDay: 3,
    runInMinutes: 90,
    rejectLines: [
      '"lol no"',
      'She unmatched you before the heart finished animating.',
      '"do you have a car?" You do not. She does not ask anything else.',
      'Left on read. Read at 1:14 AM. Read again at 1:16.',
      '"is that a Quik-Stop vest in your pic"',
      "Her friend replied for her: \"she's good thanks\"",
      '"my cousin dated you. no."',
      'Your heart was "received." That is all you will ever know.',
      '"you look like you owe somebody money" — accurate, unkind.',
      "\"maybe if you smiled in a photo that wasn't a mugshot angle\"",
    ],
    ghostLines: [
      'A match! She said "hey". You said "hey". She was never heard from again.',
      'A match. Three messages in, she asks if you have a brother. You do not. Silence.',
      'Match. She sends a link to a pyramid scheme. You decline. She unmatches.',
    ],
    partnerHood: { stephanie: 'Kestrel St.', melanie: 'Kestrel St.', diana: 'Park Slope' },
    partnerBio: {
      stephanie: 'no plans, no problem. bench > restaurant. say something funny.',
      melanie: "teacher. likes effort. likes the park on a good day. will notice if you're late.",
      diana: 'independent. busy. consistent men only. impress me with a plan, not a pickup line.',
    },
    partnerOpener: {
      stephanie: "ok you're funny looking in a good way. hi",
      melanie: 'you hearted me at 2am. bold. hi.',
      diana: 'I read your profile twice. Once to laugh and once to decide. Hello, Mo.',
    },
  },

  // the B44 out on Ashby: the bus stop on Kestrel goes somewhere now
  transit: {
    fare: 1.5,
    wait: [4, 22],          // minutes, and it is always closer to the second number
    ride: 14,
    walk: 45,               // or walk it: free, slow, tiring
    walkEnergy: -8,
  },

  // 1104 Kestrel, the walk-up next door
  walkup: {
    stairMinutes: 3,
    stairEnergy: -2,
    squeakMarkup: 1.25,     // the hallway costs extra
    squeakStock: [2, 4],
  },

  // what a night with a stranger can leave behind
  health: {
    clapChance: 0.16,          // per hookup; double with the risky ones
    clapCureCost: 45,
    clapDrainPerHour: { energy: -0.7, morale: -0.9, stress: 0.5 },
    postBackfire: 0.45,
  },

  // TradeHarder: stocks and property
  market: {
    fee: 1,
    listingCost: 200,
  },

  // trouble after dark
  fights: {
    fromHour: 23, toHour: 4,
    chancePerCheck: 0.22,      // a check every ~40 s of play somewhere dangerous
    cooldownHours: 30,
    thugHits: 3,
    hitEnergy: 18,
    payOffShare: 0.25,
    robCashShare: [0.3, 0.6],
  },

  // Amazin', the online store
  shop: {
    markup: 2.1,
    shipping: 4.99,
  },

  // HailMary, the car service: "a ride and a prayer"
  rides: {
    base: 7,
    crossTown: 9,          // on top of the base when it is another neighbourhood
    stopFee: 3,            // what he charges to refuse a ride up the block
    cancelFee: 5,
    eta: [4, 10],
    waitMinutes: 15,
    minutes: 14,
    drivers: ['Vinnie', 'Sal\'s cousin Vinnie', 'a man named Dutch', 'Ozzie', 'Big Ray (not 2A Ray)'],
    pushback: [
      '"It\'s up the road, idiot. Just walk."',
      '"Chief. CHIEF. I can SEE it from here. Get out of my car."',
      '"You want me to drive you forty feet? My meter laughs at you."',
      '"Walk. It\'s good for you. Look at you. Walk."',
    ],
    rideLines: [
      'Vinnie takes a route that is definitely not the fastest and tells you about his ex-wife the whole way.',
      'The radio plays the same ballgame you could hear from the curb. The Mets are losing. The driver is furious about it.',
      'He runs one yellow, then another, then says "that was orange" with total confidence.',
      'Twelve minutes of silence, a pine tree air freshener and the city sliding past the window. It is honestly nice.',
    ],
  },

  // HardLuck Bet, the casino app
  casino: {
    bets: [1, 5, 20, 100],
    freeBet: 10,          // the first bet, once, on the house
    chaseLine: 60,        // down more than this today and every loss stings harder
  },

  // Nia: how much she has to like him before she asks to come over, and what her food does
  sister: {
    visitBond: 3,
    cooldownDays: 4,
    askChance: 0.45,
    visit: { fromHour: 18, toHour: 21 },
    meal: { minutes: 45, hunger: 70, energy: 45, morale: 16, stress: -14 },
    askLines: [
      '“can i come by tomorrow? i made too much food. (i made exactly enough food for you.)”',
      '“mom sent pernil. it\'s coming to you whether you like it or not. tomorrow night ok?”',
      '“i want to see your place. i\'m not going to judge it out loud. tomorrow?”',
      '“free tomorrow night? i\'ll bring dinner. you supply a fork. you have a fork right”',
    ],
  },

  social: {
    postMinutes: 10,
    postMorale: 4,
    postFollowers: [1, 4],
    backlashChance: 0.28,
    backlashMorale: -7,
    donationChance: 0.10,
    donationAmount: 12,
    timelineDays: 3,            // how far back the FeedLove timeline goes
    followBackAffection: 25,    // she follows Mo back once she likes him this much (a girlfriend always does)
    likeAffection: 1,           // liking her post, once a day each
    partnerLikeMorale: 2,       // her liking his post
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
      likes: ['coffee', 'movie', 'park', 'dinner', 'lucias'], dislikes: ['walk'],
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
      likes: ['dinner', 'movie', 'park', 'lucias'], dislikes: ['coffee'],
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
    // hugs, a kiss on his cheek, holding hands: the affection each needs before it is offered
    // (a girlfriend always), and what the first of each kind in a day is worth
    gestures: { hug: 30, kiss: 45, hand: 55 },
    gestureValues: {
      hug: { affection: 2, morale: 4, stress: -4 },
      kiss: { affection: 3, morale: 5, stress: -3 },
      hand: { affection: 2, morale: 4, stress: -5 },
    },
    cheekCooldownMinutes: 24 * 60,
    afterglowHours: 24,
    giftCooldownDays: 3,
    activities: {
      coffee: { id: 'coffee', name: 'Coffee at the bodega', where: 'bodega', cost: 6, minutes: 45, affection: 9, morale: 5, stress: -3, energy: -2 },
      dinner: { id: 'dinner', name: 'Dinner at Habib\'s', where: 'habibs', cost: 28, minutes: 90, affection: 16, morale: 10, stress: -6, energy: 4 },
      park: { id: 'park', name: 'An afternoon in the park', where: 'park', cost: 0, minutes: 75, affection: 12, morale: 9, stress: -9, energy: 3 },
      walk: { id: 'walk', name: 'A walk down Kestrel Street', where: 'street', cost: 0, minutes: 40, affection: 7, morale: 5, stress: -5, energy: -1 },
      movie: { id: 'movie', name: 'A movie at home', where: 'apartment', cost: 4, minutes: 110, affection: 13, morale: 8, stress: -7, energy: -3 },
      lucias: { id: 'lucias', name: "Dinner at Lucia's on Ashby", where: 'restaurant', cost: 48, minutes: 140, affection: 21, morale: 12, stress: -8, energy: 4 },
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
