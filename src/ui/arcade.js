/**
 * The arcade cabinets at Dee's: real games, small and 8-bit, on a canvas over the screen.
 *
 *   EVICTION SNAKE     a snake that eats rent checks and grows; the walls are the lease
 *   PAC-MO: DEBT EATER  Mo eats quarters through a maze; RENT, POWER, PHONE and BILLING chase
 *                      him; a PAYDAY pellet turns them blue for a while and they can be eaten
 *   ROACH INVADERS     rows of roaches march down; a can of spray at the bottom of the screen
 *
 * A play is a quarter. Arrows or WASD steer, Space fires and starts, ESC walks away. On a touch
 * screen a d-pad appears under the cabinet screen. The best score per game is kept with the run.
 */
const W = 224;
const H = 256;
const PAL = { bg: '#05060a', fg: '#e8f4ff', dim: '#4a5a6a', y: '#ffd23a', r: '#ff3a4a', g: '#3aff8a', b: '#3a8aff', p: '#ff6ad8', o: '#ff9a3a', w: '#ffffff' };

export const GAMES = {
  snake: { name: 'EVICTION SNAKE', blurb: 'eat the rent checks · do not hit the lease', make: () => new Snake() },
  pac: { name: 'PAC-MO: DEBT EATER', blurb: 'eat the quarters · the bills eat you', make: () => new PacMo() },
  roach: { name: 'ROACH INVADERS', blurb: 'they always come back · so do you', make: () => new Roaches() },
};

/** Open a cabinet. `onEnd(score, best)` runs when the player walks away. */
export function playArcade(game, id, onEnd) {
  const def = GAMES[id];
  const root = document.getElementById('ui') || document.body;
  const s = game.state;
  s.arcade = s.arcade || { best: {} };
  const ov = document.createElement('div');
  ov.className = 'screen arcade';
  ov.innerHTML = `<div class="arcade__cab">
      <div class="arcade__marquee">${def.name}</div>
      <canvas class="arcade__screen" width="${W}" height="${H}"></canvas>
      <div class="arcade__pad">
        <button data-k="ArrowUp">▲</button><button data-k="ArrowLeft">◀</button><button data-k="Space">●</button><button data-k="ArrowRight">▶</button><button data-k="ArrowDown">▼</button>
      </div>
      <div class="arcade__help">ARROWS / WASD · SPACE · ESC TO WALK AWAY</div>
    </div>`;
  root.appendChild(ov);
  const cv = ov.querySelector('canvas');
  const ctx = cv.getContext('2d');
  let g = def.make();
  let best = s.arcade.best[id] || 0;
  let raf = 0;
  let last = performance.now();
  const keys = new Set();
  const press = (k) => {
    if (k === 'Escape') { close(); return; }
    if (g.over && (k === 'Space' || k === 'Enter')) { g = def.make(); g.start = true; return; }
    if (!g.start && (k === 'Space' || k === 'Enter')) { g.start = true; return; }
    g.key?.(k);
  };
  const norm = (code) => ({ KeyW: 'ArrowUp', KeyA: 'ArrowLeft', KeyS: 'ArrowDown', KeyD: 'ArrowRight', KeyF: 'Space', Enter: 'Space' }[code] || code);
  const down = (e) => { const k = norm(e.code); if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Escape'].includes(k)) { e.preventDefault(); e.stopPropagation(); keys.add(k); press(k); } };
  const up = (e) => { keys.delete(norm(e.code)); };
  window.addEventListener('keydown', down, true);
  window.addEventListener('keyup', up, true);
  ov.querySelectorAll('[data-k]').forEach((b) => {
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); keys.add(b.dataset.k); press(b.dataset.k); });
    b.addEventListener('pointerup', () => keys.delete(b.dataset.k));
    b.addEventListener('pointerleave', () => keys.delete(b.dataset.k));
  });
  game.arcadeOpen = true;
  const frame = (t) => {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (t - last) / 1000);
    last = t;
    if (g.start && !g.over) g.update(dt, keys);
    if (g.score > best) best = g.score;
    ctx.fillStyle = PAL.bg;
    ctx.fillRect(0, 0, W, H);
    g.draw(ctx);
    text(ctx, `SCORE ${String(g.score).padStart(5, '0')}`, 6, 10, PAL.fg, 8);
    text(ctx, `HI ${String(best).padStart(5, '0')}`, W - 70, 10, PAL.y, 8);
    if (!g.start) attract(ctx, def);
    if (g.over) {
      ctx.fillStyle = 'rgba(0,0,0,.65)';
      ctx.fillRect(16, 96, W - 32, 72);
      text(ctx, 'GAME OVER', W / 2, 118, PAL.r, 14, true);
      text(ctx, g.overLine || '', W / 2, 138, PAL.fg, 7, true);
      text(ctx, 'SPACE: ANOTHER QUARTER · ESC: WALK AWAY', W / 2, 156, PAL.dim, 6, true);
    }
  };
  raf = requestAnimationFrame(frame);
  function close() {
    cancelAnimationFrame(raf);
    window.removeEventListener('keydown', down, true);
    window.removeEventListener('keyup', up, true);
    ov.remove();
    game.arcadeOpen = false;
    const prev = s.arcade.best[id] || 0;
    s.arcade.best[id] = Math.max(prev, best);
    onEnd?.(g.score, best, best > prev);
  }
  return { close };
}

function text(ctx, str, x, y, color, size = 8, center = false) {
  ctx.font = `bold ${size}px monospace`;
  ctx.fillStyle = color;
  ctx.textAlign = center ? 'center' : 'left';
  ctx.fillText(str, x, y);
  ctx.textAlign = 'left';
}

function attract(ctx, def) {
  const blink = Math.floor(performance.now() / 500) % 2;
  ctx.fillStyle = 'rgba(0,0,0,.55)';
  ctx.fillRect(10, 80, W - 20, 96);
  text(ctx, def.name, W / 2, 104, PAL.y, def.name.length > 14 ? 10 : 13, true);
  text(ctx, def.blurb.toUpperCase(), W / 2, 124, PAL.fg, 6, true);
  if (blink) text(ctx, 'PRESS SPACE', W / 2, 150, PAL.g, 9, true);
  text(ctx, '© 1993 KESTREL AMUSEMENT CO.', W / 2, 168, PAL.dim, 6, true);
}

/* =========================================================================== snake */

class Snake {
  constructor() {
    this.cell = 8;
    this.cols = W / 8;
    this.rows = (H - 16) / 8;
    this.body = [{ x: 10, y: 15 }, { x: 9, y: 15 }, { x: 8, y: 15 }];
    this.dir = { x: 1, y: 0 };
    this.next = this.dir;
    this.t = 0;
    this.speed = 0.11;
    this.score = 0;
    this.food = this.place();
    this.start = false;
    this.over = false;
  }

  place() {
    for (;;) {
      const p = { x: 1 + Math.floor(Math.random() * (this.cols - 2)), y: 1 + Math.floor(Math.random() * (this.rows - 2)) };
      if (!this.body.some((b) => b.x === p.x && b.y === p.y)) return p;
    }
  }

  key(k) {
    const d = { ArrowUp: { x: 0, y: -1 }, ArrowDown: { x: 0, y: 1 }, ArrowLeft: { x: -1, y: 0 }, ArrowRight: { x: 1, y: 0 } }[k];
    if (d && (d.x !== -this.dir.x || d.y !== -this.dir.y)) this.next = d;
  }

  update(dt) {
    this.t += dt;
    if (this.t < this.speed) return;
    this.t = 0;
    this.dir = this.next;
    const h = { x: this.body[0].x + this.dir.x, y: this.body[0].y + this.dir.y };
    if (h.x <= 0 || h.y <= 0 || h.x >= this.cols - 1 || h.y >= this.rows - 1 || this.body.some((b) => b.x === h.x && b.y === h.y)) {
      this.over = true;
      this.overLine = pickOf(['EVICTED. THE LEASE WAS VERY CLEAR.', 'YOU ATE YOURSELF. RELATABLE.', 'RAE HAS CHANGED THE LOCKS.']);
      return;
    }
    this.body.unshift(h);
    if (h.x === this.food.x && h.y === this.food.y) {
      this.score += 10;
      this.speed = Math.max(0.05, this.speed - 0.003);
      this.food = this.place();
    } else this.body.pop();
  }

  draw(ctx) {
    const c = this.cell;
    const oy = 16;
    ctx.strokeStyle = PAL.dim;
    ctx.strokeRect(c + 0.5, oy + c + 0.5, (this.cols - 2) * c, (this.rows - 2) * c);
    text(ctx, 'LEASE', 2, oy + c * 3, PAL.dim, 5);
    // the rent check: a little green slip with a dollar sign
    ctx.fillStyle = PAL.g;
    ctx.fillRect(this.food.x * c, oy + this.food.y * c + 1, c, c - 2);
    text(ctx, '$', this.food.x * c + 2, oy + this.food.y * c + 7, PAL.bg, 7);
    this.body.forEach((b, i) => {
      ctx.fillStyle = i === 0 ? PAL.y : i % 2 ? PAL.o : '#e8822a';
      ctx.fillRect(b.x * c + 1, oy + b.y * c + 1, c - 2, c - 2);
    });
  }
}

/* =========================================================================== pac-mo */

const MAZE = [
  '###################',
  '#........#........#',
  '#O##.###.#.###.##O#',
  '#.................#',
  '#.##.#.#####.#.##.#',
  '#....#...#...#....#',
  '####.### # ###.####',
  '   #.#   G   #.#   ',
  '####.# ##-## #.####',
  '    .  #GGG#  .    ',
  '####.# ##### #.####',
  '   #.#       #.#   ',
  '####.# ##### #.####',
  '#........#........#',
  '#.##.###.#.###.##.#',
  '#O.#.....P.....#.O#',
  '##.#.#.#####.#.#.##',
  '#....#...#...#....#',
  '#.######.#.######.#',
  '#.................#',
  '###################',
];
const GHOSTS = [{ name: 'RENT', c: PAL.r }, { name: 'POWER', c: PAL.y }, { name: 'PHONE', c: PAL.b }, { name: 'BILLS', c: PAL.p }];

class PacMo {
  constructor() {
    this.t = 11;
    this.grid = MAZE.map((r) => r.split(''));
    this.ox = (W - 19 * this.t) / 2;
    this.oy = 20;
    this.dots = 0;
    let gi = 0;
    this.ghosts = [];
    this.grid.forEach((row, y) => row.forEach((ch, x) => {
      if (ch === '.' || ch === 'O') this.dots += 1;
      if (ch === 'P') { this.mo = { x, y, fx: x, fy: y, dir: { x: 0, y: 0 }, want: { x: -1, y: 0 } }; row[x] = ' '; }
      if (ch === 'G') { const gd = GHOSTS[gi++ % 4]; this.ghosts.push({ ...gd, x, y, fx: x, fy: y, home: { x, y }, dir: { x: 0, y: -1 }, eaten: false }); row[x] = ' '; }
    }));
    this.score = 0;
    this.lives = 3;
    this.scared = 0;
    this.step = 0;
    this.gstep = 0;
    this.start = false;
    this.over = false;
  }

  key(k) {
    const d = { ArrowUp: { x: 0, y: -1 }, ArrowDown: { x: 0, y: 1 }, ArrowLeft: { x: -1, y: 0 }, ArrowRight: { x: 1, y: 0 } }[k];
    if (d) this.mo.want = d;
  }

  open(x, y, ghost = false) {
    const row = this.grid[y];
    if (!row) return false;
    const ch = row[(x + 19) % 19];
    return ch !== '#' && (ghost || ch !== '-');
  }

  update(dt) {
    this.scared = Math.max(0, this.scared - dt);
    this.step += dt;
    if (this.step >= 0.14) {
      this.step = 0;
      const m = this.mo;
      if (this.open(m.x + m.want.x, m.y + m.want.y)) m.dir = m.want;
      if (this.open(m.x + m.dir.x, m.y + m.dir.y)) { m.x = (m.x + m.dir.x + 19) % 19; m.y += m.dir.y; }
      const ch = this.grid[m.y][m.x];
      if (ch === '.') { this.score += 10; this.dots -= 1; this.grid[m.y][m.x] = ' '; }
      if (ch === 'O') { this.score += 50; this.dots -= 1; this.grid[m.y][m.x] = ' '; this.scared = 6; }
      if (this.dots <= 0) { this.over = true; this.overLine = 'ALL PAID OFF. (THIS NEVER HAPPENS.)'; this.score += 500; }
    }
    this.gstep += dt;
    if (this.gstep >= (this.scared ? 0.24 : 0.17)) {
      this.gstep = 0;
      for (const gh of this.ghosts) {
        const opts = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }].filter((d) => !(d.x === -gh.dir.x && d.y === -gh.dir.y) && this.open(gh.x + d.x, gh.y + d.y, true));
        if (!opts.length) { gh.dir = { x: -gh.dir.x, y: -gh.dir.y }; continue; }
        // chase Mo (or run from him while scared), with a little randomness so they spread out
        const score = (d) => Math.hypot(gh.x + d.x - this.mo.x, gh.y + d.y - this.mo.y) * (this.scared ? -1 : 1) + Math.random() * 3;
        opts.sort((a, b) => score(a) - score(b));
        gh.dir = opts[0];
        gh.x = (gh.x + gh.dir.x + 19) % 19;
        gh.y += gh.dir.y;
      }
    }
    for (const gh of this.ghosts) {
      if (gh.x !== this.mo.x || gh.y !== this.mo.y) continue;
      if (this.scared) { this.score += 200; gh.x = gh.home.x; gh.y = gh.home.y; }
      else {
        this.lives -= 1;
        if (this.lives <= 0) { this.over = true; this.overLine = `${gh.name} GOT YOU. ${gh.name} ALWAYS GETS YOU.`; return; }
        this.mo.x = 9; this.mo.y = 15; this.mo.dir = { x: 0, y: 0 };
        for (const o of this.ghosts) { o.x = o.home.x; o.y = o.home.y; }
      }
    }
  }

  draw(ctx) {
    const t = this.t;
    const ox = this.ox;
    const oy = this.oy;
    this.grid.forEach((row, y) => row.forEach((ch, x) => {
      const px = ox + x * t;
      const py = oy + y * t;
      if (ch === '#') { ctx.fillStyle = '#1a2a8a'; ctx.fillRect(px, py, t, t); ctx.fillStyle = '#2a4aff'; ctx.fillRect(px + 2, py + 2, t - 4, t - 4); }
      if (ch === '-') { ctx.fillStyle = PAL.p; ctx.fillRect(px, py + t / 2 - 1, t, 2); }
      if (ch === '.') { ctx.fillStyle = PAL.y; ctx.fillRect(px + t / 2 - 1, py + t / 2 - 1, 2, 2); }
      if (ch === 'O') { ctx.fillStyle = PAL.g; ctx.fillRect(px + 2, py + 2, t - 4, t - 4); text(ctx, '$', px + 3, py + 9, PAL.bg, 7); }
    }));
    // Mo: a yellow disc with a mouth, a little white tee
    const m = this.mo;
    const mouth = Math.abs(Math.sin(performance.now() / 90)) * 0.7;
    const ang = Math.atan2(m.dir.y, m.dir.x || (m.dir.y ? 0 : 1));
    ctx.fillStyle = PAL.y;
    ctx.beginPath();
    ctx.moveTo(ox + m.x * t + t / 2, oy + m.y * t + t / 2);
    ctx.arc(ox + m.x * t + t / 2, oy + m.y * t + t / 2, t / 2 - 0.5, ang + mouth, ang + Math.PI * 2 - mouth);
    ctx.fill();
    for (const gh of this.ghosts) {
      const px = ox + gh.x * t;
      const py = oy + gh.y * t;
      ctx.fillStyle = this.scared ? (this.scared < 1.5 && Math.floor(this.scared * 6) % 2 ? PAL.w : '#2a2aff') : gh.c;
      ctx.fillRect(px + 1, py + 2, t - 2, t - 3);
      ctx.fillRect(px + 2, py + 1, t - 4, 1);
      ctx.fillStyle = PAL.w; ctx.fillRect(px + 2, py + 4, 2, 2); ctx.fillRect(px + t - 4, py + 4, 2, 2);
      text(ctx, gh.name, px + t / 2, py - 1, ctx.fillStyle = this.scared ? PAL.b : gh.c, 4, true);
    }
    text(ctx, `${'♥'.repeat(Math.max(0, this.lives))}`, 6, H - 6, PAL.r, 8);
    text(ctx, 'PAYDAY = $', W - 60, H - 6, PAL.g, 6);
  }
}

/* =========================================================================== roach invaders */

class Roaches {
  constructor() {
    this.x = W / 2;
    this.shots = [];
    this.drops = [];
    this.roaches = [];
    for (let r = 0; r < 4; r++) for (let c = 0; c < 8; c++) this.roaches.push({ x: 24 + c * 22, y: 40 + r * 18, alive: true });
    this.vx = 18;
    this.cool = 0;
    this.score = 0;
    this.wave = 1;
    this.start = false;
    this.over = false;
  }

  key(k) { if (k === 'Space') this.fire(); }

  fire() {
    if (this.cool > 0) return;
    this.cool = 0.35;
    this.shots.push({ x: this.x, y: H - 30 });
  }

  update(dt, keys) {
    if (keys.has('ArrowLeft')) this.x = Math.max(10, this.x - 110 * dt);
    if (keys.has('ArrowRight')) this.x = Math.min(W - 10, this.x + 110 * dt);
    if (keys.has('Space')) this.fire();
    this.cool -= dt;
    for (const s of this.shots) s.y -= 190 * dt;
    this.shots = this.shots.filter((s) => s.y > 14);
    const alive = this.roaches.filter((r) => r.alive);
    let edge = false;
    for (const r of alive) { r.x += this.vx * dt; if (r.x < 10 || r.x > W - 10) edge = true; }
    if (edge) { this.vx *= -1.04; for (const r of alive) r.y += 8; }
    for (const s of this.shots) for (const r of alive) {
      if (r.alive && Math.abs(s.x - r.x) < 8 && Math.abs(s.y - r.y) < 6) { r.alive = false; s.y = -99; this.score += 20; }
    }
    if (Math.random() < dt * (1 + this.wave * 0.4) && alive.length) { const r = pickOf(alive); this.drops.push({ x: r.x, y: r.y }); }
    for (const d of this.drops) d.y += 80 * dt;
    if (this.drops.some((d) => Math.abs(d.x - this.x) < 8 && d.y > H - 34 && d.y < H - 20) || alive.some((r) => r.y > H - 44)) {
      this.over = true;
      this.overLine = pickOf(['THE ROACHES WON. THE ROACHES ALWAYS WIN.', 'CALL THE SUPER. HE WILL NOT COME.', 'THEY ARE IN THE WALLS NOW.']);
    }
    this.drops = this.drops.filter((d) => d.y < H);
    if (!alive.length) {
      this.wave += 1;
      this.score += 100;
      for (const r of this.roaches) { r.alive = true; r.y -= 0; }
      this.roaches.forEach((r, i) => { r.x = 24 + (i % 8) * 22; r.y = 40 + Math.floor(i / 8) * 18; });
      this.vx = 18 + this.wave * 6;
    }
  }

  draw(ctx) {
    for (const r of this.roaches) {
      if (!r.alive) continue;
      const wig = Math.floor(performance.now() / 200) % 2;
      ctx.fillStyle = '#8a4a1a';
      ctx.fillRect(r.x - 5, r.y - 3, 10, 6);
      ctx.fillStyle = '#5a2a0a';
      ctx.fillRect(r.x - 6 + wig, r.y + 2, 2, 2); ctx.fillRect(r.x + 4 - wig, r.y + 2, 2, 2);
      ctx.fillRect(r.x - 3, r.y - 5, 1, 2); ctx.fillRect(r.x + 2, r.y - 5, 1, 2);
    }
    ctx.fillStyle = PAL.g;
    for (const s of this.shots) ctx.fillRect(s.x - 1, s.y, 2, 6);
    ctx.fillStyle = PAL.o;
    for (const d of this.drops) ctx.fillRect(d.x - 1, d.y, 2, 4);
    // the can of spray
    ctx.fillStyle = PAL.r; ctx.fillRect(this.x - 5, H - 30, 10, 14);
    ctx.fillStyle = PAL.w; ctx.fillRect(this.x - 2, H - 34, 4, 4);
    text(ctx, `WAVE ${this.wave}`, W / 2, H - 4, PAL.dim, 6, true);
  }
}

function pickOf(a) { return a[Math.floor(Math.random() * a.length)]; }
