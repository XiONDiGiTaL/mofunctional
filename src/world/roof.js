/**
 * The roofs: 1120 (Mo's, where the door alarm has not worked since Rae "fixed" it) and 1104 (the
 * walk-up, where the door says ALARM WILL SOUND and the alarm has not sounded since 1989). Tar
 * paper, a parapet, a chimney, the steel frame of a water tower nobody refilled, a lawn chair with
 * one good leg, and the city all the way round. A place to smoke, to get high if that is the
 * night, or just to stand at the edge and get some quiet back.
 */
import { retroMaterial, box, plane } from '../render/retro.js';
import { tex } from '../render/textures.js';
import { signTex } from '../render/signs.js';
import * as THREE from '../../vendor/three.module.js';
import { minuteOfDay, dayOf, pick } from '../core/util.js';
import { bump, countItem, logLine } from '../core/state.js';
import { CONFIG } from '../core/config.js';
import { eat, useSubstance } from '../systems/needs.js';

const solid = (x, z, w, d, h = 2.4) => ({ x, z, w, d, h });

export function buildRoof(g) {
  const s = g.state;
  const which = s.roofOf === '1104' ? '1104' : '1120';
  const group = new THREE.Group();
  const W = 14, D = 10;
  const tar = retroMaterial('rf_tar', { map: tex('concrete'), color: 0x5a5a5e });
  const brick = retroMaterial('rf_brick', { map: tex('brick'), color: which === '1120' ? 0xa86a4a : 0x9a8a7e });
  const steel = retroMaterial('rf_steel', { color: 0x3a2e28 });
  group.add(plane(W, D, { name: `rf_floor${which}`, map: tex('concrete'), color: 0x55565a, repeat: [6, 4] }, [0, 0, 0], [-Math.PI / 2, 0, 0]));
  // the parapet all the way round, capped
  for (const [x, z, w, d] of [[0, -D / 2, W, 0.3], [0, D / 2, W, 0.3], [-W / 2, 0, 0.3, D], [W / 2, 0, 0.3, D]]) {
    group.add(box(w, 0.8, d, brick, [x, 0.4, z]));
    group.add(box(w + 0.1, 0.08, d + 0.1, retroMaterial('rf_cap', { color: 0x6a6a6e }), [x, 0.84, z]));
  }
  // the bulkhead the stairs come up into, with its door and (on 1104) the alarm notice
  group.add(box(2.4, 2.6, 2.0, brick, [-4.6, 1.3, 2.8]));
  group.add(box(0.9, 2.0, 0.08, retroMaterial('rf_door', { color: 0xe8e8e0 }), [-4.6, 1.0, 1.78]));
  group.add(plane(0.8, 0.26, { name: `rf_alarm${which}`, map: which === '1104'
    ? signTex('rfAlarm1104', [{ text: 'EMERGENCY EXIT', color: '#ffffff', size: 6 }, { text: 'ALARM WILL SOUND', color: '#ffe23a', size: 6 }], { w: 72, h: 22, bg: '#c81e1e' })
    : signTex('rfAlarm1120', [{ text: 'ALARM WILL SOUND', color: '#5a5a5a', size: 6 }, { text: 'BROKEN · R.V.', color: '#1a1a1a', size: 6 }], { w: 72, h: 22, bg: '#d8d4c8', border: '#8a8a8a' }), emissive: 0.5 }, [-4.6, 2.2, 1.76], [0, Math.PI, 0]));
  // a chimney, vents, the water tower's frame, a puddle that never dries
  group.add(box(0.8, 1.6, 0.8, brick, [3.4, 0.8, -2.6]));
  for (const [x, z] of [[-1.5, -2.8], [1.2, 1.4], [4.8, 2.6], [-2.6, -0.4]]) group.add(box(0.25, 0.3, 0.25, retroMaterial('rf_vent', { color: 0x8a8a8e }), [x, 0.15, z]));
  const tower = new THREE.Group();
  for (const [x, z] of [[-0.9, -0.9], [0.9, -0.9], [-0.9, 0.9], [0.9, 0.9]]) tower.add(box(0.14, 3.2, 0.14, steel, [x, 1.6, z]));
  for (const y of [1.0, 2.2, 3.2]) { tower.add(box(1.94, 0.12, 0.12, steel, [0, y, -0.9])); tower.add(box(1.94, 0.12, 0.12, steel, [0, y, 0.9])); tower.add(box(0.12, 0.12, 1.94, steel, [-0.9, y, 0])); tower.add(box(0.12, 0.12, 1.94, steel, [0.9, y, 0])); }
  tower.add(box(0.1, 2.6, 0.1, steel, [0, 1.6, -0.9], [0, 0, 0.6]));
  tower.add(box(0.1, 2.6, 0.1, steel, [0, 1.6, 0.9], [0, 0, -0.6]));
  tower.position.set(4.6, 0, -3.2);
  group.add(tower);
  group.add(plane(1.4, 0.9, { name: 'rf_puddle', color: 0x7a8a9a, opacity: 0.5, transparent: true, unlit: true }, [0.5, 0.012, -1.0], [-Math.PI / 2, 0, 0]));
  // the lawn chair, by the north parapet, facing the city
  const chair = retroMaterial('rf_chair', { color: 0x3a8a6a });
  group.add(box(0.6, 0.05, 0.6, chair, [-1.0, 0.42, -3.6]));
  group.add(box(0.6, 0.6, 0.05, chair, [-1.0, 0.7, -3.3], [-0.2, 0, 0]));
  for (const [dx, dz] of [[-0.28, -0.28], [0.28, -0.28], [-0.28, 0.28], [0.28, 0.28]]) group.add(box(0.04, 0.42, 0.04, retroMaterial('rf_chairleg', { color: 0xb8b8b8 }), [-1.0 + dx, 0.21, -3.6 + dz]));
  // the city all the way round: blocks at different heights, lit windows, water towers on top
  let seed = which === '1120' ? 11 : 23;
  const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
  const night = minuteOfDay(s.clock.m) >= 19 * 60 || minuteOfDay(s.clock.m) < 6 * 60;
  const ring = (cx, cz, along) => {
    for (let i = -3; i <= 3; i++) {
      // the neighbours' roofs sit around this one: some lower, some a few floors higher
      const w = 4 + rnd() * 5, top = -1.5 + rnd() * 8, bottom = -16, dist = 9 + rnd() * 9;
      const h = top - bottom;
      const x = along === 'x' ? cx + i * 6.5 : cx * dist / 10;
      const z = along === 'x' ? cz * dist / 10 : cz + i * 6.5;
      const col = [0xb8805e, 0xd0c0a8, 0x9a9aa4, 0xe0cca8, 0xa8684e][Math.floor(rnd() * 5)];
      group.add(box(w, h, w, retroMaterial(`rf_city${col}`, { map: tex('brick'), color: col }), [x, bottom + h / 2, z]));
      const face = along === 'x' ? (z < 0 ? w / 2 + 0.03 : -w / 2 - 0.03) : (x < 0 ? w / 2 + 0.03 : -w / 2 - 0.03);
      for (let k = 0; k < 8; k++) if (rnd() < (night ? 0.55 : 0.2)) {
        const off = (rnd() - 0.5) * w * 0.8, wy = top - 0.8 - rnd() * 6;
        group.add(box(along === 'x' ? 0.5 : 0.05, 0.6, along === 'x' ? 0.05 : 0.5, retroMaterial('rf_cityWin', { color: 0xffd77a, emissive: 1, unlit: true }), along === 'x' ? [x + off, wy, z + face] : [x + face, wy, z + off]));
      }
      if (rnd() < 0.4) { group.add(box(1.2, 1.4, 1.2, retroMaterial('rf_tank', { color: 0x5a3a2a }), [x, top + 1.6, z])); group.add(box(1.4, 0.4, 1.4, retroMaterial('rf_tanktop', { color: 0x3a2a1e }), [x, top + 2.4, z])); for (const [lx, lz] of [[-0.5, -0.5], [0.5, 0.5], [-0.5, 0.5], [0.5, -0.5]]) group.add(box(0.08, 0.9, 0.08, steel, [x + lx, top + 0.45, z + lz])); }
    }
  };
  ring(0, -14, 'x'); ring(0, 14, 'x'); ring(-17, 0, 'z'); ring(17, 0, 'z');

  const day = dayOf(s.clock.m);
  const interactables = [
    { id: 'rf_down', label: 'Back down the stairs', sub: which === '1120' ? 'to the third floor' : 'to the 5th floor of 1104', x: -4.6, z: 1.3, radius: 1.0, action: (gg) => { if (which === '1120') { gg.state.b1120 = { ...(gg.state.b1120 || {}), floor: 3 }; gg.goTo('hall', 'roof'); } else { gg.state.walkup = { ...(gg.state.walkup || {}), floor: 4 }; gg.goTo('walkup', 'roof'); } } },
    { id: 'rf_edge', label: 'Stand at the edge and look', sub: s.flags.roofClarity === day ? 'you already found some today' : 'clarity · the whole city at once', x: 0, z: -4.2, radius: 1.4, action: (gg) => clarity(gg, which) },
    { id: 'rf_smoke', label: 'Smoke up here', sub: countItem(s, 'loosies') ? 'a loosie · the wind takes it' : 'you have nothing to smoke', x: 2.4, z: -3.8, radius: 1.2, action: (gg) => smoke(gg) },
    { id: 'rf_high', label: 'Get high up here', sub: 'out of the way of everybody', x: -2.6, z: -3.8, radius: 1.2, action: (gg) => highUp(gg) },
  ];
  return {
    group, title: which === '1120' ? '1120 Kestrel · the roof' : '1104 Kestrel · the roof',
    bounds: { minX: -W / 2 + 0.5, maxX: W / 2 - 0.5, minZ: -D / 2 + 0.5, maxZ: D / 2 - 0.5 },
    camBounds: { minX: -W / 2 - 2, maxX: W / 2 + 2, minZ: -D / 2 - 2, maxZ: D / 2 + 2 },
    fogNear: 14, fogFar: 70,
    solids: [solid(-4.6, 2.8, 2.4, 2.0, 2.6), solid(3.4, -2.6, 0.8, 0.8, 1.6), solid(4.6, -3.2, 2.0, 2.0, 3.2), solid(-1.0, -3.5, 0.7, 0.7, 0.8)],
    seats: [{ x: -1.0, z: -3.55, rot: Math.PI, label: 'Sit in the lawn chair', sub: 'one good leg · the best seat in the borough' }],
    spawn: { x: -4.6, z: 1.0, rot: Math.PI },
    npcs: [],
    interactables,
  };
}

/** The edge: the city all at once, and a little of the week back. Once a day it really lands. */
function clarity(g, which) {
  const s = g.state;
  const day = dayOf(s.clock.m);
  const night = minuteOfDay(s.clock.m) >= 19 * 60 || minuteOfDay(s.clock.m) < 6 * 60;
  g.advance(30);
  if (s.flags.roofClarity === day) { bump(s, 'stress', -3); g.toast('The city is still there. So are you. That is enough for a second time today.', 'info'); return; }
  s.flags.roofClarity = day;
  bump(s, 'stress', -14);
  bump(s, 'morale', 10);
  s.stats.withdrawal = Math.max(0, s.stats.withdrawal - 6);
  logLine(g, 'Stood on the roof and got some quiet back.', 'good');
  g.toast(night
    ? pick(['A million windows, every one of them somebody else’s whole life. Yours is one of them. From up here it looks small enough to carry.', 'A helicopter goes over, a train goes under, and for ten minutes nobody needs anything from you. You remember what you were like before the week started.', 'The Fellowship’s gold roof catches the streetlight. The park is a dark square. Somewhere down there is the version of you that is going to be okay. You can see the block he lives on.'])
    : pick(['Water towers, pigeons, a man on the next roof hanging laundry. The week is still the week, but it fits in your hands again.', 'The wind up here does not care about rent. You stand in it until you do not either, for a minute.', 'You can see the Quik-Stop, the park, the clinic, the whole map of your problems, and from up here they are all walking distance.']), 'good');
}

function smoke(g) {
  const s = g.state;
  if (!countItem(s, 'loosies')) { g.toast('Nothing to smoke. Miguel sells loosies two for a dollar fifty.', 'info'); return; }
  if (eat(g, 'loosies')) {
    g.world?.playEat?.('loosies');
    bump(s, 'stress', -4);
    g.toast('The wind takes the smoke before you are done with it. Up here even that feels like a favour.', 'good');
  }
}

function highUp(g) {
  const s = g.state;
  const owned = Object.keys(CONFIG.substances.types).filter((id) => countItem(s, id) > 0);
  if (!owned.length) { g.toast('Nothing on you. Up here that might be the point.', 'info'); return; }
  g.openModal({
    kicker: 'THE ROOF', title: 'Up Here',
    body: 'Nobody comes up here. That is the appeal, and the problem.',
    choices: [
      ...owned.map((id) => ({ label: `Use the ${CONFIG.items[id]?.name || id}.`, sub: 'the city goes soft at the edges', effect: () => { if (useSubstance(g, id)) bump(s, 'stress', -4); } })),
      { label: 'Not tonight. Just the view.', sub: '+morale', effect: () => { bump(s, 'morale', 3); g.toast('You put it back in your pocket and look at the city instead. It is enough. Tonight it is enough.', 'good'); } },
    ],
  });
}
