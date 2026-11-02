/**
 * Clothes. Mo's face and hair never change; what he is wearing can.
 *
 * The closet at home holds what he owns, the thrift on Park Slope sells the rest. Colours are
 * plain hex on purpose: the model is built from untextured lofts, so a shirt is a shirt.
 */
import { CONFIG } from '../core/config.js';
import { logLine, pushMessage } from '../core/state.js';

const OUTFITS = () => CONFIG.outfits || [];

export function outfitDef(id) {
  return OUTFITS().find((o) => o.id === id) || null;
}

export function wardrobeState(s) {
  if (!s.wardrobe) s.wardrobe = {};
  const w = s.wardrobe;
  w.owned = Array.isArray(w.owned) && w.owned.length ? w.owned : [OUTFITS()[0]?.id || 'tee'];
  if (!w.owned.includes(w.worn)) w.worn = w.owned[0];
  return w;
}

/** What he has on, as the def the renderer wants. */
export function worn(s) {
  const w = wardrobeState(s);
  return outfitDef(w.worn) || OUTFITS()[0] || { id: 'tee', shirt: 0xe9e8e3, pants: 0x3a4a66, shoes: 0x2a2622 };
}

export function owned(s) {
  const w = wardrobeState(s);
  return w.owned.map(outfitDef).filter(Boolean);
}

export function buy(g, id) {
  const s = g.state;
  const w = wardrobeState(s);
  const def = outfitDef(id);
  if (!def) return { ok: false, reason: 'none' };
  if (w.owned.includes(id)) return { ok: false, reason: 'owned' };
  if (s.money < def.price) return { ok: false, reason: 'short', price: def.price };
  g.spendMoney(def.price, `clothes: ${def.name}`);
  w.owned.push(id);
  logLine(g, `Bought the ${def.name}.`, 'good');
  return { ok: true, def };
}

export function wear(g, id) {
  const s = g.state;
  const w = wardrobeState(s);
  const def = outfitDef(id);
  if (!def) return { ok: false, reason: 'none' };
  if (!w.owned.includes(id)) return { ok: false, reason: 'not-owned' };
  w.worn = id;
  g.world?.applyOutfit?.(s);
  g.toast(`You change into the ${def.name}. It smells like the store, or the drawer.`, 'info');
  return { ok: true, def };
}

/**
 * The Jay's catalog, sold at the newsstand: with it Mo can phone an outfit in. It is paid on the
 * call (price plus shipping) and turns up folded in the closet the next morning at ten.
 */
export const CATALOG_SHIPPING = 6;
export function mailOrder(g, id) {
  const s = g.state;
  const w = wardrobeState(s);
  const def = outfitDef(id);
  if (!def) return { ok: false, reason: 'none' };
  w.orders = w.orders || [];
  if (w.owned.includes(id) || w.orders.some((o) => o.id === id)) return { ok: false, reason: 'owned' };
  const total = def.price + CATALOG_SHIPPING;
  if (s.money < total) return { ok: false, reason: 'short', price: total };
  g.spendMoney(total, `catalog order: ${def.name}`);
  const day = Math.floor(s.clock.m / 1440) + 1;
  w.orders.push({ id, at: day * 1440 + 10 * 60 });
  logLine(g, `Phoned in the ${def.name} from the Jay's catalog.`, 'good');
  return { ok: true, def, total };
}

/** Called every tick: anything due is in the closet now, and Jay's sends a note to say so. */
export function tickMailOrders(g) {
  const w = g.state.wardrobe;
  if (!w?.orders?.length) return;
  const due = w.orders.filter((o) => g.state.clock.m >= o.at);
  if (!due.length) return;
  w.orders = w.orders.filter((o) => g.state.clock.m < o.at);
  for (const o of due) {
    const def = outfitDef(o.id);
    if (!def || w.owned.includes(o.id)) continue;
    w.owned.push(o.id);
    pushMessage(g, { from: "MR. JAY'S", subject: 'Your order', body: `The ${def.name} came this morning. The super signed for it and left it in your closet, folded better than you would. Change at home. Thank you for shopping Jay's, where the borough gets dressed.` });
  }
}
