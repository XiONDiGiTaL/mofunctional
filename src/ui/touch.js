/**
 * Touch controls, for phones and tablets.
 *
 * A thumbstick on the left feeds the same move vector as WASD (input.touchMove), and a cluster of
 * buttons on the right pushes the same one-shot actions the keyboard does (interact, next, punch,
 * phone, map, pause). Dragging anywhere else on the screen still orbits the camera and a tap on
 * the floor still walks Mo there; those come from input.js already. The controls only appear on a
 * touch screen, and they step aside while a menu, the phone or a conversation is open.
 */
// a phone or tablet: the main pointer is a finger and nothing hovers. A laptop with a touch screen
// still has a mouse and a keyboard, and gets none of this.
const isTouch = () => (typeof window !== 'undefined')
  && !!window.matchMedia?.('(hover: none) and (pointer: coarse)')?.matches;

export function installTouch(game, root = document.body) {
  if (!isTouch()) return null;
  document.documentElement.classList.add('touch');
  const input = game.input;
  input.touchMove = { x: 0, y: 0 };

  const wrap = document.createElement('div');
  wrap.className = 'touchpad';
  wrap.innerHTML = `
    <div class="touchpad__stick" data-stick><div class="touchpad__knob"></div></div>
    <div class="touchpad__buttons">
      <button class="touchpad__btn touchpad__btn--big" data-act="interact" aria-label="Interact">F</button>
      <button class="touchpad__btn" data-act="cycle" aria-label="Next thing in reach">X</button>
      <button class="touchpad__btn" data-act="punch" aria-label="Throw a punch">✊</button>
    </div>
    <div class="touchpad__top">
      <button class="touchpad__btn touchpad__btn--sm" data-act="phone" aria-label="Phone">☎</button>
      <button class="touchpad__btn touchpad__btn--sm" data-act="map" aria-label="Map">◫</button>
      <button class="touchpad__btn touchpad__btn--sm" data-act="pause" aria-label="Pause">II</button>
    </div>`;
  root.appendChild(wrap);

  // nothing here should start a camera drag, a scroll or a pinch-zoom underneath it
  const stop = (e) => { e.stopPropagation(); };
  for (const t of ['pointerdown', 'pointermove', 'pointerup']) wrap.addEventListener(t, stop);

  // ---- the stick: a base that appears under the thumb, a knob that follows it
  const stick = wrap.querySelector('[data-stick]');
  const knob = wrap.querySelector('.touchpad__knob');
  const R = 46;
  let sid = null;
  let cx = 0;
  let cy = 0;
  const setKnob = (dx, dy) => {
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    // up on the screen is forward, like W
    input.touchMove.x = dx / R;
    input.touchMove.y = -dy / R;
    input.lastDevice = 'touch';
  };
  stick.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    sid = e.pointerId;
    stick.setPointerCapture?.(e.pointerId);
    const r = stick.getBoundingClientRect();
    cx = r.left + r.width / 2;
    cy = r.top + r.height / 2;
    const dx = e.clientX - cx;
    const dy = e.clientY - cy;
    const m = Math.hypot(dx, dy) || 1;
    setKnob(dx * Math.min(1, R / m), dy * Math.min(1, R / m));
  });
  stick.addEventListener('pointermove', (e) => {
    if (e.pointerId !== sid) return;
    const dx = e.clientX - cx;
    const dy = e.clientY - cy;
    const m = Math.hypot(dx, dy) || 1;
    setKnob(dx * Math.min(1, R / m), dy * Math.min(1, R / m));
  });
  const release = (e) => { if (e.pointerId !== sid) return; sid = null; setKnob(0, 0); };
  stick.addEventListener('pointerup', release);
  stick.addEventListener('pointercancel', release);

  // ---- buttons: a tap is the key press
  wrap.addEventListener('pointerdown', (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    e.preventDefault();
    b.classList.add('is-down');
    input.events.push(b.dataset.act);
    input.lastDevice = 'touch';
  });
  wrap.addEventListener('pointerup', (e) => e.target.closest('[data-act]')?.classList.remove('is-down'));
  wrap.addEventListener('pointercancel', (e) => e.target.closest('[data-act]')?.classList.remove('is-down'));

  // ---- out of the way when something else has the screen
  const tick = () => {
    const busy = game.mode !== 'play' || game.modalOpen || game.phoneOpen || game.paused || game.debugOpen;
    wrap.classList.toggle('is-hidden', !!busy);
    if (busy && sid == null) { input.touchMove.x = 0; input.touchMove.y = 0; }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  return wrap;
}
