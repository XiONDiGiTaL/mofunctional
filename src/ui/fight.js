/**
 * The swing meter for a street fight. A marker slides back and forth along a bar; F, Space, Enter
 * or a click swings. Inside the green it lands. Outside it, he gets hit instead. The meter speeds
 * up as Mo gets tired, which is the joke and also how fights work.
 *
 * `onSwing(landed)` returns the fight's state; when it says `over`, the meter closes and `done`
 * gets the result.
 */
export class FightMeter {
  constructor(root, game) {
    this.root = root;
    this.g = game;
    this.el = null;
  }

  open({ hp, onSwing, done }) {
    this.close();
    const g = this.g;
    this.hp = hp;
    this.pos = 0;
    this.dir = 1;
    this.locked = 0;
    this.el = document.createElement('div');
    this.el.className = 'fightm';
    this.el.innerHTML = `<div class="fightm__box">
      <div class="fightm__title">FIGHT</div>
      <div class="fightm__hp">Him: <b data-hp>${'■'.repeat(hp)}</b> · You: <b data-en></b></div>
      <div class="fightm__bar"><i class="fightm__zone"></i><i class="fightm__mark"></i></div>
      <button class="btn btn--primary fightm__go">SWING · F / SPACE</button>
      <div class="fightm__msg tiny">Hit him in the green.</div>
    </div>`;
    this.root.appendChild(this.el);
    g.overlayOpen = true;
    const mark = this.el.querySelector('.fightm__mark');
    const msg = this.el.querySelector('.fightm__msg');
    const hpEl = this.el.querySelector('[data-hp]');
    const enEl = this.el.querySelector('[data-en]');
    const zone = { a: 0.4, b: 0.6 };
    const showEnergy = () => { enEl.textContent = `${Math.max(0, Math.round(g.state.stats.energy))} energy`; };
    showEnergy();
    const swing = () => {
      if (this.locked > 0 || !this.el) return;
      this.locked = 0.45;
      const landed = this.pos >= zone.a && this.pos <= zone.b;
      g.world?.playPunch?.(landed);
      g.audio?.sfx?.(landed ? 'confirm' : 'error');
      const st = onSwing(landed);
      hpEl.textContent = '■'.repeat(Math.max(0, st.hp)) || '—';
      showEnergy();
      msg.textContent = landed ? 'That one landed.' : 'He hits back. Hard.';
      if (st.over) {
        setTimeout(() => { this.close(); done(st.over); }, 500);
      }
    };
    this.onKey = (e) => {
      if (['KeyF', 'Space', 'Enter'].includes(e.code)) { e.preventDefault(); e.stopImmediatePropagation(); swing(); }
    };
    window.addEventListener('keydown', this.onKey, true);
    this.el.querySelector('.fightm__go').addEventListener('click', swing);
    let last = performance.now();
    this.timer = setInterval(() => {
      const now = performance.now();
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      this.locked = Math.max(0, this.locked - dt);
      // tired arms, faster marker
      const speed = 1.1 + (1 - Math.max(0, g.state.stats.energy) / 100) * 1.2;
      this.pos += this.dir * speed * dt;
      if (this.pos > 1) { this.pos = 1; this.dir = -1; }
      if (this.pos < 0) { this.pos = 0; this.dir = 1; }
      mark.style.left = `${this.pos * 100}%`;
    }, 16);
  }

  close() {
    if (!this.el) return;
    clearInterval(this.timer);
    window.removeEventListener('keydown', this.onKey, true);
    this.el.remove();
    this.el = null;
    this.g.overlayOpen = false;
  }
}
