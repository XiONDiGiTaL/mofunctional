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
      { id: 'chopped', note: 'chopped cheese on a hero' },
      { id: 'hero', note: 'cold cuts, no ceremony' },
      { id: 'loosies', note: 'two loose cigarettes, under the counter' },
      { id: 'tallboy', note: 'back cooler, coldest thing in the store' },
      { id: 'ramen', note: 'the shelf by the door' },
      { id: 'bar', note: 'protein brick' },
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

export const shopById = (id) => SHOPS[id] || SHOPS.bodega;

/** Price with a small, deterministic per-shop markup (Habib's runs a little higher). */
export function shopPrice(shopId, itemId) {
  const def = CONFIG.items[itemId];
  if (!def) return 0;
  const base = def.price ?? 0;
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
    body: `${shop.blurb}\n\n“${shop.voice[Math.floor(Math.random() * shop.voice.length)].replace(/[“”]/g, '')}”\n\nCASH ${money(s.money)}${shop.sellsPork ? '' : ' · no pork, no loosies, halal only'}`,
    choices,
  });
}
