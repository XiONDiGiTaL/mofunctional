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
import { retroMaterial } from '../render/retro.js';

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

/** Street colours from 1999: mostly sensible, some faded, the odd one somebody chose on purpose. */
export const CAR_COLORS = [0x2a2c30, 0x8a8c90, 0xd8d8d4, 0x5a6a78, 0x6a4a3a, 0x3a5a3a, 0x7a1e1a, 0x1e3a6a, 0x8a7a5a, 0xa8a090, 0x4a2a4a, 0x2a4a5a, 0xc8b070, 0x8a2a2a, 0x1a1a1a];

/** A random everyday car: mostly sedans and compacts, a few taxis, the occasional flash. */
export function randomCar(rand = Math.random) {
  const r = rand();
  const type = r < 0.36 ? 'sedan' : r < 0.66 ? 'compact' : r < 0.84 ? 'taxi' : r < 0.91 ? 'coupe' : r < 0.96 ? 'convertible' : 'gt';
  const color = type === 'gt' ? (rand() < 0.5 ? 0xf2f2f0 : 0xc8121a) : CAR_COLORS[Math.floor(rand() * CAR_COLORS.length)];
  return buildVehicle(type, color);
}
