/**
 * 90s-era 3D rendering: affine texture mapping, vertex snapping, ordered dithering,
 * per-vertex wobble, fog. Everything renders at a low internal resolution and
 * is upscaled with nearest filtering.
 */
import * as THREE from '../../vendor/three.module.js';
import { CONFIG } from '../core/config.js';

const VERT = /* glsl */`
uniform float uTime;
uniform float uWobble;
uniform float uSnap;
varying vec2 vUvA;
varying float vW;
varying vec3 vN;
varying float vDepth;
varying float vWorldY;
varying float vWorldNY;

void main() {
  vec3 p = position;
  float sway = sin(uTime * 1.9 + position.x * 3.1 + position.y * 2.3 + position.z * 2.7);
  // displacement depends only on position, so vertices shared by flat-shaded facets move
  // together and the mesh never cracks open along its hard edges
  float sway2 = cos(uTime * 1.3 + position.z * 3.7 + position.x * 1.9);
  p += vec3(sway, sway2, sway * sway2) * uWobble * 0.006;

  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vec4 clip = projectionMatrix * mv;

  // Vertex snapping: quantize screen-space position (classic 90s console jitter)
  vec2 ndc = clip.xy / clip.w;
  ndc = floor(ndc * uSnap + 0.5) / uSnap;
  clip.xy = ndc * clip.w;

  vUvA = uv * clip.w;     // affine mapping: divide by w again in the fragment shader
  vW = clip.w;
  vN = normalize(normalMatrix * normal);
  vDepth = -mv.z;
  vWorldY = (modelMatrix * vec4(p, 1.0)).y;
  vWorldNY = normalize(mat3(modelMatrix) * normal).y;
  gl_Position = clip;
}
`;

const FRAG = /* glsl */`
uniform sampler2D uMap;
uniform bool uUseMap;
uniform vec3 uColor;
uniform float uEmissive;
uniform vec3 uLightDir;
uniform vec3 uFillDir;
uniform float uAmbient;
uniform vec3 uKeyTint;
uniform vec3 uFillTint;
uniform vec3 uSkyTint;
uniform vec3 uGroundTint;
uniform vec3 uHeadTint;
uniform vec3 uFogColor;
uniform float uFogNear;
uniform float uFogFar;
uniform float uOpacity;
uniform float uDither;
uniform float uAlphaTest;
uniform float uUnlit;

varying vec2 vUvA;
varying float vW;
varying vec3 vN;
varying float vDepth;
varying float vWorldY;
varying float vWorldNY;

float bayer2(vec2 a) { a = floor(a); return fract(a.x / 2.0 + a.y * a.y * 0.75); }
float bayer4(vec2 a) { return bayer2(0.5 * a) * 0.25 + bayer2(a); }

void main() {
  vec2 uv = vUvA / vW;
  vec3 base = uColor;
  if (uUseMap) {
    vec4 t = texture2D(uMap, uv);
    if (t.a < uAlphaTest) discard;
    base *= t.rgb;
  }
  float ndl = 1.0;
  vec3 shade = vec3(1.0);
  if (uUnlit < 0.5) {
    // 90s-era two-light model: one warm key, one cool bounce, plus a sky/ground
    // hemisphere so vertical faces never flatten into a single value.
    vec3 n = normalize(vN);
    float key = max(dot(n, normalize(uLightDir)), 0.0);
    float fill = max(dot(n, normalize(uFillDir)), 0.0);
    float hemi = n.y * 0.5 + 0.5;
    // cheap camera-facing fill: whatever the player is looking at stays readable,
    // exactly like the flat "headlight" trick 90s games leaned on
    float head = max(vN.z, 0.0);
    shade = mix(uGroundTint, uSkyTint, hemi) * uAmbient
          + uKeyTint * (key * key * 0.85 + key * 0.15)
          + uFillTint * fill * 0.55
          + uHeadTint * head;
    ndl = clamp(dot(n, normalize(uLightDir)), 0.0, 1.0);
  }
  vec3 lit = base * shade;
  // contact shadow: walls, props and legs darken as they meet the floor (floors themselves don't)
  if (uUnlit < 0.5) {
    float vertical = 1.0 - abs(vWorldNY);
    lit *= mix(1.0, mix(0.62, 1.0, smoothstep(0.0, 0.85, vWorldY)), vertical * 0.85);
  }
  lit += base * uEmissive;

  float fogF = clamp((vDepth - uFogNear) / (uFogFar - uFogNear), 0.0, 1.0);
  fogF = pow(fogF, 0.85);
  lit = mix(lit, uFogColor, fogF);

  // colours and textures arrive linear (three's colour management); encode for display so
  // the palette reads as authored instead of crushed into the shadows
  lit = pow(max(lit, vec3(0.0)), vec3(1.0 / 2.2));

  // 4x4 ordered dithering + 5-bit color quantization
  float d = bayer4(gl_FragCoord.xy) - 0.5;
  lit = floor(lit * 31.0 + 0.5 + d * uDither) / 31.0;

  gl_FragColor = vec4(lit, uOpacity);
}
`;

export const retroUniforms = {
  time: { value: 0 },
  lightDir: { value: new THREE.Vector3(...CONFIG.render.lightDir).normalize() },
  fillDir: { value: new THREE.Vector3(-CONFIG.render.lightDir[0], CONFIG.render.lightDir[1] * 0.4, -CONFIG.render.lightDir[2]).normalize() },
  keyTint: { value: new THREE.Color(0.95, 0.83, 0.62) },
  fillTint: { value: new THREE.Color(0.20, 0.25, 0.36) },
  skyTint: { value: new THREE.Color(0.6, 0.55, 0.47) },
  groundTint: { value: new THREE.Color(0.22, 0.19, 0.16) },
  headTint: { value: new THREE.Color(0.36, 0.34, 0.31) },
  fogColor: { value: new THREE.Color(CONFIG.render.colors.fog) },
  fogNear: { value: CONFIG.render.fogNear },
  fogFar: { value: CONFIG.render.fogFar },
};

/** Re-tint the world lighting per area (called by the world on area change). */
export function setAreaLighting({ key, fill, sky, ground, fog, ambient } = {}) {
  if (key) retroUniforms.keyTint.value.setRGB(...key);
  if (fill) retroUniforms.fillTint.value.setRGB(...fill);
  if (sky) retroUniforms.skyTint.value.setRGB(...sky);
  if (ground) retroUniforms.groundTint.value.setRGB(...ground);
  if (fog != null) retroUniforms.fogColor.value.set(fog);
  if (ambient != null) retroUniforms.ambientValue = ambient;
}

const matCache = new Map();

export function retroMaterial(name, opts = {}) {
  const key = `${name}|${JSON.stringify(opts)}`;
  if (matCache.has(key)) return matCache.get(key);
  const m = new THREE.ShaderMaterial({
    uniforms: {
      uMap: { value: opts.map || null },
      uUseMap: { value: !!opts.map },
      uColor: { value: new THREE.Color(opts.color ?? 0xffffff) },
      uEmissive: { value: opts.emissive ?? 0 },
      uAmbient: { value: opts.ambient ?? 0.48 },
      uLightDir: retroUniforms.lightDir,
      uFillDir: retroUniforms.fillDir,
      uKeyTint: retroUniforms.keyTint,
      uFillTint: retroUniforms.fillTint,
      uSkyTint: retroUniforms.skyTint,
      uGroundTint: retroUniforms.groundTint,
      uHeadTint: retroUniforms.headTint,
      uFogColor: opts.fogColor ? { value: new THREE.Color(opts.fogColor) } : retroUniforms.fogColor,
      uFogNear: { value: opts.fogNear ?? CONFIG.render.fogNear },
      uFogFar: { value: opts.fogFar ?? CONFIG.render.fogFar },
      uOpacity: { value: opts.opacity ?? 1 },
      uDither: { value: opts.dither ?? CONFIG.render.dither },
      uAlphaTest: { value: opts.alphaTest ?? 0.35 },
      uWobble: { value: opts.wobble ?? CONFIG.render.wobble },
      uSnap: { value: opts.snap ?? CONFIG.render.snapGrid },
      uUnlit: { value: opts.unlit ? 1 : 0 },
      uTime: retroUniforms.time,
    },
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: !!opts.transparent,
    side: opts.doubleSide ? THREE.DoubleSide : THREE.FrontSide,
    depthWrite: opts.depthWrite !== false,
  });
  matCache.set(key, m);
  return m;
}

export function createRenderer(container) {
  const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', alpha: false });
  renderer.setPixelRatio(1);
  renderer.setClearColor(CONFIG.render.colors.sky, 1);
  renderer.domElement.style.width = '100%';
  renderer.domElement.style.height = '100%';
  container.appendChild(renderer.domElement);
  return renderer;
}

/** Box helper with a texture / colour. */
/**
 * Chamfered box: the 6 faces are inset by a small bevel and joined by 12 edge strips and 8
 * corner facets, each with its own flat normal. Edges catch the light like a modelled prop
 * instead of a raw cube, while UVs follow BoxGeometry's per-face layout exactly so every
 * existing texture and repeat lands where it did before.
 */
const bevelCache = new Map();
function bevelBoxGeo(w, h, d) {
  const key = `${w.toFixed(4)}|${h.toFixed(4)}|${d.toFixed(4)}`;
  if (bevelCache.has(key)) return bevelCache.get(key);
  const b = Math.min(0.025, Math.min(w, h, d) * 0.12);
  if (b < 0.002) { const g0 = new THREE.BoxGeometry(w, h, d); bevelCache.set(key, g0); return g0; }
  const W = w / 2, H = h / 2, D = d / 2;
  // corner (sx,sy,sz) -> three points, one on each adjoining face
  const P = (sx, sy, sz, f) => (f === 0 ? [sx * W, sy * (H - b), sz * (D - b)] : f === 1 ? [sx * (W - b), sy * H, sz * (D - b)] : [sx * (W - b), sy * (H - b), sz * D]);
  const tris = [];
  const quad = (a, b2, c, e) => { tris.push([a, b2, c], [a, c, e]); };
  const S = [-1, 1];
  for (const s of S) {
    quad(P(s, -1, -1, 0), P(s, 1, -1, 0), P(s, 1, 1, 0), P(s, -1, 1, 0));
    quad(P(-1, s, -1, 1), P(1, s, -1, 1), P(1, s, 1, 1), P(-1, s, 1, 1));
    quad(P(-1, -1, s, 2), P(1, -1, s, 2), P(1, 1, s, 2), P(-1, 1, s, 2));
  }
  for (const s1 of S) for (const s2 of S) {
    quad(P(s1, s2, -1, 0), P(s1, s2, 1, 0), P(s1, s2, 1, 1), P(s1, s2, -1, 1));   // x-y edges (along z)
    quad(P(s1, -1, s2, 0), P(s1, 1, s2, 0), P(s1, 1, s2, 2), P(s1, -1, s2, 2));   // x-z edges (along y)
    quad(P(-1, s1, s2, 1), P(1, s1, s2, 1), P(1, s1, s2, 2), P(-1, s1, s2, 2));   // y-z edges (along x)
  }
  for (const sx of S) for (const sy of S) for (const sz of S) tris.push([P(sx, sy, sz, 0), P(sx, sy, sz, 1), P(sx, sy, sz, 2)]);

  const pos = [], uv = [];
  const v3 = (a) => new THREE.Vector3(a[0], a[1], a[2]);
  for (let [A, B, C] of tris) {
    const n = new THREE.Vector3().subVectors(v3(B), v3(A)).cross(new THREE.Vector3().subVectors(v3(C), v3(A)));
    const centre = v3(A).add(v3(B)).add(v3(C));
    if (n.dot(centre) < 0) { const tmp = B; B = C; C = tmp; n.negate(); }
    const ax = Math.abs(n.x), ay = Math.abs(n.y), az = Math.abs(n.z);
    const face = ax >= ay && ax >= az ? (n.x > 0 ? 'px' : 'nx') : ay >= az ? (n.y > 0 ? 'py' : 'ny') : (n.z > 0 ? 'pz' : 'nz');
    for (const q of [A, B, C]) {
      const [x, y, z] = q;
      const ux = (x + W) / w, uy = (y + H) / h, uz = (z + D) / d;
      let u, v;
      if (face === 'px') { u = 1 - uz; v = uy; } else if (face === 'nx') { u = uz; v = uy; }
      else if (face === 'py') { u = ux; v = 1 - uz; } else if (face === 'ny') { u = ux; v = uz; }
      else if (face === 'pz') { u = ux; v = uy; } else { u = 1 - ux; v = uy; }
      pos.push(x, y, z); uv.push(u, v);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  bevelCache.set(key, g);
  return g;
}

export function box(w, h, d, matOpts, pos = [0, 0, 0], rot = [0, 0, 0]) {
  const geo = bevelBoxGeo(w, h, d);
  const mat = matOpts instanceof THREE.Material ? matOpts : retroMaterial(matOpts.name || 'box', matOpts);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(pos[0], pos[1], pos[2]);
  mesh.rotation.set(rot[0], rot[1], rot[2]);
  return mesh;
}

/**
 * A tapered box (frustum) with the origin at the TOP centre and the body hanging
 * down the -Y axis, so it can be parented to a joint pivot. Flat-shaded quads and
 * per-face UVs — the workhorse for limbs, torsos and heads in the 90s rig style.
 */
export function taperGeo(wTop, wBot, dTop, dBot, h, uv = 1, groups = false) {
  const pos = [];
  const nor = [];
  const uvs = [];
  const counts = [];
  const tY = 0, bY = -h;
  const tw = wTop / 2, bw = wBot / 2, td = dTop / 2, bd = dBot / 2;

  // corners: top 0-3 (back-left, back-right, front-right, front-left), bottom 4-7
  const c = [
    [-tw, tY, -td], [tw, tY, -td], [tw, tY, td], [-tw, tY, td],
    [-bw, bY, -bd], [bw, bY, -bd], [bw, bY, bd], [-bw, bY, bd],
  ];

  function quad(a, b, d, e, uvw, uvh) {
    const p = [c[a], c[b], c[d], c[e]];
    // counter-clockwise as seen from outside => outward normal
    const n = new THREE.Vector3().subVectors(
      new THREE.Vector3(...c[d]), new THREE.Vector3(...c[a])
    ).cross(new THREE.Vector3().subVectors(
      new THREE.Vector3(...c[b]), new THREE.Vector3(...c[a])
    )).normalize();
    const uvq = [[0, uvh], [uvw, uvh], [uvw, 0], [0, 0]];
    const start = pos.length / 3;
    for (const i of [0, 2, 1, 0, 3, 2]) {
      pos.push(...p[i]);
      nor.push(n.x, n.y, n.z);
      uvs.push(uvq[i][0] * uv, uvq[i][1] * uv);
    }
    counts.push(pos.length / 3 - start);
  }

  quad(3, 2, 6, 7, 1, 1); // front +Z
  quad(1, 0, 4, 5, 1, 1); // back  -Z
  quad(0, 3, 7, 4, 1, 1); // left  -X
  quad(2, 1, 5, 6, 1, 1); // right +X
  quad(0, 1, 2, 3, 1, 1); // top
  quad(7, 6, 5, 4, 1, 1); // bottom

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  if (groups) {
    // group order matches the quad order below: front, back, left, right, top, bottom
    let start = 0;
    counts.forEach((count, i) => {
      g.addGroup(start, count, i);
      start += count;
    });
  }
  return g;
}

/**
 * One tapered box, one material per face. Used for heads: the front face carries the
 * portrait texture, the other five carry skin, so the art wraps a volume instead of
 * floating in front of it.
 */
export function taperMulti(wTop, wBot, dTop, dBot, h, materials, pos = [0, 0, 0], rot = [0, 0, 0]) {
  const mesh = new THREE.Mesh(taperGeo(wTop, wBot, dTop, dBot, h, 1, true), materials);
  mesh.position.set(pos[0], pos[1], pos[2]);
  mesh.rotation.set(rot[0], rot[1], rot[2]);
  return mesh;
}

/** Tapered box mesh hanging from its top face. */
export function taper(wTop, wBot, dTop, dBot, h, matOpts, pos = [0, 0, 0], rot = [0, 0, 0]) {
  const mat = matOpts instanceof THREE.Material ? matOpts : retroMaterial(matOpts.name || 'taper', matOpts);
  const mesh = new THREE.Mesh(taperGeo(wTop, wBot, dTop, dBot, h), mat);
  mesh.position.set(pos[0], pos[1], pos[2]);
  mesh.rotation.set(rot[0], rot[1], rot[2]);
  return mesh;
}

export function plane(w, h, matOpts, pos = [0, 0, 0], rot = [0, 0, 0]) {
  const geo = new THREE.PlaneGeometry(w, h);
  const mat = matOpts instanceof THREE.Material ? matOpts : retroMaterial(matOpts.name || 'plane', { ...matOpts, doubleSide: matOpts.doubleSide ?? true });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(pos[0], pos[1], pos[2]);
  mesh.rotation.set(rot[0], rot[1], rot[2]);
  return mesh;
}

export function setSize(renderer, camera, container) {
  const w = container.clientWidth || window.innerWidth;
  const h = container.clientHeight || window.innerHeight;
  const aspect = w / h;
  const ih = CONFIG.render.internalHeight;
  const iw = Math.max(160, Math.round(ih * aspect));
  renderer.setSize(iw, ih, false);
  camera.aspect = aspect;
  camera.updateProjectionMatrix();
}
