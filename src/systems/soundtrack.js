/**
 * The soundtrack director: which piece of the score fits where Mo is and what is happening.
 *
 * Every track lives in /Music and was composed for one place. The director only decides; the
 * Audio class does the crossfading, keeps one track audible at a time, never restarts the track
 * that is already playing, and resumes a track from where it was left.
 *
 * The files are named however they were delivered — most carry the "Mo Functional_ " prefix,
 * ThinWalls and the Ashby/Clinic/Laundromat/Precinct/Restaurant pieces do not, and the park piece
 * is its own EP. The table below is the only place those names live.
 *
 *   Main Menu    the title corridor
 *   City         Kestrel Street, by day
 *   Ashby Ave    Ashby Avenue: the bus, the stalls, Lucia's and the precinct door
 *   Concrete Green  Kestrel Park
 *   Bodega       inside Miguel's
 *   Quik-Stop    the store, its counter, and the front of it for a while after a shift
 *   Church       inside the Golden Fellowship
 *   Habib        inside Habib's Corner
 *   Thin Walls   Unit 3B — Mo's apartment
 *   Clinic       the Kestrel Clinic
 *   Laundromat   Dee's Wash & Fold, and the back room once it is his
 *   Precinct     the 84th
 *   Restaurant   Lucia's, inside
 *   Lost Time    everything else: the walk-up's stairs and halls, and any place without a piece
 *                of its own. It is also the mood the outdoors drop into late at night, and the
 *                score the endings close on. A missing file lands here too, rather than silence.
 */
const dir = 'Music/';
const file = (name) => encodeURI(`${dir}${name}`);

export const TRACKS = {
  menu:        { src: file('Mo Functional_ Main Menu.mp3'),        title: 'Main Menu' },
  city:        { src: file('Mo Functional_ City.mp3'),             title: 'City' },
  ashby:       { src: file('Mo Functional_AshbyAve.mp3'),          title: 'Ashby Avenue' },
  park:        { src: file('KestrelPark_ConcreteGreen.mp3'),       title: 'Concrete Green' },
  bodega:      { src: file('Mo Functional_ Bodega.mp3'),           title: 'Bodega' },
  quikstop:    { src: file('Mo Functional_ Quik-Stop.mp3'),        title: 'Quik-Stop' },
  church:      { src: file('Mo Functional_ Church.mp3'),           title: 'Church' },
  habib:       { src: file('Mo Functional_ Habib.mp3'),            title: 'Habib' },
  apartment:   { src: file('Mo Functional_ThinWalls.mp3'),         title: 'Thin Walls' },
  clinic:      { src: file('Mo Functional_Clinic.mp3'),            title: 'Kestrel Clinic' },
  laundromat:  { src: file('Mo Functional_Laundromat.mp3'),        title: "Dee's Wash & Fold" },
  precinct:    { src: file('Mo Functional_Precinct.mp3'),          title: '84th Precinct' },
  restaurant:  { src: file('Mo Functional_Restaurant.mp3'),        title: "Lucia's" },
  lost:        { src: file('Mo Functional_ Lost Time.mp3'),        title: 'Lost Time' },
};

/** The place without its own piece of music gets this one. Never a dedicated assignment. */
export const FALLBACK_ID = 'lost';

/**
 * Area id → track id. The area ids are the keys `World.loadArea` uses; anything missing from
 * here (the walk-up, and any area added later) falls back to Lost Time rather than to silence.
 * `laundry_back` is the back room of the laundromat, the same building as the machines.
 */
export const AREA_TRACKS = {
  apartment: 'apartment',
  bodega: 'bodega',
  quikstop: 'quikstop',
  habibs: 'habib',
  church: 'church',
  clinic: 'clinic',
  laundromat: 'laundromat',
  laundry_back: 'laundromat',
  precinct: 'precinct',
  restaurant: 'restaurant',
  street: 'city',
  avenue: 'ashby',
  park: 'park',
};

/** The places that share the city's weather, and lose the melody after ten at night. */
const OUTDOOR = new Set(['street', 'avenue', 'park']);

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

  /** A track whose file is not there hands the room to the fallback instead of going quiet. */
  usable(id) {
    if (id === FALLBACK_ID) return FALLBACK_ID;
    return this.g.audio?.failed?.has?.(TRACKS[id].src) ? FALLBACK_ID : id;
  }

  pick() {
    const g = this.g;
    if (g.mode === 'menu') return 'menu';
    if (g.mode === 'ending') return FALLBACK_ID;
    const s = g.state;
    const area = g.world?.areaId;
    if (this.cueId && performance.now() < this.cueUntil && (area === 'street' || !area)) return this.usable(this.cueId);
    this.cueId = null;

    // the street: the store's music spills out of its door; hysteresis so the edge never flaps
    if (!area || area === 'street') {
      const mo = g.world?.mo?.root?.position;
      if (mo) {
        const d = Math.hypot(mo.x - STORE.x, mo.z - STORE.z);
        this.atStore = this.atStore ? d < STORE.leave : d < STORE.enter;
      }
      if (this.atStore) return this.usable('quikstop');
    } else {
      this.atStore = false;
    }

    const mod = minuteOfDay(s?.clock?.m ?? 0);
    const night = mod >= 22 * 60 || mod < 5 * 60;
    // the city after dark, and the deep of a withdrawal, take the late score out of doors.
    // Indoors, a place with its own piece keeps it whatever the hour.
    if ((!area || OUTDOOR.has(area)) && (night || (s?.stats?.withdrawal ?? 0) > 72)) return FALLBACK_ID;

    return this.usable(AREA_TRACKS[area] || FALLBACK_ID);
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
    this.g.audio.playTrack?.(TRACKS[id].src, {
      fade,
      restart: id === 'menu',
      fallback: id === FALLBACK_ID ? null : TRACKS[FALLBACK_ID].src,
    });
  }

  get title() { return this.id ? TRACKS[this.id].title : ''; }
}
