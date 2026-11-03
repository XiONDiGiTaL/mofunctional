/**
 * The third floor of 1120 Kestrel: the hallway between the street and Unit 3B. Four doors (3A
 * Mrs. Pryce, 3B Mo, 3C the Delgados, 3D Marcus), the stairs at the north end, a radiator that
 * knocks, a ceiling light that does not decide, and the bulletin board where the building gets
 * organized (systems/tenants.js).
 */
import { retroMaterial, box, plane } from '../render/retro.js';
import { tex } from '../render/textures.js';
import { signTex } from '../render/signs.js';
import * as THREE from '../../vendor/three.module.js';
import { minuteOfDay, pick } from '../core/util.js';
import * as tenants from '../systems/tenants.js';

const solid = (x, z, w, d, h = 2.4) => ({ x, z, w, d, h });

export function buildHall(g) {
  const s = g.state;
  const group = new THREE.Group();
  const W = 3.2, D = 11;
  const wall = retroMaterial('h3_wall', { map: tex('wallpaper'), color: 0xb8aa8a });
  const wood = retroMaterial('h3_wood', { map: tex('wood'), color: 0x6a4a32 });
  const door = retroMaterial('h3_door', { color: 0x5a3a2a });
  const metal = retroMaterial('h3_metal', { color: 0x6a6e72 });
  group.add(plane(W, D, { name: 'h3_floor', map: tex('linoleum'), repeat: [2, 6] }, [0, 0, 0], [-Math.PI / 2, 0, 0]));
  group.add(plane(W, D, { name: 'h3_ceil', map: tex('ceiling'), repeat: [2, 6] }, [0, 2.8, 0], [Math.PI / 2, 0, 0]));
  group.add(box(0.16, 2.8, D, wall, [-W / 2, 1.4, 0]));
  group.add(box(0.16, 2.8, D, wall, [W / 2, 1.4, 0]));
  group.add(box(W, 2.8, 0.16, wall, [0, 1.4, D / 2]));
  group.add(box(W, 2.8, 0.16, wall, [0, 1.4, -D / 2]));
  for (const sx of [-1, 1]) group.add(box(0.04, 0.14, D, retroMaterial('h3_base', { color: 0x3a2e24 }), [sx * (W / 2 - 0.09), 0.07, 0]));
  // the light that cannot decide, and two that can
  for (const z of [3.4, -0.2, -3.6]) group.add(box(0.5, 0.06, 0.5, retroMaterial(z === -0.2 ? 'h3_dim' : 'h3_lamp', { color: z === -0.2 ? 0x8a8268 : 0xfff2c4, emissive: z === -0.2 ? 0.3 : 1, unlit: true }), [0, 2.76, z]));
  // the window at the south end, the radiator under it
  // (a small high window: the lens sits at this end of the hall, and a big one filled the frame)
  group.add(plane(0.7, 0.45, { name: 'h3_win', map: tex('window'), emissive: 0.4, unlit: true }, [0.9, 2.3, D / 2 - 0.09], [0, Math.PI, 0]));
  for (let i = 0; i < 8; i++) group.add(box(0.06, 0.6, 0.16, metal, [-0.4 + i * 0.12, 0.4, D / 2 - 0.2]));
  // the stairs, going down at the north end, with a railing and a sign
  group.add(plane(1.2, 1.8, { name: 'h3_well', color: 0x0a0a0c }, [0.9, 0.006, -4.4], [-Math.PI / 2, 0, 0]));
  for (let i = 0; i < 4; i++) group.add(box(1.1, 0.06, 0.3, retroMaterial('h3_step', { map: tex('concrete') }), [0.9, 0.02, -3.7 - i * 0.38]));
  group.add(box(0.05, 0.9, 1.8, metal, [0.27, 0.45, -4.4]));
  group.add(plane(1.0, 0.3, { name: 'h3_down', map: signTex('h3Down', [{ text: 'STAIRS ▼ STREET', color: '#ffe9a0', size: 8 }], { w: 72, h: 18, bg: '#2a2420', border: '#c8a050' }), emissive: 0.7, unlit: true }, [0.9, 2.2, -D / 2 + 0.1]));
  group.add(plane(1.0, 0.4, { name: 'h3_floornum', map: signTex('h3Floor', [{ text: 'FLOOR 3', color: '#f2e8c8', size: 10 }], { w: 64, h: 24, bg: '#2a2420', border: '#8a7452' }), emissive: 0.6, unlit: true }, [-W / 2 + 0.1, 1.9, -3.2], [0, Math.PI / 2, 0]));
  // the bulletin board, by the stairs
  group.add(box(0.06, 0.9, 1.2, wood, [-W / 2 + 0.1, 1.5, -1.6]));
  group.add(plane(1.1, 0.8, { name: 'h3_cork', color: 0xa8784a }, [-W / 2 + 0.14, 1.5, -1.6], [0, Math.PI / 2, 0]));
  const t = tenants.tenantsState(s);
  for (let i = 0; i < 2 + Object.keys(t.complaints).length; i++) group.add(plane(0.22, 0.28, { name: `h3_paper${i}`, color: i === 0 ? 0xf2f0e4 : 0xe8e0b0 }, [-W / 2 + 0.15, 1.45 + (i % 2) * 0.22, -2.0 + i * 0.22], [0, Math.PI / 2, (i % 3 - 1) * 0.1]));

  const interactables = [];
  const solids = [solid(-0.4, D / 2 - 0.25, 1.2, 0.3, 0.7), solid(0.27, -4.4, 0.1, 1.8, 0.9)];
  const doorAt = (side, z, label, action, sub = '') => {
    const x = side * (W / 2 - 0.07);
    group.add(box(0.1, 2.2, 1.0, door, [x, 1.1, z]));
    group.add(plane(0.3, 0.16, { name: `h3_num${label}`, map: signTex(`h3Num${label}`, [{ text: label, color: '#e8e8e0', size: 9 }], { w: 32, h: 16, bg: '#2a2a2a', border: '#c8a050' }), emissive: 0.4, unlit: true }, [x - side * 0.07, 1.85, z], [0, -side * Math.PI / 2, 0]));
    interactables.push({ id: `h3_${label}`, label: label === '3B' ? 'Unit 3B · home' : `Knock on ${label}`, sub, x: side * (W / 2 - 0.55), z, radius: 1.0, action });
  };
  doorAt(-1, 1.6, '3A', (gg) => tenants.knock(gg, '3A'), t.complaints['3A'] ? 'Mrs. Pryce · on the list' : 'Mrs. Pryce');
  doorAt(-1, 3.8, '3B', (gg) => gg.goTo('apartment', 'hall'), 'your door · the lock sticks');
  doorAt(1, 1.6, '3C', (gg) => tenants.knock(gg, '3C'), t.complaints['3C'] ? 'the Delgados · on the list' : 'the Delgados');
  doorAt(1, 3.8, '3D', (gg) => tenants.knock(gg, '3D'), t.complaints['3D'] ? 'Marcus · on the list' : 'Marcus');
  interactables.push(
    { id: 'h3_board', label: 'The bulletin board', sub: t.meeting && !t.meeting.held ? `meeting day ${t.meeting.day}, 19:00` : 'repairs · the heat · a meeting', x: -0.9, z: -1.6, radius: 1.0, action: (gg) => tenants.boardMenu(gg) },
    { id: 'h3_stairs', label: 'Down to the street', sub: 'three flights · the elevator was never a thing here', x: 0.9, z: -3.3, radius: 1.0, action: (gg) => { gg.advance(1); gg.goTo('street', 'apartment'); } },
    { id: 'h3_radiator', label: 'The radiator', sub: s.flags?.heatFixed ? 'warm, for once' : 'cold, as usual', x: -0.4, z: D / 2 - 0.9, radius: 0.9, action: (gg) => gg.toast(gg.state.flags?.heatFixed ? 'Warm. Actually warm. You stand next to it longer than you need to.' : pick(['Cold. It knocks twice to let you know it heard you, and does nothing.', 'You put your hand on it. It is the temperature of a decision Rae made in 1994.']), 'info') },
  );

  // the neighbours, in the hall some of the time
  const m = minuteOfDay(s.clock.m);
  const npcs = [];
  if (m >= 9 * 60 && m < 19 * 60 && Math.random() < 0.5) npcs.push({ kind: 'tenant_f', x: -0.6, z: 1.0, rot: 1.2, still: true, act: 'talk', talk: 'h3_3A' });
  if ((m >= 19 * 60 || m < 2 * 60) && Math.random() < 0.4) npcs.push({ kind: 'passer_m', x: 0.7, z: 3.0, rot: -1.8, still: true, act: 'phone', talk: 'h3_3D' });
  if (t.meeting?.held === false && t.meeting.day === Math.floor(s.clock.m / 1440) + 1 && m >= 19 * 60 && m < 22 * 60) {
    for (const [kind, x, z, rot] of [['tenant_f', -0.7, -0.6, 1.2], ['hall_m', 0.7, -0.4, -1.4], ['passer_m', 0.2, 0.6, Math.PI], ['hall_f', -0.3, 0.9, 2.6]]) npcs.push({ kind, x, z, rot, still: true, act: 'talk' });
  }

  return {
    group, title: '1120 Kestrel · 3rd floor',
    bounds: { minX: -W / 2 + 0.3, maxX: W / 2 - 0.3, minZ: -D / 2 + 0.4, maxZ: D / 2 - 0.4 },
    solids,
    spawn: { x: -0.6, z: 3.8, rot: Math.PI / 2 },
    spawnFor: (from) => (from === 'apartment' ? { x: -0.6, z: 3.8, rot: Math.PI / 2 } : { x: 0.6, z: -3.0, rot: Math.PI }),
    npcs,
    interactables,
    ambient: 'interior',
  };
}
