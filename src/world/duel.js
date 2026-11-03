/**
 * A fight with Mo's own fists. Whoever came at him (the man in the grey hood, a driver out of his
 * car, a Guardian Angle, the man in the courtyard) squares up in front of him, hands up, and
 * throws a punch every second or two. Each one that lands costs energy; stepping back out of reach
 * as he winds up makes it miss. Mo answers with the punch button (Z): every one that connects takes
 * a pip off the bar at the top of the screen, and the last one puts the man on the pavement. Walk
 * far enough away and he follows a while, then decides it is not worth it. At zero energy, Mo is
 * the one on the pavement.
 *
 * The world owns one Duel; throwPunch hands it a punch when the rig in front of Mo is the foe.
 */
import { punchPose, guardPose, animateNPC } from './characters.js';
import { bump } from '../core/state.js';

const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

export class Duel {
  constructor(world) {
    this.world = world;
    this.cur = null;
    this.el = null;
  }

  get active() { return !!this.cur; }
  isFoe(rig) { return !!this.cur && this.cur.rig === rig; }

  /** opts: { rig, hp, name, hit (energy per landed punch), onWin(g, rig), onLose(g), onRun(g) } */
  start(g, { rig, hp = 3, name = 'him', hit = 8, onWin, onLose, onRun }) {
    this.end();
    if (!rig) return false;
    this.cur = { rig, hp, max: hp, name, hit, onWin, onLose, onRun, cool: 1.3, swingT: 0, far: 0, landed: false };
    rig.inDuel = true;
    this.drawBar();
    g.toast(`${cap(name)} squares up. Z to swing. Step back when he winds up. Walk away to run.`, 'info');
    return true;
  }

  /** One of Mo's punches connected with the man he is fighting. */
  hit(g) {
    const c = this.cur;
    if (!c) return;
    c.hp -= 1;
    g.audio?.sfx?.('hit');
    bump(g.state, 'stress', -1);
    // a clean one rocks him back on his heels: his next swing comes later
    c.cool = Math.max(c.cool, 0.7);
    if (c.swingT > 0) { c.swingT = 0; c.landed = true; }
    this.drawBar();
    if (c.hp <= 0) {
      this.end();
      this.world.knockDown(c.rig, g);
      c.onWin?.(g, c.rig);
    }
  }

  update(dt, g) {
    const c = this.cur;
    if (!c) return;
    const rig = c.rig;
    if (!rig.root.parent || rig.down || rig.gone) { this.end(); return; }
    const mo = this.world.mo.root.position;
    const p = rig.root.position;
    const dx = mo.x - p.x, dz = mo.z - p.z;
    const d = Math.hypot(dx, dz);
    rig.root.rotation.y = Math.atan2(dx, dz);
    if (g.uiBusy) return;
    if (g.state.stats.energy <= 0) { this.end(); c.onLose?.(g); return; }
    // he walks away: the other man follows a while, then decides it is not worth it
    if (d > 1.2 && c.swingT <= 0) {
      const step = Math.min(d - 1.0, 2.1 * dt);
      p.x += (dx / d) * step;
      p.z += (dz / d) * step;
      animateNPC(rig, dt, { walking: true });
      c.far = d > 5.5 ? c.far + dt : 0;
      if (c.far > 2.2) { this.end(); c.onRun?.(g); }
      return;
    }
    if (c.swingT > 0) {
      c.swingT = Math.max(0, c.swingT - dt);
      punchPose(rig, 1 - c.swingT / 0.42);
      // the moment the fist arrives: it lands if Mo is still in reach
      if (c.swingT <= 0.16 && !c.landed) {
        c.landed = true;
        if (d < 1.5) {
          bump(g.state, 'energy', -c.hit);
          bump(g.state, 'stress', 3);
          this.world.tilt = 0.8;
          g.audio?.sfx?.('punch');
        } else {
          g.audio?.sfx?.('ui-back');
        }
        this.drawBar();
      }
      return;
    }
    guardPose(rig, this.world.time || 0);
    c.cool -= dt;
    // a beat with his hands drawn back before it comes: that is the tell
    if (c.cool <= 0) { c.swingT = 0.42; c.landed = false; c.cool = 1.1 + Math.random() * 0.9; }
  }

  drawBar() {
    const c = this.cur;
    if (!c) return;
    if (!this.el) {
      this.el = document.createElement('div');
      this.el.className = 'duelbar';
      (document.getElementById('ui') || document.body).appendChild(this.el);
    }
    const en = Math.max(0, Math.round(this.world.game?.state?.stats?.energy ?? 0));
    this.el.innerHTML = `<b>${cap(c.name)}</b><span class="duelbar__hp">${'■'.repeat(Math.max(0, c.hp))}${'□'.repeat(Math.max(0, c.max - c.hp))}</span><span class="duelbar__hint">Z swing · step back to slip · walk away to run</span>`;
    this.el.dataset.en = en;
  }

  end() {
    if (this.cur) this.cur.rig.inDuel = false;
    this.cur = null;
    this.el?.remove();
    this.el = null;
  }
}
