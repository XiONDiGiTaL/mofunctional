/**
 * Options, reachable from the pause menu while playing: the two volume buses, the camera (with a
 * reset), and the controls: every remappable key, the ones that never move, and what each does on
 * a gamepad. Rebinding is click-then-press; a key another action held swaps over to it.
 */
import { BINDINGS, FIXED_KEYS, keysFor, keyName, rebind, resetBindings } from '../core/input.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let open = null;

export function showOptions(g) {
  closeOptions(g);
  const root = document.getElementById('ui') || document.body;
  const wrap = document.createElement('div');
  wrap.className = 'options';
  let waiting = null; // the action waiting for a key

  const draw = () => {
    const s = g.state.settings;
    const pct = (v, d) => Math.round((v ?? d) * 100);
    const pad = g.input?.gamepad?.();
    wrap.innerHTML = `
      <div class="options__panel" role="dialog" aria-label="Options">
        <header class="options__head"><b>OPTIONS</b><span>the clock is stopped</span><button class="shopmenu__x" data-close aria-label="Close">×</button></header>
        <section>
          <h3>Sound</h3>
          <label>Music <em>${pct(s.volume, 0.7)}%</em><input type="range" min="0" max="100" value="${pct(s.volume, 0.7)}" data-opt="music"></label>
          <label>Sound effects <em>${pct(s.sfxVolume, 0.5)}%</em><input type="range" min="0" max="100" value="${pct(s.sfxVolume, 0.5)}" data-opt="sfx"></label>
          <button class="btn btn--sm ${s.muted ? 'btn--primary' : ''}" data-opt="mute">${s.muted ? 'Unmute' : 'Mute all'}</button>
        </section>
        <section>
          <h3>Camera</h3>
          <label>Distance <em>${pct(s.camDist, 1)}%</em><input type="range" min="70" max="140" value="${pct(s.camDist, 1)}" data-opt="camdist"></label>
          <label>Height <em>${pct(s.camHeight, 1)}%</em><input type="range" min="80" max="135" value="${pct(s.camHeight, 1)}" data-opt="camheight"></label>
          <button class="btn btn--sm" data-opt="camreset">Reset camera <small>(${esc(keyName(keysFor(s, 'camreset')[0]))} · R3)</small></button>
          <p class="options__note">Indoors the camera stops short of walls and under the ceiling, whatever these say.</p>
        </section>
        <section class="options__controls">
          <h3>Controls</h3>
          <p class="options__note">Click a key, then press the new one. Esc cancels. ${pad ? `Controller: <b>${esc(pad.id.replace(/\s*\(.*$/, '').slice(0, 40))}</b>` : 'No controller connected.'}</p>
          <table>
            <tr><th>Action</th><th>Key</th><th>Also</th><th>Gamepad</th></tr>
            ${BINDINGS.map((b) => {
              const [primary, ...extra] = keysFor(s, b.id);
              return `<tr><td>${esc(b.label)}</td>
                <td><button class="keycap ${waiting === b.id ? 'keycap--wait' : ''}" data-bind="${b.id}">${waiting === b.id ? 'press a key…' : esc(keyName(primary))}</button></td>
                <td>${extra.map((k) => `<i class="keycap keycap--fixed">${esc(keyName(k))}</i>`).join(' ')}</td>
                <td class="options__pad">${esc(b.pad)}</td></tr>`;
            }).join('')}
            ${FIXED_KEYS.map(([label, key, padBtn]) => `<tr><td>${esc(label)}</td><td><i class="keycap keycap--fixed">${esc(key)}</i></td><td></td><td class="options__pad">${esc(padBtn)}</td></tr>`).join('')}
          </table>
          <button class="btn btn--sm" data-opt="keyreset">Reset keys to defaults</button>
        </section>
      </div>`;
  };

  wrap.addEventListener('input', (e) => {
    const k = e.target.dataset?.opt;
    const v = Number(e.target.value);
    if (k === 'music') g.setMusicVolume?.(v / 100);
    if (k === 'sfx') g.setSfxVolume?.(v / 100);
    if (k === 'camdist') g.setCamera('dist', v);
    if (k === 'camheight') g.setCamera('height', v);
    const em = e.target.parentElement?.querySelector('em');
    if (em) em.textContent = `${v}%`;
  });
  wrap.addEventListener('click', (e) => {
    if (e.target.closest('[data-close]') || e.target === wrap) { closeOptions(g); return; }
    const b = e.target.closest('[data-bind]');
    if (b) { waiting = waiting === b.dataset.bind ? null : b.dataset.bind; draw(); return; }
    const opt = e.target.closest('button[data-opt]')?.dataset.opt;
    if (opt === 'mute') g.setMuted?.(!g.state.settings.muted);
    if (opt === 'camreset') { g.setCamera('reset'); g.toast?.('Camera reset.', 'info'); }
    if (opt === 'keyreset') resetBindings(g.state.settings);
    if (opt) draw();
  });
  const onKey = (e) => {
    if (waiting) {
      e.preventDefault();
      e.stopImmediatePropagation();
      if (e.code !== 'Escape') {
        if (!rebind(g.state.settings, waiting, e.code)) g.toast?.('Tab and Esc stay where they are.', 'info');
      }
      waiting = null;
      draw();
      return;
    }
    if (e.key === 'Escape') { e.stopImmediatePropagation(); e.preventDefault(); closeOptions(g); }
  };
  window.addEventListener('keydown', onKey, true);
  draw();
  root.appendChild(wrap);
  open = { wrap, onKey };
  g.paused = true;
  g.overlayOpen = true;
  g.onModalOpenChange?.(true);
}

export function closeOptions(g) {
  if (!open) return;
  window.removeEventListener('keydown', open.onKey, true);
  open.wrap.remove();
  open = null;
  g.paused = false;
  g.overlayOpen = false;
  g.onModalOpenChange?.(false);
  g.input?.clear?.();
}

export const optionsOpen = () => !!open;
