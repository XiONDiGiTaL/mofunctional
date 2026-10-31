/**
 * Unified input: keyboard and gamepad feeding one movement/orbit model.
 *
 * Axes are camera-relative and positive-forward: W / left-stick-up is always "away from the
 * camera". Q and E (or the shoulder buttons, or the right stick) orbit the camera around Mo.
 *
 * Binding summary
 *   move      WASD / arrow keys / left stick / d-pad
 *   orbit     Q, E / LB, RB / right stick X / mouse drag
 *   interact  F / A
 *   phone     TAB / B
 *   pause     ESC / START
 *   speed     1 2 3, D-pad up/down on the pad
 */

const PAD_BUTTON = {
  A: 0, B: 1, X: 2, Y: 3,
  LB: 4, RB: 5, LT: 6, RT: 7,
  BACK: 8, START: 9,
  L3: 10, R3: 11,
  UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15,
};

const MOVE_KEYS = {
  forward: ['KeyW', 'ArrowUp'],
  back: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
};

export class InputSystem {
  constructor(game) {
    this.g = game;
    this.keys = new Set();
    this.move = { x: 0, y: 0 };
    this.camAxis = 0;
    this.dragAxis = 0;
    this.padIndex = null;
    this.padName = null;
    this.padButtons = {};
    this.events = [];
    this.clicks = [];
    this.lastDevice = 'keyboard';
    this.bind();
  }

  /* --------------------------------- setup -------------------------------- */

  bind() {
    window.addEventListener('keydown', (e) => {
      const code = e.code;
      if (['Tab', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(code)) e.preventDefault();
      if (e.repeat) return;
      this.lastDevice = 'keyboard';
      this.keys.add(code);
      const g = this.g;
      if (code === 'Tab') { this.events.push('phone'); return; }
      if (code === 'Escape') { this.events.push('pause'); return; }
      if (g.mode === 'menu' && code === 'Enter') {
        const gate = document.querySelector('.screen');
        if (gate) gate.click();
        return;
      }
      if (g.mode !== 'play' || g.phoneOpen || g.modalOpen) return;
      if (code === 'KeyF' || code === 'Space' || code === 'Enter') this.events.push('interact');
      if (code === 'KeyC') this.events.push('crt');
      if (code === 'KeyR') this.events.push('ratio');
      if (code === 'Digit1') this.events.push('speed1');
      if (code === 'Digit2') this.events.push('speed2');
      if (code === 'Digit3') this.events.push('speed3');
      if (code === 'KeyM') this.events.push('map');
    });

    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => { this.keys.clear(); this.move.x = 0; this.move.y = 0; });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.keys.clear();
    });

    window.addEventListener('gamepadconnected', (e) => {
      this.padIndex = e.gamepad.index;
      this.padName = e.gamepad.id;
      this.lastDevice = 'pad';
      this.g.toast?.(`Controller connected: ${shortPadName(e.gamepad.id)}`, 'good');
    });
    window.addEventListener('gamepaddisconnected', (e) => {
      if (this.padIndex === e.gamepad.index) {
        this.padIndex = null;
        this.padName = null;
        this.g.toast?.('Controller disconnected.', 'bad');
      }
    });

    // mouse and touch: drag to orbit the camera, tap the floor to walk Mo there
    const stage = document.getElementById('stage');
    if (stage) {
      let dragging = false;
      let lastX = 0;
      let downX = 0;
      let downY = 0;
      let moved = 0;
      let downAt = 0;
      let onWorld = false;
      stage.addEventListener('pointerdown', (e) => {
        if (e.button !== 0) return;
        dragging = true;
        lastX = e.clientX;
        downX = e.clientX;
        downY = e.clientY;
        moved = 0;
        downAt = performance.now();
        onWorld = e.target?.tagName === 'CANVAS';
        stage.setPointerCapture?.(e.pointerId);
      });
      stage.addEventListener('pointermove', (e) => {
        if (!dragging) return;
        const d = e.clientX - lastX;
        lastX = e.clientX;
        moved = Math.max(moved, Math.hypot(e.clientX - downX, e.clientY - downY));
        // only orbit once the pointer has actually travelled, so a tap never nudges the camera
        if (moved > 5) this.dragAxis += d * 0.006;
      });
      stage.addEventListener('pointerup', (e) => {
        if (!dragging) return;
        dragging = false;
        const g = this.g;
        const tap = onWorld && moved <= 6 && performance.now() - downAt < 600;
        if (tap && g.mode === 'play' && !g.modalOpen && !g.phoneOpen) {
          this.clicks.push({ x: e.clientX, y: e.clientY });
        }
      });
      stage.addEventListener('pointercancel', () => { dragging = false; });
      stage.addEventListener('pointerleave', () => { dragging = false; });
    }
  }

  /* --------------------------------- polling ------------------------------- */

  /** Called once per frame, before the world updates. */
  poll(dt) {
    const g = this.g;
    const k = this.keys;
    const held = (names) => names.some((n) => k.has(n));

    let mx = 0;
    let my = 0;
    if (held(MOVE_KEYS.forward)) my += 1;
    if (held(MOVE_KEYS.back)) my -= 1;
    if (held(MOVE_KEYS.right)) mx += 1;
    if (held(MOVE_KEYS.left)) mx -= 1;

    let cam = 0;
    if (k.has('KeyQ')) cam -= 1;
    if (k.has('KeyE')) cam += 1;

    // ---- gamepad
    const pad = this.gamepad();
    if (pad) {
      const ax = (i) => (Math.abs(pad.axes[i] ?? 0) > 0.16 ? pad.axes[i] : 0);
      const lx = ax(0);
      const ly = ax(1);
      const rx = ax(2);
      if (lx || ly) { mx += lx; my -= ly; this.lastDevice = 'pad'; }
      if (rx) { cam += rx; this.lastDevice = 'pad'; }

      const down = (n) => !!pad.buttons[PAD_BUTTON[n]]?.pressed;
      const value = (n) => pad.buttons[PAD_BUTTON[n]]?.value ?? 0;
      if (down('LB')) cam -= 1;
      if (down('RB')) cam += 1;
      if (down('LT') || value('LT') > 0.4) cam -= 0.7;
      if (down('RT') || value('RT') > 0.4) cam += 0.7;
      if (down('UP')) my += 1;
      if (down('DOWN')) my -= 1;
      if (down('LEFT')) mx -= 1;
      if (down('RIGHT')) mx += 1;

      this.edge('A', 'interact');
      this.edge('B', 'phone');
      this.edge('START', 'pause');
      this.edge('Y', 'speed2');
      this.edge('X', 'speed1');
      this.edge('BACK', 'crt');
    }

    // normalise the move vector so diagonals are not faster
    const len = Math.hypot(mx, my);
    if (len > 1) { mx /= len; my /= len; }
    this.move.x = mx;
    this.move.y = my;
    this.camAxis = Math.max(-1.6, Math.min(1.6, cam));
    this.orbitDelta = cam * 2.4 * dt + this.dragAxis;
    this.dragAxis = 0;
    if (Math.abs(mx) + Math.abs(my) > 0.1 && this.lastDevice === 'keyboard' && !pad) this.lastDevice = 'keyboard';
    void g;
  }

  gamepad() {
    if (typeof navigator === 'undefined' || !navigator.getGamepads) return null;
    const pads = navigator.getGamepads();
    if (this.padIndex != null && pads[this.padIndex]) return pads[this.padIndex];
    for (const p of pads) {
      if (p && p.connected) { this.padIndex = p.index; this.padName = p.id; return p; }
    }
    return null;
  }

  edge(button, action) {
    const pad = this.gamepad();
    if (!pad) return;
    const pressed = !!pad.buttons[PAD_BUTTON[button]]?.pressed;
    const was = !!this.padButtons[button];
    if (pressed && !was) {
      this.lastDevice = 'pad';
      this.events.push(action);
    }
    this.padButtons[button] = pressed;
  }

  /** Consume a one-shot action queued by the keyboard or a gamepad button. */
  take(action) {
    const i = this.events.indexOf(action);
    if (i === -1) return false;
    this.events.splice(i, 1);
    return true;
  }

  clear() {
    this.keys.clear();
    this.move.x = 0;
    this.move.y = 0;
    this.events.length = 0;
    this.clicks.length = 0;
  }

  get padConnected() { return !!this.gamepad(); }
}

function shortPadName(id = '') {
  const m = String(id).match(/^(.*?)\s*\(/);
  return (m ? m[1] : String(id)).slice(0, 46) || 'Controller';
}
