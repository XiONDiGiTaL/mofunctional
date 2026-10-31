/**
 * Item art: a small flat illustration for everything Mo can carry, eat, sell or (fictionally)
 * use. Drawn on a 32 unit grid in a few flat colours with a dark outline, so the same icon reads
 * on a shop menu board, a phone list and an inventory tile. Unknown items fall back to their kind.
 */
const O = '#1a1411'; // outline
const s = (body) => `<svg viewBox="0 0 32 32" aria-hidden="true" stroke="${O}" stroke-width="1.4" stroke-linejoin="round" stroke-linecap="round">${body}</svg>`;

const ART = {
  ramen: s(`<path d="M4 15h24l-2.5 9a3 3 0 0 1-2.9 2.2H9.4A3 3 0 0 1 6.5 24z" fill="#e8463a"/><path d="M4 15h24" fill="none"/>
    <path d="M8 15c1-3 3-3 4 0 1-3 3-3 4 0 1-3 3-3 4 0 1-3 3-3 4 0" fill="#f6d27a"/><path d="M19 4l-4 11M23 5l-5 10" fill="none" stroke="#c99a5b" stroke-width="1.6"/>
    <rect x="11" y="18.5" width="10" height="3" rx="1" fill="#fff4d6"/>`),
  beans: s(`<rect x="8" y="6" width="16" height="21" rx="2" fill="#b9c3c9"/><rect x="8" y="10" width="16" height="13" fill="#d9502e"/>
    <ellipse cx="16" cy="16.5" rx="5" ry="3.4" fill="#f1d38a"/><path d="M8 6h16M8 27h16" fill="none"/>`),
  eggs: s(`<path d="M3.5 16h25l-2 8H5.5z" fill="#c9b08c"/><ellipse cx="9" cy="14" rx="3.2" ry="4" fill="#fff6e6"/><ellipse cx="16" cy="13.2" rx="3.2" ry="4.2" fill="#fff6e6"/><ellipse cx="23" cy="14" rx="3.2" ry="4" fill="#f4e2c6"/>`),
  sandwich: s(`<path d="M4 20 16 7l12 13z" fill="#e7c48b"/><path d="M6 20h20l-1 3H7z" fill="#7cc35a"/><path d="M6.5 23h19l-1 3h-17z" fill="#d97a5a"/><path d="M8 18l8-9 8 9" fill="none" stroke="#c99a5b"/>`),
  bar: s(`<rect x="4" y="11" width="24" height="10" rx="2" fill="#2f6fb5" transform="rotate(-12 16 16)"/><path d="M9 13.5l1.6 7.6M22 10.8l1.6 7.6" fill="none" transform="rotate(-12 16 16)"/><text x="16" y="18.5" font-size="5" font-family="sans-serif" font-weight="900" text-anchor="middle" fill="#fff" stroke="none" transform="rotate(-12 16 16)">PRO</text>`),
  cereal: s(`<path d="M8 5h16v22H8z" fill="#f2b632"/><path d="M8 5l2-2h16l-2 2M24 5l2-2v22l-2 2" fill="#c98a12"/><circle cx="16" cy="15" r="5" fill="#fff3d0"/><circle cx="14.5" cy="14" r="1.2" fill="#c98a12" stroke="none"/><circle cx="17.5" cy="16.5" r="1.2" fill="#c98a12" stroke="none"/><rect x="10" y="22" width="12" height="2.5" fill="#e8463a" stroke="none"/>`),
  bec: s(`<path d="M4 16c0-5 5-8 12-8s12 3 12 8z" fill="#e2a85c"/><path d="M4 16h24v1.5H4z" fill="#ffd23f"/><path d="M5 17.5h22l-1 2.5H6z" fill="#b8432e"/><path d="M5 20h22c0 3.5-5 5.5-11 5.5S5 23.5 5 20z" fill="#e2a85c"/><circle cx="11" cy="12" r=".7" fill="${O}" stroke="none"/><circle cx="16" cy="11" r=".7" fill="${O}" stroke="none"/><circle cx="21" cy="12" r=".7" fill="${O}" stroke="none"/>`),
  chopped: s(`<rect x="3" y="10" width="26" height="6" rx="3" fill="#e2a85c"/><path d="M4 16h24l-1 3H5z" fill="#7a3b26"/><path d="M5 19h22" fill="none" stroke="#ffd23f" stroke-width="2.2"/><rect x="3" y="20" width="26" height="5.5" rx="2.7" fill="#e2a85c"/><path d="M8 16.5l2 2M14 16.5l2 2M20 16.5l2 2" fill="none" stroke="#7cc35a"/>`),
  hero: s(`<rect x="2.5" y="11" width="27" height="5" rx="2.5" fill="#e7c48b"/><path d="M3 16h26" fill="none" stroke="#e8758a" stroke-width="2.4"/><path d="M3 18.5h26" fill="none" stroke="#7cc35a" stroke-width="2"/><rect x="2.5" y="19.5" width="27" height="5" rx="2.5" fill="#e7c48b"/>`),
  loosies: s(`<rect x="5" y="12" width="20" height="3.4" rx="1" fill="#fbfbf6" transform="rotate(-18 15 14)"/><rect x="21" y="12" width="4" height="3.4" fill="#e3a256" transform="rotate(-18 15 14)"/><rect x="7" y="18" width="20" height="3.4" rx="1" fill="#fbfbf6" transform="rotate(8 17 20)"/><rect x="23" y="18" width="4" height="3.4" fill="#e3a256" transform="rotate(8 17 20)"/>`),
  tallboy: s(`<path d="M10 5h12l1 3v18l-1 2H10l-1-2V8z" fill="#3c7bd6"/><path d="M10 5h12" fill="none"/><rect x="9" y="12" width="14" height="8" fill="#f2f2f2"/><text x="16" y="18" font-size="5.2" font-family="sans-serif" font-weight="900" text-anchor="middle" fill="#c4202a" stroke="none">TALL</text>`),
  falafel: s(`<path d="M6 8c6-3 14-3 20 0l-3 19H9z" fill="#efe1bb"/><circle cx="12" cy="14" r="3" fill="#8a5a2b"/><circle cx="19" cy="13" r="3" fill="#8a5a2b"/><circle cx="16" cy="19" r="3" fill="#8a5a2b"/><path d="M9 11l2 1M21 17l2-1" fill="none" stroke="#7cc35a" stroke-width="2"/>`),
  halal_plate: s(`<ellipse cx="16" cy="18" rx="13" ry="8" fill="#f4f1ea"/><path d="M5 17c3-5 8-6 11-4v9c-4 1-9 0-11-5z" fill="#f2c94c"/><path d="M16 13c4-2 9 0 11 4-2 4-6 6-11 5z" fill="#b5652f"/><path d="M14 16c2 1 4 1 6 0" fill="none" stroke="#fff" stroke-width="2"/><path d="M19 18.5c1.5.6 3 .5 4-.4" fill="none" stroke="#e8463a" stroke-width="1.6"/>`),
  chicken_rice: s(`<path d="M4 13h24l-2 11a3 3 0 0 1-3 2.5H9A3 3 0 0 1 6 24z" fill="#d7dde3"/><path d="M5.5 14h21c-1 4-4 7-10.5 7S6.5 18 5.5 14z" fill="#f2c94c"/><path d="M10 15.5h4M18 15h4M14 18h5" fill="none" stroke="#b5652f" stroke-width="2.2"/><path d="M8 13c4 2 12 2 16 0" fill="none" stroke="#fff" stroke-width="1.8"/>`),
  lentil: s(`<path d="M4 14h24c0 7-5 12-12 12S4 21 4 14z" fill="#f4f1ea"/><ellipse cx="16" cy="14" rx="12" ry="3.4" fill="#d9822b"/><path d="M11 9c1-2-1-3 0-5M16 9c1-2-1-3 0-5M21 9c1-2-1-3 0-5" fill="none" stroke="#c8c8c8"/>`),
  baklava: s(`<path d="M4 20l12-11 12 11z" fill="#e0a547"/><path d="M4 20h24v4H4z" fill="#c9862c"/><path d="M8 17h16M11 14h10" fill="none" stroke="#b06c1d"/><path d="M13 12l1.4 1.4M17 12l1.4 1.4" fill="none" stroke="#5f9e3a" stroke-width="2"/>`),
  mint_tea: s(`<path d="M9 10h14l-1.5 14a2 2 0 0 1-2 1.8h-7a2 2 0 0 1-2-1.8z" fill="#f5e7c4" fill-opacity=".9"/><path d="M10 14h12l-1 10H11z" fill="#c9862c"/><path d="M14 6c3 1 4 3 3 5-3 0-4-2-3-5z" fill="#5fbf6b"/><path d="M23 13c3 0 3 5 0 5" fill="none"/>`),
  bliss: s(`<rect x="12" y="4" width="8" height="4" rx="1" fill="#555"/><path d="M11 8h10v16a5 5 0 0 1-10 0z" fill="#eaf2ff" fill-opacity=".85"/><path d="M11.4 15h9.2v9a4.6 4.6 0 0 1-9.2 0z" fill="#ff5ec4"/><path d="M14 18v4" fill="none" stroke="#fff" stroke-width="1.4"/>`),
  static: s(`<rect x="5" y="12" width="13" height="7" rx="3.5" fill="#7fd6ff" transform="rotate(-30 11.5 15.5)"/><path d="M9.3 11.6l4.4 7.7" fill="none" transform="rotate(0)"/><circle cx="22" cy="20" r="5" fill="#f4f4f4"/><path d="M19 20h6" fill="none"/>`),
  mud: s(`<path d="M9 7h14v3l2 3v12a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V13l2-3z" fill="#6b4a2f"/><rect x="9" y="4" width="14" height="3" rx="1" fill="#2d241d"/><rect x="9" y="15" width="14" height="7" fill="#c9b08c"/><path d="M12 18.5h8" fill="none"/>`),
  drip: s(`<path d="M16 4c4 6 8 10 8 15a8 8 0 0 1-16 0c0-5 4-9 8-15z" fill="#9cc4a8"/><path d="M12.5 19a4 4 0 0 0 3.5 4" fill="none" stroke="#fff" stroke-width="1.6"/>`),
  tv: s(`<rect x="4" y="7" width="24" height="18" rx="3" fill="#6b6155"/><rect x="7" y="10" width="15" height="12" rx="2" fill="#2e4a5a"/><path d="M9 12l4 3" fill="none" stroke="#8fd8ff"/><circle cx="25" cy="13" r="1.2" fill="#ddd"/><circle cx="25" cy="17" r="1.2" fill="#ddd"/><path d="M12 7l-3-4M20 7l3-4" fill="none"/>`),
  guitar: s(`<path d="M19 4l5 5-6 6" fill="none" stroke="#5a3a1e" stroke-width="2.4"/><path d="M14 13c-3-1-7 1-8 5-1 5 3 9 8 8 4-1 5-4 6-7z" fill="#c4202a"/><circle cx="13" cy="19" r="2" fill="${O}" stroke="none"/><path d="M22 6l2 2" fill="none"/>`),
  watch: s(`<rect x="12" y="2.5" width="8" height="7" fill="#7a5530"/><rect x="12" y="22.5" width="8" height="7" fill="#7a5530"/><circle cx="16" cy="16" r="7.5" fill="#e0b84a"/><circle cx="16" cy="16" r="5.6" fill="#fff8e6"/><path d="M16 12.5V16l2.4 1.6" fill="none"/>`),
  ring: s(`<ellipse cx="16" cy="19" rx="9" ry="7.5" fill="none" stroke="#c9ccd2" stroke-width="3.4"/><ellipse cx="16" cy="19" rx="9" ry="7.5" fill="none"/><path d="M13 8l3-4 3 4-3 3z" fill="#9fe6ff"/>`),
  console: s(`<rect x="4" y="11" width="24" height="12" rx="3" fill="#8a8f99"/><rect x="7" y="13.5" width="18" height="3" rx="1" fill="#3a3f47"/><circle cx="9" cy="20" r="1.3" fill="#c4202a"/><rect x="21" y="19" width="4" height="2" rx="1" fill="#3a3f47"/>`),
  jacket: s(`<path d="M10 5l6 3 6-3 5 4-2 6-2-1v13H9V14l-2 1-2-6z" fill="#3a2a22"/><path d="M16 8v19" fill="none" stroke="#7a6a5a"/><path d="M12 6l4 6 4-6" fill="none" stroke="#7a6a5a"/>`),
  tools: s(`<rect x="4" y="13" width="24" height="12" rx="2" fill="#c4202a"/><path d="M11 13v-3h10v3" fill="none" stroke-width="2"/><path d="M4 17h24" fill="none"/><rect x="14" y="16" width="4" height="3" fill="#ddd"/>`),
  id_card: s(`<rect x="3" y="8" width="26" height="17" rx="2.5" fill="#e9eef5"/><rect x="6" y="11.5" width="8" height="10" rx="1" fill="#8c5f40"/><path d="M17 13h9M17 16.5h9M17 20h6" fill="none" stroke="#7d8aa0"/><rect x="3" y="8" width="26" height="2.6" fill="#4a7bd1"/>`),
  lease: s(`<path d="M8 4h12l5 5v19H8z" fill="#f6f1e2"/><path d="M20 4v5h5" fill="#ddd2b6"/><path d="M11 13h10M11 16.5h10M11 20h7" fill="none" stroke="#8b8270"/><path d="M12 25c2-2 3 1 5-1" fill="none" stroke="#2c5fb8"/>`),
  grab_bag: s(`<path d="M7 11h18l-2 16H9z" fill="#c9a26b"/><path d="M12 11V8a4 4 0 0 1 8 0v3" fill="none"/><text x="16" y="23" font-size="9" font-family="sans-serif" font-weight="900" text-anchor="middle" fill="#fff" stroke="none">?</text>`),
};

const BY_KIND = {
  food: ART.sandwich, comfort: ART.mint_tea, substance: ART.drip, valuable: ART.watch, doc: ART.lease, mystery: ART.grab_bag,
};

/** The icon for an item id, wrapped in a tile; `kind` picks the fallback for unknown ids. */
export function itemIcon(id, kind = '') {
  const art = ART[id] || BY_KIND[kind] || ART.grab_bag;
  return `<span class="itemicon itemicon--${id}">${art}</span>`;
}
