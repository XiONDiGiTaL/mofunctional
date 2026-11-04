/**
 * MR. POOPIE.
 *
 * The Mister Softee of this city: a white-and-blue van with a bell, a menu of cones, and a window
 * in the side. It comes down the curb lane, and in the middle of the day and again in the evening
 * it pulls in, unfolds an awning and sells ice cream to whoever is standing at the kerb — kids
 * first, then whoever else has decided they are a kid today. The man inside leans out in a costume
 * that is a pile of poop with eyes. Nobody in the neighbourhood has ever mentioned this, which is
 * the joke.
 *
 * It is not part of world/traffic.js. Traffic is anonymous, keeps its lane and never stops; this
 * has a route, a parking spot, a queue, a vendor and a food item. It parks in the curb lane with
 * the window on the pavement side, takes that lane out of the traffic pool while it is stopped so
 * nothing drives through it, and puts the lane back when it leaves.
 */
import * as THREE from '../../vendor/three.module.js';
import { box, plane, retroMaterial } from '../render/retro.js';
import { signTex } from '../render/signs.js';
import { createNPC, animateNPC } from './characters.js';
import { addItem } from '../core/state.js';
import { pick, minuteOfDay, money } from '../core/util.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
/** When the truck works: lunch, and the after-school-to-dinner stretch. */
const OPEN = [[11 * 60 + 30, 15 * 60], [16 * 60, 19 * 60 + 30]];
const isServingTime = (m) => OPEN.some(([a, b]) => m >= a && m < b);
const CONE_PRICE = 2.5;
const KINDS = ['kid', 'kid', 'kid', 'passer_m2', 'tenant_f', 'w3', 'w12', 'passer_m', 'kid', 'hall_f'];

/* ---------------------------------------------------------------- the mascot, as a canvas */

let poopTex = null;
/** The pile from the emoji, drawn in blocks so it sits in the same chunky frame as every sign. */
function mascot() {
  if (poopTex) return poopTex;
  const S = 8;
  const c = document.createElement('canvas');
  c.width = 32 * S; c.height = 32 * S;
  const x = c.getContext('2d');
  x.imageSmoothingEnabled = false;
  x.clearRect(0, 0, c.width, c.height);
  const dark = '#4a2c16';
  const mid = '#6b3f1d';
  const light = '#7d4a22';
  const px = (bx, by, bw, bh, col) => { x.fillStyle = col; x.fillRect(bx * S, by * S, bw * S, bh * S); };
  // the mound: three steps and a curl on top, lighter where the light would hit it
  px(5, 22, 22, 6, mid);
  px(7, 21, 18, 2, light);
  px(8, 16, 16, 6, mid);
  px(8, 15, 14, 2, light);
  px(11, 11, 10, 5, mid);
  px(11, 10, 8, 2, light);
  px(14, 7, 4, 4, mid);
  px(15, 5, 3, 2, mid);
  px(5, 28, 22, 1, dark);
  // eyes: whites with pupils, and the smile off the emoji
  px(11, 17, 4, 4, '#ffffff');
  px(17, 17, 4, 4, '#ffffff');
  px(12, 18, 2, 2, '#1a1208');
  px(18, 18, 2, 2, '#1a1208');
  px(13, 23, 6, 1, '#ffffff');
  px(12, 22, 1, 1, '#ffffff');
  px(19, 22, 1, 1, '#ffffff');
  px(13, 24, 4, 1, '#ffffff');
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.colorSpace = THREE.SRGBColorSpace;
  poopTex = t;
  return t;
}

/* ---------------------------------------------------------------- the man in the costume */

/**
 * The vendor: a white cap, a white apron, and a head that is the mascot, poking out of the window.
 * Kept as its own little group so it can lean out and look along the line.
 */
function buildVendor() {
  const g = new THREE.Group();
  const white = retroMaterial('mrp_white', { color: 0xf2f2ee });
  const brown = retroMaterial('mrp_brown', { color: 0x6b3f1d });
  const dark = retroMaterial('mrp_dark', { color: 0x4a2c16 });
  g.add(box(0.42, 0.5, 0.26, white, [0, 0.25, 0]));
  for (const s of [-1, 1]) g.add(box(0.1, 0.42, 0.1, brown, [s * 0.26, 0.3, 0.02], [0, 0, s * 0.25]));
  const head = new THREE.Group();
  head.add(box(0.34, 0.1, 0.3, dark, [0, 0.02, 0]));
  head.add(box(0.3, 0.09, 0.27, brown, [0, 0.1, 0]));
  head.add(box(0.22, 0.09, 0.22, dark, [0, 0.185, 0]));
  head.add(box(0.13, 0.08, 0.14, brown, [0, 0.26, 0]));
  head.add(box(0.07, 0.07, 0.08, dark, [0, 0.32, 0]));
  for (const s of [-1, 1]) {
    head.add(box(0.06, 0.06, 0.02, retroMaterial('mrp_eye', { color: 0xffffff, unlit: true }), [s * 0.06, 0.11, -0.14]));
    head.add(box(0.025, 0.03, 0.02, retroMaterial('mrp_pupil', { color: 0x1a1208, unlit: true }), [s * 0.06, 0.105, -0.15]));
  }
  head.add(box(0.11, 0.02, 0.02, retroMaterial('mrp_smile', { color: 0xffffff, unlit: true }), [0, 0.045, -0.15]));
  head.add(box(0.2, 0.06, 0.18, white, [0, 0.4, 0]));
  head.add(box(0.14, 0.02, 0.03, retroMaterial('mrp_hatband', { color: 0xc8281e, unlit: true }), [0, 0.42, -0.1]));
  head.position.set(0, 0.62, 0);
  g.add(head);
  g.userData = { head };
  return g;
}

/* ---------------------------------------------------------------- the truck */

/** A step van: white with a blue skirt, a service window with an awning, the menu, the mascot. */
function buildTruck() {
  const g = new THREE.Group();
  const white = retroMaterial('mrp_body', { color: 0xf4f4f0 });
  const blue = retroMaterial('mrp_blue', { color: 0x2a72b8 });
  const trim = retroMaterial('mrp_trim', { color: 0xb8bcc0, ambient: 0.9 });
  const glass = retroMaterial('mrp_glass', { color: 0x2a3a4a, emissive: 0.15 });
  const inner = retroMaterial('mrp_inner', { color: 0x14161a });
  const lit = retroMaterial('mrp_lit', { color: 0xfff2c8, emissive: 0.9, unlit: true });
  const L = 5.0, W = 2.1, H = 2.3;
  // body, the blue skirt, the cab and its glass, the lights, the roof vent
  g.add(box(L, H, W, white, [0, 1.15, 0]));
  g.add(box(L + 0.02, 0.5, W + 0.02, blue, [0, 0.62, 0]));
  g.add(box(1.0, 0.9, W - 0.02, white, [L / 2 - 0.1, 1.75, 0]));
  g.add(box(0.9, 0.62, W - 0.12, glass, [L / 2 + 0.02, 1.95, 0]));
  g.add(box(0.9, 0.5, 0.06, glass, [L / 2 - 0.05, 1.9, W / 2 - 0.02]));
  for (const s of [-1, 1]) g.add(box(0.3, 0.14, 0.1, retroMaterial('mrp_head', { color: 0xfff2c4, emissive: 0.8, unlit: true }), [L / 2 + 0.01, 0.9, s * (W / 2 - 0.3)]));
  g.add(box(0.7, 0.22, 0.8, trim, [-0.8, 2.36, 0]));
  // wheels
  for (const ax of [L / 2 - 1.1, -L / 2 + 1.2]) for (const s of [-1, 1]) {
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.28, 10), retroMaterial('mrp_tyre', { color: 0x1a1a1c }));
    wheel.rotation.x = Math.PI / 2;
    wheel.position.set(ax, 0.42, s * (W / 2 - 0.05));
    g.add(wheel);
  }
  // the service window, on the pavement side (-z): dark opening, a lit inside, a counter lip
  const winZ = -W / 2 - 0.01;
  g.add(box(2.2, 1.0, 0.04, inner, [0.2, 1.62, winZ]));
  g.add(box(2.0, 0.85, 0.02, lit, [0.2, 1.6, winZ - 0.01]));
  g.add(box(2.3, 0.09, 0.42, trim, [0.2, 1.06, winZ - 0.16]));
  // the awning: a slab out over the window with a striped hem
  g.add(box(2.6, 0.08, 0.7, retroMaterial('mrp_awn', { color: 0xe8e8e2 }), [0.2, 2.16, winZ - 0.32], [0.2, 0, 0]));
  for (let i = 0; i < 7; i++) {
    g.add(box(0.3, 0.16, 0.05, retroMaterial(i % 2 ? 'mrp_awnb' : 'mrp_awn', { color: i % 2 ? 0x2a72b8 : 0xe8e8e2 }), [0.2 - 1.1 + i * 0.36, 2.05, winZ - 0.63]));
  }
  // the sides: the name, the mascot, and the words in the reference photo's order
  for (const s of [-1, 1]) {
    const rot = s > 0 ? 0 : Math.PI;
    g.add(plane(2.6, 0.5, { name: 'mrp_name', map: signTex('mrpNameSign', [{ text: 'MR. POOPIE', color: '#c8281e', size: 15 }], { w: 128, h: 24, bg: '#f4f4f0' }), emissive: 0.2, unlit: true }, [-0.1, 2.0, s * (W / 2 + 0.01)], [0, rot, 0]));
    g.add(plane(1.5, 1.5, { name: 'mrp_mascot', map: mascot(), emissive: 0.15 }, [1.55, 1.45, s * (W / 2 + 0.02)], [0, rot, 0]));
    g.add(plane(1.9, 0.28, { name: 'mrp_words', map: signTex('mrpWords', [{ text: 'CONES · SHAKES · SUNDAES', color: '#2a72b8', size: 8 }], { w: 160, h: 20, bg: '#f4f4f0' }), emissive: 0.15, unlit: true }, [-0.4, 1.0, s * (W / 2 + 0.01)], [0, rot, 0]));
  }
  // the menu board in the window, and the vendor behind the counter
  g.add(plane(0.9, 0.62, { name: 'mrp_menu', map: signTex('mrpMenu', [{ text: 'CONES', color: '#1a1a1a', size: 8 }, { text: '2.50', color: '#c8281e', size: 11 }], { w: 64, h: 44, bg: '#f2f0e8', border: '#1a1a1a' }), emissive: 0.5, unlit: true }, [-0.75, 1.66, winZ - 0.06], [0, Math.PI, 0]));
  g.add(box(0.16, 0.16, 0.16, retroMaterial('mrp_bell', { color: 0xc8ccd0, emissive: 0.3 }), [L / 2 - 0.35, 2.45, 0]));
  const vendor = buildVendor();
  vendor.position.set(0.25, 0.95, -0.25);
  g.add(vendor);
  g.userData = { len: L + 0.4, width: W, vendor };
  return g;
}

/* ---------------------------------------------------------------- the truck, running */

export class MrPoopie {
  constructor(world, g) {
    this.world = world;
    this.g = g;
    // it works the curb-side lane, travelling the way the pavement faces
    this.lane = (world.area.traffic?.lanes || []).find((l) => l.dir > 0) || null;
    this.truck = null;
    this.solid = null;
    this.it = null;
    this.lineIt = null;
    this.state = 'away';
    this.timer = 12 + Math.random() * 26;
    this.serveT = 0;
    this.customers = [];
    this.spotX = 0;
    this.moWait = 0;
    this.moTarget = null;
    this.jingleT = 6;
    this.greeted = false;
    this.servedCount = 0;
    this.passing = false;
  }

  get parked() { return this.state === 'parked'; }

  /* ---- lifecycle ---- */

  dispose() {
    this.clearCustomers();
    if (this.it) this.world.interactables = this.world.interactables.filter((i) => i !== this.it);
    if (this.lineIt) this.world.interactables = this.world.interactables.filter((i) => i !== this.lineIt);
    if (this.solid) {
      const list = this.world.area?.solids || [];
      const i = list.indexOf(this.solid);
      if (i >= 0) list.splice(i, 1);
    }
    this.truck?.parent?.remove(this.truck);
    this.restoreLane();
    this.truck = null;
    this.solid = null;
    this.it = null;
    this.lineIt = null;
    this.state = 'away';
  }

  takeLane() {
    const tr = this.world.traffic;
    if (!tr || !this.lane || this.laneTaken) return;
    this.keepLanes = tr.cfg.lanes;
    tr.cfg = { ...tr.cfg, lanes: tr.cfg.lanes.filter((l) => l !== this.lane) };
    this.laneTaken = true;
    // anything already in that lane near the spot gets out of the way rather than through the van
    for (const c of [...tr.cars]) {
      if (c.lane === this.lane && Math.abs(c.x - this.spotX) < 14) {
        tr.drop(c);
        tr.cars.splice(tr.cars.indexOf(c), 1);
      }
    }
  }

  restoreLane() {
    if (!this.laneTaken || !this.world.traffic) return;
    this.world.traffic.cfg = { ...this.world.traffic.cfg, lanes: this.keepLanes };
    this.laneTaken = false;
  }

  arrive(g) {
    const b = this.world.area.bounds;
    this.spotX = clamp(-1 + (Math.random() * 8 - 4), b.minX + 4, b.maxX - 4);
    this.truck = buildTruck();
    this.truck.position.set(b.minX - 9, 0, this.lane.z);
    this.world.root.add(this.truck);
    this.solid = { x: this.truck.position.x, z: this.lane.z, w: this.truck.userData.len, d: this.truck.userData.width, h: 2.5, moving: true };
    (this.world.area.solids = this.world.area.solids || []).push(this.solid);
    this.state = 'arriving';
    if (this.world.areaId === 'street' || this.world.areaId === 'avenue') g.toast(pick([
      'Somewhere down the block, six notes on a speaker that has never been repaired. Kids hear it before adults do. It is not a fair contest.',
      'The ice cream truck. You can hear the jingle from two streets away and you can hear it in your teeth.',
      'The bell of the Mr. Poopie truck, coming up the block at walking speed, the way it has every afternoon of your life.',
    ]), 'info');
  }

  park(g) {
    this.state = 'parked';
    this.serveT = 95 + Math.random() * 70;
    this.takeLane();
    const b = this.world.area.bounds;
    this.queueZ = Math.min(b.maxZ - 0.35, this.lane.z - 2.7);
    this.it = {
      id: 'mrp_window', label: 'Buy from Mr. Poopie', sub: `cone · ${money(CONE_PRICE)}`, x: this.spotX, z: b.maxZ - 0.25, radius: 2.0,
      action: (gg) => this.menu(gg),
    };
    this.lineIt = {
      id: 'mrp_line', label: 'Wait in the line', sub: 'they were here first', x: this.spotX - 2.2, z: b.maxZ - 0.3, radius: 1.4,
      unavailable: () => (this.moWait > 0 ? 'waiting in line' : null),
      action: (gg) => this.joinLine(gg),
    };
    this.world.interactables.push(this.it, this.lineIt);
    for (let i = 0; i < 2; i++) this.addCustomer(g);
  }

  leave(g) {
    this.clearCustomers();
    if (this.it) this.world.interactables = this.world.interactables.filter((i) => i !== this.it);
    if (this.lineIt) this.world.interactables = this.world.interactables.filter((i) => i !== this.lineIt);
    this.it = null;
    this.lineIt = null;
    this.moWait = 0;
    this.restoreLane();
    this.state = 'leaving';
    void g;
  }

  /* ---- the queue ---- */

  slot(i) {
    // the queue runs back along the kerb from the window, so it reads as a line from the pavement
    const b = this.world.area.bounds;
    return { x: clamp(this.spotX - 0.4 - i * 0.85, b.minX + 0.6, b.maxX - 0.6), z: this.queueZ };
  }

  addCustomer() {
    if (this.customers.length >= 5) return;
    const rig = createNPC(pick(KINDS));
    const at = this.slot(this.customers.length + 1);
    rig.root.position.set(at.x - 1.6, 0, at.z + 1.2);
    rig.root.rotation.y = Math.PI;
    this.world.root.add(rig.root);
    this.world.npcRigs.push(rig);
    this.customers.push({ rig, phase: 'queue', t: 0, waited: 0, dir: Math.random() < 0.5 ? -1 : 1, cone: false });
  }

  clearCustomers() {
    for (const c of this.customers) {
      c.rig.root.parent?.remove(c.rig.root);
      this.world.npcRigs = this.world.npcRigs.filter((r) => r !== c.rig);
    }
    this.customers = [];
  }

  /** A cone in the hand: cheap, but it reads at street distance. */
  giveCone(c) {
    if (c.cone) return;
    c.cone = true;
    const cone = new THREE.Group();
    cone.add(new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.16, 6), retroMaterial('mrp_sugar', { color: 0xe8c07a })));
    const scoop = new THREE.Mesh(new THREE.SphereGeometry(0.055, 7, 5), retroMaterial('mrp_scoop', { color: 0xf2e2c8 }));
    scoop.position.y = 0.1;
    cone.add(scoop);
    cone.position.set(0, -0.46, 0.04);
    cone.rotation.x = -0.5;
    c.rig.armR.pivot.add(cone);
  }

  /* ---- Mo at the window ---- */

  menu(g) {
    const s = g.state;
    const ahead = this.customers.length;
    g.openModal({
      kicker: 'MR. POOPIE · ICE CREAM',
      title: 'The window',
      body: pick([
        '"Yeah." The window is up. The head in it is not a head. Nobody says anything about that, and the head waits, patient, in a paper hat.',
        '"Two fifty. Cone, cup, or the big one, which is the same cone with more on it." Behind him a freezer hums like it is thinking about something else.',
        'The man in the costume leans out over the counter. "You want the jingle too, or just the ice cream?" He does not smile. The costume smiles for him, permanently.',
      ]),
      choices: [
        {
          label: `Mr. Poopie Cone · ${money(CONE_PRICE)}`, sub: '+26 hunger · +12 morale',
          disabled: s.money < CONE_PRICE,
          effect: () => this.buy(g),
        },
        {
          label: 'The Big One · $4.50', sub: 'two scoops · +34 hunger · +16 morale',
          disabled: s.money < 4.5,
          effect: () => { if (this.buy(g, 4.5)) { addItem(s, 'mr_poopie', 1); s.stats.morale = Math.min(100, s.stats.morale + 4); } },
        },
        {
          label: 'Ask him what the name is about.', sub: '',
          effect: () => {
            g.toast(pick([
              '"It\'s a name." He says it the way a man says the name of a street he has lived on for thirty years.',
              '"You want to talk about the name, or you want to talk about the ice cream?" The costume keeps smiling. It has no other option.',
              'He looks at you for a long second. "Franchise." The window comes down an inch, then back up, which is the whole argument.',
            ]), 'info');
            g.advance(2);
          },
        },
        { label: 'Step back from the window.', sub: '', effect: () => {} },
      ],
    });
    if (ahead > 0) {
      g.toast(pick([
        'You step around the line. Somebody small says, loudly, "HE CUT."',
        'You get to the window past people who were here first and who will remember your face.',
        'The kid at the front of the line looks at you, then at the window, then at you again. The costume waits.',
      ]), 'info');
      s.stats.stress = Math.min(100, s.stats.stress + 2);
    }
  }

  buy(g, price = CONE_PRICE) {
    const s = g.state;
    if (!g.spendMoney(price, 'Mr. Poopie truck')) return false;
    addItem(s, 'mr_poopie', 1);
    this.servedCount += 1;
    g.audio?.sfx?.('cash');
    g.toast(pick([
      `"There you go." The cone is cold in your hand and the paper is already going soft. ${money(price)} for the whole afternoon.`,
      'He hands it out of the window without looking at it, the way a man hands out a thousand of them. Behind him the freezer keeps thinking.',
      'The costume leans out a little further than it needs to, watching you take the cone. "Napkins are extra," it says. There are no napkins.',
    ]), 'good');
    g.advance(3);
    return true;
  }

  joinLine(g) {
    if (this.moWait > 0) return;
    const b = this.world.area.bounds;
    this.moTarget = { x: clamp(this.spotX - 3.0, b.minX + 0.6, b.maxX - 0.6), z: this.queueZ };
    this.moWait = 2.4 + this.customers.length * 3.2;
    g.toast(pick([
      'You stand at the back of the line. The line is mostly people half your height and twice as serious.',
      'You get in line behind a kid holding a dollar in each fist. He has been saving since Tuesday.',
      'You join the line. Somebody\'s grandmother is in it, in a housecoat, and she is not here for herself.',
    ]), 'info');
  }

  /* ---- per frame ---- */

  update(dt, g) {
    if (!this.lane) return;
    const w = this.world;
    const b = w.area.bounds;

    if (this.state === 'away') {
      this.timer -= dt;
      if (this.timer <= 0) {
        this.timer = 26 + Math.random() * 40;
        if (!isServingTime(minuteOfDay(g.state.clock.m))) return;
        this.passing = Math.random() < 0.3;
        this.arrive(g);
      }
      return;
    }

    if (this.state === 'arriving') {
      const p = this.truck.position;
      const target = this.passing ? b.maxX + 9 : this.spotX;
      p.x += Math.sign(target - p.x) * Math.min(Math.abs(target - p.x), 6.5 * dt);
      this.solid.x = p.x;
      this.jingle(dt, g, 14);
      if (Math.abs(p.x - target) < 0.12) {
        if (this.passing) { this.passing = false; this.dispose(); this.timer = 30 + Math.random() * 40; }
        else this.park(g);
      }
      return;
    }

    if (this.state === 'parked') {
      this.serveT -= dt;
      this.jingle(dt, g, 26);
      // the costume leans out over the counter and looks along the line
      const vendor = this.truck.userData.vendor;
      const lean = this.customers.length ? 1 : 0.35;
      vendor.userData.head.position.z = -0.25 - lean * 0.12 - Math.abs(Math.sin((w.realT || 0) * 0.9)) * 0.05;
      vendor.userData.head.rotation.y = Math.sin((w.realT || 0) * 0.35) * 0.3;
      vendor.userData.head.rotation.x = 0.1;
      this.queue(dt, g);
      if (!this.greeted && Math.hypot(w.mo.root.position.x - this.spotX, w.mo.root.position.z - b.maxZ) < 6) {
        this.greeted = true;
        g.toast('The window is up and the head in it is a pile of poop with eyes. "Yeah," it says. "Two fifty."', 'info');
      }
      if (this.moWait > 0) this.serveMo(dt, g);
      if (this.serveT <= 0) this.leave(g);
      return;
    }

    if (this.state === 'leaving') {
      const p = this.truck.position;
      p.x += 6 * dt;
      this.solid.x = p.x;
      if (p.x > b.maxX + 12) {
        this.dispose();
        this.timer = 22 + Math.random() * 38;
      }
    }
  }

  jingle(dt, g, every) {
    this.jingleT -= dt;
    if (this.jingleT > 0) return;
    this.jingleT = every;
    const mo = this.world.mo.root.position;
    if (Math.hypot(mo.x - (this.truck?.position.x || 0), mo.z - this.lane.z) < 16) g.audio?.sfx?.('jingle');
  }

  queue(dt, g) {
    this.spawnT = (this.spawnT ?? 3) - dt;
    if (this.spawnT <= 0) {
      this.spawnT = 7 + Math.random() * 9;
      if (this.customers.length < 5 && Math.random() < 0.7) this.addCustomer(g);
    }
    this.customers.forEach((c, i) => {
      const rig = c.rig;
      const p = rig.root.position;
      c.t += dt;
      if (c.phase === 'queue') {
        const at = this.slot(i);
        const dx = at.x - p.x;
        const dz = at.z - p.z;
        const d = Math.hypot(dx, dz);
        if (d > 0.12) {
          const step = Math.min(d, 1.2 * dt);
          p.x += (dx / d) * step;
          p.z += (dz / d) * step;
          rig.root.rotation.y = Math.atan2(dx, dz);
          animateNPC(rig, dt, { walking: true });
        } else {
          // at the window: face it, wait a beat, order
          rig.root.rotation.y = Math.atan2(this.spotX - p.x, this.lane.z - p.z);
          animateNPC(rig, dt, { walking: false });
          if (i === 0) {
            c.waited += dt;
            if (c.waited > 2.6) {
              c.phase = 'leave';
              c.t = 0;
              c.waited = 0;
              this.giveCone(c);
              this.servedCount += 1;
              g.audio?.sfx?.('ui');
            }
          }
        }
        return;
      }
      // walking off with it, eating on the way, like everybody else on this block
      p.x += c.dir * 1.25 * dt;
      p.z = clamp(p.z - dt * 0.12, this.queueZ - 0.6, this.queueZ + 1.4);
      rig.root.rotation.y = c.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      animateNPC(rig, dt, { walking: true });
      // the arm comes up to the mouth every second and a half: a cone on the way home
      if (rig.armR) {
        const bite = Math.max(0, Math.sin(c.t * 2.2));
        rig.armR.pivot.rotation.x = -0.6 - bite * 0.9;
        rig.armR.elbow.rotation.x = -0.2 - bite * 1.1;
        rig.head.rotation.x = -bite * 0.12;
      }
      if (p.x < this.world.area.bounds.minX - 2 || p.x > this.world.area.bounds.maxX + 2) {
        rig.root.parent?.remove(rig.root);
        this.world.npcRigs = this.world.npcRigs.filter((r) => r !== rig);
        c.gone = true;
      }
    });
    this.customers = this.customers.filter((c) => !c.gone);
  }

  /** Mo waits his turn: he walks to the back of the line, stands, and then it is his turn. */
  serveMo(dt, g) {
    const mo = this.world.mo.root.position;
    const t = this.moTarget;
    if (t) {
      const dx = t.x - mo.x;
      const dz = t.z - mo.z;
      const d = Math.hypot(dx, dz);
      if (d > 0.15) {
        const step = Math.min(d, 2.2 * dt);
        mo.x += (dx / d) * step;
        mo.z += (dz / d) * step;
        this.world.mo.root.rotation.y = Math.atan2(dx, dz);
        this.world.walking = true;
      } else {
        mo.z += (this.queueZ - mo.z) * Math.min(1, dt * 2);
        this.world.walking = false;
      }
    }
    this.moWait -= dt;
    if (this.moWait <= 0 && !g.modalOpen) {
      this.moWait = 0;
      this.moTarget = null;
      this.menu(g);
      g.toast('The line moves. The costume looks at you, then at the freezer, then at you. "Yeah."', 'info');
    }
  }
}
