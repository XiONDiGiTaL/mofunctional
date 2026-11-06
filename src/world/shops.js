/**
 * The two counters on Kestrel Street.
 *
 * Miguel's bodega is the cheap, salty, pork-forward option: bacon egg and cheese on a roll,
 * a chopped cheese, loosies from under the register, tall boys in the back cooler. Habib's is
 * halal: no pork, no loosies, prices about a third higher, but the food actually restores you —
 * chicken over rice, a combo plate, lentil soup, falafel for the broke end of the week.
 */
import { CONFIG } from '../core/config.js';
import { money } from '../core/util.js';
import { addItem } from '../core/state.js';
import { portraitURL } from '../render/faces.js';
import { showShopMenu } from '../ui/shopmenu.js';

export const SHOPS = {
  bodega: {
    id: 'bodega',
    name: 'Kestrel Bodega',
    owner: 'Miguel',
    ownerKind: 'miguel',
    kicker: 'MIGUEL’S — 1120 KESTREL ST.',
    blurb: 'A cat asleep on the lottery machine. The grill has been on since 1987.',
    voice: [
      '“Aight, my guy. What you need?”',
      '“BEC? Give me four minutes. The roll is fresh, I swear on my mother.”',
      '“Loosies is two for a dollar fifty. I don’t know nothing about no tax.”',
    ],
    stock: [
      { id: 'bec', note: 'the neighbourhood breakfast' },
      { id: 'bagel_cc', note: 'everything bagel, a schmear the size of a fist' },
      { id: 'chopped', note: 'chopped cheese on a hero' },
      { id: 'hero', note: 'cold cuts, no ceremony' },
      { id: 'loosies', note: 'two loose cigarettes, under the counter' },
      { id: 'tallboy', note: 'back cooler, coldest thing in the store' },
      { id: 'ramen', note: 'the shelf by the door' },
      { id: 'bar', note: 'protein brick' },
      { id: 'water', note: 'the cooler by the door' },
      { id: 'baking_soda', note: 'for the fridge, Miguel says, not looking up' },
    ],
    sellsPork: true,
  },
  habibs: {
    id: 'habibs',
    name: 'Habib’s Corner',
    owner: 'Habib',
    ownerKind: 'habib',
    kicker: 'HABIB’S HALAL CORNER',
    blurb: 'Halal. Clean counters. A poster of a place he has not been back to in eleven years.',
    voice: [
      '“Come in, come in. You look like you have not eaten.”',
      '“No pork here, my friend. Never. But the chicken over rice — this is the good one.”',
      '“Falafel is four dollars. Four. You cannot lose money on falafel, only time.”',
    ],
    stock: [
      { id: 'chicken_rice', note: 'white sauce, hot sauce, the works' },
      { id: 'halal_plate', note: 'combo plate — the one that actually fixes you' },
      { id: 'falafel', note: 'cheap, filling, no regrets' },
      { id: 'lentil', note: 'soup, if the week has been long' },
      { id: 'baklava', note: 'somebody’s grandmother made this' },
      { id: 'mint_tea', note: 'tea. sit down. you look terrible.' },
    ],
    sellsPork: false,
  },
};

// Quik-Stop #14: open all night, nothing cooked, everything a little too expensive
SHOPS.quikstop = {
  id: 'quikstop',
  name: 'Quik-Stop #14',
  owner: 'The clerk',
  ownerKind: 'clerk',
  kicker: 'QUIK-STOP #14 · OPEN 24 HRS',
  blurb: 'Fluorescent, refrigerated and slightly sticky. The slushie machine has been "being fixed" since spring.',
  voice: [
    '"Just that? You want a lotto with that? Nobody wants a lotto with that."',
    '"Coffee is free refills. The refill is not free. Do not ask me how."',
    '"If you are on the schedule today, Dale is in the back. If you are not, you are a customer. Congratulations."',
  ],
  stock: [
    { id: 'coffee', note: 'burnt since six, honest about it' },
    { id: 'bagel_cc', note: 'in the warmer since 6, cream cheese in a tub' },
    { id: 'sandwich', note: 'cold case, triangle, dated tomorrow' },
    { id: 'ramen', note: 'the noodle wall' },
    { id: 'bar', note: 'protein brick, by the register' },
    { id: 'cereal', note: 'family size, single man' },
    { id: 'beans', note: 'the can aisle' },
    { id: 'eggs', note: 'back cooler' },
    { id: 'tallboy', note: 'back cooler, ID if Dale is watching' },
    { id: 'loosies', note: 'behind the counter, if you ask right' },
    { id: 'water', note: 'the cooler, behind the energy drinks' },
    { id: 'baking_soda', note: 'aisle 3, between the flour and nobody' },
  ],
  markup: 1.35,
  sellsPork: true,
};

/* ------------------------------------------------------------------ Myrtle Row (world/row.js) */
Object.assign(SHOPS, {
  pizzeria: {
    id: 'pizzeria', name: "Sal's Famous", owner: 'Sal', ownerKind: 'sal',
    kicker: "SAL'S FAMOUS PIZZERIA · THE WINDOW", blurb: 'A window onto the sidewalk, a counter with a shaker of red pepper chained to it, and three pies that have been "just out of the oven" since noon.',
    voice: ['"Plain or pepperoni. Do not ask me about pineapple. I am a grown man."', '"Fold it. Who taught you to eat pizza with a fork? Who hurt you?"', '"Ices are in the freezer. Lemon, cherry, rainbow. Rainbow is just the other two having an argument."'],
    stock: [
      { id: 'pizza_slice', note: 'folded, dripping, the real thing' },
      { id: 'pizza_pie', note: 'eight slices in a box he signs with a marker' },
      { id: 'italian_ice', note: 'lemon, cherry or rainbow · a wooden spoon' },
      { id: 'soda', note: 'cans in the window cooler' },
      { id: 'water', note: 'for the red pepper emergency' },
    ],
    markup: 1, sellsPork: true,
  },
  piragua: {
    id: 'piragua', name: 'Piraguas', owner: 'Don Cheo', ownerKind: 'piraguero',
    kicker: 'MYRTLE ROW · THE PIRAGUA CART', blurb: 'A green cart with a red and yellow sign, a block of ice under a towel, and a row of syrup bottles that glow in the sun like stained glass.',
    voice: ['"¡Piragua, piragua! Tamarindo, coco, frambuesa. Cold as your ex."', '"I shave it fresh. Machines are for people who do not love you."', '"Coco is the best one. I am not supposed to say. I am saying."'],
    stock: [{ id: 'piragua', note: 'shaved ice, syrup to the bottom, a paper cone' }, { id: 'water', note: 'from the cooler under the cart' }],
    markup: 1, sellsPork: true,
  },
  jerk: {
    id: 'jerk', name: "Irie Grill", owner: 'Desmond', ownerKind: 'jerkman',
    kicker: 'MYRTLE ROW · IRIE GRILL', blurb: 'An oil-drum grill under a green-and-white awning, flags strung overhead, and smoke you can smell from the train.',
    voice: ['"Jerk chicken, patty, coco bread. Pick one. Pick two. I am not your mother, pick three."', '"Mild or spicy? There is no mild. I lied. It is spicy."', '"The coco bread is the hug. The patty is the handshake."'],
    stock: [
      { id: 'beef_patty', note: 'flaky, yellow, molten in the middle' },
      { id: 'coco_bread', note: 'the patty, folded into soft sweet bread' },
      { id: 'jerk_chicken', note: 'off the drum · rice and peas · a little slaw' },
      { id: 'soda', note: 'ginger beer, the cold kind' },
    ],
    markup: 1, sellsPork: true,
  },
  // after the drum goes cold, Desmond is on Ashby Ave by the sax man with a spliff, and he has one
  // thing for sale. Legal in New York; he still sells it out of his jacket.
  desmond_herb: {
    id: 'desmond_herb', name: 'Desmond', owner: 'Desmond', ownerKind: 'jerkman',
    kicker: 'ASHBY AVE · BY THE SAX', blurb: 'The grill is cold and Desmond is off the clock: leaning on the wall by the sax man, smoke curling up past the streetlight, nodding along.',
    voice: ['"Easy, easy. Good green, grown with love. Not the stuff from the shop with the cartoon leaf."', '"Smoke slow. It is not a race, bredda."', '"You get hungry later, you know where the grill is. Eleven o\'clock."'],
    stock: [{ id: 'herb', note: 'a little ziplock and a paper · legal, mellow, makes you hungry' }],
    markup: 1, sellsPork: true,
  },
  glizzy: {
    id: 'glizzy', name: 'The Last Honest Wiener', owner: 'Gary', ownerKind: 'pretzelman',
    kicker: 'MYRTLE ROW · THE LAST HONEST WIENER', blurb: 'A steel cart with an umbrella that has seen things. Dirty water dogs, salted pretzels, and a sign that says NO CHECKS, NO CREDIT, NO FEELINGS.',
    voice: ['"Dog? Pretzel? Both? Both is a lifestyle."', '"Onions, mustard, sauerkraut. The works. I do not do ketchup for adults."', '"This water has been here since the Dinkins administration. That is the flavour."'],
    stock: [
      { id: 'hotdog', note: 'dirty water dog, the works' },
      { id: 'pretzel', note: 'salt like a snowstorm · mustard on request' },
      { id: 'soda', note: 'cans on ice' },
      { id: 'water', note: 'a dollar, like God intended' },
    ],
    markup: 1, sellsPork: true,
  },
  pretzels: {
    id: 'pretzels', name: 'Pretzel Palace', owner: 'Rosa', ownerKind: 'pretzelwoman',
    kicker: 'MYRTLE ROW · PRETZEL PALACE', blurb: 'A cart with a glass case of pretzels stacked like firewood and a hand-painted crown on the side.',
    voice: ['"Fresh this morning. Which morning, I will not say."', '"Twisted, like me. Salty, like me. Two fifty, unlike me."'],
    stock: [{ id: 'pretzel', note: 'warm, enormous, structurally impressive' }, { id: 'water', note: '' }],
    markup: 1, sellsPork: true,
  },
  knish: {
    id: 'knish', name: "Mendel's Knishes", owner: 'Mendel', ownerKind: 'hasid',
    kicker: "MYRTLE ROW · MENDEL'S KNISHES", blurb: 'A folding table, boxes of knishes in rows, and a man with a beard who answers every question with a better question.',
    voice: ['"Potato. Kasha. Spinach. You want the potato. Everybody wants the potato."', '"You look hungry. You look like a man who has never had a real knish. Sit down. Standing is fine also."', '"Mustard? Of course mustard. What are we, animals?"'],
    stock: [{ id: 'knish', note: 'square, heavy, hot · a little mustard' }, { id: 'soda', note: 'cream soda, naturally' }],
    markup: 1, sellsPork: false,
  },
  turkish: {
    id: 'turkish', name: 'Istanbul Grill', owner: 'Mehmet', ownerKind: 'doner',
    kicker: 'MYRTLE ROW · ISTANBUL GRILL', blurb: 'A booth with a döner spit turning slowly behind the counter, a long knife, and a tray of baklava under a glass lid.',
    voice: ['"Döner, kebab, baklava. Tea is free if you are polite."', '"I shave it thin. Thick is for amateurs."', '"My baklava has forty layers. I counted. I did not have anything else to do."'],
    stock: [
      { id: 'doner', note: 'shaved off the spit into a pita · yogurt sauce' },
      { id: 'kebab', note: 'lamb and peppers, off the grill' },
      { id: 'baklava', note: 'honey, pistachio, forty layers' },
      { id: 'mint_tea', note: 'in a tulip glass' },
    ],
    markup: 1, sellsPork: false,
  },
});

// the night shift: same carts, other people (world/row.js picks by the clock)
SHOPS.glizzy_night = {
  ...SHOPS.glizzy, id: 'glizzy_night', owner: 'Luis', ownerKind: 'cartnight',
  kicker: 'MYRTLE ROW · THE LAST HONEST WIENER · NIGHT SHIFT',
  voice: ['"Gary does days. I do the people Gary does not want to meet."', '"After midnight the dogs are a dollar more. That is the danger pay."', '"You hungry or you lonely? I sell for both."'],
};
SHOPS.pretzels_night = {
  ...SHOPS.pretzels, id: 'pretzels_night', owner: 'Ray', ownerKind: 'passer_m2',
  kicker: 'MYRTLE ROW · PRETZEL PALACE · NIGHT SHIFT',
  voice: ['"Rosa makes them. I just stand here and keep them warm. Like a hen."', '"Pretzel at 3 a.m. is a decision. I respect a decision."'],
};

export const shopById = (id) => SHOPS[id] || SHOPS.bodega;

/** Price with a small, deterministic per-shop markup (Habib's runs a little higher). */
export function shopPrice(shopId, itemId) {
  const def = CONFIG.items[itemId];
  if (!def) return 0;
  const base = (def.price ?? 0) * (SHOPS[shopId]?.markup || 1);
  return Math.round(base * 100) / 100;
}

export function buyFromShop(g, shopId, itemId, qty = 1) {
  const shop = shopById(shopId);
  const def = CONFIG.items[itemId];
  if (!def) return false;
  const price = shopPrice(shopId, itemId) * qty;
  if (g.state.money < price) {
    g.toast('Not enough cash. Miguel pretends not to notice; Habib does not.', 'bad');
    return false;
  }
  g.spendMoney(price, `${shop.name} — ${def.name}`);
  addItem(g.state, itemId, qty);
  g.audio.sfx('cash');
  g.advance(2);
  const line = def.hot ? `${def.name}, wrapped in paper. It is too hot to hold.` : `${def.name}. Bagged.`;
  g.toast(line, 'good');
  g.broadcast?.({ from: shop.owner, text: `“${def.name}. ${def.hot ? 'Careful, it’s hot.' : 'There you go.'}”` });
  return true;
}

/** The counter menu: stock, prices, and what each item actually does for him. */
export function openShop(g, shopId) {
  const shop = shopById(shopId);
  const s = g.state;
  // the illustrated menu board; the plain choice modal below is the fallback
  if (typeof document !== 'undefined') {
    const items = shop.stock.map(({ id, note }) => {
      const def = CONFIG.items[id];
      // a substance keeps its numbers in the substances table, not on the item
      const fx = def.kind === 'substance' ? { ...(CONFIG.substances.types[id]?.effects || {}), hot: false } : def;
      const gains = [
        fx.hunger ? [`${fx.hunger > 0 ? '+' : ''}${fx.hunger} food`, fx.hunger > 0 ? 'good' : 'bad'] : null,
        fx.energy ? [`${fx.energy > 0 ? '+' : ''}${fx.energy} energy`, fx.energy > 0 ? 'good' : 'bad'] : null,
        fx.morale ? [`${fx.morale > 0 ? '+' : ''}${fx.morale} morale`, fx.morale > 0 ? 'good' : 'bad'] : null,
        fx.stress ? [`${fx.stress > 0 ? '+' : ''}${fx.stress} stress`, fx.stress < 0 ? 'good' : 'bad'] : null,
        fx.hot ? ['hot', 'warm'] : null,
      ].filter(Boolean);
      return { id, def, note, gains, price: shopPrice(shopId, id) };
    });
    showShopMenu(g, { shop, items, portrait: portraitURL(shop.ownerKind, 'content'), buy: (id) => buyFromShop(g, shopId, id) });
    return;
  }
  const choices = shop.stock.map(({ id, note }) => {
    const def = CONFIG.items[id];
    const price = shopPrice(shopId, id);
    const gains = [
      def.hunger ? `+${def.hunger} food` : '',
      def.energy ? `${def.energy > 0 ? '+' : ''}${def.energy} energy` : '',
      def.morale ? `${def.morale > 0 ? '+' : ''}${def.morale} morale` : '',
      def.stress ? `${def.stress} stress` : '',
    ].filter(Boolean).join(' · ');
    return {
      label: `${def.name} — ${money(price)}`,
      sub: `${gains} · ${note}`,
      disabled: s.money < price,
      effect: () => {
        buyFromShop(g, shopId, id);
        setTimeout(() => openShop(g, shopId), 10);
      },
    };
  });
  choices.push({ label: 'Step back out to the street.', sub: '', effect: () => {} });

  g.openModal({
    kicker: shop.kicker,
    title: `${shop.name}`,
    body: `${shop.blurb}\n\n“${shop.voice[Math.floor(Math.random() * shop.voice.length)].replace(/[“”"]/g, '')}”\n\nCASH ${money(s.money)}${shop.sellsPork ? '' : ' · no pork, no loosies, halal only'}`,
    choices,
  });
}
