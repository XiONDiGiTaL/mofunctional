/**
 * The soundtrack director: which piece of the score fits where Mo is and what is happening.
 *
 * Every track lives in /Music and was composed for one place. The director only decides; the
 * Audio class does the crossfading, keeps one track audible at a time, never restarts the track
 * that is already playing, and resumes a track from where it was left.
 *
 *   Main Menu  the title corridor
 *   City       Kestrel Street by day
 *   Quik-Stop  outside the store's front, at its counter, and for a while after a shift
 *   Bodega     inside Miguel's
 *   Habib      inside Habib's Corner
 *   Church     inside the Golden Fellowship
 *   Lost Time  Unit 3B, the street after 22:00, deep withdrawal, and the endings
 */
const dir = 'Music/';
const file = (name) => encodeURI(`${dir}Mo Functional_ ${name}.mp3`);

export const TRACKS = {
  menu: { src: file('Main Menu'), title: 'Main Menu' },
  city: { src: file('City'), title: 'City' },
  quikstop: { src: file('Quik-Stop'), title: 'Quik-Stop' },
  bodega: { src: file('Bodega'), title: 'Bodega' },
  habib: { src: file('Habib'), title: 'Habib' },
  church: { src: file('Church'), title: 'Church' },
  lost: { src: file('Lost Time'), title: 'Lost Time' },
};

/** Where the Quik-Stop storefront is on the street, and the radius its music carries. */
const STORE = { x: 1.5, z: -5.6, enter: 3.4, leave: 4.6 };

const minuteOfDay = (m) => ((m % 1440) + 1440) % 1440;

export class Soundtrack {
  constructor(game) {
    this.g = game;
    this.id = null;
    this.timer = 0;
    this.atStore = false;
    this.cueId = null;
    this.cueUntil = 0;
  }

  /** Hold a track for `seconds` of real time regardless of place (a shift, a counter). */
  cue(id, seconds = 30) {
    if (!TRACKS[id]) return;
    this.cueId = id;
    this.cueUntil = performance.now() + seconds * 1000;
    this.timer = 0;
  }

  pick() {
    const g = this.g;
    if (g.mode === 'menu') return 'menu';
    if (g.mode === 'ending') return 'lost';
    const s = g.state;
    const area = g.world?.areaId;
    if (this.cueId && performance.now() < this.cueUntil && (area === 'street' || !area)) return this.cueId;
    this.cueId = null;
    switch (area) {
      case 'apartment': return 'lost';
      case 'bodega': return 'bodega';
      case 'habibs': return 'habib';
      case 'church': return 'church';
      default: break;
    }
    // the street: the store's music spills out of its door; hysteresis so the edge never flaps
    const mo = g.world?.mo?.root?.position;
    if (mo) {
      const d = Math.hypot(mo.x - STORE.x, mo.z - STORE.z);
      this.atStore = this.atStore ? d < STORE.leave : d < STORE.enter;
    }
    if (this.atStore) return 'quikstop';
    const mod = minuteOfDay(s?.clock?.m ?? 0);
    const night = mod >= 22 * 60 || mod < 5 * 60;
    if (night || (s?.stats?.withdrawal ?? 0) > 72) return 'lost';
    return 'city';
  }

  /** Called every frame; re-evaluates a few times a second. Silent until audio is unlocked. */
  update(dt, force = false) {
    this.timer -= dt;
    if (!force && this.timer > 0) return;
    this.timer = 0.4;
    if (!this.g.audio?.ready) return;
    const id = this.pick();
    if (id === this.id && !force) return;
    const prev = this.id;
    this.id = id;
    // the menu always starts at its top; a door between two places is a quicker fade
    const fade = prev === null ? 0.8 : id === 'menu' || prev === 'menu' ? 1.2 : 1.8;
    this.g.audio.playTrack?.(TRACKS[id].src, { fade, restart: id === 'menu' });
  }

  get title() { return this.id ? TRACKS[this.id].title : ''; }
}
