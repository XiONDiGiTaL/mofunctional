/**
 * Shared pieces for the street side of the subway and Mo's clothes:
 *
 *   buildStationEntrance   the stair down from Kestrel St (a real shaft in the pavement) or Ashby
 *                          Av (painted down a dark well), with green railings, globe lamps on two
 *                          posts and the station sign along the back rail
 *   closetMenu             the closet in Unit 3B: change into anything he owns
 *
 * The station itself and the stops past it are in underground.js.
 */
import * as THREE from '../../vendor/three.module.js';
import { retroMaterial, box, plane } from '../render/retro.js';
import { tex } from '../render/textures.js';
import { signTex } from '../render/signs.js';
import * as wardrobe from '../systems/wardrobe.js';

/**
 * The way down, from the street: a stairwell cut into the sidewalk, railings either side, a lit
 * globe on each post and a band over the mouth with the station on it. Both stations used to be
 * an invisible trigger on the pavement, which is why nobody could find the trains.
 */
export function buildStationEntrance(x, z, { rot = 0, name = 'KESTREL ST', painted = false } = {}) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = rot;
  const green = retroMaterial('st_green', { color: 0x2f6b48, ambient: 0.85 });
  const greenDark = retroMaterial('st_greenDark', { color: 0x1d4a32, ambient: 0.7 });
  const stepMat = retroMaterial('st_step', { color: 0xa8a8a0, map: tex('concrete'), ambient: 0.8 });
  const globe = retroMaterial('st_globe', { color: 0xf8f4e0, emissive: 1.1, unlit: true });

  if (painted) {
    // no hole in this pavement: a dark well with the treads painted down it, so it still reads as
    // a stair going under the street
    g.add(plane(2.7, 3.9, { name: 'st_well', color: 0x0a0a0c }, [0, 0.012, -1.6], [-Math.PI / 2, 0, 0]));
    for (let i = 0; i < 9; i++) {
      const c = Math.max(0x1a1a18, 0x6a6a64 - i * 0x090909);
      g.add(plane(2.5, 0.12, { name: `st_tread${i}`, color: c }, [0, 0.014, -0.2 - i * 0.38], [-Math.PI / 2, 0, 0]));
    }
  } else {
    // the shaft the stair runs down into, open to the sky on the street side
    for (const sx of [-1, 1]) g.add(box(0.18, 2.9, 3.9, greenDark, [sx * 1.36, -1.2, -1.55]));
    g.add(box(2.9, 2.9, 0.24, greenDark, [0, -1.2, -3.5]));
    g.add(plane(2.7, 3.9, { name: 'st_floor', color: 0x14181e }, [0, -2.62, -1.6], [-Math.PI / 2, 0, 0]));
    // ten steps down, tread and riser, with a handrail stepping down beside them
    for (let i = 0; i < 10; i++) {
      const y = -0.1 - i * 0.22;
      const zz = -0.2 - i * 0.33;
      g.add(box(2.5, 0.1, 0.34, stepMat, [0, y, zz]));
      g.add(box(2.5, 0.22, 0.05, i % 2 ? greenDark : green, [0, y - 0.11, zz - 0.17]));
      for (const sx of [-1, 1]) {
        g.add(box(0.06, 0.06, 0.36, green, [sx * 1.2, y + 0.9, zz]));
        g.add(box(0.05, 0.85, 0.05, green, [sx * 1.2, y + 0.45, zz - 0.15]));
      }
    }
    // one bulb at the bottom of the well, so it is dark and not black
    g.add(plane(1.4, 0.4, { name: 'st_walllight', color: 0xffe9b0, emissive: 1, unlit: true }, [0, -1.05, -3.36]));
  }

  // the railings the city paints green: a top rail, a kick rail and pickets, down both sides and
  // across the back, open at the mouth
  const rail = (x0, z0, x1, z1) => {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const r = new THREE.Group();
    r.position.set((x0 + x1) / 2, 0, (z0 + z1) / 2);
    r.rotation.y = -Math.atan2(z1 - z0, x1 - x0);
    r.add(box(len, 0.07, 0.07, green, [0, 1.02, 0]));
    r.add(box(len, 0.05, 0.05, green, [0, 0.14, 0]));
    const n = Math.round(len / 0.18);
    for (let i = 0; i <= n; i++) r.add(box(0.03, 0.9, 0.03, greenDark, [-len / 2 + i * (len / n), 0.58, 0]));
    g.add(r);
  };
  rail(-1.42, 0.45, -1.42, -3.5);
  rail(1.42, 0.45, 1.42, -3.5);
  rail(-1.42, -3.5, 1.42, -3.5);
  for (const [px, pz] of [[-1.42, -3.5], [1.42, -3.5]]) g.add(box(0.11, 1.15, 0.11, greenDark, [px, 0.57, pz]));
  // at the mouth: two tall round lamp posts with white globes, the way the old ones look
  for (const sx of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.085, 2.7, 7), green);
    post.position.set(sx * 1.42, 1.35, 0.45);
    g.add(post);
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.07, 0.1, 7), greenDark).translateX(sx * 1.42).translateY(2.7).translateZ(0.45));
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.21, 9, 7), globe);
    ball.position.set(sx * 1.42, 2.92, 0.45);
    g.add(ball);
  }
  // the station sign along the back rail, facing the street
  g.add(box(2.95, 0.62, 0.08, greenDark, [0, 1.42, -3.52]));
  g.add(plane(2.8, 0.52, {
    name: 'st_sign',
    map: signTex(`st_${name.replace(/\s/g, '')}`, [
      { text: `${name} STATION`, color: '#ffffff', size: 10 },
      { text: 'K · Park Slope · Downtown · Kestrel Houses', color: '#e0e0d8', size: 4.5 },
    ], { w: 160, h: 40, bg: '#141414', border: '#3a3a3a' }),
    emissive: 0.9, unlit: true,
  }, [0, 1.42, -3.47]));
  return g;
}

export function closetMenu(g) {
  const w = wardrobe.wardrobeState(g.state);
  const defs = wardrobe.owned(g.state);
  g.openModal({
    kicker: 'UNIT 3B · THE CLOSET', title: 'What To Wear',
    body: 'A rail, four hangers, and a shelf with nothing on it. The mirror is a poster of a mirror.',
    choices: [
      ...defs.map((o) => ({
        label: `Wear the ${o.name}.`, sub: w.worn === o.id ? 'already on' : '', disabled: w.worn === o.id,
        effect: () => wardrobe.wear(g, o.id),
      })),
      { label: 'Close the closet.', effect: () => {} },
    ],
  });
}

