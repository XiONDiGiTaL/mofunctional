/**
 * Clothes. Mo's face and hair never change; what he is wearing can.
 *
 * The closet at home holds what he owns, the thrift on Park Slope sells the rest. Colours are
 * plain hex on purpose: the model is built from untextured lofts, so a shirt is a shirt.
 */
import { CONFIG } from '../core/config.js';
import { logLine } from '../core/state.js';

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
