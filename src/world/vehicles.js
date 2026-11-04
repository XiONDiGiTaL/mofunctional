/**
 * Cars, built the way the rest of the block is built: flat-shaded, chunky, a few dozen faces each.
 *
 * Each body is a side profile (a 2D silhouette: hood, windshield, roof, trunk) extruded across the
 * car's width, so a compact reads as a hatchback, a GT as a wedge, a taxi as a three-box sedan with
 * a roof light, without anything finer than a PS1 would have bothered with. Glass is a second,
 * slightly narrower extrusion of the cabin; wheels are eight-sided drums; lights are emissive
 * blocks. Models face +x (front at +x), sit on y = 0, and are about to scale with the street.
 *
 *   compact      90s hatchback          sedan       the boxy four-door everybody's uncle drives
 *   taxi         yellow sedan + roof light          bus         the B44
 *   gt           exotic wedge, side strakes         coupe       sports coupe with a spoiler
 *   convertible  top down
 */
import * as THREE from '../../vendor/three.module.js';
import { retroMaterial, plane } from '../render/retro.js';
import { signTex } from '../render/signs.js';

const geoCache = new Map();
const matCache = new Map();

function mat(name, opts) {
  if (!matCache.has(name)) matCache.set(name, retroMaterial(`veh_${name}`, opts));
  return matCache.get(name);
}
const paint = (hex) => mat(`paint${hex.toString(16)}`, { color: hex, ambient: 0.75 });
const GLASS = () => mat('glass', { color: 0x1c2a36, emissive: 0.12 });
const TYRE = () => mat('tyre', { color: 0x0b0b0c });
const HUB = () => mat('hub', { color: 0x9a9ea4 });
const HEAD = () => mat('head', { color: 0xfff2c4, emissive: 1.1, unlit: true });
const TAIL = () => mat('tail', { color: 0xc8241a, emissive: 0.8, unlit: true });
const TRIM = () => mat('trim', { color: 0x1a1b1e });
const CHROME = () => mat('chrome', { color: 0xb8bcc2 });

/** Extrude a side profile [[x, y], ...] (metres) across `width`, centred on z = 0. */
function profile(key, pts, width) {
  const k = `${key}|${width}`;
  if (!geoCache.has(k)) {
    const shape = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
    const g = new THREE.ExtrudeGeometry(shape, { depth: width, bevelEnabled: false, steps: 1 });
    g.translate(0, 0, -width / 2);
    g.computeVertexNormals();
    geoCache.set(k, g);
  }
  return geoCache.get(k);
}

function wheelGeo(r, w) {
  const k = `wheel|${r}|${w}`;
  if (!geoCache.has(k)) {
    const g = new THREE.CylinderGeometry(r, r, w, 8);
    g.rotateX(Math.PI / 2);
    geoCache.set(k, g);
  }
  return geoCache.get(k);
}

function boxGeo(w, h, d) {
  const k = `box|${w}|${h}|${d}`;
  if (!geoCache.has(k)) geoCache.set(k, new THREE.BoxGeometry(w, h, d));
  return geoCache.get(k);
}

const add = (g, geo, m, x = 0, y = 0, z = 0) => { const mesh = new THREE.Mesh(geo, m); mesh.position.set(x, y, z); g.add(mesh); return mesh; };

/**
 * The silhouettes. Lower body (sills to beltline) and cabin (beltline to roof) are separate so the
 * cabin can be glass with painted pillars on the open-top and taxi variants.
 */
const SPECS = {
  compact: {
    len: 3.9, width: 1.66, wheelR: 0.3, axles: [1.25, -1.25],
    body: [[-1.95, 0.22], [1.95, 0.22], [1.98, 0.5], [1.85, 0.74], [0.75, 0.86], [-1.9, 0.86], [-1.97, 0.55]],
    cabin: [[0.75, 0.86], [0.05, 1.36], [-1.45, 1.38], [-1.88, 1.1], [-1.9, 0.86]],
  },
  sedan: {
    len: 4.8, width: 1.8, wheelR: 0.33, axles: [1.55, -1.5],
    body: [[-2.4, 0.24], [2.4, 0.24], [2.42, 0.54], [2.3, 0.78], [1.05, 0.84], [-1.55, 0.86], [-2.38, 0.82], [-2.42, 0.5]],
    cabin: [[1.05, 0.84], [0.35, 1.36], [-0.95, 1.38], [-1.55, 0.86]],
  },
  gt: {
    len: 4.5, width: 1.98, wheelR: 0.33, axles: [1.45, -1.4],
    body: [[-2.25, 0.2], [2.25, 0.2], [2.3, 0.42], [2.1, 0.6], [0.9, 0.76], [-1.0, 0.86], [-2.2, 0.84], [-2.28, 0.5]],
    cabin: [[0.9, 0.76], [0.1, 1.12], [-0.85, 1.12], [-1.55, 0.86]],
  },
  coupe: {
    len: 4.4, width: 1.76, wheelR: 0.31, axles: [1.35, -1.35],
    body: [[-2.2, 0.22], [2.2, 0.22], [2.24, 0.46], [2.05, 0.66], [0.85, 0.8], [-1.6, 0.84], [-2.16, 0.82], [-2.22, 0.5]],
    cabin: [[0.85, 0.8], [0.0, 1.22], [-0.95, 1.2], [-1.65, 0.84]],
  },
  convertible: {
    len: 4.3, width: 1.7, wheelR: 0.31, axles: [1.35, -1.3],
    body: [[-2.15, 0.22], [2.15, 0.22], [2.18, 0.5], [2.05, 0.74], [0.6, 0.86], [-2.1, 0.88], [-2.17, 0.55]],
    cabin: null,
  },
};

/**
 * A car of `type` in `color` (hex). Returns a Group facing +x with userData { len, width }.
 * The bus is its own thing: a box with windows, doors and a destination sign.
 */
export function buildVehicle(type = 'sedan', color = 0x5a6a78) {
  if (type === 'bus') return buildBus();
  if (type === 'police') return buildPolice();
  const taxi = type === 'taxi';
  const spec = SPECS[taxi ? 'sedan' : type] || SPECS.sedan;
  const g = new THREE.Group();
  const body = paint(taxi ? 0xf2c42a : color);
  add(g, profile(`${type}-body`, spec.body, spec.width), body);
  if (spec.cabin) {
    // the cabin: glass, with a painted roof slab on top so it reads as a roof, not a bubble
    add(g, profile(`${type}-cabin`, spec.cabin, spec.width * 0.9), GLASS());
    const roofTop = Math.max(...spec.cabin.map((p) => p[1]));
    const xs = spec.cabin.filter((p) => p[1] > roofTop - 0.03).map((p) => p[0]);
    const rx0 = Math.min(...xs), rx1 = Math.max(...xs);
    add(g, boxGeo(rx1 - rx0 + 0.08, 0.05, spec.width * 0.92), body, (rx0 + rx1) / 2, roofTop + 0.02, 0);
  } else {
    // top down: a windshield frame, two seats and the folded roof behind them
    add(g, boxGeo(0.06, 0.32, spec.width * 0.86), GLASS(), 0.55, 1.02, 0);
    for (const z of [-0.38, 0.38]) {
      add(g, boxGeo(0.5, 0.14, 0.48), mat('seat', { color: 0x3a2a22 }), -0.35, 0.9, z);
      add(g, boxGeo(0.12, 0.4, 0.48), mat('seat', { color: 0x3a2a22 }), -0.62, 1.08, z);
    }
    add(g, boxGeo(0.5, 0.16, spec.width * 0.8), TRIM(), -1.6, 0.96, 0);
  }
  // wheels, arches darkened by the tyre itself
  for (const ax of spec.axles) for (const s of [-1, 1]) {
    add(g, wheelGeo(spec.wheelR, 0.24), TYRE(), ax, spec.wheelR, s * (spec.width / 2 - 0.08));
    add(g, wheelGeo(spec.wheelR * 0.55, 0.26), HUB(), ax, spec.wheelR, s * (spec.width / 2 - 0.08));
  }
  // lights, bumpers, grille
  const front = spec.len / 2, back = -spec.len / 2;
  for (const z of [-1, 1]) {
    add(g, boxGeo(0.06, 0.14, 0.34), HEAD(), front + 0.01, 0.56, z * (spec.width / 2 - 0.3));
    add(g, boxGeo(0.06, 0.14, 0.34), TAIL(), back - 0.01, 0.6, z * (spec.width / 2 - 0.3));
  }
  add(g, boxGeo(0.1, 0.14, spec.width * 0.98), type === 'convertible' || type === 'sedan' ? CHROME() : TRIM(), front, 0.3, 0);
  add(g, boxGeo(0.1, 0.14, spec.width * 0.98), TRIM(), back, 0.32, 0);
  if (type === 'convertible') for (const z of [-0.36, -0.12, 0.12, 0.36]) add(g, boxGeo(0.04, 0.14, 0.1), TRIM(), front + 0.03, 0.56, z); // the kidney grille
  if (type === 'coupe') {
    add(g, boxGeo(0.3, 0.05, spec.width * 0.9), body, back + 0.25, 1.02, 0);
    for (const z of [-0.6, 0.6]) add(g, boxGeo(0.06, 0.18, 0.06), TRIM(), back + 0.25, 0.92, z);
  }
  if (type === 'gt') for (let i = 0; i < 5; i++) for (const s of [-1, 1]) add(g, boxGeo(0.5, 0.03, 0.02), TRIM(), -0.9, 0.48 + i * 0.07, s * (spec.width / 2 + 0.005));
  if (taxi) {
    add(g, boxGeo(0.62, 0.2, 0.34), mat('taxisign', { color: 0xfff8e0, emissive: 0.8, unlit: true }), -0.3, 1.52, 0);
    for (let i = 0; i < 6; i++) add(g, boxGeo(0.18, 0.08, 0.01), mat('checker', { color: i % 2 ? 0x111111 : 0xf2c42a }), -1.2 + i * 0.36, 0.58, spec.width / 2 + 0.005);
  }
  g.userData = { len: spec.len, width: spec.width, type };
  return g;
}

/** A 90s patrol car: a white sedan, a blue stripe, a light bar that flashes (userData.flash). */
function buildPolice() {
  const g = buildVehicle('sedan', 0xf2f2f0);
  const w = SPECS.sedan.width;
  for (const s of [-1, 1]) add(g, boxGeo(3.4, 0.1, 0.01), mat('pol_stripe', { color: 0x1e3a8a }), 0, 0.62, s * (w / 2 + 0.006));
  const red = mat('pol_red', { color: 0xff2a2a, emissive: 1.2, unlit: true });
  const blue = mat('pol_blue', { color: 0x2a5aff, emissive: 1.2, unlit: true });
  const a = add(g, boxGeo(0.3, 0.14, 0.5), red, -0.3, 1.47, -0.3);
  const b = add(g, boxGeo(0.3, 0.14, 0.5), blue, -0.3, 1.47, 0.3);
  g.userData = { ...g.userData, type: 'police', flash: [a, b] };
  return g;
}

function buildBus() {
  const g = new THREE.Group();
  const len = 10.5, w = 2.5;
  const white = mat('bus_white', { color: 0xd8dce0 });
  const blue = mat('bus_blue', { color: 0x2a4a8a });
  add(g, boxGeo(len, 2.4, w), white, 0, 1.55, 0);
  add(g, boxGeo(len + 0.02, 0.3, w + 0.02), blue, 0, 1.15, 0);
  add(g, boxGeo(len + 0.02, 0.08, w + 0.02), blue, 0, 2.0, 0);
  for (let i = 0; i < 7; i++) for (const s of [-1, 1]) add(g, boxGeo(1.1, 0.8, 0.02), GLASS(), -4.0 + i * 1.3, 2.35, s * (w / 2 + 0.01));
  add(g, boxGeo(0.04, 1.3, w * 0.86), GLASS(), len / 2 + 0.01, 2.2, 0);
  add(g, boxGeo(0.05, 0.32, w * 0.7), mat('bus_dest', { color: 0xffa83a, emissive: 1.0, unlit: true }), len / 2 + 0.03, 2.62, 0);
  for (const x of [3.6, 0.2]) add(g, boxGeo(1.0, 2.1, 0.03), GLASS(), x, 1.35, w / 2 + 0.02);
  for (const ax of [3.4, -3.2]) for (const s of [-1, 1]) add(g, wheelGeo(0.5, 0.3), TYRE(), ax, 0.5, s * (w / 2 - 0.12));
  for (const z of [-1, 1]) {
    add(g, boxGeo(0.06, 0.16, 0.36), HEAD(), len / 2 + 0.02, 0.6, z * 0.9);
    add(g, boxGeo(0.06, 0.16, 0.3), TAIL(), -len / 2 - 0.02, 0.8, z * 0.9);
  }
  g.userData = { len, width: w, type: 'bus' };
  return g;
}


/** The mascot, drawn in blocks on a canvas, so the decal sits in the same frame as every sign. */
let mrpMascotTex = null;
function mrpMascot() {
  if (mrpMascotTex) return mrpMascotTex;
  const S = 10;
  const c = document.createElement('canvas');
  c.width = 32 * S; c.height = 32 * S;
  const x = c.getContext('2d');
  x.clearRect(0, 0, c.width, c.height);
  const ink = '#2f1c0d', mid = '#6b3f1d', light = '#8a5527', white = '#f6f2e6', black = '#171008', red = '#c8281e';
  const px = (bx, by, bw, bh, col) => { x.fillStyle = col; x.fillRect(bx * S, by * S, bw * S, bh * S); };
  // three tiers, lighter along the top of each, so the pile still reads at street distance
  px(4, 22, 24, 6, mid); px(4, 22, 23, 2, light); px(3, 22, 1, 6, ink); px(28, 22, 1, 6, ink); px(4, 28, 24, 1, ink);
  px(7, 15, 18, 7, mid); px(7, 15, 17, 2, light); px(6, 15, 1, 7, ink); px(25, 15, 1, 7, ink);
  px(11, 10, 10, 5, mid); px(11, 10, 9, 2, light); px(10, 10, 1, 5, ink); px(21, 10, 1, 5, ink);
  // the curl over the top, and the cherry on it
  px(15, 7, 6, 3, mid); px(15, 7, 6, 1, light); px(21, 7, 1, 3, ink);
  px(19, 4, 4, 3, mid); px(19, 4, 4, 1, light); px(23, 4, 1, 3, ink); px(19, 3, 4, 1, ink);
  px(15, 1, 3, 3, red); px(15, 1, 1, 1, '#f2625a');
  // eyes with a catchlight each, then the grin
  px(10, 17, 5, 5, white); px(17, 17, 5, 5, white);
  px(10, 17, 5, 1, ink); px(17, 17, 5, 1, ink);
  px(12, 18, 2, 3, black); px(18, 18, 2, 3, black);
  px(12, 18, 1, 1, white); px(18, 18, 1, 1, white);
  px(13, 24, 7, 2, white); px(12, 24, 1, 1, white); px(20, 24, 1, 1, white);
  px(14, 26, 5, 1, white);
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.colorSpace = THREE.SRGBColorSpace;
  mrpMascotTex = t;
  return t;
}

/**
 * The Mr. Poopie van. Built like the rest of the street: one extruded side profile for the body,
 * a proud blue skirt, eight-sided wheels with hubs, chrome bars, emissive lights — then the things
 * that make it an ice cream truck: the service window let into the pavement side, the striped
 * awning on arms, the menu, the name and the mascot on both flanks.
 *
 * Returns userData { len, width, mount }, where mount is where the man in the costume stands.
 */
export function buildIceCreamTruck() {
  const g = new THREE.Group();
  const w = 2.15;
  const white = mat('mrp_white', { color: 0xf2f2ee, ambient: 0.82 });
  const blue = mat('mrp_blue', { color: 0x2a72b8, ambient: 0.8 });
  const dark = mat('mrp_dark', { color: 0x0e1014 });
  const seam = mat('mrp_seam', { color: 0xcfcfc9 });
  const lit = mat('mrp_lit', { color: 0xfff2c8, emissive: 0.95, unlit: true });
  const sugar = mat('mrp_sugar', { color: 0xe0b878, ambient: 0.9 });
  const cream = mat('mrp_cream', { color: 0xf3c9bd, ambient: 0.9 });

  // the silhouette: a step van — low nose, a raked screen, a tall box behind it
  const body = [[-2.85, 0.42], [2.60, 0.42], [2.86, 0.62], [2.86, 1.10], [2.64, 1.28], [2.52, 2.60], [2.26, 2.86], [-2.62, 2.88], [-2.85, 2.62]];
  add(g, profile('mrp-body', body, w), white);
  add(g, profile('mrp-skirt', [[-2.87, 0.20], [2.84, 0.20], [2.88, 0.44], [-2.87, 0.44]], w + 0.04), blue);

  // the flanks: a rub strip, a chrome beltline, shut lines — so the sides are not one white slab
  for (const s of [-1, 1]) {
    const zf = s * (w / 2 + 0.012);
    add(g, boxGeo(5.5, 0.09, 0.03), blue, -0.1, 0.98, zf);
    add(g, boxGeo(5.4, 0.04, 0.03), CHROME(), -0.1, 1.28, zf);
    for (const x of [-1.72, 1.55]) add(g, boxGeo(0.025, 1.5, 0.02), seam, x, 1.95, zf);
    if (s > 0) for (const x of [-1.05, 0.4]) add(g, boxGeo(0.025, 1.5, 0.02), seam, x, 1.95, zf);
    // the cab door: a handle, and the glass above it
    add(g, boxGeo(0.16, 0.05, 0.05), CHROME(), 1.74, 1.44, zf);
    add(g, boxGeo(0.86, 0.7, 0.04), GLASS(), 2.06, 2.02, zf);
  }

  // the screen, its wipers, and the mirrors on their stalks
  const ws = add(g, boxGeo(0.06, 1.3, w * 0.86), GLASS(), 2.6, 1.94, 0);
  ws.rotation.z = 0.09;
  for (const s of [-1, 1]) {
    add(g, boxGeo(0.03, 0.46, 0.03), TRIM(), 2.67, 1.5, s * 0.32);
    add(g, boxGeo(0.04, 0.24, 0.04), TRIM(), 2.52, 1.98, s * (w / 2 + 0.1));
    add(g, boxGeo(0.06, 0.2, 0.15), TRIM(), 2.52, 2.14, s * (w / 2 + 0.18));
  }

  // wheels, hubs, a chunky arch lip over each, and mud flaps behind the back pair
  for (const ax of [1.72, -1.72]) for (const s of [-1, 1]) {
    add(g, wheelGeo(0.44, 0.3), TYRE(), ax, 0.44, s * (w / 2 - 0.1));
    add(g, wheelGeo(0.23, 0.32), HUB(), ax, 0.44, s * (w / 2 - 0.1));
    const za = s * (w / 2 + 0.006);
    add(g, boxGeo(0.70, 0.09, 0.06), white, ax, 0.98, za);
    for (const e of [-1, 1]) {
      const lip = add(g, boxGeo(0.46, 0.09, 0.06), white, ax + e * 0.32, 0.88, za);
      lip.rotation.z = -e * 0.6;
    }
  }
  for (const s of [-1, 1]) add(g, boxGeo(0.04, 0.34, 0.34), TRIM(), -2.14, 0.3, s * (w / 2 - 0.18));

  // the nose: bumper, grille, lights, plate
  add(g, boxGeo(0.16, 0.22, w * 0.98), CHROME(), 2.84, 0.48, 0);
  for (let i = 0; i < 3; i++) add(g, boxGeo(0.05, 0.05, w * 0.46), CHROME(), 2.87, 0.74 + i * 0.13, 0);
  for (const s of [-1, 1]) {
    add(g, boxGeo(0.06, 0.16, 0.34), HEAD(), 2.87, 0.98, s * (w / 2 - 0.32));
    add(g, boxGeo(0.05, 0.09, 0.16), mat('mrp_amber', { color: 0xffa21e, emissive: 0.7, unlit: true }), 2.87, 0.78, s * (w / 2 - 0.1));
  }
  add(g, boxGeo(0.03, 0.16, 0.34), white, 2.88, 0.98, 0);

  // the rear: two doors, their glass, hinges, the handle, the bumper and the plate
  for (const s of [-1, 1]) {
    add(g, boxGeo(0.03, 0.86, 0.62), GLASS(), -2.87, 2.18, s * 0.54);
    for (const h of [0.72, 1.9]) add(g, boxGeo(0.05, 0.1, 0.1), CHROME(), -2.88, h, s * 0.98);
    add(g, boxGeo(0.05, 0.14, 0.12), CHROME(), -2.88, 1.42, s * 0.12);
    add(g, boxGeo(0.06, 0.16, 0.3), TAIL(), -2.87, 0.95, s * (w / 2 - 0.3));
  }
  add(g, boxGeo(0.04, 2.1, 0.04), seam, -2.89, 1.55, 0);
  add(g, boxGeo(0.14, 0.2, w * 0.9), TRIM(), -2.88, 0.42, 0);
  add(g, boxGeo(0.04, 0.16, 0.3), white, -2.9, 1.05, 0);

  // the roof: a cap, two vents, the bell, and the cone it is known by three blocks away
  add(g, boxGeo(5.0, 0.06, w * 0.94), white, -0.2, 2.89, 0);
  add(g, boxGeo(0.86, 0.18, 0.86), TRIM(), -1.35, 2.98, 0);
  add(g, boxGeo(0.5, 0.1, 0.5), TRIM(), -2.3, 2.94, 0);
  add(g, boxGeo(0.17, 0.17, 0.17), mat('mrp_bell', { color: 0xc8ccd0, ambient: 1 }), 1.9, 2.97, 0);
  add(g, boxGeo(0.52, 0.07, 0.52), TRIM(), 0.6, 2.94, 0);
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.56, 8), sugar);
  cone.position.set(0.6, 3.18, 0);
  cone.rotation.x = Math.PI;
  g.add(cone);
  const scoop = new THREE.Mesh(new THREE.SphereGeometry(0.27, 8, 6), cream);
  scoop.position.set(0.6, 3.5, 0);
  g.add(scoop);
  const cherry = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 4), mat('mrp_cherry', { color: 0xc8281e, emissive: 0.25 }));
  cherry.position.set(0.6, 3.82, 0);
  g.add(cherry);

  // the hatch, on the pavement side: the recess, the lit freezer behind it, the counter, the step,
  // and the shutter rolled up over the top
  const winZ = -(w / 2 + 0.012);
  add(g, boxGeo(2.5, 1.16, 0.05), dark, -0.5, 1.95, winZ + 0.02);
  // the freezer light sits proud of the dark recess, or the recess hides it and the hatch is a hole
  add(g, boxGeo(2.3, 1.02, 0.03), lit, -0.5, 1.95, winZ - 0.02);
  add(g, boxGeo(2.62, 0.1, 0.5), CHROME(), -0.5, 1.36, winZ - 0.2);
  add(g, boxGeo(0.62, 0.06, 0.36), CHROME(), -1.55, 0.34, winZ - 0.18);
  for (const s of [-1, 1]) add(g, boxGeo(0.05, 0.3, 0.05), TRIM(), -1.55 + s * 0.26, 0.19, winZ - 0.06);
  const roll = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 2.32, 8), white);
  roll.rotation.z = Math.PI / 2;
  roll.position.set(-0.5, 2.55, winZ - 0.04);
  g.add(roll);

  // the awning: a slab on two chrome arms, striped at the hem
  const aw = add(g, boxGeo(2.7, 0.07, 0.8), mat('mrp_awn', { color: 0xececea }), -0.5, 2.44, winZ - 0.4);
  aw.rotation.x = 0.16;
  for (let i = 0; i < 7; i++) add(g, boxGeo(0.34, 0.18, 0.05), i % 2 ? blue : mat('mrp_awn2', { color: 0xf2f2ee }), -1.55 + i * 0.37, 2.32, winZ - 0.76);
  for (const s of [-1, 1]) {
    const arm = add(g, boxGeo(0.05, 0.5, 0.05), CHROME(), -0.5 + s * 1.22, 2.62, winZ - 0.7);
    arm.rotation.x = 0.55;
  }

  // the livery, both flanks: the name over the hatch, the mascot behind it, the words underneath
  for (const s of [1, -1]) {
    const rot = s > 0 ? 0 : Math.PI;
    const zf = s * (w / 2 + 0.025);
    g.add(plane(2.5, 0.34, { name: 'mrp_name', map: signTex('mrpNameSign', [{ text: 'MR. POOPIE', color: '#c81e1e', size: 16 }], { w: 160, h: 26, bg: '#f2f2ee' }), emissive: 0.18, unlit: true }, [-0.55, 2.71, zf], [0, rot, 0]));
    g.add(plane(1.1, 1.1, { name: 'mrp_mascot', map: mrpMascot(), emissive: 0.1 }, [-2.32, 1.95, zf], [0, rot, 0]));
    g.add(plane(2.2, 0.26, { name: 'mrp_words', map: signTex('mrpWords', [{ text: 'CONES · SHAKES · SUNDAES', color: '#2a72b8', size: 8 }], { w: 192, h: 22, bg: '#f2f2ee' }), emissive: 0.14, unlit: true }, [-0.55, 1.08, zf], [0, rot, 0]));
  }

  // the menu at the hatch
  g.add(plane(0.85, 0.6, { name: 'mrp_menu', map: signTex('mrpMenu', [{ text: 'CONES', color: '#141414', size: 9 }, { text: '2.50', color: '#c81e1e', size: 12 }], { w: 64, h: 44, bg: '#f2f0e8', border: '#141414' }), emissive: 0.45, unlit: true }, [-1.42, 1.95, winZ - 0.05], [0, Math.PI, 0]));

  g.userData = { len: 5.7, width: w, type: 'icecream', mount: { x: -0.5, y: 1.02, z: -(w / 2 - 0.44) } };
  return g;
}

/** Street colours from 1999: mostly sensible, some faded, the odd one somebody chose on purpose. */
export const CAR_COLORS = [0x2a2c30, 0x8a8c90, 0xd8d8d4, 0x5a6a78, 0x6a4a3a, 0x3a5a3a, 0x7a1e1a, 0x1e3a6a, 0x8a7a5a, 0xa8a090, 0x4a2a4a, 0x2a4a5a, 0xc8b070, 0x8a2a2a, 0x1a1a1a];

/** A random everyday car: mostly sedans and compacts, a few taxis, the occasional flash. */
export function randomCar(rand = Math.random) {
  const r = rand();
  const type = r < 0.36 ? 'sedan' : r < 0.66 ? 'compact' : r < 0.84 ? 'taxi' : r < 0.91 ? 'coupe' : r < 0.96 ? 'convertible' : 'gt';
  const color = type === 'gt' ? (rand() < 0.5 ? 0xf2f2f0 : 0xc8121a) : CAR_COLORS[Math.floor(rand() * CAR_COLORS.length)];
  return buildVehicle(type, color);
}
