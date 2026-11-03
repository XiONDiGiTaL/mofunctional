/**
 * Street mouths: what the end of a walk looks like when there is more city past it. Where the
 * Kestrel sidewalk turns into Myrtle Row, where the Row lets out onto Ashby Avenue (and back),
 * the view does not stop at the edge of the map: the next street goes on, with its sidewalk, its
 * facades and lit windows, its awnings, lamps, a cart or two and a few people standing about, fading
 * into the haze. And at the edge itself, a gateway: two lamp posts with a banner strung between
 * them and a green street sign, so it is plain that this is somewhere you can walk to.
 *
 * Everything is static scenery (no rigs in the area's list), cheap, and outside the walkable bounds.
 */
import * as THREE from '../../vendor/three.module.js';
import { retroMaterial, box, plane } from '../render/retro.js';
import { tex } from '../render/textures.js';
import { signTex } from '../render/signs.js';
import { createNPC } from './characters.js';

function rng(seed) {
  let t = seed >>> 0;
  return () => { t = (t + 0x6d2b79f5) >>> 0; let r = Math.imul(t ^ (t >>> 15), 1 | t); r ^= r + Math.imul(r ^ (r >>> 7), 61 | r); return ((r ^ (r >>> 14)) >>> 0) / 4294967296; };
}
const M = (n, color, extra = {}) => retroMaterial(`vista_${n}`, { color, ...extra });

const LOOKS = {
  // Myrtle Row, seen from Kestrel or from the Ave: low walk-ups, awnings, flags, carts, food signs
  row: { colors: [0x7a4a3a, 0xc8a878, 0x5a6a7a, 0x8a5a3a, 0x6a4a5a, 0x8a6a4a], heights: [6, 9], awnings: [0x2a8a4a, 0xc81e1e, 0x2a5a9a, 0xf2c81a], signs: ["SAL'S", 'IRIE GRILL', 'DÖNER', 'KNISHES', '99¢', 'PIRAGUAS'], carts: 3, people: 4, flags: true },
  // Kestrel, seen from the Row: the walk-up, the bodega's green, the station's globes
  kestrel: { colors: [0x6a5a6a, 0x3f6b4a, 0x8a6a4a, 0x5a4a3a], heights: [7, 10], awnings: [0x3f6b4a, 0x8a1e1e], signs: ['BODEGA', '1104', 'KESTREL ST'], carts: 0, people: 3, globes: true },
  // Ashby Avenue: taller, busier, a bus shelter and a cab
  avenue: { colors: [0x5a5a64, 0x8a5a3a, 0x4a4a54, 0x7a6a5a], heights: [10, 16], awnings: [0x2a2a6a, 0xc8a83a], signs: ['PAWN & GOLD', "DEE'S WASH", "LUCIA'S", '84 PCT'], carts: 1, people: 3, cab: true },
};

/**
 * Build a street mouth into `group`. `x` is the edge of the walkable street, `dir` the way the
 * view runs (-1 west, +1 east). `title`/`sub` go on the banner.
 */
export function streetMouth(group, { x, dir = -1, look = 'row', title, sub, seed = 1, frontZ = -7, depth = 30, road = true }) {
  const L = LOOKS[look] || LOOKS.row;
  const r = rng(seed);
  const cx = x + dir * depth / 2;
  // the ground keeps going: sidewalk, curb and the road beside it
  group.add(plane(depth, 7.6, { name: `vista_sw_${seed}`, map: tex('sidewalk'), repeat: [8, 2] }, [cx, 0.003, -2.4], [-Math.PI / 2, 0, 0]));
  group.add(box(depth, 0.18, 0.4, M('curb', 0x8a8a84), [cx, 0.09, 1.5]));
  if (road) group.add(plane(depth, 9, { name: `vista_road_${seed}`, map: tex('asphalt'), repeat: [8, 3] }, [cx, -0.004, 6.0], [-Math.PI / 2, 0, 0]));
  // the facades down the far side of the walk, and a row across the road to frame it
  let fx = x + dir * 0.2;
  let i = 0;
  while (Math.abs(fx - x) < depth) {
    const w = 4 + r() * 3;
    const h = L.heights[0] + r() * (L.heights[1] - L.heights[0]);
    const col = L.colors[i % L.colors.length];
    const mx = fx + dir * w / 2;
    group.add(box(w, h, 1.2, M(`fac${col}`, col, { map: tex('brick') }), [mx, h / 2, frontZ]));
    for (let wy = 2.6; wy < h - 0.6; wy += 1.7) for (let wx = -w / 2 + 0.9; wx < w / 2 - 0.5; wx += 1.6) {
      group.add(plane(0.8, 0.9, { name: 'vista_win', map: tex('window'), emissive: r() < 0.45 ? 0.5 : 0.08, unlit: true }, [mx + wx, wy, frontZ + 0.62]));
    }
    // a shopfront: lit glass, an awning, a sign
    group.add(box(w * 0.7, 1.4, 0.05, M('shopglass', 0xffe8b8, { emissive: 0.55, unlit: true }), [mx, 1.2, frontZ + 0.62]));
    const aw = L.awnings[i % L.awnings.length];
    group.add(box(w * 0.85, 0.08, 1.2, M(`awn${aw}`, aw), [mx, 2.25, frontZ + 1.2], [0.25, 0, 0]));
    const label = L.signs[i % L.signs.length];
    group.add(plane(w * 0.7, 0.45, { name: `vista_sign_${look}_${i}`, map: signTex(`vistaSign${look}${i}`, [{ text: label, color: '#ffffff', size: 9 }], { w: 96, h: 20, bg: '#1a1a1e', border: '#e8c83a' }), emissive: 0.7, unlit: true }, [mx, 2.75, frontZ + 0.63]));
    // across the road
    const bh = L.heights[0] + r() * (L.heights[1] - L.heights[0]);
    group.add(box(w, bh, 1.2, M(`facb${col}`, L.colors[(i + 2) % L.colors.length], { map: tex('brick') }), [mx, bh / 2, 12.5]));
    for (let wy = 2.2; wy < bh - 0.6; wy += 1.7) for (let wx = -w / 2 + 0.9; wx < w / 2 - 0.5; wx += 1.6) {
      group.add(plane(0.8, 0.9, { name: 'vista_win', map: tex('window'), emissive: r() < 0.4 ? 0.5 : 0.08, unlit: true }, [mx + wx, wy, 11.88], [0, Math.PI, 0]));
    }
    fx += dir * (w + 0.15);
    i += 1;
  }
  // lamps down the curb
  for (let k = 3; k < depth; k += 7) {
    const lx = x + dir * k;
    group.add(box(0.12, 4.0, 0.12, M('lamppole', 0x2a3a30), [lx, 2.0, 1.1]));
    if (L.globes) group.add(new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), M('globe', 0xfff2c4, { emissive: 1, unlit: true })).translateX(lx).translateY(4.1).translateZ(1.1));
    else group.add(box(0.6, 0.1, 0.3, M('lamphead', 0xfff2c4, { emissive: 1, unlit: true }), [lx, 4.0, 0.9]));
  }
  // carts and flags for the market, a cab for the avenue
  for (let c = 0; c < L.carts; c++) {
    const cxp = x + dir * (6 + c * 7 + r() * 2);
    group.add(box(1.3, 0.8, 0.6, M(`vcart${c}`, [0xd8d8dc, 0xf2c84a, 0x5a9a5a][c % 3]), [cxp, 0.6, -2.2]));
    const umb = new THREE.Mesh(new THREE.ConeGeometry(0.9, 0.35, 8), M(`vumb${c}`, [0x2a6ac8, 0xc81e1e, 0xf2c81a][c % 3]));
    umb.position.set(cxp, 2.2, -2.2);
    group.add(umb);
    group.add(box(0.05, 1.2, 0.05, M('vcartpole', 0xb8bcc0), [cxp, 1.6, -2.2]));
  }
  if (L.flags) for (let k = 0; k < 18; k++) {
    const f = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.22, 3), M(`vflag${k % 3}`, [0x1e8a3a, 0xf2c81a, 0xc81e1e][k % 3]));
    f.position.set(x + dir * (2 + k * 0.6), 3.4 - Math.sin((k % 9) / 8 * Math.PI) * 0.3, -3.8);
    f.rotation.x = Math.PI;
    group.add(f);
  }
  if (L.cab) {
    const cab = new THREE.Group();
    cab.add(box(3.6, 0.7, 1.7, M('cab', 0xf2c81a), [0, 0.55, 0]));
    cab.add(box(2.0, 0.55, 1.5, M('cabtop', 0xf2c81a), [-0.2, 1.15, 0]));
    cab.add(box(1.9, 0.45, 1.52, M('cabglass', 0x2a3a4a, { emissive: 0.1 }), [-0.2, 1.15, 0]));
    cab.position.set(x + dir * 9, 0, 4.4);
    group.add(cab);
  }
  // a few people standing about down there (scenery: they do not walk)
  const kinds = ['tenant_f', 'passer_m', 'w3', 'w11', 'hall_m', 'w14', 'passer_m2'];
  for (let p = 0; p < L.people; p++) {
    const rig = createNPC(kinds[Math.floor(r() * kinds.length)]);
    rig.root.position.set(x + dir * (4 + r() * (depth - 8)), 0, -1.2 - r() * 3.5);
    rig.root.rotation.y = r() * Math.PI * 2;
    group.add(rig.root);
  }

  // the gateway: two lamp posts across the walk, a banner strung between, a green street sign
  const gx = x + dir * 0.6;
  const rot = dir < 0 ? Math.PI / 2 : -Math.PI / 2;
  for (const z of [-5.6, 0.9]) {
    group.add(box(0.14, 4.2, 0.14, M('gatepole', 0x1e4a2e), [gx, 2.1, z]));
    group.add(new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), M('gateglobe', 0xfff2c4, { emissive: 1, unlit: true })).translateX(gx).translateY(4.35).translateZ(z));
  }
  group.add(box(0.04, 0.04, 6.5, M('gatewire', 0x1a1a1a), [gx, 3.95, -2.35]));
  group.add(plane(5.6, 0.9, { name: `vista_banner_${seed}`, map: signTex(`vistaBanner${seed}`, [{ text: title, color: '#ffe23a', size: 12 }, { text: sub, color: '#ffffff', size: 5 }], { w: 192, h: 32, bg: '#1e6a3a', border: '#ffe23a' }), emissive: 0.75, unlit: true, doubleSide: true }, [gx, 3.4, -2.35], [0, rot, 0]));
  group.add(box(0.1, 2.8, 0.1, M('signpole', 0x2a5a3a), [gx, 1.4, 1.2]));
  group.add(plane(1.6, 0.32, { name: `vista_street_${seed}`, map: signTex(`vistaStreet${seed}`, [{ text: title, color: '#ffffff', size: 9 }], { w: 96, h: 20, bg: '#1e6a3a', border: '#ffffff' }), emissive: 0.5, unlit: true, doubleSide: true }, [gx, 2.75, 1.2], [0, rot, 0]));
}
