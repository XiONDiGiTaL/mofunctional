/**
 * PS1 rendering: affine texture mapping, vertex snapping, ordered dithering,
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

void main() {
  vec3 p = position;
  float sway = sin(uTime * 1.9 + position.x * 3.1 + position.y * 2.3 + position.z * 2.7);
  p += normal * sway * uWobble * 0.012;

  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vec4 clip = projectionMatrix * mv;

  // Vertex snapping: quantize screen-space position (classic PS1 jitter)
  vec2 ndc = clip.xy / clip.w;
  ndc = floor(ndc * uSnap + 0.5) / uSnap;
  clip.xy = ndc * clip.w;

  vUvA = uv * clip.w;     // affine mapping: divide by w again in the fragment shader
  vW = clip.w;
  vN = normalize(normalMatrix * normal);
  vDepth = -mv.z;
  gl_Position = clip;
}
`;

const FRAG = /* glsl */`
uniform sampler2D uMap;
uniform bool uUseMap;
uniform vec3 uColor;
uniform float uEmissive;
uniform vec3 uLightDir;
uniform float uAmbient;
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
  if (uUnlit < 0.5) {
    ndl = max(dot(normalize(vN), normalize(uLightDir)), 0.0);
    ndl = 0.55 + ndl * 0.45; // softened retro lambert
  }
  vec3 lit = base * mix(1.0, uAmbient + (1.0 - uAmbient) * ndl, 1.0);
  lit += base * uEmissive;

  float fogF = clamp((vDepth - uFogNear) / (uFogFar - uFogNear), 0.0, 1.0);
  fogF = pow(fogF, 0.85);
  lit = mix(lit, uFogColor, fogF);

  // 4x4 ordered dithering + 5-bit color quantization
  float d = bayer4(gl_FragCoord.xy) - 0.5;
  lit = floor(lit * 31.0 + 0.5 + d * uDither) / 31.0;

  gl_FragColor = vec4(lit, uOpacity);
}
`;

export const ps1Uniforms = {
  time: { value: 0 },
  lightDir: { value: new THREE.Vector3(...CONFIG.render.lightDir).normalize() },
  fogColor: { value: new THREE.Color(CONFIG.render.colors.fog) },
  fogNear: { value: CONFIG.render.fogNear },
  fogFar: { value: CONFIG.render.fogFar },
};

const matCache = new Map();

export function ps1Material(name, opts = {}) {
  const key = `${name}|${JSON.stringify(opts)}`;
  if (matCache.has(key)) return matCache.get(key);
  const m = new THREE.ShaderMaterial({
    uniforms: {
      uMap: { value: opts.map || null },
      uUseMap: { value: !!opts.map },
      uColor: { value: new THREE.Color(opts.color ?? 0xffffff) },
      uEmissive: { value: opts.emissive ?? 0 },
      uAmbient: { value: opts.ambient ?? CONFIG.render.ambient },
      uLightDir: ps1Uniforms.lightDir,
      uFogColor: opts.fogColor ? { value: new THREE.Color(opts.fogColor) } : ps1Uniforms.fogColor,
      uFogNear: { value: opts.fogNear ?? CONFIG.render.fogNear },
      uFogFar: { value: opts.fogFar ?? CONFIG.render.fogFar },
      uOpacity: { value: opts.opacity ?? 1 },
      uDither: { value: opts.dither ?? CONFIG.render.dither },
      uAlphaTest: { value: opts.alphaTest ?? 0.35 },
      uWobble: { value: opts.wobble ?? CONFIG.render.wobble },
      uSnap: { value: opts.snap ?? CONFIG.render.snapGrid },
      uUnlit: { value: opts.unlit ? 1 : 0 },
      uTime: ps1Uniforms.time,
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
export function box(w, h, d, matOpts, pos = [0, 0, 0], rot = [0, 0, 0]) {
  const geo = new THREE.BoxGeometry(w, h, d);
  const mat = matOpts instanceof THREE.Material ? matOpts : ps1Material(matOpts.name || 'box', matOpts);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(pos[0], pos[1], pos[2]);
  mesh.rotation.set(rot[0], rot[1], rot[2]);
  return mesh;
}

export function plane(w, h, matOpts, pos = [0, 0, 0], rot = [0, 0, 0]) {
  const geo = new THREE.PlaneGeometry(w, h);
  const mat = matOpts instanceof THREE.Material ? matOpts : ps1Material(matOpts.name || 'plane', { ...matOpts, doubleSide: matOpts.doubleSide ?? true });
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
