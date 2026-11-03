/**
 * Somebody coming for Mo on foot: a driver out of the car he just punched, or a Guardian Angle who
 * has seen enough. They run at him, and when they reach him it is a fist fight (world/duel.js):
 * Mo's own punches against theirs. Win and they go down where they stood (pockets and all); lose
 * and it is the pavement, then the clinic, like any other beating; walk far enough and they quit.
 */
import { createNPC, animateNPC } from './characters.js';

export class Assailants {
  constructor(world) {
    this.world = world;
    this.list = [];
  }

  /**
   * opts: { kind, x, z, hp, speed, name, onWin(g, rig), onLose(g) }
   * Returns the rig, already in the world and already running.
   */
  spawn(g, opts) {
    const rig = createNPC(opts.kind);
    rig.root.position.set(opts.x, 0, opts.z);
    rig.npcDef = { kind: opts.kind, assailant: true, label: opts.name };
    this.world.root.add(rig.root);
    this.list.push({ rig, ...opts, speed: opts.speed ?? 3.4, t: 0, state: 'run' });
    return rig;
  }

  update(dt, g) {
    if (!this.list.length) return;
    const mo = this.world.mo.root.position;
    for (const a of this.list) {
      const p = a.rig.root.position;
      a.t += dt;
      if (a.state === 'down') {
        a.downT += dt;
        if (a.downT > 90) this.drop(a);
        continue;
      }
      if (a.state === 'fight') continue; // the duel poses him
      if (a.state !== 'run') { animateNPC(a.rig, dt, {}); continue; }
      const dx = mo.x - p.x, dz = mo.z - p.z;
      const d = Math.hypot(dx, dz);
      a.rig.root.rotation.y = Math.atan2(dx, dz);
      // a man running for a full minute and not getting there gives up
      if (a.t > 60) { this.drop(a); continue; }
      if (d > 1.05) {
        const step = Math.min(d - 1.0, a.speed * dt);
        p.x += (dx / d) * step;
        p.z += (dz / d) * step;
        animateNPC(a.rig, dt, { walking: true });
        continue;
      }
      if (g.uiBusy || this.world.duel?.active) { animateNPC(a.rig, dt, {}); continue; }
      a.state = 'fight';
      this.fight(g, a);
    }
    this.list = this.list.filter((a) => !a.gone);
  }

  fight(g, a) {
    this.world.duel.start(g, {
      rig: a.rig, hp: a.hp ?? 3, name: a.name || 'him', hit: 8,
      onWin: (gg) => { a.state = 'down'; a.downT = 0; a.onWin?.(gg, a.rig); },
      onLose: (gg) => {
        this.drop(a);
        if (a.onLose) a.onLose(gg);
        else { gg.toast('You go down. The pavement is the last thing with an opinion about you.', 'bad'); gg.collapseSequence?.('beaten'); }
      },
      onRun: (gg) => { gg.toast(`${a.name ? a.name[0].toUpperCase() + a.name.slice(1) : 'He'} stops, hands on knees, and lets you go. This time.`, 'info'); this.drop(a); },
    });
  }

  drop(a) {
    a.rig.root.parent?.remove(a.rig.root);
    if (a.it) this.world.interactables = this.world.interactables.filter((i) => i !== a.it);
    a.gone = true;
  }

  clear() {
    for (const a of this.list) this.drop(a);
    this.list = [];
  }

  get active() { return this.list.some((a) => a.state === 'run' || a.state === 'fight'); }
}
