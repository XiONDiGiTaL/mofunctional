/**
 * Low-poly kit models: the street furniture and a few interiors come from Polyfork's NYC City kit
 * and friends (https://polyfork.dev, free models, mesh files CC BY 4.0; credited in README).
 *
 * The files are plain glTF 2.0 binaries: float positions, normals and a colour per vertex, no
 * textures, no extensions, real metres. That is simple enough to read here without three's
 * GLTFLoader: each file is parsed once, every node's transform is baked into one merged geometry
 * (one draw call per prop), and the palette runs through the game's own retro shader, so a
 * kit hydrant snaps, dithers and fogs like everything else on Kestrel.
 *
 * Placing one is synchronous: model('hydrant', {...}) returns a Group at once and the mesh drops
 * into it when the file arrives (a few KB each, preloaded at boot), so builders stay synchronous.
 */
import * as THREE from '../../vendor/three.module.js';
import { retroMaterial } from './retro.js';

/** The kit pieces the game uses: key → file under assets/models (named after the Polyfork id). */
export const MODELS = {
  hydrant: 'fire-hydrant-b68b17',
  mailbox: 'mailbox-8e36e8',
  payphone: 'payphone-stand-f97728',
  newsbox: 'newspaper-box-3f2c0e',
  trashcan: 'metal-trash-can-f57043',
  wirebasket: 'wire-trash-basket-269c1c',
  busShelter: 'bus-shelter-f786b4',
  callbox: 'fire-alarm-call-box-56d332',
  meter: 'parking-meter-e9cf71',
  bikeRack: 'bike-rack-a1e7c3',
  streetLamp: 'street-lamp-136745',
  bollard: 'sidewalk-bollard-c2567e',
  cellarHatch: 'sidewalk-cellar-hatch-c717a8',
  manhole: 'manhole-cover-137569',
  signPole: 'street-sign-pole-1e9551',
  barricade: 'police-barricade-0bbf37',
  hoarding: 'construction-hoarding-c286ac',
  scaffold: 'scaffolding-section-6554c0',
  bench: 'park-bench-dc8b62',
  tv: 'flat-screen-television-97b1f3',
  jukebox: 'bubbler-jukebox-ff71f2',
  dinerBooth: 'diner-booth-d804ce',
  vending: 'soda-vending-machine-4a5347',
  phoneBooth: 'pay-phone-booth-b8a1db',
  // whole buildings, for Ashby Ave West
  church: 'brick-church-322885',
  civic: 'classical-bank-04954e',
  diner: 'street-diner-40fc87',
  shopRow: 'one-storey-shop-row-83c958',
  cornerShop: 'corner-shop-5aec8c',
  loft: 'cast-iron-loft-b04b5a',
  walkup: 'narrow-walk-up-41f10c',
  tenement: 'brick-tenement-7d2014',
  awning: 'shop-awning-f47171',
  projSign: 'projecting-shop-sign-aa1867',
  streetTree: 'street-tree-0d33f3',
  wallAd: 'painted-wall-ad-d8f971',
};

const cache = new Map();   // key → Promise<{ geometry, height }>
const material = () => retroMaterial('polyfork', { vertexColors: true, ambient: 0.62 });

/** Read one GLB into a single merged BufferGeometry with position, normal and color. */
function parseGLB(buf) {
  const dv = new DataView(buf);
  if (dv.getUint32(0, true) !== 0x46546c67) throw new Error('not a GLB');
  const jsonLen = dv.getUint32(12, true);
  const json = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 20, jsonLen)));
  const binStart = 20 + jsonLen + 8;
  const SIZE = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };
  const read = (i) => {
    const a = json.accessors[i];
    const bv = json.bufferViews[a.bufferView];
    const n = SIZE[a.type];
    const off = binStart + (bv.byteOffset || 0) + (a.byteOffset || 0);
    const stride = bv.byteStride || 0;
    const out = new Float32Array(a.count * n);
    const ct = a.componentType;
    const bytes = ct === 5126 || ct === 5125 ? 4 : ct === 5123 || ct === 5122 ? 2 : 1;
    const step = stride || bytes * n;
    const norm = a.normalized ? (ct === 5121 ? 255 : ct === 5123 ? 65535 : 1) : 1;
    for (let k = 0; k < a.count; k++) for (let c = 0; c < n; c++) {
      const p = off + k * step + c * bytes;
      const v = ct === 5126 ? dv.getFloat32(p, true) : ct === 5125 ? dv.getUint32(p, true) : ct === 5123 ? dv.getUint16(p, true) : ct === 5121 ? dv.getUint8(p) : ct === 5122 ? dv.getInt16(p, true) : dv.getInt8(p);
      out[k * n + c] = v / norm;
    }
    return { data: out, n, count: a.count };
  };
  const pos = [], nor = [], col = [];
  const m = new THREE.Matrix4(), nm = new THREE.Matrix3(), v = new THREE.Vector3();
  const walk = (ni, parent) => {
    const node = json.nodes[ni];
    const local = new THREE.Matrix4();
    if (node.matrix) local.fromArray(node.matrix);
    else local.compose(new THREE.Vector3(...(node.translation || [0, 0, 0])), new THREE.Quaternion(...(node.rotation || [0, 0, 0, 1])), new THREE.Vector3(...(node.scale || [1, 1, 1])));
    const world = parent.clone().multiply(local);
    if (node.mesh != null) {
      m.copy(world);
      nm.getNormalMatrix(m);
      for (const prim of json.meshes[node.mesh].primitives) {
        if ((prim.mode ?? 4) !== 4) continue;
        const P = read(prim.attributes.POSITION);
        const N = prim.attributes.NORMAL != null ? read(prim.attributes.NORMAL) : null;
        const C = prim.attributes.COLOR_0 != null ? read(prim.attributes.COLOR_0) : null;
        const idx = prim.indices != null ? read(prim.indices).data : null;
        const count = idx ? idx.length : P.count;
        for (let t = 0; t < count; t++) {
          const i = idx ? idx[t] : t;
          v.set(P.data[i * 3], P.data[i * 3 + 1], P.data[i * 3 + 2]).applyMatrix4(m);
          pos.push(v.x, v.y, v.z);
          if (N) { v.set(N.data[i * 3], N.data[i * 3 + 1], N.data[i * 3 + 2]).applyMatrix3(nm).normalize(); nor.push(v.x, v.y, v.z); }
          else nor.push(0, 1, 0);
          if (C) col.push(C.data[i * C.n], C.data[i * C.n + 1], C.data[i * C.n + 2]);
          else col.push(0.8, 0.8, 0.8);
        }
      }
    }
    for (const c of node.children || []) walk(c, world);
  };
  const scene = json.scenes?.[json.scene ?? 0];
  for (const r of scene?.nodes || json.nodes.map((_, i) => i)) walk(r, new THREE.Matrix4());
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeBoundingBox();
  return g;
}

/** The parsed geometry for a key, fetched once. */
export function loadModel(key) {
  if (!cache.has(key)) {
    const file = MODELS[key];
    if (!file || typeof fetch === 'undefined') { cache.set(key, Promise.resolve(null)); return cache.get(key); }
    cache.set(key, fetch(`assets/models/${file}.glb`).then((r) => (r.ok ? r.arrayBuffer() : null)).then((b) => (b ? parseGLB(b) : null)).catch(() => null));
  }
  return cache.get(key);
}

/** Fetch every kit model now, so they are in memory before the first street loads. */
export function preloadModels() {
  for (const k of Object.keys(MODELS)) loadModel(k);
}

/**
 * A kit model, placed. Returns its Group immediately; the mesh arrives with the file.
 *   height   scale uniformly so the model is this tall (metres); or `scale` directly
 *   rot      yaw in radians; `tint` multiplies the palette (a hex colour)
 */
export function model(key, { x = 0, y = 0, z = 0, rot = 0, height = null, scale = 1, tint = null } = {}) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = rot;
  g.name = `model:${key}`;
  loadModel(key).then((geo) => {
    if (!geo) return;
    const mesh = new THREE.Mesh(geo, tint != null ? retroMaterial(`polyfork_${tint}`, { vertexColors: true, ambient: 0.62, color: tint }) : material());
    const h = geo.boundingBox.max.y - geo.boundingBox.min.y;
    mesh.scale.setScalar(height && h > 0 ? height / h : scale);
    mesh.position.y = -geo.boundingBox.min.y * mesh.scale.y;
    g.add(mesh);
  });
  return g;
}

/** Credit line for the kit (README and the credits screen). */
export const MODEL_CREDIT = 'Street furniture and props: Polyfork (polyfork.dev), NYC City kit and others, CC BY 4.0.';
