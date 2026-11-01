/**
 * The hidden debug menu.
 *
 *   ~  → password prompt → `Moses` → the panel
 *
 * A wrong password closes the prompt with no error and no hint: it does not exist, which is the
 * point. Everything in the panel calls the same systems the game does — simulate(), rent.js,
 * romance.js, clinic.js, scheduler.js, the collapsing sequence, the real animations — so a
 * change here is a change to the actual run, not to a label.
 *
 * It is a testing tool, not security. It pauses the clock while open (nothing drains behind the
 * panel) and writes an autosave after destructive actions only once, on close.
 */
import { CONFIG } from '../core/config.js';
import { clamp, money, hhmm, dayOf, minuteOfDay } from '../core/util.js';
import { bump, addItem } from '../core/state.js';
import { billInfo } from '../systems/economy.js';
import * as rent from '../systems/rent.js';
import * as romance from '../systems/romance.js';
import * as clinic from '../systems/clinic.js';
import * as scheduler from '../systems/scheduler.js';
import * as events from '../systems/events.js';
import { useSubstance } from '../systems/needs.js';

const STATS = [
  ['energy', 'Energy'], ['hunger', 'Food'], ['hygiene', 'Hygiene'],
  ['stress', 'Stress'], ['morale', 'Morale'], ['addiction', 'Dependence'],
  ['tolerance', 'Tolerance'], ['risk', 'Risk'], ['withdrawal', 'Withdrawal'],
];

const PLACES = [
  ['apartment', 'Unit 3B'], ['street', 'Kestrel St.'], ['quikstop', 'Quik-Stop'], ['bodega', "Miguel's"],
  ['habibs', "Habib's"], ['church', 'Fellowship'], ['park', 'Kestrel Park'], ['clinic', 'Clinic'],
];

// the NPC kinds the world knows how to build, and which ones the panel's pickers have chosen
const NPC_KINDS = ['kev', 'rae', 'dale', 'dex', 'nia', 'miguel', 'habib', 'homeless', 'junkie', 'clerk', 'rolo', 'stephanie', 'melanie', 'diana'];
const debugSel = {};

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function installDebugMenu(g) {
  if (g.__debugInstalled) return;
  g.__debugInstalled = true;
  const ui = document.getElementById('ui') || document.body;
  let panel = null;
  let prompt = null;

  const close = () => {
    if (panel) { panel.remove(); panel = null; }
    g.debugOpen = false;
    g.autosave?.();
    g.hud?.update?.();
  };

  const closePrompt = () => { if (prompt) { prompt.remove(); prompt = null; } };

  const open = () => {
    closePrompt();
    if (panel) { close(); return; }
    panel = document.createElement('div');
    panel.className = 'debug';
    panel.innerHTML = `<div class="debug__panel" role="dialog" aria-label="Debug menu">
      <header class="debug__head"><b>MO: FUNCTIONAL · DEBUG</b><span>~ closes</span>
        <button class="debug__x" data-dact="close">&times;</button></header>
      <div class="debug__body"></div>
    </div>`;
    ui.appendChild(panel);
    g.debugOpen = true;
    render();
    panel.addEventListener('click', onClick);
  };

  const showPrompt = () => {
    if (prompt) { closePrompt(); return; }
    if (panel) return;
    prompt = document.createElement('div');
    prompt.className = 'debug-prompt';
    prompt.innerHTML = `<div class="debug-prompt__box">
      <label for="dbg-pass">PASSWORD</label>
      <input id="dbg-pass" type="password" autocomplete="off" spellcheck="false" maxlength="24" />
    </div>`;
    ui.appendChild(prompt);
    const input = prompt.querySelector('input');
    input.focus();
    const submit = () => {
      const value = input.value;
      // wrong: it simply was not there. no message, no shake, no clue.
      if (String(value) !== CONFIG.debug.password) { closePrompt(); return; }
      open();
    };
    input.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') { e.preventDefault(); submit(); }
      if (e.key === 'Escape') { e.preventDefault(); closePrompt(); }
    });
    // clicking away closes it, silently
    prompt.addEventListener('click', (e) => { if (e.target === prompt) closePrompt(); });
  };

  window.addEventListener('keydown', (e) => {
    if (e.code !== 'Backquote' && e.key !== '~' && e.key !== '`') return;
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    e.preventDefault();
    e.stopPropagation();
    if (panel) close(); else showPrompt();
  }, true);

  /* ------------------------------------------------------------ actions */

  function act(name, arg) {
    const s = g.state;
    switch (name) {
      case 'close': return close();

      /* ---- condition ---- */
      case 'heal':
        for (const [k] of STATS) s.stats[k] = ['stress', 'addiction', 'tolerance', 'risk', 'withdrawal'].includes(k) ? 0 : 100;
        g.toast('Debug: all needs replenished.', 'good');
        break;
      case 'resetintox':
        s.high.level = 0;
        s.high.until = s.clock.m;
        s.stats.tolerance = 0;
        s.stats.withdrawal = 0;
        g.toast('Debug: intoxication, tolerance and withdrawal cleared.', 'good');
        break;
      case 'sober':
        s.stats.addiction = Math.min(s.stats.addiction, 4);
        s.stats.risk = Math.min(s.stats.risk, 6);
        s.flags.odScare = false;
        g.toast('Debug: dependence and risk reset.', 'good');
        break;
      case 'stat': {
        const [key, delta] = String(arg).split(':');
        if (key in s.stats) bump(s, key, Number(delta));
        break;
      }

      /* ---- money ---- */
      case 'money': {
        const amount = CONFIG.debug.moneyPerClick;
        g.earnMoney(amount, 'Debug');
        g.toast(`Debug: +${money(amount)} (${money(s.money)}).`, 'good');
        break;
      }

      /* ---- time ---- */
      case 'hour': {
        const target = Number(arg);
        const dayStart = Math.floor(s.clock.m / 1440) * 1440;
        const delta = (dayStart + target * 60) - s.clock.m;
        g.advance(delta > 0 ? delta : 1440 + delta, { noCollapse: true });
        break;
      }
      case 'skip':
        g.advance(Number(arg) * 60, { noCollapse: true });
        break;
      case 'newday':
        g.advance(1440, { noCollapse: true });
        break;
      case 'pause':
        g.paused = !g.paused;
        g.toast(g.paused ? 'Debug: clock paused.' : 'Debug: clock resumed.', 'info');
        break;

      /* ---- world ---- */
      case 'tp':
        g.goTo(String(arg), null);
        break;
      case 'event':
        scheduler.trigger(g, String(arg), events.EVENTS_LIST);
        break;
      case 'setday': {
        // forward only: the bills, the life history and every cooldown are keyed to the day, and
        // rewinding the clock under them would corrupt the run rather than test it
        const target = Math.floor(Number(arg));
        const today = dayOf(s.clock.m);
        if (!(target > today)) { g.toast(`Debug: day ${today} or later only (time only runs forward).`, 'bad'); break; }
        const minutes = (target - today) * 1440;
        g.advance(minutes, { noCollapse: true });
        g.toast(`Debug: it is day ${dayOf(s.clock.m)}.`, 'info');
        break;
      }
      case 'npcspawn':
        if (g.world?.debugSpawnNPC?.(arg)) g.toast(`Debug: ${arg} is here.`, 'info');
        break;
      case 'npcdespawn':
        g.toast(g.world?.debugDespawnNPC?.(arg) ? `Debug: removed the nearest ${arg}.` : `Debug: no ${arg} in this area.`, 'info');
        break;
      case 'npcreset':
        g.toast(`Debug: ${g.world?.resetNPCs?.(g) ?? 0} NPCs put back on schedule.`, 'info');
        break;
      case 'cooldowns':
        scheduler.clearCooldowns(g);
        g.toast('Debug: event cooldowns cleared.', 'good');
        break;

      /* ---- relationships ---- */
      case 'aff': {
        const [id, delta] = String(arg).split(':');
        const st = romance.partnerState(s, id);
        st.affection = clamp(st.affection + Number(delta));
        st.met = true;
        break;
      }
      case 'girlfriend': {
        const st = romance.partnerState(s, arg);
        st.met = true;
        st.girlfriend = true;
        st.sinceDay = st.sinceDay || dayOf(s.clock.m);
        st.affection = Math.max(st.affection, 60);
        g.toast(`Debug: ${CONFIG.partners[arg].name} is your girlfriend.`, 'good');
        break;
      }
      case 'livein': {
        const st = romance.partnerState(s, arg);
        st.met = true;
        st.girlfriend = true;
        st.sinceDay = st.sinceDay || dayOf(s.clock.m);
        st.affection = Math.max(st.affection, 70);
        s.romance.liveIn = arg;
        romance.romanceState(s);
        g.toast(`Debug: ${CONFIG.partners[arg].name} lives in Unit 3B.`, 'good');
        break;
      }
      case 'gift': {
        const r = romance.romanceState(s);
        r.apartmentGift = null;
        const ok = romance.spawnGift(g, arg);
        g.toast(ok ? 'Debug: a present is waiting at home.' : 'Debug: no gift pool for her, or one is already pending.', ok ? 'good' : 'bad');
        break;
      }
      case 'romreset':
        romance.debugReset(g);
        g.toast('Debug: relationship state reset.', 'info');
        break;

      /* ---- gameplay testing ---- */
      case 'collapse':
        g.collapseSequence?.('collapse');
        break;
      case 'clinicrecover':
        clinic.recoverHere(g, { cause: 'collapse', free: true });
        g.goTo?.('clinic', null);
        break;
      case 'rent':
        rent.payRent(g, { ahead: true });
        break;
      case 'rentpaid':
        rent.debugSetRent(g, { paidAhead: 0 });
        g.toast('Debug: rent marked paid for this cycle.', 'good');
        break;
      case 'date': {
        const [id, activity] = String(arg).split(':');
        romance.startDate(g, id, activity || 'park');
        break;
      }
      case 'cheeks': {
        romance.partnerState(s, arg).affection = 100;
        s.romance.afterglowUntil = 0;
        romance.cheeks(g, arg);
        break;
      }
      case 'afterglow':
        romance.startAfterglow(g);
        g.toast('Debug: Afterglow started (24 in-game hours).', 'good');
        break;
      case 'dance':
        g.world?.playDance?.(8);
        break;
      case 'use':
        if (s.inventory.find((i) => i.id === arg)) useSubstance(g, arg);
        else g.toast(`Debug: no ${arg} in the inventory.`, 'bad');
        break;
      case 'give':
        // through the real inventory: one stack per item, not a new row per click
        if (!addItem(s, arg, 1)) g.toast(`Debug: no item called ${arg}.`, 'bad');
        break;
      case 'phone':
        g.togglePhone();
        break;
      case 'summary':
        g.onDaySummary?.();
        break;
      default:
        console.warn('[debug] unknown action', name);
    }
    render();
    g.hud?.update?.();
  }

  function onClick(e) {
    const btn = e.target.closest('[data-dact]');
    if (!btn) return;
    e.preventDefault();
    act(btn.dataset.dact, btn.dataset.arg);
  }

  function render() {
    if (!panel) return;
    const body = panel.querySelector('.debug__body');
    const s = g.state;
    if (!s) { body.innerHTML = '<div class="debug__note">No run is loaded.</div>'; return; }
    const now = s.clock.m;
    const r = s.romance || {};
    const rentInfo = billInfo(g, 'rent');
    const statRows = STATS.map(([key, label]) => `<div class="debug__row">
      <span>${label}</span><b>${Math.round(s.stats[key] ?? 0)}</b>
      <button data-dact="stat" data-arg="${key}:-10">−</button>
      <button data-dact="stat" data-arg="${key}:10">+</button>
    </div>`).join('');

    const partnerRows = romance.PARTNER_KEYS.map((id) => {
      const p = CONFIG.partners[id];
      const st = romance.partnerState(s, id);
      return `<div class="debug__row debug__row--wide">
        <span>${esc(p.name)}</span><b>${st.affection}</b>
        <small>${st.liveIn ? 'live-in' : st.girlfriend ? 'girlfriend' : st.dates ? `${st.dates} dates` : 'met'}</small>
        <button data-dact="aff" data-arg="${id}:10">+aff</button>
        <button data-dact="aff" data-arg="${id}:-10">−aff</button>
        <button data-dact="girlfriend" data-arg="${id}">gf</button>
        <button data-dact="livein" data-arg="${id}">live-in</button>
        <button data-dact="gift" data-arg="${id}">gift</button>
        <button data-dact="date" data-arg="${id}:park">date</button>
        <button data-dact="cheeks" data-arg="${id}">cheeks</button>
      </div>`;
    }).join('');

    const sel = (debugSel.event = debugSel.event || (events.EVENT_IDS || [])[0] || '');
    const eventOpts = (events.EVENT_IDS || []).map((id) => `<option value="${id}" ${id === sel ? 'selected' : ''}>${id}</option>`).join('');
    const npcSel = (debugSel.npc = debugSel.npc || NPC_KINDS[0]);
    const npcOpts = NPC_KINDS.map((id) => `<option value="${id}" ${id === npcSel ? 'selected' : ''}>${id}</option>`).join('');

    body.innerHTML = `
      <div class="debug__grid">
        <section>
          <h4>Condition</h4>
          ${statRows}
          <div class="debug__row"><button data-dact="heal">Replenish all</button><button data-dact="resetintox">Reset intoxication</button></div>
          <div class="debug__row"><button data-dact="sober">Reset dependence + risk</button><button data-dact="afterglow">Start Afterglow</button></div>
          <div class="debug__row"><button data-dact="dance">Dance animation</button><button data-dact="collapse">Trigger collapse</button></div>
        </section>

        <section>
          <h4>Money</h4>
          <div class="debug__row"><span>Balance</span><b>${money(s.money)}</b></div>
          <div class="debug__row"><button data-dact="money">+${money(CONFIG.debug.moneyPerClick)}</button><button data-dact="rentpaid">Mark rent paid</button></div>
          <div class="debug__row"><button data-dact="rent">Pay rent early</button><span class="debug__note">owed ${money(rentInfo.owed)} · due D${rentInfo.nextDueDay}</span></div>

          <h4>Time</h4>
          <div class="debug__row"><span>Clock</span><b>D${dayOf(now)} · ${hhmm(now)}</b></div>
          <div class="debug__row">${[6, 9, 12, 15, 18, 21, 2].map((h) => `<button data-dact="hour" data-arg="${h}">${String(h).padStart(2, '0')}:00</button>`).join('')}</div>
          <div class="debug__row"><button data-dact="skip" data-arg="1">+1h</button><button data-dact="skip" data-arg="4">+4h</button><button data-dact="newday">+1 day</button><button data-dact="pause">${g.paused ? 'Resume' : 'Pause'} clock</button></div>
          <div class="debug__row"><span>Set day</span><input class="debug__num" type="number" min="${dayOf(now) + 1}" value="${dayOf(now) + 1}" data-dact-input="setday" /><button data-dact="setday" data-arg="${dayOf(now) + 1}" data-input-source="setday">Go</button></div>

          <h4>World</h4>
          <div class="debug__row">${PLACES.map(([id, label]) => `<button data-dact="tp" data-arg="${id}">${label}</button>`).join('')}</div>
          <div class="debug__row"><select data-dact-select="event">${eventOpts}</select><button data-dact="event" data-arg="${sel}" data-select-source="event">Trigger event</button><button data-dact="cooldowns">Clear cooldowns</button></div>
          <div class="debug__row"><select data-dact-select="npc">${npcOpts}</select><button data-dact="npcspawn" data-arg="${npcSel}" data-select-source="npc">Spawn</button><button data-dact="npcdespawn" data-arg="${npcSel}" data-select-source="npc">Despawn</button><button data-dact="npcreset">Reset schedules</button></div>
        </section>

        <section>
          <h4>Relationships</h4>
          ${partnerRows}
          <div class="debug__row"><button data-dact="romreset">Reset all relationship state</button></div>

          <h4>Testing</h4>
          <div class="debug__row"><button data-dact="clinicrecover">Clinic recovery</button><button data-dact="clinicrecover">Test clinic</button><button data-dact="phone">Phone</button><button data-dact="summary">Daily report</button></div>
          <div class="debug__row">${['bliss', 'static', 'mud', 'drip'].map((id) => `<button data-dact="give" data-arg="${id}">+${id}</button>`).join('')}</div>
          <div class="debug__row">${['bliss', 'static', 'mud', 'drip'].map((id) => `<button data-dact="use" data-arg="${id}">use ${id}</button>`).join('')}</div>
          <div class="debug__note">Afterglow: ${r.afterglowUntil > s.clock.m ? `${romance.afterglowLabel(s)}` : 'off'} · live-in: ${r.liveIn || 'none'} · collapses: ${s.counters.collapsed || 0} · events today: ${scheduler.schedulerState(s).today || 0}</div>
        </section>
      </div>`;
    // the <select>s feed the buttons next to them, so one click can use the chosen id
    for (const select of body.querySelectorAll('[data-dact-select]')) {
      select.addEventListener('change', () => {
        debugSel[select.dataset.dactSelect] = select.value;
        for (const btn of body.querySelectorAll(`[data-select-source="${select.dataset.dactSelect}"]`)) btn.dataset.arg = select.value;
      });
    }
    for (const input of body.querySelectorAll('[data-dact-input]')) {
      input.addEventListener('keydown', (e) => e.stopPropagation()); // typing a number is not a hotkey
      input.addEventListener('input', () => {
        const btn = body.querySelector(`[data-input-source="${input.dataset.dactInput}"]`);
        if (btn) btn.dataset.arg = input.value;
      });
    }
  }
}
